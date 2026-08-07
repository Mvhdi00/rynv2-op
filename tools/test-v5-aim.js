#!/usr/bin/env node
/*
 * test-v5-aim.js
 *
 * Exercises v5-src/reup-aim.js - the angle engine injected into both v5
 * builds - against stand-ins for the parts of the client it talks to, and
 * then checks that both patched builds actually carry it.
 *
 *   node tools/test-v5-aim.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/* ---------------------------------------------------------------- *
 * A window for the engine to live in
 * ---------------------------------------------------------------- */

const state = {
  settings: {},
  offset: { x: 0, y: 0 },
  view: { w: 1920, h: 1080 },
};

/* RYN._offset is a Vector instance in the client; the engine takes the
 * Vector class off it, so the stand-in needs to be a real class. */
class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

global.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  RYN: {
    get _settings() {
      return state.settings;
    },
    get _offset() {
      return Object.assign(new Vector(), state.offset);
    },
    _ZoomHandler: {
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
  },
};

const aim = require(path.join(ROOT, "v5-src/reup-aim.js"));

/* ---------------------------------------------------------------- *
 * Client stand-ins
 * ---------------------------------------------------------------- */

function player(x, y, extra = {}) {
  return Object.assign(
    {
      inGame: true,
      pos: { current: { x, y } },
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
    EnemyManager: { nearestEnemy: enemies[0] || null },
    InputHandler: { rotation: true },
  };
}

/* ---------------------------------------------------------------- *
 * Harness
 * ---------------------------------------------------------------- */

const PI = Math.PI;
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
  state.settings = { _smartAim: true, _targetLock: false, _targetLockRange: 400, _smartBreakAngle: true };
  state.offset = { x: 0, y: 0 };
  state.view = { w: 1920, h: 1080 };
  global.window.innerWidth = 1920;
  global.window.innerHeight = 1080;
  aim.known = false;
  aim.mouseX = 0;
  aim.mouseY = 0;
}

/* Camera centred on a world point, as the renderer offset would leave it. */
function cameraOn(x, y) {
  state.offset = { x: x - state.view.w / 2, y: y - state.view.h / 2 };
}

/* ---------------------------------------------------------------- *
 * Settings plumbing
 * ---------------------------------------------------------------- */

test("settings fall back to defaults when the build has no key yet", () => {
  reset();
  state.settings = {};
  assert(aim.setting("_smartAim") === true, "precision aim defaults on");
  assert(aim.setting("_targetLock") === false, "target lock defaults off");
  assert(aim.setting("_targetLockRange") === 400, "range default");
  assert(aim.setting("_smartBreakAngle") === true, "break angle defaults on");
});

test("settings from the client win over the defaults", () => {
  reset();
  state.settings._smartAim = false;
  assert(aim.setting("_smartAim") === false, "should read the client's value");
});

/* ---------------------------------------------------------------- *
 * Angle arithmetic
 * ---------------------------------------------------------------- */

test("normalize folds onto (-pi, pi] without changing direction", () => {
  reset();
  for (let i = -20; i <= 20; i++) {
    const raw = i * 0.7;
    const folded = aim.normalize(raw);
    assert(folded >= -PI - 1e-9 && folded <= PI + 1e-9, `out of range for ${raw}`);
    near(Math.cos(folded), Math.cos(raw), 1e-9, `cos changed for ${raw}`);
    near(Math.sin(folded), Math.sin(raw), 1e-9, `sin changed for ${raw}`);
  }
});

test("angleDist is wrap-safe across the seam", () => {
  reset();
  near(aim.angleDist(3.13, -3.13), 0.0231853, 1e-6, "two angles either side of pi are close");
  near(aim.angleDist(0.1, 0.4), 0.3, 1e-9, "ordinary case");
  near(aim.angleDist(0.4, 0.1), 0.3, 1e-9, "and symmetric");
});

/* ---------------------------------------------------------------- *
 * Camera-corrected cursor
 * ---------------------------------------------------------------- */

