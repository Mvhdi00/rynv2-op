// Slice the three spike ticks out of a shipped build and drive them against
// stubbed RYN managers, so the gates are checked and not just parsed.
//
//   node test_spiketick.js            owner build
//   node test_spiketick.js --player   the copy spliced into the obfuscated build
//
// Numbers the cases lean on, from the game files:
//   player scale 35, so the melee hit test is range + scale*1.8 = range + 63
//   katana range 118  -> hit out to 181, capped by SPIKE_TICK_RANGE at 170
//   hammer dmg 10, sDmg 7.5, tank 3.3 -> 292 a swing, 88 without the hat
//   pit trap 500 hp
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");

const usePlayer = process.argv.includes("--player");
const src = fs.readFileSync(usePlayer ? RYN_PLAYER : RYN_OWNER, "utf8");
console.log(usePlayer ? "(player build)" : "(owner build)");

// The block ends at the close of SpikeTickTrap. In the owner build the next
// line is `class SpikeSync`, but in the player build what follows is that same
// class still mangled, so brace-match rather than look for a marker.
const START = "  const SPIKE_TICK_RANGE = 170;";
const a = src.indexOf(START);
if (a < 0) throw new Error("could not find the start of the spike tick block");
const trap = src.indexOf("class SpikeTickTrap {", a);
if (trap < 0) throw new Error("could not find SpikeTickTrap");
const b = (() => {
  let depth = 0;
  for (let i = src.indexOf("{", trap); i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i + 1;
  }
  throw new Error("unbalanced SpikeTickTrap");
})();
const code = src.slice(a, b);

// ---- stubs ----------------------------------------------------------------
const PLAYER_SCALE = 35;
const KATANA = 4, HAMMER = 10, MUSKET = 8;
const SPIKE_SCALE = 49, TRAP_SCALE = 50;
const WEAPONS = {
  [KATANA]: { range: 118, damage: 40, knockback: 0.3 },
  [HAMMER]: { range: 75, damage: 10, knockback: 0.3 },
  [MUSKET]: { range: 700, damage: 50, knockback: 0 },
};

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}
class PlayerObject {
  constructor(o) { Object.assign(this, o); }
  getDamage() { return this.itemGroup === 2 ? 25 : 0; }
}
const Items = [];
const Settings_default = {
  _spikeTick: true, _spikeTickBreak: true, _spikeTickNear: true,
  _spikeTickTrap: true, _autobreak: true, _antiSpikeTick: true,
};
const DataHandler_default = { getWeapon: id => WEAPONS[id] };

