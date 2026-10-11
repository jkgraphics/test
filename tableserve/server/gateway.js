// Online payment gateway adapters.
//
//  - "test": a built-in SIMULATED gateway for development and demos. It behaves like a real
//    provider: the checkout page lives on the "gateway" side and the result is delivered to the
//    restaurant only through an HMAC-signed server-to-server webhook, which is verified exactly
//    like a real one. Payments made this way are stored with provider_mode = 'test'.
//  - "razorpay": live/test Razorpay account configured by the restaurant owner. Requires the
//    owner's Key ID, Key Secret and Webhook Secret (stored AES-GCM encrypted).
import { hmacHex, safeEqual, randomToken, json, HttpError } from './util.js';

export function createGateway({ db, config, cipher }) {
  function companyGateway(company) {
    const ps = json(company.payment_settings, {});
    if (!ps.online) return null;
    if (ps.online_provider === 'razorpay' && ps.razorpay_key_id && ps.razorpay_key_secret_enc) {
      return {
        provider: 'razorpay',
        mode: String(ps.razorpay_key_id).startsWith('rzp_live_') ? 'live' : 'test',
        keyId: ps.razorpay_key_id,
        keySecret: () => cipher.decrypt(ps.razorpay_key_secret_enc),
        webhookSecret: () => cipher.decrypt(ps.razorpay_webhook_secret_enc || ''),
      };
    }
    if (config.allowTestPayments) return { provider: 'test', mode: 'test' };
    return null;
  }

  async function createOrder(company, payment, billNo) {
    const gw = companyGateway(company);
    if (!gw) throw new HttpError(409, 'Online payment is not available at this restaurant. Please pay at the counter.');
    if (gw.provider === 'test') {
      const orderId = `test_order_${randomToken(12)}`;
      return { provider: 'test', mode: 'test', orderId, checkoutUrl: `/pay/test/${orderId}` };
    }
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${gw.keyId}:${gw.keySecret()}`).toString('base64'),
      },
      body: JSON.stringify({ amount: payment.amount, currency: company.currency, receipt: `bill-${billNo}-p${payment.id}`, notes: { tableserve_payment_id: String(payment.id) } }),
    });
    if (!res.ok) throw new HttpError(502, 'Payment gateway is unavailable. Please pay at the counter.');
    const body = await res.json();
    return { provider: 'razorpay', mode: gw.mode, orderId: body.id, checkoutUrl: `/pay/razorpay/${payment.id}`, keyId: gw.keyId };
  }

  // --- simulated gateway --------------------------------------------------------------------
  // Builds the webhook the simulated gateway "sends". Signed with MOCK_GATEWAY_SECRET.
  function testWebhook(orderId, outcome) {
    const body = JSON.stringify({
      id: `evt_${randomToken(10)}`,
      type: outcome === 'success' ? 'payment.succeeded' : 'payment.failed',
      data: { order_id: orderId, payment_id: `test_pay_${randomToken(10)}`, reason: outcome === 'success' ? null : 'Card declined (simulated)' },
    });
    return { body, signature: hmacHex(config.testGatewaySecret, body) };
  }

  function verifyTestWebhook(rawBody, signature) {
    return !!signature && safeEqual(hmacHex(config.testGatewaySecret, rawBody), signature);
  }

  // --- razorpay -----------------------------------------------------------------------------
  function verifyRazorpayWebhook(company, rawBody, signature) {
    const gw = companyGateway(company);
    if (!gw || gw.provider !== 'razorpay') return false;
    const secret = gw.webhookSecret();
    return !!secret && !!signature && safeEqual(hmacHex(secret, rawBody), signature);
  }

  // Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret).
  function verifyRazorpayCheckout(company, orderId, paymentId, signature) {
    const gw = companyGateway(company);
    if (!gw || gw.provider !== 'razorpay') return false;
    return !!signature && safeEqual(hmacHex(gw.keySecret(), `${orderId}|${paymentId}`), signature);
  }

  async function refund(company, payment, amount) {
    if (payment.provider === 'test') return { id: `test_rfnd_${randomToken(8)}`, status: 'processed' };
    if (payment.provider !== 'razorpay') return { id: null, status: 'processed' };
    const gw = companyGateway(company);
    if (!gw || gw.provider !== 'razorpay') throw new HttpError(409, 'Razorpay is no longer configured; refund this payment from the Razorpay dashboard.');
    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.provider_payment_id)}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${gw.keyId}:${gw.keySecret()}`).toString('base64'),
      },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) throw new HttpError(502, 'The gateway rejected the refund request');
    const body = await res.json();
    return { id: body.id, status: body.status === 'processed' ? 'processed' : 'pending' };
  }

  return { companyGateway, createOrder, testWebhook, verifyTestWebhook, verifyRazorpayWebhook, verifyRazorpayCheckout, refund };
}
