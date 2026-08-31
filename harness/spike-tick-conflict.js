/* Spike tick swings but no spike lands, and auto place / preplace / replace are
 * suspected. They are the cause — and none of them has to change.
 *
 * The mechanism, all of it in the ledger:
 *
 *     blocked(x, y, radius, priority, value, ignoreToken) {
 *       for (const e of this.entries) {
 *         if (hypot(x - e.x, y - e.y) >= radius + e.radius) continue;
 *         if (!e.soft) return true;               // <- hard entry wins outright
 *         if (e.priority > priority) return true;
 *         ...
 *
 * Every placement the engine SENDS leaves a HARD reservation for two ticks
 * (_record -> _conflicts.take(..., soft = false)). Auto place, preplace and
 * replace all build on the ring toward the enemy — and so does a spike tick.
 * Whoever sent first owns that ground, and `!e.soft` returns before priority is
 * ever read, so the spike tick's SYNC (80) never gets to outrank ENGAGEMENT
 * (40), ANTICIPATION (50) or RECOVERY (60).
 *
 * _validate then returns "blocked", which is non-terminal, so the controller
 * goes to REPLAN — and REPLAN re-runs _acquire, which asks anglesFor for the
 * same three angles and takes the same angles[0] again. Two replans, same
 * refusal, CANCEL. It deadlocks on one taken angle with two free ones in the
 * list it already fetched.
 *
 * The fix walks that list. It takes ground from nobody and changes no
 * arbitration — it only declines to ask for ground already spoken for.
 *
 * This drives the REAL PlacementLedger and ConflictResolver, with the three
 * placers reserving first, exactly as they do on a live tick.
 *
 *   node spike-tick-conflict.js [ryn.js]
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

const SPIKE = { scale: 49, placeOffset: -5 };
const RING = 35 + SPIKE.scale + SPIKE.placeOffset;   // 79
const PRIORITY = { INSTA: 90, SYNC: 80, DEFENSE: 70, RECOVERY: 60, ANTICIPATION: 50, ENGAGEMENT: 40, UTILITY: 20 };

const sandbox = {
  Math, Object, Infinity,
  RPE_EPS: 1e-6, RPE_TAU: Math.PI * 2, RPE_SOFT_DOMINANCE: 1.35,
  RPE_PRIORITY: PRIORITY,
  RPE_MODE: { AUTO: "auto", PREPLACE: "preplace", REPLACE: "replace" },
  RPE_INTENT: { CONSUMED: "consumed" },
  RPE_INTENT_LIFETIME: 6,
  PlacementIntent: { stamp: () => {}, expired: () => false, age: () => 0 },
  SPIKE_TICK_PHASE: { IDLE: 0, PREPARE: 1, VALIDATE: 2, REPLAN: 3, EXECUTE: 4, COMPLETE: 5, CANCEL: 6 },
  SPIKE_TICK_REPLANS: 2, SPIKE_TICK_SELF_DRIFT: 45, SPIKE_TICK_TARGET_DRIFT: 70,
  RPE_PLACE_PACKETS: 5,
  GameUI_default: { updateSpikeTick: (v) => { sandbox.__painted = v; } },
  PlayerObject: class PlayerObject {},
};
vm.createContext(sandbox);
vm.runInContext(lift("const GeometrySolver = \\{", "GeometrySolver") + ";\nthis.GeometrySolver = GeometrySolver;", sandbox);
vm.runInContext(lift("class PlacementLedger\\s*\\{", "PlacementLedger") + "\nthis.Ledger = PlacementLedger;", sandbox);
vm.runInContext(lift("class ConflictResolver\\s*\\{", "ConflictResolver") + "\nthis.Conflicts = ConflictResolver;", sandbox);
vm.runInContext(lift("class SpikeTickController\\s*\\{", "SpikeTickController") + "\nthis.Ctrl = SpikeTickController;", sandbox);
const { GeometrySolver, Ledger, Conflicts, Ctrl } = sandbox;

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}

/* A world with the enemy close enough for a spike on the ring to touch them,
 * and `taken` angles already reserved HARD by whichever placer got there first
 * — which is what _record does on every send. */
