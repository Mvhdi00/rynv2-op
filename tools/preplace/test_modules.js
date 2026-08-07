// Slice the ported auraro placer out of a shipped build and drive it against
// stubbed RYN managers, so the real arithmetic is checked and not just parsed.
//
//   node test_modules.js            owner build
//   node test_modules.js --player   the copy spliced into the obfuscated build
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");

const usePlayer = process.argv.includes("--player");
const src = fs.readFileSync(usePlayer ? RYN_PLAYER : RYN_OWNER, "utf8");
console.log(usePlayer ? "(player build)" : "(owner build)");

const START = "  const AURA_TWO_PI = Math.PI * 2;";
const END = "  const Replacer_default = Replacer;";
const a = src.indexOf(START), b = src.indexOf(END);
if (a < 0 || b < a) throw new Error("could not slice the placer out");
const code = src.slice(a, b + END.length);

// ---- stubs ----------------------------------------------------------------
const SPIKE_ITEM = 9, TRAP_ITEM = 15;
const PLAYER_SCALE = 35;

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}
class PlayerObject {
  constructor(o) { Object.assign(this, o); }
}
const Items = [];
Items[SPIKE_ITEM] = { id: SPIKE_ITEM, scale: 35, placeOffset: 0, itemGroup: 2 };
Items[TRAP_ITEM] = { id: TRAP_ITEM, scale: 32, placeOffset: -5, itemGroup: 4 };
const Config_default = { mapScale: 14400, riverWidth: 724 };
const DataHandler_default = {
  isWeapon: id => id === 0 || id === 10,
  getWeapon: () => ({ range: 65, damage: 40 }),
};
const Settings_default = {
  _autoplacer: true, _autoplacerRadius: 350,
  _prePlace: true, _prePlaceRadius: 270, _prePlaceHits: 4,
  _replace: true, _replaceRadius: 300,
  _autoPush: false, _autoPushRange: 250, _antiTrapProtect: true,
};
class MovementSimulation {
  reset(c) { const p = c.myPlayer.pos.current; this.x = p.x; this.y = p.y; }
  update() {}
}

const placeLog = [];
function makeClient(opts = {}) {
  const {
    deleted = [], objects = [], myTrapped = false, myTrappedIn = null,
    myEscaped = false, myTrappedInPrev = null,
    enemyTrapped = false, enemyTrappedIn = null, enemyEscaped = false,
    enemyDist = 100, packetCount = 0,
  } = opts;
  const myPos = new Vec(7200, 3000); // well clear of the river band
  const enemy = {
    pos: { current: new Vec(myPos.x + enemyDist, myPos.y), future: new Vec(myPos.x + enemyDist, myPos.y) },
    scale: PLAYER_SCALE,
    isTrapped: enemyTrapped,
    trappedIn: enemyTrappedIn,
    wasTrapped: () => enemyEscaped,
    weapon: { primary: 0, secondary: 10 },
    getBuildingDamage: () => 40,
  };
  const objMap = new Map(objects.map(o => [o.id, o]));
  return {
    myPlayer: {
      inGame: true, scale: PLAYER_SCALE,
      isTrapped: myTrapped, trappedIn: myTrappedIn, trappedInPrev: myTrappedInPrev,
      wasTrapped: () => myEscaped,
      pos: { current: myPos, future: myPos },
      canPlace: () => true,
      getItemByType: t => (t === 4 ? SPIKE_ITEM : TRAP_ITEM),
    },
    EnemyManager: { nearestEnemy: enemy },
    PlayerManager: { isEnemyByID: ownerID => ownerID !== 1 },
    _ModuleHandler: {
      tickCount: 10, packetCount, packetLimit: 70,
      placedOnce: false, moduleActive: false, placeAngles: [null, []],
      place(type, angle) {
        placeLog.push({ type, angle });
        this.packetCount += type === 7 ? 5 : 4;
      },
    },
    ObjectManager: {
      objects: objMap,
      deletedObjects: new Set(deleted),
      grid2D: { queryFull: () => [...objMap.keys()] },
    },
  };
}

