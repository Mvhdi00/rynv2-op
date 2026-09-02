#!/usr/bin/env node
/*
 * check-gapfill.js
 *
 * Exercises the trap enclosure gap-fill layer in the built script.
 *
 * It lifts the real code out of RYN_GapFill.user.js — GeometrySolver (with the
 * two arc helpers the layer adds), rpeGapCoverage, rpeBuildProfile,
 * PlacementMemory, CandidateGenerator and the engine's own gap-fill methods —
 * and runs them against synthetic layouts, so what is tested is what ships.
 * The stubs around them carry the game's own numbers: player scale 35, spike
 * scale 52, trap scale 50 with colDiv 0.2, the 35 + scale + placeOffset
 * placement ring, and the item.scale + object.placementScale placement rule.
 *
 *   node tools/check-gapfill.js [path/to/RYN_GapFill.user.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const BUILD_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "RYN_GapFill.user.js");
const built = fs.readFileSync(BUILD_PATH, "utf8");

/* Slice a block out of the build by matching braces from its opening line. */
function block(startsWith) {
  const start = built.indexOf(startsWith);
  if (start === -1) throw new Error("not found in the build: " + startsWith.trim());
  let i = built.indexOf("{", start);
  let depth = 0;
  for (; i < built.length; i++) {
    const c = built[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return built.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced block: " + startsWith.trim());
}

/* The engine's gap-fill methods sit between two comment banners. */
function methods() {
  const start = built.indexOf("    // ── gap fill ───");
  const end = built.indexOf("    // ── SENSE ───", start);
  if (start === -1 || end === -1) throw new Error("gap-fill methods not found in the build");
  return built.slice(start, end);
}

/* ---- the world the lifted code runs in ---- */
const Config_default = { playerScale: 35, mapScale: 14400, riverWidth: 724 };
const ItemGroups = { 2: { limit: 15, layer: 0 }, 5: { limit: 6, layer: -1 } };
const Items = [];
Items[9] = { id: 9, itemGroup: 2, name: "spikes", scale: 52, placeOffset: -5, health: 500, dmg: 25 };
Items[15] = { id: 15, itemGroup: 5, name: "pit trap", scale: 50, placeOffset: -5, colDiv: .2, health: 500, trap: true, ignoreCollision: true, hideFromEnemy: true };

class ObjectItem {
  constructor(id, x, y, scale) {
    this.id = id;
    this.scale = scale;
    this.pos = { current: { x, y } };
  }
  get hitScale() { return this.scale; }
}
class Resource extends ObjectItem {
  constructor(id, x, y, scale) { super(id, x, y, scale); }
  get collisionScale() { return this.scale; }
  get placementScale() { return this.scale * .6; }
}
class PlayerObject extends ObjectItem {
  constructor(id, x, y, type, ownerID) {
    super(id, x, y, Items[type].scale);
    this.type = type;
    this.ownerID = ownerID;
    const item = Items[type];
    this.collisionDivider = "colDiv" in item ? item.colDiv : 1;
    this.itemGroup = item.itemGroup;
    this.health = item.health;
    this.isDestroyable = true;
  }
  get collisionScale() { return this.scale * this.collisionDivider; }
  get placementScale() { return this.scale; }
}

const Settings_default = { _gapFill: true, _gapFillBreak: true, _prePlace: true, _replace: true };
const DataHandler_default = { getWeapon: () => ({ range: 110, knockback: 60 }), isMelee: () => true };
let spikeTickBusy = false;
function lunaSpikeTickBusy() { return spikeTickBusy; }

const sandbox = {
  Math, Object, Array, Map, Set, Number, Infinity, NaN, isFinite, JSON, console,
  Config_default, ItemGroups, Items, PlayerObject, Resource, ObjectItem,
  Settings_default, DataHandler_default, lunaSpikeTickBusy,
  RPE_TAU: Math.PI * 2,
  RPE_EPS: 1e-6,
  RPE_MAX_BLOCK_RADIUS: 300,
  RPE_ROLE_TYPES: [ 4, 7 ],
  RPE_MODE: { AUTO: "auto", PREPLACE: "preplace", REPLACE: "replace" },
  RPE_PREPLACE_MAX_LEAD: 6,
  RPE_PREPLACE_MIN_CONFIDENCE: .3
};
vm.createContext(sandbox);

/* Constants and code lifted from the build, in the order they depend on. */
const CONSTANTS = built.slice(
  built.indexOf("  const RPE_GAP_RING_STEP"),
  built.indexOf("  const RPE_GAP_BREAK_GAIN") + built.slice(built.indexOf("  const RPE_GAP_BREAK_GAIN")).indexOf("\n")
);
/* One script, so the lifted declarations share a scope the way they do in the
 * client, with the pieces the tests need handed back at the end. */
vm.runInContext([
  CONSTANTS,
  block("  const GeometrySolver = {"),
  block("  function rpeGapCoverage("),
  block("  function rpeBuildProfile("),
  block("  class PlacementMemory {"),
  block("  class CandidateGenerator {"),
  "class GapEngine {\n" + methods() + "\n}",
  "globalThis.lifted = { GeometrySolver, rpeGapCoverage, rpeBuildProfile, PlacementMemory, CandidateGenerator, GapEngine };"
].join("\n"), sandbox);

const { GeometrySolver, GapEngine, rpeGapCoverage, rpeBuildProfile, PlacementMemory, CandidateGenerator } = sandbox.lifted;

/* ---- test world ---- */
const PI = Math.PI;
const deg = r => Math.round(GeometrySolver.norm(r) * 180 / PI);
let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? "  ok   " : "  FAIL ") + name + (extra ? "   " + extra : ""));
  if (!cond) failures++;
}

