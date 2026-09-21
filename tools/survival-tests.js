"use strict";
const { World, M } = require("./survival-world.js");
const T = M.T;

let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail) {
  if (cond) { pass++; results.push("  PASS  " + name); }
  else { fail++; results.push("  FAIL  " + name + (detail ? "  -> " + detail : "")); }
}
function run(name, fn) {
  results.push("\n[" + name + "]");
  try { fn(); } catch (e) { fail++; results.push("  FAIL  threw: " + e.stack.split("\n").slice(0, 3).join(" | ")); }
}
const tiers = w => w.log.map(l => l.name);
const totalHeals = w => w.heals.length;

// ── 1. Full HP / no threat ─────────────────────────────────────────────────
run("1 full HP, no threat", () => {
  const w = new World();
  for (let i = 0; i < 20; i++) w.tick();
  check("no food sent", totalHeals(w) === 0);
  check("stays IDLE", w.log.every(l => l.tier === T.IDLE));
  check("no packets reserved", w.log.every(l => l.reserve === 0));
  check("state SAFE", w.log.every(l => l.state === "SAFE"));
});

// ── 2. Low HP, nothing on screen ───────────────────────────────────────────
run("2 low HP, quiet", () => {
  const w = new World();
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 20;
  w.myPlayer.previousHealth = 20;
  for (let i = 0; i < 6; i++) w.tick();
  check("healed", totalHeals(w) > 0, "heals=" + totalHeals(w));
  check("reached CRITICAL tier", w.log.some(l => l.tier === T.CRITICAL), tiers(w).join(","));
  check("back to full", w.myPlayer.currentHealth === 100, "hp=" + w.myPlayer.currentHealth);
});

// ── 3/4. One melee hit, then repeated melee ────────────────────────────────
run("3 one melee hit", () => {
  const w = new World();
  const e = w.addEnemy({ x: 100, y: 0, primary: 5, hat: 7 });
  e.reload[0].current = 7;
  e.angle = Math.PI;                  // looking at us
  w.damage(67.5);                 // polearm 45 * bull 1.5
  e.lastAttacked = w.myPlayer.tickCount;
  w.tick();
  const attributed = w.core.book.swings.length;
  check("swing attributed to the enemy", attributed === 1, "swings=" + attributed + " unknown=" + w.core.book.unattributed.length);
  check("something was planned", w.core.healPriority !== T.IDLE, M.names[w.core.healPriority]);
});

run("4 repeated melee, bull polearm", () => {
  const w = new World();
  const e = w.addEnemy({ x: 100, y: 0, primary: 5, hat: 7 });
  e.angle = Math.PI;
  let died = false;
  for (let i = 0; i < 24; i++) {
    if (i % 7 === 0) {                  // polearm is a 7-tick weapon
      w.damage(67.5);
      e.lastAttacked = w.myPlayer.tickCount;
      e.reload[0].current = 0;
    }
    w.tick();
    if (w.myPlayer.currentHealth <= 0) died = true;
  }
  check("survived", !died, "hp=" + w.myPlayer.currentHealth);
  check("shame held at 0", w.myPlayer.shameCount === 0, "shame=" + w.myPlayer.shameCount + " active=" + w.myPlayer.shameActive);
  check("never shame-locked", !w.myPlayer.shameActive);
});

// ── 5. Poison ──────────────────────────────────────────────────────────────
run("5 poison", () => {
  const w = new World();
  w.myPlayer.poisonCount = 5;
  w.damage(5);                        // a poison tick
  w.tick();
  check("poison recognised", w.core.book.poison.active, JSON.stringify(w.core.book.poison));
  check("status bucket, not unknown", w.core.book.status.length === 1 && w.core.book.unattributed.length === 0);
  // the next DoT boundary must appear on the curve
  const scheduled = w.core.board.threats.filter(t => t.kind === "poison");
  check("poison scheduled ahead", scheduled.length > 0, "n=" + scheduled.length);
  check("scheduled a full period out", scheduled.every(t => t.tick > 0 && t.tick <= M.consts.HORIZON), scheduled.map(t => t.tick).join(","));
  // and it walks in as the period elapses
  for (let i = 0; i < 4; i++) w.tick();
  const closer = w.core.board.threats.filter(t => t.kind === "poison");
  check("closer as the loop comes round", closer.length > 0 && closer[0].tick < M.consts.DOT, closer.map(t => t.tick).join(","));
});

// ── 6. Spike contact, repeated ─────────────────────────────────────────────
run("6 spike tick", () => {
  const w = new World();
  w.addSpike(60, 0, 9);               // spinning spikes, 45
  w.myPlayer.isTrapped = true;
  let sentTotal = 0;
  for (let i = 0; i < 10; i++) {
    w.damage(45);
    sentTotal += w.tick();
  }
  check("spike contact seen", w.core.board.collidingSpike);
  check("streak counted", w.core.book.spikeStreak > 1, "streak=" + w.core.book.spikeStreak);
  check("healed through it", sentTotal > 0, "sent=" + sentTotal);
  check("survived 10 spike ticks", w.myPlayer.currentHealth > 0, "hp=" + w.myPlayer.currentHealth);
  const repeating = w.core.board.threats.some(t => t.kind === "spikeTick" && t.repeat > 0);
  check("spike modelled as repeating", repeating);
});

// ── 7. Trap + spike behind it ──────────────────────────────────────────────
run("7 trap break into spike", () => {
  const w = new World();
  const trap = w.addTrap(0, 0);
  w.addSpike(40, 0, 9);
  w.myPlayer.isTrapped = true;
  w.myPlayer.trappedIn = trap;
  trap.tempHealth = 20;               // one swing from breaking
  const e = w.addEnemy({ x: 90, y: 0, primary: 5, hat: 7 });
  e.reload[0].current = 7;
  w.tick();
  const found = w.core.board.threats.some(t => t.kind === "trapBreak");
  check("trap break forecast", found, w.core.board.threats.map(t => t.kind).join(","));
});

