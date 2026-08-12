#!/usr/bin/env node
/**
 * Copies the EXP core from ExternalClient.user.js into every script that
 * carries one.
 *
 * Eight scripts ship the shim inline, verbatim and comment-for-comment, and
 * test/ae86.js checks that they are byte-identical to the External Client's.
 * That check is worth having -- a shim that has drifted is a script that will
 * fail in a way nothing else in the suite would catch -- but it is only
 * maintainable if syncing them is one command rather than eight edits.
 *
 * The scripts built from originals (the unpatcher, Annihilator, CaraMila and
 * everything repair-mod.js produces) take their copy at build time and are not
 * touched here; tools/build-all.js is what refreshes those.
 *
 * Usage: node tools/sync-shim.js [--check]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const SOURCE = 'ExternalClient.user.js';
const TARGETS = ['AE86.user.js', 'Aurora.user.js', 'LemonMod.user.js', 'LemonModVisuals.user.js',
                 'LemonMod.obfuscated.user.js', 'Robotics.user.js', 'PeterClient.user.js',
                 'Sakuna.user.js'];

const OPEN = 'const EXP = (function() {';
function region(text) {
  const a = text.indexOf(OPEN);
  if (a < 0) return null;
  const b = text.indexOf('\n)();', a);
  if (b < 0) return null;
  return [a, b + '\n)();'.length];
}

const src = fs.readFileSync(path.join(ROOT, SOURCE), 'utf8');
const at = region(src);
if (!at) { console.error('sync-shim: no EXP core in ' + SOURCE); process.exit(1); }
const core = src.slice(at[0], at[1]);

let changed = 0, missing = 0;
for (const name of TARGETS) {
  const file = path.join(ROOT, name);
  const text = fs.readFileSync(file, 'utf8');
  const span = region(text);
  if (!span) { console.log('  --  ' + name + ' (no EXP core)'); missing++; continue; }
  if (text.slice(span[0], span[1]) === core) { console.log('  ok  ' + name); continue; }
  changed++;
  if (CHECK) { console.log('  STALE ' + name); continue; }
  fs.writeFileSync(file, text.slice(0, span[0]) + core + text.slice(span[1]));
  console.log('  updated ' + name);
}
if (missing) { console.error('\n' + missing + ' target(s) had no EXP core'); process.exit(1); }
if (CHECK && changed) { console.error('\n' + changed + ' script(s) carry a stale shim -- run node tools/sync-shim.js'); process.exit(1); }
console.log(changed ? '\n' + changed + ' script(s) updated' : '\nall shims already in step');
