"use strict";
// Scenario tests for the ported novastorm survival block.
//
// The engine, the Player class and the item / weapon / hat / projectile tables
// all come out of Ryn_Type_2.user.js through the harness, so these are the real
// decisions against real game numbers. The managers, the grid and the module
// handler are stand-ins built to the shapes the client uses.
//
// Each group names the novastorm branch it covers.
//
//   node tools/autoheal-test.js

const H = require("./autoheal-harness.js");
const {AutoHeal, Items, Hats, Weapons, Projectiles, WeaponVariants, Vector, PlayerObject, Resource, Player, DataHandler} = H;

let failures = 0;
let checks = 0;
const groups = [];

function group(name, fn) { groups.push([ name, fn ]); }
function check(name, actual, expected) {
  checks++;
  const ok = typeof expected === "function" ? expected(actual) : Object.is(actual, expected);
  if (!ok) {
    failures++;
    console.log(`  FAIL  ${name}\n        got ${JSON.stringify(actual)}, wanted ${expected}`);
  } else {
    console.log(`  ok    ${name}  (${JSON.stringify(actual)})`);
  }
}
const near = (want, tol = .01) => got => Math.abs(got - want) <= tol;
const atLeast = want => got => got >= want;

// The Auto Heal settings at the values the userscript ships, captured before
// anything has touched them. `settings()` puts them back and applies whatever a
// scenario wants changed, so no test inherits another's switches.
const SHIPPED = Object.assign({}, H.Settings);
function settings(over) {
  Object.assign(H.Settings, SHIPPED, over || {});
}

// novastorm's getPlayerInfo(player, "primaryDmg"): weapon damage x 1.5 x variant,
// with the 1.5 applied whether or not the enemy is wearing the bull hat.
const primaryDmg = (weaponID, variant = 0) =>
  Weapons[weaponID].damage * Hats[7].dmgMultO * WeaponVariants[variant].val;
// What a swing really does to us, which is what distributionDamages matches
// against: weapon x variant x their hat x their tail x our hat. Not the same as
// primaryDmg above, which carries the worst-case 1.5 whatever they are wearing.
const swingDmg = (weaponID, theirHat = 0, myHat = 0, variant = 0) => {
  let d = Weapons[weaponID].damage * WeaponVariants[variant].val;
  if ("dmgMultO" in Hats[theirHat]) d *= Hats[theirHat].dmgMultO;
  if ("dmgMult" in Hats[myHat]) d *= Hats[myHat].dmgMult;
  return d;
};

// ── stand-ins ────────────────────────────────────────────────────────────
class Grid {
  constructor() { this.objects = []; }
  add(o) { this.objects.push(o); return o; }
  query(x, y, search, cb) {
    const reach = (search + 1) * 100 + 200;
    for (const o of this.objects) {
      const p = o.pos.current;
      if (Math.abs(p.x - x) <= reach && Math.abs(p.y - y) <= reach) {
        if (cb(o.id)) return true;
      }
    }
    return false;
  }
}
class FakeObjectManager {
  constructor() { this.grid = new Grid(); this.map = new Map; this.grid2D = this.grid; this.placeable = true; }
  get objects() { return this.map; }
  add(o) { this.map.set(o.id, o); this.grid.add(o); return o; }
  canPlaceItem() { return this.placeable; }
}
class FakeModuleHandler {
  constructor() {
    this.staticModules = { reloading: { ready: true, isReloaded() { return this.ready; } } };
    this.forceHat = null;
    this.useHat = null;
    this.soldierAnti = false;
    this.healedOnce = false;
    this.owned = new Set([ 0, 6, 7, 40, 53, 23, 20, 12 ]);
    // Accessories owned, for the regen-gear branch.
    this.ownedAcc = new Set([]);
    this.heals = 0;
    this.packets = 0;
    this.packetLimit = 119;
    this.useAcc = null;
    this.currentHolding = 0;
    this.weapon = 0;
    this.forceWeapon = null;
    this.attacking = 0;
    this.selected = [];
    this.client = null;
  }
  get packetCount() { return this.packets; }
  canBuy(type, id) { return type === 0 ? this.owned.has(id) : this.ownedAcc.has(id); }
  setForceHat(hat) { if (this.forceHat !== null && hat !== null) return; this.forceHat = hat; }
  // The client's own rule: the predicted slot if it exists, else primary, else
  // secondary. Only the identity matters here, not the packet.
  _getPredictWeapon() {
    if (this.forceWeapon !== null) return this.forceWeapon;
    const p = this.client.myPlayer;
    return p.getItemByType(0) !== null ? 0 : 1;
  }
  whichWeapon(type) {
    if (this.client.myPlayer.getItemByType(type) === null) return;
    this.currentHolding = type;
    this.weapon = type;
    this.packets += 1;
    this.selected.push(type);
  }
  heal() {
    this.heals += 1;
    this.packets += 4;   // novastorm's place(): z, F1, F0, z
    const p = this.client.myPlayer;
    const food = Items[p.getItemByType(2)];
    p.currentHealth = Math.min(p.maxHealth, p.currentHealth + food.restore);
    p.resources.food = Math.max(0, p.resources.food - food.cost.food);
    // place() comes back to a weapon slot after every apple, and the chain can
    // leave a different one in hand than it started with.
    this.currentHolding = 1;
    this.weapon = 1;
  }
  plannedHat() {
    if (this.soldierAnti && this.canBuy(0, 6)) return 6;
    if (this.forceHat !== null) return this.forceHat;
    if (this.useHat !== null) return this.useHat;
    return this.client.myPlayer.hatID;
  }
}
let uid = 1;
function makePlayer(client, opts = {}) {
  const p = new Player(client);
  p.id = opts.id !== undefined ? opts.id : uid++;
  p.init();
  p.tickCount = 10;
  p.pos.previous._setXY(opts.x || 0, opts.y || 0);
  p.pos.current._setXY(opts.x || 0, opts.y || 0);
  p.pos.future._setXY(opts.x || 0, opts.y || 0);
  p.weapon.primary = opts.primary !== undefined ? opts.primary : 5;
  p.weapon.secondary = opts.secondary !== undefined ? opts.secondary : 10;
  p.weapon.current = opts.current !== undefined ? opts.current : p.weapon.primary;
  p.hatID = opts.hat || 0;
  p.accessoryID = opts.acc || 0;
  p.globalInventory[4] = opts.spike !== undefined ? opts.spike : 9;
  p.variant.primary = opts.variant || 0;
  p.variant.secondary = opts.variant || 0;
  p.variant.current = opts.variant || 0;
  for (let i = 0; i < 3; i++) { p.reload[i].current = 99; p.reload[i].max = 99; }
  return p;
}
function makeWorld(opts = {}) {
  const client = {};
  const om = new FakeObjectManager();
  const mh = new FakeModuleHandler();
  mh.client = client;
  const myPlayer = makePlayer(client, {id: 1, x: opts.x || 5000, y: opts.y || 5000, primary: opts.primary, secondary: opts.secondary, hat: opts.hat});
  myPlayer.inGame = true;
  myPlayer.maxHealth = 100;
  myPlayer.currentHealth = opts.health !== undefined ? opts.health : 100;
  myPlayer.previousHealth = myPlayer.currentHealth;
  myPlayer.isSandbox = false;
  myPlayer.resources = {food: 500, wood: 500, stone: 500, gold: 500};
  myPlayer.inventory = {0: myPlayer.weapon.primary, 1: myPlayer.weapon.secondary, 2: 0, 3: 3, 4: 6, 5: 10};
  myPlayer.getItemByType = t => myPlayer.inventory[t] === undefined ? null : myPlayer.inventory[t];
  myPlayer.hasResourcesForType = t => {
    const c = Items[myPlayer.inventory[t]].cost;
    return myPlayer.resources.food >= c.food && myPlayer.resources.wood >= c.wood && myPlayer.resources.stone >= c.stone;
  };
  myPlayer.canPlace = t => myPlayer.getItemByType(t) !== null && myPlayer.hasResourcesForType(t);
  myPlayer.isEnemyByID = id => id !== myPlayer.id;
  const pm = {enemies: []};
  const projm = {dangerProjectiles: new Set};
  Object.assign(client, {
    myPlayer: myPlayer,
    PlayerManager: pm,
    ProjectileManager: projm,
    ObjectManager: om,
    _ModuleHandler: mh,
    isOwner: true
  });
  const heal = new AutoHeal(client);
  mh.staticModules.autoHeal = heal;
  // The engine's own lastPos starts at the origin, so the first tick always
  // reads as "moved". Parked on the player so a scenario that means to stand
  // still stands still.
  heal.lastPosX = myPlayer.pos.current.x;
  heal.lastPosY = myPlayer.pos.current.y;
  return {client, myPlayer, pm, projm, om, mh, heal};
}
function spike(om, x, y, type = 6, owner = 99) {
  return om.add(new PlayerObject(uid++, x, y, 0, Items[type].scale, type, owner));
}
function cactus(om, x, y) {
  return om.add(new Resource(uid++, x, y, 0, 80, 1));
}
function addEnemy(w, opts) {
  const e = makePlayer(w.client, opts);
  w.pm.enemies.push(e);
  return e;
}
function tick(w) {
  w.myPlayer.tickCount += 1;
  w.mh.heals = 0;
  w.mh.packets = 0;
  w.mh.healedOnce = false;
  w.mh.forceHat = null;
  w.mh.soldierAnti = false;
  w.mh.useAcc = null;
  w.mh.currentHolding = 0;
  w.mh.weapon = 0;
  w.mh.selected.length = 0;
}
// n whole ticks of the client, scan and decision included. The engine's own
// `tick` only moves inside scan(), so a bare tick() does not age `damageTick`
// and a scenario that means to be quiet has to actually run the ticks.
function idle(w, n) {
  for (let i = 0; i < n; i++) { tick(w); w.heal.postTick(); }
}
// A friendly healing pad under our feet. Item 19, healCol 15, owned by us.
function healPad(w, dx = 0, dy = 0) {
  const p = w.myPlayer.pos.current;
  return w.om.add(new PlayerObject(uid++, p.x + dx, p.y + dy, 0, Items[19].scale, 19, w.myPlayer.id));
}
function damage(w, amount) {
  const before = w.myPlayer.currentHealth;
  w.myPlayer.currentHealth = Math.max(0, before - amount);
  w.myPlayer.previousHealth = before;
  w.heal.healthUpdate(before, w.myPlayer.currentHealth);
}
// Puts the world in the state novastorm calls "trapped, standing in a spike and
// taking its damage", which is what `collidingspike` needs.
function trapOnSpike(w, spikeType = 9) {
  w.myPlayer.isTrapped = true;
  spike(w.om, w.myPlayer.pos.current.x + 40, w.myPlayer.pos.current.y, spikeType);
  damage(w, Items[spikeType].damage);
}

