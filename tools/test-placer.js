#!/usr/bin/env node
// Runs the placer out of RYN_v5.4.user.js against a mocked world.
//
// The module is lifted from the userscript verbatim — Items, ItemGroups,
// Config, the spatial grid and the placer block are cut out by their own
// source anchors, so a scenario here is running the same code the client runs,
// not a copy of it. Everything the placer reads that the harness does not
// supply from the script (Settings, DataHandler, the managers) is stubbed
// below to match the shapes in the client.
//
//   node tools/test-placer.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// RYN_PLACER_SCRIPT points the harness at another build of the script, which is
// how the cost of a change gets compared against the build before it.
const SCRIPT = process.env.RYN_PLACER_SCRIPT || path.join(__dirname, "..", "RYN_v5.4.user.js");
const source = fs.readFileSync(SCRIPT, "utf8");

function cut(startAnchor, endAnchor, { includeEnd = false } = {}) {
  const start = source.indexOf(startAnchor);
  if (start === -1) throw new Error(`anchor not found: ${startAnchor}`);
  const end = source.indexOf(endAnchor, start + startAnchor.length);
  if (end === -1) throw new Error(`end anchor not found: ${endAnchor}`);
  return source.slice(start, includeEnd ? end + endAnchor.length : end);
}

const parts = [
  cut("const Config = {", "const Config_default = Config;", { includeEnd: true }),
  cut("const ItemGroups = {", "const Items = ["),
  cut("const Items = [", "const WeaponVariants = ["),
  cut("const getAngleDist = (a, b) => {", "const wireAngle"),
  cut("const getAngleFromBitmask = (bitmask, rotate) => {", "const formatCode = "),
  cut("class SpatialHashGrid2D {", "class Sorting {"),
  cut("  const PLACER_SPIKE_TYPE = 4;", "  class TrapAnimal {")
];

// ── stubs ─────────────────────────────────────────────────────────────────
const prelude = `
const PI = Math.PI;
class PlayerObject {
  constructor(id, x, y, angle, scale, type, ownerID) {
    this.id = id;
    this.pos = { current: vec(x, y), previous: vec(x, y), future: vec(x, y) };
    this.angle = angle;
    this.scale = scale;
    this.type = type;
    this.ownerID = ownerID;
    const item = Items[type];
    this.itemGroup = item.itemGroup;
    this.health = "health" in item ? item.health : Infinity;
    this.collisionDivider = "colDiv" in item ? item.colDiv : 1;
  }
  get collisionScale() { return this.scale * this.collisionDivider; }
  get placementScale() { return this.scale; }
}
const DataHandler_default = {
  getWeapon: id => WEAPONS[id] || null,
  getItem: id => Items[id]
};
const Settings_default = SETTINGS;
`;

function vec(x, y) {
  return {
    x,
    y,
    distance(o) {
      return Math.hypot(this.x - o.x, this.y - o.y);
    },
    angle(o) {
      return Math.atan2(o.y - this.y, o.x - this.x);
    },
    copy() {
      return vec(this.x, this.y);
    },
    addDirection(a, d) {
      return vec(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d);
    }
  };
}

const WEAPONS = {
  0: { name: "tool hammer", range: 65, speed: 300, damage: 25 },
  1: { name: "hand axe", range: 70, speed: 400, damage: 30 },
  5: { name: "polearm", range: 142, speed: 700, damage: 45 },
  10: { name: "great hammer", range: 110, speed: 400, damage: 10 }
};

const SETTINGS = {
  _autoplacer: true,
  _prePlace: true,
  _replace: true,
  _placerSmart: true,
  _placerTrapped: true,
  _placerLearn: true,
  _autoplacerRadius: 350
};

const context = {
  console,
  performance: { now: () => Date.now() },
  window: {},
  setTimeout: (fn, ms) => {
    context.__timers.push({ fn, ms });
    return context.__timers.length;
  },
  clearTimeout: () => {},
  Math,
  vec,
  WEAPONS,
  SETTINGS,
  __timers: []
};
vm.createContext(context);
vm.runInContext(`${prelude}\n${parts.join("\n")}\nglobalThis.__AutoPlacer = AutoPlacer;\nglobalThis.__Items = Items;\nglobalThis.__Grid = SpatialHashGrid2D;`, context, { filename: "placer-extract.js" });

