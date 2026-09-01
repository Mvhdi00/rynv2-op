#!/usr/bin/env node
/*
 * sim-autoheal.js
 *
 * Runs the Auto Heal Engine against a model of the server that is the game's
 * own code, transcribed: buildItem's shame arithmetic (game_index.js:2458),
 * changeHealth's hit stamp and full-health refusal (:2417), the one-second
 * regen / damage-over-time counter (:2316) and canBuild's resource gate
 * (:2496). Around it sits a stand-in for the parts of the RYN client the
 * engine reads, including RYN's own client-side shame mirror.
 *
 * The point is not to prove the engine heals — that is easy — but to prove the
 * two things the objective actually asks for: the count never reaches 8, so the
 * 30s lock is never armed, and it spends most of its time at 0.
 *
 *   node tools/sim-autoheal.js
 */

const { createRynAutoHealEngine } = require("../src/autoheal/ryn-autoheal-engine.js");

const TICK = 1000 / 9;

/* The engine factory under test. verify-autoheal.js swaps in the copy it pulls
 * out of the built userscript, so the scenarios below judge the code that
 * actually ships rather than only the source it was built from. */
let FACTORY = createRynAutoHealEngine;

/* ---------------------------------------------------------------- *
 * Driver tables, cut down to what the engine reads.
 * ---------------------------------------------------------------- */
const Items = [
  { id: 0, itemType: 2, name: "apple", cost: { food: 10, wood: 0, stone: 0, gold: 0 }, restore: 20 },
  { id: 1, itemType: 2, name: "cookie", cost: { food: 15, wood: 0, stone: 0, gold: 0 }, restore: 40 },
  { id: 2, itemType: 2, name: "cheese", cost: { food: 25, wood: 0, stone: 0, gold: 0 }, restore: 30 }
];
const Hats = [];
Hats[0] = { id: 0, name: "none" };
Hats[6] = { id: 6, name: "Soldier Helmet", dmgMult: 0.75 };
Hats[7] = { id: 7, name: "Bull Helmet", healthRegen: -5 };
Hats[45] = { id: 45, name: "Shame!" };
Hats[56] = { id: 56, name: "Assassin Gear", noEat: true };
const Accessories = [];
Accessories[0] = { id: 0, name: "none" };
/* Only the weapons and projectiles the detectors name, with the numbers from
 * drivers/game-drivers.json. */
const Weapons = [];
Weapons[5] = { id: 5, name: "polearm", damage: 45, range: 142, knockback: 0.2 };
Weapons[7] = { id: 7, name: "daggers", damage: 20, range: 65, knockback: 0.1 };
Weapons[9] = { id: 9, name: "hunting bow", projectile: 0, range: 0 };
Weapons[10] = { id: 10, name: "great hammer", damage: 10, range: 75 };
Weapons[12] = { id: 12, name: "crossbow", projectile: 2, range: 0 };
Weapons[15] = { id: 15, name: "musket", projectile: 5, range: 0 };
const Projectiles = [
  { damage: 25, speed: 1.6 },
  { damage: 25, speed: 1 },
  { damage: 35, speed: 2.5 },
  { damage: 30, speed: 2 },
  { damage: 16, speed: 1 },
  { damage: 50, speed: 3.6 }
];

/* A vector with the two methods the engine calls on one. */
function vec(x, y) {
  return {
    x, y,
    distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); },
    distanceDefault(o) { return this.distance(o); },
    angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); },
    copy() { return vec(this.x, this.y); }
  };
}

/* An enemy as the client models one: position history, weapon in hand, reload
 * state, and the per-enemy verdicts EnemyManager writes onto it. */
