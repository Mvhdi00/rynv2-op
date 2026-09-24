#!/usr/bin/env node
"use strict";
// Scenario tests for Ryn Type 2's Auto Place escape containment and Spam
// Preplace replacement cycle.
//
//   node tools/test-ryn-type2-placement.js [modified.user.js] [baseline.user.js]
//
// The placement code is not reimplemented here. It is cut out of the userscript
// by marker — the game tables, Vector, the object classes, the spatial grid and
// the whole placement section from LUNA_SPIKE_TYPE to RynPlacementEngine — and
// run in a sandbox with a virtual clock, so every setTimeout and
// performance.now() in it is deterministic. The baseline (by default the file
// as it was before the upgrade, read from git) is loaded the same way, so the
// two can be compared on identical boards.
//
// Around it is a model of the server, built from the rules in the game bundle:
//
//   placement   resolved when the packet arrives: refused if any object sits
//               closer than newScale + (blocker || scale), as checkItemLocation
//   movement    the player update zeroes velocity if lockMove was set on the
//               previous tick, clears it, moves, and re-sets it on contact with
//               an enemy trap (centre within 35 + 50 * 0.2)
//   swings      `reloads > 0 ? reloads -= dt : gather()` — the swing comes the
//               tick after the reload runs out, and a trap at zero health is
//               removed on that tick
//   network     both links carry half the round trip plus uniform jitter, and
//               each link delivers in order
//
// and around that, a client that feeds the extracted modules exactly what RYN's
// own handlers would: the attack animation before the player update, the
// reload counters, the trap's health as attackPlayer estimates it, the object
// add and remove packets, and EnemyManager.checkCollision's trappedIn.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const {execSync} = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BASELINE_REV = "35f8a72";

// ── loading ────────────────────────────────────────────────────────────────
function cut(src, start, end, inclusive) {
  const a = src.indexOf(start);
  if (a < 0) throw new Error("marker not found: " + start);
  const b = src.indexOf(end, a + start.length);
  if (b < 0) throw new Error("end marker not found: " + end);
  return src.slice(a, inclusive ? b + end.length : b);
}

function loadModule(src, label) {
  const clock = { now: 0, seq: 0, queue: [] };
  const timers = new Map;
  let nextTimer = 1;
  const sandbox = {
    console: console,
    Math: Math,
    Map: Map,
    Set: Set,
    WeakMap: WeakMap,
    Float64Array: Float64Array,
    Uint32Array: Uint32Array,
    Array: Array,
    Object: Object,
    Number: Number,
    String: String,
    Error: Error,
    RangeError: RangeError,
    isFinite: isFinite,
    parseFloat: parseFloat,
    performance: { now: () => clock.now },
    setTimeout: (fn, ms) => {
      const id = nextTimer++;
      const ev = { t: clock.now + Math.max(0, ms || 0), seq: clock.seq++, fn: fn, timer: id, kind: "timer" };
      timers.set(id, ev);
      clock.queue.push(ev);
      return id;
    },
    clearTimeout: id => {
      const ev = timers.get(id);
      if (ev) ev.cancelled = true;
      timers.delete(id);
    },
    window: { grbtp: 35 }
  };
  const parts = [
    cut(src, "  const Config = {", "  class Vector {"),
    cut(src, "  class Vector {", "  const formatCode = code => {"),
    cut(src, "  const pointInRiver = position => {", "  const pointInDesert"),
    "  const pointInDesert = position => position.y >= Config_default.mapScale - Config_default.snowBiomeTop;\n",
    cut(src, "  const Hats = {", "  const DataHandler_default = DataHandler;", true),
    cut(src, "  class ObjectItem {", "  class Entity {"),
    cut(src, "  class SpatialHashGrid2D {", "  class Sorting {"),
    cut(src, "  const LUNA_SPIKE_TYPE = 4;", "  const RynPlacementEngine_default = RynPlacementEngine;", true)
  ];
  const code = "(function(){\n" +
    "  const Settings_default = {};\n" +
    "  const IH = c => c.InputHandler;\n" +
    "  let Possess = null;\n" +
    parts.join("\n") +
    "\n  return { Settings: Settings_default, AutoPlacer, RynPlacementEngine, PlayerObject, Resource, SpatialHashGrid2D, Items, ItemGroups, Weapons, Hats, WeaponVariants, DataHandler: DataHandler_default, Config: Config_default, Vector: Vector_default, RingScan, RetrapForecast: typeof RetrapForecast === 'undefined' ? null : RetrapForecast };\n" +
    "})()";
  vm.createContext(sandbox);
  const mod = vm.runInContext(code, sandbox, { filename: label });
  mod.clock = clock;
  return mod;
}

// ── seeded randomness ────────────────────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

// ── the simulation ───────────────────────────────────────────────────────────
const T = 1000 / 9;
const TRAP = 15;
const SPIKE = 6;
const ME = 1, FOE = 2, THIRD = 3;

class Sim {
  constructor(mod, opts) {
    this.mod = mod;
    this.opts = opts;
    this.rand = rng(opts.seed || 1);
    this.clock = mod.clock;
    this.clock.now = 0;
    this.clock.queue.length = 0;
    this.tick = 0;
    this.lastDown = 0;
    this.lastUp = 0;
    this.nextObjectId = 100;
    this.log = { sends: [], accepted: 0, refused: 0, refusedEarly: 0, breaks: [], errors: [] };
    // server world
    this.sObjects = new Map;
    const Settings = mod.Settings;
    Object.assign(Settings, {
      _autoplacer: true,
      _prePlace: true,
      _spamPrePlace: true,
      _replace: true,
      _retrapResend: 4,
      _replaceBurst: 4,
      _autoplacerRadius: 350,
      _autoplacerScanners: 4,
      _autoplacerResolution: 200,
      _lunaExactPlacer: false
    }, opts.settings || {});
    this.me = { x: opts.me.x, y: opts.me.y, resources: { food: 1e5, wood: 1e5, stone: 1e5, gold: 0 } };
    this.foe = {
      id: FOE,
      x: opts.foe.x,
      y: opts.foe.y,
      vx: 0,
      vy: 0,
      lockMove: false,
      hat: opts.foe.hat ?? 0,
      weaponIdx: opts.foe.weapon ?? 10,
      primary: opts.foe.primary ?? 5,
      secondary: opts.foe.secondary ?? 10,
      variant: 0,
      reloadMs: {},
      attacking: opts.foe.attacking !== false,
      moveDir: null,
      escapeDir: opts.foe.escapeDir,
      moveAfterBreak: opts.foe.moveAfterBreak !== false,
      extraDelay: opts.foe.extraDelay || 0
    };
    this.foe.reloadMs[this.foe.primary] = 0;
    this.foe.reloadMs[this.foe.secondary] = opts.foe.reloadStart ?? 0;
    this.helpers = opts.helpers || [];
    this.foeSwings = 0;
    this.buildClient();
    for (const o of opts.objects || []) this.serverAdd(o.type, o.x, o.y, o.owner ?? ME, o.health, true);
  }

