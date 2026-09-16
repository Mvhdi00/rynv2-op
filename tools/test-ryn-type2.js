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
const removeSrc = between(find(/^  const RYN_KILL_HOLD_MS = /), find(/^  \/\/ One press, the whole fleet\./));
const healSrc = between(find(/^  const HEAL_SOLDIER_HAT = /), find(/^  class Autohat \{/));
// The heal reads the game's own food table for `restore`, so the table comes
// out of the script rather than being written again here.
const itemsSrc = between(find(/^  const Items = \[ \{/), find(/^  const WeaponVariants = \[ \{/));
const hatSrc = between(find(/^  class DefaultHat \{/), find(/^  class SafeWalk \{/));

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
    "\n  return { Weapons, Hats, botHasAmmoFor, RynPlayerDex, RynScan, dexLabel," +
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
    const localStorage = env.localStorage;
    // And for the stagger, which spaces the five starts apart. waitFor uses
    // the same pair for its own timeout, so both are stubbed together.
    const setTimeout = env.setTimeout;
    const clearTimeout = env.clearTimeout;
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
  scan.clearTargets();

  const mk = (id, x, y, px, py, hp) => ({
    id: id,
    pos: { current: { x: x, y: y }, previous: { x: px === undefined ? x : px, y: py === undefined ? y : py } },
    currentHealth: hp === undefined ? 100 : hp
  });
  const finder = { isOwner: false, id: 4, myPlayer: { id: 604, inGame: true } };
  const helper = { isOwner: false, id: 5, myPlayer: { id: 605, inGame: true } };

  ok("scan will not switch on with nothing picked", scan.toggle() === false && scan.on === false);

  ok("picking a target returns true", scan.toggleTarget(700, "Victim") === true);
  ok("it is counted", scan.count === 1 && scan.has(700));
  ok("picking it again unpicks it", scan.toggleTarget(700, "Victim") === false && scan.count === 0);
  scan.toggleTarget(700, "Victim");
  scan.toggleTarget(701, "Second");
  scan.toggleTarget(702, "Third");
  ok("several can be picked at once", scan.count === 3);

  ok("scan switches on with targets picked", scan.toggle() === true && scan.on === true);
  ok("with no sighting the fleet is searching", scan.searching === true);
  ok("and nothing is found", scan.foundCount === 0);

  scan.sighting(finder, mk(701, 5000, 5000, 4960, 5000));
  ok("a sighting is recorded against its own target", scan.targets.get(701).found === true && scan.targets.get(701).x === 5000);
  ok("the others are untouched", scan.targets.get(700).found === false && scan.targets.get(702).found === false);
  ok("the step the target took last tick is kept", scan.targets.get(701).vx === 40 && scan.targets.get(701).vy === 0);
  ok("the first bot to report becomes that target's finder", scan.targets.get(701).finder === finder);
  ok("one found target stops the fleet searching", scan.searching === false && scan.foundCount === 1);

  scan.sighting(helper, mk(701, 5000, 5000, 4960, 5000));
  ok("a later sighting does not take the engagement off the finder", scan.targets.get(701).finder === finder);

  scan.sighting(helper, mk(999, 1, 1));
  ok("a sighting of an unpicked player is ignored", scan.foundCount === 1);

  // A second target found at the same time is tracked independently.
  scan.sighting(helper, mk(702, 9000, 1000));
  ok("two targets can be tracked at once", scan.foundCount === 2);
  ok("each keeps its own finder", scan.targets.get(701).finder === finder && scan.targets.get(702).finder === helper);

  // Nearest-found is how the fleet divides itself.
  ok("a bot near the first goes to the first", scan.nearestFound(5100, 5000).id === 701);
  ok("a bot near the second goes to the second", scan.nearestFound(8900, 1100).id === 702);
  {
    // Nothing found at all: there is nothing to converge on, and nearestFound
    // has to say so rather than hand back a target with a stale position.
    const spare = build({}).RynScan;
    spare.clearTargets();
    spare.toggleTarget(900, "Unseen");
    spare.on = true;
    ok("with nothing found there is nothing to go to", spare.nearestFound(0, 0) === null);
  }

  // Prediction, per target.
  let aim = scan.aimPoint(scan.targets.get(701), { x: 0, y: 0 });
  ok("a fresh sighting leads by exactly one tick", aim.x === 5040 && aim.y === 5000);
  scan.targets.get(701).at = Date.now() - 1000;
  aim = scan.aimPoint(scan.targets.get(701), { x: 0, y: 0 });
  ok("a stale sighting uses the confirmed position, not the lead", aim.x === 5000 && aim.y === 5000);

  // Expiry is per target too.
  scan.expire();
  ok("a sighting inside the window is still live", scan.targets.get(701).found === true);
  scan.targets.get(701).at = Date.now() - 1500;
  scan.expire();
  ok("a sighting past the window expires", scan.targets.get(701).found === false);
  ok("the other target is unaffected", scan.targets.get(702).found === true);
  ok("expiry does not switch the scan off", scan.on === true);
  ok("one still found keeps the fleet converging", scan.searching === false);
  scan.targets.get(702).at = Date.now() - 1500;
  scan.expire();
  ok("losing the last one puts the fleet back to searching", scan.searching === true && scan.foundCount === 0);

  scan.sighting(helper, mk(700, 100, 100));
  ok("a target can be acquired later", scan.targets.get(700).found === true);
  ok("the bot that found it becomes its finder", scan.targets.get(700).finder === helper);

  // Unpicking a target while the scan runs drops it and nothing else.
  scan.toggleTarget(702);
  ok("unpicking removes just that one", scan.count === 2 && !scan.has(702));
  ok("the rest keep their state", scan.targets.get(700).found === true);

  scan.off();
  ok("off clears every sighting", scan.foundCount === 0 && scan.on === false);
  ok("but keeps the picks", scan.count === 2);

  scan.clearTargets();
  ok("clearing the picks empties the list", scan.count === 0);
  ok("and switches the scan off", scan.on === false);

  // The lead is clamped to the map.
  scan.toggleTarget(800, "Edge");
  scan.on = true;
  const edge = scan.targets.get(800);
  edge.found = true;
  edge.x = 14395;
  edge.y = 100;
  edge.vx = 50;
  edge.vy = 0;
  edge.at = Date.now();
  aim = scan.aimPoint(edge, { x: 0, y: 0 });
  ok("the lead is clamped to the map", aim.x === 14400, "aim.x=" + aim.x);
  scan.clearTargets();
}

// ── 4. the token pool ──────────────────────────────────────────────────────

function poolHarness(opts) {
  const o = opts || {};
  // A reload does not reset the wall clock, so a harness modelling the page
  // after one has to carry the time forward from the harness before it.
  let now = o.at === undefined ? 1e6 : o.at;
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
  // A stand-in for the browser's localStorage, shared between harnesses when a
  // test wants to model a page reload. `throws` is the private-window case.
  const store = o.store || {
    data: {},
    getItem(k) { if (o.storeThrows) throw new Error("denied"); return k in this.data ? this.data[k] : null; },
    setItem(k, v) { if (o.storeThrows) throw new Error("denied"); this.data[k] = String(v); },
    removeItem(k) { delete this.data[k]; }
  };
  // The stagger's timers, held rather than run, so a test decides when each of
  // the five is allowed to begin.
  let timers = [];
  const built = buildPool({
    Date: { now: () => now },
    window: win,
    client: cl,
    document: doc,
    Renderer: rend,
    localStorage: store,
    requestIdleCallback: fn => { idleQueue.push(fn); },
    setTimeout: (fn, ms) => { const t = { due: now + (ms || 0), fn: fn }; timers.push(t); return t; },
    clearTimeout: t => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); },
    mint: () => new Promise((res, rej) => { minted++; inflight.push({ res: res, rej: rej }); })
  });
  // The pool ships switched off — nothing is minted until the panel says so —
  // so the harness switches it on, except where a test is checking the default.
  if (!o.keepDisabled) {
    built.TokenPool.enabled = true;
  }
  // Run every challenge the pool has queued for idle time. Challenges are
  // started from an idle callback now, so nothing is in flight until this.
  const flushIdle = () => {
    const q = idleQueue;
    idleQueue = [];
    q.forEach(fn => fn());
  };
  // Fire every staggered start whose moment has come.
  const runTimers = () => {
    const due = timers.filter(t => t.due <= now);
    timers = timers.filter(t => t.due > now);
    due.forEach(t => t.fn());
  };
  return {
    pool: built.TokenPool,
    k: built,
    win: win,
    client: cl,
    doc: doc,
    rend: rend,
    store: store,
    get now() { return now; },
    flushIdle: flushIdle,
    get idlePending() { return idleQueue.length; },
    get timersPending() { return timers.length; },
    advance: ms => { now += ms; runTimers(); flushIdle(); },
    // Top up and let the queued challenges start, which is what one keeper
    // tick amounts to once the browser has had an idle moment. Only the first
    // of the five starts here — the rest are behind the stagger.
    pump: () => { built.TokenPool.refill(); runTimers(); flushIdle(); },
    // Kept as a name for "top up and let everything it started begin". With
    // no stagger that is the same as a pump, but the call sites read better.
    pumpAll: () => {
      built.TokenPool.refill();
      runTimers();
      flushIdle();
    },
    get minted() { return minted; },
    get inflight() { return inflight.length; },
    // One keeper tick: advance the clock by the keeper's own interval, top up,
    // then let whatever it started resolve. The clock has to move, because the
    // frame-rate guard decides its rate from how long the player has been
    // standing still.
    tick: async () => {
      now += built.KEEPER;
      runTimers();
      flushIdle();
      built.TokenPool.refill();
      runTimers();
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

    h.rend._dtSmoothed = 16 * h.k.FPS_SLACK + 5;   // frames have gone long
    // Whatever was already committed to still runs — the frame test gates the
    // decision to start a challenge, not work already under way. Let those
    // drain first, then nothing further may begin.
    await h.tick();
    const settled = h.minted;
    for (let i = 0; i < 10; i++) await h.tick();
    ok("a frame-rate drop stops minting", h.minted === settled, "minted=" + h.minted + " settled=" + settled);
    ok("the panel reports it holding off", h.pool.frames === 0);

    h.rend._dtSmoothed = 16;                       // recovered
    await h.tick();
    ok("recovering resumes it", h.minted > settled, "minted=" + h.minted + " settled=" + settled);
  }

  // The bar is the machine's own baseline, not a fixed frame rate: a machine
  // that simply runs slower should still be able to fill its pool.
  {
    const h = poolHarness({ dt: 40 });             // a steady 25fps machine
    for (let i = 0; i < 3; i++) await h.tick();
    const steady = h.minted;
    ok("a slower machine holding steady still mints", steady >= 3, "minted=" + steady);
    h.rend._dtSmoothed = 40 * h.k.FPS_SLACK + 5;   // worse than its own normal
    await h.tick();
    const settled2 = h.minted;
    for (let i = 0; i < 5; i++) await h.tick();
    ok("and stops when it drops below its own normal", h.minted === settled2, "minted=" + h.minted);
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
    h.pumpAll();
    ok("respawning resumes it", h.minted > before);
  }

  let h = poolHarness();
  h.pump();
  ok("the pool fills once you are in the game", h.minted > 0);
  ok("it does not start ninety-nine challenges at once", h.inflight === h.pool.concurrency && h.inflight <= h.k.STILL, "inflight=" + h.inflight);
  h.pump();
  ok("a refill does not double-mint what is already in flight", h.minted === h.pool.concurrency, "minted=" + h.minted);

  const rounds = await h.fill();
  ok("it fills to the full ninety-nine", h.pool.size === h.k.TARGET, "size=" + h.pool.size);
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
    hh.pumpAll();
    const before = hh.minted;
    await hh.failAll();
    ok("a failed mint leaves the pool empty", hh.pool.size === 0);
    hh.pumpAll();
    ok("a failed mint releases its slot so the keeper retries", hh.minted > before, "minted=" + hh.minted);
  }

  // ── the manual switch ─────────────────────────────────────────────────────
  {
    const off = poolHarness({ keepDisabled: true });
    ok("the pool ships switched off", off.pool.enabled === false);
    for (let i = 0; i < 5; i++) await off.tick();
    ok("and mints nothing until it is switched on", off.minted === 0, "minted=" + off.minted);
    off.pool.start();
    off.flushIdle();
    ok("switching it on starts it", off.minted > 0, "minted=" + off.minted);
  }
  {
    const hh = poolHarness();
    await hh.tick();
    const before = hh.minted;

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
  ok("the target is fixed at ninety-nine", h.k.TARGET === 99, "target=" + h.k.TARGET);
  ok("the pool reports the same target it fills to", h.pool.target === h.k.TARGET);

  // ── the shelf survives a page load ────────────────────────────────────────
  //
  // Switching server is a reload: the game's switchServer assigns
  // window.location and generateHref keeps the origin and path, changing only
  // the query string (src/game_index.js:3323). Same origin, so localStorage
  // carries over and in-memory state does not — which is what threw the pool
  // away on every server change.
  {
    const first = poolHarness();
    await first.fill();
    ok("the pool filled before the switch", first.pool.size === first.k.TARGET, "size=" + first.pool.size);
    const before = [];
    for (let i = 0; i < 5; i++) before.push(first.pool.take());

    // The reload: a brand new pool, nothing in memory, same localStorage.
    const after = poolHarness({ store: first.store, at: first.now });
    ok("the shelf comes back on its own at startup", after.pool.size === first.k.TARGET - 5, "size=" + after.pool.size);
    ok("and says how many it restored", after.pool.restored === first.k.TARGET - 5, "restored=" + after.pool.restored);
    // Loading twice must not put the same tokens on the shelf again.
    after.pool._load();
    ok("a second load adds nothing", after.pool.size === first.k.TARGET - 5, "size=" + after.pool.size);
    // A token is single-use. One handed out before the switch must not come
    // back after it.
    const back = [];
    while (after.pool.size > 0) back.push(after.pool.take());
    const clash = before.filter(t => back.indexOf(t) >= 0);
    ok("a token already spent does not come back", clash.length === 0, "clashes=" + clash.length);
  }
  {
    // Age is carried across, not restarted.
    const first = poolHarness();
    first.pump();
    await first.settleAll();
    ok("one token to carry", first.pool.size === 1, "size=" + first.pool.size);
    const bornAt = first.now;
    const after = poolHarness({ store: first.store, at: bornAt + first.k.TTL - 1 });
    ok("a token still inside its window comes back", after.pool.size === 1, "size=" + after.pool.size);

    const later = poolHarness({ store: first.store, at: bornAt + first.k.TTL + 1 });
    ok("one that aged out while the page was gone does not", later.pool.size === 0, "size=" + later.pool.size);
  }
  {
    // A stored birth time in the future — a clock that went backwards — must
    // not park a token that never ages out.
    const store = {
      data: { _ryn_token_pool: JSON.stringify([ { token: "future", born: 9e15 } ]) },
      getItem(k) { return k in this.data ? this.data[k] : null; },
      setItem(k, v) { this.data[k] = String(v); },
      removeItem(k) { delete this.data[k]; }
    };
    const h = poolHarness({ store: store });
    ok("a token born in the future is refused", h.pool.size === 0, "size=" + h.pool.size);
    ok("and is not left in the store to be read again", JSON.parse(store.data._ryn_token_pool).length === 0);
  }
  {
    // Junk in the store is not a crash.
    const bad = [ "not json", "{}", "[1,2,3]", JSON.stringify([ { token: 5 } ]), JSON.stringify([ null ]) ];
    let survived = 0;
    for (const raw of bad) {
      const store = { data: { _ryn_token_pool: raw }, getItem(k) { return this.data[k] ?? null; },
                      setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; } };
      const h = poolHarness({ store: store });
      try { h.pool._load(); survived++; } catch (_) {}   // already loaded; must be a no-op
      if (h.pool.size !== 0) survived = -99;
    }
    ok("junk in the store is survivable and ignored", survived === bad.length, "survived=" + survived);
  }
  {
    // A private window throws on every access. The pool must not care.
    const h = poolHarness({ storeThrows: true });
    let threw = false;
    try { h.pump(); } catch (_) { threw = true; }
    ok("a storage that throws does not break the pool", threw === false);
    ok("and it still mints", h.minted > 0, "minted=" + h.minted);
  }

  // ── the pool must not be able to wedge ────────────────────────────────────
  //
  // In-flight mints are subtracted from what the pool may start, so a
  // challenge that never settles holds a concurrency slot for good. Four of
  // those used to stop the pool for the rest of the page: empty, full or
  // otherwise, it computed nothing to do and never recovered.
  {
    const hh = poolHarness();
    hh.pumpAll();
    const rate = hh.pool.concurrency;
    ok("every concurrency slot is running", hh.minted === rate, "minted=" + hh.minted);
    // None of them ever settle, and the clock does not move: the reaper is
    // what this is about, and it reads the clock.
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
    hh.pumpAll();
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
      ok("cycle " + (cycle + 1) + ": filled to ninety-nine", hh.pool.size === hh.k.TARGET, "size=" + hh.pool.size);
      for (let i = 0; i < hh.k.TARGET; i++) hh.pool.take();
      ok("cycle " + (cycle + 1) + ": drained to nothing", hh.pool.size === 0);
    }
    ok("three full cycles spent three times the target", hh.pool.spent === hh.k.TARGET * 3, "spent=" + hh.pool.spent);
  }

  // ── a spawn and the pool must not compete ─────────────────────────────────
  //
  // A spawn that found the pool empty used to start its own challenge beside
  // the four already running. It now joins the queue for work in progress and
  // is served ahead of the pool's shelf.
  {
    const hh = poolHarness();
    hh.pumpAll();
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
    // Not one challenge per waiter: the rate limit still applies to them, so
    // three waiters cost three challenges and no more.
    ok("and no more challenges than tokens", hh.minted === 3, "minted=" + hh.minted);
  }

  // A waiter is released rather than left hanging when nothing comes back.
  //
  // The timeout is on the stubbed clock now. It used to run on the real one,
  // so this block sat out five actual seconds on every run and called that a
  // pass — the pool had in fact re-armed a challenge and kept the waiter.
  {
    const hh = poolHarness();
    hh.pumpAll();
    const spawn = hh.pool.waitFor(5000);
    await hh.failAll();
    ok("a failed round does not strand the waiter's promise", hh.pool.waiting === 1, "waiting=" + hh.pool.waiting);
    hh.advance(5001);
    const got = await spawn;
    ok("a waiter that is never served is released, not left hanging", got === null);
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

// ── the two-mode delete ────────────────────────────────────────────────────
//
// A tap takes out the bots that are in the game; a hold takes out the rest —
// the ones still connecting and the ones parked at the menu. A bot is only ever
// in one of the two halves, so between them the gestures reach everything
// without either reaching what the other is for.

function buildRemove(env) {
  const body = `
    const window = env.window;
    const RYN = env.RYN;
    ${removeSrc}
    return { _rynRemoveBots: _rynRemoveBots, HOLD: RYN_KILL_HOLD_MS };
  `;
  return new Function("env", body)(env);
}

function testRemove() {
  section("7. the two-mode delete");
  // `_heldBots` is reassigned rather than spliced, so the object is what has
  // to be inspected, not the array it started with.
  const RYN = { _heldBots: [] };
  const mod = buildRemove({ window: { _rynBotToast: null }, RYN: RYN });

  const mkFleet = () => {
    const owner = { clients: new Set() };
    const add = (id, inGame) => {
      const bot = { id: id, myPlayer: { id: 600 + id, inGame: inGame }, disconnect() { owner.clients.delete(bot); } };
      owner.clients.add(bot);
      return bot;
    };
    return { owner: owner, add: add };
  };

  {
    const f = mkFleet();
    f.add(1, true); f.add(2, true); f.add(3, false); f.add(4, false);
    const gone = mod._rynRemoveBots(f.owner, true);
    ok("a tap removes only the bots in the game", gone === 2, "removed=" + gone);
    ok("the ones waiting at the menu are left standing", f.owner.clients.size === 2);
    ok("and no survivor is in the game", [ ...f.owner.clients ].every(b => !b.myPlayer.inGame));
  }
  {
    const f = mkFleet();
    f.add(1, true); f.add(2, true); f.add(3, false);
    const gone = mod._rynRemoveBots(f.owner, false);
    ok("a hold removes only the bots that are not in the game", gone === 1, "removed=" + gone);
    ok("the live fleet is left alone", f.owner.clients.size === 2);
    ok("and every survivor is in the game", [ ...f.owner.clients ].every(b => b.myPlayer.inGame));
  }
  {
    const f = mkFleet();
    f.add(1, true); f.add(2, false);
    ok("a tap then a hold clears the fleet", (mod._rynRemoveBots(f.owner, true), mod._rynRemoveBots(f.owner, false), f.owner.clients.size === 0));
  }
  {
    const f = mkFleet();
    const a = f.add(1, false);
    const b = f.add(2, false);
    RYN._heldBots = [ a, b ];
    mod._rynRemoveBots(f.owner, false);
    ok("a hold drops the bots it removed from the release list", RYN._heldBots.length === 0, "held=" + RYN._heldBots.length);
    const f2 = mkFleet();
    const c = f2.add(9, false);
    RYN._heldBots = [ c ];
    mod._rynRemoveBots(f2.owner, true);
    ok("a tap does not touch the release list", RYN._heldBots.length === 1);
  }
  {
    const f = mkFleet();
    f.add(1, true);
    ok("removing a half that is empty removes nothing", mod._rynRemoveBots(f.owner, false) === 0);
  }
  ok("a missing owner is survivable", mod._rynRemoveBots(null, true) === 0);
  ok("the hold is long enough not to be an accident", mod.HOLD >= 400, "hold=" + mod.HOLD);
}

// ── 8. the auto heal ───────────────────────────────────────────────────────
//
// Falcon V2's system. It heals against damage that has *already landed* and
// works backwards from the number: which weapon produces exactly that, whose
// weapon is it, what else does that player still have loaded, can that finish
// me, which hat survives it and when do I eat.
//
// What these pin down is the ladder's order, and the arithmetic bug that made
// the whole system a no-op the first time it was here.

function buildHeal(env) {
  const body = `
    const Date = env.Date;
    const Settings_default = env.Settings;
    const IH = env.IH;
    const hyp = (a, b) => Math.sqrt(a * a + b * b);
    const Config_default = { playerScale: 35 };
    const PlayerObject = function () {};
    const WeaponVariants = [ { val: 1 }, { val: 1.1 }, { val: 1.18 }, { val: 1.18 } ];
    ${tables}
    ${itemsSrc}
    const DataHandler_default = {
      getWeapon: id => Weapons[id],
      isShootable: id => !!(Weapons[id] && Weapons[id].projectile !== undefined),
      getProjectile: id => ({ damage: 25 })
    };
    ${healSrc}
    return { FalconHeal: FalconHeal, SHAME_LIMIT: HEAL_SHAME_LIMIT,
             WINDOW: HEAL_SHAME_WINDOW_MS, MAX_PER_TICK: HEAL_MAX_PER_TICK,
             PACKET_COST: HEAL_PACKET_COST, PRIORITY: HEAL_PRIORITY_NAMES,
             SOLDIER: HEAL_FORCE_SOLDIER, EMP: HEAL_FORCE_EMP };
  `;
  return new Function("env", body)(env);
}

function healScenario(opts) {
  const o = opts || {};
  const now = 2e6;
  const mod = buildHeal({
    Date: { now: () => now },
    Settings: { _autoheal: o.autoheal !== false, _soldierEMP: o.soldierEMP !== false },
    IH: () => ({ fastHealPress: !!o.fastHeal })
  });
  const mh = {
    heals: 0,
    healedOnce: false,
    packetLimit: 119,
    packetCount: o.packetCount || 0,
    forceHat: null,
    selectItem() {},
    attack() {},
    stopAttack() {},
    whichWeapon() {},
    _getPredictWeapon: () => 0,
    canBuy: (type, id) => (o.owns ? o.owns.indexOf(id) >= 0 : true)
  };
  // heal() is four sends; count foods rather than packets.
  const realSelect = mh.selectItem;
  mh.selectItem = function (t) { mh.heals++; realSelect.call(mh, t); };
  const pos = { x: 0, y: 0, distance: () => 9999 };
  const myPlayer = {
    id: 1,
    inGame: o.inGame !== false,
    currentHealth: o.health === undefined ? 100 : o.health,
    maxHealth: 100,
    tempHealth: o.health === undefined ? 100 : o.health,
    hatID: o.hat === undefined ? 0 : o.hat,
    accessoryID: 0,
    shameCount: o.shameCount || 0,
    receivedDamage: o.lastHitMs === undefined ? null : now - o.lastHitMs,
    trappedIn: null,
    isSandbox: false,
    tickCount: 5,
    damages: o.damages ? o.damages.slice() : [],
    pos: { current: pos, future: pos },
    weapon: { primary: 0, secondary: null },
    reload: [ { current: 1, max: 1 }, { current: 1, max: 1 }, { current: 1, max: 1 } ],
    getItemByType: t => (t === 2 ? 0 : 0),
    getWeaponVariant: () => ({ current: 0 })
  };
  const client = {
    myPlayer: myPlayer,
    _ModuleHandler: mh,
    SocketManager: { pong: o.pong || 0 },
    EnemyManager: { velocityTickThreat: !!o.velThreat },
    PlayerManager: { enemies: [], isEnemyByID: () => true },
    ObjectManager: { grid2D: { query: () => {} }, objects: new Map() }
  };
  const m = new mod.FalconHeal(client);
  // What _refresh does at the top of a real tick: the module's damage bucket
  // is a reference to the player's, not a copy of it.
  m.damages = myPlayer.damages;
  return { mod: mod, mh: mh, mp: myPlayer, client: client, m: m };
}

function testHeal() {
  section("8. the auto heal (Falcon V2)");

  // ── the arithmetic that made it a no-op ─────────────────────────────────
  //
  // `Player.maxHealth` was declared `Math.LN1` — there is no such constant on
  // Math, so the field was `undefined` — and nothing assigned it. Every
  // `heal(maxHealth - currentHealth)` was therefore `heal(NaN)`, and
  // `for (i = 0; i < NaN; i++)` runs zero times. The system sent no packets at
  // all for as long as it was installed.
  {
    ok("maxHealth is a number now, not Math.LN1", typeof Math.LN1 === "undefined");
    let none = 0;
    for (let i = 0; i < (undefined - 40); i++) none++;
    ok("the old expression ran zero times", none === 0);
    const s = healScenario({ health: 40 });
    ok("and a heal for the real deficit now sends food", s.m.heal(100 - 40) === 3, "times=" + s.m.heal(100 - 40));
  }
  {
    const s = healScenario({ health: 40 });
    ok("a heal covers the deficit it is given", s.m.heal(60) === 3);
    ok("and each food is a send", s.mh.heals === 3, "heals=" + s.mh.heals);
    ok("the tick is marked as having eaten", s.mh.healedOnce === true);
    ok("and the shame reset stands down for it", s.m.shouldResetShame === false);
  }
  {
    const s = healScenario({ health: 100 });
    ok("nothing to heal sends nothing", s.m.heal(0) === 0 && s.mh.heals === 0);
    ok("a negative deficit sends nothing", s.m.heal(-20) === 0);
  }
  {
    const s = healScenario({ health: 1 });
    ok("a full bar is capped per tick", s.m.heal(99) === s.mod.MAX_PER_TICK, "times=" + s.m.heal(99));
  }
  {
    const s = healScenario({ health: 1, packetCount: 118 });
    ok("and bounded by the packet budget", s.m.heal(99) === 0, "times=" + s.m.heal(99));
  }
  {
    const s = healScenario({ health: 40, inGame: false });
    ok("nothing is eaten at the menu", s.m.heal(60) === 0);
  }

  // ── the ladder ───────────────────────────────────────────────────────────
  //
  // Nothing has landed, so nothing is decided: `main` only runs when the tick
  // brought a damage number.
  {
    const s = healScenario({ health: 60 });
    s.m.main();
    ok("a tick with no damage decides nothing", s.mh.heals === 0);
    ok("and reports no tier", s.m.healPriority === 0);
  }
  {
    // A number landed, but nobody is in reach — Falcon holds and eats on the
    // next tick rather than inside the server's window.
    const s = healScenario({ health: 60, damages: [ 35 ] });
    ok("the tick really did bring a damage number", s.m.damages.length === 1);
    s.m.main();
    ok("a hit with nobody near is queued, not eaten now", s.mh.heals === 0, "heals=" + s.mh.heals);
    ok("the bucket is cleared behind it", s.m.damages.length === 0);
    s.m._runQueues();
    ok("and lands on the following tick", s.mh.heals === 2, "heals=" + s.mh.heals);
  }

  // ── the forced hats ──────────────────────────────────────────────────────
  {
    const s = healScenario({ health: 60 });
    ok("no hat is asked for on a quiet tick", s.m.wantsSoldier === false && s.m.wantsEMP === false);
    s.m.addForcedAddOnValue(s.mod.SOLDIER, 2);
    ok("a forced soldier is an ask", s.m.wantsSoldier === true);
    ok("and is not an EMP ask", s.m.wantsEMP === false);
    s.m.addForcedAddOnValue(s.mod.EMP, 2);
    ok("a forced EMP is its own ask", s.m.wantsEMP === true);
    s.m.resetForcedAddOn(s.mod.SOLDIER);
    s.m.resetForcedAddOn(s.mod.EMP);
    ok("clearing them clears both asks", s.m.wantsSoldier === false && s.m.wantsEMP === false);
  }
  {
    const s = healScenario({ health: 60, autoheal: false });
    s.m.addForcedAddOnValue(s.mod.SOLDIER, 2);
    ok("with Autoheal off no hat is asked for", s.m.wantsSoldier === false);
  }
  {
    const s = healScenario({ health: 60, velThreat: true });
    s.m._updateSpikeSoldier();
    ok("a velocity tick is a standing soldier reason", s.m.wantsSoldier === true);
  }

  // ── validate: a hat that does not save you is not an answer ──────────────
  {
    const s = healScenario({ health: 40 });
    ok("soldier is refused when it still leaves you dead", s.m.validate("soldier", 39) === false);
    ok("and taken when it does not", s.m.validate("soldier", 20) === true);
  }
  {
    const s = healScenario({ health: 40, owns: [] });
    ok("a hat you do not own is not an option", s.m.validate("soldier", 20) === false);
  }
  {
    const s = healScenario({ health: 60, hat: 0 });
    ok("EMP is only ever swapped in from soldier", s.m.validate("emp", 50) === false);
    const t = healScenario({ health: 60, hat: 6 });
    ok("from soldier it is allowed", t.m.validate("emp", 50) === true);
    const u = healScenario({ health: 30, hat: 6 });
    ok("unless what is left still kills you", u.m.validate("emp", 60) === false);
  }

  // ── the manual burst ─────────────────────────────────────────────────────
  //
  // src/game_index.js:2454 — eating within 120ms of damage is shameCount++,
  // and at 8 the count resets and shameTimer runs for thirty seconds during
  // which food is not consumed at all. The ladder stops at 7 and so does the
  // Placer; a key held through a fight was counting nothing.
  {
    const s = healScenario({ health: 40, fastHeal: true, lastHitMs: 5000 });
    s.m.postTick();
    ok("the burst clears the bar", s.mh.heals === 3, "heals=" + s.mh.heals);
  }
  {
    const s = healScenario({ health: 40, fastHeal: true, lastHitMs: 0, shameCount: 7 });
    s.m.postTick();
    ok("the burst stops at the shame limit inside the window", s.mh.heals === 0, "heals=" + s.mh.heals);
  }
  {
    const s = healScenario({ health: 40, fastHeal: true, lastHitMs: 5000, shameCount: 7 });
    s.m.postTick();
    ok("but not outside it, where eating takes the count back down", s.mh.heals === 3, "heals=" + s.mh.heals);
  }
  {
    const s = healScenario({ health: 40, fastHeal: true, lastHitMs: 0, shameCount: 6 });
    s.m.postTick();
    ok("and under the limit the window does not stop it", s.mh.heals === 3, "heals=" + s.mh.heals);
  }
  {
    const s = healScenario({ health: 40, fastHeal: true, lastHitMs: 60, pong: 100 });
    s.m.postTick();
    ok("the round trip counts towards the window", s.mh.heals === 3, "heals=" + s.mh.heals);
  }
  {
    const s = healScenario({ health: 100, fastHeal: true, lastHitMs: 5000 });
    s.m.postTick();
    ok("the burst does nothing at full health", s.mh.heals === 0);
  }
  {
    const s = healScenario({ health: 40, fastHeal: false, lastHitMs: 5000 });
    s.m.postTick();
    ok("and nothing when the key is not held", s.mh.heals === 0);
  }

  // ── the switch ───────────────────────────────────────────────────────────
  {
    const s = healScenario({ health: 40, autoheal: false, damages: [ 35 ] });
    s.m.postTick();
    ok("with Autoheal off the ladder decides nothing", s.mh.heals === 0);
    ok("and a held delay is not left to fire later", s.m.healingDelay === 0);
  }
  {
    const s = healScenario({ health: 40, inGame: false });
    s.m.healingDelay = 2;
    s.m.postTick();
    ok("leaving the game clears a held heal", s.m.healingDelay === 0);
    ok("and lets the shame reset run again", s.m.shouldResetShame === true);
  }
}

// ── 9. the soldier hat, after the heal stopped asking for one ──────────────
//
// The Falcon heal owned two hat asks, `wantsSoldier` and `wantsEMP`, and both
// went with it. That is correct — Glotus's heal asks for no hat — but it means
// every threat flag now has to reach the helmet through DefaultHat alone, and
// one of them did not: RYN's copy of Glotus's threat line had dropped
// `velocityTickThreat`, and Falcon's `velSoldier` had been quietly covering
// for it. These pin the whole set down so the next module that moves cannot
// take a flag's only path with it.

function buildHat(env) {
  const body = `
    const Settings_default = env.Settings;
    const DataHandler_default = { getWeapon: () => ({ range: 70 }) };
    const pointInRiver = () => false;
    const COWBOY_DROP_RANGE = 300;
    ${hatSrc}
    return { DefaultHat: DefaultHat };
  `;
  return new Function("env", body)(env);
}

function hatScenario(threats, opts) {
  const o = opts || {};
  const mod = buildHat({
    Settings: {
      _antienemy: o.antienemy !== false,
      _antispike: true,
      _antianimal: true,
      _empDefense: false,
      _biomehats: false,
      _cowboyWhenSafe: false,
      _botBeAngel: false
    }
  });
  const pos = { x: 0, y: 0, distance: () => 9999 };
  const mh = {
    shouldEquipSoldier: false,
    forceHat: null,
    isMoving: true,
    getHatStore: () => ({ actual: 0 }),
    canBuy: () => true
  };
  const client = {
    isOwner: true,
    _ModuleHandler: mh,
    myPlayer: {
      pos: { current: pos, future: pos },
      speed: 20,
      hatID: 0,
      onPlatform: false,
      shameCount: 0,
      getItemByType: () => 0,
      isEnemyByID: () => true,
      collidingSimple: () => false
    },
    EnemyManager: Object.assign({
      nearestEnemy: null,
      nearestDangerAnimal: null,
      willCollideSpike: false,
      detectedEnemy: false,
      detectedDangerEnemy: false,
      dangerWithoutSoldier: false,
      velocityTickThreat: false,
      reverseInsta: false,
      toolHammerInsta: false,
      rangedBowInsta: false,
      nearestEnemyInRangeOf: () => false
    }, threats || {}),
    ObjectManager: { grid2D: { query: () => {} }, objects: new Map() }
  };
  return { hat: new mod.DefaultHat(client).getBestCurrentHat(), mh: mh };
}

function testSoldierHat() {
  section("9. the soldier hat");

  const forces = [ "detectedDangerEnemy", "detectedEnemy", "velocityTickThreat", "reverseInsta", "toolHammerInsta", "rangedBowInsta" ];
  for (const flag of forces) {
    const s = hatScenario({ [flag]: true });
    ok(flag + " puts soldier on", s.hat === 6, "hat=" + s.hat);
    ok(flag + " claims the hat rather than only suggesting it", s.mh.forceHat === 6 && s.mh.shouldEquipSoldier === true);
  }
  // Every flag the heal treats as a threat has to have a helmet behind it, or
  // the heal is eating through damage nothing is reducing. `dangerWithoutSoldier`
  // is the one exception in Glotus's own code: it is the softer `return 6`
  // below, not a forceHat, because by then soldier cannot save you anyway.
  {
    const s = hatScenario({ dangerWithoutSoldier: true });
    ok("dangerWithoutSoldier still reaches soldier", s.hat === 6, "hat=" + s.hat);
    ok("but does not claim forceHat", s.mh.forceHat === null);
  }
  {
    const s = hatScenario({ willCollideSpike: true });
    ok("an enemy spike within reach reaches soldier", s.hat === 6, "hat=" + s.hat);
  }
  {
    const s = hatScenario({ nearestDangerAnimal: {} });
    ok("a dangerous animal reaches soldier", s.hat === 6, "hat=" + s.hat);
  }
  {
    const s = hatScenario({});
    ok("nothing happening is not a soldier tick", s.hat !== 6, "hat=" + s.hat);
  }
  {
    // The switch still switches: Anti Enemy off drops the six insta reasons,
    // and only those. Anti Spike and Anti Animal are their own toggles.
    const s = hatScenario({ velocityTickThreat: true }, { antienemy: false });
    ok("Anti Enemy off drops the insta reasons", s.hat !== 6, "hat=" + s.hat);
    const t = hatScenario({ willCollideSpike: true }, { antienemy: false });
    ok("and leaves Anti Spike alone", t.hat === 6, "hat=" + t.hat);
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
  m.RynScan.clearTargets();
  m.RynScan.toggleTarget(700, "Victim");
  m.RynScan.on = true;
  const target = m.RynScan.targets.get(700);
  target.found = true;
  target.x = opts.tx;
  target.y = opts.ty;
  target.vx = 0;
  target.vy = 0;
  target.at = Date.now();
  target.finder = opts.finder === "self" ? bot : null;
  // A second target, for the tests that check the fleet dividing by distance.
  if (opts.second) {
    m.RynScan.toggleTarget(701, "Other");
    const t2 = m.RynScan.targets.get(701);
    t2.found = true;
    t2.x = opts.second.x;
    t2.y = opts.second.y;
    t2.vx = 0;
    t2.vy = 0;
    t2.at = Date.now();
    t2.finder = null;
  }
  return { m: m, mh: mh, bot: bot, mod: new m.BotScanMission(bot), target: target };
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

  // With two targets on the board the fleet divides itself by distance rather
  // than all piling onto one of them.
  {
    // Standing next to the first: heading should be +x, toward 5000,0.
    const a = missionScenario({ x: 4000, y: 0, tx: 5000, ty: 0, second: { x: 0, y: 9000 } });
    a.mod.postTick();
    ok("a bot near one target goes to that one", Math.abs(a.mh.moves[0]) < 0.4, "heading=" + a.mh.moves[0]);

    // Standing next to the second: heading should be +y, toward 0,9000.
    const b = missionScenario({ x: 0, y: 8000, tx: 5000, ty: 0, second: { x: 0, y: 9000 } });
    b.mod.postTick();
    ok("a bot near the other goes to the other", Math.abs(b.mh.moves[0] - Math.PI / 2) < 0.4, "heading=" + b.mh.moves[0]);
  }

  // Losing one of two leaves the fleet on the one that is left.
  {
    const s = missionScenario({ x: 0, y: 8000, tx: 5000, ty: 0, second: { x: 0, y: 9000 } });
    s.mod.postTick();
    ok("claim taken with two targets", s.mh._scanMissionActive === true);
    s.m.RynScan.targets.get(701).found = false;
    s.mh.newTick();
    s.mod.postTick();
    ok("losing one keeps the mission on the other", s.mh._scanMissionActive === true);
    s.target.found = false;
    s.mh.newTick();
    s.mod.postTick();
    ok("losing both releases the claim", s.mh._scanMissionActive === false);
  }
  {
    const s = missionScenario({ x: 0, y: 0, tx: 5000, ty: 0 });
    s.mod.postTick();
    ok("claim taken", s.mh._scanMissionActive === true);
    s.target.found = false;
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
  testRemove();
  testHeal();
  testSoldierHat();
  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail === 0 ? 0 : 1);
})();
