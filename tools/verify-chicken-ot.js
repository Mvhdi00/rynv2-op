#!/usr/bin/env node
/*
 * verify-chicken-ot.js
 *
 * Pulls `novaOneTick` out of the built script and runs it against stub
 * globals, so the transplant is checked as behaviour and not just as syntax.
 *
 * What it asserts:
 *   - gotoGoal stages the hat/accessory pair Nova stages, in every band, on
 *     both sides of the goal, and in the river,
 *   - the goal is 238, or 372 with a ranged secondary,
 *   - boostTickType is the four tick combo, with the booster/trap drop and
 *     the musket's reverse aim,
 *   - oneTick is the great hammer -> polearm + bull helmet combo,
 *   - the auto trigger fires on Nova's window and every gate blocks it,
 *   - Nova's macro gates decide when hold mode may run at all.
 *
 *   node tools/verify-chicken-ot.js [file]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const FILE = path.resolve(ROOT, process.argv[2] || "chicken_v4.6.2.user.js");

const source = fs.readFileSync(FILE, "utf8");

/* ---------------------------------------------------------------- *
 * Lift the module out of the built script
 * ---------------------------------------------------------------- */

const start = source.indexOf("    var novaOneTick = new (class {");
if (start === -1) throw new Error("novaOneTick not found in " + path.relative(ROOT, FILE));
const end = source.indexOf("\n    })();\n", start);
if (end === -1) throw new Error("could not find the end of novaOneTick");
const moduleSource = source.slice(start, end + "\n    })();\n".length);

/* ---------------------------------------------------------------- *
 * Stub world
 * ---------------------------------------------------------------- */

const RIVER_Y = 7200; // config.mapScale / 2

