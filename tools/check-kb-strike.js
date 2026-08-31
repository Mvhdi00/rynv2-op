#!/usr/bin/env node
/*
 * check-kb-strike.js
 *
 * KnockbackStrike decides whether to swing by where the recoil would put the
 * target, so its geometry is the feature. This lifts the real class out of the
 * built script and runs it against synthetic scenes, stubbing only what the
 * module actually touches.
 *
 * The cases that matter are the three the cone test it replaced got wrong: a
 * hazard past the end of the travel, a hazard off the push axis but still
 * within reach of it, and a pit trap whose colDiv would otherwise shrink the
 * catch radius to 10.
 *
 *   node tools/check-kb-strike.js [path/to/client.js]
 */
const fs = require("fs");
const path = require("path");

const TARGET = process.argv[2] || path.join(__dirname, "..", "ReUp_Mix.user.js");
const SOURCE = fs.readFileSync(TARGET, "utf8");
const START = SOURCE.indexOf("  const KB_STRIKE_TURRET_TRAVEL");
const END = SOURCE.indexOf("  class ShameSpam {");
if (START === -1 || END === -1 || END < START) {
  console.error("could not find the KnockbackStrike module in " + path.relative(process.cwd(), TARGET));
  process.exit(1);
}
const MOD = SOURCE.slice(START, END);

/* ---- stubs ---- */
class PlayerObject {
  constructor(o) { Object.assign(this, o); }
  get isSpike() { return this.itemGroup === 2; }
  get collisionScale() { return this.scale * (this.colDiv ?? 1); }
  getDamage() { return this.isSpike ? this.damage : 0; }
}
class Natural {
  constructor(o) { Object.assign(this, o); }
  get collisionScale() { return this.scale; }
  getDamage() { return this.isCactus ? 35 : 0; }
}

const WEAPONS = {
  0: { name: "tool hammer", range: 65, knockback: 33.3 },
  5: { name: "polearm", range: 142, knockback: 55.6 },
  6: { name: "bat", range: 110, knockback: 111.1 },
};
const DataHandler_default = { getWeapon: (id) => WEAPONS[id] };
const Settings_default = { _knockbackStrike: true, _knockbackStrikeTrap: true };

function vec(x, y) {
  return {
    x, y,
    angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); },
    distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); },
  };
}

function makeScene(objects) {
  const map = new Map();
  objects.forEach((o, i) => map.set(i, o));
  return {
    objects: map,
    grid2D: { queryFull: () => [...map.keys()] },
  };
}

function enemy(x, y, opts = {}) {
  return {
    id: opts.id ?? 99,
    isTrapped: !!opts.isTrapped,
    scale: 35,
    get collisionScale() { return 35; },
    get hitScale() { return 35 * 1.8; },
    pos: { previous: vec(x, y), current: vec(x, y), future: vec(opts.fx ?? x, opts.fy ?? y) },
  };
}

function makeClient(scene, enemies, opts = {}) {
  const me = {
    pos: { previous: vec(0, 0), current: vec(0, 0), future: vec(0, 0) },
    getItemByType: () => opts.primary ?? 6,
    collidingEntity(e, range) {
      return this.pos.current.distance(e.pos.current) <= range;
    },
  };
  return {
    myPlayer: me,
    ObjectManager: scene,
    PlayerManager: { enemies, isEnemyByID: (ownerID) => ownerID === "them" },
    EnemyManager: { shouldIgnoreModule: () => !!opts.ignore },
    _ModuleHandler: {
      moduleActive: !!opts.moduleActive,
      useAngle: null, forceHat: null, forceWeapon: null, shouldAttack: false,
      hasStoreItem: () => !!opts.hasTurret,
      staticModules: {
        reloading: { isReloaded: (slot) => (slot === 2 ? !!opts.turretReloaded : !opts.primaryNotReloaded) },
      },
    },
  };
}

