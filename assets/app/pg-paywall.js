/* ============================================================
   PeptideGenius License Manager (Pro paywall)
   Stripe Payment Links + Netlify license fulfill/validate.
   ============================================================ */
(function (global) {
  'use strict';

  const PG_FREE_LIMITS = Object.freeze({
    peptides: 3,
    vials: 3,
    historyDays: 90
  });
  const PG_PRICING = Object.freeze({
    monthly:  { amount: 5,  period: 'month',    label: '$5/mo'    },
    yearly:   { amount: 49, period: 'year',     label: '$49/yr', badge: 'Save 18%' },
    lifetime: { amount: 79, period: 'lifetime', label: '$79 once', badge: 'Best value' }
  });
  const PG_LS_KEY  = 'pg.license.v1';
  const PG_LS_FLAG = 'pg.proStatus.v1';
  const PG_LS_TRIAL = 'pg.trial.v1';
  const STRIPE_LINKS = {
    monthly:  'https://buy.stripe.com/4gMeVe3ujdAObtv5QG5sA00',
    yearly:   'https://buy.stripe.com/8x26oI8OD7cqbtv3Iy5sA01',
    lifetime: 'https://buy.stripe.com/fZu4gA7Kz2Wa8hj7YO5sA02'
  };

  // Netlify function endpoints (same origin on peptidegenius.net)
  const PG_VALIDATE_LICENSE_URL = global.PG_VALIDATE_LICENSE_URL || '/.netlify/functions/pg-validate-license';
  const PG_FULFILL_URL = global.PG_FULFILL_URL || '/.netlify/functions/pg-fulfill';
  const PG_CREATE_CHECKOUT_URL = global.PG_CREATE_CHECKOUT_URL || '/.netlify/functions/pg-create-checkout';

  let _key = null;
  let _isPro = false;
  let _trialStartDate = null;

  function _load(){
    try {
      _key = localStorage.getItem(PG_LS_KEY) || null;
      _isPro = localStorage.getItem(PG_LS_FLAG) === '1';
      _trialStartDate = localStorage.getItem(PG_LS_TRIAL) || null;
    } catch (e) {
      _key = null; _isPro = false; _trialStartDate = null;
    }
  }
  function _persist(){
    try {
      if (_key) localStorage.setItem(PG_LS_KEY, _key);
      else localStorage.removeItem(PG_LS_KEY);
      localStorage.setItem(PG_LS_FLAG, _isPro ? '1' : '0');
      if (_trialStartDate) localStorage.setItem(PG_LS_TRIAL, _trialStartDate);
      else localStorage.removeItem(PG_LS_TRIAL);
    } catch (e) {}
  }
  function _isTrialActive(){
    if (!_trialStartDate) return false;
    const startDate = new Date(_trialStartDate);
    const now = new Date();
    const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    return daysElapsed < 30;
  }
  function _activateTrial(){
    if (!_trialStartDate) {
      _trialStartDate = new Date().toISOString();
      _isPro = true;
      _persist();
    }
  }

  async function validateKey(key){
    if (!key || key.length < 6) return { ok:false, reason:'Key too short' };
    try {
      const res = await fetch(PG_VALIDATE_LICENSE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.valid === true || data.ok === true)) {
        return { ok:true, plan: data.plan || null };
      }
      return { ok:false, reason: data.reason || data.error || 'Invalid license key.' };
    } catch (e) {
      return { ok:false, reason: 'Could not reach license server. Try again.' };
    }
  }

  function countActivePeptides(){
    const S = global.S;
    if (!S || !Array.isArray(S.inv)) return 0;
    return S.inv.filter(i => !i.isSupply && !i.isBlend && !i.archived).length;
  }
  function countActiveVials(){
    const S = global.S;
    if (!S || !Array.isArray(S.vials)) return 0;
    return S.vials.filter(v => {
      if (v.archived || v.depleted) return false;
      const peptide = (S.inv || []).find(i => i.name === v.peptideName);
      if (peptide && peptide.isSupply) return false;
      return true;
    }).length;
  }

  const PG = {
    init(){ _load(); _activateTrial(); },
    isPro(){ return _isPro || _isTrialActive(); },
    activeKey(){ return _key; },
    isTrialActive(){ return _isTrialActive(); },
    async activate(key){
      const r = await validateKey(key);
      if (r.ok){ _key = key; _isPro = true; _persist(); }
      return r;
    },
    /** Activate without server round-trip after fulfill already validated issuance */
    activateIssuedKey(key){
      if (!key) return false;
      _key = key;
      _isPro = true;
      _persist();
      return true;
    },
    deactivate(){ _key = null; _isPro = false; _persist(); },
    countActivePeptides,
    countActiveVials,
    checkPeptideLimit(){
      if (_isPro || _isTrialActive()) return true;
      return countActivePeptides() < PG_FREE_LIMITS.peptides;
    },
    checkVialLimit(){
      if (_isPro || _isTrialActive()) return true;
      return countActiveVials() < PG_FREE_LIMITS.vials;
    },
    historyCutoff(){
      if (_isPro || _isTrialActive()) return null;
      const d = new Date();
      d.setDate(d.getDate() - PG_FREE_LIMITS.historyDays);
      return d;
    },
    openUpgrade(reason){
      if (typeof global.showUpgradeModal === 'function') {
        global.showUpgradeModal(reason || 'limit');
      } else {
        console.info('[PeptideGenius] Upgrade prompt:', reason);
        alert('Upgrade to PeptideGenius Pro\n\n'
          + 'Unlimited peptides, vials, full history, and premium features.\n\n'
          + PG_PRICING.monthly.label + '   •   '
          + PG_PRICING.yearly.label + '   •   '
          + PG_PRICING.lifetime.label);
      }
    },
    async fulfillSession(sessionId){
      const res = await fetch(PG_FULFILL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.licenseKey) {
        throw new Error(data.error || 'Could not issue license key');
      }
      PG.activateIssuedKey(data.licenseKey);
      return data;
    },
    LIMITS: PG_FREE_LIMITS,
    PRICING: PG_PRICING,
    STRIPE_LINKS
  };

  global.PG = PG;
  global.PG_FREE_LIMITS = PG_FREE_LIMITS;
  global.PG_PRICING = PG_PRICING;
  global.PG_VALIDATE_LICENSE_URL = PG_VALIDATE_LICENSE_URL;
  global.PG_FULFILL_URL = PG_FULFILL_URL;
  PG.init();

  function updateTrialBanner(){
    const banner = document.getElementById('trial-banner');
    const daysSpan = document.getElementById('trial-days');
    if (!banner || !daysSpan) return;
    if (PG.isTrialActive() && !localStorage.getItem(PG_LS_KEY)) {
      const trialStart = localStorage.getItem(PG_LS_TRIAL);
      if (trialStart) {
        const startDate = new Date(trialStart);
        const now = new Date();
        const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, 30 - daysElapsed);
        daysSpan.textContent = daysLeft;
        banner.style.display = 'block';
      }
    } else {
      banner.style.display = 'none';
    }
  }

  global.showUpgradeModal = function showUpgradeModal(reason) {
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    modal.dataset.triggerReason = reason || 'unknown';
  };
  global.hideUpgradeModal = function hideUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  function wireModal(){
    const modal = document.getElementById('upgrade-modal');
    if (!modal || modal.__pgWired) return;
    modal.__pgWired = true;

    const closeBtn = document.getElementById('upgrade-close');
    if (closeBtn) closeBtn.addEventListener('click', global.hideUpgradeModal);
    modal.addEventListener('click', function(e){
      if (e.target === modal) global.hideUpgradeModal();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        global.hideUpgradeModal();
      }
    });

    async function startCheckout(plan){
      const email = window.prompt('Enter the email for your license key receipt:');
      if (email === null) return; // cancelled
      const trimmed = String(email || '').trim();
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        alert('Please enter a valid email address.');
        return;
      }
      try {
        const res = await fetch(PG_CREATE_CHECKOUT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: plan || 'yearly', email: trimmed || undefined })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Could not start checkout');
        }
        window.location.href = data.url;
      } catch (err) {
        // Fallback to Payment Link only if checkout API is unavailable
        const link = STRIPE_LINKS[plan];
        if (link && /STRIPE_SECRET_KEY|not configured/i.test(String(err.message || ''))) {
          alert('Checkout is almost ready — Stripe secret key still needs to be added in Netlify. Opening payment page for now (license key auto-issue needs the secret key).');
          window.open(link, '_blank');
          return;
        }
        alert('Checkout error: ' + (err.message || err));
      }
    }

    document.querySelectorAll('[data-plan-btn]').forEach(btn => {
      btn.addEventListener('click', function(){
        const plan = this.getAttribute('data-plan-btn');
        global._selectedUpgradePlan = plan;
        document.querySelectorAll('[data-plan-btn]').forEach(b => { b.style.opacity = '0.7'; });
        this.style.opacity = '1';
        startCheckout(plan);
      });
    });

    const restoreBtn = document.getElementById('restore-license-btn');
    const keyInput = document.getElementById('license-key-input');
    if (restoreBtn && keyInput) {
      restoreBtn.addEventListener('click', async function(){
        const key = keyInput.value.trim();
        if (!key) { alert('Please enter a license key.'); return; }
        restoreBtn.disabled = true;
        try {
          const result = await PG.activate(key);
          if (result.ok) {
            alert('✓ License activated! Pro features are now unlocked.');
            global.hideUpgradeModal();
            updateTrialBanner();
            if (typeof global.refreshAppState === 'function') global.refreshAppState();
            else if (typeof global.rr === 'function') global.rr();
          } else {
            alert('✗ ' + (result.reason || 'Invalid license key.'));
          }
        } finally {
          restoreBtn.disabled = false;
        }
      });
    }

    const purchaseBtn = document.getElementById('upgrade-purchase-btn');
    if (purchaseBtn) {
      purchaseBtn.addEventListener('click', function(){
        const plan = global._selectedUpgradePlan || 'yearly';
        startCheckout(plan);
      });
    }

    const openBtn = document.getElementById('pg-open-upgrade');
    if (openBtn) openBtn.addEventListener('click', function(){ PG.openUpgrade('header'); });
  }

  async function handleCheckoutReturn(){
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || params.get('sessionId');
    const status = params.get('status') || params.get('payment');

    if (sessionId && String(sessionId).startsWith('cs_')) {
      try {
        const data = await PG.fulfillSession(sessionId);
        alert(
          '✓ Payment confirmed!\n\nYour license key:\n' + data.licenseKey +
          '\n\nPro is unlocked on this device. Save this key — Restore it anytime from the Pro dialog.' +
          (data.emailSent ? '\n\nA copy was emailed to ' + (data.email || 'you') + '.' : '\n\nSave this key now (email copy sends when SendGrid is configured).')
        );
        updateTrialBanner();
        if (typeof global.refreshAppState === 'function') global.refreshAppState();
        else if (typeof global.rr === 'function') global.rr();
      } catch (e) {
        alert('Payment received, but license issue failed: ' + (e.message || e) + '\n\nEmail PeptideGenius@gmail.com with your Stripe receipt.');
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (status === 'success') {
      alert('✓ Payment successful! Your license key should appear automatically after checkout. If it did not, email PeptideGenius@gmail.com with your receipt.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === 'cancel') {
      alert('Payment cancelled. You can try again anytime.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  onReady(function(){
    wireModal();
    updateTrialBanner();
  });

  window.addEventListener('load', function(){
    handleCheckoutReturn();
  });
})(typeof window !== 'undefined' ? window : globalThis);
