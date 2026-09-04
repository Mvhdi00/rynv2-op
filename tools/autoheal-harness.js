// Headless harness for the RYN Type 2 Auto Heal.
//
// It cuts the module and the game data tables straight out of the userscript
// rather than keeping a copy, so the suite can only ever be run against what
// actually ships. Around them it stands up the smallest client the module
// touches: myPlayer, EnemyManager, ProjectileManager, PlayerManager,
// ObjectManager, ModuleHandler and the packet counter. Date.now is replaced by
// a clock the tests drive, because every shame decision is a timing decision.
//
//     node tools/autoheal-tests.js     scenarios, one behaviour at a time
//     node tools/autoheal-stress.js    the shame invariant against a server
//                                      model, plus the per-tick cost
//
// RYN_FILE=<path> points it at a different build.
const fs = require('fs');
const path = require('path');
const dir = __dirname;

// Always cut the module out of the live build, so the suite can never be run
// against a stale copy of it.
const SOURCE = process.env.RYN_FILE || path.join(dir, '..', 'Ryn_Type_2.user.js');
const lines = fs.readFileSync(SOURCE, 'utf8').split('\n');
const bannerAt = lines.findIndex(l => l.trim() === '// RYN AUTO HEAL');
const endAt = lines.findIndex(l => l === '  const AntiInsta_default = RynAutoHeal;');
if (bannerAt < 1 || endAt < 0) throw new Error('could not find the Auto Heal block in ' + SOURCE);
const tablesFrom = lines.findIndex(l => l === '  const Weapons = [ {');
const tablesTo = lines.findIndex(l => l === '  const DataHandler_default = DataHandler;');
if (tablesFrom < 0 || tablesTo < 0) throw new Error('could not find the data tables in ' + SOURCE);
const tables = lines.slice(tablesFrom, tablesTo + 1).join('\n');
const autoheal = lines.slice(bannerAt - 1, endAt + 1).join('\n');

// --- stubs the module text expects to find in scope -------------------------
const prelude = `
  class PlayerObject {
    constructor(o) { Object.assign(this, o); }
  }
  const Settings_default = __settings;
`;

const factory = new Function('__settings','__dbg', `
${tables}
${prelude}
${autoheal}
return { RynAutoHeal, AhLedger, AhShame, AhThreat, AhPlan, AhBudget,
         Hats, Items, Weapons, Projectiles, Accessories, WeaponVariants,
         DataHandler_default, PlayerObject,
         AH: { SOLDIER: AH_SOLDIER_HAT, BULL: AH_BULL_HAT, CEILING: AH_SHAME_CEILING,
               GAP: AH_SHAME_SAFE_GAP, HEAL_PACKETS: AH_HEAL_PACKETS,
               RESERVE_IDLE: AH_RESERVE_IDLE, RESERVE_FIGHT: AH_RESERVE_FIGHT,
               MAX_BURST: AH_MAX_BURST, BULL_MIN_HP: AH_BULL_MIN_HP,
               T: { INSTA: AH_T_INSTA, REVERSE: AH_T_REVERSE, VELOCITY: AH_T_VELOCITY,
                    RANGED: AH_T_RANGED, TURRET: AH_T_TURRET, ONETICK: AH_T_ONETICK,
                    SPIKETICK: AH_T_SPIKETICK, SPIKEPUSH: AH_T_SPIKEPUSH,
                    KNOCKBACK: AH_T_KNOCKBACK, SPIKECONTACT: AH_T_SPIKECONTACT,
                    DAGGERSPAM: AH_T_DAGGERSPAM, BOWSPAM: AH_T_BOWSPAM,
                    POISON: AH_T_POISON, PRIMARY_RANGED: AH_T_PRIMARY_RANGED,
                    SMARTTICK: AH_T_SMARTTICK, TOOLHAMMER: AH_T_TOOLHAMMER,
                    SPIKESYNC: AH_T_SPIKESYNC } } };
`);

const settings = {
  _autoheal: true,
  _novaGear: true,
  _safeSoldier: true,
  _antiSmartTick: true
};

let DBG=null;
const M = factory(settings, o => { if (DBG) DBG(o); });
global.__setDbg = fn => { DBG = fn; };

// --- a minimal client -------------------------------------------------------
function vec(x, y) {
  return {
    x: x,
    y: y,
    _setXY(nx, ny) { this.x = nx; this.y = ny; },
    distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  };
}

let CLOCK = 1000000;
const realNow = Date.now;
Date.now = () => CLOCK;

