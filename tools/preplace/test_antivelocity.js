// Drive AntiVelocity out of a shipped build.
//
//   node test_antivelocity.js            owner build
//   node test_antivelocity.js --player   the copy spliced into the player
//
// The numbers the cases lean on are the server's own:
//   melee shove   0.3 + weapon.knock   (bat 1.0, polearm 0.5, daggers 0.4)
//   projectile    1.5
//   a building    snaps you to its edge and cuts velocity to 75%
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");

const usePlayer = process.argv.includes("--player");
const src = fs.readFileSync(usePlayer ? RYN_PLAYER : RYN_OWNER, "utf8");
console.log(usePlayer ? "(player build)" : "(owner build)");

const START = "  const ANTI_VELOCITY_ITEMS = [ 3, 4 ];";
const END = "  class AntiSpikePush {";
const a = src.indexOf(START), b = src.indexOf(END, a);
if (a < 0 || b < a) throw new Error("could not slice AntiVelocity out");
const code = src.slice(a, b);

// ---- stubs ----------------------------------------------------------------
const WALL = 3, SPIKE = 4;
const POLEARM = 5, BAT = 6, DAGGERS = 7, KATANA = 4, MUSKET = 15;
const WEAPONS = {
  4: { range: 118, knockback: 0, melee: true },
  5: { range: 142, knockback: 0.2, melee: true },
  6: { range: 110, knockback: 0.7, melee: true },
  7: { range: 65, knockback: 0.1, melee: true },
  15: { range: 700, knockback: 0, melee: false },
};
class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
  addDirection(a, d) { return new Vec(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d); }
  copy() { return new Vec(this.x, this.y); }
}
class PlayerObject {
  constructor(o) { Object.assign(this, o); }
  canMoveOnTop() { return false; }
}
const Items = [];
Items[WALL] = { id: WALL, scale: 50, placeOffset: 0, itemType: 1 };
Items[SPIKE] = { id: SPIKE, scale: 49, placeOffset: -5, itemType: 2 };
const DataHandler_default = {
  getWeapon: id => WEAPONS[id],
  isMelee: id => !!(WEAPONS[id] && WEAPONS[id].melee),
  getItem: id => Items[id],
};
const Settings_default = { _antiVelocity: true };
const getAngleDist = (a, b) => {
  const p = Math.abs(b - a) % (Math.PI * 2);
  return p > Math.PI ? Math.PI * 2 - p : p;
};
class MovementSimulation {
  reset(c) { const p = c.myPlayer.pos.current; this.x = p.x; this.y = p.y; }
  update() {}
}
function auraPredictPos(client) {
  const p = client.myPlayer.pos.current;
  return { x: p.x, y: p.y };
}

function makeWorld(o = {}) {
  const {
    enemyPrimary = POLEARM, enemySecondary = null, enemyDist = 120,
    enemyReloaded = true, turretReady = false, trapped = false,
    placedOnce = false, have = [WALL, SPIKE], objects = [], canPlace = true,
    noEnemy = false, angleOffset = 0,
  } = o;
  const myPos = new Vec(7000, 7000);
  const enemy = {
    pos: { current: new Vec(myPos.x - enemyDist, myPos.y) },
    scale: 35, get hitScale() { return this.scale * 1.8; },
    weapon: { primary: enemyPrimary, secondary: enemySecondary },
    isReloaded: (slot) => (slot === 2 ? turretReady : enemyReloaded),
    collidingEntity(target, range) { return this.pos.current.distance(target.pos.current) <= range; },
  };
  const objMap = new Map();
  objects.forEach((ob, i) => objMap.set(i, new PlayerObject({
    id: i, collisionScale: ob.scale || 50, placementScale: ob.scale || 50,
    pos: { current: new Vec(myPos.x + ob.dx, myPos.y + (ob.dy || 0)) },
  })));
  const placed = [];
  return {
    placed,
    myPlayer: {
      inGame: true, isTrapped: trapped, scale: 35, collisionScale: 35,
      get hitScale() { return this.scale * 1.8; },
      pos: { current: myPos },
      getItemByType: t => (have.includes(t) ? t : null),
      canPlace: () => canPlace,
      getItemPlaceScale: id => 35 + Items[id].scale + Items[id].placeOffset,
    },
    EnemyManager: { nearestEnemy: noEnemy ? null : enemy },
    _ModuleHandler: {
      placedOnce, moduleActive: o.moduleActive || false,
      forceHat: null, shouldEquipSoldier: false,
      canBuy: () => o.ownSoldier !== false,
      place(type, angle) { placed.push({ type, angle }); },
    },
    ObjectManager: {
      objects: objMap,
      grid2D: { query: (x, y, r, cb) => { for (const id of objMap.keys()) if (cb(id)) return; } },
      getBestPlacementAngles: ({ targetAngle }) => [targetAngle + angleOffset],
    },
  };
}