  // server-side -------------------------------------------------------------
  serverAdd(type, x, y, owner, health, instant) {
    const item = this.mod.Items[type];
    const obj = { id: this.nextObjectId++, type, x, y, scale: item.scale, owner, health: health ?? item.health ?? Infinity, isItem: true, blocker: item.blocker };
    this.sObjects.set(obj.id, obj);
    if (instant) this.clientAdd(obj);
    else this.deliver(() => this.clientAdd(obj));
    return obj;
  }
  serverRemove(obj, cause) {
    this.sObjects.delete(obj.id);
    this.deliver(() => this.clientRemove(obj.id));
  }
  place(send) {
    // arrives at the server now
    const item = this.mod.Items[send.id];
    const r = 35 + item.scale + (item.placeOffset || 0);
    const x = this.me.x + r * Math.cos(send.angle), y = this.me.y + r * Math.sin(send.angle);
    let blocker = null;
    for (const o of this.sObjects.values()) {
      const s = o.blocker ? o.blocker : o.scale;
      if (Math.hypot(x - o.x, y - o.y) < item.scale + s) {
        blocker = o;
        break;
      }
    }
    const group = item.itemGroup;
    const count = [...this.sObjects.values()].filter(o => o.owner === ME && this.mod.Items[o.type].itemGroup === group).length;
    const limit = this.mod.ItemGroups[group].limit;
    send.arrivedAt = this.clock.now;
    send.x = x;
    send.y = y;
    if (blocker || count >= limit) {
      send.result = blocker ? "blocked" : "limit";
      send.blockedBy = blocker;
      this.log.refused++;
      if (blocker && blocker === this.currentHold && this.sObjects.has(blocker.id)) this.log.refusedEarly++;
      return;
    }
    send.result = "ok";
    this.log.accepted++;
    const obj = this.serverAdd(send.id, x, y, ME);
    send.objectId = obj.id;
  }
  foeUpdate() {
    const f = this.foe, M = this.mod;
    // movement, exactly in the bundle's order
    if (f.lockMove) {
      f.vx = 0;
      f.vy = 0;
    } else if (f.moveDir !== null) {
      f.vx += Math.cos(f.moveDir) * .0016 * T;
      f.vy += Math.sin(f.moveDir) * .0016 * T;
    }
    f.lockMove = false;
    f.x += f.vx * T;
    f.y += f.vy * T;
    let holder = null;
    for (const o of this.sObjects.values()) {
      const it = M.Items[o.type];
      if (it.trap && o.owner === ME && Math.hypot(f.x - o.x, f.y - o.y) <= 35 + o.scale * it.colDiv) {
        f.lockMove = true;
        holder = o;
      }
    }
    const decel = Math.pow(.993, T);
    f.vx *= decel;
    f.vy *= decel;
    // a player caught again stops walking and starts on the new trap
    if (holder && this.escape && !this.escape.done) {
      this.escape.done = true;
      this.escape.heldTick = this.tick;
      this.escape.heldDist = Math.hypot(f.x - this.escape.x, f.y - this.escape.y);
      this.escape.by = holder.id;
    }
    if (holder) {
      f.moveDir = null;
      this.currentHold = holder;
    }
    // swing
    const w = f.weaponIdx;
    if (f.reloadMs[w] > 0) {
      f.reloadMs[w] -= T;
    } else if (f.attacking && holder) {
      this.swing(f, w, holder, FOE);
      f.reloadMs[w] = M.Weapons[w].speed * (M.Hats[f.hat] && M.Hats[f.hat].atkSpd || 1);
    }
  }
  swing(actor, weaponId, target, actorId) {
    const M = this.mod;
    const wd = M.Weapons[weaponId];
    const hat = M.Hats[actor.hat];
    const dmg = wd.damage * M.WeaponVariants[actor.variant || 0].val * (wd.sDmg || 1) * (hat && hat.bDmg ? hat.bDmg : 1);
    target.health -= dmg;
    const killed = target.health <= 0;
    if (actorId === FOE && this.opts.foe.stopAfterSwings !== undefined && ++this.foeSwings >= this.opts.foe.stopAfterSwings) this.foe.attacking = false;
    this.deliver(() => this.clientAttack(actorId, weaponId, target.id));
    if (killed) {
      this.log.breaks.push({ tick: this.tick, at: this.clock.now, id: target.id, x: target.x, y: target.y });
      this.serverRemove(target, "broken");
      const f = this.foe;
      if (f.moveAfterBreak && target === this.currentHold) {
        this.escape = { tick: this.tick, x: f.x, y: f.y, done: false, trapId: target.id };
        this.log.escapes = this.log.escapes || [];
        this.log.escapes.push(this.escape);
        this.pendingMove = { tick: this.tick + 1 + f.extraDelay };
      }
      this.currentHold = null;
    }
  }
  serverTick() {
    this.tick++;
    if (this.pendingMove && this.tick >= this.pendingMove.tick) {
      this.foe.moveDir = typeof this.foe.escapeDir === "function" ? this.foe.escapeDir(this) : this.foe.escapeDir;
      this.pendingMove = null;
    }
    // A teammate whose update runs first breaks the trap before the holder's
    // own collision check, so the holder carries no lockMove into the next
    // tick and can walk on it.
    if (this.opts.helperFirst) for (const h of this.helpers) this.helperUpdate(h);
    this.foeUpdate();
    if (!this.opts.helperFirst) for (const h of this.helpers) this.helperUpdate(h);
    const snap = { tick: this.tick, fx: this.foe.x, fy: this.foe.y, hat: this.foe.hat, weapon: this.foe.weaponIdx };
    this.deliver(() => this.clientTick(snap));
    if (this.escape && !this.escape.done && Math.hypot(this.foe.x - this.escape.x, this.foe.y - this.escape.y) > 150) {
      this.escape.done = true;
      this.escape.escaped = true;
    }
  }
  helperUpdate(h) {
    // a teammate of the foe hitting our trap from outside
    if (h.reloadMs > 0) {
      h.reloadMs -= T;
      return;
    }
    const target = this.currentHold && this.sObjects.has(this.currentHold.id) ? this.currentHold : null;
    if (!target) return;
    this.swing({ hat: h.hat, variant: 0 }, h.weapon, target, h.id);
    h.reloadMs = this.mod.Weapons[h.weapon].speed;
  }

