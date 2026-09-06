#!/usr/bin/env node
/*
 * verify-nova-ot.js
 *
 * Pulls `instaManager` out of the built script and runs it against stub
 * globals, so the transplant is checked as behaviour and not just as syntax.
 *
 * What it asserts:
 *   - the approach bands pick the hat/accessory pairs from chicken's table,
 *   - the shot is the 3 tick combo: turret gear -> bull helmet + hit -> release,
 *   - the queue moves exactly one step per server tick,
 *   - every gate in chicken's fire condition still blocks the shot,
 *   - hold mode hands movement back to the keys when the key is let go.
 *
 *   node tools/verify-nova-ot.js [file]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const FILE = path.resolve(ROOT, process.argv[2] || "Nova_ChickenTick.user.js");

const source = fs.readFileSync(FILE, "utf8");

/* ---------------------------------------------------------------- *
 * Lift the module out of the built script
 * ---------------------------------------------------------------- */

const start = source.indexOf("    const oneTickKeys = ");
if (start === -1) throw new Error("instaManager not found in " + path.relative(ROOT, FILE));
const end = source.indexOf("\n    };\n", start);
if (end === -1) throw new Error("could not find the end of instaManager");
const moduleSource = source.slice(start, end + "\n    };\n".length);

/* ---------------------------------------------------------------- *
 * Stub world
 * ---------------------------------------------------------------- */

/* Nova's UTILS.getDist, same shape: type 0/1/2/3 picks x, x1, x2, x3. */
function pick(tmp, type) {
  return {
    x: type == 0 ? tmp.x : type == 1 ? tmp.x1 : type == 2 ? tmp.x2 : tmp.x3,
    y: type == 0 ? tmp.y : type == 1 ? tmp.y1 : type == 2 ? tmp.y2 : tmp.y3,
  };
}

function world(opts = {}) {
  const log = [];
  const dist = opts.dist === undefined ? 225 : opts.dist;
  const step = opts.step === undefined ? 0 : opts.step; // px the player covers next tick

  const player = {
    alive: true,
    sid: 1,
    weapons: opts.weapons || [5, 10],
    weaponIndex: opts.weaponIndex === undefined ? 5 : opts.weaponIndex,
    buildIndex: -1,
    tailIndex: opts.tailIndex || 0,
    skinIndex: 6,
    skins: Object.assign({ 6: 1, 7: 1, 40: 1, 53: 1 }, opts.skins),
    tails: { 11: 1, 19: 1 },
    reloads: Object.assign({ 4: 0, 5: 0, 10: 0, 53: 0 }, opts.reloads),
    x: 0, y: 0, x1: 0, y1: 0, x2: 0, y2: 0, x3: step, y3: 0,
  };
  const near = {
    sid: 2,
    skinIndex: opts.targetSkin === undefined ? 0 : opts.targetSkin,
    x: dist, y: 0, x1: dist, y1: 0, x2: dist, y2: 0, x3: dist, y3: 0,
    dist2: dist,
    aim2: 0,
  };

  const context = {
    console,
    inGame: opts.inGame === undefined ? true : opts.inGame,
    player,
    near,
    enemy: opts.noEnemy ? [] : [near],
    macro: {},
    my: { autoAim: false, anti0Tick: opts.anti0Tick || 0 },
    instaC: { isTrue: false, ticking: false },
    traps: { inTrap: !!opts.inTrap, breakshit: !!opts.breakshit },
    game: { perfectOTDistance: 225 },
    configs: {
      autoOneFrame: opts.autoOneFrame === undefined ? true : opts.autoOneFrame,
      safeTick: opts.safeTick === undefined ? true : opts.safeTick,
    },
    UTILS: {
      getDist(a, b, t1, t2) {
        const p1 = pick(a, t1);
        const p2 = pick(b, t2);
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
      },
    },
    packet(type, ...args) {
      log.push({ op: "packet", type, args });
    },
    buyEquip(id, index) {
      log.push({ op: "equip", id, index });
    },
    selectWeapon(index) {
      log.push({ op: "weapon", index });
      player.weaponIndex = index;
    },
    sendAutoGather() {
      log.push({ op: "hit" });
    },
    getMoveDir: () => opts.moveDir,
    getAttackDir: () => 0,
  };

  const instaManager = vm.runInNewContext(moduleSource + "\ninstaManager;", context, {
    filename: "instaManager",
  });
  return { instaManager, context, log };
}