// ---- world ----------------------------------------------------------------
const placed = [];
function makeWorld(o = {}) {
  const {
    enemyDist = 120, myTrapped = false, primary = KATANA, secondary = HAMMER,
    primaryReloaded = true, secondaryReloaded = true, turretReloaded = true,
    ignoreModule = false, moduleActive = false, tickCount = 100,
    deleted = [], touching = [], knockedInto = false,
    enemyTrapped = false, trapHealth = 200, enemyAboutToReload = true,
    possibleToKnockback = false, nearestSpike = null,
    counterEnemy = null, hatID = 0, noEnemy = false,
  } = o;

  const myPos = new Vec(7200, 3000);
  const enemy = {
    id: 2, pos: { current: new Vec(myPos.x + enemyDist, myPos.y) },
    scale: PLAYER_SCALE, get hitScale() { return this.scale * 1.8; },
    get collisionScale() { return this.scale; },
    isTrapped: enemyTrapped,
    trappedIn: enemyTrapped ? { health: trapHealth, id: 90 } : null,
    canPlaceSpike: false,
    reload: [{ current: enemyAboutToReload ? 9 : 0, max: 10 },
             { current: 0, max: 0 }, { current: 0, max: 23 }],
    isReloaded(type, tick = 0) { return this.reload[type].current >= this.reload[type].max - tick; },
  };
  // A second enemy purely to exercise the counter-threat scan.
  const counter = counterEnemy && {
    id: 3, pos: { current: new Vec(myPos.x + counterEnemy.dist, myPos.y) },
    scale: PLAYER_SCALE, get hitScale() { return this.scale * 1.8; },
    get collisionScale() { return this.scale; },
    isTrapped: !!counterEnemy.trapped,
    canPlaceSpike: counterEnemy.canPlaceSpike !== false,
    reload: [{ current: counterEnemy.reloaded === false ? 0 : 10, max: 10 },
             { current: 0, max: 0 }, { current: 0, max: 23 }],
    isReloaded(type, tick = 0) { return this.reload[type].current >= this.reload[type].max - tick; },
  };

  const objects = new Map();
  let nextID = 500;
  for (const t of touching) {
    const obj = new PlayerObject({
      id: nextID++, ownerID: t.ownerID === undefined ? 9 : t.ownerID,
      itemGroup: 2, scale: SPIKE_SCALE,
      collisionScale: SPIKE_SCALE,
      pos: { current: new Vec(enemy.pos.current.x + t.dx, enemy.pos.current.y) },
    });
    objects.set(obj.id, obj);
  }

  const handler = {
    tickCount, moduleActive, forceHat: null, forceWeapon: null,
    useAngle: null, shouldAttack: false,
    staticModules: {
      reloading: {
        isReloaded: type => (type === 0 ? primaryReloaded : type === 1 ? secondaryReloaded : turretReloaded),
      },
    },
  };
  return {
    myPlayer: {
      scale: PLAYER_SCALE, hatID, isTrapped: myTrapped,
      pos: { current: myPos },
      getItemByType: t => (t === 0 ? primary : t === 1 ? secondary : null),
      // hammer 10 * 1 variant * 7.5 sDmg * (tank ? 3.3 : 1)
      getBuildingDamage: (id, tank) => WEAPONS[id].damage * (id === HAMMER ? 7.5 : 1) * (tank ? 3.3 : 1),
      collidingSimple(entity, range) { return this.pos.current.distance(entity.pos.current) <= range; },
    },
    _ModuleHandler: handler,
    PlayerManager: {
      enemies: counter ? [enemy, counter] : [enemy],
      isEnemyByID: ownerID => ownerID !== 1,
    },
    EnemyManager: {
      nearestEnemy: noEnemy ? null : enemy,
      nearestTrappedEnemy: enemyTrapped ? enemy : null,
      nearestEnemySpikeCollider: knockedInto ? enemy : null,
      spikeCollider: knockedInto ? {} : null,
      nearestSpike,
      possibleToKnockback,
      enemyCanPlaceSpike: false,
      shouldIgnoreModule: () => ignoreModule,
      attemptSpikePlacement() { placed.push(true); },
    },
    ObjectManager: {
      objects,
      deletedObjects: new Set(deleted.map(d => ({
        pos: { current: new Vec(myPos.x + d.dx, myPos.y + (d.dy || 0)) },
      }))),
      grid2D: { query: (x, y, r, cb) => { for (const id of objects.keys()) if (cb(id)) return; } },
    },
    _enemy: enemy,
  };
}

const globals = { Items, Settings_default, PlayerObject, DataHandler_default };
const sandbox = { Math, Number, Date, Map, Set, WeakMap, console };
if (usePlayer) {
  const NAMES = require("./names.js");
  for (const [logical, mangled] of Object.entries(NAMES)) {
    if (globals[logical] !== undefined) sandbox[mangled] = globals[logical];
  }
} else {
  Object.assign(sandbox, globals);
}
vm.createContext(sandbox);
vm.runInContext(
  code +
    "\nglobalThis.__Break = SpikeTickBreak;" +
    "\nglobalThis.__Near = SpikeTickNear;" +
    "\nglobalThis.__Trap = SpikeTickTrap;",
  sandbox
);
const { __Break: Break, __Near: Near, __Trap: Trap } = sandbox;

// ---- helpers --------------------------------------------------------------
let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
};
// Runs a module for one tick and reports what it asked the handler to do.
function run(Cls, opts, ticks = 1, mutate = null) {
  const client = makeWorld(opts);
  const mod = new Cls(client);
  const log = [];
  for (let t = 0; t < ticks; t++) {
    const h = client._ModuleHandler;
    h.tickCount = (opts.tickCount || 100) + t;
    h.moduleActive = opts.moduleActive || false;
    h.forceHat = null; h.forceWeapon = null; h.useAngle = null; h.shouldAttack = false;
    if (mutate) mutate(client, t);
    mod.postTick();
    log.push({ hat: h.forceHat, weapon: h.forceWeapon, attack: h.shouldAttack,
               active: h.moduleActive, angle: h.useAngle });
  }
  return { client, log };
}
const fires = (Cls, opts) => run(Cls, opts).log[0].attack === true;

// A "break happened right next to the enemy" fixture, the shape spikeTickBreak
// is looking for: 120 from me, 0 from the enemy who is also at 120.
const BREAK = { deleted: [{ dx: 120 }], enemyDist: 120 };
// An enemy standing on a spike, the shape spikeTickNear is looking for.
const TOUCH = { touching: [{ dx: 40 }], enemyDist: 120 };
// An enemy pinned in a 200 hp trap with their weapon a tick from ready.
const TRAP = { enemyTrapped: true, trapHealth: 200, enemyDist: 100, enemyAboutToReload: true };

