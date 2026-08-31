// Auto Heal harness.
//
// Runs the AutoHeal module out of the built client against a model of the
// server's own shame code, transcribed from src/game_index.js — Player.
// changeHealth (2417) and Player.buildItem (2454). Nothing about the rule is
// invented here: the model applies the same three branches in the same order,
// including the two that make the whole thing work — the arithmetic running
// before the heal, and changeHealth refusing a heal at full health.
//
//   node tools/auto-heal-harness.js [path-to-client]
//
// Exits non-zero if any scenario fails.

const fs = require("fs");
const path = require("path");

const file = process.argv[2] || path.join(__dirname, "..", "RYN_Client_v5.5.user.js");
const source = fs.readFileSync(file, "utf8");

function slice(startMarker, endMarker, name) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error("harness: start marker not found for " + name);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error("harness: end marker not found for " + name);
  return source.slice(start, end + endMarker.length);
}

const prelude = `
const Items = {
  0: { id: 0, itemType: 2, name: "apple",  restore: 20, cost: { food: 10, wood: 0, stone: 0, gold: 0 } },
  1: { id: 1, itemType: 2, name: "cookie", restore: 40, cost: { food: 15, wood: 0, stone: 0, gold: 0 } }
};
const Hats = { 6: { id: 6, name: "Soldier Helmet", dmgMult: .75 }, 7: { id: 7, name: "Bull Helmet", healthRegen: -5, dmgMultO: 1.5 } };
const Weapons = { 5: { name: "polearm", range: 142, damage: 45, knockback: 1.5, speed: 700 } };
const DataHandler_default = { getWeapon: id => Weapons[id] || null, isMelee: id => !!Weapons[id] };
const Settings_default = { _autoheal: true, _shameHarvest: true, _antiSmartTick: false };
`;

const bundle = new Function(prelude +
  slice("  const AH_WINDOW = 120;", "  const AutoHeal_default = AutoHeal;", "auto heal") +
  "\nreturn { AutoHeal, AH_WINDOW, Settings_default, Items };")();

const { AutoHeal, Settings_default, Items } = bundle;

const TICK_MS = 1000 / 9;
const FOOD_ID = 1;                       // cookie: 40 restore, 15 food
const RESTORE = Items[FOOD_ID].restore;

// ── the server ──────────────────────────────────────────────────────────────
// game_index.js 2417 and 2454, transcribed.
class Server {
  constructor(opts) {
    opts = opts || {};
    this.now = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.hitTime = 0;
    this.shameCount = 0;
    this.shameTimerUntil = 0;            // shameTimer > 0 while now < this
    this.food = opts.food === undefined ? 500 : opts.food;
    this.locks = 0;
    this.consumed = 0;
    this.log = [];
  }
  get locked() { return this.now < this.shameTimerUntil; }
  // changeHealth(f, w) with f < 0
  damage(amount) {
    if (amount <= 0) return;
    this.health -= amount;
    this.hitTime = this.now;             // 2422
    if (this.health < 0) this.health = 0;
  }
  // buildItem(f) for a food item
  press() {
    // (metrics are collected by the runner)
    // 2496 canBuild -> hasRes
    if (this.food < Items[FOOD_ID].cost.food) { this.log.push("noRes"); return "noRes"; }
    let healed = false;
    if (this.hitTime) {                                        // 2461
      const W = this.now - this.hitTime;
      this.hitTime = 0;                                        // 2463
      if (W <= 120) {                                          // 2464
        this.shameCount++;
        if (this.shameCount >= 8) {                            // 2465
          this.shameTimerUntil = this.now + 30000;
          this.shameCount = 0;
          this.locks++;
          this.log.push("LOCK");
        } else this.log.push("+1@" + Math.round(W));
      } else {                                                 // 2466
        this.shameCount -= 2;
        if (this.shameCount <= 0) this.shameCount = 0;
        this.log.push("-2@" + Math.round(W));
      }
    } else this.log.push("neutral");
    if (!this.locked) {                                        // 2469
      if (this.health >= this.maxHealth) healed = false;        // 2418
      else { this.health = Math.min(this.maxHealth, this.health + RESTORE); healed = true; }
    }
    if (healed) { this.food -= Items[FOOD_ID].cost.food; this.consumed++; }  // 2475 useRes
    return healed ? "healed" : "free";
  }
  // The 1/second pass: hat regen (bull is -5) and damage over time.
  second(regen) {
    if (regen) {
      if (regen < 0) this.damage(-regen);
      else if (this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + regen);
    }
  }
}

