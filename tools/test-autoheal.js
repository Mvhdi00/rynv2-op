'use strict';
const H = require('./autoheal-harness');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; failures.push(name + (detail ? '  -> ' + detail : ''));
}
function eq(name, got, want) { check(name, got === want, 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); }

// --------------------------------------------------------------------------
// 1. The shame rule itself, against the server's buildItem arithmetic.
// --------------------------------------------------------------------------
{
  const c = H.makeClient();
  const p = c.myPlayer;
  const t0 = 1000000;

  // No stamp: eating moves nothing.
  eq('shame/no-stamp delta', p.bookShameEat(t0, 0), 0);
  eq('shame/no-stamp count', p.shameCount, 0);

  // Inside the window: +1.
  p.takeDamage(20, t0);
  eq('shame/inside-window delta', p.bookShameEat(t0 + 50, 0), 1);
  eq('shame/inside-window count', p.shameCount, 1);

  // The eat cleared the stamp, so a second apple in the same batch is inert.
  eq('shame/batch second apple', p.bookShameEat(t0 + 60, 0), 0);
  eq('shame/batch count unchanged', p.shameCount, 1);

  // Past the window: -2, floored at zero.
  p.shameCount = 5;
  p.takeDamage(20, t0 + 1000);
  eq('shame/past-window delta', p.bookShameEat(t0 + 1000 + 200, 0), -2);
  eq('shame/past-window count', p.shameCount, 3);

  // Ping pushes the server-side elapsed over the line.
  p.shameCount = 3;
  p.takeDamage(20, t0 + 2000);
  eq('shame/ping crosses window', p.bookShameEat(t0 + 2000 + 60, 100), -2);

  // ...and a low-ping eat inside the window still costs a point.
  p.shameCount = 3;
  p.takeDamage(20, t0 + 3000);
  eq('shame/ping still inside', p.bookShameEat(t0 + 3000 + 60, 10), 1);

  // Clamp holds at both ends.
  p.shameCount = 0; p.takeDamage(20, t0 + 4000);
  p.bookShameEat(t0 + 4000 + 500, 0);
  eq('shame/floor at 0', p.shameCount, 0);
  p.shameCount = 7; p.takeDamage(20, t0 + 5000);
  p.bookShameEat(t0 + 5000 + 10, 0);
  eq('shame/ceiling clamp', p.shameCount, 7);

  // canDrain / stampPending are complements while a stamp is live.
  p.shameCount = 4; p.takeDamage(20, t0 + 6000);
  check('shame/stampPending inside', p.shameStampPending(t0 + 6000 + 50, 0));
  check('shame/canDrain not yet', !p.canDrainShame(t0 + 6000 + 50, 0));
  check('shame/canDrain after', p.canDrainShame(t0 + 6000 + 300, 0));
  check('shame/stampPending cleared', !p.shameStampPending(t0 + 6000 + 300, 0));
}

// --------------------------------------------------------------------------
// 2. Bull-tick detection survives the soldier multiplier.
// --------------------------------------------------------------------------
{
  const c = H.makeClient();
  const p = c.myPlayer;
  p.tickCount = 40;
  p.takeDamage(5, 1000);
  check('bull/plain -5 detected', p.isDmgOverTime);
  eq('bull/bullTick recorded', p.bullTick, 40);
  p.tickCount = 60;
  p.takeDamage(3.75, 2000);
  check('bull/soldier-scaled 3.75 detected', p.isDmgOverTime);
  eq('bull/bullTick moved', p.bullTick, 60);
  p.tickCount = 80;
  p.takeDamage(35, 3000);
  check('bull/real hit is not a dot', !p.isDmgOverTime);
  eq('bull/bullTick unchanged', p.bullTick, 60);
  // Cycle lands every ninth tick.
  p.tickCount = 60 + H.BULL_TICK_PERIOD;
  check('bull/tick time at +9', p.isBullTickTime());
  p.tickCount = 60 + 4;
  check('bull/not tick time at +4', !p.isBullTickTime());
}

