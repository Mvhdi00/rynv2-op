// Pull PrePlacer/Replacer out of the OWNER build and exercise them against
// stubbed RYN managers, so the placement logic is checked and not just parsed.
const path = require("path");
const fs = require("fs");
const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");
const vm = require("vm");

const src = fs.readFileSync(RYN_OWNER, "utf8");
const start = src.indexOf("  const PREPLACE_SCAN_CELLS = 2;");
const end = src.indexOf("  const Replacer_default = Replacer;") + "  const Replacer_default = Replacer;".length;
if (start < 0 || end < start) throw new Error("could not slice the modules out");
const code = src.slice(start, end);

// ---- stubs -------------------------------------------------------------
class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}
class PlayerObject {
  constructor(o) { Object.assign(this, o); }
}
const getAngleDist = (a, b) => {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};
const DataHandler_default = {
  isWeapon: id => id === 0 || id === 10,
  isMelee: id => id === 0 || id === 10,
};
const Settings_default = {
  _prePlace: true, _prePlaceRadius: 270, _prePlaceHits: 4,
  _replace: true, _replaceRadius: 300,
};

const placeLog = [];
function makeClient({ deleted = [], objects = [], myTrapped = false, enemyTrapped = false, enemyDist = 100 }) {
  const myPos = new Vec(0, 0);
  const enemy = {
    pos: { current: new Vec(enemyDist, 0) },
    isTrapped: enemyTrapped,
    weapon: { primary: 0, secondary: 10 },
    getBuildingDamage: () => 40,
  };
  const objMap = new Map(objects.map(o => [o.id, o]));
  return {
    myPlayer: {
      inGame: true,
      isTrapped: myTrapped,
      pos: { current: myPos, future: myPos },
      canPlace: () => true,
      getItemByType: t => (t === 4 ? 9 : 15),
    },
    EnemyManager: { nearestEnemy: enemy },
    PlayerManager: { isEnemyByID: ownerID => ownerID !== 1 },
    _ModuleHandler: {
      tickCount: 10, packetCount: 0, packetLimit: 70,
      placedOnce: false, moduleActive: false, placeAngles: [null, []],
      place: (type, angle) => placeLog.push({ type, angle }),
    },
    ObjectManager: {
      objects: objMap,
      deletedObjects: new Set(deleted),
      grid2D: { queryFull: () => [...objMap.keys()] },
      getBestPlacementAngles: ({ targetAngle }) => [targetAngle],
    },
  };
}

const sandbox = { PlayerObject, Settings_default, Math, Number, console };
vm.createContext(sandbox);
vm.runInContext(code + "\nglobalThis.__PrePlacer = PrePlacer_default; globalThis.__Replacer = Replacer_default;", sandbox);
const PrePlacer = sandbox.__PrePlacer;
const Replacer = sandbox.__Replacer;

// ---- cases -------------------------------------------------------------
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
}

const ownSpike = id => new PlayerObject({
  id, ownerID: 1, itemGroup: 2, type: 9, isDestroyable: true,
  health: 100, canBeDestroyed: false, destroyingTick: -1,
  pos: { current: new Vec(50, 0) },
});
const ownTrap = id => new PlayerObject({
  id, ownerID: 1, itemGroup: 4, type: 15, isDestroyable: true,
  health: 200, canBeDestroyed: false, destroyingTick: -1,
  pos: { current: new Vec(0, 50) },
});

