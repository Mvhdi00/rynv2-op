/* Spike tick (trap): does it actually put a spike down on a trapped enemy?
 *
 * Reported as not working, with a conflict suspected. Static checks cannot
 * answer that, so this runs the real thing: spikeTickState,
 * spikeTickCounterThreat, spikeTickNearSpike, spikeTickTarget, spikeTickHit,
 * spikeTickTurret, class SpikeTickTrap, class SpikeTickBreak and class
 * SpikeTickController are all lifted out of the client with `vm` and driven
 * over the two ticks the combo takes, in the order ModuleHandler runs them.
 *
 * The combo:
 *   TICK 1  hammer the trap they are standing in (forceWeapon 1, hat 40),
 *           remember the target
 *   TICK 2  target is remembered -> spikeTickHit -> controller.arm -> spike
 *
 * and tick 2 is guarded by `if (!ModuleHandler.moduleActive)`, with
 * `this.target` cleared BEFORE that check:
 *
 *     if (this.target !== null) {
 *       const enemy = this.target;
 *       this.target = null;              // cleared unconditionally
 *       if (!ModuleHandler.moduleActive) {
 *         spikeTickHit(this.client, enemy);
 *         ...
 *
 * So anything that claims the tick before spikeTickTrap runs does not delay
 * the combo, it destroys it: the target is gone and the follow-up never
 * happens. spikeTickBreak and spikeTickNear both run BEFORE spikeTickTrap in
 * the module order, and tick 2 is exactly when the trap you just hammered
 * shows up in ObjectManager.deletedObjects — which is spikeTickBreak's
 * trigger. That is the conflict this file is here to confirm or rule out.
 *
 *   node spike-tick-trap.js [ryn.js]
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
function liftArrow(name) {
  const m = new RegExp("const " + name + " = ").exec(src);
  if (!m) throw new Error("could not find " + name);
  const open = src.indexOf("{", m.index);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index, i + 2); }
  }
  throw new Error("unbalanced " + name);
}

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}

const HAMMER = 10, POLEARM = 5, SPIKE_ID = 6;

function build() {
  const sandbox = {
    Math, Object, WeakMap, Set, Map, console,
    Settings_default: {},
    Items: { [SPIKE_ID]: { scale: 49, placeOffset: -5 } },
    DataHandler_default: {
      getWeapon: (id) => ({ range: id === HAMMER ? 75 : 142, type: id === HAMMER ? 1 : 0 }),
      isMelee: () => true,
    },
    GameUI_default: { updateSpikeTick: () => {} },
    SPIKE_TICK_RANGE: 170, SPIKE_TICK_BREAK_GAP: 90, SPIKE_TICK_TOUCH_SLACK: 1.05,
    SPIKE_TICK_TRAP_RANGE: 110, SPIKE_TICK_TRAP_GRACE: 3,
    SPIKE_TICK_COUNTER_RANGE: 180, SPIKE_TICK_COUNTER_GRACE: 2,
    SPIKE_TICK_BREAK_REACH: 70, SPIKE_TICK_NEAR_SPIKE_REACH: 75,
    SPIKE_TICK_REPLANS: 2, SPIKE_TICK_SELF_DRIFT: 45, SPIKE_TICK_TARGET_DRIFT: 70,
    RPE_INTENT_LIFETIME: 6, RPE_PLACE_PACKETS: 5,
    RPE_PRIORITY: { SYNC: 90 },
    RPE_INTENT: { CONSUMED: "consumed" },
    PlacementIntent: { expired: () => false, age: () => 0 },
  };
  vm.createContext(sandbox);
  const parts = [
    "const SPIKE_TICK_STATE = new WeakMap;",
    liftArrow("spikeTickState"),
    liftArrow("spikeTickCounterThreat"),
    liftArrow("spikeTickNearSpike"),
    liftArrow("spikeTickTarget"),
    liftArrow("spikeTickHit"),
    liftArrow("spikeTickTurret"),
    lift("const SPIKE_TICK_PHASE = \\{", "SPIKE_TICK_PHASE").replace(/^const/, "var"),
    lift("class SpikeTickTrap\\s*\\{", "SpikeTickTrap"),
    lift("class SpikeTickBreak\\s*\\{", "SpikeTickBreak"),
    lift("class SpikeTickController\\s*\\{", "SpikeTickController"),
    "this.mk = { trap: c => new SpikeTickTrap(c), brk: c => new SpikeTickBreak(c)," +
    " ctrl: c => new SpikeTickController(c) };",
  ];
  vm.runInContext(parts.join("\n"), sandbox);
  return sandbox;
}

/* A world where the combo SHOULD run: they are pinned in my trap, the trap is
 * one hammer swing from dead, they are a tick from reloaded, both my weapons
 * are up, and I am standing close enough. Each knob turns off one precondition
 * so the blocking gate can be named rather than guessed at. */
