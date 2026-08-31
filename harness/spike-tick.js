/* The spike tick, lifted out of the client and run.
 *
 * `class SpikeTick` is pulled from ryn/RYN_Client_v5.4.user.js with `vm`, so
 * this drives the shipped code, not a copy of it. Only the world is staged:
 * a stub client with the same shape the module reads — myPlayer, EnemyManager,
 * ObjectManager.grid2D, PlayerManager, and a placement engine whose ledger,
 * book, motion and anglesFor are the REAL ones, lifted the same way.
 *
 * The 20 scenarios in the brief are the rows. Each states what should happen
 * and why, and the run exits non-zero if any row is wrong.
 *
 *   node spike-tick.js [ryn.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/RYN_Client_v5.4.user.js");
const src = fs.readFileSync(RYN, "utf8");

function lift(header, label) {
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
function constant(name) {
  const m = new RegExp("const " + name + " = ([^;]+);").exec(src);
  if (!m) throw new Error(name + " is gone from the client");
  return m[1];
}

// ── the world the module reads ────────────────────────────────────────────
const SPIKE = { id: 6, scale: 49, placeOffset: -5, dmg: 20, itemGroup: 2 };
const PLAYER_SCALE = 35;
const RING = PLAYER_SCALE + SPIKE.scale + SPIKE.placeOffset;   // 79
const CONTACT = PLAYER_SCALE + SPIKE.scale;                    // 84

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
  addDirection(a, d) { return new Vec(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d); }
  copy() { return new Vec(this.x, this.y); }
}

const sandbox = {
  Math, Object, Infinity, Set, Map, WeakMap, Array, JSON, isFinite, console,
  Vector_default: Vec,
  getAngleDist: (a, b) => { const p = Math.abs(b - a) % (Math.PI * 2); return p > Math.PI ? Math.PI * 2 - p : p; },
  Items: { 6: SPIKE },
  Settings_default: { _spikeTick: true, _spikeTickTrapped: true, _spikeTickFree: true },
  DataHandler_default: { getWeapon: () => ({ range: 142, knockback: 0.7 }) },
  GameUI_default: { updateSpikeTick: (v) => { sandbox.__painted = v; } },
  PlayerObject: class PlayerObject {},
  RPE_EPS: 1e-6, RPE_TAU: Math.PI * 2, RPE_MOTION_SAMPLES: 5,
  RPE_DECEL: 0.993, RPE_TICK_MS: 1000 / 9,
};
sandbox.RPE_TICK_DECAY = Math.pow(sandbox.RPE_DECEL, sandbox.RPE_TICK_MS);
vm.createContext(sandbox);
vm.runInContext(lift("const GeometrySolver = \\{", "GeometrySolver") + ";\nthis.GeometrySolver = GeometrySolver;", sandbox);
vm.runInContext(lift("class TargetMotion\\s*\\{", "TargetMotion") + "\nthis.TargetMotion = TargetMotion;", sandbox);
vm.runInContext(lift("class PlacementLedger\\s*\\{", "PlacementLedger") + "\nthis.Ledger = PlacementLedger;", sandbox);
for (const name of ["SPIKE_TICK_TYPE", "SPIKE_TICK_KB_SAFE", "SPIKE_TICK_STICK",
                    "SPIKE_TICK_TURN_LIMIT", "SPIKE_TICK_LEAD", "SPIKE_TICK_MIN_CONFIDENCE",
                    "SPIKE_TICK_ANGLE_LIMIT", "SPIKE_TICK_TRAPPED_BONUS"]) {
  vm.runInContext("const " + name + " = " + constant(name) + ";", sandbox);
}
vm.runInContext("const SPIKE_TICK_REASON = " +
  /const SPIKE_TICK_REASON = (\{[\s\S]*?\n  \});/.exec(src)[1] + ";", sandbox);
vm.runInContext(lift("class SpikeTick\\s*\\{", "SpikeTick") + "\nthis.SpikeTick = SpikeTick;", sandbox);
const { SpikeTick, TargetMotion, Ledger } = sandbox;

/* A world. Objects are spikes at absolute positions; `blocked` are ring angles
 * the engine's solver should refuse (a wall, a rock, an enemy trap). */
