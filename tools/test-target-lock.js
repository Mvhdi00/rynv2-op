#!/usr/bin/env node
/*
 * test-target-lock.js
 *
 * Behaviour tests for the single-target aim lock and the trap-enclosure
 * gap-fill layer, run against the built client rather than against a copy of
 * the logic: every piece under test is sliced straight out of
 * ReUp_Mix.user.js and executed with stand-ins for the game objects it needs.
 * A build whose injected code stops behaving fails here.
 *
 *   node tools/test-target-lock.js [path/to/client.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = process.argv[2] || path.join(ROOT, "ReUp_Mix.user.js");
const built = fs.readFileSync(CLIENT, "utf8");

function slice(from, to, label) {
  const a = built.indexOf(from);
  if (a === -1) throw new Error("missing start: " + label);
  const b = built.indexOf(to, a);
  if (b === -1) throw new Error("missing end: " + label);
  return built.slice(a, b);
}

/* --- pieces of the real client the injected code leans on ----------------- */
const vectorSrc = slice("class Vector {", "  const Vector_default = Vector;", "Vector");
const angleSrc = "const PI = Math.PI;\n" + slice("const getAngleDist = ", "  const findMiddleAngle", "getAngleDist");
const siegeSrc = slice("const SiegeAnalysis = {", "\n  function _getCachedPrePlaceAngles", "SiegeAnalysis");

/* --- the injected code ---------------------------------------------------- */
const targetLockSrc = slice("  const TARGET_LOCK_TICK_MS = 111;", "  const TargetLock_default = TargetLock;", "TargetLock");
const gapSrc = slice("    /* Local geometry around the target.", "    // GLOTUS MODE", "gap fill");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
};

console.log("client : " + path.relative(ROOT, CLIENT));

