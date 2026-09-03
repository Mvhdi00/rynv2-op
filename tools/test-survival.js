#!/usr/bin/env node
/*
 * test-survival.js
 *
 * Behaviour tests for the survival layer — shame, threats, defensive gear and
 * the packet budget — run against the built client rather than a copy of the
 * logic. Every class under test is sliced straight out of
 * Ryn_Type_2_TargetLock.user.js and driven with stand-ins for the game objects
 * it reads.
 *
 *   node tools/test-survival.js [path/to/client.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = process.argv[2] || path.join(ROOT, "Ryn_Type_2_TargetLock.user.js");
const built = fs.readFileSync(CLIENT, "utf8");

function slice(from, to, label) {
  const a = built.indexOf(from);
  if (a === -1) throw new Error("missing start: " + label);
  const b = built.indexOf(to, a);
  if (b === -1) throw new Error("missing end: " + label);
  return built.slice(a, b);
}

const survivalSrc = slice("  // SURVIVAL LAYER", "  class AntiInsta {", "survival layer");
/* The evasion leans on three things the client already had. They are sliced in
 * rather than re-implemented, because a stub of MovementSimulation would make
 * "a wall stops the step" a test of the stub. */
const vectorSrc = slice("class Vector {", "  const Vector_default = Vector;", "Vector");
const geometrySrc = slice("  const GeometrySolver = {", "\n  class PlacementLedger {", "GeometrySolver");
const rpeConstSrc = slice("  const RPE_TICK_MS", "  const RPE_PRIORITY = {", "RPE constants");
const simSrc = slice("  class MovementSimulation {", "  class ClientPlayer", "MovementSimulation");
const projTableSrc = slice("  const Projectiles = [ {", "\n  class Vector {", "Projectiles");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
};

console.log("client : " + path.relative(ROOT, CLIENT));

/* ---------------------------------------------------------------- scaffold */
const Settings_default = { _autoheal: true, _survivalEngine: true, _survivalSoldier: true, _microEvasion: true, _safeWalk: false };
/* Only the fields the layer reads. Values are the shipped ones:
 * game_index.js:2756 soldier dmgMult .75, :2794 bull healthRegen -5. */
const Hats = { 0: {}, 6: { dmgMult: 0.75, spdMult: 0.94 }, 7: { healthRegen: -5, dmgMultO: 1.5 } };
const Items = [];
Items[0] = { restore: 20 };            // apple, game_index.js item 0
const ANTI_INSTA_DMG_CAP = 140;
const ANTI_INSTA_SCUBA_BIAS = 5;
const RPE_TICK_MS = 1000 / 9;

/* Environment MovementSimulation reads. Values are the shipped ones:
 * game_index.js:130-208 for the config scalars. */
const Config_default = {
  playerSpeed: 0.0016, playerDecel: 0.993, mapScale: 14400, riverWidth: 724,
  snowBiomeTop: 2400, snowSpeed: 0.75, waterCurrent: 0.0011
};
const Accessories = { 0: {} };
const DataHandler_default = { getWeapon: () => ({ spdMult: 1, range: 70 }) };
class Player_default {}
class Resource {}
class PlayerObject {}

const build = new Function(
  "Settings_default", "Hats", "Items", "Accessories", "Config_default", "DataHandler_default",
  "Player_default", "Resource", "PlayerObject",
  "ANTI_INSTA_DMG_CAP", "ANTI_INSTA_SCUBA_BIAS",
  `${vectorSrc}
   const Vector_default = Vector;
   const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
   const getDistance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
   const getAngle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
   ${rpeConstSrc}
   ${geometrySrc}
   ${simSrc}
   ${projTableSrc}
   ${survivalSrc}
   return { ShameEngine, PacketBudget, ThreatEngine, DefenceState, ProjectileEvasion, SurvivalEngine,
            MovementSimulation, GeometrySolver, Projectiles,
            SV_SHAME_WINDOW, SV_SHAME_BAN_AT, SV_SHAME_PAD, SV_HEAL_COST,
            SV_SOLDIER, SV_BULL, SV_TURRET_TYPE, SV_TURRET_RANGE, SV_TURRET_DMG,
            SV_EVADE_COST, SV_EVADE_MIN_STEP, SV_MELEE_KEEPOUT, SV_THREAT, RPE_TICK_MS };`
);
const S = build(Settings_default, Hats, Items, Accessories, Config_default, DataHandler_default,
                Player_default, Resource, PlayerObject,
                ANTI_INSTA_DMG_CAP, ANTI_INSTA_SCUBA_BIAS);
const { ShameEngine, PacketBudget, ThreatEngine, DefenceState, ProjectileEvasion, SurvivalEngine,
        GeometrySolver, Projectiles,
        SV_SHAME_WINDOW, SV_SHAME_BAN_AT, SV_SHAME_PAD, SV_HEAL_COST,
        SV_SOLDIER, SV_BULL, SV_TURRET_DMG, SV_EVADE_MIN_STEP, SV_MELEE_KEEPOUT, SV_THREAT } = S;

function mkWorld(opts = {}) {
  const objects = opts.objects || [];
  const myPlayer = {
    inGame: true,
    isSandbox: false,
    tempHealth: opts.hp === undefined ? 100 : opts.hp,
    maxHealth: 100,
    hatID: opts.hatID === undefined ? 0 : opts.hatID,
    shameCount: opts.shame || 0,
    shameActive: !!opts.shameActive,
    poisonCount: opts.poison || 0,
    isTrapped: !!opts.trapped,
    receivedDamage: opts.receivedDamage === undefined ? null : opts.receivedDamage,
    pos: { current: { x: 0, y: 0, distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); } } },
    getItemByType: t => (t === 2 ? 0 : 1),
    isBullTickTime: () => opts.bullTick !== false,
    isEnemyByID: () => true
  };
  const ModuleHandler = {
    tickCount: opts.tick || 0,
    packetLimit: opts.limit === undefined ? 119 : opts.limit,
    packetCount: opts.used || 0,
    forceHat: opts.forceHat === undefined ? null : opts.forceHat,
    activeModule: opts.activeModule || null,
    moduleActive: false,
    canBuy: () => opts.canBuy !== false,
    staticModules: {}
  };
  const client = {
    myPlayer,
    ModuleHandler,
    _ModuleHandler: ModuleHandler,
    SocketManager: { pong: opts.pong === undefined ? 0 : opts.pong },
    PlayerManager: { isEnemyByID: (ownerID) => ownerID !== 1 },
    ObjectManager: {
      objects: new Map(objects.map(o => [o.id, o])),
      grid2D: { cellSize: 100, query: (x, y, r, cb) => { for (const o of objects) cb(o.id); return false; } }
    },
    EnemyManager: Object.assign({
      potentialDamage: 0,
      potentialSpikeDamage: 0,
      potentialSpikeKnockbackDamage: 0,
      possibleToKnockback: false,
      reverseInsta: false,
      toolHammerInsta: false,
      rangedBowInsta: false,
      spikeSyncThreat: false,
      collidingSpike: false,
      willCollideSpike: false,
      enemyCanPlaceSpike: false
    }, opts.enemy || {})
  };
  const survival = new SurvivalEngine(client);
  ModuleHandler.staticModules.survival = survival;
  return { client, myPlayer, ModuleHandler, survival };
}
const turret = (id, x, y, ownerID) => ({
  id, type: 17, ownerID,
  pos: { current: { x, y, distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); } } }
});

