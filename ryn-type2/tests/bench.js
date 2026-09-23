"use strict";
// Placement performance. Run: node --expose-gc ryn-type2/tests/bench.js
//
// Wall-clock times are real (process.hrtime); the game clock the engine sees
// is the harness's virtual one, so a long run costs only the computation.
const { PerformanceObserver } = require("perf_hooks");
const h = require("./harness.js");
const { lib, FakeClient, Sim } = h;
const { RynAngles } = lib;
const T = require("./placement.test.js");
const P = 1000 / 9;

const now = () => Number(process.hrtime.bigint()) / 1e6;
function stats(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { n: s.length, mean: +mean.toFixed(4), p50: +q(.5).toFixed(4), p99: +q(.99).toFixed(4), max: +s[s.length - 1].toFixed(4) };
}
// Time every call of obj[name] into bucket.
function timeMethod(obj, name, bucket) {
  const orig = obj[name];
  obj[name] = function(...a) {
    const t0 = now();
    try {
      return orig.apply(this, a);
    } finally {
      bucket.push(now() - t0);
    }
  };
}
let gcs = 0;
new PerformanceObserver(list => {
  gcs += list.getEntries().length;
}).observe({ entryTypes: [ "gc" ] });

const out = {};

// ── 1. angle generation, by crowding ──────────────────────────────────────
for (const n of [ 0, 5, 20, 60 ]) {
  const c = new FakeClient({ x: 3000, y: 3000 });
  // A fight's worth of structures in the few hundred units that matter.
  // Structures from the edge of the ring outwards: the ring is partly
  // blocked, as in a fight, rather than sealed.
  T.randomBoard(c, T.rng(100 + n), n, 60 + n * 8, [ 1, 200 ], 120);
  const profile = c.engine.profileFor(4);
  const blockers = c.engine._blockersFor(c.myPlayer.pos.current);
  const times = [], counts = [];
  for (let i = 0; i < 3000; i++) {
    const t0 = now();
    const sol = RynAngles.solve(profile, 3000 + (i % 7) * .37, 3000, blockers, null, null);
    const list = RynAngles.candidates(sol, { featureLen: 17.5, focus: [ { x: 3100, y: 3010, r: 35 } ], dense: [ { x: 3100, y: 3010, r: 88, stride: 3 } ] });
    times.push(now() - t0);
    counts.push(list.length);
  }
  out["angles: solve+quantize+candidates, " + n + " objects (ms)"] = Object.assign(stats(times), { candidates: Math.round(counts.reduce((a, b) => a + b) / counts.length), blockers: blockers.length });
}

