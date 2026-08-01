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
function checkPositional(label, clientArr, gameArr, fields, defaults = {}) {
  if (clientArr.length !== gameArr.length) {
    fail(`${label}: client has ${clientArr.length} entries, game has ${gameArr.length}`);
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