// The player build reaches its globals by mangled name, so bind the same
// stubs under whatever names.js resolved them to.
const globals = { Items, Config_default, Settings_default, PlayerObject,
                  DataHandler_default, MovementSimulation };
const sandbox = { Math, Number, Date, Map, Set, console };
if (usePlayer) {
  const NAMES = require("./names.js");
  for (const [logical, mangled] of Object.entries(NAMES)) sandbox[mangled] = globals[logical];
} else {
  Object.assign(sandbox, globals);
}
vm.createContext(sandbox);
vm.runInContext(
  code +
    "\nglobalThis.__Aura = AuraPlacer;" +
    "\nglobalThis.__AutoPlacer = AutoPlacer;" +
    "\nglobalThis.__PrePlacer = PrePlacer_default;" +
    "\nglobalThis.__Replacer = Replacer_default;",
  sandbox
);
const { __Aura: AuraPlacer, __AutoPlacer: AutoPlacer, __PrePlacer: PrePlacer, __Replacer: Replacer } = sandbox;

// ---- helpers --------------------------------------------------------------
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
}
const TWO_PI = Math.PI * 2;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

let nextId = 1000;
function ownSpike(pos, extra = {}) {
  return new PlayerObject({
    id: nextId++, ownerID: 1, itemGroup: 2, type: SPIKE_ITEM, isSpike: true,
    isDestroyable: true, health: 100, canBeDestroyed: false, destroyingTick: -1,
    scale: 35, placementScale: 35, pos: { current: pos }, ...extra,
  });
}
function ownTrap(pos, extra = {}) {
  return new PlayerObject({
    id: nextId++, ownerID: 1, itemGroup: 4, type: 15, isSpike: false,
    // three swings at the stubbed 40 dmg, so it counts as doomed
    isDestroyable: true, health: 120, canBeDestroyed: false, destroyingTick: -1,
    scale: 32, placementScale: 32, pos: { current: pos }, ...extra,
  });
}

// ===========================================================================
console.log("arc geometry");
{
  const p = new AuraPlacer(makeClient());

  check("normalizeAngle wraps below zero", near(p.normalizeAngle(-1), TWO_PI - 1));
  check("normalizeAngle wraps above 2pi", near(p.normalizeAngle(TWO_PI + 1), 1));
  check("angleDist takes the short way round", near(p.angleDist(0.1, TWO_PI - 0.1), 0.2));
  check("angleDist is symmetric", near(p.angleDist(1, 4), p.angleDist(4, 1)));

  // two overlapping blocked arcs collapse into one
  const merged = p.mergeBlocked([[0, 1], [0.5, 2], [3, 4]]);
  check("mergeBlocked joins overlapping arcs", merged.length === 2 && near(merged[0][0], 0) && near(merged[0][1], 2));

  // a wrapping arc is split across the seam
  const wrapped = p.mergeBlocked([[6, 0.5]]);
  check("mergeBlocked splits an arc across 0", wrapped.length === 2);

  // inverting [0,2] and [3,4] leaves the gaps between them
  const free = p.invertArcs([[0, 2], [3, 4]]);
  check("invertArcs returns the gaps", free.length === 2 && near(free[0][0], 2) && near(free[0][1], 3));
  check("invertArcs of nothing is the whole circle",
        p.invertArcs([]).length === 1 && near(p.invertArcs([])[0][1], TWO_PI));

  check("angleInArc handles a normal arc", p.angleInArc(1, 0, 2) && !p.angleInArc(3, 0, 2));
  check("angleInArc handles a wrapping arc", p.angleInArc(0.1, 6, 0.5) && !p.angleInArc(3, 6, 0.5));

  // closeToAngle returns the angle itself when it is already free
  check("closeToAngle keeps a free angle", near(p.closeToAngle(1, [[0, 2]]), 1));
  // and otherwise snaps to the nearest edge
  check("closeToAngle snaps to the nearest edge", near(p.closeToAngle(2.5, [[0, 2]]), 2));
  check("closeToAngle on empty ranges is null", p.closeToAngle(1, []) === null);

  const inter = p.intersectRanges([[0, 2]], [[1, 3]]);
  check("intersectRanges overlaps correctly", inter.length === 1 && near(inter[0][0], 1) && near(inter[0][1], 2));
  check("intersectRanges of disjoint arcs is empty", p.intersectRanges([[0, 1]], [[2, 3]]).length === 0);

  check("normalizeArc keeps orientation", (() => { const [s, e] = p.normalizeArc(1, 2); return near(s, 1) && near(e, 2); })());
  check("isAngleFree reads the free list", p.isAngleFree(1, [[0, 2]]) && !p.isAngleFree(3, [[0, 2]]));
}

