/**
 * PeptideGenius Pro license helpers (Netlify functions).
 * Licenses are signed tokens derived from a paid Stripe Checkout Session.
 * No database required — validation checks HMAC (+ optional live Stripe re-check).
 *
 * Key format: PG1.<base64url-payload>.<base64url-hmac>
 */

const crypto = require('crypto');

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}

function signingSecret() {
  const explicit = process.env.LICENSE_SIGNING_SECRET || process.env.RECOVER_SECRET;
  if (explicit) return explicit;
  const stripe = process.env.STRIPE_SECRET_KEY;
  if (stripe) {
    return crypto.createHash('sha256').update(`pg-license|${stripe}`).digest('hex');
  }
  throw new Error('Set STRIPE_SECRET_KEY (or LICENSE_SIGNING_SECRET) in Netlify env');
}

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(s, 'base64').toString('utf8');
}

function detectPlan(session) {
  const metaPlan = session && session.metadata && session.metadata.plan;
  if (metaPlan && ['monthly', 'yearly', 'lifetime'].includes(metaPlan)) return metaPlan;

  const amount = Number(
    (session && (session.amount_total != null ? session.amount_total : session.amount_subtotal)) || 0
  );
  if (amount >= 7000) return 'lifetime';
  if (amount >= 4000) return 'yearly';
  if (amount >= 400) return 'monthly';

  if (session && session.mode === 'subscription') return 'monthly';
  if (session && session.mode === 'payment') return 'lifetime';
  return 'monthly';
}

function sessionEmail(session) {
  return (
    (session && session.customer_details && session.customer_details.email) ||
    (session && session.customer_email) ||
    (session && session.metadata && session.metadata.email) ||
    ''
  );
}

function makeLicenseKey(session) {
  const payloadObj = {
    sid: session.id,
    e: sessionEmail(session) || '',
    p: detectPlan(session),
    iat: Math.floor(Date.now() / 1000)
  };
  // Deterministic body (no iat) so re-fulfill returns the same key
  const stable = {
    sid: payloadObj.sid,
    e: payloadObj.e,
    p: payloadObj.p
  };
  const payload = b64url(JSON.stringify(stable));
  const sig = b64url(
    crypto.createHmac('sha256', signingSecret()).update(payload).digest()
  );
  return `PG1.${payload}.${sig}`;
}

function parseAndVerifyKey(licenseKey) {
  const raw = String(licenseKey || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 'PG1') {
    return { ok: false, reason: 'Invalid license key format' };
  }
  const payload = parts[1];
  const sig = parts[2];
  const expected = b64url(
    crypto.createHmac('sha256', signingSecret()).update(payload).digest()
  );
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Invalid license key signature' };
  }
  let data;
  try {
    data = JSON.parse(fromB64url(payload));
  } catch (_) {
    return { ok: false, reason: 'Corrupt license payload' };
  }
  if (!data.sid || !String(data.sid).startsWith('cs_')) {
    return { ok: false, reason: 'License missing checkout session' };
  }
  return {
    ok: true,
    sessionId: data.sid,
    email: data.e || '',
    plan: data.p || 'monthly'
  };
}

async function stripeGet(path) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error('STRIPE_SECRET_KEY is not configured in Netlify env'), { status: 500 });
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Stripe error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

