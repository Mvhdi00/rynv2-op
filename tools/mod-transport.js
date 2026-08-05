#!/usr/bin/env node
/*
 * mod-transport.js
 *
 * Emits the io-client module body that the old-bundle mods in src/mods need in
 * order to talk to the current game.
 *
 * The mods are forks of the pre-2024 webpack `bundle.js`, so their io-client is
 * still the plain one:
 *
 *     send:      socket.send(msgpack.encode([name, args]))
 *     onmessage: events[parsed[0]].apply(undefined, parsed[1])
 *     io-init:   socketId = data[0]
 *
 * The shipped bundle (src/game_index.js) does none of that any more. On
 * `io-init` it now receives `[socketId, seed, keyHex, mode]`, and when
 * `mode === 1` every frame after that is:
 *
 *     [ 6-byte truncated HMAC-SHA256 ] [ msgpack([opcode, args, seq]) ]
 *
 * where `opcode` is the packet name's index in a per-connection permutation of
 * a fixed alphabet, seeded from `seed`. Server-to-client frames arrive with the
 * matching numeric opcode instead of a name.
 *
 * Everything below is a straight re-implementation of the bundle's own `Co`,
 * `Oi`, `Po`, `Vt`, `Ao`, `Eo` and `Ro`, checked against them by
 * tools/verify-transport.js. Constants come from drivers/game-drivers.json so
 * a re-extract propagates instead of drifting.
 */

const fs = require("fs");
const path = require("path");

const { IO_CLIENT_SENTINEL } = require("./mod-bundle.js");

const ROOT = path.resolve(__dirname, "..");

/* Options, because the five mods do not all ship the same way:
 *
 *   msgpackExpr   how this bundle reaches msgpack-lite — a webpack id in the
 *                 beautified mods, a numeric one in the minified Chicken build
 *   exportsTarget `module.exports` normally, `e.exports` where the factory's
 *                 parameters were mangled
 *   preamble      side-effect requires the original module made
 *   extras        the mod's own send-path additions (rate limiting, chat
 *                 filtering, packet counters), spliced in just before the
 *                 frame is built, with `type` holding the packet *name* and
 *                 `data` the argument array
 *   closeBody     overrides close(), for the one mod that deliberately
 *                 neuters it
 */