/* ---------------------------------------------------------------- *
 * Assertions
 * ---------------------------------------------------------------- */

let failures = 0;
let checks = 0;

function check(name, fn) {
  checks++;
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${name}\n         ${err.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}\n         expected ${e}\n         got      ${a}`);
}

function gear(log) {
  const hat = log.filter((l) => l.op === "equip" && l.index === 0).map((l) => l.id);
  const acc = log.filter((l) => l.op === "equip" && l.index === 1).map((l) => l.id);
  return { hat: hat[hat.length - 1], acc: acc[acc.length - 1] };
}

/* ---------------------------------------------------------------- *
 * 1. The approach bands
 *
 * chicken v4.6.2, instaManager.oneTickMovement():
 *   |error| > 35     soldier(6)   + monkey tail(11)
 *   |error| 20..35   soldier(6)   + shadow wings(19)
 *   |error| 10..20   tank gear(40) + none(0)
 *   |error| <= 10    tank gear(40) + shadow wings(19)
 * ---------------------------------------------------------------- */

console.log("approach bands");

const bands = [
  { dist: 400, error: 175, hat: 6, acc: 11, toward: true },
  { dist: 100, error: 125, hat: 6, acc: 11, toward: false },
  { dist: 255, error: 30, hat: 6, acc: 19, toward: true },
  { dist: 195, error: 30, hat: 6, acc: 19, toward: false },
  { dist: 240, error: 15, hat: 40, acc: 0, toward: true },
  { dist: 210, error: 15, hat: 40, acc: 0, toward: false },
  { dist: 233, error: 8, hat: 40, acc: 19, toward: true },
  { dist: 217, error: 8, hat: 40, acc: 19, toward: false },
];

for (const band of bands) {
  check(`|error| ${band.error} -> hat ${band.hat}, acc ${band.acc}`, () => {
    const { instaManager, log } = world({ dist: band.dist });
    const dir = instaManager.oneTickMovement();
    equal(gear(log), { hat: band.hat, acc: band.acc }, "gear for this band");
    // aim2 is 0, so "walk in" is 0 and "back off" is PI
    equal(dir, band.toward ? 0 : Math.PI, "movement direction");
  });
}

check("too far in the soldier band still walks in, not away", () => {
  const { instaManager } = world({ dist: 1200 });
  equal(instaManager.oneTickMovement(), 0, "direction at long range");
});

/* ---------------------------------------------------------------- *
 * 2. The shot
 * ---------------------------------------------------------------- */

console.log("the shot");

check("inside the window fires and returns the enemy angle", () => {
  const { instaManager, context, log } = world({ dist: 227, weapons: [5, 15] });
  const dir = instaManager.oneTickMovement();
  equal(dir, 0, "movement direction while firing");
  assert(context.instaC.isTrue, "instaC.isTrue is set so the rest of the client stands off");
  assert(context.my.autoAim, "my.autoAim is set so getAttackDir aims at near");
  equal(instaManager.autoaim, "ot", "insta type");
  equal(
    log.map((l) => (l.op === "equip" ? `equip${l.id}:${l.index}` : l.op === "weapon" ? `weapon${l.index}` : l.op)),
    ["equip53:0"],
    "tick 0 is turret gear only (primary already held)"
  );
  equal(instaManager.onQueue.length, 2, "two steps queued");
});

check("the combo is turret gear -> bull helmet + hit -> release", () => {
  // Secondary is the great hammer here, so chicken's "hold the hammer while
  // walking in" line fires first and the primary comes back out for the shot.
  const { instaManager, context, log } = world({ dist: 227, weapons: [5, 10], weaponIndex: 3 });
  instaManager.oneTickMovement();

  equal(
    log.map((l) => (l.op === "equip" ? `equip${l.id}:${l.index}` : l.op === "weapon" ? `weapon${l.index}` : l.op)),
    ["weapon10", "equip53:0", "weapon5"],
    "tick 0: hammer, turret gear, primary out"
  );

  log.length = 0;
  instaManager.tickBase();
  equal(
    log.map((l) => (l.op === "equip" ? `equip${l.id}:${l.index}` : l.op === "packet" ? `packet${l.type}` : l.op)),
    ["equip7:0", "packetD", "hit", "packet9"],
    "tick 1: bull helmet, aim, hit, keep walking in"
  );
  assert(context.instaC.isTrue, "still busy after tick 1");

  log.length = 0;
  instaManager.tickBase();
  equal(log.map((l) => l.op), ["hit"], "tick 2: release the hit");
  assert(!context.instaC.isTrue, "instaC.isTrue cleared");
  assert(!context.my.autoAim, "my.autoAim cleared");
  equal(instaManager.autoaim, false, "insta type cleared");
  equal(instaManager.onQueue.length, 0, "queue drained");
});

check("the queue moves one step per tick, not two", () => {
  const { instaManager } = world({ dist: 227 });
  instaManager.oneTickMovement();
  equal(instaManager.onQueue.length, 2, "queued");
  instaManager.tickBase();
  equal(instaManager.onQueue.length, 1, "after one tick");
});

check("reverse insta leads with the secondary", () => {
  const { instaManager, log } = world({ dist: 100, weaponIndex: 5 });
  instaManager.startInsta("reverse");
  equal(
    log.map((l) => (l.op === "equip" ? `equip${l.id}:${l.index}` : l.op === "weapon" ? `weapon${l.index}` : l.op === "packet" ? `packet${l.type}` : l.op)),
    ["equip53:0", "weapon10", "packetD", "hit"],
    "tick 0 of the reverse combo"
  );
});

check("a second start while one is running is refused", () => {
  const { instaManager } = world({ dist: 227 });
  assert(instaManager.startInsta("ot") === true, "first start");
  assert(instaManager.startInsta("ot") === false, "second start refused");
  equal(instaManager.onQueue.length, 2, "queue not doubled");
});

/* ---------------------------------------------------------------- *
 * 3. The gates
 * ---------------------------------------------------------------- */

console.log("fire gates");

const gates = [
  ["soldier helmet on the target", { dist: 227, targetSkin: 6 }],
  ["emp helmet on the target", { dist: 227, targetSkin: 22 }],
  ["monkey tail still on", { dist: 227, tailIndex: 11 }],
  ["turret gear not reloaded", { dist: 227, reloads: { 53: 400 } }],
  ["primary not reloaded", { dist: 227, reloads: { 5: 200 } }],
  ["turret gear not owned", { dist: 227, skins: { 53: 0 } }],
  ["bull helmet not owned", { dist: 227, skins: { 7: 0 } }],
];

for (const [name, opts] of gates) {
  check(`${name} -> hold position instead of firing`, () => {
    const { instaManager, context, log } = world(opts);
    const dir = instaManager.oneTickMovement();
    assert(!context.instaC.isTrue, "no insta started");
    equal(instaManager.onQueue.length, 0, "nothing queued");
    equal(dir, "stop movement", "holds position");
    equal(gear(log), { hat: 6, acc: 19 }, "soldier + shadow wings while holding");
  });
}

check("a threat that forced soldier keeps soldier through the approach", () => {
  const { instaManager, log } = world({ dist: 400, anti0Tick: 2 });
  instaManager.oneTickMovement();
  equal(gear(log).hat, 6, "hat forced to soldier");
});

check("no enemy drops hold mode", () => {
  const { instaManager } = world({ noEnemy: true });
  instaManager.holdModeOT = true;
  equal(instaManager.oneTickMovement(), undefined, "no direction");
  equal(instaManager.holdModeOT, false, "hold mode dropped");
});

/* ---------------------------------------------------------------- *
 * 4. Hold mode
 * ---------------------------------------------------------------- */

console.log("hold mode");

check("steering marks instaC.ticking so the hat changer stays off it", () => {
  const { instaManager, context } = world({ dist: 400 });
  instaManager.holdModeOT = true;
  instaManager.drive();
  assert(context.instaC.ticking, "instaC.ticking set");
  assert(instaManager.steering, "steering");
});

check("letting go hands movement back to the keys", () => {
  const { instaManager, log } = world({ dist: 400, moveDir: 1.5 });
  instaManager.holdModeOT = true;
  instaManager.drive();
  log.length = 0;

  instaManager.holdModeOT = false;
  instaManager.drive();
  equal(
    log.filter((l) => l.op === "packet").map((l) => [l.type, l.args[0]]),
    [["9", 1.5]],
    "one move packet with the key direction"
  );
  assert(!instaManager.steering, "no longer steering");

  log.length = 0;
  instaManager.drive();
  equal(log, [], "and nothing after that");
});

check("drive stays out of the way while the combo runs", () => {
  const { instaManager, log } = world({ dist: 227 });
  instaManager.holdModeOT = true;
  instaManager.drive();
  assert(instaManager.autoaim === "ot", "combo started");
  log.length = 0;
  instaManager.holdModeOT = true;
  instaManager.drive();
  equal(log, [], "drive did nothing during the combo");
});

check("in a trap, hold mode neither steers nor fires", () => {
  const { instaManager, context, log } = world({ dist: 227, inTrap: true });
  instaManager.holdModeOT = true;
  instaManager.drive();
  equal(log, [], "no packets");
  assert(!context.instaC.isTrue, "no insta");
});

check("dying mid combo clears the queue and the flags", () => {
  const { instaManager, context } = world({ dist: 227 });
  instaManager.oneTickMovement();
  context.player.alive = false;
  instaManager.tickBase();
  equal(instaManager.onQueue.length, 0, "queue cleared");
  assert(!context.instaC.isTrue, "instaC.isTrue cleared");
  equal(instaManager.autoaim, false, "insta type cleared");
});

/* ---------------------------------------------------------------- *
 * 5. Auto one tick (Nova's P toggle, chicken's window)
 * ---------------------------------------------------------------- */

console.log("auto one tick");

check("fires inside the window with a katana", () => {
  const { instaManager, context } = world({ dist: 227 });
  assert(instaManager.autoOneTick() === true, "fired");
  assert(context.instaC.isTrue, "insta running");
});

check("does not fire outside the window", () => {
  const { instaManager } = world({ dist: 260 });
  assert(instaManager.autoOneTick() === false, "held");
});

check("does not steer or restage gear", () => {
  const { instaManager, log } = world({ dist: 260 });
  instaManager.autoOneTick();
  equal(log, [], "no packets at all");
});

check("off when configs.autoOneFrame is off", () => {
  const { instaManager } = world({ dist: 227, autoOneFrame: false });
  assert(instaManager.autoOneTick() === false, "held");
});

check("safeTick keeps it off soldier and emp", () => {
  for (const skin of [6, 22]) {
    const { instaManager } = world({ dist: 227, targetSkin: skin });
    assert(instaManager.autoOneTick() === false, `held against skin ${skin}`);
  }
});

check("only with a katana or polearm out", () => {
  const { instaManager } = world({ dist: 227, weapons: [3, 10], weaponIndex: 3, reloads: { 3: 0 } });
  assert(instaManager.autoOneTick() === false, "held with a short sword");
  const pole = world({ dist: 227, weapons: [4, 10], weaponIndex: 4 });
  assert(pole.instaManager.autoOneTick() === true, "fires with a polearm");
});

/* ---------------------------------------------------------------- *
 * 6. chicken's `n <= 25 && s < 0` shortcut
 *
 * Ported verbatim. `closing` is the predicted distance minus the current
 * error, and a tick of movement is ~40px, so it never goes negative -- the
 * band table is what actually decides. Pinned here so that stays visible.
 * ---------------------------------------------------------------- */

console.log("the unreachable shortcut");

check("no realistic approach speed reaches it", () => {
  for (let dist = 226; dist <= 600; dist += 1) {
    for (const step of [0, 10, 20, 30, 40, 60]) {
      const { instaManager, context } = world({ dist, step });
      const diff = dist - 225;
      if (Math.abs(diff) > 25) continue;
      instaManager.oneTickMovement();
      const fired = context.instaC.isTrue;
      const inWindow = Math.abs(diff) <= 5;
      assert(fired === inWindow, `dist ${dist} step ${step}: fired ${fired}, window ${inWindow}`);
    }
  }
});

console.log(`\n${checks - failures}/${checks} checks passed on ${path.relative(ROOT, FILE)}`);
process.exit(failures ? 1 : 0);