function world(opts) {
  const me = new Vec(0, 0);
  const enemies = (opts.enemies || []).map((e, i) => ({
    id: 2 + i,
    scale: 35, collisionScale: 35, get hitScale() { return 35 * 1.8; },
    isTrapped: !!e.trapped,
    pos: { current: new Vec(e.x, e.y), previous: new Vec(e.x - (e.vx || 0), e.y - (e.vy || 0)) },
    _vx: e.vx || 0, _vy: e.vy || 0,
  }));
  const objects = new Map();
  for (const s of opts.spikes || []) {
    const o = new sandbox.PlayerObject();
    o.id = objects.size + 100;
    o.itemGroup = 2; o.ownerID = s.mine === false ? 9 : 1;
    o.scale = s.scale || SPIKE.scale;
    o.collisionScale = o.scale;
    o.getDamage = () => s.dmg || SPIKE.dmg;
    o.pos = { current: new Vec(s.x, s.y) };
    objects.set(o.id, o);
  }

  const ledger = new Ledger();
  for (const r of opts.reserved || []) {
    ledger.reserve(Math.cos(r.angle) * RING, Math.sin(r.angle) * RING,
      r.radius === undefined ? SPIKE.scale : r.radius,
      r.priority || 40, r.owner || "autoPlacer", 0, 5,
      r.soft ? { soft: true, value: 50 } : undefined);
  }
  const booked = (opts.booked || []).map(b => ({
    state: "pending", type: 4, footR: SPIKE.scale,
    x: Math.cos(b.angle) * RING, y: Math.sin(b.angle) * RING,
  }));

  const motion = new TargetMotion();
  const blocked = opts.blocked || [];
  const engine = {
    ledger,
    motion,
    book: { pending: () => booked, records: booked },
    _exits: opts.exits || null,
    profileFor: () => ({ type: 4, id: 6, footR: SPIKE.scale, ringR: RING, item: SPIKE, isDamage: true }),
    // The real solver needs the whole engine; here it is the one piece
    // restated, and it is restated as "every 5 degrees that is not blocked",
    // sorted by proximity to the aim — which is anglesFor's contract.
    anglesFor(type, targetAngle, opts2) {
      const out = [];
      for (let a = -Math.PI; a < Math.PI; a += Math.PI / 36) {
        if (blocked.some(b => sandbox.getAngleDist(a, b) < 0.35)) continue;
        out.push(a);
      }
      out.sort((x, y) => sandbox.getAngleDist(x, targetAngle) - sandbox.getAngleDist(y, targetAngle));
      return opts2 && opts2.limit ? out.slice(0, opts2.limit) : out;
    },
  };

  let placed = [];
  const ModuleHandler = {
    tickCount: opts.tick === undefined ? 5 : opts.tick,
    moduleActive: !!opts.moduleActive,
    forceHat: null, forceWeapon: null, useAngle: null, shouldAttack: false,
    placedOnce: false, placeAngles: [null, []],
    staticModules: {
      placementEngine: engine,
      reloading: { isReloaded: (slot) => opts.reloaded === false ? false : (slot !== 2 || opts.turret !== false) },
    },
    requestPlaceMany(type, angles, owner) {
      // The engine's own arbitration, in the one line that matters here: ground
      // a hard entry holds is gone, whatever the caller's priority.
      let n = 0;
      for (const a of angles) {
        const x = Math.cos(a) * RING, y = Math.sin(a) * RING;
        if (ledger.blocked(x, y, SPIKE.scale, 80, 1e6)) continue;
        ledger.reserve(x, y, SPIKE.scale, 80, owner, this.tickCount, 2);
        placed.push(a);
        n++;
        break;                      // one spike per tick, as the module asks
      }
      return n;
    },
  };

  const client = {
    isOwner: true,
    _ModuleHandler: ModuleHandler,
    myPlayer: {
      id: 1, inGame: true, isTrapped: !!opts.meTrapped,
      pos: { current: me },
      getItemByType: (t) => (t === 0 ? 5 : t === 4 ? 6 : null),
      getItemPlaceScale: () => RING,
      collidingSimple(e, range) { return me.distance(e.pos.current) <= range; },
    },
    EnemyManager: {
      nearestEnemy: enemies[0] || null,
      secondNearestEnemy: enemies[1] || null,
      nearestTrappedEnemy: enemies.find(e => e.isTrapped) || null,
      enemySpikeCollider: null,
      shouldIgnoreModule: () => !!opts.danger,
    },
    ObjectManager: {
      objects,
      isDestroyedObject: () => !!opts.vacated,
      grid2D: { cellSize: 100, query(x, y, c, cb) { for (const k of objects.keys()) if (cb(k)) return true; return false; } },
    },
    PlayerManager: { isEnemyByID: (ownerID, of) => ownerID !== of.id },
    StatsManager: { set spikeSyncTimes(_v) {} },
  };
  return { client, ModuleHandler, engine, enemies, get placed() { return placed; } };
}

