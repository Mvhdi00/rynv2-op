#!/usr/bin/env node
// Same idea as probe-sakuna.js, for unX: load it in a real browser against a
// DOM built from the ids it looks up, and report anything that throws.
//
//   python3 -m http.server 8877 --directory tools &
//   node tools/probe-unx.js
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  let src = fs.readFileSync('/home/user/rynv2-op/UnX.user.js', 'utf8');
  // expose the pieces we want to poke at from outside the IIFE
  src = src.replace('    function sendMoveDir() {',
    '    window.__probeGetMoveDir = getMoveDir;\n'
    + '    window.__probeAutoPlay = unxAutoPlay;\n'
    + '    window.__probeMenu = () => scriptMenu;\n'
    + '    window.__probeKeys = () => keys;\n'
    + '    window.__probeSendMoveDir = sendMoveDir;\n'
    + '    window.__probeLastMoveDir = () => lastMoveDir;\n'
    + '    function sendMoveDir() {');

  // build the page from the ids the script itself asks for
  const ids = new Set();
  for (const m of src.matchAll(/getElementById\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) ids.add(m[1]);
  const canvases = new Set(['gameCanvas', 'mapDisplay']);
  const html = [...ids].map(id => canvases.has(id)
    ? `<canvas id="${id}"></canvas>` : `<div id="${id}"></div>`).join('\n');
  fs.writeFileSync('/home/user/rynv2-op/tools/probe-unx-host.html',
    `<!doctype html><html><head><meta charset="utf-8"></head><body>\n${html}\n</body></html>`);

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).split('\n').slice(0, 4).join(' | ')));

  await page.goto('http://localhost:8877/probe-unx-host.html');
  await page.addScriptTag({ content: src }).catch(e => logs.push('[inject] ' + e.message));
  await page.waitForTimeout(1200);

  // the actual question: does asking for a move direction throw?
  const move = await page.evaluate(() => {
    const out = {};
    try { out.toggleValue = String(window.__probeMenu().toggles.autoPlay); }
    catch (e) { out.toggleValue = 'THREW: ' + e; }
    try { out.autoPlayDir = String(window.__probeAutoPlay.dir()); }
    catch (e) { out.autoPlayDir = 'THREW: ' + e; }
    try { out.getMoveDirNoKeys = String(window.__probeGetMoveDir()); }
    catch (e) { out.getMoveDirNoKeys = 'THREW: ' + e; }
    // hold 'W' (keyCode 87) and see what the movement path produces
    try {
      window.__probeKeys()[87] = 1;
      out.getMoveDirWithW = String(window.__probeGetMoveDir());
      window.__probeSendMoveDir();
      out.lastMoveDirAfterSend = String(window.__probeLastMoveDir());
      window.__probeKeys()[87] = 0;
    } catch (e) { out.withW = 'THREW: ' + e; }
    return out;
  });

  console.log('--- console ---');
  console.log(logs.length ? logs.slice(0, 20).join('\n') : '(nothing logged)');
  const lines = src.split('\n');
  for (const l of logs) {
    const m = l.match(/<anonymous>:(\d+):(\d+)/);
    if (m) console.log('--- source at line ' + m[1] + ' ---\n' + (lines[m[1] - 1] || '?').slice(0, 150));
  }
  console.log('--- getMoveDir ---');
  console.log(JSON.stringify(move));
  await browser.close();
})();
