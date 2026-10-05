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
const HAMMER_RANGE = DRIVERS.weapons.find(w => w.id === 10).range;
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
  const st = { x: 3000, y: 3000, dir: 0, weapon: 5, skin: 0, building: null, gather: false, placed: [], turrets: new Map(), nextSid: 500, ticking: null };
  const server = createGameServer((f, srv) => {
    if (f.name === "M") {
      srv.sendTo("V", [ [ 0, 3, 6, 10, 15, 17 ] ]);         /* items: ..., turret */
      srv.sendTo("V", [ [ 5, 10 ], true ]);                  /* polearm + great hammer */
      srv.sendTo("5", [ 0, 40, 0 ]);                         /* tank hat owned */
      srv.sendTo("N", [ "wood", 5000, 1 ]);                  /* a turret costs 200 wood */
      srv.sendTo("N", [ "stone", 5000, 1 ]);                 /* and 150 stone */
      clearInterval(st.ticking);
      st.ticking = setInterval(() => {
        srv.sendTo("a", [ [ 5, st.x, st.y, st.dir, -1, st.weapon, 0, null, 0, st.skin, 0, 0, 0 ] ]);
      }, 111);
    } else if (f.name === "z") {
      if (f.args[1]) st.weapon = f.args[0]; else st.building = f.args[0];
    } else if (f.name === "F") {
      if (f.args[0] === 1 && st.building === 17) {
        const angle = f.args[1];
        st.placed.push(angle);
        /* the game's buildItem(): 73 out, refused within 86 of another, limit */
        const x = st.x + R * Math.cos(angle), y = st.y + R * Math.sin(angle);
        const limit = sandbox ? 99 : 2;
        const free = [ ...st.turrets.values() ].every(t => Math.hypot(t.x - x, t.y - y) >= 86);
        if (free && st.turrets.size < limit) {
          const sid = st.nextSid++;
          st.turrets.set(sid, { x, y, angle });
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
  /* What one swing in the current facing would reach, by the game's rule. */
  const reach = () => [ ...st.turrets.values() ].filter(t =>
    Math.hypot(t.x - st.x, t.y - st.y) - 43 <= HAMMER_RANGE &&
    angleDist(Math.atan2(t.y - st.y, t.x - st.x), st.dir) <= GATHER).length;

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

  const mouse = async angle => page.dispatchEvent("#touch-controls-fullscreen", "mousemove",
    { clientX: 640 + Math.cos(angle) * 220, clientY: 400 + Math.sin(angle) * 220 });

  /* 1. Turn it on with the key; turrets go toward the mouse. */
  const aim1 = 0.6;
  await mouse(aim1);
  await sleep(300);
  check("auto grind starts off", !(await page.evaluate(() => window.vars.autoGrind)));
  await page.keyboard.press("KeyG");
  await sleep(150);
  check("G turns it on (and it is saved)", await page.evaluate(() => window.vars.autoGrind === true &&
    JSON.parse(localStorage.getItem("DELTEK_V4_CONFIG")).autoGrind === true));
  await sleep(700);
  const want1 = sandbox ? [ 0, -75, 75 ] : [ -40, 40 ];
  const got1 = st.placed.slice(0, want1.length).map(a => deg(a - aim1));
  console.log("    placed at (relative to the mouse):", JSON.stringify(got1));
  check("places " + want1.length + " turrets toward the mouse", st.turrets.size === want1.length &&
    want1.every(w => st.placed.some(a => Math.abs(deg(a - aim1) - w) < 0.6)), got1);

  /* 2. Then breaks them: hammer, tank, auto gather, facing that reaches the most. */
  await sleep(900);
  console.log(`    holding ${st.weapon}, hat ${st.skin}, gather ${st.gather}, facing ${deg(st.dir - aim1)} deg from the mouse, reaches ${reach()}`);
  check("hammer out", st.weapon === 10, st.weapon);
  check("tank hat on", st.skin === 40, st.skin);
  check("auto gather on", st.gather === true);
  check(sandbox ? "facing reaches two of the three (the most one swing can)" : "facing reaches both", reach() === 2, reach());

  /* 3. One gone: it turns to what is left, never to empty air. */
  const sids = [ ...st.turrets.keys() ];
  const middle = sandbox ? sids.find(s => Math.abs(deg(st.turrets.get(s).angle - aim1)) < 1) : sids[0];
  killTurret(middle);
  await sleep(600);
  check("after one breaks, the swing still reaches a turret", reach() >= 1, { dir: deg(st.dir - aim1), left: st.turrets.size });
  if (sandbox) {
    killTurret([ ...st.turrets.keys() ][0]);
    await sleep(600);
    check("and the last one too", reach() === 1, deg(st.dir - aim1));
  }

  /* 4. All gone: a fresh set, toward wherever the mouse is now. */
  const aim2 = -2.4;
  await mouse(aim2);
  const before = st.placed.length;
  [ ...st.turrets.keys() ].forEach(killTurret);
  await sleep(900);
  const got2 = st.placed.slice(before, before + want1.length).map(a => deg(a - aim2));
  console.log("    placed again at (relative to the new mouse direction):", JSON.stringify(got2));
  check("places a fresh set toward the new mouse direction", st.turrets.size === want1.length &&
    want1.every(w => got2.some(a => Math.abs(a - w) < 0.6)), got2);

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
  [ ...st.turrets.keys() ].forEach(killTurret);
  await sleep(700);
  check("off: nothing placed", st.placed.length === afterOff);
  check("off: auto gather released", st.gather === false);

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
