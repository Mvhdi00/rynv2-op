/* Checks the client's placement cap against the game's own rule.
 *
 * game_index.js computes it as:
 *
 *   inSandbox ? (group.sandboxLimit || Math.max(group.limit * 3, 99))
 *             : group.limit
 *
 * and leaves a group with no limit uncapped. Getting this wrong is quiet and
 * expensive in both directions: too high and the placer spends packets on
 * placements the server refuses, too low and it stops placing while it still
 * could — which on sandbox means capping spikes at 15 when they are really 99.
 *
 *   node item-limits.js [client.js]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = process.argv[2] || path.join(ROOT, "novastorm/Novastorm_1.41.4.user.js");
const src = fs.readFileSync(CLIENT, "utf8");
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")).itemGroups;

/* The rule the shipped bundle applies, from game_index.js. */
function gameLimit(group, inSandbox) {
  if (group.limit == undefined) return null;   // uncapped
  return inSandbox ? (group.sandboxLimit || Math.max(group.limit * 3, 99)) : group.limit;
}

/* The rule the client applies, read out of its isItemLimit. */
function clientLimit(group, inSandbox) {
  if (/group\.limit == undefined\) return false/.test(src)) {
    if (group.limit == undefined) return null;
  }
  const m = src.match(/let limit = config\.isSandbox\s*\?\s*\(([\s\S]{0,120}?)\)\s*:\s*([^;]+);/);
  if (!m) {
    // Pre-fix shape: a single expression with no sandbox branch.
    const old = src.match(/let limit = \(group\.sandboxLimit \|\| 99\);/);
    if (old) return group.sandboxLimit || 99;
    throw new Error("could not read the limit expression from " + path.basename(CLIENT));
  }
  const expr = inSandbox ? m[1] : m[2];
  return Function("group", "Math", '"use strict"; return (' + expr + ");")(group, Math);
}

let bad = 0;
const show = (v) => v === null ? "none" : String(v);
console.log(path.basename(CLIENT));
console.log("  " + "group".padEnd(12) + "sandbox".padStart(9) + "normal".padStart(8) + "   game");
for (const g of groups) {
  const cs = clientLimit(g, true), cn = clientLimit(g, false);
  const gs = gameLimit(g, true), gn = gameLimit(g, false);
  const ok = cs === gs && cn === gn;
  if (!ok) bad++;
  console.log("  " + String(g.name || g.id).padEnd(12) + show(cs).padStart(9) + show(cn).padStart(8) +
    "   " + (ok ? "match" : "MISMATCH (game: " + show(gs) + " / " + show(gn) + ")"));
}
console.log(bad === 0 ? "\n  every group matches the game" : "\n  " + bad + " group(s) disagree with the game");
process.exit(bad === 0 ? 0 : 1);