async function sendLicenseEmail(email, licenseKey, planName) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[pg-license] SENDGRID_API_KEY missing — skipping email');
    return { sent: false, reason: 'SENDGRID_API_KEY missing' };
  }
  if (!email) return { sent: false, reason: 'no email' };

  const from = process.env.LICENSE_FROM_EMAIL || 'PeptideGenius@gmail.com';
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1F2937">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#F59E0B,#EC4899);color:#fff;padding:28px;border-radius:12px;text-align:center">
      <h1 style="margin:0;font-size:22px">Welcome to PeptideGenius Pro</h1>
    </div>
    <div style="background:#F9FAFB;padding:20px;border-radius:8px;margin-top:18px">
      <p>Your <strong>${planName}</strong> purchase is confirmed. Your license key:</p>
      <div style="background:#fff;border:2px dashed #E9D5FF;padding:18px;border-radius:8px;text-align:center;margin:18px 0;word-break:break-all">
        <div style="font-family:monospace;font-size:14px;font-weight:700;color:#4F46E5">${licenseKey}</div>
      </div>
      <ol>
        <li>Open <a href="https://peptidegenius.net">peptidegenius.net</a></li>
        <li>Click <strong>Pro</strong></li>
        <li>Paste the key under <em>Have a license key?</em> and click <strong>Restore</strong></li>
      </ol>
      <p>Questions: <a href="mailto:PeptideGenius@gmail.com">PeptideGenius@gmail.com</a></p>
    </div>
  </div></body></html>`;

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: from, name: 'PeptideGenius' },
      subject: 'Your PeptideGenius Pro License Key',
      content: [{ type: 'text/html', value: html }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[pg-license] SendGrid error', res.status, text);
    return { sent: false, reason: `SendGrid ${res.status}` };
  }
  return { sent: true };
}

async function fulfillCheckoutSession(sessionId, opts) {
  const options = opts || {};
  if (!sessionId || !String(sessionId).startsWith('cs_')) {
    throw Object.assign(new Error('Valid Stripe checkout session id required'), { status: 400 });
  }

  const session = await stripeGet(`checkout/sessions/${encodeURIComponent(sessionId)}`);
  const paid =
    session.payment_status === 'paid' ||
    session.status === 'complete' ||
    session.payment_status === 'no_payment_required';

  if (!paid) {
    throw Object.assign(new Error(`Checkout not paid yet (status: ${session.payment_status})`), { status: 402 });
  }

  const email = sessionEmail(session);
  const plan = detectPlan(session);
  const key = makeLicenseKey(session);
  const license = {
    key,
    email,
    plan,
    active: true,
    stripeSessionId: sessionId,
    amountTotal: session.amount_total || null,
    createdAt: new Date().toISOString(),
    source: options.source || 'fulfill'
  };

  let emailResult = { sent: false, reason: 'skipped' };
  if (options.sendEmail !== false) {
    emailResult = await sendLicenseEmail(email, key, `PeptideGenius Pro ${plan}`);
  }

  return { license, created: true, emailResult };
}

async function validateLicenseKey(licenseKey, opts) {
  const options = opts || {};
  const parsed = parseAndVerifyKey(licenseKey);
  if (!parsed.ok) return { ok: false, valid: false, error: parsed.reason };

  // Live re-check against Stripe so refunds/cancellations can revoke access
  if (options.recheckStripe !== false) {
    try {
      const session = await stripeGet(`checkout/sessions/${encodeURIComponent(parsed.sessionId)}`);
      const paid =
        session.payment_status === 'paid' ||
        session.status === 'complete' ||
        session.payment_status === 'no_payment_required';
      if (!paid) {
        return { ok: false, valid: false, error: 'Payment is no longer active' };
      }
    } catch (err) {
      // If Stripe is briefly down, still accept cryptographically valid keys
      console.warn('[pg-license] Stripe recheck failed, accepting signed key:', err.message);
    }
  }

  return {
    ok: true,
    valid: true,
    plan: parsed.plan,
    email: parsed.email || null,
    sessionId: parsed.sessionId
  };
}

function verifyStripeWebhook(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  if (!signatureHeader) throw new Error('Missing stripe-signature header');

  const parts = {};
  String(signatureHeader).split(',').forEach((p) => {
    const [k, v] = p.split('=');
    if (k && v) parts[k] = v;
  });
  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) throw new Error('Invalid stripe-signature header');

  const signed = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Webhook signature verification failed');
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > 300) throw new Error('Webhook timestamp too old');
}

module.exports = {
  corsHeaders,
  json,
  detectPlan,
  sessionEmail,
  stripeGet,
  sendLicenseEmail,
  fulfillCheckoutSession,
  validateLicenseKey,
  verifyStripeWebhook,
  makeLicenseKey,
  parseAndVerifyKey
};
