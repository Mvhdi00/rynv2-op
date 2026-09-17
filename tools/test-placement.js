#!/usr/bin/env node
/*
 * test-placement.js
 *
 * Runs the placement engine's pure geometry out of the client and checks it
 * against a brute-force reference, then measures what the angle system actually
 * produces.
 *
 * Nothing here is a mock of the engine. `GeometrySolver`, `RingScan` and
 * `AngleSolver` are lifted verbatim out of Ryn_Type_2.user.js by brace-matching
 * their declarations and evaluated in a sandbox with the handful of module-level
 * helpers they read (hyp, fixTo, Config, Settings). If the client's geometry
 * changes, this test changes with it or it fails.
 *
 * Two jobs:
 *
 *   CHECKS   the analytic aperture solve against a sampled reference at a
 *            resolution far finer than anything the client uses, the wire
 *            quantum against the client's own `wireAngle`, and the twenty
 *            board shapes the placement rewrite was specified against.
 *
 *   MEASURE  the effective angular candidate set: how many distinct sendable
 *            directions the adaptive system reaches, the resolution it reaches
 *            them at, and the largest gap it leaves — against the flat 36 / 72
 *            / 144 / 200 tables it replaces.
 *
 *   node tools/test-placement.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Ryn_Type_2.user.js");
const src = fs.readFileSync(CLIENT_PATH, "utf8");

/* ── lifting declarations out of the client ─────────────────────────────── */

