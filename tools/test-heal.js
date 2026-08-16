#!/usr/bin/env node
// Runs the autoheal out of RYN_v5.4.user.js against a mocked world.
//
// Same method as tools/test-placer.js: the module is cut out of the userscript
// by source anchors and run as-is, so the scenarios exercise the shipped code.
// Time is faked — the harness owns the clock and the timer queue, which is the
// only way to test a system whose whole job is when a packet leaves.
//
//   node tools/test-heal.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SCRIPT = process.env.RYN_HEAL_SCRIPT || path.join(__dirname, "..", "RYN_v5.4.user.js");
const source = fs.readFileSync(SCRIPT, "utf8");

function cut(startAnchor, endAnchor, { includeEnd = false } = {}) {
  const start = source.indexOf(startAnchor);
  if (start === -1) throw new Error(`anchor not found: ${startAnchor}`);
  const end = source.indexOf(endAnchor, start + startAnchor.length);
  if (end === -1) throw new Error(`end anchor not found: ${endAnchor}`);
  return source.slice(start, includeEnd ? end + endAnchor.length : end);
}

const parts = [
  cut("const Hats = {", "const Accessories"),
  cut("const Items = [", "const WeaponVariants = ["),
  cut("  const ANTI_INSTA_DMG_CAP = 140;", "  const AntiInsta_default = AntiInsta;", { includeEnd: true })
];

// ── clock ─────────────────────────────────────────────────────────────────
let now = 1e6;
let timers = [];
let timerId = 1;