// ===========================================================================
console.log("tangent angles");
{
  const c = makeClient();
  const p = new AuraPlacer(c);
  const my = c.myPlayer.pos.current;

  // A spike sits at offset 70 from us. An object dead ahead at 70 is close
  // enough to block, so we get the two tangent angles either side of it.
  const blocking = ownSpike(new Vec(my.x + 70, my.y));
  const two = p.closestPossibleAngles(blocking, 4, my.x, my.y);
  check("a close object yields two tangent angles", two.length === 2);
  check("tangents straddle the object's bearing", two[0] > 0 !== two[1] > 0);
  check("tangents are symmetric about the bearing", near(two[0], -two[1], 1e-9));

  // Far away it cannot block anything, so we just get its bearing.
  const far = ownSpike(new Vec(my.x + 900, my.y));
  const one = p.closestPossibleAngles(far, 4, my.x, my.y);
  check("a distant object yields only its bearing", one.length === 1 && near(one[0], 0));
}

// ===========================================================================
console.log("placement checks");
{
  const c = makeClient();
  const p = new AuraPlacer(c);
  const my = c.myPlayer.pos.current;
  const doomed = ownSpike(new Vec(my.x + 70, my.y));
  const other = ownSpike(new Vec(my.x, my.y + 70));

  check("checkItemLocation refuses an occupied spot",
        p.checkItemLocation(my.x + 70, my.y, 35, 4, [doomed]) === false);
  check("checkItemLocation allows a free spot",
        p.checkItemLocation(my.x + 70, my.y, 35, 4, [other]) === true);
  check("checkItemLocation refuses the river",
        p.checkItemLocation(my.x, Config_default.mapScale / 2, 35, 4, []) === false);

  // preplaceCheck ignores the doomed object but demands the spot overlap it
  check("preplaceCheck accepts the freed slot",
        p.preplaceCheck(my.x + 70, my.y, 35, 4, doomed, [doomed]) === true);
  check("preplaceCheck rejects a spot away from the freed slot",
        p.preplaceCheck(my.x - 70, my.y, 35, 4, doomed, [doomed]) === false);
  check("preplaceCheck still respects other objects",
        p.preplaceCheck(my.x + 70, my.y, 35, 4, doomed, [doomed, ownSpike(new Vec(my.x + 80, my.y))]) === false);

  check("hitsToBreak divides health by the best swing",
        p.hitsToBreak(doomed, c.EnemyManager.nearestEnemy) === 3);
  check("hitsToBreak of an indestructible object is Infinity",
        p.hitsToBreak(ownSpike(new Vec(0, 0), { isDestroyable: false }), c.EnemyManager.nearestEnemy) === Infinity);
}

// ===========================================================================
console.log("angleRanges / calcPreplace");
{
  const c = makeClient();
  const p = new AuraPlacer(c);
  const my = c.myPlayer.pos.current;
  const blocker = ownSpike(new Vec(my.x + 70, my.y));
  c.ObjectManager.objects.set(blocker.id, blocker);

  p.angleRanges(4, my.x, my.y);
  const free = p.ranges[4];
  check("angleRanges produces free arcs", Array.isArray(free) && free.length > 0);
  check("angleRanges blocks the occupied bearing", !p.isAngleFree(0, free));
  check("angleRanges leaves the opposite side free", p.isAngleFree(Math.PI, free));

  p.calcPreplace(blocker, 4, my.x, my.y);
  const pre = p.preplaceRanges[4];
  check("calcPreplace frees the doomed bearing", p.isAngleFree(0, pre));
}

