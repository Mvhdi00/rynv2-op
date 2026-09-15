// Suite 6 — Auto Heal (Falcons V2 port).
//
// The class is lifted out of the shipped userscript by brace matching and run
// against stub game state, so a pass means the shipped code behaves. Every
// number the module treats as a game fact is checked against
// drivers/game-drivers.json first.
const path = require('path');
const fs = require('fs');
const { blockAt, SRC } = require(path.join(__dirname, 'extract-block.js'));
let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (e !== undefined ? '  -> ' + e : '')); } };

const DRV = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'drivers', 'game-drivers.json'), 'utf8'));
const cfg = DRV.config, ITEMS = DRV.items, HATS = DRV.hats, ACCS = DRV.accessories;
const WEAPONS = DRV.weapons, PROJECTILES = DRV.projectiles;
const TICK = 1000 / cfg.serverUpdateRate;

// ── A. the constants the port treats as game facts ────────────────────────
console.log('\n== A. heal constants vs the game tables ==');
{
  const hat = id => HATS.find(h => h.id === id);
  ok('soldier is hat 6 with dmgMult 0.75', hat(6).dmgMult === 0.75);
  ok('EMP is hat 22 and it is antiTurret', hat(22).antiTurret === 1);
  ok('bull is hat 7 and drains 5 a tick', hat(7).healthRegen === -5);
  ok('turret gear is hat 53 firing every 2500ms', hat(53).turret.rate === 2500);
  ok('monkey tail is accessory 11 at 0.2 outgoing', ACCS.find(a => a.id === 11).dmgMultO === 0.2);
  ok('the three attacker multipliers are 1 / bull 1.5 / bloodthirster 1.2',
     hat(7).dmgMultO === 1.5 && hat(55).dmgMultO === 1.2);
  ok('the turret projectile does 25', PROJECTILES[1].dmg === 25);
  const tiers = [6, 7, 9, 8].map(i => ITEMS[i].dmg);
  ok('the spike tiers are 20 / 35 / 45 / 30', JSON.stringify(tiers) === JSON.stringify([20, 35, 45, 30]), tiers.join(','));
  ok('source declares exactly those tiers', /HEAL_SPIKE_TIERS = \[ 20, 35, 45, 30 \]/.test(SRC));
  ok('source declares the game multipliers', /HEAL_ATTACKER_MULTS = \[ 1, 1\.5, 1\.2 \]/.test(SRC) && /HEAL_VICTIM_MULTS = \[ 1, \.2 \]/.test(SRC));
}

// ── build a runnable copy of the module ───────────────────────────────────
const headerIdx = SRC.indexOf('  // AUTO HEAL — Falcons V2');
const startIdx = SRC.lastIndexOf('  // =====', headerIdx);
const endMark = '  const AntiInsta_default = FalconHeal;';
const endIdx = SRC.indexOf(endMark);
if (startIdx < 0 || endIdx < 0) { console.log('  FATAL: heal section not found'); process.exit(1); }
const SECTION = SRC.slice(startIdx, endIdx + endMark.length);

// ── stub world ────────────────────────────────────────────────────────────
const hyp = (a, b) => Math.hypot(a, b);
const Config_default = cfg;
const RPE_TICK_MS = TICK;
const Items = ITEMS;
const WeaponVariants = cfg.weaponVariants;
class Vector_default {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
}
class PlayerObject {}
// The drivers table is the game's own field naming (dmg / type); RYN's
// DataHandler exposes the same rows as damage / itemType, so the stub renames
// them the way the client does rather than the module reaching for both.
const RYN_WEAPONS = WEAPONS.map(w => Object.assign({}, w, { damage: w.dmg, itemType: w.type }));
const DataHandler_default = {
  getWeapon: id => RYN_WEAPONS.find(w => w.id === id) || null,
  getProjectile: id => { const w = RYN_WEAPONS.find(x => x.id === id); return w && w.projectile !== undefined ? Object.assign({}, PROJECTILES[w.projectile], { damage: PROJECTILES[w.projectile].dmg }) : null; },
  isShootable: id => { const w = RYN_WEAPONS.find(x => x.id === id); return !!(w && w.projectile !== undefined); },
  isMelee: id => { const w = RYN_WEAPONS.find(x => x.id === id); return !!(w && w.projectile === undefined); }
};
let Settings_default = { _autoheal: true, _soldierEMP: true, _sensitiveHealing: false };
let _inputStub = { fastHealPress: false };
const IH = () => _inputStub;
const FalconHeal = eval('(function(){' + SECTION.replace('const AntiInsta_default = FalconHeal;', 'return FalconHeal;') + '})()');

