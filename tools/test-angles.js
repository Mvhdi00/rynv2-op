/*
 * Angles wrap at ±PI, and every comparison in the client has to fold across
 * that seam. These pull the real helper out of the client rather than restating
 * it, so they fail if its definition drifts, and check it where it matters:
 * either side of ±PI, where a difference taken the long way round inverts the
 * answer.
 */
const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "src", "RYN_Client_v4.js"), "utf8");

/* Lift the helpers out of the file rather than restating them here, so the
 * tests fail when the client's own definitions drift. */
function lift(name, kind = "const") {
  const at = code.indexOf(`  ${kind} ${name} = `);
  if (at === -1) throw new Error(`helper not found: ${name}`);
  let end = at, depth = 0, started = false;
  for (; end < code.length; end++) {
    const ch = code[end];
    if (ch === "{") { depth++; started = true; }
    else if (ch === "}") { depth--; if (started && depth === 0) { end++; break; } }
    else if (ch === ";" && !started) { break; }
  }
  return code.slice(at, end);
}

const src = [lift("PI"), lift("PI2"), lift("getAngleDist")]
  .join("\n")
  .replace(/^\s+/gm, "");
const { getAngleDist } = new Function(src + "\nreturn {getAngleDist};")();

let passed = 0, failed = 0;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
function check(name, got, want, eps) {
  const ok = typeof want === "number" && typeof got === "number" ? near(got, want, eps) : got === want;
  if (ok) { passed++; console.log(`  PASS  ${name}  (got ${got})`); }
  else { failed++; console.log(`  FAIL  ${name}  (got ${got}, want ${want})`); }
}

console.log("\ngetAngleDist");
check("two headings either side of PI are close, not far", getAngleDist(3.0, -3.0), 2 * Math.PI - 6, 1e-12);
check("the same heading is zero apart", getAngleDist(1.234, 1.234), 0);
check("opposite headings are PI apart", getAngleDist(0, Math.PI), Math.PI, 1e-12);
check("it never exceeds PI", Math.max(...Array.from({ length: 400 }, (_, i) => getAngleDist(i * 0.037, -i * 0.061))) <= Math.PI + 1e-12, true);
check("it is symmetric", getAngleDist(2.5, -1.9) === getAngleDist(-1.9, 2.5), true);
check("a full turn is the same heading", getAngleDist(0.3, 0.3 + 2 * Math.PI), 0, 1e-12);

console.log("\nclosing speed, the seam _timeToReach used to get backwards");
/* cos of the folded distance has to equal cos of the true difference, which is
 * what makes the fix a fix and not just a smaller number. */
for (const [moveDir, bearing] of [[3.0, -3.0], [-3.1, 3.1], [0.2, -0.2], [Math.PI, -Math.PI], [1.0, 2.0]]) {
  check(`cos matches the true difference at ${moveDir} vs ${bearing}`,
    Math.cos(getAngleDist(moveDir, bearing)), Math.cos(moveDir - bearing), 1e-12);
}
check("an enemy walking at you across the seam reads as closing",
  Math.cos(getAngleDist(3.0, -3.0)) > 0.9, true);
check("the old clamp read that same enemy as walking away",
  Math.cos(Math.min(Math.abs(3.0 - -3.0), Math.PI)), -1, 1e-12);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
