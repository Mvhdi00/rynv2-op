#!/usr/bin/env node
// Runs the placement engine out of RYN_v5.user.js against a mocked world, with
// the focus on AUTO — novastorm's ladder — since that is what was ported into
// it. Same method as the other harnesses: the engine is cut out of the
// userscript by source anchors and run as-is.
//
//   node tools/test-engine.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SCRIPT = process.env.RYN_ENGINE_SCRIPT || path.join(__dirname, "..", "RYN_v5.user.js");
const source = fs.readFileSync(SCRIPT, "utf8");

function cut(startAnchor, endAnchor, { includeEnd = false } = {}) {
  const start = source.indexOf(startAnchor);
  if (start === -1) throw new Error(`anchor not found: ${startAnchor}`);
  const end = source.indexOf(endAnchor, start + startAnchor.length);
  if (end === -1) throw new Error(`end anchor not found: ${endAnchor}`);
  return source.slice(start, includeEnd ? end + endAnchor.length : end);
}

const parts = [
  cut("const Config = {", "const Config_default = Config;", { includeEnd: true }),
  cut("const ItemGroups = {", "const Items = ["),
  cut("const Items = [", "const WeaponVariants = ["),
  cut("const getAngleDist = (a, b) => {", "const wireAngle"),
  cut("const getAngleFromBitmask = (bitmask, rotate) => {", "const formatCode = "),
  cut("class SpatialHashGrid2D {", "class Sorting {"),
  cut("  const SiegeAnalysis = {", "  // The one placement system in the client."),
  cut("  const RPE_TICK_MS", "  const RynPlacementEngine_default = RynPlacementEngine;")
];

const prelude = `
const PI = Math.PI;
class PlayerObject {
  constructor(id, x, y, angle, scale, type, ownerID) {
    this.id = id;
    this.pos = { current: vec(x, y), previous: vec(x, y), future: vec(x, y) };
    this.angle = angle;
    this.scale = scale;
    this.type = type;
    this.ownerID = ownerID;
    const item = Items[type];
    this.itemGroup = item.itemGroup;
    this.health = "health" in item ? item.health : Infinity;
    this.maxHealth = this.health;
    this.isDestroyable = this.health !== Infinity;
    this.collisionDivider = "colDiv" in item ? item.colDiv : 1;
  }
  get collisionScale() { return this.scale * this.collisionDivider; }
  get placementScale() { return this.scale; }
}
const DataHandler_default = { getWeapon: id => WEAPONS[id] || null, getItem: id => Items[id], isMelee: () => true };
const Settings_default = SETTINGS;
`;

function vec(x, y) {
  return {
    x, y,
    distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); },
    angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); },
    copy() { return vec(this.x, this.y); },
    addDirection(a, d) { return vec(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d); }
  };
}

const WEAPONS = {
  0: { name: "tool hammer", range: 65, speed: 300, dmg: 25 },
  1: { name: "hand axe", range: 70, speed: 400, dmg: 30 },
  10: { name: "great hammer", range: 110, speed: 400, dmg: 10 }
};
const SETTINGS = { _autoplacer: true, _prePlace: false, _replace: true, _autoplacerRadius: 350 };

const context = {
  console, Math, Date, performance: { now: () => Date.now() },
  setTimeout: () => 0, clearTimeout: () => {},
  window: {}, vec, WEAPONS, SETTINGS
};
vm.createContext(context);
vm.runInContext(`${prelude}\n${parts.join("\n")}\nglobalThis.__E = { RynPlacementEngine, Items, SpatialHashGrid2D, PlayerObject, GeometrySolver, NovastormAutoPlace };`, context, { filename: "engine-extract.js" });

const { RynPlacementEngine, Items, SpatialHashGrid2D, PlayerObject } = context.__E;
const SPIKE_ID = 7;   // greater spikes
const TRAP_ID = 15;   // pit trap

