#!/usr/bin/env node
"use strict";

// Smoke test for src/luna-placer.js.
//
// The placer is a self-contained class over RYN's managers, so it can be run
// outside the game against stubs. This drives postTick through the cases that
// exercise each decision path and checks what reached the wire:
//
//   1. autoplace with the enemy in the open  -> traps go down
//   2. autoplace with the enemy in our trap  -> spikes go down
//   3. enemy out past the radius             -> nothing
//   4. autoplacer off                        -> nothing
//   5. a spike tick owns the tick            -> nothing
//   6. preplace: an object the enemy is about to break, and Replace on
//      -> the build is held back, then sent twice more on timers
//   7. the angle probe: 72 samples, edges of a placeable run marked perfect
//
// Run: node tools/test-luna-placer.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const PLACER = path.join(ROOT, "src", "luna-placer.js");

// ── stubs ────────────────────────────────────────────────────────────────────

class Vec {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  distance(o) {
    return Math.hypot(this.x - o.x, this.y - o.y);
  }
  angle(o) {
    return Math.atan2(o.y - this.y, o.x - this.x);
  }
}

const SPIKE_ID = 6;   // itemGroup 2, what getItemByType(4) hands back
const TRAP_ID = 15;   // itemGroup 4

const Items = {
  6: { id: 6, scale: 35, itemGroup: 2, health: 400, placeOffset: -5 },
  15: { id: 15, scale: 32, itemGroup: 4, health: 500, placeOffset: -20, hideFromEnemy: true },
  16: { id: 16, scale: 45, itemGroup: 5, health: 300 },
  17: { id: 17, scale: 25, itemGroup: 6, health: 200 }
};
const ItemGroups = {
  2: { id: 2, limit: 15, layer: 0 },
  4: { id: 4, limit: 6, layer: -1 },
  5: { id: 5, limit: 99, layer: 0 },
  6: { id: 6, limit: 2, layer: 0 }
};
const Config_default = { mapScale: 14400, riverWidth: 724, gatherAngle: Math.PI / 2.6 };
const Settings_default = { _autoplacer: true, _prePlace: true, _replace: true, _autoplacerRadius: 350 };
const DataHandler_default = { getWeapon: () => ({ range: 110, speed: 300 }) };
const getAngleFromBitmask = () => 0;

class PlayerObject {
  constructor(id, x, y, type, ownerID) {
    this.id = id;
    this.pos = { current: new Vec(x, y), future: new Vec(x, y) };
    this.type = type;
    this.ownerID = ownerID;
    const item = Items[type];
    this.scale = item.scale;
    this.itemGroup = item.itemGroup;
    this.health = item.health;
    this.isDestroyable = true;
  }
  get collisionScale() {
    return this.scale;
  }
  get placementScale() {
    return this.scale;
  }
}

function makeClient(opts) {
  const o = Object.assign({
    myX: 7000, myY: 3000,
    enemyX: 7150, enemyY: 3000,
    objects: [],
    enemyTrapped: false,
    imTrapped: false,
    enemySpikeDamage: 0,
    activeModule: null,
    enemyPrimaryJustReady: false,
    packetLimit: 70
  }, opts);

  const objects = new Map();
  for (const obj of o.objects) objects.set(obj.id, obj);

  const sent = [];
  const ModuleHandler = {
    tickCount: 100,
    packetCount: 0,
    packetLimit: o.packetLimit,
    placeAngles: [ null, [] ],
    placedOnce: false,
    moduleActive: false,
    activeModule: o.activeModule,
    totalPlaces: 0,
    autoattack: false,
    forceWeapon: null,
    _autoBreakActive: false,
    _lastBreakAngle: null,
    _currentAngle: 0,
    _getPredictWeapon: () => 0,
    place(type, angle) {
      sent.push({ type: type, angle: angle });
      this.packetCount += 4;
    }
  };

  const client = {
    _ModuleHandler: ModuleHandler,
    InputHandler: { move: 0 },
    PacketManager: { updateAngle() {} },
    SocketManager: { pong: 40, minPingTime: 30 },
    PlayerManager: {
      // ownerID 1 is us, anything else is an enemy
      isEnemyByID: ownerID => ownerID !== 1
    },
    ObjectManager: {
      objects: objects,
      grid2D: {
        query(x, y, search, callback) {
          for (const id of objects.keys()) {
            if (callback(id)) return true;
          }
          return false;
        }
      }
    },
    EnemyManager: {
      nearestEnemy: {
        id: 99,
        pos: { current: new Vec(o.enemyX, o.enemyY), future: new Vec(o.enemyX, o.enemyY) },
        collisionScale: 35,
        spikeDamage: o.enemySpikeDamage,
        weapon: { primary: 0, secondary: null },
        reload: [
          { previous: o.enemyPrimaryJustReady ? 100 : 300, current: 300, max: 300 },
          { previous: 0, current: 0, max: 400 },
          { previous: 0, current: 0, max: 0 }
        ],
        getBuildingDamage: () => 500
      }
    },
    myPlayer: {
      inGame: true,
      hatID: 0,
      isTrapped: o.imTrapped,
      spikeDamage: 0,
      pos: { current: new Vec(o.myX, o.myY), future: new Vec(o.myX, o.myY) },
      getItemByType: type => type === 4 ? SPIKE_ID : type === 7 ? TRAP_ID : null,
      getItemCount: group => ({ count: 0, limit: ItemGroups[group].limit }),
      canPlace: () => true,
      isReloaded: () => true,
      getBuildingDamage: () => 500
    }
  };
  return { client: client, sent: sent, ModuleHandler: ModuleHandler };
}

