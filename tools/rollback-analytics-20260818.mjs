#!/usr/bin/env node
/**
 * ROLLBACK SCRIPT — Analytics card (added 2026-08-18)
 *
 * Surgically removes the TMP Analytics feature from the three files it touched,
 * restoring them to their exact pre-analytics state. Does NOT touch any other
 * local modifications.
 *
 * Usage:   node tools/rollback-analytics-20260818.mjs          (dry run — shows what would change)
 *          node tools/rollback-analytics-20260818.mjs --apply  (actually rolls back)
 *
 * What it removes:
 *   1. index.html   — the <div class="card tmp-analytics-card"> ... </div> block
 *   2. index.html   — reverts the two ?v=20260818-analytics cache-bust versions
 *   3. patches.css  — everything from the "TMP Analytics Card (added 20260818)" marker to EOF
 *   4. postload-patches.js — everything from the "TMP Analytics module (added 20260818)" marker to EOF
 *
 * Safe to run multiple times (idempotent) — if the markers are absent it reports "already rolled back".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPLY = process.argv.includes('--apply');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const f = (p) => resolve(repoRoot, p);

let changes = 0;

function report(file, what, did) {
  console.log(`${did ? (APPLY ? '[REMOVED]' : '[WOULD REMOVE]') : '[SKIP — not found]'} ${file}: ${what}`);
  if (did) changes++;
}

/* ── 1+2. index.html ─────────────────────────────────────────────────── */
{
  const path = f('index.html');
  let html = readFileSync(path, 'utf8');
  const before = html;

  // Remove the analytics card block (from its opening div through its closing footnote div)
  const cardStart = html.indexOf('<div class="card tmp-analytics-card">');
  if (cardStart !== -1) {
    const footnoteMarker = 'class="tmp-anly-footnote"';
    const footIdx = html.indexOf(footnoteMarker, cardStart);
    if (footIdx !== -1) {
      // card ends at the second </div> after the footnote div closes: footnote </div> then card </div>
      const footClose = html.indexOf('</div>', footIdx);
      const cardClose = html.indexOf('</div>', footClose + 6);
      if (cardClose !== -1) {
        // include trailing newline + indentation
        let end = cardClose + 6;
        // strip the preceding indentation/newline before cardStart
        let start = cardStart;
        while (start > 0 && (html[start - 1] === ' ' || html[start - 1] === '\t')) start--;
        if (start > 0 && html[start - 1] === '\n') start--;
        html = html.slice(0, start) + html.slice(end);
        report('index.html', 'analytics card block', true);
      } else {
        report('index.html', 'analytics card block (close tag not found — manual review needed)', false);
      }
    } else {
      report('index.html', 'analytics card block (footnote marker not found — manual review needed)', false);
    }
  } else {
    report('index.html', 'analytics card block', false);
  }

  // Revert cache-bust versions
  const cssRev = html.replace('assets/app/patches.css?v=20260818-analytics', 'assets/app/patches.css?v=20260724-backup-remind');
  report('index.html', 'patches.css version bump', cssRev !== html);
  html = cssRev;

  const jsRev = html.replace('assets/app/postload-patches.js?v=20260818-analytics', 'assets/app/postload-patches.js?v=20260809-rx-typo-match');
  report('index.html', 'postload-patches.js version bump', jsRev !== html);
  html = jsRev;

  if (APPLY && html !== before) writeFileSync(path, html);
}

/* ── 3. patches.css ──────────────────────────────────────────────────── */
{
  const path = f('assets/app/patches.css');
  const css = readFileSync(path, 'utf8');
  const marker = '/* ===== TMP Analytics Card (added 20260818) ===== */';
  const idx = css.indexOf(marker);
  if (idx !== -1) {
    // strip preceding blank line too
    let start = idx;
    while (start > 0 && (css[start - 1] === '\n' || css[start - 1] === '\r')) start--;
    const out = css.slice(0, start) + '\n';
    if (APPLY) writeFileSync(path, out);
    report('patches.css', 'analytics styles block → EOF', true);
  } else {
    report('patches.css', 'analytics styles block', false);
  }
}

/* ── 4. postload-patches.js ──────────────────────────────────────────── */
{
  const path = f('assets/app/postload-patches.js');
  const js = readFileSync(path, 'utf8');
  const marker = '// ── TMP Analytics module (added 20260818)';
  const idx = js.indexOf(marker);
  if (idx !== -1) {
    let start = idx;
    while (start > 0 && (js[start - 1] === '\n' || js[start - 1] === '\r')) start--;
    const out = js.slice(0, start) + '\n';
    if (APPLY) writeFileSync(path, out);
    report('postload-patches.js', 'analytics module → EOF', true);
  } else {
    report('postload-patches.js', 'analytics module', false);
  }
}

console.log('');
if (changes === 0) {
  console.log('Nothing to roll back — analytics feature not present (already rolled back?).');
} else if (APPLY) {
  console.log(`Rollback applied: ${changes} change(s). The Analytics card is fully removed.`);
  console.log('Hard-refresh the browser (Ctrl+Shift+R) to clear cached CSS/JS.');
} else {
  console.log(`DRY RUN complete: ${changes} change(s) would be made.`);
  console.log('Run again with --apply to execute the rollback.');
}