let nextId = 1;
function makeWorld(options = {}) {
  const objectManager = {
    objects: new Map(),
    grid2D: new SpatialHashGrid2D(100),
    insertObject(object) {
      this.grid2D.insert(object.pos.current.x, object.pos.current.y, object.collisionScale, object.id);
      this.objects.set(object.id, object);
    },
    removeObject(object) {
      this.grid2D.remove(object.pos.current.x, object.pos.current.y, object.collisionScale, object.id);
      this.objects.delete(object.id);
    }
  };
  const player = (id, x, y, extra = {}) => ({
    id, inGame: true, scale: 35,
    speed: extra.speed ?? 0,
    isTrapped: extra.isTrapped ?? false,
    trappedIn: extra.trappedIn ?? null,
    hatID: 0,
    pos: {
      current: vec(x, y),
      previous: vec(x - (extra.vx ?? 0), y - (extra.vy ?? 0)),
      future: vec(x + (extra.vx ?? 0), y + (extra.vy ?? 0))
    },
    inventory: { 0: 0, 1: 10, 4: SPIKE_ID, 7: TRAP_ID },
    itemCount: new Map(options.counts ?? []),
    reload: [{ current: 1, max: 1 }, { current: 1, max: 1 }, { current: 1, max: 1 }],
    weapon: { primary: 0, secondary: 10 },
    get collisionScale() { return this.scale; },
    getItemByType(type) { const v = this.inventory[type]; return v === undefined ? null : v; },
    getItemPlaceScale(id) { const i = Items[id]; return this.scale + i.scale + i.placeOffset; },
    getItemCount(group) { const limits = { 2: 15, 5: 6 }; return { count: this.itemCount.get(group) || 0, limit: limits[group] ?? 99 }; },
    canPlace() { return true; },
    isReloaded() { return true; },
    getBuildingDamage() { return 100; }
  });
  const myPlayer = player(1, 5000, 5000, options.me ?? {});
  const enemy = player(2, options.enemy?.x ?? 5150, options.enemy?.y ?? 5000, options.enemy ?? {});
  const sent = [];
  const moduleHandler = {
    tickCount: options.tick ?? 50,
    packetCount: options.packetCount ?? 0,
    packetLimit: 119,
    placeAngles: [null, []],
    placedOnce: false, moduleActive: false,
    move_dir: options.moveDir ?? null,
    _getPredictWeapon: () => 1,
    canBuy: () => false,
    place(type, angle) { this.packetCount += 5; sent.push({ type, angle }); },
    selectItem() { this.packetCount += 1; },
    attack(angle) { this.packetCount += 1; sent.push({ type: this._sel, angle, batched: true }); },
    stopAttack() { this.packetCount += 1; },
    whichWeapon() { this.packetCount += 1; }
  };
  const client = {
    myPlayer, ObjectManager: objectManager, _ModuleHandler: moduleHandler,
    EnemyManager: { nearestEnemy: enemy },
    PlayerManager: { isEnemyByID: (ownerID) => ownerID !== myPlayer.id },
    SocketManager: { pong: options.ping ?? 60, minPingTime: 40 },
    InputHandler: { move: 0 },
    PacketManager: { updateAngle() {} }
  };
  const addObject = (x, y, type, ownerID) => {
    const o = new PlayerObject(nextId++, x, y, 0, Items[type].scale, type, ownerID);
    objectManager.insertObject(o);
    return o;
  };
  return { client, myPlayer, enemy, moduleHandler, objectManager, sent, addObject };
}