// ══ PREDICT HIT ══════════════════════════════════════════════════════════
// if (primaryReload[enemy] == 1 && inPrimaryRange) { four gates }
group("predict hit", () => {
  {
    // The gate novastorm actually has, and the one RYN did not: a healthy player
    // with an enemy in reach who is not colliding and not about to is not in
    // danger, and nothing goes in the pot.
    const s = makeWorld({health: 100});
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    tick(s); s.heal.scan();
    check("enemy in reach, healthy, no collision -> nothing", s.heal.totalDmgPot, 0);
  }
  {
    // else if (myPlayer.health <= primaryDmg) hitDmgPot += primaryDmg
    const s = makeWorld({health: 60});
    s.om.placeable = false;           // isolate: no room for the spike-tick anti
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    tick(s); s.heal.scan();
    check("health at or under one swing -> that swing is counted", s.heal.hitDmgPot, near(primaryDmg(5)));
  }
  {
    const s = makeWorld({health: 60});
    s.om.placeable = false;
    const e = addEnemy(s, {x: 5100, y: 5000, primary: 5});
    e.reload[0].current = 0;
    tick(s); s.heal.scan();
    check("...not while their primary is cycling", s.heal.hitDmgPot, 0);
  }
  {
    const s = makeWorld({health: 60});
    s.om.placeable = false;
    addEnemy(s, {x: 5400, y: 5000, primary: 5});
    tick(s); s.heal.scan();
    check("...not from outside their reach", s.heal.hitDmgPot, 0);
  }
  {
    // if (collidingspike) { if (!lastcolliding) hitDmgPot += primaryDmg }
    const s = makeWorld({health: 100});
    s.om.placeable = false;
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    trapOnSpike(s);
    s.heal.scan();
    check("first tick of a spike tick -> the swing is counted", s.heal.hitDmgPot, near(primaryDmg(5)));
  }
  {
    // else if (enemy.lastPrimaryReload < 1) — they were cycling last tick and
    // are ready now, so the swing is new.
    const s = makeWorld({health: 100});
    s.om.placeable = false;
    const e = addEnemy(s, {x: 5100, y: 5000, primary: 5});
    e.reload[0].current = 0;
    trapOnSpike(s);
    s.heal.scan();                       // tick 1: lastcolliding false
    e.reload[0].current = 99;            // ready now, was not last tick
    tick(s); damage(s, Items[9].damage);
    s.heal.scan();
    check("second tick, enemy just came off cooldown -> counted", s.heal.hitDmgPot, near(primaryDmg(5)));
  }
  {
    // else if (secondaryReload[me] == 1 && !lastPredicted) — the one-shot.
    const s = makeWorld({health: 100});
    s.om.placeable = false;
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    trapOnSpike(s);
    s.myPlayer.currentHealth = 100;
    s.heal.scan();
    tick(s); damage(s, Items[9].damage); s.myPlayer.currentHealth = 100;
    s.heal.scan();
    check("third read fires once", s.heal.hitDmgPot, near(primaryDmg(5)));
    check("...and sets lastPredicted", s.heal.lastPredicted, true);
    tick(s); damage(s, Items[9].damage); s.myPlayer.currentHealth = 100;
    s.heal.scan();
    check("...and does not fire again on the next tick", s.heal.hitDmgPot, 0);
  }
});

// ══ PREDICT TURRET HIT ═══════════════════════════════════════════════════
// if (getDistance(enemy, me) <= 350 && turretReload[enemy] == 1) { three gates }
group("predict turret", () => {
  {
    const s = makeWorld({health: 20});
    addEnemy(s, {x: 5300, y: 5000, primary: 5});
    tick(s); s.heal.scan();
    check("at 20 health a turret inside 350 finishes us", s.heal.turretDmgPot, near(25));
  }
  {
    const s = makeWorld({health: 20});
    addEnemy(s, {x: 5600, y: 5000, primary: 5});
    tick(s); s.heal.scan();
    check("...not from past 350", s.heal.turretDmgPot, 0);
  }
  {
    const s = makeWorld({health: 20});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5});
    e.reload[2].current = 0;
    tick(s); s.heal.scan();
    check("...not while the turret is cycling", s.heal.turretDmgPot, 0);
  }
  {
    // if (collidingspike && lastPrimaryReload == 1 && primaryReload < 1) — they
    // just swung, so the turret is what is left.
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5});
    trapOnSpike(s);
    s.heal.scan();                 // records lastPrimaryReady = true
    e.reload[0].current = 0;       // swung
    tick(s); damage(s, Items[9].damage);
    s.heal.scan();
    check("colliding and they just swung -> turret counted", s.heal.turretDmgPot, near(25));
  }
});

