// Verifies the RYN Type 2 placement engine's geometry, angle solver and
// motion prediction by pulling them straight out of Ryn_Type_2.user.js and
// exercising them against brute-force references.
//
//   node tools/verify-placement.js
//
// Nothing here is stubbed except the two map constants the river test needs.
// Everything under test is the shipped source.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const CLIENT = path.join(ROOT, "Ryn_Type_2.user.js");
const src = fs.readFileSync(CLIENT, "utf8");

function slice(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a < 0) throw new Error("missing start: " + startMarker);
  const b = src.indexOf(endMarker, a);
  if (b < 0) throw new Error("missing end: " + endMarker);
  return src.slice(a, b);
}

const Config_default = { mapScale: 14400, riverWidth: 724 };
const sandbox = eval(`(function(){
  const RPE_TICK_MS = 1e3 / 9, RPE_DECEL = .993;
  ${slice("const RPE_EPS = 1e-6;", "// Priority classes for the reservation ledger.")}
  ${slice("const GeometrySolver = {", "// \u2500\u2500 Reservation ledger")}
  ${slice("class PlacementMemory {", "// \u2500\u2500 Build profiles")}
  ${slice("// Layer budgets.", "// \u2500\u2500 Scoring")}
  ${slice("const RPE_TICK_DECAY", "// \u2500\u2500 Network clock")}
  return { GeometrySolver, AngleSolver, PlacementMemory, TargetMotion,
           RPE_ANGLE_SLOTS, RPE_ANGLE_STEP, RPE_LATTICE, RPE_TAU, RPE_SLOT_HALF };
})()`);

const { GeometrySolver: G, AngleSolver, PlacementMemory, TargetMotion,
        RPE_ANGLE_SLOTS: N, RPE_ANGLE_STEP: STEP, RPE_LATTICE: LAT, RPE_TAU: TAU } = sandbox;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; }
  else { fail++; console.log("  FAIL " + name + (extra ? "  " + extra : "")); }
};

// ── Lattice ────────────────────────────────────────────────────────────────
console.log("144-slot lattice");
ok("slot count is 144", N === 144, "got " + N);
{
  const set = new Set();
  for (let i = 0; i < N; i++) set.add(LAT[i].toFixed(12));
  ok("all 144 angles distinct", set.size === 144, "distinct=" + set.size);
}
{
  // Even distribution: every consecutive gap identical, and the wrap gap too.
  let maxErr = 0;
  for (let i = 1; i < N; i++) maxErr = Math.max(maxErr, Math.abs((LAT[i] - LAT[i - 1]) - STEP));
  maxErr = Math.max(maxErr, Math.abs((LAT[0] + TAU - LAT[N - 1]) - STEP));
  ok("even angular spacing", maxErr < 1e-12, "maxErr=" + maxErr);
}
ok("covers full 360", LAT[0] === 0 && LAT[N - 1] < TAU && LAT[N - 1] > TAU - STEP - 1e-12);
ok("step is 2.5 degrees", Math.abs(STEP * 180 / Math.PI - 2.5) < 1e-12);
{
  // slotOf must round-trip and stay in range for arbitrary angles incl. wrap.
  let bad = 0, oob = 0;
  for (let i = 0; i < 20000; i++) {
    const a = (Math.random() - 0.5) * 40;
    const s = G.slotOf(a);
    if (!Number.isInteger(s) || s < 0 || s >= N) oob++;
    if (G.angleDist(LAT[s], a) > STEP / 2 + 1e-9) bad++;
  }
  ok("slotOf in range for any angle", oob === 0, "oob=" + oob);
  ok("slotOf picks nearest slot", bad === 0, "bad=" + bad);
}
// ── contactArc ─────────────────────────────────────────────────────────────
console.log("contactArc");
{
  let checked = 0, badIn = 0, badOut = 0, nullWhenReachable = 0, fullArcs = 0;
  for (let t = 0; t < 3000; t++) {
    const ringR = 60 + Math.random() * 60;
    const footR = 10 + Math.random() * 50;
    const targetR = 15 + Math.random() * 45;
    const ang = Math.random() * TAU;
    const dist = Math.random() * (ringR + footR + targetR + 40);
    const tx = Math.cos(ang) * dist, ty = Math.sin(ang) * dist;
    const arc = G.contactArc(0, 0, ringR, footR, tx, ty, targetR);
    const reach = footR + targetR;
    // Brute force: is there any ring angle whose footprint touches the target?
    let anyTouch = false;
    for (let k = 0; k < 2880; k++) {
      const a = k * TAU / 2880;
      const px = ringR * Math.cos(a), py = ringR * Math.sin(a);
      if (Math.hypot(px - tx, py - ty) < reach - 1e-9) { anyTouch = true; break; }
    }
    if (arc === null) { if (anyTouch) nullWhenReachable++; continue; }
    checked++;
    // Every angle strictly inside the arc must touch; just outside must not.
    const [s, , span] = arc;
    for (let f = 0.02; f < 0.99; f += 0.07) {
      const a = s + span * f;
      const px = ringR * Math.cos(a), py = ringR * Math.sin(a);
      if (Math.hypot(px - tx, py - ty) > reach + 1e-6) badIn++;
    }
    // A full-circle arc has no outside; every direction genuinely touches.
    if (span < TAU - 1e-9) {
      for (const a of [s - 0.02, s + span + 0.02]) {
        const px = ringR * Math.cos(a), py = ringR * Math.sin(a);
        if (Math.hypot(px - tx, py - ty) < reach - 1e-6) badOut++;
      }
    } else {
      fullArcs++;
    }
  }
  ok("arc returned whenever contact is possible", nullWhenReachable === 0, "missed=" + nullWhenReachable);
  ok("every angle inside the arc touches", badIn === 0, "violations=" + badIn + " of " + checked + " arcs");
  ok("angles just outside the arc do not", badOut === 0, "violations=" + badOut);
  ok("full-circle contact arcs were exercised", fullArcs > 0, "cases=" + fullArcs);
}

