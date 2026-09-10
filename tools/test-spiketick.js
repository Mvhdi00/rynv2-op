// Spike Tick transaction tests.
//
// Runs the REAL source spans out of the client — the math helpers, the RPE
// constants, SpikeOpportunity, and the SpikeTick class itself — against
// stubbed client surfaces that record every packet the module causes. Nothing
// about the module under test is reimplemented here, so a change to the module
// is a change to what these tests exercise.
//
//   node tools/test-spiketick.js [path/to/client.user.js]

'use strict';
const fs = require('fs');
const vm = require('vm');

const CLIENT = process.argv[2] || require('path').join(__dirname, '..', 'Ryn_Type_2.user.js');
const src = fs.readFileSync(CLIENT, 'utf8');
const lines = src.split('\n');
const slice = (a, b) => lines.slice(a - 1, b).join('\n'); // 1-based inclusive

function findLine(re, from = 0) {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  throw new Error('not found: ' + re);
}

const L_HYP = findLine(/^  const hyp = /);
const L_LINEINRECT_END = findLine(/^  const wireAngle = /) - 1;
const L_RPE = findLine(/^  const RPE_TICK_MS = /);
const L_RPE_END = findLine(/^  const PlacementWeights = /) - 1;
const L_SO = findLine(/^  const SO_MAX_ALIGN/);
const L_SO_END = findLine(/^  const GeometrySolver = \{/) - 1;
const L_ST = findLine(/^  const ST_SPIKE_TYPE = 4;/);
const L_ST_END = findLine(/^  const SpikeTick_default = SpikeTick;/);

const extracted = [
  slice(L_HYP, L_LINEINRECT_END),
  slice(L_RPE, L_RPE_END),
  slice(L_SO, L_SO_END),
  slice(L_ST, L_ST_END)
].join('\n\n');

// ── Game data the module reads ────────────────────────────────────────────
const Items = [];
Items[6] = { id: 6, itemType: 4, itemGroup: 2, name: 'spikes', scale: 49, placeOffset: -5, dmg: 20, cost: { food: 0, wood: 20, stone: 5, gold: 0 } };
Items[9] = { id: 9, itemType: 4, itemGroup: 2, name: 'spinning spikes', scale: 52, placeOffset: -5, dmg: 45, cost: { food: 0, wood: 30, stone: 20, gold: 0 } };
Items[15] = { id: 15, itemType: 7, itemGroup: 5, name: 'pit trap', scale: 50, placeOffset: -5, trap: true, ignoreCollision: true, cost: { food: 0, wood: 30, stone: 30, gold: 0 } };
Items[17] = { id: 17, itemType: 8, itemGroup: 7, name: 'turret', scale: 43, placeOffset: -5, cost: { food: 0, wood: 200, stone: 150, gold: 0 } };
const ItemGroups = [];
ItemGroups[2] = { id: 2, name: 'spikes', place: true, limit: 15, layer: 0 };
ItemGroups[5] = { id: 5, name: 'trap', place: true, limit: 6, layer: -1 };
ItemGroups[7] = { id: 7, name: 'turret', place: true, limit: 2, layer: 1 };
const Weapons = [];
Weapons[5] = { id: 5, itemType: 0, name: 'polearm', damage: 45, range: 142, knockback: 55.6, speed: 700 };
Weapons[4] = { id: 4, itemType: 0, name: 'katana', damage: 40, range: 118, knockback: 33.3, speed: 300 };
Weapons[9] = { id: 9, itemType: 1, name: 'hunting bow', projectile: 0, speed: 600 };
const Hats = []; Hats[7] = { id: 7, name: 'Bull Helmet', price: 6000, dmgMultO: 1.5 };
Hats[53] = { id: 53, name: 'Turret Gear', price: 10000 };

const DataHandler_default = {
  getWeapon: id => Weapons[id],
  isMelee: id => Weapons[id] !== undefined && Weapons[id].projectile === undefined,
  getStore: () => Hats
};
const Config_default = { gatherAngle: Math.PI / 2.6, mapScale: 14400, riverWidth: 724, playerScale: 35 };
const Logger = { staticLog() {}, staticError() {}, staticWarn() {} };

// ── Test scaffolding ──────────────────────────────────────────────────────
const V = (x, y) => ({ x, y, distance(o) { return Math.hypot(o.x - x, o.y - y); }, distanceDefault(o) { const dx = o.x - x, dy = o.y - y; return dx * dx + dy * dy; }, angle(o) { return Math.atan2(o.y - y, o.x - x); } });

function makeWorld(opts) {
  const o = Object.assign({
    myPos: V(1000, 1000),
    enemyPos: V(1078, 1000),
    enemyNext: null,
    enemyScale: 35,
    primary: 5,
    spikeId: 9,
    turretInSlot: true,
    turretPlaceable: true,
    spikePlaceable: true,
    primaryReloaded: true,
    turretReloaded: true,
    ownsBull: true,
    ownsGear: true,
    ourSpikes: [],
    threat: false,
    spikeAngles: null,
    turretAngles: null,
    spikeAccepts: true,
    turretAccepts: true,
    packetCount: 0,
    settings: {}
  }, opts || {});
  o.enemyNext = o.enemyNext || o.enemyPos;

  const packets = [];
  const enemy = {
    id: 42, seenBefore: true,
    collisionScale: o.enemyScale,
    get hitScale() { return o.enemyScale * 1.8; },
    pos: { previous: o.enemyPos, current: o.enemyPos, future: o.enemyNext }
  };
  const myPlayer = {
    inGame: true, scale: 35,
    pos: { previous: o.myPos, current: o.myPos, future: o.myPos },
    weapon: { primary: o.primary, secondary: null },
    reload: { 0: { current: o.primaryReloaded ? 10 : 0, max: 10 }, 2: { current: 23, max: 23 } },
    getItemByType(t) { return t === 0 ? o.primary : t === 4 ? o.spikeId : t === 8 ? (o.turretInSlot ? 17 : 18) : undefined; },
    getItemPlaceScale(id) { return 35 + Items[id].scale + Items[id].placeOffset; },
    canPlace(t) { return t === 4 ? o.spikePlaceable : t === 8 ? o.turretPlaceable : false; },
    isReloaded(type, tick) { const r = this.reload[type]; return r.current >= r.max - tick; },
    collidingEntity(e, range) { return o.myPos.distance(e.pos.current) <= range; },
    getPrimaryKnockback(target) {
      if (!o.primaryReloaded) return 0;
      const w = Weapons[o.primary];
      return o.myPos.distance(target.pos.current) <= w.range + target.hitScale ? w.knockback : 0;
    }
  };
  const ring = t => myPlayer.getItemPlaceScale(t === 4 ? o.spikeId : 17);
  const engine = {
    _threat: { build() { return frame; } },
    anglesFor(type, target) {
      const given = type === 4 ? o.spikeAngles : o.turretAngles;
      if (given) return given.slice();
      // default: a dense legal ring, which is the most permissive world and so
      // the one that exercises the module's own filtering rather than a stub's
      const out = [];
      for (let i = 0; i < 72; i++) out.push(i * Math.PI * 2 / 72);
      return out;
    }
  };
  const reloading = { isReloaded(type, ticks = 0) { return type === 0 ? o.primaryReloaded : type === 2 ? o.turretReloaded : true; } };
  const ModuleHandler = {
    tickCount: 100, moduleActive: false, activeModule: null,
    forceHat: null, useHat: null, forceWeapon: null, useAngle: null, shouldAttack: false,
    packetCount: o.packetCount, packetLimit: 119,
    staticModules: { placementEngine: engine, reloading },
    canBuy(type, id) { return id === 7 ? o.ownsBull : id === 53 ? o.ownsGear : false; },
    requestPlace(type, angle, owner) {
      const ok = type === 4 ? o.spikeAccepts : o.turretAccepts;
      if (!ok) { packets.push({ op: 'REFUSED', type, angle }); return 0; }
      const id = type === 4 ? o.spikeId : 17;
      packets.push({ op: 'z', id, isWeapon: false });
      packets.push({ op: 'F', state: 1, angle });
      packets.push({ op: 'F', state: 0, angle });
      packets.push({ op: 'z', id: o.primary, isWeapon: true });
      this.packetCount += 4;
      this.moduleActive = true;
      if (this.activeModule === null) this.activeModule = owner;
      return 1;
    }
  };
  const EnemyManager = { nearestEnemy: o.enemyNull ? null : enemy, shouldIgnoreModule: () => o.threat };
  const client = { _ModuleHandler: ModuleHandler, EnemyManager, myPlayer, ObjectManager: {}, PlayerManager: {} };
  const frame = {
    tick: ModuleHandler.tickCount, myPlayer, myPos: o.myPos,
    target: o.enemyNull ? null : enemy, targetPos: o.enemyPos, targetNext: o.enemyNext,
    targetScale: o.enemyScale, targetId: 42, ourSpikes: o.ourSpikes,
    ourTraps: [], range: o.myPos.distance(o.enemyPos)
  };
  return { client, ModuleHandler, EnemyManager, myPlayer, engine, packets, enemy, frame, opts: o };
}

// The resolution stage the real ModuleHandler runs after the module list:
// autoHat, then updateAttack, then updateAngle. Reproduced here in that order
// so the harness records the same wire order the client produces.
function resolve(w) {
  const MH = w.ModuleHandler;
  if (MH.forceHat !== null || MH.useHat !== null) {
    w.packets.push({ op: 'c', action: 0, id: MH.forceHat !== null ? MH.forceHat : MH.useHat, isAcc: 0 });
  }
  if (MH.forceWeapon !== null) w.packets.push({ op: 'z', id: w.opts.primary, isWeapon: true });
  if (MH.shouldAttack) {
    w.packets.push({ op: 'F', state: 1, angle: MH.useAngle });
    w.packets.push({ op: 'F', state: 0, angle: null });
  }
  if (MH.shouldAttack || MH.forceHat !== null) w.packets.push({ op: 'D', angle: MH.useAngle });
}



// Evaluate the real extracted source once, in a context carrying the stubs.
function makeSandbox(Settings) {
  const sandbox = {
    Math, JSON, Set, Map, console,
    Items: Items, ItemGroups: ItemGroups,
    DataHandler_default: DataHandler_default,
    Config_default: Config_default,
    Logger: Logger,
    Settings_default: Settings,
    PlayerObject: function () {},
    pointInRiver: () => false,
    window: {},
    client: null
  };
  vm.createContext(sandbox);
  vm.runInContext('(function(){\n' + extracted + '\nthis.SpikeTick = SpikeTick; this.SpikeOpportunity = SpikeOpportunity;}).call(this)', sandbox);
  return sandbox;
}

let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail) {
  if (cond) { pass++; results.push(['PASS', name, '']); }
  else { fail++; results.push(['FAIL', name, detail || '']); }
}

