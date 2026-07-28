/**
 * Shared PeptideGenius Pro license helpers for Netlify functions.
 * Storage: Netlify Blobs (store name: pg-licenses)
 * Keys: session:{stripeSessionId} -> license record
 *       key:{LICENSE_KEY} -> license record
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

function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const chunk = () => {
    let s = '';
    for (let i = 0; i < 5; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  };
  return `PG-${chunk()}-${chunk()}-${chunk()}`;
}

function detectPlan(session) {
  const metaPlan = session && session.metadata && session.metadata.plan;
  if (metaPlan && ['monthly', 'yearly', 'lifetime'].includes(metaPlan)) return metaPlan;

  const amount = Number(
    (session && (session.amount_total != null ? session.amount_total : session.amount_subtotal)) || 0
  );
  // cents
  if (amount >= 7000) return 'lifetime';
  if (amount >= 4000) return 'yearly';
  if (amount >= 400) return 'monthly';

  const mode = session && session.mode;
  if (mode === 'subscription') return 'monthly';
  if (mode === 'payment') return 'lifetime';
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

async function stripeGet(path) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured in Netlify env');
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Stripe error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function getLicenseStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name: 'pg-licenses', consistency: 'strong' });
}

async function readLicenseBySession(store, sessionId) {
  const raw = await store.get(`session:${sessionId}`, { type: 'json' });
  return raw || null;
}

async function readLicenseByKey(store, licenseKey) {
  const raw = await store.get(`key:${licenseKey}`, { type: 'json' });
  return raw || null;
}

async function writeLicense(store, record) {
  await store.setJSON(`session:${record.stripeSessionId}`, record);
  await store.setJSON(`key:${record.key}`, record);
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
      <div style="background:#fff;border:2px dashed #E9D5FF;padding:18px;border-radius:8px;text-align:center;margin:18px 0">
        <div style="font-family:monospace;font-size:18px;font-weight:700;letter-spacing:2px;color:#4F46E5">${licenseKey}</div>
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

/**
 * Idempotent fulfillment for a paid Stripe Checkout Session.
 */
async function fulfillCheckoutSession(sessionId, opts) {
  const options = opts || {};
  if (!sessionId || !String(sessionId).startsWith('cs_')) {
    throw Object.assign(new Error('Valid Stripe checkout session id required'), { status: 400 });
  }

  const store = await getLicenseStore();
  const existing = await readLicenseBySession(store, sessionId);
  if (existing && existing.active) {
    return { license: existing, created: false, emailResult: { sent: false, reason: 'already issued' } };
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
  const key = generateLicenseKey();
  const record = {
    key,
    email,
    plan,
    active: true,
    stripeSessionId: sessionId,
    amountTotal: session.amount_total || null,
    createdAt: new Date().toISOString(),
    source: options.source || 'fulfill'
  };

  await writeLicense(store, record);

  let emailResult = { sent: false, reason: 'skipped' };
  if (options.sendEmail !== false) {
    emailResult = await sendLicenseEmail(email, key, `PeptideGenius Pro ${plan}`);
  }

  return { license: record, created: true, emailResult };
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

  // Reject extreme skew (5 minutes)
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > 300) throw new Error('Webhook timestamp too old');
}

module.exports = {
  corsHeaders,
  json,
  generateLicenseKey,
  detectPlan,
  sessionEmail,
  stripeGet,
  getLicenseStore,
  readLicenseByKey,
  readLicenseBySession,
  writeLicense,
  sendLicenseEmail,
  fulfillCheckoutSession,
  verifyStripeWebhook
};