function makeTarget(x, y, opts = {}) {
  return {
    id: opts.id ?? 7,
    pos: { current: { x, y }, future: { x: x + (opts.vx || 0), y: y + (opts.vy || 0) } },
    collisionScale: 35,
    scale: 35
  };
}

function makeEngine(objects, target, myPos, opts = {}) {
  const tick = opts.tick ?? 100;
  const client = {
    _ModuleHandler: { tickCount: tick, packetLimit: 70, packetCount: 0, staticModules: {} },
    ObjectManager: {
      objects: new Map(objects.map(o => [ o.id, o ])),
      grid2D: { cellSize: 100, query: (x, y, cells, cb) => { for (const o of objects) cb(o.id); return false; } }
    },
    PlayerManager: {
      // Owner 1 is me; the target owns its own id. Anything else is hostile
      // to both, which is what the real isEnemyByID resolves to here.
      isEnemyByID: (ownerID, entity) => ownerID !== entity.id
    },
    myPlayer: {
      id: 1,
      inGame: true,
      pos: { current: myPos },
      isMyPlayerByID: id => id === 1,
      getItemByType: type => (type === 4 ? 9 : type === 7 ? 15 : null),
      getItemPlaceScale: id => 35 + Items[id].scale + Items[id].placeOffset,
      getBuildingDamage: () => 600,
      getItemCount: () => ({ count: 0, limit: 15 }),
      canPlace: () => true
    }
  };
  const engine = new GapEngine();
  engine.client = client;
  engine.weights = { gapCover: 3.6, gapSeal: 5.4, gapEscape: 2.4 };
  engine.memory = new PlacementMemory();
  engine._generator = new CandidateGenerator(client);
  engine._blockers = objects.slice();
  engine.book = { has: () => false, records: [] };
  engine._ensureBlockers = () => {};
  engine.profileFor = type => rpeBuildProfile(client.myPlayer, type);
  engine._candidate = (profile, angle, apertures, mode, extra) => ({
    profile, angle, mode, source: extra.source, kind: extra.kind,
    confidence: extra.confidence, interceptTick: extra.interceptTick, dueTick: extra.dueTick,
    x: myPos.x + profile.ringR * Math.cos(angle),
    y: myPos.y + profile.ringR * Math.sin(angle)
  });

  const frame = {
    tick,
    myPos,
    target,
    targetPos: target.pos.current,
    targetScale: target.collisionScale,
    targetId: target.id,
    targetTrapped: opts.targetTrapped ?? null,
    motion: opts.motion ?? { heading: null, speed: 0, stability: .5, samples: [] }
  };
  // The engine builds its own frame, motion track and blocker sweep when the
  // break check asks first; both are tick-cached in the client, so the stubs
  // hand back the same objects however many times they are asked.
  engine._threat = { frame: frame, build: () => frame };
  engine.motion = {
    intercept: () => opts.intercept ?? null,
    observe: () => frame.motion
  };
  return { engine, frame, client };
}

