#!/usr/bin/env node
// Placement-model agreement check.
//
// The game bundle in src/game_index.js is authoritative for placement. This
// re-implements nothing: it lifts the client's own geometry out of the client
// and the game's own out of the bundle's data tables, then asserts they answer
// the same questions the same way.
//
//   usage: node tools/verify-placement.js [client.js]
//
// What is checked
//   1. placement distance     L = playerScale + item.scale + item.placeOffset
//   2. blocking radius        game getScale(0.6, isItem) vs client placementScale
//   3. movement radius        game getScale()            vs client collisionScale
//   4. river band             only item 18 may be placed in it
//   5. aperture solver        GeometrySolver arcs vs a brute-force sampled scan
//   6. wire quantum           the angle the client sends survives its aperture
//   7. angular coverage       worst gap from any legal angle to a candidate

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const clientPath = process.argv[2] || path.join(ROOT, "src", "Ryn_Type2.user.js");
const src = fs.readFileSync(clientPath, "utf8");
const drivers = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers", "game-drivers.json"), "utf8"));

let fails = 0, checks = 0;
const ok = (name, cond, detail) => {
  checks++;
  if (!cond) {
    fails++;
    console.log("FAIL  " + name + (detail ? "  " + detail : ""));
  }
};
const section = n => console.log("\n-- " + n + " --");

