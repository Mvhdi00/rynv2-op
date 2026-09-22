"use strict";
// Scenario tests for the Auto Heal survival engine.
//
// The engine, the item / weapon / hat tables and the Player class all come out
// of Ryn_Type_2.user.js through the harness, so these are the real decisions
// against real game numbers. Everything else — the managers, the grid, the
// module handler — is a stand-in built to the same shapes the client uses.
//
//   node tools/autoheal-test.js

const H = require("./autoheal-harness.js");
const {AutoHeal, Items, Hats, Projectiles, Vector, PlayerObject, Resource, Player, DataHandler, Settings} = H;

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

// ── stand-ins ────────────────────────────────────────────────────────────
class Grid {
  constructor() { this.objects = []; }
  add(o) { this.objects.push(o); return o; }
  query(x, y, search, cb) {
    const reach = (search + 1) * 100;
    for (const o of this.objects) {
      const p = o.pos.current;
      if (Math.abs(p.x - x) <= reach + 200 && Math.abs(p.y - y) <= reach + 200) {
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
    this.staticModules = {};
    this.forceHat = null;
    this.useHat = null;
    this.soldierAnti = false;
    this.healedOnce = false;
    this.packetCount = 0;
    this.packetLimit = 119;
    this.owned = new Set([ 0, 6, 7, 40, 53, 23, 20, 12 ]);
    this.heals = 0;
    this.client = null;
  }
  canBuy(type, id) { return type === 0 && this.owned.has(id); }
  heal() {
    this.heals += 1;
    this.packetCount += 3;
    // The real one puts three packets on the wire and the server answers with a
    // health update; here the health moves directly, so a scenario that runs for
    // several ticks behaves like one where the apples landed.
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
  const em = {
    potentialDamage: 0,
    potentialSpikeDamage: 0,
    primaryDamage: 0,
    collidingSpike: false,
    willCollideSpike: false,
    instaThreat: () => false
  };
  const pm = {enemies: [], lookingShield: () => false, isEnemyByID: (id, t) => id !== t.id};
  const projm = {dangerProjectiles: new Set, totalDamage: 0};
  Object.assign(client, {
    myPlayer: myPlayer,
    EnemyManager: em,
    PlayerManager: pm,
    ProjectileManager: projm,
    ObjectManager: om,
    _ModuleHandler: mh,
    SocketManager: {TICK: 1000 / 9, pong: 40},
    isOwner: true
  });
  const heal = new AutoHeal(client);
  mh.staticModules.autoHeal = heal;
  return {client, myPlayer, em, pm, projm, om, mh, heal};
}
function spike(om, x, y, type = 6, owner = 99) {
  const o = new PlayerObject(uid++, x, y, 0, Items[type].scale, type, owner);
  return om.add(o);
}
function cactus(om, x, y) {
  // Resource type 1 counts as a cactus only in the desert band.
  const o = new Resource(uid++, x, y, 0, 80, 1);
  return om.add(o);
}
function addEnemy(w, opts) {
  const e = makePlayer(w.client, opts);
  w.pm.enemies.push(e);
  return e;
}
// Advances one tick: the engine only reads what changed, so the tick counter has
// to move or the memoised scan returns the previous answer.
function tick(w) {
  w.myPlayer.tickCount += 1;
  w.heal.scanTick = -1;
  w.mh.heals = 0;
  w.mh.healedOnce = false;
  w.mh.soldierAnti = false;
}
function damage(w, amount) {
  const before = w.myPlayer.currentHealth;
  w.myPlayer.currentHealth = Math.max(0, before - amount);
  w.myPlayer.previousHealth = before;
  w.myPlayer.receivedDamage = Date.now();
  w.heal.healthUpdate(before, w.myPlayer.currentHealth);
}
// Damage that landed long enough ago that eating is free.
function agePastShameWindow(w) {
  w.myPlayer.receivedDamage = Date.now() - 500;
}

// ══ NORMAL DAMAGE ════════════════════════════════════════════════════════
group("normal damage", w => {
  {
    const s = makeWorld({health: 55});
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("one melee hit taken, quiet tick -> tops up to full", s.mh.heals, Math.ceil(45 / Items[0].restore));
  }
  {
    const s = makeWorld({health: 55});
    damage(s, 45);
    s.heal.postTick();
    check("hit landed this very tick -> no heal (inside shame window)", s.mh.heals, 0);
  }
  {
    const s = makeWorld({health: 55});
    damage(s, 45);
    s.heal.postTick();
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("next tick, outside the window -> heals", s.mh.heals, atLeast(1));
  }
  {
    const s = makeWorld({health: 100});
    tick(s);
    s.heal.postTick();
    check("full health -> never eats", s.mh.heals, 0);
  }
  {
    const s = makeWorld({health: 99});
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("one point missing -> one apple", s.mh.heals, 1);
  }
  {
    const s = makeWorld({health: 10});
    s.myPlayer.inventory[2] = 1; // cookie, restores 40
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("chain sized from the food actually carried (cookie, 40)", s.mh.heals, Math.ceil(90 / 40));
  }
});

// ══ SHAME ════════════════════════════════════════════════════════════════
group("shame", w => {
  {
    const s = makeWorld({health: 30});
    s.myPlayer.shameCount = 7;
    s.em.potentialDamage = 60;
    damage(s, 0.0001);
    s.heal.postTick();
    check("shame 7, lethal -> refuses (8 is a 30s lockout)", s.mh.heals, 0);
  }
  {
    const s = makeWorld({health: 30});
    s.myPlayer.shameCount = 6;
    s.em.potentialDamage = 60;
    damage(s, 0.0001);
    s.heal.postTick();
    check("shame 6, lethal -> eats and takes the point", s.mh.heals, atLeast(1));
  }
  {
    const s = makeWorld({health: 30});
    s.myPlayer.shameCount = 9;
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("shame 9 but a clean tick -> the free heal still runs", s.mh.heals, atLeast(1));
  }
  {
    const s = makeWorld({health: 30});
    s.myPlayer.shameActive = true;
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("shame lockout running -> eats nothing at all", s.mh.heals, 0);
  }
  {
    const s = makeWorld({health: 80});
    s.em.potentialDamage = 20;
    check("any predicted damage blocks the shame drain", s.heal.threatPending(), true);
  }
  {
    const s = makeWorld({health: 80});
    s.myPlayer.bullTick = s.myPlayer.tickCount; // a damage-over-time boundary tick
    s.em.potentialDamage = 5;                   // EnemyManager's unconditional +5
    check("the drain's own bull tick is not read as a threat", s.heal.threatPending(), false);
  }
});

// ══ SPIKES ═══════════════════════════════════════════════════════════════
group("spikes", w => {
  {
    const s = makeWorld({health: 60});
    s.em.collidingSpike = true;
    s.em.potentialSpikeDamage = Items[9].damage; // spinning spikes, 45
    tick(s);
    s.heal.scan();
    check("standing in a spinning spike -> 45 in the pot", s.heal.rawPot, near(45));
  }
  {
    const s = makeWorld({health: 60});
    s.myPlayer.isTrapped = true;
    s.em.collidingSpike = true;
    damage(s, 45);
    s.heal.scan();
    check("trapped in a spike, took 45 -> 45 in the pot", s.heal.rawPot, near(45));
    check("held on a spike -> the helmet goes on", s.mh.soldierAnti, true);
    check("and the tick repeats, through that helmet",
      s.heal.futureHealth(1) - s.heal.futureHealth(2), near(45 * Hats[6].dmgMult));
  }
  {
    // The multiplier reversal: 45 through a soldier helmet arrives as 33.75, and
    // the pot has to carry the raw 45 because the helmet is applied again below.
    const s = makeWorld({health: 60, hat: 6});
    s.myPlayer.isTrapped = true;
    s.em.collidingSpike = true;
    s.mh.forceHat = 6;
    damage(s, 45 * Hats[6].dmgMult);
    s.heal.scan();
    check("soldier spike tick -> raw 45 in the pot", s.heal.rawPot, near(45));
    check("...and 33.75 after the helmet is re-applied", s.heal.pot, near(45 * Hats[6].dmgMult));
  }
  {
    const s = makeWorld({health: 60});
    s.myPlayer.isTrapped = true;
    s.em.collidingSpike = true;
    damage(s, 20);
    damage(s, 20);
    s.heal.scan();
    check("two spikes in one tick -> both counted", s.heal.rawPot, near(40));
  }
  {
    // Walking into a spike: the swept segment, not a radius.
    const s = makeWorld({health: 60});
    s.myPlayer.pos.current._setXY(5000, 5000);
    s.myPlayer.pos.future._setXY(5120, 5000);
    s.myPlayer.speed = 30;
    spike(s.om, 5100, 5000, 7); // greater spikes, 35
    tick(s);
    s.heal.scan();
    check("about to walk into a greater spike -> 35", s.heal.rawPot, near(35));
  }
  {
    const s = makeWorld({health: 60});
    s.myPlayer.pos.current._setXY(5000, 5000);
    s.myPlayer.pos.future._setXY(5120, 5000);
    s.myPlayer.speed = 30;
    spike(s.om, 5100, 5400, 7); // well off the path
    tick(s);
    s.heal.scan();
    check("a spike nowhere near the path -> nothing", s.heal.rawPot, 0);
  }
  {
    const s = makeWorld({health: 60});
    s.myPlayer.speed = 0;
    s.myPlayer.pos.future._setXY(5000, 5000);
    spike(s.om, 5060, 5000, 7);
    tick(s);
    s.heal.scan();
    check("standing still next to a spike -> nothing", s.heal.rawPot, 0);
  }
  {
    // Standing on a spike, not trapped, having just been hit: EnemyManager sees
    // the contact and the swept segment is a point inside the same spike. One
    // spike, one 45.
    const s = makeWorld({health: 60});
    s.em.collidingSpike = true;
    s.em.potentialSpikeDamage = Items[9].damage;
    s.myPlayer.speed = 0;
    spike(s.om, 5040, 5000, 9);
    damage(s, 45);
    s.heal.scan();
    check("contact and sweep describing one spike -> counted once", s.heal.rawPot, near(45));
  }
});

// ══ KNOCKBACK ════════════════════════════════════════════════════════════
group("knockback into spikes", w => {
  {
    // Enemy to our left with a bat (knockback 111.1): we fly right into a spike.
    const s = makeWorld({health: 60});
    const e = addEnemy(s, {x: 4900, y: 5000, primary: 6, secondary: null});
    spike(s.om, 5090, 5000, 7);
    tick(s);
    s.heal.scan();
    check("bat knockback lands us on a greater spike -> 35", s.heal.rawPot, near(35));
    check("...and it is flagged as still worth gathering through", s.heal.canStillGather, true);
  }
  {
    const s = makeWorld({health: 60});
    const e = addEnemy(s, {x: 4900, y: 5000, primary: 6, secondary: null});
    e.reload[0].current = 0; // mid-swing, cannot hit
    spike(s.om, 5090, 5000, 7);
    tick(s);
    s.heal.scan();
    check("enemy on cooldown -> no knockback threat", s.heal.rawPot, 0);
  }
  {
    const s = makeWorld({health: 60});
    addEnemy(s, {x: 4400, y: 5000, primary: 6, secondary: null});
    spike(s.om, 5090, 5000, 7);
    tick(s);
    s.heal.scan();
    check("enemy far out of reach -> no knockback threat", s.heal.rawPot, 0);
  }
  {
    const s = makeWorld({health: 60});
    s.myPlayer.isTrapped = true;
    addEnemy(s, {x: 4900, y: 5000, primary: 6, secondary: null});
    spike(s.om, 5090, 5000, 7);
    tick(s);
    s.heal.scan();
    check("trapped -> knockback cannot move us, so no knockback threat", s.heal.rawPot, 0);
  }
});

// ══ POISON ═══════════════════════════════════════════════════════════════
group("poison", w => {
  {
    const s = makeWorld({health: 60});
    s.myPlayer.poisonCount = 5;
    damage(s, 5);                       // a poison tick lands
    s.heal.scan();
    check("the tick that just landed is not also predicted", s.heal.rawPot, 0);
    for (let i = 0; i < 8; i++) { tick(s); s.heal.scan(); }
    check("eight ticks later the next one is predicted", s.heal.rawPot, near(5));
  }
  {
    const s = makeWorld({health: 60});
    s.myPlayer.poisonCount = 5;
    damage(s, 5 * Hats[6].dmgMult);     // the same tick through a soldier helmet
    s.heal.scan();
    check("3.75 is read as a poison tick", s.heal.poisonHit, true);
  }
  {
    const s = makeWorld({health: 60});
    s.myPlayer.poisonCount = 0;
    for (let i = 0; i < 9; i++) { tick(s); s.heal.scan(); }
    check("no poison running -> nothing predicted", s.heal.rawPot, 0);
  }
  {
    // Poison spikes apply a dose as well as their damage.
    const s = makeWorld({health: 60});
    s.myPlayer.isTrapped = true;
    s.em.collidingSpike = true;
    damage(s, Items[8].damage);         // poison spikes, 30
    s.heal.scan();
    check("poison spike contact starts a dose", s.heal.poisonRemaining, 5);
  }
  {
    const s = makeWorld({health: 60, hat: 23});
    s.myPlayer.isTrapped = true;
    s.em.collidingSpike = true;
    damage(s, Items[8].damage);
    s.heal.scan();
    check("Anti Venom refuses the dose", s.heal.poisonRemaining, 0);
  }
});

// ══ PROJECTILES / TURRETS / INSTAKILL ════════════════════════════════════
group("projectiles, turrets, instakill", w => {
  {
    const s = makeWorld({health: 60});
    const e = addEnemy(s, {x: 5250, y: 5000, primary: 5, secondary: 15});
    e.countedPrimary = false;
    const proj = {isTurret: true, ownerClient: e, type: 1, damage: 25, speed: 1.5, life: 9, angle: 0, pos: {current: new Vector(5200, 5000)}};
    s.projm.dangerProjectiles.add(proj);
    tick(s);
    s.heal.scan();
    check("turret shot inbound from 250 with a primary ready -> the swing is counted", s.heal.rawPot, near(e.getMaxWeaponDamage(5, false, false)));
  }
  {
    const s = makeWorld({health: 60});
    const e = addEnemy(s, {x: 5250, y: 5000, primary: 5, secondary: 15});
    e.countedPrimary = true; // RYN already charged for it
    const proj = {isTurret: true, ownerClient: e, type: 1, damage: 25, speed: 1.5, life: 9, angle: 0, pos: {current: new Vector(5200, 5000)}};
    s.projm.dangerProjectiles.add(proj);
    tick(s);
    s.heal.scan();
    check("...and not counted twice when it was already charged", s.heal.rawPot, 0);
  }
  {
    // A windmill sits on layer 1, the same layer the turret shot travels on, so
    // it stops the shot and the read with it.
    const s = makeWorld({health: 60});
    const e = addEnemy(s, {x: 5250, y: 5000, primary: 5, secondary: 15});
    const proj = {isTurret: true, ownerClient: e, type: 1, damage: 25, speed: 1.5, life: 9, angle: 0, pos: {current: new Vector(5200, 5000)}};
    s.projm.dangerProjectiles.add(proj);
    spike(s.om, 5100, 5000, 10); // windmill
    tick(s);
    s.heal.scan();
    check("a windmill in the way -> the turret shot is not counted", s.heal.rawPot, 0);
  }
  {
    // A wall is layer 0, below the shot, so it does not stop it.
    const s = makeWorld({health: 60});
    const e = addEnemy(s, {x: 5250, y: 5000, primary: 5, secondary: 15});
    const proj = {isTurret: true, ownerClient: e, type: 1, damage: 25, speed: 1.5, life: 9, angle: 0, pos: {current: new Vector(5200, 5000)}};
    s.projm.dangerProjectiles.add(proj);
    spike(s.om, 5100, 5000, 3); // wood wall, layer 0
    tick(s);
    s.heal.scan();
    check("a wall below the shot's layer -> still counted", s.heal.rawPot, near(e.getMaxWeaponDamage(5, false, false)));
  }
  {
    // The musket read: a hit just landed, they are inside 400, the secondary and
    // the turret are both up and neither has been counted by RYN.
    const s = makeWorld({health: 70});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5, secondary: 15, current: 5});
    e.lastAttacked = s.myPlayer.tickCount;
    damage(s, e.getMaxWeaponDamage(5, false, false));
    s.heal.scan();
    check("melee hit landed -> classified as a hit", s.heal.hits.length, 1);
    check("musket + turret follow-up counted", s.heal.rawPot, near(Projectiles[5].damage + 25));
  }
  {
    const s = makeWorld({health: 70});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5, secondary: 15, current: 5});
    e.lastAttacked = s.myPlayer.tickCount;
    e.countedSecondary = true;
    e.countedTurret = true;
    damage(s, e.getMaxWeaponDamage(5, false, false));
    s.heal.scan();
    check("...unless RYN already counted both", s.heal.rawPot, 0);
  }
  {
    const s = makeWorld({health: 20});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5, secondary: 11});
    tick(s);
    s.heal.scan();
    check("at 20 health a turret inside 350 finishes us", s.heal.rawPot, near(25));
  }
  {
    const s = makeWorld({health: 20});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5, secondary: 11});
    e.reload[2].current = 0;
    tick(s);
    s.heal.scan();
    check("...but not while its turret is cycling", s.heal.rawPot, 0);
  }
  {
    // One enemy, two branches that both want to charge for their turret: the
    // melee-hit read at 400 and the low-health read at 350. One turret, one 25.
    const s = makeWorld({health: 20});
    const e = addEnemy(s, {x: 5300, y: 5000, primary: 5, secondary: 11, current: 5});
    e.lastAttacked = s.myPlayer.tickCount;
    damage(s, e.getMaxWeaponDamage(5, false, false));
    s.heal.scan();
    check("a turret is charged once across branches", s.heal.rawPot, near(25));
  }
});

