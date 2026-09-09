#!/usr/bin/env node
"use strict";

// Exercises the defensive core out of Ryn_Type_2.user.js against the game's own
// data tables, which are lifted verbatim out of the same file (and are checked
// against src/game_index.js by verify-drivers.js). Everything the core touches
// that is not a data table is stubbed here, so a failure is a failure in the
// core's logic rather than in the harness.
//
//     node tools/test-defense-core.js [path/to/client.user.js]

const fs = require("fs");
const path = require("path");

const FILE = process.argv[2] || path.join(__dirname, "..", "Ryn_Type_2.user.js");
const src = fs.readFileSync(FILE, "utf8");

// ── extraction ──────────────────────────────────────────────────────────────
function between(start, end, label) {
  const i = src.indexOf(start);
  if (i < 0) throw new Error("missing start anchor for " + label);
  const j = src.indexOf(end, i);
  if (j < 0) throw new Error("missing end anchor for " + label);
  return src.slice(i, j + end.length);
}

// Top-level declarations are sequential and two-space indented, so a
// declaration runs until the next one starts.
function decl(name) {
  const start = "  const " + name + " = ";
  const i = src.indexOf(start);
  if (i < 0) throw new Error("missing declaration " + name);
  const j = src.indexOf("\n  const ", i + 1);
  const k = src.indexOf("\n  class ", i + 1);
  const end = Math.min(j < 0 ? Infinity : j, k < 0 ? Infinity : k);
  return src.slice(i, end === Infinity ? src.length : end);
}

const tables = [ "Weapons", "Items", "Projectiles", "WeaponVariants", "Hats", "Accessories" ].map(decl).join("\n");
const dataHandler = between("  const DataHandler = new class {", "  const DataHandler_default = DataHandler;", "DataHandler");
const angleUtil = decl("getAngleDist");
const core = between("  // DEFENSIVE CORE", "  const DefenseCore_default = DefenseCore;", "DefenseCore");
const shame = between("  // ANTI CLOWN — shame recovery", "  const ShameReset_default = ShameReset;", "ShameReset");

// ── stubs ───────────────────────────────────────────────────────────────────
const PRELUDE = `
  const PI = Math.PI;
  const Settings_default = { _autoheal: true };
  const GameUI_default = { updateDangerState() {} };
  class PlayerObject {}
  const Math_LN1 = 100;
`;

const bundle = new Function(
  "exports",
  '"use strict";' + PRELUDE + tables + "\n" + dataHandler + "\n" + angleUtil + "\n" + core + "\n" + shame + "\n" +
  "exports.DefenseCore = DefenseCore;" +
  "exports.ShameReset = ShameReset;" +
  "exports.PlayerObject = PlayerObject;" +
  "exports.Settings = Settings_default;" +
  "exports.Hats = Hats;" +
  "exports.Items = Items;" +
  "exports.Weapons = Weapons;" +
  "exports.Projectiles = Projectiles;"
);
const M = {};
bundle(M);

// ── world stubs ─────────────────────────────────────────────────────────────
const TICK = 1000 / 9;

class Vec {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
  addDirection(a, d) { return new Vec(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d); }
}

function pos(x, y, fx, fy) {
  return { current: new Vec(x, y), previous: new Vec(x, y), future: new Vec(fx === undefined ? x : fx, fy === undefined ? y : fy) };
}

let nextId = 1;
function makeEnemy(opt) {
  const o = Object.assign({
    primary: 5, secondary: 10, hatID: 0, futureHat: 0,
    x: 0, y: 0, fx: undefined, fy: undefined, angle: 0,
    primaryReady: true, secondaryReady: true, turretReady: false,
    trapped: false, potentialDamage: 0, canPlaceSpike: false, variant: 0
  }, opt);
  return {
    id: nextId++,
    weapon: { primary: o.primary, secondary: o.secondary, current: o.primary },
    hatID: o.hatID, futureHat: o.futureHat, angle: o.angle,
    pos: pos(o.x, o.y, o.fx, o.fy),
    hitScale: 35, scale: 35, collisionScale: 35, seenBefore: true,
    isTrapped: o.trapped, potentialDamage: o.potentialDamage, canPlaceSpike: o.canPlaceSpike,
    _v: o.variant,
    isReloaded(type) {
      return type === 0 ? o.primaryReady : type === 1 ? o.secondaryReady : o.turretReady;
    },
    // Same shape as Player.getMaxWeaponDamage in the client.
    getMaxWeaponDamage(id, shield, addBull = true) {
      if (id == null) return 0;
      const w = M.Weapons[id];
      if (!w) return 0;
      if ("damage" in w) {
        let d = w.damage;
        if (addBull) d *= M.Hats[7].dmgMultO;
        d *= [ 1, 1.1, 1.18, 1.18 ][this._v];
        return d;
      }
      if ("projectile" in w) return M.Projectiles[w.projectile].damage;
      return 0;
    },
    getActualMaxKnockback() { return o.kb === undefined ? 0 : o.kb; }
  };
}

