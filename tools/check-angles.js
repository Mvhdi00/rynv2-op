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
 * --cost also times the scan against the client's own spatial grid, the shipped
 * analytic mask next to the per-angle sampling it replaced.
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const withCost = args.includes("--cost");
const target = args.find(a => !a.startsWith("--")) || "ReUp_Mix.user.js";
const file = path.resolve(process.cwd(), target);
const src = fs.readFileSync(file, "utf8");

/* Cut a region out of the build by its opening and closing landmarks. The two
 * clients put different code after the same block, so an end marker may be
 * given as a list and the nearest one that exists wins. */
function region(startMarker, endMarkers) {
  const a = src.indexOf(startMarker);
  if (a === -1) throw new Error(`not found in ${target}: ${startMarker.trim()}`);
  const ends = [].concat(endMarkers).map(m => src.indexOf(m, a)).filter(i => i !== -1);
  if (!ends.length) throw new Error(`no end for ${startMarker.trim()}`);
  return src.slice(a, Math.min(...ends));
}
/* v5 replaced RYN's AutoPlacer with the Auraro placer, which is geometric and
 * has no step count, so it carries no preplace scan cache to test. */
const hasPrePlaceCache = src.includes("  const _prePlaceAngleCache = new WeakMap;");

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
  _moveAngleSteps: 624,
  _buildAngleSteps: 624,
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

check("624 steps by default", AngleGrid.moveSteps === 624 && AngleGrid.buildStepsOr(72) === 624);
check("624 is at or under what the game can express", 624 <= Math.floor(TAU / 0.01) && 624 % 8 === 0,
  `game ceiling ${Math.floor(TAU / 0.01)}`);
