// Behaviour tests for the four features ported from Novastorm, plus the packet
// accounting change. Same approach as tests.js: the classes under test are the
// real source lines lifted out of the built userscript and run in a VM.
const fs = require("fs");
const vm = require("vm");

const FILE = process.argv[2] || __dirname + "/../RYN_v5.4.user.js";
const src = fs.readFileSync(FILE, "utf8");
const lines = src.split("\n");
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
  // the unit under test
  lines.slice(find("  const AUTOMILL_PLACE_COST"), find("  const Automill_default = Automill;") + 1).join("\n"),
];

const prelude = `
  const pointInRiver = p => { const m = Config.mapScale/2, h = Config.riverWidth/2; return p.y >= m-h && p.y <= m+h; };
  const pointInDesert = p => p.y >= Config.mapScale - Config.snowBiomeTop;
  const Logger = { error(){}, warn(){}, info(){} };
  const Settings_default = {
    _automill: false, _autobreak: true,
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
  "\nreturn { Automill, Vector, Items, Hats, PlayerObject, SpatialHashGrid2D, Settings_default };\n})()",
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
    SocketManager: { pong: 40 },
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
head(1, "Reverted: autoheal, anti smart tick and safe soldier are back to stock");
{
  const base = fs.readFileSync(__dirname + "/../src/RYN_Client_v5.3.js", "utf8");
  const region = (t, a, b) => { const i = t.indexOf(a); return t.slice(i, t.indexOf(b, i)); };

  // AntiInsta carries both the autoheal cascade and antiSmartTick.
  check("AntiInsta is byte-identical to v5.3",
        region(src, "  class AntiInsta {", "  const AntiInsta_default = AntiInsta;") ===
        region(base, "  class AntiInsta {", "  const AntiInsta_default = AntiInsta;"),
        region(base, "  class AntiInsta {", "  const AntiInsta_default = AntiInsta;").split("\n").length + " lines");

  check("Autobreak is byte-identical to v5.3",
        region(src, "  class Autobreak {", "  class AutoPush {") ===
        region(base, "  class Autobreak {", "  class AutoPush {"),
        "the anti-smart-tick latch guard is gone with it");

  check("the soldier equip block is byte-identical to v5.3",
        region(src, "      const _canSoldier = this.canBuy(0, 6);", "      this.attackingState = this.attacking;") ===
        region(base, "      const _canSoldier = this.canBuy(0, 6);", "      this.attackingState = this.attacking;"));

  for (const tok of ["_safeSoldier", "_antiSmartTick", "SAFE_SOLDIER_RANGE", "ANTI_INSTA_DMG_CAP", "ANTI_INSTA_SCUBA_BIAS", "blockBreak", "_healSent", "_healsInFlight"]) {
    check("no trace of " + tok, src.indexOf(tok) === -1, src.split(tok).length - 1 + " occurrences");
  }
  check("and no Safe Soldier or Anti Smart Tick row in the menu",
        !/Safe Soldier/.test(src) && !/Anti Smart Tick/.test(src));
}

head(2, "Auto Mills — combat mill, not a sandbox grinder");
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
head(3, "Packet accounting");
{
  // The transport wrapper: frames the client did not send itself must count.
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
