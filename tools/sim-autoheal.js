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

/* A stand-in for the placement engine's TargetMotion, with the same shape and
 * the same arithmetic: a short sample history, velocity and acceleration from
 * it, heading and heading shift, a stability score, and predict/intercept with
 * a horizon decay. The engine borrows this class's constructor exactly as it
 * borrows the real one, so the borrow path and the confidence curve are both
 * under test rather than stubbed out. */
class SimTargetMotion {
  constructor() { this.tracks = new Map(); }

  observe(entity, tick) {
    const id = entity.id;
    let track = this.tracks.get(id);
    if (!track) {
      track = { samples: [], vx: 0, vy: 0, ax: 0, ay: 0, heading: null,
        headingShift: 0, speed: 0, peakSpeed: 0, stability: 0, lastTick: tick };
      this.tracks.set(id, track);
    }
    if (track.samples.length && track.samples[track.samples.length - 1].tick === tick) return track;
    if (tick - track.lastTick > 2) track.samples.length = 0;
    const pos = entity.pos.current;
    track.samples.push({ x: pos.x, y: pos.y, tick });
    if (track.samples.length > 5) track.samples.shift();
    track.lastTick = tick;

    const s = track.samples;
    if (s.length >= 2) {
      const a = s[s.length - 2], b = s[s.length - 1];
      const span = Math.max(1, b.tick - a.tick);
      const vx = (b.x - a.x) / span, vy = (b.y - a.y) / span;
      if (s.length >= 3) {
        const c = s[s.length - 3];
        const prevSpan = Math.max(1, a.tick - c.tick);
        track.ax = vx - (a.x - c.x) / prevSpan;
        track.ay = vy - (a.y - c.y) / prevSpan;
      } else { track.ax = 0; track.ay = 0; }
      track.vx = vx; track.vy = vy;
      track.speed = Math.hypot(vx, vy);
      track.peakSpeed = Math.max(track.peakSpeed, track.speed);
      const prev = track.heading;
      track.heading = track.speed > 0.5 ? Math.atan2(vy, vx) : prev;
      track.headingShift = prev !== null && track.heading !== null
        ? Math.abs(((track.heading - prev + Math.PI) % (Math.PI * 2)) - Math.PI) : 0;
    }
    track.stability = this._stability(track);
    return track;
  }

  _stability(track) {
    const s = track.samples;
    if (s.length < 3) return 0.35;
    if (track.speed < 0.5) return 0.95;
    const headings = [];
    for (let i = 1; i < s.length; i++) {
      const dx = s[i].x - s[i - 1].x, dy = s[i].y - s[i - 1].y;
      if (Math.hypot(dx, dy) < 0.5) continue;
      headings.push(Math.atan2(dy, dx));
    }
    if (headings.length < 2) return 0.5;
    let spread = 0;
    for (let i = 1; i < headings.length; i++) {
      spread += Math.abs(((headings[i] - headings[i - 1] + Math.PI) % (Math.PI * 2)) - Math.PI);
    }
    spread /= headings.length - 1;
    return Math.max(0.05, 1 - spread / (Math.PI / 2));
  }

  get(id) { return this.tracks.get(id) || null; }

  predict(entity, ticks) {
    const track = this.tracks.get(entity.id);
    const pos = entity.pos.current;
    if (!track || track.samples.length < 2) {
      return { x: pos.x, y: pos.y, confidence: ticks === 0 ? 1 : 0.25 };
    }
    let x = pos.x, y = pos.y, vx = track.vx, vy = track.vy;
    for (let i = 0; i < ticks; i++) { x += vx; y += vy; vx += track.ax; vy += track.ay; }
    const depth = Math.min(1, (track.samples.length - 1) / 2);
    const horizon = Math.exp(-ticks / 3.5);
    const turning = 1 - Math.min(1, (track.headingShift || 0) / (Math.PI / 2));
    return { x, y, confidence: Math.max(0.02, track.stability * depth * horizon * (0.4 + 0.6 * turning)) };
  }