check("a step is 0.577 degrees", near(deg(AngleGrid.step(624)), 360 / 624, 1e-12));

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
for (const steps of [8, 16, 144, 360, 624]) {
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
/* one press is Math.max(1, round(steps / 144)) steps, so the turn rate stays
 * about 2.5 degrees per press however fine the grid is */
const perPress = steps => Math.max(1, Math.round(steps / 144));
for (const steps of [8, 144, 288, 624]) {
  Settings_default._moveAngleSteps = steps;
  input.moveNudge = perPress(steps);
  let turned = deg(input.getMoveAngle()) - deg(base);
  if (turned > 180) turned -= 360;
  /* about 2.5 degrees wherever the grid can express it, and one whole step on
   * a grid too coarse to - never less than the grid allows */
  const want = Math.max(360 / steps, 2.5);
  check(`a press turns ${want.toFixed(2)} deg at ${steps} steps`, Math.abs(turned - want) <= 360 / steps,
    `${turned.toFixed(2)} deg`);
}
Settings_default._moveAngleSteps = 624;
input.moveNudge = -perPress(624);
check("nudging below zero wraps", near(deg(input.getMoveAngle()), 360 - 4 * 360 / 624));
input.moveNudge = 156;
check("156 steps is a quarter turn", near(deg(input.getMoveAngle()), 90));
input.moveNudge = 0;

Settings_default._mouseMovement = true;
const cursor = 33 * Math.PI / 180;
input.mouse.angle = cursor;
const GRID = 624;
const relative = [
  [UP, 0, "W goes toward the cursor"],
  [RIGHT, Math.PI / 2, "D strafes right of it"],
  [DOWN, Math.PI, "S backs away from it"],
  [LEFT, -Math.PI / 2, "A strafes left of it"]
];
for (const [keys, offset, name] of relative) {
  input.move = keys;
  check(name, near(input.getMoveAngle(), AngleGrid.snap(cursor + offset, GRID)));
}

/* A full cursor sweep has to reach every direction, and cost one packet per
 * step crossed rather than one per mouse event. */
input.move = UP;
const reached = new Set();
const sweepAt = i => {
  input.mouse.angle = (i / 20000) * TAU - Math.PI;
  return input.getMoveAngle();
};
let sends = 0, last = sweepAt(0);
reached.add(AngleGrid.index(last, GRID));
for (let i = 1; i < 20000; i++) {
  const a = sweepAt(i);
  reached.add(AngleGrid.index(a, GRID));
  if (a !== last) {
    sends++;
    last = a;
  }
}
check("a cursor sweep reaches all 624", reached.size === 624, `${reached.size} reached`);
check("one send per step crossed, not per mouse event", sends <= 624, `${sends} sends over 20000 mouse events`);

Settings_default._mouseMovement = false;
Settings_default._preciseAngles = false;
check("off puts every sweep back to its own step count",
  AngleGrid.moveSteps === 8 && AngleGrid.buildStepsOr(72) === 72 && AngleGrid.buildStepsOr(36) === 36);
input.move = UP;
input.moveNudge = 5;
input.mouse.angle = 1.2;
check("off ignores nudge and cursor", near(deg(input.getMoveAngle()), 270));
input.moveNudge = 0;
Settings_default._preciseAngles = true;

for (const bad of ["nonsense", 2, null, NaN]) {
  Settings_default._moveAngleSteps = bad;
  check(`a stored ${typeof bad === "string" ? `"${bad}"` : String(bad)} falls back to 624`, AngleGrid.moveSteps === 624);
}
Settings_default._moveAngleSteps = 624;

/* ------------------------------------------------------------------ *
 * The placement scan cache
 * ------------------------------------------------------------------ */

if (!hasPrePlaceCache) {
  console.log("\nplacement scan\n\nskip  no preplace scan cache in this client (geometric placer)\n");
} else {
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
}

/* ------------------------------------------------------------------ *
 * The analytic mask against the sampling original
 *
 * _getPlaceableMask replaced a per-angle _canPlace, so it has to give the same
 * verdict for every angle — including at a tangent, across the 0/2pi seam, and
 * when an object swallows the placement circle whole. Both sides run here: the
 * mask straight out of the build, and _canPlace's own body rebuilt around the
 * same spatial grid.
 * ------------------------------------------------------------------ */

console.log("\nanalytic mask vs sampling\n");

const SpatialHashGrid2D = eval(
  `(() => {\n${region("  class SpatialHashGrid2D {", "  class ObjectManager")}\nreturn SpatialHashGrid2D; })()`
);
const maskOf = eval(`(() => {
const Items = ITEMS;
const Config_default = CONFIG;
${region("  function _getPlaceableMask(", ["  function _getCachedPrePlaceAngles(", "  class SpatialHashGrid2D {"])}
return _getPlaceableMask;
})()`.replace("ITEMS", "[{ scale: 49, placeOffset: -5 }]").replace("CONFIG", "{ mapScale: 14400, riverWidth: 724 }"));

const ITEM_SCALE = 49;
const LENGTH = 35 + 49 - 5;
const MID = 14400 / 2, RIVER_HALF = 724 / 2;

/* _canPlace, angle by angle, against the same grid */
function sampling(scene, steps) {
  const out = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    const angle = i * (TAU / steps);
    const cx = scene.myPos.x + LENGTH * Math.cos(angle);
    const cy = scene.myPos.y + LENGTH * Math.sin(angle);
    let collision = false;
    scene.grid2D.query(cx, cy, 4, id => {
      if (collision) return;
      const obj = scene.objects.get(id);
      if (!obj) return;
      if (Math.hypot(cx - obj.pos.current.x, cy - obj.pos.current.y) < ITEM_SCALE + obj.placementScale) {
        collision = true;
      }
    });
    if (!collision && cy >= MID - RIVER_HALF && cy <= MID - RIVER_HALF + 724) collision = true;
    out[i] = collision ? 0 : 1;
  }
  return out;
}

function build(list, at = { x: 7000, y: 3000 }) {
  const grid2D = new SpatialHashGrid2D(100), objects = new Map;
  list.forEach((o, i) => {
    objects.set(i, { pos: { current: { x: o.x, y: o.y } }, placementScale: o.s });
    grid2D.insert(o.x, o.y, o.s, i);
  });
  return { grid2D, objects, myPos: at };
}

let agree = 0, disagree = 0, blockedSeen = 0;
function sameVerdict(name, list, at) {
  const scene = build(list, at);
  for (const steps of [8, 72, 144, 288, 624, 1440]) {
    const a = sampling(scene, steps);
    const b = maskOf(0, scene.myPos, scene, null, steps);
    let first = -1;
    for (let i = 0; i < steps; i++) {
      if (!a[i]) blockedSeen++;
      if (a[i] === b[i]) agree++;
      else {
        disagree++;
        if (first === -1) first = i;
      }
    }
    if (first !== -1) {
      console.log(`FAIL  ${name} @ ${steps} steps, first at ${(first * 360 / steps).toFixed(2)} deg`);
    }
  }
}

