"use strict";
// Placement system tests. Run: node ryn-type2/tests/placement.test.js
const h = require("./harness.js");
const { lib, clock, FakeClient, serverLegal, test, assert } = h;
const { Items, RynAngles, GeometrySolver, Vector_default: Vector, RPE_PRIORITY } = lib;

// Deterministic PRNG so every run sees the same boards.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = s + 0x6D2B79F5 >>> 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const OBJ_TYPES = [ 6, 15, 3, 10 ];
function randomBoard(c, r, n, spread = 180, owners = [ 1, 200 ], minD = 60) {
  const me = c.myPlayer.pos.current;
  // Nothing the player would be standing inside: the server would have
  // pushed them out of it.
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = minD + r() * spread;
    const x = me.x + Math.cos(a) * d, y = me.y + Math.sin(a) * d;
    const roll = r();
    if (roll < .12) {
      const scale = roll < .06 ? 150 : 90;
      if (d < 35 + scale * (roll < .06 ? .6 : 1) + 2) continue;
      c.ObjectManager.resource(roll < .06 ? 0 : 2, x, y, scale);
    } else {
      const type = OBJ_TYPES[Math.floor(r() * OBJ_TYPES.length)];
      const item = Items[type];
      if (!item.ignoreCollision && d < 35 + item.scale * (item.colDiv || 1) + 2) continue;
      c.ObjectManager.build(type, x, y, owners[Math.floor(r() * owners.length)]);
    }
  }
}
// The server's verdict on grid index k from origin o, for the profile's item.
function serverAt(c, profile, o, k, ignore) {
  const a = k / 100;
  return serverLegal(c.ObjectManager, profile.id, o.x + profile.ringR * Math.cos(a), o.y + profile.ringR * Math.sin(a), ignore);
}
function allLegal(c, profile, o, ignore) {
  const out = [];
  for (let k = -314; k <= 314; k++) if (serverAt(c, profile, o, k, ignore)) out.push(k);
  return out;
}
const circ = (a, b) => {
  const d = Math.abs(a - b) % 629;
  return d > 314.5 ? 629 - d : d;
};

// ════════════════════════════════════════════════════════════════════════════
// J/K. Angle system: exact solve, quantization, revalidation
// ════════════════════════════════════════════════════════════════════════════
test("angles: every candidate is a legal wire angle at the server (2000 boards)", () => {
  const r = rng(1);
  let cands = 0, boards = 0;
  for (let b = 0; b < 2000; b++) {
    const c = new FakeClient({ x: 2000 + r() * 8000, y: 1000 + r() * 5500 });
    randomBoard(c, r, 2 + Math.floor(r() * 18));
    for (const type of [ 4, 7 ]) {
      const profile = c.engine.profileFor(type);
      const o = c.myPlayer.pos.current;
      const sol = c.engine.solveAt(profile, o, null);
      const list = RynAngles.candidates(sol, { featureLen: 17.5, focus: [ { x: o.x + 100, y: o.y, r: 35 } ] });
      for (const cand of list) {
        cands++;
        assert(serverAt(c, profile, o, cand.k), "candidate k=" + cand.k + " refused by server on board " + b);
        assert(Math.abs(lib.wireAngle(cand.angle) - cand.angle) < 1e-12, "candidate angle is not on the wire grid");
      }
    }
    boards++;
  }
  assert(cands > 10000, "too few candidates exercised: " + cands);
});

test("angles: snap() finds the nearest legal wire angle, and null iff none exists", () => {
  const r = rng(2);
  let nulls = 0, checks = 0;
  for (let b = 0; b < 600; b++) {
    const c = new FakeClient({ x: 3000 + r() * 3000, y: 3000 });
    randomBoard(c, r, Math.floor(r() * 30), 140);
    const profile = c.engine.profileFor(r() < .5 ? 4 : 7);
    const o = c.myPlayer.pos.current;
    const sol = c.engine.solveAt(profile, o, null);
    const legal = allLegal(c, profile, o);
    for (let t = 0; t < 8; t++) {
      const k0 = Math.floor(r() * 629) - 314;
      const k = RynAngles.snap(sol, k0);
      checks++;
      if (legal.length === 0) {
        assert(k === null, "snap returned an angle on a ring with none legal");
        nulls++;
        continue;
      }
      assert(k !== null, "snap returned null with " + legal.length + " legal angles");
      assert(legal.indexOf(k) !== -1, "snap returned an illegal angle");
      let best = Infinity;
      for (const l of legal) best = Math.min(best, circ(l, k0));
      assert(circ(k, k0) === best, "snap not nearest: got " + circ(k, k0) + " best " + best);
    }
  }
  assert(nulls > 0, "no fully blocked ring was exercised");
});

