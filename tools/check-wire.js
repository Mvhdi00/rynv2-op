#!/usr/bin/env node
/*
 * check-wire.js
 *
 * The client carries its own copy of the game's transport — `RynWire` and
 * `RynSign` — because its own sockets (the bots') are not the game's and cannot
 * borrow the game's code. A copy that is a byte out anywhere is a connection
 * the server drops: the opcode tables disagree and the frame is unreadable, or
 * the signature is wrong and the frame is rejected.
 *
 * So this lifts both out of the client, lifts the real functions out of the
 * shipped bundle (tools/game-wire.js), and runs them against each other over a
 * spread of keys, seeds and payloads. Nothing is compared against a value
 * written down here — the game's own code is the reference.
 *
 *   node tools/check-wire.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const wire = require("./game-wire.js");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "ReUp_Mix.user.js");

const client = fs.readFileSync(CLIENT_PATH, "utf8");

/* ---- the client's side ----------------------------------------------------
 * `RynSign` and `RynWire` are each one `const X = new class { … }();`, so each
 * slices out whole. They are evaluated with nothing but the intrinsics: a piece
 * that reached for anything else would be a piece that cannot run in a bot's
 * socket either.
 */
function sliceClass(name) {
  const marker = "const " + name + " = new class {";
  const start = client.indexOf(marker);
  if (start === -1) throw new Error("not found in client: " + name);
  const end = client.indexOf("\n  }();", start);
  if (end === -1) throw new Error("unterminated class in client: " + name);
  return client.slice(start, end + "\n  }();".length);
}

const sandbox = {
  Math, parseInt, String, Array, JSON, isFinite, Function,
  Uint8Array, Uint32Array, Int32Array, WeakMap, Map, Set,
  // RynWire.protocol() reaches for the injector's module table; a bot that
  // cannot find it falls back to its own code, which is what is under test.
  RYN: undefined,
};
vm.createContext(sandbox);
vm.runInContext(sliceClass("RynSign") + "\n" + sliceClass("RynWire") + "\n;globalThis.__c={RynSign,RynWire};", sandbox);
const RynWire = sandbox.__c.RynWire;
const RynSign = sandbox.__c.RynSign;

const bundleText = fs.readFileSync(path.join(ROOT, wire.SOURCES.index), "utf8");

/* Let the client learn the alphabets off the bundle's own text, the way it does
 * at load, so what is checked is what it will actually be running. */
const learned = RynWire.learn(bundleText);

/*
 * A second instance, to tell reading the bundle apart from falling back to the
 * values written into the class.
 *
 * Those values are right for the bundle checked in here, so every comparison
 * below passes whether `learn()` found anything or not — which is exactly how
 * a `learn()` that silently stopped matching would go unnoticed until a build
 * changed one of them. This one has its constants wiped first, so it can only
 * agree with the game by having read them.
 */
vm.runInContext(
  sliceClass("RynWire").replace("const RynWire = new class", "const RynWireProbe = new class") +
  "\n;globalThis.__probe=RynWireProbe;",
  sandbox
);
const probe = sandbox.__probe;
probe.mode = -1;
probe.sigBytes = -1;
probe.defaultSalt = -1;
probe.c2sPlain = -1;
probe.s2cPlain = -1;
probe.c2s = [];
probe.s2c = [];
probe.learn(bundleText);

const game = wire.live();
const mixer = wire.mixer();

/* ---- comparing ------------------------------------------------------------ */

const problems = [];
const checks = [];

function ok(what) {
  checks.push(what);
}
function fail(what, detail) {
  problems.push(what + ": " + detail);
}

const hex = (bytes) => Buffer.from(bytes).toString("hex");

function same(what, a, b) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) {
    fail(what, "client " + x + " but the game " + y);
    return false;
  }
  return true;
}

/* A spread that covers the edges the arithmetic cares about: zero, one, the
 * sign bit, and the top of the word. */
const SEEDS = [0, 1, 2, 255, 65535, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff, 123456789, 1015555175];
const SALTS = [null, undefined, game.legacySalt, mixer.buildSalt, 1, 7, 0xffffffff];