function world(opts = {}) {
  const log = [];
  const dist = opts.dist === undefined ? 238 : opts.dist;
  const schedule = new Map();

  const player = {
    alive: true,
    sid: 1,
    weapons: opts.weapons || [5, 3],
    weaponIndex: opts.weaponIndex === undefined ? 5 : opts.weaponIndex,
    buildIndex: -1,
    tailIndex: 0,
    items: [0, 3, 6, 10, 15, 16],
    itemCounts: {},
    skins: { 6: 1, 7: 1, 12: 1, 22: 1, 31: 1, 40: 1, 53: 1 },
    tails: { 10: 1, 18: 1 },
    reloads: Object.assign({ 3: 0, 4: 0, 5: 0, 9: 0, 10: 0, 15: 0, 53: 0 }, opts.reloads),
    trapData: opts.trapData || null,
    x: 0, y: 0,
    x2: 0, y2: opts.y2 === undefined ? 1000 : opts.y2,
    lastX: 0, lastY: opts.y2 === undefined ? 1000 : opts.y2,
  };
  player.vel = { x: player.x2 * 2 - player.lastX, y: player.y2 * 2 - player.lastY };

  const target = {
    sid: 2,
    skinIndex: opts.targetSkin === undefined ? 0 : opts.targetSkin,
    x: dist, y: player.y2,
    x2: dist, y2: player.y2,
    lastX: dist + (opts.targetStep || 0), lastY: player.y2,
  };
  target.vel = { x: target.x2 * 2 - target.lastX, y: target.y2 * 2 - target.lastY };

  const context = {
    console,
    Math,
    player,
    config: {
      mapScale: 14400,
      riverWidth: 724,
      playerScale: 35,
      serverUpdateSpeed: 1000 / 9,
    },
    game: {
      tick: 0,
      perfectOTDistance: 238,
      boostOTDistance: 372,
      otWindow: 3,
      enemies: {
        nearest: opts.noEnemy ? null : target,
        angle: 0, // target sits due east of the player
      },
      tickOut(fn, t) {
        const at = this.tick + t;
        if (!schedule.has(at)) schedule.set(at, []);
        schedule.get(at).push(fn);
      },
    },
    UTILS: {
      getDistance(a, b) {
        const ax = a.x2 === undefined ? a.x : a.x2;
        const ay = a.y2 === undefined ? a.y : a.y2;
        const bx = b.x2 === undefined ? b.x : b.x2;
        const by = b.y2 === undefined ? b.y : b.y2;
        return Math.hypot(ax - bx, ay - by);
      },
      getDirection(a, b) {
        const ax = a.x2 || a.x;
        const ay = a.y2 || a.y;
        const bx = b.x2 || b.x;
        const by = b.y2 || b.y;
        return Math.atan2(ay - by, ax - bx);
      },
    },
    hatSystem: {
      storeEquip(id, index, basic) {
        log.push({ op: "equip", id, index: index || 0, basic: !!basic });
      },
    },
    healer: {
      reloadPercent(who, id) {
        if (!who.reloads[id]) return 1;
        return 0;
      },
    },
    placer: {
      place(id, angle) {
        log.push({ op: "place", id, angle });
      },
    },
    chicken: {
      autoaim: false,
      movementDirection: "unset",
      preferedWeaponIndex: player.weapons[0],
      checkHave(id, tail) {
        if (!id) return 0;
        return (tail ? player.tails[id] : player.skins[id]) ? id : 0;
      },
      selectToBuild(index, isWeapon) {
        log.push({ op: isWeapon ? "weapon" : "build", index });
        if (isWeapon) player.weaponIndex = index;
      },
      sendAutoGather() {
        log.push({ op: "hit" });
      },
      sendAim(angle) {
        log.push({ op: "aim", angle });
      },
    },
    io: {
      send(type, ...args) {
        log.push({ op: "send", type, args });
      },
    },
    scriptMenu: {
      toggles: {
        autoOneTick: !!opts.autoOneTick,
        oneTickIgnoreSoldier: !!opts.ignoreSoldier,
      },
    },
    sendChat(text) {
      log.push({ op: "chat", text });
    },
  };

  const novaOneTick = vm.runInNewContext(moduleSource + "\nnovaOneTick;", context, {
    filename: "novaOneTick",
  });

  function advance() {
    context.game.tick++;
    const due = schedule.get(context.game.tick) || [];
    schedule.delete(context.game.tick);
    for (const fn of due) fn();
  }

  return { novaOneTick, context, log, advance, player, target };
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
  return { hat: hat.length ? hat[hat.length - 1] : null, acc: acc.length ? acc[acc.length - 1] : null };
}

function steps(log) {
  return log.map((l) => {
    if (l.op === "equip") return `equip${l.id}:${l.index}`;
    if (l.op === "weapon") return `weapon${l.index}`;
    if (l.op === "build") return `build${l.index}`;
    if (l.op === "send") return `send${l.type}:${l.args[0] === undefined ? "stop" : Math.round(l.args[0] * 100) / 100}`;
    if (l.op === "place") return `place${l.id}`;
    return l.op;
  });
}

/* ---------------------------------------------------------------- *
 * 1. gotoGoal, Nova's eight bands
 *
 * Nova, instaC.gotoGoal(goto, OT), bands measured in player scales (35):
 *   in window      emp helmet (22) + stone cape (10), action 1
 *   too close  <35 tank gear (40)   + stone cape (10)
 *              <70 booster hat (12) + no accessory
 *             <140 no accessory, hat untouched
 *             else biome gear (6)   + stone cape (10)
 *   too far    <35 tank gear (40)   + no accessory   <- not the cape
 *              <70 booster hat (12) + no accessory
 *             <140 no accessory, hat untouched
 *             else biome gear (6)   + stone cape (10)
 * ---------------------------------------------------------------- */

console.log("gotoGoal bands");