const AutoPlacer = context.__AutoPlacer;
const Items = context.__Items;
const SpatialHashGrid2D = context.__Grid;
const PlayerObject = vm.runInContext("PlayerObject", context);

const SPIKE_ID = 7; // greater spikes
const TRAP_ID = 15; // pit trap

// ── world ─────────────────────────────────────────────────────────────────
let nextObjectId = 1;

function makeWorld(options = {}) {
  const objectManager = {
    objects: new Map(),
    grid2D: new SpatialHashGrid2D(100),
    insertObject(object) {
      this.grid2D.insert(object.pos.current.x, object.pos.current.y, object.collisionScale, object.id);
      this.objects.set(object.id, object);
    },
    removeObject(object) {
      this.grid2D.remove(object.pos.current.x, object.pos.current.y, object.collisionScale, object.id);
      this.objects.delete(object.id);
    }
  };

  const player = (id, x, y, extra = {}) => ({
    id,
    inGame: true,
    scale: 35,
    speed: extra.speed ?? 0,
    move_dir: extra.moveDir ?? 0,
    isTrapped: extra.isTrapped ?? false,
    trappedIn: extra.trappedIn ?? null,
    spikeDamage: extra.spikeDamage ?? 0,
    hatID: 0,
    pos: {
      current: vec(x, y),
      previous: vec(x - (extra.vx ?? 0), y - (extra.vy ?? 0)),
      future: vec(x + (extra.vx ?? 0), y + (extra.vy ?? 0))
    },
    inventory: { 0: 0, 1: 10, 4: SPIKE_ID, 7: TRAP_ID },
    itemCount: new Map(options.counts ?? []),
    reload: [{ current: 1, max: 1, previous: 1 }, { current: 1, max: 1, previous: 1 }, { current: 1, max: 1, previous: 1 }],
    weapon: { primary: 0, secondary: 10 },
    get collisionScale() {
      return this.scale;
    },
    getItemByType(type) {
      const id = this.inventory[type];
      return id === undefined ? null : id;
    },
    getItemPlaceScale(id) {
      const item = Items[id];
      return this.scale + item.scale + item.placeOffset;
    },
    getItemCount(group) {
      const limits = { 2: 15, 5: 6 };
      return { count: this.itemCount.get(group) || 0, limit: limits[group] ?? 99 };
    },
    canPlace() {
      return true;
    },
    isReloaded() {
      return true;
    },
    getBuildingDamage() {
      return 100;
    }
  });

  const myPlayer = player(1, 5000, 5000, options.me ?? {});
  const enemy = player(2, options.enemy?.x ?? 5200, options.enemy?.y ?? 5000, options.enemy ?? {});

  const moduleHandler = {
    tickCount: options.tick ?? 100,
    activeModule: options.activeModule ?? null,
    packetCount: 0,
    packetLimit: 119,
    placeAngles: [null, []],
    placedOnce: false,
    moduleActive: false,
    autoattack: options.autoattack ?? false,
    forceWeapon: null,
    _autoBreakActive: options.autoBreak ?? false,
    _lastBreakAngle: options.breakAngle ?? null,
    _currentAngle: 0,
    _getPredictWeapon: () => 1,
    place(type, angle) {
      this.packetCount += 5;
      this.sent.push({ type, angle });
    },
    sent: []
  };

  const client = {
    isOwner: false,
    myPlayer,
    ObjectManager: objectManager,
    EnemyManager: { nearestEnemy: enemy },
    PlayerManager: { isEnemyByID: (ownerID) => ownerID !== myPlayer.id },
    PacketManager: { updateAngle() {} },
    SocketManager: { pong: options.ping ?? 60, minPingTime: options.minPing ?? 40 },
    InputHandler: { move: 0 },
    _ModuleHandler: moduleHandler
  };

  const addObject = (x, y, type, ownerID) => {
    const object = new PlayerObject(nextObjectId++, x, y, 0, Items[type].scale, type, ownerID);
    objectManager.insertObject(object);
    return object;
  };

  return { client, myPlayer, enemy, moduleHandler, objectManager, addObject };
}