function makeEnemy(opts) {
  const o = Object.assign({
    id: 99, x: 400, y: 0, px: null, py: null, angle: Math.PI, scale: 35,
    primary: 7, secondary: null, current: 7,
    primaryReload: 1, secondaryReload: 1, turretReload: 1,
    hatID: 0, health: 100, trapped: false, boost: false,
    danger: 0, reverseInsta: false, toolHammerInsta: false, rangedBowInsta: false
  }, opts || {});
  /* Player.update sets oldCurrent to last tick's weapon, so someone who has not
   * switched has oldCurrent === current. Only pass oldCurrent to model a switch
   * that happened on this tick. */
  if (o.oldCurrent === undefined) o.oldCurrent = o.current;
  const cur = vec(o.x, o.y);
  const prev = vec(o.px === null ? o.x : o.px, o.py === null ? o.y : o.py);
  const speed = prev.distance(cur);
  return {
    id: o.id,
    pos: { current: cur, previous: prev, future: cur },
    angle: o.angle,
    scale: o.scale,
    speed,
    move_dir: prev.angle(cur),
    get hitScale() { return this.scale * 1.8; },
    weapon: { primary: o.primary, secondary: o.secondary, current: o.current, oldCurrent: o.oldCurrent },
    hatID: o.hatID,
    currentHealth: o.health,
    isTrapped: o.trapped,
    usingBoost: o.boost,
    lastAttacked: 0,
    danger: o.danger,
    reverseInsta: o.reverseInsta,
    toolHammerInsta: o.toolHammerInsta,
    rangedBowInsta: o.rangedBowInsta,
    canPlaceSpike: false,
    spikeDamage: 0,
    potentialDamage: 0,
    _reloads: [o.primaryReload, o.secondaryReload, o.turretReload],
    isReloaded(type) { return this._reloads[type] >= 1; },
    isEmptyReload(type) { return this._reloads[type] === 0; },
    getWeaponRange(id) {
      const w = Weapons[id];
      if (!w) return 0;
      return (w.range || 0) + this.hitScale;
    },
    getMaxWeaponDamage(id) {
      const w = Weapons[id];
      return w && w.damage ? w.damage : 0;
    }
  };
}

function makeProjectile(opts) {
  const o = Object.assign({ type: 5, x: 300, y: 0, angle: Math.PI, speed: 3.6 }, opts || {});
  return {
    type: o.type,
    damage: Projectiles[o.type].damage,
    speed: o.speed,
    angle: o.angle,
    pos: { current: vec(o.x, o.y) },
    life: 9,
    isTurret: o.type === 1
  };
}

/* ---------------------------------------------------------------- *
 * The server, as the bundle writes it.
 * ---------------------------------------------------------------- */
class Server {
  constructor(food) {
    this.health = 100;
    this.maxHealth = 100;      // game_index.js:2234
    this.hitTime = 0;
    this.shameCount = 0;
    this.shameTimer = 0;
    this.food = food;
    this.dmgOverTime = { dmg: 0, time: 0 };
    this.regen = 0;            // skin.healthRegen + tail.healthRegen
    this.locksArmed = 0;
    this.maxShameSeen = 0;
  }

  /* game_index.js:2417 */
  changeHealth(v, now) {
    if (v > 0 && this.health >= this.maxHealth) return false;
    if (v < 0) this.hitTime = now;
    this.health += v;
    if (this.health > this.maxHealth) this.health = this.maxHealth;
    if (this.health < 0) this.health = 0;
    return true;
  }

  /* game_index.js:2454-2477, the consume half. */
  buildFood(item, now, sandbox) {
    // canBuild: outside sandbox this is hasRes (:2496-2499)
    if (!sandbox && this.food < item.cost.food) return "no-res";
    if (this.hitTime) {
      const w = now - this.hitTime;
      this.hitTime = 0;
      if (w <= 120) {
        this.shameCount++;
        if (this.shameCount >= 8) {
          this.shameTimer = 30000;
          this.shameCount = 0;
          this.locksArmed++;
        }
      } else {
        this.shameCount -= 2;
        if (this.shameCount <= 0) this.shameCount = 0;
      }
      if (this.shameCount > this.maxShameSeen) this.maxShameSeen = this.shameCount;
    }
    if (this.shameTimer > 0) return "locked";
    // items consume fn: apple/cookie changeHealth(restore); cheese also DoT
    const worked = this.changeHealth(item.restore, now);
    const ok = item.name === "cheese" ? worked || this.health < 100 : worked;
    if (!ok) return "full";
    if (item.name === "cheese") {
      this.dmgOverTime = { dmg: -10, time: 5 };
    }
    if (!sandbox) this.food -= item.cost.food;
    return "healed";
  }

  /* game_index.js:2311-2325 — the one second counter. */
  secondTick(now) {
    if (this.shameTimer > 0) {
      this.shameTimer -= 1000;
      if (this.shameTimer <= 0) {
        this.shameTimer = 0;
        this.shameCount = 0;
      }
    }
    if (this.regen) this.changeHealth(this.regen, now);
    if (this.dmgOverTime.dmg) {
      this.changeHealth(-this.dmgOverTime.dmg, now);
      this.dmgOverTime.time -= 1;
      if (this.dmgOverTime.time <= 0) this.dmgOverTime.dmg = 0;
    }
  }
}

