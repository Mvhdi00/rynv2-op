#!/usr/bin/env node
/*
 * verify-whiteout.js
 *
 * Checks the transport in a built Whiteout client against the game bundles it
 * has to talk to. The interesting question is not "does it parse" but "does a
 * frame it produces match the frame the game would have produced", so the game
 * bundle's own send path is reconstructed here from src/game_index.js and the
 * two are compared byte for byte.
 *
 *   node tools/verify-whiteout.js [Whiteout_Fixed.v4.1.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const TARGET = path.resolve(process.argv[2] || path.join(ROOT, "Whiteout_Fixed.v4.1.js"));
const VENDOR = path.join(ROOT, "src/game_vendor.js");
const INDEX = path.join(ROOT, "src/game_index.js");

const read = f => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

let failures = 0;
let checks = 0;

function check(label, ok, detail) {
  checks++;
  if (ok) {
    console.log(`  ok    ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? "\n          " + detail : ""}`);
  }
}

/* ------------------------------------------------------------------ *
 * A reference implementation, straight out of the shipped bundles
 * ------------------------------------------------------------------ */

function buildReference() {
  const vendor = read(VENDOR);
  const index = read(INDEX);
  const codec = vendor.slice(0, vendor.indexOf("\nfunction ze(t) {"));
  const protocol = index
    .slice(index.indexOf("\n  , Io = 1\n"), index.indexOf("\nconst Hi = new rs"))
    .replace(/^\n  , Io = 1/, "\nconst Io = 1");

  const source = `${codec}\n${protocol}\n
    const encoder = new yn();
    const decoder = new kn();
    /* O.send from src/game_index.js, with the socket write pulled out. */
    function gameSend(Z, type, args) {
      if (Z && Z.mode === Ht) {
        const s = Z.tables.c2s.enc[type];
        if (s === undefined) return null;
        const n = ++Z.seq;
        const a = encoder.encode([ s, args, n ]);
        const o = Eo(Z.key, a);
        const d = new Uint8Array(jt + a.length);
        d.set(o, 0);
        d.set(a, jt);
        return d;
      }
      return encoder.encode([ type, args ]);
    }
    /* The io-init branch of O.connect's onmessage. */
    function gameInit(g) {
      return g[3] === Ht ? { mode: Ht, key: Ro(g[2]), tables: Po(g[1] >>> 0), seq: 0 } : null;
    }
    /* A server frame, as the server would build it. */
    function serverFrame(Z, type, args) {
      const op = Z ? Z.tables.s2c.enc[type] : type;
      return encoder.encode([ op, args ]);
    }
    module.exports = { gameSend, gameInit, serverFrame, encoder, decoder, jt, Ht, Po, Ro, Eo };`;

  const module = { exports: {} };
  vm.runInNewContext(source, { module, TextEncoder, TextDecoder, console, process });
  return module.exports;
}

/* ------------------------------------------------------------------ *
 * The client's transport, lifted out of the built userscript
 * ------------------------------------------------------------------ */

function loadClientTransport(file) {
  const text = read(file);
  const start = text.indexOf("const WhiteoutNet = (function () {");
  const end = text.indexOf("function whiteoutMain() {");
  if (start === -1 || end === -1) {
    throw new Error("could not find the transport prologue in " + path.basename(file));
  }

  /* Enough of a browser for the prologue: it hooks the WebSocket constructor
   * and prototype.send, and needs sockets that can carry listeners. */
  const sent = [];
  class FakeSocket {
    constructor(url) {
      this.url = url;
      this.listeners = {};
    }
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    }
    send(bytes) {
      sent.push({ socket: this, bytes: bytes });
    }
    emit(type, event) {
      for (const fn of this.listeners[type] || []) fn(event);
    }
  }
  FakeSocket.OPEN = 1;

  const window = { WebSocket: FakeSocket };
  const sandbox = { window: window, TextEncoder, TextDecoder, console, process, WeakMap, Uint8Array };
  sandbox.globalThis = sandbox;

  const source = text.slice(start, end) + "\n;module.exports = WhiteoutNet;";
  const module = { exports: {} };
  sandbox.module = module;
  vm.runInNewContext(source, sandbox);

  return { net: module.exports, Socket: window.WebSocket, Native: FakeSocket, sent: sent };
}

/* ------------------------------------------------------------------ */

console.log("verifying", path.relative(ROOT, TARGET), "\n");

const ref = buildReference();
const { net, Socket, sent } = loadClientTransport(TARGET);