  // network -----------------------------------------------------------------
  delay() {
    return this.opts.rtt / 2 + (this.rand() * 2 - 1) * (this.opts.jitter || 0);
  }
  deliver(fn) {
    let t = this.clock.now + this.delay();
    if (t < this.lastDown) t = this.lastDown;
    this.lastDown = t;
    this.push(t, fn, "down");
  }
  upload(send) {
    let t = this.clock.now + this.delay();
    if (t < this.lastUp) t = this.lastUp;
    this.lastUp = t;
    this.push(t, () => this.place(send), "up");
  }
  push(t, fn, kind) {
    this.clock.queue.push({ t, seq: this.clock.seq++, fn, kind });
  }

  // client ------------------------------------------------------------------
  buildClient() {
    const M = this.mod, sim = this;
    const V = M.Vector;
    const me = {
      id: ME,
      inGame: true,
      isTrapped: false,
      isSandbox: false,
      tickCount: 0,
      hatID: 0,
      speed: 0,
      reload: [ { current: 5, max: 5 }, { current: 5, max: 5 }, { current: 23, max: 23 } ],
      weapon: { primary: 5, secondary: 10, current: 5 },
      resources: this.me.resources,
      pos: { previous: new V(this.me.x, this.me.y), current: new V(this.me.x, this.me.y), future: new V(this.me.x, this.me.y) },
      inventory: { 0: 5, 1: 10, 2: 0, 4: this.opts.noSpikes ? null : SPIKE, 7: TRAP },
      getItemByType(type) { return this.inventory[type] ?? null; },
      getItemPlaceScale(id) { const it = M.Items[id]; return 35 + it.scale + it.placeOffset; },
      getItemCount(group) {
        let count = 0;
        for (const o of client.ObjectManager.objects.values()) if (o.ownerID === ME && o.itemGroup === group) count++;
        return { count, limit: M.ItemGroups[group].limit };
      },
      canPlace(type) {
        const id = this.getItemByType(type);
        if (id === null || id === undefined) return false;
        const it = M.Items[id];
        const c = it.cost;
        if (this.resources.wood < c.wood || this.resources.stone < c.stone || this.resources.food < c.food || this.resources.gold < c.gold) return false;
        const { count, limit } = this.getItemCount(it.itemGroup);
        return count < limit;
      },
      isReloaded() { return false; },
      getPrimaryKnockback() { return 0; },
      getBuildingDamage(id, tank) { return sim.buildingDamage(id, tank ? 40 : 0, 0); },
      isEnemyByID(id) { return id !== ME; }
    };
    const foe = {
      id: FOE,
      collisionScale: 35,
      hitScale: 63,
      hatID: this.foe.hat,
      usesTank: false,
      lastAttacked: 0,
      lastAttackWeapon: null,
      isTrapped: false,
      trappedIn: null,
      dir: 0,
      weapon: { primary: this.foe.primary, secondary: this.foe.secondary, current: this.foe.weaponIdx },
      reload: [ { previous: 0, current: 0, max: 0 }, { previous: 0, current: 0, max: 0 }, { current: 23, max: 23 } ],
      pos: { previous: new V(this.foe.x, this.foe.y), current: new V(this.foe.x, this.foe.y), future: new V(this.foe.x, this.foe.y) },
      getBuildingDamage(id, tank) { return sim.buildingDamage(id, tank ? 40 : this.hatID, 0); }
    };
    for (const slot of [ 0, 1 ]) {
      const id = slot === 0 ? foe.weapon.primary : foe.weapon.secondary;
      const m = Math.ceil(M.Weapons[id].speed / T);
      foe.reload[slot].max = m;
      foe.reload[slot].current = m;
    }
    const helpers = this.helpers.map(h => ({
      id: h.id,
      collisionScale: 35,
      hatID: h.hat || 0,
      usesTank: false,
      lastAttacked: 0,
      lastAttackWeapon: null,
      weapon: { primary: null, secondary: h.weapon, current: h.weapon },
      reload: [ { current: 0, max: 0 }, { current: Math.ceil(M.Weapons[h.weapon].speed / T), max: Math.ceil(M.Weapons[h.weapon].speed / T) }, { current: 0, max: 0 } ],
      pos: { previous: new V(h.x, h.y), current: new V(h.x, h.y), future: new V(h.x, h.y) },
      getBuildingDamage(id, tank) { return sim.buildingDamage(id, tank ? 40 : this.hatID, 0); }
    }));
    const client = this.client = {
      isOwner: true,
      myPlayer: me,
      foe,
      helpers,
      InputHandler: { move: 0 },
      SocketManager: { pong: this.opts.rtt, minPingTime: Math.max(1, this.opts.rtt - 2 * (this.opts.jitter || 0)), TICK: T },
      EnemyManager: { nearestEnemy: foe },
      PlayerManager: {
        enemies: [ foe, ...helpers ],
        isEnemyByID(id) { return id !== ME; }
      },
      ObjectManager: null,
      _ModuleHandler: null
    };
    const OM = client.ObjectManager = {
      objects: new Map,
      grid2D: new M.SpatialHashGrid2D(100),
      revision: 0,
      insertObject(o) {
        this.revision++;
        this.grid2D.insert(o.pos.current.x, o.pos.current.y, Math.max(o.collisionScale, o.placementScale), o.id);
        this.objects.set(o.id, o);
      },
      removeObject(o) {
        const engine = MH.staticModules.placementEngine;
        try {
          engine.onVacated(o);
        } catch (e) {
          sim.log.errors.push(e);
        }
        this.revision++;
        this.grid2D.remove(o.pos.current.x, o.pos.current.y, Math.max(o.collisionScale, o.placementScale), o.id);
        this.objects.delete(o.id);
      }
    };
    const MH = client._ModuleHandler = {
      tickCount: 0,
      packets: [],
      get packetCount() {
        const now = sim.clock.now;
        while (this.packets.length && this.packets[0] <= now - 1000) this.packets.shift();
        return this.packets.length;
      },
      set packetCount(_) {},
      packetLimit: 119,
      activeModule: null,
      moduleActive: false,
      placedOnce: false,
      placeAngles: [ null, [] ],
      moduleStart: 0,
      currentHolding: 0,
      weapon: 0,
      totalPlaces: 0,
      forceWeapon: null,
      autoattack: false,
      _autoBreakActive: false,
      _lastBreakAngle: null,
      _currentAngle: 0,
      staticModules: {},
      origin: "auto",
      _getPredictWeapon() { return 0; },
      canBuy() { return false; },
      _placementHitsProtected() { return false; },
      packet() { this.packets.push(sim.clock.now); },
      selectItem(type) { this.currentHolding = type; this.packet(); },
      whichWeapon(type) { this.currentHolding = type ?? 0; this.packet(); },
      stopAttack() { this.packet(); },
      attack(angle) {
        this.packet();
        if (this.currentHolding === 4 || this.currentHolding === 7) {
          const id = me.getItemByType(this.currentHolding);
          const engine = this.staticModules.placementEngine;
          const origin = engine && engine.sending ? "engine" : this.origin;
          const send = { t: sim.clock.now, tick: this.tickCount, id, type: this.currentHolding, angle, origin };
          sim.log.sends.push(send);
          sim.upload(send);
        }
      },
      _notePlacement(type, angle) {
        const engine = this.staticModules.placementEngine;
        if (!engine || engine.sending) return;
        engine.claimPlacement(type, angle, engine.priorityFor(this.activeModule), this.activeModule || "module", 2);
      },
      place(type, angle) {
        this.totalPlaces++;
        this._notePlacement(type, angle);
        this.selectItem(type);
        this.attack(angle, 1);
        this.stopAttack(angle);
        this.whichWeapon(0);
      },
      resendPlace(type, angle) {
        if (this.packetCount + 5 > this.packetLimit) return false;
        const was = this.origin;
        this.origin = "timer";
        this.selectItem(type);
        this.attack(angle, 1);
        this.stopAttack(angle);
        this.whichWeapon(0);
        this.origin = was;
        return true;
      }
    };
    MH.staticModules.autoPlacer = new M.AutoPlacer(client);
    MH.staticModules.placementEngine = new M.RynPlacementEngine(client);
    // Tag Auto Place's containment builds so their sends can be told apart.
    const ap = MH.staticModules.autoPlacer;
    if (ap._containEscape) {
      const orig = ap._containEscape.bind(ap);
      ap._containEscape = (...args) => {
        const before = ap._predictObjects.length;
        const n = orig(...args);
        for (let i = before; i < ap._predictObjects.length; i++) ap._predictObjects[i].contain = true;
        sim.lastContain = { tick: MH.tickCount, count: n };
        return n;
      };
    }
  }
  buildingDamage(id, hat, variant) {
    const M = this.mod;
    const wd = M.Weapons[id];
    let d = wd.damage * M.WeaponVariants[variant].val;
    if ("sDmg" in wd) d *= wd.sDmg;
    const h = M.Hats[hat];
    if (h && "bDmg" in h) d *= h.bDmg;
    return d;
  }
  clientAdd(o) {
    const obj = new this.mod.PlayerObject(o.id, o.x, o.y, 0, o.scale, o.type, o.owner);
    obj.health = o.health;
    obj.seenPlacement = true;
    this.client.ObjectManager.insertObject(obj);
  }
  clientRemove(id) {
    const obj = this.client.ObjectManager.objects.get(id);
    if (obj) this.client.ObjectManager.removeObject(obj);
  }
  clientAttack(actorId, weaponId, targetId) {
    // PlayerManager.attackPlayer: reset the reload, stamp the swing, and take
    // the swing's damage off the building it landed on.
    const c = this.client;
    const actor = actorId === FOE ? c.foe : c.helpers.find(h => h.id === actorId);
    if (!actor) return;
    const slot = this.mod.Weapons[weaponId].itemType;
    actor.reload[slot].max = Math.ceil(this.mod.Weapons[weaponId].speed / T);
    actor.reload[slot].current = 0;
    actor.lastAttacked = c.myPlayer.tickCount;
    actor.lastAttackWeapon = weaponId;
    const obj = c.ObjectManager.objects.get(targetId);
    if (obj) obj.health = Math.max(0, obj.health - actor.getBuildingDamage(weaponId, false));
  }
  clientTick(snap) {
    const c = this.client, M = this.mod, foe = c.foe;
    const V = M.Vector;
    c.myPlayer.tickCount++;
    // Player.update
    foe.pos.previous.x = foe.pos.current.x;
    foe.pos.previous.y = foe.pos.current.y;
    foe.pos.current.x = snap.fx;
    foe.pos.current.y = snap.fy;
    foe.pos.future.x = snap.fx + (snap.fx - foe.pos.previous.x);
    foe.pos.future.y = snap.fy + (snap.fy - foe.pos.previous.y);
    foe.hatID = snap.hat;
    const slot = M.Weapons[foe.weapon.current].itemType;
    foe.reload[slot].current = Math.min(foe.reload[slot].max, foe.reload[slot].current + 1);
    for (const h of c.helpers) {
      h.reload[1].current = Math.min(h.reload[1].max, h.reload[1].current + 1);
    }
    // EnemyManager.checkCollision
    foe.isTrapped = false;
    foe.trappedIn = null;
    for (const o of c.ObjectManager.objects.values()) {
      if (o.type === TRAP && o.ownerID === ME && foe.pos.current.distance(o.pos.current) <= 35 + o.collisionScale + 1) {
        foe.isTrapped = true;
        foe.trappedIn = o;
        if (foe.hatID === 40) foe.usesTank = true;
      }
    }
    // ModuleHandler.postTick
    const MH = c._ModuleHandler;
    MH.moduleStart = this.clock.now;
    MH.tickCount++;
    MH.placeAngles[0] = null;
    MH.placeAngles[1].length = 0;
    MH.activeModule = null;
    MH.moduleActive = false;
    for (const name of [ "autoPlacer", "placementEngine" ]) {
      const mod = MH.staticModules[name];
      const prev = MH.moduleActive;
      MH.origin = name === "autoPlacer" ? "auto" : "engine";
      const t0 = process.hrtime.bigint();
      try {
        mod.postTick();
      } catch (e) {
        this.log.errors.push(e);
      }
      const dt = Number(process.hrtime.bigint() - t0) / 1e6;
      this.log.cost = this.log.cost || { autoPlacer: [], placementEngine: [] };
      this.log.cost[name].push(dt);
      if (!prev && MH.moduleActive) MH.activeModule = name;
    }
    MH.origin = "auto";
    // Tag containment sends.
    for (const s of this.log.sends) {
      if (s.tick === MH.tickCount && s.origin === "auto" && s.containTagged === undefined) {
        const ap = MH.staticModules.autoPlacer;
        s.containTagged = ap._predictObjects.some(q => q.contain && Math.abs(q.angle - s.angle) < 1e-9);
        if (s.containTagged) s.origin = "contain";
      }
    }
  }