// ══ ENEMY SPIKE PLACEMENT ════════════════════════════════════════════════
group("enemy spike placement", w => {
  {
    // Enemy close enough to drop a spinning spike where we are going, with a
    // polearm ready. 45 + 45 * 1.5 = 112.5 > health / 0.75.
    const s = makeWorld({health: 60});
    const e = addEnemy(s, {x: 5000, y: 5120, primary: 5, secondary: 10, hat: 7, spike: 9});
    s.myPlayer.pos.future._setXY(5000, 5040);
    tick(s);
    s.heal.scan();
    check("spike onto our velocity point + a ready polearm -> 45", s.heal.rawPot, near(45));
    check("...and the helmet goes on", s.heal.spikeTickAnti, true);
  }
  {
    const s = makeWorld({health: 60});
    const e = addEnemy(s, {x: 5000, y: 5120, primary: 5, secondary: 10, hat: 7, spike: 9});
    s.myPlayer.pos.future._setXY(5000, 5040);
    s.om.placeable = false; // the ground is taken
    tick(s);
    s.heal.scan();
    check("nowhere to put it -> nothing", s.heal.rawPot, 0);
  }
  {
    const s = makeWorld({health: 95});
    const e = addEnemy(s, {x: 5000, y: 5120, primary: 5, secondary: 10, spike: 9});
    s.myPlayer.pos.future._setXY(5000, 5040);
    tick(s);
    s.heal.scan();
    check("healthy enough to survive it -> not paid for", s.heal.rawPot, 0);
  }
});