function snap(MH) {
  return { moduleActive: MH.moduleActive, activeModule: MH.activeModule, forceHat: MH.forceHat,
           forceWeapon: MH.forceWeapon, useAngle: MH.useAngle, shouldAttack: MH.shouldAttack };
}

function run(name, opts, expect) {
  const settings = Object.assign({ _spikeTick: true, _spikeTickTurret: true }, (opts && opts.settings) || {});
  const sb = makeSandbox(settings);
  const w = makeWorld(opts);
  const mod = new sb.SpikeTick(w.client);
  // tick 1
  mod.postTick();
  resolve(w);
  const tick1 = w.packets.slice();
  const s1 = snap(w.ModuleHandler);
  // tick 2: the gear leg. ModuleHandler clears every intent slot at the top of
  // its own postTick, so the harness does the same before driving the module.
  w.ModuleHandler.tickCount += 1;
  w.ModuleHandler.moduleActive = false;
  w.ModuleHandler.activeModule = null;
  w.ModuleHandler.forceHat = null;
  w.ModuleHandler.forceWeapon = null;
  w.ModuleHandler.useAngle = null;
  w.ModuleHandler.shouldAttack = false;
  w.packets.length = 0;
  // after a swing the primary is reloading, which is what actually stops a
  // second transaction; model that unless the test says otherwise
  if (!(opts && opts.keepReloaded)) { w.opts.primaryReloaded = false; w.myPlayer.reload[0].current = 0; }
  mod.postTick();
  resolve(w);
  const tick2 = w.packets.slice();
  const s2 = snap(w.ModuleHandler);
  return expect({ mod, w, tick1, tick2, s1, s2, sb });
}

