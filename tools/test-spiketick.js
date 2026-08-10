#!/usr/bin/env node
/*
 * test-spiketick.js
 *
 * Drives the pinned-spike-tick window out of the built userscript.
 *
 * spikeTickTrappedWindow is the one thing standing between "spike ticks work
 * while you are trapped" and "spike ticks fire while you are trapped in
 * situations where they throw the fight" — every clause in it is there to say
 * no to a case that looks similar and is not. A missing clause does not crash;
 * it just makes the client swing at the wrong moment, which is invisible until
 * it costs a kill. So each clause gets a case that isolates it.
 *
 *   node tools/test-spiketick.js [path/to/build.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BUILD = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "RYN_PathBreak.user.js");

/* ---- lift the two helpers out of the build ---- */

const code = fs.readFileSync(BUILD, "utf8");
const start = code.indexOf("  const SPIKE_TICK_TRAPPED_ARC");
const end = code.indexOf("  const spikeTickTarget = (client2, enabled) => {");
if (start === -1 || end === -1 || end < start) {
  throw new Error("could not find the pinned-window helpers in " + BUILD);
}
const helpers = code.slice(start, end);

/* SPIKE_TICK_TRAP_RANGE comes from the client; read it rather than restate it,
 * so a change there shows up here instead of being quietly assumed. */
const rangeMatch = code.match(/const SPIKE_TICK_TRAP_RANGE = (\d+);/);
if (!rangeMatch) throw new Error("could not read SPIKE_TICK_TRAP_RANGE");
const SPIKE_TICK_TRAP_RANGE = Number(rangeMatch[1]);

const Settings_default = { _spikeTickTrapped: true };
/* The window memoises itself in the per-client tick stamps the spike ticks
 * already keep, so the harness has to supply those too. Same shape the client
 * creates. */
const STATE = new WeakMap();
const spikeTickState = client => {
  let state = STATE.get(client);
  if (state === undefined) {
    state = { trapTick: -99, counterTick: -99, windowTick: -99, window: false };
    STATE.set(client, state);
  }
  return state;
};
const build = new Function(
  "Settings_default", "SPIKE_TICK_TRAP_RANGE", "spikeTickState",
  helpers + "\nreturn { spikeTickTrappedWindow, spikeTickCanRetrap };"
);
const { spikeTickTrappedWindow } = build(Settings_default, SPIKE_TICK_TRAP_RANGE, spikeTickState);

/* ---- stubs ---- */

const MINE = 1;
const THEIRS = 2;

function scenario(overrides) {
  const base = {
    settingOn: true,
    iAmTrapped: true,
    enemyTrapped: true,
    trapOwner: MINE,          // whose trap the enemy is standing in
    trapMissing: false,       // enemy.trappedIn is null
    ownerUnknown: false,      // isEnemyByID throws, as it does for an unseen owner
    distance: 60,             // between us
    canPlaceTrap: false,      // resources + item limit + trap in inventory
    freeAngles: 0             // how many of the probed angles are placeable
  };
  const s = Object.assign(base, overrides);

  Settings_default._spikeTickTrapped = s.settingOn;

  s.probed = 0;
  const myPlayer = {
    isTrapped: s.iAmTrapped,
    pos: { current: { x: 0, y: 0, angle: () => 0 } },
    canPlace: type => type === 7 && s.canPlaceTrap,
    canPlaceObject: (type, angle) => {
      if (type !== 7) return false;
      return s.probed++ < s.freeAngles;
    },
    collidingSimple: (entity, range) => s.distance <= range
  };
  const enemy = {
    isTrapped: s.enemyTrapped,
    pos: { current: { x: s.distance, y: 0 } },
    trappedIn: s.trapMissing ? null : { ownerID: s.trapOwner }
  };
  const client = {
    myPlayer,
    _ModuleHandler: { tickCount: 1 },
    PlayerManager: {
      isEnemyByID(ownerID) {
        if (s.ownerUnknown) throw new Error("Failed to find an owner!");
        return ownerID !== MINE;
      }
    }
  };
  return { client, enemy, s };
}

const CASES = [
  // The situation the window exists for.
  [ "pinned, their trap is mine, no retrap", {}, true ],

  // Each clause, isolated.
  [ "setting off",                    { settingOn: false },                 false ],
  [ "I am not trapped",               { iAmTrapped: false },                false ],
  [ "enemy is not trapped",           { enemyTrapped: false },              false ],
  [ "both stuck in enemy traps",      { trapOwner: THEIRS },                false ],
  [ "enemy trapped but trap unknown", { trapMissing: true },                false ],
  [ "trap owner not resolvable",      { ownerUnknown: true },               false ],
  [ "enemy out of swing range",       { distance: SPIKE_TICK_TRAP_RANGE + 1 }, false ],
  [ "a retrap is available",          { canPlaceTrap: true, freeAngles: 1 }, false ],

  // The retrap check has two halves and both have to fail before the window
  // opens: no trap to place at all, or a trap but nowhere to put it.
  [ "trap in hand, every angle blocked", { canPlaceTrap: true, freeAngles: 0 }, true ],
  [ "trap in hand, last angle free",     { canPlaceTrap: true, freeAngles: 12 }, false ],
  [ "no trap in hand",                   { canPlaceTrap: false, freeAngles: 12 }, true ],

  // Right at the range boundary, which is where an off-by-one would live.
  [ "exactly at swing range",         { distance: SPIKE_TICK_TRAP_RANGE },  true ]
];

let failed = 0;
for (const [ name, overrides, expected ] of CASES) {
  const { client, enemy } = scenario(overrides);
  let actual;
  try {
    actual = spikeTickTrappedWindow(client, enemy);
  } catch (error) {
    actual = `threw: ${error.message}`;
  }
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"}  ${name.padEnd(34)} ` +
    `window=${String(actual).padEnd(5)} expected=${expected}`
  );
}

/* Three modules ask per tick and the probe underneath is a dozen grid
 * queries, so the answer is cached. Check the cache actually holds, and that
 * it does not hold across a tick. */
{
  const { client, enemy, s } = scenario({});
  const first = spikeTickTrappedWindow(client, enemy);
  // Make a retrap available. Recomputing would now answer false; the cheap
  // guards above the cache are untouched, so only the cache can keep it true.
  s.canPlaceTrap = true;
  s.freeAngles = 12;
  s.probed = 0;
  const cached = spikeTickTrappedWindow(client, enemy);
  client._ModuleHandler.tickCount = 2;    // new tick, must recompute
  s.probed = 0;
  const recomputed = spikeTickTrappedWindow(client, enemy);
  const ok = first === true && cached === true && recomputed === false;
  if (!ok) failed++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"}  ${"cached within a tick, not across".padEnd(34)} ` +
    `first=${first} cached=${cached} nextTick=${recomputed}`
  );
}

console.log("");
if (failed > 0) {
  console.error(`FAIL - ${failed} of ${CASES.length + 1} cases`);
  process.exit(1);
}
console.log(`OK - ${CASES.length + 1} pinned-window cases behave as expected.`);
