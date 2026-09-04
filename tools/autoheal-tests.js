const h = require('./autoheal-harness.js');
const { M, makeClient, check, tick, report, clock, settings } = h;
const T = M.AH.T;

function hatOf(w) {
  return w.mh.forceHat !== null ? w.mh.forceHat : w.mh.useHat;
}

// ===========================================================================
// SHAME
// ===========================================================================
(function shameZeroMaintenance() {
  const w = makeClient({ my: { health: 100, food: 0, shame: 0 } });
  tick(w, 5);
  check('shame 0 · idle sends nothing', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);
  check('shame 0 · idle asserts no hat', hatOf(w) === null, 'hat=' + hatOf(w));
  check('shame 0 · no bull pump at shame 0', w.ah.plan.hat !== M.AH.BULL);
})();

(function shameCeilingBlocksFastHeal() {
  const w = makeClient({
    my: { health: 30, food: 0, shame: 7 },
    em: { potentialDamage: 60, detectedDangerEnemy: true }
  });
  w.ah.recordDamage(45);            // fresh hit -> a heal now would be +1
  tick(w, 1);
  check('shame 7 · fast heal refused', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);
  check('shame 7 · mode is blocked', w.ah.plan.mode === 'blocked', w.ah.plan.mode);
  check('shame 7 · soldier still goes on', hatOf(w) === M.AH.SOLDIER, 'hat=' + hatOf(w));
})();

(function shameSixStillHeals() {
  const w = makeClient({
    my: { health: 30, food: 0, shame: 6 },
    em: { potentialDamage: 60, detectedDangerEnemy: true }
  });
  w.ah.recordDamage(45);
  tick(w, 1);
  check('shame 6 · lethal tick still heals', w.mh.rawHeals > 0, 'heals=' + w.mh.rawHeals);
  check('shame 6 · booked as an increment', w.mh.predicted[0] === 1, 'pred=' + w.mh.predicted[0]);
})();

(function scrubAtFullHealth() {
  // Soldier only, so the pump does not claim the tick: this is the plain scrub.
  const w = makeClient({ my: { health: 100, food: 0, shame: 4 }, owns: [ 6 ] });
  w.ah.recordDamage(5);             // bull drain: a banked hit
  clock.advance(400);               // past the 130ms window
  check('scrub · window open', w.ah.shame.costNow === -2, 'cost=' + w.ah.shame.costNow);
  tick(w, 1);
  check('scrub · one food spent', w.mh.rawHeals === 1, 'heals=' + w.mh.rawHeals);
  check('scrub · booked as a scrub', w.ah.plan.scrubbing === true);
  check('scrub · predicted as -2', w.mh.predicted[0] === -2, 'pred=' + w.mh.predicted[0]);
  check('scrub · hit consumed', w.ah.shame.hitAt === 0);
})();

(function deferInsteadOfPayingShame() {
  // Comfortable on health, but a dagger enemy in reach means the three-tick
  // burst still opens a deficit — a heal worth taking, just not worth a shame
  // point when the free window is two ticks away.
  const w = makeClient({
    my: { health: 60, food: 0, shame: 2 },
    enemies: [ { x: 80, y: 0, primary: 7, hatID: 7, variant: 2 } ]
  });
  w.ah.recordDamage(20);
  tick(w, 1);                       // ~111ms after the hit: not free yet
  check('defer · heal held for the window', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);
  check('defer · mode is deferred', w.ah.plan.mode === 'deferred', w.ah.plan.mode);
  tick(w, 1);                       // ~222ms: free now
  check('defer · heal lands free next tick', w.mh.rawHeals > 0, 'heals=' + w.mh.rawHeals);
  check('defer · and it came back as a scrub', w.mh.predicted[0] === -2, 'pred=' + w.mh.predicted[0]);
})();

(function noDeferralWhenDying() {
  const w = makeClient({
    my: { health: 25, food: 0, shame: 2 },
    em: { potentialDamage: 60, detectedDangerEnemy: true }
  });
  w.ah.recordDamage(40);
  tick(w, 1);
  check('critical · does not defer', w.mh.rawHeals > 0, 'heals=' + w.mh.rawHeals);
  check('critical · mode is critical', w.ah.plan.mode === 'critical', w.ah.plan.mode);
})();

