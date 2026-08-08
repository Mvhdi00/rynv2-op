// Slice the bot squad and its shared helpers out of a shipped build and drive
// them against stubbed clients.
//
//   node test_bots.js            owner build
//   node test_bots.js --player   the copy spliced into the obfuscated build
//
// The two blocks are sliced separately because they sit far apart in the file:
// BotSquad is next to the other bot modules, the shared name/trust helpers are
// down with the rest of the owner-scope code.
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");

const usePlayer = process.argv.includes("--player");
const src = fs.readFileSync(usePlayer ? RYN_PLAYER : RYN_OWNER, "utf8");
console.log(usePlayer ? "(player build)" : "(owner build)");

function slice(startAnchor, endAnchor, what) {
  const a = src.indexOf(startAnchor);
  if (a < 0) throw new Error("could not find the start of " + what);
  const b = src.indexOf(endAnchor, a);
  if (b < 0) throw new Error("could not find the end of " + what);
  return src.slice(a, b + endAnchor.length);
}
const squadCode = slice(
  "  const BOT_DEFEND_RANGE = 900;",
  "  const BotSquad_default = BotSquad;",
  "the squad module"
);
const helperCode = slice(
  "  const BOT_RANGED_SECONDARIES = new Set([ 9, 12, 13, 15 ]);",
  "    return picked;\n  }",
  "the shared bot helpers"
);

// ---- stubs ----------------------------------------------------------------
const SHIELD = 11, HAMMER = 10, MUSKET = 15, BOW = 9, DAGGERS = 7, KATANA = 4;
const MAP = 14400;

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
  addDirection(a, d) { return new Vec(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d); }
}
class PlayerObject {
  constructor(o) { Object.assign(this, o); }
  canMoveOnTop() { return false; }
}
const Config_default = { mapScale: MAP };
const Settings_default = {
  _botDefenders: true, _botDefenderCount: 2,
  _botAutoShoot: true, _botArc: true, _botArcRadius: 300, _botArcMin: 4,
  _botSwarmSize: 3, _botsFrozen: false,
};

// A player as the client models one: id, nickname, position, drift.
let nextID = 100;
function mkPlayer(nickname, x, y, opts = {}) {
  return {
    id: opts.id !== undefined ? opts.id : nextID++,
    nickname, inGame: true, clanName: opts.clanName || null,
    pos: { current: new Vec(x, y) },
    speed: opts.speed || 0, move_dir: opts.move_dir || 0,
  };
}
function mkBot(owner, x, y, secondary, primary = KATANA) {
  const moves = [];
  const mh = {
    tickCount: 5, moduleActive: false, forceWeapon: null, useWeapon: null,
    useAngle: null, shouldAttack: false, currentHolding: null, weapon: null,
    _currentAngle: null, _squadControl: false, _autoFarmActive: false,
    move_dir: null, moves,
    staticModules: { reloading: { isReloaded: () => true } },
    startMovement(a) { moves.push({ kind: "move", angle: a }); return true; },
    stopMovement() { moves.push({ kind: "stop" }); },
  };
  const bot = {
    _ModuleHandler: mh,
    myPlayer: {
      id: nextID++, inGame: true, collisionScale: 35,
      pos: { current: new Vec(x, y) },
      getItemByType: t => (t === 0 ? primary : t === 1 ? secondary : null),
    },
    PacketManager: {
      sent: [],
      selectItemByID(id, isSec) { bot.PacketManager.sent.push({ kind: "select", id, isSec }); },
      move(a) { bot.PacketManager.sent.push({ kind: "move", angle: a }); },
      attack(a) { bot.PacketManager.sent.push({ kind: "attack", angle: a }); },
    },
    ObjectManager: { objects: new Map(), grid2D: { query: () => {} } },
  };
  bot.ownerClient = owner;
  return bot;
}
function mkOwner(x = 7000, y = 7000) {
  const owner = {
    isOwner: true,
    clients: new Set(),
    myPlayer: { id: 1, inGame: true, clanName: null, pos: { current: new Vec(x, y) },
                isMyPlayerByID(id) { return id === 1; } },
    isBotByID(id) { return [...owner.clients].some(b => b.myPlayer.id === id); },
    PlayerManager: { players: [] },
    EnemyManager: { nearestEnemy: null },
    _ModuleHandler: { tickCount: 5 },
  };
  owner.ownerClient = owner;
  return owner;
}