// --------------------------------------------------------------------------
// 3. Every Anti, one at a time.
// --------------------------------------------------------------------------
const ANTI_CASES = [
  ['Anti Insta Kill', { detectedDangerEnemy: true, potentialDamage: 110 }, null, H.THREAT_INSTA],
  ['Anti Velocity Tick', { velocityTickThreat: true, primaryDamage: 60 }, null, H.THREAT_VELOCITY_TICK],
  ['Anti Reverse Insta', { reverseInsta: true, primaryDamage: 55, potentialDamage: 90 }, null, H.THREAT_REVERSE_INSTA],
  ['Anti Musket/Bow', { rangedBowInsta: true }, null, H.THREAT_MUSKET_BOW],
  ['Anti Primary+Musket/Bow', { potentialRangedDamage: 55, primaryDamage: 40 }, null, H.THREAT_PRIMARY_RANGED],
  ['Anti Knockback Tick', { possibleToKnockback: true, potentialSpikeKnockbackDamage: 45, primaryDamage: 40 }, null, H.THREAT_KNOCKBACK_TICK],
  ['Anti Spike Tick', { willCollideSpike: true, potentialSpikeDamage: 45, primaryDamage: 35 }, null, H.THREAT_SPIKE_TICK],
  ['Anti Turret', { nearestTurretEntity: { isPlayer: true, isReloaded: () => true }, primaryDamage: 45 }, null, H.THREAT_TURRET],
  ['Anti One Tick', { primaryDamage: 45 }, { turretDamage: 25 }, H.THREAT_ONE_TICK],
  ['Anti Spam Bow', {}, { arrowCount: 2, arrowDamage: 70 }, H.THREAT_SPAM_BOW],
  ['Anti Spam Daggers+Bull', { toolHammerInsta: true, primaryDamage: 38 }, null, H.THREAT_SPAM_DAGGER_BULL]
];
for (const [label, enemy, proj, flag] of ANTI_CASES) {
  const c = H.makeClient({ enemy, proj });
  const t = c.antiInsta._assessThreats(c.myPlayer, c.EnemyManager);
  check('anti/' + label + ' fires', (t.mask & flag) !== 0, 'mask=' + t.mask);
  check('anti/' + label + ' carries damage', t.damage > 0, 'damage=' + t.damage);
}
// Spike Push needs the trap as well as the push.
{
  const c = H.makeClient({ enemy: { pushingOnSpike: true, potentialSpikeDamage: 45, primaryDamage: 40 } });
  c.myPlayer.isTrapped = true;
  const t = c.antiInsta._assessThreats(c.myPlayer, c.EnemyManager);
  check('anti/Anti Spike Push fires', (t.mask & H.THREAT_SPIKE_PUSH) !== 0);
  const c2 = H.makeClient({ enemy: { pushingOnSpike: true, potentialSpikeDamage: 45 } });
  const t2 = c2.antiInsta._assessThreats(c2.myPlayer, c2.EnemyManager);
  check('anti/Anti Spike Push needs trap', (t2.mask & H.THREAT_SPIKE_PUSH) === 0);
}
// Anti Shame is self-inflicted and is not a "sequence".
{
  const c = H.makeClient();
  c.myPlayer.shameCount = H.SHAME_HIGH;
  const t = c.antiInsta._assessThreats(c.myPlayer, c.EnemyManager);
  check('anti/Anti Shame fires at high', (t.mask & H.THREAT_SHAME) !== 0);
  eq('anti/Anti Shame is not a sequence', t.sequences, 0);
}
// Quiet world: nothing fires.
{
  const c = H.makeClient();
  const t = c.antiInsta._assessThreats(c.myPlayer, c.EnemyManager);
  eq('anti/quiet mask', t.mask, 0);
  eq('anti/quiet damage', t.damage, 0);
}

// --------------------------------------------------------------------------
// 4. Several Antis at once resolve together, worst-case wins.
// --------------------------------------------------------------------------
{
  const c = H.makeClient({
    enemy: { velocityTickThreat: true, reverseInsta: true, rangedBowInsta: true,
      willCollideSpike: true, potentialSpikeDamage: 45, primaryDamage: 50, potentialDamage: 75 },
    proj: { turretDamage: 25, arrowCount: 3, arrowDamage: 90, totalDamage: 115 }
  });
  const t = c.antiInsta._assessThreats(c.myPlayer, c.EnemyManager);
  const want = [H.THREAT_VELOCITY_TICK, H.THREAT_REVERSE_INSTA, H.THREAT_MUSKET_BOW,
    H.THREAT_SPIKE_TICK, H.THREAT_ONE_TICK, H.THREAT_SPAM_BOW];
  check('multi/all six flags set', want.every(f => (t.mask & f) !== 0), 'mask=' + t.mask.toString(2));
  // musket/bow carries 50 + 115 in flight = 165, the worst of the set.
  eq('multi/worst case damage', t.damage, 165);
  check('multi/sequences non-empty', (t.sequences & H.THREAT_SEQUENCE) !== 0);
}

