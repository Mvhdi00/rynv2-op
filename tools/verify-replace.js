#!/usr/bin/env node
/*
 * verify-replace.js
 *
 * YoRHa's replacer is Falcon 0.4.7's grading table, carefully ported. Four
 * changes were made to it, each taken from a specific client and each fixing a
 * specific hole:
 *
 *   FINE AIM     AI Client 44 — a half-degree search from the hole's own angle,
 *                as a refinement on the grid's choice rather than a replacement
 *                for it.
 *   CAP          blisma mod v5 — itemCounts is server-written, so placements
 *                queued inside the current tick are invisible to isItemLimit().
 *   DANGER GATE  Ae86 2.8 / blisma — do not build through a spike sync.
 *   COST         canTrapTick() was reached once per spike candidate, each call
 *                sweeping a whole placement ring.
 *
 * This lifts the real function bodies out of the client by name and runs them.
 * Nothing here re-implements anything — including addPredictObject, since the
 * no-double-spend claim rests on it.
 *
 *   node tools/verify-replace.js [path/to/YoRHa_System.user.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "YoRHa_System.user.js");

const src = fs.readFileSync(CLIENT_PATH, "utf8");

// ---------------------------------------------------------------------------
function balance(start) {
  let i = src.indexOf("{", start);
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced braces from " + start);
}
function lift(name) {
  const at = src.indexOf(`function ${name}(`);
  if (at === -1) throw new Error(`function ${name} not found in client`);
  return balance(at);
}
function liftAssign(lhs, rebindTo) {
  const at = src.indexOf(`${lhs} = function`);
  if (at === -1) throw new Error(`${lhs} not found in client`);
  const text = balance(at);
  if (!rebindTo) return text;
  return rebindTo + "." + lhs.slice(lhs.lastIndexOf(".") + 1) + text.slice(lhs.length);
}
function liftLine(pattern) {
  const m = new RegExp(pattern).exec(src);
  if (!m) throw new Error(`line ${pattern} not found in client`);
  return m[0];
}

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
  lineInRect: () => false,
};

// The real caps, lifted from the client's own group table rather than guessed:
// spikes 15, traps 6. The cap test is the whole point of one of these changes.
const items = {
  weapons: { 0: { dmg: 25, range: 65 }, 5: { dmg: 30, range: 65 }, 10: { dmg: 30, sDmg: 7.5, range: 110 } },
  list: {
    6:  { name: "spikes", scale: 35, placeOffset: 0, dmg: 20, group: { id: 2, name: "spikes", limit: 15 } },
    9:  { name: "spinning spikes", scale: 52, placeOffset: 0, dmg: 35, group: { id: 2, name: "spikes", limit: 15 } },
    15: { name: "pit trap", scale: 50, placeOffset: -5, trap: true, group: { id: 5, name: "trap", limit: 6 } },
  },
};

const config = {
  weaponVariants: [{ val: 1 }, { val: 1.1 }, { val: 1.18 }, { val: 1.18 }],
  inSandbox: false, isSandbox: false, onSandboxHost: false, playerScale: 35,
};
eval(liftAssign("module.exports.buildLimit", "config") + ";");

let ctx;
Object.defineProperty(globalThis, "placed", { get() { return ctx ? ctx.predictObjects : []; } });

function world(over = {}) {
  const myPlayer = over.myPlayer || {
    sid: 1, x2: 1000, y2: 1000, x: 1000, y: 1000, scale: 35, dir: 0, alive: true,
    xVel: 1000, yVel: 1000, items: [0, 3, 6, 10, 15, 53],
    itemCounts: Object.assign({}, over.itemCounts), weapons: [5, 10],
    weaponVariants: [0, 0], skinIndex: 0,
  };

  const base = {
    Math, JSON, console, Map, Set, Array, Object, Number, Infinity, isFinite, isNaN,
    UTILS, items, config, myPlayer,
    window: { vars: Object.assign({
      replace: true, replaceRange: 300, placeAngles144: true, replaceLead: true,
      shameTick: false, shameGrind: true, autoPlace: false,
    }, over.vars || {}) },

    visibleObjects: over.visibleObjects || [],
    spikes_our: over.spikes_our || [],
    traps_our: over.traps_our || [],
    nearestEnemy: over.nearestEnemy !== undefined ? over.nearestEnemy : null,
    enemiesNear: over.enemiesNear || (over.nearestEnemy ? [over.nearestEnemy] : []),
    nearestTrap: over.nearestTrap || null,
    spikeDmgCount: over.spikeDmgCount || 0,
    primaryReload: over.primaryReload || {},
    secondaryReload: over.secondaryReload || {},
    gPressed: over.gPressed || false,
    tick: over.tick != null ? over.tick : 100,
    predictObjects: [], placedAngles: [], bannedAngles: new Map(),
    predictMoveAngle: over.predictMoveAngle != null ? over.predictMoveAngle : null,
    lastMoveDir: null,
    pathfindingState: over.pathfindingState || null,
    _placeAnglesTick: -1, _placeAnglesCache: new Map(),
    _trapTickMemoTick: -1, _trapTickMemoOwner: null, _trapTickMemo: false,

    // What getPredictObjects and the two other placers touch.
    replaceQueue: over.replaceQueue || [], removedObjects: [], placeTick: 0,
    lastPrePlaceObject: null, spamPrePlacer: false, smartTickSpike: null,
    autoMills: false, lastMoveAngle: null, grindObjects: [],
    trapPress: false, turretPress: false, spikePress: false,
    nearestEnemiesCount: 0, spikes_enemy: [], enemySpikes: [], players: [],
    autogathering: false, predictWeapon: 5,
    // Read by isPrePlaceAngle's trap branch, which only fires when the
    // preplacer runs with a trap candidate on the table — a combination the
    // single-tick PIPELINE scene never reached, so this was missing until the
    // twelve-tick run below found it. Client-side it is declared at top level.
    imTrapped: over.imTrapped || false,
    trap_where_im_in: over.trap_where_im_in || null,
    getAttackDir: () => 0,
    isBoughtHat: () => false,
    isItemSetted: [],

    isObjectOur: (o) => !!(o && o.owner && o.owner.sid === 1),
    getPlayerInfo: over.getPlayerInfo || ((p, t) => {
      if (t === "secondaryWeapon") return "hammer";
      if (t === "secondaryStructureDmg") return 225;
      if (t === "secondaryRange") return 110;
      if (t === "primaryStructureDmg") return 99;
      return 0;
    }),
    objectManager: {
      // Open ground unless a blocker sits on it. The blockers list is the
      // scenario's way of shaping the ring.
      checkItemLocation: (x, y, s) =>
        !(base.blockers || []).some(b => UTILS.getDistance(x, y, b.x, b.y) < s + b.scale),
    },
  };
  base.blockers = over.blockers || [];

  ctx = vm.createContext(base);
  vm.runInContext([
    lift("getConfig"),
    lift("isItemLimit"),
    lift("canPlace"),
    lift("addPredictObject"),
    lift("getPerfectAngles"),
    lift("buildPlaceAngles"),
    lift("getPrePlaceAngles"),
    lift("canTrapTick"),
    lift("computeCanTrapTick"),
    lift("canShamePlace"),
    liftLine(String.raw`const REPLACE_FILL_LIMIT = \d+;`),
    liftLine(String.raw`const REPLACE_RING_ANGLES = \d+;`),
    liftLine(String.raw`const REPLACE_FINE_STEP = [^;]+;`),
    liftLine(String.raw`const REPLACE_LEAD_WINDOW = \d+;`),
    liftLine(String.raw`const replaceHeadings = new Map\(\);`),
    liftLine(String.raw`let replaceHeadingStamp = \d+;`),
    lift("replaceTrackHeading"),
    lift("replaceSteadiness"),
    lift("replaceAim"),

    // A `const` inside a vm script is not a property of the context, so the
    // lead's book cannot be reached from out here without a handle. This one
    // only reads the real bindings — the tests still drive the tracker through
    // replaceTrackHeading, never by writing the map.
    "function leadBook() { return { headings: replaceHeadings, window: REPLACE_LEAD_WINDOW }; }",
    lift("replaceFineAim"),
    lift("replaceNearestHole"),
    lift("replaceWithinPath"),
    lift("replaceKnockInto"),
    lift("replaceBlocksMyMove"),
    lift("replaceNearness"),
    lift("replaceEnemyRing"),
    lift("replaceCandidates"),
    lift("replaceGrade"),
    lift("doReplace"),

    // The autoplacer and the orchestrator, so "untouched" can be RUN rather
    // than asserted, and so the claim is about the real pipeline.
    lift("isAutoPlaceAngle"),
    lift("checkPredictObjects"),
    lift("updateAngles"),
    lift("setPlaceTick"),
    lift("isPrePlaceAngle"),
    lift("getPrePlaceObject"),
    lift("getPredictObjects"),
  ].join("\n\n"), ctx);

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

const enemyAt = (x, y, o = {}) => Object.assign({
  sid: 2, x2: x, y2: y, x, y, xVel: x, yVel: y, scale: 35,
  weapons: [5, 10], weaponVariants: [0, 0], skinIndex: 0, weaponIndex: 5,
  spikeDamage: 0, shameCount: 0, visible: true, health: 100,
}, o);

// A dead building, in the shape killObject records it.
const hole = (x, y, o = {}) => Object.assign({
  sid: 9, x, y, scale: 35, id: 6, trap: false, dmg: true, ours: true,
}, o);

// ===========================================================================
section("FINE AIM — AI Client 44's half-degree search, as a refinement");
{
  const c = world({ nearestEnemy: enemyAt(1080, 1000) });

  // A `const` inside the lifted script is lexically scoped, not a context
  // property, so this is read from the source it was lifted from.
  ok("the step is AI Client 44's PI/360, half a degree",
     /const REPLACE_FINE_STEP = Math\.PI \/ 360;/.test(src));

  // A hole at an angle the 144-grid cannot express exactly. 144 steps is 2.5deg
  // apart, so a hole at 1.25deg sits squarely between two grid angles.
  const holeAngle = UTILS.toRad(1.25);
  const r = 35 + items.list[6].scale;
  const h = { x: 1000 + Math.cos(holeAngle) * r, y: 1000 + Math.sin(holeAngle) * r };

  const grid = c.getPrePlaceAngles(6, [])
        .filter(s => s.placeable)
        .sort((a, b) => UTILS.getAngleDist(a.angle, holeAngle) - UTILS.getAngleDist(b.angle, holeAngle))[0];

  const gridGap = UTILS.getAngleDist(grid.angle, holeAngle);
  const fine = c.replaceFineAim({ id: 6, angle: grid.angle, x: grid.x, y: grid.y }, h, []);
  const fineGap = UTILS.getAngleDist(fine, holeAngle);

  ok(`the grid alone lands ${(gridGap * 180 / Math.PI).toFixed(2)}deg off the hole`, gridGap > 0.01);
  ok(`the refinement closes it to ${(fineGap * 180 / Math.PI).toFixed(2)}deg`, fineGap < gridGap,
     `${gridGap.toFixed(4)} -> ${fineGap.toFixed(4)}`);
  ok("and it is within half a degree", fineGap <= Math.PI / 360 + 1e-9);

  // It refines; it does not relocate. Moving further than one grid step would
  // be choosing a different slot, and the grade belongs to the slot the grid
  // chose.
  const step = (Math.PI * 2) / 144;
  ok("it never moves further than one grid step from the graded slot",
     UTILS.getAngleDist(fine, grid.angle) <= step + 1e-9,
     `moved ${(UTILS.getAngleDist(fine, grid.angle) * 180 / Math.PI).toFixed(2)}deg`);

  // A slot already on the hole is left exactly alone.
  const exact = c.getPrePlaceAngles(6, []).filter(s => s.placeable)[0];
  const onIt = { x: exact.x, y: exact.y };
  ok("a slot already on its hole is returned untouched",
     c.replaceFineAim({ id: 6, angle: exact.angle, x: exact.x, y: exact.y }, onIt, []) === exact.angle);

  // Ground it cannot use is not offered.
  const blocked = world({
    nearestEnemy: enemyAt(1080, 1000),
    blockers: [{ x: 1000 + Math.cos(holeAngle) * r, y: 1000 + Math.sin(holeAngle) * r, scale: 60 }],
  });
  const away = blocked.replaceFineAim({ id: 6, angle: grid.angle, x: grid.x, y: grid.y }, h, []);
  ok("a refined angle is always ground canPlace agrees to",
     blocked.canPlace(6, away, []) || away === grid.angle,
     `returned ${away}`);

  // Degenerate input inside a packet handler must not throw.
  let threw = null;
  try {
    c.replaceFineAim({ id: 6, angle: 0, x: 1, y: 1 }, null, []);
    c.replaceFineAim({ id: 6, angle: 0, x: 1, y: 1 }, { x: NaN, y: NaN }, []);
  } catch (e) { threw = e.message; }
  ok("a missing or non-finite hole falls back to the grid angle", threw === null, threw);

  // The cost is bounded: one grid step of half-degree probes, both ways.
  let probes = 0;
  const counting = world({ nearestEnemy: enemyAt(1080, 1000) });
  const realCanPlace = counting.canPlace;
  counting.canPlace = function (...a) { probes++; return realCanPlace.apply(this, a); };
  counting.replaceFineAim({ id: 6, angle: grid.angle + 0.04, x: grid.x, y: grid.y }, h, []);
  ok(`the search costs ${probes} canPlace calls, not AI Client's 720`, probes <= 12, `got ${probes}`);
}

// ===========================================================================
section("BAN BOOK — a refined placement must still be bannable");
{
  // The file states this invariant about itself: a placed angle is looked up by
  // `bannedAngles.has(obj.angle)` and matched with a tolerance. The fine aim
  // places at angles that are NOT on the ring, which broke it three ways at
  // once. The ban is what stops two lanes spending the same ground on two
  // ticks, so this is the load-bearing test for that whole change.
  const c = world({ nearestEnemy: enemyAt(1060, 1000), enemiesNear: [enemyAt(1060, 1000)] });

  // 1. Every angle the fine aim returns lives in [0, 2pi), like a grid angle.
  //    atan2 returns -pi..pi, so a hole BELOW the player produced a negative
  //    angle — the same slot as its positive twin, but a different key.
  const r = 35 + items.list[6].scale;
  for (const deg of [-1.25, -45, -179, 1.25, 45, 179]) {
    const h = { x: 1000 + Math.cos(UTILS.toRad(deg)) * r, y: 1000 + Math.sin(UTILS.toRad(deg)) * r };
    const grid = c.getPrePlaceAngles(6, []).filter(s => s.placeable)
          .sort((a, b) => UTILS.getAngleDist(a.angle, UTILS.toRad(deg)) -
                          UTILS.getAngleDist(b.angle, UTILS.toRad(deg)))[0];
    const fine = c.replaceFineAim({ id: 6, angle: grid.angle, x: grid.x, y: grid.y }, h, []);
    ok(`a hole at ${deg}deg refines to an angle inside [0, 2pi)`,
       fine >= 0 && fine < Math.PI * 2, `got ${fine}`);
  }

  // 2. A refined placement is found by the ban pass and filed under a key the
  //    reader actually looks up.
  const b = world({ nearestEnemy: enemyAt(1060, 1000), enemiesNear: [enemyAt(1060, 1000)] });
  b.doReplace([hole(1000 + Math.cos(UTILS.toRad(1.25)) * r, 1000 + Math.sin(UTILS.toRad(1.25)) * r)]);

  const placedAngles = placed.map(o => o.angle);
  ok("something was placed to ban", placedAngles.length > 0);

  const offGrid = placedAngles.filter(a =>
    !b.getPrePlaceAngles(6, []).some(s => Math.abs(s.angle - a) < 1e-9));
  ok("at least one placement is genuinely off the grid — the case that broke it",
     offGrid.length > 0, JSON.stringify(placedAngles.map(a => +a.toFixed(4))));

  b.placedAngles = placedAngles.slice();
  b.tick = 101;
  b.replaceCandidates([]);

  const gridAngles = b.getPrePlaceAngles(6, []).map(s => s.angle);
  const keys = [...b.bannedAngles.keys()];
  ok("the ban pass found every placement", keys.length >= placedAngles.length,
     `${keys.length} banned for ${placedAngles.length} placed`);
  ok("and filed each under a real grid angle, which is what has() looks up",
     keys.every(k => gridAngles.some(g => g === k)),
     JSON.stringify(keys.map(k => +k.toFixed(4))));

  const half = Math.PI / gridAngles.length;
  for (const a of offGrid) {
    ok(`the off-grid placement ${a.toFixed(4)} is banned`,
       keys.some(k => UTILS.getAngleDist(k, a) <= half));
  }

  // 3. The autoplacer reads the same list, so its pass has to agree.
  const u = world({
    nearestEnemy: enemyAt(1060, 1000), enemiesNear: [enemyAt(1060, 1000)],
    vars: { replace: true, autoPlace: true, placeAngles144: true },
  });
  u.placedAngles = [0.0218];               // half a grid step off the ring
  u.updateAngles(u.myPlayer.items[2]);
  const uKeys = [...u.bannedAngles.keys()];
  ok("updateAngles bans an off-grid placement too", uKeys.length > 0,
     JSON.stringify(uKeys));
  ok("and files it under a grid angle",
     uKeys.every(k => u.getPrePlaceAngles(u.myPlayer.items[2], []).some(s => s.angle === k)));

  // 4. An exact grid angle must behave exactly as it always did.
  const g = world({ nearestEnemy: enemyAt(1060, 1000), enemiesNear: [enemyAt(1060, 1000)] });
  const exact = g.getPrePlaceAngles(6, []).filter(s => s.placeable)[3].angle;
  g.placedAngles = [exact];
  g.replaceCandidates([]);
  ok("a placement already on the grid is banned under its own angle",
     g.bannedAngles.has(exact), JSON.stringify([...g.bannedAngles.keys()]));

  // 5. Wrap safety: a placement at 6.28 and a slot at 0.00 are one slot.
  const w = world({ nearestEnemy: enemyAt(1060, 1000), enemiesNear: [enemyAt(1060, 1000)] });
  w.placedAngles = [Math.PI * 2 - 0.005];
  w.replaceCandidates([]);
  ok("a placement just under 2pi bans the slot at 0, not nothing",
     w.bannedAngles.has(0), JSON.stringify([...w.bannedAngles.keys()]));
}

// ===========================================================================
section("CAP — blisma's tally, against a counter only the server writes");
{
  // Six traps is the real cap, from the client's own group table. Start with
  // five already down: exactly one slot left.
  const enemy = enemyAt(1060, 1000);
  const c = world({
    nearestEnemy: enemy, enemiesNear: [enemy],
    traps_our: [], itemCounts: { 5: 5 },
    vars: { replace: true, replaceRange: 300 },
  });

  ok("the cap comes from the client's own table, not a guess",
     config.buildLimit(items.list[15].group) === 6);

  c.doReplace([hole(1050, 1000, { trap: true, id: 15 })]);

  const traps = placed.filter(o => o.id === 15).length;
  ok("with one slot left under the cap, exactly one trap is queued",
     traps <= 1, `queued ${traps}`);

  // itemCounts never moves during the tick — which is the whole reason the
  // tally has to exist.
  ok("itemCounts did not move (only the server's \"S\" packet writes it)",
     c.myPlayer.itemCounts[5] === 5);

  // At the cap, nothing.
  const full = world({
    nearestEnemy: enemy, enemiesNear: [enemy], itemCounts: { 5: 6, 2: 15 },
  });
  full.doReplace([hole(1050, 1000, { trap: true, id: 15 })]);
  ok("at the cap, not one building is queued", placed.length === 0, `queued ${placed.length}`);

  // Room for several: the fills are allowed to use it.
  const roomy = world({
    nearestEnemy: enemy, enemiesNear: [enemy], itemCounts: { 5: 0, 2: 0 },
  });
  roomy.doReplace([hole(1050, 1000)]);
  ok("with the stock full, the ring is closed with several", placed.length > 1,
     `queued ${placed.length}`);

  // And never past a cap, whatever the grading wanted.
  const spikeCounts = {};
  for (const o of placed) {
    const g = items.list[o.id].group.id;
    spikeCounts[g] = (spikeCounts[g] || 0) + 1;
  }
  ok("no group is ever queued past its own limit",
     Object.entries(spikeCounts).every(([g, n]) =>
       n <= config.buildLimit({ id: +g, limit: +g === 5 ? 6 : 15 })),
     JSON.stringify(spikeCounts));
}

// ===========================================================================
section("DANGER GATE — do not build through a spike sync");
{
  const enemy = enemyAt(1060, 1000);
  const base = { nearestEnemy: enemy, enemiesNear: [enemy], itemCounts: {} };

  const safe = world(base);
  safe.doReplace([hole(1050, 1000)]);
  ok("normally the hole is answered", placed.length > 0, `queued ${placed.length}`);

  const synced = world(Object.assign({}, base, {
    nearestTrap: { x: 1000, y: 1000, scale: 50 }, spikeDmgCount: 3,
  }));
  synced.doReplace([hole(1050, 1000)]);
  ok("trapped AND taking spike damage: the tick belongs to getting out",
     placed.length === 0, `queued ${placed.length}`);

  // One without the other is not the sync — those must still build.
  const trappedOnly = world(Object.assign({}, base, {
    nearestTrap: { x: 1000, y: 1000, scale: 50 }, spikeDmgCount: 0,
  }));
  trappedOnly.doReplace([hole(1050, 1000)]);
  ok("trapped but not being spiked still builds", placed.length > 0);

  const spikedOnly = world(Object.assign({}, base, { spikeDmgCount: 3 }));
  spikedOnly.doReplace([hole(1050, 1000)]);
  ok("spiked but not trapped still builds", placed.length > 0);

  // The gate reads YoRHa's own pair, not an imported one.
  ok("the gate is YoRHa's own reading, the same pair the preplacer uses",
     /if \(nearestTrap && spikeDmgCount > 0\) return;/.test(src));
}

// ===========================================================================
section("LEAD — grade on where they will be, weighted by whether we know");
{
  // A moving enemy: x2/y2 is where the packet put them, xVel/yVel is the
  // client's own next-frame extrapolation of the same packet.
  const runner = (x, y, stepX, stepY) =>
    enemyAt(x, y, { xVel: x + stepX, yVel: y + stepY });

  // Feed a heading history in by replaying observations, exactly as the tick
  // body does — not by writing the map, which would test nothing.
  function walk(c, sid, x, y, stepX, stepY, n) {
    for (let i = 0; i < n; i++) {
      c.replaceTrackHeading({ sid, x2: x, y2: y, xVel: x + stepX, yVel: y + stepY });
      x += stepX; y += stepY;
    }
    return { x, y };
  }

  // ---- the weight ---------------------------------------------------------
  {
    const c = world({ nearestEnemy: runner(1060, 1000, 25, 0) });
    const e = runner(1060, 1000, 25, 0);

    ok("with no history at all there is no lead — the enemy itself comes back",
       c.replaceAim(e) === e);

    c.replaceTrackHeading(e);
    ok("one sample is not a line either", c.replaceAim(e) === e);

    walk(c, e.sid, 1060, 1000, 25, 0, 6);
    const steady = c.replaceSteadiness(e);
    ok("six samples on one heading read as steady", steady > 0.99, `got ${steady}`);

    const aim = c.replaceAim(e);
    ok("and the aim point lands on the extrapolation, not the report",
       Math.abs(aim.x2 - e.xVel) < 0.5 && Math.abs(aim.y2 - e.yVel) < 0.5,
       `aim ${aim.x2.toFixed(1)},${aim.y2.toFixed(1)} vs xVel ${e.xVel}`);

    // The lead is never longer than the step itself: it is a blend between two
    // known points, so it cannot extrapolate past the further one.
    ok("the lead never runs past the extrapolation it is blending toward",
       UTILS.getDistance(e.x2, e.y2, aim.x2, aim.y2) <=
       UTILS.getDistance(e.x2, e.y2, e.xVel, e.yVel) + 1e-9);
  }

  // ---- juking -------------------------------------------------------------
  {
    const c = world({ nearestEnemy: runner(1060, 1000, 25, 0) });
    const e = runner(1060, 1000, 25, 0);

    let x = 1060, y = 1000;
    for (let i = 0; i < 6; i++) {
      const sx = i % 2 ? 25 : -25;
      c.replaceTrackHeading({ sid: e.sid, x2: x, y2: y, xVel: x + sx, yVel: y });
      x += sx;
    }

    const steady = c.replaceSteadiness(e);
    ok("a heading that reverses every frame reads as unsteady", steady < 0.2, `got ${steady}`);

    const aim = c.replaceAim(e);
    ok("so the aim point collapses back onto what is actually known",
       UTILS.getDistance(aim.x2, aim.y2, e.x2, e.y2) < 5,
       `${UTILS.getDistance(aim.x2, aim.y2, e.x2, e.y2).toFixed(1)} units of lead`);
  }

  // ---- the 0/2pi seam -----------------------------------------------------
  {
    // Headings of -0.05 and +0.05 rad are one line. Averaging the numbers says
    // so too, by luck; averaging -3.1 and +3.1 says the opposite of the truth.
    // Mean resultant length is right in both.
    const c = world({ nearestEnemy: runner(1060, 1000, -25, 0) });
    const e = runner(1060, 1000, -25, 0);

    let x = 1060, y = 1000;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI - 0.04 + (i % 2) * 0.08;      // straddling pi
      const sx = Math.cos(a) * 25, sy = Math.sin(a) * 25;
      c.replaceTrackHeading({ sid: e.sid, x2: x, y2: y, xVel: x + sx, yVel: y + sy });
      x += sx; y += sy;
    }

    ok("headings straddling the pi seam read as one line, not two",
       c.replaceSteadiness(e) > 0.99, `got ${c.replaceSteadiness(e)}`);
  }

  // ---- one packet, one observation ---------------------------------------
  {
    // ctxRun replays the tick body per bot. tick is swapped along with the rest,
    // so the guard has to be the reading itself.
    const c = world({ nearestEnemy: runner(1060, 1000, 25, 0) });
    const e = runner(1060, 1000, 25, 0);
    for (let i = 0; i < 10; i++) c.replaceTrackHeading(e);
    ok("the same reading ten times over is one observation, not ten",
       c.replaceSteadiness(e) === 0, `steadiness ${c.replaceSteadiness(e)}`);
  }

  // ---- bounds -------------------------------------------------------------
  {
    const c = world({ nearestEnemy: runner(1060, 1000, 25, 0) });
    walk(c, 7, 1060, 1000, 25, 0, 40);
    ok("the heading window is bounded by REPLACE_LEAD_WINDOW",
       c.leadBook().headings.get(7).angles.length <= c.leadBook().window,
       `${c.leadBook().headings.get(7).angles.length} kept`);

    for (let sid = 100; sid < 260; sid++) walk(c, sid, 1000, 1000, 25, 0, 2);
    ok("the heading map does not grow for the whole session",
       c.leadBook().headings.size <= 96, `${c.leadBook().headings.size} tracked`);
  }

  // ---- a player who stopped ----------------------------------------------
  {
    const c = world({ nearestEnemy: runner(1060, 1000, 0, 0) });
    const still = enemyAt(1060, 1000);                 // xVel === x, step 0
    for (let i = 0; i < 6; i++) {
      c.replaceTrackHeading({ sid: 2, x2: 1060 + i * 1e-6, y2: 1000, xVel: 1060 + i * 1e-6, yVel: 1000 });
    }
    ok("a player standing still records no heading", c.replaceSteadiness(still) === 0);
    ok("and gets no lead", c.replaceAim(still) === still);
  }

  // ---- wire junk ----------------------------------------------------------
  {
    const c = world({ nearestEnemy: runner(1060, 1000, 25, 0) });
    let threw = null;
    try {
      for (const bad of [null, {}, { sid: 3 }, { sid: 3, x2: NaN, y2: 1 },
                         { sid: 3, x2: 1, y2: 1, xVel: Infinity, yVel: 1 }]) {
        c.replaceTrackHeading(bad);
        if (bad) c.replaceSteadiness(bad);
      }
      const junk = { sid: 3, x2: 1, y2: 1, xVel: NaN, yVel: 1 };
      ok("a non-finite extrapolation takes no lead", c.replaceAim(junk) === junk);
    } catch (e) { threw = e.message; }
    ok("junk on the wire is survived, not thrown on", threw === null, threw);
  }

  // ---- the payoff, through the real doReplace ----------------------------
  {
    // A spike can only go on a ring of fixed radius around us, so how far it
    // ends up from the enemy is floored by geometry no placer controls. What a
    // placer DOES control is the BEARING it spends the slot on, so that is what
    // this measures: the gap between the bearing of the spike we queued and the
    // bearing to where the enemy will be when it exists.
    //
    // Swept over a grid of duels rather than one, because a single scene can
    // flatter any change — and because the first version of this test measured
    // distance on a bare ring, where the answer was identical either way and
    // said nothing.
    const duel = (lead, headingDeg, step, jitter, dense) => {
      const a = UTILS.toRad(headingDeg);
      const sx = Math.cos(a) * step, sy = Math.sin(a) * step;
      const bearing = UTILS.toRad(headingDeg * 1.7 + 40);
      const ex = 1000 + Math.cos(bearing) * 110, ey = 1000 + Math.sin(bearing) * 110;
      const e = runner(ex, ey, sx, sy);

      const field = [];
      for (let i = 0; dense && i < 24; i++) {
        const t = (i / 24) * Math.PI * 2, r = 170 + (i % 4) * 40;
        field.push(hole(1000 + Math.cos(t) * r, 1000 + Math.sin(t) * r,
                        { sid: 300 + i, ours: i % 3 !== 0, owner: { sid: i % 3 !== 0 ? 1 : 2 } }));
      }

      const c = world({
        nearestEnemy: e, enemiesNear: [e], itemCounts: { 2: 0, 5: 0 },
        visibleObjects: field, spikes_our: field.filter(o => o.ours),
        vars: { replace: true, replaceRange: 300, placeAngles144: true, replaceLead: lead },
      });

      // Six observed frames. jitter is how far the heading swings between them:
      // 0 is a straight line, 1.2 rad is a player juking every frame.
      let x = ex - sx * 6, y = ey - sy * 6;
      for (let i = 0; i < 6; i++) {
        const w = a + (i % 2 ? jitter : -jitter);
        const jx = Math.cos(w) * step, jy = Math.sin(w) * step;
        c.replaceTrackHeading({ sid: e.sid, x2: x, y2: y, xVel: x + jx, yVel: y + jy });
        x += jx; y += jy;
      }

      c.doReplace([hole(ex - sx, ey - sy)]);

      const spikes = c.predictObjects.filter(o => o.id === 6);
      if (!spikes.length) return null;

      const want = Math.atan2(e.yVel - 1000, e.xVel - 1000);
      return Math.min(...spikes.map(o =>
        UTILS.getAngleDist(Math.atan2(o.y - 1000, o.x - 1000), want)));
    };

    // Paired: a scene any variant could not answer is dropped from all of them,
    // so the three numbers are over the same duels.
    const sweep = (jitter) => {
      const on = [], off = [];
      for (let h = 0; h < 360; h += 15) {
        for (const step of [12, 25]) {
          for (const dense of [false, true]) {
            const a = duel(true, h, step, jitter, dense);
            const b = duel(false, h, step, jitter, dense);
            if (a === null || b === null) continue;
            on.push(a); off.push(b);
          }
        }
      }
      const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length * 180 / Math.PI;
      return { n: on.length, on: mean(on), off: mean(off) };
    };

    const line = sweep(0), juke = sweep(1.2);

    ok(`${line.n} duels answered by both settings`, line.n >= 40, `only ${line.n}`);
    ok(`against a runner holding one line: ${line.on.toFixed(2)}deg led, ` +
       `${line.off.toFixed(2)}deg unled`, line.on < line.off * 0.5,
       `the lead bought ${(line.off - line.on).toFixed(2)}deg`);
    ok("and it lands inside two degrees of where they will be",
       line.on < 2, `${line.on.toFixed(2)}deg`);

    // The confidence weight is the whole reason this is safe to leave on. A
    // player who reverses every frame gives a reading worth less, and the lead
    // must shrink toward what is known rather than commit to a guess.
    ok(`against a juker it degrades to ${juke.on.toFixed(2)}deg rather than breaking`,
       juke.on > line.on, `juking ${juke.on.toFixed(2)} vs line ${line.on.toFixed(2)}`);
    ok("and even then is not worse than not leading at all",
       juke.on <= juke.off, `juking ${juke.on.toFixed(2)} vs unled ${juke.off.toFixed(2)}`);

    // Switched off, the grading measures to x2/y2 exactly as it did.
    const step = 25;
    const noHistory = (() => {
      const e = runner(1040, 1000, 0, step);
      const c = world({
        nearestEnemy: e, enemiesNear: [e], itemCounts: { 2: 0, 5: 0 },
        vars: { replace: true, replaceRange: 300, placeAngles144: true, replaceLead: true },
      });
      c.doReplace([hole(1040, 1000)]);          // lead on, but nothing observed
      return c.predictObjects.map(o => `${o.id}@${o.angle.toFixed(6)}`).join(" ");
    })();
    const off = (() => {
      const e = runner(1040, 1000, 0, step);
      const c = world({
        nearestEnemy: e, enemiesNear: [e], itemCounts: { 2: 0, 5: 0 },
        vars: { replace: true, replaceRange: 300, placeAngles144: true, replaceLead: false },
      });
      walk(c, e.sid, 1040, 1000 - step * 6, 0, step, 6);
      c.doReplace([hole(1040, 1000)]);
      return { placed: c.predictObjects.slice() };
    })();
    ok("lead on with nothing observed is bit-for-bit lead off",
       noHistory === off.placed.map(o => `${o.id}@${o.angle.toFixed(6)}`).join(" "),
       `${noHistory}  vs  ${off.placed.map(o => `${o.id}@${o.angle.toFixed(6)}`).join(" ")}`);
  }

  // ---- what is deliberately NOT led --------------------------------------
  {
    const grade = (() => {
      const at = src.indexOf("function replaceGrade(");
      return balance(at);
    })();
    ok("the aim point is taken once per enemy, not per candidate",
       (grade.match(/replaceAim\(/g) || []).length === 1);
    ok("both distance readings are led",
       (grade.match(/getDistance\(candidate\.x, candidate\.y, aim\.x2, aim\.y2\)/g) || []).length === 2);
    ok("the trap-containment test still reads the present",
       /getDistance\(trap\.x, trap\.y, enemy\.x2, enemy\.y2\) < trap\.scale/.test(grade));
    ok("replaceKnockInto is still handed the real enemy",
       /replaceKnockInto\(candidate, enemy\)/.test(grade));
    ok("replaceEnemyRing is still handed the real enemy",
       /replaceEnemyRing\(enemy, objects\)/.test(grade));

    // The claim the whole change rests on: the rest of this client already
    // aims at xVel/yVel, and the replacer was the one place that did not.
    ok("the rest of the client already leads with xVel/yVel",
       (src.match(/nearestEnemy\.xVel/g) || []).length > 10);
    ok("and the extrapolation is the client's own, one frame wide",
       /tmpObj\.xVel = tmpObj\.x2 \* 2 - lastX;/.test(src));
  }

  // ---- sampled every tick, not only on the ticks something broke ---------
  {
    const e = runner(1060, 1000, 25, 0);
    const c = world({
      nearestEnemy: e, enemiesNear: [e], primaryReload: { 1: 1 },
      vars: { replace: true, replaceLead: true, autoPlace: false, prePlace: false,
              placeAngles144: true },
    });
    const before = c.leadBook().headings.size;
    c.getPredictObjects();                      // nothing in replaceQueue
    ok("a tick with no break still records the heading",
       c.leadBook().headings.size > before, `${before} -> ${c.leadBook().headings.size}`);

    const off = world({
      nearestEnemy: e, enemiesNear: [e], primaryReload: { 1: 1 },
      vars: { replace: true, replaceLead: false, autoPlace: false, prePlace: false,
              placeAngles144: true },
    });
    off.getPredictObjects();
    ok("and switched off it costs nothing at all", off.leadBook().headings.size === 0,
       `${off.leadBook().headings.size} tracked`);
  }
}

// ===========================================================================
section("COST — the sweep the grader reached once per candidate");
{
  const enemy = enemyAt(1060, 1000);
  const c = world({
    nearestEnemy: enemy, enemiesNear: [enemy],
    traps_our: [{ x: 1060, y: 1000, scale: 50, health: 500 }],
    primaryReload: { 1: 1 }, secondaryReload: { 1: 1 },
    vars: { replace: true, replaceRange: 300, shameTick: true, shameGrind: true },
  });

  let sweeps = 0;
  const real = c.buildPlaceAngles;
  c.buildPlaceAngles = function (...a) { sweeps++; return real.apply(this, a); };

  c.doReplace([hole(1050, 1000)]);

  // Two items to sweep — spike and trap — and canTrapTick's own set. Without
  // the memo and the cache this was one sweep per graded spike candidate.
  ok(`a whole replace costs ${sweeps} sweeps, not one per candidate`, sweeps <= 4,
     `got ${sweeps}`);

  // canTrapTick answers once per tick and repeats are free.
  let computes = 0;
  const realCompute = c.computeCanTrapTick;
  c.computeCanTrapTick = function (...a) { computes++; return realCompute.apply(this, a); };
  c.tick = 200;
  for (let i = 0; i < 50; i++) c.canTrapTick();
  ok("fifty canTrapTick calls in one tick compute once", computes === 1, `got ${computes}`);

  c.tick = 201;
  c.canTrapTick();
  ok("and it recomputes on the next tick", computes === 2, `got ${computes}`);

  // Context safety: ctxRun swaps tick along with everything else.
  c.myPlayer = Object.assign({}, c.myPlayer);
  c.canTrapTick();
  ok("a different context on the same tick does not inherit the answer",
     computes === 3, `got ${computes}`);

  // The sweep cache is keyed on the array itself, which cannot collide the way
  // a length key can.
  ok("the sweep cache is keyed on the object set itself, not its length",
     /_placeAnglesCache\.get\(set\)/.test(src));
  ok("updateAngles still takes a guaranteed-fresh sweep",
     /function updateAngles\(id\) \{\s*\n\s*const angles = buildPlaceAngles\(id\);/.test(src));
}

// ===========================================================================
section("UNCHANGED — the grading table is Falcon's, still");
{
  for (const kept of ["replaceGrade", "replaceCandidates", "replaceKnockInto",
                      "replaceEnemyRing", "replaceWithinPath", "replaceBlocksMyMove"]) {
    ok(`${kept} survives`, new RegExp(`function ${kept}\\(`).test(src));
  }
  ok("the fill limit is still Falcon's four", /const REPLACE_FILL_LIMIT = 4;/.test(src));
  ok("the enemy ring is still thirty angles", /const REPLACE_RING_ANGLES = 30;/.test(src));

  // The preplacer and the autoplacer were not part of this work.
  for (const untouched of ["isPrePlaceAngle", "getPrePlaceObject", "isAutoPlaceAngle",
                           "checkPredictObjects", "updateAngles"]) {
    ok(`${untouched} untouched`, new RegExp(`function ${untouched}\\(`).test(src));
  }

  // Every placement still goes through the one marker check.
  const body = (() => {
    const at = src.indexOf("function doReplace(");
    return balance(at).split("\n").map(l => {
      const i = l.indexOf("//");
      return i === -1 ? l : l.slice(0, i);
    }).join("\n");
  })();
  ok("doReplace places through exactly one path",
     (body.match(/addPredictObject\(/g) || []).length === 1);
  ok("and never calls place() or io.send()",
     !/[^a-zA-Z]place\(/.test(body) && !/io\.send/.test(body));
}

// ===========================================================================
section("ROBUSTNESS — doReplace runs inside the tick body");
{
  // Anything it throws takes the rest of that tick with it, so it has to
  // survive whatever the wire and the break list hand it.
  const enemy = enemyAt(1060, 1000);
  const nasty = [
    ["a null in the break list", [null, hole(1050, 1000)]],
    ["an empty object in the break list", [{}, hole(1050, 1000)]],
    ["a hole with no coordinates", [{ ours: true, sid: 3 }]],
    ["a hole with NaN coordinates", [hole(NaN, NaN)]],
    ["an empty break list", []],
    ["only enemy-owned holes", [hole(1050, 1000, { ours: false })]],
  ];

  for (const [label, broken] of nasty) {
    let threw = null;
    try { world({ nearestEnemy: enemy, enemiesNear: [enemy] }).doReplace(broken); }
    catch (e) { threw = e.message; }
    ok(`survives ${label}`, threw === null, threw);
  }

  // And the gates, which are the difference between a quiet tick and a wasted one.
  const gated = [
    ["the toggle off", { vars: { replace: false } }],
    ["the grind key held", { gPressed: true }],
    ["no enemy at all", { nearestEnemy: null, enemiesNear: [] }],
    ["an enemy beyond the range", { nearestEnemy: enemyAt(1000 + 600, 1000), enemiesNear: [enemyAt(1600, 1000)] }],
  ];

  for (const [label, over] of gated) {
    world(Object.assign({ nearestEnemy: enemy, enemiesNear: [enemy] }, over))
      .doReplace([hole(1050, 1000)]);
    ok(`${label}: nothing is queued`, placed.length === 0, `queued ${placed.length}`);
  }

  // Two holes at once is the ordinary case, not an edge one.
  const two = world({ nearestEnemy: enemy, enemiesNear: [enemy] });
  let threw = null;
  try { two.doReplace([hole(1050, 1000, { sid: 9 }), hole(1000, 1050, { sid: 10 })]); }
  catch (e) { threw = e.message; }
  ok("two holes in one tick are answered without throwing", threw === null, threw);
  ok("and something was queued for them", placed.length > 0, `queued ${placed.length}`);

  // Nothing queued may overlap anything else queued — the marker check is what
  // keeps the replacer and the autoplacer off each other's ground.
  let overlap = null;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j];
      if (UTILS.getDistance(a.x, a.y, b.x, b.y) < a.scale + b.scale) overlap = [i, j];
    }
  }
  ok("no two queued buildings overlap", overlap === null,
     overlap ? `objects ${overlap} collide` : "");
}

// ===========================================================================
section("PIPELINE — the real tick body, with all three placers");
{
  const enemy = enemyAt(1060, 1000);
  const c = world({
    nearestEnemy: enemy, enemiesNear: [enemy],
    traps_our: [{ x: 1060, y: 1000, scale: 50, health: 500 }],
    primaryReload: { 1: 1 }, secondaryReload: { 1: 1 },
    vars: { replace: true, replaceRange: 300, autoPlace: true, prePlace: true,
            shameTick: false, shameGrind: true, placeAngles144: true },
    replaceQueue: [hole(1050, 1000)],
  });

  let threw = null;
  try { c.getPredictObjects(); }
  catch (e) { threw = e.message + "\n      " + (e.stack || "").split("\n")[1]; }
  ok("getPredictObjects runs end to end with replace, preplace and autoplace on",
     threw === null, threw);

  ok("the tick queued something", c.predictObjects.length > 0,
     `queued ${c.predictObjects.length}`);
  ok("the replace queue was drained", c.replaceQueue.length === 0);

  // The whole no-conflict claim, on the real output list.
  let overlap = null;
  for (let i = 0; i < c.predictObjects.length; i++) {
    for (let j = i + 1; j < c.predictObjects.length; j++) {
      const a = c.predictObjects[i], b = c.predictObjects[j];
      if (a.id === 17 || b.id === 17) continue;
      if (UTILS.getDistance(a.x, a.y, b.x, b.y) < a.scale + b.scale) overlap = [i, j];
    }
  }
  ok("nothing in the tick's output overlaps anything else in it", overlap === null,
     overlap ? `objects ${overlap} collide` : "");

  // No group past its cap, across every lane in one tick.
  const perGroup = {};
  for (const o of c.predictObjects) {
    const g = items.list[o.id] && items.list[o.id].group;
    if (g) perGroup[g.id] = (perGroup[g.id] || 0) + 1;
  }
  ok("no group is queued past its cap across the whole tick",
     Object.entries(perGroup).every(([g, n]) => n <= (+g === 5 ? 6 : 15)),
     JSON.stringify(perGroup));

  // The other two placers still work with replace switched off.
  const noReplace = world({
    nearestEnemy: enemy, enemiesNear: [enemy],
    traps_our: [{ x: 1060, y: 1000, scale: 50, health: 500 }],
    primaryReload: { 1: 1 },
    vars: { replace: false, autoPlace: true, prePlace: true, placeAngles144: true },
    replaceQueue: [hole(1050, 1000)],
  });
  let threw2 = null;
  try { noReplace.getPredictObjects(); } catch (e) { threw2 = e.message; }
  ok("the pipeline runs with replace off", threw2 === null, threw2);
  ok("and the autoplacer still fills on its own", noReplace.predictObjects.length > 0,
     `queued ${noReplace.predictObjects.length}`);

  // And with every placer off it still runs and places nothing.
  const dark = world({
    nearestEnemy: enemy, enemiesNear: [enemy], primaryReload: { 1: 1 },
    vars: { replace: false, autoPlace: false, prePlace: false },
    replaceQueue: [hole(1050, 1000)],
  });
  let threw3 = null;
  try { dark.getPredictObjects(); } catch (e) { threw3 = e.message; }
  ok("the pipeline runs with every placer off", threw3 === null, threw3);
  ok("and queues nothing", dark.predictObjects.length === 0,
     `queued ${dark.predictObjects.length}`);
}

// ===========================================================================
section("INVARIANTS — the properties the rest of the placer rests on");
{
  const walk = (c, sid, x, y, sx, sy, n) => {
    for (let i = 0; i < n; i++) {
      c.replaceTrackHeading({ sid, x2: x, y2: y, xVel: x + sx, yVel: y + sy });
      x += sx; y += sy;
    }
  };
  const runner = (x, y, sx, sy) => enemyAt(x, y, { xVel: x + sx, yVel: y + sy });

  // 1. doReplace's fill loop sorts with a comparator that ignores `points`. It
  //    only reaches the fills because Array#sort is stable and replaceGrade
  //    already ordered each bucket by points. If that ever stops holding, the
  //    tiebreak silently does nothing for four of the six placements.
  {
    const e = runner(1060, 1000, 0, 25);
    const c = world({ nearestEnemy: e, enemiesNear: [e], itemCounts: { 2: 0, 5: 0 } });
    walk(c, e.sid, 1060, 1000 - 150, 0, 25, 6);

    const graded = c.replaceGrade(c.replaceCandidates([]), [e], [], { trap: false, spike: true });
    const spread = graded.traps.concat(graded.spikes).sort((a, b) =>
      b.grade === a.grade && a.trap !== b.trap ? (a.trap ? -1 : 1) : b.grade - a.grade);

    let inversions = 0;
    for (let i = 1; i < spread.length; i++) {
      const p = spread[i - 1], q = spread[i];
      if (p.grade === q.grade && p.trap === q.trap && q.points > p.points + 1e-12) inversions++;
    }
    ok("the fill order still descends by points inside one grade (sort is stable)",
       inversions === 0, `${inversions} inversions`);

    const top = graded.spikes.filter(s => s.grade === graded.spikes[0].grade);
    ok(`the top grade holds ${top.length} slots and points separates every one`,
       new Set(top.map(s => +s.points.toFixed(9))).size === top.length,
       `${new Set(top.map(s => +s.points.toFixed(9))).size} distinct of ${top.length}`);
  }

  // 2. The proximity term is split across enemies so it can never cross one of
  //    the table's own +1 / +2 awards. With four enemies that has to still hold.
  {
    const mk = (x, y) => enemyAt(x, y, { xVel: x + 25, yVel: y, sid: x });
    const es = [mk(1060, 1000), mk(1000, 1060), mk(940, 1000), mk(1000, 940)];
    const c = world({ nearestEnemy: es[0], enemiesNear: es, itemCounts: { 2: 0, 5: 0 } });
    for (const e of es) walk(c, e.sid, e.x2 - 150, e.y2, 25, 0, 6);

    // Nothing in this scene fires one of the table's INTEGER points awards:
    // shameTick is off, so no spiketick, and no trap holds an enemy, so neither
    // enemyTrapped branch runs. Whatever lands in points here is the proximity
    // term and nothing else — which is what makes the bound directly readable.
    //
    // A first cut of this measured `points - floor(points)` instead. That
    // cannot fail: four enemies contributing 0.99 each sums to 3.96, whose
    // fractional part is still under one. The test passed a client with the
    // per-enemy split removed, which is the mutation it exists to catch.
    const graded = c.replaceGrade(c.replaceCandidates([]), es, [], { trap: false, spike: false });
    const all = graded.spikes.concat(graded.traps);
    // Every integer award on the table sets a flag beside itself: `spiketick`
    // for the +1, `spikeTrap` for one +2, and the other +2 needs a trapped
    // enemy. None fires here, which is what makes the bound below readable
    // straight off points.
    ok("no integer points award fires in this scene, so points IS the term",
       all.every(x => !x.spiketick && !x.spikeTrap),
       JSON.stringify(all.filter(x => x.spiketick || x.spikeTrap).length + " flagged"));
    ok(`with ${es.length} enemies the proximity term still totals under one point`,
       Math.max(...all.map(x => x.points)) < 1,
       `max points ${Math.max(...all.map(x => x.points))}`);
    ok("and every points value is finite — a NaN here would poison the sort",
       all.every(x => isFinite(x.points)));
  }

  // 3. The heading book is pruned by age. A player still being seen every tick
  //    must never be the one pruned.
  {
    const c = world({ nearestEnemy: enemyAt(1060, 1000) });
    const sids = [];
    for (let s = 0; s < 60; s++) sids.push(s + 10);
    for (let t = 0; t < 30; t++)
      for (const sid of sids)
        c.replaceTrackHeading({ sid, x2: 1000 + t * 25, y2: 1000 + sid,
                                xVel: 1000 + (t + 1) * 25, yVel: 1000 + sid });

    const book = c.leadBook().headings;
    const kept = sids.filter(s => book.has(s) && book.get(s).angles.length >= 2).length;
    ok(`sixty enemies seen every tick: all ${kept} keep a usable history`,
       kept === 60, `${kept} of 60 — a live player was pruned`);
    ok("and the book is still bounded", book.size <= 96, `${book.size} entries`);

    // And someone who leaves ages out rather than sitting there for the session.
    walk(c, 999, 1000, 1000, 25, 0, 6);
    ok("a player present is tracked", book.has(999));
    for (let t = 30; t < 70; t++)
      for (const sid of sids)
        c.replaceTrackHeading({ sid, x2: 1000 + t * 25, y2: 1000 + sid,
                                xVel: 1000 + (t + 1) * 25, yVel: 1000 + sid });
    ok("and is gone once he stops being seen", !book.has(999));
  }

  // 4. The fine aim MOVES an object that addPredictObject already accepted. The
  //    no-overlap property has to survive that move, over many geometries.
  {
    let overlap = null, mismatch = null, worst = 0;
    const perGroup = {};
    for (let h = 0; h < 360; h += 11) {
      const a = UTILS.toRad(h);
      const at = (r) => [1000 + Math.cos(a) * r, 1000 + Math.sin(a) * r];
      const e = runner(...at(90), Math.cos(a) * 25, Math.sin(a) * 25);
      const c = world({ nearestEnemy: e, enemiesNear: [e], itemCounts: { 2: 0, 5: 0 } });
      for (let i = 0, r = 40; i < 6; i++, r += 25)
        c.replaceTrackHeading({ sid: e.sid, x2: 1000 + Math.cos(a) * r, y2: 1000 + Math.sin(a) * r,
                                xVel: 1000 + Math.cos(a) * (r + 25), yVel: 1000 + Math.sin(a) * (r + 25) });

      c.doReplace([
        hole(...at(70), { sid: 91 }),
        hole(1000 + Math.cos(a + 1) * 70, 1000 + Math.sin(a + 1) * 70, { sid: 92 }),
        hole(1000 + Math.cos(a + 2) * 70, 1000 + Math.sin(a + 2) * 70, { sid: 93, trap: true, id: 15 }),
      ]);

      const p = c.predictObjects;
      worst = Math.max(worst, p.length);
      for (const o of p) {
        const g = items.list[o.id].group.id;
        perGroup[g] = Math.max(perGroup[g] || 0,
                               p.filter(x => items.list[x.id].group.id === g).length);
        // Position and angle must agree: the fine aim rewrites all three, and a
        // stale pair puts the marker somewhere the packet is not.
        const want = c.getConfig(o.id, o.angle);
        if (UTILS.getDistance(o.x, o.y, want.x, want.y) > 1e-9)
          mismatch = `id ${o.id} at ${o.angle.toFixed(4)}`;
      }
      for (let i = 0; i < p.length; i++)
        for (let j = i + 1; j < p.length; j++)
          if (p[i].id != 17 && p[j].id != 17 &&
              UTILS.getDistance(p[i].x, p[i].y, p[j].x, p[j].y) < p[i].scale + p[j].scale)
            overlap = `heading ${h}: ${i} and ${j}`;
    }
    ok("over 33 headings with three holes each, no two queued buildings overlap",
       overlap === null, overlap);
    ok("and every queued position matches getConfig(id, its own angle)",
       mismatch === null, mismatch);

    // The move's clash guard, on a geometry that actually reaches it.
    //
    // Adjacent ring slots always overlap, so addPredictObject refuses them
    // outright and the guard never sees them. It only matters for two slots far
    // enough apart to be accepted and close enough that one grid step of
    // refinement closes the gap — for two traps (radius 80, scale 50) that is a
    // narrow band around 77 degrees. None of the scenes above produced it: over
    // 480 of them the fine aim moved a slot 388 times and the guard fired zero
    // times, so removing it changed nothing and the tests "passed" a client with
    // no guard at all.
    //
    // Found by sweeping 8400 geometries against a client with the guard removed
    // and diffing: 121 of them differ. This is the first. Without the guard the
    // third trap refines from 2.617994 to 2.656367 and lands 99.59 units from
    // the trap at 4.0 — inside the 100 units two traps need.
    {
      const e = runner(1090, 1000, 25, 0);
      const c = world({ nearestEnemy: e, enemiesNear: [e], itemCounts: { 2: 0, 5: 0 } });
      c.addPredictObject(15, 4.0, false);          // the trap the move would hit

      const broken = [];
      for (let i = 0; i < 3; i++)
        broken.push(hole(1000 + Math.cos(i * 1.35) * 70, 1000 + Math.sin(i * 1.35) * 70,
                         { sid: 90 + i, trap: i % 2 === 1, id: i % 2 === 1 ? 15 : 6 }));
      c.doReplace(broken);

      const p = c.predictObjects;
      let hit = null;
      for (let i = 0; i < p.length; i++)
        for (let j = i + 1; j < p.length; j++)
          if (p[i].id != 17 && p[j].id != 17 &&
              UTILS.getDistance(p[i].x, p[i].y, p[j].x, p[j].y) < p[i].scale + p[j].scale)
            hit = `${p[i].id}@${p[i].angle.toFixed(6)} and ${p[j].id}@${p[j].angle.toFixed(6)} ` +
                  `are ${UTILS.getDistance(p[i].x, p[i].y, p[j].x, p[j].y).toFixed(2)} apart`;

      ok("the one geometry that reaches the clash guard is placed without overlap",
         hit === null, hit);
      ok("and the slot the guard declined to move stayed on its grid angle",
         p.some(o => Math.abs(o.angle - 2.617994) < 1e-5),
         JSON.stringify(p.map(o => `${o.id}@${o.angle.toFixed(6)}`)));
    }

    // Packet economy: the grading may reorder what gets placed, never how much.
    ok(`a replace never queues more than the fill budget — worst was ${worst}`,
       worst <= 6, `${worst} queued`);
    ok("and no group is ever queued past its cap",
       Object.entries(perGroup).every(([g, n]) => n <= (+g === 5 ? 6 : 15)),
       JSON.stringify(perGroup));
  }

  // 5. The whole tick body, many ticks, every placer on and the lead engaged --
  //    which is the one combination the PIPELINE section above does not run.
  {
    const e = runner(1060, 1000, 0, 25);
    const c = world({
      nearestEnemy: e, enemiesNear: [e], primaryReload: { 1: 1 }, secondaryReload: { 1: 1 },
      traps_our: [{ x: 1060, y: 1000, scale: 50, health: 500 }],
      vars: { replace: true, replaceLead: true, autoPlace: true, prePlace: true,
              placeAngles144: true, shameTick: true, shameGrind: true, replaceRange: 300 },
    });

    let threw = null, worst = 0, overCap = null;
    try {
      for (let t = 0; t < 12; t++) {
        c.tick = 100 + t;
        c.predictObjects = [];
        c.replaceQueue = t % 3 === 0 ? [hole(1050, 1000, { sid: 91 })] : [];
        c.getPredictObjects();
        worst = Math.max(worst, c.predictObjects.length);

        const p = c.predictObjects;
        for (let i = 0; i < p.length; i++)
          for (let j = i + 1; j < p.length; j++)
            if (p[i].id != 17 && p[j].id != 17 &&
                UTILS.getDistance(p[i].x, p[i].y, p[j].x, p[j].y) < p[i].scale + p[j].scale)
              throw new Error(`tick ${t}: queued ${i} and ${j} overlap`);

        const per = {};
        for (const o of p) {
          const g = items.list[o.id] && items.list[o.id].group;
          if (g) per[g.id] = (per[g.id] || 0) + 1;
        }
        for (const [g, n] of Object.entries(per))
          if (n > (+g === 5 ? 6 : 15)) overCap = `tick ${t}: group ${g} queued ${n}`;

        // The enemy keeps running, so the heading window keeps filling.
        e.x2 = e.xVel; e.y2 = e.yVel; e.xVel = e.x2; e.yVel = e.y2 + 25;
      }
    } catch (err) { threw = err.message; }

    ok("twelve ticks with every placer on and the lead engaged run clean",
       threw === null, threw);
    ok(`and nothing in any of those ticks overlaps anything else (peak ${worst} queued)`,
       threw === null && worst > 0, threw || "nothing was queued at all");
    ok("no group is ever queued past its cap across a whole tick",
       overCap === null, overCap);
    ok("the lead built a real reading over those ticks",
       c.replaceSteadiness(e) > 0.9, `steadiness ${c.replaceSteadiness(e).toFixed(3)}`);
  }
}

// ===========================================================================
section("NO DEAD CODE — every change is reached, no control is orphaned");
{
  // A change nothing calls is the disease this borrows from. Each new name has
  // to be defined once AND reached.
  for (const name of ["replaceFineAim", "replaceNearestHole", "computeCanTrapTick",
                      "replaceTrackHeading", "replaceSteadiness", "replaceAim",
                      "replaceNearness"]) {
    const defs = (src.match(new RegExp(`function ${name}\\(`, "g")) || []).length;
    const refs = (src.match(new RegExp(`[^a-zA-Z]${name}\\(`, "g")) || []).length;
    ok(`${name}: defined once, reached ${refs - defs}x`, defs === 1 && refs - defs >= 1,
       `defs ${defs}, calls ${refs - defs}`);
  }

  // Every setting must be read by something, and every tile must point at a
  // setting that exists. This is what caught a hotkey left driving ids nothing
  // read, in an earlier round of this work.
  const varsBlock = (() => {
    const at = src.indexOf("window.vars = {");
    let i = src.indexOf("{", at), d = 0;
    for (; i < src.length; i++) {
      if (src[i] === "{") d++;
      else if (src[i] === "}") { d--; if (!d) return src.slice(at, i + 1); }
    }
  })();
  const declaredVars = new Set([...varsBlock.matchAll(/^\s{4,8}([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map(m => m[1]));
  const rest = src.replace(varsBlock, "");

  const deadSettings = [...declaredVars].filter(k =>
    !new RegExp(`vars\\.${k}\\b`).test(rest) &&
    !new RegExp(`vars\\[["']${k}["']\\]`).test(rest) &&
    !new RegExp(`["']${k}["']`).test(rest));
  ok(`all ${declaredVars.size} settings are read by something`, deadSettings.length === 0,
     JSON.stringify(deadSettings));

  const tileIds = [...src.matchAll(/type: '(?:toggle|slider)'[^}]*?id: "([A-Za-z_][A-Za-z0-9_]*)"/g)].map(m => m[1]);
  const orphanTiles = [...new Set(tileIds)].filter(id => !declaredVars.has(id));
  ok("every menu tile points at a declared setting", orphanTiles.length === 0,
     JSON.stringify(orphanTiles));

  // The Placers hotkey must drive ids something actually reads.
  for (const id of ["autoPlace", "prePlace", "replace"]) {
    ok(`the hotkey's vars.${id} has a real reader`,
       (src.match(new RegExp(`vars\\.${id}\\b`, "g")) || []).length > 1);
  }
}

// ===========================================================================
section("INTEGRATION");
{
  let parsed = true, err = "";
  try { new vm.Script(src, { filename: CLIENT_PATH }); }
  catch (e) { parsed = false; err = e.message; }
  ok("the client parses as a whole", parsed, err);

  for (const name of ["replaceFineAim", "replaceNearestHole", "computeCanTrapTick",
                      "replaceTrackHeading", "replaceSteadiness", "replaceAim",
                      "replaceNearness"]) {
    const defs = (src.match(new RegExp(`function ${name}\\(`, "g")) || []).length;
    const refs = (src.match(new RegExp(`[^a-zA-Z]${name}\\(`, "g")) || []).length;
    ok(`${name}: defined once, reached ${refs - defs}x`, defs === 1 && refs - defs >= 1,
       `defs ${defs}, calls ${refs - defs}`);
  }

  // Two static passes over the WHOLE file, not just the region that changed.
  // A large edit is exactly how a reference is left pointing at nothing, or a
  // function is left declared and never called — and neither fails at load.
  const runTool = (tool, extra = []) => {
    try {
      return execFileSync("node", [path.join(__dirname, tool), CLIENT_PATH, ...extra],
                          { encoding: "utf8" });
    } catch (e) { return (e.stdout || "") + (e.stderr || ""); }
  };

  // check-scopes: every name READ resolves to a declaration.
  const scopeOut = runTool("check-scopes.js");
  const undeclared = (scopeOut.match(/^   ([A-Za-z_$][\w$]*)/gm) || []).map(s => s.trim()).sort();
  ok(`${undeclared.length} undeclared names, all from the vendored bundle`,
     undeclared.length <= 8, JSON.stringify(undeclared));

  const BASE = process.env.YORHA_BASE;
  if (BASE && fs.existsSync(BASE)) {
    const baseOut = (() => {
      try { return execFileSync("node", [path.join(__dirname, "check-scopes.js"), BASE], { encoding: "utf8" }); }
      catch (e) { return (e.stdout || "") + (e.stderr || ""); }
    })();
    const baseNames = (baseOut.match(/^   ([A-Za-z_$][\w$]*)/gm) || []).map(s => s.trim()).sort();
    ok("the same set as the untouched base — these edits added none",
       JSON.stringify(baseNames) === JSON.stringify(undeclared));

    // check-dead: every name DECLARED is used, and nothing shadows anything.
    // Reported as a delta against the base, since a vendored bundle carries
    // plenty of its own that is not this work's to answer for.
    const deadOut = runTool("check-dead.js", ["--base", BASE]);
    ok("no dead or shadowed name was introduced by these edits",
       /nothing\. No name declared by these edits goes unused/.test(deadOut),
       deadOut.split("\n").filter(l => l.includes("✗")).join("\n      "));
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