// ══ SOLDIER ANTI AND THE HAT ═════════════════════════════════════════════
group("soldier anti", w => {
  {
    const s = makeWorld({health: 100});
    s.em.potentialDamage = 100;
    tick(s);
    s.heal.scan();
    check("a hundred raw -> soldierAnti", s.heal.soldierAnti, true);
    check("...and the module handler is told", s.mh.soldierAnti, true);
    check("...and the pot is read through the helmet", s.heal.pot, near(100 * Hats[6].dmgMult));
  }
  {
    const s = makeWorld({health: 100});
    s.em.potentialDamage = 99;
    tick(s);
    s.heal.scan();
    check("ninety-nine -> no soldierAnti", s.heal.soldierAnti, false);
  }
  {
    const s = makeWorld({health: 100});
    s.em.potentialDamage = 200;
    tick(s);
    s.heal.scan();
    check("the pot is capped at 140", s.heal.rawPot, 140);
  }
  {
    const s = makeWorld({health: 100});
    s.mh.forceHat = 7; // the shame drain put bull on
    tick(s);
    s.heal.scan();
    check("bull on -> its drain is added", s.heal.pot, near(5));
  }
});

// ══ EMERGENCY / RECOVERY ═════════════════════════════════════════════════
group("emergency and recovery", w => {
  const s = makeWorld({health: 40});
  s.em.potentialDamage = 60;
  tick(s);
  s.heal.postTick();
  check("lethal prediction -> emergency", s.heal.emergency, true);
  check("...and it eats", s.mh.heals, atLeast(1));
  // Out of food from here, so the state is exercised rather than healed away.
  s.em.potentialDamage = 0;
  s.myPlayer.resources.food = 0;
  s.myPlayer.currentHealth = 40;
  for (let i = 0; i < 2; i++) { tick(s); agePastShameWindow(s); s.heal.postTick(); }
  check("two quiet ticks -> still in emergency (no flapping)", s.heal.emergency, true);
  tick(s); agePastShameWindow(s); s.heal.postTick();
  check("three quiet ticks -> recovered", s.heal.emergency, false);
  // Full health is the other way out, and it is immediate.
  s.em.potentialDamage = 60;
  s.myPlayer.currentHealth = 40;
  tick(s); s.heal.postTick();
  check("back into emergency", s.heal.emergency, true);
  s.myPlayer.currentHealth = 100;
  tick(s); s.heal.postTick();
  check("full health leaves emergency at once", s.heal.emergency, false);
});

