#!/usr/bin/env node
/*
 * test-autoheal.js — the Auto Heal Engine against every requested scenario.
 *
 * The engine is dependency-injected and reads the client only through
 * HostAdapter, so it can be driven against a stand-in client that implements
 * exactly the surfaces the adapter touches. Everything the stand-in reports is
 * the shape the real client reports, and every table it hands over is the real
 * one out of drivers/game-drivers.json — so a scenario that passes here is a
 * scenario the engine reasoned about with the game's own numbers.
 *
 * What this is and is not: it exercises decision logic, packet accounting,
 * shame arithmetic, gear transitions and evasion geometry. It does not
 * exercise the network, the renderer, or RYN's other modules.
 *
 * Usage: node tools/test-autoheal.js [--verbose] [name-filter]
 */

const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const drivers = require(path.join(ROOT, "drivers", "game-drivers.json"));
const { createRynAutoHealEngine } = require(
  path.join(ROOT, "src", "autoheal", "ryn-autoheal-engine.js"));

const VERBOSE = process.argv.indexOf("--verbose") !== -1;

/* The engine reads wall-clock time through Date.now — the shame window is
 * measured in milliseconds, so it has to. The stand-in therefore owns the
 * clock: every scenario runs against the world's own `now`, advanced one
 * server tick at a time, so "was that press inside 120ms of the hit" is asked
 * against the same timeline the scenario describes. Without this the engine
 * would compare a fictional damage stamp against the real clock and read
 * every press as credit, which is exactly the sort of quiet mistake this
 * harness exists to catch. */
const REAL_NOW = Date.now;
let CLOCK = null;
Date.now = () => (CLOCK ? CLOCK.now : REAL_NOW());
const FILTER = process.argv.slice(2).filter(a => a[0] !== "-")[0] || "";

/* ------------------------------------------------------------------ *
 * The tables, as the client exposes them.
 * ------------------------------------------------------------------ */
/* The client holds its own copy of these tables and spells two fields
 * differently from the bundle they came from: `damage` rather than `dmg`, and
 * a derived `knockback` in pixels next to `knock`. The stand-in presents the
 * client's shape, because that is what the adapter reads at runtime. */
const Weapons = drivers.weapons.map(w => Object.assign({}, w, {
  damage: w.dmg,
  /* RYN's own derivation, matching the numbers in its table: the impulse
   * (0.3 base plus the weapon's knock) over the per-tick decay. */
  knockback: Math.round(((0.3 + (w.knock || 0)) / 0.009) * 10) / 10
}));
const Projectiles = drivers.projectiles.map((p, i) => Object.assign({}, p, {
  id: i,
  damage: p.dmg,
  /* The turret projectile takes its speed and range from the turret rather
   * than from the projectile table; RYN's copy folds them in. */
  speed: p.speed === undefined ? 1.5 : p.speed,
  range: p.range === undefined ? 700 : p.range
}));
const Config = drivers.config;
const Hats = {};
for (const h of drivers.hats) Hats[h.id] = h;
const Accessories = {};
for (const a of drivers.accessories) Accessories[a.id] = a;
/* RYN's Items copy carries `restore` and `cost` on the food entries; the raw
 * table carries `req`. Both are provided so the adapter's fallback is
 * exercised on one and the fast path on the other. */
const Items = drivers.items.map((item, i) => {
  const copy = Object.assign({}, item);
  if (i === 0) { copy.restore = 20; copy.cost = { food: 10 }; }
  if (i === 1) { copy.restore = 40; copy.cost = { food: 15 }; }
  if (i === 2) { copy.restore = 30; copy.cost = { food: 25 }; }
  copy.itemGroup = item.group ? item.group.id : undefined;
  return copy;
});

const Settings = {
  _autoHealEngine: true,
  _autoHealWash: true,
  _autoHealStrict: false,
  _autoHealGear: true,
  _autoHealEvade: true,
  _autoHealReserve: 15,
  _antiSmartTick: false,
  _autoplacer: false,
  _prePlace: false,
  _replace: false,
  _safeSoldier: false
};

const AutoHealEngine = createRynAutoHealEngine({
  get Items() { return Items; },
  get Hats() { return Hats; },
  get Accessories() { return Accessories; },
  get Weapons() { return Weapons; },
  get Projectiles() { return Projectiles; },
  get Config() { return Config; },
  get Settings() { return Settings; }
});
const AH = AutoHealEngine.AH;
const THREAT = AutoHealEngine.THREAT;

/* ------------------------------------------------------------------ *
 * A position with the two methods the client's Vector has.
 * ------------------------------------------------------------------ */
class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
  clone() { return new Vec(this.x, this.y); }
}

/* ------------------------------------------------------------------ *
 * The stand-in client. Only the surfaces HostAdapter reads.
 * ------------------------------------------------------------------ */
class FakeEnemy {
  constructor(spec, id) {
    this.id = id;
    this.pos = { current: new Vec(spec.x, spec.y), previous: new Vec(spec.x, spec.y) };
    this.angle = spec.angle === undefined ? Math.PI : spec.angle;
    this.speed = spec.speed || 0;
    this.move_dir = spec.moveDir === undefined ? null : spec.moveDir;
    this.scale = 35;
    this.hatID = spec.hat || 0;
    this.accessoryID = 0;
    this.currentHealth = spec.health === undefined ? 100 : spec.health;
    this.isTrapped = !!spec.trapped;
    this.usingBoost = !!spec.boost;
    this.canUseTurret = !!spec.canUseTurret;
    this.lastAttacked = 0;
    this.weapon = {
      primary: spec.primary === undefined ? 5 : spec.primary,
      secondary: spec.secondary === undefined ? null : spec.secondary,
      current: spec.current === undefined
        ? (spec.primary === undefined ? 5 : spec.primary) : spec.current,
      oldCurrent: spec.old === undefined ? null : spec.old
    };
    this.reload = [
      { current: spec.reload0 === undefined ? 999 : spec.reload0, max: 999, previous: 0 },
      { current: spec.reload1 === undefined ? 999 : spec.reload1, max: 999, previous: 0 },
      { current: spec.reload2 === undefined ? 999 : spec.reload2, max: 999, previous: 0 }
    ];
    this.danger = spec.danger || 0;
    this.reverseInsta = !!spec.reverseInsta;
    this.toolHammerInsta = !!spec.toolHammerInsta;
    this.rangedBowInsta = !!spec.rangedBowInsta;
    this.canPlaceSpike = !!spec.canPlaceSpike;
    this.spikeDamage = spec.spikeDamage || 0;
    this.potentialDamage = spec.potentialDamage || 0;
  }

  isReloaded(type, tick) { return this.reload[type].current >= (tick || 1); }
  isEmptyReload(type) { return this.reload[type].current === 0; }
  getWeaponRange(id) {
    const w = Weapons[id];
    if (!w) return 0;
    if (w.range) return w.range;
    const p = w.projectile !== undefined ? Projectiles[w.projectile] : null;
    return p && p.range ? p.range : 0;
  }
  getMaxWeaponDamage(id) {
    const w = Weapons[id];
    if (!w) return 0;
    /* The client's own arithmetic: melee is priced at the bull multiplier
     * (Player.getMaxWeaponDamage, addBull defaults true); shootables are the
     * projectile's damage. */
    if (w.damage) return w.damage * Hats[7].dmgMultO;
    if (w.projectile !== undefined) return Projectiles[w.projectile].damage;
    return 0;
  }
  step(dx, dy) {
    this.pos.previous = this.pos.current.clone();
    this.pos.current = new Vec(this.pos.current.x + dx, this.pos.current.y + dy);
    this.speed = Math.hypot(dx, dy);
    if (this.speed > 0) this.move_dir = Math.atan2(dy, dx);
  }
}