function randomBytes(n, seed) {
  // Deterministic, so a failure can be reproduced from the report alone.
  const out = new Uint8Array(n);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    out[i] = s & 255;
  }
  return out;
}

/* ---- constants ------------------------------------------------------------ */

same("signature width", RynWire.sigBytes, game.sigBytes);
same("encrypted mode id", RynWire.mode, game.mode);
same("legacy table salt", RynWire.defaultSalt, game.legacySalt);
same("c2s alphabet", RynWire.c2s, game.c2sAlphabet);
same("c2s legacy count", RynWire.c2sPlain, game.c2sLegacyCount);
same("s2c alphabet", RynWire.s2c, game.s2cAlphabet);
same("s2c legacy count", RynWire.s2cPlain, game.s2cLegacyCount);
ok("constants");

if (!learned) {
  fail(
    "alphabet learning",
    "RynWire.learn() did not recognise the shipped bundle, so the client is " +
    "running on the alphabets hard-coded in it rather than the ones the game " +
    "is using"
  );
} else {
  ok("learn() reads the alphabets off the shipped bundle");
}

/* Each constant `learn()` is supposed to read, on an instance that had nothing
 * to fall back to. */
{
  const read = [
    ["transport mode", probe.mode, game.mode],
    ["frame signature width", probe.sigBytes, game.sigBytes],
    ["legacy table salt", probe.defaultSalt, game.legacySalt],
    ["c2s legacy count", probe.c2sPlain, game.c2sLegacyCount],
    ["s2c legacy count", probe.s2cPlain, game.s2cLegacyCount],
    ["c2s alphabet", probe.c2s, game.c2sAlphabet],
    ["s2c alphabet", probe.s2c, game.s2cAlphabet],
  ];
  let allRead = true;
  for (const [label, got, want] of read) {
    if (JSON.stringify(got) === JSON.stringify(want)) continue;
    allRead = false;
    fail(
      "learn() does not read " + label + " off the bundle",
      "got " + JSON.stringify(got) + ", the game has " + JSON.stringify(want) +
      " — the client would be running on the value written into RynWire, which " +
      "is right for this bundle and need not be for the next one"
    );
  }
  if (allRead) ok("learn() reads every protocol constant off the bundle, not from its own defaults");
}

/* ---- the hex key reader --------------------------------------------------- */

for (const seed of SEEDS) {
  const raw = randomBytes(16, seed);
  const h = hex(raw);
  if (!same("hex key reader (" + h + ")", Array.from(RynWire.hex(h)), Array.from(game.hex(h)))) break;
}
ok("hex key reader");

/* ---- the opcode tables ---------------------------------------------------- */

let tablesOk = true;
for (const seed of SEEDS) {
  for (const salt of SALTS) {
    const mine = RynWire.tables(seed, salt);
    const theirs = game.tables(seed, salt);
    const what = "opcode tables (seed " + seed + ", salt " + salt + ")";
    if (!same(what + " c2s enc", mine.c2s.enc, theirs.c2s.enc)) { tablesOk = false; break; }
    if (!same(what + " c2s dec", mine.c2s.dec, theirs.c2s.dec)) { tablesOk = false; break; }
    if (!same(what + " s2c enc", mine.s2c.enc, theirs.s2c.enc)) { tablesOk = false; break; }
    if (!same(what + " s2c dec", mine.s2c.dec, theirs.s2c.dec)) { tablesOk = false; break; }
  }
  if (!tablesOk) break;
}
if (tablesOk) ok("opcode tables, salted and plain");

/* ---- the masks ------------------------------------------------------------ */

let masksOk = true;
for (const seed of SEEDS) {
  const key = randomBytes(16, seed);
  const mine = RynWire.mask(key);
  const theirs = game.maskFrom(key);
  if (!same("mask split (key " + hex(key) + ")", mine, theirs)) { masksOk = false; break; }

  for (const n of [1, 2, 3, 17, 255, 65536, 0x7fffffff, 0xffffffff]) {
    if (!same(
      "inbound keystream seed (mask " + theirs.s2c + ", frame " + n + ")",
      RynWire.maskIn(theirs.s2c, n),
      game.maskIn(theirs.s2c, n)
    )) { masksOk = false; break; }
  }
  if (!masksOk) break;

  for (const sigSeed of [1, 9, 4242]) {
    const sig = randomBytes(game.sigBytes, sigSeed);
    if (!same(
      "outbound keystream seed (mask " + theirs.c2s + ", signature " + hex(sig) + ")",
      RynWire.maskOut(theirs.c2s, sig),
      game.maskVal(theirs.c2s, sig)
    )) { masksOk = false; break; }
  }
  if (!masksOk) break;
}
if (masksOk) ok("mask split and both keystream seeds");

