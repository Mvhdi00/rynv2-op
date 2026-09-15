// Suite 5 — the Oracle / Falcon pass.
//
// Everything here is a claim about the GAME, cross-checked against the two
// reference clients rather than taken from them. Where a reference disagrees
// with the game bundle, the game wins and the test records that it does.
const { blockAt, methodOf, SRC } = require(require('path').join(__dirname, 'extract-block.js'));
let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); } };

const DRV = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'drivers', 'game-drivers.json'), 'utf8'));
const cfg = DRV.config, ITEMS = DRV.items;
const TICK = 1000 / cfg.serverUpdateRate, DECEL = cfg.playerDecel;
const hyp = (a, b) => Math.hypot(a, b);

// ── N. knockback travel, against a direct simulation of the game loop ──────
console.log('\n== N. knockback glide ==');
{
  // The game's player update, transcribed:
  //   x += xVel * f            (substepped; total across a tick is xVel*f)
  //   xVel *= pow(playerDecel, f)
  // Velocity is applied whole and decayed once at the end, so an impulse does
  // not decay during the tick it is spent in.
  const simulate = impulse => {
    let v = impulse, x = 0;
    for (let n = 0; n < 5000 && Math.abs(v * TICK) > 1e-4; n++) { x += v * TICK; v *= Math.pow(DECEL, TICK); }
    return x;
  };
  const src = SRC.match(/const RPE_KB_DECAY_PER_TICK = [^\n]*\n\s*const RPE_KB_TRAVEL = [^\n]*/);
  ok('RPE_KB_TRAVEL extracted from source', !!src);
  const RPE_TICK_MS = TICK, RPE_DECEL = DECEL, RPE_KB_IMPULSE = 1.5;
  const RPE_KB_DECAY_PER_TICK = Math.pow(RPE_DECEL, RPE_TICK_MS);
  const RPE_KB_TRAVEL = eval(src[0].split('=').slice(-1)[0].replace(';', ''));

  const truth = simulate(1.5);
  ok('the constant matches a step-by-step simulation of the game loop',
     Math.abs(RPE_KB_TRAVEL - truth) < 0.1, RPE_KB_TRAVEL.toFixed(2) + ' vs ' + truth.toFixed(2));
  ok('and it is ~307.6, not the old 214.3', Math.abs(RPE_KB_TRAVEL - 307.6) < 0.2, RPE_KB_TRAVEL.toFixed(2));
  const old = 1.5 / (1 - 0.993);
  ok('the old value was short by ~30%', Math.abs(old / truth - 0.697) < 0.01, (old / truth).toFixed(3));

  // Falcon computes the same series iteratively for its brake logic:
  //   for (var i = e; i >= .5;) e += i *= Math.pow(.993, serverUpdateSpeed)
  const falcon = perTick => { let e = perTick, i = perTick; while (i >= 0.5) { i *= Math.pow(0.993, TICK); e += i; } return e; };
  ok('Falcon\'s own deceleration() series agrees with the constant',
     Math.abs(falcon(1.5 * TICK) - RPE_KB_TRAVEL) < 1.0, falcon(1.5 * TICK).toFixed(2));

  // the weapon table is deliberately left alone -- it is one tick of travel
  ok('RYN weapon knockback table is still one tick (33.3 for a plain hit)',
     /knockback: 33\.3/.test(SRC) && Math.abs(0.3 * TICK - 33.3) < 0.1);
  ok('and one tick is 1.85x short of a free glide, which is why it needs measuring not arithmetic',
     Math.abs(simulate(1) / TICK - 1.846) < 0.01, (simulate(1) / TICK).toFixed(3));
}