// ===========================================================================
console.log("AutoPlacer dispatch");
{
  // Which autoPlace shape runs is decided by distance and who is pinned.
  const calls = [];
  const spy = c => {
    const p = new AuraPlacer(c);
    p.autoPlace = (...args) => calls.push(args);
    c._auraPlacer = p;
    return c;
  };
  const run = opts => {
    calls.length = 0;
    const c = spy(makeClient(opts));
    new AutoPlacer(c).postTick();
    return calls[0];
  };

  check("pinned enemy inside 222 -> spike first", String(run({ enemyDist: 150, enemyTrapped: true })) === "0,4,7");
  check("escaped enemy inside 222 -> trap first", String(run({ enemyDist: 150, enemyEscaped: true })) === "0,7,4");
  check("neither, inside 222 -> extend spikes", String(run({ enemyDist: 150 })) === "1,4,7,true");
  check("between 269 and 400 -> lay traps", String(run({ enemyDist: 300 })) === "0,7,4");
  check("between 222 and 269 -> extend traps", String(run({ enemyDist: 240 })) === "1,7,4,true");
  check("pushing and very close -> spike", String(run({ enemyDist: 150, myTrapped: false,
        ...(Settings_default._autoPush = true, {}) })) === "0,4,7");
  Settings_default._autoPush = false;

  calls.length = 0;
  const far = spy(makeClient({ enemyDist: 900 }));
  new AutoPlacer(far).postTick();
  check("beyond the radius nothing runs", calls.length === 0);

  calls.length = 0;
  Settings_default._autoplacer = false;
  const off = spy(makeClient({ enemyDist: 150 }));
  new AutoPlacer(off).postTick();
  check("off when the setting is off", calls.length === 0);
  Settings_default._autoplacer = true;

  calls.length = 0;
  const twice = spy(makeClient({ enemyDist: 150 }));
  const mod = new AutoPlacer(twice);
  mod.postTick();
  mod.postTick();
  check("runs once per tick", calls.length === 1);
}

// ===========================================================================
console.log("autoPlace / radCalc");
{
  placeLog.length = 0;
  const c = makeClient();
  const my = c.myPlayer.pos.current;
  const anchor = ownSpike(new Vec(my.x + 55, my.y)); // inside the placement ring
  c.ObjectManager.objects.set(anchor.id, anchor);
  const p = new AuraPlacer(c);
  p.autoPlace(0, 4, 7);
  check("autoPlace lays builds against a nearby object", placeLog.length > 0);
  check("autoPlace places spikes when asked for spikes", placeLog.every(x => x.type === 4));

  // reserved spots stop a second placement landing on the same ground
  placeLog.length = 0;
  const p2 = new AuraPlacer(c);
  const angles1 = p2.radCalc(anchor, 0, Items[SPIKE_ITEM], undefined, my.x, my.y);
  const angles2 = p2.radCalc(anchor, 0, Items[SPIKE_ITEM], undefined, my.x, my.y);
  check("radCalc returns angles for a touching object", angles1.length > 0);
  check("radCalc will not reissue a reserved spot", angles2.length === 0);

  // with nothing around, autoPlace falls back to four angles around the aim
  placeLog.length = 0;
  const empty = makeClient();
  new AuraPlacer(empty).autoPlace(0, 4, 7);
  check("autoPlace falls back to a four-way fan", placeLog.length === 4);
}

// ===========================================================================
console.log("testCanPlace / protect");
{
  placeLog.length = 0;
  const c = makeClient();
  new AuraPlacer(c).testCanPlace(4, -Math.PI / 2, Math.PI / 2, Math.PI / 6, 0, true);
  check("testCanPlace sweeps and places", placeLog.length > 0);
  check("testCanPlace stays within the packet budget", placeLog.length <= Math.floor(70 / 4));

  placeLog.length = 0;
  const budget = makeClient({ packetCount: 69 });
  new AuraPlacer(budget).testCanPlace(4, -Math.PI / 2, Math.PI / 2, Math.PI / 6, 0, true);
  check("testCanPlace refuses once the budget is gone", placeLog.length === 0);

  placeLog.length = 0;
  const prot = makeClient();
  new AuraPlacer(prot).protect(0);
  check("protect walls off the far side", placeLog.length > 0);
  check("protect uses both traps and spikes",
        placeLog.some(x => x.type === 7) && placeLog.some(x => x.type === 4));

  // the same angle cannot be hammered more than four times in a tick
  placeLog.length = 0;
  const cap = new AuraPlacer(makeClient());
  let ok = 0;
  for (let i = 0; i < 8; i++) if (cap.tryPlaceAngle(4, 1.234)) ok++;
  check("tryPlaceAngle caps repeats per angle", ok === 4);
}

