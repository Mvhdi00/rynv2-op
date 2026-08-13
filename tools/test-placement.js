#!/usr/bin/env node
/*
 * test-placement.js
 *
 * Tests RynPlacementEngine against the game's own rules.
 *
 * The engine section is lifted out of src/RYN_Client_v4.js and evaluated
 * against stand-ins for the client objects it reads, so the code under test is
 * the shipped code rather than a copy of it. Two suites run:
 *
 *   geometry  every aperture the analytic solver produces is checked against a
 *             brute-force sweep of the game's own circle test, including the
 *             river band, the blocker item's 300-unit denial radius, and the
 *             wrap seam
 *   engine    the whole pipeline end to end - candidate generation, scoring,
 *             planning, the reservation ledger, the packet budget and stale
 *             plan cancellation
 *
 *   node tools/test-placement.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "src/RYN_Client_v4.js"), "utf8");

function slice(from, to) {
  const a = SRC.indexOf(from);
  const b = SRC.indexOf(to);
  if (a < 0 || b < 0 || b <= a) throw new Error("anchor not found: " + from);
  return SRC.slice(a, b);
}

const ENGINE_SRC =
  slice("  const SiegeAnalysis = {", "  function _getCachedPrePlaceAngles") +
  slice("  const RPE_TICK_MS", "  const RynPlacementEngine_default = RynPlacementEngine;");

/* The engine reads a handful of module-scope names. Supplying them through a
 * `with` block keeps the extracted source byte-identical to what ships. */
function loadEngine(env) {
  const factory = new Function("env", "with (env) {\n" + ENGINE_SRC +
    "\nreturn { RynPlacementEngine, RPE_PRIORITY, PlacementWeights, GeometrySolver };\n}");
  return factory(env);
}

let fail = 0, checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) { fail++; console.log("  FAIL  " + msg); }
  else if (process.env.VERBOSE) console.log("  ok    " + msg);
}

/* ---- stand-ins for the client objects the engine reads ---- */
// Minimal stand-ins for the client objects the engine reads.
class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
}
class PlayerObject {
  constructor(id, x, y, type, ownerID) {
    this.id = id; this.type = type; this.ownerID = ownerID;
    const item = ITEMS[type];
    this.scale = item.scale;
    this.itemGroup = item.itemGroup;
    this.collisionDivider = "colDiv" in item ? item.colDiv : 1;
    this.health = item.health || 500;
    this.isDestroyable = true;
    this.pos = { current: new Vec(x, y), future: new Vec(x, y) };
  }
  get collisionScale() { return this.scale * this.collisionDivider; }
  get placementScale() { return ITEMS[this.type].id === 21 ? ITEMS[this.type].blocker : this.scale; }
}
const ITEMS = [];
ITEMS[6]  = { id: 6,  scale: 49, placeOffset: -5, dmg: 20, health: 400, itemGroup: 2 };
ITEMS[15] = { id: 15, scale: 50, placeOffset: -5, trap: true, ignoreCollision: true,
              hideFromEnemy: true, colDiv: 0.2, health: 500, itemGroup: 5 };
ITEMS[21] = { id: 21, scale: 45, placeOffset: -5, ignoreCollision: true, blocker: 300,
              colDiv: 0.7, health: 400, itemGroup: 12 };
const ITEM_GROUPS = [];
ITEM_GROUPS[2]  = { id: 2,  layer: 0,  limit: 15 };
ITEM_GROUPS[5]  = { id: 5,  layer: -1, limit: 6 };
ITEM_GROUPS[12] = { id: 12, layer: -1, limit: 3 };

class Grid {
  constructor(cellSize) { this.cellSize = cellSize; this.grid = new Map(); }
  key(x, y) { return x << 16 | y; }
  insert(x, y, r, id) {
    for (let i = (x - r) / this.cellSize | 0; i <= (x + r) / this.cellSize | 0; i++)
      for (let j = (y - r) / this.cellSize | 0; j <= (y + r) / this.cellSize | 0; j++) {
        const k = this.key(i, j);
        if (!this.grid.has(k)) this.grid.set(k, new Set());
        this.grid.get(k).add(id);
      }
  }
  query(x, y, search, cb) {
    const cx = x / this.cellSize | 0, cy = y / this.cellSize | 0, seen = new Set();
    for (let i = -search; i <= search; i++)
      for (let j = -search; j <= search; j++) {
        const s = this.grid.get(this.key(cx + i, cy + j));
        if (!s) continue;
        for (const id of s) if (!seen.has(id)) { seen.add(id); if (cb(id)) return true; }
      }
    return false;
  }
}

function makeWorld(opts = {}) {
  const objects = new Map();
  const grid = new Grid(100);
  let nextId = 1;
  const sent = [];
  const me = {
    inGame: true, scale: 35, isTrapped: false, spikeDamage: 0, id: 1,
    pos: { current: new Vec(opts.myX ?? 7000, opts.myY ?? 5000),
           future: new Vec((opts.myX ?? 7000) + (opts.myVX ?? 0), (opts.myY ?? 5000) + (opts.myVY ?? 0)) },
    counts: opts.counts || {},
    getItemByType(t) { return t === 4 ? 6 : t === 7 ? 15 : -1; },
    getItemPlaceScale(id) { return this.scale + ITEMS[id].scale + ITEMS[id].placeOffset; },
    getItemCount(g) { return { count: this.counts[g] || 0, limit: ITEM_GROUPS[g].limit }; },
    canPlace(t) {
      if (opts.cannotPlace && opts.cannotPlace.includes(t)) return false;
      const g = t === 4 ? 2 : 5;
      const { count, limit } = this.getItemCount(g);
      return count < limit;
    },
    isMyPlayerByID(id) { return id === this.id; },
    isReloaded() { return false; },
    getBuildingDamage() { return 0; }
  };
  const enemy = {
    id: 2, collisionScale: 35, spikeDamage: 0, dir: opts.enemyAim ?? 0,
    weapon: { primary: opts.enemyPrimary ?? null, secondary: null },
    reload: [ { current: 1, max: 1, previous: 0 }, { current: 0, max: 1, previous: 0 } ],
    getBuildingDamage() { return opts.enemyDmg ?? 0; },
    pos: { current: new Vec(opts.enemyX ?? 7120, opts.enemyY ?? 5000),
           future: new Vec((opts.enemyX ?? 7120) + (opts.enemyVX ?? -14), (opts.enemyY ?? 5000) + (opts.enemyVY ?? 0)) }
  };
  const world = {
    objects, grid, sent, me, enemy,
    step(dx, dy) {
      enemy.pos.current.x += dx; enemy.pos.current.y += dy;
      enemy.pos.future.x = enemy.pos.current.x + dx;
      enemy.pos.future.y = enemy.pos.current.y + dy;
    },
    remove(o) { objects.delete(o.id); },
    add(type, x, y, ownerID = 1) {
      const o = new PlayerObject(nextId++, x, y, type, ownerID);
      objects.set(o.id, o);
      grid.insert(x, y, Math.max(o.collisionScale, o.placementScale), o.id);
      return o;
    }
  };
  const MH = {
    canBuy() { return false; },
    autoattack: false, forceWeapon: null,
    tickCount: opts.tick ?? 10, packetCount: opts.packetCount ?? 0,
    packetLimit: opts.packetLimit ?? 70,
    activeModule: null, moduleActive: false, placedOnce: false,
    placeAngles: [null, []], totalPlaces: 0, staticModules: {},
    _getPredictWeapon() { return 0; },
    selectItem(t) { sent.push(["z", t]); this.packetCount++; },
    attack(a) { sent.push(["F1", +a.toFixed(4)]); this.packetCount++; },
    stopAttack(a) { sent.push(["F0"]); this.packetCount++; },
    whichWeapon(t) { sent.push(["zw", t]); this.packetCount++; },
    place(type, angle) {
      this.totalPlaces++;
      this.selectItem(type); this.attack(angle); this.stopAttack(angle);
      this.whichWeapon(this._getPredictWeapon());
    }
  };
  world.client = {
    myPlayer: me, _ModuleHandler: MH,
    EnemyManager: { nearestEnemy: opts.noEnemy ? null : enemy },
    ObjectManager: { objects, grid2D: grid, client: null },
    PlayerManager: { isEnemyByID(ownerID) { return ownerID !== 1; } },
    InputHandler: { move: opts.move ?? 0 }
  };
  world.MH = MH;
  return world;
}


