// Behaviour tests for the four features ported from Novastorm, plus the packet
// accounting change. Same approach as tests.js: the classes under test are the
// real source lines lifted out of the built userscript and run in a VM.
const fs = require("fs");
const vm = require("vm");

const FILE = process.argv[2] || __dirname + "/../RYN_v5.4.user.js";
const lines = fs.readFileSync(FILE, "utf8").split("\n");
const find = pfx => {
  const i = lines.findIndex(l => l.startsWith(pfx));
  if (i < 0) throw new Error("not found: " + pfx);
  return i;
};
const between = (startPfx, endPfx) => {
  const a = find(startPfx);
  const b = lines.findIndex((l, i) => i > a && l.startsWith(endPfx));
  if (b < 0) throw new Error("no end for " + startPfx);
  return lines.slice(a, b + 1).join("\n");
};

const parts = [
  between("  const Config = {", "  const Config_default = Config;"),
  lines.slice(find("  const ItemGroups = {"), find("  const Items = [ {")).join("\n"),
  lines.slice(find("  const Items = [ {"), find("  const WeaponVariants = [ {")).join("\n"),
  lines.slice(find("  const Hats = {"), find("  const Accessories")).join("\n"),
  between("  class Vector {", "  const Vector_default = Vector;"),
  between("  const getAngle = ", "  const PI2 = PI * 2;"),
  between("  const getAngleDist = ", "  };"),
  lines.slice(find("  class ObjectItem {"), find("  const Entity_default = Entity;") + 1).join("\n"),
  lines.slice(find("  class SpatialHashGrid2D {"), find("  class ObjectManager {")).join("\n"),
  // the units under test
  lines.slice(find("  const ANTI_INSTA_DMG_CAP"), find("  const AntiInsta_default = AntiInsta;") + 1).join("\n"),
  lines.slice(find("  const AUTOMILL_PLACE_COST"), find("  const Automill_default = Automill;") + 1).join("\n"),
];

const prelude = `
  const pointInRiver = p => { const m = Config.mapScale/2, h = Config.riverWidth/2; return p.y >= m-h && p.y <= m+h; };
  const pointInDesert = p => p.y >= Config.mapScale - Config.snowBiomeTop;
  const Logger = { error(){}, warn(){}, info(){} };
  const Settings_default = {
    _autoheal: true, _antiSmartTick: true, _safeSoldier: true, _automill: false, _autobreak: true,
  };
  const DataHandler_default = {
    getItem: id => Items[id],
    getWeapon: () => ({ range: 100, speed: 300, damage: 25 }),
    isMelee: () => true, isShootable: () => false,
    canMoveOnTop: id => "ignoreCollision" in Items[id],
  };
`;
const M = vm.runInNewContext(
  "(function(){\n" + parts.join("\n") + "\n" + prelude +
  "\nreturn { AntiInsta, Automill, Vector, Items, Hats, PlayerObject, SpatialHashGrid2D, Settings_default, ANTI_INSTA_DMG_CAP };\n})()",
  { Math, Number, Array, Set, Map, WeakMap, console, Infinity, NaN, setTimeout: () => {}, performance: { now: () => 0 } }
);

let pass = 0, fail = 0;
const check = (label, cond, detail) => {
  if (cond) { pass++; console.log("   PASS  " + label + (detail ? "  — " + detail : "")); }
  else { fail++; console.log("   FAIL  " + label + (detail ? "  — " + detail : "")); }
};
const head = (n, t) => console.log("\n" + n + ". " + t);

// ── stubs ──────────────────────────────────────────────────────────────────
const FOOD_ID = 0;   // apple, restore 20

