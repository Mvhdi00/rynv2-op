#!/usr/bin/env node
// Answers "will this mod run under the unpatcher?" by actually running it,
// instead of reading it and guessing.
//
// It builds a page carrying every id the mod looks up plus the window.config
// the game publishes, loads MooUnpatcher at document-start, then loads the mod
// unchanged and reports what threw and where. That is not proof the mod plays
// -- there is no server here -- but everything it catches is a real failure
// that would happen on the live page, and the boot is where these mods die.
//
//   node tools/probe-mod.js <path-to-mod.user.js>
const { chromium } = require('playwright');
const fs = require('fs');

const target = process.argv[2];
if (!target) { console.error('usage: node tools/probe-mod.js <mod.user.js>'); process.exit(2); }
const src = fs.readFileSync(target, 'utf8');

// Every id the mod asks for, so a missing element is never the reason it dies
// here when it would not be the reason on the real page. Most of these mods
// wrap getElementById in a one-line helper (`getEl`, `byId`, `$id`, ...), so
// the id has to be collected from the call sites of the wrapper too -- the
// first run of this missed jester's `getEl("gameUI")` and blamed the mod for
// an element the real page has.
const WRAPPERS = /(?:getElementById|getEl|getE|byId|\$id|getID|elem|gid)\(\s*[`"']([^`"']+)[`"']\s*\)/g;
const ids = [...new Set([
  ...[...src.matchAll(WRAPPERS)].map(m => m[1]),
  ...[...src.matchAll(/querySelector\(\s*[`"']#([\w-]+)/g)].map(m => m[1]),
])].filter(id => /^[A-Za-z][\w-]*$/.test(id));

const CONFIG = {
  clientSendRate: 9, serverUpdateRate: 9, mapScale: 14400, snowBiomeTop: 2400,
  treeScales: [150, 160, 165, 175], bushScales: [80, 85, 95], rockScales: [80, 85, 95],
  maxScreenWidth: 1920, maxScreenHeight: 1080, playerScale: 35, playerSpeed: 0.0016,
  playerDecel: 0.993, mapPingScale: 40, mapPingTime: 2200, maxNameLength: 15,
  weaponVariants: [{ id: 0, src: '', xp: 0, val: 1 }, { id: 1, src: '_g', xp: 3000, val: 1.1 },
                   { id: 2, src: '_d', xp: 7000, val: 1.18 }, { id: 3, src: '_r', poison: true, xp: 12000, val: 1.18 }],
  resourceTypes: ['wood', 'food', 'stone', 'points'], areaCount: 7, treesPerArea: 9,
  bushesPerArea: 3, totalRocks: 32, goldOres: 7, riverWidth: 724, riverPadding: 114,
  waterCurrent: 0.0011, waveSpeed: 0.0001, waveMax: 1.3, snowSpeed: 0.75,
  shieldAngle: Math.PI / 3, collisionDepth: 6, minimapRate: 3000, aiTurnRandom: 0.06,
  cowNames: ['Cow'], animalCount: 7, hitReturnRatio: 0.25, healthBarWidth: 50,
  healthBarPad: 4.5, iconPadding: 15, iconPad: 0.9, deathFadeout: 3000, crownIconScale: 60,
  crownPad: 35, chatCountdown: 3000, chatCooldown: 500,
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  const errors = [], warnings = [];
  page.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'warning' || m.type() === 'error') warnings.push(t);
  });

  await page.setContent('<!doctype html><html><head><title>probe</title></head><body></body></html>');
  await page.evaluate((list) => {
    // moomoo's two canvases. Everything else on the page is a div, and a div
    // where the mod expects a canvas throws on .getContext for reasons that
    // have nothing to do with the mod.
    const canvases = ['gameCanvas', 'mapDisplay', 'touchControls'];
    for (const id of list) {
      const el = document.createElement(/canvas/i.test(id) || canvases.includes(id) ? 'canvas' : 'div');
      el.id = id;
      document.body.appendChild(el);
    }
  }, ids.concat(['gameCanvas', 'mapDisplay', 'storeHolder', 'chatBox', 'menuCardHolder']));

  await page.addScriptTag({ content: fs.readFileSync('/home/user/rynv2-op/MooUnpatcher.user.js', 'utf8') })
    .catch(e => errors.push('[unpatcher] ' + e.message));

  // the bundle: window.config, and the constructor freeze it does at boot
  await page.evaluate((cfg) => {
    window.config = cfg;
    window.turnstile = { getResponse: () => 'PROBE-TOKEN', render: () => {}, reset: () => {} };
    try {
      const captured = window.WebSocket;
      Object.defineProperty(window, 'WebSocket', { value: captured, writable: false, configurable: false });
    } catch (e) { /* refused, as intended */ }
  }, CONFIG);

  const before = errors.length;
  await page.addScriptTag({ content: src }).catch(e => errors.push('[mod inject] ' + e.message));
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => ({
    modHookedSend: WebSocket.prototype.send.toString().length > 120,
    msgpackPresent: typeof window.msgpack === 'object' && typeof window.msgpack.decode === 'function',
    report: window.unpatch ? window.unpatch.report() : null,
  }));

  const lines = src.split('\n');
  console.log('--- errors thrown by the mod ---');
  if (errors.length === before) console.log('(none)');
  for (const e of errors.slice(before)) {
    console.log(e);
    const m = e.match(/<anonymous>:(\d+):/);
    if (m) console.log('      ' + (lines[m[1] - 1] || '').trim().slice(0, 140));
  }

  console.log('\n--- what the unpatcher said ---');
  console.log(warnings.length ? [...new Set(warnings)].join('\n') : '(nothing)');

  console.log('\n--- state ---');
  console.log(JSON.stringify(state, null, 2));

  const ok = errors.length === before && state.modHookedSend && state.msgpackPresent;
  console.log('\n' + (ok ? '=> the mod booted and its socket hook is installed'
                         : '=> the mod did NOT boot cleanly'));
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