(function targetLockTests() {
/* ---------------------------------------------------------------- scaffold */
const Settings_default = {
  _targetLock: true,
  _autoplacerRadius: 350,
  _targetSwitchMargin: 60,
  _trapGapFill: true,
  _lowQuality: false
};
const Items = { 4: { scale: 35, placeOffset: 0, itemGroup: 2 } };

const build = new Function(
  "Settings_default", "Items", "PlayerObject", "pointInDesert",
  `${vectorSrc}
   const Vector_default = Vector;
   ${angleSrc}
   ${siegeSrc}
   ${targetLockSrc}
   class Placer {
     _bannedAngles = new Map;
     _predictObjects = [];
     _placedAngles = [];
     _gapFill = null;
     _gapBreak = null;
     constructor(client) { this.client = client; }
     ${gapSrc}
     _isItemLimit() { return false; }
     _getConfig(id, myPos) {
       return angle => {
         const item = Items[id];
         const dist = 35 + item.scale + (item.placeOffset || 0);
         return { id, angle, x: myPos.x + dist * Math.cos(angle), y: myPos.y + dist * Math.sin(angle), scale: item.scale };
       };
     }
     _canPlace(id, angle, myPos, OM, excludeObj) {
       const cfg = this._getConfig(id, myPos)(angle);
       for (const obj of OM.all) {
         if (excludeObj && obj === excludeObj) continue;
         if (Math.hypot(cfg.x - obj.pos.current.x, cfg.y - obj.pos.current.y) < cfg.scale + obj.collisionScale) return false;
       }
       return true;
     }
     _getPrePlaceAngles(id, myPos, myPlayer, OM) {
       const getConfig = this._getConfig(id, myPos);
       const out = [];
       for (let i = 0; i < 72; i++) {
         const angle = i * (Math.PI * 2 / 72);
         out.push({ ...getConfig(angle), placeable: this._canPlace(id, angle, myPos, OM, null), perfect: false });
       }
       return out;
     }
     _addPredictObject(id, angle, preplace, myPos) {
       const cfg = this._getConfig(id, myPos)(angle);
       for (const o of this._predictObjects) {
         if (Math.hypot(cfg.x - o.x, cfg.y - o.y) < cfg.scale + o.scale) return;
       }
       this._predictObjects.push({ id, angle, x: cfg.x, y: cfg.y, scale: cfg.scale, preplace });
     }
   }
   return { Vector, TargetLock, Placer, SiegeAnalysis };`
);

class FakePlayerObject {
  constructor(x, y, type, ownerID, scale) {
    this.pos = { current: null };
    this._x = x; this._y = y;
    this.type = type; this.ownerID = ownerID; this.scale = scale;
    this.itemGroup = type === 15 ? 4 : 2;
  }
  get collisionScale() { return this.scale; }
  canMoveOnTop() { return this.type === 15; }
}
const { Vector, TargetLock, Placer } = build(Settings_default, Items, FakePlayerObject, () => false);
for (const k of ["x"]) void k;

/* ------------------------------------------------------------ fake client */
const V = (x, y) => new Vector(x, y);
function mkPlayer(id, x, y, opts = {}) {
  const p = {
    id,
    inGame: true,
    currentHealth: opts.health ?? 100,
    speed: opts.speed ?? 0,
    move_dir: opts.dir ?? 0,
    collisionScale: 35,
    pos: { previous: V(x, y), current: V(x, y), future: V(x + (opts.vx ?? 0), y + (opts.vy ?? 0)) },
    isEnemyByID: () => true
  };
  return p;
}
function mkClient(myPlayer, enemies, ping = 0) {
  const c = {
    myPlayer,
    SocketManager: { pong: ping },
    PlayerManager: { enemies, isEnemyByID: (ownerID, target) => ownerID !== target.id },
    ObjectManager: null,
    _ModuleHandler: { tickCount: 0, staticModules: {}, placeAngles: [null, []], packetCount: 0, packetLimit: 60, activeModule: null }
  };
  c._ModuleHandler.staticModules.targetLock = new TargetLock(c);
  return c;
}

/* ================================================================= tests */
console.log("\nTargetLock — selection");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0);
  const b = mkPlayer(3, 250, 0);
  const c = mkClient(me, [b, a]);          // deliberately out of order
  const lock = c._ModuleHandler.staticModules.targetLock;
  lock.postTick();
  ok("locks the closest valid enemy, not the first in the list", lock.target === a, "got id " + lock.targetId);
  ok("exposes it as the ActiveTarget", lock.activeTarget() === a);
  ok("one generation bump for one acquire", lock.generation === 1, "gen " + lock.generation);
}

console.log("\nTargetLock — range gate");
{
  const me = mkPlayer(1, 0, 0);
  const far = mkPlayer(2, 500, 0);
  const c = mkClient(me, [far]);
  const lock = c._ModuleHandler.staticModules.targetLock;
  lock.postTick();
  ok("ignores an enemy outside the placer radius", lock.activeTarget() === null);
}

console.log("\nTargetLock — hysteresis");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0);
  const b = mkPlayer(3, 105, 0);
  const c = mkClient(me, [a, b]);
  const lock = c._ModuleHandler.staticModules.targetLock;
  lock.postTick();
  ok("A wins first", lock.target === a);
  const genAfterA = lock.generation;

  /* B creeps to 5 units closer than A on every following tick */
  let flips = 0;
  for (let t = 1; t <= 12; t++) {
    c._ModuleHandler.tickCount = t;
    b.pos.current._setXY(95, 0);
    a.pos.current._setXY(100, 0);
    const before = lock.target;
    lock.postTick();
    if (lock.target !== before) flips++;
  }
  ok("a 5-unit lead never takes the lock (margin 60)", lock.target === a && flips === 0, "flips " + flips);
  ok("no stale generation churn", lock.generation === genAfterA, "gen " + lock.generation);

  /* now B is genuinely closer, past the margin */
  c._ModuleHandler.tickCount = 20;
  b.pos.current._setXY(30, 0);
  lock.postTick();
  ok("switches when the lead clears the margin", lock.target === b);
  ok("generation bumped so downstream candidates are stale", lock.generation === genAfterA + 1);
}

