/* Preplace: RYN v5.4 against X- Precision, over every situation that can arise.
 *
 * Not a physics sim. Preplace is a question of WHEN a client is allowed to have
 * an opinion, and both clients answer that with gate conditions that are short
 * enough to enumerate exhaustively. So: build the cross product of the states a
 * fight actually passes through, apply each client's gates as written, and count
 * where each produces a candidate and how far ahead.
 *
 * X- Precision, getPrePlaceObject() at 12519 — the whole trigger:
 *
 *     if (nearestEnemy.weapons[1] == 10 && secondaryReload == 1 && ...) weapon = secondary;
 *     else if (items.weapons[primary].speed <= 400 && primaryReload == 1 && ...) weapon = primary;
 *     if (weapon != null) {
 *         let dmg = ... * 3.3;
 *         findObject = visibleObjects.filter(o => !o.hideFromEnemy
 *             && dist(enemy, o) <= o.scale + range
 *             && o.health <= dmg)[0];            // must die to ONE hit
 *     }
 *     if (!findObject) return;                   // no object, no preplace
 *
 * Three hard requirements: their weapon is off cooldown RIGHT NOW, that weapon
 * one-shots the building, and the building is already in their range. Miss any
 * one and X- has nothing to say this tick. Preplace is also gated on the enemy
 * being within 300 (12592).
 *
 * RYN, _generatePreplace() at 11440 — two independent generators:
 *
 *   (a) intercept: for n in 1..RPE_PREPLACE_MAX_LEAD(6), predict where they will
 *       be, aim at the nearest free aperture, and keep it if the predicted path
 *       enters the capture circle. Needs >= 2 motion samples and confidence
 *       >= RPE_PREPLACE_BOOK_CONFIDENCE(0.12). No building need be dying at all.
 *
 *   (b) vacating: attrition() at 11325 walks every object either side can reach
 *       and keeps those with `hits = ceil(health / dmg) <= 2` — two hits, not
 *       one — for BOTH players' weapons, ours included. Confidence decays with
 *       the hit count, and the candidate is booked with a due tick rather than
 *       fired now.
 *
 * "Produces a candidate" is not "places well": RYN's candidates then face a
 * scorer, a minValue and a conflict resolver, and some die there. This measures
 * coverage — how often each client is even in the game — not quality.
 *
 *   node preplace-duel.js
 */

const MAX_LEAD = 6;        // RPE_PREPLACE_MAX_LEAD
const BOOK_CONF = 0.12;    // RPE_PREPLACE_BOOK_CONFIDENCE
const FIRE_LEAD = 2;       // RPE_PREPLACE_FIRE_LEAD

// The states a fight passes through. Every combination is one situation.
const AXES = {
  // their primary's cooldown, as primaryReload reads it
  reload:   [1, 0.6, 0.2],
  // how many of their hits the building in question survives
  hits:     [1, 2, 3],
  // is the building inside their weapon range right now
  inRange:  [true, false],
  // are they moving in a straight line, turning, or standing still
  motion:   ["straight", "turning", "still"],
  // how far away they are
  dist:     [120, 250, 340],
};

// ── X- Precision's gates, as written ──────────────────────────────────────
function xPrecision(s) {
  if (s.dist >= 300) return null;               // 12592: < 300
  if (s.reload !== 1) return null;              // weapon must be off cooldown now
  if (!s.inRange) return null;                  // o.scale + range
  if (s.hits > 1) return null;                  // o.health <= dmg
  // The candidate exists and is placed this tick — no lead, no booking.
  return { lead: 0, source: "vacating(1 hit)" };
}