// --------------------------------------------------------------------------
// 5. Shame 0 -> 7: emergency healing stops dead at the ceiling, and never
//    steps past it, from any call site.
// --------------------------------------------------------------------------
{
  for (let start = 0; start <= 7; start++) {
    const c = H.makeClient({ enemy: { detectedDangerEnemy: true, potentialDamage: 95, primaryDamage: 60 } });
    const mh = c._ModuleHandler, p = c.myPlayer;
    p.shameCount = start;
    const now = H.now();
    p.takeDamage(40, now);           // stamp is live and inside the window
    mh.resetTick();
    c.antiInsta.postTick();
    const healed = mh.sentHeals.length > 0;
    if (start < 7) {
      check('sweep/shame ' + start + ' heals', healed, 'sent ' + mh.sentHeals.length);
      check('sweep/shame ' + start + ' ends <= 7', p.shameCount <= 7, 'ended ' + p.shameCount);
      eq('sweep/shame ' + start + ' costs exactly one', p.shameCount, start + 1);
    } else {
      check('sweep/shame 7 refuses the +1 eat', !healed, 'sent ' + mh.sentHeals.length);
      eq('sweep/shame 7 stays 7', p.shameCount, 7);
    }
  }
}

// --------------------------------------------------------------------------
// 6. An emergency burst costs one point of shame, not one per apple.
// --------------------------------------------------------------------------
{
  const c = H.makeClient({ enemy: { detectedDangerEnemy: true, potentialDamage: 120, primaryDamage: 70 } });
  const mh = c._ModuleHandler, p = c.myPlayer;
  const now = H.now();
  p.shameCount = 2;
  p.takeDamage(70, now);
  mh.resetTick();
  c.antiInsta.postTick();
  check('burst/multiple apples sent', mh.sentHeals.length >= 3, 'sent ' + mh.sentHeals.length);
  eq('burst/shame moved by one', p.shameCount, 3);
}

// --------------------------------------------------------------------------
// 7. The free full-health recovery eat.
// --------------------------------------------------------------------------
{
  const c = H.makeClient();
  const mh = c._ModuleHandler, p = c.myPlayer;
  const now = H.now();
  p.shameCount = 6;
  p.takeDamage(5, now - 400);       // bull tick, long past the window
  p.currentHealth = 100; p.tempHealth = 100;   // and already healed back up
  mh.resetTick();
  c.antiInsta.postTick();
  eq('freedrain/one apple only', mh.sentHeals.length, 1);
  eq('freedrain/shame down two', p.shameCount, 4);

  // With no stamp there is nothing to drain and nothing is sent.
  const c2 = H.makeClient();
  c2.myPlayer.shameCount = 6;
  c2._ModuleHandler.resetTick();
  c2.antiInsta.postTick();
  eq('freedrain/no stamp, no eat', c2._ModuleHandler.sentHeals.length, 0);
  eq('freedrain/no stamp, no change', c2.myPlayer.shameCount, 6);

  // At full health with zero shame there is nothing worth doing either.
  const c3 = H.makeClient();
  c3.myPlayer.takeDamage(5, H.now() - 400);
  c3.myPlayer.currentHealth = 100; c3.myPlayer.tempHealth = 100;
  c3._ModuleHandler.resetTick();
  c3.antiInsta.postTick();
  eq('freedrain/no shame, no eat', c3._ModuleHandler.sentHeals.length, 0);
}

