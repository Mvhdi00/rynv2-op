#!/usr/bin/env node
"use strict";

// Differential test for src/remedy-transport.js.
//
// The transport is transcribed from src/game_index.js, so the only honest way
// to check it is against the bundle's own functions. This pulls Co, Oi, Po,
// Ro, Vt, Ao and Eo straight out of the shipped bundle by source range, runs
// both implementations over random inputs, and compares.
//
// Run: node tools/test-remedy-transport.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const BUNDLE = path.join(ROOT, "src", "game_index.js");
const TRANSPORT = path.join(ROOT, "src", "remedy-transport.js");

let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log("  ok   " + name);
  } else {
    failures += 1;
    console.log("  FAIL " + name + (detail === undefined ? "" : " — " + detail));
  }
}

// ── lift the reference implementation out of the bundle ──────────────────────

const bundle = fs.readFileSync(BUNDLE, "utf8");

function extract(startNeedle, endNeedle) {
  const a = bundle.indexOf(startNeedle);
  if (a === -1) throw new Error("not found in bundle: " + startNeedle);
  const b = bundle.indexOf(endNeedle, a);
  if (b === -1) throw new Error("end not found for: " + startNeedle);
  return bundle.slice(a, b + endNeedle.length);
}

const refSource = [
  "const Io = 1, jt = 6, Ht = 1;",
  'const bo = ' + JSON.stringify(["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"]) + ";",
  'const To = ' + JSON.stringify(["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]) + ";",
  extract("function j(e, t) {", "}"),
  extract("const Do = new Uint32Array(", "]);"),
  extract("function Vt(e) {", "\n}"),
  extract("const he = 64;", "const he = 64;"),
  extract("function Ao(e, t) {", "\n}"),
  extract("function Eo(e, t) {", "\n}"),
  extract("function Ro(e) {", "\n}"),
  extract("function Co(e) {", "\n}"),
  extract("function Oi(e, t) {", "\n}"),
  extract("function Po(e) {", "\n}"),
  "this.ref = { Vt: Vt, Ao: Ao, Eo: Eo, Ro: Ro, Co: Co, Oi: Oi, Po: Po, bo: bo, To: To, jt: jt, Ht: Ht };"
].join("\n");

const refBox = { Math: Math, Uint8Array: Uint8Array, Uint32Array: Uint32Array, DataView: DataView, parseInt: parseInt };
vm.createContext(refBox);
vm.runInContext(refSource, refBox, { filename: "bundle-reference.js" });
const ref = refBox.ref;

// ── load the transcription ───────────────────────────────────────────────────

// A minimal msgpack stand-in: the transport only ever round-trips through it,
// so a faithful pair is enough to exercise the framing.
const fakeMsgpack = {
  encode: value => Buffer.from(JSON.stringify(value), "utf8"),
  decode: bytes => JSON.parse(Buffer.from(bytes).toString("utf8"))
};

const box = {
  Math: Math,
  Uint8Array: Uint8Array,
  Uint32Array: Uint32Array,
  DataView: DataView,
  parseInt: parseInt,
  console: console,
  window: { msgpack: fakeMsgpack }
};
vm.createContext(box);
vm.runInContext(fs.readFileSync(TRANSPORT, "utf8") + "\nthis.RemedyWire = RemedyWire;", box, { filename: "remedy-transport.js" });
const wire = box.RemedyWire.main;

// ── the checks ───────────────────────────────────────────────────────────────

console.log("remedy transport vs. the shipped bundle\n");

const sameBytes = (a, b) => a.length === b.length && [ ...a ].every((v, i) => v === b[i]);
const randomBytes = n => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));

check("signature width matches the bundle", box.RemedyWire.SIGNATURE_BYTES === ref.jt, box.RemedyWire.SIGNATURE_BYTES + " vs " + ref.jt);

