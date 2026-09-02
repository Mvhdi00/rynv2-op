#!/usr/bin/env node
/*
 * autoheal-harness.js — a stand-in for the parts of the RYN client the Auto
 * Heal Engine reads.
 *
 * The engine talks to the client through exactly one class, HostAdapter, and
 * every field it reads is a field this file provides. That is the whole reason
 * the harness is small enough to be trustworthy: it is not a game, it is the
 * surface the adapter asks for, with the shapes the real client uses.
 *
 * Data comes from drivers/game-drivers.json, which tools/extract-drivers.js
 * derives from src/game_index.js, so the weapon ranges, projectile speeds and
 * hat multipliers the tests exercise are the shipped ones.
 */

const path = require("path");
const drivers = require(path.join(__dirname, "..", "drivers", "game-drivers.json"));

const TICK = 1000 / 9;

/* ---- the client's Vector, in the two methods the engine uses ---------- */
class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  angle(v) { return Math.atan2(v.y - this.y, v.x - this.x); }
  copy() { return new Vec(this.x, this.y); }
}

/* ---- tables in the client's own shape --------------------------------- *
 * RYN renames a few fields off the bundle (dmg -> damage on projectiles,
 * restore on food), so the harness presents the client's names over the
 * driver's values rather than inventing numbers.
 */
const Weapons = drivers.weapons.map(w => ({
  id: w.id,
  name: w.name,
  type: w.type,
  damage: w.dmg,
  range: w.range,
  speed: w.speed,
  projectile: w.projectile,
  shield: w.shield
}));

const Projectiles = drivers.projectiles.map((p, i) => ({
  id: i,
  damage: p.dmg,
  scale: p.scale,
  speed: p.speed !== undefined ? p.speed : (i === 1 ? 1.5 : 0),
  range: p.range !== undefined ? p.range : (i === 1 ? 700 : 0)
}));

const Hats = {};
for (const h of drivers.hats) Hats[h.id] = h;

const Accessories = {};
for (const a of drivers.accessories) Accessories[a.id] = a;

/* Items, indexed the way RYN indexes them, with food `restore` alongside the
 * bundle's `consume` amounts. */
const Items = drivers.items.map((it, i) => {
  const out = Object.assign({}, it, { id: i });
  if (i === 0) { out.restore = 20; out.cost = { food: 10 }; out.name = "apple"; }
  if (i === 1) { out.restore = 40; out.cost = { food: 15 }; out.name = "cookie"; }
  if (i === 2) { out.restore = 30; out.cost = { food: 25 }; out.name = "cheese"; }
  return out;
});