/* ----------------------------------------------------- evasion scaffolding */
/* Fixtures are written around a local origin and placed in open ground. At the
 * literal map origin MovementSimulation clamps every step to the corner
 * (game_index.js:2375-2376), so a dodge there is untestable and unrealistic. */
/* Away from the map edges, above the snow biome (snowBiomeTop 2400) and clear
 * of the river band (mapScale/2 +- riverWidth/2, so 6838..7562) — none of which
 * is what these tests are about. */
const O = 4000;
const abs = (x, y) => ({
  x, y,
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); },
  copy() { return abs(this.x, this.y); }
});
const vec = (x, y) => abs(x + O, y + O);
/* A shot on the wire: position, heading, remaining range, speed, type.
 * Projectiles[type] supplies scale and layer, from the client's own table. */
const mkArrow = ({ x, y, angle, type = 0, range = 1000, speed = 1.6 }) => ({
  id: mkArrow.n = (mkArrow.n || 0) + 1,
  pos: { current: vec(x, y) },
  angle, range, speed, type,
  maxRange: range,
  scale: Projectiles[type].scale,
  damage: Projectiles[type].damage,
  ownerClient: { id: 2 }
});
const mirror = (o, x, y) => {
  const c = Object.assign(Object.create(Object.getPrototypeOf(o)), o);
  c.id = o.id + 100;
  c.pos = { current: vec(x, y) };
  return c;
};
/* The player sits at the origin; objects are placed around them. Instances of
 * the stub PlayerObject so MovementSimulation's instanceof checks behave. */
function mkProj(opts = {}) {
  const objects = (opts.objects || []).map(o => Object.assign(new PlayerObject(), o));
  const projectiles = opts.projectiles || [];
  const myPlayer = {
    inGame: true, isSandbox: false, tempHealth: 100, maxHealth: 100, hatID: 0,
    shameCount: 0, shameActive: false, poisonCount: 0, isTrapped: false,
    receivedDamage: null, collisionScale: 35, scale: 35, speed: 0, onPlatform: false,
    pos: { current: vec(0, 0) },
    getItemByType: t => (t === 2 ? 0 : 1),
    isBullTickTime: () => true,
    isEnemyByID: () => true
  };
  const enemy = opts.enemyAt
    ? Object.assign(new Player_default(), { pos: { current: vec(opts.enemyAt.x, opts.enemyAt.y) }, collisionScale: 35, scale: 35 })
    : null;
  const ModuleHandler = {
    tickCount: opts.tick || 0,
    packetLimit: opts.limit === undefined ? 119 : opts.limit,
    packetCount: opts.used || 0,
    forceHat: null, activeModule: null, moduleActive: false,
    move_dir: null, moveTo: "disable",
    canBuy: () => true,
    staticModules: { autoHat: { getNextHat: () => 0, getNextAcc: () => 0, getNextWeaponID: () => 0, getNextItemID: () => -1 } }
  };
  const client = {
    myPlayer, ModuleHandler, _ModuleHandler: ModuleHandler,
    SocketManager: { pong: opts.pong || 0, TICK: 1000 / 9 },
    PlayerManager: { isEnemyByID: ownerID => ownerID !== 1 },
    ProjectileManager: { dangerProjectiles: new Set(projectiles) },
    ObjectManager: {
      objects: new Map(objects.map(o => [o.id, o])),
      grid2D: { cellSize: 100, query: (x, y, r, cb) => { for (const o of objects) if (cb(o.id) === true) return true; return false; } }
    },
    EnemyManager: Object.assign({
      potentialDamage: 0, potentialSpikeDamage: 0, potentialSpikeKnockbackDamage: 0,
      possibleToKnockback: false, reverseInsta: false, toolHammerInsta: false,
      rangedBowInsta: false, spikeSyncThreat: false, collidingSpike: false,
      willCollideSpike: false, enemyCanPlaceSpike: false, nearestEnemy: enemy
    }, opts.enemy || {})
  };
  const survival = new SurvivalEngine(client);
  ModuleHandler.staticModules.survival = survival;
  return { client, myPlayer, ModuleHandler, survival };
}

/* =============================================================== the rule */
console.log("\nShame rule — the window is measured on the server, so ping is added");
{
  const { client } = mkWorld({ pong: 0 });
  const sh = new ShameEngine(client);
  const T = 1e6;
  sh.noteDamage(T);

  ok("an eat inside 120ms of the hit costs a shame", sh.verdict(T + 60) === "shameful");
  ok("an eat past the window takes two off", sh.verdict(T + 200) === "safe");
  /* game_index.js:2464 compares with <=, so 120 exactly still shames. */
  ok("120 exactly is still inside the window", sh.verdict(T + SV_SHAME_WINDOW) === "shameful");

  /* The server measures from its own hitTime to its own processing of the eat.
   * We hear about the damage one downstream latency late and our eat lands one
   * upstream latency late, so the server always sees the round trip MORE than
   * we do. */
  const hi = new ShameEngine(mkWorld({ pong: 100 }).client);
  hi.noteDamage(T);
  ok("at 100ms ping an eat 40ms after the hit is already safe on the server",
     hi.verdict(T + 40) === "safe", "server sees " + hi.serverElapsed(T + 40));
  ok("and the wait needed is shorter, not longer", hi.msUntilSafe(T + 10) < sh.msUntilSafe(T + 10),
     hi.msUntilSafe(T + 10) + " vs " + sh.msUntilSafe(T + 10));
  ok("waiting exactly that long makes it safe",
     sh.verdict(T + sh.msUntilSafe(T)) === "safe", String(sh.msUntilSafe(T)));
}