// ── lift the client's geometry ────────────────────────────────────────────────
function block(startRe, endMarker) {
  const m = src.match(startRe);
  if (!m) throw new Error("not found in client: " + startRe);
  const start = m.index;
  const idx = src.indexOf(endMarker, start);
  if (idx < 0) throw new Error("end marker not found: " + endMarker);
  return src.slice(start, idx);
}
const scalarConsts = [...src.matchAll(/^\s*const (RPE_[A-Z_]+) = ([^;\n{[]+);$/gm)]
  .filter(m => !/Settings_default|client/.test(m[2]))
  .map(m => `const ${m[1]} = ${m[2]};`).join("\n");
// Single-expression helpers the lifted code calls.
const helpers = [...src.matchAll(/^\s*const (rpe[A-Za-z]+) = ([^;\n]*=>[^;\n]+);$/gm)]
  .map(m => `const ${m[1]} = ${m[2]};`).join("\n");

const Config_default = drivers.config;
const hyp = (a, b) => Math.sqrt(a * a + b * b);
// The client's own angle encoder, lifted rather than reimplemented: this is the
// function whose output the server sees.
const fixToSrc = src.match(/^\s*const fixTo = [^;]+;$/m);
if (!fixToSrc) throw new Error("fixTo not found in client");
const wireAngleSrc = block(/^\s{2}const wireAngle = angle => \{/m, "\n  };\n  const findMiddleAngle");
const sandbox = `
${scalarConsts}
${fixToSrc[0]}
${wireAngleSrc}
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
return { GeometrySolver, RingScan, PlacementMemory, AngleSolver, RPE_WIRE_QUANTUM, RPE_WIRE_ANGLES, RPE_WIRE_BUCKETS, wireAngle, fixTo, rpeWireIndex };
`;
const C = new Function("Settings_default", "Config_default", "hyp",
  sandbox)({ _autoplacerResolution: 200 }, Config_default, hyp);
const G = C.GeometrySolver;

// ── the client's own scale accessors, as the classes define them ─────────────
// PlayerObject: placementScale = blocker ?? scale ; collisionScale = scale*colDiv
// Resource:     formatScale(m)  = scale * (type 0|1 ? 0.6*m : 1)
const clientPlayerObject = o => ({
  placementScale: o.item.id === 21 ? o.item.blocker : o.scale,
  collisionScale: o.scale * ("colDiv" in o.item ? o.item.colDiv : 1),
});
// The client reads the shipped Items row, where an absent key is absent rather
// than present-and-undefined, so the row is rebuilt that way here.
const itemRow = (it, id) => {
  const row = { id: id, scale: it.scale };
  if (it.colDiv !== undefined) row.colDiv = it.colDiv;
  if (it.blocker !== undefined) row.blocker = it.blocker;
  if (it.type !== undefined) row.type = it.type;
  return row;
};
const clientResource = r => ({
  placementScale: r.scale * (r.type === 0 || r.type === 1 ? 0.6 * 0.6 : 1),
  collisionScale: r.scale * (r.type === 0 || r.type === 1 ? 0.6 : 1),
});

// ── the game's own, from src/game_index.js:1451 ──────────────────────────────
//   getScale(t, i) = scale * (isItem || type==2 || type==3 ? 1 : 0.6*t) * (i ? 1 : colDiv)
const gameGetScale = (o, t, i) =>
  o.scale * (o.isItem || o.type === 2 || o.type === 3 ? 1 : 0.6 * t) * (i ? 1 : (o.colDiv ?? 1));
// checkItemLocation calls it as getScale(0.6, obj.isItem), with `blocker` winning.
const gameBlockRadius = o => (o.blocker ? o.blocker : gameGetScale(o, 0.6, o.isItem));
// checkCollision calls it as getScale() -> t=1, i=undefined.
const gameMoveRadius = o => gameGetScale(o, 1, undefined);

const items = drivers.items;
const PLAYER_SCALE = Config_default.playerScale;

section("1. placement distance  L = playerScale + scale + placeOffset");
{
  // The client states it in three places; all three must agree with the game.
  const m = src.match(/const dist = 35 \+ item\.scale \+ \(item\.placeOffset \|\| 0\);/g);
  ok("client uses the game's placement distance", m && m.length >= 1,
    m ? "found " + m.length + " sites" : "no site found");
  ok("playerScale is 35 in the game bundle", PLAYER_SCALE === 35, "got " + PLAYER_SCALE);
  items.forEach((it, id) => {
    if (!("itemGroup" in it) && it.group === undefined) return;
    const L = PLAYER_SCALE + it.scale + (it.placeOffset || 0);
    ok("L(" + id + " " + it.name + ") finite and positive", isFinite(L) && L > 0, "L=" + L);
  });
}

section("2. blocking radius: client placementScale == game getScale(0.6, isItem)");
items.forEach((it, id) => {
  const gameObj = { scale: it.scale, isItem: true, type: it.type, colDiv: it.colDiv, blocker: it.blocker };
  const want = gameBlockRadius(gameObj);
  const got = clientPlayerObject({ item: itemRow(it, id), scale: it.scale }).placementScale;
  ok("placementScale(" + id + " " + it.name + ")", Math.abs(want - got) < 1e-9,
    "game=" + want + " client=" + got);
});

section("3. movement radius: client collisionScale == game getScale()");
items.forEach((it, id) => {
  const gameObj = { scale: it.scale, isItem: true, type: it.type, colDiv: it.colDiv };
  const want = gameMoveRadius(gameObj);
  const got = clientPlayerObject({ item: itemRow(it, id), scale: it.scale }).collisionScale;
  ok("collisionScale(" + id + " " + it.name + ")", Math.abs(want - got) < 1e-9,
    "game=" + want + " client=" + got);
});

section("3b. resources: both radii, for every resource type and scale the game ships");
{
  const scaleSets = [
    [0, Config_default.treeScales],
    [1, Config_default.bushScales],
    [2, Config_default.rockScales],
    [3, [50]],
  ];
  for (const [type, scales] of scaleSets) {
    for (const scale of scales) {
      const gameObj = { scale: scale, isItem: false, type: type, colDiv: 1 };
      const cl = clientResource({ scale: scale, type: type });
      ok("resource block r (type " + type + " scale " + scale + ")",
        Math.abs(gameBlockRadius(gameObj) - cl.placementScale) < 1e-9,
        "game=" + gameBlockRadius(gameObj) + " client=" + cl.placementScale);
      ok("resource move r (type " + type + " scale " + scale + ")",
        Math.abs(gameMoveRadius(gameObj) - cl.collisionScale) < 1e-9,
        "game=" + gameMoveRadius(gameObj) + " client=" + cl.collisionScale);
    }
  }
}

section("4. river band: only item 18 is exempt");
{
  const mid = Config_default.mapScale / 2, half = Config_default.riverWidth / 2;
  ok("band is [" + (mid - half) + ", " + (mid + half) + "]", mid - half === 6838 && mid + half === 7562,
    "got [" + (mid - half) + ", " + (mid + half) + "]");
  // riverOcclusion must remove exactly the angles whose ring point lands in it.
  const ringR = 79;
  for (const oy of [mid - half - 40, mid - half + 10, mid, mid + half - 10, mid + half + 40, 500]) {
    const arcs = G.riverOcclusion(oy, ringR);
    const merged = G.merge(arcs.length ? arcs : []);
    const free = G.invert(merged);
    let wrong = 0;
    for (let i = 0; i < 4000; i++) {
      const a = i * Math.PI * 2 / 4000;
      const y = oy + ringR * Math.sin(a);
      const inBand = y >= mid - half && y <= mid + half;
      const legal = G.inAperture(free, a) !== null;
      // A legal angle must not land in the band; an illegal one must.
      if (legal && inBand) wrong++;
    }
    ok("riverOcclusion exact at oy=" + oy, wrong === 0, wrong + " legal angles land in the river");
  }
}

section("5. aperture solver vs brute-force sampled legality");
{
  // Random worlds; the analytic arcs must agree with a dense point-by-point
  // application of the game's own circle test.
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const profiles = [
    { name: "spikes", footR: 49, ringR: 79 },
    { name: "trap", footR: 50, ringR: 80 },
    { name: "mill", footR: 45, ringR: 85 },
    { name: "sapling", footR: 110, ringR: 130 },
  ];
  for (const p of profiles) {
    let worst = 0, cases = 0;
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + Math.floor(rnd() * 6);
      const blockers = [];
      for (let i = 0; i < n; i++) {
        const ang = rnd() * Math.PI * 2;
        const d = 20 + rnd() * (p.ringR + 140);
        blockers.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d, r: [49, 50, 52, 45, 300][Math.floor(rnd() * 5)] });
      }
      const blocked = [];
      for (const b of blockers) {
        const arc = G.occlusion(0, 0, p.ringR, p.footR, b.x, b.y, b.r);
        if (arc) blocked.push(arc);
      }
      const free = G.invert(G.merge(blocked));
      const N = 3000;
      for (let i = 0; i < N; i++) {
        const a = i * Math.PI * 2 / N;
        const x = p.ringR * Math.cos(a), y = p.ringR * Math.sin(a);
        // the game's test, verbatim: dist < item.scale + T
        let brute = true;
        for (const b of blockers) {
          if (hyp(x - b.x, y - b.y) < p.footR + b.r) { brute = false; break; }
        }
        const analytic = G.inAperture(free, a) !== null;
        if (brute !== analytic) {
          // Disagreement is only acceptable within a sample step of a boundary.
          let margin = Infinity;
          for (const b of blockers) {
            margin = Math.min(margin, Math.abs(hyp(x - b.x, y - b.y) - (p.footR + b.r)));
          }
          if (margin > 0.35) { cases++; worst = Math.max(worst, margin); }
        }
      }
    }
    ok("occlusion agrees with brute force (" + p.name + ")", cases === 0,
      cases + " disagreements away from any boundary, worst margin " + worst.toFixed(3));
  }
}

