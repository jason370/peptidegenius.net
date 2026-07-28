/**
 * Issue license keys for recent paid Checkout sessions matching an email.
 * POST { email }
 *
 * Intended for recovery when Stripe did not redirect with session_id.
 */
const {
  json,
  corsHeaders,
  stripeGet,
  fulfillCheckoutSession
} = require('../lib/pg-license');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return json(400, { ok: false, error: 'Valid email required' });
    }

    const listed = await stripeGet('checkout/sessions?limit=40');
    const sessions = (listed.data || []).filter((s) => {
      const e = (
        (s.customer_details && s.customer_details.email) ||
        s.customer_email ||
        (s.metadata && s.metadata.email) ||
        ''
      ).toLowerCase();
      const paid = s.payment_status === 'paid' || s.status === 'complete';
      return paid && e === email;
    });

    if (!sessions.length) {
      // Also try payment intents / charges path via checkout sessions search
      return json(404, {
        ok: false,
        error: 'No paid checkout sessions found for that email. If you paid via a Payment Link, open the payment in Stripe and use its cs_live_… session id.'
      });
    }

    const licenses = [];
    for (const s of sessions) {
      const result = await fulfillCheckoutSession(s.id, {
        source: 'pg-issue-by-email',
        sendEmail: true
      });
      licenses.push({
        sessionId: s.id,
        licenseKey: result.license.key,
        plan: result.license.plan,
        emailSent: !!(result.emailResult && result.emailResult.sent)
      });
    }

    return json(200, { ok: true, email, count: licenses.length, licenses });
  } catch (err) {
    console.error('[pg-issue-by-email]', err);
    return json(err.status || 500, { ok: false, error: err.message || 'Issue failed' });
  }
};
