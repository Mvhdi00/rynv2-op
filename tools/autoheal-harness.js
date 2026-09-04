'use strict';
// Builds a runnable sandbox out of the real Auto Heal source: the AntiInsta
// class and its constants verbatim, the ModuleHandler heal/hat methods and the
// Player shame methods lifted out by signature. Anything the tests do not
// exercise is stubbed.
const path = require('path');
const vm = require('vm');
const { method, constant, fields, read } = require('./source-slice');

const SRC = read(path.join(__dirname, '..', 'Ryn_Type_2.user.js'));

// --- the AntiInsta block, verbatim -----------------------------------------
const antiStart = SRC.indexOf('  const ANTI_INSTA_DMG_CAP = 140;');
const antiEnd = SRC.indexOf('  const AntiInsta_default = AntiInsta;');
if (antiStart < 0 || antiEnd < 0) throw new Error('AntiInsta block not found');
const ANTI_BLOCK = SRC.slice(antiStart, antiEnd);

const PLAYER_METHODS = ['bookShameEat', 'canDrainShame', 'shameStampPending', 'isBullTickTime'];
const MH_METHODS = ['requestDefenseHat', 'resolveDefenseHat', 'healBudget', 'heal', '_rawHeal', '_flushShameHealQueue', '_healBudgetLeft'];

const playerSrc = PLAYER_METHODS.map(m => method(SRC, 'Player', m)).join(',\n');
const mhSrc = MH_METHODS.map(m => method(SRC, 'ModuleHandler', m)).join(',\n');
// The real constants those methods budget against, not numbers retyped here.
const mhFields = fields(SRC, 'ModuleHandler',
  ['_HEAL_PACKET_COST', '_HEAL_EMERGENCY_RESERVE', '_HEAL_MAX_PER_TICK', '_SHAME_GUARD_MARGIN', '_shameHealQueue', '_shameHealDeadline', '_healsThisTick', '_shameMovedThisTick', '_defenseHat', '_defenseHatPriority']);

const CONSTS = ['SHAME_WINDOW_MS', 'DMG_OVER_TIME_STEPS', 'BULL_TICK_DAMAGE', 'BULL_TICK_PERIOD', 'SAFE_SOLDIER_RANGE']
  .map(c => constant(SRC, c)).join('\n');

const PRELUDE = `
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
${CONSTS}
const Hats = []; Hats[6] = { dmgMult: .75 }; Hats[7] = { healthRegen: -5, dmgMultO: 1.5 };
const Items = []; Items[16] = { restore: 20, cost: { food: 10, wood: 0, stone: 0, gold: 0 } };
const Settings_default = { _autoheal: true, _antiSmartTick: false, _safeSoldier: true, _antienemy: true };
const DataHandler_default = { isShootable: () => false, getWeapon: () => ({ range: 35 }) };
const PlayerObject = class {};
const Vector_default = class {};
`;