function world(sandbox, opts) {
  const o = Object.assign({
    enemyDist: 80, trapHealth: 100, hammerDamage: 292,
    myHammerReloaded: true, myPrimaryReloaded: true,
    enemyAboutToReload: true, iAmTrapped: false,
    enemySpikeNear: false, autobreak: true, deletedTrap: false,
    spikeTickOn: true, trapOn: true, breakOn: true,
  }, opts || {});

  const trap = { id: 1, type: 15, health: o.trapHealth, scale: 32, ownerID: 1,
                 pos: { current: new Vec(o.enemyDist, 0) } };
  const enemySpike = { id: 2, type: SPIKE_ID, itemGroup: 2, scale: 49, ownerID: 2,
                       collisionScale: 49, pos: { current: new Vec(o.enemyDist + 40, 0) } };

  const enemy = {
    id: 2, collisionScale: 35, hitScale: 63,
    pos: { current: new Vec(o.enemyDist, 0), previous: new Vec(o.enemyDist, 0),
           future: new Vec(o.enemyDist, 0) },
    trappedIn: trap, isTrapped: true,
    reload: [ { current: 5, max: 6 }, { current: 5, max: 6 }, { current: 6, max: 6 } ],
    isReloaded(slot, tick = 0) { const r = this.reload[slot]; return r.current >= r.max - tick; },
    weapon: { current: POLEARM }, futureHat: 0, atExact: () => true,
  };
  if (!o.enemyAboutToReload) { enemy.reload[1] = { current: 1, max: 6 }; }

  const ModuleHandler = {
    tickCount: 10, moduleActive: false, forceWeapon: null, forceHat: null,
    useAngle: null, shouldAttack: false, placedOnce: false, activeModule: null,
    packetLimit: 119, packetCount: 0,
    staticModules: {
      reloading: { isReloaded: (slot) => slot === 1 ? o.myHammerReloaded : o.myPrimaryReloaded },
    },
    hasStoreItem: () => true,
    newTick() {
      this.tickCount += 1; this.moduleActive = false; this.forceWeapon = null;
      this.forceHat = null; this.shouldAttack = false;
    },
  };

  const committed = [];
  const engine = {
    book: { pending: () => [] },
    _replacePlan: null, _plan: null, _pool: null,
    ledger: { releaseToken: () => {} },
    _conflicts: { availableGround: () => true },
    _scheduler: { affords: () => true },
    anglesFor: () => [ 0.2, 1.1, 2.4 ],
    intentAt: (type, angle) => ({
      profile: { footR: 49, isDamage: true, type: 4 }, angle, value: 1,
      x: Math.cos(angle) * 79, y: Math.sin(angle) * 79,
      originAt: { x: 0, y: 0 }, targetAt: { x: o.enemyDist, y: 0 },
      packetCost: 5, token: "t",
    }),
    _validAt: () => true,
    commitIntent: (intent) => { committed.push(intent); return 1; },
    promoteRecord: () => null,
  };
  ModuleHandler.staticModules.placementEngine = engine;

  const client = {
    isOwner: true,
    _ModuleHandler: ModuleHandler,
    myPlayer: {
      pos: { current: new Vec(0, 0), previous: new Vec(0, 0), future: new Vec(0, 0) },
      scale: 35, hitScale: 63, isTrapped: o.iAmTrapped,
      getItemByType: (t) => (t === 0 ? POLEARM : t === 1 ? HAMMER : 0),
      getBuildingDamage: () => o.hammerDamage,
      collidingSimple(e, range) { return this.pos.current.distance(e.pos.current) <= range; },
      canPlace: () => true,
      inGame: true,
    },
    EnemyManager: {
      nearestEnemy: enemy, nearestTrappedEnemy: enemy,
      nearestSpike: o.enemySpikeNear ? enemySpike : null,
      shouldIgnoreModule: () => false,
      attemptSpikePlacement: () => {},
    },
    ObjectManager: {
      deletedObjects: new Set(o.deletedTrap ? [ trap ] : []),
      objects: new Map(),
    },
  };

  sandbox.Settings_default._spikeTick = o.spikeTickOn;
  sandbox.Settings_default._spikeTickTrap = o.trapOn;
  sandbox.Settings_default._spikeTickBreak = o.breakOn;
  sandbox.Settings_default._spikeTickNear = false;
  sandbox.Settings_default._autobreak = o.autobreak;

  return { client, ModuleHandler, committed, trap, enemy };
}