// ── intersect + closestIn ──────────────────────────────────────────────────
console.log("intersect + closestIn (closest useful angle)");
{
  const RES = 7200;                         // 0.05 degree brute-force grid
  let notBoth = 0, missedExisting = 0, falsePositive = 0, worstExcess = 0,
      cases = 0, found = 0, wrongPassthrough = 0, subGridSlivers = 0;
  const inRanges = (ranges, a) => {
    for (const r of ranges) {
      const span = r[2] !== undefined ? r[2] : (r[1] - r[0] + TAU) % TAU;
      let d = G.norm(a) - G.norm(r[0]);
      if (d < 0) d += TAU;
      if (d <= span + 1e-9) return true;
    }
    return false;
  };
  for (let t = 0; t < 6000; t++) {
    // Apertures built the way the engine builds them, from real occlusions.
    const ringR = 90 + Math.random() * 40, footR = 15 + Math.random() * 35;
    const blocked = [];
    const nb = Math.random() * 8 | 0;
    for (let i = 0; i < nb; i++) {
      const a = Math.random() * TAU, d = ringR + (Math.random() - 0.5) * 40;
      const arc = G.occlusion(0, 0, ringR, footR, Math.cos(a) * d, Math.sin(a) * d, 20 + Math.random() * 50);
      if (arc) blocked.push(arc);
    }
    const aps = G.invert(G.merge(blocked));
    if (aps.length === 0) continue;
    const as = Math.random() * TAU, aspan = 0.1 + Math.random() * 2.0;
    const arc = [as, (as + aspan) % TAU, aspan];
    const wanted = Math.random() * TAU;
    cases++;

    const overlap = G.intersect(aps, [arc]);
    const got = overlap.length ? G.closestIn(overlap, wanted) : null;

    // Brute-force truth over both sets independently.
    let bestD = Infinity, exists = false;
    for (let k = 0; k < RES; k++) {
      const a = k * TAU / RES;
      if (!inRanges(aps, a) || !inRanges([arc], a)) continue;
      exists = true;
      const d = G.angleDist(a, wanted);
      if (d < bestD) bestD = d;
    }
    if (got === null) {
      // Giving up is only allowed when the overlap is genuinely empty, or so
      // thin that the grid and the solver can disagree about it existing.
      if (exists && bestD > 0.01) missedExisting++;
      continue;
    }
    found++;
    // An overlap narrower than one grid step is invisible to the brute force
    // but is not wrong; only a wide one the grid missed would be.
    if (!exists) {
      let widest = 0;
      for (const o of overlap) widest = Math.max(widest, o[2]);
      if (widest > TAU / RES) falsePositive++;
      else subGridSlivers++;
    }
    if (!inRanges(aps, got) || !inRanges([arc], got)) notBoth++;
    const wantedQualifies = inRanges(aps, wanted) && inRanges([arc], wanted);
    if (wantedQualifies && Math.abs(G.norm(got) - G.norm(wanted)) > 1e-9) wrongPassthrough++;
    if (!wantedQualifies && bestD < Infinity) {
      worstExcess = Math.max(worstExcess, G.angleDist(got, wanted) - bestD);
    }
  }
  ok("result satisfies both the arc and the free ground", notBoth === 0, "violations=" + notBoth);
  ok("never returns an angle when the overlap is empty", falsePositive === 0,
     "violations=" + falsePositive + " (sub-grid slivers seen and allowed: " + subGridSlivers + ")");
  ok("never gives up when a usable overlap exists", missedExisting === 0, "violations=" + missedExisting);
  ok("a wanted angle that already qualifies passes through", wrongPassthrough === 0, "violations=" + wrongPassthrough);
  // The only permitted departure from optimal is the deliberate inset that
  // keeps a build off the legality line.
  ok("never worse than optimal by more than the inset", worstExcess <= 0.0201,
     "worst excess=" + worstExcess.toFixed(5) + " rad, inset=0.02");
  ok("both outcomes exercised", found > 100 && cases - found > 100, "found=" + found + " of " + cases);
}

