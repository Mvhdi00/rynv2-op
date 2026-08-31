/* Velocity tick: does RYN now answer exactly what Glotus answers?
 *
 * Glotus and RYN are the same architecture — module classes with postTick,
 * ModuleHandler, EnemyManager, Settings_default — so both classes are lifted
 * out of the shipped files with `vm` and driven by ONE stub client. Nothing is
 * transcribed, and neither side gets a world the other did not see.
 *
 * The move is two ticks and the second is the point, so both are driven:
 *
 *   ARM   turret gear (hat 53) and moveTo set toward them; no swing yet
 *   FIRE  hat 7, polearm, swing along the same angle, still walking
 *
 * ModuleHandler.postTick resets moveTo to "disable" every tick in the real
 * client (17332), so the stub does the same between ticks — without that, tick
 * two would bail on its own `moveTo !== "disable"` guard and the FIRE step
 * would silently never be tested.
 *
 *   node velocity-duel.js [ryn.js] [glotus.txt]
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

const rynClass = lift(fs.readFileSync(RYN, "utf8"), "class VelocityTick\\s*\\{", "RYN VelocityTick");
const gloClass = lift(fs.readFileSync(GLOTUS, "utf8"), "class VelocityTick\\s*\\{", "Glotus VelocityTick");

const POLEARM = 5, KATANA = 4;
const WEAPONS = { 4: { type: 0, range: 118 }, 5: { type: 0, range: 142 } };

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}

/* One stub client, shared by both. Everything the module touches and nothing
 * it does not. */
function makeClient(s) {
  const ModuleHandler = {
    moduleActive: !!s.moduleActive,
    moveTo: "disable",
    forceHat: null, forceWeapon: null, useAngle: null, shouldAttack: false,
    staticModules: {
      reloading: {
        // isReloaded(type, ticks): slot 0 primary, slot 2 turret
        isReloaded: (type) => (type === 2 ? !!s.turretReloaded : !!s.primaryReloaded),
      },
    },
    // the real one clears moveTo at the top of every tick
    newTick() { this.moveTo = "disable"; this.forceHat = null; this.forceWeapon = null;
                this.shouldAttack = false; this.moduleActive = !!s.moduleActive; },
  };
  return {
    _ModuleHandler: ModuleHandler,
    StatsManager: { velocityTickTimes: 0 },
    myPlayer: {
      pos: { current: new Vec(0, 0), previous: new Vec(0, 0), future: new Vec(0, 0) },
      getItemByType: () => s.primary,
      getWeaponVariant: () => ({ current: s.variant }),
    },
    EnemyManager: {
      shouldIgnoreModule: () => !!s.ignore,
      nearestEnemy: s.noEnemy ? null : {
        pos: {
          current: new Vec(0, s.dist), previous: new Vec(0, s.dist), future: new Vec(0, s.dist),
        },
        weapon: { current: KATANA },
        futureHat: s.futureHat,
        atExact: () => !!s.almostReloaded,
      },
    },
  };
}

function drive(classSrc, s) {
  const sandbox = {
    Math,
    Settings_default: { _velocityTick: true },
    DataHandler_default: { getWeapon: (id) => WEAPONS[id], isMelee: () => true },
    inRange: (v, min, max) => v >= min && v <= max,
  };
  vm.createContext(sandbox);
  vm.runInContext(classSrc + "\nthis.make = (c) => new VelocityTick(c);", sandbox);
  const client = makeClient(s);
  const mh = client._ModuleHandler;
  const mod = sandbox.make(client);

  mod.postTick();
  const armed = { hat: mh.forceHat, moveTo: mh.moveTo, attack: mh.shouldAttack,
                  active: mh.moduleActive };
  // Second tick, exactly as the client runs it.
  if (s.moveTo2 !== "keep") mh.newTick();
  mod.postTick();
  const fired = { hat: mh.forceHat, weapon: mh.forceWeapon, attack: mh.shouldAttack,
                  moveTo: mh.moveTo, active: mh.moduleActive };
  return {
    arms: armed.hat === 53 && armed.moveTo !== "disable",
    fires: fired.hat === 7 && fired.weapon === 0 && fired.attack === true,
    walksOnFire: fired.moveTo !== "disable",
  };
}

const AXES = {
  primary:        [POLEARM, KATANA],
  variant:        [2, 1],
  primaryReloaded:[true, false],
  turretReloaded: [true, false],
  dist:           [232, 200, 260],   // inside 220-245, short, long
  almostReloaded: [true, false],
  futureHat:      [0, 6, 22, null],
  ignore:         [false, true],
};

