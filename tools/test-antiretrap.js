/*
 * Getting out of a trap without being put straight back in one is a sequence,
 * so what these check is the sequence: which weapon, which hat, and at what,
 * on each of the two ticks — and that the first tick is aimed at the enemy
 * rather than the trap, which is the whole point of it.
 *
 * The class is lifted out of the client so these fail if it drifts.
 */
const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "src", "RYN_Client_v4.js"), "utf8");

function lift(header) {
  const at = code.indexOf(header);
  if (at === -1) throw new Error(`not found: ${header.trim()}`);
  let end = at, depth = 0, started = false;
  for (; end < code.length; end++) {
    const ch = code[end];
    if (ch === "{") { depth++; started = true; }
    else if (ch === "}") { depth--; if (started && depth === 0) { end++; break; } }
  }
  return code.slice(at, end);
}

class PlayerObject {}
const Settings_default = { _antiRetrap: true };
const DataHandler_default = { getWeapon: () => ({ range: 110 }) };
const RETRAP_SPIKE_MARGIN = 10;

class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  angle(v) { return Math.atan2(v.y - this.y, v.x - this.x); }
}

const AntiRetrap = new Function(
  "PlayerObject", "Settings_default", "DataHandler_default", "RETRAP_SPIKE_MARGIN",
  lift("  class AntiRetrap {") + "\nreturn AntiRetrap;"
)(PlayerObject, Settings_default, DataHandler_default, RETRAP_SPIKE_MARGIN);

/* The trap holding you, an enemy standing over it, and a spike of theirs. */
const TRAP_HEALTH = 200;
const HAMMER_TANKED = 500;   /* one tanked hammer finishes it */
const HAMMER_PLAIN = 150;    /* without the tank it does not */

function makeClient(o = {}) {
  const state = { hat: null, weapon: null, angle: null, attacked: false, active: false };
  const spike = new PlayerObject();
  Object.assign(spike, {
    pos: { current: new Vector(0, 30) },
    collisionScale: 20,
    ownerID: 99,
    getDamage: () => 25
  });
  const objects = o.spike ? [spike] : [];
  const trap = { id: o.trapID ?? 7, pos: { current: new Vector(0, 10) }, health: o.trapHealth ?? TRAP_HEALTH };
  return {
    state,
    trap,
    myPlayer: {
      inGame: true,
      scale: 35,
      pos: { current: new Vector(0, 0) },
      trappedIn: o.trapped === false ? null : trap,
      getItemByType: type => (type === 0 ? 5 : o.secondary ?? 10),
      getBuildingDamage: (id, isTank) => (isTank ? HAMMER_TANKED : HAMMER_PLAIN),
      collidingEntity: (e, range) => new Vector(0, 0).distance(e.pos.current) <= range
    },
    EnemyManager: { nearestEnemy: o.enemy ?? null },
    PlayerManager: { isEnemyByID: id => id === 99 },
    ObjectManager: {
      objects: new Map(objects.map((s, i) => [i, s])),
      grid2D: { query: (x, y, r, cb) => { for (const [id] of objects.entries()) cb(id); } }
    },
    _ModuleHandler: {
      staticModules: { reloading: { isReloaded: t => (o.reloaded ? o.reloaded.includes(t) : true) } },
      hasStoreItem: (type, id) => !(o.missing || []).includes(id),
      set moduleActive(v) { state.active = v; },
      get moduleActive() { return state.active; },
      set forceHat(v) { state.hat = v; },
      get forceHat() { return state.hat; },
      set forceWeapon(v) { state.weapon = v; },
      get forceWeapon() { return state.weapon; },
      set useAngle(v) { state.angle = v; },
      get useAngle() { return state.angle; },
      set shouldAttack(v) { state.attacked = v; },
      get shouldAttack() { return state.attacked; }
    }
  };
}

const enemyAt = (x, y) => ({ pos: { current: new Vector(x, y) }, hitScale: 35, isTrapped: false });

let passed = 0, failed = 0;
function check(name, got, want, eps = 1e-9) {
  const ok = typeof want === "number" ? Math.abs(got - want) <= eps : got === want;
  if (ok) { passed++; console.log(`  PASS  ${name}  (got ${got})`); }
  else { failed++; console.log(`  FAIL  ${name}  (got ${got}, want ${want})`); }
}

const DOWN = Math.PI / 2;   /* the trap sits below you */
const UP = -Math.PI / 2;    /* the enemy above */

