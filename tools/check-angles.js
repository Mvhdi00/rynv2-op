#!/usr/bin/env node
/*
 * check-angles.js
 *
 * Exercises the precise-angle system in a built ReUp_Mix.user.js. The bodies
 * are pulled out of the build itself rather than re-typed here, so this tests
 * the code that ships, and a build that drops or renames them fails loudly.
 *
 *   node tools/check-angles.js [ReUp_Mix.user.js] [--cost]
 *
 * --cost also runs the placement scan against the client's own spatial grid and
 * prints what a tick costs at 72 / 144 / 288 steps.
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const withCost = args.includes("--cost");
const target = args.find(a => !a.startsWith("--")) || "ReUp_Mix.user.js";
const file = path.resolve(process.cwd(), target);
const src = fs.readFileSync(file, "utf8");

/* Cut a region out of the build by its opening and closing landmarks. */
function region(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a === -1) throw new Error(`not found in ${target}: ${startMarker.trim()}`);
  const b = src.indexOf(endMarker, a);
  if (b === -1) throw new Error(`no end for ${startMarker.trim()}`);
  return src.slice(a, b);
}

const TAU = Math.PI * 2;
const deg = r => (r * 180 / Math.PI + 360) % 360;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

let failures = 0;
function check(name, condition, detail = "") {
  const suffix = detail ? `  ${condition ? "(" + detail + ")" : "-> " + detail}` : "";
  if (condition) console.log(`ok    ${name}${suffix}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${suffix}`);
  }
}

/* ------------------------------------------------------------------ *
 * The grid, and the movement angle the keys ask for
 * ------------------------------------------------------------------ */

const Settings_default = {
  _preciseAngles: true,
  _moveAngleSteps: 144,
  _buildAngleSteps: 144,
  _mouseMovement: false
};

const { AngleGrid, Input } = eval(`(() => {
${region("  const AngleGrid = {", "  const getAngleFromBitmask")}
${region("  const getAngleFromBitmask = (bitmask, rotate) => {", "  const formatCode")}
class Input {
  constructor() { this.move = 0; this.moveNudge = 0; this.mouse = { angle: 0 }; }
${region("    getMoveAngle() {", "    handleMovement(")}
}
return { AngleGrid, Input };
})()`);

console.log("grid\n");

check("144 steps by default", AngleGrid.moveSteps === 144 && AngleGrid.buildSteps === 144);
check("a step is 2.5 degrees", near(deg(AngleGrid.step(144)), 2.5, 1e-12));

const distinct = new Set();
for (let i = 0; i < 144; i++) distinct.add(AngleGrid.snap(AngleGrid.fromIndex(i, 144), 144).toFixed(12));
check("144 distinct directions", distinct.size === 144, `${distinct.size} unique`);

check("negative angles wrap onto the grid", AngleGrid.index(-Math.PI / 2, 144) === 108);
check("angles past a full turn wrap", AngleGrid.index(TAU + .001, 144) === 0);
check("snapping a grid point is a no-op", near(AngleGrid.snap(AngleGrid.fromIndex(37, 144), 144), AngleGrid.fromIndex(37, 144)));
check("snap never moves an angle more than half a step",
  Array.from({ length: 2000 }, (_, i) => {
    const a = -TAU + (i / 2000) * 2 * TAU;
    let d = Math.abs(AngleGrid.snap(a, 144) - a) % TAU;
    if (d > Math.PI) d = TAU - d;
    return d;
  }).every(d => d <= AngleGrid.step(144) / 2 + 1e-9), "<= 1.25 deg");

/* Every slider value is a multiple of 8, so the eight key directions stay
 * exactly representable however fine the grid is. */
for (const steps of [8, 16, 144, 360]) {
  check(`key directions stay exact at ${steps} steps`,
    [0, 45, 90, 135, 180, 225, 270, 315].every(d => {
      const a = d * Math.PI / 180;
      let diff = Math.abs(AngleGrid.snap(a, steps) - a) % TAU;
      if (diff > Math.PI) diff = TAU - diff;
      return diff < 1e-9;
    }));
}

console.log("\nmovement input\n");