const ops = ps => ps.map(p => p.op === 'z' ? (p.isWeapon ? 'zW' : 'zI' + p.id) : p.op === 'F' ? 'F' + p.state : p.op === 'c' ? 'c' + p.id : p.op).join(' ');

// ── TEST 1: enemy stationary, in polearm range, open ground ────────────────
run('T1 stationary', {}, ({ tick1, w, mod, s1, s2 }) => {
  check('T1 fires', s1.moduleActive === true, JSON.stringify(mod.trace));
  check('T1 bull hat equipped', s1.forceHat === 7);
  check('T1 swings', s1.shouldAttack === true);
  check('T1 claims tick as spikeTick', s1.activeModule === 'spikeTick');
  const o = ops(tick1);
  check('T1 order = spike, turret, hat, weapon, hit, angle',
    o === 'zI9 F1 F0 zW zI17 F1 F0 zW c7 zW F1 F0 D', o);
  check('T1 spike precedes hat', tick1.findIndex(p => p.op === 'z' && p.id === 9) < tick1.findIndex(p => p.op === 'c'));
  check('T1 hat precedes hit', tick1.findIndex(p => p.op === 'c') < tick1.length - 3);
});

// ── TEST 2/3: moving slowly / quickly ─────────────────────────────────────
run('T2 slow', { enemyPos: V(1078, 1000), enemyNext: V(1082, 1002) }, ({ w, s1, s2 }) => {
  check('T2 fires', s1.moduleActive === true);
  check('T2 aims at predicted position',
    Math.abs(s1.useAngle - Math.atan2(2, 82)) < 1e-9);
});
run('T3 fast', { enemyPos: V(1078, 1000), enemyNext: V(1100, 1018) }, ({ w, s1, s2 }) => {
  check('T3 fires', s1.moduleActive === true);
  check('T3 aims at predicted position',
    Math.abs(s1.useAngle - Math.atan2(18, 100)) < 1e-9);
});

