#!/usr/bin/env node
/*
 * mutate-replace.js
 *
 * verify-replace.js reports 150 passing checks. That number means nothing on
 * its own — a suite that has never failed has not been shown to test anything.
 * This breaks the client one way at a time and confirms the suite notices each
 * break. A mutation reported MISSED is a hole in the suite, not in the client.
 *
 * It has already earned its keep twice:
 *
 *   - "stop splitting the proximity term across enemies" came back MISSED. The
 *     test was measuring `points - floor(points)`, which cannot fail: four
 *     enemies at 0.99 each sum to 3.96 and the fractional part is still under
 *     one. The bound is now read straight off points, in a scene built so no
 *     integer award fires.
 *
 *   - "skip the clash check when sliding an accepted slot" came back MISSED,
 *     which meant the guard had no test at all. Adjacent ring slots always
 *     overlap, so addPredictObject refuses them and the guard never sees them;
 *     it only matters in a narrow band where two slots are far enough apart to
 *     be accepted and close enough that one grid step of refinement closes the
 *     gap. Across 480 ordinary scenes the fine aim moved a slot 388 times and
 *     the guard fired zero times. Sweeping 8400 geometries against a
 *     guard-removed client found 121 that differ; the first is now pinned as a
 *     test.
 *
 *   node tools/mutate-replace.js [client.js]
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "YoRHa_System.user.js");

const src = fs.readFileSync(CLIENT_PATH, "utf8");
const OUT = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mutate-")), "mutant.user.js");

// [what is broken, the exact text to replace, what to replace it with]
const mutations = [
  ["drop the proximity tiebreak on spikes",
   "if (lost.spike && candidate.hitEnemy) candidate.grade++;\n\n                    candidate.points += replaceNearness(dist, ring.placementDistance, nearWeight);",
   "if (lost.spike && candidate.hitEnemy) candidate.grade++;"],

  ["grade on the present position again",
   "const aim = replaceAim(enemy);",
   "const aim = enemy;"],

  ["trust every reading completely",
   "return Math.hypot(sx, sy) / track.angles.length;",
   "return 1;"],

  ["average the heading numbers instead of the vectors",
   "for (const angle of track.angles) { sx += Math.cos(angle); sy += Math.sin(angle); }\n\n            return Math.hypot(sx, sy) / track.angles.length;",
   "for (const angle of track.angles) { sx += angle; }\n\n            return Math.max(0, 1 - Math.abs(sx / track.angles.length) / Math.PI);"],

  ["drop the one-packet-one-observation guard",
   "if (track.seen === seen) return;",
   "if (false) return;"],

  ["stop sampling on ticks where nothing broke",
   "for (const enemy of enemiesNear) replaceTrackHeading(enemy);",
   "void enemiesNear;"],

  ["let the heading window grow without bound",
   "if (track.angles.length > REPLACE_LEAD_WINDOW) track.angles.shift();",
   "void REPLACE_LEAD_WINDOW;"],

  ["let the lead run past the extrapolation",
   "x2: enemy.x2 + (enemy.xVel - enemy.x2) * trust,",
   "x2: enemy.x2 + (enemy.xVel - enemy.x2) * trust * 3,"],

  ["stop splitting the proximity term across enemies",
   "const nearWeight = 0.99 / enemies.length;",
   "const nearWeight = 0.99;"],

  ["never prune the heading book",
   "if (replaceHeadings.size > 48) {",
   "if (false) {"],

  ["prune the heading book too aggressively",
   "if (replaceHeadingStamp - other.stamp > 96) replaceHeadings.delete(sid);",
   "if (replaceHeadingStamp - other.stamp > 1) replaceHeadings.delete(sid);"],

  ["move the refined slot's angle but not its position",
   "taken.angle = angle;\n                        taken.x = moved.x;\n                        taken.y = moved.y;",
   "taken.angle = angle;"],

  ["skip the clash check when sliding an accepted slot",
   "if (!clash) {",
   "if (true) {"],
];

let caught = 0, missed = 0, stale = 0;

for (const [name, from, to] of mutations) {
  // An anchor that no longer matches means the mutation silently did nothing —
  // which would otherwise read as a MISSED and send you hunting the wrong bug.
  if (!src.includes(from)) {
    console.log(`  STALE   ${name}\n            its anchor is no longer in the client; update the mutation`);
    stale++;
    continue;
  }

  fs.writeFileSync(OUT, src.replace(from, to));

  let out = "";
  try {
    out = execFileSync("node", [path.join(__dirname, "verify-replace.js"), OUT], { encoding: "utf8" });
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
  }

  const failures = (out.match(/✗/g) || []).length;
  const refused = !/checks passed/.test(out);

  if (failures || refused) {
    console.log(`  caught  ${name}  (${refused ? "the suite refused to run at all" : failures + " failing"})`);
    const first = (out.match(/ {2}✗ [^\n]*/) || [])[0];
    if (first) console.log(`            ${first.trim()}`);
    caught++;
  } else {
    console.log(`  MISSED  ${name}\n            the suite passed a client with this broken — that is a hole in the suite`);
    missed++;
  }
}

fs.rmSync(path.dirname(OUT), { recursive: true, force: true });

console.log(`\n${caught}/${mutations.length} mutations caught` +
            (missed ? `, ${missed} MISSED` : "") +
            (stale ? `, ${stale} stale` : ""));
process.exit(missed || stale ? 1 : 0);
