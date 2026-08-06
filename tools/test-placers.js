/*
 * The two placers, checked against geometry rather than against themselves.
 *
 * The pre-placer's claim: the arc it computes is exactly the span in which an
 * item would touch an object, and the angle it picks lands inside the doomed
 * building while clearing every other one.
 *
 * The replacer's claim: once a building is gone, the angles it offers are free,
 * ordered by closeness to the direction that matters, and which item it reaches
 * for follows the state of the fight.
 *
 * Both classes are lifted out of the client so these fail if the real ones
 * drift. Everything they touch — the item table, the player, the object grid,
 * the packet budget — is stubbed at the shape the client uses.
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

const PI = Math.PI;
const getAngleDist = (a, b) => {
  const p = Math.abs(b - a) % (PI * 2);
  return p > PI ? PI * 2 - p : p;
};
const findPlacementAngles = new Function(
  "getAngleDist",
  lift("  const findPlacementAngles = angles => {").replace("  const findPlacementAngles = ", "return ")
)(getAngleDist);

/* ---- the world the classes read from ---- */
const SPIKE = 7, TRAP = 15;
const Items = { [SPIKE]: { scale: 35, placeOffset: -5 }, [TRAP]: { scale: 32, placeOffset: -5 } };
const PLAYER_SCALE = 35;
const PREPLACE_EPSILON = 1e-6;
const pointInRiver = () => false;
class PlayerObject {}
const Sorting_default = { byAngleDistance: angle => (a, b) => getAngleDist(a, angle) - getAngleDist(b, angle) };
const DataHandler_default = { isMelee: id => id != null, getWeapon: () => ({ range: 110 }) };

class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  angle(v) { return Math.atan2(v.y - this.y, v.x - this.x); }
  addDirection(a, len) { return new Vector(this.x + Math.cos(a) * len, this.y + Math.sin(a) * len); }
}

const Settings_default = { _prePlace: true, _prePlaceHits: 4, _prePlaceSpike: true, _replace: true };

const [PrePlacer, Replacer] = new Function(
  "PI", "Items", "PREPLACE_EPSILON", "PREPLACE_RANGE", "REPLACE_RANGE", "pointInRiver",
  "PlayerObject", "getAngleDist", "findPlacementAngles", "Sorting_default",
  "Settings_default", "DataHandler_default",
  [lift("  class PlacementGeometry {"),
   lift("  class PrePlacer extends PlacementGeometry {"),
   lift("  class Replacer extends PlacementGeometry {"),
   "return [PrePlacer, Replacer];"].join("\n")
)(PI, Items, PREPLACE_EPSILON, 270, 300, pointInRiver, PlayerObject, getAngleDist,
  findPlacementAngles, Sorting_default, Settings_default, DataHandler_default);

/* A building, and a client stub whose placements are recorded rather than sent. */
const building = (x, y, scale, extra = {}) => {
  const o = new PlayerObject();
  Object.assign(o, {
    pos: { current: new Vector(x, y) },
    placementScale: scale,
    isDestroyable: true,
    ownerID: 1,
    health: 100,
    ...extra
  });
  return o;
};

function makeClient(options = {}) {
  const placed = [];
  const objects = options.objects || [];
  return {
    placed,
    myPlayer: {
      inGame: true,
      pos: { current: new Vector(0, 0), future: new Vector(0, 0) },
      trappedIn: options.trappedIn ?? null,
      getItemPlaceScale: id => PLAYER_SCALE + Items[id].scale + Items[id].placeOffset,
      getItemByType: type => (type === 4 ? SPIKE : type === 7 ? TRAP : 0),
      canPlace: () => options.canPlace !== false
    },
    EnemyManager: { nearestEnemy: options.enemy ?? null },
    PlayerManager: { isEnemyByID: id => id === 99 },
    _ModuleHandler: {
      tickCount: 1,
      moduleActive: false,
      packetCount: options.packetCount ?? 0,
      packetLimit: 70,
      staticModules: {},
      place: (type, angle) => placed.push([type, angle])
    },
    ObjectManager: {
      objects: new Map(objects.map((o, i) => [i, o])),
      grid2D: { query: (x, y, r, cb) => { for (const [id] of objects.entries()) cb(id); } }
    }
  };
}