function makeClient(over = {}) {
  const heals = [];
  const placed = [];
  const objects = new Map();
  const grid = new M.SpatialHashGrid2D(100);
  const client = {
    isOwner: true,
    ObjectManager: {
      objects, grid2D: grid,
      canPlaceItem: () => true,
    },
    PlayerManager: { isEnemyByID: (ownerID) => ownerID === 99 },
    EnemyManager: {
      nearestEnemy: null, nearestTrap: null,
      potentialDamage: 0, potentialSpikeDamage: 0,
    },
    myPlayer: {
      inGame: true, isSandbox: false, isTrapped: false, trappedIn: null,
      shameActive: false, shameCount: 0, spikeDamage: 0,
      tempHealth: 100, maxHealth: 100, hatID: 0, age: 30, scale: 35,
      tickCount: 10, damageTick: 0,
      pos: { current: new M.Vector(1000, 1000), future: new M.Vector(1000, 1000) },
      inventory: { 0: 0, 1: 10, 2: FOOD_ID, 5: 10, 4: 7, 7: 15 },
      getItemByType(t) { return this.inventory[t]; },
      getItemPlaceScale(id) { const i = M.Items[id]; return this.scale + i.scale + i.placeOffset; },
      getBuildingDamage: () => 300,
      canPlace: () => true,
      canPlaceObject: () => true,
    },
  };
  client._ModuleHandler = {
    tickCount: 10, packetCount: 0, packetLimit: 119,
    healedOnce: false, didAntiInsta: false, shouldAttack: true, placedOnce: false,
    moduleActive: false, attacking: 0, forceWeapon: null,
    placeAngles: [null, []], reverse_move_dir: 0,
    staticModules: { reloading: { isReloaded: () => true }, autoBuy: { boughtEverything: () => false } },
    heal() { heals.push(1); },
    place(type, angle) { this.packetCount += 5; placed.push({ type, angle }); },
  };
  client._heals = heals;
  client._placed = placed;
  Object.assign(client.myPlayer, over.myPlayer || {});
  Object.assign(client.EnemyManager, over.EnemyManager || {});
  return client;
}
const runHeal = over => {
  const c = makeClient(over);
  const m = new M.AntiInsta(c);
  m.postTick();
  return { heals: c._heals.length, c, m };
};

// ═══════════════════════════════════════════════════════════════════════════
head(1, "Autoheal — novastorm's damage-potential rule");
{
  // Full health, no threat, and hit this tick: nothing to do.
  const a = runHeal({ myPlayer: { tempHealth: 100, damageTick: 10, tickCount: 10 } });
  check("full health heals nothing", a.heals === 0, a.heals + " food");

  // Damaged, quiet tick: top up the whole bar. 100-60 = 40 / 20 restore = 2.
  const b = runHeal({ myPlayer: { tempHealth: 60, damageTick: 5, tickCount: 10 } });
  check("quiet tick tops the bar back up", b.heals === 2, b.heals + " food for 40 missing at 20/apple");

  // Hit this tick, no damage potential: novastorm does not heal into the hit.
  const c = runHeal({ myPlayer: { tempHealth: 60, damageTick: 11, tickCount: 10 } });
  check("no heal on the tick damage landed, with no threat", c.heals === 0, c.heals + " food");

  // Hit this tick, but their potential reaches my health: heal anyway.
  const d = runHeal({
    myPlayer: { tempHealth: 60, damageTick: 11, tickCount: 10 },
    EnemyManager: { potentialDamage: 55, potentialSpikeDamage: 20 },
  });
  check("heals when potential damage reaches health", d.heals === 2, d.heals + " food (pot 75 >= hp 60)");
  check("flagged as an anti-insta heal", d.c._ModuleHandler.didAntiInsta === true);

  // Soldier on: potential is multiplied by the hat's own dmgMult.
  const e = runHeal({
    myPlayer: { tempHealth: 60, damageTick: 11, tickCount: 10, hatID: 6 },
    EnemyManager: { potentialDamage: 60, potentialSpikeDamage: 15 },
  });
  check("soldier discounts the potential (75 x 0.75 = 56 < 60)", e.heals === 0, e.heals + " food");
  const e2 = runHeal({
    myPlayer: { tempHealth: 40, damageTick: 11, tickCount: 10, hatID: 6 },
    EnemyManager: { potentialDamage: 60, potentialSpikeDamage: 15 },
  });
  check("...but still heals when it is genuinely lethal", e2.heals === 3, e2.heals + " food");

  // Scuba bias.
  const f = runHeal({
    myPlayer: { tempHealth: 60, damageTick: 11, tickCount: 10, hatID: 7 },
    EnemyManager: { potentialDamage: 40, potentialSpikeDamage: 16 },
  });
  check("scuba adds its +5 bias (56 + 5 = 61 >= 60)", f.heals === 2, f.heals + " food");

  // The cap.
  const g = runHeal({
    myPlayer: { tempHealth: 100, maxHealth: 100, damageTick: 11, tickCount: 10 },
    EnemyManager: { potentialDamage: 500, potentialSpikeDamage: 200 },
  });
  check("potential is capped at 140, so full health never heals", g.heals === 0, "cap " + M.ANTI_INSTA_DMG_CAP);

  // Shame lockout.
  const h = runHeal({ myPlayer: { tempHealth: 50, damageTick: 11, tickCount: 10, shameCount: 7 },
                      EnemyManager: { potentialDamage: 60, potentialSpikeDamage: 0 } });
  check("shame 7 blocks the threat heal", h.heals === 0, h.heals + " food");
  const i = runHeal({ myPlayer: { tempHealth: 50, damageTick: 11, tickCount: 10, shameActive: true } });
  check("shameActive blocks everything", i.heals === 0, i.heals + " food");

  const j = runHeal({ myPlayer: { tempHealth: 50 } });
  M.Settings_default._autoheal = false;
  const k = runHeal({ myPlayer: { tempHealth: 50 } });
  M.Settings_default._autoheal = true;
  check("the toggle still gates it", j.heals > 0 && k.heals === 0, "on " + j.heals + " / off " + k.heals);
}

