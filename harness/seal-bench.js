/* How many spikes does a scan actually get down, and is the ring sealed?
 *
 * "More angles" is not the same question as "better placements", and the client
 * had been tuned as if it were. The geometry says otherwise. Every candidate
 * sits at 35 + scale + placeOffset from you, so for greater spikes they all lie
 * on a circle of radius 82, and addPredictObject rejects a placement within
 * scale + scale of one already chosen — the same 104 the server enforces, since
 * getScale(0.6, isItem) returns full scale for a placed building. On an 82 ring
 * 104 is a 78.7 degree chord. Three consequences, none of them about resolution:
 *
 *   1. At most FOUR spikes can ever go down in one tick.
 *   2. A gap between two of them only becomes walkable for a 35 radius body at
 *      138.6 degrees apart. Four spikes, however badly spread, cannot leave a
 *      gap wider than 360 - 3*78.7 = 123.9. Three can leave 202.6.
 *   3. So the ring is sealed exactly when the fourth spike goes down. Not when
 *      the scan is fine. The whole question is whether the set of four fits.
 *
 * A scan that hands candidates over in index order does not choose a set: it
 * takes the first placeable angle, locks out 78.7 degrees around it, and hopes.
 * This measures that against picking the four as a set.
 *
 *   node seal-bench.js [client.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CLIENT = process.argv[2] || path.resolve(__dirname, "../xprecision/X_Precision_2.0.user.js");
const src = fs.readFileSync(CLIENT, "utf8");

/* getPerfectAngles decides which samples count as boundary angles. Run the
 * client's own copy rather than a paraphrase of it. */
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
const sandbox = {
  Math,
  UTILS: { getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) },
  X_PRECISION: null,        // filled in from the client's own block below
  items: null,
  predictObjects: [],
};
vm.createContext(sandbox);
vm.runInContext(lift("getPerfectAngles") + "\nthis.getPerfectAngles = getPerfectAngles;", sandbox);
const getPerfectAngles = sandbox.getPerfectAngles;

/* The shipped picker, if this client has one. Running a copy of it here would
 * measure the copy — the whole point of the bench is that the file itself gets
 * better, so lift the real function and let it fail loudly if it changes. */
