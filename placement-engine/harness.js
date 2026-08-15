// Test harness: pulls the real engine source out of the built client and runs
// it against synthetic combat scenarios. Nothing is reimplemented — the Vector
// class, the item tables, the spatial grid, PlayerObject and the whole
// placement engine are the exact source lines that ship in the file.
const fs = require("fs");
const vm = require("vm");

const src = fs.readFileSync(process.argv[2] || __dirname + "/../RYN_v5.4_Placement.user.js", "utf8");
const lines = src.split("\n");

// Source blocks lifted verbatim by line range, then asserted so the harness
// fails loudly if the file is edited and the ranges drift.
function span(from, to, firstMustStartWith) {
  const block = lines.slice(from - 1, to);
  if (!block[0].startsWith(firstMustStartWith)) {
    throw new Error(`range ${from}-${to} starts with ${JSON.stringify(block[0])}, expected ${JSON.stringify(firstMustStartWith)}`);
  }
  return block.join("\n");
}

const engineStart = lines.findIndex(l => l.startsWith("  const RPE_SPIKE_TYPE")) + 1;
const engineEnd = lines.findIndex(l => l.startsWith("  const AutoPlacer_default = AutoPlacer;"));

const parts = [
  span(307, 360, "  const Config = {"),
  span(725, 794, "  const ItemGroups = {"),
  span(795, 1245, "  const Items = [ {"),
  span(1334, 1429, "  class Vector {"),
  span(1430, 1439, "  const getAngle = "),
  span(2394, 2574, "  class ObjectItem {"),
  span(5322, 5423, "  class SpatialHashGrid2D {"),
  span(engineStart, engineEnd, "  const RPE_SPIKE_TYPE"),
];

const prelude = `
  const pointInRiver = p => {
    const mid = Config.mapScale / 2, h = Config.riverWidth / 2;
    return p.y >= mid - h && p.y <= mid + h;
  };
  const pointInDesert = p => p.y >= Config.mapScale - Config.snowBiomeTop;
  const getAngleFromBitmask = () => 0;
  const Settings_default = {
    _autoplacer: true, _prePlace: true, _replace: true, _autoplacerRadius: 350,
  };
  const DataHandler_default = {
    getItem: id => Items[id],
    getWeapon: id => ({ range: 100, speed: 300, damage: 25 }),
    canMoveOnTop: id => "ignoreCollision" in Items[id],
  };
`;

const code = "(function(){\n" + parts.join("\n") + "\n" + prelude +
  "\nreturn { AutoPlacer, RpeTrack, Vector, Items, ItemGroups, PlayerObject, SpatialHashGrid2D, Settings_default, getAngleDist, Config, rpeSpikeTickBusy };\n})()";

const M = vm.runInNewContext(code, { Math, Number, Array, Set, Map, WeakMap, console, Infinity, NaN, setTimeout: () => {}, performance: { now: () => 0 } });

// ── minimal client stub ────────────────────────────────────────────────────
const SPIKE_ID = 7;   // greater spikes: scale 52, placeOffset -5, group 2
const TRAP_ID = 15;   // trap
let nextId = 1;

class World {
  constructor() {
    this.objects = new Map();
    this.grid2D = new M.SpatialHashGrid2D(100);
    this.deletedObjects = new Set();
  }
  add(type, x, y, ownerID) {
    const item = M.Items[type];
    const o = new M.PlayerObject(nextId++, x, y, 0, item.scale, type, ownerID);
    this.objects.set(o.id, o);
    this.grid2D.insert(x, y, o.collisionScale, o.id);
    return o;
  }
  canPlaceItem(id, position, addRadius = 0) {
    if (id !== 18 && position.y >= M.Config.mapScale / 2 - M.Config.riverWidth / 2 && position.y <= M.Config.mapScale / 2 + M.Config.riverWidth / 2) return false;
    const item = M.Items[id];
    return !this.grid2D.query(position.x, position.y, 1, id2 => {
      const object = this.objects.get(id2);
      return position.distance(object.pos.current) < item.scale + object.placementScale + addRadius;
    });
  }
  getBestPlacementAngles() { return []; }
}

class Ent {
  constructor(id, x, y, scale = 35) {
    this.id = id;
    this.scale = scale;
    this.pos = { previous: new M.Vector(x, y), current: new M.Vector(x, y), future: new M.Vector(x, y) };
    this.speed = 0; this.move_dir = 0;
    this.isTrapped = false; this.trappedIn = null; this.spikeDamage = 0;
    this.reload = [{ current: 0, max: 3, previous: 0 }, { current: 0, max: 3, previous: 0 }, { current: 0, max: 23, previous: 0 }];
    this.weapon = { primary: 0, secondary: null };
    this.hatID = 0; this.inGame = true; this.isSandbox = false;
    this.itemCount = new Map();
    this.inventory = { 0: 0, 1: null, 2: 0, 4: SPIKE_ID, 7: TRAP_ID };
    this.resources = { food: 999, wood: 999, stone: 999, gold: 999 };
  }
  get collisionScale() { return this.scale; }
  get hitScale() { return this.scale * 1.8; }
  moveTo(x, y) {
    this.pos.previous.setVec(this.pos.current);
    this.pos.current._setXY(x, y);
    const d = this.pos.previous.distance(this.pos.current);
    this.speed = d;
    this.move_dir = this.pos.previous.angle(this.pos.current);
    this.pos.future.setVec(this.pos.current.addDirection(this.move_dir, d));
  }
  getItemByType(t) { return this.inventory[t]; }
  getItemPlaceScale(id) { const i = M.Items[id]; return this.scale + i.scale + i.placeOffset; }
  getItemCount(group) { return { count: this.itemCount.get(group) || 0, limit: M.ItemGroups[group].limit }; }
  canPlace(type) {
    const id = this.inventory[type];
    if (id === null || id === undefined) return false;
    const g = M.Items[id].itemGroup;
    const { count, limit } = this.getItemCount(g);
    return count < limit;
  }
  isReloaded() { return true; }
  getBuildingDamage() { return 25; }
}

