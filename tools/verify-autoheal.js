#!/usr/bin/env node
/*
 * verify-autoheal.js
 *
 * Exercises the Auto Heal system in Ryn_Type_2.user.js against the scenarios
 * it exists to survive: lethal damage, the 120ms shame window, the packet
 * budget, the hat-priority ladder, and each anti system ported from
 * novastorm 1.4.
 *
 * It does not re-implement any of that. The constants, the AutoHealCore class
 * and ModuleHandler's heal()/requestHat() are sliced out of the userscript
 * verbatim and run against stubbed wire primitives, so a change to the client
 * shows up here as a failing scenario rather than as a passing copy.
 *
 *   node tools/verify-autoheal.js [path/to/Ryn_Type_2.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Ryn_Type_2.user.js");

const src = fs.readFileSync(CLIENT_PATH, "utf8");

/* Pull a source range out of the client by its start and end markers. */
function slice(startMarker, endMarker, inclusive = true) {
  const i = src.indexOf(startMarker);
  if (i < 0) throw new Error("verify-autoheal: missing marker: " + startMarker.slice(0, 48));
  const j = src.indexOf(endMarker, i);
  if (j < 0) throw new Error("verify-autoheal: missing end marker: " + endMarker.slice(0, 48));
  return src.slice(i, inclusive ? j + endMarker.length : j);
}

const P = {
  consts: slice("  // ==========================================================================\n  // AUTO HEAL", "  const AutoHealCore_default = AutoHealCore;\n"),
  hats: slice("  const Hats = {", "  const store = [ Hats, Accessories ];\n"),
  items: slice("  const Items = [ {", "  const WeaponVariants = [ {", false),
  weapons: slice("  const Weapons = [ {", "  const ItemGroups = {", false),
  projectiles: slice("  const Projectiles = [ {", "  class Vector {", false),
  datahandler: slice("  const DataHandler = new class {", "  const DataHandler_default = DataHandler;\n"),
  heal: slice("    // The game's shame window is 120ms", "    circleOffset=0;\n", false),
  requestHat: slice("    get forceHat() {", "    getHatStore() {", false)
};

const H = new Function(`
  const WeaponTypeString = [ "primary", "secondary" ];
  ${P.weapons}
  ${P.projectiles}
  ${P.items}
  ${P.hats}
  ${P.datahandler}
  const Settings_default = { _autoheal: true, _antiSmartTick: false };
  class Vector_default { constructor(x,y){this.x=x;this.y=y;} distance(v){return Math.hypot(this.x-v.x,this.y-v.y);} }
  class PlayerObject {}
  ${P.consts}

  /* The real ModuleHandler heal/hat code, spliced in verbatim. Only the wire
     primitives are stubbed, so each frame they would send is counted the way
     PacketManager counts it. */
  class TestModuleHandler {
    constructor(client){ this.client = client; this.staticModules = {}; this.tickCount = 0;
      this.healedOnce = false; this.didAntiInsta = false; this.shouldAttack = false;
      this.shouldEquipSoldier = false; this.moduleActive = false; this.forceWeapon = null;
      this.useHat = null; this.currentType = null; this.packetLimit = 119; this.rawHeals = 0;
      this._forceHat = null; this._forceHatPriority = 0; this._forceHatReason = null;
      this._packetCount = 0; this._bought = new Set([0,6,7,53,40,12]); }
    get packetCount(){ return this._packetCount; }
    canBuy(type, id){ return type === 0 && this._bought.has(id); }
    selectItem(t){ if (t === 2) this.rawHeals += 1; this._packetCount += 1; }
    attack(){ this._packetCount += 1; }
    whichWeapon(){ this._packetCount += 1; }
    _getPredictWeapon(){ return 0; }
${P.requestHat}
${P.heal}
  }
  return { AutoHealCore, TestModuleHandler, Hats, Items, Settings_default, AH_THREAT, HAT_PRIORITY, AH_SHAME_MAX };
`)();

const {AutoHealCore, TestModuleHandler, AH_THREAT, HAT_PRIORITY, Settings_default} = H;

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('  PASS', label); }
  else { fail++; console.log('  FAIL', label, 'got', JSON.stringify(got), 'want', JSON.stringify(want)); }
};