let passed = 0, failed = 0;
function check(name, got, want, eps = 1e-9) {
  const ok = typeof want === "number" && isFinite(want) ? Math.abs(got - want) <= eps : got === want;
  if (ok) { passed++; console.log(`  PASS  ${name}  (got ${typeof got === "number" ? got.toFixed(6) : got})`); }
  else { failed++; console.log(`  FAIL  ${name}  (got ${got}, want ${want})`); }
}

const geo = new PrePlacer(makeClient());
const REACH = PLAYER_SCALE + Items[SPIKE].scale + Items[SPIKE].placeOffset;
const placeAt = (from, angle) => from.addDirection(angle, REACH);
const ORIGIN = new Vector(0, 0);

console.log("\nthe arc is exactly where the item would touch");
{
  const target = building(140, 0, 40);
  const [center, offset] = geo._arc(ORIGIN, SPIKE, target);
  check("it is centred on the object", center, 0);
  const touching = Items[SPIKE].scale + target.placementScale + 1;
  check("at the edge the item just touches",
    placeAt(ORIGIN, offset).distance(target.pos.current), touching, 1e-6);
  check("a hair outside the arc it is clear",
    placeAt(ORIGIN, offset + 1e-3).distance(target.pos.current) > touching, true);
  check("a hair inside the arc it overlaps",
    placeAt(ORIGIN, offset - 1e-3).distance(target.pos.current) < touching, true);
  check("an object out of reach blocks nothing", geo._arc(ORIGIN, SPIKE, building(900, 0, 40)), null);
  check("an object swallowing you blocks everything", geo._arc(ORIGIN, SPIKE, building(5, 0, 200))[1], PI);
}

console.log("\nthe pre-placer's angle");
{
  const doomed = building(REACH, 0, 40);
  const blocker = building(REACH * Math.cos(0.5), REACH * Math.sin(0.5), 40);
  const angle = geo._angleFor(ORIGIN, SPIKE, doomed, [doomed, blocker], 0);
  const doomedArc = geo._arc(ORIGIN, SPIKE, doomed);
  const blockerArc = geo._arc(ORIGIN, SPIKE, blocker);
  check("it found one", angle !== null, true);
  check("it lands inside the doomed building",
    getAngleDist(angle, doomedArc[0]) <= doomedArc[1] + PREPLACE_EPSILON, true);
  check("it clears the other building",
    blockerArc[1] - getAngleDist(angle, blockerArc[0]) <= PREPLACE_EPSILON, true);
  check("it is on the far side from the blocker", angle < 0, true);
  check("with a clear arc it takes the direction wanted",
    geo._angleFor(ORIGIN, SPIKE, doomed, [doomed], 0.05), 0.05);
  const edge = geo._angleFor(ORIGIN, SPIKE, doomed, [doomed], PI);
  check("asked for an impossible direction it gives the arc's edge",
    Math.abs(getAngleDist(edge, doomedArc[0]) - doomedArc[1]) <= 1e-9, true);

  const boxedIn = [doomed];
  for (let a = -0.6; a <= 0.6; a += 0.1) {
    if (Math.abs(a) > 1e-9) boxedIn.push(building(REACH * Math.cos(a), REACH * Math.sin(a), 40));
  }
  check("with no free angle it places nothing", geo._angleFor(ORIGIN, SPIKE, doomed, boxedIn, 0), null);
  const far = building(900, 0, 40);
  check("a building out of reach is skipped", geo._angleFor(ORIGIN, SPIKE, far, [far], 0), null);
}

console.log("\nhits to break");
{
  const enemy = { weapon: { primary: 5, secondary: 10 }, getBuildingDamage: id => (id === 10 ? 60 : 25) };
  check("it counts the best melee hit", geo._hitsToBreak({ health: 180 }, enemy), 3);
  check("it rounds a part hit up", geo._hitsToBreak({ health: 181 }, enemy), 4);
  check("no melee means it never breaks",
    geo._hitsToBreak({ health: 100 }, { weapon: {}, getBuildingDamage: () => 0 }), Infinity);
}

