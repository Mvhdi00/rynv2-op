// Pull PrePlacer/Replacer out of the OWNER build and exercise them against
// stubbed RYN managers, so the placement logic is checked and not just parsed.
const path = require("path");
const fs = require("fs");
const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");
const vm = require("vm");

// `--player` runs the very same cases against the copy spliced into the
// obfuscated build, which reaches its dependencies by their mangled names.
const usePlayer = process.argv.includes("--player");
const src = fs.readFileSync(usePlayer ? RYN_PLAYER : RYN_OWNER, "utf8");
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
function makeClient({ deleted = [], objects = [], myTrapped = false, enemyTrapped = false,
                      enemyDist = 100, enemyTrappedIn = null, myTrappedIn = null,
                      enemyEscaped = false, angleFan = null }) {
  const myPos = new Vec(0, 0);
  const enemy = {
    pos: { current: new Vec(enemyDist, 0), future: new Vec(enemyDist, 0) },
    isTrapped: enemyTrapped,
    trappedIn: enemyTrappedIn,
    wasTrapped: () => enemyEscaped,
    weapon: { primary: 0, secondary: 10 },
    getBuildingDamage: () => 40,
  };
  const objMap = new Map(objects.map(o => [o.id, o]));
  return {
    myPlayer: {
      inGame: true,
      isTrapped: myTrapped,
      trappedIn: myTrappedIn,
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
      getBestPlacementAngles: ({ targetAngle }) =>
        angleFan ? angleFan.map(d => targetAngle + d) : [targetAngle],
    },
  };
}

const sandbox = usePlayer
  ? { _0xcd92ac: PlayerObject, _0x35d81b: Settings_default, Math, Number, console }
  : { PlayerObject, Settings_default, Math, Number, console };
console.log(usePlayer ? "(player build)" : "(owner build)");
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
  // 3 swings at the stubbed 40 dmg, so it counts as doomed
  health: 120, canBeDestroyed: false, destroyingTick: -1,
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
  const captor = ownSpike(203);
  captor.type = 15;
  const c = makeClient({ deleted: [ownTrap(204)], myTrapped: true, myTrappedIn: captor });
  new Replacer(c).postTick();
  check("spikes instead when we are the pinned one", placeLog[0].type === 4);
  check("aims at our captor", Math.abs(placeLog[0].angle) < 1e-9);
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

console.log("Retrap");
placeLog.length = 0;
{
  // enemy pinned in OUR trap, and that trap is the one about to break
  const trap = ownTrap(301);
  const c = makeClient({ objects: [trap], enemyTrapped: true, enemyTrappedIn: trap,
                         angleFan: [0, 0.3, -0.3, 0.6] });
  new PrePlacer(c).postTick();
  check("retrap burst fires on the trap holding the enemy", placeLog.length > 1);
  check("burst places traps, not spikes", placeLog.every(p => p.type === 7));
  check("burst is capped", placeLog.length <= 3);
  check("burst aims at the enemy", Math.abs(placeLog[0].angle) < 1e-9);
}
placeLog.length = 0;
{
  // enemy pinned, but something ELSE is breaking -> spike into the trap
  const trap = ownTrap(302);
  const spike = ownSpike(303);
  const c = makeClient({ objects: [spike], enemyTrapped: true, enemyTrappedIn: trap });
  new PrePlacer(c).postTick();
  check("spikes when the enemy is pinned by something else", placeLog[0].type === 4);
  const toTrap = Math.atan2(trap.pos.current.y, trap.pos.current.x);
  check("aims into the enemy's trap, not at the doomed object",
        Math.abs(placeLog[0].angle - toTrap) < 1e-9);
}
placeLog.length = 0;
{
  // enemy's own trap holding them is not ours -> no retrap credit
  const trap = ownTrap(304);
  trap.ownerID = 99;
  const c = makeClient({ objects: [ownSpike(305)], enemyTrapped: true, enemyTrappedIn: trap });
  new PrePlacer(c).postTick();
  check("ignores a trap that is not ours", placeLog[0].type === 7);
}
placeLog.length = 0;
{
  const c = makeClient({ objects: [ownSpike(306)], enemyTrapped: false });
  new PrePlacer(c).postTick();
  check("traps first when nobody is pinned", placeLog[0].type === 7);
}
placeLog.length = 0;
{
  const trap = ownTrap(307);
  const c = makeClient({ objects: [trap], enemyTrapped: true, enemyTrappedIn: trap,
                         angleFan: [0, 0.3, -0.3] });
  const m = new PrePlacer(c);
  m.postTick();
  const first = placeLog.length;
  c._ModuleHandler.tickCount = 11;
  m.postTick();
  check("retrap burst respects the cooldown", placeLog.length === first);
}
placeLog.length = 0;
{
  const trap = ownTrap(308);
  const c = makeClient({ objects: [trap], enemyTrapped: true, enemyTrappedIn: trap,
                         angleFan: [0, 0.3, -0.3] });
  c._ModuleHandler.packetCount = 69;
  new PrePlacer(c).postTick();
  check("retrap burst stops at the packet budget", placeLog.length === 0);
}
placeLog.length = 0;
{
  // our trap on the enemy just broke -> re-pin at where they are going
  const c = makeClient({ deleted: [ownTrap(401)], enemyTrapped: false });
  new Replacer(c).postTick();
  check("replace re-traps when our trap on them broke", placeLog[0].type === 7);
  check("replace aims at the enemy, not the old slot", Math.abs(placeLog[0].angle) < 1e-9);
}
placeLog.length = 0;
{
  // they escaped this tick
  const c = makeClient({ deleted: [ownSpike(402)], enemyEscaped: true });
  new Replacer(c).postTick();
  check("replace traps an enemy that just escaped", placeLog[0].type === 7);
}
placeLog.length = 0;
{
  // still pinned and in reach -> spike into their trap
  const trap = ownTrap(403);
  trap.pos.current = new Vec(60, 0);
  const c = makeClient({ deleted: [ownSpike(404)], enemyTrapped: true, enemyTrappedIn: trap });
  new Replacer(c).postTick();
  check("replace spikes into the trap while they are pinned", placeLog[0].type === 4);
  check("replace aims at their trap", Math.abs(placeLog[0].angle) < 1e-9);
}
placeLog.length = 0;
{
  // pinned but far away -> fall through to the plain break-direction replace
  const trap = ownTrap(405);
  trap.pos.current = new Vec(400, 0);
  const c = makeClient({ deleted: [ownSpike(406)], enemyTrapped: true, enemyTrappedIn: trap });
  new Replacer(c).postTick();
  check("replace ignores an out-of-reach trap", placeLog[0].type === 4);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