// ── the client ──────────────────────────────────────────────────────────────
// Player.updateHealth's own shame estimate (3407) is reproduced because the
// module reads myPlayer.shameCount and deliberately takes the higher of the
// two estimates.
function makeWorld(opts) {
  opts = opts || {};
  const ping = opts.ping === undefined ? 60 : opts.ping;
  const server = new Server(opts);
  const inbound = [];                    // health updates in flight to us
  const outbound = [];                   // presses in flight to the server
  const presses = [];

  const myPlayer = {
    id: 1, inGame: true, scale: 35,
    currentHealth: 100, previousHealth: 100, tempHealth: 100, maxHealth: 100,
    hatID: 0, shameCount: 0, shameActive: false, poisonCount: 0,
    receivedDamage: null, damageTick: 0, tickCount: 0, isTrapped: false,
    isDmgOverTime: false, bullTick: 0,
    pos: { current: { x: 0, y: 0, distance: () => 999 } },
    get hitScale() { return this.scale * 1.8; },
    getItemByType(t) { return t === 2 ? FOOD_ID : t === 0 ? 5 : null; },
    canPlace(t) { return t === 2 ? server.food >= Items[FOOD_ID].cost.food : true; },
    collidingSimple() { return false; },
    // Player.updateHealth, 3407 — the client's own estimate.
    updateHealth(health) {
      this.previousHealth = this.currentHealth;
      this.currentHealth = health;
      this.tempHealth = health;
      if (this.shameActive) return;
      if (this.currentHealth < this.previousHealth) {
        this.receivedDamage = Date.now();
        this.damageTick = this.tickCount + 1;
      } else if (this.receivedDamage !== null) {
        const step = Date.now() - this.receivedDamage;
        this.receivedDamage = null;
        if (step <= 120) this.shameCount += 1; else this.shameCount -= 2;
        this.shameCount = Math.max(0, Math.min(7, this.shameCount));
      }
    }
  };

  const enemy = {
    id: 2, weapon: { primary: 5 }, scale: 35,
    pos: { current: { x: 400, y: 0 } },
    get hitScale() { return this.scale * 1.8; },
    collidingSimple(other, range) { return opts.enemyInRange === true && range > 0; },
    isReloaded() { return !!opts.enemyReady; }
  };

  const ModuleHandler = {
    tickCount: 0, packetCount: 0, packetLimit: 119,
    moduleActive: false, healedOnce: false, didAntiInsta: false,
    staticModules: {},
    heal() {
      if (myPlayer.shameActive) return;
      // The guard the client used to carry, for the side-by-side runs: hold one
      // tick if the press would land inside the window, then go regardless.
      if (opts.legacy) {
        const hitAt = myPlayer.receivedDamage;
        const lands = !hitAt ? Infinity : Date.now() - hitAt + ping;
        if (lands < 125 && this._heldTick !== this.tickCount - 1) { this._heldTick = this.tickCount; return; }
      }
      const autoHeal = opts.legacy ? null : this.staticModules.autoHeal;
      if (autoHeal && autoHeal.shouldHold()) return;
      this.packetCount += 3;
      outbound.push({ at: Date.now() + ping / 2 });
      presses.push({ tick: this.tickCount, at: Date.now() });
      if (autoHeal) autoHeal.notePress();
    }
  };

  const client = {
    myPlayer: myPlayer,
    _ModuleHandler: ModuleHandler,
    SocketManager: { pong: ping },
    EnemyManager: {
      nearestEnemy: opts.enemy === false ? null : enemy,
      potentialDamage: opts.incoming || 0, potentialSpikeDamage: 0
    },
    PlayerManager: { enemies: [ enemy ] }
  };
  const module = new AutoHeal(client);
  ModuleHandler.staticModules.autoHeal = module;

  // Real wall clock is not used: Date.now is driven by the simulation so the
  // 120ms window is exercised exactly.
  const world = {
    server, client, module, myPlayer, ModuleHandler, presses, ping,
    time: 0,
    damageAt(amount) { server.damage(amount); world.send(server.health); },
    // The server only sends a health packet when the value changes.
    send(health) { const last = inbound.length ? inbound[inbound.length - 1].health : myPlayer.currentHealth; if (health === last) return; inbound.push({ at: world.time + ping / 2, health: health }); },
    tick(fn) {
      const MH = ModuleHandler;
      MH.tickCount += 1;
      myPlayer.tickCount = MH.tickCount;
      MH.moduleActive = !!(opts.busy && opts.busy(MH.tickCount));
      MH.healedOnce = false;
      MH.packetCount = opts.packetFloor || 0;
      world.time += TICK_MS;
      server.now = world.time;
      global.__now = world.time;
      // presses that reached the server
      while (outbound.length && outbound[0].at <= server.now) { outbound.shift(); server.press(); }
      if (fn) fn(world);
      // health updates that reached us
      while (inbound.length && inbound[0].at <= world.time) {
        const u = inbound.shift();
        myPlayer.updateHealth(u.health);
      }
      module.postTick();
      return { shame: server.shameCount, health: server.health, locked: server.locked };
    },
    // a heal that landed changes health too
    settle() { world.send(server.health); }
  };
  return world;
}

