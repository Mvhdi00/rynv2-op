// Pulls the real Vector / motion-model / spike-tick source out of the client
// and runs it against stubs, so the scenarios below exercise shipped code.
const fs = require("fs");
const path = process.argv[2] || "src/RYN_Client_v5.js";
const lines = fs.readFileSync(path, "utf8").split("\n");
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

// Located by marker rather than by fixed line number, so the harness keeps
// working as the file moves underneath it.
const at = needle => {
  const i = lines.findIndex(l => l === needle);
  if (i < 0) throw new Error("marker not found: " + needle);
  return i + 1;
};
const src = [
  slice(at("  class Vector {"), at("  const removeFast = (array, index) => {") - 1),
  slice(at("  const MOTION_IDLE_SPEED = 2;"), at("  const Entity_default = Entity;")),
  slice(at("  const SPIKE_TICK_RANGE = 170;"), at("  class SpikeSync {") - 1)
].join("\n");

// ── stubs ────────────────────────────────────────────────────────────────
const Settings_default = {
  _spikeTick: true, _spikeTickBreak: true, _spikeTickNear: true,
  _spikeTickTrap: true, _antiSpikeTick: true, _autobreak: true
};
const WEAPONS = { 0: { range: 65, knockback: .3 }, 5: { range: 110, knockback: .3 }, 8: { range: 65, knockback: .3 }, 10: { range: 65, knockback: .3 } };
const DataHandler_default = { getWeapon: id => WEAPONS[id] || WEAPONS[0] };
const Items = {};
class PlayerObject {}

const exported = {};
new Function("Settings_default", "DataHandler_default", "Items", "PlayerObject", "exported",
  src + "\n;Object.assign(exported,{Vector,Entity,SpikeTickEngine,spikeTickEngine,segmentReachesCircle,SPIKE_TICK_ENGINES});"
)(Settings_default, DataHandler_default, Items, PlayerObject, exported);

const { Vector, Entity, spikeTickEngine } = exported;

// ── test doubles built on the real Entity, so the real motion model runs ──
class Spike extends PlayerObject {
  constructor(id, x, y, scale = 35, damage = 25) {
    super();
    this.id = id;
    this.pos = { current: new Vector(x, y) };
    this.scale = scale;
    this.collisionScale = scale;
    this.hitScale = scale;
    this.ownerID = 99;
    this.health = 100;
    this._damage = damage;
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
    this.trappedIn = null;
    this.canPlaceSpike = false;
    this.reload = [ { current: 1, max: 1 }, { current: 1, max: 1 }, { current: 23, max: 23 } ];
    this.weapon = { primary: 5, secondary: 10 };
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
  isReloaded(type, ticks = 0) {
    const r = this.reload[type];
    return r.current >= Math.max(0, r.max - ticks);
  }
  getItemByType(t) { return t === 0 ? 5 : t === 1 ? 10 : 4; }
  getActualMaxKnockback() { return this.kb === undefined ? .3 : this.kb; }
  getBuildingDamage() { return 292; }
  collidingSimple(e, range) { return this.pos.current.distance(e.pos.current) <= range; }
}

function makeClient(opts = {}) {
  const myPlayer = new Actor(1, 0, 0);
  const objects = new Map;
  const playerData = new Map;
  const client = {
    myPlayer,
    _ModuleHandler: {
      tickCount: 100, moduleActive: false, useAngle: null, forceHat: null,
      forceWeapon: null, shouldAttack: false, packetCount: 0, packetLimit: 70,
      placeAngles: [ null, [] ], placedOnce: false, totalPlaces: 0,
      place() { this.totalPlaces += 1; this.packetCount += 4; },
      staticModules: {
        reloading: {
          slots: [ 1, 1, 23 ], max: [ 1, 1, 23 ],
          isReloaded(type, ticks = 0) { return this.slots[type] >= Math.max(0, this.max[type] - ticks); }
        }
      }
    },
    EnemyManager: {
      nearestEnemy: null, nearestTrappedEnemy: null, nearestSpike: null,
      possibleToKnockback: false, enemyCanPlaceSpike: false,
      nearestSpikePlacerAngle: [ 0 ],
      _ignore: false,
      shouldIgnoreModule() { return this._ignore; },
      attemptSpikePlacement() {
        if (this.nearestSpikePlacerAngle === null) return;
        for (const a of this.nearestSpikePlacerAngle) client._ModuleHandler.place(4, a);
        client._ModuleHandler.placedOnce = true;
      }
    },
    PlayerManager: {
      enemies: [], playerData,
      isEnemyByID: (ownerID, entity) => ownerID !== entity.id
    },
    ObjectManager: {
      objects, deletedObjects: new Set,
      grid2D: {
        query(x, y, cells, cb) {
          const r = cells * 100;
          for (const [id, o] of objects) {
            if (Math.abs(o.pos.current.x - x) <= r + 100 && Math.abs(o.pos.current.y - y) <= r + 100) {
              if (cb(id)) return true;
            }
          }
          return false;
        }
      }
    }
  };
  Object.assign(client, opts);
  return client;
}

function scenario(name, build) {
  const client = makeClient();
  const enemy = new Actor(2, 100, 0);
  client.PlayerManager.playerData.set(2, enemy);
  client.PlayerManager.enemies = [ enemy ];
  client.EnemyManager.nearestEnemy = enemy;
  const addSpike = (id, x, y, dmg = 25) => {
    const s = new Spike(id, x, y, 35, dmg);
    client.ObjectManager.objects.set(id, s);
    return s;
  };
  const ctx = { client, enemy, addSpike, engine: spikeTickEngine(client), Vector };
  build(ctx);
  return ctx;
}

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}
module.exports = { scenario, check, Settings: Settings_default, source: src, done: () => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }, Vector };
