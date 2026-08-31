/* What a spike tick can and cannot do, derived from the game's own rules.
 *
 * Everything here comes from moomoo's server code, which X- Precision ships
 * verbatim. Three rules decide the whole problem:
 *
 * 1. WHERE A BUILD LANDS (Player.buildItem, 17645):
 *
 *        var tmpS = (this.scale + item.scale + (item.placeOffset || 0));
 *        var tmpX = this.x + (tmpS * mathCOS(this.dir));
 *        var tmpY = this.y + (tmpS * mathSIN(this.dir));
 *
 *    A build always lands on a circle of fixed radius around YOU, at the angle
 *    you are facing. The angle is the only free variable. There is no "place it
 *    next to them" and no "place it in that gap" — if the gap is not on your
 *    ring, you cannot build into it without moving first.
 *
 * 2. WHEN A BUILD IS LEGAL (ObjectManager.checkItemLocation, 17084):
 *
 *        if (active && getDistance(x, y, obj.x, obj.y) < (s + blockS)) return false;
 *        blockS = obj.blocker || obj.getScale(0.6, obj.isItem)
 *
 *    and getScale(sM, ig) = scale * (isItem ? 1 : 0.6*sM) * (ig ? 1 : colDiv).
 *    For a placed item, ig is true, so colDiv does NOT apply: a trap blocks
 *    with its full 50 even though its collision radius is 10.
 *
 * 3. WHEN A SPIKE HURTS (ObjectManager.checkCollision, 17105):
 *
 *        tmpLen = player.scale + other.getScale();       // ig undefined -> colDiv
 *        if (sqrt(dx*dx + dy*dy) - tmpLen <= 0) { ... player.changeHealth(-other.dmg) }
 *
 *    Called every server tick as the player moves. A spike tick is not a
 *    special move: it is this passive collision, timed to land in the same
 *    tick as your weapon hit.
 *
 *   node spike-geometry.js
 */

// items.list, straight from the table at 16626-16675.
const SPIKES = [
  { name: "spikes",          dmg: 20, scale: 49, placeOffset: -5, colDiv: 1 },
  { name: "greater spikes",  dmg: 35, scale: 52, placeOffset: -5, colDiv: 1 },
  { name: "poison spikes",   dmg: 30, scale: 52, placeOffset: -5, colDiv: 1 },
  { name: "spinning spikes", dmg: 45, scale: 52, placeOffset: -5, colDiv: 1 },
];
const TRAP = { name: "pit trap", scale: 50, placeOffset: -5, colDiv: 0.2 };
const PLAYER_SCALE = 35;

const ring = (it) => PLAYER_SCALE + it.scale + (it.placeOffset || 0);
const hurtRange = (it) => PLAYER_SCALE + it.scale * it.colDiv;   // getScale() with colDiv
const blockRange = (it) => it.scale;                             // getScale(0.6, true)

const pad = (v, w) => String(v).padEnd(w);
const deg = (r) => (r * 180 / Math.PI);

console.log("spike tick geometry, from the game's own numbers\n");
console.log("  " + pad("item", 18) + pad("dmg", 6) + pad("ring R", 9) + pad("hurts within", 20) +
  pad("blocks within", 14) + "reach = R + hurt");
console.log("  " + "-".repeat(82));
for (const s of SPIKES.concat([TRAP])) {
  console.log("  " + pad(s.name, 18) + pad(s.dmg ?? "-", 6) + pad(ring(s), 9) +
    pad(hurtRange(s) + (s.colDiv !== 1 ? " (colDiv " + s.colDiv + ")" : ""), 20) +
    pad(blockRange(s), 14) + (ring(s) + hurtRange(s)));
}

