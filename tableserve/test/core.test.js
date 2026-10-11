// End-to-end verification of the core ordering and billing workflow (the 8 required checks plus
// supporting permission/billing cases). Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, client, sse, key } from './helpers.js';

let S;
before(async () => { S = await startServer(); });
after(async () => { await S.close(); });

const SPICE_T5 = 'demo-spice-kor-t5';
const COASTAL_T5 = 'demo-coastal-ban-t5';

async function menuOf(qr) {
  const r = await client(S.base).get(`/api/public/t/${qr}/menu`);
  assert.equal(r.status, 200);
  return r.data;
}
const findItem = (menu, name) => menu.items.find((i) => i.name === name);

// Staff opens the table; returns the join code.
async function openTable(staff, qr) {
  const t = S.db.get('SELECT * FROM tables WHERE qr_token = ?', qr);
  const r = await staff.post(`/api/staff/tables/${t.id}/open`, { guest_count: 2 });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { table: t, code: r.data.session.join_code, sessionId: r.data.session.id };
}

async function joinWithCode(qr, code) {
  const g = client(S.base);
  const r = await g.post(`/api/public/t/${qr}/join`, { code, label: 'Guest' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  g.guestToken = r.data.token;
  return g;
}

test('1. each Table 5 QR resolves to the correct company, branch and table', async () => {
  const anon = client(S.base);
  const a = await anon.get(`/api/public/t/${SPICE_T5}`);
  const b = await anon.get(`/api/public/t/${COASTAL_T5}`);
  assert.equal(a.status, 200);
  assert.equal(a.data.company.name, '[DEMO] Spice Garden');
  assert.equal(a.data.branch.name, 'Koramangala');
  assert.equal(a.data.table.number, '5');
  assert.equal(b.data.company.name, '[DEMO] Coastal Curry Co.');
  assert.equal(b.data.branch.name, 'Bandra');
  assert.equal(b.data.table.number, '5');
  // Menus are the restaurant's own.
  assert.ok(findItem(await menuOf(SPICE_T5), 'Butter Chicken'));
  assert.ok(!findItem(await menuOf(COASTAL_T5), 'Butter Chicken'));
  assert.ok(findItem(await menuOf(COASTAL_T5), 'Masala Dosa'));
  // The public endpoint never leaks the join code or any orders.
  assert.ok(!JSON.stringify(a.data).includes('join_code'));
  // Unknown QR → 404.
  assert.equal((await anon.get('/api/public/t/does-not-exist')).status, 404);
  // The QR image encodes the stable public URL.
  const owner = await client(S.base).login('owner@spicegarden.demo');
  const t = S.db.get('SELECT * FROM tables WHERE qr_token = ?', SPICE_T5);
  const qr = await owner.get(`/api/manage/tables/${t.id}/qr.svg`);
  assert.equal(qr.status, 200);
  assert.match(qr.headers.get('content-type'), /svg/);
});

test('2. users from one company cannot access another company\'s records', async () => {
  const spiceOwner = await client(S.base).login('owner@spicegarden.demo');
  const coastal = S.demo.coastal;
  const cBranch = coastal.branches[0];
  const cItem = cBranch.items[0];
  const cTable = cBranch.table5;
  const checks = [
    await spiceOwner.get(`/api/staff/branches/${cBranch.id}/tables`),
    await spiceOwner.get(`/api/staff/branches/${cBranch.id}/orders`),
    await spiceOwner.get(`/api/manage/branches/${cBranch.id}/tables`),
    await spiceOwner.put(`/api/manage/items/${cItem.id}`, { price: 1 }),
    await spiceOwner.post(`/api/staff/tables/${cTable}/open`, {}),
    await spiceOwner.get(`/api/manage/tables/${cTable}/qr.png`),
    await spiceOwner.get(`/api/staff/branches/${cBranch.id}/stream`),
  ];
  for (const r of checks) assert.equal(r.status, 404, `expected 404, got ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
  // A Coastal order is invisible to Spice staff.
  const cOrder = S.db.get('SELECT id FROM orders WHERE company_id = ? LIMIT 1', coastal.id);
  assert.equal((await spiceOwner.get(`/api/staff/orders/${cOrder.id}`)).status, 404);
  assert.equal((await spiceOwner.post(`/api/staff/orders/${cOrder.id}/cancel`, { reason: 'hack attempt' })).status, 404);
  // Reports only contain own branches.
  const rep = await spiceOwner.get('/api/manage/reports');
  assert.ok(rep.data.branches.every((b) => S.demo.spice.branches.some((x) => x.id === b.id)));
  // Price of the Coastal dish is untouched.
  assert.equal(S.db.get('SELECT price FROM menu_items WHERE id = ?', cItem.id).price, cItem.price);

  // Within a company: branch manager is limited to assigned branches, kitchen to kitchen work.
  const manager = await client(S.base).login('manager@spicegarden.demo');
  const otherBranch = S.demo.spice.branches[1];
  assert.equal((await manager.get(`/api/staff/branches/${otherBranch.id}/orders`)).status, 403);
  const kitchen = await client(S.base).login('kitchen@spicegarden.demo');
  assert.equal((await kitchen.get('/api/manage/staff')).status, 403);
  assert.equal((await kitchen.put('/api/manage/company', { name: 'x' })).status, 403);
  const waiter = await client(S.base).login('waiter@spicegarden.demo');
  assert.equal((await waiter.post(`/api/staff/sessions/1/discount`, { type: 'percent', value: 50, reason: 'friend' })).status, 403);
  // Restaurant users have no platform access.
  assert.equal((await spiceOwner.get('/api/platform/companies')).status, 403);
  // CSRF: cookie-authenticated mutation without the custom header is refused.
  const raw = await spiceOwner.req('POST', `/api/staff/branches/${S.demo.spice.branches[0].id}/pause`, { paused: true }, { 'X-Requested-With': '' });
  assert.equal(raw.status, 403);
});

test('3 & 4. two authorised phones order into one session; repeated submission creates one order', async () => {
  const waiter = await client(S.base).login('waiter@coastalcurry.demo');
  const { code, sessionId, table } = await openTable(waiter, COASTAL_T5);
  const menu = await menuOf(COASTAL_T5);
  const dosa = findItem(menu, 'Masala Dosa');
  const coffee = findItem(menu, 'Filter Coffee');

  // Phone A joins with the table code.
  const phoneA = await joinWithCode(COASTAL_T5, code);
  // A wrong code is rejected.
  const wrong = await client(S.base).post(`/api/public/t/${COASTAL_T5}/join`, { code: code === '0000' ? '1111' : '0000' });
  assert.equal(wrong.status, 400);
  // Phone B asks for staff approval instead.
  const phoneB = client(S.base);
  const jr = await phoneB.post(`/api/public/t/${COASTAL_T5}/join-request`, { label: 'Friend' });
  assert.equal(jr.status, 201);
  const pending = await phoneB.get(`/api/public/join-requests/${jr.data.request_id}?poll=${jr.data.poll_token}`);
  assert.equal(pending.data.status, 'pending');
  assert.equal((await waiter.post(`/api/staff/join-requests/${jr.data.request_id}/approve`)).status, 200);
  const approved = await phoneB.get(`/api/public/join-requests/${jr.data.request_id}?poll=${jr.data.poll_token}`);
  assert.equal(approved.data.status, 'approved');
  phoneB.guestToken = approved.data.token;
  // Token is handed over only once.
  assert.equal((await phoneB.get(`/api/public/join-requests/${jr.data.request_id}?poll=${jr.data.poll_token}`)).data.token, undefined);

  // An unauthorised phone cannot order.
  const stranger = client(S.base, { guestToken: 'nope' });
  assert.equal((await stranger.post(`/api/public/t/${COASTAL_T5}/orders`, { lines: [{ item_id: dosa.id, qty: 1 }], idempotency_key: key() })).status, 401);

  const k = key();
  const body = { lines: [{ item_id: dosa.id, qty: 2, selections: { addons: ['ghee'] }, instructions: 'less spicy' }], idempotency_key: k };
  // Fire the same submission 5 times concurrently (double taps / retries).
  const results = await Promise.all(Array.from({ length: 5 }, () => phoneA.post(`/api/public/t/${COASTAL_T5}/orders`, body)));
  const created = results.filter((r) => r.status === 201);
  assert.equal(created.length, 1, 'exactly one request creates the order');
  assert.ok(results.every((r) => r.data.order.id === created[0].data.order.id), 'retries return the same order');
  assert.equal(S.db.get('SELECT COUNT(*) n FROM orders WHERE session_id = ? AND idempotency_key = ?', sessionId, k).n, 1);

  const rB = await phoneB.post(`/api/public/t/${COASTAL_T5}/orders`, { lines: [{ item_id: coffee.id, qty: 1, selections: { size: 'large' } }], idempotency_key: key() });
  assert.equal(rB.status, 201, JSON.stringify(rB.data));
  assert.equal(rB.data.order.session_id, sessionId);
  assert.equal(created[0].data.order.session_id, sessionId);
  assert.notEqual(rB.data.order.id, created[0].data.order.id);

  // Both phones see both orders of the shared session.
  const viewA = await phoneA.get(`/api/public/t/${COASTAL_T5}/session`);
  assert.equal(viewA.data.orders.length, 2);
  const tbl = S.db.get('SELECT status FROM tables WHERE id = ?', table.id);
  assert.equal(tbl.status, 'occupied');

  // Clean up: cancel both so later tests start from a clean table.
  const kitchen = await client(S.base).login('kitchen@coastalcurry.demo');
  for (const o of viewA.data.orders) await kitchen.post(`/api/staff/orders/${o.id}/reject`, { reason: 'test cleanup' });
  const mgr = await client(S.base).login('manager@coastalcurry.demo');
  assert.equal((await mgr.post(`/api/staff/tables/${table.id}/close`, {})).status, 200);
});

test('5 & 6. kitchen status reaches customer and waiter in real time; bill uses server prices', async () => {
  const waiter = await client(S.base).login('waiter@spicegarden.demo');
  const t = S.db.get('SELECT * FROM tables WHERE qr_token = ?', SPICE_T5);
  if (t.status === 'cleaning') await waiter.post(`/api/staff/tables/${t.id}/status`, { status: 'available' });
  const { code, table } = await openTable(waiter, SPICE_T5);
  const phone = await joinWithCode(SPICE_T5, code);
  const menu = await menuOf(SPICE_T5);
  const chicken = findItem(menu, 'Butter Chicken');
  const naan = findItem(menu, 'Butter Naan');

  const customerStream = sse(`${S.base}/api/public/t/${SPICE_T5}/stream?token=${phone.guestToken}`);
  const waiterCookie = await (async () => { const r = await fetch(`${S.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'TableServe' }, body: JSON.stringify({ email: 'waiter@spicegarden.demo', password: 'Demo@1234' }) }); return r.headers.get('set-cookie').split(';')[0]; })();
  const waiterStream = sse(`${S.base}/api/staff/branches/${t.branch_id}/stream`, { Cookie: waiterCookie });
  await customerStream.ready; await waiterStream.ready;
  await customerStream.waitFor((e) => e.event === 'hello');
  await waiterStream.waitFor((e) => e.event === 'hello');

  // Client tries to dictate prices – ignored.
  const order = await phone.post(`/api/public/t/${SPICE_T5}/orders`, {
    idempotency_key: key(),
    lines: [
      { item_id: chicken.id, qty: 2, price: 1, unit_price: 1, selections: { portion: 'full', addons: ['butter'] } },
      { item_id: naan.id, qty: 3, line_total: 1, selections: { addons: ['garlic'] } },
    ],
  });
  assert.equal(order.status, 201, JSON.stringify(order.data));
  const full = chicken.options[0].choices.find((c) => c.id === 'full').price;
  const butter = chicken.options[1].choices.find((c) => c.id === 'butter').price;
  const garlic = naan.options[0].choices.find((c) => c.id === 'garlic').price;
  const expectedSubtotal = (chicken.price + full + butter) * 2 + (naan.price + garlic) * 3;
  assert.equal(order.data.order.subtotal, expectedSubtotal);
  await waiterStream.waitFor((e) => e.event === 'order.new' && e.data.id === order.data.order.id);

  const kitchen = await client(S.base).login('kitchen@spicegarden.demo');
  const oid = order.data.order.id;
  assert.equal((await kitchen.post(`/api/staff/orders/${oid}/accept`, { prep_minutes: 12 })).status, 200);
  await customerStream.waitFor((e) => e.event === 'order.updated' && e.data.id === oid && e.data.status === 'accepted');
  await kitchen.post(`/api/staff/orders/${oid}/preparing`);
  await customerStream.waitFor((e) => e.event === 'order.updated' && e.data.id === oid && e.data.status === 'preparing');
  await kitchen.post(`/api/staff/orders/${oid}/ready`);
  await customerStream.waitFor((e) => e.event === 'order.updated' && e.data.id === oid && e.data.status === 'ready');
  await waiterStream.waitFor((e) => e.event === 'order.updated' && e.data.id === oid && e.data.status === 'ready');
  // Kitchen cannot mark served; waiter can.
  assert.equal((await kitchen.post(`/api/staff/orders/${oid}/served`)).status, 403);
  assert.equal((await waiter.post(`/api/staff/orders/${oid}/served`)).status, 200);
  await customerStream.waitFor((e) => e.event === 'order.updated' && e.data.id === oid && e.data.status === 'served');

  // Menu price changes later must not alter the existing order or bill.
  const owner = await client(S.base).login('owner@spicegarden.demo');
  assert.equal((await owner.put(`/api/manage/items/${naan.id}`, { price: 999 })).status, 200);
  await customerStream.waitFor((e) => e.event === 'menu.updated');

  const bill = (await phone.get(`/api/public/t/${SPICE_T5}/bill`)).data.bill;
  assert.equal(bill.subtotal, expectedSubtotal);
  const company = S.db.get('SELECT * FROM companies WHERE id = ?', t.company_id);
  const sc = Math.round(expectedSubtotal * company.service_charge_pct / 100);
  const taxEach = Math.round((expectedSubtotal + sc) * 2.5 / 100);
  assert.equal(bill.service_charge, sc);
  assert.equal(bill.tax_total, taxEach * 2);
  assert.equal(bill.total, expectedSubtotal + sc + taxEach * 2);
  assert.equal(bill.outstanding, bill.total);

  // Cashier discount above the branch limit is refused; within the limit is applied and audited.
  const cashier = await client(S.base).login('cashier@spicegarden.demo');
  const sid = bill.session_id;
  assert.equal((await cashier.post(`/api/staff/sessions/${sid}/discount`, { type: 'percent', value: 50, reason: 'Friend' })).status, 403);
  const disc = await cashier.post(`/api/staff/sessions/${sid}/discount`, { type: 'percent', value: 10, reason: 'Regular guest' });
  assert.equal(disc.status, 200);
  assert.equal(disc.data.bill.discount, Math.round(expectedSubtotal * 0.1));
  assert.ok(S.db.get(`SELECT id FROM audit_logs WHERE action = 'bill.discount' AND entity_id = ?`, disc.data.bill.bill_id));
  await customerStream.waitFor((e) => e.event === 'bill.updated' && e.data.discount > 0);

  customerStream.close(); waiterStream.close();
  // Leave this session open for test 7/8 via module-level state.
  globalThis.__spice = { phone, table, sid, waiter, cashier, owner };
});