function makeWorld(opt) {
  opt = opt || {};
  const enemies = opt.enemies || [];
  const spikes = opt.spikes || [];
  const equipLog = [];
  const wire = [];

  const myPlayer = {
    inGame: true, id: 0,
    pos: pos(opt.x || 0, opt.y || 0, opt.fx, opt.fy),
    hitScale: 35, scale: 35, collisionScale: 35,
    hatID: opt.hatID === undefined ? 0 : opt.hatID,
    maxHealth: 100,
    tempHealth: opt.health === undefined ? 100 : opt.health,
    currentHealth: opt.health === undefined ? 100 : opt.health,
    receivedDamage: opt.receivedDamage === undefined ? null : opt.receivedDamage,
    shameActive: !!opt.shameActive,
    shameCount: opt.shameCount || 0,
    poisonCount: 0,
    isDmgOverTime: false,
    isTrapped: !!opt.trapped,
    trappedIn: opt.trappedIn || null,
    damages: (opt.damages || []).slice(),
    speed: 0,
    weapon: { primary: opt.primary === undefined ? 5 : opt.primary, secondary: opt.secondary === undefined ? 10 : opt.secondary },
    inventory: { 0: opt.primary === undefined ? 5 : opt.primary, 1: opt.secondary === undefined ? 10 : opt.secondary, 2: 0 },
    getItemByType(t) { return this.inventory[t] === undefined ? null : this.inventory[t]; },
    isBullTickTime() { return false; },
    wasTrapped() { return false; },
    collidingEntity(e, range) { return this.pos.current.distance(e.pos.current) <= range; },
    collidingSimple(o2, range) { return this.pos.current.distance(o2.pos.current) <= range; },
    getBuildingDamage() { return opt.buildingDamage === undefined ? 0 : opt.buildingDamage; },
    getMaxBuildingDamage() { return opt.breakDamage === undefined ? null : opt.breakDamage; },
    getMaxWeaponDamage(id, shield, addBull = true) {
      const w = M.Weapons[id];
      if (!w || !("damage" in w)) return 0;
      return w.damage * (addBull ? M.Hats[7].dmgMultO : 1);
    }
  };

  const EnemyManager = Object.assign({
    potentialDamage: 0, potentialSpikeDamage: 0, possibleToKnockback: false,
    collidingSpike: false, willCollideSpike: false, pushingOnSpike: false,
    spikeSyncThreat: false, detectedEnemy: false, detectedDangerEnemy: false,
    nearestEnemy: enemies[0] || null, nearestSpike: null,
    instaThreat() { return !!opt.instaThreat; },
    nearestEnemyInRangeOf(range, t) { return t !== null && t !== undefined && myPlayer.pos.current.distance(t.pos.current) <= range; }
  }, opt.enemyManager || {});

  const ModuleHandler = {
    tickCount: opt.tick === undefined ? 100 : opt.tick,
    moduleActive: false, defenseClaim: false, defenseAllowBreak: false,
    defenseLock: opt.defenseLock || 0, defenseHat: opt.defenseHat === undefined ? null : opt.defenseHat, defenseReason: null,
    moveTo: "disable", forceHat: null, currentType: null, healedOnce: false,
    get defenseActive() { return this.defenseLock > 0; },
    lockDefense(hat, ticks, reason) {
      if (ticks <= 0) return;
      if (ticks > this.defenseLock) this.defenseLock = ticks;
      this.defenseHat = hat;
      this.defenseReason = reason || null;
    },
    canBuy() { return opt.canBuy === undefined ? true : opt.canBuy; },
    hasStoreItem() { return opt.hasStoreItem === undefined ? true : opt.hasStoreItem; },
    forceWeapon: null, useAngle: null, shouldAttack: false,
    heal() { wire.push("heal"); },
    staticModules: { reloading: { isReloaded(t) { return opt.myReload === undefined ? true : opt.myReload[t]; } } },
    // The real gate from ModuleHandler._equip, reproduced exactly.
    _equip(type, id, force = false) {
      if (type === 0 && !force && this.defenseLock > 0 && this.defenseHat !== null) {
        if (!(this.defenseAllowBreak && id === 40)) id = this.defenseHat;
      }
      equipLog.push([ type, id ]);
      return true;
    }
  };

  const ObjectManager = {
    objects: new Map(spikes.map((sp, i) => [ i, sp ])),
    grid2D: { query(x, y, r, cb) { for (const k of ObjectManager.objects.keys()) if (cb(k) === true) return; } }
  };

  const client = {
    isOwner: true, myPlayer: myPlayer, EnemyManager: EnemyManager,
    _ModuleHandler: ModuleHandler, ObjectManager: ObjectManager,
    SocketManager: { TICK: TICK },
    ProjectileManager: { totalDamage: opt.projectileDamage || 0 },
    PlayerManager: { enemies: enemies, isEnemyByID() { return true; } }
  };
  return { client, myPlayer, EnemyManager, ModuleHandler, equipLog, wire };
}

