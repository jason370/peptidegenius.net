/* ============================================================
   PeptideGenius License Manager (Pro paywall)
   Ported from peptide_genius.html — keep in sync with Firebase
   checkout / validateLicense when wiring live validation.
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
    // Prefer Firebase validateLicense when configured; otherwise keep stub.
    const endpoint = global.PG_VALIDATE_LICENSE_URL;
    if (endpoint) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey: key })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && (data.valid === true || data.ok === true)) {
          return { ok:true };
        }
        return { ok:false, reason: data.reason || data.error || 'Invalid license key.' };
      } catch (e) {
        return { ok:false, reason: 'Could not reach license server. Try again.' };
      }
    }
    return { ok:false, reason:'Payment system coming soon. Stay tuned!' };
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
    LIMITS: PG_FREE_LIMITS,
    PRICING: PG_PRICING,
    STRIPE_LINKS
  };

  global.PG = PG;
  global.PG_FREE_LIMITS = PG_FREE_LIMITS;
  global.PG_PRICING = PG_PRICING;
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

    document.querySelectorAll('[data-plan-btn]').forEach(btn => {
      btn.addEventListener('click', function(){
        const plan = this.getAttribute('data-plan-btn');
        global._selectedUpgradePlan = plan;
        document.querySelectorAll('[data-plan-btn]').forEach(b => { b.style.opacity = '0.7'; });
        this.style.opacity = '1';
        const link = STRIPE_LINKS[plan];
        if (link) window.open(link, '_blank');
        else alert('Plan not found. Please email PeptideGenius@gmail.com for help.');
      });
    });

    const restoreBtn = document.getElementById('restore-license-btn');
    const keyInput = document.getElementById('license-key-input');
    if (restoreBtn && keyInput) {
      restoreBtn.addEventListener('click', async function(){
        const key = keyInput.value.trim();
        if (!key) { alert('Please enter a license key.'); return; }
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
      });
    }

    const purchaseBtn = document.getElementById('upgrade-purchase-btn');
    if (purchaseBtn) {
      purchaseBtn.addEventListener('click', function(){
        const plan = global._selectedUpgradePlan || 'yearly';
        window.open(STRIPE_LINKS[plan] || STRIPE_LINKS.monthly, '_blank');
      });
    }

    const openBtn = document.getElementById('pg-open-upgrade');
    if (openBtn) openBtn.addEventListener('click', function(){ PG.openUpgrade('header'); });
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
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success' || params.get('status') === 'success') {
      alert('✓ Payment successful! Check your email for your license key.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('payment') === 'cancel') {
      alert('Payment cancelled. You can try again anytime.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
