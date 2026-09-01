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
    scale: 35,
    pos: { current: { x: 0, y: 0, distance: () => Infinity } },
    getItemByType(t) { return this.inventory[t]; }
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
    EnemyManager: {
      potentialDamage: 0,
      potentialSpikeDamage: 0,
      potentialSpikeKnockbackDamage: 0,
      primaryDamage: 0,
      detectedDangerEnemy: false,
      dangerWithoutSoldier: false,
      collidingSpike: false,
      willCollideSpike: false,
      nearestEnemy: null,
      instaThreat() { return false; }
    },
    ProjectileManager: { totalDamage: 0 }
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
    this.stats = {
      presses: 0, healedPresses: 0, refused: 0, ticksAtZeroShame: 0,
      maxServerShame: 0, deaths: 0, foodSpent: 0, packetPeak: 0,
      pressesWhileLocked: 0
    };
  }

  queuePress() {
    this.queued += 1;
  }

  /* One server tick + one client tick. */
  step(damage, threat) {
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

    this.queued = 0;
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
    this.log.push({
      tick: this.tick,
      hp: Math.round(server.health),
      shame: server.shameCount,
      mirror: mp.shameCount,
      locked: server.shameTimer > 0,
      urgency: this.engine.telemetry.urgency,
      reason: this.engine.telemetry.reason,
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
    /* And the engine has to actually work. */
    if (!sim.allowDeaths && name.indexOf("no food") === -1) {
      checks.push(["survived", s.deaths === 0]);
    }
    checks.push(["no press storm", s.presses <= ticks * 2]);

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