(function shameActiveStopsEating() {
  const w = makeClient({ my: { health: 20, food: 0, shame: 0, shameActive: true }, em: { potentialDamage: 60 } });
  w.ah.recordDamage(40);
  tick(w, 1);
  check('lockout · no food spent while shameActive', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);
})();

// ===========================================================================
// BULL HAT — the shame pump, and its guards
// ===========================================================================
(function bullPumpEngages() {
  const w = makeClient({ my: { health: 100, food: 0, shame: 4 } });
  tick(w, 1);
  check('bull · pumps when calm and stocked', w.ah.plan.hat === M.AH.BULL, 'hat=' + w.ah.plan.hat);
  check('bull · mode is pump', w.ah.plan.mode === 'pump', w.ah.plan.mode);
})();

(function bullPumpRefusedAtLowHealth() {
  const w = makeClient({ my: { health: M.AH.BULL_MIN_HP, food: 0, shame: 4 } });
  tick(w, 1);
  check('bull · refused below the health floor', w.ah.plan.hat !== M.AH.BULL, 'hat=' + w.ah.plan.hat);
})();

(function bullPumpRefusedNearEnemy() {
  const w = makeClient({
    my: { health: 100, food: 0, shame: 4 },
    enemies: [ { x: 250, y: 0, primary: 5 } ]
  });
  tick(w, 1);
  check('bull · refused inside Safe Soldier range', w.ah.plan.hat !== M.AH.BULL, 'hat=' + w.ah.plan.hat);
})();

(function bullPumpRefusedUnderThreat() {
  const w = makeClient({ my: { health: 100, food: 0, shame: 5 }, em: { potentialDamage: 30 } });
  tick(w, 1);
  check('bull · refused with damage predicted', w.ah.plan.hat !== M.AH.BULL, 'hat=' + w.ah.plan.hat);
})();

(function bullPumpStopsAtZero() {
  const w = makeClient({ my: { health: 100, food: 0, shame: 0 } });
  tick(w, 1);
  check('bull · not worn at shame 0', w.ah.plan.hat !== M.AH.BULL, 'hat=' + w.ah.plan.hat);
})();

(function bullPumpFullCycle() {
  // shame 2, calm: bull goes on, and nothing is eaten yet — the regen tick runs
  // on the server's clock and its phase is not known until one has been seen.
  const w = makeClient({ my: { health: 100, food: 0, shame: 2 } });
  tick(w, 1);
  check('bull cycle · hat on', w.ah.plan.hat === M.AH.BULL);
  check('bull cycle · nothing eaten before the phase is known', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);
  w.my.hatID = M.AH.BULL;
  tick(w, 1);
  check('bull cycle · still nothing', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);

  // the drain lands and is watched
  w.ah.recordDamage(5);
  w.my.tempHealth = 95;
  tick(w, 1);                        // classified: lastDrainAt is now set
  check('bull cycle · drain seen', w.ah.ledger.msSinceDrain() < 1e3, String(w.ah.ledger.msSinceDrain()));
  tick(w, 1);                        // ~222ms after it: inside the window
  check('bull cycle · scrub follows the drain', w.mh.rawHeals === 1, 'heals=' + w.mh.rawHeals);
  check('bull cycle · scrub was free', w.mh.predicted[0] === -2, 'pred=' + w.mh.predicted[0]);
})();

(function bullPumpWaitsOutTheLateWindow() {
  // Too long after the drain, the next one is close enough that a consume could
  // reach the server on the wrong side of it. Nothing goes.
  const w = makeClient({ my: { health: 100, food: 0, shame: 2 } });
  w.my.hatID = M.AH.BULL;
  w.ah.recordDamage(5);
  tick(w, 1);
  clock.advance(600);
  tick(w, 1);
  check('bull cycle · late in the second, nothing goes', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);
})();

// ===========================================================================
// ANTI SYSTEMS — one at a time
// ===========================================================================
function antiCase(name, opts, bit, wantSoldier) {
  const w = makeClient(opts);
  if (opts.damage) w.ah.recordDamage(opts.damage);
  tick(w, 1);
  check(name + ' · tagged', w.ah.threat.has(bit), 'tags=' + w.ah.threat.tags.toString(2));
  if (wantSoldier) check(name + ' · soldier', w.ah.plan.hat === M.AH.SOLDIER, 'hat=' + w.ah.plan.hat);
  return w;
}

