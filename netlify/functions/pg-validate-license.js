const {
  json,
  corsHeaders,
  validateLicenseKey
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
    const licenseKey = String(body.licenseKey || body.key || '').trim();
    if (!licenseKey || licenseKey.length < 6) {
      return json(400, { ok: false, valid: false, error: 'No license key provided' });
    }

    const result = await validateLicenseKey(licenseKey);
    if (!result.valid) {
      return json(200, {
        ok: false,
        valid: false,
        error: result.error || 'Invalid license key'
      });
    }

    return json(200, {
      ok: true,
      valid: true,
      plan: result.plan,
      email: result.email || null
    });
  } catch (err) {
    console.error('[pg-validate-license]', err);
    return json(500, { ok: false, valid: false, error: err.message || 'Validation failed' });
  }
};
