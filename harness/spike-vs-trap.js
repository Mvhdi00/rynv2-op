/* Why a trap was taking the spike tick's window, and what the fix changes.
 *
 * THE MECHANISM, from the game's own rules.
 *
 * A build is refused when another build is within `s + blockS`, and for a
 * placed item blockS is its full scale — colDiv does not apply to blocking
 * (ObjectManager.checkItemLocation). A spike is 49 and a pit trap is 50, so
 * they need 99 between them. Both sit on your ring, at 79 and 80. Solve the
 * cosine rule and a trap forbids every spike within
 *
 *     acos((79² + 80² − 99²) / (2·79·80)) = 77.0 degrees
 *
 * of it. The reach window — the angles from which a spike actually touches the
 * target — is ±64° at d=79 and narrower at every greater distance. So ONE TRAP
 * DROPPED TOWARD THE ENEMY FORBIDS EVERY SPIKE THAT WOULD REACH THEM, at every
 * distance, until the trap is broken.
 *
 * THE ORDERING, from RYN.
 *
 * Auto place is the one placement path in the client that did not go through
 * the resolver. Its send was:
 *
 *     const emit = obj => {
 *       if (!myPlayer.canPlace(type)) return;
 *       ModuleHandler.place(type, obj.angle);      // raw — no ledger check
 *
 * and ModuleHandler.place() calls _notePlacement(), which records the footprint
 * in the ledger AFTER the decision to send. Everything else — spikeTick,
 * spikeSync, preplace, replace, the manual placer — goes through
 * requestPlace() → engine.request() → _validAt() → availableGround(). Auto
 * place took ground nobody had offered it, and its trap branch is
 * unconditional:
 *
 *     if (isTrap) {
 *       if (closestTrapToEnemy && config === closestTrapToEnemy && neitherTrapped) return true;
 *       if (neitherTrapped) return true;           // ANY trap, any angle
 *     }
 *
 * while every spike branch is conditional. So against a free, closing enemy
 * auto place places traps and no spikes — and carpets exactly the arc the
 * spike tick was about to need.
 *
 * This drives the REAL PlacementLedger, ConflictResolver and SpikeTick, with
 * auto place's emit modelled both ways: raw, and asking groundIsFree first.
 *
 * ONE LINE HERE IS NOT COVERED BY A FAILING CASE, and it is worth naming.
 * `this._release("retake")` drops the claim before asking for it again, so a
 * hold is re-taken against the live ledger rather than extended. Every
 * scenario below holds for one or two ticks — the window between "predicted
 * into reach within three ticks" and "in reach now, so fire instead" is only
 * that wide at any realistic closing speed — and inside two ticks the claim's
 * own expiry covers it. Removing the line changes no outcome here. It stays
 * because without it holdGround is refused by the module's own stale claim and
 * the hold silently stops refreshing, which is a real failure at any larger
 * SPIKE_TICK_HOLD_LEAD. Reachable, protective, and untested: said out loud
 * rather than dressed up.
 *
 *   node spike-vs-trap.js [ryn.js]
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
function liftMethod(name) {
  const m = new RegExp("\\n    " + name + "\\(").exec(src);
  if (!m) throw new Error("could not find " + name);
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index + 1, i + 1); }
  }
  throw new Error("unbalanced " + name);
}
function constant(name) {
  const m = new RegExp("const " + name + " = ([^;]+);").exec(src);
  if (!m) throw new Error(name + " is gone from the client");
  return m[1];
}

// Straight from items.list.
const SPIKE = { id: 6, scale: 49, placeOffset: -5, dmg: 20, damage: 20, itemGroup: 2 };
const TRAP  = { id: 15, scale: 50, placeOffset: -5, itemGroup: 5, trap: true };
const P = 35;
const RING_S = P + SPIKE.scale + SPIKE.placeOffset;   // 79
const RING_T = P + TRAP.scale + TRAP.placeOffset;     // 80
const CONTACT = P + SPIKE.scale;                      // 84

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
  addDirection(a, d) { return new Vec(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d); }
}
const angleDist = (a, b) => { const p = Math.abs(b - a) % (Math.PI * 2); return p > Math.PI ? Math.PI * 2 - p : p; };

const sandbox = {
  Math, Object, Infinity, Set, Map, WeakMap, Array, isFinite, console,
  Vector_default: Vec, getAngleDist: angleDist,
  Items: { 6: SPIKE, 15: TRAP },
  Settings_default: { _spikeTick: true, _spikeTickTrapped: true, _spikeTickFree: true, _spikeTickDebug: false },
  DataHandler_default: { getWeapon: () => ({ range: 142, knockback: 0.7, damage: 45 }), getItem: () => SPIKE },
  GameUI_default: { updateSpikeTick: (v) => { sandbox.__painted = v; } },
  PlayerObject: class PlayerObject {},
  RPE_EPS: 1e-6, RPE_TAU: Math.PI * 2, RPE_MOTION_SAMPLES: 5,
  RPE_DECEL: 0.993, RPE_TICK_MS: 1000 / 9, RPE_SOFT_DOMINANCE: 1.5,
  RPE_PRIORITY: JSON.parse(constant("RPE_PRIORITY").replace(/(\w+):/g, '"$1":')),
};
sandbox.RPE_TICK_DECAY = Math.pow(sandbox.RPE_DECEL, sandbox.RPE_TICK_MS);
vm.createContext(sandbox);
vm.runInContext(lift("const GeometrySolver = \\{", "GeometrySolver") + ";\nthis.GeometrySolver = GeometrySolver;", sandbox);
vm.runInContext(lift("class TargetMotion\\s*\\{", "TargetMotion") + "\nthis.TargetMotion = TargetMotion;", sandbox);
vm.runInContext(lift("class PlacementLedger\\s*\\{", "PlacementLedger") + "\nthis.Ledger = PlacementLedger;", sandbox);
vm.runInContext(lift("class ConflictResolver\\s*\\{", "ConflictResolver") + "\nthis.Conflicts = ConflictResolver;", sandbox);
for (const name of ["SPIKE_TICK_TYPE", "SPIKE_TICK_KB_SAFE", "SPIKE_TICK_STICK", "SPIKE_TICK_TURN_LIMIT",
                    "SPIKE_TICK_LEAD", "SPIKE_TICK_MIN_CONFIDENCE", "SPIKE_TICK_ANGLE_LIMIT",
                    "SPIKE_TICK_TRAPPED_BONUS", "SPIKE_TICK_HOLD_LEAD", "SPIKE_TICK_HOLD_CONFIDENCE",
                    "SPIKE_TICK_HOLD_TTL", "SPIKE_TICK_HOLD_ANGLES", "SPIKE_TICK_BULL_MULT"]) {
  vm.runInContext("const " + name + " = " + constant(name) + ";", sandbox);
}
vm.runInContext("const SPIKE_TICK_REASON = " + /const SPIKE_TICK_REASON = (\{[\s\S]*?\n  \});/.exec(src)[1] + ";", sandbox);
vm.runInContext(lift("class SpikeTick\\s*\\{", "SpikeTick") + "\nthis.SpikeTick = SpikeTick;", sandbox);
// The engine's two new arbitration methods, lifted rather than restated.
vm.runInContext("this.makeEngineMethods = (holder) => Object.assign(holder, {" +
  liftMethod("groundIsFree") + "," + liftMethod("holdGround") + " });", sandbox);
const { SpikeTick, TargetMotion, Ledger, Conflicts, makeEngineMethods } = sandbox;

/* Auto place is 490 lines of Luna ladder and is modelled below rather than
 * lifted. That makes this assertion the load-bearing one: the emit it models
 * must be the emit the client has. */
