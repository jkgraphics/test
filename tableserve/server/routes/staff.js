// Operational API for restaurant staff (kitchen, waiters, cashiers, managers, owners).
// Every handler resolves the record through auth.scoped / auth.assertBranch, which enforce the
// caller's company and assigned branches.
import { Router } from 'express';
import { h } from './common.js';
import { HttpError, bad, conflict, forbidden, notFound, json, str, int, num, oneOf, bool } from '../util.js';
import { computeBill, syncBill, computeDiscount } from '../pricing.js';
import { ROLE_LABELS } from '../auth.js';
import { renderReceipt } from '../receipt.js';

export default function staffRoutes({ db, hub, auth, services, gateway }) {
  const r = Router();
  r.use(auth.requireMember);
  const perm = auth.requirePerm;

  r.get('/context', h((req, res) => {
    const m = req.member;
    const company = services.refreshSubscription(req.company);
    const branches = db.all(`SELECT * FROM branches WHERE company_id = ? ORDER BY id`, m.company_id)
      .filter((b) => m.branch_ids.includes(b.id))
      .map((b) => ({ id: b.id, name: b.name, ordering_paused: !!b.ordering_paused, pause_message: b.pause_message, default_prep_minutes: b.default_prep_minutes, max_cashier_discount_pct: b.max_cashier_discount_pct, self_start_sessions: !!b.self_start_sessions, address: b.address, phone: b.phone, opening_hours: b.opening_hours, active: !!b.active }));
    const plan = services.planFor(company);
    res.json({
      user: req.user,
      role: m.role,
      role_label: ROLE_LABELS[m.role],
      perms: [...m.perms],
      company: {
        id: company.id, name: company.name, currency: company.currency, logo_url: company.logo_url, brand_color: company.brand_color,
        ordering_mode: company.ordering_mode, status: company.status, subscription_status: company.subscription_status,
        trial_ends_at: company.trial_ends_at, current_period_end: company.current_period_end, is_demo: !!company.is_demo,
        plan: { name: plan.name, max_branches: plan.max_branches, max_tables: plan.max_tables, max_staff: plan.max_staff },
      },
      operating: services.operatingState(company),
      branches,
      memberships: auth.membershipsFor(req.user.id),
    });
  }));

  // ---- real-time stream for one branch ------------------------------------------------------
  r.get('/branches/:bid/stream', h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    hub.subscribe(res, [`branch:${b.id}`, `menu:${b.id}`]);
  }));

  // ---- tables & sessions --------------------------------------------------------------------
  r.get('/branches/:bid/tables', perm('orders.view'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    const rows = db.all('SELECT * FROM tables WHERE branch_id = ? AND active = 1 ORDER BY CAST(number AS INTEGER), number', b.id);
    res.json({ tables: rows.map(services.tableView) });
  }));

  r.post('/tables/:id/open', perm('sessions.manage'), h((req, res) => {
    const t = auth.scoped(req.member, 'tables', req.params.id, 'Table');
    const op = services.operatingState(req.company);
    if (!op.ok) throw conflict(op.reason);
    const s = services.openSession({ table: t, actor: req.user, guestCount: int(req.body?.guest_count, 'Guests', { min: 1, max: 50 }), ip: req.ip });
    services.emitTable(t.id);
    res.status(201).json({ session: { id: s.id, join_code: s.join_code } });
  }));

  r.post('/tables/:id/close', perm('sessions.manage'), h((req, res) => {
    const t = auth.scoped(req.member, 'tables', req.params.id, 'Table');
    const s = t.current_session_id && db.get(`SELECT * FROM dining_sessions WHERE id = ? AND status = 'open'`, t.current_session_id);
    if (!s) throw conflict('This table has no open session');
    services.closeSession({ session: s, actor: req.user, force: bool(req.body?.force), reason: str(req.body?.reason, 'Reason', { max: 200 }), ip: req.ip, canForce: auth.can(req.member, 'orders.cancel') });
    res.json({ ok: true });
  }));

  r.post('/tables/:id/new-code', perm('sessions.manage'), h((req, res) => {
    const t = auth.scoped(req.member, 'tables', req.params.id, 'Table');
    const s = t.current_session_id && db.get(`SELECT * FROM dining_sessions WHERE id = ? AND status = 'open'`, t.current_session_id);
    if (!s) throw conflict('This table has no open session');
    const code = String(Math.floor(1000 + Math.random() * 9000));
    db.run('UPDATE dining_sessions SET join_code = ? WHERE id = ?', code, s.id);
    services.audit({ company_id: t.company_id, branch_id: t.branch_id, actor: req.user, action: 'session.new_code', entity: 'session', entity_id: s.id, ip: req.ip });
    services.emitTable(t.id);
    res.json({ join_code: code });
  }));

  r.post('/tables/:id/status', perm('sessions.manage'), h((req, res) => {
    const t = auth.scoped(req.member, 'tables', req.params.id, 'Table');
    const status = oneOf(req.body?.status, 'Status', ['available', 'cleaning']);
    if (t.current_session_id) throw conflict('Close the dining session first');
    db.run('UPDATE tables SET status = ? WHERE id = ?', status, t.id);
    services.emitTable(t.id);
    res.json({ ok: true });
  }));

  // ---- join approvals -----------------------------------------------------------------------
  r.get('/branches/:bid/join-requests', perm('sessions.manage'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    db.run(`UPDATE join_requests SET status='expired' WHERE branch_id = ? AND status='pending' AND created_at < datetime('now','-30 minutes')`, b.id);
    res.json({
      requests: db.all(`SELECT j.id, j.table_id, j.label, j.created_at, t.number AS table_number FROM join_requests j
        JOIN tables t ON t.id = j.table_id WHERE j.branch_id = ? AND j.status = 'pending' ORDER BY j.id`, b.id),
    });
  }));

  r.post('/join-requests/:id/:decision(approve|deny)', perm('sessions.manage'), h((req, res) => {
    const jr = auth.scoped(req.member, 'join_requests', req.params.id, 'Request');
    if (jr.status !== 'pending') throw conflict('This request was already handled');
    const approve = req.params.decision === 'approve';
    db.tx(() => {
      if (!approve) {
        db.run(`UPDATE join_requests SET status='denied', handled_by=? WHERE id = ?`, req.user.id, jr.id);
        return;
      }
      const t = db.get('SELECT * FROM tables WHERE id = ?', jr.table_id);
      let s = t.current_session_id && db.get(`SELECT * FROM dining_sessions WHERE id = ? AND status='open'`, t.current_session_id);
      if (!s) {
        const op = services.operatingState(req.company);
        if (!op.ok) throw conflict(op.reason);
        s = services.openSession({ table: t, actor: req.user, ip: req.ip });
      }
      const token = services.addDevice(s.id, 'staff', { label: jr.label, approvedBy: req.user.id });
      db.run(`UPDATE join_requests SET status='approved', session_id=?, device_token=?, handled_by=? WHERE id = ?`, s.id, token, req.user.id, jr.id);
    });
    hub.publish(`join:${jr.id}`, 'join.updated', { status: approve ? 'approved' : 'denied' });
    hub.publish(`branch:${jr.branch_id}`, 'join.updated', { id: jr.id, status: approve ? 'approved' : 'denied' });
    services.emitTable(jr.table_id);
    res.json({ ok: true });
  }));

  // ---- orders -------------------------------------------------------------------------------
  r.get('/branches/:bid/orders', perm('orders.view'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    const scope = req.query.scope === 'recent' ? 'recent' : 'active';
    const rows = scope === 'active'
      ? db.all(`SELECT * FROM orders WHERE branch_id = ? AND status IN ('pending','accepted','preparing','ready') ORDER BY id`, b.id)
      : db.all(`SELECT * FROM orders WHERE branch_id = ? AND created_at > ? ORDER BY id DESC LIMIT 200`, b.id, new Date(Date.now() - 864e5).toISOString());
    res.json({ orders: rows.map((o) => services.orderView(o)) });
  }));

  r.get('/orders/:id', perm('orders.view'), h((req, res) => {
    const o = auth.scoped(req.member, 'orders', req.params.id, 'Order');
    res.json({ order: services.orderView(o), branch: db.get('SELECT name FROM branches WHERE id = ?', o.branch_id) });
  }));

  r.post('/orders/:id/:action(accept|reject|preparing|ready|served|cancel)', h((req, res) => {
    const o = auth.scoped(req.member, 'orders', req.params.id, 'Order');
    const order = services.transitionOrder({
      order: o, action: req.params.action, member: req.member, actor: req.user,
      reason: str(req.body?.reason, 'Reason', { max: 200 }), prepMinutes: int(req.body?.prep_minutes, 'Preparation time', { min: 1, max: 240 }), ip: req.ip,
    });
    res.json({ order });
  }));

  // Waiter takes an order for a table (same validation and pricing as customer orders).
  r.post('/tables/:id/orders', perm('orders.place'), h((req, res) => {
    const t = auth.scoped(req.member, 'tables', req.params.id, 'Table');
    const s = t.current_session_id && db.get(`SELECT * FROM dining_sessions WHERE id = ? AND status = 'open'`, t.current_session_id);
    if (!s) throw conflict('Open a dining session for this table first');
    const out = services.placeOrder({ session: s, lines: req.body?.lines, idempotencyKey: req.body?.idempotency_key, note: req.body?.note, source: 'staff', actor: req.user, ip: req.ip });
    res.status(out.duplicate ? 200 : 201).json(out);
  }));

  r.post('/branches/:bid/pause', perm('branches.settings'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    const paused = bool(req.body?.paused);
    const message = str(req.body?.message, 'Message', { max: 200 });
    db.run('UPDATE branches SET ordering_paused = ?, pause_message = ? WHERE id = ?', paused ? 1 : 0, message, b.id);
    services.audit({ company_id: b.company_id, branch_id: b.id, actor: req.user, action: paused ? 'branch.pause_orders' : 'branch.resume_orders', entity: 'branch', entity_id: b.id, details: { message }, ip: req.ip });
    hub.publish(`menu:${b.id}`, 'branch.updated', { ordering_paused: paused, pause_message: message });
    hub.publish(`branch:${b.id}`, 'branch.updated', { ordering_paused: paused, pause_message: message });
    res.json({ ok: true });
  }));

  // Lightweight stock toggle usable by kitchen as well as managers.
  r.post('/menu-items/:id/stock', perm('orders.kitchen'), h((req, res) => {
    const item = auth.scoped(req.member, 'menu_items', req.params.id, 'Item');
    const inStock = bool(req.body?.in_stock);
    db.run(`UPDATE menu_items SET in_stock = ?, updated_at = datetime('now') WHERE id = ?`, inStock ? 1 : 0, item.id);
    services.emitMenu(item.branch_id, 'stock');
    res.json({ ok: true });
  }));

  r.get('/branches/:bid/menu', perm('orders.view'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    res.json({
      categories: db.all('SELECT * FROM categories WHERE branch_id = ? ORDER BY sort, id', b.id),
      items: db.all('SELECT * FROM menu_items WHERE branch_id = ? ORDER BY sort, id', b.id)
        .map((i) => ({ ...i, allergens: json(i.allergens, []), options: json(i.options, []), in_stock: !!i.in_stock, active: !!i.active, is_popular: !!i.is_popular, is_special: !!i.is_special, is_combo: !!i.is_combo })),
    });
  }));

  // ---- service requests ---------------------------------------------------------------------
  r.get('/branches/:bid/service-requests', perm('orders.view'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    res.json({ requests: db.all(`SELECT * FROM service_requests WHERE branch_id = ? AND status = 'open' ORDER BY id`, b.id).map(services.serviceView) });
  }));

  r.post('/service-requests/:id/done', perm('service.handle'), h((req, res) => {
    const sr = auth.scoped(req.member, 'service_requests', req.params.id, 'Request');
    db.run(`UPDATE service_requests SET status='done', handled_by=?, handled_at=datetime('now') WHERE id = ?`, req.user.id, sr.id);
    const v = services.serviceView(db.get('SELECT * FROM service_requests WHERE id = ?', sr.id));
    hub.publish(`branch:${sr.branch_id}`, 'service.updated', v);
    hub.publish(`session:${sr.session_id}`, 'service.updated', v);
    res.json({ ok: true });
  }));

  // ---- billing ------------------------------------------------------------------------------
  function openSessionFor(req) {
    const s = auth.scoped(req.member, 'dining_sessions', req.params.sid, 'Session');
    return s;
  }

  r.get('/branches/:bid/bills', perm('billing.view'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    const sessions = db.all(`SELECT s.*, t.number AS table_number, t.status AS table_status FROM dining_sessions s JOIN tables t ON t.id = s.table_id
      WHERE s.branch_id = ? AND s.status = 'open' ORDER BY CAST(t.number AS INTEGER), t.number`, b.id);
    const pendingUpi = db.all(`SELECT p.*, t.number AS table_number FROM payments p JOIN bills bl ON bl.id = p.bill_id JOIN tables t ON t.id = bl.table_id
      WHERE p.branch_id = ? AND p.status = 'pending' AND p.method = 'upi' ORDER BY p.id`, b.id);
    const recent = db.all(`SELECT bl.*, t.number AS table_number FROM bills bl JOIN tables t ON t.id = bl.table_id
      WHERE bl.branch_id = ? ORDER BY bl.id DESC LIMIT 30`, b.id);
    res.json({
      open: sessions.map((s) => {
        const bill = computeBill(db, s.id);
        return { session_id: s.id, table_id: s.table_id, table_number: s.table_number, table_status: s.table_status, opened_at: s.opened_at, bill_no: bill.bill_no, total: bill.total, paid: bill.paid, outstanding: bill.outstanding, pending_orders: bill.pending_orders, status: bill.status };
      }),
      pending_upi: pendingUpi,
      recent,
    });
  }));

  r.get('/sessions/:sid/bill', perm('billing.view'), h((req, res) => {
    const s = openSessionFor(req);
    const t = db.get('SELECT number FROM tables WHERE id = ?', s.table_id);
    res.json({ bill: computeBill(db, s.id), session: { id: s.id, status: s.status, table_number: t.number, opened_at: s.opened_at, closed_at: s.closed_at } });
  }));

  r.post('/sessions/:sid/bill', perm('billing.manage'), h((req, res) => {
    const s = openSessionFor(req);
    const bill = services.ensureBill(s.id);
    services.emitBill(s.id);
    res.json({ bill });
  }));

  r.get('/sessions/:sid/bill/print', perm('billing.view'), h((req, res) => {
    const s = openSessionFor(req);
    const bill = computeBill(db, s.id);
    const company = db.get('SELECT * FROM companies WHERE id = ?', s.company_id);
    res.type('html').send(renderReceipt({ company, branch: db.get('SELECT * FROM branches WHERE id = ?', s.branch_id), table: db.get('SELECT * FROM tables WHERE id = ?', s.table_id), bill, title: bill.status === 'paid' ? 'Receipt' : 'Bill' }));
  }));

  r.post('/sessions/:sid/discount', perm('billing.discount'), h((req, res) => {
    const s = openSessionFor(req);
    if (s.status !== 'open') throw conflict('Session is closed');
    const type = oneOf(req.body?.type, 'Discount type', ['percent', 'flat', 'none']);
    const reason = str(req.body?.reason, 'Reason', { max: 120, required: type !== 'none' });
    const branch = db.get('SELECT * FROM branches WHERE id = ?', s.branch_id);
    const out = db.tx(() => {
      services.ensureBill(s.id);
      const before = computeBill(db, s.id);
      if (before.status === 'paid') throw conflict('Bill is already paid');
      let value = 0;
      if (type === 'percent') value = num(req.body?.value, 'Discount %', { min: 0.01, max: 100, required: true });
      if (type === 'flat') value = Math.round(num(req.body?.value, 'Discount amount', { min: 0.01, required: true }) * 100);
      if (type !== 'none' && !auth.can(req.member, 'billing.discount_unlimited')) {
        const pct = before.subtotal ? (computeDiscount(before.subtotal, type, value) / before.subtotal) * 100 : 0;
        if (pct > branch.max_cashier_discount_pct + 1e-9) throw forbidden(`Cashiers can give at most ${branch.max_cashier_discount_pct}% discount. Ask a manager.`);
      }
      db.run('UPDATE bills SET discount_type = ?, discount_value = ?, discount_reason = ?, discount_by = ? WHERE session_id = ?',
        type === 'none' ? null : type, value, reason, req.user.id, s.id);
      const after = syncBill(db, s.id);
      services.audit({ company_id: s.company_id, branch_id: s.branch_id, actor: req.user, action: type === 'none' ? 'bill.discount_removed' : 'bill.discount', entity: 'bill', entity_id: after.bill_id, details: { type, value, reason, amount: after.discount, previous: before.discount }, ip: req.ip });
      return after;
    });
    services.emitBill(s.id);
    res.json({ bill: out });
  }));

  // Cashier records a payment received at the counter. Recording it IS the cashier confirmation.
  r.post('/sessions/:sid/payments', perm('billing.manage'), h((req, res) => {
    const s = openSessionFor(req);
    const method = oneOf(req.body?.method, 'Method', ['cash', 'upi', 'card']);
    const reference = str(req.body?.reference, 'Reference', { max: 60, required: method === 'upi' });
    const out = db.tx(() => {
      services.ensureBill(s.id);
      const b = computeBill(db, s.id);
      if (b.pending_orders) throw conflict('Accept or cancel pending orders before taking payment');
      if (b.outstanding <= 0) throw conflict('Nothing outstanding on this bill');
      const amount = req.body?.amount == null || req.body.amount === '' ? b.outstanding : Math.round(num(req.body.amount, 'Amount', { min: 0.01 }) * 100);
      if (amount > b.outstanding) throw bad('Amount is more than the outstanding balance');
      const id = db.run(
        `INSERT INTO payments (company_id, branch_id, bill_id, method, amount, status, reference, initiated_by, recorded_by)
         VALUES (?,?,?,?,?,'pending',?,'staff',?)`, s.company_id, s.branch_id, b.bill_id, method, amount, reference, req.user.id).lastId;
      return id;
    });
    const p = services.settlePayment(out, { status: 'paid', actor: req.user, via: 'cashier', ip: req.ip });
    res.status(201).json({ payment: p, bill: computeBill(db, s.id) });
  }));

  // Customer-reported UPI payment → cashier confirms after checking the bank/UPI app.
  r.post('/payments/:id/:decision(confirm|reject)', perm('billing.manage'), h((req, res) => {
    const p = auth.scoped(req.member, 'payments', req.params.id, 'Payment');
    if (p.status !== 'pending') throw conflict(`Payment is already ${p.status}`);
    if (p.method === 'online') throw forbidden('Online payments are confirmed only by the payment gateway');
    const confirm = req.params.decision === 'confirm';
    const out = services.settlePayment(p.id, { status: confirm ? 'paid' : 'failed', actor: req.user, via: 'cashier', reason: confirm ? null : str(req.body?.reason, 'Reason', { max: 120 }) || 'Not received', ip: req.ip });
    res.json({ payment: out });
  }));

  r.post('/payments/:id/refund', perm('billing.refund'), h(async (req, res) => {
    const p = auth.scoped(req.member, 'payments', req.params.id, 'Payment');
    if (!['paid', 'refunded'].includes(p.status)) throw conflict('Only paid payments can be refunded');
    const remaining = p.amount - p.refunded_amount;
    const amount = req.body?.amount == null || req.body.amount === '' ? remaining : Math.round(num(req.body.amount, 'Amount', { min: 0.01 }) * 100);
    const reason = str(req.body?.reason, 'Reason', { required: true, min: 3, max: 200 });
    if (amount > remaining) throw bad('Refund is more than the amount left on this payment');
    const company = db.get('SELECT * FROM companies WHERE id = ?', p.company_id);
    const result = await gateway.refund(company, p, amount);
    db.tx(() => {
      db.run(`INSERT INTO refunds (company_id, payment_id, amount, reason, status, provider_refund_id, created_by) VALUES (?,?,?,?,?,?,?)`,
        p.company_id, p.id, amount, reason, result.status, result.id, req.user.id);
      const newRefunded = p.refunded_amount + amount;
      db.run(`UPDATE payments SET refunded_amount = ?, status = CASE WHEN ? >= amount THEN 'refunded' ELSE status END WHERE id = ?`, newRefunded, newRefunded, p.id);
      const bill = db.get('SELECT * FROM bills WHERE id = ?', p.bill_id);
      syncBill(db, bill.session_id);
      services.audit({ company_id: p.company_id, branch_id: p.branch_id, actor: req.user, action: 'payment.refund', entity: 'payment', entity_id: p.id, details: { amount, reason, method: p.method, provider_refund_id: result.id }, ip: req.ip });
    });
    const bill = db.get('SELECT * FROM bills WHERE id = ?', p.bill_id);
    services.emitBill(bill.session_id);
    res.json({ payment: db.get('SELECT * FROM payments WHERE id = ?', p.id), refunds: db.all('SELECT * FROM refunds WHERE payment_id = ? ORDER BY id', p.id) });
  }));

  r.get('/payments/:id/refunds', perm('billing.view'), h((req, res) => {
    const p = auth.scoped(req.member, 'payments', req.params.id, 'Payment');
    res.json({ refunds: db.all(`SELECT r.*, u.name AS by_name FROM refunds r JOIN users u ON u.id = r.created_by WHERE payment_id = ? ORDER BY r.id`, p.id) });
  }));

  r.get('/bills/:id', perm('billing.view'), h((req, res) => {
    const b = auth.scoped(req.member, 'bills', req.params.id, 'Bill');
    const s = db.get('SELECT * FROM dining_sessions WHERE id = ?', b.session_id);
    const t = db.get('SELECT number FROM tables WHERE id = ?', b.table_id);
    res.json({ bill: computeBill(db, b.session_id), session: { id: s.id, status: s.status, table_number: t.number, opened_at: s.opened_at, closed_at: s.closed_at } });
  }));

  return r;
}