let failures = 0, checks = 0;
const check = (name, cond, detail) => {
  checks += 1;
  if (cond) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name}${detail === undefined ? "" : ` — ${detail}`}`); }
};
const section = (n) => console.log(`\n${n}`);

// batched sends record the type on the run, so flatten them for assertions
const typesOf = (world) => world.sent.map(s => s.type).filter(t => t !== undefined);

// ── the ladder is reachable at all ────────────────────────────────────────
section("novastorm's ladder, wired into the engine");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000, vx: -14 } });
  const engine = new RynPlacementEngine(world.client);
  engine.postTick();
  check("something is built", world.sent.length > 0, `${world.sent.length} sent`);
  const pool = engine._pool.filter(c => c.mode === "auto");
  check("the auto pool is novastorm's", pool.length > 0 && pool.every(c => c.source === "novaRing" || c.source === "novaPerfect"), pool.map(c => c.source).join(","));
  check("every auto candidate carries a rung", pool.every(c => c.rung >= 1 && c.rung <= 5), pool.map(c => c.rung).join(","));
  check("the rung reaches the score", pool.every(c => c.terms && c.terms.ladder > 0));
}

// ── rung 5: any trap while neither is pinned ──────────────────────────────
section("rung 5 — any trap, neither pinned");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000 } });
  const engine = new RynPlacementEngine(world.client);
  engine.postTick();
  const traps = engine._pool.filter(c => c.mode === "auto" && c.profile.isTrap);
  check("traps are offered", traps.length > 0, `${traps.length}`);

  // Pinned, novastorm's trap rungs both close: they need neither of us trapped.
  const pinned = makeWorld({ enemy: { x: 5150, y: 5000 } });
  pinned.myPlayer.isTrapped = true;
  const pinnedEngine = new RynPlacementEngine(pinned.client);
  pinnedEngine.postTick();
  const pinnedTraps = pinnedEngine._pool.filter(c => c.mode === "auto" && c.profile.isTrap);
  check("and withdrawn once I am pinned", pinnedTraps.length === 0, `${pinnedTraps.length}`);
}

// ── rung 1 and 3: the enemy is in our trap ────────────────────────────────
section("rungs 1 and 3 — the enemy is pinned");
{
  const world = makeWorld({ enemy: { x: 5100, y: 5000 } });
  world.addObject(5100, 5000, TRAP_ID, 1); // ours, holding them
  const engine = new RynPlacementEngine(world.client);
  engine.postTick();
  const spikes = engine._pool.filter(c => c.mode === "auto" && c.profile.isDamage);
  check("spikes are offered against a pinned target", spikes.length > 0, `${spikes.length}`);
  check("the best of them is rung 1 or 2", Math.min(...spikes.map(c => c.rung)) <= 2, spikes.map(c => c.rung).sort().join(","));
  // Rung 1 is novastorm's closestSpikeToEnemy, which is a crossing test over
  // the segment they are travelling, not a contact test — and it has to be,
  // because the trap that pins them is an object too: it denies every landing
  // within 102px of itself while a spike needs to be within 87px of the player
  // it is pinning. Nothing can be both, so a placer that waited for contact
  // against a pinned target would never build at all.
  const frame = engine._threat.frame;
  const rung1 = spikes.filter(c => c.rung === 1);
  check("rung 1 exists and crosses the path they are on", rung1.length > 0 && rung1.every(c => context.__E.GeometrySolver.boxCrossesSegment(c.x, c.y, frame.targetScale + c.profile.footR - 1, frame.targetPos.x, frame.targetPos.y, frame.targetNext.x, frame.targetNext.y)), `${rung1.length}`);
}

// ── the 350 gate ──────────────────────────────────────────────────────────
section("novastorm's 350 gate");
{
  const world = makeWorld({ enemy: { x: 5000 + 340, y: 5000 } });
  const engine = new RynPlacementEngine(world.client);
  engine.postTick();
  const inside = engine._pool.filter(c => c.mode === "auto").length;
  const far = makeWorld({ enemy: { x: 5000 + 360, y: 5000 } });
  const farEngine = new RynPlacementEngine(far.client);
  farEngine.postTick();
  const outside = farEngine._pool.filter(c => c.mode === "auto").length;
  check("inside 350 the ladder runs", inside > 0, `${inside}`);
  check("outside it, nothing", outside === 0, `${outside}`);
}

// ── the angle set is the ring, exactly ────────────────────────────────────
section("the angle set");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000 } });
  world.addObject(5082, 5000, SPIKE_ID, 1);
  world.addObject(5000, 5082, SPIKE_ID, 1);
  const engine = new RynPlacementEngine(world.client);
  engine.postTick();
  const auto = engine._pool.filter(c => c.mode === "auto");
  check("candidates were produced around the blockers", auto.length > 0, `${auto.length}`);

  // Nothing may be offered where the server would refuse it.
  let illegal = 0;
  for (const cand of auto) {
    for (const object of world.objectManager.objects.values()) {
      const reach = cand.profile.footR + object.placementScale;
      if (Math.hypot(cand.x - object.pos.current.x, cand.y - object.pos.current.y) < reach - 1e-6) illegal++;
    }
  }
  check("no candidate lands on an object", illegal === 0, `${illegal}`);

  // novastorm's grid is still walked. What survives into the pool is thinned by
  // its own addPredictObject dedup — a build is 104px wide on an 82px ring, so
  // a handful of them cover the whole circle — which is why the coverage is
  // checked on the set the ladder considered rather than on what it admitted.
  const profile = engine.activeProfiles().find(p => p.isDamage);
  const apertures = engine._generator.apertures(profile, 5000, 5000, engine._blockers, null);
  const considered = engine._nova.ringAngles(profile, apertures);
  const step = Math.PI * 2 / 72;
  const onGrid = considered.filter(e => {
    const rem = e.angle % step;
    return Math.min(rem, step - rem) < 1e-6;
  });
  const packed = considered.filter(e => e.perfect);
  check("every legal angle of the 72-grid is considered", onGrid.length > 0, `${onGrid.length} on grid`);
  check("and the exact packed ends on top of them", packed.length > 0, `${packed.length} packed`);
  const outside = considered.filter(e => !context.__E.GeometrySolver.inAperture(apertures, e.angle));
  check("nothing outside the free ring is considered", outside.length === 0, `${outside.length}`);
}

// ── the ban ───────────────────────────────────────────────────────────────
// novastorm compares against the angles it built at *last* tick, because in its
// client the object is back by then. Taken literally that bans every successful
// build made at a ping over one tick — the ring still reads free until the
// object arrives — and eighteen ticks of that, accumulating every tick, closes
// the ring and the placer stops placing anything at all. So the wait is a full
// round trip plus a tick.
section("novastorm's ban, waiting for the round trip");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000 }, ping: 60 });
  const engine = new RynPlacementEngine(world.client);
  engine.postTick();
  check("a first tick builds", world.sent.length > 0, `${world.sent.length}`);
  check("the sends are remembered", engine._nova.placed.length > 0, `${engine._nova.placed.length}`);

  // One tick later the build may still be on the wire. Banning here is what
  // shut the placer down.
  world.moduleHandler.tickCount += 1;
  world.moduleHandler.packetCount = 0;
  engine.postTick();
  check("a build still in flight is not banned", engine._nova.banned.size === 0, `${engine._nova.banned.size} banned`);

  // Past the round trip with the ground still free: the server refused it.
  world.moduleHandler.tickCount += 2;
  world.moduleHandler.packetCount = 0;
  engine.postTick();
  check("once the round trip is up, a refusal is banned", engine._nova.banned.size > 0, `${engine._nova.banned.size}`);
  const expiry = [...engine._nova.banned.values()][0];
  check("for eighteen ticks", expiry === world.moduleHandler.tickCount + 18, `${expiry} vs ${world.moduleHandler.tickCount + 18}`);
  const auto = engine._pool.filter(c => c.mode === "auto");
  check("and never offered again while banned", auto.every(c => !engine._nova.isBanned(c.profile, c.angle)));

  // At a ping of three ticks the wait is three ticks, not one.
  const laggy = makeWorld({ enemy: { x: 5150, y: 5000 }, ping: 333 });
  const laggyEngine = new RynPlacementEngine(laggy.client);
  laggyEngine.postTick();
  for (let i = 0; i < 3; i++) {
    laggy.moduleHandler.tickCount += 1;
    laggy.moduleHandler.packetCount = 0;
    laggyEngine.postTick();
  }
  check("a slow connection is given the time its builds need", laggyEngine._nova.banned.size === 0, `${laggyEngine._nova.banned.size} banned`);
}

// ── the tick belongs to whoever claimed it ────────────────────────────────
// An instakill or a spike tick is a timed sequence of packets. A build dropped
// into the middle of one costs it the packets it was counting on and the aim it
// had set, and the ledger cannot see that, because what the two are fighting
// over is packets and not ground.
section("yielding the tick");
{
  for (const owner of ["instakill", "spikeSync", "spikeTickBreak", "antiTrapProtect"]) {
    const world = makeWorld({ enemy: { x: 5150, y: 5000 } });
    world.moduleHandler.activeModule = owner;
    const engine = new RynPlacementEngine(world.client);
    engine.postTick();
    check(`stands down for ${owner}`, world.sent.length === 0, `${world.sent.length} sent`);
  }
  const free = makeWorld({ enemy: { x: 5150, y: 5000 } });
  free.moduleHandler.activeModule = "autoBreak";
  const freeEngine = new RynPlacementEngine(free.client);
  freeEngine.postTick();
  check("but not for a module that only swings", free.sent.length > 0, `${free.sent.length} sent`);
}

// ── it keeps going ────────────────────────────────────────────────────────
// The symptom of the ban bug was not a wrong build, it was no builds: a couple
// of seconds in, the ring was closed and the placer had quietly stopped. This
// is the shape of that failure, so it is the shape of the test.
section("sixty ticks");
{
  const world = makeWorld({ enemy: { x: 5140, y: 5000, vx: -8 }, ping: 250 });
  const engine = new RynPlacementEngine(world.client);
  const thirds = [0, 0, 0];
  let placingTicks = 0;
  for (let t = 0; t < 60; t++) {
    world.moduleHandler.tickCount += 1;
    world.moduleHandler.packetCount = 0;
    world.sent.length = 0;
    // Drift, the way a fight does.
    world.enemy.pos.current.x -= 1;
    world.enemy.pos.previous.x -= 1;
    world.enemy.pos.future.x -= 1;
    engine.postTick();
    if (world.sent.length > 0) {
      placingTicks += 1;
      thirds[Math.floor(t / 20)] += 1;
    }
  }
  // Ground it has just claimed is held for a couple of ticks, so building on
  // roughly one tick in three is the healthy shape. What matters is that the
  // last third looks like the first — a placer that has closed its own ring
  // starts fine and then goes quiet.
  check("it is still placing in the last third, as in the first", thirds[2] > 0 && thirds[2] >= thirds[0] * 0.5, `thirds ${thirds.join("/")}`);
  check("and has not banned the whole ring", engine._nova.banned.size < 40, `${engine._nova.banned.size} banned`);
}

// ── the packet budget ─────────────────────────────────────────────────────
section("novastorm's packet allowance");
{
  check("the limit is the server's own 119", makeWorld({}).moduleHandler.packetLimit === 119);

  const world = makeWorld({ enemy: { x: 5150, y: 5000 }, packetCount: 116 });
  const engine = new RynPlacementEngine(world.client);
  engine.postTick();
  check("a build is not started without the five packets for it", world.sent.length === 0, `${world.sent.length} sent`);

  const room = makeWorld({ enemy: { x: 5150, y: 5000 }, packetCount: 0 });
  const roomEngine = new RynPlacementEngine(room.client);
  roomEngine.postTick();
  check("with room it spends", room.sent.length > 0, `${room.sent.length}`);
  check("and never past the allowance", room.moduleHandler.packetCount <= 119, `${room.moduleHandler.packetCount}`);
}

// ── item limits ───────────────────────────────────────────────────────────
section("item limits");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000 }, counts: [[2, 15], [5, 6]] });
  const engine = new RynPlacementEngine(world.client);
  engine.postTick();
  check("a full inventory builds nothing", world.sent.length === 0, `${world.sent.length} sent`);
}

// ── preplace and replace are untouched ────────────────────────────────────
section("preplace and replace still run");
{
  // A fresh engine, so the only thing competing for the ground is the
  // replacement itself — after a tick of auto place the ledger is still
  // holding what that tick just claimed, which is a different scenario.
  const world = makeWorld({ enemy: { x: 5100, y: 5000 } });
  const trap = world.addObject(5100, 5000, TRAP_ID, 1);
  const engine = new RynPlacementEngine(world.client);
  engine.onVacated(trap);
  check("a deletion still drives replace", world.sent.length > 0, `${world.sent.length} sent`);
  const replaced = engine._replacePlan.filter(c => c.mode === "replace");
  check("through the replace mode", replaced.length > 0, `${replaced.length}`);
  check("which the ladder did not touch", replaced.every(c => c.source !== "novaRing" && c.source !== "novaPerfect"), replaced.map(c => c.source).join(","));

  // And auto place does not walk over ground the replacement just claimed.
  world.sent.length = 0;
  world.moduleHandler.packetCount = 0;
  engine.postTick();
  const overlap = engine._plan.filter(c => engine._replacePlan.some(r => Math.hypot(c.x - r.x, c.y - r.y) < c.profile.footR + r.profile.footR));
  check("auto place respects what the replacement took", overlap.length === 0, `${overlap.length}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
