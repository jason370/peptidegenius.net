/* ============================================================================
   vitals.js — TrackMyPeps "Vitals" health-metrics feature (self-contained IIFE)
   ----------------------------------------------------------------------------
   Isolated from the app's fragile render paths. Talks to core via:
     - window.S            plain global state object
     - window.save()       debounced persist  (never touches localStorage here)
     - window.escH()       HTML escape helper for any user string
     - window.Chart        Chart.js v4 UMD (already loaded globally)
   Exposes: window.renderVitals(), window.renderVitalsSummary()

   DATA MODEL — each S.vitals[] entry:
     {
       id:     Number,               // from S.nVit counter
       ts:     ISO string | epoch,   // timestamp of the reading
       w:      kg   | null,          // WEIGHT stored canonical METRIC (kg)
       sys:    mmHg | null,          // systolic blood pressure
       dia:    mmHg | null,          // diastolic blood pressure
       hr:     bpm  | null,          // resting heart rate
       sleep:  hours| null,          // sleep duration
       bf:     %    | null,          // body-fat percentage
       waist:  cm   | null,          // WAIST stored canonical METRIC (cm)
       glu:    mg/dL| null,          // GLUCOSE stored canonical mg/dL
       gluTag: 'fasting'|'post'|''|null,
       hrv:    ms   | null,          // heart-rate variability
       spo2:   %    | null,          // blood oxygen saturation
       temp:   °C   | null,          // BODY TEMP stored canonical METRIC (°C)
       energy: 1..5 | null,          // energy / mood
       note:   String                // optional free text (escaped on render)
     }
   Weight / waist / temp are ALWAYS stored in metric canonical units and
   converted for display based on S.vitalsUnit ('imperial' | 'metric').
   Glucose stored mg/dL, shown as mmol/L only in metric mode.
   ============================================================================ */