// ── 8/9/10. Turret, musket, musket + follow-up ─────────────────────────────
run("8 turret in flight", () => {
  const w = new World();
  const e = w.addEnemy({ x: 300, y: 0, hat: 53 });
  w.addProjectile(150, 0, 1, e.id);
  w.tick();
  const t = w.core.board.threats.find(x => x.kind === "turretShot");
  check("turret shot on the board", !!t, w.core.board.threats.map(x => x.kind).join(","));
  check("arrival computed from speed", t && t.tick >= 0 && t.tick <= 2, t && "tick=" + t.tick);
  check("marked as turret damage (EMP answers it)", t && t.turret === true);
});

run("9 musket ready at range", () => {
  const w = new World();
  const e = w.addEnemy({ x: 400, y: 0, primary: 5, secondary: 15, sReload: 14 });
  e.angle = Math.atan2(0 - 0, 0 - 400);   // looking at us
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 55;
  w.tick();
  const t = w.core.board.threats.find(x => x.kind === "rangedReady");
  check("loaded musket is a threat", !!t, w.core.board.threats.map(x => x.kind).join(","));
  check("50 damage before our hat", t && Math.abs(t.amount - 50) < 0.01, t && "amt=" + t.amount);
  check("flagged as an insta at 55hp", t && t.insta === true);
});

run("10 musket then melee follow-up", () => {
  const w = new World();
  const e = w.addEnemy({ x: 130, y: 0, primary: 5, secondary: 15, hat: 7, sReload: 14, pReload: 7 });
  e.angle = Math.PI;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 90;
  w.tick();
  check("lethal inside the horizon", w.core.forecast.lethalTick !== -1, "min=" + w.core.forecast.minHP + " worst=" + w.core.forecast.worstTotal);
  check("pre-heals or better", w.core.healPriority >= T.PREHEAL, M.names[w.core.healPriority]);
  check("packets reserved", w._ModuleHandler.healReserve > 0, "reserve=" + w._ModuleHandler.healReserve);
});

// ── 11. Musketbow insta ────────────────────────────────────────────────────
run("11 musketbow insta", () => {
  const w = new World();
  const e = w.addEnemy({ x: 450, y: 0, primary: 5, secondary: 15, rangedBowInsta: true });
  w.tick();
  const t = w.core.board.threats.find(x => x.kind === "musketBowInsta");
  check("sequence on the board", !!t, w.core.board.threats.map(x => x.kind).join(","));
  check("both shots counted", t && Math.abs(t.amount - 75) < 0.01, t && "amt=" + t.amount);
  check("flagged insta", t && t.insta === true);
  check("board reports an insta", w.core.board.instaSeen);
});

// ── 12. Reverse insta ──────────────────────────────────────────────────────
run("12 reverse insta promotes, it does not re-count", () => {
  // The same board, with and without RYN's reverseInsta flag. A sequence is the
  // same weapons landing together, so the damage must not change — only the
  // confidence and the timing.
  const plain = new World({ canPlace: false });
  const ep = plain.addEnemy({ x: 120, y: 0, primary: 5, secondary: 10, hat: 7 });
  ep.angle = Math.PI;
  plain.myPlayer.currentHealth = plain.myPlayer.tempHealth = 80;
  plain.tick();
  const plainSum = plain.core.board.threats.reduce((a, t) => a + t.amount, 0);

  const w = new World({ canPlace: false });
  const e = w.addEnemy({ x: 120, y: 0, primary: 5, secondary: 10, hat: 7, reverseInsta: true });
  e.angle = Math.PI;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 80;
  w.tick();
  const instas = w.core.board.threats.filter(t => t.insta);
  const sum = w.core.board.threats.reduce((a, t) => a + t.amount, 0);
  check("existing threats marked insta", instas.length >= 1, w.core.board.threats.map(t => t.kind + ":" + t.insta).join(","));
  check("damage not double counted", Math.abs(sum - plainSum) < 0.01, plainSum + " -> " + sum);
  check("confidence raised", w.core.board.threats.every(t => t.source !== e || t.p >= 0.78));
  check("board reports an insta", w.core.board.instaSeen);
  check("pre-heals or better", w.core.healPriority >= T.PREHEAL, M.names[w.core.healPriority]);
});

// ── 13. Dagger spam + bull ─────────────────────────────────────────────────
run("13 dagger spam + bull", () => {
  const w = new World();
  const e = w.addEnemy({ x: 60, y: 0, primary: 7, hat: 7 });
  e.reload[0].max = 1; e.reload[0].current = 1;
  e.angle = Math.PI;
  w.tick();
  const burst = w.core.board.threats.filter(x => x.kind === "daggerSpam");
  check("burst modelled, not one swing", burst.length >= 3, "n=" + burst.length);
  check("30 a hit under bull", burst.every(t => Math.abs(t.amount - 30) < 0.01), burst.map(t => t.amount).join(","));
  let died = false;
  for (let i = 0; i < 20; i++) {
    w.damage(30); e.lastAttacked = w.myPlayer.tickCount;
    w.tick();
    if (w.myPlayer.currentHealth <= 0) { died = true; break; }
  }
  check("survived 20 ticks of it", !died, "hp=" + w.myPlayer.currentHealth);
});