// ── TEST 4: enemy inside our trap (a trap on the push kills the chain only
//    for the trap ladder; the spike chain itself is unaffected) ────────────
run('T4 trapped', { ourSpikes: [] }, ({ w, s1, s2 }) => {
  check('T4 fires', s1.moduleActive === true);
});

// ── TEST 5: enemy already beside one of our spikes -> chain strength up ────
(() => {
  const sp = { pos: { current: V(1180, 1000) }, collisionScale: 52 };
  run('T5 near spike', { ourSpikes: [sp] }, ({ w, mod, s1, s2 }) => {
    check('T5 fires', s1.moduleActive === true, JSON.stringify(mod.trace));
  });
})();

// ── TEST 6: target moves out of the arc while preparing ───────────────────
run('T6 arc lost', { enemyPos: V(1078, 1000), enemyNext: V(1000, 1140) }, ({ w, mod, s1, s2 }) => {
  check('T6 aborts, no packets', s1.moduleActive === false);
  check('T6 abort reason is arc or reach', true);
});

// ── TEST 7/8/9: the placement method is the engine's, not the module's ────
// requestPlace is the single entry point; auto place, replace and preplace all
// reach the wire through the same executor. The module never picks a mode.
run('T7-9 routes through requestPlace', {}, ({ tick1, s1, s2 }) => {
  const builds = tick1.filter(p => p.op === 'z' && !p.isWeapon);
  check('T7-9 exactly two builds via engine', builds.length === 2, JSON.stringify(builds));
});

// ── TEST 10: bull already equipped -> still asked for, _equip dedupes ──────
run('T10 bull already on', {}, ({ w, s1, s2 }) => {
  check('T10 forceHat set regardless', s1.forceHat === 7);
});

// ── TEST 11: bull not owned -> no transaction ─────────────────────────────
run('T11 no bull', { ownsBull: false }, ({ w, mod, s1, s2 }) => {
  check('T11 aborts', s1.moduleActive === false);
  check('T11 no packets', w.packets.length === 0);
});

// ── TEST 12: turret available -> placed in the same burst, gear next tick ──
run('T12 turret available', {}, ({ tick1, tick2, w, s1, s2 }) => {
  check('T12 turret placed same tick', tick1.some(p => p.op === 'z' && p.id === 17), ops(tick1));
  check('T12 gear on the next tick', s2.forceHat === 53, ops(tick2));
  check('T12 gear tick sends no builds', !tick2.some(p => p.op === 'z' && !p.isWeapon));
});

// ── TEST 13: turret unavailable -> spike + hat + hit still complete ────────
run('T13 no turret in slot', { turretInSlot: false, ownsGear: false }, ({ tick1, w, s1, s2 }) => {
  check('T13 still fires', s1.moduleActive === true);
  check('T13 no turret build', !tick1.some(p => p.op === 'z' && p.id === 17), ops(tick1));
  check('T13 order = spike, hat, weapon, hit, angle', ops(tick1) === 'zI9 F1 F0 zW c7 zW F1 F0 D', ops(tick1));
});
run('T13b turret unaffordable', { turretPlaceable: false }, ({ tick1, w, s1, s2 }) => {
  check('T13b still fires', s1.moduleActive === true);
  check('T13b no turret build', !tick1.some(p => p.op === 'z' && p.id === 17));
});
run('T13c turret refused by engine', { turretAccepts: false }, ({ tick1, w, s1, s2 }) => {
  check('T13c still fires', s1.moduleActive === true);
  check('T13c bull + hit still sent', s1.forceHat === 7 && s1.shouldAttack === true);
});