antiCase('anti insta kill', { my: { health: 70, food: 0 }, em: { potentialDamage: 95, detectedDangerEnemy: true } }, T.INSTA, true);
antiCase('anti reverse insta', { my: { health: 70, food: 0 }, em: { reverseInsta: true } }, T.REVERSE, true);
antiCase('anti velocity tick', { my: { health: 70, food: 0 }, em: { velocityTickThreat: true } }, T.VELOCITY, true);
antiCase('anti musket/bow', { my: { health: 70, food: 0 }, em: { rangedBowInsta: true } }, T.RANGED, true);
antiCase('anti tool hammer insta', { my: { health: 70, food: 0 }, em: { toolHammerInsta: true } }, T.TOOLHAMMER, true);
antiCase('anti spike sync', { my: { health: 70, food: 0 }, em: { spikeSyncThreat: true } }, T.SPIKESYNC, true);
antiCase('anti spike push', { my: { health: 70, food: 0 }, em: { pushingOnSpike: true } }, T.SPIKEPUSH, true);

(function antiKnockbackTick() {
  const w = makeClient({
    my: { health: 40, food: 0 },
    em: { possibleToKnockback: true, potentialSpikeDamage: 45, potentialDamage: 80 }
  });
  tick(w, 1);
  check('anti knockback · tagged', w.ah.threat.has(T.KNOCKBACK));
  check('anti knockback · still allowed to swing', w.ah.plan.blockAttack === false);
  check('anti knockback · emergency raised', w.ah.plan.emergency === true);
})();

(function antiSpikeTickPlacement() {
  const w = makeClient({
    my: { health: 70, food: 0 },
    enemies: [ { x: 90, y: 0, primary: 5, canPlaceSpike: true, spikeDamage: 45 } ]
  });
  tick(w, 1);
  check('anti spike tick · tagged', w.ah.threat.has(T.SPIKETICK));
  check('anti spike tick · soldier', w.ah.plan.hat === M.AH.SOLDIER);
})();

(function antiSpikeContactTrapped() {
  const trap = { health: 200, pos: { current: h.vec(0, 0) } };
  const w = makeClient({
    my: { health: 80, food: 0, isTrapped: true, trappedIn: trap },
    em: { collidingSpike: true, potentialSpikeDamage: 45 }
  });
  tick(w, 1);
  check('anti spike contact · tagged', w.ah.threat.has(T.SPIKECONTACT));
  check('anti spike contact · burst compounds', w.ah.threat.burst >= 45 * 3, 'burst=' + w.ah.threat.burst);
  check('anti spike contact · soldier', w.ah.plan.hat === M.AH.SOLDIER);
})();

(function antiOneTick() {
  const bolt = { pos: { current: h.vec(200, 0) }, speed: 1.5, damage: 25, life: 9, isTurret: true };
  const w = makeClient({ my: { health: 70, food: 0 }, projectiles: [ bolt ] });
  tick(w, 1);
  check('anti one tick · tagged', w.ah.threat.has(T.ONETICK), 'tags=' + w.ah.threat.tags.toString(2));
})();

(function antiTurret() {
  const w = makeClient({
    my: { health: 70, food: 0 },
    enemies: [ { x: 500, y: 0, primary: 5, hatID: 53 } ]
  });
  tick(w, 1);
  check('anti turret · camper tagged at 500', w.ah.threat.has(T.TURRET));
  check('anti turret · counted in the burst', w.ah.threat.burst >= 25, 'burst=' + w.ah.threat.burst);
})();

(function antiPrimaryPlusRanged() {
  const w = makeClient({
    my: { health: 70, food: 0 },
    enemies: [ { x: 100, y: 0, primary: 5, secondary: 15 } ]
  });
  tick(w, 1);
  check('anti primary+musket · tagged', w.ah.threat.has(T.PRIMARY_RANGED));
  check('anti primary+musket · soldier', w.ah.plan.hat === M.AH.SOLDIER);
})();

