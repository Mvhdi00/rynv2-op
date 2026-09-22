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
    this.heals = 0;
    this.packets = 0;
    this.client = null;
  }
  canBuy(type, id) { return type === 0 && this.owned.has(id); }
  setForceHat(hat) { if (this.forceHat !== null && hat !== null) return; this.forceHat = hat; }
  heal() {
    this.heals += 1;
    this.packets += 4;   // novastorm's place(): z, F1, F0, z
    const p = this.client.myPlayer;
    const food = Items[p.getItemByType(2)];
    p.currentHealth = Math.min(p.maxHealth, p.currentHealth + food.restore);
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
group("the heal", () => {
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