test("worldMouse inverts the render transform", () => {
  reset();
  cameraOn(5000, 5000);
  aim.setMouse(960 + 100, 540 - 50);
  const world = aim.worldMouse();
  near(world.camX, 5000, 1e-9, "camera x");
  near(world.camY, 5000, 1e-9, "camera y");
  near(world.x, 5100, 1e-9, "world x");
  near(world.y, 4950, 1e-9, "world y");
});

test("worldMouse follows the zoom", () => {
  reset();
  state.view = { w: 3840, h: 2160 };
  cameraOn(5000, 5000);
  aim.setMouse(960 + 100, 540);
  const world = aim.worldMouse();
  near(world.x, 5200, 1e-9, "a screen pixel is two world units at 2x zoom");
  near(world.y, 5000, 1e-9, "world y");
});

test("worldMouse holds off until it has both a cursor and a camera", () => {
  reset();
  assert(aim.worldMouse() === null, "no cursor yet");
  aim.setMouse(1000, 500);
  assert(aim.worldMouse() === null, "no camera yet");
  cameraOn(5000, 5000);
  assert(aim.worldMouse() !== null, "works once both are known");
});

test("cursorAngle aims from the player, not the centre of the screen", () => {
  reset();
  /* Camera 40px behind a player running east - the ordinary case, and the
   * one the screen-centre angle gets wrong. */
  const me = player(5000, 5000);
  cameraOn(4960, 5000);
  aim.setMouse(960, 540 - 200);
  const corrected = aim.cursorAngle(client(me));
  near(corrected, Math.atan2(4800 - 5000, 4960 - 5000), 1e-9, "corrected angle");
  const vanilla = Math.atan2(-200, 0);
  assert(aim.angleDist(corrected, vanilla) > 0.15, "should differ from the stock angle by a real margin");
});

test("cursorAngle gives up when the camera is not on the player", () => {
  reset();
  const me = player(5000, 5000);
  cameraOn(20000, 20000);
  aim.setMouse(1000, 500);
  assert(aim.cursorAngle(client(me)) === null, "should fall back to the stock angle");
});

test("cursorAngle reports nothing when the cursor sits on the player", () => {
  reset();
  const me = player(5000, 5000);
  cameraOn(5000, 5000);
  aim.setMouse(960, 540);
  assert(aim.cursorAngle(client(me)) === null, "no direction to report");
});

test("cursorAngle is off when precision aim is off", () => {
  reset();
  state.settings._smartAim = false;
  const me = player(5000, 5000);
  cameraOn(4960, 5000);
  aim.setMouse(960, 340);
  assert(aim.resolve(client(me)) === null, "resolve should say nothing");
});

/* ---------------------------------------------------------------- *
 * Leading
 * ---------------------------------------------------------------- */

test("leadAngle points straight at a target that is not moving", () => {
  reset();
  const me = player(5000, 5000);
  const enemy = player(5200, 5000);
  near(aim.leadAngle(client(me, [enemy], 60), enemy), 0, 1e-9, "due east");
});

test("leadAngle leads a moving target, and leads further with a bow", () => {
  reset();
  const me = player(5000, 5000);
  const enemy = player(5200, 5000, { speed: 12, move_dir: PI / 2 });
  const melee = aim.leadAngle(client(me, [enemy], 60), enemy);
  assert(melee > 0.05, `melee should lead ahead of the target, got ${melee}`);
  me.weapon.current = 9;
  const ranged = aim.leadAngle(client(me, [enemy], 60), enemy);
  assert(ranged > melee, `arrow flight should add lead (${ranged} vs ${melee})`);
});

test("a faster projectile needs less lead than a slower one", () => {
  reset();
  const me = player(5000, 5000);
  const enemy = player(5600, 5000, { speed: 12, move_dir: PI / 2 });
  me.weapon.current = 9; /* hunting bow, 1.6 */
  const bow = aim.leadAngle(client(me, [enemy], 60), enemy);
  me.weapon.current = 15; /* musket, 3.6 */
  const musket = aim.leadAngle(client(me, [enemy], 60), enemy);
  assert(musket < bow, `the musket should need less lead (${musket} vs ${bow})`);
});