const globals = { Items, Settings_default, PlayerObject, DataHandler_default, MovementSimulation };
const sandbox = { Math, Number, Map, Set, console, getAngleDist, auraPredictPos };
if (usePlayer) {
  const NAMES = require("./names.js");
  for (const [logical, mangled] of Object.entries(NAMES)) {
    if (globals[logical] !== undefined) sandbox[mangled] = globals[logical];
  }
} else {
  Object.assign(sandbox, globals);
}
vm.createContext(sandbox);
vm.runInContext(code + "\nglobalThis.__AV = AntiVelocity;", sandbox);
const AV = sandbox.__AV;

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
};
const run = o => { const w = makeWorld(o); new AV(w).postTick(); return w; };
const force = o => { const w = makeWorld(o); return new AV(w).shoveForce(w.EnemyManager.nearestEnemy); };

console.log("\nshove force, against the server's own numbers");
check("polearm is 0.5", Math.abs(force({ enemyPrimary: POLEARM }) - 0.5) < 1e-9);
check("bat is 1.0", Math.abs(force({ enemyPrimary: BAT }) - 1.0) < 1e-9);
check("daggers are 0.4", Math.abs(force({ enemyPrimary: DAGGERS }) - 0.4) < 1e-9);
check("a katana is the bare 0.3", Math.abs(force({ enemyPrimary: KATANA }) - 0.3) < 1e-9);
check("a turret shot adds 1.5 on top",
      Math.abs(force({ enemyPrimary: POLEARM, turretReady: true }) - 2.0) < 1e-9);
check("a weapon on cooldown is not a threat this tick",
      force({ enemyPrimary: BAT, enemyReloaded: false }) === 0);
check("out of its own range it is not a threat either",
      force({ enemyPrimary: DAGGERS, enemyDist: 400 }) === 0);
check("but a turret still reaches 700",
      Math.abs(force({ enemyPrimary: DAGGERS, enemyDist: 400, turretReady: true }) - 1.5) < 1e-9);
check("a musket is not melee, so no melee shove",
      Math.abs(force({ enemyPrimary: KATANA, enemySecondary: MUSKET }) - 0.3) < 1e-9);

console.log("\nwhen it fires");
check("a polearm in range gets a blocker", run({ enemyPrimary: POLEARM }).placed.length === 1);
check("a bat does too", run({ enemyPrimary: BAT }).placed.length === 1);
check("a katana alone does not clear the bar", run({ enemyPrimary: KATANA }).placed.length === 0);
check("...until the turret is up", run({ enemyPrimary: KATANA, turretReady: true }).placed.length === 1);
check("switched off it never fires", (() => {
  Settings_default._antiVelocity = false;
  const r = run({ enemyPrimary: BAT }).placed.length === 0;
  Settings_default._antiVelocity = true;
  return r;
})());
check("no enemy, nothing to block", run({ noEnemy: true }).placed.length === 0);
check("already placed this tick, so not again", run({ enemyPrimary: BAT, placedOnce: true }).placed.length === 0);
check("no resources means no wall", run({ enemyPrimary: BAT, canPlace: false }).placed.length === 0);

console.log("\ntrapped");
// lockMove already pins you; a wall would be packets for nothing.
check("trapped, so nothing is placed", run({ enemyPrimary: BAT, trapped: true }).placed.length === 0);

console.log("\nwhere it goes");
{
  // Enemy is due west, so the shove carries me east and the wall belongs east.
  const w = run({ enemyPrimary: BAT });
  check("the blocker goes on the far side from the enemy",
        Math.abs(w.placed[0].angle) < 1e-9);
  check("a wall is preferred over a spike", w.placed[0].type === WALL);
}
{
  const w = run({ enemyPrimary: BAT, have: [SPIKE] });
  check("with no wall it uses a spike", w.placed.length === 1 && w.placed[0].type === SPIKE);
}
{
  // The only free angle is 60 degrees off: a wall there is not behind me.
  const w = run({ enemyPrimary: BAT, angleOffset: Math.PI / 3 });
  check("an angle too far round is refused rather than wasted", w.placed.length === 0);
}
{
  const w = run({ enemyPrimary: BAT, angleOffset: Math.PI / 8 });
  check("a small deflection is still accepted", w.placed.length === 1);
}
{
  // Something already sits where the shove would take me.
  const w = run({ enemyPrimary: BAT, objects: [{ dx: 84, scale: 50 }] });
  check("an existing building means no second one", w.placed.length === 0);
}

console.log("\nsurviving it");
// polearm 45 * 1.18 variant * 1.5 bull = 79.7, + 25 from the turret = 104.7
// against 100 health. At soldier's 0.75 the same burst is 78.5.
const BURST = 45 * 1.18 * 1.5 + 25;
check("the canonical tick kills a full-health player outright", BURST > 100);
check("and soldier is the difference between living and dying", BURST * 0.75 < 100);
{
  const w = run({ enemyPrimary: POLEARM });
  check("soldier goes on for the threat", w._ModuleHandler.forceHat === 6);
  check("and anti-insta is told about it", w._ModuleHandler.shouldEquipSoldier === true);
}
{
  const w = run({ enemyPrimary: KATANA });
  check("no threat, no hat swap", w._ModuleHandler.forceHat === null);
}
{
  const w = run({ enemyPrimary: POLEARM, moduleActive: true });
  check("a committed insta keeps its own hat", w._ModuleHandler.forceHat === null);
}
{
  const w = run({ enemyPrimary: POLEARM, ownSoldier: false });
  check("without a soldier helmet it still puts the wall up",
        w._ModuleHandler.forceHat === null && w.placed.length === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
