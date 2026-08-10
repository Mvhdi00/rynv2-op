#!/usr/bin/env node
/*
 * test-pathbreak.js
 *
 * Exercises the Path Break search worker out of the built userscript.
 *
 * The worker is the only part of the feature that can be run without a
 * browser and a live game, and it is the part where a mistake is invisible —
 * a subtly wrong physics term still returns a path, just one the player
 * cannot walk. So it gets driven two ways:
 *
 *   plan   one search per scenario, checking it finds a route and stays
 *          inside its time budget
 *   drive  closed loop — search, take the first direction, advance the world
 *          one tick, search again — which is how the module actually runs and
 *          the only way to catch a controller that plans well and then
 *          oscillates, stalls, or walks the long way round
 *
 * The world in `drive` is advanced with the worker's own simulateTick, so this
 * tests the controller, not the physics. The physics is checked by reading it
 * against MovementSimulation in the client, which is what it mirrors.
 *
 *   node tools/test-pathbreak.js [path/to/build.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BUILD = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "RYN_PathBreak.user.js");

/* ---- pull the worker source out of the build ---- */

function extractWorker(file) {
  const code = fs.readFileSync(file, "utf8");
  const decl = code.indexOf("const PATHBREAK_WORKER_SRC = `");
  if (decl === -1) throw new Error(`no PATHBREAK_WORKER_SRC in ${file}`);
  const open = code.indexOf("`", decl + "const PATHBREAK_WORKER_SRC = ".length);
  const close = code.indexOf("`;", open + 1);
  if (close === -1) throw new Error("unterminated PATHBREAK_WORKER_SRC");
  return code.slice(open + 1, close);
}

let result = null;
globalThis.self = {
  set onmessage(fn) { globalThis._pbOnMessage = fn; },
  postMessage(message) { result = message; }
};

const workerSource = extractWorker(BUILD);
/* Also hand back the internals so the driver can advance its world with the
 * same tick the search plans against. */
new Function(workerSource + `
globalThis._pbSimulate = simulateTick;
globalThis._pbBuildGrid = buildGrid;
globalThis._pbSetGrid = g => { GRID = g; };
globalThis._pbSetCfg = c => { CFG = c; };
`)();
const dispatch = globalThis._pbOnMessage;

/* ---- world fixtures ---- */

const TICK = 1e3 / 9;
const cfg = () => ({
  delta: TICK,
  decay: Math.pow(0.993, TICK),
  playerSpeed: 0.0016,
  playerDecel: 0.993,
  playerScale: 35,
  mapScale: 14400,
  snowBiomeTop: 2400,
  snowSpeed: 0.75,
  waterCurrent: 0.0011,
  riverMin: 14400 / 2 - 724 / 2,
  riverMax: 14400 / 2 + 724 / 2
});

const at = (x, y) => ({
  x, y, xVel: 0, yVel: 0, cs: 35, slowMult: 1, lockMove: false,
  buildMult: 1, weaponSpd: 1, skinSpd: 1, tailSpd: 1,
  coldM: false, watrImm: false, onPlatform: false
});

const obj = (x, y, extra) => Object.assign({
  x, y, cs: 50, moveOnTop: false, isPO: true, type: 4, angle: 0,
  boostSpeed: 0, isSpike: false, isCactus: false, isEnemy: true
}, extra);

const column = (x, y0, y1, step, extra) => {
  const out = [];
  for (let y = y0; y <= y1; y += step) out.push(obj(x, y, extra));
  return out;
};

const scattered = (count, seed) => {
  const out = [];
  let state = seed;
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < count; i++) {
    out.push(obj(4600 + random() * 1800, 4300 + random() * 1400, { cs: 40 + random() * 40 }));
  }
  return out;
};

const BUDGET_MS = 55;
const ARRIVE = 69;
const send = (objs, from, target, extra) => {
  result = null;
  const started = process.hrtime.bigint();
  dispatch({ data: Object.assign({
    id: 1, arrive: ARRIVE, maxTicks: 80, beamWidth: 120, budgetMs: BUDGET_MS,
    avoidSpikes: true, cfg: cfg(), near: null, player: from, objs, target
  }, extra) });
  return { ms: Number(process.hrtime.bigint() - started) / 1e6, out: result };
};

/* Scenarios. `reach` is whether a single search is expected to find a complete
 * route; `drive` is whether the closed loop is expected to get there.
 * The two long walls are deliberately unsolvable inside the time budget — in
 * game they are enemy buildings and the breaker takes over, which is the whole
 * point of the feature. They are here to pin that behaviour down: press up
 * against the wall, do not wander off, do not oscillate. */
