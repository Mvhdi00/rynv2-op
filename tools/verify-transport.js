#!/usr/bin/env node
/*
 * verify-transport.js
 *
 * Runs the transport primitives emitted into the fixed mods (tools/mod-transport.js)
 * head-to-head against the game's own, lifted straight out of src/game_index.js
 * and executed in a sandbox.
 *
 * This is the check that actually matters. A frame signed with the wrong HMAC,
 * or built from an opcode table that differs by one swap, is indistinguishable
 * from a working client right up until the server drops every packet — which is
 * exactly the failure the mods were in. So rather than eyeballing the
 * re-implementation, both sides are run on the same random inputs and compared.
 *
 *   node tools/verify-transport.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const T = require("./mod-transport.js");

const ROOT = path.resolve(__dirname, "..");
const GAME = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const DRIVERS = T.drivers();

/* ---- the game's own implementation ------------------------------------- *
 * Lines Io..Ro of the bundle: the alphabets, the seeded PRNG (Co), the
 * permutation (Oi), the table builder (Po), SHA-256 (Vt/j/Do), HMAC (Ao),
 * the truncation (Eo) and the hex decode (Ro). The leading `, Io = 1` is the
 * tail of a longer const chain, so it just needs its keyword back. */
function gameSide() {
  const lines = GAME.split("\n").map((l) => l.replace(/\r$/, ""));
  const from = lines.findIndex((l) => l === "  , Io = 1");
  const to = lines.findIndex((l) => l === "function Ro(e) {");
  if (from === -1 || to === -1) throw new Error("could not locate the transport block in game_index.js");

  /* Walk to the end of Ro's body. */
  let end = to;
  while (end < lines.length && lines[end] !== "}") end++;
  if (end === lines.length) throw new Error("unterminated Ro() in game_index.js");

  const src = "const " + lines.slice(from, end + 1).join("\n").replace(/^\s*,\s*/, "");

  const sandbox = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt, console };
  vm.runInNewContext(src + "\n; __api = { Po, Eo, Ro, Vt, Ao, jt, Ht, Io, bo, To };", sandbox);
  return sandbox.__api;
}

/* ---- the implementation shipped in the fixed mods ----------------------- */
function modSide() {
  const body = T.ioClientModule({
    protocol: DRIVERS.protocol,
    extras: "",
    msgpackId: "./node_modules/msgpack-lite/lib/browser.js",
  });

  const sandbox = {
    Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt, console,
    module: { exports: {} },
    window: {},
    __webpack_require__: () => ({ encode: () => new Uint8Array(0), decode: () => [] }),
  };
  sandbox.exports = sandbox.module.exports;

  vm.runInNewContext(
    body +
      "\n; __api = { buildTables, signFrame, hexToBytes, sha256, hmacSha256, SIG_BYTES, MODE_KEYED, TABLE_SALT, C2S_ALPHABET, S2C_ALPHABET };",
    sandbox
  );
  return sandbox.__api;
}

const game = gameSide();
const mod = modSide();

