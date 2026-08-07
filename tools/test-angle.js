#!/usr/bin/env node
/*
 * test-angle.js
 *
 * Exercises the angle engine in ReUp_Mix.user.js against stand-ins for the
 * parts of the client it talks to. Everything under test is lifted out of
 * the built script by its source text, so the tests run the shipped code
 * rather than a copy of it that can drift.
 *
 *   node tools/test-angle.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const BUILD = path.join(ROOT, "ReUp_Mix.user.js");
const source = fs.readFileSync(BUILD, "utf8");

/* ---------------------------------------------------------------- *
 * Lift the code under test out of the build
 * ---------------------------------------------------------------- */

function slice(label, from, to) {
  const start = source.indexOf(from);
  if (start === -1) throw new Error(`could not find start of ${label}`);
  const end = source.indexOf(to, start);
  if (end === -1) throw new Error(`could not find end of ${label}`);
  return source.slice(start, end);
}

const engineSource = slice(
  "the angle engine",
  "  const TAU = PI * 2;",
  "  const toRadians = degrees =>"
);

/* The placer refinement is a class method, so it comes out as a bare
 * function body and gets a `this` at call time. */
const refineSource = slice(
  "the placement refinement",
  "    _reupRefineAngle(id, angle, myPos) {",
  "\n    _addPredictObject("
);

/* ---------------------------------------------------------------- *
 * Stand-ins for the client
 * ---------------------------------------------------------------- */

const PI = Math.PI;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getAngleDist = (a, b) => {
  const p = Math.abs(b - a) % (PI * 2);
  return p > PI ? PI * 2 - p : p;
};

const state = {
  settings: {
    _smartAim: true,
    _targetLock: false,
    _targetLockRange: 400,
    _placerRefine: true,
  },
  offset: { x: 0, y: 0 },
  view: { w: 1920, h: 1080 },
  window: { innerWidth: 1920, innerHeight: 1080 },
};

