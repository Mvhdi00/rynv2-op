/* Anti spike push: does RYN now answer exactly what novastorm answers?
 *
 * Unlike the heal, neither side has to be transcribed here. Novastorm's
 * isNearestEnemyPushPlayer() is a top-level function, and RYN's AntiSpikePush
 * is a class — both can be lifted out of the shipped files with `vm` and run
 * against the same staged world. So this compares the real code, not a model
 * of it, and the only thing written here is the scenery.
 *
 * Every combination of the six things the rule actually looks at is staged
 * twice, once in each client's world shape, and the two verdicts must match on
 * every one. A single disagreement fails the run.
 *
 *   node antipush-duel.js [ryn.js] [novastorm.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/RYN_Client_v5.4.user.js");
const NOVA = process.argv[3] || path.resolve(__dirname, "../novastorm/Novastorm_1.41.4.user.js");

function lift(src, header, label) {
  const m = new RegExp(header).exec(src);
  if (!m) throw new Error("could not find " + label);
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index, i + 1); }
  }
  throw new Error("unbalanced " + label);
}

const rynSrc = fs.readFileSync(RYN, "utf8");
const novaSrc = fs.readFileSync(NOVA, "utf8");
const rynClass = lift(rynSrc, "class AntiSpikePush\\s*\\{", "AntiSpikePush");
const novaFn = lift(novaSrc, "function isNearestEnemyPushPlayer\\s*\\(", "isNearestEnemyPushPlayer");

/* The scene, in the abstract. Distances are the real ones: player scale 35,
 * spike scale 49, pit trap scale 32, daggers range 65, bat range 110. */
const SPIKE_SCALE = 49, TRAP_SCALE = 32, PLAYER = 35;
const WEAPONS = { 6: { range: 110 }, 7: { range: 65 }, 5: { range: 142 } };

const AXES = {
  trapped:      [true, false],   // am I standing in their pit trap
  spikeByTrap:  [true, false],   // is an enemy spike against that trap
  primary:      [7, 6, 5],       // daggers, bat, polearm
  enemyNear:    [true, false],   // is their next position inside my reach
  spikeDmg:     [0, 1],          // spikeDmgCount
  theirsPinned: [true, false],   // are they standing in MY trap
};

function scenes() {
  const out = [];
  for (const trapped of AXES.trapped)
    for (const spikeByTrap of AXES.spikeByTrap)
      for (const primary of AXES.primary)
        for (const enemyNear of AXES.enemyNear)
          for (const spikeDmg of AXES.spikeDmg)
            for (const theirsPinned of AXES.theirsPinned)
              out.push({ trapped, spikeByTrap, primary, enemyNear, spikeDmg, theirsPinned });
  return out;
}

/* Geometry shared by both stagings, so neither client is handed a different
 * world. I sit at the origin. Their trap is on me. The spike is either against
 * that trap or well clear of it. They stand at a distance chosen to be inside
 * or outside my reach once extrapolated one tick. */
function geometry(s) {
  const trapPos = { x: 0, y: 0 };
  const spikePos = s.spikeByTrap
    ? { x: 35 + SPIKE_SCALE + TRAP_SCALE - 10, y: 0 }   // inside the threshold
    : { x: 400, y: 0 };                                  // far clear of it
  const reach = PLAYER * 1.8 + WEAPONS[s.primary].range;
  const enemyD = s.enemyNear ? reach - 20 : reach + 60;
  // Their previous position, so future = current + (current - previous) sits
  // exactly where the current one is: a stationary target, so "where they will
  // be" is unambiguous and both clients read the same number.
  return { trapPos, spikePos, enemy: { x: 0, y: enemyD }, enemyPrev: { x: 0, y: enemyD } };
}