function blockAt(from) {
  const open = src.slice(from).search(/[[{]/) + from;
  const openCh = src[open];
  const closeCh = openCh === "[" ? "]" : "}";
  let depth = 0, quote = null, line = false, block = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (line) { if (c === "\n") line = false; continue; }
    if (block) { if (c === "*" && n === "/") { block = false; i++; } continue; }
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && n === "/") { line = true; i++; continue; }
    if (c === "/" && n === "*") { block = true; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error("unterminated block at " + from);
}

/* `const NAME = <object or array literal>;` */
function liftConst(name) {
  const re = new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*[[{]");
  const at = src.search(re);
  if (at === -1) throw new Error("not found: const " + name);
  return blockAt(src.indexOf("=", at) + 1);
}

/* `class NAME { ... }` */
function liftClass(name) {
  const re = new RegExp("class\\s+" + name + "\\s*\\{");
  const at = src.search(re);
  if (at === -1) throw new Error("not found: class " + name);
  return "class " + name + " " + blockAt(at + name.length + 5);
}

/* A bare `const NAME = <expression>;` on one line. */
function liftScalar(name) {
  const re = new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*([^;\\n]+)");
  const m = src.match(re);
  if (!m) throw new Error("not found: scalar " + name);
  return m[1].trim();
}

/* ── the sandbox ────────────────────────────────────────────────────────── */

/* Everything is declared with `var` and evaluated as one script, because a
 * `const` inside vm.runInContext is a lexical binding of that one script and
 * neither persists to the next call nor becomes a property of the sandbox. */
const sandbox = { Math: Math, process: process, Set: Set, Map: Map, Float64Array: Float64Array, Number: Number, isFinite: isFinite, console: console };
vm.createContext(sandbox);

const prelude = `
  var performance = { now: () => __now };
  var __now = 0;
  var hyp = (a, b) => Math.sqrt(a * a + b * b);
  var fixTo = (value, fraction) => parseFloat(value.toFixed(fraction));
  var getAngleDist = (a, b) => {
    var p = Math.abs(b - a) % (Math.PI * 2);
    return p > Math.PI ? Math.PI * 2 - p : p;
  };
  // The client's own wireAngle, verbatim — what the socket actually carries.
  var wireAngle = angle => {
    if (typeof angle !== "number" || !isFinite(angle)) return null;
    return fixTo(Math.atan2(Math.sin(angle), Math.cos(angle)), 2);
  };
`;

vm.runInContext([
  prelude,
  "var Config_default = " + liftConst("Config") + ";",
  "var RPE_TAU = " + liftScalar("RPE_TAU") + ";",
  "var RPE_EPS = " + liftScalar("RPE_EPS") + ";",
  "var RPE_WIRE_QUANTUM = " + liftScalar("RPE_WIRE_QUANTUM") + ";",
  "var RPE_WIRE_SLOTS = " + liftScalar("RPE_WIRE_SLOTS") + ";",
  "var RPE_NEAR_ARC = " + liftScalar("RPE_NEAR_ARC") + ";",
  "var RPE_NEAR_BINS = " + liftScalar("RPE_NEAR_BINS") + ";",
  "var RPE_FAR_BINS = " + liftScalar("RPE_FAR_BINS") + ";",
  "var RPE_MAX_PROPOSALS = " + liftScalar("RPE_MAX_PROPOSALS") + ";",
  "var RPE_REFINE_SEEDS = " + liftScalar("RPE_REFINE_SEEDS") + ";",
  "var LUNA_MAX_SCANNERS = " + liftScalar("LUNA_MAX_SCANNERS") + ";",
  "var LUNA_ANGLE_RESOLUTIONS = " + liftConst("LUNA_ANGLE_RESOLUTIONS") + ";",
  "var LUNA_ANGLE_STEPS_DEFAULT = " + liftScalar("LUNA_ANGLE_STEPS_DEFAULT") + ";",
  "var GeometrySolver = " + liftConst("GeometrySolver") + ";",
  "var RingScan = " + liftConst("RingScan") + ";",
  "var AngleSolver = " + liftClass("AngleSolver") + ";",
  "var Items = " + liftConst("Items") + ";",
  "var LUNA_BAN_TICKS = " + liftScalar("LUNA_BAN_TICKS") + ";",
  "var LUNA_SPIKE_TYPE = " + liftScalar("LUNA_SPIKE_TYPE") + ";",
  "var RPE_TICK_MS = " + liftScalar("RPE_TICK_MS") + ";",
  "var RPE_PING_MAX_TICKS = " + liftScalar("RPE_PING_MAX_TICKS") + ";",
  "var RPE_LATENCY_ALPHA = " + liftScalar("RPE_LATENCY_ALPHA") + ";",
  "var RPE_LATENCY_JITTER_K = " + liftScalar("RPE_LATENCY_JITTER_K") + ";",
  "var RPE_LATENCY_MAX_MS = " + liftScalar("RPE_LATENCY_MAX_MS") + ";",
  "var RPE_LATENCY_STALE_TICKS = " + liftScalar("RPE_LATENCY_STALE_TICKS") + ";",
  "var RPE_PHANTOM_TTL = " + liftScalar("RPE_PHANTOM_TTL") + ";",
  "var RPE_PHANTOM_BASE = " + liftScalar("RPE_PHANTOM_BASE") + ";",
  "var RPE_PHANTOM_CORROBORATED = " + liftScalar("RPE_PHANTOM_CORROBORATED") + ";",
  "var RPE_SOFT_DOMINANCE = " + liftScalar("RPE_SOFT_DOMINANCE") + ";",
  "var LatencyModel = " + liftClass("LatencyModel") + ";",
  "var PlacementRefusals = " + liftClass("PlacementRefusals") + ";",
  "var PhantomTraps = " + liftClass("PhantomTraps") + ";",
  "var PlacementLedger = " + liftClass("PlacementLedger") + ";",
  "var Settings_default = { _autoplacerResolution: 200, _autoplacerScanners: 4 };",
  "var solver = new AngleSolver();",
].join("\n"), sandbox);

const G = sandbox.GeometrySolver;
const TAU = Math.PI * 2;
const Q = sandbox.RPE_WIRE_QUANTUM;

/* ── harness ────────────────────────────────────────────────────────────── */

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) return;
  failures++;
  console.log("  FAIL  " + name + (detail === undefined ? "" : "  -- " + detail));
}
function section(title) {
  console.log("\n" + title);
}

/* Deterministic PRNG, so a failure is reproducible. */
let seed = 0x2f6e2b1;
function rnd() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
}
const rand = (lo, hi) => lo + rnd() * (hi - lo);

/* The game's own legality test, point by point — the reference the analytic
 * aperture solve has to agree with. Straight off ObjectManager.checkItemLocation:
 *
 *     T = obj.blocker ? obj.blocker : obj.getScale(0.6, obj.isItem)
 *     if (getDistance(x, y, obj.x, obj.y) < s + T) return false
 *     ... plus the river band unless the item is the platform */
function legalPoint(x, y, footR, blockers, riverLegal) {
  for (const b of blockers) {
    if (Math.hypot(x - b.x, y - b.y) < footR + b.r) return false;
  }
  if (!riverLegal) {
    const mid = sandbox.Config_default.mapScale / 2;
    const half = sandbox.Config_default.riverWidth / 2;
    if (y >= mid - half && y <= mid + half) return false;
  }
  return true;
}

function apertures(ox, oy, ringR, footR, blockers, riverLegal) {
  const arcs = [];
  for (const b of blockers) {
    const arc = G.occlusion(ox, oy, ringR, footR, b.x, b.y, b.r);
    if (arc) arcs.push(arc);
  }
  if (!riverLegal) {
    for (const arc of G.riverOcclusion(oy, ringR)) arcs.push(arc);
  }
  return G.invert(G.merge(arcs));
}

/* ── 1. the wire quantum ────────────────────────────────────────────────── */
section("wire quantum");
{
  ok("628 distinct slots", sandbox.RPE_WIRE_SLOTS === 628, "got " + sandbox.RPE_WIRE_SLOTS);
  // quantize must agree with the client's own wireAngle for every direction.
  let worst = 0, mismatch = 0;
  for (let i = 0; i < 20000; i++) {
    const a = rand(-8, 8);
    const mine = G.quantize(a);
    const theirs = sandbox.wireAngle(a);
    const norm = G.norm(theirs);
    if (Math.abs(G.angleDist(mine, norm)) > 1e-9) mismatch++;
    worst = Math.max(worst, G.angleDist(mine, G.norm(a)));
  }
  ok("quantize == the client's wireAngle", mismatch === 0, mismatch + " of 20000 differ");
  ok("snap error never exceeds half a quantum", worst <= Q / 2 + 1e-9, "worst " + worst.toFixed(6));
  // A quantised value is a fixed point.
  let unstable = 0;
  for (let i = 0; i < 5000; i++) {
    const a = G.quantize(rand(0, TAU));
    if (G.angleDist(G.quantize(a), a) > 1e-12) unstable++;
  }
  ok("quantize is idempotent", unstable === 0, unstable + " unstable");
  // Distinct slots really are distinct.
  const slots = new Set();
  for (let k = 0; k < sandbox.RPE_WIRE_SLOTS; k++) slots.add(G.quantize(k * Q));
  ok("the whole slot set is reachable", slots.size === sandbox.RPE_WIRE_SLOTS, "reached " + slots.size);
}

/* ── 2. snapIntoAperture ────────────────────────────────────────────────── */
section("snapIntoAperture");
{
  // Any angle it returns is sendable and inside the aperture.
  let outside = 0, unsendable = 0, missedWide = 0, wideTried = 0;
  for (let i = 0; i < 40000; i++) {
    const start = rand(0, TAU);
    const width = rand(0.002, 2.5);
    const ap = [ G.norm(start), G.norm(start + width), width ];
    const wanted = rand(0, TAU);
    const got = G.snapIntoAperture([ ap ], wanted);
    if (got === null) {
      // Refusing is only allowed when the arc genuinely holds no slot. Two
      // quanta of width always holds one, so anything wider must answer.
      if (width > 2 * Q) { wideTried++; missedWide++; }
      continue;
    }
    if (width > 2 * Q) wideTried++;
    if (!G.inAperture([ ap ], got)) outside++;
    if (G.angleDist(got, G.quantize(got)) > 1e-12) unsendable++;
  }
  ok("never returns an angle outside the aperture", outside === 0, outside + " outside");
  ok("never returns an unsendable angle", unsendable === 0, unsendable + " unsendable");
  ok("never refuses an aperture wider than two quanta", missedWide === 0, missedWide + " of " + wideTried + " refused");
  // An aperture narrower than a quantum may hold nothing, and saying so is the
  // point: a width in radians cannot answer "is this gap usable".
  let narrowNull = 0, narrowTried = 0;
  for (let i = 0; i < 4000; i++) {
    const start = rand(0, TAU);
    const width = rand(1e-4, Q * 0.9);
    const ap = [ G.norm(start), G.norm(start + width), width ];
    narrowTried++;
    if (G.snapIntoAperture([ ap ], rand(0, TAU)) === null) narrowNull++;
  }
  ok("a sub-quantum aperture is usually reported unusable", narrowNull > narrowTried * 0.5,
    narrowNull + " of " + narrowTried);
  ok("wireSlots counts them", G.wireSlots([ 0, 1, 1 ]) === Math.floor(1 / Q));
}

/* ── 3. the analytic aperture solve, against brute force ────────────────── */
section("aperture solve vs. sampled reference");
{
  const items = [
    { name: "spikes", scale: 49, off: -5 },
    { name: "greater spikes", scale: 52, off: -5 },
    { name: "pit trap", scale: 50, off: -5 },
  ];
  const P = sandbox.Config_default.playerScale;
  let disagree = 0, samples = 0, worstGapUnits = 0;
  for (let board = 0; board < 3000; board++) {
    const item = items[board % items.length];
    const ringR = P + item.scale + item.off;
    // Away from the river for most boards, on it for a tenth of them, so the
    // band arithmetic is exercised too.
    const ox = rand(1500, 12500);
    const oy = board % 10 === 0 ? rand(6700, 7700) : rand(1500, 6000);
    const n = Math.floor(rand(0, 9));
    const blockers = [];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const d = rand(10, ringR + 130);
      blockers.push({ x: ox + d * Math.cos(a), y: oy + d * Math.sin(a), r: [ 49, 50, 52, 110, 300, 63, 90 ][Math.floor(rand(0, 7))] });
    }
    const free = apertures(ox, oy, ringR, item.scale, blockers, false);
    // Sample the ring far finer than the client ever does and compare the two
    // answers point by point.
    const STEPS = 3600;
    for (let i = 0; i < STEPS; i++) {
      const a = i * TAU / STEPS;
      const x = ox + ringR * Math.cos(a);
      const y = oy + ringR * Math.sin(a);
      const brute = legalPoint(x, y, item.scale, blockers, false);
      const analytic = G.inAperture(free, a) !== null;
      samples++;
      if (brute === analytic) continue;
      // Disagreement within one sample step of an edge is the discretisation of
      // the reference, not an error in the solve.
      let nearEdge = false;
      for (const ap of free) {
        if (G.angleDist(a, ap[0]) < TAU / STEPS || G.angleDist(a, ap[1]) < TAU / STEPS) nearEdge = true;
      }
      if (!nearEdge) {
        disagree++;
        if (disagree <= 3) {
          console.log("    board " + board + " angle " + a.toFixed(4) + " brute=" + brute + " analytic=" + analytic);
        }
      }
    }
    for (const ap of free) worstGapUnits = Math.max(worstGapUnits, ap[2] * ringR);
  }
  ok("analytic apertures agree with the sampled reference", disagree === 0,
    disagree + " disagreements over " + samples + " samples");
  console.log("  " + samples.toLocaleString() + " ring samples across 3,000 boards, widest free arc " + worstGapUnits.toFixed(0) + "u");
}