// --------------------------------------------------------------------------
// 8. Bull recovery cycle: 7 -> 0 through repeated bull ticks.
// --------------------------------------------------------------------------
{
  const c = H.makeClient();
  const mh = c._ModuleHandler, p = c.myPlayer;
  p.shameCount = 7;
  let cycles = 0;
  const start = H.clock.t;
  for (let tick = 0; tick < 90 && p.shameCount > 0; tick++) {
    p.tickCount = tick;
    mh.resetTick();
    // Bull's own -5 lands once a second while the helmet is on, which at
    // serverUpdateRate 9 is every ninth tick.
    if (tick > 0 && tick % H.BULL_TICK_PERIOD === 0) {
      p.takeDamage(H.BULL_TICK_DAMAGE, H.clock.t);
      cycles++;
    }
    c.antiInsta.postTick();
    // The apple the tick sent lands and puts the health back.
    if (mh.sentHeals.length) {
      p.currentHealth = Math.min(100, p.currentHealth + 20);
      p.tempHealth = p.currentHealth;
      mh.sentHeals.length = 0;
    }
    H.clock.t += Math.round(1000 / 9);
  }
  const elapsed = H.clock.t - start;
  eq('bullcycle/reaches zero', p.shameCount, 0);
  check('bullcycle/four stamps, one per second', cycles === 4, 'cycles=' + cycles);
  check('bullcycle/inside five seconds', elapsed <= 5000, 'elapsed=' + elapsed + 'ms');
}

// --------------------------------------------------------------------------
// 9. Hat arbitration.
// --------------------------------------------------------------------------
{
  // Bull outranks bare Safe Soldier, which is what used to bury it.
  const c = H.makeClient();
  const mh = c._ModuleHandler;
  mh.resetTick();
  mh.requestDefenseHat(6, H.DEF_HAT_SAFE_SOLDIER);
  mh.requestDefenseHat(7, H.DEF_HAT_SHAME_RECOVER);
  mh.resolveDefenseHat();
  eq('hat/bull beats safe soldier', mh.forceHat, 7);

  // Real predicted damage takes it back.
  mh.resetTick();
  mh.requestDefenseHat(7, H.DEF_HAT_SHAME_RECOVER);
  mh.requestDefenseHat(6, H.DEF_HAT_THREAT);
  mh.resolveDefenseHat();
  eq('hat/threat beats shame recovery', mh.forceHat, 6);

  // Lethal outranks everything the auto heal can ask for.
  mh.resetTick();
  mh.requestDefenseHat(7, H.DEF_HAT_SHAME_CRITICAL);
  mh.requestDefenseHat(6, H.DEF_HAT_LETHAL);
  mh.resolveDefenseHat();
  eq('hat/lethal wins', mh.forceHat, 6);

  // A combat module's tank hat is never touched.
  mh.resetTick();
  mh.forceHat = 40;
  mh.requestDefenseHat(6, H.DEF_HAT_LETHAL);
  eq('hat/tank untouched', (mh.resolveDefenseHat(), mh.forceHat), 40);

  // Nor is a turret hat.
  mh.resetTick();
  mh.forceHat = 53;
  mh.requestDefenseHat(7, H.DEF_HAT_SHAME_RECOVER);
  eq('hat/turret untouched', (mh.resolveDefenseHat(), mh.forceHat), 53);

  // An insta module's bull survives a precautionary soldier...
  mh.resetTick();
  mh.forceHat = 7;
  mh.requestDefenseHat(6, H.DEF_HAT_SAFE_SOLDIER);
  eq('hat/insta bull survives safe soldier', (mh.resolveDefenseHat(), mh.forceHat), 7);

  // ...but gives way when the bar is about to come off.
  mh.resetTick();
  mh.forceHat = 7;
  mh.requestDefenseHat(6, H.DEF_HAT_LETHAL);
  eq('hat/insta bull yields to lethal', (mh.resolveDefenseHat(), mh.forceHat), 6);

  // A hat that is not owned falls back rather than being sent anyway.
  mh.resetTick();
  mh.owned = new Set([6]);
  mh.requestDefenseHat(7, H.DEF_HAT_SHAME_RECOVER);
  eq('hat/unowned bull falls back to soldier', (mh.resolveDefenseHat(), mh.forceHat), 6);
  mh.resetTick();
  mh.owned = new Set();
  mh.requestDefenseHat(6, H.DEF_HAT_LETHAL);
  eq('hat/nothing owned, nothing forced', (mh.resolveDefenseHat(), mh.forceHat), null);
  mh.owned = new Set([6, 7]);
}