// ── load the placer ──────────────────────────────────────────────────────────

const source = fs.readFileSync(PLACER, "utf8");
const sandbox = {
  Items: Items,
  ItemGroups: ItemGroups,
  Config_default: Config_default,
  Settings_default: Settings_default,
  DataHandler_default: DataHandler_default,
  PlayerObject: PlayerObject,
  getAngleFromBitmask: getAngleFromBitmask,
  Math: Math,
  Number: Number,
  Set: Set,
  Map: Map,
  setTimeout: (fn, ms) => {
    timers.push({ fn: fn, ms: ms });
    return 0;
  },
  console: console
};
let timers = [];
vm.createContext(sandbox);
vm.runInContext(source + "\nthis.AutoPlacer = AutoPlacer;", sandbox, { filename: "luna-placer.js" });
const AutoPlacer = sandbox.AutoPlacer;

// ── harness ──────────────────────────────────────────────────────────────────

let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log("  ok   " + name);
  } else {
    failures += 1;
    console.log("  FAIL " + name + (detail === undefined ? "" : " — " + detail));
  }
}

function run(opts) {
  timers = [];
  const env = makeClient(opts);
  const placer = new AutoPlacer(env.client);
  placer.postTick();
  return { placer: placer, sent: env.sent, timers: timers, client: env.client };
}

const ours = (id, x, y, type) => new PlayerObject(id, x, y, type, 1);
const theirs = (id, x, y, type) => new PlayerObject(id, x, y, type, 2);

console.log("luna placer smoke test\n");

// 1 — enemy in the open, neither of us pinned: Luna lays traps.
{
  const r = run({});
  const traps = r.sent.filter(s => s.type === 7);
  check("open enemy places traps", traps.length > 0, r.sent.length + " builds");
  check("open enemy places no spikes", r.sent.every(s => s.type === 7), JSON.stringify(r.sent.map(s => s.type)));
}

// 2 — enemy standing in one of our traps: the spike ladder opens up.
{
  const trap = ours(1, 7150, 3000, TRAP_ID);
  const r = run({ objects: [ trap ], enemyTrapped: true });
  check("trapped enemy places spikes", r.sent.some(s => s.type === 4), JSON.stringify(r.sent.map(s => s.type)));
}

// 3 — enemy beyond the radius: Luna's 350 gate, and the setting that overrides it.
{
  const r = run({ enemyX: 7000 + 600 });
  check("distant enemy places nothing", r.sent.length === 0, r.sent.length + " builds");
}

// 4 — master toggle off.
{
  Settings_default._autoplacer = false;
  const r = run({});
  Settings_default._autoplacer = true;
  check("autoplacer off places nothing", r.sent.length === 0, r.sent.length + " builds");
}

// 5 — a spike tick owns the tick: the placer keeps out of its way.
{
  const r = run({ activeModule: "spikeTickNear" });
  check("spike tick owns the tick", r.sent.length === 0, r.sent.length + " builds");
}

// 6 — preplace: an object the enemy's primary is about to break.
{
  const doomed = ours(1, 7080, 3000, 16);
  doomed.health = 10;
  const r = run({ objects: [ doomed ], enemyPrimaryJustReady: true });
  const pre = r.placer._predictObjects.filter(o => o.preplace);
  check("preplace queues a held-back build", pre.length === 1, JSON.stringify(r.placer._predictObjects.map(o => o.preplace)));
  check("preplace arms the replace resend", r.placer._spamPrePlacer === true);
  check("preplace schedules aim + two resends", r.timers.length === 3, r.timers.length + " timers");
  const before = r.sent.length;
  for (const t of r.timers) t.fn();
  check("resends reach the wire", r.sent.length > before, before + " -> " + r.sent.length);
}

