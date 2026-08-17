#!/usr/bin/env node
/*
 * extract-drivers.js
 *
 * Pulls the "drivers" — the game-side protocol constants and data tables that a
 * client has to agree with byte-for-byte — straight out of the shipped game
 * bundles (src/game_index.js, src/game_vendor.js) and writes them to
 * drivers/game-drivers.json.
 *
 * Everything here is sliced by locating the minified binding in the bundle and
 * evaluating just that literal, so the output tracks whatever bundle is dropped
 * in rather than a hand-copied snapshot.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const INDEX = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const VENDOR = fs.readFileSync(path.join(ROOT, "src/game_vendor.js"), "utf8");

const lines = INDEX.split("\n");

/* Find the 1-based line where a top-level minified binding is introduced.
 * `valuePattern` narrows what the binding must be assigned (object/array
 * literals by default) so short names do not collide with locals. */
function lineOf(name, valuePattern = "[\\[{]") {
  const re = new RegExp(
    "(?:^|[,;{]\\s*)(?:const\\s+|let\\s+|var\\s+)?" + name.replace(/\$/g, "\\$") + "\\s*=\\s*" + valuePattern
  );
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i + 1;
  }
  throw new Error("binding not found in game bundle: " + name);
}

/* Slice `name = <literal>` and evaluate the literal on its own. */
function literal(name, extraScope = {}) {
  const start = lineOf(name);
  const text = lines.slice(start - 1).join("\n");
  const eq = text.indexOf("=");
  const body = text.slice(eq + 1);

  const open = body.search(/[[{]/);
  const openCh = body[open];
  const closeCh = openCh === "[" ? "]" : "}";

  // Walk the literal tracking string/regex state so nested braces inside
  // strings ("#bf8f54", "./img/{...}") do not close the span early.
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
    else if (c === closeCh) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error("unterminated literal for " + name);

  const src = body.slice(open, end + 1);
  const sandbox = Object.assign({ Math, Date, Ut: null }, extraScope);
  return vm.runInNewContext("(" + src + ")", sandbox);
}

/* ---- config ---------------------------------------------------------------
 * `y` is built entirely out of single-letter consts declared just above it, so
 * evaluate that whole declaration run and read `y` back out.
 */
function extractConfig() {
  const start = lineOf("ks", "\\d");
  const end = lineOf("y");
  // The `y = {...}` object closes on the line holding a lone `}`.
  let close = end;
  while (lines[close - 1].trim() !== "}") close++;

  const src = lines.slice(start - 1, close).join("\n");
  const sandbox = { Math, Ut: null };
  vm.runInNewContext(src + "\n;__out = y;", sandbox);
  return sandbox.__out;
}

/* ---- protocol -------------------------------------------------------------
 * The opcode-table transport: signature width, mode id, the salt used to derive
 * the per-connection permutation, and the c2s/s2c opcode alphabets.
 */
function extractProtocol() {
  const num = (name) => {
    const m = INDEX.match(new RegExp("(?:^|[,;{]\\s*)(?:const\\s+|let\\s+|var\\s+)?" + name + "\\s*=\\s*(\\d+)"));
    if (!m) throw new Error("protocol constant not found: " + name);
    return Number(m[1]);
  };
  const arr = (name) => {
    const m = INDEX.match(new RegExp("(?:^|[,;{]\\s*)(?:const\\s+|let\\s+|var\\s+)?" + name + "\\s*=\\s*(\\[[^\\]]*\\])"));
    if (!m) throw new Error("protocol alphabet not found: " + name);
    return JSON.parse(m[1]);
  };

  return {
    signatureBytes: num("jt"),   // HMAC prefix length on every c2s frame
    encryptedMode: num("Ht"),    // io-init[3] value that switches the table on
    tableSalt: num("Io"),        // mixed into the seed before permuting
    c2sAlphabet: arr("bo"),
    s2cAlphabet: arr("To"),
    hmac: "sha256-truncated",
    codec: VENDOR.includes("msgpack") || /encodeSharedRef/.test(VENDOR)
      ? "msgpack"
      : "unknown",
  };
}

/* The animal table is assigned to `this.aiTypes` inside the AI-manager
 * constructor rather than to a top-level binding, so `literal()` cannot find it
 * by name. Slice it by its assignment site instead.
 *
 * It carries everything a client needs to reason about animals -- dmg, colDmg,
 * health, hitRange, hitDelay, viewRange, hostile, chargePlayer, killScore, drop
 * -- and none of it is derivable from anywhere else. */
function aiTypes() {
  const at = INDEX.indexOf("this.aiTypes = [");
  if (at < 0) throw new Error("aiTypes table not found in game bundle");
  const open = INDEX.indexOf("[", at);

  let depth = 0, quote = null, end = -1;
  for (let i = open; i < INDEX.length; i++) {
    const c = INDEX[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error("aiTypes literal did not close");
  return vm.runInNewContext("(" + INDEX.slice(open, end) + ")", {});
}

// Item entries carry `group: B[n]`, so the group table has to exist first.
const itemGroups = literal("B");

/* Food healing is not a field in the shipped table. Each food item carries a
 * `consume(player)` function that calls player.changeHealth directly, e.g.
 *
 *   consume: function(e) { return e.changeHealth(20, e) }          (apple)
 *   consume: function(e) { return e.changeHealth(30, e) || ...     (cheese)
 *                          (e.dmgOverTime.dmg = -10, ... time = 5) }
 *
 * A JSON dump drops the function, so anything reading `item.heal` would find
 * nothing and a client would have to guess the number. Instead of guessing,
 * run the game's own function against a recording stub and record what it did.
 * That keeps the figure authoritative even if the game retunes it. */
function probeConsumables(items) {
  for (const item of items) {
    if (typeof item.consume !== "function") continue;

    let healed = 0;
    const probe = {
      health: 1,
      maxHealth: 100,
      changeHealth(amount) { healed += amount; return true; },
      dmgOverTime: { dmg: 0, doer: null, time: 0 },
    };

    try {
      item.consume(probe);
    } catch (e) {
      console.warn("  ! consume probe failed for " + item.name + ": " + e.message);
      continue;
    }

    if (healed > 0) item.heal = healed;
    // A negative dmgOverTime is healing spread over `time` ticks.
    if (probe.dmgOverTime.dmg < 0 && probe.dmgOverTime.time > 0) {
      item.healOverTime = {
        perTick: -probe.dmgOverTime.dmg,
        ticks: probe.dmgOverTime.time,
      };
    }
  }
  return items;
}

const drivers = {
  extractedAt: new Date().toISOString(),
  source: {
    index: "src/game_index.js",
    vendor: "src/game_vendor.js",
  },
  protocol: extractProtocol(),
  config: extractConfig(),
  itemGroups,
  animals: aiTypes(),
  projectiles: literal("ca"),
  weapons: literal("ha"),
  items: probeConsumables(literal("Ce", { B: itemGroups })),
  hats: literal("ma"),
  accessories: literal("pa"),
};

const outPath = path.join(ROOT, "drivers/game-drivers.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(drivers, null, 2));

console.log("wrote", path.relative(ROOT, outPath));
for (const k of ["itemGroups", "animals", "projectiles", "weapons", "items", "hats", "accessories"]) {
  console.log(`  ${k.padEnd(12)} ${drivers[k].length} entries`);
}
console.log("  config       " + Object.keys(drivers.config).length + " keys");
console.log("  protocol     " + JSON.stringify(drivers.protocol));
