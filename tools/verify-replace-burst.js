#!/usr/bin/env node
/*
 * verify-replace-burst.js
 *
 * A freed slot is ground, not a point. One build is one thing to refuse - the
 * enemy takes the slot beside it and the ground is theirs anyway. This checks
 * that a deletion plans deep enough to occupy the opening, and that raising
 * that depth did not loosen anything underneath it: the value floor, the
 * per-item caps, the non-overlap rule and the packet budget all still bind.
 *
 * PlacementPlanner is pulled out of the client verbatim and driven directly.
 *
 *   node tools/verify-replace-burst.js [path/to/client.js]
 */

const fs = require("fs");
const nodePath = require("path");

const ROOT = nodePath.resolve(__dirname, "..");
const file = process.argv[2] ? nodePath.resolve(process.argv[2]) : nodePath.join(ROOT, "Ryn_Type_2.user.js");
const src = fs.readFileSync(file, "utf8");
const lines = src.split("\n");

const find = re => {
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  throw new Error("not found: " + re);
};
const endOf = start => {
  for (let i = start; i < lines.length; i++) if (lines[i] === "  }") return i + 1;
  throw new Error("no end for " + start);
};
const at = find(/^  class PlacementPlanner \{/);
const plannerSrc = lines.slice(at - 1, endOf(at)).join("\n");

const num = name => {
  const m = src.match(new RegExp("const " + name + " = (\\d+(?:\\.\\d+)?);"));
  if (!m) {
    console.log(`FAIL  ${name} is missing - this client predates the replace burst.`);
    process.exit(1);
  }
  return parseFloat(m[1]);
};
const RPE_PLACE_PACKETS = num("RPE_PLACE_PACKETS");
const RPE_BATCH_PACKETS = num("RPE_BATCH_PACKETS");
const RPE_REPLACE_BURST = num("RPE_REPLACE_BURST");
const RPE_REPLACE_BURST_MAX = num("RPE_REPLACE_BURST_MAX");
const RPE_KB_TRAVEL = 100;
const hyp = (a, b) => Math.sqrt(a * a + b * b);
const GeometrySolver = { angleDist: (a, b) => { const d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; } };

const [PlacementPlanner] = new Function("hyp", "RPE_KB_TRAVEL", "RPE_PLACE_PACKETS", "RPE_BATCH_PACKETS", "GeometrySolver",
  plannerSrc + "\nreturn [PlacementPlanner];")(hyp, RPE_KB_TRAVEL, RPE_PLACE_PACKETS, RPE_BATCH_PACKETS, GeometrySolver);

// The engine's own weights, read from the client so the checks track it.
const weights = {};
for (const k of ["minValue", "maxPlacements", "beamWidth", "branch", "redundancy", "synergyTrapSpike", "synergyTrapHold", "synergyEnclose"]) {
  const m = src.match(new RegExp("\\n\\s*" + k + ":\\s*(-?\\d+(?:\\.\\d+)?)"));
  weights[k] = m ? parseFloat(m[1]) : 0;
}

const spike = { type: 2, footR: 20, isTrap: false, isDamage: true };
const trap = { type: 4, footR: 20, isTrap: true, isDamage: false };
// Candidates far enough apart that only the depth decides how many are taken.
const ring = (n, profile, r = 400) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return { profile, angle: a, x: Math.cos(a) * r, y: Math.sin(a) * r, value: 10 - i * 0.1, terms: {} };
});
const frame = { targetPos: { x: 1e6, y: 1e6 }, targetScale: 35, targetTrapped: null };
const ctxBase = () => ({ budget: 119, perTypeCap: new Map([[2, 99], [4, 99]]) });

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `   got=${got} want=${want}`}`);
};

const planner = new PlacementPlanner(weights);
const plan = (cands, extra) => planner.compose(cands, frame, Object.assign(ctxBase(), extra || {})).length;

// 1. The default depth is untouched for an ordinary tick.
t("an ordinary tick still plans at maxPlacements",
  plan(ring(8, spike)), weights.maxPlacements);

// 2. A deletion plans deeper.
t("a deletion plans to the burst depth",
  plan(ring(8, spike), { maxPlacements: RPE_REPLACE_BURST }), RPE_REPLACE_BURST);
t("burst depth is above the ordinary depth", RPE_REPLACE_BURST > weights.maxPlacements, true);
t("burst ceiling is above the default", RPE_REPLACE_BURST_MAX >= RPE_REPLACE_BURST, true);

// 3. Depth is a ceiling, not a target: the gates underneath still bind.
t("the value floor still drops candidates",
  plan(ring(8, spike).map(c => ({ ...c, value: weights.minValue })), { maxPlacements: 6 }), 0);
t("per-item caps still bind under a burst",
  planner.compose(ring(8, spike), frame,
    { budget: 119, perTypeCap: new Map([[2, 2], [4, 0]]), maxPlacements: 6 }).length, 2);
t("the packet budget still binds under a burst",
  planner.compose(ring(8, spike), frame,
    { budget: RPE_PLACE_PACKETS + RPE_BATCH_PACKETS, perTypeCap: new Map([[2, 99]]), maxPlacements: 6 }).length, 2);
{
  // Overlapping candidates: same ground, so only one may be taken however deep
  // the plan is allowed to go.
  const stacked = ring(6, spike).map(c => ({ ...c, x: 0, y: 0 }));
  t("overlapping candidates still collapse to one", plan(stacked, { maxPlacements: 6 }), 1);
}
{
  // Fewer candidates than depth: the plan simply comes out shallower.
  t("a shallow pool stays shallow", plan(ring(2, spike), { maxPlacements: 6 }), 2);
}

// 4. Mixed types are still allowed to share a burst.
{
  const mixed = ring(3, spike, 400).concat(ring(3, trap, 700));
  const n = plan(mixed, { maxPlacements: RPE_REPLACE_BURST });
  t("a burst may mix spikes and traps", n === RPE_REPLACE_BURST, true);
}

// 5. The switch is wired end to end.
t("_replaceBurst has a default", /_replaceBurst:\s*\d+,/.test(src), true);
t("_replaceBurst has a menu slider", src.includes('id=\\"_replaceBurst\\" type=\\"range\\"'), true);
t("...read by the engine", /Settings_default\._replaceBurst/.test(src), true);
t("...and only a deletion asks for it",
  /trigger\.modes\.indexOf\(RPE_MODE\.REPLACE\) === -1\) return undefined/.test(src), true);

console.log("");
if (fail) {
  console.log(`${fail} check(s) failed - the replace burst is not wired as intended.`);
  process.exit(1);
}
console.log(`OK - ${pass} checks passed.`);