console.log("\nShame rule — hitTime is consumed by the first eat");
{
  const { client } = mkWorld();
  const sh = new ShameEngine(client);
  const T = 2e6;
  sh.noteDamage(T);
  ok("the first eat after a hit carries a verdict", sh.verdict(T + 300) === "safe");
  sh.noteEat(T + 300);
  /* game_index.js:2463 zeroes hitTime inside the `if (this.hitTime)` block, so
   * the block cannot run again until the next hit. Everything after the first
   * apple is free — which is why a top-up must not be rationed by the window. */
  ok("every eat after it is shame-neutral", sh.verdict(T + 301) === "neutral");
  ok("and needs no wait at all", sh.msUntilSafe(T + 301) === 0);
  sh.noteDamage(T + 500);
  ok("a fresh hit arms a fresh verdict", sh.verdict(T + 520) === "shameful");
}

console.log("\nShame rule — the ban is representable, and predicted");
{
  const { client } = mkWorld();
  const sh = new ShameEngine(client);
  const T = 3e6;
  sh.shame = 7;
  sh.noteDamage(T);
  /* The old model clamped its own count at 7, so the 7 -> 8 transition - the
   * only one that matters - could not be represented and the ban was learned
   * after the fact from the Shame! hat arriving. */
  ok("an eat inside the window at shame 7 would ban", sh.wouldBan(T + 50) === true);
  ok("the same eat outside the window would not", sh.wouldBan(T + 300) === false);
  ok("game_index.js:2465 bans at 8, and the model knows it", SV_SHAME_BAN_AT === 8);
  ok("the projection reads the ban as a reset to 0", sh.projected(T + 50) === 0);

  sh.shame = 4;
  ok("a safe eat is projected to take two off", sh.projected(T + 300) === 2);
  sh.shame = 1;
  ok("and never below zero", sh.projected(T + 300) === 0);
  sh.shame = 3;
  ok("a neutral eat moves nothing", (sh.noteEat(T + 300), sh.projected(T + 400)) === 3);
}

console.log("\nShame rule — repeated small hits are recognised as farming");
{
  const { client } = mkWorld();
  const sh = new ShameEngine(client);
  let T = 4e6;
  ok("one hit is not a pattern", (sh.noteDamage(T), sh.isSpamming(T)) === false);
  sh.noteDamage(T += 400);
  sh.noteDamage(T += 400);
  ok("three inside a second is", sh.isSpamming(T) === true, "streak " + sh.damageStreak);
}

/* ============================================================== packets */
console.log("\nPackets — one budget, and a reservation a lower priority cannot touch");
{
  const { survival, ModuleHandler } = mkWorld({ limit: 119, used: 0 });
  const b = survival.budget;
  ok("the budget is the handler's, not a second tally", b.limit === 119 && b.used === 0);

  b.reserve("survival", 12, SV_THREAT.LETHAL, 0, 2);
  ok("a routine caller cannot see the reserved packets",
     b.available(SV_THREAT.DAMAGE) === 119 - 12, String(b.available(SV_THREAT.DAMAGE)));
  ok("the owner of the reservation can", b.available(SV_THREAT.LETHAL, "survival") === 119);
  ok("a routine heal is refused when only reserved packets are left",
     (ModuleHandler.packetCount = 119 - 12, b.canAfford(SV_HEAL_COST, SV_THREAT.DAMAGE)) === false);
  ok("the emergency it was held for is not",
     b.canAfford(SV_HEAL_COST, SV_THREAT.LETHAL, "survival") === true);

  ModuleHandler.packetCount = 0;
  b.reserve("survival", 12, SV_THREAT.LETHAL, 0, 2);
  ok("re-reserving replaces rather than stacks", b.reservations.length === 1);
  b.release("survival");
  ok("releasing hands them all back", b.available(SV_THREAT.DAMAGE) === 119);
}

console.log("\nPackets — the limit is never exceeded, however many callers ask");
{
  const { survival, ModuleHandler } = mkWorld({ limit: 30, used: 0 });
  const b = survival.budget;
  b.reserve("survival", 9, SV_THREAT.LETHAL, 0, 2);
  let sent = 0;
  /* Every consumer in the client asks the same budget and obeys the answer.
   * Nothing here can send: the only way past the limit would be a caller that
   * does not ask, which is why heal() is the single door for food. */
  for (let round = 0; round < 200; round++) {
    const priority = round % 2 ? SV_THREAT.DAMAGE : SV_THREAT.SPIKE;
    if (!b.canAfford(SV_HEAL_COST, priority)) continue;
    ModuleHandler.packetCount += SV_HEAL_COST;
    sent += SV_HEAL_COST;
  }
  ok("routine callers stop at the reservation, not at the limit",
     ModuleHandler.packetCount <= 30 - 9, "used " + ModuleHandler.packetCount);
  for (let round = 0; round < 200; round++) {
    if (!b.canAfford(SV_HEAL_COST, SV_THREAT.LETHAL, "survival")) continue;
    ModuleHandler.packetCount += SV_HEAL_COST;
  }
  ok("the emergency then spends its own reserve and stops at the limit",
     ModuleHandler.packetCount <= 30, "used " + ModuleHandler.packetCount);
  ok("and the limit is never passed, not even by one",
     ModuleHandler.packetCount <= ModuleHandler.packetLimit);
  ok("affords() answers in whole actions", b.affords(SV_HEAL_COST, SV_THREAT.LETHAL, "survival") === 0);
}

console.log("\nPackets — a reservation cannot be larger than what is left");
{
  const { survival } = mkWorld({ limit: 20, used: 15 });
  const held = survival.budget.reserve("survival", 12, SV_THREAT.LETHAL, 0, 2);
  ok("it is clamped to the room that actually exists", held === 5, String(held));
  ok("so available never goes negative", survival.budget.available(SV_THREAT.DAMAGE) === 0);
}

/* =============================================================== threats */
console.log("\nThreats — read from what EnemyManager already computed");
{
  const w = mkWorld({ hp: 40, enemy: { potentialDamage: 60 } });
  const t = w.survival.threats.build(1);
  ok("damage at or above health is lethal", t.lethal === true);
  ok("and asks for Soldier", t.top.gear === SV_SOLDIER);
  ok("game_index.js:2756 — Soldier is the damage-reduction hat, dmgMult .75", Hats[6].dmgMult === 0.75);

  const safe = mkWorld({ hp: 100, enemy: { potentialDamage: 30 } });
  const t2 = safe.survival.threats.build(1);
  ok("damage below health is not", t2.lethal === false && t2.top.kind === "damage");

  /* Soldier already on: the same incoming damage is worth a quarter less, and
   * the client's own cap applies first. */
  const wearing = mkWorld({ hp: 40, hatID: 6, enemy: { potentialDamage: 50 } });
  ok("the hat actually worn is priced in",
     wearing.survival.threats.build(1).incoming === 50 * 0.75);
  const capped = mkWorld({ hp: 40, enemy: { potentialDamage: 400 } });
  ok("and the client's damage cap still applies", capped.survival.threats.build(1).incoming === 140);
}

