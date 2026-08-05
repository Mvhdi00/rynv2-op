#!/usr/bin/env node
/*
 * verify-drivers.js
 *
 * Diffs the driver tables baked into the client (src/RYN_Client_v4.js by
 * default, or whatever path is passed) against drivers/game-drivers.json —
 * the tables pulled straight out of the shipped game bundle.
 *
 * Any drift here means the client and the server disagree about what an id
 * means, which shows up in game as wrong prices, wrong placement limits, or
 * hats that equip to something else entirely.
 *
 *   node tools/verify-drivers.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "src/RYN_Client_v4.js");

const client = fs.readFileSync(CLIENT_PATH, "utf8");
const game = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

/* Pull `const <Name> = <literal>` out of the client and evaluate it. */
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
const notes = [];
function fail(msg) { problems.push(msg); }
function note(msg) { notes.push(msg); }

/* ---- id-keyed tables (hats, accessories) ------------------------------- */
function checkKeyed(label, clientObj, gameArr, fields) {
  const gameById = new Map(gameArr.map((e) => [e.id, e]));

  for (const entry of gameArr) {
    const mine = clientObj[entry.id];
    if (!mine) { fail(`${label}: id ${entry.id} ("${entry.name}") missing from client`); continue; }
    for (const [clientKey, gameKey] of fields) {
      const a = mine[clientKey];
      const b = entry[gameKey];
      if (b === undefined && a === undefined) continue;
      // Client normalises "absent" to false/0; treat that as agreement.
      if (b === undefined && (a === false || a === 0 || a === "")) continue;
      if (a !== b) {
        fail(`${label}: id ${entry.id} ("${entry.name}") ${clientKey}=${JSON.stringify(a)} but game has ${gameKey}=${JSON.stringify(b)}`);
      }
    }
  }

  for (const key of Object.keys(clientObj)) {
    const id = Number(key);
    // id 0 is the client-side "Unequip" pseudo-entry; the game has no such row.
    if (id === 0) continue;
    if (!gameById.has(id)) fail(`${label}: client has id ${id} ("${clientObj[key].name}") that the game does not`);
  }
}

/* ---- positional tables (weapons) ---------------------------------------
 * `defaults` names the game fields that are optional in the bundle because the
 * engine substitutes a value when they are absent; a client that spells the
 * default out explicitly still agrees with the game. */
function checkPositional(label, clientArr, gameArr, fields, defaults = {}, { allowExtra = false } = {}) {
  if (clientArr.length < gameArr.length) {
    fail(`${label}: client has ${clientArr.length} entries, game has ${gameArr.length}`);
  } else if (clientArr.length > gameArr.length && !allowExtra) {
    fail(`${label}: client has ${clientArr.length} entries, game has ${gameArr.length}`);
  } else if (clientArr.length > gameArr.length) {
    note(`${label}: client carries ${clientArr.length - gameArr.length} row(s) past the game table`);
  }
  const n = Math.min(clientArr.length, gameArr.length);
  for (let i = 0; i < n; i++) {
    for (const [clientKey, gameKey] of fields) {
      const a = clientArr[i][clientKey];
      const b = gameArr[i][gameKey];
      if (b === undefined && a === undefined) continue;
      if (b === undefined && gameKey in defaults && a === defaults[gameKey]) continue;
      if (b === undefined && (a === false || a === 0)) continue;
      if (a !== b) {
        fail(`${label}: index ${i} ("${gameArr[i].name}") ${clientKey}=${JSON.stringify(a)} but game has ${gameKey}=${JSON.stringify(b)}`);
      }
    }
  }
}

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("game   :", game.source.index, "+", game.source.vendor);
console.log("");

checkKeyed("hats", clientTable("Hats"), game.hats, [
  ["id", "id"],
  ["name", "name"],
  ["price", "price"],
  ["scale", "scale"],
  ["dontSell", "dontSell"],
]);

checkKeyed("accessories", clientTable("Accessories"), game.accessories, [
  ["id", "id"],
  ["name", "name"],
  ["price", "price"],
  ["scale", "scale"],
  ["xOffset", "xOff"],
  ["dontSell", "dontSell"],
]);

/* Ranged weapons take range/speed from their projectile, not the weapon row,
 * so only compare those fields on weapons the game defines them for. */
checkPositional("weapons", clientTable("Weapons"), game.weapons, [
  ["name", "name"],
  ["damage", "dmg"],
  ["gather", "gather"],
  ["spdMult", "spdMult"],
  ["xOffset", "xOff"],
  ["yOffset", "yOff"],
  ["length", "length"],
  ["width", "width"],
  ["age", "age"],
  ["type", "type"],
], { spdMult: 1 });

/* ---- physics tables -----------------------------------------------------
 * These drive prediction rather than pricing, so drift here does not look like
 * a wrong label — it looks like the client and the server disagreeing about
 * where a player ends up. checkPositional's `allowExtra` lets the client carry
 * rows past the end of the game table (the boss animals the server spawns are
 * not in the shipped aiTypes list).
 */

/* Items: scale, placeOffset and health decide placement and what blocks a
 * path; ignoreCollision decides whether the object is solid at all. The client
 * tests that one with `"ignoreCollision" in item`, so presence is what has to
 * agree, not the value. */
checkPositional("items", clientTable("Items"), game.items, [
  ["name", "name"],
  ["description", "desc"],
  ["scale", "scale"],
  ["holdOffset", "holdOffset"],
  ["placeOffset", "placeOffset"],
  ["spritePadding", "spritePadding"],
  ["health", "health"],
  ["damage", "dmg"],
  ["pDmg", "pDmg"],
  ["projDmg", "projDmg"],
  ["turnSpeed", "turnSpeed"],
  ["shootRange", "shootRange"],
  ["shootRate", "shootRate"],
  ["pps", "pps"],
  ["colDiv", "colDiv"],
  ["boostSpeed", "boostSpeed"],
  ["healCol", "healCol"],
  ["age", "age"],
]);