/* ── 4. the river band, exactly ─────────────────────────────────────────── */
section("river occlusion");
{
  let wrong = 0, cases = 0;
  const mid = sandbox.Config_default.mapScale / 2;
  for (let i = 0; i < 4000; i++) {
    const ringR = rand(70, 135);
    const oy = mid + rand(-700, 700);
    const arcs = G.riverOcclusion(oy, ringR);
    const merged = G.merge(arcs.length ? arcs : []);
    const blocked = a => {
      for (const m of merged) {
        const x = G.norm(a);
        if (m[0] <= m[1] ? x >= m[0] - 1e-9 && x <= m[1] + 1e-9 : x >= m[0] - 1e-9 || x <= m[1] + 1e-9) return true;
      }
      return false;
    };
    for (let k = 0; k < 720; k++) {
      const a = k * TAU / 720;
      const y = oy + ringR * Math.sin(a);
      const inBand = y >= mid - sandbox.Config_default.riverWidth / 2 && y <= mid + sandbox.Config_default.riverWidth / 2;
      cases++;
      // Skip the boundary itself, which is the reference's own discretisation.
      if (Math.abs(Math.abs(y - mid) - sandbox.Config_default.riverWidth / 2) < ringR * TAU / 720) continue;
      if (inBand !== blocked(a)) wrong++;
    }
  }
  ok("the river band is solved exactly", wrong === 0, wrong + " of " + cases + " wrong");
}

/* ── 5. merge / invert invariants ───────────────────────────────────────── */
section("interval algebra");
{
  let bad = 0;
  for (let i = 0; i < 20000; i++) {
    const arcs = [];
    const n = Math.floor(rand(0, 6));
    for (let k = 0; k < n; k++) {
      const s = rand(-10, 10);
      arcs.push([ s, s + rand(0.01, 3) ]);
    }
    const merged = G.merge(arcs);
    // Merged intervals are sorted, disjoint and inside [0, 2pi].
    for (let k = 0; k < merged.length; k++) {
      if (merged[k][0] > merged[k][1] + 1e-12) bad++;
      if (merged[k][0] < -1e-9 || merged[k][1] > TAU + 1e-9) bad++;
      if (k && merged[k][0] < merged[k - 1][1] - 1e-9) bad++;
    }
    const free = G.invert(merged);
    // Free spans are positive and sum, with the blocked spans, to the circle.
    let total = 0;
    for (const f of free) {
      if (f[2] <= 0) bad++;
      total += f[2];
    }
    let blocked = 0;
    for (const m of merged) blocked += m[1] - m[0];
    if (merged.length && Math.abs(total + blocked - TAU) > 1e-6) bad++;
    if (!merged.length && Math.abs(total - TAU) > 1e-6) bad++;
  }
  ok("merge and invert partition the circle", bad === 0, bad + " violations");
}

/* ── 6. the twenty board shapes ─────────────────────────────────────────── */
section("board shapes");
{
  const P = sandbox.Config_default.playerScale;
  const SPIKE = { scale: 49, off: -5 };
  const ringR = P + SPIKE.scale + SPIKE.off;
  const ring = (n, r, spread) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (spread === undefined ? TAU : spread) * i / n;
      out.push({ x: 5000 + r * Math.cos(a), y: 3000 + r * Math.sin(a), r: 49 });
    }
    return out;
  };
  const boards = [
    [ "empty area", [] ],
    [ "one obstacle", [ { x: 5000 + ringR, y: 3000, r: 49 } ] ],
    [ "multiple obstacles", ring(3, ringR) ],
    [ "dense spike cluster", ring(7, ringR) ],
    [ "dense trap cluster", ring(6, ringR).map(o => ({ x: o.x, y: o.y, r: 50 })) ],
    [ "narrow angular gap", ring(2, ringR, 1.55) ],
    [ "fully enclosed", ring(14, ringR) ],
    [ "blocker in range", [ { x: 5000 + 200, y: 3000, r: 300 } ] ],
    [ "sapling adjacent", [ { x: 5000 + ringR, y: 3000, r: 110 } ] ],
    [ "obstacle dead centre", [ { x: 5000, y: 3000, r: 49 } ] ],
    [ "obstacle just out of reach", [ { x: 5000 + ringR + 49 + 49 + 1, y: 3000, r: 49 } ] ],
    [ "obstacle just in reach", [ { x: 5000 + ringR + 49 + 49 - 1, y: 3000, r: 49 } ] ],
    [ "twenty obstacles", ring(20, ringR + 20) ],
  ];
  for (const [name, blockers] of boards) {
    const free = apertures(5000, 3000, ringR, SPIKE.scale, blockers, true);
    // Every reported free arc holds at least one legal sendable angle, and
    // every legal sendable angle is inside a reported arc.
    let slotsFound = 0, wrong = 0;
    for (const ap of free) {
      const a = G.snapIntoAperture(free, G.norm(ap[0] + ap[2] / 2));
      if (a === null) continue;
      slotsFound++;
      const x = 5000 + ringR * Math.cos(a);
      const y = 3000 + ringR * Math.sin(a);
      if (!legalPoint(x, y, SPIKE.scale, blockers, true)) wrong++;
    }
    let missed = 0;
    for (let k = 0; k < sandbox.RPE_WIRE_SLOTS; k++) {
      const a = G.quantize(k * Q);
      const x = 5000 + ringR * Math.cos(a);
      const y = 3000 + ringR * Math.sin(a);
      if (!legalPoint(x, y, SPIKE.scale, blockers, true)) continue;
      if (!G.inAperture(free, a)) missed++;
    }
    ok(name + ": reported arcs are legal", wrong === 0, wrong + " illegal");
    ok(name + ": no legal slot is hidden", missed === 0, missed + " missed");
    if (name === "fully enclosed") {
      ok("fully enclosed: no arcs at all", free.length === 0, free.length + " arcs");
    }
  }
}

