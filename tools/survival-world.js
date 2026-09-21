// A synthetic world with the surface SurvivalCore actually reads. Nothing here
// decides anything — it only answers the questions the module asks, the way the
// real client would.
"use strict";
const M = require("./survival-harness.js");
const { Vector, Items, Hats, Accessories, Weapons, Projectiles, WeaponVariants, DataHandler, Config } = M;

// One clock for the module and for the fake server. The module reads
// Date.now() and the shame arithmetic is in milliseconds, so a test that let
// real time run would measure microseconds between ticks and refuse every heal
// on the cooldown.
let CLOCK = 1e6;
const REAL_NOW = Date.now;
Date.now = () => CLOCK;

function vec(x, y) {
  const v = new Vector(x, y);
  return v;
}

class Ent {
  constructor(x, y, scale = 35) {
    this.pos = { previous: vec(x, y), current: vec(x, y), future: vec(x, y) };
    this.scale = scale;
    this.speed = 0;
    this.angle = 0;
  }
  get hitScale() { return this.scale * 1.8; }
  get collisionScale() { return this.scale; }
  moveTo(x, y) {
    this.pos.previous.setVec(this.pos.current);
    this.pos.current._setXY(x, y);
    const d = this.pos.previous.distance(this.pos.current);
    this.speed = d;
    const a = this.pos.previous.angle(this.pos.current);
    this.pos.future.setVec(this.pos.current.addDirection(a, d));
  }
  collidingEntity(e, range) {
    const r2 = range * range;
    const A = [this.pos.previous, this.pos.current, this.pos.future];
    const B = [e.pos.previous, e.pos.current, e.pos.future];
    for (const a of A) for (const b of B) if (a.distanceDefault(b) <= r2) return true;
    return false;
  }
  collidingSimple(e, range) { return this.pos.current.distanceDefault(e.pos.current) <= range * range; }
}

class Enemy extends Ent {
  constructor(world, opts = {}) {
    super(opts.x || 0, opts.y || 0);
    this.world = world;
    this.id = opts.id !== undefined ? opts.id : world.nextId++;
    this.weapon = { primary: opts.primary !== undefined ? opts.primary : 5, secondary: opts.secondary !== undefined ? opts.secondary : null, current: 0 };
    this.variant = { primary: opts.primaryVariant || 0, secondary: opts.secondaryVariant || 0, current: 0 };
    this.hatID = opts.hat || 0;
    this.accessoryID = opts.acc || 0;
    this.shameCount = opts.shame || 0;
    this.lastAttacked = opts.lastAttacked !== undefined ? opts.lastAttacked : -99;
    this.reload = [
      { current: opts.pReload !== undefined ? opts.pReload : 7, max: 7, previous: 7 },
      { current: opts.sReload !== undefined ? opts.sReload : 14, max: 14, previous: 14 },
      { current: opts.tReload !== undefined ? opts.tReload : 23, max: 23, previous: 23 }
    ];
    this.reverseInsta = !!opts.reverseInsta;
    this.toolHammerInsta = !!opts.toolHammerInsta;
    this.rangedBowInsta = !!opts.rangedBowInsta;
    this.spikeSyncThreat = !!opts.spikeSyncThreat;
    this.spikeDamage = opts.spikeDamage || 0;
    this.clanName = "enemy";
    this.isPlayer = true;
    this.usesTurret = !!opts.usesTurret;
    this.futureHat = opts.futureHat !== undefined ? opts.futureHat : null;
    if (opts.x !== undefined) { this.pos.previous._setXY(opts.x, opts.y); this.pos.future._setXY(opts.x, opts.y); }
  }
  get canUseTurret() { return this.hatID !== 22; }
  getWeaponVariant(id) {
    const type = DataHandler.getWeapon(id || 0).itemType;
    const v = type === 0 ? this.variant.primary : this.variant.secondary;
    return { current: v, next: Math.min(v + 1, 3) };
  }
  isReloaded(type, tick = 0) {
    const r = this.reload[type];
    return r.current >= r.max - tick;
  }
  isEmptyReload(type) { return this.reload[type].current === 0; }
  getBuildingDamage(id, isTank = false) {
    const weapon = DataHandler.getWeapon(id);
    const variant = WeaponVariants[this.getWeaponVariant(id).current];
    let damage = weapon.damage * variant.val;
    if ("sDmg" in weapon) damage *= weapon.sDmg;
    const hat = Hats[isTank ? 40 : this.hatID];
    if (hat && "bDmg" in hat) damage *= hat.bDmg;
    return damage;
  }
}