test("angles: no legal wire angle is ever missed by the interval solve (complete)", () => {
  const r = rng(3);
  for (let b = 0; b < 400; b++) {
    const c = new FakeClient({ x: 3000 + r() * 3000, y: 3000 + r() * 2000 });
    randomBoard(c, r, 4 + Math.floor(r() * 20), 150);
    const profile = c.engine.profileFor(4);
    const o = c.myPlayer.pos.current;
    const sol = c.engine.solveAt(profile, o, null);
    for (const k of allLegal(c, profile, o)) {
      assert(RynAngles.rangeOf(sol, k) !== -1, "legal k=" + k + " outside every solved range");
      assert(RynAngles.clearanceAt(sol, k) >= 0, "legal k=" + k + " refused by clearanceAt");
    }
  }
});

test("angles: narrow gap is enumerated in full; a sub-grid gap is reported, not rounded", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const profile = c.engine.profileFor(4);
  const o = c.myPlayer.pos.current;
  const R = profile.ringR, F = profile.footR, B = Items[6].scale;
  // Two spikes either side of angle 0, placed so the legal arc between them
  // at the ring is a few grid steps wide.
  // `mid` is the gap's centre angle: on a grid point, or halfway between two.
  const place = (half, mid = 0) => {
    const cc = new FakeClient({ x: 3000, y: 3000 });
    const d = 150;
    // occlusion half-width at the ring for a blocker at distance d
    const occ = Math.acos((R * R + d * d - (F + B) ** 2) / (2 * R * d));
    const centre = occ + half;
    cc.ObjectManager.build(6, o.x + d * Math.cos(mid + centre), o.y + d * Math.sin(mid + centre), 1);
    cc.ObjectManager.build(6, o.x + d * Math.cos(mid - centre), o.y + d * Math.sin(mid - centre), 1);
    return cc;
  };
  const wide = place(.035);
  const s1 = wide.engine.solveAt(profile, o, null);
  const legal = allLegal(wide, profile, o).filter(k => Math.abs(k) < 20);
  const cands = RynAngles.candidates(s1, { featureLen: 17.5 }).filter(cc => Math.abs(cc.k) < 20).map(cc => cc.k).sort((a, b) => a - b);
  assert(legal.length >= 5 && legal.length <= 9, "setup: gap has " + legal.length + " legal indices");
  assert(JSON.stringify(cands) === JSON.stringify(legal), "narrow gap not enumerated in full: " + cands + " vs " + legal);
  const thin = place(.003, .005);
  const s2 = thin.engine.solveAt(profile, o, null);
  const an = RynAngles.analyze(s2, 17.5);
  assert(allLegal(thin, profile, o).filter(k => Math.abs(k) < 20).length === 0, "setup: thin gap should hold no wire angle");
  assert(an.unrepresentable >= 1, "sub-grid gap not reported as unrepresentable");
  assert(RynAngles.candidates(s2, { featureLen: 17.5 }).every(cc => Math.abs(cc.k) >= 20), "a candidate was rounded into the sub-grid gap");
});

test("angles: candidate count follows the geometry, not a fixed resolution", () => {
  const counts = [];
  for (const n of [ 0, 3, 8, 16 ]) {
    const c = new FakeClient({ x: 3000, y: 3000 });
    const r = rng(40 + n);
    randomBoard(c, r, n, 130);
    const profile = c.engine.profileFor(4);
    const sol = c.engine.solveAt(profile, c.myPlayer.pos.current, null);
    counts.push(RynAngles.candidates(sol, { featureLen: 17.5 }).length);
  }
  for (const n of counts) assert([ 36, 72, 144, 200, 628, 629 ].indexOf(n) === -1, "count equals a fixed resolution: " + n);
  assert(new Set(counts).size >= 3, "count did not adapt: " + counts);
});

