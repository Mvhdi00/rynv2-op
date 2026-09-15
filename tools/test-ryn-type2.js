#!/usr/bin/env node
//
// Behaviour tests for the bot systems in Ryn_Type_2.user.js.
//
//     node tools/test-ryn-type2.js
//
// The userscript is one IIFE that cannot run outside a browser, so these tests
// lift the pieces under test *verbatim* out of the file by line range and run
// them against fabricated state. Nothing here is a paraphrase of the shipped
// code: if a slice stops matching, the extractor throws rather than testing a
// stale copy of itself.
//
// The ammo gate is checked against drivers/game-drivers.json — the tables
// extracted from the game bundle — rather than against a second copy of the
// rule written here, so "agrees with the game" means the game's own numbers.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "Ryn_Type_2.user.js"), "utf8");
const drivers = require(path.join(ROOT, "drivers", "game-drivers.json"));
const lines = SRC.split("\n");

const between = (a, b) => lines.slice(a - 1, b - 1).join("\n"); // 1-indexed, end exclusive
function find(re, from = 0) {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  throw new Error("test extractor: no line matches " + re + " — the script has moved and these tests need re-anchoring");
}

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log("  ok   " + name);
  } else {
    fail++;
    console.log("  FAIL " + name + (extra ? "  -> " + extra : ""));
  }
}
function section(title) {
  console.log("\n" + title);
}

// ── extraction ─────────────────────────────────────────────────────────────

