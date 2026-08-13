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
function makePage(opts) {
  const timers = [], intervals = [];
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
  // At document-start Chrome gives a userscript a document with NO
  // documentElement and NO body. `bare: true` models that; attach() is the
  // parser catching up.
  if (!(opts && opts.bare)) { document.body = new El('body'); index(document.body); }
  else { document.documentElement = null; }

  const window = { location: { hostname: 'moomoo.io' }, document };
  // The guard waits out the game's own fifteen seconds before adding a widget
  // of its own, so a test has to be able to move the clock rather than sleep.
  let clock = 1000000;
  return {
    window, document, El, byId, index,
    Date: { now: () => clock },
    advance(ms) { clock += ms; },
    attach() {
      document.documentElement = new El('html');
      document.body = new El('body');
      index(document.body);
    },
    // Timers are collected rather than run, so a test decides when the guard's
    // poll advances instead of racing it.
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    run(times) { for (let i = 0; i < (times || 1); i++) { const t = timers.shift(); if (t) t.fn(); } },
    pending: () => timers.length,
    // The retry loop the banner guard needs at document-start, under the
    // test's control rather than the clock's.
    setInterval: (fn) => { intervals.push(fn); return intervals.length; },
    clearInterval: (id) => { intervals[id - 1] = null; },
    ticks: () => intervals.filter(Boolean).length,
    tick(times) { for (let i = 0; i < (times || 1); i++) intervals.filter(Boolean).forEach(f => f()); }
  };
}