// ── occlusion: squared-distance early-out must not change the answer ───────
console.log("occlusion (squared early-out)");
{
  // Reference implementation = the original, with Math.hypot and no squaring.
  function refOcclusion(ox, oy, ringR, footR, bx, by, blockR) {
    const dx = bx - ox, dy = by - oy;
    const d = Math.hypot(dx, dy);
    const reach = footR + blockR;
    if (d >= ringR + reach) return null;
    if (d + ringR <= reach) return "full";
    if (d + reach <= ringR) return null;
    if (d < 1e-6) return "full";
    let cosArg = (d * d + ringR * ringR - reach * reach) / (2 * d * ringR);
    if (cosArg < -1) cosArg = -1; else if (cosArg > 1) cosArg = 1;
    const half = Math.acos(cosArg);
    const centre = Math.atan2(dy, dx);
    return [centre - half, centre + half];
  }
  let diff = 0, arcs = 0, fulls = 0, nulls = 0;
  for (let t = 0; t < 60000; t++) {
    const ringR = 40 + Math.random() * 90;
    const footR = 5 + Math.random() * 55;
    const blockR = 5 + Math.random() * 300;
    const bx = (Math.random() - 0.5) * 900, by = (Math.random() - 0.5) * 900;
    const a = G.occlusion(0, 0, ringR, footR, bx, by, blockR);
    const b = refOcclusion(0, 0, ringR, footR, bx, by, blockR);
    if (a === null) nulls++; else if (a === "full") fulls++; else arcs++;
    if (a === null || b === null || a === "full" || b === "full") {
      if (a !== b) diff++;
    } else if (Math.abs(a[0] - b[0]) > 1e-9 || Math.abs(a[1] - b[1]) > 1e-9) diff++;
  }
  ok("identical to the pre-optimisation formula", diff === 0, "differences=" + diff);
  ok("test data exercised all three outcomes", nulls > 0 && fulls > 0 && arcs > 0,
     "null=" + nulls + " full=" + fulls + " arc=" + arcs);
}


// Apertures exactly as CandidateGenerator builds them, minus the client.
function apertures(profile, ox, oy, blockers) {
  const blocked = [];
  for (const b of blockers) {
    const arc = G.occlusion(ox, oy, profile.ringR, profile.footR, b.x, b.y, b.r);
    if (arc) blocked.push(arc);
  }
  return G.invert(G.merge(blocked));
}
const inFree = (aps, a) => !!G.inAperture(aps, a);

function world(blockerCount, seedR) {
  const profile = { type: 4, ringR: 105, footR: 35 };
  const blockers = [];
  for (let i = 0; i < blockerCount; i++) {
    const a = Math.random() * TAU;
    const d = profile.ringR + (Math.random() - 0.5) * 40;
    blockers.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: seedR });
  }
  return { profile, blockers };
}
function frameFor(tx, ty, nx, ny, opts) {
  opts = opts || {};
  return {
    myPos: { x: 0, y: 0 },
    targetPos: { x: tx, y: ty },
    targetNext: { x: nx, y: ny },
    targetScale: 35,
    targetTrapped: opts.trapped || null,
    motion: opts.motion || { heading: Math.atan2(ny - ty, nx - tx), speed: 4, event: "steady" }
  };
}