function makeClient(o = {}) {
  const now = Date.now();
  const myPlayer = Object.assign({
    inGame: true, isSandbox: false, hatID: 0, accessoryID: 0,
    tempHealth: 100, maxHealth: 100, currentHealth: 100,
    shameActive: false, shameCount: 0, poisonCount: 0, isDmgOverTime: false,
    receivedDamage: null, damageTick: 0, tickCount: 10, bullTick: 0,
    isTrapped: false, trappedIn: null, trappedInPrev: null, spikeDamage: 0,
    canUseTurret: true,
    pos: { current: {x:0,y:0,distance(v){return Math.hypot(this.x-v.x,this.y-v.y);}},
           future:  {x:0,y:0,distance(v){return Math.hypot(this.x-v.x,this.y-v.y);}} },
    getItemByType(t){ return t === 2 ? 0 : 0; },          // apple
    isBullTickTime(adj = 0){ return (this.tickCount - this.bullTick - adj) % 9 === 0; },
    wasTrapped(){ return this.trappedIn === null && this.trappedInPrev !== null; },
    collidingEntity(e, r){ return this.pos.current.distance(e.pos.current) <= r; }
  }, o.myPlayer || {});

  const EnemyManager = Object.assign({
    potentialDamage: 0, potentialSpikeDamage: 0, collidingSpike: false,
    willCollideSpike: false, possibleToKnockback: false, detectedEnemy: false,
    detectedDangerEnemy: false, dangerWithoutSoldier: false,
    rangedBowInsta: false, reverseInsta: false, toolHammerInsta: false,
    nearestEnemy: null, instaThreat(){ return false; }
  }, o.EnemyManager || {});

  const client = {
    myPlayer, EnemyManager,
    SocketManager: { pong: 40 },
    PlayerManager: { lookingShield(){ return false; } },
    ObjectManager: {}, ProjectileManager: {}
  };
  const MH = new TestModuleHandler(client);
  client._ModuleHandler = MH;
  const core = new AutoHealCore(client);
  MH.staticModules.autoHeal = core;
  MH.staticModules.autoHat = { getNextHat(){ return MH.forceHat !== null ? MH.forceHat : MH.useHat !== null ? MH.useHat : myPlayer.hatID; } };
  MH.staticModules.reloading = { isReloaded(){ return true; } };
  return {client, MH, core, myPlayer, EnemyManager};
}

function makeEnemy(o = {}) {
  return Object.assign({
    hatID: 0, spikeDamage: 0,
    weapon: { primary: 5, secondary: 15 },       // polearm + musket
    pos: { current:{x:0,y:0,distance(v){return Math.hypot(this.x-v.x,this.y-v.y);}},
           future:{x:0,y:0,distance(v){return Math.hypot(this.x-v.x,this.y-v.y);}} },
    isReloaded(){ return true; },
    isEmptyReload(){ return false; },
    getMaxWeaponDamage(id, shield, addBull = true){
      if (id === 5) return 45 * (addBull ? 1.5 : 1);
      if (id === 15) return 50;
      if (id === 10) return 10 * (addBull ? 1.5 : 1);
      return 0;
    },
    getWeaponRange(){ return 142 + 35; }
  }, o);
}
const at = (e, x, y) => { e.pos.current.x = x; e.pos.current.y = y; e.pos.future.x = x; e.pos.future.y = y; return e; };

// -------------------------------------------------------------------------
console.log('\n1. maxHealth is real, so the heal arithmetic is not NaN');
{
  const {MH, core, myPlayer} = makeClient({myPlayer:{tempHealth: 55, damageTick: 0, tickCount: 10}});
  myPlayer.receivedDamage = Date.now() - 5000;
  core.postTick();
  eq('apples sent to refill 45hp with a 20hp apple', MH.rawHeals, 3);
}

