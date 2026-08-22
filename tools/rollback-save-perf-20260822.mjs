#!/usr/bin/env node
/**
 * ROLLBACK — PERF-SAVE-R1 save-path optimization (2026-08-22)
 *
 * Removes the cross-tab stamp gate and restores the original unconditional
 * reconcileFromDisk() call on every save flush.
 *
 * Usage:  node tools/rollback-save-perf-20260822.mjs          (dry run)
 *         node tools/rollback-save-perf-20260822.mjs --apply  (roll back)
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
let changes = 0;

function report(what, did) {
  console.log(`${did ? (APPLY ? '[REMOVED]' : '[WOULD REMOVE]') : '[SKIP — not found]'} ${what}`);
  if (did) changes++;
}

// 1. Restore unconditional reconcile
const gated = `  // PERF-SAVE-R1: only pay the full-state parse when the cross-tab stamp says
  // another tab actually wrote. Single-tab saves skip it entirely.
  try{if(_tmpDiskMayDiffer())reconcileFromDisk();}catch(_){}`;
const plain = `  try{reconcileFromDisk();}catch(_){}`;
if (js.includes(gated)) { js = js.replace(gated, plain); report('save-flush gate → unconditional reconcile', true); }
else report('save-flush gate', false);

// 2. Remove the stamp write
const stampWrite = `\n  if(_lsOk)_tmpWriteStamp();`;
if (js.includes(stampWrite)) { js = js.replace(stampWrite, ''); report('stamp write after localStorage.setItem', true); }
else report('stamp write', false);

// 3. Remove the stamp adoption inside reconcileFromDisk
const adopt = `  // PERF-SAVE-R1: whatever the outcome, this tab has now seen disk state -
  // adopt the disk stamp so the next save's cheap check is accurate.
  try{_tmpLastStamp=_tmpReadStamp();}catch(_){}\n`;
if (js.includes(adopt)) { js = js.replace(adopt, ''); report('stamp adoption in reconcileFromDisk', true); }
else report('stamp adoption', false);

// 4. Remove the helper block (from its banner comment to the debug hook)
const startMark = '\n// PERF-SAVE-R1 (20260822): cross-tab change stamp.';
const endMark = "window.__tmpSaveStampDebug=function(){\n  return {diskStamp:_tmpReadStamp(),lastWritten:_tmpLastStamp,computed:_tmpComputeStamp()};\n};\n";
const s = js.indexOf(startMark);
const e = js.indexOf(endMark);
if (s !== -1 && e !== -1) {
  js = js.slice(0, s) + js.slice(e + endMark.length);
  report('stamp helper block', true);
} else report('stamp helper block', false);

if (APPLY && js !== before) writeFileSync(corePath, js);

console.log('');
if (changes === 0) console.log('Nothing to roll back — PERF-SAVE-R1 not present.');
else if (APPLY) {
  console.log(`Rollback applied: ${changes} change(s).`);
  console.log('NOTE: also revert the core.js ?v= cache-bust in index.html, then hard-refresh.');
  console.log('The leftover "peptide_tracker_stamp" localStorage key is harmless and ignored.');
} else console.log(`DRY RUN: ${changes} change(s) would be made. Re-run with --apply.`);
