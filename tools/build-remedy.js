#!/usr/bin/env node
"use strict";

// src/remedy_4.1.js + src/remedy-transport.js -> Remedy_4.1_Fixed.user.js
//
// remedy 4.1 speaks the pre-2024 wire format. The shipped game negotiates a
// per-connection opcode permutation and an HMAC key on io-init, and from then
// on every client frame is [6 HMAC bytes][msgpack([opcode, args, seq])], while
// server frames carry a permuted numeric opcode. remedy encodes and decodes
// plain msgpack [type, args] everywhere, so on the live game its sends are
// dropped, its outbound hook throws on a signed frame, and its inbound handler
// looks up events[number] in a table keyed by letters.
//
// This rewires every wire site onto src/remedy-transport.js, which is
// transcribed from the bundle and differentially tested against it by
// tools/test-remedy-transport.js.
//
// Every rewrite asserts how many sites it expected to hit, so a newer remedy
// fails the build instead of producing a half-converted script.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = path.join(ROOT, "src", "remedy_4.1.js");
const TRANSPORT = path.join(ROOT, "src", "remedy-transport.js");
const OUT = path.join(ROOT, "Remedy_4.1_Fixed.user.js");

function fail(message) {
  console.error("build-remedy: " + message);
  process.exit(1);
}

let text = fs.readFileSync(BASE, "utf8");
const transport = fs.readFileSync(TRANSPORT, "utf8").replace(/\n+$/, "");

function rewrite(what, pattern, replacement, expected) {
  const hits = text.match(pattern);
  const got = hits ? hits.length : 0;
  if (got !== expected) fail(what + ": expected " + expected + " site(s), found " + got);
  text = text.replace(pattern, replacement);
}

// ── 1. the transport itself, ahead of the first WebSocket hook ───────────────

const anchor = "WebSocket.prototype.nsend = WebSocket.prototype.send;";
if (text.indexOf(anchor) === -1) fail("WebSocket hook anchor not found");
if (text.indexOf(anchor) !== text.lastIndexOf(anchor)) fail("WebSocket hook anchor is ambiguous");
text = text.replace(anchor, transport + "\n\n" + anchor);

// ── 2. outbound: the hook reads its own socket's frames ──────────────────────
// Both copies of the hook — the one installed at load and the one the F5
// "hacking" toggle reinstalls. An unreadable frame is forwarded untouched
// rather than dropped, so a protocol change degrades to pass-through.

rewrite(
  "outbound frame decode",
  /let data = new Uint8Array\(message\);(\s*)let parsed = window\.msgpack\.decode\(data\);/g,
  "let data = new Uint8Array(message);$1let parsed = RemedyWire.main.decodeOutgoing(data);$1if (!parsed) return this.nsend(message);",
  3
);

// ── 3. inbound: server frames carry a permuted numeric opcode ────────────────

rewrite(
  "inbound frame decode",
  /let data = new Uint8Array\(message\.data\);(\s*)let parsed = window\.msgpack\.decode\(data\);/g,
  "let data = new Uint8Array(message.data);$1let parsed = RemedyWire.main.decodeIncoming(data);$1if (!parsed) return;",
  3
);

// ── 4. io-init: capture the seed, the key and the mode ───────────────────────

rewrite(
  "main socket io-init",
  /if \(type == "io-init"\) \{(\s*)socketID = data\[0\];/g,
  'if (type == "io-init") {$1RemedyWire.main.init(data);$1socketID = data[0];',
  2
);

// ── 5. outbound encodes on the main socket ───────────────────────────────────
// The hook re-encodes everything it forwards, so this is the single funnel
// that seals frames — which also means one sequence counter for the socket,
// rather than remedy's and the game's own counters interleaving.

rewrite(
  "hook re-encode",
  /let binary = window\.msgpack\.encode\(\[type, \(type == "D" \? \[data\[0\]\] : data\)\]\);/g,
  'let binary = RemedyWire.main.encode(type, type == "D" ? [data[0]] : data);\n            if (!binary) return;',
  2
);

rewrite(
  "packet senders",
  /let binary = window\.msgpack\.encode\(\[type, data\]\);/g,
  "let binary = RemedyWire.main.encode(type, data);\n        if (!binary) return;",
  5
);

rewrite(
  "WS.send passthrough",
  /WS\.send\(window\.msgpack\.encode\(\[type, data\]\)\);/g,
  "{ const _f = RemedyWire.main.encode(type, data); if (_f) WS.send(_f); }",
  2
);

rewrite(
  "WS.nsend raw sends",
  /WS\.nsend\(msgpack\.encode\(\[packet, data\]\)\);/g,
  "{ const _f = RemedyWire.main.encode(packet, data); if (_f) WS.nsend(_f); }",
  3
);

rewrite(
  "cached.nsend raw sends",
  /cached\.nsend\(msgpack\.encode\(\[packet, data\]\)\);/g,
  "{ const _f = RemedyWire.main.encode(packet, data); if (_f) cached.nsend(_f); }",
  2
);

// ── 6. bot sockets ───────────────────────────────────────────────────────────
// Each bot is its own connection with its own key, tables and sequence, so it
// gets its own channel rather than sharing the main one.

rewrite(
  "bot channel",
  /const ws = new WebSocket\(token\);(\r?\n)    ws\.binaryType = 'arraybuffer';/g,
  "const ws = new WebSocket(token);$1    ws.binaryType = 'arraybuffer';$1    ws.wire = RemedyWire.create();",
  1
);

rewrite(
  "bot send",
  /ws\.nsend\(msgpack\.encode\(\[packet, data\]\)\);/g,
  "{ const _f = ws.wire.encode(packet, data); if (_f) ws.nsend(_f); }",
  1
);

rewrite(
  "bot inbound decode",
  /const parsed = msgpack\.decode\(new Uint8Array\(msg\.data\)\);/g,
  "const parsed = ws.wire.decodeIncoming(new Uint8Array(msg.data));\n        if (!parsed) return;",
  1
);

rewrite(
  "bot io-init",
  /if \(type == "io-init"\) \{(\s*)ws\./g,
  'if (type == "io-init") {$1ws.wire.init(data);$1ws.',
  1
);


// ── done ─────────────────────────────────────────────────────────────────────

const leftover = text.match(/msgpack\.(encode|decode)\(/g) || [];
fs.writeFileSync(OUT, text);
console.log("build-remedy: wrote " + path.relative(ROOT, OUT) + " (" + text.split("\n").length + " lines)");
console.log("build-remedy: " + leftover.length + " raw msgpack call(s) remain (packet-log copies and dead code)");
