#!/usr/bin/env node
/**
 * ROLLBACK — ANLY-GROUPS-R1 analytics family subtotal rows (2026-11-10)
 *
 * Restores the flat per-peptide analytics table (no "TC — all" rows).
 *
 * Usage:  node tools/rollback-anlygroups-20261110.mjs          (dry run)
 *         node tools/rollback-anlygroups-20261110.mjs --apply  (roll back)
 *
 * Idempotent — reports "already rolled back" if the markers are absent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPLY = process.argv.includes('--apply');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsPath = resolve(repoRoot, 'assets/app/postload-patches.js');
const cssPath = resolve(repoRoot, 'assets/app/patches.css');
let js = readFileSync(jsPath, 'utf8');
let css = readFileSync(cssPath, 'utf8');
const nl = js.includes('\r\n') ? '\r\n' : '\n';

const START = '  // ── ANLY-GROUPS-R1 (20261110)';
const END = '  // ── /ANLY-GROUPS-R1 ';
const STATE = /    groupClosed: Object\.create\(null\),[^\n]*\r?\n/;
const CSS_BLOCK = /\r?\n\/\* ANLY-GROUPS-R1[\s\S]*?\/\* \/ANLY-GROUPS-R1 \*\//;

const ORIGINAL = "  function renderTable(agg){\n    var tbody = $('tmp-anly-tbody'); if (!tbody) return;\n    var q = (state.search || '').trim().toLowerCase();\n    var list = agg.byPep.filter(function(p){ return !q || p.name.toLowerCase().indexOf(q) !== -1; });\n    list = sortPeps(list);\n    var empty = $('tmp-anly-empty');\n    if (empty) empty.hidden = list.length > 0;\n    if (!list.length) { tbody.innerHTML = ''; return; }\n\n    var html = '';\n    list.forEach(function(p){\n      var avgMg = p.doses ? (p.mg / p.doses) : 0;\n      var isOpen = !!state.open[p.name];\n      html += '<tr class=\"tmp-anly-row' + (isOpen ? ' is-open' : '') + '\" data-anly-pep=\"' + esc(p.name) + '\">'\n        + '<td><span class=\"tmp-anly-caret\">▶</span></td>'\n        + '<td><strong>' + esc(p.name) + '</strong>'\n        + (p.pillCount ? ' <span style=\"font-size:9.5px;color:#4338CA;opacity:.7\">(' + p.pillCount + ' pill)</span>' : '')\n        + '</td>'\n        + '<td class=\"num\">' + p.doses + '</td>'\n        + '<td class=\"num\">' + fmtMgPlain(p.mg) + '</td>'\n        + '<td class=\"num\">' + fmtMgPlain(avgMg) + '</td>'\n        + '<td>' + esc(p.firstDate || '—') + '</td>'\n        + '<td>' + esc(p.lastDate || '—') + '</td>'\n        + '</tr>';\n      if (isOpen){\n        html += '<tr class=\"tmp-anly-detail-row\"><td colspan=\"7\">' + renderDetail(p) + '</td></tr>';\n      }\n    });\n    tbody.innerHTML = html;\n\n    Array.prototype.forEach.call(tbody.querySelectorAll('tr.tmp-anly-row'), function(tr){\n      tr.addEventListener('click', function(){\n        var pep = tr.getAttribute('data-anly-pep');\n        state.open[pep] = !state.open[pep];\n        renderTable(agg);\n      });\n    });\n  }\n\n".replace(/\n/g, nl);

const s = js.indexOf(START);
const e = js.indexOf(END);
if (s !== -1 && e !== -1 && e > s) {
  const lineEnd = js.indexOf('\n', e);
  let after = js.slice(lineEnd + 1);
  after = after.replace(/^\r?\n/, '');
  js = (js.slice(0, s) + ORIGINAL + after).replace(STATE, '');
  css = css.replace(CSS_BLOCK, '');
  console.log(`${APPLY ? '[REMOVED]' : '[WOULD REMOVE]'} family subtotal rows + styles`);
  if (APPLY) {
    writeFileSync(jsPath, js);
    writeFileSync(cssPath, css);
    console.log('\nRollback applied. Also revert the postload-patches.js and patches.css ?v= cache-busts in index.html, then hard-refresh.');
  } else {
    console.log('\nDRY RUN — re-run with --apply to execute.');
  }
} else {
  console.log('[SKIP — not found] ANLY-GROUPS-R1 markers absent. Already rolled back.');
}