console.log("\nthe replacer's free angles");
{
  const dead = building(REACH, 0, 40);
  /* Far enough round that its arc does not reach back over the hole. A spike
   * beside a spike blocks about 1.25 rad either side, so 2.6 clears zero. */
  const blocker = building(REACH * Math.cos(2.6), REACH * Math.sin(2.6), 40);
  const rep = new Replacer(makeClient({ objects: [dead, blocker] }));
  const angles = rep._freeAngles(ORIGIN, SPIKE, [dead, blocker], dead, 0);
  const blockerArc = rep._arc(ORIGIN, SPIKE, blocker);
  check("the hole is offered now the building is gone", angles.includes(0), true);
  check("it hands back the hole first", angles[0], 0);

  /* A neighbour close enough to overhang the hole takes it away again, and what
   * comes back is the nearest edge of that neighbour rather than nothing. */
  const crowd = building(REACH * Math.cos(1.2), REACH * Math.sin(1.2), 40);
  const crowded = rep._freeAngles(ORIGIN, SPIKE, [dead, crowd], dead, 0);
  const crowdArc = rep._arc(ORIGIN, SPIKE, crowd);
  check("a neighbour overhanging the hole takes it", crowded.includes(0), false);
  check("and what comes back is that neighbour's edge",
    Math.abs(getAngleDist(crowded[0], crowdArc[0]) - crowdArc[1]) <= 1e-9, true);
  check("every angle it offers is free",
    angles.every(a => blockerArc[1] - getAngleDist(a, blockerArc[0]) <= PREPLACE_EPSILON), true);
  check("they come out nearest-first",
    angles.every((a, i) => i === 0 || getAngleDist(angles[i - 1], 0) <= getAngleDist(a, 0)), true);

  /* Without the dead object excluded, its own footprint is still blocked —
   * which is exactly the difference the exclusion makes. */
  const withIt = rep._freeAngles(ORIGIN, SPIKE, [dead, blocker], null, 0);
  check("keeping the object blocks its own footprint", withIt.includes(0), false);
}

console.log("\nwhat the replacer reaches for");
{
  const dead = building(REACH, 0, 40);
  const at = (x, y) => ({ pos: { current: new Vector(x, y) }, hitScale: 35 });

  const trapped = building(0, REACH, 40);
  const c1 = makeClient({ objects: [dead], enemy: at(60, 0), trappedIn: trapped });
  new Replacer(c1)._fill(dead);
  check("trapped, it answers with a spike", c1.placed.length && c1.placed[0][0], 4);
  check("aimed at the trap", c1.placed[0][1], PI / 2, 1e-6);

  const c2 = makeClient({ objects: [dead], enemy: at(400, 0) });
  new Replacer(c2)._fill(dead);
  check("enemy out of reach, it lays traps", c2.placed.every(([t]) => t === 7), true);

  const c3 = makeClient({ objects: [dead], enemy: at(60, 0) });
  new Replacer(c3)._fill(dead);
  check("otherwise it plugs the hole", c3.placed.length > 0, true);
  check("aimed at the hole", c3.placed[0][1], 0, 1e-6);

  const c4 = makeClient({ objects: [dead], enemy: at(60, 0), packetCount: 69 });
  new Replacer(c4)._fill(dead);
  check("it stops at the packet budget", c4.placed.length, 0);

  const c5 = makeClient({ objects: [dead], enemy: at(60, 0) });
  const r5 = new Replacer(c5);
  r5.onDestroyed(building(REACH, 0, 40, { ownerID: 99 }));
  check("an enemy's building is not ours to replace", c5.placed.length, 0);

  Settings_default._replace = false;
  const c6 = makeClient({ objects: [dead], enemy: at(60, 0) });
  new Replacer(c6).onDestroyed(dead);
  check("switched off it does nothing", c6.placed.length, 0);
  Settings_default._replace = true;
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
