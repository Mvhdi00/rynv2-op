#!/usr/bin/env node
/*
 * check-automill.js
 *
 * Automill is meant to lay a wall of windmills three wide. The old spacing was
 * exact tangency, and the game rounds the place angle to two decimals on its
 * way out (`M.fixTo(dir, 2)` in the bundle's attack path), so two neighbours
 * could round toward each other and close a gap that had no clearance to give.
 * Which mill was lost depended on where base +/- offset landed on the 0.01
 * grid — that is, on the heading — so the wall came out a different width
 * depending on which way you walked.
 *
 * This lifts the real class out of the built script, drives it against a model
 * of the server's own placement rule, and sweeps the heading. The old spacing
 * is reproduced alongside it so the regression stays visible.
 *
 *   node tools/check-automill.js [path/to/client.js]
 */
const fs = require("fs");
const path = require("path");

const TARGET = process.argv[2] || path.join(__dirname, "..", "ReUp_Mix.user.js");
const SOURCE = fs.readFileSync(TARGET, "utf8");
const START = SOURCE.indexOf("  const MILL_TYPE = 5;");
const END = SOURCE.indexOf("  const Automill_default = Automill;");
if (START === -1 || END === -1 || END < START) {
  console.error("could not find the Automill module in " + path.relative(process.cwd(), TARGET));
  process.exit(1);
}
const MOD = SOURCE.slice(START, END);

/* ---- game data, as the client reads it ---- */
const PLAYER_SCALE = 35;
const WINDMILL = { id: 10, scale: 45, placeOffset: 5, itemGroup: 3 };
const Items = { 10: WINDMILL };
const ItemGroups = { 3: { limit: 7, sandboxLimit: 299 } };
const Settings_default = { _automill: true };
const fixTo = (value, fraction) => parseFloat(value.toFixed(fraction));

function Vector(x, y) { this.x = x; this.y = y; }
Vector.prototype.addDirection = function (angle, length) {
  return new Vector(this.x + Math.cos(angle) * length, this.y + Math.sin(angle) * length);
};
Vector.prototype.distance = function (o) { return Math.hypot(o.x - this.x, o.y - this.y); };