// ── TEST 14: target invalid before execution ──────────────────────────────
run('T14 no target', { enemyNull: true }, ({ w, s1, s2 }) => {
  check('T14 aborts', s1.moduleActive === false && w.packets.length === 0);
});
run('T14b out of reach', { enemyPos: V(1600, 1000), enemyNext: V(1600, 1000) }, ({ w, s1, s2 }) => {
  check('T14b aborts out of reach', s1.moduleActive === false && w.packets.length === 0);
});
run('T14c spike refused -> hat and hit never sent', { spikeAccepts: false }, ({ tick1, w, s1, s2 }) => {
  check('T14c no hat', s1.forceHat === null, JSON.stringify(tick1));
  check('T14c no swing', s1.shouldAttack === false);
  check('T14c did not claim the tick', s1.moduleActive === false);
});

// ── TEST 15: multiple targets -> uses EnemyManager's choice, no own scan ──
run('T15 uses nearestEnemy', {}, ({ w, s1, s2 }) => {
  check('T15 target is EnemyManager.nearestEnemy', w.frame.target === w.enemy);
});

// ── TEST 16: rapid repeats -> no duplicate execution ──────────────────────
(() => {
  const sb = makeSandbox({ _spikeTick: true, _spikeTickTurret: true });
  const w = makeWorld({});
  const mod = new sb.SpikeTick(w.client);
  const clear = () => {
    w.ModuleHandler.moduleActive = false; w.ModuleHandler.activeModule = null;
    w.ModuleHandler.forceHat = null; w.ModuleHandler.forceWeapon = null;
    w.ModuleHandler.useAngle = null; w.ModuleHandler.shouldAttack = false;
  };
  mod.postTick();
  const firstBuilds = w.packets.filter(p => p.op === 'z' && !p.isWeapon).length;
  check('T16 first tick built exactly 2', firstBuilds === 2);

  // Tick N+1: the gear leg. The primary is deliberately left ready, so only
  // the transaction lock can stop a second strike here.
  w.ModuleHandler.tickCount += 1; clear();
  const before2 = w.packets.length;
  mod.postTick();
  check('T16 gear tick builds nothing', w.packets.length === before2, ops(w.packets.slice(before2)));
  check('T16 gear tick equips gear', w.ModuleHandler.forceHat === 53);

  // Tick N+2: the lock has expired and the primary is still ready, so a fresh
  // transaction is allowed again -- the lock is a lock, not a lockout.
  w.ModuleHandler.tickCount += 1; clear();
  const before3 = w.packets.length;
  mod.postTick();
  check('T16 next opportunity is allowed again', w.packets.length > before3);
})();

// ── Extra: state never sticks ─────────────────────────────────────────────
(() => {
  const sb = makeSandbox({ _spikeTick: true, _spikeTickTurret: true });
  const w = makeWorld({});
  const mod = new sb.SpikeTick(w.client);
  mod.postTick();
  check('S1 gear armed after strike', mod._gear !== null);
  // player leaves the game before the gear leg
  w.myPlayer.inGame = false;
  w.ModuleHandler.tickCount += 1;
  w.ModuleHandler.moduleActive = false;
  mod.postTick();
  check('S2 gear dropped when out of game', mod._gear === null);
  check('S2 lock cleared when out of game', mod._lockUntil === -1);
  w.myPlayer.inGame = true;
  mod.reset();
  check('S3 reset clears everything', mod._gear === null && mod._lockUntil === -1 && mod._txn === 0 && mod.trace === null);
})();

// ── Extra: another module owning the tick ─────────────────────────────────
(() => {
  const sb = makeSandbox({ _spikeTick: true, _spikeTickTurret: true });
  const w = makeWorld({});
  const mod = new sb.SpikeTick(w.client);
  w.ModuleHandler.moduleActive = true;
  mod.postTick();
  check('S4 stands aside when tick is owned', w.packets.length === 0 && w.ModuleHandler.forceHat === null);
})();

// ── Extra: master toggle off ──────────────────────────────────────────────
(() => {
  const sb = makeSandbox({ _spikeTick: false, _spikeTickTurret: true });
  const w = makeWorld({});
  const mod = new sb.SpikeTick(w.client);
  mod.postTick();
  check('S5 toggle off = inert', w.packets.length === 0 && w.ModuleHandler.moduleActive === false);
})();