// ── 14/15. Velocity tick, and spike + velocity together ────────────────────
run("14/15 velocity tick", () => {
  const w = new World();
  const e = w.addEnemy({ x: 400, y: 0, primary: 5, hat: 53, pReload: 7, tReload: 10 });
  e.moveTo(280, 0);                    // closing; future lands inside 150..350
  w.tick();
  const t = w.core.board.threats.find(x => x.kind === "velocityTick");
  check("velocity tick detected", !!t, w.core.board.threats.map(x => x.kind).join(","));
  check("counts swing + turret", t && t.amount > 45, t && "amt=" + t.amount);
  check("flagged insta", t && t.insta === true);

  const w2 = new World();
  w2.addSpike(60, 0, 9);
  const e2 = w2.addEnemy({ x: 400, y: 0, primary: 5, hat: 53, pReload: 7, tReload: 10 });
  e2.moveTo(280, 0);
  w2.damage(45);
  w2.tick();
  const kinds = w2.core.board.threats.map(x => x.kind);
  check("spike and velocity both on one board", kinds.includes("velocityTick") && kinds.some(k => k.indexOf("spike") === 0), kinds.join(","));
});

// ── 16. Turret + insta ─────────────────────────────────────────────────────
run("16 turret + insta", () => {
  const w = new World({ canPlace: false });
  const e = w.addEnemy({ x: 130, y: 0, primary: 5, hat: 53, pReload: 7, tReload: 23 });
  e.angle = Math.PI;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 70;
  w.tick();
  const kinds = w.core.board.threats.map(x => x.kind);
  check("turret counted", kinds.includes("turret"), kinds.join(","));
  check("melee counted", kinds.includes("melee"));
  const turretShare = w.core.board.threats.filter(t => t.turret).reduce((a, t) => a + t.amount, 0);
  check("turret share measurable for the EMP decision", turretShare > 0, "share=" + turretShare);
});

// ── 17/18. Multiple enemies, simultaneous damage ───────────────────────────
run("17/18 four enemies at once", () => {
  const w = new World();
  const a = w.addEnemy({ x: 120, y: 0, primary: 5, hat: 7 });
  const b = w.addEnemy({ x: -120, y: 0, primary: 7, hat: 7 });
  const c = w.addEnemy({ x: 0, y: 300, primary: 5, hat: 53, tReload: 23 });
  const d = w.addEnemy({ x: 0, y: -400, primary: 5, secondary: 15, sReload: 14 });
  a.angle = Math.PI; b.angle = 0; d.angle = Math.PI / 2;
  w.addSpike(50, 0, 9);
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 85;
  w.tick();
  const sources = new Set(w.core.board.threats.map(t => t.source).filter(Boolean));
  check("every enemy contributes", sources.size >= 3, "sources=" + sources.size);
  check("combined forecast is lethal", w.core.forecast.lethalTick !== -1, "worst=" + w.core.forecast.worstTotal);
  check("emergency response", w.core.healPriority >= T.LETHAL, M.names[w.core.healPriority]);
  check("state escalates", ["EMERGENCY", "HIGH_THREAT", "INSTA_DEFENSE"].includes(w.core.state), w.core.state);
});

// ── 19/20. High ping and high jitter ───────────────────────────────────────
run("19 high ping: the shame window closes", () => {
  const lows = new World({ ping: 20 });
  for (let i = 0; i < 4; i++) { lows.ping = 20; lows.tick(); }
  const highs = new World({ ping: 150 });
  for (let i = 0; i < 4; i++) { highs.ping = 150; highs.tick(); }
  check("20ms ping still has a wait", lows.core.clock.shameFreeAfterMs() > 80, "wait=" + lows.core.clock.shameFreeAfterMs().toFixed(1));
  check("150ms ping has none", highs.core.clock.shameFreeAfterMs() === 0, "wait=" + highs.core.clock.shameFreeAfterMs().toFixed(1));
  check("lead grows with ping", highs.core.clock.leadTicks > lows.core.clock.leadTicks,
    lows.core.clock.leadTicks + " vs " + highs.core.clock.leadTicks);
});

run("20 jitter widens the margin, bounded", () => {
  const w = new World({ ping: 60 });
  const pings = [60, 300, 55, 280, 70, 310, 50];
  for (const p of pings) { w.ping = p; w.tick(); w.tick(); }
  check("jitter measured", w.core.clock.jitter > 0, "jitter=" + w.core.clock.jitter.toFixed(1));
  check("jitter margin capped", w.core.clock.jitterMargin <= 60, "margin=" + w.core.clock.jitterMargin.toFixed(1));
  check("lead stays bounded", w.core.clock.leadTicks <= 3, "lead=" + w.core.clock.leadTicks);
});

// ── 21. Packet pressure ────────────────────────────────────────────────────
run("21 packet pressure and reservation", () => {
  const w = new World();
  const e = w.addEnemy({ x: 120, y: 0, primary: 5, secondary: 15, hat: 7, sReload: 14, pReload: 7 });
  e.angle = Math.PI;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 70;
  w._ModuleHandler.packetCount = 100;      // a busy building second
  w.tick();
  check("reserve taken", w._ModuleHandler.healReserve > 0, "reserve=" + w._ModuleHandler.healReserve);
  check("placers see a smaller limit", w._ModuleHandler.packetLimit < w._ModuleHandler.packetLimitRaw,
    w._ModuleHandler.packetLimit + " < " + w._ModuleHandler.packetLimitRaw);
  check("lethal heal still went out", w.heals.length > 0, "heals=" + w.heals.length);

  // and the starved case: the raw allowance itself is gone
  const s = new World();
  s._ModuleHandler.packetCount = 119;
  s.myPlayer.currentHealth = s.myPlayer.tempHealth = 20;
  s.tick();
  check("no packets, no send", s.heals.length === 0);
  check("state reports starvation", s.core.state === "PACKET_STARVED", s.core.state);
});