const UP = 1, DOWN = 2, LEFT = 4, RIGHT = 8;
const input = new Input();

input.move = UP;
check("W is up", near(deg(input.getMoveAngle()), 270));
input.move = UP | RIGHT;
check("W+D is up-right", near(deg(input.getMoveAngle()), 315));
input.move = 0;
check("no keys is no direction", input.getMoveAngle() === null);
input.move = UP | DOWN;
check("opposite keys cancel", input.getMoveAngle() === null);

input.move = RIGHT;
const base = input.getMoveAngle();
input.moveNudge = 1;
check("one nudge is one step", near(deg(input.getMoveAngle()) - deg(base), 2.5, 1e-9),
  `${deg(base)} -> ${deg(input.getMoveAngle())} deg`);
input.moveNudge = -1;
check("nudging below zero wraps", near(deg(input.getMoveAngle()), 357.5));
input.moveNudge = 36;
check("36 nudges is a quarter turn", near(deg(input.getMoveAngle()), 90));
input.moveNudge = 0;

Settings_default._mouseMovement = true;
const cursor = 33 * Math.PI / 180;
input.mouse.angle = cursor;
const relative = [
  [UP, 0, "W goes toward the cursor"],
  [RIGHT, Math.PI / 2, "D strafes right of it"],
  [DOWN, Math.PI, "S backs away from it"],
  [LEFT, -Math.PI / 2, "A strafes left of it"]
];
for (const [keys, offset, name] of relative) {
  input.move = keys;
  check(name, near(input.getMoveAngle(), AngleGrid.snap(cursor + offset, 144)));
}

/* A full cursor sweep has to reach every direction, and cost one packet per
 * step crossed rather than one per mouse event. */
input.move = UP;
const reached = new Set();
const sweepAt = i => {
  input.mouse.angle = parseFloat(((i / 5000) * TAU - Math.PI).toFixed(2)); // the client rounds to 2dp
  return input.getMoveAngle();
};
let sends = 0, last = sweepAt(0);
reached.add(AngleGrid.index(last, 144));
for (let i = 1; i < 5000; i++) {
  const a = sweepAt(i);
  reached.add(AngleGrid.index(a, 144));
  if (a !== last) {
    sends++;
    last = a;
  }
}
check("a cursor sweep reaches all 144", reached.size === 144, `${reached.size} reached`);
check("one send per step crossed, not per mouse event", sends <= 144, `${sends} sends over 5000 mouse events`);

Settings_default._mouseMovement = false;
Settings_default._preciseAngles = false;
check("off restores 8 move steps and 72 build steps", AngleGrid.moveSteps === 8 && AngleGrid.buildSteps === 72);
input.move = UP;
input.moveNudge = 5;
input.mouse.angle = 1.2;
check("off ignores nudge and cursor", near(deg(input.getMoveAngle()), 270));
input.moveNudge = 0;
Settings_default._preciseAngles = true;

for (const bad of ["nonsense", 2, null, NaN]) {
  Settings_default._moveAngleSteps = bad;
  check(`a stored ${typeof bad === "string" ? `"${bad}"` : String(bad)} falls back to 144`, AngleGrid.moveSteps === 144);
}
Settings_default._moveAngleSteps = 144;

/* ------------------------------------------------------------------ *
 * The placement scan cache
 * ------------------------------------------------------------------ */

console.log("\nplacement scan\n");

const { _getCachedPrePlaceAngles } = eval(`(() => {
${region("  const AngleGrid = {", "  const getAngleFromBitmask")}
${region("  const _prePlaceAngleCache = new WeakMap;", "  class AutoPlacer {")}
return { _getCachedPrePlaceAngles };
})()`);

const client = {};
let computed = 0;
const compute = steps => i => {
  computed++;
  return { angle: AngleGrid.fromIndex(i, steps), placeable: i % 2 === 0 };
};

computed = 0;
let angles = _getCachedPrePlaceAngles(client, 1, "k", compute(144), false, 1, -1, 144);
check("scans 144 angles", angles.length === 144);
check("computes each one once", computed === 144, `${computed} computes`);
check("leaves no gaps", angles.every(e => e !== null));
check("last angle is one step short of a full turn",
  Math.abs(angles[143].angle - (TAU - AngleGrid.step(144))) < 1e-12);

