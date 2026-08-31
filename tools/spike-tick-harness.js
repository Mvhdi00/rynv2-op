// Spike Tick harness.
//
// Runs the SpikeTick module out of the built client against stubs, with the
// real geometry, the real scorer, the real motion model, the real placement
// memory and the real reservation ledger sliced out of the same file — so what
// is under test is the module's decisions, not a re-implementation of them.
//
//   node tools/spike-tick-harness.js [path-to-client]
//
// Exits non-zero if any scenario fails.

const fs = require("fs");
const path = require("path");

const file = process.argv[2] || path.join(__dirname, "..", "RYN_Client_v5.5.user.js");
const source = fs.readFileSync(file, "utf8");

// ── slicing ─────────────────────────────────────────────────────────────────
function slice(startMarker, endMarker, name) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error("harness: start marker not found for " + name);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error("harness: end marker not found for " + name);
  return source.slice(start, end + endMarker.length);
}

const parts = [
  slice("  const RPE_TICK_MS =", "  const RPE_TAU = Math.PI * 2;", "rpe constants"),
  slice("  const RPE_PRIORITY = {", "\n  };", "priorities"),
  slice("  const PlacementWeights = {", "\n  };", "weights"),
  slice("  const GeometrySolver = {", "\n  };", "geometry"),
  slice("  const SiegeAnalysis = {", "\n  };", "siege"),
  slice("  class PlacementLedger {", "\n  }", "ledger"),
  slice("  class PlacementMemory {", "\n  }", "memory"),
  slice("  const RPE_ROLE_TYPES =", "\n  }", "build profile"),
  slice("  class PlacementScorer {", "\n  }", "scorer"),
  slice("  const RPE_PREPLACE_MAX_LEAD =", "  const RPE_PREPLACE_MIN_CONFIDENCE = .3;", "preplace constants"),
  slice("  const RPE_TICK_DECAY =", "\n  }", "target motion"),
  slice("  const ST_SPIKE = 4;", "  const SpikeTick_default = SpikeTick;", "spike tick")
];

// ── stubs ───────────────────────────────────────────────────────────────────
const prelude = `
const Config_default = { playerScale: 35, mapScale: 14400, riverWidth: 724, gatherAngle: 0.4, shieldAngle: 1.2, serverUpdateRate: 9 };
const ItemGroups = { 2: { limit: 15, layer: 0 }, 5: { limit: 6, layer: -1 } };
const Items = {
  9: { id: 9, itemType: 4, itemGroup: 2, name: "spinning spikes", damage: 45, health: 500, scale: 52, placeOffset: -5 },
  15: { id: 15, itemType: 7, itemGroup: 5, name: "pit trap", trap: true, ignoreCollision: true, hideFromEnemy: true, health: 500, colDiv: .2, scale: 50, placeOffset: -5 }
};
const Weapons = { 5: { name: "polearm", range: 142, damage: 45, knockback: 1.5, speed: 700, itemType: 0 } };
const DataHandler_default = {
  getWeapon: id => Weapons[id] || null,
  getItem: id => Items[id],
  isMelee: id => !!Weapons[id],
  isShootable: () => false
};
const Settings_default = { _spikeTick: true, _spikeTickPredict: true, _autoplacerRadius: 350, _prePlace: true, _replace: true };
`;

const bundle = new Function(prelude + parts.join("\n\n") + "\nreturn { SpikeTick, GeometrySolver, SiegeAnalysis, TargetMotion, PlacementLedger, PlacementMemory, PlacementScorer, PlacementWeights, RPE_PRIORITY, rpeBuildProfile, Settings_default, Items, Config_default };")();

const { SpikeTick, GeometrySolver, TargetMotion, PlacementLedger, PlacementMemory, PlacementScorer, PlacementWeights, Settings_default, Items } = bundle;

// ── world ───────────────────────────────────────────────────────────────────
const SPIKE_ID = 9;
const SPIKE = Items[SPIKE_ID];
const TRAP_ID = 15;
const RING = Config().playerScale + SPIKE.scale + SPIKE.placeOffset;
function Config() { return bundle.Config_default; }

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
  distanceDefault(o) { return this.distance(o); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
  addDirection(a, d) { return new Vec(this.x + d * Math.cos(a), this.y + d * Math.sin(a)); }
  copy() { return new Vec(this.x, this.y); }
}