// --------------------------------------------------------------------------
// 10. Soldier goes on when the auto heal predicts damage.
// --------------------------------------------------------------------------
{
  const c = H.makeClient({ enemy: { detectedDangerEnemy: true, potentialDamage: 95, primaryDamage: 60 } });
  const mh = c._ModuleHandler, p = c.myPlayer;
  p.takeDamage(30, H.now());
  mh.resetTick();
  c.antiInsta.postTick();
  mh.resolveDefenseHat();
  eq('soldier/lethal equips soldier', mh.forceHat, 6);

  // A named sequence that is not yet lethal still puts soldier on.
  const c2 = H.makeClient({ enemy: { velocityTickThreat: true, primaryDamage: 30 } });
  c2.myPlayer.currentHealth = 90; c2.myPlayer.tempHealth = 90;
  c2._ModuleHandler.resetTick();
  c2.antiInsta.postTick();
  c2._ModuleHandler.resolveDefenseHat();
  eq('soldier/sequence equips soldier', c2._ModuleHandler.forceHat, 6);
}

// --------------------------------------------------------------------------
// 11. Bull is refused whenever anything is predicted to land.
// --------------------------------------------------------------------------
{
  const mk = (enemy, shame, health) => {
    const c = H.makeClient({ enemy });
    c.myPlayer.shameCount = shame;
    c.myPlayer.currentHealth = health; c.myPlayer.tempHealth = health;
    c._ModuleHandler.resetTick();
    c.antiInsta.postTick();
    return c;
  };
  eq('bullsafe/quiet world wants bull', mk({}, 4, 100).antiInsta.shame.wantBull, true);
  eq('bullsafe/predicted damage refuses', mk({ potentialDamage: 30 }, 4, 100).antiInsta.shame.wantBull, false);
  eq('bullsafe/spike risk refuses', mk({ willCollideSpike: true }, 4, 100).antiInsta.shame.wantBull, false);
  eq('bullsafe/sequence refuses', mk({ reverseInsta: true }, 4, 100).antiInsta.shame.wantBull, false);
  eq('bullsafe/no shame, no bull', mk({}, 0, 100).antiInsta.shame.wantBull, false);
  eq('bullsafe/too little health refuses', mk({}, 4, 4).antiInsta.shame.wantBull, false);
  // At the ceiling, a little chip damage no longer blocks recovery.
  eq('bullsafe/critical tolerates chip damage', mk({ potentialDamage: 20 }, 7, 100).antiInsta.shame.wantBull, true);
  eq('bullsafe/critical still refuses a sequence', mk({ reverseInsta: true }, 7, 100).antiInsta.shame.wantBull, false);
  eq('bullsafe/critical still refuses a live spike', mk({ collidingSpike: true, potentialSpikeDamage: 45 }, 7, 100).antiInsta.shame.wantBull, false);
}

// --------------------------------------------------------------------------
// 12. Packet budget: reserve held back, emergency may spend it.
// --------------------------------------------------------------------------
{
  const c = H.makeClient();
  const mh = c._ModuleHandler;
  eq('packets/routine budget at rest', mh.healBudget(false), Math.floor((119 - 12) / 3));
  eq('packets/emergency budget at rest', mh.healBudget(true), Math.floor(119 / 3));
  mh.packetCount = 110;
  eq('packets/routine budget exhausted', mh.healBudget(false), 0);
  eq('packets/emergency still has room', mh.healBudget(true), 3);
  mh.packetCount = 119;
  eq('packets/nothing left for anyone', mh.healBudget(true), 0);
}
{
  // A routine top-up cannot eat into the reserve.
  const c = H.makeClient();
  const mh = c._ModuleHandler, p = c.myPlayer;
  mh.packetCount = 110;
  p.currentHealth = 20; p.tempHealth = 20;
  p.tickCount = 10; p.damageTick = 0;
  mh.resetTick();
  c.antiInsta.postTick();
  eq('packets/routine respects reserve', mh.sentHeals.length, 0);

  // The same tick, lethal, spends it.
  const c2 = H.makeClient({ enemy: { detectedDangerEnemy: true, potentialDamage: 95, primaryDamage: 60 } });
  c2._ModuleHandler.packetCount = 110;
  c2.myPlayer.currentHealth = 20; c2.myPlayer.tempHealth = 20;
  c2.myPlayer.takeDamage(0, H.now());
  c2._ModuleHandler.resetTick();
  c2.antiInsta.postTick();
  check('packets/emergency spends reserve', c2._ModuleHandler.sentHeals.length > 0, 'sent ' + c2._ModuleHandler.sentHeals.length);
}
{
  // Food is a hard cap too: one apple's worth of food, one apple.
  const c = H.makeClient({ enemy: { detectedDangerEnemy: true, potentialDamage: 95, primaryDamage: 60 } });
  const mh = c._ModuleHandler, p = c.myPlayer;
  p.resources.food = 10;
  p.currentHealth = 20; p.tempHealth = 20;
  p.takeDamage(0, H.now());
  mh.resetTick();
  c.antiInsta.postTick();
  eq('packets/food caps the batch', mh.sentHeals.length, 1);

  const c2 = H.makeClient({ enemy: { detectedDangerEnemy: true, potentialDamage: 95, primaryDamage: 60 } });
  c2.myPlayer.resources.food = 0;
  c2.myPlayer.currentHealth = 20; c2.myPlayer.tempHealth = 20;
  c2.myPlayer.takeDamage(0, H.now());
  c2._ModuleHandler.resetTick();
  c2.antiInsta.postTick();
  eq('packets/no food, no eats', c2._ModuleHandler.sentHeals.length, 0);
}