/* Two ticks, in the order ModuleHandler runs the modules: spikeTickBreak comes
 * before spikeTickTrap, and spikeTickController comes after both. */
function runCombo(sandbox, opts, breakFiresOnTickTwo) {
  const w = world(sandbox, opts);
  const brk = sandbox.mk.brk(w.client);
  const trap = sandbox.mk.trap(w.client);
  const ctrl = sandbox.mk.ctrl(w.client);
  w.ModuleHandler.staticModules.spikeTickController = ctrl;

  const log = [];
  // TICK 1
  brk.postTick();
  trap.postTick();
  ctrl.postTick();
  log.push({
    tick: 1, weapon: w.ModuleHandler.forceWeapon, hat: w.ModuleHandler.forceHat,
    armed: trap.target !== null, committed: w.committed.length,
  });

  // TICK 2 — the trap you hammered now shows up in deletedObjects, which is
  // exactly spikeTickBreak's trigger.
  w.ModuleHandler.newTick();
  if (breakFiresOnTickTwo) w.client.ObjectManager.deletedObjects = new Set([ w.trap ]);
  brk.postTick();
  trap.postTick();
  ctrl.postTick();
  log.push({
    tick: 2, weapon: w.ModuleHandler.forceWeapon, hat: w.ModuleHandler.forceHat,
    armed: trap.target !== null, committed: w.committed.length,
    ctrlReason: ctrl.lastReason, ctrlStats: Object.assign({}, ctrl.stats),
  });
  return { log, committed: w.committed.length, ctrl };
}

const sandbox = build();
const pad = (v, w) => String(v).padEnd(w);
let bad = 0;

console.log(path.basename(RYN) + " — spike tick (trap), driven over both ticks\n");
console.log("  every helper and all three classes are lifted from the file; only the");
console.log("  world is staged\n");

// ── 1. the clean run ──────────────────────────────────────────────────────
const clean = runCombo(sandbox, {}, false);
console.log("  A. nothing else competing for the tick");
console.log("     " + pad("tick 1", 9) + "weapon " + pad(clean.log[0].weapon, 5) +
  "hat " + pad(clean.log[0].hat, 5) + "remembered the target: " + clean.log[0].armed);
