#!/usr/bin/env node
/*
 * bench-placement.js
 *
 * Measures placement systems against identical controlled scenarios.
 *
 * This is a measurement tool, not a verdict. Every number below is produced by
 * a neutral evaluator that applies the game's own rules from src/game_index.js
 * to whatever each system emitted; no system scores itself, and no system is
 * ranked. Where a system does not do a thing at all, the cell reads "-" rather
 * than a zero, because absent and zero are different facts.
 *
 * The systems under test are extracted from real client sources at runtime and
 * run as their authors wrote them. Nothing here is a reimplementation.
 *
 *   RYN       src/RYN_Client_v4.js         full pipeline: candidates -> plan -> send
 *   Luna      src/Luna_Client_1.1.js       full auto placer: 72-probe -> ladders -> send
 *   Auraro    auraro_5.5.txt               arc solver only (its auto placer is
 *                                          unfinished by its own comment)
 *   Whiteout  Whiteout_v4.js               candidate generator only (its grader
 *                                          did not isolate; see NOTES)
 *
 * Whiteout and Auraro are not in this repository. Point --clients at a
 * directory holding them to include them; without it they are skipped and said
 * to be skipped.
 *
 *   node tools/bench-placement.js
 *   node tools/bench-placement.js --clients=/path/to/sources
 *   node tools/bench-placement.js --json
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const CLIENT_DIR = (args.find(a => a.startsWith("--clients=")) || "").slice(10) ||
  "/root/.claude/uploads/6ee81955-9a08-5c94-91f9-4175f21312af";
const AS_JSON = args.includes("--json");
const ITERATIONS = 60;

/* ------------------------------------------------------------------ *
 * Ground truth, lifted from the shipped game bundle
 * ------------------------------------------------------------------ */

const GAME = {
  playerScale: 35,
  mapScale: 14400,
  riverWidth: 724,
  gatherAngle: Math.PI / 2.6,
  serverUpdateRate: 9,
  playerDecel: 0.993
};
const TICK_MS = 1000 / GAME.serverUpdateRate;

/* item table, verbatim values from the game's item list */
const ITEMS = [];
ITEMS[6]  = { id: 6,  scale: 49, placeOffset: -5, dmg: 20,  health: 400, itemGroup: 2, name: "spikes" };
ITEMS[15] = { id: 15, scale: 50, placeOffset: -5, trap: true, ignoreCollision: true, hideFromEnemy: true,
              colDiv: 0.2, health: 500, itemGroup: 5, name: "pit trap" };
ITEMS[21] = { id: 21, scale: 45, placeOffset: -5, ignoreCollision: true, blocker: 300,
              colDiv: 0.7, health: 400, itemGroup: 12, name: "blocker" };
const ITEM_GROUPS = [];
ITEM_GROUPS[2]  = { id: 2,  layer: 0,  limit: 15 };
ITEM_GROUPS[5]  = { id: 5,  layer: -1, limit: 6 };
ITEM_GROUPS[12] = { id: 12, layer: -1, limit: 3 };
/* the game hangs the group object straight off the item; Luna reads it there */
for (const it of ITEMS) if (it) it.group = ITEM_GROUPS[it.itemGroup];