console.log('\n2. Emergency: lethal damage heals even inside the shame window');
{
  const {MH, core, myPlayer, EnemyManager} = makeClient({myPlayer:{tempHealth: 40}, EnemyManager:{potentialDamage: 90}});
  myPlayer.receivedDamage = Date.now();     // hit right now -> inside 120ms
  myPlayer.damageTick = myPlayer.tickCount + 1;
  core.postTick();
  eq('emergency ignores the shame queue', MH.rawHeals, 3);
  eq('flagged as forced heal', core.forceHeal, true);
  eq('threat level CRITICAL', core.decision.level, AH_THREAT.CRITICAL);
  eq('soldier requested at CRITICAL rank', [MH.forceHat, MH._forceHatPriority], [6, HAT_PRIORITY.CRITICAL]);
}

console.log('\n3. Routine top-up inside the shame window is queued, not sent');
{
  const {MH, core, myPlayer} = makeClient({myPlayer:{tempHealth: 90}});
  myPlayer.receivedDamage = Date.now();
  myPlayer.damageTick = myPlayer.tickCount + 1;
  core.postTick();
  eq('nothing on the wire', MH.rawHeals, 0);
  eq('nothing queued either (isSaveHeal blocked it)', MH._shameHealQueue, 0);
}

console.log('\n4. Routine top-up after the window goes out');
{
  const {MH, core, myPlayer} = makeClient({myPlayer:{tempHealth: 90}});
  myPlayer.receivedDamage = Date.now() - 400;
  myPlayer.damageTick = 0; myPlayer.tickCount = 10;
  core.postTick();
  eq('one apple', MH.rawHeals, 1);
}

console.log('\n5. shameCount 7 refuses the emergency, novastorm rule');
{
  const {MH, core, myPlayer, EnemyManager} = makeClient({myPlayer:{tempHealth: 40, shameCount: 7}, EnemyManager:{potentialDamage: 90}});
  myPlayer.receivedDamage = Date.now();
  myPlayer.damageTick = myPlayer.tickCount + 1;
  core.postTick();
  eq('no apple at shame 7 inside the window', MH.rawHeals, 0);
}

console.log('\n6. In-flight ledger: the same missing health is not paid for twice');
{
  const {MH, core, myPlayer} = makeClient({myPlayer:{tempHealth: 40}});
  myPlayer.receivedDamage = Date.now() - 400;
  core.postTick();
  const first = MH.rawHeals;
  MH.tickCount += 1; myPlayer.tickCount += 1;
  core.postTick();                                    // health has not moved yet
  eq('first tick sends 3', first, 3);
  eq('second tick sends nothing more', MH.rawHeals, 3);
}

console.log('\n7. Packet budget: routine heals stop before the emergency reserve');
{
  const {MH, core, myPlayer} = makeClient({myPlayer:{tempHealth: 80}});
  myPlayer.receivedDamage = Date.now() - 400;
  MH._packetCount = 119 - 17;                          // reserve is 5 apples * 3 = 15
  core.postTick();
  eq('routine refused with only 17 left', MH.rawHeals, 0);
  MH._packetCount = 119 - 18;
  core.postTick();
  eq('routine allowed at 18', MH.rawHeals, 1);
}
console.log('\n8. Packet budget: an emergency may spend into the reserve');
{
  const {MH, core, myPlayer, EnemyManager} = makeClient({myPlayer:{tempHealth: 40}, EnemyManager:{potentialDamage: 90}});
  myPlayer.receivedDamage = Date.now();
  myPlayer.damageTick = myPlayer.tickCount + 1;
  MH._packetCount = 119 - 9;
  core.postTick();
  eq('three apples fit in nine packets', MH.rawHeals, 3);
  eq('limit never exceeded', MH.packetCount <= MH.packetLimit, true);
}

console.log('\n9. Hat arbiter: combat cannot displace CRITICAL, and can displace shame');
{
  const {MH} = makeClient();
  MH.requestHat(6, HAT_PRIORITY.CRITICAL, 'autoHeal');
  MH.forceHat = 53;                                    // a combat module writes
  eq('soldier survives the combat write', MH.forceHat, 6);
  MH.requestHat(null);
  MH.requestHat(7, HAT_PRIORITY.SHAME, 'autoHeal:shame');
  MH.forceHat = 53;
  eq('combat beats shame recovery', MH.forceHat, 53);
  MH.requestHat(6, HAT_PRIORITY.CRITICAL, 'autoHeal');
  eq('critical beats combat', MH.forceHat, 6);
}

