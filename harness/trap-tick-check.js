/* Which spike does a trap tick run on, and does it survive the decision?
 *
 * canTrapTick proves a specific spike would land before it lets the combo run:
 * placeable, the trap within scale + 95 of you, the spike within scale + 55 of
 * the enemy. Then it returned true and let that spike fall on the floor —
 * Novastorm's copy does the same — so the hammer broke the trap and the primary
 * swung with nothing placed for the enemy to be freed into. It also took the
 * FIRST candidate that passed, and the scan hands them over in angle order from
 * zero, so the spike the whole move ran on was whichever sat lowest on the
 * circle rather than the one that hits.
 *
 * Both are decisions inside one function, so both are testable without a
 * browser: lift it, hand it a candidate list with a known answer, and read back
 * what it chose.
 *
 * What this does NOT cover is the placement reaching the wire. A trap tick needs
 * a trap damaged below the hammer's structure damage, and object health is not
 * reachable from the mock — nothing in the packet table sets it, so a loaded
 * trap sits at the item table's 500 and the gate never opens. The placement is
 * four lines in getPredictObjects alongside every other placer, and it is not
 * measured here.
 *
 *   node trap-tick-check.js [client.js]
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

const SPIKE = { scale: 49, placeOffset: -5, id: 6 };
const RING = 35 + SPIKE.scale + SPIKE.placeOffset;

/* The enemy sits just off your ring, trapped. Candidates go round the circle in
 * angle order, exactly as getPrePlaceAngles produces them, so "first that
 * passes" and "closest to the enemy" are different spikes on purpose. */
function scene() {
  const enemyAngle = 1.9;
  const enemy = { x2: Math.cos(enemyAngle) * 70, y2: Math.sin(enemyAngle) * 70, spikeDamage: 0 };
  const candidates = [];
  for (let i = 0; i < 144; i++) {
    const a = (i / 144) * Math.PI * 2;
    candidates.push({
      angle: a, placeable: true, scale: SPIKE.scale,
      x: Math.cos(a) * RING, y: Math.sin(a) * RING,
    });
  }
  return { enemy, candidates, enemyAngle };
}

function run(opts) {
  const sc = scene();
  const sandbox = {
    Math,
    UTILS: { getDistance: (a, b, c, d) => Math.hypot(c - a, d - b) },
    window: { vars: { shameTick: opts.toggle } },
    nearestEnemy: sc.enemy,
    myPlayer: { sid: 1, x2: 0, y2: 0, items: [0, 3, SPIKE.id, 10] },
    items: { list: { [SPIKE.id]: SPIKE } },
    primaryReload: { 1: 1 },
    secondaryReload: { 1: 1 },
    getPlayerInfo: (p, what) =>
      what === "secondaryWeapon" ? opts.secondary : opts.structureDmg,
    traps_our: [{ x: sc.enemy.x2, y: sc.enemy.y2, scale: 50, health: opts.trapHealth }],
    visibleObjects: [],
    getPrePlaceAngles: () => sc.candidates,
    trapTickSpike: null,
  };
  vm.createContext(sandbox);
  vm.runInContext(lift("canTrapTick") + "\nthis.result = canTrapTick();\nthis.chose = trapTickSpike;", sandbox);
  return { ok: sandbox.result, chose: sandbox.chose, scene: sc };
}

const BASE = { toggle: true, secondary: "hammer", structureDmg: 400, trapHealth: 200 };
const rows = [];
const add = (label, opts, expect) => {
  const r = run(Object.assign({}, BASE, opts));
  rows.push({ label, r, expect });
};

add("everything lines up", {}, "fires");
add("toggle off", { toggle: false }, "declines");
add("secondary is not a hammer", { secondary: "musket" }, "declines");
add("trap too healthy to break", { trapHealth: 900 }, "declines");

const pad = (s, n) => String(s).padEnd(n);
console.log(path.basename(CLIENT) + " — the spike a trap tick runs on\n");
console.log("  " + pad("case", 30) + pad("expected", 12) + pad("got", 12) + "kept a spike");
console.log("  " + "-".repeat(74));
let bad = 0;
for (const { label, r, expect } of rows) {
  const got = r.ok ? "fires" : "declines";
  if (got !== expect) bad++;
  console.log("  " + pad(label, 30) + pad(expect, 12) + pad(got + (got === expect ? "" : "  <-"), 12) +
    (r.chose ? "yes, angle " + r.chose.angle.toFixed(2) : "no"));
}

/* The accuracy half: of every candidate that passes, is the one kept the one
 * nearest the enemy? Angle order would answer with something near zero. */
const fired = run(BASE);
let nearest = null, nd = Infinity;
for (const c of fired.scene.candidates) {
  const d = Math.hypot(c.x - fired.scene.enemy.x2, c.y - fired.scene.enemy.y2);
  if (d >= c.scale + 55) continue;
  if (d < nd) { nd = d; nearest = c; }
}
const chosenDist = fired.chose
  ? Math.hypot(fired.chose.x - fired.scene.enemy.x2, fired.chose.y - fired.scene.enemy.y2) : Infinity;

console.log("\n  the enemy sits at angle " + fired.scene.enemyAngle.toFixed(2) +
  ", and candidates arrive in angle order from 0");
console.log("  " + pad("nearest candidate to the enemy", 34) + "angle " +
  (nearest ? nearest.angle.toFixed(2) + ", " + nd.toFixed(1) + " away" : "none"));
console.log("  " + pad("the one it kept", 34) + "angle " +
  (fired.chose ? fired.chose.angle.toFixed(2) + ", " + chosenDist.toFixed(1) + " away" : "none"));

const picksNearest = !!fired.chose && !!nearest && Math.abs(chosenDist - nd) < 0.01;
if (!picksNearest) bad++;
console.log("\n  " + (bad === 0
  ? "every gate answers correctly, and it keeps the spike nearest the enemy"
  : bad + " wrong — see the marked rows"));
process.exit(bad === 0 ? 0 : 1);
