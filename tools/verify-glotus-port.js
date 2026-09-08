#!/usr/bin/env node
/*
 * verify-glotus-port.js
 *
 * Checks that the two Glotus modules ported into Ryn Type 2 — spikeTick and
 * antiRetrap — are still the Glotus modules, and are still wired up so they
 * can actually fire.
 *
 * Ported code rots in two different ways, so this checks both:
 *
 *   1. The logic drifts. Caught by lifting each class out of both files and
 *      diffing them, then by running the ported class and the original side
 *      by side on identical stub worlds and comparing what each one decides.
 *   2. The logic is fine but the module is unreachable — dropped from the run
 *      list, missing a setting, or ordered behind a module that claims the
 *      tick first. That last one is silent: nothing errors, the feature just
 *      never happens. antiRetrap sitting behind autoBreak is exactly this.
 *
 *   node tools/verify-glotus-port.js [path/to/Ryn_Type_2.user.js] [path/to/glotus.txt]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const RYN_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Ryn_Type_2.user.js");
// The Glotus source is the reference, not a build input. Without it the
// structural half still runs; only the two comparison halves are skipped.
const GLOTUS_PATH = process.argv[3] ? path.resolve(process.argv[3]) : null;

const RYN = fs.readFileSync(RYN_PATH, "utf8");
const GLOTUS = GLOTUS_PATH ? fs.readFileSync(GLOTUS_PATH, "utf8") : null;

const PORTED = [ "SpikeTick", "AntiRetrap" ];

let failures = 0;
function check(label, ok, note) {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${note ? `  — ${note}` : ""}`);
}
function section(title) {
  console.log(`\n${title}`);
}

/* Lift `class Name { ... }` out of a source string by brace matching. */
function classBody(src, name) {
  const start = src.indexOf(`class ${name} {`);
  if (start < 0) return null;
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

/* Indentation and comments are ours to change; the code is not. */
const normalize = src => src
  .split("\n")
  .map(line => line.trim())
  .filter(line => line && !line.startsWith("//"))
  .join("\n");

/* ── 1. the ported logic is still Glotus' logic ───────────────────────────── */

section("Ported logic matches Glotus");
if (!GLOTUS) {
  console.log("  SKIP  no Glotus source given");
} else {
  for (const name of PORTED) {
    const mine = classBody(RYN, name);
    const theirs = classBody(GLOTUS, name);
    if (!mine || !theirs) {
      check(`${name} found in both files`, false,
        !mine ? "missing from Ryn Type 2" : "missing from Glotus");
      continue;
    }
    const same = normalize(mine) === normalize(theirs);
    check(`${name} is unchanged`, same);
    if (!same) {
      const a = normalize(theirs).split("\n");
      const b = normalize(mine).split("\n");
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          console.log(`          glotus: ${a[i] ?? "(end)"}`);
          console.log(`          ryn   : ${b[i] ?? "(end)"}`);
        }
      }
    }
  }
}

/* ── 2. both modules are reachable ────────────────────────────────────────── */

section("Modules are registered and reachable");

check("SpikeTick_default alias exists", /const SpikeTick_default = SpikeTick;/.test(RYN));
check("spikeTick is constructed", /spikeTick: new SpikeTick_default\(client2\),/.test(RYN));
check("antiRetrap is constructed", /antiRetrap: new AntiRetrap\(client2\),/.test(RYN));

const runList = RYN.match(/this\.modules = \[([^\]]*)\]/)[1]
  .split(",")
  .map(entry => entry.trim().replace("this.staticModules.", ""))
  .filter(Boolean);
const at = name => runList.indexOf(name);

for (const name of [ "spikeTick", "antiRetrap" ]) {
  const count = runList.filter(entry => entry === name).length;
  check(`${name} runs exactly once`, count === 1,
    count === 0 ? "not in this.modules — it will never tick" : `listed ${count} times`);
}

/* ── 3. run order still lets them win a tick ──────────────────────────────── */

section("Run order matches Glotus");

// DefaultAcc reads ModuleHandler.forceHat to pick the accessory that goes with
// the hat a tick module just forced, so Ryn runs it at the back of the list
// where Glotus runs it near the front. It sets useAcc and never moduleActive,
// so it takes no tick from anyone — this is Ryn's own fix, not port drift.
const REORDERED_BY_RYN = new Set([ "defaultAcc" ]);