// ══ VELOCITY TICK ANTI ═══════════════════════════════════════════════════
group("velocity tick anti", () => {
  const build = (gap, hat, turretCycling) => {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5000 + gap, y: 5000, primary: 5, hat: hat});
    e.pos.future._setXY(5000 + gap, 5000);
    if (turretCycling) e.reload[2].current = 0;
    tick(s); s.heal.scan();
    return s;
  };
  check("turret gear closing at 250 with a cycling turret", build(250, 53, true).heal.totalDmgPot, near(25 + primaryDmg(5)));
  check("...not at 400, past the band", build(400, 53, true).heal.totalDmgPot, 0);
  check("...not at 100, inside the band's floor", build(100, 53, true).heal.totalDmgPot, 0);
  check("...not without the turret gear", build(250, 0, true).heal.totalDmgPot, 0);
  check("...not with the turret already loaded", build(250, 53, false).heal.totalDmgPot, 0);
});

// ══ KNOCKBACK ANTI ═══════════════════════════════════════════════════════
group("knockback anti", () => {
  {
    // A bat throws us 111.1 units; the spike is 90 away on the far side.
    const s = makeWorld({health: 100});
    addEnemy(s, {x: 4900, y: 5000, primary: 6, secondary: null});
    spike(s.om, 5090, 5000, 7);
    tick(s); s.heal.scan();
    // Both sweeps run, from the extrapolated and the interpolated position, and
    // both find the same spike. Novastorm adds each one.
    check("bat knockback onto a greater spike, both sweeps", s.heal.spikeDmgPot, near(35 * 2));
    check("...and the swing that threw us, twice with it", s.heal.hitDmgPot, near(primaryDmg(6) * 2));
    check("...and it is marked as still worth gathering through", s.heal.canStillGather, true);
  }
  {
    const s = makeWorld({health: 100});
    s.myPlayer.isTrapped = true;
    addEnemy(s, {x: 4900, y: 5000, primary: 6, secondary: null});
    spike(s.om, 5090, 5000, 7);
    tick(s); s.heal.scan();
    check("trapped -> knockback cannot move us, so nothing", s.heal.spikeDmgPot, 0);
  }
  {
    const s = makeWorld({health: 100, x: 5000, y: 12500});
    s.myPlayer.pos.current._setXY(5000, 12500);
    s.myPlayer.pos.future._setXY(5000, 12500);
    s.heal.lastPosX = 5000; s.heal.lastPosY = 12500;
    addEnemy(s, {x: 4900, y: 12500, primary: 6, secondary: null});
    cactus(s.om, 5060, 12500);
    tick(s); s.heal.scan();
    check("knockback into a cactus", s.heal.spikeDmgPot, near(35 * 2));
  }
});

// ══ THE MOVEMENT SWEEP ═══════════════════════════════════════════════════
// if (!(imTrapped && collidingspike)) if (distance > 2 || any damage) { sweep }
group("movement sweep", () => {
  {
    const s = makeWorld({health: 100});
    s.myPlayer.pos.future._setXY(5120, 5000);
    s.heal.lastPosX = 4900;           // moved 100 since last tick
    spike(s.om, 5100, 5000, 7);
    tick(s); s.heal.scan();
    check("walking into a greater spike -> 35", s.heal.spikeDmgPot, near(35));
    check("...and willcollide is set", s.heal.willcollide, true);
  }
  {
    const s = makeWorld({health: 100});
    s.myPlayer.pos.future._setXY(5120, 5000);
    spike(s.om, 5100, 5000, 7);
    tick(s); s.heal.scan();
    check("standing still and unhurt -> the sweep does not run", s.heal.spikeDmgPot, 0);
  }
  {
    const s = makeWorld({health: 100});
    s.myPlayer.pos.future._setXY(5120, 5000);
    spike(s.om, 5100, 5000, 7);
    damage(s, 20);                    // a spike value opens the gate
    s.heal.scan();
    check("standing still but hurt -> the sweep runs", s.heal.spikeDmgPot, atLeast(35));
  }
  {
    const s = makeWorld({health: 100});
    s.myPlayer.pos.future._setXY(5120, 5000);
    s.heal.lastPosX = 4900;
    spike(s.om, 5100, 5400, 7);
    tick(s); s.heal.scan();
    check("a spike nowhere near the line -> nothing", s.heal.spikeDmgPot, 0);
  }
  {
    const s = makeWorld({health: 100});
    s.myPlayer.pos.future._setXY(5120, 5000);
    s.heal.lastPosX = 4900;
    spike(s.om, 5060, 5000, 6);
    spike(s.om, 5110, 5000, 7);
    tick(s); s.heal.scan();
    check("two spikes on the line are summed, as novastorm sums them", s.heal.spikeDmgPot, near(20 + 35));
  }
});

// ══ SPIKE TICK WHILE TRAPPED ═════════════════════════════════════════════
group("spike tick", () => {
  {
    const s = makeWorld({health: 100});
    trapOnSpike(s, 9);
    s.heal.scan();
    check("trapped in a spinning spike -> 45", s.heal.spikeDmgPot, near(45));
    check("...and collidingspike is set", s.heal.collidingspike, true);
    check("...and spikeDmgCount counts the run", s.heal.spikeDmgCount, 1);
  }
  {
    // The 0.75 reversal: 45 through a soldier helmet lands as 33.75 and has to
    // go into the pot as 45, because the helmet is applied again at the end.
    const s = makeWorld({health: 100, hat: 6});
    s.myPlayer.isTrapped = true;
    spike(s.om, 5040, 5000, 9);
    damage(s, 45 * Hats[6].dmgMult);
    s.heal.scan();
    check("soldier spike tick -> raw 45 in the pot", s.heal.spikeDmgPot, near(45));
    check("...and 33.75 once the helmet is applied again", s.heal.totalDmgPot, near(45 * Hats[6].dmgMult));
  }
  {
    const s = makeWorld({health: 100});
    s.myPlayer.isTrapped = true;
    spike(s.om, 5040, 5000, 6);
    damage(s, 20);
    damage(s, 20);
    s.heal.scan();
    check("two spike hits in one tick -> both counted", s.heal.spikeDmgPot, near(40));
  }
  {
    const s = makeWorld({health: 100});
    spike(s.om, 5040, 5000, 9);
    damage(s, 45);
    s.heal.scan();
    check("standing in a spike but not trapped -> not a spike tick", s.heal.collidingspike, false);
  }
});