function ioClientModule({
  protocol,
  extras = "",
  msgpackExpr,
  exportsTarget = "module.exports",
  preamble = "",
  closeBody = null,
}) {
  const p = protocol;
  const close =
    closeBody !== null
      ? closeBody
      : `                        this.socket && this.socket.close();
                        this.socket = null;
                        this.connected = false;
                        session = null;`;
  return `${IO_CLIENT_SENTINEL}
                /* ------------------------------------------------------------------
                 * io-client, rewritten against the shipped game bundle.
                 *
                 * The old bundle sent msgpack([name, args]) and read packet names
                 * straight off the wire. The current server negotiates a
                 * per-connection opcode permutation in io-init and expects every
                 * client frame to carry a ${p.signatureBytes}-byte truncated
                 * HMAC-SHA256 prefix over the msgpack body. Frames that do not
                 * match are dropped, which is why the unpatched mod connects and
                 * then never spawns.
                 * ---------------------------------------------------------------- */

                var msgpack = ${msgpackExpr};
${preamble}
                var SIG_BYTES = ${p.signatureBytes};
                var MODE_KEYED = ${p.encryptedMode};
                var TABLE_SALT = ${p.tableSalt};
                var C2S_ALPHABET = ${JSON.stringify(p.c2sAlphabet)};
                var S2C_ALPHABET = ${JSON.stringify(p.s2cAlphabet)};

                var SHA256_K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

                function rotr(value, bits) {
                    return (value >>> bits) | (value << (32 - bits));
                }

                function sha256(input) {
                    var h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
                    var len = input.length;
                    var bitLen = len * 8;
                    var padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
                    padded.set(input);
                    padded[len] = 128;
                    var view = new DataView(padded.buffer);
                    view.setUint32(padded.length - 4, bitLen >>> 0, false);
                    view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);

                    var w = new Uint32Array(64);
                    for (var block = 0; block < padded.length; block += 64) {
                        for (var i = 0; i < 16; i++) {
                            w[i] = view.getUint32(block + i * 4, false);
                        }
                        for (var i = 16; i < 64; i++) {
                            var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                            var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
                        }
                        var a = h[0], b = h[1], c = h[2], d = h[3];
                        var e = h[4], f = h[5], g = h[6], hh = h[7];
                        for (var i = 0; i < 64; i++) {
                            var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                            var ch = (e & f) ^ (~e & g);
                            var t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) | 0;
                            var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                            var maj = (a & b) ^ (a & c) ^ (b & c);
                            var t2 = (S0 + maj) | 0;
                            hh = g; g = f; f = e; e = (d + t1) | 0;
                            d = c; c = b; b = a; a = (t1 + t2) | 0;
                        }
                        h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0;
                        h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
                        h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0;
                        h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
                    }

                    var out = new Uint8Array(32);
                    var outView = new DataView(out.buffer);
                    for (var i = 0; i < 8; i++) {
                        outView.setUint32(i * 4, h[i], false);
                    }
                    return out;
                }

                var HMAC_BLOCK = 64;

                function hmacSha256(key, message) {
                    var k = key;
                    if (k.length > HMAC_BLOCK) k = sha256(k);
                    var padded = new Uint8Array(HMAC_BLOCK);
                    padded.set(k);
                    var inner = new Uint8Array(HMAC_BLOCK + message.length);
                    var outer = new Uint8Array(HMAC_BLOCK + 32);
                    for (var i = 0; i < HMAC_BLOCK; i++) {
                        inner[i] = padded[i] ^ 54;
                        outer[i] = padded[i] ^ 92;
                    }
                    inner.set(message, HMAC_BLOCK);
                    outer.set(sha256(inner), HMAC_BLOCK);
                    return sha256(outer);
                }

                function signFrame(key, message) {
                    return hmacSha256(key, message).subarray(0, SIG_BYTES);
                }

                function hexToBytes(hex) {
                    var out = new Uint8Array(hex.length / 2);
                    for (var i = 0; i < out.length; i++) {
                        out[i] = parseInt(hex.substr(i * 2, 2), 16);
                    }
                    return out;
                }

                /* The bundle's seeded PRNG — a mulberry/splitmix variant whose
                 * state is the seed itself, advanced on every call. */
                function seededRandom(seed) {
                    return function () {
                        seed |= 0;
                        seed = (seed + 1831565813) | 0;
                        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
                        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
                    };
                }

                /* Fisher-Yates over the index list, walked top-down, exactly as
                 * the bundle does it — any other traversal order yields a
                 * different table for the same seed. */
                function permuteAlphabet(alphabet, seed) {
                    var n = alphabet.length;
                    var order = alphabet.map(function (_, i) { return i; });
                    var rand = seededRandom(seed >>> 0);
                    for (var i = n - 1; i > 0; i--) {
                        var j = Math.floor(rand() * (i + 1));
                        var tmp = order[i];
                        order[i] = order[j];
                        order[j] = tmp;
                    }
                    var enc = {};
                    var dec = {};
                    for (var i = 0; i < n; i++) {
                        enc[alphabet[i]] = order[i];
                        dec[order[i]] = alphabet[i];
                    }
                    return { enc: enc, dec: dec };
                }

                function buildTables(seed) {
                    var mixed = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
                    return {
                        c2s: permuteAlphabet(C2S_ALPHABET, mixed),
                        s2c: permuteAlphabet(S2C_ALPHABET, (mixed ^ 2246822507) >>> 0)
                    };
                }

                /* Null until io-init lands, and null again on close, so a
                 * reconnect can never reuse a stale table or sequence number. */
                var session = null;

                ${exportsTarget} = {
                    socket: null
                    , connected: false
                    , socketId: -1
                    , connect: function (address, callback, events) {
                        if (this.socket) return;

                        var _this = this;
                        try {
                            var socketError = false;
                            /* Captured before the game locks window.WebSocket. */
                            var Native = window.OriginalWebSocket || window.WebSocket;
                            this.socket = new Native(address);
                            this.socket.binaryType = "arraybuffer";

                            /* The old client called back from onopen, which fired
                             * before io-init had handed over the opcode table — so
                             * the spawn packet went out unsigned and was dropped,
                             * and the player never entered the world. The shipped
                             * bundle calls back from io-init instead; so do we. */
                            var entered = false;

                            this.socket.onmessage = function (message) {
                                var parsed = msgpack.decode(new Uint8Array(message.data));
                                var type = parsed[0];
                                var data = parsed[1];

                                if (type === "io-init") {
                                    _this.socketId = data[0];
                                    session = data[3] === MODE_KEYED ? {
                                        key: hexToBytes(data[2])
                                        , tables: buildTables(data[1] >>> 0)
                                        , seq: 0
                                    } : null;
                                    if (!entered) {
                                        entered = true;
                                        callback();
                                    }
                                    return;
                                }

                                if (session && typeof type === "number") {
                                    type = session.tables.s2c.dec[type];
                                    if (type === undefined) return;
                                }

                                var handler = events[type];
                                if (handler) handler.apply(undefined, data);
                            };
                            this.socket.onopen = function () {
                                _this.connected = true;
                            };
                            this.socket.onclose = function (event) {
                                _this.connected = false;
                                session = null;
                                if (event.code == 4001) {
                                    callback("Invalid Connection");
                                } else if (!socketError) {
                                    callback("disconnected");
                                }
                            };
                            this.socket.onerror = function (error) {
                                if (_this.socket && _this.socket.readyState != 1) {
                                    socketError = true;
                                    console.error("Socket error", arguments);
                                    callback("Socket error");
                                }
                            };
                        } catch (e) {
                            console.warn("Socket connection error:", e);
                            callback(e);
                        }
                    }
                    , send: function (type) {
                        if (!this.socket) return;
                        var data = Array.prototype.slice.call(arguments, 1);
${extras}
                        if (session) {
                            var opcode = session.tables.c2s.enc[type];
                            /* Unknown name means a packet the current server does
                             * not have. Dropping it here beats sending a frame the
                             * server will treat as malformed. */
                            if (opcode === undefined) return;
                            var body = msgpack.encode([opcode, data, ++session.seq]);
                            var frame = new Uint8Array(SIG_BYTES + body.length);
                            frame.set(signFrame(session.key, body), 0);
                            frame.set(body, SIG_BYTES);
                            this.socket.send(frame);
                            return;
                        }

                        this.socket.send(msgpack.encode([type, data]));
                    }
                    , socketReady: function () {
                        return (this.socket && this.connected);
                    }
                    , close: function () {
${close}
                    }
                };
`;
}

