#!/usr/bin/env node
/*
 * verify-autoheal.js
 *
 * Three checks on the Auto Heal Engine, in order of how much they would cost
 * to get wrong:
 *
 *   1. Mechanics.  Every constant the engine decides on is re-derived from the
 *      shipped bundle (src/game_index.js) and the tables pulled out of it
 *      (drivers/game-drivers.json). If the game changes the shame window, the
 *      lock length, a food restore or a hat multiplier, this fails rather than
 *      the engine quietly deciding on last year's numbers.
 *
 *   2. Wiring.  The built userscript really does register the module, install
 *      both ownership guards, carry the settings keys and show the menu entries.
 *
 *   3. Behaviour.  The engine is pulled back out of the built userscript and
 *      run through the whole simulation suite, so what is judged is the copy
 *      that ships, not only the source it was built from.
 *
 *   node tools/verify-autoheal.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const GAME = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const DRIVERS = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8"));
const ENGINE_SRC = fs.readFileSync(path.join(ROOT, "src/autoheal/ryn-autoheal-engine.js"), "utf8");
const BUILT_PATH = path.join(ROOT, "RYN_AutoHeal.user.js");

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? "   " + detail : ""}`);
  if (!ok) failures++;
}

/* Pull the value out of the engine's own AH table. */
const { createRynAutoHealEngine } = require("../src/autoheal/ryn-autoheal-engine.js");
const AH = createRynAutoHealEngine({ Items: [], Hats: [], Accessories: [], Settings: {} }).AH;

/* A two-pointer line diff with a bounded lookahead. Enough to say how many
 * lines differ between two nearly identical 24k-line files. */
function countLineChanges(a, b, lookahead = 400) {
  let i = 0, j = 0, added = 0, removed = 0, modified = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    let found = -1;
    for (let k = 1; k < lookahead && j + k < b.length; k++) {
      if (b[j + k] === a[i]) { found = k; break; }
    }
    if (found > 0) { added += found; j += found; continue; }
    let back = -1;
    for (let k = 1; k < lookahead && i + k < a.length; k++) {
      if (a[i + k] === b[j]) { back = k; break; }
    }
    if (back > 0) { removed += back; i += back; continue; }
    modified++; i++; j++;
  }
  added += b.length - j;
  removed += a.length - i;
  return { added, removed, modified, total: added + removed + modified };
}

/* One capture group, one number. */
function fromGame(label, re) {
  const m = GAME.match(re);
  if (!m) {
    console.log(`FAIL  ${label}   pattern not found in src/game_index.js: ${re}`);
    failures++;
    return null;
  }
  return m[1];
}

console.log("\n1. mechanics — engine constants against the shipped bundle\n");