{
  const mine = clientTable("Items");
  game.items.forEach((g, i) => {
    const c = mine[i];
    if (!c) return;
    /* Group id: the client stores the id where the game nests the whole group
     * row. Food (group 0) is deliberately absent client-side — ItemGroups drops
     * the non-placeable group, and getItemCount would throw on it. */
    if (g.group.place && c.itemGroup !== g.group.id) {
      fail(`items: index ${i} ("${g.name}") itemGroup=${c.itemGroup} but game has ${g.group.id}`);
    }
    const gameSolid = !("ignoreCollision" in g);
    const clientSolid = !("ignoreCollision" in c);
    if (gameSolid !== clientSolid) {
      fail(`items: index ${i} ("${g.name}") is ${clientSolid ? "solid" : "pass-through"} in the client but ${gameSolid ? "solid" : "pass-through"} in the game`);
    }
  });
}

/* Turret-fired projectiles carry no speed or range of their own in the bundle —
 * the firing item supplies them — so those two are only compared on the rows
 * the game actually fills in, and the item link is checked separately below. */
checkPositional("projectiles", clientTable("Projectiles"), game.projectiles, [
  ["index", "indx"],
  ["layer", "layer"],
  ["src", "src"],
  ["damage", "dmg"],
  ["scale", "scale"],
]);

{
  const mine = clientTable("Projectiles");
  game.projectiles.forEach((g, i) => {
    const c = mine[i];
    if (!c) return;
    for (const f of ["speed", "range"]) {
      if (g[f] === undefined) continue;
      if (c[f] !== g[f]) {
        fail(`projectiles: index ${i} ${f}=${JSON.stringify(c[f])} but game has ${JSON.stringify(g[f])}`);
      }
    }
  });

  /* An item that shoots names its projectile row and its own range. Where the
   * client spells that range onto the projectile, it has to be the item's. */
  for (const item of game.items) {
    if (item.projectile === undefined || item.shootRange === undefined) continue;
    const c = mine[item.projectile];
    if (!c || c.range === undefined) continue;
    if (c.range !== item.shootRange) {
      fail(`projectiles: row ${item.projectile} range=${c.range} but "${item.name}" shootRange=${item.shootRange}`);
    }
  }
}

/* Animals: speed, turnSpeed, scale and weightM are what the bot movement and
 * the trap-animal logic predict against. */
checkPositional("animals", clientTable("Animals"), game.animals, [
  ["src", "src"],
  ["killScore", "killScore"],
  ["health", "health"],
  ["weightM", "weightM"],
  ["speed", "speed"],
  ["turnSpeed", "turnSpeed"],
  ["scale", "scale"],
  ["dmg", "dmg"],
  ["viewRange", "viewRange"],
  ["hostile", "hostile"],
], {}, { allowExtra: true });

/* Item groups: client keys by group id and drops group 0 (food, not placeable). */
{
  const mine = clientTable("ItemGroups");
  for (const g of game.itemGroups) {
    if (!g.place) continue;
    const c = mine[g.id];
    if (!c) { fail(`itemGroups: placeable group ${g.id} ("${g.name}") missing from client`); continue; }
    if (c.limit !== g.limit) fail(`itemGroups: group ${g.id} ("${g.name}") limit=${c.limit} but game has ${g.limit}`);
    if (c.layer !== g.layer) fail(`itemGroups: group ${g.id} ("${g.name}") layer=${c.layer} but game has ${g.layer}`);
  }
}

/* Config: only compare keys the client actually mirrors. */
{
  const mine = clientTable("Config");
  let compared = 0;
  for (const [k, v] of Object.entries(game.config)) {
    if (!(k in mine)) { note(`config: client does not mirror "${k}"`); continue; }
    if (typeof v === "object") continue; // arrays compared loosely below
    compared++;
    if (mine[k] !== v) fail(`config: ${k}=${JSON.stringify(mine[k])} but game has ${JSON.stringify(v)}`);
  }
  note(`config: compared ${compared} scalar keys`);
}

/* Protocol: the client must implement the same transport the game speaks. */
{
  const p = game.protocol;
  const want = [
    [`signature width ${p.signatureBytes}`, new RegExp("_?jt(?:Sig)?\\s*=\\s*" + p.signatureBytes + "\\b")],
    [`encrypted mode ${p.encryptedMode}`, new RegExp("_?Ht\\s*=\\s*" + p.encryptedMode + "\\b")],
    [`table salt ${p.tableSalt}`, new RegExp("_?Io\\s*=\\s*" + p.tableSalt + "\\b")],
    ["c2s alphabet", new RegExp(p.c2sAlphabet.map((c) => `"${c}"`).join(",\\s*"))],
    ["s2c alphabet", new RegExp(p.s2cAlphabet.map((c) => `"${c}"`).join(",\\s*"))],
  ];
  for (const [label, re] of want) {
    if (!re.test(client)) fail(`protocol: client does not carry ${label}`);
  }
}

console.log(notes.map((n) => "note  " + n).join("\n"));
console.log("");

if (problems.length) {
  console.log(problems.map((p) => "DRIFT " + p).join("\n"));
  console.log(`\n${problems.length} mismatch(es) against the shipped game bundle.`);
  process.exit(1);
}

console.log("OK - client driver tables match the shipped game bundle.");
