#!/usr/bin/env node
/*
 * verify-autoheal.js — the Auto Heal Engine's constants against the bundle.
 *
 * Every number in the engine's `AH` block is meant to be a fact from
 * src/game_index.js rather than a tuning knob, and the ones the defensive
 * layers are built on — reaches, projectile speeds, collision radii, the
 * damage multiplier the Soldier Helmet applies — are the ones that quietly
 * stop being true when the game ships a balance change.
 *
 * This re-derives them from drivers/game-drivers.json (which
 * tools/extract-drivers.js produces from the bundle) and fails if the engine
 * disagrees. tools/verify-drivers.js already checks that the client's own
 * tables match; this checks the constants the engine hard-codes on top.
 *
 *     node tools/verify-autoheal.js [RYN_AutoHeal.user.js]
 */

const path = require("path");
const { load, DEFAULT_SCRIPT } = require("./extract-autoheal.js");

const target = process.argv[2] || DEFAULT_SCRIPT;
const drivers = require(path.join(__dirname, "..", "drivers", "game-drivers.json"));

const Hats = {};
for (const h of drivers.hats) Hats[h.id] = h;

const AutoHealEngine = load(target)({
  Items: drivers.items, Hats, Accessories: {},
  Weapons: drivers.weapons, Projectiles: drivers.projectiles, Settings: {}
});
const AH = AutoHealEngine.AH;

const problems = [];
const notes = [];

function check(name, actual, expected) {
  if (actual !== expected) {
    problems.push(`${name}: engine has ${actual}, bundle has ${expected}`);
  } else {
    notes.push(`ok    ${name} = ${expected}`);
  }
}

/* ---- geometry --------------------------------------------------------- */
check("PLAYER_SCALE", AH.PLAYER_SCALE, drivers.config.playerScale);
check("GATHER_ANGLE", AH.GATHER_ANGLE, drivers.config.gatherAngle);

check("TICK_MS", AH.TICK_MS, 1000 / drivers.config.serverUpdateRate);
check("DOT_PERIOD_TICKS", AH.DOT_PERIOD_TICKS, drivers.config.serverUpdateRate);

/* ---- hats ------------------------------------------------------------- */
check("HAT_SOLDIER", Hats[AH.HAT_SOLDIER].name, "Soldier Helmet");
check("SOLDIER_MULT_DEFAULT", AH.SOLDIER_MULT_DEFAULT, Hats[AH.HAT_SOLDIER].dmgMult);
check("HAT_BULL", Hats[AH.HAT_BULL].name, "Bull Helmet");
check("HAT_SHAME", Hats[AH.HAT_SHAME].name, "Shame!");
check("HAT_ASSASSIN noEat", !!Hats[AH.HAT_ASSASSIN].noEat, true);
check("HAT_TURRET_GEAR", Hats[AH.HAT_TURRET_GEAR].name, "Turret Gear");
check("HAT_MARKSMAN", Hats[AH.HAT_MARKSMAN].name, "Marksman Cap");
check("MARKSMAN_AMLT", AH.MARKSMAN_AMLT, Hats[AH.HAT_MARKSMAN].aMlt);
check("TURRET_GEAR_RATE_MS", AH.TURRET_GEAR_RATE_MS, Hats[AH.HAT_TURRET_GEAR].turret.rate);

/* ---- weapons ---------------------------------------------------------- */
const W = drivers.weapons;
check("WEAPON_POLEARM", W[AH.WEAPON_POLEARM].name, "polearm");
check("WEAPON_DAGGER", W[AH.WEAPON_DAGGER].name, "daggers");
check("WEAPON_BOW", W[AH.WEAPON_BOW].name, "hunting bow");
check("WEAPON_HAMMER", W[AH.WEAPON_HAMMER].name, "great hammer");
check("WEAPON_CROSSBOW", W[AH.WEAPON_CROSSBOW].name, "crossbow");
check("WEAPON_REPEATER", W[AH.WEAPON_REPEATER].name, "repeater crossbow");
check("WEAPON_MUSKET", W[AH.WEAPON_MUSKET].name, "musket");
check("DAGGER_SWING_MS", AH.DAGGER_SWING_MS, W[AH.WEAPON_DAGGER].speed);