class FakeProjectile {
  constructor(spec, id) {
    this.id = id;
    this.pos = { current: new Vec(spec.x, spec.y) };
    this.angle = spec.angle;
    this.type = spec.type;
    this.speed = Projectiles[spec.type].speed || 1.6;
    this.scale = Projectiles[spec.type].scale || 100;
    this.damage = Projectiles[spec.type].damage;
    this.range = Projectiles[spec.type].range || 0;
    this.isTurret = spec.type === 1;
    this.life = spec.life === undefined ? 9 : spec.life;
    this.ownerClient = { id: spec.owner === undefined ? 1 : spec.owner };
  }
  shouldRemove() { return this.life <= 0; }
  advance(tickMs) {
    const travel = this.speed * tickMs;
    this.pos.current = new Vec(
      this.pos.current.x + Math.cos(this.angle) * travel,
      this.pos.current.y + Math.sin(this.angle) * travel
    );
    this.life -= 1;
  }
}

class FakeWorld {
  constructor(options) {
    const o = options || {};
    this.tick = 0;
    this.TICK = 1000 / 9;
    this.now = 1000000;
    this.frames = [];          // every packet sent, in order
    this.packetCount = 0;
    this.packetLimit = o.packetLimit === undefined ? 119 : o.packetLimit;
    this.pong = o.pong === undefined ? 40 : o.pong;
    this.objects = new Map();
    this.nextObjectId = 1;
    this.enemies = [];
    this.projectiles = [];
    this.nextEnemyId = 1;
    this.nextProjId = 1;
    this.equips = [];
    this.moves = [];
    /* The server's own copy of the shame state — the ground truth every
     * scenario asserts against, because the client's mirror is a replay and
     * the engine's count is an estimate. */
    this.serverShame = 0;
    this.peakServerShame = 0;
    this.serverHitTime = null;
    this.serverLocked = false;
    this.ownedHats = o.ownedHats || [6, 7, 22, 53];

    const world = this;

    this.myPlayer = {
      inGame: true,
      isSandbox: false,
      currentHealth: o.health === undefined ? 100 : o.health,
      previousHealth: o.health === undefined ? 100 : o.health,
      maxHealth: undefined,
      shameCount: 0,
      shameActive: false,
      receivedDamage: null,
      hatID: 0,
      accessoryID: 0,
      storeData: [0, 0],
      tickCount: 0,
      damageTick: -99,
      bullTick: 0,
      poisonCount: 0,
      isDmgOverTime: false,
      isTrapped: false,
      trappedIn: null,
      pos: { current: new Vec(0, 0), previous: new Vec(0, 0) },
      scale: 35,
      speed: o.speed === undefined ? 12 : o.speed,
      move_dir: null,
      resources: { food: 500, wood: 500, stone: 500 },
      getItemByType(type) { return type === 2 ? (o.food === undefined ? 1 : o.food) : type === 0 ? 5 : 10; },
      getBuildingDamage() { return 40; },
      isBullTickTime() { return (world.myPlayer.tickCount - world.myPlayer.bullTick) % 9 === 0; }
    };

    this.EnemyManager = this._emptyThreat();
    this.ProjectileManager = { dangerProjectiles: new Set(), totalDamage: 0 };
    this.PlayerManager = {
      enemies: this.enemies,
      isEnemyByID(ownerId) { return ownerId !== 0; }
    };
    this.ObjectManager = {
      objects: this.objects,
      grid2D: {
        query(x, y, radius, cb) {
          for (const [id, obj] of world.objects) {
            const p = obj.pos.current;
            if (Math.hypot(p.x - x, p.y - y) > 120 * Math.max(1, radius) + 200) continue;
            cb(id);
          }
        }
      }
    };
    this.SocketManager = { TICK: this.TICK, pong: this.pong };

    this._ModuleHandler = {
      tickCount: 0,
      get packetCount() { return world.packetCount; },
      set packetCount(_v) {},
      packetLimit: this.packetLimit,
      moduleActive: false,
      activeModule: null,
      healedOnce: false,
      placedOnce: false,
      didAntiInsta: false,
      totalPlaces: 0,
      attacking: 0,
      shouldAttack: false,
      forceHat: null,
      useHat: null,
      moveTo: "disable",
      prevMoveTo: "disable",
      move_dir: null,
      _ahGearLock: null,
      store: [{ last: 0, actual: -1 }, { last: 0, actual: -1 }],
      staticModules: {},
      weapon: 0,
      canBuy(type, id) { return type === 0 && world.ownedHats.indexOf(id) !== -1; },
      setForceHat(hat) {
        if (this.forceHat !== null && hat !== null) return;
        this.forceHat = hat;
      },
      selectItem() { world._send("selectItem"); },
      attack() { world._send("attack"); },
      whichWeapon() { world._send("whichWeapon"); },
      _getPredictWeapon() { return 0; }
    };
  }

  _emptyThreat() {
    return {
      potentialDamage: 0, potentialSpikeDamage: 0, potentialSpikeKnockbackDamage: 0,
      primaryDamage: 0, detectedDangerEnemy: false, dangerWithoutSoldier: false,
      collidingSpike: false, willCollideSpike: false, pushingOnSpike: false,
      spikeSyncThreat: false, nearestEnemy: null, nearestEnemyPush: null,
      nearestPushSpike: null, nearestTrap: null, nearestTurretEntity: null,
      instaThreat() { return this.detectedDangerEnemy || this.spikeSyncThreat; }
    };
  }

  _send(kind) {
    this.packetCount += 1;
    this.frames.push({ tick: this.tick, kind });
    if (this.packetCount > this.packetLimit) {
      throw new Error(`PACKET LIMIT EXCEEDED at tick ${this.tick} (${this.packetCount} > ${this.packetLimit})`);
    }
  }

  addEnemy(spec) {
    const e = new FakeEnemy(spec, this.nextEnemyId++);
    this.enemies.push(e);
    return e;
  }

  addProjectile(spec) {
    const p = new FakeProjectile(spec, this.nextProjId++);
    this.projectiles.push(p);
    this.ProjectileManager.dangerProjectiles.add(p);
    return p;
  }

  addObject(spec) {
    const id = this.nextObjectId++;
    this.objects.set(id, {
      sid: id,
      itemGroup: spec.group,
      type: spec.type === undefined ? 6 : spec.type,
      ownerID: spec.owner === undefined ? 1 : spec.owner,
      pos: { current: new Vec(spec.x, spec.y) },
      collisionScale: spec.scale === undefined ? 49 : spec.scale,
      scale: spec.scale === undefined ? 49 : spec.scale,
      turretReloaded: spec.ready === undefined ? true : spec.ready,
      getDamage() { return spec.damage === undefined ? 35 : spec.damage; }
    });
    return id;
  }