/* ── 7. what the angle system actually produces ─────────────────────────── */
section("effective angular coverage");
{
  const P = sandbox.Config_default.playerScale;
  const profile = {
    type: 4, id: 7, item: { scale: 49, placeOffset: -5 },
    footR: 49, ringR: P + 49 - 5, blockR: 49,
    touchR: P + 49, layer: 0, riverLegal: true,
    roles: [ "damage", "block" ], isDamage: true, isTrap: false,
  };
  const memory = { key: (p, a) => p.type + ":" + Math.round(G.norm(a) / 0.6684) };

  function board() {
    const ox = rand(2000, 12000), oy = rand(1500, 6000);
    const n = Math.floor(rand(0, 8));
    const blockers = [];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const d = rand(30, profile.ringR + 120);
      blockers.push({ x: ox + d * Math.cos(a), y: oy + d * Math.sin(a), r: [ 49, 50, 52 ][Math.floor(rand(0, 3))] });
    }
    const tx = ox + rand(-320, 320), ty = oy + rand(-320, 320);
    const vx = rand(-25, 25), vy = rand(-25, 25);
    return {
      tick: 100, hasTarget: true,
      myPos: { x: ox, y: oy }, myNext: { x: ox + rand(-20, 20), y: oy + rand(-20, 20) },
      moveDir: rand(0, TAU),
      target: { id: 1, angle: rand(0, TAU) },
      targetPos: { x: tx, y: ty }, targetNext: { x: tx + vx, y: ty + vy },
      targetScale: 35, targetId: 1, targetTrapped: null, imTrapped: false,
      ourSpikes: [], ourTraps: [], enemyObjects: [],
      range: Math.hypot(tx - ox, ty - oy), budgetLeft: 90,
      kb: null, exits: null, deny: null, denyAim: null, timing: 1,
      blockers: blockers,
    };
  }

  // How wide the arc facing the target is taken to be, for the "near arc"
  // measurement below. 0.6 rad either side of the aim direction is 47 units of
  // arc at the spike ring in each direction — comfortably wider than a spike
  // footprint, so it holds every build that could touch or intercept.
  // The arc the near tier enumerates, which is what the near reading is about.
  const NEAR_ARC = sandbox.RPE_NEAR_ARC;
  // The part of an aperture within `half` of `centre`, or null.
  function clipToArc(ap, centre, half) {
    // Work in offsets from the aperture's own start.
    let lo = G.norm(centre - half) - ap[0];
    if (lo < 0) lo += TAU;
    let hi = G.norm(centre + half) - ap[0];
    if (hi < 0) hi += TAU;
    // The window either sits inside the aperture, or covers its start, or does
    // not reach it at all. Only the first two produce a clip.
    if (lo <= hi) {
      const s = Math.max(0, Math.min(lo, ap[2]));
      const e = Math.max(0, Math.min(hi, ap[2]));
      if (e - s <= 0) return null;
      return [ G.norm(ap[0] + s), G.norm(ap[0] + e), e - s ];
    }
    // The window wraps the aperture's start: take the part from 0 to hi.
    const e = Math.max(0, Math.min(hi, ap[2]));
    if (e <= 0) return null;
    return [ ap[0], G.norm(ap[0] + e), e ];
  }

  const stats = {};
  for (const steps of [ 36, 72, 144, 200 ]) {
    sandbox.Settings_default._autoplacerResolution = steps;
    let total = 0, uniq = 0, refined = 0, coarse = 0, exact = 0, boards = 0;
    let maxCount = 0, worstGap = 0, bestGap = Infinity, nearGap = 0;
    let flatTotal = 0, flatWorstGap = 0, flatNearGap = 0;
    seed = 0x51ed517; // same boards for every rung
    for (let b = 0; b < 4000; b++) {
      const f = board();
      f.ringSteps = steps;
      const free = apertures(f.myPos.x, f.myPos.y, profile.ringR, profile.footR, f.blockers, true);
      if (free.length === 0) continue;
      boards++;
      const out = sandbox.solver.propose(profile, free, f, memory, undefined);
      total += out.length;
      maxCount = Math.max(maxCount, out.length);
      const slots = new Set();
      for (const c of out) {
        slots.add(Math.round(c.angle / Q));
        if (c.source === "refine") refined++;
        else if (c.source === "ring") coarse++;
        else exact++;
      }
      uniq += slots.size;
      // The largest arc of *legal* ring this candidate set leaves unsampled.
      // Measured only inside the free arcs, because blocked ring is not a gap.
      //
      // Offsets from the arc's own start, not absolute angles: an aperture can
      // wrap through zero, and sorting its samples by absolute angle then puts
      // them in the wrong order and reports the whole arc as one gap.
      const sorted = [ ...slots ].map(k => k * Q);
      const gapWithin = (ap, angles) => {
        const rel = [];
        for (const a of angles) {
          if (!G.inAperture([ ap ], a)) continue;
          let d = a - ap[0];
          if (d < 0) d += TAU;
          if (d > ap[2]) d = ap[2];
          rel.push(d);
        }
        if (rel.length === 0) return { gap: ap[2], n: 0 };
        rel.sort((a, b2) => a - b2);
        let gap = rel[0];
        for (let i = 1; i < rel.length; i++) gap = Math.max(gap, rel[i] - rel[i - 1]);
        gap = Math.max(gap, ap[2] - rel[rel.length - 1]);
        return { gap: gap, n: rel.length };
      };
      const aim = Math.atan2(f.targetNext.y - f.myPos.y, f.targetNext.x - f.myPos.x);
      for (const ap of free) {
        const r = gapWithin(ap, sorted);
        worstGap = Math.max(worstGap, r.gap);
        if (r.n > 1) bestGap = Math.min(bestGap, ap[2] / (r.n - 1));
        // The near arc: the part of this aperture within NEAR_ARC of the
        // direction to the target, which is where a candidate can be worth
        // anything. Coverage out on the far side is worth reporting but is not
        // what a placer is judged on.
        const nearSamples = sorted.filter(a => G.angleDist(a, aim) <= NEAR_ARC);
        const nearAp = clipToArc(ap, aim, NEAR_ARC);
        if (nearAp !== null) nearGap = Math.max(nearGap, gapWithin(nearAp, nearSamples).gap);
      }
      // The flat table it replaces: every sample of a uniform `steps` lattice
      // anchored at zero that happens to be legal.
      const flat = [];
      for (let i = 0; i < steps; i++) {
        const a = i * TAU / steps;
        if (G.inAperture(free, a)) flat.push(a);
      }
      flatTotal += flat.length;
      for (const ap of free) {
        flatWorstGap = Math.max(flatWorstGap, gapWithin(ap, flat).gap);
        const nearFlat = flat.filter(a => G.angleDist(a, aim) <= NEAR_ARC);
        const nearAp = clipToArc(ap, aim, NEAR_ARC);
        if (nearAp !== null) flatNearGap = Math.max(flatNearGap, gapWithin(nearAp, nearFlat).gap);
      }
    }
    stats[steps] = {
      boards: boards,
      perBoard: total / boards,
      uniquePerBoard: uniq / boards,
      maxPerBoard: maxCount,
      exact: exact / boards,
      coarse: coarse / boards,
      refined: refined / boards,
      worstGapUnits: worstGap * profile.ringR,
      nearGapUnits: nearGap * profile.ringR,
      finestRad: bestGap,
      finestUnits: bestGap * profile.ringR,
      flatPerBoard: flatTotal / boards,
      flatWorstGapUnits: flatWorstGap * profile.ringR,
      flatNearGapUnits: flatNearGap * profile.ringR,
    };
  }
  sandbox.Settings_default._autoplacerResolution = 200;

  console.log("            adaptive                                              flat table");
  console.log("  coarse  cand  exact sweep refine  finest  near gap  far gap    cand  gap");
  for (const steps of [ 36, 72, 144, 200 ]) {
    const s = stats[steps];
    console.log(
      "  " + String(steps).padStart(4) +
      "   " + s.perBoard.toFixed(1).padStart(5) +
      "  " + s.exact.toFixed(1).padStart(5) +
      " " + s.coarse.toFixed(1).padStart(5) +
      "  " + s.refined.toFixed(1).padStart(5) +
      "  " + (s.finestUnits.toFixed(2) + "u").padStart(7) +
      "  " + (s.nearGapUnits.toFixed(1) + "u").padStart(7) +
      "  " + (s.worstGapUnits.toFixed(1) + "u").padStart(7) +
      "    " + s.flatPerBoard.toFixed(1).padStart(4) +
      "  " + (s.flatNearGapUnits.toFixed(1) + "u").padStart(6)
    );
  }
  console.log("");
  console.log("  finest   the closest two chosen candidates come, in units of arc at the ring");
  console.log("  near gap the widest unsampled arc within " + NEAR_ARC + " rad of the target direction");
  console.log("  far gap  the widest unsampled arc anywhere on the legal ring");
  for (const steps of [ 36, 72, 144, 200 ]) {
    const s = stats[steps];
    // The claim is not uniform coverage — it is deliberately not that. It is
    // that the resolution reaches the wire floor whatever the coarse rung says,
    // that the arc which can actually carry value is covered at least as well
    // as the flat table covers it, and that nothing anywhere is left unbounded.
    ok("coarse " + steps + " refines to the wire quantum",
      s.finestRad <= Q * 1.5,
      "finest spacing " + s.finestRad.toFixed(5) + " rad");
    // Parity is the claim, and it is measured in wire slots because that is the
    // only unit in which a difference can exist: two directions less than one
    // slot apart are the same build (RPE_WIRE_QUANTUM). At 200 the adaptive
    // near arc reads 2.62u against the flat table's 2.48u — a seventh of a slot
    // — while at 36, 72 and 144 it is two to five times finer, because the near
    // tier is enumerated at the quantum and does not depend on the setting at
    // all. What the adaptive set has that no flat table can is everything else
    // in this section: a floor three times finer, the exact tangency and
    // aperture-edge angles, and a bounded far arc.
    const slotUnits = Q * profile.ringR;
    ok("coarse " + steps + " covers the near arc as finely as the flat table, to within a slot",
      s.nearGapUnits <= s.flatNearGapUnits + slotUnits,
      s.nearGapUnits.toFixed(2) + "u vs flat " + s.flatNearGapUnits.toFixed(2) + "u");
    // The far tier's bin, which is the widest bin there is: the rest of the
    // ring after the near arc, cut into RPE_FAR_BINS. Two of them is the worst
    // a bin with no legal lattice sample in it can produce, and bounding it is
    // the point — the old "best eight by distance to the target" cut left arcs
    // of 480 units with nothing in them at all.
    const binUnits = (TAU - 2 * sandbox.RPE_NEAR_ARC) / sandbox.RPE_FAR_BINS * profile.ringR;
    ok("coarse " + steps + " leaves no arc wider than two bins unsampled",
      s.worstGapUnits <= binUnits * 2 + 1,
      s.worstGapUnits.toFixed(1) + "u vs two bins " + (binUnits * 2).toFixed(1) + "u");
    ok("coarse " + steps + " proposals are all distinct sendable slots",
      Math.abs(s.perBoard - s.uniquePerBoard) < 1e-9,
      s.perBoard.toFixed(2) + " vs " + s.uniquePerBoard.toFixed(2));
    ok("coarse " + steps + " stays inside the proposal cap",
      s.maxPerBoard <= sandbox.RPE_MAX_PROPOSALS,
      s.maxPerBoard + " > " + sandbox.RPE_MAX_PROPOSALS);
  }
}