function spike(x, y, dmg) {
  const o = new M.PlayerObject();
  o.itemGroup = 2; o.ownerID = 999; o.isCactus = false;
  o.pos = pos(x, y); o.collisionScale = 35; o.scale = 35; o.health = 400;
  o.getDamage = () => dmg;
  return o;
}

// ── assertions ──────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail === undefined ? "" : "  -> " + detail)); }
}
function section(t) { console.log("\n" + t); }

const NOW = Date.now();

// ── 1. shame arithmetic, straight off the server rule ───────────────────────
section("Shame accounting (game_index.js buildItem)");
{
  const w = makeWorld({ health: 60, receivedDamage: NOW });
  const core = new M.DefenseCore(w.client);
  check("inside the 120ms window a heal costs +1", core.shameCostOfHealingNow() === 1);
  check("and the core knows how long to wait", core.ticksUntilFreeHeal() >= 1);

  const w2 = makeWorld({ health: 60, receivedDamage: NOW - 400 });
  const c2 = new M.DefenseCore(w2.client);
  check("past the window a heal is worth -2", c2.shameCostOfHealingNow() === -2);
  check("and needs no wait", c2.ticksUntilFreeHeal() === 0);

  const w3 = makeWorld({ health: 60, receivedDamage: null });
  const c3 = new M.DefenseCore(w3.client);
  check("with no outstanding hit a heal is free", c3.shameCostOfHealingNow() === 0);
}

// ── 2. the zero-shame heal ──────────────────────────────────────────────────
section("Zero-shame healing");
{
  // Hurt, nothing threatening, hit is fresh: the heal waits.
  const w = makeWorld({ health: 60, receivedDamage: NOW });
  const core = new M.DefenseCore(w.client);
  core.postTick();
  check("non-lethal damage inside the window does not eat", w.wire.length === 0, "wire=" + w.wire.length);
  check("and nothing is locked for it", w.ModuleHandler.defenseLock === 0);

  // Same state, window elapsed.
  const w2 = makeWorld({ health: 60, receivedDamage: NOW - 300 });
  const c2 = new M.DefenseCore(w2.client);
  c2.postTick();
  check("once the window passes it eats (worth -2 shame)", w2.wire.length === 2, "apples=" + w2.wire.length);

  // Free heal: no outstanding hit at all.
  const w3 = makeWorld({ health: 60, receivedDamage: null });
  const c3 = new M.DefenseCore(w3.client);
  c3.postTick();
  check("a free heal is taken immediately", w3.wire.length === 2);
}