function run(opts) {
  // A row can name the exact samples instead of a velocity, when what is being
  // tested is what the motion track makes of them.
  if (opts.samples) {
    const last = opts.samples[opts.samples.length - 1];
    const w = world({ ...opts, enemies: [{ x: last[0], y: last[1], trapped: opts.trapped }], observe: false });
    const mod = new SpikeTick(w.client);
    const e = w.enemies[0];
    const t = w.ModuleHandler.tickCount;
    opts.samples.forEach((p, i) => {
      w.engine.motion.observe({ id: e.id, pos: { current: new Vec(p[0], p[1]) } },
        t - (opts.samples.length - 1 - i));
    });
    sandbox.__painted = null;
    mod.postTick();
    return { swung: !!w.ModuleHandler.shouldAttack, placed: w.placed.length,
             painted: sandbox.__painted,
             reason: /,\s*([a-zA-Z]+)\)/.exec(sandbox.__painted || "")?.[1] || null,
             target: mod.targetId, mod, world: w };
  }
  const w = world(opts);
  const mod = new SpikeTick(w.client);
  sandbox.__painted = null;
  // Three observations. TargetMotion's confidence is stability * depth *
  // horizon, and with only two samples depth is 0.5 and stability 0.35, which
  // never clears SPIKE_TICK_MIN_CONFIDENCE — three straight samples is the
  // first point at which the module is willing to lead at all.
  if (opts.observe !== false) {
    const t = w.ModuleHandler.tickCount;
    for (const e of w.enemies) {
      for (let k = 2; k >= 1; k--) {
        w.engine.motion.observe(
          { id: e.id, pos: { current: new Vec(e.pos.current.x - e._vx * k, e.pos.current.y - e._vy * k) } },
          t - k);
      }
      w.engine.motion.observe(e, t);
    }
  }
  mod.postTick();
  const MH = w.ModuleHandler;
  return {
    swung: !!MH.shouldAttack,
    hat: MH.forceHat,
    placed: w.placed.length,
    painted: sandbox.__painted,
    reason: /,\s*([a-zA-Z]+)\)/.exec(sandbox.__painted || "")?.[1] || null,
    target: mod.targetId,
    mod, world: w,
  };
}

const near = (a, d) => ({ x: Math.cos(a) * d, y: Math.sin(a) * d });
const onRing = (a) => ({ x: Math.cos(a) * RING, y: Math.sin(a) * RING });
const pad = (v, w) => String(v).padEnd(w);