/* ── 8. the anchored, stratified sweep ──────────────────────────────────── */
section("sweep anchoring and sector coverage");
{
  const P = sandbox.Config_default.playerScale;
  const profile = {
    type: 4, id: 7, item: { scale: 49, placeOffset: -5 },
    footR: 49, ringR: P + 49 - 5, blockR: 49, touchR: P + 49,
    layer: 0, riverLegal: true, roles: [ "damage" ], isDamage: true, isTrap: false,
  };
  const memory = { key: (p, a) => p.type + ":" + Math.round(G.norm(a) / 0.6684) };
  const free = [ [ 0, TAU, TAU ] ];
  // On an open ring the sweep must put a sample on the direction to the target
  // — that is what anchoring means — and must reach every sector.
  let onAim = 0, allSectors = 0, trials = 0;
  seed = 0x9e3779b;
  for (let i = 0; i < 2000; i++) {
    const ox = rand(2000, 12000), oy = rand(1500, 6000);
    const a = rand(0, TAU);
    const d = rand(60, 300);
    const f = {
      tick: 1, hasTarget: true, ringSteps: 72,
      myPos: { x: ox, y: oy }, myNext: { x: ox, y: oy }, moveDir: null,
      target: { id: 1, angle: 0 },
      targetPos: { x: ox + d * Math.cos(a), y: oy + d * Math.sin(a) },
      targetNext: { x: ox + d * Math.cos(a), y: oy + d * Math.sin(a) },
      targetScale: 35, targetId: 1, targetTrapped: null, imTrapped: false,
      ourSpikes: [], ourTraps: [], enemyObjects: [], range: d, budgetLeft: 90,
      kb: null, exits: null, deny: null, denyAim: null, timing: 1,
    };
    const out = sandbox.solver.propose(profile, free, f, memory, undefined);
    trials++;
    const aim = Math.atan2(f.targetNext.y - oy, f.targetNext.x - ox);
    let best = Infinity;
    const sectors = new Set();
    for (const c of out) {
      best = Math.min(best, G.angleDist(c.angle, aim));
      let rel = G.norm(c.angle - aim);
      sectors.add(Math.floor(rel / (TAU / 4)) % 4);
    }
    if (best <= Q) onAim++;
    if (sectors.size === 4) allSectors++;
  }
  ok("a sample lands on the aim direction", onAim === trials, onAim + " of " + trials);
  ok("every quadrant of an open ring is represented", allSectors === trials, allSectors + " of " + trials);
}

