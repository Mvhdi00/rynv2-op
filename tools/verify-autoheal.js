#!/usr/bin/env node
/*
 * verify-autoheal.js
 *
 * Exercises Ryn Type 2's auto-heal decision — the MiseryHeal module — against
 * the scenarios it exists to survive: walking into a spike, being knocked onto
 * one, being pinned on one inside a trap, poison, a turret-gear rush, the shame
 * gate and its lethal override, the 140 cap, the hat terms, and the packet
 * budget.
 *
 * The module's source, along with lineInRect, Vector and the item table, is
 * sliced straight out of the userscript, so this runs the shipped code rather
 * than a copy of it. Everything the module reads from the client — players,
 * objects, reloads, projectiles, ModuleHandler — is stubbed here, which is what
 * lets a browser-only userscript be tested at all.
 *
 *   node tools/verify-autoheal.js [path/to/Ryn_Type_2.user.js]
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'Ryn_Type_2.user.js');
const src = fs.readFileSync(CLIENT_PATH, 'utf8');
const lines = src.split('\n');

function slice(startRe, endRe) {
  let a = -1, b = -1;
  for (let i = 0; i < lines.length; i++) {
    if (a === -1 && startRe.test(lines[i])) a = i;
    else if (a !== -1 && endRe.test(lines[i])) { b = i; break; }
  }
  if (a === -1 || b === -1) throw new Error('slice not found: ' + startRe + ' .. ' + endRe);
  return lines.slice(a, b + 1).join('\n');
}

const vectorSrc = slice(/^  class Vector \{/, /^  const Vector_default = Vector;/);
const lineInRectSrc = slice(/^  const lineInRect = /, /^  \};/);
const itemsSrc = slice(/^  const Items = \[ \{/, /^  \} \];/);
const healSrc = slice(/^  const MISERY_DMG_CAP = 140;/, /^  const AntiInsta_default = MiseryHeal;/);

// Melee damage is the raw weapon damage times bull's 1.5 dmgMultO, which is what
// both clients compute; shield cuts it to 0.2.
const WEAPON_DAMAGE = { 0: 25, 4: 40, 5: 45, 6: 20, 10: 23.5 };
const PROJ_DAMAGE = { 9: 25, 15: 50 };

const harness = `
'use strict';
${vectorSrc}
${lineInRectSrc}
${itemsSrc}
const Hats = { 6: { dmgMult: .75 }, 7: { dmgMultO: 1.5 } };
const Weapons = {
  0:  { itemType: 0, damage: 25,   range: 65,  knockback: 33.3 },
  4:  { itemType: 0, damage: 40,   range: 118, knockback: 33.3 },
  5:  { itemType: 0, damage: 45,   range: 142, knockback: 111.1 },
  6:  { itemType: 0, damage: 20,   range: 110, knockback: 55.6 },
  9:  { itemType: 1, range: 300, knockback: 33.3, projectile: 0 },
  10: { itemType: 1, damage: 23.5, range: 75,  knockback: 33.3 },
  11: { itemType: 1, range: 0, knockback: 0, shield: .2 },
  15: { itemType: 1, range: 400, knockback: 33.3, projectile: 3 }
};
const Projectiles = { 0: { damage: 25, scale: 14 }, 1: { damage: 25, scale: 14 }, 3: { damage: 50, scale: 14 } };
const DataHandler_default = {
  getWeapon: id => Weapons[id],
  getProjectile: id => Projectiles[Weapons[id].projectile],
  getItem: id => Items[id],
  isMelee: id => id != null && 'damage' in Weapons[id],
  isShootable: id => id != null && 'projectile' in Weapons[id]
};
const Settings_default = { _autoheal: true, _survivalPreheal: true };
const Logger = { log: () => {}, error: () => {} };
class PlayerObject {
  constructor(type, x, y, ownerID) {
    this.type = type;
    this.ownerID = ownerID;
    this.pos = { current: new Vector_default(x, y) };
    this.scale = Items[type].scale;
    this.itemGroup = Items[type].itemGroup;
  }
  get collisionScale() { return this.scale; }
  get placementScale() { return this.scale; }
  getDamage() { return this.itemGroup === 2 ? Items[this.type].damage : 0; }
}
class Cactus {
  constructor(x, y) {
    this.pos = { current: new Vector_default(x, y) };
    this.scale = 42;
    this.isCactus = true;
  }
  get collisionScale() { return this.scale * .6; }
  get placementScale() { return this.scale * .6; }
  getDamage() { return 35; }
}
${healSrc}
module.exports = { MiseryHeal, PlayerObject, Cactus, Vector_default, Items, Settings_default };
`;

const outPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ryn-autoheal-')), 'heal-under-test.js');
fs.writeFileSync(outPath, harness);
const { MiseryHeal, PlayerObject, Cactus, Vector_default, Items, Settings_default } = require(outPath);

// ---------------------------------------------------------------- fake client
let healCalls = 0;
let packetCount = 0;
const RELOAD_MAX = 4;

function weaponDamage(id, lookingShield, addBull) {
  if (id == null) return 0;
  if (PROJ_DAMAGE[id] !== undefined) return lookingShield ? 0 : PROJ_DAMAGE[id];
  const base = WEAPON_DAMAGE[id];
  if (base === undefined) return 0;
  let d = base * (addBull ? 1.5 : 1);
  if (lookingShield) d *= .2;
  return d;
}

function reloadOf(ready, prevReady) {
  return {
    current: ready ? RELOAD_MAX : 0,
    max: RELOAD_MAX,
    previous: (prevReady === undefined ? ready : prevReady) ? RELOAD_MAX : 0
  };
}

function makePlayer(opts) {
  const o = Object.assign({
    x: 0, y: 0, fx: null, fy: null, hatID: 0, health: 100,
    primary: 4, secondary: null, primaryReload: true, secondaryReload: true,
    turretReload: true, prevPrimaryReload: undefined, isTrapped: false,
    shameCount: 0, shameActive: false, scale: 35, tickCount: 100,
    damageTick: 0, damages: []
  }, opts);
  const fx = o.fx === null ? o.x : o.fx;
  const fy = o.fy === null ? o.y : o.fy;
  return {
    id: o.id,
    scale: o.scale,
    hatID: o.hatID,
    tempHealth: o.health,
    currentHealth: o.health,
    maxHealth: 100,
    shameCount: o.shameCount,
    shameActive: o.shameActive,
    isTrapped: o.isTrapped,
    inGame: true,
    tickCount: o.tickCount,
    damageTick: o.damageTick,
    damages: o.damages.slice(),
    weapon: { primary: o.primary, secondary: o.secondary, current: o.primary },
    reload: [
      reloadOf(o.primaryReload, o.prevPrimaryReload),
      reloadOf(o.secondaryReload),
      reloadOf(o.turretReload)
    ],
    pos: {
      current: new Vector_default(o.x, o.y),
      future: new Vector_default(fx, fy),
      previous: new Vector_default(o.x, o.y)
    },
    isReloaded(type, tick) { return this.reload[type].current >= this.reload[type].max - tick; },
    getItemByType(type) { return type === 2 ? 0 : type === 0 ? this.weapon.primary : this.weapon.secondary; },
    getMaxWeaponDamage(id, lookingShield, addBull = true) { return weaponDamage(id, lookingShield, addBull); }
  };
}

function makeClient(cfg) {
  const objects = new Map();
  (cfg.objects || []).forEach((o, i) => objects.set(i, o));
  const myPlayer = makePlayer(Object.assign({ id: 1 }, cfg.me));
  const enemies = (cfg.enemies || []).map((e, i) => makePlayer(Object.assign({ id: 10 + i }, e)));
  return {
    myPlayer: myPlayer,
    ObjectManager: {
      objects: objects,
      grid2D: { queryFull: () => [...objects.keys()] },
      // The ring test asks "could an enemy drop a spinning spike here?". Default
      // no, so a scenario only pays for the ring when it says to.
      canPlaceItem: () => cfg.ringOpen === true
    },
    PlayerManager: {
      enemies: enemies,
      playerData: new Map(enemies.map(e => [e.id, e])),
      isEnemyByID: () => true,
      lookingShield: () => cfg.lookingShield === true
    },
    ProjectileManager: {
      dangerProjectiles: new Set(cfg.projectiles || []),
      totalDamage: cfg.projDamage || 0
    },
    _ModuleHandler: {
      forceHat: cfg.forceHat === undefined ? null : cfg.forceHat,
      useHat: null,
      healedOnce: false,
      packetLimit: 119,
      get packetCount() { return packetCount; },
      canBuy: () => true,
      heal() { healCalls += 1; packetCount += 3; },
      staticModules: {}
    }
  };
}

// ------------------------------------------------------------------- scenarios
let failures = 0;
let scenarios = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log('  PASS  ' + name);
  } else {
    failures += 1;
    console.log('  FAIL  ' + name + (detail === undefined ? '' : '  [' + detail + ']'));
  }
}

function run(name, cfg, expect) {
  scenarios += 1;
  healCalls = 0;
  packetCount = cfg.packetCount || 0;
  const client = makeClient(cfg);
  const mod = new MiseryHeal(client);
  client._ModuleHandler.staticModules.antiInsta = mod;
  // Seed the previous position: Misery's `distance > 2` asks "am I moving?", and
  // on a live tick lastPos is always last tick's position.
  if (cfg.movedFrom) {
    mod.lastPosX = cfg.movedFrom[0];
    mod.lastPosY = cfg.movedFrom[1];
  } else {
    mod.lastPosX = client.myPlayer.pos.current.x;
    mod.lastPosY = client.myPlayer.pos.current.y;
  }
  if (cfg.lastColliding) mod.lastColliding = true;
  mod.postTick();
  console.log('\n' + name);
  console.log('  total=' + mod.totalDmgPot.toFixed(2) +
    ' spike=' + mod.spikeDmgPot.toFixed(2) + ' hit=' + mod.hitDmgPot.toFixed(2) +
    ' turret=' + mod.turretDmgPot + ' sec=' + mod.secDmgPot + ' poison=' + mod.poisonDmgPot +
    ' proj=' + mod.projDmgPot +
    ' | collide=' + mod.collidingSpike + ' will=' + mod.willCollide +
    ' danger=' + mod.spikeDangerNow + ' soldier=' + mod.soldierAnti +
    ' healing=' + mod.healing + ' heals=' + healCalls);
  expect(mod, healCalls);
  return mod;
}

// A recent damageTick closes novastorm's out-of-combat top-up branch, which
// otherwise eats to full on any tick and hides what the prediction did.
const IN_COMBAT = { tickCount: 100, damageTick: 101 };

// 1. About to walk into a spike: heal BEFORE contact.
run('1. Walking into a spike at 60 HP (spec 12.a.1)', {
  me: Object.assign({ x: 100, y: 0, fx: 220, fy: 0, health: 60 }, IN_COMBAT),
  movedFrom: [ 40, 0 ],
  objects: [ new PlayerObject(6, 230, 0, 99) ]
}, (m, heals) => {
  check('willCollide detected', m.willCollide === true);
  check('spike damage predicted', m.spikeDmgPot === 20, 'got ' + m.spikeDmgPot);
  check('spikeDangerNow raised', m.spikeDangerNow === true);
  check('ate food before contact', heals > 0);
});

// 2. Standing still beside a spike, nothing happening.
run('2. Parked beside a spike, unhurt', {
  me: Object.assign({ x: 0, y: 0, health: 95 }, IN_COMBAT),
  objects: [ new PlayerObject(6, 80, 0, 99) ]
}, (m, heals) => {
  check('no swept collision while stationary', m.willCollide === false);
  check('no damage predicted', m.totalDmgPot === 0);
  check('no food spent', heals === 0);
});

// 3. Melee enemy in range whose swing alone is lethal.
run('3. Enemy katana in range at 55 HP (swing alone is lethal)', {
  me: Object.assign({ x: 0, y: 0, health: 55 }, IN_COMBAT),
  enemies: [ { x: 100, y: 0, primary: 4 } ]
}, (m, heals) => {
  check('hit damage counted once', m.hitDmgPot === 60, 'got ' + m.hitDmgPot);
  check('healing raised', m.healing === true);
  check('food spent', heals > 0);
});

// 4. Five bystanders in range, none lethal alone: the eager sum reads 300.
run('4. Five enemies in range at 95 HP (no reason any hit lands)', {
  me: Object.assign({ x: 0, y: 0, health: 95 }, IN_COMBAT),
  enemies: [
    { x: 100, y: 0, primary: 4 }, { x: -100, y: 0, primary: 4 },
    { x: 0, y: 100, primary: 4 }, { x: 0, y: -100, primary: 4 },
    { x: 70, y: 70, primary: 4 }
  ]
}, (m, heals) => {
  check('no hit damage without a reason it lands', m.hitDmgPot === 0);
  check('nothing predicted at all', m.totalDmgPot === 0);
  check('no food spent on bystanders', heals === 0);
});

// 5. Knockback into a spike: enemy one side, spike the other.
run('5. Knockback into a spike (spec 12.a.7)', {
  me: Object.assign({ x: 0, y: 0, health: 90 }, IN_COMBAT),
  enemies: [ { x: -100, y: 0, primary: 5 } ],
  objects: [ new PlayerObject(9, 120, 0, 99) ]
}, (m, heals) => {
  check('spike damage off the knockback segment', m.spikeDmgPot >= 45, 'got ' + m.spikeDmgPot);
  check('hit damage added alongside it', m.hitDmgPot > 0);
  check('spikeDangerNow raised', m.spikeDangerNow === true);
  check('emergency heal fired', heals > 0);
  check('canStillGather set', m.canStillGather === true);
});

// 5b. Same enemy, no spike behind us: knockback is harmless.
run('5b. Same enemy, nothing behind us', {
  me: Object.assign({ x: 0, y: 0, health: 90 }, IN_COMBAT),
  enemies: [ { x: -100, y: 0, primary: 5 } ]
}, (m, heals) => {
  check('no spike damage', m.spikeDmgPot === 0);
  check('no hit damage (67.5 alone is not lethal at 90)', m.hitDmgPot === 0);
  check('no food spent', heals === 0);
});

// 6. Trapped and pinned on a spike, having just taken 20 from it.
run('6. Trapped on a spike after taking 20 (spec 12.a.4)', {
  me: { x: 0, y: 0, health: 70, isTrapped: true, damages: [ 20 ], damageTick: 101, tickCount: 100 },
  objects: [ new PlayerObject(6, 70, 0, 99) ],
  enemies: [ { x: 100, y: 0, primary: 4, prevPrimaryReload: false } ]
}, (m, heals) => {
  check('spike damage attributed', m.spikeDamages.length === 1, JSON.stringify(m.spikeDamages));
  check('collidingSpike raised', m.collidingSpike === true);
  check('re-take of the same 20 predicted', m.spikeDmgPot === 20);
  check('enemy swing counted on the spike', m.hitDmgPot === 60, 'got ' + m.hitDmgPot);
  check('food spent', heals > 0);
});

// 6b. Same, but soldier was on when the spike hit: 15 unwinds back to 20.
run('6b. Trapped on a spike after taking 15 under soldier', {
  me: { x: 0, y: 0, health: 70, isTrapped: true, damages: [ 15 ], damageTick: 101, tickCount: 100, hatID: 6 },
  objects: [ new PlayerObject(6, 70, 0, 99) ],
  forceHat: 6
}, m => {
  check('soldiered spike tier recognised', m.spikeDamages.length === 1, JSON.stringify(m.spikeDamages));
  check('0.75 divided back out', m.spikeDmgPot === 20, 'got ' + m.spikeDmgPot);
});

// 7. Poison: 5 lands, the term fires one tick before each 9-tick landing.
(() => {
  scenarios += 1;
  console.log('\n7. Poison cycle (spec 12.a.5)');
  healCalls = 0; packetCount = 0;
  const client = makeClient({ me: { x: 0, y: 0, health: 80, damages: [ 5 ], damageTick: 101, tickCount: 100 } });
  const mod = new MiseryHeal(client);
  client._ModuleHandler.staticModules.antiInsta = mod;
  mod.postTick();
  check('poison tick stamped', mod.poisonTick === 100, 'got ' + mod.poisonTick);
  const seen = [];
  for (let t = 1; t <= 60; t++) {
    client.myPlayer.tickCount = 100 + t;
    mod.postTick();
    if (mod.poisonDmgPot > 0) seen.push(t);
  }
  check('fires before each landing for five seconds', seen.join(',') === '8,17,26,35,44', 'got ' + seen.join(','));
  check('window closes after five seconds', mod.poisonTick === null);
})();

// 8. Turret gear closing from beyond melee reach (velocity tick).
run('8. Turret-gear enemy closing at 250px, 80 HP', {
  me: Object.assign({ x: 0, y: 0, health: 80 }, IN_COMBAT),
  enemies: [ { x: 250, y: 0, hatID: 53, primary: 4, turretReload: false } ]
}, (m, heals) => {
  check('turret damage counted', m.turretDmgPot === 25);
  check('primary counted with it', m.hitDmgPot === 60, 'got ' + m.hitDmgPot);
  check('85 >= 80, healing raised', m.healing === true);
  check('food spent', heals > 0);
});

// 9. Shame gate.
run('9a. Shame 7, nothing predicted', {
  me: Object.assign({ x: 0, y: 0, health: 95, shameCount: 7 }, IN_COMBAT),
  enemies: [ { x: 100, y: 0, primary: 4 } ]
}, (m, heals) => {
  check('nothing predicted', m.totalDmgPot === 0);
  check('shame 7 keeps food in the bag', heals === 0);
});
run('9b. Shame 7, lethal spike push', {
  me: Object.assign({ x: 0, y: 0, health: 40, shameCount: 7 }, IN_COMBAT),
  enemies: [ { x: -100, y: 0, primary: 5 } ],
  objects: [ new PlayerObject(9, 120, 0, 99) ]
}, (m, heals) => {
  check('prediction is lethal', m.totalDmgPot >= 40, 'got ' + m.totalDmgPot);
  check('shame gate overridden to survive', heals > 0);
});
run('9c. Shame 7, spike danger that is survivable', {
  me: Object.assign({ x: 100, y: 0, fx: 220, fy: 0, health: 95, shameCount: 7 }, IN_COMBAT),
  movedFrom: [ 40, 0 ],
  objects: [ new PlayerObject(6, 230, 0, 99) ]
}, (m, heals) => {
  check('spike danger seen', m.spikeDangerNow === true);
  check('20 damage at 95 HP is not lethal', m.totalDmgPot < 95);
  check('shame 7 still blocks it', heals === 0);
});

// 10. Cap at 140.
run('10. Damage cap (spec 7.c)', {
  me: Object.assign({ x: 100, y: 0, fx: 200, fy: 0, health: 100 }, IN_COMBAT),
  movedFrom: [ 40, 0 ],
  objects: [
    new PlayerObject(9, 210, 0, 99), new PlayerObject(9, 210, 60, 99),
    new PlayerObject(9, 210, -60, 99), new PlayerObject(9, 150, 0, 99)
  ]
}, m => {
  check('raw spike sum exceeds the cap', m.spikeDmgPot > 140, 'got ' + m.spikeDmgPot);
  check('total capped at 140', m.totalDmgPot === 140);
});

// 11. Hat terms, measured against the hat that is about to go on.
run('11a. Bat swing lethal at 28 HP, no soldier', {
  me: Object.assign({ x: 0, y: 0, health: 28 }, IN_COMBAT),
  enemies: [ { x: 100, y: 0, primary: 6 } ]
}, m => {
  check('hit damage is 30 (bat x1.5)', m.hitDmgPot === 30);
  check('28 <= 30, healing raised', m.healing === true);
});
run('11b. Same, soldier about to go on', {
  me: Object.assign({ x: 0, y: 0, health: 28, hatID: 6 }, IN_COMBAT),
  enemies: [ { x: 100, y: 0, primary: 6 } ],
  forceHat: 6
}, m => {
  check('hit damage still 30', m.hitDmgPot === 30);
  check('30 * 0.75 = 22.5 < 28, healing withheld', m.healing === false);
});
run('11c. Bull about to go on adds its +5', {
  me: Object.assign({ x: 0, y: 0, health: 30, hatID: 7 }, IN_COMBAT),
  enemies: [ { x: 100, y: 0, primary: 6 } ],
  forceHat: 7
}, m => {
  check('hit damage is 30 and bull bias makes 35', m.hitDmgPot === 30);
  check('30 <= 35, healing raised', m.healing === true);
});

// 12. Packet budget.
run('12a. Preventive top-up with no budget left', {
  me: { x: 0, y: 0, health: 99, damageTick: 90, tickCount: 100 },
  packetCount: 119
}, (m, heals) => {
  check('out-of-combat top-up is dropped', heals === 0);
});
run('12b. Preventive top-up with budget', {
  me: { x: 0, y: 0, health: 99, damageTick: 90, tickCount: 100 },
  packetCount: 0
}, (m, heals) => {
  check('top-up goes out', heals === 1);
});
run('12c. Emergency with no budget left', {
  me: Object.assign({ x: 100, y: 0, fx: 220, fy: 0, health: 30 }, IN_COMBAT),
  movedFrom: [ 40, 0 ],
  objects: [ new PlayerObject(9, 230, 0, 99) ],
  packetCount: 119
}, (m, heals) => {
  check('spike danger seen', m.spikeDangerNow === true);
  check('emergency ignores the budget', heals > 0);
});

// 13. In-flight projectile counts (RYN's term).
run('13. Musket ball already in the air, 45 HP', {
  me: Object.assign({ x: 0, y: 0, health: 45 }, IN_COMBAT),
  projDamage: 50
}, (m, heals) => {
  check('projectile damage counted', m.projDmgPot === 50);
  check('healing raised', m.healing === true);
  check('food spent', heals > 0);
});

// 14. Cactus sweep.
run('14. Walking into a cactus', {
  me: Object.assign({ x: 100, y: 0, fx: 200, fy: 0, health: 50 }, IN_COMBAT),
  movedFrom: [ 40, 0 ],
  objects: [ new Cactus(215, 0) ]
}, m => {
  check('cactus counted as 35', m.spikeDmgPot === 35, 'got ' + m.spikeDmgPot);
  check('willCollide raised', m.willCollide === true);
});

// 15. Ranged secondary that already hit us once.
run('15. Musket secondary, hit us this tick, in range', {
  me: { x: 0, y: 0, health: 60, damages: [ 60 ], damageTick: 101, tickCount: 100 },
  enemies: [ { x: 300, y: 0, primary: 4, secondary: 15, turretReload: false } ]
}, m => {
  check('melee hit attributed', m.damagesByHits.length === 1, JSON.stringify(m.damagesByHits.map(h => h.damage)));
  check('musket shot predicted at 50', m.secDmgPot === 50, 'got ' + m.secDmgPot);
});

// 16. Enemy spike ring (spec 2.a / hatFc's spikeTickAnti).
run('16. Enemy can drop a spinning spike under us', {
  me: Object.assign({ x: 0, y: 0, health: 60 }, IN_COMBAT),
  enemies: [ { x: 90, y: 0, primary: 4 } ],
  ringOpen: true
}, m => {
  check('45 spike counted', m.spikeDmgPot >= 45, 'got ' + m.spikeDmgPot);
  check('spikeTickAnti raised (60 + 45 >= 100)', m.spikeTickAnti === true);
  check('healing raised', m.healing === true);
});

// 17. Autoheal off: prediction still runs for the hat systems, no food.
(() => {
  Settings_default._autoheal = false;
  run('17. Autoheal off', {
    me: Object.assign({ x: 100, y: 0, fx: 220, fy: 0, health: 20 }, IN_COMBAT),
    movedFrom: [ 40, 0 ],
    objects: [ new PlayerObject(9, 230, 0, 99) ]
  }, (m, heals) => {
    check('prediction still computed', m.totalDmgPot > 0);
    check('soldierAnti still raised for the hat systems', m.soldierAnti === true);
    check('no food spent', heals === 0);
  });
  Settings_default._autoheal = true;
})();

// 18. Shame active: the server is refusing food.
run('18. Shame active', {
  me: Object.assign({ x: 100, y: 0, fx: 220, fy: 0, health: 20, shameActive: true, shameCount: 8 }, IN_COMBAT),
  movedFrom: [ 40, 0 ],
  objects: [ new PlayerObject(9, 230, 0, 99) ]
}, (m, heals) => {
  check('no food spent while the server refuses it', heals === 0);
});

// 19. Damage attributed exactly once across ticks.
(() => {
  scenarios += 1;
  console.log('\n19. One damage tick is attributed once');
  healCalls = 0; packetCount = 0;
  const client = makeClient({
    me: { x: 0, y: 0, health: 80, isTrapped: true, damages: [ 20 ], damageTick: 101, tickCount: 100 },
    objects: [ new PlayerObject(6, 70, 0, 99) ]
  });
  const mod = new MiseryHeal(client);
  client._ModuleHandler.staticModules.antiInsta = mod;
  mod.postTick();
  check('first look sees the spike hit', mod.spikeDamages.length === 1);
  check('spikeDmgCount counted it', mod.spikeDmgCount === 1);
  client.myPlayer.tickCount = 101;
  mod.postTick();
  check('second look does not see it again', mod.spikeDamages.length === 0);
  check('spikeDmgCount reset once the tick is stale', mod.spikeDmgCount === 0);
})();

// 20. Shame reset gate.
run('20a. Shame to burn on a completely quiet tick', {
  me: Object.assign({ x: 0, y: 0, health: 100, shameCount: 3 }, IN_COMBAT)
}, m => {
  check('shouldResetShame raised', m.shouldResetShame === true);
});
run('20b. Shame to burn while damage is predicted', {
  me: Object.assign({ x: 0, y: 0, health: 40, shameCount: 3 }, IN_COMBAT),
  enemies: [ { x: 100, y: 0, primary: 4 } ]
}, m => {
  check('damage predicted', m.totalDmgPot > 0);
  check('shouldResetShame withheld', m.shouldResetShame === false);
});

// 21. Out of combat, damaged, nothing threatening: novastorm's top-up branch.
run('21. Out of combat at 40 HP', {
  me: { x: 0, y: 0, health: 40, damageTick: 90, tickCount: 100 }
}, (m, heals) => {
  check('nothing predicted', m.totalDmgPot === 0);
  check('healing flag stays down', m.healing === false);
  check('still tops up: 3 apples for 60 HP', heals === 3, 'got ' + heals);
});

// 22. Full health: never spends food.
run('22. Full health', {
  me: { x: 0, y: 0, health: 100, damageTick: 0, tickCount: 100 }
}, (m, heals) => {
  check('no food at full health', heals === 0);
});

// 23. wantsSoldier: hatFc's whole set of soldier reasons.
run('23a. Ring tick raises wantsSoldier without a lethal sum', {
  me: Object.assign({ x: 0, y: 0, health: 95 }, IN_COMBAT),
  enemies: [ { x: 90, y: 0, primary: 4 } ],
  ringOpen: true
}, m => {
  check('spikeTickAnti raised', m.spikeTickAnti === true);
  check('sum is not lethal at 95 HP', m.totalDmgPot < 95, 'got ' + m.totalDmgPot);
  check('soldierAnti not raised', m.soldierAnti === false);
  check('wantsSoldier raised anyway', m.wantsSoldier === true);
});
run('23b. Pinned on spikes inside a trap raises wantsSoldier', {
  me: { x: 0, y: 0, health: 95, isTrapped: true, damages: [ 20 ], damageTick: 101, tickCount: 100 },
  objects: [ new PlayerObject(6, 70, 0, 99) ]
}, m => {
  check('spikeDmgCount counted', m.spikeDmgCount === 1);
  check('wantsSoldier raised', m.wantsSoldier === true);
});
run('23c. Quiet tick leaves wantsSoldier down', {
  me: Object.assign({ x: 0, y: 0, health: 95 }, IN_COMBAT)
}, m => {
  check('wantsSoldier down', m.wantsSoldier === false);
});

// 23d. Survival Preheal off still lets a lethal heal past the packet budget.
(() => {
  Settings_default._survivalPreheal = false;
  run('23d. Survival Preheal off, lethal prediction, no packet budget', {
    me: Object.assign({ x: 0, y: 0, health: 55, shameCount: 0 }, IN_COMBAT),
    enemies: [ { x: 100, y: 0, primary: 4 } ],
    packetCount: 119
  }, (m, heals) => {
    check('prediction is lethal', m.totalDmgPot >= 55, 'got ' + m.totalDmgPot);
    check('healing raised', m.healing === true);
    check('budget does not drop the apple that stops a death', heals > 0);
  });
  run('23e. Survival Preheal off withholds the shame override', {
    me: Object.assign({ x: 0, y: 0, health: 40, shameCount: 7 }, IN_COMBAT),
    enemies: [ { x: -100, y: 0, primary: 5 } ],
    objects: [ new PlayerObject(9, 120, 0, 99) ]
  }, (m, heals) => {
    check('prediction is lethal', m.totalDmgPot >= 40);
    check('shame 7 is respected with the toggle off', heals === 0);
  });
  Settings_default._survivalPreheal = true;
})();

// 24. Death: the post-mortem drains without throwing.
(() => {
  scenarios += 1;
  console.log('\n24. Death post-mortem');
  healCalls = 0; packetCount = 0;
  const client = makeClient({ me: { x: 0, y: 0, health: 20, damages: [ 45, 35 ], damageTick: 101, tickCount: 100 } });
  const mod = new MiseryHeal(client);
  client._ModuleHandler.staticModules.antiInsta = mod;
  mod.postTick();
  check('damage recorded for the post-mortem', mod.deathDamages.length === 2, mod.deathDamages.length);
  client.myPlayer.inGame = false;
  mod.postTick();
  check('post-mortem drained on death', mod.deathDamages.length === 0);
  mod.postTick();
  check('second dead tick is silent', mod.deathDamages.length === 0);
})();

fs.rmSync(path.dirname(outPath), { recursive: true, force: true });
console.log('\n' + (failures === 0
  ? 'OK - auto-heal behaves as specified across ' + scenarios + ' scenarios.'
  : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
