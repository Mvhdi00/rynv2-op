/*
 * Angles wrap at ±PI, and every comparison in the client has to fold across
 * that seam. These pull the real helpers out of the client and check them at
 * the seam, plus the shape of what leaves on the wire against what the game
 * itself sends: fixTo(atan2 range, 2), and no "D" packet when that value has
 * not changed.
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

const src = [lift("PI"), lift("PI2"), lift("fixTo"), lift("getAngleDist"), lift("wireAngle")]
  .join("\n")
  .replace(/^\s+/gm, "");
const { getAngleDist, wireAngle } = new Function(src + "\nreturn {getAngleDist, wireAngle};")();

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

console.log("\nwireAngle");
check("two decimals, like the game", wireAngle(1.234567), 1.23);
check("it rounds rather than truncates", wireAngle(1.239), 1.24);
check("an angle past PI comes back inside atan2's range", wireAngle(Math.PI + 1), fixTo2(-Math.PI + 1));
check("a full turn is zero", wireAngle(2 * Math.PI), 0);
check("a negative turn is zero", wireAngle(-2 * Math.PI), 0);
check("null stays null", wireAngle(null), null);
check("undefined becomes null, never NaN on the wire", wireAngle(undefined), null);
check("NaN becomes null", wireAngle(NaN), null);
check("everything lands inside (-PI, PI]", Array.from({ length: 2000 }, (_, i) => wireAngle(-20 + i * 0.02)).every(a => a >= -Math.PI && a <= Math.PI), true);
function fixTo2(v) { return parseFloat(v.toFixed(2)); }

console.log("\nthe D packet");
{
  /* The game keeps one previous value and skips the send when it repeats. */
  const sent = [];
  const pm = {
    sentWireAngle: null,
    send: p => sent.push(p),
    updateAngle(radians) {
      const angle = wireAngle(radians);
      if (angle === this.sentWireAngle) return;
      this.sentWireAngle = angle;
      this.send(["D", angle]);
    }
  };
  pm.updateAngle(1.2345);
  pm.updateAngle(1.2349);
  pm.updateAngle(1.2301);
  pm.updateAngle(1.31);
  check("a move too small for two decimals sends nothing", sent.length, 2);
  check("the value sent is the rounded one", sent[0][1], 1.23);
  check("a real move still sends", sent[1][1], 1.31);
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