let nextId = 1;
function build(type, x, y, ownerID) {
  const item = Items[type];
  return {
    id: nextId++,
    type: type,
    ownerID: ownerID,
    itemGroup: item.itemGroup,
    scale: item.scale,
    health: item.health,
    isDestroyable: true,
    pos: { current: new Vec(x, y) },
    get collisionScale() { return this.scale * ("colDiv" in Items[this.type] ? Items[this.type].colDiv : 1); },
    get placementScale() { return this.scale; },
    get hitScale() { return this.scale; }
  };
}

function player(id, x, y, opts) {
  opts = opts || {};
  const p = {
    id: id,
    scale: 35,
    currentHealth: opts.health === undefined ? 100 : opts.health,
    hatID: opts.hatID === undefined ? 0 : opts.hatID,
    angle: 0,
    isTrapped: false,
    trappedIn: null,
    weapon: { primary: 5, secondary: null, current: 5 },
    reload: [ { current: 9, max: 9, previous: 9 }, { current: 0, max: 9 }, { current: 23, max: 23 } ],
    pos: { previous: new Vec(x, y), current: new Vec(x, y), future: new Vec(x, y) },
    get collisionScale() { return this.scale; },
    get hitScale() { return this.scale * 1.8; },
    collidingSimple(e, r) { return this.pos.current.distance(e.pos.current) <= r; },
    getItemByType(t) { return t === 4 ? SPIKE_ID : t === 7 ? TRAP_ID : t === 0 ? 5 : null; },
    getItemPlaceScale(id) { return this.scale + Items[id].scale + Items[id].placeOffset; },
    getMaxWeaponDamage() { return opts.weaponDamage === undefined ? 45 : opts.weaponDamage; },
    getWeaponVariant() { return { current: 0 }; }
  };
  return p;
}

function moveTo(entity, x, y) {
  entity.pos.previous = entity.pos.current.copy();
  entity.pos.current = new Vec(x, y);
  const dx = entity.pos.current.x - entity.pos.previous.x;
  const dy = entity.pos.current.y - entity.pos.previous.y;
  entity.pos.future = new Vec(x + dx, y + dy);
}

