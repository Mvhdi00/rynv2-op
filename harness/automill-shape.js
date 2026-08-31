/* Automill builds a ragged wall — one mill here, two there, three somewhere
 * else. Why, and what do the other clients do?
 *
 * The trio geometry is identical in RYN and Glotus, to the character:
 *
 *     const offset = Math.asin((2 * item.scale + 9e-13) / (2 * distance)) * 2;
 *     const leftAngle  = angle - offset;
 *     const rightAngle = angle + offset;
 *
 * The whole difference is what happens when one of the three does not fit.
 *
 *   GLOTUS   all three, or none:
 *     if (canPlaceWindmill(angle) && canPlaceWindmill(leftAngle) && canPlaceWindmill(rightAngle)) {
 *         placeWindmill(angle); placeWindmill(leftAngle); placeWindmill(rightAngle);
 *     }
 *
 *   RYN      gate on the centre, then take whatever else fits:
 *     if (!canPlaceWindmill(angle)) return;
 *     for (const a of [angle, leftAngle, rightAngle]) {
 *         if (!canPlaceWindmill(a)) continue;
 *         placeWindmill(a);
 *     }
 *
 * RYN's is novastorm's shape (13805), and its comment defends it: requiring all
 * three means one rock behind you cancels the whole thing. True — but the cost
 * is the reported symptom, because "whatever fits" is exactly how you get 1
 * mill in one spot and 3 in another.
 *
 * This walks a player across a field of scattered rocks and counts what each
 * policy leaves behind. Mills already placed block later ones, which is where
 * most of the raggedness comes from — so they are added to the world as they go.
 *
 *   node automill-shape.js
 */
const SCALE = 45, RING = 35 + SCALE + 5, PLAYER = 35;
const OFFSET = Math.asin((2 * SCALE + 9e-13) / (2 * RING)) * 2;
const STEP = 25.4;          // one tick of movement at terminal speed
const TICKS = 60;

function mulberry(seed) {
  return function () {
    seed |= 0; seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* The client's own test, from ObjectManager.canPlaceItem: a placement is legal
 * when nothing already standing is closer than item.scale + its placementScale. */
function canPlace(x, y, world) {
  for (const o of world) {
    if (Math.hypot(x - o.x, y - o.y) < SCALE + o.r) return false;
  }
  return true;
}

function walk(policy, heading, rand, rockCount) {
  // Natural obstacles, scattered along the path.
  const world = [];
  for (let i = 0; i < rockCount; i++) {
    const along = rand() * TICKS * STEP;
    const across = (rand() - 0.5) * 300;
    world.push({
      x: Math.cos(heading) * along - Math.sin(heading) * across,
      y: Math.sin(heading) * along + Math.cos(heading) * across,
      r: 50 + rand() * 20,
    });
  }

  const behind = heading + Math.PI;
  const perTick = [];
  let px = 0, py = 0;
  for (let t = 0; t < TICKS; t++) {
    const angles = [ behind, behind - OFFSET, behind + OFFSET ];
    const spots = angles.map(a => ({ x: px + Math.cos(a) * RING, y: py + Math.sin(a) * RING }));

    let placed = 0;
    if (policy === "atomic") {
      // Glotus: every one of the three has to be legal, and they must not
      // collide with each other either — which they cannot, being exactly
      // 2*scale apart, so only the world matters.
      if (spots.every(s => canPlace(s.x, s.y, world))) {
        for (const s of spots) { world.push({ x: s.x, y: s.y, r: SCALE }); placed++; }
      }
    } else {
      // RYN: centre gates, then take what fits. Each mill placed becomes a
      // blocker for the two after it, which is where the ragged shapes start.
      if (canPlace(spots[0].x, spots[0].y, world)) {
        for (const s of spots) {
          if (!canPlace(s.x, s.y, world)) continue;
          world.push({ x: s.x, y: s.y, r: SCALE });
          placed++;
        }
      }
    }
    perTick.push(placed);
    px += Math.cos(heading) * STEP;
    py += Math.sin(heading) * STEP;
  }
  return perTick;
}

const POLICIES = ["whatever fits (RYN now)", "all three or none (Glotus)"];
const HEADINGS = [["right", 0], ["down-right", Math.PI / 4], ["down", Math.PI / 2],
                  ["down-left", 3 * Math.PI / 4], ["left", Math.PI]];
const ROCKS = 14;
const RUNS = 40;

const pad = (v, w) => String(v).padEnd(w);
console.log("automill — what each policy leaves behind\n");
console.log("  " + TICKS + " ticks of walking, " + ROCKS + " rocks scattered along the path, " +
  RUNS + " runs per heading");
console.log("  mills already placed block later ones, as they do in the game\n");
console.log("  " + pad("policy", 28) + pad("heading", 13) + pad("mills", 9) +
  pad("ticks placing 1", 17) + pad("2", 7) + pad("3", 7) + "uneven");
console.log("  " + "-".repeat(94));

const totals = {};
for (const policy of POLICIES) {
  const key = policy.startsWith("whatever") ? "loose" : "atomic";
  totals[policy] = { mills: 0, uneven: 0, ticks: 0 };
  for (const [hname, heading] of HEADINGS) {
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let mills = 0;
    for (let r = 0; r < RUNS; r++) {
      for (const n of walk(key, heading, mulberry(r * 613 + Math.round(heading * 100)), ROCKS)) {
        counts[n]++;
        mills += n;
      }
    }
    // "uneven" = ticks that placed something, but not the full symmetric trio
    const uneven = counts[1] + counts[2];
    const placing = counts[1] + counts[2] + counts[3];
    totals[policy].mills += mills;
    totals[policy].uneven += uneven;
    totals[policy].ticks += placing;
    console.log("  " + pad(policy, 28) + pad(hname, 13) + pad(mills, 9) +
      pad(counts[1], 17) + pad(counts[2], 7) + pad(counts[3], 7) +
      (placing ? ((uneven / placing) * 100).toFixed(1) + "%" : "-"));
  }
  console.log("");
}

console.log("  " + pad("policy", 28) + pad("mills total", 14) + pad("placing ticks", 16) + "uneven");
console.log("  " + "-".repeat(72));
for (const policy of POLICIES) {
  const t = totals[policy];
  console.log("  " + pad(policy, 28) + pad(t.mills, 14) + pad(t.ticks, 16) +
    (t.ticks ? ((t.uneven / t.ticks) * 100).toFixed(1) + "%" : "-"));
}

console.log("\n  \"uneven\" is a tick that placed something other than the full trio — one mill,");
console.log("  or two. That is the ragged wall: it is not a heading bug, it is the policy.");
console.log("  Atomic never places a partial row; it places nothing and tries again next");
console.log("  tick, ~" + STEP.toFixed(0) + " units further on, where the trio usually fits.");