// ── 22/23/24/25. Shame ─────────────────────────────────────────────────────
// The server only moves the shame count when it still has a hit stamped on you
// (`if (this.hitTime)`), so nothing an untouched player eats changes it. The
// one way to arm it on purpose is the Bull Helmet's -5 a second, which is
// exactly what ShameReset puts on and what SurvivalCore's shouldResetShame
// gates. This models that loop: bull goes on when the module says the tick is
// quiet enough for it, and its self-damage arms the window the drain spends.
function shameRun(startShame, ping, ticks, pressure) {
  const w = new World({ ping });
  w.myPlayer.shameCount = startShame;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 60;
  let e = null;
  if (pressure) {
    e = w.addEnemy({ x: 110, y: 0, primary: 5, hat: 7 });
    e.angle = Math.PI;
  }
  let bullOn = false;
  for (let i = 0; i < ticks; i++) {
    if (pressure && i % 7 === 0) { w.damage(20); e.lastAttacked = w.myPlayer.tickCount; }
    // ShameReset's own gate, on this module's answer.
    if (w.core.shouldResetShame) bullOn = true;
    if (bullOn && w.myPlayer.tickCount % 9 === 0) {
      w.damage(5);                    // Hats[7].healthRegen = -5, on the 1s loop
      bullOn = false;
    }
    w.tick();
  }
  return w;
}
run("22 shame = 1", () => {
  const w = shameRun(1, 70, 40, false);
  check("count reaches 0", w.myPlayer.shameCount === 0, "shame=" + w.myPlayer.shameCount);
  check("never locked out", !w.myPlayer.shameActive);
});
run("23 shame = 2", () => {
  const w = shameRun(2, 70, 50, false);
  check("count reaches 0", w.myPlayer.shameCount === 0, "shame=" + w.myPlayer.shameCount);
});
run("24 shame > 5", () => {
  const w = shameRun(6, 70, 140, false);
  check("count reaches 0", w.myPlayer.shameCount === 0, "shame=" + w.myPlayer.shameCount);
  check("never locked out", !w.myPlayer.shameActive);
});
run("25/26 shame rising under pressure, damage while reducing", () => {
  const w = shameRun(5, 70, 120, true);
  check("count comes down under fire", w.myPlayer.shameCount <= 1, "shame=" + w.myPlayer.shameCount);
  check("never locked out", !w.myPlayer.shameActive);
  check("survived", w.myPlayer.currentHealth > 0, "hp=" + w.myPlayer.currentHealth);
});
run("22b at the wall, a chargeable heal is refused", () => {
  const w = new World({ ping: 20 });
  for (let i = 0; i < 3; i++) w.tick();        // let the clock settle at 20ms
  w.myPlayer.shameCount = 7;
  w.damage(40);                                 // arms the window
  const before = w.heals.length;
  w.tick();                                     // inside 120 - 20 = 100ms
  check("no charged burst at 7", w.heals.length === before, "sent=" + (w.heals.length - before));
  check("food is held instead", w.core.healingDelay > 0 || w.core.healPriority === T.IDLE, "hold=" + w.core.healingDelay);
  for (let i = 0; i < 4; i++) w.tick();
  check("eats once the window passes", w.heals.length > before, "heals=" + w.heals.length);
  check("count came down, not up", w.myPlayer.shameCount < 7 && !w.myPlayer.shameActive, "shame=" + w.myPlayer.shameCount);
});
run("22c shame drain at full health", () => {
  const w = new World({ ping: 70 });
  for (let i = 0; i < 3; i++) w.tick();
  w.myPlayer.shameCount = 4;
  w.damage(20);
  for (let i = 0; i < 3; i++) w.tick();         // heal back to full
  const shameAfterRecovery = w.myPlayer.shameCount;
  w.damage(20);
  for (let i = 0; i < 4; i++) w.tick();
  check("full health and still draining", w.myPlayer.currentHealth === 100 && w.myPlayer.shameCount < shameAfterRecovery,
    "hp=" + w.myPlayer.currentHealth + " shame=" + shameAfterRecovery + "->" + w.myPlayer.shameCount);
});

// ── 27/28. Unknown damage ──────────────────────────────────────────────────
run("27 unknown damage is kept", () => {
  const w = new World();
  w.damage(13.7);                  // nothing in the tables produces this
  w.tick();
  check("not silently dropped", w.core.book.unattributed.length === 1, JSON.stringify(w.core.book.unattributed));
  check("state reports it", w.core.state === "UNKNOWN_THREAT", w.core.state);
});
run("28 repeated unknown damage is learned and scheduled", () => {
  const w = new World();
  for (let round = 0; round < 4; round++) {
    w.damage(13.7);
    w.tick();
    w.tick();
    w.tick();
  }
  const model = w.core.book.unknown;
  check("interval learned", model.interval === 3, "interval=" + model.interval);
  check("amount learned", Math.abs(model.amount - 13.7) < 0.01, "amount=" + model.amount);
  check("confidence raised", model.confidence > 0, "p=" + model.confidence);
  const scheduled = w.core.board.threats.filter(t => t.kind === "unknown");
  check("scheduled onto the forecast", scheduled.length > 0, "n=" + scheduled.length);
  // and it expires
  for (let i = 0; i < 100; i++) w.tick();
  const stale = w.core.board.threats.filter(t => t.kind === "unknown");
  check("expires when it stops happening", stale.length === 0, "n=" + stale.length);
});