// ══ ANTI NORMAL INSTAKILL ════════════════════════════════════════════════
group("anti normal instakill", () => {
  {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5, secondary: 15, current: 5});
    e.lastAttacked = s.myPlayer.tickCount;
    e.lastAttackWeapon = 5;
    damage(s, swingDmg(5));
    s.heal.scan();
    check("a hit landed -> it is classified", s.heal.damagesByHits.length, 1);
    check("musket + turret behind it", s.heal.turretDmgPot + s.heal.secDmgPot, near(25 + Projectiles[5].damage));
  }
  {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5, secondary: 10, current: 5});
    e.lastAttacked = s.myPlayer.tickCount;
    e.lastAttackWeapon = 5;
    damage(s, swingDmg(5));
    s.heal.scan();
    // A hammer's secondaryDmg carries the 1.5 and novastorm divides it back out.
    check("a hammer follow-up is counted without the bull", s.heal.secDmgPot, near(Weapons[10].damage));
  }
  {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5, secondary: 15, current: 5});
    e.reload[2].current = 0;
    e.lastAttacked = s.myPlayer.tickCount;
    e.lastAttackWeapon = 5;
    damage(s, swingDmg(5));
    s.heal.scan();
    check("turret cycling -> only the secondary", s.heal.turretDmgPot + s.heal.secDmgPot, near(Projectiles[5].damage));
  }
  {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5500, y: 5000, primary: 5, secondary: 15, current: 5});
    e.lastAttacked = s.myPlayer.tickCount;
    e.lastAttackWeapon = 5;
    damage(s, swingDmg(5));
    s.heal.scan();
    check("past 400 -> nothing", s.heal.turretDmgPot + s.heal.secDmgPot, 0);
  }
  {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5, secondary: 14, current: 5});
    e.lastAttacked = s.myPlayer.tickCount;
    e.lastAttackWeapon = 5;
    damage(s, swingDmg(5));
    s.heal.scan();
    check("mc grabby is not on novastorm's list", s.heal.secDmgPot, 0);
  }
});

// ══ ANTI SPIKE TICK ══════════════════════════════════════════════════════
group("anti spike tick", () => {
  {
    // 45 + a bull polearm's 67.5 is 112.5; health 60 / 0.75 is 80, under it.
    // health 80: over one swing, so the plain `health <= primaryDmg` read stays
    // quiet, and under 84.375, which is what `health / 0.75 <= 67.5 + 45` needs.
    const s = makeWorld({health: 80});
    addEnemy(s, {x: 5000, y: 5120, primary: 5});
    s.myPlayer.pos.future._setXY(5000, 5040);
    tick(s); s.heal.scan();
    check("a spike onto our velocity point with a swing behind it", s.heal.spikeDmgPot, near(45));
    check("...and the swing with it, once", s.heal.hitDmgPot, near(primaryDmg(5)));
    check("...and the helmet flag, since 100 > 67.5 + 45", s.heal.spikeTickAnti, false);
  }
  {
    const s = makeWorld({health: 95});
    addEnemy(s, {x: 5000, y: 5120, primary: 5});
    s.myPlayer.pos.future._setXY(5000, 5040);
    tick(s); s.heal.scan();
    check("healthy enough to take it -> not paid for", s.heal.spikeDmgPot, 0);
  }
  {
    const s = makeWorld({health: 60});
    addEnemy(s, {x: 5000, y: 5120, primary: 5});
    s.myPlayer.pos.future._setXY(5000, 5040);
    s.om.placeable = false;
    tick(s); s.heal.scan();
    check("nowhere to put it -> nothing", s.heal.spikeDmgPot, 0);
  }
  {
    const s = makeWorld({health: 60});
    addEnemy(s, {x: 5000, y: 5600, primary: 5});
    s.myPlayer.pos.future._setXY(5000, 5040);
    tick(s); s.heal.scan();
    check("too far to place one that reaches us -> nothing", s.heal.spikeDmgPot, 0);
  }
  {
    // else if (health <= 70 && damagesByHits.length > 0) — out of reach, hurt,
    // and something already landed this tick.
    const s = makeWorld({health: 65});
    const e = addEnemy(s, {x: 5000, y: 5120, primary: 5, current: 5});
    e.reload[0].current = 0;                 // not ready, so the first gate fails
    e.lastAttacked = s.myPlayer.tickCount;
    e.lastAttackWeapon = 5;
    s.myPlayer.pos.future._setXY(5000, 5040);
    damage(s, swingDmg(5));
    s.heal.scan();
    check("the low-health branch pays for the spike and the turret", s.heal.spikeDmgPot + s.heal.turretDmgPot, atLeast(45 + 25));
  }
});

// ══ POISON ═══════════════════════════════════════════════════════════════
// for (damage of damages) if (damage == 5) damageByPoisonTick = tick;
// if ((tick - damageByPoisonTick) % 9 == 8 || == 9) poisonDmgPot = 5;
group("poison", () => {
  {
    // Nothing has ever poisoned us, so damageByPoisonTick is still 0 and the
    // remainder walks. This is novastorm's behaviour, not a correction of it.
    const s = makeWorld({health: 100});
    const fired = [];
    for (let i = 0; i < 20; i++) { tick(s); s.heal.scan(); if (s.heal.poisonDmgPot > 0) fired.push(s.heal.tick); }
    check("before any poison it fires once every nine ticks", fired.length, atLeast(2));
    check("...nine apart", fired[1] - fired[0], 9);
  }
  {
    // A poison tick is a number distributionDamages cannot explain, so it stays
    // in `damages` and latches damageByPoisonTick to the current tick forever.
    const s = makeWorld({health: 100});
    damage(s, 5);
    s.heal.scan();
    check("the poison value latches", s.heal.sawPoison, true);
    let fired = 0;
    for (let i = 0; i < 30; i++) { tick(s); s.heal.scan(); if (s.heal.poisonDmgPot > 0) fired++; }
    check("...and the prediction stops firing, as novastorm's does", fired, 0);
  }
  {
    const s = makeWorld({health: 100, hat: 6});
    damage(s, 5 * Hats[6].dmgMult);
    s.heal.scan();
    check("3.75 through a soldier helmet latches too", s.heal.sawPoison, true);
  }
});

// ══ THE TOTAL, THE CEILING AND soldierAnti ═══════════════════════════════
group("total and soldier anti", () => {
  {
    const s = makeWorld({health: 100});
    for (let i = 0; i < 4; i++) {
      const e = addEnemy(s, {x: 5060 + i, y: 5000, primary: 5, secondary: 15, current: 5});
      e.lastAttacked = s.myPlayer.tickCount;
      e.lastAttackWeapon = 5;
    }
    damage(s, swingDmg(5));
    s.heal.scan();
    const buckets = s.heal.spikeDmgPot + s.heal.hitDmgPot + s.heal.turretDmgPot + s.heal.secDmgPot + s.heal.poisonDmgPot;
    check("the buckets are well past the ceiling", buckets, atLeast(140));
    check("...and 140 raises soldierAnti", s.heal.soldierAnti, true);
    check("...which goes to the module handler", s.mh.soldierAnti, true);
    check("...and 140 read through the helmet is 105", s.heal.totalDmgPot, near(140 * Hats[6].dmgMult));
  }
  {
    const s = makeWorld({health: 100});
    trapOnSpike(s, 9);
    s.heal.scan();
    check("45 + one swing is under 100, so no soldierAnti", s.heal.soldierAnti, false);
    check("...but being held on a spike still asks for the helmet", s.mh.forceHat, 6);
  }
  {
    const s = makeWorld({health: 100});
    s.om.placeable = false;
    s.mh.forceHat = 7;                 // an insta claimed the hat first
    trapOnSpike(s, 9);
    s.heal.scan();
    check("an insta that already claimed the hat keeps it", s.mh.forceHat, 7);
    check("...and the bull drain is added to the pot", s.heal.totalDmgPot, near(45 + 5));
  }
});

