"use strict";
// Test harness for the RYN Type 2 placement system.
//
// The userscript is one closure with no module boundary, so the harness lifts
// the parts the placement system is made of straight out of the shipped file
// — the game tables (Config, Items, weapons, hats), Vector and the math
// helpers, the object classes, the spatial hash, AutoPlacer and the whole
// placement engine including core v2 — and evaluates them together behind a
// small simulated client. Nothing placement-related is re-implemented here:
// what is tested is the code in Ryn_Type_2.user.js as it ships.
//
// The simulated client is a world (objects in the real SpatialHashGrid2D), a
// player with an inventory, a packet budget with the real reservation
// arithmetic, a virtual clock, and a "wire" that records every build the
// engine sends along with the server's own legality verdict for it
// (moomoo checkItemLocation, re-implemented from the game source below).

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "Ryn_Type_2.user.js");

function slice(src, startMarker, endMarker, inclusiveEnd) {
  const i = src.indexOf(startMarker);
  if (i === -1) throw new Error("marker not found: " + startMarker);
  const j = src.indexOf(endMarker, i + startMarker.length);
  if (j === -1) throw new Error("marker not found: " + endMarker);
  return src.slice(i, inclusiveEnd ? j + endMarker.length : j);
}

// Virtual time. performance.now and setTimeout are replaced so that timed
// sends can be driven deterministically.
const clock = {
  t: 1000,
  timers: [],
  seq: 0,
  now() {
    return this.t;
  },
  setTimeout(fn, ms) {
    const id = ++this.seq;
    this.timers.push({ id: id, at: this.t + Math.max(0, ms || 0), fn: fn });
    return id;
  },
  clearTimeout(id) {
    this.timers = this.timers.filter(t => t.id !== id);
  },
  advance(ms) {
    const end = this.t + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.t = next.at;
      next.fn();
    }
    this.t = end;
  },
  reset() {
    this.t = 1000;
    this.timers = [];
  }
};

function load() {
  const src = fs.readFileSync(SRC, "utf8");
  const parts = [];
  parts.push(slice(src, "  const Config = {", "  class Entity {"));
  parts.push(slice(src, "  class SpatialHashGrid2D {", "  class Sorting {"));
  parts.push(slice(src, "  class MovementSimulation {", "  class ClientPlayer extends Player_default {"));
  parts.push(slice(src, "  const SYNC_PUSH_STEP", ";\n", true));
  parts.push(slice(src, "  const LUNA_SPIKE_TYPE = 4;", "  const RynPlacementEngine_default = RynPlacementEngine;", true));
  // ModuleHandler's packet-reservation arithmetic, verbatim.
  const reserve = slice(src, "    _reservations=[];\n    reservePackets(", "    // novastorm's heal is `place(myPlayer.items[0], null)`");
  const prelude = `
    const performance = { now: () => __clock.now() };
    const setTimeout = (fn, ms) => __clock.setTimeout(fn, ms);
    const clearTimeout = id => __clock.clearTimeout(id);
    const Settings_default = __settings;
    const Possess = null;
    const IH = c => c.InputHandler;
    const window = {};
    const document = { activeElement: null, body: null };
    const navigator = { hardwareConcurrency: 4 };
    // MovementSimulation only uses Player_default for an instanceof test on
    // the player it collides with.
    const Player_default = class {};
  `;
  const epilogue = `
    class __PacketBudget {
      packetLimit = 119;
      _sent = [];
      get packetCount() {
        const now = performance.now();
        while (this._sent.length && this._sent[0] <= now - 1000) this._sent.shift();
        return this._sent.length;
      }
      spend(n) {
        for (let i = 0; i < n; i++) this._sent.push(performance.now());
      }
      ${reserve}
    }
    return {
      Config_default, Items, Vector_default, hyp, wireAngle, fixTo, getAngleDist,
      PlayerObject, Resource, SpatialHashGrid2D, DataHandler_default, MovementSimulation, RynArrivalMovement, Player_default,
      GeometrySolver, RynAngles, RynNetClock, PlacementOutcomes, PlacementTimer,
      BreakForecaster, AntiRetrapGrid, RynPlacementEngine, AutoPlacer,
      RPE_PRIORITY, RPE_TICK_MS, RPE_TRAP_TRIGGER, RPE_ENEMY_TRAP_RING, RPE_MODE,
      __PacketBudget
    };
  `;
  const body = prelude + parts.join("\n") + epilogue;
  const settings = {};
  const fn = new Function("__clock", "__settings", body);
  const lib = fn(clock, settings);
  lib.settings = settings;
  lib.clock = clock;
  return lib;
}