const solver = new AngleSolver();
const memory = new PlacementMemory();

// ── every proposal is legal, and none repeats ──────────────────────────────
console.log("proposal legality and uniqueness");
{
  let illegal = 0, dupes = 0, empties = 0, runs = 0, totalProposals = 0;
  for (let t = 0; t < 4000; t++) {
    const { profile, blockers } = world(Math.random() * 9 | 0, 25 + Math.random() * 45);
    const aps = apertures(profile, 0, 0, blockers);
    if (aps.length === 0) continue;
    runs++;
    const ta = Math.random() * TAU, td = 60 + Math.random() * 200;
    const tx = Math.cos(ta) * td, ty = Math.sin(ta) * td;
    const nx = tx + (Math.random() - 0.5) * 40, ny = ty + (Math.random() - 0.5) * 40;
    const props = solver.propose(profile, aps, frameFor(tx, ty, nx, ny), memory);
    if (props.length === 0) empties++;
    totalProposals += props.length;
    const keys = new Set();
    for (const p of props) {
      if (!inFree(aps, p.angle)) illegal++;
      const k = memory.key(profile, p.angle);
      if (keys.has(k)) dupes++;
      keys.add(k);
    }
  }
  ok("no proposal lands on blocked ground", illegal === 0, "illegal=" + illegal);
  ok("no two proposals share a placement slot", dupes === 0, "dupes=" + dupes);
  ok("free ground always yields at least one proposal", empties === 0, "empty=" + empties + " of " + runs);
  console.log("    " + runs + " worlds, " + (totalProposals / runs).toFixed(1) + " proposals each on average");
}

// ── contact proposals really do touch ──────────────────────────────────────
console.log("contact proposals");
{
  let checked = 0, notTouching = 0, reachableRuns = 0, gotContact = 0;
  for (let t = 0; t < 4000; t++) {
    const { profile, blockers } = world(Math.random() * 6 | 0, 25 + Math.random() * 35);
    const aps = apertures(profile, 0, 0, blockers);
    if (aps.length === 0) continue;
    const ta = Math.random() * TAU;
    // Put the target inside the ring's reach so contact is geometrically on.
    const td = profile.ringR + (Math.random() - 0.5) * 50;
    const tx = Math.cos(ta) * td, ty = Math.sin(ta) * td;
    const arc = G.contactArc(0, 0, profile.ringR, profile.footR, tx, ty, 35);
    const reachable = arc && G.intersect(aps, [arc]).length > 0;
    if (reachable) reachableRuns++;
    const props = solver.propose(profile, aps, frameFor(tx, ty, tx, ty), memory);
    let sawContact = false;
    for (const p of props) {
      if (p.source !== "contact" && p.source !== "contactNext") continue;
      sawContact = true;
      checked++;
      const px = profile.ringR * Math.cos(p.angle), py = profile.ringR * Math.sin(p.angle);
      if (Math.hypot(px - tx, py - ty) > profile.footR + 35 + 1e-6) notTouching++;
    }
    if (sawContact) gotContact++;
  }
  ok("every contact proposal touches the target", notTouching === 0, "violations=" + notTouching + " of " + checked);
  ok("contact is found whenever legal contact exists", gotContact >= reachableRuns,
     "found=" + gotContact + " reachable=" + reachableRuns);
}

// ── the closest-useful property ────────────────────────────────────────────
// A contact proposal must be the legal touching angle nearest to straight at
// the target - not merely some touching angle.
console.log("closest useful position");
{
  let worse = 0, tested = 0;
  for (let t = 0; t < 3000; t++) {
    const { profile, blockers } = world(Math.random() * 7 | 0, 25 + Math.random() * 40);
    const aps = apertures(profile, 0, 0, blockers);
    if (aps.length === 0) continue;
    const ta = Math.random() * TAU, td = profile.ringR + (Math.random() - 0.5) * 50;
    const tx = Math.cos(ta) * td, ty = Math.sin(ta) * td;
    const props = solver.propose(profile, aps, frameFor(tx, ty, tx, ty), memory);
    const contact = props.find(p => p.source === "contact" || p.source === "contactNext");
    if (!contact) continue;
    tested++;
    const want = Math.atan2(ty, tx);
    // Brute force the best legal touching angle at 0.1 degree resolution.
    let best = Infinity;
    for (let k = 0; k < 3600; k++) {
      const a = k * TAU / 3600;
      if (!inFree(aps, a)) continue;
      const px = profile.ringR * Math.cos(a), py = profile.ringR * Math.sin(a);
      if (Math.hypot(px - tx, py - ty) > profile.footR + 35) continue;
      best = Math.min(best, G.angleDist(a, want));
    }
    if (best === Infinity) continue;
    // Allowed slack is the inset closestIn holds off the boundary by.
    if (G.angleDist(contact.angle, want) > best + 0.03) worse++;
  }
  ok("contact angle is the nearest legal touching angle", worse === 0,
     "violations=" + worse + " of " + tested);
}