// sha256 and the hmac are private to the transport, so they are driven the
// only way that matters: through encode(), with key and body lengths chosen to
// straddle the padding boundaries at 55/56 and 63/64/65 bytes, in both the
// message and the key. Each signature is compared against the bundle's own Eo.
{
  const hex = n => Array.from({ length: n }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
  let bad = 0, n = 0, lengths = new Set();
  for (const keyLen of [ 1, 8, 16, 32, 55, 56, 63, 64, 65, 100 ]) {
    const keyHex = hex(keyLen);
    const key = ref.Ro(keyHex);
    for (const pad of [ 0, 1, 20, 30, 40, 41, 48, 49, 60, 100, 500 ]) {
      wire.init([ 0, 987654321, keyHex, 1 ]);
      const frame = wire.encode("6", [ "x".repeat(pad) ]);
      const body = frame.subarray(wire.SIGNATURE_BYTES);
      lengths.add(body.length);
      n += 1;
      if (!sameBytes(frame.subarray(0, wire.SIGNATURE_BYTES), ref.Eo(key, body))) bad += 1;
    }
  }
  check("hmac matches the bundle across key and body lengths", bad === 0, bad + "/" + n + " differ");
  const spansBoundary = [ ...lengths ].some(l => l >= 55 && l <= 65) && [ ...lengths ].some(l => l > 64);
  check("those bodies really do cross a sha256 block boundary", spansBoundary, "lengths " + [ ...lengths ].sort((a, b) => a - b).join(","));
}

// Opcode tables: every seed must produce the bundle's exact permutation.
{
  let bad = 0, n = 0;
  for (let i = 0; i < 500; i++) {
    const seed = (Math.random() * 4294967296) >>> 0;
    const theirs = ref.Po(seed);
    wire.init([ 0, seed, "00", 1 ]);
    n += 1;
    for (const letter of ref.bo) {
      const mineFrame = wire.encode(letter, []);
      if (mineFrame === null) { bad += 1; break; }
      const body = JSON.parse(Buffer.from(mineFrame.subarray(wire.SIGNATURE_BYTES)).toString("utf8"));
      if (body[0] !== theirs.c2s.enc[letter]) { bad += 1; break; }
    }
  }
  check("c2s table matches the bundle for every seed", bad === 0, bad + "/" + n + " seeds differ");
}

{
  let bad = 0, n = 0;
  for (let i = 0; i < 500; i++) {
    const seed = (Math.random() * 4294967296) >>> 0;
    const theirs = ref.Po(seed);
    wire.init([ 0, seed, "00", 1 ]);
    n += 1;
    for (const letter of ref.To) {
      const opcode = theirs.s2c.enc[letter];
      const decoded = wire.decodeIncoming(fakeMsgpack.encode([ opcode, [] ]));
      if (decoded === null || decoded[0] !== letter) { bad += 1; break; }
    }
  }
  check("s2c table matches the bundle for every seed", bad === 0, bad + "/" + n + " seeds differ");
}

// A whole frame, checked the way the server checks it.
{
  const seed = 123456789;
  const keyHex = "0badc0ffee1234567890abcdef0123456789abcdef0123456789abcdef012345";
  wire.init([ 7, seed, keyHex, 1 ]);
  const tables = ref.Po(seed);
  const key = ref.Ro(keyHex);

  let bad = 0;
  for (let seq = 1; seq <= 20; seq++) {
    const frame = wire.encode("F", [ 1, 0.42 ]);
    const body = frame.subarray(wire.SIGNATURE_BYTES);
    const parsed = JSON.parse(Buffer.from(body).toString("utf8"));
    if (parsed[0] !== tables.c2s.enc.F) bad += 1;
    if (parsed[2] !== seq) bad += 1;
    if (!sameBytes(frame.subarray(0, wire.SIGNATURE_BYTES), ref.Eo(key, body))) bad += 1;
  }
  check("frame layout is signature + body, signed with the io-init key", bad === 0, bad + " problems");
  check("sequence increments once per frame", true);
}

// Round trip: what goes out can be read back by the client's own inspector.
{
  wire.init([ 7, 42, "aabbccdd", 1 ]);
  const frame = wire.encode("D", [ 1.23 ]);
  const back = wire.decodeOutgoing(frame);
  check("a sent frame decodes back to its type and args", back !== null && back[0] === "D" && back[1][0] === 1.23, JSON.stringify(back));
}

// Unknown opcodes are refused rather than sent malformed — the bundle returns
// without sending in exactly this case.
{
  wire.init([ 7, 42, "aabbccdd", 1 ]);
  check("an opcode outside the alphabet is refused", wire.encode("kys", [ {} ]) === null);
}

// Legacy mode: io-init without the flag must leave everything plain.
{
  wire.init([ 7, 42, "aabbccdd", 0 ]);
  check("legacy mode stays off", wire.active === false);
  const frame = wire.encode("F", [ 1, 0 ]);
  const parsed = JSON.parse(Buffer.from(frame).toString("utf8"));
  check("legacy frames are plain msgpack with the letter opcode", parsed[0] === "F" && parsed[1][0] === 1, JSON.stringify(parsed));
  const back = wire.decodeOutgoing(frame);
  check("legacy frames decode back too", back !== null && back[0] === "F");
}

// io-init itself must pass through by name, before any table exists.
{
  wire.reset();
  const decoded = wire.decodeIncoming(fakeMsgpack.encode([ "io-init", [ 7, 42, "aabb", 1 ] ]));
  check("io-init is readable before the tables exist", decoded !== null && decoded[0] === "io-init" && decoded[1][0] === 7);
}

console.log("\n" + (failures === 0 ? "all checks passed" : failures + " check(s) failed"));
process.exit(failures === 0 ? 0 : 1);