/* ---- load the module ---- */
const load = new Function(
  "PlayerObject", "DataHandler_default", "Settings_default",
  MOD + "\n return KnockbackStrike;"
);
const KnockbackStrike = load(PlayerObject, DataHandler_default, Settings_default);

/* ---- assertions ---- */
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + "\n         got  " + JSON.stringify(got) + "\n         want " + JSON.stringify(want)); }
}

const spike = (x, y, dmg = 25) =>
  new PlayerObject({ ownerID: "me", type: 6, itemGroup: 2, scale: 35, colDiv: 1, damage: dmg, pos: { current: vec(x, y) } });
const theirSpike = (x, y, dmg = 25) =>
  new PlayerObject({ ownerID: "them", type: 6, itemGroup: 2, scale: 35, colDiv: 1, damage: dmg, pos: { current: vec(x, y) } });
const trap = (x, y) =>
  new PlayerObject({ ownerID: "me", type: 15, itemGroup: 5, scale: 50, colDiv: .2, damage: 0, pos: { current: vec(x, y) } });
const cactus = (x, y) =>
  new Natural({ isCactus: true, isSpike: false, scale: 50, pos: { current: vec(x, y) } });

console.log("\ntravel figures (item table, + turret only when it fires)");
{
  const m = new KnockbackStrike(makeClient(makeScene([]), []));
  check("bat alone", m._travel(6, false), 111.1);
  check("bat + turret", Math.round(m._travel(6, true) * 10) / 10, 144.4);
  check("polearm alone", m._travel(5, false), 55.6);
  check("hammer alone", m._travel(0, false), 33.3);
}

console.log("\nsegment distance");
{
  const m = new KnockbackStrike(makeClient(makeScene([]), []));
  check("point on the segment", m._segmentDistance2(50, 0, 0, 0, 100, 0), 0);
  check("point beside the segment", m._segmentDistance2(50, 30, 0, 0, 100, 0), 900);
  check("point past the far end clamps to it", m._segmentDistance2(160, 0, 0, 0, 100, 0), 3600);
  check("point behind the near end clamps to it", m._segmentDistance2(-40, 0, 0, 0, 100, 0), 1600);
}

console.log("\npath reading — the cone-test fixes");
{
  // Enemy at (200,0); push axis is +x; bat travel 111.1.
  const e = enemy(200, 0);

  // On the line, inside the travel.
  let m = new KnockbackStrike(makeClient(makeScene([spike(280, 0)]), [e]));
  check("spike on the line inside travel is found", m._readPath(e, 0, 111.1).worth, 25);

  // On the line but past where the push ends. The old cone test passed this.
  m = new KnockbackStrike(makeClient(makeScene([spike(600, 0)]), [e]));
  check("spike past the travel is refused", m._readPath(e, 0, 111.1).worth, 0);

  // Off-axis but within (spike 35 + enemy 35) of the line. Cone missed this.
  m = new KnockbackStrike(makeClient(makeScene([spike(280, 60)]), [e]));
  check("spike off-axis but within reach is found", m._readPath(e, 0, 111.1).worth, 25);

  // Far enough off-axis to genuinely miss.
  m = new KnockbackStrike(makeClient(makeScene([spike(280, 120)]), [e]));
  check("spike too far off-axis is refused", m._readPath(e, 0, 120).worth, 0);

  // Behind the enemy, opposite the push.
  m = new KnockbackStrike(makeClient(makeScene([spike(120, 0)]), [e]));
  check("spike behind the target is refused", m._readPath(e, 0, 111.1).worth, 0);
}

