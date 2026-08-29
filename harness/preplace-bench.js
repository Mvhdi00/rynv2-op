/* Measures novastorm's preplace angle search: correctness, cost and coverage.
 *
 * The geometry added to getPrePlaceAngles decides which angles are worth handing
 * to checkItemLocation. That is only safe if it never rules out an angle
 * checkItemLocation would have accepted, so the first thing this checks is
 * exactly that, against a 0.5 degree reference sweep over random object layouts.
 *
 * It then reports what the change buys: how many checkItemLocation calls the old
 * 72-angle scan made versus the new one, and how often the 5 degree grid was
 * blind to a gap that a real placement fits through.
 *
 *   node preplace-bench.js [client.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CLIENT = process.argv[2] || path.resolve(__dirname, "../novastorm/Novastorm_1.41.4.user.js");
const src = fs.readFileSync(CLIENT, "utf8");

/* Lift the geometry helpers straight out of the client so the test runs the
 * shipped code, not a copy of it. */
function slice(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error("marker not found: " + startMarker);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error("end marker not found: " + endMarker);
  return src.slice(start, end + endMarker.length);
}

const hasGeometry = src.includes("function ppBlockedArc");

/* Each client scans at its own resolution, so compare each against its own —
 * hardcoding 72 flatters a client that scans 144 and would report half its real
 * cost. */
const stepMatch = src.match(/prePlaceSteps:\s*(\d+)/);
const STEPS = stepMatch ? Number(stepMatch[1]) : 72;
const geometry = hasGeometry
  ? slice("const PP_EPS = 1e-6;", "        function getPrePlaceAngles(id, customObjects) {").replace(/function getPrePlaceAngles[\s\S]*$/, "")
  : "";

const sandbox = {
  Math,
  UTILS: { getDirection: (x1, y1, x2, y2) => Math.atan2(y1 - y2, x1 - x2) },
  items: null,
  visibleObjects: null,
  myPlayer: null,
};
vm.createContext(sandbox);
if (hasGeometry) vm.runInContext(geometry, sandbox);

/* checkItemLocation's object test, verbatim in behaviour. */
function checkItemLocation(x, y, s, objects) {
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    const blockS = o.blocker ? o.blocker : o.getScale(0.6, o.isItem);
    if (o.active && Math.hypot(x - o.x, y - o.y) < s + blockS) return false;
  }
  return true;
}

function makeScene(rand, count) {
  const objects = [];
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 40 + rand() * 120;
    const scale = 20 + rand() * 45;
    objects.push({
      active: true,
      isItem: true,
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      scale,
      getScale() { return scale; },
    });
  }
  return objects;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ITEM_SCALE = 35;          // spike
const RING = 35 + ITEM_SCALE;   // player scale + item scale
const REF_STEPS = 720;          // 0.5 degree ground truth

let unsafe = 0;                 // geometry said blocked, reality said placeable
let oldCalls = 0, newCalls = 0;
let gridMissed = 0, edgeFound = 0, scenes = 0, refPlaceableScenes = 0;

const rand = mulberry32(12345);
for (let n = 0; n < 400; n++) {
  const objects = makeScene(rand, 3 + Math.floor(rand() * 10));
  sandbox.myPlayer = { x2: 0, y2: 0 };
  sandbox.items = { list: { 0: { scale: ITEM_SCALE, placeOffset: 0 } } };
  sandbox.visibleObjects = objects;
  scenes++;

  const at = (angle) => ({ x: Math.cos(angle) * RING, y: Math.sin(angle) * RING });

  // Ground truth: which angles genuinely accept a placement.
  const refOk = [];
  for (let i = 0; i < REF_STEPS; i++) {
    const a = (i / REF_STEPS) * Math.PI * 2;
    const p = at(a);
    if (checkItemLocation(p.x, p.y, ITEM_SCALE, objects)) refOk.push(a);
  }
  if (refOk.length) refPlaceableScenes++;

  // This client's own scan: every angle costs a checkItemLocation call.
  let gridOk = 0;
  for (let i = 0; i < STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    oldCalls++;
    const p = at(a);
    if (checkItemLocation(p.x, p.y, ITEM_SCALE, objects)) gridOk++;
  }

  if (!hasGeometry) {
    // No arcs to compare against, but its own blindness is still measurable.
    if (gridOk === 0 && refOk.length > 0) gridMissed++;
    continue;
  }

  // New scan: geometry first, checkItemLocation only inside free arcs.
  sandbox.__arcs = null;
  vm.runInContext("__arcs = getPlaceableArcs(0, visibleObjects);", sandbox);
  const arcs = sandbox.__arcs;

  const inFree = (a) => { sandbox.__a = a; return vm.runInContext("ppInFreeArc(__arcs, __a)", sandbox); };

  // Safety: nothing the reference accepts may fall outside the free arcs.
  for (const a of refOk) if (!inFree(a)) unsafe++;

  let newOk = 0;
  for (let i = 0; i < STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    if (!inFree(a)) continue;
    newCalls++;
    const p = at(a);
    if (checkItemLocation(p.x, p.y, ITEM_SCALE, objects)) newOk++;
  }

  // Arc edges are extra candidates the grid never had.
  let edgeOk = 0;
  for (const [s, e] of arcs) {
    for (const a of [s + 0.002, e - 0.002]) {
      newCalls++;
      const p = at(a);
      if (checkItemLocation(p.x, p.y, ITEM_SCALE, objects)) edgeOk++;
    }
  }

  // A gap the grid was blind to but a placement really fits through.
  if (gridOk === 0 && refOk.length > 0) {
    gridMissed++;
    if (edgeOk > 0) edgeFound++;
  }
}

const pct = (a, b) => b ? (100 * a / b).toFixed(1) + "%" : "n/a";
console.log(path.basename(CLIENT));
console.log("  arc geometry:                ", hasGeometry ? "yes" : "NO — tests every angle");
console.log("  scenes:                      ", scenes, "(" + refPlaceableScenes + " with a real placement)");
console.log("  this client scans:           ", STEPS, "angles (" + (360 / STEPS).toFixed(1) + " deg apart)");
console.log("  checkItemLocation, own scan: ", oldCalls);
if (hasGeometry) {
  console.log("  checkItemLocation, with arcs:", newCalls, "(" + pct(newCalls, oldCalls) + " of old)");
  console.log("  valid angles wrongly skipped:", unsafe, unsafe === 0 ? "  <- safe" : "  <- UNSAFE");
  console.log("  scenes its grid was blind to:", gridMissed, "of", refPlaceableScenes, "(" + pct(gridMissed, refPlaceableScenes) + ")");
  console.log("  ...of those, arc edges found:", edgeFound, "(" + pct(edgeFound, gridMissed) + ")");
} else {
  console.log("  scenes its grid was blind to:", gridMissed, "of", refPlaceableScenes,
    "(" + pct(gridMissed, refPlaceableScenes) + ") — nothing to recover them");
}
