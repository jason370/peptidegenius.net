#!/usr/bin/env node
/**
 * ROLLBACK — PERF-LOGROWS-R1 Shot Log row cap (2026-09-25)
 *
 * Restores the original behaviour: every shot + Rx row rendered in one
 * innerHTML assignment, with no "show more" footer.
 *
 * Usage:  node tools/rollback-logrows-20260925.mjs          (dry run)
 *         node tools/rollback-logrows-20260925.mjs --apply  (roll back)
 *
 * Idempotent — reports "already rolled back" if the markers are absent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPLY = process.argv.includes('--apply');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corePath = resolve(repoRoot, 'assets/app/core.js');
let js = readFileSync(corePath, 'utf8');
const before = js;

const START = "  const tbody=g('lg-tbody');\n  if(!tbody) return;";
const END = "    try{ renderLogShotRows(); }catch(_){}\n  });\n}";

const ORIGINAL = `  const tbody=g('lg-tbody');
  if(tbody)tbody.innerHTML=merged.length?merged.map((m,i)=>m.kind==='shot'?rowHtml(m.x,i):rxRowHtml(m.e,i)).join(''):emptyRow;
}`;

const s = js.indexOf(START);
const e = js.indexOf(END);

if (s !== -1 && e !== -1 && e > s) {
  js = js.slice(0, s) + ORIGINAL + js.slice(e + END.length);
  console.log(`${APPLY ? '[REMOVED]' : '[WOULD REMOVE]'} row cap + show-more footer + delegated handlers`);
  if (APPLY) {
    writeFileSync(corePath, js);
    console.log('\nRollback applied. Also revert the core.js ?v= cache-bust in index.html, then hard-refresh.');
  } else {
    console.log('\nDRY RUN — re-run with --apply to execute.');
  }
} else {
  console.log('[SKIP — not found] row cap markers absent. Nothing to roll back.');
}