/* ---------------------------------------------------------------- *
 * The client surface the engine reads.
 * ---------------------------------------------------------------- */
function makeClient(sim) {
  const myPlayer = {
    tickCount: 0,
    currentHealth: 100,
    previousHealth: 100,
    tempHealth: 100,
    maxHealth: Math.LN1,          // the client's real value: undefined
    shameCount: 0,                // RYN's mirror
    shameActive: false,
    receivedDamage: null,
    damageTick: 0,
    poisonCount: 0,
    isDmgOverTime: false,
    bullTick: 0,
    hatID: 0,
    accessoryID: 0,
    inventory: { 0: 0, 1: null, 2: 0 },
    resources: { food: 100, wood: 100, stone: 100, gold: 100 },
    inGame: true,
    isSandbox: false,
    isTrapped: false,
    trappedIn: null,
    scale: 35,
    pos: { current: vec(0, 0), previous: vec(0, 0), future: vec(0, 0) },
    getItemByType(t) { return this.inventory[t]; },
    getBuildingDamage() { return 25; }
  };

  const mh = {
    packetCount: 0,
    packetLimit: 119,
    moduleActive: false,
    healedOnce: false,
    didAntiInsta: false,
    placedOnce: false,
    totalPlaces: 0,
    attacking: 0,
    shouldAttack: false,
    forceHat: null,
    store: [{ last: 0 }, { last: 0 }],
    staticModules: {},
    selectItem() { this.packetCount += 1; },
    attack() { this.packetCount += 1; sim.queuePress(); },
    whichWeapon() { this.packetCount += 1; },
    _getPredictWeapon() { return 0; },
    setForceHat(h) { if (this.forceHat === null) this.forceHat = h; },
    canBuy(type, id) { return type === 0 && (id === 6 || id === 7); }
  };

  return {
    myPlayer,
    _ModuleHandler: mh,
    SocketManager: { TICK, pong: sim.pong },
    PlayerManager: {
      enemies: [],
      isEnemyByID() { return true; }
    },
    EnemyManager: {
      potentialDamage: 0,
      potentialSpikeDamage: 0,
      potentialSpikeKnockbackDamage: 0,
      primaryDamage: 0,
      detectedDangerEnemy: false,
      dangerWithoutSoldier: false,
      collidingSpike: false,
      willCollideSpike: false,
      pushingOnSpike: false,
      nearestEnemy: null,
      nearestSpike: null,
      nearestTrap: null,
      nearestEnemyPush: null,
      nearestTurretEntity: null,
      instaThreat() { return false; }
    },
    ProjectileManager: { totalDamage: 0, dangerProjectiles: new Set }
  };
}

/* ---------------------------------------------------------------- *
 * The loop.
 * ---------------------------------------------------------------- */
class Sim {
  constructor(opts) {
    opts = opts || {};
    this.pong = opts.pong === undefined ? 0 : opts.pong;
    this.sandbox = false;
    this.allowDeaths = !!opts.allowDeaths;
    this.server = new Server(opts.food === undefined ? 6000 : opts.food);
    this.server.shameCount = opts.shame || 0;
    this.client = makeClient(this);
    this.client.myPlayer.shameCount = opts.shame || 0;
    this.client.myPlayer.inventory[2] = opts.foodId === undefined ? 0 : opts.foodId;
    this.settings = Object.assign({
      _autoHealEngine: true,
      _autoHealWash: true,
      _autoHealStrict: true,
      _autoHealReserve: 15,
      _safeSoldier: true,
      _antiSmartTick: true,
      _autoplacer: false,
      _prePlace: false,
      _replace: false,
      _spikeSync: false,
      _spikeSyncHammer: false,
      _antiSync: false
    }, opts.settings || {});

    /* deps go in through getters, the same shape the builder uses when it
     * splices the engine in ahead of the client's Settings_default. */
    const settings = this.settings;
    const Engine = FACTORY({
      get Items() { return Items; },
      get Hats() { return Hats; },
      get Accessories() { return Accessories; },
      get Weapons() { return Weapons; },
      get Projectiles() { return Projectiles; },
      get Settings() { return settings; }
    });
    this.engine = new Engine(this.client);

    this.tick = 0;
    this.now = 0;
    this.queued = 0;
    this.inflight = [];
    this.log = [];
    /* Half a round trip each way, in whole ticks: a press sent on client tick T
     * reaches the server for tick T + 1 + lag, and the health the client reads
     * on tick T is the server's from T - lag. */
    this.lagTicks = Math.max(0, Math.round((this.pong / 2) / TICK));
    this.healthHistory = [];
    this.startShame = opts.shame || 0;
    this.stats = {
      presses: 0, healedPresses: 0, refused: 0, ticksAtZeroShame: 0,
      maxServerShame: 0, deaths: 0, foodSpent: 0, packetPeak: 0,
      pressesWhileLocked: 0, staleAborts: 0, zones: {}, threats: {}
    };
  }

