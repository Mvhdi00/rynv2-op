// Concrete before/after, measured against the client's own geometry.
// Boards are generated, not hand-placed, so the cases below are ones the
// geometry actually produces rather than ones chosen to make a point.

const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "..", "Ryn_Type_2.user.js");
const lines = fs.readFileSync(SRC, "utf8").split("\n");
function lift(header, closer) {
  const s = lines.findIndex(l => l === header);
  for (let i = s + 1; i < lines.length; i++) if (lines[i] === closer) return lines.slice(s, i + 1).join("\n");
  throw new Error(header);
}
const RPE_EPS = 1e-6, RPE_TAU = Math.PI * 2;
const Config_default = { mapScale: 14400, riverWidth: 724, playerScale: 35 };
const GeometrySolver = new Function("RPE_EPS", "RPE_TAU", "Config_default",
  lift("  const GeometrySolver = {", "  };") + "\n  return GeometrySolver;")(RPE_EPS, RPE_TAU, Config_default);

const SPIKE = { scale: 49, placeOffset: -5 };
const RING = 35 + SPIKE.scale + SPIKE.placeOffset;      // 79
const ME = { x: 7000, y: 4000 };
const deg = r => (r * 180 / Math.PI);

function apertures(blockers) {
  const blocked = [];
  for (const b of blockers) {
    const arc = GeometrySolver.occlusion(ME.x, ME.y, RING, SPIKE.scale, b.x, b.y, b.r);
    if (arc) blocked.push(arc);
  }
  for (const arc of GeometrySolver.riverOcclusion(ME.y, RING)) blocked.push(arc);
  return GeometrySolver.invert(GeometrySolver.merge(blocked));
}
const scan = (aps, steps) => {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const a = i * RPE_TAU / steps;
    if (GeometrySolver.inAperture(aps, a) !== null) out.push(a);
  }
  return out;
};
// Would a spike placed at `angle` touch the enemy?
function hits(angle, enemy) {
  const x = ME.x + RING * Math.cos(angle), y = ME.y + RING * Math.sin(angle);
  return Math.hypot(x - enemy.x, y - enemy.y) < SPIKE.scale + enemy.scale;
}

let seed = 12345;
const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >> 17; seed ^= seed << 5; seed >>>= 0; return seed / 0x100000000; };

