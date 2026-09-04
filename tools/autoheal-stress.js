// Long-running checks: the shame invariant against a modelled server, the
// integration surface the rest of the client calls, and the per-tick cost.
const h = require('./autoheal-harness.js');
const { M, makeClient, check, tick, report, clock } = h;

// ===========================================================================
// INTEGRATION SURFACE — everything the rest of the client reaches for
// ===========================================================================
(function surface() {
  const w = makeClient({ my: { health: 100, food: 0 } });
  const ah = w.ah;
  const needed = [ 'recordDamage', 'recordHit', 'recordShoot', 'healthUpdate',
                   'noteConsume', 'postTick', 'reset' ];
  for (const name of needed) {
    check('surface · ' + name + '()', typeof ah[name] === 'function', typeof ah[name]);
  }
  const fields = [ 'blockBreak', 'forceHeal', 'gearAsserted', 'healsSent', 'moduleName' ];
  for (const name of fields) {
    check('surface · ' + name, ah[name] !== undefined, String(ah[name]));
  }
  // reset() must be safe before the first tick and after one
  ah.reset();
  tick(w, 1);
  ah.reset();
  check('surface · reset is idempotent', ah.healsSent === 0 && ah.blockBreak === false);
  // healthUpdate is called on every health packet, including at full health
  ah.healthUpdate(100);
  ah.healthUpdate(37);
  check('surface · healthUpdate tolerates any value', true);
})();

// ===========================================================================
// THE INVARIANT — 200 runs against a server model, wide RTT spread
// ===========================================================================
(function shameNeverEight() {
  let rng = 20260904;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let worst = 0, lockouts = 0, scrubs = 0, payments = 0, deaths = 0, ticks = 0;

  for (let run = 0; run < 200; run++) {
    const rtt = 30 + rand() * 270;                 // 30ms .. 300ms
    const style = run % 4;                          // four combat shapes
    const server = { shame: 0, hitTime: 0, timer: 0 };
    const w = makeClient({ my: { health: 100, food: 0 } });
    const heals = [], counter = [], inbound = [];

    w.client.SocketManager.pong = Math.round(rtt);
    // Every consume goes to the server model instead of vanishing.
    w.mh._rawHeal = function () {
      this.rawHeals += 1;
      w.packets.count += 3;
      w.ah.noteConsume();
      heals.push(clock.get() + rtt / 2);       // uplink
    };

    let engaged = 0, closing = 0;
    for (let t = 0; t < 500; t++) {
      ticks += 1;
      const now = clock.get();

      // --- server: consumes that have arrived -------------------------
      while (heals.length && heals[0] <= now) {
        heals.shift();
        if (server.timer > 0) continue;            // discarded during lockout
        if (!server.hitTime) continue;
        const gap = now - server.hitTime;
        server.hitTime = 0;
        if (gap <= 120) {
          server.shame += 1;
          payments += 1;
          if (server.shame >= 8) { server.timer = 3e4; server.shame = 0; lockouts += 1; }
        } else {
          server.shame = Math.max(0, server.shame - 2);
          scrubs += 1;
        }
        if (server.shame > worst) worst = server.shame;
      }
      if (server.timer > 0) server.timer = Math.max(0, server.timer - 111);

      // --- damage, in four shapes -------------------------------------
      // Damage only exists while an enemy is engaged, and while one is engaged
      // the client sees them: potentialDamage is non-zero every tick of it.
      // Anything else would be an adversary that can hit without being in
      // range, which is not a thing the game can produce.
      if (engaged > 0) engaged -= 1;
      else if (style === 0) { if (rand() < .30) engaged = 6 + Math.floor(rand() * 25); }
      else if (style === 1) { if (rand() < .08) engaged = 4 + Math.floor(rand() * 8); }
      else if (style === 2) { if (rand() < .04) engaged = 10 + Math.floor(rand() * 40); }
      else if (t % 60 === 0) engaged = 12;
      const hostile = engaged > 0;
      // An enemy has to be in range before they can swing, and the client sees
      // them there for the tick or two it takes them to close and wind up. An
      // adversary that materialises in reach and lands a hit in the same
      // instant is not something the game can produce.
      closing = hostile ? closing + 1 : 0;
      let damage = 0;
      if (hostile && closing > 2 && rand() < .55) damage = [ 20, 30, 35, 45, 67.5, 25, 50 ][Math.floor(rand() * 7)];
      if (w.my.hatID === M.AH.BULL && t % 9 === 0) damage = Math.max(damage, 5);

      if (damage > 0) {
        server.hitTime = now;
        // the client is told half a round trip later, like the health packet
        inbound.push({ at: now + rtt / 2, damage: damage });
      }
      while (inbound.length && inbound[0].at <= now) {
        const hit = inbound.shift();
        w.my.tempHealth -= hit.damage;
        if (w.my.tempHealth <= 0) { deaths += 1; w.my.tempHealth = 100; }
        w.my.currentHealth = w.my.tempHealth;
        w.ah.recordDamage(hit.damage);
      }
      // heals that landed restore health a tick later
      if (w.mh.rawHeals > 0) {
        w.my.tempHealth = Math.min(100, w.my.tempHealth + 20 * w.mh.rawHeals);
        w.my.currentHealth = w.my.tempHealth;
      }

      // --- the counter, one round trip behind -------------------------
      counter.push({ at: now + rtt / 2, value: server.shame, active: server.timer > 0 });
      while (counter.length && counter[0].at <= now) {
        const seen = counter.shift();
        w.my.shameCount = seen.value;
        w.my.shameActive = seen.active;
      }

      w.em.potentialDamage = hostile ? 20 + rand() * 60 : 0;   // an enemy in range is visible
      w.em.detectedEnemy = hostile;
      w.em.detectedDangerEnemy = hostile && rand() < .2;
      w.em.collidingSpike = hostile && rand() < .1;
      w.mh.rawHeals = 0;
      w.packets.count = Math.max(0, w.packets.count - 13);
      tick(w, 1);
      if (w.ah.plan.hat !== null) w.my.hatID = w.ah.plan.hat;
    }
  }
  check('invariant · the server counter never reached 8', lockouts === 0, 'lockouts=' + lockouts);
  check('invariant · peak shame stayed at or under 7', worst <= 7, 'worst=' + worst);
  check('invariant · the scrubber works', scrubs > 0, 'scrubs=' + scrubs);
  console.log('  [sim] ' + ticks + ' ticks · peak shame ' + worst + ' · scrubs ' + scrubs +
              ' · increments ' + payments + ' · lockouts ' + lockouts + ' · deaths ' + deaths);
})();