function ring(objects, id0, radii, angles, type, owner) {
  for (let i = 0; i < angles.length; i++) {
    const rad = angles[i] * PI / 180;
    const r = Array.isArray(radii) ? radii[i] : radii;
    objects.push(new PlayerObject(id0 + i, Math.cos(rad) * r, Math.sin(rad) * r, type, owner));
  }
  return objects;
}

/* ══════════════ 1. arc arithmetic ══════════════ */
{
  console.log("\n[1] arc span and overlap");
  const TAU = Math.PI * 2;
  check("span of a plain arc", Math.abs(GeometrySolver.arcSpan([ 1, 2 ]) - 1) < 1e-9);
  check("span across the seam", Math.abs(GeometrySolver.arcSpan([ TAU - .5, .5 ]) - 1) < 1e-9,
    GeometrySolver.arcSpan([ TAU - .5, .5 ]).toFixed(3));
  check("span of full", GeometrySolver.arcSpan("full") === TAU);
  check("no overlap when apart", GeometrySolver.arcOverlap([ 0, 1 ], [ 2, 3 ]) === 0);
  check("partial overlap", Math.abs(GeometrySolver.arcOverlap([ 0, 2 ], [ 1, 3 ]) - 1) < 1e-9);
  check("contained arc", Math.abs(GeometrySolver.arcOverlap([ 0, 3 ], [ 1, 2 ]) - 1) < 1e-9);
  check("overlap across the seam", Math.abs(GeometrySolver.arcOverlap([ TAU - 1, 1 ], [ TAU - .5, .5 ]) - 1) < 1e-9,
    GeometrySolver.arcOverlap([ TAU - 1, 1 ], [ TAU - .5, .5 ]).toFixed(3));
  check("overlap never exceeds the arc", GeometrySolver.arcOverlap([ 0, 1 ], [ 0, 6 ]) <= 1 + 1e-9);
}

/* ══════════════ 2. the box with one way out ══════════════ */
const HOLE = 300 * PI / 180;
{
  console.log("\n[2] five spikes around the target, hole at 300 deg");
  const objects = ring([], 100, 118, [ 0, 60, 120, 180, 240 ], 9, 1);
  const target = makeTarget(0, 0);
  const myPos = { x: Math.cos(HOLE) * 20, y: Math.sin(HOLE) * 20 };
  const { engine, frame } = makeEngine(objects, target, myPos, {
    motion: { heading: HOLE, speed: 6, stability: .8, samples: [ 1, 2, 3 ] }
  });
  const encl = engine._enclosureOf(frame);
  console.log("    ratio " + encl.ratio.toFixed(2) + "  exits " + encl.exits.length +
    "  mids " + encl.exits.map(e => deg(e[0] + e[2] / 2)).join(",") + "  pinned " + encl.pinned);
  check("enclosure detected", encl.enclosed);
  check("one way out", encl.exits.length === 1);
  check("the way out is the hole", Math.abs(deg(encl.primary[0] + encl.primary[2] / 2) - 300) < 25,
    deg(encl.primary[0] + encl.primary[2] / 2) + " deg");
  check("heading followed", Math.abs(deg(encl.heading) - 300) < 1);

  engine._enclosure = encl;
  const profile = engine.profileFor(4);
  const apertures = engine._generator.apertures(profile, myPos.x, myPos.y, objects, null);
  const angles = engine._gapAngles(profile, frame, apertures);
  console.log("    proposed " + angles.length + " angle(s): " + angles.map(deg).join(","));
  check("angles proposed at the mouth", angles.length > 0);
  let best = null;
  for (const a of angles) {
    const x = myPos.x + profile.ringR * Math.cos(a), y = myPos.y + profile.ringR * Math.sin(a);
    const cover = rpeGapCoverage(encl, encl.primary, frame.targetPos, frame.targetScale, x, y, profile.footR);
    if (cover && (!best || cover.share > best.share)) best = { a, ...cover };
  }
  check("a proposal covers the way out", !!best, best ? (best.share * 100).toFixed(0) + "% seals:" + best.seals : "");
  check("the best proposal closes it", !!best && best.seals);

  const pool = [];
  engine._generateGapFill(pool, profile, frame);
  console.log("    candidates " + pool.length + (pool.length ? "  kind " + pool[0].kind + " mode " + pool[0].mode + " conf " + pool[0].confidence.toFixed(2) : ""));
  check("candidates generated", pool.length > 0);
  check("they ride the preplace pass", pool.every(c => c.mode === "preplace" && c.kind === "gapfill"));
  check("due this tick", pool.every(c => c.dueTick === frame.tick));
  check("confidence clears the firing bar", pool.every(c => c.confidence >= .3));
}