/* ── 9. the refusal memory ──────────────────────────────────────────────── */
section("refusals");
{
  const R = new sandbox.PlacementRefusals();
  const grace = 3;
  const freeAlways = () => true;
  const freeNever = () => false;

  // A send inside the grace window is not judged: its object may still be in
  // flight, and reading the empty ground as a refusal is how a build that
  // worked gets its own slot banned.
  R.note(7, 100, 100, 49, 10);
  R.settle(11, grace, freeAlways, null);
  ok("a send younger than the grace window is not judged", R.bans.length === 0 && R.pending.length === 1);
  R.settle(13, grace, freeAlways, null);
  ok("a send past the grace window on empty ground is refused", R.bans.length === 1);
  ok("the ban covers the ground it was aimed at", R.banned(7, 100, 100) === true);
  ok("the ban is per item", R.banned(4, 100, 100) === false);
  ok("the ban does not cover a different slot", R.banned(7, 400, 400) === false);
  ok("a judged send leaves the pending list", R.pending.length === 0);

  // Ground that is occupied is a build that worked.
  const R2 = new sandbox.PlacementRefusals();
  R2.note(7, 200, 200, 49, 10);
  R2.settle(13, grace, freeNever, null);
  ok("occupied ground is not a refusal", R2.bans.length === 0 && R2.pending.length === 0);

  // Past the window the evidence is stale and the send is dropped unjudged.
  const R3 = new sandbox.PlacementRefusals();
  R3.note(7, 300, 300, 49, 10);
  R3.settle(10 + grace + 3, grace, freeAlways, null);
  ok("stale evidence bans nothing", R3.bans.length === 0 && R3.pending.length === 0);

  // A confirmation resolves the send, measures the trip and clears the ban.
  const R4 = new sandbox.PlacementRefusals();
  const L = new sandbox.LatencyModel();
  sandbox.__now = 1000;
  R4.note(7, 400, 400, 49, 10);
  sandbox.__now = 1120;
  const resolved = R4.confirm(7, 405, 402, 49, 11, L);
  ok("an arriving object resolves its own send", resolved !== null && R4.pending.length === 0);
  ok("and the trip is measured from it", Math.abs(L.smooth - 120) < 1e-6, "smooth " + L.smooth);
  // Matched on the item too: a spike arriving must not resolve a trap's send.
  const R5 = new sandbox.PlacementRefusals();
  R5.note(15, 500, 500, 50, 10);
  ok("a different item does not resolve the send", R5.confirm(7, 500, 500, 49, 11, null) === null);
  ok("the same item does", R5.confirm(15, 500, 500, 50, 11, null) !== null);
  // A build standing on banned ground clears the ban.
  const R6 = new sandbox.PlacementRefusals();
  R6.note(7, 600, 600, 49, 10);
  R6.settle(13, grace, freeAlways, null);
  ok("banned before", R6.banned(7, 600, 600) === true);
  R6.clearAt(600, 600, 49);
  ok("a build on the ground clears the ban", R6.banned(7, 600, 600) === false);
  // Bans expire.
  const R7 = new sandbox.PlacementRefusals();
  R7.note(7, 700, 700, 49, 10);
  R7.settle(13, grace, freeAlways, null);
  R7.settle(13 + sandbox.LUNA_BAN_TICKS + 1, grace, freeAlways, null);
  ok("a ban expires", R7.bans.length === 0);
  // The pending list cannot grow without bound.
  const R8 = new sandbox.PlacementRefusals();
  for (let i = 0; i < 200; i++) R8.note(7, i * 10, 0, 49, i);
  ok("the pending list is bounded", R8.pending.length <= 24, "len " + R8.pending.length);
}