// ══ PACKET BUDGET ════════════════════════════════════════════════════════
group("packet budget", w => {
  {
    const s = makeWorld({health: 10});
    s.mh.packetCount = 119;
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("budget spent, nothing lethal -> no heal", s.mh.heals, 0);
  }
  {
    const s = makeWorld({health: 10});
    s.em.potentialDamage = 40;
    s.mh.packetCount = 119;
    tick(s);
    s.heal.postTick();
    check("budget spent but dying -> one apple gets through", s.mh.heals, 1);
  }
  {
    const s = makeWorld({health: 10});
    s.mh.packetCount = 110;   // room for three sends, so one apple
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("a tight budget caps the chain", s.mh.heals, 3);
  }
  {
    const s = makeWorld({health: 10});
    s.myPlayer.resources.food = 25; // two apples' worth
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("food on hand caps the chain", s.mh.heals, 2);
  }
  {
    const s = makeWorld({health: 10});
    s.myPlayer.resources.food = 0;
    tick(s); agePastShameWindow(s);
    s.heal.postTick();
    check("no food -> no heal", s.mh.heals, 0);
  }
});

// ══ COMBINED ═════════════════════════════════════════════════════════════
group("combined threats", w => {
  {
    // Poison due, standing in a spike, an enemy in reach with a polearm.
    const s = makeWorld({health: 75});
    s.myPlayer.isTrapped = true;
    s.myPlayer.poisonCount = 5;
    s.em.collidingSpike = true;
    s.em.potentialDamage = 80; // a bull polearm plus the turret behind it
    damage(s, 20);
    s.myPlayer.bullTick = s.myPlayer.tickCount - 8;
    s.heal.scan();
    check("spike + poison + melee all land in one pot", s.heal.rawPot, near(80 + 20 + 5));
    check("...which is over a hundred, so the helmet goes on", s.heal.soldierAnti, true);
    check("...and future health goes negative", s.heal.futureHealth(1) < 0, true);
  }
  {
    // The horizon: nothing lethal this tick, lethal across the window.
    const s = makeWorld({health: 50});
    s.myPlayer.isTrapped = true;
    s.em.collidingSpike = true;
    damage(s, 20);
    s.heal.scan();
    check("one spike tick is survivable now", s.heal.futureHealth(1) > 0, true);
    check("...but not after it repeats", s.heal.futureHealth(2) <= 0, true);
    check("...so the heal is urgent", (s.heal.postTick(), s.heal.urgent), true);
  }
  {
    const s = makeWorld({health: 50});
    const e = addEnemy(s, {x: 4900, y: 5000, primary: 6, secondary: null});
    spike(s.om, 5090, 5000, 9);   // spinning, 45
    s.em.potentialDamage = 30;    // the bat swing RYN already counted
    tick(s);
    s.heal.scan();
    check("bat + knockback onto a spinning spike", s.heal.rawPot, near(30 + 45));
    check("...is lethal at 50", s.heal.futureHealth(1) <= 0, true);
  }
});