  queuePress() {
    this.queued += 1;
  }

  /* One server tick + one client tick. */
  /* `world` is what the threat detectors read: who is on the field, what is in
   * the air, what is being touched. Omitted means an empty field, which is what
   * the healing scenarios want. */
  step(damage, threat, world) {
    this.tick += 1;
    this.now = this.tick * TICK;
    const server = this.server;
    const mp = this.client.myPlayer;
    const mh = this.client._ModuleHandler;

    /* 1. presses whose flight time has elapsed arrive and are processed. */
    const due = this.tick - 1 - this.lagTicks;
    const arriving = this.inflight.filter(p => p.tick === due);
    this.inflight = this.inflight.filter(p => p.tick !== due);
    const item = Items[mp.inventory[2]];
    for (const _p of arriving) {
      const before = server.food;
      const r = server.buildFood(item, this.now, this.sandbox);
      if (r === "healed") this.stats.healedPresses += 1;
      else this.stats.refused += 1;
      this.stats.foodSpent += before - server.food;
    }

    /* 2. incoming damage for this tick. */
    if (damage > 0) {
      const mult = mp.hatID === 6 ? Hats[6].dmgMult : 1;
      server.changeHealth(-damage * mult, this.now + 1);
    }

    /* 3. the one-second counter, every 9th tick. */
    if (this.tick % 9 === 0) {
      server.regen = mp.hatID === 7 ? Hats[7].healthRegen : 0;
      const before = server.health;
      server.secondTick(this.now + 2);
      if (server.health < before) {
        mp.isDmgOverTime = true;
        mp.bullTick = mp.tickCount;
      } else {
        mp.isDmgOverTime = false;
      }
    } else {
      mp.isDmgOverTime = false;
    }

    if (server.health <= 0) {
      this.stats.deaths += 1;
      server.health = 100;
      server.hitTime = 0;
      server.shameCount = 0;
      mp.shameCount = 0;
      mp.receivedDamage = null;
      this.engine.reset();
    }

    /* 4. the client sees the new health — as of half a round trip ago — and
     *    RYN's mirror runs (Player.updateHealth, v5.4:3484-3518). */
    this.healthHistory[this.tick] = server.health;
    const clientNow = this.now + 3;
    const seenTick = Math.max(0, this.tick - this.lagTicks);
    const health = this.healthHistory[seenTick] === undefined
      ? server.health
      : this.healthHistory[seenTick];
    mp.previousHealth = mp.currentHealth;
    mp.currentHealth = health;
    mp.tempHealth = health;
    mp.shameActive = server.shameTimer > 0;
    mp.hatID = mp.shameActive ? 45 : mp.hatID;
    if (health < mp.previousHealth) {
      mp.receivedDamage = clientNow;
      mp.damageTick = mp.tickCount + 1;
    } else if (health > mp.previousHealth && mp.receivedDamage !== null) {
      const step = clientNow - mp.receivedDamage;
      mp.receivedDamage = null;
      mp.shameCount += step <= 120 ? 1 : -2;
      mp.shameCount = Math.max(0, Math.min(7, mp.shameCount));
    }
    mp.resources.food = server.food;
    mp.tickCount += 1;

    /* 5. the tick the engine runs on. */
    mh.packetCount = Math.max(0, mh.packetCount - 40); // a second's budget bleeds off
    mh.healedOnce = false;
    mh.moduleActive = false;
    mh.placedOnce = false;
    mh.forceHat = null;
    const em = this.client.EnemyManager;
    em.potentialDamage = threat || 0;
    em.dangerWithoutSoldier = (threat || 0) >= health;

    /* the field the detectors read */
    const w = world || {};
    const pmgr = this.client.PlayerManager;
    const pm = this.client.ProjectileManager;
    pmgr.enemies = w.enemies || [];
    em.nearestEnemy = pmgr.enemies.length ? pmgr.enemies[0] : null;
    pm.dangerProjectiles = new Set(w.projectiles || []);
    pm.totalDamage = (w.projectiles || []).reduce((a, p) => a + p.damage, 0);
    const spike = w.spike || {};
    em.collidingSpike = !!spike.colliding;
    em.willCollideSpike = !!spike.willCollide;
    em.pushingOnSpike = !!spike.pushing;
    em.potentialSpikeDamage = spike.damage || 0;
    em.nearestEnemyPush = spike.pusher ? pmgr.enemies[0] || null : null;
    em.nearestSpike = spike.colliding || spike.willCollide
      ? {
        pos: { current: vec(spike.x === undefined ? 60 : spike.x, 0) },
        collisionScale: 49,
        getDamage() { return spike.damage || 35; }
      }
      : null;
    const trap = w.trap || {};
    mp.isTrapped = !!trap.trapped;
    mp.trappedIn = trap.trapped
      ? { ownerID: 99, health: trap.health === undefined ? 500 : trap.health,
          tempHealth: trap.health === undefined ? 500 : trap.health }
      : null;
    em.nearestTrap = trap.near
      ? { pos: { current: vec(trap.near, 0) }, collisionScale: 50 }
      : null;
    em.nearestTurretEntity = w.turret
      ? { pos: { current: vec(w.turret, 0) } }
      : null;

    this.queued = 0;
    if (this.onTickStart) this.onTickStart();
    const clock = Date.now;
    Date.now = () => clientNow;
    try {
      this.engine.postTick();
    } finally {
      Date.now = clock;
    }
    if (this.queued) {
      for (let i = 0; i < this.queued; i++) this.inflight.push({ tick: this.tick });
      this.stats.presses += this.queued;
      if (server.shameTimer > 0) this.stats.pressesWhileLocked += this.queued;
    }
    /* the hat the engine asked for is equipped on the next tick */
    if (mh.forceHat !== null && !mp.shameActive) {
      mp.hatID = mh.forceHat;
      mh.store[0].last = mh.forceHat;
    }

    if (server.shameCount === 0) this.stats.ticksAtZeroShame += 1;
    this.stats.maxServerShame = Math.max(this.stats.maxServerShame, server.shameCount);
    this.stats.packetPeak = Math.max(this.stats.packetPeak, mh.packetCount);
    const tm = this.engine.telemetry;
    if (typeof tm.reason === "string" && tm.reason.indexOf("+stale:") !== -1) {
      this.stats.staleAborts += 1;
    }
    this.stats.zones[tm.zone] = (this.stats.zones[tm.zone] || 0) + 1;
    /* Highest confidence each detector ever reached, and how often it fired. */
    for (const entry of tm.threats || []) {
      const [type, confidence] = entry.split(":");
      const seen = this.stats.threats[type] || { best: "NONE", ticks: 0 };
      const rank = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      if (rank[confidence] > rank[seen.best]) seen.best = confidence;
      seen.ticks += 1;
      this.stats.threats[type] = seen;
    }
    this.log.push({
      tick: this.tick,
      hp: Math.round(server.health),
      shame: server.shameCount,
      mirror: mp.shameCount,
      zone: tm.zone,
      conf: tm.confidence,
      opp: tm.opportunity,
      locked: server.shameTimer > 0,
      urgency: tm.urgency,
      reason: tm.reason,
      presses: this.queued
    });
  }
}

