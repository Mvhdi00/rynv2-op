'use strict';
/*
 * Headless checks for the RYN placement engine.
 *
 * The engine's geometry, knockback, motion, ledger, memory and planner are
 * plain functions over numbers with no dependency on the game client, so they
 * can be lifted straight out of the userscript and exercised directly. This
 * file slices them out by balanced braces, evaluates them against the real
 * item tables from drivers/game-drivers.json, and checks them against the
 * game's own rules as written in src/game_index.js.
 *
 * It does not and cannot test whether a placement lands in a live match. What
 * it does test is every claim that reduces to arithmetic: that the aperture
 * solver agrees with the server's checkItemLocation on every angle, that the
 * knockback simulation reproduces the server's checkCollision, that a
 * prediction tracks a target through the movement cases, and that the ledger,
 * memory and planner behave the way the placement pipeline assumes.
 *
 *   node tools/placement-bench.js [path-to-client]
 */

const fs = require('fs');
const path = require('path');

const CLIENT = process.argv[2] || path.join(__dirname, '..', 'src', 'RYN_Client_v5.4.js');
const DRIVERS = path.join(__dirname, '..', 'drivers', 'game-drivers.json');

// ── extraction ──────────────────────────────────────────────────────────────

const source = fs.readFileSync(CLIENT, 'utf8');

/** Slice from `start` through the matching close of the first brace after it. */
function sliceBlock(text, startIdx) {
  const open = text.indexOf('{', startIdx);
  if (open < 0) throw new Error('no brace after index ' + startIdx);
  let depth = 0, inStr = null, esc = false, inLine = false, inBlock = false;
  for (let i = open; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(startIdx, i + 1); }
  }
  throw new Error('unbalanced from index ' + startIdx);
}

function grab(marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error('not found in client: ' + marker);
  return sliceBlock(source, at);
}

/** Every `const RPE_x = ...;` / `const LUNA_x = ...;` single-line declaration. */
function grabConstants() {
  const out = [];
  const re = /^\s*const ((?:RPE|LUNA)_[A-Z0-9_]+) = ([^;\n]+);\s*$/gm;
  let m;
  while ((m = re.exec(source))) out.push(`const ${m[1]} = ${m[2]};`);
  return out.join('\n');
}

const drivers = JSON.parse(fs.readFileSync(DRIVERS, 'utf8'));

// Real tables, indexed the way the client indexes them.
const Items = drivers.items.map((it, i) => Object.assign({ id: i }, it));
const ItemGroups = drivers.itemGroups;
const Config_default = drivers.config;

for (const k of ['playerScale', 'playerDecel', 'mapScale', 'riverWidth', 'serverUpdateRate']) {
  if (typeof Config_default[k] !== 'number') throw new Error('driver config missing ' + k);
}

const sandbox = {
  Config_default, Items, ItemGroups,
  Math, Number, Map, Set, Array, Object, JSON, isFinite, console,
};

const parts = [
  grabConstants(),
  'const ' + grab('GeometrySolver = {') + ';',
  'const ' + grab('SiegeAnalysis = {') + ';',
  grab('class TargetMotion {'),
  grab('class PlacementLedger {'),
  grab('class PlacementMemory {'),
  grab('class PlacementPlanner {'),
  grab('class AngleSolver {'),
  grab('class AutoPlacer {'),
  'const ' + grab('PlacementWeights = {') + ';',
  'return { GeometrySolver, SiegeAnalysis, TargetMotion, PlacementLedger, PlacementMemory, PlacementPlanner, AngleSolver, AutoPlacer, PlacementWeights, ' +
    'K: { RPE_KB_TRAVEL, RPE_KB_IMPULSE, RPE_PLACE_PACKETS, RPE_BATCH_PACKETS, RPE_TICK_MS, RPE_DECEL, RPE_MAX_ITEM_RADIUS, RPE_STOP_SPEED } };',
];

const M = new Function(...Object.keys(sandbox), parts.join('\n\n'))(...Object.values(sandbox));
const { GeometrySolver: G, SiegeAnalysis: S, TargetMotion, PlacementLedger, PlacementMemory, PlacementPlanner, AngleSolver, AutoPlacer, PlacementWeights, K } = M;

// ── item constants, read from the driver tables ─────────────────────────────

const SPIKE = Items.find(i => i.name === 'spikes');
const TRAP = Items.find(i => i.name === 'pit trap');
const BLOCKER = Items.find(i => i.name === 'blocker');
const PS = Config_default.playerScale;

const ringR = it => PS + it.scale + (it.placeOffset || 0);

// ── the game's own rules, transcribed from src/game_index.js ────────────────

/**
 * checkItemLocation, game_index.js:911, as called from buildItem at 2458 with
 * (x, y, item.scale, 0.6, item.id, false, player).
 *
 *   T = t.blocker ? t.blocker : t.getScale(0.6, t.isItem)
 *   reject if getDistance(...) < p + T
 *   reject if not river-legal
 */
function serverCheckItemLocation(x, y, scale, itemId, objects) {
  for (const o of objects) {
    const T = o.blocker ? o.blocker : o.scale; // placed items: getScale(0.6,true) === scale
    if (Math.hypot(x - o.x, y - o.y) < scale + T) return false;
  }
  if (itemId !== 18) {
    const mid = Config_default.mapScale / 2, half = Config_default.riverWidth / 2;
    if (y >= mid - half && y <= mid + half) return false;
  }
  return true;
}

/**
 * checkCollision, game_index.js:940-968, for a moving body against buildings:
 *
 *   P = h.scale + u.getScale()
 *   h.x = u.x + P*cos(w)          // w = getDirection(h, u), object -> player
 *   h.xVel *= 0.75                // damp, before the impulse
 *   if (u.dmg) h.xVel += 1.5 * cos(w)
 *   if (u.trap) h.lockMove = true // ignoreCollision branch: no push, no damp
 *
 * Written independently of the engine's simulator, and stepped one unit of
 * travel at a time so that collision detection is effectively exact. The
 * engine's version steps eight units for speed; comparing the two is what
 * shows that the coarser stepping still resolves the same contacts.
 */