// 6c — a spike tick claims the NEXT tick, after the preplace was queued. The
// delayed sends land inside that tick, so they have to yield there too — a
// check made when they were scheduled says nothing about the tick they land
// in. This is the case the postTick guard alone does not cover.
{
  const doomed = ours(1, 7080, 3000, 16);
  doomed.health = 10;
  const r = run({ objects: [ doomed ], enemyPrimaryJustReady: true });
  check("preplace was queued on a clear tick", r.timers.length === 3, r.timers.length + " timers");
  const before = r.sent.length;
  // The next tick belongs to a spike tick.
  r.client._ModuleHandler.activeModule = "spikeTickNear";
  for (const t of r.timers) t.fn();
  check("delayed sends yield to a spike tick", r.sent.length === before, before + " -> " + r.sent.length);
  // It lets go again once the spike tick is done with the tick.
  r.client._ModuleHandler.activeModule = null;
  for (const t of r.timers) t.fn();
  check("delayed sends resume after it", r.sent.length > before, before + " -> " + r.sent.length);
}

// 6d — autoplacer switched off between the queue and the resend.
{
  const doomed = ours(1, 7080, 3000, 16);
  doomed.health = 10;
  const r = run({ objects: [ doomed ], enemyPrimaryJustReady: true });
  const before = r.sent.length;
  Settings_default._autoplacer = false;
  for (const t of r.timers) t.fn();
  Settings_default._autoplacer = true;
  check("delayed sends stop when autoplacer goes off", r.sent.length === before, before + " -> " + r.sent.length);
}

// 6b — Replace off: the third send is not armed by the toggle alone.
{
  Settings_default._replace = false;
  const r = run({});
  Settings_default._replace = true;
  check("replace off leaves the resend disarmed", r.placer._spamPrePlacer === false);
}

// 7 — the angle probe itself.
{
  const blocker = ours(1, 7070, 3000, 16);
  const env = makeClient({ objects: [ blocker ] });
  const placer = new AutoPlacer(env.client);
  const myPos = env.client.myPlayer.pos.current;
  const angles = placer._getPrePlaceAngles(SPIKE_ID, myPos, env.client.myPlayer, env.client.ObjectManager, null);
  check("probes 72 angles", angles.length === 72, angles.length + " angles");
  check("the blocked side is unplaceable", angles.some(a => !a.placeable), "none blocked");
  check("the open side is placeable", angles.some(a => a.placeable), "none free");
  const perfect = angles.filter(a => a.perfect);
  check("marks the run edges perfect", perfect.length >= 1 && perfect.length <= 4, perfect.length + " perfect");
  for (const a of perfect) {
    const i = angles.indexOf(a);
    const prev = angles[i - 1], next = angles[i + 1];
    const isEdge = a.placeable && (prev && !prev.placeable || next && !next.placeable);
    check("perfect angle " + i + " sits on an edge", !!isEdge);
  }
  // Excluding the blocker frees the angles it was sitting on.
  const freed = placer._getPrePlaceAngles(SPIKE_ID, myPos, env.client.myPlayer, env.client.ObjectManager, blocker);
  check("excluding an object frees its angles", freed.filter(a => a.placeable).length > angles.filter(a => a.placeable).length);
}

// 8 — item limit: at the cap, nothing of that kind is proposed.
{
  const env = makeClient({});
  env.client.myPlayer.getItemCount = group => ({ count: 99, limit: ItemGroups[group].limit });
  const placer = new AutoPlacer(env.client);
  placer.postTick();
  check("item limit stops the builds", env.sent.length === 0, env.sent.length + " builds");
}

// 9 — packet budget: an exhausted tick sends nothing.
{
  const env = makeClient({});
  env.ModuleHandler.packetCount = 70;
  const placer = new AutoPlacer(env.client);
  placer.postTick();
  check("no budget, no builds", env.sent.length === 0, env.sent.length + " builds");
}

// 10 — an enemy's object does not count as our trap.
{
  const trap = theirs(1, 7150, 3000, TRAP_ID);
  const r = run({ objects: [ trap ] });
  check("enemy trap is not our trap", r.sent.every(s => s.type === 7), JSON.stringify(r.sent.map(s => s.type)));
}

console.log("\n" + (failures === 0 ? "all checks passed" : failures + " check(s) failed"));
process.exit(failures === 0 ? 0 : 1);