if (!GLOTUS) {
  console.log("  SKIP  no Glotus source given");
} else {
  const theirList = GLOTUS.match(/this\.modules = \[([^\]]*)\]/)[1]
    .split(",")
    .map(entry => entry.trim().replace("this.staticModules.", ""))
    .filter(Boolean);
  const theirAt = name => theirList.indexOf(name);

  for (const anchor of [ "spikeTick", "antiRetrap" ]) {
    const shared = runList.filter(name =>
      name !== anchor && theirList.includes(name) && !REORDERED_BY_RYN.has(name));
    const drifted = shared.filter(name =>
      (theirAt(name) > theirAt(anchor)) !== (at(name) > at(anchor)));
    check(`${anchor} keeps its Glotus priority`, drifted.length === 0,
      drifted.length ? `now on the wrong side of: ${drifted.join(", ")}`
                     : `checked against ${shared.length} shared modules`);
  }
}

// Stated outright, because this pair is the whole point of the ordering and a
// future reshuffle should fail here loudly rather than quietly do nothing.
check("antiRetrap runs before autoBreak", at("antiRetrap") < at("autoBreak"),
  "otherwise autoBreak takes the tick every time you are trapped");
check("spikeTick runs after spikeSync", at("spikeTick") > at("spikeSync"));

/* ── 4. settings and stats exist ──────────────────────────────────────────── */

section("Settings and stats are present");

