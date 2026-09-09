// Cost of one tick's auto-place legality scan, before and after.
//
// Both paths are the client's own code: SpatialHashGrid2D and GeometrySolver
// are lifted verbatim, and the two scans are the two versions of
// _getPrePlaceAngles' inner loop. Scene is a built-up fight — the case the
// placer is actually expensive in.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "Ryn_Type_2.user.js");
const lines = fs.readFileSync(SRC, "utf8").split("\n");

function lift(header, closer) {
  const start = lines.findIndex(l => l === header);
  if (start === -1) throw new Error("not found: " + header);
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === closer) return lines.slice(start, i + 1).join("\n");
  }
  throw new Error("end not found: " + header);
}

const RPE_EPS = 1e-6;
const RPE_TAU = Math.PI * 2;
const RPE_MAX_BLOCK_RADIUS = 300;
const Config_default = { mapScale: 14400, riverWidth: 724 };

const GeometrySolver = new Function("RPE_EPS", "RPE_TAU", "Config_default",
  lift("  const GeometrySolver = {", "  };") + "\n  return GeometrySolver;"
)(RPE_EPS, RPE_TAU, Config_default);

const SpatialHashGrid2D = new Function(
  lift("  class SpatialHashGrid2D {", "  }") + "\n  return SpatialHashGrid2D;"
)();

// --- scene ------------------------------------------------------------------
let seed = 0x9e3779b1;
function rnd() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5;  seed >>>= 0;
  return seed / 0x100000000;
}

const OX = 7000, OY = 4000;
const grid = new SpatialHashGrid2D(100);
const objects = new Map();
// A contested area: two players' worth of builds plus scenery, in the ~900
// unit box a placement scan actually reaches into.
const OBJECT_COUNT = 40;
for (let i = 0; i < OBJECT_COUNT; i++) {
  const a = rnd() * RPE_TAU;
  // Ring radius is ~80. A handful of builds packed against it, the rest
  // scattered out to the edge of what a scan reaches, so the ladder has both
  // blocked arcs and open ground to work with.
  const d = i < 6 ? 70 + rnd() * 60 : 200 + rnd() * 500;
  const o = {
    id: i,
    pos: { current: { x: OX + d * Math.cos(a), y: OY + d * Math.sin(a) } },
    placementScale: 25 + rnd() * 30,
    collisionScale: 25 + rnd() * 30
  };
  objects.set(i, o);
  grid.insert(o.pos.current.x, o.pos.current.y, Math.max(o.collisionScale, o.placementScale), i);
}

const SPIKE = { id: 6, scale: 49, placeOffset: -5 };
const TRAP  = { id: 15, scale: 50, placeOffset: -5 };
const PLAYER_SCALE = 35;
const ITEMS = [SPIKE, TRAP];

// --- OLD: one grid query per probed angle -----------------------------------
function scanOld(steps) {
  let placeable = 0;
  for (const item of ITEMS) {
    const ringR = PLAYER_SCALE + item.scale + item.placeOffset;
    const step = RPE_TAU / steps;
    for (let i = 0; i < steps; i++) {
      const angle = i * step;
      const cx = OX + ringR * Math.cos(angle);
      const cy = OY + ringR * Math.sin(angle);
      const blocked = grid.query(cx, cy, 4, objId => {
        const obj = objects.get(objId);
        if (!obj) return false;
        return Math.hypot(cx - obj.pos.current.x, cy - obj.pos.current.y) < item.scale + obj.placementScale;
      });
      if (blocked) continue;
      if (item.id !== 18) {
        const mid = Config_default.mapScale / 2, half = Config_default.riverWidth / 2;
        if (cy >= mid - half && cy <= mid + half) continue;
      }
      placeable++;
    }
  }
  return placeable;
}

// --- NEW: one blocker sweep for the tick, then membership tests --------------
function scanNew(steps) {
  let maxRing = 0, maxFoot = 0;
  for (const item of ITEMS) {
    maxRing = Math.max(maxRing, PLAYER_SCALE + item.scale + item.placeOffset);
    maxFoot = Math.max(maxFoot, item.scale);
  }
  const reach = maxRing + maxFoot + RPE_MAX_BLOCK_RADIUS;
  const cells = Math.ceil(reach / grid.cellSize) + 1;
  const blockers = [];
  grid.query(OX, OY, cells, id => { const o = objects.get(id); if (o) blockers.push(o); return false; });

  let placeable = 0;
  for (const item of ITEMS) {
    const ringR = PLAYER_SCALE + item.scale + item.placeOffset;
    const blocked = [];
    for (const obj of blockers) {
      const arc = GeometrySolver.occlusion(OX, OY, ringR, item.scale, obj.pos.current.x, obj.pos.current.y, obj.placementScale);
      if (arc) blocked.push(arc);
    }
    if (item.id !== 18) for (const arc of GeometrySolver.riverOcclusion(OY, ringR)) blocked.push(arc);
    const apertures = GeometrySolver.invert(GeometrySolver.merge(blocked));
    const step = RPE_TAU / steps;
    for (let i = 0; i < steps; i++) {
      if (GeometrySolver.inAperture(apertures, i * step) !== null) placeable++;
    }
  }
  return placeable;
}

function time(fn, steps, iters) {
  fn(steps); // warm
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn(steps);
  return Number(process.hrtime.bigint() - t0) / 1e6 / iters;
}

const ITERS = 2000;
console.log(`scene: ${OBJECT_COUNT} objects, spike + trap, per tick\n`);
console.log("steps   old (ms)   new (ms)   speedup   old finds   new finds");
for (const steps of [36, 72, 144]) {
  const oldMs = time(scanOld, steps, ITERS);
  const newMs = time(scanNew, steps, ITERS);
  console.log(
    String(steps).padEnd(8) +
    oldMs.toFixed(4).padEnd(11) +
    newMs.toFixed(4).padEnd(11) +
    (oldMs / newMs).toFixed(1).padStart(5) + "x" +
    String(scanOld(steps)).padStart(12) +
    String(scanNew(steps)).padStart(12)
  );
}

console.log("\nbudget: one server tick is 111.1ms");
const old72 = time(scanOld, 72, ITERS), new144 = time(scanNew, 144, ITERS);
console.log(`  shipped  72 steps, per-angle queries : ${old72.toFixed(3)}ms  (${(old72 / 111.1 * 100).toFixed(2)}% of a tick)`);
console.log(`  now     144 steps, apertures         : ${new144.toFixed(3)}ms  (${(new144 / 111.1 * 100).toFixed(2)}% of a tick)`);