(function antiSpamDaggersBull() {
  const w = makeClient({
    my: { health: 80, food: 0 },
    enemies: [ { x: 80, y: 0, primary: 7, hatID: 7, variant: 2 } ]
  });
  tick(w, 1);
  check('anti dagger spam · tagged', w.ah.threat.has(T.DAGGERSPAM));
  // 20 * 1.5 * 1.18 = 35.4 a swing, two more swings inside the horizon.
  check('anti dagger spam · sustained in the burst', w.ah.threat.burst >= 70, 'burst=' + w.ah.threat.burst);
})();

(function antiSpamBow() {
  const shot = { damage: 25 };
  const w = makeClient({ my: { health: 80, food: 0 } });
  w.ah.recordDamage(25);
  w.ah.recordShoot(shot);
  tick(w, 1);
  w.ah.recordDamage(25);
  w.ah.recordShoot({ damage: 25 });
  tick(w, 1);
  check('anti bow spam · tagged off what landed', w.ah.threat.has(T.BOWSPAM), 'tags=' + w.ah.threat.tags.toString(2));
})();

(function antiPoison() {
  const w = makeClient({ my: { health: 80, food: 0, poisonCount: 4 } });
  tick(w, 1);
  check('anti poison · tagged', w.ah.threat.has(T.POISON));
  check('anti poison · carried into the burst', w.ah.threat.burst >= 5, 'burst=' + w.ah.threat.burst);
})();

(function antiSmartTick() {
  const trap = { health: 40, pos: { current: h.vec(0, 0) } };
  const spike = new M.PlayerObject({ itemGroup: 2, ownerID: 1, scale: 52, pos: { current: h.vec(-120, 0) } });
  const w = makeClient({
    my: { health: 90, food: 0, isTrapped: true, trappedIn: trap },
    enemies: [ { x: 120, y: 0, primary: 5 } ]
  });
  w.client.ObjectManager.objects.set(1, spike);
  w.client.ObjectManager.grid2D.query = (x, y, r, cb) => { cb(1); return false; };
  w.my.inventory[1] = 10;           // great hammer
  tick(w, 1);
  check('anti smart tick · autobreak held', w.ah.blockBreak === true);
  check('anti smart tick · tagged', w.ah.threat.has(T.SMARTTICK));
})();

// ===========================================================================
// COMBINATIONS
// ===========================================================================
(function instaPlusShameCeiling() {
  const w = makeClient({
    my: { health: 35, food: 0, shame: 7 },
    em: { potentialDamage: 100, detectedDangerEnemy: true, reverseInsta: true }
  });
  w.ah.recordDamage(50);
  tick(w, 1);
  check('insta + shame 7 · nothing eaten', w.mh.rawHeals === 0);
  check('insta + shame 7 · soldier forced outright', w.mh.forceHat === M.AH.SOLDIER);
  check('insta + shame 7 · stops swinging', w.mh.shouldAttack === false);
})();

(function shameCeilingUnderFireRefusesEvenTheFreeWindow() {
  // A consume can always come back as +1 if a hit lands while it is in the air,
  // so at 7 the open window is not enough on its own: under fire, nothing goes.
  const w = makeClient({
    my: { health: 35, food: 0, shame: 7 },
    em: { potentialDamage: 60, detectedDangerEnemy: true }
  });
  w.ah.recordDamage(50);
  clock.advance(400);
  tick(w, 1);
  check('shame 7 · under fire, even a free window is refused', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);
  check('shame 7 · reported as blocked', w.ah.plan.mode === 'blocked', w.ah.plan.mode);
  check('shame 7 · soldier still on', hatOf(w) === M.AH.SOLDIER);
})();

(function shameCeilingCalmScrubIsTheWayDown() {
  // Calm: nothing can reach me during the uplink, so the scrub is the one
  // consume whose outcome is not a coin flip. Without it 7 would be a dead end,
  // because shame only ever moves on a consume.
  const w = makeClient({ my: { health: 70, food: 0, shame: 7 }, owns: [ 6 ] });
  w.ah.recordDamage(5);
  clock.advance(400);
  tick(w, 1);
  check('shame 7 · calm scrub allowed', w.mh.rawHeals === 1, 'heals=' + w.mh.rawHeals);
  check('shame 7 · predicted as -2', w.mh.predicted[0] === -2, 'pred=' + w.mh.predicted[0]);
})();

