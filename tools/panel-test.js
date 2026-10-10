#!/usr/bin/env node
// Clicks through Ryn's private-server admin panel in Chromium and reports what every
// control did.
//
//   node tools/panel-test.js [RynType2.user.js] [--out dir] [--compare old-report.json] [--fast]
//   node tools/panel-test.js --soak <seconds>     12 bots on a 150±80 ms fake ping, page errors counted
//   node tools/panel-test.js --server-checks      the store, upgrades, Windmill Hat and leaderboard,
//                                                 through real packets to the in-page server
//   node tools/panel-test.js --king <seconds>     a fight with the Crab King: its pools, pace,
//                                                 warnings, dives, crabs, as the page receives them
//
// The page is a stub moomoo.io (nothing reaches the network) with the HUD the panel
// needs (#adminButton, #chatHolder, the game canvas). The userscript is injected at
// document-start in private mode; the copy injected here also puts RynAdminPanel,
// RynPrivate and RynPrivateSocket on window.__ryn so the test can spawn a player in
// the in-page server and watch the panel's commands. The file itself is not changed.
//
// Every tab, section and control is clicked (selects changed), once with you as the
// target and once with a dummy. For each control the report lists the chat commands
// it sent, the server calls it made, the replies it got and the storage it wrote.
// With --compare, every command verb and server call the old panel reached must be
// reachable in this one. Also checked: page errors, controls wider than the panel
// at 312px and in Big mode, saved folds/tab/Big after a reload, the old tab name
// moving to the new one, search, hotkeys. Screenshots go to --out.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const requireGlobal = name => {
  try {
    return require(name);
  } catch (_) {
    return require(path.join(execSync("npm root -g").toString().trim(), name));
  }
};
const { chromium } = requireGlobal("playwright");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const OUT = path.resolve(flag("--out", path.join(process.cwd(), "panel-test-out")));
const COMPARE = flag("--compare", null);
const FAST = args.includes("--fast") ? (args.splice(args.indexOf("--fast"), 1), true) : false;
// --soak <seconds>: only the long run with bots on a jittery fake ping, counting page errors
const SOAK = Number(flag("--soak", 0)) || 0;
// --server-checks: only the in-page server's rules (store, upgrades, leaderboard) through real packets
const SERVER_CHECKS = args.includes("--server-checks") ? (args.splice(args.indexOf("--server-checks"), 1), true) : false;
// --king <seconds>: fight the Crab King in its arena and check what the page receives
const KING = Number(flag("--king", 0)) || 0;
// --king-record <seconds>: the same fight through Ryn's own client with the Crab King
// recorder on; the recording is written to --out and tools/king-analyze.js must read the
// in-page King's own numbers back out of it
const KING_RECORD = Number(flag("--king-record", 0)) || 0;
const SCRIPT = path.resolve(args[0] || path.join(__dirname, "..", "RynType2.user.js"));
fs.mkdirSync(OUT, { recursive: true });

