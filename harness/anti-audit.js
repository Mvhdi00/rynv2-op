/* Every anti that feeds RYN's autoheal, against novastorm's and X- Precision's.
 *
 * The autoheal decision is one line — `tempHealth <= totalDmgPot` — so all of
 * its accuracy lives in totalDmgPot. novastorm builds that from five terms and
 * seven named blocks; X- Precision ships the same code, byte for byte, in the
 * same order. This audits RYN's equivalent term by term, and RUNS the two that
 * were missing and have just been ported.
 *
 * novastorm 15473-15700 / X- Precision 14681-14905, in order:
 *
 *   PREDICT TURRET HIT      three cases, +25 each, out to 350
 *   VELOCITY TICK ANTI      turret gear at 150-350 with a loaded primary
 *   KNOCKBACK ANTI          a hit that carries me onto a spike or cactus
 *   ANTI NORMAL INSTAKILL   turret + secondary for a ranged secondary
 *   ANTI SPIKE TICK         they place a spike that touches me, then swing
 *   SHAME RESET             bull tick when nothing is threatening
 *   totalDmgPot             sum, capped at 140, then soldier x0.75 / bull +5
 *
 *   node anti-audit.js [ryn.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/RYN_Client_v5.4.user.js");
const src = fs.readFileSync(RYN, "utf8");

function liftMethod(name) {
  const m = new RegExp("\\n    " + name + "\\(").exec(src);
  if (!m) throw new Error("could not find " + name);
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index + 1, i + 1); }
  }
  throw new Error("unbalanced " + name);
}
function constant(name) {
  const m = new RegExp("const " + name + " = ([^;]+);").exec(src);
  if (!m) throw new Error(name + " is gone from the client");
  return Number(m[1]);
}

const K = {
  range: constant("ANTI_TURRET_RANGE"),
  dmg: constant("ANTI_TURRET_DAMAGE"),
  low: constant("ANTI_TURRET_LOW_HEALTH"),
  vmin: constant("ANTI_VELOCITY_TICK_MIN"),
  vhat: constant("ANTI_VELOCITY_TICK_HAT"),
};

/* The ported method, lifted and run. */
const box = { Math, Object };
vm.createContext(box);
vm.runInContext(
  "const ANTI_TURRET_RANGE = " + K.range + ", ANTI_TURRET_DAMAGE = " + K.dmg +
  ", ANTI_TURRET_LOW_HEALTH = " + K.low + ", ANTI_VELOCITY_TICK_MIN = " + K.vmin +
  ", ANTI_VELOCITY_TICK_HAT = " + K.vhat + ";\n" +
  "this.make = (client) => { const holder = { client, potentialDamage: 0, potentialSpikeDamage: 0," +
  " collidingSpike: false, willCollideSpike: false, " + liftMethod("antiLongRangeTurret") + " };" +
  " return holder; };", box);

/* RELOAD SCALES. novastorm normalises a reload to 0..1 and tests `== 1` for a
 * fully charged weapon. RYN keeps it in ticks — {current, max} — and asks
 * isReloaded(type, 1), which is `current >= max - 1`: ready, or ready next
 * tick. That one tick of lead is RYN's convention everywhere (
 * canPossiblyInstakill uses isReloaded(0, 1) too) and for an ANTI it errs the
 * safe way. The rows drive ticks directly so both are modelled as they are,
 * and the one-tick case is named rather than averaged away. */
const RELOAD_MAX = 3;
const charged = (ticks) => (ticks >= RELOAD_MAX ? 1 : 0);

/* novastorm 15473 and X- 14681, transcribed. `reload == 1` there is a fully
 * charged weapon; `< 1` is one that is not. */
function novastorm(w) {
  let turretDmgPot = 0, hitDmgPot = 0;
  const dist = w.dist;
  const turretReload = charged(w.turretTicks);
  const primaryReload = charged(w.primaryTicks);
  const lastPrimaryReload = charged(w.lastPrimaryTicks);
  if (dist <= 350 && turretReload === 1) {
    if (w.collidingspike && lastPrimaryReload === 1 && primaryReload < 1) turretDmgPot += 25;
    else if (w.willcollide && primaryReload < 1) turretDmgPot += 25;
    else if (w.health <= 25 && (w.hitSoFar + w.turretSoFar + w.spikeSoFar) < 25) turretDmgPot += 25;
  }
  if (dist > 150 && dist < 350) {
    if (turretReload < 1 && primaryReload === 1 && w.skinIndex === 53) {
      turretDmgPot += 25;
      hitDmgPot += w.primaryDmg;
    }
  }
  return turretDmgPot + hitDmgPot;
}