const all = [];
for (const primary of AXES.primary)
  for (const variant of AXES.variant)
    for (const primaryReloaded of AXES.primaryReloaded)
      for (const turretReloaded of AXES.turretReloaded)
        for (const dist of AXES.dist)
          for (const almostReloaded of AXES.almostReloaded)
            for (const futureHat of AXES.futureHat)
              for (const ignore of AXES.ignore)
                all.push({ primary, variant, primaryReloaded, turretReloaded,
                           dist, almostReloaded, futureHat, ignore });

let agree = 0, arms = 0, fires = 0;
const differ = [];
for (const s of all) {
  const g = drive(gloClass, s), r = drive(rynClass, s);
  const same = g.arms === r.arms && g.fires === r.fires && g.walksOnFire === r.walksOnFire;
  if (same) agree++; else differ.push({ s, g, r });
  if (g.arms) arms++;
  if (g.fires) fires++;
}

const pad = (v, w) => String(v).padEnd(w);
console.log("velocity tick — RYN against Glotus 5.5.5, on the same staged world\n");
console.log("  both classes lifted with vm and driven by one stub client — nothing transcribed\n");
console.log("  " + pad("scenes", 24) + all.length);
console.log("  " + pad("agree on all 3 signals", 24) + agree + " (" + ((agree / all.length) * 100).toFixed(1) + "%)");
console.log("  " + pad("disagree", 24) + differ.length);
console.log("  " + pad("Glotus arms on", 24) + arms);
console.log("  " + pad("Glotus fires on", 24) + fires);

if (differ.length) {
  console.log("\n  where they part:");
  for (const d of differ.slice(0, 10)) {
    console.log("  " + JSON.stringify(d.s) + "\n    glotus " + JSON.stringify(d.g) +
      "\n    ryn    " + JSON.stringify(d.r));
  }
}

/* As with the anti-push duel: agreement across hundreds of scenes where few
 * fire could be agreement on "no". Take the scene that does fire and flip each
 * gate on its own — every flip must stop BOTH. */
const firing = { primary: POLEARM, variant: 2, primaryReloaded: true, turretReloaded: true,
                 dist: 232, almostReloaded: true, futureHat: 0, ignore: false };
/* One row per GATE, not per field. almostReloaded and futureHat are the two
 * halves of one OR — `canSend = almostReloaded || detectFutureHat` — so
 * flipping either alone correctly leaves it firing on the other. Testing them
 * as separate gates asks the wrong question and fails a working client. */
const GATES = [
  ["primary -> katana",        { primary: KATANA }],
  ["variant -> gold",          { variant: 1 }],
  ["primary not reloaded",     { primaryReloaded: false }],
  ["turret not reloaded",      { turretReloaded: false }],
  ["dist 260, past the window",{ dist: 260 }],
  ["dist 200, short of it",    { dist: 200 }],
  ["canSend (both halves)",    { almostReloaded: false, futureHat: null }],
  ["their hat is soldier",     { almostReloaded: false, futureHat: 6 }],
  ["shouldIgnoreModule",       { ignore: true }],
];
console.log("\n  each gate, flipped on its own away from the scene that fires:");
console.log("  " + pad("gate flipped", 28) + pad("glotus", 12) + pad("ryn", 12) + "gate is live");
console.log("  " + "-".repeat(66));
const say = (o) => (o.fires ? "fires" : o.arms ? "arms only" : "declines");
let dead = 0;
const bg = drive(gloClass, firing), br = drive(rynClass, firing);
console.log("  " + pad("(nothing — the scene)", 28) + pad(say(bg), 12) + pad(say(br), 12) +
  (bg.fires && br.fires ? "—" : "BASE BROKEN"));
if (!bg.fires || !br.fires) dead++;
for (const [label, patch] of GATES) {
  const s = Object.assign({}, firing, patch);
  const g = drive(gloClass, s), r = drive(rynClass, s);
  const live = !g.fires && !r.fires;
  if (!live) dead++;
  console.log("  " + pad(label, 28) + pad(say(g), 12) + pad(say(r), 12) + (live ? "yes" : "NO  <-"));
}

console.log("\n  the walk is the whole trick — it is what closes 232 down to the polearm's 142:");
console.log("  " + pad("glotus walks on the firing tick", 34) + bg.walksOnFire);
console.log("  " + pad("ryn walks on the firing tick", 34) + br.walksOnFire);
if (!bg.walksOnFire || !br.walksOnFire) dead++;

const ok = differ.length === 0 && dead === 0;
console.log("\n  " + (ok
  ? "identical on every scene, every gate shuts both off, and both walk — the tick is Glotus's"
  : (differ.length ? differ.length + " scenes differ. " : "") + (dead ? dead + " check(s) failed." : "")));
process.exit(ok ? 0 : 1);