console.log("\nThreats — ranked by severity then by what lands first");
{
  const w = mkWorld({ hp: 100, enemy: { potentialDamage: 20, rangedBowInsta: true, collidingSpike: true, potentialSpikeDamage: 25 } });
  const t = w.survival.threats.build(1);
  ok("more than one threat is held at once", t.threats.length >= 3, String(t.threats.length));
  /* §22: the closest threat is not automatically the most dangerous. The
   * sequence outranks the spike contact even though the spike lands sooner. */
  ok("a lethal sequence outranks a spike already biting", t.top.kind === "rangedInsta",
     t.threats.map(x => x.kind).join(","));
  const kinds = t.threats.map(x => x.kind);
  ok("and every detection is carried, not just the winner",
     kinds.indexOf("spikeContact") !== -1 && kinds.indexOf("damage") !== -1, kinds.join(","));
  ok("has() answers for any of them", t.has("spikeContact") && !t.has("kbTick"));
}

console.log("\nThreats — the named sequences each raise their own entry");
{
  const cases = [
    ["reverseInsta", { reverseInsta: true }, "reverseInsta"],
    ["toolHammerInsta", { toolHammerInsta: true }, "toolHammerInsta"],
    ["spikeSyncThreat", { spikeSyncThreat: true }, "spikeSync"],
    ["willCollideSpike", { willCollideSpike: true, potentialSpikeDamage: 25 }, "spikePush"],
    ["knockback onto a spike", { possibleToKnockback: true, potentialSpikeKnockbackDamage: 25 }, "kbTick"]
  ];
  for (const [label, flags, kind] of cases) {
    const w = mkWorld({ hp: 100, enemy: Object.assign({ potentialDamage: 10 }, flags) });
    ok(label + " raises " + kind, w.survival.threats.build(1).has(kind));
  }
  const trapped = mkWorld({ hp: 100, trapped: true, enemy: { potentialDamage: 10, enemyCanPlaceSpike: true } });
  ok("trapped with an enemy able to spike raises spikeTick before the break",
     trapped.survival.threats.build(1).has("spikeTick"));
  const loose = mkWorld({ hp: 100, trapped: false, enemy: { potentialDamage: 10, enemyCanPlaceSpike: true } });
  ok("but an enemy merely able to spike does not — §31, no false positives",
     loose.survival.threats.build(1).has("spikeTick") === false);
}

console.log("\nThreats — turret stack is counted, bounded and owner-aware");
{
  const objs = [turret(10, 100, 0, 2), turret(11, 200, 0, 2), turret(12, 300, 0, 2)];
  const w = mkWorld({ hp: 100, objects: objs, enemy: { potentialDamage: 10 } });
  const t = w.survival.threats.build(1);
  ok("three enemy turrets bearing are counted", t.turretCount === 3, String(t.turretCount));
  ok("and raise a stack threat", t.has("turretStack"));
  ok("priced at the bundle's turret damage", SV_TURRET_DMG === 25);

  const mine = mkWorld({ hp: 100, objects: [turret(10, 100, 0, 1), turret(11, 200, 0, 1)], enemy: { potentialDamage: 10 } });
  ok("my own turrets are not a threat to me", mine.survival.threats.build(1).turretCount === 0);

  const far = mkWorld({ hp: 100, objects: [turret(10, 900, 0, 2), turret(11, 950, 0, 2)], enemy: { potentialDamage: 10 } });
  ok("turrets beyond their own 700 shootRange do not bear",
     far.survival.threats.build(1).turretCount === 0);

  const one = mkWorld({ hp: 100, objects: [turret(10, 100, 0, 2)], enemy: { potentialDamage: 10 } });
  ok("a single turret is EnemyManager's business, not a stack",
     one.survival.threats.build(1).has("turretStack") === false);

  const lethal = mkWorld({ hp: 40, objects: objs, enemy: { potentialDamage: 10 } });
  const lt = lethal.survival.threats.build(1);
  ok("a stack that adds up to more than health is lethal",
     lt.threats.some(x => x.kind === "turretStack" && x.severity === SV_THREAT.LETHAL));

  /* §34 — the query is bounded and only runs when something is already wrong. */
  let queried = 0;
  const idle = mkWorld({ hp: 100, objects: objs, enemy: {} });
  idle.client.ObjectManager.grid2D.query = () => { queried++; return false; };
  idle.survival.threats.build(1);
  ok("a full-health player with nothing incoming does not pay for the scan", queried === 0);
}

console.log("\nThreats — reaction time measures jitter rather than padding for it");
{
  const w = mkWorld({ pong: 50 });
  const t = w.survival.threats;
  for (let i = 0; i < 8; i++) t._samplePong();
  ok("a steady link has no jitter", t.pongJitter() === 0, String(t.pongJitter()));
  const steady = t.reactionMs();
  ok("its reaction allowance is ping plus one tick", Math.abs(steady - (50 + RPE_TICK_MS)) < 1e-9);

  const w2 = mkWorld({ pong: 50 });
  const t2 = w2.survival.threats;
  for (let i = 0; i < 8; i++) { w2.client.SocketManager.pong = i % 2 ? 200 : 40; t2._samplePong(); }
  ok("an unstable one has jitter, and a longer allowance", t2.pongJitter() > 0 && t2.reactionMs() > steady,
     t2.pongJitter().toFixed(1));
  ok("which is whole ticks by the time it is used", Number.isInteger(t2.reactionTicks()));
}

/* ================================================================ defence */
console.log("\nDefence — one decision, and it yields to a hat already claimed");
{
  const w = mkWorld({ hp: 40, enemy: { potentialDamage: 60 } });
  const t = w.survival.threats.build(1);
  ok("a lethal threat asks for Soldier",
     w.survival.defence.decide(1, t, w.survival.shame) === SV_SOLDIER);

  const held = mkWorld({ hp: 40, forceHat: 40, activeModule: "autoBreak", enemy: { potentialDamage: 60 } });
  const t2 = held.survival.threats.build(1);
  ok("a hat another module already took is left alone",
     held.survival.defence.decide(1, t2, held.survival.shame) === null);
  ok("and says who has it", held.survival.defence.reason.indexOf("autoBreak") !== -1,
     held.survival.defence.reason);

  const cannot = mkWorld({ hp: 40, canBuy: false, enemy: { potentialDamage: 60 } });
  ok("a hat that is not owned is never asked for",
     cannot.survival.defence.decide(1, cannot.survival.threats.build(1), cannot.survival.shame) === null);
}

