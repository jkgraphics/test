// Gateway-facing routes: simulated test gateway, Razorpay checkout page, and signed webhooks.
// Payment status changes ONLY inside services.settlePayment, which is reached exclusively from
// (a) a cashier confirming a manual payment, or (b) the verified notifications below.
import { Router } from 'express';
import { h } from './common.js';
import { HttpError, notFound, json, safeEqual } from '../util.js';
import { esc, money } from '../receipt.js';

export default function paymentRoutes({ db, services, gateway, config }) {
  const r = Router();

  // Shared verified-webhook processor (idempotent on event id).
  function processEvent(provider, eventId, rawBody, handle) {
    const seen = db.get('SELECT id FROM webhook_events WHERE provider = ? AND event_id = ?', provider, eventId);
    if (seen) return { duplicate: true };
    db.run('INSERT INTO webhook_events (provider, event_id, verified, payload) VALUES (?,?,1,?)', provider, eventId, rawBody.slice(0, 20000));
    return handle();
  }

  function handleTestWebhook(rawBody, signature, ip) {
    if (!gateway.verifyTestWebhook(rawBody, signature)) {
      db.run('INSERT OR IGNORE INTO webhook_events (provider, event_id, verified, payload) VALUES (?,?,0,?)', 'test', `unverified-${Date.now()}-${Math.random()}`, rawBody.slice(0, 2000));
      throw new HttpError(401, 'Invalid webhook signature');
    }
    const evt = json(rawBody, null);
    if (!evt?.id || !evt?.data?.order_id) throw new HttpError(400, 'Malformed event');
    return processEvent('test', evt.id, rawBody, () => {
      const p = db.get(`SELECT * FROM payments WHERE provider = 'test' AND provider_order_id = ?`, evt.data.order_id);
      if (!p) return { ignored: true };
      const status = evt.type === 'payment.succeeded' ? 'paid' : evt.type === 'payment.failed' ? 'failed' : null;
      if (!status) return { ignored: true };
      return { payment: services.settlePayment(p.id, { status, providerPaymentId: evt.data.payment_id, via: 'test-gateway webhook', reason: evt.data.reason, ip }) };
    });
  }

  r.post('/api/webhooks/test', h((req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const out = handleTestWebhook(raw, req.get('x-test-signature'), req.ip);
    res.json({ ok: true, ...(out.duplicate ? { duplicate: true } : {}) });
  }));

  // ---- Simulated gateway hosted checkout (clearly labelled TEST MODE) ----------------------
  function testPayment(orderId) {
    const p = db.get(`SELECT * FROM payments WHERE provider = 'test' AND provider_order_id = ?`, String(orderId));
    if (!p) throw notFound('Payment');
    return p;
  }

  const safeBack = (b) => (typeof b === 'string' && /^\/t\/[\w-]+$/.test(b) ? b : '/');

  r.get('/pay/test/:orderId', h((req, res) => {
    if (!config.allowTestPayments) throw notFound('Payment');
    const p = testPayment(req.params.orderId);
    const company = db.get('SELECT * FROM companies WHERE id = ?', p.company_id);
    const back = safeBack(req.query.back);
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test payment</title><style>
body{font-family:system-ui,sans-serif;background:#f4f1ec;margin:0;padding:24px;color:#222}
.card{max-width:380px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 24px #0001}
.banner{background:#fff3bf;border:2px dashed #e67700;color:#a14a00;padding:10px;border-radius:10px;font-weight:700;text-align:center}
.amt{font-size:32px;font-weight:800;margin:16px 0}button{width:100%;padding:16px;font-size:17px;border:0;border-radius:12px;margin-top:10px;cursor:pointer}
.ok{background:#2b8a3e;color:#fff}.no{background:#eee}</style></head><body><div class="card">
<div class="banner">TEST MODE — simulated payment gateway<br><small>No real money moves. For demos and development only.</small></div>
<p>Paying <b>${esc(company.name)}</b></p><div class="amt">${money(p.amount, company.currency)}</div>
${p.status !== 'pending' ? `<p>This payment is already <b>${esc(p.status)}</b>.</p><a href="${esc(back)}">Back to the menu</a>` : `
<form method="post" action="/pay/test/${esc(p.provider_order_id)}/complete?back=${encodeURIComponent(back)}">
<button class="ok" name="outcome" value="success">Simulate successful payment</button>
<button class="no" name="outcome" value="failure">Simulate failed payment</button></form>`}
</div></body></html>`);
  }));

  // The simulated *gateway* (not the restaurant app) sends a signed webhook, exactly as a real
  // provider would. The restaurant side then verifies the signature before changing anything.
  r.post('/pay/test/:orderId/complete', h(async (req, res) => {
    if (!config.allowTestPayments) throw notFound('Payment');
    const p = testPayment(req.params.orderId);
    const outcome = req.body?.outcome === 'success' ? 'success' : 'failure';
    const { body, signature } = gateway.testWebhook(p.provider_order_id, outcome);
    const result = await fetch(`http://127.0.0.1:${req.socket.localPort}/api/webhooks/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Signature': signature }, body,
    }).catch(() => null);
    if (!result?.ok) throw new HttpError(502, 'The test gateway could not deliver its notification');
    res.redirect(303, `${safeBack(req.query.back)}?payment=${p.id}`);
  }));

  // ---- Razorpay ---------------------------------------------------------------------------
  r.get('/pay/razorpay/:paymentId', h((req, res) => {
    const p = db.get(`SELECT * FROM payments WHERE id = ? AND provider = 'razorpay'`, Number(req.params.paymentId));
    if (!p) throw notFound('Payment');
    const table = db.get('SELECT t.* FROM tables t JOIN bills b ON b.table_id = t.id WHERE b.id = ?', p.bill_id);
    if (!table || !safeEqual(String(req.query.qr || ''), table.qr_token)) throw notFound('Payment');
    const company = db.get('SELECT * FROM companies WHERE id = ?', p.company_id);
    const gw = gateway.companyGateway(company);
    if (!gw || gw.provider !== 'razorpay') throw notFound('Payment');
    const back = `/t/${table.qr_token}`;
    const opts = { key: gw.keyId, amount: p.amount, currency: company.currency, name: company.name, order_id: p.provider_order_id, description: `Table ${table.number}` };
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pay ${esc(company.name)}</title></head>
<body style="font-family:system-ui;padding:24px;text-align:center">${gw.mode === 'test' ? '<p style="background:#fff3bf;padding:8px;border-radius:8px"><b>Razorpay TEST keys</b> – no real money moves.</p>' : ''}
<p>Opening secure payment…</p><p><a href="${esc(back)}">Back to the menu</a></p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
const opts = ${JSON.stringify(opts).replace(/</g, '\\u003c')};
opts.handler = async (r) => {
  // The server re-verifies this signature; the browser's word alone never marks a bill paid.
  await fetch('/api/public/payments/${p.id}/razorpay-verify', {method:'POST', headers:{'Content-Type':'application/json','X-Requested-With':'TableServe'}, body: JSON.stringify(r)});
  location.href = ${JSON.stringify(back)} + '?payment=${p.id}';
};
opts.modal = { ondismiss: () => { location.href = ${JSON.stringify(back)}; } };
new Razorpay(opts).open();
</script></body></html>`);
  }));

  r.post('/api/public/payments/:id/razorpay-verify', h((req, res) => {
    const p = db.get(`SELECT * FROM payments WHERE id = ? AND provider = 'razorpay'`, Number(req.params.id));
    if (!p) throw notFound('Payment');
    const company = db.get('SELECT * FROM companies WHERE id = ?', p.company_id);
    const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = req.body || {};
    if (oid !== p.provider_order_id || !gateway.verifyRazorpayCheckout(company, oid, pid, sig)) {
      throw new HttpError(400, 'Payment could not be verified');
    }
    const out = services.settlePayment(p.id, { status: 'paid', providerPaymentId: pid, via: 'razorpay checkout signature', ip: req.ip });
    res.json({ status: out.status });
  }));

  r.post('/api/webhooks/razorpay/:companyId', h((req, res) => {
    const company = db.get('SELECT * FROM companies WHERE id = ?', Number(req.params.companyId));
    if (!company) throw notFound('Company');
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    if (!gateway.verifyRazorpayWebhook(company, raw, req.get('x-razorpay-signature'))) throw new HttpError(401, 'Invalid webhook signature');
    const evt = json(raw, {});
    const eventId = req.get('x-razorpay-event-id') || `${evt.event}-${evt.payload?.payment?.entity?.id}`;
    processEvent('razorpay', eventId, raw, () => {
      const ent = evt.payload?.payment?.entity;
      if (!ent?.order_id) return { ignored: true };
      const p = db.get(`SELECT * FROM payments WHERE provider = 'razorpay' AND provider_order_id = ? AND company_id = ?`, ent.order_id, company.id);
      if (!p) return { ignored: true };
      if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
        if (ent.amount != null && ent.amount !== p.amount) return { ignored: true, reason: 'amount mismatch' };
        services.settlePayment(p.id, { status: 'paid', providerPaymentId: ent.id, via: 'razorpay webhook' });
      } else if (evt.event === 'payment.failed') {
        services.settlePayment(p.id, { status: 'failed', providerPaymentId: ent.id, via: 'razorpay webhook', reason: ent.error_description });
      }
      return {};
    });
    res.json({ ok: true });
  }));

  return r;
}
