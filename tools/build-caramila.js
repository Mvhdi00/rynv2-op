#!/usr/bin/env node
/*
 * build-caramila.js
 *
 * src/CaraMila.user.js  ->  CaraMila_Fixed.user.js
 *
 * One fix, in five anchored edits: teach the client the transport the live game
 * actually speaks. Every anchor is an exact string from the source; a missing or
 * ambiguous anchor fails the build rather than producing a half-patched script.
 *
 *   node tools/build-caramila.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src/CaraMila.user.js");
const OUT = path.join(ROOT, "CaraMila_Fixed.user.js");
const TRANSPORT = path.join(ROOT, "src/caramila/transport.js");

const raw = fs.readFileSync(SRC, "utf8");

/* The source ships with CRLF throughout. Anchors are written with plain \n for
 * legibility, so matching happens on a normalised copy and the file's own line
 * ending is put back on the way out — the output stays byte-consistent with the
 * input rather than silently changing every line in the diff. */
const EOL = raw.indexOf("\r\n") !== -1 ? "\r\n" : "\n";
let src = raw.split("\r\n").join("\n");
const steps = [];

function edit(label, anchor, replacement) {
  const n = src.split(anchor).length - 1;
  if (n !== 1) {
    throw new Error(`anchor ${n === 0 ? "not found" : `ambiguous (${n} matches)`}: ${label}`);
  }
  src = src.replace(anchor, replacement);
  steps.push(label);
}

/* ------------------------------------------------------------------ *
 * 1. Run at document-start.
 *
 * The bundle captures the original send on its very first line
 * (game_index.js:35 — `Ri = window.WebSocket && window.WebSocket.prototype.send`).
 * If this script installs its override after that, the game's own frames go
 * straight to the native send and never reach the hook — which means the mod
 * cannot see them, and the one sequence counter the server expects would be
 * split across two writers. Installing at document-start makes the hook the
 * single funnel it was always written to be.
 * ------------------------------------------------------------------ */
edit(
  "header: run at document-start",
  "// @grant       none\n",
  "// @grant       none\n// @run-at      document-start\n"
);

/* ------------------------------------------------------------------ *
 * 2. The transport itself, spliced in ahead of the socket hook.
 * ------------------------------------------------------------------ */
const transportSrc = fs.readFileSync(TRANSPORT, "utf8")
  .replace(/^#!.*\n/, "")
  /* The UMD wrapper is for the test harness; inside the userscript it is one
   * plain definition in the script's own scope. */
  .replace(
    /\(function \(root, factory\) \{[\s\S]*?\}\)\(typeof self !== "undefined" \? self : this, function \(\) \{/,
    "const CaraTransport = (function () {"
  )
  .replace(/\n  return Transport;\n\}\);\n$/, "\n  return Transport;\n})();\n");

if (transportSrc.indexOf("const CaraTransport = (function () {") === -1) {
  throw new Error("transport: UMD wrapper was not rewritten");
}
if (/module\.exports/.test(transportSrc)) {
  throw new Error("transport: module.exports survived the rewrite");
}

edit(
  "transport: module + session",
  "WebSocket.prototype.nsend = WebSocket.prototype.send;",
  `${transportSrc}
/* The connection's transport state. Everything the mod puts on the wire goes
 * through this one object, so there is exactly one sequence counter. */
const caraTransport = new CaraTransport(msgpack);
/* Set only while packet() is handing its own plain frame to the hook below. */
let caraInternalFrame = false;

WebSocket.prototype.nsend = WebSocket.prototype.send;`
);

/* ------------------------------------------------------------------ *
 * 3. Outgoing: read whatever arrives, sign whatever leaves.
 * ------------------------------------------------------------------ */
edit(
  "send hook: decode",
  `        dontSend = false;
        // EXTRACT DATA ARRAY:
        let data = new Uint8Array(message);
        let parsed = msgpack.decode(data);

        let type = parsed[0];
        data = parsed[1];`,
  `        dontSend = false;
        // EXTRACT DATA ARRAY:
        // A frame reaching here is either one of ours — plain msgpack, tagged
        // by packet() — or one of the game's, which since the transport change
        // is 6 signature bytes followed by [numericOpcode, args, seq]
        // (game_index.js:469-483). Both read back as [stringType, args].
        let parsed = caraInternalFrame
            ? msgpack.decode(new Uint8Array(message))
            : caraTransport.decodeOutgoing(message);
        if (!parsed) return;

        let type = parsed[0];
        let data = parsed[1];`
);

edit(
  "send hook: encode",
  `        if (!dontSend) {
            let binary = msgpack.encode([type, data]);
            this.nsend(binary);`,
  `        if (!dontSend) {
            // Signed, permuted and sequenced here and nowhere else, so the
            // game's frames and the mod's share one monotonic sequence.
            let binary = caraTransport.encode(type, data);
            if (!binary) return;
            this.nsend(binary);`
);

/* ------------------------------------------------------------------ *
 * 4. The mod's own packets take the same road.
 * ------------------------------------------------------------------ */
edit(
  "packet(): route through the transport",
  `function packet(type) {
    // EXTRACT DATA ARRAY:
    let data = Array.prototype.slice.call(arguments, 1);

    // SEND MESSAGE:
    let binary = msgpack.encode([type, data]);
    WS.send(binary);
}`,
  `function packet(type) {
    // EXTRACT DATA ARRAY:
    let data = Array.prototype.slice.call(arguments, 1);

    // SEND MESSAGE:
    // Tagged so the hook reads it as plain msgpack, then signs and sequences it
    // exactly like one of the game's own frames. Going through the hook rather
    // than around it is what keeps the mod's packets subject to the same
    // filters and the same sequence counter.
    if (!WS) return;
    caraInternalFrame = true;
    try {
        WS.send(msgpack.encode([type, data]));
    } finally {
        caraInternalFrame = false;
    }
}`
);

/* ------------------------------------------------------------------ *
 * 5. Incoming: map the numeric opcode back, and learn the session.
 * ------------------------------------------------------------------ */
edit(
  "getMessage(): decode and capture io-init",
  `function getMessage(message) {
    let data = new Uint8Array(message.data);
    let parsed = msgpack.decode(data);
    let type = parsed[0];
    data = parsed[1];
    if (type == "io-init") {
        socketID = data[0];
    } else {`,
  `function getMessage(message) {
    // Once the session is signed the server sends a permuted numeric opcode
    // (game_index.js:439-443); io-init itself still arrives as a string, and it
    // is what carries the table seed and the signing key.
    let parsed = caraTransport.decodeIncoming(message.data);
    if (!parsed) return;
    let type = parsed[0];
    let data = parsed[1];
    if (type == "io-init") {
        socketID = caraTransport.noteInit(data);
    } else {`
);

/* ------------------------------------------------------------------ *
 * A reconnect has to forget the old session, or the next connection is signed
 * with a dead key.
 * ------------------------------------------------------------------ */
edit(
  "socket hook: reset the session on a new socket",
  `    if (!WS) {
        WS = this;`,
  `    if (!WS) {
        WS = this;
        caraTransport.reset();`
);

fs.writeFileSync(OUT, src.split("\n").join(EOL));

console.log(`\nbuild-caramila: wrote ${path.relative(ROOT, OUT)}`);
for (const s of steps) console.log(`  - ${s}`);
console.log("");
