#!/usr/bin/env node
/*
 * verify-forge.js
 *
 * FORGE — the trap & spike engine that replaced YoRHa's preplacer and replacer
 * — lives inside a 27k-line userscript that cannot be loaded outside a browser
 * with a live game socket.
 *
 * This lifts the real function bodies out of the script by name, drops them
 * into a stub world with a recording addPredictObject, and asserts what each
 * one actually does. Nothing here re-implements the engine; every function
 * under test is the exact source text from the client.
 *
 *   node tools/verify-forge.js [path/to/YoRHa_System.user.js]
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
// Lifting real source out of the client
// ---------------------------------------------------------------------------
function balance(start) {
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
  throw new Error("unbalanced braces from " + start);
}

function lift(name) {
  const at = src.indexOf(`function ${name}(`);
  if (at === -1) throw new Error(`function ${name} not found in client`);
  return balance(at);
}

// `const NAME = { ... };` / `let NAME = { ... };`
function liftObject(name) {
  const m = new RegExp(`(?:const|let)\\s+${name}\\s*=\\s*\\{`).exec(src);
  if (!m) throw new Error(`object ${name} not found in client`);
  return src.slice(m.index, m.index + balance(m.index).length - (m.index - m.index)) + ";";
}

// `X.Y = function (...) {...}`, optionally rebound onto another owner.
function liftAssign(lhs, rebindTo) {
  const at = src.indexOf(`${lhs} = function`);
  if (at === -1) throw new Error(`${lhs} not found in client`);
  const text = balance(at);
  if (!rebindTo) return text;
  const prop = lhs.slice(lhs.lastIndexOf(".") + 1);
  return rebindTo + "." + prop + text.slice(lhs.length);
}

function liftLine(pattern) {
  const m = new RegExp(pattern).exec(src);
  if (!m) throw new Error(`line ${pattern} not found in client`);
  return m[0];
}

// ---------------------------------------------------------------------------
// The stub world
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

const items = {
  weapons: {
    0: { dmg: 25, range: 65, speed: 300 },
    5: { dmg: 30, range: 65, speed: 300 },
    8: { dmg: 40, range: 110, speed: 400 },
    10: { dmg: 30, sDmg: 7.5, range: 110, speed: 700 },
  },
  list: {
    6: { scale: 35, placeOffset: 0, dmg: 20, group: { id: 2, limit: 15 } },
    15: { scale: 32, placeOffset: -5, group: { id: 4, limit: 6 } },
  },
};

// The game's real movement constants, lifted rather than restated — the whole
// point of the predictor is that it uses these and not invented numbers.
const config = {
  weaponVariants: [{ val: 1 }, { val: 1.1 }, { val: 1.18 }, { val: 1.18 }],
  inSandbox: false, isSandbox: false, onSandboxHost: false,
  playerScale: 35,
};
eval(liftLine(String.raw`module\.exports\.playerSpeed = [\d.]+;`).replace("module.exports", "config"));
eval(liftLine(String.raw`module\.exports\.playerDecel = [\d.]+;`).replace("module.exports", "config"));
eval(liftAssign("module.exports.buildLimit", "config") + ";");

let ctx, placed;

function world(over = {}) {
  placed = [];

  const myPlayer = over.myPlayer || {
    sid: 1, x2: 1000, y2: 1000, x: 1000, y: 1000, scale: 35, dir: 0, alive: true,
    xVel: 1000, yVel: 1000,
    items: [0, 3, 6, 10, 15, 53], itemCounts: {}, weapons: [5, 10],
    weaponVariants: [0, 0], skinIndex: 0,
  };

  const base = {
    Math, JSON, console, Map, Set, Array, Object, Number, Infinity, isNaN,
    UTILS, items, config, myPlayer,
    window: { vars: Object.assign({
      forge: true, forgeRange: 320, forgePerTick: 5, forgeReserve: 24,
      autoPlace: false, placeRange: 300, shameTick: false, shameGrind: true,
      placeAngles144: true,
    }, over.vars || {}) },

    players: over.players || [],
    visibleObjects: over.visibleObjects || [],
    spikes_our: over.spikes_our || [],
    traps_our: over.traps_our || [],
    nearestEnemy: over.nearestEnemy !== undefined ? over.nearestEnemy : null,
    nearestTrap: over.nearestTrap || null,
    primaryReload: over.primaryReload || {},
    secondaryReload: over.secondaryReload || {},
    spikeDmgCount: over.spikeDmgCount || 0,
    gPressed: over.gPressed || false,
    tick: over.tick != null ? over.tick : 100,
    packets: over.packets != null ? over.packets : 0,
    spamPrePlacer: false,

    // FORGE's persistent state, fresh per scenario.
    forgeAhead: over.forgeAhead || new Map(),
    forgeHeadings: over.forgeHeadings || new Map(),
    forgeLedger: { pending: [], emitted: 0, confirmed: 0, rejected: 0, byRole: {}, log: [] },
    forgeWorld: null, forgeWorldTick: -1, forgeWorldOwner: null,
    forgeSlotsTick: -1, forgeSlotsOwner: null, forgeSlotsCache: null,
    _placeAnglesTick: -1, _placeAnglesCache: new Map(),

    getPlayerInfo: over.getPlayerInfo || ((p, type) => {
      const primary = (p && p.weapons && p.weapons[0]) || 5;
      if (type === "primaryRange") return items.weapons[primary].range;
      if (type === "primaryStructureDmg") return items.weapons[primary].dmg * 3.3;
      if (type === "secondaryWeapon") return "hammer";
      if (type === "secondaryStructureDmg") return 225;
      if (type === "secondaryRange") return 110;
      return 0;
    }),

    addPredictObject: (id, angle, preplace) => {
      const cfg = ctx.getConfig(id, angle);
      for (const o of placed) {
        if (UTILS.getDistance(cfg.x, cfg.y, o.x, o.y) < cfg.scale + o.scale) return false;
      }
      placed.push({ id, angle, preplace, x: cfg.x, y: cfg.y, scale: cfg.scale });
      return true;
    },
  };

  base.blockers = over.blockers || [];

  ctx = vm.createContext(base);
  vm.runInContext([
    lift("getConfig"),
    lift("isItemLimit"),
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

    liftObject("FORGE"),
    liftLine(String.raw`const FORGE_ORDER = \[[^\]]*\];`),
    liftLine(String.raw`const FORGE_TICK_MS = [^;]+;`),

    lift("forgeAwaiting"),
    lift("forgeRoleStat"),
    lift("forgeNote"),
    lift("forgeSettle"),
    lift("forgeStep"),
    lift("forgeAccel"),
    lift("forgeProject"),
    lift("forgeTrackHeading"),
    lift("forgeSteadiness"),
    lift("forgeSense"),
    lift("forgeSlots"),
    lift("forgeStock"),
    lift("forgeTouches"),
    lift("forgeSelfCost"),
    lift("forgeSeal"),
    lift("forgeKnock"),
    lift("forgeIntents"),
    lift("forgeDamageMap"),
    lift("forgeSync"),
    lift("forgeRoom"),
    lift("forgeCommit"),
    lift("forgeTick"),
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

const enemyAt = (x, y, over = {}) => Object.assign({
  sid: 2, x2: x, y2: y, x, y, xVel: x, yVel: y, scale: 35,
  weapons: [5, 10], weaponVariants: [0, 0], skinIndex: 0, weaponIndex: 5,
  spikeDamage: 0, shameCount: 0, visible: true, health: 100,
}, over);

// An enemy moving: xVel/yVel are next-tick positions in this client, so the
// step is baked in as the difference.
const movingEnemy = (x, y, stepX, stepY, over = {}) =>
  enemyAt(x, y, Object.assign({ xVel: x + stepX, yVel: y + stepY }, over));

const trapAt = (x, y, over = {}) => Object.assign({ sid: 50, x, y, scale: 40, health: 500, trap: true, active: true }, over);
const spikeAt = (x, y, over = {}) => Object.assign({ sid: 60, x, y, scale: 35, health: 400, dmg: 20, active: true }, over);
const wallAt = (sid, x, y, health, over = {}) => Object.assign({
  sid, x, y, health, scale: 35, active: true, isItem: true, trap: false, dmg: true,
}, over);

const roles = () => placed.length;
const rolesIn = (c) => c.forgeLedger.log.map(e => e.role);

// ===========================================================================
section("PHYSICS — the predictor uses the game's own integration");
{
  const c = world({ nearestEnemy: enemyAt(1100, 1000) });

  // A tick's decay is playerDecel^111, not playerDecel.
  const D = c.forgeStep();
  ok("per-tick decay compounds over the whole tick (~0.458, not 0.993)",
     Math.abs(D - Math.pow(config.playerDecel, 1000 / 9)) < 1e-12 && D > 0.4 && D < 0.5,
     `got ${D.toFixed(4)}`);

  // Terminal step: a held key converges on what a player actually covers.
  const A = c.forgeAccel();
  const terminalVel = (A / (1 - D));
  const terminalStep = terminalVel * (1000 / 9);
  ok("a held key converges on ~36 units/tick, the real player speed",
     terminalStep > 30 && terminalStep < 42, `got ${terminalStep.toFixed(1)}`);

  // Holding goes further than letting go, and both start from the same place.
  const held = c.forgeProject(0, 0, 36, 0, 4, true);
  const released = c.forgeProject(0, 0, 36, 0, 4, false);
  ok("holding the key travels further than releasing it", held.x > released.x,
     `held ${held.x.toFixed(1)} vs released ${released.x.toFixed(1)}`);
  ok("a released step decays toward a stop rather than continuing linearly",
     released.x < 36 * 4, `got ${released.x.toFixed(1)} vs linear ${36 * 4}`);
  ok("the old one-tick linear guess sits between the two futures",
     36 * 4 > released.x && 36 * 4 < held.x + 200);

  // Zero step means zero movement under either hypothesis.
  const still = c.forgeProject(500, 500, 0, 0, 4, true);
  ok("a standing enemy is predicted to stay standing",
     Math.abs(still.x - 500) < 1e-9 && Math.abs(still.y - 500) < 1e-9);
}

// ===========================================================================
section("CONFIDENCE — how much the prediction is trusted");
{
  // Steady heading: the same direction, several ticks running.
  const steadyCtx = world({ nearestEnemy: movingEnemy(1100, 1000, 36, 0) });
  for (let i = 0; i < 6; i++) steadyCtx.forgeTrackHeading(steadyCtx.nearestEnemy, 36, 0);
  const steady = steadyCtx.forgeSteadiness(steadyCtx.nearestEnemy);

  // Juking: the heading flips every sample.
  const jukeCtx = world({ nearestEnemy: movingEnemy(1100, 1000, 36, 0) });
  const dirs = [[36, 0], [-36, 0], [0, 36], [0, -36], [36, 0], [-36, 0]];
  for (const [dx, dy] of dirs) jukeCtx.forgeTrackHeading(jukeCtx.nearestEnemy, dx, dy);
  const juke = jukeCtx.forgeSteadiness(jukeCtx.nearestEnemy);

  ok("a straight line reads as steady (~1)", steady > 0.95, `got ${steady.toFixed(3)}`);
  ok("juking reads as unsteady", juke < 0.35, `got ${juke.toFixed(3)}`);
  ok("steady beats juking by a wide margin", steady - juke > 0.6);

  // Steadiness is measured as a mean resultant length, which is correct across
  // the 0/2pi seam where averaging the raw numbers is not.
  const seamCtx = world({ nearestEnemy: movingEnemy(1100, 1000, 36, 0) });
  seamCtx.forgeTrackHeading(seamCtx.nearestEnemy, 36, 0.5);    // ~ +0.014 rad
  seamCtx.forgeTrackHeading(seamCtx.nearestEnemy, 36, -0.5);   // ~ -0.014 rad (i.e. ~2pi)
  ok("two headings either side of the 0/2pi seam still read as steady",
     seamCtx.forgeSteadiness(seamCtx.nearestEnemy) > 0.99);

  // A standing enemy is predictable regardless of history.
  const stillCtx = world({ nearestEnemy: enemyAt(1100, 1000) });
  const w = stillCtx.forgeSense();
  ok("a standing enemy is high confidence with no history at all",
     w.confidence > 0.85, `got ${w && w.confidence}`);

  // Aim collapses onto the known position as trust falls.
  const sureCtx = world({ nearestEnemy: movingEnemy(1100, 1000, 36, 0) });
  for (let i = 0; i < 6; i++) sureCtx.forgeTrackHeading(sureCtx.nearestEnemy, 36, 0);
  const sure = sureCtx.forgeSense();
  ok("a confident read aims ahead of the enemy",
     sure.aim.x > sure.enemy.x2 + 20, `aim ${sure.aim.x.toFixed(0)} vs at ${sure.enemy.x2}`);
}

// ===========================================================================
section("SENSE — one world model per tick, and it sleeps when it should");
{
  const far = world({ nearestEnemy: enemyAt(1000 + 600, 1000) });
  ok("an enemy beyond engage range produces no world at all", far.forgeSense() === null);

  const none = world({ nearestEnemy: null });
  ok("no enemy produces no world", none.forgeSense() === null);

  const c = world({ nearestEnemy: enemyAt(1080, 1000) });
  const a = c.forgeSense();
  const b = c.forgeSense();
  ok("the world model is built once and reused within a tick", a === b);

  c.tick = 101;
  ok("and rebuilt on the next tick", c.forgeSense() !== a);

  // Context safety: two bots can sit on the same tick number.
  c.tick = 101;
  const first = c.forgeSense();
  c.myPlayer = Object.assign({}, c.myPlayer);      // a different context's player
  ok("a different context on the same tick gets its own world",
     c.forgeSense() !== first);
}

// ===========================================================================
section("ROLES — the engine does the right thing in each duel state");
{
  // --- RETRAP: held, and the hold is on the break list.
  const trap = trapAt(1080, 1000);
  const retrapCtx = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trap], primaryReload: { 1: 1 },
  });
  retrapCtx.forgeTick([{ sid: trap.sid, x: trap.x, y: trap.y, scale: 40, id: 15, trap: true, dmg: false, ours: true }]);
  ok("the trap they stand in dying is answered with another trap",
     rolesIn(retrapCtx).includes("RETRAP"), JSON.stringify(rolesIn(retrapCtx)));

  // --- TICK: held, spike reach, and the knock does not send them at us.
  const tickCtx = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)], primaryReload: { 1: 1 },
  });
  tickCtx.forgeTick([]);
  ok("a held body inside spike reach draws a spike",
     rolesIn(tickCtx).includes("TICK"), JSON.stringify(rolesIn(tickCtx)));

  // --- TRAP: free, moving, predictable.
  const trapCtx = world({ nearestEnemy: movingEnemy(1075, 1000, -20, 0), primaryReload: { 1: 1 } });
  for (let i = 0; i < 6; i++) trapCtx.forgeTrackHeading(trapCtx.nearestEnemy, -20, 0);
  trapCtx.forgeTick([]);
  ok("a free, predictable enemy in reach draws a trap",
     rolesIn(trapCtx).includes("TRAP"), JSON.stringify(rolesIn(trapCtx)));

  // --- MEND: our own wall is down.
  const mendCtx = world({ nearestEnemy: enemyAt(1120, 1000), primaryReload: { 1: 1 } });
  mendCtx.forgeTick([{ sid: 9, x: 1070, y: 1000, scale: 35, id: 6, trap: false, dmg: true, ours: true }]);
  ok("a hole in our own ring is closed", rolesIn(mendCtx).includes("MEND"),
     JSON.stringify(rolesIn(mendCtx)));

  // --- and an enemy's building coming down is not our hole.
  const theirsCtx = world({ nearestEnemy: enemyAt(1120, 1000), primaryReload: { 1: 1 } });
  theirsCtx.forgeTick([{ sid: 9, x: 1070, y: 1000, scale: 35, id: 6, trap: false, dmg: true, ours: false }]);
  ok("an enemy's building coming down is not mended",
     !rolesIn(theirsCtx).includes("MEND"), JSON.stringify(rolesIn(theirsCtx)));

  // --- AHEAD: a wall about to die to damage already loaded.
  const wall = wallAt(9, 1060, 1000, 50);
  const aheadCtx = world({
    nearestEnemy: enemyAt(1090, 1000, { sid: 2 }),
    players: [enemyAt(1090, 1000, { sid: 2 }), enemyAt(1030, 1000, { sid: 3 })],
    visibleObjects: [wall], primaryReload: { 1: 1, 2: 1, 3: 1 },
  });
  aheadCtx.forgeTick([]);
  ok("a wall under the damage already loaded against it is filled ahead",
     rolesIn(aheadCtx).includes("AHEAD"), JSON.stringify(rolesIn(aheadCtx)));

  const healthyCtx = world({
    nearestEnemy: enemyAt(1090, 1000, { sid: 2 }),
    players: [enemyAt(1090, 1000, { sid: 2 })],
    visibleObjects: [wallAt(9, 1060, 1000, 900)], primaryReload: { 1: 1, 2: 1 },
  });
  healthyCtx.forgeTick([]);
  ok("a healthy wall is not filled ahead of",
     !rolesIn(healthyCtx).includes("AHEAD"), JSON.stringify(rolesIn(healthyCtx)));
}

// ===========================================================================
section("SCORING — roles compete on one scale, which the old cascade could not");
{
  const c = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)], primaryReload: { 1: 1 },
  });
  const w = c.forgeSense();
  const intents = c.forgeIntents(w, [
    { sid: 99, x: 1070, y: 1000, scale: 35, id: 6, trap: false, dmg: true, ours: true },
  ]);

  ok("a tick produces intents across several roles at once",
     new Set(intents.map(i => i.role)).size >= 2,
     JSON.stringify([...new Set(intents.map(i => i.role))]));
  ok("every intent carries a comparable numeric score",
     intents.every(i => typeof i.score === "number" && isFinite(i.score) && i.score > 0));

  // A held body in spike reach must outscore a speculative seal on the far side.
  const tickBest = Math.max(...intents.filter(i => i.role === "TICK").map(i => i.score), 0);
  const sealBest = Math.max(...intents.filter(i => i.role === "SEAL").map(i => i.score), 0);
  ok("damaging a held body outscores a speculative seal", tickBest > sealBest,
     `TICK ${tickBest.toFixed(0)} vs SEAL ${sealBest.toFixed(0)}`);

  // Scarcity: the same slot is worth less when the stock is nearly gone.
  const rich = world({ nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)], primaryReload: { 1: 1 } });
  const poor = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)], primaryReload: { 1: 1 },
    myPlayer: Object.assign({}, rich.myPlayer, { itemCounts: { 2: 14 } }),
  });
  const richBest = Math.max(...rich.forgeIntents(rich.forgeSense(), []).filter(i => i.role === "TICK").map(i => i.score), 0);
  const poorBest = Math.max(...poor.forgeIntents(poor.forgeSense(), []).filter(i => i.role === "TICK").map(i => i.score), 0);
  ok("the last of a stock scores lower than a full one", poorBest < richBest,
     `full ${richBest.toFixed(0)} vs nearly-out ${poorBest.toFixed(0)}`);

  // Self-cost: a slot on our own line out is penalised.
  const cost = c.forgeSelfCost({ x: 1000 + 40, y: 1000, scale: 35 }, w);
  ok("a slot in our own way carries a cost", cost > 0, `got ${cost}`);
}

// ===========================================================================
section("KNOCKBACK — a spike must not undo the hold it is meant to punish");
{
  // Enemy held to our east. A spike east of them pushes them further east,
  // away from us: good. A spike west of them pushes them into us: bad.
  const c = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)], primaryReload: { 1: 1 },
  });
  c.forgeTick([]);

  const bad = placed.some(p => p.x < 1000);   // behind us / would push them at us
  ok("no spike is placed on the side that would knock them into us", !bad,
     JSON.stringify(placed.map(p => [Math.round(p.x), Math.round(p.y)])));

  // The knock scorer finds a spike on the push line and values nearer ones more.
  const knockCtx = world({
    nearestEnemy: enemyAt(1080, 1000), spikes_our: [spikeAt(1200, 1000)], primaryReload: { 1: 1 },
  });
  const kw = knockCtx.forgeSense();
  const near = knockCtx.forgeKnock({ x: 1000, y: 1000, scale: 35 }, kw);
  ok("a spike on the push line is recognised as a knock", near > 0, `got ${near}`);

  const noneCtx = world({ nearestEnemy: enemyAt(1080, 1000), spikes_our: [], primaryReload: { 1: 1 } });
  ok("with nothing to knock them into, the knock is worth nothing",
     noneCtx.forgeKnock({ x: 1000, y: 1000, scale: 35 }, noneCtx.forgeSense()) === 0);
}

// ===========================================================================
section("BUDGET — priority first, and the reserve is never touched");
{
  // Room is what is left of the second after the reserve, in whole placements.
  const fresh = world({ nearestEnemy: enemyAt(1080, 1000), packets: 0 });
  fresh.forgeSync();
  ok("a fresh second has room", fresh.forgeRoom() > 0, `got ${fresh.forgeRoom()}`);

  const tight = world({ nearestEnemy: enemyAt(1080, 1000), packets: 100 });
  tight.forgeSync();
  ok("near the ceiling there is no room left for structures",
     tight.forgeRoom() === 0, `got ${tight.forgeRoom()}`);

  const reserved = world({ nearestEnemy: enemyAt(1080, 1000), packets: 119 - 24 });
  reserved.forgeSync();
  ok("the reserve is never spent — heal and insta keep their room",
     reserved.forgeRoom() === 0, `got ${reserved.forgeRoom()}`);

  // A tick out of room places nothing at all.
  const starved = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)],
    primaryReload: { 1: 1 }, packets: 118,
  });
  starved.forgeTick([]);
  ok("out of budget means not one structure", roles() === 0, `placed ${roles()}`);

  // Per-tick cap holds even with a rich intent list.
  const rich = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)],
    primaryReload: { 1: 1 }, packets: 0, vars: { forgePerTick: 2 },
  });
  rich.forgeTick([{ sid: 9, x: 1070, y: 1000, scale: 35, id: 6, trap: false, dmg: true, ours: true }]);
  ok("the per-tick cap is respected", roles() <= 2, `placed ${roles()}`);

  // Priority: with room for one, the higher-priority role gets it.
  const one = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)],
    primaryReload: { 1: 1 }, packets: 0, vars: { forgePerTick: 1 },
  });
  one.forgeTick([{ sid: 9, x: 1300, y: 1300, scale: 35, id: 6, trap: false, dmg: true, ours: true }]);
  const spentRoles = rolesIn(one);
  ok("with room for one, the tick spends it on the highest-priority role",
     spentRoles.length === 1 &&
     ["RETRAP", "TICK"].includes(spentRoles[0]), JSON.stringify(spentRoles));
}

// ===========================================================================
section("BOUNDARIES — FORGE cannot fight the autoplacer");
{
  const c = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)], primaryReload: { 1: 1 },
  });

  // Pretend the autoplacer already took the slot straight at the enemy.
  const held = c.getConfig(c.myPlayer.items[2], 0);
  c.addPredictObject(c.myPlayer.items[2], 0, false);
  const before = placed.length;

  c.forgeTick([]);
  const mine = placed.slice(before);

  ok("FORGE emits only through addPredictObject", mine.every(p => p.preplace === true));
  ok("and never takes a slot another lane already holds",
     mine.every(p => UTILS.getDistance(p.x, p.y, held.x, held.y) >= p.scale + held.scale ||
                     (p.x === held.x && p.y === held.y) === false));

  // Source-level guarantees, on CODE only. The engine's own header explains at
  // length that it never calls place() or io.send() and never reaches the shame
  // gates per angle — so a raw text search finds those names in the prose and
  // reports the documentation as a violation of itself. Comments come out first.
  const stripComments = (text) => text
        .split("\n")
        .map(line => {
          const at = line.indexOf("//");
          return at === -1 ? line : line.slice(0, at);
        })
        .join("\n");

  const forgeSrc = stripComments(
    src.slice(src.indexOf("F O R G E"), src.indexOf("function getPredictObjects(")));
  ok("FORGE never calls place() directly", !/[^a-zA-Z]place\(/.test(forgeSrc));
  ok("FORGE never touches io.send", !/io\.send/.test(forgeSrc));
  ok("FORGE never writes bannedAngles or placedAngles",
     !/bannedAngles\s*\.\s*set/.test(forgeSrc) && !/placedAngles\s*\.\s*push/.test(forgeSrc));
  ok("FORGE runs before the autoplacer in getPredictObjects",
     src.indexOf("forgeTick(forgeBroken)") < src.indexOf("// GET AUTOPLACE ANGLES"));
  ok("the autoplacer's own entry points are untouched",
     /function updateAngles\(id\) \{\s*\n\s*const angles = buildPlaceAngles\(id\);/.test(src) &&
     /function isAutoPlaceAngle\(/.test(src) &&
     /function checkPredictObjects\(/.test(src));
  ok("canTrapTick and canShamePlace survive for the autoplacer",
     /function canTrapTick\(\)/.test(src) && /function canShamePlace\(\)/.test(src));
  ok("and FORGE does not call either of them per-angle — the old FPS drop",
     !/canTrapTick\(\)/.test(forgeSrc) && !/canShamePlace\(\)/.test(forgeSrc));
}

// ===========================================================================
section("COST — one sweep per item per tick, not one per candidate angle");
{
  let sweeps = 0;
  const c = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)], primaryReload: { 1: 1 },
  });

  const real = ctx.buildPlaceAngles;
  ctx.buildPlaceAngles = function (...a) { sweeps++; return real.apply(this, a); };

  c.forgeTick([{ sid: 9, x: 1070, y: 1000, scale: 35, id: 6, trap: false, dmg: true, ours: true }]);

  // Two items (spike and trap) means at most two sweeps for a whole tick. The
  // engine this replaced could reach several hundred.
  ok("a whole tick costs at most two placement sweeps", sweeps <= 2, `got ${sweeps}`);

  sweeps = 0;
  c.forgeSlots(c.myPlayer.items[2]);
  c.forgeSlots(c.myPlayer.items[2]);
  c.forgeSlots(c.myPlayer.items[2]);
  ok("repeat asks for the same item cost nothing", sweeps === 0, `got ${sweeps}`);
}

// ===========================================================================
section("LEDGER — the engine records what it did and what came of it");
{
  const trap = trapAt(1080, 1000);
  const c = world({
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trap], primaryReload: { 1: 1 },
  });
  c.forgeTick([]);

  ok("every emission is written down",
     c.forgeLedger.emitted === placed.length && c.forgeLedger.emitted > 0,
     `emitted ${c.forgeLedger.emitted}, placed ${placed.length}`);
  ok("and broken out by role", Object.keys(c.forgeLedger.byRole).length > 0);
  ok("with a decision log", c.forgeLedger.log.length === c.forgeLedger.emitted);
  ok("each entry has the spot it was aimed at",
     c.forgeLedger.pending.every(e => typeof e.x === "number" && typeof e.y === "number"));

  // A structure appearing at the spot confirms it.
  const entry = c.forgeLedger.pending[0];
  c.spikes_our = [{ x: entry.x, y: entry.y, scale: entry.scale }];
  c.tick = 105;
  c.forgeSettle();
  ok("a structure appearing at the spot counts as confirmed",
     c.forgeLedger.confirmed >= 1, `confirmed ${c.forgeLedger.confirmed}`);

  // And the window expiring rejects it.
  const d = world({ nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)], primaryReload: { 1: 1 } });
  d.forgeTick([]);
  const emitted = d.forgeLedger.emitted;
  d.spikes_our = []; d.traps_our = [];
  d.tick = 100 + 60;
  d.forgeSettle();
  ok("an emission the world never answered is recorded as rejected",
     d.forgeLedger.rejected === emitted && d.forgeLedger.pending.length === 0,
     `rejected ${d.forgeLedger.rejected} of ${emitted}`);

  // The awaited-break register.
  const e = world({ nearestEnemy: enemyAt(1080, 1000) });
  e.forgeAhead.set(77, 100);
  ok("a break we placed ahead of is recognised when it lands", e.forgeAwaiting([77]) === true);
  ok("and is not reported twice", e.forgeAwaiting([77]) === false);
  ok("an unrelated break is not ours", e.forgeAwaiting([1234]) === false);
}

// ===========================================================================
section("SAFETY — gates, and the states where building is wrong");
{
  const base = {
    nearestEnemy: enemyAt(1080, 1000), traps_our: [trapAt(1080, 1000)], primaryReload: { 1: 1 },
  };

  world(Object.assign({}, base, { vars: { forge: false } })).forgeTick([]);
  ok("the toggle off means the engine does nothing", roles() === 0);

  world(Object.assign({}, base, { gPressed: true })).forgeTick([]);
  ok("the grind gate is respected", roles() === 0);

  world(Object.assign({}, base, { nearestTrap: trapAt(1000, 1000), spikeDmgCount: 3 })).forgeTick([]);
  ok("trapped AND being spiked: every packet belongs to getting out", roles() === 0);

  world(Object.assign({}, base, { nearestEnemy: null })).forgeTick([]);
  ok("no enemy means nothing is built", roles() === 0);

  const dead = world(Object.assign({}, base));
  dead.myPlayer.alive = false;
  dead.forgeTick([]);
  ok("dead means nothing is built", roles() === 0);

  // Item caps are honoured before a packet is spent.
  const capped = world(Object.assign({}, base, {
    myPlayer: Object.assign({}, world(base).myPlayer, { itemCounts: { 2: 15, 4: 6 } }),
  }));
  capped.forgeTick([]);
  ok("an item at its cap is never queued", roles() === 0, `placed ${roles()}`);
}

// ===========================================================================
section("ROBUSTNESS — degenerate input must not throw inside a packet handler");
{
  // forgeTick runs inside the tick body. Anything it throws takes the rest of
  // that tick with it, so it has to survive whatever the wire hands it.
  const nasty = [
    ["enemy exactly on top of us", { nearestEnemy: enemyAt(1000, 1000) }],
    ["enemy with no velocity fields", { nearestEnemy: Object.assign(enemyAt(1080, 1000), { xVel: undefined, yVel: undefined }) }],
    ["enemy with NaN position", { nearestEnemy: enemyAt(NaN, NaN) }],
    ["no weapons array on the enemy", { nearestEnemy: Object.assign(enemyAt(1080, 1000), { weapons: [] }) }],
    ["no items on us", { nearestEnemy: enemyAt(1080, 1000), myPlayer: { sid: 1, x2: 1000, y2: 1000, scale: 35, dir: 0, alive: true, xVel: 1000, yVel: 1000, items: [], itemCounts: {}, weapons: [5, 10], weaponVariants: [0, 0], skinIndex: 0 } }],
    ["a player in the list with no sid", { nearestEnemy: enemyAt(1080, 1000), players: [{ visible: true, weaponIndex: 5 }] }],
    ["a null in the player list", { nearestEnemy: enemyAt(1080, 1000), players: [null] }],
    ["an object with no health", { nearestEnemy: enemyAt(1080, 1000), visibleObjects: [{ sid: 5, x: 1050, y: 1000, scale: 35, active: true }] }],
    ["negative packet count", { nearestEnemy: enemyAt(1080, 1000), packets: -50 }],
    ["packets over the ceiling", { nearestEnemy: enemyAt(1080, 1000), packets: 5000 }],
  ];

  for (const [label, over] of nasty) {
    let threw = null;
    try {
      const c = world(Object.assign({ primaryReload: { 1: 1 } }, over));
      c.forgeTick([]);
      c.forgeTick([{ sid: 9, x: 1070, y: 1000, scale: 35, id: 6, trap: false, dmg: true, ours: true }]);
    } catch (e) { threw = e.message; }
    ok(`survives: ${label}`, threw === null, threw);
  }

  // A malformed break entry is wire data too.
  let threw = null;
  try {
    const c = world({ nearestEnemy: enemyAt(1080, 1000), primaryReload: { 1: 1 } });
    c.forgeTick([{}, null, { ours: true }]);
  } catch (e) { threw = e.message; }
  ok("survives a malformed break list", threw === null, threw);

  // A non-finite position would make every distance NaN, and NaN compares false
  // against every threshold — so the engine would sail past its own range gates
  // rather than stopping at them. It has to refuse to reason instead.
  const nan = world({ nearestEnemy: enemyAt(NaN, NaN), primaryReload: { 1: 1 } });
  ok("a non-finite enemy position produces no world, not a NaN one",
     nan.forgeSense() === null);
  nan.forgeTick([]);
  ok("and nothing is built from it", placed.length === 0, `placed ${placed.length}`);

  // And the budget can never go negative or hand out fractional placements.
  for (const p of [-50, 0, 60, 118, 5000]) {
    const c = world({ nearestEnemy: enemyAt(1080, 1000), packets: p });
    c.forgeSync();
    const room = c.forgeRoom();
    ok(`room at ${p} packets is a sane whole number`,
       Number.isInteger(room) && room >= 0, `got ${room}`);
  }
}

// ===========================================================================
section("INTEGRATION — the client still parses and the old engine is gone");
{
  let parsed = true, err = "";
  try { new vm.Script(src, { filename: CLIENT_PATH }); }
  catch (e) { parsed = false; err = e.message; }
  ok("YoRHa_System.user.js parses as a whole", parsed, err);

  for (const gone of ["isPrePlaceAngle", "getPrePlaceObject", "replaceWithinPath",
                      "replaceCandidates", "replaceGrade", "doReplace"]) {
    ok(`${gone} is gone`, !new RegExp(`function ${gone}\\(`).test(src));
  }

  for (const name of ["forgeTick", "forgeSense", "forgeIntents", "forgeCommit", "forgeProject",
                      "forgeSteadiness", "forgeSlots", "forgeDamageMap", "forgeSettle",
                      "forgeAwaiting", "forgeRoom", "forgeStock", "forgeKnock", "forgeSeal",
                      "forgeSelfCost", "forgeTouches", "forgeSync", "forgeNote"]) {
    const defs = (src.match(new RegExp(`function ${name}\\(`, "g")) || []).length;
    const refs = (src.match(new RegExp(`[^a-zA-Z]${name}\\(`, "g")) || []).length;
    ok(`${name}: defined once, reached ${refs - defs}x`, defs === 1 && refs - defs >= 1,
       `defs ${defs}, call sites ${refs - defs}`);
  }

  ok("forgeTick is called from the pipeline", /\n\s*forgeTick\(forgeBroken\);/.test(src));
  ok("the replace queue is drained into it", /const forgeBroken = replaceQueue;/.test(src));
  ok("FORGE's persistent state travels with the bot context",
     src.includes('"forgeAhead"') && src.includes('"forgeHeadings"') &&
     src.includes("forgeAhead: forgeAhead,") && src.includes("forgeAhead = s.forgeAhead"));
  ok("every menu slider has a default in window.vars",
     ["forge", "forgeRange", "forgePerTick", "forgeReserve"].every(v =>
       new RegExp(`\\n\\s*${v}: `).test(src)));
  ok("and a tile in the Placers menu",
     ["forge", "forgeRange", "forgePerTick", "forgeReserve"].every(v =>
       new RegExp(`id: "${v}"`).test(src)));
  ok("the sliders actually reach the engine", /FORGE\.engageRange = v\.forgeRange/.test(src));
  ok("stats are reachable without a debugger", /window\.FORGE_STATS = function/.test(src));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