console.log("\nownership and item kinds");
{
  const e = enemy(200, 0);
  let m = new KnockbackStrike(makeClient(makeScene([theirSpike(280, 0)]), [e]));
  check("their spike is not a prize", m._readPath(e, 0, 111.1).worth, 0);

  m = new KnockbackStrike(makeClient(makeScene([trap(280, 0)]), [e]));
  check("our trap counts, at trap worth", m._readPath(e, 0, 111.1).worth, 120);

  Settings_default._knockbackStrikeTrap = false;
  m = new KnockbackStrike(makeClient(makeScene([trap(280, 0)]), [e]));
  check("trap ignored when the sub-toggle is off", m._readPath(e, 0, 111.1).worth, 0);
  Settings_default._knockbackStrikeTrap = true;

  m = new KnockbackStrike(makeClient(makeScene([cactus(280, 0)]), [e]));
  check("cactus counts at 35", m._readPath(e, 0, 111.1).worth, 35);

  // colDiv 0.2 would put the trap catch radius at 10 and miss; 47.5 catches.
  m = new KnockbackStrike(makeClient(makeScene([trap(300, 70)]), [e]));
  check("trap catch uses 47.5, not colDiv", m._readPath(e, 0, 111.1).worth, 120);
}

console.log("\nchaining");
{
  const e = enemy(200, 0);
  const m = new KnockbackStrike(makeClient(makeScene([spike(260, 0), spike(300, 0, 45)]), [e]));
  const read = m._readPath(e, 0, 111.1);
  // Two on the line: first at full worth, second at 0.6. Order of the grid
  // walk decides which is "first", so accept either arrangement's total.
  const totals = [25 + 45 * .6, 45 + 25 * .6].map((n) => Math.round(n * 100) / 100);
  check("second hazard chains at 0.6", totals.includes(Math.round(read.worth * 100) / 100), true);
  check("landing is the harder spike", read.landing.damage, 45);
}

console.log("\npostTick gating");
{
  const e = enemy(120, 0);
  const scene = makeScene([spike(200, 0, 45)]);

  let c = makeClient(scene, [e]);
  let m = new KnockbackStrike(c);
  m.postTick();
  check("fires on a worthwhile push", [c._ModuleHandler.shouldAttack, c._ModuleHandler.forceWeapon], [true, 0]);
  check("aims at the target", Math.round(c._ModuleHandler.useAngle * 1000), 0);

  c = makeClient(scene, [enemy(120, 0, { isTrapped: true })]);
  m = new KnockbackStrike(c); m.postTick();
  check("a pinned target cannot be pushed", c._ModuleHandler.shouldAttack, false);

  c = makeClient(scene, [e], { moduleActive: true });
  m = new KnockbackStrike(c); m.postTick();
  check("yields to a module already holding the tick", c._ModuleHandler.shouldAttack, false);

  c = makeClient(scene, [e], { ignore: true });
  m = new KnockbackStrike(c); m.postTick();
  check("stands down under shouldIgnoreModule", c._ModuleHandler.shouldAttack, false);

  c = makeClient(scene, [e], { primaryNotReloaded: true });
  m = new KnockbackStrike(c); m.postTick();
  check("does nothing on an unreloaded primary", c._ModuleHandler.shouldAttack, false);

  c = makeClient(scene, [enemy(900, 0)]);
  m = new KnockbackStrike(c); m.postTick();
  check("out of weapon range is skipped", c._ModuleHandler.shouldAttack, false);

  c = makeClient(makeScene([]), [e]);
  m = new KnockbackStrike(c); m.postTick();
  check("nothing on the path means no hit", c._ModuleHandler.shouldAttack, false);

  c = makeClient(scene, [e], { hasTurret: true, turretReloaded: true });
  m = new KnockbackStrike(c); m.postTick();
  check("wears the turret when it is up", c._ModuleHandler.forceHat, 53);

  c = makeClient(scene, [e], { hasTurret: true, turretReloaded: false });
  m = new KnockbackStrike(c); m.postTick();
  check("no turret hat when the turret is not ready", c._ModuleHandler.forceHat, null);
}

console.log("\ntarget selection");
{
  // Two reachable enemies; only the second has anything behind them.
  const near = enemy(100, 0, { id: 1 });
  const far = enemy(0, 100, { id: 2 });
  const c = makeClient(makeScene([spike(0, 190, 45)]), [near, far]);
  const m = new KnockbackStrike(c);
  m.postTick();
  check("picks the enemy with a payoff, not the nearest", m.target && m.target.id, 2);
}

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