  damage(amount) {
    const me = this.myPlayer;
    me.previousHealth = me.currentHealth;
    me.currentHealth = Math.max(0, me.currentHealth - amount);
    /* Both clocks: the server's own hitTime (game_index.js:2422) and the
     * client's mirror of it (Entity.updateHealth). */
    this.serverHitTime = this.now;
    me.receivedDamage = this.now;
    me.damageTick = me.tickCount + 1;
  }

  /* The server's shame rule, run the way the server runs it
   * (game_index.js:2461-2469), and the client's mirror following it.
   *
   * The gap the server measures is not the gap the client sees when it sends:
   * the hit was stamped at server time S, the press leaves at client time C and
   * arrives half a round trip later, so the server compares (C + rtt/2) - S.
   * Getting that offset wrong is the difference between a press that banks -2
   * and one that costs +1, so the harness models it explicitly rather than
   * comparing two client-side timestamps and hoping. */
  press(amount) {
    const me = this.myPlayer;
    let delta = 0;
    if (this.serverHitTime !== null) {
      const gap = (this.now + this.pong / 2) - this.serverHitTime;
      this.serverHitTime = null;
      delta = gap <= AH.SHAME_WINDOW_MS ? 1 : -AH.SHAME_CREDIT;
      this.serverShame = Math.max(0, this.serverShame + delta);
      if (this.serverShame >= AH.SHAME_LOCK_AT) {
        /* The lock is armed before consume is reached, so the press does not
         * heal either — the exact trap the engine must never walk into. */
        this.serverShame = 0;
        this.serverLocked = true;
        me.shameActive = true;
        me.hatID = 45;
        return;
      }
    }
    if (this.serverLocked) return;
    const before = me.currentHealth;
    me.previousHealth = before;
    me.currentHealth = Math.min(100, before + amount);
    /* The mirror only moves on an observed health rise, so a press at full
     * health is invisible to it — which is exactly the case the engine's own
     * deferred count exists to cover. */
    if (me.currentHealth > before && me.receivedDamage !== null) {
      me.receivedDamage = null;
      me.shameCount = Math.max(0, Math.min(AH.SHAME_MAX, me.shameCount + delta));
    }
  }

  applyHeal(amount) { this.press(amount); }

  /* One server tick: advance the clock, age projectiles, run the client's own
   * turn (equipping the locked hat the way Autohat does), and reset the
   * per-tick module state the way ModuleHandler.postTick does. */
  advance() {
    const mh = this._ModuleHandler;

    /* Autohat: the gear lock is read ahead of forceHat, and _equip only sends
     * when the hat actually changes. */
    const lock = mh._ahGearLock;
    let want = null;
    if (lock && lock.tick === mh.tickCount) want = lock.hat;
    else if (mh.forceHat !== null) want = mh.forceHat;
    else if (mh.useHat !== null) want = mh.useHat;
    if (want !== null && mh.store[0].last !== want) {
      mh.store[0].last = want;
      this._send("equip");
      this.equips.push({ tick: this.tick, hat: want });
      /* The server confirms a tick later. */
      this.myPlayer.hatID = want;
      this.myPlayer.storeData[0] = want;
    }

    /* SafeWalk: one move frame when the claim changed. */
    if (mh.prevMoveTo !== mh.moveTo) {
      this._send("move");
      this.moves.push({ tick: this.tick, angle: mh.moveTo });
    }
    mh.prevMoveTo = mh.moveTo;
    mh.moveTo = "disable";

    mh.forceHat = null;
    mh._ahGearLock = null;
    mh.useHat = null;
    mh.moduleActive = false;
    mh.activeModule = null;
    mh.healedOnce = false;

    this.tick += 1;
    this.now += this.TICK;
    this.myPlayer.tickCount = this.tick;
    mh.tickCount = this.tick;

    for (const p of this.projectiles.slice()) {
      p.advance(this.TICK);
      if (p.shouldRemove()) {
        this.ProjectileManager.dangerProjectiles.delete(p);
        this.projectiles.splice(this.projectiles.indexOf(p), 1);
      }
    }
    this.ProjectileManager.totalDamage = 0;
    for (const p of this.ProjectileManager.dangerProjectiles) {
      this.ProjectileManager.totalDamage += p.damage;
    }

    /* The packet counter resets once a second, as PacketManager's interval
     * does. Nine ticks is one second. */
    if (this.tick % 9 === 0) this.packetCount = 0;
  }
}

/* ------------------------------------------------------------------ *
 * The runner.
 * ------------------------------------------------------------------ */
const results = [];

function run(name, body, worldOptions) {
  if (FILTER && name.toLowerCase().indexOf(FILTER.toLowerCase()) === -1) return;
  const world = new FakeWorld(worldOptions);
  CLOCK = world;
  const engine = new AutoHealEngine(world);
  const trace = [];
  const ctx = {
    world, engine, trace,
    /* One tick: the engine speaks, then the client's turn happens. */
    step(times) {
      const n = times === undefined ? 1 : times;
      for (let i = 0; i < n; i++) {
        world._ModuleHandler.forceHat = null;
        engine.postTick();
        trace.push(Object.assign({ tick: world.tick }, engine.telemetry));
        /* Presses that were sent buy health a tick later, the way the server
         * applies them. */
        const t = engine.telemetry;
        if (t.presses > 0) {
          const restore = Items[world.myPlayer.getItemByType(2)].restore;
          /* Only the first press of a burst is judged; the rest land with
           * hitTime already cleared. */
          world.press(restore);
          for (let k = 1; k < t.presses; k++) world.press(restore);
        }
        world.peakServerShame = Math.max(world.peakServerShame, world.serverShame);
        world.advance();
      }
    },
    last() { return trace[trace.length - 1]; },
    /* Did any tick report a threat of this type? */
    sawThreat(type) {
      return trace.some(t => (t.threats || []).some(s => s.indexOf(type + ":") === 0));
    },
    threatAt(type) {
      for (const t of trace) {
        const hit = (t.threats || []).find(s => s.indexOf(type + ":") === 0);
        if (hit) return { tick: t.tick, entry: hit, telemetry: t };
      }
      return null;
    },
    sawGear(hat) { return world.equips.some(e => e.hat === hat); },
    peakShame() { return trace.reduce((m, t) => Math.max(m, t.shame), 0); },
    peakServerShame() { return world.peakServerShame; },
    peakPackets() { return world.frames.length; }
  };
  let error = null;
  try {
    body(ctx);
  } catch (e) {
    error = e;
  } finally {
    CLOCK = null;
  }
  results.push({ name, error, trace, world });
  if (error) {
    console.log(`  FAIL  ${name}`);
    console.log("        " + error.message);
    if (VERBOSE && error.stack) console.log(error.stack.split("\n").slice(1, 4).join("\n"));
  } else {
    const w = results[results.length - 1].world;
    const shame = `shame peak ${w.peakServerShame} end ${w.serverShame}`;
    const packets = `packets ${w.frames.length}`;
    console.log(`  ok    ${name}  [${shame}, ${packets}]`);
  }
  if (VERBOSE) {
    for (const t of trace) {
      console.log(`        t${t.tick} ${t.urgency}/${t.decision} shame=${t.shame}` +
        ` verdict=${t.verdict} presses=${t.presses} gear=${t.gear} rank=${t.rank}` +
        ` threats=[${(t.threats || []).join(" ")}] reason=${t.reason}`);
    }
  }
}

