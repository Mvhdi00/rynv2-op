// "Full FPS" swaps requestAnimationFrame for a MessageChannel message, which is
// a macrotask that fires immediately instead of waiting for the display refresh.
// The interesting question is not whether the counter goes up -- it is whether
// the loop genuinely runs more often, and what that does and does not buy. These
// checks pin the mechanism in both scripts; tools/fps-bench.js measures it.
const fs = require('fs');
const path = require('path');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

const ROOT = path.join(__dirname, '..');
const unx = fs.readFileSync(path.join(ROOT, 'UnX.user.js'), 'utf8');
const sak = fs.readFileSync(path.join(ROOT, 'Sakuna.user.js'), 'utf8');

console.log('\n1. unX');
check(/const unxFpsChannel = new MessageChannel\(\);/.test(unx), 'it has a MessageChannel of its own');
check(/unxFpsChannel\.port1\.onmessage = function \(\) \{\s*doUpdate\(\);/.test(unx),
      'whose message runs the render loop');
check(/if \(scriptMenu\.toggles\.fullFps\) \{\s*unxFpsChannel\.port2\.postMessage\(""\);/.test(unx),
      'the toggle reschedules through it');
check(/\} else \{\s*window\.requestAnimationFrame\(doUpdate\);\s*\}/.test(unx),
      'and with it off the loop is exactly the rAF it always was');
check(/id: "fullFps"/.test(unx), 'the toggle is in the mod menu');

// exactly one continuation per iteration, or the loop doubles every pass
{
  const body = unx.slice(unx.indexOf('function doUpdate() {'));
  const end = body.indexOf('\n    }');
  const loop = body.slice(0, end);
  const conts = (loop.match(/postMessage\(""\)|requestAnimationFrame\(doUpdate\)/g) || []).length;
  check(conts === 2, 'the two continuations are the arms of one if/else, not two schedules');
  check(/else/.test(loop), 'and they really are exclusive');
}

console.log('\n2. Sakuna (the original this was modelled on)');
check(/const channel = new MessageChannel\(\);/.test(sak), 'same mechanism');
check(/channel\.port1\.onmessage = doUpdate;/.test(sak), 'same wiring');
check(/if\(fullFPS\)\{\s*channel\.port2\.postMessage\(""\);/.test(sak), 'same switch');
check(/addCheck\("Full FPS", "fullfps"/.test(sak), 'and its own toggle, which unX now matches');

console.log('\n3. both default to off');
check(/addCheck\("Full FPS", "fullfps", false/.test(sak),
      'Sakuna ships it off: it pins a CPU core');
{
  const entry = unx.slice(unx.indexOf('id: "fullFps"'));
  const close = entry.indexOf('},');
  check(!/checked:\s*true/.test(entry.slice(0, close)), 'and unX does not force it on either');
}

console.log('\n' + (fails === 0 ? '=> ALL FULL-FPS TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