test("leadAngle is capped so a sprinter cannot swing the aim off them", () => {
  reset();
  const me = player(5000, 5000);
  const enemy = player(5200, 5000, { speed: 30, move_dir: PI / 2 });
  const huge = aim.leadAngle(client(me, [enemy], 5000), enemy);
  near(huge, Math.atan2(4 * 30, 200), 1e-9, "four ticks of lead is the ceiling");
});

/* ---------------------------------------------------------------- *
 * Target choice
 * ---------------------------------------------------------------- */

test("pickTarget prefers the enemy the cursor is already on", () => {
  reset();
  const me = player(5000, 5000);
  cameraOn(5000, 5000);
  const east = player(5150, 5000);
  const west = player(4900, 5000);
  aim.setMouse(960 - 300, 540);
  assert(aim.pickTarget(client(me, [east, west])) === west, "cursor should decide");
  aim.setMouse(960 + 300, 540);
  assert(aim.pickTarget(client(me, [east, west])) === east, "and the other way");
});

test("pickTarget ignores enemies out of range", () => {
  reset();
  const me = player(5000, 5000);
  const far = player(5500, 5000);
  assert(aim.pickTarget(client(me, [far])) === null, "500 > 400 range");
  state.settings._targetLockRange = 600;
  assert(aim.pickTarget(client(me, [far])) === far, "in range once widened");
});

test("resolve only locks on when the setting is on", () => {
  reset();
  const me = player(5000, 5000);
  cameraOn(5000, 5000);
  aim.setMouse(960 + 200, 540);
  const enemy = player(5000, 5200);
  const c = client(me, [enemy]);
  near(aim.resolve(c), 0, 1e-9, "cursor angle while unlocked");
  state.settings._targetLock = true;
  near(aim.resolve(c), PI / 2, 1e-9, "target angle while locked");
});

test("target lock falls back to the cursor when nobody is in range", () => {
  reset();
  state.settings._targetLock = true;
  const me = player(5000, 5000);
  cameraOn(5000, 5000);
  aim.setMouse(960 + 200, 540);
  near(aim.resolve(client(me, [])), 0, 1e-9, "still the cursor angle");
});

/* ---------------------------------------------------------------- *
 * Resend threshold
 * ---------------------------------------------------------------- */

test("the resend threshold tightens near an enemy and backs off under load", () => {
  reset();
  const enemy = player(5100, 5000);
  const me = player(5000, 5000);
  const withEnemy = { packetCount: 0, packetLimit: 70, client: client(me, [enemy]) };
  const alone = { packetCount: 0, packetLimit: 70, client: client(me, []) };
  near(aim.angleThreshold(withEnemy), 0.02, 0, "tight in a fight");
  near(aim.angleThreshold(alone), 0.12, 0, "looser with nobody around");
  withEnemy.packetCount = 65;
  near(aim.angleThreshold(withEnemy), 0.3, 0, "back to stock when the budget is spent");
  state.settings._smartAim = false;
  withEnemy.packetCount = 0;
  near(aim.angleThreshold(withEnemy), 0.3, 0, "stock when precision aim is off");
});

/* ---------------------------------------------------------------- *
 * Attack angle
 * ---------------------------------------------------------------- */

test("attackAngle passes the facing through unless the lock is on", () => {
  reset();
  const me = player(5000, 5000);
  const enemy = player(5000, 5200);
  const c = client(me, [enemy]);
  near(aim.attackAngle(c, 1.234), 1.234, 0, "unlocked, hands back what it was given");
  state.settings._targetLock = true;
  near(aim.attackAngle(c, 1.234), PI / 2, 1e-9, "locked, points at the target");
});

/* ---------------------------------------------------------------- *
 * Multi-hit angle
 * ---------------------------------------------------------------- */