// ── stub entities ─────────────────────────────────────────────────────────
const vec = (x, y) => new Vector_default(x, y);
function mkPlayer(o) {
  o = o || {};
  const rel = o.reload || [{ current: 9, max: 9 }, { current: 9, max: 9 }, { current: 23, max: 23 }];
  return {
    id: o.id === undefined ? 1 : o.id,
    currentHealth: o.health === undefined ? 100 : o.health,
    maxHealth: 100,
    hatID: o.hat || 0,
    accessoryID: o.acc || 0,
    shameCount: o.shame || 0,
    trappedIn: o.trappedIn || null,
    isSandbox: false,
    inGame: true,
    tickCount: o.tick === undefined ? 10 : o.tick,
    damages: o.damages || [],
    weapon: { primary: o.primary === undefined ? 5 : o.primary, secondary: o.secondary === undefined ? 10 : o.secondary },
    variant: { current: 0 },
    reload: rel,
    pos: { current: vec(o.x || 0, o.y || 0), future: vec(o.fx === undefined ? (o.x || 0) : o.fx, o.fy === undefined ? (o.y || 0) : o.fy) },
    getWeaponVariant: () => ({ current: o.variant || 0 }),
    getItemByType: t => t === 2 ? (o.food === undefined ? 0 : o.food) : (t === 4 ? (o.spike === undefined ? 6 : o.spike) : null)
  };
}
function mkClient(o) {
  o = o || {};
  const myPlayer = o.myPlayer || mkPlayer({});
  const enemies = o.enemies || [];
  const objects = o.objects || [];
  const sent = [];
  const objMap = new Map(objects.map(x => [x.id, x]));
  return {
    sent,
    myPlayer,
    EnemyManager: { velocityTickThreat: !!o.velThreat },
    PlayerManager: {
      players: [myPlayer].concat(enemies),
      enemies,
      animalData: new Map,
      isEnemyByID: (id, ref) => id !== (ref ? ref.id : myPlayer.id)
    },
    ObjectManager: {
      objects: objMap,
      grid2D: { query: (x, y, s, cb) => { for (const ob of objects) if (cb(ob.id)) return true; return false; } },
      canPlaceItem: () => true
    },
    _ModuleHandler: {
      packetCount: o.packetCount || 0,
      packetLimit: 119,
      healedOnce: false,
      staticModules: { autoPlacer: { _pointFree: () => o.buildable !== false } },
      canBuy: (t, id) => (o.owns || [6, 22, 7, 53]).indexOf(id) !== -1,
      selectItem: t => sent.push('z' + t),
      attack: () => sent.push('F1'),
      stopAttack: () => sent.push('F0'),
      whichWeapon: () => sent.push('zw'),
      _getPredictWeapon: () => 0
    }
  };
}
function mkSpike(id, x, y, ownerID, dmg, scale) {
  const o = Object.create(PlayerObject.prototype);
  o.id = id; o.ownerID = ownerID; o.scale = scale === undefined ? 49 : scale;
  o.pos = { current: vec(x, y) };
  o.getDamage = () => dmg;
  return o;
}