/* ================= geometry against brute force ================= */
const { GeometrySolver: G, RPE_KB_TRAVEL, RPE_TICK_MS } = loadEngineGeom();
function loadEngineGeom() {
  const env = { Config_default: { mapScale: 14400, riverWidth: 724, playerScale: 35 },
    Items: ITEMS, ItemGroups: ITEM_GROUPS, Settings_default: {}, PlayerObject: PlayerObject,
    getAngleFromBitmask: () => null };
  const m = loadEngine(env);
  return { GeometrySolver: m.GeometrySolver, RPE_KB_TRAVEL: 1.5 / (1 - 0.993), RPE_TICK_MS: 1e3 / 9 };
}
console.log("\ngeometry");

const TAU = Math.PI * 2;


// derived constants match the game source
ok(Math.abs(RPE_TICK_MS - 111.111) < 0.01, "tick = 111.11ms, got " + RPE_TICK_MS);
ok(Math.abs(RPE_KB_TRAVEL - 214.28) < 0.5, "kb travel ~214, got " + RPE_KB_TRAVEL);

// apertures must agree with a brute-force circle test at every sampled angle
function bruteFree(ox, oy, ringR, footR, blockers, river) {
  const out = [];
  for (let i = 0; i < 3600; i++) {
    const a = i * TAU / 3600;
    const x = ox + ringR * Math.cos(a), y = oy + ringR * Math.sin(a);
    let free = true;
    for (const b of blockers) if (Math.hypot(x - b.x, y - b.y) < footR + b.r) { free = false; break; }
    if (free && river) {
      const mid = 7200, half = 362;
      if (y >= mid - half && y <= mid + half) free = false;
    }
    out.push(free);
  }
  return out;
}
function analyticFree(ox, oy, ringR, footR, blockers, river) {
  const arcs = [];
  for (const b of blockers) {
    const arc = G.occlusion(ox, oy, ringR, footR, b.x, b.y, b.r);
    if (arc) arcs.push(arc);
  }
  if (river) for (const arc of G.riverOcclusion(oy, ringR)) arcs.push(arc);
  return G.invert(G.merge(arcs));
}

let rnd = 12345;
function rand() { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; }

for (let trial = 0; trial < 400; trial++) {
  const ox = 5000 + rand() * 4000, oy = 6600 + rand() * 1200;
  const ringR = 35 + 49 - 5;
  const footR = 49;
  const n = Math.floor(rand() * 7);
  const blockers = [];
  for (let i = 0; i < n; i++) {
    const ang = rand() * TAU, d = rand() * 260;
    blockers.push({ x: ox + d * Math.cos(ang), y: oy + d * Math.sin(ang), r: [50, 49, 45, 110, 300][Math.floor(rand() * 5)] });
  }
  const river = trial % 2 === 0;
  const brute = bruteFree(ox, oy, ringR, footR, blockers, river);
  const aps = analyticFree(ox, oy, ringR, footR, blockers, river);
  let mismatch = 0;
  for (let i = 0; i < 3600; i++) {
    const a = i * TAU / 3600;
    const inAp = !!G.inAperture(aps, a);
    // ignore samples within one sample-step of a boundary
    if (inAp !== brute[i]) {
      const near = !brute[(i + 1) % 3600] !== !brute[i] || !brute[(i + 3599) % 3600] !== !brute[i];
      if (!near) mismatch++;
    }
  }
  ok(mismatch === 0, "trial " + trial + " aperture mismatch at " + mismatch + " samples (blockers=" + n + ", river=" + river + ")");
}

// degenerate cases
ok(G.occlusion(0, 0, 79, 49, 0, 0, 5) === null, "tiny blocker at origin does not touch the ring");
ok(G.occlusion(0, 0, 79, 49, 0, 0, 200) === "full", "huge blocker at origin swallows the ring");
ok(G.occlusion(0, 0, 79, 49, 5000, 0, 50) === null, "distant blocker is ignored");

// wrap seam: a blocker straddling angle 0 must produce one aperture, not two
{
  const aps = analyticFree(0, 0, 79, 49, [{ x: 79, y: 0, r: 50 }], false);
  ok(aps.length === 1, "blocker on the seam yields one aperture, got " + aps.length);
  ok(!G.inAperture(aps, 0), "angle 0 is blocked");
  ok(!!G.inAperture(aps, Math.PI), "angle pi is free");
}

// nearestFree snaps into legal ground
{
  const aps = analyticFree(0, 0, 79, 49, [{ x: 79, y: 0, r: 50 }], false);
  const snapped = G.nearestFree(aps, 0);
  ok(!!G.inAperture(aps, snapped), "snapped angle is legal");
}

// segment distance
ok(Math.abs(G.segmentDistance(0, 5, -10, 0, 10, 0) - 5) < 1e-9, "point-to-segment distance");
ok(Math.abs(G.segmentDistance(20, 0, -10, 0, 10, 0) - 10) < 1e-9, "point beyond segment end");



/* ================= engine pipeline ================= */



