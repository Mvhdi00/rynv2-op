#!/usr/bin/env node
/*
 * verify-autoheal.js — every constant the Auto Heal Engine reasons from,
 * re-derived from the game itself.
 *
 * The engine's whole claim is that it uses the game's real mechanics rather
 * than tuned numbers. This is what makes that checkable: each constant is read
 * back out of src/game_index.js (the shipped bundle) or
 * drivers/game-drivers.json (the tables extracted from it) and compared with
 * what the engine declares. A drift in either direction fails.
 *
 * Usage: node tools/verify-autoheal.js [path/to/built.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const bundle = fs.readFileSync(path.join(ROOT, "src", "game_index.js"), "utf8");
const drivers = require(path.join(ROOT, "drivers", "game-drivers.json"));
const engineSource = fs.readFileSync(
  path.join(ROOT, "src", "autoheal", "ryn-autoheal-engine.js"), "utf8");

const { createRynAutoHealEngine } = require(
  path.join(ROOT, "src", "autoheal", "ryn-autoheal-engine.js"));
const AH = createRynAutoHealEngine({}).AH;

let failures = 0;
let checks = 0;

function check(name, expected, actual, note) {
  checks += 1;
  const ok = expected === actual;
  if (!ok) failures += 1;
  const line = `${ok ? "  ok  " : "  FAIL"} ${name.padEnd(34)} ${String(actual).padEnd(10)}` +
    (ok ? "" : ` expected ${expected}`) + (note ? "   (" + note + ")" : "");
  console.log(line);
}

/* A number pulled straight out of the bundle by pattern. Missing is a
 * failure: the point is that the rule is still there to be read. */
function fromBundle(name, pattern, index) {
  const m = bundle.match(pattern);
  if (!m) {
    checks += 1;
    failures += 1;
    console.log(`  FAIL ${name.padEnd(34)} not found in src/game_index.js`);
    return null;
  }
  return Number(m[index === undefined ? 1 : index]);
}

console.log("\nAuto Heal Engine — constants, against the shipped game\n");
console.log("the shame rule (game_index.js, Player.buildItem)");

/* if (this.hitTime) { const W = Date.now() - this.hitTime; ...
 *   W <= 120 ? (this.shameCount++, this.shameCount >= 8 && (this.shameTimer = 3e4, ... */
