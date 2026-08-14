// Pulls the real Vector / motion-model / AntiSmartTick source out of the client
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
  slice(at("  const AST_WINDOW = 3;"), at("  const AntiSmartTick_default = AntiSmartTick;"))
].join("\n");

// ── stubs ────────────────────────────────────────────────────────────────
const Settings_default = { _antiSmartTick: true };
const ITEM_SPIKE = 6;
const Items = { [ITEM_SPIKE]: { scale: 35, placeOffset: 0, itemGroup: 2 } };
class PlayerObject {}
const segmentReachesCircle = (from, to, center, radius) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((center.x - from.x) * dx + (center.y - from.y) * dy) / lenSq)) : 0;
  return Math.hypot(center.x - (from.x + dx * t), center.y - (from.y + dy * t)) <= radius;
};
// The placement layer is exercised by its own harness; here it is a spy so
// these scenarios stay about the anti-smart-tick decision.
let arbiterAllows = true;
let budget = 60;
const rynPlacement = () => ({
  arbiter: { allows: () => arbiterAllows },
  network: { budgetLeft: () => budget }
});

const exported = {};
new Function("Settings_default", "Items", "PlayerObject", "segmentReachesCircle", "rynPlacement", "exported",
  src + "\n;Object.assign(exported,{Vector,Entity,AntiSmartTick});"
)(Settings_default, Items, PlayerObject, segmentReachesCircle, rynPlacement, exported);

const { Vector, Entity, AntiSmartTick } = exported;

class Spike extends PlayerObject {
  constructor(id, x, y, opts = {}) {
    super();
    this.id = id;
    this.pos = { current: new Vector(x, y) };
    this.itemGroup = 2;
    this.scale = 35;
    this.collisionScale = 35;
    this.placementScale = 35;
    this.ownerID = opts.ownerID ?? 2;   // the enemy's, by default
    this.health = 500;
    this._damage = opts.damage ?? 25;
  }
  getDamage() { return this._damage; }
}
class Trap extends PlayerObject {
  constructor(id, x, y, health = 200) {
    super();
    this.id = id;
    this.pos = { current: new Vector(x, y) };
    this.type = 15;
    this.itemGroup = 4;
    this.scale = 45;
    this.collisionScale = 45;
    this.placementScale = 45;
    this.ownerID = 2;
    this.health = health;
    this._damage = 0;
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
    this.tempHealth = 100;
    this.inGame = true;
    this.isTrapped = false;
    this.trappedIn = null;
    this.spikeDamage = 0;
    this.canPlaceSpike = true;
    this.weapon = { primary: 5, secondary: 10 };
    this.reload = [ { current: 1, max: 1 }, { current: 1, max: 1 } ];
    this.buildingDamage = 300;
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
    if (!r) return false;
    return r.current >= Math.max(0, r.max - ticks);
  }
  getItemByType(t) { return t === 0 ? 5 : t === 1 ? this.weapon.secondary : t === 4 ? ITEM_SPIKE : null; }
  getItemPlaceScale(id) { return this.scale + Items[id].scale + Items[id].placeOffset; }
  getBuildingDamage() { return this.buildingDamage; }
  getMaxBuildingDamage() { return this.buildingDamage; }
}

function makeClient() {
  const myPlayer = new Actor(1, 0, 0);
  const objects = new Map;
  return {
    myPlayer,
    _ModuleHandler: {
      tickCount: 100, moduleActive: false, activeModule: null,
      forceWeapon: null, forceHat: null, useAngle: null, shouldAttack: false,
      suppressBreak: false, antiSmartHeal: false,
      staticModules: {
        reloading: {
          slots: [ 1, 1 ], max: [ 1, 1 ],
          isReloaded(type, ticks = 0) { return this.slots[type] >= Math.max(0, this.max[type] - ticks); }
        }
      }
    },
    EnemyManager: {
      nearestEnemy: null, primaryDamage: 0,
      _pinned: false,
      enemyTrappedByMe() { return this._pinned; }
    },
    PlayerManager: {
      playerData: new Map,
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
      solverAngles: null,
      getBestPlacementAngles({ targetAngle }) {
        if (this.solverAngles) return this.solverAngles.slice();
        const out = [];
        for (let i = 0; i < 16; i++) out.push(targetAngle + i * (Math.PI * 2 / 16));
        return out;
      },
      canPlaceItem(id, position) {
        for (const [, o] of objects) {
          if (position.distance(o.pos.current) < Items[id].scale + o.placementScale) return false;
        }
        return true;
      }
    }
  };
}

// Default board: I am pinned at (0,0) in a trap my hammer one-shots, the enemy
// stands at (120,0) with a spike of theirs behind me at (-90,0) — so a spike
// dropped between us throws me straight onto it.
function scenario(name, build) {
  const client = makeClient();
  const enemy = new Actor(2, 120, 0);
  client.EnemyManager.nearestEnemy = enemy;
  client.PlayerManager.playerData.set(2, enemy);
  const trap = new Trap(50, 0, 0, 200);
  client.myPlayer.isTrapped = true;
  client.myPlayer.trappedIn = trap;
  const addSpike = (id, x, y, opts) => {
    const s = new Spike(id, x, y, opts);
    client.ObjectManager.objects.set(id, s);
    return s;
  };
  const ctx = {
    client, enemy, trap, addSpike, Vector,
    module: new AntiSmartTick(client),
    setArbiter: v => { arbiterAllows = v; },
    setBudget: v => { budget = v; },
    tick: () => { client._ModuleHandler.tickCount += 1; }
  };
  arbiterAllows = true;
  budget = 60;
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