/* The same world, in the shape RYN's method reads. */
function ryn(w) {
  const enemy = {
    potentialDamage: 0,
    hatID: w.skinIndex,
    weapon: { primary: 0 },
    pos: { current: { x: w.dist, y: 0 } },
    reload: [
      { current: w.primaryTicks, max: RELOAD_MAX, previous: w.lastPrimaryTicks },
      { current: RELOAD_MAX, max: RELOAD_MAX, previous: RELOAD_MAX },
      { current: w.turretTicks, max: RELOAD_MAX, previous: w.turretTicks },
    ],
    isReloaded(type, tick) { return this.reload[type].current >= this.reload[type].max - tick; },
    getMaxWeaponDamage() { return w.primaryDmg; },
  };
  const holder = box.make({
    myPlayer: {
      currentHealth: w.health,
      pos: { current: { x: 0, y: 0, distance: (o) => Math.hypot(o.x, o.y) } },
    },
    PlayerManager: { lookingShield: () => false },
  });
  holder.collidingSpike = w.collidingspike;
  holder.willCollideSpike = w.willcollide;
  holder.potentialDamage = w.hitSoFar + w.turretSoFar;
  holder.potentialSpikeDamage = w.spikeSoFar;
  holder.antiLongRangeTurret(enemy);
  return enemy.potentialDamage;
}

const base = {
  dist: 200, turretTicks: RELOAD_MAX, primaryTicks: RELOAD_MAX, lastPrimaryTicks: RELOAD_MAX,
  collidingspike: false, willcollide: false, health: 100,
  hitSoFar: 0, turretSoFar: 0, spikeSoFar: 0, skinIndex: 0, primaryDmg: 45,
};
const ROWS = [
  ["nothing happening", {}],
  ["on a spike, their primary just fired", { collidingspike: true, primaryTicks: 0, lastPrimaryTicks: RELOAD_MAX }],
  ["about to be knocked onto a spike", { willcollide: true, primaryTicks: 0 }],
  ["low health, nothing else predicted", { health: 20 }],
  ["low health, but plenty already predicted", { health: 20, hitSoFar: 40 }],
  ["out past 350", { dist: 400, collidingspike: true, primaryTicks: 0 }],
  ["turret gear at 200, turret spent, primary up", { dist: 200, turretTicks: 0, skinIndex: 53 }],
  ["turret gear at 100 — too close for the band", { dist: 100, turretTicks: 0, skinIndex: 53 }],
  ["turret gear at 340, turret spent", { dist: 340, turretTicks: 0, skinIndex: 53 }],
  ["turret gear but the turret is loaded", { dist: 200, turretTicks: RELOAD_MAX, skinIndex: 53 }],
  ["no turret gear, turret spent", { dist: 200, turretTicks: 0, skinIndex: 6 }],
  ["turret gear, primary also spent", { dist: 200, turretTicks: 0, primaryTicks: 0, skinIndex: 53 }],
];

const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — the two long-range turret antis, ported and run\n");
console.log("  RYN's antiLongRangeTurret is lifted from the client; novastorm's block is");
console.log("  transcribed from 15473, which X- Precision ships identically at 14681.\n");
console.log("  " + pad("situation", 46) + pad("novastorm", 12) + pad("RYN", 8) + "");
console.log("  " + "-".repeat(70));

let bad = 0;
for (const [label, over] of ROWS) {
  const w = Object.assign({}, base, over);
  const n = novastorm(w), r = ryn(w);
  const ok = n === r;
  if (!ok) bad++;
  console.log("  " + pad(label, 46) + pad(n, 12) + pad(r, 8) + (ok ? "" : "  <- differ"));
}

/* A sweep, so the table above is not the only evidence. */
let checked = 0, agree = 0;
const disagreements = [];
// 0 and max only: at max - 1 RYN is deliberately one tick early, which the
// row below the sweep prices on its own.
for (const dist of [80, 150, 151, 200, 349, 350, 351, 500]) {
  for (const turretTicks of [0, RELOAD_MAX]) {
    for (const primaryTicks of [0, RELOAD_MAX]) {
      for (const lastPrimaryTicks of [0, RELOAD_MAX]) {
        for (const collidingspike of [false, true]) {
          for (const willcollide of [false, true]) {
            for (const health of [20, 100]) {
              for (const skinIndex of [0, 53]) {
                for (const hitSoFar of [0, 40]) {
                  const w = Object.assign({}, base, { dist, turretTicks, primaryTicks,
                    lastPrimaryTicks, collidingspike, willcollide, health, skinIndex, hitSoFar });
                  checked++;
                  const n = novastorm(w), r = ryn(w);
                  if (n === r) agree++;
                  else if (disagreements.length < 4) disagreements.push([w, n, r]);
                }
              }
            }
          }
        }
      }
    }
  }
}
console.log("\n  exhaustive sweep: " + agree + " of " + checked + " worlds agree" +
  (agree === checked ? "" : "  (" + (checked - agree) + " differ)"));