// ── 2. a fight, per stage ─────────────────────────────────────────────────
function fightRun(label, opts) {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  const r = T.rng(opts.seed || 5);
  const enemies = (opts.enemies || [ [ 170, 20 ] ]).map(([ dx, dy ], i) => c.addEnemy(me.x + dx, me.y + dy, 300 + i));
  T.randomBoard(c, r, opts.objects, opts.spread || 260, [ 1, 200 ], 130);
  const sim = new Sim(c, { up: opts.rtt / 2, down: opts.rtt / 2, autoPlacer: true, rand: r });
  const e = c.engine;
  const buckets = { tick: [], autoPlacer: [], engine: [], generate: [], predict: [], score: [], plan: [], validate: [], arm: [], antiRetrap: [] };
  timeMethod(c.autoPlacer, "postTick", buckets.autoPlacer);
  timeMethod(e, "postTick", buckets.engine);
  timeMethod(e, "generate", buckets.generate);
  timeMethod(e, "predict", buckets.predict);
  timeMethod(e, "score", buckets.score);
  timeMethod(e, "plan", buckets.plan);
  timeMethod(e, "validate", buckets.validate);
  timeMethod(e.timer, "arm", buckets.arm);
  timeMethod(e, "_armAntiRetrap", buckets.antiRetrap);
  const tick = c.tick.bind(c);
  c.tick = o => {
    const t0 = now();
    tick(o);
    buckets.tick.push(now() - t0);
  };
  // Cache accounting, without touching the engine: a solve is a miss of the
  // aperture cache; a blocker query is a miss of the blocker-set cache.
  let apCalls = 0, solves = 0, bfCalls = 0, bfQueries = 0;
  const ap = e._generator.apertures.bind(e._generator);
  e._generator.apertures = (...a) => {
    apCalls++;
    return ap(...a);
  };
  const solve = RynAngles.solve;
  RynAngles.solve = function(...a) {
    solves++;
    return solve.apply(this, a);
  };
  const bf = e._blockersFor.bind(e);
  e._blockersFor = o => {
    bfCalls++;
    return bf(o);
  };
  const ba = e._generator.blockersAround.bind(e._generator);
  e._generator.blockersAround = (...a) => {
    bfQueries++;
    return ba(...a);
  };
  // Movement and churn: enemies wander, our builds die now and then.
  sim.script.push((k, s) => {
    for (const en of enemies) {
      const p = en._next || en.pos.current;
      en._next = { x: p.x + 9 * Math.cos(k / 7 + en.id), y: p.y + 9 * Math.sin(k / 5 + en.id) };
    }
    if (k % 9 === 0) {
      for (const o of s.server.values()) if (o.ownerID === 1 && o.type === 6) {
        s.destroy(o);
        break;
      }
    }
  });
  if (opts.walk) sim.walk(opts.walk);
  const ticks = opts.ticks;
  sim.run(P * 20);
  for (const b of Object.values(buckets)) b.length = 0;
  apCalls = solves = bfCalls = bfQueries = 0;
  // Harness logs grow by design; they are cleared on both sides of the
  // window so the figure is the placement system's own retention.
  const clearLogs = () => {
    c._ModuleHandler.sends.length = 0;
    arrivalsSeen += sim.arrivals.length;
    refusedSeen += sim.arrivals.filter(a => !a.legal).length;
    sim.arrivals.length = 0;
  };
  let arrivalsSeen = 0, refusedSeen = 0;
  clearLogs();
  arrivalsSeen = refusedSeen = 0;
  if (global.gc) global.gc();
  const heap0 = process.memoryUsage().heapUsed;
  for (let i = 0; i < ticks; i += 100) {
    sim.run(P * Math.min(100, ticks - i));
    clearLogs();
  }
  if (global.gc) global.gc();
  const heap1 = process.memoryUsage().heapUsed;
  RynAngles.solve = solve;
  const res = {};
  for (const [k, v] of Object.entries(buckets)) if (v.length) res[k] = stats(v);
  res.cache = {
    aperturesHitRate: +(1 - solves / Math.max(1, apCalls)).toFixed(3),
    solvesPerTick: +(solves / ticks).toFixed(2),
    blockerSetHitRate: +(1 - bfQueries / Math.max(1, bfCalls)).toFixed(3),
    blockerQueriesPerTick: +(bfQueries / ticks).toFixed(2)
  };
  res.sends = arrivalsSeen;
  res.refused = refusedSeen;
  res.retainedGrowthKB = +((heap1 - heap0) / 1024).toFixed(1);
  res.stateSizes = {
    pending: e.outcomes.pending.length, bans: e.outcomes.bans.length, ghosts: e.outcomes.ghosts.length,
    timerEvents: e.timer.events.size, removed: e.outcomes.removed.size, ledger: e.ledger.entries.length,
    book: e.book.records.length, reservations: c._ModuleHandler._reservations.length
  };
  out[label] = res;
  return { c, sim };
}
fightRun("fight: 1 enemy, 30 objects, rtt 80, 3000 ticks", { objects: 30, spread: 420, rtt: 80, ticks: 3000 });
fightRun("fight: 3 enemies, 40 objects, rtt 220, walking, 2000 ticks", { objects: 40, spread: 420, rtt: 220, ticks: 2000, enemies: [ [ 170, 20 ], [ -150, 90 ], [ 30, -180 ] ], walk: .4 });
fightRun("object spam: 600 objects, 2 enemies, rtt 100, 800 ticks", { objects: 600, spread: 900, rtt: 100, ticks: 800, enemies: [ [ 170, 20 ], [ -150, 90 ] ] });

// ── 3. allocation per tick (young-generation, no GC inside the window) ────
{
  const c = new FakeClient({ x: 3000, y: 3000 });
  c.addEnemy(3170, 3020, 300);
  T.randomBoard(c, T.rng(9), 30, 420, [ 1, 200 ], 130);
  const sim = new Sim(c, { up: 40, down: 40, autoPlacer: true });
  sim.run(P * 30);
  const samples = [];
  for (let w = 0; w < 30; w++) {
    if (global.gc) global.gc();
    const g0 = gcs;
    const a = process.memoryUsage().heapUsed;
    sim.run(P * 20);
    const b = process.memoryUsage().heapUsed;
    c._ModuleHandler.sends.length = 0;
    sim.arrivals.length = 0;
    if (gcs === g0 && b > a) samples.push((b - a) / 20 / 1024);
  }
  out["allocation per tick (KB, windows without a GC)"] = samples.length ? stats(samples) : "every window collected";
}

// ── 4. anti-retrap plan build ─────────────────────────────────────────────
{
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  const trap = c.ObjectManager.build(15, me.x + 10, me.y, 200);
  c.myPlayer.isTrapped = true;
  c.myPlayer.trappedIn = trap;
  c.addEnemy(me.x + 110, me.y + 20, 200);
  c.addEnemy(me.x - 95, me.y - 60, 201);
  T.randomBoard(c, T.rng(3), 12, 200);
  const times = [];
  for (let i = 0; i < 2000; i++) {
    c.ObjectManager.revision++;
    const t0 = now();
    c.engine.antiRetrap.build(trap);
    times.push(now() - t0);
  }
  out["anti-retrap: covering plan, 2 enemies (ms)"] = stats(times);
}

console.log(JSON.stringify(out, null, 2));