/* the game's own placement test: one circle per object plus the river band */
function gameLegal(x, y, footR, objects, itemId) {
  for (const o of objects) {
    const r = o.blockRadius;
    if (Math.hypot(x - o.x, y - o.y) < footR + r) return false;
  }
  if (itemId !== 18) {
    const mid = GAME.mapScale / 2, half = GAME.riverWidth / 2;
    if (y >= mid - half && y <= mid + half) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Scenarios
 * ------------------------------------------------------------------ */

/* Every scenario places the player away from the river so the band is not a
 * silent variable, and states the target's velocity in units per tick. */
function obj(type, x, y, mine = true) {
  const item = ITEMS[type];
  const colDiv = "colDiv" in item ? item.colDiv : 1;
  return {
    type, x, y, mine,
    scale: item.scale,
    health: item.health,
    blockRadius: item.blocker !== undefined ? item.blocker : item.scale,
    collisionRadius: item.scale * colDiv
  };
}

const RING = { x: 7000, y: 5000 };
function onRing(angle, radius, type) {
  return obj(type, RING.x + radius * Math.cos(angle), RING.y + radius * Math.sin(angle));
}

const SCENARIOS = [
  { id: 1,  name: "stationary enemy",
    me: RING, enemy: { x: 7150, y: 5000, vx: 0, vy: 0 }, objects: [] },

  { id: 2,  name: "moving enemy (lateral)",
    me: RING, enemy: { x: 7150, y: 5000, vx: 0, vy: -22 }, objects: [] },

  { id: 3,  name: "enemy approaching",
    me: RING, enemy: { x: 7280, y: 5000, vx: -24, vy: 0 }, objects: [] },

  { id: 4,  name: "enemy retreating",
    me: RING, enemy: { x: 7180, y: 5000, vx: 24, vy: 0 }, objects: [] },

  { id: 5,  name: "enemy trapped",
    me: RING, enemy: { x: 7120, y: 5000, vx: 0, vy: 0 },
    objects: [ obj(15, 7120, 5000) ], trapped: true },

  { id: 6,  name: "existing spike nearby",
    me: RING, enemy: { x: 7140, y: 5000, vx: -8, vy: 0 },
    objects: [ obj(6, 7150, 5090) ] },

  { id: 7,  name: "existing trap nearby",
    me: RING, enemy: { x: 7140, y: 5000, vx: -8, vy: 0 },
    objects: [ obj(15, 7150, 5090) ] },

  { id: 8,  name: "dense object environment",
    me: RING, enemy: { x: 7140, y: 5000, vx: -6, vy: 0 },
    objects: [ onRing(1.1, 79, 6), onRing(2.0, 79, 6), onRing(2.9, 79, 6),
               onRing(3.8, 79, 15), onRing(4.7, 79, 6), obj(6, 7180, 5120) ] },

  { id: 9,  name: "preplace + replace conflict",
    me: RING, enemy: { x: 7150, y: 5000, vx: -14, vy: 0 },
    objects: [ onRing(0.5, 79, 6) ],
    holdPreplace: { angle: 0.5, value: 4 }, vacate: 0 },

  { id: 10, name: "autoplace + preplace conflict",
    me: RING, enemy: { x: 7240, y: 5000, vx: -22, vy: 0 },
    objects: [],
    holdPreplace: { angle: 0.0, value: 6 } },

  { id: 11, name: "many valid angles",
    me: RING, enemy: { x: 7120, y: 5000, vx: -4, vy: 0 }, objects: [] },

  { id: 12, name: "no valid placement",
    me: RING, enemy: { x: 7140, y: 5000, vx: 0, vy: 0 },
    objects: (() => { const a = []; for (let i = 0; i < 12; i++) a.push(onRing(i * Math.PI / 6, 79, 6)); return a; })() },

  { id: 13, name: "packet budget pressure",
    me: RING, enemy: { x: 7130, y: 5000, vx: -10, vy: 0 }, objects: [], packetsUsed: 62 },

  { id: 14, name: "rapidly changing target",
    me: RING, enemy: { x: 7180, y: 5000, vx: -20, vy: 0 }, objects: [],
    course: [ { vx: -20, vy: 0 }, { vx: 0, vy: -22 }, { vx: 18, vy: -10 }, { vx: -6, vy: 22 } ] }
];

/* ------------------------------------------------------------------ *
 * Neutral evaluation
 * ------------------------------------------------------------------ */

/* A placement earns its packets if it can do something measurable: touch the
 * target now, cross the ground the target is about to cover, or sit close
 * enough to a friendly spike or trap to combine with it. Anything else is
 * counted unnecessary - not wrong, just unpaid for. */
function contributes(p, scn, enemyPos, enemyNext) {
  const targetR = GAME.playerScale;
  if (Math.hypot(p.x - enemyPos.x, p.y - enemyPos.y) < p.footR + targetR + 8) return true;
  if (segmentDistance(p.x, p.y, enemyPos.x, enemyPos.y, enemyNext.x, enemyNext.y) < p.footR + targetR) return true;
  for (const o of scn.objects) {
    if (!o.mine) continue;
    if (o.type !== 6 && o.type !== 15) continue;
    if (Math.hypot(p.x - o.x, p.y - o.y) < p.footR + o.scale + 40) return true;
  }
  return false;
}
function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy;
  if (len2 < 1e-9) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * vx + (py - ay) * vy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function evaluate(scn, emitted, candidates, validCandidates, rejected, ms, packets, notes) {
  const enemyPos = { x: scn.enemy.x, y: scn.enemy.y };
  const enemyNext = { x: scn.enemy.x + scn.enemy.vx, y: scn.enemy.y + scn.enemy.vy };
  const enemyLater = { x: scn.enemy.x + scn.enemy.vx * 2, y: scn.enemy.y + scn.enemy.vy * 2 };

  // A placement can be useless now and still be the right call, because the
  // target is three ticks from arriving. So waste is measured twice: against
  // the next tick, and against the whole horizon a predictive system is
  // allowed to plan over. Only the second is evidence of a wasted packet.
  const horizon = [];
  {
    let x = scn.enemy.x, y = scn.enemy.y, vx = scn.enemy.vx, vy = scn.enemy.vy;
    for (let n = 0; n <= 4; n++) { horizon.push({ x: x, y: y }); x += vx; y += vy; }
  }
  function contributesOverHorizon(p) {
    for (let n = 0; n < horizon.length - 1; n++)
      if (contributes(p, scn, horizon[n], horizon[n + 1])) return true;
    return false;
  }

  let unnecessary = 0, unnecHorizon = 0, conflicting = 0, stale = 0, illegal = 0;
  for (let i = 0; i < emitted.length; i++) {
    const p = emitted[i];
    if (!gameLegal(p.x, p.y, p.footR, scn.objects, p.itemId)) illegal++;
    if (!contributes(p, scn, enemyPos, enemyNext)) unnecessary++;
    if (!contributesOverHorizon(p)) unnecHorizon++;
    // stale: would contribute nothing once the target has moved on one tick
    if (!contributes(p, scn, enemyNext, enemyLater)) stale++;
    for (let j = i + 1; j < emitted.length; j++) {
      const q = emitted[j];
      if (Math.hypot(p.x - q.x, p.y - q.y) < p.footR + q.footR) conflicting++;
    }
    for (const o of scn.objects) {
      if (Math.hypot(p.x - o.x, p.y - o.y) < p.footR + o.blockRadius) { conflicting++; break; }
    }
  }
  return {
    candidates, validCandidates, rejected,
    ms: +ms.toFixed(3),
    emitted: emitted.length,
    booked: null,
    unnecessary, unnecHorizon, conflicting, stale, illegal,
    packets, notes: notes || ""
  };
}

/* ------------------------------------------------------------------ *
 * Adapters
 * ------------------------------------------------------------------ */

function readIf(p) { try { return fs.readFileSync(p, "utf8"); } catch (e) { return null; } }
function slice(src, from, to) {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a < 0 || b < 0 || b <= a) throw new Error("anchor not found: " + from);
  return src.slice(a, b);
}
/* pulls a named function or method out by matching braces from its header */
function extract(src, header) {
  const a = src.indexOf(header);
  if (a < 0) throw new Error("not found: " + header);
  let depth = 0, i = src.indexOf("{", a);
  const start = a;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced: " + header);
}

const adapters = [];

/* ---- RYN: the full pipeline ---- */
{
  const SRC_ARG = (args.find(a => a.startsWith("--src=")) || "").slice(6);
  const SRC = fs.readFileSync(SRC_ARG ? path.resolve(ROOT, SRC_ARG) : path.join(ROOT, "src/RYN_Client_v4.js"), "utf8");
  const ENGINE =
    slice(SRC, "  const SiegeAnalysis = {", "  const RynPlacementEngine_default = RynPlacementEngine;");

  adapters.push({
    name: "RYN",
    kind: "pipeline",
    run(scn) {
      const world = makeRynWorld(scn);
      const factory = new Function("env", "with (env) {\n" + ENGINE +
        "\nreturn { RynPlacementEngine, RPE_PRIORITY };\n}");
      const M = factory(world.env);
      const engine = new M.RynPlacementEngine(world.client);
      world.MH.staticModules.placementEngine = engine;

      // observe the pipeline without changing it
      let candidates = 0, viable = 0;
      const realResolve = engine.resolve.bind(engine);
      engine.resolve = function (pool, frame, trigger) {
        const r = realResolve(pool, frame, trigger);
        candidates = Math.max(candidates, pool.length);
        viable = Math.max(viable, r.due.length + r.deferred.length);
        return r;
      };

      // a course history, so prediction has something measured to work from
      for (let t = 0; t < 3; t++) {
        world.advance(scn, t);
        world.MH.tickCount++;
        engine._threat.frameTick = -1;
        engine._blockersTick = -1;
        world.MH.packetCount = scn.packetsUsed || 0;
        world.sent.length = 0;
        world.emitted.length = 0;
        if (scn.holdPreplace && t === 2) world.holdPreplace(engine, M.RPE_PRIORITY, scn);
        engine.postTick();
      }
      const emitted = world.emitted.slice();
      const packets = world.sent.length;
      const booked = engine.book.pending().length;

      let ms = Infinity;
      for (let i = 0; i < ITERATIONS; i++) {
        world.MH.tickCount++;
        engine._threat.frameTick = -1;
        engine._blockersTick = -1;
        engine.memory.sends.clear();
        engine.ledger.entries.length = 0;
        world.MH.packetCount = scn.packetsUsed || 0;
        const t0 = process.hrtime.bigint();
        engine.postTick();
        const dt = Number(process.hrtime.bigint() - t0) / 1e6;
        if (dt < ms) ms = dt;
      }
      const r = evaluate(scn, emitted, candidates, viable, Math.max(0, candidates - viable), ms, packets);
      r.booked = booked;
      return r;
    }
  });
}

/* ---- Luna: the full auto placer, as written ---- */
{
  const SRC = readIf(path.join(ROOT, "src/Luna_Client_1.1.js")) ||
              readIf(path.join(CLIENT_DIR, "1676ddfa-Luna_Client_Full_Source_Code1.1.txt"));
  if (SRC) {
    const parts = [
      "            function getConfig(id, angle, velocity) {",
      "            function canPlace(id, angle, objects, velocity) {",
      "            function isItemLimit(id) {",
      "            function addPredictObject(id, angle, preplace) {",
      "            function getPerfectAngles(angles) {",
      "            function isAutoPlaceAngle(config, closestSpikeToEnemy, closestTrapToEnemy, closestSpikeToKb) {",
      "            function checkPredictObjects(angles) {",
      "            function updateAngles(id) {"
    ].map(h => extract(SRC, h)).join("\n");

    adapters.push({
      name: "Luna",
      kind: "pipeline",
      run(scn) {
        const build = () => {
          const g = makeLunaGlobals(scn);
          const factory = new Function("env", "with (env) {\n" + parts +
            "\nreturn { updateAngles };\n}");
          g.env.updateAngles = null;
          const M = factory(g.env);
          return { g, M };
        };
        const { g, M } = build();
        M.updateAngles(6);
        M.updateAngles(15);
        const emitted = g.env.predictObjects.map(p => ({
          x: p.x, y: p.y, footR: ITEMS[p.id].scale, itemId: p.id, type: p.id === 15 ? 7 : 4
        }));
        // Luna sends four packets per build and never shares a select
        const budget = 70 - (scn.packetsUsed || 0);
        const afford = Math.max(0, Math.floor(budget / 4));
        const sent = emitted.slice(0, afford);
        const packets = sent.length * 4;

        let ms = Infinity;
        for (let i = 0; i < ITERATIONS; i++) {
          const b = build();
          const t0 = process.hrtime.bigint();
          b.M.updateAngles(6);
          b.M.updateAngles(15);
          const dt = Number(process.hrtime.bigint() - t0) / 1e6;
          if (dt < ms) ms = dt;
        }
        const probes = 144;
        const legal = g.legalProbes;
        return evaluate(scn, sent, probes, legal, probes - legal, ms, packets,
          sent.length < emitted.length ? "budget cut " + (emitted.length - sent.length) : "");
      }
    });
  } else {
    adapters.push({ name: "Luna", kind: "pipeline", skip: "source not found" });
  }
}

/* ---- Auraro: the arc solver ---- */
{
  const RAW = readIf(path.join(CLIENT_DIR, "d8b65399-auraro_5.5.txt"));
  /* the file carries two placers - a bot variant and the main one. Scope the
   * extraction to the main class so the bot's Bot-bound methods are not picked
   * up by name collision. */
  const SRC = RAW ? RAW.slice(RAW.indexOf("class AutoPlacer {")) : null;
  if (SRC) {
    const methods = [
      "\tclosestPossibleAngles(obj, id) {",
      "\tnormalizeAngle(a) {",
      "\tangleDist(a, b) {",
      "\tnormalizeArc(start, end) {",
      "\tmergeBlocked(arcs) {",
      "\tinvertArcs(merged) {",
      "\tangleRanges(id, additionalObjs = []) {",
      "\tangleInArc(angle, start, end) {",
      "\tcloseToAngle(angle, ranges) {"
    ].map(h => extract(SRC, h)).join(",\n");

    adapters.push({
      name: "Auraro",
      kind: "solver",
      run(scn) {
        const g = makeAuraroGlobals(scn);
        const factory = new Function("env", "with (env) {\n return { ranges: {}, rangesUpdated: {},\n" +
          methods + "\n};\n}");
        const solver = factory(g.env);

        const run = () => {
          solver.ranges = {}; solver.rangesUpdated = {};
          solver.angleRanges(2);
          solver.angleRanges(4);
        };
        run();
        // its candidate set is the arc endpoints plus the aim snapped in
        const cands = [];
        for (const slot of [ 2, 4 ]) {
          const id = slot === 2 ? 6 : 15;
          const item = ITEMS[id];
          const ring = GAME.playerScale + item.scale + item.placeOffset;
          const ranges = solver.ranges[slot] || [];
          for (const [s, e] of ranges) {
            for (const a of [ s + 0.02, e - 0.02 ]) {
              cands.push({ x: scn.me.x + ring * Math.cos(a), y: scn.me.y + ring * Math.sin(a),
                           footR: item.scale, itemId: id });
            }
          }
          const aim = Math.atan2(scn.enemy.y - scn.me.y, scn.enemy.x - scn.me.x);
          if (ranges.length) {
            const a = solver.closeToAngle(aim, ranges);
            if (a !== null && a !== undefined)
              cands.push({ x: scn.me.x + ring * Math.cos(a), y: scn.me.y + ring * Math.sin(a),
                           footR: item.scale, itemId: id });
          }
        }
        let ms = Infinity;
        for (let i = 0; i < ITERATIONS; i++) {
          const t0 = process.hrtime.bigint();
          run();
          const dt = Number(process.hrtime.bigint() - t0) / 1e6;
          if (dt < ms) ms = dt;
        }
        const valid = cands.filter(c => gameLegal(c.x, c.y, c.footR, scn.objects, c.itemId)).length;
        const r = evaluate(scn, [], cands.length, valid, cands.length - valid, ms, 0,
          "solver only, no planner");
        r.emitted = null; r.unnecessary = null; r.conflicting = null; r.stale = null; r.packets = null;
        return r;
      }
    });
  } else {
    adapters.push({ name: "Auraro", kind: "solver", skip: "source not found (pass --clients=DIR)" });
  }
}

/* ---- Whiteout: the candidate generator ---- */
{
  const SRC = readIf(path.join(CLIENT_DIR, "325507b1-Whiteout_v4.js"));
  if (SRC) {
    const fn = extract(SRC, "function findAvailableAngles(item, thisAng, vel, xd = PI / 75){");
    adapters.push({
      name: "Whiteout",
      kind: "generator",
      run(scn) {
        const g = makeWhiteoutGlobals(scn);
        const factory = new Function("env", "with (env) {\n" + fn + "\nreturn findAvailableAngles;\n}");
        const find = factory(g.env);
        const gen = () => find(6, 0, 0, Math.PI / 100).concat(find(15, 0, 0, Math.PI / 100));
        // count probes by instrumenting its own legality call rather than
        // deriving them from the step, which float accumulation makes ambiguous
        g.env.probes = 0;
        const cands = gen().map(c => ({ x: c.x, y: c.y, footR: c.scale, itemId: c.id }));
        const probes = g.env.probes;
        let ms = Infinity;
        for (let i = 0; i < ITERATIONS; i++) {
          g.env.usedAngles.length = 0;
          const t0 = process.hrtime.bigint();
          gen();
          const dt = Number(process.hrtime.bigint() - t0) / 1e6;
          if (dt < ms) ms = dt;
        }
        const valid = cands.filter(c => gameLegal(c.x, c.y, c.footR, scn.objects, c.itemId)).length;
        const r = evaluate(scn, [], probes, valid, probes - cands.length, ms, 0,
          "generator only, grader not isolated");
        r.emitted = null; r.unnecessary = null; r.conflicting = null; r.stale = null; r.packets = null;
        return r;
      }
    });
  } else {
    adapters.push({ name: "Whiteout", kind: "generator", skip: "source not found (pass --clients=DIR)" });
  }
}

/* ------------------------------------------------------------------ *
 * Worlds
 * ------------------------------------------------------------------ */

function makeRynWorld(scn) {
  class Vec {
    constructor(x, y) { this.x = x; this.y = y; }
    distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
  }
  class PlayerObject {
    constructor(id, o) {
      this.id = id; this.type = o.type; this.ownerID = o.mine ? 1 : 2;
      const item = ITEMS[o.type];
      this.scale = item.scale;
      this.itemGroup = item.itemGroup;
      this.collisionDivider = "colDiv" in item ? item.colDiv : 1;
      this.health = item.health;
      this.isDestroyable = true;
      this.pos = { current: new Vec(o.x, o.y), future: new Vec(o.x, o.y) };
    }
    get collisionScale() { return this.scale * this.collisionDivider; }
    get placementScale() { return ITEMS[this.type].blocker !== undefined ? ITEMS[this.type].blocker : this.scale; }
  }
  class Grid {
    constructor(cs) { this.cellSize = cs; this.grid = new Map(); }
    key(x, y) { return x << 16 | y; }
    insert(x, y, r, id) {
      for (let i = (x - r) / this.cellSize | 0; i <= (x + r) / this.cellSize | 0; i++)
        for (let j = (y - r) / this.cellSize | 0; j <= (y + r) / this.cellSize | 0; j++) {
          const k = this.key(i, j);
          if (!this.grid.has(k)) this.grid.set(k, new Set());
          this.grid.get(k).add(id);
        }
    }
    query(x, y, s, cb) {
      const cx = x / this.cellSize | 0, cy = y / this.cellSize | 0, seen = new Set();
      for (let i = -s; i <= s; i++) for (let j = -s; j <= s; j++) {
        const set = this.grid.get(this.key(cx + i, cy + j));
        if (!set) continue;
        for (const id of set) if (!seen.has(id)) { seen.add(id); if (cb(id)) return true; }
      }
      return false;
    }
  }
  const objects = new Map(), grid = new Grid(100);
  let nid = 1;
  for (const o of scn.objects) {
    const po = new PlayerObject(nid++, o);
    objects.set(po.id, po);
    grid.insert(o.x, o.y, Math.max(po.collisionScale, po.placementScale), po.id);
  }
  const me = {
    inGame: true, scale: 35, id: 1, isTrapped: false, spikeDamage: 0,
    pos: { current: new Vec(scn.me.x, scn.me.y), future: new Vec(scn.me.x, scn.me.y) },
    getItemByType(t) { return t === 4 ? 6 : t === 7 ? 15 : -1; },
    getItemPlaceScale(id) { return this.scale + ITEMS[id].scale + ITEMS[id].placeOffset; },
    getItemCount(g) { return { count: 0, limit: ITEM_GROUPS[g].limit }; },
    canPlace() { return true; },
    isReloaded() { return false; },
    getBuildingDamage() { return 0; },
    isMyPlayerByID(id) { return id === 1; }
  };
  /* The target is rewound three ticks along its course and walked forward, so
   * the motion tracker observes a real sequence and the stated position is
   * where it ends up. Teleporting it into place instead would hand the tracker
   * a fabricated velocity on the last step. */
  const back = scn.course || [ scn.enemy, scn.enemy, scn.enemy ];
  let sx = scn.enemy.x, sy = scn.enemy.y;
  for (let i = 0; i < 3; i++) { const c = back[Math.min(i, back.length - 1)]; sx -= c.vx; sy -= c.vy; }
  const enemy = {
    id: 2, collisionScale: 35, spikeDamage: 0, dir: 0,
    weapon: { primary: null, secondary: null },
    reload: [ { current: 0, max: 1 }, { current: 0, max: 1 } ],
    getBuildingDamage() { return 0; },
    pos: { current: new Vec(sx, sy), future: new Vec(sx, sy) }
  };
  const sent = [], emitted = [];
  const MH = {
    tickCount: 10, packetCount: scn.packetsUsed || 0, packetLimit: 70,
    activeModule: null, moduleActive: false, placedOnce: false,
    placeAngles: [ null, [] ], totalPlaces: 0, staticModules: {},
    canBuy() { return false; }, autoattack: false, forceWeapon: null,
    _getPredictWeapon() { return 0; },
    selectItem(t) { sent.push("z"); this.packetCount++; },
    attack(a) { sent.push("F1"); this.packetCount++; this._pending = a; },
    stopAttack(a) {
      sent.push("F0"); this.packetCount++;
      const id = this._type === 7 ? 15 : 6, item = ITEMS[id];
      const ring = 35 + item.scale + item.placeOffset;
      emitted.push({ x: me.pos.current.x + ring * Math.cos(a), y: me.pos.current.y + ring * Math.sin(a),
                     footR: item.scale, itemId: id, type: this._type });
    },
    whichWeapon() { sent.push("zw"); this.packetCount++; },
    place(type, angle) {
      this._type = type; this.totalPlaces++;
      this.selectItem(type); this.attack(angle); this.stopAttack(angle); this.whichWeapon();
    }
  };
  const realSelect = MH.selectItem.bind(MH);
  MH.selectItem = function (t) { this._type = t; realSelect(t); };

  const env = {
    Config_default: GAME, Items: ITEMS, ItemGroups: ITEM_GROUPS,
    Settings_default: { _autoplacer: true, _autoplacerRadius: 350, _preplacer: true, _replacer: true,
      _prePlace: true, _replace: true },
    DataHandler_default: { getWeapon: () => ({ range: 140, speed: 300 }) },
    PlayerObject, getAngleFromBitmask: () => null
  };
  const client = {
    myPlayer: me, _ModuleHandler: MH,
    EnemyManager: { nearestEnemy: enemy },
    ObjectManager: { objects, grid2D: grid },
    PlayerManager: { isEnemyByID: ownerID => ownerID !== 1 },
    InputHandler: { move: 0 }
  };
  return {
    env, client, MH, sent, emitted,
    advance(scn2, t) {
      const c = scn2.course ? scn2.course[Math.min(t, scn2.course.length - 1)] : scn2.enemy;
      enemy.pos.current.x += c.vx; enemy.pos.current.y += c.vy;
      enemy.pos.future.x = enemy.pos.current.x + c.vx;
      enemy.pos.future.y = enemy.pos.current.y + c.vy;
    },
    holdPreplace(engine, PRI, scn2) {
      const item = ITEMS[6], ring = 35 + item.scale + item.placeOffset;
      const a = scn2.holdPreplace.angle;
      engine.ledger.reserve(scn2.me.x + ring * Math.cos(a), scn2.me.y + ring * Math.sin(a),
        item.scale, PRI.ANTICIPATION, "preplace", MH.tickCount, 5,
        { soft: true, value: scn2.holdPreplace.value });
    }
  };
}

function makeLunaGlobals(scn) {
  let legalProbes = 0;
  const visibleObjects = scn.objects.map((o, i) => ({
    sid: i + 1, x: o.x, y: o.y, scale: o.scale, blocker: undefined,
    active: true, isItem: true, health: o.health,
    owner: { sid: o.mine ? 1 : 2 },
    getScale() { return o.scale; }
  }));
  const env = {
    items: { list: ITEMS, weapons: [] },
    config: GAME,
    UTILS: {
      toRad: d => d * Math.PI / 180,
      getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
      getDirection: (x1, y1, x2, y2) => Math.atan2(y1 - y2, x1 - x2),
      getAngleDist: (a, b) => { const p = Math.abs(b - a) % (Math.PI * 2); return p > Math.PI ? Math.PI * 2 - p : p; },
      lineInRect: (x1, y1, x2, y2, ax, ay, bx, by) => {
        let minX = ax, maxX = bx;
        if (ax > bx) { minX = bx; maxX = ax; }
        if (maxX > x2) maxX = x2;
        if (minX < x1) minX = x1;
        if (minX > maxX) return false;
        let minY = ay, maxY = by;
        const dx = bx - ax;
        if (Math.abs(dx) > 1e-7) {
          const slope = (by - ay) / dx, ic = ay - slope * ax;
          minY = slope * minX + ic; maxY = slope * maxX + ic;
        }
        if (minY > maxY) { const t = maxY; maxY = minY; minY = t; }
        if (maxY > y2) maxY = y2;
        if (minY < y1) minY = y1;
        return minY <= maxY;
      }
    },
    objectManager: {
      checkItemLocation(x, y, s, sM, indx, ignoreWater, placer, objs) {
        const ok = gameLegal(x, y, s, scn.objects, indx);
        if (ok) legalProbes++;
        return ok;
      }
    },
    myPlayer: {
      sid: 1, x2: scn.me.x, y2: scn.me.y, xVel: scn.me.x, yVel: scn.me.y,
      items: [ 0, 0, 6, 0, 15, 0 ], itemCounts: {}, weapons: [ 0, 0 ]
    },
    nearestEnemy: {
      sid: 2, scale: 35, spikeDamage: 0,
      x2: scn.enemy.x, y2: scn.enemy.y,
      xVel: scn.enemy.x + scn.enemy.vx, yVel: scn.enemy.y + scn.enemy.vy
    },
    visibleObjects,
    spikes_our: scn.objects.filter(o => o.mine && o.type === 6).map(o => ({ x: o.x, y: o.y, scale: o.scale })),
    traps_our: scn.objects.filter(o => o.mine && o.type === 15).map(o => ({ x: o.x, y: o.y, scale: o.scale })),
    predictObjects: [],
    bannedAngles: new Map(),
    placedAngles: [],
    tick: 10,
    imTrapped: false,
    predictMoveAngle: 0,
    canTrapTick: () => false,
    canShamePlace: () => false
  };
  return { env, get legalProbes() { return legalProbes; } };
}

function makeAuraroGlobals(scn) {
  const nearObjs = scn.objects.map(o => ({
    x: o.x, y: o.y, scale: o.scale, isItem: true, blocker: undefined,
    getScale() { return o.blockRadius; }
  }));
  return {
    env: {
      player: { x2: scn.me.x, y2: scn.me.y, x3: scn.me.x, y3: scn.me.y, scale: 35, items: [ 0, 0, 6, 0, 15, 0 ] },
      items: { list: ITEMS },
      nearObjs,
      config: GAME,
      objectManager: {
        checkItemLocation: (x, y, s, sM, indx) => gameLegal(x, y, s, scn.objects, indx)
      },
      UTILS: { getDirect: (a, b) => Math.atan2(a.y - b.y2, a.x - b.x2) }
    }
  };
}

function makeWhiteoutGlobals(scn) {
  const env = {};
  const liztobj = scn.objects.map((o, i) => ({
    sid: i + 1, x: o.x, y: o.y, scale: o.scale, active: true, isItem: true,
    blocker: undefined, assumeBreak: false,
    getScale() { return o.blockRadius; }
  }));
  Object.assign(env, {
      probes: 0,
      PI: Math.PI, PI2: Math.PI * 2, cos: Math.cos, sin: Math.sin,
      items: { list: ITEMS },
      player: { x2: scn.me.x, y2: scn.me.y, x3: scn.me.x, y3: scn.me.y },
      usedAngles: [],
      secPacket: scn.packetsUsed || 0,
      dAng: (a, b) => { const p = Math.abs(b - a) % (Math.PI * 2); return p > Math.PI ? Math.PI * 2 - p : p; },
      objectManager: {
        checkItemLocation: (x, y, s, sM, indx) => gameLegal(x, y, s, scn.objects, indx),
        checkItemLocation3(x, y, s, sM, indx, a, outplace, o) {
          env.probes++;
          for (const t of liztobj) {
            const r = t.blocker ? t.blocker : t.getScale(sM, t.isItem);
            if (Math.hypot(x - t.x, y - t.y) < s + r) {
              o.overlap.push(t); o.preplacer.push(t.assumeBreak); o.sids.push(t.sid);
            }
          }
          if (o.preplacer.includes(false)) return false;
          const mid = GAME.mapScale / 2, half = GAME.riverWidth / 2;
          return !(!a && indx != 18 && y >= mid - half && y <= mid + half);
        }
      }
  });
  return { env: env };
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

const results = {};
for (const a of adapters) {
  results[a.name] = { kind: a.kind, skip: a.skip || null, rows: {} };
  if (a.skip) continue;
  for (const scn of SCENARIOS) {
    try {
      results[a.name].rows[scn.id] = a.run(scn);
    } catch (e) {
      results[a.name].rows[scn.id] = { error: String(e.message || e) };
    }
  }
}

if (AS_JSON) {
  console.log(JSON.stringify({ scenarios: SCENARIOS.map(s => ({ id: s.id, name: s.name })), results }, null, 2));
  process.exit(0);
}

const COLS = [
  [ "cand", "candidates" ], [ "valid", "validCandidates" ], [ "rej", "rejected" ],
  [ "ms", "ms" ], [ "sent", "emitted" ], [ "held", "booked" ], [ "unnec", "unnecessary" ], [ "unnec4", "unnecHorizon" ],
  [ "confl", "conflicting" ], [ "stale", "stale" ], [ "illegal", "illegal" ], [ "pkts", "packets" ]
];
function cell(v) { return v === null || v === undefined ? "-" : String(v); }

console.log("");
console.log("PLACEMENT BENCHMARK");
console.log("Measurements only. Systems are not ranked, and a dash means the system");
console.log("does not do that thing rather than that it scored zero.");
console.log("");
for (const a of adapters) {
  const r = results[a.name];
  console.log(a.name + "  [" + a.kind + "]" + (r.skip ? "  SKIPPED: " + r.skip : ""));
}
console.log("");

for (const scn of SCENARIOS) {
  console.log(String(scn.id).padStart(2) + ". " + scn.name);
  const head = "      " + "system".padEnd(10) + COLS.map(c => c[0].padStart(8)).join("");
  console.log(head);
  for (const a of adapters) {
    const r = results[a.name];
    if (r.skip) continue;
    const row = r.rows[scn.id];
    if (row.error) { console.log("      " + a.name.padEnd(10) + "  error: " + row.error); continue; }
    console.log("      " + a.name.padEnd(10) + COLS.map(c => cell(row[c[1]]).padStart(8)).join("") +
      (row.notes ? "   " + row.notes : ""));
  }
  console.log("");
}

console.log("NOTES");
console.log("  cand     placement options the system produced and considered");
console.log("  valid    of those, legal under the game's own checkItemLocation");
console.log("  rej      options the system discarded before planning");
console.log("  ms       fastest of " + ITERATIONS + " runs of one decision cycle");
console.log("  sent     placements the system actually emitted");
console.log("  held     candidates deferred to a later tick rather than sent now -");
console.log("           only RYN books, so this reads as a dash for the others, and");
console.log("           a row with sent 0 and held above 0 is waiting, not idle");
console.log("  unnec    emitted placements contributing nothing over the next tick");
console.log("  unnec4   emitted placements contributing nothing over four ticks of the");
console.log("           target's predicted course - this is the wasted-packet signal;");
console.log("           unnec alone penalises legitimate preparation");
console.log("  confl    emitted placements overlapping each other or a live object");
console.log("  stale    emitted placements that contribute nothing one tick later");
console.log("  illegal  emitted placements the game would refuse");
console.log("  pkts     packets spent emitting them");
console.log("");
console.log("  Auraro is measured as a solver: its own comment states its auto placer");
console.log("  was never finished, so it has no plan to evaluate.");
console.log("  Whiteout is measured as a generator: its grader reads roughly forty");
console.log("  globals from its combat loop and did not isolate cleanly, so its");
console.log("  scoring is not represented here rather than approximated.");
console.log("  Luna is driven through its real auto-place path and charged four");
console.log("  packets per build, which is what it sends.");
