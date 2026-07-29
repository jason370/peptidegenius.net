// Stack Optimizer kill switch — set true to re-enable UI + postload optimizer patches.
window.TMP_OPTIMIZER_ENABLED = false;

(function(){
  function hideOptimizerChrome(){
    if(window.TMP_OPTIMIZER_ENABLED!==false)return;
    document.querySelectorAll('[data-pg="optimizer"],#sb-send-optimizer,#gpt-sb-feed-opt2').forEach(function(el){
      el.hidden=true;
      el.style.display='none';
      el.setAttribute('aria-hidden','true');
    });
    var card=document.getElementById('gpt-daily-optimizer-card');
    if(card)card.remove();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hideOptimizerChrome);
  else hideOptimizerChrome();
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-pg="stack"]'))setTimeout(hideOptimizerChrome,50);
  },true);
})();

// PeptideGenius pre-core patch runtime
// ===== extracted pre-core patch script =====
(function(){
  function px(n){return Math.max(0, Math.round(n));}
  function railSource(){
    return document.querySelector('nav#nav') || document.querySelector('.app-header') || document.querySelector('#storage-banner');
  }
  function applyRail(){
    try{
      var src = railSource();
      if(!src) return;
      var r = src.getBoundingClientRect();
      if(!r || !r.width) return;
      var w = px(r.width);
      ['pg-calc','pg-protocols'].forEach(function(id){
        var el = document.getElementById(id);
        if(!el) return;
        el.style.setProperty('width', w + 'px', 'important');
        el.style.setProperty('max-width', w + 'px', 'important');
        el.style.setProperty('margin-left', 'auto', 'important');
        el.style.setProperty('margin-right', 'auto', 'important');
        el.style.setProperty('padding-left', '0', 'important');
        el.style.setProperty('padding-right', '0', 'important');
        el.style.setProperty('box-sizing', 'border-box', 'important');
      });
    }catch(_){ }
  }
  let _railPending=false;
  function queueRail(){
    if(_railPending) return; // coalesce: one pass in flight at a time (freeze fix)
    _railPending=true;
    applyRail();
    setTimeout(applyRail, 60);
    setTimeout(function(){ _railPending=false; applyRail(); }, 240);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueRail);
  else queueRail();
  window.addEventListener('load', queueRail);
  window.addEventListener('resize', queueRail);
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('button[data-pg]')) queueRail();
  }, true);
  try{
    var mo = new MutationObserver(function(){ queueRail(); });
    mo.observe(document.documentElement, {attributes:true, childList:true, subtree:true});
  }catch(_){ }
})();


// ===== extracted pre-core patch script =====
(function(){
  function sizeTopScroller(wrap, top){
    var tbl=wrap && wrap.querySelector('table.pt2');
    var inner=top && top.querySelector('.pw-top-scroll-inner');
    if(!tbl||!inner)return;
    inner.style.width=Math.max(tbl.scrollWidth, wrap.scrollWidth, wrap.clientWidth)+'px';
  }
  function syncVendorTopScroll(){
    var wrap=document.querySelector('#pg-prices .pw');
    if(!wrap)return;
    var top=document.querySelector('#pg-prices .pw-top-scroll');
    if(!top){
      top=document.createElement('div');
      top.className='pw-top-scroll';
      top.innerHTML='<div class="pw-top-scroll-inner"></div>';
      wrap.parentNode.insertBefore(top, wrap);
      var busy=false;
      top.addEventListener('scroll',function(){ if(busy)return; busy=true; wrap.scrollLeft=top.scrollLeft; busy=false; });
      wrap.addEventListener('scroll',function(){ if(busy)return; busy=true; top.scrollLeft=wrap.scrollLeft; busy=false; });
    }
    sizeTopScroller(wrap, top);
  }
  var old=window.renderPrices;
  if(typeof old==='function' && !old.__gptVendorScrollPatched){
    var patched=function(){ var r=old.apply(this,arguments); setTimeout(syncVendorTopScroll,0); setTimeout(syncVendorTopScroll,80); return r; };
    patched.__gptVendorScrollPatched=true;
    window.renderPrices=patched;
  }
  window.addEventListener('resize',function(){setTimeout(syncVendorTopScroll,50)});
  document.addEventListener('DOMContentLoaded',function(){setTimeout(syncVendorTopScroll,150);setTimeout(syncVendorTopScroll,800)});
})();