// ═══════════════════════════════════════════════════════════════════════════
head(2, "Anti Smart Tick — stall before committing");
{
  // I am trapped, hammer secondary, trap is one hammer swing from breaking, and
  // an enemy spike sits where the knockback would throw me.
  const build = (reloaded) => {
    const c = makeClient({
      myPlayer: { isTrapped: true, spikeDamage: 0, tempHealth: 70, damageTick: 5, tickCount: 10 },
    });
    const trap = new M.PlayerObject(1, 1000, 1000, 0, M.Items[15].scale, 15, 1);
    trap.health = 100;
    c.myPlayer.trappedIn = trap;
    c.myPlayer.getBuildingDamage = () => 300;      // hammer one-shots the trap
    const enemy = {
      id: 99, scale: 35, collisionScale: 35,
      pos: { current: new M.Vector(1150, 1000) },
    };
    c.EnemyManager.nearestEnemy = enemy;
    // Enemy spike right behind me: knockback from a spike placed on their side
    // throws me onto it.
    const spike = new M.PlayerObject(2, 830, 1000, 0, M.Items[7].scale, 7, 99);
    c.ObjectManager.objects.set(spike.id, spike);
    c.ObjectManager.grid2D.insert(830, 1000, spike.collisionScale, spike.id);
    c._ModuleHandler.staticModules.reloading = { isReloaded: t => reloaded[t] };
    const m = new M.AntiInsta(c);
    m.postTick();
    return { c, m };
  };

  const stallSec = build({ 0: true, 1: false });
  check("stalls on the secondary while it reloads", stallSec.c._ModuleHandler.forceWeapon === 1, "forceWeapon " + stallSec.c._ModuleHandler.forceWeapon);
  check("stops autobreak while stalling", stallSec.m.blockBreak === true);
  check("does not burn the anti-insta heal on a stall tick", stallSec.c._ModuleHandler.didAntiInsta === false || stallSec.c._heals.length <= 3, stallSec.c._heals.length + " food");

  const stallPri = build({ 0: false, 1: true });
  check("stalls on the primary when only that is reloading", stallPri.c._ModuleHandler.forceWeapon === 0, "forceWeapon " + stallPri.c._ModuleHandler.forceWeapon);

  const commit = build({ 0: true, 1: true });
  check("commits only when both weapons are ready", commit.c._heals.length >= 3 && commit.c._ModuleHandler.shouldAttack === false, commit.c._heals.length + " food, shouldAttack " + commit.c._ModuleHandler.shouldAttack);
  check("blockBreak is latched for the next tick", commit.m.blockBreak === true);

  // Toggle off.
  M.Settings_default._antiSmartTick = false;
  const off = build({ 0: true, 1: true });
  M.Settings_default._antiSmartTick = true;
  check("the new toggle disables it", off.m.blockBreak === false && off.c._ModuleHandler.shouldAttack === true, "blockBreak " + off.m.blockBreak);

  // Latch clears when the situation goes away.
  const clear = makeClient({ myPlayer: { tempHealth: 100 } });
  const cm = new M.AntiInsta(clear);
  cm.blockBreak = true;
  cm.postTick();
  check("latch clears once the situation is gone", cm.blockBreak === false);
}