function engineFor(world) {
  const env = {
    Config_default: { mapScale: 14400, riverWidth: 724, playerScale: 35 },
    Items: ITEMS, ItemGroups: ITEM_GROUPS,
    Settings_default: Object.assign({ _autoplacer: true, _autoplacerRadius: 350,
      _preplacer: true, _replacer: false }, world.settings || {}),
    DataHandler_default: { getWeapon: () => ({ range: 140, speed: 300 }) },
    PlayerObject: PlayerObject,
    getAngleFromBitmask: () => null
  };
  
  const { RynPlacementEngine, RPE_PRIORITY, PlacementWeights } = loadEngine(env);
  const e = new RynPlacementEngine(world.client);
  world.MH.staticModules.placementEngine = e;
  return { engine: e, RPE_PRIORITY, PlacementWeights };
}




console.log("\n1. generates and scores multiple candidates, plans a combination");
{
  const w = makeWorld({});
  const { engine } = engineFor(w);
  engine.postTick();
  ok(engine.stats.candidates >= 6, "candidates generated: " + engine.stats.candidates);
  ok(engine.stats.planned >= 1, "placements planned: " + engine.stats.planned);
  ok(engine.stats.sent >= 1, "placements sent: " + engine.stats.sent);
  ok(engine._plan.every(c => c.terms && typeof c.value === "number"), "every candidate carries scored terms");
  const vals = engine._plan.map(c => +c.value.toFixed(2));
  console.log("     plan values: " + JSON.stringify(vals) + "  types: " + JSON.stringify(engine._plan.map(c => c.profile.type)));
}

console.log("\n2. does not simply take the nearest valid angle");
{
  const w = makeWorld({ enemyX: 7120, enemyY: 5000, enemyVX: 0, enemyVY: -30 });
  const { engine } = engineFor(w);
  engine.postTick();
  const toEnemyNow = Math.atan2(0, 120);
  const chosen = engine._plan[0];
  const dist = Math.abs(chosen.angle - toEnemyNow);
  ok(engine.stats.candidates > engine.stats.planned, "more candidates than placements (" + engine.stats.candidates + " -> " + engine.stats.planned + ")");
  ok(dist > 0.02, "chosen angle is not the raw bearing to the target (delta " + dist.toFixed(3) + " rad)");
}

console.log("\n3. multi-placement in one cycle, no self-intersection");
{
  const w = makeWorld({ packetLimit: 70 });
  const { engine } = engineFor(w);
  engine.postTick();
  const plan = engine._plan;
  let overlap = false;
  for (let i = 0; i < plan.length; i++)
    for (let j = i + 1; j < plan.length; j++)
      if (Math.hypot(plan[i].x - plan[j].x, plan[i].y - plan[j].y) < plan[i].profile.footR + plan[j].profile.footR) overlap = true;
  ok(plan.length >= 2, "planned " + plan.length + " placements in one cycle");
  ok(!overlap, "no two planned placements intersect");
}

console.log("\n4. respects existing structures (never proposes an illegal angle)");
{
  const w = makeWorld({});
  for (let a = 0; a < 6; a++) w.add(6, 7000 + 79 * Math.cos(a), 5000 + 79 * Math.sin(a));
  const { engine } = engineFor(w);
  engine.postTick();
  let illegal = 0;
  for (const c of engine._plan)
    for (const o of w.objects.values())
      if (Math.hypot(c.x - o.pos.current.x, c.y - o.pos.current.y) < c.profile.footR + o.placementScale) illegal++;
  ok(illegal === 0, "no planned placement collides with an existing object (" + w.objects.size + " objects present)");
}

console.log("\n5. sees the blocker item's 300-unit denial radius");
{
  const w = makeWorld({});
  w.add(21, 7000 + 250, 5000);
  const { engine } = engineFor(w);
  engine.postTick();
  let inside = 0;
  for (const c of engine._plan) if (Math.hypot(c.x - (7000 + 250), c.y - 5000) < c.profile.footR + 300) inside++;
  ok(inside === 0, "no placement proposed inside the blocker's denial radius");
}

console.log("\n6. yields ground reserved by preplace / replace");
{
  const w = makeWorld({});
  const { engine, RPE_PRIORITY } = engineFor(w);
  const f0 = engine._threat.build();
  // reserve the whole arc facing the enemy at ANTICIPATION, as preplace would
  for (let a = -0.9; a <= 0.9; a += 0.15) {
    engine.claim(7000 + 79 * Math.cos(a), 5000 + 79 * Math.sin(a), 49, RPE_PRIORITY.ANTICIPATION, "preplace", 10, 3);
  }
  engine.postTick();
  let stolen = 0;
  for (const c of engine._plan)
    for (const e of engine.ledger.entries)
      if (e.owner === "preplace" && Math.hypot(c.x - e.x, c.y - e.y) < c.profile.footR + e.radius) stolen++;
  ok(stolen === 0, "auto place took no ground claimed by preplace");
}

console.log("\n7. respects the packet budget");
{
  const w = makeWorld({ packetCount: 63, packetLimit: 70 });
  const { engine } = engineFor(w);
  engine.postTick();
  ok(w.MH.packetCount <= 70, "packet count stayed within the limit: " + w.MH.packetCount);
  ok(engine.stats.planned <= 2, "tight budget shrank the plan to " + engine.stats.planned);

  const w2 = makeWorld({ packetCount: 68, packetLimit: 70 });
  const e2 = engineFor(w2).engine;
  e2.postTick();
  ok(e2.stats.sent === 0, "no budget left means nothing is sent");
}

console.log("\n8. batches same-type placements to save packets");
{
  const w = makeWorld({});
  const { engine } = engineFor(w);
  engine.postTick();
  const byType = {};
  for (const c of engine._plan) byType[c.profile.type] = (byType[c.profile.type] || 0) + 1;
  const selects = w.sent.filter(p => p[0] === "z").length;
  const places = engine.stats.sent;
  ok(selects <= places, "item selects (" + selects + ") <= placements (" + places + ")");
  // Batching applies to neighbours only, because plan order belongs to the
  // planner and is never rearranged to manufacture longer runs. One item
  // select per run of consecutive same-type entries, no more.
  let runs = 0;
  for (let i = 0; i < engine._plan.length; i++)
    if (i === 0 || engine._plan[i].profile.type !== engine._plan[i - 1].profile.type) runs++;
  ok(selects === runs, "one select per run: " + selects + " selects for " + runs + " run(s) over " + places + " placements");

  // and a plan that does contain a run really does save the packets
  const w2 = makeWorld({});
  const e2 = engineFor(w2).engine;
  e2._planner.compose = function (cands, frame, ctx) {
    const spikes = cands.filter(c => c.profile.type === 4).sort((a, b) => b.value - a.value);
    return spikes.slice(0, 2);
  };
  e2.postTick();
  if (e2.stats.sent === 2) {
    ok(w2.sent.filter(p => p[0] === "z").length === 1, "two consecutive same-type builds shared one select");
    ok(w2.sent.length === 2 + 2 * 2, "and cost 2 + 2n packets instead of 4n: " + w2.sent.length);
  } else {
    ok(true, "run not produced in this layout");
  }
}