// ── 29. Recovery ───────────────────────────────────────────────────────────
run("29 recovery after danger", () => {
  const w = new World();
  const e = w.addEnemy({ x: 110, y: 0, primary: 5, hat: 7 });
  e.angle = Math.PI;
  w.damage(60);
  for (let i = 0; i < 3; i++) w.tick();
  w.enemies.length = 0;
  w.PlayerManager.players.length = 0;
  for (let i = 0; i < 12; i++) w.tick();
  check("back to full", w.myPlayer.currentHealth === 100, "hp=" + w.myPlayer.currentHealth);
  check("no shame paid for it", w.myPlayer.shameCount === 0, "shame=" + w.myPlayer.shameCount);
  const idleTail = w.log.slice(-4).every(l => l.tier === T.IDLE && l.sent === 0);
  check("stops when it is done", idleTail, w.log.slice(-4).map(l => l.name + ":" + l.sent).join(","));
});

// ── 30-34. Cross-system: the reservation is the contract ───────────────────
run("30-34 other systems see the reservation", () => {
  const w = new World();
  const e = w.addEnemy({ x: 120, y: 0, primary: 5, secondary: 15, hat: 7, sReload: 14, pReload: 7 });
  e.angle = Math.PI;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 70;
  w.tick();
  const mh = w._ModuleHandler;
  const budgetAsPlacersSeeIt = mh.packetLimit - mh.packetCount;
  const budgetRaw = mh.packetLimitRaw - mh.packetCount;
  check("placers are held off", budgetAsPlacersSeeIt < budgetRaw, budgetAsPlacersSeeIt + " vs " + budgetRaw);
  check("reserve is a whole number of foods", mh.healReserve % M.consts.HEAL_PACKETS === 0, "reserve=" + mh.healReserve);
  const held = mh.healReserveTicks;
  check("held across ticks", held >= 1, "ticks=" + held);
  // and it is given back
  w.enemies.length = 0;
  w.PlayerManager.players.length = 0;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 100;
  for (let i = 0; i < 6; i++) w.tick();
  check("released when the threat is gone", mh.healReserve === 0, "reserve=" + mh.healReserve);
});

// ── 35/36/37. Stability ────────────────────────────────────────────────────
run("35/36 long session: bounded memory, no runaway", () => {
  const w = new World();
  const e = w.addEnemy({ x: 110, y: 0, primary: 5, hat: 7 });
  w.addSpike(55, 0, 9);
  e.angle = Math.PI;
  for (let i = 0; i < 6000; i++) {
    if (i % 5 === 0) { w.damage(20 + (i % 3) * 7); e.lastAttacked = w.myPlayer.tickCount; }
    if (i % 400 === 0) { w.myPlayer.currentHealth = w.myPlayer.tempHealth = 100; }
    if (i % 137 === 0) w.damage(11.3 + (i % 2));     // unexplainable, on purpose
    w.tick();
    w.log.length = 0;
  }
  const b = w.core.book;
  check("event ring bounded", b.events.length <= 48, "events=" + b.events.length);
  check("unknown samples bounded", b.unknown.samples.length <= 6, "n=" + b.unknown.samples.length);
  check("palette bounded", b._palette.size <= 96, "palette=" + b._palette.size);
  check("threat pool bounded", w.core.board._pool.length <= 128, "pool=" + w.core.board._pool.length);
  check("death log bounded", b.deathLog.length <= 24, "deaths=" + b.deathLog.length);
  check("no shame lockout over 6000 ticks", !w.myPlayer.shameActive, "shame=" + w.myPlayer.shameCount);
});

run("37 cost per tick", () => {
  const w = new World();
  for (let i = 0; i < 6; i++) {
    const e = w.addEnemy({ x: 100 + i * 40, y: i * 30, primary: 5, hat: i % 2 ? 7 : 53, secondary: i % 3 === 0 ? 15 : 10 });
    e.angle = Math.PI;
  }
  for (let i = 0; i < 14; i++) w.addSpike(60 + i * 20, (i % 5) * 30, 9);
  w.myPlayer.isTrapped = true;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 60;
  for (let i = 0; i < 200; i++) w.tick();           // warm
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 2000; i++) { if (i % 4 === 0) w.damage(20); w.tick(); w.log.length = 0; }
  const t1 = process.hrtime.bigint();
  const perTick = Number(t1 - t0) / 2000 / 1e6;
  check("worst case under a millisecond a tick", perTick < 1.0, perTick.toFixed(4) + " ms/tick");
  results.push("        (" + perTick.toFixed(4) + " ms/tick, 6 enemies + 14 spikes + trapped)");

  const idle = new World();
  for (let i = 0; i < 200; i++) idle.tick();
  const i0 = process.hrtime.bigint();
  for (let i = 0; i < 20000; i++) { idle.tick(); idle.log.length = 0; }
  const i1 = process.hrtime.bigint();
  const idlePer = Number(i1 - i0) / 20000 / 1e6;
  check("idle path is free", idlePer < 0.02, idlePer.toFixed(5) + " ms/tick");
  results.push("        (" + idlePer.toFixed(5) + " ms/tick idle)");
});

// ── extra: the derivations that are new ────────────────────────────────────
run("X1 knockback impulse is not double counted", () => {
  const w = new World();
  // polearm knockback in RYN's table is 55.6 = (.3 + .2) * 111.1
  const k = M.Weapons[5].knockback;
  check("table carries the full impulse", Math.abs(k - 55.6) < 0.2, "k=" + k);
  // a spike 90 away is out of reach of a 55.6 shove but inside the old 88.9
  // 55.6 of shove leaves us 104px from a spike at 160 — clear of the 87px
  // collision radius. The old 33.3 + 55.6 = 88.9 would have put us inside it.
  w.addSpike(160, 0, 9);
  const e = w.addEnemy({ x: -100, y: 0, primary: 5, hat: 7, pReload: 7 });
  w.tick();
  const kb = w.core.board.threats.filter(t => t.kind === "knockbackSpike");
  check("no phantom knockback-into-spike at 160px", kb.length === 0, "n=" + kb.length);
  // and one at 50 is
  const w2 = new World();
  w2.addSpike(50, 0, 9);
  w2.addEnemy({ x: -100, y: 0, primary: 5, hat: 7, pReload: 7 });
  w2.tick();
  check("real one at 50px is caught", w2.core.board.threats.some(t => t.kind === "knockbackSpike"),
    w2.core.board.threats.map(t => t.kind).join(","));
});