console.log("\nTargetLock — validity");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0);
  const c = mkClient(me, [a]);
  const lock = c._ModuleHandler.staticModules.targetLock;
  lock.postTick();
  ok("locked", lock.target === a);

  c._ModuleHandler.tickCount = 1;
  a.currentHealth = 0;
  lock.postTick();
  ok("drops a dead target immediately", lock.activeTarget() === null);

  c._ModuleHandler.tickCount = 2;
  a.currentHealth = 100;
  c.PlayerManager.enemies = [];            // left the enemy list (teammate / gone)
  lock.postTick();
  ok("never selects something outside PlayerManager.enemies", lock.activeTarget() === null);

  c._ModuleHandler.tickCount = 3;
  c.PlayerManager.enemies = [a];
  me.isEnemyByID = () => false;            // clan check: no longer an enemy
  lock.postTick();
  ok("never selects a teammate", lock.activeTarget() === null);
}

console.log("\nTargetLock — prediction / ping compensation");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0, { vx: 10, vy: 0, speed: 10, dir: 0 });
  const c0 = mkClient(me, [a], 0);
  c0._ModuleHandler.staticModules.targetLock.postTick();
  const lock0 = c0._ModuleHandler.staticModules.targetLock;
  ok("0 ms ping predicts one tick of travel", Math.abs(lock0.predicted.x - 110) < 1e-6, lock0.predicted.x);

  const a2 = mkPlayer(2, 100, 0, { vx: 10, vy: 0, speed: 10, dir: 0 });
  const c1 = mkClient(me, [a2], 111);
  const lock1 = c1._ModuleHandler.staticModules.targetLock;
  lock1.postTick();
  ok("111 ms ping predicts two ticks", Math.abs(lock1.predicted.x - 120) < 1e-6, lock1.predicted.x);

  const a3 = mkPlayer(2, 100, 0, { vx: 10, vy: 0, speed: 10, dir: 0 });
  const c2 = mkClient(me, [a3], 5000);
  const lock2 = c2._ModuleHandler.staticModules.targetLock;
  lock2.postTick();
  ok("a latency spike is capped at three ticks", Math.abs(lock2.predicted.x - 130) < 1e-6, lock2.predicted.x);

  ok("prediction is only handed out for the locked target", lock2.predictedFor(mkPlayer(9, 0, 0)) === null);
  ok("prediction is handed out for the locked target", lock2.predictedFor(a3) === lock2.predicted);
}

console.log("\nTargetLock — scan cost");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0);
  const b = mkPlayer(3, 200, 0);
  const c = mkClient(me, [a]);
  const lock = c._ModuleHandler.staticModules.targetLock;
  let checks = 0;
  const realValid = lock.isValidTarget.bind(lock);
  lock.isValidTarget = e => { checks++; return realValid(e); };

  lock.postTick();
  const afterFirst = checks;
  for (let i = 0; i < 60; i++) lock.postTick();     // 60 render frames inside one tick
  ok("repeat calls inside one tick do no work at all", checks === afterFirst, "checks " + checks);

  c._ModuleHandler.tickCount = 1;
  checks = 0;
  lock.postTick();
  ok("one visible enemy: validate the held target, no candidate loop", checks === 1, "checks " + checks);

  c._ModuleHandler.tickCount = 2;
  c.PlayerManager.enemies = [a, b];
  checks = 0;
  lock.postTick();
  ok("two visible enemies: held target plus the one challenger", checks === 2, "checks " + checks);
}

console.log("\nTargetLock — disabled");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0);
  const c = mkClient(me, [a]);
  const lock = c._ModuleHandler.staticModules.targetLock;
  Settings_default._targetLock = false;
  lock.postTick();
  ok("off means no ActiveTarget, placers fall back to nearestEnemy", lock.activeTarget() === null && lock.enabled === false);
  Settings_default._targetLock = true;
}

})();