/* ══════════════ 3. not every cluster is an enclosure ══════════════ */
{
  console.log("\n[3] two of my traps on one side only");
  const objects = ring([], 200, 90, [ 0, 30 ], 15, 1);
  const target = makeTarget(0, 0);
  const { engine, frame } = makeEngine(objects, target, { x: -60, y: 0 });
  const encl = engine._enclosureOf(frame);
  console.log("    ratio " + (encl ? encl.ratio.toFixed(2) : "-") + "  exits " + (encl ? encl.exits.length : "-"));
  check("not called enclosed", !encl || !encl.enclosed);
  if (encl) {
    engine._enclosure = encl;
    const pool = [];
    engine._generateGapFill(pool, engine.profileFor(4), frame);
    check("nothing proposed", pool.length === 0);
  }
}

/* ══════════════ 4. ownership decides what blocks ══════════════ */
{
  console.log("\n[4] my trap and the target's own trap");
  const mine = new PlayerObject(300, 70, 0, 15, 1);
  const theirs = new PlayerObject(301, -70, 0, 15, 7);
  const wall = new PlayerObject(302, 0, 90, 9, 1);
  const target = makeTarget(0, 0, { id: 7 });
  const { engine, frame } = makeEngine([ mine, theirs, wall ], target, { x: 0, y: -80 });
  const encl = engine._enclosureOf(frame);
  const ids = encl.blockers.map(b => b.object.id);
  console.log("    blockers " + ids.join(","));
  check("my trap blocks them", ids.indexOf(300) !== -1);
  check("their own trap does not", ids.indexOf(301) === -1);
  check("ownership read from the tables", encl.blockers.find(b => b.object.id === 300).mine === true);
  check("a resource always blocks", (() => {
    const rock = new Resource(303, -70, 0, 60);
    const e2 = makeEngine([ mine, wall, rock ], target, { x: 0, y: -80 });
    return e2.engine._enclosureOf(e2.frame).blockers.some(b => b.object.id === 303);
  })());
}

/* ══════════════ 5. pinned in my trap ══════════════ */
{
  console.log("\n[5] held in my trap, three spikes around");
  const trap = new PlayerObject(400, 12, 0, 15, 1);
  const objects = ring([ trap ], 401, 120, [ 70, 150, 230 ], 9, 1);
  const target = makeTarget(0, 0);
  const { engine, frame } = makeEngine(objects, target, { x: 60, y: -60 }, { targetTrapped: trap });
  const encl = engine._enclosureOf(frame);
  console.log("    ratio " + encl.ratio.toFixed(2) + "  pinned " + encl.pinned + "  exits " + encl.exits.map(e => deg(e[0] + e[2] / 2)).join(","));
  check("recognised as pinned", encl.pinned === true);
  check("enclosed on the lower floor", encl.enclosed === true, "ratio " + encl.ratio.toFixed(2));
  check("stationary target: leaves away from me", Math.abs(GeometrySolver.angleDist(encl.heading, Math.atan2(0 - -60, 0 - 60))) < 1e-9);
}

/* ══════════════ 6. wide open ══════════════ */
{
  console.log("\n[6] a single spike nearby");
  const objects = [ new PlayerObject(500, 120, 0, 9, 1) ];
  const target = makeTarget(0, 0);
  const { engine, frame } = makeEngine(objects, target, { x: -70, y: 0 });
  const encl = engine._enclosureOf(frame);
  check("one blocker is not an enclosure", encl === null);
}