  // driver ------------------------------------------------------------------
  run(ticks) {
    const q = this.clock.queue;
    const end = ticks * T + 1;
    let nextTick = T;
    while (true) {
      q.sort((a, b) => a.t - b.t || a.seq - b.seq);
      const ev = q.length ? q[0] : null;
      if (nextTick <= end && (!ev || nextTick <= ev.t)) {
        this.clock.now = nextTick;
        this.serverTick();
        nextTick += T;
        if (this.opts.stop && this.opts.stop(this)) break;
        continue;
      }
      if (!ev) break;
      q.shift();
      if (ev.t > end) break;
      this.clock.now = ev.t;
      if (ev.cancelled) continue;
      try {
        ev.fn();
      } catch (e) {
        this.log.errors.push(e);
      }
    }
    return this;
  }
}

// ── boards ───────────────────────────────────────────────────────────────────
// Me at M, a trap of ours at distance D in direction `bearing`, the foe
// standing `offset` units from its centre along `offsetDir` (relative to the
// line from me), breaking it with a great hammer.
function board(o) {
  const M = { x: 5000, y: 3000 };
  const b = o.bearing ?? 0;
  const D = o.D ?? 80;
  const cx = M.x + D * Math.cos(b), cy = M.y + D * Math.sin(b);
  const od = b + (o.offsetDir ?? 0);
  const fx = cx + (o.offset ?? 0) * Math.cos(od), fy = cy + (o.offset ?? 0) * Math.sin(od);
  const objects = [ { type: TRAP, x: cx, y: cy, owner: ME, health: o.trapHealth ?? 500 } ].concat((o.extra || []).map(e => ({
    type: e.type,
    x: M.x + e.d * Math.cos(b + e.a),
    y: M.y + e.d * Math.sin(b + e.a),
    owner: e.owner ?? ME
  })));
  return {
    me: M,
    foe: {
      x: fx,
      y: fy,
      hat: o.hat ?? 40,
      weapon: o.weapon ?? 10,
      attacking: o.attacking,
      escapeDir: o.escapeDir !== undefined ? b + o.escapeDir : b,
      moveAfterBreak: o.moveAfterBreak,
      reloadStart: o.reloadStart,
      extraDelay: o.extraDelay,
      stopAfterSwings: o.stopAfterSwings
    },
    objects,
    helpers: o.helpers,
    helperFirst: o.helperFirst,
    rtt: o.rtt ?? 90,
    jitter: o.jitter ?? 5,
    seed: o.seed ?? 1,
    settings: o.settings,
    noSpikes: o.noSpikes,
    stop: o.stop
  };
}