// ══ SHAME RESET ══════════════════════════════════════════════════════════
// if (shameCount > 0 && !soldierAnti && !collidingspike && poisonDmgPot == 0 && totalDmgPot == 0)
group("shame reset", () => {
  {
    const s = makeWorld({health: 90});
    s.myPlayer.shameCount = 2;
    tick(s); s.heal.scan();
    check("shame, and a completely quiet tick -> drain", s.heal.lastShouldResetShame, true);
    check("...and the bull hat goes on", s.mh.forceHat, 7);
  }
  {
    const s = makeWorld({health: 90});
    s.myPlayer.shameCount = 0;
    tick(s); s.heal.scan();
    check("no shame -> no drain", s.heal.lastShouldResetShame, false);
  }
  {
    const s = makeWorld({health: 60});
    s.myPlayer.shameCount = 2;
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    tick(s); s.heal.scan();
    check("anything at all in the pot -> no drain", s.heal.lastShouldResetShame, false);
  }
  {
    const s = makeWorld({health: 90});
    s.myPlayer.shameCount = 2;
    trapOnSpike(s, 9);
    s.heal.scan();
    check("colliding with a spike -> no drain", s.heal.lastShouldResetShame, false);
  }
  {
    const s = makeWorld({health: 90});
    s.myPlayer.shameCount = 2;
    for (let i = 0; i < 8; i++) { tick(s); s.heal.scan(); }
    // The phantom poison tick blocks it on one tick in nine, exactly as it does
    // in novastorm.
    check("the poison tick blocks it", s.heal.poisonDmgPot > 0 ? s.heal.shouldResetShame : false, false);
  }
});

// ══ THE HEAL ═════════════════════════════════════════════════════════════
// if (((healing && shameCount < 7) || (tick - damageTick) > 0) && health < 100)
//
// The fallback branch: what postTick does with _autoHeal off. Every check in
// this group is novastorm's own gate, unchanged.
group("the heal", () => {
  settings({_autoHeal: false});
  {
    const s = makeWorld({health: 55});
    tick(s); s.heal.postTick();
    check("hurt and quiet -> tops up to full", s.mh.heals, Math.ceil(45 / Items[0].restore));
    check("...at four packets an apple, as place() sends", s.mh.packets, 3 * 4);
  }
  {
    const s = makeWorld({health: 55});
    damage(s, 45);
    s.heal.postTick();
    check("the tick the damage landed -> no free heal", s.mh.heals, 0);
  }
  {
    const s = makeWorld({health: 55});
    damage(s, 45);
    s.heal.postTick();
    tick(s); s.heal.postTick();
    check("the next tick -> heals", s.mh.heals, atLeast(1));
  }
  {
    const s = makeWorld({health: 100});
    tick(s); s.heal.postTick();
    check("full health -> never eats", s.mh.heals, 0);
  }
  {
    // The emergency branch: predicted damage at or over health, on the very tick
    // the damage landed, which the free branch refuses.
    const s = makeWorld({health: 100});
    addEnemy(s, {x: 5060, y: 5000, primary: 5});
    trapOnSpike(s, 9);
    s.myPlayer.currentHealth = 40;
    s.heal.postTick();
    check("lethal prediction on a damage tick -> eats anyway", s.mh.heals, atLeast(1));
  }
  {
    const s = makeWorld({health: 100});
    s.myPlayer.shameCount = 7;
    addEnemy(s, {x: 5060, y: 5000, primary: 5});
    trapOnSpike(s, 9);
    s.myPlayer.currentHealth = 40;
    s.heal.postTick();
    check("shame 7 refuses the emergency heal", s.mh.heals, 0);
  }
  {
    const s = makeWorld({health: 100});
    s.myPlayer.shameCount = 6;
    addEnemy(s, {x: 5060, y: 5000, primary: 5});
    trapOnSpike(s, 9);
    s.myPlayer.currentHealth = 40;
    s.heal.postTick();
    check("shame 6 takes it", s.mh.heals, atLeast(1));
  }
  {
    const s = makeWorld({health: 10});
    s.myPlayer.inventory[2] = 1;       // cookie, 40
    tick(s); s.heal.postTick();
    check("the chain is sized from the food carried", s.mh.heals, Math.ceil(90 / 40));
  }
  {
    const s = makeWorld({health: 10});
    s.myPlayer.resources.food = 25;
    tick(s); s.heal.postTick();
    check("food on hand caps the chain", s.mh.heals, 2);
  }
  {
    const s = makeWorld({health: 10});
    s.myPlayer.resources.food = 0;
    tick(s); s.heal.postTick();
    check("no food -> no heal", s.mh.heals, 0);
  }
  {
    // novastorm has no packet budget on the heal at all.
    const s = makeWorld({health: 10});
    tick(s); s.heal.postTick();
    check("nothing in the client refuses the chain for its size", s.mh.heals, Math.ceil(90 / 20));
  }
});

// ══ THE RYN TYPE 2 DECISION ══════════════════════════════════════════════
//
//     const reactive   = (tick - damageTick) <= 2;
//     const predictive = myPlayer.health <= totalDmgPot;
//     const critical   = myPlayer.health <= 25;
//     const shouldHeal = reactive || predictive || critical ||
//                        (threshold > 0 && myPlayer.health <= threshold);
//
// Every scenario below runs through postTick with _autoHeal on, so the world,
// the scan and the decision are all the client's own.
group("ryn2 — the four reasons", () => {
  {
    settings({});
    const s = makeWorld({health: 100});
    tick(s); s.heal.postTick();
    check("full health -> nothing, whatever the reason", s.mh.heals, 0);
    check("...and it says why", s.heal.blockedReason, "full");
  }
  {
    // Hurt, quiet, nothing predicted, threshold off. novastorm's fallback heals
    // here on `(tick - damageTick) > 0`; the Ryn 2 reactive window is the other
    // side of that line and has closed, so nothing is a reason.
    settings({});
    const s = makeWorld({health: 70});
    idle(s, 4);                      // `damageTick` is 0 and the window is 2 ticks
    s.myPlayer.currentHealth = 70;
    tick(s); s.heal.postTick();
    check("quiet, healthy, nothing predicted -> no reason to eat", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "noReason");
  }
  {
    // reactive: damage landed on this tick. This is the branch novastorm's gate
    // refuses outright — `(tick - damageTick) > 0` is false — and the one the
    // shame guard exists to bound.
    settings({});
    const s = makeWorld({health: 100});
    tick(s);
    damage(s, 30);
    s.heal.postTick();
    check("damage on this very tick -> reactive eats", s.mh.heals, atLeast(1));
  }
  {
    settings({});
    const s = makeWorld({health: 20});
    tick(s); s.heal.postTick();
    check("health at or under 25 -> critical eats", s.mh.heals, atLeast(1));
  }
  {
    settings({_autoHealThreshold: 80});
    const s = makeWorld({health: 75});
    idle(s, 4);
    s.myPlayer.currentHealth = 75;
    tick(s); s.heal.postTick();
    check("threshold 80 at 75 health -> eats with nothing else true", s.mh.heals, atLeast(1));
  }
  {
    settings({_autoHealThreshold: 50});
    const s = makeWorld({health: 75});
    idle(s, 4);
    s.myPlayer.currentHealth = 75;
    tick(s); s.heal.postTick();
    check("threshold under the bar -> still no reason", s.heal.blockedReason, "noReason");
  }
});

