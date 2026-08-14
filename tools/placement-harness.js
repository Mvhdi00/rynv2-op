// Pulls the real Vector / motion-model / placement-layer source out of the
// client and runs it against stubs, so the scenarios exercise shipped code.
const fs = require("fs");
const path = process.argv[2] || "src/RYN_Client_v5.js";
const lines = fs.readFileSync(path, "utf8").split("\n");
const slice = (a, b) => lines.slice(a - 1, b).join("\n");
const at = needle => {
  const i = lines.findIndex(l => l === needle);
  if (i < 0) throw new Error("marker not found: " + needle);
  return i + 1;
};

const src = [
  slice(at("  class Vector {"), at("  const removeFast = (array, index) => {") - 1),
  slice(at("  const MOTION_IDLE_SPEED = 2;"), at("  const Entity_default = Entity;")),
  slice(at("  const RYN_SPIKE_TYPE = 4;"), at("  class TrapAnimal {") - 1)
].join("\n");

// ── stubs ────────────────────────────────────────────────────────────────
const Settings_default = {
  _autoplacer: true, _prePlace: true, _replace: true, _autoplacerRadius: 350
};
const ITEM_SPIKE = 6, ITEM_TRAP = 15;
const Items = {
  [ITEM_SPIKE]: { scale: 35, placeOffset: 0, itemGroup: 2 },
  [ITEM_TRAP]: { scale: 45, placeOffset: 0, itemGroup: 4 }
};
const Settings = Settings_default;
// segmentReachesCircle lives in the spike tick block, which is not extracted
// here; the placement layer only reads it for one scoring term.
const segmentReachesCircle = (from, to, center, radius) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((center.x - from.x) * dx + (center.y - from.y) * dy) / lenSq)) : 0;
  return Math.hypot(center.x - (from.x + dx * t), center.y - (from.y + dy * t)) <= radius;
};
class PlayerObject {}

const exported = {};
new Function("Settings_default", "Items", "PlayerObject", "segmentReachesCircle", "exported",
  src + "\n;Object.assign(exported,{Vector,Entity,RynRuntime,RynNetwork,RynArbiter,RynPlacementEngine,rynPlacement,AutoPlacer});"
)(Settings_default, Items, PlayerObject, segmentReachesCircle, exported);

const { Vector, Entity, rynPlacement, AutoPlacer } = exported;

// ── test doubles ─────────────────────────────────────────────────────────
class Build extends PlayerObject {
  constructor(id, x, y, opts = {}) {
    super();
    this.id = id;
    this.pos = { current: new Vector(x, y) };
    this.type = opts.type ?? ITEM_SPIKE;
    this.scale = opts.scale ?? 35;
    this.collisionScale = this.scale;
    this.placementScale = this.scale;
    this.hitScale = this.scale;
    this.ownerID = opts.ownerID ?? 1;
    this.health = opts.health ?? 500;
    this.isDestroyable = opts.isDestroyable ?? true;
    this._damage = opts.damage ?? 25;
  }
  getDamage() { return this._damage; }
}
class Actor extends Entity {
  constructor(id, x, y) {
    super(null);
    this.id = id;
    this.scale = 35;
    this.currentHealth = 100;
    this.isTrapped = false;
    this.spikeDamage = 0;
    this.inGame = true;
    this.buildDamage = 25;
    this.simulation = null;
    this.pos.previous._setXY(x, y);
    this.pos.current._setXY(x, y);
    this.pos.future._setXY(x, y);
  }
  step(dx, dy) {
    this.pos.previous.setVec(this.pos.current);
    this.pos.current._setXY(this.pos.current.x + dx, this.pos.current.y + dy);
    this.setFuturePosition();
  }
  hold(n = 1) { for (let i = 0; i < n; i++) this.step(0, 0); }
  getItemByType(t) { return t === 4 ? ITEM_SPIKE : t === 7 ? ITEM_TRAP : null; }
  getItemPlaceScale(id) { return this.scale + Items[id].scale + Items[id].placeOffset; }
  getPlacePosition(start, id, angle) { return start.addDirection(angle, this.getItemPlaceScale(id)); }
  getItemCount() { return { count: 0, limit: 99 }; }
  canPlace() { return true; }
  getMaxBuildingDamage() { return this.buildDamage; }
}

function makeClient() {
  const myPlayer = new Actor(1, 0, 0);
  const objects = new Map;
  const sends = [];
  const client = {
    myPlayer,
    sends,
    _ModuleHandler: {
      tickCount: 100, moduleActive: false, activeModule: null,
      packetCount: 0, packetLimit: 70, move_dir: null,
      placeAngles: [ null, [] ], placedOnce: false,
      _autoBreakActive: false, _lastBreakAngle: null, _currentAngle: 0,
      place(type, angle) { sends.push({ type, angle }); this.packetCount += 4; }
    },
    PacketManager: { updateAngle() {} },
    SocketManager: { pong: 40, minPingTime: 30 },
    EnemyManager: {
      nearestEnemy: null,
      nearestSpikePlacerAngle: null,
      _ignore: false,
      shouldIgnoreModule() { return this._ignore; },
      attemptSpikePlacement() { return false; }
    },
    PlayerManager: {
      // ownerID 1 is mine, anything else is an enemy's
      isEnemyByID: (ownerID, entity) => ownerID !== entity.id
    },
    ObjectManager: {
      objects,
      grid2D: {
        query(x, y, cells, cb) {
          const r = cells * 100 + 100;
          for (const [id, o] of objects) {
            if (Math.abs(o.pos.current.x - x) <= r && Math.abs(o.pos.current.y - y) <= r) {
              if (cb(id)) return true;
            }
          }
          return false;
        }
      },
      // The real solver is ObjectManager's; here it is a stand-in that returns
      // the target angle plus a spread, so scenarios are about scoring and
      // validation rather than about geometry.
      solverAngles: null,
      getBestPlacementAngles({ targetAngle }) {
        if (this.solverAngles) return this.solverAngles.slice();
        return [ targetAngle, targetAngle + 0.6, targetAngle - 0.6, targetAngle + Math.PI ];
      },
      canPlaceItem(id, position, addRadius = 0, ignoreID = null) {
        let blocked = false;
        for (const [oid, o] of objects) {
          if (ignoreID !== null && oid === ignoreID) continue;
          if (position.distance(o.pos.current) < Items[id].scale + o.placementScale + addRadius) {
            blocked = true;
            break;
          }
        }
        return !blocked;
      }
    }
  };
  return client;
}

function scenario(name, build) {
  const client = makeClient();
  const enemy = new Actor(2, 150, 0);
  client.EnemyManager.nearestEnemy = enemy;
  const add = (id, x, y, opts) => {
    const b = new Build(id, x, y, opts);
    client.ObjectManager.objects.set(id, b);
    return b;
  };
  const ctx = {
    client, enemy, add, Vector,
    engine: rynPlacement(client),
    module: new AutoPlacer(client),
    tick: () => { client._ModuleHandler.tickCount += 1; }
  };
  build(ctx);
  return ctx;
}

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}
module.exports = {
  scenario, check, Vector, Settings, source: src,
  ITEM_SPIKE, ITEM_TRAP,
  done: () => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
};