// ── layer 4: heavily blocked rings ─────────────────────────────────────────
console.log("layer 4 fallback");
{
  let missed = 0, cases = 0;
  for (let t = 0; t < 3000; t++) {
    // Leave exactly one narrow gap and put the target far behind the player,
    // so no tactical layer has any reason to look at the gap.
    const profile = { type: 4, ringR: 105, footR: 20 };
    const gap = Math.random() * TAU;
    const blockers = [];
    for (let i = 0; i < 24; i++) {
      const a = gap + 0.5 + (i / 24) * (TAU - 1.0);
      blockers.push({ x: Math.cos(a) * profile.ringR, y: Math.sin(a) * profile.ringR, r: 40 });
    }
    const aps = apertures(profile, 0, 0, blockers);
    if (aps.length === 0) continue;
    cases++;
    const away = gap + Math.PI;
    const tx = Math.cos(away) * 260, ty = Math.sin(away) * 260;
    const props = solver.propose(profile, aps, frameFor(tx, ty, tx, ty), memory);
    if (props.length === 0) missed++;
  }
  ok("finds the gap even when no tactical layer points at it", missed === 0,
     "missed=" + missed + " of " + cases);
}

// ── the sweep is skipped once exact geometry has answered ──────────────────
console.log("sweep gating");
{
  let sweepWhenAnswered = 0, answeredCases = 0, sweptCases = 0;
  for (let t = 0; t < 4000; t++) {
    const { profile, blockers } = world(Math.random() * 8 | 0, 25 + Math.random() * 45);
    const aps = apertures(profile, 0, 0, blockers);
    if (aps.length === 0) continue;
    const ta = Math.random() * TAU, td = profile.ringR + (Math.random() - 0.5) * 60;
    const tx = Math.cos(ta) * td, ty = Math.sin(ta) * td;
    const props = solver.propose(profile, aps, frameFor(tx, ty, tx + 8, ty + 8), memory);
    const tactical = props.filter(p => p.source === "contact" || p.source === "contactNext" ||
                                       p.source === "focus" || p.source === "trap").length;
    const sweepCount = props.filter(p => p.source === "sweep" || p.source === "sweepSnap").length;
    if (sweepCount) sweptCases++;
    // The gate is evaluated before the sweep runs, and the sweep can only add
    // non-tactical proposals, so the state it saw is the final set minus them.
    const lengthAtGate = props.length - sweepCount;
    if (tactical >= 2 && lengthAtGate >= 4) {
      answeredCases++;
      if (sweepCount) sweepWhenAnswered++;
    }
  }
  ok("no lattice work once two exact answers exist", sweepWhenAnswered === 0,
     "leaks=" + sweepWhenAnswered + " of " + answeredCases + " answered cases");
  ok("the sweep still runs when it is needed", sweptCases > 0, "cases=" + sweptCases);
}

// ── determinism ────────────────────────────────────────────────────────────
console.log("determinism");
{
  let differed = 0;
  for (let t = 0; t < 500; t++) {
    const { profile, blockers } = world(5, 40);
    const aps = apertures(profile, 0, 0, blockers);
    if (aps.length === 0) continue;
    const f = frameFor(90, 40, 100, 50);
    const a = solver.propose(profile, aps, f, memory).map(p => p.angle.toFixed(12) + p.source).join("|");
    const b = solver.propose(profile, aps, f, memory).map(p => p.angle.toFixed(12) + p.source).join("|");
    const c = solver.propose(profile, aps, f, memory).map(p => p.angle.toFixed(12) + p.source).join("|");
    if (a !== b || b !== c) differed++;
  }
  ok("identical input gives identical output", differed === 0, "differed=" + differed);
}


