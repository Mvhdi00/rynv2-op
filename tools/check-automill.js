#!/usr/bin/env node
/*
 * check-automill.js
 *
 * Automill is meant to lay a wall of windmills three wide. It came out one,
 * two or three depending on which way you walked.
 *
 * The cause was the spacing: `asin(scale / distance) * 2` is exact tangency, so
 * neighbouring mills land centre-to-centre at exactly 2 * scale and the
 * server's strict `distance < scaleA + scaleB` accepts them only while nothing
 * rounds the gap down. The game rounds the place angle to two decimals on its
 * way out (`M.fixTo(dir, 2)`, Ci() in src/game_index.js), which at the
 * windmill's 85-unit place radius is ~0.85 units of arc per angle. Two
 * neighbours can round toward each other for a combined ~1.7, and which mill
 * is lost depends on where base +/- offset lands on the 0.01 grid — that is,
 * on the heading.
 *
 * This lifts the real class out of a built client, drives it against a model
 * of the server's own placement rule, and sweeps the heading. The old spacing
 * is reproduced alongside so the regression stays visible.
 *
 * It runs against either build: the v4-based ReUp_Mix, whose Automill was also
 * carrying an all-or-nothing gate, and RYN v5.4, which had already fixed that
 * but kept the spacing.
 *
 *   node tools/check-automill.js [path/to/client.js]
 */
const fs = require("fs");
const path = require("path");
const { extractModule } = require("./lib/extract");

const TARGET = process.argv[2] || path.join(__dirname, "..", "ReUp_Mix.user.js");
const SOURCE = fs.readFileSync(TARGET, "utf8");

const MOD =
  extractModule(SOURCE, "  const MILL_TYPE = 5;", "Automill") ||
  extractModule(SOURCE, "  const AUTOMILL_PLACE_COST", "Automill");
if (MOD === null) {
  console.error("could not find the Automill module in " + path.relative(process.cwd(), TARGET));
  process.exit(1);
}

/* ---- game data, as the client reads it ---- */
const PLAYER_SCALE = 35;
const WINDMILL = { id: 10, scale: 45, placeOffset: 5, itemGroup: 3 };
const Items = { 10: WINDMILL };
const ItemGroups = { 3: { limit: 7, sandboxLimit: 299 } };
const Settings_default = { _automill: true };
const fixTo = (value, fraction) => parseFloat(value.toFixed(fraction));
const RING = PLAYER_SCALE + WINDMILL.scale + WINDMILL.placeOffset; // 85

function Vector(x, y) { this.x = x; this.y = y; }
Vector.prototype.addDirection = function (angle, length) {
  return new Vector(this.x + Math.cos(angle) * length, this.y + Math.sin(angle) * length);
};
Vector.prototype.distance = function (o) { return Math.hypot(o.x - this.x, o.y - this.y); };

/* ---- the world, and the server's own placement rule ---- */
function makeWorld(objects) {
  return {
    placed: (objects || []).slice(),
    canPlaceItem(id, position) {
      for (const o of this.placed) {
        if (position.distance(o.pos) < Items[id].scale + o.scale) return false;
      }
      return true;
    },
    // Apply the batch in order, refusing anything landing within scale+scale
    // of what is already down. The angle is quantised on the way, because the
    // game rounds it before it reaches the server.
    apply(origin, angles) {
      let accepted = 0;
      for (const raw of angles) {
        const p = origin.addDirection(fixTo(raw, 2), RING);
        let ok = true;
        for (const o of this.placed) {
          if (p.distance(o.pos) < WINDMILL.scale + o.scale) { ok = false; break; }
        }
        if (ok) { this.placed.push({ pos: p, scale: WINDMILL.scale }); accepted++; }
      }
      return accepted;
    },
  };
}

/* Stubs covering both module shapes: the v4 build calls place() and reads
 * item counts and the sandbox gates; v5.4 calls requestPlace() and reads the
 * trap gates. Providing both keeps one check honest against either. */
function makeClient(world, heading, opts) {
  opts = opts || {};
  const speed = opts.speed === undefined ? 25 : opts.speed;
  const travel = heading + Math.PI; // mills go behind, so travel is opposite
  const cur = new Vector(0, 0);
  const sent = [];
  const myPlayer = {
    scale: PLAYER_SCALE,
    isSandbox: true,
    age: 1,
    isTrapped: false,
    itemCount: new Map([[3, opts.count || 0]]),
    pos: { current: cur, future: cur.addDirection(travel, speed) },
    getItemByType: () => WINDMILL.id,
    getItemPlaceScale: (id) => PLAYER_SCALE + Items[id].scale + Items[id].placeOffset,
    getPlacePosition(start, id, angle) { return start.addDirection(angle, this.getItemPlaceScale(id)); },
    getItemCount: (g) => ({ count: myPlayer.itemCount.get(g) || 0, limit: ItemGroups[g].sandboxLimit }),
    canPlace: () => opts.canPlace !== false,
    canPlaceObject(type, angle) {
      return world.canPlaceItem(WINDMILL.id, this.getPlacePosition(this.pos.current, WINDMILL.id, angle));
    },
  };
  return {
    sent,
    isOwner: true,
    myPlayer,
    ObjectManager: world,
    EnemyManager: { nearestTrap: null },
    _ModuleHandler: {
      attacking: 0,
      placedOnce: false,
      packetLimit: 70,
      packetCount: opts.packetCount || 0,
      reverse_move_dir: heading,
      placeAngles: [null, []],
      activeModule: null,
      staticModules: { autoBuy: { boughtEverything: () => false } },
      place(type, angle) { sent.push(angle); },
      requestPlace(type, angle) { sent.push(angle); return 1; },
    },
  };
}

