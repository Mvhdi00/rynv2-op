#!/usr/bin/env node
/*
 * test-ryn-type2.js
 *
 * Behaviour tests for the single-target aim lock and the trap-enclosure
 * layer added to RYN Type 2, run against the built client rather than a copy
 * of the logic: every piece under test is sliced straight out of
 * Ryn_Type_2_TargetLock.user.js and executed with stand-ins for the game
 * objects it needs. A build whose injected code stops behaving fails here.
 *
 *   node tools/test-ryn-type2.js [path/to/client.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = process.argv[2] || path.join(ROOT, "Ryn_Type_2_TargetLock.user.js");
const built = fs.readFileSync(CLIENT, "utf8");

function slice(from, to, label) {
  const a = built.indexOf(from);
  if (a === -1) throw new Error("missing start: " + label);
  const b = built.indexOf(to, a);
  if (b === -1) throw new Error("missing end: " + label);
  return built.slice(a, b);
}

/* --- the client's own pieces the additions lean on ----------------------- */
const vectorSrc = slice("class Vector {", "  const Vector_default = Vector;", "Vector");
const siegeSrc = slice("  const SiegeAnalysis = {", "\n  const RPE_TICK_MS", "SiegeAnalysis");
const geometrySrc = slice("  const GeometrySolver = {", "\n  class PlacementLedger {", "GeometrySolver");
const motionSrc = slice("  const RPE_TICK_DECAY", "  class PreplaceBook {", "TargetMotion");
/* GeometrySolver reads RPE_TAU / RPE_EPS, which are declared ahead of it. */
const rpeConstSrc = slice("  const RPE_TICK_MS", "  const RPE_PRIORITY = {", "RPE constants");

/* --- the injected code --------------------------------------------------- */
const targetLockSrc = slice("  class TargetLock {", "  const TargetLock_default = TargetLock;", "TargetLock");
const enclosureSrc = slice("    /* Everything near the target that constrains", "    _planIsStale(frame) {", "enclosure");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
};

console.log("client : " + path.relative(ROOT, CLIENT));

/* ---------------------------------------------------------------- scaffold */
const Settings_default = {
  _targetLock: true,
  _autoplacerRadius: 350,
  _targetSwitchMargin: 60,
  _trapGapFill: true,
  _lowQuality: false
};

class PlayerObject {
  constructor(x, y, type, ownerID, scale) {
    this.pos = { current: { x, y } };
    this.pos.current.distance = function (v) { return Math.hypot(this.x - v.x, this.y - v.y); };
    this.type = type;
    this.ownerID = ownerID;
    this.scale = scale;
    this.id = PlayerObject.n = (PlayerObject.n || 0) + 1;
    this.itemGroup = type === 15 ? 4 : 2;
  }
  get collisionScale() { return this.scale; }
  canMoveOnTop() { return this.type === 15; }   // traps are ignoreCollision
}

const build = new Function(
  "Settings_default", "PlayerObject",
  `${vectorSrc}
   const Vector_default = Vector;
   ${siegeSrc}
   ${rpeConstSrc}
   ${geometrySrc}
   ${motionSrc}
   ${targetLockSrc}
   /* The enclosure methods, on a stub carrying only what they touch. */
   class Engine {
     constructor(client) { this.client = client; this.motion = new TargetMotion; }
     ${enclosureSrc}
   }
   return { Vector, TargetLock, Engine, SiegeAnalysis, GeometrySolver, TargetMotion };`
);
const { Vector, TargetLock, Engine, SiegeAnalysis, GeometrySolver, TargetMotion } =
  build(Settings_default, PlayerObject);

const V = (x, y) => new Vector(x, y);
function mkPlayer(id, x, y, opts = {}) {
  return {
    id, inGame: true,
    currentHealth: opts.health ?? 100,
    collisionScale: 35,
    pos: { previous: V(x, y), current: V(x, y), future: V(x + (opts.vx ?? 0), y + (opts.vy ?? 0)) },
    isEnemyByID: () => true
  };
}
function mkClient(myPlayer, enemies, objects = [], ping = 0) {
  const OM = {
    all: objects,
    objects: new Map(objects.map(o => [o.id, o])),
    grid2D: { query: (x, y, r, cb) => { for (const o of objects) cb(o.id); return false; } }
  };
  const client = {
    myPlayer,
    SocketManager: { pong: ping, TICK: 1e3 / 9 },
    ObjectManager: OM,
    PlayerManager: { enemies, isEnemyByID: (ownerID, target) => ownerID !== target.id },
    _ModuleHandler: { tickCount: 0, staticModules: {} }
  };
  client._ModuleHandler.staticModules.targetLock = new TargetLock(client);
  return { client, OM, lock: client._ModuleHandler.staticModules.targetLock };
}

