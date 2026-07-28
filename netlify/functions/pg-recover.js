/**
 * Recover / issue license keys for recent paid Stripe Checkout sessions by email.
 * Protected by RECOVER_SECRET (or ADMIN_ISSUE_SECRET) env var.
 *
 * POST { email, secret }
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
    const secret = String(body.secret || '').trim();
    const expected = process.env.RECOVER_SECRET || process.env.ADMIN_ISSUE_SECRET || '';

    if (!expected || secret !== expected) {
      return json(401, { ok: false, error: 'Unauthorized' });
    }
    if (!email || !email.includes('@')) {
      return json(400, { ok: false, error: 'Valid email required' });
    }

    // Pull recent checkout sessions and filter by email client-side.
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

    const issued = [];
    for (const s of sessions) {
      const result = await fulfillCheckoutSession(s.id, {
        source: 'pg-recover',
        sendEmail: true,
        event
      });
      issued.push({
        sessionId: s.id,
        licenseKey: result.license.key,
        plan: result.license.plan,
        created: result.created,
        emailSent: !!(result.emailResult && result.emailResult.sent)
      });
    }

    return json(200, {
      ok: true,
      email,
      count: issued.length,
      licenses: issued
    });
  } catch (err) {
    console.error('[pg-recover]', err);
    return json(err.status || 500, { ok: false, error: err.message || 'Recover failed' });
  }
};