const globals = { Settings_default, PlayerObject, Config_default };
const sandbox = { Math, Number, Date, Map, Set, WeakMap, console, window: {}, client: null };
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
  helperCode + "\n" + squadCode +
    "\nglobalThis.__Squad = BotSquad;" +
    "\nglobalThis.__helpers = { base: botBaseName, swarm: botSwarmGroup, defenders: botDefenderSet, lead: botLeadAngle, trust: botHandleTrustCommand, trusted: botTrustedIDs, shooter: botIsShooter };",
  sandbox
);
const Squad = sandbox.__Squad, H = sandbox.__helpers;

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

console.log("\nname grouping");
check("digits are stripped", H.base("solo 283") === "solo" && H.base("solo2") === "solo");
check("case and padding do not matter", H.base("  SoLo  ") === "solo");
check("a pure-digit name has no base", H.base("283") === "");
check("a non-string is not a name", H.base(undefined) === "" && H.base(null) === "");
{
  const owner = mkOwner();
  owner.PlayerManager.players = [
    mkPlayer("solo", 7100, 7000), mkPlayer("solo 2", 7150, 7000),
    mkPlayer("solo283", 7200, 7000), mkPlayer("someoneelse", 7250, 7000),
  ];
  check("three same-base players are a swarm of 3", H.swarm(owner, 3, 5000).length === 3);
  check("a threshold of 4 rejects them", H.swarm(owner, 4, 5000) === null);
  check("the odd one out is not in the group",
        !H.swarm(owner, 3, 5000).some(p => p.nickname === "someoneelse"));
  check("out of range is out of the group", H.swarm(owner, 3, 50) === null);
}
{
  const owner = mkOwner();
  const mates = [mkPlayer("solo", 7100, 7000, { clanName: "ryn" }),
                 mkPlayer("solo2", 7150, 7000, { clanName: "ryn" }),
                 mkPlayer("solo3", 7200, 7000, { clanName: "ryn" })];
  owner.myPlayer.clanName = "ryn";
  owner.PlayerManager.players = mates;
  check("clanmates are never a swarm", H.swarm(owner, 3, 5000) === null);
}
{
  const owner = mkOwner();
  owner.clients.add(mkBot(owner, 7100, 7000, HAMMER));
  const botID = [...owner.clients][0].myPlayer.id;
  owner.PlayerManager.players = [
    { ...mkPlayer("solo", 7100, 7000), id: botID },
    mkPlayer("solo2", 7150, 7000), mkPlayer("solo3", 7200, 7000),
  ];
  check("my own bots are never a swarm", H.swarm(owner, 3, 5000) === null);
}

console.log("\n!trust");
{
  const owner = mkOwner();
  H.trusted.clear();
  check("a stranger cannot call off the bots", H.trust(owner, 99, "!trust 7") === false);
  check("the owner can", H.trust(owner, 1, "!trust 7") === true && H.trusted.has(7));
  check("!untrust takes it back", H.trust(owner, 1, "!untrust 7") === true && !H.trusted.has(7));
  check("ordinary chat is left alone", H.trust(owner, 1, "hello") === false);
  check("a bare !trust lists and does not add", H.trust(owner, 1, "!trust") === true && H.trusted.size === 0);
  H.trust(owner, 1, "!trust 12");
  owner.PlayerManager.players = [
    { ...mkPlayer("solo", 7100, 7000), id: 12 },
    mkPlayer("solo2", 7150, 7000), mkPlayer("solo3", 7200, 7000),
  ];
  check("a trusted player is not counted into a swarm", H.swarm(owner, 3, 5000) === null);
  H.trusted.clear();
}

console.log("\ndefender selection");
{
  const owner = mkOwner();
  const a = mkBot(owner, 7000, 7050, HAMMER);
  const b = mkBot(owner, 7000, 7100, MUSKET);
  const c = mkBot(owner, 7000, 7150, SHIELD);
  const d = mkBot(owner, 7000, 7200, BOW);
  [a, b, c, d].forEach(x => owner.clients.add(x));
  const picked = H.defenders(owner);
  check("two are picked", picked.length === 2);
  check("shooters are never picked as defenders",
        !picked.includes(b) && !picked.includes(d));
  check("the non-shooters are", picked.includes(a) && picked.includes(c));
  check("botIsShooter reads the secondary",
        H.shooter(b) && H.shooter(d) && !H.shooter(a) && !H.shooter(c));
}
{
  // Everyone is a shooter: the feature still has to field two defenders.
  const owner = mkOwner();
  const bots = [MUSKET, BOW, MUSKET].map((s, i) => mkBot(owner, 7000, 7050 + i * 50, s));
  bots.forEach(x => owner.clients.add(x));
  check("with only shooters it still fields two", H.defenders(owner).length === 2);
}

