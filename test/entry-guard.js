// The two page guards that live in the EXP core: the red "userscript manager
// detected" bar, and the latched "Connecting..." dead end.
//
// tools/probe-entry.js is what proves these work -- it runs the shipped game
// bundle in Chromium, presses ENTER GAME, and watches for a socket. What it
// cannot do is run in `npm test`, and these are exactly the sort of thing a
// rebuild can quietly drop. So: drive the logic against a fake page here, and
// check that every shipped script still carries it.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

/* --- a page, reduced to what the guards touch ---------------------------- */
function makePage() {
  const timers = [];
  class El {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.id = ''; this.style = { cssText: '' }; this.children = [];
      this.parentNode = null; this.textContent = ''; this.attrs = {};
      this.offsetParent = {};                 // "laid out" unless a test says not
      const own = new Set();
      this.classList = {
        add: (c) => own.add(c), remove: (c) => own.delete(c),
        contains: (c) => own.has(c), _set: own
      };
    }
    get childElementCount() { return this.children.length; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
    appendChild(c) { c.parentNode = this; this.children.push(c); index(c); return c; }
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; unindex(c); }
      return c;
    }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    contains(n) { return n === this || this.children.some(c => c.contains && c.contains(n)); }
  }
  const byId = Object.create(null);
  function index(el) {
    if (el.id && !byId[el.id]) byId[el.id] = el;
    (el.children || []).forEach(index);
  }
  function unindex(el) {
    if (el.id && byId[el.id] === el) delete byId[el.id];
    (el.children || []).forEach(unindex);
  }

  const docListeners = Object.create(null);
  const document = {
    readyState: 'complete',
    documentElement: new El('html'),
    head: new El('head'),
    createElement: (t) => new El(t),
    getElementById: (id) => byId[id] || null,
    querySelector: () => null,
    addEventListener(type, fn, capture) { (docListeners[type] = docListeners[type] || []).push({ fn, capture }); },
    // a press, delivered the way the browser does it: capture listeners on the
    // document run before anything on the element itself
    press(type, target) {
      let stopped = false, prevented = false;
      const ev = {
        type, target,
        preventDefault() { prevented = true; },
        stopImmediatePropagation() { stopped = true; },
        stopPropagation() { stopped = true; }
      };
      for (const l of docListeners[type] || []) {
        if (!l.capture) continue;
        l.fn(ev);
        if (stopped) break;
      }
      return { reachedTarget: !stopped, prevented };
    }
  };
  document.body = new El('body');
  index(document.body);

  const window = { location: { hostname: 'moomoo.io' }, document };
  return {
    window, document, El, byId, index,
    // Timers are collected rather than run, so a test decides when the guard's
    // poll advances instead of racing it.
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    run(times) { for (let i = 0; i < (times || 1); i++) { const t = timers.shift(); if (t) t.fn(); } },
    pending: () => timers.length
  };
}

// Lift the guards straight out of the shipped core, so this test is about the
// code that ships and not about a copy of it.
function loadGuards(page, opts) {
  const ext = fs.readFileSync(path.join(ROOT, 'ExternalClient.user.js'), 'utf8');
  const a = ext.indexOf('// BEGIN page-guards');
  const b = ext.indexOf('// END page-guards');
  if (a < 0 || b < 0) throw new Error('no page-guards block in ExternalClient.user.js');
  const src = ext.slice(a, b);
  const fn = new Function('window', 'document', 'setTimeout', 'MutationObserver', 'console',
    src + '\nreturn { suppressWarningBanner: suppressWarningBanner, guardEntry: guardEntry };');
  return fn(page.window, page.document, page.setTimeout,
            undefined,                       // no observer: exercise the plain path
            { info() {}, warn() {} });
}

// --------------------------------------------------------------------------
console.log('\n1. the red bar');
{
  const page = makePage();
  const { suppressWarningBanner } = loadGuards(page);
  suppressWarningBanner();
  const planted = page.document.getElementById('userscript-warning');
  check(!!planted, 'an element with the bundle\'s id is in the document');
  check(planted && planted.style.display === 'none', 'it is hidden');
  check(planted && planted.textContent === '', 'it carries no text of its own');
  check(planted && planted.getAttribute('data-guard') === '1', 'it is marked as ours');

  // ys() returns at its first line if the id is taken, so this is the whole
  // mechanism: the bundle's own guard is what stops it.
  const bundleWouldDraw = !page.document.getElementById('userscript-warning');
  check(!bundleWouldDraw, 'the bundle\'s "already there?" test now says yes');
}
{
  // and if the bundle drew it first -- an extension detected before we ran --
  // the bar is taken away and replaced with ours
  const page = makePage();
  const theirs = page.document.createElement('div');
  theirs.id = 'userscript-warning';
  theirs.textContent = 'A browser extension (Tampermonkey) that can modify the game was detected.';
  page.document.body.appendChild(theirs);
  const { suppressWarningBanner } = loadGuards(page);
  suppressWarningBanner();
  const now = page.document.getElementById('userscript-warning');
  check(now !== theirs, 'a bar already on the page is removed');
  check(now && now.textContent === '', 'and what is left says nothing');
}

