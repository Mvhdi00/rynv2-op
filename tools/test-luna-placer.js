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
const TRAP_ID = 15;   // itemGroup 5, what getItemByType(7) hands back

// Copied from the client's own tables, not invented — the fixtures below turn
// on the real scales. A spike lands 35 + 49 - 5 = 79px from the player, and
// needs 49 + 50 = 99px of clearance from a pit trap.
const Items = {
  6: { id: 6, name: "spikes", scale: 49, itemGroup: 2, health: 400, placeOffset: -5 },
  15: { id: 15, name: "pit trap", scale: 50, itemGroup: 5, health: 500, placeOffset: -5, hideFromEnemy: true },
  16: { id: 16, name: "boost pad", scale: 45, itemGroup: 6, health: 150, placeOffset: -5 },
  17: { id: 17, name: "turret", scale: 43, itemGroup: 7, health: 800, placeOffset: -5 }
};
const ItemGroups = {
  2: { id: 2, name: "Spike", limit: 15, layer: 0 },
  5: { id: 5, name: "Trap", limit: 6, layer: -1 },
  6: { id: 6, name: "Boost", limit: 12, sandboxLimit: 299, layer: -1 },
  7: { id: 7, name: "Turret", limit: 2, layer: 1 }
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

const lunaSnap = a => parseFloat(Math.atan2(Math.sin(a), Math.cos(a)).toFixed(2));
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

// 2 — enemy standing in one of our traps: the spike ladder opens up. The trap
// sits just past the enemy so the near side stays clear of it — the enemy is
// at 150px, the build lands at 79px, so a spike towards them is in contact
// range while one behind me is not.
{
  const trap = ours(1, 7190, 3000, TRAP_ID);
  const r = run({ objects: [ trap ], enemyTrapped: true });
  check("trapped enemy places spikes", r.sent.some(s => s.type === 4), JSON.stringify(r.sent.map(s => s.type)));

  // Rule 3 has a reach test now: no spike on the far side of me, where it
  // could never touch the enemy. Rule 1 can still reach a little past the
  // gate, so this asserts the far side specifically rather than the gate.
  const item = Items[SPIKE_ID];
  const w = 35 + item.scale + (item.placeOffset || 0);
  let worst = 0;
  for (const s of r.sent.filter(x => x.type === 4)) {
    const x = 7000 + w * Math.cos(s.angle);
    const y = 3000 + w * Math.sin(s.angle);
    worst = Math.max(worst, Math.hypot(x - 7150, y - 3000));
  }
  check("no spike lands out of reach of the enemy", worst <= 120, "worst " + worst.toFixed(0) + "px");
}

// 2b — the case that prompted the reach test: enemy pinned, and the only free
// angles are behind me. Luna would spike every one of them. Nothing should go
// down now.
{
  // The trap sits on the enemy, so its 99px clearance blocks the whole near
  // side and leaves only angles pointing away from them.
  const trap = ours(1, 7150, 3000, TRAP_ID);
  const r = run({ objects: [ trap ], enemyTrapped: true });
  const item = Items[SPIKE_ID];
  const w = 35 + item.scale + (item.placeOffset || 0);
  const far = r.sent.filter(s => s.type === 4).filter(s => {
    const x = 7000 + w * Math.cos(s.angle);
    const y = 3000 + w * Math.sin(s.angle);
    return Math.hypot(x - 7150, y - 3000) > 120;
  });
  check("no spikes behind me when only the far side is free", far.length === 0, far.length + " far spikes");
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
  check("probes 72 grid angles", angles.filter(a => !a.corner).length === 72, angles.filter(a => !a.corner).length + " grid angles");
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

// 7b — the exact tangent corners. Every corner has to sit exactly where the
// build lands touching the object that produced it, and the merged ring must
// stay sorted and free of duplicates.
{
  const blocker = ours(1, 7070, 3000, 16);
  const env = makeClient({ objects: [ blocker ] });
  const placer = new AutoPlacer(env.client);
  const myPos = env.client.myPlayer.pos.current;
  const angles = placer._getPrePlaceAngles(SPIKE_ID, myPos, env.client.myPlayer, env.client.ObjectManager, null);

  const corners = angles.filter(a => a.corner);
  check("corners were added to the ring", corners.length === 2, corners.length + " corners");

  // A corner lands tangent: |build - object| == itemScale + blockRadius.
  const want = Items[SPIKE_ID].scale + blocker.placementScale;
  for (const c of corners) {
    const got = Math.hypot(c.x - blocker.pos.current.x, c.y - blocker.pos.current.y);
    // The nudge pushes it just clear, so it lands at or barely past tangency.
    const off = got - want;
    check("corner is tangent (+" + off.toFixed(2) + "px)", off >= 0 && off < 1.5, "off by " + off.toFixed(3));
    check("corner clears the object", got >= want, got.toFixed(2) + " vs " + want);
  }

  // Angles are wire values in (-π, π]; the ring is ordered around [0, 2π).
  const wrap = a => (a % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  let sorted = true, duped = false;
  for (let i = 1; i < angles.length; i++) {
    if (wrap(angles[i].angle) < wrap(angles[i - 1].angle)) sorted = false;
    if (angles[i].angle === angles[i - 1].angle) duped = true;
  }
  check("ring stays sorted", sorted);
  check("ring has no duplicate angles", !duped);
  check("grid samples are still all there", angles.length >= 72, angles.length + " entries");

  // Every angle must be one the client can actually send: wireAngle is
  // idempotent on it, and it sits on the 0.01 rad grid.
  const wireAngle = a => parseFloat(Math.atan2(Math.sin(a), Math.cos(a)).toFixed(2));
  const offGrid = angles.filter(a => wireAngle(a.angle) !== a.angle);
  check("every angle is a sendable wire angle", offGrid.length === 0, offGrid.length + " off-grid: " + JSON.stringify(offGrid.slice(0, 3).map(a => a.angle)));
}

// 7c — the case the 5° grid alone cannot solve: a gap between two objects that
// is legal but narrower than one grid step. Only the solved corners find it.
{
  const item = Items[SPIKE_ID];
  const w = 35 + item.scale + (item.placeOffset || 0);
  const R = item.scale + Items[16].scale;
  const d = 120;
  // Half-width of the arc one object at distance d subtracts from the landing
  // circle — the same law of cosines the placer solves.
  const blockedHalf = Math.acos((w * w + d * d - R * R) / (2 * w * d));
  // Leave a free window 1.6° wide, centred at 47.5° so the nearest grid
  // samples (45° and 50°) both sit 2.5° outside it.
  const gapCentre = 47.5 * Math.PI / 180;
  const halfGap = .8 * Math.PI / 180;
  const mk = (id, bearing) => ours(id, 7000 + d * Math.cos(bearing), 3000 + d * Math.sin(bearing), 16);
  const a = mk(1, gapCentre - halfGap - blockedHalf);
  const b = mk(2, gapCentre + halfGap + blockedHalf);
  const env = makeClient({ objects: [ a, b ] });
  const placer = new AutoPlacer(env.client);
  const myPos = env.client.myPlayer.pos.current;
  const angles = placer._getPrePlaceAngles(SPIKE_ID, myPos, env.client.myPlayer, env.client.ObjectManager, null);

  const gridFound = angles.some(x => !x.corner && x.placeable && Math.abs(x.angle - gapCentre) < halfGap);
  const cornerFound = angles.some(x => x.corner && x.placeable && Math.abs(x.angle - gapCentre) < halfGap);
  check("a sub-5° gap exists that the grid misses", !gridFound);
  check("the solved corners find it anyway", cornerFound);
}

// 7d — the wire grid. Every angle the client sends goes through
//   wireAngle = parseFloat(atan2(sin,cos).toFixed(2))
// so the server only ever evaluates multiples of 0.01 rad. Judging an angle
// the server never sees is the defect: a raw angle and the angle it rounds to
// can fall on opposite sides of an object's edge, so the placer calls a spot
// free and the server drops the build (or the reverse — a legal spot skipped).
{
  const item = Items[SPIKE_ID];
  const w = 35 + item.scale + (item.placeOffset || 0);
  const R = item.scale + Items[16].scale;
  const d = 120;
  const wireAngle = a => parseFloat(Math.atan2(Math.sin(a), Math.cos(a)).toFixed(2));
  // One object dead ahead: the blocked arc is [-blockedHalf, +blockedHalf].
  const blockedHalf = Math.acos((w * w + d * d - R * R) / (2 * w * d));
  const free = angle => Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) > blockedHalf;

  let disagree = 0, n = 0;
  for (let k = -300; k <= 300; k++) {
    const raw = blockedHalf + k * 1e-4;
    n += 1;
    if (free(raw) !== free(wireAngle(raw))) disagree += 1;
  }
  check("raw and sent angles can disagree on the same spot", disagree > 0, disagree + "/" + n + " disagree");

  // Snapping first removes the gap by construction: the angle checked is the
  // angle sent, so the two verdicts are the same number.
  let mismatched = 0;
  for (let k = -300; k <= 300; k++) {
    const snapped = lunaSnap(blockedHalf + k * 1e-4);
    if (free(snapped) !== free(wireAngle(snapped))) mismatched += 1;
  }
  check("snapped angles never disagree with themselves", mismatched === 0, mismatched + " mismatched");

  // And the corner stepper: sweep the object's bearing so tangency lands at
  // every offset relative to the grid, and check both corners come out on the
  // free side of that object's arc every time.
  const env = makeClient({});
  const placer = new AutoPlacer(env.client);
  const angleFrom = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  let inside = 0, worst = Infinity;
  for (let k = 0; k < 600; k++) {
    const alpha = k * 1e-3;
    for (const sign of [ 1, -1 ]) {
      const got = placer._wireStepOut(alpha + sign * blockedHalf, sign);
      const gap = angleFrom(got, alpha) - blockedHalf;
      if (gap < 0) inside += 1;
      worst = Math.min(worst, gap);
    }
  }
  check("a stepped-out corner is always on the free side", inside === 0, inside + " inside, tightest +" + (worst * w).toFixed(3) + "px");
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

// 11 — fuzz. ModuleHandler runs the module list with no try/catch, so anything
// this module throws takes the whole tick with it. Randomised layouts, toggles
// and item availability, including the degenerate cases: no spike, no trap,
// neither, objects stacked on the player, and the enemy exactly on top of us.
{
  let threw = null, runs = 0;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  for (let i = 0; i < 4000 && !threw; i++) {
    const objects = [];
    const count = Math.floor(Math.random() * 8);
    for (let k = 0; k < count; k++) {
      objects.push(new PlayerObject(k + 1,
        7000 + (Math.random() - .5) * 500,
        3000 + (Math.random() - .5) * 500,
        pick([ SPIKE_ID, TRAP_ID, 16, 17 ]),
        pick([ 1, 2 ])));
    }
    const env = makeClient({
      enemyX: 7000 + (Math.random() - .5) * 800,
      enemyY: 3000 + (Math.random() - .5) * 800,
      objects: objects,
      imTrapped: Math.random() < .5,
      enemySpikeDamage: Math.random() < .5 ? 1 : 0,
      enemyPrimaryJustReady: Math.random() < .5,
      packetLimit: pick([ 0, 5, 70, 200 ])
    });
    // Sometimes the player has no spike, no trap, or neither.
    const haveSpike = Math.random() < .8, haveTrap = Math.random() < .8;
    env.client.myPlayer.getItemByType = type => type === 4 ? haveSpike ? SPIKE_ID : null : type === 7 ? haveTrap ? TRAP_ID : null : null;
    env.client.myPlayer.canPlace = () => Math.random() < .9;
    Settings_default._prePlace = Math.random() < .5;
    Settings_default._replace = Math.random() < .5;
    Settings_default._autoplacerRadius = pick([ 100, 350, 450 ]);
    timers = [];
    try {
      runs += 1;
      const placer = new AutoPlacer(env.client);
      placer.postTick();
      for (const t of timers) t.fn();
      placer.reset();
    } catch (e) {
      threw = e;
    }
  }
  Settings_default._prePlace = true;
  Settings_default._replace = true;
  Settings_default._autoplacerRadius = 350;
  check("postTick never throws across " + runs + " randomised ticks", threw === null, threw && (threw.message + "\n" + threw.stack));
}

console.log("\n" + (failures === 0 ? "all checks passed" : failures + " check(s) failed"));
process.exit(failures === 0 ? 0 : 1);