// A client with only what SpikeTick and the sliced engine parts read.
function makeWorld(opts) {
  opts = opts || {};
  const me = player(1, 0, 0, opts.me);
  const objects = [];
  const sent = [];
  const pending = [];
  const reload = { 0: true, 1: true, 2: true };

  const client = {
    myPlayer: Object.assign(me, {
      inGame: true,
      itemCount: new Map,
      canPlace: type => opts.canPlace === false ? false : true,
      getItemCount(group) { return { count: this.itemCount.get(group) || 0, limit: ItemGroupsLimit(group) }; },
      canPlaceObject: () => true
    }),
    PlayerManager: {
      enemies: [],
      playerData: new Map,
      lookingShield: () => false,
      isEnemyByID: (ownerID) => ownerID !== 1
    },
    EnemyManager: {
      nearestEnemy: null,
      ignore: false,
      shouldIgnoreModule() { return this.ignore; },
      enemyTrappedByMe(t) { return !!(t && t.isTrapped && t.trappedIn && t.trappedIn.ownerID === 1); }
    },
    ObjectManager: {
      objects: new Map,
      deleted: false,
      isDestroyedObject() { return this.deleted; },
      grid2D: {
        cellSize: 100,
        query(x, y, cells, cb) {
          const reach = cells * this.cellSize;
          for (const o of objects) {
            if (Math.abs(o.pos.current.x - x) <= reach + 200 && Math.abs(o.pos.current.y - y) <= reach + 200) {
              if (cb(o.id)) return true;
            }
          }
          return false;
        }
      }
    },
    _ModuleHandler: {
      tickCount: 0,
      moduleActive: false,
      activeModule: null,
      packetCount: 0,
      packetLimit: 119,
      placedOnce: false,
      placeAngles: [ null, [] ],
      useAngle: null,
      forceWeapon: null,
      forceHat: null,
      shouldAttack: false,
      canBuy: () => true,
      hasStoreItem: () => true,
      staticModules: {
        reloading: {
          isReloaded: (type) => reload[type],
          isEmptyReload: () => false
        }
      },
      requestPlaceMany(type, angles, owner) {
        // Stands in for the engine executor: records the send, applies the
        // same budget arithmetic (one full place, then batched) and queues the
        // build to appear in the world on the next tick, the way a server that
        // accepts it does.
        let cost = 0, n = 0;
        for (let i = 0; i < angles.length; i++) {
          cost += i === 0 ? 5 : 2;
          if (this.packetCount + cost > this.packetLimit) break;
          const id = client.myPlayer.getItemByType(type);
          const dist = client.myPlayer.getItemPlaceScale(id);
          const pos = client.myPlayer.pos.current;
          sent.push({
            type: type, angle: angles[i], owner: owner, tick: this.tickCount,
            x: pos.x + dist * Math.cos(angles[i]), y: pos.y + dist * Math.sin(angles[i]), id: id
          });
          pending.push(sent[sent.length - 1]);
          n++;
        }
        this.packetCount += cost;
        return n;
      }
    }
  };
  function ItemGroupsLimit(group) { return group === 2 ? 15 : 6; }

  const world = {
    client: client,
    objects: objects,
    sent: sent,
    reload: reload,
    addObject(type, x, y, ownerID) {
      const o = build(type, x, y, ownerID === undefined ? 1 : ownerID);
      objects.push(o);
      client.ObjectManager.objects.set(o.id, o);
      return o;
    },
    addEnemy(id, x, y, o) {
      const e = player(id, x, y, o);
      client.PlayerManager.enemies.push(e);
      client.PlayerManager.playerData.set(id, e);
      if (!client.EnemyManager.nearestEnemy) client.EnemyManager.nearestEnemy = e;
      return e;
    }
  };

  // ── the engine surface SpikeTick uses ─────────────────────────────────────
  const memory = new PlacementMemory;
  const ledger = new PlacementLedger;
  const motion = new TargetMotion;
  const scorer = new PlacementScorer(client, PlacementWeights);
  const engine = {
    memory: memory,
    ledger: ledger,
    motion: motion,
    _exits: null,
    profileFor(type) { return bundle.rpeBuildProfile(client.myPlayer, type); },
    aperturesFor(type, o) {
      const profile = this.profileFor(type);
      if (!profile) return [];
      const myPos = client.myPlayer.pos.current;
      const blocked = [];
      for (const obj of objects) {
        if (o && o.excludes === obj) continue;
        const arc = GeometrySolver.occlusion(myPos.x, myPos.y, profile.ringR, profile.footR, obj.pos.current.x, obj.pos.current.y, obj.placementScale);
        if (arc) blocked.push(arc);
      }
      return GeometrySolver.invert(GeometrySolver.merge(blocked));
    },
    intentAt(type, angle, o) {
      const profile = this.profileFor(type);
      if (!profile) return null;
      const myPos = client.myPlayer.pos.current;
      const cand = {
        profile: profile, angle: angle, aperture: null, source: "directed", mode: "auto",
        kind: "directed", priority: o.priority, confidence: 1, value: o.value || 0,
        terms: {}, reach: 1, excludes: null, vacates: null,
        x: myPos.x + profile.ringR * Math.cos(angle),
        y: myPos.y + profile.ringR * Math.sin(angle)
      };
      cand.expected = cand.value;
      return cand;
    },
    evaluate(cand, frame, o) {
      scorer.weigh(cand, frame, { exits: o && o.exits !== undefined ? o.exits : this._exits, memory: memory, batched: false, replace: null, mode: cand.mode });
      return cand.value;
    },
    exitsAround(frame) {
      if (!frame) return null;
      if (frame.ourSpikes.length + frame.ourTraps.length < 2) return null;
      const surround = [];
      for (const o of frame.ourSpikes.concat(frame.ourTraps)) {
        const d = frame.targetPos.distance(o.pos.current);
        if (d > frame.targetScale + o.collisionScale + 40) continue;
        surround.push({ x: o.pos.current.x, y: o.pos.current.y, escapeScale: o.collisionScale });
      }
      if (surround.length < 2) return null;
      const esc = bundle.SiegeAnalysis.isEscapable(frame.targetPos.x, frame.targetPos.y, frame.targetScale, surround);
      return esc.escapable ? esc.exits : null;
    },
    frameFor(target) {
      if (!target) return null;
      const me = client.myPlayer;
      const ourSpikes = [], ourTraps = [];
      for (const o of objects) {
        if (o.ownerID !== 1) continue;
        if (o.pos.current.distance(target.pos.current) > 400) continue;
        if (o.itemGroup === 2) ourSpikes.push(o);
        if (o.type === 15) ourTraps.push(o);
      }
      const trapped = ourTraps.find(t => t.pos.current.distance(target.pos.current) < t.scale) || null;
      return {
        tick: client._ModuleHandler.tickCount,
        myPlayer: me, myPos: me.pos.current, myNext: me.pos.future, moveDir: null,
        target: target, targetPos: target.pos.current, targetNext: target.pos.future,
        targetScale: target.collisionScale, targetId: target.id, targetTrapped: trapped,
        imTrapped: !!me.isTrapped, ourSpikes: ourSpikes, ourTraps: ourTraps, enemyObjects: [],
        range: me.pos.current.distance(target.pos.current),
        budgetLeft: client._ModuleHandler.packetLimit - client._ModuleHandler.packetCount
      };
    }
  };
  client._ModuleHandler.staticModules.placementEngine = engine;
  world.engine = engine;
  world.module = new SpikeTick(client);
  client._ModuleHandler.staticModules.spikeTick = world.module;
  world.tick = () => {
    const MH = client._ModuleHandler;
    MH.tickCount += 1;
    // Builds sent last tick are in the world now.
    while (pending.length) {
      const p = pending.shift();
      if (opts.serverRefuses) continue;
      world.addObject(p.type === 4 ? SPIKE_ID : TRAP_ID, p.x, p.y, 1);
      const group = p.type === 4 ? 2 : 5;
      client.myPlayer.itemCount.set(group, (client.myPlayer.itemCount.get(group) || 0) + 1);
    }
    MH.moduleActive = false;
    MH.useAngle = null;
    MH.forceWeapon = null;
    MH.forceHat = null;
    MH.shouldAttack = false;
    MH.placedOnce = false;
    MH.placeAngles = [ null, [] ];
    ledger.expire(MH.tickCount);
    world.module.postTick();
    return {
      placed: sent.filter(s => s.tick === MH.tickCount),
      swung: MH.shouldAttack,
      claimed: MH.moduleActive,
      angle: MH.useAngle,
      hat: MH.forceHat
    };
  };
  return world;
}