console.log('\n10. Shame recovery: bull hat only when nothing is happening');
{
  const {MH, core, myPlayer} = makeClient({myPlayer:{shameCount: 3, tempHealth: 100}});
  core.postTick();
  eq('bull requested at SHAME rank', [MH.forceHat, MH._forceHatPriority], [7, HAT_PRIORITY.SHAME]);
  eq('level is SHAME', core.decision.level, AH_THREAT.SHAME);
}
{
  const {MH, core} = makeClient({myPlayer:{shameCount: 3}, EnemyManager:{potentialDamage: 20}});
  core.postTick();
  eq('no bull while an enemy can hit me', MH.forceHat, null);
  eq('level is HIGH_DAMAGE', core.decision.level, AH_THREAT.HIGH_DAMAGE);
}
console.log('\n11. Shame recovery holds through its own bull tick');
{
  const {MH, core, myPlayer, EnemyManager} = makeClient({myPlayer:{shameCount: 3, hatID: 7, tickCount: 9, bullTick: 0}});
  EnemyManager.potentialDamage = 5;                     // EnemyManager banks the regen tick
  core.postTick();
  eq('bull stays on through the self-damage tick', MH.forceHat, 7);
}
console.log('\n12. Shame recovery ends the moment the count is zero');
{
  const {MH, core} = makeClient({myPlayer:{shameCount: 0}});
  core.postTick();
  eq('no bull at shame 0', MH.forceHat, null);
  eq('level NONE', core.decision.level, AH_THREAT.NONE);
}

console.log('\n13. Anti Velocity Tick: turret-gear enemy closing at 250px');
{
  const {core, MH, EnemyManager} = makeClient({myPlayer:{tempHealth: 100}});
  const e = at(makeEnemy({hatID: 53, isReloaded(t){ return t !== 2; }}), 250, 0);
  EnemyManager.nearestEnemy = e;
  core.beginScan(); core.observeEnemy(e); core._buildThreat();
  eq('turret 25 + polearm 67.5 banked', core.threat.velocityTick, 25 + 67.5);
  core.postTick();
  eq('threat level PROJECTILE or better', core.decision.level >= AH_THREAT.PROJECTILE, true);
}
console.log('\n14. Anti Velocity Tick does not fire outside 150-350');
{
  const {core, EnemyManager} = makeClient();
  const e = at(makeEnemy({hatID: 53, isReloaded(t){ return t !== 2; }}), 500, 0);
  EnemyManager.nearestEnemy = e;
  core.beginScan(); core.observeEnemy(e); core._buildThreat();
  eq('nothing at 500px', core.threat.velocityTick, 0);
}

console.log('\n15. Anti Normal Instakill: musket at 300px once they are hitting me');
{
  const {core, myPlayer, EnemyManager} = makeClient();
  myPlayer.damageTick = myPlayer.tickCount;             // hit this tick
  const e = at(makeEnemy({isReloaded(){ return true; }}), 300, 0);
  EnemyManager.nearestEnemy = e;
  core.beginScan(); core.observeEnemy(e); core._buildThreat();
  eq('turret 25 + musket 50 (bundle value, not novastorm 50/15)', core.threat.ranged, 75);
}
console.log('\n16. ...and not before they have touched me');
{
  const {core, myPlayer, EnemyManager} = makeClient();
  myPlayer.damageTick = 0; myPlayer.tickCount = 10;
  const e = at(makeEnemy(), 300, 0);
  EnemyManager.nearestEnemy = e;
  core.beginScan(); core.observeEnemy(e); core._buildThreat();
  eq('quiet at 300px', core.threat.ranged, 0);
}

console.log('\n17. Anti Spike Tick: sustained spike-tick threat raises soldier');
{
  const {core, MH, myPlayer, EnemyManager} = makeClient({myPlayer:{tempHealth: 100}});
  const e = at(makeEnemy({spikeDamage: 45}), 100, 0);
  EnemyManager.nearestEnemy = e;
  core.beginScan(); core.observeEnemy(e);
  eq('spikeTickAnti raised (45 + 67.5 >= 100)', core._scan.spikeTickAnti, true);
  core.postTick();
  eq('soldier at SPIKE_TICK rank', [MH.forceHat, MH._forceHatPriority], [6, HAT_PRIORITY.SPIKE_TICK]);
}