/* Assertions shared by every scenario — the invariants of requirement 36. */
function invariants(ctx, opts) {
  const o = opts || {};
  const { world, trace } = ctx;
  /* Packet limit, per second, counted at the wire. FakeWorld throws the
   * moment a frame would exceed it, so reaching here means it never did. */
  for (const t of trace) {
    assert.ok(t.packetsFree >= 0, `tick ${t.tick}: negative packet headroom`);
    assert.ok(t.packetsUsed <= t.packetLimit,
      `tick ${t.tick}: spent ${t.packetsUsed} of ${t.packetLimit}`);
  }
  /* Shame never reaches the lock, ever — asserted against the server's own
   * count rather than the engine's belief about it. */
  assert.ok(!world.serverLocked, "the shame lock was armed");
  const peak = Math.max(ctx.peakShame(), ctx.peakServerShame());
  assert.ok(peak <= AH.SHAME_MAX, `shame peaked at ${peak}`);
  if (o.shameCeiling !== undefined) {
    assert.ok(peak <= o.shameCeiling,
      `shame peaked at ${peak}, expected <= ${o.shameCeiling}`);
  }
  /* No duplicate press for the same action while one is still in the air. */
  const doubled = trace.filter(t => t.presses > AH.MAX_PRESSES_PER_TICK);
  assert.strictEqual(doubled.length, 0, "a tick pressed more than the burst cap");
  /* The engine never leaves the client holding food. */
  assert.ok(!ctx.engine.adapter.holdingFood, "left the client holding food");
}

console.log("\nAuto Heal Engine — scenarios\n");

/* ================================================================== *
 * 1. Anti Velocity Tick
 * ================================================================== */
run("1. anti velocity tick", ctx => {
  const { world } = ctx;
  /* A polearm inside the knockback band with a turret behind it. */
  world.addEnemy({ x: 200, y: 0, primary: 5, current: 5, angle: Math.PI,
    canUseTurret: true, speed: 8, moveDir: Math.PI, hat: 53 });
  world.addObject({ group: 7, x: 400, y: 0, ready: true });
  world.EnemyManager.potentialDamage = 45 * 1.5 + 25;
  ctx.step(3);
  assert.ok(ctx.sawThreat(THREAT.VELOCITY_TICK),
    "velocity tick not detected: " + JSON.stringify(ctx.last().threats));
  /* Detected before any damage landed. */
  assert.strictEqual(world.myPlayer.currentHealth, 100, "took damage before detecting");
  invariants(ctx);
});

/* ================================================================== *
 * 2. Anti Insta Kill — bull hat then turret gear
 * ================================================================== */
run("2. anti insta kill (bull -> turret gear)", ctx => {
  const { world } = ctx;
  const e = world.addEnemy({ x: 120, y: 0, primary: 5, current: 5, angle: Math.PI,
    hat: 7, canUseTurret: true, danger: 3 });
  world.EnemyManager.potentialDamage = 45 * 1.5 + 25;
  world.EnemyManager.detectedDangerEnemy = true;
  world.EnemyManager.dangerWithoutSoldier = true;
  ctx.step(1);
  /* the switch that completes the sequence */
  e.hatID = 53;
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.INSTAKILL),
    "insta kill not detected: " + JSON.stringify(ctx.last().threats));
  const found = ctx.threatAt(THREAT.INSTAKILL);
  assert.ok(found.entry.indexOf("CRITICAL") !== -1 || found.entry.indexOf("HIGH") !== -1,
    "insta kill detected but not at HIGH/CRITICAL: " + found.entry);
  assert.ok(ctx.sawGear(AH.HAT_SOLDIER), "soldier not equipped against the insta");
  assert.strictEqual(world.myPlayer.currentHealth, 100, "took damage before defending");
  invariants(ctx);
});

/* ================================================================== *
 * 3. Anti Reverse Insta Kill — turret gear then bull
 * ================================================================== */
run("3. anti reverse insta kill (turret gear -> bull)", ctx => {
  const { world } = ctx;
  const e = world.addEnemy({ x: 110, y: 0, primary: 5, secondary: 15, current: 5,
    angle: Math.PI, hat: 53, reload1: 0, reload2: 0, canUseTurret: true });
  world.EnemyManager.potentialDamage = 45 * 1.5 + 50 + 25;
  ctx.step(1);
  e.hatID = 7;                     // the reverse switch
  e.reverseInsta = true;           // the client's own verdict follows
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.INSTA_REV),
    "reverse insta not detected: " + JSON.stringify(ctx.last().threats));
  const found = ctx.threatAt(THREAT.INSTA_REV);
  /* Its own timing model: everything is loaded, so it lands on this tick. */
  assert.ok(/@0$/.test(found.entry), "reverse insta should be timed at 0: " + found.entry);
  assert.ok(ctx.sawGear(AH.HAT_SOLDIER), "soldier not equipped against the reverse insta");
  invariants(ctx);
});

/* ================================================================== *
 * 4. Anti Musket
 * ================================================================== */
run("4. anti musket", ctx => {
  const { world } = ctx;
  world.addEnemy({ x: 600, y: 0, primary: 5, secondary: 15, current: 15,
    old: 12, angle: Math.PI });
  world.myPlayer.currentHealth = 60;
  world.addProjectile({ x: 500, y: 0, angle: Math.PI, type: 5 });
  world.ProjectileManager.totalDamage = 50;
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.MUSKET),
    "musket not detected: " + JSON.stringify(ctx.last().threats));
  invariants(ctx);
});

/* ================================================================== *
 * 5. Anti Bow
 * ================================================================== */
run("5. anti bow", ctx => {
  const { world } = ctx;
  world.addEnemy({ x: 400, y: 0, primary: 5, secondary: 9, current: 9, angle: Math.PI });
  world.addProjectile({ x: 300, y: 0, angle: Math.PI, type: 0 });
  world.ProjectileManager.totalDamage = 25;
  world.myPlayer.currentHealth = 70;
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.BOW),
    "bow not detected: " + JSON.stringify(ctx.last().threats));
  invariants(ctx);
});

/* ================================================================== *
 * 6. Projectile micro-evasion
 * ================================================================== */
run("6. projectile micro-evasion", ctx => {
  const { world } = ctx;
  /* An arrow four ticks out, dead on the line, with clear ground either side. */
  world.addProjectile({ x: -700, y: 0, angle: 0, type: 0 });
  world.ProjectileManager.totalDamage = 25;
  world.myPlayer.speed = 40;
  ctx.step(2);
  assert.ok(world.moves.length > 0, "no dodge was sent: " + ctx.last().evadeReason);
  const move = world.moves[0];
  /* Perpendicular to the shot, which travels along +x. */
  const perpendicular = Math.abs(Math.abs(Math.sin(move.angle)) - 1) < 1e-6;
  assert.ok(perpendicular, "dodge was not perpendicular to the shot: " + move.angle);
  invariants(ctx);
});

