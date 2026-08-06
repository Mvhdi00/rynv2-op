/*
 * Spike tick decides one thing: is this a kill, right now, and does it need the
 * bull helmet to be one. Everything else follows from that answer, so that is
 * what these check — with the four things it used to leave out each isolated,
 * so a regression names itself.
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
const Settings_default = { _spikeTick: true };
const DataHandler_default = { getWeapon: () => ({ range: 110 }) };
const SPIKE_TICK_TURRET = 25;

class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  angle(v) { return Math.atan2(v.y - this.y, v.x - this.x); }
}

const SpikeTick = new Function(
  "PlayerObject", "Settings_default", "DataHandler_default", "SPIKE_TICK_TURRET",
  lift("  class SpikeTick {") + "\nreturn SpikeTick;"
)(PlayerObject, Settings_default, DataHandler_default, SPIKE_TICK_TURRET);

const PLAIN = 40;   /* a primary hit */
const BULL = 60;    /* the same hit under the bull helmet */

const spike = (x, y, damage = 20, ownerID = 99) => {
  const o = new PlayerObject();
  return Object.assign(o, {
    itemGroup: 2, ownerID,
    pos: { current: new Vector(x, y) },
    getDamage: () => damage
  });
};

function makeClient(o = {}) {
  const state = { hat: null, weapon: null, angle: null, attacked: false, active: false };
  const objects = o.objects || [];
  const at = (x, y, health, extra = {}) => ({
    id: extra.id ?? 1,
    currentHealth: health,
    hitScale: 35,
    speed: extra.speed ?? 0,
    pos: { current: new Vector(x, y), future: new Vector(x, y) },
    collidingObject: obj => new Vector(x, y).distance(obj.pos.current) <= 50,
    ...extra
  });
  return {
    state, at,
    myPlayer: {
      pos: { current: new Vector(0, 0), future: new Vector(0, 0) },
      getItemByType: () => 5,
      getMaxWeaponDamage: (id, shielded, bull) => (bull ? BULL : PLAIN) * (shielded ? 0.2 : 1),
      collidingEntity: (t, range) => new Vector(0, 0).distance(t.pos.current) <= range
    },
    EnemyManager: { nearestEnemy: o.enemy ?? null, nearestLowEntity: o.low ?? null },
    PlayerManager: {
      isEnemyByID: id => {
        if (id === 404) throw new Error("owner gone");
        return id === 99;
      },
      lookingShield: () => o.shielded === true
    },
    ObjectManager: {
      objects: new Map(objects.map((s, i) => [i, s])),
      grid2D: { query: (x, y, r, cb) => { for (const [id] of objects.entries()) cb(id); } }
    },
    _ModuleHandler: {
      staticModules: { reloading: { isReloaded: t => (o.reloaded ? o.reloaded.includes(t) : true) } },
      canBuy: (type, id) => !(o.missing || []).includes(id),
      set moduleActive(v) { state.active = v; },
      get moduleActive() { return o.busy === true || state.active; },
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

let passed = 0, failed = 0;
function check(name, got, want, eps = 1e-9) {
  const ok = typeof want === "number" ? Math.abs(got - want) <= eps : got === want;
  if (ok) { passed++; console.log(`  PASS  ${name}  (got ${got})`); }
  else { failed++; console.log(`  FAIL  ${name}  (got ${got}, want ${want})`); }
}

console.log("\nthe hazard they are standing on");
{
  /* 55 health is out of a plain hit and out of a bull hit. Standing on a
   * 20 damage spike brings it inside a plain one. */
  const c = makeClient({ objects: [spike(60, 0)] });
  const target = c.at(60, 0, 55);
  const m = new SpikeTick(makeClient({ objects: [spike(60, 0)], enemy: target }));
  check("their spike counts toward the kill", m._touchingDamage(target), 20);
  check("so a hit that would not have killed does", m._kills(target, false), false);

  const bare = new SpikeTick(makeClient({ enemy: target }));
  check("without it the same target is out of reach of a plain hit", bare._kills(target, false), true);
  check("and worth the bull helmet", bare._kills(c.at(60, 0, 55), false), true);
}
{
  /* Their own spike does not hurt them, so it must not be counted. */
  const own = spike(60, 0, 20, 7);
  const c = makeClient({ objects: [own] });
  const target = c.at(60, 0, 55, { id: 7 });
  const m = new SpikeTick(makeClient({ objects: [own], enemy: target }));
  check("their own spike counts for nothing", m._touchingDamage(target), 0);

  /* An object whose owner has left view must not throw out of the tick. */
  const orphan = spike(60, 0, 20, 404);
  const m2 = new SpikeTick(makeClient({ objects: [orphan], enemy: target }));
  let threw = false;
  try { m2._touchingDamage(target); } catch (e) { threw = true; }
  check("an owner out of view does not throw", threw, false);
}

console.log("\nthe turret, the shield");
{
  const c = makeClient({});
  const target = c.at(60, 0, 60);
  const withTurret = new SpikeTick(makeClient({ enemy: target }));
  check("the turret's shot counts", withTurret._kills(target, true), false);
  check("and without counting it, the same target needs the bull", withTurret._kills(target, false), true);

  const noTurret = new SpikeTick(makeClient({ enemy: target, missing: [53] }));
  check("a turret you do not own counts for nothing", noTurret._kills(target, true), true);

  const onCooldown = new SpikeTick(makeClient({ enemy: target, reloaded: [0, 1] }));
  check("nor one still reloading", onCooldown._kills(target, true), true);

  const shielded = new SpikeTick(makeClient({ enemy: c.at(60, 0, 30), shielded: true }));
  check("a raised shield is not swung into", shielded._kills(c.at(60, 0, 30), false), null);
}

console.log("\nplayers before animals");
{
  const c = makeClient({});
  const player = c.at(60, 0, 30, { id: 1 });
  const cow = c.at(20, 0, 10, { id: 2 });
  const m = new SpikeTick(makeClient({ enemy: player, low: cow }));
  check("the player is taken over the nearer animal", m._target().id, 1);

  /* A player it cannot finish steps aside for the animal it can. */
  const tank = c.at(60, 0, 900, { id: 1 });
  const m2 = new SpikeTick(makeClient({ enemy: tank, low: cow }));
  check("a player it cannot kill hands over to the animal", m2._target().id, 2);

  /* A player only the turret finishes still has to be picked. Asking a
   * narrower question when choosing the target than when deciding to swing
   * dropped exactly these — 60 health is past a bull hit on its own, and
   * inside a plain one once the turret's 25 comes off. */
  const turretOnly = c.at(60, 0, 60, { id: 1 });
  const m3 = new SpikeTick(makeClient({ enemy: turretOnly, low: cow }));
  check("a target only the turret finishes is still taken", m3._target().id, 1);
}

console.log("\nreach, and when it swings");
{
  const c = makeClient({});
  const still = c.at(150, 0, 30, { speed: 0 });
  const running = c.at(150, 0, 30, { speed: 20 });
  const m = new SpikeTick(makeClient({ enemy: still }));
  check("just out of reach and standing still is left alone", m._reaches(still), false);
  check("the same distance while closing is taken", m._reaches(running), true);
}
{
  const c = makeClient({ enemy: null });
  const target = c.at(60, 0, 30);
  const client = makeClient({ enemy: target });
  new SpikeTick(client).postTick();
  check("it swings the primary", client.state.weapon, 0);
  check("it attacks", client.state.attacked, true);
  check("bare headed when a plain hit is enough", client.state.hat, null);

  /* 80 health, less the turret's 25, is 55: past a plain hit and inside a
   * bull one, so this is the case the helmet exists for. */
  const hard = makeClient({ enemy: c.at(60, 0, 80) });
  new SpikeTick(hard).postTick();
  check("the bull goes on only when it changes the answer", hard.state.hat, 7);

  const far = makeClient({ enemy: c.at(900, 0, 30) });
  new SpikeTick(far).postTick();
  check("nothing out of reach", far.state.attacked, false);

  const busy = makeClient({ enemy: target, busy: true });
  new SpikeTick(busy).postTick();
  check("it yields to a module already holding the tick", busy.state.attacked, false);

  const reloading = makeClient({ enemy: target, reloaded: [1, 2] });
  new SpikeTick(reloading).postTick();
  check("and to its own reload", reloading.state.attacked, false);

  Settings_default._spikeTick = false;
  const off = makeClient({ enemy: target });
  new SpikeTick(off).postTick();
  check("switched off it does nothing", off.state.attacked, false);
  Settings_default._spikeTick = true;
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
