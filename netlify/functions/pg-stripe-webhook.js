const {
  json,
  fulfillCheckoutSession,
  verifyStripeWebhook
} = require('../lib/pg-license');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : (event.body || '');

    verifyStripeWebhook(rawBody, event.headers['stripe-signature'] || event.headers['Stripe-Signature']);

    const evt = JSON.parse(rawBody);
    if (evt.type === 'checkout.session.completed') {
      const session = evt.data && evt.data.object;
      const sessionId = session && session.id;
      if (sessionId) {
        const result = await fulfillCheckoutSession(sessionId, {
          source: 'stripe-webhook',
          sendEmail: true
        });
        console.log('[pg-stripe-webhook] fulfilled', sessionId, result.license.key, 'created=', result.created);
      }
    }

    return json(200, { received: true });
  } catch (err) {
    console.error('[pg-stripe-webhook]', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Webhook Error' })
    };
  }
};
