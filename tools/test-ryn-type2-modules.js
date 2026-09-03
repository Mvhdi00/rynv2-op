#!/usr/bin/env node
/*
 * test-ryn-type2-modules.js
 *
 * Ryn_Type_2.user.js is a userscript that only runs inside moomoo.io, so the
 * two combat modules added to it -- Velocity Tick and Trap Instakill -- cannot
 * be exercised by loading the file. This pulls those two classes straight out
 * of the script's source and runs them against stubbed managers instead, which
 * covers the branch logic: the knockback band, the two-tick send, the diamond
 * polearm gate, and Trap Instakill's one-swing-per-trap-entry ledger.
 *
 *   node tools/test-ryn-type2-modules.js
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "Ryn_Type_2.user.js"), "utf8");

function extract(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a);
  if (a === -1 || b === -1) throw new Error("cannot find " + startMarker);
  return src.slice(a, b);
}

const velocitySrc = extract("  class VelocityTick {", "  const VelocityTick_default");
const trapSrc = extract("  class TrapInstakill {", "  const TrapInstakill_default");
const TRAP_INSTA_MEMORY_TICKS = 60;

// ---- stubs -----------------------------------------------------------------
const inRange = (value, min, max) => value >= min && value <= max;
const Settings_default = { _velocityTick: true, _trapInstakill: true };

const Weapons = {
  5: { type: 0, range: 142, damage: 45 },   // polearm
  0: { type: 0, range: 65, damage: 25 }     // tool hammer
};
const DataHandler_default = {
  getWeapon: id => Weapons[id],
  isMelee: id => id != null && "damage" in Weapons[id]
};

function vec(x, y) {
  return {
    x: x, y: y,
    distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); },
    angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
  };
}

function makeClient(opts) {
  const o = Object.assign({ enemies: [], nearestEnemy: null, ignore: false, primary: 5, variant: 2,
                            reloaded: { 0: true, 2: true }, myPos: vec(0, 0) }, opts);
  const calls = [];
  const client = {
    ownerClient: undefined,
    myPlayer: {
      pos: { current: o.myPos, future: o.myPos },
      getItemByType: t => (t === 0 ? o.primary : null),
      getWeaponVariant: () => ({ current: o.variant }),
      collidingSimple: (entity, range) => o.myPos.distance(entity.pos.current) <= range
    },
    EnemyManager: {
      nearestEnemy: o.nearestEnemy,
      shouldIgnoreModule: () => o.ignore,
      isNear(enemy, nearest) {
        if (nearest === null || enemy === nearest) return true;
        return o.myPos.distance(enemy.pos.current) < o.myPos.distance(nearest.pos.current);
      }
    },
    PlayerManager: { enemies: o.enemies },
    StatsManager: { set velocityTickTimes(v) { calls.push("stat:velocity"); },
                    set trapInstakillTimes(v) { calls.push("stat:trapInsta"); } },
    _ModuleHandler: {
      moduleActive: false, useAngle: null, forceHat: null, forceWeapon: null,
      shouldAttack: false, moveTo: "disable", tickCount: 0,
      canBuy: (type, id) => o.canBuy !== false,
      hasStoreItem: () => true,
      staticModules: { reloading: { isReloaded: (type, ticks) => !!o.reloaded[type] } }
    },
    calls: calls
  };
  return client;
}

function enemy(id, x, y, extra) {
  return Object.assign({
    id: id,
    pos: { current: vec(x, y), future: vec(x, y) },
    hitScale: 35,
    weapon: { current: 5 },
    futureHat: 7,
    atExact: () => false,
    isTrapped: false,
    trappedIn: null
  }, extra);
}

const VelocityTick = eval("(" + velocitySrc.replace(/^\s*class VelocityTick/, "class VelocityTick") + ")");
const TrapInstakill = eval("(" + trapSrc.replace(/^\s*class TrapInstakill/, "class TrapInstakill") + ")");

let failures = 0;
function check(name, cond) {
  console.log((cond ? "PASS  " : "FAIL  ") + name);
  if (!cond) failures++;
}

// ---- VelocityTick ----------------------------------------------------------
{
  const e = enemy(1, 230, 0);                       // inside the 220-245 band
  const c = makeClient({ nearestEnemy: e });
  const m = new VelocityTick(c);
  m.postTick();
  const mh = c._ModuleHandler;
  check("velocity: arms in band", mh.moduleActive === true && mh.forceHat === 53 && mh.moveTo === 0 && m.nearestTarget === e);
  check("velocity: counts the stat", c.calls.includes("stat:velocity"));
  check("velocity: exposes the render target", m.target === e);
  // second tick -- the swing
  mh.moduleActive = false; mh.moveTo = "disable"; mh.forceHat = null;
  m.postTick();
  check("velocity: swings on the next tick", mh.moduleActive === true && mh.forceHat === 7 && mh.forceWeapon === 0 && mh.shouldAttack === true);
  check("velocity: clears the arm", m.nearestTarget === null);
}
{
  const e = enemy(1, 300, 0);                       // outside the band
  const c = makeClient({ nearestEnemy: e });
  new VelocityTick(c).postTick();
  check("velocity: silent outside the band", c._ModuleHandler.moduleActive === false);
}
{
  const e = enemy(1, 230, 0);
  const c = makeClient({ nearestEnemy: e, variant: 1 });   // not diamond
  new VelocityTick(c).postTick();
  check("velocity: needs a diamond polearm", c._ModuleHandler.moduleActive === false);
}
{
  const e = enemy(1, 230, 0, { futureHat: 6 });            // soldier next, atExact false
  const c = makeClient({ nearestEnemy: e });
  new VelocityTick(c).postTick();
  check("velocity: holds when the enemy is going soldier", c._ModuleHandler.moduleActive === false);
}
{
  const e = enemy(1, 230, 0);
  const c = makeClient({ nearestEnemy: e, ignore: true });
  new VelocityTick(c).postTick();
  check("velocity: yields to an insta threat", c._ModuleHandler.moduleActive === false);
}
{
  const e = enemy(1, 230, 0);
  const c = makeClient({ nearestEnemy: e });
  Settings_default._velocityTick = false;
  new VelocityTick(c).postTick();
  Settings_default._velocityTick = true;
  check("velocity: off means off", c._ModuleHandler.moduleActive === false);
}

// ---- TrapInstakill ---------------------------------------------------------
function trap(id) { return { id: id }; }
{
  const e = enemy(1, 100, 0);                              // inside polearm reach (142+35)
  const c = makeClient({ enemies: [ e ] });
  const m = new TrapInstakill(c);
  const mh = c._ModuleHandler;

  m.postTick();
  check("trap: no swing while untrapped", mh.moduleActive === false);

  e.isTrapped = true; e.trappedIn = trap(900);
  m.postTick();
  check("trap: swings on entry", mh.moduleActive === true && mh.forceWeapon === 0 && mh.shouldAttack === true && mh.forceHat === 7);
  check("trap: counts the stat", c.calls.filter(x => x === "stat:trapInsta").length === 1);

  mh.moduleActive = false; mh.shouldAttack = false; mh.tickCount = 1;
  m.postTick();
  check("trap: only one swing while pinned in the same trap", mh.moduleActive === false);

  mh.tickCount = 2;
  m.postTick();
  check("trap: still one swing a tick later", mh.moduleActive === false);

  // pushed into a different trap -- that is a new entry
  e.trappedIn = trap(901); mh.tickCount = 3;
  m.postTick();
  check("trap: a different trap re-arms", mh.moduleActive === true);
  check("trap: two swings total so far", c.calls.filter(x => x === "stat:trapInsta").length === 2);

  // walks out, then back into the first trap
  mh.moduleActive = false; e.isTrapped = false; e.trappedIn = null; mh.tickCount = 4;
  m.postTick();
  check("trap: nothing to do once they are out", mh.moduleActive === false);
  e.isTrapped = true; e.trappedIn = trap(900); mh.tickCount = 5;
  m.postTick();
  check("trap: re-entry earns a fresh swing", mh.moduleActive === true);
}
{
  const e = enemy(1, 400, 0);                              // trapped but out of reach
  e.isTrapped = true; e.trappedIn = trap(900);
  const c = makeClient({ enemies: [ e ] });
  const m = new TrapInstakill(c);
  m.postTick();
  check("trap: out of weapon range is not a swing", c._ModuleHandler.moduleActive === false);
  // and the entry stays armed for when I close in
  check("trap: entry stays unspent", m.punished.size === 0);
}
{
  const e = enemy(1, 100, 0);
  e.isTrapped = true; e.trappedIn = trap(900);
  const c = makeClient({ enemies: [ e ], reloaded: { 0: false, 2: true } });
  const m = new TrapInstakill(c);
  m.postTick();
  check("trap: waits for the reload instead of spending the entry", c._ModuleHandler.moduleActive === false && m.punished.size === 0);
  c._ModuleHandler.staticModules.reloading.isReloaded = () => true;
  c._ModuleHandler.tickCount = 1;
  m.postTick();
  check("trap: swings the moment the weapon is up", c._ModuleHandler.moduleActive === true);
}
{
  const near = enemy(1, 100, 0), far = enemy(2, 150, 0);
  near.isTrapped = far.isTrapped = true;
  near.trappedIn = trap(900); far.trappedIn = trap(901);
  const c = makeClient({ enemies: [ far, near ] });
  const m = new TrapInstakill(c);
  m.postTick();
  check("trap: picks the nearest owed target", m.punished.has(1) && !m.punished.has(2));
}
{
  const e = enemy(1, 100, 0);
  e.isTrapped = true; e.trappedIn = trap(900);
  const c = makeClient({ enemies: [ e ], ignore: true });
  new TrapInstakill(c).postTick();
  check("trap: yields to an insta threat", c._ModuleHandler.moduleActive === false);
}
{
  const e = enemy(1, 100, 0);
  e.isTrapped = true; e.trappedIn = trap(900);
  const c = makeClient({ enemies: [ e ] });
  const m = new TrapInstakill(c);
  Settings_default._trapInstakill = false;
  m.postTick();
  Settings_default._trapInstakill = true;
  check("trap: off means off", c._ModuleHandler.moduleActive === false && m.punished.size === 0);
}
{
  // an enemy that walks off screen still trapped: the entry must not live forever
  const e = enemy(1, 100, 0);
  e.isTrapped = true; e.trappedIn = trap(900);
  const c = makeClient({ enemies: [ e ] });
  const m = new TrapInstakill(c);
  m.postTick();
  c.PlayerManager.enemies = [];
  c._ModuleHandler.tickCount = TRAP_INSTA_MEMORY_TICKS + 2;
  m.postTick();
  check("trap: stale entries expire", m.punished.size === 0);
}
{
  // a bot must not swing at its own owner
  const owner = enemy(7, 100, 0);
  owner.isTrapped = true; owner.trappedIn = trap(900);
  const c = makeClient({ enemies: [ owner ] });
  c.ownerClient = { myPlayer: { id: 7 } };
  new TrapInstakill(c).postTick();
  check("trap: a bot skips its owner", c._ModuleHandler.moduleActive === false);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