group("ryn2 — predictive and the weight", () => {
  {
    // predictive: the pot is larger than what is left. An enemy in reach with a
    // ready primary against a bar under one swing is novastorm's own one-shot
    // gate, and it puts ~76 in the pot against 60 health.
    settings({});
    const s = makeWorld({health: 60});
    s.om.placeable = false;
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    tick(s); s.heal.postTick();
    check("pot over health -> predictive eats", s.mh.heals, atLeast(1));
    check("...and the pot is what drove it", s.heal.getTotalDmgPot(), atLeast(60));
  }
  {
    // Weight 0 removes the forecast entirely, so the same world has nothing
    // left but the reactive window, which has closed.
    settings({_autoHealPredictWeight: 0});
    const s = makeWorld({health: 60});
    s.om.placeable = false;
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    idle(s, 4);
    s.myPlayer.currentHealth = 60;
    tick(s); s.heal.postTick();
    check("weight 0 -> the forecast is not a reason", s.heal.blockedReason, "noReason");
  }
  {
    // getHealAmountNeeded is the gap plus the weighted pot, which is what makes
    // the chain adaptive rather than a top-up.
    settings({});
    const s = makeWorld({health: 60});
    s.om.placeable = false;
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    tick(s); s.heal.scan();
    const pot = s.heal.getTotalDmgPot();
    check("need = gap + weighted pot", s.heal.getHealAmountNeeded(), near(Math.min(100, 40 + pot)));
  }
  {
    settings({_autoHealPredictWeight: .5});
    const s = makeWorld({health: 60});
    s.om.placeable = false;
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    tick(s); s.heal.scan();
    check("half weight halves the forecast half", s.heal.getHealAmountNeeded(), near(Math.min(100, 40 + s.heal.getTotalDmgPot() * .5)));
  }
});

group("ryn2 — shame", () => {
  {
    settings({});
    const s = makeWorld({health: 60});
    s.myPlayer.shameCount = 7;
    tick(s); damage(s, 10); s.heal.postTick();
    check("shame 7 stops the heal", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "shame");
  }
  {
    settings({});
    const s = makeWorld({health: 60});
    s.myPlayer.shameCount = 6;
    tick(s); damage(s, 10); s.heal.postTick();
    check("shame 6 takes it", s.mh.heals, atLeast(1));
  }
  {
    settings({_autoHealShameRespect: false});
    const s = makeWorld({health: 60});
    s.myPlayer.shameCount = 7;
    tick(s); damage(s, 10); s.heal.postTick();
    check("respect off -> eats through the count", s.mh.heals, atLeast(1));
  }
  {
    settings({_autoHealMode: "aggro"});
    const s = makeWorld({health: 60});
    s.myPlayer.shameCount = 7;
    tick(s); damage(s, 10); s.heal.postTick();
    check("aggro spends the point", s.mh.heals, atLeast(1));
  }
  {
    // shameAbuse is the server's latch: set the first time an apple lands
    // inside the 120 ms window, never cleared. Only safe reads it.
    settings({_autoHealMode: "safe"});
    const s = makeWorld({health: 60});
    s.myPlayer.shameAbuse = true;
    tick(s); damage(s, 10); s.heal.postTick();
    check("safe refuses after an early apple", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "shame");
  }
  {
    settings({});
    const s = makeWorld({health: 60});
    s.myPlayer.shameAbuse = true;
    tick(s); damage(s, 10); s.heal.postTick();
    check("ryn2 does not read the latch", s.mh.heals, atLeast(1));
  }
  {
    // The 30s lockout. A kill switch above every setting, including respect
    // off — every apple sent into it is refused by the server and still costs
    // four packets.
    settings({_autoHealShameRespect: false, _autoHealMode: "aggro"});
    const s = makeWorld({health: 30});
    s.myPlayer.shameActive = true;
    tick(s); damage(s, 10); s.heal.postTick();
    check("the lockout stops everything", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "shameLockout");
  }
  {
    // The real latch, set by the client's own updateHealth on a heal that
    // landed inside the window.
    settings({});
    const s = makeWorld({health: 60});
    s.myPlayer.currentHealth = 60;
    s.myPlayer.updateHealth(50);
    s.myPlayer.updateHealth(70);   // back up, inside 120ms
    check("an early apple sets the server's latch", s.myPlayer.shameAbuse, true);
    check("...and the count with it", s.myPlayer.shameCount, 1);
  }
});

group("ryn2 — safe-first and the antis", () => {
  {
    // soldierAnti alone: a hundred damage is inbound. ryn2 still eats — the
    // apple is 20 health against damage that has not landed yet.
    settings({});
    const s = makeWorld({health: 60});
    tick(s); s.heal.scan();
    s.heal.soldierAnti = true;
    s.heal.autoHealRyn2();
    check("soldierAnti alone -> ryn2 still eats", s.mh.heals, atLeast(1));
  }
  {
    settings({_autoHealMode: "safe"});
    const s = makeWorld({health: 60});
    tick(s); s.heal.scan();
    s.heal.soldierAnti = true;
    s.heal.autoHealRyn2();
    check("safe waits out a hundred-damage read", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "soldierAnti");
  }
  {
    settings({_autoHealMode: "safe"});
    const s = makeWorld({health: 20});
    tick(s); s.heal.scan();
    s.heal.soldierAnti = true;
    s.heal.autoHealRyn2();
    check("...unless the bar is critical", s.mh.heals, atLeast(1));
  }
  {
    // spikeTickAnti without the helmet: a spike is about to be placed into the
    // tick we would spend chewing.
    settings({});
    const s = makeWorld({health: 60});
    tick(s); s.heal.scan();
    s.heal.lastSpikeTickAnti = true;
    s.heal.autoHealRyn2();
    check("spikeTickAnti without soldier -> wait", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "spikeTickAnti");
  }
  {
    // Both at once is the kill switch, and it is above the safe-first guards.
    settings({});
    const s = makeWorld({health: 60});
    tick(s); s.heal.scan();
    s.heal.lastSpikeTickAnti = true;
    s.heal.soldierAnti = true;
    s.heal.autoHealRyn2();
    check("both antis -> the kill switch", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "antiStack");
  }
  {
    // Held on a spike, above 25, no helmet: the spike's damage plus a primary
    // arrive together on the tick the apple was worth 20.
    settings({});
    const s = makeWorld({health: 60});
    tick(s);
    trapOnSpike(s, 6);               // 20, so the bar stays above 25
    s.heal.postTick();
    check("state: collidingspike is read from the world", s.heal.collidingspike, true);
    check("held on a spike, not critical -> wait", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "collidingSpike");
  }
  {
    settings({});
    const s = makeWorld({health: 30});
    tick(s);
    trapOnSpike(s, 6);            // 20 off a 30 bar -> critical
    s.heal.postTick();
    check("...critical eats anyway", s.mh.heals, atLeast(1));
  }
  {
    settings({_autoHealMode: "aggro"});
    const s = makeWorld({health: 60});
    tick(s);
    trapOnSpike(s, 6);
    s.heal.postTick();
    check("aggro still waits above 25", s.mh.heals, 0);
  }
  {
    settings({});
    const s = makeWorld({health: 60});
    tick(s);
    trapOnSpike(s, 6);
    s.heal.scan();
    s.heal.soldierAnti = true;    // helmet on: the spike is 0.75 of itself
    s.heal.autoHealRyn2();
    check("with the helmet on, the spike is eaten through", s.mh.heals, atLeast(1));
  }
});