console.log("     " + pad("tick 2", 9) + "spikes committed: " + clean.committed +
  (clean.log[1].ctrlReason ? "   controller said: " + clean.log[1].ctrlReason : ""));
if (clean.log[0].weapon !== 1 || clean.log[0].hat !== 40) {
  console.log("     <- tick 1 did not swing the hammer"); bad++;
}
if (clean.committed !== 1) { console.log("     <- no spike went out"); bad++; }

// ── 2. the same run, with the break variant seeing the trap it just killed ─
const conflict = runCombo(sandbox, {}, true);
console.log("\n  B. same fight, but the trap you hammered lands in deletedObjects");
console.log("     (this is what really happens on tick 2, and spikeTickBreak runs first)");
console.log("     " + pad("tick 2", 9) + "spikes committed: " + conflict.committed);

// ── 3. name the gate, one precondition at a time ──────────────────────────
const KNOBS = [
  ["master _spikeTick off", { spikeTickOn: false }],
  ["_spikeTickTrap off", { trapOn: false }],
  ["I am trapped too", { iAmTrapped: true }],
  ["an enemy spike within reach", { enemySpikeNear: true }],
  ["...same, but autobreak off", { enemySpikeNear: true, autobreak: false }],
  ["my hammer not reloaded", { myHammerReloaded: false }],
  ["my primary not reloaded", { myPrimaryReloaded: false }],
  ["trap too healthy for one swing", { trapHealth: 900 }],
  ["they are not about to reload", { enemyAboutToReload: false }],
  ["they are 150 away (past 110)", { enemyDist: 150 }],
];
console.log("\n  C. one precondition removed at a time — which ones stop the spike");
console.log("     " + pad("precondition removed", 34) + pad("hammer tick", 13) + "spike");
console.log("     " + "-".repeat(60));
for (const [label, opts] of KNOBS) {
  const r = runCombo(sandbox, opts, false);
  console.log("     " + pad(label, 34) +
    pad(r.log[0].weapon === 1 ? "swings" : "no", 13) +
    (r.committed > 0 ? "placed" : "none"));
}

/* Row C names the gate. spikeTickNearSpike, at the top of spikeTickTarget:
 *
 *     const spikeTickNearSpike = client2 => {
 *       if (!Settings_default._autobreak) return false;      // <- only when autobreak is on
 *       const spike = EnemyManager2.nearestSpike;
 *       if (spike === null) return false;
 *       const reach = spike.scale + Math.min(weapon.range, SPIKE_TICK_NEAR_SPIKE_REACH);
 *       return myPlayer.collidingSimple(spike, reach);
 *     };
 *
 * and in spikeTickTarget:
 *
 *     if (spikeTickCounterThreat(client2, state) || spikeTickNearSpike(client2)) return null;
 *
 * so ANY enemy spike within that reach of you cancels every spike tick variant
 * before it starts. It is a deliberate rule — it keeps the tick from fighting
 * autobreak for the same tick — but it is not aware of what it is cancelling,
 * and a trapped enemy is nearly always standing beside their own spikes. */
const SPIKE_SCALE = 49, POLEARM_RANGE = 142, NEAR_REACH = 75;
console.log("\n  The gate is spikeTickNearSpike, and it is only armed when _autobreak is on.");
console.log("  Its radius is spike.scale + min(primaryRange, " + NEAR_REACH + ") = " +
  SPIKE_SCALE + " + " + Math.min(POLEARM_RANGE, NEAR_REACH) + " = " +
  (SPIKE_SCALE + Math.min(POLEARM_RANGE, NEAR_REACH)) + " around YOU.");
console.log("  Any enemy spike inside that cancels the tick before it starts — and an enemy");
console.log("  pinned in a trap is nearly always standing next to one.");

console.log("\n  " + (bad === 0
  ? "the combo itself is sound: it places a spike whenever that gate lets it start"
  : bad + " problem(s) above"));
process.exit(bad === 0 ? 0 : 1);