const LN_DECEL = -Math.log(Config_default.playerDecel);
function serverKnockback(startX, startY, vx, vy, objects, maxMs) {
  let x = startX, y = startY, damage = 0, trapped = false, elapsed = 0;
  const hit = new Set();
  while (!trapped && elapsed < maxMs) {
    const speed = Math.hypot(vx, vy);
    if (speed < 0.01) break;
    const dt = Math.min(maxMs - elapsed, 1 / speed);
    elapsed += dt;
    const r = Math.pow(Config_default.playerDecel, dt);
    const travel = (1 - r) / LN_DECEL;
    x += vx * travel;
    y += vy * travel;
    vx *= r; vy *= r;
    for (const o of objects) {
      if (hit.has(o)) continue;
      const P = PS + o.colScale;
      const dx = x - o.x, dy = y - o.y;
      const d = Math.hypot(dx, dy);
      if (d >= P) continue;
      hit.add(o);
      if (o.trap) { trapped = true; break; }
      const w = Math.atan2(dy, dx);
      x = o.x + P * Math.cos(w);
      y = o.y + P * Math.sin(w);
      vx *= 0.75; vy *= 0.75;
      if (o.dmg > 0) {
        damage += o.dmg;
        vx += 1.5 * Math.cos(w);
        vy += 1.5 * Math.sin(w);
      }
    }
  }
  return { x, y, damage, trapped };
}

// ── harness ─────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
const failures = [];
let group = '';

function suite(name) { group = name; console.log('\n' + name); }
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else {
    fail++;
    failures.push(group + ' › ' + label + (detail ? '  [' + detail + ']' : ''));
    console.log('  ✗ ' + label + (detail ? '  [' + detail + ']' : ''));
  }
}
function near(a, b, tol, label) {
  ok(Math.abs(a - b) <= tol, label, `got ${a.toFixed(3)}, want ${b.toFixed(3)} +/-${tol}`);
}

// Deterministic scene generator, so a failure is reproducible.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function scene(rand, count, opts) {
  opts = opts || {};
  const ox = 5000, oy = 5000;
  const objs = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = 40 + rand() * 220;
    const item = rand() < 0.75 ? SPIKE : TRAP;
    objs.push({
      x: ox + Math.cos(a) * d,
      y: oy + Math.sin(a) * d,
      scale: item.scale,
      colScale: item.scale * (item.colDiv || 1),
      dmg: item.dmg || 0,
      trap: !!item.trap,
      placementScale: item.scale,
      pos: { current: { x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d } },
    });
  }
  if (opts.blocker) {
    const a = rand() * Math.PI * 2, d = 200 + rand() * 200;
    objs.push({
      x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d,
      scale: BLOCKER.scale, colScale: BLOCKER.scale * BLOCKER.colDiv,
      dmg: 0, trap: false, blocker: BLOCKER.blocker,
      placementScale: BLOCKER.blocker,
      pos: { current: { x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d } },
    });
  }
  return { ox, oy, objs };
}