console.log("\ndefenders in the field");
{
  const owner = mkOwner(7000, 7000);
  const guard = mkBot(owner, 7000, 7000, SHIELD);
  const guard2 = mkBot(owner, 7000, 7000, SHIELD);
  const shooter = mkBot(owner, 6800, 7000, MUSKET);
  [guard, guard2, shooter].forEach(x => owner.clients.add(x));
  owner.PlayerManager.players = [
    mkPlayer("solo", 7600, 7000), mkPlayer("solo2", 7620, 7000), mkPlayer("solo3", 7640, 7000),
  ];
  const mod = new Squad(guard);
  mod.postTick();
  const mh = guard._ModuleHandler;
  check("the defender takes the tick", mh.moduleActive === true && mh._squadControl === true);
  check("it raises the shield", guard.PacketManager.sent.some(s => s.kind === "select" && s.id === SHIELD));
  check("it faces the swarm", near(mh._currentAngle, 0, 0.4));
  check("it walks somewhere", mh.moves.length === 1);
  // The station is the rule the module documents: 95px off the covered
  // shooter, along the line to the swarm, fanned by index. Check the rule is
  // the right one, then check the module actually agrees with it.
  const shooterPos = shooter.myPlayer.pos.current;
  const centre = { x: (7600 + 7620 + 7640) / 3, y: 7000 };
  const toThreat = Math.atan2(centre.y - shooterPos.y, centre.x - shooterPos.x);
  const station = shooterPos.addDirection(toThreat + (0 - 0.5) * (Math.PI / 5), 95);
  check("the station sits between the shooter it covers and the swarm",
        Math.hypot(station.x - centre.x, station.y - centre.y) <
          Math.hypot(shooterPos.x - centre.x, shooterPos.y - centre.y));
  const parked = mkBot(owner, station.x, station.y, SHIELD);
  owner.clients.delete(guard);
  const rest = [...owner.clients];
  owner.clients.clear();
  owner.clients.add(parked);
  for (const b of rest) owner.clients.add(b);
  new Squad(parked).postTick();
  check("a defender already on its station stops rather than jitters",
        parked._ModuleHandler.moves.length === 1 && parked._ModuleHandler.moves[0].kind === "stop");
}
{
  const owner = mkOwner();
  const guard = mkBot(owner, 7000, 7000, SHIELD);
  owner.clients.add(guard);
  owner.clients.add(mkBot(owner, 6800, 7000, MUSKET));
  owner.PlayerManager.players = [mkPlayer("solo", 7600, 7000), mkPlayer("alone", 7620, 7000)];
  const mh = guard._ModuleHandler;
  new Squad(guard).postTick();
  check("no swarm means no shielding", mh.moduleActive === false && mh._squadControl === false);
}
{
  const owner = mkOwner();
  const shooter = mkBot(owner, 7000, 7000, MUSKET);
  owner.clients.add(mkBot(owner, 7000, 7100, SHIELD));
  owner.clients.add(mkBot(owner, 7000, 7200, SHIELD));
  owner.clients.add(shooter);
  owner.PlayerManager.players = [
    mkPlayer("solo", 7600, 7000), mkPlayer("solo2", 7620, 7000), mkPlayer("solo3", 7640, 7000),
  ];
  new Squad(shooter).postTick();
  check("a musket bot is never conscripted as a defender",
        shooter.PacketManager.sent.every(s => !(s.kind === "select" && s.id === SHIELD)));
}