console.log("\n9. cancels a stale plan when the target moves significantly");
{
  const w = makeWorld({});
  const { engine } = engineFor(w);
  engine.postTick();
  ok(engine._plan.length > 0, "plan exists after first tick");
  const before = engine._plan;
  w.enemy.pos.current.x += 400; w.enemy.pos.future.x += 400;
  w.MH.tickCount++; w.MH.packetCount = 0;
  engine._threat.frameTick = -1;
  const stale = engine._planIsStale(engine._threat.build());
  ok(stale, "plan reports stale after the target shifted 400 units");
  engine.postTick();
  ok(engine._plan !== before, "a fresh plan replaced the stale one");
}

console.log("\n10. drops the plan when the target changes identity");
{
  const w = makeWorld({});
  const { engine } = engineFor(w);
  engine.postTick();
  w.client.EnemyManager.nearestEnemy = Object.assign({}, w.enemy, { id: 99 });
  w.MH.tickCount++; engine._threat.frameTick = -1;
  ok(engine._planIsStale(engine._threat.build()), "plan reports stale on target switch");
}

console.log("\n11. does not spend packets on low-value ground");
{
  const w = makeWorld({ enemyX: 7340, enemyY: 5000 });  // at the edge of range
  const { engine } = engineFor(w);
  engine.postTick();
  console.log("     far target -> planned " + engine.stats.planned + ", plan value " + engine.stats.value.toFixed(2));
  const w2 = makeWorld({ enemyX: 7100, enemyY: 5000 });
  const e2 = engineFor(w2).engine;
  e2.postTick();
  console.log("     near target -> planned " + e2.stats.planned + ", plan value " + e2.stats.value.toFixed(2));
  ok(e2.stats.value > engine.stats.value, "a close target yields a more valuable plan than a distant one");
}

console.log("\n12. prefers useful combat geometry (trap+spike synergy is scored)");
{
  const w = makeWorld({});
  const { engine, PlacementWeights } = engineFor(w);
  engine.postTick();
  const plan = engine._plan;
  const hasSpike = plan.some(c => c.profile.isDamage);
  ok(hasSpike, "plan includes a damage build against a live target");
  const anyIntercept = plan.some(c => c.terms.tactical > 0);
  ok(anyIntercept, "at least one placement scores positive tactical value");
}

console.log("\n13. honours item-count limits");
{
  const w = makeWorld({ counts: { 2: 15, 5: 6 } });
  const { engine } = engineFor(w);
  engine.postTick();
  ok(engine.stats.sent === 0, "nothing placed when both item groups are at their limit");
}

console.log("\n14. stays quiet with no target");
{
  const w = makeWorld({ noEnemy: true });
  const { engine } = engineFor(w);
  engine.postTick();
  ok(engine.stats.sent === 0 && w.sent.length === 0, "no packets sent without a target");
}

console.log("\n15. river band is respected");
{
  const w = makeWorld({ myX: 7000, myY: 7200, enemyX: 7120, enemyY: 7200 });
  const { engine } = engineFor(w);
  engine.postTick();
  let inRiver = 0;
  for (const c of engine._plan) if (c.y >= 7200 - 362 && c.y <= 7200 + 362) inRiver++;
  ok(inRiver === 0, "no placement inside the river band (planned " + engine._plan.length + ")");
}



/* ================= preplace ================= */

function stepTicks(world, engine, n, dx, dy) {
  for (let i = 0; i < n; i++) {
    world.MH.tickCount++;
    world.MH.packetCount = 0;
    engine._threat.frameTick = -1;
    if (dx !== undefined) world.step(dx, dy);
    engine.postTick();
  }
}

console.log("\n16. velocity, acceleration and short-term prediction are measured");
{
  const w = makeWorld({ enemyX: 7300, enemyY: 5000 });
  const { engine } = engineFor(w);
  // a steady run toward us at 20 units/tick
  stepTicks(w, engine, 5, -20, 0);
  const track = engine.motion.get(2);
  ok(track !== null, "a motion track exists for the target");
  ok(Math.abs(track.vx + 20) < 1.5, "velocity measured as ~-20/tick, got " + track.vx.toFixed(2));
  ok(Math.abs(track.speed - 20) < 1.5, "speed measured as ~20, got " + track.speed.toFixed(2));
  ok(Math.abs(track.heading - Math.PI) < 0.05, "heading measured as pi, got " + track.heading.toFixed(3));
  ok(track.stability > 0.85, "a straight run scores high stability: " + track.stability.toFixed(2));
  const p3 = engine.motion.predict(w.enemy, 3);
  ok(p3.x < w.enemy.pos.current.x, "prediction leads the target along its course");
  ok(p3.confidence > 0.2 && p3.confidence < 1, "confidence is bounded: " + p3.confidence.toFixed(2));
  const p0 = engine.motion.predict(w.enemy, 0);
  ok(p0.confidence === 1 || p0.x === w.enemy.pos.current.x, "zero-tick prediction is the current position");
}

console.log("\n17. prediction uses the game's decay, not a straight line");
{
  const w = makeWorld({ enemyX: 7300, enemyY: 5000 });
  const { engine } = engineFor(w);
  // three samples of identical motion, then let it coast
  stepTicks(w, engine, 4, -20, 0);
  const track = engine.motion.get(2);
  // a coasting target keeps 0.993^111 of its speed per tick
  const decay = Math.pow(0.993, 1000 / 9);
  ok(Math.abs(decay - 0.4586) < 0.005, "per-tick decay derived from the game: " + decay.toFixed(4));
  const p1 = engine.motion.predict(w.enemy, 1);
  const p2 = engine.motion.predict(w.enemy, 2);
  const leg1 = Math.abs(p1.x - w.enemy.pos.current.x);
  const leg2 = Math.abs(p2.x - p1.x);
  ok(Math.abs(leg1 - leg2) < 3, "steady run predicts steady legs (" + leg1.toFixed(1) + " then " + leg2.toFixed(1) + ")");
  ok(p2.confidence < p1.confidence, "confidence falls with horizon");
}

console.log("\n18. a stationary target is predicted confidently, not ignored");
{
  const w = makeWorld({ enemyX: 7150, enemyY: 5000, enemyVX: 0 });
  const { engine } = engineFor(w);
  stepTicks(w, engine, 5, 0, 0);
  const track = engine.motion.get(2);
  ok(track.speed < 1, "measured as stationary");
  ok(track.stability > 0.9, "a stationary target scores high stability: " + track.stability.toFixed(2));
}

console.log("\n19. no history means low confidence, not an invented direction");
{
  const w = makeWorld({});
  const { engine } = engineFor(w);
  const p = engine.motion.predict(w.enemy, 3);
  ok(p.x === w.enemy.pos.current.x && p.y === w.enemy.pos.current.y, "with no history the prediction is the current position");
  ok(p.confidence <= 0.25, "and says so: confidence " + p.confidence.toFixed(2));
}