// ── 3. the emergency trade ──────────────────────────────────────────────────
section("Emergency healing");
{
  const w = makeWorld({
    health: 40, receivedDamage: NOW,
    enemyManager: { potentialDamage: 90 }
  });
  const core = new M.DefenseCore(w.client);
  core.postTick();
  check("lethal damage heals inside the window anyway", w.wire.length === 3, "apples=" + w.wire.length);
  check("and it is flagged as the emergency branch", core.forceHeal === true);
  check("and it locks the defensive hat", w.ModuleHandler.defenseLock > 0 && w.ModuleHandler.defenseHat === 6);
  check("and it claims the tick from the engine", w.ModuleHandler.moduleActive === true);
}
{
  // Whiteout's backstop: one more of what just landed would finish us.
  const w = makeWorld({ health: 55, receivedDamage: NOW, damages: [ 50 ] });
  const core = new M.DefenseCore(w.client);
  core.postTick();
  check("a hit that would kill on repeat heals now", w.wire.length > 0);
}

{
  // Soldier not owned: the lock must not engage, or it would rewrite every
  // equip request into one the store refuses and freeze the hat entirely.
  const w = makeWorld({ health: 40, receivedDamage: NOW, canBuy: false, enemyManager: { potentialDamage: 90 } });
  const core = new M.DefenseCore(w.client);
  core.postTick();
  check("no lock is raised for a hat we do not own", w.ModuleHandler.defenseLock === 0);
  check("but the emergency heal still goes out", w.wire.length > 0);
}

// ── 4. clown ────────────────────────────────────────────────────────────────
section("Clown state");
{
  const w = makeWorld({ health: 30, shameActive: true, receivedDamage: NOW - 300, enemyManager: { potentialDamage: 90 } });
  const core = new M.DefenseCore(w.client);
  core.postTick();
  check("no apples are spent while the server refuses food", w.wire.length === 0);
  check("but the defensive hat is still locked on", w.ModuleHandler.defenseLock > 0);
}

// ── 5. anti spike tick: displacement vs tanking ─────────────────────────────
section("Anti spike tick");
{
  // Both of us inside a trap: no room to push, so the answer is hat + food.
  const enemy = makeEnemy({ x: 60, y: 0, primary: 5, trapped: true, canPlaceSpike: true });
  const w = makeWorld({
    health: 70, trapped: true, trappedIn: { ownerID: 999, health: 500 },
    enemies: [ enemy ],
    enemyManager: { collidingSpike: true, potentialSpikeDamage: 45, spikeSyncThreat: true, nearestEnemy: enemy }
  });
  const core = new M.DefenseCore(w.client);
  const t = core.assess([ enemy ]);
  check("trapped together reads as spike tick", t.reason === 1, "reason=" + t.reason);
  check("displacement is refused when both are held", t.canDisplace === false);
  check("and the threat is lethal", t.level === 3, "level=" + t.level);
}
{
  // Free, enemy in reach, our primary up: push instead of tank.
  const enemy = makeEnemy({ x: 100, y: 0, primary: 5, canPlaceSpike: true });
  const w = makeWorld({
    health: 70, enemies: [ enemy ], primary: 5,
    enemyManager: { willCollideSpike: true, potentialSpikeDamage: 45, spikeSyncThreat: true, nearestEnemy: enemy }
  });
  const core = new M.DefenseCore(w.client);
  const t = core.assess([ enemy ]);
  check("with room, displacement is the answer", t.canDisplace === true);
  core.postTick();
  check("so the tick is claimed for the push", w.ModuleHandler.shouldAttack === true && w.ModuleHandler.forceWeapon === 0);
  check("with turret gear on for the knockback", w.ModuleHandler.defenseHat === 53 && w.ModuleHandler.defenseLock === 1);
  check("and the heal is still armed", core.armedUntil > w.ModuleHandler.tickCount);
}
{
  // Same shape, but inside the band where Soldier is the thing that saves us:
  // 45 spike + 30 daggers = 75 against 70 health kills bare and does not kill
  // in Soldier (56.25). The hat wins the tick, not the push.
  const enemy = makeEnemy({ x: 80, y: 0, primary: 7, canPlaceSpike: true });
  const w = makeWorld({
    health: 70, enemies: [ enemy ], primary: 7,
    enemyManager: { willCollideSpike: true, potentialSpikeDamage: 45, spikeSyncThreat: true, nearestEnemy: enemy }
  });
  const core = new M.DefenseCore(w.client);
  core.postTick();
  check("the push is refused where Soldier is decisive", w.ModuleHandler.shouldAttack === false, "raw=" + core.threat.raw);
  check("and Soldier is locked on instead", w.ModuleHandler.defenseHat === 6 && w.ModuleHandler.defenseLock === 3);
}
{
  // Colliding with a spike we can break outright: the break is sanctioned, so
  // Autobreak's tank gear is let through the lock for that one tick.
  const enemy = makeEnemy({ x: 60, y: 0, primary: 5, trapped: true });
  const sp = spike(40, 0, 45);
  const w = makeWorld({
    health: 60, trapped: true, trappedIn: { ownerID: 999, health: 500 },
    enemies: [ enemy ], breakDamage: 500,
    enemyManager: { collidingSpike: true, potentialSpikeDamage: 45, spikeSyncThreat: true, nearestEnemy: enemy, nearestSpike: sp }
  });
  const core = new M.DefenseCore(w.client);
  core.postTick();
  check("breaking the spike is sanctioned", w.ModuleHandler.defenseAllowBreak === true);
}

