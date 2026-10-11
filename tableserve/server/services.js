// Core business operations shared by customer, staff and webhook routes. Each operation runs in a
// single SQLite transaction and then publishes real-time events.
import { bad, conflict, forbidden, notFound, HttpError, json, randomDigits, randomToken, sha256 } from './util.js';
import { priceCart, computeBill, syncBill, BILLABLE_STATUSES } from './pricing.js';

export const ACTIVE_ORDER_STATUSES = ['pending', 'accepted', 'preparing', 'ready'];

export function createServices({ db, hub, config }) {
  // ---------------------------------------------------------------- audit
  function audit({ company_id = null, branch_id = null, actor = null, actor_label = '', action, entity = '', entity_id = null, details = {}, ip = null }) {
    db.run(
      `INSERT INTO audit_logs (company_id, branch_id, actor_user_id, actor_label, action, entity, entity_id, details, ip)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      company_id, branch_id, actor?.id ?? null, actor_label || actor?.name || actor?.email || '', action, entity,
      entity_id, JSON.stringify(details), ip);
  }

  // ---------------------------------------------------------------- subscription state
  function refreshSubscription(company) {
    if (!company) return company;
    const now = new Date().toISOString();
    let status = company.subscription_status;
    if (status === 'trial' && company.trial_ends_at && company.trial_ends_at < now) status = 'expired';
    if (status === 'active' && company.current_period_end && company.current_period_end < now) status = 'expired';
    if (status !== company.subscription_status) {
      db.run('UPDATE companies SET subscription_status = ? WHERE id = ?', status, company.id);
      company = { ...company, subscription_status: status };
    }
    return company;
  }

  function operatingState(company) {
    company = refreshSubscription(company);
    if (company.status === 'suspended' || company.subscription_status === 'suspended') {
      return { ok: false, reason: 'This restaurant account is currently suspended.' };
    }
    if (company.subscription_status === 'expired') {
      return { ok: false, reason: 'Online ordering is temporarily unavailable at this restaurant.' };
    }
    return { ok: true };
  }

  function planFor(company) {
    return db.get('SELECT * FROM plans WHERE id = ?', company.plan_id)
      || { name: 'None', max_branches: 1, max_tables: 5, max_staff: 3 };
  }

  function assertPlanLimit(company, kind) {
    const plan = planFor(company);
    const counts = {
      branches: () => db.get('SELECT COUNT(*) n FROM branches WHERE company_id = ? AND active = 1', company.id).n,
      tables: () => db.get('SELECT COUNT(*) n FROM tables WHERE company_id = ? AND active = 1', company.id).n,
      staff: () => db.get(`SELECT COUNT(*) n FROM company_members WHERE company_id = ? AND status = 'active'`, company.id).n
        + db.get(`SELECT COUNT(*) n FROM invitations WHERE company_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
          company.id, new Date().toISOString()).n,
    };
    const limit = plan[`max_${kind}`];
    if (counts[kind]() >= limit) {
      throw new HttpError(402, `Your ${plan.name} plan allows up to ${limit} ${kind}. Upgrade your plan to add more.`);
    }
  }

  // ---------------------------------------------------------------- views
  const tableUrl = (t) => `${config.appUrl}/t/${t.qr_token}`;

  function orderView(o, { withItems = true } = {}) {
    const items = withItems
      ? db.all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', o.id).map((i) => ({ ...i, options: json(i.options, []) }))
      : undefined;
    const table = db.get('SELECT number FROM tables WHERE id = ?', o.table_id);
    return {
      id: o.id, order_no: o.order_no, status: o.status, table_id: o.table_id, table_number: table?.number,
      session_id: o.session_id, branch_id: o.branch_id, source: o.source, device_id: o.device_id,
      subtotal: o.subtotal, note: o.note, prep_minutes: o.prep_minutes, cancel_reason: o.cancel_reason,
      created_at: o.created_at, accepted_at: o.accepted_at, preparing_at: o.preparing_at, ready_at: o.ready_at,
      served_at: o.served_at, cancelled_at: o.cancelled_at, items,
    };
  }

  function tableView(t) {
    const s = t.current_session_id ? db.get('SELECT * FROM dining_sessions WHERE id = ?', t.current_session_id) : null;
    const counts = s ? db.get(
      `SELECT SUM(status='pending') pending, SUM(status IN ('accepted','preparing')) cooking, SUM(status='ready') ready
         FROM orders WHERE session_id = ?`, s.id) : null;
    const waiter = t.assigned_waiter_id ? db.get('SELECT id, name FROM users WHERE id = ?', t.assigned_waiter_id) : null;
    return {
      id: t.id, branch_id: t.branch_id, number: t.number, capacity: t.capacity, section: t.section, status: t.status,
      qr_token: t.qr_token, qr_url: tableUrl(t), active: t.active, assigned_waiter: waiter,
      session: s && s.status === 'open' ? {
        id: s.id, join_code: s.join_code, opened_at: s.opened_at, guest_count: s.guest_count,
        devices: db.get('SELECT COUNT(*) n FROM session_devices WHERE session_id = ?', s.id).n,
        pending: counts?.pending || 0, cooking: counts?.cooking || 0, ready: counts?.ready || 0,
      } : null,
    };
  }

  function emitTable(tableId) {
    const t = db.get('SELECT * FROM tables WHERE id = ?', tableId);
    if (t) hub.publish(`branch:${t.branch_id}`, 'table.updated', tableView(t));
  }

  function emitOrder(o, event = 'order.updated') {
    const v = orderView(o);
    hub.publish(`branch:${o.branch_id}`, event, v);
    hub.publish(`session:${o.session_id}`, event, v);
    emitTable(o.table_id);
  }

  function emitBill(sessionId) {
    const s = db.get('SELECT * FROM dining_sessions WHERE id = ?', sessionId);
    if (!s) return;
    const b = computeBill(db, sessionId);
    hub.publish(`session:${sessionId}`, 'bill.updated', b);
    hub.publish(`branch:${s.branch_id}`, 'bill.updated', { session_id: sessionId, table_id: s.table_id, total: b.total, outstanding: b.outstanding, status: b.status });
  }

  const emitMenu = (branchId, reason = 'menu') => hub.publish(`menu:${branchId}`, 'menu.updated', { reason });

  // ---------------------------------------------------------------- dining sessions
  function openSession({ table, actor = null, guestCount = null, ip = null }) {
    return db.tx(() => {
      const t = db.get('SELECT * FROM tables WHERE id = ?', table.id);
      if (!t.active) throw bad('This table is inactive');
      const existing = t.current_session_id && db.get(`SELECT * FROM dining_sessions WHERE id = ? AND status = 'open'`, t.current_session_id);
      if (existing) throw conflict(`Table ${t.number} already has an open session`);
      const code = randomDigits(4);
      const { lastId } = db.run(
        `INSERT INTO dining_sessions (company_id, branch_id, table_id, join_code, guest_count, opened_by) VALUES (?,?,?,?,?,?)`,
        t.company_id, t.branch_id, t.id, code, guestCount, actor?.id ?? null);
      db.run(`UPDATE tables SET status = 'occupied', current_session_id = ? WHERE id = ?`, lastId, t.id);
      audit({ company_id: t.company_id, branch_id: t.branch_id, actor, actor_label: actor ? '' : 'Customer (self-start)', action: 'session.open', entity: 'table', entity_id: t.id, details: { session_id: lastId, table: t.number }, ip });
      return db.get('SELECT * FROM dining_sessions WHERE id = ?', lastId);
    });
  }

  function addDevice(sessionId, via, { label = '', approvedBy = null } = {}) {
    const token = randomToken();
    db.run('INSERT INTO session_devices (session_id, token_hash, label, joined_via, approved_by) VALUES (?,?,?,?,?)',
      sessionId, sha256(token), String(label || '').slice(0, 40), via, approvedBy);
    return token;
  }

  function closeSession({ session, actor, force = false, reason = '', ip = null, canForce = false }) {
    const result = db.tx(() => {
      const s = db.get('SELECT * FROM dining_sessions WHERE id = ?', session.id);
      if (s.status !== 'open') throw conflict('This session is already closed');
      const active = db.get(`SELECT COUNT(*) n FROM orders WHERE session_id = ? AND status IN ('pending','accepted','preparing','ready')`, s.id).n;
      const bill = db.get('SELECT * FROM bills WHERE session_id = ?', s.id) ? syncBill(db, s.id) : computeBill(db, s.id);
      const blockers = [];
      if (active) blockers.push(`${active} order(s) are still in progress`);
      if (bill.outstanding > 0) blockers.push(`bill has an outstanding balance`);
      if (blockers.length) {
        if (!force) throw conflict(`Cannot close: ${blockers.join(' and ')}.`, { blockers, needs_force: true });
        if (!canForce) throw forbidden('Only a manager can force-close a session with unpaid bills or open orders');
        if (!reason || reason.trim().length < 3) throw bad('A reason is required to force-close a session');
        db.run(`UPDATE orders SET status='cancelled', cancel_reason=?, cancelled_by=?, cancelled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
                 WHERE session_id = ? AND status = 'pending'`, 'Session closed by manager', actor.id, s.id);
      }
      db.run(`UPDATE dining_sessions SET status='closed', closed_by=?, closed_at=datetime('now') WHERE id = ?`, actor.id, s.id);
      db.run(`UPDATE tables SET status='cleaning', current_session_id=NULL WHERE id = ? AND current_session_id = ?`, s.table_id, s.id);
      // Customer device tokens die with the session (already implied by status, made explicit here).
      db.run(`UPDATE session_devices SET token_hash = 'revoked-' || id || '-' || hex(randomblob(8)) WHERE session_id = ?`, s.id);
      db.run(`UPDATE service_requests SET status='done', handled_at=datetime('now') WHERE session_id = ? AND status='open'`, s.id);
      audit({ company_id: s.company_id, branch_id: s.branch_id, actor, action: force && blockers.length ? 'session.force_close' : 'session.close', entity: 'session', entity_id: s.id, details: { table_id: s.table_id, reason, blockers, outstanding: bill.outstanding }, ip });
      return s;
    });
    hub.terminate(`session:${result.id}`, 'session.closed', { message: 'This dining session has ended. Thank you for visiting!' });
    emitTable(result.table_id);
    return result;
  }

  // Resolve a customer device token into its open session. Closed sessions never resolve.
  function deviceFromToken(token, table) {
    if (!token || typeof token !== 'string') return null;
    const d = db.get(
      `SELECT d.*, s.status AS session_status, s.table_id FROM session_devices d
         JOIN dining_sessions s ON s.id = d.session_id WHERE d.token_hash = ?`, sha256(token));
    if (!d || d.session_status !== 'open') return null;
    if (table && d.table_id !== table.id) return null;
    return d;
  }

  // ---------------------------------------------------------------- orders
  function placeOrder({ session, lines, idempotencyKey, note = '', source, deviceId = null, actor = null, ip = null }) {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw bad('A valid idempotency key is required');
    }
    const out = db.tx(() => {
      const prior = db.get('SELECT * FROM orders WHERE session_id = ? AND idempotency_key = ?', session.id, idempotencyKey);
      if (prior) return { order: prior, duplicate: true };
      const s = db.get('SELECT * FROM dining_sessions WHERE id = ?', session.id);
      if (s.status !== 'open') throw new HttpError(410, 'This dining session has ended');
      const company = db.get('SELECT * FROM companies WHERE id = ?', s.company_id);
      const op = operatingState(company);
      if (!op.ok) throw conflict(op.reason);
      if (company.ordering_mode !== 'ordering') throw conflict('This restaurant is not accepting orders from the menu. Please ask your waiter.');
      const branch = db.get('SELECT * FROM branches WHERE id = ?', s.branch_id);
      if (source === 'customer' && branch.ordering_paused) {
        throw conflict(branch.pause_message || 'The kitchen is very busy and has paused new orders. Please try again shortly or call a waiter.', { paused: true });
      }
      const priced = priceCart(db, s.branch_id, lines);
      const subtotal = priced.reduce((sum, l) => sum + l.line_total, 0);
      db.run('UPDATE branches SET order_seq = order_seq + 1 WHERE id = ?', branch.id);
      const orderNo = db.get('SELECT order_seq FROM branches WHERE id = ?', branch.id).order_seq;
      const { lastId } = db.run(
        `INSERT INTO orders (company_id, branch_id, table_id, session_id, order_no, idempotency_key, source, device_id, placed_by, subtotal, note)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        s.company_id, s.branch_id, s.table_id, s.id, orderNo, idempotencyKey, source, deviceId, actor?.id ?? null, subtotal,
        String(note || '').trim().slice(0, 300));
      for (const l of priced) {
        db.run(
          `INSERT INTO order_items (order_id, menu_item_id, name, name_hi, diet, unit_price, options, qty, line_total, instructions)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          lastId, l.menu_item_id, l.name, l.name_hi, l.diet, l.unit_price, JSON.stringify(l.options), l.qty, l.line_total, l.instructions);
      }
      db.run(`UPDATE tables SET status = CASE WHEN status IN ('available','cleaning') THEN 'occupied' ELSE status END WHERE id = ?`, s.table_id);
      if (actor) audit({ company_id: s.company_id, branch_id: s.branch_id, actor, action: 'order.place_for_table', entity: 'order', entity_id: lastId, details: { order_no: orderNo }, ip });
      return { order: db.get('SELECT * FROM orders WHERE id = ?', lastId), duplicate: false };
    });
    if (!out.duplicate) emitOrder(out.order, 'order.new');
    return { order: orderView(out.order), duplicate: out.duplicate };
  }

  const TRANSITIONS = {
    accept: { from: ['pending'], to: 'accepted', perm: 'orders.kitchen', stamp: 'accepted_at' },
    reject: { from: ['pending'], to: 'cancelled', perm: 'orders.kitchen', stamp: 'cancelled_at', reason: true },
    preparing: { from: ['accepted'], to: 'preparing', perm: 'orders.kitchen', stamp: 'preparing_at' },
    ready: { from: ['accepted', 'preparing'], to: 'ready', perm: 'orders.kitchen', stamp: 'ready_at' },
    served: { from: ['ready', 'accepted', 'preparing'], to: 'served', perm: 'orders.serve', stamp: 'served_at' },
    cancel: { from: ['pending', 'accepted', 'preparing', 'ready'], to: 'cancelled', perm: 'orders.cancel', stamp: 'cancelled_at', reason: true },
  };

  function transitionOrder({ order, action, member, actor, reason = '', prepMinutes = null, ip = null }) {
    const tr = TRANSITIONS[action];
    if (!tr) throw bad('Unknown order action');
    // Waiters may cancel an order that the kitchen has not accepted yet (e.g. customer changed mind).
    const waiterPendingCancel = action === 'cancel' && order.status === 'pending' && member.perms.has('orders.serve');
    if (!member.perms.has(tr.perm) && !waiterPendingCancel) throw forbidden();
    const updated = db.tx(() => {
      const o = db.get('SELECT * FROM orders WHERE id = ?', order.id);
      if (!tr.from.includes(o.status)) throw conflict(`Order #${o.order_no} is ${o.status}; cannot ${action}`);
      const s = db.get('SELECT status FROM dining_sessions WHERE id = ?', o.session_id);
      if (s.status !== 'open' && action !== 'cancel') throw conflict('This dining session is closed');
      if (tr.reason && (!reason || reason.trim().length < 3)) throw bad('Please give a reason');
      if (o.status !== 'pending' && action === 'cancel' && BILLABLE_STATUSES.includes(o.status)) {
        const bill = db.get('SELECT * FROM bills WHERE session_id = ?', o.session_id);
        if (bill?.status === 'paid') throw conflict('This order is on a paid bill. Issue a refund instead.');
      }
      let prep = o.prep_minutes;
      if (action === 'accept') {
        const fromItems = db.get(
          `SELECT MAX(m.prep_minutes) p FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id WHERE oi.order_id = ?`, o.id).p;
        const branch = db.get('SELECT default_prep_minutes FROM branches WHERE id = ?', o.branch_id);
        prep = prepMinutes ?? fromItems ?? branch.default_prep_minutes;
        if (!Number.isInteger(prep) || prep < 1 || prep > 240) throw bad('Preparation time must be 1–240 minutes');
      }
      db.run(
        `UPDATE orders SET status = ?, ${tr.stamp} = strftime('%Y-%m-%dT%H:%M:%fZ','now'), prep_minutes = ?,
           cancel_reason = COALESCE(?, cancel_reason), cancelled_by = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_by END
         WHERE id = ?`,
        tr.to, prep, tr.reason ? reason.trim().slice(0, 200) : null, tr.to, actor.id, o.id);
      if (tr.to === 'cancelled') {
        audit({ company_id: o.company_id, branch_id: o.branch_id, actor, action: action === 'reject' ? 'order.reject' : 'order.cancel', entity: 'order', entity_id: o.id, details: { order_no: o.order_no, previous_status: o.status, reason }, ip });
      }
      if (db.get('SELECT id FROM bills WHERE session_id = ?', o.session_id)) syncBill(db, o.session_id);
      return db.get('SELECT * FROM orders WHERE id = ?', o.id);
    });
    emitOrder(updated);
    emitBill(updated.session_id);
    return orderView(updated);
  }

  function customerCancelOrder({ order, deviceId }) {
    const updated = db.tx(() => {
      const o = db.get('SELECT * FROM orders WHERE id = ?', order.id);
      if (o.status !== 'pending') throw conflict('The kitchen has already accepted this order. Please ask your waiter.');
      if (o.device_id !== deviceId) throw forbidden('Only the phone that placed this order can cancel it');
      db.run(`UPDATE orders SET status='cancelled', cancel_reason='Cancelled by customer', cancelled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, o.id);
      audit({ company_id: o.company_id, branch_id: o.branch_id, actor_label: 'Customer', action: 'order.cancel_by_customer', entity: 'order', entity_id: o.id, details: { order_no: o.order_no } });
      return db.get('SELECT * FROM orders WHERE id = ?', o.id);
    });
    emitOrder(updated);
    return orderView(updated);
  }

  // ---------------------------------------------------------------- service requests
  function serviceRequest({ session, type }) {
    if (!['waiter', 'water', 'bill'].includes(type)) throw bad('Unknown request');
    const out = db.tx(() => {
      const existing = db.get(`SELECT * FROM service_requests WHERE session_id = ? AND type = ? AND status = 'open'`, session.id, type);
      if (existing) return { req: existing, duplicate: true };
      const { lastId } = db.run(
        'INSERT INTO service_requests (company_id, branch_id, table_id, session_id, type) VALUES (?,?,?,?,?)',
        session.company_id, session.branch_id, session.table_id, session.id, type);
      if (type === 'bill') {
        ensureBill(session.id);
        db.run(`UPDATE tables SET status='bill_requested' WHERE id = ?`, session.table_id);
      }
      return { req: db.get('SELECT * FROM service_requests WHERE id = ?', lastId), duplicate: false };
    });
    const view = serviceView(out.req);
    if (!out.duplicate) hub.publish(`branch:${session.branch_id}`, 'service.new', view);
    hub.publish(`session:${session.id}`, 'service.updated', view);
    emitTable(session.table_id);
    if (type === 'bill') emitBill(session.id);
    return view;
  }

  function serviceView(r) {
    const t = db.get('SELECT number FROM tables WHERE id = ?', r.table_id);
    return { ...r, table_number: t?.number };
  }

  // ---------------------------------------------------------------- bills & payments
  function ensureBill(sessionId) {
    return db.tx(() => {
      let b = db.get('SELECT * FROM bills WHERE session_id = ?', sessionId);
      if (!b) {
        const s = db.get('SELECT * FROM dining_sessions WHERE id = ?', sessionId);
        db.run('UPDATE branches SET bill_seq = bill_seq + 1 WHERE id = ?', s.branch_id);
        const no = db.get('SELECT bill_seq FROM branches WHERE id = ?', s.branch_id).bill_seq;
        db.run('INSERT INTO bills (company_id, branch_id, session_id, table_id, bill_no) VALUES (?,?,?,?,?)',
          s.company_id, s.branch_id, s.id, s.table_id, no);
      }
      return syncBill(db, sessionId);
    });
  }

  // Single place where a payment becomes "paid" / "failed". Called only from cashier confirmation
  // or from cryptographically verified gateway notifications.
  function settlePayment(paymentId, { status, providerPaymentId = null, actor = null, via, reason = null, ip = null }) {
    const out = db.tx(() => {
      const p = db.get('SELECT * FROM payments WHERE id = ?', paymentId);
      if (!p) throw notFound('Payment');
      if (p.status === status) return { p, changed: false };
      if (p.status !== 'pending') {
        // A late "failed" must never downgrade a confirmed payment.
        return { p, changed: false };
      }
      db.run(
        `UPDATE payments SET status = ?, provider_payment_id = COALESCE(?, provider_payment_id), confirmed_by = ?,
            confirmed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), failure_reason = ? WHERE id = ?`,
        status, providerPaymentId, actor?.id ?? null, status === 'failed' ? (reason || 'Payment failed') : null, p.id);
      const bill = db.get('SELECT * FROM bills WHERE id = ?', p.bill_id);
      syncBill(db, bill.session_id);
      audit({ company_id: p.company_id, branch_id: p.branch_id, actor, actor_label: actor ? '' : `Gateway (${via})`, action: `payment.${status}`, entity: 'payment', entity_id: p.id, details: { method: p.method, amount: p.amount, via, reason }, ip });
      return { p: db.get('SELECT * FROM payments WHERE id = ?', p.id), bill, changed: true };
    });
    if (out.changed) {
      const bill = db.get('SELECT * FROM bills WHERE id = ?', out.p.bill_id);
      hub.publish(`branch:${out.p.branch_id}`, 'payment.updated', { id: out.p.id, status: out.p.status, bill_id: bill.id, table_id: bill.table_id });
      emitBill(bill.session_id);
      emitTable(bill.table_id);
    }
    return out.p;
  }

  return {
    audit, refreshSubscription, operatingState, planFor, assertPlanLimit, tableUrl, orderView, tableView, serviceView,
    emitTable, emitOrder, emitBill, emitMenu, openSession, addDevice, closeSession, deviceFromToken, placeOrder,
    transitionOrder, customerCancelOrder, serviceRequest, ensureBill, settlePayment,
  };
}