// A fight board: the enemy close, and builds packed around you the way they
// are when a spike fight has been going for a few seconds.
function board() {
  const enemyAngle = rnd() * RPE_TAU;
  const enemyDist = 90 + rnd() * 90;
  const enemy = { x: ME.x + enemyDist * Math.cos(enemyAngle), y: ME.y + enemyDist * Math.sin(enemyAngle), scale: 35 };
  const blockers = [];
  const n = 3 + ((rnd() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const a = rnd() * RPE_TAU;
    const d = RING * (0.85 + rnd() * 1.9);
    blockers.push({ x: ME.x + d * Math.cos(a), y: ME.y + d * Math.sin(a), r: 45 + rnd() * 10 });
  }
  return { enemy, blockers };
}

console.log("=".repeat(78));
console.log("HOW THE RING ACTUALLY LOOKS");
console.log("=".repeat(78));
{
  const b = [ { x: ME.x + RING, y: ME.y, r: 49 } ];
  const arc = GeometrySolver.occlusion(ME.x, ME.y, RING, SPIKE.scale, b[0].x, b[0].y, b[0].r);
  console.log(`  ring radius for a spike          : ${RING} units`);
  console.log(`  one spike sitting on that ring   : blocks ${deg(arc[1] - arc[0]).toFixed(0)} deg of it`);
  console.log(`  so legal ground is a few wide arcs, and the slots between`);
  console.log(`  two builds are thin. that is where the step size matters.`);
  console.log("");
  console.log(`  step size:   36 -> ${(360/36).toFixed(1)} deg (${(RPE_TAU/36*RING).toFixed(1)} units of arc)`);
  console.log(`               72 -> ${(360/72).toFixed(1)} deg (${(RPE_TAU/72*RING).toFixed(1)} units)`);
  console.log(`              144 -> ${(360/144).toFixed(1)} deg (${(RPE_TAU/144*RING).toFixed(1)} units)`);
}

console.log("");
console.log("=".repeat(78));
console.log("10,000 FIGHT BOARDS - what each resolution finds");
console.log("=".repeat(78));
const N = 10000;
let stat = {
  36: { none: 0, noHit: 0, angles: 0 },
  72: { none: 0, noHit: 0, angles: 0 },
  144: { none: 0, noHit: 0, angles: 0 }
};
let blindSpot = null, missedHit = null;
for (let t = 0; t < N; t++) {
  const { enemy, blockers } = board();
  const aps = apertures(blockers);
  const res = {};
  for (const steps of [ 36, 72, 144 ]) {
    const found = scan(aps, steps);
    const hitting = found.filter(a => hits(a, enemy));
    res[steps] = { found, hitting };
    stat[steps].angles += found.length;
    if (found.length === 0) stat[steps].none++;
    if (hitting.length === 0) stat[steps].noHit++;
  }
  // The two cases that actually cost you a build.
  if (!blindSpot && res[72].found.length === 0 && res[144].found.length > 0) {
    blindSpot = { enemy, blockers, aps, res };
  }
  if (!missedHit && res[72].hitting.length === 0 && res[144].hitting.length > 0) {
    missedHit = { enemy, blockers, aps, res };
  }
}
console.log("");
console.log("  steps   avg legal angles   found nothing at all   found nothing that hits");
for (const steps of [ 36, 72, 144 ]) {
  const s = stat[steps];
  console.log(
    "   " + String(steps).padEnd(8) +
    (s.angles / N).toFixed(1).padStart(8) + "        " +
    (`${(s.none / N * 100).toFixed(2)}%`).padStart(10) + "            " +
    (`${(s.noHit / N * 100).toFixed(2)}%`).padStart(10)
  );
}
console.log("");
console.log(`  going 72 -> 144 turns ${((stat[72].none - stat[144].none) / N * 100).toFixed(2)}% of ticks from`);
console.log(`  "nowhere to build" into "somewhere to build",`);
console.log(`  and ${((stat[72].noHit - stat[144].noHit) / N * 100).toFixed(2)}% from "no spike reaches them" into "one does".`);

if (missedHit) {
  console.log("");
  console.log("=".repeat(78));
  console.log("ONE OF THOSE BOARDS, IN FULL");
  console.log("=".repeat(78));
  const { enemy, blockers, aps, res } = missedHit;
  const ea = Math.atan2(enemy.y - ME.y, enemy.x - ME.x);
  console.log(`  enemy: ${Math.hypot(enemy.x - ME.x, enemy.y - ME.y).toFixed(0)} units away, at ${deg(ea).toFixed(1)} deg`);
  console.log(`  builds around you: ${blockers.length}`);
  console.log(`  legal arcs left on the ring:`);
  for (const ap of aps) {
    console.log(`     ${deg(ap[0]).toFixed(1).padStart(7)} .. ${deg(ap[1]).toFixed(1).padStart(7)} deg   (${deg(ap[2]).toFixed(1)} deg wide)`);
  }
  console.log("");
  console.log(`  BEFORE  (72 steps): ${res[72].found.length} legal angle(s), ${res[72].hitting.length} land on the enemy`);
  console.log(`                      -> no spike is placed that touches them this tick`);
  console.log(`  AFTER  (144 steps): ${res[144].found.length} legal angle(s), ${res[144].hitting.length} land on the enemy`);
  for (const a of res[144].hitting.slice(0, 3)) {
    console.log(`                      -> spike at ${deg(a).toFixed(1)} deg hits`);
  }
}