// The formation Auto Place would queue on this board this tick, asked of the
// real _containEscape directly: no ticks run, nothing sent.
function formationAt(mod, o) {
  const sim = new Sim(mod, board(Object.assign({ moveAfterBreak: false }, o)));
  const c = sim.client, MH = c._ModuleHandler, ap = MH.staticModules.autoPlacer, me = c.myPlayer, foe = c.foe;
  MH.tickCount = 1;
  ap._steps = 200;
  ap._predictObjects = [];
  ap._placedSlots = [];
  for (const ob of c.ObjectManager.objects.values()) if (ob.type === TRAP && foe.pos.current.distance(ob.pos.current) <= 46) foe.trappedIn = ob;
  if (!foe.trappedIn) return null;
  const angles = ap._getPrePlaceAngles(TRAP, me.pos.current, me, c.ObjectManager, null, 7);
  const n = ap._containEscape(foe.trappedIn, angles, foe, foe.pos.current, me.pos.current, me, TRAP, c.ObjectManager, c.PlayerManager);
  return { n, spots: ap._predictObjects.map(q => ({ x: q.x, y: q.y })) };
}

// ── checks ───────────────────────────────────────────────────────────────────
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? "  PASS " : "  FAIL ") + name + (detail ? "  — " + detail : ""));
  if (!ok) failures++;
}
function summary(sim) {
  const s = sim.log;
  const by = {};
  for (const x of s.sends) by[x.origin] = (by[x.origin] || 0) + 1;
  return by;
}
function held(sim) {
  const e = (sim.log.escapes || [])[0];
  return !!e && e.done && !e.escaped;
}