// ══ CLASSIFIER ═══════════════════════════════════════════════════════════
group("damage classification", w => {
  {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5050, y: 5000, primary: 5, secondary: 10, current: 5, hat: 7});
    e.lastAttacked = s.myPlayer.tickCount;
    const expected = Items ? 45 * Hats[7].dmgMultO : 0; // polearm through bull
    damage(s, expected);
    s.heal.scan();
    check("a bull polearm swing is matched to its owner", s.heal.hits.length, 1);
    check("...and nothing is left unclaimed", s.heal.unclaimed.length, 0);
  }
  {
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5050, y: 5000, primary: 5, secondary: 10, current: 5, hat: 55, acc: 0});
    e.lastAttacked = s.myPlayer.tickCount;
    damage(s, 45 * Hats[55].dmgMultO);  // Bloodthirster, 1.2 — not a bull
    s.heal.scan();
    check("a Bloodthirster swing is matched too", s.heal.hits.length, 1);
  }
  {
    const s = makeWorld({health: 100});
    damage(s, 25);
    s.projm.dangerProjectiles.add({isTurret: false, ownerClient: null, damage: 25, speed: 1.6, life: 9, angle: 0, pos: {current: new Vector(5300, 5000)}});
    s.heal.scan();
    check("an arrow is matched to a live projectile", s.heal.shots.length, 1);
  }
  {
    const s = makeWorld({health: 100});
    damage(s, 17.3);
    s.heal.scan();
    check("a number nothing explains stays unclaimed", s.heal.unclaimed.length, 1);
  }
});