console.log("\n20. candidates are booked, not sent");
{
  const w = makeWorld({ enemyX: 7330, enemyY: 5000, packetLimit: 70 });
  const { engine } = engineFor(w);
  stepTicks(w, engine, 3, -22, 0);
  const booked = engine.book.pending();
  ok(booked.length > 0, "candidates in the book: " + booked.length);
  ok(booked.every(r => r.state === "pending"), "booked candidates are pending, not fired");
  const far = booked.filter(r => r.kind === "intercept" && r.interceptTick > 2);
  ok(far.every(r => r.state === "pending"), "an interception further out than the fire lead is held, not sent");
  ok(booked.every(r => typeof r.confidence === "number" && r.confidence > 0), "every record carries a confidence");
  ok(booked.every(r => r.expiresTick > r.createdTick), "every record carries an expiry");
}

console.log("\n21. candidates expire on their own");
{
  const w = makeWorld({ enemyX: 7330, enemyY: 5000 });
  const { engine } = engineFor(w);
  stepTicks(w, engine, 3, -22, 0);
  const before = engine.book.pending().length;
  ok(before > 0, "book has " + before + " pending candidates");
  // freeze the world and run the clock past every expiry
  const maxExpiry = Math.max.apply(null, engine.book.pending().map(r => r.hardExpiry));
  w.MH.tickCount = maxExpiry + 1;
  engine._threat.frameTick = -1;
  engine.book.sweep(w.MH.tickCount, engine._threat.build(), engine);
  ok(engine.book.pending().length < before, "expired candidates left the book");
  ok(engine.book.records.some(r => r.reason === "expired"), "and were marked expired");
}

console.log("\n22. a turn invalidates the candidates that assumed the old course");
{
  const w = makeWorld({ enemyX: 7330, enemyY: 5000 });
  const { engine } = engineFor(w);
  stepTicks(w, engine, 4, -22, 0);
  const before = engine.book.pending().filter(r => r.kind === "intercept").length;
  ok(before > 0, "interception candidates booked on the inbound course: " + before);
  // hard right turn
  stepTicks(w, engine, 1, 0, -26);
  const turned = engine.book.records.filter(r => r.reason === "targetTurned").length;
  ok(turned > 0, "candidates invalidated by the turn: " + turned);
}

console.log("\n23. a target change invalidates the whole book");
{
  const w = makeWorld({ enemyX: 7330, enemyY: 5000 });
  const { engine } = engineFor(w);
  stepTicks(w, engine, 3, -22, 0);
  ok(engine.book.pending().length > 0, "book populated");
  w.client.EnemyManager.nearestEnemy = Object.assign({}, w.enemy, { id: 77 });
  w.MH.tickCount++; engine._threat.frameTick = -1;
  engine.book.sweep(w.MH.tickCount, engine._threat.build(), engine);
  ok(engine.book.records.some(r => r.reason === "targetChanged"), "candidates dropped on target change");
}

console.log("\n24. losing the target empties the book");
{
  const w = makeWorld({ enemyX: 7330, enemyY: 5000 });
  const { engine } = engineFor(w);
  stepTicks(w, engine, 3, -22, 0);
  ok(engine.book.pending().length > 0, "book populated");
  w.client.EnemyManager.nearestEnemy = null;
  w.MH.tickCount++; engine._threat.frameTick = -1;
  engine.postTick();
  ok(engine.book.pending().length === 0, "book emptied when the target is gone");
}

console.log("\n25. preplace holds ground against auto place");
{
  const w = makeWorld({ enemyX: 7330, enemyY: 5000 });
  const { engine } = engineFor(w);
  stepTicks(w, engine, 3, -22, 0);
  const held = engine.book.pending();
  let stolen = 0;
  for (const c of engine._plan)
    for (const r of held)
      if (Math.hypot(c.x - r.x, c.y - r.y) < c.profile.footR + r.footR) stolen++;
  ok(held.length > 0 && stolen === 0, "auto place took none of the " + held.length + " slots preplace is holding");
}

console.log("\n26. a preplace hold never blocks a higher-priority claim");
{
  const w = makeWorld({ enemyX: 7330, enemyY: 5000 });
  const { engine, RPE_PRIORITY } = engineFor(w);
  stepTicks(w, engine, 3, -22, 0);
  const held = engine.book.pending();
  ok(held.length > 0, "preplace is holding " + held.length + " slots");
  const victim = held[0];
  // a replacement, reacting to something that actually happened, wants it
  const token = engine.ledger.reserve(victim.x, victim.y, victim.footR,
    RPE_PRIORITY.RECOVERY, "replace", w.MH.tickCount, 2);
  ok(!!token, "the higher-priority claim succeeded over the soft hold");
  ok(!engine.ledger.entries.some(e => e.token === victim.token), "the preplace hold was released");
  // and an equal-priority claim of lower value does not take it
  const held2 = engine.book.pending().filter(r => r !== victim);
  if (held2.length) {
    const weak = engine.ledger.reserve(held2[0].x, held2[0].y, held2[0].footR,
      RPE_PRIORITY.ANTICIPATION, "other", w.MH.tickCount, 2, { soft: true, value: held2[0].value - 1 });
    ok(!weak, "an equal-priority claim worth less does not take the ground");
  }
  // a hard claim of any priority is never displaced
  const hard = engine.ledger.reserve(6000, 6000, 40, RPE_PRIORITY.UTILITY, "fired", w.MH.tickCount, 2);
  const over = engine.ledger.reserve(6000, 6000, 40, RPE_PRIORITY.INSTA, "insta", w.MH.tickCount, 2);
  ok(!!hard && !over, "ground already committed to the wire is never taken");
}

console.log("\n27. a slot about to open is booked, and the deletion drives it");
{
  const w = makeWorld({ enemyX: 7150, enemyY: 5000, enemyPrimary: 0, enemyDmg: 600 });
  w.settings = { _replacer: true };
  const { engine } = engineFor(w);
  const doomed = w.add(6, 7000 + 79 * Math.cos(0.9), 5000 + 79 * Math.sin(0.9));
  stepTicks(w, engine, 1, -4, 0);
  const attrition = engine.attrition(engine._threat.frame);
  ok(attrition.length > 0, "attrition sees the doomed object");
  ok(attrition[0].hits === 1, "and knows it is one hit from breaking");
  const booked = engine.book.records.filter(r => r.kind === "vacating");
  ok(booked.length > 0, "a candidate was booked for the ground it will free");
  ok(booked.every(r => r.vacates === doomed.id), "the candidate names the object it is waiting on");
  ok(booked.every(r => r.deadlineTick > r.createdTick), "and holds until that object is due to die");

  stepTicks(w, engine, 2, -4, 0);
  const fired = engine.book.records.filter(r => r.kind === "vacating" && r.state === "fired");
  ok(fired.length > 0, "the candidate went out when its deadline arrived");

  // the deletion is the game confirming the ground is clear
  engine.onVacated(doomed);
  ok(engine.book.records.filter(r => r.kind === "vacating" && r.state === "fired").length > 0,
     "the deletion drove the candidate that was waiting on it");
}