console.log("\nthe escape, tick by tick");
{
  const c = makeClient({ enemy: enemyAt(0, -60) });
  const m = new AntiRetrap(c);

  m.postTick();
  check("first tick swings the primary", c.state.weapon, 0);
  check("at the enemy, not the trap", c.state.angle, UP, 1e-9);
  check("wearing samurai for the follow up", c.state.hat, 20);
  check("and it attacks", c.state.attacked, true);

  c.state.active = false;
  m.postTick();
  check("second tick swings the hammer", c.state.weapon, 1);
  check("at the trap", c.state.angle, DOWN, 1e-9);
  check("wearing tank to break it", c.state.hat, 40);

  /* Still held after the hammer means the break did not take, so it starts the
   * cycle over rather than standing there. */
  c.state.active = false;
  m.postTick();
  check("still held, it starts the cycle again", c.state.weapon, 0);
  check("back at the enemy", c.state.angle, UP, 1e-9);
}
{
  /* But once the trap is beyond one hammer again — a fresh one, or a healed
   * estimate — it drops back to plain chipping instead of pushing. */
  const c = makeClient({ enemy: enemyAt(0, -60) });
  const m = new AntiRetrap(c);
  m.postTick();
  c.state.active = false;
  m.postTick();
  c.state.active = false;
  c.trap.health = HAMMER_TANKED + 1;
  m.postTick();
  check("a trap out of one hammer's reach is chipped", c.state.weapon, 1);
  check("aimed at the trap", c.state.angle, DOWN, 1e-9);
}

console.log("\nwhen it refuses to start the escape");
{
  /* Too healthy for one hammer: chip, do not push. */
  const c1 = makeClient({ enemy: enemyAt(0, -60), trapHealth: HAMMER_TANKED + 1 });
  new AntiRetrap(c1).postTick();
  check("a trap it cannot finish is only chipped", c1.state.weapon, 1);
  check("aimed at the trap", c1.state.angle, DOWN, 1e-9);

  /* Nobody there to push. */
  const c2 = makeClient({ enemy: null });
  new AntiRetrap(c2).postTick();
  check("with no enemy it just breaks", c2.state.angle, DOWN, 1e-9);

  /* Out of reach: the push would miss and waste the hammer's tick. */
  const c3 = makeClient({ enemy: enemyAt(0, -400) });
  new AntiRetrap(c3).postTick();
  check("an enemy out of reach is not pushed", c3.state.angle, DOWN, 1e-9);

  /* Already trapped themselves: they cannot retrap you, so skip the push. */
  const c4 = makeClient({ enemy: { ...enemyAt(0, -60), isTrapped: true } });
  new AntiRetrap(c4).postTick();
  check("a trapped enemy needs no pushing", c4.state.angle, DOWN, 1e-9);

  /* No hammer: the finisher does not exist. */
  const c5 = makeClient({ enemy: enemyAt(0, -60), secondary: 9 });
  new AntiRetrap(c5).postTick();
  check("without a hammer it swings the primary at the trap", c5.state.weapon, 0);
  check("aimed at the trap", c5.state.angle, DOWN, 1e-9);

  /* The primary is still on reload, so the push cannot happen this tick. */
  const c6 = makeClient({ enemy: enemyAt(0, -60), reloaded: [1] });
  new AntiRetrap(c6).postTick();
  check("a primary on reload does not start it", c6.state.angle, DOWN, 1e-9);
}

console.log("\nthe hat while you are held");
{
  const c1 = makeClient({ enemy: null, spike: true, trapHealth: HAMMER_TANKED + 1 });
  new AntiRetrap(c1).postTick();
  check("a spike in reach puts soldier on", c1.state.hat, 6);

  const c2 = makeClient({ enemy: null, trapHealth: HAMMER_TANKED + 1 });
  new AntiRetrap(c2).postTick();
  check("with none it takes tank instead", c2.state.hat, 40);

  const c3 = makeClient({ enemy: null, spike: true, trapHealth: HAMMER_TANKED + 1, missing: [6] });
  new AntiRetrap(c3).postTick();
  check("soldier you do not own falls back to tank", c3.state.hat, 40);

  const c4 = makeClient({ enemy: enemyAt(0, -60), missing: [20] });
  new AntiRetrap(c4).postTick();
  check("samurai you do not own still pushes", c4.state.weapon, 0);
  check("bare headed", c4.state.hat, null);
}

console.log("\nit lets go when it should");
{
  const c1 = makeClient({ trapped: false, enemy: enemyAt(0, -60) });
  new AntiRetrap(c1).postTick();
  check("free of the trap it does nothing", c1.state.active, false);

  Settings_default._antiRetrap = false;
  const c2 = makeClient({ enemy: enemyAt(0, -60) });
  new AntiRetrap(c2).postTick();
  check("switched off it does nothing", c2.state.active, false);
  Settings_default._antiRetrap = true;

  /* Pushed, then dragged into a different trap before the hammer landed: the
   * half finished sequence must not swing at the old trap's angle. */
  const c3 = makeClient({ enemy: enemyAt(0, -60) });
  const m3 = new AntiRetrap(c3);
  m3.postTick();
  check("the push went out", m3._phase, 1);
  c3.state.active = false;
  c3.myPlayer.trappedIn = { id: 99, pos: { current: new Vector(50, 0) }, health: TRAP_HEALTH };
  m3.postTick();
  /* The half finished sequence belonged to the old trap. It must not swing the
   * hammer at where that one was; it starts again on the new one. */
  check("it does not finish the old trap's sequence", c3.state.weapon, 0);
  check("the sequence now belongs to the new trap", m3._trapID, 99);
  check("and the push is aimed at the enemy, not the old trap", c3.state.angle, UP, 1e-9);
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
