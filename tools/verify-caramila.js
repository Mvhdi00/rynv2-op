#!/usr/bin/env node
/*
 * verify-caramila.js
 *
 * Proves the transport port is the game's transport, by running the game's own
 * functions out of the shipped bundle and comparing them against the port on
 * the same inputs. Nothing here trusts that the code "looks right": the
 * reference side is `src/game_index.js` text, evaluated.
 *
 *   node tools/verify-caramila.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const GAME = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const Transport = require(path.join(ROOT, "src/caramila/transport.js"));

let failed = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(label, ok, detail) {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(label, 58)}${detail || ""}`);
}

/* ------------------------------------------------------------------ *
 * Pull the reference implementations straight out of the bundle.
 * ------------------------------------------------------------------ */
function slice(startRe, endRe, label) {
  const m = startRe.exec(GAME);
  if (!m) throw new Error(`anchor not found: ${label}`);
  const from = m.index;
  const rest = GAME.slice(from);
  const e = endRe.exec(rest);
  if (!e) throw new Error(`end anchor not found: ${label}`);
  return rest.slice(0, e.index + e[0].length);
}

/* Co (prng), Oi (shuffle), Po (tables), Do+Vt+j (sha256), he+Ao, Eo, Ro, and
 * the three constants they close over. */
const constants = /,\s*Io = 1\s*,\s*jt = 6\s*,\s*Ht = 1\s*,\s*bo = \[[\s\S]*?\];/.exec(GAME);
if (!constants) throw new Error("constant block not found");

const refSrc = [
  "const " + constants[0].replace(/^,\s*/, ""),
  slice(/function Co\(e\) \{/, /\n\}/, "Co"),
  slice(/function Oi\(e, t\) \{/, /\n\}/, "Oi"),
  slice(/function Po\(e\) \{/, /\n\}/, "Po"),
  slice(/const Do = new Uint32Array\(/, /\]\);/, "Do"),
  slice(/function Vt\(e\) \{/, /\n\}/, "Vt"),
  slice(/function j\(e, t\) \{/, /\n\}/, "j"),
  slice(/const he = 64;/, /const he = 64;/, "he"),
  slice(/function Ao\(e, t\) \{/, /\n\}/, "Ao"),
  slice(/function Eo\(e, t\) \{/, /\n\}/, "Eo"),
  slice(/function Ro\(e\) \{/, /\n\}/, "Ro"),
  "module.exports = { Co, Oi, Po, Vt, Ao, Eo, Ro, jt, Ht, Io, bo, To };"
].join("\n\n");

const sandbox = { module: { exports: {} }, Math, Uint8Array, Uint32Array, DataView, parseInt };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(refSrc, sandbox, { filename: "game-transport-reference.js" });
const ref = sandbox.module.exports;

console.log("\n1. constants — port against the bundle\n");
check("signature width is 6 bytes", Transport.SIG_BYTES === ref.jt, `${Transport.SIG_BYTES} vs ${ref.jt}`);
check("signed mode marker is 1", Transport.MODE_SIGNED === ref.Ht, `${Transport.MODE_SIGNED} vs ${ref.Ht}`);
check("table salt is 1", Transport.TABLE_SALT === ref.Io, `${Transport.TABLE_SALT} vs ${ref.Io}`);
check("c2s alphabet matches, in order",
  JSON.stringify(Transport.C2S) === JSON.stringify(ref.bo));
check("s2c alphabet matches, in order",
  JSON.stringify(Transport.S2C) === JSON.stringify(ref.To));

/* ------------------------------------------------------------------ */
console.log("\n2. opcode tables — every seed, every opcode\n");

const SEEDS = [0, 1, 2, 7, 255, 4096, 65535, 123456789, 2654435761, 4294967295,
  0x9e3779b9, 0xdeadbeef, 0x0badf00d];