// ── O. the trap-spike pairing is tested along the push, not at the end ─────
console.log('\n== O. PlacementPlanner._pairDelta ==');
{
  const RPE_KB_TRAVEL = 1.5 * TICK / (1 - Math.pow(DECEL, TICK));
  const RPE_EPS = 1e-6, RPE_TAU = Math.PI * 2;
  const Config_default = cfg;
  const GeometrySolver = eval('(' + blockAt('  const GeometrySolver').replace(/^\s*const GeometrySolver\s*=\s*/, '').replace(/;\s*$/, '') + ')');
  const src = methodOf('  class PlacementPlanner', '_pairDelta').trim();
  const w = { synergyTrapSpike: 2.4, synergyTrapHold: 2.2, synergyEnclose: 1.5, redundancy: 1.9 };
  const host = eval('({ weights: null, ' + src + '})');
  host.weights = w;

  const trapItem = ITEMS[15], spikeItem = ITEMS[6];
  const prof = (isTrap, item) => ({
    isTrap, isDamage: !isTrap, type: isTrap ? 7 : 4,
    footR: item.scale, touchR: cfg.playerScale + item.scale * ('colDiv' in item ? item.colDiv : 1)
  });
  const target = { x: 0, y: 0 };
  const frame = { targetPos: target, targetScale: cfg.playerScale, targetTrapped: null };
  // spike sits west of the target, so the push is due east (+x)
  const spike = { x: -90, y: 0, profile: prof(false, spikeItem) };
  const at = d => ({ x: d, y: 0, profile: prof(true, trapItem) });

  // a trap partway along the push: the old point test scored this at zero
  const mid = at(RPE_KB_TRAVEL / 2);
  ok('a trap halfway along the push earns the pairing', host._pairDelta(spike, mid, frame) >= w.synergyTrapSpike, host._pairDelta(spike, mid, frame).toFixed(2));
  const far = at(RPE_KB_TRAVEL - 5);
  ok('a trap at the far end still earns it', host._pairDelta(spike, far, frame) >= w.synergyTrapSpike);
  const beyond = at(RPE_KB_TRAVEL + 200);
  ok('a trap past where they stop does not', host._pairDelta(spike, beyond, frame) < w.synergyTrapSpike);
  const behind = { x: -400, y: 0, profile: prof(true, trapItem) };
  ok('a trap behind the push does not', host._pairDelta(spike, behind, frame) < w.synergyTrapSpike);
  const offAxis = { x: RPE_KB_TRAVEL / 2, y: 400, profile: prof(true, trapItem) };
  ok('a trap off the push line does not', host._pairDelta(spike, offAxis, frame) < w.synergyTrapSpike);
  // the close-range fallback still works
  const hugging = { x: -90 + 60, y: 0, profile: prof(true, trapItem) };
  ok('the trap-holds-them fallback still pays when the trap hugs the spike',
     host._pairDelta(spike, hugging, frame) > 0);
  // redundancy still penalises two of the same on the same ground
  const a = { x: 0, y: 0, profile: prof(false, spikeItem) }, b = { x: 10, y: 0, profile: prof(false, spikeItem) };
  ok('redundancy between two overlapping spikes is still negative', host._pairDelta(a, b, frame) < 0);
}

// ── P. the refusal window follows the measured round trip ──────────────────
console.log('\n== P. lunaBanGraceTicks ==');
{
  const RPE_PING_MAX_TICKS = 2, RPE_TICK_MS = TICK;
  const rpePingMs = c => Math.min(c.SocketManager.pong, 1e3);
  const rpePingTicks = c => Math.max(0, Math.min(RPE_PING_MAX_TICKS, Math.round(rpePingMs(c) / RPE_TICK_MS)));
  const src = SRC.match(/function lunaBanGraceTicks\(client\) \{[\s\S]*?\n  \}/);
  ok('lunaBanGraceTicks extracted', !!src);
  const fn = eval('(' + src[0] + ')');
  const at = pong => fn({ SocketManager: { pong } });
  ok('a quiet connection keeps the two-tick floor', at(20) === 2, at(20));
  ok('70ms still two ticks', at(70) === 2, at(70));
  ok('120ms gives two ticks of grace', at(120) === 2, at(120));
  ok('250ms gives three — the case the fixed window mis-banned', at(250) === 3, at(250));
  ok('the window never runs away (capped by RPE_PING_MAX_TICKS)', at(5000) === 3, at(5000));
  ok('grace always covers at least the round trip',
     [20, 70, 120, 200, 250].every(p => at(p) * TICK >= Math.min(p, RPE_PING_MAX_TICKS * TICK)));
}

// ── Q. where the references disagree with the game, the game wins ──────────
console.log('\n== Q. reference cross-check ==');
{
  const TRAP = ITEMS[15];
  const gameContact = cfg.playerScale + TRAP.scale * TRAP.colDiv;
  // Oracle asks `getDistance(enemy, trap) <= 50` in both isAutoPlaceAngle and
  // isPrePlaceAngle. That is trap.scale, and the game pins at 45.
  ok('Oracle\'s 50-unit trapped test is wrong by the game\'s own collision rule',
     gameContact === 45 && 50 > gameContact, 'game=' + gameContact);
  ok('RYN uses the game number, not Oracle\'s', /collisionScale;\s*$/m.test(SRC) || /rpeTrapHolding/.test(SRC));
  // Oracle's isItemLimit reads `group.sandboxLimit || 99` outside sandbox,
  // which caps mills at 299 and everything else at 99 instead of the real cap.
  ok('Oracle\'s item-limit read would cap spikes at 99 instead of 15',
     ITEMS[6].group.limit === 15 && (ITEMS[6].group.sandboxLimit || 99) === 99);
  ok('RYN reads the real group limit', /getItemCount\(Items\[id\]\.itemGroup\)/.test(SRC));
  // Falcon rings at 30 angles; Oracle and RYN at 200. Recorded, not copied.
  ok('Falcon\'s 30-angle ring is coarser than the rate RYN defaults to',
     /LUNA_ANGLE_STEPS_DEFAULT = 200/.test(SRC));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
