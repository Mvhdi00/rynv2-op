#!/usr/bin/env node
/*
 * perf-autoheal.js
 *
 * The performance half of the audit, measured rather than asserted.
 *
 * It wraps the engine's real HostAdapter — the only object in the engine that
 * touches the client — and counts every call it makes, per tick, across the
 * workloads that cost the most: a crowded field, a busy fight, a quiet one, and
 * a high-latency one. What the counts answer, in the order the brief asks:
 *
 *   duplicate calculations    an adapter read called more than once a tick
 *   unnecessary loops         enemyList / incomingProjectiles walked twice
 *   duplicate state tracking  two components keeping the same history
 *   stale caches              prediction cache hit rate, and whether a cached
 *                             answer survives a world change
 *   excessive recalculation   predictions rebuilt per tick
 *   duplicate packets         frames per press against the 2N+1 floor
 *   duplicate healing         presses buying health already bought
 *
 * Every number has a budget at the bottom, so a regression fails the run rather
 * than printing a bigger number nobody reads.
 *
 *   node tools/perf-autoheal.js
 */

const { Sim, makeEnemy, makeProjectile } = require("./sim-autoheal.js");

/* Adapter methods that read the client. */
const READS = [
  "snapshot", "liveState", "enemyList", "incomingProjectiles",
  "spikeContext", "trapContext", "turretContext", "healingPadRegen",
  "borrowTargetMotion", "priorityClass", "_resolvePriorityClass",
  "priorityOf", "packetsLeft"
];
/* Adapter methods that put frames on the wire. */
const WRITES = [
  "pressFood", "pressFoodOnly", "restoreWeapon", "claimTick", "requestBullHat"
];

/* Reads whose whole purpose is to happen again at the moment of pressing.
 * `liveState` is the pre-wire re-read the brief requires; `packetsLeft` is
 * checked once per press inside a burst for the same reason. Everything else
 * is gathering, and gathering twice in one tick is duplicated work. */
const EXECUTION_PATH = new Set(["liveState", "packetsLeft", "priorityClass"]);

/* Reads that resolve to a constant and are memoised. The budget is on the
 * whole run, not per tick: there are seven priority classes, so seven
 * resolutions is every one of them done once and never again. */
const MEMOISED = { _resolvePriorityClass: 7 };

function measure(label, build) {
  const sim = build();
  const counts = {};
  const adapter = sim.engine.adapter;
  for (const name of READS.concat(WRITES)) {
    const original = adapter[name];
    if (typeof original !== "function") continue;
    adapter[name] = function (...args) {
      counts[name] = (counts[name] || 0) + 1;
      return original.apply(this, args);
    };
  }

  /* Running totals snapshotted at each tick boundary, so a per-tick delta can
   * be taken afterwards without disturbing the engine. */
  const marks = [];
  sim.onTickStart = () => marks.push(Object.assign({}, counts));

  sim.play();
  marks.push(Object.assign({}, counts));

  const peak = {};
  const total = {};
  for (const name of READS.concat(WRITES)) {
    let hi = 0;
    for (let i = 1; i < marks.length; i++) {
      const d = (marks[i][name] || 0) - (marks[i - 1][name] || 0);
      if (d > hi) hi = d;
    }
    peak[name] = hi;
    total[name] = counts[name] || 0;
  }
  return { label, ticks: sim.tick, peak, total, stats: sim.stats, sim };
}

/* ---------------------------------------------------------------- *
 * Workloads.
 * ---------------------------------------------------------------- */
const WORKLOADS = {
  /* Sixteen enemies and nothing happening: the per-enemy cost with no
   * healing to hide behind. */
  crowd() {
    const sim = new Sim({ foodId: 1 });
    const crowd = [];
    for (let i = 0; i < 16; i++) {
      crowd.push(makeEnemy({
        id: i + 1, x: 300 + i * 30, y: (i % 5) * 40,
        current: 7, primary: 7, primaryReload: 1
      }));
    }
    sim.play = () => {
      for (let t = 1; t <= 120; t++) sim.step(0, 0, { enemies: crowd });
    };
    return sim;
  },

  /* Everything at once, moving, with healing actually happening. */
  brawl() {
    const sim = new Sim({ foodId: 1, allowDeaths: true });
    sim.play = () => {
      for (let t = 1; t <= 120; t++) {
        const enemies = [];
        for (let i = 0; i < 6; i++) {
          const drift = (t + i * 7) % 40;
          enemies.push(makeEnemy({
            id: i + 1, x: 100 + drift * 12, px: 100 + (drift - 1) * 12,
            y: i * 25, current: i % 2 ? 5 : 7, primary: i % 2 ? 5 : 7,
            primaryReload: 1
          }));
        }
        sim.step(t % 3 === 0 ? 22 : 0, 45, {
          enemies,
          projectiles: t % 9 < 4 ? [makeProjectile({ type: 0, x: 500 })] : [],
          spike: t % 20 < 6 ? { willCollide: true, damage: 35 } : {},
          turret: 320
        });
      }
    };
    return sim;
  },

  /* Nothing on the field at all. Anything that still runs here is work the
   * engine does for its own sake. */
  quiet() {
    const sim = new Sim({ foodId: 1 });
    sim.play = () => { for (let t = 1; t <= 120; t++) sim.step(0, 0); };
    return sim;
  },

  /* 250ms, where a press stays invisible for three ticks — the workload that
   * makes an engine forget its own presses and send them again. */
  laggy() {
    const sim = new Sim({ foodId: 1, pong: 250 });
    const enemy = makeEnemy({ id: 1, x: 130, current: 5, primary: 5, primaryReload: 1 });
    sim.play = () => {
      for (let t = 1; t <= 120; t++) sim.step(t % 5 === 0 ? 28 : 0, 45, { enemies: [enemy] });
    };
    return sim;
  }
};