function apertures(item, ox, oy, objs) {
  const R = ringR(item);
  const blocked = [];
  for (const o of objs) {
    const arc = G.occlusion(ox, oy, R, item.scale, o.x, o.y, o.placementScale);
    if (arc) blocked.push(arc);
  }
  if (item.id !== 18) for (const arc of G.riverOcclusion(oy, R)) blocked.push(arc);
  return G.invert(G.merge(blocked));
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Collision precision: the aperture solver against the server's own test
// ════════════════════════════════════════════════════════════════════════════

suite('Collision — apertures vs the game’s checkItemLocation');

for (const [label, opts, seeds] of [
  ['open geometry (4 objects)', { count: 4 }, 40],
  ['dense geometry (18 objects)', { count: 18 }, 40],
  ['with a 300-radius blocker', { count: 8, blocker: true }, 40],
]) {
  let falseLegal = 0, falseIllegal = 0, samples = 0;
  for (let s = 0; s < seeds; s++) {
    const rand = rng(1000 + s);
    const { ox, oy, objs } = scene(rand, opts.count, opts);
    for (const item of [SPIKE, TRAP]) {
      const R = ringR(item);
      const aps = apertures(item, ox, oy, objs);
      for (let i = 0; i < 360; i++) {
        const a = (i / 360) * Math.PI * 2;
        const x = ox + R * Math.cos(a), y = oy + R * Math.sin(a);
        const engineSays = !!G.inAperture(aps, a);
        const serverSays = serverCheckItemLocation(x, y, item.scale, item.id, objs);
        samples++;
        // Only count disagreements away from the exact boundary, where the
        // two disagree by floating point rather than by rule.
        const margin = 0.004 * R;
        let onEdge = false;
        for (const o of objs) {
          const T = o.blocker ? o.blocker : o.scale;
          if (Math.abs(Math.hypot(x - o.x, y - o.y) - (item.scale + T)) < margin) onEdge = true;
        }
        const mid = Config_default.mapScale / 2, half = Config_default.riverWidth / 2;
        if (Math.abs(y - (mid - half)) < margin || Math.abs(y - (mid + half)) < margin) onEdge = true;
        if (onEdge) continue;
        if (engineSays && !serverSays) falseLegal++;
        if (!engineSays && serverSays) falseIllegal++;
      }
    }
  }
  ok(falseLegal === 0, `${label}: no angle called legal that the server refuses`, `${falseLegal}/${samples}`);
  ok(falseIllegal === 0, `${label}: no legal angle discarded`, `${falseIllegal}/${samples}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 2. The wrap seam
// ════════════════════════════════════════════════════════════════════════════

suite('Angle solver — the 0 rad seam');

{
  const ox = 5000, oy = 5000;
  const R = ringR(SPIKE);
  const N = 72, step = (Math.PI * 2) / N;

  function edgeCounts(objs) {
    const aps = apertures(SPIKE, ox, oy, objs);
    const sample = [];
    for (let i = 0; i < N; i++) {
      sample.push({ placeable: !!G.inAperture(aps, i * step), old: false, wrapped: false });
    }
    // Luna's original: samples compared only i-1 -> i, starting at i = 1, so
    // index 0 and index 71 are never each other's neighbour.
    for (let i = 1; i < N; i++) {
      if (sample[i].placeable && !sample[i - 1].placeable) sample[i].old = true;
      if (sample[i - 1].placeable && !sample[i].placeable) sample[i - 1].old = true;
    }
    for (let i = 0; i < N; i++) {
      const prev = sample[(i - 1 + N) % N], cur = sample[i], next = sample[(i + 1) % N];
      if (cur.placeable && (!prev.placeable || !next.placeable)) cur.wrapped = true;
    }
    return {
      aps, sample,
      old: sample.filter(s => s.old).length,
      wrap: sample.filter(s => s.wrapped).length,
      lost: sample.filter(s => s.old && !s.wrapped).length,
    };
  }

  // Find a blocker position whose blocked arc straddles 0 rad — that is the
  // configuration the forward-only scan cannot describe.
  let found = null;
  for (let deg = 0; deg < 360 && !found; deg++) {
    const a = (deg / 360) * Math.PI * 2;
    const objs = [{
      x: ox + Math.cos(a) * (R * 0.55), y: oy + Math.sin(a) * (R * 0.55),
      scale: SPIKE.scale, placementScale: SPIKE.scale, colScale: SPIKE.scale, dmg: SPIKE.dmg, trap: false,
    }];
    const r = edgeCounts(objs);
    // The seam bites when the run's boundary falls between index 71 and 0.
    if (r.sample[0].placeable !== r.sample[N - 1].placeable) found = { objs, r };
  }
  ok(found !== null, 'a scene exists whose placeable run crosses the 0 rad seam');

  if (found) {
    ok(found.r.wrap > found.r.old,
       'wrap-aware edge test finds edges the forward-only scan missed',
       `forward-only ${found.r.old}, wrap-aware ${found.r.wrap}`);
    ok(found.r.lost === 0,
       'wrap-aware test is a superset — nothing the old test found is lost');

    // The aperture boundaries are exact regardless of where the samples land.
    let allLegal = true;
    for (const ap of found.r.aps) {
      const inset = Math.min(0.03, ap[2] / 3);
      for (const edge of [ap[0] + inset, ap[1] - inset]) {
        const x = ox + R * Math.cos(edge), y = oy + R * Math.sin(edge);
        if (!serverCheckItemLocation(x, y, SPIKE.scale, SPIKE.id, found.objs)) allLegal = false;
      }
    }
    ok(allLegal, 'every aperture edge is a placement the server accepts');
  }

  // Across many scenes, the wrap-aware test never loses an edge and sometimes
  // gains one.
  let gained = 0, lost = 0;
  for (let s = 0; s < 200; s++) {
    const rand = rng(4000 + s);
    const sc = scene(rand, 3);
    const objs = sc.objs.map(o => Object.assign({}, o, { x: o.x - sc.ox + ox, y: o.y - sc.oy + oy }));
    const r = edgeCounts(objs);
    if (r.wrap > r.old) gained++;
    lost += r.lost;
  }
  ok(lost === 0, 'over 200 scenes, the wrap-aware test never loses an edge', `lost=${lost}`);
  ok(gained > 0, 'over 200 scenes, it recovers edges the forward-only scan missed', `gained=${gained}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 3. Knockback: simulation against the server's collision code
// ════════════════════════════════════════════════════════════════════════════

suite('Knockback — simulation vs the game’s checkCollision');

const CONTACT = PS + SPIKE.scale;   // 84: the game's h.scale + u.getScale()

{
  // A build that does not reach the target pushes nothing. The game resolves
  // a collision only on overlap.
  const far = S.simulateKnockback(5000, 5000, SPIKE.scale, [], 5000 + 200, 5000, 0, 0);
  ok(far.touched === false, 'a build out of reach reports no contact');
  ok(far.x === 5000 + 200 && far.y === 5000, 'and does not move the target');
  ok(!far.willHit && !far.inEscapable && far.damage === 0, 'and produces no rebound');
}

{
  // Free flight from a build that does touch: pushed to the contact surface,
  // then coasts the impulse out.
  const sx = 5000, sy = 5000, tx = sx + CONTACT - 4, ty = sy;
  const r = S.simulateKnockback(sx, sy, SPIKE.scale, [], tx, ty, 0, 0);
  ok(r.touched, 'a build in contact does push');
  const fromBuild = Math.hypot(r.x - sx, r.y - sy);
  near(fromBuild, CONTACT + K.RPE_KB_TRAVEL, 15, 'free flight coasts the impulse’s full distance');
}

{
  // Cross-check the whole simulation against an independent transcription of
  // checkCollision, over random object fields. This is the test that matters:
  // it does not depend on me predicting the outcome.
  let worstDist = 0, dmgMismatch = 0, trapMismatch = 0, runs = 0, divergent = 0;
  const gaps = [];
  for (let s = 0; s < 120; s++) {
    const rand = rng(2000 + s);
    const sx = 5000, sy = 5000;
    const pushDir = rand() * Math.PI * 2;
    const tx = sx + Math.cos(pushDir) * (CONTACT - 6);
    const ty = sy + Math.sin(pushDir) * (CONTACT - 6);
    const objs = [];
    for (let i = 0; i < 4; i++) {
      const a = pushDir + (rand() - 0.5) * 1.2;
      const d = 90 + rand() * 200;
      const isTrap = rand() < 0.3;
      objs.push({
        x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d,
        colScale: isTrap ? TRAP.scale * TRAP.colDiv : SPIKE.scale,
        dmg: isTrap ? 0 : SPIKE.dmg, trap: isTrap,
      });
    }
    const mine = S.simulateKnockback(sx, sy, SPIKE.scale, objs, tx, ty, 0, 0);
    // Same starting state the simulator establishes: pushed to the surface,
    // impulse applied along build -> target.
    const w = Math.atan2(ty - sy, tx - sx);
    const ref = serverKnockback(
      sx + CONTACT * Math.cos(w), sy + CONTACT * Math.sin(w),
      K.RPE_KB_IMPULSE * Math.cos(w), K.RPE_KB_IMPULSE * Math.sin(w),
      objs, 1400);
    runs++;
    const gap = Math.hypot(mine.x - ref.x, mine.y - ref.y);
    worstDist = Math.max(worstDist, gap);
    gaps.push(gap);
    if (gap > 20) divergent++;
    if (Math.abs(mine.damage - ref.damage) > 1e-6) dmgMismatch++;
    if (mine.inEscapable !== ref.trapped) trapMismatch++;
  }
  // The transcription detects contact by sampling points along the path, the
  // way the server's substep loop does; the engine solves the segment against
  // each circle for the moment of entry. They agree on every outcome except a
  // tangential graze the sampled version steps over, where the engine is the
  // more correct of the two. That residual is what the 1% allowance is for —
  // it is not a tolerance on the physics, which is identical.
  gaps.sort((a, b) => a - b);
  const medianDist = gaps[gaps.length >> 1];
  ok(trapMismatch === 0, `trap outcome matches across ${runs} random fields`, `${trapMismatch} mismatches`);
  ok(dmgMismatch <= runs * 0.01, `damage matches on at least 99% of ${runs} random fields`, `${dmgMismatch} mismatches`);
  ok(divergent <= runs * 0.01, `resting position agrees on at least 99% of fields`, `${divergent} diverged, worst=${worstDist.toFixed(1)}`);
  // A few units, against a 45-unit trap radius and an 84-unit spike radius:
  // far inside the margin that decides any outcome. The difference is the
  // sampled reference resolving a contact up to one step late each time.
  ok(medianDist < 5, 'typical resting-position difference is a few units', `median=${medianDist.toFixed(2)}`);
}

{
  // Direction: the push is build -> target, matching w = getDirection(h, u).
  const sx = 5000, sy = 5000;
  const r = S.simulateKnockback(sx, sy, SPIKE.scale, [], sx, sy + CONTACT - 4, 0, 0);
  ok(r.y > sy + CONTACT, 'the push moves the target directly away from the build');
  near(Math.abs(r.x - sx), 0, 1e-6, 'the push has no component across that axis');
}

{
  // The trap radius is 45 — playerScale + scale*colDiv — not 47.5 and not 50.
  const trapReach = PS + TRAP.scale * TRAP.colDiv;
  near(trapReach, 45, 1e-9, 'trap trigger radius is playerScale + scale*colDiv = 45');
  const sx = 5000, sy = 5000, tx = sx + CONTACT - 4, ty = sy;
  const mk = off => ({ x: tx + 140, y: ty + off, colScale: TRAP.scale * TRAP.colDiv, dmg: 0, trap: true });
  ok(!S.simulateKnockback(sx, sy, SPIKE.scale, [mk(46.5)], tx, ty, 0, 0).inEscapable,
     'a trap 46.5 units off the push line is not triggered');
  ok(S.simulateKnockback(sx, sy, SPIKE.scale, [mk(43.5)], tx, ty, 0, 0).inEscapable,
     'a trap 43.5 units off the push line is triggered');
}

// ════════════════════════════════════════════════════════════════════════════
// 4. Prediction across the movement cases
// ════════════════════════════════════════════════════════════════════════════

suite('Prediction — movement cases');

function runTrack(positions) {
  const motion = new TargetMotion();
  const entity = { id: 1, pos: { current: { x: 0, y: 0 } } };
  let track = null;
  positions.forEach((p, i) => {
    entity.pos.current = { x: p.x, y: p.y };
    track = motion.observe(entity, i);
  });
  return { motion, entity, track };
}
function straight(n, vx, vy, x0, y0) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: (x0 || 0) + vx * i, y: (y0 || 0) + vy * i });
  return out;
}