let tableMismatch = null;
for (const seed of SEEDS) {
  const mine = Transport.buildTables(seed);
  const theirs = ref.Po(seed);
  for (const side of ["c2s", "s2c"]) {
    for (const k of Object.keys(theirs[side].enc)) {
      if (mine[side].enc[k] !== theirs[side].enc[k]) {
        tableMismatch = `seed ${seed} ${side}.enc[${k}] ${mine[side].enc[k]} vs ${theirs[side].enc[k]}`;
        break;
      }
    }
    for (const k of Object.keys(theirs[side].dec)) {
      if (mine[side].dec[k] !== theirs[side].dec[k]) {
        tableMismatch = `seed ${seed} ${side}.dec[${k}] ${mine[side].dec[k]} vs ${theirs[side].dec[k]}`;
        break;
      }
    }
  }
  if (tableMismatch) break;
}
check(`both tables match across ${SEEDS.length} seeds`, tableMismatch === null, tableMismatch || "");

/* A permutation has to actually be one: every opcode present, no collisions. */
{
  const t = Transport.buildTables(0x0badf00d);
  const vals = Object.values(t.c2s.enc);
  check("c2s is a bijection over all 17 opcodes",
    vals.length === Transport.C2S.length && new Set(vals).size === vals.length);
  const svals = Object.values(t.s2c.enc);
  check("s2c is a bijection over all 36 opcodes",
    svals.length === Transport.S2C.length && new Set(svals).size === svals.length);
}

/* ------------------------------------------------------------------ */
console.log("\n3. signing — SHA-256 and the truncated HMAC\n");

const hex = b => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
const bytes = s => new Uint8Array(Buffer.from(s, "utf8"));