/* well clear of the river band, which is its own case below */
const P = { x: 7000, y: 3000 };
for (const eps of [-0.5, -1e-9, 0, 1e-9, 0.5]) {
  sameVerdict(`tangent${eps >= 0 ? "+" : ""}${eps}`, [{ x: P.x + LENGTH + 98 + eps, y: P.y, s: 49 }]);
}
sameVerdict("object swallows the circle", [{ x: P.x, y: P.y, s: 200 }]);
sameVerdict("object on the player", [{ x: P.x, y: P.y, s: 49 }]);
sameVerdict("almost swallows", [{ x: P.x + 1, y: P.y, s: 49 + LENGTH - 1 }]);
sameVerdict("arc across the 0/2pi seam", [{ x: P.x + 130, y: P.y, s: 52 }]);
sameVerdict("tree reaching in", [{ x: P.x + 200, y: P.y + 40, s: 105 }]);
sameVerdict("nothing in range", [{ x: P.x + 2000, y: P.y, s: 110 }]);
sameVerdict("empty", []);
sameVerdict("four gaps", [
  { x: P.x + 120, y: P.y, s: 45 }, { x: P.x - 120, y: P.y, s: 45 },
  { x: P.x, y: P.y + 120, s: 45 }, { x: P.x, y: P.y - 120, s: 45 }
]);
sameVerdict("dense ring", Array.from({ length: 24 }, (_, i) => ({
  x: P.x + Math.cos(i / 24 * TAU) * 150, y: P.y + Math.sin(i / 24 * TAU) * 150, s: 49
})));
/* on the river bank, where the river rule decides */
sameVerdict("river bank", [{ x: P.x + 150, y: MID - RIVER_HALF - 40, s: 49 }], { x: P.x, y: MID - RIVER_HALF - 40 });

let seed = 99;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let t = 0; t < 300; t++) {
  sameVerdict("fuzz" + t, Array.from({ length: 1 + Math.floor(rnd() * 25) }, () => {
    const a = rnd() * TAU, r = 100 + rnd() * 260;
    return {
      x: P.x + Math.cos(a) * r,
      y: P.y + Math.sin(a) * r,
      s: [45, 49, 52, 65, 105, 110][Math.floor(rnd() * 6)]
    };
  }));
}

check("the mask matches the sampling it replaced, angle for angle", disagree === 0,
  `${agree} agreements, ${disagree} disagreements, ${(blockedSeen / (agree + disagree) * 100).toFixed(0)}% blocked`);

/* ------------------------------------------------------------------ *
 * What the scan costs, on the client's own spatial grid
 * ------------------------------------------------------------------ */

if (withCost) {
  console.log("\nscan cost, ms per tick (eight cached scans)\n");
  console.log("  objects |  per-angle sampling 72 / 144  |  analytic mask 72 / 144 / 624 / 1440");

  for (const [count, spread] of [[60, 400], [150, 700], [500, 700]]) {
    let s2 = count * 7919;
    const rnd2 = () => (s2 = (s2 * 1103515245 + 12345) % 2147483648) / 2147483648;
    const scene = build(Array.from({ length: count }, () => {
      const a = rnd2() * TAU, r = 140 + Math.sqrt(rnd2()) * spread;
      return {
        x: P.x + Math.cos(a) * r,
        y: P.y + Math.sin(a) * r,
        s: [45, 45, 49, 49, 52, 52, 65, 110][Math.floor(rnd2() * 8)]
      };
    }));
    const time = (fn, steps) => {
      for (let i = 0; i < 30; i++) fn(scene, steps);
      const t0 = process.hrtime.bigint();
      for (let t = 0; t < 120; t++) for (let k = 0; k < 8; k++) fn(scene, steps);
      return (Number(process.hrtime.bigint() - t0) / 1e6 / 120).toFixed(2);
    };
    const shipped = (sc, steps) => maskOf(0, sc.myPos, sc, null, steps);
    console.log(
      "  " + String(count).padStart(7) + " |  " +
      [72, 144].map(n => time(sampling, n)).join("  /  ").padEnd(28) + "  |  " +
      [72, 144, 624, 1440].map(n => time(shipped, n)).join("  /  ")
    );
  }
  console.log("\n  a game tick is 111 ms.");
}

console.log(failures ? `\n${failures} failing` : "\nall angle checks pass");
process.exit(failures ? 1 : 0);