const EPILOGUE = `
// Player shame methods, lifted from the client.
class TestPlayer {
  shameCount = 0; shameStamp = 0; shameBooked = 0;
  tickCount = 0; bullTick = 0;
  tempHealth = 100; maxHealth = 100; currentHealth = 100;
  hatID = 0; isSandbox = false; shameActive = false; isTrapped = false;
  isDmgOverTime = false; damageTick = 0; receivedDamage = null;
  resources = { food: 1000 }; pos = { current: { distance: () => 999 } };
  inventory = { 2: 16 };
  getItemByType(t) { return this.inventory[t] === undefined ? null : this.inventory[t]; }
  wasTrapped() { return false; }
  takeDamage(amount, now) {
    this.currentHealth -= amount; this.tempHealth = this.currentHealth;
    this.receivedDamage = now; this.shameStamp = now; this.damageTick = this.tickCount + 1;
    const isDot = DMG_OVER_TIME_STEPS.some(s => Math.abs(amount - s) < .01);
    this.isDmgOverTime = isDot;
    if (isDot) this.bullTick = this.tickCount;
  }
}
Object.assign(TestPlayer.prototype, { ${playerSrc} });

class TestModuleHandler {
  packetLimit = 119;
  _packets = 0;
  tickCount = 0;
  forceHat = null; useHat = null; shouldEquipSoldier = false;
  healedOnce = false; didAntiInsta = false; shouldAttack = false;
  moduleActive = false; currentType = null;
  owned = new Set([6, 7]);
  sentHeals = [];
  staticModules = {};
  constructor(client) { this.client = client; }
  get packetCount() { return this._packets; }
  set packetCount(v) { this._packets = v; }
  canBuy(type, id) { return type === 0 && this.owned.has(id); }
  selectItem() { this._packets += 1; }
  attack() { this._packets += 1; }
  whichWeapon() { this._packets += 1; }
  _getPredictWeapon() { return 0; }
  resetTick() {
    this._healsThisTick = 0; this._shameMovedThisTick = false;
    this._defenseHat = null; this._defenseHatPriority = -1;
    this.forceHat = null; this.shouldEquipSoldier = false;
    this.healedOnce = false; this.didAntiInsta = false;
    this.tickCount += 1;
  }
}
Object.assign(TestModuleHandler.prototype, { ${mhFields} });
Object.assign(TestModuleHandler.prototype, { ${mhSrc} });
// Record every apple that actually reaches the wire.
const _origRaw = TestModuleHandler.prototype._rawHeal;
TestModuleHandler.prototype._rawHeal = function () {
  this.sentHeals.push({ tick: this.tickCount, shame: this.client.myPlayer.shameCount });
  return _origRaw.call(this);
};

function makeEnemyManager(over) {
  return Object.assign({
    potentialDamage: 0, potentialSpikeDamage: 0, potentialRangedDamage: 0,
    potentialSpikeKnockbackDamage: 0, primaryDamage: 0,
    detectedDangerEnemy: false, detectedEnemy: false, dangerWithoutSoldier: false,
    spikeSyncThreat: false, velocityTickThreat: false, reverseInsta: false,
    rangedBowInsta: false, toolHammerInsta: false,
    collidingSpike: false, willCollideSpike: false, pushingOnSpike: false,
    possibleToKnockback: false, nearestTurretEntity: null, nearestEnemy: null,
    instaThreat() {
      return this.velocityTickThreat || this.reverseInsta || this.rangedBowInsta ||
        this.toolHammerInsta || this.primaryDamage + this.potentialSpikeKnockbackDamage >= 100;
    }
  }, over || {});
}

function makeClient(over) {
  const client = {
    myPlayer: new TestPlayer(),
    EnemyManager: makeEnemyManager((over || {}).enemy),
    ProjectileManager: Object.assign({ totalDamage: 0, turretDamage: 0, arrowDamage: 0, arrowCount: 0 }, (over || {}).proj),
    SocketManager: { pong: 0 },
    ObjectManager: {}, PlayerManager: {}, isOwner: true
  };
  client._ModuleHandler = new TestModuleHandler(client);
  const anti = new AntiInsta(client);
  client._ModuleHandler.staticModules.antiInsta = anti;
  client.antiInsta = anti;
  return client;
}
module.exports = { makeClient, TestPlayer, TestModuleHandler, makeEnemyManager,
  SHAME_WINDOW_MS, BULL_TICK_DAMAGE, BULL_TICK_PERIOD, SAFE_SOLDIER_RANGE,
  DEF_HAT_SAFE_SOLDIER, DEF_HAT_SHAME_RECOVER, DEF_HAT_SHAME_CRITICAL,
  DEF_HAT_THREAT, DEF_HAT_LETHAL, SHAME_CEILING, SHAME_HIGH, PREHEAL_FLOOR,
  THREAT_INSTA, THREAT_VELOCITY_TICK, THREAT_REVERSE_INSTA, THREAT_MUSKET_BOW,
  THREAT_SPIKE_PUSH, THREAT_KNOCKBACK_TICK, THREAT_SPIKE_TICK, THREAT_ONE_TICK,
  THREAT_SPAM_DAGGER_BULL, THREAT_SPAM_BOW, THREAT_PRIMARY_RANGED,
  THREAT_TURRET, THREAT_SHAME, THREAT_SEQUENCE };
`;

// A clock the tests can drive. Everything under test reads wall time through
// Date.now(), and a tick loop that runs in microseconds needs time to advance
// the way the game's would.
const clock = { t: Date.now() };
function FakeDate(...args) { return new Date(...args); }
FakeDate.now = () => clock.t;
FakeDate.prototype = Date.prototype;

const sandbox = { module: { exports: {} }, console, Date: FakeDate, Math, Number, Object, Set, Map, JSON };
sandbox.exports = sandbox.module.exports;
vm.createContext(sandbox);
vm.runInContext(PRELUDE + '\n' + ANTI_BLOCK + '\n' + EPILOGUE, sandbox, { filename: 'autoheal-under-test.js' });
module.exports = Object.assign(sandbox.module.exports, { clock, now: () => clock.t });