// ── B. damage identity ────────────────────────────────────────────────────
console.log('\n== B. getDamage / palette / soldierRound ==');
{
  const c = mkClient({});
  const h = new FalconHeal(c);
  const polearm = WEAPONS.find(w => w.id === 5);
  ok('a melee weapon is base x variant', h.getDamage(5, 0) === polearm.dmg && Math.abs(h.getDamage(5, 2) - polearm.dmg * 1.18) < 1e-9, h.getDamage(5, 2));
  // PORT-DIFF 2
  ok('a bow scores its projectile damage, not zero', h.getDamage(9, 0) === 25, h.getDamage(9, 0));
  ok('a musket scores 50', h.getDamage(15, 0) === 50, h.getDamage(15, 0));
  ok('Falcon read weapon.dmg, which is undefined here — the bug this avoids',
     WEAPONS.find(w => w.id === 9).dmg === undefined);

  const pal = h.findCachedDamage(5, 0, 45);
  ok('the palette is six entries', pal.length === 6, pal.length);
  ok('and holds base, bull, bloodthirster, each with and without monkey tail',
     [45, 9, 67.5, 13.5, 54, 10.8].every(v => pal.some(p => Math.abs(p - v) < 1e-9)), pal.join(','));
  ok('the palette is cached per weapon:variant', h.findCachedDamage(5, 0, 45) === pal);

  // PORT-DIFF 1: the tolerance has to apply with or without soldier on
  ok('a float-drifted value snaps onto the observed one without soldier',
     h.soldierRound(52.500000000001, 52.5) === 52.5, h.soldierRound(52.500000000001, 52.5));
  c.myPlayer.hatID = 6;
  ok('with soldier on, the palette entry is scaled by 0.75 first',
     h.soldierRound(60, 45) === 45, h.soldierRound(60, 45));
  c.myPlayer.hatID = 0;
  ok('a genuinely different number is left alone', h.soldierRound(45, 30) === 45);
}

// ── C. fitsPalette ────────────────────────────────────────────────────────
console.log('\n== C. fitsPalette ==');
{
  const enemy = mkPlayer({ id: 2, primary: 5, secondary: 10, variant: 0 });
  const c = mkClient({ enemies: [enemy] });
  const h = new FalconHeal(c);
  const polearmDmg = WEAPONS.find(w => w.id === 5).dmg;         // 45
  const hammerDmg = WEAPONS.find(w => w.id === 10).dmg;          // 10
  ok('a bare polearm hit is identified as primary', h.fitsPalette(polearmDmg, enemy) === 'primary');
  ok('a bull polearm hit is identified as primary', h.fitsPalette(polearmDmg * 1.5, enemy) === 'primary');
  ok('a hammer hit is identified as secondary', h.fitsPalette(hammerDmg, enemy) === 'secondary');
  ok('25 is identified as the turret', h.fitsPalette(25, enemy) === 'turret');
  ok('a number no weapon produces is unmatched', h.fitsPalette(37.3, enemy) === null);
  const archer = mkPlayer({ id: 3, primary: 5, secondary: 9 });
  ok('a bow shot is identified as secondary through the projectile', h.fitsPalette(25, archer) === 'secondary');
}

// ── D. reload / hasHit / one-tick ─────────────────────────────────────────
console.log('\n== D. reload, hasHit, one-tick ==');
{
  const enemy = mkPlayer({ id: 2, primary: 5, secondary: 10, reload: [{ current: 3, max: 6 }, { current: 6, max: 6 }, { current: 12, max: 23 }] });
  const c = mkClient({ enemies: [enemy] });
  const h = new FalconHeal(c);
  ok('a half-loaded primary reads 0.5', Math.abs(h.getReload(enemy, 5) - 0.5) < 1e-9, h.getReload(enemy, 5));
  ok('a full secondary reads 1', h.getReload(enemy, 10) === 1);
  ok('turret gear reads off its own 2500ms counter', Math.abs(h.getReload(enemy, 53) - 12 / 23) < 1e-9);
  enemy.reload[0].current = 1;
  ok('a weapon that fired one tick ago has hit', h.hasHit(enemy, 5) === true);
  enemy.reload[0].current = 5;
  ok('a weapon five ticks into its reload has not', h.hasHit(enemy, 5) === false);
  const heavy = mkPlayer({ id: 4, primary: 5, variant: 3 });
  ok('polearm + turret + ruby poison is a one-tick', h.checkCanOneTick(heavy) === true,
     1.5 * h.getDamage(5, 3) + 25 + 5);
  const light = mkPlayer({ id: 5, primary: 0, variant: 0 });
  ok('a tool hammer is not', h.checkCanOneTick(light) === false);
}

