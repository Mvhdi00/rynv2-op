/* Checks a client's transport against the game's own implementation.
 *
 * The wire format is unforgiving: the opcode tables are a seeded shuffle that
 * has to land on exactly the server's permutation, and the frame prefix is a
 * truncated HMAC that is either right to the byte or rejected. A port that is
 * subtly off connects and then silently receives nothing, which looks exactly
 * like the bug it was meant to fix.
 *
 * So run both implementations — the one lifted out of src/game_index.js and the
 * one lifted out of the client — over the same seeds, keys and payloads, and
 * compare the results.
 *
 *   node transport-check.js [client.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = process.argv[2] || path.join(ROOT, "revelation/Revelation.user.js");

/* The game's transport, straight out of the shipped bundle. */
const game = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8").split("\n");
const gameBlock = game.slice(277, 405).join("\n").replace(", Io = 1", "const Io = 1", 1);
const gameCtx = { Math, Uint8Array, Uint32Array, DataView, parseInt };
vm.createContext(gameCtx);
vm.runInContext(gameBlock + "\n; this.__api = { tables: Po, sign: Eo, hex: Ro, sigBytes: jt, mode: Ht };", gameCtx);
const G = gameCtx.__api;

/* The client's transport. */
const client = fs.readFileSync(CLIENT, "utf8");
const start = client.indexOf("const RevTransport = (function () {");
if (start === -1) {
  /* Only the block this repo ports in is recognised by name. A client that
   * implements the transport under its own names — Whiteout and Novastorm both
   * do — is not checkable this way, and saying it speaks the old protocol would
   * be wrong. Fall back to looking for the transport's fingerprints. */
  const marks = [/2654435761/, /"M", ?"D", ?"9"/, /1116352408/];
  const found = marks.filter((m) => m.test(client)).length;
  console.log(path.basename(CLIENT) + ": no RevTransport block to compare.");
  console.log(found === marks.length
    ? "  It carries the transport's fingerprints under its own names, so this tool cannot check it."
    : "  It carries " + found + " of " + marks.length + " transport fingerprints — it likely speaks the old protocol.");
  process.exit(found === marks.length ? 0 : 1);
}
const end = client.indexOf("\n})();", start) + "\n})();".length;
const clientCtx = { Math, Uint8Array, Uint32Array, DataView, parseInt };
vm.createContext(clientCtx);
vm.runInContext(client.slice(start, end) + "\n; this.__api = RevTransport;", clientCtx);
const C = clientCtx.__api;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let problems = 0;
const fail = (m) => { problems++; console.log("  MISMATCH: " + m); };

if (C.signatureBytes !== G.sigBytes) fail("signature width " + C.signatureBytes + " vs " + G.sigBytes);
if (C.encryptedMode !== G.mode) fail("transport mode " + C.encryptedMode + " vs " + G.mode);

const rand = mulberry32(20260828);
let seedsChecked = 0, framesChecked = 0;

for (let n = 0; n < 200; n++) {
  const seed = (rand() * 0xffffffff) >>> 0;
  const a = C.tables(seed), b = G.tables(seed);
  seedsChecked++;
  for (const dir of ["c2s", "s2c"]) {
    const ka = Object.keys(a[dir].enc).sort(), kb = Object.keys(b[dir].enc).sort();
    if (ka.join() !== kb.join()) { fail(dir + " alphabet differs at seed " + seed); continue; }
    for (const letter of ka) {
      if (a[dir].enc[letter] !== b[dir].enc[letter])
        fail(dir + " seed " + seed + ": '" + letter + "' -> " + a[dir].enc[letter] + " vs " + b[dir].enc[letter]);
    }
    for (const op of Object.keys(b[dir].dec)) {
      if (a[dir].dec[op] !== b[dir].dec[op])
        fail(dir + " seed " + seed + ": op " + op + " -> " + a[dir].dec[op] + " vs " + b[dir].dec[op]);
    }
  }
}

for (let n = 0; n < 200; n++) {
  const hex = Array.from({ length: 32 }, () => ("0" + Math.floor(rand() * 256).toString(16)).slice(-2)).join("");
  const keyA = C.keyFromHex(hex), keyB = G.hex(hex);
  if (Buffer.from(keyA).toString("hex") !== Buffer.from(keyB).toString("hex")) { fail("key from hex differs"); continue; }
  const payload = new Uint8Array(Array.from({ length: 1 + Math.floor(rand() * 80) }, () => Math.floor(rand() * 256)));
  const sa = Buffer.from(C.sign(keyA, payload)).toString("hex");
  const sb = Buffer.from(G.sign(keyB, payload)).toString("hex");
  framesChecked++;
  if (sa !== sb) fail("signature differs: " + sa + " vs " + sb);
}

/* A correct transport still delivers nothing if the handler table is keyed on a
 * different opcode set, so check the vocabulary too. */
let handlerNote = "not found";
const at = client.indexOf("ee.connect(");
if (at !== -1) {
  const open = client.indexOf("}, {", at) + 3;
  let depth = 0, close = -1;
  for (let i = open; i < client.length; i++) {
    const ch = client[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close !== -1) {
    const keys = [...client.slice(open, close + 1).matchAll(/^\s{6}([A-Za-z0-9])\s*:/gm)].map((m) => m[1]);
    const alphabet = G.tables(1).s2c;
    const expected = Object.keys(alphabet.enc);
    const missing = expected.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !expected.includes(k));
    if (missing.length) fail("no handler for s2c opcode(s): " + missing.join(" "));
    if (extra.length) fail("handler for opcode(s) the server cannot send: " + extra.join(" "));
    handlerNote = keys.length + " of " + expected.length + (missing.length || extra.length ? "" : ", complete");
  }
}

console.log(path.basename(CLIENT) + " vs the shipped game");
console.log("  s2c handlers:             " + handlerNote);
console.log("  signature width and mode: " + (problems === 0 ? "match" : "see above"));
console.log("  opcode tables compared:   " + seedsChecked + " seeds x both directions");
console.log("  signatures compared:      " + framesChecked);
console.log(problems === 0
  ? "  byte-for-byte identical to the game's own transport"
  : "  " + problems + " mismatch(es)");
process.exit(problems === 0 ? 0 : 1);