// ===== extracted pre-core patch script =====
window.tmpInventoryToast = function(text, color){
  try {
    var t = document.getElementById('tmp-inv-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'tmp-inv-toast';
      t.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;padding:12px 24px;border-radius:10px;color:#fff;font-weight:700;font-size:14px;box-shadow:0 8px 28px rgba(0,0,0,.18),0 0 0 .5px rgba(255,255,255,.18) inset;display:none;font-family:inherit;letter-spacing:.01em;max-width:90vw;text-align:center;pointer-events:none';
      (document.body || document.documentElement).appendChild(t);
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
};


// ===== extracted pre-core patch script =====
(function(){
  const SLOTS = [['morning','🌅 Morning'],['afternoon','☀ Afternoon'],['evening','🌙 Evening']];
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const FREQS = ['Daily','2×/day','3×/day','Nightly','Every other day','Weekly','As needed'];
  const QUICK_PRESETS = [
    {name:'Psyllium', dose:'3 caps', freq:'3×/day', notes:''},
    {name:'Magnesium citrate', dose:'1-2 caps', freq:'Nightly', notes:''},
    {name:'Turmeric / curcumin', dose:'1 cap', freq:'Daily', notes:'with food'},
    {name:'Vitamin D3', dose:'5,000 IU', freq:'Every other day', notes:''},
    {name:'Iron Complex', dose:'1 cap', freq:'Every other day', notes:''},
    {name:'Omega-3 fish oil', dose:'per label', freq:'Daily', notes:'with food'},
    {name:'Vitamin B3', dose:'per label', freq:'Daily', notes:'with food'}
  ];
  // v33.375-stable-vendor-post-import-review: permanent vitamin log memory. The main S.vitsLog is still saved in
  // the normal PeptideGenius backup, but we also mirror it to a separate localStorage
  // key so taken/not-taken history survives daily re-renders, page switches, and
  // accidental partial state rewrites.
  const VITS_LOG_KEY = 'tmp.vitsLog.v33';
  function vitLogIdentity(e){ return [String(e&&e.name||''), String(e&&e.date||''), String(e&&e.slot||'*')].join('|'); }
  function normalizeVitLogEntry(e){
    if(!e || !e.name || !e.date) return null;
    const out = { name:String(e.name), date:String(e.date), time:String(e.time||'') };
    if(e.slot) out.slot = String(e.slot);
    if(e.loggedAt) out.loggedAt = String(e.loggedAt);
    return out;
  }
  function readVitLogMirror(){
    try{
      const raw = localStorage.getItem(VITS_LOG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(normalizeVitLogEntry).filter(Boolean) : [];
    }catch(_){ return []; }
  }
  function writeVitLogMirror(arr){
    try{ localStorage.setItem(VITS_LOG_KEY, JSON.stringify((arr||[]).map(normalizeVitLogEntry).filter(Boolean))); }catch(_){ }
  }
  function assignLegacyVitSlot(e){
    if(!e || e.slot) return e;
    const v = (typeof S !== 'undefined' && Array.isArray(S.vits))
      ? S.vits.find(x => x && x.name === e.name)
      : null;
    const slot = v
      ? (Array.isArray(v.slots) && v.slots.length ? v.slots[0] : (v.slot || 'morning'))
      : 'morning';
    return Object.assign({}, e, { slot: String(slot) });
  }
  function hydrateVitLogMemory(){
    if(!window.S) return [];
    const merged = new Map();
    const fromS = Array.isArray(S.vitsLog) ? S.vitsLog : [];
    fromS.concat(readVitLogMirror()).forEach(e => {
      const n = normalizeVitLogEntry(assignLegacyVitSlot(e));
      if(n) merged.set(vitLogIdentity(n), n);
    });
    S.vitsLog = Array.from(merged.values()).sort((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)) || String(a.name).localeCompare(String(b.name)));
    writeVitLogMirror(S.vitsLog);
    return S.vitsLog;
  }
  function persistVitLogMemory(){
    if(!window.S) return;
    if(!Array.isArray(S.vitsLog)) S.vitsLog = [];
    const merged = new Map();
    S.vitsLog.map(normalizeVitLogEntry).filter(Boolean).forEach(e => merged.set(vitLogIdentity(e), e));
    S.vitsLog = Array.from(merged.values());
    writeVitLogMirror(S.vitsLog);
  }
  function ensureLog(){
    if(!window.S) return null;
    if(!Array.isArray(S.vitsLog)) S.vitsLog = [];
    return hydrateVitLogMemory();
  }
  let _vitLogHydratedOnce = false;
  function ensureLogOnce(){
    if(!window.S) return null;
    if(!Array.isArray(S.vitsLog)) S.vitsLog = [];
    if(_vitLogHydratedOnce) return S.vitsLog;
    _vitLogHydratedOnce = true;
    return hydrateVitLogMemory();
  }
  let _vitMirrorTimer = null;
  function queueVitLogMirrorWrite(){
    clearTimeout(_vitMirrorTimer);
    _vitMirrorTimer = setTimeout(function(){
      _vitMirrorTimer = null;
      if(window.S && Array.isArray(S.vitsLog)) writeVitLogMirror(S.vitsLog);
    }, 600);
  }
  let _vitMainSaveTimer = null;
  let _vitStatsRaf = null;
  function scheduleVitMainSave(){
    clearTimeout(_vitMainSaveTimer);
    _vitMainSaveTimer = setTimeout(function(){
      _vitMainSaveTimer = null;
      try { typeof save === 'function' && save(); } catch(_){}
    }, 8000);
  }
  function scheduleVitStatsRefresh(){
    if(_vitStatsRaf) return;
    _vitStatsRaf = requestAnimationFrame(function(){
      _vitStatsRaf = null;
      updateVitStats();
    });
  }
  function persistVitLogFast(){
    if(!window.S) return;
    if(!Array.isArray(S.vitsLog)) S.vitsLog = [];
    const merged = new Map();
    S.vitsLog.map(normalizeVitLogEntry).filter(Boolean).forEach(e => merged.set(vitLogIdentity(e), e));
    S.vitsLog = Array.from(merged.values());
    queueVitLogMirrorWrite();
  }
  function getVitDateIso(di){
    try {
      const off = (typeof S !== 'undefined' && typeof S.wkOff === 'number') ? S.wkOff : 0;
      if(typeof wkD === 'function' && typeof fmD === 'function') return fmD(wkD(off)[di]);
    } catch(_){}
    return (new Date()).toISOString().slice(0,10);
  }
  function findVitCell(vi, di, slot){
    const grid = document.getElementById('cal-vits-grid');
    if(!grid) return null;
    return grid.querySelector('.vit-cell[data-vi="'+vi+'"][data-di="'+di+'"][data-slot="'+slot+'"]');
  }
  function cellIsLoggedForSlot(log, name, dateIso, slotKey){
    if(!log) return -1;
    for(let i = 0; i < log.length; i++){
      const e = log[i];
      if(e && e.name === name && e.date === dateIso && e.slot === slotKey) return i;
    }
    return -1;
  }
  function updateCellInPlace(btn, vi, di, slotKey, dateIso){
    const v = S.vits && S.vits[vi]; if(!v || !btn) return;
    const lg = Array.isArray(S.vitsLog) ? S.vitsLog : [];
    const days = Array.isArray(v.days) ? v.days : [];
    const on = days.indexOf(di) >= 0;
    const logged = dateIso ? cellIsLoggedForSlot(lg, v.name, dateIso, slotKey) >= 0 : false;
    btn.className = 'vit-cell' + (logged ? ' vit-logged' : on ? ' vit-on' : '');
    btn.textContent = logged ? '\u2713' : '';
  }
  function refreshVitCellsForVitamin(vi){
    const grid = document.getElementById('cal-vits-grid');
    if(!grid) return;
    grid.querySelectorAll('.vit-cell[data-vi="'+vi+'"]').forEach(btn => {
      const di = parseInt(btn.dataset.di, 10);
      updateCellInPlace(btn, vi, di, btn.dataset.slot || 'morning', getVitDateIso(di));
    });
  }
  function updateVitStats(){
    const stats = document.getElementById('cal-vits-stats');
    if(!stats) return;
    const vits = ensureState();
    if(!vits || !vits.length){ stats.innerHTML = ''; return; }
    let _wkIso = null;
    try {
      if(typeof wkD === 'function' && typeof fmD === 'function'){
        const off = (typeof S !== 'undefined' && typeof S.wkOff === 'number') ? S.wkOff : 0;
        _wkIso = wkD(off).map(fmD);
      }
    } catch(_){}
    const lg = ensureLogOnce() || [];
    let scheduledCells = 0, loggedCells = 0;
    const allTimeLogged = new Set((lg||[]).map(vitLogIdentity).filter(Boolean)).size;
    const loggedKeys = new Set();
    vits.forEach(v => {
      const slots = Array.isArray(v.slots) && v.slots.length ? v.slots : [v.slot || 'morning'];
      const days = Array.isArray(v.days) ? v.days : [];
      scheduledCells += slots.length * days.length;
    });
    if(_wkIso){
      lg.forEach(e => {
        if(e && _wkIso.includes(e.date) && e.slot){
          loggedKeys.add([e.name || '', e.date || '', e.slot || ''].join('|'));
        }
      });
      loggedCells = loggedKeys.size;
    }
    stats.innerHTML = '<span class="vits-stat"><b>'+vits.length+'</b> items</span>'
      + '<span class="vits-stat"><b>'+scheduledCells+'</b> scheduled</span>'
      + '<span class="vits-stat"><b>'+loggedCells+'</b> logged</span>'
      + '<span class="vits-stat"><b>'+allTimeLogged+'</b> remembered</span>';
  }
  function optimisticFlipCell(btn){
    if(!btn) return;
    const isLogged = btn.classList.contains('vit-logged');
    const isOn = btn.classList.contains('vit-on');
    if(isLogged){
      btn.className = 'vit-cell' + (isOn ? ' vit-on' : '');
      btn.textContent = '';
    } else {
      btn.className = 'vit-cell vit-logged' + (isOn ? ' vit-on' : '');
      btn.textContent = '\u2713';
    }
  }
  function performVitLogToggle(vi, di, slot, cellBtn){
    const v = S.vits && S.vits[vi]; if(!v) return;
    const dateIso = getVitDateIso(di);
    const scope = toggleVitLogOnDate(v.name, dateIso, slot);
    persistVitLogFast();
    if(scope === 'row') refreshVitCellsForVitamin(vi);
    else {
      const btn = cellBtn || findVitCell(vi, di, slot);
      if(btn) updateCellInPlace(btn, vi, di, slot, dateIso);
    }
    scheduleVitStatsRefresh();
    scheduleVitMainSave();
  }
  function performVitScheduleToggle(vi, di){
    const v = S.vits && S.vits[vi]; if(!v) return;
    if(!Array.isArray(v.days)) v.days = [];
    const idx = v.days.indexOf(di);
    if(idx >= 0) v.days.splice(idx, 1); else v.days.push(di);
    refreshVitCellsForVitamin(vi);
    scheduleVitMainSave();
  }
  function wireGridDelegation(){
    const grid = document.getElementById('cal-vits-grid');
    if(!grid || grid.dataset.delegated === '1') return;
    grid.dataset.delegated = '1';
    let _pendingTimer = null;
    function cancelPendingLog(){
      if(_pendingTimer){ clearTimeout(_pendingTimer); _pendingTimer = null; }
    }
    grid.addEventListener('click', (e) => {
      const cell = e.target.closest && e.target.closest('.vit-cell');
      const del = e.target.closest && e.target.closest('.vit-del');
      if(cell){
        e.preventDefault();
        e.stopPropagation();
        const vi = parseInt(cell.dataset.vi, 10);
        const di = parseInt(cell.dataset.di, 10);
        const slot = cell.dataset.slot || 'morning';
        if(isNaN(vi) || isNaN(di)) return;
        cancelPendingLog();
        optimisticFlipCell(cell);
        cell.style.transform = 'scale(1.12)';
        setTimeout(() => { cell.style.transform = ''; }, 140);
        _pendingTimer = setTimeout(() => {
          _pendingTimer = null;
          performVitLogToggle(vi, di, slot, cell);
        }, 240);
        return;
      }
      if(del){
        e.preventDefault();
        e.stopPropagation();
        cancelPendingLog();
        const vi = parseInt(del.dataset.vi, 10);
        if(!confirm('Delete vitamin "'+(S.vits[vi] && S.vits[vi].name || '')+'"?')) return;
        S.vits.splice(vi, 1);
        try { typeof save === 'function' && save(); } catch(_){}
        renderVits();
      }
    }, true);
    grid.addEventListener('dblclick', (e) => {
      const cell = e.target.closest && e.target.closest('.vit-cell');
      if(!cell) return;
      e.preventDefault();
      e.stopPropagation();
      cancelPendingLog();
      const vi = parseInt(cell.dataset.vi, 10);
      const di = parseInt(cell.dataset.di, 10);
      const slot = cell.dataset.slot || 'morning';
      if(isNaN(vi) || isNaN(di)) return;
      updateCellInPlace(cell, vi, di, slot, getVitDateIso(di));
      performVitScheduleToggle(vi, di);
    }, true);
  }
  function todaysLogCount(name){
    const log = ensureLogOnce(); if(!log) return 0;
    const today = (new Date()).toISOString().slice(0,10);
    return log.filter(e => e && e.name === name && e.date === today).length;
  }
  function ensureState(){
    if(!window.S) return null;
    if(!Array.isArray(S.vits)) S.vits = [];
    return S.vits;
  }
  function renderVits(){
    const grid = document.getElementById('cal-vits-grid');
    const empty = document.getElementById('cal-vits-empty');
    const stats = document.getElementById('cal-vits-stats');
    if(!grid) return;
    const vits = ensureState();
    if(!vits || vits.length===0){
      grid.innerHTML = '';
      if(stats) stats.innerHTML = '';
      if(empty) empty.style.display = 'block';
      return;
    }
    if(empty) empty.style.display = 'none';
    // Group vitamins by slot — one entry can appear in multiple slots
    const bySlot = {morning:[], afternoon:[], evening:[]};
    vits.forEach((v,vi) => {
      const slotList = Array.isArray(v.slots) && v.slots.length > 0
        ? v.slots
        : [v.slot || 'morning'];
      slotList.forEach(slotKey => {
        (bySlot[slotKey] || bySlot.morning).push({v, vi});
      });
    });
    let _wkIso = null;
    try {
      if(typeof wkD === 'function' && typeof fmD === 'function'){
        const off = (typeof S !== 'undefined' && typeof S.wkOff === 'number') ? S.wkOff : 0;
        _wkIso = wkD(off).map(fmD);
      }
    } catch(_){}
    const lg = ensureLogOnce() || [];
    updateVitStats();
    let html = '<div class="vits-board"><div class="vits-scroll"><table class="vits-table">';
    html += '<thead><tr><th>Supplement</th>';
    DAYS.forEach((d) => { html += '<th>'+d+'</th>'; });
    html += '<th></th></tr></thead><tbody>';
    SLOTS.forEach(([slotKey, slotLabel]) => {
      const items = bySlot[slotKey] || [];
      html += '<tr class="vits-slot-row"><td colspan="9"><div class="vits-slot-label"><span>'+slotLabel+'</span><span class="vits-slot-count">'+items.length+' item'+(items.length===1?'':'s')+'</span></div></td></tr>';
      if(!items.length){
        html += '<tr class="vits-empty-row"><td colspan="9">Nothing scheduled for this slot.</td></tr>';
        return;
      }
      items.forEach(({v, vi}) => {
        const freqStr = v.freq ? '<span class="vit-chip">'+escHtml(v.freq)+'</span>' : '';
        const notesStr = v.notes ? '<span class="vit-chip note" title="'+escHtml(v.notes)+'">'+escHtml(v.notes)+'</span>' : '';
        html += '<tr class="vits-item-row">';
        html += '<td class="vits-namecell">';
        html += '<div class="vit-mainline"><span class="vit-name">'+escHtml(v.name||'')+'</span>'+(v.dose?' <span class="vit-dose">'+escHtml(v.dose)+'</span>':'')+'</div>';
        if(freqStr || notesStr){ html += '<div class="vit-meta">'+freqStr+notesStr+'</div>'; }
        html += '</td>';
        const days = Array.isArray(v.days) ? v.days : [];
        const _logSlotSet = new Set();
        if(_wkIso){
          for(const e of lg){
            if(e && e.name === v.name && e.slot && _wkIso.includes(e.date)){
              _logSlotSet.add(e.date + '|' + e.slot);
            }
          }
        }
        DAYS.forEach((d,di) => {
          const on = days.indexOf(di) >= 0;
          const dateIso = _wkIso ? _wkIso[di] : null;
          const logged = dateIso ? _logSlotSet.has(dateIso + '|' + slotKey) : false;
          let cls = 'vit-cell';
          let mark = '';
          if(logged){ cls += ' vit-logged'; mark = '\u2713'; }
          else if(on){ cls += ' vit-on'; }
          html += '<td class="vits-daytd">';
          html += '<button type="button" class="'+cls+'" data-vi="'+vi+'" data-di="'+di+'" data-slot="'+slotKey+'" title="Click to log \u00b7 Double-click to toggle schedule">'+mark+'</button>';
          html += '</td>';
        });
        html += '<td style="padding:4px 8px;text-align:right"><button type="button" class="vit-del" data-vi="'+vi+'" title="Delete this vitamin">×</button></td>';
        html += '</tr>';
      });
    });
    html += '</tbody></table></div></div><div class="vits-legend"><span><i class="vits-dot scheduled"></i> Scheduled</span><span><i class="vits-dot logged"></i> Logged</span><span><i class="vits-dot unscheduled"></i> Off</span></div>';
    grid.innerHTML = html;
  }
  function escHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function showAddForm(){
    let host = document.getElementById('cal-vits-form');
    if(!host){
      host = document.createElement('div');
      host.id = 'cal-vits-form';
      host.style.cssText = 'background:rgba(255,255,255,.72);border:1px solid rgba(245,158,11,.22);border-radius:14px;padding:.85rem;margin:0 14px 12px;box-shadow:0 1px 0 rgba(255,255,255,.78) inset';
      const grid = document.getElementById('cal-vits-grid');
      if(grid) grid.parentNode.insertBefore(host, grid);
    }
    const slotOpts = SLOTS.map(([k,l]) => '<option value="'+k+'">'+l+'</option>').join('');
    const freqOpts = FREQS.map(f => '<option value="'+f+'">'+f+'</option>').join('');
    const presetOpts = QUICK_PRESETS.map((p,i) =>
      '<button type="button" data-preset="'+i+'" style="padding:4px 9px;font-size:11px;border:1px solid rgba(245,158,11,.22);background:rgba(255,255,255,.74);color:#92400E;border-radius:999px;cursor:pointer;font-family:inherit;font-weight:700">'+p.name+'</button>'
    ).join(' ');
    host.innerHTML = ''
      + '<div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Add a vitamin / supplement</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + presetOpts + '</div>'
      + '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;margin-bottom:8px">'
      +   '<input type="text" id="vit-f-name" placeholder="Name (e.g. Vitamin D3)" style="padding:6px 9px;border:.5px solid #FBBF24;border-radius:6px;font-size:12.5px">'
      +   '<input type="text" id="vit-f-dose" placeholder="Dose (e.g. 5000 IU)" style="padding:6px 9px;border:.5px solid #FBBF24;border-radius:6px;font-size:12.5px">'
      +   '<select id="vit-f-freq" style="padding:6px 9px;border:.5px solid #FBBF24;border-radius:6px;font-size:12.5px">' + freqOpts + '</select>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;font-size:12px;color:#92400E;flex-wrap:wrap">'
      +   '<span style="font-weight:600">Take at:</span>'
      +   SLOTS.map(([k,l]) => '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:5px"><input type="checkbox" id="vit-f-slot-'+k+'" style="width:14px;height:14px;cursor:pointer"> '+l+'</label>').join('')
      + '</div>'
      + '<input type="text" id="vit-f-notes" placeholder="Notes (e.g. with food)" style="width:100%;box-sizing:border-box;padding:6px 9px;border:.5px solid #FBBF24;border-radius:6px;font-size:12.5px;margin-bottom:8px">'
      + '<div style="display:flex;justify-content:flex-end;gap:6px">'
      +   '<button type="button" id="vit-f-cancel" class="btn" style="padding:5px 12px;font-size:12px">Cancel</button>'
      +   '<button type="button" id="vit-f-save" class="btn" style="padding:5px 12px;font-size:12px;background:#F59E0B;color:#fff;border-color:#D97706">Save</button>'
      + '</div>';
    document.getElementById('vit-f-cancel').addEventListener('click', () => host.remove());
    document.getElementById('vit-f-save').addEventListener('click', () => {
      const name = (document.getElementById('vit-f-name').value || '').trim();
      if(!name){ alert('Name is required.'); return; }
      const dose = (document.getElementById('vit-f-dose').value || '').trim();
      const slots = SLOTS.map(([k]) => k).filter(k => {
        const cb = document.getElementById('vit-f-slot-'+k);
        return cb && cb.checked;
      });
      if(slots.length === 0){ alert('Select at least one time slot (Morning / Afternoon / Evening).'); return; }
      const freq = document.getElementById('vit-f-freq').value;
      const notes = (document.getElementById('vit-f-notes').value || '').trim();
      ensureState();
      let days = [0,1,2,3,4,5,6];
      if(freq === 'Every other day') days = [0,2,4,6];
      else if(freq === 'Weekly') days = [0];
      // Use the first selected slot as the legacy slot for backward compat
      S.vits.push({ name, dose, slot: slots[0], slots, freq, notes, days });
      try { typeof save === 'function' && save(); } catch(_){}
      host.remove();
      renderVits();
    });
    function applySlotChecksForFreq(freq){
      const m = document.getElementById('vit-f-slot-morning');
      const a = document.getElementById('vit-f-slot-afternoon');
      const e = document.getElementById('vit-f-slot-evening');
      if(!m||!a||!e) return;
      m.checked = a.checked = e.checked = false;
      if(freq === '3×/day'){ m.checked = a.checked = e.checked = true; }
      else if(freq === '2×/day'){ m.checked = e.checked = true; }
      else if(freq === 'Nightly'){ e.checked = true; }
      else { m.checked = true; }   // Daily, Weekly, Every other day, default
    }
    host.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', ()=>{
      const p = QUICK_PRESETS[parseInt(b.dataset.preset,10)];
      if(!p) return;
      document.getElementById('vit-f-name').value = p.name;
      document.getElementById('vit-f-dose').value = p.dose;
      document.getElementById('vit-f-freq').value = p.freq;
      document.getElementById('vit-f-notes').value = p.notes;
      applySlotChecksForFreq(p.freq);
    }));
    // When user changes freq directly, refresh the checkbox preselection
    document.getElementById('vit-f-freq').addEventListener('change', function(){
      applySlotChecksForFreq(this.value);
    });
    // Initial preselect — daily, morning checked
    applySlotChecksForFreq(document.getElementById('vit-f-freq').value);
    setTimeout(()=>{ const n=document.getElementById('vit-f-name'); if(n) n.focus(); }, 50);
  }
  function logVitaminOnDate(name, dateIso, slot){
    const log = ensureLogOnce(); if(!log) return;
    const time = (new Date()).toTimeString().slice(0,5);
    const slotKey = slot || 'morning';
    const entry = { name, date: dateIso, time, slot: slotKey, loggedAt:(new Date()).toISOString() };
    const key = vitLogIdentity(entry);
    if(!log.some(e => vitLogIdentity(e) === key)) log.push(entry);
    persistVitLogFast();
  }
  // Toggle: clicking a cell affects ONLY that (date, slot) cell.
  function toggleVitLogOnDate(name, dateIso, slot){
    const log = ensureLogOnce();
    if(!log) { logVitaminOnDate(name, dateIso, slot); return 'cell'; }
    const slotKey = slot || 'morning';
    for(let i = log.length - 1; i >= 0; i--){
      const e = log[i];
      if(e && e.name === name && e.date === dateIso && e.slot === slotKey){
        log.splice(i, 1);
        return 'cell';
      }
    }
    for(let i = log.length - 1; i >= 0; i--){
      const e = log[i];
      if(e && e.name === name && e.date === dateIso && !e.slot){
        const v = (S.vits || []).find(x => x && x.name === name);
        const vSlots = v
          ? (Array.isArray(v.slots) && v.slots.length ? v.slots : [v.slot || 'morning'])
          : ['morning', 'afternoon', 'evening'];
        log.splice(i, 1);
        vSlots.forEach(s => {
          if(s === slotKey) return;
          const exists = log.some(x => x && x.name === name && x.date === dateIso && x.slot === s);
          if(!exists){
            log.push({
              name: e.name,
              date: e.date,
              time: e.time || (new Date()).toTimeString().slice(0, 5),
              slot: s
            });
          }
        });
        return 'row';
      }
    }
    logVitaminOnDate(name, dateIso, slotKey);
    return 'cell';
  }
  function logVitamin(name){
    const today = (new Date()).toISOString().slice(0,10);
    const v = (S.vits || []).find(x => x && x.name === name);
    const slot = v
      ? (Array.isArray(v.slots) && v.slots.length ? v.slots[0] : (v.slot || 'morning'))
      : 'morning';
    logVitaminOnDate(name, today, slot);
    persistVitLogFast();
    const vi = (S.vits || []).findIndex(x => x && x.name === name);
    if(vi >= 0) refreshVitCellsForVitamin(vi);
    scheduleVitStatsRefresh();
    scheduleVitMainSave();
  }
  function addVitamin(){ showAddForm(); }
  function applyToggle(visible){
    const card = document.getElementById('cal-vits-card');
    const btn = document.getElementById('cal-vits-toggle');
    if(card) card.style.display = visible ? 'block' : 'none';
    if(btn) btn.style.background = visible ? 'rgba(251,191,36,.4)' : 'rgba(255,251,235,.7)';
    try { localStorage.setItem('tmp.vitsVisible', visible ? '1' : '0'); } catch(_){}
    if(visible){
      renderVits();
      // Scroll the card into view (center) so the user can\'t miss it.
      try { card && card.scrollIntoView({behavior:'smooth', block:'center'}); } catch(_){}
    }
  }
  function init(){
    const tog = document.getElementById('cal-vits-toggle');
    const addBtn = document.getElementById('cal-vits-add-btn');
    if(!tog) return;
    if(tog.dataset.wired === '1') return;   // idempotent — only bind once
    tog.dataset.wired = '1';
    try { if(window.S) ensureLog(); } catch(_){}
    // v33.375-stable-vendor-post-import-review: ALWAYS default to visible on first load (mobile users were
    // missing the card entirely because S.vits was empty before sync).
    let visible = true;
    let saved = null;
    try { saved = localStorage.getItem('tmp.vitsVisible'); } catch(_){}
    if(saved === '0') visible = false;       // user explicitly closed
    // saved === '1' → visible (already default)
    // saved === null/undefined → visible (default)
    applyToggle(visible);
    wireGridDelegation();
    ['btn-prev','btn-next'].forEach(function(id){
      const btn = document.getElementById(id);
      if(!btn || btn.dataset.vitWeekHook === '1') return;
      btn.dataset.vitWeekHook = '1';
      btn.addEventListener('click', function(){
        const card = document.getElementById('cal-vits-card');
        if(card && card.style.display === 'block'){
          setTimeout(function(){ try { renderVits(); } catch(_){} }, 0);
        }
      });
    });
    tog.addEventListener('click', ()=>{
      const card = document.getElementById('cal-vits-card');
      const isOpen = card && card.style.display === 'block';
      applyToggle(!isOpen);
    });
    if(addBtn && !addBtn.dataset.wired){
      addBtn.dataset.wired = '1';
      addBtn.addEventListener('click', addVitamin);
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(init, 800);
  window.renderVits = renderVits;
  window.logVitaminOnDate = logVitaminOnDate;
  window.toggleVitLogOnDate = toggleVitLogOnDate;
  window.logVitamin = logVitamin;
})();


// ===== extracted pre-core patch script =====
(function(){
  const SLOTS = [['morning','🌅 Morning'],['afternoon','☀ Afternoon'],['evening','🌙 Evening']];
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const FREQS = ['Daily','2×/day','3×/day','Nightly','Every other day','Weekly','As needed'];
  const QUICK_PRESETS = [
    {name:'Atorvastatin', dose:'20 mg', freq:'Daily', notes:'evening preferred'},
    {name:'Metformin', dose:'500 mg', freq:'2×/day', notes:'with food'},
    {name:'Lisinopril', dose:'10 mg', freq:'Daily', notes:''},
    {name:'Levothyroxine', dose:'50 mcg', freq:'Daily', notes:'morning, empty stomach'}
  ];
  function ensureState(){ if(!window.S) return null; if(!Array.isArray(S.rx)) S.rx = []; return S.rx; }
  function ensureLog(){ if(!window.S) return null; if(!Array.isArray(S.rxLog)) S.rxLog = []; return S.rxLog; }
  // Local-date ISO (YYYY-MM-DD) — matches the weekly calendar's cell dates.
  // (toISOString is UTC and puts evening takes on the wrong day.)
  function localToday(){
    const d=new Date(), pad=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  }
  function todaysLogCount(name){
    const log = ensureLog(); if(!log) return 0;
    const today = localToday();
    return log.filter(e => e && e.name === name && e.date === today).length;
  }
  function refreshCal(){ try{ typeof renderCal==='function' && renderCal(); }catch(_){} }
  function escHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function weekIsoDays(){
    try {
      if(typeof wkD === 'function' && typeof fmD === 'function'){
        const off = (typeof S !== 'undefined' && typeof S.wkOff === 'number') ? S.wkOff : 0;
        const days = wkD(off);
        return { days: days, iso: days.map(fmD) };
      }
    } catch(_){}
    return { days: null, iso: null };
  }
  function logCountOnDate(name, dateIso){
    const log = ensureLog(); if(!log || !dateIso) return 0;
    return log.filter(e => e && e.name === name && e.date === dateIso).length;
  }
  function renderRx(){
    const grid = document.getElementById('cal-rx-grid');
    const empty = document.getElementById('cal-rx-empty');
    if(!grid) return;
    const items = ensureState();
    if(!items || items.length===0){
      grid.innerHTML = '';
      if(empty) empty.style.display = 'block';
      return;
    }
    if(empty) empty.style.display = 'none';
    const bySlot = {morning:[], afternoon:[], evening:[]};
    items.forEach((v,vi) => {
      const slotList = Array.isArray(v.slots) && v.slots.length > 0 ? v.slots : [v.slot || 'morning'];
      slotList.forEach(slotKey => { (bySlot[slotKey] || bySlot.morning).push({v, vi}); });
    });
    const wk = weekIsoDays();
    const todayIso = localToday();
    let html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr><th style="text-align:left;padding:6px 8px;color:#0F766E;font-weight:600;width:40%">Medication</th>';
    DAYS.forEach((d, di) => {
      const dateNum = wk.days && wk.days[di] ? wk.days[di].getDate() : '';
      const isToday = wk.iso && wk.iso[di] === todayIso;
      html += '<th style="padding:6px 4px;color:'+(isToday?'#B45309':'#0F766E')+';font-weight:600;font-size:11px;text-align:center;min-width:48px">'
        + d
        + (dateNum !== '' ? '<br><span style="font-weight:'+(isToday?'700':'400')+';font-size:9px">' + dateNum + '</span>' : '')
        + '</th>';
    });
    html += '<th style="width:32px"></th></tr></thead><tbody>';
    SLOTS.forEach(([slotKey, slotLabel]) => {
      html += '<tr><td colspan="9" style="padding:10px 8px 4px;background:rgba(20,184,166,.15);font-size:11px;font-weight:700;color:#0F766E;text-transform:uppercase;letter-spacing:.06em;border-top:.5px solid rgba(13,148,136,.4)">'+slotLabel+'</td></tr>';
      const arr = bySlot[slotKey];
      if(!arr || arr.length === 0){
        html += '<tr><td colspan="9" style="padding:8px 12px;font-size:11px;color:#0F766E;font-style:italic;text-align:center;background:rgba(255,255,255,.3)">Nothing scheduled — click <b>+ Add Rx</b> and pick this slot.</td></tr>';
        return;
      }
      arr.forEach(({v, vi}) => {
        const freqStr = v.freq ? '<span style="margin-left:6px;font-size:10.5px;color:#0F766E">· '+escHtml(v.freq)+'</span>' : '';
        const notesStr = v.notes ? '<span style="margin-left:6px;font-size:10.5px;color:#0F766E;font-style:italic">· '+escHtml(v.notes)+'</span>' : '';
        const todayCount = todaysLogCount(v.name);
        const logBtn = '<button type="button" class="rx-log" data-name="'+escHtml(v.name)+'" style="margin-top:4px;padding:3px 9px;font-size:10.5px;border:.5px solid #0D9488;background:#14B8A6;color:#fff;font-weight:600;border-radius:5px;cursor:pointer;font-family:inherit">+ Log'+(todayCount?' ('+todayCount+' today)':'')+'</button>'
          + '<label style="display:inline-flex;align-items:center;gap:5px;margin-top:4px;margin-left:10px;font-size:10.5px;color:#0F766E;font-weight:600;cursor:pointer;vertical-align:middle"><input type="checkbox" class="rx-taken" data-name="'+escHtml(v.name)+'"'+(todayCount?' checked':'')+' style="width:14px;height:14px;cursor:pointer;accent-color:#0D9488"> Taken today 💊</label>';
        html += '<tr style="border-top:.5px solid rgba(13,148,136,.18)">';
        html += '<td style="padding:8px 8px 8px 18px;vertical-align:middle">';
        html += '<div style="font-size:13px;font-weight:600;color:#0F766E">'+escHtml(v.name||'')+(v.dose?' <span style="font-weight:400;color:#0D9488;font-size:11px">'+escHtml(v.dose)+'</span>':'')+'</div>';
        if(freqStr || notesStr){
          html += '<div style="font-size:10.5px;color:#0F766E;margin-top:1px">'+freqStr.replace(/^<span[^>]*>· /,'').replace(/<\/span>$/,'')+(notesStr&&freqStr?' · ':'')+notesStr.replace(/^<span[^>]*>· /,'').replace(/<\/span>$/,'')+'</div>';
        }
        html += logBtn;
        html += '</td>';
        const days = Array.isArray(v.days) ? v.days : [];
        DAYS.forEach((d,di) => {
          const on = days.indexOf(di) >= 0;
          const dateIso = wk.iso ? wk.iso[di] : null;
          const logged = dateIso ? logCountOnDate(v.name, dateIso) > 0 : false;
          const bg = logged ? '#0F766E' : (on ? '#14B8A6' : 'rgba(255,255,255,.5)');
          const border = logged ? '#0F766E' : (on ? '#0D9488' : '#5EEAD4');
          const color = (logged || on) ? '#fff' : '#0F766E';
          const mark = logged ? '💊' : (on ? '✓' : '');
          const title = dateIso
            ? (logged ? 'Taken '+dateIso : (on ? 'Scheduled · click to toggle day' : 'Off · click to schedule'))
            : (on ? 'Scheduled' : 'Off');
          html += '<td style="padding:4px;text-align:center">';
          html += '<button type="button" class="rx-cell" data-vi="'+vi+'" data-di="'+di+'" title="'+escHtml(title)+'" style="width:32px;height:24px;border-radius:6px;border:.5px solid '+border+';background:'+bg+';cursor:pointer;font-family:inherit;font-size:11px;color:'+color+';font-weight:600">'+mark+'</button>';
          html += '</td>';
        });
        html += '<td style="padding:4px;text-align:right"><button type="button" class="rx-del" data-vi="'+vi+'" style="background:transparent;border:none;color:#0F766E;font-size:14px;cursor:pointer;padding:2px 6px" title="Delete this medication">×</button></td>';
        html += '</tr>';
      });
    });
    html += '</tbody></table></div>';
    grid.innerHTML = html;
    grid.querySelectorAll('.rx-log').forEach(b => b.addEventListener('click', ()=>{ const name=b.dataset.name; if(!name) return; const log=ensureLog(); if(!log) return; const today=localToday(); const time=(new Date()).toTimeString().slice(0,5); log.push({name,date:today,time}); try{typeof save==='function'&&save();}catch(_){} renderRx(); refreshCal(); }));
    // Taken-today checkbox: check = log today's take (shows 💊 on the weekly
    // calendar cell for this med), uncheck = remove today's take(s).
    grid.querySelectorAll('.rx-taken').forEach(cb => cb.addEventListener('change', ()=>{
      const name=cb.dataset.name; if(!name) return;
      const log=ensureLog(); if(!log) return;
      const today=localToday();
      if(cb.checked){
        log.push({name,date:today,time:(new Date()).toTimeString().slice(0,5)});
      }else{
        for(let i=log.length-1;i>=0;i--){ const e=log[i]; if(e&&e.name===name&&e.date===today) log.splice(i,1); }
      }
      try{typeof save==='function'&&save();}catch(_){}
      renderRx();
      refreshCal();
    }));
    grid.querySelectorAll('.rx-cell').forEach(b => b.addEventListener('click', ()=>{ const vi=parseInt(b.dataset.vi,10),di=parseInt(b.dataset.di,10); const v=S.rx[vi]; if(!v) return; if(!Array.isArray(v.days)) v.days=[]; const idx=v.days.indexOf(di); if(idx>=0) v.days.splice(idx,1); else v.days.push(di); try{typeof save==='function'&&save();}catch(_){} renderRx(); }));
    grid.querySelectorAll('.rx-del').forEach(b => b.addEventListener('click', ()=>{ const vi=parseInt(b.dataset.vi,10); if(!confirm('Delete medication "'+(S.rx[vi]&&S.rx[vi].name||'')+'"?')) return; S.rx.splice(vi,1); try{typeof save==='function'&&save();}catch(_){} renderRx(); }));
  }
  function showAddForm(){
    let host = document.getElementById('cal-rx-form');
    if(!host){
      host = document.createElement('div');
      host.id = 'cal-rx-form';
      host.style.cssText = 'background:rgba(255,255,255,.6);border:.5px solid #14B8A6;border-radius:8px;padding:.75rem;margin-bottom:.75rem';
      const grid = document.getElementById('cal-rx-grid');
      if(grid) grid.parentNode.insertBefore(host, grid);
    }
    const freqOpts = FREQS.map(f => '<option value="'+f+'">'+f+'</option>').join('');
    const presetOpts = QUICK_PRESETS.map((p,i) => '<button type="button" data-preset="'+i+'" style="padding:3px 8px;font-size:11px;border:.5px solid #5EEAD4;background:#fff;color:#0F766E;border-radius:5px;cursor:pointer;font-family:inherit">'+p.name+'</button>').join(' ');
    host.innerHTML = ''
      + '<div style="font-size:11px;font-weight:700;color:#0F766E;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Add a prescription</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + presetOpts + '</div>'
      + '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;margin-bottom:8px">'
      +   '<input type="text" id="rx-f-name" placeholder="Name (e.g. Lisinopril)" style="padding:6px 9px;border:.5px solid #14B8A6;border-radius:6px;font-size:12.5px">'
      +   '<input type="text" id="rx-f-dose" placeholder="Dose (e.g. 10 mg)" style="padding:6px 9px;border:.5px solid #14B8A6;border-radius:6px;font-size:12.5px">'
      +   '<select id="rx-f-freq" style="padding:6px 9px;border:.5px solid #14B8A6;border-radius:6px;font-size:12.5px">' + freqOpts + '</select>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;font-size:12px;color:#0F766E;flex-wrap:wrap">'
      +   '<span style="font-weight:600">Take at:</span>'
      +   SLOTS.map(([k,l]) => '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:5px"><input type="checkbox" id="rx-f-slot-'+k+'" style="width:14px;height:14px;cursor:pointer"> '+l+'</label>').join('')
      + '</div>'
      + '<input type="text" id="rx-f-notes" placeholder="Notes (e.g. with food)" style="width:100%;box-sizing:border-box;padding:6px 9px;border:.5px solid #14B8A6;border-radius:6px;font-size:12.5px;margin-bottom:8px">'
      + '<div style="display:flex;justify-content:flex-end;gap:6px">'
      +   '<button type="button" id="rx-f-cancel" class="btn" style="padding:5px 12px;font-size:12px">Cancel</button>'
      +   '<button type="button" id="rx-f-save" class="btn" style="padding:5px 12px;font-size:12px;background:#14B8A6;color:#fff;border-color:#0D9488">Save</button>'
      + '</div>';
    document.getElementById('rx-f-cancel').addEventListener('click', () => host.remove());
    function applySlotChecksForFreq(freq){
      const m=document.getElementById('rx-f-slot-morning'),a=document.getElementById('rx-f-slot-afternoon'),e=document.getElementById('rx-f-slot-evening');
      if(!m||!a||!e) return;
      m.checked=a.checked=e.checked=false;
      if(freq==='3×/day'){ m.checked=a.checked=e.checked=true; }
      else if(freq==='2×/day'){ m.checked=e.checked=true; }
      else if(freq==='Nightly'){ e.checked=true; }
      else { m.checked=true; }
    }
    document.getElementById('rx-f-save').addEventListener('click', () => {
      const name=(document.getElementById('rx-f-name').value||'').trim();
      if(!name){ alert('Name is required.'); return; }
      const dose=(document.getElementById('rx-f-dose').value||'').trim();
      const slots=SLOTS.map(([k])=>k).filter(k=>{const cb=document.getElementById('rx-f-slot-'+k);return cb&&cb.checked;});
      if(slots.length===0){ alert('Select at least one time slot.'); return; }
      const freq=document.getElementById('rx-f-freq').value;
      const notes=(document.getElementById('rx-f-notes').value||'').trim();
      ensureState();
      let days=[0,1,2,3,4,5,6];
      if(freq==='Every other day') days=[0,2,4,6];
      else if(freq==='Weekly') days=[0];
      S.rx.push({name,dose,slot:slots[0],slots,freq,notes,days});
      try{typeof save==='function'&&save();}catch(_){}
      host.remove();
      renderRx();
    });
    host.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', ()=>{
      const p=QUICK_PRESETS[parseInt(b.dataset.preset,10)]; if(!p) return;
      document.getElementById('rx-f-name').value=p.name;
      document.getElementById('rx-f-dose').value=p.dose;
      document.getElementById('rx-f-freq').value=p.freq;
      document.getElementById('rx-f-notes').value=p.notes;
      applySlotChecksForFreq(p.freq);
    }));
    document.getElementById('rx-f-freq').addEventListener('change', function(){ applySlotChecksForFreq(this.value); });
    applySlotChecksForFreq(document.getElementById('rx-f-freq').value);
    setTimeout(()=>{ const n=document.getElementById('rx-f-name'); if(n) n.focus(); }, 50);
  }
  function applyToggle(visible){
    const card = document.getElementById('cal-rx-card');
    const btn = document.getElementById('cal-rx-toggle');
    if(card) card.style.display = visible ? 'block' : 'none';
    if(btn) btn.style.background = visible ? 'rgba(20,184,166,.4)' : 'rgba(240,253,250,.7)';
    try { localStorage.setItem('tmp.rxVisible', visible ? '1' : '0'); } catch(_){}
    if(visible){
      renderRx();
      try { card && card.scrollIntoView({behavior:'smooth', block:'center'}); } catch(_){}
    }
  }
  function wireWeekRefresh(){
    ['btn-prev','btn-next'].forEach(function(id){
      const btn = document.getElementById(id);
      if(!btn || btn.dataset.rxWeekHook === '1') return;
      btn.dataset.rxWeekHook = '1';
      btn.addEventListener('click', function(){
        const card = document.getElementById('cal-rx-card');
        if(card && card.style.display === 'block'){
          setTimeout(function(){ try { renderRx(); } catch(_){} }, 0);
        }
      });
    });
    if(typeof window.__tmpRegisterRenderCalPost === 'function' && !window.__rxCalPostReg){
      window.__rxCalPostReg = true;
      window.__tmpRegisterRenderCalPost(function(){
        const card = document.getElementById('cal-rx-card');
        if(card && card.style.display === 'block'){
          try { renderRx(); } catch(_){}
        }
      });
    }
  }
  function init(){
    const tog = document.getElementById('cal-rx-toggle');
    const addBtn = document.getElementById('cal-rx-add-btn');
    if(!tog) return;
    if(tog.dataset.wired === '1'){
      wireWeekRefresh();
      return;
    }
    tog.dataset.wired = '1';
    // v33.375-stable-vendor-post-import-review: default Rx card to visible by default
    let visible = true;
    let saved = null;
    try { saved = localStorage.getItem('tmp.rxVisible'); } catch(_){}
    if(saved === '0') visible = false;
    applyToggle(visible);
    wireWeekRefresh();
    tog.addEventListener('click', () => {
      const card = document.getElementById('cal-rx-card');
      const isOpen = card && card.style.display === 'block';
      applyToggle(!isOpen);
    });
    if(addBtn && !addBtn.dataset.wired){
      addBtn.dataset.wired = '1';
      addBtn.addEventListener('click', showAddForm);
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(init, 800);
  setTimeout(wireWeekRefresh, 1200);
  window.renderRx = renderRx;
})();