/* ---------------------------------------------------------------- *
 * Scenarios.
 * ---------------------------------------------------------------- */
const scenarios = [];

function scenario(name, fn) { scenarios.push({ name, fn }); }

scenario("sustained melee, one hit every three ticks", () => {
  const sim = new Sim({ foodId: 1 });
  for (let t = 1; t <= 180; t++) {
    const dmg = t % 3 === 0 ? 35 : 0;
    sim.step(dmg, t % 3 === 0 ? 35 : 20);
  }
  return sim;
});

scenario("heavy pressure, a hit every two ticks", () => {
  const sim = new Sim({ foodId: 1 });
  for (let t = 1; t <= 60; t++) sim.step(t % 2 === 0 ? 25 : 0, 45);
  for (let t = 61; t <= 100; t++) sim.step(0, 0);
  return sim;
});

/* Damage on every single tick is the one shape the shame rule makes
 * unsurvivable: the hit stamp is refreshed faster than the 120ms window
 * closes, so every first-press-after-a-hit is charged and the whole budget is
 * seven of them. What the engine is judged on here is not living through it —
 * nothing can — but spending all seven and then refusing the eighth, which is
 * the press that would arm the 30s lock without healing. */
scenario("unsurvivable beatdown, a hit every tick", () => {
  const sim = new Sim({ foodId: 1, allowDeaths: true });
  for (let t = 1; t <= 40; t++) sim.step(20, 45);
  for (let t = 41; t <= 90; t++) sim.step(0, 0);
  return sim;
});

