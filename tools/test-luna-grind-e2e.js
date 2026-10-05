#!/usr/bin/env node
/*
 * test-luna-grind-e2e.js
 *
 * Luna's own auto grind (the "dynamic farm" key, G) and the FPS / Ping
 * counter, inside the whole Luna_Client.user.js, booted in a stand-in moomoo
 * page and connected to a local game server (tools/lib/fake-moomoo.js).
 *
 * The server plays the game's side the way src/game_index.js does: it moves
 * the player, swings the held weapon whenever auto gather is on and it has
 * reloaded (damage = dmg * variant * sDmg * tank, hits within reach and
 * 69.2 deg of the facing), sends "L" for every building hit and "Q" for one
 * that breaks, then "K" for the swing — which is how Luna keeps its own count
 * of each turret's health — and gives the weapon that breaks a turret its cost
 * as XP (350), reporting the held weapon's variant every tick.
 *
 * What is checked is what the build changes in Luna's grind, and nothing more:
 *   - the turrets go toward the mouse: three, at the mouse and 73 deg either
 *     side (Luna tried angles from 0 deg and used the first that fit);
 *   - the secondary (great hammer) is ground first, to gold, and only then
 *     the primary, to diamond (Luna did the primary first);
 * and that the rest is still Luna's: it stops once both are there, and the
 * key turns it off.
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
const VARIANTS = [ { xp: 0, val: 1 }, { xp: 3000, val: 1.1 }, { xp: 7000, val: 1.18 }, { xp: 12000, val: 1.18 } ];
const variantOf = xp => { for (let i = VARIANTS.length - 1; i >= 0; i--) if (xp >= VARIANTS[i].xp) return i; return 0; };
const PRIMARY = 5, HAMMER = 10;             /* polearm, great hammer */
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
   * refuses turrets. Each weapon starts two kills short of its next variant:
   * the hammer of gold, the polearm of diamond — Luna's targets. */
  const st = { x: 3000, y: 3000, vx: 0, vy: 0, moveDir: null, dir: 0, weapon: PRIMARY, skin: 0, building: null, gather: false,
    reload: {}, placed: [], turrets: new Map(), nextSid: 500, ticking: null, aim: 0, sets: [], kills: [],
    xp: { [PRIMARY]: 7000 - 700, [HAMMER]: 3000 - 700 } };
  const swing = srv => {
    const weapon = WEAPONS[st.weapon];
    const variant = VARIANTS[variantOf(st.xp[st.weapon] || 0)];
    const dmg = weapon.dmg * variant.val * (weapon.sDmg || 1) * (st.skin === 40 ? 3.3 : 1);
    let hit = false;
    for (const [ sid, t ] of [ ...st.turrets ]) {
      const toward = Math.atan2(t.y - st.y, t.x - st.x);
      if (Math.hypot(t.x - st.x, t.y - st.y) - 43 > weapon.range) continue;
      if (angleDist(toward, st.dir) > GATHER) continue;
      hit = true;
      t.health -= dmg;
      if (t.health <= 0) {
        st.kills.push({ weapon: st.weapon, hammer: variantOf(st.xp[HAMMER]), primary: variantOf(st.xp[PRIMARY]), at: Date.now() });
        st.xp[st.weapon] = (st.xp[st.weapon] || 0) + 350;
        st.turrets.delete(sid);
        srv.sendTo("Q", [ sid ]);
        srv.sendTo("S", [ 7, st.turrets.size ]);
      } else {
        srv.sendTo("L", [ +toward.toFixed(1), sid ]);
      }
    }
    srv.sendTo("K", [ 5, hit ? 1 : 0, st.weapon ]);
    st.reload[st.weapon] = weapon.speed;
  };
  const server = createGameServer((f, srv) => {
    if (f.name === "M") {
      srv.sendTo("V", [ [ 0, 3, 6, 10, 15, 17 ] ]);         /* items: ..., turret */
      srv.sendTo("V", [ [ PRIMARY, HAMMER ], true ]);        /* polearm + great hammer */
      srv.sendTo("5", [ 0, 40, 0 ]);                         /* tank hat owned */
      srv.sendTo("N", [ "wood", 50000, 1 ]);                 /* a turret costs 200 wood */
      srv.sendTo("N", [ "stone", 50000, 1 ]);                /* and 150 stone */
      clearInterval(st.ticking);
      st.ticking = setInterval(() => {
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
        srv.sendTo("a", [ [ 5, st.x, st.y, st.dir, -1, st.weapon, variantOf(st.xp[st.weapon] || 0), null, 0, st.skin, 0, 0, 0 ] ]);
      }, 111);
    } else if (f.name === "9") {
      st.moveDir = f.args[0];
    } else if (f.name === "z") {
      if (f.args[1]) st.weapon = f.args[0]; else st.building = f.args[0];
    } else if (f.name === "F") {
      if (f.args[0] === 1 && st.building === 17) {
        const angle = f.args[1];
        if (st.turrets.size === 0 && !(st.sets.length && Date.now() - st.sets[st.sets.length - 1].at < 300)) {
          st.sets.push({ aim: st.aim, angles: [], at: Date.now() });
        }
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
  const clearTurrets = () => {
    for (const sid of [ ...st.turrets.keys() ]) {
      st.turrets.delete(sid);
      server.sendTo("Q", [ sid ]);
    }
    server.sendTo("S", [ 7, 0 ]);
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
  const want = [ 0, -73, 73 ];
  const setAngles = set => set.angles.map(a => deg(Math.atan2(Math.sin(a - set.aim), Math.cos(a - set.aim))));
  const towardMouse = set => set && set.angles.length === 3 && want.every((w, i) => Math.abs(setAngles(set)[i] - w) < 0.6);

  /* 1. Nothing until the key; then three turrets toward the mouse. */
  await mouse(0.6);
  await sleep(500);
  check("nothing placed before the key", st.placed.length === 0, st.placed.length);
  await page.keyboard.press("KeyG");
  for (let i = 0; i < 20 && !st.sets.length; i++) await sleep(100);
  await sleep(200);
  console.log("    first set (relative to the mouse):", JSON.stringify(st.sets[0] ? setAngles(st.sets[0]) : []),
    "— the server kept", st.turrets.size);
  check("G: three turrets toward the mouse (at it and 73 deg either side)", towardMouse(st.sets[0]), st.sets[0] && setAngles(st.sets[0]));
  check(sandbox ? "sandbox: all three stand" : "normal server: the limit keeps two", st.turrets.size === (sandbox ? 3 : 2), st.turrets.size);

  /* 2. The key turns it off: the turrets go, and no new ones come. */
  await page.keyboard.press("KeyG");
  await sleep(300);
  const placedOff = st.placed.length;
  clearTurrets();
  await sleep(1200);
  check("G again: off, nothing placed", st.placed.length === placedOff, st.placed.length - placedOff);

  /* 3. On again, toward a new direction; turn the mouse once more as each
   * new set goes down, and let it grind to the end. */
  await mouse(-2.4);
  await sleep(150);
  await page.keyboard.press("KeyG");
  const aims = [ -2.4, 1.9, -0.9, 2.8 ];
  let lastSets = st.sets.length;
  for (let i = 0; i < 900; i++) {
    await sleep(100);
    if (st.sets.length > lastSets) {
      lastSets = st.sets.length;
      await sleep(150);
      await mouse(aims[(lastSets - 1) % aims.length]);
    }
    if (variantOf(st.xp[PRIMARY]) >= 2) break;
  }
  await sleep(2000);                                         /* would it go on? */

  const killers = st.kills.map(k => (k.weapon === HAMMER ? "hammer" : "polearm"));
  const firstPolearm = st.kills.findIndex(k => k.weapon === PRIMARY);
  const sets = st.sets.slice(1);
  console.log("    sets after turning it back on (relative to the mouse):", JSON.stringify(sets.map(setAngles)));
  console.log("    kills in order:", killers.join(", "));
  console.log("    end: hammer", [ "plain", "gold", "diamond", "ruby" ][variantOf(st.xp[HAMMER])] + ", polearm",
    [ "plain", "gold", "diamond", "ruby" ][variantOf(st.xp[PRIMARY])]);
  check("every set goes toward the mouse as it was when placed", sets.length >= 2 && sets.every(towardMouse), sets.map(setAngles));
  check("secondary first: the hammer takes the first kills", st.kills.length > 0 && st.kills[0].weapon === HAMMER, killers);
  check("no polearm kill until the hammer is gold", firstPolearm > 0 && st.kills.slice(0, firstPolearm).every(k => k.weapon === HAMMER) &&
    st.kills[firstPolearm].hammer >= 1, st.kills);
  check("then the primary: the polearm takes the kills", firstPolearm >= 0 && st.kills.slice(firstPolearm).filter(k => k.weapon === PRIMARY).length >= 2, killers);
  check("hammer gold, polearm diamond", variantOf(st.xp[HAMMER]) >= 1 && variantOf(st.xp[PRIMARY]) >= 2, st.xp);
  const lastKill = st.kills.length ? st.kills[st.kills.length - 1].at : 0;
  const placedAfter = st.sets.filter(s => s.at > lastKill).length;
  check("stops once both are there (Luna's own targets)", placedAfter === 0 && !st.kills.some(k => k.primary >= 2), { placedAfter });

  /* 4. The counter. */
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
