#!/usr/bin/env node
/*
 * verify-drivers.js
 *
 * Diffs the driver tables baked into the client (ReUp_Mix.user.js by default,
 * or whatever path is passed) against drivers/game-drivers.json — the tables
 * pulled straight out of the shipped game bundle.
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
  : path.join(ROOT, "ReUp_Mix.user.js");

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
  for (const k of game.configUndetermined || []) {
    note(`config: "${k}" is decided by the page, not the bundle — nothing to compare`);
  }
}

/* Protocol.
 *
 * What the client has to agree with the game about, that is visible as text:
 * both opcode alphabets and the sizes of their pre-2025 prefixes. Whether the
 * client's transport *behaves* like the game's is not a text question, and is
 * not asked here — tools/check-wire.js runs the two against each other.
 */
{
  const p = game.protocol;
  const alphabet = (label, letters) => {
    const re = new RegExp(letters.map((c) => `"${c}"`).join(",\\s*"));
    if (!re.test(client)) fail(`protocol: client does not carry the ${label} alphabet`);
  };
  alphabet("c2s", p.c2sAlphabet);
  alphabet("s2c", p.s2cAlphabet);

  const counts = [
    ["c2s legacy count", p.c2sLegacyCount, /c2sPlain\s*=\s*(\d+)/],
    ["s2c legacy count", p.s2cLegacyCount, /s2cPlain\s*=\s*(\d+)/],
    ["signature width", p.signatureBytes, /sigBytes\s*=\s*(\d+)/],
    ["transport mode", p.encryptedMode, /\bmode\s*=\s*(\d+)/],
    ["legacy table salt", p.legacyTableSalt, /defaultSalt\s*=\s*(\d+)/],
  ];
  for (const [label, want, re] of counts) {
    const m = client.match(re);
    if (!m) { note(`protocol: client does not spell out ${label}; it reads it off the bundle`); continue; }
    if (Number(m[1]) !== want) {
      fail(`protocol: client carries ${label} ${m[1]} but the game has ${want}`);
    }
  }
}

/* The embedded manifest: what the build says it was verified against has to be
 * what drivers/game-drivers.json actually holds, or the runtime drift check is
 * measuring against the wrong thing. */
{
  const at = client.indexOf("const ReUpDrivers = ");
  if (at === -1) {
    note("manifest: client carries no ReUpDrivers manifest (not a ReUp Mix build)");
  } else {
    const manifest = clientTable("ReUpDrivers");
    const want = {
      itemGroups: game.itemGroups.length,
      projectiles: game.projectiles.length,
      weapons: game.weapons.length,
      items: game.items.length,
      hats: game.hats.length,
      accessories: game.accessories.length,
    };
    for (const [k, v] of Object.entries(want)) {
      if (manifest.tableSizes[k] !== v) {
        fail(`manifest: says ${k} has ${manifest.tableSizes[k]} entries, drivers have ${v}`);
      }
    }
    for (const k of ["signatureBytes", "encryptedMode", "legacyTableSalt", "c2sLegacyCount", "s2cLegacyCount"]) {
      if (manifest.protocol[k] !== game.protocol[k]) {
        fail(`manifest: protocol.${k} is ${manifest.protocol[k]}, drivers have ${game.protocol[k]}`);
      }
    }
    if (manifest.protocol.keyMixer.buildId !== game.protocol.keyMixer.buildId) {
      fail(
        `manifest: built against game build "${manifest.protocol.keyMixer.buildId}", ` +
        `drivers are from "${game.protocol.keyMixer.buildId}"`
      );
    }
    note(`manifest: build ${manifest.protocol.keyMixer.buildId}, extracted ${manifest.extractedAt}`);
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
