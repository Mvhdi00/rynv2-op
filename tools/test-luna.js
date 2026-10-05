#!/usr/bin/env node
/*
 * test-luna.js
 *
 * Exercises the Luna+ survival engine in Luna_Client.user.js against scripted
 * fight states, using the built script's own code: the helpers, getPlayerInfo,
 * the whole ANTIS AND HEAL block and hatFc are cut out of the build and run
 * against a mocked tick, with the game's real items / config / utils modules.
 *
 *   node tools/test-luna.js
 *
 * It cannot prove the reads are right in a live fight - nothing offline can -
 * but it does prove every new path runs without throwing (a TypeError in the
 * tick takes the whole tick down) and that each anti fires on the state it is
 * written for and stays quiet on the state it is not.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "Luna_Client.user.js"), "utf8");

function between(start, end, { includeStart = true } = {}) {
  const a = SRC.indexOf(start);
  if (a === -1) throw new Error("extract: start not found: " + start.slice(0, 60));
  const b = SRC.indexOf(end, a + start.length);
  if (b === -1) throw new Error("extract: end not found: " + end.slice(0, 60));
  return SRC.slice(includeStart ? a : a + start.length, b);
}

function webpackModule(key) {
  const at = SRC.indexOf(`/***/ "${key}":`);
  if (at === -1) throw new Error("module not found: " + key);
  const fnStart = SRC.indexOf("(function (", at);
  const fnEnd = SRC.indexOf("\n            /***/\n        })", fnStart);
  const body = SRC.slice(fnStart, fnEnd) + "\n})";
  const module = { exports: {} };
  const fn = vm.runInNewContext(body, { window: { location: { hostname: "moomoo.io" } }, Math, Date, console });
  fn.call(module.exports, module, module.exports, () => ({ env: {} }));
  return module.exports;
}

const items = webpackModule("./src/js/data/items.js");
const config = webpackModule("./src/js/config.js");
const UTILS = webpackModule("./src/js/libs/utils.js");

const helpers = between("            // =================================================================\n            //  LUNA+ SURVIVAL ENGINE", "            function isBoughtHat(id, type) {");
const getPlayerInfo = between("            function getPlayerInfo(player, type) {", "            function checkBuildingDamage(");
const antis = between("                        // ANTIS AND HEAL\n", "                        // AUTO PLACER");
const hatFc = between("            function hatFc() {", "            // FIND OBJECTS BY ID/SID:");

/* ------------------------------------------------------------------ */

function makePlayer(sid, over = {}) {
  return Object.assign({
    sid, alive: true, health: 100, scale: 35, shameCount: 0,
    x: 0, y: 0, x2: 0, y2: 0, xVel: 0, yVel: 0, d2: 0,
    weapons: [4, 15], weaponVariants: [0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    items: [0, 3, 6, 15], skinIndex: 0, tailIndex: 0, food: 1000,
    skins: { 6: 1, 7: 1, 12: 0, 40: 1, 53: 1, 15: 0, 31: 0, 20: 0 }, tails: { 11: 1, 19: 0 },
    lastPrimaryReload: 1, buildIndex: -1, weaponIndex: 4,
  }, over);
}

/* One isolated world per scenario: fresh state, the extracted code compiled
 * into it, and a clock the scenario drives. */
function world(setup) {
  const sent = [];
  const timers = [];
  const ctx = {
    console, Math, JSON, Number, isFinite, Infinity, NaN, Array, Object,
    items, config, UTILS,
    window: { vars: {}, pingTime: 80, addEventListener() { } },
    now: 100000,
    packets: 0,
    io: { send: (...a) => { ctx.packets++; sent.push(a); } },
    sent, timers,
    tick: 500, damageTick: 0, minPingTime: 60,
    damages: [], damageByPoisonTick: 0, imTrapped: null, spikeDamages: [],
    spikes_enemy: [], cactuses: [], visibleObjects: [],
    lastPosX: 0, lastPosY: 0, damagesByHits: [], damagesByShoots: [], damagesByTurrets: [],
    enemiesNear: [], primaryReload: {}, secondaryReload: {}, turretReload: {},
    lastcolliding: false, lastPredicted: false, iWasTrapped: false, canStillGather: false,
    spikeTickAnti: false, antiTick: false, trapBreaked: false, trapBreakedTick: 0, spikeDmgCount: 0,
    nearestEnemy: null, nearestTrap: null, totalDmgPot: 0, soldierAnti: false, healing: false,
    predictWeapon: 4, checkGather: false, autogathering: false, shouldResetShame: false,
    currentHat: 0, instaKill: [], insta: { primary: false, secondary: false },
    autoBreak: false, antiPush: false, ePress: false, autoaim: false, leftClick: false,
    objectManager: { checkItemLocation: () => false },
    equipped: [],
  };
  ctx.Date = { now: () => ctx.now };
  ctx.setTimeout = (fn, ms) => { const t = { fn, at: ctx.now + ms, live: true }; timers.push(t); return t; };
  ctx.clearTimeout = (t) => { if (t) t.live = false; };
  ctx.myPlayer = makePlayer(1);
  setup && setup(ctx);
  vm.createContext(ctx);
  vm.runInContext(`
    function selectToBuild(i) { io.send("z", i, false); }
    function selectWeapon(i) { io.send("z", i, true); }
    function sendAtck(id, a) { io.send("F", id, a); }
    function getAttackDir() { return 0; }
    function needAutoGather() { return false; }
    function sendAutoGather() { }
    function isBadTail() { return false; }
    function isBoughtHat(id, type) { return type ? !!myPlayer.tails[id] : !!myPlayer.skins[id]; }
    function hat(id) { equipped.push(["hat", id]); }
    function acc(id) { equipped.push(["acc", id]); }
    ${helpers}
    ${getPlayerInfo}
    ${hatFc}
    function runTick() {
      ${antis}
      return { damageHealed, totalDmgPot, healing, spikeDmgPot, hitDmgPot, turretDmgPot, secDmgPot, poisonDmgPot };
    }
    function advance(ms) {
      now += ms;
      for (const t of timers) if (t.live && t.at <= now) { t.live = false; t.fn(); }
    }
  `, ctx);
  return ctx;
}

function foods(ctx) {
  return ctx.sent.filter(p => p[0] === "F" && p[1] === 1).length;
}

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("  ok   " + name);
  } catch (e) {
    failed++;
    console.log("  FAIL " + name + "\n       " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n       ") : e));
  }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }
function ok(v, msg) { if (!v) throw new Error(msg); }

/* An enemy in melee reach to our right, facing us. */
function enemyAt(ctx, sid, dist, over = {}) {
  const e = makePlayer(sid, Object.assign({ x2: dist, y2: 0, x: dist, y: 0, xVel: dist, yVel: 0, d2: Math.PI }, over));
  ctx.enemiesNear.push(e);
  ctx.primaryReload[sid] = 1;
  ctx.secondaryReload[sid] = 1;
  ctx.turretReload[sid] = 1;
  return e;
}

console.log("Luna+ survival engine");

/* ---------------- shame-safe heal timing ---------------- */

test("free heal waits 120 + margin - minRTT (60 ms on 60 ping, margin 20 -> 80 ms)", () => {
  const w = world(c => { c.myPlayer.health = 70; });
  vm.runInContext("lunaPlusOnDamage(30)", w);
  w.now += 40;
  eq(vm.runInContext("lunaPlusHealTick(false)", w), false, "healed inside the shame window");
  w.now += 41;
  eq(vm.runInContext("lunaPlusHealTick(false)", w), true, "did not heal once safe");
  eq(foods(w), 2, "apples sent for 30 missing");
  eq(w.sent.length, 2 * 3 + 1, "3 packets per food + 1 weapon restore");
});

test("the scheduled timer heals by itself at the safe moment", () => {
  const w = world(c => { c.myPlayer.health = 55; });
  vm.runInContext("lunaPlusOnDamage(45)", w);
  vm.runInContext("advance(79)", w);
  eq(foods(w), 0, "fired early");
  vm.runInContext("advance(3)", w);
  eq(foods(w), 3, "timer heal for 45 missing");
});

test("high ping heals at once (RTT alone clears the shame window)", () => {
  const w = world(c => { c.myPlayer.health = 60; c.minPingTime = 150; });
  vm.runInContext("lunaPlusOnDamage(40)", w);
  eq(vm.runInContext("lunaPlusHealTick(false)", w), true, "should not wait on 150 ms ping");
});

test("a batch in flight is not re-sent until it lands or new damage arrives", () => {
  const w = world(c => { c.myPlayer.health = 60; c.minPingTime = 150; });
  vm.runInContext("lunaPlusOnDamage(40)", w);
  vm.runInContext("lunaPlusHealTick(false)", w);
  w.now += 50;
  eq(vm.runInContext("lunaPlusHealTick(false)", w), false, "duplicate batch");
  w.now += 5;
  vm.runInContext("lunaPlusOnDamage(10)", w);
  eq(vm.runInContext("lunaPlusHealTick(false)", w), true, "new damage should re-arm");
});

test("damage and heal in the same millisecond still dedupe the next tick", () => {
  const w = world(c => { c.myPlayer.health = 60; c.minPingTime = 150; });
  vm.runInContext("lunaPlusOnDamage(40); lunaPlusHealTick(false)", w);
  eq(vm.runInContext("lunaPlusHealTick(false)", w), false, "duplicate batch at the same ms");
});

test("a landed heal clears the wait so a short batch can be topped up", () => {
  const w = world(c => { c.myPlayer.health = 60; c.minPingTime = 150; });
  vm.runInContext("lunaPlusOnDamage(40); lunaPlusHealTick(false)", w);
  vm.runInContext("lunaPlus.pendingHealUntil = 0", w); // what updateHealth does on a rise
  eq(vm.runInContext("lunaPlusHealTick(false)", w), true, "top-up blocked");
});

test("legacy tick gate when smart heal is off", () => {
  const w = world(c => { c.myPlayer.health = 60; c.window.vars.smartHeal = false; c.damageTick = 501; c.tick = 501; });
  eq(vm.runInContext("lunaPlusHealTick(false)", w), false, "legacy healed on the damage tick");
  w.tick = 502;
  eq(vm.runInContext("lunaPlusHealTick(false)", w), true, "legacy did not heal a tick later");
});

/* ---------------- heal packet sizing ---------------- */

test("only affordable food is sent", () => {
  const w = world(c => { c.myPlayer.health = 20; c.myPlayer.food = 25; c.minPingTime = 200; });
  vm.runInContext("lunaPlusHealTick(false)", w);
  eq(foods(w), 2, "25 food buys two apples");
});

test("packet budget trims the batch instead of stranding food in hand", () => {
  const w = world(c => { c.myPlayer.health = 20; c.minPingTime = 200; c.packets = 113; });
  vm.runInContext("lunaPlusHealTick(false)", w);
  eq(foods(w), 1, "only 1 food fits in 119");
  const last = w.sent[w.sent.length - 1];
  ok(last[0] === "z" && last[2] === true, "weapon was not restored last");
});

/* ---------------- emergency heals ---------------- */

test("normal insta: katana opener landed, musket+turret follow-up -> heal now", () => {
  const w = world(c => {
    c.myPlayer.health = 40;
    const e = enemyAt(c, 2, 120, { weapons: [4, 15] });
    c.primaryReload[2] = 0;
    c.damagesByHits.push({ player: e, weapon: 4, damage: 60 });
    c.lunaPlus_lastDamage = true;
  });
  vm.runInContext("lunaPlusOnDamage(60)", w);
  const r = vm.runInContext("runTick()", w);
  ok(r.healing, "follow-up not read as lethal");
  ok(r.damageHealed, "no emergency heal");
});

test("normal insta at 7 shame still heals (confirmed burst beats the clown hat)", () => {
  const w = world(c => {
    c.myPlayer.health = 40;
    c.myPlayer.shameCount = 7;
    const e = enemyAt(c, 2, 120, { weapons: [4, 15] });
    c.primaryReload[2] = 0;
    c.damagesByHits.push({ player: e, weapon: 4, damage: 60 });
  });
  vm.runInContext("lunaPlusOnDamage(60)", w);
  ok(vm.runInContext("runTick()", w).damageHealed, "blocked by shame");
});

test("...but an unconfirmed read at 7 shame waits for the safe moment", () => {
  const w = world(c => {
    c.myPlayer.health = 30;
    c.myPlayer.shameCount = 7;
    enemyAt(c, 2, 120, { weapons: [4, 9] });
    c.secondaryReload[2] = 0;
  });
  vm.runInContext("lunaPlusOnDamage(5)", w);
  const r = vm.runInContext("runTick()", w);
  ok(r.healing, "lethal read expected (autosteal predict)");
  eq(r.damageHealed, false, "shame-costing heal on an unconfirmed read");
});

test("reverse insta: musket landed first, bull primary ready -> heal now", () => {
  const w = world(c => {
    c.myPlayer.health = 45;
    const e = enemyAt(c, 2, 120, { weapons: [5, 15] });
    c.secondaryReload[2] = 0;
    c.damagesByShoots.push({ projectile: { player: e }, damage: 50 });
  });
  vm.runInContext("lunaPlusOnDamage(50)", w);
  const r = vm.runInContext("runTick()", w);
  ok(r.totalDmgPot >= 45, "primary follow-up not counted: " + r.totalDmgPot);
  ok(r.damageHealed, "no heal");
  ok(vm.runInContext("lunaPlus.burstConfirmed", w), "burst not confirmed");
});

test("reverse insta off -> the follow-up is not added by it", () => {
  const w = world(c => {
    c.myPlayer.health = 90;
    c.window.vars.test2 = false;
    const e = enemyAt(c, 2, 120, { weapons: [5, 15] });
    c.secondaryReload[2] = 0;
    c.damagesByShoots.push({ projectile: { player: e }, damage: 50 });
  });
  const r = vm.runInContext("runTick()", w);
  eq(r.hitDmgPot, 0, "pot");
});

test("projectile in the air counts before it lands", () => {
  const w = world(c => {
    c.myPlayer.health = 15;
    const e = makePlayer(3, { x2: 900 });
    c.lunaPlus_e = e;
  });
  vm.runInContext("lunaPlus.incoming.push({ sid: 9, player: lunaPlus_e, dmg: 25, turret: false, until: now + 500 })", w);
  const r = vm.runInContext("runTick()", w);
  eq(r.secDmgPot, 25, "arrow in flight");
  ok(r.damageHealed, "no heal for an arrow that kills even through soldier");
});

test("expired in-flight entries are dropped", () => {
  const w = world(c => { c.myPlayer.health = 20; c.lunaPlus_e = makePlayer(3); });
  vm.runInContext("lunaPlus.incoming.push({ sid: 9, player: lunaPlus_e, dmg: 25, turret: false, until: now - 1 })", w);
  eq(vm.runInContext("runTick()", w).secDmgPot, 0, "stale projectile counted");
});

/* ---------------- helmet reads ---------------- */

test("anti sync: two loaded polearms in reach at 100 HP -> soldier", () => {
  const w = world(c => {
    enemyAt(c, 2, 120, { weapons: [5, 9] });
    enemyAt(c, 3, -120, { x2: -120, x: -120, xVel: -120, weapons: [5, 9] });
    c.secondaryReload[2] = c.secondaryReload[3] = 0;
    c.turretReload[2] = c.turretReload[3] = 0;
  });
  vm.runInContext("runTick()", w);
  ok(vm.runInContext("lunaPlus.syncThreat", w), "sync not read");
  ok(w.equipped.some(e => e[0] === "hat" && e[1] === 6), "no soldier");
});

test("one loaded katana (no secondary, no turret) at 100 HP -> no false alarm", () => {
  const w = world(c => {
    enemyAt(c, 2, 120, { weapons: [4] });
    c.secondaryReload[2] = 0;
  });
  const r = vm.runInContext("runTick()", w);
  eq(r.totalDmgPot, 0, "pot");
  eq(vm.runInContext("lunaPlus.instaSoldier", w), false, "instaSoldier");
});

test("pre-emptive soldier: polearm + musket loaded in reach overrides our bull swing", () => {
  const w = world(c => {
    c.nearestEnemy = enemyAt(c, 2, 150, { weapons: [5, 15] });
    c.autogathering = true;
    c.primaryReload[1] = 1;
    c.predictWeapon = 4;
  });
  vm.runInContext("runTick()", w);
  const hats = w.equipped.filter(e => e[0] === "hat").map(e => e[1]);
  eq(hats[hats.length - 1], 6, "hat");
});

test("pre-emptive soldier off -> bull swing kept", () => {
  const w = world(c => {
    c.window.vars.preSoldier = false;
    c.nearestEnemy = enemyAt(c, 2, 150, { weapons: [5, 15] });
    c.autogathering = true;
    c.primaryReload[1] = 1;
    c.predictWeapon = 4;
  });
  vm.runInContext("runTick()", w);
  const hats = w.equipped.filter(e => e[0] === "hat").map(e => e[1]);
  eq(hats[hats.length - 1], 7, "hat");
});

test("our own insta in progress is not overridden by the helmet read", () => {
  const w = world(c => {
    enemyAt(c, 2, 150, { weapons: [5, 15] });
    c.instaKill = ["primary"];
    c.insta.primary = true;
  });
  vm.runInContext("runTick()", w);
  const hats = w.equipped.filter(e => e[0] === "hat").map(e => e[1]);
  eq(hats[hats.length - 1], 7, "hat");
});

test("one-tick sim: diamond polearm in turret gear closing and facing -> soldier", () => {
  const w = world(c => {
    enemyAt(c, 2, 260, { weapons: [5, 9], skinIndex: 53, xVel: 200 });
    c.secondaryReload[2] = 0;
    c.window.vars.preSoldier = false;
  });
  vm.runInContext("runTick()", w);
  ok(vm.runInContext("lunaPlus.instaSoldier", w), "one-tick not read");
});

test("antiTick (turret shot from 200-300) is finally read", () => {
  const w = world(c => {
    const e = enemyAt(c, 2, 240, { weapons: [5, 9], skinIndex: 6 });
    c.turretReload[2] = 0;
    c.secondaryReload[2] = 0;
    c.antiTick = true;
    c.window.vars.preSoldier = false;
    c.lunaPlus_e = e;
  });
  vm.runInContext("lunaPlus.antiTickPlayer = lunaPlus_e", w);
  vm.runInContext("runTick()", w);
  ok(vm.runInContext("lunaPlus.instaSoldier", w), "antiTick ignored");
});

test("helmet alone saves us: 60 HP vs 70 read -> soldier, no shame-costing heal", () => {
  const w = world(c => {
    c.myPlayer.health = 60;
    c.window.vars.preSoldier = false;
    c.lunaPlus_e = makePlayer(3);
  });
  vm.runInContext("lunaPlus.incoming.push({ sid: 9, player: lunaPlus_e, dmg: 70, turret: false, until: now + 500 })", w);
  vm.runInContext("lunaPlusOnDamage(1)", w);
  const r = vm.runInContext("runTick()", w);
  const hats = w.equipped.filter(e => e[0] === "hat").map(e => e[1]);
  eq(hats[hats.length - 1], 6, "hat");
  eq(r.healing, false, "52.5 after soldier should not be lethal at 60");
  eq(r.damageHealed, false, "healed inside the shame window");
});

/* ---------------- knockback antis ---------------- */

// Enemy to our right pushes us left, onto a spike 60 units to our left.
const spikeLeft = { x: -60, y: 0, scale: 49, dmg: 20 };

test("anti Kb Hammer: hammer push onto a spike is counted", () => {
  const w = world(c => {
    c.spikes_enemy = [spikeLeft];
    enemyAt(c, 2, 100, { weapons: [8, 10] });   // stick: no primary threat of its own
    c.primaryReload[2] = 0;
  });
  const r = vm.runInContext("runTick()", w);
  eq(r.spikeDmgPot, 20, "spike");
  ok(r.secDmgPot > 0, "hammer swing not counted");
});

test("anti Kb Hammer off -> not counted", () => {
  const w = world(c => {
    c.window.vars.antiSmar24t = false;
    c.spikes_enemy = [spikeLeft];
    enemyAt(c, 2, 100, { weapons: [8, 10] });
    c.primaryReload[2] = 0;
  });
  eq(vm.runInContext("runTick()", w).spikeDmgPot, 0, "spike");
});

test("anti Kb Dagger: two dagger pushes reach a spike one push does not", () => {
  const far = { x: -110, y: 0, scale: 30, dmg: 20 };
  const w = world(c => {
    c.spikes_enemy = [far];
    enemyAt(c, 2, 60, { weapons: [7, 9] });
    c.secondaryReload[2] = 0;
  });
  const r = vm.runInContext("runTick()", w);
  eq(r.spikeDmgPot, 20, "double push not read");
  const off = world(c => {
    c.window.vars.antiSmar36t = false;
    c.spikes_enemy = [far];
    enemyAt(c, 2, 60, { weapons: [7, 9] });
    c.secondaryReload[2] = 0;
  });
  eq(vm.runInContext("runTick()", off).spikeDmgPot, 0, "single push should miss");
});

test("anti Kb Sync: two pushes add up onto a spike", () => {
  const far = { x: -95, y: 0, scale: 20, dmg: 35 };
  const w = world(c => {
    c.spikes_enemy = [far];
    enemyAt(c, 2, 100, { weapons: [4, 9] });
    enemyAt(c, 3, 100, { x2: 100, y2: 10, x: 100, y: 10, xVel: 100, yVel: 10, weapons: [4, 9] });
    c.secondaryReload[2] = c.secondaryReload[3] = 0;
  });
  eq(vm.runInContext("runTick()", w).spikeDmgPot, 35, "combined push not read");
});

test("spike tick window: helmet for a few ticks after our trap breaks", () => {
  const w = world(c => {
    c.window.vars.preSoldier = false;
    c.nearestEnemy = makePlayer(2, { x2: 150, y2: 0 });
    c.trapBreaked = true;
  });
  vm.runInContext("runTick()", w);
  ok(vm.runInContext("lunaPlus.instaSoldier", w), "tick 1");
  w.trapBreaked = false;
  for (let i = 0; i < 3; i++) vm.runInContext("runTick()", w);
  ok(vm.runInContext("lunaPlus.instaSoldier", w), "tick 4");
  vm.runInContext("runTick()", w);
  eq(vm.runInContext("lunaPlus.instaSoldier", w), false, "window should have closed");
});

/* ---------------- poison ---------------- */

test("poison: predicted ~9 ticks after a chunk, not forever, not before any", () => {
  const w = world(c => { c.tick = 100; c.damages = [5]; });
  eq(vm.runInContext("runTick()", w).poisonDmgPot, 0, "pot on the chunk tick");
  w.damages.length = 0;
  w.tick = 108;
  eq(vm.runInContext("runTick()", w).poisonDmgPot, 5, "next chunk not predicted");
  w.tick = 104;
  eq(vm.runInContext("runTick()", w).poisonDmgPot, 0, "phantom mid-period");
  w.tick = 200;
  eq(vm.runInContext("runTick()", w).poisonDmgPot, 0, "poison predicted long after the DoT");
  const fresh = world(c => { c.tick = 9 * 40 + 8; });
  eq(vm.runInContext("runTick()", fresh).poisonDmgPot, 0, "phantom before any poison");
});

/* ---------------- data fixes ---------------- */

test("secondaryDmg reads the projectile table (bow 25, crossbow 35, repeater 30, musket 50)", () => {
  const w = world();
  const dmg = (id) => vm.runInContext(`getPlayerInfo({ weapons: [4, ${id}], weaponVariants: [] }, "secondaryDmg")`, w);
  eq(dmg(9), 25, "bow");
  eq(dmg(12), 35, "crossbow");
  eq(dmg(13), 30, "repeater");
  eq(dmg(15), 50, "musket");
});

/* ---------------- faster heal key ---------------- */

test("faster heal key heals inside the shame window", () => {
  const w = world(c => { c.myPlayer.health = 50; });
  vm.runInContext("lunaPlusOnDamage(50)", w);
  vm.runInContext("lunaPlus.fastHealHeld = true", w);
  eq(vm.runInContext("lunaPlusHealTick(false)", w), true, "held key ignored");
});

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
