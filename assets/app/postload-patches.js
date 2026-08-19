// PeptideGenius post-core patch runtime

// ── Mutation-quiet guard (freeze fix, 20260706) ──────────────────────────────
// Several patches below watch #ap (and document.body) with MutationObservers
// whose delayed callbacks THEMSELVES mutate the observed DOM (fill selects,
// clone buttons, rewrite labels). Each callback's mutations re-woke every other
// observer, which re-scheduled more mutating callbacks — an unbounded
// observer↔timeout livelock that froze the page (reproduced live: 10,000+
// cycles in seconds, page unresponsive for minutes). Fix: observer-triggered
// work runs through __tmpMoQuiet.run(); while inside it (and through the
// microtask window after), observers treat mutations as self-inflicted and
// skip rescheduling. Direct click-handler wiring paths bypass the guard, so
// user-driven refreshes still work exactly as before.
(function(){
  if (window.__tmpMoQuiet) return;
  window.__tmpMoQuiet = {
    depth: 0,
    run: function(fn){ this.depth++; var s = this; try { fn(); } finally { setTimeout(function(){ s.depth--; }, 0); } },
    active: function(){ return this.depth > 0; }
  };
})();

function __tmpVendorLogActive(){return !!document.getElementById('vpr-tbody');}
// RX-NAME-TYPO-R1: single-character-typo tolerance (edit distance ≤1) for
// normalized names ≥6 chars — e.g. "tadalifil" ↔ "tadalafil". Used alongside
// the RX-NAME-PREFIX-R1 prefix match wherever calendar names are compared to
// Rx med names. The ≥6 guard keeps short abbreviations ("fin"/"min") from
// cross-matching each other.
window.__pgRxNearMatch = function(a, b){
  a = String(a == null ? '' : a); b = String(b == null ? '' : b);
  if(a.length < 6 || b.length < 6) return false;
  if(Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while(i < a.length && j < b.length){
    if(a[i] === b[j]){ i++; j++; continue; }
    if(++edits > 1) return false;
    if(a.length > b.length) i++; else if(b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};
// PERF-P2: single renderCal hook — core reference captured before any patch wraps it.
window.__tmpRenderCalCore = window.renderCal;
window.__tmpRenderCalPre = window.__tmpRenderCalPre || [];
window.__tmpRenderCalPost = window.__tmpRenderCalPost || [];
function __tmpRegisterRenderCalPre(fn){ if(typeof fn==='function') window.__tmpRenderCalPre.push(fn); }
function __tmpRegisterRenderCalPost(fn){ if(typeof fn==='function') window.__tmpRenderCalPost.push(fn); }
window.__tmpRenderCalPostFlush = null;
function __tmpScheduleRenderCalPostFlush(){
  if(window.__tmpRenderCalPostFlush) return;
  window.__tmpRenderCalPostFlush = setTimeout(function(){
    window.__tmpRenderCalPostFlush = null;
    (window.__tmpRenderCalPost || []).forEach(function(fn){ try{fn();}catch(_){} });
  }, 20);
}
function __tmpInstallUnifiedRenderCalHook(){
  if(window.__tmpUnifiedRenderCalInstalled) return;
  const core = window.__tmpRenderCalCore;
  if(typeof core !== 'function') return;
  window.renderCal = function(){
    (window.__tmpRenderCalPre || []).forEach(function(fn){ try{fn();}catch(_){} });
    const r = core.apply(this, arguments);
    __tmpScheduleRenderCalPostFlush();
    return r;
  };
  window.renderCal.__tmpUnifiedCalHook = true;
  window.__tmpUnifiedRenderCalInstalled = true;
}
// PERF-P1: background intervals only tick when the tab is visible and the target page is shown.
function __tmpDocVisible(){try{return document.visibilityState!=='hidden';}catch(_){return true;}}
function __tmpPgVisible(id){var el=document.getElementById(id);return !!(el&&el.style.display!=='none');}
function __tmpPgAnyVisible(ids){for(var i=0;i<ids.length;i++) if(__tmpPgVisible(ids[i])) return true;return false;}
function __tmpPgInterval(fn,ms,gate){
  setInterval(function(){
    if(!__tmpDocVisible()) return;
    if(gate==='doc'){fn();return;}
    if(typeof gate==='string'){if(__tmpPgVisible(gate)) fn();return;}
    if(Array.isArray(gate)){if(__tmpPgAnyVisible(gate)) fn();return;}
    fn();
  },ms);
}
// Stack Builder labels — Unicode escapes avoid mojibake in this bundle.
window.__tmpSbGoalIcons={
  fat:'\u2696\uFE0F',
  recovery:'\u{1F6E0}\uFE0F',
  sleep:'\u{1F319}',
  muscle:'\u{1F4AA}',
  metabolic:'\u{1F4C8}',
  simplicity:'\u{1F9F3}'
};
window.__tmpSbMealLanes={
  breakfast:'\u{1F373} Breakfast (6\u20139)',
  lunch:'\u{1F957} Lunch (10\u20132)',
  dinner:'\u{1F37D}\uFE0F Dinner (5\u20138)',
  bedtime:'\u{1F319} Bedtime (9\u201312)'
};
window.__tmpSbMealLanesPlain={
  breakfast:'Breakfast (6\u20139)',
  lunch:'Lunch (10\u20132)',
  dinner:'Dinner (5\u20138)',
  bedtime:'Bedtime (9\u201312)'
};
window.__tmpSbGlyphs={check:'\u2713',arrow:'\u2192',flow:'\u21B3',times:'\u00D7',dot:'\u00B7',undo:'\u21A9'};
window.__tmpDailyGlyphs={dot:'\u00B7',arrow:'\u2192',inventory:'\u25A3',vitamins:'\u25CF',titration:'\u2197',packages:'\u2301',rotation:'\u233E'};
window.__tmpCalGlyphs={collapseOpen:'\u25BE',collapseClosed:'\u25B8'};
window.__tmpCalLockBannerMsg='Calendar clear lock \u2014 only peptides you add via Inventory or Peptide Manager will appear on the calendar.';
window.__tmpCalClearedToastPrefix='Calendar was cleared \u2014 use Load from inventory or Peptide Manager to re-add ';
// Debounce page-scoped follow-up renders (daily stack overlays, etc.).
window.__tmpPgDebounceTimers=window.__tmpPgDebounceTimers||{};
window.__tmpPgDebounced=function(key,fn,ms){
  if(window.__tmpPgDebounceTimers[key])return;
  window.__tmpPgDebounceTimers[key]=setTimeout(function(){
    window.__tmpPgDebounceTimers[key]=null;
    try{fn();}catch(_){}
  },ms==null?80:ms);
};
// ===== extracted post-core patch script =====
(function(){
  if (window.tmpConfirmTwice) return;

  // Resolve the element whose textContent we change for state transitions.
  // Some buttons (rotation-reset-btn) have an inner .rr-label span next to
  // an SVG icon — for those we update the span only so the icon stays put.
  function labelEl(btn){
    return btn.querySelector('.rr-label, [data-tmp-label]') || btn;
  }
  function setLabel(btn, text){
    const el = labelEl(btn);
    el.textContent = text;
  }

  const _G = window.__tmpSbGlyphs || {check:'\u2713', dot:'\u00B7', undo:'\u21A9'};

  // Generic click-twice + undo helper.
  // opts:
  //   confirmLabel:  'Click again to confirm \u00b7 cancel in 5s'
  //   undoLabel:     fn(count) => '\u21a9 Click to undo'  (v5: persistent — no auto-finalize)
  //   timeoutMs:     5000
  //   doneLabel:     fn(count) => '\u2713 Cleared 12'
  //   emptyCheck:    fn() => bool
  //   emptyLabel:    '\u2713 Already empty'
  //   snapshot:      fn() => snapshot   (for undo)
  //   restore:       fn(snapshot)       (for undo)
  //   action:        fn() => count
  //   refresh:       fn()  (defaults to tmpRefreshAll)
  function tmpConfirmTwice(btnId, opts){
    const btn = document.getElementById(btnId);
    if (!btn || btn.__tmpArmed) return;
    btn.__tmpArmed = true;
    const original = labelEl(btn).textContent;
    const confirmLabel = opts.confirmLabel || ('Click again to confirm ' + _G.dot + ' cancel in 5s');
    const timeoutMs    = opts.timeoutMs    || 5000;

    let state='idle', timer=null, snap=null, lastCount=0;

    function dismissUndo(){
      if (timer){ clearTimeout(timer); timer=null; }
      try { localStorage.removeItem('tmp.undo.'+btnId); } catch(_){}
      state = 'idle';
      snap = null;
      btn.classList.remove('undoable','tmp-rehydrated','confirming','done');
      btn.removeAttribute('aria-pressed');
      setLabel(btn, original);
      try { if (typeof tmpRefreshUndock === 'function') tmpRefreshUndock(); } catch(_){}
    }
    btn.__tmpDismissUndo = dismissUndo;

    const toIdle = () => {
      state='idle';
      btn.classList.remove('confirming','done','undoable');
      btn.removeAttribute('aria-pressed');
      setLabel(btn, original);
      snap = null;
    };
    const finalize = () => {
      // After undoable timeout: change is permanent. Show done briefly, then idle.
      state='done';
      btn.classList.remove('undoable');
      btn.classList.add('done');
      setLabel(btn, opts.doneLabel ? opts.doneLabel(lastCount) : (_G.check + ' Cleared '+lastCount));
      setTimeout(toIdle, 1500);
      snap = null;
    };

    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      if (state === 'done') return;

      if (state === 'idle'){
        try { localStorage.removeItem('tmp.undo.'+btnId); } catch(_){}
        btn.classList.remove('undoable','tmp-rehydrated');
        try {
          if (opts.emptyCheck && opts.emptyCheck()){
            state='done';
            btn.classList.add('done');
            setLabel(btn, opts.emptyLabel || (_G.check + ' Already empty'));
            setTimeout(toIdle, 1400);
            return;
          }
        } catch(err){ console.error(err); }
        state='confirming';
        btn.classList.add('confirming');
        btn.setAttribute('aria-pressed','true');
        setLabel(btn, confirmLabel);
        timer = setTimeout(toIdle, timeoutMs);
        return;
      }

      if (state === 'confirming'){
        if (timer){ clearTimeout(timer); timer=null; }
        try { snap = opts.snapshot ? opts.snapshot() : null; } catch(err){ console.error('snapshot failed:', err); snap=null; }
        let count = 0;
        try { count = opts.action() || 0; }
        catch(err){ console.error('action failed:', err); toIdle(); return; }
        try { if (typeof save === 'function') save(); } catch(_){}
        try { if (opts.refresh) opts.refresh(); else if (typeof tmpRefreshAll === 'function') tmpRefreshAll(); } catch(_){}
        lastCount = count;
        btn.classList.remove('confirming');
        if (btnId === 'tmp-clear-cal'){
          try { localStorage.removeItem('tmp.undo.tmp-clear-cal'); } catch(_){}
          state = 'done';
          btn.classList.remove('confirming');
          btn.classList.add('done');
          setLabel(btn, opts.doneLabel ? opts.doneLabel(lastCount) : (_G.check + ' Cleared '+lastCount));
          setTimeout(toIdle, 1500);
          snap = null;
        } else if (snap !== null && opts.restore){
          try {
            const k='tmp.undo.'+btnId;
            localStorage.setItem(k, JSON.stringify({
              snap, count, ts: Date.now(),
              originalLabel: original
            }));
            try { if (typeof tmpRefreshUndock === 'function') tmpRefreshUndock(); } catch(_){}
          } catch(_){}
          if (btnId !== 'tmp-clear-cal' && opts.undoViaUndockOnly){
            state = 'done';
            btn.classList.add('done');
            setLabel(btn, opts.doneLabel ? opts.doneLabel(lastCount) : (_G.check + ' Cleared '+lastCount));
            setTimeout(toIdle, 1500);
            snap = null;
          } else if (btnId !== 'tmp-clear-cal') {
            state='undoable';
            btn.classList.add('undoable');
            const undoText = opts.undoLabel ? opts.undoLabel(count) : (_G.undo + ' Click to undo');
            setLabel(btn, undoText);
          } else {
            state = 'done';
            btn.classList.add('done');
            setLabel(btn, opts.doneLabel ? opts.doneLabel(lastCount) : (_G.check + ' Cleared '+lastCount));
            setTimeout(toIdle, 1500);
            snap = null;
          }
        } else {
          state='done';
          btn.classList.add('done');
          setLabel(btn, opts.doneLabel ? opts.doneLabel(count) : (_G.check + ' Cleared '+count));
          setTimeout(toIdle, 1700);
        }
        return;
      }

      if (state === 'undoable'){
        if (timer){ clearTimeout(timer); timer=null; }
        // Calendar clear: undo only via the undock bar — never restore from this button.
        if (opts.undoViaUndockOnly){
          dismissUndo();
          btn.classList.add('done');
          state = 'done';
          setLabel(btn, opts.doneLabel ? opts.doneLabel(lastCount) : (_G.check + ' Cleared '+lastCount));
          setTimeout(toIdle, 1500);
          snap = null;
          return;
        }
        // Calendar has items again — discard stale undo and start a fresh clear.
        try {
          if (opts.emptyCheck && opts.emptyCheck()){
            dismissUndo();
            btn.classList.add('done');
            state = 'done';
            setLabel(btn, opts.doneLabel ? opts.doneLabel(lastCount) : (_G.check + ' Cleared '+lastCount));
            setTimeout(toIdle, 1500);
            snap = null;
            return;
          }
          if (opts.emptyCheck && !opts.emptyCheck()){
            dismissUndo();
            state = 'confirming';
            btn.classList.add('confirming');
            btn.setAttribute('aria-pressed','true');
            setLabel(btn, confirmLabel);
            timer = setTimeout(toIdle, timeoutMs);
            return;
          }
        } catch(_){}
        const proceed = confirm(
          'Restore the calendar from before you cleared it?\n\nAny changes you have made since that clear will be lost.'
        );
        if (!proceed) return;
        try { opts.restore(snap, { fromUndo: true }); } catch(err){ console.error('restore failed:', err); }
        try { if (typeof save === 'function') save(); } catch(_){}
        try { if (opts.refresh) opts.refresh(); else if (typeof tmpRefreshAll === 'function') tmpRefreshAll(); } catch(_){}
        try { localStorage.removeItem('tmp.undo.'+btnId); } catch(_){}
        btn.classList.remove('undoable');
        btn.classList.add('done');
        state='done';
        setLabel(btn, _G.check + ' Restored');
        try { if (typeof tmpRefreshUndock === 'function') tmpRefreshUndock(); } catch(_){}
        setTimeout(toIdle, 1500);
        snap = null;
        return;
      }
    });
  }
  window.tmpConfirmTwice = tmpConfirmTwice;

  function tmpDismissUndo(btnId){
    const btn = document.getElementById(btnId);
    try { localStorage.removeItem('tmp.undo.'+btnId); } catch(_){}
    if (btn && typeof btn.__tmpDismissUndo === 'function'){
      btn.__tmpDismissUndo();
      return;
    }
    if (btn){
      btn.classList.remove('undoable','tmp-rehydrated','confirming','done');
      btn.removeAttribute('aria-pressed');
      const lbl = btn.querySelector('.rr-label, [data-tmp-label]') || btn;
      lbl.textContent = lbl.textContent.indexOf('Undo') >= 0 ? 'Clear weekly calendar' : lbl.textContent;
    }
    try { if (typeof tmpRefreshUndock === 'function') tmpRefreshUndock(); } catch(_){}
  }
  window.tmpDismissUndo = tmpDismissUndo;

  function maybeDismissCalendarUndoAfterEdit(){
    try {
      if (!localStorage.getItem('tmp.undo.tmp-clear-cal')) return;
      const n = Object.keys((window.S && S.sched) || {}).filter(k => S.sched[k]).length;
      if (n > 0) tmpDismissUndo('tmp-clear-cal');
    } catch(_){}
  }
  // Save-chain merge: registered as a post-flush hook instead of re-wrapping
  // window.save (old pattern stacked 8 wrappers deep and ran on every call).
  (window.__tmpSavePost=window.__tmpSavePost||[]).push(maybeDismissCalendarUndoAfterEdit);

  // Refresh every render-* view we know about. Some functions may not exist
  // (different versions of TMP), so each call is wrapped in try/catch.
  function refreshAll(){
    [
      'render','renderAll','renderHero','rebuildCM','buildLegend',
      'renderLog','renderRotation','renderInv','renderPackages',
      'renderVendors','renderPrices','renderProtocols','renderCal',
      'updateStack','autofillShotLogForPep','rebuildLog','drawCalendar',
      'rebuildSupplies','rebuildVials','rr','renderStats','renderStack',
      'renderVials','renderSupplyTiles','renderIntervalDoses',
      'tmpRenderInsights',  // v9
      'tmpRenderCirculationTable',  // v14b
      'tmpRenderCirculationChart'  // v14c
    ].forEach(fn => { try { if (typeof window[fn] === 'function') window[fn](); } catch(_){} });
  }
  window.tmpRefreshAll = refreshAll;

  function clone(x){ return JSON.parse(JSON.stringify(x)); }

  const CAL_CLEAR_KEY = 'tmp.calClearEpoch';
  const CAL_ALLOWED_KEY = 'tmp.calClearAllowed.v1';
  const __TMP_SCHED_GUARD = new WeakMap();
  window.tmpCalClearGuard = {
    _blockToastTimer: null,
    normName(name){
      return String(name || '').trim().toLowerCase();
    },
    isActive(){
      try { return !!localStorage.getItem(CAL_CLEAR_KEY); } catch(_){ return false; }
    },
    mark(){
      try { localStorage.setItem(CAL_CLEAR_KEY, String(Date.now())); } catch(_){}
    },
    clear(){
      try { localStorage.removeItem(CAL_CLEAR_KEY); localStorage.removeItem(CAL_ALLOWED_KEY); } catch(_){}
      try { if (window.S) S.__tmpSchedGuardWrapped = false; } catch(_){}
      this._clearSchedBlockFlag();
      try { this.updateLockBanner(); } catch(_){}
    },
    resetAllowed(){
      try { localStorage.setItem(CAL_ALLOWED_KEY, '[]'); } catch(_){}
    },
    getAllowed(){
      try {
        const arr = JSON.parse(localStorage.getItem(CAL_ALLOWED_KEY) || '[]');
        return new Set((Array.isArray(arr) ? arr : []).filter(Boolean).map(n => this.normName(n)));
      } catch(_){ return new Set(); }
    },
    // RX-CAL-KEEP-R1: Rx meds (S.rx) are managed by the Rx card, not peptide
    // inventory — never block or prune their calendar cells.
    isRxName(name){
      const n = this.normName(name);
      if(!n) return false;
      // RX-NAME-PREFIX-R1: exact OR ≥3-char prefix match in either direction
      // ("Fin" ↔ "Finasteride").
      // RX-NAME-TYPO-R1: plus single-typo tolerance for names ≥6 chars
      // ("Tadalifil" ↔ "Tadalafil").
      try {
        return ((window.S && S.rx) || []).some(r => {
          if(!r) return false;
          const rn = this.normName(r.name);
          return !!rn && (rn === n || (rn.length >= 3 && n.length >= 3 && (rn.startsWith(n) || n.startsWith(rn))) || (window.__pgRxNearMatch && __pgRxNearMatch(rn, n)));
        });
      } catch(_){ return false; }
    },
    isAllowedName(name){
      return this.getAllowed().has(this.normName(name)) || this.isRxName(name);
    },
    allowName(name){
      const n = this.normName(name);
      if(!n || !this.isActive()) return;
      const set = this.getAllowed();
      if(set.has(n)) return;
      set.add(n);
      try { localStorage.setItem(CAL_ALLOWED_KEY, JSON.stringify([...set])); } catch(_){}
      this._clearSchedBlockFlag();
    },
    allowSchedNames(names){
      if(!this.isActive()) return;
      const list = Array.isArray(names) ? names : [names];
      list.forEach(n => { if(n) this.allowName(n); });
    },
    _clearSchedBlockFlag(){
      try { delete window._tmpSchedGuardBlocked; } catch(_){}
      if(this._blockToastTimer){ clearTimeout(this._blockToastTimer); this._blockToastTimer = null; }
    },
    _notifySchedBlock(name, key){
      if(!this.isActive()) return;
      const display = String(name || '').trim() || 'peptide';
      window._tmpSchedGuardBlocked = { name: display, key: String(key || '') };
      const self = this;
      if(self._blockToastTimer) clearTimeout(self._blockToastTimer);
      self._blockToastTimer = setTimeout(function(){
        try {
          if(!self.isActive() || !window._tmpSchedGuardBlocked) return;
          const nm = window._tmpSchedGuardBlocked.name || 'peptide';
          if(typeof window.tmpInventoryToast === 'function'){
            window.tmpInventoryToast(
              (window.__tmpCalClearedToastPrefix || 'Calendar was cleared \u2014 use Load from inventory or Peptide Manager to re-add ') + nm,
              'amber'
            );
          }
        } catch(_){}
      }, 150);
    },
    updateLockBanner(){
      const host = document.getElementById('pg-calendar');
      if(!host) return;
      let el = document.getElementById('tmp-cal-clear-lock-banner');
      if(!this.isActive()){
        if(el) el.remove();
        return;
      }
      if(!el){
        el = document.createElement('div');
        el.id = 'tmp-cal-clear-lock-banner';
        el.setAttribute('role', 'status');
        el.style.cssText = 'margin:0 0 10px;padding:9px 12px;border-radius:8px;font-size:12px;line-height:1.45;color:#92400E;background:linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%);border:.5px solid #FCD34D';
        const wkn = host.querySelector('.wkn');
        if(wkn && wkn.parentNode) wkn.parentNode.insertBefore(el, wkn);
        else host.insertBefore(el, host.firstChild);
      }
      el.textContent = window.__tmpCalLockBannerMsg || 'Calendar clear lock \u2014 only peptides you add via Inventory or Peptide Manager will appear on the calendar.';
    },
    isSchedGuarded(sched){
      return !!(sched && typeof sched === 'object' && __TMP_SCHED_GUARD.has(sched));
    },
    plainSched(v){
      if(!v || typeof v !== 'object') return {};
      try { return JSON.parse(JSON.stringify(v)); } catch(_){ return Object.assign(Object.create(null), v); }
    },
    createGuardedSched(initial){
      const self = this;
      const target = Object.assign(Object.create(null), initial || {});
      const proxy = new Proxy(target, {
        set(t, prop, val){
          if(val && self.isActive()){
            const pepName = String(prop).split('/')[0];
            const name = self.normName(pepName);
            if(!self.getAllowed().has(name) && !self.isRxName(name)){
              self._notifySchedBlock(pepName, String(prop));
              return true;
            }
            self._clearSchedBlockFlag();
          }
          t[prop] = val;
          return true;
        },
        deleteProperty(t, prop){
          delete t[prop];
          return true;
        }
      });
      __TMP_SCHED_GUARD.set(proxy, true);
      return proxy;
    },
    installSchedPropertyGuard(){
      if(!window.S || S.__schedPropGuard) return;
      let _sched = S.sched || {};
      const self = this;
      Object.defineProperty(S, 'sched', {
        get(){ return _sched; },
        set(v){
          const plain = self.plainSched(v);
          if(self.isActive()){
            _sched = self.isSchedGuarded(v) ? v : self.createGuardedSched(plain);
            S.__tmpSchedGuardWrapped = true;
            self._pruneSchedInPlace(_sched);
          } else {
            _sched = plain;
            S.__tmpSchedGuardWrapped = false;
          }
        },
        configurable: true,
        enumerable: true
      });
      S.__schedPropGuard = true;
      if(self.isActive()){
        if(!self.isSchedGuarded(_sched)){
          _sched = self.createGuardedSched(self.plainSched(_sched));
        }
        self._pruneSchedInPlace(_sched);
      }
    },
    installGuardedSched(){
      if(!this.isActive() || !window.S) return;
      if(S.__schedPropGuard){
        this._pruneSchedInPlace(S.sched);
        return;
      }
      if(this.isSchedGuarded(S.sched)){
        this._pruneSchedInPlace(S.sched);
        return;
      }
      S.sched = this.createGuardedSched(this.plainSched(S.sched));
      S.__tmpSchedGuardWrapped = true;
    },
    _pruneSchedInPlace(sched, opts){
      if(!this.isActive() || !window.S || !sched) return 0;
      const allowed = this.getAllowed();
      let n = 0;
      Object.keys(sched).forEach(k => {
        if(!sched[k]) return;
        const name = this.normName(k.split('/')[0]);
        if(!allowed.has(name) && !this.isRxName(name)){ delete sched[k]; n++; }
      });
      if(opts && opts.clearPlan) this._clearStackPlanStore();
      return n;
    },
    _clearStackPlanStore(){
      try {
        if(window.S) S.stackPlan = [];
        localStorage.setItem('tmp.stackPlan.v1', '[]');
      } catch(_){}
    },
    enforceLight(){
      if(!this.isActive() || !window.S) return;
      this.installSchedPropertyGuard();
      this.installGuardedSched();
      this._pruneSchedInPlace(S.sched);
    },
    enforce(){
      if(!this.isActive() || !window.S) return;
      this.enforceLight();
      this._clearStackPlanStore();
      try { this.updateLockBanner(); } catch(_){}
    },
    filterPlanForClearGuard(plan){
      if(!this.isActive()) return plan || [];
      return (plan || []).filter(p => p && p.name && this.isAllowedName(p.name));
    },
    planForCalendar(plan){
      if (this.isActive()) return [];
      return plan || [];
    },
    pruneSched(){
      if(!this.isActive() || !window.S) return 0;
      return this._pruneSchedInPlace(S.sched);
    },
    releaseForExplicitPlan(plan){
      if((plan||[]).length) this.clear();
    },
    hardResetSched(){
      if(!window.S) return;
      const self = this;
      const wrapActive = self.isActive();
      const empty = Object.create(null);
      window._tmpBypassCalEnforce = true;
      try {
        try { if(S.__schedPropGuard) delete S.__schedPropGuard; } catch(_){}
        try { delete S.__tmpSchedGuardWrapped; } catch(_){}
        const next = wrapActive ? self.createGuardedSched(empty) : empty;
        try {
          Object.defineProperty(S, 'sched', {
            value: next,
            writable: true,
            configurable: true,
            enumerable: true
          });
        } catch(_){
          S.sched = next;
        }
        if(wrapActive) self.installSchedPropertyGuard();
      } finally {
        window._tmpBypassCalEnforce = false;
      }
    },
    suppressIntervalOccurrences(){
      if(!window.S) return;
      window._tmpBypassCalEnforce = true;
      try {
        if(!S.sched) S.sched = Object.create(null);
        (S.inv || []).forEach(it => {
          if(!it || it.isSupply || !(it.interval > 0)) return;
          for(let d = 0; d < 7; d++){
            try { S.sched[it.name + '/am/' + d] = false; } catch(_){}
          }
        });
      } finally {
        window._tmpBypassCalEnforce = false;
      }
    },
    deleteAllSchedKeyVariants(){
      if(!window.S || !S.sched) return;
      const lanes = ['am', 'pm', 'breakfast', 'lunch', 'dinner', 'bedtime'];
      window._tmpBypassCalEnforce = true;
      try {
        Object.keys(S.sched).forEach(k => { try { delete S.sched[k]; } catch(_){} });
        (S.inv || []).forEach(it => {
          if(!it || !it.name || it.isSupply) return;
          for(let d = 0; d < 7; d++){
            lanes.forEach(l => {
              try { delete S.sched[it.name + '/' + l + '/' + d]; } catch(_){}
            });
          }
        });
      } finally {
        window._tmpBypassCalEnforce = false;
      }
    }
  };

  function hookCalClearPrune(){
    function enforceCalClearGuard(){
      try {
        if(window._tmpBypassCalEnforce) return;
        const pg=document.querySelector('#nav button.on, .hdr-tab-btn.on');
        if(pg&&pg.dataset.pg==='packages') return;
        if(!window.tmpCalClearGuard) return;
        // Stale lock + persisted slots: clear lock instead of wiping calendar.
        if(tmpCalClearGuard.isActive() && window.S){
          try {
            const has = Object.keys(S.sched || {}).some(function(k){
              const v = S.sched[k];
              return v === true || (v && typeof v === 'object');
            });
            if(has){ tmpCalClearGuard.clear(); return; }
          } catch(_){}
        }
        tmpCalClearGuard.enforceLight();
      } catch(_){}
    }
    // Save-chain merge: pre-flush hook instead of wrapping window.save.
    (window.__tmpSavePre=window.__tmpSavePre||[]).push(enforceCalClearGuard);
    __tmpRegisterRenderCalPre(function(){
      enforceCalClearGuard();
      try { if(window.tmpCalClearGuard) tmpCalClearGuard.updateLockBanner(); } catch(_){}
    });
  }
  hookCalClearPrune();

  // Drop any persisted calendar-clear undo on every load — it restores the full
  // pre-clear calendar (the #1 repopulate bug) and must never survive reload.
  try { localStorage.removeItem('tmp.undo.tmp-clear-cal'); } catch(_){}

  // If a schedule is already persisted but the clear-lock flag is still set,
  // the lock is stale (e.g. after a full JSON import that was pruned on save).
  // Prefer the saved calendar over wiping it on every page load / render.
  function schedHasActiveSlots(sched){
    try {
      return Object.keys(sched || {}).some(function(k){
        const v = sched[k];
        return v === true || (v && typeof v === 'object');
      });
    } catch(_){ return false; }
  }
  function enforceOrClearStaleLock(){
    if(!window.tmpCalClearGuard || !tmpCalClearGuard.isActive()) return;
    try {
      if(window.S && schedHasActiveSlots(S.sched)){
        tmpCalClearGuard.clear();
        return;
      }
    } catch(_){}
    try { tmpCalClearGuard.enforce(); } catch(_){}
  }

  try { enforceOrClearStaleLock(); } catch(_){}

  [0, 50, 300].forEach(function(ms){
    setTimeout(function(){
      try { enforceOrClearStaleLock(); } catch(_){}
    }, ms);
  });

  document.addEventListener('click', function(e){
    if(!window.tmpCalClearGuard || !tmpCalClearGuard.isActive()) return;
    if(e.target && e.target.closest && e.target.closest('#pti-btn')){
      try { tmpCalClearGuard.enforce(); } catch(_){}
    }
    const pia = e.target && e.target.closest && e.target.closest('#pia-add');
    if(pia){
      try {
        const it = (window.S && S.inv || []).find(i => i.id === parseInt((typeof gv==='function'?gv('pia-sel'):'')||'',10));
        if(it && it.name) tmpCalClearGuard.allowName(it.name);
      } catch(_){}
      return;
    }
    const schedBtn = e.target && e.target.closest && e.target.closest('#move-save,#edit-save,#pt-sched-prompt-apply');
    if(schedBtn){
      try {
        let nm = (window.CUR && CUR.name) || ((document.getElementById('ap-nm')||{}).textContent||'').trim();
        if(!nm && schedBtn.id === 'pt-sched-prompt-apply'){
          const title = (document.getElementById('pt-sched-prompt-title')||{}).textContent || '';
          const m = title.match(/"([^"]+)"/);
          if(m) nm = m[1];
        }
        if(nm) tmpCalClearGuard.allowName(nm);
      } catch(_){}
    }
  }, true);

  document.addEventListener('change', function(e){
    if(!window.tmpCalClearGuard || !tmpCalClearGuard.isActive()) return;
    if(!e.target || e.target.id !== 'pia-sel') return;
    try {
      const it = (window.S && S.inv || []).find(i => i.id === parseInt(e.target.value || '', 10));
      if(it && it.name) tmpCalClearGuard.allowName(it.name);
    } catch(_){}
  }, true);

  const STACK_PLAN_KEY = 'tmp.stackPlan.v1';
  function readStackPlanSnap(){
    try {
      if (window.tmpCalClearGuard && tmpCalClearGuard.isActive()) return [];
      if (window.S && Array.isArray(S.stackPlan)) return clone(S.stackPlan);
      return clone(JSON.parse(localStorage.getItem(STACK_PLAN_KEY) || '[]'));
    } catch(_){ return []; }
  }
  function clearStackPlan(){
    try {
      if (window.S) S.stackPlan = [];
      localStorage.setItem(STACK_PLAN_KEY, '[]');
    } catch(_){}
  }
  function schedOccupiedCount(){
    try {
      return Object.keys(S.sched || {}).filter(k => {
        const v = S.sched[k];
        return v === true || (v && typeof v === 'object');
      }).length;
    } catch(_){ return 0; }
  }
  function wipeSchedCompletely(){
    if(!window.S) return;
    window._tmpBypassCalEnforce = true;
    try {
      if(window.tmpCalClearGuard){
        if(typeof tmpCalClearGuard.deleteAllSchedKeyVariants === 'function') tmpCalClearGuard.deleteAllSchedKeyVariants();
        if(typeof tmpCalClearGuard.hardResetSched === 'function') tmpCalClearGuard.hardResetSched();
        if(typeof tmpCalClearGuard.suppressIntervalOccurrences === 'function') tmpCalClearGuard.suppressIntervalOccurrences();
      } else if(S.sched && typeof S.sched === 'object'){
        Object.keys(S.sched).forEach(k => {
          try { delete S.sched[k]; } catch(_){}
        });
        S.sched = Object.create(null);
      }
      (S.inv || []).forEach(it => {
        if(it && !it.isSupply){
          it.days = [];
          try { delete it.stackLane; } catch(_){ it.stackLane = ''; }
        }
      });
      clearStackPlan();
      try { localStorage.setItem(STACK_PLAN_KEY, '[]'); } catch(_){}
      try { localStorage.setItem('peptide_tracker', JSON.stringify(S)); } catch(_){}
    } finally {
      window._tmpBypassCalEnforce = false;
    }
  }
  window.tmpWipeSchedCompletely = wipeSchedCompletely;
  function refreshCalendarAfterClear(){
    try { window._tmpSkipSchedRepair = true; } catch(_){}
    try { if(window.tmpCalClearGuard && tmpCalClearGuard.isActive()) tmpCalClearGuard.enforce(); } catch(_){}
    try { if(typeof renderCal === 'function') renderCal({ force: true }); } catch(_){}
    try { if(window.tmpStackPlan && typeof tmpStackPlan.render === 'function') tmpStackPlan.render(); } catch(_){}
    try { if(window.tmpCalClearGuard) tmpCalClearGuard.updateLockBanner(); } catch(_){}
    try { if(typeof window.__tmpFixCalLockBanner === 'function') window.__tmpFixCalLockBanner(); } catch(_){}
    setTimeout(function(){
      try { if(window.tmpCalClearGuard && tmpCalClearGuard.isActive()) tmpCalClearGuard.enforce(); } catch(_){}
      try { if(typeof renderCal === 'function') renderCal({ force: true }); } catch(_){}
      try { if(typeof window.__tmpFixCalLockBanner === 'function') window.__tmpFixCalLockBanner(); } catch(_){}
      try { delete window._tmpSkipSchedRepair; } catch(_){}
    }, 120);
    setTimeout(function(){
      try { if(window.tmpCalClearGuard && tmpCalClearGuard.isActive()) tmpCalClearGuard.enforce(); } catch(_){}
      try { if(typeof renderCal === 'function') renderCal({ force: true }); } catch(_){}
    }, 400);
  }
  function restoreStackPlanSnap(plan){
    try {
      if (window.S) S.stackPlan = plan || [];
      localStorage.setItem(STACK_PLAN_KEY, JSON.stringify(plan || []));
    } catch(_){}
  }
  function restoreCalendarSnap(s, meta){
    meta = meta || {};
    if (!meta.fromUndo) return;
    try { if (window.tmpCalClearGuard) tmpCalClearGuard.clear(); } catch(_){}
    if (s && typeof s === 'object' && ('sched' in s || 'stackPlan' in s)){
      S.sched = s.sched || {};
      restoreStackPlanSnap(s.stackPlan || []);
    } else {
      S.sched = s || {};
    }
  }

  // Calendar clear — always visible (calendar-only: S.sched). Kebab hid the only action.
  function wireCalMore(){
    const clear = document.getElementById('tmp-clear-cal');
    const more = document.getElementById('tmp-cal-more');
    if (!clear || clear.__tmpWired) return;
    clear.__tmpWired = true;
    clear.style.display = 'inline-flex';
    if (more) more.style.display = 'none';
  }

  function wire(){
    wireCalMore();

    // Helper: shots-clear (used by both tmp-clear-log and rotation-reset-btn)
    function shotsOpts(){
      return {
        emptyCheck: () => !((S.shots||[]).length),
        emptyLabel: _G.check + ' Already empty',
        snapshot: () => clone(S.shots||[]),
        restore:  s => { S.shots = s; },
        action: () => { const n = (S.shots||[]).length; S.shots = []; return n; },
        doneLabel: c => _G.check + ' Cleared '+c+' shot'+(c!==1?'s':''),
        undoLabel: c => _G.undo + ' Click to undo',
      };
    }

    // v5: stash restore options globally for rehydrateUndo() to find
    // them after a page reload (so it knows how to restore each button's
    // snapshot). Each tmpConfirmTwice options object is added below.
    window._tmpUndoOpts = window._tmpUndoOpts || {};
    function _stash(id, o){ window._tmpUndoOpts[id] = o; return o; }

    // CALENDAR — clear S.sched and stack plan. No undo: restore was repopulating
    // the full calendar via the undock bar / stale localStorage after reload.
    tmpConfirmTwice('tmp-clear-cal', _stash('tmp-clear-cal', {
      emptyCheck: () => {
        const schedCount = schedOccupiedCount();
        let planCount = 0;
        try {
          if (window.tmpCalClearGuard && tmpCalClearGuard.isActive()) planCount = 0;
          else planCount = readStackPlanSnap().length;
        } catch(_){ planCount = 0; }
        return !schedCount && !planCount;
      },
      action: () => {
        const schedCount = schedOccupiedCount();
        const planCount = readStackPlanSnap().length;
        try { localStorage.removeItem('tmp.undo.tmp-clear-cal'); } catch(_){}
        try { if (typeof tmpDismissUndo === 'function') tmpDismissUndo('tmp-clear-cal'); } catch(_){}
        try {
          if (window.tmpCalClearGuard){
            tmpCalClearGuard.mark();
            tmpCalClearGuard.resetAllowed();
          }
        } catch(_){}
        wipeSchedCompletely();
        try {
          if (window.tmpCalClearGuard){
            tmpCalClearGuard.installSchedPropertyGuard();
            tmpCalClearGuard.enforce();
            try { tmpCalClearGuard.updateLockBanner(); } catch(_){}
          }
        } catch(_){}
        return schedCount || planCount;
      },
      refresh: refreshCalendarAfterClear,
      doneLabel: c => _G.check + ' Cleared '+c+' slot'+(c!==1?'s':''),
    }));

    // LOG (\"Clear shot log table\")
    tmpConfirmTwice('tmp-clear-log', _stash('tmp-clear-log', shotsOpts()));

    // ROTATION \"Reset tracker\" — same shots clear, with undo
    tmpConfirmTwice('rotation-reset-btn', _stash('rotation-reset-btn', shotsOpts()));

    // SUPPLIES
    tmpConfirmTwice('tmp-clear-sup', _stash('tmp-clear-sup', {
      emptyCheck: () => !((S.inv||[]).filter(i=>i.isSupply).length),
      snapshot: () => clone(S.inv||[]),
      restore:  s => { S.inv = s; },
      action: () => {
        const n = (S.inv||[]).filter(i=>i.isSupply).length;
        S.inv = (S.inv||[]).filter(i=>!i.isSupply);
        return n;
      },
      doneLabel: c => _G.check + ' Cleared '+c+' suppl'+(c!==1?'ies':'y'),
      undoLabel: c => _G.undo + ' Click to undo',
    }));

    // VIALS
    tmpConfirmTwice('tmp-clear-vials', _stash('tmp-clear-vials', {
      emptyCheck: () => !((S.vials||[]).length),
      snapshot: () => clone(S.vials||[]),
      restore:  s => { S.vials = s; },
      action: () => { const n = (S.vials||[]).length; S.vials = []; return n; },
      doneLabel: c => _G.check + ' Cleared '+c+' vial'+(c!==1?'s':''),
      undoLabel: c => _G.undo + ' Click to undo',
    }));

    // INTERVAL DOSES (v11) — peptides with interval>0 on the Daily Stack.
    // Snapshots only the interval values keyed by id so undo doesn't blow
    // away other changes the user makes between clear and undo.
    tmpConfirmTwice('tmp-clear-intervals', _stash('tmp-clear-intervals', {
      emptyCheck: () => !((S.inv||[]).filter(i=>i.interval>0).length),
      snapshot: () => {
        const out = {};
        (S.inv||[]).forEach(i => { if (i.interval > 0) out[i.id] = i.interval; });
        return out;
      },
      restore: s => {
        if (!s) return;
        Object.keys(s).forEach(idStr => {
          const it = (S.inv||[]).find(x => String(x.id) === String(idStr));
          if (it) it.interval = s[idStr];
        });
      },
      action: () => {
        const items = (S.inv||[]).filter(i=>i.interval>0);
        const count = items.length;
        items.forEach(i => { i.interval = 0; });
        return count;
      },
      doneLabel: c => _G.check + ' Cleared '+c+' interval'+(c!==1?'s':''),
      undoLabel: c => _G.undo + ' Click to undo',
    }));

    // PACKAGES
    tmpConfirmTwice('tmp-clear-pkg', _stash('tmp-clear-pkg', {
      emptyCheck: () => !((S.packages||[]).length),
      snapshot: () => ({ packages:clone(S.packages||[]), tracking:clone(S.tracking||{}) }),
      restore:  s => { S.packages = s.packages; S.tracking = s.tracking; },
      action: () => {
        const n = (S.packages||[]).length;
        S.packages = []; S.tracking = {};
        return n;
      },
      doneLabel: c => _G.check + ' Cleared '+c+' package'+(c!==1?'s':''),
      undoLabel: c => _G.undo + ' Click to undo',
    }));
  }

  // v5: Rehydrate persisted undo states from localStorage. After tmpConfirmTwice
  // arms each button, this scan flips back into the undoable visual state any
  // button whose previous clear has not been undone yet. This is what makes the
  // undo "accessible after the fact" — even after a page reload.
  function rehydrateUndo(){
    try {
      Object.keys(localStorage).forEach(k=>{
        if (k.indexOf('tmp.undo.') !== 0) return;
        const btnId = k.slice('tmp.undo.'.length);
        const btn = document.getElementById(btnId);
        if (!btn) return;
        let meta;
        try { meta = JSON.parse(localStorage.getItem(k) || 'null'); } catch(_) { return; }
        if (!meta || !meta.snap) return;
        if (btn.__tmpRehydrateWired) return;
        // Calendar undo is undock-only — never hijack the clear button after reload.
        if (btnId === 'tmp-clear-cal'){
          try { localStorage.removeItem(k); } catch(_){}
          btn.__tmpRehydrateWired = true;
          btn.classList.remove('undoable','tmp-rehydrated','confirming','done');
          try { if (typeof tmpRefreshUndock === 'function') tmpRefreshUndock(); } catch(_){}
          return;
        }
        // Force the button's internal state machine into undoable. This is
        // best-effort because tmpConfirmTwice scopes its state vars in the
        // closure. Easiest is to dispatch a synthetic state by toggling
        // classes + label, and have a click listener that performs the undo
        // directly (bypassing the state machine).
        btn.classList.add('undoable','tmp-rehydrated');
        const lbl = btn.querySelector('.rr-label, [data-tmp-label]') || btn;
        const minsAgo = Math.round((Date.now() - (meta.ts||Date.now()))/60000);
        lbl.textContent = _G.undo + ' Undo (cleared ' + minsAgo + 'm ago)';
        // Replace the click handler stack: clicking does undo with confirm.
        btn.__tmpRehydrateWired = true;
        btn.addEventListener('click', function rehydClick(e){
          if (!btn.classList.contains('tmp-rehydrated')) return;
          e.preventDefault(); e.stopPropagation();
          const proceed = confirm('Restore the snapshot from your previous clear ('+minsAgo+' min ago)?\n\nAny changes since then will be lost.');
          if (!proceed) return;
          // Find the matching options for this btn-id by name. Re-derive the
          // restore function from the action map below. We snapshot the
          // standard-option-set keyed by btnId at wire-time (see _tmpUndoOpts).
          try {
            const opts = window._tmpUndoOpts && window._tmpUndoOpts[btnId];
            if (opts && opts.restore){ opts.restore(meta.snap, { fromUndo: true }); }
            if (typeof save === 'function') save();
            if (typeof tmpRefreshAll === 'function') tmpRefreshAll();
            localStorage.removeItem(k);
            btn.classList.remove('undoable','tmp-rehydrated');
            btn.classList.add('done');
            lbl.textContent = _G.check + ' Restored';
            try { if (typeof tmpRefreshUndock === 'function') tmpRefreshUndock(); } catch(_){}
            setTimeout(()=>{ btn.classList.remove('done'); lbl.textContent = (meta.originalLabel || lbl.textContent); }, 1500);
          } catch(err){ console.error(err); }
        }, true);  // capture so it runs before the normal handler
      });
    } catch(_){}
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => { wire(); rehydrateUndo(); });
  } else {
    wire(); rehydrateUndo();
  }
  // Buttons inside modals/forms may not exist at first wire; poll briefly.
  let pollLeft = 8;
  const poll = setInterval(()=>{ wire(); rehydrateUndo(); if (--pollLeft <= 0) clearInterval(poll); }, 500);
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.tmpRefreshUndock) return;

  // Pretty-name each known button so the dock label tells the user which
  // clear is undoable, not just an opaque ID.
  const BTN_LABELS = {
    'tmp-clear-cal':     'Clear weekly calendar',
    'tmp-clear-log':     'Clear shot log',
    'rotation-reset-btn':'Reset rotation tracker',
    'tmp-clear-vials':   'Clear all vials',
    'tmp-clear-sup':     'Clear all supplies',
    'tmp-clear-pkg':     'Clear all packages',
    'tmp-clear-intervals':'Clear all interval doses',
  };

  function tsAgo(ms){
    const m = Math.round((Date.now()-ms)/60000);
    if (m < 1) return 'just now';
    if (m === 1) return '1 min ago';
    if (m < 60) return m + ' min ago';
    const h = Math.round(m/60);
    if (h === 1) return '1 hr ago';
    if (h < 24) return h + ' hrs ago';
    const d = Math.round(h/24);
    return d + (d===1 ? ' day ago' : ' days ago');
  }

  function refresh(){
    const dock = document.getElementById('tmp-undock');
    if (!dock) return;
    let any = false;
    try {
      // Sort newest first.
      const entries = [];
      Object.keys(localStorage).forEach(k=>{
        if (k.indexOf('tmp.undo.') !== 0) return;
        const btnId = k.slice('tmp.undo.'.length);
        if (btnId === 'tmp-clear-cal'){
          try { localStorage.removeItem(k); } catch(_){}
          return;
        }
        let meta;
        try { meta = JSON.parse(localStorage.getItem(k) || 'null'); } catch(_) { return; }
        if (!meta || !meta.snap) return;
        entries.push({ btnId, meta, key:k, ts: meta.ts || 0 });
      });
      entries.sort((a,b)=> b.ts - a.ts);

      const sig = entries.map(e => e.key + ':' + e.ts).join('|');
      if (sig === dock.__tmpUndockSig && entries.length === dock.querySelectorAll('.tmp-undock-pill').length){
        entries.forEach(({ meta, key }) => {
          const pill = dock.querySelector('[data-undo-key="'+key+'"]');
          if (!pill) return;
          const small = pill.querySelector('small');
          if (small) small.textContent = (meta.count ? meta.count+' item'+(meta.count!==1?'s':'')+' · ' : '') + tsAgo(meta.ts||Date.now());
        });
        dock.classList.toggle('has-items', entries.length > 0);
        return;
      }
      dock.__tmpUndockSig = sig;
      dock.innerHTML = '';

      entries.forEach(({btnId, meta, key})=>{
        const friendly = BTN_LABELS[btnId] || btnId;
        const pill = document.createElement('div');
        pill.className = 'tmp-undock-pill';
        pill.setAttribute('data-undo-key', key);
        pill.innerHTML = ''
          + '<div class="tmp-undock-label">'
          +   '<span>↩ Undo: '+friendly+'</span>'
          +   '<small>'+ (meta.count ? meta.count+' item'+(meta.count!==1?'s':'')+' · ' : '') + tsAgo(meta.ts||Date.now()) +'</small>'
          + '</div>'
          + '<button type="button" class="tmp-undock-restore" title="Restore the state from before this clear">Restore</button>'
          + '<button type="button" class="tmp-undock-x" title="Dismiss — make this clear permanent">×</button>';

        pill.querySelector('.tmp-undock-restore').addEventListener('click', ()=>{
          if (btnId === 'tmp-clear-cal') return;
          const proceed = confirm(
            'Restore the snapshot from when you "'+friendly+'" ('+tsAgo(meta.ts||Date.now())+')?\n\nAny changes you have made since that clear will be lost.'
          );
          if (!proceed) return;
          try {
            const opts = window._tmpUndoOpts && window._tmpUndoOpts[btnId];
            if (opts && opts.restore){ opts.restore(meta.snap, { fromUndo: true }); }
            if (typeof save === 'function') save();
            if (typeof tmpRefreshAll === 'function') tmpRefreshAll();
            if (typeof tmpDismissUndo === 'function') tmpDismissUndo(btnId);
            else localStorage.removeItem(key);
          } catch(err){ console.error('undock restore failed:', err); }
          dock.__tmpUndockSig = '';
          refresh();
        });
        pill.querySelector('.tmp-undock-x').addEventListener('click', ()=>{
          if (!confirm('Dismiss the undo for "'+friendly+'"?\nThe clear becomes permanent — the snapshot will be discarded.')) return;
          try {
            if (typeof tmpDismissUndo === 'function') tmpDismissUndo(btnId);
            else localStorage.removeItem(key);
          } catch(_){}
          dock.__tmpUndockSig = '';
          refresh();
        });
        dock.appendChild(pill);
        any = true;
      });
    } catch(_){}
    dock.classList.toggle('has-items', any);
  }
  window.tmpRefreshUndock = refresh;

  // Initial render + listen for changes:
  function init(){
    refresh();
    // Cross-tab: storage events.
    window.addEventListener('storage', e=>{
      if (e.key && e.key.indexOf('tmp.undo.') === 0) refresh();
    });
    // Same-tab: poll lightly. Some clears bypass storage events and we want
    // the dock to update within ~1s of any change.
    __tmpPgInterval(refresh, 1500, 'doc');
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.tmpShowPepDelete) return;

  // Compute the dependency footprint of a peptide — counts shown to user
  // so they can make an informed Archive vs Delete decision.
  function footprint(pepName){
    const shots = (window.S && S.shots ? S.shots : []).filter(s=>s.peptide===pepName).length;
    const prefix = pepName + '/';
    const sched = Object.keys((window.S && S.sched) || {}).filter(k=>k.indexOf(prefix)===0 && S.sched[k]).length;
    const vials = (window.S && S.vials ? S.vials : []).filter(v=>v && v.peptideName===pepName).length;
    return { shots, sched, vials };
  }

  // Open the redesigned dialog for the peptide with id=pepId. Sets pepEId
  // (TMP's existing edit-target var) so the existing close-on-cancel and
  // related render flows continue to work.
  function tmpShowPepDelete(pepId){
    const it = (window.S && S.inv ? S.inv : []).find(i=>i.id===pepId);
    if (!it){ console.warn('tmpShowPepDelete: no peptide with id', pepId); return; }
    window.pepEId = pepId;
    const fp = footprint(it.name);
    const tbox = document.getElementById('pep-dbox');
    const tt = document.getElementById('pd-title');
    const ts = document.getElementById('pd-sub');
    const ad = document.getElementById('pd-archive-detail');
    const cd = document.getElementById('pd-cascade-detail');
    if (!tbox || !tt) return;
    /* v0.27.68: Portal pep-dbox to <body> as a fixed overlay so it's
       visible even when the peptide manager (#pepmgr) is closed. */
    if (tbox.dataset.portaled !== '1'){
      try { document.body.appendChild(tbox); } catch(_){}
      tbox.style.position = 'fixed';
      tbox.style.top = '50%';
      tbox.style.left = '50%';
      tbox.style.transform = 'translate(-50%, -50%)';
      tbox.style.zIndex = '99999';
      tbox.style.maxWidth = '480px';
      tbox.style.width = 'calc(100% - 32px)';
      tbox.style.maxHeight = 'calc(100vh - 32px)';
      tbox.style.overflowY = 'auto';
      tbox.style.borderRadius = '12px';
      tbox.style.boxShadow = '0 20px 60px rgba(0,0,0,0.35)';
      tbox.style.background = 'var(--color-background-primary, #fff)';
      tbox.style.border = '.5px solid var(--color-border-primary, #E5E7EB)';
      var bd = document.getElementById('pep-dbox-backdrop');
      if (!bd){
        bd = document.createElement('div');
        bd.id = 'pep-dbox-backdrop';
        bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99998;display:none';
        bd.addEventListener('click', function(){
          var t = document.getElementById('pep-dbox');
          var b = document.getElementById('pep-dbox-backdrop');
          if (t) t.style.display = 'none';
          if (b) b.style.display = 'none';
        });
        document.body.appendChild(bd);
      }
      tbox.dataset.portaled = '1';
    }
    var __bd = document.getElementById('pep-dbox-backdrop');
    if (__bd) __bd.style.display = 'block';
    tt.textContent = 'What should happen to "' + it.name + '"?';
    ts.textContent = it.name + ' has ' + fp.shots + ' logged shot' + (fp.shots!==1?'s':'') + ', ' + fp.sched + ' scheduled cell' + (fp.sched!==1?'s':'') + ', and ' + fp.vials + ' vial' + (fp.vials!==1?'s':'') + ' on file.';
    ad.innerHTML = 'Hide this peptide from active views (calendar, daily stack, peptide list). Keeps:'
      + '<ul style="margin:3px 0 0;padding-left:18px">'
      +   '<li>' + fp.shots + ' logged shot' + (fp.shots!==1?'s':'') + ' (intact for history & charts)</li>'
      +   '<li>' + fp.sched + ' scheduled cell' + (fp.sched!==1?'s':'') + ' (paused — restored on unarchive)</li>'
      +   '<li>' + fp.vials + ' vial' + (fp.vials!==1?'s':'') + ' (still in storage)</li>'
      + '</ul>'
      + 'Toggle <b>Show archived</b> in the peptide manager to find and unarchive it later.';
    cd.innerHTML = 'Permanently remove the peptide AND every record tied to it:'
      + '<ul style="margin:3px 0 0;padding-left:18px">'
      +   '<li>' + fp.shots + ' logged shot' + (fp.shots!==1?'s':'') + ' (history lost)</li>'
      +   '<li>' + fp.sched + ' scheduled cell' + (fp.sched!==1?'s':'') + '</li>'
      +   '<li>' + fp.vials + ' vial' + (fp.vials!==1?'s':'') + '</li>'
      + '</ul>'
      + '<b>Cannot be undone.</b> Two clicks required.';
    // Reset the cascade button to unarmed state every time the dialog opens
    const cbtn = document.getElementById('pd-cascade');
    if (cbtn){ cbtn.dataset.armed = '0'; cbtn.textContent = 'Delete + all data'; }
    tbox.style.display = 'block';
  }
  window.tmpShowPepDelete = tmpShowPepDelete;

  function _closePepDbox(){
    const tbox = document.getElementById('pep-dbox');
    if (tbox) tbox.style.display='none';
    const __bd = document.getElementById('pep-dbox-backdrop');
    if (__bd) __bd.style.display='none';
  }

  function tmpArchivePep(pepId){
    const it = S.inv.find(i=>i.id===pepId);
    if (!it) return;
    const nm=it.name;
    it.archived = true;
    it.archivedAt = new Date().toISOString();
    // WEEKLY-CAL-ORPHAN-PRUNE-R1: drop calendar cells immediately (before save/reload).
    try {
      if(nm&&typeof window.clearSchedForPepName==='function')window.clearSchedForPepName(nm);
      else if(nm&&window.S&&S.sched){
        for(let di=0;di<7;di++){delete S.sched[nm+'/am/'+di];delete S.sched[nm+'/pm/'+di];}
      }
    } catch(_){}
    if (typeof save === 'function') save();
    if (typeof tmpRefreshAll === 'function') tmpRefreshAll();
    if (typeof rlPL === 'function') rlPL();
    if (typeof renderInv === 'function') renderInv();
    _closePepDbox();
    try { window.tmpInventoryToast('📦 Archived "' + (it.name||'peptide') + '". Toggle Show archived to restore.', 'amber'); } catch(_){}
    // Also close the peptide editor view (return to list) since the
    // archived peptide shouldn't stay open in the form.
    if (typeof swPT === 'function') swPT('list');
  }
  window.tmpArchivePep = tmpArchivePep;

  function tmpUnarchivePep(pepId){
    const it = S.inv.find(i=>i.id===pepId);
    if (!it) return;
    delete it.archived;
    delete it.archivedAt;
    if (typeof save === 'function') save();
    if (typeof tmpRefreshAll === 'function') tmpRefreshAll();
    if (typeof rlPL === 'function') rlPL();
    if (typeof renderInv === 'function') renderInv();
  }
  window.tmpUnarchivePep = tmpUnarchivePep;

  /* v33.375-stable-vendor-post-import-review: shared toast helper for archive/delete confirmation */
  window.tmpInventoryToast = function(text, color){
    try {
      var t = document.getElementById('tmp-inv-toast');
      if(!t){
        t = document.createElement('div');
        t.id = 'tmp-inv-toast';
        t.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;padding:12px 24px;border-radius:10px;color:#fff;font-weight:700;font-size:14px;box-shadow:0 8px 28px rgba(0,0,0,.18),0 0 0 .5px rgba(255,255,255,.18) inset;display:none;font-family:inherit;letter-spacing:.01em;max-width:90vw;pointer-events:none';
        document.body.appendChild(t);
      }
      t.style.background = color === 'red' ? 'linear-gradient(135deg,#DC2626,#991B1B)'
                         : color === 'amber' ? 'linear-gradient(135deg,#F59E0B,#B45309)'
                         : 'linear-gradient(135deg,#10B981,#059669)';
      t.textContent = text;
      t.style.display = 'block';
      t.style.opacity = '1';
      clearTimeout(window._tmpInvToastTimer);
      window._tmpInvToastTimer = setTimeout(function(){
        t.style.transition = 'opacity .35s ease';
        t.style.opacity = '0';
        setTimeout(function(){ t.style.display='none'; t.style.transition=''; }, 380);
      }, 2800);
    } catch(_){}
  }
  window.tmpInventoryToast = tmpInventoryToast;
  function tmpDeletePepCascade(pepId){
    const it = S.inv.find(i=>i.id===pepId);
    if (!it) return;
    const nm = it.name;
    // Honour the existing blend-component check (TMP shows a confirm() if the
    // peptide is referenced by a blend).
    if (!it.isBlend && typeof blendsUsing === 'function'){
      const usedIn = blendsUsing(nm);
      if (usedIn && usedIn.length){
        const msg = nm + ' is a component in ' + usedIn.length + ' blend' + (usedIn.length===1?'':'s')
          + ' (' + usedIn.map(b=>b.name).join(', ') + '). Those blends will show "' + nm + ' (not in inventory)" until you fix them. Delete anyway?';
        if (!confirm(msg)) return;
      }
    }
    // Wipe everything tied to this peptide.
    S.inv = (S.inv||[]).filter(i=>i.id!==pepId);
    S.shots = (S.shots||[]).filter(s=>s.peptide!==nm);
    Object.keys(S.sched||{}).forEach(k=>{ if (k.indexOf(nm+'/')===0) delete S.sched[k]; });
    S.vials = (S.vials||[]).filter(v=>v && v.peptideName!==nm);
    if (typeof rebuildCM === 'function') try{rebuildCM();}catch(_){}
    if (typeof buildLegend === 'function') try{buildLegend();}catch(_){}
    if (typeof save === 'function') save();
    if (typeof popSel === 'function') try{popSel();}catch(_){}
    window.pepEId = null;
    _closePepDbox();
    if (typeof swPT === 'function') swPT('list');
    if (typeof rr === 'function') try{rr();}catch(_){}
    if (typeof tmpRefreshAll === 'function') tmpRefreshAll();
    // v33.375-stable-vendor-post-import-review: toast confirmation
    try { window.tmpInventoryToast('🗑 Deleted "' + nm + '" and all its records', 'red'); } catch(_){}
  }
  window.tmpDeletePepCascade = tmpDeletePepCascade;

  function wire(){
    if (window.__tmpArchiveWired) return;
    window.__tmpArchiveWired = true;
    const arch = document.getElementById('pd-archive');
    const cas  = document.getElementById('pd-cascade');
    const no   = document.getElementById('pd-no');
    if (arch) arch.addEventListener('click', () => {
      if (window.pepEId) tmpArchivePep(window.pepEId);
    });
    if (no) no.addEventListener('click', _closePepDbox);
    // Two-step confirm on cascade
    if (cas) cas.addEventListener('click', () => {
      if (cas.dataset.armed === '1'){
        const id = window.pepEId;
        cas.dataset.armed = '0';
        cas.textContent = 'Delete + all data';
        cas.style.animation = '';
        cas.style.boxShadow = '';
        if (id) tmpDeletePepCascade(id);
      } else {
        cas.dataset.armed = '1';
        cas.textContent = '⚠ Click again to confirm deletion';
        cas.style.animation = 'pulse-warn 0.6s ease-in-out infinite';
        cas.style.boxShadow = '0 0 0 3px rgba(220,38,38,.35)';
        setTimeout(()=>{
          if (cas.dataset.armed === '1'){
            cas.dataset.armed='0';
            cas.textContent='Delete + all data';
            cas.style.animation = '';
            cas.style.boxShadow = '';
          }
        }, 4000);
      }
    });
    // Inline Inventory delete: take over the existing inv-del-btn click
    // (capture phase) and route it to our dialog. The legacy yes/no inline
    // confirm is now bypassed; if it ever fires, it falls through to its
    // own legacy handler harmlessly.
    document.addEventListener('click', e => {
      const db = e.target.closest && e.target.closest('.inv-del-btn');
      if (!db) return;
      const id = parseInt(db.dataset.did);
      if (!id) return;
      const it = (window.S && S.inv ? S.inv : []).find(i=>i.id===id);
      if (!it || it.isSupply) return;  // supplies still use their own flow
      e.preventDefault();
      e.stopImmediatePropagation();
      tmpShowPepDelete(id);
    }, true);
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
  // Sync the show-archived toggle's visual state on every render — TMP
  // re-creates the toggle's surrounding container in some flows.
  __tmpPgInterval(function(){
    const on = showArchivedFlag();
    document.querySelectorAll('.tmp-show-archived-toggle').forEach(b=>{
      b.classList.toggle('is-on', on);
      b.textContent = on ? '👁 Hide archived' : '👁 Show archived';
    });
  }, 600, 'pg-inventory');

  // Show-archived toggle: store flag in localStorage so it persists.
  const SHOW_KEY = 'tmp.showArchived';
  function showArchivedFlag(){
    try { return localStorage.getItem(SHOW_KEY) === '1'; } catch(_) { return false; }
  }
  window.tmpShowArchived = showArchivedFlag;
  window.tmpToggleShowArchived = function(){
    const next = !showArchivedFlag();
    try { localStorage.setItem(SHOW_KEY, next ? '1' : '0'); } catch(_){}
    if (typeof rlPL === 'function') rlPL();
    if (typeof renderInv === 'function') renderInv();
    // Update toggle visual states everywhere.
    document.querySelectorAll('.tmp-show-archived-toggle').forEach(b => {
      b.classList.toggle('is-on', next);
      b.textContent = next ? '👁 Hide archived' : '👁 Show archived';
    });
  };

  // Helper for callers: should this peptide be visible in active views?
  window.tmpIsActivePep = function(i){ return i && !i.isSupply && !i.archived; };
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.tmpRenderInsights) return;

  // Tag classification — drives color and priority. 'red' surfaces first.
  const TAG_META = {
    'energy':          { kind:'green', emoji:'⚡', label:'Energy',           hint:'Strong positive signal — likely working as intended.' },
    'sleep':           { kind:'green', emoji:'💤', label:'Better sleep',     hint:'Consistent positive sleep effect.' },
    'mood':            { kind:'green', emoji:'🙂', label:'Mood lift',        hint:'Sustained mood improvement.' },
    'joints':          { kind:'green', emoji:'🦴', label:'Joint relief',     hint:'Joint relief pattern — useful for healing protocols.' },
    'recovery':        { kind:'green', emoji:'💪', label:'Recovery',         hint:'Recovery boost showing up consistently.' },
    'appetite-down':   { kind:'amber', emoji:'↓',  label:'Appetite down',    hint:'Appetite suppression — expected for GLP-1s; check it is not excessive.' },
    'appetite-up':     { kind:'amber', emoji:'↑',  label:'Appetite up',      hint:'Increased appetite. Note timing relative to meals.' },
    'fatigue':         { kind:'amber', emoji:'😴', label:'Fatigue',          hint:'Fatigue showing up frequently — consider dose, timing, and sleep.' },
    'flush':           { kind:'amber', emoji:'🔥', label:'Flush',            hint:'Skin flushing — usually transient; track if persistent.' },
    'site-irritation': { kind:'amber', emoji:'📍', label:'Site irritation',  hint:'Rotate sites or check needle gauge / injection technique.' },
    'nausea':          { kind:'red',   emoji:'🤢', label:'Nausea',           hint:'Frequent nausea — consider PM dosing, smaller titration, or anti-emetic.' },
    'headache':        { kind:'red',   emoji:'🤕', label:'Headache',         hint:'Frequent headaches — review hydration, dose, and timing.' },
  };

  const COLORS = {
    green: { bg:'#F0FDF4', border:'#A7F3D0', fg:'#065F46', accent:'#10B981' },
    amber: { bg:'#FFFBEB', border:'#FCD34D', fg:'#92400E', accent:'#F59E0B' },
    red:   { bg:'#FEF2F2', border:'#FCA5A5', fg:'#991B1B', accent:'#DC2626' },
  };

  const DISMISS_KEY = 'tmp.insights.dismissed';
  const DISMISS_DAYS = 7;
  const WINDOW_DAYS = 30;
  const MIN_COUNT = 3;
  const MIN_PCT   = 0.40;
  const MAX_CARDS = 5;

  function getDismissed(){
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); }
    catch(_) { return {}; }
  }
  function setDismissed(d){
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(d)); } catch(_){}
  }
  function isDismissed(key){
    const d = getDismissed();
    const ts = d[key];
    if (!ts) return false;
    const days = Math.floor((Date.now() - ts) / (1000*60*60*24));
    if (days >= DISMISS_DAYS){
      delete d[key]; setDismissed(d);
      return false;
    }
    return true;
  }

  function dismissPattern(key){
    const d = getDismissed();
    d[key] = Date.now();
    setDismissed(d);
  }
  function clearDismissed(){
    try { localStorage.removeItem(DISMISS_KEY); } catch(_){}
  }

  // Computes the patterns to surface. Returns [{peptide, tag, count, total, pct, amCount, pmCount, lastDate}].
  function computePatterns(){
    if (typeof S === 'undefined' || !S || !Array.isArray(S.shots)) return [];
    // Window: last 30 days, today inclusive.
    const cutoff = new Date();
    cutoff.setHours(0,0,0,0);
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS + 1);
    const cutoffMs = cutoff.getTime();

    // Peptide name -> { totalShots, perTag: { tag -> { count, am, pm, lastDate } } }
    const buckets = {};
    // Helper: archived peptide names (skipped — confusing to show patterns for them)
    const archivedNames = new Set((S.inv||[]).filter(i=>i.archived).map(i=>i.name));

    (S.shots||[]).forEach(s=>{
      if (!s || !s.peptide || !s.date) return;
      if (archivedNames.has(s.peptide)) return;
      const d = new Date(s.date + 'T12:00:00');
      if (isNaN(d) || d.getTime() < cutoffMs) return;
      if (!buckets[s.peptide]) buckets[s.peptide] = { totalShots:0, perTag:{} };
      const b = buckets[s.peptide];
      b.totalShots++;
      const tags = Array.isArray(s.tags) ? s.tags : [];
      tags.forEach(t=>{
        if (!b.perTag[t]) b.perTag[t] = { count:0, am:0, pm:0, lastDate:s.date };
        const e = b.perTag[t];
        e.count++;
        if (s.time === 'am') e.am++;
        else if (s.time === 'pm') e.pm++;
        if (s.date > e.lastDate) e.lastDate = s.date;
      });
    });

    const out = [];
    Object.keys(buckets).forEach(pep=>{
      const b = buckets[pep];
      Object.keys(b.perTag).forEach(tag=>{
        const e = b.perTag[tag];
        const pct = b.totalShots ? (e.count / b.totalShots) : 0;
        if (e.count < MIN_COUNT) return;
        if (pct < MIN_PCT) return;
        out.push({
          peptide: pep,
          tag: tag,
          count: e.count,
          total: b.totalShots,
          pct: pct,
          am: e.am, pm: e.pm,
          lastDate: e.lastDate,
        });
      });
    });

    // Sort: red kind first, then amber, then green; within kind by count desc.
    function rank(p){
      const meta = TAG_META[p.tag];
      const k = meta ? meta.kind : 'amber';
      return k === 'red' ? 0 : k === 'amber' ? 1 : 2;
    }
    out.sort((a,b)=>{
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (a.count !== b.count) return b.count - a.count;
      return b.pct - a.pct;
    });
    return out;
  }

  function fmtRelDate(iso){
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    const today = new Date(); today.setHours(0,0,0,0);
    const days = Math.round((today - d) / (1000*60*60*24));
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 14) return '1 week ago';
    if (days < 30) return Math.round(days/7) + ' weeks ago';
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }

  function renderInsights(){
    const card = document.getElementById('tmp-insights-card');
    const rows = document.getElementById('tmp-insights-rows');
    const reset = document.getElementById('tmp-insights-reset');
    if (!card || !rows) return;

    const all = computePatterns();
    const dismissedMap = getDismissed();
    const hasDismissed = Object.keys(dismissedMap).length > 0;
    const visible = all.filter(p => !isDismissed(p.peptide + '|' + p.tag));
    const top = visible.slice(0, MAX_CARDS);

    if (reset) reset.style.display = hasDismissed ? 'inline-flex' : 'none';

    if (!top.length){
      // Hide the whole card if there's nothing to show AND nothing dismissed.
      card.style.display = hasDismissed ? 'block' : 'none';
      rows.innerHTML = hasDismissed
        ? '<div style="font-size:11.5px;color:#7C3AED;text-align:center;padding:8px 0">No active patterns. Dismissed patterns can be re-shown above.</div>'
        : '';
      return;
    }
    card.style.display = 'block';

    rows.innerHTML = top.map(p => {
      const meta = TAG_META[p.tag] || { kind:'amber', emoji:'•', label:p.tag, hint:'' };
      const c = COLORS[meta.kind];
      const pctStr = Math.round(p.pct * 100);
      // Time-of-day skew message
      let skew = '';
      if (p.am > 0 && p.pm === 0) skew = 'All ' + p.am + ' on AM doses.';
      else if (p.pm > 0 && p.am === 0) skew = 'All ' + p.pm + ' on PM doses.';
      else if (p.am || p.pm) skew = 'Split: ' + p.am + ' AM / ' + p.pm + ' PM.';
      const lastTxt = 'Last: ' + fmtRelDate(p.lastDate) + '.';
      const key = p.peptide + '|' + p.tag;
      return ''
        + '<div data-pattern-key="' + (key.replace(/"/g,'&quot;')) + '" '
        +      'style="border:.5px solid '+c.border+';border-radius:10px;padding:10px 12px;background:'+c.bg+';display:flex;gap:10px;align-items:flex-start">'
        +   '<div style="font-size:22px;line-height:1;flex-shrink:0">'+ meta.emoji +'</div>'
        +   '<div style="flex:1;min-width:0">'
        +     '<div style="font-size:13px;font-weight:700;color:'+c.fg+';line-height:1.3;margin-bottom:2px">'
        +       escHTML(p.peptide) + ' &times; ' + escHTML(meta.label)
        +     '</div>'
        +     '<div style="font-size:11.5px;color:'+c.fg+';opacity:.85;line-height:1.5">'
        +       '<b>'+p.count+' of '+p.total+' doses</b> ('+pctStr+'%). '
        +       (skew ? skew + ' ' : '')
        +       lastTxt
        +     '</div>'
        +     (meta.hint ? ('<div style="font-size:11px;color:'+c.fg+';opacity:.7;line-height:1.45;margin-top:4px;font-style:italic">' + escHTML(meta.hint) + '</div>') : '')
        +   '</div>'
        +   '<button type="button" class="tmp-insight-dismiss" data-key="' + key.replace(/"/g,'&quot;') + '" '
        +     'title="Dismiss this pattern for 7 days" '
        +     'style="background:transparent;border:none;color:'+c.fg+';opacity:.5;cursor:pointer;font-size:14px;line-height:1;padding:2px 6px;flex-shrink:0;font-family:inherit">×</button>'
        + '</div>';
    }).join('');

    // Wire dismiss buttons
    rows.querySelectorAll('.tmp-insight-dismiss').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const key = btn.dataset.key;
        if (key){
          dismissPattern(key);
          renderInsights();
        }
      });
    });
  }
  window.tmpRenderInsights = renderInsights;

  // Tiny HTML escaper. Local — does not collide with TMP's own escH().
  function escHTML(s){
    return String(s).replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[ch]);
  }

  // Wire the "Show dismissed" reset button + initial render.
  function init(){
    const reset = document.getElementById('tmp-insights-reset');
    if (reset && !reset.__tmpWired){
      reset.__tmpWired = true;
      reset.addEventListener('click', ()=>{ clearDismissed(); renderInsights(); });
    }
    renderInsights();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();


// ===== extracted post-core patch script =====
(function wireLastSiteRestore(){
  // v10: Site memory across sessions. Sets the lg-site dropdown to the
  // last-used site value on page load IF the dropdown is currently empty.
  // We poll briefly because lg-site may not be in the DOM at first paint
  // (it's inside the Shot Log page which renders on tab switch).
  let tries = 0;
  const restore = () => {
    const el = document.getElementById('lg-site');
    if (!el){
      if (++tries < 12) setTimeout(restore, 250);
      return;
    }
    if (el.value) return;  // user/autofill already populated it
    let last;
    try { last = localStorage.getItem('tmp.lastSite'); } catch(_) {}
    if (!last) return;
    if (typeof window.stickLgInjectionSite === 'function') {
      window.stickLgInjectionSite(last);
      return;
    }
    if (typeof window.__tmpApplyLgSite === 'function') {
      window.__tmpApplyLgSite(last);
      return;
    }
    if ([...el.options].some(o=>o.value===last)){
      el.value = last;
      el.dispatchEvent(new Event('change', {bubbles:true}));
    }
  };
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', restore);
  } else {
    restore();
  }
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.__tmpIntervalToggleWired) return;
  const KEY = 'tmp.intervalCard.minimized';
  function isMin(){ try { return localStorage.getItem(KEY) === '1'; } catch(_) { return false; } }
  function setMin(v){
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch(_){}
    apply();
  }
  function apply(){
    const body = document.getElementById('interval-card-body');
    const chev = document.getElementById('interval-card-chev');
    const btn  = document.getElementById('interval-card-toggle');
    if (!body || !chev || !btn) return;
    const min = isMin();
    body.style.display = min ? 'none' : '';
    chev.style.transform = min ? 'rotate(-90deg)' : '';
    btn.setAttribute('aria-expanded', min ? 'false' : 'true');
  }
  function wire(){
    const btn = document.getElementById('interval-card-toggle');
    if (!btn || btn.__tmpWired) return false;
    btn.__tmpWired = true;
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      setMin(!isMin());
    });
    apply();
    window.__tmpIntervalToggleWired = true;
    return true;
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
  // Re-apply on each render: renderIntervalDoses unhides the card whenever
  // there's an item, so we re-sync the minimized state alongside.
  __tmpPgInterval(function(){ if (!window.__tmpIntervalToggleWired) wire(); else apply(); }, 800, 'pg-stack');
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.tmpCirculationLevel) return;
  function shotDoseMcg(s){
    if (!s || !s.dose) return 0;
    const u = (s.doseUnit||'mcg').toLowerCase();
    if (u === 'mg')  return (+s.dose) * 1000;
    if (u === 'mcg') return +s.dose;
    return 0;
  }
  function tmpHalfLifeHours(name){
    if (typeof window.S !== 'undefined' && window.S && Array.isArray(window.S.inv)){
      const it = window.S.inv.find(i => !i.isSupply && i.name === name);
      if (it && typeof it.halfLifeHours === 'number' && it.halfLifeHours > 0){
        return it.halfLifeHours;
      }
    }
    if (typeof PEPTIDE_REF !== 'undefined' && Array.isArray(PEPTIDE_REF)){
      // Exact match first
      const exact = PEPTIDE_REF.find(r => r.n === name);
      if (exact && typeof exact.hl === 'number' && exact.hl > 0) return exact.hl;
    }
    // v0.27.88: fuzzy fallback via findPeptideRef so user shorthand names
    // ("Reta30") still resolve to canonical entries ("Retatrutide").
    if (typeof findPeptideRef === 'function'){
      const ref = findPeptideRef(name);
      if (ref && typeof ref.hl === 'number' && ref.hl > 0) return ref.hl;
    }
    return null;
  }
  window.tmpHalfLifeHours = tmpHalfLifeHours;
  function tmpCirculationLevel(name, atTimeMs){
    const hl = tmpHalfLifeHours(name);
    if (hl == null) return null;
    if (typeof window.S === 'undefined' || !window.S || !Array.isArray(window.S.shots)) return 0;
    const t = (atTimeMs == null) ? Date.now() : +atTimeMs;
    let total = 0;
    const list = tmpShotsForPeptide(name);
    list.forEach(s => {
      if (!s || !s.date) return;
      const mcg = shotDoseMcg(s);
      if (mcg <= 0) return;
      const baseHour = (s.time === 'pm') ? 21 : (s.time === 'am') ? 9 : 12;
      const d = new Date(s.date + 'T' + String(baseHour).padStart(2,'0') + ':00:00');
      if (isNaN(d)) return;
      if (d.getTime() > t) return;
      const elapsedHours = (t - d.getTime()) / 3600000;
      total += mcg * Math.pow(0.5, elapsedHours / hl);
    });
    return total;
  }
  window.tmpCirculationLevel = tmpCirculationLevel;
  let _circShotIndex=null;
  let _circShotIndexLen=-1;
  function tmpShotsForPeptide(name){
    const shots = (typeof window.S !== 'undefined' && window.S && Array.isArray(window.S.shots)) ? window.S.shots : [];
    if(_circShotIndex && _circShotIndexLen === shots.length) return _circShotIndex[name] || [];
    const byPep=Object.create(null);
    shots.forEach(s=>{
      if(!s||!s.peptide||!s.date)return;
      if(!byPep[s.peptide])byPep[s.peptide]=[];
      byPep[s.peptide].push(s);
    });
    _circShotIndex=byPep;
    _circShotIndexLen=shots.length;
    return byPep[name] || [];
  }
  function tmpCirculationTrend(name, atTimeMs, lookbackHours){
    const hl = tmpHalfLifeHours(name);
    if (hl == null) return null;
    const t = (atTimeMs == null) ? Date.now() : +atTimeMs;
    const lookback = (lookbackHours == null) ? 6 : +lookbackHours;
    const now = tmpCirculationLevel(name, t);
    const before = tmpCirculationLevel(name, t - lookback*3600000);
    if (before <= 0 && now <= 0) return { symbol:'·', label:'no recent dose', deltaPct:0 };
    if (before <= 0) return { symbol:'↗', label:'rising', deltaPct:100 };
    const deltaPct = (now - before) / before * 100;
    if (Math.abs(deltaPct) < 5) return { symbol:'→', label:'steady', deltaPct };
    if (deltaPct > 0) return { symbol:'↗', label:'rising', deltaPct };
    return { symbol:'↘', label:'falling', deltaPct };
  }
  window.tmpCirculationTrend = tmpCirculationTrend;
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.tmpRenderCirculationTable) return;

  const MIN_KEY = 'tmp.circulationCard.minimized';
  function isMin(){
    try { return localStorage.getItem(MIN_KEY) !== '0'; }  // default minimized
    catch(_) { return true; }
  }
  function setMin(v){
    try { localStorage.setItem(MIN_KEY, v ? '1' : '0'); } catch(_){}
    applyMinState();
    if (!v && typeof window.tmpRenderCirculationChart === 'function') {
      window.tmpRenderCirculationChart(true);
    } else if (v) {
      if (typeof window.tmpRenderCirculationChart === 'function') window.tmpRenderCirculationChart();
      const cc = document.getElementById('circulation-chart-card');
      if (cc) cc.style.display = 'none';
    }
  }
  function applyMinState(){
    const body = document.getElementById('circulation-card-body');
    const chev = document.getElementById('circulation-card-chev');
    const btn  = document.getElementById('circulation-card-toggle');
    if (!body || !chev || !btn) return;
    const min = isMin();
    body.style.display = min ? 'none' : '';
    chev.style.transform = min ? 'rotate(-90deg)' : '';
    btn.setAttribute('aria-expanded', min ? 'false' : 'true');
  }

  // Format a concentration value for display. Auto-picks mcg vs mg.
  function fmtConc(mcg){
    if (mcg == null) return '—';
    if (mcg < 0.01) return '<0.01 Âµg';
    if (mcg < 1)    return (Math.round(mcg*100)/100) + ' Âµg';
    if (mcg < 1000) return (Math.round(mcg*10)/10)  + ' Âµg';
    return (Math.round(mcg/1000*100)/100) + ' mg';
  }

  function renderTable(){
    const card = document.getElementById('circulation-card');
    const rows = document.getElementById('circulation-rows');
    if (!card || !rows) return;
    if (typeof window.S === 'undefined' || !window.S || !Array.isArray(window.S.inv)){
      card.style.display = 'none';
      return;
    }
    // Active peptides = non-supply, non-archived peptides that have a half-life
    // we can model AND have at least one logged shot in S.shots.
    const peps = window.S.inv.filter(i =>
      i && !i.isSupply && !i.archived &&
      typeof window.tmpHalfLifeHours === 'function' && window.tmpHalfLifeHours(i.name) != null
    );
    const shotPeps = new Set((window.S.shots||[]).map(s=>s.peptide));
    const visible = peps.filter(p => shotPeps.has(p.name));

    // v0.27.88: surface the card even when no half-life is set yet — show
    // an empty state pointing the user to the half-life field on the peptide.
    if (!visible.length){
      card.style.display = '';
      const totalShotPeps = (window.S.inv||[]).filter(i =>
        i && !i.isSupply && !i.archived && shotPeps.has(i.name)
      ).length;
      const msg = totalShotPeps > 0
        ? 'Add a half-life to your peptides (Edit peptide → Half-life) to see modeled circulation levels here.'
        : 'Log a shot for any peptide with a half-life set to see modeled circulation levels here.';
      rows.innerHTML = '<div style="text-align:center;padding:14px;font-size:11.5px;color:#991B1B;font-style:italic;line-height:1.5">' + msg + '</div>';
      return;
    }
    card.style.display = '';

    // Compute current level + trend for each.
    const now = Date.now();
    const data = visible.map(p => ({
      name: p.name,
      level: window.tmpCirculationLevel(p.name, now),
      trend: window.tmpCirculationTrend(p.name, now, 6),
      color: (typeof pepColor === 'function') ? pepColor(p.name) : null,
    })).sort((a,b)=> (b.level||0) - (a.level||0));  // highest first

    rows.innerHTML = data.map(d => {
      const c = d.color || { bg:'#E5E7EB', border:'#D1D5DB', text:'#1F2937' };
      const trend = d.trend || { symbol:'·', label:'', deltaPct:0 };
      const trendColor = trend.symbol === '↗' ? '#059669'
                       : trend.symbol === '↘' ? '#DC2626'
                       : trend.symbol === '→' ? '#0891B2' : '#94A3B8';
      const trendLabel = trend.label
        ? trend.symbol + ' ' + trend.label + (trend.deltaPct ? ' ('+(trend.deltaPct>0?'+':'')+Math.round(trend.deltaPct)+'%)' : '')
        : '';
      return ''
        + '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid rgba(220,38,38,.15)">'
        +   '<span style="font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:6px;background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+';white-space:nowrap;flex-shrink:0">'+ escHTML(d.name) +'</span>'
        +   '<span style="font-size:13px;font-weight:700;color:#991B1B;font-variant-numeric:tabular-nums">'+ fmtConc(d.level) +'</span>'
        +   '<span style="font-size:11px;font-weight:500;color:'+trendColor+';margin-left:auto" title="Compared to 6h ago">'+ trendLabel +'</span>'
        + '</div>';
    }).join('');
  }
  function escHTML(s){
    return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  }
  window.tmpRenderCirculationTable = renderTable;

  // Wire the toggle button
  function wire(){
    const btn = document.getElementById('circulation-card-toggle');
    if (!btn || btn.__tmpWired) return false;
    btn.__tmpWired = true;
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      setMin(!isMin());
    });
    applyMinState();
    return true;
  }

  function init(){
    wire();
    renderTable();
    applyMinState();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
  // Re-apply state and re-render on a light interval. The card may toggle
  // visibility based on whether shots exist for any modeled peptide.
  __tmpPgInterval(function(){ wire(); if(!isMin()) renderTable(); applyMinState(); }, 1500, 'pg-log');
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.tmpRenderCirculationChart) return;

  const WIN_KEY = 'tmp.circulationChart.windowHours';
  const MIN_KEY = 'tmp.circulationCard.minimized'; // shared with circulation table card
  const SAMPLES = 60;

  function circulationExpanded(){
    try { return localStorage.getItem(MIN_KEY) === '0'; }
    catch(_) { return false; }
  }
  function shouldRenderChart(){
    if (typeof __tmpPgVisible === 'function' && !__tmpPgVisible('pg-log')) return false;
    if (!circulationExpanded()) return false;
    const card = document.getElementById('circulation-chart-card');
    if (!card || card.style.display === 'none') return false;
    return true;
  }

  function getWin(){
    try { const v = +localStorage.getItem(WIN_KEY); return v && v>0 ? v : 168; }
    catch(_) { return 168; }
  }
  function setWin(w){
    try { localStorage.setItem(WIN_KEY, String(w)); } catch(_){}
    applyWinUi();
    renderChart(true);
  }
  function applyWinUi(){
    const w = getWin();
    document.querySelectorAll('.circulation-chart-win').forEach(b=>{
      const on = +b.dataset.win === w;
      b.style.background = on ? '#DC2626' : 'transparent';
      b.style.color      = on ? '#FFF'    : '#991B1B';
      b.style.borderColor= on ? '#991B1B' : '#FCA5A5';
    });
  }

  let _ccChart = null;
  let _ccChartSig = null;
  let _ccDirty = false;

  function destroyChart(){
    if (_ccChart){ try { _ccChart.destroy(); } catch(_){} _ccChart = null; }
    _ccChartSig = null;
  }

  function chartOptions(){
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              if (v == null) return ctx.dataset.label + ': \u2014';
              if (v < 1)    return ctx.dataset.label + ': ' + (Math.round(v*100)/100) + ' \u00b5g';
              if (v < 1000) return ctx.dataset.label + ': ' + (Math.round(v*10)/10)  + ' \u00b5g';
              return ctx.dataset.label + ': ' + (Math.round(v/1000*100)/100) + ' mg';
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 8, autoSkip: true, font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Modeled \u00b5g' , font: { size: 11 } },
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(220,38,38,.08)' }
        }
      }
    };
  }

  function modelablePeps(){
    if (typeof window.S === 'undefined' || !window.S || !Array.isArray(window.S.inv)) return [];
    const shotPeps = new Set((window.S.shots||[]).map(s=>s.peptide));
    return window.S.inv.filter(i =>
      i && !i.isSupply && !i.archived &&
      typeof window.tmpHalfLifeHours === 'function' &&
      window.tmpHalfLifeHours(i.name) != null &&
      shotPeps.has(i.name)
    );
  }

  function buildSeries(peps, winHours){
    const now = Date.now();
    const start = now - winHours * 3600000;
    const stepMs = (winHours * 3600000) / (SAMPLES - 1);
    const labels = [];
    const sampleTimes = [];
    for (let i = 0; i < SAMPLES; i++){
      const t = start + i * stepMs;
      sampleTimes.push(t);
      const d = new Date(t);
      if (winHours <= 48){
        labels.push(d.toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric'}));
      } else {
        labels.push(d.toLocaleDateString('en-US', {month:'short', day:'numeric'}));
      }
    }
    const datasets = peps.map(p => {
      const c = (typeof pepColor === 'function') ? pepColor(p.name) : { border:'#888', bg:'#ccc' };
      const data = sampleTimes.map(t => {
        const v = window.tmpCirculationLevel(p.name, t);
        return v == null ? null : Math.round(v * 100) / 100;
      });
      return {
        label: p.name,
        data,
        borderColor: c.border || '#888',
        backgroundColor: (c.bg || '#888') + '88',
        tension: 0.25,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      };
    });
    return { labels, datasets };
  }

  function chartSig(winHours, peps){
    return winHours + '|' + peps.map(p=>p.name).sort().join('\u001f');
  }

  function updateChartData(payload){
    _ccChart.data.labels = payload.labels;
    if (_ccChart.data.datasets.length === payload.datasets.length){
      payload.datasets.forEach((ds, i) => {
        const cur = _ccChart.data.datasets[i];
        cur.data = ds.data;
        cur.label = ds.label;
        cur.borderColor = ds.borderColor;
        cur.backgroundColor = ds.backgroundColor;
      });
    } else {
      _ccChart.data.datasets = payload.datasets;
    }
    _ccChart.update('none');
  }

  function showEmptyState(card, canvas){
    card.style.display = '';
    destroyChart();
    try {
      let es = card.querySelector('.circulation-empty-state');
      if(!es){
        es = document.createElement('div');
        es.className = 'circulation-empty-state';
        es.style.cssText = 'text-align:center;padding:18px 14px;font-size:12px;color:#991B1B;font-style:italic;line-height:1.5';
        canvas.parentNode.insertBefore(es, canvas);
      }
      canvas.style.display = 'none';
      es.style.display = 'block';
      es.textContent = 'Set a half-life on any peptide and log a shot to see its modeled circulation curve here.';
    } catch(_){}
  }

  function renderChart(forceRebuild){
    const card = document.getElementById('circulation-chart-card');
    const canvas = document.getElementById('circulation-chart-canvas');
    if (!card || !canvas) return;

    if (!shouldRenderChart()){
      _ccDirty = true;
      if (_ccChart) destroyChart();
      return;
    }

    if (typeof window.S === 'undefined' || !window.S || !Array.isArray(window.S.inv)){
      card.style.display = 'none';
      destroyChart();
      return;
    }
    if (typeof Chart === 'undefined'){
      return;
    }
    if (typeof window.tmpHalfLifeHours !== 'function'
        || typeof window.tmpCirculationLevel !== 'function'){
      card.style.display = 'none';
      destroyChart();
      return;
    }

    const peps = modelablePeps();
    if (!peps.length){
      showEmptyState(card, canvas);
      return;
    }

    try {
      const es = card.querySelector('.circulation-empty-state');
      if(es) es.style.display = 'none';
      canvas.style.display = '';
    } catch(_){}
    card.style.display = '';

    const winHours = getWin();
    const payload = buildSeries(peps, winHours);
    const sig = chartSig(winHours, peps);
    const canPatch = !forceRebuild && !_ccDirty && _ccChart && _ccChartSig === sig;

    if (canPatch){
      updateChartData(payload);
      return;
    }

    destroyChart();
    _ccChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: payload.labels, datasets: payload.datasets },
      options: chartOptions()
    });
    _ccChartSig = sig;
    _ccDirty = false;
  }
  window.tmpRenderCirculationChart = renderChart;

  function wire(){
    document.querySelectorAll('.circulation-chart-win').forEach(b=>{
      if (b.__tmpWired) return;
      b.__tmpWired = true;
      b.addEventListener('click', () => setWin(+b.dataset.win));
    });
    applyWinUi();
  }

  function init(){
    wire();
    let tries = 0;
    const r = () => {
      if (shouldRenderChart()) renderChart(true);
      if (typeof Chart === 'undefined' && ++tries < 12) setTimeout(r, 300);
    };
    r();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.__tmpVendorUppercaseInstalled) return;
  window.__tmpVendorUppercaseInstalled = true;

  const UC = s => String(s||'').trim().toUpperCase();

  function migrate(){
    if (typeof window.S === 'undefined' || !window.S) return false;
    if (window.S._vendorUppercaseMigration_v1) return false;
    let changed = 0;

    // (a) S.vendors: uppercase every entry, dedupe.
    if (Array.isArray(window.S.vendors)){
      const seen = new Set();
      const out = [];
      window.S.vendors.forEach(v => {
        const u = UC(v);
        if (!u) return;
        if (seen.has(u)) return;
        seen.add(u);
        out.push(u);
        if (u !== v) changed++;
      });
      window.S.vendors = out;
    }

    // (b) S.prices: re-key each peptide row's vendor-keyed price map.
    if (window.S.prices && typeof window.S.prices === 'object'){
      Object.keys(window.S.prices).forEach(pep => {
        const row = window.S.prices[pep];
        if (!row || typeof row !== 'object') return;
        const newRow = {};
        Object.keys(row).forEach(vendor => {
          const u = UC(vendor);
          if (!u) return;
          // If the same uppercase key has multiple sources, keep the lower
          // (cheaper) price — gentler than picking arbitrarily.
          if (newRow[u] != null && row[vendor] != null){
            newRow[u] = Math.min(newRow[u], row[vendor]);
          } else {
            newRow[u] = row[vendor];
          }
          if (u !== vendor) changed++;
        });
        window.S.prices[pep] = newRow;
      });
    }

    // (c) S.vials: per-vial vendor field.
    if (Array.isArray(window.S.vials)){
      window.S.vials.forEach(v => {
        if (!v || !v.vendor) return;
        const u = UC(v.vendor);
        if (u && u !== v.vendor){
          v.vendor = u;
          changed++;
        }
      });
    }

    window.S._vendorUppercaseMigration_v1 = true;
    if (changed > 0){
      try { if (typeof save === 'function') save(); } catch(_){}
      try { if (typeof renderPrices === 'function') renderPrices(); } catch(_){}
      try { if (typeof renderVials === 'function') renderVials(); } catch(_){}
      console.log('[v17] Vendor uppercase migration: normalized', changed, 'name(s).');
    }
    return changed > 0;
  }

  // Run at DOMReady (so S has been hydrated from localStorage by load()).
  function tryMigrate(){
    if (migrate()) return;
    // If S isn't ready yet, retry briefly. load() may run after DOMContentLoaded.
    let tries = 0;
    const i = setInterval(() => {
      if (++tries > 20) { clearInterval(i); return; }
      if (typeof window.S !== 'undefined' && window.S && Array.isArray(window.S.vendors)){
        clearInterval(i);
        migrate();
      }
    }, 200);
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', tryMigrate);
  } else {
    tryMigrate();
  }
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.tmpAnalyzePriceTable) return;

  // Heuristics for "garbage" detection. Each rule returns a 'reason' string.
  function garbageReasons(name){
    if (!name || typeof name !== 'string') return ['empty name'];
    const n = name.trim();
    if (!n) return ['empty name'];
    const reasons = [];
    if (/^[,\.\(\)'\/+\-_=:;]/.test(n)) reasons.push('starts with punctuation');
    const alpha = (n.match(/[a-zA-Z]/g) || []).length;
    if (alpha < 3) reasons.push('< 3 alpha chars');
    else if (alpha / n.length < 0.30) reasons.push('mostly digits/symbols');
    if (/\b(box(?:es)?|ends?|expires?|shipping|free|code|coupon|promo|order|invoice|cart|sep|dec|nov|oct|jul|aug|jan|feb|mar|apr|may|jun)\b/i.test(n)) reasons.push('contains noise word');
    if (/['"]/.test(n) && !/^[A-Z]/.test(n)) reasons.push('stray quote');
    if (/^\d+[-_/.]\d+/.test(n)) reasons.push('looks like SKU/code');
    if (n.startsWith('(') && !/\)/.test(n)) reasons.push('unbalanced paren');
    return reasons;
  }
  window.tmpGarbageReasons = garbageReasons;

  // Pull dose token from a name. Returns canonical "10mg" / "250mcg" / null.
  function extractDose(name){
    if (!name) return null;
    const m = String(name).match(/(\d+(?:\.\d+)?)\s*(mg|mcg|Âµg|ug|iu|ml)\b/i);
    if (!m) return null;
    let unit = m[2].toLowerCase();
    if (unit === 'Âµg' || unit === 'ug') unit = 'mcg';
    return parseFloat(m[1]) + unit;
  }

  // Convert dose to canonical mcg for comparison (so 1mg == 1000mcg).
  function doseToMcg(d){
    if (!d) return null;
    const m = String(d).match(/(\d+(?:\.\d+)?)\s*(mg|mcg)/i);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return m[2].toLowerCase() === 'mg' ? v*1000 : v;
  }

  // Find a peptide-name stem in a string by checking against PEPTIDE_CATALOG
  // (canonical names) + PEPTIDE_REF (literature names). Returns lowercase stem.
  function nameStems(s){
    const out = new Set();
    if (!s) return out;
    const lower = String(s).toLowerCase();
    const sources = [];
    if (typeof PEPTIDE_CATALOG !== 'undefined' && Array.isArray(PEPTIDE_CATALOG)){
      sources.push(...PEPTIDE_CATALOG.map(c => c.canonical || c.n).filter(Boolean));
    }
    if (typeof PEPTIDE_REF !== 'undefined' && Array.isArray(PEPTIDE_REF)){
      sources.push(...PEPTIDE_REF.map(r => r.n).filter(Boolean));
    }
    sources.forEach(src => {
      const stem = String(src).toLowerCase().split(/\s|\(/)[0].replace(/[\-_]/g,'');
      if (stem.length >= 3 && lower.replace(/[\-_\s]/g,'').includes(stem)){
        out.add(stem);
      }
    });
    return out;
  }

  // Build a {vendor: price} map for one row, filtering nulls and zeros.
  function priceMap(pep){
    // v21: warehouse-aware. After v19a, row[vendor] is a {warehouse:price}
    // object; legacy entries may still be plain numbers. Returns a flat map
    // keyed 'vendor|warehouse' so the same vendor's CN price doesn't collide
    // with its US price during fingerprint comparisons.
    const row = (window.S && S.prices) ? S.prices[pep] : null;
    if (!row) return {};
    const out = {};
    Object.keys(row).forEach(v => {
      const cell = row[v];
      if (cell == null) return;
      if (typeof cell === 'number'){
        if (cell > 0) out[v + '|CN'] = cell;
      } else if (typeof cell === 'object'){
        Object.keys(cell).forEach(wh => {
          const p = +cell[wh];
          if (p > 0) out[v + '|' + wh] = p;
        });
      }
    });
    return out;
  }

  // Score a (garbage, clean) pair. Higher = more confidence they're the same peptide.
  function scorePair(garbage, clean){
    const gPrices = priceMap(garbage);
    const cPrices = priceMap(clean);
    const gDose = extractDose(garbage);
    const cDose = extractDose(clean);
    const gStems = nameStems(garbage);
    const cStems = nameStems(clean);

    let exactPriceMatches = 0;
    let near10Matches = 0;
    let priceDisagreements = 0;
    let sharedVendors = 0;
    Object.keys(gPrices).forEach(v => {
      if (cPrices[v] == null) return;
      sharedVendors++;
      const gp = gPrices[v], cp = cPrices[v];
      if (Math.abs(gp - cp) < 0.01) exactPriceMatches++;
      else {
        const ratio = Math.abs(gp - cp) / Math.max(gp, cp);
        if (ratio <= 0.10) near10Matches++;
        else if (ratio > 0.30) priceDisagreements++;
      }
    });

    // Dose match: only count if BOTH rows have a dose (otherwise neutral).
    let doseMatch = 0;
    if (gDose && cDose){
      const gMcg = doseToMcg(gDose), cMcg = doseToMcg(cDose);
      if (gMcg != null && cMcg != null && Math.abs(gMcg - cMcg) < 0.01) doseMatch = 1;
      else doseMatch = -1;  // doses present and differ → strong signal NOT same
    }

    // Stem overlap
    let stemMatch = 0;
    gStems.forEach(s => { if (cStems.has(s)) stemMatch++; });

    const score =
        exactPriceMatches * 5
      + near10Matches     * 2
      + (doseMatch === 1 ? 4 : 0)
      + stemMatch         * 3
      - priceDisagreements * 4
      + (doseMatch === -1 ? -8 : 0);  // doses don't match → big penalty

    return {
      score, sharedVendors,
      exactPriceMatches, near10Matches, priceDisagreements,
      doseMatch, stemMatch, gDose, cDose,
    };
  }

  // Return list of (garbage, suggestion) decisions.
  // Per-row classification:
  //   high-confidence merge:  score >= 10 AND at least 1 exactPriceMatch
  //   low-confidence merge:   score >= 5
  //   delete candidate:       score < 3 AND no stem found AND multiple noise reasons
  //   keep / review:          everything else
  function tmpAnalyzePriceTable(){
    if (!window.S || !S.prices) return { garbageRows: [], suggestions: [], summary: 'No price data.' };
    const allNames = Object.keys(S.prices);
    const flagged = [];
    const clean = [];
    allNames.forEach(n => {
      const reasons = garbageReasons(n);
      if (reasons.length) flagged.push({ name:n, reasons });
      else clean.push(n);
    });

    const suggestions = flagged.map(g => {
      // Try every clean row as a candidate.
      let best = null;
      clean.forEach(cName => {
        const s = scorePair(g.name, cName);
        if (!best || s.score > best.score) best = { ...s, target:cName };
      });

      let action, label;
      if (best && best.score >= 10 && best.exactPriceMatches >= 1){
        action = 'merge-high';
        label = 'Merge into ' + best.target + ' (high confidence)';
      } else if (best && best.score >= 5){
        action = 'merge-low';
        label = 'Likely match: ' + best.target + ' (review)';
      } else {
        const stems = nameStems(g.name);
        const hasStem = stems.size > 0;
        const noisy = g.reasons.length >= 2;
        if (!hasStem && noisy){
          action = 'delete';
          label = 'No peptide stem, multiple noise signals — delete';
        } else {
          action = 'review';
          label = 'No confident match — keep / rename manually';
        }
      }

      return {
        fromName: g.name,
        reasons: g.reasons,
        action,
        label,
        targetName: (best && action.startsWith('merge')) ? best.target : null,
        score: best ? best.score : 0,
        signals: best || null,
      };
    });

    // Sort: high-confidence merges first, then low-confidence, then delete, then review
    const order = { 'merge-high':0, 'merge-low':1, 'delete':2, 'review':3 };
    suggestions.sort((a,b) => (order[a.action] - order[b.action]) || (b.score - a.score));

    return {
      garbageRows: flagged,
      suggestions,
      summary: flagged.length + ' suspicious rows / ' + allNames.length + ' total · ' +
        suggestions.filter(s=>s.action==='merge-high').length + ' high-conf merges · ' +
        suggestions.filter(s=>s.action==='merge-low').length + ' low-conf merges · ' +
        suggestions.filter(s=>s.action==='delete').length + ' delete candidates · ' +
        suggestions.filter(s=>s.action==='review').length + ' need review',
    };
  }
  window.tmpAnalyzePriceTable = tmpAnalyzePriceTable;

  // Convenience: pretty-print to console.
  window.tmpDescribeCleanup = function(){
    const r = tmpAnalyzePriceTable();
    console.log('%c'+r.summary, 'font-weight:700;color:#7C3AED');
    if (!r.suggestions.length) return r;
    const grouped = {};
    r.suggestions.forEach(s => { (grouped[s.action] = grouped[s.action] || []).push(s); });
    Object.keys(grouped).forEach(action => {
      console.groupCollapsed('%c'+action+' ('+grouped[action].length+')',
        action==='merge-high'?'color:#059669;font-weight:700':
        action==='merge-low' ?'color:#D97706;font-weight:700':
        action==='delete'    ?'color:#991B1B;font-weight:700':
                              'color:#475569;font-weight:700');
      grouped[action].forEach(s => {
        console.log('%c"'+s.fromName+'"', 'font-weight:600',
          '→', s.label,
          s.signals
            ? '(score '+s.signals.score+' · exact '+s.signals.exactPriceMatches+
              ' · near '+s.signals.near10Matches+' · dose '+s.signals.doseMatch+
              ' · stem '+s.signals.stemMatch+')'
            : '');
        if (s.reasons.length) console.log('   reasons:', s.reasons.join(', '));
      });
      console.groupEnd();
    });
    return r;
  };
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.tmpGetWarehouseFilter) return;
  const ALL_WH = ['US','CN','CA','EU'];
  const KEY = 'tmp.priceTable.warehouses';
  const DEFAULT_WAREHOUSE = 'CN';

  function getFilter(){
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return new Set(ALL_WH);
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return new Set(ALL_WH);
      return new Set(arr.filter(x => ALL_WH.indexOf(x) >= 0));
    } catch(_){ return new Set(ALL_WH); }
  }
  function setFilter(set){
    try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch(_){}
  }
  window.tmpGetWarehouseFilter = getFilter;
  window.tmpSetWarehouseFilter = setFilter;

  // Detect a warehouse suffix on a vendor name. Returns {base, warehouse} or null.
  // Handles: ' US', '-US', '_US', '(US)', ' USA', '(USA)', etc. (case-insensitive)
  function extractWarehouse(vendorName){
    if (!vendorName) return null;
    const v = String(vendorName).toUpperCase().trim();
    const patterns = [
      [/[\s\-_]*\(?CHINA\)?$/i,    'CN'],
      [/[\s\-_]*\(?CANADA\)?$/i,   'CA'],
      [/[\s\-_]*\(?USA?\)?$/i,     'US'],
      [/[\s\-_]*\(?EUROPE\)?$/i,   'EU'],
      [/[\s\-_]+\(?CN\)?$/i,       'CN'],
      [/[\s\-_]+\(?CA\)?$/i,       'CA'],
      [/[\s\-_]+\(?EU\)?$/i,       'EU'],
    ];
    for (const [re, code] of patterns){
      const m = v.match(re);
      if (m){
        const base = v.slice(0, v.length - m[0].length).trim();
        if (base) return { base, warehouse: code };
      }
    }
    return null;
  }
  window.tmpExtractWarehouse = extractWarehouse;

  // Idempotent migration: restructure S.prices vendor entries from numeric prices
  // to {warehouse:price} objects. Suffixed vendors are stripped to base+warehouse.
  // No-suffix vendors default to CN. Marked complete via S._warehouseMigration_v1.
  function migrate(){
    if (typeof window.S === 'undefined' || !window.S) return false;
    if (window.S._warehouseMigration_v1) return false;
    let changed = 0;

    // (a) S.vendors: strip suffixes, dedupe.
    if (Array.isArray(window.S.vendors)){
      const seen = new Set();
      const out = [];
      window.S.vendors.forEach(v => {
        const wh = extractWarehouse(v);
        const base = wh ? wh.base : String(v||'').trim();
        if (!base) return;
        if (!seen.has(base)){
          seen.add(base);
          out.push(base);
        }
        if (base !== v) changed++;
      });
      window.S.vendors = out;
    }

    // (b) S.prices: rebuild each row's vendor map as {base: {warehouse: price}}.
    if (window.S.prices && typeof window.S.prices === 'object'){
      Object.keys(window.S.prices).forEach(pep => {
        const oldRow = window.S.prices[pep];
        if (!oldRow || typeof oldRow !== 'object') return;
        const newRow = {};
        Object.keys(oldRow).forEach(vendor => {
          const value = oldRow[vendor];
          if (value == null) return;
          const wh = extractWarehouse(vendor);
          const base = wh ? wh.base : String(vendor||'').trim();
          if (!base) return;
          if (!newRow[base]) newRow[base] = {};
          // Already-migrated nested object?
          if (typeof value === 'object'){
            Object.keys(value).forEach(whCode => {
              const v = +value[whCode];
              if (!isFinite(v) || v <= 0) return;
              if (newRow[base][whCode] != null){
                newRow[base][whCode] = Math.min(newRow[base][whCode], v);
              } else {
                newRow[base][whCode] = v;
              }
            });
          } else {
            const code = wh ? wh.warehouse : DEFAULT_WAREHOUSE;
            const num = +value;
            if (!isFinite(num) || num <= 0) return;
            if (newRow[base][code] != null){
              newRow[base][code] = Math.min(newRow[base][code], num);
            } else {
              newRow[base][code] = num;
            }
            changed++;
          }
        });
        window.S.prices[pep] = newRow;
      });
    }

    window.S._warehouseMigration_v1 = true;
    if (changed > 0){
      try { if (typeof save === 'function') save(); } catch(_){}
      try { if (typeof renderPrices === 'function') renderPrices(); } catch(_){}
      console.log('[v19a] Warehouse migration: restructured', changed, 'vendor/price entries.');
    }
    return changed > 0;
  }

  // Wire the filter pills.
  function applyPillState(){
    const filter = getFilter();
    document.querySelectorAll('.tmp-wh-pill').forEach(b => {
      const on = filter.has(b.dataset.wh);
      b.classList.toggle('is-on', on);
    });
  }
  function wirePills(){
    const pills = document.querySelectorAll('.tmp-wh-pill');
    if (!pills.length) return false;
    pills.forEach(b => {
      if (b.__tmpWired) return;
      b.__tmpWired = true;
      b.addEventListener('click', () => {
        const filter = getFilter();
        if (filter.has(b.dataset.wh)){
          if (filter.size <= 1) {
            // Don't allow zero — flash and bail
            b.animate([{transform:'translateX(-2px)'},{transform:'translateX(2px)'},{transform:'none'}], {duration:180});
            return;
          }
          filter.delete(b.dataset.wh);
        } else {
          filter.add(b.dataset.wh);
        }
        setFilter(filter);
        applyPillState();
        try { if (typeof renderPrices === 'function') renderPrices(); } catch(_){}
      });
    });
    applyPillState();
    return true;
  }

  function init(){
    // Migration first, then UI wiring
    let tries = 0;
    const tryMigrate = () => {
      if (migrate()) return;
      if (typeof window.S !== 'undefined' && window.S && window.S._warehouseMigration_v1) return;
      if (++tries < 20) setTimeout(tryMigrate, 200);
    };
    tryMigrate();

    let pillTries = 0;
    const tryPills = () => {
      if (wirePills()) return;
      if (++pillTries < 20) setTimeout(tryPills, 200);
    };
    tryPills();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.__tmpAutoBackupInstalled) return;
  window.__tmpAutoBackupInstalled = true;

  const SLOTS = ['tmp.backup.0','tmp.backup.1','tmp.backup.2'];
  const THROTTLE_MS = 5 * 60 * 1000;       // min gap between new snapshots
  const PRIMARY_KEY = 'peptide_tracker';   // existing TMP storage key

  // Take a snapshot if the most recent backup is older than THROTTLE_MS.
  // Snapshot picks the oldest slot to overwrite (LRU rotation).
  function snapshot(){
    try {
      const payload = localStorage.getItem(PRIMARY_KEY);
      if (!payload) return;  // nothing to back up
      // Skip if the primary state is empty/trivial — avoid overwriting good
      // backups with an empty state during the brief window between page-load
      // and S-hydration.
      if (payload.length < 50) return;

      const now = Date.now();
      const slots = SLOTS.map(k => {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) return { key:k, ts:0, payload:null };
          const meta = JSON.parse(raw);
          return { key:k, ts: +meta.ts || 0, payload: meta.payload };
        } catch(_) { return { key:k, ts:0, payload:null }; }
      });

      // Find newest existing snapshot — gate on throttle.
      const newest = Math.max(...slots.map(s => s.ts));
      if (now - newest < THROTTLE_MS) return;  // too soon

      // Skip if payload is byte-identical to the newest backup.
      const newestSlot = slots.find(s => s.ts === newest);
      if (newestSlot && newestSlot.payload === payload) return;

      // Pick the oldest slot to overwrite.
      let target = slots[0];
      slots.forEach(s => { if (s.ts < target.ts) target = s; });

      try {
        localStorage.setItem(target.key, JSON.stringify({ ts: now, payload }));
      } catch(e){
        // localStorage quota exceeded — try to free space by clearing the
        // oldest slot and retrying once.
        try {
          const oldest = slots.reduce((a,b) => a.ts < b.ts ? a : b);
          localStorage.removeItem(oldest.key);
          localStorage.setItem(target.key, JSON.stringify({ ts: now, payload }));
        } catch(_){ console.warn('[v20] backup snapshot failed (quota?):', e); }
      }
    } catch(e){ console.error('[v20] snapshot error:', e); }
  }
  window.tmpBackupSnapshot = snapshot;

  // List backup slots, newest first. Returns [{key, ts, payload, sizeBytes}].
  function listBackups(){
    return SLOTS.map(k => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return null;
        const meta = JSON.parse(raw);
        if (!meta || !meta.payload || !meta.ts) return null;
        return { key:k, ts: meta.ts, payload: meta.payload, sizeBytes: meta.payload.length };
      } catch(_) { return null; }
    }).filter(Boolean).sort((a,b) => b.ts - a.ts);
  }
  window.tmpListBackups = listBackups;

  // Hook the existing save() function so every save also (throttled) snapshots.
  function hookSave(){
    if (typeof window.save !== 'function') return false;
    if (window.save.__tmpAutoBackupHooked) return true;
    const orig = window.save;
    // Save-chain merge: core's _flushSaveNow now invokes window.tmpBackupSnapshot
    // directly after every successful flush, so no wrapper is needed. The
    // snapshot function stays exported (set above) and stays throttled.
    orig.__tmpAutoBackupHooked = true; // keep the marker so we don't re-enter
    return true;
  }

  // Save-on-tab-close. visibilitychange fires more reliably than beforeunload
  // on mobile/desktop browsers. Both call the existing save() (which writes to
  // all three storage layers) so any in-memory changes get persisted.
  function wireCloseSave(){
    function flush(){
      try { if (typeof window.save === 'function') window.save(); } catch(_){}
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }

  // Heuristic: is the live S "empty" enough that we should offer a restore?
  // Empty means: no shots, no peptides (filtering supplies/blends), no scheduled
  // cells, no vials, no packages. This is the "user just lost their data" case.
  // Also treat "inventory wiped" (0 peptides) as empty even if other crumbs remain.
  function isLiveEmpty(){
    const S = window.S;
    if (!S || typeof S !== 'object') return true;
    const shots = Array.isArray(S.shots) ? S.shots.length : 0;
    const peps = Array.isArray(S.inv) ? S.inv.filter(i => i && !i.isSupply).length : 0;
    const sched = (S.sched && typeof S.sched === 'object') ? Object.keys(S.sched).filter(k => S.sched[k]).length : 0;
    const vials = Array.isArray(S.vials) ? S.vials.length : 0;
    const pkgs = Array.isArray(S.packages) ? S.packages.length : 0;
    if (peps === 0 && vials === 0) return true;
    return (shots + peps + sched + vials + pkgs) === 0;
  }

  function inventoryMissingButBackupExists(){
    try {
      const peps = Array.isArray(S.inv) ? S.inv.filter(i => i && !i.isSupply).length : 0;
      if (peps > 0) return null;
      const backups = listBackups();
      for (const b of backups) {
        const summary = (()=>{ try {
          const p = JSON.parse(b.payload);
          return (p.inv||[]).filter(i=>i&&!i.isSupply).length;
        } catch(_){ return 0; } })();
        if (summary > 0) return b;
      }
    } catch(_){}
    return null;
  }

  function fmtAgo(ts){
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m === 1) return '1 minute ago';
    if (m < 60) return m + ' minutes ago';
    const h = Math.round(m/60);
    if (h === 1) return '1 hour ago';
    if (h < 24) return h + ' hours ago';
    const d = Math.round(h/24);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }

  function summarizeSnapshot(payload){
    try {
      const parsed = JSON.parse(payload);
      const peps = Array.isArray(parsed.inv) ? parsed.inv.filter(i => i && !i.isSupply).length : 0;
      const shots = Array.isArray(parsed.shots) ? parsed.shots.length : 0;
      const vials = Array.isArray(parsed.vials) ? parsed.vials.length : 0;
      const pkgs = Array.isArray(parsed.packages) ? parsed.packages.length : 0;
      const parts = [];
      if (peps)  parts.push(peps + ' peptide' + (peps!==1?'s':''));
      if (shots) parts.push(shots + ' shot' + (shots!==1?'s':''));
      if (vials) parts.push(vials + ' vial' + (vials!==1?'s':''));
      if (pkgs)  parts.push(pkgs + ' package' + (pkgs!==1?'s':''));
      return parts.length ? parts.join(' · ') : 'some data';
    } catch(_){ return 'some data'; }
  }

  // Restore from a backup payload. Mutates window.S in place, then calls save().
  function restoreFromPayload(payload){
    try {
      const parsed = JSON.parse(payload);
      if (!parsed || typeof parsed !== 'object') {
        alert('Backup looks corrupt — not restoring.');
        return false;
      }
      window._tmpBypassCalEnforce = true;
      try {
        try { if (window.tmpCalClearGuard) tmpCalClearGuard.clear(); } catch(_){}
        // Prefer field-by-field restore — never delete all keys on S (defineProperty
        // sched guards can make a full wipe leave S in a broken empty state).
        if (Array.isArray(parsed.inv)) S.inv = parsed.inv;
        if (Array.isArray(parsed.vials)) S.vials = parsed.vials;
        // SHOT-PERSIST-R1: never replace live shots with a smaller backup set.
        if (Array.isArray(parsed.shots)) {
          S.shots = (typeof mergeShotArrays === 'function')
            ? mergeShotArrays(S.shots, parsed.shots)
            : parsed.shots;
        }
        if (parsed.sched && typeof parsed.sched === 'object') S.sched = parsed.sched;
        if (Array.isArray(parsed.stackPlan)) S.stackPlan = parsed.stackPlan;
        if (Array.isArray(parsed.packages)) S.packages = parsed.packages;
        if (Array.isArray(parsed.vendors)) S.vendors = parsed.vendors;
        if (parsed.prices) S.prices = parsed.prices;
        if (parsed.nI != null) S.nI = parsed.nI;
        if (parsed.nV != null) S.nV = parsed.nV;
        if (parsed.nS != null && (!S.nS || Number(parsed.nS) > Number(S.nS))) S.nS = parsed.nS;
        S._hadSaved = true;
      } finally {
        window._tmpBypassCalEnforce = false;
      }
      try { if (typeof saveNow === 'function') saveNow(); else if (typeof save === 'function') save(); } catch(_){}
      try { if (typeof tmpRefreshAll === 'function') tmpRefreshAll(); } catch(_){}
      try { if (typeof renderInventoryPage === 'function') renderInventoryPage(); } catch(_){}
      try { if (typeof renderInv === 'function') renderInv(true); } catch(_){}
      try { if (typeof renderStack === 'function') renderStack(); } catch(_){}
      try { if (typeof renderCal === 'function') renderCal({force:true}); } catch(_){}
      try { if (typeof renderLogShotRows === 'function') renderLogShotRows(); } catch(_){}
      return true;
    } catch(e){
      console.error('[v20] restore failed:', e);
      alert('Restore failed: ' + e.message);
      return false;
    }
  }

  // Show the restore prompt. Called only when live state is empty AND a
  // recent backup is available.
  function showRestorePrompt(backups){
    const newest = backups[0];
    const card = document.getElementById('tmp-restore-prompt');
    const body = document.getElementById('tmp-restore-body');
    if (!card || !body) return;

    const summary = summarizeSnapshot(newest.payload);
    const ago = fmtAgo(newest.ts);
    let html = ''
      + '<b>Newest backup contains:</b> ' + summary + ' (saved ' + ago + ')'
      + '<ul>'
      +   '<li>Click <b>Restore backup</b> to replace your current empty state with this snapshot.</li>'
      +   '<li>Click <b>Skip / start fresh</b> to ignore the backup and use PeptideGenius as if new.</li>'
      + '</ul>';
    if (backups.length > 1){
      html += '<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600;font-size:11.5px">'
            + 'Older backups (' + (backups.length - 1) + ')</summary>'
            + '<ul style="margin-top:4px">'
            + backups.slice(1).map(b => '<li>'+ summarizeSnapshot(b.payload) +' — '+ fmtAgo(b.ts) +'</li>').join('')
            + '</ul></details>';
    }
    body.innerHTML = html;
    card.classList.add('show');
    card.setAttribute('aria-hidden','false');

    const goBtn = document.getElementById('tmp-restore-go');
    const skipBtn = document.getElementById('tmp-restore-skip');
    function close(){ card.classList.remove('show'); card.setAttribute('aria-hidden','true'); }
    goBtn.onclick = () => { if (restoreFromPayload(newest.payload)) close(); };
    skipBtn.onclick = close;
  }

  function init(){
    hookSave();
    wireCloseSave();

    // Also re-hook periodically — in case some late-loading code overwrote save.
    let pollLeft = 12;
    const poll = setInterval(() => {
      hookSave();
      if (--pollLeft <= 0) clearInterval(poll);
    }, 250);

    // After load + S hydration: check for restore-on-empty.
    let tries = 0;
    const check = () => {
      if (typeof window.S === 'undefined' || !window.S){
        if (++tries < 30) setTimeout(check, 200);
        return;
      }
      // Don't prompt if save flag was set to indicate "user explicitly cleared"
      // (e.g. clear-all just ran with undo still active). Tombstone is set/cleared
      // via S.__tmp_clear_tombstone.
      if (window.S.__tmp_clear_tombstone) return;
      // If inventory peptides are gone but a backup still has them, auto-restore
      // (do not wait for a fully empty state — schedule-clear bugs can wipe inv
      // while leaving other crumbs that previously skipped this prompt).
      const missingInvBackup = inventoryMissingButBackupExists();
      if (missingInvBackup) {
        try {
          console.warn('[v20] inventory missing — auto-restoring from', missingInvBackup.key);
          if (restoreFromPayload(missingInvBackup.payload)) {
            try {
              if (typeof window.tmpInventoryToast === 'function') {
                window.tmpInventoryToast('✓ Inventory restored from automatic backup', summarizeSnapshot(missingInvBackup.payload));
              }
            } catch(_){}
            return;
          }
        } catch(e){ console.warn('[v20] auto inventory restore failed', e); }
      }
      if (!isLiveEmpty()) {
        // Healthy state — take an opportunistic snapshot.
        snapshot();
        return;
      }
      const backups = listBackups();
      if (!backups.length) return;
      // Don't prompt if backup is older than 90 days (probably stale orphan).
      if (Date.now() - backups[0].ts > 90 * 24 * 3600 * 1000) return;
      showRestorePrompt(backups);
    };
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', () => setTimeout(check, 400));
    } else {
      setTimeout(check, 400);
    }
  }

  // SHOT-PERSIST-R1: merge shots from every auto-backup slot + IndexedDB into
  // live S.shots without wiping inventory/schedule. Use when logs vanish.
  async function recoverMissingShots(opts){
    opts = opts || {};
    const before = Array.isArray(S.shots) ? S.shots.length : 0;
    let merged = Array.isArray(S.shots) ? S.shots.slice() : [];
    const sources = [];
    function absorbPayload(label, payload){
      try {
        const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (!p || !Array.isArray(p.shots) || !p.shots.length) return;
        const merge = typeof mergeShotArrays === 'function' ? mergeShotArrays : function(a,b){ return (a||[]).concat(b||[]); };
        const next = merge(merged, p.shots);
        if (next.length > merged.length) sources.push(label + ' (+' + (next.length - merged.length) + ')');
        merged = next;
        if (p.nS != null && (!S.nS || Number(p.nS) > Number(S.nS))) S.nS = p.nS;
      } catch(_){}
    }
    SLOTS.forEach(function(k){
      try {
        const meta = JSON.parse(localStorage.getItem(k) || 'null');
        if (meta && meta.payload) absorbPayload(k, meta.payload);
      } catch(_){}
    });
    try {
      const primary = localStorage.getItem(PRIMARY_KEY);
      if (primary) absorbPayload('peptide_tracker', primary);
    } catch(_){}
    try {
      if (typeof idbGet === 'function') {
        const mirrored = await idbGet();
        if (mirrored) absorbPayload('indexedDB', mirrored);
      }
    } catch(_){}
    const after = merged.length;
    const added = after - before;
    if (added <= 0 && !opts.force) {
      if (!opts.silent) {
        try {
          if (window.tmpInventoryToast) tmpInventoryToast('No extra shots found in backups', 'Live log already has ' + before + ' shot' + (before===1?'':'s') + '.', 5000);
          else alert('No extra shots found in automatic backups. Live log: ' + before + ' shots.');
        } catch(_){}
      }
      return { ok:true, before:before, after:after, added:0, sources:sources };
    }
    S.shots = merged;
    S._hadSaved = true;
    try { if (typeof saveNow === 'function') saveNow(); else if (typeof save === 'function') save(); } catch(_){}
    try { if (typeof renderLogShotRows === 'function') renderLogShotRows(); } catch(_){}
    try { if (typeof renderCal === 'function') renderCal({force:true}); } catch(_){}
    try { if (typeof refreshAfterShotChange === 'function') refreshAfterShotChange(); } catch(_){}
    if (!opts.silent) {
      const msg = added > 0
        ? ('✓ Recovered ' + added + ' missing shot' + (added===1?'':'s') + ' (now ' + after + ' total)')
        : ('Shot log refreshed — ' + after + ' total');
      try {
        if (window.tmpInventoryToast) tmpInventoryToast(msg, sources.join(' · ') || 'from local backups', 6000);
        else alert(msg);
      } catch(_){}
    }
    return { ok:true, before:before, after:after, added:added, sources:sources };
  }
  window.tmpRecoverMissingShots = recoverMissingShots;

  function showMissingShotsBanner(info){
    if (!info || !info.added || info.added <= 0) return;
    if (document.getElementById('tmp-shots-recover-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'tmp-shots-recover-banner';
    bar.style.cssText = 'margin:0 0 12px;padding:12px 16px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:10px;color:#92400E;font-size:13px;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;line-height:1.5';
    bar.innerHTML = ''
      + '<span style="font-size:20px;flex-shrink:0">💉</span>'
      + '<div style="flex:1;min-width:220px">'
      +   '<div style="font-weight:700;margin-bottom:3px">Missing shots found in automatic backup</div>'
      +   '<div style="font-size:12.5px">A local backup has <b>' + info.added + ' shot' + (info.added===1?'':'s') + '</b> that are not in your live log (often from last night). Restore them without changing inventory.</div>'
      + '</div>'
      + '<div style="display:flex;gap:6px;flex-shrink:0">'
      +   '<button type="button" class="btn bb" id="tmp-shots-recover-go" style="padding:5px 12px;font-size:12px;font-weight:600;background:#D97706;border-color:#B45309;color:#fff">Restore missing shots</button>'
      +   '<button type="button" class="btn" id="tmp-shots-recover-skip" style="padding:5px 12px;font-size:12px">Dismiss</button>'
      + '</div>';
    const app = document.querySelector('.app');
    const nav = document.getElementById('nav');
    if (app && nav) app.insertBefore(bar, nav);
    else if (app) app.insertBefore(bar, app.firstChild);
    bar.querySelector('#tmp-shots-recover-go').onclick = function(){
      recoverMissingShots({ force:true }).then(function(){ bar.remove(); });
    };
    bar.querySelector('#tmp-shots-recover-skip').onclick = function(){ bar.remove(); };
  }

  function scanForMissingShots(){
    try {
      if (!window.S) return;
      const live = Array.isArray(S.shots) ? S.shots.length : 0;
      let best = 0;
      SLOTS.forEach(function(k){
        try {
          const meta = JSON.parse(localStorage.getItem(k) || 'null');
          if (!meta || !meta.payload) return;
          const p = JSON.parse(meta.payload);
          const n = Array.isArray(p.shots) ? p.shots.length : 0;
          if (n > best) best = n;
        } catch(_){}
      });
      if (best > live) showMissingShotsBanner({ added: best - live });
    } catch(_){}
  }

  init();
  setTimeout(scanForMissingShots, 900);
  setTimeout(scanForMissingShots, 2500);
})();


// ===== Backup reminder popup (regular + after significant changes) =====
(function(){
  if (window.__tmpBackupRemindInstalled) return;
  window.__tmpBackupRemindInstalled = true;

  const NEXT_KEY = 'tmp.backupReminder.nextAt';       // regular cadence
  const EVENT_KEY = 'tmp.backupReminder.nextEventAt'; // after shot/inventory/etc.
  const LAST_KEY = 'tmp.backupReminder.lastBackupAt';
  const DAY = 24 * 60 * 60 * 1000;
  const LATER_MS = 12 * 60 * 60 * 1000;   // "later" = 12 hours
  const WEEK_MS = 7 * DAY;
  const REGULAR_GAP_MS = 2 * DAY;          // every ~2 days on open
  const EVENT_GAP_MS = 4 * 60 * 60 * 1000; // at most ~every 4h for change prompts
  const STALE_BACKUP_MS = 1 * DAY;         // force offer if no file backup in 24h

  let _pendingReason = 'regular';
  let _debounceTimer = null;
  let _activeReason = 'regular';
  let _retryTimer = null;

  const COPY = {
    regular: {
      title: 'Back up your tracker?',
      sub: 'Your shots and inventory live only in this browser. A quick JSON backup protects you if something gets cleared or overwritten.'
    },
    shot: {
      title: 'You just logged shots',
      sub: 'Want to back up your data now? That keeps tonight\u2019s log safe if this browser clears or another tab overwrites it.'
    },
    inventory: {
      title: 'You updated inventory',
      sub: 'Want to back up your data now? New peptides, stock, and vials only live in this browser until you save a file.'
    },
    vial: {
      title: 'You changed vials',
      sub: 'Want to back up your data now? Vial counts and recon dates are easy to lose without a file backup.'
    },
    schedule: {
      title: 'You changed your schedule',
      sub: 'Want to back up your data now? Calendar and stack changes stay local until you download a backup.'
    },
    change: {
      title: 'You made an important change',
      sub: 'Want to back up your data now? A JSON file is the safest way to keep PeptideGenius recoverable.'
    }
  };

  function readNum(key){
    try { return Number(localStorage.getItem(key) || 0) || 0; } catch(_){ return 0; }
  }
  function writeNum(key, n){
    try { localStorage.setItem(key, String(n)); } catch(_){}
  }
  function snoozeRegular(ms){ writeNum(NEXT_KEY, Date.now() + ms); }
  function snoozeEvent(ms){ writeNum(EVENT_KEY, Date.now() + ms); }
  function snoozeBoth(ms){ snoozeRegular(ms); snoozeEvent(ms); }

  function hasDataWorthBackingUp(){
    try {
      if (!window.S) return false;
      const shots = Array.isArray(S.shots) ? S.shots.length : 0;
      const peps = Array.isArray(S.inv) ? S.inv.filter(i => i && !i.isSupply).length : 0;
      return shots > 0 || peps > 0;
    } catch(_){ return false; }
  }

  function isVisibleModal(el){
    if (!el) return false;
    const d = (el.style && el.style.display) || '';
    if (d === 'none') return false;
    if (el.classList && el.classList.contains('show')) return true;
    if (d === 'block' || d === 'flex') return true;
    try {
      const cs = window.getComputedStyle(el);
      return cs && cs.display !== 'none' && cs.visibility !== 'hidden';
    } catch(_){ return false; }
  }

  function restorePromptOpen(){
    return isVisibleModal(document.getElementById('tmp-restore-prompt'));
  }
  function shotsBannerOpen(){
    return !!document.getElementById('tmp-shots-recover-banner');
  }
  function schedulePromptOpen(){
    // Only treat as open when actually displayed — do NOT trust aria-hidden alone
    // (it can stay false while display:none and permanently block reminders).
    const m = document.getElementById('pt-sched-prompt');
    if (!m) return false;
    return m.style.display === 'block' || m.style.display === 'flex';
  }
  function backupModalOpen(){
    return isVisibleModal(document.getElementById('tmp-backup-remind'));
  }

  function fmtAgo(ts){
    if (!ts) return 'never';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
    const d = Math.round(h / 24);
    return d + ' day' + (d === 1 ? '' : 's') + ' ago';
  }

  function backupIsStale(){
    const last = readNum(LAST_KEY);
    return !last || (Date.now() - last) >= STALE_BACKUP_MS;
  }

  function blockersOpen(){
    return restorePromptOpen() || shotsBannerOpen() || schedulePromptOpen() || backupModalOpen();
  }

  function shouldShowRegular(){
    if (!hasDataWorthBackingUp()) return false;
    if (blockersOpen()) return false;
    const nextAt = readNum(NEXT_KEY);
    if (nextAt && Date.now() < nextAt) return false;
    return true;
  }

  function shouldShowEvent(forceStale){
    if (!hasDataWorthBackingUp()) return false;
    if (blockersOpen()) return false;
    // Stale / never-backed-up: always allow after a significant change.
    if (forceStale && backupIsStale()) return true;
    const nextEv = readNum(EVENT_KEY);
    if (nextEv && Date.now() < nextEv) return false;
    return true;
  }

  function close(){
    const el = document.getElementById('tmp-backup-remind');
    if (!el) return;
    el.classList.remove('show');
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  }

  function show(reason){
    const el = document.getElementById('tmp-backup-remind');
    const body = document.getElementById('tmp-backup-remind-body');
    const title = document.getElementById('tmp-backup-remind-title');
    const sub = document.getElementById('tmp-backup-remind-sub');
    if (!el || !body) {
      console.warn('[backup-remind] modal markup missing');
      return false;
    }
    _activeReason = COPY[reason] ? reason : 'regular';
    const copy = COPY[_activeReason] || COPY.regular;
    if (title) title.textContent = copy.title;
    if (sub) sub.textContent = copy.sub;
    const last = readNum(LAST_KEY);
    const shots = (window.S && Array.isArray(S.shots)) ? S.shots.length : 0;
    const peps = (window.S && Array.isArray(S.inv)) ? S.inv.filter(i => i && !i.isSupply).length : 0;
    body.innerHTML = ''
      + '<ul>'
      +   '<li>Last file backup: <b>' + fmtAgo(last) + '</b></li>'
      +   '<li>Currently tracking: <b>' + shots + '</b> shot' + (shots === 1 ? '' : 's')
      +     (peps ? (' \u00b7 <b>' + peps + '</b> peptide' + (peps === 1 ? '' : 's')) : '') + '</li>'
      +   '<li>Backup downloads a JSON file you can Import later (triple-tap the logo).</li>'
      + '</ul>';
    el.classList.add('show');
    el.style.display = 'flex';
    el.setAttribute('aria-hidden', 'false');
    try {
      const go = document.getElementById('tmp-backup-remind-go');
      if (go) go.focus();
    } catch(_){}
    return true;
  }

  function doBackup(){
    snoozeBoth(WEEK_MS);
    close();
    try {
      if (typeof window.doExport === 'function') window.doExport('my-tracker-manual-');
      else alert('Backup is still loading \u2014 triple-tap the syringe logo, then tap Save backup.');
    } catch(e){
      alert('Backup failed: ' + (e && e.message ? e.message : e));
    }
  }

  function wire(){
    const go = document.getElementById('tmp-backup-remind-go');
    const later = document.getElementById('tmp-backup-remind-later');
    const week = document.getElementById('tmp-backup-remind-week');
    const el = document.getElementById('tmp-backup-remind');
    if (!go || !later || !week || !el) return false;
    if (el.dataset.wired === '1') return true;
    el.dataset.wired = '1';
    go.addEventListener('click', doBackup);
    later.addEventListener('click', function(){
      if (_activeReason === 'regular') snoozeRegular(LATER_MS);
      else snoozeEvent(LATER_MS);
      close();
    });
    week.addEventListener('click', function(){ snoozeBoth(WEEK_MS); close(); });
    el.addEventListener('click', function(e){
      if (e.target === el) {
        if (_activeReason === 'regular') snoozeRegular(LATER_MS);
        else snoozeEvent(LATER_MS);
        close();
      }
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && el.classList.contains('show')) {
        if (_activeReason === 'regular') snoozeRegular(LATER_MS);
        else snoozeEvent(LATER_MS);
        close();
      }
    });
    return true;
  }

  function maybeShowRegular(){
    if (!wire()) return;
    if (!shouldShowRegular()) return;
    if (show('regular')) snoozeRegular(REGULAR_GAP_MS);
  }

  function tryShowEvent(reason, attempt){
    attempt = attempt || 0;
    if (!wire()) return;
    if (schedulePromptOpen() || restorePromptOpen() || shotsBannerOpen()) {
      if (attempt >= 4) return;
      if (_retryTimer) clearTimeout(_retryTimer);
      _retryTimer = setTimeout(function(){ tryShowEvent(reason, attempt + 1); }, 2500);
      return;
    }
    const forceStale = (reason === 'shot' || reason === 'inventory' || reason === 'vial' || reason === 'schedule');
    if (!shouldShowEvent(forceStale)) return;
    if (show(reason || 'change')) snoozeEvent(EVENT_GAP_MS);
  }

  function requestBackupReminder(reason){
    _pendingReason = COPY[reason] ? reason : 'change';
    // 20260819: shot-triggered reminders only every 5th logged shot -
    // prompting on every single shot was too naggy.
    if (_pendingReason === 'shot'){
      var _sc = 0;
      try { _sc = parseInt(localStorage.getItem('tmp.backupShotCount')||'0',10)||0; } catch(_){}
      _sc++;
      try { localStorage.setItem('tmp.backupShotCount', String(_sc)); } catch(_){}
      if (_sc % 5 !== 0) return;
    }
    if (_debounceTimer) clearTimeout(_debounceTimer);
    const delay = (_pendingReason === 'shot') ? 4200 : 1400;
    _debounceTimer = setTimeout(function(){
      _debounceTimer = null;
      tryShowEvent(_pendingReason);
    }, delay);
  }

  window.tmpShowBackupReminder = function(reason){ wire(); show(reason || 'regular'); };
  window.tmpRequestBackupReminder = requestBackupReminder;
  window.tmpBackupReminderDebug = function(){
    const info = {
      lastBackupAt: readNum(LAST_KEY),
      lastBackupAgo: fmtAgo(readNum(LAST_KEY)),
      nextRegularAt: readNum(NEXT_KEY),
      nextRegularInMin: Math.round((readNum(NEXT_KEY) - Date.now()) / 60000),
      nextEventAt: readNum(EVENT_KEY),
      nextEventInMin: Math.round((readNum(EVENT_KEY) - Date.now()) / 60000),
      stale: backupIsStale(),
      blockers: {
        restore: restorePromptOpen(),
        shotsBanner: shotsBannerOpen(),
        schedule: schedulePromptOpen(),
        backup: backupModalOpen()
      },
      modalPresent: !!document.getElementById('tmp-backup-remind'),
      requestFn: typeof window.tmpRequestBackupReminder
    };
    console.log('[backup-remind]', info);
    return info;
  };
  window.tmpResetBackupReminder = function(){
    try {
      localStorage.removeItem(NEXT_KEY);
      localStorage.removeItem(EVENT_KEY);
    } catch(_){}
    console.log('[backup-remind] snoozes cleared \u2014 log a shot or run tmpShowBackupReminder()');
  };

  function boot(){
    setTimeout(maybeShowRegular, 3200);
    setTimeout(maybeShowRegular, 9000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


// ===== extracted post-core patch script =====
(function(){
  if (window.tmpFingerprintMatch) return;

  // Read all (vendor, warehouse, price) triples for a row, regardless of
  // whether row[vendor] is legacy number or new {warehouse:price} object.
  function flatPrices(pep){
    const row = (window.S && S.prices) ? S.prices[pep] : null;
    if (!row) return [];
    const out = [];
    Object.keys(row).forEach(v => {
      const cell = row[v];
      if (cell == null) return;
      if (typeof cell === 'number'){
        if (cell > 0) out.push({ vendor:v, warehouse:'CN', price:cell });
      } else if (typeof cell === 'object'){
        Object.keys(cell).forEach(wh => {
          const p = +cell[wh];
          if (p > 0) out.push({ vendor:v, warehouse:wh, price:p });
        });
      }
    });
    return out;
  }
  window.tmpFlatPrices = flatPrices;

  // Score how likely two rows are the same peptide based on price overlap.
  function scoreSamePeptide(rowA, rowB){
    const a = flatPrices(rowA), b = flatPrices(rowB);
    if (!a.length || !b.length) return 0;
    let exact = 0, near = 0, disagree = 0;
    a.forEach(ax => {
      // Find the matching (vendor+warehouse) entry on the other row, if any.
      const bx = b.find(y => y.vendor === ax.vendor && y.warehouse === ax.warehouse);
      if (!bx) return;
      const diff = Math.abs(ax.price - bx.price);
      if (diff < 0.01) exact++;
      else {
        const ratio = diff / Math.max(ax.price, bx.price);
        if (ratio <= 0.10) near++;
        else if (ratio > 0.30) disagree++;
      }
    });
    return exact*5 + near*2 - disagree*4;
  }

  // Find the best clean-row match for a flagged row. Returns {target, score}
  // or null when no candidate scores above the threshold.
  function tmpFingerprintMatch(rowName, candidateNames, opts){
    opts = opts || {};
    const minScore = opts.minScore != null ? opts.minScore : 5;
    let best = null;
    candidateNames.forEach(c => {
      if (c === rowName) return;
      const s = scoreSamePeptide(rowName, c);
      if (!best || s > best.score) best = { target:c, score:s };
    });
    if (!best || best.score < minScore) return null;
    return best;
  }
  window.tmpFingerprintMatch = tmpFingerprintMatch;
})();


// ===== extracted post-core patch script =====
(function(){
  // v25: hide + add. Re-runs cleanly even if previously installed.
  // Always overwrite the prior tmpRenderCatalog so v25's logic wins.
  function escH(s){return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);}

  function fmtHalfLife(hl){
    if (typeof hl !== 'number' || hl <= 0) return '—';
    if (hl >= 24) return (Math.round(hl/24*10)/10) + ' days';
    if (hl < 1)   return Math.round(hl*60) + ' min';
    return hl + ' hr';
  }

  function getCats(){
    if (typeof PEPTIDE_REF === 'undefined') return [];
    const set = new Set();
    PEPTIDE_REF.forEach(r => { if (r.cat) set.add(r.cat); });
    return [...set].sort();
  }

  function rowMatches(r, q, cat){
    if (cat && r.cat !== cat) return false;
    if (!q) return true;
    const ql = q.toLowerCase();
    const hay = [
      r.n, r.cat, r.use,
      ...(Array.isArray(r.tags) ? r.tags : []),
      ...(Array.isArray(r.goodWith) ? r.goodWith : []),
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(ql);
  }

  function renderCard(r, opts){
    opts = opts || {};
    const tags = (Array.isArray(r.tags) ? r.tags : []).slice(0, 3);
    const tagPills = tags.map(t =>
      '<span style="font-size:9.5px;font-weight:600;padding:1px 6px;border-radius:999px;background:#FCE7F3;color:#9D174D;border:.5px solid #FBCFE8">'+escH(t)+'</span>'
    ).join(' ');
    const moreTag = (r.tags && r.tags.length > 3) ? '<span style="font-size:9.5px;color:var(--color-text-tertiary);font-weight:500">+'+(r.tags.length-3)+'</span>' : '';
    const useText = r.use ? escH(String(r.use).slice(0, 90) + (String(r.use).length > 90 ? '…' : '')) : '';
    const accent = r.catC || '#BE185D';
    const isHidden = opts.isHidden;
    const isCustom = !!r._custom;
    const cardOpacity = isHidden ? 'opacity:.55;' : '';
    const customBadge = isCustom
      ? '<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;background:#FEF3C7;color:#92400E;border:.5px solid #FCD34D;letter-spacing:.04em;text-transform:uppercase">Custom</span>'
      : '';
    const hiddenBadge = isHidden
      ? '<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;background:#E5E7EB;color:#374151;border:.5px solid #D1D5DB;letter-spacing:.04em;text-transform:uppercase">Hidden</span>'
      : '';
    // Top-right action button. For custom: edit (✎). For built-in: hide (🗑).
    // For currently-hidden built-in: unhide (👁).
    let actionBtn = '';
    if (isCustom){
      actionBtn = '<button type="button" class="cat-card-edit" data-cat-name="'+escH(r.n).replace(/"/g,'&quot;')+'" title="Edit this custom peptide" style="position:absolute;top:6px;right:6px;background:transparent;border:.5px solid var(--color-border-tertiary);border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;color:var(--color-text-tertiary);line-height:1">✎</button>';
    } else if (isHidden){
      actionBtn = '<button type="button" class="cat-card-unhide" data-cat-name="'+escH(r.n).replace(/"/g,'&quot;')+'" title="Unhide this peptide" style="position:absolute;top:6px;right:6px;background:transparent;border:.5px solid var(--color-border-tertiary);border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;color:var(--color-text-tertiary);line-height:1">👁</button>';
    } else {
      actionBtn = '<button type="button" class="cat-card-hide" data-cat-name="'+escH(r.n).replace(/"/g,'&quot;')+'" title="Hide this peptide from your catalog" style="position:absolute;top:6px;right:6px;background:transparent;border:.5px solid var(--color-border-tertiary);border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;color:var(--color-text-tertiary);line-height:1">🗑</button>';
    }
    return ''
      + '<div class="cat-card" data-cat-name="'+escH(r.n)+'" '
      +      'style="position:relative;background:var(--color-background-primary);border:.5px solid var(--color-border-secondary);border-left:3px solid '+accent+';border-radius:10px;padding:11px 32px 11px 13px;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;display:flex;flex-direction:column;gap:6px;min-height:120px;'+cardOpacity+'">'
      +   actionBtn
      +   '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div style="font-size:13.5px;font-weight:700;color:var(--color-text-primary);line-height:1.2">'+escH(r.n)+'</div>' + customBadge + hiddenBadge + '</div>'
      +   '<div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:500">'+escH(r.cat||'')+(r.hl?' · '+fmtHalfLife(r.hl):'')+'</div>'
      +   (useText ? '<div style="font-size:11.5px;color:var(--color-text-secondary);line-height:1.45;flex:1">'+useText+'</div>' : '<div style="flex:1"></div>')
      +   (tagPills || moreTag ? '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:2px">'+tagPills+(moreTag?' '+moreTag:'')+'</div>' : '')
      + '</div>';
  }

  // Storage helpers — hidden built-ins + user-custom entries
  const HIDDEN_KEY = 'tmp.catalog.hidden';
  const USER_KEY   = 'tmp.catalog.user';
  function getHidden(){
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); }
    catch(_) { return new Set(); }
  }
  function setHidden(set){
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set])); } catch(_){}
  }
  function getUserCustom(){
    try {
      const arr = JSON.parse(localStorage.getItem(USER_KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.map(r => ({ ...r, _custom: true }));
    } catch(_) { return []; }
  }
  function setUserCustom(arr){
    // Strip the _custom flag before persisting (it's always re-added on read).
    const clean = arr.map(r => { const { _custom, ...rest } = r; return rest; });
    try { localStorage.setItem(USER_KEY, JSON.stringify(clean)); } catch(_){}
  }
  // Merged catalog list: built-ins + user-custom (sorted alphabetically)
  function allEntries(){
    const builtins = (typeof PEPTIDE_REF !== 'undefined' ? PEPTIDE_REF : []);
    const custom   = getUserCustom();
    return builtins.concat(custom);
  }
  window.tmpCatalogAllEntries = allEntries;

  let _showHidden = false;

  function renderCatalog(){
    const grid = document.getElementById('cat-grid');
    const countEl = document.getElementById('cat-count');
    const resultEl = document.getElementById('cat-result-count');
    const catSel = document.getElementById('cat-cat-filter');
    const search = document.getElementById('cat-search');
    const showBtn = document.getElementById('cat-show-hidden');
    if (!grid) return;

    const all = allEntries();
    const hidden = getHidden();
    if (countEl) countEl.textContent = all.length;

    // Populate category dropdown each render so user-added cats appear
    if (catSel){
      const prev = catSel.value;
      const set = new Set();
      all.forEach(r => { if (r.cat) set.add(r.cat); });
      const cats = [...set].sort();
      catSel.innerHTML = '<option value="">All categories</option>' +
        cats.map(c => '<option value="'+escH(c)+'">'+escH(c)+'</option>').join('');
      if (cats.indexOf(prev) >= 0) catSel.value = prev;
    }

    // Show / hide the "show hidden" toggle based on whether user has any hidden
    if (showBtn){
      showBtn.style.display = hidden.size ? 'inline-flex' : 'none';
      showBtn.textContent = (_showHidden ? '✗ Hide hidden' : '👁 Show ') + (hidden.size ? '('+hidden.size+')' : '');
      if (hidden.size){
        showBtn.textContent = _showHidden ? ('✗ Hide hidden ('+hidden.size+')') : ('👁 Show hidden ('+hidden.size+')');
      }
    }

    const q   = (search && search.value) || '';
    const cat = (catSel && catSel.value) || '';
    const filtered = all.filter(r => {
      if (hidden.has(r.n) && !_showHidden) return false;
      return rowMatches(r, q, cat);
    }).slice().sort((a,b) => a.n.localeCompare(b.n));

    grid.innerHTML = filtered.length
      ? filtered.map(r => renderCard(r, { isHidden: hidden.has(r.n) })).join('')
      : '<div style="grid-column:1/-1;padding:2rem 1rem;text-align:center;color:var(--color-text-tertiary);font-size:13px">No peptides match those filters.</div>';

    if (resultEl) resultEl.textContent = (filtered.length === all.length)
      ? all.length + ' shown'
      : filtered.length + ' of ' + all.length;

    grid.querySelectorAll('.cat-card').forEach(c => {
      c.addEventListener('mouseenter', () => { c.style.transform='translateY(-1px)'; c.style.boxShadow='0 4px 12px rgba(190,24,93,.12)'; });
      c.addEventListener('mouseleave', () => { c.style.transform=''; c.style.boxShadow=''; });
      c.addEventListener('click', e => {
        // Don't open detail if user clicked one of the action buttons
        if (e.target.closest('.cat-card-hide,.cat-card-unhide,.cat-card-edit')) return;
        openCatalogDetail(c.dataset.catName);
      });
    });

    // Wire action buttons
    grid.querySelectorAll('.cat-card-hide').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const name = b.dataset.catName;
      if (!confirm('Hide "' + name + '" from your catalog?\n\nYou can show hidden peptides again with the 👁 button at the top.')) return;
      const set = getHidden(); set.add(name); setHidden(set);
      renderCatalog();
    }));
    grid.querySelectorAll('.cat-card-unhide').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const name = b.dataset.catName;
      const set = getHidden(); set.delete(name); setHidden(set);
      renderCatalog();
    }));
    grid.querySelectorAll('.cat-card-edit').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      openCatalogEditor(b.dataset.catName);
    }));
  }
  window.tmpRenderCatalog = renderCatalog;
  window.tmpCatalogToggleHidden = function(){ _showHidden = !_showHidden; renderCatalog(); };

  function openCatalogDetail(name){
    // v25.1: search the merged catalog (built-ins + user-custom) so clicking
    // a custom card opens the same detail modal as a built-in.
    const pool = (typeof allEntries === 'function') ? allEntries() : PEPTIDE_REF;
    const r = pool.find(x => x.n === name);
    if (!r) return;
    const m = document.getElementById('cat-modal');
    if (!m) return;

    document.getElementById('cat-modal-cat').textContent = r.cat || '';
    document.getElementById('cat-modal-name').textContent = r.n;

    // Tags
    const tags = (Array.isArray(r.tags) ? r.tags : []);
    document.getElementById('cat-modal-tags').innerHTML =
      tags.map(t => '<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;background:#FCE7F3;color:#9D174D;border:.5px solid #FBCFE8">'+escH(t)+'</span>').join(' ');

    // Body — assemble structured sections
    const sections = [];
    if (r.use){
      sections.push('<div style="margin-bottom:14px;padding:10px 12px;background:var(--color-background-secondary);border-radius:8px;font-size:13px;line-height:1.55">'+escH(r.use)+'</div>');
    }
    function row(label, value){
      return '<div style="display:grid;grid-template-columns:120px 1fr;gap:10px;padding:6px 0;border-bottom:.5px dashed var(--color-border-tertiary);font-size:12px">'
        + '<div style="font-weight:600;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.04em;font-size:10.5px;padding-top:2px">'+label+'</div>'
        + '<div style="color:var(--color-text-primary)">'+value+'</div>'
        + '</div>';
    }
    const rangeStr = (r.startD === r.targetD)
      ? (r.startD ? r.startD + r.unit : '—')
      : ((r.startD || 0) + '–' + (r.targetD || 0) + ' ' + (r.unit || 'mcg'));
    sections.push('<div>');
    sections.push(row('Typical dose', escH(rangeStr) + (r.freq ? ' · ' + escH(r.freq) : '')));
    if (r.timing)   sections.push(row('Timing', escH(r.timing)));
    if (r.cycleOn || r.cycleOff) sections.push(row('Cycle', (r.cycleOn||'?') + ' weeks on / ' + (r.cycleOff||'?') + ' weeks off'));
    if (r.hl)       sections.push(row('Half-life', escH(fmtHalfLife(r.hl)) + ' <span style="opacity:.6;font-size:10.5px">(literature)</span>'));
    if (Array.isArray(r.goodWith) && r.goodWith.length){
      sections.push(row('Often stacked with', r.goodWith.map(escH).map(n => '<span style="display:inline-block;padding:1px 7px;margin:1px 3px 1px 0;background:#D1FAE5;color:#065F46;border-radius:4px;font-size:11px;font-weight:500;border:.5px solid #A7F3D0">'+n+'</span>').join('')));
    }
    if (Array.isArray(r.notGoodWith) && r.notGoodWith.length){
      sections.push(row('<span style="color:var(--accent-red-fg)">⚠ Avoid with</span>', r.notGoodWith.map(escH).map(n => '<span style="display:inline-block;padding:1px 7px;margin:1px 3px 1px 0;background:#FEE2E2;color:#991B1B;border-radius:4px;font-size:11px;font-weight:500;border:.5px solid #FCA5A5">'+n+'</span>').join('')));
    }
    if (r.incrAmt && r.incrWks){
      sections.push(row('Titration', 'Increase by ' + r.incrAmt + (r.unit||'') + ' every ' + r.incrWks + ' week' + (r.incrWks!==1?'s':'')));
    }
    sections.push('</div>');

    document.getElementById('cat-modal-body').innerHTML = sections.join('');

    // Wire "+ Add to my inventory"
    const addBtn = document.getElementById('cat-modal-add');
    if (addBtn){
      addBtn.onclick = () => {
        try {
          if (typeof clrPF === 'function') clrPF();
          if (typeof swPT === 'function') swPT('form');
          if (typeof g === 'function'){
            const nm = g('pf-nm');
            if (nm){ nm.value = r.n; nm.dispatchEvent(new Event('input')); }
          }
          const mgr = document.getElementById('pepmgr');
          if (mgr) mgr.style.display = 'block';
          m.style.display = 'none';
          m.setAttribute('aria-hidden','true');
        } catch(e){ console.error('add-to-inventory failed:', e); }
      };
    }

    // v25: extra footer buttons for hide / edit / delete depending on entry type
    const footEl = m.querySelector('div[style*="padding:11px 22px"]');
    if (footEl){
      // Remove any v25-injected buttons from prior open
      footEl.querySelectorAll('.cat-modal-extra').forEach(x => x.remove());
      if (r._custom){
        const editBtn = document.createElement('button');
        editBtn.className = 'btn cat-modal-extra';
        editBtn.style.cssText = 'padding:6px 14px;font-size:12.5px;margin-right:auto';
        editBtn.textContent = '✎ Edit';
        editBtn.onclick = () => { m.style.display='none'; openCatalogEditor(r.n); };
        footEl.insertBefore(editBtn, footEl.firstChild);
        const delBtn = document.createElement('button');
        delBtn.className = 'btn bro cat-modal-extra';
        delBtn.style.cssText = 'padding:6px 14px;font-size:12.5px;margin-right:8px';
        delBtn.textContent = '🗑 Delete';
        delBtn.onclick = () => {
          if (!confirm('Permanently delete custom peptide "' + r.n + '" from your catalog? This cannot be undone.')) return;
          deleteCustom(r.n);
          m.style.display='none';
          renderCatalog();
        };
        footEl.insertBefore(delBtn, addBtn);
      } else {
        const hideBtn = document.createElement('button');
        hideBtn.className = 'btn cat-modal-extra';
        hideBtn.style.cssText = 'padding:6px 14px;font-size:12.5px;margin-right:auto;color:var(--color-text-secondary)';
        const isHidden = getHidden().has(r.n);
        hideBtn.textContent = isHidden ? '👁 Unhide' : '🗑 Hide from catalog';
        hideBtn.onclick = () => {
          const set = getHidden();
          if (isHidden) set.delete(r.n); else set.add(r.n);
          setHidden(set);
          m.style.display='none';
          renderCatalog();
        };
        footEl.insertBefore(hideBtn, footEl.firstChild);
      }
    }

    m.style.display = 'block';
    m.setAttribute('aria-hidden','false');
  }

  // â”€â”€ v25: catalog editor (add / edit / delete custom entries) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let _editingCustomName = null;  // null = add mode, otherwise = name being edited

  function openCatalogEditor(name){
    _editingCustomName = name || null;
    const m = document.getElementById('cat-edit-modal');
    if (!m) return;
    document.getElementById('ce-mode').textContent = name ? 'Edit custom peptide' : 'Add custom peptide';
    document.getElementById('ce-delete').style.display = name ? 'inline-flex' : 'none';
    document.getElementById('ce-msg').textContent = '';

    // Pre-populate category datalist with existing categories
    const dl = document.getElementById('ce-cat-list');
    if (dl){
      const set = new Set();
      allEntries().forEach(r => { if (r.cat) set.add(r.cat); });
      dl.innerHTML = [...set].sort().map(c => '<option value="'+escH(c)+'">').join('');
    }

    // Pre-fill form for edit
    let r = null;
    if (name){
      r = getUserCustom().find(x => x.n === name);
    }
    function set(id, val){ const e = document.getElementById(id); if (e) e.value = val == null ? '' : val; }
    set('ce-name',        r && r.n);
    set('ce-cat',         r && r.cat);
    set('ce-use',         r && r.use);
    set('ce-startD',      r && r.startD);
    set('ce-targetD',     r && r.targetD);
    set('ce-unit',        (r && r.unit) || 'mcg');
    set('ce-freq',        r && r.freq);
    set('ce-timing',      r && r.timing);
    // Half-life: stored in canonical hours; pick more readable unit on display
    const hlEl = document.getElementById('ce-hl');
    const hlUnitEl = document.getElementById('ce-hl-unit');
    if (r && typeof r.hl === 'number' && r.hl > 0){
      if (r.hl >= 24){ hlEl.value = Math.round(r.hl/24*100)/100; hlUnitEl.value = 'days'; }
      else            { hlEl.value = r.hl; hlUnitEl.value = 'hours'; }
    } else { hlEl.value = ''; hlUnitEl.value = 'hours'; }
    set('ce-cycleOn',     r && r.cycleOn);
    set('ce-cycleOff',    r && r.cycleOff);
    set('ce-tags',        r && Array.isArray(r.tags) ? r.tags.join(', ') : '');
    set('ce-goodWith',    r && Array.isArray(r.goodWith) ? r.goodWith.join(', ') : '');
    set('ce-notGoodWith', r && Array.isArray(r.notGoodWith) ? r.notGoodWith.join(', ') : '');

    m.style.display = 'block';
    m.setAttribute('aria-hidden','false');
  }
  window.openCatalogEditor = openCatalogEditor;

  function closeCatalogEditor(){
    const m = document.getElementById('cat-edit-modal');
    if (!m) return;
    m.style.display = 'none';
    m.setAttribute('aria-hidden','true');
    _editingCustomName = null;
  }

  function readCommaList(id){
    const v = (document.getElementById(id) || {}).value || '';
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  function readNum(id){
    const v = (document.getElementById(id) || {}).value;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }
  function readStr(id){
    const v = (document.getElementById(id) || {}).value || '';
    const t = v.trim();
    return t || undefined;
  }

  function saveCustomFromForm(){
    const name = readStr('ce-name');
    const msg = document.getElementById('ce-msg');
    if (!name){ msg.textContent = 'Name is required.'; msg.style.color = '#A32D2D'; return; }
    // Don't allow custom name to collide with a built-in peptide name
    const builtinHit = (typeof PEPTIDE_REF !== 'undefined') && PEPTIDE_REF.find(x => x.n.toLowerCase() === name.toLowerCase());
    if (builtinHit && (!_editingCustomName || _editingCustomName.toLowerCase() !== name.toLowerCase())){
      msg.textContent = '"' + name + '" already exists as a built-in catalog entry. Pick a different name.'; msg.style.color = '#A32D2D'; return;
    }
    // Don't allow collision with another custom (other than the one we are editing)
    const existing = getUserCustom().find(x => x.n.toLowerCase() === name.toLowerCase());
    if (existing && (!_editingCustomName || _editingCustomName.toLowerCase() !== name.toLowerCase())){
      msg.textContent = 'Another custom peptide is already named "' + name + '".'; msg.style.color = '#A32D2D'; return;
    }
    // Build the entry
    const hlRaw = readNum('ce-hl');
    const hlUnit = readStr('ce-hl-unit') || 'hours';
    const hl = (hlRaw && hlRaw > 0) ? (hlUnit === 'days' ? hlRaw * 24 : hlRaw) : undefined;
    const entry = {
      n: name,
      cat: readStr('ce-cat'),
      catC: '#BE185D',  // default custom color (rose) — could let user pick later
      use: readStr('ce-use'),
      startD: readNum('ce-startD') || 0,
      targetD: readNum('ce-targetD') || readNum('ce-startD') || 0,
      unit: readStr('ce-unit') || 'mcg',
      freq: readStr('ce-freq'),
      timing: readStr('ce-timing'),
      hl,
      cycleOn: readNum('ce-cycleOn'),
      cycleOff: readNum('ce-cycleOff'),
      tags: readCommaList('ce-tags'),
      goodWith: readCommaList('ce-goodWith'),
      notGoodWith: readCommaList('ce-notGoodWith'),
    };
    // Strip undefined keys to keep storage clean
    Object.keys(entry).forEach(k => { if (entry[k] === undefined || (Array.isArray(entry[k]) && entry[k].length === 0)) delete entry[k]; });

    let arr = getUserCustom().map(r => { const { _custom, ...rest } = r; return rest; });
    if (_editingCustomName){
      const idx = arr.findIndex(x => x.n === _editingCustomName);
      if (idx >= 0) arr.splice(idx, 1, entry);
      else arr.push(entry);
    } else {
      arr.push(entry);
    }
    setUserCustom(arr);
    msg.textContent = 'Saved.'; msg.style.color = '#0F6E56';
    setTimeout(closeCatalogEditor, 400);
    renderCatalog();
  }

  function deleteCustom(name){
    let arr = getUserCustom().map(r => { const { _custom, ...rest } = r; return rest; });
    arr = arr.filter(x => x.n !== name);
    setUserCustom(arr);
  }
  window.tmpDeleteCustomCatalog = deleteCustom;
  window.openCatalogDetail = openCatalogDetail;

  function closeCatalog(){
    const m = document.getElementById('cat-modal');
    if (!m) return;
    m.style.display = 'none';
    m.setAttribute('aria-hidden','true');
  }

  function init(){
    const search = document.getElementById('cat-search');
    const catSel = document.getElementById('cat-cat-filter');
    const closeBtn = document.getElementById('cat-modal-x');
    const modal = document.getElementById('cat-modal');
    const addBtn = document.getElementById('cat-add-btn');
    const showBtn = document.getElementById('cat-show-hidden');
    if (search && !search.__catWired){ search.__catWired = true; search.addEventListener('input', renderCatalog); }
    if (catSel && !catSel.__catWired){ catSel.__catWired = true; catSel.addEventListener('change', renderCatalog); }
    if (closeBtn && !closeBtn.__catWired){ closeBtn.__catWired = true; closeBtn.addEventListener('click', closeCatalog); }
    if (modal && !modal.__catWired){
      modal.__catWired = true;
      modal.addEventListener('click', e => { if (e.target === modal) closeCatalog(); });
    }
    if (addBtn && !addBtn.__catWired){ addBtn.__catWired = true; addBtn.addEventListener('click', () => openCatalogEditor(null)); }
    if (showBtn && !showBtn.__catWired){ showBtn.__catWired = true; showBtn.addEventListener('click', window.tmpCatalogToggleHidden); }
    // v25 — wire the catalog editor modal buttons
    const ceClose = document.getElementById('ce-close');
    const ceCancel = document.getElementById('ce-cancel');
    const ceSave = document.getElementById('ce-save');
    const ceDel = document.getElementById('ce-delete');
    const ceModal = document.getElementById('cat-edit-modal');
    if (ceClose && !ceClose.__catWired){ ceClose.__catWired = true; ceClose.addEventListener('click', closeCatalogEditor); }
    if (ceCancel && !ceCancel.__catWired){ ceCancel.__catWired = true; ceCancel.addEventListener('click', closeCatalogEditor); }
    if (ceSave && !ceSave.__catWired){ ceSave.__catWired = true; ceSave.addEventListener('click', saveCustomFromForm); }
    if (ceDel && !ceDel.__catWired){ ceDel.__catWired = true; ceDel.addEventListener('click', () => {
      if (!_editingCustomName) return;
      if (!confirm('Permanently delete custom peptide "' + _editingCustomName + '"? This cannot be undone.')) return;
      deleteCustom(_editingCustomName);
      closeCatalogEditor();
      renderCatalog();
    }); }
    if (ceModal && !ceModal.__catWired){ ceModal.__catWired = true; ceModal.addEventListener('click', e => { if (e.target === ceModal) closeCatalogEditor(); }); }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape'){
        const mod = document.getElementById('cat-modal');
        const editMod = document.getElementById('cat-edit-modal');
        if (editMod && editMod.style.display === 'block') closeCatalogEditor();
        else if (mod && mod.style.display === 'block') closeCatalog();
      }
    });
    renderCatalog();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();


// ===== extracted post-core patch script =====
(function(){
  // Schedule presets — label + injections-per-week multiplier
  const SCHEDULES = [
    {label:'Daily',          ipw: 7,     k: 'daily'},
    {label:'Every 36h',      ipw: 4.667, k: 'e36h'},
    {label:'EOD',            ipw: 3.5,   k: 'eod'},
    {label:'Every 3 Days',   ipw: 2.333, k: 'e3d'},
    {label:'Twice Weekly',   ipw: 2,     k: 'twice'},
    {label:'Weekly',         ipw: 1,     k: 'weekly'},
    {label:'Every 10 Days',  ipw: 0.7,   k: 'e10d'},
    {label:'Bi-Weekly',      ipw: 0.5,   k: 'biweekly'},
  ];
  let _schedIpw = 2; // default Twice Weekly
  let _schedLabel = 'Twice Weekly';
  let _doseMode = 'weekly'; // 'weekly' or 'injection'

  function setDoseMode(mode){
    _doseMode = mode;
    const wkBtn = document.getElementById('calc-oil-dose-mode-week');
    const ijBtn = document.getElementById('calc-oil-dose-mode-inj');
    if(wkBtn) wkBtn.classList.toggle('on', mode === 'weekly');
    if(ijBtn) ijBtn.classList.toggle('on', mode === 'injection');
    const suffix = document.getElementById('calc-oil-dose-suffix');
    if(suffix) suffix.textContent = mode === 'weekly' ? 'mg / week' : 'mg / injection';
    try{ localStorage.setItem('tmp.calc.oil.doseMode', mode); }catch(_){}
    doOilCalc();
  }
  window.setDoseMode = setDoseMode;

  // Ester → suggested injections-per-week (rough half-life-based hints)
  const ESTER_HINT = {
    'cypionate':         2,    // twice weekly
    'enanthate':         2,
    'propionate':        3.5,  // EOD
    'sustanon':          2,
    'nandrolone decanoate': 1, // weekly
    'trenbolone acetate':3.5,  // EOD
    'trenbolone enanthate': 2,
    'masteron propionate': 3.5,
    'masteron enanthate': 2,
    'boldenone undecylenate': 1,
    'primobolan enanthate': 1,
  };

  function buildSchedBtns(){
    const c = document.getElementById('calc-oil-sched-btns');
    if(!c) return;
    c.innerHTML = '';
    SCHEDULES.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.label;
      if(s.label === _schedLabel) b.classList.add('on');
      b.addEventListener('click', () => {
        _schedIpw = s.ipw; _schedLabel = s.label;
        c.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        try{ localStorage.setItem('tmp.calc.oil.sched', s.label); }catch(_){}
        doOilCalc();
      });
      c.appendChild(b);
    });
  }

  function doOilCalc(){
    const conc = parseFloat(document.getElementById('calc-oil-conc').value) || 0;
    const inputVal = parseFloat(document.getElementById('calc-oil-week').value) || 0;
    const vialMl = parseFloat(document.getElementById('calc-oil-vialml').value) || 0;
    const syrMl = parseFloat(document.getElementById('calc-oil-syr').value) || 1.0;
    const ipw = _schedIpw;
    const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    const oilLogWrap = document.getElementById('calc-oil-to-log-wrap');

    if(conc <= 0 || inputVal <= 0 || vialMl <= 0 || ipw <= 0){
      set('calc-oil-mg','—'); set('calc-oil-ml','—'); set('calc-oil-injwk','—');
      set('calc-oil-units','—'); set('calc-oil-monthly','—'); set('calc-oil-yearly','—');
      set('calc-oil-daysvial','—');
      const hl = document.getElementById('calc-oil-headline');
      if(hl) hl.textContent = 'Fill in the fields above to see your protocol.';
      const sh = document.getElementById('calc-oil-syringe');
      if(sh && typeof window.makeResultSyringe === 'function'){
        sh.innerHTML = '';
        const sMl = parseFloat(document.getElementById('calc-oil-syr').value) || 1.0;
        const sCap = sMl * 100;
        const tickStep = sMl >= 1 ? 10 : 5;
        sh.appendChild(window.makeResultSyringe(0, sCap, sMl + 'mL', tickStep));
      }
      if(oilLogWrap) oilLogWrap.style.display='none';
      if(window._calcLast && window._calcLast.mode==='oil') window._calcLast = null;
      return;
    }
    let week, mgInj;
    if(_doseMode === 'injection'){
      mgInj = inputVal;
      week = mgInj * ipw;
    } else {
      week = inputVal;
      mgInj = week / ipw;
    }
    const mlInj = mgInj / conc;
    const monthly = week * (52/12);
    const yearly = week * 52;
    const vialMg = vialMl * conc;
    const injsPerVial = vialMg / mgInj;
    const daysPerVial = injsPerVial / ipw * 7;
    // Syringe units — U-100 standard: 1 mL = 100 units
    const units100 = mlInj * 100;
    const syrCap = syrMl * 100;
    const over = units100 > syrCap;
    const unitsRound = Math.round(units100*10)/10;

    set('calc-oil-mg', mgInj.toFixed(mgInj < 10 ? 2 : 1) + ' mg');
    set('calc-oil-ml', mlInj.toFixed(3) + ' mL');
    set('calc-oil-injwk', ipw.toFixed(ipw % 1 === 0 ? 0 : 1));
    set('calc-oil-units', unitsRound + ' u' + (over ? ' ⚠' : ''));
    set('calc-oil-monthly', Math.round(monthly) + ' mg');
    set('calc-oil-yearly', Math.round(yearly).toLocaleString() + ' mg');
    set('calc-oil-daysvial', Math.round(daysPerVial) + ' d');

    const hl = document.getElementById('calc-oil-headline');
    if(hl){
      const ester = (document.getElementById('calc-oil-ester').value || '').trim() || 'oil';
      const overTxt = over ? ' <span style="color:var(--accent-red-fg);font-size:13px">(exceeds '+syrCap+'u syringe!)</span>' : '';
      const doseStr = _doseMode === 'injection'
        ? '<b>' + (Math.round(mgInj*100)/100) + ' mg/inj</b> on <b>' + _schedLabel + '</b> (' + Math.round(week) + ' mg/week)'
        : '<b>' + week + ' mg/week</b> ' + ester + ' ' + conc + 'mg/mL on <b>' + _schedLabel + '</b>';
      hl.innerHTML = 'For ' + doseStr + ': pull <b style="color:var(--accent-red-fg)">' + unitsRound + ' units</b>'+overTxt+' (<b>'+mgInj.toFixed(mgInj < 10 ? 2 : 1)+' mg</b>, '+mlInj.toFixed(3)+' mL) per injection.';
    }
    // Render the syringe SVG using the existing makeResultSyringe helper from
    // lyo mode. Tick step matches the standard insulin syringe (1u/tick on 0.3
    // and 0.5 mL syringes, 2u/tick on 1.0 mL).
    const syringeHost = document.getElementById('calc-oil-syringe');
    if(syringeHost && typeof window.makeResultSyringe === 'function'){
      syringeHost.innerHTML = '';
      const tickStep = syrMl >= 1 ? 10 : (syrMl >= 0.5 ? 5 : 5);
      syringeHost.appendChild(window.makeResultSyringe(units100, syrCap, syrMl + 'mL', tickStep));
    }

    // Oil-mode handoff payload mirrors lyo's _calcLast contract.
    window._calcLast = {
      dose: Math.round(mgInj*100)/100,
      doseUnit: 'mg',
      volMl: mlInj,
      units: unitsRound,
      over: over,
      mode: 'oil'
    };
    if(oilLogWrap) oilLogWrap.style.display = over ? 'none' : '';

    // Persist current values so they survive reloads
    try {
      localStorage.setItem('tmp.calc.oil', JSON.stringify({
        ester: document.getElementById('calc-oil-ester').value,
        conc, week, vialMl, syrMl, sched: _schedLabel
      }));
    } catch(_){}
    // CALC-MEM-R2: also persist per-peptide (lastCalcOil on the loaded inv item)
    _oilRememberLast();
  }
  window.doOilCalc = doOilCalc;

  // CALC-MEM-R2: per-peptide oil memory. The global tmp.calc.oil blob is shared
  // by every oil SKU, so TCyp 200 / TCyp 250 / TCyp 200 old kept clobbering each
  // other's conc/dose/vial/schedule. Each oil-eligible inventory item now gets
  // its own lastCalcOil, restored when it's loaded from inventory.
  function _oilPepEligible(pep){
    try{ return !!(pep && (looksLikeOil(pep.name) || looksLikeOil(pep.cat))); }catch(_){ return false; }
  }
  function _oilRememberLast(){
    try{
      if(window._calcOilLoading) return; // load in progress — don't clobber saved memory with stale fields
      if(!window.S || !window._calcLoadedPepId) return;
      const pep=(S.inv||[]).find(function(p){ return p && p.id===window._calcLoadedPepId; });
      if(!_oilPepEligible(pep)) return;
      const val=function(id){ const el=document.getElementById(id); return el?el.value:''; };
      pep.lastCalcOil={
        ester: val('calc-oil-ester')||'',
        conc: parseFloat(val('calc-oil-conc'))||0,
        input: parseFloat(val('calc-oil-week'))||0,
        vialMl: parseFloat(val('calc-oil-vialml'))||0,
        syrMl: parseFloat(val('calc-oil-syr'))||0,
        sched: _schedLabel,
        doseMode: _doseMode
      };
      clearTimeout(window._oilRemT);
      window._oilRemT=setTimeout(function(){ try{ typeof save==='function' && save(); }catch(_){} },400);
    }catch(_){}
  }
  window._calcRestoreLastOil=function(pep){
    if(!pep || !pep.lastCalcOil) return false;
    const lc=pep.lastCalcOil;
    const set=function(id,v){ const el=document.getElementById(id); if(el && v!=null && v!=='' && v!==0) el.value=v; };
    try{
      if(lc.ester) set('calc-oil-ester',lc.ester);
      set('calc-oil-conc',lc.conc);
      set('calc-oil-week',lc.input);
      set('calc-oil-vialml',lc.vialMl);
      set('calc-oil-syr',lc.syrMl);
      if(lc.doseMode==='injection' || lc.doseMode==='weekly'){
        _doseMode=lc.doseMode;
        const wkBtn=document.getElementById('calc-oil-dose-mode-week');
        const ijBtn=document.getElementById('calc-oil-dose-mode-inj');
        if(wkBtn) wkBtn.classList.toggle('on',_doseMode==='weekly');
        if(ijBtn) ijBtn.classList.toggle('on',_doseMode==='injection');
        const suffix=document.getElementById('calc-oil-dose-suffix');
        if(suffix) suffix.textContent=_doseMode==='weekly'?'mg / week':'mg / injection';
      }
      if(lc.sched){
        const found=SCHEDULES.find(function(s){ return s.label===lc.sched; });
        if(found){ _schedIpw=found.ipw; _schedLabel=found.label; buildSchedBtns(); }
      }
      doOilCalc();
      return true;
    }catch(_){}
    return false;
  };

  function setCalcMode(mode){
    const lyo = document.getElementById('calc-lyo-section');
    const oil = document.getElementById('calc-oil-section');
    const lyoBtn = document.getElementById('calc-mode-lyo-btn');
    const oilBtn = document.getElementById('calc-mode-oil-btn');
    const titleEl = document.getElementById('calc-hero-title');
    const subEl = document.getElementById('calc-hero-sub');
    if(!lyo || !oil) return;
    if(mode === 'oil'){
      lyo.style.display = 'none';
      oil.style.display = '';
      if(lyoBtn) lyoBtn.classList.remove('on');
      if(oilBtn) oilBtn.classList.add('on');
      if(titleEl) titleEl.textContent = 'TRT / Oil Protocol Calculator';
      if(subEl) subEl.textContent = 'Set weekly dose and schedule — get per-injection numbers';
      doOilCalc();
    } else {
      lyo.style.display = '';
      oil.style.display = 'none';
      if(lyoBtn) lyoBtn.classList.add('on');
      if(oilBtn) oilBtn.classList.remove('on');
      if(titleEl) titleEl.textContent = 'Peptide Reconstitution Calculator';
      if(subEl) subEl.textContent = 'Dial in your exact dose — results update as you select';
    }
    try{ localStorage.setItem('tmp.calcMode', mode); }catch(_){}
  }
  window.setCalcMode = setCalcMode;

  // Detect if a peptide name / cat looks like an oil ester
  function looksLikeOil(text){
    if(!text) return null;
    const lo = String(text).toLowerCase();
    for(const k of Object.keys(ESTER_HINT)){
      // Match the first word of the ester name (cypionate, enanthate, etc.)
      const firstWord = k.split(' ')[0];
      if(lo.includes(firstWord) || lo.includes(k)) return k;
    }
    // Common shorthands
    if(/\btcyp|t-?cyp|cyp\d|tcyp\d/i.test(lo)) return 'cypionate';
    if(/\btc\s*-?\d/i.test(lo)) return 'cypionate'; // CALC-MEM-R2: "TC 200", "TC250", "TC 200 (old)" 
    if(/\b(cyp|test\s*c|t\s*cyp)\b/.test(lo)) return 'cypionate';
    if(/\b(test\s*e|t\s*enth?|enan)\b/.test(lo)) return 'enanthate';
    if(/\b(test\s*p|prop)\b/.test(lo)) return 'propionate';
    if(/\bsus(tanon)?\b/.test(lo)) return 'sustanon';
    if(/\b(nand|deca|npp)\b/.test(lo)) return 'nandrolone decanoate';
    if(/\btren\b/.test(lo)) return 'trenbolone acetate';
    if(/\bmast\b/.test(lo)) return 'masteron propionate';
    if(/\b(bold|equip)/.test(lo)) return 'boldenone undecylenate';
    if(/\bprimo\b/.test(lo)) return 'primobolan enanthate';
    return null;
  }
  window.calcLooksLikeOil = looksLikeOil;

  function init(){
    // Expose the lyo-mode syringe renderer to the oil-mode IIFE.
    try {
      if(typeof makeResultSyringe === 'function' && !window.makeResultSyringe){
        window.makeResultSyringe = makeResultSyringe;
      }
    } catch(_){}
    buildSchedBtns();
    // Restore saved mode
    // Always default to peptide reconstitution mode on load (per user request).
    let savedMode = 'lyo';
    // Restore saved oil values
    try{
      const raw = localStorage.getItem('tmp.calc.oil');
      if(raw){
        const o = JSON.parse(raw);
        if(o.ester)  document.getElementById('calc-oil-ester').value  = o.ester;
        if(o.conc)   document.getElementById('calc-oil-conc').value   = o.conc;
        if(o.week)   document.getElementById('calc-oil-week').value   = o.week;
        if(o.vialMl) document.getElementById('calc-oil-vialml').value = o.vialMl;
        if(o.syrMl)  document.getElementById('calc-oil-syr').value    = o.syrMl;
        if(o.sched){
          _schedLabel = o.sched;
          const found = SCHEDULES.find(s => s.label === o.sched);
          if(found) _schedIpw = found.ipw;
          buildSchedBtns();
        }
      }
    } catch(_){}
    // Wire mode toggles
    const lyoBtn = document.getElementById('calc-mode-lyo-btn');
    const oilBtn = document.getElementById('calc-mode-oil-btn');
    if(lyoBtn) lyoBtn.addEventListener('click', () => setCalcMode('lyo'));
    if(oilBtn) oilBtn.addEventListener('click', () => setCalcMode('oil'));
    // Wire oil inputs
    ['calc-oil-ester','calc-oil-conc','calc-oil-week','calc-oil-vialml','calc-oil-syr'].forEach(id => {
      const el = document.getElementById(id); if(!el) return;
      el.addEventListener('input', doOilCalc);
      el.addEventListener('change', doOilCalc);
    });
    // Ester change — suggest schedule matching the ester's typical cadence
    const esterEl = document.getElementById('calc-oil-ester');
    if(esterEl){
      esterEl.addEventListener('change', () => {
        const hit = looksLikeOil(esterEl.value);
        if(hit && ESTER_HINT[hit]){
          const ipw = ESTER_HINT[hit];
          const found = SCHEDULES.find(s => Math.abs(s.ipw - ipw) < 0.01);
          if(found){
            _schedIpw = found.ipw; _schedLabel = found.label;
            buildSchedBtns();
            doOilCalc();
          }
        }
      });
    }
    // Wire dose-mode pills
    const wkBtn = document.getElementById('calc-oil-dose-mode-week');
    const ijBtn = document.getElementById('calc-oil-dose-mode-inj');
    if(wkBtn) wkBtn.addEventListener('click', () => setDoseMode('weekly'));
    if(ijBtn) ijBtn.addEventListener('click', () => setDoseMode('injection'));
    // Restore saved dose mode
    try{
      const dm = localStorage.getItem('tmp.calc.oil.doseMode');
      if(dm === 'injection' || dm === 'weekly') setDoseMode(dm);
    }catch(_){}
    // Apply saved mode
    setCalcMode(savedMode);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


// ===== extracted post-core patch script =====
(function(){
  const KEY = 'tmp.wishlist';
  const EVT = 'tmp:wishlist-changed';

  function escH(s){return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);}

  function getList(){
    try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch(_){ return []; }
  }
  function setList(arr){
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch(_){}
    document.dispatchEvent(new CustomEvent(EVT));
  }
  function has(name){ return getList().some(w => w.name === name); }
  function add(name){
    if(!name) return;
    if(has(name)) return;
    const arr = getList();
    arr.unshift({ name, addedAt: new Date().toISOString() });
    setList(arr);
  }
  function remove(name){ setList(getList().filter(w => w.name !== name)); }
  function toggle(name){ has(name) ? remove(name) : add(name); }
  function count(){ return getList().length; }
  function clearAll(){
    if(!getList().length) return;
    if(!confirm('Clear all '+getList().length+' wishlist entries? This cannot be undone.')) return;
    setList([]);
  }

  // Public API
  window.ptWishlistGet = getList;
  window.ptWishlistHas = has;
  window.ptWishlistAdd = add;
  window.ptWishlistRemove = remove;
  window.ptWishlistToggle = toggle;
  window.ptWishlistCount = count;

  // Relative-time formatter
  function relDate(iso){
    if(!iso) return '';
    const t = new Date(iso).getTime();
    if(isNaN(t)) return '';
    const diffMs = Date.now() - t;
    const sec = Math.floor(diffMs/1000);
    if(sec < 60) return 'just now';
    const min = Math.floor(sec/60);
    if(min < 60) return min + 'm ago';
    const hr = Math.floor(min/60);
    if(hr < 24) return hr + 'h ago';
    const d = Math.floor(hr/24);
    if(d === 1) return 'yesterday';
    if(d < 30) return d + 'd ago';
    const mo = Math.floor(d/30);
    if(mo < 12) return mo + 'mo ago';
    const y = Math.floor(d/365);
    return y + 'y ago';
  }

  // Find lowest non-zero price across vendors for a peptide name in S.prices
  function lowestPriceFor(name){
    if(!window.S || !S.prices || !S.prices[name]) return null;
    const vendors = S.prices[name];
    let best = null, bestVendor = null;
    Object.entries(vendors).forEach(([v, p]) => {
      const n = parseFloat(p);
      if(!isNaN(n) && n > 0 && (best === null || n < best)){ best = n; bestVendor = v; }
    });
    return best === null ? null : { price: best, vendor: bestVendor };
  }

  let _editMode = false;
  let _selected = new Set();

  // Build a deduped sorted suggestion list of peptide names from PEPTIDE_REF,
  // user-custom catalog, and S.prices keys.
  function buildSuggestionList(){
    const set = new Set();
    try {
      if(typeof PEPTIDE_REF !== 'undefined'){
        PEPTIDE_REF.forEach(r => { if(r.n) set.add(r.n); });
      }
    } catch(_){}
    try {
      if(typeof window.ptCatalogAllEntries === 'function'){
        window.ptCatalogAllEntries().forEach(r => { if(r.n) set.add(r.n); });
      }
    } catch(_){}
    try {
      if(window.S && S.prices){
        Object.keys(S.prices).forEach(k => { if(k && k.trim()) set.add(k); });
      }
    } catch(_){}
    return [...set].sort((a,b) => a.localeCompare(b));
  }

  function refreshAddDatalist(){
    const dl = document.getElementById('wl-add-datalist');
    if(!dl) return;
    const sugg = buildSuggestionList();
    dl.innerHTML = sugg.map(n => '<option value="'+escH(n).replace(/"/g,'&quot;')+'">').join('');
  }

  // Move an entry to a specific index (0-based). Removes any existing entry
  // with the same name first to support drag-and-drop reorder.
  function moveTo(name, newIndex){
    let arr = getList();
    const cur = arr.findIndex(w => w.name === name);
    if(cur < 0) return;
    const [item] = arr.splice(cur, 1);
    if(newIndex < 0) newIndex = 0;
    if(newIndex > arr.length) newIndex = arr.length;
    arr.splice(newIndex, 0, item);
    setList(arr);
  }
  window.ptWishlistMoveTo = moveTo;

  function moveUp(name){
    const arr = getList();
    const i = arr.findIndex(w => w.name === name);
    if(i <= 0) return;
    moveTo(name, i - 1);
  }
  function moveDown(name){
    const arr = getList();
    const i = arr.findIndex(w => w.name === name);
    if(i < 0 || i >= arr.length - 1) return;
    moveTo(name, i + 1);
  }

  function setEditMode(on){
    _editMode = !!on;
    _selected.clear();
    const tn = document.getElementById('wl-toolbar-normal');
    const te = document.getElementById('wl-toolbar-edit');
    if(tn) tn.style.display = _editMode ? 'none' : 'flex';
    if(te) te.style.display = _editMode ? 'flex' : 'none';
    // Hide the Add form if we are switching to edit
    if(_editMode){
      const af = document.getElementById('wl-add-form');
      if(af) af.style.display = 'none';
    }
    renderPage();
  }

  function refreshEditCounts(){
    const sel = document.getElementById('wl-edit-count');
    const tot = document.getElementById('wl-edit-total');
    const del = document.getElementById('wl-bulk-delete');
    if(sel) sel.textContent = _selected.size;
    if(tot) tot.textContent = getList().length;
    if(del){
      const n = _selected.size;
      del.disabled = n === 0;
      del.style.opacity = n === 0 ? '.55' : '1';
    }
  }

  // Render the wishlist page (#pg-wishlist)
  function renderPage(){
    const rows = document.getElementById('wl-rows');
    const empty = document.getElementById('wl-empty');
    const cnt = document.getElementById('wl-count');
    const clr = document.getElementById('wl-clear-all');
    const editBtn = document.getElementById('wl-edit-btn');
    if(!rows) return;

    const list = getList();
    if(cnt) cnt.textContent = list.length;
    if(clr) clr.style.display = list.length ? 'inline-flex' : 'none';
    if(editBtn) editBtn.style.display = list.length ? 'inline-flex' : 'none';

    refreshEditCounts();
    refreshAddDatalist();

    if(!list.length){
      rows.innerHTML = '';
      if(empty) empty.style.display = '';
      return;
    }
    if(empty) empty.style.display = 'none';

    rows.innerHTML = list.map((entry, idx) => {
      const lp = lowestPriceFor(entry.name);
      const priceLine = lp
        ? '<div style="font-size:11.5px;color:var(--accent-green-fg);font-weight:600">$'+lp.price.toFixed(0)+' · '+escH(lp.vendor)+'</div>'
        : '<div style="font-size:11.5px;color:var(--color-text-tertiary);font-style:italic">No price entries yet</div>';
      const checkbox = _editMode
        ? '<input type="checkbox" class="wl-check" '+(_selected.has(entry.name)?'checked':'')+' style="width:18px;height:18px;cursor:pointer;flex-shrink:0;accent-color:#E11D48">'
        : '';
      const grip = _editMode ? '' : '<span class="wl-grip" title="Drag to reorder" style="cursor:grab;user-select:none;color:var(--color-text-tertiary);font-size:18px;line-height:1;padding:0 4px;flex-shrink:0">â‹®â‹®</span>';
      const actions = _editMode
        ? '<div style="display:flex;gap:4px;justify-content:flex-end">'
        +   (idx > 0 ? '<button type="button" class="wl-up btn" title="Move up" style="padding:3px 7px;font-size:12px;line-height:1">↑</button>' : '<span style="width:26px"></span>')
        +   (idx < list.length - 1 ? '<button type="button" class="wl-down btn" title="Move down" style="padding:3px 7px;font-size:12px;line-height:1">↓</button>' : '<span style="width:26px"></span>')
        + '</div>'
        : '<div style="display:flex;gap:4px;justify-content:flex-end">'
        +   '<button type="button" class="wl-remove btn" title="Remove from wishlist" style="padding:4px 8px;font-size:11px;color:#9F1239;border-color:#FCA5A5">✕</button>'
        + '</div>';
      const dragAttrs = _editMode ? '' : ' draggable="true"';
      return ''
        + '<div class="wl-row" data-name="'+escH(entry.name)+'" data-idx="'+idx+'"' + dragAttrs + ' style="background:var(--color-background-primary);border:.5px solid var(--color-border-secondary);border-left:3px solid #E11D48;border-radius:10px;padding:9px 11px;display:flex;flex-direction:column;gap:6px;min-height:108px">'
        +   '<div style="display:flex;align-items:center;gap:6px">'
        +     checkbox
        +     grip
        +     '<div style="flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--color-text-primary);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escH(entry.name)+'">'+escH(entry.name)+'</div>'
        +   '</div>'
        +   '<div style="font-size:10px;color:var(--color-text-tertiary)">Added '+escH(relDate(entry.addedAt))+'</div>'
        +   priceLine
        +   '<div style="margin-top:auto">'+actions+'</div>'
        + '</div>';
    }).join('');

    // Wire row buttons
    rows.querySelectorAll('.wl-remove').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const name = b.closest('.wl-row').dataset.name;
      remove(name);
    }));
    rows.querySelectorAll('.wl-up').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const name = b.closest('.wl-row').dataset.name;
      moveUp(name);
    }));
    rows.querySelectorAll('.wl-down').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const name = b.closest('.wl-row').dataset.name;
      moveDown(name);
    }));
    rows.querySelectorAll('.wl-check').forEach(cb => cb.addEventListener('change', e => {
      const name = cb.closest('.wl-row').dataset.name;
      if(cb.checked) _selected.add(name); else _selected.delete(name);
      refreshEditCounts();
    }));

    // Drag-and-drop reorder (normal mode only)
    if(!_editMode){
      let dragName = null;
      rows.querySelectorAll('.wl-row').forEach(row => {
        row.addEventListener('dragstart', e => {
          dragName = row.dataset.name;
          row.style.opacity = '.45';
          try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragName); } catch(_){}
        });
        row.addEventListener('dragend', e => {
          row.style.opacity = '';
          rows.querySelectorAll('.wl-row').forEach(r => r.style.outline = '');
        });
        row.addEventListener('dragover', e => {
          e.preventDefault();
          if(dragName && row.dataset.name !== dragName){
            row.style.outline = '2px dashed #E11D48';
          }
        });
        row.addEventListener('dragleave', e => { row.style.outline = ''; });
        row.addEventListener('drop', e => {
          e.preventDefault();
          row.style.outline = '';
          const target = row.dataset.name;
          if(!dragName || dragName === target) return;
          const arr = getList();
          const targetIdx = arr.findIndex(w => w.name === target);
          if(targetIdx < 0) return;
          moveTo(dragName, targetIdx);
          dragName = null;
        });
      });
    }
  }

  // Render the floating pill at bottom-right (always visible — faded when empty)
  function renderPill(){
    const pill = document.getElementById('pt-wishlist-pill');
    const c = document.getElementById('pt-wishlist-pill-count');
    const btn = document.getElementById('pt-wishlist-pill-btn');
    if(!pill) return;
    const n = count();
    pill.style.display = 'block';
    if(c){
      c.textContent = n;
      c.style.display = n > 0 ? '' : 'none';
    }
    if(btn){
      if(n > 0){
        btn.style.background = 'linear-gradient(135deg,#F43F5E,#E11D48)';
        btn.style.opacity = '1';
        btn.style.boxShadow = '0 4px 12px rgba(244,63,94,.35)';
      } else {
        btn.style.background = 'rgba(243,244,246,.95)';
        btn.style.color = '#9F1239';
        btn.style.opacity = '.85';
        btn.style.boxShadow = '0 2px 8px rgba(0,0,0,.12)';
        btn.style.border = '.5px solid #FECDD3';
      }
    }
  }

  // Render the count badge on the nav button (small chip after the label)
  function renderNavBadge(){
    const btn = document.querySelector('#nav [data-pg="wishlist"]');
    if(!btn) return;
    const badge = btn.querySelector('.wl-nav-badge');
    if(badge) badge.remove();
    const heart = btn.querySelector('.wl-nav-heart');
    if(heart) heart.style.color = '#E11D48';
  }

  function renderAll(){ renderPill(); renderNavBadge(); renderPage(); }

  // Switch to the wishlist tab (programmatic click of the nav button)
  function showTab(){
    const btn = document.querySelector('#nav [data-pg="wishlist"]');
    if(btn) btn.click();
  }
  window.ptShowWishlistTab = showTab;

  // Hook into the catalog detail modal: inject a â¤ Wishlist toggle in the footer
  function hookCatalog(){
    const orig = window.openCatalogDetail;
    if(typeof orig !== 'function' || orig._wishlistWrapped) return;
    function wrapped(name){
      orig.apply(this, arguments);
      setTimeout(() => injectHeartButton(name), 0);
    }
    wrapped._wishlistWrapped = true;
    window.openCatalogDetail = wrapped;

    // Inject â¤ on every catalog card. Re-runs when ptRenderCatalog re-renders.
    const origRenderCat = window.ptRenderCatalog;
    if(typeof origRenderCat === 'function' && !origRenderCat._wishlistWrapped){
      function wrappedRender(){
        origRenderCat.apply(this, arguments);
        setTimeout(decorateCatalogCards, 0);
      }
      wrappedRender._wishlistWrapped = true;
      window.ptRenderCatalog = wrappedRender;
    }
    // Decorate now in case catalog is already rendered.
    setTimeout(decorateCatalogCards, 100);
    // Re-decorate when the wishlist changes so heart fill state updates live.
    document.addEventListener(EVT, () => setTimeout(decorateCatalogCards, 0));
  }

  // Add a â¤ button to each .cat-card (top-right area, next to existing
  // hide/edit/unhide button). Filled red when on wishlist, outline otherwise.
  function decorateCatalogCards(){
    const grid = document.getElementById('cat-grid');
    if(!grid) return;
    grid.querySelectorAll('.cat-card').forEach(card => {
      const name = card.dataset.catName;
      if(!name) return;
      let heart = card.querySelector('.cat-card-wl');
      if(!heart){
        heart = document.createElement('button');
        heart.type = 'button';
        heart.className = 'cat-card-wl';
        heart.title = 'Add to wishlist';
        // Position to the LEFT of the existing hide/edit button (which is at right:6px).
        // Make this one at right: ~32px so they sit side-by-side.
        heart.style.cssText = 'position:absolute;top:6px;right:32px;background:transparent;border:.5px solid var(--color-border-tertiary);border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;line-height:1;color:#9F1239';
        heart.dataset.catName = name;
        heart.addEventListener('click', e => {
          e.stopPropagation();
          toggle(name);
        });
        card.appendChild(heart);
      }
      const on = has(name);
      heart.textContent = on ? 'â¤' : 'â™¡';
      heart.style.color = on ? '#E11D48' : 'var(--color-text-tertiary)';
      heart.style.background = on ? '#FFE4E6' : 'transparent';
      heart.style.borderColor = on ? '#FCA5A5' : 'var(--color-border-tertiary)';
      heart.title = on ? 'Remove from wishlist' : 'Add to wishlist';
    });
  }

  function injectHeartButton(name){
    const m = document.getElementById('cat-modal');
    if(!m || m.style.display === 'none') return;
    const footEl = m.querySelector('div[style*="padding:11px 22px"]');
    if(!footEl) return;
    // Remove old wishlist button if present
    const old = footEl.querySelector('.wl-modal-btn');
    if(old) old.remove();
    const btn = document.createElement('button');
    btn.className = 'btn wl-modal-btn cat-modal-extra';
    btn.style.cssText = 'padding:6px 14px;font-size:12.5px;margin-right:6px';
    function paint(){
      const on = has(name);
      btn.textContent = on ? 'â¤ On wishlist' : 'â™¡ Add to wishlist';
      btn.style.background = on ? '#FFE4E6' : '';
      btn.style.color = on ? '#9F1239' : '';
      btn.style.borderColor = on ? '#FCA5A5' : '';
    }
    paint();
    btn.onclick = () => { toggle(name); paint(); };
    // Insert before the existing "+ Add to my inventory" button
    const addBtn = footEl.querySelector('#cat-modal-add');
    if(addBtn) footEl.insertBefore(btn, addBtn);
    else footEl.insertBefore(btn, footEl.firstChild);
  }

  // Inject CSS for pill hover + on-wishlist visual cue (idempotent)
  function injectPillCss(){
    if(document.getElementById('pt-wishlist-pill-style')) return;
    const css = document.createElement('style');
    css.id = 'pt-wishlist-pill-style';
    css.textContent = ''
      + '[data-pep-pill]{transition:transform .12s ease,box-shadow .12s ease}'
      + '[data-pep-pill]:hover{transform:translateY(-1px);box-shadow:0 2px 6px rgba(225,29,72,.25)}'
      + '[data-pep-pill].pep-pill-on{outline:1.5px solid #E11D48;outline-offset:1px}'
      + '[data-pep-pill].pep-pill-on::before{content:"\\2764";color:#E11D48;font-size:10px;margin-right:3px;font-weight:700}'
      + '.pep-pill-flash{animation:peppillflash .55s ease-out}'
      + '@keyframes peppillflash{0%{background-color:#FECACA!important;transform:scale(1.12)}100%{background-color:inherit;transform:scale(1)}}';
    document.head.appendChild(css);
  }

  // Decorate price comparison rows: tag each peptide chip with data-pep-pill.
  function decoratePriceTable(){
    const tbody = document.getElementById('pt-body');
    if(!tbody) return;
    tbody.querySelectorAll('tr > td:first-child > span').forEach(chip => {
      const name = chip.textContent.trim();
      if(!name) return;
      chip.setAttribute('data-pep-pill', name);
      chip.style.cursor = 'pointer';
      chip.title = 'Click to add to wishlist';
      chip.classList.toggle('pep-pill-on', has(name));
    });
  }
  window.ptDecoratePriceTable = decoratePriceTable;

  function hookPriceTable(){
    const orig = window.renderPrices;
    if(typeof orig !== 'function' || orig._wishlistWrapped) return;
    function wrapped(){
      orig.apply(this, arguments);
      setTimeout(decoratePriceTable, 0);
    }
    wrapped._wishlistWrapped = true;
    window.renderPrices = wrapped;
    setTimeout(decoratePriceTable, 100);
  }

  function init(){
    injectPillCss();
    hookCatalog();
    hookPriceTable();
    renderAll();
    // Re-decorate price table when wishlist mutates so the pill state updates.
    document.addEventListener(EVT, () => setTimeout(decoratePriceTable, 0));
    // Document-wide click delegation for any [data-pep-pill] element.
    document.addEventListener('click', e => {
      const pillEl = e.target.closest('[data-pep-pill]');
      if(!pillEl) return;
      // Don't hijack click on the catalog-card heart button (own handler).
      if(e.target.closest('.cat-card-wl,.wl-modal-btn,.wl-row,.wl-open-cat,.wl-remove')) return;
      const name = pillEl.dataset.pepPill;
      if(!name) return;
      e.stopPropagation();
      e.preventDefault();
      toggle(name);
      // Brief flash to confirm the toggle was registered.
      pillEl.classList.add('pep-pill-flash');
      setTimeout(() => pillEl.classList.remove('pep-pill-flash'), 600);
    }, true);
    document.addEventListener(EVT, renderAll);
    // Pill click → switch to wishlist tab
    const pillBtn = document.getElementById('pt-wishlist-pill-btn');
    if(pillBtn) pillBtn.addEventListener('click', showTab);
    // Clear-all button on the page
    const clr = document.getElementById('wl-clear-all');
    if(clr) clr.addEventListener('click', clearAll);
    // Add button → toggle inline add form
    const addBtn = document.getElementById('wl-add-btn');
    const addForm = document.getElementById('wl-add-form');
    const addInput = document.getElementById('wl-add-input');
    const addConfirm = document.getElementById('wl-add-confirm');
    const addCancel = document.getElementById('wl-add-cancel');
    const addMsg = document.getElementById('wl-add-msg');
    function showAddForm(show){
      if(!addForm) return;
      addForm.style.display = show ? 'block' : 'none';
      if(show){
        refreshAddDatalist();
        if(addInput){ addInput.value = ''; setTimeout(() => addInput.focus(), 50); }
        if(addMsg){ addMsg.textContent = ''; addMsg.style.color = ''; }
      }
    }
    if(addBtn) addBtn.addEventListener('click', () => {
      const open = addForm && addForm.style.display === 'block';
      showAddForm(!open);
    });
    if(addCancel) addCancel.addEventListener('click', () => showAddForm(false));
    function commitAdd(){
      if(!addInput) return;
      const name = (addInput.value || '').trim();
      if(!name){
        if(addMsg){ addMsg.textContent = 'Type a peptide name.'; addMsg.style.color = '#A32D2D'; }
        return;
      }
      if(has(name)){
        if(addMsg){ addMsg.textContent = '"' + name + '" is already on your wishlist.'; addMsg.style.color = '#A32D2D'; }
        return;
      }
      add(name);
      if(addMsg){ addMsg.textContent = '✓ Added "' + name + '"'; addMsg.style.color = '#0F6E56'; }
      if(addInput) addInput.value = '';
      setTimeout(() => showAddForm(false), 600);
    }
    if(addConfirm) addConfirm.addEventListener('click', commitAdd);
    if(addInput) addInput.addEventListener('keydown', e => {
      if(e.key === 'Enter'){ e.preventDefault(); commitAdd(); }
      else if(e.key === 'Escape'){ showAddForm(false); }
    });
    // Edit toggle
    const editBtn = document.getElementById('wl-edit-btn');
    const editDone = document.getElementById('wl-edit-done');
    if(editBtn) editBtn.addEventListener('click', () => setEditMode(true));
    if(editDone) editDone.addEventListener('click', () => setEditMode(false));
    // Select all
    const selAll = document.getElementById('wl-select-all');
    if(selAll) selAll.addEventListener('click', () => {
      const list = getList();
      const allSelected = list.length && list.every(w => _selected.has(w.name));
      if(allSelected){ _selected.clear(); }
      else { list.forEach(w => _selected.add(w.name)); }
      renderPage();
    });
    // Bulk delete
    const bulkDel = document.getElementById('wl-bulk-delete');
    if(bulkDel) bulkDel.addEventListener('click', () => {
      if(_selected.size === 0) return;
      if(!confirm('Delete ' + _selected.size + ' wishlist entr' + (_selected.size === 1 ? 'y' : 'ies') + '? This cannot be undone.')) return;
      setList(getList().filter(w => !_selected.has(w.name)));
      _selected.clear();
      // Stay in edit mode; if list is now empty, exit
      if(getList().length === 0) setEditMode(false);
    });
    // Re-render the page when the wishlist tab becomes active (any nav click)
    document.addEventListener('click', e => {
      const navBtn = e.target.closest('#nav [data-pg="wishlist"]');
      if(navBtn) setTimeout(renderPage, 0);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();


// ===== extracted post-core patch script =====
(function(){
  const SKIP_KEY = 'tmp.scheduleSkip';
  const DAYS_LBL = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const LANE_TO_TIME = {breakfast:'am', lunch:'am', dinner:'pm', bedtime:'pm'};
  const TIME_TO_LANE = {am:'breakfast', pm:'dinner'};
  const MEAL_LANES = ['breakfast','lunch','dinner','bedtime'];
  let _selectedDays = new Set();
  let _selectedLane = 'breakfast';
  let _currentName = null;
  let _applyBusy = false;
  let _showBusy = false;
  const _justApplied = new Set();

  function isAlreadyScheduled(name){
    if(!window.S || !S.sched) return false;
    const prefix = name + '/';
    for(const k in S.sched){
      if(k.indexOf(prefix) !== 0 || !S.sched[k] || S.sched[k] === false) continue;
      if(k.split('/').length >= 3) return true;
    }
    return false;
  }
  window.ptIsPeptideScheduled = isAlreadyScheduled;

  function getSkipMap(){
    try { return JSON.parse(localStorage.getItem(SKIP_KEY) || '{}') || {}; } catch(_) { return {}; }
  }
  function setSkip(name){
    const m = getSkipMap(); m[name] = true;
    try { localStorage.setItem(SKIP_KEY, JSON.stringify(m)); } catch(_){}
  }
  function isSkipped(name){ return !!getSkipMap()[name]; }

  function laneFromShotTime(t){
    return TIME_TO_LANE[t] || 'breakfast';
  }

  // Compute suggestions: day frequency + meal lane from shot history / inventory.
  function computeSuggestions(name, justLoggedDate, justLoggedTime){
    const days = new Set();
    let amCount = 0, pmCount = 0;
    const shots = (window.S && Array.isArray(S.shots)) ? S.shots : [];
    let matched = 0;
    for(let i = shots.length - 1; i >= 0 && matched < 80; i--){
      const sh = shots[i];
      if(!sh || sh.peptide !== name || !sh.date) continue;
      matched++;
      try {
        const d = new Date(sh.date + 'T00:00');
        days.add((d.getDay() + 6) % 7);
        if(sh.time === 'am') amCount++;
        else if(sh.time === 'pm') pmCount++;
      } catch(_){}
    }
    if(days.size === 0 && justLoggedDate){
      try {
        const d = new Date(justLoggedDate + 'T00:00');
        days.add((d.getDay() + 6) % 7);
      } catch(_){}
    }
    let suggestLane = laneFromShotTime(justLoggedTime || 'am');
    if(amCount + pmCount > 0){
      if(pmCount > amCount) suggestLane = 'dinner';
      else if(amCount > pmCount) suggestLane = 'breakfast';
      else suggestLane = laneFromShotTime(justLoggedTime || 'am');
    }
    try {
      const inv = (window.S && S.inv || []).find(i => !i.isSupply && i.name === name);
      if(inv && inv.stackLane && MEAL_LANES.indexOf(inv.stackLane) >= 0) suggestLane = inv.stackLane;
    } catch(_){}
    let freqHint = '';
    let intervalHint = '';
    try {
      const inv = (window.S && S.inv || []).find(i => !i.isSupply && i.name === name);
      if(inv && inv.interval > 0){
        intervalHint = 'Inventory says every ' + inv.interval + ' day' + (inv.interval === 1 ? '' : 's');
      }
    } catch(_){}
    return { days, lane: suggestLane, freqHint, intervalHint, history: amCount + pmCount };
  }

  function renderDayPicker(){
    const todayDi = (new Date().getDay() + 6) % 7;
    const host = document.getElementById('pt-sched-prompt-days');
    if(!host) return;
    host.innerHTML = '';
    DAYS_LBL.forEach((lbl, di) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pt-sp-day-btn' + (_selectedDays.has(di) ? ' on' : '') + (di === todayDi ? ' today' : '');
      b.textContent = lbl;
      b.dataset.di = di;
      b.addEventListener('click', () => {
        if(_selectedDays.has(di)) _selectedDays.delete(di);
        else _selectedDays.add(di);
        b.classList.toggle('on');
      });
      host.appendChild(b);
    });
  }

  function renderLanePicker(){
    const host = document.getElementById('pt-sched-prompt-time');
    if(!host) return;
    host.querySelectorAll('.pt-sp-time-pill').forEach(b => {
      const lane = b.dataset.lane || b.dataset.time;
      b.classList.toggle('on', lane === _selectedLane);
      if(!b._wired){
        b._wired = true;
        b.addEventListener('click', () => {
          _selectedLane = b.dataset.lane || b.dataset.time;
          host.querySelectorAll('.pt-sp-time-pill').forEach(x => {
            const l = x.dataset.lane || x.dataset.time;
            x.classList.toggle('on', l === _selectedLane);
          });
        });
      }
    });
  }

  function showPrompt(name, opts){
    opts = opts || {};
    if(_showBusy || _applyBusy) return;
    if(_justApplied.has(name)) return;
    if(isAlreadyScheduled(name)) return;
    if(isSkipped(name)) return;
    _showBusy = true;
    _currentName = name;

    const m = document.getElementById('pt-sched-prompt');
    if(!m){ _showBusy = false; return; }

    document.getElementById('pt-sched-prompt-title').textContent = '"' + name + '" not on your schedule yet';
    const sub = document.getElementById('pt-sched-prompt-sub');
    if(sub) sub.textContent = 'Pick the days and meal time you want to schedule it on.';
    const hint = document.getElementById('pt-sched-prompt-hint');
    if(hint) hint.style.display = 'none';
    const skip = document.getElementById('pt-sched-prompt-skip');
    if(skip) skip.checked = false;
    const msg = document.getElementById('pt-sched-prompt-msg');
    if(msg){ msg.textContent = ''; msg.style.color = ''; }

    m.style.display = 'block';
    m.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(function(){
      try {
        const sug = computeSuggestions(name, opts.justLoggedDate, opts.justLoggedTime);
        _selectedDays = new Set(sug.days);
        _selectedLane = sug.lane || 'breakfast';
        if(sub){
          const histTxt = sug.history === 0
            ? 'First time logging this peptide.'
            : 'You\'ve logged ' + sug.history + ' shot' + (sug.history === 1 ? '' : 's') + ' for this peptide.';
          sub.textContent = histTxt + ' Pick the days and meal time you want to schedule it on.';
        }
        if(hint){
          const bits = [];
          if(sug.freqHint) bits.push('\uD83D\uDCA1 ' + sug.freqHint);
          if(sug.intervalHint) bits.push('\uD83D\uDCE6 ' + sug.intervalHint);
          if(bits.length){
            hint.innerHTML = bits.join('<br>');
            hint.style.display = 'block';
          } else {
            hint.style.display = 'none';
          }
        }
        renderDayPicker();
        renderLanePicker();
      } finally {
        _showBusy = false;
      }
    });
  }
  window.ptShowSchedulePrompt = showPrompt;

  function closePrompt(){
    const m = document.getElementById('pt-sched-prompt');
    if(m){
      m.style.display = 'none';
      m.setAttribute('aria-hidden', 'true');
    }
    _currentName = null;
    _applyBusy = false;
  }

  function applyPrompt(){
    if(_applyBusy) return;
    const msg = document.getElementById('pt-sched-prompt-msg');
    if(!_currentName){ closePrompt(); return; }
    if(!_selectedDays.size){
      if(msg){ msg.textContent = 'Pick at least one day.'; msg.style.color = '#A32D2D'; }
      return;
    }
    if(!window.S){ closePrompt(); return; }
    _applyBusy = true;
    const appliedName = _currentName;
    const skip = document.getElementById('pt-sched-prompt-skip');
    if(skip && skip.checked && appliedName) setSkip(appliedName);
    try { if(window.tmpCalClearGuard) tmpCalClearGuard.allowName(appliedName); } catch(_){}
    const days = [..._selectedDays].sort((a,b)=>a-b);
    const lane = MEAL_LANES.indexOf(_selectedLane) >= 0 ? _selectedLane : 'breakfast';
    const it = (S.inv || []).find(i => i && !i.isSupply && i.name === appliedName);
    let added = days.length;
    if(typeof window.tmpSetItemMealSchedule === 'function' && it){
      window.tmpSetItemMealSchedule(it, lane, days);
    } else {
      if(!S.sched) S.sched = {};
      const time = LANE_TO_TIME[lane] || 'pm';
      added = 0;
      days.forEach(di => {
        const k = appliedName + '/' + time + '/' + di;
        if(!S.sched[k]){ S.sched[k] = true; added++; }
        if(it) it.stackLane = lane;
      });
    }
    if(appliedName) _justApplied.add(appliedName);
    closePrompt();
    try { typeof save === 'function' && save(); } catch(_){}
    try { window.tmpInventoryToast && window.tmpInventoryToast('\u2713 ' + appliedName + ' scheduled \u00B7 ' + added + ' cell' + (added===1?'':'s') + ' added'); } catch(_){}
    setTimeout(function(){
      try { typeof renderStack === 'function' && renderStack(); } catch(_){}
      try { typeof renderCal === 'function' && renderCal({force:true}); } catch(_){}
      try { window.tmpStackPlan && typeof tmpStackPlan.render === 'function' && tmpStackPlan.render(); } catch(_){}
      try { typeof rlPL === 'function' && rlPL(); } catch(_){}
      try { typeof popSel === 'function' && popSel(); } catch(_){}
    }, 0);
    setTimeout(function(){ _justApplied.delete(appliedName); }, 3000);
  }

  function dismissPromptWithSkip(){
    const skip = document.getElementById('pt-sched-prompt-skip');
    if(skip && skip.checked && _currentName) setSkip(_currentName);
    closePrompt();
  }

  function init(){
    if(init._wired) return;
    init._wired = true;
    document.addEventListener('click', function(e){
      const applyBtn = e.target && e.target.closest && e.target.closest('#pt-sched-prompt-apply');
      if(applyBtn){
        e.preventDefault();
        e.stopPropagation();
        applyPrompt();
        return;
      }
      const xBtn = e.target && e.target.closest && e.target.closest('#pt-sched-prompt-x');
      if(xBtn){
        e.preventDefault();
        dismissPromptWithSkip();
        return;
      }
      const cancelBtn = e.target && e.target.closest && e.target.closest('#pt-sched-prompt-cancel');
      if(cancelBtn){
        e.preventDefault();
        dismissPromptWithSkip();
        return;
      }
      const m = document.getElementById('pt-sched-prompt');
      if(m && e.target === m){
        dismissPromptWithSkip();
      }
    }, true);
    document.addEventListener('keydown', function(e){
      const m = document.getElementById('pt-sched-prompt');
      if(e.key === 'Escape' && m && m.style.display === 'block') dismissPromptWithSkip();
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', init);
})();


// ===== extracted post-core patch script =====
(function(){
  const PT_VERSION = (function(){var m=document.querySelector('meta[name="pt-version"]');return (m&&m.content)||"33.382";})();
  window.PT_VERSION = PT_VERSION;

  /* v0.27.76: Day Streak drill-in modal */
  (function(){
    function _iso(d){
      const pad = n => String(n).padStart(2,'0');
      return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    }
    function _allStreaks(shotDays){
      // Returns array of {start, end, length} for every consecutive run.
      if(!shotDays.size) return [];
      const dates = [...shotDays].sort();
      const runs = [];
      let runStart = dates[0], prev = dates[0], len = 1;
      for(let i=1; i<dates.length; i++){
        const d = dates[i];
        const prevD = new Date(prev + 'T12:00:00');
        prevD.setDate(prevD.getDate()+1);
        const nextIso = _iso(prevD);
        if(d === nextIso){
          len++;
        } else {
          runs.push({ start:runStart, end:prev, length:len });
          runStart = d; len = 1;
        }
        prev = d;
      }
      runs.push({ start:runStart, end:prev, length:len });
      return runs.sort((a,b) => b.length - a.length || b.end.localeCompare(a.end));
    }
    function _ensure(){
      let m = document.getElementById('tmp-streak-modal');
      if(m) return m;
      m = document.createElement('div');
      m.id = 'tmp-streak-modal';
      m.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;max-width:520px;width:calc(100% - 32px);max-height:calc(100vh - 32px);overflow-y:auto;background:var(--color-background-primary,#fff);border:.5px solid var(--color-border-primary,#E5E7EB);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.35);display:none;padding:18px 20px';
      document.body.appendChild(m);
      let bd = document.getElementById('tmp-streak-backdrop');
      if(!bd){
        bd = document.createElement('div');
        bd.id = 'tmp-streak-backdrop';
        bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99998;display:none';
        bd.addEventListener('click', _close);
        document.body.appendChild(bd);
      }
      return m;
    }
    function _close(){
      const m = document.getElementById('tmp-streak-modal');
      const b = document.getElementById('tmp-streak-backdrop');
      if(m) m.style.display='none';
      if(b) b.style.display='none';
    }
    window.tmpShowDayStreak = function(){
      if(!window.S) return;
      const modal = _ensure();
      const bd = document.getElementById('tmp-streak-backdrop');
      const today = new Date(); today.setHours(0,0,0,0);
      const todayIso = _iso(today);
      const shots = (S.shots||[]);
      const shotDays = new Set(shots.map(s => s.date).filter(Boolean));
      // Current streak: walk back from today (or yesterday if today is empty)
      let cursor = new Date(today);
      if(!shotDays.has(_iso(cursor))) cursor.setDate(cursor.getDate()-1);
      let current = 0;
      while(shotDays.has(_iso(cursor))){ current++; cursor.setDate(cursor.getDate()-1); }
      // All streaks (sorted by length desc)
      const runs = _allStreaks(shotDays);
      const best = runs.length ? runs[0].length : 0;
      // 30-day strip
      const days30 = [];
      const c = new Date(today);
      c.setDate(c.getDate()-29);
      for(let i=0; i<30; i++){
        const iso = _iso(c);
        days30.push({ iso, hit: shotDays.has(iso), today: iso === todayIso });
        c.setDate(c.getDate()+1);
      }
      // Next milestone
      const milestones = [3,7,14,30,60,100,200,365];
      const nextMilestone = milestones.find(m => m > current) || null;
      // Render
      let h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div style="font-size:16px;font-weight:700">Day streak</div><button type="button" class="btn" id="tmp-streak-close" style="padding:4px 12px;font-size:12px">Close</button></div>';
      // Current vs best
      h += '<div style="display:flex;gap:12px;margin-bottom:18px">';
      h += '<div style="flex:1;padding:14px;border-radius:10px;background:linear-gradient(135deg,#FFF7ED 0%,#FFEDD5 100%);border:.5px solid #FED7AA"><div style="font-size:11px;font-weight:600;color:#9A3412;text-transform:uppercase;letter-spacing:.05em">Current</div><div style="font-size:30px;font-weight:800;color:#9A3412;line-height:1.05;margin-top:4px">'+current+'<span style="font-size:14px;font-weight:600;margin-left:4px">days</span></div></div>';
      h += '<div style="flex:1;padding:14px;border-radius:10px;background:linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%);border:.5px solid #A7F3D0"><div style="font-size:11px;font-weight:600;color:#065F46;text-transform:uppercase;letter-spacing:.05em">Best ever</div><div style="font-size:30px;font-weight:800;color:#065F46;line-height:1.05;margin-top:4px">'+best+'<span style="font-size:14px;font-weight:600;margin-left:4px">days</span></div></div>';
      h += '</div>';
      // 30-day strip
      h += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Last 30 days</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(30,1fr);gap:3px;align-items:center">';
      days30.forEach(d => {
        const bg = d.hit ? '#16A34A' : '#E5E7EB';
        const ring = d.today ? 'box-shadow:0 0 0 2px #EA580C;' : '';
        h += '<div title="'+d.iso+(d.hit?' ✓':' —')+'" style="aspect-ratio:1;border-radius:3px;background:'+bg+';'+ring+'"></div>';
      });
      h += '</div>';
      const hits30 = days30.filter(d => d.hit).length;
      h += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:6px">'+hits30+' of 30 days logged</div></div>';
      // Top streaks
      if(runs.length > 0){
        h += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Top streaks</div>';
        runs.slice(0,5).forEach((r,i) => {
          const isCurrent = (current > 0 && r.end === todayIso && r.length === current);
          h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:7px;background:'+(i%2===0?'var(--color-background-secondary,#FAFBFC)':'transparent')+';font-size:12px"><div><span style="display:inline-block;width:18px;color:var(--color-text-tertiary);font-weight:600">#'+(i+1)+'</span> <span style="color:var(--color-text-secondary)">'+r.start+' → '+r.end+'</span>'+(isCurrent?' <span style="font-size:9.5px;font-weight:600;padding:1px 6px;border-radius:4px;background:#FED7AA;color:#9A3412;margin-left:4px">CURRENT</span>':'')+'</div><div style="font-weight:700;color:var(--color-text-primary)">'+r.length+'d</div></div>';
        });
        h += '</div>';
      }
      // Next milestone
      if(nextMilestone){
        const remaining = nextMilestone - current;
        const pct = Math.min(100, Math.round(current/nextMilestone*100));
        h += '<div style="padding:12px 14px;border-radius:10px;background:#F1F5F9;border:.5px solid #CBD5E1"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div style="font-size:11.5px;font-weight:600;color:var(--color-text-secondary)">Next milestone: '+nextMilestone+' days</div><div style="font-size:11px;color:var(--color-text-tertiary)">'+remaining+' to go</div></div><div style="height:6px;border-radius:999px;background:#E2E8F0;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#EA580C,#F97316)"></div></div></div>';
      }
      modal.innerHTML = h;
      modal.style.display = 'block';
      if(bd) bd.style.display = 'block';
      const cb = document.getElementById('tmp-streak-close');
      if(cb) cb.addEventListener('click', _close);
    };
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){
        const m = document.getElementById('tmp-streak-modal');
        if(m && m.style.display === 'block') _close();
      }
    });
  })();

  /* v0.27.72: Active Peptides drill-in modal */
  (function(){
    function _isoFmt(d){
      const pad = n => String(n).padStart(2,'0');
      return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    }
    function _daysAgo(iso){
      if(!iso) return null;
      const t = new Date(); t.setHours(0,0,0,0);
      const d = new Date(iso + 'T12:00:00');
      if(isNaN(d.getTime())) return null;
      d.setHours(0,0,0,0);
      return Math.round((t - d) / 86400000);
    }
    function _scheduleLabel(it){
      if(it.interval > 0){
        return 'every ' + it.interval + 'd';
      }
      const days = ['M','T','W','T','F','S','S'];
      const long = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const slots = [];
      const sk = (n,t,di) => n + '/' + t + '/' + di;
      for(let di=0; di<7; di++){
        const am = !!(S.sched && S.sched[sk(it.name,'am',di)]);
        const pm = !!(S.sched && S.sched[sk(it.name,'pm',di)]);
        if(am || pm) slots.push(long[di]);
      }
      return slots.length ? slots.join(', ') : 'no schedule';
    }
    function _stockBadge(it){
      const fz = +it.fz || 0, fr = +it.fr || 0, dk = +it.dk || 0;
      const total = fz + fr + dk;
      if(total === 0){
        return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:#FEE2E2;color:#991B1B">Out</span>';
      }
      const parts = [];
      if(fr > 0) parts.push(fr + ' fridge');
      if(fz > 0) parts.push(fz + ' freezer');
      if(dk > 0) parts.push(dk + ' desk');
      return '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:#DCFCE7;color:#065F46">' + parts.join(' · ') + '</span>';
    }
    function _ensureModal(){
      let modal = document.getElementById('tmp-active-peps-modal');
      if(modal) return modal;
      modal = document.createElement('div');
      modal.id = 'tmp-active-peps-modal';
      modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;max-width:560px;width:calc(100% - 32px);max-height:calc(100vh - 32px);overflow-y:auto;background:var(--color-background-primary,#fff);border:.5px solid var(--color-border-primary,#E5E7EB);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.35);display:none;padding:18px 20px';
      document.body.appendChild(modal);
      let bd = document.getElementById('tmp-active-peps-backdrop');
      if(!bd){
        bd = document.createElement('div');
        bd.id = 'tmp-active-peps-backdrop';
        bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99998;display:none';
        bd.addEventListener('click', _close);
        document.body.appendChild(bd);
      }
      return modal;
    }
    function _close(){
      const m = document.getElementById('tmp-active-peps-modal');
      const b = document.getElementById('tmp-active-peps-backdrop');
      if(m) m.style.display = 'none';
      if(b) b.style.display = 'none';
    }
    window.tmpShowActivePeptides = function(){
      if(!window.S || !S.inv) return;
      const modal = _ensureModal();
      const bd = document.getElementById('tmp-active-peps-backdrop');
      // Compute active peptides: any peptide with sched slot OR interval > 0
      const sk = (n,t,di) => n + '/' + t + '/' + di;
      const activeNames = new Set();
      Object.keys(S.sched || {}).forEach(k => {
        if(S.sched[k]) activeNames.add(k.split('/')[0]);
      });
      (S.inv || []).forEach(it => {
        if(it && !it.isSupply && !it.archived && it.interval > 0) activeNames.add(it.name);
      });
      // Build list of items, sorted by last-shot date desc (most recent first)
      const items = [];
      activeNames.forEach(nm => {
        const it = (S.inv || []).find(i => i && !i.isSupply && i.name === nm);
        if(!it || it.archived) return;
        const shots = (S.shots || []).filter(s => s && s.peptide === nm);
        let lastIso = null;
        if(shots.length){
          shots.sort((a,b) => (b.date||'').localeCompare(a.date||''));
          lastIso = shots[0].date;
        }
        items.push({ it, lastIso, shotsCount: shots.length });
      });
      items.sort((a,b) => {
        const al = a.lastIso || '0000-00-00';
        const bl = b.lastIso || '0000-00-00';
        return bl.localeCompare(al);
      });
      // Render
      let h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div style="font-size:16px;font-weight:700">Active peptides <span style="font-weight:500;color:var(--color-text-tertiary);font-size:14px">(' + items.length + ')</span></div><button type="button" class="btn" id="tmp-active-peps-close" style="padding:4px 12px;font-size:12px">Close</button></div>';
      if(!items.length){
        h += '<div style="text-align:center;padding:28px;color:var(--color-text-tertiary);font-size:13px">No active peptides yet. Add one in the peptide manager.</div>';
      } else {
        h += '<div style="display:flex;flex-direction:column;gap:8px">';
        items.forEach(({ it, lastIso, shotsCount }) => {
          const c = (typeof pepColor === 'function') ? pepColor(it.name) : { bg:'#F3F4F6', text:'#374151', border:'#D1D5DB' };
          const sched = _scheduleLabel(it);
          const stock = _stockBadge(it);
          const ago = _daysAgo(lastIso);
          const lastTxt = ago === null ? '<span style="color:var(--color-text-tertiary)">no shots logged</span>'
                       : ago === 0 ? '<span style="color:#059669;font-weight:600">today</span>'
                       : ago === 1 ? 'yesterday'
                       : ago + 'd ago';
          let cycleTxt = '';
          if(it.cycleEnd){
            const endDate = new Date(it.cycleEnd + 'T12:00:00');
            const today = new Date(); today.setHours(0,0,0,0);
            const daysToEnd = Math.round((endDate - today) / 86400000);
            if(daysToEnd > 0){
              cycleTxt = '<span style="font-size:10px;color:var(--color-text-tertiary);margin-left:6px">ends ' + endDate.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' (' + daysToEnd + 'd)</span>';
            } else if(daysToEnd === 0){
              cycleTxt = '<span style="font-size:10px;color:#B45309;font-weight:600;margin-left:6px">cycle ends today</span>';
            } else {
              cycleTxt = '<span style="font-size:10px;color:#991B1B;margin-left:6px">cycle ended ' + Math.abs(daysToEnd) + 'd ago</span>';
            }
          }
          const idAttr = (it.id != null) ? ('data-pep-id="' + it.id + '"') : '';
          h += '<div ' + idAttr + ' class="tmp-active-pep-row" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:.5px solid var(--color-border-primary,#E5E7EB);border-radius:9px;cursor:pointer;background:var(--color-background-secondary,#FAFBFC)" title="Click to edit">';
          h += '<div style="font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:6px;background:' + c.bg + ';color:' + c.text + ';border:.5px solid ' + c.border + ';white-space:nowrap">' + (window.escH||String)(it.name) + '</div>';
          h += '<div style="flex:1;min-width:0;font-size:11.5px;color:var(--color-text-secondary);line-height:1.4">';
          h += '<div>' + sched + cycleTxt + '</div>';
          h += '<div style="margin-top:2px;font-size:11px"><span style="color:var(--color-text-tertiary)">last shot:</span> ' + lastTxt + ' · <span style="color:var(--color-text-tertiary)">' + shotsCount + ' total</span></div>';
          h += '</div>';
          h += stock;
          h += '</div>';
        });
        h += '</div>';
      }
      modal.innerHTML = h;
      modal.style.display = 'block';
      if(bd) bd.style.display = 'block';
      // Wire close + row click (jump to peptide editor)
      const closeBtn = document.getElementById('tmp-active-peps-close');
      if(closeBtn) closeBtn.addEventListener('click', _close);
      modal.querySelectorAll('.tmp-active-pep-row').forEach(row => {
        row.addEventListener('click', function(){
          const pid = parseInt(row.dataset.pepId);
          if(!pid) return;
          _close();
          // Open the peptide manager and edit this peptide
          try {
            if(typeof window.openPepEdit === 'function') window.openPepEdit(pid);
            else if(typeof window.editPep === 'function') window.editPep(pid);
            else {
              // Fallback: trigger the existing inv-edit-btn click delegation
              const btn = document.querySelector('[data-eid="' + pid + '"].inv-edit-btn');
              if(btn) btn.click();
            }
          } catch(_){}
        });
      });
    };
    // Escape key closes the modal
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){
        const m = document.getElementById('tmp-active-peps-modal');
        if(m && m.style.display === 'block') _close();
      }
    });
  })();

  /* v0.27.67: Inventory row Delete -> Archive/Delete modal portal */
  (function(){
    function _portalPepDbox(){
      var tbox = document.getElementById('pep-dbox');
      if (!tbox) return null;
      if (tbox.dataset.portaled === '1') return tbox;
      // Move modal to body so visibility is independent of #pepmgr.
      try { document.body.appendChild(tbox); } catch(_){}
      tbox.style.position = 'fixed';
      tbox.style.top = '50%';
      tbox.style.left = '50%';
      tbox.style.transform = 'translate(-50%, -50%)';
      tbox.style.zIndex = '99999';
      tbox.style.maxWidth = '480px';
      tbox.style.width = 'calc(100% - 32px)';
      tbox.style.maxHeight = 'calc(100vh - 32px)';
      tbox.style.overflowY = 'auto';
      tbox.style.borderRadius = '12px';
      tbox.style.boxShadow = '0 20px 60px rgba(0,0,0,0.35)';
      tbox.style.background = 'var(--color-background-primary, #fff)';
      tbox.style.border = '.5px solid var(--color-border-primary, #E5E7EB)';
      // Backdrop
      var bd = document.getElementById('pep-dbox-backdrop');
      if (!bd){
        bd = document.createElement('div');
        bd.id = 'pep-dbox-backdrop';
        bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99998;display:none';
        bd.addEventListener('click', function(){
          var t = document.getElementById('pep-dbox');
          var b = document.getElementById('pep-dbox-backdrop');
          if (t) t.style.display = 'none';
          if (b) b.style.display = 'none';
        });
        document.body.appendChild(bd);
      }
      tbox.dataset.portaled = '1';
      return tbox;
    }
    // Patch tmpShowPepDelete: portal first, then show backdrop alongside.
    function _wrapShow(){
      var fn = window.tmpShowPepDelete;
      if (typeof fn !== 'function' || fn.__portalWrapped) return false;
      var wrapped = function(pepId){
        _portalPepDbox();
        var r = fn.apply(this, arguments);
        var bd = document.getElementById('pep-dbox-backdrop');
        if (bd) bd.style.display = 'block';
        return r;
      };
      wrapped.__portalWrapped = true;
      window.tmpShowPepDelete = wrapped;
      return true;
    }
    // Hide backdrop whenever pep-dbox is hidden via existing close paths.
    function _watchClose(){
      var tbox = document.getElementById('pep-dbox');
      if (!tbox || tbox.dataset.closeWatched === '1') return;
      tbox.dataset.closeWatched = '1';
      var mo = new MutationObserver(function(){
        var bd = document.getElementById('pep-dbox-backdrop');
        if (!bd) return;
        bd.style.display = (tbox.style.display === 'none' || tbox.style.display === '') ? 'none' : 'block';
      });
      try { mo.observe(tbox, {attributes:true, attributeFilter:['style']}); } catch(_){}
    }
    // Inventory row Delete router: peptides -> Archive/Delete modal,
    // supplies -> simple confirm-and-delete.
    window.ptInvDeleteRouter = function(id){
      if (!window.S || !Array.isArray(S.inv)) {
        alert('Inventory not ready. Try again in a moment.');
        return;
      }
      id = parseInt(id, 10);
      if (!id) return;
      var it = S.inv.find(function(i){ return i && i.id === id; });
      if (!it){ alert('Inventory entry not found.'); return; }
      if (it.isSupply){
        if (!confirm('Delete "' + (it.name || 'this supply') + '" from inventory?')) return;
        S.inv = S.inv.filter(function(x){ return x.id !== id; });
        try { if (typeof save === 'function') save(); } catch(_){}
        try { if (typeof renderInv === 'function') renderInv(); } catch(_){}
        return;
      }
      // Peptide: open the Archive vs Delete modal
      if (typeof window.tmpShowPepDelete === 'function'){
        _portalPepDbox();
        var ok = _wrapShow();
        // wrapped will run on next call; call directly since we just wrapped
        window.tmpShowPepDelete(id);
        var bd = document.getElementById('pep-dbox-backdrop');
        if (bd) bd.style.display = 'block';
        _watchClose();
      } else if (typeof window.ptInvDelete === 'function'){
        window.ptInvDelete(id);
      } else {
        alert('Delete handler unavailable. Reload the page.');
      }
    };
    // Try to wrap early; retry until tmpShowPepDelete exists.
    function _bootstrap(){
      _wrapShow();
      _watchClose();
    }
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', _bootstrap);
    } else {
      _bootstrap();
    }
    setTimeout(_bootstrap, 500);
    setTimeout(_bootstrap, 1500);
  })();

  // v0.27.66: live About-page version display.
  (function syncAboutVersion(){
    function apply(){
      const el = document.getElementById('tmp-about-version') || document.getElementById('pt-about-version');
      if(el && typeof PT_VERSION === 'string') el.textContent = 'v' + PT_VERSION;
    }
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
    setTimeout(apply, 1500);
  })();
  const UPDATE_BASE_KEY = 'tmp.updateBaseUrl';
  const UPDATE_BASES_DEFAULT = ['https://peptidegenius.netlify.app', 'https://peptidegenius.net'];
  const VERSION_CONTROL_KEY = 'tmp.versionControl.v1';
  function setStatus(text, color){
    const el = document.getElementById("tmp-update-status");
    if(!el) return;
    el.textContent = text || '';
    el.style.color = color || '#047857';
  }
  function semverGt(a, b){
    const pa = String(a||'').split('.').map(n => parseInt(n,10) || 0);
    const pb = String(b||'').split('.').map(n => parseInt(n,10) || 0);
    const len = Math.max(pa.length, pb.length);
    for(let i = 0; i < len; i++){
      const ai = pa[i] || 0, bi = pb[i] || 0;
      if(ai > bi) return true;
      if(ai < bi) return false;
    }
    return false;
  }
  function parseVersion(raw){
    const txt = String(raw || '').trim();
    if(!txt) return '';
    const m = txt.match(/(\d+(?:\.\d+){1,3})/);
    return m ? m[1] : txt;
  }
  function parseBuildId(raw){
    return String(raw || '').trim();
  }
  function formatIsoShort(iso){
    if(!iso) return '';
    try{
      const d = new Date(iso);
      if(Number.isNaN(d.getTime())) return '';
      return d.toLocaleString();
    }catch(_){ return ''; }
  }
  function normalizeBaseUrl(raw){
    const txt = String(raw || '').trim();
    if(!txt) return '';
    try{
      const u = new URL(txt, location.origin);
      u.hash = '';
      u.search = '';
      return u.toString().replace(/\/+$/, '');
    }catch(_){ return ''; }
  }
  function readMeta(name){
    const m = document.querySelector('meta[name="' + name + '"]');
    return m && m.content ? String(m.content).trim() : '';
  }
  function rememberActivePage(){
    try{
      var active = document.querySelector('#nav button.on, .hdr-tab-btn.on');
      if(active && active.dataset.pg){
        localStorage.setItem('tmp.lastActivePage', active.dataset.pg);
        return;
      }
      var vis = document.querySelector('.page[style*="display:block"], .page[style*="display: block"]');
      if(vis && vis.id){
        localStorage.setItem('tmp.lastActivePage', vis.id.replace(/^pg-/, ''));
      }
    }catch(_){}
  }
  async function clearRuntimeCaches(){
    try{
      if(navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
        const rs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(rs.map(r => r.unregister().catch(()=>{})));
      }
    }catch(_){}
    try{
      if(window.caches && caches.keys){
        const ks = await caches.keys();
        await Promise.all(ks.map(k => caches.delete(k).catch(()=>{})));
      }
    }catch(_){}
  }
  function buildUpdateBaseCandidates(){
    const list = [];
    const sameOriginOnly = location.protocol !== 'file:';
    const add = (v) => {
      const n = normalizeBaseUrl(v);
      if(!n || list.indexOf(n) !== -1) return;
      if(sameOriginOnly){
        try{
          if(new URL(n).origin !== location.origin) return;
        }catch(_){ return; }
      }
      list.push(n);
    };
    let stored = '';
    try{ stored = localStorage.getItem(UPDATE_BASE_KEY) || ''; }catch(_){}
    let query = '';
    try{
      query = new URLSearchParams(location.search).get('updateBase') || '';
    }catch(_){}
    const meta = readMeta('pt-update-base');
    add(stored);
    add(query);
    add(meta);
    if(sameOriginOnly) add(location.origin);
    else UPDATE_BASES_DEFAULT.forEach(base => add(base));
    return list;
  }
  async function fetchNetlifyUpdateInfo(base){
    const url = base + '/api/app-update?_v=' + Date.now();
    const res = await fetch(url, { cache: 'no-store', credentials: 'omit', mode: 'cors' });
    if(!res.ok) throw new Error('Netlify update endpoint HTTP ' + res.status);
    const data = await res.json().catch(()=>null);
    if(!data || !data.ok) throw new Error('Invalid Netlify update payload');
    const remote = parseVersion(data.version || data.version_raw || '');
    if(!remote) throw new Error('Missing Netlify version');
    const appUrl = data.app_url ? String(data.app_url) : (base + '/');
    return {
      remote,
      appUrl,
      base,
      source: 'netlify-function',
      channel: String(data.channel || 'stable'),
      buildId: parseBuildId(data.build_id || data.commit_ref || data.deploy_id || ''),
      generatedAt: String(data.generated_at || '')
    };
  }
  async function fetchHtmlUpdateInfo(base){
    const url = base + '/?_pv=' + Date.now();
    const res = await fetch(url, { cache: 'no-store', credentials: 'omit', mode: 'cors' });
    if(!res.ok) throw new Error('HTML fallback HTTP ' + res.status);
    const txt = await res.text();
    const m = txt.match(/<meta name="pt-version" content="([^"]+)"/);
    if(!m) throw new Error('HTML fallback missing pt-version');
    const b = txt.match(/<meta name="pt-build" content="([^"]+)"/);
    return {
      remote: parseVersion(m[1]),
      appUrl: base + '/',
      base,
      source: 'html-fallback',
      channel: 'stable',
      buildId: parseBuildId(b && b[1] ? b[1] : '')
    };
  }
  function readLocalVersionInfo(){
    return {
      version: parseVersion(typeof PT_VERSION !== 'undefined' ? PT_VERSION : ''),
      channel: readMeta('pt-channel') || 'stable',
      buildId: parseBuildId(readMeta('pt-build') || '')
    };
  }
  function updateToken(info){
    const v = parseVersion(info && (info.remote || info.version));
    const b = parseBuildId(info && info.buildId);
    return v + '|' + b;
  }
  function isRemoteUpdateAvailable(remoteInfo, localInfo){
    const remote = parseVersion(remoteInfo && remoteInfo.remote);
    const local = parseVersion(localInfo && localInfo.version);
    if(!remote) return false;
    if(semverGt(remote, local)) return true;
    if(semverGt(local, remote)) return false;
    const rb = parseBuildId(remoteInfo && remoteInfo.buildId);
    const lb = parseBuildId(localInfo && localInfo.buildId);
    if(rb && lb && rb !== lb) return true;
    return false;
  }
  function readVersionControlState(){
    try{
      const raw = localStorage.getItem(VERSION_CONTROL_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(_){ return {}; }
  }
  function writeVersionControlState(next){
    try{
      localStorage.setItem(VERSION_CONTROL_KEY, JSON.stringify(next || {}));
    }catch(_){}
  }
  function renderVersionControlDetail(remoteInfo){
    const el = document.getElementById('tmp-version-control-detail');
    if(!el) return;
    const local = readLocalVersionInfo();
    const state = readVersionControlState();
    const checkedAt = formatIsoShort(state.checkedAt);
    const localBits = ['Local v' + (local.version || '?')];
    if(local.channel) localBits.push('channel: ' + local.channel);
    if(local.buildId) localBits.push('build: ' + local.buildId.slice(0, 12));
    const remoteBits = [];
    if(remoteInfo && remoteInfo.remote){
      remoteBits.push('Remote v' + remoteInfo.remote);
      if(remoteInfo.channel) remoteBits.push('channel: ' + remoteInfo.channel);
      if(remoteInfo.buildId) remoteBits.push('build: ' + remoteInfo.buildId.slice(0, 12));
      if(remoteInfo.generatedAt) remoteBits.push('generated: ' + formatIsoShort(remoteInfo.generatedAt));
    }
    const checked = checkedAt ? ('Last check: ' + checkedAt) : '';
    el.textContent = [localBits.join(' · '), remoteBits.join(' · '), checked].filter(Boolean).join('  |  ');
  }
  async function resolveRemoteUpdateInfo(){
    const candidates = buildUpdateBaseCandidates();
    let lastError = '';
    for(const base of candidates){
      if(!base) continue;
      try{
        const info = await fetchNetlifyUpdateInfo(base);
        try{ localStorage.setItem(UPDATE_BASE_KEY, base); }catch(_){}
        return info;
      }catch(e1){
        lastError = e1 && e1.message ? e1.message : String(e1);
      }
      try{
        const info = await fetchHtmlUpdateInfo(base);
        try{ localStorage.setItem(UPDATE_BASE_KEY, base); }catch(_){}
        return info;
      }catch(e2){
        lastError = e2 && e2.message ? e2.message : String(e2);
      }
    }
    throw new Error(lastError || 'No reachable Netlify update source');
  }
  async function applyUpdate(info){
    const appUrl = (info && info.appUrl) ? String(info.appUrl) : location.href;
    rememberActivePage();
    if(location.protocol === 'file:'){
      try{ location.assign(appUrl); }catch(_){ window.open(appUrl, '_blank', 'noopener'); }
      return;
    }
    await clearRuntimeCaches();
    try{
      const u = new URL(appUrl, location.href);
      u.searchParams.set('_v', String(Date.now()));
      location.replace(u.toString());
    }catch(_){
      try { location.reload(true); } catch(__){ location.reload(); }
    }
  }
  window.__PT_UPDATE_SEMVER_GT__ = semverGt;
  window.__PT_GET_REMOTE_UPDATE_INFO__ = resolveRemoteUpdateInfo;
  window.__PT_APPLY_UPDATE__ = applyUpdate;
  window.__PT_GET_LOCAL_VERSION_INFO__ = readLocalVersionInfo;
  window.__PT_IS_REMOTE_UPDATE_AVAILABLE__ = isRemoteUpdateAvailable;
  window.__PT_UPDATE_TOKEN__ = updateToken;
  async function checkUpdate(){
    setStatus('Checking Netlify…','#047857');
    try {
      const info = await resolveRemoteUpdateInfo();
      const remote = parseVersion(info && info.remote);
      const localInfo = readLocalVersionInfo();
      const local = parseVersion(localInfo.version);
      const available = isRemoteUpdateAvailable(info, localInfo);
      const state = readVersionControlState();
      state.checkedAt = new Date().toISOString();
      state.local = localInfo;
      state.remote = {
        version: remote,
        buildId: parseBuildId(info && info.buildId),
        channel: String(info && info.channel || 'stable'),
        source: String(info && info.source || '')
      };
      state.lastToken = updateToken(info);
      writeVersionControlState(state);
      renderVersionControlDetail(info);
      if(!remote){ setStatus('Couldn\'t read remote version','#92400E'); return; }
      if(!available){
        setStatus('✓ You\'re up to date · v' + local, '#047857');
      } else {
        const buildSuffix = info && info.buildId ? (' · build ' + String(info.buildId).slice(0, 12)) : '';
        setStatus('⚡ Netlify update available: v' + remote + buildSuffix + ' (you have v' + local + ')', '#92400E');
        if(confirm('A new Netlify version is available: v' + remote + buildSuffix + '\n\nYou are running v' + local + '. Update now?')){
          await applyUpdate(info);
        }
      }
    } catch(e){
      setStatus('✕ Netlify update check failed: ' + (e.message||e), '#A32D2D');
    }
  }
  function init(){
    const btn = document.getElementById("tmp-check-update-btn");
    if(btn) btn.addEventListener('click', checkUpdate);
    renderVersionControlDetail(null);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


// ===== extracted post-core patch script =====
(function(){
  const DISMISS_KEY = 'tmp.updateDismissedFor';
  function dismissToken(info){
    if(typeof window.__PT_UPDATE_TOKEN__ === 'function') return window.__PT_UPDATE_TOKEN__(info);
    const v = String(info && info.remote || '');
    const b = String(info && info.buildId || '');
    return v + '|' + b;
  }
  const AUTO_CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
  const AUTO_CHECK_MIN_GAP_MS = 45 * 1000;      // throttle foreground triggers
  let autoCheckTimer = null;
  let lastAutoCheckAt = 0;
  let inFlight = false;
  function showBanner(info){
    const remote = info && info.remote ? String(info.remote) : '';
    const appUrl = info && info.appUrl ? String(info.appUrl) : '';
    const sourceLabel = (function(){
      try{
        return new URL(appUrl || (info && info.base) || location.href).host || 'Netlify';
      }catch(_){
        return 'Netlify';
      }
    })();
    const banner = document.getElementById('pt-update-banner');
    if(!banner) return;
    const titleEl = document.getElementById('pt-update-banner-title');
    const detailEl = document.getElementById('pt-update-banner-detail');
    const actionBtn = document.getElementById('pt-update-banner-action');
    const dismissBtn = document.getElementById('pt-update-banner-dismiss');
    const isLocal = location.protocol === 'file:';
    const local = (typeof PT_VERSION !== 'undefined') ? PT_VERSION : '?';
    if(titleEl) titleEl.textContent = '✨ Version ' + remote + ' is available';
    if(detailEl){
      detailEl.innerHTML = isLocal
        ? 'You\'re running v' + local + ' from a downloaded file. Click Update to open the latest Netlify build from <b>' + sourceLabel + '</b> in this tab.'
        : 'You\'re on v' + local + '. Click Update to refresh from <b>' + sourceLabel + '</b> into v' + remote + '.';
    }
    if(actionBtn){
      actionBtn.textContent = '↻ Update';
      actionBtn.onclick = async () => {
        try { actionBtn.disabled = true; actionBtn.textContent = 'Updating…'; } catch(_){}
        try{
          if(typeof window.__PT_APPLY_UPDATE__ === 'function'){
            await window.__PT_APPLY_UPDATE__(info);
            return;
          }
        }catch(_){}
        try{
          if(appUrl) location.assign(appUrl);
          else location.reload();
        }catch(_){
          location.reload();
        }
      };
    }
    if(dismissBtn){
      dismissBtn.onclick = () => {
        try { localStorage.setItem(DISMISS_KEY, dismissToken(info)); } catch(_){}
        banner.style.display = 'none';
        if(window._ptUpdateCountdown){ clearInterval(window._ptUpdateCountdown); window._ptUpdateCountdown = null; }
      };
    }
    banner.style.display = 'block';
    // v0.27.61: auto-reload countdown — non-local, non-dismissed users get
    // pulled to latest in 10 seconds unless they cancel.
    if(!isLocal){
      let secs = 10;
      if(detailEl){
        const baseHtml = detailEl.innerHTML;
        if(window._ptUpdateCountdown){ clearInterval(window._ptUpdateCountdown); }
        window._ptUpdateCountdown = setInterval(() => {
          secs--;
          if(secs <= 0){
            clearInterval(window._ptUpdateCountdown);
            window._ptUpdateCountdown = null;
            // Trigger the same hard-reload path as the action button
            if(actionBtn) actionBtn.click();
          } else {
            detailEl.innerHTML = baseHtml + ' <span style="color:#7C2D12;font-weight:700">· Auto-updating in ' + secs + 's</span>';
          }
        }, 1000);
      }
    }
  }
  function check(opts){
    const options = opts || {};
    const force = !!options.force;
    const now = Date.now();
    if(inFlight) return;
    if(!force && (now - lastAutoCheckAt) < AUTO_CHECK_MIN_GAP_MS) return;
    if(typeof PT_VERSION === 'undefined') return;
    let dismissedToken = '';
    try { dismissedToken = localStorage.getItem(DISMISS_KEY) || ''; } catch(_){}
    if(typeof window.__PT_GET_REMOTE_UPDATE_INFO__ !== 'function') return;
    inFlight = true;
    lastAutoCheckAt = now;
    window.__PT_GET_REMOTE_UPDATE_INFO__()
      .then(info => {
        if(!info || !info.remote) return;
        const localInfo = (typeof window.__PT_GET_LOCAL_VERSION_INFO__ === 'function')
          ? window.__PT_GET_LOCAL_VERSION_INFO__()
          : { version: PT_VERSION || '', buildId: '' };
        const isUpdate = (typeof window.__PT_IS_REMOTE_UPDATE_AVAILABLE__ === 'function')
          ? window.__PT_IS_REMOTE_UPDATE_AVAILABLE__(info, localInfo)
          : false;
        if(!isUpdate) return;                       // up to date or newer locally
        const token = dismissToken(info);
        if(token && token === dismissedToken) return; // user dismissed this exact release token
        showBanner(info);
      })
      .catch(() => {})   // silent: no network, blocked, etc.
      .finally(() => { inFlight = false; });
  }
  function scheduleAutoChecks(){
    if(autoCheckTimer) return;
    autoCheckTimer = setInterval(function(){ if(__tmpDocVisible()) check(); }, AUTO_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') check();
    });
    window.addEventListener('focus', () => check());
    window.addEventListener('online', () => setTimeout(() => check({ force:true }), 1500));
  }
  // Defer behind init so we don't compete with the main app boot.
  function go(){
    setTimeout(() => check({ force:true }), 1800);
    scheduleAutoChecks();
  }
  window.__PT_AUTO_CHECK_UPDATES__ = function(){ check({ force:true }); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();


// ===== LOGO LETTERING HOME/TOP CLICK (CALC-APP-NAVIGATION-ARROWS-R1 / RC-UX-3) =====
(function(){
  function goTop(){
    var topBtn=document.getElementById('pt-snav-top');
    if(topBtn){ topBtn.click(); return; }
    try{ window.scrollTo({top:0,behavior:'smooth'}); }
    catch(_){ window.scrollTo(0,0); }
  }
  function wire(){
    var logo=document.querySelector('img.gpt-site-logo');
    if(!logo||logo.dataset.homeTopWired==='1') return;
    logo.dataset.homeTopWired='1';
    logo.addEventListener('click',function(e){
      e.preventDefault();
      goTop();
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire);
  else wire();
})();


// ===== extracted post-core patch script =====
(function(){
  function refreshPepDropdown(){
    const sel = document.getElementById('vl-pool-pep');
    if(!sel) return;
    // v0.27.18: ensure the diagnostic div exists FIRST and always populates,
    // so we have visible evidence of what the wizard saw — even when
    // something throws or window.S isn't ready yet.
    let diag = document.getElementById('vl-pool-pep-diag');
    if(!diag){
      diag = document.createElement('div');
      diag.id = 'vl-pool-pep-diag';
      diag.style.cssText = 'font-size:11px;margin-top:5px;line-height:1.45';
      sel.parentNode && sel.parentNode.appendChild(diag);
    }
    function showDiag(html, color){
      diag.style.color = color || 'var(--color-text-tertiary)';
      diag.innerHTML = html;
    }
    // Pre-flight checks with explicit error messaging
    if(!window.S){
      showDiag('<b style="color:#A32D2D">⚠ App state not ready.</b> Try closing this dialog and reopening it.', '#A32D2D');
      return;
    }
    if(!Array.isArray(S.vials)){
      showDiag('<b style="color:#A32D2D">⚠ Vials data is malformed</b> (not an array). Type seen: ' + (typeof S.vials) + '. Try Save backup → Reload page → Import.', '#A32D2D');
      return;
    }
    try {
      // Group by trim+lowercase
      const buckets = new Map();
      let totalActive = 0;
      let totalAll = S.vials.length;
      let badStatus = 0;
      let blankName = 0;
      S.vials.forEach(v => {
        if(!v) return;
        if(v.status !== 'active'){ badStatus++; return; }
        const raw = (v.peptideName || '').toString().trim();
        if(!raw){ blankName++; return; }
        const key = raw.toLowerCase();
        const b = buckets.get(key) || {display: raw, count: 0};
        b.count++;
        if(raw.length > b.display.length) b.display = raw;
        buckets.set(key, b);
        totalActive++;
      });
      const all = [...buckets.values()];
      all.sort((a,b) => a.display.localeCompare(b.display, undefined, {sensitivity:'base'}));
      const eligible = all.filter(b => b.count >= 2);
      const ineligible = all.filter(b => b.count < 2);
      const prev = sel.value;
      let html = '<option value="">— pick a peptide —</option>';
      if(eligible.length){
        html += eligible.map(b =>
          '<option value="'+b.display.replace(/"/g,'&quot;')+'">'
          + b.display + ' (' + b.count + ' active vials)'
          + '</option>'
        ).join('');
      }
      if(ineligible.length){
        html += '<option disabled value="">â”€â”€â”€ only 1 active vial â”€â”€â”€</option>';
        html += ineligible.map(b =>
          '<option disabled value="">' + b.display + ' (1 active vial — can\'t pool)</option>'
        ).join('');
      }
      sel.innerHTML = html;
      if(eligible.find(b => b.display === prev)) sel.value = prev;
      // v0.27.18: ALWAYS show diagnostic, even on success — gives us screenshot
      // evidence of what the wizard saw on every open.
      const stats = '<span style="color:#6B7280;font-size:10.5px"> · scan: ' + totalAll + ' total / ' + totalActive + ' active / ' + buckets.size + ' peptide' + (buckets.size===1?'':'s') + (badStatus?' / ' + badStatus + ' inactive':'') + (blankName?' / ' + blankName + ' blank-name':'') + '</span>';
      if(eligible.length){
        showDiag('<span style="color:#5B21B6;font-weight:600">✓ ' + eligible.length + ' peptide' + (eligible.length===1?'':'s') + '</span> can be pooled.' + stats);
      } else if(totalActive === 0){
        showDiag('<b>No active vials found.</b> Add vials via <b>+ Add vial(s)</b> on the Vials card.' + stats, '#A32D2D');
      } else if(buckets.size === totalActive){
        showDiag('<b>No peptide has 2+ active vials.</b> Each active vial is a different peptide.' + stats, '#A32D2D');
      } else {
        const histHint = totalAll > totalActive
          ? ' Some vials are marked depleted/discarded — try toggling <b>👁 Show history</b> on the Vials list.'
          : '';
        showDiag('<b>No peptide qualifies yet.</b>' + histHint + stats, '#A32D2D');
      }
    } catch(err) {
      // Hard error inside the bucket-builder — make it visible.
      showDiag('<b style="color:#A32D2D">⚠ Wizard error:</b> ' + (err && err.message ? err.message : String(err)) + '<br><span style="font-size:10.5px;color:#6B7280">S.vials.length=' + (S.vials && S.vials.length) + '. Try Save backup, reload, then re-import.</span>', '#A32D2D');
      console && console.error && console.error('[Pool wizard] refreshPepDropdown failed:', err);
    }
  }

  function renderSourceVials(name){
    const host = document.getElementById('vl-pool-vials');
    const wrap = document.getElementById('vl-pool-vials-wrap');
    if(!host || !wrap) return;
    if(!name){ wrap.style.display = 'none'; host.innerHTML = ''; return; }
    wrap.style.display = 'block';
    // v0.27.7: case-insensitive match (mirrors the dropdown's grouping)
    const wanted = name.trim().toLowerCase();
    const vials = (S.vials || []).filter(v => (v.peptideName||'').trim().toLowerCase() === wanted && v.status === 'active');
    if(!vials.length){
      host.innerHTML = '<div style="padding:.6rem;font-size:11.5px;color:var(--color-text-tertiary);font-style:italic">No active vials for this peptide.</div>';
      return;
    }
    // Sort: fridge first (already reconstituted, easy to combine), then desk, then freezer.
    // Within same location, oldest reconDate first (use those before they expire).
    const locOrder = {fridge:0, desk:1, freezer:2};
    vials.sort((a,b) => {
      const al = locOrder[a.location] ?? 9, bl = locOrder[b.location] ?? 9;
      if(al !== bl) return al - bl;
      const ad = a.reconDate || '9999-12-31';
      const bd = b.reconDate || '9999-12-31';
      if(ad !== bd) return ad < bd ? -1 : 1;
      return (a.id||0) - (b.id||0);
    });
    // Detect: is there exactly one shared batchId across all vials? Show as chip if so.
    const batches = [...new Set(vials.map(v => v.batchId).filter(Boolean))];
    const sharedBatchChip = (batches.length === 1)
      ? '<span style="display:inline-block;padding:2px 8px;border-radius:5px;background:#EDE9FE;color:#5B21B6;font-size:10.5px;font-weight:600;margin-left:6px">📦 Batch '+batches[0].replace(/"/g,'&quot;')+'</span>'
      : '';
    // Header: select-all/none controls + batch info
    const controls = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px 6px;border-bottom:.5px solid var(--color-border-tertiary);background:rgba(245,243,255,.6);font-size:11px;color:#5B21B6;font-weight:600">'
      +   '<span>'+vials.length+' active vial'+(vials.length===1?'':'s')+sharedBatchChip+'</span>'
      +   '<span style="display:flex;gap:6px">'
      +     '<button type="button" id="vl-pool-selall" style="border:.5px solid #C4B5FD;background:#fff;color:#6D28D9;padding:2px 9px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">✓ Select all</button>'
      +     '<button type="button" id="vl-pool-selnone" style="border:.5px solid #DDD6FE;background:#fff;color:#7C3AED;padding:2px 9px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">✗ None</button>'
      +   '</span>'
      + '</div>';
    const rowsHtml = vials.map(v => {
      const remMg = ((v.remainingMcg||0) / 1000).toFixed(2);
      const labelMg = v.labelMg || 0;
      const loc = v.location || '?';
      const locIc = loc === 'fridge' ? '<svg viewBox="0 0 12 16" width="12" height="13" style="vertical-align:-2px;display:inline-block"><rect x="1" y="1" width="10" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="1" y1="5.5" x2="11" y2="5.5" stroke="currentColor" stroke-width="1.4"/><line x1="9" y1="2.5" x2="9" y2="3.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="9" y1="7.5" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>' : loc === 'freezer' ? '🧊' : '🗄️';
      const batchTxt = v.batchId && batches.length !== 1 ? ' · <span style="color:#5B21B6;font-weight:600">📦 '+v.batchId.replace(/"/g,'&quot;')+'</span>' : '';
      const reconTxt = v.reconDate ? ' · recon ' + v.reconDate : '';
      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border-bottom:.5px solid var(--color-border-tertiary)" data-vid="'+v.id+'">'
        + '<input type="checkbox" class="vl-pool-chk" data-vid="'+v.id+'" data-mg="'+labelMg+'" data-rem="'+(v.remainingMcg||0)+'" style="cursor:pointer;flex-shrink:0">'
        + '<span style="flex:1;font-size:12px;color:var(--color-text-primary)">#'+v.id+' · '+labelMg+'mg vial · '+remMg+'mg remaining · '+locIc+' '+loc+batchTxt+reconTxt+'</span>'
        + '</label>';
    }).join('');
    host.innerHTML = controls + rowsHtml;
    host.querySelectorAll('.vl-pool-chk').forEach(c => c.addEventListener('change', refreshSummary));
    const sa = host.querySelector('#vl-pool-selall');
    if(sa) sa.addEventListener('click', () => {
      host.querySelectorAll('.vl-pool-chk').forEach(c => c.checked = true);
      refreshSummary();
    });
    const sn = host.querySelector('#vl-pool-selnone');
    if(sn) sn.addEventListener('click', () => {
      host.querySelectorAll('.vl-pool-chk').forEach(c => c.checked = false);
      refreshSummary();
    });
  }

  function selectedSourceIds(){
    const host = document.getElementById('vl-pool-vials');
    if(!host) return [];
    return [...host.querySelectorAll('.vl-pool-chk:checked')].map(c => parseInt(c.dataset.vid));
  }

  function refreshSummary(){
    const cfg = document.getElementById('vl-pool-config');
    const sumEl = document.getElementById('vl-pool-summary');
    const confirmBtn = document.getElementById('vl-pool-confirm');
    if(!cfg || !sumEl || !confirmBtn) return;
    const ids = selectedSourceIds();
    if(ids.length < 2){
      cfg.style.display = 'none';
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '.55';
      return;
    }
    cfg.style.display = 'block';
    const sources = (S.vials||[]).filter(v => ids.indexOf(v.id) >= 0);
    const totalMg = sources.reduce((s,v) => s + (v.labelMg || 0), 0);
    const totalRemMcg = sources.reduce((s,v) => s + (v.remainingMcg || 0), 0);
    const bacMl = parseFloat(document.getElementById('vl-pool-bac').value) || 0;
    const concStr = bacMl > 0 ? ((totalMg / bacMl).toFixed(2) + ' mg/mL') : '— (set BAC water)';
    // v0.27.7: per-shot preview when peptide dose data exists in S.inv.
    let perShotLine = '';
    if(bacMl > 0 && totalMg > 0){
      const pepName = (sources[0].peptideName || '').trim();
      const inv = (S.inv || []).find(i => (i.name||'').trim().toLowerCase() === pepName.toLowerCase());
      const doseMcg = inv && inv.dose
        ? (inv.doseUnit === 'mg' ? inv.dose * 1000 : inv.dose)
        : 0;
      if(doseMcg > 0){
        // Insulin syringes: 100 units per mL standard (U-100). So:
        //   units per shot = (dose_mg / mg_per_mL) * 100
        const mgPerMl = totalMg / bacMl;
        const unitsPerShot = (doseMcg/1000) / mgPerMl * 100;
        const totalDoses = Math.floor(totalRemMcg / doseMcg);
        perShotLine = '<br>📐 At ' + (doseMcg>=1000?(doseMcg/1000)+'mg':doseMcg+'mcg') + '/dose: <b>'
          + unitsPerShot.toFixed(1) + ' units</b> per shot · <b>~' + totalDoses + ' doses</b> available';
      }
    }
    sumEl.innerHTML = ''
      + '<b>Pooled vial preview</b><br>'
      + 'Sources: ' + ids.length + ' vials → ' + totalMg + ' mg total label · ' + (totalRemMcg/1000).toFixed(2) + ' mg remaining content<br>'
      + 'Destination: ' + (bacMl || '?') + ' mL BAC → concentration ' + concStr
      + perShotLine;
    confirmBtn.disabled = bacMl <= 0;
    confirmBtn.style.opacity = bacMl > 0 ? '1' : '.55';
  }

  function openPool(){
    const m = document.getElementById('vl-pool-modal');
    if(!m) return;
    refreshPepDropdown();
    document.getElementById('vl-pool-vials-wrap').style.display = 'none';
    document.getElementById('vl-pool-config').style.display = 'none';
    document.getElementById('vl-pool-pep').value = '';
    document.getElementById('vl-pool-bac').value = '';
    document.getElementById('vl-pool-notes').value = '';
    document.getElementById('vl-pool-msg').textContent = '';
    document.getElementById('vl-pool-confirm').disabled = true;
    document.getElementById('vl-pool-confirm').style.opacity = '.55';
    m.style.display = 'block';
    m.setAttribute('aria-hidden', 'false');
  }
  function closePool(){
    const m = document.getElementById('vl-pool-modal');
    if(m){ m.style.display = 'none'; m.setAttribute('aria-hidden','true'); }
  }
  window.openPoolVialsModal = openPool;

  function confirmPool(){
    const msg = document.getElementById('vl-pool-msg');
    const ids = selectedSourceIds();
    if(ids.length < 2){
      if(msg){ msg.textContent = 'Select at least 2 vials.'; msg.style.color = '#A32D2D'; }
      return;
    }
    const bacMl = parseFloat(document.getElementById('vl-pool-bac').value);
    if(!(bacMl > 0)){
      if(msg){ msg.textContent = 'Enter the total BAC water in the destination pen (mL).'; msg.style.color = '#A32D2D'; }
      return;
    }
    const exp = parseInt(document.getElementById('vl-pool-exp').value, 10) || 28;
    const notes = (document.getElementById('vl-pool-notes').value || '').trim();
    const sources = (S.vials || []).filter(v => ids.indexOf(v.id) >= 0);
    if(sources.length < 2){
      if(msg){ msg.textContent = 'Sources lookup failed.'; msg.style.color = '#A32D2D'; }
      return;
    }
    const pep = sources[0].peptideName;
    const totalLabelMg = sources.reduce((s,v) => s + (v.labelMg || 0), 0);
    const totalRemMcg = sources.reduce((s,v) => s + (v.remainingMcg || 0), 0);

    // Create pooled vial
    if(!Array.isArray(S.vials)) S.vials = [];
    if(typeof S.nV !== 'number') S.nV = 1;
    const today = (typeof td === 'function') ? td() : new Date().toISOString().slice(0,10);
    const pooledId = S.nV++;
    const pooled = {
      id: pooledId,
      peptideName: pep,
      labelMg: totalLabelMg,
      totalMcg: totalRemMcg,
      remainingMcg: totalRemMcg,
      reconBacMl: bacMl,
      reconExpDays: exp,
      reconDate: today,
      storedDate: today,
      location: 'fridge',
      status: 'active',
      sources: ids.slice(),
      pooled: true,
      notes: (notes ? (notes + ' · ') : '') + 'Pooled from vials #' + ids.join(', #'),
    };
    S.vials.push(pooled);

    // Mark sources as depleted/transferred
    sources.forEach(src => {
      src.remainingMcg = 0;
      src.status = 'depleted';
      src.depletedDate = today;
      src.notes = (src.notes ? (src.notes + ' · ') : '') + '→ pooled into vial #' + pooledId;
    });

    try { typeof recomputeStockFromVials === 'function' && recomputeStockFromVials(pep); } catch(_){}
    try { typeof save === 'function' && save(); } catch(_){}
    try { typeof renderVials === 'function' && renderVials(); } catch(_){}
    try { typeof renderInv === 'function' && renderInv(); } catch(_){}
    try { typeof renderStack === 'function' && renderStack(); } catch(_){}

    if(msg){
      msg.textContent = '✓ Pooled ' + ids.length + ' vials → vial #' + pooledId + ' (' + totalLabelMg + 'mg / ' + bacMl + 'mL = ' + (totalLabelMg/bacMl).toFixed(2) + 'mg/mL)';
      msg.style.color = '#0F6E56';
    }
    // v0.27.7: hold the success toast longer, then scroll the new vial
    // into view in the list and pulse it so the user sees what landed.
    setTimeout(() => {
      closePool();
      setTimeout(() => {
        const row = document.querySelector('.vl-row[data-vid="'+pooledId+'"]');
        if(row){
          // If the row is inside a collapsed group, expand that group first
          const body = row.closest('.vl-group-body');
          if(body && body.style.display === 'none'){
            const grp = body.dataset.grp;
            const header = grp ? document.querySelector('.vl-group-header[data-grp="'+grp.replace(/"/g,'\\"')+'"]') : null;
            if(header) header.click();
          }
          try { row.scrollIntoView({behavior:'smooth', block:'center'}); } catch(_){}
          row.classList.remove('pt-pepmgr-focus-pulse');
          void row.offsetWidth;
          row.classList.add('pt-pepmgr-focus-pulse');
          setTimeout(() => row.classList.remove('pt-pepmgr-focus-pulse'), 1100);
        }
      }, 200);
    }, 1500);
  }

  function init(){
    const pep = document.getElementById('vl-pool-pep');
    if(pep) pep.addEventListener('change', () => renderSourceVials(pep.value));
    const bac = document.getElementById('vl-pool-bac');
    if(bac) bac.addEventListener('input', refreshSummary);
    const closeBtn = document.getElementById('vl-pool-close');
    if(closeBtn) closeBtn.addEventListener('click', closePool);
    const cancelBtn = document.getElementById('vl-pool-cancel');
    if(cancelBtn) cancelBtn.addEventListener('click', closePool);
    const confirmBtn = document.getElementById('vl-pool-confirm');
    if(confirmBtn) confirmBtn.addEventListener('click', confirmPool);
    const modal = document.getElementById('vl-pool-modal');
    if(modal) modal.addEventListener('click', e => { if(e.target === modal) closePool(); });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && modal && modal.style.display === 'block') closePool();
    });
    // Wire the trigger button (added inline below the existing + Add button)
    const trigBtn = document.getElementById('vl-pool-btn');
    if(trigBtn) trigBtn.addEventListener('click', openPool);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


// ===== extracted post-core patch script =====
(function(){
  // v33.375-stable-vendor-post-import-review: don't rely on click handlers being attached. Do the page swap
  // directly via DOM. Run repeatedly to outlast any default-page setter that
  // might race us. We only stop retrying once we observe that the correct
  // .page is actually visible.
  function pgVisible(id){
    var el = document.getElementById('pg-'+id);
    if(!el) return false;
    var s = el.style.display;
    return s === 'block' || s === '' && getComputedStyle(el).display !== 'none';
  }
  function doSwap(pg){
    if(typeof window.__tmpActivatePage==='function'){
      window.__tmpActivatePage(pg,{save:false});
      return !!document.getElementById('pg-'+pg);
    }
    try {
      // Remove .on from every nav button and header tab
      document.querySelectorAll('#nav button, .hdr-tab-btn').forEach(function(b){ b.classList.remove('on'); });
      // Hide every page
      document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
      // Show target page
      var pageEl = document.getElementById('pg-'+pg);
      if(!pageEl) return false;
      pageEl.style.display = 'block';
      // Mark the corresponding nav/hdr button as on
      var btn = document.querySelector('#nav [data-pg="'+pg+'"], .hdr-tab-btn[data-pg="'+pg+'"]');
      if(btn) btn.classList.add('on');
      // Top-bar visibility — match the existing nav handler logic
      var tb = document.querySelector('.top-bar');
      if(tb) tb.style.display = ['calc','about','faq','contact'].indexOf(pg) >= 0 ? 'none' : '';
      return true;
    } catch(_){ return false; }
  }
  var attempts = 0;
  var MAX_ATTEMPTS = 25;       // ~5 seconds total at 200ms intervals
  function tick(){
    attempts++;
    var pg = null;
    try { pg = localStorage.getItem('tmp.lastActivePage'); } catch(_){}
    if(!pg){ return; }  // nothing to do — give up
    if(pgVisible(pg)){
      return;
    }
    doSwap(pg);
    if(pgVisible(pg)){
      return;
    }
    if(attempts < MAX_ATTEMPTS) setTimeout(tick, 200);
  }
  function start(){ tick(); }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
function showLogEdit(shotId){
  const s=S.shots.find(x=>x.id===shotId);
  if(!s) return;
  const m=g('log-edit-modal');
  // Peptide badge
  const c=pepColor(s.peptide);
  const badge=g('log-edit-pep-badge');
  badge.textContent=s.peptide;
  badge.style.background=c.bg;badge.style.color=c.text;badge.style.border='.5px solid '+c.border;
  // Populate fields — edit modal shows the shot's stored date (user can change via picker)
  const _shotDate=(typeof normalizeIsoDate==='function'?normalizeIsoDate(s.date||''):s.date)||'';
  window._leDateUserEdited=false;
  if(typeof _setDateInput==='function') _setDateInput(g('le-date'),_shotDate);
  else g('le-date').value=_shotDate;
  // time select
  const tsel=g('le-time');
  Array.from(tsel.options).forEach(o=>o.selected=(o.value===(s.time||'am')));
  g('le-dose').value=s.dose||'';
  const duSel=g('le-dose-unit');
  Array.from(duSel.options).forEach(o=>o.selected=(o.value===(s.doseUnit||'mcg')));
  g('le-vol').value=s.volume||'';
  const vuSel=g('le-vol-unit');
  Array.from(vuSel.options).forEach(o=>o.selected=(o.value===(s.volumeUnit||'mL')));
  // Site select — add temp option if value not in list
  const sSel=g('le-site');
  // Remove any previously injected temp option
  const prev=sSel.querySelector('[data-tmp]');if(prev)prev.remove();
  if(s.site){
    const existing=Array.from(sSel.options).find(o=>o.value===s.site);
    if(!existing){
      const opt=document.createElement('option');
      opt.value=s.site;opt.setAttribute('data-tmp','1');
      try{const cell=getSiteCell(s.site);opt.textContent=cell?(cell.region.short+' #'+cell.number):s.site;}catch(_){opt.textContent=s.site;}
      sSel.insertBefore(opt,sSel.firstChild);
    }
    Array.from(sSel.options).forEach(o=>o.selected=(o.value===s.site));
  }else{
    sSel.selectedIndex=0;
  }
  g('le-notes').value=s.notes||'';
  g('log-edit-msg').textContent='';
  m._shotId=shotId;
  m.style.display='flex';m.setAttribute('aria-hidden','false');
  g('le-date').focus();
}
function saveLogEdit(){
  const m=g('log-edit-modal');
  const shotId=m._shotId;
  const s=S.shots.find(x=>x.id===shotId);
  if(!s){closeLogEdit();return;}
  const msgEl=g('log-edit-msg');
  const dose=parseFloat(g('le-dose').value);
  const vol=parseFloat(g('le-vol').value);
  if(isNaN(dose)||isNaN(vol)){msgEl.textContent='Enter dose & volume.';return;}
  const newDate=normalizeIsoDate(g('le-date').value);
  if(!newDate){msgEl.textContent='Pick a date.';return;}
  // Vial rebalance if dose changed
  if(s.vialId){
    const newUnit=g('le-dose-unit').value||'mcg';
    const oldMcg=doseToMcg(s.dose,s.doseUnit||'mcg');
    const newMcg=doseToMcg(dose,newUnit);
    const delta=newMcg-oldMcg;
    if(delta!==0){
      const v=S.vials.find(x=>x.id===s.vialId);
      if(v){
        v.remainingMcg=Math.max(0,Math.min(v.totalMcg,v.remainingMcg-delta));
        if(v.remainingMcg>0&&v.status==='depleted'){v.status='active';delete v.depletedDate;}
        else if(v.remainingMcg===0&&v.status==='active'){v.status='depleted';v.depletedDate=td();}
        recomputeStockFromVials(v.peptideName);
      }
    }
  }
  s.date=newDate;
  s.time=shotBucketTime({time:g('le-time').value||'am'});
  s.dose=dose;s.doseUnit=g('le-dose-unit').value||'mcg';
  s.volume=vol;s.volumeUnit=g('le-vol-unit').value||'mL';
  s.site=g('le-site').value;
  s.notes=g('le-notes').value.trim();
  save();closeLogEdit();
  try{window._leDateUserEdited=false;}catch(_){}
  try{if(newDate&&typeof setFocusDate==='function')setFocusDate(newDate);}catch(_){}
  refreshAfterShotChange();
  try{window.tmpInventoryToast('✓ Shot updated');}catch(_){}
}
document.addEventListener('DOMContentLoaded',function initLogEditModal(){
  const m=g('log-edit-modal');
  if(!m) return;
  g('log-edit-close').addEventListener('click',closeLogEdit);
  g('log-edit-cancel').addEventListener('click',closeLogEdit);
  g('log-edit-save').addEventListener('click',saveLogEdit);
  m.addEventListener('click',e=>{if(e.target===m)closeLogEdit();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&m.style.display==='flex')closeLogEdit();});
  const leDate=g('le-date');
  if(leDate&&!leDate._focusWired){
    leDate._focusWired=true;
    function onLeDateUserEdit(){
      if(window._dateInputSilent)return;
      window._leDateUserEdited=true;
    }
    leDate.addEventListener('input',onLeDateUserEdit);
    leDate.addEventListener('change',onLeDateUserEdit);
  }
});
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function closeLogEdit(){
  const m=g('log-edit-modal');
  m.style.display='none';m.setAttribute('aria-hidden','true');m._shotId=null;
}


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function go(pg){var b=document.querySelector('#nav [data-pg="'+pg+'"], .hdr-tab-btn[data-pg="'+pg+'"]'); if(b)b.click()}
  function dayIndex(){return (new Date().getDay()+6)%7}
  function names(rootId, day){var out=[],root=$(rootId); if(!root) return out; root.querySelectorAll('.srow').forEach(function(row){var cell=row.children&&row.children[day]; if(cell&&cell.dataset&&cell.dataset.pep){var n=cell.dataset.pep;if(out.indexOf(n)<0)out.push(n)}}); return out}
  function uniq(a){return (a||[]).filter(function(v,i,r){return v&&r.indexOf(v)===i})}
  function doseFor(n){try{var inv=(window.S&&S.inv||[]).find(function(i){return !i.isSupply&&i.name===n}); if(inv&&typeof fmtDose==='function') return fmtDose(inv.dose,inv.doseUnit||'mcg')||'';}catch(_){} return ''}
  function item(n){return '<div class="gpt270-item"><strong>'+esc(n)+'</strong><span>'+esc(doseFor(n)||'due')+'</span></div>'}
  function stop(title, arr, empty){return '<article class="gpt270-stop"><h4>'+esc(title)+'</h4>'+(arr&&arr.length?arr.slice(0,3).map(item).join('')+(arr.length>3?'<div class="gpt270-item"><strong>+'+(arr.length-3)+' more</strong><span>open</span></div>':''):'<div class="gpt270-empty">'+esc(empty)+'</div>')+'</article>'}
  function signal(page, icon, colors, title, text, tag){return '<div class="gpt270-signal" data-gpt270-page="'+page+'"><div class="gpt270-ico" style="background:linear-gradient(135deg,'+colors+')">'+icon+'</div><div><b>'+esc(title)+'</b><span>'+esc(text)+'</span></div><div class="gpt270-open">'+esc(tag||'Open')+'</div></div>'}
  function render(){
    var pg=$('pg-stack'); if(!pg||pg.style.display==='none')return;
    var host=$('gpt-daily-cockpit'); if(!host) return;
    var today=dayIndex(), tomorrow=(today+1)%7, hr=new Date().getHours(), am=hr<13, lane=am?'Morning':'Night', laterLane=am?'Night':'Morning';
    var amToday=names('am-rows',today), pmToday=names('pm-rows',today), now=am?amToday:pmToday, later=am?pmToday:amToday, tom=uniq(names('am-rows',tomorrow).concat(names('pm-rows',tomorrow)));
    var counts=[], week=[]; for(var i=0;i<7;i++){var u=uniq(names('am-rows',i).concat(names('pm-rows',i))); counts[i]=u.length; u.forEach(function(n){if(week.indexOf(n)<0)week.push(n)})}
    var total=amToday.length+pmToday.length, max=Math.max.apply(Math,counts), min=Math.min.apply(Math,counts), labs=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    var primary=now[0]||later[0]||tom[0]||'';
    var invLen=0, low=0, pkLen=0, vitLen=0, titLen=0, last={}, rot='Open', rotSub='Open rotation map';
    try{var shots=(S.shots||[]).slice().sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))||String(b.time||'').localeCompare(String(a.time||''))}); last=shots[0]||{}; if(last.site){rot=last.site;rotSub='Last site: '+last.site}}catch(_){ }
    try{var inv=(S.inv||[]).filter(function(i){return !i.isSupply}); invLen=inv.length; low=inv.filter(function(i){return Number(i.need||0)>0 || Number(i.qty||0)<=1}).length}catch(_){ }
    try{pkLen=(S.packages||S.pkgs||[]).length}catch(_){ }
    try{vitLen=((S.vits||S.vitamins||[]).length+(S.rx||S.rxs||[]).length)}catch(_){ }
    try{titLen=(S.protocols||S.titrations||[]).length}catch(_){ }
    var G=window.__tmpDailyGlyphs;
    var headline=primary?primary:'No active dose due';
    var sub=primary?lane+' lane '+G.dot+' '+(doseFor(primary)||'scheduled')+' '+G.dot+' choose site, log it, then scan the watchlist.':'Your current lane is clear. Use the time rail and watchlist to stay ahead.';
    var rec=primary?'Log '+primary+' first.':(later.length?'Prep for '+laterLane+' lane.':'Quiet lane. Review tomorrow and supply.');
    var recSub=low?low+' inventory item'+(low>1?'s':'')+' need attention before this becomes a problem.':(last.site?'Rotate away from '+last.site+' for the next shot.':'No hard alert surfaced from connected tabs.');
    var bars=counts.map(function(c,i){var h=Math.max(9,Math.round((c/(max||1))*46));return '<div class="gpt270-barwrap"><div class="gpt270-bar" style="height:'+h+'px;opacity:'+(i===today?'1':'.46')+'"></div><small>'+labs[i]+'</small></div>'}).join('');
    var lastText=last.name?'<strong>'+esc(last.name)+'</strong><p>'+esc((last.date||'')+' '+(last.time||'')+(last.site?' '+G.dot+' '+last.site:''))+'</p>':'<strong>No recent shot logged</strong><p>When you log one, it will surface here with site and timing.</p>';
    host.innerHTML='<div class="gpt270-shell">'+
      '<div class="gpt270-top"><div class="gpt270-brandline"><div class="gpt270-kicker">Daily Stack</div><div class="gpt270-title">Command Central</div><div class="gpt270-sub">A cleaner, more premium daily experience: one next action, one time rail, and only the signals that matter.</div></div><div class="gpt270-status"><span class="gpt270-chip hot">Now '+G.dot+' '+esc(lane)+'</span><span class="gpt270-chip">'+esc(new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}))+'</span><span class="gpt270-chip '+(now.length?'good':'')+'">'+(now.length?'Action ready':'Clear lane')+'</span><span class="gpt270-chip '+((max-min)>2?'warn':'good')+'">'+((max-min)>2?'Uneven week':'Balanced week')+'</span></div></div>'+ 
      '<div class="gpt270-minirow"><div class="gpt270-stat"><b>'+total+'</b><span>scheduled today</span></div><div class="gpt270-stat"><b>'+now.length+'</b><span>due now</span></div><div class="gpt270-stat"><b>'+later.length+'</b><span>later today</span></div><div class="gpt270-stat"><b>'+low+'</b><span>watch items</span></div></div>'+ 
      '<div class="gpt270-layout"><main class="gpt270-main"><section class="gpt270-hero"><div class="gpt270-hero-grid"><div><div class="gpt270-label">What to do next</div><div class="gpt270-next">'+esc(headline)+'</div><div class="gpt270-next-sub">'+esc(sub)+'</div></div><div class="gpt270-orb"><b>'+now.length+'</b><span>due now</span></div></div><div class="gpt270-actionrow"><div><strong>'+esc(primary||'Lane is clear')+'</strong><small>'+esc(primary?(lane+' '+G.dot+' '+(doseFor(primary)||'scheduled')+' '+G.dot+' '+(last.site?('last site '+last.site):'pick a clean rotation site')):'No immediate action required. Review later today or tomorrow.')+'</small></div><em class="gpt270-dose">'+esc(primary?(doseFor(primary)||'due'):'clear')+'</em></div><div class="gpt270-btns"><button class="gpt270-btn primary" data-gpt270-page="log">Log next dose</button><button class="gpt270-btn" data-gpt270-page="calc">Calculator</button><button class="gpt270-btn" data-gpt270-page="calendar">Calendar</button><button class="gpt270-btn" data-gpt270-page="inventory">Supply</button></div></section>'+ 
      '<section class="gpt270-rail"><div class="gpt270-rail-head"><b>Time rail</b><span>now '+G.arrow+' week</span></div><div class="gpt270-path">'+stop('Now',now,'No active item')+stop('Later today',later,'Nothing later')+stop('Tomorrow',tom,'Tomorrow is clear')+stop('This week',week.slice(0,6),'No weekly stack')+'</div></section><section class="gpt270-bottom"><div class="gpt270-rhythm"><div class="gpt270-cardhead"><b>Seven-day rhythm</b><span>'+((max-min)>2?'uneven':'steady')+'</span></div><div class="gpt270-bars">'+bars+'</div></div><div class="gpt270-last"><div class="gpt270-cardhead"><b>Last shot</b><span>rotation</span></div>'+lastText+'</div></section></main>'+ 
      '<aside class="gpt270-side"><section class="gpt270-watch"><div class="gpt270-watch-title">Smart watchlist</div><div class="gpt270-watch-sub">Actionable signals from the rest of the tracker.</div><div class="gpt270-rec"><b>Suggested focus</b><strong>'+esc(rec)+'</strong><span>'+esc(recSub)+'</span></div><div class="gpt270-signals">'+
      signal('inventory',G.inventory,'#F59E0B,#F97316','Inventory',low?low+' low/attention item'+(low>1?'s':''):'All '+invLen+' tracked items look okay','Open')+
      signal('vitamins',G.vitamins,'#EC4899,#F97316','Vitamins + Rx',vitLen?vitLen+' support items available':'Open support stack','Open')+
      signal('protocols',G.titration,'#10B981,#14B8A6','Titration',titLen?titLen+' ramp item'+(titLen>1?'s':'')+' tracked':'Dose ramp preview','Open')+
      signal('packages',G.packages,'#0891B2,#06B6D4','Packages',pkLen?pkLen+' shipment'+(pkLen>1?'s':'')+' tracked':'No active tracking','Open')+
      signal('log',G.rotation,'#7C3AED,#A855F7','Rotation',rotSub,rot)+
      '</div></section></aside></div></div>';
  }
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-gpt270-page]'); if(b){go(b.getAttribute('data-gpt270-page'));}});
  function init(){var old=window.renderStack;if(typeof old==='function'&&!old.__gpt270Wrapped){window.renderStack=function(){var r=old.apply(this,arguments);try{window.__tmpPgDebounced('gpt270-daily',render,80);}catch(e){console.warn('gpt270 daily render',e)}return r};window.renderStack.__gpt270Wrapped=true;} if(__tmpPgVisible('pg-stack')){setTimeout(render,180);}}
  window.gptRenderDailyElite=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();


// ===== extracted post-core patch script =====
(function(){
  if(window.TMP_OPTIMIZER_ENABLED===false)return;
  function sync(el){
    if(window.tmpOptSliderLive) window.tmpOptSliderLive(el);
    else if(el&&el.id){var v=document.getElementById(el.id+'-val'); if(v) v.textContent=el.value;}
  }
  document.addEventListener('input',function(e){
    var t=e.target;
    if(t && t.matches && t.matches('#opt-g-fat,#opt-g-rec,#opt-g-sleep,#opt-g-muscle,#opt-g-app,#opt-g-simple')) sync(t);
  },true);
  document.addEventListener('change',function(e){
    var t=e.target;
    if(t && t.matches && t.matches('#opt-g-fat,#opt-g-rec,#opt-g-sleep,#opt-g-muscle,#opt-g-app,#opt-g-simple')) sync(t);
  },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){if(window.bindOptimizerSliderLiveValues) window.bindOptimizerSliderLiveValues();});
  else if(window.bindOptimizerSliderLiveValues) window.bindOptimizerSliderLiveValues();
})();


// ===== extracted post-core patch script =====
(function(){
  if(window.TMP_OPTIMIZER_ENABLED===false)return;
  const PRESETS={
    fat:{label:'Fat Loss Focus',vals:{fat:92,app:88,rec:62,sleep:50,muscle:72,simple:55}},
    recovery:{label:'Recovery / Injury',vals:{fat:55,app:45,rec:95,sleep:65,muscle:72,simple:45}},
    sleep:{label:'Sleep Protection',vals:{fat:55,app:45,rec:70,sleep:94,muscle:60,simple:72}},
    simple:{label:'Simplify Stack',vals:{fat:60,app:60,rec:55,sleep:60,muscle:55,simple:95}},
    inventory:{label:'Use Inventory Efficiently',vals:{fat:65,app:60,rec:65,sleep:55,muscle:60,simple:80}},
    balanced:{label:'Balanced',vals:{fat:70,app:70,rec:75,sleep:55,muscle:65,simple:50}}
  };
  const CONSTRAINTS=[
    ['lockMajor','Lock major anchors','Do not suggest moving GLP/fat-loss anchors unless inventory is critical.'],
    ['protectSleep','Protect sleep lane','Penalize crowded PM/night lanes more heavily.'],
    ['useLow','Use low stock carefully','Surface reorder/use-until-empty decisions first.'],
    ['maxTwo','Max 2 injections/lane','Flag days or lanes that look too crowded.'],
    ['keepRecoveryPM','Keep recovery PM','Prefer recovery peptides later unless crowding is severe.'],
    ['avoidAM','Avoid morning injections','Shift optional AM items out of the morning lane.']
  ];
  function g(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function ensure(){
    const shell=document.querySelector('#pg-optimizer .gpt-opt-shell'); if(!shell) return false;
    if(!g('opt-presets')){
      const sliders=document.querySelector('.gpt-opt-card:has(#opt-g-fat)') || document.querySelector('#opt-g-fat')?.closest('.gpt-opt-card');
      if(sliders){
        sliders.insertAdjacentHTML('afterbegin','<div class="gpt-opt-presets" id="opt-presets">'+Object.keys(PRESETS).map(k=>'<button type="button" class="gpt-opt-preset" data-opt-preset="'+k+'">'+PRESETS[k].label+'</button>').join('')+'</div>');
        sliders.insertAdjacentHTML('beforeend','<div class="gpt-opt-muted-note">Presets only adjust the weighting sliders. They do not change saved schedule data until you choose an action.</div>');
      }
    }
    if(!g('opt-constraints')){
      const sliders=document.querySelector('.gpt-opt-card:has(#opt-g-fat)') || document.querySelector('#opt-g-fat')?.closest('.gpt-opt-card');
      if(sliders){
        sliders.insertAdjacentHTML('afterend','<article class="gpt-opt-card"><div class="gpt-opt-card-title"><b>Locked constraints</b><span>what cannot casually change</span></div><div class="gpt-opt-constraints" id="opt-constraints">'+CONSTRAINTS.map(c=>'<label class="gpt-opt-constraint"><input type="checkbox" id="opt-c-'+c[0]+'"><span><b>'+c[1]+'</b>'+c[2]+'</span></label>').join('')+'</div></article>');
      }
    }
    if(!g('opt-decisions')){
      const recCard=document.querySelector('.gpt-opt-card:has(#opt-recs)') || g('opt-recs')?.closest('.gpt-opt-card');
      if(recCard){
        recCard.querySelector('.gpt-opt-card-title b').textContent='Decision engine';
        recCard.querySelector('.gpt-opt-card-title span').textContent='specific actions, reasons, impact';
        recCard.insertAdjacentHTML('beforeend','<div class="gpt-opt-decision-list" id="opt-decisions"></div>');
      }
    }
    if(!g('opt-score-drivers')){
      const hero=document.querySelector('.gpt-opt-hero');
      if(hero) hero.insertAdjacentHTML('beforeend','<div style="margin-top:12px" class="gpt-opt-card-title"><b>Why the score moved</b><span>live drivers</span></div><div class="gpt-opt-score-drivers" id="opt-score-drivers"></div>');
    }
    if(!g('opt-plan-preview')){
      const grid=document.querySelector('#pg-optimizer .gpt-opt-grid');
      if(grid){
        grid.insertAdjacentHTML('afterend','<div class="gpt-opt-decision-grid"><article class="gpt-opt-card"><div class="gpt-opt-card-title"><b>7-day optimized preview</b><span>overload + low-stock awareness</span></div><div class="gpt-opt-plan" id="opt-plan-preview"></div></article><article class="gpt-opt-card"><div class="gpt-opt-card-title"><b>GPT-ready review export</b><span>copy only if you choose</span></div><div class="gpt-opt-gpt-export"><textarea id="opt-decision-export" readonly></textarea><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="gpt-opt-btn" id="opt-copy-decision">Copy review</button></div></div><div class="gpt-opt-muted-note">Local-first: the app prepares the review text. Use the Optional GPT Advisor box above to ask GPT with an evidence-formatted prompt.</div></article></div><article class="gpt-opt-card" style="margin-top:12px"><div class="gpt-opt-card-title"><b>Peptide-level scoring</b><span>transparent item-by-item view</span></div><div class="gpt-opt-table-wrap"><table class="gpt-opt-item-table" id="opt-item-table"></table></div></article>');
      }
    }
    return true;
  }
  function val(id,def){const el=g(id);return el?+el.value||0:def}
  function goals(){return {fat:val('opt-g-fat',70),rec:val('opt-g-rec',75),sleep:val('opt-g-sleep',55),muscle:val('opt-g-muscle',65),app:val('opt-g-app',70),simple:val('opt-g-simple',50)}}
  function constraint(k){return !!g('opt-c-'+k)?.checked}
  function collect(){
    const S=window.S||{}; const sk=window.sk||function(n,t,d){return n+'|'+t+'|'+d};
    const today=new Date(); const di=(today.getDay()+6)%7;
    const peps=(S.inv||[]).filter(i=>i&&!i.isSupply&&!i.archived&&i.name);
    const active=peps.filter(i=>(i.fz||i.fr||i.dk||0)||(i.dose>0)||((S.sched||{})[sk(i.name,'am',di)]||(S.sched||{})[sk(i.name,'pm',di)]));
    const doseMcg=it=>{const d=parseFloat(it.dose)||0,u=it.doseUnit||'mcg';return u==='mg'?d*1000:(u==='pill'?0:d)};
    const remMcg=it=>{let vial=0;try{vial=(S.vials||[]).filter(v=>v.peptideName===it.name&&v.status!=='depleted').reduce((a,v)=>a+(+v.remainingMcg||0),0)}catch(_){vial=0} if(vial>0)return vial; const mg=parseFloat(it.vialMg)||parseFloat(it.amt)||0;return ((+it.fz||0)+(+it.fr||0)+(+it.dk||0))*mg*1000};
    const spw=it=>{if(it.interval>0)return Math.max(.1,7/it.interval);let c=0;for(let d=0;d<7;d++){if((S.sched||{})[sk(it.name,'am',d)])c++;if((S.sched||{})[sk(it.name,'pm',d)])c++}return c||(it.days&&it.days.length)||0};
    const daysLeft=it=>{const dm=doseMcg(it),w=spw(it),r=remMcg(it);return (!dm||!w||!r)?null:Math.floor((r/dm)/w*7)};
    const lane=t=>active.filter(i=>{let c=0;for(let d=0;d<7;d++) if((S.sched||{})[sk(i.name,t,d)])c++;return c>0});
    const am=lane('am'),pm=lane('pm');
    const todayDue=active.filter(i=>(S.sched||{})[sk(i.name,'am',di)]||(S.sched||{})[sk(i.name,'pm',di)]||(i.interval>0));
    const low=active.map(it=>({it,days:daysLeft(it),rem:remMcg(it),spw:spw(it)})).filter(x=>x.days!==null).sort((a,b)=>a.days-b.days);
    const byDay=[]; for(let d=0;d<7;d++){let a=0,p=0,names=[]; active.forEach(it=>{if((S.sched||{})[sk(it.name,'am',d)]){a++;names.push(it.name)} if((S.sched||{})[sk(it.name,'pm',d)]){p++;names.push(it.name)}}); byDay.push({d,a,p,total:a+p,names:names.slice(0,3)})}
    return {S,sk,active,am,pm,todayDue,low,byDay,di,doseMcg,remMcg,spw,daysLeft};
  }
  function fitForGoal(name,go){ name=String(name||'').toLowerCase(); let score=40; if(/reta|retatrutide|sema|tirz/.test(name)) score += (go.fat+go.app)/5; if(/tesa|aod/.test(name)) score += go.fat/8 + go.muscle/12; if(/bpc|tb.?500|wolv|wolverine|ghk/.test(name)) score += go.rec/4; if(/ipa|ipamorelin|cjc|dsip/.test(name)) score += go.sleep/5 + go.muscle/12; if(/test|cyp|trt/.test(name)) score += go.muscle/5; return Math.max(5,Math.min(100,Math.round(score))); }
  function itemScores(C,go){return C.active.map(it=>{const dl=C.daysLeft(it); const laneCount=(C.am.includes(it)?1:0)+(C.pm.includes(it)?1:0); const fit=fitForGoal(it.name,go); const inv=dl==null?60:(dl<=7?20:dl<=14?45:dl<=30?70:90); const timing= laneCount?75:55; const burden=Math.max(20,100-(C.spw(it)||0)*8); const total=Math.round(fit*.38+inv*.28+timing*.18+burden*.16); return {it,dl,fit,inv,timing,burden,total};}).sort((a,b)=>a.total-b.total)}
  function enhancedRender(){
    if(!ensure()) return;
    try{ if(window.__tmpOptOriginalRender && !window.__tmpOptInside){ window.__tmpOptInside=true; window.__tmpOptOriginalRender(); window.__tmpOptInside=false; } }catch(_){window.__tmpOptInside=false;}
    const C=collect(), go=goals(), items=itemScores(C,go), low=C.low, crowd=Math.max(C.am.length,C.pm.length), burden=C.todayDue.length;
    let lowPenalty=low.filter(x=>x.days<=7).length*12+low.filter(x=>x.days>7&&x.days<=14).length*5;
    let crowdPenalty=Math.max(0,crowd-(constraint('maxTwo')?2:5))*(constraint('maxTwo')?7:4)+Math.max(0,burden-6)*4;
    if(constraint('protectSleep')) crowdPenalty += Math.max(0,C.pm.length-3)*4;
    if(constraint('useLow')) lowPenalty += low.filter(x=>x.days<=14).length*3;
    const fitAvg=items.length?Math.round(items.reduce((a,x)=>a+x.fit,0)/items.length):45;
    const inventoryAvg=items.length?Math.round(items.reduce((a,x)=>a+x.inv,0)/items.length):55;
    const simplicityPenalty=Math.round((go.simple/100)*Math.max(0,C.active.length-5)*2.2)+Math.round((go.simple/100)*Math.max(0,burden-4)*2.2);
    const score=Math.max(20,Math.min(98,Math.round(72 + fitAvg*.22 + inventoryAvg*.12 - lowPenalty - crowdPenalty - simplicityPenalty + (C.active.length?0:-10))));
    const se=g('opt-score'); if(se) se.textContent=score; const ring=g('opt-score-ring'); if(ring) ring.style.setProperty('--score-deg',Math.round(score*3.6)+'deg'); const pill=g('opt-score-pill'); if(pill) pill.textContent='Score '+score;
    const headline=g('opt-headline'); if(headline) headline.textContent= C.active.length===0?'What’s next: add active stack context':(low[0]&&low[0].days<=14?'What’s next: solve '+low[0].it.name+' inventory risk':(crowd>4?'What’s next: reduce lane crowding':'What’s next: protect the highest-value rhythm'));
    const summary=g('opt-summary'); if(summary) summary.textContent= C.active.length===0?'Stack confidence is limited because no active items are detected. Add active compounds, schedule, inventory, and recent labs before relying on optimization.':('Decision engine scanned '+C.active.length+' active items, '+burden+' due today, '+low.filter(x=>x.days<=14).length+' low-stock risks, and '+crowd+' items in the heaviest lane.');
    const decisions=[];
    if(low[0]&&low[0].days<=7) decisions.push({u:1,act:'Reorder or protect '+low[0].it.name,why:'It is projected around '+low[0].days+' days left. Do not build an optimized plan around a vial that may run out first.',impact:'+8 inventory reliability',page:'inventory'});
    else if(low[0]&&low[0].days<=14) decisions.push({act:'Put '+low[0].it.name+' on the watchlist',why:'It is inside the 14-day risk window. Confirm vial counts before increasing reliance on it.',impact:'+4 planning reliability',page:'inventory'});
    if(go.sleep>=65 && C.pm.length>3) decisions.push({act:'Clean up the PM/night lane',why:'Sleep priority is high and the PM lane has '+C.pm.length+' items. Move non-sleep-critical items earlier.',impact:'+6 timing clarity',page:'stack'});
    if(go.simple>=70 && C.active.length>5) decisions.push({act:'Simplify optional support items',why:'Simplicity is heavily weighted. The optimizer should favor fewer active lanes over maximizing every possible support item.',impact:'+5 usability',page:'stack'});
    const weak=items[0]; if(weak) decisions.push({act:'Review '+weak.it.name+' fit',why:'It has the weakest item score: goal fit '+weak.fit+', inventory '+weak.inv+', burden '+weak.burden+'. Decide whether to lock, pause, or use until empty.',impact:'+3 transparency',page:'inventory'});
    if(!decisions.length){
      if(C.active.length===0) decisions.push({act:'Add active stack data before relying on optimization',why:'Stack confidence is limited because no active items are detected. Add active compounds, schedule, inventory, and recent labs before relying on optimization. Provisional next step: preserve a simple AM / PM / bedtime rhythm and prevent open-vial run-outs.',impact:'Confidence limited',page:'stack'});
      else decisions.push({act:'Keep the core rhythm and monitor inventory',why:'No major bottleneck is dominating the score. Your next useful move is preserving consistency and preventing surprise run-outs.',impact:'+2 stability',page:'stack'});
    }
    const decEl=g('opt-decisions'); if(decEl) decEl.innerHTML=decisions.slice(0,5).map((d,i)=>'<div class="gpt-opt-decision '+(d.u?'urgent':'')+'" data-rank="'+(i+1)+'"><div class="act">'+esc(d.act)+'</div><div class="why">'+esc(d.why)+'</div><div class="meta"><span>'+esc(d.impact)+'</span><span>'+esc(d.page==='inventory'?'Inventory':'Daily Stack')+'</span></div><div class="apply"><button type="button" class="gpt-opt-mini-btn" data-opt-page="'+d.page+'">Open '+(d.page==='inventory'?'Inventory':'Daily Stack')+'</button><button type="button" class="gpt-opt-mini-btn secondary" data-opt-ignore="1">Ignore for now</button></div></div>').join('');
    const old=g('opt-recs'); if(old) old.style.display='none';
    const drivers=[['Goal fit',fitAvg,'pos'],['Inventory',inventoryAvg,'pos'],['Low stock',Math.min(100,lowPenalty*4),'neg'],['Crowding',Math.min(100,crowdPenalty*5),'neg'],['Simplicity',Math.min(100,simplicityPenalty*5),'neg']];
    const dr=g('opt-score-drivers'); if(dr) dr.innerHTML=drivers.map(x=>'<div class="gpt-opt-driver '+(x[2]==='neg'?'neg':'')+'"><b>'+x[0]+'</b><div class="track"><i style="width:'+Math.max(4,Math.min(100,x[1]))+'%"></i></div><em>'+Math.round(x[1])+'</em></div>').join('');
    const dows=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; const pp=g('opt-plan-preview'); if(pp) pp.innerHTML=C.byDay.map((d,i)=>'<div class="gpt-opt-day '+(i===C.di?'today ':'')+(d.total>4?'hot':'')+'"><div class="dow">'+dows[i]+'</div><div class="count">'+d.total+'</div><div class="detail">AM '+d.a+' · PM '+d.p+(d.names.length?'<br>'+esc(d.names.join(', ')):'<br>No scheduled items')+'</div></div>').join('');
    const tbl=g('opt-item-table'); if(tbl) tbl.innerHTML='<thead><tr><th>Item</th><th>Total</th><th>Goal fit</th><th>Inventory</th><th>Timing</th><th>Burden</th><th>Recommendation</th></tr></thead><tbody>'+items.slice(0,24).map(x=>{let rec=x.dl!=null&&x.dl<=14?'Protect / reorder':(x.total<55?'Review or lock':'Keep rhythm'); let cls=x.dl!=null&&x.dl<=14?'warn':(x.total>=75?'good':'neutral'); return '<tr><td class="name">'+esc(x.it.name)+'</td><td><span class="gpt-opt-chip '+cls+'">'+x.total+'</span></td><td>'+x.fit+'</td><td>'+(x.dl==null?'—':x.dl+'d')+'</td><td>'+x.timing+'</td><td>'+x.burden+'</td><td><span class="gpt-opt-chip '+cls+'">'+esc(rec)+'</span></td></tr>'}).join('')+'</tbody>';
    const exp='Stack Optimizer Decision Engine export\nScore: '+score+'/100\nTop decision: '+(decisions[0]?.act||'none')+'\nReason: '+(decisions[0]?.why||'')+'\nActive items: '+C.active.length+'\nDue today: '+burden+'\nAM lane: '+C.am.length+'\nPM lane: '+C.pm.length+'\nLow inventory: '+(low.slice(0,6).map(x=>x.it.name+' ~'+x.days+'d').join(', ')||'none detected')+'\nGoal weights: fat '+go.fat+', recovery '+go.rec+', sleep '+go.sleep+', muscle '+go.muscle+', appetite '+go.app+', simplicity '+go.simple+'\nConstraints: '+CONSTRAINTS.filter(c=>constraint(c[0])).map(c=>c[1]).join(', ')+"\nPlease critique timing, redundancy, low-inventory risk, and practical simplification. Separate evidence from assumptions.";
    const e=g('opt-decision-export'); if(e)e.value=exp; const tx=g('opt-gpt-summary'); if(tx)tx.value=exp;
    bindButtons();
  }
  function bindButtons(){
    document.querySelectorAll('[data-opt-preset]').forEach(b=>{if(b.__optPreset)return;b.__optPreset=1;b.addEventListener('click',()=>{const p=PRESETS[b.dataset.optPreset];if(!p)return;Object.entries(p.vals).forEach(([k,v])=>{const el=g('opt-g-'+k);if(el){el.value=v;if(window.tmpOptSliderLive)window.tmpOptSliderLive(el)}});document.querySelectorAll('[data-opt-preset]').forEach(x=>x.classList.remove('on'));b.classList.add('on');enhancedRender();});});
    document.querySelectorAll('#opt-constraints input').forEach(c=>{if(c.__optC)return;c.__optC=1;c.addEventListener('change',enhancedRender);});
    document.querySelectorAll('[data-opt-page]').forEach(btn=>{if(btn.__optGo2)return;btn.__optGo2=1;btn.addEventListener('click',()=>{const pg=btn.dataset.optPage; const nav=document.querySelector('#nav [data-pg="'+pg+'"], .hdr-tab-btn[data-pg="'+pg+'"]'); if(nav)nav.click();});});
    const cp=g('opt-copy-decision'); if(cp&&!cp.__optCopy){cp.__optCopy=1;cp.addEventListener('click',()=>{const t=g('opt-decision-export'); if(t){t.select(); try{document.execCommand('copy')}catch(_){} if(navigator.clipboard)navigator.clipboard.writeText(t.value).catch(()=>{}); cp.textContent='Copied'; setTimeout(()=>cp.textContent='Copy review',1200)}})}
  }
  function boot(){ if(!window.__tmpOptOriginalRender && window.renderOptimizer) window.__tmpOptOriginalRender=window.renderOptimizer; window.renderOptimizer=enhancedRender; setTimeout(enhancedRender,80); bindButtons(); }
  document.addEventListener('input',e=>{if(e.target&&e.target.matches&&e.target.matches('#opt-g-fat,#opt-g-rec,#opt-g-sleep,#opt-g-muscle,#opt-g-app,#opt-g-simple'))setTimeout(enhancedRender,0)},true);
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="optimizer"]'))setTimeout(enhancedRender,120)},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();


// ===== extracted post-core patch script =====
(function(){
  if(window.TMP_OPTIMIZER_ENABLED===false)return;
  function $(id){return document.getElementById(id)}
  function val(id, fallback){var el=$(id); return el && el.value != null ? el.value : fallback}
  function text(sel){var el=document.querySelector(sel); return el ? (el.innerText||el.textContent||'').trim() : ''}
  function toast(title,body){var old=document.querySelector('.gpt-opt-toast'); if(old)old.remove(); var d=document.createElement('div'); d.className='gpt-opt-toast'; d.innerHTML='<b>'+title+'</b><span>'+body+'</span>'; document.body.appendChild(d); setTimeout(function(){ if(d&&d.parentNode)d.remove(); },4600)}
  async function copyText(txt){try{if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(txt);return true}}catch(e){} try{var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.focus(); ta.select(); var ok=document.execCommand('copy'); ta.remove(); return !!ok}catch(e){return false}}
  function collectData(){
    var recs=Array.from(document.querySelectorAll('#opt-recs .gpt-opt-rec')).map(function(x){return (x.innerText||'').trim()}).filter(Boolean).slice(0,8);
    var watch=Array.from(document.querySelectorAll('#opt-watch .gpt-opt-signal')).map(function(x){return (x.innerText||'').replace(/\s+/g,' ').trim()}).filter(Boolean).slice(0,8);
    var decisions=Array.from(document.querySelectorAll('#opt-decisions .gpt-opt-decision')).map(function(x){return (x.innerText||'').replace(/\s+/g,' ').trim()}).filter(Boolean).slice(0,6);
    return {
      score:text('#opt-score')||'unknown', headline:text('#opt-headline')||'n/a', summary:text('#opt-summary')||'n/a',
      goals:'fat loss '+val('opt-g-fat','70')+', recovery/injury '+val('opt-g-rec','75')+', sleep '+val('opt-g-sleep','55')+', muscle retention '+val('opt-g-muscle','65')+', appetite control '+val('opt-g-app','70')+', simplicity '+val('opt-g-simple','50'),
      recs:recs, watch:watch, decisions:decisions,
      exportText:($('opt-decision-export')&&$('opt-decision-export').value)||''
    };
  }
  function baseDataBlock(d){
    return 'PEPTIDEGENIUS STACK OPTIMIZER DATA\n' +
      'Stack score: '+d.score+' / 100\n' +
      'Optimizer headline: '+d.headline+'\n' +
      'Summary: '+d.summary+'\n' +
      'Goal weights: '+d.goals+'\n\n' +
      'Smart watchlist / low inventory signals:\n- '+(d.watch.length?d.watch.join('\n- '):'none shown')+'\n\n' +
      'Recommended moves currently shown:\n- '+(d.recs.length?d.recs.join('\n- '):'none shown')+'\n\n' +
      (d.decisions.length?('Decision engine items:\n- '+d.decisions.join('\n- ')+'\n\n'):'') +
      (d.exportText?('Raw optimizer export:\n'+d.exportText+'\n'):'');
  }
  function buildPrompt(){
    var mode=val('opt-gpt-prompt-mode','evidence');
    var d=collectData();
    var data=baseDataBlock(d);
    if(mode==='optimizer') return 'You are a rigorous stack-optimization reviewer. Review the PeptideGenius optimizer output below. Prioritize: low inventory/run-out risk, timing conflicts, lane crowding, adherence burden, and practical simplification. Give specific next moves with rationale. Do not prescribe dosing. Separate facts from assumptions.\n\n'+data;
    if(mode==='simplify') return 'You are reviewing this plan only for simplification and user experience. Find ways to reduce schedule burden, repeated lanes, redundant actions, and avoidable night/morning crowding. Give an ordered list of changes, each with expected impact and what should NOT be changed. Do not prescribe dosing.\n\n'+data;
    if(mode==='safety') return 'You are a cautious evidence-focused reviewer. Identify practical red flags in the schedule/inventory output below. Separate: (1) demonstrable facts from the provided data, (2) plausible assumptions, (3) insufficient evidence. Do not give medical instructions or dosing changes. Suggest clinician questions where appropriate.\n\n'+data;
    return 'Use medical research scholar mode. Review the PeptideGenius Stack Optimizer output below. Only make claims that are supported by demonstrable evidence, or clearly label them as assumptions/hypotheses. Do not invent citations. If you cannot verify a claim from the provided data or established evidence, say “insufficient evidence.” Separate your answer into: Evidence-supported observations, Assumptions/uncertainties, Practical schedule/inventory suggestions, Questions to ask a clinician. Do not prescribe dosing or claim medical certainty.\n\n'+data;
  }
  function refreshPrompt(){var ta=$('opt-gpt-summary'); if(ta) ta.value=buildPrompt();}
  window.tmpOptRefreshAdvisorPrompt=refreshPrompt;
  var oldRender=window.renderOptimizer;
  if(typeof oldRender==='function' && !oldRender.__advisorWrapped){
    var wrapped=function(){var r=oldRender.apply(this,arguments); try{refreshPrompt()}catch(e){} return r}; wrapped.__advisorWrapped=1; window.renderOptimizer=wrapped;
  }
  async function askGPT(){
    try{if(window.renderOptimizer)window.renderOptimizer(); else refreshPrompt()}catch(e){refreshPrompt()}
    var prompt=buildPrompt();
    await copyText(prompt);
    var endpoint=localStorage.getItem('tmp.gptAdvisorEndpoint')||'';
    if(endpoint){
      try{var res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt,source:'PeptideGenius Stack Optimizer'})}); if(res.ok){toast('Sent to GPT endpoint','The optimizer prompt was sent to your configured private endpoint.'); return;}}catch(e){}
    }
    var url='https://chatgpt.com/?q='+encodeURIComponent(prompt);
    var win=null; try{win=window.open(url,'_blank')}catch(e){win=null}
    if(win){toast('GPT prompt copied','ChatGPT opened. If the message is not prefilled automatically, paste the copied evidence-only prompt.');}
    else{showPromptModal(prompt); toast('Prompt copied','Pop-up was blocked. Paste the copied evidence-only prompt into ChatGPT.');}
  }
  function showPromptModal(prompt){
    var old=document.querySelector('.gpt-opt-prompt-modal'); if(old)old.remove();
    var m=document.createElement('div'); m.className='gpt-opt-prompt-modal';
    m.innerHTML='<div class="gpt-opt-prompt-card"><h3>Evidence-only GPT prompt copied</h3><p>Your browser did not open ChatGPT automatically. The full prompt is below.</p><textarea readonly></textarea><div class="row"><button type="button" class="gpt-opt-btn" data-close="1">Close</button><button type="button" class="gpt-opt-btn primary" data-open="1">Open ChatGPT</button></div></div>';
    m.querySelector('textarea').value=prompt; document.body.appendChild(m);
    m.addEventListener('click',function(e){if(e.target.dataset.close){m.remove()} if(e.target.dataset.open){window.open('https://chatgpt.com/','_blank');}});
  }
  document.addEventListener('input',function(e){if(e.target && (e.target.matches('[data-opt-goal-slider]')||e.target.id==='opt-gpt-prompt-mode'))setTimeout(refreshPrompt,0)},true);
  document.addEventListener('change',function(e){if(e.target && e.target.id==='opt-gpt-prompt-mode')refreshPrompt()},true);
  document.addEventListener('click',function(e){var ask=e.target&&e.target.closest&&e.target.closest('#pg-optimizer [data-opt-ask-gpt]'); if(ask){e.preventDefault(); askGPT(); return;} var copy=e.target&&e.target.closest&&e.target.closest('#opt-copy-gpt'); if(copy){e.preventDefault(); refreshPrompt(); copyText(($('opt-gpt-summary')||{}).value||buildPrompt()).then(function(){copy.textContent='Copied'; setTimeout(function(){copy.textContent='Copy prompt'},1200)});}},true);
  setTimeout(refreshPrompt,250);
})();


// ===== extracted post-core patch script =====
(function(){
  if(window.TMP_OPTIMIZER_ENABLED===false)return;
  function $(id){return document.getElementById(id)}
  function q(sel,root){return (root||document).querySelector(sel)}
  function qa(sel,root){return Array.from((root||document).querySelectorAll(sel))}
  function getNum(id,def){var el=$(id);var n=el?parseFloat(el.value):NaN;return isFinite(n)?n:def}
  function setText(id,t){var el=$(id);if(el)el.textContent=t}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}
  function toast(title,body){var old=q('.gpt-opt-toast');if(old)old.remove();var d=document.createElement('div');d.className='gpt-opt-toast';d.innerHTML='<b>'+esc(title)+'</b><span>'+esc(body)+'</span>';document.body.appendChild(d);setTimeout(function(){if(d&&d.parentNode)d.remove()},5200)}
  async function copyText(txt){
    try{ if(navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(txt); return true; } }catch(e){}
    try{var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';ta.style.top='0';document.body.appendChild(ta);ta.focus();ta.select();var ok=document.execCommand('copy');ta.remove();return !!ok;}catch(e){return false;}
  }
  function currentGoals(){return {fat:getNum('opt-g-fat',70),rec:getNum('opt-g-rec',75),sleep:getNum('opt-g-sleep',55),muscle:getNum('opt-g-muscle',65),app:getNum('opt-g-app',70),simple:getNum('opt-g-simple',50)}}
  function activeCountGuess(){
    var rows=qa('#opt-item-table tbody tr,#opt-item-table tr').filter(function(r){return (r.innerText||'').trim().length>8});
    if(rows.length>1)return Math.max(1,rows.length-1);
    var signals=qa('#opt-watch .gpt-opt-signal').length;
    return Math.max(4, signals+3);
  }
  function riskGuess(){
    var txt=(q('#opt-watch')&&q('#opt-watch').innerText||'')+' '+(q('#opt-recs')&&q('#opt-recs').innerText||'');
    var low=(txt.match(/\b(0|1|2|3|4|5|6|7)d\b|run.?out|low|urgent|risk/ig)||[]).length;
    var warn=(txt.match(/14 days|two-week|watch|crowd|heavy|overload/ig)||[]).length;
    return {low:Math.min(4,low),warn:Math.min(5,warn)};
  }
  function computeLiveScore(){
    var g=currentGoals(), risk=riskGuess(), count=activeCountGuess();
    var score=76;
    // Goal match heuristics: make movement visible and meaningful even when the deeper optimizer render has not rerun.
    score += (g.fat-50)*0.035 + (g.app-50)*0.035 + (g.rec-50)*0.03 + (g.muscle-50)*0.025;
    score -= Math.max(0,g.sleep-50)*0.045;      // sleep priority punishes crowded/unclear night lanes
    score -= Math.max(0,g.simple-45)*Math.max(0,count-4)*0.18; // simplicity penalizes burden
    score -= risk.low*6.5 + risk.warn*2.2;
    // Inventory-efficiency and recovery priorities get extra penalty if low-stock text is present.
    score -= risk.low*((g.rec+g.fat+g.app)/300)*2.5;
    return Math.max(20,Math.min(98,Math.round(score)));
  }
  function updateSliderLabels(){
    [['opt-g-fat','opt-g-fat-val'],['opt-g-rec','opt-g-rec-val'],['opt-g-sleep','opt-g-sleep-val'],['opt-g-muscle','opt-g-muscle-val'],['opt-g-app','opt-g-app-val'],['opt-g-simple','opt-g-simple-val']].forEach(function(p){var el=$(p[0]),out=$(p[1]);if(el&&out)out.textContent=el.value});
  }
  function updateLiveScore(){
    updateSliderLabels();
    var score=computeLiveScore();
    setText('opt-score',score);
    setText('opt-score-pill','Score '+score);
    var pill=$('opt-score-pill'); if(pill){pill.setAttribute('data-live','1');clearTimeout(window.__tmp278Pill);window.__tmp278Pill=setTimeout(function(){pill.removeAttribute('data-live')},220)}
    var ring=$('opt-score-ring'); if(ring){ring.style.setProperty('--score-deg',Math.round(score*3.6)+'deg');ring.setAttribute('data-live','1');clearTimeout(window.__tmp278Ring);window.__tmp278Ring=setTimeout(function(){ring.removeAttribute('data-live')},220)}
    refreshAdvisorPrompt();
  }
  function collectBlocks(){
    var recs=qa('#opt-recs .gpt-opt-rec').map(function(x){return (x.innerText||'').replace(/\s+/g,' ').trim()}).filter(Boolean).slice(0,8);
    var watch=qa('#opt-watch .gpt-opt-signal').map(function(x){return (x.innerText||'').replace(/\s+/g,' ').trim()}).filter(Boolean).slice(0,8);
    var decisions=qa('#opt-decisions .gpt-opt-decision').map(function(x){return (x.innerText||'').replace(/\s+/g,' ').trim()}).filter(Boolean).slice(0,6);
    var itemRows=qa('#opt-item-table tr').map(function(x){return (x.innerText||'').replace(/\s+/g,' ').trim()}).filter(Boolean).slice(0,12);
    return {recs:recs,watch:watch,decisions:decisions,itemRows:itemRows};
  }
  function modeIntro(mode){
    if(mode==='optimizer') return 'You are a rigorous stack optimization reviewer. Prioritize timing, lane crowding, inventory/run-out risk, adherence burden, and practical simplification. Do not prescribe dosing. Separate facts from assumptions.';
    if(mode==='simplify') return 'You are a schedule simplification expert. Reduce burden, redundant lanes, and unnecessary friction. Preserve locked constraints. Do not prescribe dosing.';
    if(mode==='safety') return 'You are a cautious evidence-focused reviewer. Identify red flags and uncertainty. Separate demonstrable facts, assumptions, and insufficient evidence. Do not give medical instructions or dosing changes.';
    return 'Use medical research scholar mode. Only answer with demonstrable evidence, or clearly label statements as assumptions/hypotheses. Do not invent citations or overstate certainty. If evidence is insufficient, say “insufficient evidence.” Do not prescribe dosing or claim medical certainty.';
  }
  function buildPrompt(){
    var g=currentGoals(), b=collectBlocks(), mode=($('opt-gpt-prompt-mode')||{}).value||'evidence';
    var score=($('opt-score')||{}).textContent||computeLiveScore();
    var headline=(q('#opt-headline')&&q('#opt-headline').innerText||'Stack Optimizer review').trim();
    var summary=(q('#opt-summary')&&q('#opt-summary').innerText||'').trim();
    return modeIntro(mode)+'\n\n' +
      'Review this PeptideGenius Stack Optimizer output. Give a practical, evidence-constrained critique. Return sections: (1) Evidence-supported observations, (2) Assumptions/uncertainties, (3) Suggested next moves, (4) Inventory/run-out priorities, (5) Questions to ask a clinician.\n\n' +
      'CURRENT OPTIMIZER STATE\n' +
      'Stack score: '+score+' / 100\n' +
      'Headline: '+headline+'\n' +
      'Summary: '+summary+'\n' +
      'Goal weights: fat loss '+g.fat+', recovery/injury '+g.rec+', sleep quality '+g.sleep+', muscle retention '+g.muscle+', appetite control '+g.app+', simplicity '+g.simple+'.\n\n' +
      'SMART WATCHLIST / LOW INVENTORY SIGNALS\n- '+(b.watch.length?b.watch.join('\n- '):'No watchlist signals shown')+'\n\n' +
      'RECOMMENDED NEXT MOVES SHOWN IN APP\n- '+(b.recs.length?b.recs.join('\n- '):'No recommendations shown')+'\n\n' +
      (b.decisions.length?('DECISION ENGINE ITEMS\n- '+b.decisions.join('\n- ')+'\n\n'):'') +
      (b.itemRows.length?('PEPTIDE-LEVEL SCORING TABLE SNAPSHOT\n- '+b.itemRows.join('\n- ')+'\n\n'):'') +
      'Important: The data above is user-entered local tracker data. Do not infer diagnoses, do not provide dosing instructions, and clearly say when evidence is insufficient.';
  }
  function refreshAdvisorPrompt(){var ta=$('opt-gpt-summary'); if(ta) ta.value=buildPrompt();}
  function showPromptModal(prompt){
    var old=q('.gpt-opt-prompt-modal'); if(old)old.remove();
    var m=document.createElement('div'); m.className='gpt-opt-prompt-modal';
    m.innerHTML='<div class="gpt-opt-prompt-card"><h3>GPT prompt ready</h3><p>Browser security can block automatic prefilled sending. The prompt is copied; paste it into ChatGPT if it does not appear automatically.</p><textarea readonly></textarea><div class="row"><button type="button" class="gpt-opt-btn" data-close="1">Close</button><button type="button" class="gpt-opt-btn primary" data-open="1">Open ChatGPT</button></div></div>';
    q('textarea',m).value=prompt; document.body.appendChild(m);
    m.addEventListener('click',function(e){if(e.target.dataset.close)m.remove(); if(e.target.dataset.open)window.open('https://chatgpt.com/','_blank')});
  }
  async function askGPT(){
    updateLiveScore();
    var prompt=buildPrompt();
    await copyText(prompt);
    var endpoint=localStorage.getItem('tmp.gptAdvisorEndpoint')||'';
    if(endpoint){
      try{var res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'PeptideGenius Stack Optimizer',prompt:prompt})}); if(res.ok){toast('Sent to GPT advisor','The optimizer prompt was sent to your configured private endpoint.'); return;}}catch(e){}
    }
    var opened=false;
    try{opened=!!window.open('https://chatgpt.com/?q='+encodeURIComponent(prompt),'_blank','noopener');}catch(e){opened=false}
    showPromptModal(prompt);
    toast(opened?'GPT prompt copied':'Prompt copied','Ask GPT is in the Optional GPT Advisor box. If ChatGPT does not prefill the message, paste the copied evidence-first prompt.');
  }
  function moveAskButtons(){
    qa('#pg-optimizer [data-opt-ask-gpt]').forEach(function(btn){if(!btn.closest('.gpt-advisor-live')){btn.remove();}});
    var box=q('#pg-optimizer .gpt-advisor-live'); if(box && !$('opt-ask-gpt-main')){
      var actions=q('.gpt-advisor-actions',box)||document.createElement('div'); actions.className='gpt-opt-actions gpt-advisor-actions';
      actions.insertAdjacentHTML('afterbegin','<button class="gpt-opt-btn primary ask" id="opt-ask-gpt-main" type="button" data-opt-ask-gpt="1">Ask GPT</button>');
      if(!actions.parentNode) box.appendChild(actions);
    }
  }
  function enhanceSelect(){
    var sel=$('opt-gpt-prompt-mode'); if(!sel || sel.__tmp278)return; sel.__tmp278=1;
    sel.innerHTML='<option value="evidence">Medical research scholar · evidence only</option><option value="optimizer">Optimizer critique · timing + inventory</option><option value="simplify">Simplify schedule · reduce burden</option><option value="safety">Caution check · facts vs assumptions</option>';
  }
  function boot(){moveAskButtons(); enhanceSelect(); updateLiveScore(); refreshAdvisorPrompt();}
  window.tmpOptRefreshAdvisorPrompt=refreshAdvisorPrompt;
  window.tmpOptForceLiveScore=updateLiveScore;
  document.addEventListener('input',function(e){if(e.target&&e.target.matches&&e.target.matches('[data-opt-goal-slider],#opt-g-fat,#opt-g-rec,#opt-g-sleep,#opt-g-muscle,#opt-g-app,#opt-g-simple')){requestAnimationFrame(updateLiveScore);setTimeout(updateLiveScore,80);}},true);
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='opt-gpt-prompt-mode')refreshAdvisorPrompt(); if(e.target&&e.target.matches&&e.target.matches('[data-opt-goal-slider]'))setTimeout(updateLiveScore,0);},true);
  document.addEventListener('click',function(e){var ask=e.target&&e.target.closest&&e.target.closest('#pg-optimizer .gpt-advisor-live [data-opt-ask-gpt]'); if(ask){e.preventDefault(); e.stopPropagation(); askGPT(); return;} var copy=e.target&&e.target.closest&&e.target.closest('#opt-copy-gpt'); if(copy){e.preventDefault(); refreshAdvisorPrompt(); copyText(($('opt-gpt-summary')||{}).value||buildPrompt()).then(function(){copy.textContent='Copied';setTimeout(function(){copy.textContent='Copy prompt'},1200)});}},true);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-pg="optimizer"]'))setTimeout(boot,180)},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
  setTimeout(boot,350); setTimeout(boot,1000);
})();


// ===== extracted post-core patch script =====
(function(){
  if(window.TMP_OPTIMIZER_ENABLED===false)return;
  'use strict';
  var KEY='tmp.optimizer.bloodwork.v1';
  var LABS=[
    {id:'cbc',group:'Safety baseline',name:'CBC',hint:'Hgb/Hct, WBC, platelets',core:1,aliases:['cbc','complete blood count','wbc','platelets','hemoglobin','hematocrit','hgb','hct']},
    {id:'cmp',group:'Safety baseline',name:'CMP',hint:'liver/kidney/electrolytes',core:1,aliases:['cmp','comprehensive metabolic panel','metabolic panel','sodium','potassium','calcium','albumin']},
    {id:'creatinine',group:'Safety baseline',name:'Creatinine / eGFR',hint:'kidney context',core:1,aliases:['creatinine','egfr','estimated glomerular']},
    {id:'liver',group:'Safety baseline',name:'AST / ALT',hint:'liver enzymes',core:1,aliases:['ast','alt','sgot','sgpt','alkaline phosphatase','bilirubin']},
    {id:'lipids',group:'Metabolic / heart',name:'Lipid panel',hint:'LDL, HDL, TG, total cholesterol',core:1,aliases:['lipid panel','cholesterol','ldl','hdl','triglycerides','triglyceride']},
    {id:'a1c',group:'Metabolic / heart',name:'HbA1c',hint:'glucose trend',core:1,aliases:['a1c','hba1c','hemoglobin a1c','glycated']},
    {id:'glucose',group:'Metabolic / heart',name:'Fasting glucose / insulin',hint:'metabolic context',aliases:['fasting glucose','glucose','insulin','fasting insulin','homa']},
    {id:'crp',group:'Metabolic / heart',name:'hs-CRP',hint:'inflammation signal',aliases:['hs-crp','hs crp','high sensitivity c-reactive','c-reactive protein','crp']},
    {id:'tt',group:'Hormones',name:'Total testosterone',hint:'androgen context',aliases:['total testosterone','testosterone total','testosterone, total']},
    {id:'ft',group:'Hormones',name:'Free testosterone',hint:'active androgen estimate',aliases:['free testosterone','testosterone free','testosterone, free']},
    {id:'shbg',group:'Hormones',name:'SHBG',hint:'hormone availability',aliases:['shbg','sex hormone binding']},
    {id:'estradiol',group:'Hormones',name:'Estradiol sensitive',hint:'E2 context',aliases:['estradiol','e2','sensitive estradiol']},
    {id:'psa',group:'Hormones',name:'PSA',hint:'if TRT/clinician relevant',aliases:['psa','prostate specific antigen']},
    {id:'lhfsh',group:'Hormones',name:'LH / FSH',hint:'axis context if relevant',aliases:['lh','luteinizing hormone','fsh','follicle stimulating']},
    {id:'prolactin',group:'Hormones',name:'Prolactin',hint:'endocrine context',aliases:['prolactin']},
    {id:'igf1',group:'GH / thyroid',name:'IGF-1',hint:'GH-axis context',aliases:['igf-1','igf 1','insulin-like growth factor','insulin like growth factor']},
    {id:'tsh',group:'GH / thyroid',name:'TSH',hint:'thyroid regulator',aliases:['tsh','thyroid stimulating']},
    {id:'ft4',group:'GH / thyroid',name:'Free T4',hint:'thyroid hormone',aliases:['free t4','ft4','thyroxine free']},
    {id:'ft3',group:'GH / thyroid',name:'Free T3',hint:'active thyroid',aliases:['free t3','ft3','triiodothyronine free']},
    {id:'vitd',group:'Nutrients / recovery',name:'Vitamin D',hint:'deficiency context',aliases:['vitamin d','25-hydroxy','25 hydroxy','25(oh)']},
    {id:'ferritin',group:'Nutrients / recovery',name:'Ferritin / iron',hint:'iron storage',aliases:['ferritin','iron','tibc','transferrin saturation']},
    {id:'b12',group:'Nutrients / recovery',name:'B12 / folate',hint:'energy / blood context',aliases:['vitamin b12','b12','folate','folic acid']}
  ];
  function $(id){return document.getElementById(id)}
  function qa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel))}
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){return {}}}
  function saveState(st){try{localStorage.setItem(KEY,JSON.stringify(st||collect()))}catch(e){}}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function toast(t,m){try{if(window.toast) window.toast(t,m||''); else console.log(t,m||'')}catch(e){}}
  function renderChecklist(){
    var host=$('opt-lab-checklist'); if(!host) return;
    var st=load(); var checked=st.checked||{}; var vals=st.values||{};
    var groups=[]; LABS.forEach(function(l){if(groups.indexOf(l.group)<0) groups.push(l.group)});
    host.innerHTML=groups.map(function(g){
      var items=LABS.filter(function(l){return l.group===g});
      return '<div class="gpt-lab-group"><div class="gpt-lab-group-title"><span>'+esc(g)+'</span><span>'+items.length+'</span></div>'+items.map(function(l){
        return '<div class="gpt-lab-item" data-lab-row="'+esc(l.id)+'"><input type="checkbox" data-lab-check="'+esc(l.id)+'" '+(checked[l.id]?'checked':'')+'><label>'+esc(l.name)+(l.core?' <span style="color:#2D9D8F">*</span>':'')+'<small>'+esc(l.hint)+'</small></label><input class="gpt-lab-value" data-lab-val="'+esc(l.id)+'" placeholder="value/date" value="'+esc(vals[l.id]||'')+'"></div>';
      }).join('')+'</div>';
    }).join('');
    updateReadiness();
  }
  function collect(){
    var checked={}, values={};
    qa('#pg-optimizer [data-lab-check]').forEach(function(cb){checked[cb.getAttribute('data-lab-check')]=!!cb.checked});
    qa('#pg-optimizer [data-lab-val]').forEach(function(inp){if(inp.value.trim()) values[inp.getAttribute('data-lab-val')]=inp.value.trim()});
    return {text:($('opt-lab-text')&&$('opt-lab-text').value)||'',checked:checked,values:values,updated:new Date().toISOString()};
  }
  function scanText(txt){
    txt=String(txt||''); var lower=txt.toLowerCase(); var st=load(); st.checked=st.checked||{};
    LABS.forEach(function(l){
      if(l.aliases.some(function(a){return lower.indexOf(a.toLowerCase())>=0})) st.checked[l.id]=true;
    });
    st.text=txt; st.updated=new Date().toISOString(); saveState(st); renderChecklist();
    var hits=LABS.filter(function(l){return st.checked[l.id]}).length;
    toast('Blood work scanned', hits+' lab markers recognized.');
  }
  function labSummary(){
    var st=load(), checked=st.checked||{}, vals=st.values||{};
    var present=LABS.filter(function(l){return checked[l.id]});
    var coreMissing=LABS.filter(function(l){return l.core&&!checked[l.id]});
    var hormoneMissing=LABS.filter(function(l){return ['tt','ft','shbg','estradiol','igf1','tsh'].indexOf(l.id)>=0&&!checked[l.id]});
    var withVals=Object.keys(vals).filter(function(k){return vals[k]});
    return {
      present:present, coreMissing:coreMissing, hormoneMissing:hormoneMissing, values:vals, withVals:withVals,
      text: 'Lab readiness: '+present.length+'/'+LABS.length+' captured. Core missing: '+(coreMissing.map(function(l){return l.name}).join(', ')||'none')+'. Hormone/GH/thyroid missing: '+(hormoneMissing.slice(0,8).map(function(l){return l.name}).join(', ')||'none')+'. Entered values: '+(withVals.map(function(k){var l=LABS.find(function(x){return x.id===k}); return (l?l.name:k)+': '+vals[k]}).join('; ')||'none')+'.'
    };
  }
  function updateReadiness(){
    var st=load(), checked=st.checked||{};
    var present=LABS.filter(function(l){return checked[l.id]});
    var coreMissing=LABS.filter(function(l){return l.core&&!checked[l.id]});
    var hormonePresent=LABS.filter(function(l){return ['tt','ft','shbg','estradiol','igf1','tsh','ft4','ft3'].indexOf(l.id)>=0&&checked[l.id]}).length;
    if($('opt-lab-score')) $('opt-lab-score').textContent=present.length+'/'+LABS.length;
    var status=$('opt-lab-status'); if(status){
      var chips=[];
      chips.push('<span class="gpt-lab-chip">'+present.length+' captured</span>');
      chips.push('<span class="gpt-lab-chip '+(coreMissing.length?'warn':'')+'">'+(coreMissing.length?coreMissing.length+' core missing':'core covered')+'</span>');
      chips.push('<span class="gpt-lab-chip">'+hormonePresent+' hormone/GH/thyroid</span>');
      if(coreMissing.length) chips.push('<span class="gpt-lab-chip danger">Missing: '+esc(coreMissing.slice(0,3).map(function(l){return l.name}).join(', '))+(coreMissing.length>3?'…':'')+'</span>');
      status.innerHTML=chips.join('');
    }
    appendOptimizerSignals();
    appendLabToPrompt();
  }
  function appendOptimizerSignals(){
    var s=labSummary();
    var watch=$('opt-watch');
    if(watch && !watch.querySelector('[data-lab-signal]')){
      var d=document.createElement('div'); d.setAttribute('data-lab-signal','1'); d.className='gpt-opt-watch-item';
      d.innerHTML='<b>Blood-work context</b><span id="opt-lab-watch-copy"></span>';
      watch.prepend(d);
    }
    var copy=$('opt-lab-watch-copy'); if(copy) copy.textContent=s.present.length+'/'+LABS.length+' captured · '+(s.coreMissing.length?s.coreMissing.length+' core missing':'core labs covered');
    var recs=$('opt-recs');
    if(recs && !recs.querySelector('[data-lab-rec]')){
      var r=document.createElement('div'); r.className='gpt-opt-rec'; r.setAttribute('data-lab-rec','1');
      recs.appendChild(r);
    }
    var rec=recs&&recs.querySelector('[data-lab-rec]'); if(rec){
      rec.innerHTML='<b>Improve optimizer confidence with labs:</b> '+(s.coreMissing.length?'add/check '+esc(s.coreMissing.slice(0,4).map(function(l){return l.name}).join(', '))+' before relying on deeper optimization.':'core lab context is present; use GPT review for evidence-only interpretation.')
    }
  }
  function appendLabToPrompt(){
    var t=$('opt-gpt-summary'); if(!t) return;
    var raw=t.value||'';
    var base=raw.replace(/\n\nBlood work context \(optional, user-provided\):[\s\S]*$/,'');
    var s=labSummary();
    t.value=base+'\n\nBlood work context (optional, user-provided):\n'+s.text+'\nDo not diagnose from these labs. Use them only to identify missing context, questions for a clinician, and evidence-supported monitoring considerations.';
    var exp=$('opt-decision-export');
    if(exp){
      var eraw=exp.value||''; var ebase=eraw.replace(/\n\nBlood work context:[\s\S]*$/,'');
      exp.value=ebase+'\n\nBlood work context:\n'+s.text;
    }
  }
  function boot(){
    if(!$('pg-optimizer')||!$('opt-lab-card')) return;
    var st=load(); if($('opt-lab-text') && st.text && !$('opt-lab-text').value) $('opt-lab-text').value=st.text;
    renderChecklist();
    var upload=$('opt-lab-upload-btn'), file=$('opt-lab-file'), scan=$('opt-lab-scan-btn'), save=$('opt-lab-save-btn'), clear=$('opt-lab-clear-btn');
    if(upload&&!upload.dataset.bound){upload.dataset.bound='1'; upload.addEventListener('click',function(){file&&file.click()})}
    if(file&&!file.dataset.bound){file.dataset.bound='1'; file.addEventListener('change',function(){var f=file.files&&file.files[0]; if(!f) return; var r=new FileReader(); r.onload=function(){var txt=String(r.result||''); if($('opt-lab-text')) $('opt-lab-text').value=txt.slice(0,50000); scanText(txt)}; r.readAsText(f);})}
    if(scan&&!scan.dataset.bound){scan.dataset.bound='1'; scan.addEventListener('click',function(){scanText(($('opt-lab-text')&&$('opt-lab-text').value)||'')})}
    if(save&&!save.dataset.bound){save.dataset.bound='1'; save.addEventListener('click',function(){saveState(collect()); updateReadiness(); toast('Lab context saved','Stored locally in this browser only.')})}
    if(clear&&!clear.dataset.bound){clear.dataset.bound='1'; clear.addEventListener('click',function(){localStorage.removeItem(KEY); if($('opt-lab-text')) $('opt-lab-text').value=''; renderChecklist(); toast('Lab context cleared','Blood-work checklist reset.')})}
    qa('#pg-optimizer [data-lab-check],#pg-optimizer [data-lab-val]').forEach(function(el){if(!el.dataset.labBound){el.dataset.labBound='1'; el.addEventListener('input',function(){saveState(collect()); updateReadiness()}); el.addEventListener('change',function(){saveState(collect()); updateReadiness()})}});
    updateReadiness();
  }
  document.addEventListener('DOMContentLoaded',boot);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-pg="optimizer"]'))setTimeout(boot,160)},true);
  __tmpPgInterval(function(){var pg=$('pg-optimizer'); if(pg&&pg.style.display!=='none') { appendOptimizerSignals(); appendLabToPrompt(); }}, 1200, 'pg-optimizer');
  window.tmpOptimizerLabSummary=labSummary;
})();


// ===== extracted post-core patch script =====
(function(){
  if(window.TMP_OPTIMIZER_ENABLED===false)return;
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function page(pg){var b=document.querySelector('#nav [data-pg="'+pg+'"], .hdr-tab-btn[data-pg="'+pg+'"]'); if(b)b.click()}
  function sk(n,t,d){return n+'__'+t+'__'+d}
  function active(){try{return (window.S&&S.inv||[]).filter(function(i){return !i.isSupply && !i.hidden && (i.name||i.nm)})}catch(_){return []}}
  function doseMcg(it){var d=+(it.dose||it.doseAmt||0),u=String(it.doseUnit||'mcg').toLowerCase(); if(!d)return 0; if(u==='mg')return d*1000; if(u==='pill')return 0; return d}
  function remainingMcg(it){try{var v=(S.vials||[]).filter(function(x){return x.peptideName===it.name && x.status!=='depleted'}).reduce(function(a,x){return a+(+x.remainingMcg||0)},0); if(v>0)return v}catch(_){} var vialMg=parseFloat(it.vialMg)||parseFloat(it.amt)||0; return ((+it.fz||0)+(+it.fr||0)+(+it.dk||0))*vialMg*1000}
  function perWeek(it){try{if(it.interval>0)return Math.max(.1,7/it.interval);var c=0;for(var d=0;d<7;d++){if((S.sched||{})[sk(it.name,'am',d)])c++; if((S.sched||{})[sk(it.name,'pm',d)])c++;}return c||(it.days&&it.days.length)||0}catch(_){return 0}}
  function daysLeft(it){var d=doseMcg(it),p=perWeek(it),r=remainingMcg(it); if(!d||!p||!r)return null; return Math.floor((r/d)/p*7)}
  function dayIndex(){return (new Date().getDay()+6)%7}
  function calc(){var items=active();var di=dayIndex();var low=items.map(function(it){return {it:it,days:daysLeft(it),rem:remainingMcg(it)}}).filter(function(x){return x.days!==null}).sort(function(a,b){return a.days-b.days});var due=items.filter(function(i){return (S.sched||{})[sk(i.name,'am',di)] || (S.sched||{})[sk(i.name,'pm',di)] || (i.interval>0)});var am=items.filter(function(i){for(var d=0;d<7;d++)if((S.sched||{})[sk(i.name,'am',d)])return true; return false});var pm=items.filter(function(i){for(var d=0;d<7;d++)if((S.sched||{})[sk(i.name,'pm',d)])return true; return false});var danger=low.filter(function(x){return x.days<=7}).length, watch=low.filter(function(x){return x.days>7&&x.days<=14}).length;var crowd=Math.max(am.length,pm.length);var score=Math.max(25,Math.min(98,Math.round(90-(danger*10)-(watch*4)-Math.max(0,crowd-5)*5-Math.max(0,due.length-6)*4)));return {items:items,low:low,due:due,am:am,pm:pm,score:score,danger:danger,watch:watch,crowd:crowd}}
  function render(){
    var side=document.querySelector('#pg-stack .gpt270-side'); if(!side)return;
    var old=$('gpt-daily-optimizer-card'); if(old)old.remove();
    var c=calc();var hot=c.low.filter(function(x){return x.days<=14});var top=hot[0];var focus=top?('Protect '+(top.it.name||'low-stock item')):(c.crowd>5?'Reduce lane crowding':'Stack is stable enough to refine');var sub=top?('Estimated '+top.days+' days left. Keep this visible before changing the plan.'):(c.crowd>5?'Heaviest lane has '+c.crowd+' items. Consider moving optional support items.':'No urgent inventory signal detected. Use optimizer for fine tuning.');
    var rows=hot.length?hot.slice(0,3).map(function(x){return '<div class="gpt280-opt-low"><strong>'+esc(x.it.name)+'</strong><small>'+esc(x.days+'d left')+'</small></div>'}).join(''):'<div class="gpt280-opt-low"><strong>Inventory stable</strong><small>no urgent run-out</small></div>';
    var html='<section class="gpt280-daily-opt-card" id="gpt-daily-optimizer-card"><div class="gpt280-opt-head"><div><div class="gpt280-opt-kicker">Stack Optimizer</div><div class="gpt280-opt-title">Optimization snapshot</div></div><div class="gpt280-opt-score" style="--gpt280-deg:'+Math.round(c.score*3.6)+'deg"><span>'+c.score+'</span></div></div><div class="gpt280-opt-focus"><b>'+esc(focus)+'</b><span>'+esc(sub)+'</span></div><div class="gpt280-opt-mini"><div class="gpt280-opt-stat"><b>'+c.due.length+'</b><span>due today</span></div><div class="gpt280-opt-stat"><b>'+hot.length+'</b><span>low stock</span></div><div class="gpt280-opt-stat"><b>'+c.crowd+'</b><span>max lane</span></div></div><div class="gpt280-opt-list">'+rows+'</div><div class="gpt280-opt-actions"><button type="button" class="gpt280-opt-btn primary" data-gpt280-page="optimizer">Open Optimizer</button><button type="button" class="gpt280-opt-btn" data-gpt280-page="inventory">Inventory</button></div></section>';
    side.insertAdjacentHTML('afterbegin',html);
  }
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-gpt280-page]'); if(b){e.preventDefault();page(b.getAttribute('data-gpt280-page'));}},true);
  function init(){var old=window.gptRenderDailyElite;if(typeof old==='function'&&!old.__gpt280Wrapped){window.gptRenderDailyElite=function(){var r=old.apply(this,arguments);window.__tmpPgDebounced('gpt280-daily',render,80);return r};window.gptRenderDailyElite.__gpt280Wrapped=true}var oldStack=window.renderStack;if(typeof oldStack==='function'&&!oldStack.__gpt280Wrapped){window.renderStack=function(){var r=oldStack.apply(this,arguments);window.__tmpPgDebounced('gpt280-daily',render,80);return r};window.renderStack.__gpt280Wrapped=true}if(__tmpPgVisible('pg-stack'))setTimeout(render,300);}
  window.gptRenderDailyOptimizerSnapshot=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();


// ===== extracted post-core patch script =====
(function(){
  if(window.TMP_OPTIMIZER_ENABLED===false)return;
  function g(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function page(pg){var b=document.querySelector('#nav [data-pg="'+pg+'"], .hdr-tab-btn[data-pg="'+pg+'"]'); if(b)b.click()}
  function sk(n,t,d){return n+'__'+t+'__'+d}
  function active(){try{return (window.S&&S.inv||[]).filter(function(i){return !i.isSupply && !i.hidden && (i.name||i.nm)})}catch(_){return []}}
  function doseMcg(it){var d=+(it.dose||it.doseAmt||0),u=String(it.doseUnit||'mcg').toLowerCase(); if(!d)return 0; if(u==='mg')return d*1000; if(u==='pill')return 0; return d}
  function remainingMcg(it){try{var v=(S.vials||[]).filter(function(x){return x.peptideName===(it.name||it.nm) && x.status!=='depleted'}).reduce(function(a,x){return a+(+x.remainingMcg||0)},0); if(v>0)return v}catch(_){} var vialMg=parseFloat(it.vialMg)||parseFloat(it.amt)||0; return ((+it.fz||0)+(+it.fr||0)+(+it.dk||0))*vialMg*1000}
  function perWeek(it){try{if(it.interval>0)return Math.max(.1,7/it.interval);var c=0,n=it.name||it.nm;for(var d=0;d<7;d++){if((S.sched||{})[sk(n,'am',d)])c++; if((S.sched||{})[sk(n,'pm',d)])c++;}return c||(it.days&&it.days.length)||0}catch(_){return 0}}
  function daysLeft(it){var d=doseMcg(it),p=perWeek(it),r=remainingMcg(it); if(!d||!p||!r)return null; return Math.floor((r/d)/p*7)}
  function dayIndex(){return (new Date().getDay()+6)%7}
  function calc(){var items=active(),di=dayIndex();var low=items.map(function(it){return {it:it,days:daysLeft(it),rem:remainingMcg(it)}}).filter(function(x){return x.days!==null}).sort(function(a,b){return a.days-b.days});var due=items.filter(function(i){var n=i.name||i.nm;return (S.sched||{})[sk(n,'am',di)] || (S.sched||{})[sk(n,'pm',di)] || (i.interval>0)});var am=items.filter(function(i){var n=i.name||i.nm;for(var d=0;d<7;d++)if((S.sched||{})[sk(n,'am',d)])return true; return false});var pm=items.filter(function(i){var n=i.name||i.nm;for(var d=0;d<7;d++)if((S.sched||{})[sk(n,'pm',d)])return true; return false});var danger=low.filter(function(x){return x.days<=7}).length, watch=low.filter(function(x){return x.days>7&&x.days<=14}).length;var crowd=Math.max(am.length,pm.length);var score=Math.max(25,Math.min(98,Math.round(90-(danger*10)-(watch*4)-Math.max(0,crowd-5)*5-Math.max(0,due.length-6)*4)));return {low:low,due:due,score:score,danger:danger,watch:watch,crowd:crowd}}
  function cardHtml(){var c=calc(),hot=c.low.filter(function(x){return x.days<=14}),top=hot[0];var focus=top?('Low inventory: '+(top.it.name||top.it.nm||'item')):(c.crowd>5?'Crowded timing lane':'Optimizer snapshot');var sub=top?('Estimated '+top.days+' days left. Review before expanding the stack.'):(c.crowd>5?'Heaviest lane has '+c.crowd+' items. Reduce optional crowding.':'No urgent run-out signal; use optimizer for fine tuning.');var rows=hot.length?hot.slice(0,3).map(function(x){return '<div class="gpt281-opt-low"><strong>'+esc(x.it.name||x.it.nm)+'</strong><small>'+esc(x.days+'d left')+'</small></div>'}).join(''):'<div class="gpt281-opt-low"><strong>Inventory stable</strong><small>no urgent run-out</small></div>';return '<section class="gpt281-daily-opt-card" id="gpt-daily-optimizer-card"><div class="gpt281-opt-head"><div><div class="gpt281-opt-kicker">Stack Optimizer</div><div class="gpt281-opt-title">Optimization watch</div></div><div class="gpt281-opt-score" style="--gpt281-deg:'+Math.round(c.score*3.6)+'deg"><span>'+c.score+'</span></div></div><div class="gpt281-opt-focus"><b>'+esc(focus)+'</b><span>'+esc(sub)+'</span></div><div class="gpt281-opt-mini"><div class="gpt281-opt-stat"><b>'+c.due.length+'</b><span>due today</span></div><div class="gpt281-opt-stat"><b>'+hot.length+'</b><span>low stock</span></div><div class="gpt281-opt-stat"><b>'+c.crowd+'</b><span>max lane</span></div></div><div class="gpt281-opt-list">'+rows+'</div><div class="gpt281-opt-actions"><button type="button" class="gpt281-opt-btn primary" data-gpt281-page="optimizer">Open Optimizer</button><button type="button" class="gpt281-opt-btn" data-gpt281-page="inventory">Inventory</button></div></section>'}
  function render(){var pg=g('pg-stack'); if(!pg||pg.style.display==='none')return; var old=g('gpt-daily-optimizer-card'); if(old)old.remove(); var rec=pg.querySelector('.gpt270-watch .gpt270-rec'); var signals=pg.querySelector('.gpt270-watch .gpt270-signals'); var side=pg.querySelector('.gpt270-side'); if(rec){rec.insertAdjacentHTML('afterend',cardHtml());return;} if(signals){signals.insertAdjacentHTML('beforebegin',cardHtml());return;} if(side){side.insertAdjacentHTML('afterbegin',cardHtml());}}
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-gpt281-page]'); if(b){e.preventDefault();page(b.getAttribute('data-gpt281-page'));}},true);
  function init(){var old=window.gptRenderDailyElite;if(typeof old==='function'&&!old.__gpt281Wrapped){window.gptRenderDailyElite=function(){var r=old.apply(this,arguments);window.__tmpPgDebounced('gpt281-daily',render,80);return r};window.gptRenderDailyElite.__gpt281Wrapped=true;}var oldStack=window.renderStack;if(typeof oldStack==='function'&&!oldStack.__gpt281Wrapped){window.renderStack=function(){var r=oldStack.apply(this,arguments);window.__tmpPgDebounced('gpt281-daily',render,80);return r};window.renderStack.__gpt281Wrapped=true;}if(__tmpPgVisible('pg-stack'))setTimeout(render,250);}
  window.gptRenderDailyOptimizerSnapshot=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();


// ===== extracted post-core patch script =====
(function(){
  if(window.TMP_OPTIMIZER_ENABLED===false)return;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]});}
  function read(){try{return JSON.parse(localStorage.getItem('tmp.stackBuilder.v1')||'{}')}catch(e){return {}}}
  function label(){var st=read();return {lanes:st.lanes||[],options:st.options||[],constraints:st.constraints||[]};}
  window.tmpStackBuilderInjectOptimizer=function(){
    try{
      var host=document.querySelector('#pg-optimizer .gpt-opt-grid main')||document.querySelector('#pg-optimizer .gpt-opt-grid'); if(!host)return;
      var old=document.getElementById('gpt-sb-opt-context'); if(old)old.remove();
      var st=label(); if(!st.lanes.length&&!st.options.length)return;
      var names={fat:'Fat loss / appetite',recovery:'Recovery / injury',sleep:'Sleep / GH pulse',muscle:'Muscle retention',metabolic:'Metabolic health',simplicity:'Simplicity / travel'};
      var div=document.createElement('div'); div.id='gpt-sb-opt-context'; div.className='gpt-sb-opt-context';
      div.innerHTML='<div class="k">Stack Builder feed</div><div class="t">Optimizer is using a builder profile</div><div class="d">Lanes and constraints selected in Stack Builder are available for recommendations and GPT advisory export.</div><div class="gpt-sb-opt-chips">'+st.lanes.map(function(x){return '<span>'+esc(names[x]||x)+'</span>'}).join('')+st.options.slice(0,4).map(function(x){return '<span>'+esc(x)+'</span>'}).join('')+'</div>';
      host.insertBefore(div,host.firstChild);
    }catch(e){}
  };
  var old=window.renderOptimizer;
  if(old&&!old.__sbWrapped){var wrap=function(){var r=old.apply(this,arguments);setTimeout(window.tmpStackBuilderInjectOptimizer,80);return r};wrap.__sbWrapped=1;window.renderOptimizer=wrap;}
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-pg="optimizer"]'))setTimeout(window.tmpStackBuilderInjectOptimizer,250);},true);
})();


// ===== extracted post-core patch script =====
(function(){
  const KEY='tmp.stackBuilder.v1';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const laneNames={fat:'Fat loss / appetite',recovery:'Recovery / injury',sleep:'Sleep / GH pulse',muscle:'Muscle retention / recomposition',metabolic:'Metabolic health',simplicity:'Simplicity / travel'};
  const virtualCatalog=[
    {id:'reta',name:'Retatrutide / GLP-lane anchor',lane:'fat',why:'appetite and weight-management lane candidate'},
    {id:'tirz',name:'Tirzepatide / GLP-GIP alternative',lane:'fat',why:'weight-management lane alternative to review'},
    {id:'tesa',name:'Tesamorelin / GH-adjacent lane',lane:'sleep',why:'night/GH-lane candidate requiring lab context'},
    {id:'cjcipa',name:'CJC + Ipamorelin / pulse lane',lane:'sleep',why:'sleep/GH pulse candidate; keep lane uncrowded'},
    {id:'dsip',name:'DSIP / sleep-support candidate',lane:'sleep',why:'sleep-lane option to research cautiously'},
    {id:'bpc-tb',name:'BPC-157 + TB-500 / injury lane',lane:'recovery',why:'recovery/injury lane candidate'},
    {id:'ghk',name:'GHK-Cu / tissue-support candidate',lane:'recovery',why:'optional recovery/skin/tissue-support lane'},
    {id:'aod',name:'AOD-9604 / optional fat-loss support',lane:'fat',why:'optional support item; deprioritize if simplicity is high'},
    {id:'protein',name:'Protein / muscle-retention support',lane:'muscle',why:'non-injection support anchor for recomposition'},
    {id:'creatine',name:'Creatine / training support',lane:'muscle',why:'common muscle/performance support candidate'},
    {id:'omega3',name:'Omega-3 / lipid-support context',lane:'metabolic',why:'metabolic-support option to discuss with labs'},
    {id:'vitd',name:'Vitamin D / deficiency context',lane:'metabolic',why:'lab-guided support item'},
    {id:'travel',name:'Low-maintenance travel stack',lane:'simplicity',why:'simplified schedule template, fewer lanes'},
    {id:'rotation',name:'Injection-site rotation plan',lane:'simplicity',why:'operational support to reduce crowding and overuse'}
  ];
  function load(){try{return Object.assign({lanes:[],options:[],constraints:['evidence','clinician'],source:'inventory',virtual:[],promptMode:'research'},JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){return {lanes:[],options:[],constraints:['evidence','clinician'],source:'inventory',virtual:[],promptMode:'research'};}}
  function save(st){try{localStorage.setItem(KEY,JSON.stringify(st)); if(window.S){window.S.stackBuilder=st; try{window.save&&window.save()}catch(_){}}}catch(_){}}
  function invSummary(){
    try{
      const inv=(window.S&&S.inv)||[];
      const peps=inv.filter(i=>i&&i.name&&!i.isSupply&&!i.archived);
      const low=peps.filter(i=>((+i.fz||0)+(+i.fr||0)+(+i.dk||0))>0&&((+i.fz||0)+(+i.fr||0)+(+i.dk||0))<=1).map(i=>i.name);
      const names=peps.slice(0,18).map(i=>i.name);
      return 'Inventory mode context\nActive inventory items: '+(names.join(', ')||'none detected')+'\nLow/open-vial watch: '+(low.join(', ')||'none detected');
    }catch(_){return 'Inventory mode context unavailable.';}
  }
  function wishlistSummary(){try{return (window.ptWishlistGet?ptWishlistGet():[]).slice(0,18).map(w=>w.name).join(', ')||'none';}catch(_){return 'none';}}
  function candidatesFor(st){const lanes=st.lanes||[]; let arr=virtualCatalog.filter(v=>!lanes.length||lanes.includes(v.lane)); if(!arr.length) arr=virtualCatalog.slice(0,8); return arr;}
  function sourceLabel(s){return s==='virtual'?'Virtual best possible stack':s==='hybrid'?'Hybrid: inventory + wishlist':'Current inventory only';}
  function buildPrompt(){
    const st=load(); const selectedVirtual=virtualCatalog.filter(v=>(st.virtual||[]).includes(v.id));
    const lanes=(st.lanes||[]).map(x=>laneNames[x]||x).join(', ')||'none selected';
    const options=(st.options||[]).join(', ')||'none selected';
    const constraints=(st.constraints||[]).join(', ')||'none selected';
    const mode=st.promptMode||'research';
    let modeLine='Use medical research scholar mode. Only make claims supported by demonstrable evidence, or clearly label assumptions/hypotheses. Do not invent citations.';
    if(mode==='practical') modeLine='Focus on practical schedule design, inventory risk, lane crowding, and adherence. Separate practical logic from medical assumptions.';
    if(mode==='caution') modeLine='Focus on caution checks, uncertainty, missing blood-work context, and questions to ask a clinician. Do not give dosing instructions.';
    if(mode==='simplify') modeLine='Focus on simplifying the stack into the fewest practical lanes while preserving the stated goals and constraints.';
    return [
      'Use the Stack Builder inputs below to build a daily and weekly stack proposal.',
      '',
      'RESPONSE REQUIREMENTS',
      modeLine,
      'Do not prescribe dosing or claim medical certainty. If evidence is insufficient, say insufficient evidence.',
      'Separate the answer into: Evidence-supported observations, Assumptions/uncertainties, Daily stack proposal, Weekly stack rhythm, Inventory / wishlist plan, Questions to ask a clinician.',
      'Use concise tables where useful. Include AM / Midday / PM / Night lanes, plus a 7-day weekly rhythm.',
      'Show what can be built from current inventory versus what belongs on a virtual ideal stack / wishlist.',
      '',
      'BUILDER MODE: '+sourceLabel(st.source||'inventory'),
      'BUILD LANES: '+lanes,
      'CANDIDATE OPTIONS: '+options,
      'VIRTUAL BEST-STACK CANDIDATES: '+(selectedVirtual.map(v=>v.name).join(', ')||'none selected'),
      'CONSTRAINTS: '+constraints,
      '',
      invSummary(),
      'Current wishlist: '+wishlistSummary(),
      '',
      'TASK',
      '1. Build the best daily stack layout from the selected builder inputs.',
      '2. Build a weekly rhythm that minimizes lane crowding and protects low inventory.',
      '3. Identify any missing labs or monitoring context that would change confidence.',
      '4. Recommend what to add to wishlist/purchase list versus what to use from inventory.',
      '5. Return a GPT advisory summary that can feed back into the Stack Optimizer.'
    ].join('\n');
  }
  async function copyText(t){try{await navigator.clipboard.writeText(t); return true;}catch(_){return false;}}
  function askGPT(){const prompt=buildPrompt(); const G=window.__tmpSbGlyphs; copyText(prompt).then(ok=>{try{window.tmpInventoryToast&&tmpInventoryToast(ok?G.check+' GPT stack prompt copied':'Prompt ready \u2014 copy from fallback','');}catch(_){}}); const url='https://chatgpt.com/?q='+encodeURIComponent(prompt); try{const w=window.open(url,'_blank','noopener,noreferrer'); if(!w) throw new Error('blocked');}catch(_){alert(prompt);} }
  function addVirtualToWishlist(){const st=load(); const selected=virtualCatalog.filter(v=>(st.virtual||[]).includes(v.id)); if(!selected.length){try{tmpInventoryToast&&tmpInventoryToast('Select virtual stack candidates first','amber')}catch(_){} return;} selected.forEach(v=>{try{window.ptWishlistAdd&&ptWishlistAdd(v.name);}catch(_){}}); try{tmpInventoryToast&&tmpInventoryToast(window.__tmpSbGlyphs.check+' Added '+selected.length+' virtual candidate'+(selected.length===1?'':'s')+' to wishlist');}catch(_){} }
  function enhance(){
    const root=document.getElementById('pg-stackbuilder'); if(!root) return;
    const main=root.querySelector('.gpt-sb-main'); const side=root.querySelector('.gpt-sb-side'); if(!main||!side) return;
    const st=load();
    if(!document.getElementById('gpt-sb-source-card')){
      const card=document.createElement('article'); card.className='gpt-sb-card'; card.id='gpt-sb-source-card';
      card.innerHTML='<div class="gpt-sb-cardhead"><b>2 '+window.__tmpSbGlyphs.dot+' Choose build source</b><span>inventory vs ideal wishlist stack</span></div><div class="gpt-sb-source-grid"><button type="button" class="gpt-sb-source" data-sb-source="inventory"><b>Work from inventory</b><small>Use what is currently stocked/open and protect low inventory.</small></button><button type="button" class="gpt-sb-source" data-sb-source="hybrid"><b>Hybrid builder</b><small>Use inventory first, then suggest wishlist additions where the stack is weak.</small></button><button type="button" class="gpt-sb-source" data-sb-source="virtual"><b>Virtual best stack</b><small>Design the best theoretical stack for the selected lanes, then add candidates to wishlist.</small></button></div>';
      const after=document.querySelector('#sb-lanes')?.closest('.gpt-sb-card'); (after&&after.parentNode?after.parentNode:main).insertBefore(card, after?after.nextSibling:main.firstChild);
    }
    if(!document.getElementById('gpt-sb-virtual-card')){
      const card=document.createElement('article'); card.className='gpt-sb-card'; card.id='gpt-sb-virtual-card';
      card.innerHTML='<div class="gpt-sb-cardhead"><b>Virtual best-stack candidates</b><span>can feed wishlist</span></div><div id="gpt-sb-virtual-list" class="gpt-sb-virtual-list"></div><div class="gpt-sb-plan-actions"><button type="button" class="gpt-sb-btn primary" id="gpt-sb-add-wishlist">Add selected to Wishlist</button><button type="button" class="gpt-sb-btn" id="gpt-sb-feed-opt2">Feed Optimizer</button></div><div class="gpt-sb-mini-note"><b>Use case:</b> inventory mode builds from what you have; virtual mode designs what you may want to buy next.</div>';
      const after=document.querySelector('#sb-options')?.closest('.gpt-sb-card'); (after&&after.parentNode?after.parentNode:main).insertBefore(card, after?after.nextSibling:null);
    }
    if(!document.getElementById('gpt-sb-plan-card')){
      const card=document.createElement('article'); card.className='gpt-sb-card gpt-sb-plan-card'; card.id='gpt-sb-plan-card';
      card.innerHTML='<div class="gpt-sb-cardhead"><b>GPT daily / weekly stack builder</b><span>optional advisor</span></div><select class="gpt-sb-prompt-mode" id="gpt-sb-prompt-mode"><option value="research">Medical research scholar '+window.__tmpSbGlyphs.dot+' evidence only</option><option value="practical">Practical optimizer '+window.__tmpSbGlyphs.dot+' timing + inventory</option><option value="simplify">Simplify schedule '+window.__tmpSbGlyphs.dot+' reduce burden</option><option value="caution">Caution check '+window.__tmpSbGlyphs.dot+' facts vs assumptions</option></select><div class="gpt-sb-plan-actions"><button type="button" class="gpt-sb-btn primary" id="gpt-sb-ask-plan">Ask GPT to build daily/weekly stack</button><button type="button" class="gpt-sb-btn" id="gpt-sb-copy-plan">Copy prompt</button></div><textarea id="gpt-sb-plan-prompt" class="gpt-sb-plan-text" readonly></textarea><div class="gpt-sb-mini-note">This sends only the prompt you approve. It asks GPT to separate evidence, assumptions, practical schedule suggestions, inventory/wishlist decisions, and clinician questions.</div>';
      const feed=document.getElementById('sb-feed')?.closest('.gpt-sb-card'); (feed&&feed.parentNode?feed.parentNode:side).insertBefore(card, feed||side.firstChild);
    }
    root.querySelectorAll('[data-sb-source]').forEach(btn=>{btn.classList.toggle('on',(load().source||'inventory')===btn.dataset.sbSource); if(!btn.__b){btn.__b=1;btn.onclick=()=>{const x=load();x.source=btn.dataset.sbSource;save(x);enhance();};}});
    const list=document.getElementById('gpt-sb-virtual-list'); if(list){const cands=candidatesFor(st); list.innerHTML=cands.map(v=>'<label class="gpt-sb-virtual-item"><input type="checkbox" data-sb-virtual="'+esc(v.id)+'" '+((st.virtual||[]).includes(v.id)?'checked':'')+'><div><b>'+esc(v.name)+'</b><small>'+esc(v.why)+'</small></div><em>'+esc(laneNames[v.lane]||v.lane)+'</em></label>').join(''); list.querySelectorAll('[data-sb-virtual]').forEach(cb=>{cb.onchange=()=>{const x=load(); const id=cb.dataset.sbVirtual; x.virtual=cb.checked?[...(x.virtual||[]),id]:(x.virtual||[]).filter(y=>y!==id); save(x); enhance();};});}
    const pm=document.getElementById('gpt-sb-prompt-mode'); if(pm){pm.value=st.promptMode||'research'; if(!pm.__b){pm.__b=1;pm.onchange=()=>{const x=load();x.promptMode=pm.value;save(x);enhance();};}}
    const prompt=buildPrompt(); const ta=document.getElementById('gpt-sb-plan-prompt'); if(ta) ta.value=prompt; const feed=document.getElementById('sb-feed'); if(feed) feed.value=prompt; if(window.TMP_OPTIMIZER_ENABLED!==false){try{localStorage.setItem('tmp.stackBuilder.feed',prompt);}catch(_){}}
    const ask=document.getElementById('gpt-sb-ask-plan'); if(ask&&!ask.__b){ask.__b=1; ask.onclick=askGPT;}
    const cp=document.getElementById('gpt-sb-copy-plan'); if(cp&&!cp.__b){cp.__b=1; cp.onclick=async()=>{const ok=await copyText(buildPrompt()); const G=window.__tmpSbGlyphs; try{tmpInventoryToast&&tmpInventoryToast(ok?G.check+' Stack-building prompt copied':'Copy blocked \u2014 prompt shown','');}catch(_){} if(!ok) alert(buildPrompt());};}
    const wl=document.getElementById('gpt-sb-add-wishlist'); if(wl&&!wl.__b){wl.__b=1; wl.onclick=addVirtualToWishlist;}
    const fo=document.getElementById('gpt-sb-feed-opt2'); if(fo){if(window.TMP_OPTIMIZER_ENABLED===false){fo.style.display='none';}else if(!fo.__b){fo.__b=1; fo.onclick=()=>{try{localStorage.setItem('tmp.stackBuilder.feed',buildPrompt());}catch(_){}; document.querySelector('[data-pg="optimizer"]')?.click(); setTimeout(()=>{try{window.renderOptimizer&&window.renderOptimizer();window.tmpStackBuilderInjectOptimizer&&window.tmpStackBuilderInjectOptimizer();}catch(_){}},220);};}}
    const oldCopy=document.getElementById('sb-copy-gpt'); if(oldCopy&&!oldCopy.__gpt288){oldCopy.__gpt288=1; oldCopy.textContent='Copy stack-building prompt'; oldCopy.onclick=async()=>{const ok=await copyText(buildPrompt()); const G=window.__tmpSbGlyphs; try{tmpInventoryToast&&tmpInventoryToast(ok?G.check+' Stack-building prompt copied':'Copy blocked','');}catch(_){} if(!ok) alert(buildPrompt());};}
  }
  window.tmpStackBuilderEnhancedPrompt=buildPrompt; window.tmpStackBuilderEnhance=enhance;
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"],#pg-stackbuilder')) setTimeout(enhance,80);},true);
  document.addEventListener('change',e=>{if(e.target&&e.target.closest&&e.target.closest('#pg-stackbuilder')) setTimeout(enhance,80);},true);
  const mo=new MutationObserver(()=>{const pg=document.getElementById('pg-stackbuilder'); if(pg&&pg.style.display!=='none'&&!window.__tmpMoQuiet.active()&&!mo.__pending){mo.__pending=1;setTimeout(()=>{mo.__pending=0;window.__tmpMoQuiet.run(enhance);},30);}});
  try{mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});}catch(_){}
  setTimeout(enhance,400);
})();


// ===== extracted post-core patch script =====
(function(){
  const familyMap={
    fat:{idx:[2,3],label:'Fat loss',match:/(reta|retatrutide|tirz|tirzepatide|sema|semaglutide|aod|glp|weight|appetite)/i},
    recovery:{idx:[1,9,10],label:'Recovery',match:/(bpc|tb.?500|ghk|wolv|wolverine|kpv|thymosin|repair|healing)/i},
    sleep:{idx:[0,11,6,5],label:'Sleep/GH',match:/(ipa|ipamorelin|cjc|tesa|tesamorelin|sermorelin|dsip|mk.?677|ibutamoren|gh)/i},
    hormone:{idx:[11,7,0],label:'Hormone/TRT',match:/(test|tc|cyp|trt|hcg|enclo|clomid|anastrozole|estrogen|estradiol)/i},
    support:{idx:[8,5,10],label:'Support',match:/(vit|mag|fish|iron|omega|psyllium|turmeric|nad|glutathione)/i}
  };
  function invItems(){try{return (window.S&&S.inv||[]).filter(i=>!i.isSupply&&i.name)}catch(_){return[]}}
  function familyFor(name){for(const k of Object.keys(familyMap)){if(familyMap[k].match.test(String(name)))return k;}return 'support'}
  function assignAutoColors(){
    const used={fat:0,recovery:0,sleep:0,hormone:0,support:0};
    invItems().forEach(it=>{const fam=familyFor(it.name);const arr=familyMap[fam].idx;it.colorOverride=arr[(used[fam]++)%arr.length];});
    try{ if(typeof buildColorMap==='function') buildColorMap(); if(typeof save==='function') save(); }catch(_){ }
    try{ if(typeof renderInventoryPage==='function') renderInventoryPage(); if(typeof renderInv==='function') renderInv(); if(typeof renderStack==='function') renderStack(); if(typeof renderCal==='function') renderCal(); }catch(_){ }
    try{ if(window.tmpInventoryToast) tmpInventoryToast(window.__tmpSbGlyphs.check+' Auto color recommendations applied','Stack colors now flow from Inventory into Daily Stack and Calendar.'); }catch(_){ alert('Auto color recommendations applied.'); }
  }
  window.gptApplyAutoStackColors=assignAutoColors;
  function colorCounts(){const out={fat:0,recovery:0,sleep:0,hormone:0,support:0};invItems().forEach(i=>out[familyFor(i.name)]++);return out}
  function injectDaily(){
    const hero=document.querySelector('#pg-stack .gpt270-hero'); if(!hero || hero.querySelector('.gpt297-color-signal')) return;
    const c=colorCounts();
    const sig=document.createElement('div'); sig.className='gpt297-color-signal';
    sig.innerHTML='<div><b>Color map</b><span>'+invItems().length+' inventory items</span></div><div><b>Recovery</b><span>'+c.recovery+' green/teal</span></div><div><b>Sleep/GH</b><span>'+c.sleep+' blue/violet</span></div><div><b>Fat loss</b><span>'+c.fat+' yellow/orange</span></div>';
    const btns=hero.querySelector('.gpt270-btns'); if(btns) hero.insertBefore(sig,btns); else hero.appendChild(sig);
    const btn=document.createElement('button'); btn.className='gpt270-btn'; btn.type='button'; btn.textContent='Auto colors'; btn.title='Recommend high-contrast stack colors and save them to Inventory'; btn.onclick=assignAutoColors; if(btns) btns.appendChild(btn);
  }
  function injectInventory(){
    const pg=document.getElementById('pg-inventory'); if(!pg || document.getElementById('gpt297-inv-color-card')) return;
    const card=document.createElement('div'); card.id='gpt297-inv-color-card'; card.className='gpt297-auto-color-card';
    card.innerHTML='<div class="h"><div><b>Auto color recommendation</b><p>Assign higher-contrast colors by stack family: fat loss = yellow/orange, recovery = green/teal, sleep/GH = blue/violet, hormone/TRT = indigo/rose. Saves to Inventory so Daily Stack and Calendar use the same colors.</p></div><button type="button">Apply auto colors</button></div>';
    const btn=card.querySelector('button'); if(btn) btn.onclick=assignAutoColors;
    pg.insertBefore(card, pg.firstChild);
  }
  function boot(){injectDaily(); injectInventory();}
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stack"],[data-pg="inventory"]'))setTimeout(boot,220)},true);
  __tmpPgInterval(function(){try{boot()}catch(_){}}, 1400, ['pg-stack','pg-inventory']);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();


// ===== extracted post-core patch script =====
(function(){
  if(__tmpVendorLogActive())return;
  const TEMPLATE_COLUMNS = [
    'vendor','warehouse','product_name','catalog_name','strength','quantity','unit','price_usd','currency','min_order','notes'
  ];
  const TEMPLATE_CSV = TEMPLATE_COLUMNS.join(',') + '\\n' +
    'ExampleVendor,US,Retatrutide 10mg,Retatrutide,10,mg,125,USD,,source row note\\n' +
    'ExampleVendor,China,BPC-157/TB-500 10mg,BPC-157 + TB-500,10,mg,48,USD,,combo allowed';
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  function looksWarehouse(txt){
    const t=String(txt||'').toLowerCase();
    if(/\b(us|usa|u\.s\.|domestic|dom)\b/.test(t)) return 'US';
    if(/\b(china|cn|intl|international|overseas|factory|cn warehouse)\b/.test(t)) return 'China';
    return '';
  }
  function guessVendor(txt, fileName){
    const lines=String(txt||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,20);
    const hay=(fileName||'')+'\\n'+lines.join('\\n');
    let m=hay.match(/(?:vendor|supplier|company)\\s*[:\\-]\\s*([A-Za-z0-9 ._&-]{2,40})/i);
    if(m) return m[1].trim();
    const base=String(fileName||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
    if(base) return base.replace(/\b(price|prices|list|usa|us|china|cn|warehouse|wholesale|sheet|pdf|xls|xlsx|csv)\b/ig,'').replace(/\s+/g,' ').trim().slice(0,40);
    return '';
  }
  function parseCSV(text){
    const rows=[]; let row=[], cell='', q=false;
    for(let i=0;i<String(text).length;i++){
      const c=text[i], n=text[i+1];
      if(c==='"' && q && n==='"'){cell+='"';i++;continue}
      if(c==='"'){q=!q;continue}
      if(c===',' && !q){row.push(cell);cell='';continue}
      if((c==='\n'||c==='\r')&&!q){ if(c==='\r'&&n==='\n')i++; row.push(cell); if(row.some(x=>String(x).trim())) rows.push(row); row=[]; cell=''; continue}
      cell+=c;
    }
    row.push(cell); if(row.some(x=>String(x).trim())) rows.push(row);
    return rows;
  }
  function normalizeHeader(h){return String(h||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
  function importNormalizedCSV(csv, fallbackVendor, fallbackWarehouse){
    const rows=parseCSV(csv);
    if(rows.length<2) return {ok:false,msg:'No normalized rows found.'};
    const headers=rows[0].map(normalizeHeader);
    const idx={}; headers.forEach((h,i)=>idx[h]=i);
    function val(r, names){for(const n of names){const k=normalizeHeader(n); if(idx[k]!=null) return String(r[idx[k]]||'').trim()} return ''}
    const imported=[];
    rows.slice(1).forEach(r=>{
      const name=val(r,['product_name','product','item','peptide','name']);
      const priceRaw=val(r,['price_usd','price','usd','cost']);
      if(!name || !priceRaw) return;
      const price=Number(String(priceRaw).replace(/[^0-9.]/g,''));
      if(!isFinite(price)) return;
      const vendor=val(r,['vendor','supplier']) || fallbackVendor || 'Unknown vendor';
      const warehouse=val(r,['warehouse','location','ship_from']) || fallbackWarehouse || 'Unknown';
      const strength=val(r,['strength','size','mg','dose']);
      const unit=val(r,['unit']) || (/iu/i.test(name)?'iu':'mg');
      const catalog=val(r,['catalog_name','catalog','normalized_name']) || name.replace(/\b\d+(\.\d+)?\s*(mg|mcg|iu|ml|vial|kit|kits)\b/ig,'').trim();
      const key=(vendor+'|'+warehouse+'|'+name+'|'+strength+'|'+price).toLowerCase();
      imported.push({vendor,warehouse,product_name:name,catalog_name:catalog,strength,unit,price_usd:price,currency:val(r,['currency'])||'USD',notes:val(r,['notes','note']),key});
    });
    if(!imported.length) return {ok:false,msg:'No importable rows with product + price.'};
    try{
      const old=JSON.parse(localStorage.getItem('tmp.vendorPrices.normalized.v1')||'[]');
      const map=new Map(old.map(x=>[x.key||((x.vendor+'|'+x.warehouse+'|'+x.product_name+'|'+x.price_usd).toLowerCase()),x]));
      imported.forEach(x=>map.set(x.key,x));
      localStorage.setItem('tmp.vendorPrices.normalized.v1',JSON.stringify([...map.values()]));
      localStorage.setItem('tmp.vendorPrices.lastImport.v1',JSON.stringify({vendor:fallbackVendor,warehouse:fallbackWarehouse,count:imported.length,ts:Date.now()}));
    }catch(e){}
    return {ok:true,msg:'Imported '+imported.length+' normalized price row'+(imported.length===1?'':'s')+'.'};
  }
  function buildPrompt(){
    const raw=($('gpt-vendor-ai-raw')||{}).value||'';
    const vendor=($('gpt-vendor-ai-vendor')||{}).value||guessVendor(raw,($('gpt-vendor-ai-file')||{}).dataset.fileName||'');
    const wh=($('gpt-vendor-ai-warehouse')||{}).value||looksWarehouse(raw)||'Unknown';
    return [
      'You are normalizing a vendor peptide price list for PeptideGenius.',
      '',
      'Task:',
      '1. Read the raw vendor price list below. It may be copied text from PDF, XLS/XLSX/CSV, email, or messy table.',
      '2. Infer vendor name and warehouse/location when possible. Warehouse must be one of: US, China, Unknown.',
      '3. Normalize every purchasable product row into the TMP vendor price template.',
      '4. Return ONLY CSV. No markdown, no commentary.',
      '5. Preserve combo product names, strengths, kits, vials, and notes.',
      '6. If price is ambiguous, leave price_usd blank and put the uncertainty in notes.',
      '',
      'TMP VENDOR PRICE TEMPLATE COLUMNS:',
      TEMPLATE_COLUMNS.join(','),
      '',
      'Rules:',
      '- vendor = vendor/supplier name. Use "'+vendor+'" unless the source clearly says otherwise.',
      '- warehouse = US, China, or Unknown. Use "'+wh+'" unless the source clearly says otherwise.',
      '- product_name = exact listed product/size.',
      '- catalog_name = simplified peptide name that best matches the TMP catalog.',
      '- strength = numeric strength/size when available.',
      '- unit = mg, mcg, iu, ml, vial, kit, or blank.',
      '- price_usd = numeric USD price only, no dollar sign.',
      '- currency = USD unless another currency is explicit.',
      '- notes = source notes, MOQ, package, promo, ambiguity, or warehouse hints.',
      '',
      'RAW PRICE LIST:',
      raw.slice(0,24000)
    ].join('\\n');
  }
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){return false}}
  async function askGPT(){
    const prompt=buildPrompt();
    const ok=await copyText(prompt);
    const url='https://chatgpt.com/?q='+encodeURIComponent(prompt.slice(0,7000));
    try{window.open(url,'_blank','noopener,noreferrer')}catch(e){}
    toast(ok?'✓ GPT normalizer prompt copied':'Prompt ready — copy blocked','Paste into GPT if the new tab does not prefill.');
  }
  async function readFile(file){
    if(!file) return '';
    const name=file.name||'';
    const ext=name.split('.').pop().toLowerCase();
    if(['csv','txt','tsv','html','htm'].includes(ext)) return await file.text();
    // Browser-only XLS/PDF parsing is intentionally limited; still let user send file name and any extracted text.
    try{return await file.text()}catch(e){return '[File selected: '+name+']\\nBrowser could not extract text from this file. Use Ask GPT and upload/attach the file there, or paste text/table here.'}
  }
  function ensureUI(){
    return; // VENDOR-LOG-R1: legacy GPT vendor pricing UI removed
    if(!page || $('gpt-vendor-ai-card')) return;
    const card=document.createElement('section');
    card.id='gpt-vendor-ai-card';
    card.className='card gpt-vendor-ai-card';
    card.innerHTML=
      '<div class="gpt-vendor-ai-head"><div><div class="gpt-vendor-ai-k">Vendor Pricing AI normalizer</div><div class="gpt-vendor-ai-title">Normalize any vendor price list into the TMP template</div><div class="gpt-vendor-ai-sub">Drop in a PDF/XLS/CSV/text price list or paste messy rows. Use GPT to normalize the file, then import the returned TMP CSV. Vendor and warehouse are auto-guessed when possible.</div></div><div class="gpt-vendor-ai-badges"><span class="gpt-vendor-ai-badge">PDF / XLS / CSV / text</span><span class="gpt-vendor-ai-badge">US vs China warehouse</span><span class="gpt-vendor-ai-badge">TMP template</span></div></div>'+
      '<div class="gpt-vendor-ai-grid"><div class="gpt-vendor-ai-panel"><div class="gpt-vendor-ai-row"><div><label>Vendor</label><input id="gpt-vendor-ai-vendor" placeholder="Auto-detected or type vendor name"></div><div><label>Warehouse</label><select id="gpt-vendor-ai-warehouse"><option value="">Auto / Unknown</option><option>US</option><option>China</option><option>Unknown</option></select></div><div><label>Mode</label><select id="gpt-vendor-ai-mode"><option value="replace">Update/merge vendor rows</option><option value="preview">Preview only</option></select></div></div><div class="gpt-vendor-ai-file"><input id="gpt-vendor-ai-file" type="file" accept=".csv,.tsv,.txt,.xls,.xlsx,.pdf,.html,.htm"><button type="button" class="gpt-vendor-ai-btn" id="gpt-vendor-ai-detect">Detect vendor/warehouse</button><button type="button" class="gpt-vendor-ai-btn primary" id="gpt-vendor-ai-ask">Ask GPT to normalize</button></div><label>Raw vendor price list / pasted table</label><textarea id="gpt-vendor-ai-raw" placeholder="Paste vendor price list text here, or choose a file above."></textarea><div class="gpt-vendor-ai-actions"><button type="button" class="gpt-vendor-ai-btn primary" id="gpt-vendor-ai-import">Import normalized CSV below</button><button type="button" class="gpt-vendor-ai-btn" id="gpt-vendor-ai-copy-template">Copy TMP template</button><button type="button" class="gpt-vendor-ai-btn warn" id="gpt-vendor-ai-copy-prompt">Copy GPT prompt</button></div><div class="gpt-vendor-ai-status" id="gpt-vendor-ai-status"></div><label style="margin-top:8px">GPT normalized TMP CSV output</label><textarea id="gpt-vendor-ai-normalized" placeholder="Paste GPT CSV output here, then click Import normalized CSV."></textarea></div><aside class="gpt-vendor-ai-panel gpt-vendor-ai-template"><label>TMP vendor price template</label><pre id="gpt-vendor-ai-template"></pre><div class="gpt-vendor-ai-small"><b>Import behavior:</b> vendor + warehouse + product/strength are preserved so US and China price lists can live side by side for the same vendor.</div><div class="gpt-vendor-ai-pillrow"><span class="gpt-vendor-ai-pill">vendor</span><span class="gpt-vendor-ai-pill">warehouse</span><span class="gpt-vendor-ai-pill">catalog match</span><span class="gpt-vendor-ai-pill">price_usd</span></div></aside></div>';
    page.insertBefore(card,page.firstChild);
    const temp=$('gpt-vendor-ai-template'); if(temp) temp.textContent=TEMPLATE_CSV;
    $('gpt-vendor-ai-file')?.addEventListener('change', async e=>{
      const f=e.target.files&&e.target.files[0]; if(!f) return;
      e.target.dataset.fileName=f.name||'';
      const txt=await readFile(f);
      const raw=$('gpt-vendor-ai-raw'); if(raw) raw.value=txt;
      detect();
    });
    function detect(){
      const raw=($('gpt-vendor-ai-raw')||{}).value||'';
      const file=($('gpt-vendor-ai-file')||{}).dataset.fileName||'';
      const v=guessVendor(raw,file); const w=looksWarehouse(raw+' '+file);
      if(v && !$('gpt-vendor-ai-vendor').value) $('gpt-vendor-ai-vendor').value=v;
      if(w && !$('gpt-vendor-ai-warehouse').value) $('gpt-vendor-ai-warehouse').value=w;
      const st=$('gpt-vendor-ai-status'); if(st) st.textContent='Detected: '+($('gpt-vendor-ai-vendor').value||'vendor unknown')+' · '+($('gpt-vendor-ai-warehouse').value||'warehouse unknown');
    }
    $('gpt-vendor-ai-detect')?.addEventListener('click',detect);
    $('gpt-vendor-ai-raw')?.addEventListener('input',()=>{const st=$('gpt-vendor-ai-status'); if(st) st.textContent='Raw price text loaded. Detect or ask GPT to normalize.'});
    $('gpt-vendor-ai-ask')?.addEventListener('click',askGPT);
    $('gpt-vendor-ai-copy-template')?.addEventListener('click',async()=>{await copyText(TEMPLATE_CSV); toast('✓ TMP vendor template copied')});
    $('gpt-vendor-ai-copy-prompt')?.addEventListener('click',async()=>{await copyText(buildPrompt()); toast('✓ GPT normalizer prompt copied')});
    $('gpt-vendor-ai-import')?.addEventListener('click',()=>{
      const csv=($('gpt-vendor-ai-normalized')||{}).value||'';
      const res=importNormalizedCSV(csv,($('gpt-vendor-ai-vendor')||{}).value,($('gpt-vendor-ai-warehouse')||{}).value);
      const st=$('gpt-vendor-ai-status'); if(st) st.textContent=res.msg;
      toast(res.ok?'✓ '+res.msg:res.msg,res.ok?'':'amber');
      try{ if(typeof renderPrices==='function') renderPrices(); }catch(_){}
    });
  }
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="prices"]'))setTimeout(ensureUI,120)},true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(ensureUI,300)); else setTimeout(ensureUI,300);
})();


// ===== extracted post-core patch script =====
/* disabled by v33.375-stable-vendor-post-import-review */


// ===== extracted post-core patch script =====
/* disabled by v33.375-stable-vendor-post-import-review */


// ===== extracted post-core patch script =====
(function(){
  // v33.375-stable-vendor-post-import-review: ChatGPT URL prefill is unreliable and long prompts can cause HTTP 431.
  // This version makes the app show the generated prompt FIRST and copy it.
  // User then opens ChatGPT and pastes. This is the most reliable browser-safe flow.
  function $(id){ return document.getElementById(id); }
  function toast(a,b){ try{ window.tmpInventoryToast && tmpInventoryToast(a,b||''); }catch(_){} }
  async function copyText(t){ try{ await navigator.clipboard.writeText(t); return true; }catch(e){ return false; } }
  function val(id){ const el=$(id); return el ? (el.value || el.textContent || '') : ''; }

  function optimizerPrompt(){
    const ta = $('opt-gpt-summary');
    if(ta && ta.value.trim()) return ta.value.trim();
    const score = (document.querySelector('#opt-score-ring strong')||{}).textContent || (document.querySelector('#opt-score-pill')||{}).textContent || '';
    const headline = (document.querySelector('#opt-headline')||{}).textContent || 'Stack Optimizer review';
    const summary = (document.querySelector('#opt-summary')||{}).textContent || '';
    return [
      'Use medical research scholar mode. Review this PeptideGenius Stack Optimizer output.',
      'Only make claims supported by demonstrable evidence, or clearly label assumptions/hypotheses.',
      'Do not invent citations. If evidence is insufficient, say “insufficient evidence.”',
      'Do not prescribe dosing or claim medical certainty.',
      '',
      'Optimizer headline: ' + headline,
      'Score: ' + score,
      'Summary: ' + summary,
      '',
      'Return sections:',
      '1. Evidence-supported observations',
      '2. Assumptions/uncertainties',
      '3. Practical schedule/inventory suggestions',
      '4. Questions to ask a clinician'
    ].join('\n');
  }

  function stackBuilderPrompt(){
    const ta = $('gpt-sb-plan-prompt') || $('sb-feed');
    if(ta && ta.value.trim()) return ta.value.trim();
    return [
      'Use medical research scholar mode.',
      'Build a daily and weekly stack proposal from the selected PeptideGenius Stack Builder inputs.',
      'Separate evidence-supported observations from assumptions.',
      'Include AM / lunch / dinner / bedtime lanes, inventory-vs-wishlist decisions, and clinician questions.',
      'Do not prescribe dosing or claim medical certainty.'
    ].join('\n');
  }

  function vendorPrompt(){
    const raw = val('gpt-vendor-ai-raw');
    const templ = val('gpt-vendor-ai-template') || 'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes';
    const vendor = val('gpt-vendor-ai-vendor') || 'Unknown vendor';
    const wh = val('gpt-vendor-ai-warehouse') || 'Unknown';
    return [
      'You are normalizing a vendor peptide price list for PeptideGenius.',
      'Return ONLY CSV. No markdown, no commentary.',
      'Vendor: ' + vendor,
      'Warehouse: ' + wh,
      '',
      'TMP vendor price template:',
      templ,
      '',
      'Raw vendor price list:',
      raw || '[Paste or attach the vendor price list here.]'
    ].join('\n');
  }

  function promptFromButton(btn){
    if(btn.closest('#pg-optimizer')) return optimizerPrompt();
    if(btn.closest('#pg-builder')) return stackBuilderPrompt();
    if(btn.closest('#pg-prices')) return vendorPrompt();
    const ta = btn.closest('.card,section,article,div')?.querySelector('textarea');
    if(ta && ta.value.trim()) return ta.value.trim();
    return '';
  }

  function ensureModal(){
    let m = $('gpt-ask-handoff-modal');
    if(m) return m;
    m = document.createElement('div');
    m.id = 'gpt-ask-handoff-modal';
    m.innerHTML =
      '<div class="gpt-ask-handoff-card">'+
        '<div class="gpt-ask-handoff-head">'+
          '<div><b>Ask GPT — prompt ready</b><p>Browser security does not allow reliable automatic paste into ChatGPT. This app now shows the prompt first and copies it. Open ChatGPT, then paste.</p></div>'+
          '<button type="button" class="gpt-ask-handoff-close" id="gpt-ask-handoff-close">Close</button>'+
        '</div>'+
        '<div class="gpt-ask-handoff-status" id="gpt-ask-handoff-status"><b>Status:</b> Prompt generated.</div>'+
        '<textarea class="gpt-ask-handoff-text" id="gpt-ask-handoff-text"></textarea>'+
        '<div class="gpt-ask-handoff-actions">'+
          '<button type="button" class="primary" id="gpt-ask-handoff-copy-open">Copy prompt + open ChatGPT</button>'+
          '<button type="button" id="gpt-ask-handoff-copy">Copy prompt</button>'+
          '<button type="button" class="warn" id="gpt-ask-handoff-open">Open ChatGPT only</button>'+
          '<button type="button" id="gpt-ask-handoff-select">Select text</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(m);
    $('gpt-ask-handoff-close').onclick = () => m.style.display = 'none';
    m.addEventListener('click', e => { if(e.target === m) m.style.display = 'none'; });
    $('gpt-ask-handoff-copy').onclick = async () => {
      const ok = await copyText(val('gpt-ask-handoff-text'));
      setStatus(ok ? 'Copied to clipboard.' : 'Copy blocked. Use Select text, then Ctrl+C.');
      toast(ok ? '✓ Prompt copied' : 'Copy blocked — select text manually', ok ? '' : 'amber');
    };
    $('gpt-ask-handoff-copy-open').onclick = async () => {
      const ok = await copyText(val('gpt-ask-handoff-text'));
      try{ window.open('https://chatgpt.com/','_blank','noopener,noreferrer'); }catch(e){}
      setStatus(ok ? 'Copied. ChatGPT opened — paste into the message box.' : 'ChatGPT opened. Copy may be blocked; select text manually.');
      toast(ok ? '✓ Prompt copied — paste into ChatGPT' : 'ChatGPT opened — manual copy needed', ok ? '' : 'amber');
    };
    $('gpt-ask-handoff-open').onclick = () => { try{ window.open('https://chatgpt.com/','_blank','noopener,noreferrer'); }catch(e){} };
    $('gpt-ask-handoff-select').onclick = () => {
      const ta = $('gpt-ask-handoff-text');
      if(ta){ ta.focus(); ta.select(); }
    };
    return m;
  }

  function setStatus(msg){
    const st = $('gpt-ask-handoff-status');
    if(st) st.innerHTML = '<b>Status:</b> ' + String(msg || '');
  }

  async function showHandoff(prompt){
    const m = ensureModal();
    const ta = $('gpt-ask-handoff-text');
    if(ta) ta.value = prompt || '';
    m.style.display = 'flex';
    const ok = await copyText(prompt || '');
    setStatus(ok ? 'Prompt generated and copied. Click “Copy prompt + open ChatGPT,” then paste.' : 'Prompt generated. Clipboard copy may be blocked; use Select text.');
    setTimeout(() => { try{ ta && ta.focus(); }catch(e){} }, 50);
  }

  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest && e.target.closest('[data-opt-ask-gpt],#gpt-sb-ask-plan,#gpt-vendor-ai-ask');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const prompt = promptFromButton(btn);
    if(!prompt){
      toast('No GPT prompt found','amber');
      return;
    }
    showHandoff(prompt);
  }, true);
})();


// ===== extracted post-core patch script =====
(function(){
  if(__tmpVendorLogActive())return;
  // v33.375-stable-vendor-post-import-review: A static local HTML file cannot automatically attach/copy a local PDF/XLS
  // into chatgpt.com. This patch makes the GPT handoff explicit:
  // - For readable text/CSV, the raw text is included in the prompt.
  // - For PDF/XLS/XLSX, the prompt tells GPT the user will attach the file manually.
  // - The modal status tells user to upload the same file in ChatGPT.
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  function fileName(){
    const f=$('gpt-vendor-ai-file');
    return (f && f.files && f.files[0] && f.files[0].name) || (f && f.dataset && f.dataset.fileName) || '';
  }
  function fileExt(name){return String(name||'').split('.').pop().toLowerCase()}
  function rawText(){return ($('gpt-vendor-ai-raw')||{}).value||''}
  function warehouse(){
    return (($('gpt-vendor-ai-warehouse')||{}).value||'Unknown').trim() || 'Unknown'
  }
  function vendor(){
    return (($('gpt-vendor-ai-vendor')||{}).value||'Unknown vendor').trim() || 'Unknown vendor'
  }
  function template(){
    return (($('gpt-vendor-ai-template')||{}).textContent||'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes').trim()
  }
  function isBinaryVendorFile(){
    const ext=fileExt(fileName());
    return ['pdf','xls','xlsx'].includes(ext);
  }
  function buildVendorFilePrompt(){
    const name=fileName();
    const raw=rawText().trim();
    const binary=isBinaryVendorFile();
    const attachLine = binary
      ? ('IMPORTANT: I will attach/upload the source file to this ChatGPT message separately. File name: '+name+'. Use the attached file as the source of truth.')
      : (raw ? 'The raw extracted text is included below.' : 'No raw text was extracted. Ask me to paste the price list or attach the file if needed.');
    return [
      'You are normalizing a vendor peptide price list for PeptideGenius.',
      'Return ONLY CSV. No markdown, no commentary.',
      '',
      'Vendor: '+vendor(),
      'Warehouse: '+warehouse(),
      '',
      attachLine,
      '',
      'TMP vendor price template:',
      template(),
      '',
      'Rules:',
      '- Infer product rows from the attached/uploaded file or pasted raw text.',
      '- Warehouse must be US, China, or Unknown unless clearly specified.',
      '- Preserve combo products, strengths, package sizes, MOQ, and source notes.',
      '- price_usd must be numeric USD only, no dollar sign.',
      '- If a price is ambiguous, leave price_usd blank and explain in notes.',
      '',
      binary
        ? 'RAW TEXT: [No reliable browser text extraction for PDF/XLS/XLSX. Use the attached file.]'
        : ('RAW TEXT:\n'+(raw || '[Paste vendor price list here]'))
    ].join('\n');
  }
  function addVendorNote(){
    const file=$('gpt-vendor-ai-file');
    if(!file || $('gpt-vendor-ai-file-note')) return;
    const note=document.createElement('div');
    note.id='gpt-vendor-ai-file-note';
    note.innerHTML='<b>File handoff:</b> browser security prevents this local HTML file from attaching your PDF/XLS directly into ChatGPT. The Ask GPT button will copy a prompt; then upload the same file in the ChatGPT tab, or paste extracted text here first.';
    file.closest('.gpt-vendor-ai-file')?.insertAdjacentElement('afterend',note);
  }

  // Override the visible handoff prompt for Vendor Pricing by filling the modal with a file-aware prompt.
  document.addEventListener('click',function(e){
    const btn=e.target&&e.target.closest&&e.target.closest('#gpt-vendor-ai-ask');
    if(!btn) return;
    // Let v33.375-stable-vendor-post-import-review modal handler create/show the modal, then overwrite with the file-aware prompt/status.
    setTimeout(function(){
      const prompt=buildVendorFilePrompt();
      const ta=$('gpt-ask-handoff-text');
      if(ta) ta.value=prompt;
      const st=$('gpt-ask-handoff-status');
      const name=fileName();
      if(st){
        st.innerHTML='<b>Status:</b> Prompt copied. '+(isBinaryVendorFile()
          ? 'Now upload/attach '+(name?'"'+(window.escH||String)(name)+'"':'the selected PDF/XLS file')+' in ChatGPT, then paste/send this prompt.'
          : 'Extracted text is included when available. Paste/send this prompt in ChatGPT.');
      }
      try{navigator.clipboard&&navigator.clipboard.writeText(prompt)}catch(_){}
    },80);
  },true);

  document.addEventListener('change',function(e){
    if(e.target&&e.target.id==='gpt-vendor-ai-file'){
      setTimeout(addVendorNote,50);
      setTimeout(function(){
        const st=$('gpt-vendor-ai-status');
        const name=fileName();
        if(st && isBinaryVendorFile()){
          st.textContent='Selected '+name+'. Ask GPT will copy a prompt, but you still need to upload/attach this file in the ChatGPT tab.';
        }
      },120);
    }
  },true);

  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="prices"]')) setTimeout(addVendorNote,200);
  },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(addVendorNote,500)});
  else setTimeout(addVendorNote,500);

  window.tmpBuildVendorGPTFilePrompt = buildVendorFilePrompt;
})();


// ===== extracted post-core patch script =====
(function(){
  if(__tmpVendorLogActive())return;
  /*
    v33.375-stable-vendor-post-import-review
    The old vendor Ask GPT button was fighting several earlier handlers.
    This patch replaces the button node after render, removing old listeners, then installs
    one explicit flow:
      1) build vendor prompt
      2) copy prompt
      3) show prompt in modal
      4) open ChatGPT normally
      5) tell user to attach the selected PDF/XLS/XLSX manually

    A static local HTML file cannot attach a local file into chatgpt.com for the user.
  */
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){return false}}
  function fileName(){
    const f=$('gpt-vendor-ai-file');
    return (f && f.files && f.files[0] && f.files[0].name) || (f && f.dataset && f.dataset.fileName) || '';
  }
  function fileExt(n){return String(n||'').split('.').pop().toLowerCase()}
  function isAttachFile(){return ['pdf','xls','xlsx'].includes(fileExt(fileName()))}
  function val(id){const el=$(id); return el ? (el.value || el.textContent || '') : ''}
  function template(){
    return (val('gpt-vendor-ai-template') || 'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes').trim();
  }
  function buildPrompt(){
    const name=fileName();
    const raw=val('gpt-vendor-ai-raw').trim();
    const vendor=(val('gpt-vendor-ai-vendor')||'Unknown vendor').trim();
    const warehouse=(val('gpt-vendor-ai-warehouse')||'Unknown').trim();
    const attach=isAttachFile();
    return [
      'You are normalizing a vendor peptide price list for PeptideGenius.',
      'Return ONLY CSV. No markdown, no commentary.',
      '',
      'Vendor: '+vendor,
      'Warehouse: '+warehouse,
      '',
      attach
        ? 'IMPORTANT: I am attaching/uploading the source file separately in this ChatGPT message. File name: '+name+'. Use the attached file as the source of truth.'
        : 'The raw vendor price text is included below. Use it as the source of truth.',
      '',
      'TMP vendor price template:',
      template(),
      '',
      'Required CSV columns:',
      'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes',
      '',
      'Rules:',
      '- Infer product rows from the attached/uploaded file or pasted raw text.',
      '- Warehouse must be US, China, or Unknown unless clearly specified.',
      '- Preserve combo products, strengths, kits, vial/package size, MOQ, and notes.',
      '- price_usd must be numeric USD only, no dollar sign.',
      '- currency is USD unless another currency is explicit.',
      '- If a price is ambiguous, leave price_usd blank and explain in notes.',
      '- Do not add commentary before or after the CSV.',
      '',
      attach
        ? 'RAW TEXT: [Use the attached PDF/XLS/XLSX file. Browser extraction from the local app may be incomplete.]'
        : 'RAW TEXT:\n'+(raw || '[Paste vendor price list here.]')
    ].join('\n');
  }
  function ensureModal(){
    let m=$('gpt-vendor-handoff-modal');
    if(m) return m;
    m=document.createElement('div');
    m.id='gpt-vendor-handoff-modal';
    m.style.cssText='position:fixed;inset:0;z-index:2147483001;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.58);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);padding:18px';
    m.innerHTML=
      '<div style="width:min(880px,96vw);max-height:90vh;overflow:auto;border-radius:20px;background:#fff;border:1px solid rgba(203,213,225,.92);box-shadow:0 24px 76px rgba(15,23,42,.32);padding:16px">'+
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px">'+
          '<div><b style="font-size:17px;color:#18385E">Vendor normalizer prompt ready</b><p id="gpt-vendor-handoff-note" style="margin:4px 0 0;font-size:12px;color:#5C738F;line-height:1.45"></p></div>'+
          '<button type="button" id="gpt-vendor-handoff-close" style="border:1px solid #DCE7F4;background:#fff;border-radius:10px;padding:6px 10px;font-weight:850;cursor:pointer;color:#3F5875">Close</button>'+
        '</div>'+
        '<div id="gpt-vendor-handoff-status" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 10px;padding:8px 10px;border-radius:13px;background:linear-gradient(135deg,#F8FBFE,#F2FBF8);border:1px solid #DCE7F4;color:#46617B;font-size:11.5px;line-height:1.35"></div>'+
        '<textarea id="gpt-vendor-handoff-text" style="width:100%;min-height:330px;box-sizing:border-box;border:1px solid #DCE7F4;border-radius:14px;padding:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.43;color:#263B55;background:#F8FBFE"></textarea>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
          '<button type="button" id="gpt-vendor-handoff-copy-open" style="border:1px solid #7FA9E8;border-radius:12px;padding:9px 13px;font-size:12px;font-weight:850;cursor:pointer;background:linear-gradient(135deg,#4B84EA,#5AB8B1);color:#fff">Copy prompt + open ChatGPT</button>'+
          '<button type="button" id="gpt-vendor-handoff-copy" style="border:1px solid #DCE7F4;border-radius:12px;padding:9px 13px;font-size:12px;font-weight:850;cursor:pointer;background:#fff;color:#42607D">Copy prompt</button>'+
          '<button type="button" id="gpt-vendor-handoff-select" style="border:1px solid #DCE7F4;border-radius:12px;padding:9px 13px;font-size:12px;font-weight:850;cursor:pointer;background:#fff;color:#42607D">Select text</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(m);
    $('gpt-vendor-handoff-close').onclick=()=>m.style.display='none';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'});
    $('gpt-vendor-handoff-copy').onclick=async()=>{const ok=await copyText(val('gpt-vendor-handoff-text')); setStatus(ok?'Copied.':'Copy blocked. Use Select text, then Ctrl+C.'); toast(ok?'✓ Prompt copied':'Copy blocked — select text manually',ok?'':'amber')};
    $('gpt-vendor-handoff-copy-open').onclick=async()=>{const ok=await copyText(val('gpt-vendor-handoff-text')); try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(e){}; setStatus(ok?'Copied. ChatGPT opened. Paste prompt there, then attach the vendor file if needed.':'ChatGPT opened. Copy may be blocked; select text manually.'); toast(ok?'✓ Prompt copied — paste into ChatGPT':'Manual copy needed',ok?'':'amber')};
    $('gpt-vendor-handoff-select').onclick=()=>{const ta=$('gpt-vendor-handoff-text'); if(ta){ta.focus();ta.select();}};
    return m;
  }
  function setStatus(msg){
    const st=$('gpt-vendor-handoff-status');
    if(st) st.innerHTML='<b style="color:#18385E">Status:</b> '+String(msg||'');
  }
  async function openHandoff(){
    const prompt=buildPrompt();
    const m=ensureModal();
    const ta=$('gpt-vendor-handoff-text');
    const note=$('gpt-vendor-handoff-note');
    if(ta) ta.value=prompt;
    if(note){
      note.textContent=isAttachFile()
        ? 'The app cannot attach your selected file into ChatGPT automatically. Click the button below, then upload the same file in ChatGPT before sending.'
        : 'The extracted/pasted text is included in the prompt. Copy and send it to ChatGPT.';
    }
    m.style.display='flex';
    const ok=await copyText(prompt);
    setStatus(ok
      ? (isAttachFile()?'Prompt copied. Next: open ChatGPT and attach "'+(window.escH||String)(fileName())+'".':'Prompt copied. Open ChatGPT and paste/send it.')
      : 'Prompt generated. Clipboard may be blocked; use Select text.');
  }
  function installButton(){
    const old=$('gpt-vendor-ai-ask');
    if(!old || old.dataset.v33309Installed==='1') return;
    const btn=old.cloneNode(true);
    btn.dataset.v33309Installed='1';
    btn.classList.add('gpt-fixed-ask');
    btn.textContent='Ask GPT to normalize';
    btn.onclick=function(e){e.preventDefault();e.stopPropagation();openHandoff();};
    old.replaceWith(btn);

    if(!$('gpt-vendor-ai-handoff-help')){
      const help=document.createElement('div');
      help.id='gpt-vendor-ai-handoff-help';
      help.innerHTML='<b>GPT file handoff:</b><ol><li>Choose the vendor PDF/XLS/CSV file here.</li><li>Click <b>Ask GPT to normalize</b>.</li><li>In ChatGPT, paste the copied prompt and upload the same source file if it is PDF/XLS/XLSX.</li><li>Paste GPT’s CSV result back into the normalized CSV box and import.</li></ol>';
      btn.closest('.gpt-vendor-ai-file')?.insertAdjacentElement('afterend',help);
    }
  }
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="prices"]')) setTimeout(installButton,200);
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(installButton,500);setTimeout(installButton,1200)});
  else {setTimeout(installButton,500);setTimeout(installButton,1200);}
  window.tmpVendorOpenGPTNormalizerHandoff=openHandoff;
})();


// ===== extracted post-core patch script =====
(function(){
  if(__tmpVendorLogActive())return;
  /*
    v33.375-stable-vendor-post-import-review fix:
    Vendor detection was reading vendor-looking text from PDF/XLS content and overriding the actual file/vendor intent.
    Example: a JKL price list was detected as "JEEP US pricelist".
    New rule:
      1. filename + typed Vendor field win
      2. PDF/XLS raw text should NOT override vendor
      3. GPT prompt explicitly says use the vendor field exactly
  */
  function $(id){ return document.getElementById(id); }
  function toast(a,b){ try{ window.tmpInventoryToast && tmpInventoryToast(a,b||''); }catch(_){} }
  async function copyText(t){ try{ await navigator.clipboard.writeText(t); return true; }catch(e){ return false; } }
  function fileObj(){ const f=$('gpt-vendor-ai-file'); return f && f.files && f.files[0] ? f.files[0] : null; }
  function fileName(){ const f=fileObj(); return (f && f.name) || (($('gpt-vendor-ai-file')||{}).dataset||{}).fileName || ''; }
  function ext(n){ return String(n||'').split('.').pop().toLowerCase(); }
  function isBinary(){ return ['pdf','xls','xlsx'].includes(ext(fileName())); }
  function val(id){ const el=$(id); return el ? (el.value || el.textContent || '') : ''; }
  function cleanVendorFromFilename(name){
    let base=String(name||'').replace(/\.[^.]+$/,'').replace(/[_\-]+/g,' ').trim();
    base=base
      .replace(/\b(us|usa|u\.s\.|china|cn|intl|international|domestic|warehouse|wh|price|prices|pricelist|price list|list|sheet|vendor|peptide|peptides|pdf|xls|xlsx|csv|updated|new|final|copy)\b/ig,' ')
      .replace(/\b\d{4}[-_. ]?\d{0,2}[-_. ]?\d{0,2}\b/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    // Prefer first strong token/acronym if file is like "JKL US Price List"
    const parts=base.split(/\s+/).filter(Boolean);
    if(parts.length && parts[0].length<=8) return parts[0].toUpperCase();
    return base.slice(0,40);
  }
  function warehouseFromName(name){
    const t=String(name||'').toLowerCase();
    if(/\b(us|usa|u\.s\.|domestic|dom)\b/.test(t)) return 'US';
    if(/\b(china|cn|intl|international|overseas)\b/.test(t)) return 'China';
    return '';
  }
  function template(){
    return (val('gpt-vendor-ai-template') || 'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes').trim();
  }
  function currentVendor(){
    return (val('gpt-vendor-ai-vendor') || cleanVendorFromFilename(fileName()) || 'Unknown vendor').trim();
  }
  function currentWarehouse(){
    return (val('gpt-vendor-ai-warehouse') || warehouseFromName(fileName()) || 'Unknown').trim();
  }
  function rawText(){ return val('gpt-vendor-ai-raw').trim(); }
  function ensureControls(){
    const vendorInput=$('gpt-vendor-ai-vendor');
    if(vendorInput && !vendorInput.dataset.v33310Bound){
      vendorInput.dataset.v33310Bound='1';
      vendorInput.addEventListener('input',()=>{ vendorInput.dataset.userEdited='1'; });
    }
    if(!$('gpt-vendor-ai-force-row') && vendorInput){
      const row=document.createElement('label');
      row.id='gpt-vendor-ai-force-row';
      row.innerHTML='<input type="checkbox" id="gpt-vendor-ai-force-vendor" checked> <span><b>Use this vendor exactly</b> — do not let PDF/XLS text override it.</span>';
      vendorInput.closest('div')?.appendChild(row);
    }
    if(!$('gpt-vendor-ai-vendor-lock-note')){
      const ask=$('gpt-vendor-ai-ask');
      if(ask){
        const note=document.createElement('div');
        note.id='gpt-vendor-ai-vendor-lock-note';
        note.innerHTML='<b>Vendor detection:</b> filename and the Vendor field now win. PDF/XLS text can be messy, so it will not override the vendor name unless you manually change the field.';
        ask.closest('.gpt-vendor-ai-file')?.insertAdjacentElement('afterend',note);
      }
    }
  }
  function applyFilenameDetection(force){
    const f=fileName();
    if(!f) return;
    const vendorInput=$('gpt-vendor-ai-vendor');
    const whInput=$('gpt-vendor-ai-warehouse');
    const v=cleanVendorFromFilename(f);
    const w=warehouseFromName(f);
    if(vendorInput && v && (force || !vendorInput.value || vendorInput.dataset.userEdited!=='1')){
      vendorInput.value=v;
    }
    if(whInput && w && (force || !whInput.value)){
      whInput.value=w;
    }
    const st=$('gpt-vendor-ai-status');
    if(st) st.textContent='Detected from filename: '+(v||'vendor unknown')+' · '+(w||'warehouse unknown')+'. PDF/XLS text will not override vendor.';
  }
  function buildPrompt(){
    const vendor=currentVendor();
    const wh=currentWarehouse();
    const raw=rawText();
    const fname=fileName();
    const attach=isBinary();
    const force=($('gpt-vendor-ai-force-vendor')||{}).checked!==false;
    return [
      'You are normalizing a vendor peptide price list for PeptideGenius.',
      'Return ONLY CSV. No markdown, no commentary.',
      '',
      'CRITICAL VENDOR RULE:',
      force
        ? 'Use the vendor value below EXACTLY in the vendor column. Do not rename it based on text inside the file.'
        : 'Use the vendor value below unless the source clearly proves another vendor.',
      '',
      'Vendor: '+vendor,
      'Warehouse: '+wh,
      fname ? 'Source file name: '+fname : '',
      '',
      attach
        ? 'IMPORTANT: I am attaching/uploading the source file separately in this ChatGPT message. Use the attached file for product rows/prices, but keep the Vendor column exactly as specified above.'
        : 'The raw vendor price text is included below. Use it for product rows/prices, but keep the Vendor column exactly as specified above.',
      '',
      'TMP vendor price template:',
      template(),
      '',
      'Required CSV columns:',
      'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes',
      '',
      'Rules:',
      '- Warehouse must be US, China, or Unknown unless clearly specified.',
      '- If source text/file title contains another vendor-looking string, do NOT change the vendor column; mention the conflicting string in notes only if relevant.',
      '- Preserve combo products, strengths, kits, vial/package size, MOQ, and notes.',
      '- price_usd must be numeric USD only, no dollar sign.',
      '- currency is USD unless another currency is explicit.',
      '- If a price is ambiguous, leave price_usd blank and explain in notes.',
      '- Do not add commentary before or after the CSV.',
      '',
      attach
        ? 'RAW TEXT: [Use the attached PDF/XLS/XLSX file. Browser extraction from the local app may be incomplete.]'
        : 'RAW TEXT:\n'+(raw || '[Paste vendor price list here.]')
    ].filter(Boolean).join('\n');
  }
  function ensureModal(){
    let m=$('gpt-vendor-handoff-modal');
    if(m) return m;
    m=document.createElement('div');
    m.id='gpt-vendor-handoff-modal';
    m.style.cssText='position:fixed;inset:0;z-index:2147483001;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.58);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);padding:18px';
    m.innerHTML='<div style="width:min(880px,96vw);max-height:90vh;overflow:auto;border-radius:20px;background:#fff;border:1px solid rgba(203,213,225,.92);box-shadow:0 24px 76px rgba(15,23,42,.32);padding:16px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px"><div><b style="font-size:17px;color:#18385E">Vendor normalizer prompt ready</b><p id="gpt-vendor-handoff-note" style="margin:4px 0 0;font-size:12px;color:#5C738F;line-height:1.45"></p></div><button type="button" id="gpt-vendor-handoff-close" style="border:1px solid #DCE7F4;background:#fff;border-radius:10px;padding:6px 10px;font-weight:850;cursor:pointer;color:#3F5875">Close</button></div><div id="gpt-vendor-handoff-status" style="margin:8px 0 10px;padding:8px 10px;border-radius:13px;background:linear-gradient(135deg,#F8FBFE,#F2FBF8);border:1px solid #DCE7F4;color:#46617B;font-size:11.5px;line-height:1.35"></div><textarea id="gpt-vendor-handoff-text" style="width:100%;min-height:330px;box-sizing:border-box;border:1px solid #DCE7F4;border-radius:14px;padding:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.43;color:#263B55;background:#F8FBFE"></textarea><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" id="gpt-vendor-handoff-copy-open" style="border:1px solid #7FA9E8;border-radius:12px;padding:9px 13px;font-size:12px;font-weight:850;cursor:pointer;background:linear-gradient(135deg,#4B84EA,#5AB8B1);color:#fff">Copy prompt + open ChatGPT</button><button type="button" id="gpt-vendor-handoff-copy" style="border:1px solid #DCE7F4;border-radius:12px;padding:9px 13px;font-size:12px;font-weight:850;cursor:pointer;background:#fff;color:#42607D">Copy prompt</button><button type="button" id="gpt-vendor-handoff-select" style="border:1px solid #DCE7F4;border-radius:12px;padding:9px 13px;font-size:12px;font-weight:850;cursor:pointer;background:#fff;color:#42607D">Select text</button></div></div>';
    document.body.appendChild(m);
    $('gpt-vendor-handoff-close').onclick=()=>m.style.display='none';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'});
    $('gpt-vendor-handoff-copy').onclick=async()=>{const ok=await copyText(val('gpt-vendor-handoff-text')); toast(ok?'✓ Prompt copied':'Copy blocked — select text manually',ok?'':'amber')};
    $('gpt-vendor-handoff-copy-open').onclick=async()=>{const ok=await copyText(val('gpt-vendor-handoff-text')); try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(e){}; toast(ok?'✓ Prompt copied — paste into ChatGPT':'Manual copy needed',ok?'':'amber')};
    $('gpt-vendor-handoff-select').onclick=()=>{const ta=$('gpt-vendor-handoff-text'); if(ta){ta.focus();ta.select();}};
    return m;
  }
  async function openHandoff(){
    ensureControls();
    applyFilenameDetection(false);
    const prompt=buildPrompt();
    const m=ensureModal();
    const ta=$('gpt-vendor-handoff-text'); if(ta) ta.value=prompt;
    const note=$('gpt-vendor-handoff-note');
    if(note) note.textContent=isBinary()
      ? 'Prompt is locked to Vendor: '+currentVendor()+'. Open ChatGPT and upload the same file manually.'
      : 'Prompt is locked to Vendor: '+currentVendor()+'. Extracted/pasted text is included when available.';
    const st=$('gpt-vendor-handoff-status');
    if(st) st.innerHTML='<b style="color:#18385E">Status:</b> Vendor locked to <b>'+currentVendor()+'</b> · Warehouse <b>'+currentWarehouse()+'</b>.';
    m.style.display='flex';
    const ok=await copyText(prompt);
    toast(ok?'✓ Prompt copied with vendor locked':'Prompt ready — copy may be blocked',ok?'':'amber');
  }
  function install(){
    ensureControls();
    const file=$('gpt-vendor-ai-file');
    if(file && !file.dataset.v33310Bound){
      file.dataset.v33310Bound='1';
      file.addEventListener('change',()=>setTimeout(()=>applyFilenameDetection(true),70));
    }
    const det=$('gpt-vendor-ai-detect');
    if(det && !det.dataset.v33310Bound){
      det.dataset.v33310Bound='1';
      det.addEventListener('click',e=>{setTimeout(()=>applyFilenameDetection(true),20);},true);
    }
    const old=$('gpt-vendor-ai-ask');
    if(old && old.dataset.v33310Installed!=='1'){
      const btn=old.cloneNode(true);
      btn.id='gpt-vendor-ai-ask';
      btn.dataset.v33310Installed='1';
      btn.textContent='Ask GPT to normalize';
      btn.onclick=function(e){e.preventDefault();e.stopPropagation();openHandoff();};
      old.replaceWith(btn);
    }
  }
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="prices"]'))setTimeout(install,180)},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(install,500);setTimeout(install,1200)});
  else {setTimeout(install,500);setTimeout(install,1200);}
  window.tmpVendorOpenGPTNormalizerHandoff=openHandoff;
  window.tmpBuildVendorGPTFilePrompt=buildPrompt;
})();


// ===== extracted post-core patch script =====
(function(){
  if(__tmpVendorLogActive())return;
  /*
    v33.375-stable-vendor-post-import-review:
    Fixes Vendor Pricing Ask GPT after prior handlers conflicted.
    Uses WINDOW capture so it runs before older document-level click handlers.
    Restores:
      - prompt generation
      - clipboard copy
      - short-prompt ChatGPT prefill when safe
      - fallback modal
    Important: browser security still prevents automatically attaching a local PDF/XLS to ChatGPT.
  */
  const SAFE_Q = 5200;
  function $(id){ return document.getElementById(id); }
  function toast(a,b){ try{ window.tmpInventoryToast && tmpInventoryToast(a,b||''); }catch(_){} }
  async function copyText(t){ try{ await navigator.clipboard.writeText(t); return true; }catch(e){ return false; } }
  function fileInput(){ return $('gpt-vendor-ai-file'); }
  function fileObj(){ const f=fileInput(); return f && f.files && f.files[0] ? f.files[0] : null; }
  function fileName(){ const f=fileObj(); return (f && f.name) || ((fileInput()||{}).dataset||{}).fileName || ''; }
  function ext(n){ return String(n||'').split('.').pop().toLowerCase(); }
  function isAttachOnly(){ return ['pdf','xls','xlsx'].includes(ext(fileName())); }
  function val(id){ const el=$(id); return el ? (el.value || el.textContent || '') : ''; }
  function setVal(id,v){ const el=$(id); if(el) el.value=v; }
  function cleanVendor(name){
    let base=String(name||'').replace(/\.[^.]+$/,'').replace(/[_\-]+/g,' ').trim();
    base=base.replace(/\b(us|usa|u\.s\.|china|cn|intl|international|domestic|warehouse|wh|price|prices|pricelist|price list|list|sheet|vendor|peptide|peptides|pdf|xls|xlsx|csv|updated|new|final|copy)\b/ig,' ')
      .replace(/\b\d{4}[-_. ]?\d{0,2}[-_. ]?\d{0,2}\b/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    const first=base.split(/\s+/).filter(Boolean)[0] || '';
    return first && first.length <= 10 ? first.toUpperCase() : base.slice(0,40);
  }
  function whFromName(name){
    const t=String(name||'').toLowerCase();
    if(/\b(us|usa|u\.s\.|domestic|dom)\b/.test(t)) return 'US';
    if(/\b(china|cn|intl|international|overseas)\b/.test(t)) return 'China';
    return '';
  }
  function vendor(){
    return (val('gpt-vendor-ai-vendor') || cleanVendor(fileName()) || 'Unknown vendor').trim();
  }
  function warehouse(){
    return (val('gpt-vendor-ai-warehouse') || whFromName(fileName()) || 'Unknown').trim();
  }
  function template(){
    return (val('gpt-vendor-ai-template') || 'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes').trim();
  }
  function raw(){
    return val('gpt-vendor-ai-raw').trim();
  }
  function applyDetection(force){
    const fn=fileName();
    if(!fn) return;
    const v=cleanVendor(fn), w=whFromName(fn);
    const vi=$('gpt-vendor-ai-vendor'), wi=$('gpt-vendor-ai-warehouse');
    if(vi && v && (force || !vi.value || vi.dataset.userEdited !== '1')) vi.value=v;
    if(wi && w && (force || !wi.value)) wi.value=w;
    const st=$('gpt-vendor-ai-status');
    if(st) st.textContent='Detected from filename: '+(v||'vendor unknown')+' · '+(w||'warehouse unknown')+'. Vendor field is locked into the GPT prompt.';
  }
  function buildPrompt(){
    const fn=fileName();
    const attach=isAttachOnly();
    const rawText=raw();
    return [
      'You are normalizing a vendor peptide price list for PeptideGenius.',
      'Return ONLY CSV. No markdown, no commentary.',
      '',
      'CRITICAL VENDOR RULE:',
      'Use the Vendor value below EXACTLY in every vendor column. Do not rename it based on text inside the file.',
      '',
      'Vendor: '+vendor(),
      'Warehouse: '+warehouse(),
      fn ? 'Source file name: '+fn : '',
      '',
      attach
        ? 'IMPORTANT: I am attaching/uploading the source file separately in this ChatGPT message. Use the attached file for product rows/prices, but keep the Vendor column exactly as specified above.'
        : 'The raw vendor price text is included below. Use it for product rows/prices, but keep the Vendor column exactly as specified above.',
      '',
      'TMP vendor price template:',
      template(),
      '',
      'Required CSV columns:',
      'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes',
      '',
      'Rules:',
      '- Warehouse must be US, China, or Unknown unless clearly specified.',
      '- If source text/file title contains another vendor-looking string, do NOT change the vendor column; mention the conflicting string in notes only if relevant.',
      '- Preserve combo products, strengths, kits, vial/package size, MOQ, and notes.',
      '- price_usd must be numeric USD only, no dollar sign.',
      '- currency is USD unless another currency is explicit.',
      '- If a price is ambiguous, leave price_usd blank and explain in notes.',
      '- Do not add commentary before or after the CSV.',
      '',
      attach
        ? 'RAW TEXT: [Use the attached PDF/XLS/XLSX file. Browser extraction from the local app may be incomplete.]'
        : 'RAW TEXT:\n'+(rawText || '[Paste vendor price list here.]')
    ].filter(Boolean).join('\n');
  }
  function ensureModal(){
    let m=$('gpt-v33311-modal');
    if(m) return m;
    m=document.createElement('div');
    m.id='gpt-v33311-modal';
    m.innerHTML =
      '<div id="gpt-v33311-card">'+
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px">'+
          '<div><b style="font-size:17px;color:#18385E">Vendor normalizer prompt ready</b><p id="gpt-v33311-note" style="margin:4px 0 0;font-size:12px;color:#5C738F;line-height:1.45"></p></div>'+
          '<button type="button" id="gpt-v33311-close">Close</button>'+
        '</div>'+
        '<div id="gpt-v33311-status" style="margin:8px 0 10px;padding:8px 10px;border-radius:13px;background:linear-gradient(135deg,#F8FBFE,#F2FBF8);border:1px solid #DCE7F4;color:#46617B;font-size:11.5px;line-height:1.35"></div>'+
        '<textarea id="gpt-v33311-text"></textarea>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
          '<button type="button" class="primary" id="gpt-v33311-copy-open">Copy prompt + open ChatGPT</button>'+
          '<button type="button" id="gpt-v33311-copy">Copy prompt</button>'+
          '<button type="button" id="gpt-v33311-open-prefill">Open prefilled if short</button>'+
          '<button type="button" id="gpt-v33311-select">Select text</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(m);
    $('gpt-v33311-close').onclick=()=>m.style.display='none';
    m.addEventListener('click',e=>{ if(e.target===m)m.style.display='none'; });
    $('gpt-v33311-copy').onclick=async()=>{ const ok=await copyText(val('gpt-v33311-text')); toast(ok?'✓ Prompt copied':'Copy blocked — select text manually',ok?'':'amber'); };
    $('gpt-v33311-copy-open').onclick=async()=>{ const p=val('gpt-v33311-text'); const ok=await copyText(p); try{ window.open('https://chatgpt.com/','_blank','noopener,noreferrer'); }catch(e){} toast(ok?'✓ Prompt copied — paste into ChatGPT':'ChatGPT opened — manual copy needed',ok?'':'amber'); };
    $('gpt-v33311-open-prefill').onclick=()=>{ const p=val('gpt-v33311-text'); const enc=encodeURIComponent(p); if(enc.length<=SAFE_Q){ try{ window.open('https://chatgpt.com/?q='+enc,'_blank','noopener,noreferrer'); }catch(e){} } else { toast('Prompt too long for URL prefill','amber'); try{ window.open('https://chatgpt.com/','_blank','noopener,noreferrer'); }catch(e){} } };
    $('gpt-v33311-select').onclick=()=>{ const ta=$('gpt-v33311-text'); if(ta){ta.focus();ta.select();} };
    return m;
  }
  async function askVendorGPT(){
    applyDetection(false);
    const p=buildPrompt();
    const m=ensureModal();
    const ta=$('gpt-v33311-text'); if(ta) ta.value=p;
    const note=$('gpt-v33311-note');
    if(note) note.textContent=isAttachOnly()
      ? 'Prompt is generated and copied when allowed. You still need to upload/attach the selected file in ChatGPT; the browser cannot do that automatically.'
      : 'Prompt is generated from the pasted/extracted text and copied when allowed.';
    const st=$('gpt-v33311-status');
    if(st) st.innerHTML='<b style="color:#18385E">Vendor:</b> '+vendor()+' · <b style="color:#18385E">Warehouse:</b> '+warehouse()+(isAttachOnly()?' · <b style="color:#18385E">Attach file manually:</b> '+fileName():'');
    m.style.display='flex';
    const copied=await copyText(p);
    const enc=encodeURIComponent(p);
    if(enc.length <= SAFE_Q && !isAttachOnly()){
      try{ window.open('https://chatgpt.com/?q='+enc,'_blank','noopener,noreferrer'); }catch(e){}
      toast(copied?'✓ Prompt copied + GPT opened prefilled':'GPT opened prefilled; copy may be blocked',copied?'':'amber');
    }else{
      try{ window.open('https://chatgpt.com/','_blank','noopener,noreferrer'); }catch(e){}
      toast(copied?'✓ Prompt copied — paste into ChatGPT':'ChatGPT opened — manual copy needed',copied?'':'amber');
    }
  }
  function install(){
    const btn=$('gpt-vendor-ai-ask');
        let mount=btn;
    if(btn && btn.dataset.v33311Installed!=='1'){
      const clone=btn.cloneNode(true);
      clone.id='gpt-vendor-ai-ask';
      clone.dataset.v33311Installed='1';
      clone.classList.add('gpt-v33311-ask');
      clone.textContent='Ask GPT to normalize';
      clone.onclick=function(e){ e.preventDefault(); e.stopPropagation(); askVendorGPT(); };
      btn.replaceWith(clone);
      mount=clone;
    }
    const vi=$('gpt-vendor-ai-vendor');
    if(vi && !vi.dataset.v33311Bound){
      vi.dataset.v33311Bound='1';
      vi.addEventListener('input',()=>{vi.dataset.userEdited='1';});
    }
    const fi=fileInput();
    if(fi && !fi.dataset.v33311Bound){
      fi.dataset.v33311Bound='1';
      fi.addEventListener('change',()=>setTimeout(()=>applyDetection(true),80));
    }
    const det=$('gpt-vendor-ai-detect');
    if(det && !det.dataset.v33311Bound){
      det.dataset.v33311Bound='1';
      det.addEventListener('click',e=>setTimeout(()=>applyDetection(true),20),true);
    }
    if(btn && !$('gpt-v33311-vendor-help')){
      const help=document.createElement('div');
      help.id='gpt-v33311-vendor-help';
      help.style.cssText='margin-top:8px;padding:9px 11px;border-radius:13px;background:linear-gradient(135deg,#F8FBFE,#FFF8F1);border:1px solid #DCE7F4;color:#405A76;font-size:11.3px;line-height:1.45';
      help.innerHTML='<b style="color:#18385E">How this works:</b> CSV/text can be sent as copied prompt text. PDF/XLS/XLSX must be uploaded manually in ChatGPT after the prompt opens.';
      mount?.closest('.gpt-vendor-ai-file')?.insertAdjacentElement('afterend',help);
    }
  }
  // Critical: window-capture intercept runs before older document click handlers.
  window.addEventListener('click',function(e){
    const btn=e.target && e.target.closest && e.target.closest('#gpt-vendor-ai-ask');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    askVendorGPT();
  },true);
  document.addEventListener('click',e=>{ if(e.target&&e.target.closest&&e.target.closest('[data-pg="prices"]')) setTimeout(install,160); },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{setTimeout(install,500);setTimeout(install,1200);});
  else {setTimeout(install,500);setTimeout(install,1200);}
  window.tmpVendorAskGPT=askVendorGPT;
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  function k(name,time,di){return name+'/'+time+'/'+di}
  const KEY='tmp.stackBuilder.v1';
  const LANE_LABELS=Object.assign({},window.__tmpSbMealLanesPlain);
  const DAYS={
    daily:[0,1,2,3,4,5,6],
    weekdays:[0,1,2,3,4],
    eod:[0,2,4,6],
    twice:[0,3],
    three:[1,3,5],
    once:[0]
  };
  const ITEM_MAP={
    'Retatrutide / GLP lane':[{name:'Retatrutide',lane:'breakfast'}],
    'Tesamorelin / GH-recovery lane':[{name:'Tesamorelin',lane:'bedtime'}],
    'CJC + Ipamorelin / GH pulse lane':[{name:'CJC-1295 (no DAC)',lane:'bedtime'},{name:'Ipamorelin',lane:'bedtime'}],
    'BPC-157 + TB-500 / injury lane':[{name:'BPC-157',lane:'dinner'},{name:'TB-500',lane:'dinner'}],
    'AOD / optional fat-loss support':[{name:'AOD-9604',lane:'breakfast'}],
    'Vitamins / support stack':[{name:'Vitamins / support stack',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}],
    'TRT / oil protocol context':[{name:'Testosterone Cypionate',lane:'dinner',pattern:'twice'}],
    'Lab-guided monitoring':[]
  };
  const VIRTUAL_MAP={
    reta:[{name:'Retatrutide',lane:'breakfast'}],
    tirz:[{name:'Tirzepatide',lane:'breakfast'}],
    tesa:[{name:'Tesamorelin',lane:'bedtime'}],
    cjcipa:[{name:'CJC-1295 (no DAC)',lane:'bedtime'},{name:'Ipamorelin',lane:'bedtime'}],
    dsip:[{name:'DSIP',lane:'bedtime'}],
    'bpc-tb':[{name:'BPC-157',lane:'dinner'},{name:'TB-500',lane:'dinner'}],
    ghk:[{name:'GHK-Cu',lane:'dinner'}],
    aod:[{name:'AOD-9604',lane:'breakfast'}],
    protein:[{name:'Protein / muscle-retention support',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}],
    creatine:[{name:'Creatine',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}],
    omega3:[{name:'Omega-3',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}],
    vitd:[{name:'Vitamin D',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}]
  };
  const LANE_DEFAULTS={
    fat:[{name:'Retatrutide',lane:'breakfast'}],
    recovery:[{name:'BPC-157',lane:'dinner'},{name:'TB-500',lane:'dinner'}],
    sleep:[{name:'Tesamorelin',lane:'bedtime'}],
    muscle:[{name:'Creatine',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}],
    metabolic:[{name:'Omega-3',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}],
    simplicity:[]
  };
  function load(){try{return Object.assign({lanes:[],options:[],constraints:['evidence','clinician'],source:'inventory',virtual:[]},JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(_){return {lanes:[],options:[],constraints:['evidence','clinician'],source:'inventory',virtual:[]}}}
  function refFor(name){
    try{
      const refs=window.PEPTIDE_REF||PEPTIDE_REF||[];
      const n=String(name||'').toLowerCase();
      return refs.find(r=>String(r.n||'').toLowerCase()===n) || refs.find(r=>n.includes(String(r.n||'').toLowerCase())||String(r.n||'').toLowerCase().includes(n));
    }catch(_){return null}
  }
  function patternFromFreq(freq){
    const f=String(freq||'').toLowerCase();
    if(/5/.test(f)||/weekday/.test(f)) return 'weekdays';
    if(/3/.test(f)) return 'three';
    if(/2|twice/.test(f)) return 'twice';
    if(/once|weekly|1×|1x/.test(f)) return 'once';
    if(/every other|eod/.test(f)) return 'eod';
    return 'daily';
  }
  function uniqRows(rows){
    const seen=new Set(), out=[];
    rows.forEach(r=>{
      const key=String(r.name||'').toLowerCase();
      if(!key||seen.has(key))return;
      seen.add(key);out.push(r);
    });
    return out;
  }
  function candidates(){
    const st=load(); let rows=[];
    (st.options||[]).forEach(o=>{(ITEM_MAP[o]||[]).forEach(x=>rows.push(Object.assign({source:'builder option'},x)))});
    (st.virtual||[]).forEach(id=>{(VIRTUAL_MAP[id]||[]).forEach(x=>rows.push(Object.assign({source:'virtual candidate'},x)))});
    if(!rows.length)(st.lanes||[]).forEach(l=>{(LANE_DEFAULTS[l]||[]).forEach(x=>rows.push(Object.assign({source:'lane default'},x)))});
    rows=uniqRows(rows).map(r=>{
      const ref=refFor(r.name);
      let dose = r.dose!=null ? r.dose : (ref&&ref.startD!=null ? ref.startD : '');
      let unit = r.unit || (ref&&ref.unit) || 'mcg';
      let pattern = r.pattern || patternFromFreq(ref&&ref.freq);
      let lane = r.lane || (String(ref&&ref.timing||'').toLowerCase().includes('bed')?'bedtime':'lunch');
      return Object.assign({},r,{dose,unit,pattern,lane,ref});
    });
    return rows;
  }
  function ensureCard(){
    const root=$('pg-builder'); if(!root || $('gpt-sb-calendar-apply-card')) return;
    const side=root.querySelector('.gpt-sb-side') || root.querySelector('.gpt-sb-grid') || root;
    const card=document.createElement('article');
    card.id='gpt-sb-calendar-apply-card';
    card.className='gpt-sb-card';
    card.innerHTML='<div class="gpt-sb-cardhead"><b>Apply to Weekly Calendar</b><span>builder '+window.__tmpSbGlyphs.arrow+' schedule</span></div><div class="gpt-sb-mini-note">Build a reviewable weekly schedule from selected lanes/options. You can change the typical starting dose, unit, lane, and day pattern before applying.</div><div class="gpt-sb-calendar-mini"><div class="gpt-sb-cal-stat"><b id="gpt-sb-cal-count">0</b><span>items</span></div><div class="gpt-sb-cal-stat"><b>4</b><span>lanes</span></div><div class="gpt-sb-cal-stat"><b>'+window.__tmpSbGlyphs.check+'</b><span>dose prompt</span></div><div class="gpt-sb-cal-stat"><b>'+window.__tmpSbGlyphs.flow+'</b><span>calendar</span></div></div><div class="gpt-sb-calendar-actions"><button type="button" class="gpt-sb-btn primary" id="gpt-sb-preview-calendar">Build / apply calendar</button><button type="button" class="gpt-sb-btn" id="gpt-sb-open-calendar">Open Weekly Calendar</button></div>';
    side.insertBefore(card, side.firstChild);
    $('gpt-sb-preview-calendar').onclick=openModal;
    $('gpt-sb-open-calendar').onclick=function(){document.querySelector('[data-pg="calendar"]')?.click()};
    updateCard();
  }
  function updateCard(){
    const c=$('gpt-sb-cal-count'); if(c)c.textContent=candidates().length||0;
  }
  function ensureModal(){
    let m=$('gpt-sb-apply-modal'); if(m) return m;
    m=document.createElement('div'); m.id='gpt-sb-apply-modal';
    m.innerHTML='<div id="gpt-sb-apply-card"><div class="gpt-sb-apply-head"><div><b>Apply Stack Builder to Weekly Calendar</b><p>Review each item, confirm the typical starting dose, choose a lane and day pattern, then apply. This writes to the Weekly Calendar and updates Inventory items where needed.</p></div><button type="button" class="gpt-sb-apply-close" id="gpt-sb-apply-close">Close</button></div><div class="gpt-sb-apply-toolbar"><div><label>Apply mode</label><select id="gpt-sb-apply-mode"><option value="replace">Replace schedule for selected items</option><option value="add">Add to current schedule</option><option value="preview">Preview only</option></select></div><div><label>Default day pattern</label><select id="gpt-sb-default-pattern"><option value="">Use each item default</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="eod">Every other day</option><option value="three">3'+window.__tmpSbGlyphs.times+' weekly</option><option value="twice">2'+window.__tmpSbGlyphs.times+' weekly</option><option value="once">Once weekly</option></select></div><div><label>Safety note</label><input value="Dose fields are editable; this is planning only, not medical advice." readonly></div></div><div class="gpt-sb-apply-table-wrap"><table class="gpt-sb-apply-table"><thead><tr><th>Use</th><th>Item</th><th>Lane</th><th>Typical starting dose</th><th>Unit</th><th>Days</th><th>Source</th></tr></thead><tbody id="gpt-sb-apply-rows"></tbody></table></div><div class="gpt-sb-apply-actions"><button type="button" class="primary" id="gpt-sb-apply-confirm">Apply to Weekly Calendar</button><button type="button" id="gpt-sb-apply-copy">Copy plan</button><button type="button" id="gpt-sb-apply-open">Open calendar</button></div><div class="gpt-sb-apply-note"><b>How lanes map:</b> Breakfast and Lunch write to the AM schedule. Dinner and Bedtime write to the PM schedule. The selected lane is saved on the Inventory item so the 4-lane calendar can split AM/PM into breakfast/lunch/dinner/bedtime.</div></div>';
    document.body.appendChild(m);
    $('gpt-sb-apply-close').onclick=()=>m.style.display='none';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'});
    $('gpt-sb-apply-confirm').onclick=applyPlan;
    $('gpt-sb-apply-open').onclick=()=>{m.style.display='none';document.querySelector('[data-pg="calendar"]')?.click();};
    $('gpt-sb-apply-copy').onclick=async()=>{const txt=collectRows().map(r=>`${r.name} | ${r.lane} | ${r.dose}${r.unit} | ${r.pattern}`).join('\\n');try{await navigator.clipboard.writeText(txt);toast(window.__tmpSbGlyphs.check+' Calendar plan copied')}catch(_){alert(txt)}};
    $('gpt-sb-default-pattern').onchange=()=>{const v=$('gpt-sb-default-pattern').value;if(!v)return;document.querySelectorAll('#gpt-sb-apply-rows [data-field="pattern"]').forEach(s=>s.value=v)};
    return m;
  }
  function renderRows(){
    const body=$('gpt-sb-apply-rows'); if(!body)return;
    const rows=candidates();
    body.innerHTML=rows.length?rows.map((r,i)=>'<tr data-i="'+i+'"><td><input type="checkbox" data-field="use" checked></td><td><input type="text" data-field="name" value="'+esc(r.name)+'"></td><td><select data-field="lane">'+Object.keys(LANE_LABELS).map(k=>'<option value="'+k+'" '+(r.lane===k?'selected':'')+'>'+LANE_LABELS[k]+'</option>').join('')+'</select></td><td><input type="number" data-field="dose" step="any" min="0" value="'+esc(r.dose)+'"></td><td><select data-field="unit">'+['mcg','mg','iu','ml','pill'].map(u=>'<option '+(String(r.unit).toLowerCase()===u?'selected':'')+'>'+u+'</option>').join('')+'</select></td><td><select data-field="pattern">'+[['daily','Daily'],['weekdays','Weekdays'],['eod','Every other day'],['three','3× weekly'],['twice','2× weekly'],['once','Once weekly']].map(p=>'<option value="'+p[0]+'" '+(r.pattern===p[0]?'selected':'')+'>'+p[1]+'</option>').join('')+'</select></td><td><span class="gpt-sb-lane-chip">'+esc(r.source||'builder')+'</span></td></tr>').join(''):'<tr><td colspan="7" style="text-align:center;color:#6B7D92;padding:18px">Choose Stack Builder lanes/options first, or select virtual candidates.</td></tr>';
  }
  function openModal(){
    ensureModal();
    renderRows();
    $('gpt-sb-apply-modal').style.display='flex';
  }
  function collectRows(){
    const out=[];
    document.querySelectorAll('#gpt-sb-apply-rows tr').forEach(tr=>{
      const q=f=>tr.querySelector('[data-field="'+f+'"]');
      if(!q('use')||!q('use').checked)return;
      const name=(q('name').value||'').trim(); if(!name)return;
      out.push({name,lane:q('lane').value,dose:parseFloat(q('dose').value)||0,unit:q('unit').value,pattern:q('pattern').value});
    });
    return out;
  }
  function laneTime(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function daysFor(pattern){return DAYS[pattern]||DAYS.daily}
  function clearItem(name){
    if(!window.S||!S.sched)return;
    Object.keys(S.sched).forEach(key=>{if(key.indexOf(name+'/')===0)delete S.sched[key]});
  }
  function upsertItem(row){
    if(!window.S)return null;
    S.inv=S.inv||[]; S.sched=S.sched||{};
    let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===row.name.toLowerCase()&&!i.isSupply);
    if(!it){
      it={id:S.nI++,name:row.name,fz:0,fr:0,dk:0,nd:0,dose:row.dose,doseUnit:row.unit,cn:'',us:'',cat:row.name,days:[],isPeptide:row.unit==='pill'?false:true};
      S.inv.push(it);
    }
    it.dose=row.dose; it.doseUnit=row.unit; it.stackLane=row.lane; it.days=daysFor(row.pattern).slice();
    return it;
  }
  function applyPlan(){
    const mode=$('gpt-sb-apply-mode').value;
    const rows=collectRows();
    if(!rows.length){toast('No calendar rows selected','amber');return}
    if(mode==='preview'){toast('Preview only — nothing applied','amber');return}
    rows.forEach(row=>{
      const it=upsertItem(row);
      if(!it)return;
      try{ if(window.tmpCalClearGuard) tmpCalClearGuard.allowSchedNames(it.name); }catch(_){}
      if(mode==='replace') clearItem(it.name);
      const time=laneTime(row.lane);
      daysFor(row.pattern).forEach(di=>{S.sched[k(it.name,time,di)]=true;});
    });
    try{window.save&&window.save()}catch(_){}
    try{window.renderStack&&window.renderStack();window.renderCal&&window.renderCal();window.renderInventoryPage&&window.renderInventoryPage()}catch(_){}
    toast(window.__tmpSbGlyphs.check+' Weekly Calendar updated',rows.length+' item'+(rows.length===1?'':'s')+' applied from Stack Builder');
    $('gpt-sb-apply-modal').style.display='none';
    document.querySelector('[data-pg="calendar"]')?.click();
  }
  function boot(){
    ensureCard(); updateCard();
  }
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(boot,160)},true);
  document.addEventListener('change',e=>{if(e.target&&e.target.closest&&e.target.closest('#pg-builder'))setTimeout(updateCard,120)},true);
  const oldRender=window.renderStackBuilder;
  if(typeof oldRender==='function'&&!oldRender.__applyCalendarWrapped){
    window.renderStackBuilder=function(){const r=oldRender.apply(this,arguments);setTimeout(boot,80);return r};
    window.renderStackBuilder.__applyCalendarWrapped=true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600)); else setTimeout(boot,600);
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function countBuilderItems(){
    try{
      const st=Object.assign({lanes:[],options:[],virtual:[]},JSON.parse(localStorage.getItem('tmp.stackBuilder.v1')||'{}'));
      let n=(st.options||[]).length+(st.virtual||[]).length;
      if(!n)n=(st.lanes||[]).length;
      return n||0;
    }catch(_){return 0}
  }
  function inject(){
    const root=$('pg-builder');
    if(!root || $('gpt-sb-apply-calendar-obvious')) return;
    const hero=root.querySelector('.gpt-sb-hero') || root.firstElementChild;
    const box=document.createElement('section');
    box.id='gpt-sb-apply-calendar-obvious';
    box.innerHTML=
      '<div class="gpt314-head">'+
        '<div><div class="gpt314-k">Next step</div><div class="gpt314-title">Apply this stack to the Weekly Calendar</div><div class="gpt314-sub">Review the builder draft, confirm typical starting doses, choose Breakfast / Lunch / Dinner / Bedtime lanes, then push the plan into the Weekly Calendar.</div></div>'+
        '<div class="gpt314-actions"><button type="button" class="primary" id="gpt314-build-apply">Build / apply calendar</button><button type="button" id="gpt314-open-calendar">Open Weekly Calendar</button></div>'+
      '</div>'+
      '<div class="gpt314-stats"><div class="gpt314-stat"><b id="gpt314-items">'+countBuilderItems()+'</b><span>draft items</span></div><div class="gpt314-stat"><b>4</b><span>calendar lanes</span></div><div class="gpt314-stat"><b>'+window.__tmpSbGlyphs.check+'</b><span>dose prompt</span></div><div class="gpt314-stat"><b>'+window.__tmpSbGlyphs.flow+'</b><span>push schedule</span></div></div>';
    if(hero && hero.parentNode) hero.parentNode.insertBefore(box, hero.nextSibling);
    else root.insertBefore(box, root.firstChild);
    $('gpt314-build-apply').onclick=function(){
      const existing=$('gpt-sb-preview-calendar');
      if(existing){ existing.click(); return; }
      if(window.tmpOpenStackBuilderApplyCalendar){ window.tmpOpenStackBuilderApplyCalendar(); return; }
      alert('Apply Calendar module is still loading. Click Stack Builder again or reload this file.');
    };
    $('gpt314-open-calendar').onclick=function(){document.querySelector('[data-pg="calendar"]')?.click()};
  }
  function refresh(){const el=$('gpt314-items'); if(el)el.textContent=countBuilderItems();}
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(()=>{inject();refresh();},160)},true);
  document.addEventListener('change',e=>{if(e.target&&e.target.closest&&e.target.closest('#pg-builder'))setTimeout(refresh,120)},true);
  const old=window.renderStackBuilder;
  if(typeof old==='function'&&!old.__gpt314Wrapped){
    window.renderStackBuilder=function(){const r=old.apply(this,arguments);setTimeout(()=>{inject();refresh();},80);return r};
    window.renderStackBuilder.__gpt314Wrapped=true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,650)); else setTimeout(inject,650);
})();


// ===== extracted post-core patch script =====
(function(){
  // If the prior v33.375-stable-vendor-post-import-review module created its hidden modal/card, use its preview button.
  window.tmpOpenStackBuilderApplyCalendar = function(){
    var b=document.getElementById('gpt-sb-preview-calendar');
    if(b){b.click();return true;}
    return false;
  };
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  function k(name,time,di){return name+'/'+time+'/'+di}
  const KEY='tmp.stackBuilder.v1';
  const LANE_LABELS=Object.assign({},window.__tmpSbMealLanesPlain);
  const DAYS={daily:[0,1,2,3,4,5,6],weekdays:[0,1,2,3,4],eod:[0,2,4,6],twice:[0,3],three:[1,3,5],once:[0]};
  const ITEM_MAP={
    'Retatrutide / GLP lane':[{name:'Retatrutide',lane:'breakfast'}],
    'Tesamorelin / GH-recovery lane':[{name:'Tesamorelin',lane:'bedtime'}],
    'CJC + Ipamorelin / GH pulse lane':[{name:'CJC-1295 (no DAC)',lane:'bedtime'},{name:'Ipamorelin',lane:'bedtime'}],
    'BPC-157 + TB-500 / injury lane':[{name:'BPC-157',lane:'dinner'},{name:'TB-500',lane:'dinner'}],
    'AOD / optional fat-loss support':[{name:'AOD-9604',lane:'breakfast'}],
    'Vitamins / support stack':[{name:'Vitamins / support stack',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}],
    'TRT / oil protocol context':[{name:'Testosterone Cypionate',lane:'dinner',pattern:'twice'}]
  };
  const LANE_DEFAULTS={
    fat:[{name:'Retatrutide',lane:'breakfast'}],
    recovery:[{name:'BPC-157',lane:'dinner'},{name:'TB-500',lane:'dinner'}],
    sleep:[{name:'Tesamorelin',lane:'bedtime'}],
    muscle:[{name:'Creatine',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}],
    metabolic:[{name:'Omega-3',lane:'lunch',dose:1,unit:'pill',pattern:'daily',nonPeptide:true}],
    simplicity:[]
  };
  function load(){try{return Object.assign({lanes:[],options:[],constraints:['evidence','clinician'],source:'inventory',virtual:[]},JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(_){return {lanes:[],options:[],constraints:['evidence','clinician'],source:'inventory',virtual:[]}}}
  function refFor(name){try{const refs=window.PEPTIDE_REF||PEPTIDE_REF||[];const n=String(name||'').toLowerCase();return refs.find(r=>String(r.n||'').toLowerCase()===n)||refs.find(r=>n.includes(String(r.n||'').toLowerCase())||String(r.n||'').toLowerCase().includes(n));}catch(_){return null}}
  function patternFromFreq(freq){const f=String(freq||'').toLowerCase();if(/5/.test(f)||/weekday/.test(f))return'weekdays';if(/3/.test(f))return'three';if(/2|twice/.test(f))return'twice';if(/once|weekly|1×|1x/.test(f))return'once';if(/every other|eod/.test(f))return'eod';return'daily'}
  function uniqRows(rows){const seen=new Set(),out=[];rows.forEach(r=>{const key=String(r.name||'').toLowerCase();if(!key||seen.has(key))return;seen.add(key);out.push(r)});return out}
  function candidates(){
    const st=load(); let rows=[];
    (st.options||[]).forEach(o=>(ITEM_MAP[o]||[]).forEach(x=>rows.push(Object.assign({source:'builder option'},x))));
    if(!rows.length)(st.lanes||[]).forEach(l=>(LANE_DEFAULTS[l]||[]).forEach(x=>rows.push(Object.assign({source:'lane default'},x))));
    return uniqRows(rows).map(r=>{const ref=refFor(r.name);return Object.assign({},r,{dose:r.dose!=null?r.dose:(ref&&ref.startD!=null?ref.startD:''),unit:r.unit||(ref&&ref.unit)||'mcg',pattern:r.pattern||patternFromFreq(ref&&ref.freq),lane:r.lane||'lunch',ref})});
  }
  function updateCount(){const el=$('gpt315-draft-count'); if(el)el.textContent=candidates().length||0}
  function ensureModal(){
    let m=$('gpt-sb-apply-modal'); if(m)return m;
    m=document.createElement('div');m.id='gpt-sb-apply-modal';
    m.innerHTML='<div id="gpt-sb-apply-card"><div class="gpt-sb-apply-head"><div><b>Apply Stack Builder to Weekly Calendar</b><p>Review each item, confirm the typical starting dose, choose a lane and day pattern, then apply. This writes to the Weekly Calendar and updates Inventory items where needed.</p></div><button type="button" class="gpt-sb-apply-close" id="gpt-sb-apply-close">Close</button></div><div class="gpt-sb-apply-toolbar"><div><label>Apply mode</label><select id="gpt-sb-apply-mode"><option value="replace">Replace schedule for selected items</option><option value="add">Add to current schedule</option><option value="preview">Preview only</option></select></div><div><label>Default day pattern</label><select id="gpt-sb-default-pattern"><option value="">Use each item default</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="eod">Every other day</option><option value="three">3× weekly</option><option value="twice">2× weekly</option><option value="once">Once weekly</option></select></div><div><label>Safety note</label><input value="Dose fields are editable; this is planning only, not medical advice." readonly></div></div><div class="gpt-sb-apply-table-wrap"><table class="gpt-sb-apply-table"><thead><tr><th>Use</th><th>Item</th><th>Lane</th><th>Typical starting dose</th><th>Unit</th><th>Days</th><th>Source</th></tr></thead><tbody id="gpt-sb-apply-rows"></tbody></table></div><div class="gpt-sb-apply-actions"><button type="button" class="primary" id="gpt-sb-apply-confirm">Apply to Weekly Calendar</button><button type="button" id="gpt-sb-apply-open">Open calendar</button></div><div class="gpt-sb-apply-note"><b>How lanes map:</b> Breakfast and Lunch write to the AM schedule. Dinner and Bedtime write to the PM schedule. The selected lane is saved on the Inventory item so the 4-lane calendar can split AM/PM into breakfast/lunch/dinner/bedtime.</div></div>';
    document.body.appendChild(m); $('gpt-sb-apply-close').onclick=()=>m.style.display='none'; m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'}); $('gpt-sb-apply-confirm').onclick=applyPlan; $('gpt-sb-apply-open').onclick=()=>{m.style.display='none';document.querySelector('[data-pg="calendar"]')?.click()}; $('gpt-sb-default-pattern').onchange=()=>{const v=$('gpt-sb-default-pattern').value;if(!v)return;document.querySelectorAll('#gpt-sb-apply-rows [data-field="pattern"]').forEach(s=>s.value=v)};
    return m;
  }
  function renderRows(){const body=$('gpt-sb-apply-rows');if(!body)return;const rows=candidates();body.innerHTML=rows.length?rows.map((r,i)=>'<tr data-i="'+i+'"><td><input type="checkbox" data-field="use" checked></td><td><input type="text" data-field="name" value="'+esc(r.name)+'"></td><td><select data-field="lane">'+Object.keys(LANE_LABELS).map(k=>'<option value="'+k+'" '+(r.lane===k?'selected':'')+'>'+LANE_LABELS[k]+'</option>').join('')+'</select></td><td><input type="number" data-field="dose" step="any" min="0" value="'+esc(r.dose)+'"></td><td><select data-field="unit">'+['mcg','mg','iu','ml','pill'].map(u=>'<option '+(String(r.unit).toLowerCase()===u?'selected':'')+'>'+u+'</option>').join('')+'</select></td><td><select data-field="pattern">'+[['daily','Daily'],['weekdays','Weekdays'],['eod','Every other day'],['three','3× weekly'],['twice','2× weekly'],['once','Once weekly']].map(p=>'<option value="'+p[0]+'" '+(r.pattern===p[0]?'selected':'')+'>'+p[1]+'</option>').join('')+'</select></td><td><span class="gpt-sb-lane-chip">'+esc(r.source||'builder')+'</span></td></tr>').join(''):'<tr><td colspan="7" style="text-align:center;color:#6B7D92;padding:18px">Choose Stack Builder lanes/options first.</td></tr>'}
  function openModal(){ensureModal();renderRows();$('gpt-sb-apply-modal').style.display='flex'}
  function collectRows(){const out=[];document.querySelectorAll('#gpt-sb-apply-rows tr').forEach(tr=>{const q=f=>tr.querySelector('[data-field="'+f+'"]');if(!q('use')||!q('use').checked)return;const name=(q('name').value||'').trim();if(!name)return;out.push({name,lane:q('lane').value,dose:parseFloat(q('dose').value)||0,unit:q('unit').value,pattern:q('pattern').value})});return out}
  function laneTime(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function daysFor(pattern){return {daily:[0,1,2,3,4,5,6],weekdays:[0,1,2,3,4],eod:[0,2,4,6],twice:[0,3],three:[1,3,5],once:[0]}[pattern]||[0,1,2,3,4,5,6]}
  function clearItem(name){if(!window.S||!S.sched)return;Object.keys(S.sched).forEach(key=>{if(key.indexOf(name+'/')===0)delete S.sched[key]})}
  function upsertItem(row){if(!window.S)return null;S.inv=S.inv||[];S.sched=S.sched||{};let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===row.name.toLowerCase()&&!i.isSupply);if(!it){it={id:S.nI++,name:row.name,fz:0,fr:0,dk:0,nd:0,dose:row.dose,doseUnit:row.unit,cn:'',us:'',cat:row.name,days:[],isPeptide:row.unit==='pill'?false:true};S.inv.push(it)}it.dose=row.dose;it.doseUnit=row.unit;it.stackLane=row.lane;it.days=daysFor(row.pattern).slice();return it}
  function applyPlan(){const mode=$('gpt-sb-apply-mode').value;const rows=collectRows();if(!rows.length){toast('No calendar rows selected','amber');return}if(mode==='preview'){toast('Preview only — nothing applied','amber');return}rows.forEach(row=>{const it=upsertItem(row);if(!it)return;try{ if(window.tmpCalClearGuard) tmpCalClearGuard.allowSchedNames(it.name); }catch(_){}if(mode==='replace')clearItem(it.name);const time=laneTime(row.lane);daysFor(row.pattern).forEach(di=>{S.sched[k(it.name,time,di)]=true})});try{window.save&&window.save()}catch(_){};try{window.renderStack&&window.renderStack();window.renderCal&&window.renderCal();window.renderInventoryPage&&window.renderInventoryPage()}catch(_){};toast('✓ Weekly Calendar updated',rows.length+' item'+(rows.length===1?'':'s')+' applied from Stack Builder');$('gpt-sb-apply-modal').style.display='none';document.querySelector('[data-pg="calendar"]')?.click()}
  document.addEventListener('click',e=>{if(e.target&&e.target.id==='gpt315-open-apply-calendar')openModal();if(e.target&&e.target.id==='gpt315-open-weekly-calendar')document.querySelector('[data-pg="calendar"]')?.click()},true);
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(updateCount,160)},true);
  document.addEventListener('change',e=>{if(e.target&&e.target.closest&&e.target.closest('#pg-builder'))setTimeout(updateCount,120)},true);
  const old=window.renderStackBuilder;if(typeof old==='function'&&!old.__gpt315CountWrapped){window.renderStackBuilder=function(){const r=old.apply(this,arguments);setTimeout(updateCount,80);return r};window.renderStackBuilder.__gpt315CountWrapped=true}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(updateCount,650)); else setTimeout(updateCount,650);
})();


// ===== extracted post-core patch script =====
(function(){
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  function sk(name,time,di){return name+'/'+time+'/'+di}
  // Verify after Stack Builder applies: if schedule keys were written, force-render calendar again.
  document.addEventListener('click',function(e){
    if(e.target && e.target.id === 'gpt-sb-apply-confirm'){
      setTimeout(function(){
        try{
          var count = Object.keys((window.S&&S.sched)||{}).filter(function(k){return S.sched[k];}).length;
          if(typeof window.save === 'function') window.save();
          if(typeof window.renderCal === 'function') window.renderCal();
          if(typeof window.renderStack === 'function') window.renderStack();
          toast('Calendar schedule saved', count + ' scheduled cell' + (count===1?'':'s') + ' now stored.');
        }catch(_){}
      },350);
    }
  },true);
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  const KEY='tmp.stackBuilder.v1';
  const DAYS={daily:[0,1,2,3,4,5,6],weekdays:[0,1,2,3,4],eod:[0,2,4,6],twice:[0,3],three:[1,3,5],once:[0]};
  const LANE_LABELS=Object.assign({},window.__tmpSbMealLanesPlain);
  const MAP=[
    {match:/reta|retatrutide|glp/i, rows:[{name:'Retatrutide',lane:'breakfast'}]},
    {match:/tirz|tirzepatide/i, rows:[{name:'Tirzepatide',lane:'breakfast'}]},
    {match:/tesa|tesamorelin/i, rows:[{name:'Tesamorelin',lane:'bedtime'}]},
    {match:/cjc.*ipa|ipamorelin|gh pulse/i, rows:[{name:'CJC-1295 (no DAC)',lane:'bedtime'},{name:'Ipamorelin',lane:'bedtime'}]},
    {match:/bpc|tb-?500|injury/i, rows:[{name:'BPC-157',lane:'dinner'},{name:'TB-500',lane:'dinner'}]},
    {match:/aod/i, rows:[{name:'AOD-9604',lane:'breakfast'}]},
    {match:/trt|testosterone/i, rows:[{name:'Testosterone Cypionate',lane:'dinner',pattern:'twice'}]},
    {match:/vitamin|support stack/i, rows:[{name:'Vitamins / support stack',lane:'lunch',dose:1,unit:'pill',pattern:'daily'}]},
    {match:/protein|muscle/i, rows:[{name:'Protein / muscle-retention support',lane:'lunch',dose:1,unit:'pill',pattern:'daily'}]},
    {match:/metabolic|omega|lipid/i, rows:[{name:'Omega-3',lane:'lunch',dose:1,unit:'pill',pattern:'daily'}]}
  ];
  function load(){
    try{return Object.assign({lanes:[],options:[],virtual:[],constraints:[]},JSON.parse(localStorage.getItem(KEY)||'{}'))}
    catch(_){return {lanes:[],options:[],virtual:[],constraints:[]}}
  }
  function refFor(name){
    try{
      const refs=window.PEPTIDE_REF||PEPTIDE_REF||[];
      const n=String(name||'').toLowerCase();
      return refs.find(r=>String(r.n||'').toLowerCase()===n) || refs.find(r=>n && (n.includes(String(r.n||'').toLowerCase()) || String(r.n||'').toLowerCase().includes(n)));
    }catch(_){return null}
  }
  function patternFromFreq(freq){
    const f=String(freq||'').toLowerCase();
    if(/5|weekday/.test(f))return'weekdays';
    if(/3/.test(f))return'three';
    if(/2|twice/.test(f))return'twice';
    if(/once|weekly|1×|1x/.test(f))return'once';
    if(/every other|eod/.test(f))return'eod';
    return'daily';
  }
  function rowsFromText(txt,source){
    let out=[]; MAP.forEach(m=>{ if(m.match.test(txt||'')) m.rows.forEach(r=>out.push(Object.assign({source},r))); });
    return out;
  }
  function candidates(){
    const st=load(); let rows=[];
    (st.options||[]).forEach(o=>rows.push(...rowsFromText(o,'builder option')));
    (st.virtual||[]).forEach(v=>rows.push(...rowsFromText(v,'virtual candidate')));
    if(!rows.length)(st.lanes||[]).forEach(l=>rows.push(...rowsFromText(l,'lane default')));
    // fallback directly from visible selected option labels if localStorage is stale
    if(!rows.length){
      document.querySelectorAll('#pg-builder [data-sb-option]:checked').forEach(cb=>rows.push(...rowsFromText(cb.dataset.sbOption||'', 'visible option')));
      document.querySelectorAll('#pg-builder .gpt-sb-lane.on').forEach(btn=>rows.push(...rowsFromText(btn.textContent||'', 'visible lane')));
    }
    // final fallback: use inventory items if nothing else exists
    if(!rows.length){
      try{(S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).slice(0,8).forEach(i=>rows.push({name:i.name,lane:i.stackLane||'dinner',source:'inventory'}));}catch(_){}
    }
    const seen=new Set();
    return rows.filter(r=>{const k=String(r.name||'').toLowerCase(); if(!k||seen.has(k))return false; seen.add(k); return true;})
      .map(r=>{const ref=refFor(r.name); return Object.assign({},r,{dose:r.dose!=null?r.dose:(ref&&ref.startD!=null?ref.startD:''),unit:r.unit||(ref&&ref.unit)||'mcg',pattern:r.pattern||patternFromFreq(ref&&ref.freq),lane:r.lane||'dinner'});});
  }
  function ensureModal(){
    let m=$('gpt317-apply-modal'); if(m)return m;
    m=document.createElement('div'); m.id='gpt317-apply-modal';
    m.innerHTML='<div id="gpt317-apply-card"><div class="head"><div><b>Apply Stack Builder to Weekly Calendar</b><p>Review each item, confirm the typical starting dose, choose a lane and day pattern, then apply. This writes directly into the same schedule object the Weekly Calendar reads.</p></div><button type="button" id="gpt317-close">Close</button></div><div id="gpt317-toolbar"><div><label>Apply mode</label><select id="gpt317-mode"><option value="replace">Replace schedule for selected items</option><option value="add">Add to current schedule</option><option value="preview">Preview only</option></select></div><div><label>Default day pattern</label><select id="gpt317-default-pattern"><option value="">Use each item default</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="eod">Every other day</option><option value="three">3× weekly</option><option value="twice">2× weekly</option><option value="once">Once weekly</option></select></div><div><label>Status</label><input id="gpt317-status" value="Ready to review. Dose fields are editable." readonly></div></div><div id="gpt317-table-wrap"><table id="gpt317-table"><thead><tr><th>Use</th><th>Item</th><th>Lane</th><th>Typical starting dose</th><th>Unit</th><th>Days</th><th>Source</th></tr></thead><tbody id="gpt317-rows"></tbody></table></div><div id="gpt317-actions"><button type="button" class="primary" id="gpt317-apply">Apply to Weekly Calendar</button><button type="button" id="gpt317-open-cal">Open calendar</button><button type="button" id="gpt317-copy">Copy plan</button></div><div id="gpt317-note"><b>Lane mapping:</b> Breakfast/Lunch store as AM internally; Dinner/Bedtime store as PM internally. The exact meal lane is saved on the Inventory item as <code>stackLane</code>, so the 4-lane calendar displays it correctly.</div></div>';
    document.body.appendChild(m);
    $('gpt317-close').onclick=()=>m.style.display='none';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'});
    $('gpt317-open-cal').onclick=()=>{m.style.display='none';document.querySelector('[data-pg="calendar"]')?.click()};
    $('gpt317-apply').onclick=apply;
    $('gpt317-copy').onclick=async()=>{const txt=collect().map(r=>`${r.name} | ${r.lane} | ${r.dose}${r.unit} | ${r.pattern}`).join('\\n');try{await navigator.clipboard.writeText(txt);toast('✓ Calendar plan copied')}catch(_){alert(txt)}};
    $('gpt317-default-pattern').onchange=()=>{const v=$('gpt317-default-pattern').value;if(v)document.querySelectorAll('#gpt317-rows [data-f="pattern"]').forEach(s=>s.value=v)};
    return m;
  }
  function renderRows(){
    const body=$('gpt317-rows'); if(!body)return;
    const rows=candidates();
    body.innerHTML=rows.length?rows.map((r,i)=>'<tr><td><input type="checkbox" data-f="use" checked></td><td><input type="text" data-f="name" value="'+esc(r.name)+'"></td><td><select data-f="lane">'+Object.keys(LANE_LABELS).map(k=>'<option value="'+k+'" '+(r.lane===k?'selected':'')+'>'+LANE_LABELS[k]+'</option>').join('')+'</select></td><td><input type="number" data-f="dose" step="any" min="0" value="'+esc(r.dose)+'"></td><td><select data-f="unit">'+['mcg','mg','iu','ml','pill'].map(u=>'<option '+(String(r.unit).toLowerCase()===u?'selected':'')+'>'+u+'</option>').join('')+'</select></td><td><select data-f="pattern">'+[['daily','Daily'],['weekdays','Weekdays'],['eod','Every other day'],['three','3× weekly'],['twice','2× weekly'],['once','Once weekly']].map(p=>'<option value="'+p[0]+'" '+(r.pattern===p[0]?'selected':'')+'>'+p[1]+'</option>').join('')+'</select></td><td><span class="gpt317-chip">'+esc(r.source||'builder')+'</span></td></tr>').join(''):'<tr><td colspan="7" style="text-align:center;color:#6B7D92;padding:18px">No candidates found. Select builder lanes/options first, or add items to Inventory.</td></tr>';
    const st=$('gpt317-status'); if(st)st.value=rows.length?rows.length+' draft item(s) ready.':'No draft items found.';
  }
  function open(){ensureModal();renderRows();$('gpt317-apply-modal').style.display='flex'}
  function collect(){
    const out=[]; document.querySelectorAll('#gpt317-rows tr').forEach(tr=>{
      const q=f=>tr.querySelector('[data-f="'+f+'"]');
      if(!q('use')||!q('use').checked)return;
      const name=(q('name').value||'').trim(); if(!name)return;
      out.push({name,lane:q('lane').value,dose:parseFloat(q('dose').value)||0,unit:q('unit').value,pattern:q('pattern').value});
    }); return out;
  }
  function daysFor(p){return DAYS[p]||DAYS.daily}
  function timeFor(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function scheduleKey(n,t,d){return n+'/'+t+'/'+d}
  function clearItem(name){Object.keys(S.sched||{}).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]})}
  function upsert(row){
    S.inv=S.inv||[];S.sched=S.sched||{};
    let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===row.name.toLowerCase()&&!i.isSupply);
    if(!it){it={id:S.nI++,name:row.name,fz:0,fr:0,dk:0,nd:0,dose:row.dose,doseUnit:row.unit,cn:'',us:'',cat:row.name,days:[],isPeptide:row.unit==='pill'?false:true};S.inv.push(it)}
    it.dose=row.dose; it.doseUnit=row.unit; it.stackLane=row.lane; it.days=daysFor(row.pattern).slice();
    return it;
  }
  function apply(){
    const rows=collect(); const mode=$('gpt317-mode').value;
    if(!rows.length){toast('No calendar rows selected','amber');return}
    if(mode==='preview'){toast('Preview only — nothing applied','amber');return}
    rows.forEach(r=>{
      const it=upsert(r); if(!it)return;
      if(mode==='replace')clearItem(it.name);
      const t=timeFor(r.lane);
      daysFor(r.pattern).forEach(di=>{S.sched[scheduleKey(it.name,t,di)]=true});
    });
    try{window.save&&window.save()}catch(_){}
    // Confirm in localStorage too
    try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    try{window.renderCal&&window.renderCal();window.renderStack&&window.renderStack();window.renderInventoryPage&&window.renderInventoryPage()}catch(_){}
    const stored=Object.keys(S.sched||{}).filter(k=>S.sched[k]).length;
    toast('✓ Weekly Calendar updated',stored+' scheduled cells stored.');
    $('gpt317-apply-modal').style.display='none';
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal()}catch(_){}},120);
  }
  // Capture the visible buttons and bypass older broken handlers.
  document.addEventListener('click',function(e){
    if(e.target&&e.target.id==='gpt315-open-apply-calendar'){e.preventDefault();e.stopPropagation();open();return}
    if(e.target&&e.target.id==='gpt314-build-apply'){e.preventDefault();e.stopPropagation();open();return}
    if(e.target&&e.target.id==='gpt-sb-preview-calendar'){e.preventDefault();e.stopPropagation();open();return}
  },true);
  window.tmpOpenStackBuilderApplyCalendar=open;
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  const KEY='tmp.stackBuilder.v1';
  const DAYS={daily:[0,1,2,3,4,5,6],weekdays:[0,1,2,3,4],eod:[0,2,4,6],twice:[0,3],three:[1,3,5],once:[0]};
  const LANE_LABELS=Object.assign({},window.__tmpSbMealLanesPlain);

  function readState(){
    let st={lanes:[],options:[],virtual:[]};
    try{st=Object.assign(st,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(_){}
    // Also read visible UI directly, because prior versions sometimes failed to persist state.
    document.querySelectorAll('#pg-builder .gpt-sb-lane.on,[data-sb-lane].on').forEach(b=>{
      const v=b.getAttribute('data-sb-lane') || (b.textContent||'');
      if(v && !st.lanes.includes(v)) st.lanes.push(v);
    });
    document.querySelectorAll('#pg-builder [data-sb-option]:checked').forEach(cb=>{
      const v=cb.getAttribute('data-sb-option') || '';
      if(v && !st.options.includes(v)) st.options.push(v);
    });
    document.querySelectorAll('#pg-builder [data-sb-virtual]:checked').forEach(cb=>{
      const v=cb.getAttribute('data-sb-virtual') || '';
      if(v && !st.virtual.includes(v)) st.virtual.push(v);
    });
    return st;
  }
  function add(rows, name, lane, source, dose, unit, pattern){
    if(!name)return;
    if(rows.some(r=>r.name.toLowerCase()===name.toLowerCase()))return;
    rows.push({name,lane:lane||'dinner',source:source||'builder',dose:dose,unit:unit,pattern:pattern});
  }
  function refFor(name){
    try{const refs=window.PEPTIDE_REF||PEPTIDE_REF||[];const n=String(name||'').toLowerCase();return refs.find(r=>String(r.n||'').toLowerCase()===n)||refs.find(r=>n.includes(String(r.n||'').toLowerCase())||String(r.n||'').toLowerCase().includes(n))}catch(_){return null}
  }
  function patternFromFreq(freq){const f=String(freq||'').toLowerCase();if(/5|weekday/.test(f))return'weekdays';if(/3/.test(f))return'three';if(/2|twice/.test(f))return'twice';if(/once|weekly|1×|1x/.test(f))return'once';if(/every other|eod/.test(f))return'eod';return'daily'}
  function rowsForText(txt, source, rows){
    txt=String(txt||'');
    if(/reta|retatrutide|glp/i.test(txt)) add(rows,'Retatrutide','breakfast',source);
    if(/tirz|tirzepatide/i.test(txt)) add(rows,'Tirzepatide','breakfast',source);
    if(/tesa|tesamorelin/i.test(txt)) add(rows,'Tesamorelin','bedtime',source);
    if(/cjc|ipamorelin|ipa|gh pulse|sleep/i.test(txt)){ add(rows,'CJC-1295 (no DAC)','bedtime',source); add(rows,'Ipamorelin','bedtime',source); }
    if(/bpc|tb-?500|recovery|injury/i.test(txt)){ add(rows,'BPC-157','dinner',source); add(rows,'TB-500','dinner',source); }
    if(/aod/i.test(txt)) add(rows,'AOD-9604','breakfast',source);
    if(/trt|testosterone/i.test(txt)) add(rows,'Testosterone Cypionate','dinner',source,undefined,undefined,'twice');
    if(/muscle|recomp|creatine|retention/i.test(txt)) add(rows,'Creatine','lunch',source,1,'pill','daily');
    if(/metabolic|omega|lipid|a1c|labs/i.test(txt)) add(rows,'Omega-3','lunch',source,1,'pill','daily');
    if(/vitamin|support/i.test(txt)) add(rows,'Vitamins / support stack','lunch',source,1,'pill','daily');
  }
  function candidates(){
    const st=readState();
    const rows=[];
    (st.options||[]).forEach(o=>rowsForText(o,'builder option',rows));
    (st.virtual||[]).forEach(v=>rowsForText(v,'virtual candidate',rows));
    if(!rows.length)(st.lanes||[]).forEach(l=>rowsForText(l,'lane default',rows));
    // Aggressive fallback: use the visible summary text if needed.
    if(!rows.length){
      const txt=(document.querySelector('#pg-builder')||{}).textContent||'';
      rowsForText(txt,'visible builder text',rows);
    }
    // Final fallback: inventory.
    if(!rows.length){
      try{(S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).slice(0,10).forEach(i=>add(rows,i.name,i.stackLane||'dinner','inventory',i.dose,i.doseUnit,'daily'))}catch(_){}
    }
    return rows.map(r=>{
      const ref=refFor(r.name);
      return Object.assign({},r,{dose:r.dose!=null?r.dose:(ref&&ref.startD!=null?ref.startD:''),unit:r.unit||(ref&&ref.unit)||'mcg',pattern:r.pattern||patternFromFreq(ref&&ref.freq),lane:r.lane||'dinner'});
    });
  }
  function ensureModal(){
    let m=$('gpt318-modal'); if(m)return m;
    m=document.createElement('div');m.id='gpt318-modal';
    m.innerHTML='<div id="gpt318-card"><div class="head"><div><b>Apply Stack Builder to Weekly Calendar</b><p>This rebuilt version writes directly into the calendar schedule and verifies the stored keys before opening the Weekly Calendar.</p></div><button type="button" id="gpt318-close">Close</button></div><div id="gpt318-toolbar"><div><label>Apply mode</label><select id="gpt318-mode"><option value="replace">Replace schedule for selected items</option><option value="add">Add to current schedule</option><option value="preview">Preview only</option></select></div><div><label>Default day pattern</label><select id="gpt318-default-pattern"><option value="">Use each item default</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="eod">Every other day</option><option value="three">3× weekly</option><option value="twice">2× weekly</option><option value="once">Once weekly</option></select></div><div><label>Status</label><input id="gpt318-status" readonly></div></div><div id="gpt318-wrap"><table id="gpt318-table"><thead><tr><th>Use</th><th>Item</th><th>Lane</th><th>Typical starting dose</th><th>Unit</th><th>Days</th><th>Source</th></tr></thead><tbody id="gpt318-rows"></tbody></table></div><div id="gpt318-actions"><button type="button" class="primary" id="gpt318-apply">Apply to Weekly Calendar</button><button type="button" id="gpt318-open-cal">Open calendar</button><button type="button" id="gpt318-copy-debug">Copy debug</button></div><div id="gpt318-debug">Ready.</div></div>';
    document.body.appendChild(m);
    $('gpt318-close').onclick=()=>m.style.display='none';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'});
    $('gpt318-apply').onclick=apply;
    $('gpt318-open-cal').onclick=()=>{m.style.display='none';document.querySelector('[data-pg="calendar"]')?.click();};
    $('gpt318-copy-debug').onclick=async()=>{const t=debugText();try{await navigator.clipboard.writeText(t);toast('✓ Debug copied')}catch(_){alert(t)}};
    $('gpt318-default-pattern').onchange=()=>{const v=$('gpt318-default-pattern').value;if(v)document.querySelectorAll('#gpt318-rows [data-f="pattern"]').forEach(s=>s.value=v)};
    return m;
  }
  function renderRows(){
    const body=$('gpt318-rows'); if(!body)return;
    const rows=candidates();
    body.innerHTML=rows.length?rows.map(r=>'<tr><td><input type="checkbox" data-f="use" checked></td><td><input type="text" data-f="name" value="'+esc(r.name)+'"></td><td><select data-f="lane">'+Object.keys(LANE_LABELS).map(k=>'<option value="'+k+'" '+(r.lane===k?'selected':'')+'>'+LANE_LABELS[k]+'</option>').join('')+'</select></td><td><input type="number" data-f="dose" step="any" min="0" value="'+esc(r.dose)+'"></td><td><select data-f="unit">'+['mcg','mg','iu','ml','pill'].map(u=>'<option '+(String(r.unit).toLowerCase()===u?'selected':'')+'>'+u+'</option>').join('')+'</select></td><td><select data-f="pattern">'+[['daily','Daily'],['weekdays','Weekdays'],['eod','Every other day'],['three','3× weekly'],['twice','2× weekly'],['once','Once weekly']].map(p=>'<option value="'+p[0]+'" '+(r.pattern===p[0]?'selected':'')+'>'+p[1]+'</option>').join('')+'</select></td><td><span class="gpt318-chip">'+esc(r.source)+'</span></td></tr>').join(''):'<tr><td colspan="7" style="text-align:center;padding:18px;color:#6B7D92">No candidates found. Select builder lanes/options first.</td></tr>';
    $('gpt318-status').value=rows.length+' draft item(s) found.';
    $('gpt318-debug').textContent='Builder state: '+JSON.stringify(readState(),null,2)+'\n\nCandidates: '+JSON.stringify(rows,null,2);
  }
  function open(){ensureModal();renderRows();$('gpt318-modal').style.display='flex'}
  function collect(){
    const out=[];document.querySelectorAll('#gpt318-rows tr').forEach(tr=>{
      const q=f=>tr.querySelector('[data-f="'+f+'"]');
      if(!q('use')||!q('use').checked)return;
      const name=(q('name').value||'').trim();if(!name)return;
      out.push({name,lane:q('lane').value,dose:parseFloat(q('dose').value)||0,unit:q('unit').value,pattern:q('pattern').value});
    });return out;
  }
  function daysFor(p){return DAYS[p]||DAYS.daily}
  function timeFor(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function key(name,time,di){return name+'/'+time+'/'+di}
  function clearItem(name){Object.keys((S&&S.sched)||{}).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]})}
  function upsert(r){
    S.inv=S.inv||[];S.sched=S.sched||{};if(typeof S.nI!=='number')S.nI=Date.now();
    let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===r.name.toLowerCase()&&!i.isSupply);
    if(!it){it={id:S.nI++,name:r.name,fz:0,fr:0,dk:0,nd:0,dose:r.dose,doseUnit:r.unit,cn:'',us:'',cat:r.name,days:[],isPeptide:r.unit==='pill'?false:true};S.inv.push(it)}
    it.dose=r.dose;it.doseUnit=r.unit;it.stackLane=r.lane;it.days=daysFor(r.pattern).slice();
    return it;
  }
  function apply(){
    const rows=collect(), mode=$('gpt318-mode').value;
    if(!rows.length){toast('No calendar rows selected','amber');return}
    if(!window.S){toast('App state not ready','amber');return}
    if(mode==='preview'){toast('Preview only — nothing applied','amber');return}
    S.sched=S.sched||{};
    const written=[];
    rows.forEach(r=>{
      const it=upsert(r); if(!it)return;
      if(mode==='replace')clearItem(it.name);
      const t=timeFor(r.lane);
      daysFor(r.pattern).forEach(di=>{const kk=key(it.name,t,di);S.sched[kk]=true;written.push(kk)});
    });
    try{window.save&&window.save()}catch(_){}
    try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    const stored=Object.keys(S.sched||{}).filter(k=>S.sched[k]).length;
    $('gpt318-debug').textContent='WROTE '+written.length+' keys:\n'+written.join('\n')+'\n\nTOTAL STORED: '+stored+'\n\nS.sched sample:\n'+Object.keys(S.sched).filter(k=>S.sched[k]).slice(0,40).join('\n');
    toast('✓ Calendar schedule written',written.length+' new schedule cells; '+stored+' total stored.');
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal()}catch(e){console.error(e)}},150);
  }
  function debugText(){try{return $('gpt318-debug').textContent+'\n\nlocalStorage peptide_tracker:\n'+localStorage.getItem('peptide_tracker')?.slice(0,4000)}catch(_){return 'debug unavailable'}}
  // WINDOW capture beats older document-level handlers.
  window.addEventListener('click',function(e){
    const id=e.target&&e.target.id;
    if(id==='gpt315-open-apply-calendar'||id==='gpt314-build-apply'||id==='gpt-sb-preview-calendar'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open();
    }
  },true);
  window.tmpOpenStackBuilderApplyCalendar=open;
})();


// ===== extracted post-core patch script =====
(function(){
  // v33.375-stable-vendor-post-import-review diagnostic: make sure the four-lane calendar re-renders from actual S.sched keys.
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  window.tmpCalendarScheduleDebug = function(){
    try{
      const keys=Object.keys((window.S&&S.sched)||{}).filter(k=>S.sched[k]);
      console.log('TMP scheduled keys',keys);
      toast('Schedule debug',keys.length+' scheduled keys found.');
      return keys;
    }catch(e){console.error(e);return []}
  };
  document.addEventListener('click',function(e){
    if(e.target && (e.target.id==='gpt318-apply'||e.target.id==='gpt317-apply'||e.target.id==='gpt-sb-apply-confirm')){
      setTimeout(function(){
        try{ if(window.renderCal) window.renderCal(); window.tmpCalendarScheduleDebug&&window.tmpCalendarScheduleDebug(); }catch(_){}
      },600);
    }
  },true);
})();


// ===== extracted post-core patch script =====
(function(){
  const LANE_LABELS=Object.assign({},window.__tmpSbMealLanes);
  function $(id){return document.getElementById(id)}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function laneForTime(t){return t==='am'?'breakfast':'dinner'}
  function selectedContextName(){
    try{
      return (window.CUR && (CUR.name || CUR.peptide || CUR.nm)) ||
        (($('ap-nm')||{}).textContent||'').trim().replace(/\s+$/,'');
    }catch(_){return ''}
  }
  function currentLaneForName(name,time){
    try{
      const it=(window.S&&S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
      const lane=String((it&&it.stackLane)||'').toLowerCase();
      if(['breakfast','lunch','dinner','bedtime'].includes(lane)) return lane;
    }catch(_){}
    return laneForTime(time);
  }
  function convertSelect(sel){
    if(!sel || sel.dataset.mealLaneSelect==='1') return;
    const oldVal=sel.value || 'pm';
    sel.dataset.mealLaneSelect='1';
    sel.dataset.oldTimeValue=oldVal;
    sel.innerHTML = Object.keys(LANE_LABELS).map(k=>'<option value="'+k+'">'+LANE_LABELS[k]+'</option>').join('');
    const name=selectedContextName();
    sel.value=currentLaneForName(name,oldVal);
    let help=$('gpt-meal-lane-help');
    if(!help && sel.parentElement){
      help=document.createElement('div');
      help.id='gpt-meal-lane-help';
      help.textContent='Meal lane controls where the item appears. Breakfast/Lunch are stored as AM; Dinner/Bedtime are stored as PM.';
      sel.parentElement.appendChild(help);
    }
  }
  function convertVisibleTimeSelects(){
    ['m-time','ms-time','e-time','e-stime'].forEach(id=>{
      const sel=$(id);
      if(sel && (sel.offsetParent!==null || sel.closest('#f-move,#f-edit'))) convertSelect(sel);
    });
  }
  function persistLaneForCurrent(sel){
    const lane=sel && sel.value;
    if(!['breakfast','lunch','dinner','bedtime'].includes(lane)) return;
    const name=selectedContextName();
    if(!name) return;
    try{
      const it=(window.S&&S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
      if(it){ it.stackLane=lane; if(typeof window.save==='function') window.save(); }
    }catch(_){}
  }
  function patchBeforeNativeSave(){
    ['m-time','ms-time','e-time','e-stime'].forEach(id=>{
      const sel=$(id);
      if(sel && sel.dataset.mealLaneSelect==='1'){
        persistLaneForCurrent(sel);
        sel.dataset.mealLaneValue=sel.value;
        sel.value=timeForLane(sel.value); // native code still expects am/pm
        setTimeout(()=>{ try{ sel.value=sel.dataset.mealLaneValue; }catch(_){} }, 80);
      }
    });
  }

  // Convert whenever the action panel opens or the Move/Edit subform is shown.
  const mo=new MutationObserver(()=>{if(window.__tmpMoQuiet.active()||mo.__pending)return;mo.__pending=1;setTimeout(()=>{mo.__pending=0;window.__tmpMoQuiet.run(convertVisibleTimeSelects);},30);});
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{ if($('ap')) mo.observe($('ap'),{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']}); convertVisibleTimeSelects(); });
  }else{
    if($('ap')) mo.observe($('ap'),{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
    convertVisibleTimeSelects();
  }

  document.addEventListener('click',function(e){
    if(e.target && e.target.closest && e.target.closest('#t-move,#t-edit,#move-bk,#edit-bk')){
      setTimeout(convertVisibleTimeSelects,80);
    }
    if(e.target && e.target.closest && e.target.closest('#move-save,#edit-save')){
      patchBeforeNativeSave();
      setTimeout(()=>{ try{ if(window.renderCal) window.renderCal(); }catch(_){} },220);
    }
  },true);

  document.addEventListener('change',function(e){
    const sel=e.target && e.target.closest && e.target.closest('#m-time,#ms-time,#e-time,#e-stime');
    if(sel && sel.dataset.mealLaneSelect==='1') persistLaneForCurrent(sel);
  },true);

  // Public helper for debugging
  window.tmpMealLaneForTime = timeForLane;
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function key(name,time,di){return name+'/'+time+'/'+di}
  const DAY_MAP={mon:0,monday:0,tue:1,tues:1,tuesday:1,wed:2,wednesday:2,thu:3,thur:3,thurs:3,thursday:3,fri:4,friday:4,sat:5,saturday:5,sun:6,sunday:6};
  const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  function refFor(name){try{const refs=window.PEPTIDE_REF||PEPTIDE_REF||[];const n=String(name||'').toLowerCase();return refs.find(r=>String(r.n||'').toLowerCase()===n)||refs.find(r=>n&&(n.includes(String(r.n||'').toLowerCase())||String(r.n||'').toLowerCase().includes(n)))}catch(_){return null}}
  function normalizeName(name,purpose){
    const t=(String(name||'')+' '+String(purpose||'')).toLowerCase();
    if(/\brt\s*30\b|\brt30\b|retatrutide|reta\b/.test(t)) return 'Retatrutide';
    if(/\bklow\b|klotho/.test(t)) return 'Klow';
    if(/vitamin/.test(t)) return 'Vitamins / support stack';
    if(/tesa|tesamorelin/.test(t)) return 'Tesamorelin';
    if(/ipamorelin|\bipa\b/.test(t)) return 'Ipamorelin';
    if(/cjc/.test(t)) return 'CJC-1295 (no DAC)';
    if(/bpc/.test(t)) return 'BPC-157';
    if(/tb-?500/.test(t)) return 'TB-500';
    return String(name||'').trim();
  }
  function laneFor(item,purpose){
    const t=(String(item||'')+' '+String(purpose||'')).toLowerCase();
    if(/am routine|electrolyte|morning|breakfast|\bklow\b/.test(t)) return 'breakfast';
    if(/vitamin|adherence|support|simplicity|lunch/.test(t)) return 'lunch';
    if(/fat loss|appetite|glp|reta|retatrutide|rt30/.test(t)) return 'breakfast';
    if(/sleep|gh|bed|night|ipa|tesa|cjc|dsip/.test(t)) return 'bedtime';
    if(/recovery|injury|bpc|tb500|tb-500|dinner|pm/.test(t)) return 'dinner';
    return 'lunch';
  }
  function patternDays(freq){
    const f=String(freq||'').toLowerCase(); const found=[];
    Object.keys(DAY_MAP).forEach(k=>{if(new RegExp('\\b'+k+'\\b','i').test(f)&&!found.includes(DAY_MAP[k]))found.push(DAY_MAP[k])});
    if(found.length) return found.sort((a,b)=>a-b);
    if(/daily|every day|currently planned|selected days/.test(f)) return [0,1,2,3,4,5,6];
    if(/weekday|workday/.test(f)) return [0,1,2,3,4];
    if(/every other|eod/.test(f)) return [0,2,4,6];
    if(/3\s*(x|×)|three/.test(f)) return [1,3,5];
    if(/2\s*(x|×)|twice/.test(f)) return [0,3];
    if(/weekly|once/.test(f)) return [0];
    return [0,1,2,3,4,5,6];
  }
  function parseTable(text){
    const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const rows=[];
    for(const line of lines){
      if(/^\|?\s*-{2,}/.test(line)||/Item\s*\|.*Frequency/i.test(line)) continue;
      let cells=line.includes('|')?line.split('|').map(x=>x.trim()).filter((x,i,a)=>!(i===0&&!x)&&!(i===a.length-1&&!x)):line.split(/\t| {2,}/).map(x=>x.trim()).filter(Boolean);
      if(cells.length>=2) rows.push({item:cells[0]||'',freq:cells[1]||'',purpose:cells.slice(2).join(' ')||''});
    }
    return rows.map(r=>{
      const name=normalizeName(r.item,r.purpose), ref=refFor(name);
      const unit=(ref&&ref.unit)||(/vitamin|support/i.test(name)?'pill':'mcg');
      const dose=(ref&&ref.startD!=null)?ref.startD:(unit==='pill'?1:'');
      return Object.assign({},r,{name,lane:laneFor(name,r.purpose),days:patternDays(r.freq),unit,dose,source:'imported stack'});
    }).filter(r=>r.name);
  }
  function renderPreview(){
    const rows=parseTable(($('gpt-import-stack-text')||{}).value||'');
    const box=$('gpt-import-stack-previewbox'); if(!box)return rows;
    box.style.display='block';
    if(!rows.length){box.innerHTML='<div style="padding:14px;color:#6B7D92">No rows detected. Paste an Item / Frequency / Purpose table.</div>';return rows;}
    box.innerHTML='<table><thead><tr><th>Item</th><th>Detected name</th><th>Lane</th><th>Dose</th><th>Days</th><th>Purpose</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.item)+'</td><td><b>'+esc(r.name)+'</b></td><td><span class="chip">'+esc(r.lane)+'</span></td><td>'+esc(r.dose)+' '+esc(r.unit)+'</td><td>'+r.days.map(d=>DOW[d]).join(', ')+'</td><td>'+esc(r.purpose)+'</td></tr>').join('')+'</tbody></table>';
    return rows;
  }
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function upsert(row){
    S.inv=S.inv||[];S.sched=S.sched||{};if(typeof S.nI!=='number')S.nI=Date.now();
    let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===row.name.toLowerCase()&&!i.isSupply);
    if(!it){it={id:S.nI++,name:row.name,fz:0,fr:0,dk:0,nd:0,dose:+row.dose||0,doseUnit:row.unit,cn:'',us:'',cat:row.name,days:[],isPeptide:row.unit==='pill'?false:true};S.inv.push(it)}
    it.dose=+row.dose||it.dose||0;it.doseUnit=row.unit||it.doseUnit||'mcg';it.stackLane=row.lane;it.days=row.days.slice();it.importPurpose=row.purpose||'';return it;
  }
  function applyImport(){
    const rows=renderPreview(); if(!rows.length){toast('No stack rows to import','amber');return}
    S.sched=S.sched||{}; const written=[];
    rows.forEach(r=>{const it=upsert(r);Object.keys(S.sched).forEach(k=>{if(k.indexOf(it.name+'/')===0)delete S.sched[k]});const time=timeForLane(r.lane);r.days.forEach(di=>{const kk=key(it.name,time,di);S.sched[kk]=true;written.push(kk)})});
    try{window.save&&window.save()}catch(_){}
    try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    try{window.renderCal&&window.renderCal();window.renderStack&&window.renderStack();window.renderInventoryPage&&window.renderInventoryPage()}catch(_){}
    toast('✓ Stack imported to Weekly Calendar',written.length+' scheduled cells written.');
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal()}catch(_){}},150);
  }
  document.addEventListener('click',function(e){
    if(e.target&&e.target.id==='gpt-import-stack-preview'){e.preventDefault();renderPreview();}
    if(e.target&&e.target.id==='gpt-import-stack-apply'){e.preventDefault();applyImport();}
  },true);
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){return false}}
  function fileObj(){const f=$('gpt-import-stack-file');return f&&f.files&&f.files[0]?f.files[0]:null}
  function ext(name){return String(name||'').split('.').pop().toLowerCase()}
  function setStatus(msg){const s=$('gpt-import-stack-file-status'); if(s)s.textContent=msg}
  function csvToMarkdown(text){
    const rows=[]; let row=[], cell='', q=false;
    text=String(text||'');
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(c==='"'&&q&&n==='"'){cell+='"';i++;continue}
      if(c==='"'){q=!q;continue}
      if((c===','||c==='\t')&&!q){row.push(cell.trim());cell='';continue}
      if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';continue}
      cell+=c;
    }
    row.push(cell.trim()); if(row.some(Boolean))rows.push(row);
    if(rows.length<2) return text;
    const header=rows[0].map(x=>x||'Column');
    const idxItem=header.findIndex(h=>/item|name|peptide|compound/i.test(h));
    const idxFreq=header.findIndex(h=>/freq|schedule|days|cadence/i.test(h));
    const idxPurpose=header.findIndex(h=>/purpose|goal|notes|lane|why/i.test(h));
    const itemI=idxItem>=0?idxItem:0, freqI=idxFreq>=0?idxFreq:1, purpI=idxPurpose>=0?idxPurpose:2;
    const out=['| Item | Frequency | Purpose |','| --- | ---: | --- |'];
    rows.slice(1).forEach(r=>{if(r[itemI]) out.push('| '+(r[itemI]||'')+' | '+(r[freqI]||'')+' | '+(r[purpI]||'')+' |')});
    return out.join('\n');
  }
  async function readFileDirect(){
    const f=fileObj(); if(!f){setStatus('Choose a file first.'); return}
    const e=ext(f.name);
    try{
      if(['csv','txt','tsv'].includes(e)){
        const txt=await f.text();
        const ta=$('gpt-import-stack-text');
        if(ta) ta.value = e==='csv'||e==='tsv' ? csvToMarkdown(txt) : txt;
        setStatus('Loaded '+f.name+' into the import box. Preview/import when ready.');
        toast('✓ Stack file loaded');
        const prev=$('gpt-import-stack-preview'); if(prev) prev.click();
        return;
      }
      if(['xls','xlsx'].includes(e)){
        setStatus('XLS/XLSX cannot be reliably parsed in this offline HTML without a spreadsheet parser. Use Build GPT file prompt, then attach the XLS/XLSX to GPT.');
        toast('Use GPT file prompt for XLS/XLSX','amber');
        return;
      }
      if(['pdf','jpg','jpeg','png','webp'].includes(e)){
        setStatus('PDF/image files need GPT/OCR. Use Build GPT file prompt, then attach this file to GPT.');
        toast('Use GPT file prompt for PDF/image','amber');
        return;
      }
      const txt=await f.text();
      const ta=$('gpt-import-stack-text'); if(ta)ta.value=txt;
      setStatus('Loaded text from '+f.name+'.');
    }catch(err){
      setStatus('Could not read '+f.name+'. Use Build GPT file prompt and attach it to GPT.');
    }
  }
  function buildGPTPrompt(){
    const f=fileObj();
    const name=f?f.name:'[attach stack file]';
    const pasted=($('gpt-import-stack-text')||{}).value||'';
    return [
      'You are converting my stack file/table into a PeptideGenius Stack Import table.',
      '',
      'Return ONLY a markdown table with these columns:',
      '| Item | Frequency | Purpose |',
      '',
      'Rules:',
      '- Read the attached file if present. It may be PDF, CSV, XLS/XLSX, JPEG/PNG screenshot, or pasted text.',
      '- Extract stack items, schedule/frequency, and purpose/lane notes.',
      '- Keep item names concise.',
      '- If an item abbreviation appears, preserve it and add the likely meaning in Purpose when reasonable.',
      '- Use days like Mon + Thu when explicit.',
      '- Use Daily, Every other day, 2× weekly, 3× weekly, selected days, or as currently planned when appropriate.',
      '- Do not include commentary before or after the table.',
      '',
      'Source file name: '+name,
      '',
      pasted.trim() ? ('Pasted text/table:\n'+pasted.trim()) : 'Pasted text/table: [none — use attached file]'
    ].join('\n');
  }
  function ensureGPTModal(){
    let m=$('gpt-import-stack-gpt-modal'); if(m)return m;
    m=document.createElement('div'); m.id='gpt-import-stack-gpt-modal';
    m.innerHTML='<div id="gpt-import-stack-gpt-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px"><div><b style="font-size:17px;color:#18385E">GPT stack import prompt ready</b><p style="margin:4px 0 0;font-size:12px;color:#5C738F;line-height:1.45">For PDF/XLS/JPEG, open GPT and attach the same file. Then paste/send this prompt. GPT should return the Item / Frequency / Purpose table for PeptideGenius.</p></div><button type="button" id="gpt-import-stack-gpt-close">Close</button></div><textarea id="gpt-import-stack-gpt-text"></textarea><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="primary" id="gpt-import-stack-gpt-copy-open">Copy prompt + open GPT</button><button type="button" id="gpt-import-stack-gpt-copy">Copy prompt</button><button type="button" id="gpt-import-stack-gpt-select">Select text</button></div></div>';
    document.body.appendChild(m);
    $('gpt-import-stack-gpt-close').onclick=()=>m.style.display='none';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'});
    $('gpt-import-stack-gpt-copy').onclick=async()=>{const ok=await copyText(($('gpt-import-stack-gpt-text')||{}).value||'');toast(ok?'✓ Prompt copied':'Copy blocked — select text manually',ok?'':'amber')};
    $('gpt-import-stack-gpt-copy-open').onclick=async()=>{const ok=await copyText(($('gpt-import-stack-gpt-text')||{}).value||'');try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){} toast(ok?'✓ Prompt copied — attach file in GPT':'GPT opened — manual copy needed',ok?'':'amber')};
    $('gpt-import-stack-gpt-select').onclick=()=>{const ta=$('gpt-import-stack-gpt-text');if(ta){ta.focus();ta.select();}};
    return m;
  }
  function openGPTPrompt(){
    const m=ensureGPTModal();
    const ta=$('gpt-import-stack-gpt-text'); if(ta)ta.value=buildGPTPrompt();
    m.style.display='flex';
    copyText(ta?ta.value:'');
  }
  document.addEventListener('click',function(e){
    if(e.target&&e.target.id==='gpt-import-stack-read-file'){e.preventDefault();readFileDirect();}
    if(e.target&&e.target.id==='gpt-import-stack-gpt-file'){e.preventDefault();openGPTPrompt();}
  },true);
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review fix:
    Import My Stack previously expected Item/Frequency/Purpose rows.
    Your CSV is a weekly matrix:
      day,morning_breakfast,dinner_evening,bedtime,optional_notes
    Old parser treated day names / notes as stack items, producing "Wednesday..." and "Sunday".
    This patch detects weekly matrix CSV and expands each day/lane cell into actual schedule items.
  */
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function key(name,time,di){return name+'/'+time+'/'+di}
  const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DAY={monday:0,mon:0,tuesday:1,tue:1,tues:1,wednesday:2,wed:2,thursday:3,thu:3,thur:3,thurs:3,friday:4,fri:4,saturday:5,sat:5,sunday:6,sun:6};

  function parseDelimited(text){
    const rows=[]; let row=[], cell='', q=false; text=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(c==='"' && q && n==='"'){cell+='"';i++;continue}
      if(c==='"'){q=!q;continue}
      if((c===',' || c==='\t') && !q){row.push(cell.trim());cell='';continue}
      if((c==='\n'||c==='\r') && !q){if(c==='\r'&&n==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';continue}
      cell+=c;
    }
    row.push(cell.trim()); if(row.some(Boolean))rows.push(row);
    return rows;
  }
  function normHeader(h){return String(h||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
  function splitItems(cell){
    let s=String(cell||'').trim();
    if(!s || /^[-—]+$/.test(s)) return [];
    // Strip off/comment tokens, but preserve "DSIP if needed" as DSIP optional.
    if(/^off\b/i.test(s)){
      const m=s.match(/\b(dsip)\b/i);
      return m?['DSIP']:[]; 
    }
    s=s.replace(/\bif needed\b/ig,'').replace(/\bas needed\b/ig,'').trim();
    // BPC/TB and CJC-Ipamorelin should be separate stack items.
    let parts=s.split(/\s*\+\s*|\s*\/\s*|;|,/).map(x=>x.trim()).filter(Boolean);
    return parts.filter(x=>!/^off$/i.test(x));
  }
  function canonicalName(raw){
    const t=String(raw||'').trim();
    const l=t.toLowerCase();
    if(!t) return '';
    if(/^rt\s*30$|^rt30$|retatrutide|reta/.test(l)) return 'Retatrutide';
    if(/^klow$|klotho/.test(l)) return 'Klow';
    if(/^vit|vitamins?/.test(l)) return 'Vitamins / support stack';
    if(/^bpc$|bpc-?157/.test(l)) return 'BPC-157';
    if(/^tb$|tb-?500/.test(l)) return 'TB-500';
    if(/^cp\s*20$|^cp20$/.test(l)) return 'CP20';
    if(/^cjc$|cjc-?1295/.test(l)) return 'CJC-1295 (no DAC)';
    if(/ipamorelin|\bipa\b/.test(l)) return 'Ipamorelin';
    if(/tesamorelin|^tesa/.test(l)) return 'Tesamorelin';
    if(/^dsip/.test(l)) return 'DSIP';
    return t;
  }
  function refFor(name){
    try{const refs=window.PEPTIDE_REF||PEPTIDE_REF||[];const n=String(name||'').toLowerCase();return refs.find(r=>String(r.n||'').toLowerCase()===n)||refs.find(r=>n&&(n.includes(String(r.n||'').toLowerCase())||String(r.n||'').toLowerCase().includes(n)))}catch(_){return null}
  }
  function defaultDoseUnit(name){
    const ref=refFor(name);
    if(ref) return {dose:ref.startD!=null?ref.startD:'', unit:ref.unit||'mcg'};
    if(/vitamin|support|omega|creatine|protein/i.test(name)) return {dose:1, unit:'pill'};
    return {dose:'', unit:'mcg'};
  }
  function laneTime(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function laneLabel(lane){return {breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner',bedtime:'Bedtime'}[lane]||lane}

  function parseWeeklyMatrix(text){
    const rows=parseDelimited(text);
    if(rows.length<2) return null;
    const headers=rows[0].map(normHeader);
    const dayIdx=headers.findIndex(h=>h==='day'||h==='date'||h==='weekday');
    const breakfastIdx=headers.findIndex(h=>/morning|breakfast|am/.test(h));
    const lunchIdx=headers.findIndex(h=>/lunch|midday|noon/.test(h));
    const dinnerIdx=headers.findIndex(h=>/dinner|evening|pm/.test(h));
    const bedtimeIdx=headers.findIndex(h=>/bedtime|night|sleep/.test(h));
    const looksMatrix=dayIdx>=0 && (breakfastIdx>=0 || lunchIdx>=0 || dinnerIdx>=0 || bedtimeIdx>=0);
    if(!looksMatrix) return null;
    const out=[];
    rows.slice(1).forEach(r=>{
      const d=String(r[dayIdx]||'').toLowerCase().trim();
      const di=DAY[d];
      if(di==null) return;
      const addCell=(idx,lane)=>{
        if(idx<0) return;
        splitItems(r[idx]).forEach(raw=>{
          const name=canonicalName(raw);
          if(!name) return;
          const du=defaultDoseUnit(name);
          out.push({item:raw,name,lane,di,dose:du.dose,unit:du.unit,source:'weekly CSV matrix'});
        });
      };
      addCell(breakfastIdx,'breakfast');
      addCell(lunchIdx,'lunch');
      addCell(dinnerIdx,'dinner');
      addCell(bedtimeIdx,'bedtime');
    });
    return out;
  }

  function parseItemFrequencyPurpose(text){
    const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const rows=[];
    for(const line of lines){
      if(/^\|?\s*-{2,}/.test(line)||/Item\s*\|.*Frequency/i.test(line)) continue;
      let cells=line.includes('|')?line.split('|').map(x=>x.trim()).filter((x,i,a)=>!(i===0&&!x)&&!(i===a.length-1&&!x)):line.split(/\t| {2,}/).map(x=>x.trim()).filter(Boolean);
      if(cells.length>=2) rows.push({item:cells[0]||'',freq:cells[1]||'',purpose:cells.slice(2).join(' ')||''});
    }
    const DAY_MAP={mon:0,monday:0,tue:1,tues:1,tuesday:1,wed:2,wednesday:2,thu:3,thur:3,thurs:3,thursday:3,fri:4,friday:4,sat:5,saturday:5,sun:6,sunday:6};
    function days(freq){const f=String(freq||'').toLowerCase();const found=[];Object.keys(DAY_MAP).forEach(k=>{if(new RegExp('\\b'+k+'\\b','i').test(f)&&!found.includes(DAY_MAP[k]))found.push(DAY_MAP[k])});if(found.length)return found.sort((a,b)=>a-b);if(/daily|every day|currently planned|selected days/.test(f))return [0,1,2,3,4,5,6];if(/weekday/.test(f))return [0,1,2,3,4];if(/every other|eod/.test(f))return [0,2,4,6];if(/3\s*(x|×)|three/.test(f))return [1,3,5];if(/2\s*(x|×)|twice/.test(f))return [0,3];return [0,1,2,3,4,5,6]}
    function lane(item,purpose){const t=(String(item||'')+' '+String(purpose||'')).toLowerCase();if(/am routine|electrolyte|morning|breakfast|\bklow\b|rt30|retatrutide|fat loss|appetite/.test(t))return'breakfast';if(/vitamin|adherence|support|simplicity|lunch/.test(t))return'lunch';if(/sleep|gh|bed|night|ipa|tesa|cjc|dsip/.test(t))return'bedtime';if(/recovery|injury|bpc|tb500|tb-500|dinner|pm/.test(t))return'dinner';return'lunch'}
    const out=[];
    rows.forEach(r=>{
      const name=canonicalName(r.item+' '+r.purpose);
      const du=defaultDoseUnit(name);
      days(r.freq).forEach(di=>out.push({item:r.item,name,lane:lane(name,r.purpose),di,dose:du.dose,unit:du.unit,source:'item/frequency table'}));
    });
    return out;
  }

  function parseImport(text){
    return parseWeeklyMatrix(text) || parseItemFrequencyPurpose(text) || [];
  }

  function renderPreview(){
    const text=($('gpt-import-stack-text')||{}).value||'';
    const rows=parseImport(text);
    const box=$('gpt-import-stack-previewbox'); if(!box) return rows;
    box.style.display='block';
    if(!rows.length){box.innerHTML='<div style="padding:14px;color:#6B7D92">No stack rows detected. Try CSV columns like day,morning_breakfast,dinner_evening,bedtime or an Item/Frequency/Purpose table.</div>';return rows}
    box.innerHTML='<table><thead><tr><th>Source item</th><th>Detected name</th><th>Lane</th><th>Dose</th><th>Day</th><th>Source</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.item)+'</td><td><b>'+esc(r.name)+'</b></td><td><span class="chip">'+esc(laneLabel(r.lane))+'</span></td><td>'+esc(r.dose)+' '+esc(r.unit)+'</td><td>'+DOW[r.di]+'</td><td>'+esc(r.source)+'</td></tr>').join('')+'</tbody></table>';
    return rows;
  }
  function upsert(row){
    S.inv=S.inv||[]; S.sched=S.sched||{}; if(typeof S.nI!=='number') S.nI=Date.now();
    let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===row.name.toLowerCase()&&!i.isSupply);
    if(!it){it={id:S.nI++,name:row.name,fz:0,fr:0,dk:0,nd:0,dose:+row.dose||0,doseUnit:row.unit,cn:'',us:'',cat:row.name,days:[],isPeptide:row.unit==='pill'?false:true};S.inv.push(it)}
    if(row.dose!==''&&!isNaN(+row.dose)) it.dose=+row.dose;
    it.doseUnit=row.unit||it.doseUnit||'mcg';
    it.stackLane=row.lane;
    it.days=[...new Set([...(it.days||[]),row.di])].sort((a,b)=>a-b);
    return it;
  }
  function applyImport(){
    const rows=renderPreview();
    if(!rows.length){toast('No stack rows to import','amber');return}
    S.sched=S.sched||{};
    const names=[...new Set(rows.map(r=>r.name))];
    names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
    const written=[];
    rows.forEach(r=>{const it=upsert(r);const kk=key(it.name,laneTime(r.lane),r.di);S.sched[kk]=true;written.push(kk)});
    try{window.save&&window.save()}catch(_){}
    try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    try{window.renderCal&&window.renderCal();window.renderStack&&window.renderStack();window.renderInventoryPage&&window.renderInventoryPage()}catch(_){}
    toast('✓ Stack imported to Weekly Calendar',written.length+' scheduled cells written.');
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal()}catch(_){}},150);
  }

  // Override prior import buttons at window capture so old parsers cannot misread weekly matrix CSV.
  window.addEventListener('click',function(e){
    if(e.target&&e.target.id==='gpt-import-stack-preview'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();renderPreview();}
    if(e.target&&e.target.id==='gpt-import-stack-apply'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();applyImport();}
  },true);

  // Override CSV file read conversion for weekly matrix files.
  window.addEventListener('click',function(e){
    if(e.target&&e.target.id==='gpt-import-stack-read-file'){
      setTimeout(function(){
        const ta=$('gpt-import-stack-text');
        if(ta && parseWeeklyMatrix(ta.value)){
          renderPreview();
          toast('✓ Weekly stack CSV detected','day/lane matrix parsed correctly.');
        }
      },250);
    }
  },true);

  window.tmpParseStackImport = parseImport;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Fixes weekly CSV import being converted into a fake Item/Frequency/Purpose table
    where Monday/Thursday/Wednesday became imported items.
    This version intercepts Read file BEFORE older handlers, preserves the raw CSV,
    and removes bad weekday-name items when applying a weekly matrix.
  */
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function key(name,time,di){return name+'/'+time+'/'+di}
  const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DAY={monday:0,mon:0,tuesday:1,tue:1,tues:1,wednesday:2,wed:2,thursday:3,thu:3,thur:3,thurs:3,friday:4,fri:4,saturday:5,sat:5,sunday:6,sun:6};
  const BAD_DAY_NAMES=new Set(['monday','tuesday','wednesday','thursday','friday','saturday','sunday','mon','tue','wed','thu','fri','sat','sun']);
  function parseDelimited(text){
    const rows=[]; let row=[], cell='', q=false; text=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(c==='"'&&q&&n==='"'){cell+='"';i++;continue}
      if(c==='"'){q=!q;continue}
      if((c===','||c==='\t')&&!q){row.push(cell.trim());cell='';continue}
      if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';continue}
      cell+=c;
    }
    row.push(cell.trim()); if(row.some(Boolean))rows.push(row);
    return rows;
  }
  function normHeader(h){return String(h||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
  function splitItems(cell){
    let s=String(cell||'').trim();
    if(!s || /^[-—]+$/.test(s)) return [];
    if(/^off\b/i.test(s)){
      const out=[]; if(/\bdsip\b/i.test(s)) out.push('DSIP'); return out;
    }
    s=s.replace(/\bif needed\b/ig,'').replace(/\bas needed\b/ig,'').trim();
    // Expand common combos before generic splitting.
    s=s.replace(/CJC\s*[-+\/]\s*Ipamorelin/ig,'CJC-1295 (no DAC) + Ipamorelin');
    s=s.replace(/\bBPC\s*[-+\/]\s*TB\b/ig,'BPC-157 + TB-500');
    return s.split(/\s*\+\s*|\s*\/\s*|;|,/).map(x=>x.trim()).filter(x=>x&&!/^off$/i.test(x));
  }
  function canonicalName(raw){
    const t=String(raw||'').trim(), l=t.toLowerCase();
    if(!t) return '';
    if(/^rt\s*30$|^rt30$|retatrutide|reta/.test(l)) return 'Retatrutide';
    if(/^klow$|klotho/.test(l)) return 'Klow';
    if(/^vit|vitamins?/.test(l)) return 'Vitamins / support stack';
    if(/^bpc$|bpc-?157/.test(l)) return 'BPC-157';
    if(/^tb$|tb-?500/.test(l)) return 'TB-500';
    if(/^cp\s*20$|^cp20$/.test(l)) return 'CP20';
    if(/^cjc$|cjc-?1295/.test(l)) return 'CJC-1295 (no DAC)';
    if(/ipamorelin|\bipa\b/.test(l)) return 'Ipamorelin';
    if(/tesamorelin|^tesa/.test(l)) return 'Tesamorelin';
    if(/^dsip/.test(l)) return 'DSIP';
    return t;
  }
  function refFor(name){try{const refs=window.PEPTIDE_REF||PEPTIDE_REF||[];const n=String(name||'').toLowerCase();return refs.find(r=>String(r.n||'').toLowerCase()===n)||refs.find(r=>n&&(n.includes(String(r.n||'').toLowerCase())||String(r.n||'').toLowerCase().includes(n)))}catch(_){return null}}
  function defaultDoseUnit(name){const ref=refFor(name); if(ref) return {dose:ref.startD!=null?ref.startD:'',unit:ref.unit||'mcg'}; if(/vitamin|support|omega|creatine|protein/i.test(name))return{dose:1,unit:'pill'}; return{dose:'',unit:'mcg'}}
  function laneTime(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function laneLabel(lane){return {breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner',bedtime:'Bedtime'}[lane]||lane}
  function parseWeeklyMatrix(text){
    const rows=parseDelimited(text);
    if(rows.length<2)return null;
    const headers=rows[0].map(normHeader);
    const dayIdx=headers.findIndex(h=>h==='day'||h==='date'||h==='weekday');
    const breakfastIdx=headers.findIndex(h=>/morning|breakfast|am/.test(h));
    const lunchIdx=headers.findIndex(h=>/lunch|midday|noon/.test(h));
    const dinnerIdx=headers.findIndex(h=>/dinner|evening|pm/.test(h));
    const bedtimeIdx=headers.findIndex(h=>/bedtime|night|sleep/.test(h));
    if(dayIdx<0 || (breakfastIdx<0&&lunchIdx<0&&dinnerIdx<0&&bedtimeIdx<0)) return null;
    const out=[];
    rows.slice(1).forEach(r=>{
      const d=String(r[dayIdx]||'').toLowerCase().trim();
      const di=DAY[d]; if(di==null)return;
      const add=(idx,lane)=>{if(idx<0)return; splitItems(r[idx]).forEach(raw=>{const name=canonicalName(raw); if(!name||BAD_DAY_NAMES.has(name.toLowerCase()))return; const du=defaultDoseUnit(name); out.push({item:raw,name,lane,di,dose:du.dose,unit:du.unit,source:'weekly CSV matrix'});});};
      add(breakfastIdx,'breakfast'); add(lunchIdx,'lunch'); add(dinnerIdx,'dinner'); add(bedtimeIdx,'bedtime');
    });
    return out;
  }
  function renderPreview(){
    const text=($('gpt-import-stack-text')||{}).value||'';
    const rows=parseWeeklyMatrix(text) || (window.tmpParseStackImport?window.tmpParseStackImport(text):[]);
    const box=$('gpt-import-stack-previewbox'); if(!box)return rows;
    box.style.display='block';
    if(!rows.length){box.innerHTML='<div style="padding:14px;color:#6B7D92">No stack rows detected. For weekly CSV use columns: day,morning_breakfast,dinner_evening,bedtime.</div>';return rows}
    box.innerHTML='<table><thead><tr><th>Source item</th><th>Detected name</th><th>Lane</th><th>Dose</th><th>Day</th><th>Source</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.item)+'</td><td><b>'+esc(r.name)+'</b></td><td><span class="chip">'+esc(laneLabel(r.lane))+'</span></td><td>'+esc(r.dose)+' '+esc(r.unit)+'</td><td>'+DOW[r.di]+'</td><td>'+esc(r.source)+'</td></tr>').join('')+'</tbody></table>';
    return rows;
  }
  function cleanBadWeekdayImports(){
    if(!window.S)return;
    S.sched=S.sched||{}; S.inv=S.inv||[];
    Object.keys(S.sched).forEach(k=>{const n=k.split('/')[0]; if(BAD_DAY_NAMES.has(String(n).toLowerCase())) delete S.sched[k];});
    S.inv=S.inv.filter(i=>!(i&&i.name&&BAD_DAY_NAMES.has(String(i.name).toLowerCase())&&!i.isSupply));
  }
  function upsert(row){
    S.inv=S.inv||[]; S.sched=S.sched||{}; if(typeof S.nI!=='number')S.nI=Date.now();
    let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===row.name.toLowerCase()&&!i.isSupply);
    if(!it){it={id:S.nI++,name:row.name,fz:0,fr:0,dk:0,nd:0,dose:+row.dose||0,doseUnit:row.unit,cn:'',us:'',cat:row.name,days:[],isPeptide:row.unit==='pill'?false:true};S.inv.push(it)}
    if(row.dose!==''&&!isNaN(+row.dose))it.dose=+row.dose;
    it.doseUnit=row.unit||it.doseUnit||'mcg'; it.stackLane=row.lane; it.days=[...new Set([...(it.days||[]),row.di])].sort((a,b)=>a-b);
    return it;
  }
  function applyImport(){
    const rows=renderPreview().filter(r=>r&&r.name&&!BAD_DAY_NAMES.has(String(r.name).toLowerCase()));
    if(!rows.length){toast('No valid stack rows to import','amber');return}
    cleanBadWeekdayImports();
    S.sched=S.sched||{};
    const names=[...new Set(rows.map(r=>r.name))];
    names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
    const written=[];
    rows.forEach(r=>{const it=upsert(r); const kk=key(it.name,laneTime(r.lane),r.di); S.sched[kk]=true; written.push(kk);});
    try{window.save&&window.save()}catch(_){}
    try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    try{window.renderCal&&window.renderCal();window.renderStack&&window.renderStack();window.renderInventoryPage&&window.renderInventoryPage()}catch(_){}
    toast('✓ Weekly CSV imported correctly',written.length+' scheduled cells written.');
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal()}catch(_){}},150);
  }
  async function readFileRaw(){
    const inp=$('gpt-import-stack-file'); const f=inp&&inp.files&&inp.files[0];
    if(!f){toast('Choose a file first','amber');return}
    const ext=String(f.name||'').split('.').pop().toLowerCase();
    if(!['csv','txt','tsv'].includes(ext)){toast('Use GPT file prompt for PDF/XLS/image','amber');return}
    const txt=await f.text();
    const ta=$('gpt-import-stack-text'); if(ta)ta.value=txt; // PRESERVE RAW CSV. Do not convert to Item/Frequency table.
    const status=$('gpt-import-stack-file-status'); if(status)status.textContent='Loaded raw '+ext.toUpperCase()+' file. Weekly matrix CSV will be parsed by day/lane columns.';
    renderPreview();
    toast('✓ Raw weekly stack file loaded');
  }
  window.addEventListener('click',function(e){
    if(e.target&&e.target.id==='gpt-import-stack-read-file'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();readFileRaw();}
    if(e.target&&e.target.id==='gpt-import-stack-preview'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();renderPreview();}
    if(e.target&&e.target.id==='gpt-import-stack-apply'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();applyImport();}
  },true);
  window.tmpImportWeeklyMatrixRaw=txt=>{const ta=$('gpt-import-stack-text');if(ta)ta.value=txt;return renderPreview();}
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Fixes calendar Move/Edit when selecting Breakfast/Lunch/Dinner/Bedtime.
    Older native code only understands AM/PM and can accidentally save keys like:
      Peptide/bedtime/0
    The calendar only reads:
      Peptide/am/0 or Peptide/pm/0
    This sanitizer converts meal-lane keys back to AM/PM while preserving the exact
    meal lane on the inventory item as item.stackLane.
  */
  const MEAL_TO_TIME = {breakfast:'am', lunch:'am', dinner:'pm', bedtime:'pm'};
  const MEAL_ALIASES = {am:['breakfast','lunch'], pm:['dinner','bedtime']};
  window.__tmpDoseFixVer = '20260627-dose-fix3';
  function doseToMcgLocal(dose, unit){
    const d=+dose||0; if(!d) return 0;
    return (unit||'mcg')==='mg'?d*1000:d;
  }
  function warnLoggedDoseMismatch(name){
    try{
      if(!window.S||!S.shots||!name) return;
      const it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
      if(!it||!it.dose) return;
      const invMcg=doseToMcgLocal(it.dose,it.doseUnit||'mcg');
      const bad=(S.shots||[]).filter(s=>{
        if(!s||s.peptide!==name) return false;
        return Math.abs(doseToMcgLocal(s.dose,s.doseUnit||'mcg')-invMcg)>=0.001;
      });
      if(!bad.length) return;
      const doseTxt=(typeof fmtDose==='function'?fmtDose(it.dose,it.doseUnit||'mcg'):(it.dose+' '+(it.doseUnit||'mcg')));
      toast('\u2139 '+name+': '+bad.length+' logged shot'+(bad.length===1?'':'s')+' with a different dose than inventory ('+doseTxt+'). Tap the \uD83D\uDC89 cell \u2192 Edit to fix the log entry.');
    }catch(_){}
  }
  window.tmpWarnLoggedDoseMismatch=warnLoggedDoseMismatch;
  window.tmpDiagnoseCalDose=function(name){
    if(!window.S) return console.log('No S');
    name=name||'KS10';
    const it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
    console.log('[dose diag]',name,'inv',it&&{dose:it.dose,unit:it.doseUnit},'fix',window.__tmpDoseFixVer);
    [0,1,2,3,4,5,6].forEach(di=>{
      ['am','pm'].forEach(time=>{
        const k=name+'/'+time+'/'+di;
        const v=S.sched&&S.sched[k];
        if(v==null||v===false) return;
        const occ=typeof getOccurrenceDose==='function'?getOccurrenceDose(name,time,di):null;
        console.log(' sched',k,v,'→',occ);
      });
    });
    (S.shots||[]).filter(s=>s&&s.peptide===name).forEach(s=>{
      console.log(' shot',s.date,s.time,s.dose,s.doseUnit||'mcg','id',s.id);
    });
  };
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  function repairInvSchedFromStackLane(){
    // Never auto-create S.sched keys from inv.days/stackLane — that undoes delete/clear.
    // Meal-lane key normalization is handled by sanitizeMealLaneScheduleKeys().
    try{
      if(window._tmpSkipSchedRepair) return 0;
      if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()) return 0;
    }catch(_){}
    return 0;
  }
  function sanitizeMealLaneScheduleKeys(){
    try{
      if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()) return 0;
      if(!window.S || !S.sched) return 0;
      let fixed=0;
      Object.keys(S.sched).forEach(k=>{
        if(!S.sched[k]) return;
        const p=window.__tmpParseSchedKey?window.__tmpParseSchedKey(k):null;
        if(!p){
          const parts=k.split('/');
          if(parts.length<3) return;
          p={name:parts[0],lane:parts[1],di:parts[2]};
        }
        const name=p.name, lane=String(p.lane||'').toLowerCase(), di=p.di;
        const time=MEAL_TO_TIME[lane];
        if(!time) return;
        const nk=name+'/'+time+'/'+di;
        // Do not resurrect a cell the user explicitly suppressed on am/pm or meal alias.
        if(S.sched[nk]===false){
          delete S.sched[k];
          fixed++;
          return;
        }
        for(const meal of (MEAL_ALIASES[time]||[])){
          if(S.sched[name+'/'+meal+'/'+di]===false){
            delete S.sched[k];
            fixed++;
            return;
          }
        }
        const mealVal=S.sched[k];
        const canonVal=S.sched[nk];
        // Prefer per-cell dose objects on the canonical am/pm key; never let a
        // stale meal-lane alias (true or wrong dose) clobber a user edit.
        let merged;
        if(typeof canonVal==='object') merged=canonVal;
        else if(canonVal===true) merged=true; // inventory default — ignore stale meal object
        else if(typeof mealVal==='object') merged=mealVal;
        else merged=mealVal!==undefined?mealVal:canonVal;
        if(merged!==undefined&&merged!==false) S.sched[nk]=merged;
        delete S.sched[k];
        // Drop any other meal-lane aliases for this cell once canonical exists.
        for(const meal of (MEAL_ALIASES[time]||[])){
          const alias=name+'/'+meal+'/'+di;
          if(alias!==k) try{ delete S.sched[alias]; }catch(_){}
        }
        const it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
        if(it) it.stackLane=lane;
        fixed++;
      });
      if(fixed){
        try{
          window._tmpBypassCalEnforce=true;
          try{window.save&&window.save()}catch(_){}
          window._tmpBypassCalEnforce=false;
        }catch(_){ window._tmpBypassCalEnforce=false; }
      }
      return fixed;
    }catch(e){console.warn('sanitizeMealLaneScheduleKeys failed',e);return 0}
  }
  // One cell with a stale dose object while siblings use inventory default (true).
  function healLoneStaleDoseCells(){
    try{
      if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()) return 0;
      if(!window.S||!S.sched) return 0;
      const invMcg=(it)=>{
        if(!it||!it.dose) return null;
        const u=it.doseUnit||'mcg';
        return u==='mg'?(+it.dose)*1000:(+it.dose);
      };
      const cellMcg=(v)=>{
        if(!v||typeof v!=='object') return null;
        const u=v.doseUnit||'mcg';
        return u==='mg'?(+v.dose)*1000:(+v.dose);
      };
      const groups=new Map();
      Object.keys(S.sched).forEach(k=>{
        const v=S.sched[k];
        if(v===false||v==null) return;
        const parts=k.split('/');
        if(parts.length<3) return;
        const lane=String(parts[1]||'').toLowerCase();
        if(lane!=='am'&&lane!=='pm') return;
        const gk=parts[0]+'|'+lane;
        if(!groups.has(gk)) groups.set(gk,{name:parts[0],time:lane,cells:[]});
        groups.get(gk).cells.push({k,di:+parts[2],v});
      });
      let fixed=0;
      groups.forEach(({name,cells})=>{
        const it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
        const target=invMcg(it);
        if(target==null) return;
        const objectCells=cells.filter(c=>typeof c.v==='object');
        const trueCells=cells.filter(c=>c.v===true);
        if(!objectCells.length) return;
        objectCells.forEach(c=>{
          if(c.v&&c.v._user) return;
          const loneMcg=cellMcg(c.v);
          if(loneMcg==null||Math.abs(loneMcg-target)<0.001) return;
          // Reset wrong per-cell objects when inventory default applies elsewhere.
          if(trueCells.length>=1||objectCells.length===1){
            S.sched[c.k]=true;
            fixed++;
          }
        });
      });
      if(fixed){
        try{
          window._tmpBypassCalEnforce=true;
          try{window.save&&window.save()}catch(_){}
          window._tmpBypassCalEnforce=false;
        }catch(_){ window._tmpBypassCalEnforce=false; }
      }
      return fixed;
    }catch(e){console.warn('healLoneStaleDoseCells failed',e);return 0}
  }
  // Heal whitespace mismatches between inventory names and schedule-key names.
  // Root cause of the interval-overlay duplicate-row bug: an inventory item
  // named e.g. "SS50 " (stray trailing space, from a rename or vendor/GPT
  // import) while its schedule keys are "SS50/am/di". The interval overlay uses
  // the inventory name and the packed sched cells use the key name, so they no
  // longer match and a phantom duplicate row is drawn. Trimming both sides so
  // the names are identical fixes the data at the source (renderCal also guards
  // defensively with a normalized compare).
  function healWhitespaceNameKeys(){
    try{
      if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()) return 0;
      if(!window.S) return 0;
      let fixed=0;
      // 1) Trim inventory / supply item names.
      (S.inv||[]).forEach(it=>{
        if(!it||typeof it.name!=='string') return;
        const t=it.name.trim();
        if(t && t!==it.name){ it.name=t; fixed++; }
      });
      // 2) Trim the name portion of schedule keys, merging onto the trimmed key.
      if(S.sched){
        Object.keys(S.sched).forEach(k=>{
          const parts=k.split('/');
          if(parts.length<3) return;
          const rawName=parts[0];
          const t=rawName.trim();
          if(!t || t===rawName) return; // no leading/trailing whitespace
          const nk=t+'/'+parts.slice(1).join('/');
          const cur=S.sched[k];
          const existing=S.sched[nk];
          // Merge precedence: explicit suppression (false) wins; then a
          // user/per-cell dose object; then any truthy value. Never let a
          // whitespace-variant key resurrect a suppressed cell.
          if(cur===false || existing===false){
            S.sched[nk]=false;
          }else if(existing===undefined){
            S.sched[nk]=cur;
          }else if(typeof existing==='object'){
            /* keep existing canonical object */
          }else if(typeof cur==='object'){
            S.sched[nk]=cur;
          } /* else both truthy scalars — keep existing */
          try{ delete S.sched[k]; }catch(_){}
          fixed++;
        });
      }
      if(fixed){
        try{
          window._tmpBypassCalEnforce=true;
          try{window.save&&window.save()}catch(_){}
          window._tmpBypassCalEnforce=false;
        }catch(_){ window._tmpBypassCalEnforce=false; }
      }
      return fixed;
    }catch(e){console.warn('healWhitespaceNameKeys failed',e);return 0}
  }
  function selectedContextName(){
    try{
      return (window.CUR && (CUR.name || CUR.peptide || CUR.nm)) ||
        ((document.getElementById('ap-nm')||{}).textContent||'').trim();
    }catch(_){return ''}
  }
  function prepareMealSelectsForNativeSave(){
    ['m-time','ms-time','e-time','e-stime'].forEach(id=>{
      const sel=document.getElementById(id);
      if(!sel) return;
      const lane=String(sel.value||'').toLowerCase();
      if(!MEAL_TO_TIME[lane]) return;
      const name=selectedContextName();
      if(name){
        try{
          const it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
          if(it) it.stackLane=lane;
        }catch(_){}
      }
      sel.dataset.gptMealLane=lane;
      sel.value=MEAL_TO_TIME[lane]; // native saveMove/saveEdit expects this
      setTimeout(()=>{try{sel.value=lane}catch(_){}},160);
    });
  }
  function restoreMealSelectLabels(){
    ['m-time','ms-time','e-time','e-stime'].forEach(id=>{
      const sel=document.getElementById(id);
      if(!sel || sel.dataset.v33327Meal==='1') return;
      const old=sel.value || 'pm';
      sel.dataset.v33327Meal='1';
      const M=window.__tmpSbMealLanes;
      sel.innerHTML=[
        '<option value="breakfast">'+M.breakfast+'</option>',
        '<option value="lunch">'+M.lunch+'</option>',
        '<option value="dinner">'+M.dinner+'</option>',
        '<option value="bedtime">'+M.bedtime+'</option>'
      ].join('');
      const name=selectedContextName();
      let lane='';
      try{
        const it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
        lane=String((it&&it.stackLane)||'').toLowerCase();
      }catch(_){}
      sel.value = MEAL_TO_TIME[lane] ? lane : (old==='am'?'breakfast':'dinner');
    });
  }

  // Convert any existing bad keys as soon as this version loads.
  setTimeout(()=>{
    const w=healWhitespaceNameKeys();
    const n=sanitizeMealLaneScheduleKeys();
    const h=healLoneStaleDoseCells();
    if(w||n||h) try{window.renderCal&&window.renderCal()}catch(_){}
  },300);

  // Make dropdowns show meal lanes when action panel opens.
  const mo=new MutationObserver(()=>{if(window.__tmpMoQuiet.active()||mo.__pending)return;mo.__pending=1;setTimeout(()=>{mo.__pending=0;window.__tmpMoQuiet.run(restoreMealSelectLabels);},40);});
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      const ap=document.getElementById('ap');
      if(ap) mo.observe(ap,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
      restoreMealSelectLabels();
    });
  }else{
    const ap=document.getElementById('ap');
    if(ap) mo.observe(ap,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
    restoreMealSelectLabels();
  }

  // Before native handlers save, convert meal lane to AM/PM.
  document.addEventListener('click',function(e){
    if(e.target && e.target.closest && e.target.closest('#move-save,#edit-save')){
      prepareMealSelectsForNativeSave();
      setTimeout(()=>{
        const n=sanitizeMealLaneScheduleKeys();
        try{window.renderCal&&window.renderCal()}catch(_){}
        if(n) toast('✓ Meal lane saved','Moved item is now stored in the correct AM/PM schedule lane.');
      },260);
    }
    if(e.target && e.target.closest && e.target.closest('#t-move,#t-edit,#move-bk,#edit-bk')){
      setTimeout(restoreMealSelectLabels,90);
    }
    if(e.target && e.target.closest && e.target.closest('[data-pg="calendar"]')){
      setTimeout(()=>{healWhitespaceNameKeys();sanitizeMealLaneScheduleKeys();try{window.renderCal&&window.renderCal()}catch(_){}},180);
    }
  },true);

  // Also sanitize any time renderCal is called.
  __tmpRegisterRenderCalPre(function(){
    healWhitespaceNameKeys();
    sanitizeMealLaneScheduleKeys();
    healLoneStaleDoseCells();
    repairInvSchedFromStackLane();
  });

  window.tmpHealWhitespaceNameKeys=healWhitespaceNameKeys;
  window.tmpSanitizeMealLaneScheduleKeys=sanitizeMealLaneScheduleKeys;
  window.tmpHealLoneStaleDoseCells=healLoneStaleDoseCells;
  window.tmpRepairInvSchedFromStackLane=repairInvSchedFromStackLane;

  // Keep stackPlan + inv.days in sync when user deletes calendar cells — otherwise
  // repairInvSchedFromStackLane / stackPlan overlay re-add suppressed Retatrutide rows.
  (function(){
    const PLAN_KEY='tmp.stackPlan.v1';
    const MEAL_ALIASES={am:['breakfast','lunch'],pm:['dinner','bedtime']};
    const MEAL_TO_TIME={breakfast:'am',lunch:'am',dinner:'pm',bedtime:'pm'};
    function laneTime(lane){
      const l=String(lane||'').toLowerCase();
      return MEAL_TO_TIME[l]||((l==='am'||l==='pm')?l:'pm');
    }
    window.__tmpParseSchedKey=function(k){
      const parts=String(k||'').split('/');
      if(parts.length<3) return null;
      const di=parseInt(parts[parts.length-1],10);
      if(isNaN(di)) return null;
      return {name:parts.slice(0,-2).join('/'),lane:parts[parts.length-2],di};
    };
    window.__tmpResolveSchedName=function(name){
      const n=String(name||'').trim();
      if(!n||!window.S) return n;
      const exact=(S.inv||[]).find(i=>i&&i.name===n&&!i.isSupply);
      if(exact) return exact.name;
      const lower=n.toLowerCase();
      const ci=(S.inv||[]).find(i=>i&&i.name&&i.name.toLowerCase()===lower&&!i.isSupply);
      if(ci) return ci.name;
      const fuzzy=(S.inv||[]).find(i=>{
        if(!i||!i.name||i.isSupply) return false;
        const il=i.name.toLowerCase();
        return il.startsWith(lower)||lower.startsWith(il)||il.includes(lower)||lower.includes(il);
      });
      if(fuzzy) return fuzzy.name;
      const hit=Object.keys(S.sched||{}).find(k=>{
        const p=window.__tmpParseSchedKey(k);
        if(!p) return false;
        const kl=p.name.toLowerCase();
        return kl===lower||kl.startsWith(lower)||lower.startsWith(kl);
      });
      if(hit) return window.__tmpParseSchedKey(hit).name;
      try{
        const plan=Array.isArray(S.stackPlan)?S.stackPlan:JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');
        const p=(plan||[]).find(x=>x&&x.name&&(x.name.toLowerCase()===lower||x.name.toLowerCase().startsWith(lower)||lower.startsWith(x.name.toLowerCase())));
        if(p) return p.name;
      }catch(_){}
      return n;
    };
    function schedKeyMatchesLane(slot,lane,time){
      const s=String(slot||'').toLowerCase();
      const want=String(lane||'').toLowerCase();
      if(want&&MEAL_TO_TIME[want]) return s===want||s===MEAL_TO_TIME[want];
      return laneTime(s)===time;
    }
    function schedKeysForCell(name,time,di,lane){
      const canon=window.__tmpResolveSchedName(name);
      const keys=[];
      if(lane&&MEAL_TO_TIME[lane]){
        keys.push(canon+'/'+MEAL_TO_TIME[lane]+'/'+di);
        keys.push(canon+'/'+lane+'/'+di);
      }else{
        keys.push(canon+'/'+time+'/'+di);
        (MEAL_ALIASES[time]||[]).forEach(meal=>keys.push(canon+'/'+meal+'/'+di));
      }
      return keys;
    }
    function suppressSchedCell(name,time,di,lane){
      if(!window.S||!name||time==null||di==null) return;
      S.sched=S.sched||{};
      const target=window.__tmpResolveSchedName(name).toLowerCase();
      Object.keys(S.sched).forEach(k=>{
        if(!S.sched[k]) return;
        const p=window.__tmpParseSchedKey(k);
        if(!p||p.di!==di||p.name.toLowerCase()!==target) return;
        if(schedKeyMatchesLane(p.lane,lane,time)) S.sched[k]=false;
      });
      schedKeysForCell(name,time,di,lane).forEach(k=>{S.sched[k]=false;});
    }
    function suppressAllSched(name){
      if(!window.S||!name) return;
      const target=window.__tmpResolveSchedName(name).toLowerCase();
      S.sched=S.sched||{};
      Object.keys(S.sched).forEach(k=>{
        const p=window.__tmpParseSchedKey(k);
        if(!p||p.name.toLowerCase()!==target) return;
        S.sched[k]=false;
      });
    }
    function namesMatch(a,b){
      const al=String(a||'').trim().toLowerCase(), bl=String(b||'').trim().toLowerCase();
      if(!al||!bl) return false;
      return al===bl||al.startsWith(bl)||bl.startsWith(al);
    }
    function recomputeInvDays(name){
      const target=window.__tmpResolveSchedName(name).toLowerCase();
      const still=new Set();
      try{
        (Array.isArray(S.stackPlan)?S.stackPlan:[]).forEach(p=>{
          if(!p||String(p.name||'').toLowerCase()!==target) return;
          (p.days||[]).forEach(d=>still.add(d));
        });
      }catch(_){}
      Object.keys(S.sched||{}).forEach(k=>{
        if(!S.sched[k]||S.sched[k]===false) return;
        const p=window.__tmpParseSchedKey(k);
        if(!p||p.name.toLowerCase()!==target) return;
        still.add(p.di);
      });
      const it=(S.inv||[]).find(i=>i&&i.name&&i.name.toLowerCase()===target&&!i.isSupply);
      if(it) it.days=[...still].sort((a,b)=>a-b);
    }
    function pruneAfterDelete(name,time,di,mode,lane){
      if(!window.S||!name) return;
      const canon=window.__tmpResolveSchedName(name);
      const target=canon.toLowerCase();
      let plan=[];
      try{
        plan=Array.isArray(S.stackPlan)?S.stackPlan.slice():JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');
        if(!Array.isArray(plan)) plan=[];
      }catch(_){ plan=[]; }
      if(mode==='all-sched'){
        plan=plan.filter(p=>!p||String(p.name||'').toLowerCase()!==target);
      }else{
        plan=plan.map(p=>{
          if(!p||String(p.name||'').toLowerCase()!==target) return p;
          if(lane&&p.lane&&p.lane!==lane) return p;
          if(laneTime(p.lane)!==time) return p;
          const nd=(p.days||[]).filter(d=>d!==di);
          return Object.assign({},p,{days:nd});
        }).filter(p=>p&&p.days&&p.days.length);
      }
      S.stackPlan=plan;
      try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan));}catch(_){}
      try{
        if(mode==='all-sched'){
          const it=(S.inv||[]).find(i=>i&&i.name&&i.name.toLowerCase()===target&&!i.isSupply);
          if(it) it.days=[];
        }else recomputeInvDays(canon);
      }catch(_){}
    }
    window.__tmpParseSchedTimeFromDom=function(){
      try{
        const dt=String((document.getElementById('ap-dt')||{}).textContent||'').toLowerCase();
        if(/\bpm\b/.test(dt)) return 'pm';
        if(/\bam\b/.test(dt)) return 'am';
      }catch(_){}
      return null;
    };
    window.__tmpParseSchedDiFromDom=function(){
      try{
        const DAYS=window.DAYS||['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const info=String((document.getElementById('ap-info')||{}).textContent||'');
        for(let i=0;i<DAYS.length;i++){ if(info.indexOf(DAYS[i])>=0) return i; }
        const dt=String((document.getElementById('ap-dt')||{}).textContent||'');
        const long=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        for(let i=0;i<long.length;i++){ if(dt.indexOf(long[i])>=0) return i; }
        for(let i=0;i<DAYS.length;i++){ if(dt.indexOf(DAYS[i])>=0) return i; }
      }catch(_){}
      return null;
    };
    window.__tmpCaptureSchedCur=function(ctx){
      if(!ctx||ctx.type!=='sched'||ctx.name==null||ctx.di==null||isNaN(ctx.di)) return;
      const name=window.__tmpResolveSchedName(ctx.name);
      window.__tmpLastSchedCur={
        type:'sched',name,time:ctx.time||'am',di:ctx.di,date:ctx.date,
        lane:ctx.lane||null
      };
    };
    window.__tmpResolveSchedCur=function(){
      try{
        const nmDom=String((document.getElementById('ap-nm')||{}).textContent||'').trim();
        const last=window.__tmpLastSchedCur;
        if(last&&last.type==='sched'&&last.name&&last.di!=null&&!isNaN(last.di)){
          if(!nmDom||namesMatch(last.name,nmDom)) return last;
        }
        const c=window.CUR;
        if(c&&c.type==='sched'&&c.name&&c.di!=null&&!isNaN(c.di)){
          return Object.assign({},c,{name:window.__tmpResolveSchedName(c.name)});
        }
        if(!nmDom) return c||last||null;
        const time=(last&&last.time)||(c&&c.time)||window.__tmpParseSchedTimeFromDom()||'am';
        const di=(last&&last.di!=null&&!isNaN(last.di))?last.di:((c&&c.di!=null&&!isNaN(c.di))?c.di:window.__tmpParseSchedDiFromDom());
        if(di==null||isNaN(di)) return null;
        return {type:'sched',name:window.__tmpResolveSchedName(nmDom),time,di,date:(last&&last.date)||(c&&c.date),lane:(last&&last.lane)||(c&&c.lane)||null};
      }catch(_){ return window.__tmpLastSchedCur||window.CUR||null; }
    };
    if(typeof window.apShow==='function'&&!window.apShow.__tmpSchedCurHook){
      const _apShowOrig=window.apShow;
      window.apShow=function(ctx){
        try{ window.__tmpCaptureSchedCur(ctx); }catch(_){}
        const r=_apShowOrig.apply(this,arguments);
        try{
          if(window.scrollCalActionPanel) scrollCalActionPanel('ap');
          setTimeout(function(){try{window.scrollCalActionPanel&&scrollCalActionPanel('ap');}catch(_){}},450);
        }catch(_){}
        return r;
      };
      window.apShow.__tmpSchedCurHook=true;
    }
    const orig=window.confirmDel;
    if(typeof orig!=='function'||orig.__tmpDelPruneHook) return;
    window.confirmDel=function(mode){
      const ctx=window.__tmpResolveSchedCur();
      if(!ctx||ctx.type!=='sched'||!ctx.name){
        return orig.apply(this,arguments);
      }
      if(mode!=='all-sched'&&(ctx.di==null||isNaN(ctx.di))){
        return orig.apply(this,arguments);
      }
      try{if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()) tmpCalClearGuard.allowName(ctx.name);}catch(_){}
      const name=ctx.name;
      const time=ctx.time;
      const di=ctx.di;
      const lane=ctx.lane||null;
      const prefix=name+'/';
      const _schedSnap={};
      if(mode==='all-sched'){
        Object.keys(S.sched||{}).forEach(k=>{if(k.indexOf(prefix)===0&&S.sched[k])_schedSnap[k]=S.sched[k];});
        suppressAllSched(name);
        pruneAfterDelete(name,time,di,'all-sched',lane);
        try{window.save&&window.save();}catch(_){}
        try{window.apClose&&window.apClose();}catch(_){}
        try{window.refreshAfterSchedChange&&window.refreshAfterSchedChange();}catch(_){}
        try{window.showSchedUndoToast&&window.showSchedUndoToast('All '+name+' cells removed',_schedSnap);}catch(_){}
        return;
      }
      schedKeysForCell(name,time,di,lane).forEach(k=>{if(S.sched&&S.sched[k])_schedSnap[k]=S.sched[k];});
      suppressSchedCell(name,time,di,lane);
      pruneAfterDelete(name,time,di,mode||'one',lane);
      try{window.save&&window.save();}catch(_){}
      try{window.apClose&&window.apClose();}catch(_){}
      try{window.refreshAfterSchedChange&&window.refreshAfterSchedChange();}catch(_){}
      try{
        const dayLabel=(window.DAYS&&window.DAYS[di])||('day '+di);
        window.showSchedUndoToast&&window.showSchedUndoToast(name+' removed from '+dayLabel+' '+(time==='am'?'AM':'PM'),_schedSnap);
      }catch(_){}
    };
    window.confirmDel.__tmpDelPruneHook=true;
    window.__tmpConfirmSchedDelete=function(mode){
      const ctx=window.__tmpResolveSchedCur();
      if(!ctx||ctx.type!=='sched'||!ctx.name) return false;
      if(mode!=='all-sched'&&(ctx.di==null||isNaN(ctx.di))) return false;
      try{if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()) tmpCalClearGuard.allowName(ctx.name);}catch(_){}
      const name=ctx.name;
      const time=ctx.time;
      const di=ctx.di;
      const lane=ctx.lane||null;
      const prefix=name+'/';
      const _schedSnap={};
      if(mode==='all-sched'){
        Object.keys(S.sched||{}).forEach(k=>{if(k.indexOf(prefix)===0&&S.sched[k])_schedSnap[k]=S.sched[k];});
        suppressAllSched(name);
        pruneAfterDelete(name,time,di,'all-sched',lane);
      }else{
        schedKeysForCell(name,time,di,lane).forEach(k=>{if(S.sched&&S.sched[k])_schedSnap[k]=S.sched[k];});
        suppressSchedCell(name,time,di,lane);
        pruneAfterDelete(name,time,di,mode||'one',lane);
      }
      try{window.save&&window.save();}catch(_){}
      try{window.apClose&&window.apClose();}catch(_){}
      try{window.refreshAfterSchedChange&&window.refreshAfterSchedChange();}catch(_){}
      try{
        if(mode==='all-sched') window.showSchedUndoToast&&window.showSchedUndoToast('All '+name+' cells removed',_schedSnap);
        else{
          const dayLabel=(window.DAYS&&window.DAYS[di])||('day '+di);
          window.showSchedUndoToast&&window.showSchedUndoToast(name+' removed from '+dayLabel+' '+(time==='am'?'AM':'PM'),_schedSnap);
        }
      }catch(_){}
      return true;
    };
  })();
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Remembers edits made in "Apply Stack Builder to Weekly Calendar" so the user
    does not need to retype dose/lane/day-pattern values repeatedly.
    Supports all apply modal variants that exist across recent builds:
      - #gpt318-rows
      - #gpt317-rows
      - #gpt-sb-apply-rows
  */
  const KEY = 'tmp.stackBuilder.applyCalendar.memory.v1';

  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  function load(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}') || {}}
    catch(_){return {}}
  }
  function save(obj){
    try{localStorage.setItem(KEY, JSON.stringify(obj||{}));}catch(_){}
  }
  function rowContainers(){
    return ['gpt318-rows','gpt317-rows','gpt-sb-apply-rows'].map(id=>document.getElementById(id)).filter(Boolean);
  }
  function getField(row, names){
    for(const name of names){
      const el = row.querySelector('[data-f="'+name+'"],[data-field="'+name+'"]');
      if(el) return el;
    }
    return null;
  }
  function rowName(row){
    const n = getField(row,['name']);
    return n ? String(n.value||'').trim() : '';
  }
  function rowData(row){
    const out = {};
    const use = getField(row,['use']);
    const name = getField(row,['name']);
    const lane = getField(row,['lane']);
    const dose = getField(row,['dose']);
    const unit = getField(row,['unit']);
    const pattern = getField(row,['pattern']);
    if(use) out.use = !!use.checked;
    if(name) out.name = String(name.value||'').trim();
    if(lane) out.lane = lane.value;
    if(dose) out.dose = dose.value;
    if(unit) out.unit = unit.value;
    if(pattern) out.pattern = pattern.value;
    return out;
  }
  function applyRowData(row, data){
    if(!data) return;
    const use = getField(row,['use']);
    const lane = getField(row,['lane']);
    const dose = getField(row,['dose']);
    const unit = getField(row,['unit']);
    const pattern = getField(row,['pattern']);
    if(use && typeof data.use === 'boolean') use.checked = data.use;
    if(lane && data.lane) lane.value = data.lane;
    if(dose && data.dose !== undefined && data.dose !== null && String(data.dose) !== '') dose.value = data.dose;
    if(unit && data.unit) unit.value = data.unit;
    if(pattern && data.pattern) pattern.value = data.pattern;
  }
  function saveCurrentRows(){
    const mem = load();
    rowContainers().forEach(container=>{
      container.querySelectorAll('tr').forEach((row, idx)=>{
        const name = rowName(row);
        if(!name) return;
        const data = rowData(row);
        data.updated = new Date().toISOString();
        mem[name.toLowerCase()] = data;
      });
    });
    save(mem);
    updateMemoryBadge();
  }
  function restoreRows(){
    const mem = load();
    let restored = 0;
    rowContainers().forEach(container=>{
      container.querySelectorAll('tr').forEach(row=>{
        const name = rowName(row);
        if(!name) return;
        const data = mem[name.toLowerCase()];
        if(data){ applyRowData(row, data); restored++; }
      });
    });
    updateMemoryBadge(restored);
  }
  function clearMemory(){
    try{localStorage.removeItem(KEY)}catch(_){}
    updateMemoryBadge(0);
    toast('Calendar apply values cleared','Previously remembered Stack Builder apply values were removed.');
  }
  function ensureMemoryControls(){
    const modal =
      document.getElementById('gpt318-card') ||
      document.getElementById('gpt317-apply-card') ||
      document.getElementById('gpt-sb-apply-card');
    if(!modal) return;

    // Status pill near heading
    const head = modal.querySelector('.head, .gpt-sb-apply-head');
    if(head && !modal.querySelector('.gpt328-memory-pill')){
      const pill = document.createElement('span');
      pill.className = 'gpt328-memory-pill';
      pill.id = 'gpt328-memory-pill';
      pill.textContent = '↻ remembering edits';
      const title = head.querySelector('b') || head.firstElementChild;
      if(title) title.appendChild(pill);
    }

    // Clear button in the action row
    const actions =
      document.getElementById('gpt318-actions') ||
      document.getElementById('gpt317-actions') ||
      modal.querySelector('.gpt-sb-apply-actions');
    if(actions && !document.getElementById('gpt328-clear-apply-memory')){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'gpt328-clear-apply-memory';
      btn.textContent = 'Clear remembered values';
      btn.onclick = clearMemory;
      actions.appendChild(btn);
    }
  }
  function updateMemoryBadge(restored){
    const pill = document.getElementById('gpt328-memory-pill');
    if(!pill) return;
    const count = Object.keys(load()).length;
    if(restored && restored > 0){
      pill.textContent = '↻ restored '+restored+' row'+(restored===1?'':'s');
    }else{
      pill.textContent = count ? '↻ remembering '+count+' item'+(count===1?'':'s') : '↻ remembering edits';
    }
  }
  function bootModalMemory(){
    ensureMemoryControls();
    setTimeout(restoreRows, 30);
    setTimeout(restoreRows, 160);
  }

  // Save edits while typing/changing in any Apply Calendar modal.
  document.addEventListener('input', function(e){
    if(e.target && e.target.closest && e.target.closest('#gpt318-rows,#gpt317-rows,#gpt-sb-apply-rows')){
      saveCurrentRows();
    }
  }, true);
  document.addEventListener('change', function(e){
    if(e.target && e.target.closest && e.target.closest('#gpt318-rows,#gpt317-rows,#gpt-sb-apply-rows')){
      saveCurrentRows();
    }
  }, true);

  // Restore right after modal-opening buttons are clicked.
  document.addEventListener('click', function(e){
    if(!e.target || !e.target.closest) return;
    if(e.target.closest('#gpt315-open-apply-calendar,#gpt314-build-apply,#gpt-sb-preview-calendar,#gpt318-open-cal,#gpt317-open-cal')){
      setTimeout(bootModalMemory, 120);
      setTimeout(bootModalMemory, 350);
    }
    if(e.target.closest('#gpt318-apply,#gpt317-apply,#gpt-sb-apply-confirm')){
      // Final save before applying.
      saveCurrentRows();
    }
  }, true);

  // Mutation observer catches renderRows() replacing modal table rows.
  const observer = new MutationObserver(function(muts){
    let relevant = false;
    for(const m of muts){
      if(m.target && m.target.id && /^(gpt318-rows|gpt317-rows|gpt-sb-apply-rows)$/.test(m.target.id)){
        relevant = true; break;
      }
    }
    if(relevant){
      setTimeout(bootModalMemory, 40);
    }
  });
  function startObserver(){
    rowContainers().forEach(c=>{
      try{observer.observe(c,{childList:true,subtree:true});}catch(_){}
    });
  }
  __tmpPgInterval(startObserver, 1000, 'pg-stackbuilder');

  window.tmpApplyCalendarMemory = {load, save, clear: clearMemory, restore: restoreRows, saveRows: saveCurrentRows};
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  const PLAN_KEY='tmp.stackPlan.v1';
  const BUILDER_KEY='tmp.stackBuilder.v1';
  const DAYS={daily:[0,1,2,3,4,5,6],weekdays:[0,1,2,3,4],eod:[0,2,4,6],twice:[0,3],three:[1,3,5],once:[0]};
  const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const LANES=Object.assign({},window.__tmpSbMealLanesPlain);
  function getPlan(){
    let plan;
    if(window.S && Array.isArray(S.stackPlan)) plan = S.stackPlan;
    else {
      try{
        const p=JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');
        if(Array.isArray(p)){ if(window.S)S.stackPlan=p; plan = p; }
      }catch(_){}
    }
    if(!plan) plan = [];
    plan = (window.tmpCalClearGuard ? tmpCalClearGuard.planForCalendar(plan) : plan);
    try{
      const merged=mergePlanEntries(plan);
      if(merged.length!==plan.length||JSON.stringify(merged)!==JSON.stringify(plan)){
        plan=merged;
        if(window.S) S.stackPlan=plan;
        try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan));}catch(_){}
      }
    }catch(_){}
    return plan;
  }
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    plan = (plan||[]).filter(x=>x&&x.name);
    plan = mergePlanEntries(plan);
    if(window.tmpCalClearGuard && tmpCalClearGuard.isActive()){
      if(window.S) S.stackPlan = [];
      try{localStorage.setItem(PLAN_KEY,'[]');}catch(_){}
      try{window.save&&window.save()}catch(_){}
      updatePlanCount();
      return plan;
    }
    if(window.S) S.stackPlan = plan;
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan));}catch(_){}
    syncPlanToLegacy(plan);
    try{window.save&&window.save()}catch(_){}
    try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    updatePlanCount();
    return plan;
  }
  function dayPattern(days){
    const s=(days||[]).join(',');
    if(s==='0,1,2,3,4,5,6')return'daily';
    if(s==='0,1,2,3,4')return'weekdays';
    if(s==='0,2,4,6')return'eod';
    if(s==='0,2,4')return'three';
    if(s==='0,3')return'twice';
    if(s==='0')return'once';
    return'custom';
  }
  function refFor(name){
    try{const refs=window.PEPTIDE_REF||PEPTIDE_REF||[];const n=String(name||'').toLowerCase();return refs.find(r=>String(r.n||'').toLowerCase()===n)||refs.find(r=>n&&(n.includes(String(r.n||'').toLowerCase())||String(r.n||'').toLowerCase().includes(n)))}catch(_){return null}
  }
  function patternFromFreq(freq){const f=String(freq||'').toLowerCase();if(/5|weekday/.test(f))return'weekdays';if(/3/.test(f))return'tree';if(/2|twice/.test(f))return'twice';if(/once|weekly|1×|1x/.test(f))return'once';if(/every other|eod/.test(f))return'eod';return'daily'}
  function defaultDose(name, unitFallback){
    const ref=refFor(name);
    if(ref) return {dose:ref.startD!=null?ref.startD:'',unit:ref.unit||unitFallback||'mcg'};
    if(/vitamin|support|omega|creatine|protein/i.test(name)) return {dose:1,unit:'pill'};
    return {dose:'',unit:unitFallback||'mcg'};
  }
  function canonical(raw){
    const t=String(raw||'').trim(), l=t.toLowerCase();
    if(/^rt\s*30$|^rt30$|retatrutide|reta/.test(l))return'Retatrutide';
    if(/^klow$|klotho/.test(l))return'Klow';
    if(/^vit|vitamins?/.test(l))return'Vitamins / support stack';
    if(/^bpc$|bpc-?157/.test(l))return'BPC-157';
    if(/^tb$|tb-?500/.test(l))return'TB-500';
    if(/^cp\s*20$|^cp20$/.test(l))return'CP20';
    if(/^cjc$|cjc-?1295/.test(l))return'CJC-1295 (no DAC)';
    if(/ipamorelin|\bipa\b/.test(l))return'Ipamorelin';
    if(/tesamorelin|^tesa/.test(l))return'Tesamorelin';
    if(/^dsip/.test(l))return'DSIP';
    return t;
  }
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function legacyKey(name,time,di){return name+'/'+time+'/'+di}
  function mergePlanEntries(plan){
    const map=new Map();
    (plan||[]).forEach(p=>{
      if(!p||!p.name) return;
      const k=String(p.name).toLowerCase()+'|'+String(p.lane||'').toLowerCase();
      if(!map.has(k)) map.set(k,Object.assign({},p,{days:(p.days||[]).slice()}));
      else{
        const ex=map.get(k);
        ex.days=[...new Set([...(ex.days||[]),...(p.days||[])])].sort((a,b)=>a-b);
      }
    });
    return [...map.values()].map(p=>{
      try{
        const it=(S.inv||[]).find(i=>i&&i.name===p.name&&!i.isSupply);
        if(it&&it.dose>0) return Object.assign({},p,{dose:it.dose,unit:it.doseUnit||p.unit||'mcg'});
      }catch(_){}
      return p;
    });
  }
  function syncPlanToLegacy(plan){
    plan = (window.tmpCalClearGuard ? tmpCalClearGuard.filterPlanForClearGuard(plan) : (plan || []));
    if(!plan.length) return;
    if(!window.S) return;
    S.inv=S.inv||[]; S.sched=S.sched||{}; if(typeof S.nI!=='number')S.nI=Date.now();
    const MEAL_TO_TIME={breakfast:'am',lunch:'am',dinner:'pm',bedtime:'pm'};
    const names=new Set((plan||[]).map(p=>p.name));
    // Remove stale meal-lane alias keys only — keep canonical am/pm dose overrides.
    names.forEach(name=>Object.keys(S.sched).forEach(k=>{
      if(k.indexOf(name+'/')!==0||S.sched[k]===false) return;
      const parts=k.split('/');
      if(parts.length<3) return;
      const lane=String(parts[parts.length-2]||'').toLowerCase();
      if(MEAL_TO_TIME[lane]) delete S.sched[k];
    }));
    (plan||[]).forEach(p=>{
      let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
      if(!it){it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:+p.dose||0,doseUnit:p.unit||'mcg',cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};S.inv.push(it)}
      if(p.dose!==''&&!isNaN(+p.dose)) it.dose=+p.dose;
      it.doseUnit=p.unit||it.doseUnit||'mcg';
      it.stackLane=p.lane;
      it.days=(p.days||[]).slice();
      it.importPurpose=p.purpose||'';
      const t=timeForLane(p.lane);
      (p.days||[]).forEach(di=>{
        const canon=legacyKey(it.name,t,di);
        if(S.sched[canon]===false) return;
        if(!S.sched[canon]||S.sched[canon]===true) S.sched[canon]=true;
      });
    });
  }
  function builderCandidates(){
    let rows=[];
    try{
      const st=Object.assign({lanes:[],options:[],virtual:[]},JSON.parse(localStorage.getItem(BUILDER_KEY)||'{}'));
      const txt=[...(st.lanes||[]),...(st.options||[]),...(st.virtual||[])].join(' ');
      if(/fat|reta|glp/i.test(txt)) rows.push({name:'Retatrutide',lane:'breakfast',days:DAYS.twice,purpose:'fat loss / appetite'});
      if(/sleep|gh|tesa/i.test(txt)) rows.push({name:'Tesamorelin',lane:'bedtime',days:DAYS.three,purpose:'GH / sleep lane'});
      if(/cjc|ipa|ipamorelin/i.test(txt)){rows.push({name:'CJC-1295 (no DAC)',lane:'bedtime',days:DAYS.twice,purpose:'GH pulse'});rows.push({name:'Ipamorelin',lane:'bedtime',days:DAYS.twice,purpose:'GH pulse'});}
      if(/recovery|injury|bpc|tb/i.test(txt)){rows.push({name:'BPC-157',lane:'dinner',days:DAYS.three,purpose:'recovery / injury'});rows.push({name:'TB-500',lane:'dinner',days:DAYS.three,purpose:'recovery / injury'});}
      if(/muscle|retention|creatine/i.test(txt)) rows.push({name:'Creatine',lane:'lunch',days:DAYS.daily,purpose:'muscle support'});
      if(/metabolic|lipid|omega/i.test(txt)) rows.push({name:'Omega-3',lane:'lunch',days:DAYS.daily,purpose:'metabolic support'});
    }catch(_){}
    if(!rows.length && window.S && S.inv){rows=(S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).slice(0,8).map(i=>({name:i.name,lane:i.stackLane||'dinner',days:i.days&&i.days.length?i.days:DAYS.daily,purpose:i.importPurpose||'inventory'}));}
    const seen=new Set();
    return rows.filter(r=>{const k=r.name.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).map(r=>{const du=defaultDose(r.name);return Object.assign({dose:du.dose,unit:du.unit},r)});
  }
  function ensureModal(){
    let m=$('gpt329-modal'); if(m)return m;
    m=document.createElement('div'); m.id='gpt329-modal';
    m.innerHTML='<div class="gpt329-modal"><div class="head"><div><b>Local Stack Plan Engine</b><p>Edit once. Save once. The Weekly Calendar renders directly from this plan.</p></div><button type="button" id="gpt329-close">Close</button></div><div id="gpt329-toolbar"><div><label>Start from</label><select id="gpt329-source"><option value="current">Current saved plan</option><option value="builder">Builder draft</option><option value="inventory">Inventory</option></select></div><div><label>Default day pattern</label><select id="gpt329-default-pattern"><option value="">Keep each item</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="eod">Every other day</option><option value="three">3× weekly</option><option value="twice">2× weekly</option><option value="once">Once weekly</option></select></div><div><label>Status</label><input id="gpt329-status" readonly></div></div><div id="gpt329-wrap"><table id="gpt329-table"><thead><tr><th>Use</th><th>Item</th><th>Lane</th><th>Dose</th><th>Unit</th><th>Days</th><th>Purpose</th></tr></thead><tbody id="gpt329-rows"></tbody></table></div><div id="gpt329-actions"><button type="button" class="primary" id="gpt329-save-plan">Save plan + update calendar</button><button type="button" id="gpt329-add-row">+ Row</button><button type="button" id="gpt329-clear-plan">Clear plan</button><button type="button" id="gpt329-open-calendar">Open Weekly Calendar</button></div><div id="gpt329-debug">Ready.</div></div>';
    document.body.appendChild(m);
    $('gpt329-close').onclick=()=>m.style.display='none';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'});
    $('gpt329-source').onchange=()=>renderModalRows();
    $('gpt329-default-pattern').onchange=()=>{const v=$('gpt329-default-pattern').value;if(v)document.querySelectorAll('#gpt329-rows [data-f="days"]').forEach(s=>s.value=v)};
    $('gpt329-save-plan').onclick=saveModalPlan;
    $('gpt329-add-row').onclick=()=>{addModalRow({name:'',lane:'lunch',days:DAYS.daily,dose:'',unit:'mcg',purpose:''})};
    $('gpt329-clear-plan').onclick=()=>{savePlan([]);renderModalRows();renderStackPlanCalendar();toast('Local stack plan cleared')};
    $('gpt329-open-calendar').onclick=()=>{m.style.display='none';document.querySelector('[data-pg="calendar"]')?.click();};
    return m;
  }
  function rowsFromSource(){
    const src=($('gpt329-source')||{}).value||'current';
    if(src==='builder')return builderCandidates();
    if(src==='inventory')return (S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>({name:i.name,lane:i.stackLane||'dinner',days:i.days&&i.days.length?i.days:DAYS.daily,dose:i.dose||'',unit:i.doseUnit||'mcg',purpose:i.importPurpose||'inventory'}));
    return getPlan().length?getPlan():builderCandidates();
  }
  function addModalRow(r){
    const body=$('gpt329-rows'); if(!body)return;
    const pattern=dayPattern(r.days||DAYS.daily);
    const tr=document.createElement('tr');
    tr.innerHTML='<td><input type="checkbox" data-f="use" checked></td><td><input type="text" data-f="name" value="'+esc(r.name||'')+'"></td><td><select data-f="lane">'+Object.keys(LANES).map(k=>'<option value="'+k+'" '+(r.lane===k?'selected':'')+'>'+LANES[k]+'</option>').join('')+'</select></td><td><input type="number" data-f="dose" step="any" min="0" value="'+esc(r.dose||'')+'"></td><td><select data-f="unit">'+['mcg','mg','iu','ml','pill'].map(u=>'<option '+(String(r.unit||'').toLowerCase()===u?'selected':'')+'>'+u+'</option>').join('')+'</select></td><td><select data-f="days">'+[['daily','Daily'],['weekdays','Weekdays'],['eod','Every other day'],['three','3× weekly'],['twice','2× weekly'],['once','Once weekly']].map(p=>'<option value="'+p[0]+'" '+(pattern===p[0]?'selected':'')+'>'+p[1]+'</option>').join('')+'</select></td><td><input type="text" data-f="purpose" value="'+esc(r.purpose||'')+'"></td>';
    body.appendChild(tr);
  }
  function renderModalRows(){
    const body=$('gpt329-rows'); if(!body)return;
    body.innerHTML='';
    rowsFromSource().forEach(addModalRow);
    $('gpt329-status').value=body.querySelectorAll('tr').length+' item(s) loaded.';
  }
  function collectModalPlan(){
    const out=[];
    document.querySelectorAll('#gpt329-rows tr').forEach(tr=>{
      const q=f=>tr.querySelector('[data-f="'+f+'"]');
      if(!q('use')||!q('use').checked)return;
      const name=canonical((q('name').value||'').trim()); if(!name)return;
      const du=defaultDose(name,q('unit').value);
      out.push({id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,lane:q('lane').value,dose:q('dose').value!==''?parseFloat(q('dose').value):du.dose,unit:q('unit').value||du.unit,days:DAYS[q('days').value]||DAYS.daily,purpose:q('purpose').value||''});
    });
    return out;
  }
  function saveModalPlan(){
    const plan=collectModalPlan();
    try { if(window.tmpCalClearGuard) tmpCalClearGuard.releaseForExplicitPlan(plan); } catch(_){}
    savePlan(plan);
    renderStackPlanCalendar();
    $('gpt329-debug').textContent='Saved S.stackPlan:\n'+JSON.stringify(plan,null,2);
    toast('✓ Local stack plan saved',plan.length+' item'+(plan.length===1?'':'s')+' now render the Weekly Calendar.');
  }
  function openModal(){
    ensureModal();
    renderModalRows();
    $('gpt329-modal').style.display='flex';
  }
  function updatePlanCount(){
    const el=$('gpt329-plan-count'); if(el)el.textContent=getPlan().length||0;
  }
  function currentWeekDays(){
    try{return wkD(S.wkOff)}catch(_){const d=new Date();const mon=new Date(d);mon.setDate(d.getDate()-((d.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);return x})}
  }
  function dateKey(d){try{return fmD(d)}catch(_){return d.toISOString().slice(0,10)}}
  function cellHtml(item,di,days){
    if(!(item.days||[]).includes(di)) return '<div class="sc e">—</div>';
    const t=timeForLane(item.lane);
    try{
      if(typeof schedCellActive==='function'&&!schedCellActive(item.name,t,di)) return '<div class="sc e">—</div>';
    }catch(_){
      const schedKey=item.name+'/'+t+'/'+di;
      if(window.S&&S.sched&&S.sched[schedKey]===false) return '<div class="sc e">—</div>';
    }
    let c={bg:'#EEF2FF',text:'#1E3A8A',border:'#60A5FA'};
    try{if(typeof pepColor==='function')c=pepColor(item.name)}catch(_){}
    let doseTxt='';
    try{
      if(typeof getOccurrenceDose==='function'&&typeof fmtDose==='function'){
        const occ=getOccurrenceDose(item.name,t,di);
        doseTxt=fmtDose(occ.dose,occ.doseUnit)||'';
      }
    }catch(_){}
    if(!doseTxt&&item.dose!==''&&item.dose!=null) doseTxt=String(item.dose)+' '+String(item.unit||'');
    const dose=doseTxt?('<div style="font-size:8px;font-weight:500;opacity:.72;line-height:1;margin-top:1px">'+esc(doseTxt)+'</div>'):'';
    const short=item.name.length>10?item.name.slice(0,9)+'…':item.name;
    const ds=dateKey(currentWeekDays()[di]);
    return '<button type="button" class="sc active gpt329-plan-cell" data-type="sched" data-pep="'+esc(item.name)+'" data-time="'+esc(t)+'" data-di="'+di+'" data-date="'+esc(ds)+'" data-plan-name="'+esc(item.name)+'" data-plan-lane="'+esc(item.lane)+'" data-plan-di="'+di+'" style="background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+';flex-direction:column"><div style="font-size:9.5px;font-weight:700;line-height:1">'+esc(short)+'</div>'+dose+'</button>';
  }
  const CAL_PLAN_ROW_HOSTS=['cal-breakfast-rows','cal-lunch-rows','cal-dinner-rows','cal-bedtime-rows'];
  function clearPlanOverlayRows(){
    CAL_PLAN_ROW_HOSTS.forEach(id=>{
      const host=$(id);
      if(host) host.querySelectorAll('.gpt329-plan-row').forEach(r=>r.remove());
    });
  }
  // P0-DSIP-FIX-IMPLEMENT-R1 (Option A): overlay only when S.sched has active cells.
  function schedHasKeysForName(name,time){
    if(!window.S||!S.sched||!name) return false;
    if(typeof schedCellActive==='function'&&time){
      for(let di=0;di<7;di++){ if(schedCellActive(name,time,di)) return true; }
      return false;
    }
    const p=String(name)+'/';
    return Object.keys(S.sched).some(k=>k.indexOf(p)===0&&S.sched[k]&&(S.sched[k]===true||typeof S.sched[k]==='object'));
  }
  function planDisplayLane(item){
    if(!item || !item.name) return item && item.lane;
    try {
      const it = (S.inv || []).find(i => i && i.name === item.name && !i.isSupply);
      if(it && LANES[it.stackLane]) return it.stackLane;
    } catch(_){}
    return item.lane;
  }
  function renderLane(lane,id){
    const host=$(id); if(!host)return;
    const time=timeForLane(lane);
    const plan=getPlan().filter(p=>planDisplayLane(p)===lane&&schedHasKeysForName(p.name,time));
    // CG10-RENDER-OWNERSHIP-TRACE-R1 / MEAL-MOVE-CALENDAR-RENDER-OVERLAP-R1 (Option A):
    // preserve renderCal schedule rows; stackPlan paints only .gpt329-plan-row overlays.
    host.querySelectorAll('.gpt329-plan-row').forEach(r=>r.remove());
    if(!plan.length)return;
    // RC-G: renderCal already paints a real schedule cell for every active
    // S.sched key (and every interval-due day). The "load from inventory"
    // quick-add writes BOTH S.sched AND S.stackPlan, so without a dedup this
    // overlay repaints a SECOND cell on top of renderCal's — the "double entry"
    // (and "delete one deletes both", since both point at the same sched key).
    // Two guards:
    //  1) Skip interval-managed peptides entirely. renderCal owns them via the
    //     interval overlay; painting their plan day-of-week cells would also
    //     resurrect the exact rows renderCal intentionally suppresses (RC-F).
    //  2) For the rest, only paint on days renderCal did NOT already render,
    //     deduping against the live non-plan cells already in this lane host.
    const _norm=s=>String(s==null?'':s).trim().toLowerCase();
    const _intervalManaged=new Set(((window.S&&S.inv)||[]).filter(i=>i&&!i.isSupply&&i.interval>0).map(i=>_norm(i.name)));
    const covered=new Set();
    host.querySelectorAll('.sc.active[data-pep]:not(.gpt329-plan-cell)').forEach(c=>{
      covered.add(_norm(c.dataset.pep)+'|'+c.dataset.di);
    });
    plan.forEach(item=>{
      const nm=_norm(item.name);
      if(_intervalManaged.has(nm)) return;
      const row=document.createElement('div'); row.className='srow gpt329-plan-row';
      row.innerHTML=Array.from({length:7},(_,di)=> covered.has(nm+'|'+di) ? '<div class="sc e">—</div>' : cellHtml(item,di)).join('');
      // Nothing left to overlay once renderCal's cells are excluded → drop the row.
      if(!row.querySelector('.gpt329-plan-cell')) return;
      row.style.opacity='.88';
      host.appendChild(row);
    });
  }
  function renderStackPlanCalendar(){
    if(window.tmpCalClearGuard && tmpCalClearGuard.isActive()){
      try { tmpCalClearGuard.enforceLight(); } catch(_){}
      clearPlanOverlayRows();
      return false;
    }
    clearPlanOverlayRows();
    const plan=getPlan();
    if(!plan.length)return false;
    renderLane('breakfast','cal-breakfast-rows');
    renderLane('lunch','cal-lunch-rows');
    renderLane('dinner','cal-dinner-rows');
    renderLane('bedtime','cal-bedtime-rows');
    return true;
  }
  __tmpRegisterRenderCalPost(renderStackPlanCalendar);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.id==='gpt329-build-plan'){e.preventDefault();openModal();}
    if(e.target&&e.target.id==='gpt329-open-plan-calendar'){e.preventDefault();document.querySelector('[data-pg="calendar"]')?.click();setTimeout(renderStackPlanCalendar,150);}
    const cell=e.target&&e.target.closest&&e.target.closest('.gpt329-plan-cell');
    if(cell&&window.apShow){
      const name=cell.dataset.planName||cell.dataset.pep, lane=cell.dataset.planLane, di=parseInt(cell.dataset.planDi!=null?cell.dataset.planDi:cell.dataset.di,10);
      if(!name||isNaN(di)) return;
      const ctx={type:'sched',name,date:dateKey(currentWeekDays()[di]),time:timeForLane(lane),di,lane};
      window.__tmpCaptureSchedCur&&window.__tmpCaptureSchedCur(ctx);
      apShow(ctx);
      e.stopImmediatePropagation();
    }
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="calendar"]'))setTimeout(renderStackPlanCalendar,160);
  },true);
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(updatePlanCount,160)},true);
  setTimeout(()=>{updatePlanCount();},500);
  window.tmpStackPlan={get:getPlan,save:savePlan,render:renderStackPlanCalendar,open:openModal,sync:syncPlanToLegacy};
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Fixes Weekly Calendar Move panel after introducing meal lanes + S.stackPlan.
    Problems fixed:
      - New time dropdown could render blank.
      - Move button still expected old AM/PM values.
      - Moving an S.stackPlan-rendered item did not update S.stackPlan.
  */
  const LANES=Object.assign({},window.__tmpSbMealLanes);
  const LANE_TO_TIME = {breakfast:'am', lunch:'am', dinner:'pm', bedtime:'pm'};
  const TIME_TO_DEFAULT_LANE = {am:'breakfast', pm:'dinner'};
  const PLAN_KEY = 'tmp.stackPlan.v1';

  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function legacyKey(name,time,di){return name+'/'+time+'/'+di}
  function getPlan(){
    let plan;
    if(window.S && Array.isArray(S.stackPlan)) plan = S.stackPlan;
    else {
      try{
        const p = JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');
        if(Array.isArray(p)){ if(window.S) S.stackPlan=p; plan = p; }
      }catch(_){}
    }
    if(!plan) plan = [];
    return (window.tmpCalClearGuard ? tmpCalClearGuard.planForCalendar(plan) : plan);
  }
  function savePlan(plan){
    if(window.tmpCalClearGuard && tmpCalClearGuard.isActive()){
      if(window.S) S.stackPlan = [];
      try{localStorage.setItem(PLAN_KEY,'[]');}catch(_){}
      return plan;
    }
    if(window.S) S.stackPlan = plan || [];
    try{localStorage.setItem(PLAN_KEY, JSON.stringify(plan||[]));}catch(_){}
  }
  function currentContext(){
    try{
      if(typeof window.__tmpResolveSchedCur==='function'){
        const c=window.__tmpResolveSchedCur();
        if(c&&c.name) return c;
      }
      return window.CUR || {};
    }catch(_){return {}}
  }
  function currentName(){
    const ctx=currentContext();
    return ctx.name || ctx.peptide || ctx.nm || (($('ap-nm')||{}).textContent||'').trim();
  }
  function currentTime(){
    const ctx=currentContext();
    return ctx.time || (($('ap-dt')||{}).textContent||'').toLowerCase().includes('am')?'am':'pm';
  }
  function currentLaneFor(name,time){
    const plan=getPlan();
    const p=plan.find(x=>x && x.name===name);
    if(p && LANES[p.lane]) return p.lane;
    try{
      const it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
      if(it && LANES[it.stackLane]) return it.stackLane;
    }catch(_){}
    return TIME_TO_DEFAULT_LANE[time] || 'dinner';
  }
  function populateMealSelect(sel){
    if(!sel) return;
    const name=currentName();
    const ctx=currentContext();
    const time=ctx.time || 'pm';
    const previous = sel.value;
    sel.innerHTML = Object.keys(LANES).map(k=>'<option value="'+k+'">'+LANES[k]+'</option>').join('');
    let lane = LANES[previous] ? previous : currentLaneFor(name,time);
    sel.value = lane;
    if(!sel.value) sel.value = 'dinner';
    sel.dataset.gptMealLaneSelect = '1';
  }
  function populateMovePanel(){
    populateMealSelect($('ms-time'));
    populateMealSelect($('m-time'));
    populateMealSelect($('e-time'));
    populateMealSelect($('e-stime'));
  }
  function syncLegacyForPlanItem(item){
    try{ if(window.tmpCalClearGuard && item&&item.name) tmpCalClearGuard.allowSchedNames(item.name); }catch(_){}
    if(!window.S || !item || !item.name) return;
    S.sched = S.sched || {};
    Object.keys(S.sched).forEach(k=>{ if(k.indexOf(item.name+'/')===0) delete S.sched[k]; });
    const time = LANE_TO_TIME[item.lane] || 'pm';
    (item.days||[]).forEach(di=>{ S.sched[legacyKey(item.name,time,di)] = true; });
    try{
      const inv=(S.inv||[]).find(i=>i&&i.name===item.name&&!i.isSupply);
      if(inv){ inv.stackLane=item.lane; inv.days=(item.days||[]).slice(); inv.dose=item.dose; inv.doseUnit=item.unit||inv.doseUnit; }
    }catch(_){}
  }
  function movePlanOrLegacy(){
    const ctx=currentContext();
    if(!ctx || ctx.type!=='sched') return false;
    const name=ctx.name;
    const daySel=$('ms-day');
    const laneSel=$('ms-time');
    if(!name || !daySel || !laneSel) return false;

    try{ if(window.tmpCalClearGuard && name) tmpCalClearGuard.allowSchedNames(name); }catch(_){}

    const newDi=parseInt(daySel.value,10);
    let newLane=laneSel.value;
    if(!LANES[newLane]){
      // Fallback if any older handler left AM/PM in the select
      newLane = newLane === 'am' ? 'breakfast' : 'dinner';
    }
    const newTime=LANE_TO_TIME[newLane] || 'pm';

    // First update S.stackPlan if the item exists there.
    const plan=getPlan();
    let p=plan.find(x=>x && x.name===name);
    if(p){
      p.lane=newLane;
      p.days=[newDi];
      savePlan(plan);
      syncLegacyForPlanItem(p);
    }else{
      // Otherwise update legacy schedule directly.
      if(window.S){
        S.sched=S.sched||{};
        if(ctx.time!=null && ctx.di!=null) delete S.sched[legacyKey(name,ctx.time,ctx.di)];
        // Also remove accidental meal-lane keys.
        ['breakfast','lunch','dinner','bedtime','am','pm'].forEach(t=>{
          if(ctx.di!=null) delete S.sched[legacyKey(name,t,ctx.di)];
        });
        S.sched[legacyKey(name,newTime,newDi)] = true;
        let it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
        if(it){ it.stackLane=newLane; it.days=[newDi]; }
      }
    }

    try{window.save&&window.save()}catch(_){}
    try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    try{
      if(typeof window.renderCal==='function') window.renderCal();
      if(typeof window.tmpStackPlan?.render==='function') window.tmpStackPlan.render();
      if(typeof window.renderStack==='function') window.renderStack();
    }catch(_){}
    try{ if(typeof window.apClose==='function') window.apClose(); }catch(_){}
    toast('✓ Moved '+name, 'Moved to '+(LANES[newLane]||newLane)+' on '+(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][newDi]||'selected day')+'.');
    return true;
  }

  // Populate dropdown whenever the action panel changes.
  const observe = () => {
    const ap=$('ap');
    if(!ap) return;
    const mo=new MutationObserver(()=>{if(window.__tmpMoQuiet.active()||mo.__pending)return;mo.__pending=1;setTimeout(()=>{mo.__pending=0;window.__tmpMoQuiet.run(populateMovePanel);},40);});
    mo.observe(ap,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{observe();setTimeout(populateMovePanel,500)});
  else {observe();setTimeout(populateMovePanel,500);}

  // Capture Move click before old saveMove handler.
  window.addEventListener('click',function(e){
    if(e.target && e.target.closest && e.target.closest('#t-move,#move-bk,#t-edit,#edit-bk')){
      setTimeout(populateMovePanel,80);
    }
    if(e.target && e.target.closest && e.target.closest('#move-save')){
      // Only intercept scheduled-cell moves; logged-shot moves still use native date/time.
      const ctx=currentContext();
      if(ctx && ctx.type==='sched'){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        movePlanOrLegacy();
      }
    }
  },true);

  // Public helper.
  window.tmpFixMovePanelMealLanes = populateMovePanel;
})();


// ===== extracted post-core patch script =====
// (removed 20260707) duplicate move-button patch (gpt331) — superseded by the gpt332 version below; the two fought over cloning #move-save.


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Move still failed because the original app's CUR variable is a top-level `let`,
    not window.CUR, so patches could not read the selected cell context.
    This rebuild infers the context from the visible action panel:
      #ap-nm = item name
      #ap-dt = "Monday, May 4 · PM scheduled"
    Then it rewires #move-save and updates stackPlan/S.sched directly.
  */
  const PLAN_KEY='tmp.stackPlan.v1';
  const LANES=Object.assign({},window.__tmpSbMealLanes);
  const LANE_TO_TIME={breakfast:'am',lunch:'am',dinner:'pm',bedtime:'pm'};
  const TIME_TO_LANE={am:'breakfast',pm:'dinner'};
  const DAY_MAP={monday:0,mon:0,tuesday:1,tue:1,tues:1,wednesday:2,wed:2,thursday:3,thu:3,thur:3,thurs:3,friday:4,fri:4,saturday:5,sat:5,sunday:6,sun:6};
  const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function key(n,t,d){return n+'/'+t+'/'+d}
  function panelText(id){return (($ (id)||{}).textContent||'').trim()}
  function getPlan(){
    let plan;
    if(window.S && Array.isArray(S.stackPlan)) plan = S.stackPlan;
    else {
      try{
        const p=JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');
        if(Array.isArray(p)){ if(window.S) S.stackPlan=p; plan = p; }
      }catch(_){}
    }
    if(!plan) plan = [];
    return (window.tmpCalClearGuard ? tmpCalClearGuard.planForCalendar(plan) : plan);
  }
  function setPlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()) plan=tmpCalClearGuard.filterPlanForClearGuard(plan||[]);
    if(window.S)S.stackPlan=plan||[];
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan||[]))}catch(_){}
  }
  function inferContext(){
    if(typeof window.__tmpResolveSchedCur==='function'){
      const resolved=window.__tmpResolveSchedCur();
      if(resolved&&resolved.name) return resolved;
    }
    // Try original exposed context first, but do not rely on it.
    let c={};
    try{ if(window.CUR) c=Object.assign({},window.CUR); }catch(_){}
    const nm=panelText('ap-nm');
    const dt=panelText('ap-dt').toLowerCase();
    if(!c.name && nm) c.name=nm;
    if(c.di==null){
      const m=dt.match(/\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/i);
      if(m) c.di=DAY_MAP[m[1].toLowerCase()];
    }
    if(!c.time){
      if(/\bam\b/.test(dt)) c.time='am';
      else if(/\bpm\b/.test(dt)) c.time='pm';
    }
    if(!c.type){
      c.type=/scheduled/.test(dt)?'sched':'logged';
    }
    return c;
  }
  function fillMoveSelect(){
    const s=$('ms-time');
    if(!s) return;
    const c=inferContext();
    const old=s.value;
    s.innerHTML=Object.keys(LANES).map(k=>'<option value="'+k+'">'+LANES[k]+'</option>').join('');
    let lane = LANES[old] ? old : itemLane(c.name,c.time,c.di);
    s.value = lane || 'dinner';
    s.dataset.gpt332Meal='1';
  }
  function itemLane(name,time,di){
    const plan=getPlan();
    let p=plan.find(x=>x&&x.name===name&&(x.days||[]).includes(di));
    if(p&&LANES[p.lane])return p.lane;
    p=plan.find(x=>x&&x.name===name);
    if(p&&LANES[p.lane])return p.lane;
    try{
      const it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
      if(it&&LANES[it.stackLane])return it.stackLane;
    }catch(_){}
    return TIME_TO_LANE[time]||'dinner';
  }
  function syncLegacyForPlan(plan){
    plan = (window.tmpCalClearGuard ? tmpCalClearGuard.filterPlanForClearGuard(plan) : (plan || []));
    if(!plan.length) return;
    if(!window.S)return;
    S.sched=S.sched||{};
    const names=new Set((plan||[]).map(p=>p&&p.name).filter(Boolean));
    names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
    (plan||[]).forEach(p=>{
      if(!p||!p.name)return;
      const t=LANE_TO_TIME[p.lane]||'pm';
      (p.days||[]).forEach(di=>{S.sched[key(p.name,t,di)]=true});
      try{
        const it=(S.inv||[]).find(i=>i&&i.name===p.name&&!i.isSupply);
        if(it){it.stackLane=p.lane;it.days=[...new Set([...(it.days||[]),...(p.days||[])])].sort((a,b)=>a-b);if(p.dose!==undefined)it.dose=p.dose;if(p.unit)it.doseUnit=p.unit;}
      }catch(_){}
    });
  }
  function movePlanOccurrence(name, oldDi, newDi, newLane){
    let plan=getPlan().slice();
    let moved=false;
    const additions=[];
    plan.forEach(p=>{
      if(!p||p.name!==name)return;
      const days=p.days||[];
      if(!days.includes(oldDi))return;
      // Remove just the old occurrence from this row.
      p.days=days.filter(d=>d!==oldDi);
      const clone=Object.assign({},p,{lane:newLane,days:[newDi]});
      additions.push(clone);
      moved=true;
    });
    plan=plan.filter(p=>p&&p.name&&p.days&&p.days.length);
    additions.forEach(a=>{
      const ex=plan.find(p=>p.name===a.name&&p.lane===a.lane&&String(p.dose)===String(a.dose)&&String(p.unit)===String(a.unit)&&String(p.purpose||'')===String(a.purpose||''));
      if(ex) ex.days=[...new Set([...(ex.days||[]),newDi])].sort((x,y)=>x-y);
      else plan.push(a);
    });
    if(moved){
      setPlan(plan);
      syncLegacyForPlan(plan);
    }
    return moved;
  }
  function moveLegacy(name, oldTime, oldDi, newDi, newLane){
    if(!window.S)return;
    try{ if(window.tmpCalClearGuard && name) tmpCalClearGuard.allowSchedNames(name); }catch(_){}
    S.sched=S.sched||{};
    let moveVal;
    [oldTime,'am','pm','breakfast','lunch','dinner','bedtime'].forEach(t=>{
      const v=S.sched[key(name,t,oldDi)];
      if(v&&v!==false){
        if(typeof v==='object') moveVal=v;
        else if(moveVal===undefined) moveVal=true;
      }
    });
    [oldTime,'am','pm','breakfast','lunch','dinner','bedtime'].forEach(t=>{S.sched[key(name,t,oldDi)]=false;});
    const newTime=LANE_TO_TIME[newLane]||'pm';
    S.sched[key(name,newTime,newDi)]=moveVal!=null?moveVal:true;
    try{
      const it=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply);
      if(it){it.stackLane=newLane;it.days=[...new Set([...(it.days||[]).filter(d=>d!==oldDi),newDi])].sort((a,b)=>a-b);}
    }catch(_){}
  }
  function doMove(){
    const c=inferContext();
    const name=c.name;
    const oldDi=parseInt(c.di,10);
    const oldTime=c.time||'pm';
    const daySel=$('ms-day');
    const laneSel=$('ms-time');

    if(!name){toast('Move failed: no item selected','amber');return true}
    if(!daySel||!laneSel){toast('Move failed: move fields missing','amber');return true}
    if(isNaN(oldDi)){toast('Move failed: could not detect original day','amber');return true}

    try{ if(window.tmpCalClearGuard && name) tmpCalClearGuard.allowSchedNames(name); }catch(_){}

    const newDi=parseInt(daySel.value,10);
    let newLane=laneSel.value;
    if(!LANES[newLane]) newLane=(newLane==='am'?'breakfast':'dinner');

    const planMoved=movePlanOccurrence(name,oldDi,newDi,newLane);
    if(!planMoved) moveLegacy(name,oldTime,oldDi,newDi,newLane);

    try{window.save&&window.save()}catch(_){}
    try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    try{if(window.renderCal)window.renderCal(); if(window.tmpStackPlan&&tmpStackPlan.render)tmpStackPlan.render(); if(window.renderStack)window.renderStack()}catch(_){}
    try{if(window.apClose)window.apClose()}catch(_){}
    toast('✓ Moved '+name,(LANES[newLane]||newLane)+' · '+(DOW[newDi]||'selected day'));
    setTimeout(()=>{try{if(window.renderCal)window.renderCal(); if(window.tmpStackPlan&&tmpStackPlan.render)tmpStackPlan.render()}catch(_){}},150);
    return true;
  }
  function rewireMoveButton(){
    fillMoveSelect();
    const btn=$('move-save');
    if(!btn) return;
    if(btn.dataset.gpt332Rewired==='1') return;
    const clone=btn.cloneNode(true);
    clone.dataset.gpt332Rewired='1';
    clone.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      doMove();
    },true);
    btn.replaceWith(clone);
  }

  const mo=new MutationObserver(()=>{if(window.__tmpMoQuiet.active()||mo.__pending)return;mo.__pending=1;setTimeout(()=>{mo.__pending=0;window.__tmpMoQuiet.run(rewireMoveButton);},30);});
  function start(){
    const ap=$('ap');
    if(ap)mo.observe(ap,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
    rewireMoveButton();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start); else start();

  window.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#t-move,#move-bk,#t-edit,#edit-bk')){
      setTimeout(rewireMoveButton,60);
      setTimeout(rewireMoveButton,200);
    }
    if(e.target&&e.target.closest&&e.target.closest('#move-save')){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      doMove();
    }
  },true);

  __tmpPgInterval(rewireMoveButton, 1200, 'pg-calendar');
  window.tmpMoveScheduledItem332=doMove;
})();


// ===== extracted post-core patch script =====
/* disabled by v33.375-stable-vendor-post-import-review: caused unwanted auto-scrolling */


// ===== extracted post-core patch script =====
(function(){
  const LANES=Object.assign({},window.__tmpSbMealLanes);
  const LANE_TO_TIME = {breakfast:'am', lunch:'am', dinner:'pm', bedtime:'pm'};
  const TIME_TO_LANE = {am:'breakfast', pm:'dinner'};
  function $(id){return document.getElementById(id)}
  function gv(id){const el=$(id);return el?el.value:''}
  function sv(id,v){const el=$(id);if(el)el.value=v}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function key(name,time,di){return name+'/'+time+'/'+di}
  function mealOptions(includeNone){
    return (includeNone?'<option value="none">No stack / inventory only</option>':'')+
      Object.keys(LANES).map(k=>'<option value="'+k+'">'+LANES[k]+'</option>').join('');
  }
  function convertValue(v){
    if(LANES[v]||v==='none') return v;
    if(v==='am') return 'breakfast';
    if(v==='pm') return 'dinner';
    if(v==='both') return 'bedtime';
    return 'breakfast';
  }
  function readPiaLane(){
    const stk = $('pia-stk');
    if(stk && stk.value){
      const lane = convertValue(stk.value);
      if(LANES[lane]) return lane;
    }
    const remembered = recallPiaLane();
    return remembered || 'breakfast';
  }
  let piaUserLane = null;
  function detachCorePiaSel(){
    const sel=$('pia-sel');
    if(!sel || sel.dataset.gptMealLaneDetached==='1') return;
    const clone=sel.cloneNode(true);
    clone.dataset.gptMealLaneDetached='1';
    clone.addEventListener('change', function(){
      setTimeout(updatePiaFromSelectedInventory, 0);
    });
    sel.replaceWith(clone);
  }
  function recallPiaLane(){
    if(piaUserLane && LANES[piaUserLane]) return piaUserLane;
    try {
      const s = sessionStorage.getItem('tmp.lastMealLane');
      if(LANES[s]) return s;
    } catch(_){}
    return null;
  }
  function rememberPiaLane(lane){
    lane = convertValue(lane);
    if(!LANES[lane]) return;
    piaUserLane = lane;
    try { sessionStorage.setItem('tmp.lastMealLane', lane); } catch(_){}
  }
  function applyPiaLaneToSelect(){
    const stk = $('pia-stk');
    if(!stk || stk.dataset.gptMealStackInstalled !== '1') return;
    const lane = recallPiaLane();
    if(lane && [...stk.options].some(o => o.value === lane)) stk.value = lane;
  }
  function installSelect(id, includeNone){
    const sel=$(id);
    if(!sel) return;
    const preserve = LANES[sel.value] ? sel.value : (id==='pia-stk' ? recallPiaLane() : null);
    if(sel.dataset.gptMealStackInstalled!=='1'){
      sel.dataset.gptMealStackInstalled='1';
      sel.innerHTML=mealOptions(includeNone);
    }
    let next = preserve ? convertValue(preserve) : convertValue(sel.value || (includeNone?'none':'breakfast'));
    if(id==='pia-stk' && !LANES[next]) next = recallPiaLane() || 'breakfast';
    if([...sel.options].some(o=>o.value===next)) sel.value=next;
    else if(!includeNone) sel.value='breakfast';
    else if(!sel.value) sel.value=includeNone?'none':'breakfast';
    const helpId=id==='pia-stk'?'gpt-meal-stack-help-pia':'gpt-meal-stack-help-pf';
    if(!$(helpId) && sel.parentElement){
      const help=document.createElement('div');
      help.id=helpId;
      help.textContent='Meal lane controls where this item appears on the 4-lane Weekly Calendar.';
      sel.parentElement.appendChild(help);
    }
  }
  function installAll(){
    installSelect('pia-stk', false);
    installSelect('pf-stk', true);
  }
  function clearScheduleFor(name){
    if(!window.S||!S.sched)return;
    for(let di=0;di<7;di++){
      delete S.sched[key(name,'am',di)];
      delete S.sched[key(name,'pm',di)];
      delete S.sched[key(name,'breakfast',di)];
      delete S.sched[key(name,'lunch',di)];
      delete S.sched[key(name,'dinner',di)];
      delete S.sched[key(name,'bedtime',di)];
    }
  }
  function syncStackPlanForItem(item, lane, days){
    if(!window.S || !item || !item.name || !LANES[lane]) return;
    const PLAN_KEY = 'tmp.stackPlan.v1';
    let plan = Array.isArray(S.stackPlan) ? S.stackPlan.slice() : [];
    if(!plan.length){
      try {
        const stored = JSON.parse(localStorage.getItem(PLAN_KEY) || '[]');
        if(Array.isArray(stored)) plan = stored;
      } catch(_){}
    }
    const entry = {
      id: String(item.name).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'item',
      name: item.name,
      lane: lane,
      days: days.slice(),
      dose: item.dose,
      unit: item.doseUnit || 'mcg',
      purpose: item.importPurpose || ''
    };
    const idx = plan.findIndex(p => p && p.name === item.name);
    plan = plan.filter(p => !p || p.name !== item.name);
    plan.push(entry);
    S.stackPlan = plan;
    try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); } catch(_){}
  }
  function setItemMealSchedule(item, lane, days){
    if(!item||!lane||!LANES[lane]) return;
    try {
      if(window.tmpCalClearGuard){
        tmpCalClearGuard.allowName(item.name);
        tmpCalClearGuard.enforceLight();
      }
    } catch(_){}
    clearScheduleFor(item.name);
    const time=LANE_TO_TIME[lane]||'pm';
    days.forEach(di=>{
      S.sched[key(item.name,time,di)]=true;
    });
    // Purge stale meal-lane alias keys that can resurrect wrong per-cell doses.
    try{
      if(typeof window.tmpSanitizeMealLaneScheduleKeys==='function') window.tmpSanitizeMealLaneScheduleKeys();
      if(typeof window.tmpHealLoneStaleDoseCells==='function') window.tmpHealLoneStaleDoseCells();
      if(typeof window.tmpWarnLoggedDoseMismatch==='function') window.tmpWarnLoggedDoseMismatch(item.name);
    }catch(_){}
    item.stackLane=lane;
    item.days=days.slice();
    syncStackPlanForItem(item, lane, days);
    try {
      if(window.tmpCalClearGuard && tmpCalClearGuard.isActive()){
        tmpCalClearGuard._clearStackPlanStore();
        tmpCalClearGuard._pruneSchedInPlace(S.sched);
      }
    } catch(_){}
  }
  window.tmpSetItemMealSchedule = setItemMealSchedule;
  function rewirePiaAdd(){
    const btn=$('pia-add');
    if(!btn || btn.dataset.gptMealRewired==='1') return;
    const clone=btn.cloneNode(true);
    clone.dataset.gptMealRewired='1';
    clone.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const m=$('pia-msg');
      const it=(window.S&&S.inv||[]).find(i=>i.id===parseInt(gv('pia-sel')));
      if(!it){ if(m){m.textContent='Pick a peptide from your inventory.';m.style.color='#A32D2D';} return; }
      const days=[...document.querySelectorAll('#pia-daypick .dbtn.on')].map(b=>parseInt(b.dataset.d));
      if(!days.length){ if(m){m.textContent='Tick at least one day.';m.style.color='#A32D2D';} return; }
      const lane = readPiaLane();
      const newDose=+gv('pia-dose')||0;
      if(newDose>0) it.dose=newDose;
      const newDu=gv('pia-doseu'); if(newDu) it.doseUnit=newDu;
      setItemMealSchedule(it,lane,days);
      rememberPiaLane(lane);
      if(m){m.textContent='Schedule saved!';m.style.color='#0F6E56';}
      if(typeof window.closePepMgr==='function') window.closePepMgr();
      else{
        window._pepMgrClosing = true;
        const mgr=document.getElementById('pepmgr');
        if(mgr) mgr.style.display='none';
        try{window.swPT&&swPT('list');window.rr&&rr();}catch(_){}
        setTimeout(()=>{ window._pepMgrClosing = false; }, 0);
      }
      toast('✓ Scheduled "'+it.name+'"', LANES[lane]+' · '+days.length+' day'+(days.length===1?'':'s'));
      requestAnimationFrame(()=>{
        try{window.rebuildCM&&rebuildCM();window.buildLegend&&buildLegend();window.save&&save();window.popSel&&popSel();}catch(_){}
        try{window.tmpRepairInvSchedFromStackLane&&window.tmpRepairInvSchedFromStackLane();}catch(_){}
        try{window.tmpWarnLoggedDoseMismatch&&window.tmpWarnLoggedDoseMismatch(it.name);}catch(_){}
        try{window.renderCal&&renderCal();}catch(_){}
      });
    }, true);
    btn.replaceWith(clone);
  }
  function updatePiaFromSelectedInventory(){
    const sel=$('pia-sel'), stk=$('pia-stk');
    if(!sel||!stk||!window.S) return;
    installSelect('pia-stk', false);
    const cur = convertValue(stk.value);
    if(LANES[cur]){
      rememberPiaLane(cur);
      return;
    }
    const it=(S.inv||[]).find(i=>i.id===parseInt(sel.value));
    if(!it) return;
    let lane=it.stackLane;
    if(!LANES[lane]){
      const am=[0,1,2,3,4,5,6].some(di=>S.sched&&S.sched[key(it.name,'am',di)]);
      const pm=[0,1,2,3,4,5,6].some(di=>S.sched&&S.sched[key(it.name,'pm',di)]);
      lane=am&&pm?'bedtime':pm&&!am?'dinner':am&&!pm?'breakfast':'breakfast';
    }
    stk.value=lane;
    rememberPiaLane(lane);
  }
  function wrapPopInvAdd(){
    const old = window.popInvAdd;
    if(!old || old.__gptMealLaneWrapped) return;
    window.popInvAdd = function(){
      const keep = recallPiaLane();
      old.apply(this, arguments);
      installSelect('pia-stk', false);
      detachCorePiaSel();
      rewirePiaAdd();
      wirePiaDayPresets();
      if(keep && LANES[keep]) sv('pia-stk', keep);
      else sv('pia-stk', recallPiaLane() || 'dinner');
      applyPiaLaneToSelect();
    };
    window.popInvAdd.__gptMealLaneWrapped = true;
  }
  function preparePfNativeSave(){
    const sel=$('pf-stk');
    if(!sel) return;
    const lane=sel.value;
    sel.dataset.gptMealLane=lane;
    try {
      const name = gv('pf-nm').trim();
      if(name && window.tmpCalClearGuard) tmpCalClearGuard.allowName(name);
    } catch(_){}
    if(lane==='none') return;
    if(LANES[lane]){
      sel.value=LANE_TO_TIME[lane]||'pm'; // native addPep/savePep expects am/pm
    }
  }
  function finishPfNativeSave(){
    const sel=$('pf-stk');
    if(!sel) return;
    const lane=sel.dataset.gptMealLane;
    setTimeout(function(){
      try{
        if(LANES[lane]){
          const name=gv('pf-nm').trim();
          const it=(S.inv||[]).find(i=>i.name===name&&!i.isSupply);
          if(it){
            it.stackLane=lane;
            if(typeof window.save==='function') save();
          }
        }
      }catch(_){}
      installSelect('pf-stk', true);
      if(lane && [...sel.options].some(o=>o.value===lane)) sel.value=lane;
    },120);
  }
  function hookPfButtons(){
    // save/add buttons are dynamically rebuilt. Use capture to prepare before native handlers.
    document.querySelectorAll('#pt-form .btn, #pf-top-acts .btn').forEach(btn=>{
      const txt=(btn.textContent||'').toLowerCase();
      if(!/save|add peptide/.test(txt) || btn.dataset.gptMealPfHooked==='1') return;
      btn.dataset.gptMealPfHooked='1';
      btn.addEventListener('click', function(){
        preparePfNativeSave();
        finishPfNativeSave();
      }, true);
    });
  }
  window.tmpHookPfFormButtons=function(){
    hookPfButtons();
    installSelect('pf-stk', true);
    applyPiaLaneToSelect();
    try{window.updateDayPicker&&updateDayPicker();}catch(_){}
  };
  function pepFormIsOpen(){
    const f=$('pt-form');
    return !!(f && f.style.display==='block');
  }
  function isPiaPanelActive(){
    const p=$('pt-inv-add');
    return !!(p && p.style.display==='block');
  }
  let _piaRefreshTimer=null;
  function schedulePiaRefresh(){
    if(window._pepMgrClosing||window._pepFormBusy||pepFormIsOpen()) return;
    clearTimeout(_piaRefreshTimer);
    _piaRefreshTimer=setTimeout(()=>{
      if(window._pepFormBusy||pepFormIsOpen()) return;
      refreshPiaPanel();
    },150);
  }
  function setPiaDaySelection(days){
    const box=$('pia-daypick');
    if(!box) return;
    const set=new Set((days||[]).map(d=>parseInt(d,10)));
    box.querySelectorAll('.dbtn').forEach(b=>{
      b.classList.toggle('on', set.has(parseInt(b.dataset.d,10)));
    });
  }
  const PIA_DAY_PRESETS={all:[0,1,2,3,4,5,6],'3x':[1,3,5],'4x':[0,2,4,6],clear:[]};
  function wirePiaDayPresets(){
    if(window.__piaPresetsDelegated) return;
    window.__piaPresetsDelegated = true;
    document.addEventListener('click', function(e){
      const btn = e.target && e.target.closest && e.target.closest('#pt-inv-add .pia-day-preset');
      if(!btn || !isPiaPanelActive()) return;
      const key = btn.dataset.piaDays;
      if(!key || !Object.prototype.hasOwnProperty.call(PIA_DAY_PRESETS, key)) return;
      e.preventDefault();
      e.stopPropagation();
      setPiaDaySelection(PIA_DAY_PRESETS[key]);
    }, true);
  }
  function refreshPiaPanel(){
    wrapPopInvAdd();
    wirePiaDayPresets();
    if(window._pepFormBusy||pepFormIsOpen()) return;
    installAll();
    detachCorePiaSel();
    rewirePiaAdd();
    applyPiaLaneToSelect();
    try { window.__tmpPiaPanelReady = document.getElementById('pia-add')?.dataset.gptMealRewired === '1'; } catch(_){}
  }
  function start(){
    wrapPopInvAdd();
    wirePiaDayPresets();
    refreshPiaPanel();
    hookPfButtons();
    updatePiaFromSelectedInventory();
  }
  if(!window.__piaAddNativeBlock){
    window.__piaAddNativeBlock = true;
    document.addEventListener('click', function(e){
      const btn = e.target && e.target.closest && e.target.closest('#pia-add');
      if(!btn || btn.dataset.gptMealRewired === '1') return;
      const panel = $('pt-inv-add');
      if(!panel || panel.style.display !== 'block') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      refreshPiaPanel();
      const wired = $('pia-add');
      if(wired && wired.dataset.gptMealRewired === '1') wired.click();
    }, true);
  }
  const mo=new MutationObserver((mutations)=>{
    const pm=$('pepmgr');
    if(!pm || pm.style.display==='none') return;
    if(window._pepMgrClosing||window._pepFormBusy||pepFormIsOpen()) return;
    // Day/color picker toggles fire class mutations — ignore or they reset the form.
    const onlyPickerNoise=mutations.length>0&&mutations.every(m=>{
      if(m.type!=='attributes'||m.attributeName!=='class') return false;
      const t=m.target;
      return t&&(t.closest('#daypick')||t.closest('#pia-daypick')||t.closest('#pf-colorpick')||t.closest('.pia-day-presets'));
    });
    if(onlyPickerNoise) return;
    const onlyFormOpenNoise=mutations.every(m=>{
      const t=m.target;
      if(!t||!t.closest) return false;
      if(t.id==='pepmgr'&&m.type==='attributes'&&m.attributeName==='style') return true;
      if(t.closest('#pt-form')||t.id==='pf-acts'||t.id==='pf-top-acts') return true;
      if(m.type==='attributes'&&m.attributeName==='class'&&t.classList&&t.classList.contains('pt-pepmgr-focus-pulse')) return true;
      return false;
    });
    if(onlyFormOpenNoise) return;
    schedulePiaRefresh();
  });
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      start();
      const pepmgr=$('pepmgr');
      if(pepmgr) mo.observe(pepmgr,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
    });
  }else{
    start();
    const pepmgr=$('pepmgr');
    if(pepmgr) mo.observe(pepmgr,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
  }
  document.addEventListener('change',function(e){
    if(e.target&&e.target.id==='pia-stk') rememberPiaLane(e.target.value);
  },true);
  document.addEventListener('input',function(e){
    if(e.target&&e.target.id==='pia-stk') rememberPiaLane(e.target.value);
  },true);
  window.tmpInstallMealStackDropdowns=start;
})();


// ===== extracted post-core patch script =====
(function(){
  function enhance(){
    const card=document.getElementById('gpt-import-stack-card');
    if(!card || card.dataset.gpt33335Enhanced==='1') return;
    card.dataset.gpt33335Enhanced='1';
    const ta=document.getElementById('gpt-import-stack-text');
    if(ta){
      ta.placeholder='Paste stack table here…\\n\\nExample:\\n| Item | Frequency | Purpose |\\n| Klow | Daily | AM routine / electrolyte-style slot |\\n| RT30 | Mon + Thu | Fat loss / appetite lane |';
    }
    const preview=document.getElementById('gpt-import-stack-preview');
    if(preview) preview.classList.add('primary');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',enhance);
  else enhance();
  setTimeout(enhance,500);
})();


// ===== extracted post-core patch script =====
(function(){
  const PLAN_KEY='tmp.stackPlan.v1';
  const DOW={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6};
  const DOW_FULL={Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES=new Set(['breakfast','lunch','dinner','bedtime']);
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(_){return false}}
  function strictPrompt(){
    return [
      'Use medical research scholar mode for caution, but return ONLY valid JSON. No markdown. No commentary.',
      '',
      'Build a PeptideGenius stack plan from my goals/inventory/context.',
      'The final answer must be a JSON array using this exact schema:',
      '[',
      '  {',
      '    "name": "Retatrutide",',
      '    "lane": "breakfast",',
      '    "days": ["Mon", "Thu"],',
      '    "dose": 1,',
      '    "unit": "mg",',
      '    "purpose": "Fat loss / appetite lane"',
      '  }',
      ']',
      '',
      'Allowed lane values only: breakfast, lunch, dinner, bedtime.',
      'Allowed day values only: Mon, Tue, Wed, Thu, Fri, Sat, Sun.',
      'Each item must include name, lane, days, dose, unit, and purpose.',
      'Do not prescribe medical dosing certainty. Use typical/provisional planning values only, and keep purpose wording cautious.',
      '',
      'PeptideGenius import rules:',
      '- breakfast/lunch populate those calendar sections',
      '- dinner/bedtime populate those calendar sections',
      '- The JSON will be imported into S.stackPlan[] as the single source of truth.',
      '',
      'Now build the stack plan.'
    ].join('\n');
  }
  function ensureModal(){
    let m=$('gpt336-json-import-modal');
    if(m)return m;
    m=document.createElement('div');m.id='gpt336-json-import-modal';
    m.innerHTML='<div id="gpt336-json-import-card"><div class="head"><div><b>Strict JSON Stack Plan Import</b><p>Paste GPT’s JSON array here. PeptideGenius will validate it, save it as S.stackPlan[], sync Inventory, and populate the Weekly Calendar directly.</p></div><button type="button" id="gpt336-close-json">Close</button></div><textarea id="gpt336-json-input" placeholder=\'[{"name":"Retatrutide","lane":"breakfast","days":["Mon","Thu"],"dose":1,"unit":"mg","purpose":"Fat loss / appetite"}]\'></textarea><div class="actions"><button type="button" class="primary" id="gpt336-import-json">Import JSON to Weekly Calendar</button><button type="button" id="gpt336-copy-prompt-2">Copy strict GPT prompt</button><button type="button" id="gpt336-open-gpt">Open GPT</button></div><div id="gpt336-json-status">Ready.</div></div>';
    document.body.appendChild(m);
    $('gpt336-close-json').onclick=()=>m.style.display='none';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'});
    $('gpt336-import-json').onclick=importJson;
    $('gpt336-copy-prompt-2').onclick=async()=>{const ok=await copyText(strictPrompt());toast(ok?'✓ Strict GPT prompt copied':'Copy blocked — select manually',ok?'':'amber')};
    $('gpt336-open-gpt').onclick=()=>{try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){}};
    return m;
  }
  function parseDays(days){
    if(!Array.isArray(days)) return [];
    return days.map(d=>{
      if(typeof d==='number') return d;
      const s=String(d||'').trim();
      return DOW[s] ?? DOW_FULL[s] ?? DOW[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null && d>=0 && d<=6);
  }
  function normalizePlan(raw){
    if(!Array.isArray(raw)) throw new Error('JSON must be an array.');
    const out=[];
    raw.forEach((r,i)=>{
      if(!r || typeof r!=='object') throw new Error('Row '+(i+1)+' is not an object.');
      const name=String(r.name||'').trim();
      const lane=String(r.lane||'').toLowerCase().trim();
      const days=parseDays(r.days);
      if(!name) throw new Error('Row '+(i+1)+' is missing name.');
      if(!LANES.has(lane)) throw new Error('Row '+(i+1)+' has invalid lane: '+lane);
      if(!days.length) throw new Error('Row '+(i+1)+' has no valid days.');
      out.push({
        id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        name,
        lane,
        days:[...new Set(days)].sort((a,b)=>a-b),
        dose:r.dose===''||r.dose==null?'':Number(r.dose),
        unit:String(r.unit||'mcg').trim(),
        purpose:String(r.purpose||'').trim()
      });
    });
    return out;
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      S.stackPlan=plan;
      S.inv=S.inv||[];S.sched=S.sched||{};if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it){it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:p.dose||0,doseUnit:p.unit,cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};S.inv.push(it)}
        if(p.dose!==''&&!isNaN(p.dose))it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';
        it.stackLane=p.lane;
        it.days=p.days.slice();
        it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane);
        p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function importJson(){
    const status=$('gpt336-json-status');
    try{
      const txt=($('gpt336-json-input')||{}).value||'';
      const raw=JSON.parse(txt);
      const plan=normalizePlan(raw);
      try { if(window.tmpCalClearGuard) tmpCalClearGuard.releaseForExplicitPlan(plan); } catch(_){}
      savePlan(plan);
      try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
      if(status)status.textContent='Imported '+plan.length+' stack-plan item(s). Weekly Calendar, Inventory, and Optimizer are now synced.';
      toast('✓ Strict JSON stack plan imported',plan.length+' item'+(plan.length===1?'':'s')+' saved.');
      setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},250);
    }catch(e){
      if(status)status.textContent='Import failed: '+e.message;
      toast('JSON import failed',e.message||'Invalid JSON');
    }
  }
  function injectFaq(){
    const faq=document.getElementById('pg-faq') || document.querySelector('.page#pg-faq');
    if(!faq || document.getElementById('gpt336-faq-workflow')) return;
    const block=document.createElement('section');
    block.id='gpt336-faq-workflow';
    block.innerHTML='<h2>Reliable GPT Stack Builder workflow</h2><p>For precision, do not import loose tables as the final source. Use GPT to return strict JSON, then import that JSON into PeptideGenius as <b>S.stackPlan[]</b>.</p><ol><li>Open <b>Stack Builder</b> and choose your goal lanes.</li><li>Click <b>Copy strict GPT prompt</b>.</li><li>Paste the prompt into GPT and ask for JSON only.</li><li>Copy GPT’s JSON array.</li><li>Return to PeptideGenius → <b>Open JSON import</b>.</li><li>Paste JSON and click <b>Import JSON to Weekly Calendar</b>.</li><li>The Weekly Calendar, Inventory, and Optimizer now read the same local stack plan.</li></ol>';
    faq.insertBefore(block, faq.firstChild);
  }
  document.addEventListener('click',async e=>{
    if(e.target&&e.target.id==='gpt336-copy-strict-prompt'){
      const ok=await copyText(strictPrompt());
      toast(ok?'✓ Strict GPT prompt copied':'Copy blocked — open importer and select manually',ok?'':'amber');
    }
    if(e.target&&e.target.id==='gpt336-open-json-import'){
      ensureModal().style.display='flex';
    }
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="faq"],.hdr-tab-btn[data-pg="faq"]'))setTimeout(injectFaq,150);
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(injectFaq,500));
  else setTimeout(injectFaq,500);
  window.tmpStrictStackPlanPrompt=strictPrompt;
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(_){return false}}
  function strictPrompt(){
    if(typeof window.tmpStrictStackPlanPrompt==='function') return window.tmpStrictStackPlanPrompt();
    return [
      'Return ONLY valid JSON. No markdown. No commentary.',
      'Use this schema:',
      '[{"name":"Retatrutide","lane":"breakfast","days":["Mon","Thu"],"dose":1,"unit":"mg","purpose":"Fat loss / appetite"}]',
      'Allowed lanes: breakfast, lunch, dinner, bedtime.',
      'Allowed days: Mon, Tue, Wed, Thu, Fri, Sat, Sun.'
    ].join('\n');
  }
  function inject(){
    const card=$('gpt336-stack-plan-workflow');
    if(!card || $('gpt337-step-detail')) return;
    const detail=document.createElement('section');
    detail.id='gpt337-step-detail';
    detail.innerHTML=
      '<div class="gpt337-detail-card s3">'+
        '<div class="top"><span class="num">3</span><strong>Review JSON from GPT</strong></div>'+
        '<p>After GPT answers, copy the entire JSON array. It should start with <code>[</code> and contain rows with <code>name</code>, <code>lane</code>, <code>days</code>, <code>dose</code>, <code>unit</code>, and <code>purpose</code>.</p>'+
        '<div class="gpt337-detail-actions"><button type="button" class="primary" id="gpt337-copy-prompt">Copy strict GPT prompt</button><button type="button" id="gpt337-open-gpt">Open GPT</button></div>'+
      '</div>'+
      '<div class="gpt337-detail-card s4">'+
        '<div class="top"><span class="num">4</span><strong>Paste JSON into PeptideGenius</strong></div>'+
        '<p>Come back here and paste GPT’s JSON into the import box. Then click <b>Import JSON to Weekly Calendar</b>. This is the step that actually fills the calendar.</p>'+
        '<div class="gpt337-detail-actions"><button type="button" class="primary" id="gpt337-show-inline-import">Paste JSON here</button><button type="button" id="gpt337-open-json-modal">Open full JSON import</button></div>'+
      '</div>';
    card.appendChild(detail);

    const inline=document.createElement('section');
    inline.id='gpt337-json-inline';
    inline.innerHTML=
      '<textarea id="gpt337-json-input" placeholder=\'Paste GPT JSON here, for example: [{"name":"Retatrutide","lane":"breakfast","days":["Mon","Thu"],"dose":1,"unit":"mg","purpose":"Fat loss / appetite"}]\'></textarea>'+
      '<div class="inline-actions"><button type="button" class="primary" id="gpt337-import-inline-json">Import JSON to Weekly Calendar</button><button type="button" id="gpt337-clear-inline-json">Clear</button></div>';
    card.appendChild(inline);

    $('gpt337-copy-prompt').onclick=async()=>{const ok=await copyText(strictPrompt());toast(ok?'✓ Strict GPT prompt copied':'Copy blocked — select manually',ok?'':'amber')};
    $('gpt337-open-gpt').onclick=()=>{try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){}};
    $('gpt337-show-inline-import').onclick=()=>{inline.style.display='block';$('gpt337-json-input').focus();inline.scrollIntoView({behavior:'smooth',block:'center'});};
    $('gpt337-open-json-modal').onclick=()=>{const b=$('gpt336-open-json-import'); if(b)b.click(); else {inline.style.display='block';$('gpt337-json-input').focus();}};
    $('gpt337-clear-inline-json').onclick=()=>{$('gpt337-json-input').value='';};
    $('gpt337-import-inline-json').onclick=()=>importInlineJson();
  }
  function importInlineJson(){
    const src=$('gpt337-json-input');
    const txt=src?src.value:'';
    if(!txt.trim()){toast('Paste GPT JSON first','amber');return;}
    const modalBtn=$('gpt336-open-json-import');
    if(modalBtn) modalBtn.click();
    setTimeout(()=>{
      const main=$('gpt336-json-input');
      if(main){
        main.value=txt;
        const importBtn=$('gpt336-import-json');
        if(importBtn) importBtn.click();
      }else{
        toast('JSON importer not found','amber');
      }
    },120);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,500));
  else setTimeout(inject,500);
  document.addEventListener('click',e=>{
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(inject,250);
  },true);
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(_){return false}}
  function strictPrompt(){
    if(typeof window.tmpStrictStackPlanPrompt==='function') return window.tmpStrictStackPlanPrompt();
    return 'Return ONLY valid JSON. Use schema: [{"name":"Retatrutide","lane":"breakfast","days":["Mon","Thu"],"dose":1,"unit":"mg","purpose":"Fat loss / appetite"}]';
  }
  function showInlineImport(){
    const inline=$('gpt337-json-inline');
    const input=$('gpt337-json-input');
    if(inline){
      inline.style.display='block';
      inline.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>{try{input&&input.focus()}catch(_){}},450);
      return true;
    }
    const modalBtn=$('gpt336-open-json-import');
    if(modalBtn){modalBtn.click();return true;}
    return false;
  }
  function addButtonToStep(stepSelector, id, text, action){
    const step=document.querySelector(stepSelector);
    if(!step || $(id)) return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.id=id;
    btn.className='gpt338-step-btn';
    btn.textContent=text;
    btn.onclick=action;
    step.appendChild(btn);
  }
  function inject(){
    const workflow=$('gpt336-stack-plan-workflow');
    if(!workflow) return;

    addButtonToStep('#gpt336-stack-plan-workflow .gpt336-step.s3','gpt338-step3-next','Next: paste GPT JSON here', function(){
      showInlineImport();
    });

    addButtonToStep('#gpt336-stack-plan-workflow .gpt336-step.s4','gpt338-step4-next','Import JSON to calendar', function(){
      const inline=$('gpt337-json-inline');
      if(inline && getComputedStyle(inline).display==='none') showInlineImport();
      else {
        const btn=$('gpt337-import-inline-json') || $('gpt336-import-json');
        if(btn) btn.click();
        else toast('Paste JSON first','amber');
      }
    });

    if(!$('gpt338-sticky-next')){
      const sticky=document.createElement('div');
      sticky.id='gpt338-sticky-next';
      sticky.className='gpt338-sticky-next';
      sticky.innerHTML='<button type="button" id="gpt338-copy-open-gpt">Copy prompt + open GPT</button><button type="button" class="primary" id="gpt338-go-json">Next: paste JSON</button>';
      workflow.appendChild(sticky);
      $('gpt338-copy-open-gpt').onclick=async()=>{
        const ok=await copyText(strictPrompt());
        try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){}
        toast(ok?'✓ Prompt copied — paste into GPT':'GPT opened — copy may be blocked',ok?'':'amber');
      };
      $('gpt338-go-json').onclick=showInlineImport;
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,550));
  else setTimeout(inject,550);
  document.addEventListener('click',e=>{
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]')) setTimeout(inject,250);
  },true);
})();


// ===== extracted post-core patch script =====
(function(){
  const PLAN_KEY='tmp.stackPlan.v1';
  const DAY={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES=new Set(['breakfast','lunch','dinner','bedtime']);
  function $(id){return document.getElementById(id)}
  function status(msg,kind){const s=$('gpt339-status'); if(s){s.textContent=msg;s.className=kind||'';}}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(_){return false}}
  function prompt(){
    return [
      'Return ONLY valid JSON. No markdown. No commentary.',
      '',
      'Create a PeptideGenius stack plan using this exact schema:',
      '[',
      '  {',
      '    "name": "Retatrutide",',
      '    "lane": "breakfast",',
      '    "days": ["Mon", "Thu"],',
      '    "dose": 1,',
      '    "unit": "mg",',
      '    "purpose": "Fat loss / appetite lane"',
      '  }',
      ']',
      '',
      'Rules:',
      '- JSON array only.',
      '- Allowed lanes: breakfast, lunch, dinner, bedtime.',
      '- Allowed days: Mon, Tue, Wed, Thu, Fri, Sat, Sun.',
      '- Every row must include name, lane, days, dose, unit, purpose.',
      '- Use cautious/provisional planning language in purpose.',
      '- Do not add text before or after JSON.',
      '',
      'Now build the stack plan.'
    ].join('\n');
  }
  function sample(){
    return JSON.stringify([
      {name:'Klow',lane:'breakfast',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],dose:'',unit:'mcg',purpose:'AM routine / electrolyte-style slot'},
      {name:'Vitamins / support stack',lane:'lunch',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],dose:1,unit:'pill',purpose:'Simplicity / adherence'},
      {name:'Retatrutide',lane:'breakfast',days:['Mon','Thu'],dose:1,unit:'mg',purpose:'Fat loss / appetite lane'}
    ],null,2);
  }
  function parseDays(days){
    if(!Array.isArray(days)) return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number') return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function normalize(raw){
    if(!Array.isArray(raw)) throw new Error('JSON must be an array.');
    return raw.map((r,i)=>{
      if(!r||typeof r!=='object') throw new Error('Row '+(i+1)+' is not an object.');
      const name=String(r.name||'').trim();
      const lane=String(r.lane||'').trim().toLowerCase();
      const days=parseDays(r.days);
      if(!name) throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane)) throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length) throw new Error('Row '+(i+1)+' has no valid days.');
      return {
        id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        name,lane,days,
        dose:r.dose===''||r.dose==null?'':Number(r.dose),
        unit:String(r.unit||'mcg').trim(),
        purpose:String(r.purpose||'').trim()
      };
    });
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      S.stackPlan=plan; S.inv=S.inv||[]; S.sched=S.sched||{}; if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it){it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:p.dose||0,doseUnit:p.unit,cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};S.inv.push(it);}
        if(p.dose!==''&&!isNaN(p.dose)) it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';
        it.stackLane=p.lane; it.days=p.days.slice(); it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane); p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function importJson(){
    const ta=$('gpt339-json'); if(!ta) return;
    try{
      const plan=normalize(JSON.parse(ta.value));
      savePlan(plan);
      try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
      status('Imported '+plan.length+' items. Opening Weekly Calendar…','ok');
      toast('✓ Stack plan imported',plan.length+' item'+(plan.length===1?'':'s')+' saved to calendar.');
      setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},350);
    }catch(e){
      status('Error: '+e.message,'bad');
      toast('JSON import failed',e.message||'Invalid JSON');
    }
  }
  function validate(){
    const ta=$('gpt339-json'); if(!ta) return;
    try{
      const plan=normalize(JSON.parse(ta.value));
      status('Valid JSON: '+plan.length+' item'+(plan.length===1?'':'s')+' ready.','ok');
    }catch(e){status('Error: '+e.message,'bad');}
  }
  function wire(){
    const copy=$('gpt339-copy-open');
    const samp=$('gpt339-sample');
    const imp=$('gpt339-import');
    const val=$('gpt339-validate');
    const clr=$('gpt339-clear');
    if(copy&&!copy.dataset.wired){copy.dataset.wired=1;copy.onclick=async()=>{const ok=await copyText(prompt());try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){};toast(ok?'✓ Prompt copied — paste into GPT':'GPT opened — copy may be blocked',ok?'':'amber')};}
    if(samp&&!samp.dataset.wired){samp.dataset.wired=1;samp.onclick=()=>{$('gpt339-json').value=sample();validate();};}
    if(imp&&!imp.dataset.wired){imp.dataset.wired=1;imp.onclick=importJson;}
    if(val&&!val.dataset.wired){val.dataset.wired=1;val.onclick=validate;}
    if(clr&&!clr.dataset.wired){clr.dataset.wired=1;clr.onclick=()=>{$('gpt339-json').value='';status('Waiting for JSON.','');};}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(wire,500)); else setTimeout(wire,500);
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(wire,250)},true);
})();


// ===== extracted post-core patch script =====
(function(){
  const PLAN_KEY='tmp.stackPlan.v1';
  const DAY={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES=new Set(['breakfast','lunch','dinner','bedtime']);
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(_){return false}}
  function prompt(){
    return [
      'Return ONLY valid JSON. No markdown. No commentary.',
      '',
      'Create a PeptideGenius stack plan using this exact schema:',
      '[{"name":"Retatrutide","lane":"breakfast","days":["Mon","Thu"],"dose":1,"unit":"mg","purpose":"Fat loss / appetite lane"}]',
      '',
      'Rules:',
      '- JSON array only.',
      '- Allowed lanes: breakfast, lunch, dinner, bedtime.',
      '- Allowed days: Mon, Tue, Wed, Thu, Fri, Sat, Sun.',
      '- Every row must include name, lane, days, dose, unit, purpose.',
      '- Use cautious/provisional planning language in purpose.',
      '- Do not add text before or after JSON.'
    ].join('\n');
  }
  function sample(){
    return JSON.stringify([
      {name:'Klow',lane:'breakfast',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],dose:'',unit:'mcg',purpose:'AM routine / electrolyte-style slot'},
      {name:'Vitamins / support stack',lane:'lunch',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],dose:1,unit:'pill',purpose:'Simplicity / adherence'},
      {name:'Retatrutide',lane:'breakfast',days:['Mon','Thu'],dose:1,unit:'mg',purpose:'Fat loss / appetite lane'}
    ],null,2);
  }
  function parseDays(days){
    if(!Array.isArray(days)) return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number') return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function normalize(raw){
    if(!Array.isArray(raw)) throw new Error('JSON must be an array.');
    return raw.map((r,i)=>{
      if(!r||typeof r!=='object') throw new Error('Row '+(i+1)+' is not an object.');
      const name=String(r.name||'').trim();
      const lane=String(r.lane||'').trim().toLowerCase();
      const days=parseDays(r.days);
      if(!name) throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane)) throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length) throw new Error('Row '+(i+1)+' has no valid days.');
      return {id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''), name, lane, days, dose:r.dose===''||r.dose==null?'':Number(r.dose), unit:String(r.unit||'mcg').trim(), purpose:String(r.purpose||'').trim()};
    });
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      S.stackPlan=plan; S.inv=S.inv||[]; S.sched=S.sched||{}; if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it){it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:p.dose||0,doseUnit:p.unit,cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};S.inv.push(it);}
        if(p.dose!==''&&!isNaN(p.dose)) it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';
        it.stackLane=p.lane; it.days=p.days.slice(); it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane); p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function setStep(n){
    const box=$('gpt340-clean-stepper');
    if(box) box.dataset.step=String(n);
    if(n===3){setTimeout(()=>{try{$('gpt340-json').focus()}catch(_){}},50);}
  }
  function setStatus(msg,kind){const s=$('gpt340-status');if(s){s.textContent=msg;s.className=kind||''}}
  function validateOnly(){
    try{const plan=normalize(JSON.parse(($('gpt340-json')||{}).value||'')); setStatus('Valid: '+plan.length+' item(s) ready.','ok'); return plan;}
    catch(e){setStatus('Error: '+e.message,'bad'); return null;}
  }
  function importJson(){
    const plan=validateOnly();
    if(!plan) return;
    savePlan(plan);
    try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
    setStatus('Imported. Opening Weekly Calendar…','ok');
    toast('✓ Stack plan imported',plan.length+' item'+(plan.length===1?'':'s')+' saved.');
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},350);
  }
  function create(){
    const root=document.getElementById('pg-builder');
    if(!root || $('gpt340-clean-stepper')) return;
    const hero=root.querySelector('.gpt-sb-hero') || root.firstElementChild;
    const sec=document.createElement('section');
    sec.id='gpt340-clean-stepper';
    sec.dataset.step='1';
    sec.innerHTML=
      '<div class="gpt340-top"><div><div class="gpt340-k">Clean stack workflow</div><div class="gpt340-title">Build → paste → import</div><div class="gpt340-sub">One step at a time. Each step has one obvious next button.</div></div><div class="gpt340-progress"><span class="gpt340-dot" data-dot="1">1</span><span class="gpt340-dot" data-dot="2">2</span><span class="gpt340-dot" data-dot="3">3</span><span class="gpt340-dot" data-dot="4">4</span></div></div>'+
      '<div class="gpt340-panel">'+
        '<div class="gpt340-step" data-step="1"><h3>1. Ask GPT to build the stack</h3><p>Copy the strict prompt and open GPT. GPT should return JSON only.</p><div class="gpt340-actions"><button class="primary" id="gpt340-copy-open">Copy prompt + open GPT</button><button id="gpt340-next-2">Next: I have GPT open</button></div></div>'+
        '<div class="gpt340-step" data-step="2"><h3>2. Copy GPT’s JSON answer</h3><p>In GPT, copy the full answer. It should start with <b>[</b> and end with <b>]</b>.</p><div class="gpt340-actions"><button class="primary" id="gpt340-next-3">Next: paste JSON</button><button id="gpt340-back-1">Back</button></div></div>'+
        '<div class="gpt340-step" data-step="3"><h3>3. Paste the JSON here</h3><p>Paste GPT’s JSON array into this box.</p><textarea id="gpt340-json" spellcheck="false"></textarea><div class="gpt340-actions"><button class="primary" id="gpt340-check-next">Check JSON + next</button><button id="gpt340-sample">Use sample</button><button id="gpt340-back-2">Back</button><span id="gpt340-status">Waiting for JSON.</span></div></div>'+
        '<div class="gpt340-step" data-step="4"><h3>4. Import to Weekly Calendar</h3><p>If the JSON is valid, click import. This saves <b>S.stackPlan[]</b> and opens the Weekly Calendar.</p><div class="gpt340-actions"><button class="primary" id="gpt340-import">Import JSON to Weekly Calendar</button><button id="gpt340-back-3">Back</button></div></div>'+
      '</div>';
    if(hero&&hero.parentNode) hero.parentNode.insertBefore(sec, hero.nextSibling);
    else root.insertBefore(sec, root.firstChild);
    wire();
  }
  function wire(){
    const bind=(id,fn)=>{const el=$(id); if(el&&!el.dataset.bound){el.dataset.bound=1;el.onclick=fn;}};
    bind('gpt340-copy-open',async()=>{const ok=await copyText(prompt());try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){};toast(ok?'✓ Prompt copied — paste into GPT':'GPT opened — copy may be blocked',ok?'':'amber')});
    bind('gpt340-next-2',()=>setStep(2));
    bind('gpt340-next-3',()=>setStep(3));
    bind('gpt340-back-1',()=>setStep(1));
    bind('gpt340-back-2',()=>setStep(2));
    bind('gpt340-back-3',()=>setStep(3));
    bind('gpt340-sample',()=>{$('gpt340-json').value=sample();validateOnly();});
    bind('gpt340-check-next',()=>{if(validateOnly())setStep(4);});
    bind('gpt340-import',importJson);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(create,450));
  else setTimeout(create,450);
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(create,250)},true);
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Fixes strict JSON stack import creating duplicates:
      Retatrutide vs RT20/RT30
      KLO80/Klow/Klow80
      Testosterone Cypionate vs TC250
      BPC-157 + TB-500 when user has WV blend
      CJC-1295 + Ipamorelin when user has CP20 blend
    Also disables the earlier auto-scroll behavior that made the page jump upward.
  */
  const DAY = {Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES = new Set(['breakfast','lunch','dinner','bedtime']);
  const PLAN_KEY = 'tmp.stackPlan.v1';

  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function invNames(){
    try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>i.name)}catch(_){return []}
  }
  function findInvByRegex(regexes){
    const names=invNames();
    for(const rx of regexes){
      const n=names.find(x=>rx.test(String(x)));
      if(n) return n;
    }
    return '';
  }
  function canonicalName(raw){
    const s=String(raw||'').trim();
    const l=s.toLowerCase().replace(/\s+/g,'');
    if(!s) return s;

    // Retatrutide aliases. Prefer the user's actual inventory abbreviation.
    if(/^(retatrutide|reta|rt20|rt30|rt10|rt)$/.test(l) || /retatrutide/.test(l)){
      return findInvByRegex([/^RT\d+/i,/^Reta/i,/Retatrutide/i]) || s;
    }

    // Klotho/Klow aliases.
    if(/^(klo80|klow80|klow|klotho|klotho80)$/.test(l) || /klotho|klow/.test(l)){
      return findInvByRegex([/^Klow80$/i,/^KLO80$/i,/^Klow$/i,/Klotho/i,/^KLO/i]) || s;
    }

    // Testosterone Cypionate aliases.
    if(/^(tc250|testc|testosteronecypionate|testosterone|cypionate)$/.test(l) || /testosterone/.test(l)){
      return findInvByRegex([/^TC250$/i,/^TC/i,/Testosterone Cypionate/i,/Test C/i]) || s;
    }

    // WV / Wolverine blend.
    if(/^(wv|wolverine|bpc157\+tb500|bpc-157\+tb-500|bpc157tb500)$/.test(l)){
      return findInvByRegex([/^WV$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i]) || 'WV';
    }

    // CP20 / CJC-Ipamorelin blend.
    if(/^(cp20|cjcipa|cjcipamorelin|cjc-1295ipamorelin|cjc\+ipamorelin)$/.test(l)){
      return findInvByRegex([/^CP20$/i,/^CP10$/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i]) || 'CP20';
    }

    return s;
  }
  function parseDays(days){
    if(!Array.isArray(days)) return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number') return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function sameDays(a,b){
    a=parseDays(a); b=parseDays(b);
    return a.length===b.length && a.every((x,i)=>x===b[i]);
  }
  function hasInvBlend(type){
    if(type==='wv') return !!findInvByRegex([/^WV$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i]);
    if(type==='cp') return !!findInvByRegex([/^CP20$/i,/^CP10$/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i]);
    return false;
  }
  function normalizePlan(raw){
    if(!Array.isArray(raw)) throw new Error('JSON must be an array.');

    let rows = raw.map((r,i)=>{
      if(!r || typeof r!=='object') throw new Error('Row '+(i+1)+' is not an object.');
      const name = canonicalName(r.name);
      const lane = String(r.lane||'').trim().toLowerCase();
      const days = parseDays(r.days);
      if(!name) throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane)) throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length) throw new Error('Row '+(i+1)+' has no valid days.');
      return {
        id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        name,
        lane,
        days,
        dose:r.dose===''||r.dose==null?'':Number(r.dose),
        unit:String(r.unit||'mcg').trim(),
        purpose:String(r.purpose||'').trim()
      };
    });

    // Merge BPC-157 + TB-500 into WV when that blend exists in inventory.
    if(hasInvBlend('wv')){
      const wvName=canonicalName('WV');
      const grouped=[];
      const used=new Set();
      rows.forEach((r,i)=>{
        if(used.has(i)) return;
        const isB=/^BPC-?157$/i.test(r.name);
        const isT=/^TB-?500$/i.test(r.name);
        if(isB || isT){
          const pairIndex=rows.findIndex((x,j)=>j!==i&&!used.has(j)&&((isB && /^TB-?500$/i.test(x.name))||(isT && /^BPC-?157$/i.test(x.name)))&&x.lane===r.lane&&sameDays(x.days,r.days));
          if(pairIndex>=0){
            grouped.push({
              id:wvName.toLowerCase(),
              name:wvName,
              lane:r.lane,
              days:r.days.slice(),
              dose:r.dose || rows[pairIndex].dose || '',
              unit:r.unit || rows[pairIndex].unit || 'mcg',
              purpose:(r.purpose || rows[pairIndex].purpose || 'Recovery / injury blend') + ' · merged from BPC-157 + TB-500'
            });
            used.add(i); used.add(pairIndex);
            return;
          }
        }
        grouped.push(r);
        used.add(i);
      });
      rows=grouped;
    }

    // Merge CJC-1295 + Ipamorelin into CP20 when that blend exists in inventory.
    if(hasInvBlend('cp')){
      const cpName=canonicalName('CP20');
      const grouped=[];
      const used=new Set();
      rows.forEach((r,i)=>{
        if(used.has(i)) return;
        const isC=/CJC/i.test(r.name);
        const isI=/Ipamorelin/i.test(r.name);
        if(isC || isI){
          const pairIndex=rows.findIndex((x,j)=>j!==i&&!used.has(j)&&((isC && /Ipamorelin/i.test(x.name))||(isI && /CJC/i.test(x.name)))&&x.lane===r.lane&&sameDays(x.days,r.days));
          if(pairIndex>=0){
            grouped.push({
              id:cpName.toLowerCase(),
              name:cpName,
              lane:r.lane,
              days:r.days.slice(),
              dose:r.dose || rows[pairIndex].dose || '',
              unit:r.unit || rows[pairIndex].unit || 'mcg',
              purpose:(r.purpose || rows[pairIndex].purpose || 'GH pulse blend') + ' · merged from CJC-1295 + Ipamorelin'
            });
            used.add(i); used.add(pairIndex);
            return;
          }
        }
        grouped.push(r);
        used.add(i);
      });
      rows=grouped;
    }

    // Final de-dupe by canonical name + lane + days.
    const map=new Map();
    rows.forEach(r=>{
      const k=r.name.toLowerCase()+'|'+r.lane+'|'+r.days.join(',');
      if(!map.has(k)) map.set(k,r);
      else{
        const old=map.get(k);
        old.purpose = old.purpose || r.purpose;
        old.dose = old.dose!=='' ? old.dose : r.dose;
        old.unit = old.unit || r.unit;
      }
    });
    return [...map.values()];
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      S.stackPlan=plan; S.inv=S.inv||[]; S.sched=S.sched||{}; if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it){it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:p.dose||0,doseUnit:p.unit,cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};S.inv.push(it);}
        if(p.dose!==''&&!isNaN(p.dose)) it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';
        it.stackLane=p.lane; it.days=p.days.slice(); it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane); p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function importFromBox(){
    const ta=$('gpt340-json') || $('gpt339-json') || $('gpt336-json-input') || $('gpt337-json-input');
    if(!ta) return false;
    try{
      const plan=normalizePlan(JSON.parse(ta.value));
      savePlan(plan);
      try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
      const status=$('gpt340-status') || $('gpt339-status');
      if(status){status.textContent='Imported '+plan.length+' de-duplicated item(s).';status.className='ok';}
      toast('✓ Stack plan imported without duplicates',plan.length+' item'+(plan.length===1?'':'s')+' saved.');
      setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},300);
      return true;
    }catch(e){
      const status=$('gpt340-status') || $('gpt339-status');
      if(status){status.textContent='Error: '+e.message;status.className='bad';}
      toast('JSON import failed',e.message||'Invalid JSON');
      return true;
    }
  }

  // Capture import button and run alias-aware import before older handlers.
  window.addEventListener('click',function(e){
    if(!e.target || !e.target.closest) return;
    if(e.target.closest('#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      importFromBox();
    }
  },true);

  window.tmpScrollToCalendarActionPanel = function(){
    try{
      if(typeof window.scrollCalActionPanel==='function'){
        var edit=document.getElementById('f-edit');
        var move=document.getElementById('f-move');
        if(edit&&getComputedStyle(edit).display!=='none') window.scrollCalActionPanel('f-edit');
        else if(move&&getComputedStyle(move).display!=='none') window.scrollCalActionPanel('f-move');
        else window.scrollCalActionPanel('ap');
      }
    }catch(_){}
  };
  window.tmpStackPlanNormalizeAliases = normalizePlan;
})();


// ===== extracted post-core patch script =====
(function(){
  const PLAN_KEY='tmp.stackPlan.v1';
  const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const LANES={breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner',bedtime:'Bedtime'};
  const LANE_TO_TIME={breakfast:'am',lunch:'am',dinner:'pm',bedtime:'pm'};
  const TIME_TO_LANE={am:'breakfast',pm:'dinner'};
  const COLORS=['#3B82F6','#10B981','#F59E0B','#F97316','#EF4444','#06B6D4','#8B5CF6','#EC4899','#64748B','#14B8A6','#84CC16','#6366F1','#A855F7','#F43F5E','#22C55E','#0EA5E9'];
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function key(name,time,di){return name+'/'+time+'/'+di}
  function selectedName(){return (($('ap-nm')||{}).textContent||'').trim()}
  function selectedTime(){const dt=(($('ap-dt')||{}).textContent||'').toLowerCase();return /\bam\b/.test(dt)?'am':(/\bpm\b/.test(dt)?'pm':'pm')}
  function getRawPlan(){
    if(window.S&&Array.isArray(S.stackPlan)) return S.stackPlan;
    try{
      const p=JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');
      if(Array.isArray(p)){ if(window.S) S.stackPlan=p; return p; }
    }catch(_){}
    return [];
  }
  function getPlan(){
    const plan=getRawPlan();
    return (window.tmpCalClearGuard ? tmpCalClearGuard.planForCalendar(plan) : plan);
  }
  function setPlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()) plan=tmpCalClearGuard.filterPlanForClearGuard(plan||[]);
    if(window.S)S.stackPlan=plan||[];
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan||[]))}catch(_){}
  }
  function invItem(name){try{return (S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply)}catch(_){return null}}
  function itemLane(name,time){
    const p=getPlan().find(x=>x&&x.name===name);
    if(p&&LANES[p.lane])return p.lane;
    const it=invItem(name);
    if(it&&LANES[it.stackLane])return it.stackLane;
    return TIME_TO_LANE[time]||'dinner'
  }
  function itemDays(name,time){
    const out=new Set();
    try{
      getRawPlan().filter(x=>x&&x.name===name).forEach(p=>(p.days||[]).forEach(d=>out.add(d)));
    }catch(_){}
    try{
      const lanes=['am','pm','breakfast','lunch','dinner','bedtime'];
      for(let d=0;d<7;d++){
        lanes.forEach(l=>{
          const v=S.sched&&S.sched[key(name,l,d)];
          if(v&&v!==false) out.add(d);
        });
      }
    }catch(_){}
    try{
      const it=invItem(name);
      if(it&&Array.isArray(it.days)) it.days.forEach(d=>out.add(d));
    }catch(_){}
    return [...out].sort((a,b)=>a-b);
  }
  function selectedLaneFromEdit(name,time){
    const timeEl=$('e-stime')||$('e-time');
    if(timeEl&&timeEl.dataset.gptMealLane&&LANES[timeEl.dataset.gptMealLane]) return timeEl.dataset.gptMealLane;
    if(timeEl&&LANES[timeEl.value]) return timeEl.value;
    return itemLane(name,time);
  }
  function effectiveDaysForSave(name,time){
    const daysBox=$('gpt342-edit-days');
    if(daysBox&&daysBox.dataset.gpt342Dirty==='1') return selectedDaysFromEdit();
    const preserved=itemDays(name,time);
    if(preserved.length) return preserved;
    const fromPicker=selectedDaysFromEdit();
    if(fromPicker.length) return fromPicker;
    return [];
  }
  function itemColorIndex(name){const it=invItem(name);return it&&typeof it.colorOverride==='number'?it.colorOverride:-1}
  function paintEditDays(name,time){
    const daysBox=$('gpt342-edit-days');
    if(!daysBox||!name) return;
    const days=itemDays(name,time);
    daysBox.querySelectorAll('.gpt342-day').forEach(b=>b.classList.toggle('on',days.includes(parseInt(b.dataset.di,10))));
  }
  function paintEditColors(name){
    const colorBox=$('gpt342-edit-colors');
    if(!colorBox||!name) return;
    const ci=itemColorIndex(name);
    colorBox.querySelectorAll('.gpt342-color').forEach(b=>b.classList.toggle('on',parseInt(b.dataset.ci,10)===ci));
  }
  function ensureEditControls(forcePaint){
    const editForm=$('f-edit');
    if(!editForm||getComputedStyle(editForm).display==='none')return;
    const name=selectedName(); if(!name)return;
    const time=selectedTime();
    let daysBox=$('gpt342-edit-days');
    if(!daysBox){
      daysBox=document.createElement('div');daysBox.id='gpt342-edit-days';
      daysBox.innerHTML='<div class="gpt342-label">Scheduled days for this peptide</div><div class="gpt342-days">'+DOW.map((d,i)=>'<button type="button" class="gpt342-day" data-di="'+i+'">'+d+'</button>').join('')+'</div>';
      const msg=$('e-msg')||editForm.querySelector('.fl'); editForm.insertBefore(daysBox,msg||editForm.firstChild);
      daysBox.addEventListener('click',function(e){
        const b=e.target.closest('.gpt342-day');
        if(!b) return;
        e.preventDefault();
        e.stopPropagation();
        b.classList.toggle('on');
        daysBox.dataset.gpt342Dirty='1';
      });
    }
    let colorBox=$('gpt342-edit-colors');
    if(!colorBox){
      colorBox=document.createElement('div');colorBox.id='gpt342-edit-colors';
      colorBox.innerHTML='<div class="gpt342-label">Universal color for this peptide</div><div class="gpt342-palette">'+COLORS.map((c,i)=>'<button type="button" class="gpt342-color" data-ci="'+i+'" style="background:'+c+'" title="Color '+(i+1)+'"></button>').join('')+'</div><div id="gpt342-edit-help">Changes apply to every calendar instance of this unique peptide.</div>';
      const msg=$('e-msg')||editForm.querySelector('.fl'); editForm.insertBefore(colorBox,msg||editForm.firstChild);
      colorBox.addEventListener('click',function(e){
        const b=e.target.closest('.gpt342-color');
        if(!b) return;
        e.preventDefault();
        e.stopPropagation();
        colorBox.querySelectorAll('.gpt342-color').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        colorBox.dataset.gpt342Dirty='1';
      });
    }
    if(forcePaint){
      delete daysBox.dataset.gpt342Dirty;
      delete colorBox.dataset.gpt342Dirty;
      paintEditDays(name,time);
      paintEditColors(name);
    }else{
      if(daysBox.dataset.gpt342Dirty!=='1') paintEditDays(name,time);
      if(colorBox.dataset.gpt342Dirty!=='1') paintEditColors(name);
    }
  }
  function selectedDaysFromEdit(){return [...document.querySelectorAll('#gpt342-edit-days .gpt342-day.on')].map(b=>parseInt(b.dataset.di)).filter(d=>!isNaN(d)).sort((a,b)=>a-b)}
  function selectedColorFromEdit(){const b=document.querySelector('#gpt342-edit-colors .gpt342-color.on');return b?parseInt(b.dataset.ci):-1}
  function syncPlanToLegacyForName(name){
    try{ if(window.tmpCalClearGuard && name) tmpCalClearGuard.allowSchedNames(name); }catch(_){}
    if(!window.S)return;S.sched=S.sched||{};
    // Drop meal-lane alias keys only; preserve per-cell dose objects on am/pm keys.
    Object.keys(S.sched).forEach(k=>{
      if(k.indexOf(name+'/')!==0) return;
      const parts=k.split('/');
      if(parts.length<3) return;
      const lane=String(parts[parts.length-2]||'').toLowerCase();
      if(MEAL_TO_TIME[lane]) delete S.sched[k];
    });
    getRawPlan().filter(p=>p&&p.name===name).forEach(p=>{
      const t=LANE_TO_TIME[p.lane]||'pm';
      (p.days||[]).forEach(di=>{
        const canon=key(name,t,di);
        if(S.sched[canon]===false) return;
        if(!S.sched[canon]||S.sched[canon]===true) S.sched[canon]=true;
      });
    });
  }
  function applyUniversalEdit(){
    const daysBox=$('gpt342-edit-days');
    const colorBox=$('gpt342-edit-colors');
    const scopeEl=$('e-sscope');
    const universalDirty=(daysBox&&daysBox.dataset.gpt342Dirty==='1')||(colorBox&&colorBox.dataset.gpt342Dirty==='1');
    // No e-sscope in DOM: dose-only edits must use native saveEdit (per-cell RC-5).
    if(!universalDirty) return false;
    const name=selectedName(); if(!name||!window.S)return false;
    const doseEl=$('e-sdose'), unitEl=$('e-sdu');
    const dose=doseEl?parseFloat(doseEl.value):NaN; const unit=unitEl?unitEl.value:'mcg';
    const time=selectedTime();
    const lane=selectedLaneFromEdit(name,time);
    const days=effectiveDaysForSave(name,time); const color=selectedColorFromEdit();
    let it=invItem(name);
    if(!it&&color>=0){
      it={name,dose:isNaN(dose)?0:dose,doseUnit:unit||'mcg',days:days.length?days.slice():[],stackLane:lane,colorOverride:color};
      S.inv=S.inv||[];S.inv.push(it);
    }else if(it){
      if(!isNaN(dose))it.dose=dose;
      if(unit)it.doseUnit=unit;
      it.stackLane=lane;
      if(days.length)it.days=days.slice();
      if(color>=0)it.colorOverride=color;
    }
    let plan=getRawPlan(); const existing=plan.filter(p=>p&&p.name===name);
    const unionDays=[...new Set(existing.flatMap(p=>p.days||[]))].sort((a,b)=>a-b);
    const daysToUse=days.length?days:(unionDays.length?unionDays:[]);
    if(existing.length){
      plan=plan.filter(p=>!(p&&p.name===name));
      const base=existing[0];
      plan.push(Object.assign({},base,{name,lane,days:daysToUse,dose:!isNaN(dose)?dose:base.dose,unit:unit||base.unit||'mcg',purpose:base.purpose||((it&&it.importPurpose)||'')}));
    }else if(daysToUse.length){
      plan.push({id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name,lane,days:daysToUse,dose:!isNaN(dose)?dose:(it&&it.dose)||'',unit:unit||(it&&it.doseUnit)||'mcg',purpose:(it&&it.importPurpose)||''});
    }
    setPlan(plan); syncPlanToLegacyForName(name);
    try{window.save&&window.save()}catch(_){}
    try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderStack&&window.renderStack()}catch(_){}
    try{window.__tmpCalEditToastAt=Date.now()}catch(_){}
    toast('\u2713 Updated '+name,'Days, dose, lane, and color applied universally.');
    const db=$('gpt342-edit-days'),cb=$('gpt342-edit-colors');
    if(db) delete db.dataset.gpt342Dirty;
    if(cb) delete cb.dataset.gpt342Dirty;
    return true;
  }
  const mo=new MutationObserver((mutations)=>{
    const onlyDayColorPick=mutations.length>0&&mutations.every(m=>{
      if(m.type!=='attributes'||m.attributeName!=='class') return false;
      const t=m.target;
      return t&&(t.closest('#gpt342-edit-days')||t.closest('#gpt342-edit-colors'));
    });
    if(onlyDayColorPick) return;
    const editShown=mutations.some(function(m){
      if(m.type!=='attributes'||m.attributeName!=='style') return false;
      const t=m.target;
      return t&&t.id==='f-edit'&&getComputedStyle(t).display!=='none';
    });
    if(editShown){
      setTimeout(function(){try{window.scrollCalActionPanel&&scrollCalActionPanel('f-edit');}catch(_){}},60);
      setTimeout(function(){try{window.scrollCalActionPanel&&scrollCalActionPanel('f-edit');}catch(_){}},400);
    }
    if(!window.__tmpMoQuiet.active()&&!mo.__ecPending){mo.__ecPending=1;setTimeout(function(){mo.__ecPending=0;window.__tmpMoQuiet.run(function(){ensureEditControls(false);});},50);}
  });
  function start(){const ap=$('ap');if(ap)mo.observe(ap,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});ensureEditControls(true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#t-edit,#edit-bk')){
      setTimeout(function(){ensureEditControls(true);},90);
      setTimeout(function(){ensureEditControls(true);},250);
      setTimeout(function(){try{window.scrollCalActionPanel&&scrollCalActionPanel('f-edit');}catch(_){}},320);
      setTimeout(function(){try{window.scrollCalActionPanel&&scrollCalActionPanel('f-edit');}catch(_){}},650);
    }
    if(e.target&&e.target.closest&&e.target.closest('#edit-save')){
      if(applyUniversalEdit()){
        e.preventDefault();
        e.stopImmediatePropagation();
        try{if(window.apClose)apClose();else if(window.showTiles)showTiles();}catch(_){}
      }
    }
  },true);
  window.tmpApplyUniversalCalendarEdit=applyUniversalEdit;
})();


// ===== extracted post-core patch script =====
(function(){
  const PLAN_KEY='tmp.stackPlan.v1';
  const STATE_KEY='tmp.stackBuilder.pro.v1';
  const DAY={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const LANES_ALLOWED=new Set(['breakfast','lunch','dinner','bedtime']);
  const LANE_DEFS=[
    ['fat',window.__tmpSbGoalIcons.fat,'Fat loss / appetite','Weight trend, appetite control, adherence.'],
    ['recovery',window.__tmpSbGoalIcons.recovery,'Recovery / injury','Recovery-support timing and inventory awareness.'],
    ['sleep',window.__tmpSbGoalIcons.sleep,'Sleep / GH pulse','Night lane clarity and reduced crowding.'],
    ['muscle',window.__tmpSbGoalIcons.muscle,'Muscle retention','Training support and recomposition context.'],
    ['metabolic',window.__tmpSbGoalIcons.metabolic,'Metabolic health','Labs, glucose/lipids, wellness-support context.'],
    ['simplicity',window.__tmpSbGoalIcons.simplicity,'Simplicity / travel','Lower burden, fewer lanes, easier adherence.']
  ];
  const SOURCES=[
    ['inventory','Work from inventory','Use stocked/open items and avoid wishlist assumptions.'],
    ['hybrid','Hybrid','Use inventory first; suggest wishlist only if useful.'],
    ['virtual','Virtual best stack','Design an ideal stack and mark gaps as wishlist candidates.']
  ];
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(_){return false}}
  function state(){try{return Object.assign({step:1,lanes:[],source:'inventory',intent:''},JSON.parse(localStorage.getItem(STATE_KEY)||'{}'))}catch(_){return {step:1,lanes:[],source:'inventory',intent:''}}}
  function saveState(s){try{localStorage.setItem(STATE_KEY,JSON.stringify(s))}catch(_){}}
  function invNames(){try{return (S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>i.name)}catch(_){return []}}
  function findInv(rxArr){const names=invNames();for(const rx of rxArr){const n=names.find(x=>rx.test(String(x)));if(n)return n}return ''}
  function canonical(raw){
    const s=String(raw||'').trim(), l=s.toLowerCase().replace(/\s+/g,'');
    if(/^(retatrutide|reta|rt20|rt30|rt10|rt)$/.test(l)||/retatrutide/.test(l))return findInv([/^RT\d+/i,/^Reta/i,/Retatrutide/i])||s;
    if(/^(klo80|klow80|klow|klotho|klotho80)$/.test(l)||/klotho|klow/.test(l))return findInv([/^Klow80$/i,/^KLO80$/i,/^Klow$/i,/Klotho/i,/^KLO/i])||s;
    if(/^(tc250|testc|testosteronecypionate|testosterone|cypionate)$/.test(l)||/testosterone/.test(l))return findInv([/^TC250$/i,/^TC/i,/Testosterone Cypionate/i,/Test C/i])||s;
    if(/^(wv|wolverine|bpc157\+tb500|bpc-157\+tb-500|bpc157tb500)$/.test(l))return findInv([/^WV$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i])||'WV';
    if(/^(cp20|cp10|cjcipa|cjcipamorelin|cjc-1295ipamorelin|cjc\+ipamorelin)$/.test(l))return findInv([/^CP20$/i,/^CP10$/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i])||'CP20';
    return s;
  }
  function parseDays(days){
    if(!Array.isArray(days))return [];
    return [...new Set(days.map(d=>typeof d==='number'?d:(DAY[String(d||'').trim()]??DAY[String(d||'').trim().slice(0,3)]??null)).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function normalizePlan(raw){
    if(!Array.isArray(raw))throw new Error('JSON must be an array.');
    let rows=raw.map((r,i)=>{
      if(!r||typeof r!=='object')throw new Error('Row '+(i+1)+' is not an object.');
      const name=canonical(r.name), lane=String(r.lane||'').toLowerCase().trim(), days=parseDays(r.days);
      if(!name)throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES_ALLOWED.has(lane))throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length)throw new Error('Row '+(i+1)+' has no valid days.');
      return {id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name,lane,days,dose:r.dose===''||r.dose==null?'':Number(r.dose),unit:String(r.unit||'mcg').trim(),purpose:String(r.purpose||'').trim()};
    });
    // blend compression
    const hasWV=!!findInv([/^WV$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i]);
    const hasCP=!!findInv([/^CP20$/i,/^CP10$/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i]);
    function same(a,b){return a.lane===b.lane&&a.days.join(',')===b.days.join(',')}
    if(hasWV){
      const wv=canonical('WV'), out=[], used=new Set();
      rows.forEach((r,i)=>{if(used.has(i))return; const isB=/^BPC-?157$/i.test(r.name), isT=/^TB-?500$/i.test(r.name);
        if(isB||isT){const j=rows.findIndex((x,k)=>k!==i&&!used.has(k)&&same(r,x)&&((isB&&/^TB-?500$/i.test(x.name))||(isT&&/^BPC-?157$/i.test(x.name)))); if(j>=0){out.push({...r,name:wv,purpose:(r.purpose||rows[j].purpose||'Recovery blend')+' · merged blend'});used.add(i);used.add(j);return;}}
        out.push(r);used.add(i);
      }); rows=out;
    }
    if(hasCP){
      const cp=canonical('CP20'), out=[], used=new Set();
      rows.forEach((r,i)=>{if(used.has(i))return; const isC=/CJC/i.test(r.name), isI=/Ipamorelin/i.test(r.name);
        if(isC||isI){const j=rows.findIndex((x,k)=>k!==i&&!used.has(k)&&same(r,x)&&((isC&&/Ipamorelin/i.test(x.name))||(isI&&/CJC/i.test(x.name)))); if(j>=0){out.push({...r,name:cp,purpose:(r.purpose||rows[j].purpose||'GH pulse blend')+' · merged blend'});used.add(i);used.add(j);return;}}
        out.push(r);used.add(i);
      }); rows=out;
    }
    const map=new Map();
    rows.forEach(r=>{const k=r.name.toLowerCase()+'|'+r.lane+'|'+r.days.join(',');if(!map.has(k))map.set(k,r)});
    return [...map.values()];
  }
  function timeForLane(l){return (l==='breakfast'||l==='lunch')?'am':'pm'}
  function key(n,t,d){return n+'/'+t+'/'+d}
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){S.stackPlan=plan;S.inv=S.inv||[];S.sched=S.sched||{};if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);if(!it){it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:p.dose||0,doseUnit:p.unit,cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};S.inv.push(it)}
      if(p.dose!==''&&!isNaN(p.dose))it.dose=p.dose;it.doseUnit=p.unit||it.doseUnit||'mcg';it.stackLane=p.lane;it.days=p.days.slice();it.importPurpose=p.purpose||'';const t=timeForLane(p.lane);p.days.forEach(di=>S.sched[key(p.name,t,di)]=true)});
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function strictPrompt(){
    const s=state();
    const intent=String(s.intent||'').trim();
    return [
      'Return ONLY valid JSON. No markdown. No commentary.',
      '',
      'Create a PeptideGenius stack plan using this exact schema:',
      '[{"name":"Retatrutide","lane":"breakfast","days":["Mon","Thu"],"dose":1,"unit":"mg","purpose":"Fat loss / appetite lane"}]',
      '',
      intent ? ('User request (primary guidance):\n'+intent) : 'User request: (none — infer from selected lanes and inventory only)',
      '',
      'Selected lanes: '+(s.lanes.map(x=>LANE_DEFS.find(l=>l[0]===x)?.[2]||x).join(', ')||'not selected'),
      'Build source: '+s.source,
      'Current inventory names: '+(invNames().join(', ')||'none detected'),
      '',
      'Rules:',
      '- JSON array only.',
      '- Allowed lanes: breakfast, lunch, dinner, bedtime.',
      '- Allowed days: Mon, Tue, Wed, Thu, Fri, Sat, Sun.',
      '- Every row must include name, lane, days, dose, unit, purpose.',
      '- Prefer exact inventory names when possible.',
      '- If inventory has WV blend, use WV instead of separate BPC-157 and TB-500.',
      '- If inventory has CP20 blend, use CP20 instead of separate CJC-1295 and Ipamorelin unless individual Ipamorelin is intentionally separate.',
      '- Use cautious/provisional planning language in purpose.',
      '- Do not add text before or after JSON.'
    ].join('\n');
  }
  function sampleJson(){
    return JSON.stringify([
      {name:findInv([/^Klow80$/i,/^KLO80$/i,/^Klow/i])||'Klow',lane:'breakfast',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],dose:'',unit:'mcg',purpose:'AM routine / support slot'},
      {name:findInv([/^RT\d+/i])||'Retatrutide',lane:'breakfast',days:['Mon','Thu'],dose:1,unit:'mg',purpose:'Fat loss / appetite lane'},
      {name:findInv([/^CP20$/i])||'CP20',lane:'bedtime',days:['Tue','Sat'],dose:250,unit:'mcg',purpose:'GH pulse blend lane'}
    ],null,2);
  }
  function currentPlan(){
    try{
      let plan = window.S && Array.isArray(S.stackPlan) ? S.stackPlan : JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');
      if(!Array.isArray(plan)) plan = [];
      return (window.tmpCalClearGuard ? tmpCalClearGuard.planForCalendar(plan) : plan);
    }catch(_){ return []; }
  }
  function renderPlanTable(plan){
    if(!plan||!plan.length)return '<p>No local stack plan saved yet.</p>';
    const E=window.escH||String;
    return '<table class="gpt343-plan-table"><thead><tr><th>Item</th><th>Lane</th><th>Days</th><th>Dose</th><th>Purpose</th></tr></thead><tbody>'+plan.map(p=>'<tr><td><b>'+E(p.name)+'</b></td><td><span class="gpt343-chip">'+E(p.lane)+'</span></td><td>'+p.days.map(d=>DAYS[d]).join(', ')+'</td><td>'+((p.dose||p.dose===0)?E(String(p.dose)):'')+' '+E(p.unit||'')+'</td><td>'+E(p.purpose||'')+'</td></tr>').join('')+'</tbody></table>';
  }
  function build(){
    const pg=document.getElementById('pg-stackbuilder'); if(!pg||document.getElementById('gpt343-stackbuilder-pro'))return;
    const wrap=document.createElement('section');wrap.id='gpt343-stackbuilder-pro';
    wrap.innerHTML='<div class="gpt343-hero"><div class="gpt343-hero-top"><div><div class="gpt343-kicker">Stack Builder</div><div class="gpt343-title">Clean stack planning workspace</div><div class="gpt343-sub">Describe what you want, pick goal lanes, then let A.I. build a weekly stack from your inventory.</div></div><div class="gpt343-actions"><button class="gpt343-btn primary" id="gpt343-copy-prompt">Copy prompt + open GPT</button><button class="gpt343-btn" id="gpt343-open-calendar">Open calendar</button></div></div><div class="gpt343-status-row"><div class="gpt343-stat"><b id="gpt343-stat-goals">0</b><span>Goals</span></div><div class="gpt343-stat"><b id="gpt343-stat-source">Inventory</b><span>Source</span></div><div class="gpt343-stat"><b id="gpt343-stat-plan">0</b><span>Plan items</span></div><div class="gpt343-stat"><b>JSON</b><span>Import path</span></div></div></div><div class="gpt343-body"><nav class="gpt343-rail"><button data-step="1" class="on"><span class="num">1</span><span><strong>Goals</strong><span>Describe + pick lanes</span></span></button><button data-step="2"><span class="num">2</span><span><strong>GPT plan</strong><span>Strict prompt</span></span></button><button data-step="3"><span class="num">3</span><span><strong>Import</strong><span>Paste JSON</span></span></button><button data-step="4"><span class="num">4</span><span><strong>Review</strong><span>Calendar sync</span></span></button></nav><main class="gpt343-panel"><section class="gpt343-screen on" data-screen="1"><h3>1. Tell A.I. what you are looking for</h3><p>Describe your goals in plain language, then optionally pick preset lanes and a build source.</p><div class="gpt343-intent-block"><label for="gpt343-intent">What are you looking for?</label><p class="gpt343-intent-hint">Examples: fat loss with minimal injections, recovery after injury, sleep support without crowding PM lane, travel-friendly schedule.</p><textarea id="gpt343-intent" class="gpt343-intent" rows="4" placeholder="e.g. I want fat loss focus using RT30 Mon/Thu. Use WV for recovery on rest days. Keep bedtime to one item. Only use what I have in inventory."></textarea></div><div class="gpt343-lanes"></div><div class="gpt343-source-grid"></div><div class="gpt343-footer"><button class="gpt343-btn primary" data-next="2">Next: build with A.I.</button></div></section><section class="gpt343-screen" data-screen="2"><h3>2. Ask GPT for a strict plan</h3><p>Copy the prompt, paste it into GPT, and ask for JSON only. The prompt includes your selected lanes and inventory names.</p><textarea class="gpt343-textarea" id="gpt343-prompt" readonly></textarea><div class="gpt343-inline-actions"><button class="gpt343-btn primary" id="gpt343-copy-prompt-2">Copy prompt + open GPT</button><button class="gpt343-btn" data-next="3">Next: paste JSON</button></div></section><section class="gpt343-screen" data-screen="3"><h3>3. Paste GPT JSON</h3><p>Paste the full JSON array here. The importer de-dupes aliases and uses your blend names when appropriate.</p><textarea class="gpt343-textarea" id="gpt343-json" placeholder=\'[{"name":"Retatrutide","lane":"breakfast","days":["Mon","Thu"],"dose":1,"unit":"mg","purpose":"Fat loss / appetite"}]\'></textarea><div class="gpt343-inline-actions"><button class="gpt343-btn primary" id="gpt343-import">Import to calendar</button><button class="gpt343-btn" id="gpt343-check">Check JSON</button><button class="gpt343-btn" id="gpt343-sample">Use sample</button><span class="gpt343-status" id="gpt343-status">Waiting for JSON.</span></div></section><section class="gpt343-screen" data-screen="4"><h3>4. Review the local stack plan</h3><p>This is the single source of truth used by Weekly Calendar, Inventory, and Optimizer.</p><div id="gpt343-review"></div><div class="gpt343-footer"><button class="gpt343-btn primary" id="gpt343-go-calendar">Open Weekly Calendar</button><button class="gpt343-btn" id="gpt343-go-optimizer">Open Optimizer</button><button class="gpt343-btn" data-next="1">Edit goals</button></div></section></main></div>';
    pg.insertBefore(wrap,pg.firstChild);
    wire();
    render();
  }
  function setStep(n){
    document.querySelectorAll('.gpt343-rail button').forEach(b=>b.classList.toggle('on',b.dataset.step==n));
    document.querySelectorAll('.gpt343-screen').forEach(s=>s.classList.toggle('on',s.dataset.screen==n));
    const st=state();st.step=n;saveState(st);render();
  }
  function render(){
    const s=state(), plan=currentPlan();
    const lanesHost=document.querySelector('.gpt343-lanes');
    if(lanesHost)lanesHost.innerHTML=LANE_DEFS.map(l=>'<button class="gpt343-lane '+(s.lanes.includes(l[0])?'on':'')+'" data-lane="'+l[0]+'"><div class="ico">'+l[1]+'</div><strong>'+l[2]+'</strong><span>'+l[3]+'</span></button>').join('');
    const srcHost=document.querySelector('.gpt343-source-grid');
    if(srcHost)srcHost.innerHTML=SOURCES.map(x=>'<button class="gpt343-source '+(s.source===x[0]?'on':'')+'" data-source="'+x[0]+'"><strong>'+x[1]+'</strong><span>'+x[2]+'</span></button>').join('');
    const intentEl=$('gpt343-intent');
    if(intentEl&&document.activeElement!==intentEl)intentEl.value=String(s.intent||'');
    const p=$('gpt343-prompt'); if(p)p.value=strictPrompt();
    const r=$('gpt343-review'); if(r)r.innerHTML=renderPlanTable(plan);
    const a=$('gpt343-stat-goals'); if(a)a.textContent=s.lanes.length;
    const b=$('gpt343-stat-source'); if(b)b.textContent=(s.source||'inventory').replace(/^./,c=>c.toUpperCase()).slice(0,9);
    const c=$('gpt343-stat-plan'); if(c)c.textContent=plan.length||0;
  }
  function check(){
    const status=$('gpt343-status');
    try{const plan=normalizePlan(JSON.parse($('gpt343-json').value||''));status.textContent='Valid: '+plan.length+' item(s).';status.className='gpt343-status ok';return plan}catch(e){status.textContent='Error: '+e.message;status.className='gpt343-status bad';return null}
  }
  function doImport(){
    const plan=check(); if(!plan)return;
    savePlan(plan);
    try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
    toast('✓ Stack plan imported',plan.length+' de-duplicated item'+(plan.length===1?'':'s')+' saved.');
    setStep(4);
  }
  function wire(){
    document.querySelectorAll('.gpt343-rail button').forEach(b=>b.onclick=()=>setStep(b.dataset.step));
    document.addEventListener('click',async e=>{
      const lane=e.target.closest&&e.target.closest('.gpt343-lane');
      if(lane){const s=state(),v=lane.dataset.lane;s.lanes=s.lanes.includes(v)?s.lanes.filter(x=>x!==v):[...s.lanes,v];saveState(s);render();}
      const src=e.target.closest&&e.target.closest('.gpt343-source');
      if(src){const s=state();s.source=src.dataset.source;saveState(s);render();}
      const next=e.target.closest&&e.target.closest('[data-next]');
      if(next)setStep(next.dataset.next);
    },true);
    const copy=async()=>{const ok=await copyText(strictPrompt());try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){}toast(ok?'✓ Prompt copied — paste into GPT':'GPT opened — copy may be blocked',ok?'':'amber')};
    $('gpt343-copy-prompt').onclick=copy;$('gpt343-copy-prompt-2').onclick=copy;$('gpt343-check').onclick=check;$('gpt343-import').onclick=doImport;$('gpt343-sample').onclick=()=>{$('gpt343-json').value=sampleJson();check();};
    $('gpt343-open-calendar').onclick=()=>document.querySelector('[data-pg="calendar"]')?.click();
    $('gpt343-go-calendar').onclick=()=>document.querySelector('[data-pg="calendar"]')?.click();
    $('gpt343-go-optimizer').onclick=()=>document.querySelector('[data-pg="optimizer"]')?.click();
    const intentEl=$('gpt343-intent');
    if(intentEl&&!intentEl.__bound){
      intentEl.__bound=1;
      let intentTimer;
      intentEl.addEventListener('input',()=>{
        clearTimeout(intentTimer);
        intentTimer=setTimeout(()=>{
          const st=state();
          st.intent=intentEl.value;
          saveState(st);
          const pr=$('gpt343-prompt');
          if(pr)pr.value=strictPrompt();
        },180);
      });
    }
  }
  function ensureIntentField(){
    const screen=document.querySelector('#gpt343-stackbuilder-pro .gpt343-screen[data-screen="1"]');
    if(!screen||$('gpt343-intent'))return;
    const block=document.createElement('div');
    block.className='gpt343-intent-block';
    block.innerHTML='<label for="gpt343-intent">What are you looking for?</label><p class="gpt343-intent-hint">Examples: fat loss with minimal injections, recovery after injury, sleep support without crowding PM lane.</p><textarea id="gpt343-intent" class="gpt343-intent" rows="4" placeholder="Describe your goals, constraints, and schedule preferences…"></textarea>';
    const lanes=screen.querySelector('.gpt343-lanes');
    if(lanes)screen.insertBefore(block,lanes);
    else screen.appendChild(block);
    const st=state();
    const el=$('gpt343-intent');
    if(el){el.value=String(st.intent||'');if(!el.__bound){el.__bound=1;let t;el.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{const s=state();s.intent=el.value;saveState(s);const pr=$('gpt343-prompt');if(pr)pr.value=strictPrompt();},180);});}}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(build,400));else setTimeout(build,400);
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]')){setTimeout(build,160);setTimeout(ensureIntentField,200);}},true);
  setTimeout(ensureIntentField,600);
  window.tmpStrictStackPlanPrompt=strictPrompt;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    The Daily Stack flicker was caused by legacy Daily Stack UI rendering first
    and the newer "Command Central" patch rendering shortly after. This
    makes the new shell the first visible Daily Stack surface and removes the
    old green control-center surfaces from the paint path.
  */
  function stackPage(){return document.getElementById('pg-stack');}
  function hideLegacy(){
    var pg=stackPage();
    if(!pg) return;
    pg.classList.add('gpt344-daily-stabilizing');
    var selectors=[
      '.gpt-cockpit-hero',
      '.gpt-cockpit-shell',
      '.gpt-cockpit-card',
      '.gpt-daily-control-center',
      '[id*="control-center"]',
      '[class*="control-center"]'
    ];
    selectors.forEach(function(sel){
      pg.querySelectorAll(sel).forEach(function(el){
        if(el.classList && el.classList.contains('gpt270-shell')) return;
        // Freeze fix: skip if already hidden — re-setting identical styles still
        // emits attribute mutations, which re-fed the #pg-stack observer loop.
        if(el.style.getPropertyValue('display')==='none' && el.getAttribute('aria-hidden')==='true') return;
        el.style.setProperty('display','none','important');
        el.style.setProperty('visibility','hidden','important');
        el.style.setProperty('opacity','0','important');
        el.setAttribute('aria-hidden','true');
      });
    });
  }
  function stabilize(){
    hideLegacy();
    var pg=stackPage();
    if(!pg) return;
    var elite=pg.querySelector('.gpt270-shell');
    if(elite && elite.style.getPropertyValue('opacity')!=='1'){ // freeze fix: no-op when already stabilized
      elite.style.setProperty('visibility','visible','important');
      elite.style.setProperty('opacity','1','important');
      elite.style.setProperty('animation','none','important');
      elite.style.setProperty('transition','none','important');
    }
    // Freeze fix: only schedule the class removal if present, and run it inside
    // the mutation-quiet guard so the removal doesn't re-trigger the observer.
    if(pg.classList.contains('gpt344-daily-stabilizing') && !stabilize.__unstabTimer){
      stabilize.__unstabTimer=setTimeout(function(){stabilize.__unstabTimer=null;try{window.__tmpMoQuiet.run(function(){pg.classList.remove('gpt344-daily-stabilizing');});}catch(_){}},450);
    }
  }

  // Run immediately, at DOM ready, after nav/render, and after mutations.
  hideLegacy();
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){stabilize();setTimeout(stabilize,250);setTimeout(stabilize,700);});
  }else{
    stabilize();setTimeout(stabilize,250);setTimeout(stabilize,700);
  }

  document.addEventListener('click',function(e){
    if(e.target && e.target.closest && e.target.closest('[data-pg="stack"]')){
      hideLegacy();
      setTimeout(stabilize,60);
      setTimeout(stabilize,220);
    }
  },true);

  var mo=new MutationObserver(function(muts){
    var touched=false;
    for(var i=0;i<muts.length;i++){
      if(muts[i].target && (muts[i].target.id==='pg-stack' || (muts[i].target.closest && muts[i].target.closest('#pg-stack')))){
        touched=true;break;
      }
    }
    if(touched && !window.__tmpMoQuiet.active() && !mo.__pending){mo.__pending=1;setTimeout(function(){mo.__pending=0;window.__tmpMoQuiet.run(stabilize);},25);}
  });
  function startObserver(){
    var pg=stackPage();
    if(pg){try{mo.observe(pg,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});}catch(_){}}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startObserver);
  else startObserver();

  // Wrap renderStack so every render starts by suppressing old UI and ends
  // with the new UI stabilized.
  var old=window.renderStack;
  if(typeof old==='function' && !old.__gpt344Wrapped){
    window.renderStack=function(){
      hideLegacy();
      var r=old.apply(this,arguments);
      setTimeout(stabilize,20);
      return r;
    };
    window.renderStack.__gpt344Wrapped=true;
  }

  window.tmpDailyStackStabilize=stabilize;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Prefer the user's inventory codes in Stack Builder / strict JSON import:
      Tesamorelin  -> TS10 when present
      Retatrutide  -> RT30 when present, then RT20/RT10/etc.
      Testosterone -> TC250 when present
      Klow/KLO     -> Klow80/KLO80 when present
    This runs before the newer pro Stack Builder importer saves S.stackPlan.
  */
  const PLAN_KEY='tmp.stackPlan.v1';
  const DAY={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES=new Set(['breakfast','lunch','dinner','bedtime']);

  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function invNames(){
    try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>i.name)}catch(_){return []}
  }
  function prefer(list){
    const names=invNames();
    for(const exact of list.exact||[]){
      const hit=names.find(n=>String(n).toLowerCase()===String(exact).toLowerCase());
      if(hit) return hit;
    }
    for(const rx of list.regex||[]){
      const hit=names.find(n=>rx.test(String(n)));
      if(hit) return hit;
    }
    return '';
  }
  function canonicalName(raw){
    const s=String(raw||'').trim();
    const l=s.toLowerCase().replace(/\s+/g,'');
    if(!s) return s;

    // User inventory-code priority
    if(/tesamorelin|^tesa|^ts10$|^ts20$|^ts$/i.test(s) || /tesamorelin/.test(l)){
      return prefer({exact:['TS10','TS20'], regex:[/^TS\d+/i,/Tesamorelin/i,/^Tesa/i]}) || s;
    }
    if(/^(retatrutide|reta|rt30|rt20|rt10|rt)$/.test(l) || /retatrutide/.test(l)){
      // Prefer RT30 specifically because user has it coded that way for current stack.
      return prefer({exact:['RT30','RT20','RT10'], regex:[/^RT\d+/i,/^Reta/i,/Retatrutide/i]}) || s;
    }
    if(/^(tc250|testc|testosteronecypionate|testosterone|cypionate)$/.test(l) || /testosterone/.test(l)){
      return prefer({exact:['TC250'], regex:[/^TC\d+/i,/Testosterone Cypionate/i,/Test C/i]}) || s;
    }
    if(/^(klo80|klow80|klow|klotho|klotho80)$/.test(l) || /klotho|klow/.test(l)){
      return prefer({exact:['Klow80','KLO80','Klow','KLO'], regex:[/^Klow\d*/i,/^KLO\d*/i,/Klotho/i]}) || s;
    }
    if(/^(wv|wolverine|bpc157\+tb500|bpc-157\+tb-500|bpc157tb500)$/.test(l)){
      return prefer({exact:['WV'], regex:[/^WV$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i]}) || 'WV';
    }
    if(/^(cp20|cp10|cjcipa|cjcipamorelin|cjc-1295ipamorelin|cjc\+ipamorelin)$/.test(l)){
      return prefer({exact:['CP20','CP10'], regex:[/^CP\d+/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i]}) || 'CP20';
    }
    return s;
  }
  function parseDays(days){
    if(!Array.isArray(days))return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number')return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function normalizePlan(raw){
    if(!Array.isArray(raw))throw new Error('JSON must be an array.');
    const rows=raw.map((r,i)=>{
      if(!r||typeof r!=='object')throw new Error('Row '+(i+1)+' is not an object.');
      const name=canonicalName(r.name);
      const lane=String(r.lane||'').toLowerCase().trim();
      const days=parseDays(r.days);
      if(!name)throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane))throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length)throw new Error('Row '+(i+1)+' has no valid days.');
      return {
        id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        name,lane,days,
        dose:r.dose===''||r.dose==null?'':Number(r.dose),
        unit:String(r.unit||'mcg').trim(),
        purpose:String(r.purpose||'').trim()
      };
    });
    const map=new Map();
    rows.forEach(r=>{
      const k=r.name.toLowerCase()+'|'+r.lane+'|'+r.days.join(',');
      if(!map.has(k)) map.set(k,r);
    });
    return [...map.values()];
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      S.stackPlan=plan; S.inv=S.inv||[]; S.sched=S.sched||{}; if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it){
          it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:p.dose||0,doseUnit:p.unit,cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};
          S.inv.push(it);
        }
        if(p.dose!==''&&!isNaN(p.dose))it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';
        it.stackLane=p.lane; it.days=p.days.slice(); it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane); p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function importFromVisibleJson(){
    const ta=$('gpt343-json') || $('gpt340-json') || $('gpt339-json') || $('gpt336-json-input') || $('gpt337-json-input');
    if(!ta) return false;
    try{
      const plan=normalizePlan(JSON.parse(ta.value||''));
      savePlan(plan);
      try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
      const status=$('gpt343-status') || $('gpt340-status') || $('gpt339-status');
      if(status){status.textContent='Imported '+plan.length+' item(s), using inventory codes like TS10 / RT30.';status.className='gpt343-status ok ok';}
      toast('✓ Imported using inventory codes',plan.map(p=>p.name).join(', '));
      setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},300);
      return true;
    }catch(e){
      const status=$('gpt343-status') || $('gpt340-status') || $('gpt339-status');
      if(status){status.textContent='Error: '+e.message;status.className='gpt343-status bad bad';}
      toast('JSON import failed',e.message||'Invalid JSON');
      return true;
    }
  }
  function enhancedPrompt(base){
    return String(base||'')+
      '\n\nIMPORTANT INVENTORY NAME RULE:\n'+
      '- Prefer exact inventory item names/codes when present.\n'+
      '- Use TS10 instead of Tesamorelin if TS10 is in inventory.\n'+
      '- Use RT30 instead of Retatrutide if RT30 is in inventory.\n'+
      '- Use TC250 instead of Testosterone Cypionate if TC250 is in inventory.\n'+
      '- Use WV instead of separate BPC-157 and TB-500 if WV is in inventory.\n'+
      '- Use CP20 instead of separate CJC-1295 and Ipamorelin if CP20 is the intended blend.\n'+
      '- Current inventory names: '+(invNames().join(', ')||'none detected')+'\n';
  }

  // Intercept import buttons so alias normalization runs before older import handlers.
  window.addEventListener('click',function(e){
    if(!e.target||!e.target.closest)return;
    if(e.target.closest('#gpt343-import,#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      importFromVisibleJson();
    }
  },true);

  // Patch prompt textareas after render to explicitly request inventory codes.
  function patchPrompt(){
    ['gpt343-prompt'].forEach(id=>{
      const el=$(id);
      if(el && !/IMPORTANT INVENTORY NAME RULE/.test(el.value||'')){
        el.value=enhancedPrompt(el.value);
      }
    });
  }
  __tmpPgInterval(patchPrompt, 1000, 'pg-stackbuilder');
  setTimeout(patchPrompt,500);

  window.tmpNormalizeInventoryAliases345=normalizePlan;
  window.tmpCanonicalInventoryName345=canonicalName;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    True API-powered Stack Builder GPT automation.
    Requires Netlify function:
      /api/gpt-stack-plan
    Flow:
      Generate with GPT -> function calls OpenAI -> returns strict stack plan JSON
      Generate + import -> writes S.stackPlan and opens Weekly Calendar
  */
  const ENDPOINT = '/api/gpt-stack-plan';
  const PLAN_KEY = 'tmp.stackPlan.v1';
  const DAY = {Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES = new Set(['breakfast','lunch','dinner','bedtime']);

  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function setStatus(msg,kind){
    const s=$('gpt346-api-status');
    if(s){s.textContent=msg;s.className=kind||'';}
  }
  function invNames(){
    try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>i.name)}catch(_){return []}
  }
  function selectedBuilderState(){
    let st={};
    try{st=JSON.parse(localStorage.getItem('tmp.stackBuilder.pro.v1')||'{}')}catch(_){}
    try{
      const old=JSON.parse(localStorage.getItem('tmp.stackBuilder.v1')||'{}');
      st=Object.assign({}, old, st);
    }catch(_){}
    return st;
  }
  function promptText(){
    const existing=($('gpt343-prompt')||{}).value || (typeof window.tmpStrictStackPlanPrompt==='function' ? window.tmpStrictStackPlanPrompt() : '');
    const st=selectedBuilderState();
    const intent=String(st.intent||($('gpt343-intent')||{}).value||'').trim();
    return [
      existing || 'Create a PeptideGenius stack plan as strict JSON.',
      '',
      intent ? ('USER REQUEST (follow this closely):\n'+intent) : '',
      intent ? '' : null,
      'API AUTOMATION CONTEXT:',
      'Selected builder state: '+JSON.stringify(st),
      'Inventory names/codes: '+(invNames().join(', ')||'none detected'),
      '',
      'Return a JSON object with a `plan` array. Each plan item must include:',
      'name, lane, days, dose, unit, purpose.',
      'Allowed lanes: breakfast, lunch, dinner, bedtime.',
      'Allowed day strings: Mon, Tue, Wed, Thu, Fri, Sat, Sun.',
      'Prefer exact inventory codes/names when present.'
    ].filter(Boolean).join('\n');
  }
  function parseDays(days){
    if(!Array.isArray(days)) return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number') return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function normalizePlan(raw){
    const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.plan) ? raw.plan : []);
    if(!arr.length) throw new Error('GPT returned no plan array.');
    return arr.map((r,i)=>{
      const name=String(r.name||'').trim();
      const lane=String(r.lane||'').trim().toLowerCase();
      const days=parseDays(r.days);
      if(!name) throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane)) throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length) throw new Error('Row '+(i+1)+' missing valid days.');
      return {
        id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        name,
        lane,
        days,
        dose:r.dose===''||r.dose==null?'':Number(r.dose),
        unit:String(r.unit||'mcg').trim(),
        purpose:String(r.purpose||'').trim()
      };
    });
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      S.stackPlan=plan; S.inv=S.inv||[]; S.sched=S.sched||{}; if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it){
          it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:p.dose||0,doseUnit:p.unit,cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};
          S.inv.push(it);
        }
        if(p.dose!==''&&!isNaN(p.dose))it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';
        it.stackLane=p.lane; it.days=p.days.slice(); it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane); p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  async function callGPT(autoImport){
    setStatus('Calling GPT through Netlify function…');
    const payload={
      prompt: promptText(),
      inventory: invNames(),
      builderState: selectedBuilderState(),
      mode: autoImport ? 'generate_and_import' : 'generate_only'
    };
    let res, data;
    try{
      res=await fetch(ENDPOINT,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
    }catch(e){
      setStatus('Could not reach Netlify function. Deploy the package first, then use the live Netlify URL.\n\nEndpoint: '+ENDPOINT,'bad');
      return;
    }
    try{data=await res.json()}catch(e){data={ok:false,error:'Function returned non-JSON response.'};}
    if(!res.ok || !data.ok){
      setStatus('GPT function failed: '+(data.error||res.statusText||'Unknown error'),'bad');
      return;
    }
    let plan;
    try{plan=normalizePlan(data.plan || data.raw)}catch(e){setStatus('GPT returned invalid plan: '+e.message+'\n\nRaw:\n'+JSON.stringify(data,null,2),'bad');return;}
    const jsonText=JSON.stringify(plan.map(p=>({
      name:p.name,
      lane:p.lane,
      days:p.days.map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]),
      dose:p.dose,
      unit:p.unit,
      purpose:p.purpose
    })), null, 2);

    const box=$('gpt343-json') || $('gpt340-json') || $('gpt339-json');
    if(box) box.value=jsonText;

    if(autoImport){
      savePlan(plan);
      try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
      setStatus('GPT generated and imported '+plan.length+' item(s). Opening Weekly Calendar…','ok');
      toast('✓ GPT plan imported',plan.length+' item'+(plan.length===1?'':'s')+' saved.');
      setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},350);
    }else{
      setStatus('GPT generated '+plan.length+' item(s). Review the JSON, then import.','ok');
      toast('✓ GPT plan generated');
    }
  }
  function injectCard(){
    const root=document.getElementById('gpt343-stackbuilder-pro') || document.getElementById('pg-stackbuilder');
    if(!root || $('gpt346-api-card')) return;
    const hero=root.querySelector('.gpt343-hero') || root.firstElementChild;
    const card=document.createElement('section');
    card.id='gpt346-api-card';
    card.innerHTML='<div class="gpt346-head"><div><div class="gpt346-k">API GPT automation</div><div class="gpt346-title">Generate a stack plan without copy/paste</div><div class="gpt346-sub">Uses your Netlify Function and server-side OpenAI key. GPT returns strict JSON, then PeptideGenius can import it directly into S.stackPlan and the Weekly Calendar.</div></div><div class="gpt346-actions"><button type="button" class="primary" id="gpt346-generate-import">Generate + import</button><button type="button" id="gpt346-generate">Generate only</button></div></div><div id="gpt346-api-status">Ready. This works after deploying the Netlify function package.</div>';
    if(hero && hero.parentNode) hero.parentNode.insertBefore(card, hero.nextSibling);
    else root.insertBefore(card, root.firstChild);
    $('gpt346-generate').onclick=()=>callGPT(false);
    $('gpt346-generate-import').onclick=()=>callGPT(true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(injectCard,700));
  else setTimeout(injectCard,700);
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(injectCard,300)},true);
  window.tmpGPTApiStackPlan=callGPT;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Fixes GPT returning [] for stack plans.
    Root cause: strict prompt allowed a JSON array only, but did not explicitly forbid
    an empty array or define a fallback when inventory/context is sparse.
    New rule:
      - GPT must return at least 1 row.
      - If inventory/context is incomplete, return a provisional review-needed row
        or use selected lane defaults, not [].
      - UI rejects [] and tells the user what to do.
  */
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  function inventoryNames(){
    try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>i.name)}catch(_){return []}
  }
  function selectedGoals(){
    const goals=[];
    try{
      document.querySelectorAll('.gpt343-lane.on').forEach(x=>{
        const t=(x.querySelector('strong')||x).textContent.trim();
        if(t)goals.push(t);
      });
    }catch(_){}
    return goals;
  }
  function fallbackRows(){
    const inv=inventoryNames();
    const names=inv.map(x=>String(x).toLowerCase());
    const has=(rx)=>inv.find(n=>rx.test(String(n)));
    const rows=[];
    const rt=has(/^RT\d+/i)||has(/retatrutide/i);
    const ts=has(/^TS\d+/i)||has(/tesamorelin/i);
    const cp=has(/^CP\d+/i)||has(/cjc.*ipa|cjc.*ipamorelin/i);
    const wv=has(/^WV$/i)||has(/wolverine|bpc.*tb|tb.*bpc/i);
    const klow=has(/^Klow/i)||has(/^KLO/i)||has(/klotho/i);
    const tc=has(/^TC\d+/i)||has(/testosterone/i);
    if(klow) rows.push({name:klow,lane:'breakfast',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],dose:'',unit:'mcg',purpose:'AM routine / support lane; verify dose and need.'});
    if(rt) rows.push({name:rt,lane:'breakfast',days:['Mon','Thu'],dose:1,unit:'mg',purpose:'Fat loss / appetite lane; provisional schedule for review.'});
    if(wv) rows.push({name:wv,lane:'dinner',days:['Mon','Wed','Fri'],dose:'',unit:'mcg',purpose:'Recovery / injury blend lane; verify dose and frequency.'});
    if(ts) rows.push({name:ts,lane:'bedtime',days:['Mon','Wed','Fri'],dose:1,unit:'mg',purpose:'Sleep / GH pulse lane; provisional schedule for review.'});
    if(cp) rows.push({name:cp,lane:'bedtime',days:['Tue','Sat'],dose:250,unit:'mcg',purpose:'GH pulse blend lane; provisional schedule for review.'});
    if(tc) rows.push({name:tc,lane:'dinner',days:['Mon'],dose:'',unit:'mg',purpose:'Existing protocol context; verify with prescriber.'});
    return rows.length?rows:[{name:'Review-needed stack item',lane:'breakfast',days:['Mon'],dose:'',unit:'mcg',purpose:'Insufficient inventory/context detected; add inventory or select goals before relying on this plan.'}];
  }
  function strongerPrompt(base){
    const inv=inventoryNames();
    const goals=selectedGoals();
    let intent='';
    try{intent=String(JSON.parse(localStorage.getItem('tmp.stackBuilder.pro.v1')||'{}').intent||($('gpt343-intent')||{}).value||'').trim()}catch(_){}
    return String(base||'')+
      (intent?'\n\nUSER REQUEST (primary guidance):\n'+intent:'')+
      '\n\nCRITICAL NON-EMPTY OUTPUT RULE:\n'+
      '- Do NOT return [] or an empty plan.\n'+
      '- Return at least 1 stack-plan row.\n'+
      '- If inventory is incomplete or no perfect item is available, return a cautious provisional row and write "review needed" in purpose.\n'+
      '- If selected lanes are present, choose the most relevant inventory item for each selected goal.\n'+
      '- If inventory aliases are present, use exact codes: RT30/RT20 for retatrutide, TS10 for tesamorelin, TC250 for testosterone cypionate, WV for BPC/TB blend, CP20 for CJC/Ipamorelin blend.\n'+
      '- Current selected lanes: '+(goals.join(', ')||'none detected')+'\n'+
      '- Current inventory names: '+(inv.join(', ')||'none detected')+'\n';
  }

  // Patch visible prompt textarea.
  function patchPrompts(){
    ['gpt343-prompt','gpt340-prompt','gpt339-prompt'].forEach(id=>{
      const el=$(id);
      if(el && !/CRITICAL NON-EMPTY OUTPUT RULE/.test(el.value||'')){
        el.value=strongerPrompt(el.value);
      }
    });
  }

  // Override strict prompt function if present.
  const oldStrict=window.tmpStrictStackPlanPrompt;
  window.tmpStrictStackPlanPrompt=function(){
    const base=typeof oldStrict==='function'?oldStrict():'Return ONLY valid JSON using PeptideGenius stack plan schema.';
    return strongerPrompt(base);
  };

  // Validate imported JSON and reject empty arrays with useful message.
  function checkForEmptyImport(){
    const ta=$('gpt343-json')||$('gpt340-json')||$('gpt339-json')||$('gpt336-json-input')||$('gpt337-json-input');
    if(!ta)return false;
    try{
      const parsed=JSON.parse(ta.value||'');
      const arr=Array.isArray(parsed)?parsed:(parsed&&Array.isArray(parsed.plan)?parsed.plan:null);
      if(Array.isArray(arr)&&arr.length===0){
        const sample=fallbackRows();
        ta.value=JSON.stringify(sample,null,2);
        toast('GPT returned an empty plan','I inserted a cautious fallback draft instead. Review before import.');
        const status=$('gpt343-status')||$('gpt340-status')||$('gpt339-status')||$('gpt336-json-status');
        if(status){
          status.textContent='GPT returned []. A cautious fallback draft was inserted; review/edit before importing.';
          status.className='bad';
        }
        return true;
      }
    }catch(_){}
    return false;
  }

  window.addEventListener('click',function(e){
    if(!e.target||!e.target.closest)return;
    if(e.target.closest('#gpt343-copy-prompt,#gpt343-copy-prompt-2,#gpt340-copy-open,#gpt339-copy-open,#gpt336-copy-strict-prompt')){
      patchPrompts();
    }
    if(e.target.closest('#gpt343-import,#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){
      checkForEmptyImport();
    }
  },true);

  __tmpPgInterval(patchPrompts, 1000, 'pg-stackbuilder');
  setTimeout(patchPrompts,500);

  window.tmpStackPlanFallbackRows=fallbackRows;
  window.tmpStackPlanNoEmptyPrompt=strongerPrompt;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Daily Stack now uses one renderer only: gpt-daily-elite-command-js-v33270.
    Older command/cockpit/intelligence/premium renderers were removed from the file.
    This script marks the host ready only after the elite shell exists, preventing
    the "premium control center → Command Central" flash.
  */
  function host(){return document.getElementById('gpt-daily-cockpit')}
  function hideStrays(){
    var pg=document.getElementById('pg-stack');
    if(!pg)return;
    ['#gpt-daily-command','#gpt-stack-ai','.gpt-cockpit-shell','.gpt267-shell','.gpt269-shell','.gpt-cockpit-card','.gpt-cockpit-hero'].forEach(function(sel){
      pg.querySelectorAll(sel).forEach(function(el){
        if(el.closest && el.closest('#gpt-daily-cockpit') && el.classList.contains('gpt270-shell'))return;
        if(el.classList && el.classList.contains('gpt270-shell'))return;
        el.style.setProperty('display','none','important');
        el.style.setProperty('visibility','hidden','important');
        el.style.setProperty('opacity','0','important');
        el.setAttribute('aria-hidden','true');
      });
    });
  }
  function markReady(){
    hideStrays();
    var h=host();
    if(!h)return;
    var elite=h.querySelector('.gpt270-shell');
    if(elite){
      h.setAttribute('data-elite-ready','1');
      elite.style.setProperty('visibility','visible','important');
      elite.style.setProperty('opacity','1','important');
    }else{
      h.removeAttribute('data-elite-ready');
    }
  }
  function requestEliteRender(){
    if(!__tmpPgVisible('pg-stack'))return;
    try{
      if(window.gptRenderDailyEliteCommand) window.gptRenderDailyEliteCommand();
      else if(window.gptRenderDailyCockpit) window.gptRenderDailyCockpit();
      else if(window.renderStack) window.renderStack();
    }catch(_){}
    window.__tmpPgDebounced('daily-elite-ready',markReady,120);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',requestEliteRender);
  }else{
    requestEliteRender();
  }
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="stack"]')){
      var h=host(); if(h)h.removeAttribute('data-elite-ready');
      setTimeout(requestEliteRender,20);
    }
  },true);
  var _markReadyObsTimer=null;
  function scheduleMarkReadyFromObs(){
    if(!__tmpPgVisible('pg-stack'))return;
    if(_markReadyObsTimer)return;
    _markReadyObsTimer=setTimeout(function(){
      _markReadyObsTimer=null;
      markReady();
    },200);
  }
  var mo=new MutationObserver(scheduleMarkReadyFromObs);
  function startObs(){
    var h=host();
    if(h)try{mo.observe(h,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']})}catch(_){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObs); else startObs();

  window.tmpDailyStackSingleRendererReady=markReady;
})();


// ===== extracted post-core patch script =====
(function(){
  const PLAN_KEY='tmp.stackPlan.v1';
  const DAY={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES=new Set(['breakfast','lunch','dinner','bedtime']);

  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function invNames(){try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>i.name)}catch(_){return []}}
  function prefer(exacts, regexes){
    const names=invNames();
    for(const x of exacts||[]){const hit=names.find(n=>String(n).toLowerCase()===String(x).toLowerCase());if(hit)return hit}
    for(const rx of regexes||[]){const hit=names.find(n=>rx.test(String(n)));if(hit)return hit}
    return '';
  }
  function canonical(raw){
    const s=String(raw||'').trim(), l=s.toLowerCase().replace(/\s+/g,'');
    if(!s)return s;
    if(/tesamorelin|^tesa|^ts10$|^ts20$|^ts$/i.test(s)||/tesamorelin/.test(l))return prefer(['TS10','TS20'],[/^TS\d+/i,/Tesamorelin/i,/^Tesa/i])||s;
    if(/^(retatrutide|reta|rt30|rt20|rt10|rt)$/.test(l)||/retatrutide/.test(l))return prefer(['RT30','RT20','RT10'],[/^RT\d+/i,/^Reta/i,/Retatrutide/i])||s;
    if(/^(tc250|testc|testosteronecypionate|testosterone|cypionate)$/.test(l)||/testosterone/.test(l))return prefer(['TC250'],[/^TC\d+/i,/Testosterone Cypionate/i,/Test C/i])||s;
    if(/^(klo80|klow80|klow|klotho|klotho80)$/.test(l)||/klotho|klow/.test(l))return prefer(['Klow80','KLO80','Klow','KLO'],[/^Klow\d*/i,/^KLO\d*/i,/Klotho/i])||s;
    if(/^(wv|wolverine|bpc157\+tb500|bpc-157\+tb-500|bpc157tb500)$/.test(l))return prefer(['WV'],[/^WV$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i])||'WV';
    if(/^(cp20|cp10|cjcipa|cjcipamorelin|cjc-1295ipamorelin|cjc\+ipamorelin)$/.test(l))return prefer(['CP20','CP10'],[/^CP\d+/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i])||'CP20';
    return s;
  }
  function parseDays(days){
    if(!Array.isArray(days))return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number')return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function dayNames(days){return (days||[]).map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).filter(Boolean)}
  function sameDays(a,b){a=parseDays(a);b=parseDays(b);return a.length===b.length&&a.every((x,i)=>x===b[i])}
  function hasBlend(kind){
    if(kind==='wv')return !!prefer(['WV'],[/^WV$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i]);
    if(kind==='cp')return !!prefer(['CP20','CP10'],[/^CP\d+/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i]);
    return false;
  }
  function normalizePlan(raw){
    const arr=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.plan)?raw.plan:[]);
    if(!arr.length)throw new Error('GPT returned no plan rows.');
    let rows=arr.map((r,i)=>{
      const name=canonical(r.name);
      const lane=String(r.lane||'').toLowerCase().trim();
      const days=parseDays(r.days);
      if(!name)throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane))throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length)throw new Error('Row '+(i+1)+' has no valid days.');
      return {id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name,lane,days,dose:r.dose===''||r.dose==null?'':Number(r.dose),unit:String(r.unit||'mcg').trim(),purpose:String(r.purpose||'').trim()};
    });
    if(hasBlend('wv')){
      const wv=canonical('WV'), out=[], used=new Set();
      rows.forEach((r,i)=>{
        if(used.has(i))return;
        const isB=/^BPC-?157$/i.test(r.name), isT=/^TB-?500$/i.test(r.name);
        if(isB||isT){
          const j=rows.findIndex((x,k)=>k!==i&&!used.has(k)&&sameDays(x.days,r.days)&&x.lane===r.lane&&((isB&&/^TB-?500$/i.test(x.name))||(isT&&/^BPC-?157$/i.test(x.name))));
          if(j>=0){out.push({...r,name:wv,purpose:(r.purpose||rows[j].purpose||'Recovery blend')+' · merged blend'});used.add(i);used.add(j);return;}
        }
        out.push(r);used.add(i);
      });
      rows=out;
    }
    if(hasBlend('cp')){
      const cp=canonical('CP20'), out=[], used=new Set();
      rows.forEach((r,i)=>{
        if(used.has(i))return;
        const isC=/CJC/i.test(r.name), isI=/Ipamorelin/i.test(r.name);
        if(isC||isI){
          const j=rows.findIndex((x,k)=>k!==i&&!used.has(k)&&sameDays(x.days,r.days)&&x.lane===r.lane&&((isC&&/Ipamorelin/i.test(x.name))||(isI&&/CJC/i.test(x.name))));
          if(j>=0){out.push({...r,name:cp,purpose:(r.purpose||rows[j].purpose||'GH pulse blend')+' · merged blend'});used.add(i);used.add(j);return;}
        }
        out.push(r);used.add(i);
      });
      rows=out;
    }
    const map=new Map();
    rows.forEach(r=>{const k=r.name.toLowerCase()+'|'+r.lane+'|'+r.days.join(',');if(!map.has(k))map.set(k,r)});
    return [...map.values()];
  }
  function planForTextArea(plan){
    return JSON.stringify(plan.map(p=>({name:p.name,lane:p.lane,days:dayNames(p.days),dose:p.dose,unit:p.unit,purpose:p.purpose})),null,2);
  }
  function textBox(){return $('gpt343-json')||$('gpt340-json')||$('gpt339-json')||$('gpt336-json-input')||$('gpt337-json-input')}
  function setStatus(msg,kind){
    const st=$('gpt346-api-status')||$('gpt343-status')||$('gpt340-status')||$('gpt339-status');
    if(st){st.textContent=msg;st.className=kind||'';}
  }
  function normalizeVisibleBox(){
    const ta=textBox();
    if(!ta||!ta.value.trim())return false;
    try{
      const plan=normalizePlan(JSON.parse(ta.value));
      ta.value=planForTextArea(plan);
      setStatus('Normalized to inventory codes: '+plan.map(p=>p.name).join(', '),'ok');
      return plan;
    }catch(e){return false}
  }
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      S.stackPlan=plan;S.inv=S.inv||[];S.sched=S.sched||{};if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it){it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:p.dose||0,doseUnit:p.unit,cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};S.inv.push(it);}
        if(p.dose!==''&&!isNaN(p.dose))it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';it.stackLane=p.lane;it.days=p.days.slice();it.importPurpose=p.purpose||'';
        const t=(p.lane==='breakfast'||p.lane==='lunch')?'am':'pm';
        p.days.forEach(di=>{S.sched[p.name+'/'+t+'/'+di]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function importVisibleBox(){
    const plan=normalizeVisibleBox();
    if(!plan)return false;
    savePlan(plan);
    try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
    setStatus('Imported '+plan.length+' item(s), using inventory codes: '+plan.map(p=>p.name).join(', '),'ok');
    toast('✓ Imported with inventory codes',plan.map(p=>p.name).join(', '));
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},300);
    return true;
  }
  window.addEventListener('click',function(e){
    if(!e.target||!e.target.closest)return;
    if(e.target.closest('#gpt343-check,#gpt340-validate,#gpt339-validate,#gpt346-generate,#gpt346-generate-import')){
      setTimeout(normalizeVisibleBox,450);
      setTimeout(normalizeVisibleBox,1200);
    }
    if(e.target.closest('#gpt343-import,#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      importVisibleBox();
    }
  },true);
  document.addEventListener('input',function(e){
    if(e.target&&e.target.id&&/^gpt(343|340|339|336|337)-/.test(e.target.id))setTimeout(normalizeVisibleBox,300)
  },true);
  window.tmpNormalizeStackPlanVisible349=normalizeVisibleBox;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    Fix: GPT generated too few items because it acted like "conservative core stack".
    New behavior:
      - Full inventory consideration, not forced full deployment.
      - Selected lanes should not be left empty when inventory can plausibly fill them.
      - GPT may omit items, but it must consider all inventory and choose best fits.
      - Adds a post-generation empty-lane warning.
  */
  const MODE_KEY='tmp.stackBuilder.inventoryConsideration.v1';
  const LANE_KEYWORDS={
    fat:/rt\d+|reta|retatrutide|tirz|sema|aod|cagri/i,
    recovery:/wv|wolverine|bpc|tb[- ]?500|ghk|klow|klo|klotho/i,
    sleep:/ts\d+|tesa|tesamorelin|cp\d+|cjc|ipa|ipamorelin|dsip|mk[- ]?677/i,
    muscle:/tc\d+|testosterone|cyp|creatine|protein/i,
    metabolic:/klow|klo|klotho|omega|vitamin|nad|slupp|slu|metabolic/i,
    simplicity:/vitamin|klow|rt\d+|tc\d+/i
  };
  const LANE_TO_CAL={
    fat:'breakfast',
    recovery:'dinner',
    sleep:'bedtime',
    muscle:'lunch',
    metabolic:'lunch',
    simplicity:'lunch'
  };
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  function invNames(){
    try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>i.name)}catch(_){return []}
  }
  function state(){
    let st={};
    try{st=Object.assign(st,JSON.parse(localStorage.getItem('tmp.stackBuilder.v1')||'{}'))}catch(_){}
    try{st=Object.assign(st,JSON.parse(localStorage.getItem('tmp.stackBuilder.pro.v1')||'{}'))}catch(_){}
    const visible=[];
    document.querySelectorAll('.gpt343-lane.on').forEach(el=>{
      const v=el.getAttribute('data-lane');
      if(v) visible.push(v);
    });
    if(visible.length) st.lanes=visible;
    return st;
  }
  function mode(){return localStorage.getItem(MODE_KEY)||'coverage'}
  function modeLabel(){
    const m=mode();
    if(m==='conservative')return 'Conservative core stack';
    if(m==='deployment')return 'Full inventory deployment';
    return 'Full inventory consideration';
  }
  function relevantByLane(){
    const inv=invNames();
    const out={};
    Object.keys(LANE_KEYWORDS).forEach(lane=>{
      out[lane]=inv.filter(n=>LANE_KEYWORDS[lane].test(n));
    });
    return out;
  }
  function selectedLanes(){
    const st=state();
    return Array.isArray(st.lanes)?st.lanes:[];
  }
  function enhancePromptText(base){
    const m=mode();
    const inv=invNames();
    const lanes=selectedLanes();
    const rel=relevantByLane();
    let rules=[
      '',
      'FULL INVENTORY CONSIDERATION RULE:',
      '- Do NOT blindly deploy every inventory item unless explicitly asked.',
      '- But DO consider every inventory item before deciding the plan.',
      '- Do not return only a tiny core stack if selected lanes can be reasonably filled by inventory.',
      '- For each selected goal lane, include at least one best-fit inventory item when a plausible inventory match exists.',
      '- If a selected lane has plausible inventory but you choose not to include it, that is usually wrong for PeptideGenius; include it as optional/review-needed instead.',
      '- Use exact inventory codes/names, not generic names.',
      '- Prefer WV instead of separate BPC-157/TB-500 when WV exists.',
      '- Prefer CP20 instead of separate CJC-1295/Ipamorelin when CP20 is intended as the blend; individual Ipamorelin may remain separate only if intentionally needed.',
      '',
      'Selected goal lanes: '+(lanes.join(', ')||'none selected'),
      'Build mode: '+modeLabel(),
      'Inventory names: '+(inv.join(', ')||'none detected'),
      'Relevant inventory by lane: '+JSON.stringify(rel)
    ];
    if(m==='conservative'){
      rules.push('- Conservative mode: choose only the highest-value few items, but still explain selected lanes through purpose wording.');
    }else if(m==='deployment'){
      rules.push('- Deployment mode: include every eligible inventory item unless clearly redundant or unsafe; if uncertain, include as optional/review-needed.');
    }else{
      rules.push('- Consideration mode: build a balanced plan that covers selected lanes using best-fit inventory, without forcing every item into the calendar.');
    }
    return String(base||'')+'\n'+rules.join('\n')+'\n';
  }
  function patchPrompt(){
    const p=$('gpt343-prompt')||$('gpt340-prompt')||$('gpt339-prompt');
    if(p){
      let base=p.value||'';
      base=base.replace(/\nFULL INVENTORY CONSIDERATION RULE:[\s\S]*$/,'');
      p.value=enhancePromptText(base);
    }
  }
  function injectControl(){
    const card=$('gpt346-api-card') || document.querySelector('.gpt343-panel') || document.querySelector('#gpt343-stackbuilder-pro .gpt343-hero');
    if(!card || $('gpt350-consideration-card'))return;
    const box=document.createElement('div');
    box.id='gpt350-consideration-card';
    box.innerHTML='<label for="gpt350-consideration-mode">GPT build behavior</label><select id="gpt350-consideration-mode"><option value="coverage">Full inventory consideration</option><option value="conservative">Conservative core stack</option><option value="deployment">Full inventory deployment</option></select><div class="help"><b>Recommended:</b> Full inventory consideration. GPT considers everything you own, but only schedules the best fits while covering selected lanes.</div><div id="gpt350-lane-warning"></div>';
    card.appendChild(box);
    const sel=$('gpt350-consideration-mode');
    sel.value=mode();
    sel.onchange=function(){localStorage.setItem(MODE_KEY,sel.value);patchPrompt();};
    patchPrompt();
  }
  function planRowsFromBox(){
    const ta=$('gpt343-json')||$('gpt340-json')||$('gpt339-json')||$('gpt336-json-input');
    if(!ta||!ta.value.trim())return [];
    try{
      const raw=JSON.parse(ta.value);
      return Array.isArray(raw)?raw:(raw&&Array.isArray(raw.plan)?raw.plan:[]);
    }catch(_){return []}
  }
  function laneCovered(plan, selectedLane){
    const target=LANE_TO_CAL[selectedLane];
    if(!target)return true;
    return plan.some(p=>String(p.lane||'').toLowerCase()===target);
  }
  function showCoverageWarning(){
    const warn=$('gpt350-lane-warning');
    if(!warn)return;
    const lanes=selectedLanes();
    const plan=planRowsFromBox();
    const rel=relevantByLane();
    const missing=lanes.filter(l=>rel[l]&&rel[l].length&&!laneCovered(plan,l));
    if(!missing.length){
      warn.style.display='none';
      return;
    }
    warn.style.display='block';
    warn.innerHTML='<b>Coverage warning:</b> GPT left selected lane(s) empty despite plausible inventory: '+missing.join(', ')+'. Try Generate + import again with <b>Full inventory consideration</b>, or switch to <b>Full inventory deployment</b>.';
  }
  // Override the API payload prompt by patching the prompt box just before API click.
  window.addEventListener('click',function(e){
    if(!e.target||!e.target.closest)return;
    if(e.target.closest('#gpt346-generate,#gpt346-generate-import,#gpt343-copy-prompt,#gpt343-copy-prompt-2')){
      injectControl();
      patchPrompt();
    }
    if(e.target.closest('#gpt346-generate,#gpt346-generate-import')){
      setTimeout(showCoverageWarning,1400);
      setTimeout(showCoverageWarning,2800);
    }
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(injectControl,800);setTimeout(patchPrompt,1000)});
  else {setTimeout(injectControl,800);setTimeout(patchPrompt,1000);}
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]')){setTimeout(injectControl,300);setTimeout(patchPrompt,500)}},true);
  __tmpPgInterval(function(){injectControl();patchPrompt();}, 2500, 'pg-stackbuilder');

  window.tmpStackBuilderConsiderationPrompt=enhancePromptText;
})();


// ===== extracted post-core patch script =====
(function(){
  const PLAN_KEY='tmp.stackPlan.v1';
  const DAY={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES=new Set(['breakfast','lunch','dinner','bedtime']);
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function invNames(){try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>i.name)}catch(_){return []}}
  function findInv(exacts, regexes){
    const names=invNames();
    for(const x of exacts||[]){const hit=names.find(n=>String(n).toLowerCase()===String(x).toLowerCase());if(hit)return hit}
    for(const rx of regexes||[]){const hit=names.find(n=>rx.test(String(n)));if(hit)return hit}
    return '';
  }
  function wvName(){return findInv(['WV','W-V'],[/^WV$/i,/^W-V$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i])||''}
  function cpName(){return findInv(['CP20','CP10'],[/^CP20$/i,/^CP10$/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i,/CJC.*1295.*Ipa/i])||''}
  function canonical(raw){
    const s=String(raw||'').trim(), l=s.toLowerCase().replace(/\s+/g,'');
    if(!s)return s;
    if(/tesamorelin|^tesa|^ts10$|^ts20$|^ts$/i.test(s)||/tesamorelin/.test(l))return findInv(['TS10','TS20'],[/^TS\d+/i,/Tesamorelin/i,/^Tesa/i])||s;
    if(/^(retatrutide|reta|rt30|rt20|rt10|rt)$/.test(l)||/retatrutide/.test(l))return findInv(['RT30','RT20','RT10'],[/^RT\d+/i,/^Reta/i,/Retatrutide/i])||s;
    if(/^(tc250|testc|testosteronecypionate|testosterone|cypionate)$/.test(l)||/testosterone/.test(l))return findInv(['TC250'],[/^TC\d+/i,/Testosterone Cypionate/i,/Test C/i])||s;
    if(/^(klo80|klow80|klow|klotho|klotho80)$/.test(l)||/klotho|klow/.test(l))return findInv(['Klow80','KLO80','Klow','KLO'],[/^Klow\d*/i,/^KLO\d*/i,/Klotho/i])||s;
    if(/^(wv|w-v|wolverine|bpc157\+tb500|bpc-157\+tb-500|bpc157tb500)$/.test(l))return wvName()||'WV';
    if(/^(cp20|cp10|cjcipa|cjcipamorelin|cjc-1295ipamorelin|cjc\+ipamorelin)$/.test(l))return cpName()||'CP20';
    return s;
  }
  function isBpc(name){return /(^|\b)BPC[- ]?157($|\b)/i.test(name) || /^BPC$/i.test(name)}
  function isTb(name){return /(^|\b)TB[- ]?500($|\b)/i.test(name) || /^TB$/i.test(name)}
  function isCjc(name){return /CJC/i.test(name)}
  function isIpa(name){return /Ipamorelin/i.test(name) || /^IPA/i.test(name)}
  function parseDays(days){
    if(!Array.isArray(days))return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number')return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function normalizeBasic(raw){
    const arr=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.plan)?raw.plan:[]);
    if(!arr.length)throw new Error('GPT returned no plan rows.');
    return arr.map((r,i)=>{
      const name=canonical(r.name);
      const lane=String(r.lane||'').toLowerCase().trim();
      const days=parseDays(r.days);
      if(!name)throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane))throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length)throw new Error('Row '+(i+1)+' has no valid days.');
      return {id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name,lane,days,dose:r.dose===''||r.dose==null?'':Number(r.dose),unit:String(r.unit||'mcg').trim(),purpose:String(r.purpose||'').trim()};
    });
  }
  function mostCommonLane(rows,fallback){
    const counts={}; rows.forEach(r=>{counts[r.lane]=(counts[r.lane]||0)+1});
    return Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]||fallback;
  }
  function unionDays(rows){return [...new Set(rows.flatMap(r=>r.days||[]))].sort((a,b)=>a-b)}
  function firstDose(rows){const r=rows.find(x=>x.dose!==''&&x.dose!=null&&!isNaN(x.dose));return r?r.dose:''}
  function firstUnit(rows){const r=rows.find(x=>x.unit);return r?r.unit:'mcg'}
  function mergeBlends(rows){
    let out=rows.slice();
    const wv=wvName();
    if(wv){
      const comps=out.filter(r=>isBpc(r.name)||isTb(r.name)||String(r.name).toLowerCase()===wv.toLowerCase());
      if(comps.length){
        out=out.filter(r=>!(isBpc(r.name)||isTb(r.name)||String(r.name).toLowerCase()===wv.toLowerCase()));
        const existing=comps.find(r=>String(r.name).toLowerCase()===wv.toLowerCase());
        out.push({id:wv.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name:wv,lane:(existing&&existing.lane)||mostCommonLane(comps,'dinner'),days:unionDays(comps),dose:(existing&&existing.dose!==''?existing.dose:firstDose(comps)),unit:(existing&&existing.unit)||firstUnit(comps),purpose:'Recovery / injury blend lane; merged WV from BPC-157/TB-500 component suggestions.'});
      }
    }
    const cp=cpName();
    if(cp){
      const comps=out.filter(r=>isCjc(r.name)||isIpa(r.name)||String(r.name).toLowerCase()===cp.toLowerCase());
      if(comps.length){
        out=out.filter(r=>!(isCjc(r.name)||isIpa(r.name)||String(r.name).toLowerCase()===cp.toLowerCase()));
        const existing=comps.find(r=>String(r.name).toLowerCase()===cp.toLowerCase());
        out.push({id:cp.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name:cp,lane:(existing&&existing.lane)||mostCommonLane(comps,'bedtime'),days:unionDays(comps),dose:(existing&&existing.dose!==''?existing.dose:firstDose(comps)),unit:(existing&&existing.unit)||firstUnit(comps),purpose:'GH pulse blend lane; merged CP20 from CJC-1295/Ipamorelin component suggestions.'});
      }
    }
    const map=new Map();
    out.forEach(r=>{if(!r.days||!r.days.length)return;const k=r.name.toLowerCase()+'|'+r.lane+'|'+r.days.join(',');if(!map.has(k))map.set(k,r)});
    return [...map.values()];
  }
  function normalizePlan(raw){return mergeBlends(normalizeBasic(raw))}
  function dayNames(days){return (days||[]).map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).filter(Boolean)}
  function textBox(){return $('gpt343-json')||$('gpt340-json')||$('gpt339-json')||$('gpt336-json-input')||$('gpt337-json-input')}
  function planForTextArea(plan){return JSON.stringify(plan.map(p=>({name:p.name,lane:p.lane,days:dayNames(p.days),dose:p.dose,unit:p.unit,purpose:p.purpose})),null,2)}
  function setStatus(msg,kind){const st=$('gpt346-api-status')||$('gpt343-status')||$('gpt340-status')||$('gpt339-status');if(st){st.textContent=msg;st.className=kind||''}}
  function normalizeVisibleBox(){
    const ta=textBox(); if(!ta||!ta.value.trim())return false;
    try{const plan=normalizePlan(JSON.parse(ta.value));ta.value=planForTextArea(plan);setStatus('Blend-merged and normalized: '+plan.map(p=>p.name).join(', '),'ok');return plan}catch(e){return false}
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      S.stackPlan=plan;S.inv=S.inv||[];S.sched=S.sched||{};if(typeof S.nI!=='number')S.nI=Date.now();
      const namesToClear=new Set(plan.map(p=>p.name));
      if(wvName()){['BPC-157','BPC','TB-500','TB'].forEach(n=>namesToClear.add(n))}
      if(cpName()){['CJC-1295','CJC-1295 (no DAC)','CJC','Ipamorelin','IPA'].forEach(n=>namesToClear.add(n))}
      namesToClear.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it){it={id:S.nI++,name:p.name,fz:0,fr:0,dk:0,nd:0,dose:p.dose||0,doseUnit:p.unit,cn:'',us:'',cat:p.name,days:[],isPeptide:p.unit==='pill'?false:true};S.inv.push(it)}
        if(p.dose!==''&&!isNaN(p.dose))it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';it.stackLane=p.lane;it.days=p.days.slice();it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane);p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true})
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function importVisibleBox(){
    const plan=normalizeVisibleBox(); if(!plan)return false;
    savePlan(plan);
    try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
    toast('✓ Imported with blends merged',plan.map(p=>p.name).join(', '));
    setStatus('Imported with blends merged: '+plan.map(p=>p.name).join(', '),'ok');
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},300);
    return true;
  }
  function enhancePrompt(){
    const p=$('gpt343-prompt')||$('gpt340-prompt')||$('gpt339-prompt');
    if(!p)return;
    let v=p.value||'';
    v=v.replace(/\nHARD BLEND RULE:[\s\S]*$/,'');
    p.value=v+'\n\nHARD BLEND RULE:\n- If inventory contains WV or W-V, use that single item for recovery/BPC/TB. Do NOT output BPC-157 or TB-500 as separate rows.\n- If inventory contains CP20, use that single item for CJC/Ipamorelin blend. Do NOT output CJC-1295 and Ipamorelin as separate rows unless explicitly scheduling separate individual Ipamorelin in addition to CP20.\n- Exact inventory names: '+invNames().join(', ')+'\n';
  }
  window.addEventListener('click',function(e){
    if(!e.target||!e.target.closest)return;
    if(e.target.closest('#gpt346-generate,#gpt346-generate-import,#gpt343-copy-prompt,#gpt343-copy-prompt-2')){
      enhancePrompt(); setTimeout(normalizeVisibleBox,700); setTimeout(normalizeVisibleBox,1500); setTimeout(normalizeVisibleBox,3000);
    }
    if(e.target.closest('#gpt343-check,#gpt340-validate,#gpt339-validate'))setTimeout(normalizeVisibleBox,50);
    if(e.target.closest('#gpt343-import,#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation(); importVisibleBox();
    }
  },true);
  document.addEventListener('input',function(e){if(e.target&&e.target.id&&/^gpt(343|340|339|336|337)-/.test(e.target.id))setTimeout(normalizeVisibleBox,300)},true);
  __tmpPgInterval(enhancePrompt, 2000, 'pg-stackbuilder');
  window.tmpHardBlendNormalize351=normalizePlan;
  window.tmpHardBlendImport351=importVisibleBox;
})();


// ===== extracted post-core patch script =====
(function(){
  // Stable Stack Builder cleanup. No observers on Daily Stack. No cache/service-worker changes.
  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(_){return false}}

  function promptText(){
    const p=$('gpt343-prompt') || $('sb-feed');
    if(p && p.value) return p.value;
    if(typeof window.tmpStrictStackPlanPrompt==='function') return window.tmpStrictStackPlanPrompt();
    return 'Return ONLY valid JSON. Create a PeptideGenius stack plan using inventory names.';
  }

  function goPage(pg){
    const btn=document.querySelector('#nav [data-pg="'+pg+'"], button[data-pg="'+pg+'"], .hdr-tab-btn[data-pg="'+pg+'"]');
    if(btn){btn.click();return true;}
    try{
      document.querySelectorAll('.page').forEach(p=>p.style.display='none');
      const el=document.getElementById('pg-'+pg);
      if(el)el.style.display='';
      if(pg==='calendar'){try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}}
      return !!el;
    }catch(_){return false}
  }

  function relabel(){
    const title=document.querySelector('#pg-stackbuilder .gpt-sb-title');
    if(title) title.textContent='Stack Builder';
    const sub=document.querySelector('#pg-stackbuilder .gpt-sb-sub');
    if(sub) sub.textContent='Choose lanes, generate a GPT-assisted plan from inventory, then review the Weekly Calendar.';

    const apiTitle=document.querySelector('#gpt346-api-card .gpt346-title');
    if(apiTitle) apiTitle.textContent='Generate stack with GPT';
    const apiSub=document.querySelector('#gpt346-api-card .gpt346-sub');
    if(apiSub) apiSub.textContent='Main path: GPT considers selected lanes and inventory, returns a structured plan, and PeptideGenius fills the Weekly Calendar.';
    const a=$('gpt346-generate-import');
    if(a) a.textContent='Generate stack + fill calendar';
    const b=$('gpt346-generate');
    if(b) b.textContent='Preview plan only';
  }

  function injectManual(){
    const card=$('gpt346-api-card');
    if(!card || $('gpt352-manual-fallback')) return;
    const d=document.createElement('details');
    d.id='gpt352-manual-fallback';
    d.innerHTML='<summary>Advanced / manual fallback</summary><div class="body">Use only if the API button fails. This copies a prompt you can paste into ChatGPT manually.<br><button type="button" id="gpt352-copy-manual">Copy manual prompt</button><button type="button" id="gpt352-open-manual">Open ChatGPT</button></div>';
    card.appendChild(d);
    $('gpt352-copy-manual').onclick=async()=>{const ok=await copyText(promptText());toast(ok?'✓ Manual prompt copied':'Copy blocked — select prompt manually',ok?'':'amber')};
    $('gpt352-open-manual').onclick=()=>{try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){}};
  }

  function injectSuccess(){
    const card=$('gpt346-api-card');
    if(!card || $('gpt352-success-panel')) return;
    const p=document.createElement('div');
    p.id='gpt352-success-panel';
    p.innerHTML='<b>Stack plan imported</b><span>Your plan is saved. Review the Weekly Calendar to confirm lanes, days, and doses.</span><br><button type="button" class="primary" id="gpt352-review-calendar">Review Weekly Calendar</button><button type="button" id="gpt352-open-optimizer">Open Optimizer</button>';
    card.appendChild(p);
    $('gpt352-review-calendar').onclick=()=>goPage('calendar');
    $('gpt352-open-optimizer').onclick=()=>goPage('optimizer');
  }

  function detectImport(){
    const s=$('gpt346-api-status')||$('gpt343-status')||$('gpt340-status')||$('gpt339-status');
    const text=(s&&s.textContent||'').toLowerCase();
    if(/generated and imported|imported .*item|plan imported|imported with|stack plan imported/.test(text)){
      injectSuccess();
      const p=$('gpt352-success-panel');
      if(p)p.style.display='block';
      setTimeout(()=>goPage('calendar'),500);
      return true;
    }
    return false;
  }

  function init(){
    relabel();
    injectManual();
    injectSuccess();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,500));
  else setTimeout(init,500);

  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(init,220);
    if(e.target&&e.target.closest&&e.target.closest('#gpt346-generate-import,#gpt343-import,#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){
      setTimeout(detectImport,700);
      setTimeout(detectImport,1800);
    }
  },true);

  __tmpPgInterval(function(){relabel();detectImport();}, 2500, 'pg-stackbuilder');
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    One change only from v33.375-stable-vendor-post-import-review:
    Stack Builder wording polish. No layout, Daily Stack, cache, chart, or API logic changes.
  */
  function $(id){return document.getElementById(id)}
  function polish(){
    // Main Stack Builder header
    document.querySelectorAll('#pg-stackbuilder .gpt-sb-kicker, #pg-stackbuilder .gpt343-kicker').forEach(function(el){
      if(el) el.textContent='Stack Builder';
    });
    document.querySelectorAll('#pg-stackbuilder .gpt-sb-title, #pg-stackbuilder .gpt343-title').forEach(function(el){
      if(el) el.textContent='Build a weekly stack';
    });
    document.querySelectorAll('#pg-stackbuilder .gpt-sb-sub, #pg-stackbuilder .gpt343-sub').forEach(function(el){
      if(el) el.textContent='Choose your lanes, generate a GPT-assisted plan from your inventory, then review it in the Weekly Calendar.';
    });

    // Step labels
    var h1=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="1"] h3');
    if(h1) h1.textContent='1. Choose your lanes';
    var p1=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="1"] p');
    if(p1) p1.textContent='Select the lanes you want this stack to cover. GPT will consider your current inventory against these goals.';

    var h2=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="2"] h3');
    if(h2) h2.textContent='2. Generate a plan';
    var p2=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="2"] p');
    if(p2) p2.textContent='Use GPT to create a structured weekly plan using your selected lanes and inventory names.';

    var h3=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="3"] h3');
    if(h3) h3.textContent='3. Review or import';
    var p3=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="3"] p');
    if(p3) p3.textContent='Review the generated JSON if needed, then import it to the Weekly Calendar.';

    var h4=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="4"] h3');
    if(h4) h4.textContent='4. Confirm the calendar';
    var p4=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="4"] p');
    if(p4) p4.textContent='Check lanes, days, doses, and inventory names before relying on the plan.';

    // API action card
    var apiTitle=document.querySelector('#gpt346-api-card .gpt346-title');
    if(apiTitle) apiTitle.textContent='Generate with GPT';
    var apiSub=document.querySelector('#gpt346-api-card .gpt346-sub');
    if(apiSub) apiSub.textContent='Main path: GPT considers your selected lanes and inventory, returns a structured plan, and PeptideGenius fills the Weekly Calendar.';

    var genImport=$('gpt346-generate-import');
    if(genImport) genImport.textContent='Generate stack + fill calendar';
    var preview=$('gpt346-generate');
    if(preview) preview.textContent='Preview plan only';

    // Success panel wording if present
    var succ=$('gpt352-success-panel');
    if(succ){
      var b=succ.querySelector('b');
      if(b) b.textContent='Plan imported';
      var span=succ.querySelector('span');
      if(span) span.textContent='Review the Weekly Calendar to confirm lanes, days, doses, and inventory names.';
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){setTimeout(polish,400)});
  else setTimeout(polish,400);
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('[data-pg="stackbuilder"]')) setTimeout(polish,220);
  }, true);
  __tmpPgInterval(polish, 2500, 'pg-stackbuilder');
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    One change only from v33.375-stable-vendor-post-import-review:
    - Hide obsolete "Next: ask GPT" button.
    - After import success, show Review Weekly Calendar and reliably open calendar.
  */
  function $(id){return document.getElementById(id)}
  function goCalendar(){
    var clicked=false;
    try{
      var btn=document.querySelector('#nav [data-pg="calendar"], button[data-pg="calendar"], .hdr-tab-btn[data-pg="calendar"]');
      if(btn){btn.click(); clicked=true;}
    }catch(_){}
    setTimeout(function(){
      try{window.renderCal&&window.renderCal()}catch(_){}
      try{window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}
      var cal=$('pg-calendar');
      if(cal && getComputedStyle(cal).display==='none'){
        document.querySelectorAll('.page').forEach(function(p){p.style.display='none'});
        cal.style.display='';
      }
      try{window.scrollTo({top:0,behavior:'smooth'})}catch(_){}
    },120);
    return clicked;
  }
  function goOptimizer(){
    try{
      var btn=document.querySelector('#nav [data-pg="optimizer"], button[data-pg="optimizer"], .hdr-tab-btn[data-pg="optimizer"]');
      if(btn){btn.click();return;}
    }catch(_){}
  }
  function hideOldNext(){
    document.querySelectorAll('#pg-stackbuilder [data-next="2"],#pg-stackbuilder [data-next="3"],#pg-stackbuilder [data-next="4"]').forEach(function(b){
      b.style.display='none';
      b.setAttribute('aria-hidden','true');
    });
  }
  function ensurePanel(){
    var card=$('gpt346-api-card') || document.querySelector('#pg-stackbuilder .gpt-sb-side') || document.querySelector('#pg-stackbuilder .gpt-sb-main');
    if(!card || $('gpt354-stable-review-panel')) return;
    var p=document.createElement('div');
    p.id='gpt354-stable-review-panel';
    p.innerHTML='<b>Plan imported</b><span>Review the Weekly Calendar to confirm lanes, days, doses, and inventory names.</span><br><button type="button" class="primary" id="gpt354-stable-open-calendar">Review Weekly Calendar</button><button type="button" id="gpt354-stable-open-optimizer">Open Optimizer</button>';
    card.appendChild(p);
    $('gpt354-stable-open-calendar').onclick=goCalendar;
    $('gpt354-stable-open-optimizer').onclick=goOptimizer;
  }
  function statusText(){
    var s=$('gpt346-api-status') || $('gpt343-status') || $('gpt340-status') || $('gpt339-status');
    return (s && s.textContent || '').toLowerCase();
  }
  function detectImport(){
    var t=statusText();
    if(/generated and imported|imported .*item|plan imported|gpt plan imported|imported with/.test(t)){
      ensurePanel();
      var p=$('gpt354-stable-review-panel');
      if(p) p.style.display='block';
      setTimeout(goCalendar,300);
      setTimeout(goCalendar,1100);
      return true;
    }
    return false;
  }
  function init(){
    hideOldNext();
    ensurePanel();
    detectImport();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(init,450)});
  else setTimeout(init,450);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]')) setTimeout(init,200);
    if(e.target&&e.target.closest&&e.target.closest('#gpt346-generate-import,#gpt343-import,#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){
      setTimeout(detectImport,600);
      setTimeout(detectImport,1600);
      setTimeout(detectImport,3200);
    }
  },true);
  __tmpPgInterval(function(){hideOldNext();detectImport();}, 2500, 'pg-stackbuilder');
  window.tmpStableOpenCalendar354=goCalendar;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    One focused fix:
    Stack Builder/API "Work from inventory" now means stocked/open inventory,
    not every peptide/catalog record. Items with zero vials are excluded.
  */
  const PLAN_KEY='tmp.stackPlan.v1';
  const DAY={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES=new Set(['breakfast','lunch','dinner','bedtime']);

  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){}}

  function stockCount(it){
    if(!it) return 0;
    const fields=['fz','fr','dk','nd','qty','quantity','vials','stock','onHand','open','opened','remaining','count'];
    let n=0;
    fields.forEach(k=>{
      const v=Number(it[k]);
      if(isFinite(v) && v>0) n+=v;
    });
    // Some builds use nested location counts.
    ['locations','storage','counts'].forEach(k=>{
      const obj=it[k];
      if(obj && typeof obj==='object'){
        Object.values(obj).forEach(v=>{
          const x=Number(v);
          if(isFinite(x)&&x>0)n+=x;
        });
      }
    });
    return n;
  }
  function allPeptides(){
    try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived)}catch(_){return []}
  }
  function stockedItems(){
    return allPeptides().filter(it=>stockCount(it)>0);
  }
  function stockedNames(){return stockedItems().map(i=>i.name)}
  function allNames(){return allPeptides().map(i=>i.name)}

  function findExact(name, stockedOnly=true){
    const n=String(name||'').toLowerCase();
    const arr=stockedOnly?stockedNames():allNames();
    return arr.find(x=>String(x).toLowerCase()===n)||'';
  }
  function findInv(exacts, regexes, stockedOnly=true){
    for(const x of exacts||[]){
      const hit=findExact(x, stockedOnly);
      if(hit)return hit;
    }
    const arr=stockedOnly?stockedNames():allNames();
    for(const rx of regexes||[]){
      const hit=arr.find(n=>rx.test(String(n)));
      if(hit)return hit;
    }
    return '';
  }
  function modeAllowsUnstocked(){
    let m='inventory';
    try{
      const st=JSON.parse(localStorage.getItem('tmp.stackBuilder.pro.v1')||'{}');
      if(st&&st.source)m=st.source;
    }catch(_){}
    try{
      const m2=localStorage.getItem('tmp.stackBuilder.inventoryConsideration.v1');
      if(m2)m=m2;
    }catch(_){}
    return m==='virtual' || m==='hybrid';
  }
  function canonical(raw){
    const s=String(raw||'').trim(), l=s.toLowerCase().replace(/\s+/g,'');
    if(!s)return s;

    const exact=findExact(s,true);
    if(exact)return exact;

    if(/tesamorelin|^tesa|^ts10$|^ts20$|^ts$/i.test(s)||/tesamorelin/.test(l))return findInv(['TS10','TS20'],[/^TS\d+/i,/Tesamorelin/i,/^Tesa/i],true)||s;
    if(/^(retatrutide|reta|rt30|rt20|rt10|rt)$/.test(l)||/retatrutide/.test(l))return findInv(['RT30','RT20','RT10'],[/^RT\d+/i,/^Reta/i,/Retatrutide/i],true)||s;
    if(/^(tc250|testc|testosteronecypionate|testosterone|cypionate)$/.test(l)||/testosterone/.test(l))return findInv(['TC250'],[/^TC\d+/i,/Testosterone Cypionate/i,/Test C/i],true)||s;
    if(/^(klo80|klow80|klow|klotho|klotho80)$/.test(l)||/klotho|klow/.test(l))return findInv(['Klow80','KLO80','Klow','KLO'],[/^Klow\d*/i,/^KLO\d*/i,/Klotho/i],true)||s;
    if(/^(wv|w-v|wolverine|bpc157\+tb500|bpc-157\+tb-500|bpc157tb500)$/.test(l))return findInv(['WV','W-V'],[/^WV$/i,/^W-V$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i],true)||s;
    if(/^(cp20|cp10|cjcipa|cjcipamorelin|cjc-1295ipamorelin|cjc\+ipamorelin)$/.test(l))return findInv(['CP20','CP10'],[/^CP\d+/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i],true)||s;
    if(/slu|slupp|slu-pp|slu-pp-332/i.test(s))return findInv(['Slu pp 332','SLU-PP-332','SLUPP','Slupp'],[/^Slu/i,/SLU/i],true)||s;

    return s;
  }
  function inStockedInventory(name){
    return !!findExact(name,true);
  }
  function parseDays(days){
    if(!Array.isArray(days))return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number')return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function normalizePlan(raw){
    const arr=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.plan)?raw.plan:[]);
    if(!arr.length)throw new Error('GPT returned no plan rows.');
    const dropped=[];
    const rows=[];
    arr.forEach((r,i)=>{
      const original=String(r.name||'').trim();
      const name=canonical(original);
      const lane=String(r.lane||'').toLowerCase().trim();
      const days=parseDays(r.days);
      if(!name)throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane))throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length)throw new Error('Row '+(i+1)+' has no valid days.');

      if(!modeAllowsUnstocked() && !inStockedInventory(name)){
        dropped.push(original||name);
        return;
      }
      rows.push({
        id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        name,lane,days,
        dose:r.dose===''||r.dose==null?'':Number(r.dose),
        unit:String(r.unit||'mcg').trim(),
        purpose:String(r.purpose||'').trim()
      });
    });
    rows._dropped=dropped;
    if(!rows.length){
      throw new Error('All generated rows were unstocked or outside inventory: '+dropped.join(', '));
    }
    const map=new Map();
    rows.forEach(r=>{
      const k=r.name.toLowerCase()+'|'+r.lane+'|'+r.days.join(',');
      if(!map.has(k))map.set(k,r);
    });
    const final=[...map.values()];
    final._dropped=dropped;
    return final;
  }
  function dayNames(days){return (days||[]).map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).filter(Boolean)}
  function textBox(){return $('gpt343-json')||$('gpt340-json')||$('gpt339-json')||$('gpt336-json-input')||$('gpt337-json-input')}
  function setStatus(msg,kind){
    const s=$('gpt346-api-status')||$('gpt343-status')||$('gpt340-status')||$('gpt339-status');
    if(s){s.textContent=msg;s.className=kind||''}
  }
  function showDropped(dropped){
    let box=$('gpt355-stock-lock-note');
    const host=$('gpt346-api-card')||document.querySelector('#pg-stackbuilder .gpt-sb-side')||document.querySelector('#pg-stackbuilder .gpt-sb-main');
    if(!box&&host){
      box=document.createElement('div'); box.id='gpt355-stock-lock-note'; host.appendChild(box);
    }
    if(!box)return;
    if(dropped&&dropped.length){
      box.style.display='block';
      box.innerHTML='<b>Stocked inventory lock:</b> Removed item(s) with no vials/on-hand stock: '+dropped.join(', ')+'. Add vials or use Hybrid/Virtual if you want wishlist planning.';
    }else box.style.display='none';
  }
  function planForTextArea(plan){
    return JSON.stringify(plan.map(p=>({name:p.name,lane:p.lane,days:dayNames(p.days),dose:p.dose,unit:p.unit,purpose:p.purpose})),null,2);
  }
  function normalizeVisibleBox(){
    const ta=textBox(); if(!ta||!ta.value.trim())return false;
    try{
      const plan=normalizePlan(JSON.parse(ta.value));
      ta.value=planForTextArea(plan);
      showDropped(plan._dropped||[]);
      setStatus('Stocked inventory plan: '+plan.map(p=>p.name).join(', '),'ok');
      return plan;
    }catch(e){
      setStatus('Stocked inventory lock blocked import: '+e.message,'bad');
      return false;
    }
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      S.stackPlan=plan; S.inv=S.inv||[]; S.sched=S.sched||{}; if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it){return;} // stocked inventory mode should not create new peptide records
        if(p.dose!==''&&!isNaN(p.dose))it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';
        it.stackLane=p.lane; it.days=p.days.slice(); it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane); p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function importVisibleBox(){
    const plan=normalizeVisibleBox(); if(!plan)return false;
    savePlan(plan);
    try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
    toast('✓ Imported stocked inventory plan',plan.map(p=>p.name).join(', '));
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},300);
    return true;
  }
  function enhancePrompt(){
    const p=$('gpt343-prompt')||$('gpt340-prompt')||$('gpt339-prompt')||$('sb-feed');
    if(!p)return;
    let v=p.value||'';
    v=v.replace(/\nSTOCKED INVENTORY RULE:[\s\S]*$/,'');
    p.value=v+'\n\nSTOCKED INVENTORY RULE:\n- Work from stocked/open inventory only, not every peptide record in the inventory database.\n- Do not include a peptide if it has zero vials/on-hand stock.\n- Exact stocked inventory names: '+stockedNames().join(', ')+'\n- Peptide records with no vials are not eligible for inventory-mode scheduling.\n- If Slupp/SLU-PP has no vials, do not include it.\n';
  }
  window.addEventListener('click',function(e){
    if(!e.target||!e.target.closest)return;
    if(e.target.closest('#gpt346-generate,#gpt346-generate-import,#gpt343-copy-prompt,#gpt343-copy-prompt-2')){enhancePrompt();setTimeout(normalizeVisibleBox,900);setTimeout(normalizeVisibleBox,1800)}
    if(e.target.closest('#gpt343-import,#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();importVisibleBox()}
  },true);
  __tmpPgInterval(enhancePrompt, 2500, 'pg-stackbuilder');
  window.tmpStockedInventoryNormalize355=normalizePlan;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    One focused fix:
    - Normalize GPT/API output visibly and before import.
    - Retatrutide/Reta/RT aliases -> stocked RT30/RT20/RT10, prioritizing RT30.
    - Cyp/Testosterone aliases -> stocked TC250/TC.
    - Slupp/SLU-PP excluded unless stocked/open vials exist.
    - Cleanup any previously scheduled unstocked Slupp/nonstock rows from S.stackPlan/S.sched.
  */
  const PLAN_KEY='tmp.stackPlan.v1';
  const DAY={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES=new Set(['breakfast','lunch','dinner','bedtime']);

  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function items(){try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived)}catch(_){return []}}

  function num(v){const n=Number(v);return isFinite(n)?n:0}
  function stockCount(it){
    if(!it) return 0;
    let n=0;
    ['fz','fr','dk','nd','qty','quantity','vials','stock','onHand','open','opened','remaining','count'].forEach(k=>{n+=Math.max(0,num(it[k]))});
    ['locations','storage','counts'].forEach(k=>{
      const obj=it[k];
      if(obj&&typeof obj==='object')Object.values(obj).forEach(v=>{n+=Math.max(0,num(v))});
    });
    return n;
  }
  function stockedItems(){return items().filter(it=>stockCount(it)>0)}
  function stockedNames(){return stockedItems().map(i=>i.name)}
  function allNames(){return items().map(i=>i.name)}
  function findExact(name, stockedOnly=true){
    const n=String(name||'').toLowerCase();
    const arr=stockedOnly?stockedNames():allNames();
    return arr.find(x=>String(x).toLowerCase()===n)||'';
  }
  function findBy(exacts, regexes, stockedOnly=true){
    for(const x of exacts||[]){const h=findExact(x,stockedOnly);if(h)return h}
    const arr=stockedOnly?stockedNames():allNames();
    for(const rx of regexes||[]){const h=arr.find(n=>rx.test(String(n)));if(h)return h}
    return '';
  }
  function isSlupp(s){return /slu\s*pp|slupp|slu-pp|slu-pp-332|slupp332/i.test(String(s||''))}
  function canonical(raw){
    const s=String(raw||'').trim();
    const l=s.toLowerCase().replace(/\s+/g,'');
    if(!s) return s;

    const exact=findExact(s,true);
    if(exact) return exact;

    // HARD priorities based on your inventory codes.
    if(/^(retatrutide|reta|rt|rt10|rt20|rt30|rt230)$/.test(l)||/retatrutide|reta/i.test(s)){
      return findBy(['RT30','RT20','RT10'],[/^RT30$/i,/^RT20$/i,/^RT10$/i,/^RT\d+/i,/Retatrutide/i,/^Reta/i],true)||s;
    }
    if(/^(cyp|tc250|tc|testc|testosteronecypionate|testosterone|cypionate)$/.test(l)||/testosterone|cypionate|\bcyp\b/i.test(s)){
      return findBy(['TC250','TC200','TC'],[/^TC250$/i,/^TC\d+/i,/Testosterone Cypionate/i,/Test C/i,/^Cyp$/i],true)||s;
    }
    if(/tesamorelin|^tesa|^ts10$|^ts20$|^ts$/i.test(s)||/tesamorelin/.test(l)){
      return findBy(['TS10','TS20','TS5'],[/^TS10$/i,/^TS20$/i,/^TS\d+/i,/Tesamorelin/i,/^Tesa/i],true)||s;
    }
    if(/^(klo80|klow80|klow|klotho|klotho80)$/.test(l)||/klotho|klow/i.test(s)){
      return findBy(['Klow80','KLO80','Klow','KLO'],[/^Klow\d*/i,/^KLO\d*/i,/Klotho/i],true)||s;
    }
    if(/^(wv|w-v|wolverine|bpc157\+tb500|bpc-157\+tb-500|bpc157tb500)$/.test(l)||/bpc.*tb|tb.*bpc/i.test(s)){
      return findBy(['WV','W-V'],[/^WV$/i,/^W-V$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i],true)||s;
    }
    if(/^(cp20|cp10|cjcipa|cjcipamorelin|cjc-1295ipamorelin|cjc\+ipamorelin)$/.test(l)||/cjc.*ipa|cjc.*ipamorelin/i.test(s)){
      return findBy(['CP20','CP10'],[/^CP20$/i,/^CP10$/i,/^CP\d+/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i],true)||s;
    }
    if(isSlupp(s)){
      // Only allow if stocked. If not stocked, keep raw so it will be dropped.
      return findBy(['Slu pp 332','SLU-PP-332','SLUPP','Slupp'],[/^Slu/i,/SLU/i],true)||s;
    }
    return s;
  }
  function parseDays(days){
    if(!Array.isArray(days))return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number')return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function inStock(name){return !!findExact(name,true)}
  function normalize(raw){
    const arr=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.plan)?raw.plan:[]);
    if(!arr.length)throw new Error('GPT returned no plan rows.');
    const dropped=[];
    const rows=[];
    arr.forEach((r,i)=>{
      const original=String(r.name||'').trim();
      const name=canonical(original);
      const lane=String(r.lane||'').toLowerCase().trim();
      const days=parseDays(r.days);
      if(!name)throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane))throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length)throw new Error('Row '+(i+1)+' has no valid days.');
      if(!inStock(name)){
        dropped.push(original||name);
        return;
      }
      rows.push({id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name,lane,days,dose:r.dose===''||r.dose==null?'':Number(r.dose),unit:String(r.unit||'mcg').trim(),purpose:String(r.purpose||'').trim()});
    });
    if(!rows.length)throw new Error('All generated rows were unstocked/outside inventory: '+dropped.join(', '));
    const map=new Map();
    rows.forEach(r=>{const k=r.name.toLowerCase()+'|'+r.lane+'|'+r.days.join(',');if(!map.has(k))map.set(k,r)});
    const final=[...map.values()];
    final._dropped=dropped;
    return final;
  }
  function dayNames(days){return (days||[]).map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).filter(Boolean)}
  function box(){return $('gpt343-json')||$('gpt340-json')||$('gpt339-json')||$('gpt336-json-input')||$('gpt337-json-input')}
  function setStatus(msg,kind){const s=$('gpt346-api-status')||$('gpt343-status')||$('gpt340-status')||$('gpt339-status');if(s){s.textContent=msg;s.className=kind||''}}
  function stringifyPlan(plan){return JSON.stringify(plan.map(p=>({name:p.name,lane:p.lane,days:dayNames(p.days),dose:p.dose,unit:p.unit,purpose:p.purpose})),null,2)}
  function showDropped(dropped){
    let el=$('gpt355-stock-lock-note')||$('gpt356-alias-note');
    const host=$('gpt346-api-card')||document.querySelector('#pg-stackbuilder .gpt-sb-side')||document.querySelector('#pg-stackbuilder .gpt-sb-main');
    if(!el&&host){el=document.createElement('div');el.id='gpt356-alias-note';el.style.cssText='margin-top:8px;padding:8px 10px;border-radius:13px;border:1px solid #F0D9C4;background:linear-gradient(135deg,#FFF8F1,#FFF2E7);color:#8A5A38;font-size:11.3px;line-height:1.38';host.appendChild(el)}
    if(!el)return;
    if(dropped&&dropped.length){el.style.display='block';el.innerHTML='<b>Stocked inventory lock:</b> removed unstocked/non-inventory suggestion(s): '+dropped.join(', ')+'.';}
    else el.style.display='none';
  }
  function normalizeVisible(){
    const ta=box(); if(!ta||!ta.value.trim())return false;
    try{
      const plan=normalize(JSON.parse(ta.value));
      ta.value=stringifyPlan(plan);
      showDropped(plan._dropped||[]);
      setStatus('Inventory-code plan: '+plan.map(p=>p.name).join(', '),'ok');
      return plan;
    }catch(e){setStatus('Inventory alias/stock check: '+e.message,'bad');return false}
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function parseSchedName(k){return String(k||'').split('/')[0]||''}
  function activeInvByName(name){
    const low=String(name||'').toLowerCase();
    return (S.inv||[]).find(i=>i&&i.name&&String(i.name).toLowerCase()===low&&!i.isSupply)||null;
  }
  function activeVialMcgByName(name){
    const low=String(name||'').toLowerCase();
    return (S.vials||[]).filter(v=>v&&String(v.peptideName||'').toLowerCase()===low&&v.status!=='depleted'&&v.status!=='discarded'&&v.status!=='gifted')
      .reduce((sum,v)=>sum+Math.max(0,Number(v.remainingMcg)||0),0);
  }
  function vialFieldStockCount(it){
    if(!it)return 0;
    return Math.max(0,Number(it.fz)||0)+Math.max(0,Number(it.fr)||0)+Math.max(0,Number(it.dk)||0)+Math.max(0,Number(it.nd)||0);
  }
  function hasValidInventoryStock(name){
    const inv=activeInvByName(name);
    if(!inv||inv.archived)return false;
    if(vialFieldStockCount(inv)>0)return true;
    return activeVialMcgByName(name)>0;
  }
  function shouldCleanupForInvalidState(name){
    const inv=activeInvByName(name);
    if(!inv)return true;
    if(inv.archived)return true;
    return !hasValidInventoryStock(name);
  }
  function cleanupPriorBadRows(){
    if(!window.S)return;
    const badNames=['Slupp','SLUPP','SLU-PP','SLU-PP-332','Slu pp 332','Retatrutide','Reta','Cyp','Testosterone Cypionate','Testosterone'];
    S.sched=S.sched||{};
    // CP20-CLEANUP-FALSE-POSITIVE-R1: do not drop a sched key when the peptide
    // still has a valid active inventory/vial state; only clean truly invalid rows.
    badNames.forEach(n=>Object.keys(S.sched).forEach(k=>{
      if(k.toLowerCase().indexOf(String(n).toLowerCase()+'/')!==0)return;
      const schedName=parseSchedName(k);
      if(shouldCleanupForInvalidState(schedName))delete S.sched[k];
    }));
    if(Array.isArray(S.stackPlan)){
      S.stackPlan=S.stackPlan.filter(p=>{
        const n=String(p.name||'');
        if(isSlupp(n) && !inStock(n)) return false;
        if(/retatrutide|^reta$/i.test(n)) return false;
        if(/^cyp$|testosterone cypionate|^testosterone$/i.test(n)) return false;
        return true;
      });
    }
  }
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      cleanupPriorBadRows();
      S.stackPlan=plan;S.inv=S.inv||[];S.sched=S.sched||{};if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it)return;
        if(p.dose!==''&&!isNaN(p.dose))it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';it.stackLane=p.lane;it.days=p.days.slice();it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane);p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function importVisible(){
    const plan=normalizeVisible(); if(!plan)return false;
    savePlan(plan);
    try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
    toast('✓ Imported inventory-code plan',plan.map(p=>p.name).join(', '));
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},300);
    return true;
  }
  function enhancePrompt(){
    const p=$('gpt343-prompt')||$('gpt340-prompt')||$('gpt339-prompt')||$('sb-feed');
    if(!p)return;
    let v=p.value||'';
    v=v.replace(/\nHARD INVENTORY CODE RULE:[\s\S]*$/,'');
    p.value=v+'\n\nHARD INVENTORY CODE RULE:\n- Use stocked/open inventory names only.\n- Use RT30 instead of Retatrutide/Reta when RT30 is stocked.\n- Use TC250 instead of Cyp/Testosterone Cypionate when TC250 is stocked.\n- Do not include Slupp/SLU-PP unless it is stocked/open with vials.\n- Exact stocked inventory names: '+stockedNames().join(', ')+'\n';
  }
  window.addEventListener('click',function(e){
    if(!e.target||!e.target.closest)return;
    if(e.target.closest('#gpt346-generate,#gpt346-generate-import,#gpt343-copy-prompt,#gpt343-copy-prompt-2')){
      enhancePrompt();setTimeout(normalizeVisible,700);setTimeout(normalizeVisible,1500);setTimeout(normalizeVisible,3000);
    }
    if(e.target.closest('#gpt343-import,#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();importVisible();
    }
  },true);
  document.addEventListener('input',function(e){if(e.target&&e.target.id&&/^gpt(343|340|339|336|337)-/.test(e.target.id))setTimeout(normalizeVisible,300)},true);
  __tmpPgInterval(enhancePrompt, 2500, 'pg-stackbuilder');
  setTimeout(function runCleanupPriorBadRows(retry){
    if(!window.S){
      if((retry||0)<5)setTimeout(function(){runCleanupPriorBadRows((retry||0)+1)},250);
      return;
    }
    cleanupPriorBadRows();
    try{window.save&&window.save()}catch(_){}
  },800);
  window.tmpHardAliasStockNormalize356=normalize;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    One focused fix from v33.375-stable-vendor-post-import-review:
    Any peptide record with zero stocked/open vials is excluded from inventory-mode stack plans.
    This applies to every peptide, not just Slupp.
  */
  const PLAN_KEY='tmp.stackPlan.v1';
  const DAY={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6,Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  const LANES=new Set(['breakfast','lunch','dinner','bedtime']);

  function $(id){return document.getElementById(id)}
  function toast(a,b){try{window.tmpInventoryToast&&tmpInventoryToast(a,b||'')}catch(_){console.log(a,b||'')}}
  function allItems(){try{return (window.S&&S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived)}catch(_){return []}}
  function n(v){const x=Number(v);return isFinite(x)?x:0}
  function stockCount(it){
    if(!it)return 0;
    let total=0;
    ['fz','fr','dk','nd','qty','quantity','vials','stock','onHand','open','opened','remaining','count'].forEach(k=>{
      total+=Math.max(0,n(it[k]));
    });
    ['locations','storage','counts'].forEach(k=>{
      const obj=it[k];
      if(obj&&typeof obj==='object')Object.values(obj).forEach(v=>{total+=Math.max(0,n(v))});
    });
    return total;
  }
  function stockedItems(){return allItems().filter(it=>stockCount(it)>0)}
  function stockedNames(){return stockedItems().map(i=>i.name)}
  function allNames(){return allItems().map(i=>i.name)}
  function isStockedName(name){
    const low=String(name||'').toLowerCase();
    return stockedItems().some(i=>String(i.name).toLowerCase()===low && stockCount(i)>0);
  }
  function findExact(name, stockedOnly){
    const low=String(name||'').toLowerCase();
    const arr=(stockedOnly?stockedNames():allNames());
    return arr.find(x=>String(x).toLowerCase()===low)||'';
  }
  function findBy(exacts, regexes, stockedOnly){
    for(const x of exacts||[]){const hit=findExact(x, stockedOnly);if(hit)return hit}
    const arr=(stockedOnly?stockedNames():allNames());
    for(const rx of regexes||[]){const hit=arr.find(n=>rx.test(String(n)));if(hit)return hit}
    return '';
  }
  function canonical(raw){
    const s=String(raw||'').trim(), l=s.toLowerCase().replace(/\s+/g,'');
    if(!s)return s;

    const exact=findExact(s,true);
    if(exact)return exact;

    if(/^(retatrutide|reta|rt|rt10|rt20|rt30|rt230)$/.test(l)||/retatrutide|reta/i.test(s)){
      return findBy(['RT30','RT20','RT10'],[/^RT30$/i,/^RT20$/i,/^RT10$/i,/^RT\d+/i,/Retatrutide/i,/^Reta/i],true)||s;
    }
    if(/^(cyp|tc250|tc|testc|testosteronecypionate|testosterone|cypionate)$/.test(l)||/testosterone|cypionate|\bcyp\b/i.test(s)){
      return findBy(['TC250','TC200','TC'],[/^TC250$/i,/^TC\d+/i,/Testosterone Cypionate/i,/Test C/i,/^Cyp$/i],true)||s;
    }
    if(/tesamorelin|^tesa|^ts10$|^ts20$|^ts$/i.test(s)||/tesamorelin/.test(l)){
      return findBy(['TS10','TS20','TS5'],[/^TS10$/i,/^TS20$/i,/^TS\d+/i,/Tesamorelin/i,/^Tesa/i],true)||s;
    }
    if(/^(klo80|klow80|klow|klotho|klotho80)$/.test(l)||/klotho|klow/i.test(s)){
      return findBy(['Klow80','KLO80','Klow','KLO'],[/^Klow\d*/i,/^KLO\d*/i,/Klotho/i],true)||s;
    }
    if(/^(wv|w-v|wolverine|bpc157\+tb500|bpc-157\+tb-500|bpc157tb500)$/.test(l)||/bpc.*tb|tb.*bpc/i.test(s)){
      return findBy(['WV','W-V'],[/^WV$/i,/^W-V$/i,/Wolverine/i,/BPC.*TB/i,/TB.*BPC/i],true)||s;
    }
    if(/^(cp20|cp10|cjcipa|cjcipamorelin|cjc-1295ipamorelin|cjc\+ipamorelin)$/.test(l)||/cjc.*ipa|cjc.*ipamorelin/i.test(s)){
      return findBy(['CP20','CP10'],[/^CP20$/i,/^CP10$/i,/^CP\d+/i,/CJC.*Ipa/i,/CJC.*Ipamorelin/i],true)||s;
    }
    return s;
  }
  function parseDays(days){
    if(!Array.isArray(days))return [];
    return [...new Set(days.map(d=>{
      if(typeof d==='number')return d;
      const s=String(d||'').trim();
      return DAY[s] ?? DAY[s.slice(0,3)] ?? null;
    }).filter(d=>d!=null&&d>=0&&d<=6))].sort((a,b)=>a-b);
  }
  function normalize(raw){
    const arr=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.plan)?raw.plan:[]);
    if(!arr.length)throw new Error('GPT returned no plan rows.');
    const dropped=[];
    const rows=[];
    arr.forEach((r,i)=>{
      const original=String(r.name||'').trim();
      const name=canonical(original);
      const lane=String(r.lane||'').toLowerCase().trim();
      const days=parseDays(r.days);
      if(!name)throw new Error('Row '+(i+1)+' missing name.');
      if(!LANES.has(lane))throw new Error('Row '+(i+1)+' invalid lane: '+lane);
      if(!days.length)throw new Error('Row '+(i+1)+' has no valid days.');

      // Universal rule: inventory mode may only schedule stocked/open items.
      if(!isStockedName(name)){
        dropped.push(original||name);
        return;
      }

      rows.push({
        id:(r.id||name).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        name,lane,days,
        dose:r.dose===''||r.dose==null?'':Number(r.dose),
        unit:String(r.unit||'mcg').trim(),
        purpose:String(r.purpose||'').trim()
      });
    });
    if(!rows.length)throw new Error('All generated rows had zero vials or were outside stocked inventory: '+dropped.join(', '));
    const map=new Map();
    rows.forEach(r=>{
      const k=r.name.toLowerCase()+'|'+r.lane+'|'+r.days.join(',');
      if(!map.has(k))map.set(k,r);
    });
    const final=[...map.values()];
    final._dropped=dropped;
    return final;
  }
  function dayNames(days){return (days||[]).map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).filter(Boolean)}
  function textBox(){return $('gpt343-json')||$('gpt340-json')||$('gpt339-json')||$('gpt336-json-input')||$('gpt337-json-input')}
  function setStatus(msg,kind){const s=$('gpt346-api-status')||$('gpt343-status')||$('gpt340-status')||$('gpt339-status');if(s){s.textContent=msg;s.className=kind||''}}
  function showDropped(dropped){
    let el=$('gpt357-zero-vial-note')||$('gpt356-alias-note')||$('gpt355-stock-lock-note');
    const host=$('gpt346-api-card')||document.querySelector('#pg-stackbuilder .gpt-sb-side')||document.querySelector('#pg-stackbuilder .gpt-sb-main');
    if(!el&&host){
      el=document.createElement('div');
      el.id='gpt357-zero-vial-note';
      el.style.cssText='margin-top:8px;padding:8px 10px;border-radius:13px;border:1px solid #F0D9C4;background:linear-gradient(135deg,#FFF8F1,#FFF2E7);color:#8A5A38;font-size:11.3px;line-height:1.38';
      host.appendChild(el);
    }
    if(!el)return;
    if(dropped&&dropped.length){
      el.style.display='block';
      el.innerHTML='<b>Zero-vial lock:</b> Removed unstocked item(s): '+dropped.join(', ')+'. Add vials first, or use Hybrid/Virtual planning for wishlist items.';
    }else el.style.display='none';
  }
  function stringify(plan){
    return JSON.stringify(plan.map(p=>({name:p.name,lane:p.lane,days:dayNames(p.days),dose:p.dose,unit:p.unit,purpose:p.purpose})),null,2);
  }
  function normalizeVisible(){
    const ta=textBox(); if(!ta||!ta.value.trim())return false;
    try{
      const plan=normalize(JSON.parse(ta.value));
      ta.value=stringify(plan);
      showDropped(plan._dropped||[]);
      setStatus('Stocked-only plan: '+plan.map(p=>p.name).join(', '),'ok');
      return plan;
    }catch(e){setStatus('Stocked-only check: '+e.message,'bad');return false}
  }
  function key(name,time,di){return name+'/'+time+'/'+di}
  function timeForLane(lane){return (lane==='breakfast'||lane==='lunch')?'am':'pm'}
  function parseSchedName(k){return String(k||'').split('/')[0]||''}
  function activeInvByName(name){
    const low=String(name||'').toLowerCase();
    return (S.inv||[]).find(i=>i&&i.name&&String(i.name).toLowerCase()===low&&!i.isSupply)||null;
  }
  function activeVialMcgByName(name){
    const low=String(name||'').toLowerCase();
    return (S.vials||[]).filter(v=>v&&String(v.peptideName||'').toLowerCase()===low&&v.status!=='depleted'&&v.status!=='discarded'&&v.status!=='gifted')
      .reduce((sum,v)=>sum+Math.max(0,Number(v.remainingMcg)||0),0);
  }
  function vialFieldStockCount(it){
    if(!it)return 0;
    return Math.max(0,Number(it.fz)||0)+Math.max(0,Number(it.fr)||0)+Math.max(0,Number(it.dk)||0)+Math.max(0,Number(it.nd)||0);
  }
  function hasValidInventoryStock(name){
    const inv=activeInvByName(name);
    if(!inv||inv.archived)return false;
    if(vialFieldStockCount(inv)>0)return true;
    return activeVialMcgByName(name)>0;
  }
  function invReadyForSchedCleanup(){
    if(!window.S || !Array.isArray(S.inv)) return false;
    // CP20-CLEANUP-FALSE-POSITIVE-R1: skip sched cleanup until inv has hydrated;
    // empty inv + existing sched keys during load caused false-positive removal.
    if(S._hadSaved && S.inv.length===0){
      const hasSched=Object.keys(S.sched||{}).some(k=>S.sched[k]);
      if(hasSched) return false;
    }
    return true;
  }
  // RX-CAL-KEEP-R1: the zero-vial cleanup is for injectable peptides. Rx meds
  // (S.rx — e.g. Fin, Min) and pill-unit items never have vials, so without
  // this exemption the 900ms post-load sweep silently wiped them off the
  // weekly calendar (and save() persisted the wipe) on every reload.
  function isRxOrPillName(name){
    const low=String(name||'').trim().toLowerCase();
    if(!low)return false;
    // RX-NAME-PREFIX-R1: calendar names are often abbreviations of the Rx name
    // ("Fin" vs "Finasteride") — match exact OR prefix (≥3 chars) either way.
    // RX-NAME-TYPO-R1: plus single-typo tolerance for names ≥6 chars
    // ("Tadalifil" vs "Tadalafil") — without it this exemption misses the
    // misspelled calendar item and the zero-stock sweep wipes it.
    const m=(a)=>{a=String(a||'').trim().toLowerCase();return !!a&&(a===low||(a.length>=3&&low.length>=3&&(a.startsWith(low)||low.startsWith(a)))||(window.__pgRxNearMatch&&__pgRxNearMatch(a,low)));};
    try{ if((S.rx||[]).some(r=>r&&m(r.name))) return true; }catch(_){}
    const inv=activeInvByName(name);
    if(inv&&(inv.isPeptide===false||String(inv.doseUnit||'').toLowerCase()==='pill')) return true;
    return false;
  }
  function shouldRemoveForZeroStock(name){
    if(isRxOrPillName(name)) return false;
    const inv=activeInvByName(name);
    if(!inv){
      if(!invReadyForSchedCleanup()) return false;
      return true;
    }
    if(inv.archived)return true;
    if(vialFieldStockCount(inv)>0)return false;
    return activeVialMcgByName(name)<=0;
  }
  function cleanupZeroVialScheduled(){
    if(!window.S)return;
    if(!invReadyForSchedCleanup()) return;
    S.sched=S.sched||{};
    // CP20-CLEANUP-FALSE-POSITIVE-R1: key-level guard to preserve valid rows
    // when inventory exists and has either positive stock fields or active vial mcg.
    Object.keys(S.sched).forEach(k=>{
      const name=parseSchedName(k);
      if(shouldRemoveForZeroStock(name))delete S.sched[k];
    });
    if(Array.isArray(S.stackPlan)){
      S.stackPlan=S.stackPlan.filter(p=>!shouldRemoveForZeroStock(p&&p.name));
    }
  }
  function savePlan(plan){
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      plan=(plan||[]).filter(function(x){return x&&x.name&&tmpCalClearGuard.isAllowedName(x.name);});
      if(!plan.length) return;
    }
    if(window.S){
      cleanupZeroVialScheduled();
      S.stackPlan=plan;S.inv=S.inv||[];S.sched=S.sched||{};if(typeof S.nI!=='number')S.nI=Date.now();
      const names=new Set(plan.map(p=>p.name));
      names.forEach(name=>Object.keys(S.sched).forEach(k=>{if(k.indexOf(name+'/')===0)delete S.sched[k]}));
      plan.forEach(p=>{
        let it=S.inv.find(i=>i&&i.name&&i.name.toLowerCase()===p.name.toLowerCase()&&!i.isSupply);
        if(!it||!hasValidInventoryStock(p.name))return;
        if(p.dose!==''&&!isNaN(p.dose))it.dose=p.dose;
        it.doseUnit=p.unit||it.doseUnit||'mcg';
        it.stackLane=p.lane;it.days=p.days.slice();it.importPurpose=p.purpose||'';
        const t=timeForLane(p.lane);p.days.forEach(di=>{S.sched[key(p.name,t,di)]=true});
      });
      try{window.save&&window.save()}catch(_){}
      try{localStorage.setItem('peptide_tracker',JSON.stringify(S))}catch(_){}
    }
    try{localStorage.setItem(PLAN_KEY,JSON.stringify(plan))}catch(_){}
  }
  function importVisible(){
    const plan=normalizeVisible(); if(!plan)return false;
    savePlan(plan);
    try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render();window.renderInventoryPage&&window.renderInventoryPage();window.renderOptimizer&&window.renderOptimizer()}catch(_){}
    toast('✓ Imported stocked-only plan',plan.map(p=>p.name).join(', '));
    setTimeout(()=>{document.querySelector('[data-pg="calendar"]')?.click();try{window.renderCal&&window.renderCal();window.tmpStackPlan&&tmpStackPlan.render&&tmpStackPlan.render()}catch(_){}},300);
    return true;
  }
  function enhancePrompt(){
    const p=$('gpt343-prompt')||$('gpt340-prompt')||$('gpt339-prompt')||$('sb-feed');
    if(!p)return;
    let v=p.value||'';
    v=v.replace(/\nUNIVERSAL STOCKED-ONLY RULE:[\s\S]*$/,'');
    p.value=v+'\n\nUNIVERSAL STOCKED-ONLY RULE:\n- Work from stocked/open inventory only.\n- Do not include ANY peptide that has zero vials or zero on-hand stock.\n- Do not use peptide records merely because they exist in the inventory database.\n- Exact stocked/open inventory names: '+stockedNames().join(', ')+'\n- Zero-vial peptide records are not eligible for inventory-mode scheduling.\n';
  }
  window.addEventListener('click',function(e){
    if(!e.target||!e.target.closest)return;
    if(e.target.closest('#gpt346-generate,#gpt346-generate-import,#gpt343-copy-prompt,#gpt343-copy-prompt-2')){
      enhancePrompt();setTimeout(normalizeVisible,700);setTimeout(normalizeVisible,1500);setTimeout(normalizeVisible,3000);
    }
    if(e.target.closest('#gpt343-import,#gpt340-import,#gpt339-import,#gpt336-import-json,#gpt337-import-inline-json')){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();importVisible();
    }
  },true);
  document.addEventListener('input',function(e){if(e.target&&e.target.id&&/^gpt(343|340|339|336|337)-/.test(e.target.id))setTimeout(normalizeVisible,300)},true);
  __tmpPgInterval(enhancePrompt, 2500, 'pg-stackbuilder');
  setTimeout(function runCleanupZeroVialScheduled(retry){
    if(!window.S || !invReadyForSchedCleanup()){
      if((retry||0)<12)setTimeout(function(){runCleanupZeroVialScheduled((retry||0)+1)},250);
      return;
    }
    cleanupZeroVialScheduled();
    try{window.save&&window.save()}catch(_){}
  },900);
  window.tmpUniversalStockedOnlyNormalize357=normalize;
})();


// ===== extracted post-core patch script =====
(function(){
  function $(id){return document.getElementById(id)}
  function arrange(){
    const root=$('gpt343-stackbuilder-pro');
    if(!root)return;
    const hero=root.querySelector('.gpt343-hero');
    const body=root.querySelector('.gpt343-body');
    const api=$('gpt346-api-card');
    if(hero && root.firstElementChild!==hero) root.insertBefore(hero, root.firstChild);
    if(body && hero && body.previousElementSibling!==hero) root.insertBefore(body, hero.nextSibling);
    if(api && body && api.previousElementSibling!==body) root.insertBefore(api, body.nextSibling);
    const title=root.querySelector('.gpt343-title');
    if(title) title.textContent='Build a weekly stack';
    const sub=root.querySelector('.gpt343-sub');
    if(sub) sub.textContent='Start with goals, choose how GPT should use your stocked inventory, then generate and review the Weekly Calendar.';
    const h1=root.querySelector('.gpt343-screen[data-screen="1"] h3');
    if(h1) h1.textContent='1. Choose your lanes';
    const p1=root.querySelector('.gpt343-screen[data-screen="1"] p');
    if(p1) p1.textContent='Choose the lanes you want this stack to cover. GPT will use stocked inventory only unless you choose Hybrid or Virtual planning.';
    const apiTitle=document.querySelector('#gpt346-api-card .gpt346-title');
    if(apiTitle) apiTitle.textContent='2. Generate with GPT';
    const apiSub=document.querySelector('#gpt346-api-card .gpt346-sub');
    if(apiSub) apiSub.textContent='Main path: GPT considers your selected lanes and stocked inventory, then PeptideGenius fills the Weekly Calendar.';
    const gen=$('gpt346-generate-import');
    if(gen) gen.textContent='Generate stack + fill calendar';
    const prev=$('gpt346-generate');
    if(prev) prev.textContent='Preview plan only';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(arrange,400));
  else setTimeout(arrange,400);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="stackbuilder"]'))setTimeout(arrange,180);
  },true);
  __tmpPgInterval(arrange, 2500, 'pg-stackbuilder');
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    One focused UI change:
    Relabel API card as Step 2 and ensure it sits beside Step 1 on desktop.
  */
  function $(id){return document.getElementById(id)}
  function polish(){
    var apiTitle=document.querySelector('#gpt346-api-card .gpt346-title');
    if(apiTitle) apiTitle.textContent='2. Generate with GPT';

    var apiSub=document.querySelector('#gpt346-api-card .gpt346-sub');
    if(apiSub) apiSub.textContent='Use the selected lanes and stocked inventory to generate a weekly plan, then send it to the calendar.';

    var h1=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="1"] h3');
    if(h1) h1.textContent='1. Choose your lanes';

    var gen=$('gpt346-generate-import');
    if(gen) gen.textContent='Generate stack + fill calendar';

    var preview=$('gpt346-generate');
    if(preview) preview.textContent='Preview plan only';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){setTimeout(polish,350)});
  else setTimeout(polish,350);

  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('[data-pg="stackbuilder"]')) setTimeout(polish,180);
  }, true);
  __tmpPgInterval(polish, 2500, 'pg-stackbuilder');
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    One focused change only:
    Stack Builder wording: "Build your stack with A.I. help."
    No layout, API, inventory, Daily Stack, cache, chart, or calendar logic changes.
  */
  function $(id){return document.getElementById(id)}
  function apply(){
    var mainTitle=document.querySelector('#pg-stackbuilder .gpt343-title, #pg-stackbuilder .gpt-sb-title');
    if(mainTitle) mainTitle.textContent='Build your stack with A.I. help';

    var mainSub=document.querySelector('#pg-stackbuilder .gpt343-sub, #pg-stackbuilder .gpt-sb-sub');
    if(mainSub) mainSub.textContent='Choose your lanes, let AI consider your stocked inventory, then review the weekly plan before it goes on your calendar.';

    var step1=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="1"] h3');
    if(step1) step1.textContent='1. Choose your lanes';

    var step1p=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="1"] p');
    if(step1p) step1p.textContent='Choose the lanes you want covered. A.I. will use stocked inventory only unless you choose Hybrid or Virtual planning.';

    var apiTitle=document.querySelector('#gpt346-api-card .gpt346-title');
    if(apiTitle) apiTitle.textContent='2. Build with A.I.';

    var apiSub=document.querySelector('#gpt346-api-card .gpt346-sub');
    if(apiSub) apiSub.textContent='A.I. considers your selected lanes and stocked inventory, then PeptideGenius fills the Weekly Calendar.';

    var gen=$('gpt346-generate-import');
    if(gen) gen.textContent='Build stack + fill calendar';

    var preview=$('gpt346-generate');
    if(preview) preview.textContent='Preview plan only';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){setTimeout(apply,350)});
  else setTimeout(apply,350);

  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('[data-pg="stackbuilder"]')) setTimeout(apply,180);
  }, true);
  __tmpPgInterval(apply, 2500, 'pg-stackbuilder');
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    One focused copy polish:
    - AI -> A.I. in Stack Builder user-facing labels.
    - Elite command center / Command central -> Command Central.
  */
  function polishTextNode(el){
    if(!el || !el.textContent) return;
    let t=el.textContent;
    t=t.replace(/\bAI\b/g,'A.I.');
    t=t.replace(/Elite command center/gi,'Command Central');
    t=t.replace(/Command central/g,'Command Central');
    t=t.replace(/command central/g,'Command Central');
    if(el.textContent!==t) el.textContent=t;
  }
  function polish(){
    document.querySelectorAll('#pg-stackbuilder .gpt343-title,#pg-stackbuilder .gpt343-sub,#pg-stackbuilder .gpt346-title,#pg-stackbuilder .gpt346-sub,#pg-stackbuilder .gpt343-screen h3,#pg-stackbuilder .gpt343-screen p,#pg-stackbuilder button,#pg-stack .gpt270-title,.gpt-cockpit-title').forEach(polishTextNode);

    // Specific preferred titles
    const sbTitle=document.querySelector('#pg-stackbuilder .gpt343-title,#pg-stackbuilder .gpt-sb-title');
    if(sbTitle && /Build your stack/i.test(sbTitle.textContent)) sbTitle.textContent='Build your stack with A.I. help';

    const apiTitle=document.querySelector('#gpt346-api-card .gpt346-title');
    if(apiTitle && /Build with|Generate with/i.test(apiTitle.textContent)) apiTitle.textContent='2. Build with A.I.';

    const gen=document.getElementById('gpt346-generate-import');
    if(gen) gen.textContent='Build stack + fill calendar';

    document.querySelectorAll('#pg-stack .gpt270-title,.gpt-cockpit-title').forEach(function(el){
      if(/elite|command/i.test(el.textContent||'')) el.textContent='Command Central';
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){setTimeout(polish,350)});
  else setTimeout(polish,350);
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('[data-pg="stackbuilder"],[data-pg="stack"]')) setTimeout(polish,180);
  }, true);
  __tmpPgInterval(polish, 2500, ['pg-stackbuilder','pg-stack']);
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    One focused copy change:
    Goal wording -> lane wording.
    Preferred UX phrase: "Choose your lanes".
  */
  function setText(sel, text){
    const el=document.querySelector(sel);
    if(el) el.textContent=text;
  }
  function polish(){
    setText('#pg-stackbuilder .gpt343-screen[data-screen="1"] h3','1. Choose your lanes');

    const p1=document.querySelector('#pg-stackbuilder .gpt343-screen[data-screen="1"] p');
    if(p1) p1.textContent='Select the lanes you want this stack to cover. A.I. will use stocked inventory only unless you choose Hybrid or Virtual planning.';

    const title=document.querySelector('#pg-stackbuilder .gpt343-title,#pg-stackbuilder .gpt-sb-title');
    if(title && /stack/i.test(title.textContent||'')) title.textContent='Build your stack with A.I. help';

    const sub=document.querySelector('#pg-stackbuilder .gpt343-sub,#pg-stackbuilder .gpt-sb-sub');
    if(sub) sub.textContent='Choose your lanes, let A.I. consider your stocked inventory, then review the weekly plan before it goes on your calendar.';

    const apiSub=document.querySelector('#gpt346-api-card .gpt346-sub');
    if(apiSub) apiSub.textContent='A.I. considers your selected lanes and stocked inventory, then PeptideGenius fills the Weekly Calendar.';

    document.querySelectorAll('#pg-stackbuilder *').forEach(function(el){
      if(!el.childElementCount && el.textContent){
        let t=el.textContent;
        t=t.replace(/Pick your goals/g,'Choose your lanes')
           .replace(/Pick goals/g,'Choose lanes')
           .replace(/pick goals/g,'choose lanes')
           .replace(/selected goals/g,'selected lanes')
           .replace(/Selected goals/g,'Selected lanes');
        if(t!==el.textContent) el.textContent=t;
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){setTimeout(polish,350)});
  else setTimeout(polish,350);
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('[data-pg="stackbuilder"]')) setTimeout(polish,180);
  }, true);
  __tmpPgInterval(polish, 2500, 'pg-stackbuilder');
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    Reuses v33.375-stable-vendor-post-import-review state key, but makes collapse full-height collapse:
    only the title line remains.
  */
  const KEY='tmp.calendarLaneCollapse.v1';
  const LANES=[
    {id:'breakfast', label:'Breakfast'},
    {id:'lunch', label:'Lunch'},
    {id:'dinner', label:'Dinner'},
    {id:'bedtime', label:'Bedtime'}
  ];
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){return {}}}
  function save(s){try{localStorage.setItem(KEY,JSON.stringify(s||{}))}catch(_){}}
  function countActive(rows){
    if(!rows)return 0;
    try{return rows.querySelectorAll('.sc.active,.gpt329-plan-cell').length}catch(_){return 0}
  }
  function applyState(card,lane,btn){
    const st=load();
    const collapsed=!!st[lane.id];
    card.classList.toggle('gpt364-calendar-collapsed',collapsed);
    card.classList.toggle('gpt365-calendar-collapsed',collapsed);
    const rows=document.getElementById('cal-'+lane.id+'-rows');
    const n=countActive(rows);
    btn.innerHTML=(collapsed?window.__tmpCalGlyphs.collapseClosed:window.__tmpCalGlyphs.collapseOpen)+'<small>'+n+'</small>';
    btn.title=(collapsed?'Expand ':'Collapse ')+lane.label+' lane';
    btn.setAttribute('aria-expanded',String(!collapsed));
  }
  function setupLane(lane){
    const rows=document.getElementById('cal-'+lane.id+'-rows');
    if(!rows)return;
    const card=rows.closest('.card');
    if(!card)return;
    const title=card.firstElementChild;
    if(!title)return;

    title.classList.add('gpt364-cal-title','gpt365-cal-title');

    /* Hide the old v364 note if it exists; this version collapses to title only. */
    const oldNote=card.querySelector('.gpt364-collapsed-note');
    if(oldNote) oldNote.style.display='none';

    let btn=card.querySelector('.gpt365-cal-toggle[data-lane="'+lane.id+'"]') ||
            card.querySelector('.gpt364-cal-toggle[data-lane="'+lane.id+'"]');

    if(btn && btn.dataset.gpt365Bound!=='1'){
      const fresh=btn.cloneNode(true);
      btn.replaceWith(fresh);
      btn=fresh;
    }

    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='gpt365-cal-toggle';
      btn.dataset.lane=lane.id;
      btn.setAttribute('aria-label','Toggle '+lane.label+' calendar lane');
      title.appendChild(btn);
    }else{
      btn.classList.remove('gpt364-cal-toggle');
      btn.classList.add('gpt365-cal-toggle');
    }

    if(!btn.dataset.gpt365Bound){
      btn.dataset.gpt365Bound='1';
      btn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const st=load();
        st[lane.id]=!st[lane.id];
        save(st);
        applyState(card,lane,btn);
      });
    }

    applyState(card,lane,btn);
  }
  function setup(){LANES.forEach(setupLane)}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(setup,300)});
  else setTimeout(setup,300);

  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="calendar"]')) setTimeout(setup,200);
  },true);

  __tmpRegisterRenderCalPost(setup);
  window.tmpCalendarFullCollapseSetup365=setup;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    Vendor Pricing UI-only helper:
    - guesses vendor from filename/text/known vendors
    - adds warehouse selector
    - defaults warehouse to China
    - switches to US only if file/text explicitly says US/USA/domestic/US warehouse
    - user can override both
    - DOES NOT change import commit/storage logic yet
  */
  function g(id){ return document.getElementById(id); }
  function gv(id){ const el=g(id); return el ? el.value : ''; }
  function sv(id,v){ const el=g(id); if(el) el.value = v; }

  function knownVendors(){
    try { return (window.S && Array.isArray(S.vendors)) ? S.vendors.filter(Boolean) : []; }
    catch(_) { return []; }
  }

  function cleanVendorFromFilename(name){
    let s = String(name || '');
    s = s.replace(/\.[a-z0-9]{2,6}$/i, '');
    s = s.replace(/[_\-]+/g, ' ');
    s = s.replace(/\b(price|pricing|price\s*list|pricelist|vendor|peptide|peptides|catalog|catalogue|sheet|xlsx?|pdf|csv|usa?|us|china|cn|warehouse|domestic|international|list)\b/gi, ' ');
    s = s.replace(/\b\d{4}[-_ ]?\d{1,2}[-_ ]?\d{1,2}\b/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    if(!s) return '';
    const parts = s.split(' ').filter(Boolean);
    if(parts.length > 1 && parts[0].length >= 2 && parts[0].length <= 14) return parts[0].toUpperCase();
    return s.toUpperCase();
  }

  function guessWarehouse(text, filename){
    const blob = (String(filename || '') + '\n' + String(text || '')).toLowerCase();

    // Default is China. Only switch to US on explicit US signals.
    if(/\b(us|usa|u\.s\.|united states|domestic|domestic warehouse|us warehouse|usa warehouse|ships from us|ship from us|us stock|usa stock|u\.s\. warehouse)\b/i.test(blob)){
      return 'CN'; // will be corrected below; keep explicit branch readable
    }
    return 'CN';
  }

  function guessWarehouseStrict(text, filename){
    const blob = (String(filename || '') + '\n' + String(text || '')).toLowerCase();
    if(/\b(us|usa|u\.s\.|united states|domestic|domestic warehouse|us warehouse|usa warehouse|ships from us|ship from us|us stock|usa stock|u\.s\. warehouse)\b/i.test(blob)){
      return 'US';
    }
    return 'CN';
  }

  function guessVendor(text, filename){
    const vendors = knownVendors();
    const fname = String(filename || '');
    const textHead = String(text || '').split(/\r?\n/).slice(0, 30).join(' ');
    const blob = (fname + ' ' + textHead).toUpperCase();

    let best = null, bestScore = 0;
    vendors.forEach(v => {
      const vU = String(v || '').toUpperCase().trim();
      if(!vU) return;
      const re = new RegExp('\\b' + vU.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      const m = blob.match(re);
      const score = m ? m.length : 0;
      if(score > bestScore){ bestScore = score; best = v; }
    });
    if(best) return String(best).toUpperCase();

    const fromFile = cleanVendorFromFilename(fname);
    if(fromFile) return fromFile;

    const lines = String(text || '').split(/\r?\n/).slice(0, 12).map(x => x.trim()).filter(Boolean);
    for(const line of lines){
      const m =
        line.match(/\b([A-Z][A-Z0-9]{1,14})\b.*\b(price|pricing|pricelist|price\s*list)\b/i) ||
        line.match(/\b(price|pricing|pricelist|price\s*list)\b.*\b([A-Z][A-Z0-9]{1,14})\b/i);
      if(m){
        const token = (m[1] || m[2] || '').toUpperCase();
        if(!/PRICE|PRICING|LIST|PEPTIDE|CATALOG|WAREHOUSE|CHINA|USA?|USD|PDF|XLSX|CSV/.test(token)) return token;
      }
    }
    return '';
  }

  function ensureWarehouseControl(){
    if(g('gpt366-pi-warehouse')) return;
    const currency = g('pi-currency');
    if(!currency) return;

    const currencyWrap = currency.closest('div');
    if(!currencyWrap || !currencyWrap.parentNode) return;

    const whWrap = document.createElement('div');
    whWrap.id = 'gpt366-pi-warehouse-wrap';
    whWrap.innerHTML = '<label for="gpt366-pi-warehouse">Warehouse</label><select id="gpt366-pi-warehouse"><option value="CN">China</option><option value="US">US</option><option value="Unknown">Unknown</option></select>';
    currencyWrap.parentNode.insertBefore(whWrap, currencyWrap.nextSibling);

    const grid = currencyWrap.parentNode;
    if(grid && grid.style) grid.style.gridTemplateColumns = '1fr 160px 160px';
  }

  function note(vendor, wh, source){
    const vendorEl = g('pi-vendor');
    if(!vendorEl) return;
    let n = g('gpt366-vendor-guess-note');
    if(!n){
      n = document.createElement('div');
      n.id = 'gpt366-vendor-guess-note';
      const wrap = vendorEl.closest('div');
      if(wrap) wrap.appendChild(n);
    }
    const whLabel = wh === 'US' ? 'US' : (wh === 'Unknown' ? 'Unknown' : 'China');
    n.innerHTML = '<b>Best guess:</b> vendor <b>' + (vendor || '—') + '</b> · warehouse <b>' + whLabel + '</b>. You can override both before parsing.' + (source ? ' <span style="opacity:.75">(' + source + ')</span>' : '');
  }

  function applyGuesses(opts){
    ensureWarehouseControl();
    const text = opts && opts.text != null ? opts.text : gv('pi-text');
    const fileName = opts && opts.fileName ? opts.fileName : ((g('pi-pdf-file') && g('pi-pdf-file').files && g('pi-pdf-file').files[0] && g('pi-pdf-file').files[0].name) || '');

    const vendorGuess = guessVendor(text, fileName);
    const whGuess = guessWarehouseStrict(text, fileName);

    const vendorEl = g('pi-vendor');
    if(vendorEl && !vendorEl.value.trim() && vendorGuess){
      sv('pi-vendor', vendorGuess);
    }

    const whEl = g('gpt366-pi-warehouse');
    if(whEl && !whEl.dataset.userTouched){
      whEl.value = whGuess || 'CN';
    }

    note(gv('pi-vendor') || vendorGuess, whEl ? whEl.value : whGuess, fileName ? 'from filename/text' : 'from text');
  }

  function bind(){
    ensureWarehouseControl();

    const wh = g('gpt366-pi-warehouse');
    if(wh && !wh.dataset.gpt366Bound){
      wh.dataset.gpt366Bound = '1';
      wh.addEventListener('change', function(){
        wh.dataset.userTouched = '1';
        note(gv('pi-vendor'), wh.value, 'manual override');
      });
    }

    const vend = g('pi-vendor');
    if(vend && !vend.dataset.gpt366Bound){
      vend.dataset.gpt366Bound = '1';
      vend.addEventListener('input', function(){
        note(vend.value, gv('gpt366-pi-warehouse') || 'CN', 'manual override');
      });
    }

    const txt = g('pi-text');
    if(txt && !txt.dataset.gpt366Bound){
      txt.dataset.gpt366Bound = '1';
      txt.addEventListener('input', function(){
        applyGuesses({text: txt.value});
      });
    }

    const file = g('pi-pdf-file');
    if(file && !file.dataset.gpt366Bound){
      file.dataset.gpt366Bound = '1';
      file.addEventListener('change', function(){
        const f = file.files && file.files[0];
        setTimeout(function(){ applyGuesses({fileName: f && f.name}); }, 500);
      });
    }
  }

  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('#pt-import')){
      setTimeout(function(){ bind(); applyGuesses({}); }, 120);
      setTimeout(function(){ bind(); applyGuesses({}); }, 700);
    }
    if(e.target && e.target.closest && e.target.closest('#pi-demo,#pi-demo-hkms')){
      setTimeout(function(){ applyGuesses({text: gv('pi-text')}); }, 100);
    }
    if(e.target && e.target.closest && e.target.closest('#pi-parse')){
      // UI only: do not alter parse/commit. Just ensure the visible guess note is current.
      setTimeout(function(){ applyGuesses({text: gv('pi-text')}); }, 20);
    }
  }, true);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  window.tmpVendorGuessUI366 = function(){ applyGuesses({}); };
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    v33.375-stable-vendor-post-import-review
    One focused Vendor Pricing change only:
    The existing importer now stores imported prices under the selected warehouse
    from the v33.375-stable-vendor-post-import-review UI selector.

    Scope:
    - Does not change parser.
    - Does not change vendor guessing UI.
    - Does not change GPT/API normalization.
    - Does not alter nav/Daily Stack/calendar/cache/chart.
  */
  function g(id){ return document.getElementById(id); }
  function gv(id){ const el=g(id); return el ? el.value : ''; }

  function normWh(v){
    v=String(v||'').trim();
    if(v==='US') return 'US';
    if(v==='Unknown') return 'Unknown';
    return 'CN';
  }

  function selectedVendorUpper(){
    return String(gv('pi-vendor')||'').trim().toUpperCase();
  }

  function selectedWarehouse(){
    return normWh(gv('gpt366-pi-warehouse') || 'CN');
  }

  function findCanonicalVendor(vendorUp){
    try{
      return (S.vendors||[]).find(v=>String(v||'').toUpperCase()===vendorUp) || vendorUp;
    }catch(_){ return vendorUp; }
  }

  function convertVendorCellsToWarehouse(vendor, wh){
    if(!window.S || !S.prices || !vendor) return 0;
    let changed=0;
    Object.keys(S.prices||{}).forEach(peptide=>{
      const row=S.prices[peptide];
      if(!row || row[vendor] == null) return;

      const cell=row[vendor];

      // Native importer writes numbers. Convert those to warehouse-aware objects.
      if(typeof cell === 'number'){
        row[vendor] = { [wh]: cell };
        changed++;
        return;
      }

      // If an older import produced a numeric string, normalize that too.
      if(typeof cell === 'string' && cell.trim() !== '' && !isNaN(Number(cell))){
        row[vendor] = { [wh]: Number(cell) };
        changed++;
        return;
      }

      // If already object, leave existing warehouses intact.
      if(typeof cell === 'object' && !Array.isArray(cell)){
        // Do not duplicate or override existing warehouse values.
        return;
      }
    });
    return changed;
  }

  function showWarehouseImportToast(vendor, wh, count){
    const msg=document.createElement('div');
    const whLabel = wh==='US' ? 'US' : (wh==='Unknown' ? 'Unknown warehouse' : 'China');
    msg.textContent='✓ Warehouse set: '+vendor+' · '+whLabel+' · '+count+' price cell'+(count===1?'':'s');
    msg.style.cssText='position:fixed;top:64px;right:20px;background:#2563EB;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;z-index:10001;box-shadow:0 4px 16px rgba(37,99,235,0.30);pointer-events:none';
    document.body.appendChild(msg);
    setTimeout(()=>msg.remove(),3200);
  }

  // Capture commit intent before native importer runs, then convert after it saves.
  document.addEventListener('click',function(e){
    if(!(e.target && e.target.closest && e.target.closest('#pi-commit'))) return;

    const vendorUp=selectedVendorUpper();
    const wh=selectedWarehouse();

    setTimeout(function(){
      try{
        const vendor=findCanonicalVendor(vendorUp);
        const changed=convertVendorCellsToWarehouse(vendor, wh);
        if(changed){
          try{ window.save && window.save(); }catch(_){}
          try{ window.renderPrices && window.renderPrices(); }catch(_){}
          showWarehouseImportToast(vendor, wh, changed);
        }
      }catch(err){
        console.warn('Vendor warehouse import conversion failed',err);
      }
    }, 320);
  }, true);

  window.tmpVendorWarehouseImport367=function(){
    const vendor=findCanonicalVendor(selectedVendorUpper());
    const wh=selectedWarehouse();
    const changed=convertVendorCellsToWarehouse(vendor, wh);
    try{ window.save && window.save(); }catch(_){}
    try{ window.renderPrices && window.renderPrices(); }catch(_){}
    return {vendor, warehouse:wh, changed};
  };
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    Vendor Pricing A.I. prompt builder.
    - Uses current vendor + warehouse selector.
    - Defaults warehouse to China unless selector says otherwise.
    - Forces GPT output to TMP CSV template only.
    - Does NOT auto-call API and does NOT alter import logic.
  */
  function g(id){return document.getElementById(id)}
  function gv(id){const el=g(id);return el?el.value:''}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(_){return false}}

  function warehouseLabel(v){
    if(v==='US')return 'US';
    if(v==='Unknown')return 'Unknown';
    return 'China';
  }

  function sourceName(){
    const f=g('pi-pdf-file');
    const file=f&&f.files&&f.files[0];
    return file&&file.name ? file.name : '[pasted price list]';
  }

  function buildPrompt(){
    const vendor=(gv('pi-vendor')||'UnknownVendor').trim();
    const wh=warehouseLabel(gv('gpt366-pi-warehouse')||'CN');
    const src=sourceName();
    const txt=gv('pi-text')||'';

    return [
      'You are normalizing a vendor peptide price list for PeptideGenius.',
      'Return ONLY CSV. No markdown, no commentary.',
      '',
      'CRITICAL VENDOR RULE:',
      'Use the Vendor value below EXACTLY in every vendor column. Do not rename it based on text inside the file.',
      'Vendor: '+vendor,
      'Warehouse: '+wh,
      'Source file name: '+src,
      '',
      'TMP vendor price template:',
      'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes',
      '',
      'Required CSV columns:',
      'vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes',
      '',
      'Rules:',
      '- Warehouse must be US, China, or Unknown.',
      '- Default warehouse is China unless the user/app selected US or Unknown above.',
      '- Use the selected Warehouse value exactly for every row.',
      '- Currency should usually be USD unless the file clearly says otherwise.',
      '- price_usd must be numeric only, no $ sign.',
      '- Split dose/strength into strength + unit where possible. Example: 10mg => strength=10, unit=mg.',
      '- quantity should be package quantity if stated, such as 10 vials/kit. If unknown, leave blank.',
      '- min_order should be blank unless the file explicitly states MOQ/minimum order.',
      '- Preserve blends/combos as one product. Example BPC-157/TB-500 stays one row.',
      '- Do not invent products or prices.',
      '- If a line is shipping, payment, discount, note, contact info, or not a product-price row, omit it.',
      '- catalog_name should be a clean canonical product name without vendor SKU when possible.',
      '- product_name should preserve useful vendor-facing detail such as strength/blend if present.',
      '',
      'PRICE LIST TEXT:',
      txt.trim() ? txt.trim() : '[PASTE OR ATTACH PRICE LIST TEXT HERE]'
    ].join('\\n');
  }

  function ensureBox(){
    const step=g('pi-step1');
    if(!step || g('gpt368-vendor-ai-box'))return;

    const box=document.createElement('div');
    box.id='gpt368-vendor-ai-box';
    box.innerHTML='<div class="head"><div><div class="title">A.I. normalization helper</div><div class="sub">Builds the exact PeptideGenius CSV prompt using the selected vendor and warehouse. Copy it into GPT, then paste the normalized CSV back for import.</div></div><div class="actions"><button type="button" class="primary" id="gpt368-build-vendor-prompt">Build prompt</button><button type="button" id="gpt368-copy-vendor-prompt">Copy prompt</button><button type="button" id="gpt368-open-chatgpt">Open GPT</button></div></div><textarea id="gpt368-vendor-ai-prompt" spellcheck="false"></textarea><div id="gpt368-vendor-ai-status"></div>';

    const textWrap=g('pi-text') ? g('pi-text').closest('div') : null;
    if(textWrap && textWrap.parentNode) textWrap.parentNode.insertBefore(box, textWrap);
    else step.insertBefore(box, step.firstChild);

    g('gpt368-build-vendor-prompt').onclick=function(){
      const ta=g('gpt368-vendor-ai-prompt');
      ta.value=buildPrompt();
      ta.style.display='block';
      const st=g('gpt368-vendor-ai-status');
      if(st)st.textContent='Prompt built from current vendor, warehouse, file/text.';
      ta.focus();
    };
    g('gpt368-copy-vendor-prompt').onclick=async function(){
      const ta=g('gpt368-vendor-ai-prompt');
      if(!ta.value){
        ta.value=buildPrompt();
        ta.style.display='block';
      }
      const ok=await copyText(ta.value);
      const st=g('gpt368-vendor-ai-status');
      if(st)st.textContent=ok?'Prompt copied. Paste it into GPT.':'Copy blocked by browser. Select and copy the prompt manually.';
    };
    g('gpt368-open-chatgpt').onclick=function(){
      try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){}
    };
  }

  function bind(){
    ensureBox();
  }

  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#pt-import')){
      setTimeout(bind,150);
      setTimeout(bind,700);
    }
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);
  else bind();

  window.tmpBuildVendorAIPrompt368=buildPrompt;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    Normalized GPT CSV importer.
    Required columns:
      vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes

    Imports to existing price table:
      S.prices[product_name or catalog_name][vendor][warehouseCode] = price_usd
    Does not change old parser.
  */
  const REQUIRED=['vendor','warehouse','product_name','catalog_name','strength','quantity','unit','price_usd','currency','min_order','notes'];
  let parsedRows=[];

  function g(id){return document.getElementById(id)}
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function normWh(v){
    v=String(v||'').trim().toLowerCase();
    if(v==='us'||v==='usa'||v==='u.s.')return 'US';
    if(v==='unknown'||v==='unk')return 'Unknown';
    return 'CN';
  }
  function whLabel(code){
    return code==='US'?'US':(code==='Unknown'?'Unknown':'China');
  }
  function parseCSVLine(line){
    const out=[];
    let cur='', quote=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(quote && line[i+1]==='"'){cur+='"';i++;}
        else quote=!quote;
      }else if(ch===',' && !quote){
        out.push(cur);cur='';
      }else cur+=ch;
    }
    out.push(cur);
    return out.map(x=>x.trim());
  }
  function parseCSV(text){
    const lines=String(text||'').replace(/\r/g,'').split('\n').filter(l=>l.trim());
    if(!lines.length)throw new Error('Paste normalized CSV first.');
    const header=parseCSVLine(lines[0]).map(h=>h.trim().toLowerCase());
    const missing=REQUIRED.filter(c=>!header.includes(c));
    if(missing.length)throw new Error('Missing required column(s): '+missing.join(', '));
    const idx={};header.forEach((h,i)=>idx[h]=i);
    const rows=[];
    for(let i=1;i<lines.length;i++){
      const cells=parseCSVLine(lines[i]);
      const r={};
      REQUIRED.forEach(c=>r[c]=cells[idx[c]]!=null?cells[idx[c]].trim():'');
      if(!r.vendor && !r.product_name && !r.catalog_name)continue;
      const price=Number(String(r.price_usd||'').replace(/[$,\s]/g,''));
      if(!r.vendor)throw new Error('Row '+(i+1)+' missing vendor.');
      if(!r.product_name && !r.catalog_name)throw new Error('Row '+(i+1)+' missing product_name/catalog_name.');
      if(!isFinite(price)||price<=0)throw new Error('Row '+(i+1)+' invalid price_usd.');
      r.price_usd=price;
      r.warehouse_code=normWh(r.warehouse);
      r.import_name=(r.product_name||r.catalog_name).trim();
      rows.push(r);
    }
    if(!rows.length)throw new Error('No valid CSV data rows found.');
    return rows;
  }
  function preview(rows){
    const box=g('gpt369-normalized-preview');
    if(!box)return;
    box.style.display='block';
    box.innerHTML='<table><thead><tr><th>Vendor</th><th>Warehouse</th><th>Product</th><th>Catalog</th><th>Price</th><th>Notes</th></tr></thead><tbody>'+
      rows.slice(0,120).map(r=>'<tr><td>'+esc(r.vendor)+'</td><td>'+esc(whLabel(r.warehouse_code))+'</td><td>'+esc(r.product_name)+'</td><td>'+esc(r.catalog_name)+'</td><td>$'+esc(r.price_usd)+'</td><td>'+esc(r.notes)+'</td></tr>').join('')+
      '</tbody></table>';
  }
  function setStatus(msg,good){
    const el=g('gpt369-normalized-status');
    if(el){el.textContent=msg;el.style.color=good?'#0F766E':'#8A5A38';}
  }
  function importRows(rows){
    if(!window.S)return 0;
    S.prices=S.prices||{};
    S.vendors=S.vendors||[];
    let count=0;
    rows.forEach(r=>{
      const vendor=String(r.vendor||'').trim().toUpperCase();
      const name=r.import_name;
      if(!vendor||!name)return;
      if(!S.vendors.some(v=>String(v||'').toUpperCase()===vendor))S.vendors.push(vendor);
      const canonicalVendor=S.vendors.find(v=>String(v||'').toUpperCase()===vendor)||vendor;
      if(!S.prices[name])S.prices[name]={};
      const current=S.prices[name][canonicalVendor];
      if(current==null || typeof current==='number' || typeof current==='string'){
        S.prices[name][canonicalVendor]={};
      }
      S.prices[name][canonicalVendor][r.warehouse_code]=r.price_usd;
      count++;
    });
    try{window.save&&window.save()}catch(_){}
    try{window.renderPrices&&window.renderPrices()}catch(_){}
    return count;
  }
  function ensureBox(){
    const step=g('pi-step1');
    if(!step || g('gpt369-normalized-csv-box'))return;
    const box=document.createElement('div');
    box.id='gpt369-normalized-csv-box';
    box.innerHTML='<div class="title">Import normalized A.I. CSV</div><div class="sub">After GPT returns the normalized CSV, paste it here to preview and import directly into Vendor Pricing.</div><textarea id="gpt369-normalized-csv" placeholder="vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes"></textarea><div id="gpt369-normalized-actions"><button type="button" id="gpt369-preview-normalized">Preview CSV</button><button type="button" class="primary" id="gpt369-import-normalized">Import normalized CSV</button></div><div id="gpt369-normalized-status"></div><div id="gpt369-normalized-preview"></div>';
    const aiBox=g('gpt368-vendor-ai-box');
    if(aiBox && aiBox.parentNode) aiBox.parentNode.insertBefore(box, aiBox.nextSibling);
    else step.insertBefore(box, step.firstChild);

    g('gpt369-preview-normalized').onclick=function(){
      try{
        parsedRows=parseCSV(g('gpt369-normalized-csv').value);
        preview(parsedRows);
        setStatus('Preview ready: '+parsedRows.length+' row(s).',true);
      }catch(e){setStatus(e.message,false);}
    };
    g('gpt369-import-normalized').onclick=function(){
      try{
        parsedRows=parseCSV(g('gpt369-normalized-csv').value);
        preview(parsedRows);
        const n=importRows(parsedRows);
        setStatus('Imported '+n+' normalized price row(s).',true);
      }catch(e){setStatus(e.message,false);}
    };
  }
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#pt-import')){
      setTimeout(ensureBox,180);
      setTimeout(ensureBox,750);
    }
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureBox);
  else ensureBox();

  window.tmpImportNormalizedVendorCSV369=function(text){
    const rows=parseCSV(text);
    const n=importRows(rows);
    return {rows:rows.length, imported:n};
  };
})();


// ===== extracted post-core patch script =====
(function(){
  const ENDPOINT='/api/gpt-vendor-normalize';
  function g(id){return document.getElementById(id)}
  function gv(id){const el=g(id);return el?el.value:''}
  function warehouseLabel(v){if(v==='US')return 'US'; if(v==='Unknown')return 'Unknown'; return 'China';}
  function sourceName(){
    const f=g('pi-pdf-file'); const file=f&&f.files&&f.files[0];
    return file&&file.name ? file.name : '[pasted price list]';
  }
  function ensureStatus(){
    let s=g('gpt370-api-status');
    const box=g('gpt368-vendor-ai-box') || g('gpt369-normalized-csv-box');
    if(!s && box){s=document.createElement('div');s.id='gpt370-api-status';box.appendChild(s);}
    return s;
  }
  function status(msg,good){const s=ensureStatus(); if(s){s.textContent=msg;s.style.color=good?'#0F766E':'#8A5A38';}}
  function ensureButton(){
    const ai=g('gpt368-vendor-ai-box');
    const actions=ai&&ai.querySelector?ai.querySelector('.actions'):null;
    if(!actions || g('gpt370-api-normalize-vendor'))return;
    const btn=document.createElement('button');
    btn.type='button'; btn.id='gpt370-api-normalize-vendor'; btn.textContent='Normalize with A.I.';
    actions.insertBefore(btn, actions.firstChild);
    btn.onclick=normalizeWithAI;
  }
  async function normalizeWithAI(){
    const vendor=(gv('pi-vendor')||'').trim();
    const wh=warehouseLabel(gv('gpt366-pi-warehouse')||'CN');
    const text=(gv('pi-text')||'').trim();
    if(!vendor){status('Enter or confirm a vendor name first.',false);return;}
    if(!text){status('Paste or upload a price list first.',false);return;}
    const btn=g('gpt370-api-normalize-vendor');
    if(btn){btn.disabled=true;btn.textContent='Normalizing…';}
    status('Calling A.I. normalizer…',false);
    try{
      const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vendor,warehouse:wh,source_file_name:sourceName(),price_list_text:text})});
      let data={}; try{data=await res.json()}catch(_){}
      if(!res.ok || !data.ok) throw new Error(data.error || res.statusText || 'A.I. normalization failed.');
      const csv=String(data.csv||'').trim();
      if(!csv) throw new Error('A.I. returned no CSV.');
      let ta=g('gpt369-normalized-csv');
      if(!ta) throw new Error('Normalized CSV box was not found. Open the importer again.');
      ta.value=csv;
      status('Normalized '+(data.row_count||'')+' row(s). Review preview, then import normalized CSV.',true);
      const previewBtn=g('gpt369-preview-normalized'); if(previewBtn)previewBtn.click();
      ta.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(err){status(err.message||'A.I. normalization failed.',false);}
    finally{if(btn){btn.disabled=false;btn.textContent='Normalize with A.I.';}}
  }
  function bind(){ensureButton();}
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#pt-import')){setTimeout(bind,250);setTimeout(bind,900);}},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind); else bind();
  window.tmpNormalizeVendorWithAI370=normalizeWithAI;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    Adds one-button Normalize + Import:
    1. Calls the existing v33.375-stable-vendor-post-import-review A.I. normalizer.
    2. Waits for normalized CSV to populate.
    3. Runs existing normalized CSV import button.
    Does not change the parser, normalizer function, or storage format.
  */
  function g(id){return document.getElementById(id)}
  function status(msg,good){
    const s=g('gpt370-api-status') || g('gpt369-normalized-status');
    if(s){s.textContent=msg;s.style.color=good?'#0F766E':'#8A5A38';}
  }
  function ensureButton(){
    const aiBox=g('gpt368-vendor-ai-box');
    const actions=aiBox&&aiBox.querySelector?aiBox.querySelector('.actions'):null;
    if(!actions || g('gpt371-api-normalize-import-vendor'))return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.id='gpt371-api-normalize-import-vendor';
    btn.textContent='Normalize + import';
    actions.insertBefore(btn, actions.firstChild);
    btn.onclick=normalizeThenImport;
  }
  async function normalizeThenImport(){
    const btn=g('gpt371-api-normalize-import-vendor');
    if(btn){btn.disabled=true;btn.textContent='Working…';}
    try{
      status('Normalizing with A.I., then importing…',false);
      if(typeof window.tmpNormalizeVendorWithAI370!=='function'){
        throw new Error('A.I. normalizer not found. Reload the page and try again.');
      }
      await window.tmpNormalizeVendorWithAI370();

      // Give the preview/import UI a moment to fill from the normalizer.
      await new Promise(resolve=>setTimeout(resolve,450));

      const csvBox=g('gpt369-normalized-csv');
      if(!csvBox || !csvBox.value.trim()){
        throw new Error('A.I. did not return normalized CSV.');
      }

      const importBtn=g('gpt369-import-normalized');
      if(!importBtn){
        throw new Error('Normalized CSV import button not found.');
      }
      importBtn.click();
      status('Normalized and imported. Review Vendor Pricing table.',true);

      setTimeout(function(){
        try{window.renderPrices&&window.renderPrices();}catch(_){}
      },250);
    }catch(err){
      status(err.message||'Normalize + import failed.',false);
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Normalize + import';}
    }
  }
  function bind(){
    ensureButton();
  }
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#pt-import')){
      setTimeout(bind,300);
      setTimeout(bind,1000);
    }
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);
  else bind();

  window.tmpNormalizeAndImportVendor371=normalizeThenImport;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    Cleans the Vendor Pricing importer workflow:
    Primary: Normalize + import
    Secondary: Normalize with A.I. / old parser
    Advanced: manual GPT prompt
  */
  function g(id){return document.getElementById(id)}
  async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(_){return false}}

  function buildPrompt(){
    if(typeof window.tmpBuildVendorAIPrompt368 === 'function') return window.tmpBuildVendorAIPrompt368();
    const vendor=(g('pi-vendor')&&g('pi-vendor').value)||'UnknownVendor';
    const text=(g('pi-text')&&g('pi-text').value)||'';
    return 'Normalize this PeptideGenius vendor price list as CSV only.\nVendor: '+vendor+'\n\n'+text;
  }

  function ensureManualDrawer(){
    const box=g('gpt368-vendor-ai-box');
    if(!box || g('gpt372-vendor-manual-fallback'))return;

    const note=document.createElement('div');
    note.id='gpt372-vendor-primary-note';
    note.innerHTML='<b>Recommended:</b> use <b>Normalize + import</b>. Use the older parser only if A.I. is unavailable.';
    box.appendChild(note);

    const drawer=document.createElement('details');
    drawer.id='gpt372-vendor-manual-fallback';
    drawer.innerHTML='<summary>Advanced / manual GPT fallback</summary><div class="body">Use this only if the A.I. API normalizer fails. It copies the normalization prompt so you can paste it into GPT manually.<br><button type="button" id="gpt372-copy-vendor-manual">Copy normalization prompt</button><button type="button" id="gpt372-open-chatgpt">Open GPT</button></div>';
    box.appendChild(drawer);

    g('gpt372-copy-vendor-manual').onclick=async function(){
      const ok=await copyText(buildPrompt());
      const s=g('gpt370-api-status')||g('gpt368-vendor-ai-status');
      if(s)s.textContent=ok?'Manual prompt copied. Paste it into GPT.':'Copy blocked. Use Build prompt and copy manually.';
    };
    g('gpt372-open-chatgpt').onclick=function(){
      try{window.open('https://chatgpt.com/','_blank','noopener,noreferrer')}catch(_){}
    };
  }

  function polish(){
    const title=document.querySelector('#gpt368-vendor-ai-box .title');
    if(title) title.textContent='A.I. price-list normalizer';

    const sub=document.querySelector('#gpt368-vendor-ai-box .sub');
    if(sub) sub.textContent='Recommended path: confirm vendor and warehouse, then let A.I. normalize and import the price list. Review the table after import.';

    const importBtn=g('gpt371-api-normalize-import-vendor');
    if(importBtn) importBtn.textContent='Normalize + import';

    const normBtn=g('gpt370-api-normalize-vendor');
    if(normBtn) normBtn.textContent='Preview normalized CSV';

    const parseBtn=g('pi-parse');
    if(parseBtn) parseBtn.textContent='Legacy parser preview →';

    ensureManualDrawer();
  }

  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#pt-import')){
      setTimeout(polish,250);
      setTimeout(polish,900);
    }
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',polish);
  else polish();

  __tmpPgInterval(polish, 2500, 'pg-prices');
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    Adds direct file reading for:
    - CSV
    - TXT/TSV
    - XLS/XLSX via lazy SheetJS CDN
    PDF remains handled by existing PDF.js logic.

    Output is placed into #pi-text so the current A.I. normalizer flow can use it.
    No parser/import/storage/API/nav/Daily Stack/calendar/cache/chart changes.
  */
  let xlsxPromise=null;

  function g(id){return document.getElementById(id)}
  function sv(id,v){const el=g(id);if(el)el.value=v}
  function extOf(file){
    return String(file && file.name || '').split('.').pop().toLowerCase();
  }
  function setStatus(msg, good){
    const s=g('pi-pdf-status');
    if(s){
      s.style.color = good ? '#065F46' : 'var(--color-text-secondary)';
      s.textContent = msg;
    }
  }
  function setError(msg){
    const s=g('pi-pdf-status');
    if(s){
      s.style.color = '#A32D2D';
      s.textContent = msg;
    }
  }
  function ensureHelp(){
    const input=g('pi-pdf-file');
    if(!input || g('gpt373-file-help'))return;
    const host=input.closest('div')?.parentNode || input.parentNode;
    const help=document.createElement('div');
    help.id='gpt373-file-help';
    help.innerHTML='<b>Supported:</b> PDF, CSV, TXT/TSV, XLS, XLSX. Spreadsheet files are converted into tab-separated text before A.I. normalization.';
    host.appendChild(help);
  }
  function patchInput(){
    const input=g('pi-pdf-file');
    if(!input)return;
    input.setAttribute('accept','application/pdf,.pdf,.csv,.txt,.tsv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const label=document.querySelector('label[for="pi-pdf-file"]');
    if(label){
      label.innerHTML='Upload a price list file <span style="font-weight:400;color:var(--color-text-tertiary);font-size:11px">(PDF, CSV, TXT, XLS, XLSX)</span>';
    }
    ensureHelp();
  }
  function loadXLSX(){
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      if(window.XLSX){resolve(window.XLSX);return;}
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('XLSX library loaded but was unavailable.'));
      s.onerror=()=>reject(new Error('Failed to load spreadsheet reader.'));
      document.head.appendChild(s);
    });
    return xlsxPromise;
  }
  async function readSpreadsheet(file){
    const XLSX=await loadXLSX();
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const sections=[];
    wb.SheetNames.forEach(name=>{
      const ws=wb.Sheets[name];
      const txt=XLSX.utils.sheet_to_csv(ws,{FS:'\t',RS:'\n',blankrows:false});
      if(txt.trim()){
        sections.push('### Sheet: '+name+'\n'+txt.trim());
      }
    });
    return sections.join('\n\n');
  }
  async function handleNonPdf(file, event){
    const ext=extOf(file);
    if(ext==='pdf')return false; // let native PDF reader handle it

    if(event){
      event.preventDefault();
      event.stopPropagation();
      if(event.stopImmediatePropagation)event.stopImmediatePropagation();
    }

    try{
      const clear=g('pi-pdf-clear');
      if(clear)clear.style.display='';
      setStatus('Reading '+file.name+'…', false);

      let text='';
      if(['csv','txt','tsv'].includes(ext) || /^text\//i.test(file.type||'')){
        text=await file.text();
      }else if(['xls','xlsx'].includes(ext) || /spreadsheet|excel/i.test(file.type||'')){
        setStatus('Loading spreadsheet reader…', false);
        text=await readSpreadsheet(file);
      }else{
        setError('Unsupported file type. Use PDF, CSV, TXT, XLS, or XLSX.');
        return true;
      }

      if(!text || !text.trim()){
        setError('No readable text found in '+file.name+'.');
        return true;
      }

      sv('pi-text', text);
      setStatus('✓ Loaded '+text.split(/\r?\n/).length+' line(s) from '+file.name+'. Confirm vendor/warehouse, then normalize.', true);

      // Trigger existing vendor/warehouse guess helper if present.
      try{
        if(typeof window.tmpVendorGuessUI366 === 'function') window.tmpVendorGuessUI366();
      }catch(_){}

      try{
        const txt=g('pi-text');
        if(txt)txt.dispatchEvent(new Event('input',{bubbles:true}));
      }catch(_){}
    }catch(err){
      console.error(err);
      setError('✕ '+(err.message || 'Failed to read file.'));
    }
    return true;
  }

  // Capture file changes before the native PDF-only listener rejects XLS/CSV.
  document.addEventListener('change',function(e){
    const input=e.target && e.target.id==='pi-pdf-file' ? e.target : null;
    if(!input)return;
    const file=input.files && input.files[0];
    if(!file)return;
    const ext=extOf(file);
    if(ext !== 'pdf'){
      handleNonPdf(file,e);
    }
  },true);

  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#pt-import')){
      setTimeout(patchInput,150);
      setTimeout(patchInput,700);
    }
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchInput);
  else patchInput();

  window.tmpVendorReadPriceFile373=handleNonPdf;
})();


// ===== extracted post-core patch script =====
(function(){
  /*
    Adds image-file support to the Vendor Pricing A.I. normalizer.
    - JPG/PNG/WEBP/GIF are previewed, not OCR'd locally.
    - Image data URL is sent to the existing Netlify normalizer endpoint.
    - The endpoint update in this bundle reads image_data_url.
    - No old parser/storage/nav/Daily Stack/calendar/cache/chart changes.
  */
  window.tmpVendorImagePriceList374 = null;

  function g(id){return document.getElementById(id)}
  function gv(id){const el=g(id);return el?el.value:''}

  function isImage(file){
    const name=String(file&&file.name||'').toLowerCase();
    return /^image\//i.test(file&&file.type||'') || /\.(png|jpe?g|webp|gif)$/i.test(name);
  }

  function patchInput(){
    const input=g('pi-pdf-file');
    if(!input)return;
    input.setAttribute('accept','application/pdf,.pdf,.csv,.txt,.tsv,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,image/*,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const label=document.querySelector('label[for="pi-pdf-file"]');
    if(label){
      label.innerHTML='Upload a price list file <span style="font-weight:400;color:var(--color-text-tertiary);font-size:11px">(PDF, CSV, TXT, XLS/XLSX, JPG/PNG/WEBP)</span>';
    }

    const host=input.closest('div')?.parentNode || input.parentNode;
    if(host && !g('gpt374-image-note')){
      const note=document.createElement('div');
      note.id='gpt374-image-note';
      note.innerHTML='<b>Image files:</b> screenshots/photos are sent to A.I. for reading. Text box can stay blank, but vendor and warehouse should be confirmed.';
      host.appendChild(note);

      const img=document.createElement('img');
      img.id='gpt374-image-preview';
      img.alt='Uploaded price list image preview';
      host.appendChild(img);
    }
  }

  async function readImage(file,e){
    if(e){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation)e.stopImmediatePropagation();
    }

    const status=g('pi-pdf-status');
    const clear=g('pi-pdf-clear');
    const preview=g('gpt374-image-preview');

    try{
      if(clear)clear.style.display='';
      if(status){
        status.style.color='var(--color-text-secondary)';
        status.textContent='Reading image preview…';
      }

      const dataUrl=await new Promise((resolve,reject)=>{
        const r=new FileReader();
        r.onload=()=>resolve(String(r.result||''));
        r.onerror=()=>reject(new Error('Failed to read image file.'));
        r.readAsDataURL(file);
      });

      window.tmpVendorImagePriceList374 = {
        name:file.name || 'price-list-image',
        type:file.type || 'image',
        data_url:dataUrl
      };

      if(preview){
        preview.src=dataUrl;
        preview.style.display='block';
      }

      // Give the text box a lightweight marker so existing UI knows a source is present.
      const txt=g('pi-text');
      if(txt && !txt.value.trim()){
        txt.value='[Image price list attached: '+(file.name||'image')+']';
      }

      if(status){
        status.style.color='#065F46';
        status.textContent='✓ Image attached for A.I. normalization: '+(file.name||'image')+'. Confirm vendor/warehouse, then click Normalize + import.';
      }

      try{
        if(typeof window.tmpVendorGuessUI366==='function')window.tmpVendorGuessUI366();
      }catch(_){}
    }catch(err){
      console.error(err);
      if(status){
        status.style.color='#A32D2D';
        status.textContent='✕ '+(err.message||'Failed to read image.');
      }
    }
  }

  // Capture image uploads before native PDF reader rejects them.
  document.addEventListener('change',function(e){
    const input=e.target && e.target.id==='pi-pdf-file' ? e.target : null;
    if(!input)return;
    const file=input.files && input.files[0];
    if(!file)return;
    if(isImage(file)){
      readImage(file,e);
    }else{
      window.tmpVendorImagePriceList374=null;
      const preview=g('gpt374-image-preview');
      if(preview){preview.style.display='none';preview.removeAttribute('src');}
    }
  },true);

  // Patch the existing Normalize with A.I. fetch payload by wrapping fetch for this endpoint only.
  if(!window.__gpt374VendorFetchWrapped){
    const oldFetch=window.fetch;
    window.fetch=function(input, init){
      try{
        const url=typeof input==='string'?input:(input&&input.url)||'';
        if(String(url).includes('/api/gpt-vendor-normalize') && init && init.body && window.tmpVendorImagePriceList374){
          const body=JSON.parse(init.body);
          body.image_data_url=window.tmpVendorImagePriceList374.data_url;
          body.image_file_name=window.tmpVendorImagePriceList374.name;
          // Preserve text if real text exists; strip marker-only placeholder.
          if(String(body.price_list_text||'').match(/^\[Image price list attached:/)){
            body.price_list_text='';
          }
          init=Object.assign({},init,{body:JSON.stringify(body)});
        }
      }catch(_){}
      return oldFetch.apply(this,arguments.length? [input,init] : arguments);
    };
    window.__gpt374VendorFetchWrapped=true;
  }

  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#pt-import')){
      setTimeout(patchInput,200);
      setTimeout(patchInput,900);
    }
    if(e.target&&e.target.closest&&e.target.closest('#pi-pdf-clear')){
      window.tmpVendorImagePriceList374=null;
      const preview=g('gpt374-image-preview');
      if(preview){preview.style.display='none';preview.removeAttribute('src');}
    }
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchInput);
  else patchInput();
})();


// ===== extracted post-core patch script =====
(function(){
  if(__tmpVendorLogActive())return;
  /*
    Vendor Pricing post-import review:
    - Detects normalized CSV import success.
    - Closes the importer modal.
    - Shows a review panel above the pricing table.
    - Scrolls user back to the pricing table.
    Does not change normalization/parser/storage logic.
  */
  function g(id){return document.getElementById(id)}
  function pricePage(){return g('pg-prices')}
  function closeImporter(){
    const m=g('pi-modal');
    if(m)m.style.display='none';
  }
  function ensurePanel(){
    const pg=pricePage();
    if(!pg || g('gpt375-vendor-import-review'))return;
    const panel=document.createElement('div');
    panel.id='gpt375-vendor-import-review';
    panel.innerHTML='<b>Vendor prices imported</b><span>Review the Vendor Pricing table below. Use the warehouse filters to confirm US / China placement and scan for duplicate product rows.</span><br><button type="button" class="primary" id="gpt375-review-prices">Review table</button><button type="button" id="gpt375-open-cleanup">Cleanup suspicious rows</button>';
    const first=pg.querySelector('.card') || pg.firstElementChild;
    if(first && first.parentNode===pg)pg.insertBefore(panel, first);
    else pg.insertBefore(panel, pg.firstChild);

    g('gpt375-review-prices').onclick=function(){
      const table=pg.querySelector('.pw,.pt2,#pt-body');
      try{(table||pg).scrollIntoView({behavior:'smooth',block:'start'})}catch(_){}
    };
    g('gpt375-open-cleanup').onclick=function(){
      const b=g('pt-cleanup');
      if(b)b.click();
    };
  }
  function showPanel(message){
    ensurePanel();
    const p=g('gpt375-vendor-import-review');
    if(!p)return;
    const span=p.querySelector('span');
    if(span && message)span.textContent=message;
    p.style.display='block';
  }
  function reviewAfterImport(){
    closeImporter();
    try{window.renderPrices&&window.renderPrices()}catch(_){}
    showPanel('Review the Vendor Pricing table below. Confirm vendor column, warehouse placement, and product row names.');
    setTimeout(function(){
      const p=g('gpt375-vendor-import-review')||pricePage();
      try{p.scrollIntoView({behavior:'smooth',block:'start'})}catch(_){}
    },120);
  }
  document.addEventListener('click',function(e){
    if(!(e.target&&e.target.closest))return;
    if(e.target.closest('#gpt369-import-normalized,#gpt371-api-normalize-import-vendor')){
      setTimeout(reviewAfterImport,850);
      setTimeout(reviewAfterImport,1800);
    }
    if(e.target.closest('[data-pg="prices"],#pt-import')){
      setTimeout(ensurePanel,250);
    }
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensurePanel);
  else ensurePanel();

  window.tmpVendorPostImportReview375=reviewAfterImport;
})();


// ===== calendar clear final enforcement (runs after all other postload patches) =====
(function(){
  const G = window.tmpCalClearGuard;
  const CAL_UNDO_KEY = 'tmp.undo.tmp-clear-cal';

  // Never allow calendar-clear undo snapshots — they restore the full pre-clear calendar.
  if(!window.__tmpCalClearUndoBlockHook){
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k, v){
      if(k === CAL_UNDO_KEY) return;
      return origSetItem(k, v);
    };
    window.__tmpCalClearUndoBlockHook = true;
  }
  try { localStorage.removeItem(CAL_UNDO_KEY); } catch(_){}
  function neuterCalUndoOpts(){
    try {
      const o = window._tmpUndoOpts && window._tmpUndoOpts['tmp-clear-cal'];
      if(!o || o.__calClearNoUndo) return;
      o.snapshot = null;
      o.restore = function(){};
      o.__calClearNoUndo = true;
    } catch(_){}
  }
  neuterCalUndoOpts();
  __tmpPgInterval(neuterCalUndoOpts, 800, 'pg-calendar');

  if(!G) return;

  function enforce(){
    try {
      const pg=document.querySelector('#nav button.on, .hdr-tab-btn.on');
      if(pg&&pg.dataset.pg==='packages') return;
      G.enforce();
    } catch(_){}
  }

  // Block legacy stack-plan → S.sched sync while calendar clear guard is active.
  if(typeof window.syncPlanToLegacy !== 'function'){
    window.syncPlanToLegacy = function(){};
  }
  if(!window.syncPlanToLegacy.__calClearFinalHook){
    const origGlobalSync = window.syncPlanToLegacy;
    window.syncPlanToLegacy = function(plan){
      if(G.isActive()) return;
      return origGlobalSync.apply(this, arguments);
    };
    window.syncPlanToLegacy.__calClearFinalHook = true;
  }

  // While guard is active, hide persisted stack plan from all getPlan() readers.
  if(!window.__tmpStackPlanGetItemHook){
    const PLAN_KEY = 'tmp.stackPlan.v1';
    const origGetItem = localStorage.getItem.bind(localStorage);
    localStorage.getItem = function(k){
      if(k === PLAN_KEY && G.isActive()) return '[]';
      return origGetItem(k);
    };
    window.__tmpStackPlanGetItemHook = true;
  }

  if(typeof window.intervalOverlaysForWeek === 'function' && !window.intervalOverlaysForWeek.__calClearFinalHook){
    const origOverlays = window.intervalOverlaysForWeek;
    window.intervalOverlaysForWeek = function(w,t){
      if(G.isActive()) return [];
      return origOverlays.apply(this, arguments);
    };
    window.intervalOverlaysForWeek.__calClearFinalHook = true;
  }

  function hookFinal(){
    // Save-chain merge: pre-flush hook instead of wrapping window.save.
    (window.__tmpSavePre=window.__tmpSavePre||[]).push(enforce);
  }
  hookFinal();

  function patchStackPlan(){
    const t = window.tmpStackPlan;
    if(!t || t.__calClearFinalHook) return;
    const origGet = t.get, origSync = t.sync, origRender = t.render, origSave = t.save;
    if(typeof origGet === 'function'){
      t.get = function(){
        return G.planForCalendar(origGet.apply(this, arguments));
      };
    }
    if(typeof origSync === 'function'){
      t.sync = function(){
        if(G.isActive()) return;
        return origSync.apply(this, arguments);
      };
    }
    if(typeof origRender === 'function'){
      t.render = function(){
        if(G.isActive()) return false;
        return origRender.apply(this, arguments);
      };
    }
    if(typeof origSave === 'function'){
      t.save = function(plan){
        if(G.isActive()) return origSave.call(this, []);
        return origSave.apply(this, arguments);
      };
    }
    t.__calClearFinalHook = true;
  }
  patchStackPlan();
  __tmpPgInterval(patchStackPlan, 800, 'pg-calendar');

  [0, 50, 300, 1000].forEach(function(ms){
    setTimeout(function(){
      try { G.enforce(); } catch(_){}
    }, ms);
  });

  document.addEventListener('DOMContentLoaded', function(){
    try { G.enforce(); } catch(_){}
    try { if(typeof renderCal === 'function') renderCal({ force: true }); } catch(_){}
    try { if(typeof window.__tmpFixMojibakeDom === 'function') window.__tmpFixMojibakeDom(); } catch(_){}
  });
})();

// Calendar day-header focus → shot log / edit date boxes (postload fallback for stale core cache).
(function(){
  if(window.__tmpCalDateFocusPostInstalled) return;
  window.__tmpCalDateFocusPostInstalled = true;
  window.__tmpCalFocusVersion = 'p7';

  function isoFromShdc(hdr){
    if(!hdr) return '';
    if(hdr.dataset && hdr.dataset.date) return hdr.dataset.date;
    var shdr = hdr.closest && hdr.closest('.shdr');
    if(!shdr || typeof wkD !== 'function' || typeof fmD !== 'function' || !window.S) return '';
    var cols = Array.prototype.slice.call(shdr.querySelectorAll('.shdc'));
    var idx = cols.indexOf(hdr);
    if(idx < 0) return '';
    var days = wkD(S.wkOff || 0);
    return (days[idx] && fmD(days[idx])) || '';
  }

  function stampHeaderDates(){
    if(typeof wkD !== 'function' || typeof fmD !== 'function' || !window.S) return;
    var days = wkD(S.wkOff || 0);
    ['cal-breakfast-hdr','cal-lunch-hdr','cal-dinner-hdr','cal-bedtime-hdr'].forEach(function(id){
      var hdr = document.getElementById(id);
      if(!hdr) return;
      var cells = hdr.querySelectorAll('.shdc');
      for(var i = 0; i < cells.length && i < 7; i++){
        if(days[i]) cells[i].dataset.date = fmD(days[i]);
      }
    });
    removeWeekFocusRow();
  }

  function removeWeekFocusRow(){
    var row = document.getElementById('cal-day-focus-row');
    if(row) row.remove();
  }

  function onCalHeaderPick(iso, opts){
    if(!iso) return;
    opts = opts || {};
    if(typeof window.setFocusDate === 'function') window.setFocusDate(iso);
    else if(typeof window.applyFocusDateToForms === 'function') window.applyFocusDateToForms(iso);
    if(opts.navigateLog === true){
      try{ if(typeof window.goToShotLogPage === 'function') window.goToShotLogPage(); }catch(_){}
    }
  }

  function isoFromCalTarget(el){
    if(!el) return '';
    if(el.dataset && el.dataset.date) return el.dataset.date;
    return isoFromShdc(el);
  }

  document.addEventListener('click', function(e){
    var pg = document.getElementById('pg-calendar');
    if(!pg || pg.style.display === 'none') return;
    var pick = e.target && e.target.closest && e.target.closest('.shdc, .sc[data-date], .cal-day-pick[data-date]');
    if(!pick || !pg.contains(pick)) return;
    var iso = isoFromCalTarget(pick);
    if(!iso) return;
    if(pick.classList && pick.classList.contains('sc') && pick.classList.contains('active')){
      if(typeof window.setFocusDate === 'function') window.setFocusDate(iso);
      else if(typeof window.applyFocusDateToForms === 'function') window.applyFocusDateToForms(iso);
      return;
    }
    e.preventDefault();
    onCalHeaderPick(iso, { navigateLog: false });
  }, true);

  var coreSetFocus = window.setFocusDate;
  if(typeof coreSetFocus === 'function' && !coreSetFocus.__tmpToastWrapped){
    window.setFocusDate = function(iso){
      coreSetFocus.call(window, iso);
      try{
        var norm = typeof normalizeIsoDate === 'function' ? normalizeIsoDate(iso) : iso;
        if(norm && typeof window.tmpInventoryToast === 'function'){
          var label = norm;
          try{
            var d = new Date(norm + 'T12:00:00');
            if(!isNaN(d.getTime())) label = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
          }catch(_){}
          window.tmpInventoryToast('📅 ' + label + ' → Shot Log date');
        }
      }catch(_){}
    };
    window.setFocusDate.__tmpToastWrapped = true;
  }

  function wireNavFocusSync(){
    document.querySelectorAll('#nav button[data-pg="log"], .hdr-tab-btn[data-pg="log"]').forEach(function(btn){
      if(btn._calFocusNavWired) return;
      btn._calFocusNavWired = true;
      btn.addEventListener('click', function(){
        setTimeout(function(){
          try{
            var fd = typeof readFocusDate === 'function' ? readFocusDate() : '';
            if(fd && typeof applyFocusDateToForms === 'function') applyFocusDateToForms(fd);
          }catch(_){}
        }, 60);
      });
    });
  }

  if(typeof __tmpRegisterRenderCalPost === 'function') __tmpRegisterRenderCalPost(stampHeaderDates);

  var oldAct = window.__tmpActivatePage;
  if(typeof oldAct === 'function' && !oldAct.__calFocusWrapped){
    window.__tmpActivatePage = function(pg, opts){
      var r = oldAct.apply(this, arguments);
      try{
        if(pg === 'log'){
          var fd = typeof readFocusDate === 'function' ? readFocusDate() : '';
          if(fd && typeof applyFocusDateToForms === 'function') applyFocusDateToForms(fd);
        }
      }catch(_){}
      return r;
    };
    window.__tmpActivatePage.__calFocusWrapped = true;
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      stampHeaderDates();
      wireNavFocusSync();
    });
  } else {
    setTimeout(function(){ stampHeaderDates(); wireNavFocusSync(); }, 0);
  }
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('#nav [data-pg="log"], .hdr-tab-btn[data-pg="log"]')) wireNavFocusSync();
  }, true);
})();

__tmpInstallUnifiedRenderCalHook();

// Patch: disable day-header tap-to-navigate behavior.
// core.js previously set a focus date and jumped to the Shot Log page when a
// calendar day header was clicked. That handler has been removed from core.js.
// Also clear any focus date that may be lingering in localStorage from a prior
// session, so the blue shdc-focused highlight disappears on next render.
(function(){
  try{ localStorage.removeItem('tmp.focusDate'); }catch(_){}
  try{ if(typeof window._tmpFocusDate !== 'undefined') window._tmpFocusDate = null; }catch(_){}
})();







// ===== TC-DUPE-MIGRATE-R1: one-shot data migration =====
// Two duplicate inventory rows ("TC200 old" with no id, and an archived
// "TC250") kept being resurrected by stale open tabs flushing old in-memory
// state on visibilitychange. Running the cleanup at load time in every tab
// makes the fleet converge no matter which tab's save wins. Shots logged
// under the dupe names are merged into the canonical items first, so no
// history is lost. Safe to run repeatedly; remove this block once all
// devices have loaded the app at least once on this version.
(function(){
  function run(){
    try{
      if(!window.S || !Array.isArray(S.inv)) return;
      let changed=false;
      (S.shots||[]).forEach(function(s){
        if(!s) return;
        if(s.peptide==='TC200 old'){ s.peptide='TC 200 (old)'; changed=true; }
        else if(s.peptide==='TC250'){ s.peptide='TC 250'; changed=true; }
      });
      const before=S.inv.length;
      S.inv=S.inv.filter(function(i){
        if(!i) return true;
        if(i.name==='TC200 old' && i.id==null) return false;
        if(i.name==='TC250' && i.archived) return false;
        return true;
      });
      if(S.inv.length!==before) changed=true;
      if(changed){
        try{ typeof saveNow==='function' ? saveNow() : (typeof save==='function' && save()); }catch(_){}
        try{ typeof renderCal==='function' && renderCal(); }catch(_){}
      }
    }catch(_){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(run,1200); });
  else setTimeout(run,1200);
  setTimeout(run,4500); // second pass after late state hydration
})();


// ===== Reset Daily Stack (schedule only — never touch inventory stock) =====
(function(){
  function toast(a,b){ try{ if(window.tmpInventoryToast) tmpInventoryToast(a,b||''); }catch(_){ console.log(a,b||''); } }

  function cloneInvSnapshot(){
    try {
      return {
        inv: JSON.parse(JSON.stringify(S.inv || [])),
        vials: JSON.parse(JSON.stringify(S.vials || [])),
        shots: JSON.parse(JSON.stringify(S.shots || [])),
        nI: S.nI, nV: S.nV, nS: S.nS
      };
    } catch(_){
      return { inv:(S.inv||[]).slice(), vials:(S.vials||[]).slice(), shots:(S.shots||[]).slice(), nI:S.nI, nV:S.nV, nS:S.nS };
    }
  }

  function restoreInvSnapshot(snap){
    if(!snap || !window.S) return;
    if(Array.isArray(snap.inv)) S.inv = snap.inv;
    if(Array.isArray(snap.vials)) S.vials = snap.vials;
    if(Array.isArray(snap.shots)) S.shots = snap.shots;
    if(snap.nI != null) S.nI = snap.nI;
    if(snap.nV != null) S.nV = snap.nV;
    if(snap.nS != null) S.nS = snap.nS;
  }

  // Clear schedule keys only. Do NOT call hardResetSched / defineProperty,
  // and never replace S.inv / S.vials.
  function clearSchedKeysOnly(){
    if(!window.S) return 0;
    S.sched = S.sched || {};
    let n = 0;
    window._tmpBypassCalEnforce = true;
    try {
      Object.keys(S.sched).forEach(k => {
        try { delete S.sched[k]; n++; } catch(_){}
      });
      // Also drop meal-lane aliases that may linger as own props
      const lanes = ['am','pm','breakfast','lunch','dinner','bedtime'];
      (S.inv || []).forEach(it => {
        if(!it || !it.name || it.isSupply) return;
        for(let d=0; d<7; d++){
          lanes.forEach(l => {
            const k = it.name + '/' + l + '/' + d;
            if(k in (S.sched||{})){ try { delete S.sched[k]; n++; } catch(_){ } }
          });
        }
      });
    } finally {
      window._tmpBypassCalEnforce = false;
    }
    return n;
  }

  function resetDailyStackToCalendarInventory(){
    if(!window.S) return { clearedSched:0, clearedIntervals:0, clearedDays:0, inventoryGuarded:true };

    const beforePep = (S.inv||[]).filter(i=>i&&!i.isSupply).length;
    const beforeVials = (S.vials||[]).length;
    const snap = cloneInvSnapshot();

    let clearedSched = 0, clearedIntervals = 0, clearedDays = 0;
    try {
      clearedSched = Object.keys(S.sched || {}).filter(k => !!S.sched[k]).length;
    } catch(_){}

    clearedSched = Math.max(clearedSched, clearSchedKeysOnly());

    try {
      S.stackPlan = [];
      localStorage.setItem('tmp.stackPlan.v1', '[]');
    } catch(_){}

    // Clear schedule-related flags on inv items only — never delete rows or stock.
    (S.inv || []).forEach(i => {
      if(!i || i.isSupply) return;
      if(i.interval > 0){ i.interval = 0; clearedIntervals++; }
      if(Array.isArray(i.days) && i.days.length){ i.days = []; clearedDays++; }
      try { delete i.stackLane; } catch(_){ i.stackLane = ''; }
    });

    try {
      if(window.tmpCalClearGuard){
        tmpCalClearGuard.mark();
        tmpCalClearGuard.resetAllowed();
      }
    } catch(_){}

    // Safety net: if anything nuked inventory, put it back immediately.
    const afterPep = (S.inv||[]).filter(i=>i&&!i.isSupply).length;
    const afterVials = (S.vials||[]).length;
    if(afterPep < beforePep || afterVials < beforeVials || afterPep === 0 && beforePep > 0){
      restoreInvSnapshot(snap);
      try { toast('⚠ Inventory protected', 'Schedule cleared; inventory was restored from a safety snapshot.'); } catch(_){}
    }

    try { if(typeof save === 'function') save(); } catch(_){}
    try { if(typeof rebuildCM === 'function') rebuildCM(); } catch(_){}
    try { if(typeof renderStack === 'function') renderStack(); } catch(_){}
    try { if(typeof renderCal === 'function') renderCal({force:true}); } catch(_){}
    try { if(typeof renderInventoryPage === 'function') renderInventoryPage(); } catch(_){}
    try { if(window.gptRenderDailyElite) gptRenderDailyElite(); } catch(_){}

    return {
      clearedSched, clearedIntervals, clearedDays,
      inventoryGuarded:true,
      invBefore: beforePep, invAfter: (S.inv||[]).filter(i=>i&&!i.isSupply).length,
      vialsBefore: beforeVials, vialsAfter: (S.vials||[]).length
    };
  }
  window.tmpResetDailyStackToCalendarInventory = resetDailyStackToCalendarInventory;

  function bestBackupMeta(){
    const slots = ['tmp.backup.0','tmp.backup.1','tmp.backup.2'];
    let best = null;
    slots.forEach(k => {
      try {
        const meta = JSON.parse(localStorage.getItem(k) || 'null');
        if(!meta || !meta.payload) return;
        const p = typeof meta.payload === 'string' ? JSON.parse(meta.payload) : meta.payload;
        const invPep = (p.inv||[]).filter(i=>i&&!i.isSupply).length;
        const vials = (p.vials||[]).length;
        const score = invPep * 1000 + vials + ((p.shots||[]).length || 0);
        if(!best || score > best.score || (score === best.score && meta.ts > best.ts)){
          best = { key:k, ts:meta.ts, score, invPep, vials, shots:(p.shots||[]).length, payload:meta.payload, parsed:p };
        }
      } catch(_){}
    });
    return best;
  }

  // Restore inventory/vials/shots from auto-backup. Does NOT require empty state.
  // Keeps current schedule unless restoreSched=true.
  function restoreInventoryFromBackup(opts){
    opts = opts || {};
    const b = bestBackupMeta();
    if(!b || !b.parsed) return { ok:false, reason:'no-backup' };
    const p = b.parsed;
    if(Array.isArray(p.inv)) S.inv = p.inv;
    if(Array.isArray(p.vials)) S.vials = p.vials;
    // SHOT-PERSIST-R1: merge shots — never replace a fuller live log with an older backup.
    if(Array.isArray(p.shots)){
      S.shots = (typeof mergeShotArrays === 'function')
        ? mergeShotArrays(S.shots, p.shots)
        : p.shots;
    }
    if(p.nI != null) S.nI = p.nI;
    if(p.nV != null) S.nV = p.nV;
    if(p.nS != null && (!S.nS || Number(p.nS) > Number(S.nS))) S.nS = p.nS;
    if(opts.restoreSched && p.sched && typeof p.sched === 'object'){
      window._tmpBypassCalEnforce = true;
      try {
        S.sched = JSON.parse(JSON.stringify(p.sched));
        try { if(window.tmpCalClearGuard) tmpCalClearGuard.clear(); } catch(_){}
      } finally {
        window._tmpBypassCalEnforce = false;
      }
    }
    try { if(typeof save === 'function') save(); } catch(_){}
    try { if(typeof rebuildCM === 'function') rebuildCM(); } catch(_){}
    try { if(typeof renderInventoryPage === 'function') renderInventoryPage(); } catch(_){}
    try { if(typeof renderStack === 'function') renderStack(); } catch(_){}
    try { if(typeof renderCal === 'function') renderCal({force:true}); } catch(_){}
    try { if(typeof renderInv === 'function') renderInv(true); } catch(_){}
    return {
      ok:true, from:b.key, invPep:b.invPep, vials:b.vials, shots:b.shots,
      liveInv:(S.inv||[]).filter(i=>i&&!i.isSupply).length,
      liveVials:(S.vials||[]).length
    };
  }
  window.tmpRestoreInventoryFromBackup = restoreInventoryFromBackup;

  function hookStackEnforce(){
    const old = window.renderStack;
    if(typeof old !== 'function' || old.__tmpStackClearGuardWrapped) return;
    window.renderStack = function(){
      try {
        if(window.tmpCalClearGuard && tmpCalClearGuard.isActive() && !window._tmpBypassCalEnforce){
          tmpCalClearGuard.enforceLight();
        }
      } catch(_){}
      return old.apply(this, arguments);
    };
    window.renderStack.__tmpStackClearGuardWrapped = true;
  }

  function wire(){
    hookStackEnforce();
    const btn = document.getElementById('tmp-reset-daily-stack');
    if(btn && btn.dataset.wiredSafe !== '1'){
      btn.dataset.wiredSafe = '1';
      btn.dataset.wiredHard = '1';
      btn.dataset.wired = '1';
      btn.title = 'Clear Daily Stack + Weekly Calendar schedule only. Inventory peptides and vials are kept.';
      btn.textContent = '↺ Clear schedule only';
      btn.addEventListener('click', function(){
        const ok = confirm(
          'Clear Daily Stack and Weekly Calendar schedule?\n\n'+
          '• Removes scheduled doses from Morning/Evening and the calendar\n'+
          '• Clears interval flags and leftover stack-day marks\n\n'+
          'Inventory peptides, vials, and stock counts are NOT deleted.'
        );
        if(!ok) return;
        const r = resetDailyStackToCalendarInventory();
        const parts = [];
        if(r.clearedSched) parts.push(r.clearedSched + ' schedule slot' + (r.clearedSched===1?'':'s'));
        if(r.clearedIntervals) parts.push(r.clearedIntervals + ' interval' + (r.clearedIntervals===1?'':'s'));
        toast(
          '✓ Schedule cleared',
          (parts.length ? parts.join(' · ') + ' · ' : '') +
          'Inventory safe (' + (r.invAfter||0) + ' peptides · ' + (r.vialsAfter||0) + ' vials)'
        );
      });
    }

    const restoreBtn = document.getElementById('tmp-restore-inv-backup');
    if(restoreBtn && restoreBtn.dataset.wired !== '1'){
      restoreBtn.dataset.wired = '1';
      restoreBtn.addEventListener('click', function(){
        const b = bestBackupMeta();
        if(!b){
          toast('No backup found', 'No automatic backup slots available in this browser.');
          return;
        }
        const ok = confirm(
          'Restore FULL backup (inventory + vials + shots + schedule)?\n\n'+
          'Backup: ' + b.invPep + ' peptides · ' + b.vials + ' vials · ' + b.shots + ' shots\n'+
          'Saved: ' + (b.ts ? new Date(b.ts).toLocaleString() : 'unknown') + '\n\n'+
          'This replaces current inventory and schedule from the automatic backup.'
        );
        if(!ok) return;
        const r = restoreInventoryFromBackup({ restoreSched:true });
        if(!r.ok){
          toast('Restore failed', r.reason || 'unknown');
          return;
        }
        toast('✓ Backup restored', r.liveInv + ' peptides · ' + r.liveVials + ' vials from ' + r.from);
      });
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
  setTimeout(wire, 800);
})();


// ── TMP AM/PM additive scheduling (added 20260818) ───────────────────────────
// Adds a "keep existing time slots" checkbox to the Set-schedule modal so the
// same peptide can live in multiple weekly-calendar time slots (e.g. Breakfast
// AM + Bedtime PM). Core's pia-add handler wipes every key for the item before
// writing the new lane; this module snapshots the schedule in capture phase and
// merges it back after core finishes, pinning each side to its own meal lane
// via lane-scoped sched keys (which calBucketFor checks first).
(function TmpAmPmAdditive(){
  'use strict';
  if (window.__tmpAmPmAdditiveBooted) return;
  window.__tmpAmPmAdditiveBooted = true;
  var LANES = ['breakfast','lunch','dinner','bedtime'];
  function $(id){ return document.getElementById(id); }
  function laneSide(l){
    l = String(l||'').toLowerCase();
    if (l==='breakfast'||l==='lunch') return 'am';
    if (l==='dinner'||l==='bedtime') return 'pm';
    return null;
  }
  function skk(n,t,di){ return n + '/' + t + '/' + di; }

  function injectUI(){
    var addBtn = $('pia-add');
    if (!addBtn || $('pia-additive-row')) return;
    var row = document.createElement('label');
    row.id = 'pia-additive-row';
    row.style.cssText = 'display:flex;align-items:center;gap:7px;margin:.6rem 0 0;font-size:12px;font-weight:600;color:#3730A3;cursor:pointer;user-select:none';
    row.innerHTML = '<input type="checkbox" id="pia-additive" style="width:15px;height:15px;accent-color:#4338CA;flex-shrink:0"> \u2795 Add to existing schedule \u2014 keep this peptide\u2019s other time slots (lets you run AM + PM)';
    var msg = $('pia-msg');
    if (msg && msg.parentNode) msg.parentNode.insertBefore(row, msg);
  }

  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('#pia-add');
    if (!t) return;
    var cb = $('pia-additive');
    if (!cb || !cb.checked) return;
    if (!window.S || !S.sched) return;
    var sel = $('pia-sel');
    var it = (S.inv||[]).find(function(i){ return i && i.id === parseInt(sel && sel.value, 10); });
    if (!it) return;
    var name = it.name;
    var snap = {};
    Object.keys(S.sched).forEach(function(k){
      if (k.indexOf(name + '/') === 0 && S.sched[k]) snap[k] = S.sched[k];
    });
    var prevLane = String(it.stackLane||'').toLowerCase();
    var newLane = String((($('pia-stk')||{}).value)||'').toLowerCase();

    setTimeout(function(){
      try {
        var msg = $('pia-msg');
        if (!msg || msg.textContent.indexOf('saved') === -1) return; // core validation failed - nothing wiped
        // merge the snapshot back (restore wiped keys without clobbering new ones)
        Object.keys(snap).forEach(function(k){
          if (!S.sched[k]) S.sched[k] = snap[k];
        });
        // pin each side to its own meal lane via lane-scoped keys
        for (var di = 0; di < 7; di++){
          if (snap[skk(name,'am',di)]){
            var la = (laneSide(prevLane)==='am') ? prevLane : null;
            if (!la) la = LANES.filter(function(l){ return laneSide(l)==='am' && snap[skk(name,l,di)]; })[0] || 'breakfast';
            S.sched[skk(name,la,di)] = true;
          }
          if (snap[skk(name,'pm',di)]){
            var lp = (laneSide(prevLane)==='pm') ? prevLane : null;
            if (!lp) lp = LANES.filter(function(l){ return laneSide(l)==='pm' && snap[skk(name,l,di)]; })[0] || 'dinner';
            S.sched[skk(name,lp,di)] = true;
          }
          var ns = laneSide(newLane);
          if (ns && S.sched[skk(name,ns,di)] && LANES.indexOf(newLane) >= 0) S.sched[skk(name,newLane,di)] = true;
        }
        if (typeof window.save === 'function') save();
        try { window.renderCal && renderCal(); } catch(_){}
        try { window.tmpInventoryToast && tmpInventoryToast('\u2713 Added \u2014 "' + name + '" now has multiple time slots'); } catch(_){}
      } catch(_){}
    }, 0);
  }, true);

  function boot(){
    injectUI();
    setInterval(function(){ if (document.visibilityState !== 'hidden') injectUI(); }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

// ── TMP Analytics module (added 20260818) ────────────────────────────────────
// Read-only analytics view over S.shots. Sort/filter/aggregate across time
// windows. Renders into the .tmp-analytics-card block in the Log Shot page.
// Uses Chart.js (already loaded for peptide history modal).
(function TmpAnalytics(){
  'use strict';
  if (window.__tmpAnalyticsBooted) return;
  window.__tmpAnalyticsBooted = true;

  var state = {
    rangeKey: '30',
    customFrom: null,
    customTo: null,
    search: '',
    sort: 'doses-desc',
    open: Object.create(null),
    chart: null
  };

  function $ (id) { return document.getElementById(id); }
  function root(){ return document.querySelector('.tmp-analytics-card'); }

  function pad(n){ return String(n).padStart(2, '0'); }
  function isoOf(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function todayISO(){ return isoOf(new Date()); }
  function isoDaysAgo(n){ var d = new Date(); d.setDate(d.getDate() - n); return isoOf(d); }
  function firstOfMonthISO(){ var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-01'; }
  function firstOfYearISO(){ return new Date().getFullYear() + '-01-01'; }

  // Normalize dose+unit into mg. IU converts via the peptide's IU-per-mg
  // factor (item.iuPerMg or known substances like HGH = 3 iu/mg) when
  // available; otherwise IU, pill, ml are excluded from mg totals.
  function doseInMg(dose, unit, pepName){
    var n = +dose;
    if (!isFinite(n) || n <= 0) return 0;
    var u = String(unit || 'mg').toLowerCase();
    if (u === 'mg') return n;
    if (u === 'mcg' || u === 'ug' || u === 'μg') return n / 1000;
    if (u === 'g')  return n * 1000;
    if (u === 'iu'){
      var f = (typeof window.tmpIuPerMgFor === 'function') ? window.tmpIuPerMgFor(pepName || '') : 0;
      return f > 0 ? n / f : 0;
    }
    return 0;
  }

  function activeRange(){
    var key = state.rangeKey;
    var today = todayISO();
    if (key === 'today') return { from: today, to: today, label: 'Today (' + today + ')' };
    if (key === '7')     return { from: isoDaysAgo(6),  to: today, label: 'Last 7 days' };
    if (key === '30')    return { from: isoDaysAgo(29), to: today, label: 'Last 30 days' };
    if (key === '90')    return { from: isoDaysAgo(89), to: today, label: 'Last 90 days' };
    if (key === 'mtd')   return { from: firstOfMonthISO(), to: today, label: 'This month' };
    if (key === 'ytd')   return { from: firstOfYearISO(),  to: today, label: 'This year' };
    if (key === 'all')   return { from: null, to: null, label: 'All time' };
    if (key === 'custom'){
      var f = state.customFrom, t = state.customTo;
      if (!f || !t) return { from: null, to: null, label: 'Custom range — pick From and To dates' };
      if (f > t) { var tmp = f; f = t; t = tmp; }
      return { from: f, to: t, label: 'Custom: ' + f + ' → ' + t };
    }
    return { from: isoDaysAgo(29), to: today, label: 'Last 30 days' };
  }

  function shotsInRange(range){
    var shots = (window.S && Array.isArray(window.S.shots)) ? window.S.shots : [];
    return shots.filter(function(s){
      if (!s || !s.date) return false;
      if (range.from && s.date < range.from) return false;
      if (range.to   && s.date > range.to)   return false;
      return true;
    });
  }

  function daysInRange(range){
    if (range.from && range.to){
      var a = new Date(range.from + 'T00:00:00');
      var b = new Date(range.to   + 'T00:00:00');
      return Math.max(1, Math.round((b - a) / 86400000) + 1);
    }
    return null;
  }

  function aggregate(shots, range){
    var totalDoses = shots.length;
    var totalMg = 0;
    var byPep = Object.create(null);
    var byDay = Object.create(null);
    shots.forEach(function(s){
      var mg = doseInMg(s.dose, s.doseUnit, s.peptide);
      totalMg += mg;
      var name = (s.peptide || '(unnamed)').trim() || '(unnamed)';
      var p = byPep[name] || (byPep[name] = {
        name: name, doses: 0, mg: 0,
        firstDate: s.date, lastDate: s.date,
        pillCount: 0, entries: []
      });
      p.doses++;
      p.mg += mg;
      if (s.date < p.firstDate) p.firstDate = s.date;
      if (s.date > p.lastDate)  p.lastDate  = s.date;
      if (String(s.doseUnit||'').toLowerCase() === 'pill') p.pillCount++;
      p.entries.push(s);
      byDay[s.date] = (byDay[s.date] || 0) + 1;
    });
    var pepList = Object.keys(byPep).map(function(k){ return byPep[k]; });
    var most = null;
    pepList.forEach(function(p){ if (!most || p.doses > most.doses) most = p; });

    var series = [];
    if (range.from && range.to){
      var cur = new Date(range.from + 'T00:00:00');
      var end = new Date(range.to   + 'T00:00:00');
      while (cur <= end){
        var iso = isoOf(cur);
        series.push({ date: iso, count: byDay[iso] || 0 });
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      Object.keys(byDay).sort().forEach(function(iso){
        series.push({ date: iso, count: byDay[iso] });
      });
    }

    return {
      totalDoses: totalDoses,
      totalMg: totalMg,
      uniquePeptides: pepList.length,
      most: most,
      byPep: pepList,
      series: series
    };
  }

  function fmtMg(mg){
    if (!isFinite(mg) || mg <= 0) return '0';
    if (mg < 0.01) return (mg*1000).toFixed(1) + ' mcg';
    if (mg < 1)    return mg.toFixed(3) + ' mg';
    if (mg < 10)   return mg.toFixed(2) + ' mg';
    if (mg < 100)  return mg.toFixed(1) + ' mg';
    return Math.round(mg) + ' mg';
  }
  function fmtMgPlain(mg){
    if (!isFinite(mg) || mg <= 0) return '0';
    if (mg < 1) return mg.toFixed(3);
    if (mg < 10) return mg.toFixed(2);
    if (mg < 100) return mg.toFixed(1);
    return String(Math.round(mg));
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='"'?'&quot;':'&#39;';
    });
  }

  function kpi(label, value, sub){
    return '<div class="tmp-anly-kpi"><div class="tmp-anly-kpi-label">' + esc(label) + '</div>'
      + '<div class="tmp-anly-kpi-value">' + esc(value) + '</div>'
      + (sub ? '<div class="tmp-anly-kpi-sub">' + esc(sub) + '</div>' : '')
      + '</div>';
  }

  function renderKpis(agg, range){
    var el = $('tmp-anly-kpis'); if (!el) return;
    var days = daysInRange(range) || Math.max(1, agg.series.length);
    var perDay = agg.totalDoses / days;
    var mostTxt = agg.most ? (agg.most.name + ' · ' + agg.most.doses + ' doses') : '—';
    el.innerHTML = ''
      + kpi('Total doses', String(agg.totalDoses))
      + kpi('Total (mg)', fmtMg(agg.totalMg), 'excludes pills / iu / ml')
      + kpi('Unique peptides', String(agg.uniquePeptides))
      + kpi('Avg / day', perDay < 1 ? perDay.toFixed(2) : perDay.toFixed(1))
      + kpi('Most frequent', mostTxt);
  }

  function renderRangeLabel(range){
    var el = $('tmp-anly-range-label');
    if (el) el.textContent = range.label;
  }

  function sortPeps(list){
    var s = state.sort;
    var arr = list.slice();
    arr.sort(function(a,b){
      switch(s){
        case 'doses-desc': return b.doses - a.doses || a.name.localeCompare(b.name);
        case 'doses-asc':  return a.doses - b.doses || a.name.localeCompare(b.name);
        case 'mg-desc':    return b.mg - a.mg || a.name.localeCompare(b.name);
        case 'mg-asc':     return a.mg - b.mg || a.name.localeCompare(b.name);
        case 'name-desc':  return b.name.localeCompare(a.name);
        case 'recent':     return (b.lastDate||'').localeCompare(a.lastDate||'') || a.name.localeCompare(b.name);
        case 'oldest':     return (a.firstDate||'').localeCompare(b.firstDate||'') || a.name.localeCompare(b.name);
        case 'name-asc':
        default:           return a.name.localeCompare(b.name);
      }
    });
    return arr;
  }

  function renderDetail(p){
    var rows = p.entries.slice();
    rows.sort(function(a,b){
      return (b.date||'').localeCompare(a.date||'') || (b.time||'').localeCompare(a.time||'');
    });
    var body = '';
    rows.forEach(function(s){
      body += '<tr>'
        + '<td>' + esc(s.date || '—') + '</td>'
        + '<td>' + esc(String(s.time||'').toUpperCase()) + '</td>'
        + '<td class="num">' + esc(+s.dose||0) + ' ' + esc(s.doseUnit || '') + '</td>'
        + '<td class="num">' + esc(+s.volume||0) + ' ' + esc(s.volumeUnit || '') + '</td>'
        + '<td>' + esc(s.site || '—') + '</td>'
        + '</tr>';
    });
    return '<table class="tmp-anly-detail-table">'
      + '<thead><tr><th>Date</th><th>Time</th><th class="num">Dose</th><th class="num">Volume</th><th>Site</th></tr></thead>'
      + '<tbody>' + body + '</tbody></table>';
  }

  function renderTable(agg){
    var tbody = $('tmp-anly-tbody'); if (!tbody) return;
    var q = (state.search || '').trim().toLowerCase();
    var list = agg.byPep.filter(function(p){ return !q || p.name.toLowerCase().indexOf(q) !== -1; });
    list = sortPeps(list);
    var empty = $('tmp-anly-empty');
    if (empty) empty.hidden = list.length > 0;
    if (!list.length) { tbody.innerHTML = ''; return; }

    var html = '';
    list.forEach(function(p){
      var avgMg = p.doses ? (p.mg / p.doses) : 0;
      var isOpen = !!state.open[p.name];
      html += '<tr class="tmp-anly-row' + (isOpen ? ' is-open' : '') + '" data-anly-pep="' + esc(p.name) + '">'
        + '<td><span class="tmp-anly-caret">▶</span></td>'
        + '<td><strong>' + esc(p.name) + '</strong>'
        + (p.pillCount ? ' <span style="font-size:9.5px;color:#4338CA;opacity:.7">(' + p.pillCount + ' pill)</span>' : '')
        + '</td>'
        + '<td class="num">' + p.doses + '</td>'
        + '<td class="num">' + fmtMgPlain(p.mg) + '</td>'
        + '<td class="num">' + fmtMgPlain(avgMg) + '</td>'
        + '<td>' + esc(p.firstDate || '—') + '</td>'
        + '<td>' + esc(p.lastDate || '—') + '</td>'
        + '</tr>';
      if (isOpen){
        html += '<tr class="tmp-anly-detail-row"><td colspan="7">' + renderDetail(p) + '</td></tr>';
      }
    });
    tbody.innerHTML = html;

    Array.prototype.forEach.call(tbody.querySelectorAll('tr.tmp-anly-row'), function(tr){
      tr.addEventListener('click', function(){
        var pep = tr.getAttribute('data-anly-pep');
        state.open[pep] = !state.open[pep];
        renderTable(agg);
      });
    });
  }

  function renderChart(agg){
    var canvas = $('tmp-anly-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    var emptyEl = $('tmp-anly-chart-empty');

    if (!agg.series.length || agg.totalDoses === 0){
      if (state.chart){ state.chart.destroy(); state.chart = null; }
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var labels = agg.series.map(function(d){ return d.date.slice(5); });
    var data   = agg.series.map(function(d){ return d.count; });
    var full   = agg.series.map(function(d){ return d.date; });

    if (state.chart){
      state.chart.data.labels = labels;
      state.chart.data.datasets[0].data = data;
      state.chart.__fullDates = full;
      state.chart.update();
      return;
    }
    state.chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: labels, datasets: [{
        label: 'Doses',
        data: data,
        backgroundColor: 'rgba(99,102,241,.75)',
        borderColor: '#4338CA',
        borderWidth: 1,
        borderRadius: 3
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: function(items){
              var idx = items && items[0] ? items[0].dataIndex : -1;
              var arr = state.chart && state.chart.__fullDates;
              return (arr && arr[idx]) ? arr[idx] : '';
            }
          }}
        },
        scales: {
          x: { grid: { display:false }, ticks: { font: { size: 10 }, autoSkip: true, maxTicksLimit: 12 } },
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } }
        }
      }
    });
    state.chart.__fullDates = full;
  }

  function renderAll(){
    var body = $('tmp-anly-body');
    if (body && body.hidden) return;
    var r = activeRange();
    var s = shotsInRange(r);
    var agg = aggregate(s, r);
    renderRangeLabel(r);
    renderKpis(agg, r);
    renderTable(agg);
    renderChart(agg);
  }

  function bindEvents(){
    var host = root(); if (!host) return;

    var collapseBtn = $('tmp-anly-collapse');
    var bodyEl = $('tmp-anly-body');
    function applyCollapsed(c){
      if (bodyEl) bodyEl.hidden = c;
      if (collapseBtn){
        collapseBtn.setAttribute('aria-expanded', c ? 'false' : 'true');
        var caret = collapseBtn.querySelector('.tmp-anly-collapse-caret');
        if (caret) caret.style.transform = c ? '' : 'rotate(90deg)';
      }
    }
    if (collapseBtn && bodyEl){
      var saved = '1';
      try { saved = localStorage.getItem('tmp.anlyCollapsed') || '1'; } catch(_){}
      applyCollapsed(saved === '1');
      collapseBtn.addEventListener('click', function(){
        var nowCollapsed = !bodyEl.hidden;
        applyCollapsed(nowCollapsed);
        try { localStorage.setItem('tmp.anlyCollapsed', nowCollapsed ? '1' : '0'); } catch(_){}
        if (!nowCollapsed) renderAll();
      });
    }

    Array.prototype.forEach.call(host.querySelectorAll('.tmp-anly-range'), function(btn){
      btn.addEventListener('click', function(){
        state.rangeKey = btn.getAttribute('data-anly-range');
        Array.prototype.forEach.call(host.querySelectorAll('.tmp-anly-range'), function(b){
          b.classList.toggle('is-active', b === btn);
        });
        var custom = $('tmp-anly-custom');
        if (custom) custom.hidden = (state.rangeKey !== 'custom');
        renderAll();
      });
    });

    var applyBtn = $('tmp-anly-apply');
    if (applyBtn){
      applyBtn.addEventListener('click', function(){
        var f = $('tmp-anly-from'), t = $('tmp-anly-to');
        state.customFrom = (f && f.value) || null;
        state.customTo   = (t && t.value) || null;
        state.rangeKey   = 'custom';
        renderAll();
      });
    }

    var search = $('tmp-anly-search');
    if (search){
      var t = null;
      search.addEventListener('input', function(){
        clearTimeout(t);
        t = setTimeout(function(){
          state.search = search.value || '';
          renderAll();
        }, 120);
      });
    }
    var sort = $('tmp-anly-sort');
    if (sort){
      sort.addEventListener('change', function(){
        state.sort = sort.value;
        renderAll();
      });
    }
  }

  function boot(){
    if (!root()) return;
    bindEvents();
    renderAll();

    if (typeof window.save === 'function' && !window.save.__tmpAnlyWrapped){
      var orig = window.save;
      window.save = function(){
        var r = orig.apply(this, arguments);
        try { renderAll(); } catch (_) {}
        return r;
      };
      window.save.__tmpAnlyWrapped = true;
    }
    var lastSig = '';
    setInterval(function(){
      if (document.visibilityState === 'hidden') return;
      if (!root()) return;
      var pg = document.getElementById('pg-stack');
      if (pg && pg.style.display === 'none') return;
      var shots = (window.S && Array.isArray(window.S.shots)) ? window.S.shots : [];
      var last = shots[shots.length-1];
      var sig = shots.length + '|' + (last ? (last.id + '|' + last.date + '|' + last.dose) : '');
      if (sig !== lastSig){ lastSig = sig; renderAll(); }
    }, 2500);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