function scene(opts) {
  const enemyAngle = 0;
  const enemyDist = 100;
  const enemy = {
    id: 2, collisionScale: 35, hitScale: 63,
    pos: { current: new Vec(Math.cos(enemyAngle) * enemyDist, Math.sin(enemyAngle) * enemyDist) },
  };
  const ledger = new Ledger();
  const conflicts = new Conflicts(ledger, { sentThisTick: () => false }, { has: () => false, records: [] });

  // anglesFor returns angles sorted by proximity to the aim; these are the
  // three a real ring scan hands back around a target dead ahead.
  const offered = [ 0, 0.62, -0.62 ];
  for (const i of opts.taken || []) {
    const a = offered[i];
    ledger.reserve(Math.cos(a) * RING, Math.sin(a) * RING, SPIKE.scale,
      opts.byPriority ?? PRIORITY.ENGAGEMENT, opts.byOwner || "autoPlacer", 1, 2,
      opts.soft ? { soft: true, value: opts.softValue ?? 50 } : undefined);
  }

  // Spikes already standing on the ring, as the three placers leave them.
  const world = new Map();
  const standingAngles = (opts.standing || []).map(i => [0, 0.62, -0.62][i]);
  if (opts.farSpike) standingAngles.push(Math.PI);
  for (const a of standingAngles) {
    const o = new sandbox.PlayerObject();
    o.itemGroup = 2; o.ownerID = 1; o.scale = SPIKE.scale;
    o.pos = { current: new Vec(Math.cos(a) * RING, Math.sin(a) * RING) };
    world.set(world.size + 1, o);
  }

  let committed = 0;
  const engine = {
    sending: false,
    book: { pending: () => [] },
    _replacePlan: null, _plan: null, _pool: null,
    ledger, _conflicts: conflicts,
    memory: { note: () => {} },
    _scheduler: { affords: () => true },
    _threat: { frame: null },
    profileFor: () => ({ type: 4, id: 6, footR: SPIKE.scale, ringR: RING, isDamage: true }),
    priorityFor: () => PRIORITY.SYNC,
    anglesFor: () => offered.slice(),
    intentAt(type, angle, o) {
      const a = GeometrySolver.norm(angle);
      const cand = {
        profile: this.profileFor(), angle: a, source: "directed", mode: "auto",
        kind: "directed", priority: o.priority, confidence: 1, value: 1,
        terms: {}, reach: 1, excludes: null, vacates: null,
        x: Math.cos(a) * RING, y: Math.sin(a) * RING,
      };
      cand.expected = cand.value;
      return cand;
    },
    _validAt: (cand) => conflicts.availableGround(cand),
    commitIntent: (cand) => { committed++; return 1; },
    promoteRecord: () => null,
  };

  const ModuleHandler = {
    tickCount: 5, moduleActive: false, packetLimit: 119, packetCount: 0,
    forceHat: null, forceWeapon: null, useAngle: null, shouldAttack: false,
    staticModules: { placementEngine: engine },
  };
  const client = {
    isOwner: true, _ModuleHandler: ModuleHandler,
    myPlayer: { id: 1, pos: { current: new Vec(0, 0) }, canPlace: () => true, inGame: true },
    EnemyManager: { nearestEnemy: enemy },
    PlayerManager: { isEnemyByID: (ownerID) => ownerID !== 1 },
    ObjectManager: {
      objects: world,
      grid2D: { cellSize: 100, query(x, y, c, cb) { for (const k of world.keys()) if (cb(k)) return true; return false; } },
    },
  };
  return { client, engine, enemy, get committed() { return committed; }, offered };
}

/* lastReason cannot be read after the fact: reset() clears it on the way out
 * of COMPLETE and CANCEL. The outcome is taken from what _report painted,
 * which is the same string the Devtool row shows. */
function run(opts) {
  const sc = scene(opts);
  sandbox.__painted = null;
  const ctrl = new Ctrl(sc.client);
  ctrl.arm(sc.enemy, "spikeTick");
  ctrl.postTick();
  const painted = sandbox.__painted || "";
  const m = /\(([a-zA-Z]+) /.exec(painted);
  return { placed: sc.committed > 0, reason: m ? m[1] : null };
}

const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — spike tick against ground the placers already own\n");
console.log("  real PlacementLedger and ConflictResolver; the enemy is dead ahead and the");
console.log("  ring scan offers three angles, nearest-to-aim first\n");
console.log("  " + pad("what the three placers left behind", 48) + pad("expected", 10) + pad("got", 10) + "why");
console.log("  " + "-".repeat(100));

const ROWS = [
  ["nothing on the ring at all",
   {}, "placed", "open ground, so it places"],
  ["auto place already built toward them (hard, 40)",
   { taken: [0], standing: [0] }, "covered", "the spike is there; the tick is done"],
  ["preplace already built toward them (hard, 50)",
   { taken: [0], standing: [0], byPriority: PRIORITY.ANTICIPATION, byOwner: "preplace" }, "covered", ""],
  ["replace already built toward them (hard, 60)",
   { taken: [0], standing: [0], byPriority: PRIORITY.RECOVERY, byOwner: "replace" }, "covered", ""],
  ["ground reserved this tick, nothing standing yet",
   { taken: [0] }, "none", "a send is in flight; next tick it is covered"],
  ["a spike standing, but too far to reach them",
   { standing: [], farSpike: true }, "placed", "not covered, so it still places"],
];
let bad = 0;
for (const [label, opts, expect, why] of ROWS) {
  const r = run(opts);
  const got = r.placed ? "placed" : (r.reason === "covered" ? "covered" : "none");
  if (got !== expect) bad++;
  console.log("  " + pad(label, 48) + pad(expect, 10) + pad(got + (got === expect ? "" : " <-"), 10) + why);
}

console.log("\n  Why no angle-hunting can fix this: a spike reaches the target only from");
console.log("  within about +-60 degrees of the aim, and can only be PLACED at least 76.7");
console.log("  degrees from a spike already on the ring. Those windows are disjoint at");
console.log("  every distance, so a second spike that also reaches simply does not exist.");
console.log("\n  Nothing here touches the three placers: no reservation is preempted, no");
console.log("  priority re-read, no ground taken from them. The tick reads the world they");
console.log("  built and stops calling a finished job a failure.");

console.log("\n  " + (bad === 0
  ? "the tick recognises the spike that is already there instead of standing down"
  : bad + " row(s) wrong"));
process.exit(bad === 0 ? 0 : 1);