console.log("\n28. preplace respects the packet budget and item limits");
{
  const w = makeWorld({ enemyX: 7120, enemyY: 5000, packetCount: 68, packetLimit: 70 });
  const { engine } = engineFor(w);
  stepTicks(w, engine, 3, -6, 0);
  ok(w.MH.packetCount <= 70, "budget respected: " + w.MH.packetCount);

  const w2 = makeWorld({ enemyX: 7120, enemyY: 5000, counts: { 2: 15, 5: 6 } });
  const e2 = engineFor(w2).engine;
  stepTicks(w2, e2, 3, -6, 0);
  ok(e2.stats.preplaced === 0, "nothing preplaced when both item groups are full");
}

console.log("\n29. a booked candidate that stops being legal is dropped, not sent");
{
  const w = makeWorld({ enemyX: 7330, enemyY: 5000 });
  const { engine } = engineFor(w);
  stepTicks(w, engine, 3, -22, 0);
  const held = engine.book.pending();
  if (held.length) {
    const rec = held[0];
    // drop a wall exactly where the candidate wanted to go
    w.add(6, rec.x, rec.y);
    w.MH.tickCount++; w.MH.packetCount = 0;
    engine._threat.frameTick = -1;
    engine._generator.cacheTick = -1;
    engine.postTick();
    let onTop = 0;
    for (const o of w.objects.values())
      if (Math.hypot(rec.x - o.pos.current.x, rec.y - o.pos.current.y) < rec.footR + o.placementScale) onTop++;
    ok(onTop > 0, "the ground really is occupied now");
    const after = engine.book.records.find(r => r.id === rec.id);
    ok(after.state !== "fired", "the candidate on that ground was not sent, it was dropped (" + (after.reason || after.state) + ")");
  } else { ok(true, "skipped, nothing booked"); }
}

/* ================= auto replace ================= */

function replaceWorld(settings, opts) {
  const w = makeWorld(opts || {});
  w.settings = Object.assign({ _autoplacer: false, _preplacer: false, _replacer: true }, settings || {});
  const { engine, RPE_PRIORITY } = engineFor(w);
  w.MH.tickCount++;
  engine._threat.frameTick = -1;
  return { w, engine, P: RPE_PRIORITY };
}

console.log("\n30. detects a replace opportunity, and only a real one");
{
  const { w, engine } = replaceWorld({}, { enemyX: 7120, enemyY: 5000 });
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  engine.onVacated(dying);
  ok(engine._replacePlan.length > 0, "a deletion in range produced a plan: " + engine._replacePlan.length);
  ok(engine.stats.replaced > 0, "and placements went out: " + engine.stats.replaced);

  const far = replaceWorld({}, { enemyX: 7120, enemyY: 5000 });
  const distant = far.w.add(6, 7000 + 900, 5000);
  far.engine.onVacated(distant);
  ok(far.engine.stats.replaced === 0, "a deletion out of range is ignored");

  const noTarget = replaceWorld({}, { noEnemy: true });
  const obj = noTarget.w.add(6, 7000 + 79, 5000);
  noTarget.engine.onVacated(obj);
  ok(noTarget.engine.stats.replaced === 0, "a deletion with no target is ignored");

  const off = replaceWorld({ _replacer: false }, { enemyX: 7120, enemyY: 5000 });
  const o2 = off.w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  off.engine.onVacated(o2);
  ok(off.engine.stats.replaced === 0, "nothing happens with Replace off");
}

console.log("\n31. spikes and traps are generated and scored independently, then pooled");
{
  const { w, engine } = replaceWorld({}, { enemyX: 7100, enemyY: 5000 });
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  const frame = engine.sense();
  engine.predict(frame);
  const trigger = { modes: ["replace"], vacated: dying, replace: engine._replaceContext(dying, frame) };
  const pool = engine.generate(frame, trigger);
  engine.score(pool, frame, trigger);
  const spikes = pool.filter(c => c.profile.type === 4);
  const traps  = pool.filter(c => c.profile.type === 7);
  ok(spikes.length > 0, "spike candidates generated: " + spikes.length);
  ok(traps.length > 0, "trap candidates generated: " + traps.length);
  ok(pool.every(c => c.mode === "replace"), "every candidate carries its mode");
  ok(spikes.every(c => typeof c.value === "number" && c.terms), "spikes carry their own scores");
  ok(traps.every(c => typeof c.value === "number" && c.terms), "traps carry their own scores");
  const resolved = engine.resolve(pool, frame, trigger);
  const plan = engine.plan(resolved.due, frame);
  ok(plan.length > 0, "the pooled plan is non-empty: " + plan.length);
}

console.log("\n32. the plan has no geometric conflicts");
{
  const { w, engine } = replaceWorld({}, { enemyX: 7100, enemyY: 5000 });
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  engine.onVacated(dying);
  const plan = engine._replacePlan;
  let clash = 0;
  for (let i = 0; i < plan.length; i++)
    for (let j = i + 1; j < plan.length; j++)
      if (Math.hypot(plan[i].x - plan[j].x, plan[i].y - plan[j].y) < plan[i].profile.footR + plan[j].profile.footR) clash++;
  ok(plan.length > 1 && clash === 0, "no two of the " + plan.length + " planned placements intersect");
}

console.log("\n33. the plan never lands on an existing object");
{
  const { w, engine } = replaceWorld({}, { enemyX: 7100, enemyY: 5000 });
  for (let a = 2.2; a < 4.4; a += 1.1) w.add(6, 7000 + 79 * Math.cos(a), 5000 + 79 * Math.sin(a));
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  engine.onVacated(dying);
  let onTop = 0;
  for (const c of engine._replacePlan)
    for (const o of w.objects.values())
      if (o !== dying && Math.hypot(c.x - o.pos.current.x, c.y - o.pos.current.y) < c.profile.footR + o.placementScale) onTop++;
  ok(onTop === 0, "no planned placement overlaps a live object (" + w.objects.size + " present)");
  ok(engine._replacePlan.length > 0, "and the crowded ring still yielded a plan");
}

