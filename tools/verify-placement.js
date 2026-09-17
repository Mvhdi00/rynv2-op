#!/usr/bin/env node
/*
 * verify-placement.js
 *
 * The placement subsystem's own driver check.
 *
 * `verify-drivers.js` compares the tables the whole client is built on — hats,
 * accessories, weapons, item groups, config scalars, the protocol. It does not
 * compare the four item fields the placement engine's geometry is entirely made
 * of: `scale`, `placeOffset`, `colDiv` and `blocker`. Those are the numbers that
 * decide where a build lands, what it blocks, what it touches and what pins,
 * and a drift in any of them is a placement the server refuses (or, worse, one
 * it accepts somewhere the client did not predict).
 *
 * So this checks them, plus every other item field the engine reads, and then
 * prints the derived placement geometry so the constants in the engine can be
 * read against the game rather than against a comment.
 *
 *   node tools/verify-placement.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Ryn_Type_2.user.js");

const client = fs.readFileSync(CLIENT_PATH, "utf8");
const game = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

function clientTable(name) {
  const at = client.search(new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*[\\[{]"));
  if (at === -1) throw new Error("client table not found: " + name);
  const body = client.slice(client.indexOf("=", at) + 1);
  const open = body.search(/[[{]/);
  const openCh = body[open];
  const closeCh = openCh === "[" ? "]" : "}";
  let depth = 0, quote = null, end = -1;
  for (let i = open; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("unterminated client table: " + name);
  return vm.runInNewContext("(" + body.slice(open, end + 1) + ")", { Math });
}

const problems = [];
const fail = m => problems.push(m);

const Items = clientTable("Items");
const Config = clientTable("Config");

/* Every item field the placement engine reads, in client -> game naming. */
const FIELDS = [
  ["scale", "scale"],
  ["placeOffset", "placeOffset"],
  ["colDiv", "colDiv"],
  ["blocker", "blocker"],
  ["health", "health"],
  ["damage", "dmg"],
  ["pDmg", "pDmg"],
  ["trap", "trap"],
  ["ignoreCollision", "ignoreCollision"],
  ["hideFromEnemy", "hideFromEnemy"],
  ["boostSpeed", "boostSpeed"],
  ["healCol", "healCol"],
  ["teleport", "teleport"],
  ["spawnPoint", "spawnPoint"],
  ["projDmg", "projDmg"],
  ["turnSpeed", "turnSpeed"],
  ["holdOffset", "holdOffset"],
  ["shootRange", "shootRange"],
  ["shootRate", "shootRate"],
];

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("game   :", game.source.index, "+", game.source.vendor);
console.log("");

if (Items.length !== game.items.length) {
  fail(`items: client has ${Items.length} entries, game has ${game.items.length}`);
}

for (let i = 0; i < game.items.length; i++) {
  const c = Items[i], g = game.items[i];
  if (!c) { fail(`items: index ${i} ("${g.name}") missing from client`); continue; }
  if (c.name !== g.name) fail(`items: index ${i} name=${JSON.stringify(c.name)} but game has ${JSON.stringify(g.name)}`);
  for (const [ck, gk] of FIELDS) {
    const a = c[ck], b = g[gk];
    if (a === b) continue;
    if (b === undefined && (a === undefined || a === false || a === 0)) continue;
    fail(`items: index ${i} ("${g.name}") ${ck}=${JSON.stringify(a)} but game has ${gk}=${JSON.stringify(b)}`);
  }
}

/* The five config scalars the engine's own constants are derived from. */
for (const k of ["playerScale", "serverUpdateRate", "playerDecel", "mapScale", "riverWidth"]) {
  if (Config[k] !== game.config[k]) {
    fail(`config: ${k}=${JSON.stringify(Config[k])} but game has ${JSON.stringify(game.config[k])}`);
  }
}

/* Derived geometry, printed so the engine's numbers can be read against the
 * game rather than against a comment.
 *
 *   ringR     where a build lands: playerScale + scale + placeOffset
 *             (game: Player.buildItem)
 *   blockR    what it denies to a later build: blocker ?? scale
 *             (game: ObjectManager.checkItemLocation, via getScale(0.6, isItem))
 *   contactR  how close a player gets before the game's collision fires:
 *             playerScale + scale * colDiv  (game: ObjectManager.checkCollision) */
const P = game.config.playerScale;
console.log("item                  scale  off   ringR  blockR  colDiv  contactR");
for (const g of game.items) {
  if (g.placeOffset === undefined) continue;
  const colDiv = g.colDiv === undefined ? 1 : g.colDiv;
  console.log(
    g.name.padEnd(20),
    String(g.scale).padStart(6),
    String(g.placeOffset).padStart(4),
    String(P + g.scale + g.placeOffset).padStart(7),
    String(g.blocker ? g.blocker : g.scale).padStart(7),
    String(colDiv).padStart(7),
    String(P + g.scale * colDiv).padStart(9)
  );
}

/* The wire quantum. The game sends every placement angle through
 * `UTILS.fixTo(angle, 2)` (game: Ci(), and the "F"/"D" senders that read it),
 * so the server can only ever be told one of a finite set of directions. The
 * engine's refinement floor is this number; anything finer is the same build. */
const QUANTUM = 0.01;
const wireSlots = Math.round((2 * Math.PI) / QUANTUM);
console.log("");
console.log(`wire angle quantum   ${QUANTUM} rad  (${(QUANTUM * 180 / Math.PI).toFixed(4)} deg)`);
console.log(`distinct directions  ${wireSlots}`);
for (const name of ["spikes", "greater spikes", "pit trap"]) {
  const g = game.items.find(it => it.name === name);
  if (!g) continue;
  const ring = P + g.scale + g.placeOffset;
  console.log(
    `  ${name.padEnd(16)} ringR ${String(ring).padStart(3)}  ` +
    `arc/slot ${(QUANTUM * ring).toFixed(3)}u  ` +
    `max snap error ${(QUANTUM * ring / 2).toFixed(3)}u`
  );
}

console.log("");
if (problems.length) {
  for (const p of problems) console.log("FAIL ", p);
  console.log(`\n${problems.length} mismatch(es) against the shipped game bundle.`);
  process.exit(1);
}
console.log("OK - every placement-relevant item field matches the shipped game bundle.");
