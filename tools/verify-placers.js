#!/usr/bin/env node
/*
 * verify-placers.js
 *
 * The two placer lanes added to YoRHa System — NOVASTORM's preplacer grading
 * and blisma mod v5's preplacer/replacer — live deep inside a 27k-line
 * userscript that cannot be loaded outside a browser with a live game socket.
 *
 * This lifts the real function bodies out of the script by name, drops them
 * into a stub world with a recording addPredictObject, and asserts what each
 * one actually does. Nothing here re-implements the logic; every function
 * under test is the exact source text from the client.
 *
 *   node tools/verify-placers.js [path/to/YoRHa_System.user.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "YoRHa_System.user.js");

const src = fs.readFileSync(CLIENT_PATH, "utf8");

// ---------------------------------------------------------------------------
// Lift a `function NAME(...) { ... }` out of the script by balancing braces.
// ---------------------------------------------------------------------------
// Lift an `X.Y = function (...) { ... }` assignment the same way, so a rule the
// client centralised (config.buildLimit) is tested as written rather than as a
// hand-copy that can drift from it.
function liftAssign(lhs, rebindTo) {
  const start = src.indexOf(`${lhs} = function`);
  if (start === -1) throw new Error(`${lhs} not found in client`);

  let i = src.indexOf("{", start);
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const text = src.slice(start, i + 1);
        if (!rebindTo) return text;
        // Swap the whole owner prefix, not just its head: module.exports.foo
        // has to become config.foo, never config.exports.foo.
        const prop = lhs.slice(lhs.lastIndexOf(".") + 1);
        return rebindTo + "." + prop + text.slice(lhs.length);
      }
    }
  }
  throw new Error(`unbalanced braces lifting ${lhs}`);
}

function lift(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found in client`);

  let i = src.indexOf("{", start);
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces lifting ${name}`);
}

// ---------------------------------------------------------------------------
// The stub world. Only what the lifted functions actually touch.
// ---------------------------------------------------------------------------
const mathPI = Math.PI;

const UTILS = {
  getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  getDirection: (x1, y1, x2, y2) => Math.atan2(y1 - y2, x1 - x2),
  getAngleDist: (a, b) => {
    const p = Math.abs(b - a) % (mathPI * 2);
    return p > mathPI ? mathPI * 2 - p : p;
  },
  toRad: (d) => (d * mathPI) / 180,
  // Axis-aligned box vs segment. Enough for the LOS/knock tests below.
  lineInRect: (rx1, ry1, rx2, ry2, x1, y1, x2, y2) => {
    const steps = 64;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      if (px >= rx1 && px <= rx2 && py >= ry1 && py <= ry2) return true;
    }
    return false;
  },
};

// Weapon table: 5 = a primary, 10 = the great hammer.
const items = {
  weapons: {
    0: { dmg: 25, range: 65, speed: 300 },
    5: { dmg: 30, range: 65, speed: 300 },
    8: { dmg: 40, range: 110, speed: 400 },
    10: { dmg: 30, sDmg: 7.5, range: 110, speed: 700 },
  },
  list: {
    // spike (2) and trap (15)
    6: { scale: 35, placeOffset: 0, dmg: 20, group: { id: 2, limit: 15 } },
    15: { scale: 32, placeOffset: -5, group: { id: 4, limit: 6 } },
  },
};

const config = {
  weaponVariants: [{ val: 1 }, { val: 1.1 }, { val: 1.18 }, { val: 1.18 }],
  inSandbox: false,
  isSandbox: false,
  onSandboxHost: false,
};

// The client's own build-cap rule, lifted rather than restated. isItemLimit
// reads it, and every placer asks isItemLimit before spending a slot.
eval(liftAssign("module.exports.buildLimit", "config") + ";");

let ctx;      // the vm sandbox, rebuilt per scenario
let placed;   // everything addPredictObject accepted

function world(over = {}) {
  placed = [];

  const myPlayer = over.myPlayer || {
    sid: 1, x2: 1000, y2: 1000, scale: 35, dir: 0,
    items: [0, 3, 6, 10, 15, 53], itemCounts: {}, weapons: [5, 10],
    weaponVariants: [0, 0], skinIndex: 0, xVel: 1000, yVel: 1000,
  };

  // A scenario can swap lineInRect out. isPrePlaceAngle has several branches
  // that each independently return true; to see what ONE of them decides, the
  // later ones have to be shut off, and their LOS tests are the switch.
  const utils = over.lineInRect
        ? Object.assign({}, UTILS, { lineInRect: over.lineInRect })
        : UTILS;

  const base = {
    Math, JSON, console, Map, Set, Array, Object, Number, Infinity,
    UTILS: utils, items, config, myPlayer,
    window: { vars: Object.assign({
      prePlace: true, prePlaceNova: true, blismaPre: true, blismaReplace: true,
      replace: true, replaceRange: 300, placeAngles144: true,
      shameTick: false, shameGrind: true,
    }, over.vars || {}) },

    players: over.players || [],
    visibleObjects: over.visibleObjects || [],
    spikes_our: over.spikes_our || [],
    traps_our: over.traps_our || [],
    nearestEnemy: over.nearestEnemy !== undefined ? over.nearestEnemy : null,
    primaryReload: over.primaryReload || {},
    secondaryReload: over.secondaryReload || {},
    spikeDmgCount: over.spikeDmgCount || 0,
    predictMoveAngle: over.predictMoveAngle != null ? over.predictMoveAngle : 0,
    gPressed: over.gPressed || false,
    tick: over.tick != null ? over.tick : 100,
    blismaPrePlaced: over.blismaPrePlaced || new Map(),

    getAttackDir: () => 0,
    canTrapTick: over.canTrapTick || (() => false),
    canShamePlace: over.canShamePlace || (() => false),

    // Records instead of sending. Returns false on overlap, exactly as the
    // real one does, so the "cannot take a held slot" claim is testable.
    addPredictObject: (id, angle, preplace) => {
      const cfg = ctx.getConfig(id, angle);
      for (const o of placed) {
        if (UTILS.getDistance(cfg.x, cfg.y, o.x, o.y) < cfg.scale + o.scale) return false;
      }
      placed.push({ id, angle, preplace, x: cfg.x, y: cfg.y, scale: cfg.scale });
      return true;
    },
  };

  // canPlace: open ground unless a blocker is within reach of the slot.
  base.blockers = over.blockers || [];

  ctx = vm.createContext(base);
  vm.runInContext(
    [
      lift("getConfig"),
      lift("isItemLimit"),
      // canPlace is stubbed: the real one needs the whole objectManager, and
      // what these tests care about is which angles get offered, not the
      // game's collision table.
      `function canPlace(id, angle, objects) {
         if (isItemLimit(id)) return false;
         const c = getConfig(id, angle);
         for (const b of blockers) {
           if (UTILS.getDistance(c.x, c.y, b.x, b.y) < c.scale + b.scale) return false;
         }
         return true;
       }`,
      lift("getPerfectAngles"),
      lift("buildPlaceAngles"),
      lift("getPrePlaceAngles"),
      lift("isPrePlaceAngle"),
      lift("blismaBuildingDamage"),
      lift("blismaIncomingDamage"),
      lift("blismaFillAngles"),
      "const BLISMA_ROUTE_LIMIT = " + (src.match(/BLISMA_ROUTE_LIMIT = (\d+)/) || [,"0"])[1] + ";",
      lift("blismaTake"),
      lift("blismaSweepWidth"),
      lift("blismaSweepAngles"),
      lift("blismaSpikeKb"),
      lift("blismaPreplace"),
      lift("blismaReplace"),
    ].join("\n\n"),
    ctx
  );

  return ctx;
}

// ---------------------------------------------------------------------------
let failures = 0, checks = 0;
function ok(label, cond, detail) {
  checks++;
  if (cond) { console.log(`  ✓ ${label}`); return; }
  failures++;
  console.log(`  ✗ ${label}${detail ? "\n      " + detail : ""}`);
}
function section(t) { console.log(`\n${t}`); }

const enemyAt = (x, y, over = {}) => Object.assign({
  sid: 2, x2: x, y2: y, xVel: x, yVel: y, scale: 35,
  weapons: [5, 10], weaponVariants: [0, 0], skinIndex: 0,
  spikeDamage: 0, shameCount: 0, visible: true, weaponIndex: 5,
}, over);

const wallAt = (sid, x, y, health, over = {}) => Object.assign({
  sid, x, y, health, scale: 35, active: true, isItem: true, trap: false, dmg: true,
}, over);

// ===========================================================================
section("blismaIncomingDamage — the damage map (blisma's whole edge)");
{
  const wall = wallAt(9, 1100, 1000, 60);
  const a = enemyAt(1140, 1000, { sid: 2 });
  const b = enemyAt(1060, 1000, { sid: 3 });
  const c = world({
    players: [a, b],
    visibleObjects: [wall],
    nearestEnemy: a,
    primaryReload: { 2: 1, 3: 1 },
  });

  const map = c.blismaIncomingDamage([wall]);
  const total = map.get(wall) || 0;
  // Each: dmg 30 * sDmg 1 * tank 1 * variant 1 = 30. Two of them = 60.
  ok("two attackers on one wall are summed (30 + 30 = 60)", total === 60, `got ${total}`);
  ok("a 60hp wall is therefore predicted dead", total >= wall.health);

  // Same pair, one swing still on cooldown.
  const c2 = world({
    players: [a, b], visibleObjects: [wall], nearestEnemy: a,
    primaryReload: { 2: 1, 3: 0.4 },
  });
  const partial = c2.blismaIncomingDamage([wall]).get(wall) || 0;
  ok("an unloaded swing contributes nothing (60 -> 30)", partial === 30, `got ${partial}`);
  ok("and the wall then survives the read", partial < wall.health);

  // Out of reach.
  const far = enemyAt(1400, 1000, { sid: 4 });
  const c3 = world({
    players: [far], visibleObjects: [wall], nearestEnemy: far,
    primaryReload: { 4: 1 },
  });
  ok("an out-of-range attacker contributes nothing",
     (c3.blismaIncomingDamage([wall]).get(wall) || 0) === 0);

  // Great hammer: sDmg is what makes it a wall weapon.
  const hammer = enemyAt(1080, 1000, { sid: 5, weaponIndex: 10, weapons: [5, 10] });
  const c4 = world({
    players: [hammer], visibleObjects: [wall], nearestEnemy: hammer,
    secondaryReload: { 5: 1 },
  });
  const h = c4.blismaIncomingDamage([wall]).get(wall) || 0;
  ok("great hammer carries its sDmg (30 * 7.5 = 225)", h === 225, `got ${h}`);

  // Tank gear.
  const tank = enemyAt(1060, 1000, { sid: 6, skinIndex: 40 });
  const c5 = world({
    players: [tank], visibleObjects: [wall], nearestEnemy: tank,
    primaryReload: { 6: 1 },
  });
  const t = c5.blismaIncomingDamage([wall]).get(wall) || 0;
  ok("tank gear multiplies by 3.3 (30 -> 99)", Math.abs(t - 99) < 1e-9, `got ${t}`);
}

// ===========================================================================
section("blismaSweepWidth — the unit bug blisma shipped, fixed");
{
  const c = world({ nearestEnemy: enemyAt(1100, 1000) });

  // A hole directly behind you is the worst case: blisma's own version returns
  // ~180 (degrees) here and hands it to a radian-bounded sweep.
  const behind = c.blismaSweepWidth({ x: 900, y: 1000 });
  const front = c.blismaSweepWidth({ x: 1100, y: 1000 });

  ok("a hole behind you never asks for more than one full ring",
     behind <= Math.PI * 2 + 1e-9, `got ${behind}`);
  ok("a hole in front asks for less than a hole behind", front < behind,
     `front ${front} behind ${behind}`);
  ok("blisma's raw value would have been out of range in radians",
     (Math.PI / 2 + Math.PI) * (180 / Math.PI) > Math.PI * 2);

  // And the sweep that consumes it terminates in a bounded number of probes.
  let probes = 0;
  const counting = Object.create(c);
  const width = c.blismaSweepWidth({ x: 900, y: 1000 });
  for (let off = 0; off <= width / 2; off += Math.PI / 24) probes++;
  ok("the widest sweep is ~24 probes, not ~688", probes <= 26, `got ${probes}`);
}

// ===========================================================================
section("blismaPreplace — predicts the break, fills through addPredictObject");
{
  const wall = wallAt(9, 1060, 1000, 50);
  const a = enemyAt(1100, 1000, { sid: 2 });
  const b = enemyAt(1020, 1000, { sid: 3 });

  const c = world({
    players: [a, b], visibleObjects: [wall], nearestEnemy: a,
    primaryReload: { 2: 1, 3: 1 },
  });
  c.blismaPreplace();

  ok("a wall under its incoming total gets filled", placed.length > 0,
     `placed ${placed.length}`);
  ok("and it rides the preplace lane", placed.every(p => p.preplace === true));
  ok("the guard map records the sid", c.blismaPrePlaced.has(9));

  // Healthy wall: nothing.
  const c2 = world({
    players: [a, b], visibleObjects: [wallAt(9, 1060, 1000, 400)], nearestEnemy: a,
    primaryReload: { 2: 1, 3: 1 },
  });
  c2.blismaPreplace();
  ok("a wall above its incoming total is left alone", placed.length === 0,
     `placed ${placed.length}`);

  // Gates.
  const c3 = world({
    players: [a, b], visibleObjects: [wall], nearestEnemy: a,
    primaryReload: { 2: 1, 3: 1 }, vars: { blismaPre: false },
  });
  c3.blismaPreplace();
  ok("the toggle off means not one placement", placed.length === 0);

  const c4 = world({
    players: [a, b], visibleObjects: [wall], nearestEnemy: a,
    primaryReload: { 2: 1, 3: 1 }, gPressed: true,
  });
  c4.blismaPreplace();
  ok("the grind gate is respected", placed.length === 0);

  const c5 = world({
    players: [a, b], visibleObjects: [wall], nearestEnemy: enemyAt(1600, 1000),
    primaryReload: { 2: 1, 3: 1 },
  });
  c5.blismaPreplace();
  ok("a far enemy means no preplace", placed.length === 0);

  // Stale guard entries are pruned, not leaked.
  const stale = new Map([[77, 10]]);
  const c6 = world({
    players: [a, b], visibleObjects: [wall], nearestEnemy: a,
    primaryReload: { 2: 1, 3: 1 }, tick: 200, blismaPrePlaced: stale,
  });
  c6.blismaPreplace();
  ok("a prediction that never died is pruned after 40 ticks", !stale.has(77));
}

// ===========================================================================
section("blismaReplace — the anti-double-pay guard and the three lanes");
{
  const enemy = enemyAt(1080, 1000);
  const broken = [{ sid: 9, x: 1060, y: 1000, scale: 35, id: 6, trap: false, dmg: true, ours: true }];

  // The guard: a hole the preplacer already filled is skipped once.
  const guard = new Map([[9, 100]]);
  const c = world({ nearestEnemy: enemy, primaryReload: { 1: 1 }, blismaPrePlaced: guard });
  c.blismaReplace(broken);
  ok("a hole the preplacer already paid for is skipped", placed.length === 0,
     `placed ${placed.length}`);
  ok("and the guard entry is consumed, so the next break is answered", !guard.has(9));

  // Unguarded: the fill lane answers.
  const c2 = world({ nearestEnemy: enemy, primaryReload: { 1: 1 } });
  c2.blismaReplace(broken);
  ok("an unguarded break is filled", placed.length === 1, `placed ${placed.length}`);
  ok("and it rides the immediate lane, not the preplace one",
     placed.every(p => p.preplace === false));

  // An enemy building coming down is not our hole.
  const c3 = world({ nearestEnemy: enemy, primaryReload: { 1: 1 } });
  c3.blismaReplace([Object.assign({}, broken[0], { ours: false })]);
  ok("an enemy's building coming down is not replaced", placed.length === 0);

  // Toggle.
  const c4 = world({ nearestEnemy: enemy, primaryReload: { 1: 1 }, vars: { blismaReplace: false } });
  c4.blismaReplace(broken);
  ok("the toggle off means not one placement", placed.length === 0);

  // Lane 3 type choice: in reach and not being ticked -> spike; else trap.
  const c5 = world({ nearestEnemy: enemyAt(1060, 1000), primaryReload: { 1: 1 } });
  c5.blismaReplace(broken);
  ok("in the enemy's reach, undamaged -> spike (item 2)",
     placed.length === 1 && placed[0].id === 6, JSON.stringify(placed));

  const c6 = world({ nearestEnemy: enemyAt(1060, 1000), primaryReload: { 1: 1 }, spikeDmgCount: 3 });
  c6.blismaReplace(broken);
  ok("already taking spike damage -> trap (item 4)",
     placed.length === 1 && placed[0].id === 15, JSON.stringify(placed));

  // Lane 1: the knock. Swing down, enemy untrapped, one of ours on the push line.
  const pushInto = { x: 1080 + 60, y: 1000, scale: 35 };
  const c7 = world({
    nearestEnemy: enemyAt(1080, 1000), primaryReload: { 1: 0.5 },
    spikes_our: [pushInto],
  });
  ok("spikeKb sees a spike on the knock line",
     c7.blismaSpikeKb(UTILS.getDirection(1060, 1000, 1000, 1000)) === true);

  const c8 = world({
    nearestEnemy: enemyAt(1080, 1000), primaryReload: { 1: 1 },
    spikes_our: [pushInto],
  });
  ok("and stays out of the way while your own swing is loaded",
     c8.blismaSpikeKb(UTILS.getDirection(1060, 1000, 1000, 1000)) === false);

  const c9 = world({
    nearestEnemy: enemyAt(1080, 1000), primaryReload: { 1: 0.5 },
    spikes_our: [pushInto], traps_our: [{ x: 1080, y: 1000, scale: 32 }],
  });
  ok("and defers to the re-trap lane while they are already trapped",
     c9.blismaSpikeKb(UTILS.getDirection(1060, 1000, 1000, 1000)) === false);
}

// ===========================================================================
section("addPredictObject — no lane can take a slot another one holds");
{
  const enemy = enemyAt(1080, 1000);
  const c = world({ nearestEnemy: enemy, primaryReload: { 1: 1 } });

  const angle = 0;
  const first = c.addPredictObject(6, angle, false);
  const second = c.addPredictObject(6, angle, false);
  ok("the same slot twice is refused the second time", first === true && second === false);

  // And blisma then finds somewhere else rather than dropping the break.
  const c2 = world({ nearestEnemy: enemyAt(1060, 1000), primaryReload: { 1: 1 } });
  const objAim = UTILS.getDirection(1060, 1000, 1000, 1000);
  c2.addPredictObject(6, objAim, false);                       // another lane took it
  const held = placed.length;
  c2.blismaReplace([{ sid: 9, x: 1060, y: 1000, scale: 35, id: 6, trap: false, dmg: true, ours: true }]);
  ok("blisma routes around a held slot instead of dropping the hole",
     placed.length === held + 1, `held ${held}, now ${placed.length}`);
  ok("and the slot it took is a different one",
     placed[held].angle !== objAim);
}

// ===========================================================================
section("isPrePlaceAngle — NOVASTORM grading is additive, off changes nothing");
{
  const enemy = enemyAt(1080, 1000, { spikeDamage: 0 });
  const trap = { x: 1080, y: 1000, scale: 40 };

  const mk = (vars) => world({
    nearestEnemy: enemy, traps_our: [trap], spikes_our: [],
    primaryReload: { 1: 1 }, secondaryReload: { 1: 1 }, vars,
  });

  // A slot right on the trapped enemy. Nova's Priority 0 takes it with no
  // shame kit at all; 1.5 needed canTrapTick() first and so refused.
  const onEnemy = { id: 6, x: 1080, y: 1000, scale: 35 };

  const off = mk({ prePlaceNova: false });
  const on = mk({ prePlaceNova: true });

  const offAns = off.isPrePlaceAngle(onEnemy, null, undefined, undefined, undefined);
  const onAns = on.isPrePlaceAngle(onEnemy, null, undefined, undefined, undefined);

  ok("NOVASTORM off: a trapped enemy in reach is refused without the shame kit",
     offAns === false, `got ${offAns}`);
  ok("NOVASTORM on: a trapped enemy in reach earns a spike on its own",
     onAns === true, `got ${onAns}`);

  // Priority 1 now accepts a LIST of reaching spikes, which is what lets the
  // caller lay two. The single-winner shape still works.
  const slotA = { id: 6, x: 1200, y: 1200, scale: 35 };
  const slotB = { id: 6, x: 1210, y: 1210, scale: 35 };

  // Priority 4 also returns true for a far spike while the enemy is trapped, so
  // it would mask the list branch entirely. Blocking LOS shuts it off and leaves
  // Priority 1 as the only branch that can still say yes out here.
  const isolated = (vars) => world({
    nearestEnemy: enemy, traps_our: [trap], spikes_our: [],
    primaryReload: { 1: 1 }, secondaryReload: { 1: 1 }, vars,
    lineInRect: () => true,
  });

  const listCtx = isolated({ prePlaceNova: true });
  const inList = listCtx.isPrePlaceAngle(slotA, null, [slotA, slotB], undefined, undefined);
  const alsoInList = listCtx.isPrePlaceAngle(slotB, null, [slotA, slotB], undefined, undefined);
  const notInList = listCtx.isPrePlaceAngle(
    { id: 6, x: 1500, y: 1500, scale: 35 }, null, [slotA, slotB], undefined, undefined);

  ok("a slot inside the reaching-spike list qualifies", inList === true);
  ok("the SECOND slot in that list qualifies too — this is what lets it lay two",
     alsoInList === true);
  ok("a slot outside the list does not qualify on that branch", notInList === false,
     `got ${notInList}`);

  // The same pair under 1.5's single-winner shape: only the head can qualify,
  // which is exactly why 1.5 could never lay a second spike.
  const singleCtx = isolated({ prePlaceNova: false });
  ok("single-winner shape: the head still qualifies",
     singleCtx.isPrePlaceAngle(slotA, null, slotA, undefined, undefined) === true);
  ok("single-winner shape: the runner-up cannot",
     singleCtx.isPrePlaceAngle(slotB, null, slotA, undefined, undefined) === false);

  // A trap slot with no enemy near is the terminal `if (isTrap) return true`.
  const trapSlot = { id: 15, x: 1200, y: 1200, scale: 32 };
  ok("a trap slot still falls through to the trap branch in both modes",
     off.isPrePlaceAngle(trapSlot, null, undefined, undefined, undefined) ===
     on.isPrePlaceAngle(trapSlot, null, undefined, undefined, undefined));
}

// ===========================================================================
section("the two spikes NOVASTORM lays in one tick");
{
  // The dual-spike test is on the selection rule the client uses, lifted as
  // written: two candidates 1.2rad or more apart are two walls, closer than
  // that is one wall twice.
  const apart = UTILS.getAngleDist(0, 2.0);
  const together = UTILS.getAngleDist(0, 0.4);
  ok("1.2rad apart or more -> the second spike is spent", apart > 1.2);
  ok("closer than that -> it is not", together <= 1.2);

  // And the wrap-safe comparison is the reason it holds all the way round.
  // NOVASTORM's raw Math.abs(a - b) reads 0.05 and 6.23 as 6.18 apart.
  const raw = Math.abs(0.05 - 6.23);
  const wrapped = UTILS.getAngleDist(0.05, 6.23);
  ok("raw subtraction misreads the 0/2pi seam", raw > 1.2 && wrapped < 1.2,
     `raw ${raw.toFixed(2)}, wrapped ${wrapped.toFixed(2)}`);
  ok("so those two would have been spent as 'two walls' by NOVASTORM's own test",
     raw > 1.2);
}

// ===========================================================================
section("the client still parses");
{
  let parsed = true, err = "";
  try { new vm.Script(src, { filename: CLIENT_PATH }); }
  catch (e) { parsed = false; err = e.message; }
  ok("YoRHa_System.user.js parses as a whole", parsed, err);

  // Every new function has to be defined once AND reached. This is the exact
  // disease the source clients were full of: NOVASTORM defines batchPlaceTrap's
  // callers but never batchPlaceTrap, AI Client's AutoReplace is never called,
  // starrclient's best preplacer is shadowed by a second assignment. A lane
  // nothing calls is not a feature.
  for (const name of ["blismaBuildingDamage", "blismaIncomingDamage", "blismaFillAngles",
                      "blismaTake", "blismaSweepWidth", "blismaSweepAngles",
                      "blismaSpikeKb", "blismaPreplace", "blismaReplace"]) {
    const defs = (src.match(new RegExp(`function ${name}\\(`, "g")) || []).length;
    const refs = (src.match(new RegExp(`[^a-zA-Z]${name}\\(`, "g")) || []).length;
    ok(`${name} is reached (${refs - defs} call site(s))`, defs === 1 && refs - defs >= 1,
       `defs ${defs}, call sites ${refs - defs}`);
  }

  // Both new lanes have to actually be called, or they are the dead code the
  // clients they came from were full of.
  ok("blismaPreplace() is called from the pipeline",
     /\n\s*blismaPreplace\(\);/.test(src));
  ok("blismaReplace(broken) is called from the pipeline",
     /\n\s*blismaReplace\(broken\);/.test(src));
  ok("blismaPrePlaced is carried through the bot context",
     src.includes('"blismaPrePlaced"') &&
     src.includes("blismaPrePlaced: blismaPrePlaced,") &&
     src.includes("blismaPrePlaced = s.blismaPrePlaced"));
  ok("every new toggle has a default in window.vars",
     ["prePlaceNova", "blismaPre", "blismaReplace"].every(v =>
       new RegExp(`\\n\\s*${v}: (true|false),`).test(src)));
  ok("and a tile in the Placers menu",
     ["prePlaceNova", "blismaPre", "blismaReplace"].every(v =>
       new RegExp(`id: "${v}"`).test(src)));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
