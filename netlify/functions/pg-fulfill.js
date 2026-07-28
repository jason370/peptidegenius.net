const {
  json,
  corsHeaders,
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
    const sessionId = String(body.sessionId || body.session_id || '').trim();
    const result = await fulfillCheckoutSession(sessionId, {
      source: 'pg-fulfill',
      sendEmail: true,
      event
    });
    return json(200, {
      ok: true,
      created: result.created,
      licenseKey: result.license.key,
      plan: result.license.plan,
      email: result.license.email || null,
      emailSent: !!(result.emailResult && result.emailResult.sent),
      emailReason: result.emailResult && result.emailResult.reason ? result.emailResult.reason : null
    });
  } catch (err) {
    console.error('[pg-fulfill]', err);
    return json(err.status || 500, { ok: false, error: err.message || 'Fulfillment failed' });
  }
};
