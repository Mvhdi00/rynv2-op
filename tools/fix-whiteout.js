#!/usr/bin/env node
/*
 * fix-whiteout.js
 *
 * Builds Whiteout_Fixed.user.js from src/Whiteout_Abdo.js.
 *
 * The "whiteout abdo" client speaks the old moomoo wire format: every frame is
 * a plain msgpack `[letterOpcode, args]` in both directions. The game in
 * src/game_index.js stopped doing that. It now negotiates a per-connection
 * transport in `io-init`:
 *
 *   io-init -> [socketId, tableSeed, hmacKeyHex, mode]
 *
 * and when `mode === 1` every client frame becomes
 *
 *   [6 bytes of HMAC-SHA256(key, payload)][payload]
 *   payload = msgpack([permutedOpcode, args, sequence])
 *
 * with the opcode alphabets permuted per connection from `tableSeed`, and
 * server frames carrying the permuted number in place of the letter.
 *
 * So the client was decoding signed frames as if they were bare msgpack,
 * throwing away the signature, and re-encoding plaintext over a connection the
 * server expects to be signed - the spawn packet included, which is why entry
 * failed before anything else got a chance to. On top of that the outgoing hook
 * could never bind at all: the bundle captures `WebSocket.prototype.send` while
 * it loads, and the script was running at document-end, i.e. after that.
 *
 * The transport is not reimplemented here. The msgpack codec is lifted out of
 * src/game_vendor.js and the signing, hashing and opcode-permutation functions
 * out of src/game_index.js, both verbatim, so the client frames packets with
 * the same code the game frames them with.
 *
 *   node tools/fix-whiteout.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Whiteout_Abdo.js");
const VENDOR = path.join(ROOT, "src/game_vendor.js");
const INDEX = path.join(ROOT, "src/game_index.js");
const OUT = path.join(ROOT, "Whiteout_Fixed.user.js");

/* Normalised to LF on the way in, so the anchors below and the code spliced in
 * from the bundles are all in the same line endings. */
let code = fs.readFileSync(BASE, "utf8").replace(/\r\n/g, "\n");
const applied = [];

/* Every edit is anchored to an exact string in the base client. A stale or
 * ambiguous anchor fails the build instead of quietly producing a client that
 * is only half converted. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* The outgoing hook is written out three times in the base client (once at load
 * and twice more inside the F5 "hacking" toggle), so some edits legitimately
 * have more than one site. The count is asserted rather than assumed. */
function editAll(label, find, replace, expected) {
  const parts = code.split(find);
  const hits = parts.length - 1;
  if (hits !== expected) {
    throw new Error(`anchor hit ${hits} times, expected ${expected}: ${label}`);
  }
  code = parts.join(replace);
  applied.push(`${label} (${hits}x)`);
}

function editRe(label, re, replace, expected) {
  const hits = code.match(re);
  const count = hits ? hits.length : 0;
  if (count !== expected) {
    throw new Error(`pattern matched ${count} times, expected ${expected}: ${label}`);
  }
  code = code.replace(re, replace);
  applied.push(`${label} (${count}x)`);
}

/* ------------------------------------------------------------------ *
 * Lift the codec and the transport out of the shipped game bundles
 * ------------------------------------------------------------------ */

/* The shipped bundles use CRLF; the client does not. Normalise so the anchors
 * below and the spliced-in code are both plain LF. */