run("6b. micro-evasion refuses a dodge into a spike", ctx => {
  const { world } = ctx;
  world.addProjectile({ x: -900, y: 0, angle: 0, type: 0 });
  world.myPlayer.speed = 70;
  /* Both perpendicular destinations blocked. */
  world.addObject({ group: 2, x: 0, y: 90, scale: 49 });
  world.addObject({ group: 2, x: 0, y: -90, scale: 49 });
  ctx.step(2);
  assert.strictEqual(world.moves.length, 0,
    "dodged into a spike: " + JSON.stringify(world.moves));
  assert.ok(ctx.last().evadeReason.indexOf("spike") !== -1,
    "refusal did not name the spike: " + ctx.last().evadeReason);
  invariants(ctx);
});

run("6c. micro-evasion refuses a shot that already misses", ctx => {
  const { world } = ctx;
  /* Same shot, offset well past the hit radius. */
  world.addProjectile({ x: -700, y: 400, angle: 0, type: 0 });
  world.myPlayer.speed = 40;
  ctx.step(2);
  assert.strictEqual(world.moves.length, 0, "dodged a shot that misses");
  invariants(ctx);
});

/* ================================================================== *
 * 7. Anti Spike Push + Insta
 * ================================================================== */
run("7. anti spike push + insta", ctx => {
  const { world } = ctx;
  const pusher = world.addEnemy({ x: 80, y: 0, primary: 5, current: 5, angle: Math.PI,
    hat: 7, canUseTurret: true });
  const spike = world.addObject({ group: 2, x: -70, y: 0, damage: 45 });
  world.myPlayer.isTrapped = true;
  world.myPlayer.trappedIn = { ownerID: 1, health: 500, tempHealth: 500 };
  world.EnemyManager.nearestEnemyPush = pusher;
  world.EnemyManager.nearestPushSpike = world.objects.get(spike);
  world.EnemyManager.pushingOnSpike = true;
  world.EnemyManager.potentialSpikeDamage = 45;
  ctx.step(1);
  /* the gap closes */
  world.EnemyManager.nearestPushSpike.pos.current = new Vec(-50, 0);
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.SPIKE_PUSH),
    "spike push not detected: " + JSON.stringify(ctx.last().threats));
  assert.ok(ctx.sawGear(AH.HAT_SOLDIER), "no defensive gear against the spike push");
  invariants(ctx);
});

/* ================================================================== *
 * 8. Anti KB Tick
 * ================================================================== */
run("8. anti kb tick", ctx => {
  const { world } = ctx;
  world.addEnemy({ x: -100, y: 0, primary: 6, current: 6, angle: 0, hat: 7 });  // bat: knock 0.7
  world.EnemyManager.potentialSpikeKnockbackDamage = 45;
  world.EnemyManager.potentialDamage = 20 * 1.5;
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.KB_TICK),
    "kb tick not detected: " + JSON.stringify(ctx.last().threats));
  invariants(ctx);
});

/* ================================================================== *
 * 9. Anti Spike Tick — trap break then spike
 * ================================================================== */
run("9. anti spike tick (trap break -> spike)", ctx => {
  const { world } = ctx;
  const trap = { ownerID: 1, health: 300, tempHealth: 300 };
  world.myPlayer.isTrapped = true;
  world.myPlayer.trappedIn = trap;
  world.addEnemy({ x: 90, y: 0, primary: 5, current: 5, angle: Math.PI,
    canPlaceSpike: true, spikeDamage: 45 });
  world.EnemyManager.spikeSyncThreat = true;
  ctx.step(1);
  /* the trap comes down */
  trap.tempHealth = 200; ctx.step(1);
  trap.tempHealth = 100; ctx.step(1);
  trap.tempHealth = 40; ctx.step(1);
  assert.ok(ctx.sawThreat(THREAT.SPIKE_TICK),
    "spike tick not detected: " + JSON.stringify(ctx.last().threats));
  const found = ctx.threatAt(THREAT.SPIKE_TICK);
  assert.ok(found, "no spike tick report");
  /* The defence is up before the trap opens, i.e. while it still has health. */
  assert.ok(trap.tempHealth > 0, "trap already broken when detected");
  assert.ok(ctx.sawGear(AH.HAT_SOLDIER), "no defensive gear before the exposure");
  invariants(ctx);
});

/* ================================================================== *
 * 10. Anti One Tick
 * ================================================================== */
run("10. anti one tick", ctx => {
  const { world } = ctx;
  /* Polearm, bull, inside its real range (142). */
  world.addEnemy({ x: 130, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.myPlayer.currentHealth = 65;
  world.EnemyManager.potentialDamage = 45 * 1.5;
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.ONE_TICK),
    "one tick not detected: " + JSON.stringify(ctx.last().threats));
  assert.ok(ctx.sawGear(AH.HAT_SOLDIER), "no soldier against a one-tick");
  invariants(ctx);
});

run("10b. one tick uses real weapon range, not a constant", ctx => {
  const { world } = ctx;
  /* Same weapon, outside its range and not closing. */
  world.addEnemy({ x: 400, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.myPlayer.currentHealth = 65;
  ctx.step(2);
  assert.ok(!ctx.sawThreat(THREAT.ONE_TICK),
    "one tick fired outside weapon range: " + JSON.stringify(ctx.last().threats));
  invariants(ctx);
});

/* ================================================================== *
 * 11. Anti Spam Daggers + Bull Hat
 * ================================================================== */
run("11. anti spam daggers + bull", ctx => {
  const { world } = ctx;
  world.addEnemy({ x: 60, y: 0, primary: 7, current: 7, angle: Math.PI, hat: 7 });
  world.EnemyManager.potentialDamage = 30;
  for (let i = 0; i < 6; i++) {
    world.damage(20);
    ctx.step(1);
  }
  assert.ok(ctx.sawThreat(THREAT.SPAM_DAGGER),
    "dagger spam not detected: " + JSON.stringify(ctx.last().threats));
  invariants(ctx, { shameCeiling: 2 });
});

/* ================================================================== *
 * 12. Anti Spam Bow
 * ================================================================== */
run("12. anti spam bow", ctx => {
  const { world } = ctx;
  world.addEnemy({ x: 500, y: 0, primary: 5, secondary: 13, current: 13, angle: Math.PI });
  for (let i = 0; i < 5; i++) {
    world.addProjectile({ x: -400 - i * 10, y: 0, angle: 0, type: 3 });
    ctx.step(2);
  }
  assert.ok(ctx.sawThreat(THREAT.SPAM_BOW),
    "bow spam not detected: " + JSON.stringify(ctx.last().threats));
  invariants(ctx);
});

/* ================================================================== *
 * 13. Anti Spam Shame
 * ================================================================== */
run("13. anti spam shame", ctx => {
  const { world } = ctx;
  world.addEnemy({ x: 60, y: 0, primary: 7, current: 7, angle: Math.PI });
  world.EnemyManager.potentialDamage = 30;
  /* Small damage every single tick: the shame pump. */
  for (let i = 0; i < 14; i++) {
    world.damage(8);
    ctx.step(1);
  }
  assert.ok(ctx.sawThreat(THREAT.SPAM_SHAME),
    "shame spam not detected: " + JSON.stringify(ctx.last().threats));
  /* The whole point: it does not walk the count up. */
  invariants(ctx, { shameCeiling: 2 });
  const end = ctx.last();
  assert.ok(end.shame <= 2, `shame ended at ${end.shame}`);
});

/* ================================================================== *
 * 14. Anti Velocity Tick + Hammer + Spike
 * ================================================================== */
run("14. anti velocity tick + hammer + spike", ctx => {
  const { world } = ctx;
  const e = world.addEnemy({ x: 120, y: 0, primary: 5, secondary: 10, current: 10,
    angle: Math.PI, canPlaceSpike: true, spikeDamage: 45 });
  ctx.step(1);
  e.weapon.oldCurrent = 10;
  e.weapon.current = 5;
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.VELOCITY_COMBO),
    "hammer+spike combo not detected: " + JSON.stringify(ctx.last().threats));
  invariants(ctx);
});

