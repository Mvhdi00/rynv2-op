#!/usr/bin/env node
// The unpatcher's whole job is to run in a real page, so a node harness with a
// hand-written fake DOM can only take it so far -- the fake is my model of the
// browser, and the model is exactly what needs checking. This loads the shim
// into a real Chromium against a page that behaves the way moomoo.io does
// (ads already gone, WebSocket frozen at boot), bolts a synthetic mod on top
// that commits every boot mistake this project has had to fix by hand, and
// reports whether the mod survived.
//
//   node tools/probe-unpatcher.js
const { chromium } = require('playwright');
const fs = require('fs');

// A mod that does all seven things at once. Every one of these is a real
// failure taken from a script in this repo, not an invented one.
const BROKEN_MOD = `
(function () {
    // 1. the ad teardown every mod of this era opens with. The elements are
    //    long gone, so each of these lines is a TypeError on a live page.
    var c = document.getElementById("adCard");
    c.parentNode.removeChild(c);
    document.getElementById("promoImgHolder").style.display = "none";
    document.getElementById("moomooio_728x90_home").parentElement.style.display = "none";
    document.getElementById("ot-sdk-btn-floating").remove();

    // 2. GM_* and unsafeWindow, undefined under "@grant none"
    GM_setValue("modSetting", { autoheal: true });
    window.__modSetting = GM_getValue("modSetting");
    window.__unsafeIsWindow = (unsafeWindow === window);
    GM_addStyle(".modmenu{color:#8ecc51}");

    // 3. window.msgpack, which came from a CDN that died in 2019
    window.__codecWorks = msgpack.decode(msgpack.encode(["sp", [{ name: "probe" }]]))[0] === "sp";

    // 4. wrapping the constructor, which the bundle has already frozen
    var Native = window.WebSocket;
    window.__wrapAccepted = false;
    window.WebSocket = function (url) { window.__sawUrl = url; return new Native(url); };
    window.__wrapAccepted = (window.WebSocket !== Native);

    // 5. hooking send the way this whole family does
    WebSocket.prototype.nsend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (buf) {
        window.__modSawOutgoing = (window.__modSawOutgoing || 0) + 1;
        this.nsend(buf);
    };

    window.__modBooted = true;
})();
`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).split('\n').slice(0, 2).join(' | ')));

  // A blank page with none of the ad furniture -- i.e. moomoo.io as it is now.
  await page.setContent('<!doctype html><html><head><title>probe</title></head><body>'
    + '<div id="gameCanvas"></div></body></html>');

  // 1. the unpatcher, at document-start
  await page.addScriptTag({ content: fs.readFileSync('/home/user/rynv2-op/MooUnpatcher.user.js', 'utf8') })
    .catch(e => logs.push('[inject unpatcher] ' + e.message));

  // 2. the bundle's own hardening, which runs after us and before the mod
  await page.evaluate(() => {
    window.__frozenPin = 'not attempted';
    const captured = window.WebSocket;
    try {
      Object.defineProperty(window, 'WebSocket', { value: captured, writable: false, configurable: false });
      window.__frozenPin = 'succeeded';        // the mod is dead from here
    } catch (e) {
      window.__frozenPin = 'refused: ' + e.constructor.name;
    }
    // and the Turnstile widget the page solves before connecting
    window.turnstile = { getResponse: () => 'PROBE-TOKEN' };
  });

  // 3. the mod, unchanged and broken
  await page.addScriptTag({ content: BROKEN_MOD }).catch(e => logs.push('[inject mod] ' + e.message));

  const state = await page.evaluate(() => ({
    modBooted: window.__modBooted === true,
    unsafeIsWindow: window.__unsafeIsWindow,
    modSetting: JSON.stringify(window.__modSetting),
    codecWorks: window.__codecWorks,
    frozenPin: window.__frozenPin,
    wrapAccepted: window.__wrapAccepted,
    styleInHead: !!document.querySelector('head style'),
    atticExists: !!document.getElementById('unpatch-attic'),
    realIdStillNull: document.getElementById('nothing-like-this') === null,
    gameCanvasReal: document.getElementById('gameCanvas') && document.getElementById('gameCanvas').id === 'gameCanvas',
    // the mod's own wrapper sees the URL it was given, so the repaired one has
    // to be read off the socket that actually got opened
    connectUrl: (function () {
      try { return new WebSocket('wss://example.invalid/').url; } catch (e) { return 'threw: ' + e.message; }
    })(),
    modWrapperSawUrl: window.__sawUrl,
    report: window.unpatch ? window.unpatch.report() : null,
  }));

  console.log('--- console ---');
  console.log(logs.length ? logs.join('\n') : '(nothing logged)');
  console.log('\n--- state ---');
  console.log(JSON.stringify(state, null, 2));

  const ok = state.modBooted
    && state.unsafeIsWindow === true
    && state.modSetting === '{"autoheal":true}'
    && state.codecWorks === true
    && /^refused/.test(state.frozenPin)
    && state.wrapAccepted === true
    && state.styleInHead
    && state.realIdStillNull
    && state.gameCanvasReal
    && /token=cf%3APROBE-TOKEN/.test(state.connectUrl || '')
    && !logs.some(l => l.startsWith('[pageerror]'));

  console.log('\n' + (ok ? '=> the broken mod booted clean' : '=> SOMETHING IS STILL BROKEN'));
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
