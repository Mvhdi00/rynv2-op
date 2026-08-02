#!/usr/bin/env node
// Loads Sakuna into a real browser against a DOM built from the ids the script
// itself looks up, and reports the first thing that goes wrong. Static analysis
// missed three real boot failures that this caught in seconds.
//
//   python3 -m http.server 8877 --directory tools &
//   node tools/probe-sakuna.js
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')));

  // a page with the ids the game creates, plus window.config
  await page.goto('http://localhost:8877/probe-host.html');

  const src = fs.readFileSync('/home/user/rynv2-op/Sakuna.user.js', 'utf8');
  await page.addScriptTag({ content: src }).catch(e => logs.push('[inject] ' + e.message));

  // now publish window.config the way the bundle does, and let the poll fire
  await page.evaluate(() => { window.config = {
      clientSendRate: 9, serverUpdateRate: 9, mapScale: 14400, snowBiomeTop: 2400,
      treeScales: [150, 160, 165, 175], bushScales: [80, 85, 95], rockScales: [80, 85, 95],
      maxScreenWidth: 1920, maxScreenHeight: 1080, playerScale: 35, playerSpeed: 0.0016,
      playerDecel: 0.993, mapPingScale: 40, mapPingTime: 2200, maxNameLength: 15,
      weaponVariants: [{id:0,src:"",xp:0,val:1},{id:1,src:"_g",xp:3000,val:1.1},
                       {id:2,src:"_d",xp:7000,val:1.18},{id:3,src:"_r",poison:true,xp:12000,val:1.18}],
      resourceTypes: ["wood","food","stone","points"], areaCount: 7, treesPerArea: 9,
      bushesPerArea: 3, totalRocks: 32, goldOres: 7, riverWidth: 724, riverPadding: 114,
      waterCurrent: 0.0011, waveSpeed: 0.0001, waveMax: 1.3, snowSpeed: 0.75,
      shieldAngle: Math.PI/3, collisionDepth: 6, minimapRate: 3000, aiTurnRandom: 0.06,
      cowNames: ["Cow"], animalCount: 7, hitReturnRatio: 0.25, healthBarWidth: 50,
      healthBarPad: 4.5, iconPadding: 15, iconPad: 0.9, deathFadeout: 3000, crownIconScale: 60,
      crownPad: 35, chatCountdown: 3000, chatCooldown: 500,
    }; });
  await page.waitForTimeout(1500);

  console.log('--- console ---');
  console.log(logs.length ? logs.slice(0, 25).join('\n') : '(nothing logged)');
  const state = await page.evaluate(() => ({
    bootDefined: typeof __sakunaBoot,
    startDefined: typeof __sakunaStart,
    keyboard: !!document.getElementById('bkeyboard'),
    expLoaded: typeof EXP,
    codeTable: typeof code,
    menu: !!document.querySelector('.menu'),
    musicMenu: !!document.getElementById('musicmenu'),
    keyboardKeys: document.querySelectorAll('#bkeyboard .key').length,
    modElements: document.body.children.length,
    settingsPages: document.querySelectorAll('.menu-page, .menu-content').length,
    bootFinished: typeof updateGame === 'function' && typeof doUpdate === 'function',
  }));
  // print the exact source line each error points at, from the page's own copy
  const lines = src.split('\n');
  for (const l of logs) {
    const m = l.match(/<anonymous>:(\d+):(\d+)/);
    if (m) console.log('--- source at line ' + m[1] + ' ---\n' + (lines[m[1] - 1] || '(out of range)').slice(0, 160));
  }
  console.log('--- state ---');
  console.log(JSON.stringify(state, null, 2));
  await browser.close();
})();