test("breakCandidates beat a fine sweep on random arrangements", () => {
  reset();
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const from = { x: 0, y: 0 };

  for (let trial = 0; trial < 400; trial++) {
    const count = 1 + Math.floor(random() * 6);
    const objects = [];
    for (let i = 0; i < count; i++) {
      const angle = (random() * 2 - 1) * PI;
      const radius = 20 + random() * 30;
      objects.push({
        pos: { current: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius } },
        weight: random() < 0.3 ? -10 : 100,
      });
    }
    const gatherAngle = PI / 2.6;
    const target = objects[0];
    const hittable = objects.filter(o => o !== target && o.weight > 0);
    const nonHittable = objects.filter(o => o !== target && o.weight < 0);
    const inRange = () => true;
    const angleOf = o => Math.atan2(o.pos.current.y - from.y, o.pos.current.x - from.x);
    const score = a => {
      let total = 0;
      if (aim.angleDist(a, angleOf(target)) <= gatherAngle / 2) total += 10000;
      else return -Infinity;
      for (const o of hittable) if (aim.angleDist(a, angleOf(o)) <= gatherAngle) total += 100;
      for (const o of nonHittable) if (aim.angleDist(a, angleOf(o)) <= gatherAngle) total -= 10;
      return total;
    };

    let sweepBest = -Infinity;
    for (let i = 0; i < 3600; i++) sweepBest = Math.max(sweepBest, score((i / 3600) * 2 * PI - PI));

    let candidateBest = -Infinity;
    for (const a of aim.breakCandidates(from, angleOf(target), gatherAngle, target, null, hittable, nonHittable, inRange)) {
      candidateBest = Math.max(candidateBest, score(a));
    }

    assert(
      candidateBest >= sweepBest,
      `trial ${trial}: candidates scored ${candidateBest}, a 0.1 degree sweep found ${sweepBest}`
    );
  }
});

test("breakCandidates find a double a 5 degree sweep walks past", () => {
  reset();
  const from = { x: 0, y: 0 };
  const at = (angle, radius = 40) => ({
    pos: { current: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius } },
  });
  /* Two objects 0.9 rad apart, each covered within 0.47 rad: both are hit
   * only from a 0.04 rad window, narrower than the 0.087 rad grid step
   * the stock sweep uses, and placed so no grid angle lands inside it. */
  const cone = 0.47;
  const first = at(0.02);
  const second = at(0.92);
  const angleOf = o => Math.atan2(o.pos.current.y, o.pos.current.x);
  const score = a =>
    (aim.angleDist(a, angleOf(first)) <= cone ? 1 : 0) + (aim.angleDist(a, angleOf(second)) <= cone ? 1 : 0);

  let sweepBest = 0;
  for (let i = 0; i < 72; i++) sweepBest = Math.max(sweepBest, score((i / 72) * 2 * PI));
  assert(sweepBest === 1, `the 72 point sweep should miss the double, got ${sweepBest}`);

  let candidateBest = 0;
  for (const a of aim.breakCandidates(from, 0.02, cone * 2, first, null, [second], [], () => true)) {
    candidateBest = Math.max(candidateBest, score(a));
  }
  assert(candidateBest === 2, `candidates should find the double, got ${candidateBest}`);
});

test("breakCandidates fall back to the 72 point sweep when switched off", () => {
  reset();
  state.settings._smartBreakAngle = false;
  const list = aim.breakCandidates({ x: 0, y: 0 }, 0, 1, null, null, [], [], () => true);
  assert(list.length === 72, `expected the stock sweep, got ${list.length} angles`);
});

/* ---------------------------------------------------------------- *
 * Glue
 * ---------------------------------------------------------------- */

test("onMouseMove tracks the cursor even while rotation is locked", () => {
  reset();
  const me = player(5000, 5000);
  cameraOn(5000, 5000);
  const c = client(me);
  c._ModuleHandler = { _currentAngle: 0 };
  const input = { mouse: { x: 0, y: 0, angle: 0 }, rotation: false, client: c };
  aim.onMouseMove(input, { clientX: 1200, clientY: 300 });
  assert(input.mouse.x === 1200 && input.mouse.y === 300, "cursor position should still be tracked");
  assert(c._ModuleHandler._currentAngle === 0, "but the facing must not be touched");
  input.rotation = true;
  aim.onMouseMove(input, { clientX: 1200, clientY: 300 });
  near(c._ModuleHandler._currentAngle, Math.atan2(300 - 540, 1200 - 960), 1e-9, "facing follows the cursor");
});