console.log("\nDefence — Bull is the shame lever, and only when it is affordable");
{
  /* game_index.js:2422 — only damage arms hitTime, and game_index.js:2317-2318
   * pays healthRegen through changeHealth. Bull's -5 is therefore the only way
   * to arm a hitTime on demand, which is the only thing an eat can answer to
   * take shame down. */
  const w = mkWorld({ hp: 90, shame: 2, enemy: {} });
  w.survival.shame.sync(1);
  const t = w.survival.threats.build(1);
  ok("shame above zero with nothing incoming wears Bull",
     w.survival.defence.decide(1, t, w.survival.shame) === SV_BULL);
  ok("and says what it is for", w.survival.defence.reason.indexOf("-> 0") !== -1, w.survival.defence.reason);

  const clean = mkWorld({ hp: 90, shame: 0, enemy: {} });
  clean.survival.shame.sync(1);
  ok("shame at zero has nothing to clear",
     clean.survival.defence.decide(1, clean.survival.threats.build(1), clean.survival.shame) === null);

  const busy = mkWorld({ hp: 90, shame: 2, enemy: { potentialDamage: 20 } });
  busy.survival.shame.sync(1);
  ok("under fire the 5 health Bull costs is not paid",
     busy.survival.defence.decide(1, busy.survival.threats.build(1), busy.survival.shame) !== SV_BULL);

  const hurt = mkWorld({ hp: 30, shame: 2, enemy: {} });
  hurt.survival.shame.sync(1);
  ok("nor at low health", hurt.survival.defence.decide(1, hurt.survival.threats.build(1), hurt.survival.shame) === null);

  const offbeat = mkWorld({ hp: 90, shame: 2, bullTick: false, enemy: {} });
  offbeat.survival.shame.sync(1);
  ok("and only on the regen beat that actually pays the -5",
     offbeat.survival.defence.decide(1, offbeat.survival.threats.build(1), offbeat.survival.shame) === null);

  const banned = mkWorld({ hp: 90, shame: 2, shameActive: true, enemy: {} });
  banned.survival.shame.sync(1);
  ok("a player already banned gains nothing from it",
     banned.survival.defence.decide(1, banned.survival.threats.build(1), banned.survival.shame) === null);
}

/* =================================================================== plan */
console.log("\nPlan — shame is held at 0, not spent up to 7");
{
  const T = Date.now();
  const w = mkWorld({ hp: 80, shame: 0, receivedDamage: T - 20, enemy: { potentialDamage: 10 } });
  w.survival.postTick();
  /* The old rule was `healing && shameCount < 7`: heal freely while the count
   * is under seven. It would eat here, take the shame, and repeat until 7. */
  ok("a routine top-up inside the window waits instead of eating",
     w.survival.plan.allow === false && w.survival.plan.waitMs > 0,
     w.survival.plan.reason);
  ok("and says how long it is waiting", w.survival.plan.reason.indexOf("ms to safe") !== -1);

  const later = mkWorld({ hp: 80, shame: 0, receivedDamage: T - 400, enemy: { potentialDamage: 10 } });
  later.survival.postTick();
  ok("past the window it eats", later.survival.plan.allow === true);
  ok("and takes two shame off when there is any",
     (() => {
       const r = mkWorld({ hp: 80, shame: 4, receivedDamage: T - 400, enemy: { potentialDamage: 10 } });
       r.survival.postTick();
       return r.survival.plan.reason.indexOf("4 -> 2") !== -1;
     })(), "");

  const quiet = mkWorld({ hp: 80, shame: 0, receivedDamage: null, enemy: {} });
  quiet.survival.postTick();
  ok("with no hit pending an eat cannot move shame, so it tops up freely",
     quiet.survival.plan.allow === true && quiet.survival.plan.reason.indexOf("shame-neutral") !== -1,
     quiet.survival.plan.reason);
}

console.log("\nPlan — the emergency eats through the window, which is the bug that killed");
{
  const T = Date.now();
  /* AntiInsta's comment said the emergency branch deliberately does not wait.
   * It called ModuleHandler.heal(), which queued it to the next tick boundary
   * at or after +130ms — up to ~220ms after the decision, with the follow-up
   * already landed. */
  const w = mkWorld({ hp: 30, shame: 2, receivedDamage: T - 10, enemy: { potentialDamage: 60 } });
  w.survival.postTick();
  ok("a lethal threat eats now, inside the window", w.survival.plan.allow === true);
  ok("and is marked urgent so the heal path lets it through", w.survival.plan.urgent === true);
  ok("naming the threat it is answering", w.survival.plan.reason.indexOf("lethal") === 0, w.survival.plan.reason);
  ok("one shame is the price, and it is worth paying", w.survival.shame.verdict() === "shameful");

  /* The one thing that outranks it: an eat that would trip the thirty-second
   * ban is not a heal, and a banned player cannot heal at all. */
  const nearBan = mkWorld({ hp: 30, shame: 7, receivedDamage: T - 100, enemy: { potentialDamage: 60 } });
  nearBan.survival.postTick();
  ok("except the one eat that would ban, when safety is a tick away",
     nearBan.survival.plan.allow === false, nearBan.survival.plan.reason);
  ok("and it says so", nearBan.survival.plan.reason.indexOf("ban") !== -1);

  const banFar = mkWorld({ hp: 30, shame: 7, receivedDamage: T - 5, enemy: { potentialDamage: 60 } });
  banFar.survival.postTick();
  ok("but when safety is further off than dying, it eats anyway",
     banFar.survival.plan.allow === true && banFar.survival.plan.urgent === true,
     banFar.survival.plan.reason);
}

console.log("\nPlan — reservation, budget and the cases where nothing is done");
{
  const T = Date.now();
  const w = mkWorld({ hp: 40, receivedDamage: T - 400, enemy: { potentialDamage: 60 } });
  w.survival.postTick();
  ok("a lethal threat holds packets for its own heal",
     w.survival.budget.reservations.length === 1, String(w.survival.budget.reservations.length));
  ok("held at lethal priority", w.survival.budget.reservations[0].priority === SV_THREAT.LETHAL);
  ok("and no more than four apples' worth — a reserve, not a hoard",
     w.survival.budget.reservations[0].cost <= SV_HEAL_COST * 4);

  const calm = mkWorld({ hp: 90, receivedDamage: T - 400, enemy: { potentialDamage: 5 } });
  calm.survival.postTick();
  ok("a survivable one holds nothing", calm.survival.budget.reservations.length === 0);

  const broke = mkWorld({ hp: 80, limit: 10, used: 9, receivedDamage: T - 400, enemy: { potentialDamage: 5 } });
  broke.survival.postTick();
  ok("with no room for one apple the plan is empty rather than optimistic",
     broke.survival.plan.count === 0 && broke.survival.plan.allow === false,
     broke.survival.plan.reason);

  const full = mkWorld({ hp: 100, receivedDamage: null, enemy: {} });
  full.survival.postTick();
  ok("full health heals nothing", full.survival.plan.allow === false && full.survival.plan.reason === "full");

  const banned = mkWorld({ hp: 50, shameActive: true, enemy: {} });
  banned.survival.postTick();
  ok("a banned player does not spend packets on food the server refuses",
     banned.survival.plan.allow === false && banned.survival.plan.reason === "food banned");

  const off = mkWorld({ hp: 50, enemy: {} });
  Settings_default._autoheal = false;
  off.survival.postTick();
  ok("the toggle still turns it off", off.survival.plan.allow === false);
  Settings_default._autoheal = true;

  const disabled = mkWorld({ hp: 50, enemy: { potentialDamage: 60 } });
  Settings_default._survivalEngine = false;
  disabled.survival.postTick();
  ok("and the engine switch leaves the old path alone",
     disabled.survival.plan.allow === false && disabled.survival.budget.reservations.length === 0);
  Settings_default._survivalEngine = true;
}

