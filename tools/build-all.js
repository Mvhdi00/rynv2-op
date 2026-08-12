#!/usr/bin/env node
/**
 * Rebuilds every shipped script from its original.
 *
 * The scripts in this repo are outputs, not sources: each one is its untouched
 * original plus a build script. That only holds if rebuilding them all is one
 * command -- the EXP core is shared by ten files, and a change to it that is
 * rebuilt into nine of them is worse than no change at all.
 *
 * Usage: node tools/build-all.js
 */
const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-all-'));

// The unpatcher first: repair-mod.js inlines the file it produces.
const steps = [
  ['tools/build-unpatcher.js', []],
  ['tools/build-annihilator.js', []],
  ['tools/build-caramila.js', []],
  ['tools/build-ryn.js', []],
];
for (const name of ['SamMod.v698.js', 'Robotics-kusoi.v1.8.4.js', 'xelahot.v3.js',
                    'xelahot.v3-alt.js', 'x18k-Original.v5.3.js', 'novastorm.v1.4.js']) {
  steps.push(['tools/repair-mod.js', ['reference/originals/' + name, name]]);
}
// Balthazar takes a second pass of its own after the generic repair.
const balth = path.join(tmp, 'balthazar-repaired.js');
steps.push(['tools/repair-mod.js', ['reference/originals/Balthazar-priv.js', balth]]);
steps.push(['tools/patch-balthazar.js', [balth, 'Balthazar-priv.js']]);

let failed = 0;
for (const [script, args] of steps) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, script), ...args], { cwd: ROOT, stdio: 'pipe' });
    console.log('  ok  ' + script + (args.length ? '  ' + path.basename(args[args.length - 1]) : ''));
  } catch (e) {
    failed++;
    console.log('  FAIL ' + script + ' ' + args.join(' '));
    console.log((e.stderr || e.stdout || '').toString().trim().split('\n').map(l => '       ' + l).join('\n'));
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? '\n' + failed + ' build(s) failed' : '\nall builds clean');
process.exit(failed ? 1 : 0);