(function highHealthHighShame() {
  const w = makeClient({ my: { health: 100, food: 0, shame: 7 } });
  tick(w, 1);
  check('high hp + shame 7 · reaches for bull', w.ah.plan.hat === M.AH.BULL, 'hat=' + w.ah.plan.hat);
})();

(function multipleThreats() {
  const w = makeClient({
    my: { health: 55, food: 0, shame: 1 },
    em: {
      potentialDamage: 70, potentialSpikeDamage: 45,
      possibleToKnockback: true, velocityTickThreat: true, detectedDangerEnemy: true
    },
    enemies: [ { x: 90, y: 0, primary: 5, secondary: 15 }, { x: 400, y: 0, primary: 5, hatID: 53 } ]
  });
  w.ah.recordDamage(45);
  tick(w, 1);
  check('multi-threat · one hat, not a fight over it', w.mh.forceHat === M.AH.SOLDIER);
  check('multi-threat · healed', w.mh.rawHeals > 0, 'heals=' + w.mh.rawHeals);
  check('multi-threat · at most one shame paid', w.ah.shame.pending <= 1, 'pending=' + w.ah.shame.pending);
})();

// ===========================================================================
// HEALING SHAPE
// ===========================================================================
(function chainedHealIsOneShamePayment() {
  const w = makeClient({
    my: { health: 20, food: 0, shame: 0 },
    em: { potentialDamage: 60, detectedDangerEnemy: true }
  });
  w.ah.recordDamage(60);
  tick(w, 1);
  check('chain · several foods in one tick', w.mh.rawHeals >= 4, 'heals=' + w.mh.rawHeals);
  check('chain · costs exactly one shame', w.ah.shame.pending === 1, 'pending=' + w.ah.shame.pending);
})();

(function smallestEffectiveHeal() {
  // A 5 point gap is not worth a 20 point apple at shame 0: three quarters of
  // the restore would be thrown away for nothing.
  const w = makeClient({ my: { health: 95, food: 0, shame: 0 } });
  w.ah.recordDamage(5);
  clock.advance(400);
  tick(w, 1);
  check('minimal · no apple for a 5 point gap at shame 0', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);

  // The same gap with shame on the counter is worth it: the food is refused by
  // the server at the cap, and the -2 lands anyway.
  const v = makeClient({ my: { health: 95, food: 0, shame: 3 }, owns: [ 6 ] });
  v.ah.recordDamage(5);
  clock.advance(400);
  tick(v, 1);
  check('minimal · the same gap is worth it as a scrub', v.mh.rawHeals === 1, 'heals=' + v.mh.rawHeals);
  check('minimal · and it is a scrub', v.mh.predicted[0] === -2, 'pred=' + v.mh.predicted[0]);
})();

(function wholeFoodTopUp() {
  // 60 missing, 20 a food: three go out at once rather than one a tick.
  const w = makeClient({ my: { health: 40, food: 0, shame: 0 } });
  tick(w, 1);
  check('top-up · fills in one burst', w.mh.rawHeals === 3, 'heals=' + w.mh.rawHeals);
  check('top-up · costs no shame', w.mh.predicted.every(d => d === 0), JSON.stringify(w.mh.predicted));
})();

(function noWastefulTopUp() {
  const w = makeClient({ my: { health: 90, food: 0, shame: 0 } });
  tick(w, 3);
  check('minimal · no top-up when a whole apple would not fit', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);
})();

(function noFoodNoCrash() {
  const w = makeClient({ my: { health: 20, food: 0, canPlaceFood: false }, em: { potentialDamage: 60 } });
  w.ah.recordDamage(50);
  tick(w, 2);
  check('no food · nothing sent, no throw', w.mh.rawHeals === 0);
})();

(function moduleOff() {
  settings._autoheal = false;
  const w = makeClient({ my: { health: 20, food: 0 }, em: { potentialDamage: 90, detectedDangerEnemy: true } });
  w.ah.recordDamage(50);
  tick(w, 2);
  settings._autoheal = true;
  check('switch off · sends nothing', w.mh.rawHeals === 0);
  check('switch off · asserts no hat', hatOf(w) === null);
})();