/* ---- projectiles ------------------------------------------------------ */
check("PROJ_MUSKET", AH.PROJ_MUSKET, W[AH.WEAPON_MUSKET].projectile);
check("PROJ_TURRET", AH.PROJ_TURRET, drivers.items[AH.ITEM_TURRET].projectile);
const arrows = [W[AH.WEAPON_BOW], W[AH.WEAPON_CROSSBOW], W[AH.WEAPON_REPEATER]]
  .map(w => w.projectile);
check("PROJ_ARROWS", AH.PROJ_ARROWS.join(","), arrows.join(","));

/* ---- items ------------------------------------------------------------ */
check("ITEM_TURRET", drivers.items[AH.ITEM_TURRET].name, "turret");
check("TURRET_RANGE", AH.TURRET_RANGE, drivers.items[AH.ITEM_TURRET].shootRange);
check("TURRET_RATE_MS", AH.TURRET_RATE_MS, drivers.items[AH.ITEM_TURRET].shootRate);
check("ITEM_TRAP", drivers.items[AH.ITEM_TRAP].name, "pit trap");
check("GROUP_SPIKES", drivers.itemGroups[AH.GROUP_SPIKES].name, "spikes");

/* ---- derived reaches, spot-checked against the tables ----------------- */
const RangeModel = AutoHealEngine.RangeModel;
const range = new RangeModel({
  Weapons: drivers.weapons.map(w => Object.assign({}, w, { damage: w.dmg })),
  Projectiles: drivers.projectiles.map(p => Object.assign({}, p, { damage: p.dmg })),
  Hats,
  Items: drivers.items
});
const snap = { scale: drivers.config.playerScale, TICK: AH.TICK_MS };
const hit = drivers.config.playerScale * AH.HIT_SCALE_MULT;

for (const [id, name] of [[4, "katana"], [5, "polearm"], [7, "daggers"], [3, "short sword"]]) {
  check(`reach:${name}`, range.meleeReach(snap, id), W[id].range + hit);
}
for (const id of [AH.WEAPON_BOW, AH.WEAPON_MUSKET, AH.WEAPON_CROSSBOW]) {
  check(`reach:${W[id].name} is not melee`, range.meleeReach(snap, id, 9999), 0);
}
check("musket projectile range", range.projectileSpec(snap, AH.WEAPON_MUSKET, 0).range,
  drivers.projectiles[AH.PROJ_MUSKET].range);
check("marksman musket range",
  Math.round(range.projectileSpec(snap, AH.WEAPON_MUSKET, AH.HAT_MARKSMAN).range),
  Math.round(drivers.projectiles[AH.PROJ_MUSKET].range * Hats[AH.HAT_MARKSMAN].aMlt));
check("turret reach", range.turretReach(snap),
  drivers.items[AH.ITEM_TURRET].shootRange + drivers.config.playerScale);
for (const id of [6, 7, 8, 9]) {
  const item = drivers.items[id];
  check(`spike contact:${item.name}`,
    range.spikeContactRadius(snap, { collisionScale: item.scale }),
    drivers.config.playerScale + item.scale);
}

/* ---- packet cost model ------------------------------------------------ */
check("burst cost of 1 press", AutoHealEngine.burstPackets(1), 3);
check("burst cost of 4 presses", AutoHealEngine.burstPackets(4), 9);
check("presses for 9 frames", AutoHealEngine.pressesForPackets(9), 4);

console.log(`client : ${path.relative(process.cwd(), target)}`);
console.log(`drivers: drivers/game-drivers.json (${drivers.source || "src/game_index.js"})\n`);
console.log(notes.join("\n"));
if (problems.length) {
  console.log("\nDRIFT:");
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log(`\nOK - ${notes.length} Auto Heal constants match the shipped game bundle.`);