{
  const { motion, entity } = runTrack(straight(6, 0, 0, 5000, 5000));
  const p = motion.predict(entity, 4);
  near(Math.hypot(p.x - 5000, p.y - 5000), 0, 0.5, 'stationary target: predicted where it is');
  ok(p.confidence > 0.3, 'stationary target: prediction is believed', `conf=${p.confidence.toFixed(2)}`);
}

{
  // Slow, then fast, both straight. Error is measured against ground truth.
  for (const [label, v, tol] of [['slow (4 u/tick)', 4, 2], ['fast (25 u/tick)', 25, 6]]) {
    const pos = straight(6, v, 0, 5000, 5000);
    const { motion, entity } = runTrack(pos);
    const p = motion.predict(entity, 3);
    const truth = { x: 5000 + v * (5 + 3), y: 5000 };
    ok(Math.hypot(p.x - truth.x, p.y - truth.y) < tol,
       `${label}: 3-tick prediction within ${tol} units`,
       `err=${Math.hypot(p.x - truth.x, p.y - truth.y).toFixed(2)}`);
  }
}

{
  // A right-angle turn. Confidence must fall, and the acceleration measured
  // across the corner must not be carried forward.
  const pos = straight(4, 20, 0, 5000, 5000);
  for (let i = 1; i <= 3; i++) pos.push({ x: pos[3].x, y: pos[3].y + 20 * i });
  const { motion, entity, track } = runTrack(pos);
  const straightRun = runTrack(straight(7, 20, 0, 5000, 5000));
  const turned = motion.predict(entity, 3).confidence;
  const flat = straightRun.motion.predict(straightRun.entity, 3).confidence;
  ok(turned < flat, 'direction change: confidence drops below a flat run',
     `turned=${turned.toFixed(3)} flat=${flat.toFixed(3)}`);
  ok(Math.hypot(track.ax, track.ay) < 1e-9,
     'direction change: acceleration measured across the corner is discarded');
}

{
  // A sudden stop. The track must say so, and say it on the tick it happens.
  const pos = straight(4, 22, 0, 5000, 5000);
  const last = pos[3];
  for (let i = 0; i < 2; i++) pos.push({ x: last.x, y: last.y });
  const { track, motion, entity } = runTrack(pos);
  ok(track.stopped === true, 'sudden stop: the track reports stopped');
  ok(track.heading === null, 'sudden stop: heading is cleared, so a booked record can notice');
  const p = motion.predict(entity, 4);
  ok(Math.hypot(p.x - last.x, p.y - last.y) < 30,
     'sudden stop: prediction does not run on past the stop',
     `err=${Math.hypot(p.x - last.x, p.y - last.y).toFixed(1)}`);
}

{
  // A burst followed by a walk: the speed ceiling must come back down.
  const pos = [];
  let x = 5000;
  for (let i = 0; i < 3; i++) { pos.push({ x, y: 5000 }); x += 30; }
  for (let i = 0; i < 8; i++) { pos.push({ x, y: 5000 }); x += 3; }
  const { track } = runTrack(pos);
  ok(track.peakSpeed < 30 * 0.5, 'burst then walk: the observed peak decays back towards the real speed',
     `peak=${track.peakSpeed.toFixed(1)} after a 30/tick burst`);
}