/* ---- an enemy, with the reads the adapter makes ----------------------- */
class Enemy {
  constructor(opts) {
    const o = opts || {};
    this.id = o.id === undefined ? 1 : o.id;
    const x = o.x === undefined ? 0 : o.x;
    const y = o.y === undefined ? 0 : o.y;
    this.pos = {
      previous: new Vec(o.px === undefined ? x : o.px, o.py === undefined ? y : o.py),
      current: new Vec(x, y),
      future: new Vec(x, y)
    };
    this.angle = o.angle === undefined ? Math.PI : o.angle;
    this.speed = o.speed || 0;
    this.move_dir = o.moveDir === undefined ? null : o.moveDir;
    this.scale = 35;
    this.hitScale = 35 * 1.8;
    this.collisionScale = 35;
    this.hatID = o.hatID || 0;
    this.currentHealth = o.health === undefined ? 100 : o.health;
    this.isTrapped = !!o.trapped;
    this.usingBoost = false;
    this.lastAttacked = 0;
    this.danger = o.danger || 0;
    this.reverseInsta = !!o.reverseInsta;
    this.toolHammerInsta = !!o.toolHammerInsta;
    this.rangedBowInsta = !!o.rangedBowInsta;
    this.canPlaceSpike = !!o.canPlaceSpike;
    this.spikeDamage = o.spikeDamage || 0;
    this.potentialDamage = o.potentialDamage || 0;
    this.weapon = {
      primary: o.primary === undefined ? 0 : o.primary,
      secondary: o.secondary === undefined ? null : o.secondary,
      current: o.current === undefined
        ? (o.primary === undefined ? 0 : o.primary) : o.current,
      oldCurrent: o.oldCurrent === undefined ? null : o.oldCurrent
    };
    this._reloaded = o.reloaded || { 0: true, 1: true, 2: false };
    this._empty = o.emptyReload || {};
  }
  isReloaded(type) { return !!this._reloaded[type]; }
  isEmptyReload(type) { return !!this._empty[type]; }
  /* Player.getWeaponRange: melee adds the target's hitScale, ranged its
   * collisionScale (v5.4:3778-3787). */
  getWeaponRange(id) {
    if (id === null || id === undefined) return 0;
    const w = Weapons[id];
    if (!w) return 0;
    const ranged = w.projectile !== undefined && w.projectile !== null;
    if (ranged) {
      const proj = Projectiles[w.projectile];
      return (proj ? proj.range : 0) + this.collisionScale;
    }
    return (w.range || 0) + this.hitScale;
  }
  getMaxWeaponDamage(id) {
    if (id === null || id === undefined) return 0;
    const w = Weapons[id];
    if (!w) return 0;
    if (w.projectile !== undefined && w.projectile !== null) {
      const proj = Projectiles[w.projectile];
      return proj ? proj.damage : 0;
    }
    /* getMaxWeaponDamage folds the Bull helmet's dmgMultO in (v5.4:3788). */
    return (w.damage || 0) * (Hats[7].dmgMultO || 1);
  }
}

/* ---- a projectile in the client's shape ------------------------------- */
class Proj {
  constructor(opts) {
    const o = opts || {};
    this.type = o.type === undefined ? 0 : o.type;
    const table = Projectiles[this.type] || {};
    this.angle = o.angle === undefined ? Math.PI : o.angle;
    this.speed = o.speed === undefined ? table.speed : o.speed;
    this.range = o.range === undefined ? table.range : o.range;
    this.damage = o.damage === undefined ? table.damage : o.damage;
    this.isTurret = this.type === 1;
    this.life = o.life === undefined ? 9 : o.life;
    this.scale = table.scale;
    /* The client stores a non-turret projectile 70 back along its own angle
     * (Projectile.formatFromCurrent, v5.4:6908). Callers pass the muzzle. */
    const back = this.isTurret ? 0 : 70;
    this.pos = {
      current: new Vec(
        (o.x || 0) - Math.cos(this.angle) * back,
        (o.y || 0) - Math.sin(this.angle) * back
      )
    };
  }
}

