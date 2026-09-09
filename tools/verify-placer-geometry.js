// Differential test: the aperture solver vs. the per-angle circle test it
// replaces in AutoPlacer._getPrePlaceAngles.
//
// GeometrySolver is lifted verbatim out of the client, so this exercises the
// shipped code rather than a restatement of it. The reference is Luna's
// _canPlace, also transcribed verbatim: one distance test per object at
// `placementScale`, plus the river band unless the item is the platform.
//
// Any angle where the two disagree by more than a hair either side of a
// boundary is a real behaviour change and fails the run.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "Ryn_Type_2.user.js");
const lines = fs.readFileSync(SRC, "utf8").split("\n");

// --- lift GeometrySolver out of the client ---------------------------------
const start = lines.findIndex(l => l === "  const GeometrySolver = {");
if (start === -1) throw new Error("GeometrySolver not found");
let end = -1;
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i] === "  };") { end = i; break; }
}
if (end === -1) throw new Error("GeometrySolver end not found");
const solverSrc = lines.slice(start, end + 1).join("\n");

const RPE_EPS = 1e-6;
const RPE_TAU = Math.PI * 2;
const Config_default = { mapScale: 14400, riverWidth: 724 };

const GeometrySolver = new Function(
  "RPE_EPS", "RPE_TAU", "Config_default",
  solverSrc + "\n  return GeometrySolver;"
)(RPE_EPS, RPE_TAU, Config_default);

// --- the reference: Luna's _canPlace, verbatim ------------------------------
function canPlaceReference(cx, cy, footR, itemId, blockers, excludeObj) {
  for (const obj of blockers) {
    if (excludeObj && obj === excludeObj) continue;
    if (Math.hypot(cx - obj.x, cy - obj.y) < footR + obj.placementScale) return false;
  }
  if (itemId !== 18) {
    const mid = Config_default.mapScale / 2;
    const riverHalf = Config_default.riverWidth / 2;
    if (cy >= mid - riverHalf && cy <= mid + riverHalf) return false;
  }
  return true;
}

// --- the candidate: apertures, exactly as _getPrePlaceAngles now uses them ---
function aperturesFor(ox, oy, ringR, footR, riverLegal, blockers, excludeObj) {
  const blocked = [];
  for (const obj of blockers) {
    if (excludeObj && obj === excludeObj) continue;
    const arc = GeometrySolver.occlusion(ox, oy, ringR, footR, obj.x, obj.y, obj.placementScale);
    if (arc) blocked.push(arc);
  }
  if (!riverLegal) {
    for (const arc of GeometrySolver.riverOcclusion(oy, ringR)) blocked.push(arc);
  }
  return GeometrySolver.invert(GeometrySolver.merge(blocked));
}

// --- fuzz -------------------------------------------------------------------
let seed = 0x2f6e2b1;
function rnd() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5;  seed >>>= 0;
  return seed / 0x100000000;
}

const ITEMS = [
  { name: "spikes",       id: 6,  scale: 49, placeOffset: -5 },
  { name: "pit trap",     id: 15, scale: 50, placeOffset: -5 },
  { name: "platform",     id: 18, scale: 43, placeOffset: -5 },
];
const PLAYER_SCALE = 35;

let cases = 0, angleChecks = 0, mismatches = 0, boundarySkips = 0;
const samples = [];

for (let trial = 0; trial < 3000; trial++) {
  const item = ITEMS[(rnd() * ITEMS.length) | 0];
  const ringR = PLAYER_SCALE + item.scale + item.placeOffset;
  const footR = item.scale;

  // Origin: mostly open map, but 1 in 4 deliberately on the river band so the
  // horizontal-strip solver is exercised at every offset through it.
  const ox = 1000 + rnd() * 12000;
  const oy = rnd() < 0.25
    ? Config_default.mapScale / 2 - 500 + rnd() * 1000
    : 1000 + rnd() * 12000;

  // Blockers clustered on the ring, where the geometry is interesting, plus a
  // few far away and a few swallowing the origin entirely.
  const blockers = [];
  const n = (rnd() * 12) | 0;
  for (let i = 0; i < n; i++) {
    const roll = rnd();
    let d, r;
    if (roll < 0.65)      { d = ringR * (0.5 + rnd() * 1.2); r = 20 + rnd() * 70; }
    else if (roll < 0.85) { d = rnd() * 30;                  r = 20 + rnd() * 260; }
    else                  { d = ringR + 100 + rnd() * 400;   r = 20 + rnd() * 300; }
    const a = rnd() * RPE_TAU;
    blockers.push({ x: ox + d * Math.cos(a), y: oy + d * Math.sin(a), placementScale: r });
  }

  const excludeObj = blockers.length && rnd() < 0.3 ? blockers[(rnd() * blockers.length) | 0] : null;
  const apertures = aperturesFor(ox, oy, ringR, footR, item.id === 18, blockers, excludeObj);
  cases++;

  for (const steps of [36, 72, 144]) {
    const step = RPE_TAU / steps;
    for (let i = 0; i < steps; i++) {
      const angle = i * step;
      const cx = ox + ringR * Math.cos(angle);
      const cy = oy + ringR * Math.sin(angle);

      const expected = canPlaceReference(cx, cy, footR, item.id, blockers, excludeObj);
      const actual = GeometrySolver.inAperture(apertures, angle) !== null;
      angleChecks++;
      if (expected === actual) continue;

      // A disagreement is only meaningful away from a boundary. Both sides use
      // strict/inclusive comparisons at exactly the touching distance, and the
      // aperture carries an epsilon, so an angle sitting within a whisker of a
      // blocker's edge or the river's edge may legitimately fall either way.
      let onBoundary = false;
      for (const obj of blockers) {
        if (excludeObj && obj === excludeObj) continue;
        const slack = Math.abs(Math.hypot(cx - obj.x, cy - obj.y) - (footR + obj.placementScale));
        if (slack < 1e-3) { onBoundary = true; break; }
      }
      if (!onBoundary && item.id !== 18) {
        const mid = Config_default.mapScale / 2, half = Config_default.riverWidth / 2;
        if (Math.abs(cy - (mid - half)) < 1e-3 || Math.abs(cy - (mid + half)) < 1e-3) onBoundary = true;
      }
      if (onBoundary) { boundarySkips++; continue; }

      mismatches++;
      if (samples.length < 5) {
        samples.push({ item: item.name, steps, i, angle: angle.toFixed(6), expected, actual,
                       ox: ox.toFixed(1), oy: oy.toFixed(1), blockers: blockers.length });
      }
    }
  }
}

console.log(`layouts        ${cases}`);
console.log(`angle checks   ${angleChecks}`);
console.log(`boundary ties  ${boundarySkips}`);
console.log(`mismatches     ${mismatches}`);
if (samples.length) console.log(JSON.stringify(samples, null, 2));
if (mismatches > 0) { console.log("FAIL"); process.exit(1); }
console.log("PASS - aperture legality matches the per-angle test");
