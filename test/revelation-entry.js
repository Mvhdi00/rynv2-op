// Revelation's play button did nothing on the live site: the menu showed
// "Connecting..." and stayed there. These checks drive the real Oh() and the
// real Turnstile plumbing pulled straight out of the script, against a DOM and
// a turnstile stub, so the whole press-play -> solve -> connect path is
// exercised rather than pattern-matched.
const fs = require('fs');
const path = require('path');
const extract = require('./extract.js');

const src = fs.readFileSync(path.join(__dirname, '..', 'Revelation.user.js'), 'utf8');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

const E = extract.loadRevelationEntry();

// --------------------------------------------------------------------------
console.log('\n1. the page leaves its own widget behind, and it used to win');

// This is the live page: #turnstileWidget exists and already has the page's own
// iframe in it. The old code bailed out of rendering whenever that was true.
E.addPageWidget();
check(!!global.document.getElementById('turnstileWidget'),
      "the page's own widget is present, the way it is on moomoo.io");
check(!/childElementCount > 0/.test(src),
      'the bail-out that made a filled page widget stop us rendering is gone');
check(/const e = rvnCaptchaSlot\(\);/.test(src),
      'the render target is a slot of our own now');

// --------------------------------------------------------------------------
console.log('\n2. pressing play with no token');

check(E.state().code === null && E.state().ps === false,
      'no token and the captcha gate is shut, exactly as on a fresh load');

E.Oh();
check(E.connects.length === 0, 'nothing is connected -- there is no token to connect with');
check(E.state().Fn === false,
      'and the "already connecting" latch is NOT set, so play still works afterwards');
check(E.panel() !== null && E.panel() !== undefined, 'the challenge panel is put on screen');
check(E.panel().style.display === 'block', 'and it is visible');
check(E.loading[E.loading.length - 1] === 'Solve the captcha to play',
      'the menu says what it is waiting for instead of lying about connecting');
check(E.state().pending === true, 'the connect is remembered as pending');
check(E.rendered.length === 1, 'a widget of ours is rendered');
check(E.rendered[0].el.className === 'rvn-slot', 'into our own slot');
check(E.rendered[0].el.offsetParent !== null,
      'and that slot is laid out -- turnstile refuses a container whose offsetParent is null');
check(E.rendered[0].opts.sitekey === '0x4AAAAAAAMYHI96GFiJzMmp',
      "with the live site's sitekey");

// --------------------------------------------------------------------------
console.log('\n3. solving it connects, without a second press');

E.solve('TOKEN123');
check(E.state().ps === true, 'the captcha gate opens');
check(E.state().code === 'TOKEN123', 'the token is captured');
check(E.panel().style.display === 'none', 'the panel takes itself down');
check(E.connects.length === 1, 'the connect the player already asked for goes through');
check(E.connects[0] === 'cf:TOKEN123', 'with a "cf:" Turnstile token, not "alt:" or "re:"');
check(E.state().Fn === true, 'and only now is the latch set');
check(E.loading[E.loading.length - 1] === 'Connecting...',
      'and only now does the menu say it is connecting');

// --------------------------------------------------------------------------
console.log('\n4. the latch still does its job');

E.Oh();
check(E.connects.length === 1, 'a second press while connecting does not open a second socket');

// --------------------------------------------------------------------------
console.log('\n5. the shape of the fix in the source');

check(!/if \(!code\)\n\s*return;/.test(src),
      'the silent "no token, give up" return is gone');
check(/rvnPendingConnect && \(rvnPendingConnect = !1,/.test(src),
      'the token callback is what resumes the connect');
check(/rvnHideCaptchaPanel\(\)/.test(src), 'and it closes the panel');
check(/position:fixed[^"]*z-index:2147483647/.test(src),
      'the panel sits above the page');
check(/i\.className = "rvn-slot"/.test(src),
      'while the slot itself stays in normal flow inside it');

console.log('\n' + (fails === 0 ? '=> ALL REVELATION ENTRY TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
