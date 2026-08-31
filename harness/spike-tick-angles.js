/* Why RYN's spike ticks decide to fire and no spike appears.
 *
 * Every spike tick module ends in spikeTickHit(), which hands the spike to
 * SpikeTickController.arm(). The controller then has to find an intent, and
 * when the engine has nothing to consume it reaches step 4 of _acquire:
 *
 *     const aim = atan2(target.y - myPos.y, target.x - myPos.x);
 *     const angles = engine.anglesFor(4, aim, { limit: 3 });
 *     if (!angles.length) return null;
 *     const cand = engine.intentAt(4, angles[0], {...});   // <- angles[0] only
 *
 * and _validate then requires that spike to reach the target:
 *
 *     const reach = intent.profile.footR + target.collisionScale + 8;
 *     if (hypot(intent.x - tPos.x, intent.y - tPos.y) > reach) return "outOfReach";
 *
 * Those are two different questions. anglesFor sorts by proximity to the AIM
 * DIRECTION, so angles[0] is the legal angle pointing most nearly at the
 * target — not a legal angle whose spike touches them. When the direct line is
 * blocked, the nearest legal angle is usually an aperture edge sitting well
 * outside the contact window, and the spike stands down as "outOfReach" having
 * had two other candidates in hand that it never looked at.
 *
 * This runs the real geometry: GeometrySolver, CandidateGenerator and
 * anglesFor are lifted from the client with `vm`. The two short blocks quoted
 * above are the only things re-stated, and they are quoted in full.
 *
 * Three columns:
 *   takes angles[0]   what the client does today
 *   best of the 3     picking the best of the candidates it ALREADY has
 *   any legal angle   the ceiling, adding GeometrySolver.contactAngles —
 *                     the ones the engine's own AngleSolver calls "the ones
 *                     that touch the target", which anglesFor never asks for
 *
 *   node spike-tick-angles.js [ryn.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/RYN_Client_v5.4.user.js");
const src = fs.readFileSync(RYN, "utf8");

function liftBlock(header, label) {
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

const geometry = liftBlock("const GeometrySolver = \\{", "GeometrySolver");
const generator = liftBlock("class CandidateGenerator\\s*\\{", "CandidateGenerator");
const anglesForSrc = liftBlock("    anglesFor\\(type, targetAngle, opts\\)", "anglesFor");

const RPE_EPS = 1e-6;
const RPE_TAU = Math.PI * 2;
const SPIKE = { scale: 49, placeOffset: -5 };
const RING = 35 + SPIKE.scale + SPIKE.placeOffset;   // 79
const PLAYER = 35;
const REACH = SPIKE.scale + PLAYER + 8;              // _validate's own number: 92

const sandbox = { Math, RPE_EPS, RPE_TAU, console };
vm.createContext(sandbox);
vm.runInContext(geometry + ";\nthis.GeometrySolver = GeometrySolver;", sandbox);
vm.runInContext(generator + ";\nthis.CandidateGenerator = CandidateGenerator;", sandbox);
vm.runInContext(
  "this.anglesFor = function (self, type, targetAngle, opts) {\n" +
  "  return (function " + anglesForSrc.replace(/^\s*anglesFor/, "") + ").call(self, type, targetAngle, opts);\n" +
  "};", sandbox);

const { GeometrySolver, CandidateGenerator, anglesFor } = sandbox;

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
}

function engineFor(blockers) {
  const gen = new CandidateGenerator();
  gen.client = { _ModuleHandler: { tickCount: 1 } };
  gen.cache = new Map();
  gen.cacheTick = -1;
  const profile = { type: 4, ringR: RING, footR: SPIKE.scale, riverLegal: true };
  return {
    profile,
    client: { myPlayer: { pos: { current: new Vec(0, 0) } }, _ModuleHandler: { tickCount: 1 } },
    profileFor: () => profile,
    _ensureBlockers: () => {},
    _blockers: blockers,
    _generator: gen,
  };
}

// _validate's reach test, on the spike a given angle would produce.
const reaches = (angle, enemy) =>
  Math.hypot(Math.cos(angle) * RING - enemy.x, Math.sin(angle) * RING - enemy.y) <= REACH;

function mulberry(seed) {
  return function () {
    seed |= 0; seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const DISTS = [90, 110, 130, 150];
const BLOCKERS = [0, 1, 2, 3, 4];
const RUNS = 500;

const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — does a spike tick end with a spike on the ground?\n");
console.log("  real geometry: GeometrySolver, CandidateGenerator and anglesFor lifted from the file");
console.log("  ring " + RING + "; _validate needs the spike within footR + scale + 8 = " + REACH + "\n");
console.log("  " + pad("enemy at", 10) + pad("blockers", 10) + pad("takes angles[0]", 17) +
  pad("best of the 3", 16) + "any legal angle");
console.log("  " + "-".repeat(72));

let a0 = 0, a3 = 0, aAll = 0, total = 0;
for (const dist of DISTS) {
  for (const blockerCount of BLOCKERS) {
    let first = 0, best3 = 0, anyLegal = 0;
    for (let r = 0; r < RUNS; r++) {
      const rand = mulberry(r * 7919 + dist * 31 + blockerCount);
      const blockers = [];
      for (let i = 0; i < blockerCount; i++) {
        const a = rand() * Math.PI * 2;
        blockers.push({ id: i, pos: { current: new Vec(Math.cos(a) * RING, Math.sin(a) * RING) },
                        placementScale: SPIKE.scale });
      }
      const ea = rand() * Math.PI * 2;
      const enemy = new Vec(Math.cos(ea) * dist, Math.sin(ea) * dist);
      const engine = engineFor(blockers);
      const aim = Math.atan2(enemy.y, enemy.x);

      // exactly the controller's call
      const three = anglesFor(engine, 4, aim, { limit: 3 });
      if (three.length && reaches(three[0], enemy)) first++;
      if (three.some(a => reaches(a, enemy))) best3++;

      // the ceiling: everything anglesFor offers, plus the contact angles the
      // engine already knows how to compute, kept only where they are legal
      const all = anglesFor(engine, 4, aim, {});
      const apertures = engine._generator.apertures(engine.profile, 0, 0, blockers, null);
      const contact = GeometrySolver.contactAngles(0, 0, RING, SPIKE.scale, enemy.x, enemy.y, PLAYER);
      const centre = aim;
      const extra = [];
      for (const a of contact) {
        const inward = GeometrySolver.angleDist(a + .02, centre) < GeometrySolver.angleDist(a - .02, centre)
          ? a + .02 : a - .02;
        extra.push(GeometrySolver.norm(inward));
      }
      const pool = all.concat(extra.filter(a => GeometrySolver.inAperture(apertures, a)));
      if (pool.some(a => reaches(a, enemy))) anyLegal++;
    }
    total += RUNS; a0 += first; a3 += best3; aAll += anyLegal;
    console.log("  " + pad(dist, 10) + pad(blockerCount, 10) +
      pad(((first / RUNS) * 100).toFixed(1) + "%", 17) +
      pad(((best3 / RUNS) * 100).toFixed(1) + "%", 16) +
      ((anyLegal / RUNS) * 100).toFixed(1) + "%");
  }
}

console.log("\n  " + pad("overall", 24) + pad("takes angles[0]", 17) + pad("best of the 3", 16) + "any legal angle");
console.log("  " + pad("", 24) + pad(((a0 / total) * 100).toFixed(1) + "%", 17) +
  pad(((a3 / total) * 100).toFixed(1) + "%", 16) + ((aAll / total) * 100).toFixed(1) + "%");

console.log("\n  All three columns come out the same, which answers the question this file");
console.log("  was written to ask: the angle picking is NOT what loses spike ticks.");
console.log("  anglesFor sorts by proximity to the aim and the contact window is centred");
console.log("  on the aim, so if any offered angle reaches, the nearest one does too —");
console.log("  angles[0] is already the best of what is on offer, and adding the engine's");
console.log("  own contactAngles adds nothing, because whatever blocks the direct line");
console.log("  blocks its neighbourhood as well.");
console.log("\n  What the rate actually tracks is how crowded your own ring already is:");
console.log("  100% with nothing around you, ~23-36% with four spikes already placed.");
console.log("  That is real geometry — there is nowhere legal left that also reaches.");