test("angles: dense regions put every few grid steps on the ground that touches the target", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const profile = c.engine.profileFor(4);
  const o = c.myPlayer.pos.current;
  const sol = c.engine.solveAt(profile, o, null);
  const E = { x: o.x + 110, y: o.y };
  const touch = profile.footR + 35;
  const list = RynAngles.candidates(sol, { featureLen: 17.5, dense: [ { x: E.x, y: E.y, r: touch, stride: 3 } ] });
  const touching = list.filter(cc => Math.hypot(cc.x - E.x, cc.y - E.y) < touch).map(cc => cc.k).sort((a, b) => a - b);
  assert(touching.length >= 20, "too few contact candidates: " + touching.length);
  for (let i = 1; i < touching.length; i++) assert(touching[i] - touching[i - 1] <= 3, "gap in contact arc");
  const away = list.filter(cc => Math.hypot(cc.x - E.x, cc.y - E.y) > touch + 30).length;
  assert(away < 30, "open ground is not sparse: " + away);
});

test("angles: the old fixed 200-lattice sends refused builds that the solver never does", () => {
  // The pre-rebuild placer checked i * 2pi / 200 continuously, then the wire
  // rounded it to 0.01 rad. Measured on the same boards.
  const r = rng(5);
  let oldSent = 0, oldRefused = 0, newSent = 0, newRefused = 0;
  for (let b = 0; b < 1500; b++) {
    const c = new FakeClient({ x: 3000 + r() * 4000, y: 2000 + r() * 3000 });
    randomBoard(c, r, 6 + Math.floor(r() * 18), 130);
    const profile = c.engine.profileFor(4);
    const o = c.myPlayer.pos.current;
    const sol = c.engine.solveAt(profile, o, null);
    const aps = sol.apertures;
    for (let i = 0; i < 200; i++) {
      const a = i * Math.PI * 2 / 200;
      if (GeometrySolver.inAperture(aps, a) === null) continue;
      // Only the packed ends of runs — the angles the ladder prefers.
      const prev = (i + 199) % 200, next = (i + 1) % 200;
      const pOk = GeometrySolver.inAperture(aps, prev * Math.PI * 2 / 200) !== null;
      const nOk = GeometrySolver.inAperture(aps, next * Math.PI * 2 / 200) !== null;
      if (pOk && nOk) continue;
      oldSent++;
      if (!serverAt(c, profile, o, RynAngles.k(a))) oldRefused++;
    }
    for (const cand of RynAngles.candidates(sol, { featureLen: 17.5 })) {
      if (!cand.edge) continue;
      newSent++;
      if (!serverAt(c, profile, o, cand.k)) newRefused++;
    }
  }
  h.metrics.lattice = { oldSent, oldRefused, newSent, newRefused };
  assert(newRefused === 0, "solver edge refused " + newRefused);
  assert(oldRefused > 0, "expected the lattice to lose some edges to rounding");
});

// ════════════════════════════════════════════════════════════════════════════
// M. Latency model
// ════════════════════════════════════════════════════════════════════════════
test("clock: round trip EWMA, deviation and minimum", () => {
  const k = new lib.RynNetClock;
  for (let i = 0; i < 40; i++) k.onRtt(80 + (i % 2 ? 10 : -10));
  assert(Math.abs(k.rtt - 80) < 3, "srtt " + k.rtt);
  assert(k.rttvar > 6 && k.rttvar < 14, "rttvar " + k.rttvar);
  assert(k.minRtt === 70, "minRtt " + k.minRtt);
  k.onRtt(5000);
  assert(Math.abs(k.rtt - 80) < 3, "absurd sample was not ignored");
  for (let i = 0; i < 40; i++) k.onRtt(200);
  assert(Math.abs(k.rtt - 200) < 10, "did not converge to a real change: " + k.rtt);
});

