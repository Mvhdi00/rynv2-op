// Bot auto break, ranged kiting, train formation and the server player counter.
// The classes and the formation solver are lifted out of the built userscript
// and driven against stubs, so what runs is the shipped source.
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
const span = (a, b) => lines.slice(a, b).join("\n");

const parts = [
  span(find("  const Config = {"), find("  const WeaponTypeString")),
  span(find("  const ItemGroups = {"), find("  const Items = [ {")),
  span(find("  const Items = [ {"), find("  const WeaponVariants = [ {")),
  span(find("  class Vector {"), find("  const getAngle = ") + 10),
  span(find("  class ObjectItem {"), find("  const Entity_default = Entity;") + 1),
  span(find("  class SpatialHashGrid2D {"), find("  class ObjectManager {")),
  // units under test
  span(find("  const BOT_RANGED_SECONDARIES"), find("  class Automill {")),
  // A class method cannot be evaluated standalone, so it is wrapped in an
  // object literal — the body is still the shipped source, character for
  // character.
  "const _F = {" + span(find("    getFormationOffset(botIndex"), find("    getActualPosition() {")) + "};\nconst getFormationOffset = _F.getFormationOffset;",
  span(find("  const TRAIN_SPACING"), find("  const TRAIN_SPACING") + 1),
];

const prelude = `
  const pointInRiver = () => false;
  const pointInDesert = () => false;
  const Settings_default = {
    _botAutoBreak: true, _botRangedKite: true, _botKiteDistance: 400,
    _botAutoAttackEnabled: false, _formation: "train", _circleRadius: 200,
  };
  const DataHandler_default = {
    getItem: id => Items[id],
    getWeapon: id => ({ range: id === 10 ? 275 : 110, speed: 300, damage: 25 }),
    canMoveOnTop: id => "ignoreCollision" in Items[id],
  };
`;

const M = vm.runInNewContext(
  "(function(){\n" + parts.join("\n") + "\n" + prelude +
  "\nreturn { BotAutoBreak, BotRangedAttack, BOT_RANGED_SECONDARIES, TRAIN_SPACING, getFormationOffset, Vector, Items, PlayerObject, SpatialHashGrid2D, Settings_default };\n})()",
  { Math, Number, Array, Set, Map, console, Infinity, NaN, Date }
);

let pass = 0, fail = 0;
const check = (label, cond, detail) => {
  if (cond) { pass++; console.log("   PASS  " + label + (detail ? "  — " + detail : "")); }
  else { fail++; console.log("   FAIL  " + label + (detail ? "  — " + detail : "")); }
};
const head = (n, t) => console.log("\n" + n + ". " + t);
const D = a => +(a * 180 / Math.PI).toFixed(1);

// ── stub bot ───────────────────────────────────────────────────────────────
const WALL_ID = 3;   // stone wall, destroyable, no ignoreCollision
let nextId = 1;
function makeBot(over = {}) {
  const objects = new Map();
  const grid = new M.SpatialHashGrid2D(100);
  const mh = {
    moduleActive: false, placedOnce: false, move_dir: 0,
    useAngle: null, forceWeapon: null, shouldAttack: false,
    staticModules: { reloading: { isReloaded: () => true } },
    moveTo: "disable",
    _moves: [],
    startMovement(a) { this.move_dir = a; this._moves.push(a); return true; },
  };
  const bot = {
    ObjectManager: {
      objects, grid2D: grid,
      add(x, y, type = WALL_ID) {
        const o = new M.PlayerObject(nextId++, x, y, 0, M.Items[type].scale, type, 1);
        objects.set(o.id, o); grid.insert(x, y, o.collisionScale, o.id); return o;
      },
    },
    PlayerManager: { isEnemyByID: () => true },
    EnemyManager: { nearestEnemy: null },
    myPlayer: {
      inGame: true, speed: 0, scale: 35,
      pos: { current: new M.Vector(1000, 1000), future: new M.Vector(1000, 1000) },
      inventory: { 0: 5, 1: 10 },
      getItemByType(t) { return this.inventory[t]; },
    },
    _ModuleHandler: mh,
    ownerClient: { _ModuleHandler: { attacking: 0, attackingState: 0 } },
  };
  Object.assign(bot.myPlayer, over.myPlayer || {});
  Object.assign(mh, over.mh || {});
  return bot;
}