// ── scenarios ────────────────────────────────────────────────────────────────
function main() {
  const modFile = process.argv[2] || path.join(ROOT, "Ryn_Type_2.user.js");
  let baseSrc;
  if (process.argv[3]) baseSrc = fs.readFileSync(process.argv[3], "utf8");
  else baseSrc = execSync(`git show ${BASELINE_REV}:Ryn_Type_2.user.js`, { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
  const modSrc = fs.readFileSync(modFile, "utf8");
  const load = which => loadModule(which === "base" ? baseSrc : modSrc, which);
  const run = (which, o, ticks) => new Sim(load(which), board(o)).run(ticks ?? 40);

  // 1. Enemy trapped normally, nobody breaking the trap.
  console.log("\n1. enemy trapped, not breaking the trap");
  {
    const sim = run("mod", { D: 110, attacking: false }, 40);
    const tags = summary(sim);
    check("no containment sent", !tags.contain, JSON.stringify(tags));
    check("no timed replacement sent", !tags.timer);
    check("no errors", sim.log.errors.length === 0, sim.log.errors.map(String).join("; "));
    const fc = sim.mod.RetrapForecast.predict(sim.client, sim.client.foe.trappedIn, sim.client.foe);
    check("forecast does not claim a break", !fc || fc.confidence < .3, fc ? "confidence " + fc.confidence : "none");
  }

  // 2. Enemy approaching destruction: forecast against the server's real break tick.
  console.log("\n2. forecast accuracy approaching the break");
  {
    const errs = [];
    for (const hat of [ 0, 40 ]) {
      for (const reloadStart of [ 0, 150, 300 ]) {
        const o = board({ D: 110, hat, reloadStart, moveAfterBreak: false });
        const sim = new Sim(load("mod"), o);
        const preds = [];
        const eng = sim.client._ModuleHandler.staticModules.placementEngine;
        const orig = eng.postTick.bind(eng);
        eng.postTick = () => {
          const trap = sim.client.foe.trappedIn;
          if (trap) {
            const fc = sim.mod.RetrapForecast.predict(sim.client, trap, sim.client.foe);
            if (fc && isFinite(fc.ticks)) preds.push({ tick: sim.tick, clientTick: sim.client._ModuleHandler.tickCount, ticks: fc.ticks, latest: fc.latest, conf: fc.confidence });
          }
          orig();
        };
        sim.run(60);
        const br = sim.log.breaks[0];
        if (!br) continue;
        // Client tick k sees server tick k (one delivery), so the true answer
        // at client tick k is br.tick - k.
        const last = preds.filter(p => p.conf >= .3 && p.clientTick < br.tick && br.tick - p.clientTick <= 3);
        for (const p of last) errs.push({ hat, reloadStart, err: p.ticks - (br.tick - p.clientTick), lateErr: p.latest - (br.tick - p.clientTick) });
      }
    }
    const within = errs.filter(e => e.err <= 0 && e.lateErr >= 0).length;
    check("break tick inside [ticks, latest] in the last 3 ticks", within === errs.length, within + "/" + errs.length + " " + JSON.stringify(errs.filter(e => !(e.err <= 0 && e.lateErr >= 0)).slice(0, 4)));
    const exact = errs.filter(e => e.err === 0).length;
    console.log("    exact on `ticks`: " + exact + "/" + errs.length + " (the rest are the unmeasured-cadence bracket, early by design)");
  }

  // 3/4. Trap breaks while the enemy tries to leave at once — baseline vs upgraded.
  console.log("\n3-4. trap breaks, enemy walks out on the first tick it can");
  {
    const dirs = [ 0, Math.PI / 2, -Math.PI / 2, Math.PI ];
    const res = { base: 0, mod: 0, n: 0 };
    const packets = { base: 0, mod: 0 };
    for (const rtt of [ 60, 100, 140 ]) {
      for (const dir of dirs) {
        for (const seed of [ 1, 2, 3 ]) {
          for (const which of [ "base", "mod" ]) {
            const sim = run(which, { D: 80, escapeDir: dir, rtt, jitter: 8, seed, stop: s => s.escape && s.escape.done }, 70);
            if (held(sim)) res[which]++;
            packets[which] += sim.log.sends.length;
            if (sim.log.errors.length) check(which + " no errors", false, String(sim.log.errors[0]));
          }
          res.n++;
        }
      }
    }
    console.log("    re-held: baseline " + res.base + "/" + res.n + ", upgraded " + res.mod + "/" + res.n + "; sends baseline " + packets.base + ", upgraded " + packets.mod);
    check("upgraded holds at least as often as baseline", res.mod >= res.base);
    check("upgraded holds in the large majority", res.mod >= Math.ceil(res.n * .8), res.mod + "/" + res.n);
  }

  // 3b. Broken from outside by a teammate whose update runs first: no lockMove
  // carry, so the replacement has one tick to land in instead of two.
  console.log("\n3b. trap broken from outside, holder free on the next tick");
  {
    const res = { base: 0, mod: 0, n: 0 };
    for (const rtt of [ 60, 100, 140, 200 ]) {
      for (const dir of [ 0, Math.PI / 2 ]) {
        for (const seed of [ 1, 2, 3 ]) {
          for (const which of [ "base", "mod" ]) {
            const sim = run(which, {
              D: 80,
              escapeDir: dir,
              attacking: false,
              rtt,
              jitter: 8,
              seed,
              helperFirst: true,
              helpers: [ { id: THIRD, x: 5000 + 80 + 90, y: 3000, weapon: 10, hat: 40 } ],
              stop: s => s.escape && s.escape.done
            }, 70);
            if (held(sim)) res[which]++;
          }
          res.n++;
        }
      }
    }
    console.log("    re-held: baseline " + res.base + "/" + res.n + ", upgraded " + res.mod + "/" + res.n);
    check("upgraded holds at least as often as baseline", res.mod >= res.base);
  }

  // 5. Four-way formation: how many ways out get a trap, by geometry.
  console.log("\n5. containment formation 4 -> 3 -> 2 -> 1");
  {
    const seen = new Map, seenOpen = new Map;
    // With spikes the ladder walls the ring the tick the enemy is caught, and
    // a way out a spike already blocks needs no trap; without them the ring is
    // open and the formation is the only thing covering the ways out.
    for (const noSpikes of [ false, true ]) for (const D of [ 90, 110, 130, 160, 190 ]) {
      for (const offset of [ 0, 25, 40 ]) {
        for (const offsetDir of [ Math.PI, Math.PI * .75, Math.PI / 2 ]) {
          const sim = run("mod", { D, offset, offsetDir, noSpikes, moveAfterBreak: false, stop: s => s.log.breaks.length > 0 }, 60);
          const contain = sim.log.sends.filter(s => s.origin === "contain");
          const n = contain.length;
          seen.set(n, (seen.get(n) || 0) + 1);
          if (noSpikes) seenOpen.set(n, (seenOpen.get(n) || 0) + 1);
          const bad = contain.filter(s => s.result && s.result !== "ok");
          if (bad.length) check("containment legal at D=" + D + " off=" + offset, false, bad.map(b => b.result).join(","));
          // Never two containment traps on the same ground.
          for (let i = 0; i < contain.length; i++) {
            for (let j = i + 1; j < contain.length; j++) {
              if (contain[i].x !== undefined && contain[j].x !== undefined && Math.hypot(contain[i].x - contain[j].x, contain[i].y - contain[j].y) < 100 - 1e-6) {
                check("containment traps clear each other", false, "D=" + D);
              }
            }
          }
        }
      }
    }
    const fmt = m => [ ...m.entries() ].sort((a, b) => b[0] - a[0]).map(([k, v]) => k + " traps: " + v).join(", ");
    const hist = fmt(seen);
    console.log("    all boards:       " + hist);
    console.log("    open-ring boards: " + fmt(seenOpen));
    check("formation size varies with geometry", seen.size >= 2, hist);
    check("never more than four", [ ...seen.keys() ].every(k => k <= 4));
    // The same question over every standing geometry on a grid, asked of the
    // formation code directly: how many of the four ways out one position can
    // cover while the old trap still stands.
    const sweep = new Map;
    const m = load("mod");
    for (let D = 60; D <= 200; D += 10) for (let off = 0; off <= 44; off += 4) for (let k = 0; k < 16; k++) {
      const f = formationAt(m, { D, offset: off, offsetDir: k * Math.PI / 8, noSpikes: true });
      if (f) sweep.set(f.n, (sweep.get(f.n) || 0) + 1);
    }
    console.log("    geometry sweep:   " + fmt(sweep) + "  (" + [ ...sweep.values() ].reduce((a, b) => a + b, 0) + " positions)");
    check("sweep produces 3, 2, 1 and 0", [ 3, 2, 1, 0 ].every(k => sweep.has(k)));
  }

  // 6. Illegal / blocked candidates: a wall dropped on each spot the formation
  // chose, then the whole fight played out against the server.
  console.log("\n6. blocked and illegal candidates");
  {
    let total = 0, refused = 0, onWall = 0, boards = 0, rerouted = 0;
    const m = load("mod");
    for (const o of [ { D: 60, offset: 20, offsetDir: Math.PI }, { D: 110, offset: 40, offsetDir: Math.PI }, { D: 120, offset: 40, offsetDir: Math.PI * .75 }, { D: 100, offset: 36, offsetDir: Math.PI } ]) {
      const open = formationAt(m, Object.assign({ noSpikes: true }, o));
      if (!open || open.n === 0) continue;
      for (const spot of open.spots) {
        const a = Math.atan2(spot.y - 3000, spot.x - 5000);
        const wall = { type: 3, d: 80, a: a };
        const blocked = formationAt(m, Object.assign({ noSpikes: true, extra: [ wall ] }, o));
        const sim = run("mod", Object.assign({ noSpikes: true, moveAfterBreak: false, extra: [ wall ], stop: s => s.log.breaks.length > 0 }, o), 60);
        boards++;
        const cs = sim.log.sends.filter(x => x.origin === "contain");
        total += cs.length;
        refused += cs.filter(x => x.result && x.result !== "ok").length;
        const wx = 5000 + 80 * Math.cos(a), wy = 3000 + 80 * Math.sin(a);
        onWall += cs.filter(x => x.x !== undefined && Math.hypot(x.x - wx, x.y - wy) < 100).length;
        if (blocked && blocked.n > 0) rerouted++;
        if (sim.log.errors.length) check("no errors", false, String(sim.log.errors[0]));
      }
    }
    console.log("    boards " + boards + ", formations still found around the wall " + rerouted + ", containment sends " + total);
    check("containment never lands on the blocked spot", onWall === 0, onWall + " on the wall");
    check("every containment send accepted by the server", refused === 0, refused + "/" + total + " refused");
  }

  // 7. Rapid repeated destruction: a helper plus the holder breaking trap after trap.
  console.log("\n7. rapid repeated trap destruction");
  {
    const sim = run("mod", { D: 80, escapeDir: 0, rtt: 90, jitter: 6, helpers: [ { id: THIRD, x: 5000 + 80 + 90, y: 3000, weapon: 10, hat: 40 } ] }, 160);
    const eng = sim.client._ModuleHandler.staticModules.placementEngine;
    const esc = sim.log.escapes || [];
    const heldCount = esc.filter(e => e.done && !e.escaped).length;
    console.log("    breaks " + sim.log.breaks.length + ", re-held " + heldCount + "/" + esc.length + ", stats held " + eng.stats.retrapHeld + " missed " + eng.stats.retrapMissed);
    check("several breaks happened", sim.log.breaks.length >= 3, String(sim.log.breaks.length));
    check("re-held on most breaks", heldCount >= Math.ceil(esc.length * .75), heldCount + "/" + esc.length);
    check("no timers left pointing at a dead trap", !eng._retrap || sim.client.ObjectManager.objects.has(eng._retrap.trapId));
    check("no errors", sim.log.errors.length === 0, sim.log.errors.map(String).join("; "));
  }

  // 8. High ping and jitter.
  console.log("\n8. high ping / jitter");
  {
    const res = { base: 0, mod: 0, n: 0 };
    for (const rtt of [ 180, 250, 320 ]) {
      for (const jitter of [ 15, 30 ]) {
        for (const dir of [ 0, Math.PI / 2 ]) {
          for (const seed of [ 4, 5 ]) {
            for (const which of [ "base", "mod" ]) {
              const sim = run(which, { D: 80, escapeDir: dir, rtt, jitter, seed, stop: s => s.escape && s.escape.done }, 80);
              if (held(sim)) res[which]++;
            }
            res.n++;
          }
        }
      }
    }
    console.log("    re-held: baseline " + res.base + "/" + res.n + ", upgraded " + res.mod + "/" + res.n);
    check("upgraded holds at least as often as baseline under high ping", res.mod >= res.base);
  }

  // 9. Spam Preplace continuous replacement: the holder alone, many cycles.
  console.log("\n9. continuous replacement");
  {
    const sim = run("mod", { D: 80, escapeDir: 0, rtt: 100, jitter: 6 }, 260);
    const esc = sim.log.escapes || [];
    const heldCount = esc.filter(e => e.done && !e.escaped).length;
    const eng = sim.client._ModuleHandler.staticModules.placementEngine;
    const perBreak = esc.length ? (sim.log.sends.length / esc.length).toFixed(1) : "-";
    console.log("    cycles " + esc.length + ", re-held " + heldCount + ", sends per cycle " + perBreak + ", refused " + sim.log.refused + " (" + sim.log.refusedEarly + " early)");
    check("contained through repeated cycles", esc.length >= 2 && heldCount === esc.length, heldCount + "/" + esc.length);
    const base = run("base", { D: 80, escapeDir: 0, rtt: 100, jitter: 6 }, 260);
    const bEsc = base.log.escapes || [];
    const origins = sm => {
      const o = {};
      for (const x of sm.log.sends) {
        const k = x.origin + ":" + (x.result === "ok" ? "ok" : "refused");
        o[k] = (o[k] || 0) + 1;
      }
      return JSON.stringify(o);
    };
    console.log("    baseline: cycles " + bEsc.length + ", re-held " + bEsc.filter(e => e.done && !e.escaped).length + ", sends per cycle " + (bEsc.length ? (base.log.sends.length / bEsc.length).toFixed(1) : "-") + ", refused " + base.log.refused);
    console.log("    upgraded sends by origin " + origins(sim));
    console.log("    baseline sends by origin " + origins(base));
    const peak = Math.max(0, ...sim.log.sends.map(s => sim.log.sends.filter(x => x.t > s.t - 1000 && x.t <= s.t).length * 4));
    check("packet rate within the 119/s allowance", peak <= 119, "peak " + peak + " packets/s");
  }

  // 9b. The flood guard: the trap is left one hit from breaking and the enemy
  // stops swinging. Nothing breaks, so every speculative send is refused; the
  // question is how many go out before the cycle stops believing the break.
  console.log("\n9b. enemy stops swinging one hit from the break");
  {
    for (const which of [ "base", "mod" ]) {
      const sim = run(which, { D: 80, escapeDir: 0, rtt: 100, jitter: 6, stopAfterSwings: 2, moveAfterBreak: false }, 60);
      const idle = sim.log.sends.filter(x => x.tick > 7 && x.origin !== "auto" && x.origin !== "contain").length;
      console.log("    " + which + ": replacement sends after the last swing (5.9s) " + idle);
      if (which === "mod") check("speculative sends die out when the swings stop", idle <= 8, String(idle));
    }
  }

  // 10. Everything outside the scenarios: identical to the baseline.
  console.log("\n10. behaviour outside these scenarios");
  {
    let same = 0, n = 0;
    const r = rng(99);
    for (let i = 0; i < 40; i++) {
      // Boards with no enemy held by our trap: the foe standing free at range.
      const bearing = r() * Math.PI * 2;
      const D = 90 + r() * 200;
      const o = {
        bearing,
        D,
        offset: 60 + r() * 40,
        offsetDir: r() * Math.PI * 2,
        attacking: false,
        moveAfterBreak: false,
        trapHealth: 500,
        extra: [ { type: SPIKE, d: 150 + r() * 80, a: r() * 6.28 }, { type: 3, d: 120 + r() * 100, a: r() * 6.28 } ]
      };
      const a = run("base", o, 12);
      const b = run("mod", o, 12);
      const key = s => s.log.sends.map(x => x.tick + ":" + x.type + ":" + x.angle.toFixed(6)).join("|");
      n++;
      if (key(a) === key(b)) same++;
    }
    check("auto place identical to baseline when no trap of ours is breaking", same === n, same + "/" + n);
    let sameOff = 0, m = 0;
    for (let i = 0; i < 12; i++) {
      const o = { D: 80, escapeDir: i * .5, rtt: 90, jitter: 5, seed: i + 1, settings: { _spamPrePlace: false } };
      const a = run("base", o, 40);
      const b = run("mod", o, 40);
      const key = s => s.log.sends.filter(x => x.origin !== "contain").map(x => x.tick + ":" + x.type + ":" + x.angle.toFixed(6)).join("|");
      m++;
      if (key(a) === key(b)) sameOff++;
    }
    check("engine identical to baseline with Spam Preplace off (containment aside)", sameOff === m, sameOff + "/" + m);
  }

  // Cost.
  console.log("\nperformance");
  {
    const sim = run("mod", { D: 80, escapeDir: 0, rtt: 100, jitter: 6 }, 200);
    const base = run("base", { D: 80, escapeDir: 0, rtt: 100, jitter: 6 }, 200);
    const p = arr => {
      const s = arr.slice().sort((x, y) => x - y);
      return { mean: s.reduce((a, b) => a + b, 0) / s.length, p99: s[Math.floor(s.length * .99)] };
    };
    const m1 = p(sim.log.cost.autoPlacer), m2 = p(sim.log.cost.placementEngine);
    const b1 = p(base.log.cost.autoPlacer), b2 = p(base.log.cost.placementEngine);
    console.log("    autoPlacer   mean " + m1.mean.toFixed(3) + "ms p99 " + m1.p99.toFixed(3) + "ms   (baseline " + b1.mean.toFixed(3) + " / " + b1.p99.toFixed(3) + ")");
    console.log("    engine       mean " + m2.mean.toFixed(3) + "ms p99 " + m2.p99.toFixed(3) + "ms   (baseline " + b2.mean.toFixed(3) + " / " + b2.p99.toFixed(3) + ")");
    check("per-tick cost well inside a 111ms tick", m1.p99 + m2.p99 < 5, (m1.p99 + m2.p99).toFixed(3) + "ms");
  }

  console.log("\n" + (failures ? failures + " check(s) failed" : "all checks passed"));
  process.exitCode = failures ? 1 : 0;
}

main();
