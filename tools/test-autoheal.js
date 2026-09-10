// Auto Heal verification — pulls NovastormHeal straight out of
// Ryn_Type_2.user.js and runs it against stubs for the parts of the client it
// touches (player, enemies, object grid, packet budget, food).
//
// It checks the decision, not the geometry library: what the prediction sums
// to, what the hat terms do to it, when shame blocks a heal, when the packet
// budget may drop one, and that the ported spike, knockback and poison terms
// fire on the cases they were written for.
//
//     node tools/test-autoheal.js [path/to/Ryn_Type_2.user.js]
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || __dirname + "/../Ryn_Type_2.user.js", "utf8");

const startMark = "  const NOVA_DMG_CAP = 140;";
const endMark = "  const AntiInsta_default = NovastormHeal;";
const start = src.indexOf(startMark);
const end = src.indexOf(endMark);
if (start < 0 || end < 0) throw new Error("markers not found");
const moduleSrc = src.slice(start, end + endMark.length);

// ---- stubs ---------------------------------------------------------------
class Vec {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  _setXY(x, y) { this.x = x; this.y = y; return this; }
  distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); }
}
const Vector_default = Vec;
const lineInRect = (x1, y1, x2, y2, ax, ay, bx, by) => {
  // good-enough AABB-vs-segment: sample the segment
  for (let t = 0; t <= 1; t += .05) {
    const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
    if (px >= x1 && px <= x2 && py >= y1 && py <= y2) return true;
  }
  return false;
};
const Items = [];
Items[0] = { restore: 20 };            // apple, food slot
Items[9] = { scale: 35, damage: 45, placeOffset: 0 };
const Hats = { 6: { dmgMult: .75 } };
const Logger = { log() {} };
class PlayerObject {}
const DataHandler_default = {
  isMelee: id => id !== null && id < 9,
  isShootable: id => [ 9, 12, 13, 15 ].includes(id),
  getWeapon: id => ({ range: 140, knockback: 0, damage: 35 })
};
const Settings_default = { _autoheal: true };

let healCalls = 0;
const ModuleHandler = {
  forceHat: null, useHat: null, healedOnce: false,
  packetLimit: 119, packetCount: 0,
  canBuy: () => true,
  heal() { healCalls++; }
};

function makeClient(o = {}) {
  const myPlayer = {
    inGame: true, tempHealth: 100, maxHealth: 100, shameCount: 0,
    shameActive: false, isTrapped: false, tickCount: 100, damageTick: 0,
    damages: [], scale: 35, hatID: 0,
    pos: { current: new Vec(0, 0), future: new Vec(0, 0) },
    reload: { 0: { previous: 0, max: 1 }, 1: { previous: 0, max: 1 }, 2: { previous: 0, max: 1 } },
    isReloaded: () => false,
    getItemByType: () => 0,
    ...o.myPlayer
  };
  return {
    myPlayer,
    PlayerManager: {
      enemies: o.enemies || [],
      lookingShield: () => false,
      playerData: new Map(),
      isEnemyByID: () => true
    },
    ObjectManager: {
      grid2D: { queryFull: () => o.objectIDs || [] },
      objects: new Map(o.objects || []),
      canPlaceItem: () => false
    },
    ProjectileManager: { dangerProjectiles: o.projectiles || [] },
    _ModuleHandler: ModuleHandler
  };
}

function makeEnemy(o = {}) {
  return {
    weapon: { primary: 0, secondary: null },
    pos: { current: new Vec(o.x || 0, o.y || 0), future: new Vec(o.x || 0, o.y || 0) },
    reload: { 0: { previous: 1, max: 1 }, 1: { previous: 0, max: 1 }, 2: { previous: 0, max: 1 } },
    isReloaded: type => (o.reloaded || []).includes(type),
    getMaxWeaponDamage: () => o.damage === undefined ? 35 : o.damage,
    hatID: o.hatID || 0,
    ...o.extra
  };
}

const AntiInsta_default = new Function(
  "Vector_default", "lineInRect", "Items", "Hats", "Logger", "PlayerObject",
  "DataHandler_default", "Settings_default",
  moduleSrc + "\n return AntiInsta_default;"
)(Vector_default, lineInRect, Items, Hats, Logger, PlayerObject, DataHandler_default, Settings_default);