/* ---- the client ------------------------------------------------------- */
function makeClient(opts) {
  const o = opts || {};
  const enemies = o.enemies || [];
  const projectiles = o.projectiles || [];
  const packets = { count: 0, frames: [] };

  const myPlayer = {
    inGame: true,
    isSandbox: false,
    tickCount: o.tick === undefined ? 100 : o.tick,
    currentHealth: o.health === undefined ? 100 : o.health,
    previousHealth: o.prevHealth === undefined
      ? (o.health === undefined ? 100 : o.health) : o.prevHealth,
    maxHealth: undefined,          // the client really does leave this unset
    hatID: o.hatID || 0,
    accessoryID: o.accID || 0,
    shameCount: o.shame || 0,
    shameActive: !!o.shameActive,
    receivedDamage: o.receivedDamage === undefined ? null : o.receivedDamage,
    poisonCount: o.poison || 0,
    isDmgOverTime: false,
    bullTick: o.bullTick || 0,
    damageTick: o.damageTick === undefined ? -99 : o.damageTick,
    isTrapped: !!o.trapped,
    trappedIn: o.trappedIn || null,
    pos: {
      previous: new Vec(0, 0),
      current: new Vec(0, 0),
      future: new Vec(0, 0)
    },
    scale: 35,
    hitScale: 35 * 1.8,
    collisionScale: 35,
    speed: o.speed === undefined ? 0 : o.speed,
    resources: { food: o.food === undefined ? 200 : o.food },
    weapon: { primary: 0, secondary: null, current: 0 },
    getItemByType(type) {
      /* RYN's inventory map: 0 primary, 1 secondary, 2 food. */
      if (type === 2) return o.foodId === undefined ? 1 : o.foodId;   // cookie
      if (type === 0) return 0;
      if (type === 1) return null;
      return null;
    },
    getBuildingDamage() { return 25; },
    isEnemyByID() { return true; }
  };

  const staticModules = {};
  const moduleHandler = {
    packetCount: 0,
    packetLimit: 119,
    moduleActive: false,
    activeModule: null,
    healedOnce: false,
    placedOnce: false,
    totalPlaces: 0,
    attacking: 0,
    shouldAttack: false,
    didAntiInsta: false,
    forceHat: o.forceHat === undefined ? null : o.forceHat,
    weapon: 0,
    currentHolding: 0,
    store: [{ last: o.storeHat === undefined ? (o.hatID || 0) : o.storeHat },
            { last: 0 }],
    staticModules,
    ownedHats: o.ownedHats || [0, 6, 7, 53],
    setForceHat(hat) {
      if (this.forceHat !== null && hat !== null) return;
      this.forceHat = hat;
    },
    canBuy(type, id) { return type === 0 && this.ownedHats.indexOf(id) !== -1; },
    selectItem(type) { packets.count++; packets.frames.push("select:" + type); },
    attack() { packets.count++; packets.frames.push("attack"); },
    stopAttack() { packets.count++; packets.frames.push("stop"); },
    whichWeapon(type) { packets.count++; packets.frames.push("weapon:" + type); },
    _getPredictWeapon() { return 0; }
  };
  /* packetCount is a live read off PacketManager in the client; here the
   * frames the harness counted are the same number. */
  Object.defineProperty(moduleHandler, "packetCount", {
    get() { return packets.count; },
    set() {},
    configurable: true
  });

  const enemyManager = {
    potentialDamage: o.potentialDamage || 0,
    potentialSpikeDamage: o.spikeDamage || 0,
    potentialSpikeKnockbackDamage: o.spikeKBDamage || 0,
    primaryDamage: o.primaryDamage || 0,
    detectedEnemy: !!o.detectedEnemy,
    detectedDangerEnemy: !!o.dangerEnemy,
    dangerWithoutSoldier: !!o.dangerNoSoldier,
    collidingSpike: !!o.collidingSpike,
    willCollideSpike: !!o.willCollideSpike,
    pushingOnSpike: !!o.pushingOnSpike,
    spikeSyncThreat: !!o.spikeSyncThreat,
    nearestEnemy: enemies.length ? enemies[0] : null,
    nearestEnemyPush: o.pusher || null,
    nearestSpike: o.nearestSpike || null,
    nearestTrap: o.nearestTrap || null,
    nearestTurretEntity: o.turret || null,
    instaThreat() { return !!o.instaThreat; }
  };

  const projectileManager = {
    dangerProjectiles: new Set(projectiles),
    totalDamage: o.projectileDamage === undefined
      ? projectiles.reduce((a, p) => a + (p.damage || 0), 0)
      : o.projectileDamage
  };

  return {
    myPlayer,
    _ModuleHandler: moduleHandler,
    SocketManager: { TICK, pong: o.pong || 0 },
    EnemyManager: enemyManager,
    ProjectileManager: projectileManager,
    PlayerManager: { enemies, isEnemyByID: () => true },
    ObjectManager: { grid2D: { query() {} }, objects: new Map() },
    packets
  };
}

const Settings = {
  _autoHealEngine: true,
  _autoHealWash: true,
  _autoHealStrict: false,
  _autoHealReserve: 15
};

module.exports = {
  Vec, Enemy, Proj, makeClient,
  Weapons, Projectiles, Hats, Accessories, Items, Settings,
  TICK,
  deps: {
    get Items() { return Items; },
    get Hats() { return Hats; },
    get Accessories() { return Accessories; },
    get Weapons() { return Weapons; },
    get Projectiles() { return Projectiles; },
    get Settings() { return Settings; }
  }
};