/* ================================================================== tests */
console.log("\nTargetLock — selection");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0);
  const b = mkPlayer(3, 250, 0);
  const w = mkClient(me, [b, a]);                 // deliberately out of order
  w.lock.postTick();
  ok("locks the closest valid enemy, not the first in the list", w.lock.target === a, "id " + w.lock.targetId);
  ok("exposes it as the ActiveTarget", w.lock.activeTarget() === a);
  ok("one generation bump for one acquire", w.lock.generation === 1, "gen " + w.lock.generation);
}

console.log("\nTargetLock — range gate");
{
  const me = mkPlayer(1, 0, 0);
  const w = mkClient(me, [mkPlayer(2, 500, 0)]);
  w.lock.postTick();
  ok("ignores an enemy outside the placer radius", w.lock.activeTarget() === null);
}

console.log("\nTargetLock — hysteresis");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0);
  const b = mkPlayer(3, 105, 0);
  const w = mkClient(me, [a, b]);
  w.lock.postTick();
  ok("A wins first", w.lock.target === a);
  const gen = w.lock.generation;

  let flips = 0;
  for (let t = 1; t <= 12; t++) {
    w.client._ModuleHandler.tickCount = t;
    b.pos.current._setXY(95, 0);
    a.pos.current._setXY(100, 0);
    const before = w.lock.target;
    w.lock.postTick();
    if (w.lock.target !== before) flips++;
  }
  ok("a 5-unit lead never takes the lock (margin 60)", w.lock.target === a && flips === 0, "flips " + flips);
  ok("no stale generation churn", w.lock.generation === gen, "gen " + w.lock.generation);

  w.client._ModuleHandler.tickCount = 20;
  b.pos.current._setXY(30, 0);
  w.lock.postTick();
  ok("switches when the lead clears the margin", w.lock.target === b);
  ok("generation bumped so downstream work is stale", w.lock.generation === gen + 1);
}

console.log("\nTargetLock — validity");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0);
  const w = mkClient(me, [a]);
  w.lock.postTick();
  ok("locked", w.lock.target === a);

  w.client._ModuleHandler.tickCount = 1;
  a.currentHealth = 0;
  w.lock.postTick();
  ok("drops a dead target immediately", w.lock.activeTarget() === null);

  w.client._ModuleHandler.tickCount = 2;
  a.currentHealth = 100;
  w.client.PlayerManager.enemies = [];
  w.lock.postTick();
  ok("never selects something outside PlayerManager.enemies", w.lock.activeTarget() === null);

  w.client._ModuleHandler.tickCount = 3;
  w.client.PlayerManager.enemies = [a];
  me.isEnemyByID = () => false;
  w.lock.postTick();
  ok("never selects a teammate", w.lock.activeTarget() === null);
}

console.log("\nTargetLock — ping-derived lead");
{
  const mk = ping => {
    const me = mkPlayer(1, 0, 0);
    const w = mkClient(me, [mkPlayer(2, 100, 0, { vx: 10 })], [], ping);
    w.lock.postTick();
    return w.lock;
  };
  ok("0 ms ping leads one tick", mk(0).leadTicks === 1, mk(0).leadTicks);
  ok("111 ms ping leads two ticks", mk(111).leadTicks === 2, mk(111).leadTicks);
  ok("333 ms ping leads four ticks", mk(333).leadTicks === 4, mk(333).leadTicks);
  ok("a latency spike is capped at the engine's preplace horizon", mk(5000).leadTicks === 6, mk(5000).leadTicks);
}

console.log("\nTargetLock — prediction comes from the engine's TargetMotion");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 100, 0, { vx: 10 });
  const w = mkClient(me, [enemy], [], 111);
  const motion = new TargetMotion;
  w.client._ModuleHandler.staticModules.placementEngine = { motion };

  /* Two observations give the tracker a velocity to work from. */
  w.lock.postTick();
  for (let t = 1; t <= 3; t++) {
    w.client._ModuleHandler.tickCount = t;
    enemy.pos.current._setXY(100 + t * 10, 0);
    enemy.pos.future._setXY(110 + t * 10, 0);
    w.lock.postTick();
  }
  ok("the shared tracker is the one that answered", motion.get(enemy.id) !== null);
  ok("the prediction leads the current position", w.lock.predicted.x > enemy.pos.current.x,
     w.lock.predicted.x.toFixed(1) + " vs " + enemy.pos.current.x);
  ok("and carries the tracker's confidence", w.lock.confidence > 0 && w.lock.confidence <= 1,
     String(w.lock.confidence));
  ok("prediction is only handed out for the locked target", w.lock.predictedFor(mkPlayer(9, 0, 0)) === null);
  ok("prediction is handed out for the locked target", w.lock.predictedFor(enemy) === w.lock.predicted);
}