/* The document-start prologue.
 *
 * The shipped bundle now runs an anti-userscript pass at load which does
 *
 *     Object.defineProperty(window, "WebSocket",
 *         { value: <native>, writable: false, configurable: false })
 *
 * so a mod that only reaches `window.WebSocket = ...` at document-end or
 * document-idle silently loses the assignment and never sees the connection.
 * Getting in first is the whole fix: the bundle reads `window.WebSocket` into
 * its own local before it locks it, and its lock is inside a try/catch, so an
 * already-locked property is a no-op it swallows. */
function prologue(name) {
  return `/* ---------------------------------------------------------------------------
 * ${name} — document-start prologue
 *
 * Claims window.WebSocket before the game bundle can lock it, and hands the
 * captured native constructor to the mod under window.OriginalWebSocket.
 * The rest of the script still runs at DOM-ready, because the bundle reads
 * game DOM elements at module scope.
 * ------------------------------------------------------------------------- */
(function () {
    if (window.__reupSocketHook) return;

    var Native = window.WebSocket;
    window.OriginalWebSocket = Native;

    var forward = null;
    var pending = [];

    function HookedWebSocket(address) {
        /* The game's server lookup is a fetch, so it can reach this point
         * before the mod body has run — the mod body waits for the DOM. Hold
         * the address rather than opening a native socket, or that race
         * quietly hands the connection back to the vanilla client and the mod
         * looks like it did nothing. */
        if (forward) {
            forward(address);
            return;
        }
        pending.push(address);
    }

    HookedWebSocket.prototype.send = function () {};
    HookedWebSocket.prototype.close = function () {};
    HookedWebSocket.prototype.addEventListener = function () {};
    HookedWebSocket.prototype.removeEventListener = function () {};
    HookedWebSocket.prototype.dispatchEvent = function () { return false; };
    HookedWebSocket.prototype.binaryType = "arraybuffer";
    HookedWebSocket.prototype.readyState = 3;
    HookedWebSocket.CONNECTING = 0;
    HookedWebSocket.OPEN = 1;
    HookedWebSocket.CLOSING = 2;
    HookedWebSocket.CLOSED = 3;

    window.__reupSocketHook = function (fn) {
        forward = fn;
        while (pending.length) fn(pending.shift());
    };

    window.setTimeout(function () {
        if (!forward && pending.length) {
            console.error("${name}: the game opened a socket but the mod never registered its hook.");
        }
    }, 10000);

    try {
        Object.defineProperty(window, "WebSocket", {
            value: HookedWebSocket,
            writable: false,
            configurable: false
        });
    } catch (e) {
        window.WebSocket = HookedWebSocket;
    }
})();

`;
}

/* Runs the mod body once the game DOM exists — document-start is far too early
 * for the bundle, which resolves #enterGame and friends at module scope. */
function domReadyOpen() {
  return `(function () {
function __modMain() {
`;
}

function domReadyClose() {
  return `
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __modMain, { once: true });
} else {
    __modMain();
}
})();
`;
}

module.exports = {
  ioClientModule,
  prologue,
  domReadyOpen,
  domReadyClose,
  drivers: () =>
    JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")),
};