function readBundle(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function slice(file, label, startAnchor, endAnchor) {
  const text = readBundle(file);
  const start = startAnchor === null ? 0 : text.indexOf(startAnchor);
  if (start === -1) throw new Error(`${label}: start anchor not found in ${path.basename(file)}`);
  const end = text.indexOf(endAnchor, start + 1);
  if (end === -1) throw new Error(`${label}: end anchor not found in ${path.basename(file)}`);
  return text.slice(start, end);
}

/* Everything up to the process shim: the msgpack Encoder (`yn`) and Decoder
 * (`kn`) plus the UTF-8, int64 and extension-codec helpers they sit on. This is
 * the encoder the game itself instantiates as `Hi` and the decoder it
 * instantiates as `Bo`. */
const codec = slice(VENDOR, "msgpack codec", null, "\nfunction ze(t) {");

/* The transport constants and functions: table salt / signature width /
 * transport mode / both opcode alphabets, the seeded shuffle that permutes
 * them (`Co`, `Oi`, `Po`), SHA-256 (`Vt`, `j`, `Do`), HMAC (`Ao`) truncated to
 * the frame signature (`Eo`), and the hex reader for the key (`Ro`). */
const protocol = slice(INDEX, "transport", "\n  , Io = 1\n", "\nconst Hi = new rs").replace(
  /^\n  , Io = 1/,
  "\nconst Io = 1"
);

/* The build is only meaningful against a bundle that still works this way. */
for (const [label, needle] of [
  ["signature width", "\n  , jt = 6\n"],
  ["encrypted transport mode", "\n  , Ht = 1\n"],
  ["io-init handling", 'if (m === "io-init") {'],
  ["signed frame assembly", "d.set(o, 0),\n            d.set(a, jt),"],
]) {
  if (!readBundle(INDEX).includes(needle)) {
    throw new Error(`game_index.js no longer contains the ${label} this build assumes`);
  }
}

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 *
 * @run-at document-start is not cosmetic. The bundle does
 *
 *   const kn = window.WebSocket, Ri = window.WebSocket.prototype.send;
 *
 * as it loads and sends every frame through that captured `Ri`, so a hook
 * installed at document-end is never called. It has to be in place before the
 * bundle evaluates.
 * ------------------------------------------------------------------ */

const header = `// ==UserScript==
// @name         Whiteout (fixed transport)
// @namespace    whiteout-fixed
// @match        *://*.moomoo.io/*
// @grant        none
// @version      v4.1
// @description  whiteout abdo, rebuilt against the current moomoo protocol
// @icon         https://img.freepik.com/free-photo/abstract-surface-textures-white-concrete-stone-wall_74190-8189.jpg
// @author       hanabira (combat and some UI) and nexoos (menu)
// @run-at       document-start
// ==/UserScript==
`;

{
  const end = code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of base userscript header");
  code = header + code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  applied.push("header: run-at document-start so the send hook binds");
}

/* ------------------------------------------------------------------ *
 * 2. The transport layer
 *
 * Sits outside the deferred body so it is installed the moment the script
 * runs. It owns three things the client cannot do for itself any more:
 *
 *   - the per-socket crypto state, built from io-init. A listener is attached
 *     in the WebSocket constructor, because io-init arrives long before the
 *     first outgoing packet and the base client only attached its listener
 *     once something had been sent.
 *   - decoding. Frames are unwrapped back to the letter opcode the client's
 *     filters and handler table are written against.
 *   - encoding. Every frame the page sends passes through this one gate, so
 *     the sequence number stays gap-free even when the client drops a packet
 *     or injects one of its own.
 * ------------------------------------------------------------------ */

const prologue = `
/* ==================================================================
 * Whiteout transport
 *
 * The moomoo bundle negotiates a per-connection transport in io-init and then
 * signs and permutes every frame. The codec below is lifted verbatim out of
 * src/game_vendor.js and the signing / permutation out of src/game_index.js,
 * so frames are built by the same code the game builds them with.
 *
 * Regenerate with: node tools/fix-whiteout.js
 * ================================================================== */
const WhiteoutNet = (function () {

/* ---- msgpack codec, verbatim from the game's vendor bundle ---- */
${codec}

/* ---- transport, verbatim from the game's index bundle ---- */
${protocol}

    var encoder = new yn();
    var decoder = new kn();

    var NativeSocket = window.WebSocket;
    var nativeSend = NativeSocket.prototype.send;

    /* One crypto state per connection: the game socket and the bot socket each
     * negotiate their own key, opcode tables and sequence. */
    var states = new WeakMap();
    var main = null;
    var onMain = null;

    function toBytes(d) {
        if (d instanceof Uint8Array) return d;
        if (d instanceof ArrayBuffer) return new Uint8Array(d);
        if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        return null;
    }

    /* Packets the client originates are handed to the outgoing filter as this
     * marker rather than as bytes, so they are signed and numbered exactly
     * once, on the way out, like the game's own. */
    function isLogical(v) {
        return !!v && typeof v === "object" && v.__whiteout === true;
    }

    var api = {
        signatureBytes: jt,
        encryptedMode: Ht,
        /* Replaced by the client body. Called with the socket as \`this\`. */
        gate: null
    };

    api.encode = function (value) {
        return encoder.encode(value);
    };

    api.stateOf = function (socket) {
        return states.get(socket) || null;
    };

    /* io-init: [socketId, tableSeed, hmacKeyHex, mode]. Anything other than
     * the encrypted mode leaves the socket on the plaintext framing. */
    api.initState = function (socket, args) {
        var state = null;
        if (args && args[3] === Ht) {
            state = {
                mode: Ht,
                key: Ro(args[2]),
                tables: Po(args[1] >>> 0),
                seq: 0
            };
        }
        states.set(socket, state);
        return state;
    };

    /* Server -> client. Once the tables are up the opcode arrives as the
     * permuted number; translate it back to the letter the handler table in
     * getMessage is keyed on. */
    api.decodeIn = function (socket, data) {
        var bytes = toBytes(data);
        if (!bytes) return null;
        var frame;
        try {
            frame = decoder.decode(bytes);
        } catch (e) {
            return null;
        }
        if (!Array.isArray(frame)) return null;
        var type = frame[0];
        var args = frame[1] || [];
        if (type === "io-init") {
            if (!states.has(socket)) api.initState(socket, args);
            return [ type, args ];
        }
        var state = states.get(socket);
        if (state && typeof type === "number") {
            type = state.tables.s2c.dec[type];
            if (type === undefined) return null;
        }
        return [ type, args ];
    };

    /* Client -> server, on the way into the filter: unwrap a frame back to its
     * letter opcode and arguments. */
    api.decodeOut = function (socket, message) {
        if (isLogical(message)) return [ message.type, message.args ];
        var bytes = toBytes(message);
        if (!bytes) return null;
        var state = states.get(socket);
        if (state) {
            if (bytes.length <= jt) return null;
            var signed = null;
            try {
                signed = decoder.decode(bytes.subarray(jt));
            } catch (e) {
                signed = null;
            }
            if (Array.isArray(signed) && typeof signed[0] === "number") {
                var letter = state.tables.c2s.dec[signed[0]];
                if (letter === undefined) return null;
                return [ letter, signed[1] || [] ];
            }
            return null;
        }
        var plain;
        try {
            plain = decoder.decode(bytes);
        } catch (e) {
            return null;
        }
        if (!Array.isArray(plain)) return null;
        return [ plain[0], plain[1] || [] ];
    };

    /* Client -> server, on the way out: permute the opcode, number the frame
     * and prefix the truncated HMAC, exactly as the bundle's own send does.
     * Returns null for an opcode the connection has no encoding for, which is
     * also what the game does with one. */
    api.encodeOut = function (socket, type, args) {
        var list = Array.isArray(args) ? args : [ args ];
        var state = states.get(socket);
        if (!state) return encoder.encode([ type, list ]);
        var op = state.tables.c2s.enc[type];
        if (op === undefined) return null;
        var payload = encoder.encode([ op, list, ++state.seq ]);
        var signature = Eo(state.key, payload);
        var frame = new Uint8Array(jt + payload.length);
        frame.set(signature, 0);
        frame.set(payload, jt);
        return frame;
    };

    /* Straight to the wire, skipping the client's outgoing filter. */
    api.nativeSend = function (socket, message) {
        var bytes = isLogical(message)
            ? api.encodeOut(socket, message.type, message.args)
            : message;
        if (bytes == null) return;
        nativeSend.call(socket, bytes);
    };

    /* Send a logical packet through the client's outgoing filter. */
    api.send = function (socket, type, args) {
        if (!socket) return;
        var packet = {
            __whiteout: true,
            type: type,
            args: args
        };
        if (typeof api.gate === "function") {
            api.gate.call(socket, packet);
            return;
        }
        api.nativeSend(socket, packet);
    };

    /* The game socket is the first one to be told what transport to speak. The
     * bot socket connects later and the client already holds its reference. */
    api.whenMain = function (fn) {
        onMain = fn;
        if (main && typeof fn === "function") fn(main);
    };

    function track(socket) {
        socket.addEventListener("message", function (event) {
            var frame;
            try {
                frame = api.decodeIn(socket, event.data);
            } catch (e) {
                return;
            }
            if (!frame || frame[0] !== "io-init" || main !== null) return;
            main = socket;
            api.main = socket;
            if (typeof onMain === "function") {
                try {
                    onMain(socket);
                } catch (e) {}
            }
        });
    }

    /* Hooking the constructor as well as send() is what makes io-init
     * reachable: the socket has to be watched from the moment it exists, not
     * from the first packet the client happens to send over it. */
    function HookedSocket(url, protocols) {
        var socket = protocols === undefined
            ? new NativeSocket(url)
            : new NativeSocket(url, protocols);
        try {
            track(socket);
        } catch (e) {}
        return socket;
    }
    HookedSocket.prototype = NativeSocket.prototype;
    HookedSocket.CONNECTING = NativeSocket.CONNECTING;
    HookedSocket.OPEN = NativeSocket.OPEN;
    HookedSocket.CLOSING = NativeSocket.CLOSING;
    HookedSocket.CLOSED = NativeSocket.CLOSED;

    /* A permanent trampoline. The bundle captures prototype.send as it loads
     * and never looks at it again, so the hook has to be installed once, here,
     * and the client body swaps its filter in behind it later. */
    NativeSocket.prototype.send = function (message) {
        if (typeof api.gate === "function") return api.gate.call(this, message);
        api.nativeSend(this, message);
    };
    /* The base client sends through .nsend when it wants to skip its own
     * filter; keep that meaning it did before the trampoline existed. */
    NativeSocket.prototype.nsend = function (message) {
        api.nativeSend(this, message);
    };

    try {
        window.WebSocket = HookedSocket;
    } catch (e) {}

    return api;
})();
`;

{
  const anchor = "// ==/UserScript==\n";
  const at = code.indexOf(anchor);
  if (at === -1) throw new Error("could not place the transport prologue");
  code = code.slice(0, at + anchor.length) + prologue + code.slice(at + anchor.length);
  applied.push("transport: msgpack + signing lifted from the game bundles");
}

/* ------------------------------------------------------------------ *
 * 3. Defer the client body
 *
 * The script now runs at document-start, but the body cannot: it reads
 * `window.config`, which the bundle publishes on its last line, and it touches
 * document.body while setting up. Wrapping it and running it on DOMContentLoaded
 * puts it back at exactly the point document-end used to give it, while the
 * transport above stays at document-start where it has to be.
 * ------------------------------------------------------------------ */

{
  const anchor = "var compositeImages = {hats:{},accessories:{},weapons:{},animals:{}}";
  const at = code.indexOf(anchor);
  if (at === -1) throw new Error("anchor not found: start of client body");
  code =
    code.slice(0, at) +
    "function whiteoutMain() {\n" +
    code.slice(at) +
    "\n}\n\n" +
    "/* document-start for the transport, document-end timing for the client. */\n" +
    'if (document.readyState === "loading") {\n' +
    '    document.addEventListener("DOMContentLoaded", whiteoutMain, { once: true });\n' +
    "} else {\n" +
    "    whiteoutMain();\n" +
    "}\n";
  applied.push("body: deferred to DOMContentLoaded, transport left at document-start");
}

/* ------------------------------------------------------------------ *
 * 4. Drop the remote msgpack dependency
 *
 * The client pulled msgpack off greasyfork with a script tag appended to
 * document.body. That cannot work at document-start, and even at document-end
 * it raced the first packet. The codec is bundled now.
 * ------------------------------------------------------------------ */

edit(
  "msgpack: drop the greasyfork script tag",
  `const min = document.createElement("script");
min.src = "https://greasyfork.org/scripts/423602-msgpack/code/msgpack.js";
document.body.append(min);`,
  `/* msgpack is bundled in the transport above, taken from the game's own
   vendor bundle, so there is no remote script to wait on. */`
);

/* ------------------------------------------------------------------ *
 * 5. The outgoing hook
 * ------------------------------------------------------------------ */

/* nsend is provided by the transport. Aliasing it off prototype.send here
 * would now alias the trampoline and recurse. */
edit(
  "hook: drop the nsend alias",
  `WebSocket.prototype.nsend = WebSocket.prototype.send;
WebSocket.prototype.send = function (message) {`,
  `WhiteoutNet.gate = function (message) {`
);

/* The other two copies live in the F5 toggle, which swaps the filter in and
 * out. They become swaps of the same trampoline target. */
editAll(
  "hook: route the F5 toggle through the transport",
  `WebSocket.prototype.send = function (message) {`,
  `WhiteoutNet.gate = function (message) {`,
  2
);

/* The socket was captured on the first send, which is far too late to see
 * io-init. The transport hands it over as soon as the connection identifies
 * itself, so the lazy capture goes. */
editRe(
  "hook: drop the lazy socket capture",
  /( *)if \(!WS\) \{\n *WS = this;\n *WS\.addEventListener\("message", function \(msg\) \{\n *getMessage\(msg\);\n *\}\);\n *WS\.addEventListener\("close", \((event|\w+)\) => \{\n *if \(\w+\.code == 4001\) \{\n *window\.location\.reload\(\);\n *\}\n *\}\);\n *\}\n/g,
  "",
  3
);

edit(
  "hook: bind the socket when the transport reports it",
  `let WS = undefined;
let socketID = undefined;`,
  `let WS = undefined;
let socketID = undefined;
/* io-init lands before the client has any reason to send anything, so the
   socket is taken from the transport rather than from the first send. */
WhiteoutNet.whenMain(function (socket) {
    WS = socket;
    socket.addEventListener("message", function (msg) {
        getMessage(msg);
    });
    socket.addEventListener("close", function (event) {
        if (event.code == 4001) {
            window.location.reload();
        }
    });
});`
);

/* Unwrap the frame instead of reading it as bare msgpack. A frame that will
 * not unwrap is not ours to rewrite, so it goes out untouched. */
editRe(
  "hook: unwrap outgoing frames",
  /( *)let data = new Uint8Array\(message\);\n *let parsed = window\.msgpack\.decode\(data\);\n *let type = parsed\[0\];\n *data = parsed\[1\];/g,
  (m, indent) =>
    `${indent}const frame = WhiteoutNet.decodeOut(this, message);\n` +
    `${indent}if (!frame) return WhiteoutNet.nativeSend(this, message);\n` +
    `${indent}let type = frame[0];\n` +
    `${indent}let data = frame[1];`,
  3
);

/* Re-sign on the way out. The "D" case keeps the base client's habit of
 * trimming the aim packet down to the angle before it goes. */
edit(
  "hook: sign the aim-trimmed frame",
  `            let binary = window.msgpack.encode([type, (type == "D" ? [data[0]] : data)]);
            this.nsend(binary);`,
  `            const binary = WhiteoutNet.encodeOut(this, type, type == "D" ? [data[0]] : data);
            if (!binary) return;
            WhiteoutNet.nativeSend(this, binary);`
);

editAll(
  "hook: sign outgoing frames",
  `let binary = window.msgpack.encode([type, data]);
                                this.nsend(binary);`,
  `const binary = WhiteoutNet.encodeOut(this, type, data);
                                if (!binary) return;
                                WhiteoutNet.nativeSend(this, binary);`,
  2
);

/* The packet log keeps a copy of each frame. It is only ever read back for
 * display, so it stays plain msgpack. */
editRe(
  "log: keep the packet log on the bundled codec",
  /window\.msgpack\.encode\(\[type, data\]\),/g,
  "WhiteoutNet.encode([type, data]),",
  4
);

/* ------------------------------------------------------------------ *
 * 6. The client's own senders
 *
 * packet() goes through the filter, so it hands the transport a logical packet
 * and lets the one gate sign and number it. packet2() and origPacket()
 * deliberately skip the filter, so they sign and go straight out.
 * ------------------------------------------------------------------ */

edit(
  "senders: packet() through the filter",
  `        // SEND MESSAGE:
        let binary = window.msgpack.encode([type, data]);
        WS.send(binary);
    }
}`,
  `        // SEND MESSAGE:
        WhiteoutNet.send(WS, type, data);
    }
}`
);

editAll(
  "senders: packet2() / origPacket() signed, filter skipped",
  `        // SEND MESSAGE:
        let binary = window.msgpack.encode([type, data]);
        WS.nsend(binary);`,
  `        // SEND MESSAGE:
        WhiteoutNet.nativeSend(WS, WhiteoutNet.encodeOut(WS, type, data));`,
  1
);

edit(
  "senders: origPacket() signed",
  `    // SEND MESSAGE:
    let binary = window.msgpack.encode([type, data]);
    WS.nsend(binary);
}`,
  `    // SEND MESSAGE:
    WhiteoutNet.nativeSend(WS, WhiteoutNet.encodeOut(WS, type, data));
}`
);

/* window.leave sent an opcode called "kys" with a joke payload, on the theory
 * that an unparseable packet gets you dropped. The current transport never
 * puts it on the wire at all - there is no encoding for an opcode outside the
 * alphabet - so it was a no-op. Closing the socket is what it was reaching for.
 *
 * The other invalid opcode, packet("B") in receiveChat, is left where it is.
 * It fires on a chat line sent by somebody else, so it is a remote trigger for
 * breaking your own connection; now that it cannot be encoded it does nothing,
 * which is the behaviour worth keeping. */
edit(
  "senders: window.leave closes the socket instead of sending junk",
  `window.leave = function () {
    origPacket("kys", {
        "frvr is so bad": true,
        "sidney is too good": true,
        "dev are too weak": true,
    });
};`,
  `window.leave = function () {
    if (WS) WS.close();
};`
);

/* ------------------------------------------------------------------ *
 * 7. The incoming handler
 * ------------------------------------------------------------------ */

edit(
  "receive: translate permuted opcodes",
  `function getMessage(message) {
    let data = new Uint8Array(message.data);
    let parsed = window.msgpack.decode(data);
    let type = parsed[0];
    data = parsed[1];`,
  `function getMessage(message) {
    const frame = WhiteoutNet.decodeIn(WS, message.data);
    if (!frame) return;
    let type = frame[0];
    let data = frame[1];`
);

/* ------------------------------------------------------------------ *
 * 8. The bot socket
 *
 * A second connection, with its own io-init and so its own key, tables and
 * sequence. It was also still on the opcode set from two protocols ago:
 * "a" for movement, "G" for item select and "d" for attack, where the current
 * alphabet has "9", "z" and "F". The client's own placer already sends the
 * modern trio, so the bot is brought in line with it.
 *
 * Note that this whole section is inside a block comment in the base client -
 * `/** APPLY SOCKET CODES` opens it and it does not close until well past the
 * bot code - so none of it runs as shipped. The edits are here so the section
 * is correct if it is ever uncommented, and they are anchored so that a base
 * client which revives it cannot revive it stale. Nothing inserted below may
 * contain a comment terminator, or it would close that comment early and take
 * the rest of the section live.
 * ------------------------------------------------------------------ */

edit(
  "bot: sign outgoing frames",
  `        bot.sendWS = function(type) {
            // EXTRACT DATA ARRAY:
            let data = Array.prototype.slice.call(arguments, 1);
            // SEND MESSAGE:
            let binary = window.msgpack.encode([type, data]);
            bot.send(binary);
        };`,
  `        bot.sendWS = function(type) {
            // EXTRACT DATA ARRAY:
            let data = Array.prototype.slice.call(arguments, 1);
            // SEND MESSAGE:
            WhiteoutNet.nativeSend(bot, WhiteoutNet.encodeOut(bot, type, data));
        };`
);

edit(
  "bot: translate permuted opcodes",
  `        bot.onmessage = function(message) {
            let data = new Uint8Array(message.data);
            let parsed = window.msgpack.decode(data);
            let type = parsed[0];
            data = parsed[1];
            if (type == "io-init") {
                bot.spawn();
            }
            if (type == "1") {`,
  `        bot.onmessage = function(message) {
            const frame = WhiteoutNet.decodeIn(bot, message.data);
            if (!frame) return;
            let type = frame[0];
            let data = frame[1];
            if (type == "io-init") {
                bot.spawn();
            }
            // setupGame; "1" was its opcode two protocols ago.
            if (type == "C") {`
);

editRe(
  "bot: movement opcode a -> 9",
  /bot\.sendWS\("a",/g,
  'bot.sendWS("9",',
  20
);

editRe(
  "bot: item-select opcode G -> z",
  /bot\.sendWS\("G",/g,
  'bot.sendWS("z",',
  4
);

edit(
  "bot: attack opcode d -> F",
  `                    bot.sendWS("d", 1, a);`,
  `                    bot.sendWS("F", 1, a);`
);

/* selectWeapon was reaching for the main socket with an opcode that has not
 * existed for two protocols, so it moved the player's weapon rather than the
 * bot's, and then did not even do that. */
edit(
  "bot: selectWeapon onto the bot socket",
  `        bot.selectWeapon = function(a) {
            packet("G", a, 1);
        }`,
  `        bot.selectWeapon = function(a) {
            bot.sendWS("z", a, 1);
        }`
);

/* ------------------------------------------------------------------ *
 * 9. Build manifest
 *
 * Records the bundles the transport was lifted from and re-checks the parts
 * that are observable once a connection is up, so a server-side protocol
 * change shows up as a console warning instead of as packets that quietly stop
 * being accepted.
 * ------------------------------------------------------------------ */

const manifest = {
  builtAt: new Date().toISOString(),
  liftedFrom: {
    codec: "src/game_vendor.js",
    transport: "src/game_index.js",
  },
  signatureBytes: 6,
  encryptedMode: 1,
  c2sAlphabet: ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"],
  s2cAlphabet: [
    "A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R",
    "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
  ],
};

edit(
  "manifest: record and re-check the transport",
  `window.sendPacket = packet;`,
  `window.sendPacket = packet;

/* What this build was made against. See tools/fix-whiteout.js. */
const WhiteoutBuild = ${JSON.stringify(manifest, null, 4)};
WhiteoutBuild.check = function () {
    const problems = [];
    try {
        if (WhiteoutNet.signatureBytes !== WhiteoutBuild.signatureBytes) {
            problems.push(
                "frame signature is " + WhiteoutNet.signatureBytes +
                " bytes, expected " + WhiteoutBuild.signatureBytes
            );
        }
        const state = WS && WhiteoutNet.stateOf(WS);
        if (state) {
            if (state.mode !== WhiteoutBuild.encryptedMode) {
                problems.push("transport mode is " + state.mode + ", expected " + WhiteoutBuild.encryptedMode);
            }
            const live = Object.keys(state.tables.c2s.enc).length;
            if (live !== WhiteoutBuild.c2sAlphabet.length) {
                problems.push(
                    "c2s opcode table has " + live + " entries, expected " + WhiteoutBuild.c2sAlphabet.length
                );
            }
        } else if (WS) {
            problems.push("connected without negotiating the signed transport");
        }
    } catch (e) {}
    for (const problem of problems) {
        console.warn("[whiteout] protocol drift: " + problem);
    }
    return problems;
};
setTimeout(function () {
    try {
        WhiteoutBuild.check();
    } catch (e) {}
}, 15000);
window.WhiteoutBuild = WhiteoutBuild;`
);

/* ------------------------------------------------------------------ */

if (/window\.msgpack/.test(code)) {
  const left = code.match(/.*window\.msgpack.*/g);
  throw new Error(`window.msgpack still referenced:\n  ${left.join("\n  ")}`);
}

/* Parse the result before writing it. Large stretches of the base client sit
 * inside block comments, so an edit that lands in one and carries a comment
 * terminator would close it early and take dead code live. That shows up here
 * rather than in the browser. */
{
  const tmp = OUT.replace(/\.user\.js$/, ".syntax-check.js");
  fs.writeFileSync(tmp, code);
  const { status, stderr } = require("child_process").spawnSync(process.execPath, ["--check", tmp], {
    encoding: "utf8",
  });
  fs.unlinkSync(tmp);
  if (status !== 0) throw new Error(`built client does not parse:\n${stderr}`);
}

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