// ── 6. anti velocity tick ───────────────────────────────────────────────────
section("Anti velocity tick");
{
  const mk = gap => {
    const e = makeEnemy({ x: gap, y: 0, fx: gap, fy: 0, hatID: 53, primary: 5, primaryReady: true, turretReady: false });
    const w = makeWorld({ health: 80, enemies: [ e ], enemyManager: { nearestEnemy: e } });
    const core = new M.DefenseCore(w.client);
    return { t: core.assess([ e ]), core, w };
  };
  check("220px (critical band) arms and locks", (() => { const r = mk(220); return r.t.reason === 6 && r.t.level >= 2 && r.t.armTicks === 3; })());
  check("360px (boost-tick band) arms and locks", (() => { const r = mk(360); return r.t.reason === 6 && r.t.level >= 2; })());
  check("280px (between bands) only watches", (() => { const r = mk(280); return r.t.level === 1; })());
  check("500px is out of the window entirely", (() => { const r = mk(500); return r.t.level === 0; })());
}

// ── 7. anti musket insta ────────────────────────────────────────────────────
section("Anti musket insta");
{
  const shooter = makeEnemy({ x: 1200, y: 0, secondary: 15, secondaryReady: true, angle: Math.PI });
  const w = makeWorld({ health: 45, enemies: [ shooter ], enemyManager: { nearestEnemy: shooter } });
  const core = new M.DefenseCore(w.client);
  const t = core.assess([ shooter ]);
  check("a musket aimed from 1200 is seen", t.reason === 5, "reason=" + t.reason);
  check("50 damage against 45 health is lethal", t.level === 3, "level=" + t.level);
  check("and it is armed before the shot", t.armTicks === 3);
}
{
  const shooter = makeEnemy({ x: 1200, y: 0, secondary: 15, secondaryReady: true, angle: 0 });
  const w = makeWorld({ health: 45, enemies: [ shooter ] });
  const core = new M.DefenseCore(w.client);
  const t = core.assess([ shooter ]);
  check("a musket pointed away is not a threat", t.level === 0, "level=" + t.level);
}
{
  const shooter = makeEnemy({ x: 1900, y: 0, secondary: 15, secondaryReady: true, angle: Math.PI });
  const w = makeWorld({ health: 45, enemies: [ shooter ] });
  const core = new M.DefenseCore(w.client);
  check("past 1700 it is not tracked", core.assess([ shooter ]).level === 0);
}

// ── 9. observed damage becomes prediction ───────────────────────────────────
section("Damage attribution (Chicken/Falcon interpretDamage)");
{
  // Polearm swing lands (45 * 1.5 bull = 67.5); their hammer is still loaded.
  const e = makeEnemy({ x: 60, y: 0, primary: 5, secondary: 10, hatID: 7, primaryReady: false, secondaryReady: true });
  const w = makeWorld({ health: 90, enemies: [ e ], damages: [ 45 * 1.5 ] });
  const core = new M.DefenseCore(w.client);
  core.postTick();
  check("the swing is attributed to their primary", core.tickHits[0].slot === 0, "slot=" + (core.tickHits[0] && core.tickHits[0].slot));
  check("and the loaded secondary is priced as follow-up", core.threat.raw > 0, "raw=" + core.threat.raw);
}

