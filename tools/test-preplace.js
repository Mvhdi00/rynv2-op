/*
 * The pre-placer's two claims, checked against geometry rather than against
 * itself: the arc it computes is exactly the span in which an item would touch
 * an object, and the angle it picks lands inside the doomed building while
 * clearing every other one.
 *
 * The methods are lifted off the class in the client so the tests fail if the
 * real ones drift. Everything they touch — the item table, the player, the
 * object grid — is stubbed at the shape the client uses.
 */
const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "src", "RYN_Client_v4.js"), "utf8");

/* ---- the pieces the module leans on, lifted verbatim ---- */
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

/* ---- the class, with the module scope it reads from supplied ---- */
const ITEM_SCALE = 35;
const Items = { 7: { scale: ITEM_SCALE, placeOffset: -5 }, 15: { scale: 32, placeOffset: -5 } };
const PREPLACE_EPSILON = 1e-6;
const pointInRiver = () => false;
class PlayerObject {}

class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  angle(v) { return Math.atan2(v.y - this.y, v.x - this.x); }
  addDirection(a, len) { return new Vector(this.x + Math.cos(a) * len, this.y + Math.sin(a) * len); }
}

const classSrc = lift("  class PrePlacer {");
const PrePlacer = new Function(
  "PI", "Items", "PREPLACE_EPSILON", "PREPLACE_RANGE", "pointInRiver", "PlayerObject",
  "getAngleDist", "findPlacementAngles", "Settings_default", "DataHandler_default",
  classSrc + "\nreturn PrePlacer;"
)(PI, Items, PREPLACE_EPSILON, 270, pointInRiver, PlayerObject,
  getAngleDist, findPlacementAngles, { _prePlace: true, _prePlaceHits: 4, _prePlaceSpike: true },
  { isMelee: id => id != null });

const PLAYER_SCALE = 35;
const object = (x, y, scale) => ({ pos: { current: new Vector(x, y) }, placementScale: scale });
const placer = new PrePlacer({
  myPlayer: { getItemPlaceScale: id => PLAYER_SCALE + Items[id].scale + Items[id].placeOffset }
});
const ID = 7;
const REACH = PLAYER_SCALE + Items[ID].scale + Items[ID].placeOffset;

let passed = 0, failed = 0;
function check(name, got, want, eps = 1e-9) {
  const ok = typeof want === "number" && isFinite(want) ? Math.abs(got - want) <= eps : got === want;
  if (ok) { passed++; console.log(`  PASS  ${name}  (got ${typeof got === "number" ? got.toFixed(6) : got})`); }
  else { failed++; console.log(`  FAIL  ${name}  (got ${got}, want ${want})`); }
}

/* Where the item ends up if placed at this angle. */
const placeAt = (from, angle) => from.addDirection(angle, REACH);

console.log("\nthe arc is exactly where the item would touch");
{
  const me = new Vector(0, 0);
  const target = object(140, 0, 40);
  const [center, offset] = placer._arc(me, ID, target);
  check("it is centred on the object", center, 0);
  /* At the edge of the arc the item is exactly touching; a hair outside it is
   * clear, a hair inside it overlaps. That is the definition, so measure it. */
  const touching = Items[ID].scale + target.placementScale + 1;
  check("at the edge the item just touches",
    placeAt(me, offset).distance(target.pos.current), touching, 1e-6);
  check("a hair outside the arc it is clear",
    placeAt(me, offset + 1e-3).distance(target.pos.current) > touching, true);
  check("a hair inside the arc it overlaps",
    placeAt(me, offset - 1e-3).distance(target.pos.current) < touching, true);
}
{
  const me = new Vector(0, 0);
  check("an object out of reach blocks nothing", placer._arc(me, ID, object(900, 0, 40)), null);
  const [, wide] = placer._arc(me, ID, object(5, 0, 200));
  check("an object swallowing you blocks everything", wide, PI);
}

console.log("\nthe angle it picks");
{
  /* A doomed building dead ahead, a second building beside it taking up half of
   * the arc the first one occupies. The pick has to be in the first and out of
   * the second. */
  const me = new Vector(0, 0);
  const doomed = object(REACH, 0, 40);
  const blocker = object(REACH * Math.cos(0.5), REACH * Math.sin(0.5), 40);
  const nearby = [doomed, blocker];
  const angle = placer._angleFor(me, ID, doomed, nearby, 0);
  const doomedArc = placer._arc(me, ID, doomed);
  const blockerArc = placer._arc(me, ID, blocker);
  check("it found one", angle !== null, true);
  check("it lands inside the doomed building",
    getAngleDist(angle, doomedArc[0]) <= doomedArc[1] + PREPLACE_EPSILON, true);
  check("it clears the other building",
    blockerArc[1] - getAngleDist(angle, blockerArc[0]) <= PREPLACE_EPSILON, true);
  check("it is on the far side from the blocker", angle < 0, true);

  /* Nothing in the way: it should take the direction asked for, not an edge. */
  const open = placer._angleFor(me, ID, doomed, [doomed], 0.05);
  check("with a clear arc it takes the direction wanted", open, 0.05);

  /* Asked for a direction outside the arc, it should give the nearest edge. */
  const edge = placer._angleFor(me, ID, doomed, [doomed], PI);
  check("asked for an impossible direction it gives the arc's edge",
    Math.abs(getAngleDist(edge, doomedArc[0]) - doomedArc[1]) <= 1e-9, true);
}
{
  /* Boxed in: a ring of buildings around the doomed one leaves no angle. */
  const me = new Vector(0, 0);
  const doomed = object(REACH, 0, 40);
  const nearby = [doomed];
  for (let a = -0.6; a <= 0.6; a += 0.1) {
    if (Math.abs(a) < 1e-9) continue;
    nearby.push(object(REACH * Math.cos(a), REACH * Math.sin(a), 40));
  }
  check("with no free angle it places nothing", placer._angleFor(me, ID, doomed, nearby, 0), null);
}
{
  /* The doomed building out of reach is not a hole worth filling. */
  const me = new Vector(0, 0);
  const far = object(900, 0, 40);
  check("a building out of reach is skipped", placer._angleFor(me, ID, far, [far], 0), null);
}

console.log("\nhits to break");
{
  const enemy = {
    weapon: { primary: 5, secondary: 10 },
    getBuildingDamage: id => (id === 10 ? 60 : 25)
  };
  check("it counts the best melee hit", placer._hitsToBreak({ health: 180 }, enemy), 3);
  check("it rounds a part hit up", placer._hitsToBreak({ health: 181 }, enemy), 4);
  check("no melee means it never breaks",
    placer._hitsToBreak({ health: 100 }, { weapon: {}, getBuildingDamage: () => 0 }), Infinity);
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