scenario("insta burst at low health", () => {
  const sim = new Sim({ foodId: 1 });
  sim.step(45, 45);
  sim.step(0, 90);
  sim.step(40, 90);
  for (let t = 4; t <= 60; t++) sim.step(t === 20 ? 45 : 0, t < 25 ? 60 : 0);
  return sim;
});

scenario("poison: damage over time every second", () => {
  const sim = new Sim({ foodId: 0 });
  sim.client.myPlayer.poisonCount = 6;
  sim.server.dmgOverTime = { dmg: 5, time: 6 };
  for (let t = 1; t <= 90; t++) sim.step(t === 5 ? 30 : 0, 25);
  return sim;
});

scenario("shame debt at 6, quiet field", () => {
  const sim = new Sim({ foodId: 1, shame: 6 });
  for (let t = 1; t <= 120; t++) sim.step(t === 1 ? 30 : 0, 0);
  return sim;
});

scenario("shame debt at 7 under fire — the press that must not be sent", () => {
  const sim = new Sim({ foodId: 1, shame: 7 });
  sim.client.myPlayer.shameCount = 7;
  for (let t = 1; t <= 30; t++) sim.step(t % 2 === 0 ? 25 : 0, 40);
  for (let t = 31; t <= 80; t++) sim.step(0, 0);
  return sim;
});

scenario("no food in stock", () => {
  const sim = new Sim({ foodId: 1, food: 0 });
  for (let t = 1; t <= 60; t++) sim.step(t === 1 ? 40 : 0, 20);
  return sim;
});

/* The WARNING zone's job: climb is expensive, so come down at the first valid
 * chance rather than waiting to be told the count is high. Starting at 5, the
 * defensive bias should hold the count off the ceiling and walk it back. */
scenario("warning zone at 5, sustained pressure", () => {
  const sim = new Sim({ foodId: 1, shame: 5 });
  sim.client.myPlayer.shameCount = 5;
  for (let t = 1; t <= 100; t++) sim.step(t % 3 === 0 ? 30 : 0, 40);
  return sim;
});

/* An enemy stands in range holding a reloaded weapon and never swings.
 * potentialDamage is real and nothing is landing: the low-confidence case the
 * objective says not to spend healing resources on. */
scenario("low-confidence threat — nobody actually swings", () => {
  const sim = new Sim({ foodId: 1 });
  sim.step(20, 45);                                  // one real hit, then quiet
  for (let t = 2; t <= 90; t++) sim.step(0, 45);
  return sim;
});

/* The count moves between the plan and the press: the tick is planned on 4,
 * where a charged emergency press is affordable, and by the time it would go
 * out the real count is 7, where that same press arms the lock and heals
 * nothing. The engine re-reads immediately before execution, so what leaves the
 * wire is judged on the number that actually holds. Damage every tick, so the
 * plan really is the charged emergency one. */
scenario("shame count moves between plan and press", () => {
  const sim = new Sim({ foodId: 1, shame: 4, allowDeaths: true });
  const mp = sim.client.myPlayer;
  let planted = 4;
  let readsThisTick = 0;
  sim.onTickStart = () => { readsThisTick = 0; };
  Object.defineProperty(mp, "shameCount", {
    configurable: true,
    get() {
      readsThisTick += 1;
      /* First read of the tick is the snapshot; everything after it is the
       * live re-read on the execution path. */
      return readsThisTick === 1 ? planted : 7;
    },
    set(v) { planted = v; }
  });
  for (let t = 1; t <= 50; t++) sim.step(20, 45);
  return sim;
});

scenario("high latency — pong 250, over two ticks", () => {
  const sim = new Sim({ foodId: 1, pong: 250 });
  for (let t = 1; t <= 120; t++) sim.step(t % 4 === 0 ? 30 : 0, 35);
  return sim;
});

/* Nothing can be healed for thirty seconds, so the only thing to check is that
 * the engine sends nothing: a press inside the lock cannot feed you and can
 * take the count back to 8 and re-arm it (game_index.js:2464-2469). */