// ===========================================================================
console.log("PrePlacer");
{
  const withDoomed = (extra = {}) => {
    const c = makeClient(extra);
    const my = c.myPlayer.pos.current;
    const doomed = extra.doomedTrap
      ? ownTrap(new Vec(my.x + 67, my.y))
      : ownSpike(new Vec(my.x + 70, my.y));
    c.ObjectManager.objects.set(doomed.id, doomed);
    return { c, doomed };
  };

  placeLog.length = 0;
  {
    const { c } = withDoomed();
    new PrePlacer(c).postTick();
    check("fires on a nearly-dead own build", placeLog.length === 1);
  }
  placeLog.length = 0;
  {
    const { c, doomed } = withDoomed();
    doomed.health = 100000;
    new PrePlacer(c).postTick();
    check("stays quiet on a healthy build", placeLog.length === 0);
  }
  placeLog.length = 0;
  {
    const { c, doomed } = withDoomed();
    doomed.health = 100000;
    doomed.canBeDestroyed = true;
    doomed.destroyingTick = 10;
    new PrePlacer(c).postTick();
    check("canBeDestroyed overrides the hit threshold", placeLog.length === 1);
  }
  placeLog.length = 0;
  {
    const { c, doomed } = withDoomed();
    doomed.ownerID = 99;
    new PrePlacer(c).postTick();
    check("ignores enemy buildings", placeLog.length === 0);
  }
  placeLog.length = 0;
  {
    const { c } = withDoomed({ enemyDist: 900 });
    new PrePlacer(c).postTick();
    check("respects the preplace radius", placeLog.length === 0);
  }
  placeLog.length = 0;
  {
    const { c } = withDoomed({ packetCount: 69 });
    new PrePlacer(c).postTick();
    check("stops at the packet budget", placeLog.length === 0);
  }
  placeLog.length = 0;
  {
    const { c } = withDoomed();
    const m = new PrePlacer(c);
    m.postTick();
    const first = placeLog.length;
    m.postTick();
    check("runs once per tick", placeLog.length === first);
  }
  placeLog.length = 0;
  {
    Settings_default._prePlace = false;
    const { c } = withDoomed();
    new PrePlacer(c).postTick();
    check("off when the setting is off", placeLog.length === 0);
    Settings_default._prePlace = true;
  }

  // retrap: the doomed build IS the trap holding the enemy
  placeLog.length = 0;
  {
    const c = makeClient({ enemyTrapped: true });
    const my = c.myPlayer.pos.current;
    const trap = ownTrap(new Vec(my.x + 67, my.y));
    c.ObjectManager.objects.set(trap.id, trap);
    c.EnemyManager.nearestEnemy.trappedIn = trap;
    new PrePlacer(c).postTick();
    check("retrap spam fires on the trap holding them", placeLog.length > 1);
    check("retrap spam places traps", placeLog.every(x => x.type === 7));
    check("retrap spam respects the budget", placeLog.length <= Math.floor(70 / 5));
  }
  // enemy pinned by something else -> spike
  placeLog.length = 0;
  {
    const c = makeClient({ enemyTrapped: true });
    const my = c.myPlayer.pos.current;
    const trap = ownTrap(new Vec(my.x, my.y + 67), { health: 100000 });
    const doomed = ownSpike(new Vec(my.x + 70, my.y));
    c.ObjectManager.objects.set(trap.id, trap);
    c.ObjectManager.objects.set(doomed.id, doomed);
    c.EnemyManager.nearestEnemy.trappedIn = trap;
    new PrePlacer(c).postTick();
    check("spikes when they are pinned by something else",
          placeLog.length > 0 && placeLog[0].type === 4);
  }
  // a trap that is not ours earns no retrap
  placeLog.length = 0;
  {
    const c = makeClient({ enemyTrapped: true });
    const my = c.myPlayer.pos.current;
    const trap = ownTrap(new Vec(my.x + 67, my.y), { ownerID: 99 });
    const doomed = ownSpike(new Vec(my.x, my.y + 70));
    c.ObjectManager.objects.set(doomed.id, doomed);
    c.EnemyManager.nearestEnemy.trappedIn = trap;
    new PrePlacer(c).postTick();
    check("ignores a trap that is not ours", placeLog.length > 0 && placeLog[0].type === 7);
  }
}