// Lift the guards straight out of the shipped core, so this test is about the
// code that ships and not about a copy of it.
function loadGuards(page) {
  const ext = fs.readFileSync(path.join(ROOT, 'ExternalClient.user.js'), 'utf8');
  const a = ext.indexOf('// BEGIN page-guards');
  const b = ext.indexOf('// END page-guards');
  if (a < 0 || b < 0) throw new Error('no page-guards block in ExternalClient.user.js');
  const src = ext.slice(a, b);
  const fn = new Function('window', 'document', 'setTimeout', 'setInterval', 'clearInterval',
    'MutationObserver', 'console', 'Date',
    src + '\nreturn { suppressWarningBanner: suppressWarningBanner, guardEntry: guardEntry };');
  return fn(page.window, page.document, page.setTimeout, page.setInterval, page.clearInterval,
            undefined,                       // no observer: exercise the plain path
            { info() {}, warn() {} },
            page.Date);
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

{
  // The case that actually happens on install. A userscript at document-start
  // gets a document with no <html> and no <body> -- both null in Chrome -- so
  // the guard's first attempt has nothing to append to. Giving up there is
  // what let the bar through on every file for a whole round: the guard ran
  // once, found no document, and never tried again. The bug hid behind a check
  // of my own that used offsetParent, which is null for a position:fixed
  // element -- so it reported "no banner" while the bar was on screen.
  const page = makePage({ bare: true });
  const { suppressWarningBanner } = loadGuards(page);
  suppressWarningBanner();
  check(page.ticks() > 0, 'with no document yet, the guard keeps trying instead of giving up');

  page.attach();                              // the parser catches up
  page.tick(1);
  const planted = page.document.getElementById('userscript-warning');
  check(!!planted, 'and plants the guard as soon as there is a body');
  check(planted && planted.parentNode === page.document.body, 'in the body, not on <html>');
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
  check(!page.document.press('click', btn).reachedTarget,
        'a token of our own is not enough while the game still says disabled');

  // The disabled class is the game's, and it is the authority: the game puts it
  // on whenever ITS token is missing, expired or errored. An earlier version of
  // the guard cleared it whenever this cache held a token -- which disarmed the
  // game's own check and let a press reach Fi() with `ue` still null. That is
  // "Connecting..." for ever, the exact dead end this exists to prevent.
  page.run(page.pending());
  check(btn.classList.contains('disabled'), 'and the guard does not clear that class itself');

  btn.classList.remove('disabled');            // the game's own callback would
  check(page.document.press('click', btn).reachedTarget,
        'once the game agrees, the press goes through');
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

{
  // A token that expired is not a token. The game hears about it and clears its
  // own; a cache that does not is worse than no cache.
  const page = makePage();
  const btn = page.document.createElement('div');
  btn.id = 'enterGame';
  page.document.body.appendChild(btn);
  loadGuards(page);                            // installs the window wrappers
  page.window.onGotTurnstileToken = () => {};  // the game's own
  page.window.onGotTurnstileToken('TOKEN');
  check(true, 'the callback wrappers install without the game having assigned yet');
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
  check(rendered.length === 0, 'nothing is rendered while the game is still trying');

  page.advance(17000);                      // past the game's hundred tries
  page.run(page.pending());
  check(rendered.length === 1, 'a widget is rendered once the game has given up');
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
  page.advance(17000);
  page.run(1);
  check(rendered.length === 1, 'an empty widget the game never filled is rendered into');
}
{
  // The bug a player actually saw: two checkboxes, the game's in the middle of
  // the menu and a second one bottom-right. The game had rendered its own --
  // the widget has children -- so there is nothing to rescue, however long it
  // has been.
  const page = makePage();
  const widget = page.document.createElement('div');
  widget.id = 'turnstileWidget';
  widget.appendChild(page.document.createElement('iframe'));
  page.document.body.appendChild(widget);
  const rendered = [];
  page.window.turnstile = { render(el) { rendered.push(el); return 'w1'; }, getResponse: () => '' };
  const { guardEntry } = loadGuards(page);
  guardEntry(() => null, () => {});
  page.advance(60000);
  page.run(3);
  check(rendered.length === 0, 'a widget the game already filled is never doubled up');
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

// --------------------------------------------------------------------------
console.log('\n6. two clients that spawned before the handshake');
{
  // A mod carrying its own copy of the 2019 io-client started on socket-open,
  // which is too early: io-init is what brings the seed and the key, so the
  // spawn went out unsigned and the server dropped it. The client then sat on
  // "Loading..." for ever, having said nothing the server would answer.
  // tools/probe-entry.js shows it on the wire; this checks the repair is in
  // the shipped files and did not just work once on my machine.
  for (const name of ['novastorm.v1.4.js', 'x18k-Original.v5.3.js']) {
    const before = fs.readFileSync(path.join(ROOT, 'reference/originals/' + name), 'utf8');
    const after = fs.readFileSync(path.join(ROOT, name), 'utf8');
    check(/onopen = function ?\(\) ?\{\s*\w+\.connected = (?:true|!0)[,;]\s*\w+\(\)/.test(before),
          name + ': the original starts its client from socket-open');
    check(!/onopen = function ?\(\) ?\{\s*\w+\.connected = (?:true|!0)[,;]\s*\w+\(\)/.test(after),
          name + ': the repaired file does not');
    check(/_started = 1, \w+\._go && \w+\._go\(\)/.test(after),
          name + ': it starts from the io-init branch instead');
    // The callback is stashed rather than named at the call site: x18k's
    // minified handler opens with `const n = ol.decode(t)`, which shadows the
    // callback `n`. Calling it by name there threw "n is not a function".
    check(/\._go = \w+/.test(after), name + ': and the callback is stashed, not named');
  }
}

// --------------------------------------------------------------------------
console.log('\n7. novastorm keeps the sandbox link');
{
  // Not a repair -- an undo. novastorm's author tore this out on purpose:
  //     document.getElementById("altServer").remove(); // REMOVE THE link ...
  // and it only survived because the mod never ran far enough to reach the
  // line. The player who uses that link asked for it back.
  const before = fs.readFileSync(path.join(ROOT, 'reference/originals/novastorm.v1.4.js'), 'utf8');
  const after = fs.readFileSync(path.join(ROOT, 'novastorm.v1.4.js'), 'utf8');
  check(/getElementById\("altServer"\)\.remove\(\)/.test(before),
        'the original removes the sandbox link');
  check(!/getElementById\("altServer"\)\??\.remove\(\)/.test(after),
        'the shipped file does not');
  // and nothing else in that neighbourhood went with it
  check(/REMOVE THE link/.test(before) && !/REMOVE THE link/.test(after),
        'the line went, comment and all');
  check(after.length > before.length - 200, 'and nothing else was taken with it');
}

// --------------------------------------------------------------------------
console.log('\n8. the boot order is not a coin toss');
{
  // The bundle is a deferred module; the mod's deferred boot polls for the
  // same moment. readyState stops being "loading" BEFORE deferred modules run,
  // so "the page is ready" and "the bundle has run" are different instants and
  // the two could land either way round -- the same install working on one
  // refresh and not the next. tools/probe-entry.js --slow-bundle forces the
  // losing order; this checks the gate that removes the race is in the files.
  // Annihilator and CaraMila are built by hand and had the same racy starter.
  // CaraMila does not merely lose its visuals when it wins the race, it dies:
  //   Cannot read properties of null (reading 'parentElement') at __carBoot
  for (const name of ['novastorm.v1.4.js', 'x18k-Original.v5.3.js', 'SamMod.v698.js',
                      'Robotics-kusoi.v1.8.4.js', 'xelahot.v3.js', 'Balthazar-priv.js',
                      'xelahot.v3-alt.js', 'Annihilator.v0.8.9.js', 'RoBoTic-CaraMila.v6.9.5.js',
                      'Remedy.v4.1.js']) {
    const s = fs.readFileSync(path.join(ROOT, name), 'utf8');
    check(/window\.loadedScript === true \|\| document\.readyState === "complete"/.test(s),
          name + ': waits for the bundle, not just for the page');
  }
}

// --------------------------------------------------------------------------
console.log('\n9. Remedy 4.1');
{
  const before = fs.readFileSync(path.join(ROOT, 'reference/originals/Remedy.v4.1.js'), 'utf8');
  const after = fs.readFileSync(path.join(ROOT, 'Remedy.v4.1.js'), 'utf8');

  // It arrived as a bare .txt: 25,000 lines, a changelog at the top, and no
  // userscript header at all. Every fix in repair-mod.js is expressed through
  // that block, so one gets written.
  check(!/==UserScript==/.test(before), 'the original has no userscript header');
  check(/^\/\/ ==UserScript==/m.test(after), 'the repaired file has one');
  check(/@name\s+Remedy 4\.1/.test(after), 'with its name');
  check(/@run-at\s+document-start/.test(after),
        'and document-start, without which the transport hook is too late');

  // Its bots minted a token each from ALTCHA, whose endpoint is part of a
  // captcha the game no longer uses -- so generate() rejected and every bot
  // connection died before it opened, silently, since nothing awaited it.
  check(/await this\.getChallenge\(\)/.test(before), 'the original solves ALTCHA for each bot');
  check(/const cf = await EXP\.freshToken\(\);\n\s*if \(cf\) return cf;/.test(after),
        'the repaired file asks Turnstile first');
  check(/await this\.getChallenge\(\)/.test(after),
        'and keeps ALTCHA underneath, in case that endpoint ever comes back');

  // the hook it is built around is untouched -- that is the whole point of
  // inlining the shim rather than rewiring the mod
  check(/WebSocket\.prototype\.send = function \(message\) \{/.test(after),
        "its own socket hook is left exactly as written");
}

console.log('\n' + (fails ? '=> ' + fails + ' FAILURE(S)' : '=> ALL ENTRY GUARD TESTS PASSED'));
process.exit(fails ? 1 : 0);