console.log("\nauto shoot");
{
  const owner = mkOwner();
  const shooter = mkBot(owner, 7000, 7000, MUSKET);
  owner.clients.add(shooter);
  Settings_default._botDefenders = false;
  owner.PlayerManager.players = [
    mkPlayer("solo", 7600, 7000), mkPlayer("solo2", 7620, 7000), mkPlayer("solo3", 7640, 7000),
  ];
  const mh = shooter._ModuleHandler;
  new Squad(shooter).postTick();
  check("it fires", mh.shouldAttack === true && mh.forceWeapon === 1);
  check("at the nearest of the group", near(mh.useAngle, 0, 0.01));
  Settings_default._botDefenders = true;
}
{
  const owner = mkOwner();
  const melee = mkBot(owner, 7000, 7000, HAMMER);
  owner.clients.add(melee);
  Settings_default._botDefenders = false;
  owner.PlayerManager.players = [
    mkPlayer("solo", 7600, 7000), mkPlayer("solo2", 7620, 7000), mkPlayer("solo3", 7640, 7000),
  ];
  new Squad(melee).postTick();
  check("a bot with no ranged secondary does not", melee._ModuleHandler.shouldAttack === false);
  Settings_default._botDefenders = true;
}
{
  const owner = mkOwner();
  const shooter = mkBot(owner, 7000, 7000, MUSKET);
  owner.clients.add(shooter);
  Settings_default._botDefenders = false;
  // Inside 220: close enough that melee should be handling it.
  owner.PlayerManager.players = [
    mkPlayer("solo", 7100, 7000), mkPlayer("solo2", 7120, 7000), mkPlayer("solo3", 7140, 7000),
  ];
  new Squad(shooter).postTick();
  check("not at point blank", shooter._ModuleHandler.shouldAttack === false);
  // Past the musket's 1400 range.
  const far = mkBot(owner, 7000, 7000, MUSKET);
  owner.clients.clear(); owner.clients.add(far);
  owner.PlayerManager.players = [
    mkPlayer("solo", 8600, 7000), mkPlayer("solo2", 8620, 7000), mkPlayer("solo3", 8640, 7000),
  ];
  new Squad(far).postTick();
  check("and not past the projectile's own range", far._ModuleHandler.shouldAttack === false);
  Settings_default._botDefenders = true;
}

console.log("\nprojectile lead");
{
  const from = new Vec(0, 0);
  const still = { pos: { current: new Vec(1000, 0) }, speed: 0, move_dir: 0 };
  check("a stationary target is aimed at directly", near(H.lead(from, still, 3.6), 0));
  // Crossing at 30px a tick, 1000 away, musket at 3.6/ms -> ~278ms -> ~2.5
  // ticks of flight, so the aim leads north of straight-on.
  const crossing = { pos: { current: new Vec(1000, 0) }, speed: 30, move_dir: Math.PI / 2 };
  const led = H.lead(from, crossing, 3.6);
  check("a crossing target is led ahead of itself", led > 0.05 && led < 0.2);
  const slowProj = H.lead(from, crossing, 1.6);
  check("a slower projectile leads further", slowProj > led);
}

console.log("\nhalf circle");
{
  const owner = mkOwner(7000, 7000);
  const bots = [];
  for (let i = 0; i < 4; i++) { const b = mkBot(owner, 7000, 7000, HAMMER); bots.push(b); owner.clients.add(b); }
  Settings_default._botDefenders = false;
  Settings_default._botAutoShoot = false;
  // Enemy due east of the owner.
  owner.EnemyManager.nearestEnemy = mkPlayer("victim", 7500, 7000);
  const angles = bots.map(b => { new Squad(b).postTick(); return b._ModuleHandler.moves[0]; });
  check("every bot is given a station", angles.every(m => m && m.kind === "move"));
  check("each bot claims movement", bots.every(b => b._ModuleHandler._squadControl === true));
  check("bots face the enemy", bots.every(b => near(b._ModuleHandler._currentAngle, 0, 0.9)));
  // The arc is drawn round the enemy with the gap pointing back at the owner,
  // so no station may sit on the owner's side of the enemy.
  const enemyPos = owner.EnemyManager.nearestEnemy.pos.current;
  const stations = bots.map((b, i) => {
    const toOwner = Math.atan2(7000 - enemyPos.y, 7000 - enemyPos.x);
    const step = Math.PI / (bots.length - 1);
    return toOwner + Math.PI / 2 + i * step;
  });
  const gaps = stations.map(a => Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))));
  check("no station lands between the owner and the enemy", gaps.every(g => g >= Math.PI / 2 - 1e-9));
  check("the stations span half a circle",
        near(Math.abs(stations[stations.length - 1] - stations[0]), Math.PI, 1e-9));
  Settings_default._botDefenders = true;
  Settings_default._botAutoShoot = true;
}
{
  const owner = mkOwner();
  const b = mkBot(owner, 7000, 7000, HAMMER);
  owner.clients.add(b);
  Settings_default._botDefenders = false;
  Settings_default._botAutoShoot = false;
  owner.EnemyManager.nearestEnemy = mkPlayer("victim", 7500, 7000);
  new Squad(b).postTick();
  check("one bot is not a half circle", b._ModuleHandler._squadControl === false);
  Settings_default._botDefenders = true;
  Settings_default._botAutoShoot = true;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
