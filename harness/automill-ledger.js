/* Automill places one mill and drops the other two, on open ground.
 *
 * The trio is atomic now — all three pass canPlaceObject or none is sent — so
 * "one mill appeared" means the other two died AFTER placeWindmill, somewhere
 * in the engine. That path is:
 *
 *     placeWindmill(a)
 *       -> ModuleHandler.requestPlace(5, a, "autoMill")
 *         -> engine.request -> requestMany           [ONE call per mill]
 *              a = GeometrySolver.norm(angle)                   <- note this
 *              cand.x = myPos.x + profile.ringR * Math.cos(a)
 *              _validAt -> _conflicts.availableGround
 *                       -> ledger.blocked(x, y, footR=45, ...)
 *           -> _executor.flush -> _record
 *                -> _conflicts.take -> ledger.reserve(x, y, footR=45, ...)
 *
 * Three separate requestMany calls, so mill 1 is RESERVED in the ledger before
 * mill 2 is even tested. And the spacing solve puts adjacent mills exactly
 * 2*scale apart:
 *
 *     2·R·sin(asin(r/R)) = 2·R·(r/R) = 2r          for any R
 *
 * so `blocked` compares hypot against exactly 45 + 45 = 90, and the `9e-13`
 * epsilon in the offset is the entire margin. Whether that margin survives
 * depends on the floating-point path the coordinates took — and the real path
 * runs each angle through GeometrySolver.norm first:
 *
 *     norm(a) { a %= RPE_TAU; return a < 0 ? a + RPE_TAU : a; }
 *
 * `%` and `+ RPE_TAU` are not free: they change the bits of the angle, and
 * they only fire for angles outside [0, 2pi). Which of the three angles gets
 * rewritten depends on the heading. An earlier sweep (automill-spacing.js)
 * missed this because it fed raw angles straight to the ledger.
 *
 * This runs the real path: real GeometrySolver.norm, real PlacementLedger,
 * real reserve-then-test ordering, every heading.
 *
 *   node automill-ledger.js [ryn.js]
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

const sandbox = { Math, Infinity, RPE_EPS: 1e-6, RPE_TAU: Math.PI * 2, RPE_SOFT_DOMINANCE: 1.35 };
vm.createContext(sandbox);
vm.runInContext(lift("const GeometrySolver = \\{", "GeometrySolver") +
  ";\nthis.GeometrySolver = GeometrySolver;", sandbox);
vm.runInContext(lift("class PlacementLedger\\s*\\{", "PlacementLedger") +
  "\nthis.makeLedger = () => new PlacementLedger();", sandbox);
const { GeometrySolver, makeLedger } = sandbox;

const SCALE = 45, RING = 35 + SCALE + 5;   // windmill: scale 45, placeOffset 5
const OFFSET = Math.asin((2 * SCALE + 9e-13) / (2 * RING)) * 2;
const PRIORITY = 50;

/* One automill tick through the real engine ordering: for each of the three
 * angles in turn, normalise, project onto the ring, ask the ledger, and on a
 * pass reserve it before moving to the next — which is what three separate
 * requestMany calls do. */
function millsThatSurvive(heading, useNorm) {
  const ledger = makeLedger();
  let placed = 0;
  const detail = [];
  for (const raw of [ heading, heading - OFFSET, heading + OFFSET ]) {
    const a = useNorm ? GeometrySolver.norm(raw) : raw;
    const x = 0 + RING * Math.cos(a);
    const y = 0 + RING * Math.sin(a);
    // _validAt -> availableGround
    const blocked = ledger.blocked(x, y, SCALE, PRIORITY, 1e6, undefined);
    if (blocked) { detail.push("blocked"); continue; }
    // flush -> _record -> take -> reserve
    ledger.reserve(x, y, SCALE, PRIORITY, "autoMill", 1, 2);
    placed++;
    detail.push("placed");
  }
  return { placed, detail };
}

const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — automill through the real engine path\n");
console.log("  windmill scale " + SCALE + ", ring " + RING + "; the ledger rejects anything");
console.log("  closer than footR + footR = " + (SCALE * 2) + ", and the trio sits at exactly that\n");

for (const [label, useNorm] of [["with GeometrySolver.norm (the real path)", true],
                                ["raw angles (what automill-spacing.js tested)", false]]) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const byHeading = [];
  for (let deg = 0; deg < 360; deg++) {
    const r = millsThatSurvive(deg * Math.PI / 180, useNorm);
    counts[r.placed]++;
    byHeading.push(r.placed);
  }
  console.log("  " + label);
  console.log("    " + pad("3 mills", 12) + counts[3] + " of 360 headings");
  console.log("    " + pad("2 mills", 12) + counts[2] + " of 360 headings");
  console.log("    " + pad("1 mill", 12) + counts[1] + " of 360 headings");
  const COMPASS = [["right (0)", 0], ["down (90)", 90], ["left (180)", 180], ["up (270)", 270]];
  console.log("    " + COMPASS.map(([n, d]) => n + ": " + byHeading[d]).join("   "));
  console.log("");
}

/* How much daylight there actually is, and how much the normalise costs. */
console.log("  the margin, measured:");
const a0 = 1.0, a1 = a0 + OFFSET;
const gap = (u, v) => Math.hypot(RING * Math.cos(u) - RING * Math.cos(v),
                                 RING * Math.sin(u) - RING * Math.sin(v));
console.log("    " + pad("raw pair", 26) + gap(a0, a1).toFixed(12) +
  "   margin " + (gap(a0, a1) - 2 * SCALE).toExponential(2));
const n0 = GeometrySolver.norm(a0 - 7 * Math.PI * 2), n1 = GeometrySolver.norm(a1 - 7 * Math.PI * 2);
console.log("    " + pad("after norm from -7 turns", 26) + gap(n0, n1).toFixed(12) +
  "   margin " + (gap(n0, n1) - 2 * SCALE).toExponential(2));

const real = (() => {
  let three = 0;
  for (let deg = 0; deg < 360; deg++) if (millsThatSurvive(deg * Math.PI / 180, true).placed === 3) three++;
  return three;
})();
console.log("\n  " + (real === 360
  ? "three mills at every heading — the ledger is not what is losing them"
  : "the trio is lost at " + (360 - real) + " of 360 headings: the spacing is exactly the\n" +
    "  ledger's own rejection distance, so the margin is a rounding artefact"));
process.exit(real === 360 ? 0 : 1);
