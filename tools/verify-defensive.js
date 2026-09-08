#!/usr/bin/env node
/*
 * verify-defensive.js
 *
 * Checks the defensive layer of Ryn Type 2 — the autoheal, the threat engine
 * and the anti systems — in two ways:
 *
 *   1. Behaviour. The real method bodies (evaluateThreat, getRangedThreat,
 *      getSustainedDamage, instaThreat) are lifted out of the shipped file and
 *      run against synthetic game state. Nothing is retyped, so a scenario
 *      that passes here passes on the code that ships.
 *
 *   2. Architecture. Structural invariants asserted against the file itself:
 *      that the heal runs first, that the defensive hold cannot leak past a
 *      tick, that no defensive path can reach the Q-fast food-key route, that
 *      shame cleanup is independent of the autoheal toggle, and that every
 *      constant is traceable to a value in the shipped game tables.
 *
 * The game tables are read out of the client itself rather than duplicated,
 * so a table edit that breaks an assumption surfaces here.
 *
 *   node tools/verify-defensive.js [path/to/Ryn_Type_2.user.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const TARGET = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(ROOT, "Ryn_Type_2.user.js");
const SRC = fs.readFileSync(TARGET, "utf8");

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (detail ? "  -> " + detail : "")); }
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${!cond && detail ? "  -> " + detail : ""}`);
}
function section(t) { console.log("\n=== " + t + " ==="); }

// --- game tables, read out of the client ------------------------------------
function tableBlock(decl) {
  const i = SRC.indexOf(decl);
  if (i === -1) throw new Error("table not found: " + decl);
  let depth = 0, started = false, j = i;
  for (; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === "[" || c === "{" || c === "(") { depth++; started = true; }
    else if (c === "]" || c === "}" || c === ")") { depth--; if (started && depth === 0) { j++; break; } }
  }
  return SRC.slice(i, j + 1);
}
const T = vm.runInNewContext(
  ["Weapons", "ItemGroups", "Items", "WeaponVariants", "Projectiles", "Hats"]
    .map(n => tableBlock("  const " + n + " = ")).join("\n") +
  "\n({ Weapons, ItemGroups, Items, WeaponVariants, Projectiles, Hats })", {});

// --- the real defensive code, lifted verbatim -------------------------------
function grab(re, what) {
  const m = SRC.match(re);
  if (!m) throw new Error("could not extract " + what);
  return m[0];
}
const constStart = SRC.indexOf("  // Defensive threat constants.");
const constEnd = SRC.indexOf("  const RANGED_INSTA_RANGE = 400;") + "  const RANGED_INSTA_RANGE = 400;".length;
if (constStart === -1 || constEnd < constStart) {
  console.error("This file has no defensive layer to verify — the threat constants are absent.");
  console.error("  target: " + TARGET);
  console.error("Run this against a build that carries the defensive layer.");
  process.exit(2);
}
const CONSTS = SRC.slice(constStart, constEnd);
const EVALUATE  = grab(/    evaluateThreat\(\) \{[\s\S]*?\n    \}\n/, "evaluateThreat");
const SUSTAINED = grab(/    getSustainedDamage\(weaponID, oneHitDamage\) \{[\s\S]*?\n    \}\n/, "getSustainedDamage");
const RANGED    = grab(/    getRangedThreat\(weaponID, lookingShield, distance\) \{[\s\S]*?\n    \}\n/, "getRangedThreat");
const INSTA     = grab(/    instaThreat\(\) \{[\s\S]*?\n    \}\n/, "instaThreat");
const YIELDSET  = grab(/  const DEFENSIVE_YIELD_MODULES = new Set\(\[[\s\S]*?\]\);/, "the yield set");

const Settings = {
  _antiSpam: true, _antiSpikeTick: true, _antiRangedInsta: true, _antiPoison: true,
  _antiVelocity: true, _defensivePriority: true, _shameZero: true, _autoheal: true, _kbSpike: true
};
const DataHandler = {
  getWeapon: id => T.Weapons[id],
  getProjectile: id => T.Projectiles[T.Weapons[id].projectile],
  isMelee: id => id != null && "damage" in T.Weapons[id],
  isShootable: id => id != null && "projectile" in T.Weapons[id]
};
const M = new Function(
  "Hats", "Items", "Weapons", "Projectiles", "Settings_default", "DataHandler_default",
  `${CONSTS}
   ${YIELDSET}
   class ThreatHost { ${EVALUATE} ${INSTA} }
   class PlayerHost {
     constructor(client) { this.client = client; }
     ${SUSTAINED}
     ${RANGED}
   }
   return { ThreatHost, PlayerHost, DEFENSIVE_YIELD_MODULES };`
)(T.Hats, T.Items, T.Weapons, T.Projectiles, Settings, DataHandler);

function mkPlayer() { return new M.PlayerHost({ SocketManager: { TICK: 1000 / 9 } }); }
function makeThreat(over = {}) {
  const player = Object.assign({
    hatID: 0, tempHealth: 100, currentHealth: 100, isTrapped: false, trappedIn: null,
    poisonCount: 0, tickCount: 100, damageTick: 0
  }, over.player || {});
  const t = Object.assign(new M.ThreatHost(), {
    client: { myPlayer: player, PlayerManager: { isEnemyByID: () => over.trapIsEnemy !== false } },
    potentialDamage: 0, potentialSpikeDamage: 0, potentialSpikeKnockbackDamage: 0,
    contactSpikeDamage: 0, placedSpikeDamage: 0, spikeThreatCount: 0,
    primaryDamage: 0, collidingSpike: false, willCollideSpike: false,
    possibleToKnockback: false, spikeTickThreat: false, velocitySpikeThreat: false,
    rangedInstaThreat: false, hatSwapBurst: false, spikeSyncThreat: false,
    velocityTickThreat: false, reverseInsta: false, toolHammerInsta: false,
    detectedEnemy: false, detectedDangerEnemy: false, poisonDamage: 0,
    threatLevel: 0, threatDamage: 0, threatLethal: false, trappedInEnemy: false
  }, over.em || {});
  t.client.myPlayer = player;
  return t;
}

// ---------------------------------------------------------------------------
section("Anti spam — daggers and bull-hat melee spam");
{
  const p = mkPlayer();
  // Weapons[7] daggers: dmg 20, speed 100ms. A 111ms tick fits one full
  // recycle; the 2-tick window fits two.
  const oneHit = 20;
  const sustained = p.getSustainedDamage(7, oneHit);
  check("daggers count more than one hit across the window", sustained > oneHit, `${oneHit} -> ${sustained}`);
  check("daggers land exactly 2 hits in a 2-tick window", sustained === 40, String(sustained));

  // Weapons[5] polearm: speed 700ms — slower than a tick, so one hit.
  check("polearm is not treated as spam", p.getSustainedDamage(5, 45) === 45, String(p.getSustainedDamage(5, 45)));
  // Weapons[3] short sword: speed 300ms > SPAM_WEAPON_SPEED 250 -> one hit.
  check("short sword is not treated as spam", p.getSustainedDamage(3, 35) === 35, String(p.getSustainedDamage(3, 35)));
  // Bull hat rides the same window: getMaxWeaponDamage already applied 1.5x.
  const bullDagger = p.getSustainedDamage(7, 20 * T.Hats[7].dmgMultO);
  check("bull-hat dagger spam scales with the hat", bullDagger === 60, String(bullDagger));

  Settings._antiSpam = false;
  check("toggle off restores single-hit behaviour", p.getSustainedDamage(7, 20) === 20);
  Settings._antiSpam = true;

  check("ranged weapon is never treated as melee spam", p.getSustainedDamage(15, 50) === 50);
  check("zero damage stays zero", p.getSustainedDamage(7, 0) === 0);
  check("null weapon is safe", p.getSustainedDamage(null, 20) === 20);
}

// ---------------------------------------------------------------------------
section("Anti instakill — musket / any bow / any ranged");
{
  const p = mkPlayer();
  // Values come from the shipped Projectiles table, not from literals here.
  check("musket reads 50", p.getRangedThreat(15, false, 300) === 50, String(p.getRangedThreat(15, false, 300)));
  check("hunting bow reads 25", p.getRangedThreat(9, false, 300) === 25);
  check("crossbow reads 35", p.getRangedThreat(12, false, 300) === 35);
  check("repeater crossbow reads 30", p.getRangedThreat(13, false, 300) === 30);
  check("melee weapon is not a ranged threat", p.getRangedThreat(5, false, 300) === 0);
  check("shield eats the projectile", p.getRangedThreat(15, true, 300) === 0);
  // Projectile ranges: bow 1000, crossbow/repeater 1200, musket 1400.
  check("bow out of projectile range is no threat", p.getRangedThreat(9, false, 1100) === 0);
  check("musket still reaches at 1300", p.getRangedThreat(15, false, 1300) === 50);
  check("musket out of range at 1500", p.getRangedThreat(15, false, 1500) === 0);
  check("null weapon is safe", p.getRangedThreat(null, false, 100) === 0);
  // The old rule was three bow ids; a musket raised from a hammer was invisible.
  check("musket is covered without being an id in a list", p.getRangedThreat(15, false, 200) > 0);
}

// ---------------------------------------------------------------------------
section("Threat engine — levels and combination");
{
  let t = makeThreat();
  t.evaluateThreat();
  check("quiet world is level 0", t.threatLevel === 0, "level " + t.threatLevel);
  check("quiet world is not lethal", t.threatLethal === false);

  // One polearm in range, full health: real but survivable.
  t = makeThreat({ em: { potentialDamage: 45, primaryDamage: 45, detectedEnemy: true } });
  t.evaluateThreat();
  check("single survivable hit is level 1", t.threatLevel === 1, "level " + t.threatLevel);
  check("single survivable hit is not lethal", t.threatLethal === false);

  // Same hit at 40hp: now lethal.
  t = makeThreat({ player: { tempHealth: 40 }, em: { potentialDamage: 45, primaryDamage: 45 } });
  t.evaluateThreat();
  check("hit that exceeds health is lethal", t.threatLethal === true);
  check("lethal is level 3", t.threatLevel === 3, "level " + t.threatLevel);

  // Soldier's 0.75 is applied to the sum, as Novastorm applies it.
  t = makeThreat({ player: { tempHealth: 40, hatID: 6 }, em: { potentialDamage: 45 } });
  t.evaluateThreat();
  check("soldier scales the damage sum", Math.abs(t.threatDamage - 45 * 0.75) < 1e-9, String(t.threatDamage));
  check("soldier turns a lethal hit survivable at 40hp", t.threatLethal === false);

  // Bull's own over-time tick is added on top, as Novastorm adds it.
  t = makeThreat({ player: { hatID: 7 }, em: { potentialDamage: 10 } });
  t.evaluateThreat();
  check("bull adds its own over-time tick", t.threatDamage === 15, String(t.threatDamage));

  // The 140 cap.
  t = makeThreat({ em: { potentialDamage: 500, potentialSpikeDamage: 500 } });
  t.evaluateThreat();
  check("damage is capped at 140", t.threatDamage === 140, String(t.threatDamage));
}

// ---------------------------------------------------------------------------
section("Anti sync spike — combined, not loudest");
{
  // Two enemies each land a spike on the same tick: 35 + 35.
  // The old max() read this as 35 and healed for half the incoming damage.
  const combined = 35 + 35;
  let t = makeThreat({
    player: { tempHealth: 60 },
    em: { placedSpikeDamage: combined, potentialSpikeDamage: combined, spikeThreatCount: 2, primaryDamage: 0 }
  });
  t.evaluateThreat();
  check("two synced spikes sum to 70", t.threatDamage === 70, String(t.threatDamage));
  check("two synced spikes at 60hp read lethal", t.threatLethal === true);

  const loudestOnly = makeThreat({
    player: { tempHealth: 60 },
    em: { placedSpikeDamage: 35, potentialSpikeDamage: 35, spikeThreatCount: 1 }
  });
  loudestOnly.evaluateThreat();
  check("the same pair read as one spike would NOT be lethal (the old bug)", loudestOnly.threatLethal === false);

  // Two spike sources with neither lethal still raise the level.
  t = makeThreat({ em: { potentialSpikeDamage: 40, spikeThreatCount: 2 } });
  t.evaluateThreat();
  check("multiple spike sources reach at least level 2", t.threatLevel >= 2, "level " + t.threatLevel);
}

// ---------------------------------------------------------------------------
section("Anti KB spike / spike sequence (Misery's spikeDangerNow)");
{
  // Spinning spikes 45 + polearm 45 = 90, under 100, at 95hp.
  // Novastorm's `totalDmgPot >= 100` alone would not call this an emergency.
  const t = makeThreat({
    player: { tempHealth: 95 },
    em: { potentialDamage: 45, primaryDamage: 45, potentialSpikeKnockbackDamage: 45,
          potentialSpikeDamage: 45, possibleToKnockback: true }
  });
  t.evaluateThreat();
  check("kb-into-spike sequence sums to 90", t.threatDamage === 90, String(t.threatDamage));
  check("survivable-looking spike sequence still reaches level 2", t.threatLevel >= 2, "level " + t.threatLevel);

  // At 85hp the same sequence is lethal and must take the tick.
  const lethal = makeThreat({
    player: { tempHealth: 85 },
    em: { potentialDamage: 45, primaryDamage: 45, potentialSpikeKnockbackDamage: 45,
          potentialSpikeDamage: 45, possibleToKnockback: true }
  });
  lethal.evaluateThreat();
  check("lethal spike sequence is level 3", lethal.threatLevel === 3, "level " + lethal.threatLevel);
}

// ---------------------------------------------------------------------------
section("Anti instakill while inside an enemy trap");
{
  const trap = { ownerID: 99 };
  // Trapped, musket up, nothing lethal yet on the raw number.
  const t = makeThreat({
    player: { tempHealth: 100, isTrapped: true, trappedIn: trap },
    em: { potentialDamage: 50, rangedInstaThreat: true, primaryDamage: 0 }
  });
  t.evaluateThreat();
  check("trapped-in-enemy is detected", t.trappedInEnemy === true);
  check("trapped + ranged insta takes the tick even below lethal", t.threatLevel === 3, "level " + t.threatLevel);

  // The same state untrapped is not yet an emergency.
  const free = makeThreat({ em: { potentialDamage: 50, rangedInstaThreat: true } });
  free.evaluateThreat();
  check("same threat untrapped stays level 2", free.threatLevel === 2, "level " + free.threatLevel);

  // Trapped in our OWN trap is not the emergency case.
  const own = makeThreat({
    player: { isTrapped: true, trappedIn: trap },
    em: { potentialDamage: 50, rangedInstaThreat: true },
    trapIsEnemy: false
  });
  own.evaluateThreat();
  check("our own trap is not the trapped-in-enemy case", own.trappedInEnemy === false);
}

// ---------------------------------------------------------------------------
section("Anti spike tick + anti velocity feed the level");
{
  let t = makeThreat({ player: { tempHealth: 100 }, em: { spikeTickThreat: true, potentialSpikeDamage: 45, potentialDamage: 45, primaryDamage: 45 } });
  t.evaluateThreat();
  check("spike tick with a swing behind it reaches level 2+", t.threatLevel >= 2, "level " + t.threatLevel);

  t = makeThreat({ player: { isTrapped: true, trappedIn: { ownerID: 1 } }, em: { spikeTickThreat: true, potentialSpikeDamage: 45 } });
  t.evaluateThreat();
  check("spike tick while trapped is level 3", t.threatLevel === 3, "level " + t.threatLevel);
}

// ---------------------------------------------------------------------------
section("Anti poison");
{
  const t = makeThreat({ em: { poisonDamage: 5, potentialDamage: 5 } });
  t.evaluateThreat();
  check("a lone poison tick registers as a threat", t.threatLevel >= 1, "level " + t.threatLevel);
  check("a lone poison tick is not an emergency", t.threatLevel === 1, "level " + t.threatLevel);

  // Poison is what makes an otherwise-survivable hit lethal.
  const lethal = makeThreat({ player: { tempHealth: 48 }, em: { potentialDamage: 45 + 5, primaryDamage: 45 } });
  lethal.evaluateThreat();
  check("poison pushes a 45 hit over 48hp into lethal", lethal.threatLethal === true);
  const noPoison = makeThreat({ player: { tempHealth: 48 }, em: { potentialDamage: 45, primaryDamage: 45 } });
  noPoison.evaluateThreat();
  check("the same hit without poison is survivable", noPoison.threatLethal === false);
}

// ---------------------------------------------------------------------------
section("Anti clown — turret-gear hat-swap burst");
{
  const t = makeThreat({ em: { hatSwapBurst: true, potentialDamage: 25 } });
  t.evaluateThreat();
  check("a predicted turret-gear swap raises the level", t.threatLevel >= 2, "level " + t.threatLevel);
  check("the swapped turret's 25 is in the damage sum", t.threatDamage === 25, String(t.threatDamage));
}

// ---------------------------------------------------------------------------
section("Defensive priority — what yields and what does not");
{
  const y = M.DEFENSIVE_YIELD_MODULES;
  const mustYield = ["instakill", "smartInsta", "bowInsta", "musketBowInsta", "autoSteal",
                     "turretSteal", "autoPush", "dashMovement", "autoGrind", "autoMill",
                     "killChat", "deathProvoke", "spikeSync", "velocityTick"];
  for (const m of mustYield) check(`${m} yields`, y.has(m));

  const mustRun = ["antiInsta", "shameReset", "autoShield", "antiSpikePush", "antiRetrap",
                   "placementDefense", "autoBreak", "safeWalk", "trapTick", "autoHat",
                   "updateAngle", "updateAttack", "defaultHat", "reloading", "placer"];
  for (const m of mustRun) check(`${m} keeps running`, !y.has(m));

  check("Spike Tick stays independent of the defensive layer", !y.has("trapTick"));
}

// ---------------------------------------------------------------------------
section("Level 3 is reached only by real emergencies");
{
  // A single enemy standing near us with nothing ready must not take the tick.
  const idle = makeThreat({ em: { detectedEnemy: true } });
  idle.evaluateThreat();
  check("a nearby idle enemy does not take the tick", idle.threatLevel < 3, "level " + idle.threatLevel);

  // Nor should a survivable single hit.
  const oneHit = makeThreat({ em: { potentialDamage: 35, primaryDamage: 35, detectedEnemy: true } });
  oneHit.evaluateThreat();
  check("one survivable sword hit does not take the tick", oneHit.threatLevel < 3, "level " + oneHit.threatLevel);

  // Full health, no threat at all -> nothing held.
  const quiet = makeThreat();
  quiet.evaluateThreat();
  check("a quiet tick holds nothing", quiet.threatLevel === 0);
}


// ---------------------------------------------------------------------------
section("Anti velocity stays out of the offensive gating");
{
  // velocitySpikeThreat must reach the heal without reaching instaThreat(),
  // which gates a dozen offensive modules that have nothing to do with
  // walking into a spike.
  const t = makeThreat({ em: { velocitySpikeThreat: true, potentialSpikeDamage: 45, contactSpikeDamage: 45 } });
  t.evaluateThreat();
  check("velocity-into-spike raises the threat level", t.threatLevel >= 2, "level " + t.threatLevel);
  check("velocity-into-spike does NOT set instaThreat", t.instaThreat() === false);
}

// ---------------------------------------------------------------------------
section("Q Fast — the strict prohibition");
{
  // Q is the food keybind (_food: "KeyQ"). The Q-fast path is
  // keydown -> InputHandler.placementHandler(2) -> ModuleHandler.startPlacement(2)
  // -> currentType = 2 -> Placer.postTick() eats every tick while held.
  check("_food is still the Q keybind (so this test is testing the right thing)",
        /_food:\s*"KeyQ"/.test(SRC));

  // Every startPlacement / currentType writer must be user-input driven.
  // All matches, minus the method definition itself.
  const allSites = [...SRC.matchAll(/startPlacement\(/g)].map(m => {
    const line = SRC.slice(0, m.index).split("\n").length;
    return { line, text: SRC.split("\n")[line - 1].trim() };
  });
  const defSite = allSites.filter(c => /^startPlacement\(type\) \{/.test(c.text));
  const callers = allSites.filter(c => !/^startPlacement\(type\) \{/.test(c.text));
  check("the startPlacement definition is found exactly once", defSite.length === 1, String(defSite.length));
  check("startPlacement has 5 call sites", callers.length === 5,
        callers.map(c => c.line).join(","));
  // Each call must sit inside a handler reached only from a real key event.
  const inputDriven = callers.every(c => {
    const ctx = SRC.split("\n").slice(Math.max(0, c.line - 60), c.line).join("\n");
    return /placementHandler\(type, code\)|handleKeyup\(event\)|const _place = itemType/.test(ctx);
  });
  check("every startPlacement call site sits in a key handler", inputDriven,
        callers.map(c => c.line).join(","));
  // And the only one that can ever be handed food (type 2) is the keybind path.
  check("the F/G quick-place helper only ever places traps and turrets",
        /_place\(7\)/.test(SRC) && /_place\(8\)/.test(SRC) && !/_place\(2\)/.test(SRC));

  // The defensive layer must never reach for it.
  function bodyOf(re) { const m = SRC.match(re); return m ? m[0] : ""; }
  const defensiveBodies = [
    bodyOf(/class AntiInsta \{[\s\S]*?\n  \}\n/),
    bodyOf(/class ShameReset \{[\s\S]*?\n  \}\n/),
    bodyOf(/    evaluateThreat\(\) \{[\s\S]*?\n    \}\n/),
    bodyOf(/    detectSpikeInsta\(\) \{[\s\S]*?\n    \}\n/),
    bodyOf(/    getRangedThreat\([\s\S]*?\n    \}\n/),
    bodyOf(/    getSustainedDamage\([\s\S]*?\n    \}\n/)
  ].join("\n");
  check("defensive code bodies were all found", defensiveBodies.length > 3000, String(defensiveBodies.length));
  check("defensive code never calls startPlacement", !/startPlacement/.test(defensiveBodies));
  check("defensive code never writes currentType", !/currentType\s*=[^=]/.test(defensiveBodies));
  check("defensive code never references the food keybind", !/_food/.test(defensiveBodies));
  check("defensive code never synthesises a key event", !/KeyboardEvent|dispatchEvent/.test(defensiveBodies));
  // The one legitimate heal path.
  check("the heal goes through ModuleHandler.heal()", /ModuleHandler\.heal\(\)/.test(defensiveBodies));

  // No synthetic key event anywhere targets the food bind.
  const synth = [...SRC.matchAll(/new KeyboardEvent\([\s\S]{0,200}/g)].map(m => m[0]).join("\n");
  check("no synthetic KeyboardEvent carries the food bind", !/_food/.test(synth));
}

// ---------------------------------------------------------------------------
section("Priority — the heal runs first");
{
  const line = SRC.match(/this\.modules = \[ (.*?) \];/)[1];
  const mods = line.split(",").map(s => s.trim().replace("this.staticModules.", ""));
  check("antiInsta is first in the module list", mods[0] === "antiInsta", mods[0]);
  check("antiInsta appears exactly once", mods.filter(m => m === "antiInsta").length === 1);
  check("the module list still has all 55 modules", mods.length === 55, String(mods.length));
  // Everything that reads healedOnce must run after the heal.
  for (const reader of ["placer", "autoGrind", "updateAngle"]) {
    check(`${reader} still runs after antiInsta`, mods.indexOf(reader) > 0, String(mods.indexOf(reader)));
  }
}

// ---------------------------------------------------------------------------
section("Priority — the hold is per-tick and cannot leak");
{
  const postTick = SRC.match(/    postTick\(\) \{\n      if \(Settings_default\._circleRotation[\s\S]*?\n    \}\n  \}\n  const ModuleHandler_default/);
  check("ModuleHandler.postTick located", !!postTick);
  const body = postTick ? postTick[0] : "";
  const clearIdx = body.indexOf("this.defensiveHold = false;");
  const loopIdx = body.indexOf("for (const module of this.modules)");
  check("defensiveHold is cleared before the module loop runs",
        clearIdx !== -1 && loopIdx !== -1 && clearIdx < loopIdx, `clear@${clearIdx} loop@${loopIdx}`);
  check("defensiveLevel is cleared too", body.includes("this.defensiveLevel = 0;"));
  check("the loop consults the yield set", /defensiveHold && DEFENSIVE_YIELD_MODULES\.has/.test(body));
  // Only the defensive layer raises it.
  const raises = [...SRC.matchAll(/defensiveHold = true/g)];
  check("exactly one place raises defensiveHold", raises.length === 1, String(raises.length));
  check("it is behind the _defensivePriority toggle",
        /Settings_default\._defensivePriority && EnemyManager2\.threatLevel >= 3[\s\S]{0,80}defensiveHold = true/.test(SRC));
}

// ---------------------------------------------------------------------------
section("Compatibility — nothing is permanently disabled");
{
  for (const [name, re] of [
    ["Auto Place",  /if \(!Settings_default\._autoplacer\) return;/],
    ["Preplace",    /if \(Settings_default\._prePlace\) modes\.push\(RPE_MODE\.PREPLACE\);/],
    ["Replace",     /if \(!Settings_default\._prePlace && !Settings_default\._replace\) return;/],
    ["Spike Tick",  /class TrapTick \{/],
    ["Auto Shield", /class AutoShield \{/],
    ["Anti Retrap", /class AntiRetrap \{/],
    ["Autobreak",   /class Autobreak \{/]
  ]) check(`${name} is still present and gated on its own setting`, re.test(SRC));

  // The holds are early-returns, never state mutations.
  const holds = [...SRC.matchAll(/defensiveHold\) return;/g)];
  check("every inline hold is a plain early return", holds.length === 3, String(holds.length));
}

// ---------------------------------------------------------------------------
section("Shame — target zero");
{
  const sr = SRC.match(/class ShameReset \{[\s\S]*?\n  \}\n/)[0];
  check("shame cleanup has its own toggle, not autoheal's", /Settings_default\._shameZero/.test(sr));
  check("it no longer rides on _autoheal", !/Settings_default\._autoheal/.test(sr));
  check("any shame above zero is the emergency condition", /shameCount > 0/.test(sr));
  check("it stands down during a level-3 sequence", /defensiveLevel >= 3/.test(sr));
  check("it still stands down on a live insta threat", /instaThreat\(\)/.test(sr));
  check("it still yields to a manual food hold", /currentType === 2/.test(sr));
  check("it is aligned to the over-time tick (no per-tick equip spam)", /isBullTickTime\(\)/.test(sr));
}

// ---------------------------------------------------------------------------
section("Packet discipline");
{
  const ai = SRC.match(/class AntiInsta \{[\s\S]*?\n  \}\n/)[0];
  check("heal count is bounded", /needTimes > ANTI_INSTA_MAX_HEALS/.test(ai));
  check("heal is skipped at full health", /tempHealth >= maxHealth/.test(ai));
  check("heal is skipped while the server refuses food", /shameActive/.test(ai));
  check("no timers or intervals in the defensive layer", !/setInterval|setTimeout/.test(ai));
}

// ---------------------------------------------------------------------------
section("Grounding — no invented mechanics");
{
  // Every magic number in the new constants must be traceable to the tables.
  check("TURRET_DAMAGE 25 == Projectiles[1].dmg", T.Projectiles[1].damage === 25);
  check("TURRET_RANGE 700 matches the turret reach already used elsewhere", /collidingEntity\(target, 700 \+ hitScale\)/.test(SRC));
  check("SOLDIER_HAT 6 has dmgMult", T.Hats[6].dmgMult === 0.75);
  check("BULL_HAT 7 has healthRegen -5", T.Hats[7].healthRegen === -5);
  check("SHAME_HAT 45 is the Shame hat", T.Hats[45].name === "Shame!");
  check("TURRET_HAT 53 is Turret Gear", T.Hats[53].name === "Turret Gear");
  check("POISON_SPIKE_TYPE 8 carries pDmg", T.Items[8].pDmg === 5);
  check("SPAM_WEAPON_SPEED 250 admits daggers (100) and excludes sword (300)",
        T.Weapons[7].speed <= 250 && T.Weapons[3].speed > 250);
  check("OVER_TIME_DAMAGE 5 matches plague mask poisonDmg", T.Hats[21].poisonDmg === 5);
}


console.log("\n" + "=".repeat(64));
console.log(`DEFENSIVE LAYER: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFailures:");
  failures.forEach(f => console.log("  - " + f));
  process.exit(1);
}
console.log("target: " + path.relative(ROOT, TARGET));