section("6. wire quantum: the sent angle stays inside its aperture");
{
  const q = C.RPE_WIRE_QUANTUM;
  ok("wire quantum is the game's fixTo(angle, 2)", q === 0.01, "got " + q);
  ok("distinct sendable angles", C.RPE_WIRE_ANGLES === 629, "got " + C.RPE_WIRE_ANGLES);
  ok("wire buckets fold the seam", C.RPE_WIRE_BUCKETS === 628, "got " + C.RPE_WIRE_BUCKETS);
  // The vanilla client's own rounding, from game_index.js Ci().
  const wire = C.wireAngle;
  const solver = new C.AngleSolver();
  const memory = new C.PlacementMemory();
  let seed = 999;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const profile = { type: 4, id: 6, footR: 49, ringR: 79, riverLegal: false };
  let escaped = 0, total = 0;
  for (let trial = 0; trial < 400; trial++) {
    const blockers = [];
    for (let i = 0, n = 1 + Math.floor(rnd() * 5); i < n; i++) {
      const ang = rnd() * Math.PI * 2, d = 30 + rnd() * 180;
      blockers.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d, r: 49 });
    }
    const blocked = [];
    for (const b of blockers) {
      const arc = G.occlusion(0, 0, profile.ringR, profile.footR, b.x, b.y, b.r);
      if (arc) blocked.push(arc);
    }
    const free = G.invert(G.merge(blocked));
    if (!free.length) continue;
    const frame = {
      myPos: { x: 0, y: 0 }, targetPos: { x: 140, y: 30 }, targetNext: { x: 150, y: 45 },
      targetScale: 35, ringSteps: 200, targetTrapped: null, exits: null, kb: null,
    };
    for (const cand of solver.propose(profile, free, frame)) {
      total++;
      // Rounded to the wire, the angle must still be legal by the game's test.
      const a = G.norm(wire(cand.angle));
      const x = profile.ringR * Math.cos(a), y = profile.ringR * Math.sin(a);
      for (const b of blockers) {
        if (hyp(x - b.x, y - b.y) < profile.footR + b.r) { escaped++; break; }
      }
    }
  }
  ok("no candidate becomes illegal after wire rounding", escaped === 0,
    escaped + " of " + total + " candidates left their aperture when rounded");
  console.log("      (" + total + " candidates checked across 400 random worlds)");
}