console.log("\nTargetLock — no engine yet: falls back rather than throwing");
{
  const me = mkPlayer(1, 0, 0);
  const enemy = mkPlayer(2, 100, 0, { vx: 10 });
  const w = mkClient(me, [enemy], [], 0);
  let threw = false;
  try { w.lock.postTick(); } catch (e) { threw = true; }
  ok("survives a client with no placement engine", !threw && w.lock.valid);
  ok("falls back to one tick of travel per lead tick", Math.abs(w.lock.predicted.x - 110) < 1e-6, w.lock.predicted.x);
}

console.log("\nTargetLock — scan cost");
{
  const me = mkPlayer(1, 0, 0);
  const a = mkPlayer(2, 100, 0);
  const b = mkPlayer(3, 200, 0);
  const w = mkClient(me, [a]);
  let checks = 0;
  const real = w.lock.isValidTarget.bind(w.lock);
  w.lock.isValidTarget = e => { checks++; return real(e); };

  w.lock.postTick();
  const afterFirst = checks;
  for (let i = 0; i < 60; i++) w.lock.postTick();      // 60 render frames, one tick
  ok("repeat calls inside one tick do no work at all", checks === afterFirst, "checks " + checks);

  w.client._ModuleHandler.tickCount = 1;
  checks = 0;
  w.lock.postTick();
  ok("one visible enemy: validate the held target, no candidate loop", checks === 1, "checks " + checks);

  w.client._ModuleHandler.tickCount = 2;
  w.client.PlayerManager.enemies = [a, b];
  checks = 0;
  w.lock.postTick();
  ok("two visible enemies: held target plus the one challenger", checks === 2, "checks " + checks);
}

console.log("\nTargetLock — disabled");
{
  const me = mkPlayer(1, 0, 0);
  const w = mkClient(me, [mkPlayer(2, 100, 0)]);
  Settings_default._targetLock = false;
  w.lock.postTick();
  ok("off means no ActiveTarget, the selectors fall back to nearestEnemy",
     w.lock.activeTarget() === null && w.lock.enabled === false);
  Settings_default._targetLock = true;
}

/* ------------------------------------------------------------- enclosure */
function mkFrame(me, target, objects, tick = 0) {
  return {
    tick,
    myPos: me.pos.current,
    target,
    targetPos: target.pos.current,
    targetScale: target.collisionScale,
    targetId: target.id,
    ourSpikes: [],
    ourTraps: []
  };
}
/* Ring of traps around the target with one real opening at gapAngle. */
function boxIn(ex, ey, gapAngle, ownerID = 1, radius = 90, n = 10) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = i * (Math.PI * 2 / n);
    let d = Math.abs(a - gapAngle) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < 1.2) continue;
    out.push(new PlayerObject(ex + radius * Math.cos(a), ey + radius * Math.sin(a), 15, ownerID, 32));
  }
  return out;
}

console.log("\nEnclosure — test geometry sanity");
{
  const ring = boxIn(160, 0, Math.PI);
  const esc = SiegeAnalysis.isEscapable(160, 0, 35, ring.map(o => ({
    x: o.pos.current.x, y: o.pos.current.y, escapeScale: o.collisionScale
  })));
  ok("the fixture really is a box with exactly one opening", esc.exits.length === 1, "exits " + esc.exits.length);
  ok("the opening faces where the fixture put it",
     esc.exits.length === 1 && GeometrySolver.angleDist(esc.exits[0].angle, Math.PI) < 0.3);
}

console.log("\nEnclosure — detection");
{
  const me = mkPlayer(1, 0, 0);
  const t = mkPlayer(2, 160, 0);
  const w = mkClient(me, [t], []);
  const e = new Engine(w.client);
  ok("open field is not an enclosure", e._encloseAround(mkFrame(me, t, [])) === null);
}
{
  const me = mkPlayer(1, 0, 0);
  const t = mkPlayer(2, 160, 0);
  const objs = [new PlayerObject(220, 0, 15, 1, 32), new PlayerObject(160, 90, 15, 1, 32)];
  const w = mkClient(me, [t], objs);
  const e = new Engine(w.client);
  ok("two traps beside the target is not an enclosure", e._encloseAround(mkFrame(me, t, objs)) === null);
}
{
  const me = mkPlayer(1, 0, 0);
  const t = mkPlayer(2, 160, 0);
  const objs = boxIn(160, 0, Math.PI);
  const w = mkClient(me, [t], objs);
  const e = new Engine(w.client);
  const enc = e._encloseAround(mkFrame(me, t, objs));
  ok("a real box is detected", enc !== null && enc.exits.length === 1, enc ? "exits " + enc.exits.length : "null");
  ok("the escape route is the opening", enc && enc.escapeExit !== null);
}