class Me extends Ent {
  constructor(world) {
    super(0, 0);
    this.world = world;
    this.id = 1;
    this.inGame = true;
    this.tickCount = 0;
    this.maxHealth = 100;
    this.currentHealth = 100;
    this.previousHealth = 100;
    this.tempHealth = 100;
    this.shameCount = 0;
    this.shameActive = false;
    this.damages = [];
    this.damageTick = 0;
    this.isTrapped = false;
    this.trappedIn = null;
    this.hatID = 0;
    this.accessoryID = 0;
    this.poisonCount = 0;
    this.bullTick = 0;
    this.isDmgOverTime = false;
    this.lastAttacked = -99;
    this.receivedDamage = null;
    this.clanName = "me";
    this.resources = { food: 500, wood: 500, stone: 500, gold: 500 };
    this.inventory = { 0: 5, 1: null, 2: 0, 3: 3, 4: 6, 5: 10 };
    this.weapon = { primary: 5, secondary: null, current: 0 };
    this.variant = { primary: 0, secondary: 0, current: 0 };
    this.reload = [{ current: 7, max: 7, previous: 7 }, { current: 14, max: 14, previous: 14 }, { current: 23, max: 23, previous: 23 }];
  }
  get isSandbox() { return false; }
  isMyPlayerByID(id) { return id === this.id; }
  getItemByType(t) { return this.inventory[t]; }
  hasResourcesForType(type) {
    const c = Items[this.getItemByType(type)].cost;
    const r = this.resources;
    return r.food >= c.food && r.wood >= c.wood && r.stone >= c.stone && r.gold >= c.gold;
  }
  isReloaded(type, tick = 0) {
    const r = this.reload[type];
    return r.current >= r.max - tick;
  }
  getWeaponVariant(id) {
    const type = DataHandler.getWeapon(id || 0).itemType;
    const v = type === 0 ? this.variant.primary : this.variant.secondary;
    return { current: v, next: Math.min(v + 1, 3) };
  }
  getBuildingDamage(id, isTank = false) {
    const weapon = DataHandler.getWeapon(id);
    const variant = WeaponVariants[this.getWeaponVariant(id).current];
    let damage = weapon.damage * variant.val;
    if ("sDmg" in weapon) damage *= weapon.sDmg;
    const hat = Hats[isTank ? 40 : this.hatID];
    if (hat && "bDmg" in hat) damage *= hat.bDmg;
    return damage;
  }
  getMaxBuildingDamage(object, isTank = true) {
    const { primary, secondary } = this.weapon;
    if (DataHandler.isMelee(secondary) && secondary === 10 && this.isReloaded(1, 1)) {
      if (this.collidingSimple(object, DataHandler.getWeapon(secondary).range + object.hitScale)) return this.getBuildingDamage(secondary, isTank);
    }
    if (DataHandler.isMelee(primary) && this.isReloaded(0, 1)) {
      if (this.collidingSimple(object, DataHandler.getWeapon(primary).range + object.hitScale)) return this.getBuildingDamage(primary, isTank);
    }
    return null;
  }
  // The real Player.updateHealth shame + damage bookkeeping, byte for byte.
  updateHealth(health) {
    this.previousHealth = this.currentHealth;
    this.currentHealth = health;
    this.tempHealth = health;
    if (this.shameActive) return;
    const difference = Math.abs(this.currentHealth - this.previousHealth);
    if (this.currentHealth < this.previousHealth) {
      this.receivedDamage = this.world.now;
      if (this.damageTick !== this.tickCount + 1) {
        this.damages.length = 0;
      }
      this.damages.push(Math.round(difference * 100) / 100);
      this.damageTick = this.tickCount + 1;
    } else if (this.receivedDamage !== null) {
      const step = this.world.now - this.receivedDamage;
      this.receivedDamage = null;
      if (step <= 120) this.shameCount += 1;
      else this.shameCount = Math.max(0, this.shameCount - 2);
    }
    const diffDmg = difference === 5 || difference === 2 || difference === 4;
    this.isDmgOverTime = diffDmg && this.currentHealth < this.previousHealth;
    if (this.isDmgOverTime) this.bullTick = this.tickCount;
  }
}