(function gapFillTests() {
const Settings_default = {
  _targetLock: true, _autoplacerRadius: 350, _targetSwitchMargin: 60,
  _trapGapFill: true, _lowQuality: false
};
const Items = { 4: { scale: 35, placeOffset: 0, itemGroup: 2 }, 15: { scale: 32, itemGroup: 4 } };

class PlayerObject {
  constructor(x, y, type, ownerID, scale) {
    this.pos = { current: { x, y, distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); } } };
    this.pos.current.x = x; this.pos.current.y = y;
    this.type = type; this.ownerID = ownerID; this.scale = scale; this.id = PlayerObject.n = (PlayerObject.n || 0) + 1;
    this.itemGroup = type === 15 ? 4 : 2;
  }
  get collisionScale() { return this.scale; }
  canMoveOnTop() { return this.type === 15; }
}

const build = new Function(
  "Settings_default", "Items", "PlayerObject",
  `${vectorSrc}
   const Vector_default = Vector;
   ${angleSrc}
   ${siegeSrc}
   ${targetLockSrc}
   class Placer {
     _bannedAngles = new Map;
     _predictObjects = [];
     _placedAngles = [];
     _gapFill = null;
     _gapBreak = null;
     constructor(client) { this.client = client; }
     ${gapSrc}
     _isItemLimit() { return false; }
     _getConfig(id, myPos) {
       return angle => {
         const item = Items[id];
         const dist = 35 + item.scale + (item.placeOffset || 0);
         return { id, angle, x: myPos.x + dist * Math.cos(angle), y: myPos.y + dist * Math.sin(angle), scale: item.scale };
       };
     }
     _canPlace(id, angle, myPos, OM, excludeObj) {
       const cfg = this._getConfig(id, myPos)(angle);
       for (const obj of OM.all) {
         if (excludeObj && obj === excludeObj) continue;
         if (Math.hypot(cfg.x - obj.pos.current.x, cfg.y - obj.pos.current.y) < cfg.scale + obj.collisionScale) return false;
       }
       return true;
     }
     _getPrePlaceAngles(id, myPos, myPlayer, OM) {
       const getConfig = this._getConfig(id, myPos);
       const out = [];
       for (let i = 0; i < 72; i++) {
         const angle = i * (Math.PI * 2 / 72);
         out.push({ ...getConfig(angle), placeable: this._canPlace(id, angle, myPos, OM, null), perfect: false });
       }
       return out;
     }
     _addPredictObject(id, angle, preplace, myPos) {
       const cfg = this._getConfig(id, myPos)(angle);
       for (const o of this._predictObjects) {
         if (Math.hypot(cfg.x - o.x, cfg.y - o.y) < cfg.scale + o.scale) return;
       }
       this._predictObjects.push({ id, angle, x: cfg.x, y: cfg.y, scale: cfg.scale, preplace });
     }
   }
   return { Vector, TargetLock, Placer, SiegeAnalysis, getAngleDist };`
);
const { Vector, TargetLock, Placer, SiegeAnalysis, getAngleDist } = build(Settings_default, Items, PlayerObject);

const V = (x, y) => new Vector(x, y);
function mkPlayer(id, x, y, opts = {}) {
  return {
    id, inGame: true, currentHealth: 100,
    speed: opts.speed ?? 0, move_dir: opts.dir ?? 0, collisionScale: 35,
    pos: { previous: V(x, y), current: V(x, y), future: V(x + (opts.vx ?? 0), y + (opts.vy ?? 0)) },
    isEnemyByID: () => true
  };
}
function mkWorld(me, enemy, objects, ping = 0) {
  const OM = {
    all: objects,
    objects: new Map(objects.map(o => [o.id, o])),
    grid2D: { query: (x, y, r, cb) => { for (const o of objects) cb(o.id); return false; } }
  };
  const c = {
    myPlayer: me,
    SocketManager: { pong: ping },
    ObjectManager: OM,
    PlayerManager: { enemies: [enemy], isEnemyByID: (ownerID, target) => ownerID !== target.id },
    _ModuleHandler: {
      tickCount: 0, placeAngles: [null, []], packetCount: 0, packetLimit: 60,
      activeModule: null, staticModules: {}
    }
  };
  c._ModuleHandler.staticModules.spikeTick = { useBreakTrapPlace: false, useBreakTrapFollowup: false };
  const lock = new TargetLock(c);
  c._ModuleHandler.staticModules.targetLock = lock;
  lock.postTick();
  return { client: c, lock, OM };
}
/* Ring of my traps around the enemy with one real opening at gapAngle.
 * radius 90 keeps the ring clear of the enemy's own 35-unit body, and a
 * 1.2 rad skip leaves a chord wide enough that isEscapable calls it an exit. */