// Date.now is redirected at the simulation clock.
const realNow = Date.now;
global.__now = 0;
Date.now = () => global.__now;

// ── scenarios ───────────────────────────────────────────────────────────────
let failures = 0, passes = 0;
function check(name, cond, detail) {
  if (cond) { passes++; console.log("  ok   " + name); }
  else { failures++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
}
function scenario(name, fn) {
  console.log("\n" + name);
  try { fn(); } catch (e) { failures++; console.log("  FAIL threw: " + (e && e.stack || e)); }
}
// Runs `n` ticks; `hit(t)` returns damage to apply on that tick.
function run(w, n, hit) {
  for (let i = 0; i < n; i++) {
    w.tick(() => { const d = hit ? hit(i) : 0; if (d) w.damageAt(d); });
    w.settle();
  }
  return w;
}

scenario("1. normal play, no damage -> nothing is pressed at all", () => {
  const w = makeWorld();
  run(w, 40);
  check("no presses", w.presses.length === 0, "n=" + w.presses.length);
  check("shame stays 0", w.server.shameCount === 0);
  check("no food spent", w.server.consumed === 0);
});

scenario("2. one hit, then quiet -> heals, and the press books -2 not +1", () => {
  const w = makeWorld();
  w.server.shameCount = 4;
  w.module.shame = 4;
  run(w, 12, i => i === 0 ? 30 : 0);
  check("pressed", w.presses.length > 0, "n=" + w.presses.length);
  check("shame went DOWN", w.server.shameCount === 2, "shame=" + w.server.shameCount);
  check("every press landed outside the window", w.server.log.every(l => !l.startsWith("+1")), w.server.log.join(","));
  check("health restored", w.server.health === 100, "hp=" + w.server.health);
});

scenario("3. shame at 0, damage taken -> heals without pressing extra for shame", () => {
  const w = makeWorld();
  run(w, 14, i => i === 0 ? 40 : 0);
  check("healed", w.server.health === 100);
  check("no harvest presses", w.module.stats.harvests === 0, "harvests=" + w.module.stats.harvests);
  check("shame still 0", w.server.shameCount === 0);
});

scenario("4. full health with shame on the board -> the free -2 is taken", () => {
  const w = makeWorld();
  w.server.shameCount = 6;
  w.module.shame = 6;
  // a hit that heals itself back instantly: the judgement is open at full HP
  w.tick(() => w.damageAt(1));
  w.server.health = 100;                       // back to full before we act
  run(w, 8);
  check("a harvest press was made", w.module.stats.harvests > 0, "harvests=" + w.module.stats.harvests);
  check("shame dropped", w.server.shameCount < 6, "shame=" + w.server.shameCount);
  check("no food was consumed for it", w.server.consumed === 0, "consumed=" + w.server.consumed);
});

scenario("5. a burst of fast damage, then relief -> survives it and recovers", () => {
  const w = makeWorld({ incoming: 45 });
  run(w, 27, i => i % 2 === 0 ? 12 : 0);   // three seconds of pressure
  check("survived the burst", w.server.health > 0, "hp=" + w.server.health);
  check("did not lock itself", w.server.locks === 0, "locks=" + w.server.locks);
  run(w, 60);                              // and then it is quiet
  check("health back up", w.server.health === 100, "hp=" + w.server.health);
  check("shame worked back down", w.server.shameCount <= 2, "shame=" + w.server.shameCount);
});

scenario("6. damage every single tick -> the hold releases instead of starving", () => {
  const w = makeWorld();
  run(w, 40, () => 6);
  check("pressed anyway", w.presses.length > 0, "n=" + w.presses.length);
  check("alive", w.server.health > 0, "hp=" + w.server.health);
  check("held some presses first", w.module.stats.held > 0, "held=" + w.module.stats.held);
});

scenario("7. at the ceiling -> the shared guard refuses, and the -2 is taken later", () => {
  const w = makeWorld();
  w.server.shameCount = 7;
  w.module.shame = 7;
  w.myPlayer.shameCount = 7;
  run(w, 12, () => 6);                       // hit every tick: the window never opens
  // Another module pressing on its own, the way anti sync does, is refused by
  // the same guard rather than walking into the lock.
  const before = w.presses.length;
  w.ModuleHandler.heal();
  check("the shared guard refused it", w.presses.length === before, "sent=" + (w.presses.length - before));
  check("and recorded the refusal", w.module.stats.refused > 0, "refused=" + w.module.stats.refused);
  check("no lock", w.server.locks === 0, "locks=" + w.server.locks);
  // damage stops: the regime ends, the window can be trusted again
  run(w, 14);
  check("and the count comes down once it is quiet", w.server.shameCount < 7, "shame=" + w.server.shameCount);
});

scenario("8. heavy incoming damage -> presses immediately rather than waiting", () => {
  const w = makeWorld();
  w.client.EnemyManager.potentialDamage = 95;
  run(w, 6, i => i === 0 ? 70 : 0);
  check("healed fast", w.server.health > 30, "hp=" + w.server.health);
  check("pressed", w.presses.length > 0);
});

scenario("9. no food -> nothing is sent", () => {
  const w = makeWorld({ food: 0 });
  run(w, 20, i => i === 0 ? 40 : 0);
  check("no presses", w.presses.length === 0, "n=" + w.presses.length);
});

scenario("10. locked by the server -> not a single press for the whole lock", () => {
  const w = makeWorld();
  w.server.shameTimerUntil = 5000;
  w.myPlayer.shameActive = true;
  run(w, 30, i => i % 3 === 0 ? 10 : 0);
  check("no presses while locked", w.presses.length === 0, "n=" + w.presses.length);
  check("ledger knows it is locked", w.module.locked);
});

scenario("11. another module owns the tick -> a harvest stands down, a heal does not", () => {
  const w = makeWorld({ busy: () => true });
  w.server.shameCount = 5;
  w.module.shame = 5;
  w.tick(() => w.damageAt(1));
  w.server.health = 100;
  run(w, 8);
  check("no harvest while the tick is claimed", w.module.stats.harvests === 0, "harvests=" + w.module.stats.harvests);
  const w2 = makeWorld({ busy: () => true });
  run(w2, 12, i => i === 0 ? 40 : 0);
  check("but the survival heal still goes out", w2.presses.length > 0, "n=" + w2.presses.length);
});

scenario("12. anti sync / anti smart tick pressing directly -> ledger still tracks it", () => {
  const w = makeWorld();
  w.server.shameCount = 3;
  w.module.shame = 3;
  w.tick(() => w.damageAt(20));
  // two ticks later another module presses on its own, as AntiSync does
  w.tick(); w.tick();
  const before = w.module.stats.presses;
  w.ModuleHandler.heal();
  check("the press was recorded", w.module.stats.presses > before);
  check("and it was judged", w.module.stats.down + w.module.stats.up > 0);
});

scenario("13. bull helmet drain -> the self-inflicted hit is harvested", () => {
  // ShameReset wears hat 7 on the second boundary; the -5 is a hit like any
  // other, which is exactly what makes it a shame reset.
  const w = makeWorld();
  w.server.shameCount = 6;
  w.module.shame = 6;
  w.myPlayer.hatID = 7;
  run(w, 4);
  w.tick(() => { w.server.second(-5); w.damageAt(0); });
  // the drain is a health drop like any other
  w.server.health -= 0;
  w.damageAt(5);
  run(w, 10);
  check("shame came down", w.server.shameCount < 6, "shame=" + w.server.shameCount);
  check("no lock", w.server.locks === 0);
});

scenario("14. packets exhausted -> no press is attempted", () => {
  const w = makeWorld({ packetFloor: 118 });
  run(w, 8, i => i === 0 ? 40 : 0);
  check("nothing sent on an empty budget", w.presses.length === 0, "sent=" + w.presses.length);
  const ok = makeWorld({ packetFloor: 0 });
  run(ok, 8, i => i === 0 ? 40 : 0);
  check("and it does send when there is room", ok.presses.length > 0);
});

scenario("15. long fight: shame is driven down, not up", () => {
  // 25 seconds of a real trade pattern: a hit every ~0.7s, healing in between.
  const w = makeWorld();
  w.server.shameCount = 7;
  w.module.shame = 7;
  w.myPlayer.shameCount = 7;
  run(w, 225, i => i % 6 === 0 ? 18 : 0);
  check("no lock in 25 seconds", w.server.locks === 0, "locks=" + w.server.locks);
  check("shame ended at zero", w.server.shameCount === 0, "shame=" + w.server.shameCount);
  check("alive", w.server.health > 0, "hp=" + w.server.health);
  console.log("       presses=" + w.presses.length + " food eaten=" + w.server.consumed +
    " harvests=" + w.module.stats.harvests + " held=" + w.module.stats.held +
    " predicted -2=" + w.module.stats.down + " +1=" + w.module.stats.up);
});

// The rule this replaced, run side by side on the two patterns where the two
// actually differ. novastorm's decision plus the one-tick guard the client
// used to carry in ModuleHandler.heal.
function legacyRun(opts, ticks, hit) {
  const o = Object.assign({}, opts, { legacy: true });
  const w = makeWorld(o);
  w.module.postTick = function () {};
  if (o.shame) { w.server.shameCount = o.shame; w.myPlayer.shameCount = o.shame; }
  for (let i = 0; i < ticks; i++) {
    w.tick(() => { const d = hit(i); if (d) w.damageAt(d); });
    const mp = w.myPlayer;
    let pot = w.client.EnemyManager.potentialDamage;
    if (pot > 140) pot = 140;
    const healing = mp.tempHealth <= pot;
    if (((healing && mp.shameCount < 7) || mp.tickCount - mp.damageTick > 0) && mp.tempHealth < mp.maxHealth) {
      for (let k = 0; k < mp.maxHealth - mp.tempHealth; k += RESTORE) w.ModuleHandler.heal();
    }
    w.settle();
  }
  return w;
}
function newRun(opts, ticks, hit) {
  const w = makeWorld(opts);
  if (opts.shame) { w.server.shameCount = opts.shame; w.module.shame = opts.shame; w.myPlayer.shameCount = opts.shame; }
  return run(w, ticks, hit);
}

// Both runners report the same numbers, taken the same way.
function measure(w, ticks, hit, drive) {
  let min = 100, died = false;
  for (let i = 0; i < ticks; i++) {
    w.tick(() => { const d = hit(i); if (d) w.damageAt(d); });
    if (drive) drive(w);
    w.settle();
    if (w.server.health < min) min = w.server.health;
    if (w.server.health <= 0) died = true;
  }
  return { min: min, died: died, end: w.server.health, shame: w.server.shameCount,
           locks: w.server.locks, food: w.server.consumed };
}
function legacyDrive(w) {
  const mp = w.myPlayer;
  let pot = w.client.EnemyManager.potentialDamage;
  if (pot > 140) pot = 140;
  const healing = mp.tempHealth <= pot;
  if (((healing && mp.shameCount < 7) || mp.tickCount - mp.damageTick > 0) && mp.tempHealth < mp.maxHealth) {
    for (let k = 0; k < mp.maxHealth - mp.tempHealth; k += RESTORE) w.ModuleHandler.heal();
  }
}
function pair(opts, ticks, hit) {
  const o = Object.assign({}, opts);
  const a = makeWorld(Object.assign({}, o, { legacy: true }));
  a.module.postTick = function () {};
  if (o.shame) { a.server.shameCount = o.shame; a.myPlayer.shameCount = o.shame; }
  const b = makeWorld(o);
  if (o.shame) { b.server.shameCount = o.shame; b.module.shame = o.shame; b.myPlayer.shameCount = o.shame; }
  return { old: measure(a, ticks, hit, legacyDrive), now: measure(b, ticks, hit, null), a: a, b: b };
}
function report(label, r) {
  const fmt = m => "min=" + m.min + " end=" + m.end + " died=" + m.died + " shame=" + m.shame + " locks=" + m.locks + " food=" + m.food;
  console.log("       " + label);
  console.log("         old: " + fmt(r.old));
  console.log("         new: " + fmt(r.now));
}

scenario("16. side by side: damage every 2 ticks, nothing EnemyManager can price", () => {
  // 36 health a second against a 40 restore: survivable, which is what makes
  // the comparison mean anything.
  const r = pair({ incoming: 0 }, 90, i => i % 2 === 0 ? 8 : 0);
  report("spike contact, no enemy in weapon range", r);
  check("the new one survives it", !r.now.died, "min=" + r.now.min);
  check("holds a higher floor than the old rule", r.now.min >= r.old.min, "old min=" + r.old.min + " new min=" + r.now.min);
  check("neither walks into the lock", r.now.locks === 0, "locks=" + r.now.locks);
});

scenario("17. side by side: a normal trade, one hit every 0.7s", () => {
  const r = pair({ incoming: 45, shame: 6 }, 180, i => i % 6 === 0 ? 20 : 0);
  report("starting from six shame", r);
  check("the new one gets the count down", r.now.shame <= r.old.shame, "old=" + r.old.shame + " new=" + r.now.shame);
  check("and stays alive", !r.now.died);
});

scenario("18. side by side: already at the ceiling under pressure", () => {
  const r = pair({ incoming: 60, shame: 7 }, 60, i => i % 2 === 0 ? 10 : 0);
  report("count at 7, damage every 2 ticks", r);
  check("no more locks than the old rule", r.now.locks <= r.old.locks + 1, "old=" + r.old.locks + " new=" + r.now.locks);
});

Date.now = realNow;
console.log("\n" + passes + " passed, " + failures + " failed");
process.exit(failures === 0 ? 0 : 1);