console.log("\nEnclosure — the escape route follows the target, not me");
{
  const me = mkPlayer(1, 0, 0);
  const t = mkPlayer(2, 160, 0);
  const objs = boxIn(160, 0, Math.PI);
  const w = mkClient(me, [t], objs);
  const e = new Engine(w.client);

  /* Standing still: the fallback is "away from me", which is +x here, while
   * the only opening is back toward me at pi. The opening still wins because
   * it is the only one, so the interesting assertion is the moving case. */
  const still = e._encloseAround(mkFrame(me, t, objs, 0));
  ok("a standing target still gets the only opening", still && still.escapeExit !== null);

  /* Give the tracker a course heading back toward me. */
  const e2 = new Engine(w.client);
  for (let tick = 0; tick <= 4; tick++) {
    t.pos.current._setXY(200 - tick * 10, 0);
    e2.motion.observe(t, tick);
  }
  t.pos.current._setXY(160, 0);
  const objs2 = boxIn(160, 0, Math.PI);
  const w2 = mkClient(me, [t], objs2);
  e2.client = w2.client;
  const moving = e2._encloseAround(mkFrame(me, t, objs2, 5));
  ok("a moving target's own heading is used",
     moving !== null && GeometrySolver.angleDist(moving.escapeExit.angle, Math.PI) < 0.5,
     moving ? moving.escapeExit.angle.toFixed(2) : "null");
}

console.log("\nEnclosure — ownership follows the game's own collision rule");
{
  const me = mkPlayer(1, 0, 0);
  const t = mkPlayer(2, 160, 0);

  const mine = boxIn(160, 0, Math.PI, 1);
  const w1 = mkClient(me, [t], mine);
  const b1 = new Engine(w1.client)._blockersAroundTarget(mkFrame(me, t, mine));
  ok("my traps are walls in the box", b1.length === mine.length, b1.length + " of " + mine.length);
  ok("my traps are read as mine", b1.every(b => b.mine === true));
  ok("my traps hold the target (checkCollision: owner != target)", b1.every(b => b.holdsTarget === true));

  /* A trap is ignoreCollision, so it only constrains someone who does not own
   * it. The target's own traps are ground it walks straight through, and the
   * box has to be read that way or every trapper looks enclosed by their own
   * kit. */
  const theirs = boxIn(160, 0, Math.PI, 2);
  const w2 = mkClient(me, [t], theirs);
  const b2 = new Engine(w2.client)._blockersAroundTarget(mkFrame(me, t, theirs));
  ok("the target's own traps are not part of its box at all", b2.length === 0, b2.length + " counted");

  /* Their spikes are not ignoreCollision, so those are walls whoever owns
   * them — which is what keeps the rule about traps from being a blanket
   * "ignore anything of theirs". */
  const spikes = boxIn(160, 0, Math.PI, 2).map(o => new PlayerObject(o.pos.current.x, o.pos.current.y, 4, 2, 32));
  const w3 = mkClient(me, [t], spikes);
  const b3 = new Engine(w3.client)._blockersAroundTarget(mkFrame(me, t, spikes));
  ok("their spikes are walls in the box", b3.length === spikes.length, b3.length + " of " + spikes.length);
  ok("their spikes are not mine", b3.every(b => b.mine === false));
  ok("and a spike does not hold anyone", b3.every(b => b.holdsTarget === false));
}