// ═══════════════════════════════════════════════════════════════════════════
head(1, "Bot Auto Break — swings only when something is actually holding it");
{
  const bot = makeBot();
  const m = new M.BotAutoBreak(bot);
  bot.ObjectManager.add(1080, 1000);          // wall dead ahead

  // Moving normally: no swing, however many walls are about.
  bot.myPlayer.speed = 40;
  for (let i = 0; i < 6; i++) m.postTick();
  check("a moving bot never swings", bot._ModuleHandler.shouldAttack === false, "speed 40");

  // Told to move, not moving: swing, but only after the grace ticks.
  bot.myPlayer.speed = 0;
  m.postTick();
  const afterOne = bot._ModuleHandler.shouldAttack;
  m.postTick();
  m.postTick();
  check("one stalled tick is not enough", afterOne === false);
  check("three stalled ticks trigger the break", bot._ModuleHandler.shouldAttack === true, "stuckTicks " + m.stuckTicks);
  check("aimed at the wall", Math.abs(D(bot._ModuleHandler.useAngle)) < 5, D(bot._ModuleHandler.useAngle) + " deg");

  // Not asked to move at all: standing still is not stuck.
  const idle = makeBot({ mh: { move_dir: null } });
  const im = new M.BotAutoBreak(idle);
  idle.ObjectManager.add(1080, 1000);
  idle.myPlayer.speed = 0;
  for (let i = 0; i < 6; i++) im.postTick();
  check("a bot nobody told to move is not stuck", idle._ModuleHandler.shouldAttack === false);

  // Nothing in reach: no swing even when stalled.
  const clear = makeBot();
  const cm = new M.BotAutoBreak(clear);
  clear.myPlayer.speed = 0;
  for (let i = 0; i < 6; i++) cm.postTick();
  check("stalled in open ground does not swing at nothing", clear._ModuleHandler.shouldAttack === false);

  // Toggle.
  M.Settings_default._botAutoBreak = false;
  const off = makeBot();
  const om = new M.BotAutoBreak(off);
  off.ObjectManager.add(1080, 1000);
  off.myPlayer.speed = 0;
  for (let i = 0; i < 6; i++) om.postTick();
  M.Settings_default._botAutoBreak = true;
  check("the toggle gates it", off._ModuleHandler.shouldAttack === false);
}

head(2, "Bot Auto Break — Sakuna's fullest-direction pick");
{
  // Three walls clustered east, one lone wall west. Sakuna swings at the
  // cluster, not at whichever happens to be nearest.
  const bot = makeBot();
  const m = new M.BotAutoBreak(bot);
  bot.ObjectManager.add(1075, 990);
  bot.ObjectManager.add(1075, 1010);
  bot.ObjectManager.add(1080, 1000);
  bot.ObjectManager.add(930, 1000);           // lone one, and closer
  bot.myPlayer.speed = 0;
  for (let i = 0; i < 3; i++) m.postTick();
  const aim = D(bot._ModuleHandler.useAngle);
  check("swings at the cluster, not the lone wall", Math.abs(aim) < 30, "aim " + aim + " deg (cluster east, lone west)");

  // Great hammer in the secondary is what it breaks with, per Sakuna.
  check("uses the great hammer when it has one", bot._ModuleHandler.forceWeapon === 1, "forceWeapon " + bot._ModuleHandler.forceWeapon);
  const noHammer = makeBot({ myPlayer: { inventory: { 0: 5, 1: 9 } } });
  const nm = new M.BotAutoBreak(noHammer);
  noHammer.ObjectManager.add(1080, 1000);
  noHammer.myPlayer.speed = 0;
  for (let i = 0; i < 3; i++) nm.postTick();
  check("falls back to the primary without one", noHammer._ModuleHandler.forceWeapon === 0, "forceWeapon " + noHammer._ModuleHandler.forceWeapon);
}

// ═══════════════════════════════════════════════════════════════════════════
head(3, "Bot Ranged Kiting");
{
  const withEnemy = (dist, secondary = 9, attacking = 1) => {
    const bot = makeBot({ myPlayer: { inventory: { 0: 5, 1: secondary } } });
    bot.ownerClient._ModuleHandler.attacking = attacking;
    bot.EnemyManager.nearestEnemy = {
      collisionScale: 35,
      pos: { current: new M.Vector(1000 + dist, 1000), future: new M.Vector(1000 + dist, 1000) },
    };
    const m = new M.BotRangedAttack(bot);
    m.postTick();
    return { bot, m };
  };

  check("bow, crossbow, repeater and musket all count", [9, 12, 13, 15].every(w => M.BOT_RANGED_SECONDARIES.has(w)) && ![10, 11, 14].some(w => M.BOT_RANGED_SECONDARIES.has(w)));

  const tooClose = withEnemy(150);
  check("too close: backs away from the enemy", Math.abs(D(tooClose.bot._ModuleHandler.move_dir)) > 170, "heading " + D(tooClose.bot._ModuleHandler.move_dir) + " deg (enemy is due east)");

  const tooFar = withEnemy(900);
  check("too far: closes in", Math.abs(D(tooFar.bot._ModuleHandler.move_dir)) < 10, "heading " + D(tooFar.bot._ModuleHandler.move_dir) + " deg");

  const inBand = withEnemy(400);
  check("in the band: stands and shoots", inBand.bot._ModuleHandler.move_dir === null, "move_dir " + inBand.bot._ModuleHandler.move_dir);
  check("aims at the enemy", Math.abs(D(inBand.bot._ModuleHandler.useAngle)) < 1, D(inBand.bot._ModuleHandler.useAngle) + " deg");
  check("fires the secondary", inBand.bot._ModuleHandler.forceWeapon === 1 && inBand.bot._ModuleHandler.shouldAttack === true);
  check("claims the tick so movement stands aside", inBand.m.active === true);

  // Holding the band must not spam move packets.
  const hold = withEnemy(400);
  const before = hold.bot._ModuleHandler._moves.length;
  for (let i = 0; i < 8; i++) hold.m.postTick();
  check("does not re-send stop every tick", hold.bot._ModuleHandler._moves.length === before, before + " move packets over 9 ticks in band");

  const melee = withEnemy(400, 10);
  check("a melee secondary does not kite", melee.m.active === false, "great hammer");

  const idle = withEnemy(400, 9, 0);
  check("does nothing until the owner attacks", idle.m.active === false);

  // The distance is the one from the slider: 400px away is "in the band" at a
  // 400px setting and "too close" at an 800px setting, from the same position.
  const atDefault = withEnemy(400);
  M.Settings_default._botKiteDistance = 800;
  const atWide = withEnemy(400);
  M.Settings_default._botKiteDistance = 400;
  check("the slider sets the distance",
        atDefault.bot._ModuleHandler.move_dir === null && Math.abs(D(atWide.bot._ModuleHandler.move_dir)) > 170,
        "same 400px gap: holds at a 400 setting, backs off to " + D(atWide.bot._ModuleHandler.move_dir) + " deg at an 800 setting");
}