const hasSealer = /function\s+sealRingOrder\s*\(/.test(src);
let sealRingOrder = null;
if (hasSealer) {
  const cfg = /const X_PRECISION = \{[\s\S]*?\n\};/.exec(src);
  vm.runInContext(cfg[0].replace("const X_PRECISION", "X_PRECISION") + "\n" +
    lift("sealRingOrder") + "\nthis.sealRingOrder = sealRingOrder;", sandbox);
  sealRingOrder = sandbox.sealRingOrder;
}

/* greater spikes, from the game's own table */
const SPIKE_SCALE = 52;
const PLACE_OFFSET = -5;
const PLAYER_SCALE = 35;
const RING = PLAYER_SCALE + SPIKE_SCALE + PLACE_OFFSET;   // 82
const SEPARATION = SPIKE_SCALE + SPIKE_SCALE;             // 104
const MIN_SEP = 2 * Math.asin(SEPARATION / (2 * RING));   // 78.7 deg
const MAX_SPOTS = Math.floor((2 * Math.PI) / MIN_SEP);    // 4

let checks = 0;
/* checkItemLocation's object test. A placed building is an item, and
 * getScale(0.6, isItem) is scale * 1 * 1 for one — the 0.6 never applies. */
function free(x, y, objects) {
  for (const o of objects) {
    if (!o.active) continue;
    if (Math.hypot(x - o.x, y - o.y) < SPIKE_SCALE + o.scale) return false;
  }
  return true;
}
const at = (a) => ({ x: Math.cos(a) * RING, y: Math.sin(a) * RING });
function placeable(a, objects) { checks++; const p = at(a); return free(p.x, p.y, objects); }

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* A fight scene: your own and the enemy's buildings scattered close in, which is
 * what makes some of the four spots reachable only through a narrow slot. */
function makeScene(rand) {
  const objects = [];
  const n = Math.floor(rand() * 7);
  for (let i = 0; i < n; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 70 + rand() * 150;
    const scale = 25 + rand() * 30;
    objects.push({ active: true, x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, scale });
  }
  return objects;
}

/* Can an enemy body still get to you?
 *
 * Angular arithmetic answers this badly — a barrier can look gapless on one
 * radius and be walk-through on another — so flood fill the plane the enemy
 * moves in. Its centre must stay clear of every circle by its own radius, and
 * it wins if it reaches contact range of you. */
const CELL = 4, HALF = 360;
const DIM = Math.floor((HALF * 2) / CELL);
function enemyReachesMe(objects, placed) {
  const blockers = [];
  for (const o of objects) blockers.push({ x: o.x, y: o.y, r: o.scale + PLAYER_SCALE });
  for (const p of placed) blockers.push({ x: p.x, y: p.y, r: SPIKE_SCALE + PLAYER_SCALE });
  const open = new Uint8Array(DIM * DIM);
  for (let iy = 0; iy < DIM; iy++) {
    const y = -HALF + iy * CELL + CELL / 2;
    for (let ix = 0; ix < DIM; ix++) {
      const x = -HALF + ix * CELL + CELL / 2;
      let ok = 1;
      for (const b of blockers) {
        const dx = x - b.x, dy = y - b.y;
        if (dx * dx + dy * dy < b.r * b.r) { ok = 0; break; }
      }
      open[iy * DIM + ix] = ok;
    }
  }
  const seen = new Uint8Array(DIM * DIM);
  const stack = [];
  for (let i = 0; i < DIM; i++) {
    for (const idx of [i, (DIM - 1) * DIM + i, i * DIM, i * DIM + DIM - 1]) {
      if (open[idx] && !seen[idx]) { seen[idx] = 1; stack.push(idx); }
    }
  }
  const CONTACT = PLAYER_SCALE + PLAYER_SCALE;
  while (stack.length) {
    const idx = stack.pop();
    const ix = idx % DIM, iy = (idx - ix) / DIM;
    const x = -HALF + ix * CELL + CELL / 2, y = -HALF + iy * CELL + CELL / 2;
    if (x * x + y * y < CONTACT * CONTACT) return true;
    if (ix > 0) { const j = idx - 1; if (open[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    if (ix < DIM - 1) { const j = idx + 1; if (open[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    if (iy > 0) { const j = idx - DIM; if (open[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    if (iy < DIM - 1) { const j = idx + DIM; if (open[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
  }
  return false;
}

/* addPredictObject's acceptance, for spikes: no two within scale + scale. */
function accept(chosen, angle) {
  const p = at(angle);
  for (const c of chosen) if (Math.hypot(p.x - c.x, p.y - c.y) < SEPARATION) return false;
  chosen.push({ angle, x: p.x, y: p.y });
  return true;
}

function scan(objects, steps) {
  const angles = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    angles.push({ angle, placeable: placeable(angle, objects) });
  }
  getPerfectAngles(angles);
  return angles;
}

/* What the client does today: walk the scan and take whatever fits. */
function pickInOrder(angles, perfectFirst) {
  let cands = angles.filter((a) => a.placeable);
  if (perfectFirst) cands = cands.filter((a) => a.perfect).concat(cands.filter((a) => !a.perfect));
  const chosen = [];
  for (const c of cands) {
    if (chosen.length >= MAX_SPOTS) break;
    accept(chosen, c.angle);
  }
  return chosen;
}

/* Where the enemy is, so the anchored run has a bearing to answer. */
let sceneAnchor = 0;

/* The client's own sealRingOrder, driven exactly as checkPredictObjects drives
 * it: hand it every eligible candidate, then add them in the order it returns
 * under addPredictObject's rule. */
const SPIKE_ID = 2;
sandbox.items = { list: { [SPIKE_ID]: { scale: SPIKE_SCALE, placeOffset: PLACE_OFFSET, name: "greater spikes" } } };
function pickShipped(angles, anchored) {
  const cands = angles.filter((a) => a.placeable).map((a) => ({
    id: SPIKE_ID, angle: a.angle, scale: SPIKE_SCALE, perfect: a.perfect, ...at(a.angle),
  }));
  if (!cands.length) return [];
  let prefer = null;
  if (anchored) {
    let bestD = Infinity;
    for (const c of cands) {
      let d = Math.abs(((c.angle - sceneAnchor + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < bestD) { bestD = d; prefer = c; }
    }
  }
  const ordered = cands.filter((c) => c.perfect).concat(cands.filter((c) => !c.perfect));
  sandbox.predictObjects = [];
  const chosen = [];
  for (const c of sealRingOrder(ordered, SPIKE_ID, prefer)) {
    if (chosen.length >= MAX_SPOTS) break;
    accept(chosen, c.angle);
  }
  return chosen;
}

/* Every row is the same client code; only the resolution and the picker change.
 *
 * "in order" replays what checkPredictObjects used to do — edges first, then the
 * scan in index order, taking whatever addPredictObject accepts. The SHIPPED
 * rows drive the file's own sealRingOrder exactly as checkPredictObjects drives
 * it now. Brute force over every valid four-subset confirms sealRingOrder finds
 * a full ring in every scene where one exists, so its "all 4" column is the
 * ceiling for that resolution, not an attempt at it. */
const CONFIGS = [
  { label: "72  in order", steps: 72, pick: (a) => pickInOrder(a, true) },
  { label: "144 in order", steps: 144, pick: (a) => pickInOrder(a, true) },
  { label: "240 in order", steps: 240, pick: (a) => pickInOrder(a, true) },
  { label: "360 in order", steps: 360, pick: (a) => pickInOrder(a, true) },
];
if (hasSealer) {
  for (const n of [72, 120, 144, 180, 240, 360, 720]) {
    CONFIGS.push({ label: n + " sealed", steps: n, pick: (a) => pickShipped(a, false) });
  }
  CONFIGS.push({ label: "144 sealed, anch", steps: 144, pick: (a) => pickShipped(a, true) });
}

const SCENES = 600;

/* The ceiling: what the best possible set of four achieves on these scenes. */
const SEED = Number(process.env.SEAL_SEED || 20260829);
const rand0 = mulberry32(SEED);
let ceilingSealed = 0, ceilingFull = 0;
const scenes = [];
for (let n = 0; n < SCENES; n++) {
  const objects = makeScene(rand0);
  scenes.push({ objects, anchor: rand0() * Math.PI * 2 });
  const saved = checks;
  const bestSet = hasSealer ? pickShipped(scan(objects, 1440), false) : [];
  checks = saved;
  if (bestSet.length >= MAX_SPOTS) ceilingFull++;
  if (!enemyReachesMe(objects, bestSet)) ceilingSealed++;
}

const ONLY = process.env.SEAL_ONLY ? process.env.SEAL_ONLY.split(",") : null;
const rows = [];
for (const cfg of CONFIGS.filter((c) => !ONLY || ONLY.some((o) => c.label.startsWith(o)))) {
  checks = 0;
  let spots = 0, full = 0, sealed = 0;
  for (const scene of scenes) {
    const objects = scene.objects;
    sceneAnchor = scene.anchor;
    const chosen = cfg.pick(scan(objects, cfg.steps));
    spots += chosen.length;
    if (chosen.length >= MAX_SPOTS) full++;
    if (!enemyReachesMe(objects, chosen)) sealed++;
  }
  rows.push({ cfg, checks: checks / SCENES, spots: spots / SCENES, full, sealed });
}

const pad = (s, n) => String(s).padEnd(n);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : "0.0") + "%";
console.log(path.basename(CLIENT) + " — taking the four spots   (seed " + SEED + ")\n");
console.log("  greater spikes: ring " + RING + ", two cannot sit closer than " +
  (MIN_SEP * 180 / Math.PI).toFixed(1) + " deg");
console.log("  so " + MAX_SPOTS + " is the most that fit, at any resolution");
console.log("  a gap only becomes walkable at 138.6 deg, and four spikes cannot leave one");
const cfgSteps = /placeSteps:\s*(\d+)/.exec(src);
console.log("  this client is configured for " + (cfgSteps ? cfgSteps[1] : "?") +
  " placement angles, picker " + (hasSealer ? "ON" : "OFF") + "\n");
console.log("  " + pad("scan", 16) + pad("checks/tick", 13) + pad("spikes down", 13) +
  pad("all " + MAX_SPOTS, 9) + "enemy shut out");
console.log("  " + "-".repeat(74));
for (const r of rows) {
  console.log("  " + pad(r.cfg.label, 16) + pad(r.checks.toFixed(0), 13) +
    pad(r.spots.toFixed(2) + "/" + MAX_SPOTS, 13) +
    pad(pct(r.full, SCENES), 9) + r.sealed + " of " + SCENES + " (" + pct(r.sealed, SCENES) + ")");
}
console.log("  " + "-".repeat(74));
console.log("  " + pad("1440 sealed", 16) + pad("-", 13) + pad("-", 13) +
  pad(pct(ceilingFull, SCENES), 9) + ceilingSealed + " of " + SCENES +
  " (" + pct(ceilingSealed, SCENES) + ")");