// ── RYN's gates, as written ───────────────────────────────────────────────
function ryn(s) {
  const out = [];
  if (s.dist > 300) return null;                // RPE_REPLACE_RANGE / engagement

  // (a) intercept — needs measured motion and enough confidence at some lead
  if (s.motion !== "still") {
    // confidence = stability * depth * horizon * (.4 + .6 * turning), 11305
    const turning = s.motion === "turning" ? 0.35 : 1;
    for (let n = 1; n <= MAX_LEAD; n++) {
      const horizon = Math.exp(-n / 3.5);
      const conf = 0.9 * 1 * horizon * (0.4 + 0.6 * turning);
      if (conf < BOOK_CONF) break;
      // Does the predicted path reach us within n ticks? Terminal speed is
      // playerSpeed / (1 - playerDecel) = 0.0016 / 0.007 = 0.229 units/ms,
      // which is 25.4 over a 111ms tick. Only the enemy is moving here.
      if (s.dist - n * 25.4 > 120) continue;
      out.push({ lead: Math.max(0, n - FIRE_LEAD), source: "intercept", conf });
      break;
    }
  }

  // (b) vacating — two hits, either player's weapon, reload not required to be
  // full because attrition also counts OUR OWN swing at 11330
  if (s.hits <= 2 && s.inRange) {
    out.push({ lead: s.hits, source: "vacating(" + s.hits + " hits)",
               conf: Math.max(0.3, 1 - (s.hits - 1) * 0.35) });
  }
  if (!out.length) return null;
  out.sort((a, b) => b.lead - a.lead);
  return out[0];
}

// ── enumerate ─────────────────────────────────────────────────────────────
const situations = [];
for (const reload of AXES.reload)
  for (const hits of AXES.hits)
    for (const inRange of AXES.inRange)
      for (const motion of AXES.motion)
        for (const dist of AXES.dist)
          situations.push({ reload, hits, inRange, motion, dist });

let xHit = 0, rHit = 0, both = 0, rOnly = 0, xOnly = 0, neither = 0;
let xLead = 0, rLead = 0;
const rOnlyWhy = {};

for (const s of situations) {
  const x = xPrecision(s), r = ryn(s);
  if (x) { xHit++; xLead += x.lead; }
  if (r) { rHit++; rLead += r.lead; }
  if (x && r) both++;
  else if (r) { rOnly++; rOnlyWhy[r.source] = (rOnlyWhy[r.source] || 0) + 1; }
  else if (x) xOnly++;
  else neither++;
}

const n = situations.length;
const pct = (v) => ((v / n) * 100).toFixed(1) + "%";
const pad = (s, w) => String(s).padEnd(w);

console.log("preplace coverage — RYN v5.4 against X- Precision\n");
console.log("  " + n + " situations: their reload x building toughness x in range x motion x distance\n");
console.log("  " + pad("", 26) + pad("situations", 13) + pad("share", 9) + "average ticks of lead");
console.log("  " + "-".repeat(74));
console.log("  " + pad("X- has a candidate", 26) + pad(xHit, 13) + pad(pct(xHit), 9) +
  (xHit ? (xLead / xHit).toFixed(2) : "-"));
console.log("  " + pad("RYN has a candidate", 26) + pad(rHit, 13) + pad(pct(rHit), 9) +
  (rHit ? (rLead / rHit).toFixed(2) : "-"));
console.log("");
console.log("  " + pad("both", 26) + pad(both, 13) + pct(both));
console.log("  " + pad("RYN only", 26) + pad(rOnly, 13) + pct(rOnly));
console.log("  " + pad("X- only", 26) + pad(xOnly, 13) + pct(xOnly));
console.log("  " + pad("neither", 26) + pad(neither, 13) + pct(neither));

console.log("\n  where RYN is alone, the generator that got there:");
for (const [why, count] of Object.entries(rOnlyWhy).sort((a, b) => b[1] - a[1]))
  console.log("    " + pad(why, 24) + count);

console.log("\n  X- is never alone: every gate it passes, RYN's vacating branch passes too.");
console.log("  Lead is ticks of warning before the slot is needed; X- is always 0 by");
console.log("  construction, because it fires on the tick it notices.");
console.log("\n  Caveat worth stating: every situation counts once here, and real fights");
console.log("  do not visit them equally — a closing enemy is usually reloaded, which is");
console.log("  X-'s best axis. Read the share as coverage of the space, not of a match.");