const problems = [];
function check(label, ok) {
  if (!ok) problems.push(label);
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ---- constants --------------------------------------------------------- */
check(`signature width (mod ${mod.SIG_BYTES} / game ${game.jt})`, mod.SIG_BYTES === game.jt);
check(`keyed mode (mod ${mod.MODE_KEYED} / game ${game.Ht})`, mod.MODE_KEYED === game.Ht);
check(`table salt (mod ${mod.TABLE_SALT} / game ${game.Io})`, mod.TABLE_SALT === game.Io);
check("c2s alphabet", JSON.stringify(mod.C2S_ALPHABET) === JSON.stringify(game.bo));
check("s2c alphabet", JSON.stringify(mod.S2C_ALPHABET) === JSON.stringify(game.To));

/* ---- opcode tables ----------------------------------------------------- *
 * Seeds are what io-init actually hands over: an arbitrary uint32. Includes
 * the edges, where a sign-extension slip would show up. */
const seeds = [0, 1, 2, 0x7fffffff, 0x80000000, 0xffffffff];
for (let i = 0; i < 250; i++) seeds.push(Math.floor(Math.random() * 4294967296));

let tablesChecked = 0;
for (const seed of seeds) {
  const a = game.Po(seed >>> 0);
  const b = mod.buildTables(seed >>> 0);
  for (const name of game.bo) {
    if (a.c2s.enc[name] !== b.c2s.enc[name]) {
      check(`c2s opcode for "${name}" at seed ${seed} (game ${a.c2s.enc[name]} / mod ${b.c2s.enc[name]})`, false);
    }
    tablesChecked++;
  }
  for (const name of game.To) {
    if (a.s2c.enc[name] !== b.s2c.enc[name]) {
      check(`s2c opcode for "${name}" at seed ${seed} (game ${a.s2c.enc[name]} / mod ${b.s2c.enc[name]})`, false);
    }
    /* The decode direction is what the mod uses on inbound frames. */
    const op = a.s2c.enc[name];
    if (b.s2c.dec[op] !== name) {
      check(`s2c decode of ${op} at seed ${seed} (expected "${name}", got "${b.s2c.dec[op]}")`, false);
    }
    tablesChecked++;
  }
}

/* ---- hex key decode ---------------------------------------------------- */
let hexChecked = 0;
for (let i = 0; i < 100; i++) {
  const len = 2 + 2 * Math.floor(Math.random() * 32);
  let hex = "";
  for (let j = 0; j < len; j++) hex += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  if (!sameBytes(game.Ro(hex), mod.hexToBytes(hex))) check(`hex decode of ${hex}`, false);
  hexChecked++;
}

/* ---- signatures -------------------------------------------------------- *
 * Message lengths straddle the SHA-256 block boundary (55/56/63/64/65 bytes
 * are where a padding bug bites) and keys straddle the 64-byte HMAC block. */
const lengths = [0, 1, 55, 56, 63, 64, 65, 119, 120, 127, 128, 129, 200, 1000];
for (let i = 0; i < 40; i++) lengths.push(Math.floor(Math.random() * 2048));

let sigChecked = 0;
for (const len of lengths) {
  for (const keyLen of [16, 32, 64, 65, 100]) {
    const key = new Uint8Array(keyLen);
    for (let i = 0; i < keyLen; i++) key[i] = Math.floor(Math.random() * 256);
    const msg = new Uint8Array(len);
    for (let i = 0; i < len; i++) msg[i] = Math.floor(Math.random() * 256);

    if (!sameBytes(game.Vt(msg), mod.sha256(msg))) check(`sha256 at length ${len}`, false);
    if (!sameBytes(game.Ao(key, msg), mod.hmacSha256(key, msg)))
      check(`hmac at msg ${len} / key ${keyLen}`, false);
    if (!sameBytes(game.Eo(key, msg), mod.signFrame(key, msg)))
      check(`frame signature at msg ${len} / key ${keyLen}`, false);
    sigChecked++;
  }
}

/* ---- SHA-256 against a known vector ------------------------------------ *
 * Guards against both sides being wrong in the same way. */
{
  const abc = new Uint8Array([97, 98, 99]);
  const want = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  const got = Array.from(mod.sha256(abc)).map((b) => b.toString(16).padStart(2, "0")).join("");
  check(`sha256("abc") = ${got}`, got === want);
}

console.log(`opcode table entries : ${tablesChecked} across ${seeds.length} seeds`);
console.log(`hex key decodes      : ${hexChecked}`);
console.log(`signatures           : ${sigChecked} (sha256 + hmac + truncation each)`);
console.log("");

if (problems.length) {
  console.log(problems.map((p) => "MISMATCH " + p).join("\n"));
  console.log(`\n${problems.length} mismatch(es) against src/game_index.js.`);
  process.exit(1);
}

console.log("OK - transport matches the shipped game bundle byte for byte.");