// --------------------------------------------------------------------------
// 12b. Batch sizing: bounded per tick, and never more than a full bar.
// --------------------------------------------------------------------------
{
  // Worst case the module can construct: empty bar, capped incoming damage.
  const c = H.makeClient({ enemy: { detectedDangerEnemy: true, potentialDamage: 200, potentialSpikeDamage: 45, primaryDamage: 90 } });
  const mh = c._ModuleHandler, p = c.myPlayer;
  p.currentHealth = 5; p.tempHealth = 5;
  p.takeDamage(0, H.now());
  mh.resetTick();
  c.antiInsta.postTick();
  eq('batch/never more than a full bar', mh.sentHeals.length, 5);
  check('batch/under the per-tick cap', mh.sentHeals.length <= mh._HEAL_MAX_PER_TICK);
  eq('batch/one shame point for the burst', p.shameCount, 1);
}
{
  // The cap holds even when several callers each ask for a batch.
  const c = H.makeClient();
  const mh = c._ModuleHandler;
  mh.resetTick();
  let ok = 0;
  for (let i = 0; i < 20; i++) if (mh.heal(H.now ? { emergency: true } : undefined)) ok++;
  eq('batch/per-tick cap enforced', ok, mh._HEAL_MAX_PER_TICK);
  mh.resetTick();
  eq('batch/cap resets next tick', mh.heal({ emergency: true }), true);
}

// --------------------------------------------------------------------------
// 13. In-flight ledger: the bull tick no longer wipes it.
// --------------------------------------------------------------------------
{
  const c = H.makeClient();
  const mh = c._ModuleHandler, p = c.myPlayer;
  p.currentHealth = 60; p.tempHealth = 60;
  c.antiInsta._healSent = { count: 2, tick: mh.tickCount, health: 60 };
  eq('inflight/counted while health is level', c.antiInsta._healsInFlight(mh), 2);
  p.tempHealth = 55;                     // bull tick, or a fresh hit
  eq('inflight/a drop does not clear it', c.antiInsta._healsInFlight(mh), 2);
  p.tempHealth = 80;                     // the batch has begun to land
  eq('inflight/a rise clears it', c.antiInsta._healsInFlight(mh), 0);
}
{
  // Two ticks in a row do not pay for the same missing health twice.
  const c = H.makeClient();
  const mh = c._ModuleHandler, p = c.myPlayer;
  p.currentHealth = 60; p.tempHealth = 60;
  p.tickCount = 10; p.damageTick = 0;
  mh.resetTick();
  c.antiInsta.postTick();
  const first = mh.sentHeals.length;
  check('inflight/first tick heals', first === 2, 'sent ' + first);
  mh.resetTick();
  p.takeDamage(H.BULL_TICK_DAMAGE, H.now() - 400);   // bull tick lands between
  p.tickCount = 11; p.damageTick = 0;
  c.antiInsta.postTick();
  const second = mh.sentHeals.length - first;
  check('inflight/second tick does not re-pay', second <= 1, 'sent ' + second + ' more');
}