/* buildItem's shame block, game_index.js:2458-2470. */
const window = fromGame("shame window", /(\d+)\s*\?\s*\(this\.shameCount\+\+/);
check("shame window is 120ms", Number(window) === AH.SHAME_WINDOW_MS, `bundle ${window}, engine ${AH.SHAME_WINDOW_MS}`);

const lockAt = fromGame("lock threshold", /this\.shameCount\s*>=\s*(\d+)\s*&&\s*\(this\.shameTimer/);
check("lock arms at 8", Number(lockAt) === AH.SHAME_LOCK_AT, `bundle ${lockAt}, engine ${AH.SHAME_LOCK_AT}`);
check("engine never lets the count past 7", AH.SHAME_MAX === AH.SHAME_LOCK_AT - 1);

const lockMs = fromGame("lock length", /this\.shameCount\s*>=\s*8\s*&&\s*\(this\.shameTimer\s*=\s*([\de.]+)/);
check("lock lasts 30s", Number(lockMs) === AH.SHAME_LOCK_MS, `bundle ${lockMs}, engine ${AH.SHAME_LOCK_MS}`);

const credit = fromGame("late credit", /this\.shameCount\s*-=\s*(\d+)/);
check("a late press is worth -2", Number(credit) === AH.SHAME_CREDIT, `bundle ${credit}, engine ${AH.SHAME_CREDIT}`);

/* The lock is armed before consume is reached — the whole reason LOCKGUARD
 * exists. Check the order still holds in the bundle. */
const shameBlock = GAME.slice(GAME.indexOf("if (f.consume) {"), GAME.indexOf("if (f.consume) {") + 700);
check(
  "the lock is armed before consume is called",
  shameBlock.indexOf("this.shameTimer = 3e4") !== -1 &&
  shameBlock.indexOf("this.shameTimer = 3e4") < shameBlock.indexOf("f.consume(this)")
);
check(
  "only a pending hit is judged (hitTime is cleared by the press)",
  /if \(this\.hitTime\) \{[\s\S]{0,120}this\.hitTime = 0/.test(GAME)
);
check(
  "a press that heals nothing still spends no food",
  /V && \(this\.useRes\(f\)/.test(GAME)
);

const maxHealth = fromGame("player max health", /this\.maxHealth\s*=\s*(\d+),/);
check("max health is 100", Number(maxHealth) === AH.MAX_HEALTH, `bundle ${maxHealth}, engine ${AH.MAX_HEALTH}`);

const dotPeriod = fromGame("regen period", /x = (\de\d),?\s*\n?\s*\}/);
check("the regen / DoT counter is 1000ms", Number(dotPeriod) === AH.DOT_PERIOD_MS, `bundle ${dotPeriod}, engine ${AH.DOT_PERIOD_MS}`);

const rate = DRIVERS.config.serverUpdateRate;
check("tick length matches serverUpdateRate", Math.abs(1000 / rate - AH.TICK_MS) < 1e-9, `${rate}/s`);
check(
  "the DoT period is a whole number of ticks",
  AH.DOT_PERIOD_TICKS === Math.round(AH.DOT_PERIOD_MS / (1000 / rate)),
  `${AH.DOT_PERIOD_TICKS} ticks`
);
check(
  "one tick lands inside the shame window, two do not",
  1000 / rate <= AH.SHAME_WINDOW_MS && 2 * (1000 / rate) > AH.SHAME_WINDOW_MS,
  `${(1000 / rate).toFixed(1)}ms / ${(2000 / rate).toFixed(1)}ms vs ${AH.SHAME_WINDOW_MS}ms`
);

/* Food, straight from the consume functions. */
const foods = [...GAME.matchAll(/name: "(apple|cookie|cheese)",[\s\S]{0,220}?e\.changeHealth\((\d+), e\)/g)]
  .map(m => [m[1], Number(m[2])]);
check("food restores are 20 / 40 / 30", JSON.stringify(foods) === JSON.stringify([["apple", 20], ["cookie", 40], ["cheese", 30]]), JSON.stringify(foods));
check("cheese leaves +10/s for 5s", /e\.dmgOverTime\.dmg = -10,[\s\S]{0,80}e\.dmgOverTime\.time = 5/.test(GAME));

/* Hats the engine reasons about. */
const hats = {};
for (const h of DRIVERS.hats) hats[h.id] = h;
check("soldier helmet is id 6, dmgMult 0.75", hats[AH.HAT_SOLDIER] && hats[AH.HAT_SOLDIER].dmgMult === 0.75);
check("bull helmet is id 7, healthRegen -5", hats[AH.HAT_BULL] && hats[AH.HAT_BULL].healthRegen === -5);
check("assassin gear is id 56, noEat", hats[AH.HAT_ASSASSIN] && hats[AH.HAT_ASSASSIN].noEat === true);
check("the shame hat is id 45", hats[AH.HAT_SHAME] && hats[AH.HAT_SHAME].name === "Shame!");
check(
  "a noEat skin refuses food outright",
  /f\.consume && this\.skin && this\.skin\.noEat/.test(GAME)
);

/* The largest single-tick burst the tables can produce, against the cap. */
const weaponMax = Math.max(...DRIVERS.weapons.map(w => (w.dmg || 0) * 1.18));
const spikeMax = Math.max(...DRIVERS.items.filter(i => i.group.id === 2).map(i => i.dmg || 0));
const projMax = Math.max(...DRIVERS.projectiles.map(p => p.dmg || 0));
check(
  "the 140 damage cap covers the worst real burst",
  weaponMax + spikeMax + projMax >= 100 && AH.DMG_CAP >= weaponMax + spikeMax,
  `weapon ${weaponMax.toFixed(1)} + spike ${spikeMax} + proj ${projMax} vs cap ${AH.DMG_CAP}`
);

/* Shame control: the zones, and the rules that are supposed to be
 * unconditional rather than heuristics. */
const Engine = createRynAutoHealEngine({ Items: [], Hats: [], Accessories: [], Settings: {} });
const ZONE = Engine.ZONE;
check("zones are SAFE 0 / WARNING 1-6 / CRITICAL 7", (() => {
  const z = n => Engine.zoneFor(n);
  if (z(0) !== ZONE.SAFE) return false;
  for (let n = 1; n <= 6; n++) if (z(n) !== ZONE.WARNING) return false;
  return z(7) === ZONE.CRITICAL && z(8) === ZONE.CRITICAL;
})());
check(
  "'approaching 7' starts below the ceiling",
  AH.SHAME_WARN_HIGH > 0 && AH.SHAME_WARN_HIGH < AH.SHAME_MAX,
  `${AH.SHAME_WARN_HIGH}`
);
check(
  "the forecast horizon is one DoT period",
  AH.SHAME_HORIZON_TICKS === AH.DOT_PERIOD_TICKS
);
check(
  "the count is re-read on the execution path, not taken from the snapshot",
  /liveShame\(\)/.test(ENGINE_SRC) &&
  /const live = this\.adapter\.liveShame\(\);[\s\S]{0,200}revalidate\(/.test(ENGINE_SRC)
);
check(
  "revalidation refuses a charged press once the live count is at the ceiling",
  /verdict === VERDICT\.CHARGED && gate >= AH\.SHAME_MAX/.test(ENGINE_SRC)
);

/* Threat engine: one engine, eleven detectors, and ids that match the tables. */
const THREAT = Engine.THREAT;
const CONFIDENCE = Engine.CONFIDENCE;
check(
  "confidence is NONE / LOW / MEDIUM / HIGH / CRITICAL, in order",
  ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"].every(k => CONFIDENCE[k] === k) &&
  Engine.CONFIDENCE_VALUE.NONE === 0 && Engine.CONFIDENCE_VALUE.CRITICAL === 1 &&
  Engine.CONFIDENCE_VALUE.LOW < Engine.CONFIDENCE_VALUE.MEDIUM &&
  Engine.CONFIDENCE_VALUE.MEDIUM < Engine.CONFIDENCE_VALUE.HIGH
);
{
  const probe = new Engine({});
  const detectors = probe.threat && probe.threat.detectors;
  const required = [
    THREAT.INSTAKILL, THREAT.SPIKE_TICK, THREAT.INSTA_REV, THREAT.MUSKET, THREAT.BOW,
    THREAT.SPAM_DAGGER, THREAT.VELOCITY_TICK, THREAT.SPIKE, THREAT.TRAP,
    THREAT.BURST, THREAT.SUSTAINED
  ];
  const ids = detectors ? detectors.map(d => d.id) : [];
  check("eleven detectors, one engine", ids.length === 11, ids.length + " registered");
  for (const id of required) check(`detector present: ${id}`, ids.indexOf(id) !== -1);
}
{
  const weapons = {};
  for (const w of DRIVERS.weapons) weapons[w.id] = w;
  check("musket is weapon 15 firing projectile 5", weapons[AH.WEAPON_MUSKET] &&
    weapons[AH.WEAPON_MUSKET].name === "musket" &&
    weapons[AH.WEAPON_MUSKET].projectile === AH.PROJ_MUSKET);
  check("the bow family fires the arrow projectiles the detector watches",
    [AH.WEAPON_BOW, AH.WEAPON_CROSSBOW, AH.WEAPON_REPEATER].every(
      id => weapons[id] && AH.PROJ_ARROWS.indexOf(weapons[id].projectile) !== -1));
  check("daggers are weapon 7, 100ms between swings", weapons[AH.WEAPON_DAGGER] &&
    weapons[AH.WEAPON_DAGGER].name === "daggers" && weapons[AH.WEAPON_DAGGER].speed === 100);
  check("polearm is weapon 5", weapons[AH.WEAPON_POLEARM] &&
    weapons[AH.WEAPON_POLEARM].name === "polearm");
  const items = DRIVERS.items;
  check("pit trap is item 15", items[AH.ITEM_TRAP] && items[AH.ITEM_TRAP].name === "pit trap");
  check("spikes are item group 2",
    items.filter(i => i.group.id === AH.GROUP_SPIKES).every(i => i.name.indexOf("spikes") !== -1));
  check("turret reach is the item's own shootRange",
    items[AH.ITEM_TURRET] && items[AH.ITEM_TURRET].shootRange === AH.TURRET_RANGE);
  check("turret gear is hat 53", hats[AH.HAT_TURRET_GEAR] &&
    hats[AH.HAT_TURRET_GEAR].name === "Turret Gear");
}
check(
  "a held ranged weapon needs loaded + facing + (half reach or a fresh switch)",
  /if \(!ready \|\| !e\.facing\) continue;/.test(ENGINE_SRC) &&
  /if \(!close && !justSwitched\) continue;/.test(ENGINE_SRC)
);
check(
  "an unfired ranged weapon never reports above MEDIUM",
  /const confidence = close && justSwitched \? CONFIDENCE\.MEDIUM : CONFIDENCE\.LOW;/
    .test(ENGINE_SRC)
);
check(
  "every report carries type, confidence, severity and timing",
  /function threatReport\(type, confidence, severity, timing, evidence, additive, rate\)/
    .test(ENGINE_SRC)
);
check(
  "a rate is never mistaken for a burst",
  /const lethal = !report\.rate && amount >= health;/.test(ENGINE_SRC)
);
check(
  "the detectors read the client only through the adapter",
  !/detect\(ctx\)[\s\S]{0,4000}?this\.client/.test(ENGINE_SRC)
);

/* Predictive defense: short horizons, the borrowed tracker, and the rules that
 * keep a forecast from spending anything it should not. */
check(
  "the forecast horizon is short",
  AH.PREDICT_HORIZON_TICKS <= AH.DOT_PERIOD_TICKS &&
  AH.PREEMPT_HORIZON_TICKS <= AH.PREDICT_HORIZON_TICKS,
  `${AH.PREEMPT_HORIZON_TICKS} / ${AH.PREDICT_HORIZON_TICKS} ticks of ${AH.DOT_PERIOD_TICKS}`
);
check(
  "motion prediction is RYN's own TargetMotion, borrowed rather than rebuilt",
  /borrowTargetMotion\(\)/.test(ENGINE_SRC) &&
  /staticModules && mh\.staticModules\.placementEngine/.test(ENGINE_SRC) &&
  /const Ctor = motion\.constructor;/.test(ENGINE_SRC)
);
check(
  "the borrow takes a private instance, never the placement engine's tracks",
  /const instance = new Ctor\(\);/.test(ENGINE_SRC)
);
check(
  "LOW confidence never produces a candidate",
  /forecast\.level !== CONFIDENCE\.LOW/.test(ENGINE_SRC)
);
{
  const required = ["TARGET", "TURNED", "STOPPED", "PROJECTILE", "COLLISION", "MOVED", "GONE"];
  const probe = new Engine({});
  const inv = probe.predict && probe.predict.invalidatedBy !== undefined;
  check("the predictor starts with no cached prediction", inv);
  for (const key of required) {
    check(`invalidation reason present: ${key.toLowerCase()}`,
      new RegExp("INVALIDATION\\." + key + "\\b").test(ENGINE_SRC));
  }
}
check(
  "stopping invalidates on the edge, not on standing still",
  /if \(stopped && \(!was \|\| !was\.stopped\)\) return INVALIDATION\.STOPPED;/.test(ENGINE_SRC)
);
check(
  "the enemy and projectile reads are shared with the threat engine, not repeated",
  /this\.lastEnemies = ctx\.enemies;/.test(ENGINE_SRC) &&
  /threat\.lastEnemies \|\| \[\]/.test(ENGINE_SRC)
);

/* The decision engine: a value comparison, not a threshold. */
{
  const DECISION = Engine.DECISION;
  check(
    "decisions are HEAL_NOW / WAIT / PREPARE / CANCEL / RECALCULATE",
    ["HEAL_NOW", "WAIT", "PREPARE", "CANCEL", "RECALCULATE"].every(k => DECISION[k] === k)
  );
}
check(
  "the decision is now-versus-wait, not a health threshold",
  /const now = this\.value\.now\(ctx, candidate\);/.test(ENGINE_SRC) &&
  /const wait = this\.value\.wait\(ctx, candidate\);/.test(ENGINE_SRC) &&
  /if \(now\.total > wait\.total\)/.test(ENGINE_SRC)
);
check(
  "a charged press is priced against the option it consumes",
  /verdict === VERDICT\.CHARGED\s*\n\s*\? this\.shamePenalty\(snap, shame\.chargeSafeCount\(snap\)\) : 0;/
    .test(ENGINE_SRC)
);
check(
  "the shame price is convex in the remaining budget",
  /return this\.lifeValue\(snap\) \/ \(budget \* budget\);/.test(ENGINE_SRC)
);
check(
  "the ceiling price is finite, so the comparison cannot go NaN",
  /if \(budget <= 0\) return this\.lifeValue\(snap\) \* 4;/.test(ENGINE_SRC)
);
check(
  "survival is not a term that can be outbid",
  /const waitIsFatal = rank\.survival &&/.test(ENGINE_SRC) &&
  /if \(waitIsFatal\) \{/.test(ENGINE_SRC)
);
check(
  "arbitration runs on RYN's own priority scale",
  /priorityFor/.test(ENGINE_SRC) &&
  /const theirs = this\.adapter\.priorityOf\(snap\.activeModule\);/.test(ENGINE_SRC) &&
  /if \(rank\.cls > theirs\) return true;/.test(ENGINE_SRC)
);
check(
  "the requested priority order is computed, not written down",
  /_urgency\(severity, confidence, timing, health\)/.test(ENGINE_SRC) &&
  !/CRITICAL_SURVIVAL|CATASTROPHIC_DAMAGE/.test(ENGINE_SRC)
);
{
  /* The order the objective describes has to fall out of the arithmetic. Feed
   * the urgency function representative cases and check the ranking. */
  const probe = new Engine({});
  const u = (sev, conf, timing) => probe.arbiter._urgency(sev, conf, timing, 100);
  const catastrophic = u(120, 1, 0);      // a lethal burst, landing now
  const burst = u(60, 0.75, 0);           // high-confidence burst
  const rapid = u(20, 0.75, 1);           // rapid damage, next tick
  const ranged = u(50, 0.5, 3);           // a held ranged weapon, three ticks out
  const dagger = u(20, 0.5, 2);           // dagger pressure
  const ordinary = u(10, 0.4, 4);         // ordinary chip
  check("catastrophic outranks a burst", catastrophic > burst);
  check("a burst outranks rapid damage", burst > rapid);
  check("rapid damage outranks a distant ranged threat", rapid > ranged);
  check("a ranged threat outranks dagger chip", ranged > dagger);
  check("dagger chip outranks ordinary damage", dagger > ordinary);
}

/* The client field the engine deliberately does not trust. */
const client = fs.readFileSync(path.join(ROOT, "src/RYN_Client_v5.4.user.js"), "utf8");
check(
  "the client's Player.maxHealth is still the undefined Math.LN1 the engine works around",
  /maxHealth=Math\.LN1;/.test(client)
);
check(
  "the engine derives max health from the bundle, not that field",
  /v !== null && v > 0 \? v : AH\.MAX_HEALTH/.test(ENGINE_SRC)
);

/* ------------------------------------------------------------------ */
console.log("\n2. wiring — the built userscript\n");

if (!fs.existsSync(BUILT_PATH)) {
  check("RYN_AutoHeal.user.js exists (run node tools/build-autoheal.js)", false);
} else {
  const built = fs.readFileSync(BUILT_PATH, "utf8");
  const once = (label, needle) => {
    const n = built.split(needle).length - 1;
    check(label, n === 1, n === 1 ? "" : `${n} occurrences`);
  };
  once("engine source is present", "function createRynAutoHealEngine(deps) {");
  once("engine is constructed with lazy deps", "const AutoHealEngine_default = createRynAutoHealEngine({");
  once("module is registered", "autoHealEngine: new AutoHealEngine_default(client2),");
  once("module runs before antiInsta", "this.staticModules.autoHealEngine, this.staticModules.antiInsta,");
  check(
    "both ownership guards are installed",
    built.split("if (Settings_default._autoHealEngine) {\n        return;\n      }").length - 1 === 2
  );
  once("Anti Smart Tick's branch is untouched", "if (this.antiSmartTick(myPlayer, nearestEnemy, ModuleHandler, ObjectManager2, PlayerManager2)) {");
  for (const key of ["_autoHealEngine: true", "_autoHealWash: true", "_autoHealStrict: true", "_autoHealReserve: 15"]) {
    once(`setting ${key.split(":")[0]}`, key);
  }
  for (const id of ["_autoHealEngine", "_autoHealWash", "_autoHealStrict", "_autoHealReserve"]) {
    check(`menu entry for ${id}`, built.includes(`\\\"${id}\\\" type=`) || built.includes(`for=\\\"${id}\\\"`));
  }
  /* Take the engine block back out and the rest of the file should be the base
   * client, give or take the handful of lines the wiring adds. This is the
   * check that "nothing else was touched" is a fact rather than an intention. */
  const engineStart = built.indexOf("  /* ==================================================================== *\n   * RYN Auto Heal Engine");
  const engineEnd = built.indexOf("  class ModuleHandler {");
  const withoutEngine = engineStart !== -1 && engineEnd > engineStart
    ? built.slice(0, engineStart) + built.slice(engineEnd)
    : built;
  const changed = countLineChanges(client.split("\n"), withoutEngine.split("\n"));
  /* The whole of the wiring: two header lines, one line in the modules array,
   * one settings block of four, one staticModules entry, the two guards with
   * their comments, and the Combat page's one (very long) line. */
  check(
    "nothing outside the engine block changed beyond the wiring",
    changed.total <= 25 && changed.removed === 0,
    `${changed.added} added, ${changed.removed} removed, ${changed.modified} modified`
  );

  /* ------------------------------------------------------------------ */
  console.log("\n3. behaviour — the engine as it ships, through the simulator\n");

  const start = built.indexOf("function createRynAutoHealEngine(deps) {");
  let depth = 0, end = -1;
  for (let i = built.indexOf("{", start); i < built.length; i++) {
    const c = built[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end === -1) {
    check("engine block could be extracted from the built script", false);
  } else {
    const source = built.slice(start, end) + "\nmodule.exports = { createRynAutoHealEngine };";
    const sandbox = { module: { exports: {} }, console, Date, Math, Number, isFinite, Object, Array };
    sandbox.exports = sandbox.module.exports;
    try {
      vm.runInNewContext(source, sandbox, { filename: "RYN_AutoHeal.user.js#autoheal" });
      const { runAll } = require("./sim-autoheal.js");
      const simFailures = runAll(
        sandbox.module.exports.createRynAutoHealEngine,
        "the copy inside RYN_AutoHeal.user.js, against the bundle's own rules"
      );
      check("every scenario passes on the shipped copy", simFailures === 0, `${simFailures} check(s)`);
    } catch (e) {
      check("the shipped copy runs", false, String(e && e.message));
    }
  }
}

console.log("");
if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("verify-autoheal: all checks pass");