// ── novastorm's world ─────────────────────────────────────────────────────
function runNova(s) {
  const g = geometry(s);
  const trap = { id: 15, x: g.trapPos.x, y: g.trapPos.y, scale: TRAP_SCALE, owner: { sid: 2 } };
  const spike = { id: 6, x: g.spikePos.x, y: g.spikePos.y, scale: SPIKE_SCALE, owner: { sid: 2 } };
  // A trap of ours on them, when they are pinned.
  const ourTrap = { id: 15, x: g.enemy.x, y: g.enemy.y, scale: TRAP_SCALE, owner: { sid: 1 } };

  const sandbox = {
    Math,
    UTILS: { getDistance: (a, b, c, d) => Math.hypot(c - a, d - b) },
    nearestEnemy: { x2: g.enemy.x, y2: g.enemy.y, xVel: g.enemy.x, yVel: g.enemy.y },
    myPlayer: { sid: 1, x2: 0, y2: 0, weapons: [s.primary, 10] },
    items: { weapons: WEAPONS },
    isAlly: () => false,
    visibleObjects: s.theirsPinned ? [trap, spike, ourTrap] : [trap, spike],
    enemySpikes: [spike],
    nearestTrap: s.trapped ? trap : undefined,
    spikeDmgCount: s.spikeDmg,
    antiPushAngle: undefined,
  };
  vm.createContext(sandbox);
  vm.runInContext(novaFn + "\nthis.out = isNearestEnemyPushPlayer();", sandbox);
  return !!sandbox.out;
}

// ── RYN's world ───────────────────────────────────────────────────────────
class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}
class StubPlayerObject {
  constructor(type, itemGroup, x, y, scale, ownerID) {
    this.type = type; this.itemGroup = itemGroup; this.scale = scale; this.ownerID = ownerID;
    this.pos = { current: new Vec(x, y), previous: new Vec(x, y), future: new Vec(x, y) };
  }
}

function runRyn(s) {
  const g = geometry(s);
  const trap = new StubPlayerObject(15, 6, g.trapPos.x, g.trapPos.y, TRAP_SCALE, 2);
  const spike = new StubPlayerObject(6, 2, g.spikePos.x, g.spikePos.y, SPIKE_SCALE, 2);
  const ourTrap = new StubPlayerObject(15, 6, g.enemy.x, g.enemy.y, TRAP_SCALE, 1);
  const objects = new Map([[1, trap], [2, spike], [3, ourTrap]]);

  const pos = (x, y, px, py) => ({
    current: new Vec(x, y), previous: new Vec(px, py), future: new Vec(2 * x - px, 2 * y - py),
  });

  const ModuleHandler = {
    moduleActive: false, forceWeapon: null, useAngle: null,
    shouldAttack: false, forceHat: null,
    staticModules: { reloading: { isReloaded: () => true } },
    hasStoreItem: () => true,
  };

  const client = {
    _ModuleHandler: ModuleHandler,
    myPlayer: {
      pos: pos(0, 0, 0, 0), scale: PLAYER, hitScale: PLAYER * 1.8,
      tickCount: 10, damageTick: s.spikeDmg > 0 ? 11 : 0,
      getItemByType: () => s.primary,
    },
    EnemyManager: {
      nearestEnemy: {
        pos: pos(g.enemy.x, g.enemy.y, g.enemyPrev.x, g.enemyPrev.y),
        scale: PLAYER, hitScale: PLAYER * 1.8,
        trappedIn: s.theirsPinned ? ourTrap : null,
      },
      nearestTrap: s.trapped ? trap : null,
      collidingSpike: s.spikeDmg > 0,
    },
    ObjectManager: {
      objects,
      grid2D: {
        cellSize: 100,
        query(x, y, cells, cb) { for (const id of objects.keys()) if (cb(id)) return true; return false; },
      },
    },
    PlayerManager: { isEnemyByID: (ownerID) => ownerID !== 1 },
  };

  const sandbox = {
    Math, PlayerObject: StubPlayerObject,
    Settings_default: { _antiSpikePush: true },
    DataHandler_default: { getWeapon: (id) => WEAPONS[id] },
  };
  vm.createContext(sandbox);
  vm.runInContext(rynClass + "\nthis.make = (c) => new AntiSpikePush(c);", sandbox);
  const mod = sandbox.make(client);
  // spikeDmgCount is a running count, so give it the tick that set it before
  // reading the tick that uses it — novastorm's is maintained the same way.
  mod.postTick();
  if (s.spikeDmg > 0) mod.postTick();
  return ModuleHandler.moduleActive === true;
}