console.log("\nspikeTickBreak");
check("a break beside the enemy fires", fires(Break, BREAK));
check("nothing broken -> nothing", !fires(Break, { enemyDist: 120 }));
check("break too far from the enemy (>90) -> nothing",
      !fires(Break, { deleted: [{ dx: 120, dy: 100 }], enemyDist: 120 }));
check("break past 170 -> nothing", !fires(Break, { deleted: [{ dx: 200 }], enemyDist: 160 }));
// Sakuna's objDist < primary.range + 70. A hammer as primary reaches 145, so a
// break at 150 is out even though it is inside the flat 170.
check("hammer primary: break at 150 is past range+70 -> nothing",
      !fires(Break, { deleted: [{ dx: 150 }], enemyDist: 120, primary: HAMMER }));
check("hammer primary: break at 120 is inside range+70 -> fires",
      fires(Break, { deleted: [{ dx: 120 }], enemyDist: 120, primary: HAMMER }));
check("katana primary: the same 150 break still fires",
      fires(Break, { deleted: [{ dx: 150 }], enemyDist: 150 }));
check("the hit wears bull and swings the primary",
      run(Break, BREAK).log[0].hat === 7 && run(Break, BREAK).log[0].weapon === 0);
{
  const { log } = run(Break, BREAK, 2);
  check("the tick after swaps to turret gear", log[1].hat === 53);
  check("and holds the aim on the target rather than dropping it", log[1].angle !== null);
}

console.log("\nshared gate");
const withSetting = (key, value, fn) => {
  const before = Settings_default[key];
  Settings_default[key] = value;
  try { return fn(); } finally { Settings_default[key] = before; }
};
check("master switch off -> nothing",
      withSetting("_spikeTick", false, () => !fires(Break, BREAK)));
check("variant switch off -> nothing",
      withSetting("_spikeTickBreak", false, () => !fires(Break, BREAK)));
check("another module already owns the tick -> nothing",
      !fires(Break, { ...BREAK, moduleActive: true }));
check("shouldIgnoreModule -> nothing", !fires(Break, { ...BREAK, ignoreModule: true }));
check("primary not reloaded -> nothing", !fires(Break, { ...BREAK, primaryReloaded: false }));
check("musket primary -> nothing", !fires(Break, { ...BREAK, primary: MUSKET }));
check("no enemy -> nothing", !fires(Break, { ...BREAK, noEnemy: true }));
// range + hitScale = 118 + 63 = 181, capped at 170
check("enemy at 169 is inside the cap", fires(Break, { deleted: [{ dx: 169 }], enemyDist: 169 }));
check("enemy at 171 is past the cap", !fires(Break, { deleted: [{ dx: 171 }], enemyDist: 171 }));
check("hammer primary caps at 75+63=138, so 150 is out",
      !fires(Break, { deleted: [{ dx: 150 }], enemyDist: 150, primary: HAMMER }));

console.log("\npost-trap grace (Sakuna: 300ms after intrapTime)");
check("trapped right now -> nothing", !fires(Break, { ...BREAK, myTrapped: true }));
{
  // Trapped on tick 0, free from tick 1. Sakuna waits 300ms, ~3 ticks.
  const { log } = run(Break, { ...BREAK, myTrapped: true }, 6,
                      (c, t) => { c.myPlayer.isTrapped = t === 0; });
  check("tick 1 after breaking out is still blocked", log[1].attack === false);
  check("tick 2 is still blocked", log[2].attack === false);
  check("tick 3 is still blocked", log[3].attack === false);
  check("tick 4 fires", log[4].attack === true);
}

console.log("\ncounter-threat gate (Sakuna: checkAntiSpikeTick)");
check("a hit would knock me into a spike -> nothing",
      !fires(Break, { ...BREAK, possibleToKnockback: true }));
check("no knockback threat -> fires", fires(Break, { ...BREAK, possibleToKnockback: false }));
check("an enemy inside 180 who can drop a spike on me -> nothing",
      !fires(Break, { ...BREAK, counterEnemy: { dist: 150 } }));
check("the same enemy past 180 -> fires",
      fires(Break, { ...BREAK, counterEnemy: { dist: 200 } }));
check("inside 180 but their primary is not ready -> fires",
      fires(Break, { ...BREAK, counterEnemy: { dist: 150, reloaded: false } }));
check("inside 180 but they cannot place a spike -> fires",
      fires(Break, { ...BREAK, counterEnemy: { dist: 150, canPlaceSpike: false } }));