run("X2 reflect damage from our own swing", () => {
  const w = new World();
  const e = w.addEnemy({ x: 100, y: 0, primary: 5, hat: 11, acc: 16 });   // spike gear + sawblade
  w._ModuleHandler.shouldAttack = true;
  w._ModuleHandler.weapon = 0;
  w.tick();
  const t = w.core.board.threats.find(x => x.kind === "reflect");
  check("reflect counted", !!t, w.core.board.threats.map(x => x.kind).join(","));
  // polearm base 45, spike gear .45 + sawblade .15 = .6 -> 27
  check("uses the raw weapon damage", t && Math.abs(t.amount - 27) < 0.01, t && "amt=" + t.amount);
});

run("X3 shield replaces the variant, and attribution still matches", () => {
  const w = new World();
  const e = w.addEnemy({ x: 100, y: 0, primary: 5, hat: 7, primaryVariant: 3 });
  e.angle = Math.PI;
  e.lastAttacked = 1;
  w.PlayerManager.lookingShield = () => true;
  // polearm 45 * bull 1.5 * shield .2 = 13.5, with no ruby multiplier
  w.damage(13.5);
  w.myPlayer.tickCount = 1;
  w.tick();
  check("shielded ruby hit is attributed", w.core.book.swings.length === 1,
    "swings=" + w.core.book.swings.length + " unknown=" + JSON.stringify(w.core.book.unattributed));
});

run("X4 confidence separates the two curves", () => {
  const w = new World();
  const e = w.addEnemy({ x: 800, y: 0, primary: 5, secondary: 15, sReload: 14 });
  e.angle = 0;                        // looking away: possible, not plausible
  w.tick();
  const t = w.core.board.threats.find(x => x.kind === "rangedReady");
  check("low confidence threat exists", !!t && t.p < 0.5, t && "p=" + t.p);
  check("it is on the expected curve", w.core.forecast.expectedTotal > 0, "exp=" + w.core.forecast.expectedTotal);
  check("but not on the worst case", w.core.forecast.worstTotal === 0, "worst=" + w.core.forecast.worstTotal);
  check("so nothing is spent on it", w.heals.length === 0);
});

run("X5 soldier decided by the forecast, not a flat number", () => {
  // 90 predicted, bare survivable at 95hp -> no soldier
  const a = new World({ canPlace: false });     // no ring spike available
  const ea = a.addEnemy({ x: 110, y: 0, primary: 5, hat: 7 });
  ea.angle = Math.PI;
  a.myPlayer.currentHealth = a.myPlayer.tempHealth = 95;
  a.tick();
  check("survivable bare: no soldier forced", !a.core.wantsSoldier, "worst=" + a.core.forecast.worstTotal);
  // same enemy at 60hp: lethal bare, survivable armoured -> soldier
  const b = new World({ canPlace: false });
  const eb = b.addEnemy({ x: 110, y: 0, primary: 5, hat: 7 });
  eb.angle = Math.PI;
  b.myPlayer.currentHealth = b.myPlayer.tempHealth = 60;
  b.tick();
  check("lethal bare, survivable armoured: soldier", b.core.wantsSoldier, "worst=" + b.core.forecast.worstTotal);
});

run("X6 EMP only when the turret share is what kills", () => {
  const w = new World({ canPlace: false });
  const e = w.addEnemy({ x: 130, y: 0, primary: 5, hat: 53, pReload: 7, tReload: 23 });
  e.angle = Math.PI;
  // Turret Gear carries no damage multiplier, so this is 45 melee + 25 turret
  // = 70. At 60hp that is lethal with the turret and survivable without it,
  // which is the whole of the EMP condition.
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 60;
  w.tick();
  check("EMP asked for", w.core.wantsEMP, "worst=" + w.core.forecast.worstTotal);
  const w2 = new World({ canPlace: false });
  const e2 = w2.addEnemy({ x: 130, y: 0, primary: 5, hat: 7 });   // no turret at all
  e2.angle = Math.PI;
  w2.myPlayer.currentHealth = w2.myPlayer.tempHealth = 60;
  w2.tick();
  check("not asked for without a turret", !w2.core.wantsEMP);
});

run("X7 shame reset gate is the forecast, not a zero sum", () => {
  const quiet = new World();
  quiet.myPlayer.shameCount = 3;
  quiet.myPlayer.currentHealth = quiet.myPlayer.tempHealth = 80;
  quiet.tick();
  check("quiet: bull is allowed", quiet.core.shouldResetShame);
  const busy = new World();
  busy.myPlayer.shameCount = 3;
  busy.myPlayer.currentHealth = busy.myPlayer.tempHealth = 80;
  const e = busy.addEnemy({ x: 110, y: 0, primary: 5, hat: 7 });
  e.angle = Math.PI;
  busy.tick();
  check("something incoming: bull refused", !busy.core.shouldResetShame);
  const lowHP = new World();
  lowHP.myPlayer.shameCount = 3;
  lowHP.myPlayer.currentHealth = lowHP.myPlayer.tempHealth = 4;
  lowHP.tick();
  check("bull's own -5 would kill: refused", !lowHP.core.shouldResetShame);
});