console.log("\nPlan — the top-up is sized to the hole, not to the budget");
{
  const T = Date.now();
  const w = mkWorld({ hp: 41, receivedDamage: null, enemy: {} });
  w.survival.postTick();
  /* 59 missing, apples restore 20: three apples. §27 — the minimum required,
   * not the maximum available. */
  ok("three apples for a 59-point hole", w.survival.plan.count === 3, String(w.survival.plan.count));
  const nearly = mkWorld({ hp: 95, receivedDamage: null, enemy: {} });
  nearly.survival.postTick();
  ok("one for a 5-point one", nearly.survival.plan.count === 1, String(nearly.survival.plan.count));
}

console.log("\nPlan — food already on the wire is not paid for twice");
{
  const w = mkWorld({ hp: 40, receivedDamage: null, enemy: {} });
  w.survival.postTick();
  ok("60 missing asks for three apples", w.survival.plan.count === 3, String(w.survival.plan.count));

  /* tempHealth only moves when the server echoes the new health back. Without
   * this the same hole is paid for once a tick for the whole round trip —
   * three packets an apple, for apples already on their way. */
  for (let i = 0; i < 3; i++) w.survival.noteHealSent(0, 40);
  w.ModuleHandler.tickCount = 1;
  w.survival.postTick();
  ok("the next tick sends nothing while they are unacknowledged",
     w.survival.plan.count === 0 && w.survival.plan.reason === "already in flight",
     w.survival.plan.reason);

  w.myPlayer.tempHealth = 60;
  w.ModuleHandler.tickCount = 2;
  w.survival.postTick();
  ok("health moving is the acknowledgement, and the rest is sent",
     w.survival.plan.count === 2, String(w.survival.plan.count));

  /* A send that never lands must not wedge the heal forever. */
  const lost = mkWorld({ hp: 40, pong: 100, receivedDamage: null, enemy: {} });
  lost.survival.noteHealSent(0, 40);
  lost.ModuleHandler.tickCount = 1;
  ok("still counted one tick later", lost.survival.inFlight(1, 40) === 1);
  ok("but given up on past the round trip", lost.survival.inFlight(9, 40) === 0);
}

/* ================================================================ evasion */
console.log("\nEvasion — the hitbox is the square the server tests, not a circle");
{
  const w = mkProj({});
  const ev = w.survival.evasion;
  /* game_index.js:3106 sweeps the projectile segment against
   * lineInRect(l.x - l.scale, ..., l.x + l.scale, ...) — an axis-aligned square
   * of half-side 35, not a circle of radius 35. The corner of that square is
   * 35*sqrt(2) ≈ 49.5 from the centre, so a shot passing 40 units to the side
   * still hits, and a dodge computed against a circle would stop short. */
  /* A diagonal shot whose closest approach to the player's centre is 40 units:
   * outside a circle of radius 35, but it clips the corner of the square, which
   * reaches 35*sqrt(2) ~ 49.5. A dodge computed against a circle would call
   * this a miss and stand still. */
  const off = 40, k = Math.SQRT1_2;
  const through = { x: -off * k, y: off * k };          // 40 along the normal
  const diag = mkArrow({ x: through.x - 500 * k, y: through.y - 500 * k, angle: Math.PI / 4, range: 1000 });
  const perp = Math.abs((O - diag.pos.current.x) * Math.sin(diag.angle) - (O - diag.pos.current.y) * Math.cos(diag.angle));
  ok("the fixture really does pass 40 units from centre", Math.abs(perp - 40) < 1e-6, perp.toFixed(3));
  ok("40 is outside a circle of the player's radius", 40 > 35);
  ok("but it clips the corner of the square the server tests",
     ev.wouldHit(diag, O, O) === true);

  const shot = mkArrow({ x: -500, y: 20, angle: 0 });
  ok("a straight shot 20 units off-centre hits", ev.wouldHit(shot, O, O) === true);
  ok("one 80 units off does not", ev.wouldHit(mkArrow({ x: -500, y: 80, angle: 0 }), O, O) === false);
  ok("dead centre hits", ev.wouldHit(mkArrow({ x: -500, y: 0, angle: 0 }), O, O) === true);
  ok("a shot already past us does not", ev.wouldHit(mkArrow({ x: 500, y: 0, angle: 0 }), O, O) === false);
  ok("nor one aimed elsewhere", ev.wouldHit(mkArrow({ x: -500, y: 0, angle: Math.PI / 2 }), O, O) === false);
  ok("and moving out of the square clears it", ev.wouldHit(shot, O, O + 200) === false);
}

console.log("\nEvasion — it steps, and only perpendicular");
{
  const w = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ] });
  const dir = w.survival.evasion.decide(1, w.survival.budget, 120);
  ok("an incoming arrow gets a sidestep", dir !== null, w.survival.evasion.reason);
  ok("perpendicular to the shot, not away from it",
     dir !== null && Math.abs(Math.abs(dir) - Math.PI / 2) < 1e-9, String(dir));
  ok("and it says why", w.survival.evasion.reason.indexOf("incoming") !== -1, w.survival.evasion.reason);
  ok("the step actually clears the shot",
     (() => {
       const to = w.survival.evasion.walk(dir, 3);
       return !w.survival.evasion.wouldHit(w.survival.evasion.incoming[0], to.x, to.y);
     })());
}

console.log("\nEvasion — every shot type the brief names");
{
  /* Projectiles[0] bow, [2] crossbow, [3] repeater, [5] musket, [1] and [4]
   * the turret ones. All are dodged; none is special-cased. */
  for (const [label, type] of [["hunting bow", 0], ["crossbow", 2], ["repeater crossbow", 3], ["musket", 5], ["turret", 1], ["turret gear", 4]]) {
    const w = mkProj({ projectiles: [ mkArrow({ x: -600, y: 0, angle: 0, type }) ] });
    ok(label + " is dodged", w.survival.evasion.decide(1, w.survival.budget, 120) !== null,
       w.survival.evasion.reason);
  }
}