// ── 10. the lock ────────────────────────────────────────────────────────────
section("Defensive hat lock");
{
  const w = makeWorld({ defenseLock: 3, defenseHat: 6 });
  w.ModuleHandler._equip(0, 40);
  check("tank gear is refused while locked", w.equipLog[0][1] === 6, JSON.stringify(w.equipLog[0]));
  w.ModuleHandler._equip(0, 7);
  check("bull hat is refused too", w.equipLog[1][1] === 6);
  w.ModuleHandler.defenseAllowBreak = true;
  w.ModuleHandler._equip(0, 40);
  check("a sanctioned break gets tank gear for one tick", w.equipLog[2][1] === 40);
  w.ModuleHandler.defenseAllowBreak = false;
  w.ModuleHandler._equip(0, 40);
  check("and the very next request snaps back", w.equipLog[3][1] === 6);
  w.ModuleHandler._equip(0, 12, true);
  check("the player's own store click still passes", w.equipLog[4][1] === 12);
  w.ModuleHandler._equip(1, 13);
  check("accessories are not routed by the hat lock", w.equipLog[5][1] === 13);
}

// ── 11. shame recovery ──────────────────────────────────────────────────────
section("Anti clown / shame recovery");
{
  const w = makeWorld({ health: 90, shameCount: 3 });
  w.EnemyManager.nearestEnemy = null;
  const sr = new M.ShameReset(w.client);
  sr.postTick();
  check("shame above 1 puts the bull hat on immediately", w.ModuleHandler.forceHat === 7);
}
{
  const e = makeEnemy({ x: 80, y: 0 });
  const w = makeWorld({ health: 90, shameCount: 3, enemies: [ e ], enemyManager: { potentialDamage: 45, nearestEnemy: e } });
  const sr = new M.ShameReset(w.client);
  sr.postTick();
  check("but never while something can hit us", w.ModuleHandler.forceHat === null);
}
{
  const w = makeWorld({ health: 90, shameCount: 3, defenseLock: 2, defenseHat: 6 });
  w.EnemyManager.nearestEnemy = null;
  const sr = new M.ShameReset(w.client);
  sr.postTick();
  check("and never against the defensive lock", w.ModuleHandler.forceHat === null);
}
{
  const w = makeWorld({ health: 12, shameCount: 3 });
  w.EnemyManager.nearestEnemy = null;
  const sr = new M.ShameReset(w.client);
  sr.postTick();
  check("and never when the drain itself is dangerous", w.ModuleHandler.forceHat === null);
}
{
  // Already hurt with a hit on the clock: the core's own late heal is worth the
  // same -2, so manufacturing damage here would be pure loss.
  const w = makeWorld({ health: 70, shameCount: 3, receivedDamage: NOW - 300 });
  w.EnemyManager.nearestEnemy = null;
  const sr = new M.ShameReset(w.client);
  sr.postTick();
  check("and not when an ordinary late heal already clears it", w.ModuleHandler.forceHat === null);
}
{
  const w = makeWorld({ health: 90, shameCount: 0 });
  w.EnemyManager.nearestEnemy = null;
  const sr = new M.ShameReset(w.client);
  sr.postTick();
  check("at zero shame it does nothing at all", w.ModuleHandler.forceHat === null);
}