{
  // Multiple targets are tracked at once, which is what keeps preplace alive
  // through a change of nearest enemy.
  const motion = new TargetMotion();
  const a = { id: 1, pos: { current: { x: 0, y: 0 } } };
  const b = { id: 2, pos: { current: { x: 500, y: 0 } } };
  for (let i = 0; i < 4; i++) {
    a.pos.current = { x: 10 * i, y: 0 };
    b.pos.current = { x: 500 + 15 * i, y: 0 };
    motion.observe(a, i);
    motion.observe(b, i);
  }
  ok(motion.get(1) && motion.get(2), 'two enemies are tracked simultaneously');
  ok(motion.predict(b, 2).confidence > 0.25,
     'the non-nearest enemy already has a usable prediction when it becomes nearest');
}

{
  // intercept() and predict() must agree, now that both read one path.
  const { motion, entity } = runTrack(straight(6, 18, 0, 5000, 5000));
  const p2 = motion.predict(entity, 2);
  const hit = motion.intercept(entity, p2.x, p2.y, 5, 6);
  ok(hit !== null, 'intercept finds a circle sitting on the predicted path');
  ok(hit && hit.tick <= 2, 'intercept reports the earliest tick, not a later one', hit && String(hit.tick));
}

// ════════════════════════════════════════════════════════════════════════════
// 5. Conflict handling
// ════════════════════════════════════════════════════════════════════════════

suite('Ledger — conflict and pre-emption');

const PRIO = { SYNC: 80, RECOVERY: 60, ANTICIPATION: 50, ENGAGEMENT: 40 };

{
  const l = new PlacementLedger();
  const t = l.reserve(100, 100, 20, PRIO.RECOVERY, 'replace', 0, 3);
  ok(t !== false, 'a hard claim is granted on free ground');
  ok(l.blocked(105, 100, 20, PRIO.SYNC, 1e6) === true,
     'a hard claim blocks even a higher priority — the build is already on the wire');
  ok(l.blocked(400, 400, 20, PRIO.ENGAGEMENT, 1) === false, 'ground elsewhere stays free');
}

{
  const l = new PlacementLedger();
  l.reserve(100, 100, 20, PRIO.ANTICIPATION, 'preplace', 0, 5, { soft: true, value: 3 });
  ok(l.blocked(105, 100, 20, PRIO.ANTICIPATION, 2) === true, 'a soft claim holds against equal priority worth less');
  ok(l.blocked(105, 100, 20, PRIO.SYNC, 1e6) === false, 'a soft claim yields to a higher priority worth more');
  ok(l.blocked(105, 100, 20, PRIO.SYNC, 1) === true, 'a soft claim worth clearly more keeps its ground');
}

{
  // The auto-place path: claim() must displace a soft hold and hand back the
  // token, so the book can be told. Before, reserve() swallowed it.
  const l = new PlacementLedger();
  const soft = l.reserve(100, 100, 20, PRIO.ANTICIPATION, 'preplace', 0, 5, { soft: true, value: 3 });
  const displaced = l.preempt(105, 100, 20, PRIO.ANTICIPATION, Infinity);
  ok(displaced.length === 1 && displaced[0] === soft,
     'pre-emption reports which soft claim it took, by token');
  ok(l.reserve(105, 100, 20, PRIO.ANTICIPATION, 'autoPlacer', 0, 2) !== false,
     'the ground is then claimable by the placement that displaced it');
}

// ════════════════════════════════════════════════════════════════════════════
// 6. Placement memory
// ════════════════════════════════════════════════════════════════════════════

suite('Memory — survives movement');

{
  const mem = new PlacementMemory();
  const profile = { type: 4, footR: SPIKE.scale, ringR: ringR(SPIKE) };
  const x = 5079, y = 5000;
  mem.expire(0, { x: 5000, y: 5000 });
  mem.note(profile, x, y, 0);
  ok(mem.attempts(profile, x, y, 0) > 0, 'a send is remembered');
  ok(mem.sentThisTick(profile, x, y, 0), 'and is recognised as already paid for this tick');

  // Terminal speed is playerSpeed/(1-playerDecel) per ms, ~25.4 units a tick.
  // Three ticks of running used to wipe the whole map.
  const perTick = (Config_default.playerSpeed / (1 - Config_default.playerDecel)) * (1000 / Config_default.serverUpdateRate);
  ok(perTick > 23 && perTick < 28, 'terminal speed is ~25 units a tick', perTick.toFixed(1));
  for (let t = 1; t <= 4; t++) mem.expire(t, { x: 5000 + perTick * t, y: 5000 });
  ok(mem.attempts(profile, x, y, 4) > 0,
     'the record survives four ticks of running — the ground has not moved');
  ok(mem.attempts(profile, x + 400, y, 4) === 0, 'and does not leak onto different ground');
}

{
  const mem = new PlacementMemory();
  const profile = { type: 4, footR: SPIKE.scale, ringR: ringR(SPIKE) };
  mem.note(profile, 5079, 5000, 0);
  ok(mem.attempts(profile, 5079, 5000, 15) === 0, 'a record older than the window is gone');
}

// ════════════════════════════════════════════════════════════════════════════
// 7. Planner budget accounting
// ════════════════════════════════════════════════════════════════════════════

suite('Planner — packet accounting matches the executor');

{
  const planner = new PlacementPlanner(PlacementWeights);
  const spikeP = { type: 4, footR: SPIKE.scale, ringR: ringR(SPIKE), isTrap: false, isDamage: true, touchR: PS + SPIKE.scale, item: SPIKE };
  const trapP = { type: 7, footR: TRAP.scale, ringR: ringR(TRAP), isTrap: true, isDamage: false, touchR: PS + TRAP.scale * TRAP.colDiv, item: TRAP };
  const c = (p, x, y) => ({ profile: p, x, y, value: 5 });

  const s1 = c(spikeP, 0, 0), t1 = c(trapP, 300, 0), s2 = c(spikeP, 600, 0);
  ok(planner._appendCost(s1, []) === K.RPE_PLACE_PACKETS, 'first build costs a full place');
  ok(planner._appendCost(s2, [s1]) === K.RPE_BATCH_PACKETS, 'same type immediately after: batched');
  ok(planner._appendCost(s2, [s1, t1]) === K.RPE_PLACE_PACKETS,
     'same type but not adjacent: full price, because the executor only batches a run');
  ok(K.RPE_PLACE_PACKETS === 4, 'a place is four frames: z, F1, F0, z', String(K.RPE_PLACE_PACKETS));
}