check("_spikeTick setting", /_spikeTick: (?:true|false),/.test(RYN));
check("_antiRetrap setting", /_antiRetrap: (?:true|false),/.test(RYN));
check("_spikeTickTimes default", /_spikeTickTimes: 0,/.test(RYN));
check("StatsManager field", /_spikeTickTimes=0;/.test(RYN));
check("StatsManager getter", /get spikeTickTimes\(\) \{/.test(RYN));
check("StatsManager setter", /set spikeTickTimes\(value\) \{/.test(RYN));
check("StatsManager restores it on init",
  /this\.spikeTickTimes = Settings_default\._spikeTickTimes;/.test(RYN));

// UI.updateStats throws when the element is missing, so a counter written by a
// module with no row on the menu takes the whole tick down with it.
section("Every counter written has a row on the menu");
const written = new Set([ ...RYN.matchAll(/updateStats\("(\w+)"/g) ].map(m => m[1]));
for (const id of written) {
  check(id, RYN.includes(`id=\\"${id}\\"`), "updateStats throws without one");
}
for (const id of [ "_spikeTick", "_antiRetrap" ]) {
  check(`${id} toggle`, RYN.includes(`id=\\"${id}\\"`));
}

/* ── 5. what the ported code calls still exists ───────────────────────────── */

section("Dependencies the ported code calls");

const DEPENDENCIES = [
  [ "EnemyManager.enemySpikeCollider", /enemySpikeCollider=null;/ ],
  [ "EnemyManager.nearestTrap", /nearestTrap=null;/ ],
  [ "EnemyManager.shouldIgnoreModule", /shouldIgnoreModule\(\) \{/ ],
  [ "EnemyManager.attemptSpikePlacement", /attemptSpikePlacement\(\) \{/ ],
  [ "myPlayer.collidingEntity", /collidingEntity\(entity, range, checkBased = false/ ],
  [ "myPlayer.getBuildingDamage", /getBuildingDamage\(id, isTank = false\)/ ],
  [ "ModuleHandler.hasStoreItem", /hasStoreItem\(type, id\) \{/ ],
  // Not isReloaded(type, tick) on Player — that one has no default and returns
  // false for every single-argument call. Both ported modules call the
  // Reloading module's version, which defaults ticks to 0.
  [ "Reloading.isReloaded", /isReloaded\(type, ticks = 0\) \{/ ],
  [ "client.StatsManager", /this\.StatsManager = new StatsManager\(this\);/ ]
];
for (const [ label, pattern ] of DEPENDENCIES) check(label, pattern.test(RYN));

/* ── 6. same decisions as Glotus, branch by branch ────────────────────────── */

section("Same decision as Glotus on every branch");

/*
 * Each class only reaches out to Settings_default and DataHandler_default, so
 * it can be lifted into its own context with those two stubbed and driven
 * directly. Everything else arrives through the client object.
 */
function loadModule(src, name) {
  const context = vm.createContext({
    Settings_default: null,
    DataHandler_default: null,
    exported: null
  });
  vm.runInContext(`${classBody(src, name)}\nexported = ${name};`, context);
  return context;
}

const vec = (x, y) => ({
  x, y,
  angle(other) { return Math.atan2(other.y - this.y, other.x - this.x); }
});

/* A world where every condition passes; each scenario turns off exactly one. */
function stubWorld(options) {
  const cfg = {
    moduleActive: false, primary: 1, primaryReloaded: true, secondary: 10,
    secondaryReloaded: true, turretReloaded: true, ownsTurret: true,
    biggerThreat: false, enemyOnSpike: true, inRange: true, enemyNearby: true,
    trapped: true, trapHealth: 10, hammerDamage: 100,
    ...options
  };
  const target = { hitScale: 35, pos: { current: vec(120, 0), future: vec(130, 0) } };
  const sideEffects = [];
  const ModuleHandler = {
    moduleActive: cfg.moduleActive,
    useAngle: null, forceHat: null, forceWeapon: null, shouldAttack: false,
    hasStoreItem: () => cfg.ownsTurret,
    staticModules: {
      reloading: {
        isReloaded: type => type === 0 ? cfg.primaryReloaded
                          : type === 1 ? cfg.secondaryReloaded
                          : cfg.turretReloaded
      }
    }
  };
  const client = {
    _ModuleHandler: ModuleHandler,
    EnemyManager: {
      enemySpikeCollider: cfg.enemyOnSpike ? target : null,
      nearestEnemy: cfg.enemyNearby ? target : null,
      nearestTrap: cfg.trapped ? { health: cfg.trapHealth } : null,
      shouldIgnoreModule: () => cfg.biggerThreat,
      attemptSpikePlacement() { sideEffects.push("placed spike"); }
    },
    myPlayer: {
      pos: { current: vec(0, 0), future: vec(0, 0) },
      getItemByType: type => type === 0 ? cfg.primary : cfg.secondary,
      getBuildingDamage: () => cfg.hammerDamage,
      collidingEntity: () => cfg.inRange,
      collidingSimple: () => cfg.inRange
    },
    StatsManager: { set spikeTickTimes(value) { sideEffects.push("counted"); } }
  };
  return { client, ModuleHandler, sideEffects };
}

/* Drive one module through one tick and describe everything it decided. */
function decide(context, { settings = {}, turretHalf = false, ...options }) {
  context.Settings_default = { _spikeTick: true, _antiRetrap: true, ...settings };
  context.DataHandler_default = { getWeapon: () => ({ range: 110 }) };
  const world = stubWorld(options);
  const module = new context.exported(world.client);
  if (turretHalf) module.useTurret = true;
  module.postTick();
  return JSON.stringify({
    claimedTick: world.ModuleHandler.moduleActive,
    hat: world.ModuleHandler.forceHat,
    weapon: world.ModuleHandler.forceWeapon,
    attacked: world.ModuleHandler.shouldAttack,
    angle: world.ModuleHandler.useAngle,
    did: world.sideEffects,
    armedTurret: module.useTurret === true
  });
}

const SCENARIOS = {
  SpikeTick: [
    [ "enemy is standing on a spike", {} ],
    [ "turret half of the chain", { turretHalf: true } ],
    [ "turret half, turret still reloading", { turretHalf: true, turretReloaded: false } ],
    [ "turret half, no turret owned", { turretHalf: true, ownsTurret: false } ],
    [ "switched off", { settings: { _spikeTick: false } } ],
    [ "another module already claimed the tick", { moduleActive: true } ],
    [ "nobody on a spike", { enemyOnSpike: false } ],
    [ "primary still reloading", { primaryReloaded: false } ],
    [ "holding a shield", { primary: 8 } ],
    [ "a bigger threat is live", { biggerThreat: true } ],
    [ "target out of weapon range", { inRange: false } ],
    [ "no turret owned", { ownsTurret: false } ]
  ],
  AntiRetrap: [
    [ "trapped, hammer ready, enemy in reach", {} ],
    [ "switched off", { settings: { _antiRetrap: false } } ],
    [ "another module already claimed the tick", { moduleActive: true } ],
    [ "not trapped", { trapped: false } ],
    [ "no enemy nearby", { enemyNearby: false } ],
    [ "trap too healthy to break", { trapHealth: 500 } ],
    [ "secondary is not a hammer", { secondary: 4 } ],
    [ "hammer still reloading", { secondaryReloaded: false } ],
    [ "primary still reloading", { primaryReloaded: false } ],
    [ "enemy out of reach", { inRange: false } ],
    [ "turret still reloading", { turretReloaded: false } ],
    [ "no turret owned", { ownsTurret: false } ]
  ]
};

if (!GLOTUS) {
  console.log("  SKIP  no Glotus source given");
} else {
  for (const name of PORTED) {
    const mine = loadModule(RYN, name);
    const theirs = loadModule(GLOTUS, name);
    for (const [ label, options ] of SCENARIOS[name]) {
      const expected = decide(theirs, options);
      const actual = decide(mine, options);
      check(`${name}: ${label}`, expected === actual);
      if (expected !== actual) {
        console.log(`          glotus: ${expected}`);
        console.log(`          ryn   : ${actual}`);
      }
    }
  }
}

console.log(`\n${failures ? `${failures} check(s) failed` : "All checks passed"}`);
process.exit(failures ? 1 : 0);
