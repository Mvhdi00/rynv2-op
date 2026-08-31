/* Knockback tick: does RYN answer exactly what Glotus answers?
 *
 * Same method as velocity-duel.js — both classes lifted out of the shipped
 * files with `vm` and driven by ONE stub client, so nothing is transcribed and
 * neither side sees a world the other did not.
 *
 * The move: hit them so the knockback carries them onto a spike.
 *
 *   PRIMARY ENOUGH   the gap to the spike fits inside the primary's own
 *                    knockback -> one swing, done
 *   TURRET NEEDED    it only fits once the turret's ~60 is counted -> swing
 *                    now, turret on the tick after (useTurret latches)
 *
 * The reach test is a knockback budget, not a range:
 *
 *     const knockback = primaryKnockback + 60;
 *     const collisionScale = spike.collisionScale + enemy.collisionScale;
 *     const isPrimaryEnough = distanceToSpike <= collisionScale + primaryKnockback;
 *     if (distanceToSpike <= collisionScale + knockback) { ... }
 *
 * Everything it reads, RYN already computed and never used:
 * EnemyManager.nearestEnemySpikeCollider and .spikeCollider are derived in code
 * that is byte for byte Glotus's, and before this port nothing read either.
 *
 *   node knockback-duel.js [ryn.js] [glotus.txt]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/RYN_Client_v5.4.user.js");
const GLOTUS = process.argv[3] ||
  "/root/.claude/uploads/84985967-839c-5cb9-84f9-ceebbe0cce70/cef1a7ac-Glotus_Client_Moomoo.io5.5.5.txt";

function lift(src, header, label) {
  const m = new RegExp(header).exec(src);
  if (!m) throw new Error("could not find " + label);
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index, i + 1); }
  }
  throw new Error("unbalanced " + label);
}

const rynClass = lift(fs.readFileSync(RYN, "utf8"), "class KnockbackTick\\s*\\{", "RYN KnockbackTick");
const gloClass = lift(fs.readFileSync(GLOTUS, "utf8"), "class KnockbackTick\\s*\\{", "Glotus KnockbackTick");

const BAT = 6, DAGGERS = 7, POLEARM = 5;
const WEAPONS = {
  5: { range: 142, knockback: 55.6 },
  6: { range: 110, knockback: 111.1 },
  7: { range: 65, knockback: 44.4 },
};
const PLAYER = 35, SPIKE = 49;

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}

function makeClient(s) {
  const ModuleHandler = {
    moduleActive: !!s.moduleActive,
    forceHat: null, forceWeapon: null, useAngle: null, shouldAttack: false,
    staticModules: {
      reloading: { isReloaded: (slot) => (slot === 2 ? !!s.turretReloaded : !!s.primaryReloaded) },
    },
    hasStoreItem: () => s.ownsTurretGear !== false,
    newTick() {
      this.moduleActive = !!s.moduleActive; this.forceHat = null;
      this.forceWeapon = null; this.shouldAttack = false;
    },
  };
  // Me at the origin, them at `enemyDist` along +y, the spike `gap` beyond them.
  const enemy = s.noEnemy ? null : {
    pos: { current: new Vec(0, s.enemyDist), previous: new Vec(0, s.enemyDist),
           future: new Vec(0, s.enemyDist) },
    collisionScale: PLAYER, hitScale: PLAYER * 1.8, isTrapped: !!s.enemyTrapped,
  };
  const spike = s.noSpike ? null : {
    pos: { current: new Vec(0, s.enemyDist + s.gap) },
    collisionScale: SPIKE,
  };
  let placements = 0;
  return {
    _ModuleHandler: ModuleHandler,
    StatsManager: { knockbackTickTimes: 0 },
    myPlayer: {
      pos: { current: new Vec(0, 0), previous: new Vec(0, 0), future: new Vec(0, 0) },
      getItemByType: () => s.primary,
      collidingSimple(e, range) { return this.pos.current.distance(e.pos.current) <= range; },
    },
    EnemyManager: {
      shouldIgnoreModule: () => !!s.ignore,
      nearestEnemySpikeCollider: enemy,
      spikeCollider: spike,
      attemptSpikePlacement: () => { placements++; },
    },
    get placements() { return placements; },
  };
}

function drive(classSrc, s) {
  const sandbox = {
    Math,
    KNOCKBACK_TICK_TURRET_KB: 60,
    Settings_default: { _knockbackTick: true },
    DataHandler_default: { getWeapon: (id) => WEAPONS[id] },
  };
  vm.createContext(sandbox);
  vm.runInContext(classSrc + "\nthis.make = (c) => new KnockbackTick(c);", sandbox);
  const client = makeClient(s);
  const mh = client._ModuleHandler;
  const mod = sandbox.make(client);

  mod.postTick();
  const hit = { hat: mh.forceHat, weapon: mh.forceWeapon, attack: mh.shouldAttack };
  const latched = mod.useTurret;
  mh.newTick();
  mod.postTick();
  const follow = { hat: mh.forceHat, active: mh.moduleActive };
  return {
    swings: hit.hat === 7 && hit.weapon === 0 && hit.attack === true,
    turretFollows: follow.hat === 53,
    latched: latched === true,
  };
}

/* Gaps chosen against the real budget. collisionScale = 49 + 35 = 84.
 *   daggers  primary 44.4 -> enough to 128.4, with turret to 188.4
 *   bat      primary 111.1 -> enough to 195.1, with turret to 255.1 */