console.log(path.basename(RYN) + " — the spike tick, lifted and run\n");
console.log("  class SpikeTick, GeometrySolver, TargetMotion and PlacementLedger are the");
console.log("  client's own; only the world around them is staged.\n");
console.log("  " + pad("#", 4) + pad("scenario", 42) + pad("swing", 8) + pad("place", 8) +
  pad("why", 12) + "expected");
console.log("  " + "-".repeat(96));

/* Each row: [label, opts, expectation, note]. The expectation is a function so
 * a row can assert on more than a single flag. */
const ROWS = [
  ["enemy standing still, open ground",
   { enemies: [{ ...near(0, 100) }] },
   r => r.swung && r.placed === 1 && r.reason === "open",
   "swing + place"],

  ["enemy moving toward me",
   { enemies: [{ ...near(0, 120), vx: -12 }] },
   r => r.swung && r.placed === 1,
   "swing + place"],

  ["enemy moving away, still in reach",
   { enemies: [{ ...near(0, 120), vx: 12 }] },
   r => r.swung && r.placed === 1,
   "swing + place"],

  ["enemy moving sideways",
   { enemies: [{ ...near(0, 110), vy: 14 }] },
   r => r.swung && r.placed === 1,
   "swing + place"],

  ["enemy just changed direction",
   // Three samples: two one way, then a hard turn. The lead must be dropped
   // for the observation.
   { enemies: [{ ...near(0, 110), vx: 0, vy: 20 }], turn: true },
   r => r.swung,
   "aims at now"],

  ["a 32 degree turn: out of reach now, in reach if led",
   // The observation is past the 163 any spike can reach; one tick of the
   // pre-turn course would put them inside it. The turn guard has to win.
   { samples: [[230.4, 25.9], [200.4, 25.9], [175, 10]] },
   r => r.placed === 0,
   "no place"],

  ["a target that has just been trapped is not led",
   // The track still carries the speed they had a moment ago; they cannot use
   // it any more. Observed at 175 is out of reach; the stale lead would not be.
   { samples: [[230, 0], [200, 0], [175, 0]], trapped: true },
   r => r.placed === 0,
   "no place"],

  ["only two observations: no lead at all",
   // Same shape, straight line, but the track is one sample short of anything
   // worth believing - confidence 0.13 against a 0.35 floor.
   { samples: [[200, 0], [170, 0]] },
   r => r.placed === 0,
   "no place"],

  ["enemy trapped",
   { enemies: [{ ...near(0, 100), trapped: true }] },
   r => r.swung && r.placed === 1,
   "swing + place"],

  ["enemy touching a spike already",
   { enemies: [{ ...near(0, 100) }], spikes: [onRing(0)] },
   r => r.swung && r.placed === 0 && r.reason === "contact",
   "swing, no place"],

  ["a spike stands where they are heading",
   // Out of contact now (170 is past the 84 a ring spike reaches), but one
   // tick of their measured course puts them inside it.
   { enemies: [{ ...near(0, 170), vx: -25 }], spikes: [onRing(0)] },
   r => r.swung && r.placed === 0 && r.reason === "standing",
   "swing, no place"],

  ["auto place already sent one that reaches",
   { enemies: [{ ...near(0, 100) }], reserved: [{ angle: 0, owner: "autoPlacer" }] },
   r => r.swung && r.placed === 0 && r.reason === "sent",
   "swing, no place"],

  ["preplace has booked one that reaches",
   { enemies: [{ ...near(0, 100) }], booked: [{ angle: 0 }] },
   r => r.swung && r.placed === 0 && r.reason === "booked",
   "swing, no place"],

  ["replace holds the aim, another angle is free",
   { enemies: [{ ...near(0, 60) }], reserved: [{ angle: 0, owner: "replace", priority: 60 }] },
   r => r.swung && r.placed === 0,
   "covered, no place"],

  ["every reaching angle is taken by a placer",
   // Close enough that a second angle would fit, but all of them are reserved.
   { enemies: [{ ...near(0, 60) }],
     reserved: [{ angle: 0 }, { angle: 1.4 }, { angle: -1.4 }] },
   r => r.placed === 0,
   "no double-buy"],

  ["enemy out of weapon range",
   { enemies: [{ ...near(0, 400) }] },
   r => !r.swung && r.placed === 0,
   "nothing"],

  ["enemy beyond any spike's reach (163)",
   { enemies: [{ ...near(0, 175) }] },
   r => r.placed === 0,
   "no place"],

  ["I am in danger (shouldIgnoreModule)",
   { enemies: [{ ...near(0, 100) }], danger: true },
   r => !r.swung && r.placed === 0,
   "nothing"],

  ["another module already claimed the tick",
   { enemies: [{ ...near(0, 100) }], moduleActive: true },
   r => !r.swung && r.placed === 0,
   "nothing"],

  ["primary not reloaded",
   { enemies: [{ ...near(0, 100) }], reloaded: false },
   r => !r.swung && r.placed === 0,
   "nothing"],

  ["I am trapped",
   { enemies: [{ ...near(0, 100) }], meTrapped: true },
   r => !r.swung && r.placed === 0,
   "nothing"],

  ["the whole reach window is blocked ground",
   { enemies: [{ ...near(0, 140) }], blocked: [0, 0.3, -0.3] },
   r => r.placed === 0,
   "no place"],

  ["two enemies, the trapped one wins even from further away",
   // The free one is nearer and scores better on every angle term. Only the
   // trapped bonus can carry this row.
   { enemies: [{ ...near(0, 85) }, { ...near(2.2, 158), trapped: true }] },
   r => r.swung && r.target === 3,
   "picks trapped"],

  ["the ground is held by something that is not a spike",
   // A trap-sized reservation: _coveredBy will not read it as cover, so the
   // tick reaches OPEN, asks, and is refused. It must not swing on a spike
   // that never went out.
   { enemies: [{ ...near(0, 100) }],
     reserved: [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05].map(a => ({ angle: a, radius: 50, owner: "trapAnimal" })) },
   r => !r.swung && r.placed === 0,
   "no phantom swing"],

  ["point blank: the on-aim spike would push them at me",
   // At 45 the ring (79) is PAST them, so a spike on the aim sits behind them
   // and its push points back down my throat. With every other angle blocked,
   // the only candidate is that one, and it has to be refused.
   // Each blocked entry covers +-0.35 rad, so this leaves only the aim free.
   { enemies: [{ ...near(0, 45) }],
     blocked: [0.4, 1.0, 1.6, 2.2, 2.8, -0.4, -1.0, -1.6, -2.2, -2.8, Math.PI] },
   r => r.placed === 0,
   "refuses the push"],

  ["point blank with the flanks open: it goes round the side",
   { enemies: [{ ...near(0, 45) }] },
   // The aim itself is free and reaches, and is still not the one taken: the
   // first angle whose push clears 36 degrees is about 20 off the aim.
   r => r.swung && r.placed === 1 && Math.abs(r.world.placed[0]) > 0.3,
   "places off-aim"],
];