  intercept(entity, cx, cy, radius, maxTicks) {
    for (let n = 0; n <= maxTicks; n++) {
      const p = this.predict(entity, n);
      if (Math.hypot(p.x - cx, p.y - cy) < radius) {
        return { tick: n, confidence: p.confidence, x: p.x, y: p.y };
      }
    }
    return null;
  }

  expire(tick) {
    for (const [id, track] of this.tracks) {
      if (tick - track.lastTick > 20) this.tracks.delete(id);
    }
  }
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
    /* The predictive engine borrows this class's constructor for its own
     * private tracker; the instance itself is never written to by it. */
    /* placementEngine: the predictive engine borrows this class's constructor
     * for its own private tracker; the instance itself is never written to.
     * velocityTick: only its declared knockback window is read, which is what
     * the engine consumes instead of keeping a second copy of those numbers. */
    staticModules: {
      placementEngine: { motion: new SimTargetMotion() },
      velocityTick: { nearestTarget: null, target: null, minKB: 220, maxKB: 245 }
    },
    selectItem() { this.packetCount += 1; sim.stats.packets += 1; },
    attack() { this.packetCount += 1; sim.stats.packets += 1; sim.queuePress(); },
    whichWeapon() { this.packetCount += 1; sim.stats.packets += 1; },
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
      spikeSyncThreat: false,
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
      pressesWhileLocked: 0, staleAborts: 0, zones: {}, threats: {},
      preempts: 0, cacheHits: 0, cacheMisses: 0, invalidations: {}, motion: "-",
      decisions: {}, ranks: {}, reasonless: 0, survivalPresses: 0,
      rejections: {}, packets: 0, duplicatesBlocked: 0, yields: {}
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
    /* The client's own spike-tick warning: an enemy standing where a spike it
     * places would touch me, once the combined damage clears 100
     * (v5.4:3955-3962). Set by the scenario, read by the engine, never
     * recomputed by it. */
    em.spikeSyncThreat = !!spike.syncThreat;
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
    /* Anything the pre-wire validation refused, whichever way it classified
     * it: a stale read to be re-asked, or an action that was simply wrong. */
    if (typeof tm.reason === "string" &&
        (tm.reason.indexOf("+stale:") !== -1 || tm.reason.indexOf("+cancel:") !== -1)) {
      this.stats.staleAborts += 1;
      const why = tm.reason.split(/\+(?:stale|cancel):/)[1];
      if (why) this.stats.rejections[why] = (this.stats.rejections[why] || 0) + 1;
    }
    this.stats.zones[tm.zone] = (this.stats.zones[tm.zone] || 0) + 1;
    if (typeof tm.reason === "string" && tm.reason.indexOf("preempt") === 0) {
      this.stats.preempts += 1;
    }
    if (tm.invalidatedBy) {
      this.stats.invalidations[tm.invalidatedBy] =
        (this.stats.invalidations[tm.invalidatedBy] || 0) + 1;
    }
    this.stats.motion = tm.motionSource || "-";
    this.stats.duplicatesBlocked = tm.duplicatesBlocked || 0;
    this.stats.decisions[tm.decision] = (this.stats.decisions[tm.decision] || 0) + 1;
    this.stats.ranks[tm.rank] = (this.stats.ranks[tm.rank] || 0) + 1;
    if (!tm.reason || typeof tm.reason !== "string" || !tm.reason.length) {
      this.stats.reasonless += 1;
    }
    if (typeof tm.reason === "string" && tm.reason.indexOf("survival:") === 0 && this.queued) {
      this.stats.survivalPresses += 1;
    }
    /* Who the arbiter stood down for, so cooperation with the other systems is
     * observable rather than assumed. */
    const yielded = /yield:([\w-]+)/.exec(tm.reason || "");
    if (yielded) this.stats.yields[yielded[1]] = (this.stats.yields[yielded[1]] || 0) + 1;
    const [hits, total] = String(tm.predictCache || "0/0").split("/").map(Number);
    this.stats.cacheHits = hits;
    this.stats.cacheMisses = total - hits;
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
      fc: `${tm.forecastDamage}@${tm.forecastTiming}/${tm.forecastLevel}`,
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

/* Consuming the client's spike-tick warning rather than running a second
 * placement scan. EnemyManager raises spikeSyncThreat when enough enemies are
 * standing where a spike they place would touch me; the engine may speak on it
 * before anything has landed, but not above MEDIUM — a spike that can be placed
 * still has to be placed. */
scenario("spike sync warning, before the first hit", () => {
  const sim = new Sim({ foodId: 1 });
  const placer = makeEnemy({
    id: 1, x: 130, px: 150, current: 5, primary: 5, primaryReload: 1
  });
  placer.canPlaceSpike = true;
  placer.spikeDamage = 45;
  for (let t = 1; t <= 30; t++) {
    const warned = t >= 6 && t <= 24;
    /* No damage at all: the whole point is the pre-damage branch. */
    sim.step(0, 0, {
      enemies: [placer],
      spike: warned ? { syncThreat: true, damage: 45, willCollide: t >= 14 } : {}
    });
  }
  return sim;
});

/* The Velocity Tick band comes from the module that owns it. The enemy sits at
 * 232 — inside VelocityTick's own 220-245 window — with the polearm and turret
 * halves of the combo actually present, which is what makes it a threat rather
 * than someone standing at a distance. */
scenario("velocity tick aimed at us, inside the module's own band", () => {
  const sim = new Sim({ foodId: 1 });
  const combo = makeEnemy({
    id: 1, x: 232, px: 240, current: 5, primary: 5, primaryReload: 1, turretReload: 1
  });
  for (let t = 1; t <= 30; t++) {
    sim.step(t === 18 ? 45 : 0, t >= 16 ? 45 : 0, { enemies: [combo], turret: 300 });
  }
  return sim;
});

/* Cooperation with the placement systems, both halves of it.
 *
 * A spike tick is half-fired (useTurret set) while a scratch is waiting to be
 * topped up. A top-up is UTILITY on RYN's own scale and has to wait; the burst
 * that follows reaches DEFENSE and does not, which is the exception the
 * existing architecture names rather than one invented here. */
scenario("a spike sync mid-combo outranks a top-up but not a burst", () => {
  const sim = new Sim({ foodId: 1 });
  /* The module's own armed flag, set the way SpikeSync sets it. */
  sim.client._ModuleHandler.staticModules.spikeSync = { useTurret: false };
  const enemy = makeEnemy({ id: 1, x: 150, current: 5, primary: 5, primaryReload: 1 });
  for (let t = 1; t <= 40; t++) {
    sim.client._ModuleHandler.staticModules.spikeSync.useTurret = t >= 6 && t <= 30;
    /* A scratch early, then a real burst while the combo is still armed. */
    const dmg = t === 4 ? 12 : (t === 20 || t === 22 ? 45 : 0);
    sim.step(dmg, dmg ? 45 : 0, { enemies: [enemy] });
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

/* Survival outranks a perfect count. At 6 the next charge is priced at most of
 * a life, which is exactly the pressure that would make a shame-optimising
 * engine sit still and die; the value model has to spend it anyway when the
 * alternative is dying. */
scenario("survival beats shame at 6", () => {
  const sim = new Sim({ foodId: 1, shame: 6 });
  sim.client.myPlayer.shameCount = 6;
  for (let t = 1; t <= 60; t++) sim.step(t % 3 === 0 ? 55 : 0, 55);
  return sim;
});

/* ---------------------------------------------------------------- *
 * Predictive defense.
 * ---------------------------------------------------------------- */

/* Someone crossing the field on a straight line, arriving in polearm reach
 * around tick 13. Chip damage keeps the gap under one cookie, which is exactly
 * where the food-economy rule would otherwise say "not worth a press" — so any
 * healing that happens before contact is the forecast's doing. */
scenario("an enemy closing on a straight line", () => {
  const sim = new Sim({ foodId: 1 });
  let x = 620;
  for (let t = 1; t <= 40; t++) {
    if (x > 180) x -= 40;
    const enemy = makeEnemy({
      id: 1, x, px: x + 40, current: 5, primary: 5, primaryReload: 1
    });
    const arrived = x <= 210;
    /* Chip damage every other tick on the way in: it keeps the gap under one
     * cookie, which is where the food-economy rule says "not worth a press",
     * so any healing before contact is the forecast's doing and not the
     * ordinary top-up's. */
    const chip = !arrived && t % 2 === 0 ? 6 : 0;
    sim.step(chip || (arrived && t % 3 === 0 ? 45 : 0), arrived ? 45 : 0,
      { enemies: [enemy] });
  }
  return sim;
});

/* The same approach, abandoned. The enemy turns away at tick 8, and the
 * prediction that had them arriving has to be dropped rather than spent
 * against. */
scenario("a closing enemy turns away", () => {
  const sim = new Sim({ foodId: 1 });
  let x = 620, y = 0;
  for (let t = 1; t <= 40; t++) {
    if (t < 8) { x -= 40; } else { y += 40; }        // straight in, then across
    const enemy = makeEnemy({
      id: 1, x, y, px: t < 8 ? x + 40 : x, py: t < 8 ? y : y - 40,
      current: 5, primary: 5, primaryReload: 1
    });
    sim.step(t <= 4 ? 5 : 0, 0, { enemies: [enemy] });
  }
  return sim;
});

/* Nothing moves for forty ticks. The prediction is built once and reused. */
scenario("a still field rebuilds nothing", () => {
  const sim = new Sim({ foodId: 1 });
  const idle = makeEnemy({ id: 1, x: 500, px: 500, current: 5, primary: 5 });
  for (let t = 1; t <= 40; t++) sim.step(0, 0, { enemies: [idle] });
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
    /* A debt has to come down — except where survival forces the count up
     * instead, which is the trade the engine is supposed to make. That
     * scenario is judged on its own terms below. */
    if (sim.startShame > 0 && !sim.allowDeaths && name.indexOf("survival beats shame") === -1) {
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
      checks.push(["and named why", !!(s.rejections.lockguard || s.rejections["count-moved"])]);
    }

    /* ---- decision engine -------------------------------------------- */
    /* Every decision, every tick, carries a reason. */
    checks.push(["every decision has a reason", s.reasonless === 0]);
    const known = ["HEAL_NOW", "WAIT", "PREPARE", "CANCEL", "RECALCULATE"];
    checks.push(["decisions are from the enum",
      Object.keys(s.decisions).every(d => known.indexOf(d) !== -1)]);
    if (name.indexOf("survival beats shame") !== -1) {
      checks.push(["spent the charge to live", s.survivalPresses > 0]);
      checks.push(["and did not arm the lock doing it", server.locksArmed === 0]);
    }
    /* The priority order is emergent, so it is checked by what it ranks: a
     * spike sequence must never be ranked below shame optimisation, and a
     * quiet field with a debt must rank shame optimisation at all. */
    if (name.indexOf("spike tick") !== -1) {
      const top = Object.keys(s.ranks).sort((a, b) => s.ranks[b] - s.ranks[a])[0];
      checks.push(["ranked the spike above shame", top !== "shame-optimisation"]);
    }
    if (name.indexOf("shame debt at 6") !== -1) {
      checks.push(["ranked shame optimisation on a quiet field",
        !!s.ranks["shame-optimisation"]]);
    }

    /* ---- predictive defense ---------------------------------------- */
    if (name.indexOf("closing on a straight line") !== -1) {
      checks.push(["acted before contact", s.preempts > 0]);
      checks.push(["borrowed RYN's motion tracker", s.motion === "ryn-target-motion"]);
    }
    if (name.indexOf("turns away") !== -1) {
      /* The prediction that had them arriving has to be dropped, and nothing
       * may be spent on it afterwards. */
      checks.push(["dropped the abandoned approach", !!s.invalidations["enemy-turned"]]);
      checks.push(["spent nothing on it", s.presses <= 2]);
    }
    if (name.indexOf("still field") !== -1) {
      /* Nothing changed for forty ticks, so nothing should have been rebuilt. */
      const total = s.cacheHits + s.cacheMisses;
      checks.push(["reused the prediction", total > 0 && s.cacheHits / total >= 0.7]);
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
    if (name.indexOf("spike sync warning") !== -1) {
      /* The client's warning is consumed: the detector speaks before any
       * damage has landed. */
      checks.push(["spike-tick warning consumed before any damage",
        ["LOW", "MEDIUM"].indexOf(threatBest("spike-tick")) !== -1]);
      /* And not above MEDIUM — a placeable spike is not a placed one, and only
       * a confirmed hit earns HIGH. */
      checks.push(["a placeable spike is not a HIGH threat",
        ["HIGH", "CRITICAL"].indexOf(threatBest("spike-tick")) === -1]);
      /* A warning is not a reason to spend food. */
      checks.push(["spent nothing on a warning alone", s.presses === 0]);
    }
    if (name.indexOf("spike sync mid-combo") !== -1) {
      /* It actually stood down, and named the system it stood down for. */
      checks.push(["stood down for the spike tick", (s.yields["spike-tick"] || 0) > 0]);
      /* And the exception the architecture names still works: the burst got
       * through while the same combo was armed. */
      checks.push(["but the burst still got healed", s.presses > 0]);
      checks.push(["and nobody died waiting", s.deaths === 0]);
    }
    if (name.indexOf("velocity tick aimed") !== -1) {
      /* Read from VelocityTick's own band, so an enemy at 232 is inside it. */
      checks.push(["velocity tick recognised inside the module's band",
        ["MEDIUM", "HIGH", "CRITICAL"].indexOf(threatBest("velocity-tick")) !== -1]);
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
    const invalid = Object.keys(s.invalidations)
      .filter(k => k).map(k => `${k}:${s.invalidations[k]}`).join(" ");
    console.log(
      `      predict: preempts ${pad(s.preempts, 3)} cache ${s.cacheHits}/${s.cacheHits + s.cacheMisses}` +
      ` motion ${pad(s.motion, 18)}${invalid ? " invalidated " + invalid : ""}`
    );
    const decisions = Object.keys(s.decisions).map(d => `${d} ${s.decisions[d]}`).join("  ");
    const ranks = Object.keys(s.ranks).sort((a, b) => s.ranks[b] - s.ranks[a])
      .slice(0, 4).map(r => `${r} ${s.ranks[r]}`).join("  ");
    const rejects = Object.keys(s.rejections)
      .map(r => `${r}:${s.rejections[r]}`).join(" ");
    const perPress = s.presses ? (s.packets / s.presses).toFixed(1) : "-";
    console.log(`      decisions: ${decisions}${rejects ? "   refused " + rejects : ""}`);
    console.log(
      `      packets: ${s.packets} for ${s.presses} presses (${perPress}/press)` +
      (s.duplicatesBlocked ? `   duplicates blocked ${s.duplicatesBlocked}` : "")
    );
    console.log(`      ranked: ${ranks}`);
    for (const [label2] of bad) console.log(`      -> failed: ${label2}`);
    if (process.env.SIM_TRACE) {
      for (const row of sim.log) {
        console.log(
          `      t${pad(row.tick, 4)} hp ${pad(row.hp, 4)} shame ${row.shame}/${row.mirror} ` +
          `${row.locked ? "LOCK " : "     "}${pad(row.urgency, 9)} ${pad(row.reason, 22)} ${pad(row.fc, 14)} x${row.presses}`
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