const bands = [
  ["in window", 238, { hat: 22, acc: 10 }, 1, undefined],
  ["in window, low edge", 235, { hat: 22, acc: 10 }, 1, undefined],
  ["in window, high edge", 241, { hat: 22, acc: 10 }, 1, undefined],
  ["too close by 20", 218, { hat: 40, acc: 10 }, 0, Math.PI],
  ["too close by 50", 188, { hat: 12, acc: 0 }, 0, Math.PI],
  ["too close by 100", 138, { hat: null, acc: 0 }, 0, Math.PI],
  ["too close by 200", 38, { hat: 6, acc: 10 }, 0, Math.PI],
  ["too far by 20", 258, { hat: 40, acc: 0 }, 0, 0],
  ["too far by 50", 288, { hat: 12, acc: 0 }, 0, 0],
  ["too far by 100", 338, { hat: null, acc: 0 }, 0, 0],
  ["too far by 200", 438, { hat: 6, acc: 10 }, 0, 0],
];

for (const [name, dist, expected, action, dir] of bands) {
  check(`${name} (dist ${dist})`, () => {
    const { novaOneTick, log } = world({ dist });
    const move = novaOneTick.gotoGoal(238, 3);
    equal(gear(log), expected, "staged gear");
    equal(move.action, action, "action");
    equal(move.dir, dir, "direction");
  });
}

check("in the river every hat slot is the flipper", () => {
  const { novaOneTick, log } = world({ dist: 218, y2: RIVER_Y });
  novaOneTick.gotoGoal(238, 3);
  equal(gear(log), { hat: 31, acc: 10 }, "flipper instead of tank gear");
});

check("no enemy is no movement and no action", () => {
  const { novaOneTick, log } = world({ noEnemy: true });
  equal(novaOneTick.gotoGoal(238, 3), { dir: undefined, action: 0 }, "gotoGoal with nothing to walk to");
  equal(log, [], "and no gear staged");
});

check("the walking weapon is the secondary only for hammer and grabby", () => {
  for (const [secondary, expected] of [[10, 10], [14, 14], [3, 5], [15, 5]]) {
    const { novaOneTick, log } = world({ dist: 218, weapons: [5, secondary], weaponIndex: 0 });
    novaOneTick.gotoGoal(238, 3);
    const weapon = log.filter((l) => l.op === "weapon").map((l) => l.index);
    equal(weapon, [expected], `secondary ${secondary}`);
  }
});

/* ---------------------------------------------------------------- *
 * 2. Which goal
 * ---------------------------------------------------------------- */

console.log("goal selection");

check("melee secondary walks to 238", () => {
  const { novaOneTick, context } = world({ dist: 238, weapons: [5, 3], reloads: { 53: 1 } });
  equal(novaOneTick.tickMovement(), "stop movement", "in window at 238");
  assert(!context.chicken.autoaim, "turret not ready, so no shot");
});

check("ranged secondary walks to 372", () => {
  const near = world({ dist: 238, weapons: [4, 9], reloads: { 53: 1 } });
  assert(typeof near.novaOneTick.tickMovement() === "number", "238 is not the goal with a bow");
  const far = world({ dist: 372, weapons: [4, 9], reloads: { 53: 1 } });
  equal(far.novaOneTick.tickMovement(), "stop movement", "372 is");
});

/* ---------------------------------------------------------------- *
 * 3. boostTickType, Nova's four tick combo
 * ---------------------------------------------------------------- */

console.log("the shot");

check("hold mode fires it inside the window", () => {
  const { novaOneTick, context } = world({ dist: 238 });
  equal(novaOneTick.tickMovement(), undefined, "no movement returned while firing");
  equal(context.chicken.autoaim, "ot", "autoaim marks the tick as ours");
});

