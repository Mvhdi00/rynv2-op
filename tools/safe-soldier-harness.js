// Pulls the real Vector / motion-model / SafeSoldier source out of the client
// and runs it against stubs, so the scenarios exercise shipped code.
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
  slice(at("  const SS_STEP = 40;"), at("  const SafeSoldier_default = SafeSoldier;"))
].join("\n");

// ── stubs ────────────────────────────────────────────────────────────────
const Settings_default = { _safeSoldier: true };
const WEAPONS = { 5: { range: 110 }, 8: { range: 65 } };
const DataHandler_default = { getWeapon: id => WEAPONS[id] || WEAPONS[5] };
class PlayerObject {}
const segmentReachesCircle = (from, to, center, radius) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((center.x - from.x) * dx + (center.y - from.y) * dy) / lenSq)) : 0;
  return Math.hypot(center.x - (from.x + dx * t), center.y - (from.y + dy * t)) <= radius;
};
// The placement layer has its own harness; here RynNetwork.steer is the real
// contract this module depends on, reproduced exactly.
const RYN_STEER_EPSILON = .12;
const getAngleDistLocal = (a, b) => {
  const p = Math.abs(b - a) % (Math.PI * 2);
  return p > Math.PI ? Math.PI * 2 - p : p;
};
const steerCalls = [];
let lastSteer = null;
const rynPlacement = () => ({
  network: {
    steer(MH, angle) {
      steerCalls.push(angle);
      if (angle === null) {
        if (MH.moveTo !== null) { MH.moveTo = null; lastSteer = null; }
        return true;
      }
      if (lastSteer !== null && getAngleDistLocal(lastSteer, angle) < RYN_STEER_EPSILON) {
        MH.moveTo = lastSteer;
        return false;
      }
      lastSteer = angle;
      MH.moveTo = angle;
      return true;
    }
  }
});

const exported = {};
new Function("Settings_default", "DataHandler_default", "PlayerObject", "segmentReachesCircle", "rynPlacement", "exported",
  src + "\n;Object.assign(exported,{Vector,Entity,SafeSoldier,lerpAngle});"
)(Settings_default, DataHandler_default, PlayerObject, segmentReachesCircle, rynPlacement, exported);

const { Vector, Entity, SafeSoldier } = exported;

class Hazard extends PlayerObject {
  constructor(id, x, y, opts = {}) {
    super();
    this.id = id;
    this.pos = { current: new Vector(x, y) };
    this.type = opts.type ?? 6;
    this.scale = opts.scale ?? 35;
    this.collisionScale = this.scale;
    this.placementScale = this.scale;
    this.ownerID = opts.ownerID ?? 2;   // the enemy's by default
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
    this.maxHealth = 100;
    this.inGame = true;
    this.isTrapped = false;
    this.weapon = { primary: 5, secondary: 10 };
    this.reload = [ { current: 1, max: 1 }, { current: 1, max: 1 } ];
    // A stand-in for MovementSimulation: reports a spike collision when the
    // straight-line step from here along move_dir lands on a hazard.
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
  isReloaded(type, ticks = 0) {
    const r = this.reload[type];
    return !!r && r.current >= Math.max(0, r.max - ticks);
  }
  get hitScale() { return this.scale * 1.8; }
}

function makeClient() {
  const myPlayer = new Actor(1, 0, 0);
  const objects = new Map;
  const client = {
    myPlayer,
    _ModuleHandler: {
      tickCount: 100, activeModule: null, moveTo: "disable", move_dir: null,
      forceHat: null, shouldEquipSoldier: false,
      setForceHat(hat) { if (this.forceHat !== null && hat !== null) return; this.forceHat = hat; }
    },
    EnemyManager: {
      potentialDamage: 0, potentialSpikeDamage: 0,
      dangerWithoutSoldier: false, detectedDangerEnemy: false, detectedEnemy: false,
      possibleToKnockback: false
    },
    PlayerManager: {
      enemies: [],
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
      }
    }
  };
  // The simulation the module borrows. Same contract as MovementSimulation:
  // reset(client, dir) then update(client, notMoving) sets spikeCollision.
  myPlayer.simulation = {
    spikeCollision: false,
    _x: 0, _y: 0,
    reset(c, dir) {
      this.spikeCollision = false;
      this._dir = dir;
      this._x = c.myPlayer.pos.current.x;
      this._y = c.myPlayer.pos.current.y;
    },
    update(c) {
      const dir = c._ModuleHandler.move_dir;
      if (dir === null) return;
      const nx = this._x + Math.cos(dir) * 45;
      const ny = this._y + Math.sin(dir) * 45;
      for (const [, o] of objects) {
        if (o.getDamage() <= 0) continue;
        if (Math.hypot(nx - o.pos.current.x, ny - o.pos.current.y) <= o.collisionScale + 35) {
          this.spikeCollision = true;
          return;
        }
      }
    },
    getPos() { return new Vector(this._x, this._y); }
  };
  return client;
}

function scenario(name, build) {
  const client = makeClient();
  const enemy = new Actor(2, 200, 0);
  client.PlayerManager.enemies = [ enemy ];
  const add = (id, x, y, opts) => {
    const h = new Hazard(id, x, y, opts);
    client.ObjectManager.objects.set(id, h);
    return h;
  };
  const ctx = {
    client, enemy, add, Vector,
    module: new SafeSoldier(client),
    steerCalls,
    tick: () => { client._ModuleHandler.tickCount += 1; }
  };
  steerCalls.length = 0;
  lastSteer = null;
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
  scenario, check, Vector, Settings: Settings_default, source: src,
  done: () => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
};