console.log('\n18. Damage cap and the soldier multiplier use the hat being put on');
{
  const {core, MH, myPlayer, EnemyManager} = makeClient({myPlayer:{tempHealth: 80, hatID: 0}});
  EnemyManager.potentialDamage = 200;
  core.postTick();
  eq('capped at 140', core.threat.total, 140);
  eq('soldier on', MH.forceHat, 6);
  eq('healed', MH.rawHeals > 0, true);
}

console.log('\n19. Auto Heal off: no hat, no food, no shame work');
{
  Settings_default._autoheal = false;
  const {MH, core, myPlayer} = makeClient({myPlayer:{tempHealth: 40, shameCount: 3}});
  myPlayer.receivedDamage = Date.now() - 400;
  core.postTick();
  eq('nothing sent', MH.rawHeals, 0);
  eq('no hat requested', MH.forceHat, null);
  Settings_default._autoheal = true;
}
console.log('\n20. Shamed (30s ban): stop spending food entirely');
{
  const {MH, core, myPlayer} = makeClient({myPlayer:{tempHealth: 40, shameActive: true}});
  myPlayer.receivedDamage = Date.now() - 400;
  core.postTick();
  eq('nothing sent while shamed', MH.rawHeals, 0);
}


// appended: full shame recovery cycle
console.log('\n21. Shame recovery cycle: 7 -> 0 without ever eating inside the window');
{
  const {MH, core, myPlayer} = makeClient({myPlayer:{shameCount: 7, tempHealth: 100, tickCount: 0, bullTick: 0}});
  let insideWindowEats = 0, apples = 0, lastRawHeals = 0;
  const realRawHeal = MH._rawHeal ? null : null;
  let now = 1000000;
  const RealDate = Date.now;
  Date.now = () => now;
  let hitAt = null;
  for (let tick = 0; tick < 120 && myPlayer.shameCount > 0; tick++) {
    myPlayer.tickCount = tick; MH.tickCount = tick;
    MH._packetCount = 0;                     // fresh second, budget is not the subject here
    MH.requestHat(null); MH.moduleActive = false;
    // bull regen: -5 every 9 ticks while the hat is on
    if (myPlayer.hatID === 7 && tick > 0 && tick % 9 === 0) {
      myPlayer.tempHealth -= 5;
      myPlayer.previousHealth = myPlayer.tempHealth + 5;
      myPlayer.receivedDamage = now; hitAt = now;
      myPlayer.damageTick = tick + 1;
      myPlayer.isDmgOverTime = true;
      core.healthUpdate();
      myPlayer.isDmgOverTime = false;
    }
    core.postTick();
    if (MH.rawHeals > lastRawHeals) {
      const n = MH.rawHeals - lastRawHeals; lastRawHeals = MH.rawHeals; apples += n;
      // server side: first apple after a hit moves shame
      if (hitAt !== null) {
        if (now - hitAt <= 120) { myPlayer.shameCount += 1; insideWindowEats++; }
        else myPlayer.shameCount = Math.max(0, myPlayer.shameCount - 2);
        hitAt = null; myPlayer.receivedDamage = null;
      }
      myPlayer.tempHealth = Math.min(100, myPlayer.tempHealth + 20 * n);
    }
    // the hat the arbiter settled on becomes the hat worn next tick
    myPlayer.hatID = MH.forceHat !== null ? MH.forceHat : myPlayer.hatID;
    now += 111;
  }
  Date.now = RealDate;
  eq('shame reached zero', myPlayer.shameCount, 0);
  eq('never ate inside the 120ms window', insideWindowEats, 0);
  eq('apples spent (one per -2)', apples, 4);
}
console.log('\n22. requestHat(null) clears the rank as well as the hat');
{
  const {MH} = makeClient();
  MH.requestHat(6, HAT_PRIORITY.CRITICAL, 'x');
  MH.requestHat(null);
  MH.forceHat = 53;
  eq('a combat write lands again after the reset', MH.forceHat, 53);
}
console.log(`\nfinal: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