// --------------------------------------------------------------------------
// 14. Proactive pre-heal: fires only while it is free.
// --------------------------------------------------------------------------
{
  // Sequence live, would drop us under the floor, no stamp pending -> heal now.
  const c = H.makeClient({ enemy: { velocityTickThreat: true, primaryDamage: 45 } });
  const mh = c._ModuleHandler, p = c.myPlayer;
  p.currentHealth = 85; p.tempHealth = 85;
  p.tickCount = 10; p.damageTick = 0;
  mh.resetTick();
  c.antiInsta.postTick();
  check('preheal/fires when free', mh.sentHeals.length > 0, 'sent ' + mh.sentHeals.length);
  eq('preheal/costs no shame', p.shameCount, 0);

  // Same, but a stamp is pending -> wait rather than pay a point.
  const c2 = H.makeClient({ enemy: { velocityTickThreat: true, primaryDamage: 45 } });
  c2.myPlayer.currentHealth = 85; c2.myPlayer.tempHealth = 85;
  c2.myPlayer.takeDamage(0, H.now());
  c2._ModuleHandler.resetTick();
  c2.antiInsta.postTick();
  eq('preheal/waits when a stamp is pending', c2._ModuleHandler.sentHeals.length, 0);
  eq('preheal/shame untouched', c2.myPlayer.shameCount, 0);
}

// --------------------------------------------------------------------------
// 15. heal()'s ceiling backstop cannot be bypassed by an emergency caller.
// --------------------------------------------------------------------------
{
  const c = H.makeClient();
  const mh = c._ModuleHandler, p = c.myPlayer;
  p.shameCount = 7;
  p.takeDamage(30, H.now());
  eq('backstop/emergency refused at 7 inside window', mh.heal({ emergency: true }), false);
  eq('backstop/shame unchanged', p.shameCount, 7);
  // Aged stamp at 7 is a -2 and is exactly what we want.
  p.takeDamage(30, H.now() - 500);
  eq('backstop/aged stamp allowed at 7', mh.heal({ emergency: true }), true);
  eq('backstop/shame came down', p.shameCount, 5);
  // No stamp at 7 is inert and allowed.
  p.shameCount = 7;
  eq('backstop/no stamp allowed at 7', mh.heal({ emergency: true }), true);
  eq('backstop/still 7', p.shameCount, 7);
}

// --------------------------------------------------------------------------
// 16. The gates that make the whole module inert.
// --------------------------------------------------------------------------
{
  const c = H.makeClient({ enemy: { detectedDangerEnemy: true, potentialDamage: 95 } });
  c.myPlayer.shameActive = true;
  c.myPlayer.currentHealth = 30; c.myPlayer.tempHealth = 30;
  c._ModuleHandler.resetTick();
  c.antiInsta.postTick();
  eq('gates/shameActive sends nothing', c._ModuleHandler.sentHeals.length, 0);
  eq('gates/shameActive clears wantBull', c.antiInsta.shame.wantBull, false);

  const c2 = H.makeClient();
  c2.myPlayer.inventory = {};                 // no food in the belt
  c2.myPlayer.currentHealth = 30; c2.myPlayer.tempHealth = 30;
  c2._ModuleHandler.resetTick();
  c2.antiInsta.postTick();
  eq('gates/no food item sends nothing', c2._ModuleHandler.sentHeals.length, 0);
}

// --------------------------------------------------------------------------
// 17. Stale state never leaks across a tick that returned early.
// --------------------------------------------------------------------------
{
  const c = H.makeClient({ enemy: { reverseInsta: true, primaryDamage: 60 } });
  const mh = c._ModuleHandler, p = c.myPlayer;
  p.shameCount = 3;
  p.currentHealth = 90; p.tempHealth = 90;
  mh.resetTick();
  c.antiInsta.postTick();
  check('stale/threat set on a live tick', c.antiInsta.threat.mask !== 0);
  // Next tick the module bails at the shameActive gate.
  p.shameActive = true;
  mh.resetTick();
  c.antiInsta.postTick();
  eq('stale/threat mask cleared', c.antiInsta.threat.mask, 0);
  eq('stale/threat damage cleared', c.antiInsta.threat.damage, 0);
  eq('stale/wantBull cleared', c.antiInsta.shame.wantBull, false);
}

// --------------------------------------------------------------------------
console.log('');
console.log('  passed ' + pass + ', failed ' + fail);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log('  FAIL  ' + f);
  process.exit(1);
}
console.log('  all green');