for (const [w, n, r] of disagreements) {
  console.log("    d=" + w.dist + " turret=" + w.turretTicks + " primary=" + w.primaryTicks +
    " last=" + w.lastPrimaryTicks + " spike=" + w.collidingspike + " will=" + w.willcollide +
    " hp=" + w.health + " hat=" + w.skinIndex + " -> nova " + n + ", ryn " + r);
}
if (agree !== checked) bad++;

/* The one place the two conventions part, priced rather than hidden. */
const oneTick = Object.assign({}, base, { dist: 200, turretTicks: RELOAD_MAX - 1, skinIndex: 53, health: 20 });
console.log("\n  a turret one tick from ready, at 200, on 20 health:");
console.log("    novastorm reads the turret as spent and predicts a velocity tick: " + novastorm(oneTick) + ".");
console.log("    RYN reads it as ready and predicts the turret shot instead: " + ryn(oneTick) + ".");
console.log("    isReloaded(type, 1) is `current >= max - 1` and RYN uses it everywhere,");
console.log("    including canPossiblyInstakill. For an anti, one tick early is the safe side.");

/* THE WHOLE LIST. The two above are the ones that were missing and are now
 * ported. These are the rest, checked against the source and reported — not
 * changed, because each already exists in RYN and altering its bounds would
 * move canPossiblyInstakill, which feeds danger detection, the soldier hat and
 * every insta module, not just the heal. */
const has = (re) => new RegExp(re).test(src);
const TERMS = [
  ["PREDICT TURRET HIT", "antiLongRangeTurret", "ported now — 3 cases, +25, out to 350"],
  ["VELOCITY TICK ANTI", "ANTI_VELOCITY_TICK_HAT", "ported now — turret gear at 150-350"],
  ["KNOCKBACK ANTI", "potentialSpikeKnockbackDamage", "present; RYN uses an angular cone where novastorm uses lineInRect"],
  ["  ...including cactuses", "isCactus", "present — Resource.getDamage returns 35 for a desert cactus"],
  ["ANTI SPIKE TICK", "detectSpikeInsta", "present; RYN asks the real placement solver, novastorm scans 36 fixed angles"],
  ["ANTI NORMAL INSTAKILL", "collidingSecondary", "present, DIFFERENT BOUNDS — see below"],
  ["SHAME RESET", "class ShameReset", "present as its own module"],
  ["poison / bull tick", "isBullTickTime\\(\\)", "present — +5 a tick, novastorm's poisonDmgPot"],
  ["projectiles in flight", "ProjectileManager.totalDamage", "RYN only — novastorm has no equivalent"],
  ["cap at 140", "ANTI_INSTA_DMG_CAP", "present"],
  ["soldier x0.75 / bull +5", "ANTI_INSTA_SCUBA_BIAS", "present"],
  ["safe soldier", "SAFE_SOLDIER_RANGE", "present in ModuleHandler.postTick"],
];
console.log("\n  the whole list, term by term\n");
console.log("  " + pad("novastorm / X- block", 26) + pad("in RYN", 9) + "how");
console.log("  " + "-".repeat(100));
for (const [name, probe, note] of TERMS) {
  const present = has(probe);
  if (!present) bad++;
  console.log("  " + pad(name, 26) + pad(present ? "yes" : "NO", 9) + note);
}

console.log("\n  ANTI NORMAL INSTAKILL, the one difference that is not cosmetic:");
console.log("    novastorm   ranged secondary, hit recently, within 400: +25 turret, +secondary");
console.log("    RYN         ranged secondary within primaryRange + 130 (about 272 with a");
console.log("                polearm), no \"hit recently\" requirement");
console.log("    So RYN fires more often up close and not at all between about 272 and 400.");
console.log("    Left alone on purpose: those bounds are canPossiblyInstakill's, and it feeds");
console.log("    danger detection, the soldier hat and every insta module, not only the heal.");

console.log("\n  " + (bad === 0
  ? "RYN's long-range turret antis match novastorm's on every world tried, and every other term is present"
  : bad + " disagreement(s) above"));
process.exit(bad === 0 ? 0 : 1);