if (!/const emit = obj => \{[\s\S]{0,1400}?if \(placementEngine && !placementEngine\.groundIsFree\(type, obj\.angle, "autoPlacer"\)\) return;/.test(src)) {
  throw new Error("AutoPlacer's emit no longer asks groundIsFree — this bench is modelling code that is gone");
}
if (!/const placementEngine = ModuleHandler\.staticModules && ModuleHandler\.staticModules\.placementEngine;/.test(src)) {
  throw new Error("AutoPlacer no longer resolves the engine, so its emit cannot be asking anything");
}

/* One run of the reported sequence. `checked` is the only thing that varies:
 * whether auto place's emit asks groundIsFree before sending, which is the
 * one-line change in AutoPlacer. */
function simulate(opts) {
  const me = new Vec(0, 0);
  const enemy = {
    id: 2, scale: 35, collisionScale: 35, currentHealth: opts.health === undefined ? 100 : opts.health,
    get hitScale() { return 35 * 1.8; },
    isTrapped: !!opts.trapped,
    pos: { current: new Vec(opts.from, 0) },
  };
  const objects = new Map();
  const ledger = new Ledger();
  let nextId = 1;
  const book = { records: [], pending: () => book.records.filter(r => r.state === "pending"), drop(r) { r.state = "dropped"; } };
  const conflicts = new Conflicts(ledger, { sentThisTick: () => false }, book);
  const motion = new TargetMotion();

  const standing = () => [...objects.values()];
  // The server's own placement rule, applied to the ring: an angle is legal
  // when nothing standing is within (mine.scale + theirs.scale).
  const legal = (scale, ring, angle) => {
    const x = Math.cos(angle) * ring, y = Math.sin(angle) * ring;
    return !standing().some(o => Math.hypot(x - o.pos.current.x, y - o.pos.current.y) < scale + o.scale);
  };

  const ModuleHandler = {
    tickCount: 0, moduleActive: false, activeModule: null,
    forceHat: null, forceWeapon: null, useAngle: null, shouldAttack: false,
    placedOnce: false, placeAngles: [null, []],
    packetCount: 0, packetLimit: 119,
    staticModules: { reloading: { isReloaded: () => true } },
    // spikeTick's send path, as the client has it: through the engine.
    requestPlaceMany(type, angles, owner) {
      for (const a of angles) {
        const ring = type === 4 ? RING_S : RING_T, scale = type === 4 ? SPIKE.scale : TRAP.scale;
        const x = Math.cos(a) * ring, y = Math.sin(a) * ring;
        if (!legal(scale, ring, a)) continue;
        if (ledger.blocked(x, y, scale, sandbox.RPE_PRIORITY.SYNC, 1e6)) continue;
        ledger.reserve(x, y, scale, sandbox.RPE_PRIORITY.SYNC, owner, this.tickCount, 2);
        place(type, a, owner);
        return 1;
      }
      return 0;
    },
  };
  const engine = {
    ledger, motion, book, _conflicts: conflicts, _exits: null,
    client: { myPlayer: null, _ModuleHandler: ModuleHandler },
    profileFor: (t) => t === 4
      ? { type: 4, id: 6, footR: SPIKE.scale, ringR: RING_S, item: SPIKE, isDamage: true }
      : { type: 7, id: 15, footR: TRAP.scale, ringR: RING_T, item: TRAP, isTrap: true },
    priorityFor: (owner) => owner === "spikeTick" ? sandbox.RPE_PRIORITY.SYNC
      : owner === "autoPlacer" ? sandbox.RPE_PRIORITY.ANTICIPATION : sandbox.RPE_PRIORITY.UTILITY,
    anglesFor(type, targetAngle, o) {
      const ring = type === 4 ? RING_S : RING_T, scale = type === 4 ? SPIKE.scale : TRAP.scale;
      const out = [];
      for (let a = -Math.PI; a < Math.PI; a += Math.PI / 36) if (legal(scale, ring, a)) out.push(a);
      out.sort((x, y) => angleDist(x, targetAngle) - angleDist(y, targetAngle));
      return o && o.limit ? out.slice(0, o.limit) : out;
    },
  };
  makeEngineMethods(engine);
  ModuleHandler.staticModules.placementEngine = engine;

  const log = [];
  function place(type, angle, owner) {
    const ring = type === 4 ? RING_S : RING_T;
    const o = new sandbox.PlayerObject();
    o.id = nextId++;
    o.itemGroup = type === 4 ? 2 : 5;
    o.ownerID = 1;
    o.scale = type === 4 ? SPIKE.scale : TRAP.scale;
    o.collisionScale = o.scale;
    o.getDamage = () => (type === 4 ? SPIKE.dmg : 0);
    o.pos = { current: new Vec(Math.cos(angle) * ring, Math.sin(angle) * ring) };
    objects.set(o.id, o);
    log.push({ tick: ModuleHandler.tickCount, what: type === 4 ? "spike" : "trap", owner, angle });
  }

  const myPlayer = {
    id: 1, inGame: true, isTrapped: false, pos: { current: me },
    getItemByType: (t) => (t === 0 ? 5 : t === 4 ? 6 : t === 7 ? 15 : null),
    getItemPlaceScale: (id) => (id === 6 ? RING_S : RING_T),
    canPlace: () => true,
    collidingSimple(e, range) { return me.distance(e.pos.current) <= range; },
  };
  engine.client.myPlayer = myPlayer;

  const client = {
    isOwner: true, _ModuleHandler: ModuleHandler, myPlayer,
    EnemyManager: {
      nearestEnemy: enemy, secondNearestEnemy: null,
      nearestTrappedEnemy: enemy.isTrapped ? enemy : null,
      enemySpikeCollider: null, shouldIgnoreModule: () => false,
    },
    ObjectManager: {
      objects, isDestroyedObject: () => false,
      grid2D: { cellSize: 100, query(x, y, c, cb) { for (const k of objects.keys()) if (cb(k)) return true; return false; } },
    },
    PlayerManager: { isEnemyByID: (ownerID, of) => ownerID !== of.id },
    StatsManager: { set spikeSyncTimes(_v) {} },
  };

  /* Auto place, reduced to the part that matters: it wants a trap on the angle
   * nearest the enemy, every tick, whenever neither of us is pinned — which is
   * `if (neitherTrapped) return true` in the real ladder. `checked` is the
   * one-line difference the fix makes to its emit. */
  function autoPlace() {
    if (enemy.isTrapped) return;
    if (ModuleHandler.activeModule && ModuleHandler.activeModule !== "autoPlacer") return;  // lunaSpikeTickBusy
    const aim = me.angle(enemy.pos.current);
    const angles = engine.anglesFor(7, aim);
    for (const a of angles) {
      if (opts.checked && !engine.groundIsFree(7, a, "autoPlacer")) continue;
      const x = Math.cos(a) * RING_T, y = Math.sin(a) * RING_T;
      place(7, a, "autoPlacer");
      // ModuleHandler.place -> _notePlacement -> claimPlacement, after the fact.
      ledger.reserve(x, y, TRAP.scale, sandbox.RPE_PRIORITY.ANTICIPATION, "autoPlacer", ModuleHandler.tickCount, 2);
      ModuleHandler.moduleActive = true;
      if (!ModuleHandler.activeModule) ModuleHandler.activeModule = "autoPlacer";
      return;
    }
  }

  // Ground that is already built when the fight starts.
  for (const deg of opts.prefill || []) place(4, deg * Math.PI / 180, "world");

  const mod = new SpikeTick(client);
  if (opts.speed !== 0) {
    for (let k = 4; k >= 1; k--) {
      motion.observe({ id: enemy.id, pos: { current: new Vec(opts.from + (opts.speed || 25) * k, 0) } }, -k);
    }
  }
  if (opts.hold) {
    const t = 0;
    ModuleHandler.tickCount = t;
    const last = opts.hold[opts.hold.length - 1];
    enemy.pos.current.x = last[0];
    enemy.pos.current.y = last[1];
    opts.hold.forEach((p, i) => {
      motion.observe({ id: enemy.id, pos: { current: new Vec(p[0], p[1]) } }, t - (opts.hold.length - 1 - i));
    });
    mod.postTick();
    return { log, struck: null, held: 0, heldNow: mod._holds.length, expiredAfter: null,
             maxHeld: 0, objects: 0, traps: 0, spikes: 0 };
  }
  const ticks = opts.ticks === undefined ? 8 : opts.ticks;
  let struck = null, held = 0, maxHeld = 0;
  for (let t = 0; t < ticks; t++) {
    ModuleHandler.tickCount = t;
    ModuleHandler.moduleActive = false;
    ModuleHandler.activeModule = null;
    ModuleHandler.shouldAttack = false;
    ledger.expire(t);
    // The enemy closes, and the motion track sees it — the engine's own track,
    // observed once a tick exactly as the engine does.
    if (t > 0 && !enemy.isTrapped) {
      // A target that turns away mid-approach: the course the track describes
      // is one it has left, and the hold has to go with it.
      const dir = (opts.turnAt !== undefined && t >= opts.turnAt) ? -1 : 1;
      enemy.pos.current.x = Math.max(opts.stopAt || 60, enemy.pos.current.x - dir * (opts.speed || 25));
      if (dir < 0) enemy.pos.current.y += 25;
      else if (opts.drift) enemy.pos.current.y += opts.drift;
    }
    motion.observe(enemy, t);

    mod.postTick();                                  // spikeTick runs first
    if (ModuleHandler.moduleActive && !ModuleHandler.activeModule) ModuleHandler.activeModule = "spikeTick";
    if (ModuleHandler.shouldAttack && struck === null) struck = t;
    if (mod._holds.length) held++;
    // What the module believes it is holding. Re-taken each tick, so it can
    // never grow past what one tick asked for; extended instead of re-taken,
    // it would climb every tick.
    maxHeld = Math.max(maxHeld, mod._holds.length);
    autoPlace();                                     // ...then auto place
  }
  // With the tick shut out by another module, how long until its claim clears
  // on its own? Only the ledger's expiry can end it.
  let expiredAfter = null;
  if (mod._holds.length) {
    for (let k = 1; k <= 10; k++) {
      ModuleHandler.tickCount = ticks + k;
      ModuleHandler.moduleActive = true;              // somebody else owns it
      ledger.expire(ModuleHandler.tickCount);
      mod.postTick();
      if (!ledger.entries.some(e => e.owner === "spikeTick")) { expiredAfter = k; break; }
    }
  }
  return { log, struck, held, maxHeld, expiredAfter, objects: standing().length,
           traps: standing().filter(o => o.itemGroup === 5).length,
           spikes: standing().filter(o => o.itemGroup === 2).length };
}

/* Five straight steps toward the origin, then one rotated by `deg`, ending
 * just outside any spike's 163 reach — so there is nothing to fire at and the
 * only question left is whether ground gets held for what is coming. */
function turnedRun(deg) {
  const step = 25, end = 195, out = [];
  let x = end + step * 5;
  for (let i = 0; i < 5; i++) { out.push([x, 0]); x -= step; }
  const a = Math.PI + deg * Math.PI / 180;      // the run heads in -x
  out.push([out[4][0] + step * Math.cos(a), out[4][1] + step * Math.sin(a)]);
  return out;
}

/* Seed the motion track from named samples and run exactly one tick, to ask
 * whether ground was held. The two gates on a hold — a heading that has moved
 * more than SPIKE_TICK_TURN_LIMIT, and a prediction below
 * SPIKE_TICK_HOLD_CONFIDENCE — are separated here, because each is reachable
 * only in a window the other does not cover. */
function holdsWith(samples) {
  const last = samples[samples.length - 1];
  const w = simulate({ from: Math.hypot(last[0], last[1]), checked: true, ticks: 0, speed: 0, hold: samples });
  return w.heldNow;
}

const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — the spike tick against auto place's traps\n");
console.log("  real PlacementLedger, ConflictResolver, TargetMotion and SpikeTick; auto");
console.log("  place reduced to the branch that matters (`if (neitherTrapped) return true`)\n");

/* The reported sequence: a free enemy closing from out of reach, auto place
 * trapping toward them every tick. */
console.log("  a free enemy closing from 210, auto place trapping toward them each tick\n");
console.log("  " + pad("auto place emit", 26) + pad("traps", 8) + pad("spikes", 8) +
  pad("spike tick swung", 18) + "held ground on");
console.log("  " + "-".repeat(80));
const before = simulate({ from: 210, checked: false });
const after = simulate({ from: 210, checked: true });
for (const [label, r] of [["raw place() — before", before], ["groundIsFree() — after", after]]) {
  console.log("  " + pad(label, 26) + pad(r.traps, 8) + pad(r.spikes, 8) +
    pad(r.struck === null ? "never" : "tick " + r.struck, 18) + r.held + " ticks");
}
console.log("\n  what went on the wire, tick by tick:");
console.log("  " + pad("", 12) + pad("before", 34) + "after");
for (let t = 0; t < 8; t++) {
  const b = before.log.filter(l => l.tick === t).map(l => l.what + "@" + (l.angle * 180 / Math.PI).toFixed(0)).join(" ");
  const a = after.log.filter(l => l.tick === t).map(l => l.what + "@" + (l.angle * 180 / Math.PI).toFixed(0)).join(" ");
  console.log("  " + pad("tick " + t, 12) + pad(b || "-", 34) + (a || "-"));
}

/* The fifteen cases from the brief. */
console.log("\n  " + pad("#", 4) + pad("case", 46) + pad("swung", 10) + pad("traps", 8) + "expected");
console.log("  " + "-".repeat(88));
const CASES = [
  ["spike opportunity only (no trap held)",
   { from: 100, checked: true, noTrapWanted: true }, r => r.struck === 0, "spike immediately"],
  ["trap opportunity only — enemy far, never closes",
   { from: 340, checked: true, speed: 0 }, r => r.struck === null && r.traps > 0, "traps, no spike"],
  ["trap and spike both live — closing enemy",
   { from: 210, checked: true }, r => r.struck !== null, "spike wins its window"],
  ["immediate spike beside auto place",
   { from: 100, checked: true }, r => r.struck === 0, "spike first"],
  ["spike opportunity appears after the trap candidate",
   { from: 210, checked: true }, r => r.struck !== null && r.held > 0, "held, then fired"],
  ["enemy stops closing before the tick lands",
   { from: 210, checked: true, stopAt: 200 }, r => r.struck === null, "no stale spike"],
  ["enemy already trapped",
   { from: 100, checked: true, trapped: true }, r => r.struck === 0, "spike, no trap needed"],
  ["low health — the tick would kill",
   { from: 210, checked: true, health: 40 }, r => r.held > 0, "holds on lethality"],
  ["full health, free, trap available",
   { from: 210, checked: true, health: 100 }, r => r.struck !== null, "both fit, both happen"],
  ["ring already full — holding would deny the trap",
   // Standing spikes at 100, 180 and -100 leave only the aim arc legal. Holding
   // it would leave the trap nowhere, so the trap wins and the tick stands down.
   { from: 210, checked: true, prefill: [100, 180, -100] },
   r => r.held === 0, "trap wins"],
  ["enemy turns away before the tick lands",
   { from: 210, checked: true, turnAt: 1 },
   r => r.struck === null && r.held <= 1, "hold released, no spike"],
];
let bad = 0, n = 0;
for (const [label, opts, expect, note] of CASES) {
  n++;
  const r = simulate(opts);
  const ok = expect(r);
  if (!ok) bad++;
  console.log("  " + pad(n, 4) + pad(label, 46) +
    pad(r.struck === null ? "never" : "tick " + r.struck, 10) + pad(r.traps, 8) + note + (ok ? "" : "   <- FAIL"));
}

/* The properties that make this a fix rather than a preference. */
const props = [
  ["the tick now gets its window at all",
   before.struck === null && after.struck !== null],
  ["auto place is not disabled — it still places",
   after.traps > 0 || after.spikes > 0],
  ["ground is only held while the opportunity lives",
   after.held > 0 && after.held < 8],
  ["a hold is released the moment the tick fires",
   simulate({ from: 210, checked: true }).struck !== null &&
   (() => { const r = simulate({ from: 210, checked: true }); return r.held < 8; })()],
  ["nothing is held for a target that is not closing",
   simulate({ from: 340, checked: true, speed: 0 }).held === 0],
  ["a trapped target needs no hold at all — it fires at once",
   simulate({ from: 100, checked: true, trapped: true }).held === 0],
  ["a crowded ring gives the trap the ground back",
   simulate({ from: 210, checked: true, prefill: [100, 180, -100] }).held === 0],
  ["a target that turns away loses the hold",
   simulate({ from: 210, checked: true, turnAt: 1 }).held <= 1],
  // The one path that does not release is `moduleActive` — another module owns
  // the tick, and the opportunity may still be live. The soft claim's own
  // expiry is what stops a hold outliving the module that took it.
  // Re-taken, not extended: the claim is dropped and asked for again every
  // tick, so ground the tick has stopped wanting goes straight back rather
  // than sitting there until it expires.
  ["never more ground held than the tick could use",
   (() => {
     const r = simulate({ from: 210, checked: true, ticks: 8, drift: 12 });
     return r.maxHeld > 0 && r.maxHeld <= Number(constant("SPIKE_TICK_HOLD_ANGLES"));
   })()],
  ["a hold expires on its own while another module owns the tick",
   (() => {
     const r = simulate({ from: 210, checked: true, ticks: 1 });
     return r.expiredAfter !== null && r.expiredAfter <= Number(constant("SPIKE_TICK_HOLD_TTL")) + 1;
   })()],
  // A hold is only ever found at a lead of two or more, because at a lead of
  // one _evaluate has already led by the same tick and fired. At that depth a
  // 20 degree turn is worth 0.453 and a 31 degree turn 0.397 against the 0.45
  // bar, so the bar refuses turns the 30 degree limit would still allow — the
  // limit cannot be the deciding test here, and is not applied.
  ["a turn is refused by the confidence bar, at the depth a hold happens",
   holdsWith(turnedRun(31)) === 0 && holdsWith(turnedRun(0)) > 0],
  // Two samples only: the prediction is worth 0.13 against the same bar, so
  // the confidence gate is the only thing that can refuse it.
  ["two samples are not enough to reserve ground",
   holdsWith([[220, 0], [195, 0]]) === 0],
];
console.log("");
for (const [label, ok] of props) {
  if (!ok) bad++;
  console.log("  " + (ok ? "ok  " : "FAIL") + "  " + label);
}

console.log("\n  " + (bad === 0
  ? "the trap no longer takes ground the tick is about to need, and auto place keeps working"
  : bad + " row(s) or propert(ies) wrong"));
process.exit(bad === 0 ? 0 : 1);