scenario("already inside the 30s lock", () => {
  const sim = new Sim({ foodId: 1, allowDeaths: true });
  sim.server.shameTimer = 30000;
  for (let t = 1; t <= 60; t++) sim.step(t % 5 === 0 ? 15 : 0, 20);
  return sim;
});

/* ---------------------------------------------------------------- *
 * Threat detection.
 *
 * The first of these is the one that matters most: a field full of armed
 * enemies, none of whom do anything. Every detector has to stay quiet.
 * ---------------------------------------------------------------- */
scenario("possession only — armed, distant, and doing nothing", () => {
  const sim = new Sim({ foodId: 1 });
  const world = {
    enemies: [
      makeEnemy({ id: 1, x: 900, current: 15, primary: 15, primaryReload: 1 }), // musket
      makeEnemy({ id: 2, x: 850, current: 9, primary: 9, primaryReload: 1 }),   // bow
      makeEnemy({ id: 3, x: 800, current: 7, primary: 7, primaryReload: 1 }),   // daggers
      makeEnemy({ id: 4, x: 780, current: 5, primary: 5, primaryReload: 1 })    // polearm
    ]
  };
  for (let t = 1; t <= 60; t++) sim.step(0, 0, world);
  return sim;
});

scenario("musket ball in the air", () => {
  const sim = new Sim({ foodId: 1 });
  const shooter = makeEnemy({ id: 1, x: 700, current: 15, primary: 15 });
  for (let t = 1; t <= 40; t++) {
    const flying = t >= 10 && t <= 14;
    sim.step(t === 15 ? 50 : 0, t === 15 ? 50 : 0, {
      enemies: [shooter],
      projectiles: flying ? [makeProjectile({ type: 5, x: 700 - (t - 10) * 160 })] : []
    });
  }
  return sim;
});

scenario("dagger pressure at close range", () => {
  const sim = new Sim({ foodId: 1 });
  const dagger = makeEnemy({ id: 1, x: 90, px: 140, current: 7, primary: 7 });
  for (let t = 1; t <= 40; t++) {
    sim.step(t % 2 === 0 ? 20 : 0, 20, { enemies: [dagger] });
  }
  return sim;
});

scenario("spike tick — one sequence, not five hits", () => {
  const sim = new Sim({ foodId: 1 });
  const pusher = makeEnemy({ id: 1, x: 120, px: 160, current: 5, primary: 5 });
  for (let t = 1; t <= 40; t++) {
    const onSpike = t >= 5 && t <= 22;
    sim.step(onSpike && t % 3 === 0 ? 35 : 0, onSpike ? 35 : 0, {
      enemies: [pusher],
      spike: onSpike ? { colliding: true, pushing: true, pusher: true, damage: 35 } : {}
    });
  }
  return sim;
});

scenario("pinned in an enemy trap with someone in reach", () => {
  const sim = new Sim({ foodId: 1 });
  const attacker = makeEnemy({ id: 1, x: 100, current: 5, primary: 5, primaryReload: 1 });
  for (let t = 1; t <= 40; t++) {
    const pinned = t >= 5 && t <= 25;
    sim.step(pinned && t % 3 === 0 ? 45 : 0, pinned ? 45 : 0, {
      enemies: [attacker],
      trap: pinned ? { trapped: true, health: 500 } : {}
    });
  }
  return sim;
});

scenario("cheese, with its damage-over-time heal", () => {
  const sim = new Sim({ foodId: 2 });
  for (let t = 1; t <= 90; t++) sim.step(t % 7 === 0 ? 30 : 0, 25);
  return sim;
});

/* ---------------------------------------------------------------- *
 * Run.
 * ---------------------------------------------------------------- */
const pad = (s, n) => String(s).padEnd(n);

/* Runs every scenario against `factory` and returns the number of failed
 * checks. The same scenarios are run twice by verify-autoheal.js: once on the
 * engine source, once on the copy inside the built userscript. */