/* ── 10. the latency model ──────────────────────────────────────────────── */
section("latency");
{
  const L = new sandbox.LatencyModel();
  ok("an unmeasured clock is honest about it", L.ticks() === 0 && L.confidence(0) < .5);
  for (let i = 0; i < 40; i++) L.observe(100, i);
  ok("a steady line reads its own value", Math.abs(L.smooth - 100) < .5, "smooth " + L.smooth);
  ok("a steady line has no jitter", L.jitter < .5, "jitter " + L.jitter);
  ok("a steady line is believed", L.confidence(40) > .9, "conf " + L.confidence(40));
  ok("the lead is the mean plus the deviation", Math.abs(L.leadMs() - L.smooth - L.jitter) < 1e-9);
  ok("the lead in ticks is capped", L.ticks() <= sandbox.RPE_PING_MAX_TICKS);
  // One outlier moves a smoothed mean by a fraction of itself, where a single
  // sample would have replaced it outright.
  const before = L.smooth;
  L.observe(600, 41);
  ok("one outlier does not replace the mean", L.smooth < before + 200, "smooth " + L.smooth);
  ok("but it is visible in the jitter", L.jitter > 50, "jitter " + L.jitter);
  ok("and the line is believed less", L.confidence(41) < .9, "conf " + L.confidence(41));
  // Jitter raises the lead: a deadline has to survive the slow trips.
  const J = new sandbox.LatencyModel();
  for (let i = 0; i < 60; i++) J.observe(i % 2 ? 60 : 180, i);
  ok("a jittery line reads a longer lead than its own mean", J.leadMs() > J.smooth, J.leadMs() + " vs " + J.smooth);
  ok("a jittery line is believed less than a steady one", J.confidence(60) < L.confidence(40));
  ok("the best trip is never later than the lead", J.bestMs() <= J.leadMs() + 1e-9);
  // A stale clock loses confidence without losing its value.
  const held = J.smooth;
  ok("a stale sample keeps its value", Math.abs(J.smooth - held) < 1e-9);
  ok("but not its confidence", J.confidence(60 + sandbox.RPE_LATENCY_STALE_TICKS + 5) < J.confidence(60));
  // Nonsense is refused rather than averaged in.
  const N = new sandbox.LatencyModel();
  N.observe(100, 0);
  N.observe(-5, 1);
  N.observe(NaN, 2);
  N.observe(sandbox.RPE_LATENCY_MAX_MS + 1, 3);
  ok("a bad sample is refused", N.samples === 1 && Math.abs(N.smooth - 100) < 1e-9);
  // `poll` folds a socket ping in once per new value, not once per read.
  const P = new sandbox.LatencyModel();
  const fakeClient = { SocketManager: { pong: 90, minPingTime: 70 } };
  for (let i = 0; i < 20; i++) P.poll(fakeClient, i);
  ok("one pong is one sample", P.samples === 1, "samples " + P.samples);
  ok("and a steady pong keeps the jitter at zero", P.jitter === 0);
  fakeClient.SocketManager.pong = 130;
  P.poll(fakeClient, 21);
  ok("a new pong is a new sample", P.samples === 2);
  ok("minPingTime feeds the floor", P.floor <= 70);
}

/* ── 11. inferred enemy traps ───────────────────────────────────────────── */
section("phantom traps");
{
  const P = sandbox.Config_default.playerScale;
  const TRAP = sandbox.Items[15];
  ok("item 15 is the pit trap", TRAP.name === "pit trap" && TRAP.hideFromEnemy === true);
  const ring = P + TRAP.scale + TRAP.placeOffset;

  const makeClient = players => ({
    PlayerManager: { players: players },
    myPlayer: { id: 1, isEnemyByID: id => id !== 1 },
  });
  // A player holding a hidden item, then not holding it, is a player who built
  // it — the game clears buildIndex only on a successful build.
  const enemy = { id: 2, currentItem: 15, angle: 0, pos: { current: { x: 1000, y: 1000 } } };
  const ph = new sandbox.PhantomTraps();
  const client = makeClient([ enemy ]);
  ph.observe(client, 1);
  ok("holding records nothing yet", ph.traps.size === 0);
  enemy.currentItem = -1;
  enemy.pos.current = { x: 1010, y: 1000 };
  ph.observe(client, 2);
  ok("releasing a hidden item records a phantom", ph.traps.size === 1);
  const rec = [ ...ph.traps.values() ][0];
  // Measured from where they were while holding it, along the direction the
  // update reports — see PhantomTraps.
  ok("at the ring position from the holding tick", Math.abs(rec.x - (1000 + ring)) < 1e-6 && Math.abs(rec.y - 1000) < 1e-6,
    "(" + rec.x.toFixed(1) + "," + rec.y.toFixed(1) + ")");
  ok("as a suspicion, not an occupancy", rec.corroborated === false && rec.confidence === sandbox.RPE_PHANTOM_BASE);
  ok("a suspicion is not a blocker", ph.blockers(1000, 1000, 400).length === 0);
  ok("but it is visible to the scorer", ph.at(1000 + ring, 1000, 49, false) !== null);
  ok("and not to the occupancy test", ph.at(1000 + ring, 1000, 49, true) === null);

  // A refusal on the same ground is the corroboration that promotes it.
  ph.corroborate(1000 + ring, 1000, 49);
  ok("a refusal promotes it", rec.corroborated === true && rec.confidence === sandbox.RPE_PHANTOM_CORROBORATED);
  ok("a corroborated phantom is a blocker", ph.blockers(1000, 1000, 400).length === 1);
  const b = ph.blockers(1000, 1000, 400)[0];
  ok("shaped like an object for the solver", b.placementScale === TRAP.scale && typeof b.pos.current.x === "number");

  // Contradicted by a real build going in there.
  ph.clearNear(1000 + ring, 1000, 49);
  ok("a build on the ground clears it", ph.traps.size === 0);

  // A visible item is not inferred: only the hidden ones are invisible to us.
  const ph2 = new sandbox.PhantomTraps();
  const spiker = { id: 3, currentItem: 7, angle: 0, pos: { current: { x: 2000, y: 2000 } } };
  ph2.observe(makeClient([ spiker ]), 1);
  spiker.currentItem = -1;
  ph2.observe(makeClient([ spiker ]), 2);
  ok("a visible item is not inferred", ph2.traps.size === 0);

  // Ours are sent to us like anything else, so there is nothing to infer.
  const ph3 = new sandbox.PhantomTraps();
  const mine = { id: 1, currentItem: 15, angle: 0, pos: { current: { x: 3000, y: 3000 } } };
  ph3.observe(makeClient([ mine ]), 1);
  mine.currentItem = -1;
  ph3.observe(makeClient([ mine ]), 2);
  ok("our own build is not inferred", ph3.traps.size === 0);

  // An uncorroborated suspicion decays and is dropped.
  const ph4 = new sandbox.PhantomTraps();
  const e4 = { id: 2, currentItem: 15, angle: 0, pos: { current: { x: 4000, y: 4000 } } };
  const c4 = makeClient([ e4 ]);
  ph4.observe(c4, 1);
  e4.currentItem = -1;
  ph4.observe(c4, 2);
  const r4 = [ ...ph4.traps.values() ][0];
  ph4.expire(2 + Math.floor(sandbox.RPE_PHANTOM_TTL / 2));
  ok("a suspicion decays", r4.confidence < sandbox.RPE_PHANTOM_BASE && r4.confidence > 0, "conf " + r4.confidence);
  ph4.expire(2 + sandbox.RPE_PHANTOM_TTL + 1);
  ok("and is eventually dropped", ph4.traps.size === 0);

  // A corroborated one does not decay — two observations agree about it.
  const ph5 = new sandbox.PhantomTraps();
  const e5 = { id: 2, currentItem: 15, angle: 0, pos: { current: { x: 5000, y: 5000 } } };
  const c5 = makeClient([ e5 ]);
  ph5.observe(c5, 1);
  e5.currentItem = -1;
  ph5.observe(c5, 2);
  ph5.corroborate(5000 + ring, 5000, 49);
  ph5.expire(2 + Math.floor(sandbox.RPE_PHANTOM_TTL / 2));
  ok("a corroborated phantom holds its confidence", [ ...ph5.traps.values() ][0].confidence === sandbox.RPE_PHANTOM_CORROBORATED);

  // Rebuilding the same slot refreshes one record rather than stacking.
  const ph6 = new sandbox.PhantomTraps();
  const e6 = { id: 2, currentItem: 15, angle: 0, pos: { current: { x: 6000, y: 6000 } } };
  const c6 = makeClient([ e6 ]);
  for (let k = 0; k < 5; k++) {
    e6.currentItem = 15;
    ph6.observe(c6, k * 2 + 1);
    e6.currentItem = -1;
    ph6.observe(c6, k * 2 + 2);
  }
  ok("the same slot is one record", ph6.traps.size === 1, "size " + ph6.traps.size);
  // The map is bounded whatever the board does.
  const ph7 = new sandbox.PhantomTraps();
  for (let k = 0; k < 100; k++) {
    const e = { id: 2, currentItem: 15, angle: 0, pos: { current: { x: k * 500, y: 0 } } };
    const c = makeClient([ e ]);
    ph7.observe(c, k * 2 + 1);
    e.currentItem = -1;
    ph7.observe(c, k * 2 + 2);
  }
  ok("the phantom map is bounded", ph7.traps.size <= 24, "size " + ph7.traps.size);
}