group("ryn2 — the world's states", () => {
  {
    // trapped: isTrapped alone is not a spike, so nothing blocks the heal.
    settings({});
    const s = makeWorld({health: 60});
    s.myPlayer.isTrapped = true;
    tick(s); damage(s, 10); s.heal.postTick();
    check("trapped but not in a spike -> heals", s.mh.heals, atLeast(1));
    check("...and the state is read", s.heal.imTrapped, true);
  }
  {
    // poison: before any poison has landed the prediction fires once every
    // nine ticks, and those 5 are a real part of the pot.
    settings({});
    const s = makeWorld({health: 60});
    let sawPoisonPot = false;
    for (let i = 0; i < 12; i++) { tick(s); s.heal.scan(); if (s.heal.poisonDmgPot === 5) sawPoisonPot = true; }
    check("state: the poison tick reaches the pot", sawPoisonPot, true);
  }
  {
    // turret: an enemy wearing turret gear inside 350 with a bar under one
    // shot. novastorm's third turret gate.
    settings({});
    const s = makeWorld({health: 20});
    s.om.placeable = false;
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5});
    e.hatID = 53;
    for (let i = 0; i < 3; i++) { e.reload[2].current = 0; tick(s); s.heal.scan(); }
    e.reload[2].current = 99;
    tick(s); s.heal.scan();
    check("state: the turret shot is in the pot", s.heal.turretDmgPot, atLeast(1));
  }
  {
    // knockback: a swing that would shove us into a spike. The sweep puts both
    // the spike and the swing in the pot, and the heal follows the pot.
    settings({});
    const s = makeWorld({health: 60});
    s.om.placeable = false;
    addEnemy(s, {x: 5100, y: 5000, primary: 5});
    spike(s.om, 4930, 5000, 6);
    tick(s); s.heal.scan();
    check("state: the knockback sweep reaches the pot", s.heal.spikeDmgPot, atLeast(Items[6].damage));
    s.heal.autoHealRyn2();
    check("...and it is a reason to eat", s.mh.heals, atLeast(1));
  }
  {
    // A move into a spike we are already walking at.
    settings({});
    const s = makeWorld({health: 60});
    s.om.placeable = false;
    spike(s.om, 5090, 5000, 6);
    s.myPlayer.pos.future._setXY(5080, 5000);
    s.heal.lastPosX = 4900;               // moved: the sweep is armed
    tick(s); s.heal.scan();
    check("state: willcollide", s.heal.willcollide, true);
  }
});

group("ryn2 — the chain", () => {
  {
    // maxFoodPerTick is the throttle, and it is the smaller of the two.
    settings({_autoHealMaxFoodPerTick: 2});
    const s = makeWorld({health: 10});
    tick(s); s.heal.postTick();
    check("the per-tick cap holds", s.mh.heals, 2);
    check("...and it knew it wanted more", s.heal.wantedFood, 2);
  }
  {
    settings({_autoHealMaxFoodPerTick: 10});
    const s = makeWorld({health: 10});
    tick(s); s.heal.postTick();
    // 90 missing, nothing predicted, apples at 20 -> ceil(90/20) = 5
    check("under the cap it asks for what it needs", s.mh.heals, 5);
  }
  {
    settings({_autoHealMaxFoodPerTick: 10});
    const s = makeWorld({health: 10});
    s.myPlayer.resources.food = 25;      // apples cost 10: two, and change
    tick(s); s.heal.postTick();
    check("food on hand caps the chain", s.mh.heals, 2);
  }
  {
    settings({_autoHealMaxFoodPerTick: 10});
    const s = makeWorld({health: 10});
    s.myPlayer.resources.food = 0;
    tick(s); s.heal.postTick();
    check("no food, no heal", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "noFood");
  }
  {
    // The budget is the client's own: 119 a second, and the chain keeps a
    // margin so it never spends the tick's whole allowance.
    settings({_autoHealMaxFoodPerTick: 10});
    const s = makeWorld({health: 10});
    tick(s);
    s.mh.packets = 115;
    s.heal.postTick();
    check("no packet room -> nothing is sent", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "packets");
  }
  {
    settings({_autoHealMaxFoodPerTick: 10});
    const s = makeWorld({health: 10});
    tick(s);
    s.mh.packets = 103;                  // 119 - 8 - 103 = 8 -> two apples
    s.heal.postTick();
    check("a thin budget is a shorter chain", s.mh.heals, 2);
  }
  {
    // Cheese: 30 on the bite plus 50 over five seconds. Calm, the whole 80
    // counts, so one closes a 70 gap.
    settings({_autoHealMaxFoodPerTick: 10, _autoHealThreshold: 50});
    const s = makeWorld({health: 30});
    s.myPlayer.inventory[2] = 2;
    idle(s, 4);
    s.myPlayer.currentHealth = 30;
    tick(s); s.heal.postTick();
    check("calm: cheese is counted at 30 + 50", s.heal.wantedFood, 1);
  }
  {
    // The same gap with damage on the tick: the trailing 50 arrives over five
    // seconds and the next hit is in 111 ms, so only the 30 counts.
    settings({_autoHealMaxFoodPerTick: 10});
    const s = makeWorld({health: 40});
    s.myPlayer.inventory[2] = 2;
    tick(s); damage(s, 10); s.heal.postTick();
    check("urgent: only the bite counts", s.heal.wantedFood, atLeast(3));
  }
  {
    // One heal per tick, whoever took it.
    settings({});
    const s = makeWorld({health: 60});
    tick(s); damage(s, 10);
    s.mh.healedOnce = true;
    s.heal.postTick();
    check("something already healed this tick", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "healedOnce");
  }
  {
    // The slot the client was coming back to, restored once after the chain.
    settings({_autoHealMaxFoodPerTick: 3});
    const s = makeWorld({health: 30});
    tick(s); s.heal.postTick();
    check("predictWeapon is snapshotted", s.heal.savedPredictWeapon, 0);
    check("...and the hand is put back", s.mh.currentHolding, 0);
    check("...with one packet, not one per apple", s.mh.selected.length, 1);
  }
});

group("ryn2 — healing pads", () => {
  {
    // 15 a second, free. A small quiet gap is left to it.
    settings({});
    const s = makeWorld({health: 90});
    healPad(s);
    idle(s, 4);
    s.myPlayer.currentHealth = 90;
    settings({_autoHealThreshold: 95});
    tick(s); s.heal.postTick();
    check("a small gap on a pad -> the pad takes it", s.mh.heals, 0);
    check("...named", s.heal.blockedReason, "healPad");
    check("...and the pad was seen", s.heal.onHealPad, true);
  }
  {
    settings({_autoHealThreshold: 95});
    const s = makeWorld({health: 70});
    healPad(s);
    idle(s, 4);
    s.myPlayer.currentHealth = 70;
    tick(s); s.heal.postTick();
    check("a gap the pad cannot close in a second -> eat anyway", s.mh.heals, atLeast(1));
  }
  {
    settings({});
    const s = makeWorld({health: 20});
    healPad(s);
    tick(s); s.heal.postTick();
    check("critical never waits for a pad", s.mh.heals, atLeast(1));
  }
  {
    settings({_autoHealUseHealPads: false, _autoHealThreshold: 95});
    const s = makeWorld({health: 90});
    healPad(s);
    idle(s, 4);
    s.myPlayer.currentHealth = 90;
    tick(s); s.heal.postTick();
    check("the switch off -> the pad is not looked for", s.mh.heals, atLeast(1));
  }
  {
    settings({});
    const s = makeWorld({health: 90});
    const pad = healPad(s);
    pad.ownerID = 99;                    // an enemy's
    tick(s); s.heal.scan();
    check("an enemy's pad is not ours to stand on", s.heal.tryUseHealPad(), false);
  }
  {
    settings({});
    const s = makeWorld({health: 90});
    healPad(s, 300, 0);                  // out from under us
    tick(s); s.heal.scan();
    check("a pad we are not standing on does not count", s.heal.tryUseHealPad(), false);
  }
});

