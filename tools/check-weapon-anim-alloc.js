#!/usr/bin/env node
/*
 * check-weapon-anim-alloc.js
 *
 * Allocation profile of the weapon animation system's per-frame path. Split
 * out of check-weapon-anim.js because heapUsed deltas are only meaningful in a
 * process whose surrounding code has not already forced V8 to deoptimise these
 * call sites.
 *
 *   node --expose-gc tools/check-weapon-anim-alloc.js [path/to/client.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "Ryn_Type_2.user.js");
const client = fs.readFileSync(CLIENT_PATH, "utf8");
const START = "  const WA_LINEAR = 0;";
const END = "  const WeaponAnimation_default = WeaponAnimation;";
const src = client.slice(client.indexOf(START), client.indexOf(END) + END.length);

const sandbox = { performance, Math, console, Int32Array, Uint8Array };
vm.createContext(sandbox);
vm.runInContext(
  "const clamp = (v, a, b) => Math.min(Math.max(v, a), b);\n" + src + "\nglobalThis.WA = WeaponAnimation_default;",
  sandbox
);
const WA = sandbox.WA;

const SPEAR = { id: 5, name: "polearm", speed: 700, armS: undefined };
const BOW = { id: 9, name: "hunting bow", speed: 600, projectile: 0 };

function player(sid, weaponIndex, animTime, animSpeed, dirPlus) {
  return { sid, scale: 35, dir: 0, dirPlus, targetAngle: -Math.PI / 2, animTime, animSpeed, weaponIndex, buildIndex: -1 };
}
const attacker = player(9, 5, 421.5, 700, -0.7);
const idler = player(3, 5, 0, 0, 0);
const archer = player(4, 9, 300, 600, -0.4);

let sink = 0;
const nopTool = (w, v, x, y, c) => { sink += x + y; };
const nopAmmo = (x, y, p, c) => { sink += x + y; };
const nopHand = (x, y, r) => { sink += x + y + r; };
const nopCtx = { save() {}, restore() {}, translate(x, y) { sink += x + y; }, rotate(a) { sink += a; } };

/* Same call order as the rewritten Dl(). */
function drawPass(p, weapon) {
  const arm = Math.PI / 4 * (weapon.armS || 1);
  WA._bodyAngle(p);
  WA._drawWeapon(nopTool, weapon, "", 35, 0, nopCtx, p);
  if (weapon.projectile != null) WA._drawAmmo(nopAmmo, 35, 0, weapon, nopCtx, p);
  WA._drawHands(nopHand, p, arm, 1, 1);
}

let failures = 0;
function bench(label, fn, limit) {
  const runs = [];
  let retained = 0;
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 60000; i++) fn(i);
    global.gc(); global.gc();
    const before = process.memoryUsage().heapUsed;
    const N = 200000;
    for (let i = 0; i < N; i++) fn(i);
    runs.push((process.memoryUsage().heapUsed - before) / N);
    global.gc(); global.gc();
    retained = Math.max(retained, process.memoryUsage().heapUsed - before);
  }
  runs.sort((a, b) => a - b);
  const median = runs[1];
  const ok = median <= limit && retained <= 128 * 1024;
  if (!ok) failures++;
  console.log(
    "  " + (ok ? "ok  " : "FAIL") + " " + label.padEnd(30) +
    median.toFixed(2).padStart(6) + " B/call   retained " + (retained / 1024).toFixed(1).padStart(6) + " KB   (limit " + limit + ")"
  );
}

console.log("allocation per call, median of 3 runs of 200k iterations\n");
bench("baseline: empty closure", () => {}, 2);
bench("_pose, attacking, cache miss", i => { WA._frame = i; WA._pose(attacker); }, 2);
bench("_pose, idle + sway", i => { WA._frame = i; WA._t = i % (2420 * 8); WA._pose(idler); }, 4);
bench("_pose, cache hit", () => { WA._pose(attacker); }, 2);
bench("_bodyAngle, idle", () => { WA._bodyAngle(idler); }, 2);
bench("_bodyAngle, attacking", () => { WA._bodyAngle(attacker); }, 18);
bench("frame() tick", i => WA.frame(i), 2);
bench("draw pass, melee attacking", i => { WA._frame = i; drawPass(attacker, SPEAR); }, 24);
bench("draw pass, ranged attacking", i => { WA._frame = i; drawPass(archer, BOW); }, 24);
bench("draw pass, idle", i => { WA._frame = i; drawPass(idler, SPEAR); }, 24);

if (sink === Infinity) console.log("unreachable");
console.log("\n" + (failures === 0 ? "ALLOCATION CHECKS PASSED" : failures + " ALLOCATION CHECK(S) FAILED"));
process.exit(failures === 0 ? 0 : 1);
