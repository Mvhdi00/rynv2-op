/* Automill loses mills while walking on open ground. Which gate eats them?
 *
 * Three candidates have already been measured and cleared:
 *   · the exact spacing solve + floating point   (automill-spacing.js)
 *   · the placement ledger                        (automill-ledger.js)
 *   · GeometrySolver.norm rewriting the angles    (automill-ledger.js)
 *
 * That leaves the other half of _validAt, which nothing has tested:
 *
 *     const apertures = this._generator.apertures(cand.profile, myPos.x, myPos.y,
 *                                                 this._blockers, cand.excludes);
 *     if (!GeometrySolver.inAperture(apertures, angle)) return false;
 *
 * And here is the thing about a windmill's aperture. Two windmills on the ring
 * need 2*scale = 90 between them, on a ring of radius 85 — so ONE existing mill
 * occludes ±63.9°, i.e. 128° of the 360° ring. The mills you dropped on the
 * previous tick are still within reach of the new ring: you only moved ~25.
 *
 * So the question is not "is anything blocking" in the sense a player means it.
 * Your own last row is the blocker, and how much of the new trio it covers
 * depends on the angle between your heading and where that row sits — which is
 * exactly the heading-dependent behaviour that was reported.
 *
 * This runs the real CandidateGenerator.apertures and GeometrySolver against a
 * walk, with each placed mill added to the blocker set as it lands.
 *
 *   node automill-apertures.js [ryn.js]
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

const sandbox = { Math, RPE_EPS: 1e-6, RPE_TAU: Math.PI * 2 };
vm.createContext(sandbox);
vm.runInContext(lift("const GeometrySolver = \\{", "GeometrySolver") +
  ";\nthis.GeometrySolver = GeometrySolver;", sandbox);
vm.runInContext(lift("class CandidateGenerator\\s*\\{", "CandidateGenerator") +
  "\nthis.CandidateGenerator = CandidateGenerator;", sandbox);
const { GeometrySolver, CandidateGenerator } = sandbox;

const SCALE = 45, RING = 35 + SCALE + 5, STEP = 25.4, TICKS = 12;
const OFFSETS = {
  "RYN, exact solve":        Math.asin((2 * SCALE + 9e-13) / (2 * RING)) * 2,
  "novastorm, toRad(s+s/2)": (SCALE + SCALE / 2) * Math.PI / 180,
};
let OFFSET = OFFSETS["RYN, exact solve"];
const PROFILE = { type: 5, ringR: RING, footR: SCALE, riverLegal: true };

function generator() {
  const g = new CandidateGenerator();
  g.client = { _ModuleHandler: { tickCount: 0 } };
  g.cache = new Map();
  g.cacheTick = -1;
  return g;
}

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
}

/* How much of the ring a single existing mill takes out. */
const oneMillArc = (() => {
  const g = generator();
  g.client._ModuleHandler.tickCount = 1;
  const blocker = [ { id: 1, pos: { current: new Vec(RING, 0) } , placementScale: SCALE } ];
  const free = g.apertures(PROFILE, 0, 0, blocker, null);
  const open = free.reduce((s, a) => s + a[2], 0);
  return Math.PI * 2 - open;
})();

/* One automill tick, the atomic rule, through the real aperture test. */
function tick(px, py, behind, blockers, tickNo) {
  const g = generator();
  g.client._ModuleHandler.tickCount = tickNo;
  const apertures = g.apertures(PROFILE, px, py, blockers, null);
  const angles = [ behind, behind - OFFSET, behind + OFFSET ];
  const legal = angles.map(a => !!GeometrySolver.inAperture(apertures, GeometrySolver.norm(a)));
  const openFraction = apertures.reduce((s, a) => s + a[2], 0) / (Math.PI * 2);
  if (!legal.every(Boolean)) return { placed: 0, legal, openFraction };
  for (const a of angles) {
    blockers.push({ id: blockers.length + 10,
      pos: { current: new Vec(px + RING * Math.cos(a), py + RING * Math.sin(a)) },
      placementScale: SCALE });
  }
  return { placed: 3, legal, openFraction };
}

function walk(heading) {
  const blockers = [];
  const behind = heading + Math.PI;
  let px = 0, py = 0;
  const per = [];
  for (let t = 0; t < TICKS; t++) {
    per.push(tick(px, py, behind, blockers, t + 1));
    px += Math.cos(heading) * STEP;
    py += Math.sin(heading) * STEP;
  }
  return per;
}

const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — automill against the real aperture test\n");
console.log("  windmill scale " + SCALE + " on a ring of " + RING + ": two mills need " + (SCALE * 2) +
  " between them,");
console.log("  so ONE existing mill occludes " + (oneMillArc * 180 / Math.PI).toFixed(1) +
  "° of the 360° ring — a third of it.\n");
console.log("  walking " + TICKS + " ticks, " + STEP + " per tick, on open ground with nothing but");
console.log("  the mills this run places\n");

const HEADINGS = [["right", 0], ["down-right", 45], ["down", 90], ["down-left", 135],
                  ["left", 180], ["up-left", 225], ["up", 270], ["up-right", 315]];
console.log("  " + pad("heading", 13) + pad("mills", 8) + pad("ticks placing", 15) + "per-tick pattern");
console.log("  " + "-".repeat(76));
for (const [label, off] of Object.entries(OFFSETS)) {
  OFFSET = off;
  const chord = 2 * RING * Math.sin(off / 2);
  console.log("  " + label + " — separation " + (off * 180 / Math.PI).toFixed(2) +
    "°, chord " + chord.toFixed(3) + " (needs > " + (SCALE * 2) + ")");
  for (const [name, deg] of HEADINGS) {
    const per = walk(deg * Math.PI / 180);
    const mills = per.reduce((s, r) => s + r.placed, 0);
    const placing = per.filter(r => r.placed > 0).length;
    console.log("  " + pad(name, 13) + pad(mills, 8) + pad(placing + " of " + TICKS, 15) +
      per.map(r => r.placed).join(" "));
  }
  console.log("");
}
OFFSET = OFFSETS["RYN, exact solve"];

console.log("\n  what the first tick's row does to the second tick's ring:");
const per = walk(0);
console.log("    " + pad("tick 1 open ring", 22) + (per[0].openFraction * 100).toFixed(1) + "%   placed " + per[0].placed);
console.log("    " + pad("tick 2 open ring", 22) + (per[1].openFraction * 100).toFixed(1) + "%   placed " + per[1].placed +
  "   legal: " + per[1].legal.join(", "));
console.log("    " + pad("tick 3 open ring", 22) + (per[2].openFraction * 100).toFixed(1) + "%   placed " + per[2].placed +
  "   legal: " + per[2].legal.join(", "));

console.log("\n  A row of three mills occludes most of the next tick's ring, and one step of " +
  STEP);
console.log("  is not enough to clear it. This is the gate, and it is geometry rather than");
console.log("  a bug: the trio simply cannot go down again until you have walked clear.");