// ── Motion: the path cache must be a pure refactor ─────────────────────────
// predict() used to integrate forward from the present on every call. It now
// reads a path integrated once per observation. Same track state in, same
// positions out - checked against the original integration, written here as a
// reference so this test needs nothing but the shipped file.
console.log("motion path cache");
{
  const RPE_TICK_DECAY = Math.pow(0.993, 1e3 / 9);
  function refPredict(track, pos, ticks) {
    let x = pos.x, y = pos.y, vx = track.vx, vy = track.vy;
    const seen = Math.max(track.speed, track.peakSpeed ?? track.speed);
    const floor = track.speed * RPE_TICK_DECAY;
    for (let i = 0; i < ticks; i++) {
      x += vx; y += vy;
      vx += track.ax; vy += track.ay;
      const sp = Math.hypot(vx, vy);
      if (sp > seen * 1.1 && sp > 0) { const k = seen * 1.1 / sp; vx *= k; vy *= k; }
      else if (sp < floor && sp > 0) { const k = floor / sp; vx *= k; vy *= k; }
    }
    const depth = Math.min(1, (track.samples.length - 1) / 2);
    const horizon = Math.exp(-ticks / 3.5);
    const turning = 1 - Math.min(1, (track.headingShift ?? 0) / (Math.PI / 2));
    return { x, y, confidence: Math.max(.02, track.stability * depth * horizon * (.4 + .6 * turning)) };
  }
  let worstPos = 0, worstConf = 0, checks = 0;
  for (let t = 0; t < 4000; t++) {
    const track = {
      samples: [{ x: 0, y: 0, tick: 1 }, { x: 1, y: 1, tick: 2 }, { x: 2, y: 2, tick: 3 }, { x: 3, y: 3, tick: 4 }],
      vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20,
      ax: (Math.random() - .5) * 3, ay: (Math.random() - .5) * 3,
      heading: Math.random() * TAU, headingShift: Math.random() * 1.5,
      speed: Math.random() * 14, peakSpeed: Math.random() * 16,
      stability: Math.random(), lastTick: 4, path: null, pathTick: -1
    };
    const pos = { x: (Math.random() - .5) * 500, y: (Math.random() - .5) * 500 };
    const entity = { id: 7, pos: { current: pos } };
    const m = new TargetMotion();
    m.tracks.set(7, track);
    for (let n = 0; n <= 6; n++) {
      const got = m.predict(entity, n), want = refPredict(track, pos, n);
      worstPos = Math.max(worstPos, Math.abs(got.x - want.x), Math.abs(got.y - want.y));
      worstConf = Math.max(worstConf, Math.abs(got.confidence - want.confidence));
      checks++;
    }
  }
  ok("cached path matches the original integration exactly", worstPos === 0 && worstConf === 0,
     "worst position delta=" + worstPos + ", confidence delta=" + worstConf + " over " + checks + " checks");
}

// intercept() must agree with scanning predict() one tick at a time, which is
// what it used to do.
{
  let mismatches = 0, hits = 0, checks = 0;
  for (let t = 0; t < 3000; t++) {
    const m = new TargetMotion();
    const entity = { id: 3, pos: { current: { x: 0, y: 0 } } };
    for (let tick = 1; tick <= 5; tick++) {
      entity.pos.current.x += 4 + Math.random() * 3;
      entity.pos.current.y += 2 + Math.random() * 3;
      m.observe(entity, tick);
    }
    const cx = entity.pos.current.x + (Math.random() - .3) * 90;
    const cy = entity.pos.current.y + (Math.random() - .3) * 90;
    const r = 40 + Math.random() * 50;
    const got = m.intercept(entity, cx, cy, r, 6);
    let want = null;
    for (let n = 0; n <= 6 && !want; n++) {
      const p = m.predict(entity, n);
      if (Math.hypot(p.x - cx, p.y - cy) < r) want = { tick: n, x: p.x, y: p.y };
    }
    checks++;
    if (got) hits++;
    if ((got === null) !== (want === null)) mismatches++;
    else if (got && got.tick !== want.tick) mismatches++;
  }
  ok("intercept agrees with a tick-by-tick predict scan", mismatches === 0,
     "mismatches=" + mismatches + " of " + checks);
  ok("interceptions actually occurred in the sample", hits > 100, "hits=" + hits);
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
