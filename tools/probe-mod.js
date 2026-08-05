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

const args = process.argv.slice(2);
// A mod that carries its own transport shim must be probed WITHOUT the
// unpatcher: both declare `const EXP` at top level, so loading the two in one
// page is a SyntaxError before either runs. That is not a probe artefact --
// it is exactly what happens if you install both, which is why the unpatcher
// is only for mods that have not been repaired.
const standalone = args.includes('--standalone');
const target = args.find(a => !a.startsWith('--'));
if (!target) { console.error('usage: node tools/probe-mod.js [--standalone] <mod.user.js>'); process.exit(2); }
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

// Globals the mod publishes on window. "No errors" is not the same as "ran" --
// a deferred boot that never fires throws nothing at all. If a mod assigns to
// window and none of those names exist afterwards, its body never executed.
const globals = [...new Set(
  [...src.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=[^=]/g)].map(m => m[1])
)].filter(n => !['onload','onerror','onkeydown','onkeyup','onmousemove','location','msgpack','WebSocket','onbeforeunload','oncontextmenu','onresize','onblur','onfocus'].includes(n));

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

  // Building the page BEFORE the mod loads models a mod that runs at
  // document-end. A document-start mod sees none of this -- no body, no ids,
  // no window.config -- and that is exactly where this family dies. Getting
  // this order wrong made the probe pass a mod that was dead on the real page.
  const buildPage = () => page.evaluate((list) => {
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

  const publishConfig = () => page.evaluate((cfg) => {
    window.config = cfg;
    window.turnstile = { getResponse: () => 'PROBE-TOKEN', render: () => {}, reset: () => {} };
  }, CONFIG);

  // The constructor freeze the bundle does at boot.
  const harden = () => page.evaluate(() => {
    try {
      const captured = window.WebSocket;
      Object.defineProperty(window, 'WebSocket', { value: captured, writable: false, configurable: false });
      window.__frozen = 'succeeded';
    } catch (e) { window.__frozen = 'refused'; }
  });

  let before;
  if (standalone) {
    // A document-start mod: it loads into an empty document, and the bundle
    // arrives afterwards with the page, window.config and the freeze. A mod
    // that touches the DOM or config at its top level dies here, which is the
    // whole point of running it in this order.
    before = errors.length;
    await page.addScriptTag({ content: src }).catch(e => errors.push('[mod inject] ' + e.message));
    await buildPage();
    await publishConfig();
    await harden();
  } else {
    // A mod with no @run-at: the bundle has already been and gone, so the page
    // and config exist and WebSocket is frozen before the mod is even parsed.
    await buildPage();
    await publishConfig();
    await page.addScriptTag({ content: fs.readFileSync('/home/user/rynv2-op/MooUnpatcher.user.js', 'utf8') })
      .catch(e => errors.push('[unpatcher] ' + e.message));
    await harden();
    before = errors.length;
    await page.addScriptTag({ content: src }).catch(e => errors.push('[mod inject] ' + e.message));
  }
  await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
  await page.waitForTimeout(2500);

  const state = await page.evaluate((names) => ({
    // Either the mod hooked prototype.send itself, or it installed a handler
    // on a transport shim of its own. Both count as "the socket is wired up".
    modHookedSend: WebSocket.prototype.send.toString().length > 120,
    msgpackPresent: typeof window.msgpack === 'object' && typeof window.msgpack.decode === 'function',
    shimPresent: typeof EXP === 'object' && typeof EXP.send === 'function',
    constructorFreeze: window.__frozen,
    // A mod that boots draws something. "No errors" is not the same as "ran".
    elementsAdded: document.body.children.length,
    globalsPublished: names.filter(n => typeof window[n] !== 'undefined').length,
    globalsExpected: names.length,
    report: window.unpatch ? window.unpatch.report() : null,
  }), globals);

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

  const ok = errors.length === before && state.msgpackPresent
    && (state.modHookedSend || state.shimPresent)
    && (state.globalsExpected === 0 || state.globalsPublished > 0);
  console.log('\n' + (ok ? '=> the mod booted and its socket hook is installed'
                         : '=> the mod did NOT boot cleanly'));
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