console.log("\nEvasion — nothing around, or nothing happens");
{
  /* The user's condition: only when the ground is clear. The step is judged by
   * the client's own MovementSimulation, so a wall is not a special case — it
   * simply stops the step, and a step that did not move is refused. */
  const wall = { id: 9, type: 3, ownerID: 2, layer: 0, scale: 50, collisionScale: 50,
                 canMoveOnTop: () => false, isSpike: false,
                 pos: { current: vec(0, 70) } };

  const blocked = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ], objects: [wall, mirror(wall, 0, -70)] });
  ok("walls on both sides mean no step is taken at all",
     blocked.survival.evasion.decide(1, blocked.survival.budget, 120) === null,
     blocked.survival.evasion.reason);
  ok("and it says the ground was not clear",
     blocked.survival.evasion.reason === "no safe step", blocked.survival.evasion.reason);

  const oneSide = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ], objects: [wall] });
  const dir = oneSide.survival.evasion.decide(1, oneSide.survival.budget, 120);
  ok("a wall on one side leaves the other", dir !== null, oneSide.survival.evasion.reason);
  ok("and the step goes away from the wall", dir !== null && Math.sin(dir) < 0, String(dir));
}

console.log("\nEvasion — never into something worse");
{
  const spike = { id: 8, type: 6, ownerID: 2, layer: 0, scale: 50, collisionScale: 50, isSpike: true,
                  canMoveOnTop: () => false,
                  pos: { current: vec(0, 60) } };
  const w = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ], objects: [spike, mirror(spike, 0, -60)] });
  ok("spikes on both sides mean the shot is taken instead",
     w.survival.evasion.decide(1, w.survival.budget, 120) === null, w.survival.evasion.reason);

  const trap = { id: 7, type: 15, ownerID: 2, layer: -1, scale: 45, collisionScale: 45, isSpike: false,
                 canMoveOnTop: () => true,
                 pos: { current: vec(0, 55) } };
  const t = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ], objects: [trap, mirror(trap, 0, -55)] });
  ok("enemy traps on both sides likewise",
     t.survival.evasion.decide(1, t.survival.budget, 120) === null, t.survival.evasion.reason);

  /* Stepping inside a polearm's reach to dodge an arrow trades one threat for
   * a worse one. */
  const melee = mkProj({
    projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ],
    enemyAt: { x: 0, y: 120 }
  });
  const d = melee.survival.evasion.decide(1, melee.survival.budget, 120);
  ok("and it never steps into melee reach it was outside of",
     d === null || Math.sin(d) < 0, String(d));
}

console.log("\nEvasion — no false positives");
{
  const none = mkProj({ projectiles: [] });
  ok("no shots, no movement", none.survival.evasion.decide(1, none.survival.budget, 120) === null);
  ok("and it says so", none.survival.evasion.reason === "nothing incoming");

  const miss = mkProj({ projectiles: [ mkArrow({ x: -500, y: 300, angle: 0 }) ] });
  ok("a shot that will miss is not dodged",
     miss.survival.evasion.decide(1, miss.survival.budget, 120) === null, miss.survival.evasion.reason);

  /* Cover between us and the shot: game_index.js:3113 stops the projectile on
   * the first blocking object, so the shot was never going to land. */
  const cover = { id: 6, type: 4, ownerID: 1, layer: 0, scale: 50, collisionScale: 50, isSpike: false,
                  canMoveOnTop: () => false,
                  pos: { current: vec(-60, 0) } };
  const behind = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ], objects: [cover] });
  ok("a shot a wall will eat is not dodged",
     behind.survival.evasion.decide(1, behind.survival.budget, 120) === null, behind.survival.evasion.reason);

  const late = mkProj({ projectiles: [ mkArrow({ x: -60, y: 0, angle: 0 }) ] });
  ok("a shot arriving sooner than we can move is not chased",
     late.survival.evasion.decide(1, late.survival.budget, 400) === null, late.survival.evasion.reason);
  ok("and it says there was no time", late.survival.evasion.reason === "no time to move");

  const off = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ] });
  Settings_default._microEvasion = false;
  ok("the toggle turns it off", off.survival.evasion.decide(1, off.survival.budget, 120) === null);
  Settings_default._microEvasion = true;
}

console.log("\nEvasion — reversible, budgeted, and it clears every shot at once");
{
  /* Two shots crossing: a step that clears one and walks into the other is not
   * a dodge. */
  const cross = mkProj({ projectiles: [
    mkArrow({ x: -500, y: 0, angle: 0 }),
    mkArrow({ x: 0, y: -500, angle: Math.PI / 2 })
  ] });
  const d = cross.survival.evasion.decide(1, cross.survival.budget, 120);
  ok("a step is only taken if it clears both",
     d === null || cross.survival.evasion.incoming.every(p => {
       const to = cross.survival.evasion.walk(d, 3);
       return !cross.survival.evasion.wouldHit(p, to.x, to.y);
     }), String(d));

  const w = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ] });
  w.survival.evasion.decide(1, w.survival.budget, 120);
  ok("it is active while the shot is in the air", w.survival.evasion.active === true);
  w.client.ProjectileManager.dangerProjectiles = new Set();
  w.survival.evasion.decide(5, w.survival.budget, 120);
  ok("and released once nothing is incoming", w.survival.evasion.active === false);
  ok("held for a tick or two first, so a volley is one move not three",
     (() => {
       const v = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ] });
       v.survival.evasion.decide(1, v.survival.budget, 120);
       v.client.ProjectileManager.dangerProjectiles = new Set();
       return v.survival.evasion.decide(2, v.survival.budget, 120) !== null;
     })());

  const broke = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ], limit: 10, used: 9 });
  ok("no packets, no step",
     broke.survival.evasion.decide(1, broke.survival.budget, 120) === null, broke.survival.evasion.reason);
}

console.log("\nEvasion — it drives the client's own movement channel");
{
  const w = mkProj({ projectiles: [ mkArrow({ x: -500, y: 0, angle: 0 }) ] });
  w.survival.postTick();
  ok("the step is published on moveTo, the channel AutoPush already uses",
     typeof w.ModuleHandler.moveTo === "number", String(w.ModuleHandler.moveTo));
  w.client.ProjectileManager.dangerProjectiles = new Set();
  w.ModuleHandler.tickCount = 6;
  w.survival.postTick();
  ok("and handed back to the player when it is over",
     w.ModuleHandler.moveTo === "disable", String(w.ModuleHandler.moveTo));
}