function boxIn(ex, ey, gapAngle, ownerID = 1, radius = 90, n = 10) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = i * (Math.PI * 2 / n);
    let d = Math.abs(a - gapAngle) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < 1.2) continue;                       // leave the gap open
    out.push(new PlayerObject(ex + radius * Math.cos(a), ey + radius * Math.sin(a), 15, ownerID, 32));
  }
  return out;
}
function run(world, me, enemy, placer) {
  return placer._gapFillPlace({
    enemy, enemyPos: enemy.pos.current, enemyScale: enemy.collisionScale,
    myPos: me.pos.current, myPlayer: me, spikeId: 4, lock: world.lock,
    ObjectManager2: world.OM, PlayerManager2: world.client.PlayerManager,
    ModuleHandler: world.client._ModuleHandler
  });
}

console.log("\nGap fill — test geometry sanity");
{
  /* A spike lands exactly 70 units from the player (35 + spike scale), so a
   * gap is only fillable when it falls on that circle. The fixture puts the
   * enemy 160 out with the box's one opening facing back at me, which is the
   * situation the layer is for: the way out leads past the player. */
  const ring = boxIn(160, 0, Math.PI);
  const siege = SiegeAnalysis.isEscapable(160, 0, 35, ring.map(o => ({
    x: o.pos.current.x, y: o.pos.current.y, escapeScale: o.collisionScale
  })));
  ok("the fixture really is a box with exactly one opening", siege.exits.length === 1,
     "exits " + siege.exits.length);
  ok("the opening faces the player", siege.exits.length === 1 && Math.abs(getAngleDist(siege.exits[0].angle, Math.PI)) < 0.3,
     siege.exits.length ? siege.exits[0].angle.toFixed(2) : "n/a");
}

console.log("\nGap fill — enclosure detection");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 100, 0);
  const w = mkWorld(me, enemy, []);
  const p = new Placer(w.client);
  ok("open field: nothing to fill", run(w, me, enemy, p) === false);
  ok("no candidate cached", p._gapFill === null);
}
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 100, 0);
  const w = mkWorld(me, enemy, [new PlayerObject(190, 0, 15, 1, 32), new PlayerObject(100, 90, 15, 1, 32)]);
  const p = new Placer(w.client);
  ok("two nearby traps is not an enclosure", run(w, me, enemy, p) === false);
}
{
  /* One trap actually holding the enemy, nothing else: still not this layer's
   * job — normal preplace / replace already covers a lone trapped target. */
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 100, 0);
  const w = mkWorld(me, enemy, [new PlayerObject(160, 0, 15, 1, 32), new PlayerObject(100, 90, 15, 1, 32)]);
  const p = new Placer(w.client);
  ok("a lone trap holding the target is not an enclosure either", run(w, me, enemy, p) === false);
}