{
  // _top must return exactly the same set a full sort would.
  const planner = new PlacementPlanner(PlacementWeights);
  const rand = rng(7);
  const list = [];
  for (let i = 0; i < 60; i++) list.push({ v: rand() });
  const topN = planner._top(list, 10, o => o.v).map(o => o.v);
  const sorted = list.slice().sort((a, b) => b.v - a.v).slice(0, 10).map(o => o.v);
  ok(JSON.stringify(topN) === JSON.stringify(sorted), 'partial selection matches a full sort');
}

// ════════════════════════════════════════════════════════════════════════════
// 8. Candidate generation
// ════════════════════════════════════════════════════════════════════════════

suite('Candidates — proposals are legal and purposeful');

function mkProfile(item, type) {
  return {
    type, id: item.id, item, footR: item.scale, ringR: ringR(item),
    isDamage: !!item.dmg, isTrap: !!item.trap,
    touchR: PS + item.scale * (item.colDiv || 1),
    layer: 0, riverLegal: false, roles: [],
  };
}

{
  // Legality, in a real object field: nothing proposed may be refused.
  const rand = rng(99);
  const { ox, oy, objs } = scene(rand, 3);
  const profile = mkProfile(SPIKE, 4);
  const aps = apertures(SPIKE, ox, oy, objs);
  const solver = new AngleSolver();
  const frame = {
    myPos: { x: ox, y: oy },
    targetPos: { x: ox + 120, y: oy + 40 },
    targetNext: { x: ox + 132, y: oy + 44 },
    targetScale: PS, targetTrapped: null, range: 126,
    ourSpikes: [], ourTraps: [], exits: null,
    motion: { samples: [1, 2], speed: 12, heading: 0.3 },
  };
  const proposals = solver.propose(profile, aps, frame, new PlacementMemory());
  ok(proposals.length > 0, 'proposals are produced');
  let illegal = 0;
  for (const p of proposals) {
    const x = ox + profile.ringR * Math.cos(p.angle), y = oy + profile.ringR * Math.sin(p.angle);
    if (!serverCheckItemLocation(x, y, SPIKE.scale, SPIKE.id, objs)) illegal++;
  }
  ok(illegal === 0, 'every proposed angle is one the server would accept', `${illegal}/${proposals.length}`);
  ok(new Set(proposals.map(p => p.source)).has('edge'), 'packed placements are proposed (aperture edges)');
}

{
  // Purpose, on an open ring, so the assertions test the solver rather than
  // whether a random scene left room. Geometric, not by source label: an angle
  // reached by two reasons is recorded once, under whichever came first.
  const ox = 5000, oy = 5000;
  const profile = mkProfile(SPIKE, 4);
  const R = profile.ringR;
  const aps = apertures(SPIKE, ox, oy, []);
  const solver = new AngleSolver();
  const at = a => ({ x: ox + R * Math.cos(a), y: oy + R * Math.sin(a) });
  const touchR = profile.footR + PS;

  // Target inside build reach, running.
  const speed = 14, heading = 0.35;
  const tgt = { x: ox + 100, y: oy + 20 };
  const frame = {
    myPos: { x: ox, y: oy }, targetPos: tgt,
    targetNext: { x: tgt.x + Math.cos(heading) * speed, y: tgt.y + Math.sin(heading) * speed },
    targetScale: PS, targetTrapped: null, range: Math.hypot(100, 20),
    ourSpikes: [], ourTraps: [], exits: null,
    motion: { samples: [1, 2], speed, heading },
  };
  const proposals = solver.propose(profile, aps, frame, new PlacementMemory());

  const nearestTo = (px, py) => Math.min(...proposals.map(p => {
    const q = at(p.angle);
    return Math.hypot(q.x - px, q.y - py);
  }));

  ok(nearestTo(tgt.x, tgt.y) < touchR, 'a placement that touches the target is proposed',
     `nearest=${nearestTo(tgt.x, tgt.y).toFixed(1)} vs reach ${touchR.toFixed(0)}`);

  const lead = { x: tgt.x + Math.cos(heading) * speed * 2, y: tgt.y + Math.sin(heading) * speed * 2 };
  ok(nearestTo(lead.x, lead.y) < touchR, 'a placement covering where the target is heading is proposed',
     `nearest=${nearestTo(lead.x, lead.y).toFixed(1)} vs reach ${touchR.toFixed(0)}`);

  // Packing against one of our own spikes just outside the ring.
  const own = { pos: { current: { x: ox + 130, y: oy - 40 } }, collisionScale: SPIKE.scale };
  const packFrame = Object.assign({}, frame, { ourSpikes: [own] });
  const packProposals = solver.propose(profile, aps, packFrame, new PlacementMemory());
  const packNearest = Math.min(...packProposals.map(p => {
    const q = at(p.angle);
    return Math.hypot(q.x - own.pos.current.x, q.y - own.pos.current.y);
  }));
  ok(packNearest < profile.footR + own.collisionScale + 6,
     'a placement packed flush against one of our own spikes is proposed',
     `gap=${packNearest.toFixed(1)} vs flush ${(profile.footR + own.collisionScale).toFixed(0)}`);

  // A spike positioned to push the target into one of our traps.
  const trap = { pos: { current: { x: tgt.x + 90, y: tgt.y + 30 } }, collisionScale: TRAP.scale * TRAP.colDiv };
  const trapFrame = Object.assign({}, frame, { ourTraps: [trap] });
  const trapProposals = solver.propose(profile, aps, trapFrame, new PlacementMemory());
  const toTrap = Math.atan2(trap.pos.current.y - tgt.y, trap.pos.current.x - tgt.x);
  const pushesIn = trapProposals.some(p => {
    const q = at(p.angle);
    const push = Math.atan2(tgt.y - q.y, tgt.x - q.x);
    return G.angleDist(push, toTrap) < 0.4 && Math.hypot(q.x - tgt.x, q.y - tgt.y) < touchR;
  });
  ok(pushesIn, 'a spike whose push carries the target into our trap is proposed');

  // Range adaptivity: the set narrows as the target gets further away.
  const far = Object.assign({}, frame, {
    range: 500, targetPos: { x: ox + 500, y: oy }, targetNext: { x: ox + 505, y: oy },
  });
  const farProposals = solver.propose(profile, aps, far, new PlacementMemory());
  ok(farProposals.length < proposals.length,
     'the candidate set narrows with range instead of staying flat',
     `close=${proposals.length} far=${farProposals.length}`);
  ok(farProposals.some(p => p.source === 'edge'), 'packed placements are still proposed at range');
}