/* ---- the world, and the server's own placement rule ---- */
function makeWorld(objects) {
  return {
    placed: objects.slice(),
    // ObjectManager.canPlaceItem, minus the river band the sweep never enters.
    canPlaceItem(id, position) {
      const item = Items[id];
      for (const o of this.placed) {
        if (position.distance(o.pos) < item.scale + o.scale) return false;
      }
      return true;
    },
    // What the server does with the batch: apply in order, refuse anything
    // landing within scale+scale of what is already down.
    apply(origin, angles) {
      let accepted = 0;
      for (const a of angles) {
        const p = origin.addDirection(a, PLAYER_SCALE + WINDMILL.scale + WINDMILL.placeOffset);
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

function makeClient(world, heading, opts = {}) {
  const cur = new Vector(opts.x || 0, opts.y || 0);
  const speed = opts.speed === undefined ? 25 : opts.speed;
  const move = heading + Math.PI; // heading is where the mills go, so travel is opposite
  const sent = [];
  const myPlayer = {
    scale: PLAYER_SCALE,
    isSandbox: true,
    age: 1,
    itemCount: new Map([[3, opts.count || 0]]),
    pos: { current: cur, future: cur.addDirection(move, speed) },
    getItemByType: () => WINDMILL.id,
    getItemPlaceScale: (id) => PLAYER_SCALE + Items[id].scale + Items[id].placeOffset,
    getPlacePosition(start, id, angle) { return start.addDirection(angle, this.getItemPlaceScale(id)); },
    getItemCount: (g) => ({ count: myPlayer.itemCount.get(g) || 0, limit: ItemGroups[g].sandboxLimit }),
    canPlace: () => opts.canPlace !== false,
  };
  return {
    sent,
    isOwner: true,
    myPlayer,
    ObjectManager: world,
    _ModuleHandler: {
      attacking: 0,
      placedOnce: false,
      packetLimit: 70,
      packetCount: opts.packetCount || 0,
      reverse_move_dir: heading,
      placeAngles: [null, []],
      staticModules: { autoBuy: { boughtEverything: () => false } },
      place(type, angle) { sent.push(angle); },
    },
  };
}

/* ---- load the real class ---- */
const Automill = new Function(
  "Items", "ItemGroups", "Settings_default", "fixTo",
  MOD + "\n return Automill;"
)(Items, ItemGroups, Settings_default, fixTo);

/* ---- the spacing this replaced, for comparison ---- */
const OLD_OFFSET = Math.asin((2 * WINDMILL.scale + 9e-13) / (2 * (PLAYER_SCALE + WINDMILL.scale + WINDMILL.placeOffset))) * 2;
function oldAngles(heading) {
  // The game rounds the place angle on its way out.
  return [heading, heading - OLD_OFFSET, heading + OLD_OFFSET].map((a) => fixTo(a, 2));
}

/* ---- run one heading ---- */
function newCount(heading, world, opts) {
  const client = makeClient(world || makeWorld([]), heading, opts || {});
  new Automill(client).postTick();
  return { angles: client.sent, client };
}

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + "\n         got  " + JSON.stringify(got) + "\n         want " + JSON.stringify(want)); }
}

const DIRS = [
  ["right", 0], ["down-right", Math.PI / 4], ["down", Math.PI / 2], ["down-left", 3 * Math.PI / 4],
  ["left", Math.PI], ["up-left", -3 * Math.PI / 4], ["up", -Math.PI / 2], ["up-right", -Math.PI / 4],
];

console.log("\nthe eight WASD headings, on open ground");
for (const [name, dir] of DIRS) {
  const world = makeWorld([]);
  const { angles } = newCount(dir, world);
  const accepted = makeWorld([]).apply(new Vector(0, 0).addDirection(dir + Math.PI, 25), angles);
  const old = makeWorld([]).apply(new Vector(0, 0), oldAngles(dir));
  check(name.padEnd(11) + " -> 3 mills survive the server (old spacing: " + old + ")", accepted, 3);
}

console.log("\nsweeping 36000 headings");
{
  let short = 0, worst = 3, oldShort = 0;
  const N = 36000;
  for (let i = 0; i < N; i++) {
    const dir = (i / N) * Math.PI * 2;
    const { angles } = newCount(dir, makeWorld([]));
    const n = makeWorld([]).apply(new Vector(0, 0).addDirection(dir + Math.PI, 25), angles);
    if (n < 3) short++;
    worst = Math.min(worst, n);
    if (makeWorld([]).apply(new Vector(0, 0), oldAngles(dir)) < 3) oldShort++;
  }
  check("no heading places fewer than 3", short, 0);
  check("worst heading still places 3", worst, 3);
  console.log("       (old spacing was short at " + oldShort + "/" + N +
    " headings — " + ((oldShort / N) * 100).toFixed(1) + "%)");
}

console.log("\nangles are on the grid the server sees");
{
  const { angles } = newCount(Math.PI / 4, makeWorld([]));
  check("three angles sent", angles.length, 3);
  check("each is quantised to 2dp", angles.every((a) => a === fixTo(a, 2)), true);
  const d = angles.map((a) => Math.abs(a - angles[0])).sort((x, y) => x - y);
  check("wings sit either side of the centre", d[0] === 0 && d[1] > 0 && d[2] > 0, true);
}

console.log("\nblocked ground costs one mill, not the tick");
{
  // Park an object exactly where the left wing wants to go.
  const heading = 0;
  const probe = newCount(heading, makeWorld([]));
  const leftAngle = probe.client.sent[1];
  const R = PLAYER_SCALE + WINDMILL.scale + WINDMILL.placeOffset;
  const origin = new Vector(0, 0).addDirection(Math.PI, 25);
  const blockPos = origin.addDirection(leftAngle, R);
  // Sized to sit on the left wing through its whole slide range (0.08rad is
  // ~7 units of arc) while leaving the centre, 90 units off, clear.
  const world = makeWorld([{ pos: blockPos, scale: 40 }]);
  const { angles } = newCount(heading, world);
  check("two mills still go out", angles.length, 2);
}

console.log("\ngates");
{
  let c = makeClient(makeWorld([]), 0, {});
  c._ModuleHandler.reverse_move_dir = null;
  new Automill(c).postTick();
  check("standing still places nothing", c.sent.length, 0);

  c = makeClient(makeWorld([]), 0, { canPlace: false });
  const m = new Automill(c); m.postTick();
  check("no windmill available disables the module", [c.sent.length, m.active], [0, false]);

  c = makeClient(makeWorld([]), 0, { packetCount: 64 });
  new Automill(c).postTick();
  check("a tight packet budget caps the batch", c.sent.length, 1);

  c = makeClient(makeWorld([]), 0, { count: 298 });
  new Automill(c).postTick();
  check("one slot left below the cap places one", c.sent.length, 1);

  c = makeClient(makeWorld([]), 0, {});
  Settings_default._automill = false;
  new Automill(c).postTick();
  check("the toggle is honoured", c.sent.length, 0);
  Settings_default._automill = true;
}

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