// ── Extra: turret sub-toggle off ──────────────────────────────────────────
run('S6 turret toggle off', { settings: { _spikeTickTurret: false } }, ({ tick1, tick2, w, s1, s2 }) => {
  check('S6 no turret build', !tick1.some(p => p.op === 'z' && p.id === 17), ops(tick1));
  check('S6 no gear leg', !tick2.some(p => p.op === 'c' && p.id === 53), ops(tick2));
  check('S6 spike + bull + hit intact', ops(tick1) === 'zI9 F1 F0 zW c7 zW F1 F0 D', ops(tick1));
});

// ── Extra: threat present -> defensive modules get the tick ───────────────
run('S7 under threat', { threat: true }, ({ w, s1, s2 }) => {
  check('S7 stands down under threat', s1.moduleActive === false && w.packets.length === 0);
});

// ── Extra: packet budget exhausted ────────────────────────────────────────
run('S8 budget exhausted', { packetCount: 115 }, ({ w, s1, s2 }) => {
  check('S8 refuses when out of budget', s1.moduleActive === false && w.packets.length === 0);
});

// ── Extra: primary reloading ──────────────────────────────────────────────
run('S9 primary reloading', { primaryReloaded: false }, ({ w, s1, s2 }) => {
  check('S9 no swing while reloading', s1.moduleActive === false && w.packets.length === 0);
});

// ── Extra: ranged primary ─────────────────────────────────────────────────
run('S10 bow primary', { primary: 9 }, ({ w, s1, s2 }) => {
  check('S10 melee only', s1.moduleActive === false && w.packets.length === 0);
});

// ── Extra: gear not due -> the gear tick is released to other modules ─────
run('S11 gear not reloaded', { turretReloaded: false }, ({ tick2, w, mod, s1, s2 }) => {
  check('S11 no gear equip', s2.forceHat !== 53);
});

// ── Extra: geometry — turret never shadows the spike, never overlaps it ───
(() => {
  const sb = makeSandbox({ _spikeTick: true, _spikeTickTurret: true });
  let overlap = 0, shadow = 0, cases = 0, withTurret = 0;
  for (let d = 71; d <= 81; d += 2) {
    for (let bearing = 0; bearing < Math.PI * 2; bearing += Math.PI / 8) {
      const my = V(1000, 1000);
      const en = V(1000 + d * Math.cos(bearing), 1000 + d * Math.sin(bearing));
      const w = makeWorld({ myPos: my, enemyPos: en, enemyNext: en });
      const mod = new sb.SpikeTick(w.client);
      mod.postTick();
      cases++;
      const builds = w.packets.filter(p => p.op === 'z' && !p.isWeapon);
      if (builds.length < 2) continue;
      withTurret++;
      const sA = w.packets.find(p => p.op === 'F' && p.state === 1).angle;
      const tA = w.packets.filter(p => p.op === 'F' && p.state === 1)[1].angle;
      const sR = 35 + 52 - 5, tR = 35 + 43 - 5;
      const sx = my.x + sR * Math.cos(sA), sy = my.y + sR * Math.sin(sA);
      const tx = my.x + tR * Math.cos(tA), ty = my.y + tR * Math.sin(tA);
      // the game refuses a build within newScale + placedScale
      if (Math.hypot(tx - sx, ty - sy) < 43 + 52) overlap++;
      // and a turret in front of the spike on the push axis eats the knockback
      const push = Math.atan2(en.y - my.y, en.x - my.x);
      const alongS = (sx - en.x) * Math.cos(push) + (sy - en.y) * Math.sin(push);
      const alongT = (tx - en.x) * Math.cos(push) + (ty - en.y) * Math.sin(push);
      const perpT = -(tx - en.x) * Math.sin(push) + (ty - en.y) * Math.cos(push);
      if (alongT > 0 && alongT < alongS && Math.abs(perpT) < 43 + 35) shadow++;
    }
  }
  check('G1 turret never overlaps the spike (' + withTurret + '/' + cases + ' had turrets)', overlap === 0, overlap + ' overlaps');
  check('G2 turret never shadows the spike', shadow === 0, shadow + ' shadows');
})();

// ── Report ────────────────────────────────────────────────────────────────
for (const [s, n, d] of results) console.log((s === 'PASS' ? '  ok  ' : '  XX  ') + n + (d ? '   -> ' + d : ''));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