// ── compare ───────────────────────────────────────────────────────────────
const all = scenes();
let agree = 0;
const disagreements = [];
let fires = 0;
for (const s of all) {
  const n = runNova(s), r = runRyn(s);
  if (n === r) agree++;
  else disagreements.push({ s, n, r });
  if (n) fires++;
}

const pad = (v, w) => String(v).padEnd(w);
console.log("anti spike push — RYN against novastorm, on the same staged world\n");
console.log("  both sides are the shipped code, lifted with vm — nothing is transcribed\n");
console.log("  " + pad("scenes", 12) + all.length);
console.log("  " + pad("agree", 12) + agree + " (" + ((agree / all.length) * 100).toFixed(1) + "%)");
console.log("  " + pad("disagree", 12) + disagreements.length);
console.log("  " + pad("novastorm fires on", 20) + fires + " of " + all.length);

if (disagreements.length) {
  console.log("\n  where they part:");
  console.log("  " + pad("trapped", 9) + pad("spike@trap", 12) + pad("primary", 9) +
    pad("in reach", 10) + pad("spikeDmg", 10) + pad("they pinned", 13) + pad("nova", 7) + "ryn");
  for (const d of disagreements.slice(0, 12)) {
    console.log("  " + pad(d.s.trapped, 9) + pad(d.s.spikeByTrap, 12) + pad(d.s.primary, 9) +
      pad(d.s.enemyNear, 10) + pad(d.s.spikeDmg, 10) + pad(d.s.theirsPinned, 13) +
      pad(d.n, 7) + d.r);
  }
}

/* Agreement across 96 scenes where only 2 fire could be agreement on "no".
 * So take the scene that does fire and flip one axis at a time: each flip must
 * turn BOTH clients off, which is what proves every gate is carrying weight on
 * both sides rather than merely being absent from both. */
const firing = { trapped: true, spikeByTrap: true, primary: 7, enemyNear: true, spikeDmg: 0, theirsPinned: false };
const FLIP = {
  trapped: false, spikeByTrap: false, primary: 5, enemyNear: false, spikeDmg: 1, theirsPinned: true,
};
console.log("\n  each gate, flipped on its own away from the one scene that fires:");
console.log("  " + pad("gate flipped", 26) + pad("novastorm", 12) + pad("ryn", 8) + "gate is live");
console.log("  " + "-".repeat(62));
let dead = 0;
const base = { n: runNova(firing), r: runRyn(firing) };
console.log("  " + pad("(nothing — the scene)", 26) + pad(base.n ? "fires" : "declines", 12) +
  pad(base.r ? "fires" : "declines", 10) + (base.n && base.r ? "—" : "BASE BROKEN"));
if (!base.n || !base.r) dead++;
for (const axis of Object.keys(FLIP)) {
  const s = Object.assign({}, firing, { [axis]: FLIP[axis] });
  const n = runNova(s), r = runRyn(s);
  const live = !n && !r;
  if (!live) dead++;
  console.log("  " + pad(axis + " -> " + FLIP[axis], 26) + pad(n ? "fires" : "declines", 12) +
    pad(r ? "fires" : "declines", 10) + (live ? "yes" : "NO  <-"));
}

const ok = disagreements.length === 0 && dead === 0;
console.log("\n  " + (ok
  ? "identical on every scene, and every gate shuts both of them off — the rule is novastorm's"
  : (disagreements.length ? disagreements.length + " scenes differ. " : "") +
    (dead ? dead + " gate(s) not carrying weight." : "")));
process.exit(ok ? 0 : 1);