test("clock: tick period and jitter track server update variation", () => {
  const k = new lib.RynNetClock;
  let t = 0;
  const r = rng(7);
  for (let i = 0; i < 400; i++) {
    t += 118 + (r() - .5) * 20;
    k.onTick(t);
  }
  assert(Math.abs(k.period - 118) < 2, "period " + k.period);
  assert(k.jitter > 2 && k.jitter < 8, "jitter " + k.jitter);
  k.onTick(t + 900);
  assert(Math.abs(k.period - 118) < 2, "a stalled frame moved the period");
});

test("clock: sendTimeFor lands at T_seq + offset whatever the up/down split", () => {
  for (const [ up, down ] of [ [ 10, 90 ], [ 50, 50 ], [ 90, 10 ], [ 140, 110 ] ]) {
    const k = new lib.RynNetClock;
    for (let i = 0; i < 20; i++) k.onRtt(up + down);
    const P = 1000 / 9;
    const T = n => 5000 + n * P;
    for (let n = 0; n < 8; n++) k.onTick(T(n) + down);
    const seq = k.tickSeq + 2;
    for (const off of [ 2, 7, 15 ]) {
      const S = k.sendTimeFor(seq, off);
      const arrival = S + up;
      const target = T(7 + 2) + off;
      assert(Math.abs(arrival - target) < 1e-6, "split " + up + "/" + down + ": off by " + (arrival - target));
    }
  }
});

test("clock: arrival ticks follow the round trip (high ping does not mean waiting)", () => {
  const c = new FakeClient();
  c.warmClock(60);
  assert(c.engine.clock.arrivalTicks(clock.now()) === 0, "60ms should arrive inside the tick");
  const c2 = new FakeClient();
  c2.warmClock(260);
  const n = c2.engine.clock.arrivalTicks(clock.now());
  assert(n === 2, "260ms should arrive two ticks on, got " + n);
});

test("movement: the arrival model's collision is the game's (moomoo_1 checkCollision)", () => {
  // player.scale + getScale(): spike 35 + 49 = 84, contact at <=, pushed out
  // to exactly 84, velocity x.75; an enemy spike adds 1.5 along the push; a
  // player is pushed apart by half the overlap; no margin anywhere.
  const c = new FakeClient({ x: 3000, y: 3000 });
  const own = c.ObjectManager.build(6, 3080, 3000, 1);
  const theirs = c.ObjectManager.build(6, 3080, 3000, 200);
  const m = new lib.RynArrivalMovement;
  const me = { collisionScale: 35 };
  Object.assign(m, { x: 3000, y: 3000, xVel: .2, yVel: 0 });
  assert(m.checkCollision(me, own, 1, false) === true, "contact at 80 not detected");
  assert(Math.abs(m.x - (3080 - 84)) < 1e-9 && Math.abs(m.y - 3000) < 1e-9, "not pushed to exactly 84: " + m.x);
  assert(Math.abs(m.xVel - .15) < 1e-12, "velocity not kept at .75");
  Object.assign(m, { x: 2996, y: 3000, xVel: 0, yVel: 0 });
  assert(m.checkCollision(me, own, 1, false) === true, "contact at exactly 84 (<=) not detected");
  Object.assign(m, { x: 2995.9, y: 3000, xVel: 0, yVel: 0 });
  assert(m.checkCollision(me, own, 1, false) === false, "collided beyond 84: the 5-unit margin is back");
  Object.assign(m, { x: 3000, y: 3000, xVel: 0, yVel: 0 });
  m.checkCollision(me, theirs, 1, true);
  assert(Math.abs(m.xVel + 1.5) < 1e-12, "enemy spike knockback missing: " + m.xVel);
  const other = new h.FakePlayer(9, 3060, 3000);
  Object.assign(m, { x: 3000, y: 3000, xVel: 0, yVel: 0 });
  m.checkCollision(me, other, 1, false);
  assert(Math.abs(m.x - (3000 - 5)) < 1e-9, "player push is not half the overlap: " + m.x);
});

module.exports = { rng, randomBoard, serverAt, allLegal };
if (require.main === module) {
  require("./scenarios.test.js");
  process.exitCode = h.report();
  console.log("\nmeasurements:");
  for (const [k, v] of Object.entries(h.metrics)) console.log("  " + k + " " + JSON.stringify(v));
}