/* ---------------------------------------------------------------- *
 * Run and report.
 * ---------------------------------------------------------------- */
const pad = (s, n) => String(s).padEnd(n);
const rows = [];
for (const [name, build] of Object.entries(WORKLOADS)) rows.push(measure(name, build));

console.log("\nadapter calls per tick (peak)\n");
const gather = READS.filter(r => !EXECUTION_PATH.has(r));
console.log("  " + pad("read", 22) + rows.map(r => pad(r.label, 9)).join(""));
for (const name of gather) {
  console.log("  " + pad(name, 22) + rows.map(r => pad(r.peak[name], 9)).join(""));
}
console.log("\n  " + pad("(execution path)", 22));
for (const name of READS.filter(r => EXECUTION_PATH.has(r))) {
  console.log("  " + pad(name, 22) + rows.map(r => pad(r.peak[name], 9)).join(""));
}
console.log("\n  " + pad("(wire)", 22));
for (const name of WRITES) {
  console.log("  " + pad(name, 22) + rows.map(r => pad(r.total[name], 9)).join(""));
}

console.log("\nprediction and packets\n");
const line = (label, fn) =>
  console.log("  " + pad(label, 22) + rows.map(r => pad(fn(r), 9)).join(""));
line("ticks", r => r.ticks);
line("cache hit %", r => {
  const t = r.stats.cacheHits + r.stats.cacheMisses;
  return t ? Math.round((r.stats.cacheHits / t) * 100) + "%" : "-";
});
line("invalidations", r =>
  Object.values(r.stats.invalidations).reduce((a, b) => a + b, 0));
line("presses", r => r.stats.presses);
line("landed", r => r.stats.healedPresses);
line("packets", r => r.stats.packets);
line("packets/press", r =>
  r.stats.presses ? (r.stats.packets / r.stats.presses).toFixed(2) : "-");
line("dupes blocked", r => r.stats.duplicatesBlocked);

/* ---------------------------------------------------------------- *
 * Budgets.
 * ---------------------------------------------------------------- */
console.log("\nbudgets\n");
let failed = 0;
const check = (label, ok, detail) => {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(label, 52)}${detail || ""}`);
};

for (const r of rows) {
  /* Duplicate calculations and unnecessary loops: one gather per tick. The
   * engine reads the client once and publishes the result to whoever needs it,
   * so a second walk of the same list would show up here as a 2. */
  for (const name of gather) {
    if (MEMOISED[name] !== undefined) {
      check(`${r.label}: ${name} resolved once, then cached`,
        r.total[name] <= MEMOISED[name],
        r.total[name] > MEMOISED[name] ? `${r.total[name]} in ${r.ticks} ticks` : "");
      continue;
    }
    check(`${r.label}: ${name} at most once a tick`, r.peak[name] <= 1,
      r.peak[name] > 1 ? `peak ${r.peak[name]}` : "");
  }

  /* Duplicate packets: the floor for a burst of N presses is 2N + 1 — select
   * and attack per press, one weapon restore for the whole burst. */
  if (r.stats.presses) {
    const perPress = r.stats.packets / r.stats.presses;
    check(`${r.label}: at most 3 frames a press`, perPress <= 3,
      `${perPress.toFixed(2)}`);
  }

  /* Duplicate healing: every press that went out has to have bought health,
   * except deliberately free full-health wash presses. */
  const wasted = r.stats.presses - r.stats.healedPresses;
  check(`${r.label}: no press bought nothing`, wasted <= 2,
    wasted > 2 ? `${wasted} wasted` : "");
}

/* Stale caches: a cached prediction may only be served while nothing it was
 * built on has changed, so a still field should be almost all hits and a
 * moving one almost all misses. Both directions are a failure. */
const quiet = rows.find(r => r.label === "quiet");
const brawl = rows.find(r => r.label === "brawl");
const rate = r => {
  const t = r.stats.cacheHits + r.stats.cacheMisses;
  return t ? r.stats.cacheHits / t : 0;
};
check("a still field reuses its prediction", rate(quiet) >= 0.6,
  `${Math.round(rate(quiet) * 100)}%`);
check("a moving field does not", rate(brawl) <= 0.5,
  `${Math.round(rate(brawl) * 100)}%`);

console.log(failed
  ? `\nperf-autoheal: ${failed} budget(s) exceeded\n`
  : "\nperf-autoheal: all budgets met\n");
process.exit(failed ? 1 : 0);