console.log("\nGap fill — boxed in, the way out leads past me");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 160, 0, { speed: 8, dir: Math.PI, vx: -8 });   // breaking toward me
  const gapAngle = Math.PI;
  const w = mkWorld(me, enemy, boxIn(160, 0, gapAngle));
  const p = new Placer(w.client);
  const placed = run(w, me, enemy, p);
  ok("queues exactly one spike", placed === true && p._predictObjects.length === 1,
     "queued " + p._predictObjects.length);
  const spike = p._predictObjects[0];
  ok("queued as a preplace, through the existing path", spike && spike.preplace === true);
  if (spike) {
    const fromTarget = Math.atan2(spike.y - 0, spike.x - 160);
    const off = getAngleDist(fromTarget, gapAngle);
    ok("sits in the gap the target is running for", off < 0.9, "off " + off.toFixed(2) + " rad");
    const d = Math.hypot(spike.x - 160, spike.y - 0);
    ok("placed at the target, not somewhere nearby", d < 35 + 35 + 90, "dist " + d.toFixed(1));
    ok("inside my own placement reach", Math.abs(Math.hypot(spike.x, spike.y) - 70) < 1e-6,
       Math.hypot(spike.x, spike.y).toFixed(1));
  }
}

console.log("\nGap fill — an opening I cannot reach is left alone");
{
  /* Same box, opening on the far side. Nothing within placement range is in
   * that gap, so the layer must place nothing at all rather than dropping a
   * spike on whatever happens to be near the target. */
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 160, 0, { speed: 8, dir: 0, vx: 8 });
  const w = mkWorld(me, enemy, boxIn(160, 0, 0));
  const p = new Placer(w.client);
  const placed = run(w, me, enemy, p);
  ok("no spike when the gap is out of reach", placed === false && p._predictObjects.length === 0,
     "queued " + p._predictObjects.length);
}

console.log("\nGap fill — escape direction");
{
  const me = mkPlayer(1, 0, 0);
  const p = new Placer(mkWorld(me, mkPlayer(2, 160, 0), []).client);
  const lock = { valid: false };
  const moving = mkPlayer(2, 160, 0, { speed: 8, dir: 1.1 });
  ok("a moving target: its own direction",
     Math.abs(p._gapEscapeDir(lock, moving, moving.pos.current, me.pos.current) - 1.1) < 1e-9);
  const still = mkPlayer(2, 160, 0, { speed: 0 });
  ok("a standing target: away from me",
     Math.abs(p._gapEscapeDir(lock, still, still.pos.current, me.pos.current) - 0) < 1e-9);
  const stillDiag = mkPlayer(2, 0, 160, { speed: 0 });
  ok("away from me, whichever way that is",
     Math.abs(p._gapEscapeDir(lock, stillDiag, stillDiag.pos.current, me.pos.current) - Math.PI / 2) < 1e-9);
  const locked = { valid: true, target: moving, speed: 9, moveDir: 2.2 };
  ok("the lock's cached heading wins over the raw entity",
     Math.abs(p._gapEscapeDir(locked, moving, moving.pos.current, me.pos.current) - 2.2) < 1e-9);
}

console.log("\nGap fill — stand-downs");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 160, 0, { speed: 8, dir: Math.PI, vx: -8 });
  const w = mkWorld(me, enemy, boxIn(160, 0, Math.PI));

  let p = new Placer(w.client);
  w.client._ModuleHandler.activeModule = "spikeTick";
  ok("stands down while Spike Tick is executing", run(w, me, enemy, p) === false);
  w.client._ModuleHandler.activeModule = null;

  p = new Placer(w.client);
  w.client._ModuleHandler.staticModules.spikeTick.useBreakTrapPlace = true;
  ok("stands down on the tick before a Spike Tick placement", run(w, me, enemy, p) === false);
  w.client._ModuleHandler.staticModules.spikeTick.useBreakTrapPlace = false;

  p = new Placer(w.client);
  w.client._ModuleHandler.packetCount = 58;
  ok("stands down when the packet budget is spent", run(w, me, enemy, p) === false);
  w.client._ModuleHandler.packetCount = 0;

  p = new Placer(w.client);
  Settings_default._trapGapFill = false;
  ok("off means off", run(w, me, enemy, p) === false);
  Settings_default._trapGapFill = true;
}

