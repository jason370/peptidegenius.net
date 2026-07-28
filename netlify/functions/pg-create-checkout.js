/**
 * Create a Stripe Checkout Session for PeptideGenius Pro.
 * Success URL always includes session_id so the site can generate a license key.
 *
 * POST { plan: 'monthly'|'yearly'|'lifetime', email?: string }
 */
const { json, corsHeaders } = require('../lib/pg-license');

const PLANS = {
  monthly: {
    mode: 'subscription',
    name: 'PeptideGenius Pro — Monthly',
    unit_amount: 500,
    interval: 'month'
  },
  yearly: {
    mode: 'subscription',
    name: 'PeptideGenius Pro — Yearly',
    unit_amount: 4900,
    interval: 'year'
  },
  lifetime: {
    mode: 'payment',
    name: 'PeptideGenius Pro — Lifetime',
    unit_amount: 7900
  }
};

async function stripeFormPost(path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw Object.assign(new Error('STRIPE_SECRET_KEY is not configured in Netlify env'), { status: 500 });
  }
  const body = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    body.append(k, String(v));
  });
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Stripe error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const plan = String(body.plan || '').trim().toLowerCase();
    const email = String(body.email || '').trim();
    const cfg = PLANS[plan];
    if (!cfg) {
      return json(400, { ok: false, error: 'Invalid plan. Use monthly, yearly, or lifetime.' });
    }

    const origin = (
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      'https://peptidegenius.net'
    ).replace(/\/+$/, '');

    const params = {
      'mode': cfg.mode,
      'success_url': `${origin}/?session_id={CHECKOUT_SESSION_ID}&status=success`,
      'cancel_url': `${origin}/?status=cancel`,
      'client_reference_id': plan,
      'metadata[plan]': plan,
      'metadata[product]': 'peptidegenius-pro',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': cfg.name,
      'line_items[0][price_data][product_data][description]':
        'Unlimited peptides, vials, full history, and Pro features',
      'line_items[0][price_data][unit_amount]': String(cfg.unit_amount)
    };

    if (cfg.mode === 'subscription') {
      params['line_items[0][price_data][recurring][interval]'] = cfg.interval;
    }
    if (email) {
      params.customer_email = email;
      params['metadata[email]'] = email;
    }

    const session = await stripeFormPost('checkout/sessions', params);
    return json(200, {
      ok: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (err) {
    console.error('[pg-create-checkout]', err);
    return json(err.status || 500, { ok: false, error: err.message || 'Checkout failed' });
  }
};