test('8. online payment status changes only after a verified gateway notification', async () => {
  const { phone, sid } = globalThis.__spice;
  const start = await phone.post(`/api/public/t/${SPICE_T5}/pay/online`);
  assert.equal(start.status, 201, JSON.stringify(start.data));
  assert.equal(start.data.payment.status, 'pending');
  assert.equal(start.data.payment.mode, 'test');
  const pid = start.data.payment.id;
  // Double tap reuses the same checkout.
  assert.equal((await phone.post(`/api/public/t/${SPICE_T5}/pay/online`)).data.payment.id, pid);
  const p = S.db.get('SELECT * FROM payments WHERE id = ?', pid);

  // Forged / unsigned webhooks are rejected and change nothing.
  const forgedBody = JSON.stringify({ id: 'evt_forged', type: 'payment.succeeded', data: { order_id: p.provider_order_id, payment_id: 'x' } });
  const forged = await fetch(`${S.base}/api/webhooks/test`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Signature': 'deadbeef' }, body: forgedBody });
  assert.equal(forged.status, 401);
  const unsigned = await fetch(`${S.base}/api/webhooks/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: forgedBody });
  assert.equal(unsigned.status, 401);
  // A signature computed with the wrong secret also fails.
  const { hmacHex } = await import('../server/util.js');
  const wrongSig = await fetch(`${S.base}/api/webhooks/test`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Signature': hmacHex('guess', forgedBody) }, body: forgedBody });
  assert.equal(wrongSig.status, 401);
  // A cashier cannot "confirm" an online payment by hand (e.g. from a screenshot).
  assert.equal((await globalThis.__spice.cashier.post(`/api/staff/payments/${pid}/confirm`)).status, 403);
  assert.equal(S.db.get('SELECT status FROM payments WHERE id = ?', pid).status, 'pending');
  assert.equal((await phone.get(`/api/public/t/${SPICE_T5}/bill`)).data.bill.status, 'open');

  // The simulated gateway's hosted checkout delivers a properly signed webhook.
  const done = await fetch(`${S.base}/pay/test/${p.provider_order_id}/complete?back=/t/${SPICE_T5}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'outcome=success', redirect: 'manual' });
  assert.equal(done.status, 303);
  assert.equal(S.db.get('SELECT status FROM payments WHERE id = ?', pid).status, 'paid');
  const bill = (await phone.get(`/api/public/t/${SPICE_T5}/bill`)).data.bill;
  assert.equal(bill.status, 'paid');
  assert.equal(bill.outstanding, 0);
  // Replaying a signed event is idempotent; a late failure never downgrades a paid payment.
  const { body, signature } = S.gateway.testWebhook(p.provider_order_id, 'failure');
  const late = await fetch(`${S.base}/api/webhooks/test`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Signature': signature }, body });
  assert.equal(late.status, 200);
  assert.equal(S.db.get('SELECT status FROM payments WHERE id = ?', pid).status, 'paid');
  // Receipt is downloadable after payment.
  const receipt = await phone.get(`/api/public/t/${SPICE_T5}/receipt?download=1`);
  assert.equal(receipt.status, 200);
  assert.match(receipt.data, /Receipt/);
  assert.match(receipt.headers.get('content-disposition'), /attachment/);
  globalThis.__spice.paymentId = pid;
  globalThis.__spice.sid = sid;
});

test('refund requires authorisation, a reason, and is audited', async () => {
  const { paymentId, waiter, cashier } = globalThis.__spice;
  assert.equal((await waiter.post(`/api/staff/payments/${paymentId}/refund`, { amount: 10, reason: 'cold food' })).status, 403);
  assert.equal((await cashier.post(`/api/staff/payments/${paymentId}/refund`, { amount: 10 })).status, 400);
  const r = await cashier.post(`/api/staff/payments/${paymentId}/refund`, { amount: 10, reason: 'Cold food' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.payment.refunded_amount, 1000);
  assert.equal(r.data.refunds.length, 1);
  assert.ok(S.db.get(`SELECT id FROM audit_logs WHERE action = 'payment.refund' AND entity_id = ?`, paymentId));
});

test('7. closing a dining session cuts off its phones; next customers cannot see previous orders or bill', async () => {
  const { phone, table, waiter, sid } = globalThis.__spice;
  const stream = sse(`${S.base}/api/public/t/${SPICE_T5}/stream?token=${phone.guestToken}`);
  await stream.ready;
  await stream.waitFor((e) => e.event === 'hello');
  assert.equal((await waiter.post(`/api/staff/tables/${table.id}/close`, {})).status, 200);
  await stream.waitFor((e) => e.event === 'session.closed');
  stream.close();
  // Old phone loses access to orders, bill and ordering.
  assert.equal((await phone.get(`/api/public/t/${SPICE_T5}/session`)).status, 401);
  assert.equal((await phone.get(`/api/public/t/${SPICE_T5}/bill`)).status, 401);
  assert.equal((await phone.post(`/api/public/t/${SPICE_T5}/orders`, { lines: [{ item_id: 1, qty: 1 }], idempotency_key: key() })).status, 401);
  assert.equal(S.db.get('SELECT status FROM tables WHERE id = ?', table.id).status, 'cleaning');
  // Table must be cleaned before a guest can self-start.
  assert.equal((await client(S.base).post(`/api/public/t/${SPICE_T5}/start`, {})).status, 409);
  await waiter.post(`/api/staff/tables/${table.id}/status`, { status: 'available' });
  // Next customer self-starts (branch allows it) and gets a fresh, empty session.
  const next = client(S.base);
  const st = await next.post(`/api/public/t/${SPICE_T5}/start`, { label: 'Next guest' });
  assert.equal(st.status, 201, JSON.stringify(st.data));
  next.guestToken = st.data.token;
  const view = await next.get(`/api/public/t/${SPICE_T5}/session`);
  assert.equal(view.status, 200);
  assert.notEqual(view.data.session.id, sid);
  assert.equal(view.data.orders.length, 0);
  assert.equal(view.data.bill.total, 0);
  assert.equal(view.data.bill.payments.length, 0);
  // The old join code no longer works for the new session unless it coincidentally matches; the
  // previous session's device token never does.
  assert.equal((await client(S.base, { guestToken: phone.guestToken }).get(`/api/public/t/${SPICE_T5}/session`)).status, 401);
});

test('closing with an unpaid bill needs a manager and a reason', async () => {
  const waiter = await client(S.base).login('waiter@coastalcurry.demo');
  const t = S.db.get('SELECT * FROM tables WHERE qr_token = ?', COASTAL_T5);
  await waiter.post(`/api/staff/tables/${t.id}/status`, { status: 'available' });
  const { code, table } = await openTable(waiter, COASTAL_T5);
  const phone = await joinWithCode(COASTAL_T5, code);
  const dosa = findItem(await menuOf(COASTAL_T5), 'Idli Sambar');
  const o = await phone.post(`/api/public/t/${COASTAL_T5}/orders`, { lines: [{ item_id: dosa.id, qty: 1 }], idempotency_key: key() });
  const kitchen = await client(S.base).login('kitchen@coastalcurry.demo');
  await kitchen.post(`/api/staff/orders/${o.data.order.id}/accept`);
  await kitchen.post(`/api/staff/orders/${o.data.order.id}/ready`);
  await waiter.post(`/api/staff/orders/${o.data.order.id}/served`);
  const blocked = await waiter.post(`/api/staff/tables/${table.id}/close`, {});
  assert.equal(blocked.status, 409);
  assert.equal((await waiter.post(`/api/staff/tables/${table.id}/close`, { force: true, reason: 'walked out' })).status, 403);
  // Cashier settles in cash → close succeeds.
  const cashier = await client(S.base).login('cashier@coastalcurry.demo');
  const pay = await cashier.post(`/api/staff/sessions/${o.data.order.session_id}/payments`, { method: 'cash' });
  assert.equal(pay.status, 201, JSON.stringify(pay.data));
  assert.equal(pay.data.bill.status, 'paid');
  assert.equal((await waiter.post(`/api/staff/tables/${table.id}/close`, {})).status, 200);
});

test('customer UPI claim stays pending until a cashier confirms it', async () => {
  const waiter = globalThis.__spice.waiter;
  const t = S.db.get('SELECT * FROM tables WHERE qr_token = ?', SPICE_T5);
  // close the self-started session from test 7 first (no orders → closes cleanly)
  await waiter.post(`/api/staff/tables/${t.id}/close`, {});
  await waiter.post(`/api/staff/tables/${t.id}/status`, { status: 'available' });
  const { code } = await openTable(waiter, SPICE_T5);
  const phone = await joinWithCode(SPICE_T5, code);
  const chaas = findItem(await menuOf(SPICE_T5), 'Masala Chaas');
  const o = await phone.post(`/api/public/t/${SPICE_T5}/orders`, { lines: [{ item_id: chaas.id, qty: 2 }], idempotency_key: key() });
  // Paying before the kitchen accepts is refused (pending orders are not on the bill yet).
  assert.equal((await phone.post(`/api/public/t/${SPICE_T5}/pay/upi`, { reference: '123456789012' })).status, 409);
  const kitchen = await client(S.base).login('kitchen@spicegarden.demo');
  await kitchen.post(`/api/staff/orders/${o.data.order.id}/accept`);
  const claim = await phone.post(`/api/public/t/${SPICE_T5}/pay/upi`, { reference: '123456789012' });
  assert.equal(claim.status, 201);
  assert.equal(claim.data.payment.status, 'pending');
  assert.equal((await phone.get(`/api/public/t/${SPICE_T5}/bill`)).data.bill.status, 'open');
  const cashier = globalThis.__spice.cashier;
  const ok = await cashier.post(`/api/staff/payments/${claim.data.payment.id}/confirm`);
  assert.equal(ok.status, 200);
  assert.equal((await phone.get(`/api/public/t/${SPICE_T5}/bill`)).data.bill.status, 'paid');
});

test('availability is re-validated at submission and paused branches refuse customer orders', async () => {
  const phone = await (async () => {
    const t = S.db.get('SELECT * FROM tables WHERE qr_token = ?', SPICE_T5);
    const s = S.db.get(`SELECT * FROM dining_sessions WHERE id = ?`, t.current_session_id);
    return joinWithCode(SPICE_T5, s.join_code);
  })();
  const menu = await menuOf(SPICE_T5);
  const jamun = findItem(menu, 'Gulab Jamun');
  assert.equal(jamun.in_stock, false);
  const r = await phone.post(`/api/public/t/${SPICE_T5}/orders`, { lines: [{ item_id: jamun.id, qty: 1 }], idempotency_key: key() });
  assert.equal(r.status, 409);
  assert.equal(r.data.unavailable[0].item_id, jamun.id);
  // Required option missing.
  const dal = findItem(menu, 'Dal Makhani');
  assert.equal((await phone.post(`/api/public/t/${SPICE_T5}/orders`, { lines: [{ item_id: dal.id, qty: 1 }], idempotency_key: key() })).status, 409);
  // Item from the other company is not orderable here.
  const foreign = S.demo.coastal.branches[0].items[0];
  assert.equal((await phone.post(`/api/public/t/${SPICE_T5}/orders`, { lines: [{ item_id: foreign.id, qty: 1 }], idempotency_key: key() })).status, 409);
  const mgr = await client(S.base).login('manager@spicegarden.demo');
  const bid = S.demo.spice.branches[0].id;
  await mgr.post(`/api/staff/branches/${bid}/pause`, { paused: true, message: 'Kitchen is full' });
  const paused = await phone.post(`/api/public/t/${SPICE_T5}/orders`, { lines: [{ item_id: dal.id, qty: 1, selections: { portion: 'half' } }], idempotency_key: key() });
  assert.equal(paused.status, 409);
  assert.equal(paused.data.paused, true);
  await mgr.post(`/api/staff/branches/${bid}/pause`, { paused: false });
  const ok = await phone.post(`/api/public/t/${SPICE_T5}/orders`, { lines: [{ item_id: dal.id, qty: 1, selections: { portion: 'half' } }], idempotency_key: key() });
  assert.equal(ok.status, 201);
});

test('plan limits and platform super admin controls', async () => {
  const superA = await client(S.base).login('super@tableserve.demo');
  const ov = await superA.get('/api/platform/overview');
  assert.equal(ov.status, 200);
  assert.equal(ov.data.companies, 2);
  const support = await client(S.base).login('support@tableserve.demo');
  assert.equal((await support.get('/api/platform/companies')).status, 200);
  assert.equal((await support.post('/api/platform/plans', { name: 'X', price_monthly: 1, price_annual: 1, max_branches: 1, max_tables: 1, max_staff: 1 })).status, 403);
  // Coastal is on Starter (1 branch) → second branch refused.
  const coastalOwner = await client(S.base).login('owner@coastalcurry.demo');
  assert.equal((await coastalOwner.post('/api/manage/branches', { name: 'Juhu' })).status, 402);
  // Suspending a company stops customer ordering.
  const cid = S.demo.coastal.id;
  assert.equal((await superA.put(`/api/platform/companies/${cid}`, { status: 'suspended' })).status, 200);
  const info = await client(S.base).get(`/api/public/t/${COASTAL_T5}`);
  assert.equal(info.data.ordering.allowed, false);
  await superA.put(`/api/platform/companies/${cid}`, { status: 'active' });
  // Subscription payment is recorded separately from restaurant sales.
  const before = S.db.get('SELECT COUNT(*) n FROM payments').n;
  assert.equal((await superA.post(`/api/platform/companies/${cid}/subscription-payments`, { period: 'monthly' })).status, 201);
  assert.equal(S.db.get('SELECT COUNT(*) n FROM payments').n, before);
  assert.equal(S.db.get(`SELECT subscription_status s FROM companies WHERE id = ?`, cid).s, 'active');
});