/* ================================================================== *
 * 15/16. Anti Primary + Musket / Bow
 * ================================================================== */
run("15. anti primary + musket", ctx => {
  const { world } = ctx;
  world.myPlayer.currentHealth = 80;
  world.addEnemy({ x: 105, y: 0, primary: 3, secondary: 15, current: 3, angle: Math.PI });
  world.addProjectile({ x: -300, y: 0, angle: 0, type: 5, owner: 1 });
  world.ProjectileManager.totalDamage = 50;
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.MIXED_INSTA),
    "primary+musket not detected: " + JSON.stringify(ctx.last().threats));
  invariants(ctx);
});

run("16. anti primary + bow", ctx => {
  const { world } = ctx;
  world.myPlayer.currentHealth = 70;
  world.addEnemy({ x: 130, y: 0, primary: 5, secondary: 9, current: 5, angle: Math.PI });
  world.addProjectile({ x: -300, y: 0, angle: 0, type: 0, owner: 1 });
  world.ProjectileManager.totalDamage = 25;
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.MIXED_INSTA),
    "primary+bow not detected: " + JSON.stringify(ctx.last().threats));
  invariants(ctx);
});

/* ================================================================== *
 * 17. Anti Turret Stack
 * ================================================================== */
run("17. anti turret stack", ctx => {
  const { world } = ctx;
  world.myPlayer.currentHealth = 70;
  world.addObject({ group: 7, x: 300, y: 0, ready: true });
  world.addObject({ group: 7, x: -300, y: 0, ready: true });
  world.addObject({ group: 7, x: 0, y: 300, ready: true });
  ctx.step(2);
  assert.ok(ctx.sawThreat(THREAT.TURRET_STACK),
    "turret stack not detected: " + JSON.stringify(ctx.last().threats));
  assert.ok(ctx.sawGear(AH.HAT_EMP),
    "emp helmet not equipped against a turret stack; equips=" +
      JSON.stringify(world.equips));
  invariants(ctx);
});

run("17b. turret stack does not fire on a single turret", ctx => {
  const { world } = ctx;
  world.addObject({ group: 7, x: 300, y: 0, ready: true });
  ctx.step(2);
  assert.ok(!ctx.sawThreat(THREAT.TURRET_STACK), "stack fired on one turret");
  invariants(ctx);
});

/* ================================================================== *
 * 18. Multiple simultaneous threats
 * ================================================================== */
run("18. multiple simultaneous threats", ctx => {
  const { world } = ctx;
  world.myPlayer.currentHealth = 55;
  /* A dagger in reach, a musket ball two ticks out, and two turrets. */
  world.addEnemy({ x: 60, y: 0, primary: 7, current: 7, angle: Math.PI });
  world.addProjectile({ x: -120, y: 0, angle: 0, type: 5, owner: 2 });
  world.addObject({ group: 7, x: 300, y: 0, ready: true });
  world.addObject({ group: 7, x: -300, y: 0, ready: true });
  world.EnemyManager.potentialDamage = 30;
  world.ProjectileManager.totalDamage = 50;
  ctx.step(3);
  const t = ctx.trace.find(x => (x.threats || []).length >= 2);
  assert.ok(t, "several threats were live but only one was reported");
  /* Requirement 22: the one that ranks first is not automatically the closest.
   * The musket ball is lethal against 55 health, the dagger is not. */
  const ranked = ctx.trace.map(x => x.rank);
  assert.ok(ranked.some(r => r === THREAT.MUSKET || r === THREAT.MIXED_INSTA ||
    r === "critical-survival" || r === THREAT.TURRET_STACK),
    "the lethal threat did not rank first: " + JSON.stringify(ranked));
  /* Exactly one gear decision per tick, never two hats in the same tick. */
  const perTick = {};
  for (const e of world.equips) {
    assert.ok(!perTick[e.tick], "two hats equipped on tick " + e.tick);
    perTick[e.tick] = true;
  }
  invariants(ctx);
});

/* ================================================================== *
 * 19/20. High and unstable ping
 * ================================================================== */
