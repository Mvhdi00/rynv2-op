// Old placer (ryn53) vs new engine (ryn54), identical scenarios, identical
// world simulation. Both are the real shipped source, loaded from their files.
const fs = require("fs");
const vm = require("vm");

function load(file, engineFirstLine) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const span = (a, b, must) => {
    const blk = lines.slice(a - 1, b);
    if (!blk[0].startsWith(must)) throw new Error(file + " " + a + " is " + JSON.stringify(blk[0]));
    return blk.join("\n");
  };
  const find = pfx => lines.findIndex(l => l.startsWith(pfx));
  const es = find(engineFirstLine) + 1;
  const ee = find("  const AutoPlacer_default = AutoPlacer;");
  const parts = [
    span(307, 360, "  const Config = {"),
    span(725, 794, "  const ItemGroups = {"),
    span(795, 1245, "  const Items = [ {"),
    span(1334, 1429, "  class Vector {"),
    span(1430, 1439, "  const getAngle = "),
    span(2394, 2574, "  class ObjectItem {"),
    span(find("  class SpatialHashGrid2D {") + 1, find("  class ObjectManager {"), "  class SpatialHashGrid2D {"),
    span(es, ee, engineFirstLine),
  ];
  const prelude = `
  const pointInRiver = p => { const m = Config.mapScale/2, h = Config.riverWidth/2; return p.y >= m-h && p.y <= m+h; };
  const pointInDesert = p => p.y >= Config.mapScale - Config.snowBiomeTop;
  const getAngleFromBitmask = () => 0;
  const Settings_default = { _autoplacer: true, _prePlace: true, _replace: true, _autoplacerRadius: 350 };
  const DataHandler_default = { getItem: id => Items[id], getWeapon: () => ({range:100,speed:300,damage:25}), canMoveOnTop: id => "ignoreCollision" in Items[id] };
`;
  const code = "(function(){\n" + parts.join("\n") + "\n" + prelude +
    "\nreturn { AutoPlacer, Vector, Items, ItemGroups, PlayerObject, SpatialHashGrid2D };\n})()";
  return vm.runInNewContext(code, { Math, Number, Array, Set, Map, WeakMap, console, Infinity, NaN, setTimeout: () => {}, performance: { now: () => 0 } });
}

const OLD = load(__dirname + "/ryn53.baseline.js", "  const LUNA_SPIKE_TYPE");
const NEW = load(__dirname + "/../RYN_v5.4_Placement.user.js", "  const RPE_SPIKE_TYPE");

const SPIKE_ID = 7, TRAP_ID = 15;

function build(M) {
  let nextId = 1;
  class World {
    constructor() { this.objects = new Map(); this.grid2D = new M.SpatialHashGrid2D(100); this.deletedObjects = new Set(); }
    add(type, x, y, ownerID) {
      const o = new M.PlayerObject(nextId++, x, y, 0, M.Items[type].scale, type, ownerID);
      this.objects.set(o.id, o); this.grid2D.insert(x, y, o.collisionScale, o.id); return o;
    }
    canPlaceItem(id, position) {
      if (position.y >= M.Config?.mapScale ?? Infinity) return false;
      const item = M.Items[id];
      return !this.grid2D.query(position.x, position.y, 1, id2 => {
        const o = this.objects.get(id2);
        return position.distance(o.pos.current) < item.scale + o.placementScale;
      });
    }
    getBestPlacementAngles() { return []; }
  }
  class Ent {
    constructor(id, x, y, scale = 35) {
      this.id = id; this.scale = scale;
      this.pos = { previous: new M.Vector(x, y), current: new M.Vector(x, y), future: new M.Vector(x, y) };
      this.speed = 0; this.move_dir = 0; this.isTrapped = false; this.trappedIn = null; this.spikeDamage = 0;
      this.reload = [{ current: 0, max: 3, previous: 0 }, { current: 0, max: 3, previous: 0 }, { current: 0, max: 23, previous: 0 }];
      this.weapon = { primary: 0, secondary: null }; this.hatID = 0; this.inGame = true; this.isSandbox = false;
      this.itemCount = new Map(); this.inventory = { 0: 0, 1: null, 2: 0, 4: SPIKE_ID, 7: TRAP_ID };
      this.resources = { food: 999, wood: 999, stone: 999, gold: 999 };
    }
    get collisionScale() { return this.scale; }
    get hitScale() { return this.scale * 1.8; }
    moveTo(x, y) {
      this.pos.previous.setVec(this.pos.current); this.pos.current._setXY(x, y);
      const d = this.pos.previous.distance(this.pos.current);
      this.speed = d; this.move_dir = this.pos.previous.angle(this.pos.current);
      this.pos.future.setVec(this.pos.current.addDirection(this.move_dir, d));
    }
    getItemByType(t) { return this.inventory[t]; }
    getItemPlaceScale(id) { const i = M.Items[id]; return this.scale + i.scale + i.placeOffset; }
    getItemCount(g) { return { count: this.itemCount.get(g) || 0, limit: M.ItemGroups[g].limit }; }
    canPlace(type) {
      const id = this.inventory[type];
      if (id === null || id === undefined) return false;
      const { count, limit } = this.getItemCount(M.Items[id].itemGroup);
      return count < limit;
    }
    isReloaded() { return true; }
    getBuildingDamage() { return 25; }
  }
  return { World, Ent };
}