function makeClient(world) {
  const placed = [];
  const client = {
    ObjectManager: world,
    SocketManager: { pong: 40, minPingTime: 30 },
    PacketManager: { updateAngle() {}, packetCount: 0 },
    InputHandler: { move: 0 },
    PlayerManager: { enemies: [], isEnemyByID: (ownerID) => ownerID === 99 },
    EnemyManager: { nearestEnemy: null, nearestSpikePlacerAngle: null, shouldIgnoreModule: () => false },
    StatsManager: {},
  };
  client._ModuleHandler = {
    tickCount: 0, packetCount: 0, packetLimit: 70,
    placedOnce: false, moduleActive: false, activeModule: null,
    placeAngles: [null, []], move_dir: 0, _currentAngle: 0,
    _autoBreakActive: false, _lastBreakAngle: null, autoattack: false, forceWeapon: null,
    totalPlaces: 0,
    staticModules: {},
    _getPredictWeapon: () => 0,
    // The server accepts the build: the object appears in the world on the same
    // tick. Without this the engine's confirmation tracker correctly concludes
    // every placement was refused and bans the angles, which would make the
    // scenarios measure the ban path rather than the placement path.
    place(type, angle) {
      this.packetCount += 5;
      const me = client.myPlayer;
      const id = me.getItemByType(type);
      const pt = me.pos.current.addDirection(angle, me.getItemPlaceScale(id));
      // Measured against where the enemy was when the build went out, not where
      // they ended up — the whole point is what the decision was worth at the
      // moment it was made.
      const en = client.EnemyManager.nearestEnemy;
      placed.push({
        type, angle,
        distAtSend: en ? pt.distance(en.pos.current) : null,
        reach: en ? en.collisionScale + M.Items[id].scale : null,
      });
      if (world.canPlaceItem(id, pt)) {
        world.add(id, pt.x, pt.y, 1);
        const g = M.Items[id].itemGroup;
        me.itemCount.set(g, (me.itemCount.get(g) || 0) + 1);
      }
    },
  };
  client._placed = placed;
  return client;
}

// A scenario runs N ticks; the enemy is moved by `path(t)` each tick.
function run(name, opts) {
  const world = new World();
  (opts.objects || []).forEach(o => world.add(o.type, o.x, o.y, o.owner ?? 1));
  const client = makeClient(world);
  const me = new Ent(1, opts.me?.x ?? 1000, opts.me?.y ?? 1000);
  const enemy = new Ent(99, opts.enemy.x, opts.enemy.y);
  if (opts.enemyTrapped) enemy.isTrapped = true;
  if (opts.enemySpikeDamage) enemy.spikeDamage = opts.enemySpikeDamage;
  client.myPlayer = me;
  client.PlayerManager.enemies = [enemy].concat(opts.extraEnemies || []);
  client.EnemyManager.nearestEnemy = enemy;
  if (opts.tickAngles) client.EnemyManager.nearestSpikePlacerAngle = opts.tickAngles;
  if (opts.activeModule) client._ModuleHandler.activeModule = opts.activeModule;

  const placer = new M.AutoPlacer(client);
  client._ModuleHandler.staticModules.autoPlacer = placer;

  const ticks = opts.ticks ?? 4;
  const history = [];
  for (let t = 0; t < ticks; t++) {
    client._ModuleHandler.tickCount = t;
    client._ModuleHandler.placeAngles = [null, []];
    client._ModuleHandler.packetCount = 0;
    client._ModuleHandler.moduleActive = !!opts.moduleActive;
    if (opts.path) { const p = opts.path(t); enemy.moveTo(p.x, p.y); }
    const before = client._placed.length;
    placer.postTick();
    const tr = placer._tracks.get(99);
    history.push({
      tick: t,
      x: +enemy.pos.current.x.toFixed(1), y: +enemy.pos.current.y.toFixed(1),
      confidence: tr ? +tr.confidence.toFixed(3) : null,
      turn: tr ? +tr.turn.toFixed(3) : null,
      lookahead: tr ? +tr.lookahead.toFixed(2) : null,
      builds: client._placed.length - before,
    });
  }

  const out = client._placed.map(p => ({
    type: p.type === 4 ? "spike" : "trap",
    angleDeg: +(p.angle * 180 / Math.PI).toFixed(1),
    // Distance from the build to the enemy at the instant it was sent, and how
    // far past contact that is (negative = overlapping them).
    distToEnemy: p.distAtSend === null ? null : +p.distAtSend.toFixed(1),
    gap: p.distAtSend === null ? null : +(p.distAtSend - p.reach).toFixed(1),
  }));
  return { name, placed: out, log: placer._log, placer, enemy, me, world, client, history };
}

module.exports = { M, World, Ent, makeClient, run, SPIKE_ID, TRAP_ID };