const SCENARIOS = [
  { name: "open 900u",     objs: [],                                    from: [ 5000, 5000 ], to: [ 5900, 5000 ], drive: true },
  { name: "open 3000u",    objs: [],                                    from: [ 3000, 7000 ], to: [ 6000, 7000 ], drive: true },
  { name: "wall 400u",     objs: column(5400, 4800, 5200, 90),          from: [ 5000, 5000 ], to: [ 5900, 5000 ], drive: true },
  { name: "wall 800u",     objs: column(5400, 4600, 5400, 90),          from: [ 5000, 5000 ], to: [ 5900, 5000 ], drive: true },
  { name: "wall 1600u",    objs: column(5400, 4200, 5800, 90),          from: [ 5000, 5000 ], to: [ 5900, 5000 ], drive: false },
  { name: "spikes 400u",   objs: column(5400, 4800, 5200, 70, { cs: 35, isSpike: true, type: 6 }),
                                                                        from: [ 5000, 5000 ], to: [ 5900, 5000 ], drive: true },
  { name: "trap line",     objs: column(5300, 4800, 5200, 80, { cs: 10, moveOnTop: true, type: 15 }),
                                                                        from: [ 5000, 5000 ], to: [ 5900, 5000 ], drive: true },
  { name: "scattered 60",  objs: scattered(60, 7),                      from: [ 5000, 5000 ], to: [ 6300, 5000 ], drive: true },
  { name: "snow biome",    objs: [],                                    from: [ 5000, 1200 ], to: [ 5900, 1200 ], drive: true },
  { name: "in the river",  objs: [],                                    from: [ 5000, 7200 ], to: [ 5900, 7200 ], drive: true }
];

/* The JIT needs a few passes before timings mean anything; in the browser the
 * worker warms up over the first second of use the same way. */
for (let i = 0; i < 3; i++) {
  for (const s of SCENARIOS) send(s.objs, at(s.from[0], s.from[1]), { x: s.to[0], y: s.to[1] });
}

const failures = [];
const OVER_BUDGET = BUDGET_MS + 25; // one search may overshoot by part of a tick

console.log("plan  (one search per scenario)\n");
for (const s of SCENARIOS) {
  const target = { x: s.to[0], y: s.to[1] };
  const { ms, out } = send(s.objs, at(s.from[0], s.from[1]), target);
  const ok = out.path.length > 0 || out.arrived;
  const inBudget = ms <= OVER_BUDGET;
  if (!ok) failures.push(`${s.name}: search returned no path at all`);
  if (!inBudget) failures.push(`${s.name}: search took ${ms.toFixed(0)}ms, budget is ${BUDGET_MS}ms`);
  console.log(
    `  ${s.name.padEnd(15)} ${out.arrived ? "reaches" : "partial"}  ` +
    `steps=${String(out.path.length).padStart(3)}  ${ms.toFixed(0).padStart(3)}ms` +
    `${ok && inBudget ? "" : "   <-- FAIL"}`
  );
}

/* ---- closed loop ---- */

function drive(scenario, maxSteps) {
  const target = { x: scenario.to[0], y: scenario.to[1] };
  const world = at(scenario.from[0], scenario.from[1]);
  let travelled = 0;
  let stalled = 0;
  let previous = { x: world.x, y: world.y };
  let worstMs = 0;

  for (let step = 0; step < maxSteps; step++) {
    const remaining = Math.hypot(world.x - target.x, world.y - target.y);
    if (remaining < ARRIVE) return { arrived: true, steps: step, travelled, worstMs, remaining };
    const { ms, out } = send(scenario.objs, Object.assign({}, world), target);
    worstMs = Math.max(worstMs, ms);
    const direction = out.path.length > 0
      ? out.path[0]
      : Math.atan2(target.y - world.y, target.x - world.x);
    globalThis._pbSetCfg(cfg());
    globalThis._pbSetGrid(globalThis._pbBuildGrid(scenario.objs));
    globalThis._pbSimulate(world, direction);
    const moved = Math.hypot(world.x - previous.x, world.y - previous.y);
    travelled += moved;
    stalled = moved < 4 ? stalled + 1 : 0;
    previous = { x: world.x, y: world.y };
  }
  return {
    arrived: false, steps: maxSteps, travelled, worstMs, stalled,
    remaining: Math.hypot(world.x - target.x, world.y - target.y)
  };
}

console.log("\ndrive (search, step, repeat)\n");
for (const s of SCENARIOS) {
  const straight = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]);
  const run = drive(s, 160);
  // Allow a generous detour, but not wandering: three times the straight line
  // means the controller is going somewhere other than the target.
  const efficient = !run.arrived || run.travelled < straight * 3;
  const ok = run.arrived === s.drive && efficient;
  if (!ok) {
    failures.push(
      `${s.name}: drive ${run.arrived ? "arrived" : "did not arrive"} ` +
      `(expected ${s.drive ? "arrival" : "no arrival"}), travelled ${run.travelled.toFixed(0)} of ${straight.toFixed(0)}`
    );
  }
  console.log(
    `  ${s.name.padEnd(15)} ${(run.arrived ? "arrived" : "blocked").padEnd(8)} ` +
    `steps=${String(run.steps).padStart(3)}  travelled=${run.travelled.toFixed(0).padStart(5)}` +
    ` / ${straight.toFixed(0).padStart(4)} straight  worst=${run.worstMs.toFixed(0)}ms${ok ? "" : "   <-- FAIL"}`
  );
}

console.log("");
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  process.exit(1);
}
console.log(`OK - ${SCENARIOS.length} scenarios plan and drive as expected.`);