computed = 0;
_getCachedPrePlaceAngles(client, 1, "k", compute(144), false, 1, -1, 144);
check("a second call in the same tick is free", computed === 0);

/* Moving the slider mid-game must not leave a half-filled array behind. */
angles = _getCachedPrePlaceAngles(client, 1, "k", compute(72), false, 1, -1, 72);
check("resizes down to 72 within a tick", angles.length === 72 && angles.every(e => e !== null));
angles = _getCachedPrePlaceAngles(client, 2, "k", compute(288), false, 1, -1, 288);
check("resizes up to 288", angles.length === 288 && angles.every(e => e !== null));

angles = _getCachedPrePlaceAngles(client, 3, "p", compute(144), false, 2, 100, 144);
check("refreshes the enemy-facing step off-phase", angles[100] !== null && angles.length === 144);
check("ignores an out-of-range priority index",
  _getCachedPrePlaceAngles(client, 4, "p", compute(144), false, 2, 200, 144).length === 144);

const quadrant = 144 / 4;
const bins = {};
for (let i = 0; i < 144; i++) bins[Math.floor(i / quadrant)] = (bins[Math.floor(i / quadrant)] || 0) + 1;
check("four equal quadrants", Object.keys(bins).length === 4 && Object.values(bins).every(n => n === 36),
  JSON.stringify(bins));
check("an enemy due east is quadrant 0", Math.floor(AngleGrid.index(0, 144) / quadrant) === 0);
check("an enemy due south is quadrant 1", Math.floor(AngleGrid.index(Math.PI / 2, 144) / quadrant) === 1);

/* ------------------------------------------------------------------ *
 * What the scan costs, on the client's own spatial grid
 * ------------------------------------------------------------------ */

if (withCost) {
  console.log("\nscan cost (one tick = eight cached scans)\n");

  const SpatialHashGrid2D = eval(
    `(() => {\n${region("  class SpatialHashGrid2D {", "  class ObjectManager")}\nreturn SpatialHashGrid2D; })()`
  );

  for (const [count, spread] of [[60, 400], [150, 700], [500, 700]]) {
    const grid = new SpatialHashGrid2D(100);
    const objects = new Map;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, r = Math.random() * spread;
      const object = {
        pos: { current: { x: 7000 + Math.cos(a) * r, y: 7000 + Math.sin(a) * r } },
        placementScale: 45
      };
      objects.set(i, object);
      grid.insert(object.pos.current.x, object.pos.current.y, 45, i);
    }
    /* the shape of AutoPlacer._canPlace */
    const canPlace = angle => {
      const cx = 7000 + 70 * Math.cos(angle), cy = 7000 + 70 * Math.sin(angle);
      let collision = false;
      grid.query(cx, cy, 4, id => {
        if (collision) return;
        const object = objects.get(id);
        if (!object) return;
        if (Math.hypot(cx - object.pos.current.x, cy - object.pos.current.y) < 35 + object.placementScale) {
          collision = true;
        }
      });
      return !collision;
    };
    const tick = steps => {
      for (let key = 0; key < 8; key++) {
        for (let i = 0; i < steps; i++) canPlace(AngleGrid.fromIndex(i, steps));
      }
    };
    for (let i = 0; i < 30; i++) tick(144); // warm up
    const timings = [72, 144, 288].map(steps => {
      const start = process.hrtime.bigint();
      for (let t = 0; t < 200; t++) tick(steps);
      return (Number(process.hrtime.bigint() - start) / 1e6 / 200).toFixed(1) + " ms";
    });
    console.log(
      `  ${String(count).padStart(3)} objects within ${spread}:  ` +
      `72 -> ${timings[0]}   144 -> ${timings[1]}   288 -> ${timings[2]}`
    );
  }
  console.log("\n  a game tick is 111 ms.");
}

console.log(failures ? `\n${failures} failing` : "\nall angle checks pass");
process.exit(failures ? 1 : 0);