// ===========================================================================
// PACKET BUDGET
// ===========================================================================
(function packetShortageIdle() {
  const w = makeClient({ my: { health: 40, food: 0, shame: 0 }, packets: 100 });
  w.ah.recordDamage(40);
  clock.advance(400);
  tick(w, 1);
  check('budget · idle reserve holds the heal back', w.mh.rawHeals === 0, 'heals=' + w.mh.rawHeals);
})();

(function packetShortageCritical() {
  const w = makeClient({
    my: { health: 20, food: 0, shame: 0 },
    em: { potentialDamage: 60, detectedDangerEnemy: true },
    packets: 110
  });
  w.ah.recordDamage(40);
  tick(w, 1);
  check('budget · critical spends the reserve', w.mh.rawHeals > 0, 'heals=' + w.mh.rawHeals);
  check('budget · but not past the limit', w.packets.count <= 119, 'packets=' + w.packets.count);
})();

(function packetBurstCap() {
  const w = makeClient({
    my: { health: 5, food: 0, shame: 0 },
    em: { potentialDamage: 60, detectedDangerEnemy: true }
  });
  w.ah.recordDamage(50);
  tick(w, 1);
  check('budget · burst capped', w.mh.rawHeals <= M.AH.MAX_BURST, 'heals=' + w.mh.rawHeals);
})();

// ===========================================================================
// ONLY SOLDIER AND BULL, EVER
// ===========================================================================
(function onlyTwoHats() {
  let seen = new Set;
  let rng = 12345;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 4000; i++) {
    const w = makeClient({
      my: {
        health: 1 + Math.floor(rand() * 100), food: 0,
        shame: Math.floor(rand() * 8),
        shameActive: rand() < .05,
        isTrapped: rand() < .2,
        poisonCount: rand() < .2 ? 3 : 0
      },
      em: {
        potentialDamage: Math.floor(rand() * 130),
        potentialSpikeDamage: rand() < .3 ? 45 : 0,
        detectedEnemy: rand() < .3,
        detectedDangerEnemy: rand() < .2,
        dangerWithoutSoldier: rand() < .2,
        reverseInsta: rand() < .1,
        velocityTickThreat: rand() < .1,
        rangedBowInsta: rand() < .1,
        toolHammerInsta: rand() < .1,
        spikeSyncThreat: rand() < .1,
        pushingOnSpike: rand() < .1,
        possibleToKnockback: rand() < .1,
        collidingSpike: rand() < .2,
        willCollideSpike: rand() < .2
      },
      enemies: rand() < .7 ? [ { x: 60 + rand() * 600, y: 0, primary: Math.floor(rand() * 9), secondary: [ 9, 10, 12, 13, 15 ][Math.floor(rand() * 5)], hatID: rand() < .3 ? 53 : 7 } ] : [],
      packets: Math.floor(rand() * 119)
    });
    if (w.my.isTrapped) w.my.trappedIn = { health: 100, pos: { current: h.vec(0, 0) } };
    if (rand() < .6) w.ah.recordDamage([ 5, 20, 30, 35, 45, 67.5 ][Math.floor(rand() * 6)]);
    clock.advance(Math.floor(rand() * 400));
    tick(w, 1);
    if (w.ah.plan.hat !== null) seen.add(w.ah.plan.hat);
    if (w.mh.forceHat !== null) seen.add(w.mh.forceHat);
  }
  // and again over calm states, where the bull pump is the branch that fires
  for (let i = 0; i < 400; i++) {
    const w = makeClient({
      my: { health: 65 + Math.floor(rand() * 35), food: 0, shame: 1 + Math.floor(rand() * 7) },
      enemies: rand() < .3 ? [ { x: 400 + rand() * 400, y: 0, primary: 5 } ] : []
    });
    tick(w, 1);
    if (w.ah.plan.hat !== null) seen.add(w.ah.plan.hat);
    if (w.mh.forceHat !== null) seen.add(w.mh.forceHat);
  }
  const list = [ ...seen ].sort((a, b) => a - b);
  check('hats · only soldier and bull are ever asserted', list.every(x => x === 6 || x === 7), 'saw ' + JSON.stringify(list));
  check('hats · both are actually used', list.length === 2, 'saw ' + JSON.stringify(list));
})();