check("melee primary: biome -> turret gear + drop -> bull helmet + hit -> release", () => {
  const w = world({ dist: 238, weapons: [5, 3], weaponIndex: 0 });
  w.novaOneTick.boostTickType();
  equal(steps(w.log), ["equip6:0", "equip18:1", "send9:0"], "tick 0");

  w.log.length = 0;
  w.advance();
  // The move packet repeats tick 0's direction, and both chicken's
  // movementDirection cache and Nova's own send hook drop a repeat.
  // items[4] is the trap slot -- a booster once swapped for a boost tick.
  equal(steps(w.log), ["weapon5", "equip53:0", "equip18:1", "place15"], "tick 1: turret gear, the drop");

  w.log.length = 0;
  w.advance();
  // Primary is already out from tick 1 and the direction has not changed,
  // so the weapon select and the move packet both dedupe away.
  equal(steps(w.log), ["equip7:0", "equip18:1", "hit"], "tick 2: bull helmet, the hit");
  assert(w.context.chicken.autoaim === "ot", "still ours");

  w.log.length = 0;
  w.advance();
  equal(steps(w.log), ["hit", "send9:stop"], "tick 3: release");
  assert(!w.context.chicken.autoaim, "autoaim handed back");
});

check("ranged secondary hits on the turret gear tick instead", () => {
  const w = world({ dist: 372, weapons: [4, 9], weaponIndex: 0 });
  w.novaOneTick.boostTickType();
  w.log.length = 0;
  w.advance();
  equal(steps(w.log), ["weapon9", "equip53:0", "equip18:1", "hit", "place15"], "tick 1 hits with the bow");
  w.log.length = 0;
  w.advance();
  equal(steps(w.log).includes("hit"), false, "tick 2 does not hit again");
});

check("a musket flips the aim for its tick and back after", () => {
  const w = world({ dist: 372, weapons: [4, 15], weaponIndex: 0 });
  w.novaOneTick.boostTickType();
  equal(w.context.chicken.autoaim, "ot", "tick 0");
  w.advance();
  equal(w.context.chicken.autoaim, "otrev", "tick 1 aims behind the target");
  w.advance();
  equal(w.context.chicken.autoaim, "ot", "tick 2 aims at it again");
});

check("moveDuringCombo false restores Nova's shipped (dead opcode) combo", () => {
  const w = world({ dist: 238 });
  w.novaOneTick.moveDuringCombo = false;
  w.novaOneTick.boostTickType();
  w.advance();
  w.advance();
  w.advance();
  equal(w.log.filter((l) => l.op === "send"), [], "no move packets at all");
});

/* ---------------------------------------------------------------- *
 * 4. Nova's macro gates
 * ---------------------------------------------------------------- */

console.log("hold mode gates");

const gates = [
  ["polearm out", { weapons: [5, 3] }, true],
  ["katana with a musket", { weapons: [4, 15] }, true],
  ["katana with a hammer", { weapons: [4, 10] }, false],
  ["primary reloading", { weapons: [5, 3], reloads: { 5: 300 } }, false],
  ["ranged secondary reloaded", { weapons: [4, 9] }, true],
  ["ranged secondary reloading", { weapons: [4, 9], reloads: { 9: 300 } }, false],
  ["in a trap", { weapons: [5, 3], trapData: { sid: 9 } }, false],
  ["no enemy", { weapons: [5, 3], noEnemy: true }, false],
];

for (const [name, opts, expected] of gates) {
  check(`${name} -> ${expected ? "runs" : "stands down"}`, () => {
    const { novaOneTick } = world(Object.assign({ dist: 238 }, opts));
    equal(novaOneTick.canRun(), expected, "canRun");
  });
}

/* ---------------------------------------------------------------- *
 * 5. oneTick, Nova's auto combo
 * ---------------------------------------------------------------- */

console.log("the auto combo");

check("great hammer + turret gear -> polearm + bull helmet + hit -> release", () => {
  const w = world({ dist: 240, weapons: [5, 10], weaponIndex: 0 });
  assert(w.novaOneTick.oneTick() === true, "started");
  equal(steps(w.log), ["chat", "weapon10", "send9:0", "equip53:0"], "tick 0");
  equal(w.context.chicken.autoaim, "ot", "autoaim");

  w.log.length = 0;
  w.advance();
  equal(steps(w.log), ["weapon5", "equip7:0", "hit"], "tick 1: polearm, bull helmet, hit");

  w.log.length = 0;
  w.advance();
  equal(steps(w.log), ["hit"], "tick 2: release the hit");
  assert(!w.context.chicken.autoaim, "autoaim handed back");

  w.log.length = 0;
  w.advance();
  equal(steps(w.log), ["send9:stop"], "tick 3: stop moving");
});

