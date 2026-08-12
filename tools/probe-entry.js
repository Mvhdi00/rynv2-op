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
 *   - WebSocket, installed before the bundle so the bundle captures it. Behind
 *     it (--server) sits the real thing: the io-init handshake and the HMAC
 *     framing, computed in node with the game bundle's own crypto lifted out of
 *     reference/game-index.js. So a packet the mod sends is verified the way
 *     the live server verifies it -- signature, opcode, sequence -- and a reply
 *     goes back framed the same way. That turns "a socket was opened" into
 *     "the mod is talking, and the server understands it".
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
const extract = require('../test/extract.js');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
function flag(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i < 0 ? dflt : argv[i + 1];
}
const MOD = flag('mod', null);
const SERVER = argv.includes('--server');
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
  var nextId = 0;
  function FakeWS(url, protocols) {
    var self = this;
    this.url = String(url); this.readyState = 0; this.binaryType = "blob";
    this._l = {};
    this.__id = ++nextId;
    window.__sockets.push(this.url);
    setTimeout(function () {
      self.readyState = 1;
      window.__live = window.__live || {};
      window.__live[self.__id] = self;
      var e = { type: "open" };
      (self._l.open || []).forEach(function (f) { if (f) f.call(self, e); });
      // The server speaks first: io-init carries the seed and key every frame
      // after it is signed with.
      if (window.__serverOpened) window.__serverOpened(self.__id);
    }, 30);
  }
  FakeWS.prototype.send = function (data) {
    if (!window.__serverRecv) return;
    var bytes = data;
    if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    else return;
    window.__serverRecv(this.__id, Array.from(bytes));
  };
  FakeWS.prototype.close = function () {
    this.readyState = 3;
    var e = { type: "close", code: 1000 };
    var self = this;
    (this._l.close || []).forEach(function (f) { if (f) f.call(self, e); });
  };
  FakeWS.prototype.addEventListener = function (t, f) { (this._l[t] = this._l[t] || []).push(f); };
  FakeWS.prototype.removeEventListener = function () {};
  // onmessage is not a slot that runs first: the browser gives it a place in
  // the listener list at the moment it is FIRST assigned, and reassigning
  // replaces it where it already stands. Dispatching it ahead of listeners
  // registered earlier put novastorm's client in front of the shim's io-init
  // sniffer, so the client sent its spawn on a socket the shim had not yet
  // seen a session for -- a wedge invented entirely by this harness.
  ["message", "open", "close", "error"].forEach(function (kind) {
    Object.defineProperty(FakeWS.prototype, "on" + kind, {
      configurable: true,
      get: function () { return this["_h" + kind] || null; },
      set: function (fn) {
        var list = this._l[kind] = this._l[kind] || [];
        var at = this["_i" + kind];
        if (at === undefined) { this["_i" + kind] = list.length; list.push(fn); }
        else { list[at] = fn; }
        this["_h" + kind] = fn;
      }
    });
  });
  FakeWS.CONNECTING = 0; FakeWS.OPEN = 1; FakeWS.CLOSING = 2; FakeWS.CLOSED = 3;
  // Delivered from node, which is where the framing is done.
  window.__deliver = function (id, bytes) {
    var sock = (window.__live || {})[id];
    if (!sock) return;
    var buf = new Uint8Array(bytes).buffer;
    var payload = sock.binaryType === "arraybuffer" ? buf : new Blob([buf]);
    var e = { type: "message", data: payload, target: sock };
    (sock._l.message || []).forEach(function (f) { if (f) f.call(sock, e); });
  };
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
  /* --- the server, in node ---------------------------------------------- */
  // The framing is the game's own: opcode tables from the seed, HMAC from the
  // key, both lifted out of reference/game-index.js by test/extract.js. A
  // signature that does not verify here would not verify on the live server.
  const wire = { sent: [], bad: 0, names: [], detail: [], handshakes: 0, unsigned: 0, threw: [], rejected: [], spawned: false };
  if (SERVER) {
    const { game, msgpack: vendor } = extract.load();
    const enc = new vendor.Encoder(), dec = new vendor.Decoder();
    const SEED = 0x00DEFACE, KEY_HEX = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const tables = game.Po(SEED);
    const key = game.Ro(KEY_HEX);
    // A packet is delivered by calling into the page, so anything the mod's
    // message handler throws comes back on THIS promise -- it is never a
    // pageerror. Swallowing it here hid novastorm's real failure for an
    // embarrassingly long time: the client looked like it simply chose not to
    // send its spawn.
    const deliver = (id, bytes) =>
      page.evaluate(([i, b]) => window.__deliver(i, b), [id, Array.from(bytes)])
        .catch(e => {
          const text = String(e.message || e);
          wire.threw.push(text.split('\n').slice(0, 4).join(' | '));
        });

    await page.exposeFunction('__serverOpened', async (id) => {
      wire.handshakes++;
      await deliver(id, enc.encode(['io-init', [1, SEED, KEY_HEX, game.Ht]]));
    });
    await page.exposeFunction('__serverRecv', (id, arr) => {
      const buf = Buffer.from(arr);
      wire.sent.push(buf.length);
      if (buf.length <= 6) { wire.unsigned++; return; }
      const want = Buffer.from(game.Eo(key, buf.subarray(6)));
      if (!want.equals(buf.subarray(0, 6))) {
        wire.bad++;
        // Unsigned traffic is the interesting kind of wrong: it means someone
        // sent before the session existed. Say what it was.
        try {
          const plain = dec.decode(new Uint8Array(buf));
          wire.rejected.push('unsigned ' + JSON.stringify(plain).slice(0, 90));
        } catch (e) { wire.rejected.push('bad signature, ' + buf.length + ' bytes'); }
        return;
      }
      let decoded;
      try { decoded = dec.decode(new Uint8Array(buf.subarray(6))); } catch (e) { wire.bad++; return; }
      const name = tables.c2s.dec[decoded[0]];
      if (!name) { wire.bad++; return; }
      wire.names.push(name);
      wire.detail.push(name + ' seq=' + decoded[2] + ' ' + JSON.stringify(decoded[1]).slice(0, 90));
      // Answer the spawn, so the client actually enters the game. Everything a
      // player complains about -- "no menu", "no visuals" -- happens after this
      // point, and a probe that stops at the spawn cannot see any of it.
      // "C" is setupGame(yourSID) in both the current bundle and the 2019
      // client every replacement in this family is built from.
      if (name === 'M') {
        // Server -> client is NOT signed. Only the client's packets carry the
        // 6-byte HMAC; the bundle's own onmessage decodes what arrives with no
        // header at all. Framing these too fed the mod six bytes of garbage in
        // front of its packet and made it look as though the opcode table was
        // wrong.
        const s2c = (n, args) => {
          const code = tables.s2c.enc[n];
          if (code === undefined) return;
          deliver(id, enc.encode([code, args]));
        };
        wire.spawned = true;
        s2c('C', [1]);
      }
    });
  }

  // How many render loops are running. A client replacement draws to
  // #gameCanvas -- and so does the bundle it is loaded on top of, which is
  // still running whether or not it has a connection. Two loops on one canvas
  // is not a subtle bug: whichever draws last is what the player sees.
  await page.addInitScript({ content: `
    window.__rafLoops = new Map();
    window.__drawOrder = [];
    (function () {
      var raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = function (fn) {
        var name = "?";
        try {
          name = (String(fn).match(/function\\s+([A-Za-z_$][\\w$]*)/) || [, "anon"])[1];
          var src = String(fn).replace(/\\s+/g, ' ').slice(0, 70);
          window.__rafLoops.set(src, (window.__rafLoops.get(src) || 0) + 1);
        } catch (e) {}
        return raf(function (t) {
          // Two render loops on one canvas: the one that runs LAST in a frame
          // is the one the player sees. Record the order.
          if (window.__drawOrder.length < 40) window.__drawOrder.push(name);
          return fn(t);
        });
      };
    })();` });
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
    // The shim's answer to the banner is to occupy the id with an empty hidden
    // div, so "is the element there" is not the question -- "is there red text
    // across the top of the page" is.
    // NOT offsetParent: it is null for a position:fixed element, and the bar is
    // position:fixed. That mistake had this reporting "no banner" while the bar
    // was on screen, which is the worst possible way for a check to be wrong.
    banner: (() => {
      const b = document.getElementById('userscript-warning');
      if (!b || !b.textContent) return false;
      const cs = getComputedStyle(b);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.01;
    })(),
    detectable: ['__gmMonkey', 'GM_info', 'GM', 'unsafeWindow'].filter(n => !!window[n]),
    sockets: window.__sockets.slice(),
  }));

  // "the click did nothing" has three quite different causes -- nothing is
  // bound, something is sitting on top of the button, or the handler ran and
  // took an early exit -- and they need different fixes, so tell them apart.
  // "the mod loaded" and "the mod's UI is there" are different questions, and
  // the second one is what a player actually sees. This lists what the mod put
  // on the page and whether any of it is visible.
  if (argv.includes('--dom')) {
    console.log('\n--- what the mod put on the page ---');
    const added = await page.evaluate((planted) => {
      const known = new Set(planted);
      const out = [];
      for (const el of document.body.children) {
        if (el.id && known.has(el.id)) continue;
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          cls: (el.className && String(el.className).slice(0, 60)) || null,
          size: Math.round(r.width) + 'x' + Math.round(r.height),
          display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
          seen: !!(r.width && r.height && cs.display !== 'none' &&
                   cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.01),
          kids: el.children.length,
        });
      }
      // ...and what it took away. A mod tearing out page furniture is normal
      // (the ads are gone anyway), but tearing out something the player uses
      // is the kind of thing only a list makes obvious.
      const gone = planted.filter(id => !document.getElementById(id));
      const emptied = planted.filter(id => {
        const el = document.getElementById(id);
        return el && el.tagName === 'DIV' && !el.textContent && !el.children.length;
      });
      return { added: out, gone, emptied, styles: document.querySelectorAll('style').length };
    }, [...ids]);
    console.log('  <style> blocks on the page: ' + added.styles);
    console.log('  removed from the page: ' + (added.gone.length ? added.gone.join(' ') : '(nothing)'));
    for (const el of added.added) {
      console.log('  ' + (el.seen ? 'VISIBLE ' : 'hidden  ') +
        el.tag + (el.id ? '#' + el.id : '') + (el.cls ? '.' + el.cls.replace(/\s+/g, '.') : '') +
        '  ' + el.size + '  display:' + el.display + ' opacity:' + el.opacity +
        ' children:' + el.kids);
    }
  }

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
        // a bundled 2019 io-client, if the mod carries one: whether it got its
        // session and how far its own entry got
        io: window.io ? { connected: window.io.connected, socketId: window.io.socketId,
                          hasSocket: !!window.io.socket, started: !!window.io._started } : null,
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
    banner: (() => {
      const b = document.getElementById('userscript-warning');
      if (!b || !b.textContent) return false;
      const cs = getComputedStyle(b);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.01;
    })(),
    sockets: window.__sockets.slice(),
    // a bundled 2019 io-client, if the mod carries one: whether it got a
    // session, and how far its own entry got
    io: window.io ? { connected: window.io.connected, socketId: window.io.socketId,
                      hasSocket: !!window.io.socket, started: !!window.io._started } : null,
    // only loops that actually kept going -- a one-shot rAF is not a loop
    drawOrder: (window.__drawOrder || []).slice(-16).join(' -> '),
    loops: [...(window.__rafLoops || new Map())].filter(([, n]) => n > 20)
             .sort((a, b) => b[1] - a[1]).slice(0, 6),
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
  if (after.io) console.log('  bundled client  : ' + JSON.stringify(after.io));
  if (after.loops && after.loops.length) {
    console.log('  render loops    : ' + after.loops.length + ' distinct');
    for (const [src, n] of after.loops) console.log('    x' + String(n).padStart(4) + '  ' + src);
    console.log('  order in a frame: ' + after.drawOrder);
  }

  if (errors.length) {
    console.log('\n--- page errors ---');
    console.log([...new Set(errors)].join('\n'));
  }
  const interesting = logs.filter(l => /unpatch|turnstile|Failed|error/i.test(l));
  if (interesting.length) {
    console.log('\n--- console ---');
    console.log([...new Set(interesting)].slice(0, 20).join('\n'));
  }

  if (SERVER) {
    console.log('\n--- what reached the server ---');
    console.log('  io-init sent    : ' + wire.handshakes +
                (wire.spawned ? ', and setupGame sent back after the spawn' : ''));
    console.log('  packets         : ' + wire.sent.length +
                ' (' + wire.names.length + ' signed and understood, ' +
                wire.bad + ' rejected, ' + wire.unsigned + ' too short to be framed)');
    console.log('  opcodes         : ' + (wire.names.length
      ? [...new Set(wire.names)].join(' ') : '(none)'));
    for (const d of wire.detail.slice(0, 12)) console.log('    ' + d);
    for (const r of wire.rejected.slice(0, 8)) console.log('    rejected: ' + r);
    if (wire.threw.length) {
      console.log('  handling a packet threw:');
      for (const t of [...new Set(wire.threw)]) console.log('    ' + t);
    }
  }

  const connected = after.sockets.some(u => /^wss:/.test(u));
  console.log('\n=> ' + (connected
    ? 'entry reached the socket: ' + after.sockets.filter(u => /^wss:/.test(u))[0]
    : 'entry DID NOT reach a socket -- stuck on ' + JSON.stringify(after.loadingText)));
  // With a server behind it, "opened a socket" is not the bar any more: the
  // mod has to say something the server accepts.
  const ok = SERVER ? (connected && wire.names.length > 0 && wire.bad === 0) : connected;
  if (SERVER && connected) {
    console.log('   ' + (ok
      ? 'and the server accepted ' + wire.names.length + ' packet(s) from it'
      : 'but nothing it sent was accepted'));
  }
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
