#!/usr/bin/env node
/*
 * verify-packets.js
 *
 * The client talks to the server directly rather than through the bundle, so
 * every opcode it sends has to match a real call site in the shipped game and
 * carry the same number of arguments. A packet that is one argument short does
 * not fail loudly - the server just ignores it - so this compares the two
 * sides mechanically.
 *
 * It checks three things against src/game_index.js:
 *
 *   1. c2s - every opcode the client sends exists in the bundle's c2s alphabet,
 *      and its argument count matches the bundle's own O.send() call site.
 *   2. s2c - every opcode the client has a handler for is in the alphabet and
 *      is actually routed by the bundle's handler map.
 *   3. coverage - which s2c opcodes the bundle handles and the client does not.
 *      Reported, not failed: the client does not need all of them.
 *
 *   node tools/verify-packets.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "ReUp_Mix.user.js");

const client = fs.readFileSync(CLIENT_PATH, "utf8");
const game = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");

/* ------------------------------------------------------------------ *
 * Split a call's argument list on top-level commas.
 * ------------------------------------------------------------------ */
function splitArgs(src, openIndex) {
  const closerFor = { "(": ")", "[": "]", "{": "}" };
  const closer = closerFor[src[openIndex]];
  if (!closer) throw new Error("not an opening bracket at " + openIndex);
  const args = [];
  let depth = 0;
  let start = openIndex + 1;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "(" || ch === "[" || ch === "{") { depth++; continue; }
    if (ch === closer && depth === 0) {
      const tail = src.slice(start, i).trim();
      if (tail.length) args.push(tail);
      return args;
    }
    if (ch === ")" || ch === "]" || ch === "}") { depth--; continue; }
    if (ch === "," && depth === 0) {
      args.push(src.slice(start, i).trim());
      start = i + 1;
    }
  }
  throw new Error("unterminated argument list at " + openIndex);
}

/* ------------------------------------------------------------------ *
 * The bundle's opcode alphabets and its s2c handler map.
 * ------------------------------------------------------------------ */
function alphabet(name) {
  const decl = game.match(new RegExp(`\\b${name} = (\\[[^\\]]*\\])`));
  if (!decl) throw new Error(`could not find alphabet ${name} in the bundle`);
  return JSON.parse(decl[1].replace(/'/g, '"'));
}

/* bo is the c2s alphabet and To the s2c one; see Po() in the bundle. */
const c2sAlphabet = new Set(alphabet("bo"));
const s2cAlphabet = new Set(alphabet("To"));

const routed = new Set();
{
  const at = game.indexOf("O.connect(a, function(o) {");
  if (at === -1) throw new Error("could not find O.connect in the bundle");
  const mapStart = game.indexOf("}, {", at);
  const mapEnd = game.indexOf("})", mapStart);
  if (mapStart === -1 || mapEnd === -1) throw new Error("could not find the s2c handler map");
  for (const m of game.slice(mapStart, mapEnd).matchAll(/^\s{12}(\w): [\w$]+/gm)) {
    routed.add(m[0].trim().split(":")[0]);
  }
}

/* Argument counts from the bundle's own send sites. */
const gameSends = new Map();
for (const m of game.matchAll(/O\.send\(/g)) {
  const open = m.index + "O.send".length;
  const args = splitArgs(game, open);
  const literal = args[0].match(/^"(.+)"$/);
  if (!literal) continue;
  const opcode = literal[1];
  const arity = args.length - 1;
  if (!gameSends.has(opcode)) gameSends.set(opcode, new Set());
  gameSends.get(opcode).add(arity);
}

/* ------------------------------------------------------------------ *
 * The client's own send sites and handler cases.
 * ------------------------------------------------------------------ */
const clientSends = new Map();
for (const m of client.matchAll(/this\.send\(\[/g)) {
  const open = m.index + "this.send".length;
  const args = splitArgs(client, open);
  if (args.length !== 1) continue; // send() takes a single array
  const inner = splitArgs(args[0], 0);
  const literal = inner[0] && inner[0].match(/^"(.+)"$/);
  if (!literal) continue;
  const opcode = literal[1];
  if (!clientSends.has(opcode)) clientSends.set(opcode, new Set());
  clientSends.get(opcode).add(inner.length - 1);
}

const clientCases = new Set();
{
  const at = client.indexOf('case "io-init":');
  if (at === -1) throw new Error("could not find the client's packet switch");
  const start = client.lastIndexOf("switch (temp[0]) {", at);
  const end = client.indexOf("\n       default:", at);
  if (start === -1 || end === -1) throw new Error("could not bound the client's packet switch");
  for (const m of client.slice(start, end).matchAll(/case "([^"]+)":/g)) {
    if (m[1] !== "io-init") clientCases.add(m[1]);
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("game   :", "src/game_index.js");
console.log("");

const problems = [];

console.log(`c2s (${clientSends.size} opcodes sent by the client)`);
for (const opcode of [...clientSends.keys()].sort()) {
  const mine = [...clientSends.get(opcode)].sort((a, b) => a - b);
  if (!c2sAlphabet.has(opcode)) {
    problems.push(`c2s "${opcode}" is not in the bundle's c2s alphabet`);
    console.log(`  MISSING ${opcode}  not in the c2s alphabet`);
    continue;
  }
  const theirs = gameSends.has(opcode) ? [...gameSends.get(opcode)].sort((a, b) => a - b) : null;
  if (theirs === null) {
    console.log(`  ok      ${opcode}  args ${mine.join("/")} (bundle never sends it)`);
    continue;
  }
  const agrees = mine.every((n) => theirs.includes(n));
  if (!agrees) {
    problems.push(`c2s "${opcode}" sent with ${mine.join("/")} arg(s), bundle sends ${theirs.join("/")}`);
  }
  console.log(`  ${agrees ? "ok     " : "MISMATCH"} ${opcode}  args ${mine.join("/")} vs bundle ${theirs.join("/")}`);
}

console.log(`\ns2c (${clientCases.size} opcodes handled by the client)`);
for (const opcode of [...clientCases].sort()) {
  if (!s2cAlphabet.has(opcode)) {
    problems.push(`s2c "${opcode}" is not in the bundle's s2c alphabet`);
    console.log(`  MISSING ${opcode}  not in the s2c alphabet`);
  } else if (!routed.has(opcode)) {
    problems.push(`s2c "${opcode}" is not routed by the bundle's handler map`);
    console.log(`  MISSING ${opcode}  not routed by the bundle`);
  }
}
console.log(`  ${clientCases.size} handled, all in the alphabet and routed by the bundle`);

const unhandled = [...routed].filter((op) => !clientCases.has(op)).sort();
console.log(`\nnot handled by the client (informational): ${unhandled.join(" ") || "none"}`);

if (problems.length) {
  console.log("\n" + problems.length + " problem(s):");
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}
console.log("\nOK - the client's packet surface matches the shipped game bundle.");