class FakePlayer {
  constructor(o) {
    this.id = o.id;
    this.pos = { current: vec(o.x || 0, o.y || 0), previous: vec(o.x || 0, o.y || 0), future: vec(o.x || 0, o.y || 0) };
    this.hatID = o.hatID || 0;
    this.accessoryID = o.accessoryID || 0;
    this.currentItem = -1;
    this.scale = 35;
    this.weapon = { current: o.primary != null ? o.primary : 0, primary: o.primary != null ? o.primary : 0, secondary: o.secondary != null ? o.secondary : null };
    this.variant = { current: o.variant || 0 };
    this.reload = [ { current: 10, max: 10 }, { current: 10, max: 10 }, { current: 23, max: 23 } ];
    this.canPlaceSpike = !!o.canPlaceSpike;
    this.spikeDamage = o.spikeDamage || 0;
    this.futureHat = o.futureHat != null ? o.futureHat : null;
    this.usesTurret = !!o.usesTurret;
    this.isTrapped = !!o.isTrapped;
    this.trappedIn = o.trappedIn || null;
    this.tickCount = 0;
    this.poisonCount = o.poisonCount || 0;
  }
  get hitScale() { return this.scale * 1.8; }
  isReloaded(type, tick) { return this.reload[type].current >= this.reload[type].max - tick; }
  isEnemyByID(id) { return id !== this.id; }
  getMaxWeaponDamage(id, lookingShield, addBull = true) {
    const w = M.Weapons[id];
    if (!w || !('damage' in w)) return 0;
    let d = w.damage;
    if (addBull) d *= M.Hats[7].dmgMultO;
    d *= M.WeaponVariants[this.variant.current].val;
    return d;
  }
  getDmgOverTime() {
    let d = 0;
    const hat = M.Hats[this.hatID];
    if (hat && 'healthRegen' in hat) d += hat.healthRegen;
    if (this.poisonCount !== 0) d += -5;
    return Math.abs(d);
  }
}

class FakeMyPlayer extends FakePlayer {
  constructor(o) {
    super(Object.assign({ id: 0 }, o));
    this.inGame = true;
    this.tempHealth = o.health != null ? o.health : 100;
    this.currentHealth = this.tempHealth;
    this.maxHealth = 100;
    this.shameCount = o.shame || 0;
    this.shameActive = !!o.shameActive;
    this.isSandbox = false;
    this.inventory = { 0: 5, 1: 10, 2: o.food != null ? o.food : 0 };
    this.food = 100;
    this._canPlace = o.canPlaceFood !== false;
  }
  getItemByType(t) { const v = this.inventory[t]; return v === undefined ? null : v; }
  canPlace(t) { return this._canPlace; }
  getBuildingDamage() { return 75; }
}

function makeClient(o) {
  o = o || {};
  const my = new FakeMyPlayer(o.my || {});
  const enemies = (o.enemies || []).map((e, i) => new FakePlayer(Object.assign({ id: i + 1 }, e)));
  const packets = { count: o.packets || 0 };
  const mh = {
    packetLimit: 119,
    get packetCount() { return packets.count; },
    forceHat: null,
    useHat: null,
    forceWeapon: null,
    shouldAttack: false,
    moduleActive: false,
    healedOnce: false,
    didAntiInsta: false,
    staticModules: {},
    canBuy(type, id) { return (o.owns || [ 6, 7 ]).indexOf(id) !== -1; },
    setForceHat(h) { if (this.forceHat !== null && h !== null) return; this.forceHat = h; },
    rawHeals: 0,
    predicted: [],
    _rawHeal() {
      this.rawHeals += 1;
      packets.count += 3;
      const ah = this.staticModules.antiInsta;
      if (ah) this.predicted.push(ah.noteConsume());
    }
  };
  const em = Object.assign({
    potentialDamage: 0,
    potentialSpikeDamage: 0,
    detectedEnemy: false,
    detectedDangerEnemy: false,
    dangerWithoutSoldier: false,
    reverseInsta: false,
    velocityTickThreat: false,
    rangedBowInsta: false,
    toolHammerInsta: false,
    spikeSyncThreat: false,
    pushingOnSpike: false,
    possibleToKnockback: false,
    collidingSpike: false,
    willCollideSpike: false,
    nearestPushSpike: null,
    nearestDangerAnimal: null,
    nearestEnemy: enemies[0] || null,
    nearestEnemyInRangeOf(range, target) {
      const e = target || this.nearestEnemy;
      return e !== null && my.pos.current.distance(e.pos.current) <= range;
    }
  }, o.em || {});
  const client = {
    SocketManager: { pong: o.pong || 0 },
    myPlayer: my,
    PlayerManager: { players: [ my ].concat(enemies), enemies: enemies },
    EnemyManager: em,
    ProjectileManager: { dangerProjectiles: new Set(o.projectiles || []), totalDamage: 0 },
    ObjectManager: {
      objects: new Map,
      grid2D: { query() { return false; } },
      canPlaceItem() { return true; }
    },
    _ModuleHandler: mh
  };
  const ah = new M.RynAutoHeal(client);
  mh.staticModules.antiInsta = ah;
  return { client: client, ah: ah, mh: mh, my: my, em: em, enemies: enemies, packets: packets };
}

// --- test plumbing ----------------------------------------------------------
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass += 1; return; }
  fail += 1;
  failures.push(name + (detail ? '  [' + detail + ']' : ''));
}
function tick(w, n) {
  for (let i = 0; i < (n || 1); i++) {
    w.my.tickCount += 1;
    CLOCK += 111;
    w.mh.forceHat = null;
    w.mh.useHat = null;
    w.mh.shouldAttack = false;
    w.mh.moduleActive = false;
    w.ah.postTick();
  }
}
function report() {
  console.log('\npassed ' + pass + ', failed ' + fail);
  if (failures.length) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log('  - ' + f);
  }
  Date.now = realNow;
  process.exit(fail ? 1 : 0);
}
module.exports = { M, makeClient, check, tick, report, vec, FakePlayer,
                   clock: { get: () => CLOCK, advance: ms => { CLOCK += ms; } },
                   settings: settings,
                   stats: () => ({ pass, fail }) };