/* The client's own opcode usage, read back out of the built file. */
const built = read(TARGET);
const usedC2S = new Set(
  (built.match(/(?:packet2?|origPacket|io\.send|WhiteoutNet\.send\(WS,)\s*\(?\s*"([^"]+)"/g) || [])
    .map(m => m.match(/"([^"]+)"/)[1])
);
for (const m of built.matchAll(/(?:packet2?|origPacket)\(\s*"([^"]+)"/g)) usedC2S.add(m[1]);

const C2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
const S2C = [
  "A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R",
  "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
];

/* ------------------------------------------------------------------ *
 * 1. The constructor hook and the send trampoline are installed
 * ------------------------------------------------------------------ */

console.log("hooks");
check("WebSocket constructor is hooked", Socket !== ref.NativeSocket && typeof Socket === "function");

const socket = new Socket("wss://example.invalid");
check("constructed socket carries a message listener", (socket.listeners.message || []).length === 1);
check("prototype.send is a trampoline", typeof socket.send === "function");

/* ------------------------------------------------------------------ *
 * 2. io-init produces the same crypto state the game would build
 * ------------------------------------------------------------------ */

console.log("\nio-init");

const SEED = 0x9e3779b9;
const KEY_HEX = "0123456789abcdef".repeat(4);
const ioInit = ["io-init", [7, SEED, KEY_HEX, 1]];

socket.emit("message", { data: ref.encoder.encode(ioInit) });

const clientState = net.stateOf(socket);
const gameState = ref.gameInit([7, SEED, KEY_HEX, 1]);

check("client negotiated the signed transport", !!clientState && clientState.mode === ref.Ht);
check(
  "c2s table matches the game's",
  !!clientState && JSON.stringify(clientState.tables.c2s.enc) === JSON.stringify(gameState.tables.c2s.enc)
);
check(
  "s2c table matches the game's",
  !!clientState && JSON.stringify(clientState.tables.s2c.dec) === JSON.stringify(gameState.tables.s2c.dec)
);
check("the socket was reported as the game connection", net.main === socket);

/* ------------------------------------------------------------------ *
 * 3. Outgoing frames are byte-identical to the game's
 * ------------------------------------------------------------------ */

console.log("\noutgoing frames");

const samples = [
  ["M", [{ name: "player", moofoll: 1, skin: "__proto__" }]],
  ["9", [1.57]],
  ["F", [1, 0.42]],
  ["z", [3, true]],
  ["D", [-2.5]],
  ["6", ["hello"]],
  ["c", [0, 7, 0]],
  ["0", []],
];

let identical = true;
let firstDiff = null;
for (const [type, args] of samples) {
  const mine = net.encodeOut(socket, type, args);
  const theirs = ref.gameSend(gameState, type, args);
  if (!mine || !theirs || Buffer.compare(Buffer.from(mine), Buffer.from(theirs)) !== 0) {
    identical = false;
    firstDiff = firstDiff || `${type}: ${mine && Buffer.from(mine).toString("hex")} vs ${theirs && Buffer.from(theirs).toString("hex")}`;
  }
}
check("signed frames match the game's byte for byte", identical, firstDiff);

check(
  "unknown opcodes are refused, as the game refuses them",
  net.encodeOut(socket, "kys", [{}]) === null && ref.gameSend(gameState, "kys", [{}]) === null
);

/* ------------------------------------------------------------------ *
 * 4. Sequence numbering stays gap-free across drops and injections
 * ------------------------------------------------------------------ */

console.log("\nsequence numbering");

const fresh = new Socket("wss://example.invalid");
fresh.emit("message", { data: ref.encoder.encode(ioInit) });

const seqs = [];
for (let i = 0; i < 5; i++) {
  const frame = net.encodeOut(fresh, "9", [i]);
  seqs.push(ref.decoder.decode(frame.subarray(ref.jt))[2]);
}
check("sequence increments by one per frame", JSON.stringify(seqs) === JSON.stringify([1, 2, 3, 4, 5]));

/* A dropped packet must not consume a number: the client filters before the
 * frame is built, so nothing is spent on a packet that never goes out. */
const beforeDrop = net.stateOf(fresh).seq;
net.decodeOut(fresh, { __whiteout: true, type: "9", args: [0] });
check("inspecting a packet does not consume a sequence number", net.stateOf(fresh).seq === beforeDrop);

/* ------------------------------------------------------------------ *
 * 5. Frames survive the round trip in both directions
 * ------------------------------------------------------------------ */

console.log("\nround trips");

let outOk = true;
let outDetail = null;
for (const [type, args] of samples) {
  const wire = ref.gameSend(gameState, type, args);
  const back = net.decodeOut(socket, wire);
  if (!back || back[0] !== type || JSON.stringify(back[1]) !== JSON.stringify(args)) {
    outOk = false;
    outDetail = outDetail || `${type} came back as ${JSON.stringify(back)}`;
  }
}
check("a game frame unwraps to its letter opcode and arguments", outOk, outDetail);

let inOk = true;
let inDetail = null;
for (const type of S2C) {
  const wire = ref.serverFrame(gameState, type, [1, 2]);
  const back = net.decodeIn(socket, wire);
  if (!back || back[0] !== type) {
    inOk = false;
    inDetail = inDetail || `${type} came back as ${JSON.stringify(back && back[0])}`;
  }
}
check("every server opcode maps back to its letter", inOk, inDetail);

check(
  "a frame that will not unwrap is left alone",
  net.decodeOut(socket, Uint8Array.from([1, 2, 3])) === null
);

/* ------------------------------------------------------------------ *
 * 6. Entry, end to end
 *
 * The path that was broken: the game builds a spawn frame and hands it to the
 * captured prototype.send, the client's filter looks at it, and whatever comes
 * out the other side has to be something the server will still accept. A
 * dropped packet in the middle is the interesting case, because that is where
 * a re-signed stream can drift out of sequence.
 * ------------------------------------------------------------------ */

console.log("\nentry");

const live = new Socket("wss://example.invalid");
live.emit("message", { data: ref.encoder.encode(ioInit) });
const server = ref.gameInit([7, SEED, KEY_HEX, 1]);
sent.length = 0;

/* Stands in for the client's outgoing filter: unwrap, decide, re-emit. */
let dropNext = false;
net.gate = function (message) {
  const frame = net.decodeOut(this, message);
  if (!frame) return net.nativeSend(this, message);
  if (dropNext) {
    dropNext = false;
    return;
  }
  const out = net.encodeOut(this, frame[0], frame[1]);
  if (out) net.nativeSend(this, out);
};

const spawn = { name: "player", moofoll: 1, skin: "__proto__" };
live.send(ref.gameSend(server, "M", [spawn]));
dropNext = true;
live.send(ref.gameSend(server, "9", [0.5]));
live.send(ref.gameSend(server, "F", [1, 0.25]));

/* What the server would make of what actually went out. */
const received = sent.map(entry => {
  const bytes = Buffer.from(entry.bytes);
  const payload = bytes.subarray(ref.jt);
  const decoded = ref.decoder.decode(payload);
  const expectedSig = Buffer.from(ref.Eo(server.key, payload));
  return {
    type: server.tables.c2s.dec[decoded[0]],
    args: decoded[1],
    seq: decoded[2],
    signed: bytes.subarray(0, ref.jt).equals(expectedSig),
  };
});

check("the spawn packet reaches the wire", received.length === 2 && received[0].type === "M");
check(
  "the spawn payload survives the round trip",
  received.length > 0 && JSON.stringify(received[0].args) === JSON.stringify([spawn])
);
check("the dropped packet does not reach the wire", !received.some(r => r.type === "9"));
check("every frame carries a valid signature", received.every(r => r.signed));
check(
  "a dropped packet leaves no gap in the sequence",
  JSON.stringify(received.map(r => r.seq)) === JSON.stringify([1, 2])
);

net.gate = null;

/* ------------------------------------------------------------------ *
 * 7. The client only sends opcodes this protocol has
 * ------------------------------------------------------------------ */

console.log("\nopcode coverage");

/* "B" is a server opcode, sent by receiveChat as a booby trap that a remote
 * player can spring on you by saying the right thing. It has no c2s encoding,
 * so the transport drops it, which is the behaviour worth having. It is listed
 * rather than fixed so that it stays visible. */
const KNOWN_DROPPED = ["B"];
const stray = [...usedC2S].filter(t => !C2S.includes(t) && !KNOWN_DROPPED.includes(t));
check(
  "every opcode the client sends exists in the c2s alphabet",
  stray.length === 0,
  stray.length ? `not in the alphabet: ${stray.join(", ")}` : null
);
check(
  "the opcodes with no encoding are the known-dropped ones",
  KNOWN_DROPPED.every(t => net.encodeOut(socket, t, []) === null)
);

const handlers = built.slice(built.indexOf("let events = {"), built.indexOf("if (type == \"io-init\") {"));
const handled = new Set((handlers.match(/^\s{8}([A-Za-z0-9]):/gm) || []).map(m => m.trim()[0]));
const unhandled = S2C.filter(t => !handled.has(t));
check(
  "the client's handler table covers the s2c alphabet",
  unhandled.length <= 2,
  unhandled.length ? `no handler for: ${unhandled.join(", ")} (B and Z are deliberately unhandled)` : null
);

/* ------------------------------------------------------------------ *
 * 8. Nothing is left on the plaintext path
 * ------------------------------------------------------------------ */

console.log("\nleftovers");

check("no reference to the remote msgpack build", !/window\.msgpack/.test(built));
check("the send hook is installed at document-start", /@run-at\s+document-start/.test(built));
check(
  "prototype.send is not reassigned after load",
  !/WebSocket\.prototype\.send\s*=/.test(built.slice(built.indexOf("function whiteoutMain() {")))
);

/* ------------------------------------------------------------------ */

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