/* THE REACH WINDOW.
 *
 * A spike placed on my ring at angle t, against a target at distance d and
 * angle 0. The spike hurts them when
 *
 *     |spike - target|  <=  hurtRange
 *     R^2 + d^2 - 2Rd cos(t)  <=  hurtRange^2
 *
 * so the usable angles are a single arc centred on the aim, half-width alpha:
 *
 *     cos(alpha) = (R^2 + d^2 - hurtRange^2) / (2 R d)
 */
function reachHalfWindow(item, d) {
  const R = ring(item), H = hurtRange(item);
  const c = (R * R + d * d - H * H) / (2 * R * d);
  if (c <= -1) return Math.PI;      // every angle reaches
  if (c >= 1) return null;          // no angle reaches
  return Math.acos(c);
}

/* THE SEPARATION RULE.
 *
 * Two spikes of the same kind need their centres `2*scale` apart (rule 2). Both
 * sit on the ring, so the chord between them is 2*R*sin(dt/2):
 *
 *     2 R sin(dt/2) >= 2*scale   ->   dt >= 2*asin(scale / R)
 */
function minSeparation(item) {
  const s = item.scale / ring(item);
  return s >= 1 ? Math.PI : 2 * Math.asin(s);
}

const spike = SPIKES[0];
const sep = minSeparation(spike);
console.log("\n  Two spikes on the same ring must be " + (2 * spike.scale) +
  " apart, which on a ring of " + ring(spike) + " is " + deg(sep).toFixed(1) + " degrees.");

console.log("\n  " + pad("target distance", 17) + pad("reach window", 15) + pad("angles that reach", 19) +
  "can a SECOND reaching spike fit?");
console.log("  " + "-".repeat(84));
let firstFit = null, lastFit = null;
for (const d of [45, 60, 79, 90, 100, 110, 120, 125, 130, 131, 135, 145, 160, 163, 170]) {
  const a = reachHalfWindow(spike, d);
  if (a === null) {
    console.log("  " + pad(d, 17) + pad("none", 15) + pad("-", 19) + "out of reach entirely");
    continue;
  }
  const width = 2 * a;
  const fits = width >= sep;
  if (fits) { if (firstFit === null) firstFit = d; lastFit = d; }
  console.log("  " + pad(d, 17) + pad("+-" + deg(a).toFixed(1) + " deg", 15) +
    pad(deg(width).toFixed(1) + " deg wide", 19) +
    (fits ? "yes" : "no - one spike is all you get"));
}

/* The distance where the window closes to exactly the separation. */
function widthEqualsSeparation(item) {
  const R = ring(item), H = hurtRange(item), half = minSeparation(item) / 2;
  // cos(half) = (R^2 + d^2 - H^2) / (2 R d)  ->  d^2 - 2 R cos(half) d + (R^2 - H^2) = 0
  const b = 2 * R * Math.cos(half), c = R * R - H * H;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  return (b + Math.sqrt(disc)) / 2;
}
const crossover = widthEqualsSeparation(spike);
console.log("\n  The window is exactly one separation wide at d = " + crossover.toFixed(1) + ".");
console.log("  Closer than that, two spikes can both reach. Further, only one can.");

/* THE CLAIM THE OLD SPIKE TICK WAS BUILT ON, restated correctly.
 *
 * The bench that preceded the removal reported these windows as "disjoint at
 * every distance". That is true only for the case it tested — an existing
 * spike sitting ON the aim line — and it is worth being exact, because the new
 * design turns on it. */
console.log("\n  Where the first spike already sits decides whether a second one is possible:");
console.log("  " + pad("existing spike at", 20) + pad("d = 90", 12) + pad("d = 110", 12) + pad("d = 130", 12) + "d = 150");
console.log("  " + "-".repeat(70));
for (const existing of [0, 20, 35, 50]) {
  const row = [];
  for (const d of [90, 110, 130, 150]) {
    const a = reachHalfWindow(spike, d);
    if (a === null) { row.push("no reach"); continue; }
    const e = existing * Math.PI / 180;
    // A second angle must be inside [-a, a] and at least `sep` from `e`.
    const lo = e + sep, hi = e - sep;
    const ok = (lo <= a) || (hi >= -a);
    row.push(ok ? "second fits" : "blocked");
  }
  console.log("  " + pad(existing + " deg off aim", 20) + row.map(v => pad(v, 12)).join(""));
}
console.log("\n  So: an existing spike dead on the aim blocks every second spike from");
console.log("  about d = " + crossover.toFixed(0) + " outward, but one placed off-aim leaves room. The old spike");
console.log("  tick asked for angles[0] — the angle nearest the aim — which is exactly");
console.log("  the one auto place had usually taken already.");

