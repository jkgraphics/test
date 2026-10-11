// Customer-facing API, reached by scanning a table QR code. Browsing needs no account; ordering,
// viewing orders/bill and paying require a device token bound to the table's *current* session.
import { Router } from 'express';
import QRCode from 'qrcode';
import { h, rateLimiter } from './common.js';
import { HttpError, bad, conflict, notFound, json, str, randomToken, sha256, safeEqual } from '../util.js';
import { computeBill } from '../pricing.js';
import { renderReceipt } from '../receipt.js';

export default function publicRoutes({ db, hub, services, gateway, config }) {
  const r = Router();
  const joinLimiter = rateLimiter({ windowMs: 60e3, max: 20 });
  const requestLimiter = rateLimiter({ windowMs: 10 * 60e3, max: 5 });
  const CODE_WINDOW_MIN = 10;
  const CODE_MAX_FAILS = 5;

  function loadTable(qr) {
    const t = db.get('SELECT * FROM tables WHERE qr_token = ? AND active = 1', String(qr));
    if (!t) throw notFound('Table');
    const branch = db.get('SELECT * FROM branches WHERE id = ? AND active = 1', t.branch_id);
    if (!branch) throw notFound('Table');
    const company = services.refreshSubscription(db.get('SELECT * FROM companies WHERE id = ?', t.company_id));
    return { table: t, branch, company };
  }

  // Middleware: requires a device token for the table's current open session.
  function guest(req, _res, next) {
    try {
      const ctx = loadTable(req.params.qr);
      const token = req.get('x-guest-token') || req.query.token;
      const device = services.deviceFromToken(token, ctx.table);
      if (!device) throw new HttpError(401, 'Your table session has ended or this phone has not joined it yet.', { code: 'NO_SESSION' });
      const session = db.get('SELECT * FROM dining_sessions WHERE id = ?', device.session_id);
      Object.assign(req, ctx, { device, session });
      next();
    } catch (e) { next(e); }
  }

  function paymentOptions(company) {
    const ps = json(company.payment_settings, {});
    const gw = gateway.companyGateway(company);
    return {
      cash: ps.cash !== false,
      pay_at_counter: ps.pay_at_counter !== false,
      upi: !!(ps.upi && ps.upi_vpa),
      upi_vpa: ps.upi ? ps.upi_vpa || '' : '',
      upi_payee: ps.upi ? ps.upi_payee || company.name : '',
      online: !!gw,
      online_mode: gw?.mode || null,
      online_provider: gw?.provider || null,
    };
  }

  r.get('/t/:qr', h((req, res) => {
    const { table, branch, company } = loadTable(req.params.qr);
    const op = services.operatingState(company);
    const token = req.get('x-guest-token');
    const device = token ? services.deviceFromToken(token, table) : null;
    const hasOpenSession = !!(table.current_session_id && db.get(`SELECT id FROM dining_sessions WHERE id = ? AND status='open'`, table.current_session_id));
    res.json({
      company: {
        name: company.name, logo_url: company.logo_url, description: company.description, phone: company.phone,
        address: company.address, opening_hours: company.opening_hours, brand_color: company.brand_color,
        currency: company.currency, languages: json(company.languages, ['en']), ordering_mode: company.ordering_mode,
        taxes: json(company.taxes, []), service_charge_pct: company.service_charge_pct,
      },
      branch: { id: branch.id, name: branch.name, address: branch.address, phone: branch.phone, opening_hours: branch.opening_hours, ordering_paused: !!branch.ordering_paused, pause_message: branch.pause_message, self_start_sessions: !!branch.self_start_sessions },
      table: { number: table.number, section: table.section, status: table.status, has_open_session: hasOpenSession },
      ordering: { allowed: op.ok && company.ordering_mode === 'ordering', reason: op.ok ? null : op.reason },
      payments: paymentOptions(company),
      joined: !!device,
    });
  }));

  r.get('/t/:qr/menu', h((req, res) => {
    const { branch } = loadTable(req.params.qr);
    const categories = db.all('SELECT id, name, name_hi, sort FROM categories WHERE branch_id = ? AND active = 1 ORDER BY sort, id', branch.id);
    const items = db.all(
      `SELECT id, category_id, name, name_hi, description, description_hi, price, image_url, portion_size, diet,
              ingredients, allergens, spice_level, taste_notes, options, is_popular, is_special, is_combo, combo_details,
              prep_minutes, in_stock, updated_at
         FROM menu_items WHERE branch_id = ? AND active = 1 ORDER BY sort, id`, branch.id)
      .map((i) => ({ ...i, allergens: json(i.allergens, []), options: json(i.options, []), in_stock: !!i.in_stock, is_popular: !!i.is_popular, is_special: !!i.is_special, is_combo: !!i.is_combo }));
    res.set('Cache-Control', 'no-store');
    res.json({ categories, items, ordering_paused: !!branch.ordering_paused });
  }));

  // ---- joining a table session -----------------------------------------------------------
  r.post('/t/:qr/join', h((req, res) => {
    const { table } = loadTable(req.params.qr);
    if (!joinLimiter.hit(req.ip)) throw new HttpError(429, 'Too many attempts. Please wait a minute.');
    const since = new Date(Date.now() - CODE_WINDOW_MIN * 60e3).toISOString().replace('T', ' ').slice(0, 19);
    const fails = db.get('SELECT COUNT(*) n FROM code_attempts WHERE table_id = ? AND ip = ? AND created_at > ?', table.id, req.ip, since).n;
    if (fails >= CODE_MAX_FAILS) throw new HttpError(429, 'Too many incorrect codes. Please ask your waiter to add this phone.');
    const session = table.current_session_id && db.get(`SELECT * FROM dining_sessions WHERE id = ? AND status = 'open'`, table.current_session_id);
    if (!session) throw conflict('This table does not have an active session yet. Ask staff to start one.', { code: 'NO_OPEN_SESSION' });
    const code = String(req.body?.code || '').replace(/\D/g, '');
    if (!safeEqual(code, session.join_code)) {
      db.run('INSERT INTO code_attempts (table_id, ip) VALUES (?,?)', table.id, req.ip);
      throw bad(`Incorrect table code. ${CODE_MAX_FAILS - fails - 1} attempt(s) left.`);
    }
    const token = services.addDevice(session.id, 'code', { label: str(req.body?.label, 'Name', { max: 40 }) });
    services.emitTable(table.id);
    res.json({ token });
  }));

  // First guest at an idle table may start the session themselves when the branch allows it.
  r.post('/t/:qr/start', h((req, res) => {
    const { table, branch, company } = loadTable(req.params.qr);
    if (!branch.self_start_sessions) throw new HttpError(403, 'Please ask staff to start your table session.');
    const op = services.operatingState(company);
    if (!op.ok) throw conflict(op.reason);
    if (!joinLimiter.hit(req.ip)) throw new HttpError(429, 'Too many attempts. Please wait a minute.');
    if (table.status === 'cleaning') throw conflict('This table is being prepared. Please wait for staff.');
    const session = services.openSession({ table, ip: req.ip });
    const token = services.addDevice(session.id, 'self_start', { label: str(req.body?.label, 'Name', { max: 40 }) });
    services.emitTable(table.id);
    // The code lets the rest of the party join from their own phones.
    res.status(201).json({ token, join_code: session.join_code });
  }));

  // Ask staff to approve this phone (no code needed).
  r.post('/t/:qr/join-request', h((req, res) => {
    const { table } = loadTable(req.params.qr);
    if (!requestLimiter.hit(`${req.ip}|${table.id}`)) throw new HttpError(429, 'You have sent several requests. Please wait for staff.');
    const poll = randomToken();
    const id = db.run(
      'INSERT INTO join_requests (company_id, branch_id, table_id, poll_token_hash, label) VALUES (?,?,?,?,?)',
      table.company_id, table.branch_id, table.id, sha256(poll), str(req.body?.label, 'Name', { max: 40 })).lastId;
    const jr = db.get('SELECT j.*, t.number AS table_number FROM join_requests j JOIN tables t ON t.id = j.table_id WHERE j.id = ?', id);
    hub.publish(`branch:${table.branch_id}`, 'join.new', { id, table_id: table.id, table_number: jr.table_number, label: jr.label, created_at: jr.created_at });
    res.status(201).json({ request_id: id, poll_token: poll });
  }));

  function loadJoinRequest(req) {
    const jr = db.get('SELECT * FROM join_requests WHERE id = ?', Number(req.params.id));
    const poll = String(req.query.poll || req.body?.poll || '');
    if (!jr || !safeEqual(sha256(poll), jr.poll_token_hash)) throw notFound('Request');
    return jr;
  }

  r.get('/join-requests/:id', h((req, res) => {
    const jr = loadJoinRequest(req);
    if (jr.status === 'approved' && jr.device_token) {
      // Hand the device token over exactly once.
      db.run('UPDATE join_requests SET device_token = NULL WHERE id = ?', jr.id);
      return res.json({ status: 'approved', token: jr.device_token });
    }
    res.json({ status: jr.status === 'approved' ? 'collected' : jr.status });
  }));

  r.get('/join-requests/:id/stream', h((req, res) => {
    const jr = loadJoinRequest(req);
    hub.subscribe(res, [`join:${jr.id}`]);
  }));

  // ---- session-scoped ----------------------------------------------------------------------
  r.get('/t/:qr/session', guest, h((req, res) => {
    const orders = db.all('SELECT * FROM orders WHERE session_id = ? ORDER BY id DESC', req.session.id).map((o) => services.orderView(o));
    const service = db.all(`SELECT * FROM service_requests WHERE session_id = ? AND status = 'open'`, req.session.id);
    res.json({
      session: { id: req.session.id, opened_at: req.session.opened_at, join_code: req.session.join_code },
      device_id: req.device.id,
      orders,
      service_requests: service,
      bill: computeBill(db, req.session.id),
    });
  }));

  r.get('/t/:qr/stream', h((req, res) => {
    const { table, branch } = loadTable(req.params.qr);
    const channels = [`menu:${branch.id}`];
    const device = services.deviceFromToken(req.query.token, table);
    if (device) channels.push(`session:${device.session_id}`);
    else if (req.query.token) {
      // Tell the phone its session is gone so it drops cached orders/bill.
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.end(`event: session.closed\ndata: ${JSON.stringify({ message: 'This dining session has ended.' })}\n\n`);
      return;
    }
    hub.subscribe(res, channels);
  }));

  r.post('/t/:qr/orders', guest, h((req, res) => {
    const out = services.placeOrder({
      session: req.session, lines: req.body?.lines, idempotencyKey: req.body?.idempotency_key,
      note: req.body?.note, source: 'customer', deviceId: req.device.id, ip: req.ip,
    });
    res.status(out.duplicate ? 200 : 201).json(out);
  }));

  r.post('/t/:qr/orders/:id/cancel', guest, h((req, res) => {
    const o = db.get('SELECT * FROM orders WHERE id = ? AND session_id = ?', Number(req.params.id), req.session.id);
    if (!o) throw notFound('Order');
    res.json({ order: services.customerCancelOrder({ order: o, deviceId: req.device.id }) });
  }));

  r.post('/t/:qr/service', guest, h((req, res) => {
    res.status(201).json({ request: services.serviceRequest({ session: req.session, type: req.body?.type }) });
  }));

  r.get('/t/:qr/bill', guest, h((req, res) => {
    res.json({ bill: computeBill(db, req.session.id) });
  }));

  // Customer says "I paid by UPI". This only creates a PENDING payment; a cashier must verify the
  // money arrived and confirm it. Screenshots are deliberately not accepted as proof.
  r.post('/t/:qr/pay/upi', guest, h((req, res) => {
    const opts = paymentOptions(req.company);
    if (!opts.upi) throw conflict('UPI payment is not enabled here');
    const reference = str(req.body?.reference, 'UPI transaction reference (UTR)', { required: true, min: 6, max: 40 });
    const out = db.tx(() => {
      services.ensureBill(req.session.id);
      const b = computeBill(db, req.session.id);
      if (b.pending_orders) throw conflict('Some orders are still waiting for the kitchen to accept them.');
      if (b.outstanding <= 0) throw conflict('Nothing to pay on this bill.');
      const dup = db.get(`SELECT * FROM payments WHERE bill_id = ? AND method = 'upi' AND status = 'pending'`, b.bill_id);
      if (dup) return dup;
      const id = db.run(
        `INSERT INTO payments (company_id, branch_id, bill_id, method, amount, status, reference, initiated_by)
         VALUES (?,?,?,'upi',?,'pending',?,'customer')`,
        req.company.id, req.branch.id, b.bill_id, b.outstanding, reference).lastId;
      return db.get('SELECT * FROM payments WHERE id = ?', id);
    });
    hub.publish(`branch:${req.branch.id}`, 'payment.updated', { id: out.id, status: out.status, method: 'upi', table_id: req.table.id, needs_confirmation: true });
    services.emitBill(req.session.id);
    res.status(201).json({ payment: { id: out.id, status: out.status, amount: out.amount }, message: 'Waiting for the cashier to confirm your UPI payment.' });
  }));

  r.get('/t/:qr/upi-qr.svg', guest, h(async (req, res) => {
    const opts = paymentOptions(req.company);
    if (!opts.upi) throw notFound('UPI');
    const b = computeBill(db, req.session.id);
    const params = new URLSearchParams({ pa: opts.upi_vpa, pn: opts.upi_payee, am: (b.outstanding / 100).toFixed(2), cu: req.company.currency, tn: `Bill ${b.bill_no || ''} Table ${req.table.number}` });
    const svg = await QRCode.toString(`upi://pay?${params}`, { type: 'svg', margin: 1, width: 240 });
    res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
  }));

  r.post('/t/:qr/pay/online', guest, h(async (req, res) => {
    const prepared = db.tx(() => {
      services.ensureBill(req.session.id);
      const b = computeBill(db, req.session.id);
      if (b.pending_orders) throw conflict('Some orders are still waiting for the kitchen to accept them.');
      if (b.outstanding <= 0) throw conflict('Nothing to pay on this bill.');
      // Reuse an in-flight checkout for the same amount (double taps, page refresh).
      const existing = db.get(
        `SELECT * FROM payments WHERE bill_id = ? AND method = 'online' AND status = 'pending' AND amount = ? ORDER BY id DESC`, b.bill_id, b.outstanding);
      if (existing) return { payment: existing, reuse: true, billNo: b.bill_no };
      const id = db.run(
        `INSERT INTO payments (company_id, branch_id, bill_id, method, amount, status, initiated_by)
         VALUES (?,?,?,'online',?,'pending','customer')`, req.company.id, req.branch.id, b.bill_id, b.outstanding).lastId;
      return { payment: db.get('SELECT * FROM payments WHERE id = ?', id), reuse: false, billNo: b.bill_no };
    });
    let p = prepared.payment;
    if (!p.provider_order_id) {
      let gw;
      try {
        gw = await gateway.createOrder(req.company, p, prepared.billNo);
      } catch (e) {
        db.run(`UPDATE payments SET status='failed', failure_reason=? WHERE id = ? AND status='pending'`, String(e.message).slice(0, 200), p.id);
        throw e;
      }
      db.run('UPDATE payments SET provider = ?, provider_mode = ?, provider_order_id = ? WHERE id = ?', gw.provider, gw.mode, gw.orderId, p.id);
      p = db.get('SELECT * FROM payments WHERE id = ?', p.id);
    }
    const back = encodeURIComponent(`/t/${req.table.qr_token}`);
    const checkoutUrl = p.provider === 'test'
      ? `/pay/test/${p.provider_order_id}?back=${back}`
      : `/pay/razorpay/${p.id}?qr=${encodeURIComponent(req.table.qr_token)}`;
    services.emitBill(req.session.id);
    res.status(201).json({ payment: { id: p.id, status: p.status, amount: p.amount, mode: p.provider_mode }, checkout_url: checkoutUrl });
  }));

  r.get('/t/:qr/receipt', guest, h((req, res) => {
    const b = computeBill(db, req.session.id);
    if (!b.bill_id || b.status !== 'paid') throw conflict('A receipt is available once the bill is fully paid');
    const html = renderReceipt({ company: req.company, branch: req.branch, table: req.table, bill: b });
    if (req.query.download) res.set('Content-Disposition', `attachment; filename="receipt-${b.bill_no}.html"`);
    res.type('html').send(html);
  }));

  return r;
}