const tables =
  between(find(/^  const Weapons = \[ \{/), find(/^  const ItemGroups = \{/)) +
  "\n" +
  between(find(/^  const Hats = \{/), find(/^  const Accessories = \{/));

const ammoSrc = between(find(/^  function botHasAmmoFor/), find(/^  \/\/ Sakuna's autobreak, for bots\./));
const dexSrc = between(find(/^  const DEX_LIMIT = 400;/), find(/^  \/\/ ={10,}$/, find(/^  const DEX_LIMIT = 400;/)));
const scanSrc = between(find(/^  const SCAN_STALE_MS = /), find(/^  class PlayerManager \{/));
const kiteSrc = between(find(/^  const BOT_KITE_BAND = /), find(/^  \/\/ The bot half\. Sits in botModules/));
const missionSrc = between(find(/^  \/\/ The bot half\. Sits in botModules/), find(/^  class Automill \{/));
const poolSrc = between(find(/^  const TURNSTILE_CF_LIFETIME_MS = /), find(/^  setInterval\(\(\) => \{/));

// Everything the slices reach for that lives elsewhere in the script, stubbed
// at the same shape.
const PRELUDE = `
  const PI = Math.PI, PI2 = PI * 2;
  const hyp = (a, b) => Math.sqrt(a * a + b * b);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const getAngleDist = (a, b) => { const d = Math.abs(b - a) % PI2; return d > PI ? PI2 - d : d; };
  const Config_default = { mapScale: 14400, mapPingTime: 2200, mapPingScale: 40 };
  const DataHandler_default = { getWeapon: id => Weapons[id] };
  const BOT_RANGED_SECONDARIES = new Set([ 9, 12, 13, 15 ]);
  const window = { _rynBotToast: null, _gbot1v1BotID: null, _gbot1v1WinCleanup: null };
  const _isControlled = () => true;
  const dexLabel_stub = c => (c && c.isOwner ? "you" : "bot " + (c ? c.id : "?"));
  let Settings_default = env.Settings || {};
  let Possess = env.Possess || null;
  let botPickTarget = env.botPickTarget || (() => ({ target: null, shielded: null, blockedBy: null }));
  let botVolleyTurn = env.botVolleyTurn || (() => ({ mayFire: true, wave: 0 }));
`;

function build(env) {
  const body =
    PRELUDE + tables + ammoSrc + dexSrc + scanSrc + kiteSrc + missionSrc +
    "\n  return { Weapons, Hats, botHasAmmoFor, RynPlayerDex, RynScan, RynScanPing, dexLabel," +
    " BotRangedAttack, BotScanMission, SCAN_ENGAGE_RADIUS, SCAN_FINDER_RADIUS, SCAN_ARRIVE_RADIUS };\n";
  return new Function("env", body)(env);
}

function buildPool(env) {
  const body = `
    const generateTurnstileToken = env.mint;
    const Date = env.Date;
    const window = env.window;
    const client = env.client;
    const document = env.document;
    const Renderer = env.Renderer;
    // Deterministic stand-in for the browser's idle queue, so a test can say
    // exactly when a deferred challenge is allowed to start.
    const requestIdleCallback = env.requestIdleCallback;
    ${poolSrc}
    return { TokenPool: TokenPool, TTL: TURNSTILE_TTL_MS, CF: TURNSTILE_CF_LIFETIME_MS,
             SAFETY: TURNSTILE_SAFETY_MS,
             MOVING: TURNSTILE_CONCURRENT_MOVING, STILL: TURNSTILE_CONCURRENT_STILL,
             STILL_SPEED: TURNSTILE_STILL_SPEED, STILL_MS: TURNSTILE_STILL_MS,
             FPS_SLACK: TURNSTILE_FPS_SLACK, FPS_FLOOR: TURNSTILE_FPS_FLOOR_MS,
             TARGET: TURNSTILE_POOL_TARGET, KEEPER: TURNSTILE_KEEPER_MS,
             MINT_TIMEOUT: TURNSTILE_MINT_TIMEOUT_MS, WAIT: TURNSTILE_WAIT_MS };
  `;
  return new Function("env", body)(env);
}

// ── 1. the ammo gate against the game's own hasRes ─────────────────────────
//
// src/game_index.js, Player.update:
//     hasRes = function (f, w) {
//         for (let T = 0; T < f.req.length; ) {
//             if (this[f.req[T]] < Math.round(f.req[T + 1] * (w || 1))) return false;
//             T += 2;
//         }
//         return true;
//     }

function gameHasRes(weaponDriver, resources, projCost) {
  const req = weaponDriver.req;
  if (!req) return true;
  for (let i = 0; i < req.length; i += 2) {
    if (resources[req[i]] < Math.round(req[i + 1] * (projCost || 1))) return false;
  }
  return true;
}

function testAmmo() {
  section("1. ammo gate agrees with the game's hasRes");
  const m = build({});
  const RESOURCES = [
    { food: 0, wood: 0, stone: 0, gold: 0 },
    { food: 100, wood: 3, stone: 9, gold: 0 },
    { food: 100, wood: 4, stone: 10, gold: 0 },
    { food: 100, wood: 5, stone: 5, gold: 0 },
    { food: 100, wood: 10, stone: 10, gold: 0 },
    { food: 100, wood: 100, stone: 100, gold: 100 },
    { food: 0, wood: 2, stone: 5, gold: 0 }
  ];
  const HATS = [0, 32, 7]; // none, musketeer (projCost 0.5), bull
  let mismatches = 0;
  let combos = 0;
  for (let wid = 0; wid < drivers.weapons.length; wid++) {
    for (const res of RESOURCES) {
      for (const hatID of HATS) {
        combos++;
        const projCost = m.Hats[hatID] && m.Hats[hatID].projCost ? m.Hats[hatID].projCost : 1;
        const mine = m.botHasAmmoFor({ hatID: hatID, resources: res }, wid);
        const theirs = gameHasRes(drivers.weapons[wid], res, projCost);
        if (mine !== theirs) {
          mismatches++;
          console.log("    w" + wid + " hat" + hatID + " " + JSON.stringify(res) + " mine=" + mine + " game=" + theirs);
        }
      }
    }
  }
  ok("all " + combos + " weapon x resource x hat combinations agree", mismatches === 0, mismatches + " mismatches");

  const res = (f, w, s, g) => ({ food: f, wood: w, stone: s, gold: g });
  ok("musket with 9 stone is refused", m.botHasAmmoFor({ hatID: 0, resources: res(0, 0, 9, 0) }, 15) === false);
  ok("musket with 10 stone is allowed", m.botHasAmmoFor({ hatID: 0, resources: res(0, 0, 10, 0) }, 15) === true);
  ok("musketeer hat halves the musket to 5 stone", m.botHasAmmoFor({ hatID: 32, resources: res(0, 0, 5, 0) }, 15) === true);
  ok("musketeer hat still refuses 4 stone", m.botHasAmmoFor({ hatID: 32, resources: res(0, 0, 4, 0) }, 15) === false);
  ok("repeater needs 10 wood", m.botHasAmmoFor({ hatID: 0, resources: res(0, 9, 0, 0) }, 13) === false);
  ok("great hammer is never refused", m.botHasAmmoFor({ hatID: 0, resources: res(0, 0, 0, 0) }, 10) === true);
  ok("shield is never refused", m.botHasAmmoFor({ hatID: 0, resources: res(0, 0, 0, 0) }, 11) === true);
  ok("null weapon is refused", m.botHasAmmoFor({ hatID: 0, resources: res(9, 9, 9, 9) }, null) === false);
  ok("undefined weapon is refused", m.botHasAmmoFor({ hatID: 0, resources: res(9, 9, 9, 9) }, undefined) === false);
}

// ── 2. the player index ────────────────────────────────────────────────────

function testDex() {
  section("2. player index");
  const m = build({});
  const dex = m.RynPlayerDex;
  dex.clear();

  const owner = {
    isOwner: true, id: 0,
    myPlayer: { id: 500 },
    clientIDList: new Set([601, 602]),
    clients: new Set()
  };
  owner.ownerClient = owner;
  const bot3 = { isOwner: false, id: 3, ownerClient: owner, myPlayer: { id: 603 } };
  owner.clients.add(bot3);

  dex.note(owner, 700, "Victim", m.dexLabel(owner));
  dex.note(bot3, 700, "Victim", m.dexLabel(bot3));
  dex.note(bot3, 701, "Other", m.dexLabel(bot3));
  ok("two sightings of one player make one entry", dex.entries.size === 2, "size=" + dex.entries.size);
  ok("the entry records which connection saw them last", dex.get(700).seenBy === "bot 3");

  dex.note(owner, 500, "Me", "you");
  ok("the owner is never listed", dex.get(500) === undefined);
  dex.note(owner, 601, "MyBot", "you");
  dex.note(bot3, 602, "MyBot2", "bot 3");
  ok("registered bots are never listed", dex.get(601) === undefined && dex.get(602) === undefined);
  dex.note(owner, 603, "MyBot3", "you");
  ok("a bot not yet in clientIDList is still not listed", dex.get(603) === undefined);

  // The race forget() exists for: a bot seen by another bot before it learned
  // its own player id.
  const orphan = { isOwner: false, id: 9, ownerClient: { myPlayer: { id: 500 }, clientIDList: new Set(), clients: new Set() } };
  dex.note(orphan, 604, "LateBot", "bot 9");
  ok("a bot seen before it registers does get filed", dex.get(604) !== undefined);
  dex.forget(604);
  ok("forget() takes it back out", dex.get(604) === undefined);

  const before = dex.revision;
  dex.note(owner, 700, "Victim", "you");
  ok("an unchanged name does not bump the revision", dex.revision === before);
  dex.note(owner, 700, "VictimRenamed", "you");
  ok("a changed name bumps the revision", dex.revision > before);

  dex.get(700).posAt = 0;
  dex.seen({ id: 700, pos: { current: { x: 1200, y: 3400 } }, currentHealth: 71, clanName: "ABC" }, "bot 3");
  ok("a positional sighting records the position", dex.get(700).x === 1200 && dex.get(700).y === 3400);
  ok("a positional sighting records health and clan", dex.get(700).health === 71 && dex.get(700).clanName === "ABC");
  const posAt = dex.get(700).posAt;
  dex.seen({ id: 700, pos: { current: { x: 9999, y: 9999 } }, currentHealth: 10, clanName: null }, "bot 3");
  ok("positions are throttled", dex.get(700).x === 1200 && dex.get(700).posAt === posAt);
  dex.seen({ id: 12345, pos: { current: { x: 1, y: 1 } }, currentHealth: 1, clanName: null }, "bot 3");
  ok("a position for an id nobody has named creates nothing", dex.get(12345) === undefined);

  dex.clear();
  for (let i = 0; i < 450; i++) {
    dex.note(owner, 1000 + i, "P" + i, "you");
    dex.get(1000 + i).lastSeen = i; // oldest first
  }
  ok("the index is capped", dex.entries.size <= 400, "size=" + dex.entries.size);
  ok("eviction drops the oldest, not the newest", dex.get(1449) !== undefined && dex.get(1000) === undefined);
}

// ── 3. the scan state machine ──────────────────────────────────────────────

function testScan() {
  section("3. scan state machine");
  const m = build({});
  const scan = m.RynScan;
  scan.on = false;
  scan.setTarget(null, "");

  ok("scan will not switch on without a target", scan.toggle() === false && scan.on === false);
  scan.setTarget(700, "Victim");
  ok("scan switches on with a target", scan.toggle() === true && scan.on === true);
  ok("with no sighting the fleet is searching", scan.searching === true);

  const finder = { isOwner: false, id: 4, myPlayer: { id: 604, inGame: true } };
  const helper = { isOwner: false, id: 5, myPlayer: { id: 605, inGame: true } };
  const target = { id: 700, pos: { current: { x: 5000, y: 5000 }, previous: { x: 4960, y: 5000 } }, currentHealth: 88 };

  scan.sighting(finder, target);
  ok("a sighting is recorded", scan.found === true && scan.x === 5000);
  ok("the step the target took last tick is kept", scan.vx === 40 && scan.vy === 0);
  ok("the first bot to report becomes the finder", scan.finder === finder);
  ok("a found target stops the fleet searching", scan.searching === false);

  scan.sighting(helper, target);
  ok("a later sighting does not take the engagement off the finder", scan.finder === finder);

  scan.sighting(helper, { id: 999, pos: { current: { x: 1, y: 1 }, previous: { x: 1, y: 1 } }, currentHealth: 5 });
  ok("a sighting of a different player is ignored", scan.x === 5000);

  let aim = scan.aimPoint({ x: 0, y: 0 });
  ok("a fresh sighting leads by exactly one tick", aim.x === 5040 && aim.y === 5000);
  scan.at = Date.now() - 1000;
  aim = scan.aimPoint({ x: 0, y: 0 });
  ok("a stale sighting uses the confirmed position, not the lead", aim.x === 5000 && aim.y === 5000);

  scan.expire();
  ok("a sighting inside the window is still live", scan.found === true);
  scan.at = Date.now() - 1500;
  scan.expire();
  ok("a sighting past the window expires", scan.found === false);
  ok("expiry does not switch the scan off", scan.on === true);
  ok("expiry puts the fleet back to searching", scan.searching === true);
  ok("expiry clears the finder", scan.finder === null);

  scan.sighting(helper, target);
  ok("the target can be re-acquired", scan.found === true);
  ok("the bot that re-found them becomes the finder", scan.finder === helper);
  scan.expire();
  ok("a fresh sighting survives expiry", scan.found === true);

  scan.off();
  ok("off clears the sighting", scan.found === false && scan.on === false);
  scan.off();
  ok("off is idempotent", scan.on === false);

  scan.setTarget(701, "Another");
  scan.toggle();
  scan.sighting(finder, target);
  ok("a sighting of the old target is ignored after retargeting", scan.found === false);
  scan.sighting(finder, { id: 701, pos: { current: { x: 10, y: 20 }, previous: { x: 10, y: 20 } }, currentHealth: 3 });
  ok("a sighting of the new target lands", scan.found === true && scan.x === 10);

  scan.x = 14395;
  scan.vx = 50;
  scan.vy = 0;
  scan.at = Date.now();
  aim = scan.aimPoint({ x: 0, y: 0 });
  ok("the lead is clamped to the map", aim.x === 14400, "aim.x=" + aim.x);
  scan.off();
}

// ── 4. the token pool ──────────────────────────────────────────────────────

function poolHarness(opts) {
  const o = opts || {};
  let now = 1e6;
  let minted = 0;
  let inflight = [];
  // The two gates the pool checks before starting anything: Cloudflare's own
  // script being on the page, and the main player being in the game. Both open
  // by default; the gate tests close them.
  //
  // `speed` is what the frame-rate guard reads — distance covered last server
  // tick. Zero (standing still) by default, so the pool settles to its faster
  // rate after a couple of ticks; the guard's own tests move the player.
  const win = { turnstile: o.noTurnstile ? undefined : { render: () => {} }, top: null };
  const cl = { myPlayer: { inGame: o.outOfGame ? false : true, speed: o.speed === undefined ? 0 : o.speed } };
  // The frame-time signal the pool reads before spending any. 16ms is a
  // healthy 60fps, which is the default; the frame tests move it.
  const doc = { hidden: o.hidden === true };
  const rend = { _dtSmoothed: o.dt === undefined ? 16 : o.dt };
  let idleQueue = [];
  const built = buildPool({
    Date: { now: () => now },
    window: win,
    client: cl,
    document: doc,
    Renderer: rend,
    requestIdleCallback: fn => { idleQueue.push(fn); },
    mint: () => new Promise((res, rej) => { minted++; inflight.push({ res: res, rej: rej }); })
  });
  // Run every challenge the pool has queued for idle time. Challenges are
  // started from an idle callback now, so nothing is in flight until this.
  const flushIdle = () => {
    const q = idleQueue;
    idleQueue = [];
    q.forEach(fn => fn());
  };
  return {
    pool: built.TokenPool,
    k: built,
    win: win,
    client: cl,
    doc: doc,
    rend: rend,
    flushIdle: flushIdle,
    get idlePending() { return idleQueue.length; },
    advance: ms => { now += ms; },
    // Top up and let the queued challenges start, which is what one keeper
    // tick amounts to once the browser has had an idle moment.
    pump: () => { built.TokenPool.refill(); flushIdle(); },
    get minted() { return minted; },
    get inflight() { return inflight.length; },
    // One keeper tick: advance the clock by the keeper's own interval, top up,
    // then let whatever it started resolve. The clock has to move, because the
    // frame-rate guard decides its rate from how long the player has been
    // standing still.
    tick: async () => {
      now += built.KEEPER;
      built.TokenPool.refill();
      flushIdle();
      const batch = inflight;
      inflight = [];
      batch.forEach(p => p.res("tok" + minted + "_" + Math.random().toString(36).slice(2)));
      await new Promise(r => setImmediate(r));
    },
    settleAll: async () => {
      const batch = inflight;
      inflight = [];
      batch.forEach(p => p.res("tok" + minted + "_" + Math.random().toString(36).slice(2)));
      await new Promise(r => setImmediate(r));
    },
    failAll: async () => {
      const batch = inflight;
      inflight = [];
      batch.forEach(p => p.rej(new Error("no")));
      await new Promise(r => setImmediate(r));
    },
    // Run the keeper until the pool is full, or give up.
    fill: async function (cap) {
      let rounds = 0;
      while (built.TokenPool.size < built.TARGET && rounds < (cap || 200)) {
        await this.tick();
        rounds++;
      }
      return rounds;
    }
  };
}

async function testPool() {
  section("4. turnstile token pool");

  // The one constraint that is not ours: a pooled token must never outlive
  // Cloudflare's own acceptance window.
  {
    const k = poolHarness().k;
    ok("the pool lifetime is derived from Cloudflare's, not chosen", k.TTL === k.CF - k.SAFETY);
    ok("the pool lifetime is inside Cloudflare's window", k.TTL < k.CF, k.TTL + " vs " + k.CF);
    ok("the safety margin is a real one", k.SAFETY >= 3e4, "safety=" + k.SAFETY);
  }

  // Nothing is started before Cloudflare's own script is on the page. At
  // document-start it is not, and without this the keeper would fire four
  // challenges every 2.5s that could only reject.
  {
    const h = poolHarness({ noTurnstile: true });
    h.pump();
    ok("nothing is minted before the Turnstile script loads", h.minted === 0);
    h.win.turnstile = { render: () => {} };
    h.pump();
    ok("minting starts as soon as it is there", h.minted > 0, "minted=" + h.minted);
  }

  // ── frames come first ─────────────────────────────────────────────────────
  //
  // Whatever a challenge costs on a given machine, it stops being paid the
  // moment it shows in the frame time.
  // tick() settles whatever it starts, so a slot left in flight cannot mask
  // the guard by filling the concurrency budget on its own.
  {
    const h = poolHarness({ dt: 16 });             // a healthy 60fps
    await h.tick();
    ok("healthy frames mint normally", h.minted > 0, "minted=" + h.minted);
    ok("the panel reports frames as healthy", h.pool.frames === 1);

    const before = h.minted;
    h.rend._dtSmoothed = 16 * h.k.FPS_SLACK + 5;   // frames have gone long
    for (let i = 0; i < 10; i++) await h.tick();
    ok("a frame-rate drop stops minting", h.minted === before, "minted=" + h.minted);
    ok("the panel reports it holding off", h.pool.frames === 0);

    h.rend._dtSmoothed = 16;                       // recovered
    await h.tick();
    ok("recovering resumes it", h.minted > before, "minted=" + h.minted);
  }

  // The bar is the machine's own baseline, not a fixed frame rate: a machine
  // that simply runs slower should still be able to fill its pool.
  {
    const h = poolHarness({ dt: 40 });             // a steady 25fps machine
    for (let i = 0; i < 3; i++) await h.tick();
    const steady = h.minted;
    ok("a slower machine holding steady still mints", steady >= 3, "minted=" + steady);
    h.rend._dtSmoothed = 40 * h.k.FPS_SLACK + 5;   // worse than its own normal
    for (let i = 0; i < 5; i++) await h.tick();
    ok("and stops when it drops below its own normal", h.minted === steady, "minted=" + h.minted);
  }

  // Under the floor nothing is wrong on any machine.
  {
    const h = poolHarness({ dt: 40 });
    await h.tick();
    const before = h.minted;
    h.rend._dtSmoothed = h.k.FPS_FLOOR - 1;        // 60fps+
    await h.tick();
    ok("60fps always mints, whatever the baseline was", h.minted > before, "minted=" + h.minted);
  }

  // A hidden tab renders nothing, so minting there is cost for no reason.
  {
    const h = poolHarness({ hidden: true });
    for (let i = 0; i < 5; i++) await h.tick();
    ok("a hidden tab mints nothing", h.minted === 0, "minted=" + h.minted);
    h.doc.hidden = false;
    await h.tick();
    ok("coming back to the tab resumes it", h.minted > 0, "minted=" + h.minted);
  }

  // Challenges are started from idle, not from the top-up itself.
  {
    const h = poolHarness();
    h.pool.refill();
    ok("the top-up defers the challenge to idle", h.idlePending > 0 && h.minted === 0, "pending=" + h.idlePending + " minted=" + h.minted);
    ok("but the slot is claimed straight away", h.pool.minting > 0, "minting=" + h.pool.minting);
    h.flushIdle();
    ok("idle time is when it actually starts", h.minted > 0, "minted=" + h.minted);
  }

  // ── the frame-rate guard ──────────────────────────────────────────────────
  //
  // A Turnstile challenge is a cross-origin iframe doing proof of work, and
  // several at once costs the game frames. One while the player is moving,
  // two once they have been standing still for a while.
  {
    const h = poolHarness({ speed: 40 });          // running
    h.pump();
    ok("one challenge at a time while moving", h.pool.minting === h.k.MOVING, "minting=" + h.pool.minting);
    for (let i = 0; i < 10; i++) { h.advance(h.k.KEEPER); h.pump(); }
    ok("still one after ten ticks of moving", h.pool.minting === h.k.MOVING, "minting=" + h.pool.minting);
    ok("the panel reports the moving rate", h.pool.concurrency === h.k.MOVING);

    h.client.myPlayer.speed = 0;                   // stopped
    h.advance(h.k.KEEPER);
    h.pump();
    ok("stopping does not open the second slot immediately", h.pool.concurrency === h.k.MOVING);
    h.advance(h.k.STILL_MS);
    h.pump();
    ok("standing still for long enough opens it", h.pool.concurrency === h.k.STILL);
    ok("and a second challenge starts", h.pool.minting === h.k.STILL, "minting=" + h.pool.minting);

    h.client.myPlayer.speed = 40;                  // moving again
    h.advance(h.k.KEEPER);
    h.pump();
    ok("moving again closes it", h.pool.concurrency === h.k.MOVING);

    // Right on the threshold, and an unreadable speed.
    h.client.myPlayer.speed = h.k.STILL_SPEED;
    h.pump();                             // starts the stillness clock
    h.advance(h.k.STILL_MS);
    h.pump();
    ok("the threshold itself counts as still", h.pool.concurrency === h.k.STILL);
    h.client.myPlayer.speed = NaN;
    h.advance(h.k.STILL_MS);
    h.pump();
    ok("an unreadable speed takes the quieter rate", h.pool.concurrency === h.k.MOVING);
  }

  // And nothing is started until the main player is actually in the game. A
  // tab parked on the name box mints nothing at all.
  {
    const h = poolHarness({ outOfGame: true });
    h.pump();
    ok("nothing is minted on the menu", h.minted === 0);
    ok("the panel reports it as paused", h.pool.running === false);
    for (let i = 0; i < 20; i++) h.pump();
    ok("twenty keeper ticks on the menu still mint nothing", h.minted === 0);

    h.client.myPlayer.inGame = true;
    ok("the panel reports it as running once in the game", h.pool.running === true);
    await h.fill();
    ok("entering the game fills the pool", h.pool.size === h.k.TARGET, "size=" + h.pool.size);

    // Death takes it out of the game again. The pool does not drain in that
    // time, but nothing new is minted either.
    h.client.myPlayer.inGame = false;
    const before = h.minted;
    h.pool.take();
    h.pump();
    ok("a death pauses minting", h.minted === before);
    ok("but the pool it already has survives", h.pool.size === h.k.TARGET - 1, "size=" + h.pool.size);
    h.client.myPlayer.inGame = true;
    h.pump();
    ok("respawning resumes it", h.minted > before);
  }

  let h = poolHarness();
  h.pump();
  ok("the pool fills once you are in the game", h.minted > 0);
  ok("it does not start forty challenges at once", h.inflight === h.pool.concurrency && h.inflight <= h.k.STILL, "inflight=" + h.inflight);
  h.pump();
  ok("a refill does not double-mint what is already in flight", h.minted === h.pool.concurrency, "minted=" + h.minted);

  const rounds = await h.fill();
  ok("it fills to the full forty", h.pool.size === h.k.TARGET, "size=" + h.pool.size);
  ok("in no more ticks than the faster rate allows", rounds <= h.k.TARGET, "rounds=" + rounds);
  h.pump();
  ok("a full pool mints nothing more", h.inflight === 0);

  const a = h.pool.take();
  const b = h.pool.take();
  ok("two takes give two different tokens", a !== null && b !== null && a !== b);
  ok("taking removes them from the pool", h.pool.size === h.k.TARGET - 2, "size=" + h.pool.size);
  ok("spending is counted", h.pool.spent === 2);

  // Oldest-first, so the bottom of the pool cannot rot unused.
  {
    const first = h.pool.ready[0].token;
    const last = h.pool.ready[h.pool.ready.length - 1].token;
    const got = h.pool.take();
    ok("a take serves the oldest token", got === first && got !== last);
  }

  // A drained pool refills itself, and an empty one says so rather than
  // reusing anything.
  {
    const hh = poolHarness();
    await hh.fill();
    for (let i = 0; i < hh.k.TARGET; i++) hh.pool.take();
    ok("a fully drained pool is empty", hh.pool.size === 0);
    ok("an empty pool returns null rather than reusing one", hh.pool.take() === null);
    await hh.fill();
    ok("and fills itself straight back up", hh.pool.size === hh.k.TARGET, "size=" + hh.pool.size);
  }

  // Expiry, and the standing cost of holding a pool full.
  {
    const hh = poolHarness();
    await hh.fill();
    hh.advance(hh.k.TTL - 1);
    ok("a token inside its window is still offered", hh.pool.take() !== null);
    hh.advance(2);
    ok("one millisecond past the window it is gone", hh.pool.take() === null);
    ok("the whole pool ages out together", hh.pool.size === 0);
    ok("tokens that aged out unused are counted", hh.pool.expired >= hh.k.TARGET - 1, "expired=" + hh.pool.expired);
    const before = hh.minted;
    await hh.fill();
    ok("an aged-out pool is minted again", hh.minted > before);
  }

  {
    const hh = poolHarness();
    hh.pump();
    const before = hh.minted;
    await hh.failAll();
    ok("a failed mint leaves the pool empty", hh.pool.size === 0);
    hh.pump();
    ok("a failed mint releases its slot so the keeper retries", hh.minted > before, "minted=" + hh.minted);
  }

  // ── the manual switch ─────────────────────────────────────────────────────
  {
    const hh = poolHarness();
    await hh.tick();
    const before = hh.minted;
    ok("the pool starts enabled", hh.pool.enabled === true);

    hh.pool.stop();
    for (let i = 0; i < 10; i++) await hh.tick();
    ok("stop halts minting", hh.minted === before, "minted=" + hh.minted);
    ok("and the panel reports it stopped", hh.pool.running === false);
    ok("tokens already held are kept", hh.pool.size > 0, "size=" + hh.pool.size);
    ok("and can still be spent", typeof hh.pool.take() === "string");

    hh.pool.start();
    hh.flushIdle();
    ok("start resumes it", hh.minted > before, "minted=" + hh.minted);
    ok("and the panel reports it running", hh.pool.running === true);
  }

  // A spawn waiting on a token that is no longer coming must not sit out its
  // timeout.
  {
    const hh = poolHarness();
    hh.pump();
    const spawn = hh.pool.waitFor(5000);
    ok("a spawn is queued", hh.pool.waiting === 1);
    hh.pool.stop();
    ok("stopping releases it", (await spawn) === null);
    ok("and takes it off the queue", hh.pool.waiting === 0);
  }

  // The target is a constant now, not a setting.
  ok("the target is fixed at forty", h.k.TARGET === 40, "target=" + h.k.TARGET);
  ok("the pool reports the same target it fills to", h.pool.target === h.k.TARGET);

  // ── the pool must not be able to wedge ────────────────────────────────────
  //
  // In-flight mints are subtracted from what the pool may start, so a
  // challenge that never settles holds a concurrency slot for good. Four of
  // those used to stop the pool for the rest of the page: empty, full or
  // otherwise, it computed nothing to do and never recovered.
  {
    const hh = poolHarness();
    hh.pump();
    const rate = hh.pool.concurrency;
    ok("every concurrency slot is running", hh.pool.minting === rate, "minting=" + hh.pool.minting);
    // None of them ever settle.
    for (let i = 0; i < 10; i++) hh.pump();
    ok("a wedged pool starts nothing new", hh.minted === rate, "minted=" + hh.minted);
    ok("and has nothing to show for it", hh.pool.size === 0);

    hh.advance(hh.k.MINT_TIMEOUT - 1);
    hh.pump();
    ok("a challenge inside its deadline is not written off", hh.pool.stalled === 0, "stalled=" + hh.pool.stalled);

    hh.advance(2);
    hh.pump();
    ok("past the deadline the stuck ones are written off", hh.pool.stalled >= rate, "stalled=" + hh.pool.stalled);
    ok("and the pool starts minting again", hh.minted > rate, "minted=" + hh.minted);
    await hh.fill();
    ok("a pool that wedged recovers to full", hh.pool.size === hh.k.TARGET, "size=" + hh.pool.size);
  }

  // A challenge written off and then answered anyway is still a good token.
  {
    const hh = poolHarness();
    hh.pump();
    hh.advance(hh.k.MINT_TIMEOUT + 1);
    hh.pump();
    ok("the slow ones were written off", hh.pool.stalled > 0, "stalled=" + hh.pool.stalled);
    const started = hh.minted;
    await hh.settleAll();
    ok("every late token is kept rather than thrown away", hh.pool.size === started, "size=" + hh.pool.size + " started=" + started);
  }

  // Spending the whole pool, repeatedly, never stops it coming back.
  {
    const hh = poolHarness();
    for (let cycle = 0; cycle < 3; cycle++) {
      await hh.fill();
      ok("cycle " + (cycle + 1) + ": filled to forty", hh.pool.size === hh.k.TARGET, "size=" + hh.pool.size);
      for (let i = 0; i < hh.k.TARGET; i++) hh.pool.take();
      ok("cycle " + (cycle + 1) + ": drained to nothing", hh.pool.size === 0);
    }
    ok("three full cycles spent one hundred and twenty tokens", hh.pool.spent === hh.k.TARGET * 3, "spent=" + hh.pool.spent);
  }

  // ── a spawn and the pool must not compete ─────────────────────────────────
  //
  // A spawn that found the pool empty used to start its own challenge beside
  // the four already running. It now joins the queue for work in progress and
  // is served ahead of the pool's shelf.
  {
    const hh = poolHarness();
    hh.pump();
    const busy = hh.pool.minting;
    ok("the pool is busy and empty", busy > 0 && hh.pool.size === 0);
    const before = hh.minted;
    const spawn = hh.pool.waitFor(5000);
    ok("a waiting spawn starts no challenge of its own", hh.minted === before, "minted=" + hh.minted);
    ok("the pool reports it as waiting", hh.pool.waiting === 1);
    await hh.settleAll();
    const got = await spawn;
    ok("the spawn is handed the first token out", typeof got === "string" && got.length > 0);
    ok("it counts as spent", hh.pool.spent === 1);
    ok("the rest went to the shelf", hh.pool.size === busy - 1, "size=" + hh.pool.size);
  }

  // Several spawns at once queue rather than each starting a challenge.
  {
    const hh = poolHarness();
    hh.pump();
    const before = hh.minted;
    const spawns = [ hh.pool.waitFor(5000), hh.pool.waitFor(5000), hh.pool.waitFor(5000) ];
    ok("three waiting spawns start no challenges of their own", hh.minted === before, "minted=" + hh.minted);
    // Served one after another, because the rate limit still applies to them.
    // Each round: let the queued challenge start, then answer it. One waiter
    // is served per round, which is the point.
    for (let i = 0; i < 6 && hh.pool.waiting > 0; i++) { await hh.settleAll(); hh.flushIdle(); }
    const got = await Promise.all(spawns);
    ok("all three are served rather than sent off to mint their own", got.every(t => typeof t === "string"), JSON.stringify(got));
    ok("with three different tokens", new Set(got).size === 3);
    ok("and no more challenges than tokens", hh.minted === 3, "minted=" + hh.minted);
  }

  // A waiter must not sit out the full timeout when nothing is coming.
  {
    const hh = poolHarness();
    hh.pump();
    const spawn = hh.pool.waitFor(5000);
    await hh.failAll();
    const got = await spawn;
    ok("a waiter is released as soon as the pool runs dry", got === null);
    ok("and is off the queue", hh.pool.waiting === 0);
  }

  // Waiting while the pool is stopped falls straight through.
  {
    const hh = poolHarness({ outOfGame: true });
    const got = await hh.pool.waitFor(5000);
    ok("a waiter on a stopped pool is released immediately", got === null);
  }

  // The pool keeps minting for a waiter even when the shelf is full, so a
  // spawn is never starved by a pool that thinks it has enough.
  {
    const hh = poolHarness();
    await hh.fill();
    ok("the shelf is full", hh.pool.size === hh.k.TARGET);
    const got = hh.pool.take();
    ok("a spawn takes straight off a full shelf without waiting", typeof got === "string");
    ok("no challenge was needed for it", hh.pool.minting === 0);
  }
}

// ── 5 and 6. the two bot modules ───────────────────────────────────────────

function pt(x, y) {
  return {
    x: x, y: y,
    distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); },
    angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
  };
}

function mkMH(isReloaded) {
  const mh = {
    moduleActive: false, forceWeapon: null, shouldAttack: false, useAngle: null,
    move_dir: null, moveTo: "disable", _currentAngle: 0,
    _scanMissionActive: false, _autoFarmActive: false,
    moves: [],
    startMovement(a) { mh.move_dir = a; mh.moves.push(a); return true; },
    staticModules: { reloading: { isReloaded: isReloaded }, botRangedAttack: null },
    newTick() {
      mh.moduleActive = false;
      mh.forceWeapon = null;
      mh.shouldAttack = false;
      mh.useAngle = null;
      mh.moveTo = "disable";
      mh.moves = [];
    }
  };
  return mh;
}

function mkBot(mh, opts) {
  const bot = {
    isOwner: false, id: opts.id || 1, _ModuleHandler: mh,
    myPlayer: {
      inGame: true, tickCount: 0, hatID: opts.hatID || 0,
      resources: opts.resources || { food: 100, wood: 100, stone: 100, gold: 100 },
      inventory: { 0: 4, 1: opts.secondary === undefined ? 15 : opts.secondary },
      getItemByType(t) { return this.inventory[t]; },
      reload: [ { current: 10, max: 10 }, { current: 14, max: 14 }, { current: 23, max: 23 } ],
      pos: { current: pt(opts.x || 0, opts.y || 0) }
    }
  };
  bot.ownerClient = opts.owner || { isOwner: true, id: 0, getClientIndex: () => 0, clientList: () => [ bot ] };
  return bot;
}

function kiteScenario(opts) {
  let reloaded = opts.reloaded !== false;
  const mh = mkMH(() => reloaded);
  const ecur = pt(opts.enemyX === undefined ? 400 : opts.enemyX, 0);
  const enemy = opts.noEnemy ? null : { id: 700, pos: { current: ecur, future: ecur, previous: pt(ecur.x, 0) }, currentHealth: 100 };
  const m = build({
    Settings: {
      _botRangedKite: true, _botAutoAttackEnabled: true, _botAvoidShield: false,
      _botsFrozen: false, _botKiteDistance: 400
    },
    Possess: null,
    botPickTarget: () => ({ target: enemy, shielded: null, blockedBy: null }),
    botVolleyTurn: () => ({ mayFire: opts.mayFire !== false, wave: 0 })
  });
  const bot = mkBot(mh, opts);
  return { m: m, mh: mh, bot: bot, mod: new m.BotRangedAttack(bot), setReloaded: v => { reloaded = v; } };
}

function testKite() {
  section("5. BotRangedAttack: the weapon claim is scoped to the firing tick");
  const noStone = { food: 100, wood: 100, stone: 0, gold: 0 };
  const someStone = { food: 100, wood: 100, stone: 100, gold: 0 };

  {
    const s = kiteScenario({ resources: someStone });
    s.mh.newTick();
    s.mod.postTick();
    ok("a ready shot takes the weapon", s.mh.forceWeapon === 1 && s.mh.shouldAttack === true);
    ok("a ready shot claims the tick", s.mh.moduleActive === true);
    ok("a ready shot claims the movement", s.mod.active === true);
    ok("a ready shot aims", s.mh.useAngle !== null);
  }
  {
    const s = kiteScenario({ resources: someStone });
    s.setReloaded(false);
    s.mh.newTick();
    s.mod.postTick();
    ok("a reloading weapon is not taken", s.mh.forceWeapon === null && s.mh.shouldAttack === false);
    ok("a reloading weapon does not claim the tick", s.mh.moduleActive === false);
    ok("a reloading weapon still kites", s.mod.active === true);
    ok("a reloading weapon still aims", s.mh.useAngle !== null);
  }
  {
    const s = kiteScenario({ resources: { food: 100, wood: 100, stone: 9, gold: 0 } });
    s.mh.newTick();
    s.mod.postTick();
    ok("a musket one stone short is not fired", s.mh.forceWeapon === null && s.mh.shouldAttack === false);
    ok("a musket one stone short does not claim the tick", s.mh.moduleActive === false);
    ok("a musket one stone short still kites", s.mod.active === true);
  }
  {
    // The stuck state: the weapon reads ready forever because every shot the
    // server dropped left the reload untouched.
    const s = kiteScenario({ resources: noStone });
    let claimed = 0;
    for (let t = 0; t < 90; t++) {
      s.bot.myPlayer.tickCount = t;
      s.mh.newTick();
      s.mod.postTick();
      if (s.mh.moduleActive) claimed++;
    }
    ok("ninety ticks with no ammo never lock the tick", claimed === 0, "claimed=" + claimed);
  }
  {
    const s = kiteScenario({ resources: someStone, mayFire: false });
    s.mh.newTick();
    s.mod.postTick();
    ok("a held volley wave does not take the weapon", s.mh.forceWeapon === null);
    ok("a held volley wave does not lock the tick", s.mh.moduleActive === false);
    ok("a held volley wave keeps station", s.mod.active === true);
  }
  {
    // Backstop: shots that leave the reload untouched stand the weapon down
    // even when the ammo test says they should have worked.
    const s = kiteScenario({ resources: someStone });
    let fired = 0;
    for (let t = 0; t < 40; t++) {
      s.bot.myPlayer.tickCount = t;
      s.mh.newTick();
      s.mod.postTick();
      if (s.mh.shouldAttack) fired++;
    }
    ok("a weapon whose shots vanish is not re-fired every tick", fired < 12, "fired=" + fired + "/40");
    ok("the drop backstop engaged", s.mod.dropUntil > 0);
  }
  {
    // The normal cycle: the shot lands, the reload drops to zero and climbs.
    const s = kiteScenario({ resources: someStone });
    let fired = 0;
    for (let t = 0; t < 40; t++) {
      s.bot.myPlayer.tickCount = t;
      if (s.mh.shouldAttack) s.bot.myPlayer.reload[1].current = 0;
      else if (s.bot.myPlayer.reload[1].current < 14) s.bot.myPlayer.reload[1].current += 1;
      s.setReloaded(s.bot.myPlayer.reload[1].current >= 14);
      s.mh.newTick();
      s.mod.postTick();
      if (s.mh.shouldAttack) fired++;
    }
    ok("a normally firing weapon fires on its own cadence", fired >= 2, "fired=" + fired);
    ok("a normally firing weapon is never stood down", s.mod.dropUntil === 0 && s.mod.dropStreak === 0);
  }
  {
    const s = kiteScenario({ secondary: 10, resources: noStone });
    s.mh.newTick();
    s.mod.postTick();
    ok("a great hammer secondary is not kited at all", s.mod.active === false && s.mh.moduleActive === false);
  }
}

function missionScenario(opts) {
  const m = build({ Settings: { _botsFrozen: false }, Possess: null });
  const mh = mkMH(() => true);
  mh.staticModules.botRangedAttack = { active: !!opts.kiting };
  const owner = {
    isOwner: true, id: 0,
    _list: opts.fleet || [],
    clientList() { return this._list; },
    getClientIndex(c) { return this._list.indexOf(c); }
  };
  const bot = mkBot(mh, { id: opts.id || 1, x: opts.x, y: opts.y, owner: owner });
  if (opts.fleet) opts.fleet.push(bot);
  m.RynScan.setTarget(700, "Victim");
  m.RynScan.on = true;
  m.RynScan.found = true;
  m.RynScan.x = opts.tx;
  m.RynScan.y = opts.ty;
  m.RynScan.vx = 0;
  m.RynScan.vy = 0;
  m.RynScan.at = Date.now();
  m.RynScan.finder = opts.finder === "self" ? bot : null;
  return { m: m, mh: mh, bot: bot, mod: new m.BotScanMission(bot) };
}

function testMission() {
  section("6. BotScanMission: the converge");
  {
    const s = missionScenario({ x: 0, y: 0, tx: 5000, ty: 0 });
    s.mod.postTick();
    ok("a distant bot claims the mission", s.mh._scanMissionActive === true);
    ok("a distant bot walks toward the target", s.mh.moves.length === 1 && Math.abs(s.mh.moves[0]) < .01, "heading=" + s.mh.moves[0]);
  }
  {
    const s = missionScenario({ x: 5000 - 170, y: 0, tx: 5000, ty: 0 });
    s.mod.postTick();
    ok("an arrived bot still holds the mission claim", s.mh._scanMissionActive === true);
    ok("an arrived bot faces the target", Math.abs(s.mh._currentAngle) < .01);
  }
  {
    const s = missionScenario({ x: 0, y: 0, tx: 5000, ty: 0, finder: "self" });
    s.mod.postTick();
    ok("the finder takes the mission too", s.mh._scanMissionActive === true);
    s.bot.myPlayer.pos.current.x = 5000 - 80;
    s.mh.newTick();
    s.mod.postTick();
    ok("the finder settles at the inner radius", s.mh.moves.length === 0 || s.mh.moves[0] === null, JSON.stringify(s.mh.moves));
  }
  {
    const fleet = [];
    const headings = new Set();
    for (let i = 0; i < 4; i++) {
      const s = missionScenario({ id: i + 1, x: 0, y: 0, tx: 5000, ty: 5000, fleet: fleet });
      s.mod.postTick();
      headings.add(Math.round(s.mh.moves[0] * 1e3));
    }
    ok("four bots take four different approach headings", headings.size === 4, "headings=" + [ ...headings ].join(","));
  }
  {
    const s = missionScenario({ x: 0, y: 0, tx: 5000, ty: 0, kiting: true });
    s.mod.postTick();
    ok("a bot already kiting the target is left to kite", s.mh._scanMissionActive === false && s.mh.moves.length === 0);
  }
  {
    const s = missionScenario({ x: 0, y: 0, tx: 5000, ty: 0 });
    s.mod.postTick();
    ok("claim taken", s.mh._scanMissionActive === true);
    s.m.RynScan.found = false;
    s.mh.newTick();
    s.mod.postTick();
    ok("losing the target releases the claim", s.mh._scanMissionActive === false);
    ok("releasing the claim stops the bot walking", s.mh.moves[s.mh.moves.length - 1] === null);
  }
  {
    const s = missionScenario({ x: 0, y: 0, tx: 5000, ty: 0 });
    s.mod.postTick();
    s.m.RynScan.off();
    s.mh.newTick();
    s.mod.postTick();
    ok("switching the scan off releases the claim", s.mh._scanMissionActive === false);
  }
}

// ── run ────────────────────────────────────────────────────────────────────

(async () => {
  testAmmo();
  testDex();
  testScan();
  await testPool();
  testKite();
  testMission();
  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail === 0 ? 0 : 1);
})();