// ===========================================================================
// THE INVARIANT — shame never reaches 8, against a modelled server
// ===========================================================================
(function shameNeverEight() {
  // A simulated server applying game_index.js:2454 verbatim, with a round trip
  // between the two clocks so the client only ever sees the counter late.
  let rng = 99991;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let worst = 0;
  let lockouts = 0;
  let scrubs = 0;
  let payments = 0;

  for (let run = 0; run < 60; run++) {
    const rtt = 40 + rand() * 180;
    const server = { shame: 0, hitTime: 0, timer: 0 };
    const w = makeClient({ my: { health: 100, food: 0, shame: 0 } });
    // Route the client's consumes through the server model.
    const inFlightHeals = [];
    const inFlightShame = [];
    w.mh._rawHeal = function () {
      this.rawHeals += 1;
      w.packets.count += 3;
      w.ah.noteConsume();
      inFlightHeals.push(h.clock.get() + rtt / 2);
    };

    for (let t = 0; t < 400; t++) {
      // --- server side ------------------------------------------------
      const nowServer = h.clock.get();
      while (inFlightHeals.length && inFlightHeals[0] <= nowServer) {
        inFlightHeals.shift();
        if (server.hitTime) {
          const gap = nowServer - server.hitTime;
          server.hitTime = 0;
          if (gap <= 120) {
            server.shame += 1;
            if (server.shame >= 8) { server.timer = 30000; server.shame = 0; lockouts += 1; }
            payments += 1;
          } else {
            server.shame = Math.max(0, server.shame - 2);
            scrubs += 1;
          }
        }
        if (server.shame > worst) worst = server.shame;
      }
      if (server.timer > 0) server.timer = Math.max(0, server.timer - 111);

      // --- damage -----------------------------------------------------
      const hostile = rand() < .45;
      let damage = 0;
      if (hostile) damage = [ 20, 30, 35, 45, 67.5, 5 ][Math.floor(rand() * 6)];
      if (w.my.hatID === M.AH.BULL && t % 9 === 0) damage = Math.max(damage, 5);
      if (damage > 0) {
        server.hitTime = nowServer;
        w.my.tempHealth = Math.max(1, w.my.tempHealth - damage);
        w.my.currentHealth = w.my.tempHealth;
        // the client sees it half a round trip later; close enough at tick scale
        w.ah.recordDamage(damage);
      } else if (w.mh.rawHeals > 0) {
        w.my.tempHealth = Math.min(100, w.my.tempHealth + 20);
        w.my.currentHealth = w.my.tempHealth;
      }
      // the client's own view of the counter, one round trip behind
      inFlightShame.push({ at: nowServer + rtt, value: server.shame, active: server.timer > 0 });
      while (inFlightShame.length && inFlightShame[0].at <= nowServer) {
        const seen = inFlightShame.shift();
        w.my.shameCount = seen.value;
        w.my.shameActive = seen.active;
      }

      w.em.potentialDamage = hostile ? 20 + rand() * 60 : 0;
      w.em.detectedEnemy = hostile;
      w.em.detectedDangerEnemy = hostile && rand() < .2;
      w.mh.rawHeals = 0;
      w.packets.count = Math.max(0, w.packets.count - 12);
      tick(w, 1);
      if (w.ah.plan.hat === M.AH.BULL) w.my.hatID = M.AH.BULL;
      else if (w.ah.plan.hat === M.AH.SOLDIER) w.my.hatID = M.AH.SOLDIER;
    }
  }
  check('invariant · server shame never reached 8', lockouts === 0, 'lockouts=' + lockouts);
  check('invariant · peak shame stayed at or under 7', worst <= 7, 'worst=' + worst);
  check('invariant · the scrubber actually scrubs', scrubs > 0, 'scrubs=' + scrubs + ' payments=' + payments);
  console.log('  [sim] peak shame ' + worst + ', scrubs ' + scrubs + ', increments ' + payments + ', lockouts ' + lockouts);
})();

report();