// ── E. knockback landing ──────────────────────────────────────────────────
console.log('\n== E. simulateMelee ==');
{
  const me = mkPlayer({ x: 100, y: 0 });
  const enemy = mkPlayer({ id: 2, x: 0, y: 0 });
  const c = mkClient({ myPlayer: me, enemies: [enemy] });
  const h = new FalconHeal(c);
  const landing = h.simulateMelee(5, me, enemy);      // polearm, knock 0.2
  const expect = 100 + (0.2 + 0.3) * TICK;
  ok('the push is away from the attacker', landing.x > 100 && Math.abs(landing.y) < 1e-6);
  ok('and is one tick of (0.3 + weapon.knock)', Math.abs(landing.x - expect) < 1e-6, landing.x.toFixed(2) + ' vs ' + expect.toFixed(2));
  const bat = h.simulateMelee(6, me, enemy);          // bat, knock 0.7
  ok('a bat pushes further than a polearm', bat.x > expect);
}

// ── F. validate ───────────────────────────────────────────────────────────
console.log('\n== F. validate ==');
{
  const c = mkClient({ myPlayer: mkPlayer({ health: 100, hat: 0 }) });
  const h = new FalconHeal(c);
  ok('soldier is valid when it leaves health behind', h.validate('soldier', 50, false) === true);
  ok('soldier is refused when it still kills', h.validate('soldier', 99.5, false) === false);
  const poor = mkClient({ myPlayer: mkPlayer({}), owns: [] });
  ok('a hat that is not owned is refused', new FalconHeal(poor).validate('soldier', 10, false) === false);
  // pinned with spikes in the sum and a loaded great hammer: break out instead
  const trapped = mkClient({ myPlayer: mkPlayer({ trappedIn: { id: 9, ownerID: 2 }, secondary: 10, reload: [{ current: 9, max: 9 }, { current: 9, max: 9 }, { current: 23, max: 23 }] }) });
  ok('pinned with a loaded great hammer refuses soldier', new FalconHeal(trapped).validate('soldier', 10, true) === false);
  ok('...but not when spikes are not part of it', new FalconHeal(trapped).validate('soldier', 10, false) === true);
  // EMP
  const empC = mkClient({ myPlayer: mkPlayer({ hat: 6, health: 100 }) });
  const empH = new FalconHeal(empC);
  ok('EMP is valid from soldier when removing 25 saves me', empH.validate('emp', 110) === true);
  ok('EMP is refused when 25 is not enough', empH.validate('emp', 130) === false);
  const bare = mkClient({ myPlayer: mkPlayer({ hat: 0 }) });
  ok('EMP is refused when soldier is not already on', new FalconHeal(bare).validate('emp', 110) === false);
  empH.forcedAddOns[0] = 1;
  ok('EMP is refused while something else is holding soldier', empH.validate('emp', 110) === false);
}

// ── G. forced add-ons ─────────────────────────────────────────────────────
console.log('\n== G. forced add-ons ==');
{
  const c = mkClient({});
  const h = new FalconHeal(c);
  let fired = 0;
  h._tick = 10;
  h.addForcedAddOnValue(1, 1, () => { fired++; });
  ok('the EMP slot is held', h.forcedEMP === true);
  ok('and the hold outlives the callback by a tick', h.forcedAddOns[1] === 2, h.forcedAddOns[1]);
  ok('wantsEMP is what ModuleHandler reads', h.wantsEMP === true);
  h._runQueues();
  ok('the callback fires on the next drain', fired === 1);
  h._tickForced();
  ok('the hat is still held on the tick the food lands', h.forcedEMP === true, h.forcedAddOns[1]);
  h._tickForced();
  ok('and released after it', h.forcedEMP === false);
  h.forcedAddOns[0] = 1;
  ok('onlySoldier sees the soldier slot', h.onlySoldier() === true);
  h.resetForcedAddOn(0);
  ok('and reset clears it', h.onlySoldier() === false);
  h.velSoldier = true;
  ok('onlySoldier also covers the standing reasons', h.onlySoldier() === true);
}