// ═══════════════════════════════════════════════════════════════════════════
head(4, "Train formation");
{
  const off = (i, n, facing) => M.getFormationOffset.call({}, i, n, 0, 200, facing);
  const a = off(0, 5, 0), b = off(1, 5, 0), c = off(2, 5, 0);
  check("each bot sits directly behind the last", [a, b, c].every(o => Math.abs(o.dy) < 1e-9), "dy " + [a, b, c].map(o => o.dy.toFixed(2)).join(", "));
  check("spacing is constant", Math.abs((b.dx - a.dx) - (c.dx - b.dx)) < 1e-9 && Math.abs(b.dx - a.dx) === M.TRAIN_SPACING, M.TRAIN_SPACING + "px apart");
  check("the line trails behind, not in front", a.dx < 0 && b.dx < a.dx, "dx " + [a, b, c].map(o => o.dx.toFixed(0)).join(", ") + " with facing east");

  // Spacing must not shrink as bots are added — that is what column does.
  const many = [off(0, 40, 0), off(1, 40, 0)];
  check("spacing holds with 40 bots", Math.abs((many[1].dx - many[0].dx)) === M.TRAIN_SPACING, "still " + M.TRAIN_SPACING + "px");
  const col = (i, n) => M.getFormationOffset.call({}, i, n, 0, 200, 0);
  M.Settings_default._formation = "column";
  const c5 = col(1, 5).dy - col(0, 5).dy, c40 = col(1, 40).dy - col(0, 40).dy;
  M.Settings_default._formation = "train";
  check("...unlike column, which squeezes", Math.abs(c40) < Math.abs(c5), "column gap " + c5.toFixed(0) + "px at 5 bots vs " + c40.toFixed(0) + "px at 40");

  // The train turns with the player.
  const north = off(0, 5, Math.PI / 2);
  check("the line rotates to follow the heading", Math.abs(north.dx) < 1e-9 && north.dy < 0, "heading north puts carriage 1 at dy " + north.dy.toFixed(0));
}

// ═══════════════════════════════════════════════════════════════════════════
head(5, "Server player counter");
{
  check("a PLAYERS row sits above FPS in the panel",
        src.indexOf('id="rynPlayers"') > 0 && src.indexOf('id="rynPlayers"') < src.indexOf('id="rynFPS"'));
  check("there is an updater for it", /updatePlayers\(text\) \{/.test(src));
  check("it polls rather than reading the load-time snapshot", /setInterval\(_rynPollServerCount/.test(src));
  check("it identifies the server from the tab's own query", /new URLSearchParams\(location\.search\)\.get\("server"\)/.test(src));
  check("sandbox uses the sandbox api", /api-sandbox\.moomoo\.io/.test(src));
  check("it falls back to the browser label, then to ?", /_rynBrowserFallback/.test(src) && /"\?" : fallback/.test(src));

  // The label parser.
  const re = /\[(\d+)\/(\d+)\]/;
  const m = re.exec("EU Frankfurt 1 [42/50] [31ms]");
  check("the fallback parses the browser's [n/m] label", m && m[1] === "42" && m[2] === "50", m ? m[1] + "/" + m[2] : "no match");
}

// ═══════════════════════════════════════════════════════════════════════════
head(6, "Auto Place / Preplace / Replace still untouched");
{
  const base = fs.readFileSync(__dirname + "/../src/RYN_Client_v5.3.js", "utf8");
  const slice = t => t.slice(t.indexOf("  const LUNA_SPIKE_TYPE"), t.indexOf("  const AutoPlacer_default = AutoPlacer;"));
  check("the placer is byte-identical to stock v5.3", slice(src) === slice(base), slice(src).split("\n").length + " lines compared");
}

console.log("\n" + "=".repeat(58));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(58));
process.exit(fail > 0 ? 1 : 0);