/* ── 12. the reservation ledger ─────────────────────────────────────────── */
section("reservation ledger");
{
  const L = new sandbox.PlacementLedger();
  // A hard claim is ground on the wire and always holds.
  const hard = L.reserve(0, 0, 49, 40, "auto", 1, 3);
  ok("a hard claim is filed", hard !== false);
  ok("and holds against anything", L.blocked(10, 0, 49, 90, 1e6) === true);
  ok("but not somewhere else", L.blocked(400, 0, 49, 40, 1) === false);
  ok("and never against itself", L.blocked(10, 0, 49, 90, 1e6, hard) === false);
  L.releaseToken(hard);
  ok("a released claim is gone", L.blocked(10, 0, 49, 40, 1) === false);

  // A soft claim is an intention: it holds against equal or lower priority and
  // yields to a higher one that is not worth clearly less.
  const L2 = new sandbox.PlacementLedger();
  const soft = L2.reserve(0, 0, 49, 50, "preplace", 1, 3, { soft: true, value: 4 });
  ok("a soft claim is filed", soft !== false);
  ok("it holds against equal priority and no more value", L2.blocked(10, 0, 49, 50, 4) === true);
  ok("it yields to equal priority worth more", L2.blocked(10, 0, 49, 50, 5) === false);
  ok("it yields to higher priority", L2.blocked(10, 0, 49, 70, 3) === false);
  ok("unless it is worth clearly more", L2.blocked(10, 0, 49, 70, 4 / sandbox.RPE_SOFT_DOMINANCE - .01) === true);
  // Pre-emption hands the token back so the holder learns its ground is gone.
  const taken = L2.preempt(10, 0, 49, 70, 100);
  ok("pre-emption returns the displaced token", taken.length === 1 && taken[0] === soft);
  ok("and removes it", L2.entries.length === 0);
  // Claims expire.
  const L3 = new sandbox.PlacementLedger();
  L3.reserve(0, 0, 49, 40, "auto", 1, 2);
  L3.expire(3);
  ok("a claim expires", L3.entries.length === 0);
}

/* ── 13. cost ───────────────────────────────────────────────────────────── */
section("cost per item per cycle");
{
  const P = sandbox.Config_default.playerScale;
  const profile = {
    type: 4, id: 7, item: { scale: 49, placeOffset: -5 },
    footR: 49, ringR: P + 49 - 5, blockR: 49, touchR: P + 49,
    layer: 0, riverLegal: true, roles: [ "damage" ], isDamage: true, isTrap: false,
  };
  const memory = { key: (p2, a) => p2.type + ":" + Math.round(G.norm(a) / 0.6684) };
  // A contested board: eight builds around the ring, which is what a fight
  // looks like once both sides have spent their spikes.
  seed = 0x13579bd;
  const boards = [];
  for (let b = 0; b < 200; b++) {
    const ox = rand(2000, 12000), oy = rand(1500, 6000);
    const blockers = [];
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU), d = rand(30, profile.ringR + 120);
      blockers.push({ x: ox + d * Math.cos(a), y: oy + d * Math.sin(a), r: 49 });
    }
    const tx = ox + rand(-300, 300), ty = oy + rand(-300, 300);
    boards.push({
      free: apertures(ox, oy, profile.ringR, profile.footR, blockers, true),
      frame: {
        tick: 1, hasTarget: true, ringSteps: 200,
        myPos: { x: ox, y: oy }, myNext: { x: ox, y: oy }, moveDir: null,
        target: { id: 1, angle: rand(0, TAU) },
        targetPos: { x: tx, y: ty }, targetNext: { x: tx + rand(-20, 20), y: ty + rand(-20, 20) },
        targetScale: 35, targetId: 1, targetTrapped: null, imTrapped: false,
        ourSpikes: [], ourTraps: [], enemyObjects: [], range: 200, budgetLeft: 90,
        kb: null, exits: null, deny: null, denyAim: null, timing: 1,
      },
    });
  }
  const live = boards.filter(b => b.free.length > 0);
  const REPS = 40;
  // Warm up, so what is timed is steady-state rather than the first-call
  // compile of the method under test.
  for (const b of live) sandbox.solver.propose(profile, b.free, b.frame, memory, undefined);
  const t0 = process.hrtime.bigint();
  let produced = 0;
  for (let r = 0; r < REPS; r++) {
    for (const b of live) produced += sandbox.solver.propose(profile, b.free, b.frame, memory, undefined).length;
  }
  const t1 = process.hrtime.bigint();
  const perCall = Number(t1 - t0) / 1e6 / (REPS * live.length);
  console.log("  " + live.length + " contested boards x " + REPS + " reps");
  console.log("  " + perCall.toFixed(4) + " ms per item per cycle, " + (produced / (REPS * live.length)).toFixed(1) + " candidates each");
  console.log("  two items a tick is " + (perCall * 2).toFixed(3) + " ms against a " + sandbox.RPE_TICK_MS.toFixed(1) + " ms tick");
  // The whole point of an analytic aperture solve is that generation is cheap
  // enough not to need a budget. A tenth of a tick across both items is the
  // bar; anything near the tick itself would mean the resolution has to be
  // rationed again, which is what this design exists to avoid.
  ok("generation costs well under a tick", perCall * 2 < sandbox.RPE_TICK_MS / 10,
    (perCall * 2).toFixed(3) + " ms");
}

/* ── done ───────────────────────────────────────────────────────────────── */
console.log("");
if (failures) {
  console.log(failures + " of " + checks + " checks FAILED");
  process.exit(1);
}
console.log("all " + checks + " checks passed");
