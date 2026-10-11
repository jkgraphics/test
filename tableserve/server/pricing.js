// Server-side price computation. Customer-supplied prices are never trusted: every order line is
// priced from the current menu at submission time and then frozen in order_items.
import { bad, conflict, json } from './util.js';

export const BILLABLE_STATUSES = ['accepted', 'preparing', 'ready', 'served'];

// Validate a cart line against a menu item and return the frozen line snapshot.
// `selections` is { [groupId]: choiceId[] }.
export function priceLine(item, selections = {}, qty, lang = 'en') {
  const problems = [];
  if (!item || !item.active) return { error: 'This dish is no longer on the menu' };
  if (!item.in_stock) return { error: `${item.name} is out of stock` };
  if (selections && typeof selections !== 'object') throw bad('Invalid options');
  const groups = json(item.options, []);
  let unit = item.price;
  const chosen = [];
  for (const g of groups) {
    const raw = selections?.[g.id];
    const ids = raw == null ? [] : Array.isArray(raw) ? raw.map(String) : [String(raw)];
    const unique = [...new Set(ids)];
    if (g.required && unique.length === 0) problems.push(`Please choose ${g.name} for ${item.name}`);
    if (g.type === 'single' && unique.length > 1) problems.push(`Only one ${g.name} can be chosen`);
    if (g.type === 'multi' && g.max && unique.length > g.max) problems.push(`Choose at most ${g.max} ${g.name}`);
    for (const id of unique) {
      const c = (g.choices || []).find((x) => String(x.id) === id);
      if (!c) { problems.push(`${item.name}: option is no longer available`); continue; }
      if (c.in_stock === false) { problems.push(`${item.name}: ${c.name} is out of stock`); continue; }
      unit += Number(c.price) || 0;
      chosen.push({ group: g.name, group_hi: g.name_hi || '', name: c.name, name_hi: c.name_hi || '', price: Number(c.price) || 0 });
    }
  }
  // Unknown group ids are rejected so a client cannot smuggle in stale selections.
  for (const gid of Object.keys(selections || {})) {
    if (!groups.some((g) => g.id === gid)) problems.push(`${item.name}: option is no longer available`);
  }
  if (problems.length) return { error: problems[0], problems };
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw bad('Quantity must be between 1 and 50');
  return {
    line: {
      menu_item_id: item.id,
      name: item.name,
      name_hi: item.name_hi || '',
      diet: item.diet,
      unit_price: unit,
      options: chosen,
      qty,
      line_total: unit * qty,
    },
  };
}

// Validate and price a whole cart. Throws 409 with per-line details when anything is unavailable,
// so the client can show exactly what changed instead of silently dropping items.
export function priceCart(db, branchId, lines) {
  if (!Array.isArray(lines) || lines.length === 0) throw bad('Your cart is empty');
  if (lines.length > 60) throw bad('Too many lines in one order');
  const priced = [];
  const unavailable = [];
  for (const [idx, l] of lines.entries()) {
    const itemId = Number(l?.item_id);
    const qty = Number(l?.qty);
    const item = Number.isInteger(itemId)
      ? db.get('SELECT * FROM menu_items WHERE id = ? AND branch_id = ?', itemId, branchId)
      : null;
    const instructions = typeof l?.instructions === 'string' ? l.instructions.trim().slice(0, 200) : '';
    const r = priceLine(item, l?.selections || {}, qty);
    if (r.error) unavailable.push({ index: idx, item_id: itemId, message: r.error });
    else priced.push({ ...r.line, instructions });
  }
  if (unavailable.length) {
    throw conflict('Some items in your cart are no longer available. Please review your cart.', { unavailable });
  }
  return priced;
}

export function computeDiscount(subtotal, type, value) {
  if (!type || !value) return 0;
  if (type === 'percent') return Math.min(subtotal, Math.round((subtotal * value) / 100));
  return Math.min(subtotal, Math.round(value));
}

// Recompute a bill from scratch using the frozen order lines, company tax configuration and the
// bill's discount. Never uses any client-provided amount.
export function computeBill(db, sessionId) {
  const session = db.get('SELECT * FROM dining_sessions WHERE id = ?', sessionId);
  if (!session) return null;
  const company = db.get('SELECT * FROM companies WHERE id = ?', session.company_id);
  const bill = db.get('SELECT * FROM bills WHERE session_id = ?', sessionId);
  const orders = db.all(
    `SELECT * FROM orders WHERE session_id = ? ORDER BY id`, sessionId);
  const billable = orders.filter((o) => BILLABLE_STATUSES.includes(o.status));
  const lines = [];
  for (const o of billable) {
    for (const it of db.all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', o.id)) {
      lines.push({ ...it, options: json(it.options, []), order_no: o.order_no });
    }
  }
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const discount = computeDiscount(subtotal, bill?.discount_type, bill?.discount_value);
  const afterDiscount = subtotal - discount;
  const serviceCharge = Math.round((afterDiscount * (company.service_charge_pct || 0)) / 100);
  const taxable = afterDiscount + serviceCharge;
  const taxes = json(company.taxes, []).map((t) => ({
    name: t.name, rate: Number(t.rate) || 0, amount: Math.round((taxable * (Number(t.rate) || 0)) / 100),
  }));
  const taxTotal = taxes.reduce((s, t) => s + t.amount, 0);
  const total = taxable + taxTotal;
  const payments = bill ? db.all('SELECT * FROM payments WHERE bill_id = ? ORDER BY id', bill.id) : [];
  const paid = payments.filter((p) => p.status === 'paid' || p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
  const refunded = payments.reduce((s, p) => s + p.refunded_amount, 0);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  return {
    session_id: sessionId,
    bill_id: bill?.id || null,
    bill_no: bill?.bill_no || null,
    status: bill?.status || 'open',
    lines,
    subtotal,
    discount,
    discount_type: bill?.discount_type || null,
    discount_value: bill?.discount_value || 0,
    discount_reason: bill?.discount_reason || '',
    service_charge_pct: company.service_charge_pct || 0,
    service_charge: serviceCharge,
    taxes,
    tax_total: taxTotal,
    total,
    paid,
    refunded,
    outstanding: Math.max(0, total - paid),
    pending_orders: pendingCount,
    payments: payments.map(publicPayment),
    currency: company.currency,
  };
}

export function publicPayment(p) {
  return {
    id: p.id, method: p.method, amount: p.amount, status: p.status, refunded_amount: p.refunded_amount,
    reference: p.reference, provider: p.provider, provider_mode: p.provider_mode,
    initiated_by: p.initiated_by, created_at: p.created_at, confirmed_at: p.confirmed_at,
    failure_reason: p.failure_reason,
  };
}

// Persist computed totals onto the bill row (cache for reports) and flip status when settled.
export function syncBill(db, sessionId) {
  const b = computeBill(db, sessionId);
  if (!b?.bill_id) return b;
  const settled = b.total > 0 && b.paid >= b.total && b.pending_orders === 0;
  db.run(
    `UPDATE bills SET subtotal=?, discount=?, service_charge=?, taxes=?, tax_total=?, total=?, paid=?, refunded=?,
       status=?, paid_at = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now')
                                WHEN ? = 'open' THEN NULL ELSE paid_at END
     WHERE id=?`,
    b.subtotal, b.discount, b.service_charge, JSON.stringify(b.taxes), b.tax_total, b.total, b.paid, b.refunded,
    settled ? 'paid' : 'open', settled ? 'paid' : 'open', settled ? 'paid' : 'open', b.bill_id);
  b.status = settled ? 'paid' : 'open';
  return b;
}