check("not while trapped", () => {
  const w = world({ dist: 240, trapData: { sid: 9 } });
  equal(w.novaOneTick.oneTick(), false, "refused");
  equal(w.log, [], "nothing sent");
});

/* ---------------------------------------------------------------- *
 * 6. The auto trigger
 *
 * Nova: turret ready, primary within a tick of ready, past 223, and a tick of
 * acceleration into the target lands inside 205.
 * ---------------------------------------------------------------- */

console.log("the auto trigger");

check("fires in Nova's window", () => {
  const w = world({ dist: 240, weapons: [5, 10], autoOneTick: true });
  assert(w.novaOneTick.autoOneTick() === true, "fired");
  equal(w.context.chicken.autoaim, "ot", "combo running");
});

const triggerGates = [
  ["the menu toggle is off", { autoOneTick: false }],
  ["no polearm", { autoOneTick: true, weapons: [4, 10] }],
  ["turret gear reloading", { autoOneTick: true, reloads: { 53: 900 } }],
  ["primary more than a tick out", { autoOneTick: true, reloads: { 5: 300 } }],
  ["closer than 223", { autoOneTick: true, dist: 210 }],
  ["further than the prediction reaches", { autoOneTick: true, dist: 300 }],
  ["already busy with a combo", { autoOneTick: true, busy: true }],
  ["soldier helmet on the target", { autoOneTick: true, targetSkin: 6 }],
  ["emp helmet on the target", { autoOneTick: true, targetSkin: 22 }],
  ["in a trap", { autoOneTick: true, trapData: { sid: 9 } }],
];

for (const [name, opts] of triggerGates) {
  check(`${name} -> holds`, () => {
    const w = world(Object.assign({ dist: 240, weapons: [5, 10] }, opts));
    if (opts.busy) w.context.chicken.autoaim = "ot";
    equal(w.novaOneTick.autoOneTick(), false, "held");
  });
}

check("Ignore Soldier lets it through anyway", () => {
  for (const skin of [6, 22]) {
    const w = world({ dist: 240, weapons: [5, 10], autoOneTick: true, ignoreSoldier: true, targetSkin: skin });
    assert(w.novaOneTick.autoOneTick() === true, `fires against skin ${skin}`);
  }
});

check("the window is Nova's: fires from 223 to about 248", () => {
  const fired = [];
  for (let dist = 200; dist <= 300; dist++) {
    const w = world({ dist, weapons: [5, 10], autoOneTick: true });
    if (w.novaOneTick.autoOneTick()) fired.push(dist);
  }
  assert(fired.length, "something fires");
  equal(fired[0], 223, "lower edge is Nova's floor");
  assert(fired[fired.length - 1] >= 243 && fired[fired.length - 1] <= 252, `upper edge ${fired[fired.length - 1]} is where a tick of acceleration reaches`);
  equal(fired.length, fired[fired.length - 1] - fired[0] + 1, "and it is one continuous window");
});

check("calcOTVel predicts a tick of acceleration into the target", () => {
  const w = world({ dist: 400 });
  const pred = w.novaOneTick.calcOTVel();
  const moved = pred.x - w.player.x2;
  assert(moved > 35 && moved < 50, `moved ${Math.round(moved)}px toward the target`);
  assert(Math.abs(pred.y - w.player.y2) < 0.001, "straight at it");
});

console.log(`\n${checks - failures}/${checks} checks passed on ${path.relative(ROOT, FILE)}`);
process.exit(failures ? 1 : 0);