// ── 12. no Q fast ───────────────────────────────────────────────────────────
section("No Q Fast");
{
  // The prose cites Whiteout's qHeal by name, so strip comments and scan code.
  const codeOnly = t => t.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const forbidden = /place\s*\(\s*(?:myPlayer\.)?items\[0\]|KeyQ|qHeal|qFast|QFast|selectItem\(2\)/;
  check("the core's code contains no Q-key or Q-fast path", !forbidden.test(codeOnly(core)), "matched in DefenseCore code");
  check("the shame module's code contains none either", !forbidden.test(codeOnly(shame)));
  const heal = between("    heal() {", "    }", "ModuleHandler.heal");
  check("ModuleHandler.heal() is selectItem(2) -> attack -> restore", /selectItem\(2\)/.test(heal) && /attack\(null, 1\)/.test(heal) && !/KeyQ/.test(heal), heal.replace(/\s+/g, " "));
}

// ── 13. simultaneous threats resolve to one defence ─────────────────────────
section("Combined threats");
{
  // Spike tick + knockback spike + an insta the rest of the client already
  // recognises, all on the same tick. One hat, one lock, one reason.
  const e = makeEnemy({ x: 60, y: 0, primary: 5, trapped: true, canPlaceSpike: true, hatID: 53, turretReady: true });
  const w = makeWorld({
    health: 60, trapped: true, trappedIn: { ownerID: 999, health: 500 },
    enemies: [ e ], instaThreat: true,
    enemyManager: {
      collidingSpike: true, possibleToKnockback: true, spikeSyncThreat: true,
      potentialSpikeDamage: 45, potentialDamage: 67, detectedDangerEnemy: true, nearestEnemy: e
    }
  });
  const core = new M.DefenseCore(w.client);
  core.postTick();
  check("one hat is chosen, not three", w.ModuleHandler.defenseHat === 6);
  check("one lock is raised", w.ModuleHandler.defenseLock === 3, "lock=" + w.ModuleHandler.defenseLock);
  check("the tightest sequence names it", w.ModuleHandler.defenseReason === "spikeTick", w.ModuleHandler.defenseReason);
  check("and it heals", w.wire.length > 0);
}

// ── 14. source wiring ───────────────────────────────────────────────────────
section("Engine wiring (source level)");
{
  const has = (re, what) => check(what, re.test(src), "not found in " + path.basename(FILE));
  has(/if \(ModuleHandler\.defenseActive\) return true;\s*\n\s*return LUNA_TICK_OWNER_MODULES/, "auto place yields to the lock");
  has(/if \(this\.client\._ModuleHandler\.defenseActive\) return;\s*\n\s*const modes = \[\];/, "preplace yields to the lock");
  has(/if \(ModuleHandler\.defenseActive\) return;\s*\n\s*if \(this\._scheduler\.budget/, "replace yields to the lock");
  has(/if \(type === 0 && !force && this\.defenseLock > 0 && this\.defenseHat !== null\)/, "every hat equip is routed through the lock");
  has(/this\.defenseLock -= 1;/, "the lock counts itself down each tick");
  has(/if \(ModuleHandler\.moduleActive && !ModuleHandler\.defenseClaim\) return;/, "auto shield survives a defensive claim");
  has(/staticModules\.reloading, this\.staticModules\.defenseCore/, "the core runs ahead of the offensive chain");
  check("AntiInsta is gone", !/class AntiInsta/.test(src));
  // Anti spam (bull hat, daggers) was removed after the reference audit: no
  // client among Chicken, Falcon, Misery, Whiteout or Novastorm carries any
  // rate- or burst-based detection of incoming hits. Every dagger reference in
  // them is offensive (your own primary, Chicken's "Safe Dagger Spamming"
  // toggle, a dead doWithDaggers menu id) and every skinIndex == 7 reference is
  // damage attribution or bull-tick detection.
  check("no invented burst/rate detector survives", !/senseBurst|hitLog|DEF_BURST|DEF_DAGGER/.test(src));
}

// ── 15. angel wings ─────────────────────────────────────────────────────────
section("Angel Wings removal");
{
  const acc = between("    getBestCurrentAcc() {", "\n    }", "getBestCurrentAcc");
  const code = acc.replace(/\/\/[^\n]*/g, "");
  check("no accessory 13 is reachable from the loadout", !/\b13\b/.test(code), code.replace(/\s+/g, " ").slice(0, 200));
  check("Shadow Wings takes the combat slot instead", /return 19;/.test(code));
  check("Angel Wings is out of the store list", !/_storeItems: \[ \[[^\]]*\], \[[^\]]*\b13\b/.test(src));
  check("the Shadow Wings button is gone", !/id=\\"_shadowWings\\"/.test(src));
  check("and so is its dead setting", !/_shadowWings/.test(src));
  check("Be Angel bots keep the halo hat", /canBuy\(0, 48\)/.test(src));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail === 0 ? 0 : 1);