{
  // Sealing. The scorer rewards a build sitting within 0.45 rad of an escape
  // direction as seen from the target, so that is what a proposal has to
  // achieve — the gap itself can be further away than the build ring reaches.
  const ox = 5000, oy = 5000;
  const tx = ox + 70, ty = oy;
  const ring = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 6) * Math.PI * 2;
    ring.push({ x: tx + Math.cos(a) * 95, y: ty + Math.sin(a) * 95, escapeScale: SPIKE.scale });
  }
  const esc = S.isEscapable(tx, ty, PS, ring);
  ok(esc.escapable && esc.exits.length > 0, 'escape analysis finds the gap in a partial ring');

  const profile = mkProfile(SPIKE, 4);
  const R = profile.ringR;
  const aps = apertures(SPIKE, ox, oy, []);
  const solver = new AngleSolver();
  const withExits = {
    myPos: { x: ox, y: oy }, targetPos: { x: tx, y: ty }, targetNext: { x: tx, y: ty },
    targetScale: PS, targetTrapped: null, range: 70,
    ourSpikes: [], ourTraps: [], exits: esc.exits, motion: null,
  };
  const withoutExits = Object.assign({}, withExits, { exits: null });
  const seals = f => solver.propose(profile, aps, f, new PlacementMemory()).some(p => {
    const qx = ox + R * Math.cos(p.angle), qy = oy + R * Math.sin(p.angle);
    const fromTarget = Math.atan2(qy - ty, qx - tx);
    return esc.exits.some(e => G.angleDist(fromTarget, e.angle) < 0.45);
  });
  ok(seals(withExits), 'with an escape route known, a placement closing it is proposed');
}

// ════════════════════════════════════════════════════════════════════════════
// 9. Interaction: the three systems on one ring
// ════════════════════════════════════════════════════════════════════════════

suite('Interaction — auto place, preplace and replace on one ledger');

{
  const l = new PlacementLedger();
  const foot = SPIKE.scale;
  // Preplace books ground softly for a predicted interception.
  const book = l.reserve(200, 0, foot, PRIO.ANTICIPATION, 'preplace', 0, 5, { soft: true, value: 4 });
  ok(book !== false, 'preplace books its ground');
  // Replace reacts to a deletion nearby and outranks it.
  const disp = l.preempt(200 + foot * 0.5, 0, foot, PRIO.RECOVERY, 9);
  ok(disp.indexOf(book) !== -1, 'replace displaces the softer, lower-priority booking');
  const rep = l.reserve(200 + foot * 0.5, 0, foot, PRIO.RECOVERY, 'replace', 0, 2);
  ok(rep !== false, 'replace takes the ground');
  // Auto place, planning later in the same tick, is kept off it.
  ok(l.blocked(200 + foot * 0.5, 0, foot, PRIO.ANTICIPATION, 1e6) === true,
     'auto place is kept off ground a replacement has committed');
  // And elsewhere it is free to build.
  ok(l.blocked(600, 0, foot, PRIO.ANTICIPATION, 1e6) === false, 'auto place is free elsewhere on the ring');
}

{
  // A trap chain: a spike whose push lands the target on our trap should be
  // recognised by the simulation the planner now reads.
  const CONTACT2 = PS + SPIKE.scale;
  const sy = 5000, tx = 5200, ty = sy;
  const trap = { x: tx + 150, y: ty, colScale: TRAP.scale * TRAP.colDiv, dmg: 0, trap: true };
  // Spike on the far side of the target from the trap: the push is toward it.
  const good = S.simulateKnockback(tx - (CONTACT2 - 4), sy, SPIKE.scale, [trap], tx, ty, 0, 0);
  ok(good.stopped, 'trap chain: a spike opposite the trap lands them in it');
  // Spike on the trap's own side: the push is away from it.
  const bad = S.simulateKnockback(tx + (CONTACT2 - 4), sy, SPIKE.scale, [trap], tx, ty, 0, 0);
  ok(!bad.stopped, 'trap chain: a spike on the trap’s own side does not');
}

// ════════════════════════════════════════════════════════════════════════════
// 10. Ring seal — choosing the ring as a set
// ════════════════════════════════════════════════════════════════════════════

suite('Ring seal — packing the placement ring');

// _sealRingOrder touches only this._predictObjects, Items and Config, so it
// runs on a bare object carrying the method.
const sealer = { _predictObjects: [], _sealRingOrder: AutoPlacer.prototype._sealRingOrder };
const TAU = Math.PI * 2;

function ringGeom(item) {
  const ring = PS + item.scale + (item.placeOffset || 0);
  const sep = item.scale * 2;
  const minSep = 2 * Math.asin(sep / (2 * ring));
  return { ring, sep, minSep, maxSpots: Math.floor(TAU / minSep) };
}
// Candidates in the shape the ladder produces.
function ringCands(item, angles) {
  const R = PS + item.scale + (item.placeOffset || 0);
  return angles.map(a => ({
    id: item.id, angle: G.norm(a), scale: item.scale, perfect: false,
    x: 5000 + R * Math.cos(a), y: 5000 + R * Math.sin(a),
  }));
}
function widestGap(set) {
  const a = set.map(c => c.angle).sort((x, y) => x - y);
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    let g = a[(i + 1) % a.length] - a[i];
    if (g <= 0) g += TAU;
    if (g > worst) worst = g;
  }
  return worst;
}
function minPairSep(set) {
  let m = Infinity;
  for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
    m = Math.min(m, G.angleDist(set[i].angle, set[j].angle));
  }
  return m;
}