/* Known-answer, so a shared bug in both sides cannot pass this. */
check("SHA-256 of \"abc\" is the published digest",
  hex(Transport.sha256(bytes("abc"))) ===
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
check("SHA-256 of the empty string is the published digest",
  hex(Transport.sha256(new Uint8Array(0))) ===
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
/* RFC 4231 case 1. */
check("HMAC-SHA256 matches RFC 4231 test case 1",
  hex(Transport.hmac(new Uint8Array(20).fill(0x0b), bytes("Hi There"))) ===
  "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");

let sigMismatch = null;
for (let i = 0; i < 200 && !sigMismatch; i++) {
  const key = new Uint8Array(16 + (i % 90));
  for (let k = 0; k < key.length; k++) key[k] = (i * 31 + k * 17) & 255;
  const body = new Uint8Array(i);
  for (let k = 0; k < body.length; k++) body[k] = (i + k * 7) & 255;
  const mine = Transport.sign(key, body);
  const theirs = ref.Eo(key, body);
  if (hex(mine) !== hex(theirs)) sigMismatch = `len ${i}: ${hex(mine)} vs ${hex(theirs)}`;
}
check("truncated HMAC matches the bundle over 200 bodies", sigMismatch === null, sigMismatch || "");
/* Including bodies that straddle a SHA block boundary, where padding is easy
 * to get wrong. */
{
  let boundary = null;
  for (const len of [55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]) {
    const key = Transport.hexToBytes("00112233445566778899aabbccddeeff");
    const body = new Uint8Array(len).fill(0xa5);
    if (hex(Transport.sign(key, body)) !== hex(ref.Eo(key, body))) boundary = `len ${len}`;
  }
  check("and at every SHA-256 block boundary", boundary === null, boundary || "");
}
/* A key longer than the 64-byte block is hashed first. */
{
  const key = new Uint8Array(200).fill(0x5c);
  check("a key longer than one block is handled the same way",
    hex(Transport.sign(key, bytes("x"))) === hex(ref.Eo(key, bytes("x"))));
}
check("hex key decoding matches",
  hex(Transport.hexToBytes("deadbeef0102")) === hex(ref.Ro("deadbeef0102")));

/* ------------------------------------------------------------------ */
console.log("\n4. frames — what actually goes on the wire\n");

/* A msgpack stand-in is not good enough here: the frame layout is the thing
 * under test, so use the real codec the userscript loads. */
let msgpack = null;
try { msgpack = require("msgpack-lite"); } catch (e) { /* optional */ }
if (!msgpack) {
  /* Minimal encoder/decoder covering the shapes the protocol uses, so the
   * layout can still be checked without a network install. */
  msgpack = (function () {
    function enc(v, out) {
      if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 128) out.push(v);
      else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 65536) { out.push(0xcd, v >> 8, v & 255); }
      else if (typeof v === "number" && Number.isInteger(v)) { out.push(0xce, (v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
      else if (typeof v === "string") { const b = Buffer.from(v, "utf8"); out.push(0xa0 | b.length); for (const x of b) out.push(x); }
      else if (Array.isArray(v)) { out.push(0x90 | v.length); for (const x of v) enc(x, out); }
      else if (v === null || v === undefined) out.push(0xc0);
      else if (v === true) out.push(0xc3);
      else if (v === false) out.push(0xc2);
      else throw new Error("unsupported " + typeof v);
    }
    function dec(b, s) {
      const t = b[s.i++];
      if (t < 128) return t;
      if (t === 0xcd) { const v = (b[s.i] << 8) | b[s.i + 1]; s.i += 2; return v; }
      if (t === 0xce) { const v = ((b[s.i] << 24) >>> 0) + (b[s.i + 1] << 16) + (b[s.i + 2] << 8) + b[s.i + 3]; s.i += 4; return v; }
      if ((t & 0xe0) === 0xa0) { const n = t & 31; const v = Buffer.from(b.subarray(s.i, s.i + n)).toString("utf8"); s.i += n; return v; }
      if ((t & 0xf0) === 0x90) { const n = t & 15; const a = []; for (let k = 0; k < n; k++) a.push(dec(b, s)); return a; }
      if (t === 0xc0) return null;
      if (t === 0xc3) return true;
      if (t === 0xc2) return false;
      throw new Error("unsupported tag 0x" + t.toString(16));
    }
    return {
      encode(v) { const out = []; enc(v, out); return new Uint8Array(out); },
      decode(b) { return dec(b, { i: 0 }); }
    };
  })();
  console.log("        (using the built-in msgpack stand-in; msgpack-lite not installed)");
}

const SEED = 0x0badf00d;
const KEY_HEX = "0011223344556677889900aabbccddee";
const t = new Transport(msgpack);
t.noteInit([42, SEED, KEY_HEX, 1]);

check("io-init puts the session into signed mode", t.signed());
check("and records the socket id", t.socketId === 42);

/* The frame the port builds, against the frame the bundle's own send() would
 * build for the same opcode, args and sequence number. */
{
  const tables = ref.Po(SEED);
  const key = ref.Ro(KEY_HEX);
  let frameMismatch = null;
  const cases = [["9", [1, 0]], ["e", [null]], ["z", [3, 1]], ["F", [1, 0.5, 1]], ["c", [0, 7, 0]]];
  const probe = new Transport(msgpack);
  probe.noteInit([1, SEED, KEY_HEX, 1]);
  for (const [type, args] of cases) {
    const mine = probe.encode(type, args);
    const seq = probe.seq;
    const body = msgpack.encode([tables.c2s.enc[type], args, seq]);
    const sig = ref.Eo(key, body);
    const theirs = new Uint8Array(ref.jt + body.length);
    theirs.set(sig, 0);
    theirs.set(body, ref.jt);
    if (hex(mine) !== hex(theirs)) frameMismatch = `${type}: ${hex(mine)} vs ${hex(theirs)}`;
  }
  check("outgoing frames are byte-identical to the bundle's", frameMismatch === null, frameMismatch || "");
}

/* Layout: signature first, then the body. */
{
  const probe = new Transport(msgpack);
  probe.noteInit([1, SEED, KEY_HEX, 1]);
  const frame = probe.encode("9", [1, 0]);
  const body = frame.subarray(Transport.SIG_BYTES);
  check("the frame is 6 signature bytes followed by the body",
    hex(frame.subarray(0, 6)) === hex(Transport.sign(Transport.hexToBytes(KEY_HEX), body)));
  const decoded = msgpack.decode(body);
  check("the body is [numeric opcode, args, seq]",
    typeof decoded[0] === "number" && Array.isArray(decoded[1]) && typeof decoded[2] === "number");
  check("and the opcode is the permuted one, not the letter",
    decoded[0] === ref.Po(SEED).c2s.enc["9"]);
}

/* The sequence number is the thing a replayed or duplicated frame trips on. */
{
  const probe = new Transport(msgpack);
  probe.noteInit([1, SEED, KEY_HEX, 1]);
  const seqs = [];
  for (let i = 0; i < 50; i++) {
    const f = probe.encode("9", [1, 0]);
    seqs.push(msgpack.decode(f.subarray(Transport.SIG_BYTES))[2]);
  }
  check("the sequence number increments once per frame, from 1",
    seqs.every((v, i) => v === i + 1), seqs.slice(0, 3).join(","));
  const first = probe.encode("e", [null]);
  const second = probe.encode("e", [null]);
  check("identical payloads still produce different frames",
    hex(first) !== hex(second));
}

/* Round trips, both directions. */
{
  const probe = new Transport(msgpack);
  probe.noteInit([1, SEED, KEY_HEX, 1]);
  const frame = probe.encode("z", [3, 1]);
  const back = probe.decodeOutgoing(frame);
  check("a signed frame reads back as its string opcode",
    back && back[0] === "z" && back[1][0] === 3 && back[1][1] === 1,
    back ? JSON.stringify(back) : "null");

  const tables = ref.Po(SEED);
  const server = msgpack.encode([tables.s2c.enc["a"], [[1, 2, 3]]]);
  const inbound = probe.decodeIncoming(server);
  check("a numeric server opcode maps back to its letter",
    inbound && inbound[0] === "a", inbound ? JSON.stringify(inbound[0]) : "null");

  const init = msgpack.encode(["io-init", [7, SEED, KEY_HEX, 1]]);
  const initBack = probe.decodeIncoming(init);
  check("io-init still arrives as a string opcode",
    initBack && initBack[0] === "io-init");

  check("an unknown numeric opcode is dropped, not guessed",
    probe.decodeIncoming(msgpack.encode([250, []])) === null);
  check("an unknown outgoing opcode is dropped, not sent",
    probe.encode(" nope", [1]) === null);
}

/* Legacy fallback: a server that does not announce mode 1 keeps the old wire. */
{
  const legacy = new Transport(msgpack);
  legacy.noteInit([3, 0, "", 0]);
  check("an unsigned session stays on the plain protocol", !legacy.signed());
  const frame = legacy.encode("9", [1, 0]);
  const parsed = msgpack.decode(frame);
  check("and its frames are plain [type, data] with no signature",
    parsed[0] === "9" && Array.isArray(parsed[1]) && parsed.length === 2);
  const back = legacy.decodeOutgoing(frame);
  check("which still read back correctly", back && back[0] === "9");
}

/* ------------------------------------------------------------------ */
console.log("\n5. the client — what was actually wrong\n");

const CARA = fs.readFileSync(path.join(ROOT, "src/CaraMila.user.js"), "utf8");
check("the bundle really does require signed frames (io-init mode 1)",
  /g\[3\] === Ht \? Z = \{/.test(GAME));
check("and really does permute outgoing opcodes",
  /const s = Z\.tables\.c2s\.enc\[e\];/.test(GAME));
check("and really does prefix the signature",
  /d\.set\(o, 0\),\s*d\.set\(a, jt\)/.test(GAME));
check("the shipped client sends plain msgpack with a string opcode",
  /let binary = msgpack\.encode\(\[type, data\]\);\s*\n\s*WS\.send\(binary\);/.test(CARA));
check("and dispatches incoming frames by string opcode only",
  /function getMessage\(message\) \{[\s\S]{0,400}packetEvents\[type\]/.test(CARA));

/* ------------------------------------------------------------------ */
console.log("\n6. the build — the fix as it ships\n");

const BUILT_PATH = path.join(ROOT, "CaraMila_Fixed.user.js");
if (!fs.existsSync(BUILT_PATH)) {
  check("CaraMila_Fixed.user.js exists (run node tools/build-caramila.js)", false);
} else {
  const built = fs.readFileSync(BUILT_PATH, "utf8").split("\r\n").join("\n");

  check("it installs before the bundle captures the original send",
    /\/\/ @run-at\s+document-start/.test(built));
  check("outgoing frames go through the transport",
    /let binary = caraTransport\.encode\(type, data\);/.test(built) &&
    !/let binary = msgpack\.encode\(\[type, data\]\);\n\s*this\.nsend/.test(built));
  check("incoming frames go through the transport",
    /let parsed = caraTransport\.decodeIncoming\(message\.data\);/.test(built));
  check("io-init is captured, not just read for the socket id",
    /socketID = caraTransport\.noteInit\(data\);/.test(built));
  check("the session resets when a new socket appears",
    /WS = this;\n\s*caraTransport\.reset\(\);/.test(built));
  check("packet() is tagged so the hook can tell it apart",
    /caraInternalFrame = true;[\s\S]{0,200}WS\.send\(msgpack\.encode\(\[type, data\]\)\);/.test(built));
  check("and the tag is always cleared",
    /\} finally \{\s*\n\s*caraInternalFrame = false;/.test(built));
  check("the UMD wrapper did not survive into the userscript",
    !/module\.exports/.test(built) && /const CaraTransport = \(function \(\) \{/.test(built));
  check("line endings are unchanged (still CRLF)",
    fs.readFileSync(BUILT_PATH, "utf8").indexOf("\r\n") !== -1);

  /* Nothing outside the fix moved.
   *
   * The fix replaces lines rather than only adding them, so the bar is not
   * "nothing was removed" — it is that every removed line is one of the ten
   * that implemented the old plain-msgpack transport. Anything else coming out
   * of this file would be collateral damage. */
  const OLD_TRANSPORT_LINES = [
    "        let data = new Uint8Array(message);",
    "        let parsed = msgpack.decode(data);",
    "        data = parsed[1];",
    "            let binary = msgpack.encode([type, data]);",
    "    let binary = msgpack.encode([type, data]);",
    "    WS.send(binary);",
    "    let data = new Uint8Array(message.data);",
    "    let parsed = msgpack.decode(data);",
    "    data = parsed[1];",
    "        socketID = data[0];"
  ];
  const original = CARA.split("\r\n").join("\n").split("\n");
  const patched = built.split("\n");
  let added = 0;
  const removed = [];
  let i = 0, j = 0;
  while (i < original.length || j < patched.length) {
    if (original[i] === patched[j]) { i++; j++; continue; }
    if (patched[j] !== undefined && original.indexOf(patched[j], i) === -1) { added++; j++; continue; }
    if (original[i] !== undefined && patched.indexOf(original[i], j) === -1) { removed.push(original[i]); i++; continue; }
    i++; j++;
  }
  const unexpected = removed.filter(l => OLD_TRANSPORT_LINES.indexOf(l) === -1);
  check("the only lines removed are the old transport's",
    unexpected.length === 0, unexpected.slice(0, 3).map(s => s.trim()).join(" | "));
  check("all ten of them are gone",
    removed.length === OLD_TRANSPORT_LINES.length, `${removed.length}`);
  /* Split the additions rather than capping them loosely: the transport module
   * is one self-contained block, and everything else is the handful of lines
   * that call into it. Checking the two separately means a change smuggled into
   * the wiring cannot hide behind the module's line count. */
  {
    const s = built.indexOf("const CaraTransport = (function () {");
    const e = built.indexOf("\n})();\n", s);
    const moduleLines = s > 0 && e > s ? built.slice(s, e).split("\n").length : Infinity;
    const wiring = added - moduleLines;
    check("the added transport module is one self-contained block",
      moduleLines > 150 && moduleLines < 280, `${moduleLines} lines`);
    check("and the wiring around it stays small",
      wiring >= 0 && wiring < 80, `${wiring} lines`);
  }

  /* ---- a whole session, end to end ------------------------------- */
  /* Pull the transport back out of the built file and run it against a server
   * that verifies frames the way the bundle's own code builds them. If this
   * passes, the client can complete a handshake and be understood. */
  const start = built.indexOf("const CaraTransport = (function () {");
  const endMark = "\n})();\n";
  const end = built.indexOf(endMark, start);
  check("the transport can be extracted from the built file", start > 0 && end > start);

  if (start > 0 && end > start) {
    const moduleSrc = built.slice(start, end + endMark.length) +
      "\nmodule.exports = CaraTransport;";
    const box = { module: { exports: {} }, Math, Uint8Array, Uint32Array, DataView,
      parseInt, Number, Array, Object, JSON };
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(moduleSrc, box, { filename: "built-transport.js" });
    const Built = box.module.exports;

    /* The server side, written from the bundle's own send(): verify the
     * signature over the body, map the opcode back, require a fresh sequence. */
    const SEED2 = 0x1234abcd;
    const KEY2 = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
    const keyBytes = ref.Ro(KEY2);
    const serverTables = ref.Po(SEED2);
    let lastSeq = 0;
    const rejected = [];

    function serverReceive(frame) {
      const sig = frame.subarray(0, ref.jt);
      const body = frame.subarray(ref.jt);
      const expect = ref.Eo(keyBytes, body);
      if (hex(sig) !== hex(expect)) { rejected.push("bad signature"); return null; }
      const parsed = msgpack.decode(body);
      const name = serverTables.c2s.dec[parsed[0]];
      if (name === undefined) { rejected.push("unknown opcode"); return null; }
      const seq = parsed[2];
      if (typeof seq !== "number" || seq <= lastSeq) { rejected.push("stale sequence " + seq); return null; }
      lastSeq = seq;
      return [name, parsed[1]];
    }

    const client = new Built(msgpack);
    /* The handshake, exactly as the server sends it. */
    const initFrame = msgpack.encode(["io-init", [77, SEED2, KEY2, 1]]);
    const initSeen = client.decodeIncoming(initFrame);
    check("the client reads io-init off the wire", initSeen && initSeen[0] === "io-init");
    check("and enters the game with the session it was given",
      client.noteInit(initSeen[1]) === 77 && client.signed());

    /* A realistic opening burst: spawn, move, attack, buy, place, chat. */
    const traffic = [
      ["M", [{ name: "player", moofoll: true, skin: 0 }]],
      ["9", [1.5, 1]], ["D", [0.4]], ["F", [1, 0.4, 1]],
      ["c", [0, 7, 0]], ["z", [3, 1]], ["K", [1, 1]],
      ["6", ["hello"]], ["e", [null]], ["S", [1, 1]], ["0", [1]]
    ];
    const seen = [];
    for (const [type, args] of traffic) {
      const frame = client.encode(type, args);
      const got = serverReceive(frame);
      if (got) seen.push(got[0]);
    }
    check("every frame of a full opening burst is accepted",
      seen.length === traffic.length && rejected.length === 0,
      rejected.length ? rejected.join(", ") : `${seen.length}/${traffic.length}`);
    check("and each arrives as the opcode that was sent",
      seen.join(",") === traffic.map(t => t[0]).join(","), seen.join(","));

    /* Sustained traffic: 500 frames, no sequence collision. */
    for (let k = 0; k < 500; k++) serverReceive(client.encode("9", [k / 100, 1]));
    check("500 further frames all carry a fresh sequence",
      rejected.length === 0 && lastSeq === traffic.length + 500,
      rejected.length ? rejected.join(", ") : `seq ${lastSeq}`);

    /* Server -> client, through the permuted table. */
    const inbound = client.decodeIncoming(msgpack.encode([serverTables.s2c.enc["a"], [[1]]]));
    check("server frames decode back to their letter opcode",
      inbound && inbound[0] === "a");

    /* A reconnect must not reuse the dead session. */
    client.reset();
    check("a reset drops the session", !client.signed());
    check("and an unsigned client falls back to the plain protocol rather than dying",
      msgpack.decode(client.encode("9", [1, 1]))[0] === "9");

    /* The old client, for contrast: what the server would have made of it. */
    lastSeq = 0; rejected.length = 0;
    const legacyFrame = msgpack.encode(["9", [1, 1]]);
    const legacyResult = serverReceive(legacyFrame);
    check("the unfixed client's frame is rejected by that same server",
      legacyResult === null, rejected[0] || "");
  }
}

console.log(failed
  ? `\nverify-caramila: ${failed} check(s) failed\n`
  : "\nverify-caramila: all checks pass\n");
process.exit(failed ? 1 : 0);