const lib = load();
const { Items, Vector_default: Vector, PlayerObject, Resource, SpatialHashGrid2D, RynPlacementEngine, AutoPlacer } = lib;

function defaultSettings() {
  const s = lib.settings;
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, {
    _autoplacer: true,
    _prePlace: true,
    _spamPrePlace: true,
    _replaceBurst: 4,
    _retrapResend: 4,
    _replace: true,
    _buildingSteal: true,
    _antiRetrapGrid: true,
    _autoplacerRadius: 350,
    _autoplacerScanners: 1,
    _placementDefense: true
  });
  return s;
}

// ── the server's placement test (moomoo checkItemLocation) ────────────────
// for every object: dist < s + (blocker || getScale(.6, isItem)) refuses;
// getScale: items full scale, rocks/gold scale, trees and bushes .6 * .6.
// River band y in 7200 +- 362 refuses unless id 18.
function serverScale(o) {
  if (o instanceof PlayerObject) {
    const item = Items[o.type];
    return item.id === 21 ? item.blocker : o.scale;
  }
  return o.type === 0 || o.type === 1 ? o.scale * .6 * .6 : o.scale;
}
function serverLegal(world, itemId, x, y, ignore) {
  const s = Items[itemId].scale;
  for (const o of world.objects.values()) {
    if (ignore && ignore(o)) continue;
    const p = o.pos.current;
    if (Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2) < s + serverScale(o)) return false;
  }
  if (itemId !== 18 && y >= 7200 - 362 && y <= 7200 + 362) return false;
  return true;
}

// ── simulated client ──────────────────────────────────────────────────────
class World {
  constructor() {
    this.objects = new Map;
    this.grid2D = new SpatialHashGrid2D(100);
    this.revision = 0;
    this.attackedObjects = new Map;
    this._id = 1;
    this.client = null;
  }
  add(obj) {
    this.revision++;
    this.objects.set(obj.id, obj);
    this.grid2D.insert(obj.pos.current.x, obj.pos.current.y, Math.max(obj.collisionScale, obj.placementScale), obj.id);
    obj._seenAt = clock.now();
    const engine = this.client && this.client._ModuleHandler.staticModules.placementEngine;
    if (engine) engine.onObjectAdded(obj);
    return obj;
  }
  build(type, x, y, ownerID) {
    return this.add(new PlayerObject(this._id++, x, y, 0, Items[type].scale, type, ownerID));
  }
  resource(kind, x, y, scale) {
    return this.add(new Resource(this._id++, x, y, 0, scale, kind));
  }
  remove(obj) {
    const engine = this.client && this.client._ModuleHandler.staticModules.placementEngine;
    if (engine) engine.onVacated(obj);
    this.revision++;
    this.grid2D.remove(obj.pos.current.x, obj.pos.current.y, Math.max(obj.collisionScale, obj.placementScale), obj.id);
    this.objects.delete(obj.id);
  }
}

// Item ids by type slot: 0 primary weapon, 1 secondary, 2 food, 3 wall,
// 4 spike, 5 windmill, 7 trap.
const LOADOUT = { 0: 5, 1: 10, 2: 0, 3: 3, 4: 6, 5: 10, 7: 15 };