const Automill = new Function(
  "Items", "ItemGroups", "Settings_default", "fixTo",
  MOD + "\n return Automill;"
)(Items, ItemGroups, Settings_default, fixTo);

/* ---- the spacing this replaced ---- */
const OLD_OFFSET = Math.asin((2 * WINDMILL.scale + 9e-13) / (2 * RING)) * 2;
const oldAngles = (h) => [h, h - OLD_OFFSET, h + OLD_OFFSET];

function run(heading, opts) {
  const world = (opts && opts.world) || makeWorld([]);
  const client = makeClient(world, heading, opts || {});
  new Automill(client).postTick();
  return { angles: client.sent, client, world };
}

/* A fresh world is used for the server pass so the module's own view and the
 * server's start from the same state. */
function survives(heading, opts) {
  const { angles } = run(heading, opts);
  const origin = new Vector(0, 0).addDirection(heading + Math.PI, (opts && opts.speed) || 25);
  return makeWorld((opts && opts.world && opts.world.placed) || []).apply(origin, angles);
}

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + "\n         got  " + JSON.stringify(got) + "\n         want " + JSON.stringify(want)); }
}

console.log("\nclient under test: " + path.relative(process.cwd(), TARGET));

console.log("\nthe eight WASD headings, on open ground");
const DIRS = [
  ["right", 0], ["down-right", Math.PI / 4], ["down", Math.PI / 2], ["down-left", 3 * Math.PI / 4],
  ["left", Math.PI], ["up-left", -3 * Math.PI / 4], ["up", -Math.PI / 2], ["up-right", -Math.PI / 4],
];
for (const [name, dir] of DIRS) {
  const old = makeWorld([]).apply(new Vector(0, 0), oldAngles(dir));
  check(name.padEnd(11) + " -> 3 mills survive the server (old spacing: " + old + ")", survives(dir), 3);
}

console.log("\nsweeping 72000 headings");
{
  let short = 0, worst = 3, oldShort = 0;
  const N = 72000;
  for (let i = 0; i < N; i++) {
    const dir = (i / N) * Math.PI * 2;
    const n = survives(dir);
    if (n < 3) short++;
    if (n < worst) worst = n;
    if (makeWorld([]).apply(new Vector(0, 0), oldAngles(dir)) < 3) oldShort++;
  }
  check("no heading places fewer than 3", short, 0);
  check("worst heading still places 3", worst, 3);
  console.log("       (old spacing was short at " + oldShort + "/" + N +
    " headings — " + ((oldShort / N) * 100).toFixed(1) + "%)");
}

console.log("\nclearance actually asked for");
{
  const { angles } = run(0);
  check("three angles sent", angles.length, 3);
  const q = angles.map((a) => fixTo(a, 2));
  const chord = (g) => 2 * RING * Math.sin(Math.abs(g) / 2);
  const gaps = [chord(q[1] - q[0]), chord(q[2] - q[0])];
  check("both gaps clear the 90-unit bar after rounding", gaps.every((g) => g >= 90), true);
}

console.log("\nblocked ground costs one mill, not the tick");
{
  const probe = run(0);
  const wing = probe.angles[1];
  const origin = new Vector(0, 0).addDirection(Math.PI, 25);
  // Sized to sit on one wing while leaving the centre, 90 units off, clear.
  const world = makeWorld([{ pos: origin.addDirection(wing, RING), scale: 40 }]);
  check("two mills still go out", run(0, { world }).angles.length, 2);
}

console.log("\ngates");
{
  let c = makeClient(makeWorld([]), 0, {});
  c._ModuleHandler.reverse_move_dir = null;
  new Automill(c).postTick();
  check("standing still places nothing", c.sent.length, 0);

  c = makeClient(makeWorld([]), 0, { canPlace: false });
  new Automill(c).postTick();
  check("no windmill available places nothing", c.sent.length, 0);

  c = makeClient(makeWorld([]), 0, { packetCount: 66 });
  new Automill(c).postTick();
  check("a tight packet budget caps the batch", c.sent.length <= 1, true);

  Settings_default._automill = false;
  c = makeClient(makeWorld([]), 0, {});
  new Automill(c).postTick();
  check("the toggle is honoured", c.sent.length, 0);
  Settings_default._automill = true;
}

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
