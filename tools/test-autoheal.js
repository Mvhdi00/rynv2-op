#!/usr/bin/env node
/*
 * test-autoheal.js — the Auto Heal Engine's defensive layers, one Anti at a
 * time, then together.
 *
 * Every case drives the shipped engine (sliced out of Ryn Type 2.user.js by
 * tools/extract-autoheal.js) against the harness client, and asserts on what
 * the engine concluded rather than on what it did to a socket: the threat
 * reports, the gear session, the packet counts, the decision.
 *
 *     node tools/test-autoheal.js            # run everything
 *     node tools/test-autoheal.js musket     # run cases matching a substring
 */

const H = require("./autoheal-harness.js");
const { load } = require("./extract-autoheal.js");

const AutoHealEngine = load()(H.deps);
const { AH, CONFIDENCE, THREAT, DECISION, RangeModel, burstPackets, pressesForPackets } =
  AutoHealEngine;

/* ---- a very small test runner ---------------------------------------- */
let passed = 0;
const failures = [];
const filter = process.argv[2];

function test(name, fn) {
  if (filter && name.indexOf(filter) === -1) return;
  try {
    fn();
    passed += 1;
    console.log("  ok   " + name);
  } catch (e) {
    failures.push({ name, error: e });
    console.log("  FAIL " + name + "\n         " + e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}
function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "expected"}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
}
function near(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${msg || "expected"}: got ${actual}, want ${expected} +/- ${tol}`);
  }
}
function section(name) { console.log("\n" + name); }

/* Run one tick against a fresh engine and hand back both. */
function run(opts) {
  const client = H.makeClient(opts);
  const engine = new AutoHealEngine(client);
  engine.postTick();
  return { client, engine, t: engine.telemetry };
}

/* Drive an engine across several ticks, mutating the client between them. */
function ticks(opts, count, between) {
  const client = H.makeClient(opts);
  const engine = new AutoHealEngine(client);
  const trace = [];
  for (let i = 0; i < count; i++) {
    if (between) between(i, client, engine);
    engine.postTick();
    trace.push(Object.assign({}, engine.telemetry));
    client.myPlayer.tickCount += 1;
  }
  return { client, engine, trace };
}

function report(engine, type) {
  return engine.threat.byType[type] || null;
}

/* ====================================================================== *
 * 0. The range model — the numbers every detector is built on.
 * ====================================================================== */
section("threat range engine");

const range = new RangeModel({
  Weapons: H.Weapons, Projectiles: H.Projectiles, Hats: H.Hats, Items: H.Items
});
const snap = { scale: 35, TICK: H.TICK };

test("range: melee reach is weapon.range + 1.8 * my scale", () => {
  eq(range.meleeReach(snap, 4), 118 + 63, "katana");        // katana
  eq(range.meleeReach(snap, 5), 142 + 63, "polearm");       // polearm
  eq(range.meleeReach(snap, 7), 65 + 63, "daggers");        // daggers
  eq(range.meleeReach(snap, 0), 65 + 63, "tool hammer");
});

test("range: a ranged weapon has no melee reach", () => {
  eq(range.meleeReach(snap, 15, 0), 0, "musket");
  eq(range.meleeReach(snap, 9, 0), 0, "bow");
});

test("range: projectile reach and speed carry the Marksman multiplier", () => {
  const plain = range.projectileSpec(snap, 15, 0);
  const marks = range.projectileSpec(snap, 15, AH.HAT_MARKSMAN);
  eq(plain.range, 1400, "plain musket range");
  near(plain.speed, 3.6, 1e-9, "plain musket speed");
  near(marks.range, 1400 * 1.3, 1e-9, "marksman musket range");
  near(marks.speed, 3.6 * 1.3, 1e-9, "marksman musket speed");
  /* Reach adds the muzzle offset and my own body. */
  eq(plain.reach, 1400 + 70 + 35, "plain musket reach");
});

test("range: bow, crossbow and repeater differ", () => {
  eq(range.projectileSpec(snap, 9, 0).range, 1000, "hunting bow");
  eq(range.projectileSpec(snap, 12, 0).range, 1200, "crossbow");
  eq(range.projectileSpec(snap, 13, 0).range, 1200, "repeater");
  eq(range.projectileSpec(snap, 12, 0).damage, 35, "crossbow damage");
});

test("range: turret reach is shootRange + my scale", () => {
  eq(range.turretReach(snap), 700 + 35);
});

test("range: spike contact radius is my scale + the spike's", () => {
  eq(range.spikeContactRadius(snap, { collisionScale: 49 }), 84);   // spikes
  eq(range.spikeContactRadius(snap, { collisionScale: 52 }), 87);   // greater/spinning
});

test("range: reach opens by a tick of measured approach, not a guess", () => {
  eq(range.withApproach(100, { closing: 30 }, 1), 130);
  eq(range.withApproach(100, { closing: -30 }, 1), 100, "retreating never shrinks it");
});

test("range: melee facing uses gatherAngle, not the projectile line", () => {
  /* Directly at me is inside both; 60 degrees off is inside only the cone. */
  assert(range.aimingMelee({ angleToMe: 0, angle: 0 }), "head-on");
  assert(range.aimingMelee({ angleToMe: 0, angle: 1.0 }), "60 degrees off");
  assert(!range.aimingMelee({ angleToMe: 0, angle: 2.0 }), "115 degrees off");
});

/* ====================================================================== *
 * 1. Anti Instakill
 * ====================================================================== */
section("1. anti instakill");

test("instakill: a katana in reach on a low bar is CRITICAL and heals", () => {
  const enemy = new H.Enemy({
    x: 150, y: 0, angle: Math.PI, primary: 4, current: 4, danger: 3
  });
  const { engine, t, client } = run({
    health: 45, potentialDamage: 60, primaryDamage: 60,
    dangerNoSoldier: true, enemies: [enemy], damageTick: 100, prevHealth: 85
  });
  const r = report(engine, THREAT.INSTAKILL);
  assert(r, "instakill reported");
  eq(r.confidence, CONFIDENCE.CRITICAL, "confidence");
  assert(r.evidence.indexOf("armed-in-reach-facing") !== -1,
    "melee cone recognised the facing: " + r.evidence.join(","));
  assert(t.presses > 0, "pressed food, sent " + t.presses);
  assert(client.packets.count > 0, "frames left");
});

test("instakill: an archer across the map is not 'in reach'", () => {
  /* getWeaponRange folds a bow's 1000 into the same field as a katana's 118.
   * The detector must not read that as a swing. */
  const archer = new H.Enemy({
    x: 800, y: 0, angle: Math.PI, primary: 9, current: 9
  });
  const { engine } = run({
    health: 40, potentialDamage: 50, enemies: [archer], damageTick: 100, prevHealth: 90
  });
  const r = report(engine, THREAT.INSTAKILL);
  if (r) {
    assert(r.evidence.indexOf("armed-in-reach") === -1 &&
           r.evidence.indexOf("armed-in-reach-facing") === -1,
      "bow range must not count as melee reach: " + r.evidence.join(","));
  }
});

test("instakill: an enemy closing into reach is timed, not assumed", () => {
  const enemy = new H.Enemy({
    x: 260, px: 300, y: 0, angle: Math.PI, primary: 5, current: 5, speed: 40
  });
  const { engine } = run({
    health: 50, potentialDamage: 55, enemies: [enemy], damageTick: 100, prevHealth: 90
  });
  const r = report(engine, THREAT.INSTAKILL);
  assert(r, "reported");
  assert(r.evidence.some(e => e.indexOf("closing-into-reach") === 0),
    "closing time named: " + r.evidence.join(","));
});

test("instakill: nothing happening reports nothing", () => {
  const { engine, t } = run({ health: 100 });
  eq(report(engine, THREAT.INSTAKILL), null, "no report");
  eq(t.presses, 0, "no press at full health");
});

/* ====================================================================== *
 * 2. Anti Spike Tick
 * ====================================================================== */
section("2. anti spike tick");

test("spike tick: repeated contact becomes one escalating sequence", () => {
  let health = 100;
  const { engine, trace } = ticks({
    health: 100, collidingSpike: true, spikeDamage: 20, food: 500
  }, 4, (i, client) => {
    /* One spike hit per tick, and the engine never heals it back here. */
    client.myPlayer.previousHealth = health;
    health -= 20;
    client.myPlayer.currentHealth = health;
    client.myPlayer.damageTick = client.myPlayer.tickCount;
    client.myPlayer.receivedDamage = Date.now();
  });
  const r = report(engine, THREAT.SPIKE_TICK);
  assert(r, "sequence reported");
  assert(r.evidence.some(e => e.indexOf("hits:") === 0), "hit count carried");
  assert(["HIGH", "CRITICAL"].indexOf(r.confidence) !== -1,
    "escalated to at least HIGH, got " + r.confidence);
  assert(trace.some(x => x.threats.some(s => s.indexOf("spike-tick") === 0)),
    "reported during the run");
});

test("spike tick: predicted before the first hit, from the client's own scan", () => {
  const placer = new H.Enemy({ x: 120, y: 0, canPlaceSpike: true, spikeDamage: 45 });
  const { engine } = run({
    health: 70, spikeSyncThreat: true, willCollideSpike: true, enemies: [placer]
  });
  const r = report(engine, THREAT.SPIKE_TICK);
  assert(r, "predicted");
  assert(r.evidence.indexOf("spike-sync-threat") !== -1, "evidence names the scan");
  assert(r.rank <= 2, "never above MEDIUM before a hit, got " + r.confidence);
});

test("spike tick: the next contact is timed from the gap, not an average", () => {
  const spike = { pos: { current: new H.Vec(120, 0) }, collisionScale: 52, scale: 52 };
  let health = 100;
  const { engine } = ticks({
    health: 100, collidingSpike: true, spikeDamage: 35, nearestSpike: spike, speed: 20
  }, 3, (i, client) => {
    client.myPlayer.previousHealth = health;
    health -= 35;
    client.myPlayer.currentHealth = health;
    client.myPlayer.damageTick = client.myPlayer.tickCount;
    if (i === 2) {
      /* Stepped off it: contact is now a distance and a speed. */
      client.EnemyManager.collidingSpike = false;
      client.EnemyManager.willCollideSpike = false;
    }
  });
  const r = report(engine, THREAT.SPIKE_TICK);
  assert(r, "still tracking the sequence");
  assert(r.evidence.some(e => e.indexOf("gap-ticks:") === 0),
    "geometry used for the next hit: " + r.evidence.join(","));
});

/* ====================================================================== *
 * 3. Anti Insta Rev
 * ====================================================================== */
section("3. anti insta rev");

test("insta rev: secondary and turret held with a loaded primary, in reach", () => {
  const enemy = new H.Enemy({
    x: 150, y: 0, angle: Math.PI, primary: 4, secondary: 15, current: 4,
    reloaded: { 0: true, 1: false, 2: false },
    emptyReload: { 1: true, 2: true }
  });
  const { engine } = run({ health: 60, enemies: [enemy], turret: enemy });
  const r = report(engine, THREAT.INSTA_REV);
  assert(r, "reported");
  assert(r.evidence.indexOf("secondary+turret-held") !== -1, "reload shape named");
  assert(r.evidence.indexOf("in-reach") !== -1, "reach checked");
});

test("insta rev: the same shape out of reach is not the same threat", () => {
  const enemy = new H.Enemy({
    x: 900, y: 0, angle: Math.PI, primary: 4, secondary: 15, current: 4,
    reloaded: { 0: true, 1: false, 2: false },
    emptyReload: { 1: true, 2: true }
  });
  const { engine } = run({ health: 60, enemies: [enemy] });
  const r = report(engine, THREAT.INSTA_REV);
  assert(!r || r.confidence === CONFIDENCE.LOW,
    "at most LOW when it cannot be delivered, got " + (r && r.confidence));
});

test("insta rev: the client's own verdict is taken at full weight", () => {
  const enemy = new H.Enemy({
    x: 150, y: 0, angle: Math.PI, primary: 4, secondary: 15, current: 4,
    reverseInsta: true
  });
  const { engine } = run({ health: 40, enemies: [enemy] });
  const r = report(engine, THREAT.INSTA_REV);
  assert(r, "reported");
  assert(r.evidence.indexOf("client-reverse-insta") !== -1, "client verdict used");
});

/* ====================================================================== *
 * 4. Anti Musket
 * ====================================================================== */
section("4. anti musket");

test("musket: owning one is not a threat", () => {
  const enemy = new H.Enemy({
    x: 900, y: 0, angle: 0, primary: 4, secondary: 15, current: 4
  });
  const { engine } = run({ health: 60, enemies: [enemy] });
  eq(report(engine, THREAT.MUSKET), null, "possession alone reports nothing");
});

test("musket: holding one, loaded, aimed, and close enough is LOW/MEDIUM only", () => {
  const enemy = new H.Enemy({
    x: 400, y: 0, angle: Math.PI, primary: 4, secondary: 15, current: 15,
    oldCurrent: 12, reloaded: { 0: true, 1: true, 2: false }
  });
  const { engine } = run({ health: 60, enemies: [enemy] });
  const r = report(engine, THREAT.MUSKET);
  assert(r, "reported");
  assert(r.rank <= 2, "never above MEDIUM before firing, got " + r.confidence);
  eq(r.severity, 50, "musket projectile damage from the table");
  assert(r.evidence.indexOf("just-switched") !== -1, "wind-up signature");
});

test("musket: a ball in flight on my line is the real threat", () => {
  const ball = new H.Proj({ type: 5, x: 400, y: 0, angle: Math.PI, life: 9 });
  const { engine } = run({ health: 60, projectiles: [ball], projectileDamage: 50 });
  const r = report(engine, THREAT.MUSKET);
  assert(r, "reported");
  assert(r.rank >= 3, "at least HIGH once fired, got " + r.confidence);
  assert(r.timing >= 0 && r.timing <= 2, "impact within two ticks, got " + r.timing);
});

test("musket: a ball that has already gone past is not incoming", () => {
  /* Fired from 400 away four ticks ago at 3.6/ms: it has flown ~1600 and is
   * long behind me. The client would still have it in dangerProjectiles. */
  const ball = new H.Proj({ type: 5, x: 400, y: 0, angle: Math.PI, life: 5 });
  const { engine, t } = run({ health: 60, projectiles: [ball] });
  eq(t.projectilesTracked, 0, "dropped from the incoming list");
  eq(report(engine, THREAT.MUSKET), null, "no threat from a spent ball");
});

test("musket: a ball whose line misses me is not a hit", () => {
  /* Same flight, offset far enough that the line passes outside the hit box. */
  const ball = new H.Proj({ type: 5, x: 400, y: 300, angle: Math.PI, life: 9 });
  const { engine, t } = run({ health: 60, projectiles: [ball] });
  eq(t.projectilesOnTarget, 0, "line does not cross the box");
  const r = report(engine, THREAT.MUSKET);
  assert(!r || r.confidence === CONFIDENCE.LOW, "at most a LOW near-miss note");
});

test("musket: the Marksman cap extends the reach the detector allows", () => {
  /* 1500 away is outside a plain musket's 1400 + muzzle + body, inside a
   * Marksman one's 1820. */
  const plain = new H.Enemy({
    x: 1600, y: 0, angle: Math.PI, primary: 4, secondary: 15, current: 15,
    oldCurrent: 12, hatID: 0
  });
  const marks = new H.Enemy({
    x: 1600, y: 0, angle: Math.PI, primary: 4, secondary: 15, current: 15,
    oldCurrent: 12, hatID: AH.HAT_MARKSMAN
  });
  eq(report(run({ health: 60, enemies: [plain] }).engine, THREAT.MUSKET), null,
    "out of a plain musket's reach");
  const r = report(run({ health: 60, enemies: [marks] }).engine, THREAT.MUSKET);
  assert(r, "inside a Marksman musket's reach");
  assert(r.evidence.some(e => e.indexOf("marksman:") === 0), "reach named");
});

/* ====================================================================== *
 * 5. Anti Bow
 * ====================================================================== */
section("5. anti bow");

test("bow: an arrow in flight on my line is reported with its own damage", () => {
  const arrow = new H.Proj({ type: 0, x: 300, y: 0, angle: Math.PI, life: 9 });
  const { engine } = run({ health: 60, projectiles: [arrow], projectileDamage: 25 });
  const r = report(engine, THREAT.BOW);
  assert(r, "reported");
  eq(r.severity, 25, "hunting bow arrow damage");
});

test("bow: a crossbow bolt is a different number from the same detector", () => {
  const bolt = new H.Proj({ type: 2, x: 300, y: 0, angle: Math.PI, life: 9 });
  const { engine } = run({ health: 60, projectiles: [bolt], projectileDamage: 35 });
  const r = report(engine, THREAT.BOW);
  assert(r, "reported");
  eq(r.severity, 35, "crossbow bolt damage");
});

test("bow: an arrow past its range never arrives", () => {
  /* Fired with only 40 range left: it dies well before it reaches me. */
  const arrow = new H.Proj({ type: 0, x: 300, y: 0, angle: Math.PI, life: 9, range: 40 });
  const { engine, t } = run({ health: 60, projectiles: [arrow] });
  eq(t.projectilesTracked, 0, "expired by range");
  eq(report(engine, THREAT.BOW), null);
});

test("bow: holding one is not shooting one", () => {
  const enemy = new H.Enemy({
    x: 300, y: 0, angle: 0, primary: 4, secondary: 9, current: 9
  });
  const { engine } = run({ health: 60, enemies: [enemy] });
  eq(report(engine, THREAT.BOW), null, "not aimed at me");
});

/* ====================================================================== *
 * 6. Anti Spam Dagger
 * ====================================================================== */
section("6. anti spam dagger");

test("dagger: repeated hits from a dagger in reach escalate", () => {
  const enemy = new H.Enemy({
    x: 100, y: 0, angle: Math.PI, primary: 7, current: 7
  });
  let health = 100;
  const { engine } = ticks({
    health: 100, enemies: [enemy], food: 500, primaryDamage: 20
  }, 4, (i, client) => {
    client.myPlayer.previousHealth = health;
    health -= 20;
    client.myPlayer.currentHealth = health;
    client.myPlayer.damageTick = client.myPlayer.tickCount;
  });
  const r = report(engine, THREAT.SPAM_DAGGER);
  assert(r, "reported");
  assert(["HIGH", "CRITICAL"].indexOf(r.confidence) !== -1,
    "escalated, got " + r.confidence);
  assert(r.evidence.some(e => e.indexOf("swings/tick:") === 0), "swing rate named");
});

test("dagger: outside the dagger's 128 reach there is no pressure", () => {
  const enemy = new H.Enemy({
    x: 200, y: 0, angle: Math.PI, primary: 7, current: 7
  });
  let health = 100;
  const { engine } = ticks({ health: 100, enemies: [enemy] }, 3, (i, client) => {
    client.myPlayer.previousHealth = health;
    health -= 20;
    client.myPlayer.currentHealth = health;
  });
  eq(report(engine, THREAT.SPAM_DAGGER), null, "out of reach is not dagger pressure");
});

test("dagger: in reach and loaded but nothing landing is LOW", () => {
  const enemy = new H.Enemy({
    x: 100, y: 0, angle: Math.PI, primary: 7, current: 7
  });
  const { engine } = run({ health: 90, enemies: [enemy] });
  const r = report(engine, THREAT.SPAM_DAGGER);
  assert(r, "reported");
  eq(r.confidence, CONFIDENCE.LOW, "no hits yet");
});

/* ====================================================================== *
 * 7. Anti Velocity Tick
 * ====================================================================== */
section("7. anti velocity tick");

test("velocity tick: turret in range plus a polearm in the knockback band", () => {
  const enemy = new H.Enemy({
    x: 230, px: 270, y: 0, angle: Math.PI, primary: 5, current: 5, speed: 40,
    reloaded: { 0: true, 1: true, 2: true }
  });
  const { engine } = run({ health: 70, enemies: [enemy], turret: enemy });
  const r = report(engine, THREAT.VELOCITY_TICK);
  assert(r, "reported");
  assert(r.evidence.indexOf("polearm") !== -1, "the reach half named");
  assert(r.evidence.indexOf("turret-in-range") !== -1, "the knockback half named");
  eq(r.severity, Math.round(45 * H.Hats[7].dmgMultO + 25),
    "polearm plus the turret shot, from the tables");
});

test("velocity tick: no turret anywhere is no combo", () => {
  const enemy = new H.Enemy({
    x: 230, y: 0, angle: Math.PI, primary: 5, current: 5
  });
  const { engine } = run({ health: 70, enemies: [enemy] });
  eq(report(engine, THREAT.VELOCITY_TICK), null);
});

test("velocity tick: a turret out of its 735 reach is not in range", () => {
  const far = new H.Enemy({ id: 2, x: 900, y: 0 });
  const enemy = new H.Enemy({
    x: 230, y: 0, angle: Math.PI, primary: 5, current: 5
  });
  const { engine } = run({ health: 70, enemies: [enemy], turret: far });
  eq(report(engine, THREAT.VELOCITY_TICK), null, "turret cannot reach me");
});

/* ====================================================================== *
 * 8. Anti Spike
 * ====================================================================== */
section("8. anti spike");

test("spike: touching one with an enemy pushing is CRITICAL", () => {
  const pusher = new H.Enemy({ x: 90, y: 0 });
  const { engine } = run({
    health: 60, collidingSpike: true, spikeDamage: 45, pusher, enemies: [pusher]
  });
  const r = report(engine, THREAT.SPIKE);
  assert(r, "reported");
  eq(r.confidence, CONFIDENCE.CRITICAL);
  eq(r.timing, 0, "contact is now");
});

test("spike: the contact radius is the collision rule, and the gap is timed", () => {
  const spike = { pos: { current: new H.Vec(110, 0) }, collisionScale: 52, scale: 52 };
  const { engine } = run({
    health: 60, nearestSpike: spike, spikeDamage: 45, speed: 30, willCollideSpike: true
  });
  const r = report(engine, THREAT.SPIKE);
  assert(r, "reported");
  assert(r.evidence.indexOf("contact-at:87") !== -1,
    "35 + 52 named: " + r.evidence.join(","));
});

test("spike: a spike nowhere near me is not a threat", () => {
  const spike = { pos: { current: new H.Vec(600, 0) }, collisionScale: 52, scale: 52 };
  const { engine } = run({ health: 60, nearestSpike: spike });
  eq(report(engine, THREAT.SPIKE), null);
});

/* ====================================================================== *
 * 9. Defensive hat manager
 * ====================================================================== */
section("9. defensive hat manager");

test("soldier: worn when the damage is lethal bare and survivable in it", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  const { engine, client } = run({
    health: 70, potentialDamage: 80, dangerNoSoldier: true, dangerEnemy: false,
    enemies: [enemy]
  });
  eq(engine.gear.want, AH.HAT_SOLDIER, "asked for soldier");
  eq(client._ModuleHandler.forceHat, AH.HAT_SOLDIER, "claimed the slot");
  eq(engine.gear.switches, 1, "one switch");
});

test("soldier: still worn when the damage is lethal either way", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  const { engine } = run({
    health: 30, potentialDamage: 90, dangerNoSoldier: true, dangerEnemy: true,
    enemies: [enemy]
  });
  eq(engine.gear.want, AH.HAT_SOLDIER, "a quarter off is still a quarter off");
});

test("soldier: not worn merely because an enemy owns a dangerous weapon", () => {
  const enemy = new H.Enemy({
    x: 900, y: 0, angle: 0, primary: 4, secondary: 15, current: 4
  });
  const { engine, client } = run({ health: 100, enemies: [enemy] });
  eq(engine.gear.want, null, "no reason to switch");
  eq(client._ModuleHandler.forceHat, null, "slot untouched");
  eq(engine.gear.switches, 0);
});

test("soldier: not worn on a quiet field", () => {
  const { engine } = run({ health: 100 });
  eq(engine.gear.want, null);
  eq(engine.gear.switches, 0);
});

test("soldier: never claimed when another module already holds the slot", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  const { engine, client } = run({
    health: 70, potentialDamage: 80, dangerNoSoldier: true,
    enemies: [enemy], forceHat: 53
  });
  eq(client._ModuleHandler.forceHat, 53, "the other module keeps it");
  eq(engine.gear.want, null, "we stood down");
  assert(engine.gear.blocked.indexOf("hat-claimed") === 0, engine.gear.blocked);
});

test("soldier: not worn when we do not own it", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  const { engine } = run({
    health: 70, potentialDamage: 80, dangerNoSoldier: true,
    enemies: [enemy], ownedHats: [0]
  });
  eq(engine.gear.want, null);
  eq(engine.gear.reason, "not-owned");
});

test("soldier: one continuous threat is one switch, not one per tick", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  const { engine } = ticks({
    health: 70, potentialDamage: 80, dangerNoSoldier: true, enemies: [enemy]
  }, 8, (i, client) => {
    /* The hat lands after a tick, as it would on the wire. */
    if (i >= 1) {
      client.myPlayer.hatID = 6;
      client._ModuleHandler.store[0].last = 6;
    }
    client._ModuleHandler.forceHat = null;
  });
  eq(engine.gear.switches, 1, "exactly one equip asked for across the session");
  eq(engine.gear.sessionId, 1, "one session");
});

test("soldier: released only after the threat has been gone for a run of ticks", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  let engaged = [];
  const { engine } = ticks({
    health: 70, potentialDamage: 80, dangerNoSoldier: true, enemies: [enemy]
  }, 12, (i, client) => {
    client._ModuleHandler.forceHat = null;
    if (i >= 1) { client.myPlayer.hatID = 6; client._ModuleHandler.store[0].last = 6; }
    if (i === 5) {
      /* The fight ends. */
      client.EnemyManager.potentialDamage = 0;
      client.EnemyManager.dangerWithoutSoldier = false;
      client.PlayerManager.enemies = [];
      client.EnemyManager.nearestEnemy = null;
    }
    engaged.push(null);
  });
  assert(!engine.gear.engaged, "released once the field was quiet");
  assert(engine.gear.releasedAt > 0, "release recorded");
  eq(engine.gear.switches, 1, "and it did not flap on the way there");
});

test("soldier: a threat that flickers off for one tick does not release it", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  const { engine } = ticks({
    health: 70, potentialDamage: 80, dangerNoSoldier: true, enemies: [enemy]
  }, 8, (i, client) => {
    client._ModuleHandler.forceHat = null;
    if (i >= 1) { client.myPlayer.hatID = 6; client._ModuleHandler.store[0].last = 6; }
    const quiet = i === 4;
    client.EnemyManager.potentialDamage = quiet ? 0 : 80;
    client.EnemyManager.dangerWithoutSoldier = !quiet;
  });
  assert(engine.gear.engaged, "held through the gap");
  eq(engine.gear.switches, 1, "no re-equip");
});

test("soldier: a shame lock lowers the bar, because food is refused", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  const { engine } = run({
    health: 80, potentialDamage: 30, shameActive: true, hatID: 45,
    enemies: [enemy], damageTick: 100, prevHealth: 100
  });
  assert(engine.gear.want === AH.HAT_SOLDIER || engine.gear.blocked,
    "mitigation is the only defence left: " + engine.gear.reason);
});

test("soldier: a hit resolving this tick is not a reason to switch", () => {
  /* Nothing can be equipped in time for damage already landing, so spending a
   * frame on it is spending a frame on nothing. */
  const { engine } = run({
    health: 60, prevHealth: 90, damageTick: 100,
    collidingSpike: true, spikeDamage: 30
  });
  eq(engine.gear.want, null, "reason was: " + engine.gear.reason);
});

test("soldier: a late threat is seen past an early one", () => {
  /* A spike touching now (timing 0) and a musket ball three ticks out. Reading
   * one damage number keyed on the soonest report would mitigate neither. */
  const ball = new H.Proj({ type: 5, x: 1100, y: 0, angle: Math.PI, life: 9 });
  const { engine } = run({
    health: 90, collidingSpike: true, spikeDamage: 20,
    projectiles: [ball], projectileDamage: 50
  });
  eq(engine.gear.want, AH.HAT_SOLDIER,
    "the ball is still mitigable: " + engine.gear.reason);
  assert(engine.gear.saved >= AH.GEAR_MIN_SAVED_HEALTH,
    "and it saves enough to be worth it: " + engine.gear.saved);
});

test("soldier: a shot that will miss is not worth a switch", () => {
  const ball = new H.Proj({ type: 5, x: 1100, y: 900, angle: Math.PI, life: 9 });
  const { engine, t } = run({ health: 90, projectiles: [ball] });
  eq(t.projectilesOnTarget, 0, "it misses");
  eq(engine.gear.want, null, "so nothing to mitigate: " + engine.gear.reason);
});

test("soldier: the gear claim does not take the tick from other modules", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  const { client } = run({
    health: 90, potentialDamage: 80, dangerNoSoldier: true, enemies: [enemy]
  });
  eq(client._ModuleHandler.forceHat, AH.HAT_SOLDIER, "hat claimed");
  eq(client._ModuleHandler.moduleActive, false,
    "moduleActive left alone so Anti Retrap and friends still run");
});

/* ====================================================================== *
 * 10. Heal packets
 * ====================================================================== */
section("10. heal packets");

test("packets: a burst costs 2 per press plus one weapon restore", () => {
  eq(burstPackets(1), 3);
  eq(burstPackets(3), 7);
  eq(burstPackets(4), 9);
  eq(pressesForPackets(9), 4, "and the inverse agrees");
  eq(pressesForPackets(2), 0, "a budget under one press carries none");
});

test("packets: the frames actually sent match the model", () => {
  const { client, t } = run({
    health: 20, potentialDamage: 70, dangerNoSoldier: true, food: 500,
    damageTick: 100, prevHealth: 90,
    enemies: [new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 })]
  });
  assert(t.presses > 0, "pressed");
  eq(client.packets.count, burstPackets(t.presses),
    `${t.presses} presses should cost ${burstPackets(t.presses)} frames`);
  /* select, attack, select, attack, ..., one weapon restore at the end. */
  eq(client.packets.frames[client.packets.frames.length - 1], "weapon:0",
    "one restore, and it is last");
  eq(client.packets.frames.filter(f => f.indexOf("weapon:") === 0).length, 1,
    "exactly one restore for the whole burst");
});

test("packets: presses are capped by the food actually in the bag", () => {
  /* 30 food and a 15-cost cookie is two presses, whatever the gap says. */
  const { client, t } = run({
    health: 10, potentialDamage: 70, dangerNoSoldier: true, food: 30,
    damageTick: 100, prevHealth: 90,
    enemies: [new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 })]
  });
  assert(t.presses <= 2, "never asks for food it does not have, sent " + t.presses);
  eq(client.packets.count, burstPackets(t.presses), "and pays only for those");
});

test("packets: no food, no frames", () => {
  const { client, t } = run({
    health: 10, potentialDamage: 70, dangerNoSoldier: true, food: 0,
    damageTick: 100, prevHealth: 90
  });
  eq(t.presses, 0);
  eq(client.packets.count, 0, "not one frame spent on a press that cannot land");
});

test("packets: the press count comes from the gap, Deltek-style", () => {
  /* 100 - 20 = 80 of gap at 40 a cookie is two presses. */
  const { t } = run({
    health: 20, potentialDamage: 70, dangerNoSoldier: true, food: 500,
    damageTick: 100, prevHealth: 90,
    enemies: [new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 })]
  });
  eq(t.presses, 2, "ceil(80 / 40)");
});

test("packets: an identical heal already in the air is not sent twice", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  let first = null;
  const { client, engine } = ticks({
    health: 60, potentialDamage: 70, dangerNoSoldier: true, food: 500,
    damageTick: 100, prevHealth: 100, enemies: [enemy], pong: 300
  }, 2, (i, c) => {
    c._ModuleHandler.forceHat = null;
    c._ModuleHandler.healedOnce = false;
    c._ModuleHandler.moduleActive = false;
    if (i === 1) first = c.packets.count;
  });
  assert(first > 0, "the first tick pressed");
  assert(engine.ledger.duplicatesBlocked > 0 || client.packets.count === first,
    "the second tick did not re-send the same heal");
});

test("packets: at full health nothing is pressed", () => {
  const { client, t } = run({ health: 100, potentialDamage: 60, food: 500 });
  eq(t.presses, 0);
  eq(client.packets.count, 0);
});

test("packets: the frame budget is respected", () => {
  const { client, t } = run({
    health: 20, potentialDamage: 70, dangerNoSoldier: true, food: 500,
    damageTick: 100, prevHealth: 90,
    enemies: [new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 })]
  });
  assert(client._ModuleHandler.packetCount <= client._ModuleHandler.packetLimit,
    "never over the limit");
  assert(t.presses <= AH.MAX_PRESSES_PER_TICK, "and never over the per-tick cap");
});

/* ====================================================================== *
 * 11. Shame control, unchanged behaviour
 * ====================================================================== */
section("11. shame control");

test("shame: a charged press at the ceiling never leaves", () => {
  const { client, t } = run({
    health: 40, shame: 7, potentialDamage: 50, food: 500,
    damageTick: 100, prevHealth: 80, receivedDamage: Date.now(),
    enemies: [new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 })]
  });
  eq(t.presses, 0, "no press: it would arm the lock and heal nothing");
  eq(client.packets.count, 0);
  assert(t.reason.indexOf("lockguard") !== -1 || t.urgency === "lockguard",
    "lockguard named: " + t.reason);
});

test("shame: the lock refuses food outright", () => {
  const { client, t } = run({
    health: 40, shameActive: true, hatID: 45, potentialDamage: 50, food: 500
  });
  eq(t.presses, 0);
  eq(client.packets.count, 0, "not one frame during the 30s lock");
});

/* ====================================================================== *
 * 12. Simultaneous threats
 * ====================================================================== */
section("12. simultaneous threats");

test("simultaneous: a musket ball, a spike underfoot and a dagger all report", () => {
  const dagger = new H.Enemy({
    x: 100, y: 0, angle: Math.PI, primary: 7, current: 7
  });
  const ball = new H.Proj({ type: 5, x: 500, y: 0, angle: Math.PI, life: 9 });
  let health = 100;
  const { engine } = ticks({
    health: 100, enemies: [dagger], projectiles: [ball], projectileDamage: 50,
    collidingSpike: true, spikeDamage: 20, potentialDamage: 30, food: 500
  }, 3, (i, client) => {
    client.myPlayer.previousHealth = health;
    health -= 20;
    client.myPlayer.currentHealth = health;
    client.myPlayer.damageTick = client.myPlayer.tickCount;
    client._ModuleHandler.forceHat = null;
    client._ModuleHandler.healedOnce = false;
    client._ModuleHandler.moduleActive = false;
  });
  const types = engine.threat.reports.map(r => r.type);
  assert(types.indexOf(THREAT.SPIKE) !== -1, "spike: " + types.join(","));
  assert(types.indexOf(THREAT.SPAM_DAGGER) !== -1, "dagger: " + types.join(","));
  assert(types.indexOf(THREAT.SPIKE_TICK) !== -1, "spike tick: " + types.join(","));
  assert(engine.threat.top, "one of them is on top");
});

test("simultaneous: the top threat is the one that does the most, soonest", () => {
  const dagger = new H.Enemy({ x: 100, y: 0, angle: Math.PI, primary: 7, current: 7 });
  const ball = new H.Proj({ type: 5, x: 200, y: 0, angle: Math.PI, life: 9 });
  const { engine } = run({
    health: 45, enemies: [dagger], projectiles: [ball], projectileDamage: 50,
    potentialDamage: 20
  });
  assert(engine.threat.top, "a top threat");
  assert([THREAT.MUSKET, THREAT.INSTAKILL].indexOf(engine.threat.top.type) !== -1,
    "50 damage a tick away outranks 20 of dagger: " + engine.threat.top.type);
});

test("simultaneous: gear and heal answer the same threat without fighting", () => {
  const enemy = new H.Enemy({ x: 150, y: 0, angle: Math.PI, primary: 4, current: 4 });
  const ball = new H.Proj({ type: 5, x: 400, y: 0, angle: Math.PI, life: 9 });
  const { engine, client } = run({
    health: 55, potentialDamage: 60, dangerNoSoldier: true, food: 500,
    damageTick: 100, prevHealth: 95, enemies: [enemy], projectiles: [ball],
    projectileDamage: 50
  });
  eq(client._ModuleHandler.forceHat, AH.HAT_SOLDIER, "hat asked for");
  assert(engine.telemetry.presses > 0, "and food pressed in the same tick");
  eq(client.packets.count, burstPackets(engine.telemetry.presses),
    "the hat claim costs no heal frames");
});

/* ====================================================================== *
 * 13. Recovery, and doing nothing when nothing is happening
 * ====================================================================== */
section("13. recovery");

test("recovery: a quiet field costs no frames and no switches", () => {
  const { client, engine } = ticks({ health: 100, food: 500 }, 10, (i, c) => {
    c._ModuleHandler.forceHat = null;
    c._ModuleHandler.healedOnce = false;
    c._ModuleHandler.moduleActive = false;
  });
  eq(client.packets.count, 0, "no frames");
  eq(engine.gear.switches, 0, "no hat switches");
  eq(engine.executor.totalPresses, 0, "no presses");
});

test("recovery: after a fight the engine tops up and stops", () => {
  const { client, trace } = ticks({
    health: 60, food: 500, damageTick: -99
  }, 6, (i, c, eng) => {
    c._ModuleHandler.forceHat = null;
    c._ModuleHandler.healedOnce = false;
    c._ModuleHandler.moduleActive = false;
    /* Whatever the previous tick sent, land it — as the server would. */
    const sent = eng.telemetry.presses || 0;
    if (sent) {
      c.myPlayer.previousHealth = c.myPlayer.currentHealth;
      c.myPlayer.currentHealth = Math.min(100, c.myPlayer.currentHealth + sent * 40);
    }
  });
  eq(client.myPlayer.currentHealth, 100, "back to full");
  const after = trace.slice(3).reduce((a, x) => a + x.presses, 0);
  eq(after, 0, "and no presses once it is there");
});

/* ====================================================================== */
console.log(
  `\n${passed} passed, ${failures.length} failed`
);
if (failures.length) {
  console.log("\nfailures:");
  for (const f of failures) console.log("  " + f.name + "\n    " + f.error.stack.split("\n")[0]);
  process.exit(1);
}