// ── H. shame handling ─────────────────────────────────────────────────────
console.log('\n== H. zero-shame hold ==');
{
  // no dangerous spike nearby: mode 2 holds instead of eating
  const c = mkClient({ myPlayer: mkPlayer({ health: 70 }) });
  const h = new FalconHeal(c);
  h._refresh();
  h.start0ShameHeal(2, 30);
  ok('mode 2 with no spike nearby holds the food', h.healingDelay === 2 && c.sent.length === 0, h.healingDelay);
  h.autoHealing();
  ok('and the hold counts down', h.healingDelay === 1);
  h.autoHealing();
  ok('then eats when it comes due', c.sent.length > 0, c.sent.join(','));

  // a spike that will hit me anyway: eat now rather than hold
  const spike = mkSpike(50, 20, 0, 2, 35);
  const c2 = mkClient({ myPlayer: mkPlayer({ health: 70 }), objects: [spike] });
  const h2 = new FalconHeal(c2);
  h2._refresh();
  h2.start0ShameHeal(2, 30);
  h2._runQueues();
  ok('mode 2 beside a spike eats on the next tick instead', c2.sent.length > 0 && h2.healingDelay === 0);

  // mode true, survivable spike: hold
  const c3 = mkClient({ myPlayer: mkPlayer({ health: 90 }), objects: [mkSpike(51, 20, 0, 2, 35)] });
  const h3 = new FalconHeal(c3);
  h3._refresh();
  h3.start0ShameHeal(true, 10);
  ok('mode 1 holds when the spike is survivable', h3.healingDelay === 2 && c3.sent.length === 0);
  // mode true, lethal spike: eat now
  const c4 = mkClient({ myPlayer: mkPlayer({ health: 20 }), objects: [mkSpike(52, 20, 0, 2, 35)] });
  const h4 = new FalconHeal(c4);
  h4._refresh();
  h4.start0ShameHeal(true, 80);
  h4._runQueues();
  ok('mode 1 eats when the spike would kill', c4.sent.length > 0);
}

// ── I. heal() on the wire ─────────────────────────────────────────────────
console.log('\n== I. heal() ==');
{
  const c = mkClient({ myPlayer: mkPlayer({ health: 60, food: 0 }) });   // apple, 20
  const h = new FalconHeal(c);
  const n = h.heal(40);
  ok('40 health of apples is two foods', n === 2, n);
  ok('and each is four packets: select, hit, stop, restore',
     c.sent.join(',') === 'z2,F1,F0,zw,z2,F1,F0,zw', c.sent.join(','));
  ok('healedOnce is raised for UpdateAngle and Placer', c._ModuleHandler.healedOnce === true);

  const cookie = mkClient({ myPlayer: mkPlayer({ health: 60, food: 1 }) });  // cookie, 40
  ok('40 health of cookie is one food', new FalconHeal(cookie).heal(40) === 1);

  // packet budget
  const broke = mkClient({ myPlayer: mkPlayer({ health: 20, food: 0 }), packetCount: 115 });
  ok('the budget caps the burst', new FalconHeal(broke).heal(80) === 1, 'budget 4 left');
  const full = mkClient({ myPlayer: mkPlayer({ health: 20, food: 0 }), packetCount: 119 });
  ok('and refuses it outright when there is nothing left', new FalconHeal(full).heal(80) === 0);
  ok('the per-tick ceiling holds', new FalconHeal(mkClient({ myPlayer: mkPlayer({ health: 1, food: 0 }) })).heal(400) === 5);
}