class FakePlayer extends lib.Player_default {
  constructor(id, x, y) {
    super();
    this.id = id;
    this.scale = 35;
    this.pos = { previous: new Vector(x, y), current: new Vector(x, y), future: new Vector(x, y) };
    this.inGame = true;
    this.isTrapped = false;
    this.trappedIn = null;
    this.hatID = 0;
    this.tickCount = 0;
    this.angle = 0;
    this.lastAttacked = -99;
    this.speed = 0;
    this.onPlatform = false;
    this.currentItem = -1;
    this.counts = { 2: 0, 5: 0, 3: 0 };
    this.limits = { 2: 15, 5: 6, 3: 30 };
    this.loadout = Object.assign({}, LOADOUT);
    this.weapon = { current: 5, primary: 5, secondary: 10 };
    this.reload = [ { current: 7, max: 7, previous: 7 }, { current: 4, max: 4, previous: 4 }, { current: 0, max: 0 } ];
    this.resources = true;
  }
  get collisionScale() {
    return this.scale;
  }
  moveTo(x, y) {
    this.speed = Math.hypot(x - this.pos.current.x, y - this.pos.current.y);
    this.pos.previous.x = this.pos.current.x;
    this.pos.previous.y = this.pos.current.y;
    this.pos.current.x = x;
    this.pos.current.y = y;
    this.pos.future.x = x + (x - this.pos.previous.x);
    this.pos.future.y = y + (y - this.pos.previous.y);
  }
  getItemByType(type) {
    const id = this.loadout[type];
    return id === undefined ? null : id;
  }
  getItemPlaceScale(id) {
    const item = Items[id];
    return this.scale + item.scale + item.placeOffset;
  }
  getItemCount(group) {
    return { count: this.counts[group] || 0, limit: this.limits[group] || 99 };
  }
  hasResourcesForType() {
    return this.resources;
  }
  hasItemCountForType(type) {
    const id = this.getItemByType(type);
    if (id === null) return false;
    const g = Items[id].itemGroup;
    if (g === undefined) return true;
    const c = this.getItemCount(g);
    return c.count < c.limit;
  }
  canPlace(type) {
    return type !== null && this.getItemByType(type) !== null && this.hasResourcesForType(type) && this.hasItemCountForType(type);
  }
  isReloaded(type) {
    const r = this.reload[type];
    return r.current >= r.max;
  }
  getBuildingDamage(id, tank) {
    const w = lib.DataHandler_default.getWeapon(id);
    let d = w.damage;
    if ("sDmg" in w) d *= w.sDmg;
    if (tank) d *= 3.3;
    return d;
  }
  getPrimaryKnockback() {
    return 0;
  }
}

class FakeModuleHandler {
  constructor(client) {
    this.client = client;
    this.budget = new lib.__PacketBudget;
    this.tickCount = 0;
    // What MovementSimulation asks about the next tick's loadout: no hat, no
    // accessory, the primary, nothing held.
    this.staticModules = {
      autoHat: {
        getNextHat: () => 0,
        getNextAcc: () => 0,
        getNextWeaponID: () => client.myPlayer.getItemByType(0),
        getNextItemID: () => -1
      }
    };
    this.activeModule = null;
    this.move_dir = null;
    this.placeAngles = [ null, [] ];
    this.placedOnce = false;
    this.moduleActive = false;
    this.forceHat = null;
    this.forceWeapon = null;
    this._autoBreakActive = false;
    this.autoattack = false;
    this._lastBreakAngle = null;
    this._currentAngle = 0;
    this.attacking = 0;
    this.weapon = 0;
    this.sends = [];
  }
  get packetCount() {
    return this.budget.packetCount;
  }
  get packetLimit() {
    return this.budget.packetLimit;
  }
  get _reservations() {
    return this.budget._reservations;
  }
  reservePackets(...a) {
    return this.budget.reservePackets(...a);
  }
  releasePackets(...a) {
    return this.budget.releasePackets(...a);
  }
  availablePackets(p) {
    return this.budget.availablePackets(p);
  }
  _getPredictWeapon() {
    return 0;
  }
  canBuy() {
    return false;
  }
  // The wire. Every build records what the server would do with it, from the
  // origin the server would build from when the packet arrives.
  _wire(type, angle, how) {
    const c = this.client;
    const engine = this.staticModules.placementEngine;
    const id = c.myPlayer.getItemByType(type);
    const sent = lib.wireAngle(angle);
    const origin = c.serverOrigin ? c.serverOrigin() : c.myPlayer.pos.current;
    const ring = c.myPlayer.getItemPlaceScale(id);
    const x = origin.x + ring * Math.cos(sent), y = origin.y + ring * Math.sin(sent);
    const rec = {
      type: type, id: id, angle: angle, wire: sent, x: x, y: y, how: how, at: clock.now(),
      owner: this.activeModule, legal: serverLegal(c.ObjectManager, id, x, y, c.serverIgnore || null)
    };
    this.sends.push(rec);
    c.onWire && c.onWire(rec);
    return rec;
  }
  place(type, angle) {
    this.budget.spend(4);
    this._wire(type, angle, "place");
    const engine = this.staticModules.placementEngine;
    if (engine) engine.noteSend(type, angle, null);
  }
  timedPlace(type, angle) {
    this.budget.spend(5);
    this._wire(type, angle, "timed");
    return true;
  }
  selectItem() {
    this.budget.spend(1);
  }
  attack(angle) {
    this._pendingAttack = angle;
  }
  stopAttack(angle) {
    this.budget.spend(2);
    this._wire(this._selectedType ?? 4, angle, "batch");
  }
  whichWeapon() {
    this.budget.spend(1);
  }
  _notePlacement() {}
}