console.log("\nEnclosure — sealed box names the trap in the way");
{
  const me = mkPlayer(1, 0, 0);
  const t = mkPlayer(2, 160, 0);
  const objs = boxIn(160, 0, Math.PI);
  const plug = new PlayerObject(70, 0, 15, 1, 32);       // plugs the only opening
  objs.push(plug);
  const w = mkClient(me, [t], objs);
  const e = new Engine(w.client);

  const blockers = e._blockersAroundTarget(mkFrame(me, t, objs));
  ok("the fixture really is sealed", SiegeAnalysis.isEscapable(160, 0, 35, blockers).exits.length === 0);

  /* The target is breaking back toward me, which is where the plug sits.
   * The last sample has to be the frame's own tick and still be moving, or
   * the heading falls back to "away from me". */
  for (let tick = 0; tick <= 4; tick++) {
    t.pos.current._setXY(200 - tick * 10, 0);
    e.motion.observe(t, tick);
  }
  const enc = e._encloseAround(mkFrame(me, t, objs, 4));
  ok("a sealed box reports no openings to fill", enc !== null && enc.exits.length === 0);
  ok("and names the one trap of mine standing in the way they are going",
     enc && enc.breakCandidate !== null && enc.breakCandidate.trap === plug,
     enc && enc.breakCandidate ? "trap " + enc.breakCandidate.trap.id + " not the plug " + plug.id : "none");
  ok("with the opening it would create", enc.breakCandidate && enc.breakCandidate.exit);
  ok("published for the rest of the client", w.client._gapFillBreak === enc.breakCandidate);
  ok("never mutates the world / issues a break", w.OM.all.includes(plug));

  /* Two ring traps also open an exit when removed, but sideways to where the
   * target is going, so the escape-route gate is what makes the answer one
   * trap rather than whichever tied on distance. */
  const sideways = enc.blockers.filter(b => b.mine && b.obj !== plug && SiegeAnalysis.isEscapable(160, 0, 35, enc.blockers.filter(o => o !== b)).exits.length > 0);
  ok("other traps do open holes, they are just not the ones they want", sideways.length >= 1,
     sideways.length + " alternatives rejected");
}

console.log("\nEnclosure — layer off keeps the original narrower scan");
{
  const me = mkPlayer(1, 0, 0);
  const t = mkPlayer(2, 160, 0);
  const objs = boxIn(160, 0, Math.PI);
  const w = mkClient(me, [t], objs);
  const e = new Engine(w.client);
  Settings_default._trapGapFill = false;
  const frame = mkFrame(me, t, objs);
  frame.ourTraps = objs;                                        // the old code path's input
  const enc = e._encloseAround(frame);
  ok("still produces exits for the existing sealExit weight", enc !== null && enc.exits.length > 0);
  ok("but no escape route and no break analysis", enc.escapeExit === null && enc.breakCandidate === null);
  Settings_default._trapGapFill = true;
}

/* ------------------------------------------------------------------ wiring */
console.log("\nWiring — static checks on the built client");
{
  ok("the engine frame takes the locked target",
     built.includes("const target = lock && lock.enabled ? lock.activeTarget() : EnemyManager2.nearestEnemy;"));
  ok("AutoPlacer takes the same locked target",
     built.includes("const enemy = _lock && _lock.enabled ? _lock.activeTarget() : EnemyManager2.nearestEnemy;"));
  /* Two raw reads survive on purpose: AutoPlay is circle-strafe movement and
   * AntiTrapStar is a defensive placement of its own around me, not the
   * preplace / replace engine. Locking those would be modifying unrelated
   * systems. What matters is that no placement path still has one. */
  const rawReads = (built.match(/const (target|enemy) = EnemyManager2\.nearestEnemy;/g) || []).length;
  ok("only the two non-placement modules still read nearestEnemy directly", rawReads === 2, String(rawReads));
  ok("AutoPlay is one of them", /_autoPlay[\s\S]{0,900}?const enemy = EnemyManager2\.nearestEnemy;/.test(built));
  ok("AntiTrapStar is the other", /_antiTrapStar[\s\S]{0,3000}?const enemy = EnemyManager2\.nearestEnemy;/.test(built));
  ok("targetLock runs first in the module list",
     built.includes("this.modules = [ this.staticModules.targetLock, this.staticModules.autoAccept,"));
  ok("bookings are retired through the book's own path, not a made-up clear()",
     built.includes('this.book.invalidateAll("target-switch", this);') && !built.includes("this.book.clear()"));
  ok("the escape route reaches the scorer", built.includes("escapeExit: this._enclosure ? this._enclosure.escapeExit : null,"));
  ok("the scorer has a weight for it", built.includes("escapeRoute: 4.2,") && built.includes("escapeRouteHeld: 6.4,"));
  ok("the aim circle is drawn from the render loop",
     built.includes("this.drawAimLock(ctx, entity, player, isMyPlayer, ModuleHandler);"));
}

console.log("\nMenu — every input binds to a setting");
{
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
  ok(`all ${checked} menu inputs across ${pages.length} pages resolve to a setting`, unbound === 0, unbound + " unbound");
  for (const key of ["_targetLock", "_targetSwitchMargin", "_aimCircle", "_aimCircleColor", "_trapGapFill"]) {
    ok(key + " is a real setting", keys.has(key));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