check("SHAME_WINDOW_MS", fromBundle("shame window", /W\s*<=\s*(\d+)\s*\?\s*\(this\.shameCount\+\+/),
  AH.SHAME_WINDOW_MS, "W <= 120 decides +1 vs -2");
check("SHAME_LOCK_AT", fromBundle("shame lock at", /this\.shameCount\s*>=\s*(\d+)\s*&&\s*\(this\.shameTimer/),
  AH.SHAME_LOCK_AT, "the press that arms the lock");
check("SHAME_LOCK_MS", (() => {
  const m = bundle.match(/this\.shameTimer\s*=\s*(3e4|30000)/);
  return m ? (m[1] === "3e4" ? 30000 : Number(m[1])) : null;
})(), AH.SHAME_LOCK_MS, "how long food stays refused");
check("SHAME_CREDIT", fromBundle("shame credit", /this\.shameCount\s*-=\s*(\d+)/),
  AH.SHAME_CREDIT, "a late press is worth -2");
check("SHAME_MAX", AH.SHAME_LOCK_AT - 1, AH.SHAME_MAX, "the highest count that can still heal");

/* The objective itself. Not derived from the game — it is the requirement —
 * but checked here because it is the one number the whole engine turns on. */
check("SHAME_TARGET", 0, AH.SHAME_TARGET, "the operating point, not the ceiling");

console.log("\nhealth, regen and the one-second tick");
check("MAX_HEALTH", fromBundle("max health", /this\.maxHealth\s*=\s*(\d+)/), AH.MAX_HEALTH,
  "the server spawns players with 100");
check("DOT_PERIOD_MS", (() => {
  const m = bundle.match(/this\.healCol\s*&&\s*this\.changeHealth\(this\.healCol,\s*this\),\s*\n?\s*x\s*=\s*(1e3|1000)/);
  return m ? (m[1] === "1e3" ? 1000 : Number(m[1])) : null;
})(), AH.DOT_PERIOD_MS, "the regen / damage-over-time counter resets to 1000");
check("TICK_MS", 1000 / drivers.config.serverUpdateRate, AH.TICK_MS,
  "config.serverUpdateRate " + drivers.config.serverUpdateRate);
check("DOT_PERIOD_TICKS", Math.round(AH.DOT_PERIOD_MS / (1000 / drivers.config.serverUpdateRate)),
  AH.DOT_PERIOD_TICKS, "one second of ticks");

console.log("\nfood (items, and what a press is worth)");
const foods = drivers.items.filter(i => i.group && i.group.id === 0);
check("food group is items 0..2", 3, foods.length);
const restores = { apple: 20, cookie: 40, cheese: 30 };
for (const food of foods) {
  const m = bundle.match(
    new RegExp('name: "' + food.name + '"[\\s\\S]{0,400}?changeHealth\\((\\d+)'));
  check("restore:" + food.name, m ? Number(m[1]) : null, restores[food.name],
    "item.consume -> changeHealth");
}
/* changeHealth refuses a heal at the cap and buildItem only spends resources
 * when consume returned true — which is what makes a recovery press at full
 * health free, and is the mechanic the whole shame policy leans on. */
check("full-health press is free", true,
  /if\s*\(f\s*>\s*0\s*&&\s*this\.health\s*>=\s*this\.maxHealth\)\s*\n?\s*return\s*!1/.test(bundle) &&
  /V\s*&&\s*\(this\.useRes\(f\)/.test(bundle),
  "changeHealth returns false at the cap, useRes is gated on it");

console.log("\nhats the gear manager may use");
const hats = {};
for (const h of drivers.hats) hats[h.id] = h;
check("HAT_SOLDIER", 6, AH.HAT_SOLDIER, hats[6] && hats[6].name);
check("soldier dmgMult", 0.75, hats[AH.HAT_SOLDIER].dmgMult, "the only real reduction");
check("HAT_EMP", 22, AH.HAT_EMP, hats[22] && hats[22].name);
check("emp antiTurret", 1, hats[AH.HAT_EMP].antiTurret, "turrets do not fire at us");
check("HAT_BULL", 7, AH.HAT_BULL, hats[7] && hats[7].name);
check("bull healthRegen", -5, hats[AH.HAT_BULL].healthRegen, "self-damage, no protection");
check("bull has no dmgMult", undefined, hats[AH.HAT_BULL].dmgMult,
  "which is why it is never equipped as defence");
check("HAT_TURRET_GEAR", 53, AH.HAT_TURRET_GEAR, hats[53] && hats[53].name);
check("turret gear range", 700, hats[AH.HAT_TURRET_GEAR].turret.range);
check("turret gear rate", AH.TURRET_GEAR_RATE_MS, hats[AH.HAT_TURRET_GEAR].turret.rate);
check("HAT_SHAME", 45, AH.HAT_SHAME, hats[45] && hats[45].name);
check("HAT_ASSASSIN noEat", true, !!hats[AH.HAT_ASSASSIN].noEat, "food is refused outright");

console.log("\nweapons the detectors name");
const weaponByName = {};
drivers.weapons.forEach((w, i) => { weaponByName[w.name] = i; });
check("WEAPON_POLEARM", weaponByName["polearm"], AH.WEAPON_POLEARM);
check("WEAPON_DAGGER", weaponByName["daggers"], AH.WEAPON_DAGGER);
check("WEAPON_BOW", weaponByName["hunting bow"], AH.WEAPON_BOW);
check("WEAPON_CROSSBOW", weaponByName["crossbow"], AH.WEAPON_CROSSBOW);
check("WEAPON_REPEATER", weaponByName["repeater crossbow"], AH.WEAPON_REPEATER);
check("WEAPON_MUSKET", weaponByName["musket"], AH.WEAPON_MUSKET);
check("WEAPON_GREAT_HAMMER", weaponByName["great hammer"], AH.WEAPON_GREAT_HAMMER);
check("WEAPON_KATANA", weaponByName["katana"], AH.WEAPON_KATANA);
check("WEAPON_SHORT_SWORD", weaponByName["short sword"], AH.WEAPON_SHORT_SWORD);
check("WEAPON_BAT", weaponByName["bat"], AH.WEAPON_BAT);
/* The one-tick set is the melee weapons that can take most of a bar in a
 * swing once the bull multiplier is on them. */
const bull = hats[AH.HAT_BULL].dmgMultO;
for (const id of AH.ONETICK_WEAPONS) {
  const w = drivers.weapons[id];
  check("one-tick candidate:" + w.name, true, w.dmg * bull >= 50,
    Math.round(w.dmg * bull) + " under bull");
}
check("knockback base", true, /\.3\s*\*\s*\(S\.weightM\s*\|\|\s*1\)\s*\+\s*l\.weapons\[this\.weaponIndex\]\.knock/
  .test(bundle.replace(/\s+/g, " ")) || /0?\.3 \* \(.*weightM/.test(bundle),
  "impulse = 0.3 + weapon.knock");

console.log("\nprojectiles and turrets");
check("PROJ_TURRET", 1, AH.PROJ_TURRET);
check("TURRET_DAMAGE", drivers.projectiles[AH.PROJ_TURRET].dmg, AH.TURRET_DAMAGE);
check("PROJ_MUSKET", drivers.weapons[AH.WEAPON_MUSKET].projectile, AH.PROJ_MUSKET);
check("musket damage", 50, drivers.projectiles[AH.PROJ_MUSKET].dmg);
const arrowSources = [AH.WEAPON_BOW, AH.WEAPON_CROSSBOW, AH.WEAPON_REPEATER]
  .map(id => drivers.weapons[id].projectile);
check("PROJ_ARROWS", arrowSources.join(","), AH.PROJ_ARROWS.slice().sort().join(","));
const turretItem = drivers.items.find(i => i.name === "turret");
check("TURRET_RANGE", turretItem.shootRange, AH.TURRET_RANGE);
check("TURRET_RATE_MS", turretItem.shootRate, AH.TURRET_RATE_MS);
check("ITEM_TURRET_GROUP", turretItem.group.id, AH.ITEM_TURRET_GROUP);

console.log("\nitem groups the engine looks for");
const groupOf = name => drivers.items.find(i => i.name === name).group.id;
check("ITEM_SPIKE_GROUP", groupOf("spikes"), AH.ITEM_SPIKE_GROUP);
check("ITEM_TRAP_GROUP", groupOf("pit trap"), AH.ITEM_TRAP_GROUP);
check("ITEM_TRAP index", drivers.items.findIndex(i => i.name === "pit trap"), AH.ITEM_TRAP);
check("ITEM_HEAL_GROUP", groupOf("healing pad"), AH.ITEM_HEAL_GROUP);
check("healing pad healCol", 15, drivers.items.find(i => i.name === "healing pad").healCol);

console.log("\npacket costs, counted at the wire");
/* One press is selectItem + attack + whichWeapon, and each of those is one
 * PacketManager.send. A burst pays the restore once. */
check("PACKETS_PRESS", 3, AH.PACKETS_PRESS, "select + attack + restore");
check("PACKETS_PRESS_BODY", 2, AH.PACKETS_PRESS_BODY, "select + attack");
check("PACKETS_PRESS_RESTORE", 1, AH.PACKETS_PRESS_RESTORE, "whichWeapon, once per burst");
check("PACKETS_EQUIP", 1, AH.PACKETS_EQUIP, "PacketManager.equip");
check("PACKETS_MOVE", 1, AH.PACKETS_MOVE, "PacketManager.move");
check("burst arithmetic", 7, 3 * AH.PACKETS_PRESS_BODY + AH.PACKETS_PRESS_RESTORE,
  "three presses cost seven frames, not nine");

console.log("\nmovement and the spatial grid");
check("playerDecel", drivers.config.playerDecel, 0.993, "velocity decay per ms");
check("playerSpeed", drivers.config.playerSpeed, 0.0016, "acceleration per ms");
check("terminal speed per tick", 25,
  Math.round((drivers.config.playerSpeed / (1 - drivers.config.playerDecel)) *
    (1000 / drivers.config.serverUpdateRate)),
  "what the evasion planner floors at");
check("GRID_CELL_PX", 100, AH.GRID_CELL_PX, "SpatialHashGrid2D(100)");
check("HEAL_PAD_SCALE", drivers.items.find(i => i.name === "healing pad").scale,
  AH.HEAL_PAD_SCALE);

/* ---- the source itself ------------------------------------------- */
console.log("\nsource invariants");
function sourceCheck(name, ok, note) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name.padEnd(34)} ${note || ""}`);
}
sourceCheck("no shame target of 7", !/SHAME_TARGET:\s*7/.test(engineSource));
sourceCheck("no second packet scheduler",
  (engineSource.match(/setTimeout|setInterval|requestAnimationFrame/g) || []).length === 0,
  "no timers: every action leaves on the tick that decided it");
sourceCheck("one packet ledger",
  (engineSource.match(/class PacketBudget/g) || []).length === 1);
sourceCheck("one gear manager",
  (engineSource.match(/class DefensiveGearManager/g) || []).length === 1);
sourceCheck("gear vocabulary excludes bull",
  !/GEAR\.SOLDIER : GEAR\.BULL|gear: GEAR\.BULL/.test(engineSource),
  "bull has no defensive property in the tables");
sourceCheck("every send is budgeted",
  (engineSource.match(/pressFoodOnly\(\)/g) || []).length === 2,
  "one call site, one declaration");

/* ---- the built userscript, when one is given --------------------- */
const target = process.argv[2];
if (target) {
  console.log("\nbuilt script: " + target);
  const built = fs.readFileSync(path.resolve(target), "utf8");
  sourceCheck("engine spliced once",
    (built.match(/function createRynAutoHealEngine\(deps\)/g) || []).length === 1);
  sourceCheck("weapons injected", /get Weapons\(\) \{ return Weapons; \}/.test(built));
  sourceCheck("projectiles injected", /get Projectiles\(\) \{ return Projectiles; \}/.test(built));
  sourceCheck("config injected", /get Config\(\) \{ return Config_default; \}/.test(built));
  sourceCheck("gear lock honoured by Autohat", /_ahGearHat\(ModuleHandler\)/.test(built));
  sourceCheck("gear lock cleared each tick", /this\._ahGearLock = null;/.test(built));
  sourceCheck("shame reset stands down", /Settings_default\._autoHealEngine/.test(built));
}

console.log(`\n${checks - failures}/${checks} checks passed\n`);
process.exit(failures ? 1 : 0);
