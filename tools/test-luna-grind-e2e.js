#!/usr/bin/env node
/*
 * test-luna-grind-e2e.js
 *
 * Auto grind and the FPS / Ping counter inside the whole Luna_Client.user.js,
 * booted in a stand-in moomoo page and connected to a local game server
 * (tools/lib/fake-moomoo.js) that plays the game's side: it sends the player's
 * position every tick, the item bar, the tank hat, and the turrets the client
 * places — at the spot the game would put them — and it reads back every
 * packet the client sends.
 *
 * Run on a normal server (moomoo.io, turret limit 2) and on sandbox
 * (sandbox.moomoo.io — Luna decides from the hostname, so the browser is told
 * to resolve both names to the local server).
 *
 *   node tools/test-luna-grind-e2e.js        (needs playwright)
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { loadPlaywright, createGameServer, standInPage, ROOT } = require("./lib/fake-moomoo");

const { chromium, WebSocketServer } = loadPlaywright();
const LUNA = fs.readFileSync(path.join(ROOT, "Luna_Client.user.js"), "utf8");
const PAGE = standInPage(LUNA);
const DRIVERS = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8"));
const GATHER = DRIVERS.config.gatherAngle;
const WEAPONS = {};
DRIVERS.weapons.forEach(w => { WEAPONS[w.id] = w; });
const R = 35 + 43 - 5;                       /* where a turret lands from the player */
const deg = r => +(r * 180 / Math.PI).toFixed(1);
const angleDist = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? "  ok   " : "  FAIL ") + name + (detail !== undefined && !ok ? "  -> " + JSON.stringify(detail) : ""));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scenario(browser, port, host, sandbox) {
  console.log((sandbox ? "sandbox" : "normal server") + " (" + host + ")");
  /* On land: the middle of the map (y 7200) is the river, where the game
   * refuses turrets. */
  const st = { x: 3000, y: 3000, vx: 0, vy: 0, moveDir: null, dir: 0, weapon: 5, skin: 0, building: null, gather: false,
    reload: {}, placed: [], turrets: new Map(), nextSid: 500, ticking: null, aim: 0, sets: [], swings: [] };
  /* One swing of the held weapon toward the server's facing, scored the way
   * the game's gather() does; a destroyed turret is removed for the client. */
  const swing = srv => {
    const weapon = WEAPONS[st.weapon];
    const dmg = weapon.dmg * (weapon.sDmg || 1) * (st.skin === 40 ? 3.3 : 1);
    let hits = 0, kills = 0;
    const present = st.turrets.size;
    for (const [ sid, t ] of [ ...st.turrets ]) {
      if (Math.hypot(t.x - st.x, t.y - st.y) - 43 > weapon.range) continue;
      if (angleDist(Math.atan2(t.y - st.y, t.x - st.x), st.dir) > GATHER) continue;
      hits++;
      t.health -= dmg;
      if (t.health <= 0) {
        kills++;
        st.turrets.delete(sid);
        srv.sendTo("Q", [ sid ]);
        srv.sendTo("S", [ 7, st.turrets.size ]);
      }
    }
    const set = st.sets[st.sets.length - 1];
    st.swings.push({ hits, kills, present,
      behind: set ? (set.x - st.x) * Math.cos(set.axis) + (set.y - st.y) * Math.sin(set.axis) : 0, set: st.sets.length });
    st.reload[st.weapon] = weapon.speed;
  };
  const server = createGameServer((f, srv) => {
    if (f.name === "M") {
      srv.sendTo("V", [ [ 0, 3, 6, 10, 15, 17 ] ]);         /* items: ..., turret */
      srv.sendTo("V", [ [ 5, 10 ], true ]);                  /* polearm + great hammer */
      srv.sendTo("5", [ 0, 40, 0 ]);                         /* tank hat owned */
      srv.sendTo("N", [ "wood", 5000, 1 ]);                  /* a turret costs 200 wood */
      srv.sendTo("N", [ "stone", 5000, 1 ]);                 /* and 150 stone */
      clearInterval(st.ticking);
      st.ticking = setInterval(() => {
        /* the game's update(): movement, then the held weapon swings
         * whenever auto gather is on and it has reloaded */
        const C = (WEAPONS[st.weapon].spdMult || 1) * (st.skin === 40 ? 0.3 : 1);
        if (st.moveDir !== null && st.moveDir !== undefined) {
          st.vx += Math.cos(st.moveDir) * 0.0016 * C * 111;
          st.vy += Math.sin(st.moveDir) * 0.0016 * C * 111;
        }
        st.x += st.vx * 111;
        st.y += st.vy * 111;
        st.vx *= Math.pow(0.993, 111);
        st.vy *= Math.pow(0.993, 111);
        for (const k of Object.keys(st.reload)) st.reload[k] = Math.max(0, st.reload[k] - 111);
        if (st.gather && !(st.reload[st.weapon] > 0)) swing(srv);
        srv.sendTo("a", [ [ 5, st.x, st.y, st.dir, -1, st.weapon, 0, null, 0, st.skin, 0, 0, 0 ] ]);
      }, 111);
    } else if (f.name === "9") {
      st.moveDir = f.args[0];
    } else if (f.name === "z") {
      if (f.args[1]) st.weapon = f.args[0]; else st.building = f.args[0];
    } else if (f.name === "F") {
      if (f.args[0] === 1 && st.building === 17) {
        const angle = f.args[1];
        if (st.turrets.size === 0) st.sets.push({ x: st.x, y: st.y, axis: st.aim, angles: [] });
        st.sets[st.sets.length - 1].angles.push(angle);
        st.placed.push(angle);
        /* the game's buildItem(): 73 out, refused within 86 of another, limit */
        const x = st.x + R * Math.cos(angle), y = st.y + R * Math.sin(angle);
        const limit = sandbox ? 99 : 2;
        const free = [ ...st.turrets.values() ].every(t => Math.hypot(t.x - x, t.y - y) >= 86);
        if (free && st.turrets.size < limit) {
          const sid = st.nextSid++;
          st.turrets.set(sid, { x, y, angle, health: 800 });
          srv.sendTo("H", [ [ sid, x, y, angle, 43, null, 17, 5 ] ]);
          srv.sendTo("S", [ 7, st.turrets.size ]);
        }
      }
      if (f.args[0] === 0) st.building = null;
    } else if (f.name === "c" && f.args[0] === 0) {
      st.skin = f.args[1];
    } else if (f.name === "K") {
      st.gather = !st.gather;
    } else if (f.name === "D") {
      st.dir = f.args[0];
    }
  }, { spawn: [ 3000, 3000 ] });
  const killTurret = sid => {
    st.turrets.delete(sid);
    server.sendTo("Q", [ sid ]);
    server.sendTo("S", [ 7, st.turrets.size ]);
  };

  const httpServer = http.createServer((req, res) => {
    if (req.url === "/luna.js") { res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" }); return res.end(LUNA); }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
  });
  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", server.onConnection);
  await new Promise(r => httpServer.listen(port, "127.0.0.1", r));

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|moomoo\.io|sandbox\.moomoo\.io)/, route => route.abort());
  const page = await ctx.newPage();
  await page.goto("http://" + host + ":" + port + "/");
  await page.evaluate(p => { new WebSocket("ws://127.0.0.1:" + p + "/"); }, port);
  await page.waitForFunction(() => window.__lunaMusicChat && window.__lunaMusicChat.status().inGame, null, { timeout: 10000 }).catch(() => {});
  check("in game", await page.evaluate(() => window.__lunaMusicChat.status().inGame));
  await page.keyboard.press("Escape");                      /* close Luna's menu */

  const mouse = async angle => {
    st.aim = angle;
    await page.dispatchEvent("#touch-controls-fullscreen", "mousemove",
      { clientX: 640 + Math.cos(angle) * 220, clientY: 400 + Math.sin(angle) * 220 });
  };
  const size = sandbox ? 3 : 2;
  const want = sandbox ? [ 0, -75, 75 ] : [ -40, 40 ];
  const setAngles = (set, aim) => set.angles.map(a => deg(a - aim));
  const setMatches = (set, aim) => set && set.angles.length === want.length && want.every(w => setAngles(set, aim).some(a => Math.abs(a - w) < 0.6));
  const brokenSets = () => st.swings.filter(sw => sw.kills > 0).length;

  /* 1. Turn it on with the key; the first set goes toward the mouse. */
  const aim1 = 0.6;
  await mouse(aim1);
  await sleep(300);
  check("auto grind starts off", !(await page.evaluate(() => window.vars.autoGrind)));
  await page.keyboard.press("KeyG");
  await sleep(150);
  check("G turns it on (and it is saved)", await page.evaluate(() => window.vars.autoGrind === true &&
    JSON.parse(localStorage.getItem("DELTEK_V4_CONFIG")).autoGrind === true));
  await sleep(700);
  console.log("    first set placed at (relative to the mouse):", JSON.stringify(st.sets[0] ? setAngles(st.sets[0], aim1) : []));
  check("places " + size + " turrets toward the mouse", setMatches(st.sets[0], aim1), st.sets[0] && setAngles(st.sets[0], aim1));

  /* 2. Let it grind: the server swings for real, from wherever the player is. */
  for (let i = 0; i < 160 && brokenSets() < 2; i++) await sleep(100);
  check("hammer out, tank hat on, auto gather on", st.weapon === 10 && st.skin === 40, { weapon: st.weapon, hat: st.skin });

  /* 3. Turn the mouse; the next sets follow it. */
  const aim2 = -2.4;
  await mouse(aim2);
  const setsBefore = st.sets.length;
  for (let i = 0; i < 200 && (st.sets.length < setsBefore + 2 || brokenSets() < setsBefore + 1); i++) await sleep(100);

  const swings = st.swings.filter(sw => sw.present > 0);
  const kills = st.swings.filter(sw => sw.kills > 0).map(sw => sw.kills);
  const behind = swings.map(sw => +sw.behind.toFixed(1));
  const spotDrift = Math.max(...st.sets.map(s => Math.hypot(s.x - st.sets[0].x, s.y - st.sets[0].y)));
  console.log(`    ${st.sets.length} sets, ${swings.length} swings; turrets hit per swing: ${JSON.stringify([ ...new Set(swings.map(sw => sw.hits)) ])}; broken per swing: ${JSON.stringify(kills)}`);
  console.log(`    standing ${Math.min(...behind)}-${Math.max(...behind)} units behind the placing spot when swinging; placing spot drift ${spotDrift.toFixed(1)}`);
  check("at least four sets ground", st.sets.length >= 4 && kills.length >= 3, { sets: st.sets.length, kills });
  check(`every swing hits all ${size}`, swings.every(sw => sw.hits === size), swings.map(sw => sw.hits));
  check(`every set of ${size} breaks on one swing`, kills.every(k => k === size), kills);
  check("no swing misses a standing turret", swings.every(sw => sw.hits === sw.present), swings.filter(sw => sw.hits < sw.present));
  if (sandbox) check("swings from 15-45 units back, where all three fit", behind.every(b => b >= 15 && b <= 45), behind);
  else check("no step with two: swings from the placing spot", behind.every(b => Math.abs(b) < 8), behind);
  check("walks back each time: the placing spot stays put", spotDrift < 9, spotDrift);
  const after = st.sets.slice(setsBefore);
  console.log("    after turning the mouse, placed at:", JSON.stringify(after.map(s => setAngles(s, aim2))));
  check("sets after turning the mouse go toward the new direction", after.length >= 1 && after.every(s => setMatches(s, aim2)), after.map(s => setAngles(s, aim2)));

  /* 5. The menu shows it, and G turns it off. */
  await page.keyboard.press("Escape");                      /* open Luna's menu */
  await page.click('.nav-item[data-tab="utilities"]');
  const sw = page.locator(".deltek-card", { hasText: "Auto Grind" }).locator(".switch").first();
  check("menu: Auto Grind section, switch on", await sw.evaluate(e => e.classList.contains("active")));
  check("menu: grind-until choices", (await page.locator(".deltek-card", { hasText: "Auto Grind" }).locator("select").count()) === 2);
  await page.keyboard.press("Escape");
  await page.keyboard.press("KeyG");
  await sleep(400);
  check("G turns it off", await page.evaluate(() => window.vars.autoGrind === false));
  const afterOff = st.placed.length;
  const framesOff = server.frames.length;
  [ ...st.turrets.keys() ].forEach(killTurret);
  await sleep(900);
  const sinceOff = server.frames.slice(framesOff);
  check("off: nothing placed", st.placed.length === afterOff);
  check("off: no stepping", !sinceOff.some(f => f.name === "9" && f.args[0] !== null));
  check("off: auto gather is not asked for again", sinceOff.filter(f => f.name === "K" && f.args[0] === 1).length <= 1,
    sinceOff.filter(f => f.name === "K").length);

  /* 6. The counter. */
  const fps = await page.evaluate(() => Number(document.querySelector("#lfp-fps").textContent));
  const ping = await page.textContent("#lfp-ping");
  console.log(`    counter: FPS ${fps}, PING ${ping}`);
  check("counter at the top centre", await page.evaluate(() => {
    const r = document.querySelector("#luna-fps-ping").getBoundingClientRect();
    return Math.abs(r.left + r.width / 2 - innerWidth / 2) < 2 && r.top < 20;
  }));
  check("FPS is measured from the game loop", fps > 0);
  check("ping is the server round trip", /^\d+ms$/.test(ping) && parseInt(ping) >= 40 && parseInt(ping) < 300, ping);

  clearInterval(st.ticking);
  await ctx.close();
  wss.close();
  await new Promise(r => httpServer.close(r));
  return page;
}

(async () => {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const launch = { args: [ "--host-resolver-rules=MAP moomoo.io 127.0.0.1, MAP sandbox.moomoo.io 127.0.0.1" ] };
  if (fs.existsSync("/opt/pw-browsers/chromium")) launch.executablePath = "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(launch);
  await scenario(browser, port, "moomoo.io", false);
  await scenario(browser, port + 1, "sandbox.moomoo.io", true);

  /* The counter's switch. */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const httpServer = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": req.url === "/luna.js" ? "text/javascript" : "text/html" });
      res.end(req.url === "/luna.js" ? LUNA : PAGE);
    });
    await new Promise(r => httpServer.listen(port + 2, "127.0.0.1", r));
    const page = await ctx.newPage();
    await page.goto("http://127.0.0.1:" + (port + 2) + "/");
    await page.click('.nav-item[data-tab="visuals"]');
    console.log("counter switch");
    check("no ping shown before connecting", (await page.textContent("#lfp-ping")) === "--");
    await page.locator(".feature-row", { hasText: "fps & ping counter" }).locator(".switch").click();
    await sleep(700);
    check("switch hides the counter", !(await page.locator("#luna-fps-ping").isVisible()));
    await ctx.close();
    httpServer.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