/* WHAT A HIT IS WORTH. Weapon damage plus the spike, in one tick. */
const WEAPONS = [
  { name: "tool hammer", dmg: 25, range: 65, knock: 0.3 },
  { name: "short sword", dmg: 35, range: 110, knock: 0.2 },
  { name: "polearm",     dmg: 45, range: 142, knock: 0.7 },
  { name: "great axe",   dmg: 35, range: 76, knock: 0.25 },
  { name: "katana",      dmg: 40, range: 118, knock: 0.4 },
  { name: "bat",         dmg: 20, range: 110, knock: 0.7 },
  { name: "daggers",     dmg: 20, range: 65, knock: 0.1 },
  { name: "stick",       dmg: 1,  range: 70, knock: 0.3 },
];
console.log("\n  One tick of a spike tick, against 100 health (bull helmet is x1.5 damage):");
console.log("  " + pad("weapon", 14) + pad("hit", 7) + pad("+ spikes", 10) + pad("+ greater", 11) +
  pad("+ spinning", 12) + "bull + spinning");
console.log("  " + "-".repeat(70));
for (const w of WEAPONS) {
  const bull = w.dmg * 1.5;
  console.log("  " + pad(w.name, 14) + pad(w.dmg, 7) + pad(w.dmg + 20, 10) +
    pad(w.dmg + 35, 11) + pad(w.dmg + 45, 12) + (bull + 45).toFixed(0) +
    (bull + 45 >= 100 ? "   <- kills from full" : ""));
}

/* WHERE THE SPIKE HAS TO BE relative to the hit, for the two to combine. The
 * hit knocks them along the aim; the spike has to still be touching them after
 * that push, or they have to be pushed INTO it. */
/* Knockback. RYN already carries these two constants (RPE_KB_IMPULSE,
 * RPE_DECEL) and derives RPE_KB_TRAVEL from them the same way. */
const KB_IMPULSE = 1.5, DECEL = 0.993;   // per ms, from the server's update loop
const KB_TRAVEL = KB_IMPULSE / (1 - DECEL);
console.log("\n  Knockback, from checkCollision: a spike hit adds 1.5 * weightM to velocity,");
console.log("  and the server decays velocity by " + DECEL + " per millisecond. A single impulse");
console.log("  therefore carries " + KB_TRAVEL.toFixed(0) + " units in total (impulse / (1 - decel)) — which is");
console.log("  RYN's own RPE_KB_TRAVEL. Being hit into a spike moves you a long way, so a");
console.log("  candidate validated against where they stand now is stale within one tick.");

console.log("\n  Bottom line for the design:");
console.log("  · The only decision a spike tick can make about WHERE is one angle on its");
console.log("    own ring. Gap filling, escape denial and 'place it near them' are all");
console.log("    the same single choice, and they are only available when the gap happens");
console.log("    to lie on the ring.");
console.log("  · Below d = " + crossover.toFixed(0) + " a second reaching spike can coexist with one already");
console.log("    placed; above it, if a spike already covers the aim, the tick's job is to");
console.log("    swing, not to place.");
console.log("  · Maximum reach for any spike tick at all is R + hurt = " +
  (ring(spike) + hurtRange(spike)) + " for spikes, " +
  (ring(SPIKES[1]) + hurtRange(SPIKES[1])) + " for the age-5 kinds.");