const BASE = { primary: DAGGERS, enemyDist: 90, gap: 100, primaryReloaded: true,
               turretReloaded: true, ignore: false, moduleActive: false };
const ROWS = [
  ["daggers, gap 100 — primary alone",    { gap: 100 }],
  ["daggers, gap 150 — needs the turret", { gap: 150 }],
  ["daggers, gap 250 — out of budget",    { gap: 250 }],
  ["bat, gap 150 — primary alone",        { primary: BAT, gap: 150 }],
  ["bat, gap 240 — needs the turret",     { primary: BAT, gap: 240 }],
  ["polearm, gap 100",                    { primary: POLEARM, gap: 100 }],
  ["they are already trapped",            { enemyTrapped: true }],
  ["no spike behind them",                { noSpike: true }],
  ["primary not reloaded",                { primaryReloaded: false }],
  ["another module has the tick",         { moduleActive: true }],
  ["shouldIgnoreModule",                  { ignore: true }],
  ["too far to reach them",               { enemyDist: 300 }],
];

const pad = (v, w) => String(v).padEnd(w);
console.log("knockback tick — RYN against Glotus 5.5.5, on the same staged world\n");
console.log("  both classes lifted with vm and driven by one stub client — nothing transcribed");
console.log("  the reach test is a knockback budget: collisionScale 84 + the weapon's own kb,");
console.log("  plus ~60 more if the turret is counted\n");
console.log("  " + pad("case", 38) + pad("ryn", 26) + "glotus");
console.log("  " + "-".repeat(88));

const say = (r) => (r.swings ? "swings" + (r.latched ? " + turret next" : "") : "declines");
let bad = 0, swung = 0;
for (const [label, patch] of ROWS) {
  const s = Object.assign({}, BASE, patch);
  const r = drive(rynClass, s), g = drive(gloClass, s);
  const same = r.swings === g.swings && r.latched === g.latched && r.turretFollows === g.turretFollows;
  if (!same) bad++;
  if (r.swings) swung++;
  console.log("  " + pad(label, 38) + pad(say(r) + (same ? "" : "  <-"), 26) + say(g));
}

console.log("\n  " + pad("rows", 10) + ROWS.length);
console.log("  " + pad("agree", 10) + (ROWS.length - bad));
console.log("  " + pad("swings on", 10) + swung);

/* The turret follow-up is the half that is easy to lose in a port: the swing
 * lands either way, and a missing latch only shows as the enemy stopping just
 * short of the spike. */
const needsTurret = drive(rynClass, Object.assign({}, BASE, { gap: 150 }));
const gNeedsTurret = drive(gloClass, Object.assign({}, BASE, { gap: 150 }));
console.log("\n  the turret follow-up, on a gap the primary cannot cover alone:");
console.log("  " + pad("ryn latches useTurret", 28) + needsTurret.latched);
console.log("  " + pad("ryn fires it next tick", 28) + needsTurret.turretFollows);
console.log("  " + pad("glotus latches", 28) + gNeedsTurret.latched);
console.log("  " + pad("glotus fires it next tick", 28) + gNeedsTurret.turretFollows);
if (!needsTurret.latched || !needsTurret.turretFollows) bad++;

console.log("\n  " + (bad === 0
  ? "identical on every row, and the turret follow-up survives — the tick is Glotus's"
  : bad + " row(s) differ"));
process.exit(bad === 0 ? 0 : 1);