/* ══════════════ 7. spike tick keeps its tick ══════════════ */
{
  console.log("\n[7] a spike tick owns the tick");
  const objects = ring([], 600, 118, [ 0, 60, 120, 180, 240 ], 9, 1);
  const target = makeTarget(0, 0);
  const myPos = { x: Math.cos(HOLE) * 20, y: Math.sin(HOLE) * 20 };
  const { engine, frame } = makeEngine(objects, target, myPos, {
    motion: { heading: HOLE, speed: 6, stability: .8, samples: [ 1, 2, 3 ] }
  });
  engine._enclosure = engine._enclosureOf(frame);
  spikeTickBusy = true;
  const busy = [];
  engine._generateGapFill(busy, engine.profileFor(4), frame);
  spikeTickBusy = false;
  const free = [];
  engine._generateGapFill(free, engine.profileFor(4), frame);
  check("stands down while a spike tick is firing", busy.length === 0);
  check("proposes again once it is done", free.length > 0);

  Settings_default._gapFill = false;
  const off = [];
  engine._generateGapFill(off, engine.profileFor(4), frame);
  engine._enclosureTick = -1;
  const dark = engine._enclosureFor(frame);
  Settings_default._gapFill = true;
  check("respects its own toggle", off.length === 0);
  check("switched off means not measured at all", dark === null);

  const booked = [];
  engine.book = { has: () => true, records: [] };
  engine._generateGapFill(booked, engine.profileFor(4), frame);
  engine.book = { has: () => false, records: [] };
  check("ground already booked is not proposed again", booked.length === 0);
}

/* ══════════════ 8. sealing is worth more than clipping ══════════════ */
{
  console.log("\n[8] coverage scoring");
  // Four spikes at 124 leave a 69-degree opening: wide enough that some ring
  // angles only clip it and others close it, which is the comparison worth
  // making.
  const objects = ring([], 700, 124, [ 0, 72, 144, 216 ], 9, 1);
  const target = makeTarget(0, 0);
  const hole = 288 * PI / 180;
  const myPos = { x: Math.cos(hole) * 60, y: Math.sin(hole) * 60 };
  const { engine, frame } = makeEngine(objects, target, myPos, {
    motion: { heading: hole, speed: 6, stability: .8, samples: [ 1, 2, 3 ] }
  });
  const encl = engine._enclosureOf(frame);
  engine._enclosure = encl;
  const profile = engine.profileFor(4);
  const apertures = engine._generator.apertures(profile, myPos.x, myPos.y, objects, null);
  const rows = [];
  for (let i = 0; i < 72; i++) {
    const a = i * (Math.PI * 2 / 72);
    if (!GeometrySolver.inAperture(apertures, a)) continue;
    const x = myPos.x + profile.ringR * Math.cos(a), y = myPos.y + profile.ringR * Math.sin(a);
    const cover = rpeGapCoverage(encl, encl.primary, frame.targetPos, frame.targetScale, x, y, profile.footR);
    if (!cover) continue;
    let value = 3.6 * cover.share + (cover.seals ? 5.4 : 0);
    value += 2.4 * Math.max(0, Math.cos(GeometrySolver.angleDist(Math.atan2(y, x), encl.heading)));
    rows.push({ a, share: cover.share, seals: cover.seals, value, d: Math.hypot(x, y) });
  }
  rows.sort((p, q) => q.value - p.value);
  console.log("    " + rows.slice(0, 4).map(r => deg(r.a) + "deg " + (r.share * 100).toFixed(0) + "% seal:" + (r.seals ? 1 : 0) + " " + r.value.toFixed(2)).join("  |  "));
  const seal = rows.find(r => r.seals);
  const clip = rows.filter(r => !r.seals).sort((p, q) => p.d - q.d)[0];
  check("something can close this opening", !!seal);
  if (seal && clip) {
    check("closing the opening outranks only clipping it", seal.value > clip.value,
      "seal " + seal.value.toFixed(2) + " @d" + Math.round(seal.d) + " vs clip " + clip.value.toFixed(2) + " @d" + Math.round(clip.d));
  }
  check("coverage never exceeds the opening", rows.every(r => r.share <= 1 + 1e-9));
}

