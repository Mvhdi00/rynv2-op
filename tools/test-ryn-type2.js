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
    ${poolSrc}
    return { TokenPool: TokenPool, TTL: TURNSTILE_TTL_MS, CF: TURNSTILE_CF_LIFETIME_MS,
             SAFETY: TURNSTILE_SAFETY_MS, MAXC: TURNSTILE_MAX_CONCURRENT,
             TARGET: TURNSTILE_POOL_TARGET, KEEPER: TURNSTILE_KEEPER_MS };
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
  // The Turnstile script's presence, which the pool checks before starting
  // anything. Present by default; the load-order test flips it.
  const win = { turnstile: o.noTurnstile ? undefined : { render: () => {} }, top: null };
  const built = buildPool({
    Date: { now: () => now },
    window: win,
    mint: () => new Promise((res, rej) => { minted++; inflight.push({ res: res, rej: rej }); })
  });
  return {
    pool: built.TokenPool,
    k: built,
    win: win,
    advance: ms => { now += ms; },
    get minted() { return minted; },
    get inflight() { return inflight.length; },
    // One keeper tick: top up, then let whatever it started resolve.
    tick: async () => {
      built.TokenPool.refill();
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
    h.pool.refill();
    ok("nothing is minted before the Turnstile script loads", h.minted === 0);
    h.win.turnstile = { render: () => {} };
    h.pool.refill();
    ok("minting starts as soon as it is there", h.minted === h.k.MAXC, "minted=" + h.minted);
  }

  let h = poolHarness();
  h.pool.refill();
  ok("the pool fills itself with no prompting", h.minted > 0);
  ok("it does not start forty challenges at once", h.inflight === h.k.MAXC, "inflight=" + h.inflight);
  h.pool.refill();
  ok("a refill does not double-mint what is already in flight", h.minted === h.k.MAXC, "minted=" + h.minted);

  const rounds = await h.fill();
  ok("it fills to the full forty", h.pool.size === h.k.TARGET, "size=" + h.pool.size);
  ok("in the expected number of keeper ticks", rounds === Math.ceil(h.k.TARGET / h.k.MAXC), "rounds=" + rounds);
  h.pool.refill();
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
    hh.pool.refill();
    await hh.failAll();
    ok("a failed mint leaves the pool empty", hh.pool.size === 0);
    hh.pool.refill();
    ok("a failed mint releases its slot so the keeper retries", hh.minted === hh.k.MAXC * 2, "minted=" + hh.minted);
  }

  // The target is a constant now, not a setting.
  ok("the target is fixed at forty", h.k.TARGET === 40, "target=" + h.k.TARGET);
  ok("the pool reports the same target it fills to", h.pool.target === h.k.TARGET);
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