// ===========================================================================
console.log("Replacer");
{
  placeLog.length = 0;
  {
    const c = makeClient({ deleted: [ownSpike(new Vec(7200 + 70, 3000))] });
    new Replacer(c).postTick();
    check("replaces a destroyed own build", placeLog.length > 0 && placeLog[0].type === 4);
  }
  placeLog.length = 0;
  {
    const c = makeClient({ deleted: [ownSpike(new Vec(7200 + 70, 3000))], enemyEscaped: true });
    new Replacer(c).postTick();
    check("traps an enemy that just escaped", placeLog[0].type === 7);
  }
  placeLog.length = 0;
  {
    const c = makeClient({ enemyTrapped: true });
    const my = c.myPlayer.pos.current;
    const trap = ownTrap(new Vec(my.x + 60, my.y));
    c.EnemyManager.nearestEnemy.trappedIn = trap;
    c.ObjectManager.deletedObjects = new Set([ownSpike(new Vec(my.x, my.y + 70))]);
    new Replacer(c).postTick();
    check("spikes into their trap while they are pinned", placeLog[0].type === 4);
  }
  placeLog.length = 0;
  {
    const held = ownTrap(new Vec(7200 + 67, 3000));
    const c = makeClient({ deleted: [held], myEscaped: true, myTrappedInPrev: held });
    new Replacer(c).postTick();
    check("lays two opposed traps after we escape", placeLog.filter(x => x.type === 7).length === 2);
  }
  placeLog.length = 0;
  {
    const enemyBuild = ownSpike(new Vec(7200 + 70, 3000), { ownerID: 99 });
    const c = makeClient({ deleted: [enemyBuild] });
    new Replacer(c).postTick();
    check("does not replace enemy buildings", placeLog.length === 0);
  }
  placeLog.length = 0;
  {
    const wall = ownSpike(new Vec(7200 + 70, 3000), { itemGroup: 1, type: 3 });
    const c = makeClient({ deleted: [wall] });
    new Replacer(c).postTick();
    check("ignores non spike/trap losses", placeLog.length === 0);
  }
  placeLog.length = 0;
  {
    const c = makeClient({ deleted: [ownSpike(new Vec(7200 + 70, 3000))], enemyDist: 900 });
    new Replacer(c).postTick();
    check("respects the replace radius", placeLog.length === 0);
  }
  placeLog.length = 0;
  {
    // nothing died, but one of ours is two hits from dying
    const c = makeClient();
    const my = c.myPlayer.pos.current;
    const weak = ownSpike(new Vec(my.x + 70, my.y), { health: 60 });
    c.ObjectManager.objects.set(weak.id, weak);
    new Replacer(c).postTick();
    check("replaces pre-emptively at two hits from death", placeLog.length > 0);
  }
  placeLog.length = 0;
  {
    Settings_default._replace = false;
    const c = makeClient({ deleted: [ownSpike(new Vec(7200 + 70, 3000))] });
    new Replacer(c).postTick();
    check("off when the setting is off", placeLog.length === 0);
    Settings_default._replace = true;
  }
  placeLog.length = 0;
  {
    const c = makeClient({ deleted: [ownSpike(new Vec(7200 + 70, 3000))], packetCount: 69 });
    new Replacer(c).postTick();
    check("stops at the packet budget", placeLog.length === 0);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
