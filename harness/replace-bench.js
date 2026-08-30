/* Is the graded replace better than putting the broken building back?
 *
 * "Grades every spot against every enemy and takes the best four" sounds better
 * than "puts one back where it stood", and sounding better is not evidence. Both
 * are geometry, so both can be run over the same scenes and counted.
 *
 * Three things are measured, because more placements is not by itself a win:
 *
 *   placements    how many actually go down under the ring's own separation rule
 *   shut out      can an enemy body still reach you, by flood fill
 *   spots denied  how many of the enemy's own placement positions are taken
 *
 * The last one is what Revelation's scoring is really for: a spike sitting where
 * they wanted to build is worth more than the same spike in open ground, and
 * neither of the first two columns can see that.
 *
 *   node replace-bench.js [client.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CLIENT = process.argv[2] || path.resolve(__dirname, "../xprecision/X_Precision_2.0.user.js");
const src = fs.readFileSync(CLIENT, "utf8");

function lift(name) {
  const m = new RegExp("function\\s+" + name + "\\s*\\(").exec(src);
  if (!m) throw new Error("could not find " + name + " in " + path.basename(CLIENT));
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index, i + 1); }
  }
  throw new Error("unbalanced " + name);
}

/* greater spikes and pit trap, from the game's own table */
const SPIKE = { scale: 52, placeOffset: -5, id: 9 };
const TRAP = { scale: 45, placeOffset: 0, id: 15 };
const PLAYER = 35;
const ring = (it) => PLAYER + it.scale + (it.placeOffset || 0);
const SEP = SPIKE.scale * 2;

const sandbox = {
  Math,
  UTILS: { getDistance: (a, b, c, d) => Math.hypot(c - a, d - b) },
  items: { list: { [SPIKE.id]: SPIKE, [TRAP.id]: TRAP } },
  imTrapped: false,
  spikes_our: [],
};
vm.createContext(sandbox);
vm.runInContext(lift("gradeReplaceSpot") + "\nthis.grade = gradeReplaceSpot;", sandbox);
const grade = sandbox.grade;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function free(x, y, s, objects) {
  for (const o of objects) if (Math.hypot(x - o.x, y - o.y) < s + o.scale) return false;
  return true;
}

/* A scene: the building that just died, a few standing ones, and enemies. */
function makeScene(rand) {
  const objects = [];
  const n = Math.floor(rand() * 5);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = 80 + rand() * 150;
    objects.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 25 + rand() * 30 });
  }
  const enemies = [];
  const en = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < en; i++) {
    const a = rand() * Math.PI * 2, d = 90 + rand() * 180;
    enemies.push({ x2: Math.cos(a) * d, y2: Math.sin(a) * d, items: [0, 0, SPIKE.id] });
  }
  const ga = rand() * Math.PI * 2;
  const gone = { angle: ga, x: Math.cos(ga) * ring(SPIKE), y: Math.sin(ga) * ring(SPIKE), scale: SPIKE.scale, id: SPIKE.id };
  return { objects, enemies, gone };
}