// ── J. the ladder ─────────────────────────────────────────────────────────
console.log('\n== J. main() priority ladder ==');
{
  const polearm = 5, hammer = 10;
  const dmgOf = (id, v) => WEAPONS.find(w => w.id === id).dmg * (cfg.weaponVariants[v || 0].val);
  // enemy hit me with primary and still has a loaded secondary + turret
  function scenario(o) {
    const enemy = mkPlayer({
      id: 2, x: 60, y: 0, primary: polearm, secondary: o.secondary === undefined ? hammer : o.secondary,
      reload: [{ current: 1, max: 6 }, { current: 6, max: 6 }, { current: 23, max: 23 }]
    });
    const me = mkPlayer({ health: o.health, hat: o.hat || 0, shame: o.shame || 0, damages: [dmgOf(polearm, 0)], food: 1 });
    const c = mkClient({ myPlayer: me, enemies: [enemy], owns: o.owns || [6, 22] });
    const h = new FalconHeal(c);
    h._tick = me.tickCount;
    h._refresh();
    h.main();
    return { c, h };
  }
  // survivable -> hold
  let r = scenario({ health: 95 });
  ok('a survivable tick holds the food instead of eating', r.h.healPriority === 0 && r.h.healingDelay > 0, r.h.healPriority + '/' + r.h.healingDelay);
  // lethal, melee secondary -> soldier (canEMP false because secondary is melee)
  r = scenario({ health: 30 });
  ok('a lethal tick with a melee follow-up goes to soldier', r.h.healPriority === 2, r.h.healPriority);
  ok('and holds the soldier slot', r.h.forcedAddOns[0] > 0);
  ok('the food is queued, not sent this tick', r.c.sent.length === 0);
  r.h._runQueues();
  ok('and lands on the next tick', r.c.sent.length > 0);
  // lethal, no soldier owned, low shame -> eat now
  r = scenario({ health: 30, owns: [] });
  ok('with no soldier owned and low shame it eats immediately', r.h.healPriority === 1 && r.c.sent.length > 0, r.h.healPriority);
  // lethal, no soldier owned, high shame -> hold
  r = scenario({ health: 30, owns: [], shame: 8 });
  ok('with shame already high it holds instead', r.h.healPriority === 1 && r.c.sent.length === 0 && (r.h.healingDelay > 0 || r.h._next.length > 0));
  // no enemies near at all
  {
    const me = mkPlayer({ health: 60, damages: [20], food: 1 });
    const c = mkClient({ myPlayer: me, enemies: [] });
    const h = new FalconHeal(c);
    h._tick = me.tickCount; h._refresh(); h.main();
    ok('damage with nobody near falls through to the shame-safe heal', h.healPriority === 0 && (h.healingDelay > 0 || h._next.length > 0));
  }
  // the damage bucket is always cleared
  {
    const me = mkPlayer({ health: 60, damages: [20, 30], food: 1 });
    const c = mkClient({ myPlayer: me });
    const h = new FalconHeal(c);
    h._tick = me.tickCount; h._refresh(); h.main();
    ok('the tick damage bucket is cleared behind the ladder', me.damages.length === 0);
  }
}

// ── K. enemies.near, on Falcon's own rule ─────────────────────────────────
console.log('\n== K. enemies.near ==');
{
  const range = WEAPONS.find(w => w.id === 5).range;   // polearm 142
  const close = mkPlayer({ id: 2, x: range + 50, y: 0, primary: 5 });
  const far = mkPlayer({ id: 3, x: range + 150, y: 0, primary: 5 });
  const c = mkClient({ myPlayer: mkPlayer({ x: 0, y: 0 }), enemies: [close, far] });
  const h = new FalconHeal(c);
  h._refresh();
  ok('an enemy inside reach + 100 is near', h._near.indexOf(close) !== -1);
  ok('one past it is not', h._near.indexOf(far) === -1);
  ok('the rule is distance - 100 <= their own primary range', range + 50 - 100 <= range && range + 150 - 100 > range);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