// ── assertions ────────────────────────────────────────────────────────────
let failures = 0;
let checks = 0;

function check(name, condition, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail === undefined ? "" : ` — ${detail}`}`);
  }
}

function section(name) {
  console.log(`\n${name}`);
}

const placeScale = (id) => 35 + Items[id].scale + Items[id].placeOffset;
const landing = (world, angle, id) => ({
  x: world.myPlayer.pos.current.x + placeScale(id) * Math.cos(angle),
  y: world.myPlayer.pos.current.y + placeScale(id) * Math.sin(angle)
});

// ── scenario: enemy walking in, nothing placed yet ─────────────────────────
section("enemy closing, open ground");
{
  const world = makeWorld({ enemy: { x: 5130, y: 5000, vx: -18, vy: 0 } });
  const placer = new AutoPlacer(world.client);
  placer.postTick();
  const sent = world.moduleHandler.sent;
  check("places something", sent.length > 0, `sent ${sent.length}`);
  const spikes = sent.filter(s => s.type === 4);
  check("places a spike", spikes.length > 0, sent.map(s => s.type).join(" "));
  const towardEnemy = spikes.some(s => Math.cos(s.angle) > 0.5);
  check("spike goes out on the enemy's side", towardEnemy, spikes.map(s => s.angle.toFixed(2)).join(" "));
  const behind = spikes.filter(s => Math.cos(s.angle) < -0.7);
  check("nothing dumped behind me", behind.length === 0, behind.map(s => s.angle.toFixed(2)).join(" "));
  check("stays inside the send cap", sent.length <= 6, `sent ${sent.length}`);
}

// ── scenario: I am pinned, and the enemy is on open ground ────────────────
// The trap that holds me also blocks placement: it is an item, so the server
// refuses any build whose centre lands within trapScale + itemScale of it, and
// my place ring is only 82px across. Whether anything can be built at all is
// decided by where the trap sits, so both cases are worth pinning down.
section("pinned, open arc towards the enemy");
{
  // Walked into a trap that is now behind me; the enemy closes from the front.
  const world = makeWorld({ enemy: { x: 5100, y: 5000 } });
  const trap = world.addObject(4970, 5000, TRAP_ID, 2);
  world.myPlayer.isTrapped = true;
  world.myPlayer.trappedIn = trap;
  const placer = new AutoPlacer(world.client);
  placer.postTick();
  const sent = world.moduleHandler.sent;
  check("places while pinned", sent.length > 0, `sent ${sent.length}`);
  const facing = sent.filter(s => Math.cos(s.angle) > 0);
  check("builds go towards the enemy", facing.length > 0, sent.map(s => s.angle.toFixed(2)).join(" "));
  const reach = sent.filter(s => {
    const p = landing(world, s.angle, s.type === 7 ? TRAP_ID : SPIKE_ID);
    return Math.hypot(p.x - 5100, p.y - 5000) < 90;
  });
  check("at least one build can actually reach them", reach.length > 0);

  // Luna's ladder walks away from this situation entirely: every spike rung
  // needs the enemy trapped, and both trap rungs need neither of us trapped.
  const off = makeWorld({ enemy: { x: 5100, y: 5000 } });
  const offTrap = off.addObject(4970, 5000, TRAP_ID, 2);
  off.myPlayer.isTrapped = true;
  off.myPlayer.trappedIn = offTrap;
  SETTINGS._placerTrapped = false;
  SETTINGS._placerSmart = false;
  new AutoPlacer(off.client).postTick();
  check("toggles off restore Luna's silence", off.moduleHandler.sent.length === 0, `sent ${off.moduleHandler.sent.length}`);

  // The trapped switch alone has to hold, or it would be a switch that says it
  // is off while the scorer keeps placing.
  const gated = makeWorld({ enemy: { x: 5100, y: 5000 } });
  const gatedTrap = gated.addObject(4970, 5000, TRAP_ID, 2);
  gated.myPlayer.isTrapped = true;
  gated.myPlayer.trappedIn = gatedTrap;
  SETTINGS._placerSmart = true;
  new AutoPlacer(gated.client).postTick();
  check("the trapped switch holds on its own", gated.moduleHandler.sent.length === 0, `sent ${gated.moduleHandler.sent.length}`);
  SETTINGS._placerTrapped = true;
}

section("pinned by a trap sitting on top of me");
{
  // Trapped from the enemy's side, the trap centre a few pixels off me. Every
  // point on the place ring is inside trapScale + spikeScale of it, so there is
  // no legal build and the right number of packets to spend is none.
  const world = makeWorld({ enemy: { x: 5120, y: 5000 } });
  const trap = world.addObject(5010, 5000, TRAP_ID, 2);
  world.myPlayer.isTrapped = true;
  world.myPlayer.trappedIn = trap;
  const placer = new AutoPlacer(world.client);
  placer.postTick();
  check("no packets spent on builds the server would refuse", world.moduleHandler.sent.length === 0, `sent ${world.moduleHandler.sent.length}`);
  placer._tick = 1;
  placer._originX = 5000;
  placer._originY = 5000;
  const sealed = placer._probeAngles(SPIKE_ID, world.myPlayer, world.objectManager, null, null);
  check("the ring really is sealed", sealed.length === 0, `${sealed.length} candidates`);
  const open = placer._probeAngles(SPIKE_ID, world.myPlayer, world.objectManager, trap, null);
  check("and opens again once that trap is discounted", open.some(a => a.placeable));
}

// ── scenario: pinned, the trap is about to break ──────────────────────────
section("pinned, breaking out");
{
  context.__timers.length = 0;
  const world = makeWorld({
    enemy: { x: 5120, y: 5000 },
    autoBreak: true,
    breakAngle: 0
  });
  const trap = world.addObject(5000 + 40, 5000, TRAP_ID, 2);
  trap.health = 10; // one hit from going
  world.myPlayer.isTrapped = true;
  world.myPlayer.trappedIn = trap;
  world.moduleHandler._lastBreakAngle = 0;
  const placer = new AutoPlacer(world.client);
  placer.postTick();
  check("takes the slot it is breaking as the preplace target", placer._lastPrePlaceObj === trap, String(placer._lastPrePlaceObj && placer._lastPrePlaceObj.id));
  const pre = placer._predictObjects.filter(o => o.preplace);
  check("queues a preplace build", pre.length === 1, `queued ${pre.length}`);
  if (pre.length === 1) {
    const d = Math.hypot(pre[0].x - trap.pos.current.x, pre[0].y - trap.pos.current.y);
    check("aimed at the slot the trap vacates", d < trap.scale + pre[0].scale, `distance ${d.toFixed(1)}`);
    check("the slot is taken with a spike, not another trap", pre[0].id === SPIKE_ID, String(pre[0].id));
  }
  check("replace resend is scheduled", context.__timers.length >= 3, String(context.__timers.length));

  // The resends. The second one fires once the slot is free; the third is the
  // replace leg, which only fires while the spam flag is armed.
  const before = world.moduleHandler.sent.length;
  const timers = context.__timers.slice();
  const ordered = timers.slice().sort((a, b) => a.ms - b.ms);
  check("resends are ordered aim, preplace, replace", ordered.length === 3 && ordered[0].ms === 1);
  check("the preplace resend is aimed before the tick boundary", ordered[1].ms > 0 && ordered[1].ms < 111, String(ordered[1].ms));
  check("the replace resend follows it", ordered[2].ms >= ordered[1].ms, `${ordered[1].ms} then ${ordered[2].ms}`);
  ordered[1].fn();
  check("the slot is taken on the resend", world.moduleHandler.sent.length > before, `sent ${world.moduleHandler.sent.length - before}`);

  // Someone else got there first: the slot is occupied by an object that is not
  // the one we were waiting on, so the packets are not spent again.
  const queued = placer._predictObjects.find(o => o.preplace);
  world.addObject(queued.x, queued.y, SPIKE_ID, 2);
  const afterSteal = world.moduleHandler.sent.length;
  ordered[2].fn();
  check("a slot that filled up is not resent into", world.moduleHandler.sent.length === afterSteal, `sent ${world.moduleHandler.sent.length - afterSteal}`);
}

// ── scenario: the enemy is in my trap and it is about to break ────────────
section("enemy in my trap, breaking");
{
  const world = makeWorld({ enemy: { x: 5080, y: 5000 } });
  const trap = world.addObject(5080, 5000, TRAP_ID, 1); // mine, holding them
  trap.health = 10;
  // Their great hammer just came off reload, which is what makes the trap a
  // slot that is about to open.
  world.enemy.weapon = { primary: 0, secondary: 10 };
  world.enemy.reload[1] = { previous: 0, current: 1, max: 1 };
  const placer = new AutoPlacer(world.client);
  placer.postTick();

  check("the trap is seen as the slot about to open", placer._lastPrePlaceObj === trap, String(placer._lastPrePlaceObj && placer._lastPrePlaceObj.id));
  const pre = placer._predictObjects.filter(o => o.preplace);
  check("a preplace is queued", pre.length === 1, `queued ${pre.length}`);
  if (pre.length === 1) {
    check("it is a trap, not a spike", pre[0].id === TRAP_ID, `id ${pre[0].id}`);
    const hold = placer._trapHoldRadius(TRAP_ID, world.enemy);
    const d = Math.hypot(pre[0].x - 5080, pre[0].y - 5000);
    check("and it lands where it closes on them again", d <= hold, `distance ${d.toFixed(1)} vs hold ${hold}`);
  }
}

// ── scenario: the retrap memory ───────────────────────────────────────────
section("retrap memory");
{
  const world = makeWorld({ enemy: { x: 5080, y: 5000 } });
  const trap = world.addObject(5080, 5000, TRAP_ID, 1);
  const placer = new AutoPlacer(world.client);
  placer.postTick();
  check("the pin is written down", placer._retrapMemory.has(world.enemy.id));

  // The trap breaks. The object is gone and the enemy reads as free — the note
  // is the only thing left that knows a retrap is owed.
  world.objectManager.removeObject(trap);
  world.moduleHandler.tickCount += 1;
  world.moduleHandler.sent.length = 0;
  world.moduleHandler.packetCount = 0;
  placer.postTick();
  const sent = world.moduleHandler.sent;
  check("a trap goes straight back down", sent.length > 0 && sent[0].type === 7, sent.map(s => s.type).join(" "));
  if (sent.length > 0) {
    const p = landing(world, sent[0].angle, TRAP_ID);
    const hold = placer._trapHoldRadius(TRAP_ID, world.enemy);
    check("landing where it catches them", Math.hypot(p.x - 5080, p.y - 5000) <= hold, `distance ${Math.hypot(p.x - 5080, p.y - 5000).toFixed(1)}`);
  }

  // And it is not a standing order: the note ages out.
  world.moduleHandler.tickCount += 40;
  world.moduleHandler.sent.length = 0;
  world.moduleHandler.packetCount = 0;
  placer.postTick();
  check("the note expires", !placer._retrapMemory.has(world.enemy.id));
  const traps = world.moduleHandler.sent.filter(s => s.type === 7);
  const covering = traps.filter(s => {
    const p = landing(world, s.angle, TRAP_ID);
    return Math.hypot(p.x - 5080, p.y - 5000) <= placer._trapHoldRadius(TRAP_ID, world.enemy);
  });
  check("without one it is back to ordinary placing", covering.length === 0 || traps.length > covering.length);
}

// ── scenario: free arcs against brute force ───────────────────────────────
// The probe no longer samples angles and tests each one; it solves for the arc
// each blocker forbids and keeps the complement. That is only worth anything if
// it agrees with the collision test the server actually runs, so it is checked
// against a quarter-degree sweep over randomly built worlds.
section("free arcs vs a brute-force sweep");
{
  let seed = 20240816;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let falsePositives = 0;
  let falseNegatives = 0;
  let generated = 0;

  for (let round = 0; round < 60; round++) {
    const world = makeWorld({ enemy: { x: 5200, y: 5000 } });
    const objects = [];
    const count = 1 + Math.floor(random() * 7);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const dist = 40 + random() * 160;
      const type = random() < 0.5 ? SPIKE_ID : TRAP_ID;
      objects.push(world.addObject(5000 + Math.cos(angle) * dist, 5000 + Math.sin(angle) * dist, type, 1));
    }
    const placer = new AutoPlacer(world.client);
    placer._tick = round;
    placer._originX = 5000;
    placer._originY = 5000;

    const truth = (angle, id) => {
      const R = 35 + Items[id].scale + Items[id].placeOffset;
      const x = 5000 + R * Math.cos(angle);
      const y = 5000 + R * Math.sin(angle);
      for (const object of objects) {
        const reach = Items[id].scale + object.placementScale;
        if (Math.hypot(x - object.pos.current.x, y - object.pos.current.y) < reach) return false;
      }
      return true;
    };

    for (const id of [SPIKE_ID, TRAP_ID]) {
      const candidates = placer._probeAngles(id, world.myPlayer, world.objectManager, null, null);
      generated += candidates.length;
      for (const candidate of candidates) {
        // A candidate sits one inset inside its arc, so the truth test has to
        // hold at the angle itself.
        if (!truth(candidate.angle, id)) falsePositives += 1;
      }
      const blocked = placer._blockedArcs(id, world.myPlayer, world.objectManager);
      const free = placer._freeArcs(blocked, null);
      const step = Math.PI / 720; // a quarter of a degree
      for (let angle = 0; angle < Math.PI * 2; angle += step) {
        const open = truth(angle, id);
        const claimed = placer._inFreeArcs(free, angle);
        // Disagreement is only real away from a boundary, where the inset and
        // floating point put the two within a hair of each other.
        if (open === claimed) continue;
        const margin = step * 2;
        if (truth(angle - margin, id) === open && truth(angle + margin, id) === open) {
          if (claimed) falsePositives += 1; else falseNegatives += 1;
        }
      }
    }
  }
  check("no candidate lands on an object", falsePositives === 0, `${falsePositives} bad`);
  check("no free angle is missed", falseNegatives === 0, `${falseNegatives} missed`);
  check("candidates were actually produced", generated > 2000, `${generated} candidates`);
}

// ── scenario: cost ────────────────────────────────────────────────────────
section("cost");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000, vx: -14 } });
  for (let i = 0; i < 14; i++) {
    const angle = i / 14 * Math.PI * 2;
    world.addObject(5000 + Math.cos(angle) * (120 + (i % 3) * 40), 5000 + Math.sin(angle) * (120 + (i % 3) * 40), i % 2 ? SPIKE_ID : TRAP_ID, i % 2 ? 1 : 2);
  }
  const placer = new AutoPlacer(world.client);
  const rounds = 3000;
  const started = process.hrtime.bigint();
  for (let i = 0; i < rounds; i++) {
    world.moduleHandler.tickCount += 1;
    world.moduleHandler.packetCount = 0;
    world.moduleHandler.sent.length = 0;
    context.__timers.length = 0;
    placer.postTick();
  }
  const perTick = Number(process.hrtime.bigint() - started) / rounds / 1000;
  console.log(`  info a full tick costs ${perTick.toFixed(1)}us with 14 objects in range`);
  // The client has 111ms a tick and shares it with forty other modules. A
  // placer that needs a whole millisecond of it is a placer with a bug.
  check("a tick stays well under a millisecond", perTick < 1000, `${perTick.toFixed(1)}us`);
}

// ── scenario: item limits ─────────────────────────────────────────────────
section("item limits");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000 }, counts: [[2, 15], [5, 6]] });
  new AutoPlacer(world.client).postTick();
  check("caps stop every send", world.moduleHandler.sent.length === 0, `sent ${world.moduleHandler.sent.length}`);
}

// ── scenario: a spike-tick module owns the tick ───────────────────────────
section("another module owns the tick");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000 }, activeModule: "spikeSync" });
  new AutoPlacer(world.client).postTick();
  check("placer stands down", world.moduleHandler.sent.length === 0, `sent ${world.moduleHandler.sent.length}`);
}

// ── scenario: packing against a blocker ───────────────────────────────────
section("packing against a blocker");
{
  const world = makeWorld({ enemy: { x: 5200, y: 5000 } });
  // Two spikes of my own, so the free ring has real ends to pack against.
  const first = world.addObject(5000, 5082, SPIKE_ID, 1);
  const second = world.addObject(5058, 5058, SPIKE_ID, 1);
  const placer = new AutoPlacer(world.client);
  placer._tick = 1;
  placer._originX = world.myPlayer.pos.current.x;
  placer._originY = world.myPlayer.pos.current.y;
  const angles = placer._probeAngles(SPIKE_ID, world.myPlayer, world.objectManager, null, null);
  const packed = angles.filter(a => a.perfect);
  check("free arcs have packed ends", packed.length > 0, `packed ${packed.length}`);

  // Packed means packed: each one has to sit within a whisker of touching the
  // blocker that closes its arc, which the 5° probe grid could only manage by
  // luck.
  const gapTo = (candidate) => Math.min(...[first, second].map(object => {
    const reach = candidate.scale + object.placementScale;
    return Math.hypot(candidate.x - object.pos.current.x, candidate.y - object.pos.current.y) - reach;
  }));
  const tight = packed.filter(a => gapTo(a) < 1);
  check("each sits against the blocker that closes it", tight.length === packed.length, `${tight.length}/${packed.length}`);
  const offGrid = packed.filter(a => {
    const step = Math.PI * 2 / 72;
    const rem = a.angle % step;
    return Math.min(rem, step - rem) > 1e-6;
  });
  check("and off the probe grid, where the exact angle is", offGrid.length === packed.length, `${offGrid.length}/${packed.length}`);

  // Nothing may be proposed on top of an existing object.
  const wrong = angles.filter(a => {
    for (const object of world.objectManager.objects.values()) {
      const reach = a.scale + object.placementScale;
      if (Math.hypot(a.x - object.pos.current.x, a.y - object.pos.current.y) < reach - 1e-6) return true;
    }
    return false;
  });
  check("no candidate overlaps an object", wrong.length === 0, `${wrong.length} bad`);
}

// ── scenario: an aimed angle that is blocked ──────────────────────────────
// Auraro's placer solves for one angle and then snaps it into the nearest free
// arc, because a single blocked angle would otherwise be nothing at all. This
// one enumerates every free angle and scores them, so the nearest free angle to
// a blocked aim is already a candidate — worth proving rather than assuming,
// since if it were not true the aimed angles would silently vanish.
section("an aimed angle that is blocked");
{
  const world = makeWorld({ enemy: { x: 5120, y: 5000 } });
  // Park a spike exactly where the angle straight at the enemy would land.
  world.addObject(5000 + (35 + Items[SPIKE_ID].scale + Items[SPIKE_ID].placeOffset), 5000, SPIKE_ID, 1);
  const placer = new AutoPlacer(world.client);
  placer._tick = 1;
  placer._originX = 5000;
  placer._originY = 5000;
  const candidates = placer._probeAngles(SPIKE_ID, world.myPlayer, world.objectManager, null, [0]);
  const aimed = candidates.filter(a => a.aimed);
  check("the blocked aim itself is dropped", aimed.length === 0, `${aimed.length} kept`);
  const off = angle => {
    const d = Math.abs(angle) % (Math.PI * 2);
    return d > Math.PI ? Math.PI * 2 - d : d;
  };
  const nearest = Math.min(...candidates.map(a => off(a.angle)));

  // What the snap would have returned: the closest angle to the aim that the
  // server would actually accept, found the slow way.
  const R = 35 + Items[SPIKE_ID].scale + Items[SPIKE_ID].placeOffset;
  let trueNearest = Infinity;
  for (let angle = -Math.PI; angle < Math.PI; angle += Math.PI / 3600) {
    const x = 5000 + R * Math.cos(angle);
    const y = 5000 + R * Math.sin(angle);
    let free = true;
    for (const object of world.objectManager.objects.values()) {
      const reach = Items[SPIKE_ID].scale + object.placementScale;
      if (Math.hypot(x - object.pos.current.x, y - object.pos.current.y) < reach) {
        free = false;
        break;
      }
    }
    if (free) trueNearest = Math.min(trueNearest, off(angle));
  }
  check("the candidate set already holds the nearest free angle", Math.abs(nearest - trueNearest) < 0.02, `candidate ${nearest.toFixed(3)} vs best possible ${trueNearest.toFixed(3)}`);
}

// ── scenario: the recorder ────────────────────────────────────────────────
section("recorder");
{
  const world = makeWorld({ enemy: { x: 5200, y: 5000 }, me: { vx: 12, vy: 0, speed: 12, moveDir: 0 } });
  world.client.isOwner = true;
  const placer = new AutoPlacer(world.client);
  placer.postTick();
  const recorder = placer.recorder;
  check("sends are recorded", recorder.sent > 0, `recorded ${recorder.sent}`);
  check("insertObject is wrapped", recorder.attached);

  // The server built it a tick further along than I predicted: same angle,
  // origin one step ahead.
  const first = recorder.pending[0];
  const item = Items[first.itemId];
  const dist = 35 + item.scale + item.placeOffset;
  const serverOriginX = first.originX + 12;
  world.objectManager.insertObject(new PlayerObject(
    9001,
    serverOriginX + dist * Math.cos(first.angle),
    first.originY + dist * Math.sin(first.angle),
    first.angle,
    item.scale,
    first.itemId,
    world.myPlayer.id
  ));
  check("the object is matched to its send", recorder.confirmed === 1, `confirmed ${recorder.confirmed}`);
  check("the lead is learned from it", recorder.leadTicks > 0, `leadTicks ${recorder.leadTicks.toFixed(3)}`);
  check("stats read back", recorder.stats.successRate === 1, JSON.stringify(recorder.stats.successRate));

  // A send nothing ever comes back for is a dead angle.
  const before = recorder.dropped;
  const dead = recorder.pending.find(entry => !entry.done);
  if (dead) {
    dead.sentAt -= 5000;
    let banned = null;
    recorder.sweep((entry) => {
      banned = entry.angle;
    });
    check("an unanswered send is swept", recorder.dropped > before, `dropped ${recorder.dropped}`);
    check("and reported for banning", banned !== null);
  }
}

// ── scenario: nobody around ───────────────────────────────────────────────
section("no enemy");
{
  const world = makeWorld({ enemy: { x: 5200, y: 5000 } });
  world.client.EnemyManager.nearestEnemy = null;
  new AutoPlacer(world.client).postTick();
  check("nothing sent", world.moduleHandler.sent.length === 0);
}

// ── scenario: enemy out of the placer's radius ────────────────────────────
section("enemy beyond the radius");
{
  const world = makeWorld({ enemy: { x: 5000 + 900, y: 5000 } });
  new AutoPlacer(world.client).postTick();
  check("nothing sent", world.moduleHandler.sent.length === 0, `sent ${world.moduleHandler.sent.length}`);
}

// ── scenario: packet budget ───────────────────────────────────────────────
section("packet budget");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000 } });
  world.moduleHandler.packetCount = 118;
  new AutoPlacer(world.client).postTick();
  check("a spent budget sends nothing", world.moduleHandler.sent.length === 0, `sent ${world.moduleHandler.sent.length}`);
}

// ── scenario: the budget reserve ──────────────────────────────────────────
section("budget reserve");
{
  // Not out of packets, but close enough that the rest of the second belongs to
  // heal and anti-insta.
  const world = makeWorld({ enemy: { x: 5130, y: 5000, vx: -18 } });
  world.moduleHandler.packetCount = 100;
  new AutoPlacer(world.client).postTick();
  check("the placer yields before the last of the allowance", world.moduleHandler.sent.length === 0, `sent ${world.moduleHandler.sent.length}`);

  // With room to spare it spends normally, and never more than the cap.
  const easy = makeWorld({ enemy: { x: 5130, y: 5000, vx: -18 } });
  easy.moduleHandler.packetCount = 0;
  new AutoPlacer(easy.client).postTick();
  check("and spends when there is room", easy.moduleHandler.sent.length > 0);
  check("never past the per-tick cap", easy.moduleHandler.sent.length <= 6, `sent ${easy.moduleHandler.sent.length}`);
}

// ── scenario: boost pad in the trap slot ──────────────────────────────────
section("boost pad in the trap slot");
{
  const world = makeWorld({ enemy: { x: 5150, y: 5000 } });
  world.myPlayer.inventory[7] = 16; // boost pad, not a trap
  new AutoPlacer(world.client).postTick();
  const traps = world.moduleHandler.sent.filter(s => s.type === 7);
  check("nothing is placed through the trap ladder", traps.length === 0, `sent ${traps.length}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