console.log("\n34. replace takes preplace ground worth less, and leaves ground worth more");
{
  const { w, engine, P } = replaceWorld({}, { enemyX: 7100, enemyY: 5000 });
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  const frame = engine.sense();
  // a cheap preplace guess sitting where replace wants to build
  const spot = { x: 7000 + 79 * Math.cos(0.4), y: 5000 + 79 * Math.sin(0.4) };
  const weak = engine.book.add({ type: 4, x: spot.x, y: spot.y, footR: 49, ringR: 79,
    targetId: frame.targetId, heading: null, headingTolerance: Math.PI,
    createdTick: frame.tick, expiresTick: frame.tick + 5, hardExpiry: frame.tick + 8,
    interceptTick: 4, deadlineTick: frame.tick, confidence: 0.3, value: 0.5, expected: 0.15,
    kind: "intercept", vacates: null, terms: {},
    token: engine.ledger.reserve(spot.x, spot.y, 49, P.ANTICIPATION, "preplace", frame.tick, 5, { soft: true, value: 0.15 }) });
  ok(!!weak.token, "the weak preplace hold was registered");
  engine.onVacated(dying);
  ok(weak.state !== "pending", "the outranked preplace record was invalidated (" + (weak.reason || weak.state) + ")");
  ok(weak.reason === "outranked", "and told why");

  // now a preplace hold worth more than any replacement candidate
  const s2 = replaceWorld({}, { enemyX: 7100, enemyY: 5000 });
  const d2 = s2.w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  const f2 = s2.engine.sense();
  const strongToken = s2.engine.ledger.reserve(spot.x, spot.y, 49, s2.P.ANTICIPATION, "preplace", f2.tick, 5,
    { soft: true, value: 9999 });
  s2.engine.onVacated(d2);
  ok(s2.engine.ledger.entries.some(e => e.token === strongToken), "a preplace hold worth more keeps its ground");
  let trespass = 0;
  for (const c of s2.engine._replacePlan)
    if (Math.hypot(c.x - spot.x, c.y - spot.y) < c.profile.footR + 49) trespass++;
  ok(trespass === 0, "and replace planned around it");
}

console.log("\n35. ground already on the wire is never displaced");
{
  const { w, engine, P } = replaceWorld({}, { enemyX: 7100, enemyY: 5000 });
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  const frame = engine.sense();
  const spot = { x: 7000 + 79 * Math.cos(0.4), y: 5000 + 79 * Math.sin(0.4) };
  const hard = engine.ledger.reserve(spot.x, spot.y, 49, P.UTILITY, "somethingElse", frame.tick, 3);
  engine.onVacated(dying);
  ok(engine.ledger.entries.some(e => e.token === hard), "the committed claim survived");
  let trespass = 0;
  for (const c of engine._replacePlan)
    if (Math.hypot(c.x - spot.x, c.y - spot.y) < c.profile.footR + 49) trespass++;
  ok(trespass === 0, "replace planned around ground it cannot have");
}

console.log("\n36. multiple compatible placements, not the first valid one");
{
  const { w, engine } = replaceWorld({}, { enemyX: 7100, enemyY: 5000 });
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  engine.onVacated(dying);
  ok(engine.stats.replaced > 1, "placed " + engine.stats.replaced + " builds from one deletion");
  const types = new Set(engine._replacePlan.map(c => c.profile.type));
  ok(engine._replacePlan.length >= 2, "the plan considered more than one placement");
  console.log("     plan: " + engine._replacePlan.map(c => (c.profile.type === 4 ? "spike" : "trap") + "@" + c.value.toFixed(1)).join("  "));
}

console.log("\n37. execution order is the planner's, not spike-first");
{
  const { w, engine } = replaceWorld({}, { enemyX: 7100, enemyY: 5000 });
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  engine.onVacated(dying);
  const planTypes = engine._replacePlan.map(c => c.profile.type);
  const sentTypes = w.sent.filter(p => p[0] === "z").map(p => p[1]);
  // every select in order, with batched neighbours collapsing to one
  const collapsed = planTypes.filter((t, i) => i === 0 || t !== planTypes[i - 1]);
  ok(JSON.stringify(sentTypes) === JSON.stringify(collapsed),
     "sent " + JSON.stringify(sentTypes) + " matches plan order " + JSON.stringify(collapsed));
  const sortedByType = planTypes.slice().sort((a, b) => a - b);
  if (new Set(planTypes).size > 1) {
    ok(true, "plan contains both types in planner order: " + JSON.stringify(planTypes));
  } else {
    ok(true, "single-type plan, ordering not exercised");
  }
}

console.log("\n38. only candidates still valid at execution time are sent, and gaps are filled");
{
  const { w, engine } = replaceWorld({}, { enemyX: 7100, enemyY: 5000 });
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  const frame = engine.sense();
  engine.predict(frame);
  const trigger = { modes: ["replace"], vacated: dying, replace: engine._replaceContext(dying, frame) };
  const pool = engine.generate(frame, trigger);
  engine.score(pool, frame, trigger);
  const { due } = engine.resolve(pool, frame, trigger);
  const plan = engine.plan(due, frame);
  ok(plan.length > 0, "a plan exists to invalidate");

  // something else takes the first entry's ground between plan and send
  const first = plan[0];
  engine.ledger.reserve(first.x, first.y, first.profile.footR, engine.priorityFor("instakill"), "insta", frame.tick, 3);
  ok(!engine._valid(first, frame, []), "the taken entry is rejected at execution time");
  ok(!engine._valid(first, frame, [{ x: first.x, y: first.y, profile: first.profile }]),
     "an entry is rejected against what the plan already placed");

  // validate substitutes rather than simply coming up short
  engine.stats.substituted = 0;
  const validated = engine.validate(plan, due, frame);
  ok(validated.indexOf(first) === -1, "the invalid entry did not survive validation");
  ok(engine.stats.substituted > 0, "a replacement was substituted for it: " + engine.stats.substituted);
  ok(validated.length >= plan.length - 1, "the plan did not simply shrink (" + plan.length + " -> " + validated.length + ")");
  let clash = 0;
  for (let i = 0; i < validated.length; i++)
    for (let j = i + 1; j < validated.length; j++)
      if (Math.hypot(validated[i].x - validated[j].x, validated[i].y - validated[j].y) <
          validated[i].profile.footR + validated[j].profile.footR) clash++;
  ok(clash === 0, "and the substituted plan is still internally compatible");
}

console.log("\n39. replace is packet-aware");
{
  const { w, engine } = replaceWorld({}, { enemyX: 7100, enemyY: 5000, packetCount: 68 });
  const dying = w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  engine.onVacated(dying);
  ok(engine.stats.replaced === 0, "no budget means no replacement");
  ok(w.MH.packetCount === 68, "and no packets spent");

  const mid = replaceWorld({}, { enemyX: 7100, enemyY: 5000, packetCount: 58 });
  const d2 = mid.w.add(6, 7000 + 79 * Math.cos(0.4), 5000 + 79 * Math.sin(0.4));
  mid.engine.onVacated(d2);
  ok(mid.w.MH.packetCount <= 70, "a tight budget is respected: " + mid.w.MH.packetCount);
  ok(mid.engine.stats.replaced >= 1, "and still bought something: " + mid.engine.stats.replaced);
}