// --------------------------------------------------------------------------
console.log('\n2. ENTER GAME, before there is a token');
{
  const page = makePage();
  const btn = page.document.createElement('div');
  btn.id = 'enterGame';
  btn.classList.add('disabled');
  page.document.body.appendChild(btn);

  let token = null;
  const { guardEntry } = loadGuards(page);
  guardEntry(() => token, (t) => { token = t; });

  const held = page.document.press('click', btn);
  check(!held.reachedTarget, 'the press does not reach the button\'s own handler');
  check(held.prevented, 'and it is prevented');

  // The bundle turns touches on this button into the same call, so they have
  // to be held too -- otherwise a phone latches the dead end the desktop
  // cannot.
  for (const type of ['mousedown', 'pointerdown', 'touchstart', 'touchend']) {
    check(!page.document.press(type, btn).reachedTarget, type + ' is held as well');
  }

  // A press anywhere else is nobody's business but the page's.
  const other = page.document.createElement('div');
  other.id = 'settingsButton';
  page.document.body.appendChild(other);
  check(page.document.press('click', other).reachedTarget, 'a press elsewhere is left alone');

  token = 'cf:something';
  check(page.document.press('click', btn).reachedTarget, 'once there is a token the press goes through');

  // the poll clears the class the game leaves on until its own callback fires
  page.run(page.pending());
  check(!btn.classList.contains('disabled'), 'and the button stops being disabled');
}
{
  // A press on something *inside* the button -- the bundle's markup puts text
  // in a child -- is a press on the button.
  const page = makePage();
  const btn = page.document.createElement('div');
  btn.id = 'enterGame';
  const label = page.document.createElement('span');
  btn.appendChild(label);
  page.document.body.appendChild(btn);
  const { guardEntry } = loadGuards(page);
  guardEntry(() => null, () => {});
  check(!page.document.press('click', label).reachedTarget, 'a press on a child of the button is held');
}

// --------------------------------------------------------------------------
console.log('\n3. rendering Turnstile when the page will not');
{
  const page = makePage();
  const widget = page.document.createElement('div');
  widget.id = 'turnstileWidget';
  widget.offsetParent = null;              // hidden: the game refuses to render
  page.document.body.appendChild(widget);

  const rendered = [];
  page.window.turnstile = {
    render(el, opts) { rendered.push({ el, opts }); return 'w1'; },
    getResponse: () => ''
  };
  let token = null;
  const { guardEntry } = loadGuards(page);
  guardEntry(() => token, (t) => { token = t; });

  page.run(1);                              // the guard's first tick
  check(rendered.length === 1, 'a widget is rendered even though the page\'s is hidden');
  check(rendered[0] && rendered[0].el !== widget, 'into a holder of its own, not the hidden one');
  check(rendered[0] && rendered[0].el.offsetParent !== null,
        'and that holder is laid out, which is the test the game applies');
  check(rendered[0] && rendered[0].opts.sitekey === '0x4AAAAAAAMYHI96GFiJzMmp',
        'with the sitekey the bundle uses');

  // solving it feeds the token back the way the bundle's own callback does
  page.window.onGotTurnstileToken = (t) => { token = t; };
  rendered[0].opts.callback('TOKEN');
  check(token === 'TOKEN', 'the solve reaches the page\'s own callback');
}
{
  // The other way round: the page's widget is fine, so leave it alone rather
  // than asking Cloudflare for a second solve nobody needs.
  const page = makePage();
  const widget = page.document.createElement('div');
  widget.id = 'turnstileWidget';
  page.document.body.appendChild(widget);
  const rendered = [];
  page.window.turnstile = { render(el, o) { rendered.push(el); return 'w1'; }, getResponse: () => '' };
  const { guardEntry } = loadGuards(page);
  guardEntry(() => null, () => {});
  page.run(1);
  check(rendered.length === 0, 'a laid-out widget is left to the game');
}

// --------------------------------------------------------------------------
console.log('\n4. every shipped script carries both');
{
  const shipped = fs.readdirSync(ROOT)
    .filter(f => /\.js$/.test(f) && f !== 'package-lock.json')
    .filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('const EXP = (function'));
  check(shipped.length >= 15, shipped.length + ' scripts carry the EXP core');
  const without = shipped.filter(f => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return !s.includes('userscript-warning') || !s.includes('0x4AAAAAAAMYHI96GFiJzMmp');
  });
  check(without.length === 0, 'all of them carry the banner guard and the entry guard'
        + (without.length ? ' -- missing in ' + without.join(', ') : ''));

  // RYN has no EXP core; it gets the same two functions spliced in by its build.
  const ryn = fs.readFileSync(path.join(ROOT, 'RYN-Client.v5v4.js'), 'utf8');
  check(ryn.includes('userscript-warning'), 'RYN carries the banner guard too');
  check(/guardEntry\(readToken/.test(ryn), 'RYN carries the entry guard, wired to its own token');
}

// --------------------------------------------------------------------------
console.log('\n5. x18k waited on a captcha that no longer exists');
{
  const before = fs.readFileSync(path.join(ROOT, 'reference/originals/x18k-Original.v5.3.js'), 'utf8');
  const after = fs.readFileSync(path.join(ROOT, 'x18k-Original.v5.3.js'), 'utf8');
  check(/getElementById\("altcha_checkbox"\)\.click\(\)/.test(before),
        'the original clicks an ALTCHA checkbox that is not on the page');
  check(!/getElementById\("altcha_checkbox"\)\.click\(\)/.test(after),
        'the repaired file does not');
  check(/V0 = t\.replace\(\/\^cf:\/, ""\)/.test(after),
        'its captcha payload is taken from the Turnstile token instead');
}

console.log('\n' + (fails ? '=> ' + fails + ' FAILURE(S)' : '=> ALL ENTRY GUARD TESTS PASSED'));
process.exit(fails ? 1 : 0);