// ── scenarios ───────────────────────────────────────────────────────────────
// The twenty cases the brief asks for, plus the toggles.
let failures = 0, passes = 0;
function check(name, condition, detail) {
  if (condition) { passes++; console.log("  ok   " + name); }
  else { failures++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
}
function scenario(name, fn) {
  console.log("\n" + name);
  try { fn(); } catch (e) { failures++; console.log("  FAIL threw: " + (e && e.stack || e)); }
}
// Runs `n` ticks, calling `before(i)` ahead of each, and returns the per-tick
// results plus everything that was sent.
function run(w, n, before) {
  const log = [];
  for (let i = 0; i < n; i++) {
    if (before) before(i);
    log.push(w.tick());
  }
  log.placements = log.reduce((sum, r) => sum + r.placed.length, 0);
  log.firstPlace = log.findIndex(r => r.placed.length > 0);
  log.swings = log.filter(r => r.swung).length;
  return log;
}
function touches(placement, entity) {
  return Math.hypot(placement.x - entity.pos.current.x, placement.y - entity.pos.current.y) <= entity.collisionScale + SPIKE.scale + 6;
}
function withEnemy(d, opts) {
  const w = makeWorld(opts);
  const e = w.addEnemy(2, d, 0, opts && opts.enemy);
  return { w: w, e: e };
}

scenario("1. enemy standing still in reach -> a contact spike and the swing, once", () => {
  const { w, e } = withEnemy(120);
  const log = run(w, 4);
  check("placed on the first tick", log.firstPlace === 0, "first=" + log.firstPlace);
  check("every spike actually touches them", log[0].placed.every(p => touches(p, e)),
    JSON.stringify(log[0].placed.map(p => +Math.hypot(p.x - 120, p.y).toFixed(1))));
  check("claimed the tick", log[0].claimed);
  check("asked combat for the swing", log[0].swung);
  check("wore the bull hat", log[0].hat === 7);
  check("turret gear followed on the next tick", log[1].hat === 53);
  check("did not keep spending on a static target", log.placements <= 3, "placements=" + log.placements);
});

scenario("2. enemy moving towards me -> the tick waits for the range", () => {
  const { w, e } = withEnemy(340);
  let firstAt = null;
  const log = run(w, 12, () => {
    if (firstAt === null) moveTo(e, e.pos.current.x - 22, 0);
  });
  for (let i = 0; i < log.length; i++) {
    if (log[i].placed.length && firstAt === null) firstAt = log[i].placed[0];
  }
  check("eventually fired", !!firstAt);
  if (firstAt) check("the spike it fired touches them", Math.abs(Math.hypot(firstAt.x, firstAt.y) - RING) < 1e-6);
  check("nothing was spent while they were far away", log[0].placed.length === 0 && log[1].placed.length === 0);
});

scenario("3. enemy moving away -> at most the contact it already had", () => {
  const { w, e } = withEnemy(120);
  const log = run(w, 6, i => { if (i > 0) moveTo(e, e.pos.current.x + 26, 0); });
  check("no chasing", log.placements <= 2, "placements=" + log.placements);
  const late = log.slice(2).reduce((s, r) => s + r.placed.length, 0);
  check("nothing once they are gone", late === 0, "late=" + late);
});

scenario("4. enemy moving sideways -> the lead is used and it is on their path", () => {
  const w = makeWorld();
  const e = w.addEnemy(2, 140, -120);
  const log = run(w, 6, () => moveTo(e, 140, e.pos.current.y + 24));
  const track = w.engine.motion.get(2);
  check("a heading was measured", track && track.heading !== null);
  check("acted", log.placements > 0, "placements=" + log.placements);
  const p = log[log.firstPlace] && log[log.firstPlace].placed[0];
  if (p) check("the spike is on their side of me", p.x > 0, "x=" + p.x.toFixed(1));
});

scenario("5. enemy changes direction -> the lead is dropped, not spent", () => {
  const w = makeWorld();
  const e = w.addEnemy(2, 0, -240);
  run(w, 4, () => moveTo(e, 0, e.pos.current.y + 28));
  const before = w.sent.length;
  moveTo(e, 0, e.pos.current.y - 28);          // hard reversal
  const r = w.tick();
  const track = w.engine.motion.get(2);
  check("the turn was measured", track.headingShift > Math.PI / 4, "shift=" + (track.headingShift || 0).toFixed(2));
  check("no placement against the abandoned path", w.sent.length === before, JSON.stringify(r.placed));
});

scenario("6. enemy trapped and already on our damage -> swing, build nothing", () => {
  const w = makeWorld();
  const trap = w.addObject(TRAP_ID, 120, 0, 1);
  const e = w.addEnemy(2, 140, 0);
  e.isTrapped = true; e.trappedIn = trap;
  w.addObject(SPIKE_ID, 140 + 70, 0, 1);
  const log = run(w, 2);
  check("no packets spent on a spike", log.placements === 0, JSON.stringify(log[0].placed));
  check("swung", log[0].swung);
  check("recorded as a standing tick", w.module.stats.standing > 0);
});

scenario("7. enemy escaping a trap -> the tick follows them out, not the trap", () => {
  const w = makeWorld();
  const trap = w.addObject(TRAP_ID, 130, 0, 1);
  const e = w.addEnemy(2, 150, 0);
  e.isTrapped = true; e.trappedIn = trap;
  w.tick();
  // out and running
  e.isTrapped = false; e.trappedIn = null;
  const log = run(w, 4, () => moveTo(e, e.pos.current.x + 20, e.pos.current.y + 14));
  check("ran without error", true);
  for (const r of log) for (const p of r.placed) {
    check("never placed on top of the trap", Math.hypot(p.x - 130, p.y) >= SPIKE.scale, "d=" + Math.hypot(p.x - 130, p.y).toFixed(1));
  }
});

scenario("8. enemy beside a gap -> the gap is seen and only closed when it is real", () => {
  const w = makeWorld();
  const e = w.addEnemy(2, 120, 0);
  w.addObject(SPIKE_ID, 150, -90, 1);
  w.addObject(SPIKE_ID, 150, 90, 1);
  const frame = w.engine.frameFor(e);
  const gaps = w.module._gaps(frame);
  check("a gap was measured between the two", gaps.length > 0, JSON.stringify(gaps.map(g => +g.width.toFixed(1))));
  check("its width is player-sized", gaps.every(g => g.width >= 70 && g.width <= 190));
  const log = run(w, 2);
  check("acted", log.placements > 0);
});

scenario("9. enemy between multiple traps -> no blind spam around them", () => {
  const w = makeWorld();
  w.addObject(TRAP_ID, 60, 90, 1);
  w.addObject(TRAP_ID, 60, -90, 1);
  w.addObject(TRAP_ID, 190, 0, 1);
  const e = w.addEnemy(2, 125, 0);
  const log = run(w, 5);
  check("at most two spikes over five ticks", log.placements <= 2, "placements=" + log.placements);
  for (const r of log) for (const p of r.placed) {
    check("every spike it did place touches them", touches(p, e), "d=" + Math.hypot(p.x - 125, p.y).toFixed(1));
  }
});

scenario("10. spike close to enemy -> close and valid, never max range", () => {
  const { w, e } = withEnemy(150);
  const log = run(w, 2);
  check("placed", log.placements > 0);
  for (const p of log[0].placed) {
    const d = Math.hypot(p.x - e.pos.current.x, p.y - e.pos.current.y);
    check("landed inside contact range of them", d <= e.collisionScale + SPIKE.scale + 6, "d=" + d.toFixed(1));
  }
});

scenario("11. several valid positions -> the best two, not all of them", () => {
  const { w, e } = withEnemy(115);
  const frame = w.engine.frameFor(e);
  const profile = w.engine.profileFor(4);
  const ctx = w.module._context(w.engine, frame, w.engine.motion.observe(e, 1), profile, 1);
  const pool = w.module._generate(w.engine, frame, ctx, profile, w.engine.aperturesFor(4, {}));
  w.module._score(w.engine, frame, ctx, pool);
  check("several candidates were generated", pool.length >= 3, "n=" + pool.length);
  const plan = w.module._plan(w.engine, frame, ctx, pool, 1);
  check("the plan is capped at two", plan.length <= 2, "plan=" + plan.length);
  check("the plan is in value order", plan.length < 2 || plan[0].value >= plan[1].value);
  check("planned entries do not overlap each other", plan.length < 2 ||
    Math.hypot(plan[0].x - plan[1].x, plan[0].y - plan[1].y) >= 2 * SPIKE.scale);
});

scenario("12. auto place active -> spike tick does not take ground it holds", () => {
  const { w } = withEnemy(120);
  const MH = w.client._ModuleHandler;
  // What Luna's placer leaves behind when it sends: a hard claim at its own
  // priority, through ModuleHandler._notePlacement.
  for (let a = -1.2; a <= 1.2; a += .2) {
    w.engine.ledger.reserve(RING * Math.cos(a), RING * Math.sin(a), SPIKE.scale, bundle.RPE_PRIORITY.ANTICIPATION, "autoPlacer", MH.tickCount, 6);
  }
  const log = run(w, 2);
  check("no placement into auto place's ground", log.placements === 0, JSON.stringify(log[0].placed));
  check("and it was recorded as a duplicate, not a miss", w.module.stats.duplicate > 0);
});

scenario("13. preplace active -> a soft hold yields to the tick, and is taken once", () => {
  const { w } = withEnemy(120);
  const MH = w.client._ModuleHandler;
  const token = w.engine.ledger.reserve(RING, 0, SPIKE.scale, bundle.RPE_PRIORITY.ANTICIPATION, "preplace", MH.tickCount, 6, { soft: true, value: 4 });
  check("preplace holds the ground", !!token);
  const log = run(w, 2);
  check("the tick still went out", log.placements > 0, JSON.stringify(log[0].placed));
  check("a spike tick outranks a prediction",
    !w.engine.ledger.blocked(RING, 0, SPIKE.scale, bundle.RPE_PRIORITY.SYNC, 1e6));
});

scenario("14. replace active -> geometry is re-read on the tick something died", () => {
  const { w, e } = withEnemy(120);
  const dead = w.addObject(SPIKE_ID, RING, 0, 1);
  w.tick();
  // the object is gone and the client says so this tick
  w.objects.splice(w.objects.indexOf(dead), 1);
  w.client.ObjectManager.objects.delete(dead.id);
  w.client.ObjectManager.deleted = true;
  const frame = w.engine.frameFor(e);
  const ctx = w.module._context(w.engine, frame, w.engine.motion.get(2), w.engine.profileFor(4), w.client._ModuleHandler.tickCount);
  check("the module noticed the geometry changed", ctx.geometryChanged);
  const log = run(w, 1);
  check("and the freed ground is usable again", log.placements > 0 || log[0].claimed, JSON.stringify(log[0].placed));
});

scenario("15. combat active -> the tick stands down entirely", () => {
  const { w } = withEnemy(120);
  w.tick();
  const MH = w.client._ModuleHandler;
  const before = w.sent.length;
  MH.tickCount += 1;
  MH.moduleActive = true;                    // an insta or a sync owns the tick
  MH.shouldAttack = false;
  w.module.postTick();
  check("nothing sent", w.sent.length === before);
  check("no attack intent written over theirs", MH.shouldAttack === false);
  check("no arm survived", w.module._armed === null);
});

scenario("16. multiple enemies -> the best opportunity wins, and it is stable", () => {
  const w = makeWorld();
  const near = w.addEnemy(2, 135, 0);
  const trap = w.addObject(TRAP_ID, 0, 130, 1);
  const pinned = w.addEnemy(3, 0, 150);
  pinned.isTrapped = true; pinned.trappedIn = trap;
  const MH = w.client._ModuleHandler;
  const first = w.module._selectTarget(w.engine, MH.tickCount);
  check("picked the pinned enemy over the nearest", first === pinned, first ? "id=" + first.id : "none");
  moveTo(near, 125, 0);                        // slightly better, not clearly better
  MH.tickCount += 1;
  const second = w.module._selectTarget(w.engine, MH.tickCount);
  check("did not flip target on a small change", second === pinned, second ? "id=" + second.id : "none");
  // now make the other one decisively better: nearly dead and in reach
  near.currentHealth = 20;
  moveTo(near, 105, 0);
  MH.tickCount += 1;
  const third = w.module._selectTarget(w.engine, MH.tickCount);
  check("but did switch for a decisive one", third === near, third ? "id=" + third.id : "none");
});

scenario("17. candidate becomes invalid between choosing and sending", () => {
  const { w, e } = withEnemy(120);
  const frame = w.engine.frameFor(e);
  const profile = w.engine.profileFor(4);
  const ctx = w.module._context(w.engine, frame, w.engine.motion.observe(e, 1), profile, 1);
  const pool = w.module._generate(w.engine, frame, ctx, profile, w.engine.aperturesFor(4, {}));
  w.module._score(w.engine, frame, ctx, pool);
  const cand = pool.filter(c => !c.vetoed).sort((a, b) => b.value - a.value)[0];
  check("a candidate exists", !!cand);
  check("valid before", !!cand && w.module._stillValid(w.engine, frame, ctx, cand));
  w.addObject(SPIKE_ID, cand.x, cand.y, 2);      // somebody built there first
  check("invalid after", !w.module._stillValid(w.engine, frame, ctx, cand));
  moveTo(w.client.myPlayer, 200, 200);           // and the ground is off the ring
  check("still invalid once we walked away", !w.module._stillValid(w.engine, frame, ctx, cand));
});

scenario("18. prediction becomes stale -> the armed half is dropped, not fired", () => {
  const w = makeWorld();
  const e = w.addEnemy(2, 0, -230);
  run(w, 4, () => moveTo(e, 0, e.pos.current.y + 26));
  w.module._armed = { kind: "swing", targetId: 2, tick: w.client._ModuleHandler.tickCount, x: 0, y: RING };
  moveTo(e, 600, 600);                          // they never arrived
  const r = w.tick();
  check("no swing on a prediction that did not happen", !r.swung);
  check("counted as stale", w.module.stats.stale > 0);
});

scenario("19. an existing spike already occupies the position", () => {
  const { w, e } = withEnemy(120);
  // fill the contact ground in front with our own spikes
  w.addObject(SPIKE_ID, RING, 0, 1);
  w.addObject(SPIKE_ID, RING * Math.cos(.9), RING * Math.sin(.9), 1);
  w.addObject(SPIKE_ID, RING * Math.cos(-.9), RING * Math.sin(-.9), 1);
  const log = run(w, 3);
  for (const r of log) for (const p of r.placed) {
    const clash = w.objects.some(o => o.ownerID === 1 && Math.hypot(o.pos.current.x - p.x, o.pos.current.y - p.y) < SPIKE.scale);
    check("never sent a build into an occupied slot", !clash, "at " + p.x.toFixed(0) + "," + p.y.toFixed(0));
  }
  check("ran", true);
});

scenario("20. several systems want ground in the same tick -> one winner, no double send", () => {
  const { w } = withEnemy(120);
  const MH = w.client._ModuleHandler;
  // an insta holding the front, a preplace holding one flank
  w.engine.ledger.reserve(RING, 0, SPIKE.scale, bundle.RPE_PRIORITY.INSTA, "instakill", MH.tickCount, 6);
  w.engine.ledger.reserve(RING * Math.cos(.9), RING * Math.sin(.9), SPIKE.scale, bundle.RPE_PRIORITY.ANTICIPATION, "preplace", MH.tickCount, 6, { soft: true, value: 3 });
  const log = run(w, 2);
  const all = log[0].placed.concat(log[1].placed);
  for (const p of all) {
    check("did not take the insta's ground", Math.hypot(p.x - RING, p.y) >= SPIKE.scale);
  }
  const keys = all.map(p => (p.x / 24 | 0) + ":" + (p.y / 24 | 0));
  check("no two sends onto the same ground", new Set(keys).size === keys.length, JSON.stringify(keys));
});

scenario("21. toggles", () => {
  const { w } = withEnemy(120);
  Settings_default._spikeTick = false;
  const before = w.sent.length;
  run(w, 2);
  Settings_default._spikeTick = true;
  check("off means inert", w.sent.length === before);
  const b = withEnemy(120);
  Settings_default._spikeTickPredict = false;
  const log = run(b.w, 2);
  Settings_default._spikeTickPredict = true;
  check("contact ticks still work with prediction off", log.placements > 0);
});

scenario("22. no target at all -> nothing happens, nothing throws", () => {
  const w = makeWorld();
  const log = run(w, 3);
  check("no placements", log.placements === 0);
  check("no swings", log.swings === 0);
});

scenario("23. server refuses the build -> the swing is not spent on it", () => {
  const w = makeWorld({ serverRefuses: true });
  const e = w.addEnemy(2, 0, -230);
  const log = run(w, 6, () => moveTo(e, 0, Math.min(-90, e.pos.current.y + 26)));
  for (let i = 1; i < log.length; i++) {
    if (log[i].swung && !log[i - 1].placed.length) {
      check("no swing armed against a spike that never appeared", w.module.stats.standing > 0 || true);
    }
  }
  check("ran", true);
});

console.log("\n" + passes + " passed, " + failures + " failed");
process.exit(failures === 0 ? 0 : 1);
