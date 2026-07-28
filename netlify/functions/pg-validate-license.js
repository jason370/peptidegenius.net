const {
  json,
  corsHeaders,
  getLicenseStore,
  readLicenseByKey
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
    const licenseKey = String(body.licenseKey || body.key || '').trim().toUpperCase();
    if (!licenseKey || licenseKey.length < 6) {
      return json(400, { ok: false, valid: false, error: 'No license key provided' });
    }

    const store = await getLicenseStore(event);
    const license = await readLicenseByKey(store, licenseKey);
    if (!license) {
      return json(200, { ok: false, valid: false, error: 'License key not found' });
    }
    if (!license.active) {
      return json(200, { ok: false, valid: false, error: 'License is inactive' });
    }

    return json(200, {
      ok: true,
      valid: true,
      plan: license.plan,
      email: license.email || null,
      createdAt: license.createdAt || null
    });
  } catch (err) {
    console.error('[pg-validate-license]', err);
    return json(500, { ok: false, valid: false, error: err.message || 'Validation failed' });
  }
};