console.log("\nGap fill — anti-duplicate");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 160, 0, { speed: 8, dir: Math.PI, vx: -8 });
  const w = mkWorld(me, enemy, boxIn(160, 0, Math.PI));

  const p = new Placer(w.client);
  run(w, me, enemy, p);
  const chosen = p._predictObjects[0].angle;

  const p2 = new Placer(w.client);
  w.client._ModuleHandler.placeAngles = [4, [chosen]];   // Spike Tick took that angle
  run(w, me, enemy, p2);
  const second = p2._predictObjects[0];
  ok("never re-uses an angle already reserved this tick",
     !second || Math.abs(second.angle - chosen) > 0.05,
     second ? "reused " + second.angle : "none");
  w.client._ModuleHandler.placeAngles = [null, []];

  const p3 = new Placer(w.client);
  p3._addPredictObject(4, chosen, false, me.pos.current);   // placer already queued it
  const before = p3._predictObjects.length;
  run(w, me, enemy, p3);
  const added = p3._predictObjects.length - before;
  ok("never stacks a second spike on a queued one", added === 0 || Math.abs(p3._predictObjects[before].angle - chosen) > 0.05,
     "added " + added);
}

console.log("\nGap fill — replace threshold");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 160, 0, { speed: 8, dir: Math.PI, vx: -8 });
  const w = mkWorld(me, enemy, boxIn(160, 0, Math.PI));
  const p = new Placer(w.client);
  run(w, me, enemy, p);
  const first = p._gapFill.angle;
  const firstScore = p._gapFill.score;

  /* Same tick geometry, fresh queue: the held choice should be kept, not
   * re-derived into a different angle for no gain. */
  p._predictObjects = [];
  run(w, me, enemy, p);
  ok("keeps the chosen opening when nothing meaningfully better appears",
     p._gapFill.angle === first, "was " + first.toFixed(3) + " now " + p._gapFill.angle.toFixed(3));
  ok("score is carried, not recomputed into churn", Math.abs(p._gapFill.score - firstScore) < 1e-9);
}

console.log("\nGap fill — target switch drops the cached opening");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 160, 0, { speed: 8, dir: Math.PI, vx: -8 });
  const w = mkWorld(me, enemy, boxIn(160, 0, Math.PI));
  const p = new Placer(w.client);
  run(w, me, enemy, p);
  ok("cached against the current generation", p._gapFill.generation === w.lock.generation);
  const stale = { ...p._gapFill };
  w.lock._release();                                    // target died / left
  ok("last-moment validation rejects the stale candidate", p._gapFillStillValid(stale) === false);
}

console.log("\nGap fill — my trap vs enemy trap ownership");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 160, 0, { speed: 8, dir: Math.PI, vx: -8 });
  const mine = boxIn(160, 0, Math.PI, 1);
  const theirs = boxIn(160, 0, Math.PI, 2);
  const w1 = mkWorld(me, enemy, mine);
  const p1 = new Placer(w1.client);
  const b1 = p1._gapBlockers(enemy, enemy.pos.current, w1.OM, w1.client.PlayerManager, me);
  ok("my traps are read as mine", b1.length > 0 && b1.every(b => b.mine === true));
  ok("my traps hold the enemy (game rule: owner != target)", b1.every(b => b.holdsTarget === true));

  const w2 = mkWorld(me, enemy, theirs);
  const p2 = new Placer(w2.client);
  const b2 = p2._gapBlockers(enemy, enemy.pos.current, w2.OM, w2.client.PlayerManager, me);
  ok("the enemy's own traps are not mine", b2.every(b => b.mine === false));
  ok("the enemy's own traps do not hold them", b2.every(b => b.holdsTarget === false));
}