function runOne(M, scenario, latency = 0) {
  const { World, Ent } = build(M);
  const world = new World();
  (scenario.objects || []).forEach(o => world.add(o.type, o.x, o.y, o.owner ?? 1));
  const placed = [];
  const inflight = [];          // builds the server has not echoed back yet
  const client = {
    ObjectManager: world,
    SocketManager: { pong: 40, minPingTime: 30 },
    PacketManager: { updateAngle() {}, packetCount: 0 },
    InputHandler: { move: 0 },
    PlayerManager: { enemies: [], isEnemyByID: o => o === 99 },
    EnemyManager: { nearestEnemy: null, nearestSpikePlacerAngle: null, shouldIgnoreModule: () => false },
    StatsManager: {},
  };
  const me = new Ent(1, 1000, 1000);
  const enemy = new Ent(99, scenario.enemy.x, scenario.enemy.y);
  if (scenario.enemyTrapped) enemy.isTrapped = true;
  client.myPlayer = me;
  client.PlayerManager.enemies = [enemy];
  client.EnemyManager.nearestEnemy = enemy;
  let packets = 0;
  client._ModuleHandler = {
    tickCount: 0, packetCount: 0, packetLimit: 70, placedOnce: false, moduleActive: false,
    activeModule: null, placeAngles: [null, []], move_dir: 0, _currentAngle: 0,
    _autoBreakActive: false, _lastBreakAngle: null, autoattack: false, forceWeapon: null,
    totalPlaces: 0, staticModules: {}, _getPredictWeapon: () => 0,
    place(type, angle) {
      this.packetCount += 5; packets += 5;
      const id = me.getItemByType(type);
      const pt = me.pos.current.addDirection(angle, me.getItemPlaceScale(id));
      const dist = pt.distance(enemy.pos.current);
      const reach = enemy.collisionScale + M.Items[id].scale;
      placed.push({ type, angle, dist, gap: dist - reach, tick: this.tickCount });
      // The server accepts it, but the object only becomes visible after the
      // round trip. Until then the placer sees the slot as still free — which is
      // exactly the state that produces duplicate sends.
      inflight.push({ id, pt, at: this.tickCount + latency });
    },
  };
  const placer = new M.AutoPlacer(client);
  client._ModuleHandler.staticModules.autoPlacer = placer;

  let cpu = 0;
  // Warm the JIT so the timing measures the algorithm, not first-call compile.
  for (let w = 0; w < 30; w++) {
    client._ModuleHandler.tickCount = -100 + w;
    client._ModuleHandler.placeAngles = [null, []];
    client._ModuleHandler.packetCount = 70;   // no budget: scoring runs, nothing sends
    try { placer.postTick(); } catch (e) {}
  }
  placed.length = 0; packets = 0;
  for (let t = 0; t < scenario.ticks; t++) {
    client._ModuleHandler.tickCount = t;
    client._ModuleHandler.placeAngles = [null, []];
    client._ModuleHandler.packetCount = 0;
    client._ModuleHandler.moduleActive = false;
    for (let i = inflight.length - 1; i >= 0; i--) {
      if (inflight[i].at > t) continue;
      const f = inflight.splice(i, 1)[0];
      if (world.canPlaceItem(f.id, f.pt)) {
        world.add(f.id, f.pt.x, f.pt.y, 1);
        const g = M.Items[f.id].itemGroup;
        me.itemCount.set(g, (me.itemCount.get(g) || 0) + 1);
      }
    }
    const p = scenario.path(t);
    enemy.moveTo(p.x, p.y);
    const t0 = process.hrtime.bigint();
    placer.postTick();
    cpu += Number(process.hrtime.bigint() - t0) / 1e6;
  }
  const spikes = placed.filter(p => p.type === 4);
  const contact = spikes.filter(p => p.gap <= 0).length;
  const wasted = placed.filter(p => p.gap > 90).length;
  // A duplicate is a second build sent at effectively the same angle before the
  // first one has come back — the packet is spent and the server drops it.
  let dupes = 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = 0; j < i; j++) {
      if (placed[i].type !== placed[j].type) continue;
      if (placed[i].tick - placed[j].tick > latency + 1) continue;
      const d = Math.abs(((placed[i].angle - placed[j].angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (d < 0.12) { dupes++; break; }
    }
  }
  return {
    dupes,
    builds: placed.length,
    packets,
    spikes: spikes.length,
    contact,
    contactPct: spikes.length ? Math.round(100 * contact / spikes.length) : 0,
    medianGap: spikes.length ? +median(spikes.map(s => s.gap)).toFixed(1) : null,
    wasted,
    cpuMs: +(cpu / scenario.ticks).toFixed(3),
  };
}
function median(a) { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; }

const scenarios = [
  { name: "enemy in front, still", enemy: { x: 1140, y: 1000 }, ticks: 12, path: () => ({ x: 1140, y: 1000 }) },
  { name: "enemy strafing right", enemy: { x: 1120, y: 900 }, ticks: 12, path: t => ({ x: 1120, y: 900 + t * 22 }) },
  { name: "enemy circling", enemy: { x: 1130, y: 1000 }, ticks: 20, path: t => ({ x: 1000 + Math.cos(t * .28) * 130, y: 1000 + Math.sin(t * .28) * 130 }) },
  { name: "enemy reversing", enemy: { x: 1120, y: 900 }, ticks: 16, path: t => ({ x: 1120, y: t % 8 < 4 ? 900 + (t % 8) * 25 : 975 - (t % 8 - 3) * 25 }) },
  { name: "enemy closing in", enemy: { x: 1300, y: 1000 }, ticks: 12, path: t => ({ x: 1300 - t * 20, y: 1000 }) },
  { name: "enemy trapped", enemy: { x: 1120, y: 1000 }, ticks: 12, enemyTrapped: true, path: () => ({ x: 1120, y: 1000 }), objects: [{ type: TRAP_ID, x: 1120, y: 1000, owner: 1 }] },
  // The old ladder's best case: friendly spikes already flanking the enemy, so
  // its knockback branch can fire and it is able to place a spike at all.
  { name: "friendly spikes flanking", enemy: { x: 1150, y: 1000 }, ticks: 12, path: () => ({ x: 1150, y: 1000 }),
    objects: [{ type: SPIKE_ID, x: 1150, y: 1105, owner: 1 }, { type: SPIKE_ID, x: 1150, y: 895, owner: 1 }] },
];

const cols = ["builds", "packets", "spikes", "contact", "medianGap", "wasted", "dupes", "cpuMs"];
const sumCols = ["builds", "packets", "spikes", "contact", "wasted", "dupes"];
const LATENCY = 2;   // ticks of round trip, i.e. roughly 90ms ping at 111ms ticks
const pad = (s, n) => String(s).padStart(n);
console.log("\nOLD = Luna 72-bucket placer (ryn53)   NEW = RYN Placement Engine (ryn54)");
console.log("contact = spikes touching the enemy on arrival; medianGap = px past contact");
console.log("wasted  = builds landing >90px past contact; dupes = builds re-sent to the same angle before the first echoed back");
console.log("simulated round trip: " + LATENCY + " ticks (~" + (LATENCY * 111) + "ms)\n");

const tot = { OLD: {}, NEW: {} };
for (const s of scenarios) {
  const o = runOne(OLD, s, LATENCY), n = runOne(NEW, s, LATENCY);
  console.log("── " + s.name + "  (" + s.ticks + " ticks)");
  console.log("        " + cols.map(c => pad(c, 11)).join(""));
  console.log("  OLD   " + cols.map(c => pad(o[c] === null ? "-" : o[c], 11)).join(""));
  console.log("  NEW   " + cols.map(c => pad(n[c] === null ? "-" : n[c], 11)).join(""));
  console.log("");
  for (const c of sumCols) {
    tot.OLD[c] = (tot.OLD[c] || 0) + (o[c] || 0);
    tot.NEW[c] = (tot.NEW[c] || 0) + (n[c] || 0);
  }
  tot.OLD.cpuMs = (tot.OLD.cpuMs || 0) + o.cpuMs;
  tot.NEW.cpuMs = (tot.NEW.cpuMs || 0) + n.cpuMs;
  tot.n = (tot.n || 0) + 1;
}
console.log("── totals across all scenarios");
console.log("        " + sumCols.map(c => pad(c, 11)).join(""));
console.log("  OLD   " + sumCols.map(c => pad(tot.OLD[c], 11)).join(""));
console.log("  NEW   " + sumCols.map(c => pad(tot.NEW[c], 11)).join(""));
const pc = (a, b) => (b === 0 ? "n/a" : (100 * (b - a) / a).toFixed(0) + "%");
console.log("\n  builds sent:        " + tot.OLD.builds + " → " + tot.NEW.builds + "  (" + pc(tot.OLD.builds, tot.NEW.builds) + ")");
console.log("  packets spent:      " + tot.OLD.packets + " → " + tot.NEW.packets + "  (" + pc(tot.OLD.packets, tot.NEW.packets) + ")");
console.log("  spikes in contact:  " + Math.round(100 * tot.OLD.contact / Math.max(1, tot.OLD.spikes)) + "% → " + Math.round(100 * tot.NEW.contact / Math.max(1, tot.NEW.spikes)) + "%");
console.log("  builds >90px past contact: " + tot.OLD.wasted + " → " + tot.NEW.wasted);
console.log("  duplicate/stale sends:     " + tot.OLD.dupes + " → " + tot.NEW.dupes);
console.log("  mean cpu per tick:  " + (tot.OLD.cpuMs / tot.n).toFixed(3) + "ms → " + (tot.NEW.cpuMs / tot.n).toFixed(3) + "ms\n");