// ══ ENVIRONMENT ══════════════════════════════════════════════════════════
group("environment", w => {
  {
    // The cactus only bites in the desert band, so the world is moved there.
    const s = makeWorld({health: 60, x: 5000, y: 12500});
    s.myPlayer.pos.current._setXY(5000, 12500);
    s.myPlayer.pos.future._setXY(5120, 12500);
    s.myPlayer.speed = 30;
    cactus(s.om, 5100, 12500);
    tick(s);
    s.heal.scan();
    check("walking into a cactus -> 35", s.heal.rawPot, near(35));
  }
  {
    const s = makeWorld({health: 60, x: 5000, y: 5000});
    s.myPlayer.pos.current._setXY(5000, 5000);
    s.myPlayer.pos.future._setXY(5120, 5000);
    s.myPlayer.speed = 30;
    cactus(s.om, 5100, 5000); // same bush, outside the desert
    tick(s);
    s.heal.scan();
    check("the same bush outside the desert -> nothing", s.heal.rawPot, 0);
  }
});

// ══ SUSTAINED PRESSURE ═══════════════════════════════════════════════════
group("sustained pressure", w => {
  {
    // Bull + daggers: 20 * 1.5 = 30 a swing, and daggers swing every 100ms, so
    // every tick is a damage tick. The free branch must still find its window.
    const s = makeWorld({health: 100});
    const e = addEnemy(s, {x: 5050, y: 5000, primary: 7, secondary: null, current: 7, hat: 7});
    let healed = 0;
    for (let i = 0; i < 6; i++) {
      tick(s);
      e.lastAttacked = s.myPlayer.tickCount;
      damage(s, 20 * Hats[7].dmgMultO);
      s.em.potentialDamage = 30;
      s.heal.postTick();
      healed += s.mh.heals;
    }
    check("dagger spam -> the engine keeps eating through it", healed, atLeast(3));
    check("...and every swing was classified", s.heal.hits.length, 1);
  }
  {
    // Two enemies in reach: RYN sums them, the engine does not re-sum them.
    const s = makeWorld({health: 100});
    addEnemy(s, {x: 5050, y: 5000, primary: 5, secondary: 11});
    addEnemy(s, {x: 4950, y: 5000, primary: 5, secondary: 11});
    s.em.potentialDamage = 135; // both polearms, already summed by EnemyManager
    tick(s);
    s.heal.scan();
    check("two attackers are counted once, not twice", s.heal.rawPot, 135);
  }
});

// ══ PACKET ORDERING ══════════════════════════════════════════════════════
group("packet ordering", w => {
  {
    // Health frame before the player frame: the damage is observed while the
    // tick counter still reads the previous tick.
    const s = makeWorld({health: 60});
    damage(s, 20);                    // arrives at tick N-1
    s.myPlayer.tickCount += 1;        // then the player frame moves the tick on
    s.heal.scanTick = -1;
    s.heal.scan();
    check("health-before-players -> still classified this tick", s.heal.tookDamage, true);
  }
  {
    // Health frame after the player frame.
    const s = makeWorld({health: 60});
    tick(s);
    damage(s, 20);                    // arrives at tick N
    s.heal.scan();
    check("players-before-health -> still classified this tick", s.heal.tookDamage, true);
  }
  {
    const s = makeWorld({health: 60});
    damage(s, 20);
    s.heal.scan();
    check("the first scan consumes it", s.heal.tookDamage, true);
    tick(s);
    s.heal.scan();
    check("the next scan does not see it again", s.heal.tookDamage, false);
  }
});

// ── run ──────────────────────────────────────────────────────────────────
for (const [name, fn] of groups) {
  console.log(`\n${name}`);
  fn();
}
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