const CELL = 4, HALF = 340, DIM = Math.floor((HALF * 2) / CELL);
function enemyReachesMe(objects, placed) {
  const blockers = objects.map((o) => ({ x: o.x, y: o.y, r: o.scale + PLAYER }))
    .concat(placed.map((p) => ({ x: p.x, y: p.y, r: p.scale + PLAYER })));
  const open = new Uint8Array(DIM * DIM);
  for (let iy = 0; iy < DIM; iy++) {
    const y = -HALF + iy * CELL + CELL / 2;
    for (let ix = 0; ix < DIM; ix++) {
      const x = -HALF + ix * CELL + CELL / 2;
      let ok = 1;
      for (const b of blockers) { const dx = x - b.x, dy = y - b.y; if (dx * dx + dy * dy < b.r * b.r) { ok = 0; break; } }
      open[iy * DIM + ix] = ok;
    }
  }
  const seen = new Uint8Array(DIM * DIM), stack = [];
  for (let i = 0; i < DIM; i++) for (const idx of [i, (DIM - 1) * DIM + i, i * DIM, i * DIM + DIM - 1])
    if (open[idx] && !seen[idx]) { seen[idx] = 1; stack.push(idx); }
  while (stack.length) {
    const idx = stack.pop(), ix = idx % DIM, iy = (idx - ix) / DIM;
    const x = -HALF + ix * CELL + CELL / 2, y = -HALF + iy * CELL + CELL / 2;
    if (x * x + y * y < (PLAYER * 2) ** 2) return true;
    for (const j of [ix > 0 ? idx - 1 : -1, ix < DIM - 1 ? idx + 1 : -1, iy > 0 ? idx - DIM : -1, iy < DIM - 1 ? idx + DIM : -1])
      if (j >= 0 && open[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
  }
  return false;
}

/* How many spots on the enemies' own placement rings are taken by what I put
 * down — the thing the scoring is for, and the thing neither other column sees. */
function spotsDenied(enemies, placed) {
  let denied = 0;
  for (const e of enemies) {
    const r = ring(SPIKE);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const x = e.x2 + Math.cos(a) * r, y = e.y2 + Math.sin(a) * r;
      if (placed.some((p) => Math.hypot(x - p.x, y - p.y) < p.scale + SPIKE.scale)) denied++;
    }
  }
  return denied;
}

const at = (a, it) => ({ x: Math.cos(a) * ring(it), y: Math.sin(a) * ring(it), scale: it.scale, angle: a });
function accept(chosen, spot) {
  for (const c of chosen) if (Math.hypot(spot.x - c.x, spot.y - c.y) < SEP) return false;
  chosen.push(spot);
  return true;
}

/* What it used to do: put the same item back where it stood. */
function putBack(scene) {
  const chosen = [];
  const p = at(scene.gone.angle, SPIKE);
  if (free(p.x, p.y, SPIKE.scale, scene.objects)) accept(chosen, p);
  return chosen;
}

/* What it does now: grade every spot, take the best four, traps winning ties. */
function graded(scene) {
  sandbox.spikes_our = scene.objects.filter((_, i) => i % 2 === 0);
  const cands = [];
  for (const it of [SPIKE, TRAP]) {
    for (let i = 0; i < 144; i++) {
      const a = (i / 144) * Math.PI * 2;
      const p = at(a, it);
      if (!free(p.x, p.y, it.scale, scene.objects)) continue;
      const g = grade(p, scene.enemies, it);
      if (g.points <= 0) continue;
      cands.push({ p, points: g.points, priority: g.priority, isTrap: it === TRAP });
    }
  }
  cands.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return (b.isTrap ? 1 : 0) - (a.isTrap ? 1 : 0);
  });
  const chosen = [];
  for (const c of cands) { if (chosen.length >= 4) break; accept(chosen, c.p); }
  return chosen;
}

const SCENES = 500;
const rand = mulberry32(Number(process.env.SEED || 20260830));
const scenes = [];
for (let i = 0; i < SCENES; i++) scenes.push(makeScene(rand));

const rows = [];
for (const [label, pick] of [["put it back (was)", putBack], ["graded, best four", graded]]) {
  let placed = 0, sealed = 0, denied = 0, none = 0;
  for (const sc of scenes) {
    const out = pick(sc);
    placed += out.length;
    if (!out.length) none++;
    if (!enemyReachesMe(sc.objects, out)) sealed++;
    denied += spotsDenied(sc.enemies, out);
  }
  rows.push({ label, placed: placed / SCENES, sealed, denied: denied / SCENES, none });
}

const pad = (s, n) => String(s).padEnd(n);
const pct = (a) => (100 * a / SCENES).toFixed(1) + "%";
console.log(path.basename(CLIENT) + " — replacing what the enemy broke\n");
console.log("  " + pad("policy", 22) + pad("placements", 13) + pad("placed nothing", 16) +
  pad("enemy shut out", 17) + "enemy spots denied");
console.log("  " + "-".repeat(84));
for (const r of rows) {
  console.log("  " + pad(r.label, 22) + pad(r.placed.toFixed(2), 13) + pad(pct(r.none), 16) +
    pad(r.sealed + " (" + pct(r.sealed) + ")", 17) + r.denied.toFixed(1));
}
console.log("\n  " + SCENES + " scenes, seed " + (process.env.SEED || 20260830) +
  " — set SEED to change them");