let bad = 0, n = 0;
for (const [label, opts, expect, note] of ROWS) {
  n++;
  let r;
  try {
    r = run(opts);
    // The direction-change row needs a third observation, so it is driven by
    // hand rather than by the generic two-sample warm-up.
    if (opts.turn) {
      const w = world(opts);
      const mod = new SpikeTick(w.client);
      const e = w.enemies[0];
      const t = w.ModuleHandler.tickCount;
      w.engine.motion.observe({ id: e.id, pos: { current: new Vec(e.pos.current.x, e.pos.current.y - 40) } }, t - 2);
      w.engine.motion.observe({ id: e.id, pos: { current: new Vec(e.pos.current.x, e.pos.current.y - 20) } }, t - 1);
      w.engine.motion.observe(e, t);
      sandbox.__painted = null;
      mod.postTick();
      r = { swung: !!w.ModuleHandler.shouldAttack, placed: w.placed.length,
            painted: sandbox.__painted, reason: null, target: mod.targetId, mod, world: w };
    }
  } catch (err) {
    console.log("  " + pad(n, 4) + pad(label, 42) + "THREW  " + String(err.message).slice(0, 60));
    bad++;
    continue;
  }
  const ok = expect(r);
  if (!ok) bad++;
  console.log("  " + pad(n, 4) + pad(label, 42) + pad(r.swung ? "yes" : "no", 8) +
    pad(r.placed, 8) + pad(r.reason || "-", 12) + note + (ok ? "" : "   <- FAIL"));
}