run("X8 no oscillation on a chip", () => {
  const w = new World();
  w.addSpike(60, 0, 6);          // 20 a tick
  w.myPlayer.isTrapped = true;
  let taken = 0;
  for (let i = 0; i < 40; i++) { w.damage(20); taken += 20; w.tick(); }
  const restore = M.Items[0].restore;
  const needed = Math.floor(taken / restore);
  check("survived", w.myPlayer.currentHealth > 0, "hp=" + w.myPlayer.currentHealth);
  // Oscillation is spending food the damage did not justify, not a duty cycle
  // matched to it. 20 a tick against 20-health apples is one apple a tick; a
  // system that flapped would spend well over that and hold the bar at 100.
  check("no food wasted on chatter", w.heals.length <= needed + 2, w.heals.length + " food for " + taken + " damage (need " + needed + ")");
  check("no send while already full", w.log.every(l => !(l.sent > 0 && l.hp >= 100)));
  // And the tier does not flap across the ladder: a steady chip stays in the
  // two tiers that answer a chip.
  const seen = new Set(w.log.map(l => l.name));
  check("tier stays in its band", [...seen].every(n => n === "CHIP" || n === "PREHEAL" || n === "IDLE"), [...seen].join(","));
  check("shame did not run away", !w.myPlayer.shameActive, "shame=" + w.myPlayer.shameCount);
});

run("X9 clowned: nothing is spent", () => {
  const w = new World();
  w.myPlayer.shameActive = true;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 30;
  const e = w.addEnemy({ x: 110, y: 0, primary: 5, hat: 7 });
  for (let i = 0; i < 8; i++) w.tick();
  check("no food while the server refuses it", w.heals.length === 0);
  check("state reports it", w.core.state === "CLOWNED", w.core.state);
  check("no packets reserved either", w._ModuleHandler.healReserve === 0);
});

run("X10 death and respawn resets cleanly", () => {
  const w = new World();
  const e = w.addEnemy({ x: 110, y: 0, primary: 5, hat: 7 });
  w.damage(60);
  w.tick();
  w.myPlayer.inGame = false;
  w.tick();
  check("reserve released on death", w._ModuleHandler.healReserve === 0);
  check("arm cleared", w.core.armedAt === -1);
  w.core.reset();
  w.myPlayer.inGame = true;
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 100;
  w.myPlayer.shameCount = 0;
  w.myPlayer.damages.length = 0;
  w.tick();
  check("clean after reset", w.core.healPriority === T.IDLE && w.core.book.events.length === 0);
});

run("X11 out of food: no packets wasted", () => {
  const w = new World();
  w.myPlayer.resources.food = 5;        // an apple costs 10
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 20;
  for (let i = 0; i < 5; i++) w.tick();
  check("nothing sent", w.heals.length === 0);
  w.myPlayer.resources.food = 100;
  w.tick();
  check("resumes when the food is back", w.heals.length > 0, "heals=" + w.heals.length);
});

run("X12 in-flight musket is healed for, not waited on", () => {
  const w = new World();
  const e = w.addEnemy({ x: 900, y: 0, primary: 5, secondary: 15, sReload: 0 });
  w.addProjectile(500, 0, 5, e.id);       // 50 damage, in the air
  w.myPlayer.currentHealth = w.myPlayer.tempHealth = 45;
  w.tick();
  const t = w.core.board.threats.find(x => x.kind === "projectile");
  check("shot in the air is on the board", !!t, w.core.board.threats.map(x => x.kind).join(","));
  check("confirmed, not guessed", t && t.p === 1);
  check("arrival from projectile speed", t && t.tick >= 1 && t.tick <= 2, t && "t+" + t.tick);
  check("answered with the hat", w.core.wantsSoldier, "soldier=" + w.core.wantsSoldier);
  // same shot, no room for the hat to save it
  const w2 = new World();
  const e2 = w2.addEnemy({ x: 900, y: 0, primary: 5, secondary: 15, sReload: 0 });
  w2.addProjectile(500, 0, 5, e2.id);
  w2.myPlayer.currentHealth = w2.myPlayer.tempHealth = 30;
  w2.tick();
  check("lethal recognised at 30hp", w2.core.forecast.lethalTick !== -1, "worst=" + w2.core.forecast.worstTotal);
  check("healed", w2.heals.length > 0);
});