console.log("\nGap fill — sealed box: the break case");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 160, 0, { speed: 8, dir: Math.PI, vx: -8 });
  /* Fully closed: the box plus one of my traps plugging the only opening. */
  const objs = boxIn(160, 0, Math.PI);
  const plug = new PlayerObject(70, 0, 15, 1, 32);
  objs.push(plug);
  const w = mkWorld(me, enemy, objs);
  const p = new Placer(w.client);

  const blockers = p._gapBlockers(enemy, enemy.pos.current, w.OM, w.client.PlayerManager, me);
  const sealed = SiegeAnalysis.isEscapable(160, 0, 35, blockers);
  ok("the fixture really is sealed shut", sealed.exits.length === 0, "exits " + sealed.exits.length);

  const placed = run(w, me, enemy, p);
  ok("nothing is placed into a sealed box", placed === false && p._predictObjects.length === 0);
  ok("but the trap plugging it is identified", p._gapBreak !== null && p._gapBreak.trap === plug,
     p._gapBreak ? "trap " + p._gapBreak.trap.id : "none");
  const prepared = p._gapBreak && p._gapBreak.angle;

  /* The trap goes — however it went — and the prepared spike goes in by
   * itself on the next tick, with no extra machinery. */
  const idx = w.OM.all.indexOf(plug);
  w.OM.all.splice(idx, 1);
  w.OM.objects.delete(plug.id);
  const p2 = new Placer(w.client);
  const placedAfter = run(w, me, enemy, p2);
  ok("once it is gone the prepared spike is placed", placedAfter === true && p2._predictObjects.length === 1);
  ok("in the opening that trap was occupying",
     p2._predictObjects.length === 1 && Math.abs(p2._predictObjects[0].angle - prepared) < 0.2,
     p2._predictObjects.length ? p2._predictObjects[0].angle.toFixed(3) + " vs " + prepared.toFixed(3) : "none");
}

console.log("\nGap fill — blocking own trap is reported, never broken");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 160, 0, { speed: 8, dir: Math.PI, vx: -8 });
  /* The box, plus one of my own traps sitting exactly on the best spike spot. */
  const objs = boxIn(160, 0, Math.PI);
  const blockerTrap = new PlayerObject(70, 0, 15, 1, 32);
  objs.push(blockerTrap);
  const w = mkWorld(me, enemy, objs);
  const p = new Placer(w.client);
  run(w, me, enemy, p);
  const reported = p._gapBreak;
  ok("names which of my own traps stands in the way",
     reported !== null && reported.trap === blockerTrap, reported ? "trap " + reported.trap.id : "none — vacuous");
  ok("and where the spike goes once that trap is gone",
     reported !== null && typeof reported.angle === "number");
  ok("published for the rest of the client to see",
     w.client._gapFillBreak === reported);
  ok("never mutates the world / issues a break", w.OM.all.includes(blockerTrap));
}

})();

(function menuBindingTests() {
  /* The menu binds inputs to settings by id and only complains at runtime, in
   * the console, once the page is open. Catch an unbound id here instead. */
  console.log("\nMenu — every input binds to a setting");
  const start = built.indexOf("  const defaultSettings = {");
  const end = built.indexOf("  const settings = {", start);
  const keys = new Set([...built.slice(start, end).matchAll(/^\s{4}(_[A-Za-z0-9_]+):/gm)].map(m => m[1]));

  const pages = [...built.matchAll(/const (\w+_default) = "<div class=\\"menu-page/g)].map(m => m[1]);
  let unbound = 0, checked = 0;
  for (const name of pages) {
    const decl = `const ${name} = `;
    const s = built.indexOf(decl);
    const e = built.indexOf("\n", s);
    // eslint-disable-next-line no-eval
    const html = eval(built.slice(s + decl.length, e).replace(/;\s*$/, ""));
    for (const m of html.matchAll(/<input id="(_[A-Za-z0-9_]+)" type="(checkbox|color|range|text)"/g)) {
      checked++;
      if (!keys.has(m[1])) { unbound++; console.log("       unbound: " + name + " -> " + m[1]); }
    }
  }
  ok(`all ${checked} menu inputs across ${pages.length} pages resolve to a setting`, unbound === 0,
     unbound + " unbound");
  for (const key of [ "_targetLock", "_targetSwitchMargin", "_aimCircle", "_aimCircleColor", "_trapGapFill" ]) {
    ok(key + " is a real setting", keys.has(key));
  }
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