class Grid {
  constructor() { this.items = []; }
  add(o) { this.items.push(o); }
  queryFull() { return this.items.map(o => o.id); }
}

class World {
  constructor(opts = {}) {
    this.nextId = 100;
    CLOCK = 1e6;
    this.ping = opts.ping !== undefined ? opts.ping : 70;
    this.packetsSent = [];
    this.heals = [];
    this.objects = new Map;
    this.grid = new Grid;
    this.myPlayer = new Me(this);
    this.enemies = [];
    this.projectiles = new Set;
    this.log = [];

    const world = this;
    this.PlayerManager = {
      enemies: this.enemies,
      players: [],
      playerData: new Map([[1, this.myPlayer]]),
      step: 111,
      isEnemyByID(id) {
        if (id === world.myPlayer.id) return false;
        return true;
      },
      lookingShield() { return false; }
    };
    this.ProjectileManager = { dangerProjectiles: this.projectiles };
    this.ObjectManager = {
      objects: this.objects,
      grid2D: this.grid,
      canPlaceItem: () => opts.canPlace !== false
    };
    this.EnemyManager = { nearestDangerAnimal: null };
    this.SocketManager = { get pong() { return world.ping; }, TICK: 1000 / 9 };
    this.InputHandler = { fastHealPress: false };
    this.ownerClient = this;
    this.isOwner = true;
    this._ModuleHandler = {
      packetCount: 0,
      packetLimitRaw: 119,
      healReserve: 0,
      healReserveTicks: 0,
      get packetLimit() { const l = this.packetLimitRaw - this.healReserve; return l > 0 ? l : 0; },
      set packetLimit(v) { this.packetLimitRaw = v; },
      canBuy: () => true,
      forceHat: null,
      useHat: null,
      healedOnce: false,
      currentType: null,
      shouldAttack: false,
      attacking: 0,
      autoattack: false,
      forceWeapon: null,
      useWeapon: null,
      weapon: 0,
      tickCount: 0,
      staticModules: {
        reloading: { isReloaded: (type, ticks = 0) => world.myPlayer.isReloaded(type, ticks) }
      },
      heal() {
        const core = this.staticModules.antiInsta;
        if (core && typeof core.noteFoodSent === "function") core.noteFoodSent();
        this.packetCount += 3;
        world.heals.push({ tick: world.myPlayer.tickCount, at: world.now });
      }
    };
    this.core = new M.SurvivalCore(this);
    this._ModuleHandler.staticModules.antiInsta = this.core;
    M.setActive(this);
  }