// ---- cases ---------------------------------------------------------------
let failures = 0;
function check(name, expected, actual, extra = "") {
  const ok = expected === actual;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — expected ${expected}, got ${actual} ${extra}`);
}
function run(label, setup, expectHeals, inspect) {
  healCalls = 0;
  ModuleHandler.healedOnce = false;
  ModuleHandler.forceHat = null;
  ModuleHandler.useHat = null;
  ModuleHandler.packetCount = 0;
  const client = makeClient(setup);
  const mod = new AntiInsta_default(client);
  if (setup.pre) setup.pre(mod, client);
  mod.postTick();
  check(label, expectHeals, healCalls, inspect ? inspect(mod) : "");
}

// 1. full health, nothing around -> no heal, no shame reset (shame 0)
run("full health, quiet tick", {}, 0);

// 2. damaged, quiet tick (tickCount > damageTick) -> recovery heal, deficit 40 = 2 apples
run("recovery top-up after a quiet tick", {
  myPlayer: { tempHealth: 60, damageTick: 50, tickCount: 100 }
}, 2);

// 3. damaged this very tick (damageTick = tickCount + 1), nothing predicted -> no heal
run("damaged this tick, nothing predicted", {
  myPlayer: { tempHealth: 60, tickCount: 100, damageTick: 101 }
}, 0);

// 4. lethal prediction: one reloaded enemy in range whose hit alone kills
run("lethal single hit predicted -> heals", {
  myPlayer: { tempHealth: 30, tickCount: 100, damageTick: 101 },
  enemies: [ makeEnemy({ x: 60, reloaded: [ 0 ], damage: 35 }) ]
}, 4, m => `totalDmgPot=${m.totalDmgPot} healing=${m.healing}`);

// 5. same, but shameCount 7 -> novastorm's hard wall, no heal at all
run("lethal prediction at shame 7 -> blocked", {
  myPlayer: { tempHealth: 30, shameCount: 7, tickCount: 100, damageTick: 101 },
  enemies: [ makeEnemy({ x: 60, reloaded: [ 0 ], damage: 35 }) ]
}, 0, m => `healing=${m.healing}`);

// 6. shame 7 but a quiet tick -> the save-heal tick still fires
run("shame 7 on a quiet tick -> recovery heal", {
  myPlayer: { tempHealth: 30, shameCount: 7, tickCount: 100, damageTick: 50 }
}, 4);

// 7. shameActive (server refusing food) -> nothing spent
run("shameActive -> no food spent", {
  myPlayer: { tempHealth: 30, shameActive: true, tickCount: 100, damageTick: 50 }
}, 0);

// 8. autoheal off -> prediction still runs, no food
run("autoheal off -> no food, prediction still computed", {
  myPlayer: { tempHealth: 30, tickCount: 100, damageTick: 101 },
  enemies: [ makeEnemy({ x: 60, reloaded: [ 0 ], damage: 35 }) ],
  pre: () => { Settings_default._autoheal = false; }
}, 0, m => `totalDmgPot=${m.totalDmgPot}`);
Settings_default._autoheal = true;

// 9. soldierAnti at 100 predicted: four reloaded enemies at 35 -> 140, cap holds
run("four lethal enemies -> cap 140, soldierAnti", {
  myPlayer: { tempHealth: 30, tickCount: 100, damageTick: 101 },
  enemies: [ 0, 1, 2, 3, 4 ].map(i => makeEnemy({ x: 60 + i, reloaded: [ 0 ], damage: 35 }))
}, 4, m => `totalDmgPot=${m.totalDmgPot} soldierAnti=${m.soldierAnti} wantsSoldier=${m.wantsSoldier}`);

// 10. soldier hat term: the 0.75 is applied against the hat about to go on
{
  healCalls = 0;
  const client = makeClient({
    myPlayer: { tempHealth: 27, tickCount: 100, damageTick: 101 },
    enemies: [ makeEnemy({ x: 60, reloaded: [ 0 ], damage: 35 }) ]
  });
  const mod = new AntiInsta_default(client);
  ModuleHandler.forceHat = 6;
  mod.postTick();
  check("soldier term: 35 * 0.75 = 26.25 < 27 -> no lethal heal", 0, healCalls,
    `totalDmgPot=${mod.totalDmgPot} healing=${mod.healing}`);
  ModuleHandler.forceHat = null;
}

// 11. bull hat term: +5. Poison alone predicts 5; at 9 health that is not
//     lethal, but the bull bias makes it so.
{
  const setup = () => {
    const client = makeClient({ myPlayer: { tempHealth: 100, tickCount: 100, damageTick: 101, damages: [ 5 ] } });
    const mod = new AntiInsta_default(client);
    mod.postTick();                       // stamps poisonTick = 100
    client.myPlayer.tickCount = 108;      // elapsed 8 -> poison predicted
    client.myPlayer.damageTick = 109;     // damaged this tick: no save-heal path
    client.myPlayer.tempHealth = 9;
    client.myPlayer.damages = [];
    return mod;
  };
  healCalls = 0;
  const bare = setup();
  healCalls = 0;
  bare.postTick();
  check("no bull: 5 predicted, 9 health -> no heal", 0, healCalls,
    `totalDmgPot=${bare.totalDmgPot} healing=${bare.healing}`);

  const withBull = setup();
  healCalls = 0;
  ModuleHandler.forceHat = 7;
  withBull.postTick();
  check("bull term: 5 + 5 = 10 >= 9 -> heals", 5, healCalls,
    `totalDmgPot=${withBull.totalDmgPot} healing=${withBull.healing}`);
  ModuleHandler.forceHat = null;
}

// 12. packet budget only trims the non-mandatory recovery heal
{
  healCalls = 0;
  ModuleHandler.packetCount = 118;
  const client = makeClient({ myPlayer: { tempHealth: 20, tickCount: 100, damageTick: 50 } });
  new AntiInsta_default(client).postTick();
  check("recovery heal trimmed by packet budget", 0, healCalls);

  healCalls = 0;
  ModuleHandler.packetCount = 118;
  const client2 = makeClient({
    myPlayer: { tempHealth: 20, tickCount: 100, damageTick: 101 },
    enemies: [ makeEnemy({ x: 60, reloaded: [ 0 ], damage: 35 }) ]
  });
  new AntiInsta_default(client2).postTick();
  check("mandatory heal ignores packet budget", 4, healCalls);
  ModuleHandler.packetCount = 0;
}

// 13. poison: stamped, then predicted 8 ticks later
{
  healCalls = 0;
  const client = makeClient({ myPlayer: { tempHealth: 100, tickCount: 100, damageTick: 101, damages: [ 5 ] } });
  const mod = new AntiInsta_default(client);
  mod.postTick();                         // stamps poisonTick = 100
  check("poison stamped", 100, mod.poisonTick);
  client.myPlayer.tickCount = 108;        // elapsed 8 -> predicted
  client.myPlayer.tempHealth = 4;
  client.myPlayer.damages = [];
  healCalls = 0;
  mod.postTick();
  check("poison predicted on tick 8 of the cycle", 5, mod.poisonDmgPot, `heals=${healCalls}`);
  check("poison drives the heal", true, healCalls > 0);
}

// 14. shame reset flag on a truly quiet tick
{
  const client = makeClient({ myPlayer: { tempHealth: 100, shameCount: 3, tickCount: 100, damageTick: 50 } });
  const mod = new AntiInsta_default(client);
  mod.postTick();
  check("shouldResetShame on a quiet tick with shame", true, mod.shouldResetShame);
}

// 15. dead -> death log drains, nothing else runs
{
  healCalls = 0;
  const client = makeClient({ myPlayer: { inGame: false, tempHealth: 0 } });
  const mod = new AntiInsta_default(client);
  mod.deathDamages.push({ damage: 45, tick: 1 });
  mod.postTick();
  check("death drains the log", 0, mod.deathDamages.length, `heals=${healCalls}`);
}

// ---- world cases: the prediction itself, not just the gate ----------------
function makeSpike(x, y, damage = 20) {
  const s = new PlayerObject();
  s.itemGroup = 2;
  s.ownerID = 99;
  s.scale = 35;
  s.pos = { current: new Vec(x, y) };
  s.getDamage = () => damage;
  return s;
}
function withSpikes(spikes, rest = {}) {
  return Object.assign({
    objectIDs: spikes.map((_, i) => i),
    objects: spikes.map((s, i) => [ i, s ])
  }, rest);
}

// 16. trapped and pinned on a spike: the tier just taken is charged again
{
  healCalls = 0;
  const client = makeClient(withSpikes([ makeSpike(50, 0, 20) ], {
    myPlayer: { tempHealth: 100, isTrapped: true, tickCount: 100, damageTick: 101, damages: [ 20 ] }
  }));
  const mod = new AntiInsta_default(client);
  mod.postTick();
  check("trapped on a spike -> collidingSpike", true, mod.collidingSpike);
  check("trapped on a spike -> spike tier charged", 20, mod.spikeDmgPot);
  check("consecutive spike ticks counted", 1, mod.spikeDmgCount);
}

// 17. walking into a spike: the swept test from here to where we are going
{
  healCalls = 0;
  const client = makeClient(withSpikes([ makeSpike(60, 0, 35) ], {
    myPlayer: { tempHealth: 40, tickCount: 100, damageTick: 101 }
  }));
  client.myPlayer.pos.future = new Vec(120, 0);
  const mod = new AntiInsta_default(client);
  mod.lastPosX = -50;                     // moved > 2, so the sweep runs
  mod.postTick();
  check("walking into a spike -> willCollide", true, mod.willCollide);
  check("walking into a spike -> spike damage predicted", 35, mod.spikeDmgPot);
  check("40 health vs 35 predicted -> not lethal yet, no heal", 0, healCalls);
}

// 18. knocked into a spike: enemy swings from the far side, we land on it.
//     Moving, so novastorm's two knockback blocks — one off velocity, one off
//     position — resolve to different segments and only the position one lands.
{
  healCalls = 0;
  const client = makeClient(withSpikes([ makeSpike(40, 0, 45) ], {
    myPlayer: { tempHealth: 60, tickCount: 100, damageTick: 101 },
    enemies: [ makeEnemy({ x: -60, y: 0, reloaded: [ 0 ], damage: 35 }) ]
  }));
  client.myPlayer.pos.future = new Vec(0, 200);
  client.PlayerManager.enemies[0].pos.future = new Vec(-60, 0);
  const mod = new AntiInsta_default(client);
  mod.postTick();
  check("knockback into a spike -> spike damage", 45, mod.spikeDmgPot);
  check("knockback into a spike -> the swing that sent us there", 35, mod.hitDmgPot);
  check("45 + 35 = 80 >= 60 -> heals", 2, healCalls, `totalDmgPot=${mod.totalDmgPot}`);
  check("canStillGather set by our own knockback setup", true, mod.canStillGather);
}

// 18b. Standing still, both knockback blocks resolve to the same segment and
//      charge the same spike twice. That is novastorm's arithmetic as written —
//      it over-predicts toward healing, and the 140 cap absorbs it.
{
  healCalls = 0;
  const client = makeClient(withSpikes([ makeSpike(40, 0, 45) ], {
    myPlayer: { tempHealth: 60, tickCount: 100, damageTick: 101 },
    enemies: [ makeEnemy({ x: -60, y: 0, reloaded: [ 0 ], damage: 35 }) ]
  }));
  const mod = new AntiInsta_default(client);
  mod.postTick();
  check("stationary: velocity and position blocks both charge", 90, mod.spikeDmgPot);
  check("stationary: and both charge the swing", 70, mod.hitDmgPot);
  check("the sum is still capped at 140", 140, mod.totalDmgPot);
}

// 19. a spike we have been parked next to all game is not incoming damage
{
  healCalls = 0;
  const client = makeClient(withSpikes([ makeSpike(60, 0, 35) ], {
    myPlayer: { tempHealth: 40, tickCount: 100, damageTick: 50 }
  }));
  const mod = new AntiInsta_default(client);
  mod.lastPosX = 0;                       // standing still, nothing landed
  mod.lastPosY = 0;
  mod.postTick();
  check("parked beside a spike -> nothing predicted", 0, mod.spikeDmgPot);
  check("parked beside a spike -> willCollide false", false, mod.willCollide);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
