#!/usr/bin/env node
// Before/after comparison of the placement angle solver.
//
// Runs the real AngleSolver out of two builds of the client over identical
// randomly generated worlds and reports what each one actually proposes.
//
//   usage: node tools/bench-placement.js <before.js> <after.js>
//
// Both files are loaded the same way verify-placement.js loads one, so the
// numbers describe the shipped code rather than a model of it.

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const drivers = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers", "game-drivers.json"), "utf8"));
const hyp = (a, b) => Math.sqrt(a * a + b * b);
const TAU = Math.PI * 2;

function load(file) {
  const src = fs.readFileSync(file, "utf8");
  const block = (startRe, endMarker) => {
    const m = src.match(startRe);
    if (!m) throw new Error(file + ": not found " + startRe);
    const i = src.indexOf(endMarker, m.index);
    if (i < 0) throw new Error(file + ": end not found " + endMarker);
    return src.slice(m.index, i);
  };
  const consts = [...src.matchAll(/^\s*const (RPE_[A-Z_]+) = ([^;\n{[]+);$/gm)]
    .filter(m => !/Settings_default|client/.test(m[2]))
    .map(m => `const ${m[1]} = ${m[2]};`).join("\n");
  const helpers = [...src.matchAll(/^\s*const (rpe[A-Za-z]+) = ([^;\n]*=>[^;\n]+);$/gm)]
    .map(m => `const ${m[1]} = ${m[2]};`).join("\n");
  const fixToSrc = src.match(/^\s*const fixTo = [^;]+;$/m)[0];
  const wireSrc = block(/^\s{2}const wireAngle = angle => \{/m, "\n  };\n  const findMiddleAngle");
  const body = `
${consts}
${fixToSrc}
${wireSrc}
};
${helpers}
const LUNA_ANGLE_RESOLUTIONS = [36, 72, 144, 200];
const LUNA_ANGLE_STEPS_DEFAULT = 200;
${block(/^\s{2}const GeometrySolver = \{/m, "\n  };\n\n  // ── Ring scan")}
};
${block(/^\s{2}const RingScan = \{/m, "\n  };\n\n  // ── Reservation ledger")}
};
${block(/^\s{2}class PlacementMemory \{/m, "\n  }\n\n  // ── Build profiles")}
}
${block(/^\s{2}class AngleSolver \{/m, "\n  }\n\n  // ── Scoring")}
}
return { GeometrySolver, RingScan, PlacementMemory, AngleSolver, wireAngle };
`;
  return new Function("Settings_default", "Config_default", "hyp", body)(
    { _autoplacerResolution: 200 }, drivers.config, hyp);
}

const beforeFile = process.argv[2];
const afterFile = process.argv[3];
if (!beforeFile || !afterFile) {
  console.error("usage: node tools/bench-placement.js <before.js> <after.js>");
  process.exit(2);
}
const A = load(beforeFile), B = load(afterFile);

const PROFILES = [
  { name: "spikes", type: 4, id: 6, footR: 49, ringR: 79, riverLegal: false },
  { name: "trap", type: 7, id: 15, footR: 50, ringR: 80, riverLegal: false },
];

// Deterministic worlds, identical for both builds.
function worlds(n) {
  let seed = 20240917;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [];
  for (let i = 0; i < n; i++) {
    const count = Math.floor(rnd() * 7);
    const blockers = [];
    for (let j = 0; j < count; j++) {
      const ang = rnd() * TAU, d = 25 + rnd() * 190;
      blockers.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d, r: [49, 50, 52, 45, 43][Math.floor(rnd() * 5)] });
    }
    const tAng = rnd() * TAU, tD = 90 + rnd() * 230;
    const tx = Math.cos(tAng) * tD, ty = Math.sin(tAng) * tD;
    const vAng = rnd() * TAU, vSp = rnd() * 26;
    out.push({
      blockers,
      targetPos: { x: tx, y: ty },
      targetNext: { x: tx + Math.cos(vAng) * vSp, y: ty + Math.sin(vAng) * vSp },
    });
  }
  return out;
}

function apertures(M, profile, blockers) {
  const blocked = [];
  for (const b of blockers) {
    const arc = M.GeometrySolver.occlusion(0, 0, profile.ringR, profile.footR, b.x, b.y, b.r);
    if (arc) blocked.push(arc);
  }
  return M.GeometrySolver.invert(M.GeometrySolver.merge(blocked));
}

function run(M, profile, world, steps) {
  const aps = apertures(M, profile, world.blockers);
  if (!aps.length) return null;
  const solver = new M.AngleSolver();
  const memory = new M.PlacementMemory();
  const frame = {
    myPos: { x: 0, y: 0 },
    targetPos: world.targetPos, targetNext: world.targetNext,
    targetScale: 35, ringSteps: steps,
    targetTrapped: null, exits: null, kb: null,
  };
  // `memory` is a no-op for the newer signature and required by the older one.
  const out = solver.propose(profile, aps, frame, memory);
  return { aps, out };
}

// worst distance from any legal angle to the nearest candidate
function worstGap(M, out, aps) {
  const N = 4000;
  let worst = 0, any = false;
  for (let i = 0; i < N; i++) {
    const a = i * TAU / N;
    if (!M.GeometrySolver.inAperture(aps, a)) continue;
    any = true;
    let best = Infinity;
    for (const c of out) { const d = M.GeometrySolver.angleDist(a, c.angle); if (d < best) best = d; }
    if (best > worst) worst = best;
  }
  return any ? worst : null;
}

// how far the best candidate lands from the ideal aim direction, in units
function aimError(M, out, aps, profile, world) {
  const aim = Math.atan2(world.targetNext.y, world.targetNext.x);
  const ideal = M.GeometrySolver.nearestFree(aps, aim, 0.01);
  if (ideal === null) return null;
  let best = Infinity;
  for (const c of out) {
    const d = M.GeometrySolver.angleDist(c.angle, ideal);
    if (d < best) best = d;
  }
  return 2 * profile.ringR * Math.sin(best / 2);
}

// does the angle survive its own encoder?
function illegalAfterWire(M, out, aps) {
  let bad = 0;
  for (const c of out) {
    const w = M.wireAngle(c.angle);
    if (w === null) { bad++; continue; }
    if (!M.GeometrySolver.inAperture(aps, M.GeometrySolver.norm(w))) bad++;
  }
  return bad;
}

const W = worlds(1500);
const pad = (s, n) => String(s).padStart(n);

for (const steps of [36, 72, 144, 200]) {
  console.log("\n================  ring steps = " + steps + "  ================");
  console.log("profile  build   cands/world  unique-wire  worstGap  aimErr(p50)  aimErr(p95)  illegal  slivers");
  for (const profile of PROFILES) {
    for (const [label, M] of [["before", A], ["after", B]]) {
      let nCand = 0, nUniq = 0, nWorlds = 0, illegal = 0, slivers = 0;
      let gapSum = 0, gapN = 0;
      const aimErrs = [];
      for (const w of W) {
        const r = run(M, profile, w, steps);
        if (!r) continue;
        nWorlds++;
        nCand += r.out.length;
        nUniq += new Set(r.out.map(c => Math.round(M.GeometrySolver.norm(c.angle) * 100))).size;
        illegal += illegalAfterWire(M, r.out, r.aps);
        // A world whose only free ground is narrower than the wire can address
        // holds no sendable angle at all. Counted rather than averaged in: it is
        // not a coverage failure, it is legal ground that cannot be built on,
        // and proposing for it is how the older build spent packets on refusals.
        if (r.out.length === 0) { slivers++; continue; }
        const g = worstGap(M, r.out, r.aps);
        if (g !== null && isFinite(g)) { gapSum += g; gapN++; }
        const e = aimError(M, r.out, r.aps, profile, w);
        if (e !== null && isFinite(e)) aimErrs.push(e);
      }
      aimErrs.sort((x, y) => x - y);
      const p = q => aimErrs.length ? aimErrs[Math.min(aimErrs.length - 1, Math.floor(aimErrs.length * q))] : NaN;
      console.log(
        profile.name.padEnd(8) +
        label.padEnd(8) +
        pad((nCand / nWorlds).toFixed(1), 11) +
        pad((nUniq / nWorlds).toFixed(1), 13) +
        pad((gapN ? (gapSum / gapN) * 180 / Math.PI : NaN).toFixed(1) + "d", 10) +
        pad(p(0.5).toFixed(2) + "u", 13) +
        pad(p(0.95).toFixed(2) + "u", 13) +
        pad(illegal, 9) +
        pad(slivers, 9));
    }
  }
}

console.log("\n================  cost  ================");
for (const [label, M] of [["before", A], ["after", B]]) {
  const profile = PROFILES[0];
  const solver = new M.AngleSolver();
  const memory = new M.PlacementMemory();
  const prepared = W.slice(0, 400).map(w => ({ aps: apertures(M, profile, w.blockers), w }))
    .filter(x => x.aps.length);
  const frameFor = x => ({
    myPos: { x: 0, y: 0 }, targetPos: x.w.targetPos, targetNext: x.w.targetNext,
    targetScale: 35, ringSteps: 200, targetTrapped: null, exits: null, kb: null,
  });
  for (let i = 0; i < 200; i++) for (const x of prepared) solver.propose(profile, x.aps, frameFor(x), memory);
  const t0 = process.hrtime.bigint();
  const R = 200;
  for (let i = 0; i < R; i++) for (const x of prepared) solver.propose(profile, x.aps, frameFor(x), memory);
  const t1 = process.hrtime.bigint();
  const per = Number(t1 - t0) / 1000 / (R * prepared.length);
  console.log(label.padEnd(8) + pad(per.toFixed(2), 7) + " us/call    " +
    pad((per * 18 / 1000).toFixed(3), 7) + " ms per second of play (2 items, 9 ticks/s)");
}