const clock = {
  now: () => now,
  advance(ms) {
    const until = now + ms;
    for (;;) {
      const due = timers.filter(t => t.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter(t => t !== due);
      now = due.at;
      due.fn();
    }
    now = until;
  }
};

const context = {
  console,
  Math,
  Date: new Proxy(Date, { get: (t, p) => (p === "now" ? () => now : t[p]) }),
  setTimeout: (fn, ms) => {
    const id = timerId++;
    timers.push({ id, at: now + ms, fn });
    return id;
  },
  clearTimeout: (id) => {
    timers = timers.filter(t => t.id !== id);
  },
  performance: { now: () => now },
  Settings_default: { _autoheal: true, _antiSmartTick: false },
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  PlayerObject: class {},
  DataHandler_default: { getWeapon: () => ({ range: 100 }), isMelee: () => true }
};
vm.createContext(context);
vm.runInContext(`${parts.join("\n")}\nglobalThis.__AntiInsta = AntiInsta;\nglobalThis.__Items = Items;`, context, { filename: "heal-extract.js" });

const AntiInsta = context.__AntiInsta;
const Items = context.__Items;
const APPLE = 0; // apple, restore 20

// ── world ─────────────────────────────────────────────────────────────────
function makeWorld(options = {}) {
  const sent = [];
  const myPlayer = {
    inGame: true,
    shameActive: false,
    shameCount: options.shameCount ?? 0,
    currentHealth: options.health ?? 100,
    tempHealth: options.health ?? 100,
    maxHealth: 100,
    hatID: options.hat ?? 0,
    isTrapped: options.trapped ?? false,
    trappedInPrev: options.wasTrapped ?? null,
    receivedDamage: null,
    isSandbox: false,
    getItemByType: (type) => (type === 2 ? APPLE : null)
  };
  const moduleHandler = {
    tickCount: 0,
    packetCount: 0,
    packetLimit: 119,
    healedOnce: false,
    didAntiInsta: false,
    shouldAttack: false,
    healNow() {
      sent.push({ at: now, health: myPlayer.tempHealth });
    },
    heal() {
      this.healNow();
    }
  };
  const client = {
    myPlayer,
    _ModuleHandler: moduleHandler,
    SocketManager: { pong: options.ping ?? 60 },
    EnemyManager: {
      nearestEnemy: options.enemy === null ? null : (options.enemy ?? { weapon: { primary: 0, secondary: 10 } }),
      potentialDamage: options.potentialDamage ?? 0,
      potentialSpikeDamage: options.potentialSpikeDamage ?? 0,
      potentialPrimary: options.potentialPrimary ?? 0,
      potentialSecondary: options.potentialSecondary ?? 0,
      potentialTurret: options.potentialTurret ?? 0,
      collidingSpike: options.collidingSpike ?? false
    },
    ObjectManager: { grid2D: { query: () => false }, objects: new Map() },
    PlayerManager: { isEnemyByID: () => true }
  };
  const module = new AntiInsta(client);

  // What ClientPlayer.updateHealth does for myPlayer, in the order it does it.
  const damage = (amount) => {
    myPlayer.currentHealth -= amount;
    myPlayer.tempHealth = myPlayer.currentHealth;
    myPlayer.receivedDamage = now;
    module.onDamage(amount);
  };
  const serverEcho = (health) => {
    myPlayer.currentHealth = health;
    myPlayer.tempHealth = health;
  };
  const tick = () => {
    moduleHandler.tickCount += 1;
    module.postTick();
  };
  return { client, myPlayer, moduleHandler, module, sent, damage, tick, serverEcho };
}

// ── assertions ────────────────────────────────────────────────────────────
let failures = 0;
let checks = 0;
const check = (name, condition, detail) => {
  checks += 1;
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail === undefined ? "" : ` — ${detail}`}`);
  }
};
const section = (name) => console.log(`\n${name}`);

// The rule the whole module exists for, from the game bundle: a heal that lands
// within 120ms of the hit is +1 shame, later is -2, and eight is a 30s lockout.
const SHAME_WINDOW = 120;

// ── scenario: the delayed heal clears the shame window ────────────────────
section("a hit that is not lethal");
{
  for (const ping of [0, 40, 90, 160]) {
    const world = makeWorld({ ping, health: 100 });
    const hitAt = now;
    world.damage(30);
    world.tick();
    check(`ping ${ping}: nothing is sent inside the window`, world.sent.length === 0, `${world.sent.length} sent`);
    clock.advance(400);
    check(`ping ${ping}: the top-up went out`, world.sent.length > 0, `${world.sent.length} sent`);
    if (world.sent.length) {
      // The server dealt the hit half a round trip before we saw it, and our
      // food takes another half trip to get back, so what it measures is our
      // wait plus the whole round trip.
      const gap = (world.sent[0].at - hitAt) + ping;
      check(`ping ${ping}: it lands past the shame window`, gap > SHAME_WINDOW, `gap ${gap.toFixed(0)}ms`);
      // auraro's delay exactly: the window is cleared by taking the round trip
      // out of it, and the 50ms floor keeps a ping that is really jitter from
      // pushing the send inside the window anyway.
      const waited = world.sent[0].at - hitAt;
      check(`ping ${ping}: the wait is max(50, 140 - ping)`, waited === Math.max(50, 140 - ping), `waited ${waited}ms`);
    }
  }
}

// ── scenario: the burst would kill ────────────────────────────────────────
section("a burst that would kill");
{
  const world = makeWorld({
    health: 100,
    ping: 60,
    potentialDamage: 80,
    potentialPrimary: 55,
    potentialSecondary: 25
  });
  world.damage(35); // 65 left, 80 - min(55, 25) = 55 incoming... not lethal yet
  world.tick();
  check("a survivable burst waits for the safe window", world.sent.length === 0, `${world.sent.length} sent`);

  const lethal = makeWorld({
    health: 60,
    ping: 60,
    potentialDamage: 120,
    potentialPrimary: 60,
    potentialSecondary: 60
  });
  // 35 left, so 65 missing, against 120 - min(60, 60) = 60 incoming, 45 of it
  // through soldier: 65 + 45 is over the bar.
  lethal.damage(25);
  lethal.tick();
  check("a lethal one is healed immediately", lethal.sent.length > 0, `${lethal.sent.length} sent`);
  check("and it is enough food to close the gap", lethal.sent.length === Math.ceil((100 - 35) / Items[APPLE].restore), `${lethal.sent.length} presses`);
}

// ── scenario: both hands are not counted twice ────────────────────────────
section("the two-hand rule");
{
  // 60 primary and 60 secondary+turret cannot both land, so the threat is 60,
  // not 120 — auraro subtracts the smaller of the two.
  const world = makeWorld({
    health: 55,
    ping: 60,
    potentialDamage: 120,
    potentialPrimary: 60,
    potentialSecondary: 40,
    potentialTurret: 20
  });
  const sources = world.module._damageSources();
  check("the smaller hand is subtracted", Math.abs(sources.totalNoSoldier - 60) < 1e-9, `${sources.totalNoSoldier}`);
  check("soldier takes a quarter off that", Math.abs(sources.totalSoldier - 45) < 1e-9, `${sources.totalSoldier}`);
  // Added naively the threat is 120, and 40 missing against that reads as
  // lethal; under the rule it is 60, and 40 + 45 is survivable. So this is the
  // case where counting both hands would have spent food and taken shame for
  // nothing.
  const survivable = makeWorld({
    health: 70,
    ping: 60,
    potentialDamage: 120,
    potentialPrimary: 60,
    potentialSecondary: 40,
    potentialTurret: 20
  });
  survivable.damage(10);
  survivable.tick();
  check("a trade that only reads lethal when both hands are counted is not healed into", survivable.sent.length === 0, `${survivable.sent.length} sent`);
  clock.advance(400);
  check("it still gets the safe top-up afterwards", survivable.sent.length > 0, `${survivable.sent.length} sent`);
}

// ── scenario: the shame ceiling ───────────────────────────────────────────
section("the shame ceiling");
{
  const at = (shameCount, extra = {}) => {
    const world = makeWorld({
      health: 40,
      ping: 60,
      shameCount,
      potentialDamage: 90,
      potentialPrimary: 45,
      potentialSecondary: 45,
      ...extra
    });
    world.damage(20);
    world.tick();
    return world.sent.length;
  };
  check("under the ceiling it heals", at(3) > 0);
  check("at the ceiling it stops", at(5) === 0, `${at(5)} sent`);

  // Pinned with a spike on you, the ceiling goes to 7: the lockout is 30
  // seconds away and the spike is not.
  const spiked = makeWorld({
    health: 40,
    ping: 60,
    shameCount: 6,
    trapped: true,
    collidingSpike: true,
    potentialSpikeDamage: 35,
    potentialDamage: 90,
    potentialPrimary: 45,
    potentialSecondary: 45
  });
  spiked.damage(35); // matches the spike's damage exactly
  spiked.tick();
  check("pinned on a spike it keeps healing at six shames", spiked.sent.length > 0, `${spiked.sent.length} sent`);
  check("the ceiling was raised to seven", spiked.module._shameCeiling(spiked.myPlayer, spiked.client.EnemyManager.nearestEnemy, 35) === 7);

  // A polearm with a ranged off-hand gets 6, a bow-class primary gets 3.
  const world = makeWorld({});
  const ceil = (primary, secondary) => world.module._shameCeiling(world.myPlayer, { weapon: { primary, secondary } }, 0);
  check("polearm with a ranged off-hand gets six", ceil(5, 9) === 6, String(ceil(5, 9)));
  check("the bow classes get three", ceil(7, 10) === 3, String(ceil(7, 10)));
  check("everything else gets five", ceil(0, 10) === 5, String(ceil(0, 10)));
}

// ── scenario: eight shames is death, so it must never get there ───────────
section("continuous spike damage");
{
  // The case the whole question was about: pressed against a spike, 35 a hit,
  // one hit per server tick. There is no safe window — 111ms between hits is
  // inside the 120ms the server judges — so the only thing that matters is
  // that the client stops before the lockout.
  const world = makeWorld({
    health: 100,
    ping: 60,
    collidingSpike: true,
    potentialSpikeDamage: 35,
    potentialDamage: 35,
    potentialPrimary: 35
  });
  let shame = 0;
  for (let hit = 0; hit < 14; hit++) {
    world.myPlayer.shameCount = shame;
    const before = world.sent.length;
    world.damage(35);
    world.tick();
    world.serverEcho(Math.min(100, world.myPlayer.tempHealth + (world.sent.length - before) * Items[APPLE].restore));
    // Every heal here lands inside the window of the next hit, so the server
    // would count it as shame.
    if (world.sent.length > before) shame += 1;
    clock.advance(111);
  }
  check("it never reaches the eight that locks food for 30s", shame < 8, `reached ${shame}`);
  check("and it did keep healing while it could", world.sent.length > 0, `${world.sent.length} sent`);
}

// ── scenario: the in-flight guard ─────────────────────────────────────────
section("food already in the air");
{
  const world = makeWorld({ health: 40, ping: 60, potentialDamage: 90, potentialPrimary: 45, potentialSecondary: 45 });
  world.damage(20); // 20 left
  world.tick();
  const first = world.sent.length;
  check("the first batch closes the gap", first === Math.ceil(80 / Items[APPLE].restore), `${first}`);
  // Same tick again with no server echo yet: tempHealth has not moved.
  world.moduleHandler.tickCount += 1;
  world.damage(1);
  world.tick();
  check("the same missing health is not paid for twice", world.sent.length <= first + 1, `${world.sent.length} total`);
}

// ── scenario: the switch ──────────────────────────────────────────────────
section("the switch");
{
  context.Settings_default._autoheal = false;
  const world = makeWorld({ health: 40, ping: 60, potentialDamage: 90, potentialPrimary: 45, potentialSecondary: 45 });
  world.damage(20);
  world.tick();
  clock.advance(400);
  check("off means off", world.sent.length === 0, `${world.sent.length} sent`);
  context.Settings_default._autoheal = true;

  const shamed = makeWorld({ health: 40, ping: 60, potentialDamage: 90, potentialPrimary: 45, potentialSecondary: 45 });
  shamed.myPlayer.shameActive = true;
  shamed.damage(20);
  shamed.tick();
  clock.advance(400);
  check("no food is spent while the server is refusing it", shamed.sent.length === 0, `${shamed.sent.length} sent`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