check("inside 180 but they are trapped -> fires",
      fires(Break, { ...BREAK, counterEnemy: { dist: 150, trapped: true } }));
{
  // Threat on tick 0 only. Sakuna latches for 200ms, ~2 ticks.
  const { log } = run(Break, { ...BREAK, counterEnemy: { dist: 150 } }, 5,
                      (c, t) => { c.PlayerManager.enemies[1].canPlaceSpike = t === 0; });
  check("threat tick is blocked", log[0].attack === false);
  check("latch holds the next tick", log[1].attack === false);
  check("and the one after", log[2].attack === false);
  check("then it opens again", log[3].attack === true);
}
// Sakuna keeps the whole gate behind its own checkbox.
check("_antiSpikeTick off -> the knockback threat stops blocking",
      withSetting("_antiSpikeTick", false,
                  () => fires(Break, { ...BREAK, possibleToKnockback: true })));
check("_antiSpikeTick off -> a spike-capable enemy stops blocking",
      withSetting("_antiSpikeTick", false,
                  () => fires(Break, { ...BREAK, counterEnemy: { dist: 150 } })));
check("_antiSpikeTick off does not open the post-trap grace",
      withSetting("_antiSpikeTick", false, () => !fires(Break, { ...BREAK, myTrapped: true })));

console.log("\nnear-spike priority (Sakuna: nearBreakType == NearSpikes)");
const spikeAt = d => ({ pos: { current: new Vec(7200 + d, 3000) }, scale: SPIKE_SCALE });
// katana: min(118, 75) = 75, + spike scale 49 = 124
check("an enemy spike within 124 takes the tick instead",
      !fires(Break, { ...BREAK, nearestSpike: spikeAt(100) }));
check("a spike past 124 does not", fires(Break, { ...BREAK, nearestSpike: spikeAt(140) }));
check("with autobreak off the spike is nobody's job, so the tick still fires",
      withSetting("_autobreak", false, () => fires(Break, { ...BREAK, nearestSpike: spikeAt(100) })));

console.log("\nspikeTickNear");
check("enemy standing on a spike fires", fires(Near, TOUCH));
check("nothing near the enemy -> nothing", !fires(Near, { enemyDist: 120 }));
check("a spike that is mine (ownerID 1) does not count",
      !fires(Near, { touching: [{ dx: 40, ownerID: 1 }], enemyDist: 120 }));
check("touching reach is (49 + 35) * 1.05 = 88, so 85 counts",
      fires(Near, { touching: [{ dx: 85 }], enemyDist: 120 }));
check("...and 90 does not", !fires(Near, { touching: [{ dx: 90 }], enemyDist: 120 }));
check("a hit that would knock them into a spike fires",
      fires(Near, { enemyDist: 120, knockedInto: true }));
// Sakuna guards the predictive branch with !tmpObj.inTrap.
check("but not when they are pinned — they cannot be pushed",
      !fires(Near, { enemyDist: 120, knockedInto: true, enemyTrapped: true }));
check("a pinned enemy already standing on a spike still fires",
      fires(Near, { ...TOUCH, enemyTrapped: true }));

console.log("\nspikeTickTrap");
check("pinned in a 200 hp trap with the hammer ready fires", fires(Trap, TRAP));
check("no hammer -> nothing", !fires(Trap, { ...TRAP, secondary: 4 }));
check("hammer not reloaded -> nothing", !fires(Trap, { ...TRAP, secondaryReloaded: false }));
check("enemy not trapped -> nothing", !fires(Trap, { ...TRAP, enemyTrapped: false }));
check("enemy past 110 -> nothing", !fires(Trap, { ...TRAP, enemyDist: 120 }));
check("their weapon is not a tick from ready -> nothing",
      !fires(Trap, { ...TRAP, enemyAboutToReload: false }));
// hammer on tank = 10 * 7.5 * 3.3 = 247.5
check("a 200 hp trap is inside one tank swing", fires(Trap, TRAP));
check("a 300 hp trap is not", !fires(Trap, { ...TRAP, trapHealth: 300 }));
check("a full 500 hp trap is not", !fires(Trap, { ...TRAP, trapHealth: 500 }));
{
  const { log } = run(Trap, TRAP, 3);
  // The estimate above is the 3.3x one, so the hat has to actually be tank or
  // the swing lands at 75 and the trap survives.
  check("the break swing wears tank, not turret gear", log[0].hat === 40);
  check("and swings the hammer", log[0].weapon === 1);
  check("the next tick hits with bull and the primary",
        log[1].hat === 7 && log[1].weapon === 0);
  check("the tick after that is the turret", log[2].hat === 53);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