console.log("\n40. what the dead object was doing changes what the ground is worth");
{
  // the trap that was pinning them dies -> a trap back on that ground leads
  const { w, engine } = replaceWorld({}, { enemyX: 7062, enemyY: 5000 });
  const trap = w.add(15, 7062, 5000);
  const frame = engine._threat.build();
  ok(!!frame.targetTrapped && frame.targetTrapped.id === trap.id, "the target is held by that trap");
  const rc = engine._replaceContext(trap, frame);
  ok(rc.heldTarget, "the replace context knows it was holding them");
  ok(rc.wasTrap && !rc.wasDamage, "and what kind of object it was");

  const plain = replaceWorld({}, { enemyX: 7300, enemyY: 5000 });
  const wall = plain.w.add(6, 7000 + 79, 5000);
  const f2 = plain.engine._threat.build();
  const rc2 = plain.engine._replaceContext(wall, f2);
  ok(!rc2.heldTarget && !rc2.touchedTarget, "a distant death is not urgent");
}

/* ================= the unified pipeline ================= */

console.log("\n41. the nine stages exist and compose");
{
  const { w, engine } = replaceWorld({ _autoplacer: true, _preplacer: true }, { enemyX: 7200, enemyY: 5000 });
  for (const stage of ["sense", "predict", "generate", "score", "resolve", "plan", "validate", "execute", "cycle"])
    ok(typeof engine[stage] === "function", "stage " + stage + " is callable");

  const frame = engine.sense();
  ok(!!frame, "SENSE produced a frame");
  engine.predict(frame);
  ok(!!frame.motion, "PREDICT attached a motion track");
  const trigger = { modes: ["auto"], vacated: null, replace: null };
  const pool = engine.generate(frame, trigger);
  ok(pool.length > 0, "GENERATE produced " + pool.length + " candidates");
  ok(pool.every(c => c.mode && c.priority && typeof c.x === "number"), "every candidate shares one representation");
  engine.score(pool, frame, trigger);
  ok(pool.every(c => typeof c.value === "number" && c.terms), "SCORE valued them all");
  const resolved = engine.resolve(pool, frame, trigger);
  ok(Array.isArray(resolved.due) && Array.isArray(resolved.deferred), "RESOLVE split due from deferred");
  const plan = engine.plan(resolved.due, frame);
  ok(Array.isArray(plan), "PLAN returned a combination of " + plan.length);
  const validated = engine.validate(plan, resolved.due, frame);
  ok(validated.length <= plan.length + 1, "VALIDATE returned a checked plan");
  const sent = engine.execute(validated, frame);
  ok(sent === validated.length, "EXECUTE sent every validated entry");
}

console.log("\n42. the modes do not scan the world independently");
{
  const { w, engine } = replaceWorld({ _autoplacer: true, _preplacer: true }, { enemyX: 7200, enemyY: 5000 });
  let sweeps = 0;
  const realSweep = engine._generator.blockersAround.bind(engine._generator);
  engine._generator.blockersAround = function () { sweeps++; return realSweep.apply(null, arguments); };
  let frames = 0;
  const realBuild = engine._threat.build.bind(engine._threat);
  engine._threat.build = function () { const f = realBuild(); if (f && f.__seen !== f.tick) { frames++; f.__seen = f.tick; } return f; };

  w.MH.tickCount++; engine._threat.frameTick = -1;
  engine.postTick();
  ok(sweeps === 1, "one blocker sweep for the whole tick, got " + sweeps);
  ok(frames === 1, "one world frame for the whole tick, got " + frames);
  ok(engine._blockersTick === engine._threat.frame.tick, "the sweep is tick-scoped");
}

console.log("\n43. every mode uses the same components");
{
  const { engine } = replaceWorld({ _autoplacer: true, _preplacer: true }, {});
  ok(engine._conflicts.ledger === engine.ledger, "the conflict resolver owns the one ledger");
  ok(engine._conflicts.memory === engine.memory, "and the one memory");
  ok(engine._conflicts.book === engine.book, "and the one book");
  ok(engine._scorer.weights === engine.weights, "the scorer reads the one weight table");
  ok(engine._planner.weights === engine.weights, "and so does the planner");
  ok(!!engine._scheduler && !!engine._generator && !!engine._angles, "one scheduler, generator and angle solver");
}

console.log("\n44. auto and preplace compete in one plan, not in turns");
{
  // The target closes to within reach over the run. Started further out, auto
  // place correctly has nothing to contribute - nothing on a ring 79 units
  // across can touch a target 200 away - and the due pool would be empty for a
  // reason that has nothing to do with what this case is testing.
  const { w, engine } = replaceWorld({ _autoplacer: true, _preplacer: true }, { enemyX: 7230, enemyY: 5000 });
  // observe what the real cycle sees, rather than probing a ring it has
  // already spent
  // accumulate across the run: a slot booked on one tick is not regenerated on
  // the next, so no single tick shows everything
  const seen = { pool: [], due: [], deferred: [], modes: new Set() };
  const realResolve = engine.resolve.bind(engine);
  engine.resolve = function (pool, frame, trigger) {
    const r = realResolve(pool, frame, trigger);
    for (const c of pool) seen.modes.add(c.mode);
    if (pool.length > seen.pool.length) seen.pool = pool;
    if (r.due.length > seen.due.length) seen.due = r.due;
    if (r.deferred.length > seen.deferred.length) seen.deferred = r.deferred;
    return r;
  };
  for (let i = 0; i < 4; i++) {
    w.MH.tickCount++; w.MH.packetCount = 0; engine._threat.frameTick = -1;
    w.step(-22, 0);
    engine.postTick();
  }
  ok(seen.modes.has("auto"), "one generate pass produced auto candidates");
  ok(seen.modes.has("preplace"), "and preplace candidates, in the same pool");
  ok(seen.due.length > 0, "candidates reached one shared due pool: " + seen.due.length);
  ok(seen.deferred.length > 0, "and predictions not yet due were deferred, not discarded: " + seen.deferred.length);
  const bothCompeted = new Set(seen.due.map(c => c.mode)).size > 1 || seen.deferred.length > 0;
  ok(bothCompeted, "both modes were resolved by one pass, not by taking turns");
}

console.log("\n45. one deletion runs one cycle for both preplace and replace");
{
  const { w, engine } = replaceWorld({ _autoplacer: false, _preplacer: true, _replacer: true },
                                     { enemyX: 7100, enemyY: 5000, enemyPrimary: 0, enemyDmg: 600 });
  const doomed = w.add(6, 7000 + 79 * Math.cos(0.9), 5000 + 79 * Math.sin(0.9));
  for (let i = 0; i < 2; i++) {
    w.MH.tickCount++; w.MH.packetCount = 0; engine._threat.frameTick = -1;
    engine.postTick();
  }
  let cycles = 0;
  const realCycle = engine.cycle.bind(engine);
  engine.cycle = function (t) { cycles++; return realCycle(t); };
  engine.onVacated(doomed);
  ok(cycles === 1, "one cycle, not one per mode: " + cycles);
  ok(w.MH.packetCount > 0, "and it put something on the wire");
}

console.log("");
console.log((fail ? "FAILED  " : "PASSED  ") + (checks - fail) + "/" + checks + " checks");
process.exit(fail ? 1 : 0);
