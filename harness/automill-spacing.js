/* Automill drops three mills behind you. Why does the count depend on which
 * way you are walking?
 *
 * Reported: one mill going right, two going forward/left, three going down.
 * A count that depends on heading means something in the arithmetic is
 * heading-sensitive, and there is only one place it can be.
 *
 * RYN spaces the trio with (Automill.postTick):
 *
 *     const distance = myPlayer.getItemPlaceScale(item.id);
 *     const offset = Math.asin((2 * item.scale + 9e-13) / (2 * distance)) * 2;
 *     const leftAngle  = angle - offset;
 *     const rightAngle = angle + offset;
 *
 * That solve is exact, and that is the problem. For a ring of radius R and an
 * item of radius r, two placements separated by 2·asin(r/R) sit a chord of
 *
 *     2·R·sin(asin(r/R)) = 2·R·(r/R) = 2r
 *
 * apart — algebraically EXACTLY touching, for any R. The `9e-13` nudges it to
 * 2r + ~1e-12 of daylight. Meanwhile every sibling has to clear the placement
 * ledger, which rejects on
 *
 *     Math.hypot(x - e.x, y - e.y) < radius + e.radius        // 45 + 45 = 90
 *
 * and those coordinates come from `cos(θ)·R` and `sin(θ)·R`, whose rounding
 * error is the same order as the daylight the epsilon bought. So whether a
 * sibling clears the ledger is decided by how cos and sin happen to round at
 * that particular heading.
 *
 * Novastorm's spacing is `toRad(scale + scale/2)` — a degrees-for-radians
 * approximation RYN's own comment calls out as inexact. It is inexact in the
 * useful direction: it is WIDER than touching, by over a unit, so no amount of
 * rounding can make two mills collide.
 *
 * This sweeps every heading and counts, using the client's real ledger.
 *
 *   node automill-spacing.js [ryn.js]
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

const sandbox = { Math, Infinity, RPE_SOFT_DOMINANCE: 1.35 };
vm.createContext(sandbox);
vm.runInContext(lift("class PlacementLedger\\s*\\{", "PlacementLedger") +
  "\nthis.make = () => new PlacementLedger();", sandbox);

// windmill: scale 45, placeOffset 5 -> ring 35 + 45 + 5 = 85
const SCALE = 45, RING = 35 + SCALE + 5;

const OFFSETS = {
  "RYN, exact solve":      Math.asin((2 * SCALE + 9e-13) / (2 * RING)) * 2,
  "novastorm, toRad(s+s/2)": (SCALE + SCALE / 2) * Math.PI / 180,
};

/* One tick of automill at a given heading: three angles, each reserved in turn
 * exactly as ModuleHandler.requestPlace -> requestMany -> _validAt does. */
function millsPlaced(heading, offset) {
  const ledger = sandbox.make();
  let placed = 0;
  for (const a of [ heading, heading - offset, heading + offset ]) {
    const x = Math.cos(a) * RING;
    const y = Math.sin(a) * RING;
    // the engine reserves with the profile's footR, which is item.scale
    const token = ledger.reserve(x, y, SCALE, 50, "autoMill", 1, 3);
    if (token !== false) placed++;
  }
  return placed;
}

const HEADINGS = [];
for (let deg = 0; deg < 360; deg += 1) HEADINGS.push(deg);

const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — automill, mills placed per heading\n");
console.log("  windmill scale " + SCALE + ", ring " + RING + ", ledger rejects closer than " +
  (SCALE * 2) + "\n");

const results = {};
for (const [label, offset] of Object.entries(OFFSETS)) {
  const chord = 2 * RING * Math.sin(offset / 2);
  const counts = { 1: 0, 2: 0, 3: 0 };
  const byHeading = [];
  for (const deg of HEADINGS) {
    const n = millsPlaced(deg * Math.PI / 180, offset);
    counts[n] = (counts[n] || 0) + 1;
    byHeading.push(n);
  }
  results[label] = { counts, byHeading, chord, offset };
  console.log("  " + label);
  console.log("    " + pad("separation", 16) + offset.toFixed(6) + " rad = " +
    (offset * 180 / Math.PI).toFixed(3) + " deg");
  console.log("    " + pad("chord", 16) + chord.toFixed(9) + "   needs > " + (SCALE * 2) +
    "   daylight " + (chord - SCALE * 2).toExponential(2));
  console.log("    " + pad("3 mills", 16) + counts[3] + " of 360 headings");
  console.log("    " + pad("2 mills", 16) + counts[2] + " of 360 headings");
  console.log("    " + pad("1 mill", 16) + counts[1] + " of 360 headings");
  console.log("");
}

// Where it fails, by compass point, since that is how it was reported.
const ryn = results["RYN, exact solve"];
const COMPASS = [["right (0)", 0], ["down-right (45)", 45], ["down (90)", 90],
                 ["down-left (135)", 135], ["left (180)", 180], ["up-left (225)", 225],
                 ["up (270)", 270], ["up-right (315)", 315]];
console.log("  by heading, as reported:");
console.log("    " + pad("walking", 20) + pad("RYN", 8) + "novastorm spacing");
console.log("    " + "-".repeat(46));
for (const [name, deg] of COMPASS) {
  console.log("    " + pad(name, 20) +
    pad(ryn.byHeading[deg] + " mill" + (ryn.byHeading[deg] === 1 ? "" : "s"), 8) +
    results["novastorm, toRad(s+s/2)"].byHeading[deg] + " mills");
}

const rynOk = ryn.counts[3] === 360;
const novaOk = results["novastorm, toRad(s+s/2)"].counts[3] === 360;
console.log("\n  " + (rynOk
  ? "RYN places three at every heading"
  : "RYN loses a mill at " + (360 - ryn.counts[3]) + " of 360 headings — the exact solve puts" +
    "\n  siblings exactly touching, so cos/sin rounding decides whether they fit"));
console.log("  " + (novaOk
  ? "novastorm's wider spacing places three at every heading"
  : "novastorm's spacing also fails at " + (360 - results["novastorm, toRad(s+s/2)"].counts[3])));
process.exit(rynOk ? 0 : 1);