test("tickAim re-aims the owner and leaves bots alone", () => {
  reset();
  const me = player(5000, 5000);
  cameraOn(5000, 5000);
  aim.setMouse(960 + 200, 540);
  const c = client(me);
  const moduleHandler = { client: c, _currentAngle: 5 };
  aim.tickAim(moduleHandler);
  near(moduleHandler._currentAngle, 0, 1e-9, "owner gets re-aimed");

  c.isOwner = false;
  moduleHandler._currentAngle = 5;
  aim.tickAim(moduleHandler);
  near(moduleHandler._currentAngle, 5, 0, "a bot's facing is left alone");
});

test("tickAim leaves the facing alone while rotation is locked", () => {
  reset();
  const me = player(5000, 5000);
  cameraOn(5000, 5000);
  aim.setMouse(960 + 200, 540);
  const c = client(me);
  c.InputHandler.rotation = false;
  const moduleHandler = { client: c, _currentAngle: 5 };
  aim.tickAim(moduleHandler);
  near(moduleHandler._currentAngle, 5, 0, "locked direction stays locked");
});

test("cursorWorld hands back a Vector of the client's own class", () => {
  reset();
  const me = player(5000, 5000);
  cameraOn(5000, 5000);
  aim.setMouse(960 + 100, 540 - 50);
  const world = aim.cursorWorld({ client: client(me) });
  assert(world instanceof Vector, "should be the client's Vector class");
  near(world.x, 5100, 1e-9, "world x");
  near(world.y, 4950, 1e-9, "world y");
});

test("every entry point survives a client that is not ready", () => {
  reset();
  const empty = {};
  aim.onMouseMove({ mouse: {}, client: null }, { clientX: 1, clientY: 1 });
  assert(aim.cursorWorld(empty) === null, "cursorWorld");
  aim.tickAim(empty);
  near(aim.angleThreshold(empty), 0.3, 0, "angleThreshold falls back to stock");
  near(aim.attackAngle(null, 1.5), 1.5, 0, "attackAngle hands back the fallback");
  assert(aim.pickTarget(null) === null, "pickTarget");
  assert(aim.cursorAngle(null) === null, "cursorAngle");
});

/* ---------------------------------------------------------------- *
 * The builds themselves
 * ---------------------------------------------------------------- */

const BUILDS = [
  ["RYN_Client_v5_OWNER.user.js", "OWNER"],
  ["RYN_Client_v5_PLAYER.user.js", "PLAYER"],
];

for (const [fileName, label] of BUILDS) {
  test(`${label} build carries the engine and every call site`, () => {
    const file = path.join(ROOT, fileName);
    assert(fs.existsSync(file), `${fileName} has not been built - run node tools/patch-v5.js`);
    const source = fs.readFileSync(file, "utf8");
    const count = needle => source.split(needle).length - 1;
    assert(count("window.__ReUpAim = engine") === 1, "engine should be installed exactly once");
    for (const entry of ["onMouseMove", "cursorWorld", "tickAim", "angleThreshold", "attackAngle", "breakCandidates"]) {
      assert(count(entry) === 2, `${entry} should appear twice (engine + call site), found ${count(entry)}`);
    }
    for (const key of ["_smartAim", "_targetLock", "_targetLockRange", "_smartBreakAngle"]) {
      assert(count(key) >= 3, `${key} should reach the settings, the engine and the menu`);
    }
    assert(count("Where the client says you are pointing") === 1, "the Aim menu section should be present once");
  });
}

/* ---------------------------------------------------------------- */

if (failures.length) {
  console.error(`\n${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error("  x " + failure);
  process.exit(1);
}
console.log(`\n${passed} tests passed - engine and both v5 builds\n`);