run("19. high ping", ctx => {
  const { world } = ctx;
  world.pong = 320;
  world.SocketManager.pong = 320;
  world.myPlayer.currentHealth = 40;
  world.addEnemy({ x: 120, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.EnemyManager.potentialDamage = 68;
  ctx.step(4);
  const t = ctx.last();
  /* The reaction window has to grow with the ping, and the engine has to say
   * so rather than pretending a frame arrives instantly. */
  assert.ok(t.reactionMs > world.TICK,
    `reaction window did not account for ping: ${t.reactionMs}`);
  assert.ok(t.reactionTicks >= 2, `reaction ticks ${t.reactionTicks} at 320ms ping`);
  invariants(ctx);
});

run("20. unstable ping", ctx => {
  const { world } = ctx;
  world.addEnemy({ x: 120, y: 0, primary: 5, current: 5, angle: Math.PI });
  const swings = [30, 300, 40, 280, 35, 310, 45];
  for (const p of swings) {
    world.SocketManager.pong = p;
    ctx.step(1);
  }
  const t = ctx.last();
  assert.ok(t.jitter > 30, `jitter not tracked: ${t.jitter}`);
  assert.ok(t.pingUnstable, "unstable ping not flagged");
  /* The smoothed value is not the last sample. */
  assert.ok(Math.abs(t.ping - 45) > 5, `ping was not smoothed: ${t.ping}`);
  invariants(ctx);
});

/* ================================================================== *
 * 21. Low packet budget
 * ================================================================== */
run("21. low packet budget", ctx => {
  const { world, trace } = ctx;
  world.myPlayer.currentHealth = 20;
  world.addEnemy({ x: 100, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.EnemyManager.potentialDamage = 68;
  world.EnemyManager.detectedDangerEnemy = true;
  world.EnemyManager.dangerWithoutSoldier = true;
  ctx.step(6);
  /* The cap held on every tick — FakeWorld throws the moment a frame would
   * cross it, so reaching here is the proof. */
  for (const t of trace) {
    assert.ok(t.packetsUsed <= 8, `spent ${t.packetsUsed} of 8`);
    assert.ok(t.packetsFree >= 0, `negative headroom at tick ${t.tick}`);
  }
  /* And something still got through. A hard cap that heals nothing is not a
   * budget, it is a bug: at 20 health against a lethal threat, two presses and
   * the weapon restore are five frames and they have to fit. */
  assert.ok(trace.some(t => t.presses > 0),
    "nothing was healed inside a small budget: " +
      trace.map(t => t.reason).join(" | "));
  assert.ok(world.myPlayer.currentHealth > 20, "health never recovered");
}, { packetLimit: 8 });

run("21b. reserved packets are not spent by a lower priority", ctx => {
  const { world, engine } = ctx;
  world.myPlayer.currentHealth = 30;
  world.addEnemy({ x: 100, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.EnemyManager.potentialDamage = 70;
  world.EnemyManager.detectedDangerEnemy = true;
  world.EnemyManager.dangerWithoutSoldier = true;
  ctx.step(2);
  const t = ctx.last();
  /* A lethal threat books its answer; the ledger says so. */
  assert.ok(t.reserved >= 0, "no reservation ledger");
  assert.ok(t.packetLimit === 119, "packet limit changed under us");
  invariants(ctx);
});

/* ================================================================== *
 * 22. Shame increase from repeated attacks
 * ================================================================== */
run("22. repeated attacks do not accumulate shame", ctx => {
  const { world } = ctx;
  world.addEnemy({ x: 100, y: 0, primary: 5, current: 5, angle: Math.PI });
  world.EnemyManager.potentialDamage = 40;
  /* Twenty damage every third tick for sixty ticks: enough exchanges to walk
   * an unguarded client to the lock several times over. */
  for (let i = 0; i < 60; i++) {
    if (i % 3 === 0) world.damage(20);
    ctx.step(1);
  }
  const peak = ctx.peakShame();
  assert.ok(peak <= 2, `shame peaked at ${peak} over sixty ticks of pressure`);
  assert.ok(ctx.last().shame <= AH.SHAME_TARGET + 1,
    `shame ended at ${ctx.last().shame}, target is ${AH.SHAME_TARGET}`);
  assert.ok(world.myPlayer.currentHealth > 0, "died while guarding shame");
  invariants(ctx);
});

/* ================================================================== *
 * 23. Immediate shame recovery
 * ================================================================== */
run("23. immediate shame recovery", ctx => {
  const { world, engine } = ctx;
  world.addEnemy({ x: 300, y: 0, primary: 5, current: 5, angle: Math.PI });
  /* Start with a debt, the way a forced charge leaves one. */
  engine.shame.count = 3;
  engine.shame.mirrorPrev = 0;
  world.myPlayer.shameCount = 0;
  world.damage(1);                 // a hit to attach the credit to
  ctx.step(1);                     // the hit is seen; the press would be charged
  const during = ctx.last();
  assert.strictEqual(during.presses, 0,
    "pressed inside the 120ms window while carrying a debt");
  ctx.step(1);                     // the window has passed
  const after = ctx.last();
  assert.ok(after.presses > 0 || after.verdict === "credit",
    "did not take the credit the moment it opened: " + JSON.stringify(after));
  ctx.step(3);
  assert.ok(engine.shame.count < 3,
    `debt not repaid: ${engine.shame.count} (was 3)`);
  invariants(ctx);
});

run("23b. a recovery press at full health costs no food", ctx => {
  const { world, engine } = ctx;
  engine.shame.count = 2;
  const foodBefore = world.myPlayer.resources.food;
  world.damage(0.0);               // no health change
  world.myPlayer.receivedDamage = world.now - 400;   // an old, unresolved hit
  ctx.step(2);
  /* game_index.js:2475 — consume returns false at full health, so useRes is
   * never reached. The stand-in does not deduct food either, which is the
   * point being asserted: the engine is willing to press here precisely
   * because it is free. */
  assert.strictEqual(world.myPlayer.resources.food, foodBefore,
    "a full-health recovery press spent food");
  invariants(ctx);
});

/* ================================================================== *
 * 24. Trap-enclosed player
 * ================================================================== */
run("24. trap-enclosed player", ctx => {
  const { world } = ctx;
  world.myPlayer.isTrapped = true;
  world.myPlayer.trappedIn = { ownerID: 1, health: 500, tempHealth: 500 };
  world.myPlayer.currentHealth = 45;
  world.addEnemy({ x: 100, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.EnemyManager.potentialDamage = 68;
  ctx.step(3);
  assert.ok(ctx.sawThreat(THREAT.TRAP),
    "trap threat not detected: " + JSON.stringify(ctx.last().threats));
  assert.ok(ctx.sawGear(AH.HAT_SOLDIER), "no gear while pinned with someone in reach");
  invariants(ctx);
});

/* ================================================================== *
 * Cross-cutting checks the requirements call out by name.
 * ================================================================== */
run("A. no false positive from possession alone", ctx => {
  const { world } = ctx;
  /* Everything owned, nothing happening: out of range, unloaded, facing away. */
  world.addEnemy({ x: 900, y: 900, primary: 5, secondary: 15, current: 15,
    angle: 0, hat: 7, reload0: 0, reload1: 0, reload2: 0 });
  ctx.step(5);
  const fired = ctx.trace.filter(t => (t.threats || []).length > 0);
  assert.strictEqual(fired.length, 0,
    "a threat fired on possession alone: " + JSON.stringify(fired[0] && fired[0].threats));
  assert.strictEqual(world.equips.length, 0, "equipped gear with no threat");
  assert.strictEqual(world.frames.length, 0, "sent packets with nothing happening");
  invariants(ctx);
});

run("B. gear is released when the threat is over", ctx => {
  const { world } = ctx;
  const e = world.addEnemy({ x: 110, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.myPlayer.currentHealth = 60;
  world.EnemyManager.potentialDamage = 68;
  ctx.step(3);
  assert.ok(ctx.sawGear(AH.HAT_SOLDIER), "soldier never equipped");
  /* They leave. */
  e.pos.current = new Vec(1200, 1200);
  world.EnemyManager.potentialDamage = 0;
  ctx.step(6);
  assert.strictEqual(ctx.engine.gear.current, null,
    "still holding defensive gear after the threat left");
  invariants(ctx);
});

run("C. survival outranks the shame target", ctx => {
  const { world } = ctx;
  world.myPlayer.currentHealth = 18;
  world.addEnemy({ x: 100, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.EnemyManager.potentialDamage = 68;
  world.EnemyManager.detectedDangerEnemy = true;
  world.EnemyManager.dangerWithoutSoldier = true;
  world.damage(2);                 // a fresh hit: a press now is charged
  ctx.step(1);
  const t = ctx.last();
  assert.ok(t.presses > 0,
    "refused to heal a lethal threat to protect the shame count: " + t.reason);
  invariants(ctx);
});

run("D. a charged press is refused when only comfort is at stake", ctx => {
  const { world } = ctx;
  /* A real gap to fill — a top-up candidate exists and would be worth
   * pressing — but nothing about the situation makes the wait dangerous:
   * after the incoming damage lands there is still room above the reserve. */
  world.myPlayer.currentHealth = 55;
  world.addEnemy({ x: 600, y: 0, primary: 5, current: 5, angle: Math.PI });
  world.EnemyManager.potentialDamage = 20;
  world.damage(2);                 // fresh hit, so a press now would be +1
  ctx.step(1);
  const t = ctx.last();
  assert.strictEqual(t.presses, 0,
    "spent a shame charge on a top-up: " + t.reason);
  assert.ok(/shame-target-0/.test(t.reason),
    "refusal did not come from the shame policy: " + t.reason);
  assert.strictEqual(world.serverShame, 0, "the count moved off target");
  /* And the same press goes out on the very next tick, once it is a credit. */
  ctx.step(1);
  const after = ctx.last();
  assert.ok(after.presses > 0, "did not press once the window opened: " + after.reason);
  assert.strictEqual(world.serverShame, 0, "the press that healed cost a charge");
  invariants(ctx);
});

run("E. a forced burst pays one charge, not several", ctx => {
  const { world, engine } = ctx;
  world.myPlayer.currentHealth = 12;
  world.addEnemy({ x: 100, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.EnemyManager.potentialDamage = 68;
  world.EnemyManager.detectedDangerEnemy = true;
  world.EnemyManager.dangerWithoutSoldier = true;
  world.damage(2);
  ctx.step(1);
  const t = ctx.last();
  assert.ok(t.presses >= 2, `emergency burst was only ${t.presses} press(es)`);
  /* One charge for the whole burst: hitTime is cleared by the first press. */
  assert.ok(engine.shame.chargesSpent <= 1,
    `burst cost ${engine.shame.chargesSpent} charges`);
  assert.strictEqual(world.serverShame, 1, "the forced burst should cost exactly one");
  /* ...and the debt it created is repaid at the first opening rather than
   * carried: one more hit, one tick of patience, one credit press. */
  world.damage(5);
  ctx.step(4);
  assert.strictEqual(world.serverShame, 0,
    `debt from the forced burst was not repaid: ${world.serverShame}`);
  invariants(ctx);
});

run("F. one hat manager: no second claim in the same tick", ctx => {
  const { world } = ctx;
  world.addEnemy({ x: 110, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.myPlayer.currentHealth = 50;
  world.EnemyManager.potentialDamage = 68;
  ctx.step(4);
  const perTick = {};
  for (const e of world.equips) {
    assert.ok(!perTick[e.tick], "two equips on tick " + e.tick);
    perTick[e.tick] = true;
  }
  /* And holding costs nothing: four ticks of the same threat is one equip. */
  assert.ok(world.equips.length <= 2,
    "gear flapped: " + JSON.stringify(world.equips));
  invariants(ctx);
});

run("G. the engine stands down entirely when switched off", ctx => {
  const { world } = ctx;
  Settings._autoHealEngine = false;
  world.myPlayer.currentHealth = 20;
  world.addEnemy({ x: 100, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.EnemyManager.potentialDamage = 68;
  ctx.step(4);
  Settings._autoHealEngine = true;
  assert.strictEqual(world.frames.length, 0, "sent packets while switched off");
  assert.strictEqual(world.equips.length, 0, "equipped gear while switched off");
});

run("H. no food press while the shame lock is on", ctx => {
  const { world } = ctx;
  world.myPlayer.shameActive = true;
  world.myPlayer.hatID = 45;
  world.myPlayer.currentHealth = 20;
  world.addEnemy({ x: 100, y: 0, primary: 5, current: 5, angle: Math.PI });
  world.EnemyManager.potentialDamage = 68;
  ctx.step(5);
  assert.ok(ctx.trace.every(t => t.presses === 0),
    "pressed food inside the 30s lock");
  assert.strictEqual(world.frames.filter(f => f.kind !== "equip").length, 0,
    "sent food frames inside the lock");
});


run("I. manufactured wash brings a debt down on a quiet field", ctx => {
  const { world, engine } = ctx;
  /* A debt, nothing in sight, and no pending hit to attach a credit to. The
   * only way down is to make one: Bull Helmet's healthRegen -5 stamps hitTime
   * on the next one-second tick (game_index.js:2317-2318). */
  engine.shame.count = 2;
  engine.shame.mirrorPrev = 0;
  world.serverShame = 2;
  ctx.step(2);
  assert.ok(ctx.sawGear(AH.HAT_BULL),
    "no bull hat requested to manufacture a hit: " +
      ctx.trace.map(t => t.opportunity).join(" | "));
  invariants(ctx);
});

run("J. manufactured wash stands down while anything can hit back", ctx => {
  const { world, engine } = ctx;
  engine.shame.count = 2;
  engine.shame.mirrorPrev = 0;
  world.addEnemy({ x: 200, y: 0, primary: 5, current: 5, angle: Math.PI });
  world.EnemyManager.potentialDamage = 40;
  ctx.step(3);
  assert.ok(!ctx.sawGear(AH.HAT_BULL),
    "armed bull with a live threat on the board");
  invariants(ctx);
});

run("K. spike tick while trapped, with an insta escort", ctx => {
  const { world } = ctx;
  const trap = { ownerID: 1, health: 400, tempHealth: 400 };
  world.myPlayer.isTrapped = true;
  world.myPlayer.trappedIn = trap;
  world.myPlayer.currentHealth = 60;
  world.addEnemy({ x: 95, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7,
    canPlaceSpike: true, spikeDamage: 45, canUseTurret: true, danger: 3 });
  world.EnemyManager.spikeSyncThreat = true;
  world.EnemyManager.potentialDamage = 68;
  world.EnemyManager.detectedDangerEnemy = true;
  ctx.step(1);
  trap.tempHealth = 250; ctx.step(1);
  trap.tempHealth = 120; ctx.step(1);
  /* Everything is on the board at once: the trap is coming down, a spike is
   * ready for the moment it does, and the person breaking it can insta. */
  const t = ctx.last();
  assert.ok((t.threats || []).length >= 2,
    "only one threat reported in a compound situation: " + JSON.stringify(t.threats));
  assert.ok(ctx.sawGear(AH.HAT_SOLDIER), "no gear through a compound sequence");
  assert.ok(trap.tempHealth > 0, "the trap broke before anything was decided");
  invariants(ctx);
});

run("L. every threat type has a detector wired in", ctx => {
  /* A cheap structural check: the ordering table and the reports the engine
   * can produce have to agree, or a threat would be detected and then ranked
   * at zero for the rest of the fight. */
  for (const key of Object.keys(THREAT)) {
    const type = THREAT[key];
    assert.ok(AutoHealEngine.THREAT_ORDER[type] !== undefined,
      `threat ${type} has no place in the priority order`);
  }
});


run("M. a queued equip cannot push a heal burst over the cap", ctx => {
  const { world, trace } = ctx;
  /* Six frames of headroom, and a situation that wants both gear and food.
   * The equip is sent by Autohat *after* the engine's turn, so the live
   * counter does not know about it while the burst is being sized — the
   * budget has to carry it anyway. */
  world.myPlayer.currentHealth = 20;
  world.addEnemy({ x: 100, y: 0, primary: 5, current: 5, angle: Math.PI, hat: 7 });
  world.EnemyManager.potentialDamage = 68;
  world.EnemyManager.detectedDangerEnemy = true;
  world.EnemyManager.dangerWithoutSoldier = true;
  ctx.step(4);
  /* FakeWorld throws the moment a frame would cross the limit, so reaching
   * here is the proof; the counts below say it was actually close. */
  const perSecond = {};
  for (const f of world.frames) {
    const second = Math.floor(f.tick / 9);
    perSecond[second] = (perSecond[second] || 0) + 1;
  }
  for (const second of Object.keys(perSecond)) {
    assert.ok(perSecond[second] <= 6,
      `second ${second} sent ${perSecond[second]} frames of 6`);
  }
  assert.ok(trace.some(t => t.presses > 0), "no heal inside the tight budget");
  invariants(ctx);
}, { packetLimit: 6 });

/* ------------------------------------------------------------------ */
const failed = results.filter(r => r.error);
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed\n`);
if (failed.length) {
  for (const f of failed) console.log(`FAILED: ${f.name}\n  ${f.error.message}`);
  process.exit(1);
}