  addEnemy(opts) {
    const e = new Enemy(this, opts);
    this.enemies.push(e);
    this.PlayerManager.players.push(e);
    this.PlayerManager.playerData.set(e.id, e);
    return e;
  }
  addSpike(x, y, type = 6, ownerID = 999) {
    const item = Items[type];
    const o = new M.PlayerObject({
      id: this.nextId++, type, ownerID, itemGroup: item.itemGroup,
      scale: item.scale, damage: item.damage,
      pos: { current: vec(x, y) }, health: item.health, tempHealth: item.health,
      isDestroyable: true, isCactus: false
    });
    this.objects.set(o.id, o);
    this.grid.add(o);
    return o;
  }
  addTrap(x, y, ownerID = 999) {
    const item = Items[15];
    const o = new M.PlayerObject({
      id: this.nextId++, type: 15, ownerID, itemGroup: item.itemGroup,
      scale: item.scale, damage: 0,
      pos: { current: vec(x, y) }, health: item.health, tempHealth: item.health,
      isDestroyable: true, isCactus: false
    });
    this.objects.set(o.id, o);
    this.grid.add(o);
    return o;
  }
  addProjectile(x, y, type, ownerID) {
    const p = {
      pos: { current: vec(x, y) }, damage: Projectiles[type].damage,
      speed: Projectiles[type].speed, angle: 0, isTurret: type === 1,
      ownerClient: this.PlayerManager.playerData.get(ownerID) || null, id: this.nextId++
    };
    this.projectiles.add(p);
    return p;
  }
  damage(amount) {
    this.myPlayer.updateHealth(Math.max(0, this.myPlayer.currentHealth - amount));
  }
  // One server tick: advance the clock, advance the module.
  get now() { return CLOCK; }
  set now(v) { CLOCK = v; }
  advance(ms) { CLOCK += ms; }
  tick(ms) {
    const step = ms === undefined ? 1000 / 9 : ms;
    CLOCK += step;
    this.myPlayer.tickCount += 1;
    this._ModuleHandler.tickCount += 1;
    this._ModuleHandler.healedOnce = false;
    // ModuleHandler.postTick's reservation ageing, verbatim.
    const mh = this._ModuleHandler;
    if (mh.healReserveTicks > 0) {
      mh.healReserveTicks -= 1;
      if (mh.healReserveTicks === 0) mh.healReserve = 0;
    } else mh.healReserve = 0;
    for (const e of this.enemies) {
      for (const r of e.reload) if (r.current < r.max) { r.previous = r.current; r.current += 1; }
    }
    for (const r of this.myPlayer.reload) if (r.current < r.max) { r.previous = r.current; r.current += 1; }
    const before = this.heals.length;
    this.core.postTick();
    this.core.flushHeld();
    const sent = this.heals.length - before;
    this.log.push({
      tick: this.myPlayer.tickCount, tier: this.core.healPriority,
      name: M.names[this.core.healPriority], sent,
      hp: this.myPlayer.tempHealth, shame: this.myPlayer.shameCount,
      state: this.core.state, hold: this.core.healingDelay,
      reserve: mh.healReserve, soldier: this.core.wantsSoldier, emp: this.core.wantsEMP,
      lethal: this.core.forecast.lethalTick, minHP: Math.round(this.core.forecast.minHP * 10) / 10,
      worst: Math.round(this.core.forecast.worstTotal * 10) / 10
    });
    // Apply the heals as the server would: each apple restores, and the shame
    // block runs on the first one of the burst only.
    if (sent > 0) this._applyHeals(sent);
    return sent;
  }
  _applyHeals(count) {
    const restore = Items[this.myPlayer.getItemByType(2)].restore;
    const mp = this.myPlayer;
    if (!mp.shameActive) {
      if (mp.receivedDamage !== null) {
        // the server's own window, measured server side: our wait plus RTT
        const W = this.now - mp.receivedDamage + this.ping;
        mp.receivedDamage = null;
        if (W <= 120) {
          mp.shameCount += 1;
          if (mp.shameCount >= 8) { mp.shameActive = true; mp.shameCount = 0; }
        } else {
          mp.shameCount = Math.max(0, mp.shameCount - 2);
        }
      }
      if (!mp.shameActive) {
        for (let i = 0; i < count; i++) {
          if (mp.currentHealth >= mp.maxHealth) break;
          mp.currentHealth = Math.min(mp.maxHealth, mp.currentHealth + restore);
        }
        mp.tempHealth = mp.currentHealth;
      }
    }
  }
}

module.exports = { World, Enemy, Me, vec, M };