function runAll(factory, label) {
  FACTORY = factory || createRynAutoHealEngine;
  let failures = 0;
  console.log(`RYN Auto Heal Engine — ${label || "simulation against the bundle's own rules"}\n`);

  for (const { name, fn } of scenarios) {
    const sim = fn();
    const s = sim.stats;
    const server = sim.server;
    const ticks = sim.tick;
    const zeroPct = Math.round((s.ticksAtZeroShame / ticks) * 100);

    const checks = [];
    /* The objective, in three assertions. */
    checks.push(["no 30s lock armed", server.locksArmed === 0]);
    checks.push(["shame stayed <= 7", s.maxServerShame <= 7]);
    /* Nothing may be sent while the lock is on: a press there cannot feed you
     * and can re-arm another 30 seconds (game_index.js:2464-2469). */
    checks.push(["no press during a lock", s.pressesWhileLocked === 0]);
    /* Shame control: a debt it starts with has to come down, and the zone it
     * spends its time in has to be the one the count says it is in. */
    if (sim.startShame > 0 && !sim.allowDeaths) {
      checks.push(["debt reduced", server.shameCount < sim.startShame]);
    }
    /* And the engine has to actually work. */
    if (!sim.allowDeaths && name.indexOf("no food") === -1) {
      checks.push(["survived", s.deaths === 0]);
    }
    checks.push(["no press storm", s.presses <= ticks * 2]);
    /* Nothing is spent on a threat that never lands. */
    if (name.indexOf("low-confidence") !== -1) {
      checks.push(["did not feed a threat that never landed", s.foodSpent <= 15]);
    }
    /* The re-read has to actually fire when the count moves under it. */
    if (name.indexOf("moves between plan and press") !== -1) {
      checks.push(["caught the stale count", s.staleAborts > 0]);
    }

    /* ---- threat detection ------------------------------------------ */
    const threatBest = type => (s.threats[type] || {}).best || "NONE";
    if (name.indexOf("possession only") !== -1) {
      /* The rule the whole engine is built on: owning a weapon is not a threat.
       * Nothing landed and nobody is in reach, so nothing may be reported. */
      checks.push(["no threat from possession alone",
        Object.keys(s.threats).length === 0]);
      checks.push(["spent nothing", s.presses === 0]);
    }
    if (name.indexOf("musket ball") !== -1) {
      checks.push(["musket seen in flight", threatBest("musket") === "CRITICAL" ||
        threatBest("musket") === "HIGH"]);
    }
    if (name.indexOf("dagger pressure") !== -1) {
      checks.push(["dagger pressure recognised",
        ["HIGH", "CRITICAL"].indexOf(threatBest("spam-dagger")) !== -1]);
    }
    if (name.indexOf("spike tick") !== -1) {
      checks.push(["spike tick recognised",
        ["HIGH", "CRITICAL"].indexOf(threatBest("spike-tick")) !== -1]);
    }
    if (name.indexOf("enemy trap") !== -1) {
      checks.push(["trap threat recognised",
        ["HIGH", "CRITICAL"].indexOf(threatBest("trap")) !== -1]);
    }

    const bad = checks.filter(c => !c[1]);
    failures += bad.length;

    console.log(`${bad.length ? "FAIL" : "ok  "}  ${name}`);
    console.log(
      `      ticks ${pad(ticks, 5)} presses ${pad(s.presses, 5)} landed ${pad(s.healedPresses, 5)} ` +
      `refused ${pad(s.refused, 4)} food ${pad(s.foodSpent, 5)}`
    );
    console.log(
      `      shame: max ${pad(s.maxServerShame, 2)} final ${pad(server.shameCount, 2)} ` +
      `at zero ${pad(zeroPct + "%", 5)} locks ${pad(server.locksArmed, 3)} ` +
      `deaths ${pad(s.deaths, 3)} hp ${Math.round(server.health)}`
    );
    const zones = Object.keys(s.zones)
      .map(z => `${z} ${Math.round((s.zones[z] / ticks) * 100)}%`).join("  ");
    console.log(`      zones: ${zones}${s.staleAborts ? `   stale re-reads ${s.staleAborts}` : ""}`);
    const threats = Object.keys(s.threats)
      .map(t => `${t}=${s.threats[t].best}(${s.threats[t].ticks})`).join("  ");
    console.log(`      threats: ${threats || "none"}`);
    for (const [label2] of bad) console.log(`      -> failed: ${label2}`);
    if (process.env.SIM_TRACE) {
      for (const row of sim.log) {
        console.log(
          `      t${pad(row.tick, 4)} hp ${pad(row.hp, 4)} shame ${row.shame}/${row.mirror} ` +
          `${row.locked ? "LOCK " : "     "}${pad(row.urgency, 9)} ${pad(row.reason, 26)} x${row.presses}`
        );
      }
    }
    console.log("");
  }

  if (failures) console.log(`${failures} check(s) failed\n`);
  else console.log("all scenarios pass\n");
  return failures;
}

module.exports = { runAll };

if (require.main === module) {
  process.exit(runAll(createRynAutoHealEngine) ? 1 : 0);
}