{
  for (const item of [SPIKE, Items.find(i => i.name === 'greater spikes')]) {
    const g = ringGeom(item);
    ok(g.maxSpots === 4, `${item.name}: the ring holds exactly 4`,
       `ring=${g.ring} gap=${g.sep} minSep=${(g.minSep * 180 / Math.PI).toFixed(1)}deg spots=${g.maxSpots}`);
    const largest = 360 - 3 * (g.minSep * 180 / Math.PI);
    ok(largest < 138.6, `${item.name}: four legs cannot leave a walkable hole`, `${largest.toFixed(1)}deg`);
  }
}

{
  // A fully open ring at the resolution the ladder scans.
  const item = SPIKE, g = ringGeom(item);
  const cands = ringCands(item, Array.from({ length: 72 }, (_, i) => i * TAU / 72));
  sealer._predictObjects = [];
  const out = sealer._sealRingOrder(cands, item.id, null);
  const head = out.slice(0, g.maxSpots);
  ok(out.length === cands.length, 'every candidate is returned — the packer orders, it does not discard');
  ok(head.length === 4, 'an open ring yields a full set of four at the front');
  ok(minPairSep(head) >= g.minSep - 1e-9, 'the four are all at least the minimum separation apart',
     `min=${(minPairSep(head) * 180 / Math.PI).toFixed(1)}deg need=${(g.minSep * 180 / Math.PI).toFixed(1)}deg`);
  ok(widestGap(head) * 180 / Math.PI < 138.6, 'and they leave no walkable hole',
     `widest=${(widestGap(head) * 180 / Math.PI).toFixed(1)}deg`);
}

{
  // Greedy earliest-feasible must find a full ring whenever one exists at all.
  // Brute force over every 4-subset is the reference.
  const item = SPIKE, g = ringGeom(item);
  function bruteHasRing(cands) {
    const n = cands.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
      const set = [cands[a], cands[b], cands[c], cands[d]];
      if (minPairSep(set) >= g.minSep - 1e-9) return true;
    }
    return false;
  }
  let agree = 0, existed = 0, found = 0, scenes = 0;
  for (let s = 0; s < 300; s++) {
    const rand = rng(7000 + s);
    // A random subset of the ring is legal.
    const angles = [];
    for (let i = 0; i < 72; i++) if (rand() < 0.35 + rand() * 0.5) angles.push(i * TAU / 72);
    if (angles.length < 4) continue;
    scenes++;
    const cands = ringCands(item, angles);
    sealer._predictObjects = [];
    const head = sealer._sealRingOrder(cands, item.id, null).slice(0, 4);
    const gotRing = head.length === 4 && minPairSep(head) >= g.minSep - 1e-9;
    const hasRing = bruteHasRing(cands);
    if (hasRing) existed++;
    if (gotRing) found++;
    if (gotRing === hasRing) agree++;
  }
  ok(agree === scenes, `greedy agrees with brute force on all ${scenes} scenes`, `${agree}/${scenes}`);
  ok(found === existed, 'it finds a full ring exactly when one exists', `found ${found}, existed ${existed}`);
}

{
  // Against the order the ladder actually produces -- the ring in angle order,
  // committed through the same footprint dedup _addPredictObject applies --
  // packing must never do worse, on legs placed or on the hole left behind.
  const item = SPIKE;
  const commit = list => {
    const out = [];
    for (const c of list) {
      if (out.every(o => Math.hypot(o.x - c.x, o.y - c.y) >= o.scale + c.scale)) out.push(c);
    }
    return out;
  };
  let worse = 0, better = 0, scenes = 0;
  for (let s = 0; s < 200; s++) {
    const rand = rng(8000 + s);
    // Three usable arcs, so a full four-leg ring cannot be built.
    const angles = [];
    for (const centre of [0.2, 2.3, 4.4]) {
      for (let k = 0; k < 6; k++) angles.push(centre + (rand() - 0.5) * 0.5);
    }
    const cands = ringCands(item, angles);
    sealer._predictObjects = [];
    const packed = commit(sealer._sealRingOrder(cands, item.id, null));
    const scan = commit(cands.slice().sort((a, b) => a.angle - b.angle));
    if (packed.length < 2 || scan.length < 2) continue;
    scenes++;
    if (packed.length < scan.length || (packed.length === scan.length && widestGap(packed) > widestGap(scan) + 1e-9)) worse++;
    if (packed.length > scan.length || (packed.length === scan.length && widestGap(packed) < widestGap(scan) - 1e-9)) better++;
  }
  ok(scenes > 0, 'partial-ring scenes were generated', String(scenes));
  ok(worse === 0, 'with no full ring available it is never worse than scan order',
     `${worse}/${scenes} worse, ${better} better`);
}

{
  // Ground already committed this tick is not offered to the ring.
  const item = SPIKE;
  const cands = ringCands(item, Array.from({ length: 72 }, (_, i) => i * TAU / 72));
  const blocked = cands[10];
  sealer._predictObjects = [{ id: item.id, x: blocked.x, y: blocked.y, scale: item.scale }];
  const out = sealer._sealRingOrder(cands, item.id, null);
  // What the ladder actually commits: the prefix that clears every footprint,
  // which is what _addPredictObject enforces downstream.
  const committed = [];
  for (const c of out) {
    if (Math.hypot(c.x - blocked.x, c.y - blocked.y) < c.scale + item.scale) continue;
    if (committed.every(o => Math.hypot(o.x - c.x, o.y - c.y) >= o.scale + c.scale)) committed.push(c);
  }
  const leadIsFree = out.slice(0, committed.length).every(
    c => Math.hypot(c.x - blocked.x, c.y - blocked.y) >= c.scale + item.scale);
  ok(leadIsFree, 'the ring the packer proposes never spends a slot on ground already committed',
     `${committed.length} legs`);
  ok(committed.length >= 3, 'and a ring with one slot taken still yields three legs', `${committed.length}`);
  sealer._predictObjects = [];
}

{
  // The preferred angle leads when a full ring can be built through it.
  const item = SPIKE, g = ringGeom(item);
  const cands = ringCands(item, Array.from({ length: 72 }, (_, i) => i * TAU / 72));
  const prefer = cands[9];
  sealer._predictObjects = [];
  const out = sealer._sealRingOrder(cands, item.id, prefer);
  ok(out[0] === prefer, 'the preferred angle anchors a full ring');
  ok(minPairSep(out.slice(0, 4)) >= g.minSep - 1e-9, 'and the ring through it is still valid');
}

// ── report ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  • ' + f);
}
process.exit(fail ? 1 : 0);
