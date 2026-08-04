#!/usr/bin/env node
/*
 * verify-whiteout.js
 *
 * Diffs the tables the Whiteout client carries inside its `Items` and `Store`
 * classes against drivers/game-drivers.json, and checks that the transport it
 * implements is the one the shipped bundle speaks.
 *
 *   node tools/verify-whiteout.js [path/to/client.user.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Whiteout_Abdo.user.js");

const client = fs.readFileSync(CLIENT_PATH, "utf8");
const game = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

const problems = [];
const notes = [];
const fail = (msg) => problems.push(msg);
const note = (msg) => notes.push(msg);

/* Evaluate a class declaration out of the client and instantiate it. */
function instantiate(name) {
  const at = client.search(new RegExp("^class\\s+" + name + "\\s*\\{", "m"));
  if (at === -1) throw new Error("class not found: " + name);

  let depth = 0, quote = null, end = -1;
  for (let i = client.indexOf("{", at); i < client.length; i++) {
    const c = client[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "/" && client[i + 1] === "/") { i = client.indexOf("\n", i); continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("unterminated class: " + name);

  const context = {
    Math,
    console,
    window: {},
    document: { createElement: () => ({ getContext: () => ({}) }) },
  };
  vm.createContext(context);
  vm.runInContext(
    client.slice(at, end + 1) + "\nglobalThis.__built = new " + name + "();",
    context
  );
  return context.__built;
}

function compare(label, mine, theirs, keys) {
  if (mine.length !== theirs.length) {
    fail(`${label}: client has ${mine.length} entries, game has ${theirs.length}`);
  }
  const n = Math.min(mine.length, theirs.length);
  for (let i = 0; i < n; i++) {
    for (const key of keys) {
      const a = JSON.stringify(mine[i][key]);
      const b = JSON.stringify(theirs[i][key]);
      if (a !== b) {
        fail(`${label}[${i}] ("${theirs[i].name}") ${key}=${a} but game has ${b}`);
      }
    }
  }
}

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("game   :", game.source.index, "+", game.source.vendor);
console.log("");

const items = instantiate("Items");
const store = instantiate("Store");

compare("itemGroups", items.groups, game.itemGroups,
  ["id", "name", "place", "limit", "sandboxLimit", "layer"]);

compare("weapons", items.weapons, game.weapons,
  ["name", "src", "dmg", "gather", "spdMult", "xOff", "yOff", "length", "width", "age", "type",
   "range", "speed", "armorP", "hitRange", "aMlt", "rec", "spdMlt"]);

compare("items", items.list, game.items,
  ["name", "src", "dmg", "scale", "holdOffset", "placeOffset", "health", "colDiv",
   "turnSpeed", "damage", "doUpdate", "projectile", "shootRange", "shootRate",
   "spawnDelay", "hideFromEnemy", "reqExtra", "preventPlace", "aiTurn", "pps", "pl",
   "itemGroup", "req", "age", "xp"]);

compare("projectiles", items.projectiles, game.projectiles,
  ["indx", "layer", "src", "dmg", "speed", "scale", "range"]);

compare("hats", store.hats, game.hats,
  ["id", "name", "desc", "price", "scale", "dontSell", "topSpeed", "healthRegen", "dmgMultO",
   "dmgMult", "dmgReduce", "bushGear", "spdMult", "atkSpd", "aMlt", "poisonDmg",
   "poisonDmgMult", "healD", "dmg", "antiBull", "hitSlow", "dmgK", "spdBoost",
   "kbResist", "invisTimer", "noEat", "blockDmg", "colDmg", "healthReduce", "dmgRed",
   "hitRange", "hitScare"]);

compare("accessories", store.accessories, game.accessories,
  ["id", "name", "desc", "price", "scale", "dontSell", "xOff", "spin", "spdMult", "healthRegen",
   "poisonDmg", "poisonDmgMult", "dmgReduce", "atkSpd", "kbResist", "dmg", "dmgMult"]);

/* Sprite paths have to match the bundle's, or every image 404s. */
{
  const bad = [...new Set(client.match(/"[^"]*img\/[a-zA-Z_/]*"/g) || [])]
    .filter((p) => !p.startsWith('"./img/'));
  if (bad.length) fail(`sprites: client loads from ${bad.join(", ")}, game uses "./img/"`);
}

/* Transport: the client has to speak the bundle's wire format. */
{
  const p = game.protocol;
  const want = [
    [`signature width ${p.signatureBytes}`, new RegExp("SIGNATURE_BYTES\\s*=\\s*" + p.signatureBytes + "\\b")],
    [`encrypted mode ${p.encryptedMode}`, new RegExp("ENCRYPTED_MODE\\s*=\\s*" + p.encryptedMode + "\\b")],
    [`table salt ${p.tableSalt}`, new RegExp("TABLE_SALT\\s*=\\s*" + p.tableSalt + "\\b")],
    ["c2s alphabet", new RegExp(p.c2sAlphabet.map((c) => `"${c}"`).join(",\\s*"))],
    ["s2c alphabet", new RegExp(p.s2cAlphabet.map((c) => `"${c}"`).join(",\\s*"))],
  ];
  for (const [label, re] of want) {
    if (!re.test(client)) fail(`protocol: client does not carry ${label}`);
  }
}

/* Every opcode the client sends has to exist in the bundle's c2s alphabet. */
{
  const c2s = new Set(game.protocol.c2sAlphabet);
  const sent = new Set();
  const re = /\b(?:packet2?|origPacket|io\.send|sendWS)\(\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(client))) sent.add(m[1]);
  const remap = client.match(/const botOpcodes = \{([^}]*)\}/);
  const aliased = new Set();
  if (remap) {
    for (const pair of remap[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)) aliased.add(pair[1]);
  }
  for (const type of sent) {
    if (c2s.has(type) || aliased.has(type)) continue;
    fail(`protocol: client sends "${type}", which is not a c2s opcode`);
  }
  note(`protocol: ${sent.size} distinct outgoing opcodes, all resolvable`);
}

/* Every handler the client registers has to exist in the bundle's s2c alphabet. */
{
  const s2c = new Set(game.protocol.s2cAlphabet);
  const table = client.match(/let events = \{([\s\S]*?)\n {4}\};/);
  if (!table) fail("protocol: could not find the client's s2c handler table");
  else {
    const keys = [...table[1].matchAll(/^\s{8}([A-Za-z0-9]+):/gm)].map((m) => m[1]);
    for (const key of keys) {
      if (!s2c.has(key)) fail(`protocol: client handles "${key}", which is not an s2c opcode`);
    }
    note(`protocol: ${keys.length} s2c handlers, all in the game's alphabet`);
  }
}

console.log(notes.map((n) => "note  " + n).join("\n"));
console.log("");

if (problems.length) {
  console.log(problems.map((p) => "DRIFT " + p).join("\n"));
  console.log(`\n${problems.length} mismatch(es) against the shipped game bundle.`);
  process.exit(1);
}

console.log("OK - client tables and transport match the shipped game bundle.");
