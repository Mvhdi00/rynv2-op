#!/usr/bin/env node
/**
 * Runs the REAL game bundle and presses "ENTER GAME".
 *
 * Every probe in this repo so far has tested a mod against a page I wrote. That
 * is enough to catch a boot crash, but the complaint "I press enter game and it
 * sits on Connecting... for ever" is not a boot crash -- it is the game's own
 * entry state machine reaching a dead end, and the only way to see that is to
 * run the state machine. reference/game-index.js and game-vendor.js are the
 * shipped bundle, so they are served here as-is over a fake moomoo.io.
 *
 * What is faked, and why each fake is honest:
 *   - the page. moomoo's index.html is not in the repo, so the ids the bundle
 *     looks up are extracted from the bundle itself and planted. Anything the
 *     bundle dereferences at top level therefore exists.
 *   - api.moomoo.io/servers, with one region and one server. The real list is
 *     bigger; the entry path does not care how many.
 *   - Cloudflare's turnstile api.js. This is the interesting one: the fake can
 *     be told to solve (--turnstile solve), to load but never solve
 *     (--turnstile never), or to never load at all (--turnstile blocked). Those
 *     are the three things that actually happen to people.
 *   - WebSocket, installed before the bundle so the bundle captures it. There
 *     is no server here; what matters is whether a socket is opened at all and
 *     what URL it carries.
 *
 * Usage:
 *   node tools/probe-entry.js [--mod <file>] [--unpatcher]
 *                             [--turnstile solve|never|blocked] [--wait ms]
 *
 * With no --mod and no --unpatcher it runs the stock game, which is what makes
 * it a control: the same dead end has to be reachable without any mod loaded,
 * or the diagnosis is about my harness rather than about the game.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
function flag(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i < 0 ? dflt : argv[i + 1];
}
const MOD = flag('mod', null);
const WITH_UNPATCHER = argv.includes('--unpatcher');
const TURNSTILE = flag('turnstile', 'solve');
const WAIT = parseInt(flag('wait', '6000'), 10);
if (!['solve', 'never', 'blocked'].includes(TURNSTILE)) {
  console.error('--turnstile must be solve, never or blocked'); process.exit(2);
}

const INDEX = fs.readFileSync(path.join(ROOT, 'reference/game-index.js'), 'utf8');
const VENDOR = fs.readFileSync(path.join(ROOT, 'reference/game-vendor.js'), 'utf8');

/* --- the page ------------------------------------------------------------ */
// Taken from the bundle rather than invented, so the harness cannot quietly
// drift away from what the game expects to find.
const ids = new Set();
for (const m of (INDEX + VENDOR).matchAll(/getElementById\(\s*"([^"]+)"/g)) ids.add(m[1]);
for (const m of (INDEX + VENDOR).matchAll(/querySelector\(\s*"#([\w-]+)/g)) ids.add(m[1]);
// The bundle looks this one up only to check whether it is already there.
// Planting it would suppress the very banner this probe is here to observe.
ids.delete('userscript-warning');

const CANVAS = new Set(['gameCanvas', 'mapDisplay', 'touchControls']);
const TEXT_INPUT = new Set(['nameInput', 'allianceInput']);
const CHECKBOX = new Set(['nativeResolution', 'showPing', 'playMusic']);
const html = ['<!doctype html><html><head><meta charset="utf-8"><title>moomoo</title>',
  // The padding is not decoration. The game's userscript banner is
  // position:fixed at top:0, and in a flat stack of divs it sits directly over
  // #enterGame -- so a real mouse click lands on the banner and the probe
  // reports a wedge that is an artefact of my layout. The game's own menu is
  // centred and does not have that problem.
  // #enterGame is pinned to a corner of its own. In a flat stack of divs the
  // planted elements overlap arbitrarily -- the game's fixed-position banner
  // covered it, and so did a mod menu -- and a real mouse click then lands on
  // whatever is on top, which reports a wedge that is an artefact of a layout
  // I invented. moomoo's own menu is laid out and does not have that problem.
  // Overlap is a real class of bug, but this harness cannot judge it honestly,
  // so it is taken off the table and the question left is the one this probe
  // can answer: does the entry state machine complete.
  '<style>body{margin:0;padding-top:160px}#mainMenu{position:relative}#turnstileWidget{width:300px;height:65px}',
  '#enterGame{position:fixed;left:16px;bottom:16px;width:220px;height:44px;z-index:2147483000;background:#8ecc51}',
  '.disabled{opacity:.5}</style></head><body>'];
for (const id of ids) {
  if (CANVAS.has(id)) html.push(`<canvas id="${id}" width="800" height="600"></canvas>`);
  else if (TEXT_INPUT.has(id)) html.push(`<input id="${id}" type="text">`);
  else if (CHECKBOX.has(id)) html.push(`<input id="${id}" type="checkbox">`);
  // the bundle reads settingsButton.getElementsByTagName("span")[0].
  else if (id === 'settingsButton') html.push(`<div id="${id}"><span></span></div>`);
  else if (id === 'enterGame') html.push(`<div id="${id}" class="menuButton">ENTER GAME</div>`);
  else html.push(`<div id="${id}"></div>`);
}
html.push('<script type="module" src="/assets/index.js"></script></body></html>');

const SERVERS = [{
  region: 'eu-west', index: 0, name: '0', key: 'a', port: 443,
  playerCount: 3, playerCapacity: 40, isPrivate: false,
  games: [{ playerCount: 3, playerCapacity: 40, isPrivate: false }]
}];

// Cloudflare's api.js, reduced to the two things the bundle uses: it defines
// window.turnstile with a render() that the bundle calls, and render() hands a
// token to the callback. "never" is a widget that appears and is never solved
// -- a real state, and the one that matters here.
const FAKE_TURNSTILE = `
window.__turnstileRenders = [];
window.turnstile = {
  render: function (el, opts) {
    var node = typeof el === "string" ? document.querySelector(el) : el;
    window.__turnstileRenders.push({
      id: node && node.id, laidOut: !!(node && node.offsetParent !== null), sitekey: opts && opts.sitekey
    });
    if (node) { var f = document.createElement("iframe"); f.width = 300; f.height = 65; node.appendChild(f); }
    var id = "w" + window.__turnstileRenders.length;
    ${TURNSTILE === 'solve' ? `
    setTimeout(function () {
      window.__turnstileToken = "TOKEN-" + id;
      opts && opts.callback && opts.callback(window.__turnstileToken);
    }, 300);` : ''}
    return id;
  },
  getResponse: function () { return window.__turnstileToken || ""; },
  reset: function () { window.__turnstileToken = null; }
};
`;

// Installed before the bundle so the bundle's `const kn = window.WebSocket`
// captures it. Nothing here talks to a server; the question is only whether a
// socket is opened, and with what.
const FAKE_WS = `
window.__sockets = [];
(function () {
  function FakeWS(url, protocols) {
    var self = this;
    this.url = String(url); this.readyState = 0; this.binaryType = "blob";
    this._l = {};
    window.__sockets.push(this.url);
    setTimeout(function () {
      self.readyState = 1;
      var e = { type: "open" };
      if (self.onopen) self.onopen(e);
      (self._l.open || []).forEach(function (f) { f(e); });
    }, 30);
  }
  FakeWS.prototype.send = function () {};
  FakeWS.prototype.close = function () {
    this.readyState = 3;
    var e = { type: "close", code: 1000 };
    if (this.onclose) this.onclose(e);
    (this._l.close || []).forEach(function (f) { f(e); });
  };
  FakeWS.prototype.addEventListener = function (t, f) { (this._l[t] = this._l[t] || []).push(f); };
  FakeWS.prototype.removeEventListener = function () {};
  FakeWS.CONNECTING = 0; FakeWS.OPEN = 1; FakeWS.CLOSING = 2; FakeWS.CLOSED = 3;
  window.WebSocket = FakeWS;
})();
`;

// moomoo is an FRVR title; its page sets this up before the bundle runs, and
// the bundle's whole boot hangs off frvrSdkInitPromise.
const FRVR = `
window.frvrSdkInitPromise = Promise.resolve();
window.FRVR = {
  bootstrapper: { complete: function () { return Promise.resolve(); } },
  tracker: { levelStart: function () {}, levelEnd: function () {} },
  ads: { show: function () { return Promise.resolve(); } },
  profile: { name: function () { return "probe"; } },
  channelCharacteristics: { allowNavigation: true }
};
`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  const errors = [], logs = [];
  page.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => logs.push(m.type() + ': ' + m.text()));

  await page.route('**/*', route => {
    const url = route.request().url();
    if (route.request().resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: html.join('\n') });
    }
    if (/\/assets\/index\.js$/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'text/javascript',
        body: INDEX.replace('./vendor-b760dbba.js', '/assets/vendor-b760dbba.js') });
    }
    if (/vendor-b760dbba\.js$/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: VENDOR });
    }
    if (/api(-\w+)?\.moomoo\.io\/servers/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVERS) });
    }
    if (/challenges\.cloudflare\.com\/turnstile/.test(url)) {
      if (TURNSTILE === 'blocked') return route.abort();
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_TURNSTILE });
    }
    return route.abort();
  });

  // A mod that lays its own menu over the page, or hides the card the widget
  // lives in, leaves #turnstileWidget with offsetParent === null -- and
  // Turnstile refuses to render into something that is not laid out. The game
  // retries every 150ms and gives up after 100 tries, permanently. This models
  // that without having to find a mod that happens to do it.
  if (argv.includes('--hide-widget')) {
    await page.addInitScript({ content: `
      document.addEventListener("DOMContentLoaded", function () {
        var w = document.getElementById("turnstileWidget");
        if (w) w.style.display = "none";
      });` });
  }
  await page.addInitScript({ content: FAKE_WS });
  await page.addInitScript({ content: FRVR });
  if (WITH_UNPATCHER) {
    await page.addInitScript({ content: fs.readFileSync(path.join(ROOT, 'MooUnpatcher.user.js'), 'utf8') });
  }
  if (MOD) await page.addInitScript({ content: fs.readFileSync(MOD, 'utf8') });

  await page.goto('https://moomoo.io/');
  await page.waitForTimeout(WAIT);

  const before = await page.evaluate(() => ({
    loadingText: (document.getElementById('loadingText') || {}).textContent,
    enterGameClass: (document.getElementById('enterGame') || {}).className,
    // a client replacement relabels the button as its own captcha progresses,
    // which is the only way to tell its entry path from the stock bundle's
    enterGameText: (document.getElementById('enterGame') || {}).textContent,
    enterGameBound: !!(document.getElementById('enterGame') || {}).onclick,
    widgetLaidOut: (() => { const w = document.getElementById('turnstileWidget'); return !!(w && w.offsetParent !== null); })(),
    renders: window.__turnstileRenders || [],
    token: !!window.__turnstileToken,
    // The shim's answer to the banner is to occupy the id with an empty
    // hidden div, so "is the element there" is no longer the question -- "is
    // there red text across the top of the page" is.
    banner: (() => { const b = document.getElementById('userscript-warning');
                     return !!(b && b.textContent && b.offsetParent !== null); })(),
    detectable: ['__gmMonkey', 'GM_info', 'GM', 'unsafeWindow'].filter(n => !!window[n]),
    sockets: window.__sockets.slice(),
  }));

  // "the click did nothing" has three quite different causes -- nothing is
  // bound, something is sitting on top of the button, or the handler ran and
  // took an early exit -- and they need different fixes, so tell them apart.
  if (argv.includes('--debug')) {
    console.log('\n--- #enterGame, in detail ---');
    console.log(JSON.stringify(await page.evaluate(() => {
      const el = document.getElementById('enterGame');
      if (!el) return { missing: true };
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        whatIsOnTop: hit ? (hit.id || hit.tagName + '.' + hit.className) : null,
        listeners: !!el.onclick,
        onclick: el.onclick ? el.onclick.toString().replace(/\s+/g, ' ').slice(0, 400) : null,
      };
    }), null, 2));
  }

  // Two presses. The dead end this probe exists to find is latched -- the game
  // sets a "already tried" flag on the first press and every press after it is
  // a no-op -- so one press cannot tell a slow connect from a wedged one.
  await page.click('#enterGame', { force: true }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.click('#enterGame', { force: true }).catch(() => {});
  await page.waitForTimeout(1800);

  const after = await page.evaluate(() => ({
    loadingText: (document.getElementById('loadingText') || {}).textContent,
    banner: (() => { const b = document.getElementById('userscript-warning');
                     return !!(b && b.textContent && b.offsetParent !== null); })(),
    sockets: window.__sockets.slice(),
    unpatch: window.unpatch ? window.unpatch.report() : null,
  }));

  console.log('=== turnstile: ' + TURNSTILE +
              (MOD ? ', mod: ' + path.basename(MOD) : '') +
              (WITH_UNPATCHER ? ', unpatcher' : '') + ' ===');
  console.log('\n--- before pressing ENTER GAME ---');
  console.log('  loadingText     : ' + JSON.stringify(before.loadingText));
  console.log('  #enterGame      : class=' + JSON.stringify(before.enterGameClass) +
              ' onclick=' + before.enterGameBound +
              ' text=' + JSON.stringify(before.enterGameText));
  console.log('  #turnstileWidget: laid out=' + before.widgetLaidOut +
              ' renders=' + JSON.stringify(before.renders));
  console.log('  token issued    : ' + before.token);
  console.log('  red banner      : ' + before.banner +
              (before.detectable.length ? '  (window.' + before.detectable.join(', window.') + ' present)' : ''));

  console.log('\n--- after pressing it twice ---');
  console.log('  loadingText     : ' + JSON.stringify(after.loadingText));
  console.log('  sockets opened  : ' + (after.sockets.length ? after.sockets.join('\n                    ') : '(none)'));
  console.log('  red banner      : ' + after.banner);

  if (errors.length) {
    console.log('\n--- page errors ---');
    console.log([...new Set(errors)].join('\n'));
  }
  const interesting = logs.filter(l => /unpatch|turnstile|Failed|error/i.test(l));
  if (interesting.length) {
    console.log('\n--- console ---');
    console.log([...new Set(interesting)].slice(0, 20).join('\n'));
  }

  const connected = after.sockets.some(u => /^wss:/.test(u));
  console.log('\n=> ' + (connected
    ? 'entry reached the socket: ' + after.sockets.filter(u => /^wss:/.test(u))[0]
    : 'entry DID NOT reach a socket -- stuck on ' + JSON.stringify(after.loadingText)));
  await browser.close();
  process.exit(connected ? 0 : 1);
})();