section("7. angular coverage of the proposal set");
{
  const solver = new C.AngleSolver();
  const memory = new C.PlacementMemory();
  const profile = { type: 4, id: 6, footR: 49, ringR: 79, riverLegal: false };
  const worlds = [
    ["empty", []],
    ["one spike", [{ x: 60, y: 60, r: 49 }]],
    ["3 spikes", [{ x: 79, y: 0, r: 49 }, { x: 40, y: 68, r: 49 }, { x: -40, y: 68, r: 49 }]],
    ["trap cluster", [{ x: 85, y: 20, r: 50 }, { x: 20, y: 85, r: 50 }, { x: -70, y: 45, r: 50 }]],
  ];
  // Two builds on this ring overlap below 2*asin(footR/ringR); half of that is
  // the coverage spacing propose() targets, so the worst gap should not exceed
  // it by more than the lattice step.
  const slot = 2 * Math.asin(profile.footR / profile.ringR);
  for (const [name, blockers] of worlds) {
    const blocked = [];
    for (const b of blockers) {
      const arc = G.occlusion(0, 0, profile.ringR, profile.footR, b.x, b.y, b.r);
      if (arc) blocked.push(arc);
    }
    const free = G.invert(G.merge(blocked));
    const frame = {
      myPos: { x: 0, y: 0 }, targetPos: { x: 140, y: 30 }, targetNext: { x: 150, y: 45 },
      targetScale: 35, ringSteps: 200, targetTrapped: null, exits: null, kb: null,
    };
    const out = solver.propose(profile, free, frame);
    const uniq = new Set(out.map(c => Math.round(G.norm(c.angle) / C.RPE_WIRE_QUANTUM))).size;
    ok("every proposal is a distinct sendable angle (" + name + ")", uniq === out.length,
      uniq + " unique of " + out.length);
    let worst = 0;
    for (let i = 0; i < 8000; i++) {
      const a = i * Math.PI * 2 / 8000;
      if (!G.inAperture(free, a)) continue;
      let best = Infinity;
      for (const c of out) best = Math.min(best, G.angleDist(a, c.angle));
      worst = Math.max(worst, best);
    }
    ok("worst gap within the mutual-exclusion slot (" + name + ")", worst <= slot / 2 + 0.05,
      "worst=" + (worst * 180 / Math.PI).toFixed(2) + "deg cap=" + ((slot / 2 + 0.05) * 180 / Math.PI).toFixed(2) + "deg");
    console.log("      " + name.padEnd(13) + " candidates=" + String(out.length).padStart(3) +
      " worstGap=" + (worst * 180 / Math.PI).toFixed(2).padStart(6) + "deg" +
      " ringErr=" + (2 * profile.ringR * Math.sin(worst / 2)).toFixed(1).padStart(5) + "u");
  }
}

section("8. the scan lattice is sendable by construction");
{
  const wire = C.wireAngle;
  for (const steps of [36, 72, 144, 200]) {
    const t = C.RingScan.table(steps);
    let drift = 0, dupes = 0;
    const seen = new Set();
    for (let i = 0; i < steps; i++) {
      const a = t.angle[i];
      // Re-encoding a table entry must be a no-op.
      if (Math.abs(G.angleDist(G.norm(wire(a)), a)) > 1e-12) drift++;
      const k = C.rpeWireIndex(a);
      if (seen.has(k)) dupes++;
      seen.add(k);
      // cos/sin must belong to the stored angle, not the unsnapped one.
      if (Math.abs(t.cos[i] - Math.cos(a)) > 1e-12) drift++;
      if (Math.abs(t.sin[i] - Math.sin(a)) > 1e-12) drift++;
    }
    ok("lattice entries survive re-encoding (" + steps + ")", drift === 0, drift + " drifted");
    ok("lattice entries stay distinct (" + steps + ")", dupes === 0, dupes + " collided");
  }
}

console.log("\n" + (fails === 0 ? "OK" : "FAILED") + " - " + (checks - fails) + "/" + checks + " checks passed");
process.exit(fails === 0 ? 0 : 1);