// ── Anti-failure conditions ────────────────────────────────────────────────
// Everything the prompt lists as a way to break a survival system, thrown at it
// at once and at random: ping spikes, a full packet budget, simultaneous
// damage, enemies leaving and returning, projectiles vanishing, spikes placed
// and removed, the trap opening and closing, shame and health moving in ways
// the client did not cause, weapon and hat swaps, and object ids reused.
run("F1 chaos: 20000 ticks of everything going wrong", () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const w = new World();
  const pool = [];
  let threw = null;
  let deaths = 0;
  for (let i = 0; i < 20000; i++) {
    try {
      if (rnd() < 0.05) w.ping = Math.floor(rnd() * 400);
      if (rnd() < 0.08) w._ModuleHandler.packetCount = Math.floor(rnd() * 125);
      if (rnd() < 0.05 && w.enemies.length < 6) {
        const e = w.addEnemy({
          x: (rnd() - 0.5) * 600, y: (rnd() - 0.5) * 600,
          primary: [0, 4, 5, 7, 6][Math.floor(rnd() * 5)],
          secondary: [null, 10, 15, 9, 12][Math.floor(rnd() * 5)],
          hat: [0, 6, 7, 53, 11, 22][Math.floor(rnd() * 6)],
          acc: [0, 11, 16, 21][Math.floor(rnd() * 4)],
          pReload: Math.floor(rnd() * 8), tReload: Math.floor(rnd() * 24)
        });
        e.angle = rnd() * Math.PI * 2;
        e.usesTurret = rnd() < 0.3;
      }
      if (rnd() < 0.05 && w.enemies.length > 0) {
        const k = Math.floor(rnd() * w.enemies.length);
        const gone = w.enemies.splice(k, 1)[0];
        const pi = w.PlayerManager.players.indexOf(gone);
        if (pi !== -1) w.PlayerManager.players.splice(pi, 1);
        w.PlayerManager.playerData.delete(gone.id);
      }
      for (const e of w.enemies) {
        if (rnd() < 0.3) e.moveTo(e.pos.current.x + (rnd() - 0.5) * 60, e.pos.current.y + (rnd() - 0.5) * 60);
        if (rnd() < 0.05) e.hatID = [0, 6, 7, 53, 11][Math.floor(rnd() * 5)];
        if (rnd() < 0.05) e.weapon.primary = [0, 4, 5, 7, null][Math.floor(rnd() * 5)];
        if (rnd() < 0.05) e.weapon.secondary = [null, 10, 15, 9][Math.floor(rnd() * 4)];
        if (rnd() < 0.05) e.reverseInsta = rnd() < 0.5;
        if (rnd() < 0.05) e.rangedBowInsta = rnd() < 0.5;
        if (rnd() < 0.1) e.lastAttacked = w.myPlayer.tickCount;
      }
      if (rnd() < 0.1) {
        const o = w.addSpike((rnd() - 0.5) * 300, (rnd() - 0.5) * 300, [6, 7, 8, 9][Math.floor(rnd() * 4)]);
        pool.push(o);
      }
      if (rnd() < 0.1 && pool.length) {
        const o = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        w.objects.delete(o.id);
        const gi = w.grid.items.indexOf(o);
        if (gi !== -1) w.grid.items.splice(gi, 1);
        // id reuse, on purpose
        if (rnd() < 0.5) w.nextId = o.id;
      }
      if (rnd() < 0.08) { const p = w.addProjectile((rnd() - 0.5) * 500, (rnd() - 0.5) * 500, [0, 1, 2, 5][Math.floor(rnd() * 4)], w.enemies.length ? w.enemies[0].id : 999); pool.push(p); }
      if (rnd() < 0.15 && w.projectiles.size) { const it = w.projectiles.values().next().value; w.projectiles.delete(it); }
      if (rnd() < 0.08) { w.myPlayer.isTrapped = !w.myPlayer.isTrapped; w.myPlayer.trappedIn = w.myPlayer.isTrapped ? w.addTrap(0, 0) : null; }
      if (rnd() < 0.05) w.myPlayer.hatID = [0, 6, 7, 22, 23][Math.floor(rnd() * 5)];
      if (rnd() < 0.03) w.myPlayer.accessoryID = [0, 11, 13, 17][Math.floor(rnd() * 4)];
      if (rnd() < 0.02) w.myPlayer.inventory[2] = [0, 1, 2][Math.floor(rnd() * 3)];
      if (rnd() < 0.02) w.myPlayer.resources.food = Math.floor(rnd() * 200);
      if (rnd() < 0.25) w.damage(Math.round(rnd() * 60 * 100) / 100);
      // state arriving out of order / health moving on its own
      if (rnd() < 0.03) w.myPlayer.updateHealth(Math.min(100, w.myPlayer.currentHealth + Math.floor(rnd() * 40)));
      if (rnd() < 0.01) { w.myPlayer.shameActive = !w.myPlayer.shameActive; w.myPlayer.shameCount = Math.floor(rnd() * 9); }
      if (rnd() < 0.01) w.myPlayer.poisonCount = Math.floor(rnd() * 6);
      if (rnd() < 0.005) { w.myPlayer.inGame = false; w.tick(); w.core.reset(); w.myPlayer.inGame = true; w.myPlayer.currentHealth = w.myPlayer.tempHealth = 100; w.myPlayer.damages.length = 0; deaths++; }
      if (w.myPlayer.currentHealth <= 0) { w.myPlayer.currentHealth = w.myPlayer.tempHealth = 100; deaths++; }
      w.tick(rnd() < 0.05 ? 40 + rnd() * 300 : undefined);
      w.log.length = 0;
    } catch (e) { threw = e; break; }
  }
  check("never threw", threw === null, threw && threw.stack.split("\n").slice(0, 3).join(" | "));
  check("event ring still bounded", w.core.book.events.length <= 48, "n=" + w.core.book.events.length);
  check("threat pool still bounded", w.core.board._pool.length <= 128, "n=" + w.core.board._pool.length);
  check("palette still bounded", w.core.book._palette.size <= 96, "n=" + w.core.book._palette.size);
  check("threat list bounded", w.core.board.threats.length < 200, "n=" + w.core.board.threats.length);
  check("unknown samples bounded", w.core.book.unknown.samples.length <= 6);
  check("death log bounded", w.core.book.deathLog.length <= 24);
  check("reserve never runs away", w._ModuleHandler.healReserve <= M.consts.MAX_USES * M.consts.HEAL_PACKETS, "r=" + w._ModuleHandler.healReserve);
  check("no infinite heal loop", w.heals.length < 20000 * 2, "heals=" + w.heals.length);
  check("clock stayed sane", isFinite(w.core.clock.rtt) && w.core.clock.leadTicks <= 3 && w.core.clock.tickMs > 40, "rtt=" + w.core.clock.rtt.toFixed(1) + " tick=" + w.core.clock.tickMs.toFixed(1));
  results.push("        (" + deaths + " respawns, " + w.heals.length + " food over 20000 ticks)");
});

console.log(results.join("\n"));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail === 0 ? 0 : 1);