// ═══════════════════════════════════════════════════════════════════════════
head(3, "Auto Mills — combat mill, not a sandbox grinder");
{
  const mill = (over = {}) => {
    const c = makeClient(over);
    const m = new M.Automill(c);
    m.postTick();
    return c;
  };
  M.Settings_default._automill = true;

  const outside = mill({ myPlayer: { isSandbox: false, age: 40 } });
  check("runs outside sandbox", outside._placed.length === 3, outside._placed.length + " windmills");

  const angles = outside._placed.map(p => +(p.angle * 180 / Math.PI).toFixed(1));
  check("places behind, spread by the exact offset", new Set(angles).size === 3, "angles " + angles.join(", ") + " deg");

  const trapped = mill({ myPlayer: { isTrapped: true } });
  check("does not mill while pinned", trapped._placed.length === 0, trapped._placed.length + " windmills");

  const nearTrap = mill({ EnemyManager: { nearestTrap: {} } });
  check("does not mill next to a trap", nearTrap._placed.length === 0, nearTrap._placed.length + " windmills");

  // Out of windmills: no permanent latch.
  const c = makeClient();
  const m = new M.Automill(c);
  c.myPlayer.canPlace = () => false;
  m.postTick();
  const blocked = c._placed.length;
  c.myPlayer.canPlace = () => true;
  m.postTick();
  check("recovers once windmills are available again", blocked === 0 && c._placed.length === 3, "blocked " + blocked + ", then " + c._placed.length);

  // Budget.
  const budget = makeClient();
  const bm = new M.Automill(budget);
  budget._ModuleHandler.packetCount = 112;   // 7 left of 119
  bm.postTick();
  check("respects the packet budget", budget._placed.length === 1, budget._placed.length + " windmills with 7 packets left");

  M.Settings_default._automill = false;
  const off = mill();
  check("the toggle gates it", off._placed.length === 0, off._placed.length + " windmills");
}

// ═══════════════════════════════════════════════════════════════════════════
head(4, "Packet accounting");
{
  // The transport wrapper: frames the client did not send itself must count.
  const src = fs.readFileSync(FILE, "utf8");
  const hasWatch = /_watchSocket\(socket\) \{/.test(src);
  const skipsSelf = /if \(!manager\._selfSend\) manager\.packetCount \+= 1;/.test(src);
  const limit = /packetLimit=(\d+);/.exec(src);
  check("socket send is wrapped at the transport", hasWatch);
  check("frames sent through PacketManager are not double counted", skipsSelf);
  check("budget raised to novastorm's 119", limit && limit[1] === "119", "packetLimit=" + (limit && limit[1]));

  // Simulate the wrapper.
  let count = 0, selfSend = false;
  const manager = { get packetCount() { return count; }, set packetCount(v) { count = v; }, get _selfSend() { return selfSend; } };
  const socket = { send() {} };
  const original = socket.send;
  socket.send = function(...a) { if (!manager._selfSend) manager.packetCount += 1; return original.apply(this, a); };
  socket.send("game frame");                        // the bundle's own frame
  selfSend = true; socket.send("ryn frame"); manager.packetCount += 1; selfSend = false;
  check("game frames and client frames each count once", count === 2, count + " counted for 2 frames");
}

console.log("\n" + "=".repeat(58));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(58));
process.exit(fail > 0 ? 1 : 0);