group("ryn2 — regen gear", () => {
  {
    // Medic Gear first: +3 a second, and the hat slot is free here.
    settings({});
    const s = makeWorld({health: 50});
    s.mh.owned.add(13);
    tick(s); s.heal.postTick();
    check("a gap over 40 asks for Medic Gear", s.mh.forceHat, 13);
  }
  {
    settings({});
    const s = makeWorld({health: 70});
    s.mh.owned.add(13);
    tick(s); s.heal.postTick();
    check("a gap of 30 does not", s.mh.forceHat, null);
  }
  {
    settings({_autoHealUseRegenGear: false});
    const s = makeWorld({health: 50});
    s.mh.owned.add(13);
    tick(s); s.heal.postTick();
    check("the switch off -> no gear", s.mh.forceHat, null);
  }
  {
    // Not while damage is inbound: none of the three reduces what lands.
    settings({});
    const s = makeWorld({health: 50});
    s.mh.owned.add(13);
    tick(s); s.heal.scan();
    s.heal.soldierAnti = true;
    s.mh.forceHat = null;
    s.heal.optimizeRegenGear();
    check("a hundred-damage read keeps the slot", s.mh.forceHat, null);
  }
  {
    settings({});
    const s = makeWorld({health: 50});
    s.mh.owned.add(13);
    tick(s);
    trapOnSpike(s, 6);
    s.heal.scan();
    s.mh.forceHat = null;
    s.heal.optimizeRegenGear();
    check("held on a spike keeps the slot", s.mh.forceHat, null);
  }
  {
    // A hat someone else already claimed is not taken from them.
    settings({});
    const s = makeWorld({health: 50});
    s.mh.owned.add(13);
    tick(s); s.heal.scan();
    s.mh.forceHat = 53;
    s.heal.optimizeRegenGear();
    check("an insta's turret gear keeps the slot", s.mh.forceHat, 53);
  }
  {
    // No Medic: Angel Wings, +3 in the accessory slot.
    settings({});
    const s = makeWorld({health: 50});
    s.mh.ownedAcc.add(13);
    tick(s); s.heal.postTick();
    check("no Medic -> Angel Wings", s.mh.useAcc, 13);
    check("...and the hat slot is untouched", s.mh.forceHat, null);
  }
  {
    settings({});
    const s = makeWorld({health: 50});
    s.mh.ownedAcc.add(17);
    tick(s); s.heal.postTick();
    check("no wings -> Apple Basket", s.mh.useAcc, 17);
  }
  {
    settings({});
    const s = makeWorld({health: 50});
    s.mh.owned.add(13);
    s.mh.ownedAcc.add(13);
    tick(s); s.heal.postTick();
    check("the hat is preferred over the slot", s.mh.forceHat, 13);
    check("...and the accessory is left alone", s.mh.useAcc, null);
  }
  {
    settings({});
    const s = makeWorld({health: 50});
    s.mh.ownedAcc.add(13);
    tick(s); s.heal.scan();
    s.mh.useAcc = 11;                    // a tail someone else wanted
    s.heal.optimizeRegenGear();
    check("an accessory already claimed is left", s.mh.useAcc, 11);
  }
});

group("ryn2 — the fallback", () => {
  {
    // _autoHeal off is novastorm's gate, unchanged: it refuses the tick the
    // damage landed and takes the next one.
    settings({_autoHeal: false});
    const s = makeWorld({health: 60});
    tick(s); damage(s, 20); s.heal.postTick();
    check("fallback: nothing on the damage tick", s.mh.heals, 0);
    tick(s); s.heal.postTick();
    check("fallback: the next tick tops up to full", s.mh.heals, Math.ceil(60 / Items[0].restore));
  }
  {
    // And the Ryn 2 layer on the same world eats on the damage tick.
    settings({});
    const s = makeWorld({health: 60});
    tick(s); damage(s, 20); s.heal.postTick();
    check("ryn2: the damage tick is the reason", s.mh.heals, atLeast(1));
  }
  {
    // The fallback is novastorm's decision, and novastorm has no regen gear.
    settings({_autoHeal: false});
    const s = makeWorld({health: 50});
    s.mh.owned.add(13);
    s.mh.ownedAcc.add(13);
    tick(s); s.heal.postTick();
    check("fallback: no Medic Gear", s.mh.forceHat, null);
    check("fallback: no wings", s.mh.useAcc, null);
  }
  {
    // _autoheal off is the whole engine off, under either layer.
    settings({_autoheal: false});
    const s = makeWorld({health: 30});
    tick(s); s.heal.postTick();
    check("the engine switch stops everything", s.mh.heals, 0);
    settings({});
  }
});

// ══ DAMAGE DISTRIBUTION ══════════════════════════════════════════════════
group("damage distribution", () => {
  {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5050, y: 5000, primary: 5, current: 5, hat: 7});
    e.lastAttacked = s.myPlayer.tickCount;
    e.lastAttackWeapon = 5;
    damage(s, Weapons[5].damage * Hats[7].dmgMultO);
    s.heal.scan();
    check("a bull polearm swing is matched to its owner", s.heal.damagesByHits.length, 1);
    check("...and nothing is left over", s.heal.damages.length, 0);
  }
  {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5050, y: 5000, primary: 5, current: 5, hat: 55});
    e.lastAttacked = s.myPlayer.tickCount;
    e.lastAttackWeapon = 5;
    damage(s, Weapons[5].damage * Hats[55].dmgMultO);
    s.heal.scan();
    check("a Bloodthirster swing is matched at its own 1.2", s.heal.damagesByHits.length, 1);
  }
  {
    const s = makeWorld({health: 100, hat: 6});
    const e = addEnemy(s, {x: 5050, y: 5000, primary: 5, current: 5});
    e.lastAttacked = s.myPlayer.tickCount;
    e.lastAttackWeapon = 5;
    damage(s, Weapons[5].damage * Hats[6].dmgMult);
    s.heal.scan();
    check("our own helmet is in the expected value", s.heal.damagesByHits.length, 1);
  }
  {
    const s = makeWorld({health: 100});
    s.projm.dangerProjectiles.add({damage: 25, speed: 1.6, pos: {current: new Vector(5300, 5000)}});
    damage(s, 25);
    s.heal.scan();
    check("an arrow is matched to a live projectile", s.heal.damagesByShoots.length, 1);
  }
  {
    const s = makeWorld({health: 100});
    damage(s, 45);
    s.heal.scan();
    check("45 is read as a spike", s.heal.spikeDamages.length, 1);
    check("...and taken out of the list", s.heal.damages.length, 0);
  }
  {
    const s = makeWorld({health: 100});
    damage(s, 17.3);
    s.heal.scan();
    check("a number nothing explains stays in the list", s.heal.damages.length, 1);
  }
});

// ══ PACKET ORDERING ══════════════════════════════════════════════════════
group("packet ordering", () => {
  {
    const s = makeWorld({health: 60});
    damage(s, 20);                 // health frame arrives first
    s.myPlayer.tickCount += 1;     // then the player frame
    s.heal.scan();
    check("health-before-players -> classified on this tick", s.heal.spikeDamages.length, 1);
  }
  {
    const s = makeWorld({health: 60});
    tick(s);
    damage(s, 20);                 // player frame first
    s.heal.scan();
    check("players-before-health -> classified on this tick", s.heal.spikeDamages.length, 1);
  }
  {
    const s = makeWorld({health: 60});
    damage(s, 20);
    s.heal.scan();
    tick(s); s.heal.scan();
    check("and not read a second time", s.heal.spikeDamages.length, 0);
  }
});

// ── run ──────────────────────────────────────────────────────────────────
for (const [name, fn] of groups) {
  console.log(`\n${name}`);
  fn();
}
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