const HOOK = "    RynAdminPanel.start();\n";
const source = fs.readFileSync(SCRIPT, "utf8");
if (!source.includes(HOOK)) throw new Error("hook line not found: " + JSON.stringify(HOOK));
// Like a userscript manager: wrapped in a function, and only in the top page (Playwright's
// init scripts also run in Ryn's own menu frame, which a manager would not inject into).
const injected = "(function () {\nif (window !== window.top) return;\n" + source.replace(HOOK, HOOK + "    window.__ryn = { panel: RynAdminPanel, priv: RynPrivate, Sock: RynPrivateSocket, worlds: RynWorlds, client: client, rec: RynKingRecorder };\n") + "\n})();";

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>moomoo</title></head>
<body style="margin:0;background:#3d6b35;overflow:hidden">
<canvas id="gameCanvas" width="1280" height="800" style="position:fixed;left:0;top:0;width:100vw;height:100vh"></canvas>
<canvas id="mapDisplay" width="130" height="130" style="position:fixed;left:10px;bottom:10px"></canvas>
<div id="gameUI"><div id="adminButton" class="uiElement gameButton" style="display:none;position:fixed;right:12px;top:12px;width:40px;height:40px;background:#555;z-index:5"></div>
<div id="storeButton"></div><div id="allianceButton"></div><div id="pingDisplay"></div><div id="noticationDisplay"></div>
<div id="storeHolder" style="display:none"><div id="storeMenu"></div></div><div id="allianceMenu" style="display:none"><input id="allianceInput"></div></div>
<div id="chatHolder" style="display:none"><input id="chatBox"></div>
<div id="mainMenu" style="display:none"><div id="setupCard"><input id="nameInput" type="text"><div id="skinColorHolder"></div><div id="enterGame"></div>
<div id="serverBrowser"><select id="altServer"></select></div><input id="nativeResolution" type="checkbox"><input id="showPing" type="checkbox"></div></div>
</body></html>`;

// In the page: a msgpack encoder for the spawn packet, the recorder and the crawler.
const PAGE_TOOLS = () => {
  const enc = v => {
    const out = [];
    const u8 = n => out.push(n & 255);
    const u16 = n => (u8(n >> 8), u8(n));
    const u32 = n => (u16(n >>> 16), u16(n));
    const w = x => {
      if (x === null || x === undefined) u8(0xc0);
      else if (x === true) u8(0xc3);
      else if (x === false) u8(0xc2);
      else if (typeof x === "number") {
        if (Number.isInteger(x) && x >= 0 && x < 128) u8(x);
        else if (Number.isInteger(x) && x >= 0 && x < 65536) (u8(0xcd), u16(x));
        else {
          u8(0xcb);
          const b = new DataView(new ArrayBuffer(8));
          b.setFloat64(0, x);
          for (let i = 0; i < 8; i++) u8(b.getUint8(i));
        }
      } else if (typeof x === "string") {
        const b = new TextEncoder().encode(x);
        if (b.length < 32) u8(0xa0 | b.length);
        else (u8(0xd9), u8(b.length));
        b.forEach(u8);
      } else if (Array.isArray(x)) {
        u8(0x90 | x.length);
        x.forEach(w);
      } else {
        const k = Object.keys(x);
        u8(0x80 | k.length);
        for (const key of k) (w(key), w(x[key]));
      }
    };
    w(v);
    return new Uint8Array(out).buffer;
  };
  const H = window.__harness = { rec: null, all: [], sock: null, enc };
  H.spawn = () => {
    const R = window.__ryn;
    if (!H.sock || H.sock.readyState > 1) {
      H.sock = new R.Sock("ws://localhost/ryn-private", true);
      H.sock.addEventListener("open", () => H.sock.send(enc([ "M", [ { name: "Tester", moofoll: 1, skin: 0 } ] ])));
    } else if (H.sock.readyState === 1) {
      H.sock.send(enc([ "M", [ { name: "Tester", moofoll: 1, skin: 0 } ] ]));
    }
  };
  H.me = () => {
    const s = window.__ryn.priv.state();
    return s && s.me;
  };
  // record what the panel does while a control is being clicked
  const R = window.__ryn;
  const push = (kind, value) => {
    const e = { kind, value };
    H.all.push(e);
    if (H.rec) H.rec.push(e);
  };
  for (const name of [ "command", "call", "setPing" ]) {
    const fn = R.priv[name];
    R.priv[name] = function (...a) {
      if (H.rec) push(name, name === "setPing" ? a.join(" ") : name === "call" ? a[0] : String(a[0]));
      return fn.apply(this, a);
    };
  }
  const say = R.panel.say;
  R.panel.say = function (text, bad) {
    if (H.rec) push(bad ? "bad" : "say", String(text));
    return say.call(this, text, bad);
  };
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (H.rec && /^_ryn_(admin|stamp|bench|ping|king|survival)/.test(k)) push("store", k);
    return setItem.call(this, k, v);
  };
  // changes inside the panel (and its overlay canvas), counted right after a click
  H.watch = new MutationObserver(() => {});
  const watchPanel = () => {
    const root = document.getElementById("ryn-admin");
    if (root) H.watch.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  watchPanel();
  H.domCount = () => H.watch.takeRecords().filter(m => !(m.type === "attributes" && m.attributeName === "data-crawl-id")).length;
  H.labelOf = el => {
    if (el.tagName === "SELECT") {
      const row = el.closest(".ra-row");
      const lbl = row && row.querySelector(".ra-lbl");
      return "[select] " + (el.title || (lbl && lbl.textContent) || (el.options[0] && el.options[0].textContent) || "");
    }
    let t = (el.getAttribute("aria-label") || el.textContent || el.title || "").replace(/\s+/g, " ").trim();
    t = t.replace(/: (on|off)$/, "").replace(/^(Frozen|God|Free build|Changing ping|Record|Hide spam|Auto heal|Turn with me)\b.*/, "$1");
    return t;
  };
  H.sectionOf = el => {
    const sec = el.closest(".ra-section");
    if (sec) return sec.dataset.title || "";
    if (el.closest(".ra-target")) return "Target";
    // old panel: the closest .ra-sec heading before it
    let n = el;
    while (n && !n.classList.contains("ra-page")) {
      let p = n.previousElementSibling;
      while (p) {
        if (p.classList.contains("ra-sec")) return p.textContent;
        const inner = p.querySelectorAll ? p.querySelectorAll(".ra-sec") : [];
        if (inner.length) return inner[inner.length - 1].textContent;
        p = p.previousElementSibling;
      }
      n = n.parentElement;
    }
    return "";
  };
  H.visible = el => !!(el.offsetParent || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";
  H.act = (el, how) => {
    H.rec = [];
    H.domCount();
    try {
      if (how === "change") {
        const opts = [ ...el.options ];
        const cur = el.selectedIndex;
        const next = opts.findIndex((o, i) => i !== cur && !o.disabled);
        if (next >= 0) el.selectedIndex = next;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (how === "context") {
        el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
      } else {
        el.click();
      }
    } catch (e) {
      push("throw", String(e && e.message));
    }
    const dom = H.domCount();
    // replies that come a moment later (the clipboard, the bench) still count
    return new Promise(res => setTimeout(() => {
      const rec = H.rec;
      H.rec = null;
      res({ rec, dom });
    }, 150));
  };
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function boot(context, opts = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
  page.on("console", m => {
    if (m.type() === "error") errors.push("console.error: " + m.text().slice(0, 300));
  });
  if (opts.before) await page.addInitScript(opts.before);
  await page.addInitScript({ content: injected });
  await page.goto("https://moomoo.io/?rynPrivate=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__ryn && document.getElementById("ryn-admin"), null, { timeout: 30000 });
  await page.evaluate(PAGE_TOOLS);
  if (opts.viaClient) {
    // the way the game joins: through Ryn's own client, so Ryn's bots can join behind it
    await page.evaluate(async () => {
      const ws = new WebSocket("wss://test.moomoo.io/?b=1");
      for (let i = 0; i < 100 && ws.readyState !== 1; i++) await new Promise(r => setTimeout(r, 50));
      await new Promise(r => setTimeout(r, 300));
      window.__ryn.client.myPlayer.spawn();
    });
  } else {
    await page.evaluate(() => window.__harness.spawn());
  }
  await page.waitForFunction(() => {
    const me = window.__harness.me();
    return me && me.alive;
  }, null, { timeout: 15000 });
  return { page, errors };
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  await context.grantPermissions([ "clipboard-read", "clipboard-write" ], { origin: "https://moomoo.io" });
  await context.route("**/*", route => {
    const url = route.request().url();
    if (/^https:\/\/moomoo\.io\/(\?|$)/.test(url)) return route.fulfill({ status: 200, contentType: "text/html", body: PAGE });
    return route.fulfill({ status: 204, body: "" });
  });

  const report = { script: SCRIPT, version: (source.match(/@version\s+(\S+)/) || [])[1], errors: [], controls: [], checks: [], layout: [] };
  const check = (name, ok, detail) => {
    report.checks.push({ name, ok: !!ok, detail: detail === undefined ? "" : detail });
    console.log((ok ? "  ok   " : "  FAIL ") + name + (detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""));
  };

  if (KING_RECORD) {
    const { page: pr, errors: er } = await boot(context, { viaClient: true });
    const rec = await pr.evaluate(async seconds => {
      const R = window.__ryn, H = window.__harness;
      const sleep = ms => new Promise(res => setTimeout(res, ms));
      const send = (type, a) => R.priv.ownerSocket.send(H.enc([ type, a ]));
      R.rec.start();
      R.priv.command("!arena");
      await sleep(300);
      R.priv.command("!king respawn");
      await sleep(300);
      const t0 = Date.now();
      // each of its attacks for sure, then a free fight; at the end it drops to 70% (crabs)
      const plan = [ [ 0.1, "dive" ], [ 0.2, "charge" ], [ 0.3, "ring" ], [ 0.4, "slam" ], [ 0.5, "all" ] ];
      let step = 0, hurt = false;
      while (Date.now() - t0 < seconds * 1000) {
        const f = (Date.now() - t0) / (seconds * 1000);
        if (step < plan.length && f >= plan[step][0]) {
          R.priv.command("!king only " + plan[step][1]);
          R.priv.command("!king attack");
          step++;
        }
        if (f > 0.7 && !hurt) {
          hurt = true;
          R.priv.command("!king hp 336000");
        }
        const me = H.me();
        if (me && me.alive) send("9", [ Math.atan2(7200 - me.y, -2500 - me.x) + (Math.random() - 0.5) * 2.4 ]);
        else {
          R.client.myPlayer.spawn();
          await sleep(600);
          R.priv.command("!arena");
        }
        R.priv.command("!heal");
        await sleep(400);
      }
      R.rec.stop();
      return JSON.stringify(R.rec.data);
    }, KING_RECORD);
    const file = path.join(OUT, "crabking-test.json");
    fs.writeFileSync(file, rec);
    const analysis = path.join(OUT, "crabking-test.analysis.json");
    execSync("node " + JSON.stringify(path.join(__dirname, "king-analyze.js")) + " " + JSON.stringify(file) + " --json " + JSON.stringify(analysis), { stdio: "inherit" });
    const a = JSON.parse(fs.readFileSync(analysis, "utf8"));
    const has = (list, v) => (list || []).some(x => String(x).split(" ")[0] === String(v));
    const hit = a.attacks["hit circle"] || {}, ring = a.attacks.ring || {}, line = a.attacks["charge line"] || {}, splash = a.attacks.splash || {};
    const fx = a.effects || {};
    check("recorded: frames, the King, warnings", a.recording.kingTicks > 100 && a.recording.warnings > 5, a.recording);
    check("its hit read back: 400, 700 ms, 45 damage, a 0.6 push", has(hit.radius, 400) && has(hit.ms, 700) && has((fx["hit circle"] || {}).damage, 45) && Math.abs((fx["hit circle"] || {}).push.median - 600) < 60, { hit, fx: fx["hit circle"] });
    check("its ring read back: 250, 1100 ms", has(ring.radius, 250) && has(ring.ms, 1100), ring);
    check("its charge read back: a line its width (280), 700 ms", has(line.radius, 280) && has(line.ms, 700), line);
    check("its dive read back: under in ~700 ms, up in ~1650 ms, splash 400 / 1650", Math.abs(a.states.goingUnder.median - 700) <= 120 && Math.abs(a.states.comingUp.median - 1650) <= 120 && has(splash.radius, 400) && has(splash.ms, 1650), { states: a.states, splash });
    check("its pace read back: chasing at most ~18 a tick, charging ~36", a.movement.perTick.walking.max <= 19 && a.movement.perTick.charging.max <= 37, a.movement.perTick);
    check("its crabs read back: after it is hurt, Crablings and a Crab", a.crabs.waves.length > 0 && a.crabs.waves[0].kinds.length > 0, a.crabs.waves);
    check("it stayed in its pools", a.arena.king && a.arena.king.ticksOutsideItsPools === 0, a.arena);
    check("no page errors", er.length === 0, er);
    await browser.close();
    process.exit(report.checks.some(c => !c.ok) ? 1 : 0);
  }

  if (KING) {
    const { page: pk, errors: ek } = await boot(context);
    const r = await pk.evaluate(async seconds => {
      const R = window.__ryn, H = window.__harness;
      const sleep = ms => new Promise(res => setTimeout(res, ms));
      const dec = R.client.PacketManager.Decoder;
      const warns = [], kingRows = [], crabRows = [];
      let anims = 0, hurt = 0, lastHealth = null, ticks = 0;
      H.sock.addEventListener("message", ev => {
        let m;
        try {
          m = dec.decode(new Uint8Array(ev.data));
        } catch (_) {
          return;
        }
        if (m[0] === "W") warns.push(m[1]);
        if (m[0] === "J") anims++;
        if (m[0] === "I") {
          ticks++;
          const rows = m[1][0] || [];
          for (let i = 0; i + 7 < rows.length; i += 8) {
            if (rows[i + 1] === 11) kingRows.push([ rows[i + 2], rows[i + 3], rows[i + 7] || 0, rows[i + 5], ticks ]);
            if (rows[i + 1] === 13 || rows[i + 1] === 14) crabRows.push([ rows[i + 1], rows[i + 2], rows[i + 3], rows[i + 7] || 0 ]);
          }
        }
        if (m[0] === "O" && m[1][0] === H.me().sid) {
          if (lastHealth !== null && m[1][1] < lastHealth) hurt++;
          lastHealth = m[1][1];
        }
      });
      R.priv.command("!arena");
      await sleep(300);
      R.priv.command("!king respawn");
      await sleep(300);
      const half = seconds * 500;
      // walk around the pools; halfway, the King drops to 60% (its crabs come)
      const keys = [ "w", "a", "s", "d" ];
      const t0 = Date.now();
      let healed = 0;
      while (Date.now() - t0 < seconds * 1000) {
        const me = H.me();
        if (me && me.alive) {
          // keep standing in the pools: head back towards the big pool when near an edge
          const dir = Math.atan2(7200 - me.y, -2500 - me.x) + (Math.random() - 0.5) * 2.4;
          H.sock.send(H.enc([ "9", [ dir ] ]));
        } else {
          H.spawn();
          await sleep(500);
          R.priv.command("!arena");
        }
        if (Date.now() - t0 > half && !healed) {
          healed = 1;
          R.priv.command("!king hp 288000");
          // and one dive for sure
          R.priv.command("!king only dive");
          R.priv.command("!king attack");
          await sleep(7000);
          R.priv.command("!king only all");
        }
        R.priv.command("!heal");
        await sleep(400);
      }
      const pools = [ [ -2500, 7200, 1150 ], [ -3300, 6750, 750 ], [ -3200, 7750, 700 ], [ -1700, 6900, 600 ], [ -1800, 7550, 600 ] ];
      const inPools = (x, y, r) => pools.some(c => Math.hypot(x - c[0], y - c[1]) <= c[2] - r + 1);
      let fastest = 0;
      // from one server tick to the next only
      for (let i = 1; i < kingRows.length; i++) {
        if (kingRows[i][4] === kingRows[i - 1][4] + 1) fastest = Math.max(fastest, Math.hypot(kingRows[i][0] - kingRows[i - 1][0], kingRows[i][1] - kingRows[i - 1][1]));
      }
      return {
        kingSeen: kingRows.length,
        kingOut: kingRows.filter(k => !inPools(k[0], k[1], 280)).length,
        states: [ ...new Set(kingRows.map(k => k[2])) ].sort(),
        fastest: Math.round(fastest),
        warnKinds: warns.reduce((o, w) => (o[w[0]] = (o[w[0]] || 0) + 1, o), {}),
        hitWarn: warns.filter(w => w[0] === 3).slice(0, 2),
        crabs: crabRows.length ? [ ...new Set(crabRows.map(c => c[0])) ] : [],
        crabsOut: crabRows.filter(c => !inPools(c[1], c[2], c[0] === 13 ? 78 : 39)).length,
        anims, hurt
      };
    }, KING);
    console.log(JSON.stringify(r));
    check("the King stays in its pools", r.kingSeen > 100 && r.kingOut === 0, r.kingOut + " of " + r.kingSeen);
    check("its moves, at its pace (at most twice the game's chase, 36 a tick)", r.fastest <= 40, r.fastest);
    check("its attacks are shown: its hit (400 around it), charge, ring, dive", r.warnKinds[3] > 0 && r.warnKinds[4] > 0 && r.warnKinds[1] > 0 && r.warnKinds[0] > 0 && r.hitWarn.every(w => w[3] === 400), r.warnKinds);
    check("under water and back (states 1, 2, 3)", [ 1, 2, 3 ].every(s => r.states.includes(s)), r.states);
    check("its crabs come once it is hurt, and stay in the pools", r.crabs.length > 0 && r.crabsOut === 0, r.crabs);
    check("its hits land (J animation, health lost)", r.anims > 0 && r.hurt > 0, { J: r.anims, hurt: r.hurt });
    check("no page errors", ek.length === 0, ek);
    await browser.close();
    process.exit(report.checks.some(c => !c.ok) ? 1 : 0);
  }

  if (SERVER_CHECKS) {
    const { page: pc, errors: ec } = await boot(context);
    const r = await pc.evaluate(async () => {
      const R = window.__ryn, H = window.__harness;
      const sleep = ms => new Promise(res => setTimeout(res, ms));
      const got = [];
      const dec = R.client.PacketManager.Decoder;
      H.sock.addEventListener("message", ev => {
        try {
          got.push(dec.decode(new Uint8Array(ev.data)));
        } catch (_) {}
      });
      // the harness's encoder is in its closure: send through the panel's own path instead
      const send = async (type, ...a) => {
        H.sock.send(H.enc([ type, a ]));
        await sleep(150);
      };
      const st = () => R.priv.call("playerState");
      const out = {};
      const s0 = st();
      out.start = { skins: s0.skins, points: s0.points };
      R.priv.command("!res 100000");
      await sleep(200);
      const p0 = st().points;
      await send("c", 1, 7, 0); // buy the Bull Helmet
      const p1 = st().points;
      await send("c", 1, 7, 0); // and again
      const p2 = st().points;
      await send("c", 1, 45, 0); // Shame! is not for sale
      await send("c", 1, 61, 0); // nor the Crab Shell
      await send("c", 0, 61, 0); // and cannot be worn without it
      const s1 = st();
      await send("c", 1, 999, 0); // a hat that does not exist
      await send("c", 0, 7, 0); // wear the Bull Helmet
      const worn = st().skinIndex;
      await send("c", 1, 11, 1); // Monkey Tail
      await send("c", 0, 11, 1);
      const s2 = st();
      await send("c", 0, 0, 0); // hat off
      out.store = { price: p0 - p1, again: p1 - p2, owns: s1.skins, wearingAfterShell: s1.skinIndex, worn, tails: s2.tails, tail: s2.tailIndex, off: st().skinIndex };
      // upgrades: nothing without a point, only the age being picked, only after "pre"
      await send("H", 3);
      const u0 = st();
      R.priv.command("!age 2");
      await sleep(200);
      const u1 = st();
      await send("H", 4); // katana: age 8, needs the short sword
      const u2 = st();
      await send("H", 3); // short sword: age 2
      const u3 = st();
      R.priv.command("!age 4");
      await sleep(200);
      await send("H", 16 + 1); // cookie: age 3
      await send("H", 16 + 15); // pit trap: age 4
      const u4 = st();
      await send("H", 16 + 5); // castle wall: age 7, not yet
      const u5 = st();
      out.upgrades = { noPoint: u0.weapons, points: [ u1.upgradePoints, u1.upgrAge ], katanaRefused: u2.weapons, sword: [ u3.weapons, u3.upgradePoints, u3.upgrAge ], items: [ u4.items, u4.upgrAge ], castleRefused: u5.items };
      // points per second: the Windmill Hat pays 1.5 a second, in game time
      R.priv.command("!hat 14");
      await sleep(300);
      const w0 = st().points;
      await sleep(2050);
      const w1 = st().points;
      R.priv.command("!time pause");
      await sleep(300);
      const w2 = st().points;
      await sleep(2050);
      const w3 = st().points;
      R.priv.command("!time play");
      out.windmillHat = { running: w1 - w0, paused: w3 - w2 };
      // the leaderboard: list, roles, dead, Crab King killers (the Crab Shell's owners)
      R.priv.command("!hat 61");
      R.priv.command("!dummy idle 1");
      await sleep(400);
      const dummy = R.priv.state().players.find(p => p.dummy);
      if (dummy) R.priv.command("!kill " + dummy.sid);
      got.length = 0;
      await sleep(1300);
      const lb = got.filter(m => m[0] === "G").pop();
      const me = R.priv.state().me;
      out.leaderboard = lb ? { fields: lb[1].length, crab: lb[1][3], dead: lb[1][2], me: me.sid, dummy: dummy && dummy.sid, dummyAlive: dummy && R.priv.state().players.find(p => p.sid === dummy.sid) } : null;
      return out;
    });
    console.log(JSON.stringify(r, null, 1));
    const has = (a, x) => a.indexOf(x) >= 0;
    check("a new player owns neither Shame! nor the Crab Shell", !has(r.start.skins, 45) && !has(r.start.skins, 61), r.start.skins);
    check("store: a hat costs its price once", r.store.price === 6000 && r.store.again === 0, r.store);
    check("store: Shame! and the Crab Shell cannot be bought or worn", !has(r.store.owns, 45) && !has(r.store.owns, 61) && r.store.wearingAfterShell !== 61, r.store.owns);
    check("store: wear, accessory, take off", r.store.worn === 7 && has(r.store.tails, 11) && r.store.tail === 11 && r.store.off === 0, r.store);
    const U = r.upgrades;
    check("upgrades: none without a point", JSON.stringify(U.noPoint) === "[0]", U.noPoint);
    check("upgrades: the age being picked, after what it needs", JSON.stringify(U.katanaRefused) === "[0]" && JSON.stringify(U.sword[0]) === "[3]" && U.sword[2] === 3 && has(U.items[0], 1) && has(U.items[0], 15) && JSON.stringify(U.castleRefused) === JSON.stringify(U.items[0]), U);
    check("Windmill Hat: 1.5 points a second, none while the world is paused", r.windmillHat.running >= 3 && r.windmillHat.running <= 4.5 && r.windmillHat.paused === 0, r.windmillHat);
    const L = r.leaderboard || {};
    check("leaderboard: four parts, a crab by the Crab Shell's owner, the dead marked", L.fields === 4 && has(L.crab || [], L.me) && (!L.dummy || has(L.dead || [], L.dummy) || (L.dummyAlive && L.dummyAlive.alive)), L);
    check("no page errors", ec.length === 0, ec);
    await browser.close();
    process.exit(report.checks.some(c => !c.ok) ? 1 : 0);
  }

  if (SOAK) {
    // 12 bots on 150±80 ms, wolves and fighting dummies around, a bot killed every 3 s so
    // they keep dying and joining again; every page error is counted
    const { page: ps, errors: es } = await boot(context, { viaClient: true });
    const r = await ps.evaluate(async seconds => {
      const R = window.__ryn;
      const sleep = ms => new Promise(res => setTimeout(res, ms));
      R.priv.command("!ping 150 80");
      const row = [ ...document.querySelectorAll("#ryn-admin .ra-section") ].find(x => x.dataset.title === "Ryn bots");
      row.querySelector('input[type="number"]').value = "12";
      [ ...row.querySelectorAll("button") ].find(x => x.textContent.trim() === "Spawn").click();
      await sleep(4000);
      R.priv.command("!spawn wolf 4");
      R.priv.command("!dummy attack 3");
      const end = Date.now() + seconds * 1000;
      let kills = 0, most = 0;
      while (Date.now() < end) {
        await sleep(3000);
        const s = R.priv.state();
        const bots = s.players.filter(q => !q.dummy && q.alive && s.me && q.sid !== s.me.sid);
        most = Math.max(most, bots.length);
        if (bots.length) {
          R.priv.command("!kill " + bots[Math.floor(Math.random() * bots.length)].sid);
          kills++;
        }
      }
      R.priv.command("!ping 0");
      return { kills, most };
    }, SOAK);
    const uniq = [ ...new Set(es) ];
    console.log("Soak " + SOAK + "s: " + r.most + " bots at most, " + r.kills + " killed and back, " + es.length + " page error(s)");
    for (const e of uniq) console.log("  " + es.filter(x => x === e).length + "x " + e);
    check("soak: no page errors with bots on a jittery ping", es.length === 0, uniq.slice(0, 5));
    await browser.close();
    process.exit(es.length ? 1 : 0);
  }

  // ---- run 1: crawl everything ----
  const { page, errors } = await boot(context, {
    before: () => {
      try {
        if (!localStorage.getItem("_ryn_test_seeded")) {
          localStorage.clear();
          localStorage.setItem("_ryn_test_seeded", "1");
        }
      } catch (_) {}
    }
  });
  page.on("download", d => report.checks.push({ name: "download " + d.suggestedFilename(), ok: true, detail: "" }));
  await page.click("#adminButton");
  await page.waitForFunction(() => !document.getElementById("ryn-admin").classList.contains("ra-hidden"));
  const isNew = await page.evaluate(() => !!document.querySelector("#ryn-admin .ra-target"));
  console.log("Panel: " + (isNew ? "new" : "old") + " (" + report.version + ")");

  const settle = async () => {
    await page.evaluate(async () => {
      const H = window.__harness;
      const R = window.__ryn;
      const me = H.me();
      if (!me || !me.alive) {
        H.spawn();
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 50));
          const m = H.me();
          if (m && m.alive) break;
        }
      }
      const p = R.priv.call("panel");
      if (p && p.time.paused) R.priv.command("!time play");
      if (R.panel.benchRunning) R.panel.benchStop = true;
      if (R.panel.editMode) R.panel.setEdit("");
    });
  };

  // a dummy to point things at
  await page.evaluate(() => window.__ryn.priv.command("!dummy idle 1"));
  await sleep(200);

  const expandAll = () => page.evaluate(() => {
    for (const s of document.querySelectorAll("#ryn-admin .ra-section.ra-folded")) s.querySelector(".ra-sec-head").click();
  });

  const crawled = new Set();
  let dummySid = null;
  // with the dummy as the target: it stays the target, and comes back if a control removed it
  const keepDummy = async () => {
    dummySid = await page.evaluate(async sid => {
      const R = window.__ryn;
      let st = R.priv.state();
      if (!st.players.some(p => p.sid === sid && p.alive)) {
        if (st.players.some(p => p.sid === sid)) R.priv.command("!dummy remove " + sid);
        R.priv.command("!dummy idle 1");
        st = R.priv.state();
        const d = st.players.filter(p => p.dummy).pop();
        sid = d ? d.sid : null;
      }
      const P = R.panel;
      P.refresh();
      if (sid !== null && P.target !== String(sid) && [ ...P.targetSelect.options ].some(o => o.value === String(sid))) {
        P.targetSelect.value = String(sid);
        P.targetSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return sid;
    }, dummySid);
  };
  const crawl = async (pass, targetKind, onlyZones) => {
    const tabs = await page.$$eval("#ryn-admin .ra-tab", els => els.map(e => e.textContent.trim()));
    const zones = onlyZones || (isNew ? [ "Target" ].concat(tabs) : tabs);
    for (const zone of zones) {
      if (zone !== "Target") {
        await page.evaluate(label => [ ...document.querySelectorAll("#ryn-admin .ra-tab") ].find(t => t.textContent.trim() === label).click(), zone);
        await sleep(80);
        if (isNew) await expandAll();
      }
      for (let round = 0; round < 6; round++) {
        if (targetKind === "dummy") await keepDummy();
        const found = await page.evaluate(zone => {
          const H = window.__harness;
          const scope = zone === "Target" ? document.querySelector("#ryn-admin .ra-target") : [ ...document.querySelectorAll("#ryn-admin .ra-page") ].find(p => p.style.display !== "none");
          if (!scope) return [];
          // section titles fold (tested on their own); same-named buttons count by row and order
          const els = [ ...scope.querySelectorAll("button, select") ].filter(H.visible).filter(el => !el.classList.contains("ra-sec-head")).filter(el => !el.closest(".ra-target") || zone === "Target");
          const seen = {};
          return els.map((el, i) => {
            el.dataset.crawlId = zone + "#" + i + "#" + Math.random().toString(36).slice(2, 7);
            const row = el.closest(".ra-row");
            const lbl = row && row.querySelector(".ra-lbl");
            const label = H.labelOf(el);
            const section = H.sectionOf(el);
            const slot = section + "|" + (lbl ? lbl.textContent : "") + "|" + label;
            seen[slot] = (seen[slot] || 0) + 1;
            return { id: el.dataset.crawlId, label, section, slot: slot + "|" + seen[slot], tag: el.tagName, ctx: !!el.closest(".ra-grid") };
          });
        }, zone);
        let fresh = 0;
        for (const c of found) {
          const key = zone + "|" + c.slot + (targetKind === "dummy" ? "|dummy" : "");
          if (crawled.has(key)) continue;
          if (/^(Set key|Press a key…)$/.test(c.label)) continue; // the hotkey flow is tested on its own
          if (/^\[select\]/.test(c.label) && /^Target$/.test(c.section)) continue; // the target is set by the test
          await settle();
          if (targetKind === "dummy") await keepDummy();
          const how = c.tag === "SELECT" ? "change" : "click";
          const r = await page.evaluate(([id, how]) => {
            const el = document.querySelector('[data-crawl-id="' + id + '"]');
            if (!el || !el.isConnected) return null;
            return window.__harness.act(el, how);
          }, [ c.id, how ]);
          // a list that was drawn again since: the next round finds the new button
          if (r === null) {
            fresh++;
            continue;
          }
          crawled.add(key);
          fresh++;
          // the test bench and A/B run for minutes: stop them once they have started
          if (/^(Run|Run all|Compare)$/.test(c.label)) {
            await sleep(700);
            const more = await page.evaluate(() => {
              const H = window.__harness;
              H.rec = [];
              window.__ryn.panel.benchStop = true;
              return new Promise(res => setTimeout(() => {
                const rec = H.rec;
                H.rec = null;
                res(rec);
              }, 900));
            });
            r.rec = r.rec.concat(more);
          } else {
            await sleep(FAST ? 40 : 110);
          }
          report.controls.push({ pass, target: targetKind, zone, section: c.section, label: c.label, kind: c.tag === "SELECT" ? "select" : "button", dom: r.dom, rec: r.rec });
          // right-click: loadouts (delete yours) and your buttons (edit)
          if (c.ctx && /Loadouts|My buttons/.test(c.section)) {
            const r2 = await page.evaluate(id => {
              const el = document.querySelector('[data-crawl-id="' + id + '"]');
              return el && el.isConnected ? window.__harness.act(el, "context") : null;
            }, c.id);
            if (r2) report.controls.push({ pass, target: targetKind, zone, section: c.section, label: c.label + " (right-click)", kind: "context", dom: r2.dom, rec: r2.rec });
          }
        }
        if (!fresh) break;
      }
    }
  };

  console.log("Crawl: target = you");
  await crawl(1, "me");
  // phase 2: a dummy as the target, in the places that act on the target
  await settle();
  await keepDummy();
  console.log("Crawl: target = dummy " + dummySid);
  check("target is the dummy", await page.evaluate(sid => window.__ryn.panel.target === String(sid), dummySid));
  await crawl(2, "dummy", isNew ? [ "Target", "Player" ] : [ "Me", "Players" ]);
  await page.evaluate(() => {
    const P = window.__ryn.panel;
    P.targetSelect.value = "";
    P.targetSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();

  // ---- your buttons (panels that still have them): add one with a hotkey, press it, delete it ----
  if (await page.evaluate(() => typeof window.__ryn.panel.edit === "function")) {
    const r = await page.evaluate(async () => {
      const P = window.__ryn.panel;
      const H = window.__harness;
      P.edit(null);
      const ed = P.customEditor;
      const [name, cmd] = ed.querySelectorAll("input");
      name.value = "HK";
      cmd.value = "!heal";
      const keyBtn = [ ...ed.querySelectorAll("button") ].find(b => /key/i.test(b.textContent));
      keyBtn.click();
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ", key: "j", bubbles: true }));
      [ ...ed.querySelectorAll("button") ].find(b => b.textContent === "Save").click();
      H.rec = [];
      document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ", key: "j", bubbles: true }));
      const rec = H.rec;
      H.rec = null;
      const saved = JSON.parse(localStorage.getItem("_ryn_admin_buttons") || "[]");
      const i = saved.findIndex(b => b.label === "HK");
      if (i >= 0) {
        P.edit(i);
        [ ...P.customEditor.querySelectorAll("button") ].find(b => b.textContent === "Delete").click();
      }
      const after = JSON.parse(localStorage.getItem("_ryn_admin_buttons") || "[]");
      return { rec, saved: i >= 0, key: i >= 0 ? saved[i].key : null, deleted: !after.some(b => b.label === "HK") };
    });
    check("my buttons: hotkey J runs !heal", r.saved && r.key === "KeyJ" && r.rec.some(e => e.kind === "command" && /^!heal/.test(e.value)), r);
    check("my buttons: delete", r.deleted);
    report.controls.push({ pass: 3, target: "me", zone: "flow", section: "My buttons", label: "hotkey", kind: "key", dom: 0, rec: r.rec });
  }

  // ---- bases and the map editor: copy, stamp, undo; place and delete on the map ----
  {
    await settle();
    const f = await page.evaluate(async () => {
      const H = window.__harness;
      const R = window.__ryn;
      const P = R.panel;
      const btn = t => [ ...document.querySelectorAll("#ryn-admin button") ].find(b => b.textContent.trim() === t);
      const rec = async fn => {
        H.rec = [];
        try {
          fn();
        } catch (e) {
          H.rec.push({ kind: "throw", value: String(e && e.message) });
        }
        await new Promise(r => setTimeout(r, 150));
        const x = H.rec;
        H.rec = null;
        return x;
      };
      const calls = r => r.filter(e => e.kind === "call").map(e => e.value);
      const out = {};
      R.priv.command("!clearnear 800");
      R.priv.command("!place spikes 3");
      out.copy = calls(await rec(() => btn("Copy my base").click()));
      out.stamp = calls(await rec(() => btn("Stamp").click()));
      out.undoStamp = calls(await rec(() => btn("Undo").click()));
      out.at = P.worldAt(640, 430);
      const cv = document.getElementById("gameCanvas");
      const down = () => cv.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 640, clientY: 430, button: 0, pointerId: 1 }));
      // the crawl left the shape on "Line" (two clicks); one click is enough for "One"
      P.editShape.value = "point";
      P.editStart = null;
      btn("Place").click();
      out.place = calls(await rec(down));
      btn("Delete").click();
      out.del = calls(await rec(down));
      out.undoDelete = calls(await rec(() => btn("Undo").click()));
      P.setEdit("");
      return out;
    });
    check("bases: copy my base, stamp it, undo it", f.copy.includes("copyBase") && f.stamp.includes("pasteBase") && f.undoStamp.includes("removeSids"), f);
    if (f.at) check("map editor: place, delete and undo on the map", f.place.includes("placeMany") && f.del.includes("removeAt") && f.undoDelete.includes("restoreObjs"), f);
    else check("map editor: the stub page has no game view to click (skipped)", true);
    for (const [label, list] of [ [ "base copy", f.copy ], [ "base stamp", f.stamp ], [ "undo", f.undoStamp ], [ "editor place", f.place ], [ "editor delete", f.del ], [ "editor undo", f.undoDelete ] ]) {
      report.controls.push({ pass: 3, target: "me", zone: "flow", section: "flow", label, kind: "flow", dom: 0, rec: list.map(v => ({ kind: "call", value: v })) });
    }
  }

  // ---- layout at 312px and in Big ----
  const layout = async mode => {
    const tabs = await page.$$eval("#ryn-admin .ra-tab", els => els.map(e => e.textContent.trim()));
    const issues = [];
    for (const tab of tabs) {
      await page.evaluate(label => [ ...document.querySelectorAll("#ryn-admin .ra-tab") ].find(t => t.textContent.trim() === label).click(), tab);
      if (isNew) await expandAll();
      await sleep(60);
      const bad = await page.evaluate(() => {
        const root = document.getElementById("ryn-admin");
        const rr = root.getBoundingClientRect();
        const out = [];
        const body = root.querySelector(".ra-body");
        if (body.scrollWidth > body.clientWidth + 1) out.push("body scrolls sideways: " + body.scrollWidth + " > " + body.clientWidth);
        for (const el of root.querySelectorAll("*")) {
          if (!window.__harness.visible(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right > rr.right + 0.5 || r.left < rr.left - 0.5) out.push(el.tagName + "." + el.className + " '" + (el.textContent || "").trim().slice(0, 30) + "' " + Math.round(r.left - rr.left) + ".." + Math.round(r.right - rr.left) + " of " + Math.round(rr.width));
        }
        return out.slice(0, 8);
      });
      for (const b of bad) issues.push(mode + " / " + tab + ": " + b);
      await page.locator("#ryn-admin").screenshot({ path: path.join(OUT, (isNew ? "new" : "old") + "-" + mode + "-" + tab.toLowerCase() + ".png") });
    }
    return issues;
  };
  // normal, Big, and a narrow screen (the panel shrinks to fit it); widths animate, so wait
  const mode = async (name, big, viewport, x) => {
    await page.setViewportSize(viewport);
    await page.evaluate(([big, x]) => {
      const P = window.__ryn.panel;
      if (P.setBig) P.setBig(big); else P.root.classList.toggle("ra-wide", big);
      P.place(x, 10);
    }, [ big, x ]);
    await sleep(450);
    const width = await page.evaluate(() => Math.round(window.__ryn.panel.root.getBoundingClientRect().width));
    report.layout.push(...await layout(name));
    return width;
  };
  const widths = {
    normal: await mode("normal", false, { width: 1280, height: 860 }, 700),
    big: await mode("big", true, { width: 1280, height: 860 }, 380),
    narrow: await mode("narrow", false, { width: 360, height: 860 }, 0)
  };
  await mode("normal", false, { width: 1280, height: 860 }, 700);
  check("nothing wider than the panel (normal, Big, a 360px screen)", report.layout.length === 0, report.layout.slice(0, 12));
  check("widths: normal, Big, on a 360px screen", widths.normal >= 312 && widths.big > widths.normal && widths.narrow <= 344, widths);

  // ---- new panel only: search, folds, tab move, Big saved ----
  if (isNew) {
    const s = await page.evaluate(async () => {
      const P = window.__ryn.panel;
      const input = P.searchInput;
      input.value = "heal";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise(r => setTimeout(r, 50));
      const shown = [ ...document.querySelectorAll("#ryn-admin .ra-body .ra-item") ].filter(e => window.__harness.visible(e)).map(e => e.closest(".ra-section").dataset.title + ": " + e.textContent.replace(/\s+/g, " ").trim());
      const pagesShown = [ ...document.querySelectorAll("#ryn-admin .ra-page") ].filter(p => p.style.display !== "none").length;
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      await new Promise(r => setTimeout(r, 50));
      const after = [ ...document.querySelectorAll("#ryn-admin .ra-page") ].filter(p => p.style.display !== "none").length;
      return { shown, pagesShown, cleared: input.value === "", after };
    });
    check("search 'heal' shows only matching rows", s.shown.length > 0 && s.shown.every(t => /heal/i.test(t)), s.shown);
    check("search shows every tab while typing, Esc clears it", s.pagesShown > 1 && s.cleared && s.after === 1, s);
    const z = await page.evaluate(() => {
      const P = window.__ryn.panel;
      P.showTab("analyze");
      const sec = document.querySelector('#ryn-admin .ra-section[data-id="analyze.knockback"]');
      if (!sec.classList.contains("ra-folded")) sec.querySelector(".ra-sec-head").click();
      P.setBig(true);
      return JSON.parse(localStorage.getItem("_ryn_admin_folds") || "{}");
    });
    check("fold state saved", z["analyze.knockback"] === true, z);
  }

  report.errors.push(...errors);
  await page.close();

  // ---- run 2: reload, things kept; the old tab name moves ----
  if (isNew) {
    const { page: p2, errors: e2 } = await boot(context, {
      before: () => {
        try {
          localStorage.setItem("_ryn_admin_open", "true");
        } catch (_) {}
      }
    });
    await sleep(600);
    const kept = await p2.evaluate(() => {
      const P = window.__ryn.panel;
      return {
        tab: P.tab,
        folded: document.querySelector('#ryn-admin .ra-section[data-id="analyze.knockback"]').classList.contains("ra-folded"),
        big: P.root.classList.contains("ra-wide"),
        open: !P.root.classList.contains("ra-hidden")
      };
    });
    check("after reload: tab, fold and Big kept", kept.tab === "analyze" && kept.folded && kept.big && kept.open, kept);
    report.errors.push(...e2);
    await p2.close();
    for (const [old, now] of [ [ "me", "player" ], [ "players", "people" ], [ "test", "train" ], [ "world", "world" ], [ "stats", "analyze" ], [ "lab", "analyze" ], [ "mine", "tools" ] ]) {
      const { page: p3, errors: e3 } = await boot(context, { before: `try { localStorage.setItem("_ryn_admin_tab", ${JSON.stringify(JSON.stringify(old))}); } catch (_) {}` });
      const got = await p3.evaluate(() => [ window.__ryn.panel.tab, JSON.parse(localStorage.getItem("_ryn_admin_tab")) ]);
      check("old tab '" + old + "' opens '" + now + "'", got[0] === now && got[1] === now, got);
      report.errors.push(...e3);
      await p3.close();
    }
  }

  // ---- Ryn bots from the panel: however many, they spawn in the same server tick ----
  if (isNew) {
    for (const [n, ping] of [ [ 8, 0 ], [ 12, 150 ] ]) {
      const { page: pb, errors: eb } = await boot(context, { viaClient: true });
      const r = await pb.evaluate(async ([n, ping]) => {
        const R = window.__ryn;
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        if (ping) R.priv.command("!ping " + ping + " 40");
        const steps = [];
        const watch = setInterval(() => {
          const s = R.priv.state();
          const p = R.priv.call("panel");
          if (!s || !p) return;
          const bots = s.players.filter(q => !q.dummy && s.me && q.sid !== s.me.sid);
          const alive = bots.filter(q => q.alive).length;
          const last = steps[steps.length - 1];
          if (!last || last.alive !== alive || last.joined !== bots.length) steps.push({ tick: p.time.tick, joined: bots.length, alive });
        }, 2);
        const row = [ ...document.querySelectorAll("#ryn-admin .ra-section") ].find(x => x.dataset.title === "Ryn bots");
        row.querySelector('input[type="number"]').value = String(n);
        [ ...row.querySelectorAll("button") ].find(x => x.textContent.trim() === "Spawn").click();
        for (let i = 0; i < 200; i++) {
          await sleep(50);
          const s = R.priv.state();
          if (s.players.filter(q => q.alive && !q.dummy).length >= n + 1) break;
        }
        await sleep(300);
        clearInterval(watch);
        R.priv.command("!ping 0");
        return { steps, said: R.panel.logLine.textContent };
      }, [ n, ping ]);
      const rises = r.steps.filter((x, i) => i > 0 && x.alive > r.steps[i - 1].alive);
      const ok = rises.length === 1 && rises[0].alive === n && r.steps.every(x => x.alive === 0 || x.alive === n);
      check("bots: " + n + " spawn in one server tick" + (ping ? " (fake ping " + ping + "±40)" : ""), ok, r);
      // the game client's own errors with fake ping (seen in fix21 too) are listed, not counted
      report.botErrors = (report.botErrors || []).concat(eb);
      await pb.close();
    }
    if (report.botErrors.length) console.log("Page errors while bots played (game client, not the panel):\n  " + [ ...new Set(report.botErrors) ].join("\n  "));
  }

  await browser.close();

  // ---- summary ----
  const verb = c => {
    const t = c.replace(/^!/, "").trim().split(/\s+/);
    const out = [ t[0] ];
    for (const w of t.slice(1)) {
      if (/^[a-z]+$/i.test(w) && !/^(normal|gold|diamond|ruby|emerald)$/i.test(w) && out.length < 2) out.push(w.toLowerCase());
      else break;
    }
    // !dummy <kind>, !spawn/!spawner <animal>: the kind is a value, not a verb
    if (/^(spawn|spawner)$/.test(out[0]) && out[1] !== "clear" && out[1] !== "remove") out.length = 1;
    if (out[0] === "dummy" && !/^(clear|remove|set)$/.test(out[1] || "")) out.length = 1;
    if (out[0] === "give" && out[1]) return out.join(" ");
    return out.join(" ");
  };
  const verbs = new Set();
  const calls = new Set();
  const silent = [];
  const refused = [];
  for (const c of report.controls) {
    for (const e of c.rec) {
      if (e.kind === "command") e.value.split(/[;\n]/).map(x => x.trim()).filter(Boolean).forEach(x => verbs.add(verb(x)));
      if (e.kind === "call" && !/^(panel|stats|log|physics|series|me)$/.test(e.value)) calls.add(e.value);
      if (e.kind === "setPing") calls.add("setPing");
    }
    // a select only holds a value for a button next to it; a right-click on a built-in does nothing
    const acted = c.rec.some(e => e.kind !== "call" || !/^(panel|stats|log|physics|series|me)$/.test(e.value));
    if (c.kind === "button" && !acted && !c.dom && !/^Stop$/.test(c.label)) silent.push(c.zone + " / " + c.section + " / " + c.label);
    for (const e of c.rec) if (e.kind === "bad" || e.kind === "throw") refused.push(c.zone + " / " + c.section + " / " + c.label + ": " + e.value);
  }
  report.verbs = [ ...verbs ].sort();
  report.calls = [ ...calls ].sort();
  report.silent = silent;
  report.refused = refused;
  console.log("\nControls clicked: " + report.controls.length);
  console.log("Command verbs (" + report.verbs.length + "): " + report.verbs.join(", "));
  console.log("Server calls: " + report.calls.join(", "));
  if (silent.length) console.log("Did nothing visible:\n  " + silent.join("\n  "));
  if (refused.length) console.log("Refused / said no:\n  " + [ ...new Set(refused) ].join("\n  "));
  check("no page errors", report.errors.length === 0, [ ...new Set(report.errors) ].slice(0, 10));
  check("every control did something", silent.length === 0, silent);
  if (COMPARE) {
    const old = JSON.parse(fs.readFileSync(COMPARE, "utf8"));
    // merged on purpose: the old command and what reaches the same thing now
    const MERGED = { "scenario crab": "arena" };
    const missingVerbs = old.verbs.filter(v => !report.verbs.includes(v) && !(MERGED[v] && report.verbs.includes(MERGED[v])));
    for (const [was, now] of Object.entries(MERGED)) if (old.verbs.includes(was)) console.log("Merged: '" + was + "' -> '" + now + "'" + (report.verbs.includes(now) ? "" : " (MISSING)"));
    const missingCalls = old.calls.filter(v => !report.calls.includes(v));
    check("every command the old panel sent is still reachable", missingVerbs.length === 0, missingVerbs);
    check("every server call the old panel made is still reachable", missingCalls.length === 0, missingCalls);
    const added = report.verbs.filter(v => !old.verbs.includes(v));
    if (added.length) console.log("New in this panel: " + added.join(", "));
  }
  const file = path.join(OUT, (isNew ? "new" : "old") + "-report.json");
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  const failed = report.checks.filter(c => !c.ok);
  console.log("\n" + (failed.length ? failed.length + " check(s) failed" : "All checks passed") + ". Report: " + file);
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(2);
});