class FakeClient {
  constructor(opts = {}) {
    clock.reset();
    defaultSettings();
    this.ObjectManager = new World;
    this.ObjectManager.client = this;
    this.myPlayer = new FakePlayer(1, opts.x ?? 3000, opts.y ?? 3000);
    this.players = [ this.myPlayer ];
    this.enemies = [];
    this.allies = new Set;
    this.InputHandler = { move: 0 };
    this.PacketManager = { _placing: false };
    const client = this;
    this.PlayerManager = {
      get players() {
        return client.players;
      },
      get enemies() {
        return client.enemies;
      },
      playerData: new Map,
      isEnemyByID(ownerID, player) {
        if (ownerID === client.myPlayer.id || client.allies.has(ownerID)) return false;
        return true;
      }
    };
    this.EnemyManager = {
      get nearestEnemy() {
        let best = null, bd = Infinity;
        for (const e of client.enemies) {
          const d = e.pos.current.distance(client.myPlayer.pos.current);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        return best;
      }
    };
    this._ModuleHandler = new FakeModuleHandler(this);
    // Batched builds select the item once; the fake wire needs to know which.
    const mh = this._ModuleHandler;
    const sel = mh.selectItem.bind(mh);
    mh.selectItem = type => {
      mh._selectedType = type;
      sel(type);
    };
    this.engine = new RynPlacementEngine(this);
    mh.staticModules.placementEngine = this.engine;
    this.autoPlacer = new AutoPlacer(this);
    this.ms = opts.rtt ?? 60;
  }
  addEnemy(x, y, id) {
    const e = new FakePlayer(id ?? 100 + this.enemies.length, x, y);
    this.enemies.push(e);
    this.players.push(e);
    return e;
  }
  // One server tick: the "a" packet arrives, the clock learns it, modules run.
  tick(opts = {}) {
    const mh = this._ModuleHandler;
    mh.tickCount++;
    this.myPlayer.tickCount++;
    this.engine.clock.onTick(clock.now());
    if (opts.modules !== false) {
      if (opts.autoPlacer) this.autoPlacer.postTick();
      this.engine.postTick();
    }
  }
  // Round trip samples for the clock, as pings would give.
  warmClock(rtt, n = 12, jitter = 0) {
    for (let i = 0; i < n; i++) this.engine.clock.onRtt(rtt + (i % 2 ? jitter : -jitter));
    // A few regular ticks for the period.
    for (let i = 0; i < 6; i++) {
      clock.advance(1000 / 9);
      this.tick({ modules: false });
    }
  }
}

// ── server simulation ─────────────────────────────────────────────────────
// A server on the far side of an asymmetric link. It has its own copy of the
// world and of our position; the client sees each server tick `down` ms after
// it happens, and a packet the client sends reaches the server `up` ms after
// it leaves. Builds are judged at the server, against the server's world and
// the server's position for us at the moment they arrive — exactly the gap
// the latency model exists to close.
class Sim {
  constructor(c, opts = {}) {
    this.c = c;
    this.up = opts.up ?? 30;
    this.down = opts.down ?? 30;
    this.jitter = opts.jitter ?? 0;
    this.periodJitter = opts.periodJitter ?? 0;
    this.P = 1000 / 9;
    this.k = 0;
    this.T0 = clock.now();
    this.server = new Map;          // id -> object, the server's world
    this.hidden = [];               // objects the server never shows us
    this.me = { x: c.myPlayer.pos.current.x, y: c.myPlayer.pos.current.y, vx: 0, vy: 0, xVel: 0, yVel: 0, dir: null };
    // The server's world as a grid, for the server's own movement step.
    this.grid = new SpatialHashGrid2D(100);
    this.physics = opts.physics || "game";
    this.script = [];               // per-server-tick callbacks
    this.arrivals = [];             // every build as the server judged it
    this.ticks = 0;
    this.autoPlacer = !!opts.autoPlacer;
    this.rand = opts.rand || Math.random;
    for (const o of c.ObjectManager.objects.values()) this._serverAdd(o);
    c.onWire = rec => this._onWire(rec);
    // Round trip samples, as pings give them.
    for (let i = 0; i < 12; i++) c.engine.clock.onRtt(this.up + this.down);
    this._scheduleTick();
  }
  _serverAdd(o) {
    this.server.set(o.id, o);
    this.grid.insert(o.pos.current.x, o.pos.current.y, Math.max(o.collisionScale, o.placementScale), o.id);
  }
  _serverRemove(o) {
    this.server.delete(o.id);
    this.grid.remove(o.pos.current.x, o.pos.current.y, Math.max(o.collisionScale, o.placementScale), o.id);
  }
  // The game's movement step, run against the server's world with the
  // server's velocity state.
  _move() {
    const me = this.me;
    if (this.physics !== "game") {
      me.x += me.vx;
      me.y += me.vy;
      return;
    }
    // The game's rules: MovementSimulation's port of the update with the
    // game's exact collision (moomoo_1 checkCollision) — see
    // RynArrivalMovement.
    const sim = this._sim || (this._sim = new lib.RynArrivalMovement);
    const c = this.c;
    const fake = {
      myPlayer: { collisionScale: 35, onPlatform: false, speed: 0, pos: { current: new Vector(me.x, me.y) } },
      ObjectManager: { grid2D: this.grid, objects: this.server },
      PlayerManager: c.PlayerManager,
      // Players collide too: the nearest enemy, where the server has them
      // (a moving enemy's server position is the one the script set for this
      // tick; the client only sees it `down` later).
      EnemyManager: { nearestEnemy: this._serverEnemy() },
      _ModuleHandler: { move_dir: me.dir, staticModules: c._ModuleHandler.staticModules }
    };
    sim.slowMult = 1;
    sim.lockMove = false;
    sim.x = me.x;
    sim.y = me.y;
    sim.xVel = me.xVel;
    sim.yVel = me.yVel;
    sim.update(fake, false);
    me.x = sim.x;
    me.y = sim.y;
    me.xVel = sim.xVel;
    me.yVel = sim.yVel;
  }
  _serverEnemy() {
    let best = null, bd = Infinity;
    for (const e of this.c.enemies) {
      const p = e._next || e.pos.current;
      const d = Math.hypot(p.x - this.me.x, p.y - this.me.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best) return null;
    const g = Object.create(best);
    const p = best._next || best.pos.current;
    g.pos = { current: new Vector(p.x, p.y), previous: best.pos.previous, future: best.pos.future };
    return g;
  }
  _lat(base) {
    return Math.max(1, base + (this.jitter ? (this.rand() - .5) * 2 * this.jitter : 0));
  }
  // One ordered stream each way, as a websocket is: a message never arrives
  // before one sent ahead of it, whatever the jitter.
  _down(fn, extra = 0) {
    const at = Math.max(clock.now() + this._lat(this.down) + extra, (this._lastDown || 0) + .001);
    this._lastDown = at;
    clock.setTimeout(fn, at - clock.now());
  }
  _up(fn) {
    const at = Math.max(clock.now() + this._lat(this.up), (this._lastUp || 0) + .001);
    this._lastUp = at;
    clock.setTimeout(fn, at - clock.now());
  }
  _scheduleTick() {
    const at = this.T0 + (this.k + 1) * this.P + (this.periodJitter ? (this.rand() - .5) * 2 * this.periodJitter : 0);
    clock.setTimeout(() => this._serverTick(), Math.max(0, at - clock.now()));
  }
  _serverTick() {
    this.k++;
    const k = this.k;
    this._move();
    for (const fn of this.script) fn(k, this);
    const adds = this._pendingAdds || [];
    this._pendingAdds = [];
    if (adds.length) this._down(() => {
      for (const obj of adds) if (this.server.has(obj.id)) this.c.ObjectManager.add(obj);
    });
    const snap = { x: this.me.x, y: this.me.y };
    // The "a" packet reaches the client `down` later.
    this._down(() => {
      const p = this.c.myPlayer;
      p.moveTo(snap.x, snap.y);
      for (const e of this.c.enemies) if (e._next) {
        e.moveTo(e._next.x, e._next.y);
      }
      for (const pl of this.c.players) for (const r of pl.reload) if (r.max > 0) {
        r.previous = r.current;
        r.current = Math.min(r.max, r.current + 1);
      }
      this.ticks++;
      this.c.tick({ autoPlacer: this.autoPlacer });
    });
    this._scheduleTick();
  }
  // Server-side removal: gone for the server now, for the client later.
  destroy(obj) {
    if (!this.server.has(obj.id)) return;
    this._serverRemove(obj);
    obj._serverGoneAt = clock.now();
    const mine = obj.ownerID === this.c.myPlayer.id && obj instanceof PlayerObject;
    this._down(() => {
      // The owner's item count goes down with it ("S" with the new count).
      if (mine) {
        const g = Items[obj.type].itemGroup;
        this.c.myPlayer.counts[g] = Math.max(0, (this.c.myPlayer.counts[g] || 0) - 1);
      }
      if (this.c.ObjectManager.objects.has(obj.id)) this.c.ObjectManager.remove(obj);
    });
  }
  // A swing by `actor` at `obj` on this server tick: damage now, the
  // client's view of it (health, who hit it, their reload) `down` later.
  hit(actor, obj, dmg) {
    if (!this.server.has(obj.id)) return;
    obj._serverHealth = (obj._serverHealth ?? obj.health) - dmg;
    const seqAtServer = this.k;
    const dead = obj._serverHealth <= 0;
    this._down(() => {
      obj.health = Math.max(0, obj._serverHealth);
      obj._lastHitBy = actor.id;
      obj._lastHitSeq = this.c.engine.clock.tickSeq;
      obj._lastHitDmg = dmg;
      actor.lastAttacked = this.c.myPlayer.tickCount;
      const w = lib.DataHandler_default.getWeapon(actor.weapon.current);
      const r = actor.reload[w.itemType];
      r.current = 0;
    });
    if (dead) this.destroy(obj);
  }
  serverLegalAt(itemId, x, y) {
    const s = Items[itemId].scale;
    const all = [ ...this.server.values(), ...this.hidden ];
    for (const o of all) {
      const p = o.pos.current;
      if (Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2) < s + serverScale(o)) return false;
    }
    if (itemId !== 18 && y >= 7200 - 362 && y <= 7200 + 362) return false;
    return true;
  }
  _onWire(rec) {
    this._up(() => {
      const ring = this.c.myPlayer.getItemPlaceScale(rec.id);
      const x = this.me.x + ring * Math.cos(rec.wire), y = this.me.y + ring * Math.sin(rec.wire);
      const legal = this.serverLegalAt(rec.id, x, y) && this.c.myPlayer.canPlace(rec.type);
      const arrival = { rec: rec, at: clock.now(), seq: this.k, x: x, y: y, legal: legal };
      this.arrivals.push(arrival);
      if (!legal) return;
      const obj = new PlayerObject(this.c.ObjectManager._id++, x, y, 0, Items[rec.id].scale, rec.id, this.c.myPlayer.id);
      this._serverAdd(obj);
      const group = Items[rec.id].itemGroup;
      // "S" at once, the object with the next tick.
      this._down(() => {
        this.c.myPlayer.counts[group] = (this.c.myPlayer.counts[group] || 0) + 1;
        this.c.engine.outcomes.onBuilt(group, clock.now());
      });
      this._pendingAdds = this._pendingAdds || [];
      this._pendingAdds.push(obj);
    });
  }
  // Hold a direction: the server moves us along it from now on, and the
  // client knows what it is sending.
  walk(dir) {
    this.me.dir = dir;
    this.c._ModuleHandler.move_dir = dir;
  }
  run(ms) {
    clock.advance(ms);
  }
}

// ── tiny assertion runner ─────────────────────────────────────────────────
const results = [];
function test(name, fn) {
  const t0 = process.hrtime.bigint();
  try {
    fn();
    results.push({ name: name, ok: true, ms: Number(process.hrtime.bigint() - t0) / 1e6 });
  } catch (e) {
    results.push({ name: name, ok: false, err: e });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error("assertion failed: " + msg);
}
function report() {
  let fail = 0;
  for (const r of results) {
    if (r.ok) console.log("  ok   " + r.name + "  (" + r.ms.toFixed(1) + "ms)");
    else {
      fail++;
      console.log("  FAIL " + r.name + "\n       " + (r.err && r.err.stack ? r.err.stack.split("\n").slice(0, 4).join("\n       ") : r.err));
    }
  }
  console.log("\n" + (results.length - fail) + "/" + results.length + " passed");
  return fail;
}

const metrics = {};
module.exports = { Sim, metrics, lib, clock, World, FakePlayer, FakeClient, serverLegal, test, assert, report, defaultSettings };