console.log("PrePlacer");
placeLog.length = 0;
{
  const c = makeClient({ objects: [ownSpike(101)] });
  new PrePlacer(c).postTick();
  // 100 hp / 40 dmg = 3 hits <= threshold 4 -> fires
  check("fires on a 3-hit-from-death own spike", placeLog.length === 1);
  check("aims at the doomed slot", Math.abs(placeLog[0].angle) < 1e-9);
}
placeLog.length = 0;
{
  const o = ownSpike(102);
  o.health = 1000; // 25 hits, way over the threshold
  const c = makeClient({ objects: [o] });
  new PrePlacer(c).postTick();
  check("stays quiet on a healthy building", placeLog.length === 0);
}
placeLog.length = 0;
{
  const o = ownSpike(103);
  o.health = 1000;
  o.canBeDestroyed = true;
  o.destroyingTick = 10; // current tick
  const c = makeClient({ objects: [o] });
  new PrePlacer(c).postTick();
  check("overrides the threshold when canBeDestroyed is live this tick", placeLog.length === 1);
}
placeLog.length = 0;
{
  const o = ownSpike(104);
  o.ownerID = 99; // enemy's
  const c = makeClient({ objects: [o] });
  new PrePlacer(c).postTick();
  check("ignores enemy buildings", placeLog.length === 0);
}
placeLog.length = 0;
{
  const c = makeClient({ objects: [ownSpike(105)], enemyDist: 400 });
  new PrePlacer(c).postTick();
  check("respects the radius setting", placeLog.length === 0);
}
placeLog.length = 0;
{
  const c = makeClient({ objects: [ownSpike(106)] });
  const m = new PrePlacer(c);
  m.postTick();
  const first = placeLog.length;
  c._ModuleHandler.tickCount = 11;
  m.postTick();
  check("does not re-send for the same object within the cooldown", placeLog.length === first);
  c._ModuleHandler.tickCount = 30;
  m.postTick();
  check("re-arms once the cooldown lapses", placeLog.length === first + 1);
}
placeLog.length = 0;
{
  const c = makeClient({ objects: [ownSpike(107)] });
  c._ModuleHandler.packetCount = 69;
  new PrePlacer(c).postTick();
  check("stops at the packet budget", placeLog.length === 0);
}
placeLog.length = 0;
{
  const objs = [ownSpike(108), ownSpike(109), ownSpike(110), ownSpike(111)];
  objs.forEach((o, i) => { o.pos.current = new Vec(40 + i, i); });
  const c = makeClient({ objects: objs });
  new PrePlacer(c).postTick();
  check("caps placements per tick", placeLog.length === 2);
}
placeLog.length = 0;
{
  Settings_default._prePlace = false;
  const c = makeClient({ objects: [ownSpike(112)] });
  new PrePlacer(c).postTick();
  check("off when the setting is off", placeLog.length === 0);
  Settings_default._prePlace = true;
}

console.log("Replacer");
placeLog.length = 0;
{
  const c = makeClient({ deleted: [ownSpike(201)] });
  new Replacer(c).postTick();
  check("replaces a destroyed own spike", placeLog.length === 1 && placeLog[0].type === 4);
  check("aims where it stood", Math.abs(placeLog[0].angle) < 1e-9);
}
placeLog.length = 0;
{
  const c = makeClient({ deleted: [ownTrap(202)], enemyTrapped: false });
  new Replacer(c).postTick();
  check("re-traps when a trap died and the enemy is loose", placeLog[0].type === 7);
}
placeLog.length = 0;
{
  const c = makeClient({ deleted: [ownTrap(203)], myTrapped: true });
  new Replacer(c).postTick();
  check("spikes instead when we are the pinned one", placeLog[0].type === 4);
}
placeLog.length = 0;
{
  const o = ownSpike(204);
  o.ownerID = 99;
  const c = makeClient({ deleted: [o] });
  new Replacer(c).postTick();
  check("does not replace enemy buildings", placeLog.length === 0);
}
placeLog.length = 0;
{
  const wall = new PlayerObject({
    id: 205, ownerID: 1, itemGroup: 1, type: 3, isDestroyable: true,
    health: 100, pos: { current: new Vec(50, 0) },
  });
  const c = makeClient({ deleted: [wall] });
  new Replacer(c).postTick();
  check("ignores non spike/trap losses", placeLog.length === 0);
}
placeLog.length = 0;
{
  const c = makeClient({ deleted: [ownSpike(206)], enemyDist: 500 });
  new Replacer(c).postTick();
  check("respects the replace radius", placeLog.length === 0);
}
placeLog.length = 0;
{
  Settings_default._replace = false;
  const c = makeClient({ deleted: [ownSpike(207)] });
  new Replacer(c).postTick();
  check("off when the setting is off", placeLog.length === 0);
  Settings_default._replace = true;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