const sandbox = {
  PI,
  clamp,
  getAngleDist,
  Math,
  Number,
  Infinity,
  Settings_default: state.settings,
  Config_default: { serverUpdateRate: 9 },
  ZoomHandler_default: {
    _scale: {
      _smooth: {
        get _w() {
          return state.view.w;
        },
        get _h() {
          return state.view.h;
        },
      },
    },
  },
  RYN: {
    get _offset() {
      return state.offset;
    },
  },
  DataHandler_default: {
    getWeapon: id => sandbox.Weapons[id],
  },
  Weapons: {
    0: { name: "tool hammer", range: 65 },
    9: { name: "hunting bow", range: 700, projectile: 0 },
  },
  Projectiles: [{ name: "arrow", speed: 1.6 }],
  get window() {
    return state.window;
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(engineSource + "\nglobalThis.__engine = { ReUpAim, normalizeAngle, angleDelta, TAU };", sandbox);
vm.runInContext(
  `globalThis.__refine = { ${refineSource} };`,
  sandbox
);

const { ReUpAim, normalizeAngle, angleDelta } = sandbox.__engine;
const refineHost = sandbox.__refine;

/* A player, near enough to what the engine reads off the real one. */
function vec(x, y) {
  return {
    x,
    y,
    distance(other) {
      return Math.hypot(other.x - this.x, other.y - this.y);
    },
    angle(other) {
      return Math.atan2(other.y - this.y, other.x - this.x);
    },
  };
}

function player(x, y, extra = {}) {
  return Object.assign(
    {
      inGame: true,
      pos: { current: vec(x, y) },
      speed: 0,
      move_dir: 0,
      weapon: { current: 0 },
    },
    extra
  );
}

function client(me, enemies = [], pong = 0) {
  return {
    isOwner: true,
    myPlayer: me,
    PlayerManager: { enemies },
    PacketManager: { pong },
  };
}

/* ---------------------------------------------------------------- *
 * Harness
 * ---------------------------------------------------------------- */

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function near(actual, expected, tolerance, message) {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${message} (got ${actual}, wanted ${expected} +/- ${tolerance})`);
  }
}

function reset() {
  state.settings._smartAim = true;
  state.settings._targetLock = false;
  state.settings._targetLockRange = 400;
  state.settings._placerRefine = true;
  state.view = { w: 1920, h: 1080 };
  state.window = { innerWidth: 1920, innerHeight: 1080 };
  state.offset = { x: 0, y: 0 };
  ReUpAim.known = false;
  ReUpAim.mouseX = 0;
  ReUpAim.mouseY = 0;
}

/* ---------------------------------------------------------------- *
 * Angle arithmetic
 * ---------------------------------------------------------------- */

test("normalizeAngle folds into (-pi, pi]", () => {
  near(normalizeAngle(0), 0, 1e-12, "zero");
  near(normalizeAngle(3 * PI), PI, 1e-12, "3pi");
  near(Math.abs(normalizeAngle(-3 * PI)), PI, 1e-12, "-3pi folds onto the seam");
  for (let i = -20; i <= 20; i++) {
    const raw = i * 0.7;
    const folded = normalizeAngle(raw);
    assert(folded > -PI - 1e-9 && folded <= PI + 1e-9, `out of range for ${raw}`);
    near(Math.cos(folded), Math.cos(raw), 1e-9, `cos changed for ${raw}`);
    near(Math.sin(folded), Math.sin(raw), 1e-9, `sin changed for ${raw}`);
  }
});

test("angleDelta is the shortest signed turn", () => {
  near(angleDelta(3.1, -3.1), 2 * PI - 6.2, 1e-9, "across the wrap");
  near(angleDelta(0.1, 0.4), 0.3, 1e-9, "small positive");
  near(angleDelta(0.4, 0.1), -0.3, 1e-9, "small negative");
});

test("the resend deadzone the fix replaces misreads the wrap", () => {
  /* Facing just west of pi, server reporting just east of -pi: the same
   * direction to within a hundredth of a radian. The old comparison saw
   * 6.27 rad of drift and resent every tick; getAngleDist sees 0.02. */
  const mine = 3.13;
  const server = -3.13;
  assert(Math.abs(mine - server) > 6, "the old comparison should blow up here");
  near(getAngleDist(mine, server), 0.0231853, 1e-6, "real distance is tiny");
});

/* ---------------------------------------------------------------- *
 * Camera-corrected cursor
 * ---------------------------------------------------------------- */

test("worldMouse inverts the render transform", () => {
  reset();
  /* Camera centred on (5000, 5000): offset is the top-left corner. */
  state.offset = { x: 5000 - 960, y: 5000 - 540 };
  ReUpAim.setMouse(960 + 100, 540 - 50);
  const world = ReUpAim.worldMouse();
  near(world.camX, 5000, 1e-9, "camera x");
  near(world.camY, 5000, 1e-9, "camera y");
  near(world.x, 5100, 1e-9, "world x");
  near(world.y, 4950, 1e-9, "world y");
});

test("worldMouse follows the zoom", () => {
  reset();
  state.view = { w: 3840, h: 2160 }; /* zoomed out 2x */
  state.offset = { x: 5000 - 1920, y: 5000 - 1080 };
  ReUpAim.setMouse(960 + 100, 540);
  const world = ReUpAim.worldMouse();
  /* Half the screen scale, so a screen pixel is two world units. */
  near(world.x, 5200, 1e-9, "world x at 2x zoom");
  near(world.y, 5000, 1e-9, "world y at 2x zoom");
});

test("worldMouse holds off until it has a camera and a cursor", () => {
  reset();
  assert(ReUpAim.worldMouse() === null, "no cursor yet");
  ReUpAim.setMouse(1000, 500);
  assert(ReUpAim.worldMouse() === null, "no camera yet");
  state.offset = { x: 100, y: 100 };
  assert(ReUpAim.worldMouse() !== null, "should work once both are known");
});

test("cursorAngle aims from the player, not the screen centre", () => {
  reset();
  /* Camera is 40px behind a player running east: the classic case, and
   * the one the screen-centre angle gets wrong. */
  const me = player(5000, 5000);
  state.offset = { x: 4960 - 960, y: 5000 - 540 };
  ReUpAim.setMouse(960, 540 - 200); /* 200px up the screen */
  const corrected = ReUpAim.cursorAngle(client(me));
  /* Cursor is at world (4960, 4800); from (5000, 5000) that is up and
   * slightly left, not straight up. */
  near(corrected, Math.atan2(4800 - 5000, 4960 - 5000), 1e-9, "corrected angle");
  const vanilla = Math.atan2(-200, 0);
  assert(
    Math.abs(getAngleDist(corrected, vanilla)) > 0.15,
    "should differ from the screen-centre angle by a real margin"
  );
});

test("cursorAngle gives up when the camera is not on the player", () => {
  reset();
  const me = player(5000, 5000);
  state.offset = { x: 20000, y: 20000 }; /* spectating elsewhere */
  ReUpAim.setMouse(1000, 500);
  assert(ReUpAim.cursorAngle(client(me)) === null, "should fall back");
});

test("cursorAngle keeps the old angle when the cursor is on the player", () => {
  reset();
  const me = player(5000, 5000);
  state.offset = { x: 5000 - 960, y: 5000 - 540 };
  ReUpAim.setMouse(960, 540);
  assert(ReUpAim.cursorAngle(client(me)) === null, "no direction to report");
});

/* ---------------------------------------------------------------- *
 * Leading
 * ---------------------------------------------------------------- */

test("leadAngle points straight at a target that is not moving", () => {
  reset();
  const me = player(5000, 5000);
  const enemy = player(5200, 5000);
  near(ReUpAim.leadAngle(client(me, [enemy], 60), enemy), 0, 1e-9, "due east");
});

test("leadAngle leads a moving target, and more of it with distance", () => {
  reset();
  const me = player(5000, 5000);
  const enemy = player(5200, 5000, { speed: 12, move_dir: PI / 2 });
  const melee = ReUpAim.leadAngle(client(me, [enemy], 60), enemy);
  assert(melee > 0.05, `melee should lead ahead of the target, got ${melee}`);

  me.weapon.current = 9; /* hunting bow: arrow flight adds to the lead */
  const ranged = ReUpAim.leadAngle(client(me, [enemy], 60), enemy);
  assert(ranged > melee, `arrow flight should add lead (${ranged} vs ${melee})`);
});

test("leadAngle is capped so a sprinting target cannot swing the aim away", () => {
  reset();
  const me = player(5000, 5000);
  const enemy = player(5200, 5000, { speed: 30, move_dir: PI / 2 });
  const huge = ReUpAim.leadAngle(client(me, [enemy], 5000), enemy);
  const capped = Math.atan2(4 * 30, 200);
  near(huge, capped, 1e-9, "four ticks of lead is the ceiling");
});

/* ---------------------------------------------------------------- *
 * Target choice
 * ---------------------------------------------------------------- */

test("pickTarget prefers the enemy the cursor is already on", () => {
  reset();
  const me = player(5000, 5000);
  state.offset = { x: 5000 - 960, y: 5000 - 540 };
  const east = player(5150, 5000);
  const west = player(4900, 5000);
  /* Cursor to the west, so the slightly further west enemy should win. */
  ReUpAim.setMouse(960 - 300, 540);
  assert(ReUpAim.pickTarget(client(me, [east, west])) === west, "cursor should decide");
  ReUpAim.setMouse(960 + 300, 540);
  assert(ReUpAim.pickTarget(client(me, [east, west])) === east, "and the other way");
});

test("pickTarget ignores enemies out of range", () => {
  reset();
  const me = player(5000, 5000);
  const far = player(5000 + 500, 5000);
  assert(ReUpAim.pickTarget(client(me, [far])) === null, "500 > 400 range");
  state.settings._targetLockRange = 600;
  assert(ReUpAim.pickTarget(client(me, [far])) === far, "in range once widened");
});

test("resolve only locks on when the setting is on", () => {
  reset();
  const me = player(5000, 5000);
  state.offset = { x: 5000 - 960, y: 5000 - 540 };
  ReUpAim.setMouse(960 + 200, 540);
  const enemy = player(5000, 5200); /* due south, cursor points east */
  const c = client(me, [enemy]);
  near(ReUpAim.resolve(c), 0, 1e-9, "cursor angle while unlocked");
  state.settings._targetLock = true;
  near(ReUpAim.resolve(c), PI / 2, 1e-9, "target angle while locked");
  state.settings._targetLock = false;
  state.settings._smartAim = false;
  assert(ReUpAim.resolve(c) === null, "nothing to say with both off");
});

/* ---------------------------------------------------------------- *
 * Multi-hit angle
 *
 * The claim being tested is that the candidate set cannot do worse than
 * sweeping every angle, on any arrangement of objects.
 * ---------------------------------------------------------------- */

test("coverageCandidates beat a fine sweep on random arrangements", () => {
  reset();
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let trial = 0; trial < 400; trial++) {
    const count = 1 + Math.floor(random() * 6);
    const windows = [];
    for (let i = 0; i < count; i++) {
      windows.push({
        angle: (random() * 2 - 1) * PI,
        cone: 0.2 + random() * 1,
        weight: random() < 0.3 ? -10 : 100,
      });
    }
    const score = a => {
      let total = 0;
      for (const w of windows) {
        if (getAngleDist(a, w.angle) <= w.cone) total += w.weight;
      }
      return total;
    };

    let sweepBest = -Infinity;
    for (let i = 0; i < 3600; i++) {
      sweepBest = Math.max(sweepBest, score((i / 3600) * 2 * PI - PI));
    }

    let candidateBest = -Infinity;
    for (const a of ReUpAim.coverageCandidates(windows, 0)) {
      candidateBest = Math.max(candidateBest, score(a));
    }

    assert(
      candidateBest >= sweepBest,
      `trial ${trial}: candidates scored ${candidateBest}, a 0.1 degree sweep found ${sweepBest}`
    );
  }
});

test("coverageCandidates find a multi-hit a 5 degree sweep walks past", () => {
  reset();
  /* Two objects 0.9 rad apart with 0.47 rad cones. Both are covered only
   * from within a 0.04 rad window - narrower than the 0.087 rad grid
   * step, and placed so that no grid angle lands inside it. */
  const gridStep = (2 * PI) / 72;
  const a = 0.02;
  const windows = [
    { angle: a, cone: 0.47 },
    { angle: a + 0.9, cone: 0.47 },
  ];
  const score = angle => windows.filter(w => getAngleDist(angle, w.angle) <= w.cone).length;

  let sweepBest = 0;
  for (let i = 0; i < 72; i++) sweepBest = Math.max(sweepBest, score((i / 72) * 2 * PI));
  assert(sweepBest === 1, `the 72 point sweep should miss the double, got ${sweepBest}`);

  let candidateBest = 0;
  for (const angle of ReUpAim.coverageCandidates(windows, a)) {
    candidateBest = Math.max(candidateBest, score(angle));
  }
  assert(candidateBest === 2, `candidates should find the double, got ${candidateBest}`);
});

/* ---------------------------------------------------------------- *
 * Placement refinement
 * ---------------------------------------------------------------- */

/* A placer stand-in: one blocked arc, and _canPlace answers against it. */
function placerWithBlockedArc(from, to) {
  return {
    client: { ObjectManager: null },
    _canPlace(id, angle) {
      const mid = (from + to) / 2;
      const half = (to - from) / 2;
      return getAngleDist(angle, mid) > half;
    },
    _reupRefineAngle: refineHost._reupRefineAngle,
  };
}

test("refinement slides a placement flush against the blocker", () => {
  reset();
  const gridStep = (2 * PI) / 72;
  /* Blocked from 0.5 rad clockwise. The grid angle below it is free, but
   * sits up to a full step away from the edge. */
  const placer = placerWithBlockedArc(0.5, 1.5);
  const gridAngle = Math.floor(0.5 / gridStep) * gridStep;
  assert(placer._canPlace(4, gridAngle), "the grid angle is free to begin with");

  const refined = placer._reupRefineAngle(4, gridAngle, null);
  assert(placer._canPlace(4, refined), "refined angle must still be placeable");
  assert(refined > gridAngle, "should have moved toward the blocker");
  assert(0.5 - refined < gridStep / 16, `should end up flush, ${0.5 - refined} off`);
});

test("refinement centres a placement in a slot", () => {
  reset();
  const gridStep = (2 * PI) / 72;
  /* Free only between 0.5 and 0.5 + one grid step: both neighbours of
   * the grid angle inside it are blocked. */
  const free = [0.5, 0.5 + gridStep];
  const placer = {
    client: { ObjectManager: null },
    _canPlace(id, angle) {
      return angle > free[0] && angle < free[1];
    },
    _reupRefineAngle: refineHost._reupRefineAngle,
  };
  const inside = (free[0] + free[1]) / 2 - gridStep / 8;
  const refined = placer._reupRefineAngle(4, inside, null);
  assert(placer._canPlace(4, refined), "refined angle must still be placeable");
  near(refined, (free[0] + free[1]) / 2, gridStep / 16, "should sit in the middle of the slot");
});

test("refinement leaves an angle alone when nothing is next to it", () => {
  reset();
  const placer = {
    client: { ObjectManager: null },
    _canPlace: () => true,
    _reupRefineAngle: refineHost._reupRefineAngle,
  };
  near(placer._reupRefineAngle(4, 1.234, null), 1.234, 0, "open ring, no change");
});

test("refinement is off when the setting is off", () => {
  reset();
  state.settings._placerRefine = false;
  const placer = placerWithBlockedArc(0.5, 1.5);
  near(placer._reupRefineAngle(4, 0.4, null), 0.4, 0, "should be a no-op");
});

test("refinement never moves an angle that was already blocked", () => {
  reset();
  const placer = placerWithBlockedArc(0.5, 1.5);
  near(placer._reupRefineAngle(4, 1, null), 1, 0, "blocked stays put");
});

/* ---------------------------------------------------------------- */

if (failures.length) {
  console.error(`\n${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error("  x " + failure);
  process.exit(1);
}
console.log(`\n${passed} angle tests passed against ${path.relative(ROOT, BUILD)}\n`);