// ===========================================================================
// A CONSUME FROM ANOTHER MODULE keeps the mirror true
// ===========================================================================
(function foreignConsume() {
  const w = makeClient({ my: { health: 100, food: 0, shame: 3 } });
  w.ah.recordDamage(20);
  clock.advance(400);
  // the manual placer eats, not this module
  w.mh._rawHeal();
  check('foreign consume · the banked hit is spent', w.ah.shame.hitAt === 0);
  check('foreign consume · counted as unconfirmed', w.ah.shame.pending === 1, 'pending=' + w.ah.shame.pending);
  const before = w.mh.rawHeals;
  tick(w, 1);
  check('foreign consume · no double scrub for the same hit', w.mh.rawHeals === before, 'heals=' + (w.mh.rawHeals - before));
})();

// ===========================================================================
// COST PER TICK
// ===========================================================================
(function perf() {
  const enemies = [];
  for (let i = 0; i < 8; i++) enemies.push({ x: 80 + i * 70, y: 0, primary: 5, secondary: 15, hatID: 53, canPlaceSpike: true, spikeDamage: 45 });
  const projectiles = [];
  for (let i = 0; i < 6; i++) projectiles.push({ pos: { current: h.vec(150 + i * 40, 0) }, speed: 1.5, damage: 25, life: 9, isTurret: true });
  const w = makeClient({
    my: { health: 60, food: 0, shame: 2 },
    enemies: enemies,
    projectiles: projectiles,
    em: { potentialDamage: 70, potentialSpikeDamage: 45, possibleToKnockback: true, detectedEnemy: true }
  });
  const N = 20000;
  const start = process.hrtime.bigint();
  for (let i = 0; i < N; i++) {
    if (i % 3 === 0) w.ah.recordDamage(35);
    w.packets.count = 0;
    tick(w, 1);
  }
  const us = Number(process.hrtime.bigint() - start) / N / 1000;
  check('perf · a worst-case tick stays well under a frame', us < 200, us.toFixed(1) + 'us');
  console.log('  [perf] ' + us.toFixed(1) + 'us per tick, 8 enemies + 6 bolts (server ticks are 111000us apart)');
})();

report();
