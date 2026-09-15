#!/usr/bin/env node
// Runs every placement/prediction verification suite against
// Ryn_Type_2.user.js. Each suite extracts the real code out of the userscript
// by brace matching (tools/extract-block.js) rather than re-implementing it,
// so a pass means the shipped source behaves, not a copy of it.
const { execFileSync } = require('child_process');
const path = require('path');
const suites = [
  ['1', 'game-file baselines, spatial grid, trap state, send timing, break forecast'],
  ['2', 'aperture geometry vs the game rule, ring resolution, auto place offer order'],
  ['3', 'tick flush scheduler, blocker sweep'],
  ['4', 'attrition across a reload cycle, break edge detector, forecast tracking']
];
let failed = 0;
for (const [n, what] of suites) {
  console.log('\n### suite ' + n + ' — ' + what);
  try {
    process.stdout.write(execFileSync(process.execPath, [path.join(__dirname, 'verify-placement-' + n + '.js')]).toString());
  } catch (e) {
    process.stdout.write((e.stdout || Buffer.from('')).toString());
    process.stderr.write((e.stderr || Buffer.from('')).toString());
    failed++;
  }
}
console.log(failed ? '\n' + failed + ' suite(s) FAILED' : '\nall suites passed');
process.exit(failed ? 1 : 0);