/* ============================================================== scenarios */
console.log("\nScenarios — §36's list, end to end through the plan");
{
  const T = Date.now();
  const run = (label, opts, expect) => {
    const w = mkWorld(opts);
    w.survival.postTick();
    const t = w.survival.threats;
    const got = {
      kind: t.top ? t.top.kind : null,
      urgent: w.survival.plan.urgent,
      soldier: w.survival.wantSoldier
    };
    const good = (expect.kind === undefined || got.kind === expect.kind)
      && (expect.urgent === undefined || got.urgent === expect.urgent)
      && (expect.soldier === undefined || got.soldier === expect.soldier);
    ok(label, good, JSON.stringify(got));
  };

  run("anti velocity tick / spike sync", { hp: 60, receivedDamage: T - 400, enemy: { potentialDamage: 30, spikeSyncThreat: true } }, { kind: "spikeSync", soldier: true });
  run("anti insta kill", { hp: 30, receivedDamage: T - 400, enemy: { potentialDamage: 45 } }, { kind: "lethal", urgent: true, soldier: true });
  run("anti reverse insta kill", { hp: 60, receivedDamage: T - 400, enemy: { potentialDamage: 30, reverseInsta: true } }, { kind: "reverseInsta", soldier: true });
  run("anti primary + musket / bow", { hp: 60, receivedDamage: T - 400, enemy: { potentialDamage: 40, rangedBowInsta: true } }, { kind: "rangedInsta", soldier: true });
  run("anti spike push", { hp: 70, receivedDamage: T - 400, enemy: { potentialDamage: 10, willCollideSpike: true, potentialSpikeDamage: 25 } }, { kind: "spikePush", soldier: true });
  run("anti kb tick", { hp: 70, receivedDamage: T - 400, enemy: { potentialDamage: 10, possibleToKnockback: true, potentialSpikeKnockbackDamage: 25 } }, { kind: "kbTick", soldier: true });
  run("anti spike tick, before the trap breaks", { hp: 70, trapped: true, receivedDamage: T - 400, enemy: { potentialDamage: 10, enemyCanPlaceSpike: true } }, { kind: "spikeTick", soldier: true });
  run("anti one tick / tool hammer", { hp: 70, receivedDamage: T - 400, enemy: { potentialDamage: 35, toolHammerInsta: true } }, { kind: "toolHammerInsta", soldier: true });
  run("anti turret stack", { hp: 60, receivedDamage: T - 400, objects: [turret(1, 100, 0, 2), turret(2, 200, 0, 2), turret(3, 300, 0, 2)], enemy: { potentialDamage: 10 } }, { kind: "turretStack", soldier: true });
  run("multiple simultaneous threats", { hp: 30, receivedDamage: T - 400, enemy: { potentialDamage: 60, collidingSpike: true, potentialSpikeDamage: 25, reverseInsta: true } }, { urgent: true, soldier: true });
  run("high ping", { hp: 30, pong: 300, receivedDamage: T - 10, enemy: { potentialDamage: 60 } }, { urgent: true });
  run("low packet budget", { hp: 30, limit: 12, used: 6, receivedDamage: T - 400, enemy: { potentialDamage: 60 } }, { urgent: true });
  run("trap-enclosed player", { hp: 50, trapped: true, receivedDamage: T - 400, enemy: { potentialDamage: 20 } }, { kind: "trapped", soldier: true });

  /* Spam shame: repeated small hits, none of them close to lethal. The old
   * rule healed each one immediately and took the shame each time. */
  const spam = mkWorld({ hp: 85, shame: 1, receivedDamage: T - 30, enemy: { potentialDamage: 12 } });
  spam.survival.postTick();
  ok("anti spam shame — a scratch does not buy an eat inside the window",
     spam.survival.plan.allow === false, spam.survival.plan.reason);

  const spam2 = mkWorld({ hp: 85, shame: 1, receivedDamage: T - 400, enemy: { potentialDamage: 12 } });
  spam2.survival.postTick();
  ok("and the same scratch answered late takes shame back down",
     spam2.survival.plan.allow === true && spam2.survival.plan.reason.indexOf("1 -> 0") !== -1,
     spam2.survival.plan.reason);

  /* Unstable ping: the allowance grows, and the plan still resolves. */
  const jitter = mkWorld({ hp: 40, pong: 60, receivedDamage: T - 400, enemy: { potentialDamage: 50 } });
  for (let i = 0; i < 8; i++) { jitter.client.SocketManager.pong = i % 2 ? 220 : 40; jitter.survival.threats._samplePong(); }
  jitter.survival.postTick();
  ok("unstable ping — the reaction allowance widens with the swing",
     jitter.survival.threats.reactionTicks() >= 2, String(jitter.survival.threats.reactionTicks()));
}

/* ================================================================ wiring */
console.log("\nWiring — static checks on the built client");
{
  ok("there is one heal door, and it takes an urgent flag",
     built.includes("heal(urgent = false) {"));
  ok("the old queue-everything shame guard is gone",
     !built.includes("_SHAME_GUARD_MARGIN") && !built.includes("_flushShameHealQueue"));
  ok("AntiSync no longer runs a heal scheduler of its own",
     !built.includes("_pendingHealDeadline = Date.now() + this._SHAME_SAFE_DELAY"));
  ok("no heal path still gates on a shame count of seven",
     !built.includes("myPlayer.shameCount < 7"));
  ok("the emergency is the only thing that eats inside the window",
     built.includes("if (!urgent && !(myPlayer && myPlayer.isSandbox) && survival.shame.verdict() === \"shameful\") return false;"));
  ok("and even it stops short of the ban",
     built.includes("if (urgent && survival.shame.wouldBan()) return false;"));
  ok("survival is registered as a module", built.includes("survival: new SurvivalEngine_default(client2),"));
  ok("ShameReset defers its hat to the defence manager",
     built.includes("if (Settings_default._survivalEngine && ModuleHandler.staticModules.survival) return;"));
  ok("Safe Soldier is extended, not rewritten",
     built.includes("|| _safeSoldier || _survivalSoldier)") && built.includes("const _safeSoldier = Settings_default._safeSoldier && _dist < SAFE_SOLDIER_RANGE;"));
  ok("only one packet budget class exists",
     (built.match(/class PacketBudget/g) || []).length === 1);
  ok("only one shame engine exists",
     (built.match(/class ShameEngine/g) || []).length === 1);
  /* §Do-not-modify list: these systems keep their own code. */
  for (const [label, marker] of [
    ["Spike Tick", "class SpikeTickController"],
    ["Auto Mills", "class Automill"],
    ["Velocity Tick", "class TrapTick"],
    ["the placement engine", "class RynPlacementEngine"],
    ["Auto Placer", "class AutoPlacer"]
  ]) {
    ok(label + " is still present and untouched by name", built.indexOf(marker) !== -1);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