// ===== extracted pre-core patch script =====
(function(){
      function hydrate(){
        try {
          if(localStorage.getItem('tmp.invCardCollapsed') !== '1') return;
        } catch(e){ return; }
        var s=document.getElementById('inv-search'),
            t=document.getElementById('inv-table-wrap'),
            hint=document.getElementById('inv-count-hint'),
            btn=document.getElementById('inv-collapse-btn');
        if(!s||!t||!btn) return;
        s.style.display='none';
        t.style.display='none';
        if(hint){
          var n=(window.S&&S.inv?S.inv.filter(function(i){return!i.isSupply;}).length:0);
          hint.textContent=n+' peptide'+(n===1?'':'s')+' hidden';
        }
        btn.textContent='Show inventory';
        var card=btn.closest('.card');
        if(card) card.setAttribute('data-inv-collapsed','1');
      }
      if(document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded', hydrate);
      } else {
        hydrate();
      }
      setTimeout(hydrate, 800);
    })();


// ===== extracted pre-core patch script =====
(function(){
    function wire(){
      const btn = document.getElementById('pt-reset-reload-btn');
      if(!btn || btn.dataset.wired === '1') return;
      btn.dataset.wired = '1';
      const status = document.getElementById('pt-reset-status');
      function setStatus(t){ if(status){ status.style.display='block'; status.textContent=t; } }
      btn.addEventListener('click', async () => {
        if(!confirm('Reset the app and reload? Your data stays, only the cached app code is wiped.')) return;
        setStatus('Step 1 of 3 — unregistering offline workers…');
        try {
          if(navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
            const rs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(rs.map(r => r.unregister().catch(()=>{})));
          }
        } catch(_){}
        setStatus('Step 2 of 3 — clearing app caches…');
        try {
          if(window.caches && caches.keys){
            const ks = await caches.keys();
            await Promise.all(ks.map(k => caches.delete(k).catch(()=>{})));
          }
        } catch(_){}
        setStatus('Step 3 of 3 — reloading the app…');
        try{var _activeNav=document.querySelector('#nav button.on, .hdr-tab-btn.on');if(_activeNav&&_activeNav.dataset.pg){localStorage.setItem('tmp.lastActivePage',_activeNav.dataset.pg);}else{var _vis=document.querySelector('.page[style*="display:block"], .page[style*="display: block"]');if(_vis&&_vis.id){var _pg=_vis.id.replace(/^pg-/,'');localStorage.setItem('tmp.lastActivePage',_pg);}}}catch(_){}
        try {
          const u = new URL(location.href);
          u.searchParams.set('_reset', String(Date.now()));
          location.replace(u.toString());
        } catch(_){
          try { location.reload(true); } catch(__){ location.reload(); }
        }
      });
    }
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
    else wire();
    setTimeout(wire, 1500);
  })();