(function () {
  'use strict';
  if (window.__tmpVitalsInit) return;
  window.__tmpVitalsInit = true;

  var doc = document;
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // module state
  var currentTrendMetric = 'w';
  var currentRange = '90d';
  var vChart = null;
  var armedDeleteId = null;
  var vtdWRange = '90d';

  /* ---------- tiny helpers ---------------------------------------------- */
  function g(id) { return doc.getElementById(id); }
  function S() { return window.S || {}; }
  function esc(s) {
    var str = (s == null ? '' : String(s));
    if (window.escH) return window.escH(str);
    return str.replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }
  function saveState() { try { if (typeof window.save === 'function') window.save(); } catch (_) {} }
  function vitalsSave() { saveState(); try { renderVitalsSummary(); } catch (_) {} }

  /* ---------- number / unit conversion ---------------------------------- */
  function r1(v) { return Number(Number(v).toFixed(1)); }
  function r0(v) { return Math.round(Number(v)); }
  function kgToLb(kg) { return kg * 2.20462; }
  function lbToKg(lb) { return lb / 2.20462; }
  function cmToIn(cm) { return cm / 2.54; }
  function inToCm(inv) { return inv * 2.54; }
  function cToF(c) { return c * 9 / 5 + 32; }
  function fToC(f) { return (f - 32) * 5 / 9; }
  function isMetric() { return S().vitalsUnit === 'metric'; }

  // display-unit -> internal canonical (used when logging)
  function wFromInput(x)     { return isMetric() ? x : lbToKg(x); }
  function waistFromInput(x) { return isMetric() ? x : inToCm(x); }
  function tempFromInput(x)  { return isMetric() ? x : fToC(x); }
  function gluFromInput(x)   { return isMetric() ? x * 18 : x; }
  function clampEnergy(x)    { x = Math.round(x); return x < 1 ? 1 : (x > 5 ? 5 : x); }

  /* ---------- METRIC DEFS (drive everything) ---------------------------- */
  // dir: 'lower' = lower is better, 'higher' = higher is better, 'neutral'
  function M(key, label, icon, color, dir, unit, toDisp, group) {
    return {
      key: key, label: label, icon: icon, color: color, dir: dir, group: group || '',
      unit: function () { return typeof unit === 'function' ? unit() : unit; },
      toDisp: toDisp,                              // internal number -> display number
      get: function (e) { return e[key]; },        // internal value or null
      disp: function (e) {                         // full display string (plain, escape on insert)
        if (e[key] == null) return null;
        return this.toDisp(e[key]) + ' ' + this.unit();
      }
    };
  }
  var METRICS = [
    M('w',    'Weight',        '⚖️', '#2563EB', 'lower',
      function () { return isMetric() ? 'kg' : 'lb'; },
      function (v) { return isMetric() ? r1(v) : r1(kgToLb(v)); }, 'core'),
    // Blood pressure — composite sys/dia; systolic drives delta + sparkline
    {
      key: 'bp', label: 'Blood pressure', icon: '🩸', color: '#DC2626',
      dir: 'lower', group: 'core',
      unit: function () { return 'mmHg'; },
      toDisp: function (v) { return r0(v); },
      get: function (e) { return e.sys; },
      disp: function (e) {
        if (e.sys == null && e.dia == null) return null;
        return r0(e.sys == null ? 0 : e.sys) + '/' + r0(e.dia == null ? 0 : e.dia) + ' mmHg';
      }
    },
    M('hr',    'Resting HR',   '💗', '#DB2777', 'lower',  'bpm', r0, 'core'),
    M('sleep', 'Sleep',        '😴', '#8B5CF6', 'higher', 'hr',  r1, 'core'),
    M('bf',    'Body fat',     '📊', '#14B8A6', 'lower',  '%',   r1),
    M('waist', 'Waist',        '📏', '#F59E0B', 'lower',
      function () { return isMetric() ? 'cm' : 'in'; },
      function (v) { return isMetric() ? r1(v) : r1(cmToIn(v)); }),
    M('hrv',   'HRV',          '📈', '#0891B2', 'higher', 'ms', r0)
  ];
  function metricByKey(k) { for (var i = 0; i < METRICS.length; i++) if (METRICS[i].key === k) return METRICS[i]; return null; }

  /* ---------- entry helpers -------------------------------------------- */
  function entryMs(e) {
    if (!e) return 0;
    if (typeof e.ts === 'number') return e.ts;
    var t = Date.parse(e.ts);
    return isNaN(t) ? 0 : t;
  }
  function fmtLocalDate(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function entryDateStr(e) { return fmtLocalDate(new Date(entryMs(e))); }
  function localToday() { return fmtLocalDate(new Date()); }
  function fmtDateShort(ms) { var d = new Date(ms); return MONTHS[d.getMonth()] + ' ' + d.getDate(); }
  function fmtDateTime(ms) {
    var d = new Date(ms);
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function sortedEntries() {
    return (S().vitals || []).slice().sort(function (a, b) { return entryMs(a) - entryMs(b); });
  }
  function entriesWith(m) { return sortedEntries().filter(function (e) { return m.get(e) != null; }); }
  function rangeSince(range) {
    var day = 86400000;
    if (range === '30d') return Date.now() - 30 * day;
    if (range === '90d') return Date.now() - 90 * day;
    if (range === '1y') return Date.now() - 365 * day;
    return 0;
  }

  /* ---------- sparkline (inline SVG) ----------------------------------- */
  function sparkline(vals, color) {
    var w = 108, h = 28, pad = 3;
    if (!vals || vals.length < 2) return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"></svg>';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var rng = (max - min) || 1;
    var step = (w - pad * 2) / (vals.length - 1);
    var pts = vals.map(function (v, i) {
      var x = pad + i * step;
      var y = h - pad - ((v - min) / rng) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var last = pts[pts.length - 1].split(',');
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.1" fill="' + color + '"/></svg>';
  }

  /* ---------- delta chip ----------------------------------------------- */
  function deltaChip(m) {
    var es = entriesWith(m);
    if (es.length < 2) return '<span class="vt-chip vt-chip-neutral">—</span>';
    var a = m.toDisp(m.get(es[es.length - 2]));
    var b = m.toDisp(m.get(es[es.length - 1]));
    var d = b - a;
    var dr = Math.round(d * 10) / 10;
    if (dr === 0) return '<span class="vt-chip vt-chip-neutral">±0</span>';
    var good = m.dir === 'lower' ? (d < 0) : (m.dir === 'higher' ? (d > 0) : null);
    var cls = good === null ? 'vt-chip-neutral' : (good ? 'vt-chip-good' : 'vt-chip-bad');
    return '<span class="vt-chip ' + cls + '">' + (d > 0 ? '▲' : '▼') + ' ' + Math.abs(dr) + '</span>';
  }

  /* ---------- metric summary card -------------------------------------- */
  function metricCard(m) {
    var es = entriesWith(m);
    var latest = es.length ? es[es.length - 1] : null;
    var val = latest ? m.disp(latest) : null;
    var spark = sparkline(es.slice(-7).map(function (e) { return m.toDisp(m.get(e)); }), m.color);
    return '<div class="vt-mcard" style="border-top:3px solid ' + m.color + '">' +
      '<div class="vt-mtop"><span class="vt-micon">' + m.icon + '</span><span class="vt-mlabel">' + esc(m.label) + '</span></div>' +
      '<div class="vt-mval">' + (val != null ? esc(String(val)) : '<span class="vt-empty">—</span>') + '</div>' +
      '<div class="vt-mfoot">' + deltaChip(m) + '<span class="vt-mspark">' + spark + '</span></div>' +
      '</div>';
  }

  /* ---------- header + quick log --------------------------------------- */
  function headerCard() {
    var im = !isMetric();
    return '<div class="vt-card" style="border-top:3px solid #2DAFA8">' +
      '<div class="vt-hdr"><div>' +
      '<div class="vt-title">❤ Vitals — Health Metrics</div>' +
      '<div class="vt-sub">Track weight, blood pressure, sleep and more — alongside your protocol.</div>' +
      '</div><div class="vt-seg">' +
      '<button class="vt-segbtn' + (im ? ' on' : '') + '" data-vt-unit="imperial">Imperial</button>' +
      '<button class="vt-segbtn' + (!im ? ' on' : '') + '" data-vt-unit="metric">Metric</button>' +
      '</div></div></div>';
  }
  function quickLogCard() {
    var wU = isMetric() ? 'kg' : 'lb';
    var waistU = isMetric() ? 'cm' : 'in';
    var tU = isMetric() ? '°C' : '°F';
    var gU = isMetric() ? 'mmol/L' : 'mg/dL';
    var now = new Date();
    var d = fmtLocalDate(now);
    var t = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    function fld(label, id) {
      return '<label class="vt-fld"><span>' + label + '</span>' +
        '<input type="number" inputmode="decimal" step="any" id="' + id + '"></label>';
    }
    var h = '<div class="vt-card"><div class="vt-cardh">Quick log</div><div class="vt-form">';
    h += '<label class="vt-fld"><span>Date</span><input type="date" id="vt-in-date" value="' + d + '"></label>';
    h += '<label class="vt-fld"><span>Time</span><input type="time" id="vt-in-time" value="' + t + '"></label>';
    h += fld('Weight (' + wU + ')', 'vt-in-w');
    h += '<label class="vt-fld"><span>Blood pressure</span><span class="vt-bp">' +
         '<input type="number" inputmode="numeric" id="vt-in-sys" placeholder="sys"><span>/</span>' +
         '<input type="number" inputmode="numeric" id="vt-in-dia" placeholder="dia"></span></label>';
    h += fld('Resting HR (bpm)', 'vt-in-hr');
    h += fld('Sleep (hr)', 'vt-in-sleep');
    h += fld('Body fat (%)', 'vt-in-bf');
    h += fld('Waist (' + waistU + ')', 'vt-in-waist');
    h += fld('HRV (ms)', 'vt-in-hrv');
    h += '<label class="vt-fld vt-fld-wide"><span>Note</span><input type="text" id="vt-in-note" maxlength="200" placeholder="optional"></label>';
    h += '</div><div class="vt-formactions"><span id="vt-log-msg" class="vt-log-msg" aria-live="polite"></span><button class="vt-btn vt-btn-primary" data-vt-log="1">Log reading</button></div></div>';
    return h;
  }

  function readNum(id) {
    var el = g(id);
    if (!el) return null;
    var v = (el.value || '').trim();
    if (v === '') return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }
  function doLog() {
    var st = S();
    var date = (g('vt-in-date') && g('vt-in-date').value) || localToday();
    var time = (g('vt-in-time') && g('vt-in-time').value) || '12:00';
    var ms = Date.parse(date + 'T' + (time.length === 5 ? time : '12:00') + ':00');
    if (isNaN(ms)) ms = Date.now();
    var w = readNum('vt-in-w'), sys = readNum('vt-in-sys'), dia = readNum('vt-in-dia'),
        hr = readNum('vt-in-hr'), sleep = readNum('vt-in-sleep'), bf = readNum('vt-in-bf'),
        waist = readNum('vt-in-waist'), hrv = readNum('vt-in-hrv');
    var note = (g('vt-in-note') && (g('vt-in-note').value || '').trim()) || '';
    var any = [w, sys, dia, hr, sleep, bf, waist, hrv]
      .some(function (x) { return x != null; }) || note !== '';
    if (!any) {
      var msg = g('vt-log-msg');
      if (msg) { msg.textContent = 'Enter at least one value to log.'; msg.style.color = '#B45309'; setTimeout(function(){ if(g('vt-log-msg')===msg) msg.textContent=''; }, 4000); }
      return;
    }
    var e = {
      id: (st.nVit || 1),
      ts: new Date(ms).toISOString(),
      w: w == null ? null : wFromInput(w),
      sys: sys, dia: dia,
      hr: hr, sleep: sleep, bf: bf,
      waist: waist == null ? null : waistFromInput(waist),
      hrv: hrv,
      note: note
    };
    st.nVit = (st.nVit || 1) + 1;
    if (!Array.isArray(st.vitals)) st.vitals = [];
    st.vitals.push(e);
    vitalsSave();
    renderVitals();
  }

  /* ---------- grid / trend / history sections -------------------------- */
  function gridCards() {
    return '<div class="vt-card"><div class="vt-cardh">Latest metrics</div><div class="vt-grid">' +
      METRICS.map(metricCard).join('') + '</div></div>';
  }
  function trendSection() {
    var mbtns = METRICS.map(function (m) {
      return '<button class="vt-pill' + (m.key === currentTrendMetric ? ' on' : '') +
        '" data-vt-metric="' + m.key + '" style="--vt-c:' + m.color + '">' + m.icon + ' ' + esc(m.label) + '</button>';
    }).join('');
    var ranges = ['30d', '90d', '1y', 'All'].map(function (r) {
      return '<button class="vt-pill' + (r === currentRange ? ' on' : '') + '" data-vt-range="' + r + '">' + r + '</button>';
    }).join('');
    return '<div class="vt-card"><div class="vt-cardh">Trend</div>' +
      '<div class="vt-pills">' + mbtns + '</div>' +
      '<div class="vt-pills vt-ranges">' + ranges + '</div>' +
      '<div class="vt-chartwrap"><canvas id="vt-trend-canvas"></canvas></div>' +
      '<div class="vt-legend">Dashed teal lines mark protocol shot dates.</div></div>';
  }
  function historyRow(e) {
    var when = fmtDateTime(entryMs(e));
    var chips = METRICS.map(function (m) {
      var d = m.disp(e);
      return d ? '<span class="vt-hchip" style="border-color:' + m.color + '55">' +
        '<b style="color:' + m.color + '">' + m.icon + '</b> ' + esc(String(d)) + '</span>' : '';
    }).join('');
    var note = e.note ? '<div class="vt-hnote">' + esc(e.note) + '</div>' : '';
    var armed = armedDeleteId === e.id;
    var del = '<button class="vt-del' + (armed ? ' vt-del-armed' : '') + '" data-vid="' + e.id + '">' +
      (armed ? 'Confirm?' : '✕') + '</button>';
    return '<div class="vt-hrow"><div class="vt-hmain"><div class="vt-hwhen">' + esc(when) + '</div>' +
      '<div class="vt-hchips">' + chips + '</div>' + note + '</div>' + del + '</div>';
  }
  function historySection() {
    var es = sortedEntries().reverse().slice(0, 40);
    return '<div class="vt-card"><div class="vt-cardh">History</div><div class="vt-hist">' +
      es.map(historyRow).join('') + '</div></div>';
  }
  function emptyState() {
    return '<div class="vt-card vt-emptycard"><div class="vt-emptybig">❤</div>' +
      '<div class="vt-emptytitle">Log your first reading</div>' +
      '<div class="vt-emptymsg">Enter any metric above — weight, blood pressure, resting heart rate, sleep — and your trends, deltas and charts will start building here.</div></div>';
  }

  /* ---------- Chart.js trend chart + shot markers ---------------------- */
  function buildShotMarkers(since) {
    var shots = S().shots || [];
    var byDate = {};
    shots.forEach(function (s) {
      if (!s || !s.date) return;
      var ms = Date.parse(s.date + 'T12:00:00');
      if (isNaN(ms) || ms < since) return;
      (byDate[s.date] = byDate[s.date] || []).push(s);
    });
    var dates = Object.keys(byDate).sort();
    var arr = dates.map(function (d) {
      var list = byDate[d];
      var peps = {};
      list.forEach(function (s) { if (s.peptide) peps[s.peptide] = 1; });
      var names = Object.keys(peps);
      var label = names.length === 1 ? names[0] : (list.length + ' shots');
      return { ms: Date.parse(d + 'T12:00:00'), label: label };
    });
    if (arr.length > 8) arr = arr.slice(arr.length - 8);
    return arr;
  }
  function shotMarkerPlugin(markers) {
    return {
      id: 'vtShotMarkers',
      afterDatasetsDraw: function (chart) {
        if (!markers || !markers.length) return;
        var ctx = chart.ctx, xs = chart.scales.x, area = chart.chartArea;
        if (!xs || !area) return;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(45,175,168,.55)';
        ctx.lineWidth = 1;
        ctx.font = '9px sans-serif';
        ctx.fillStyle = 'rgba(45,175,168,.95)';
        markers.forEach(function (mk) {
          var px = xs.getPixelForValue(mk.ms);
          if (px < area.left - 0.5 || px > area.right + 0.5) return;
          ctx.beginPath();
          ctx.moveTo(px, area.top);
          ctx.lineTo(px, area.bottom);
          ctx.stroke();
          if (mk.label) {
            ctx.save();
            ctx.translate(px + 3, area.top + 2);
            ctx.rotate(Math.PI / 2);
            ctx.fillText(String(mk.label).slice(0, 14), 0, 0);
            ctx.restore();
          }
        });
        ctx.restore();
      }
    };
  }
  function drawChart() {
    var canvas = g('vt-trend-canvas');
    if (!canvas || !window.Chart) return;
    var m = metricByKey(currentTrendMetric) || METRICS[0];
    var since = rangeSince(currentRange);
    var es = sortedEntries().filter(function (e) { return m.get(e) != null && entryMs(e) >= since; });
    var data = es.map(function (e) { return { x: entryMs(e), y: m.toDisp(m.get(e)) }; });
    var markers = buildShotMarkers(since);
    if (vChart) { try { vChart.destroy(); } catch (_) {} vChart = null; }
    try {
      vChart = new window.Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          datasets: [{
            label: m.label,
            data: data,
            borderColor: m.color,
            backgroundColor: m.color + '22',
            tension: 0.25,
            pointRadius: data.length > 40 ? 0 : 3,
            pointBackgroundColor: m.color,
            fill: true,
            spanGaps: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: {
              type: 'linear',
              ticks: { callback: function (v) { return fmtDateShort(v); }, maxTicksLimit: 6, autoSkip: true },
              grid: { display: false }
            },
            y: { beginAtZero: false }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function (items) { return items.length ? fmtDateShort(items[0].parsed.x) : ''; },
                label: function (it) { return m.label + ': ' + it.parsed.y + ' ' + m.unit(); }
              }
            }
          }
        },
        plugins: [shotMarkerPlugin(markers)]
      });
    } catch (err) { /* chart is a nicety — never break the page */ }
  }

  /* ---------- main render ---------------------------------------------- */
  function renderVitals() {
    var page = g('pg-vitals');
    if (!page) return;
    injectCSS();
    var vitals = S().vitals || [];
    var html = headerCard() + quickLogCard();
    if (vitals.length) {
      html += gridCards() + trendSection() + historySection();
    } else {
      html += emptyState();
    }
    page.innerHTML = '<div class="vt-wrap">' + html + '</div>';
    ensureVitalsListener();
    if (vitals.length) drawChart();
  }

  function syncTrendButtons() {
    var page = g('pg-vitals');
    if (!page) return;
    page.querySelectorAll('[data-vt-metric]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-vt-metric') === currentTrendMetric);
    });
    page.querySelectorAll('[data-vt-range]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-vt-range') === currentRange);
    });
  }
  function handleDelete(id) {
    if (armedDeleteId !== id) { armedDeleteId = id; renderVitals(); return; }
    var arr = S().vitals || [];
    var i = arr.findIndex(function (e) { return e.id === id; });
    if (i >= 0) arr.splice(i, 1);
    armedDeleteId = null;
    vitalsSave();
    renderVitals();
  }
  // single delegated listener on the persistent #pg-vitals container
  function ensureVitalsListener() {
    var page = g('pg-vitals');
    if (!page || page.dataset.vtWired) return;
    page.dataset.vtWired = '1';
    page.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var u = t.closest('[data-vt-unit]');
      if (u) { S().vitalsUnit = u.getAttribute('data-vt-unit'); vitalsSave(); renderVitals(); return; }
      if (t.closest('[data-vt-log]')) { doLog(); return; }
      var mp = t.closest('[data-vt-metric]');
      if (mp) { currentTrendMetric = mp.getAttribute('data-vt-metric'); syncTrendButtons(); drawChart(); return; }
      var rg = t.closest('[data-vt-range]');
      if (rg) { currentRange = rg.getAttribute('data-vt-range'); syncTrendButtons(); drawChart(); return; }
      var del = t.closest('[data-vid]');
      if (del) { handleDelete(parseInt(del.getAttribute('data-vid'), 10)); return; }
    });
  }

  /* ---------- Daily Stack summary card --------------------------------- */
  function summaryTile(m) {
    var es = entriesWith(m);
    var latest = es.length ? es[es.length - 1] : null;
    var val = latest ? m.disp(latest) : '—';
    var spark = sparkline(es.slice(-7).map(function (e) { return m.toDisp(m.get(e)); }), m.color);
    return '<div class="vt-tile" style="border-left:3px solid ' + m.color + '">' +
      '<div class="vt-tlabel">' + m.icon + ' ' + esc(m.label) + '</div>' +
      '<div class="vt-tval">' + esc(String(val)) + '</div>' +
      '<div class="vt-tspark">' + spark + '</div></div>';
  }
  function injectDailyCSS() {
    if (g('vtd-style')) return;
    var css =
      '.vt-daily{display:flex;flex-direction:column;gap:13px}' +
      '.vtd-datehead{display:flex;align-items:baseline;justify-content:space-between;padding:2px 4px}' +
      '.vtd-weekday{font-size:20px;font-weight:600;letter-spacing:-.01em;color:#1c2b33}' +
      '.vtd-when{font-size:12.5px;color:#93a3af}' +
      '.vtd-card{width:100%;box-sizing:border-box;background:#fff;border-radius:18px;padding:20px 24px;box-shadow:0 1px 2px rgba(28,43,51,.04),0 6px 20px rgba(28,43,51,.05)}' +
      '.vtd-vcard{padding:24px 30px;border-top:3px solid #2DAFA8;box-shadow:0 1px 2px rgba(28,43,51,.04),0 10px 30px rgba(28,43,51,.07)}' +
      '.vtd-kickrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}' +
      '.vtd-kicker{font-size:11.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8a9aa6}' +
      '.vtd-link{font-size:13px;font-weight:500;color:#2DAFA8;cursor:pointer}' +
      '.vtd-vitals{display:grid;grid-template-columns:repeat(5,1fr)}' +
      '.vtd-vcol{display:flex;flex-direction:column;gap:5px;padding:0 20px}' +
      '.vtd-vcol+.vtd-vcol{border-left:1px solid #eef2f5}' +
      '.vtd-vcol:first-child{padding-left:0}.vtd-vcol:last-child{padding-right:0}' +
      '.vtd-vlabel{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;color:#8a9aa6}' +
      '.vtd-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}' +
      '.vtd-vval{font-size:30px;font-weight:600;letter-spacing:-.025em;color:#1c2b33;font-variant-numeric:tabular-nums;line-height:1.1}' +
      '.vtd-vspark{margin:3px 0}.vtd-vspark svg{width:100%;height:20px;display:block}' +
      '.vtd-vsub{font-size:11.5px;color:#b4c0ca;font-variant-numeric:tabular-nums}' +
      '.vtd-row{display:grid;gap:13px}' +
      '.vtd-row-2a{grid-template-columns:1.4fr 1fr}' +
      '.vtd-row-2{grid-template-columns:1fr 1fr}' +
      '.vtd-today-row{display:flex;align-items:center;gap:11px;padding:9px 0}' +
      '.vtd-today-row+.vtd-today-row{border-top:1px solid #f4f7f9}' +
      '.vtd-tdot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}' +
      '.vtd-tname{flex:1;font-size:14px;font-weight:500;color:#1c2b33}' +
      '.vtd-tmeta{font-size:12px;color:#93a3af}' +
      '.vtd-tstat{font-size:11px;font-weight:600;color:#93a3af}' +
      '.vtd-tstat-on{color:#2DAFA8}' +
      '.vtd-meta{font-size:12px;color:#93a3af}' +
      '.vtd-bars{display:flex;align-items:flex-end;gap:8px;height:46px;margin-bottom:13px}' +
      '.vtd-bar{flex:1;border-radius:4px;background:#E4EEF0}' +
      '.vtd-bar-on{background:#2DAFA8}' +
      '.vtd-hair{height:1px;background:#eef2f5;margin:11px 0}' +
      '.vtd-statline{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#8a9aa6}' +
      '.vtd-statline+.vtd-statline{margin-top:7px}' +
      '.vtd-statline b{font-size:14px;font-weight:600;color:#1c2b33}' +
      '.vtd-info{display:flex;align-items:center;gap:14px;cursor:pointer;padding:16px 20px}' +
      '.vtd-iico{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex:0 0 auto}' +
      '.vtd-ilabel{font-size:12px;color:#8a9aa6}' +
      '.vtd-ival{font-size:15px;font-weight:600;color:#1c2b33}' +
      '.vtd-ival-warn{color:#C08A3E}' +
      '.vtd-wpills{display:flex;gap:4px}' +
      '.vtd-wpill{font-size:11px;padding:3px 9px;border-radius:8px;background:#f1f5f8;color:#93a3af;cursor:pointer}' +
      '.vtd-wpill.on{background:#2DAFA8;color:#fff;font-weight:600}' +
      '.vtd-wtop{display:flex;align-items:baseline;gap:10px}' +
      '.vtd-wbig{font-size:32px;font-weight:600;color:#1c2b33;letter-spacing:-.025em;font-variant-numeric:tabular-nums}' +
      '.vtd-wbig span{font-size:13px;color:#93a3af;font-weight:400}' +
      '.vtd-wdelta{font-size:13px;font-weight:600}' +
      '.vtd-wd-down{color:#1f9d74}.vtd-wd-up{color:#C0603E}' +
      '.vtd-wsub{font-size:11.5px;color:#93a3af;margin:2px 0 10px}' +
      '.vtd-wchart svg{width:100%;height:110px;display:block}' +
      '#pg-stack #gpt-daily-cockpit,#pg-stack #gpt-daily-command,#pg-stack #gpt-stack-ai,#pg-stack #hero-stats,#pg-stack .gpt-classic-stack,#pg-stack #circulation-card,#pg-stack #interval-card{display:none !important}' +
      '[data-theme="dark"] .vtd-weekday,[data-theme="dark"] .vtd-vval,[data-theme="dark"] .vtd-tname,[data-theme="dark"] .vtd-ival,[data-theme="dark"] .vtd-statline b{color:#E5E7EB}' +
      '[data-theme="dark"] .vtd-when,[data-theme="dark"] .vtd-kicker,[data-theme="dark"] .vtd-vlabel,[data-theme="dark"] .vtd-meta,[data-theme="dark"] .vtd-tmeta,[data-theme="dark"] .vtd-tstat,[data-theme="dark"] .vtd-statline,[data-theme="dark"] .vtd-ilabel{color:#94A3B8}' +
      '[data-theme="dark"] .vtd-vsub{color:#64748B}' +
      '[data-theme="dark"] .vtd-card{background:#16202a;border:1px solid rgba(148,163,184,.12);box-shadow:none}' +
      '[data-theme="dark"] .vtd-vcard{box-shadow:none;border-top:3px solid #2DAFA8}' +
      '[data-theme="dark"] .vtd-vcol+.vtd-vcol{border-left-color:rgba(148,163,184,.14)}' +
      '[data-theme="dark"] .vtd-today-row+.vtd-today-row{border-top-color:rgba(148,163,184,.14)}' +
      '[data-theme="dark"] .vtd-hair{background:rgba(148,163,184,.14)}' +
      '[data-theme="dark"] .vtd-bar{background:#23323d}' +
      '[data-theme="dark"] .vtd-wbig{color:#E5E7EB}' +
      '[data-theme="dark"] .vtd-wpill{background:#23323d;color:#94A3B8}' +
      '[data-theme="dark"] .vtd-link,[data-theme="dark"] .vtd-tstat-on{color:#2DAFA8}';
    var st = doc.createElement('style'); st.id = 'vtd-style'; st.textContent = css;
    (doc.head || doc.documentElement).appendChild(st);
  }
  function vtdDayN() {
    try {
      var sh = S().shots || []; if (!sh.length) return null;
      var min = null; sh.forEach(function (s) { if (s && s.date && (min === null || s.date < min)) min = s.date; });
      if (!min) return null;
      var a = new Date(min + 'T00:00:00'), b = new Date(localToday() + 'T00:00:00');
      var n = Math.floor((b - a) / 86400000) + 1; return n < 1 ? 1 : n;
    } catch (_) { return null; }
  }
  function vtdCoreTiles() {
    return ['w', 'bp', 'hr', 'sleep', 'hrv'].map(function (k) {
      var m = metricByKey(k); if (!m) return '';
      var es = entriesWith(m);
      var latest = es.length ? es[es.length - 1] : null;
      var prev = es.length > 1 ? es[es.length - 2] : null;
      var valTxt = '\u2014';
      if (latest) {
        if (k === 'bp') valTxt = r0(latest.sys == null ? 0 : latest.sys) + '<span style="color:#cfd8de">/</span>' + r0(latest.dia == null ? 0 : latest.dia);
        else valTxt = String(m.toDisp(m.get(latest)));
      }
      var sub = latest ? esc(m.unit()) : 'no readings';
      if (latest && prev) {
        var d = m.toDisp(m.get(latest)) - m.toDisp(m.get(prev));
        if (!isNaN(d) && d !== 0) sub += ' \u00B7 ' + (d > 0 ? '\u25B2' : '\u25BC') + ' ' + Math.abs(Number(d.toFixed(1)));
      }
      var vals = es.slice(-7).map(function (e) { return m.toDisp(m.get(e)); });
      var spark = sparkline(vals, m.color).replace('<svg ', '<svg preserveAspectRatio="none" ');
      return '<div class="vtd-vcol">' +
        '<div class="vtd-vlabel"><span class="vtd-dot" style="background:' + m.color + '"></span>' + esc(m.label) + '</div>' +
        '<div class="vtd-vval">' + valTxt + '</div>' +
        '<div class="vtd-vspark">' + spark + '</div>' +
        '<div class="vtd-vsub">' + sub + '</div></div>';
    }).join('');
  }
  function vtdToday() {
    try {
      var sched = S().sched || {}, todayIdx = (new Date().getDay() + 6) % 7, today = localToday();
      var shotsToday = {}; (S().shots || []).forEach(function (s) { if (s && s.date === today && s.peptide) shotsToday[s.peptide] = 1; });
      var inv = S().inv || [], seen = {}, rows = [];
      Object.keys(sched).forEach(function (key) {
        if (!sched[key]) return;
        var parts = key.split('/'); var di = parseInt(parts[parts.length - 1], 10);
        if (di !== todayIdx) return;
        var time = parts.length >= 3 ? parts[parts.length - 2] : '';
        var name = parts.slice(0, parts.length - 2).join('/');
        var ampm = (time === 'pm' || time === 'dinner' || time === 'bedtime') ? 'PM' : 'AM';
        var dk = name + '|' + ampm; if (seen[dk]) return; seen[dk] = 1;
        var it = null; for (var i = 0; i < inv.length; i++) { if (inv[i] && inv[i].name === name) { it = inv[i]; break; } }
        var dose = (it && it.dose) ? (window.fmtDose ? window.fmtDose(it.dose, it.doseUnit) : (it.dose + ' ' + (it.doseUnit || ''))) : '';
        rows.push({ name: name, ampm: ampm, dose: dose, logged: !!shotsToday[name] });
      });
      return rows;
    } catch (_) { return []; }
  }
  function vtdStreak() {
    try {
      var set = {}; (S().shots || []).forEach(function (s) { if (s && s.date) set[s.date] = 1; });
      var d = new Date(localToday() + 'T00:00:00');
      if (!set[localToday()]) d.setDate(d.getDate() - 1);
      var n = 0, i = 0;
      while (i < 400) { if (set[fmtLocalDate(d)]) { n++; d.setDate(d.getDate() - 1); } else break; i++; }
      return n;
    } catch (_) { return 0; }
  }
  function vtdWeekBars() {
    var counts = [0, 0, 0, 0, 0, 0, 0];
    try { var sched = S().sched || {}; Object.keys(sched).forEach(function (key) { if (!sched[key]) return; var di = parseInt(key.split('/').pop(), 10); if (di >= 0 && di <= 6) counts[di]++; }); } catch (_) {}
    var max = Math.max.apply(null, counts) || 1;
    return { counts: counts, max: max, today: (new Date().getDay() + 6) % 7 };
  }
  function vtdAdherence() {
    try {
      var sched = S().sched || {}, scheduled = 0;
      Object.keys(sched).forEach(function (k) { if (sched[k]) scheduled++; });
      if (!scheduled) return null;
      var now = new Date(), day = (now.getDay() + 6) % 7;
      var monday = new Date(now); monday.setDate(now.getDate() - day); monday.setHours(0, 0, 0, 0);
      var sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
      var logged = 0; (S().shots || []).forEach(function (s) { if (!s || !s.date) return; var d = new Date(s.date + 'T00:00:00'); if (d >= monday && d < sunday) logged++; });
      var pct = Math.round(logged / scheduled * 100); return pct < 0 ? 0 : (pct > 100 ? 100 : pct);
    } catch (_) { return null; }
  }
  function vtdRunout() {
    try {
      var v = g('stats-runout'), l = g('stats-runout-label');
      var val = v ? (v.textContent || '').trim() : '', name = l ? (l.textContent || '').trim() : '';
      if (val && val !== '\u2014' && val !== '-') return { warn: true, text: (name ? name + ' \u00B7 ' : '') + val + ' left' };
    } catch (_) {}
    return { warn: false, text: 'Supply OK' };
  }
  function vtdLastShot() {
    try {
      var sh = (S().shots || []).filter(function (s) { return s && s.date; });
      if (!sh.length) return 'No shots logged yet';
      sh.sort(function (a, b) { return (a.date + (a.timeStr || '')).localeCompare(b.date + (b.timeStr || '')); });
      var last = sh[sh.length - 1];
      var t = (last.timeStr && /^\d\d:\d\d/.test(last.timeStr)) ? last.timeStr : (last.time === 'pm' ? '20:00' : '08:00');
      var d = new Date(last.date + 'T' + t + ':00'), diff = Date.now() - d.getTime(), when;
      if (diff < 0) when = 'today';
      else if (diff < 3600000) when = 'just now';
      else if (diff < 86400000) when = Math.floor(diff / 3600000) + 'h ago';
      else when = Math.floor(diff / 86400000) + 'd ago';
      return esc(last.peptide || 'Shot') + ' \u00B7 ' + when;
    } catch (_) { return 'No shots logged yet'; }
  }
  function vtdWeightSvg(pts) {
    var W = 380, H = 110, pad = 8;
    if (!pts || pts.length < 2) return '';
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts), rng = (max - min) || 1, n = pts.length;
    var xy = pts.map(function (v, i) { var x = (i / (n - 1)) * W; var y = pad + (1 - (v - min) / rng) * (H - 2 * pad); return x.toFixed(1) + ',' + y.toFixed(1); });
    var line = xy.join(' '), area = line + ' ' + W + ',' + H + ' 0,' + H, last = xy[xy.length - 1].split(',');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<polyline points="' + area + '" fill="#2DAFA8" opacity="0.07"></polyline>' +
      '<polyline points="' + line + '" fill="none" stroke="#2DAFA8" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="#2DAFA8"></circle></svg>';
  }
  function vtdWeightCard() {
    try {
      var m = metricByKey('w'); if (!m) return '';
      var es = entriesWith(m);
      var since = vtdWRange === '30d' ? Date.now() - 30 * 86400000 : vtdWRange === '90d' ? Date.now() - 90 * 86400000 : 0;
      var re = es.filter(function (e) { return entryMs(e) >= since; });
      var pills = ['30d', '90d', 'All'].map(function (r) { return '<span class="vtd-wpill' + (r === vtdWRange ? ' on' : '') + '" data-vtd-wrange="' + r + '">' + r + '</span>'; }).join('');
      var head = '<div class="vtd-kickrow" style="margin-bottom:12px"><span class="vtd-kicker">Weight</span><span class="vtd-wpills">' + pills + '</span></div>';
      if (!re.length) return '<div class="vtd-card">' + head + '<div class="vtd-meta" style="padding:14px 0">Log your weight to see the trend.</div></div>';
      var vals = re.map(function (e) { return m.toDisp(m.get(e)); });
      var cur = vals[vals.length - 1], delta = Number((cur - vals[0]).toFixed(1));
      var dcls = delta < 0 ? 'down' : (delta > 0 ? 'up' : '');
      var dtxt = delta === 0 ? 'no change' : ((delta < 0 ? '\u2193 ' : '\u2191 ') + Math.abs(delta) + ' ' + m.unit());
      return '<div class="vtd-card">' + head +
        '<div class="vtd-wtop"><span class="vtd-wbig">' + cur + '<span> ' + esc(m.unit()) + '</span></span>' +
        '<span class="vtd-wdelta vtd-wd-' + dcls + '">' + dtxt + '</span></div>' +
        '<div class="vtd-wsub">' + (vtdWRange === 'All' ? 'since you started' : 'past ' + vtdWRange) + '</div>' +
        '<div class="vtd-wchart">' + vtdWeightSvg(vals) + '</div></div>';
    } catch (_) { return '<div class="vtd-card"><div class="vtd-meta">Weight unavailable.</div></div>'; }
  }
  function renderVitalsSummary() {
    var el = g('vitals-daily-card');
    if (!el) return;
    injectDailyCSS();
    var now = new Date();
    var WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var dayN = vtdDayN();
    var whenTxt = MONTHS[now.getMonth()] + ' ' + now.getDate() + (dayN ? ' \u00B7 Day ' + dayN + ' of protocol' : '');
    var hero = '<div class="vtd-card vtd-vcard"><div class="vtd-kickrow"><span class="vtd-kicker">Vitals</span>' +
      '<span class="vtd-link" data-vtd-go="vitals">Log today \u203A</span></div>' +
      '<div class="vtd-vitals">' + vtdCoreTiles() + '</div></div>';
    var rows = vtdToday();
    var loggedN = rows.filter(function (r) { return r.logged; }).length, dueN = rows.length - loggedN;
    var extra = ''; if (rows.length > 8) { extra = '<div class="vtd-tmeta" style="padding-top:8px">+' + (rows.length - 8) + ' more</div>'; rows = rows.slice(0, 8); }
    var todayHtml = rows.length ? rows.map(function (r) {
      var color = (window.colorForPeptide && window.colorForPeptide(r.name)) || '#2DAFA8';
      return '<div class="vtd-today-row"><span class="vtd-tdot" style="background:' + color + '"></span>' +
        '<span class="vtd-tname">' + esc(r.name) + '</span>' +
        '<span class="vtd-tmeta">' + (r.dose ? esc(r.dose) + ' \u00B7 ' : '') + r.ampm + '</span>' +
        '<span class="vtd-tstat' + (r.logged ? ' vtd-tstat-on' : '') + '">' + (r.logged ? 'logged' : 'due') + '</span></div>';
    }).join('') + extra : '<div class="vtd-meta" style="padding:6px 0">No doses scheduled today.</div>';
    var todayCard = '<div class="vtd-card"><div class="vtd-kickrow" style="margin-bottom:12px"><span class="vtd-kicker">Today</span>' +
      '<span class="vtd-meta">' + loggedN + ' logged \u00B7 ' + dueN + ' due</span></div>' + todayHtml + '</div>';
    var weekCard = vtdWeightCard();
    var ro = vtdRunout();
    var runCard = '<div class="vtd-card vtd-info" data-vtd-go="inventory"><span class="vtd-iico" style="background:#FCF3E5">\uD83D\uDCE6</span>' +
      '<div style="flex:1"><div class="vtd-ilabel">' + (ro.warn ? 'Running low' : 'Supply') + '</div>' +
      '<div class="vtd-ival' + (ro.warn ? ' vtd-ival-warn' : '') + '">' + esc(ro.text) + '</div></div></div>';
    var lastCard = '<div class="vtd-card vtd-info" data-vtd-go="log"><span class="vtd-iico" style="background:#EAF4F1">\uD83D\uDC89</span>' +
      '<div style="flex:1"><div class="vtd-ilabel">Last shot</div><div class="vtd-ival">' + vtdLastShot() + '</div></div></div>';
    el.innerHTML = '<div class="vt-daily">' +
      '<div class="vtd-datehead"><span class="vtd-weekday">' + WD[now.getDay()] + '</span><span class="vtd-when">' + esc(whenTxt) + '</span></div>' +
      hero +
      '<div class="vtd-row vtd-row-2a">' + todayCard + weekCard + '</div>' +
      '<div class="vtd-row vtd-row-2">' + runCard + lastCard + '</div>' +
      '</div>';
    ensureSummaryListener();
  }
  function ensureSummaryListener() {
    var el = g('vitals-daily-card');
    if (!el || el.dataset.vtWired) return;
    el.dataset.vtWired = '1';
    el.addEventListener('click', function (ev) {
      var t = ev.target; if (!t || !t.closest) return;
      var wr = t.closest('[data-vtd-wrange]'); if (wr) { vtdWRange = wr.getAttribute('data-vtd-wrange'); renderVitalsSummary(); return; }
      var go = t.closest('[data-vtd-go]');
      if (go) { var nb = document.querySelector('#nav [data-pg=' + go.getAttribute('data-vtd-go') + ']'); if (nb) nb.click(); return; }
      if (t.closest('[data-vt-goto]')) { var nb2 = document.querySelector('#nav [data-pg=vitals]'); if (nb2) nb2.click(); }
    });
  }

  /* ---------- injected CSS (own surfaces only) ------------------------- */
  function injectCSS() {
    if (g('vt-style')) return;
    var css =
      '.vt-wrap{display:flex;flex-direction:column;gap:14px}' +
      '.vt-card{background:#fff;border:1px solid #dde6ee;border-radius:13px;padding:14px 16px;box-shadow:0 1px 2px rgba(20,40,60,.04)}' +
      '.vt-cardh{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#2F7184;margin-bottom:10px}' +
      '.vt-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
      '.vt-title{font-size:16px;font-weight:700;color:#2F7184}' +
      '.vt-sub{font-size:12px;color:#6b7a88;margin-top:2px}' +
      '.vt-seg{display:inline-flex;border:1px solid #cfdbe6;border-radius:9px;overflow:hidden;flex:0 0 auto}' +
      '.vt-segbtn{border:none;background:#f4f8fb;color:#42606f;font:inherit;font-size:12px;font-weight:600;padding:6px 14px;cursor:pointer}' +
      '.vt-segbtn.on{background:#2DAFA8;color:#fff}' +
      '.vt-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}' +
      '.vt-fld{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#5b6b78;font-weight:600}' +
      '.vt-fld-wide{grid-column:1/-1}' +
      '.vt-fld input,.vt-fld select{font:inherit;font-size:13px;padding:7px 9px;border:1px solid #cfdbe6;border-radius:8px;background:#fff;color:#243542;width:100%}' +
      '.vt-bp{display:flex;align-items:center;gap:5px}.vt-bp input{flex:1;min-width:0}.vt-bp select{flex:0 0 auto;width:auto}' +
      '.vt-formactions{margin-top:12px;text-align:right;display:flex;align-items:center;justify-content:flex-end;gap:12px}' +
      '.vt-log-msg{font-size:12px;font-weight:600}' +
      '.vt-btn{font:inherit;font-size:13px;font-weight:600;padding:8px 18px;border-radius:9px;border:1px solid #cfdbe6;background:#f4f8fb;color:#2F7184;cursor:pointer}' +
      '.vt-btn-primary{background:#2DAFA8;border-color:#25998f;color:#fff}' +
      '.vt-btn-sm{padding:4px 12px;font-size:12px}' +
      '.vt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}' +
      '.vt-mcard{background:#fff;border:1px solid #dde6ee;border-radius:11px;padding:10px 11px;display:flex;flex-direction:column;gap:6px}' +
      '.vt-mtop{display:flex;align-items:center;gap:6px}.vt-micon{font-size:14px}' +
      '.vt-mlabel{font-size:11px;font-weight:600;color:#5b6b78}' +
      '.vt-mval{font-size:19px;font-weight:700;color:#243542;line-height:1.1}' +
      '.vt-mval .vt-empty{color:#aab6c2;font-weight:600}' +
      '.vt-mfoot{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:auto}' +
      '.vt-chip{font-size:11px;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap}' +
      '.vt-chip-good{background:#e5f6ee;color:#0f9d58}.vt-chip-bad{background:#fdeaea;color:#d23f3f}.vt-chip-neutral{background:#eef2f6;color:#8090a0}' +
      '.vt-pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}' +
      '.vt-pill{font:inherit;font-size:12px;font-weight:600;padding:5px 11px;border-radius:20px;border:1px solid #d6e0ea;background:#f7fafc;color:#4a5c6a;cursor:pointer}' +
      '.vt-pill.on{background:var(--vt-c,#2DAFA8);border-color:var(--vt-c,#2DAFA8);color:#fff}' +
      '.vt-ranges .vt-pill.on{background:#2F7184;border-color:#2F7184}' +
      '.vt-chartwrap{position:relative;width:100%;height:260px;margin-top:4px}' +
      '.vt-legend{font-size:11px;color:#8090a0;margin-top:6px;text-align:center}' +
      '.vt-hist{display:flex;flex-direction:column;gap:8px}' +
      '.vt-hrow{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:9px 10px;border:1px solid #e7eef4;border-radius:10px;background:#fbfdfe}' +
      '.vt-hmain{flex:1;min-width:0}' +
      '.vt-hwhen{font-size:11px;font-weight:700;color:#43606f;margin-bottom:5px}' +
      '.vt-hchips{display:flex;flex-wrap:wrap;gap:5px}' +
      '.vt-hchip{font-size:11px;padding:2px 7px;border:1px solid #dde6ee;border-radius:7px;background:#fff;color:#33454f}' +
      '.vt-hnote{font-size:11px;color:#6b7a88;margin-top:5px;font-style:italic}' +
      '.vt-del{flex:0 0 auto;font:inherit;font-size:12px;font-weight:600;width:26px;height:26px;line-height:1;border-radius:7px;border:1px solid #e2c3c3;background:#fdf1f1;color:#c25151;cursor:pointer}' +
      '.vt-del-armed{width:auto;padding:0 10px;background:#d23f3f;border-color:#b93030;color:#fff}' +
      '.vt-emptycard{text-align:center;padding:30px 18px}' +
      '.vt-emptybig{font-size:32px;margin-bottom:8px}' +
      '.vt-emptytitle{font-size:16px;font-weight:700;color:#2F7184}' +
      '.vt-emptymsg{font-size:13px;color:#6b7a88;max-width:420px;margin:6px auto 0;line-height:1.5}' +
      '.vt-daily{margin-bottom:12px}' +
      '.vt-dhead{display:flex;align-items:center;gap:10px;margin-bottom:10px}' +
      '.vt-dtitle{font-size:13px;font-weight:700;color:#2F7184}' +
      '.vt-nothint{font-size:11px;color:#9aa7b3;font-style:italic}' +
      '.vt-dhead .vt-btn{margin-left:auto}' +
      '.vt-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:9px}' +
      '.vt-tile{background:#fbfdfe;border:1px solid #e7eef4;border-radius:9px;padding:8px 10px;display:flex;flex-direction:column;gap:4px}' +
      '.vt-tlabel{font-size:11px;font-weight:600;color:#5b6b78}' +
      '.vt-tval{font-size:15px;font-weight:700;color:#243542}' +
      /* dark mode overrides for our own surfaces */
      '[data-theme="dark"] .vt-card{background:#1b2027;border-color:#2d3742;box-shadow:none}' +
      '[data-theme="dark"] .vt-title,[data-theme="dark"] .vt-cardh,[data-theme="dark"] .vt-dtitle,[data-theme="dark"] .vt-emptytitle{color:#5ec7c0}' +
      '[data-theme="dark"] .vt-sub,[data-theme="dark"] .vt-mlabel,[data-theme="dark"] .vt-tlabel,[data-theme="dark"] .vt-fld,[data-theme="dark"] .vt-emptymsg,[data-theme="dark"] .vt-legend{color:#93a3b2}' +
      '[data-theme="dark"] .vt-mval,[data-theme="dark"] .vt-tval,[data-theme="dark"] .vt-hchip{color:#e6edf3}' +
      '[data-theme="dark"] .vt-mcard,[data-theme="dark"] .vt-tile,[data-theme="dark"] .vt-hrow,[data-theme="dark"] .vt-hchip{background:#232b34;border-color:#2d3742}' +
      '[data-theme="dark"] .vt-fld input,[data-theme="dark"] .vt-fld select{background:#232b34;border-color:#39434f;color:#e6edf3}' +
      '[data-theme="dark"] .vt-seg{border-color:#39434f}' +
      '[data-theme="dark"] .vt-segbtn{background:#232b34;color:#a9b7c4}' +
      '[data-theme="dark"] .vt-segbtn.on{background:#2DAFA8;color:#fff}' +
      '[data-theme="dark"] .vt-btn{background:#232b34;border-color:#39434f;color:#5ec7c0}' +
      '[data-theme="dark"] .vt-btn-primary{background:#2DAFA8;color:#fff;border-color:#25998f}' +
      '[data-theme="dark"] .vt-pill{background:#232b34;border-color:#39434f;color:#a9b7c4}' +
      '[data-theme="dark"] .vt-hwhen{color:#8fb7c2}' +
      '[data-theme="dark"] .vt-chip-neutral{background:#2b333d;color:#93a3b2}';
    var st = doc.createElement('style');
    st.id = 'vt-style';
    st.textContent = css;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------- init / wiring -------------------------------------------- */
  function init() {
    injectCSS();
    // nav button click also renders (activatePage hook covers navigation too;
    // attach once, guarded, so re-runs are harmless)
    var nb = document.querySelector('#nav [data-pg=vitals]');
    if (nb && !nb.dataset.vtWired) {
      nb.dataset.vtWired = '1';
      nb.addEventListener('click', function () { renderVitals(); });
    }
    try { renderVitalsSummary(); } catch (_) {}
    // if the restored active page is vitals, render it now (core's boot-time
    // activatePage ran before this file loaded, so its hook was a no-op)
    var pv = g('pg-vitals');
    try {
      if (pv && getComputedStyle(pv).display !== 'none') renderVitals();
    } catch (_) {}
  }

  window.renderVitals = renderVitals;
  window.renderVitalsSummary = renderVitalsSummary;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