/* Two properties the table cannot show, because they are about consecutive
 * ticks rather than one. */
console.log("");
const props = [];

// The turret follow-up lands on the NEXT tick, not this one.
{
  const w = world({ enemies: [{ ...near(0, 100) }] });
  const mod = new SpikeTick(w.client);
  mod.postTick();
  const swungHat = w.ModuleHandler.forceHat;
  w.ModuleHandler.moduleActive = false;
  w.ModuleHandler.forceHat = null;
  w.ModuleHandler.tickCount += 1;
  mod.postTick();
  props.push(["the swing wears bull (7) and the follow-up wears turret gear (53)",
    swungHat === 7 && w.ModuleHandler.forceHat === 53]);
}

// SpikeSyncHammer delegating must not have its follow-up eaten in the same tick.
{
  const w = world({ enemies: [{ ...near(0, 100) }] });
  const mod = new SpikeTick(w.client);
  mod.strike(w.enemies[0], 0, [0], w.ModuleHandler.tickCount);   // the hammer's call
  w.ModuleHandler.moduleActive = false;
  w.ModuleHandler.forceHat = null;
  mod.postTick();                                                // same tick
  const sameTick = w.ModuleHandler.forceHat;
  w.ModuleHandler.tickCount += 1;
  mod.postTick();                                                // next tick
  props.push(["a delegated strike keeps its turret shot for the next tick",
    sameTick !== 53 && w.ModuleHandler.forceHat === 53]);
}

// Hysteresis. Driven in one tick with the held target set by hand, because a
// two-tick version measures something else: the first tick's placement makes
// the held target COVERED, which legitimately lowers what finishing it is
// worth.
{
  // The rival at 90 is marginally the better opportunity; the held one at 95
  // has to win anyway.
  const w = world({ enemies: [{ ...near(0, 95) }, { ...near(2.4, 90) }] });
  const mod = new SpikeTick(w.client);
  mod.targetId = 2;
  mod.postTick();
  props.push(["a target being worked on is not dropped for a marginal rival",
    mod.targetId === 2]);
}

// ...but a clearly better one does take over.
{
  const w = world({ enemies: [{ ...near(0, 95) }, { ...near(2.4, 100), trapped: true }] });
  const mod = new SpikeTick(w.client);
  mod.targetId = 2;
  mod.postTick();
  props.push(["a clearly better target does take over",
    mod.targetId === 3]);
}

// It never takes ground a hard reservation holds.
{
  const w = world({ enemies: [{ ...near(0, 100) }], reserved: [{ angle: 0, owner: "autoPlacer" }] });
  const before = w.engine.ledger.entries.length;
  const mod = new SpikeTick(w.client);
  mod.postTick();
  const still = w.engine.ledger.entries.some(e => e.owner === "autoPlacer");
  props.push(["auto place's reservation survives the tick untouched",
    still && w.engine.ledger.entries.length === before]);
}

for (const [label, ok] of props) {
  if (!ok) bad++;
  console.log("  " + (ok ? "ok  " : "FAIL") + "  " + label);
}

console.log("\n  " + (bad === 0
  ? n + " scenarios and " + props.length + " properties, all as expected"
  : bad + " row(s) or propert(ies) wrong"));
process.exit(bad === 0 ? 0 : 1);