/* ══════════════ 9. breaking the trap that denies the spike ══════════════ */
{
  console.log("\n[9] my trap parked on the opening");
  // A ring with a hole, and one of my traps beside the hole: the target still
  // fits out, but the trap's 50 units of placement scale deny the spike.
  let found = null;
  for (const trapAngle of [ 280, 290, 300, 310, 320 ]) {
    for (const trapDist of [ 70, 85, 100 ]) {
      for (const myDist of [ 10, 20, 30 ]) {
        const objects = ring([], 800, 128, [ 0, 60, 120, 180, 240 ], 9, 1);
        const rad = trapAngle * PI / 180;
        const trap = new PlayerObject(880, Math.cos(rad) * trapDist, Math.sin(rad) * trapDist, 15, 1);
        objects.push(trap);
        const target = makeTarget(0, 0);
        const myPos = { x: Math.cos(HOLE) * myDist, y: Math.sin(HOLE) * myDist };
        const { engine, frame } = makeEngine(objects, target, myPos, {
          motion: { heading: HOLE, speed: 6, stability: .8, samples: [ 1, 2, 3 ] }
        });
        const encl = engine._enclosureOf(frame);
        if (!encl || !encl.enclosed) continue;
        engine._enclosure = encl;
        const profile = engine.profileFor(4);
        if (engine._gapBest(frame, profile, null) > 0) continue;        // spike already possible
        if (engine._gapBest(frame, profile, trap) <= 0) continue;       // removing it must help
        found = { objects, trap, target, myPos, engine, frame };
        break;
      }
      if (found) break;
    }
    if (found) break;
  }
  check("a trap-denies-the-spike layout exists", !!found,
    found ? "trap " + found.trap.id + " at " + Math.round(Math.hypot(found.trap.pos.current.x, found.trap.pos.current.y)) + "u" : "");
  if (found) {
    const picked = found.engine.gapFillBreakTarget();
    console.log("    break target: " + (picked ? picked.id : "none"));
    check("the denying trap is named", picked === found.trap);

    // never the trap holding the target
    {
      const { engine, frame } = makeEngine(found.objects, found.target, found.myPos, {
        targetTrapped: found.trap,
        motion: { heading: HOLE, speed: 6, stability: .8, samples: [ 1, 2, 3 ] }
      });
      engine._enclosure = engine._enclosureOf(frame);
      check("the trap holding them is never broken", engine.gapFillBreakTarget() !== found.trap);
    }
    // not with the toggle off
    {
      Settings_default._gapFillBreak = false;
      check("respects its own toggle", found.engine.gapFillBreakTarget() === null);
      Settings_default._gapFillBreak = true;
    }
    // not a trap on the far side from the way out
    {
      const objects = ring([], 900, 128, [ 0, 60, 120, 180, 240 ], 9, 1);
      const rad = 120 * PI / 180;
      objects.push(new PlayerObject(980, Math.cos(rad) * 90, Math.sin(rad) * 90, 15, 1));
      const target = makeTarget(0, 0);
      const { engine, frame } = makeEngine(objects, target, found.myPos, {
        motion: { heading: HOLE, speed: 6, stability: .8, samples: [ 1, 2, 3 ] }
      });
      engine._enclosure = engine._enclosureOf(frame);
      const pick = engine.gapFillBreakTarget();
      check("a trap away from the escape side is left alone", pick === null || pick.id !== 980);
    }
    // and never an enemy's trap
    {
      const objects = ring([], 950, 128, [ 0, 60, 120, 180, 240 ], 9, 1);
      const rad = 300 * PI / 180;
      objects.push(new PlayerObject(990, Math.cos(rad) * 85, Math.sin(rad) * 85, 15, 4));
      const target = makeTarget(0, 0);
      const { engine, frame } = makeEngine(objects, target, found.myPos, {
        motion: { heading: HOLE, speed: 6, stability: .8, samples: [ 1, 2, 3 ] }
      });
      engine._enclosure = engine._enclosureOf(frame);
      check("someone else's trap is never broken for this", engine.gapFillBreakTarget() === null);
    }
  }
}

console.log("");
if (failures) {
  console.log(failures + " gap-fill check(s) failing in " + path.relative(ROOT, BUILD_PATH) + ".");
  process.exit(1);
}
console.log("OK - the gap-fill layer behaves against synthetic trap layouts.");