/* ---- the keystream -------------------------------------------------------- */
/* Applied in place by both, and a length that is not a multiple of four is the
 * case a round-at-a-time implementation gets wrong, so every length from empty
 * to past two rounds is covered. */

let streamOk = true;
for (let len = 0; len <= 17 && streamOk; len++) {
  for (const seed of SEEDS) {
    const mine = randomBytes(len, seed + 1);
    const theirs = mine.slice();
    RynWire.xor(mine, seed);
    game.applyMask(theirs, seed);
    if (!same("keystream (" + len + " bytes, seed " + seed + ")", hex(mine), hex(theirs))) {
      streamOk = false;
      break;
    }
  }
}
if (streamOk) ok("keystream over every frame length up to two rounds");

/* ---- the frame signature -------------------------------------------------- */

let signOk = true;
for (const seed of SEEDS) {
  const key = randomBytes(16, seed);
  // Short, block-boundary and long payloads: HMAC's padding cases.
  for (const len of [0, 1, 55, 56, 63, 64, 65, 119, 120, 200]) {
    const data = randomBytes(len, seed + len + 1);
    if (!same(
      "frame signature (key " + hex(key) + ", " + len + " bytes)",
      hex(RynWire.sign(key, data)),
      hex(game.sign(key, data))
    )) { signOk = false; break; }
  }
  if (!signOk) break;
}
// A key longer than the HMAC block, which is hashed down first.
if (signOk) {
  const long = randomBytes(100, 77);
  const data = randomBytes(40, 78);
  signOk = same(
    "frame signature (100-byte key)",
    hex(RynWire.sign(long, data)),
    hex(game.sign(long, data))
  );
}
if (signOk) ok("frame signature, including both key and payload padding cases");

/* ---- the key mixer -------------------------------------------------------- */
/* The client takes mixKey from the protocol module rather than reimplementing
 * it, so what is checked is that it has somewhere to take it from, and that any
 * fallback it does carry agrees with the module. */

{
  const key = randomBytes(16, 5);
  const fallback = typeof RynWire.mixKey === "function" ? RynWire.mixKey.bind(RynWire) : null;
  if (!fallback) {
    checks.push(
      "key mixer: the client has no mixKey of its own and relies on capturing " +
      "the protocol module's export (see rynEnc)"
    );
  } else {
    let mixOk = true;
    for (const seed of SEEDS) {
      if (!same(
        "key mixer (seed " + seed + ")",
        hex(fallback(key, seed)),
        hex(mixer.mixKey(key, seed))
      )) { mixOk = false; break; }
    }
    if (mixOk) ok("key mixer agrees with the protocol module");
  }
}

/* ---- the build id --------------------------------------------------------- */
/* The socket URL carries `?<param>=<build id>`; a connection without it is
 * refused, and the client reads the id off the module rather than storing it. */

{
  const n = wire.names();
  if (!client.includes('"' + n.buildIdQueryParam + '="') && !client.includes("'" + n.buildIdQueryParam + "='")) {
    checks.push(
      'build id: the client does not write the "' + n.buildIdQueryParam +
      '=" parameter itself; its sockets inherit the URL the game built'
    );
  } else {
    ok('build id: the client writes "' + n.buildIdQueryParam + '=" into its socket URLs');
  }
}

/* ---- report --------------------------------------------------------------- */

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("game   :", wire.SOURCES.index, "+", wire.SOURCES.protocol);
console.log("");
for (const c of checks) console.log("  ok    " + c);

if (problems.length) {
  console.log("");
  for (const p of problems) console.log("  DRIFT " + p);
  console.log("\n" + problems.length + " difference(s) from the game's own transport.");
  process.exit(1);
}

console.log("\nOK - the client's transport matches the game's, function for function.");
