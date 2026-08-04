#!/usr/bin/env node
/*
 * build-luna.js
 *
 * Builds Luna_Fixed.user.js from src/Luna_Client_1.1.js.
 *
 * Luna is a fork of the old webpack bundle like luminary, but a much later
 * one: it already speaks the current opcode names, all 17 c2s and all 36 s2c,
 * and its weapons, hats, accessories, projectiles and item groups diff clean
 * against the shipped bundle. What it is missing is everything the game added
 * around those names.
 *
 *   transport  frames are still plain `[name, args]`. They need the
 *              per-connection opcode permutation, the sequence number and the
 *              6-byte truncated HMAC, all negotiated from io-init.
 *   hook       Luna works by replacing window.WebSocket to steal the address
 *              the real client dials. The client now freezes that property
 *              during its own module execution, which happens before
 *              DOMContentLoaded, so a document-idle userscript is too late.
 *   sandbox    `inSandbox` is a server-side expression that is always false in
 *              a browser, so sandbox placement was capped at the normal limits.
 *   items      five upgrades carry no `pre`.
 *
 *   node tools/build-luna.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Luna_Client_1.1.js");
const OUT = path.join(ROOT, "Luna_Fixed.user.js");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

/* The source is CRLF; normalise so anchors below can be written plainly. */
let code = fs.readFileSync(BASE, "utf8").replace(/\r\n/g, "\n");
const applied = [];

function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

const P = DRIVERS.protocol;
const J = (v) => JSON.stringify(v);

/* Luna registers its handlers under the current s2c names already, so there is
 * no translation layer here - just a sanity check that the two still agree. */
{
  const at = code.indexOf(`                    "A": setInitData,`);
  if (at === -1) throw new Error("Luna's s2c handler table not found");
  const block = code.slice(at, code.indexOf("});", at));
  const keys = [...block.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
  const missing = P.s2cAlphabet.filter((o) => !keys.includes(o));
  const extra = keys.filter((k) => !P.s2cAlphabet.includes(k));
  if (missing.length) throw new Error(`Luna has no handler for s2c ${missing.join(", ")}`);
  if (extra.length) throw new Error(`Luna handles unknown s2c ${extra.join(", ")}`);

  const sent = new Set([...code.matchAll(/io\.send\("([^"]+)"/g)].map((m) => m[1]));
  const unknown = [...sent].filter((o) => !P.c2sAlphabet.includes(o));
  if (unknown.length) throw new Error(`Luna sends unknown c2s ${unknown.join(", ")}`);
  applied.push(`opcodes: ${keys.length} s2c and ${sent.size} c2s already match the bundle`);
}

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 * ------------------------------------------------------------------ */

{
  const end = code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of Luna's userscript header");
  const header = `// ==UserScript==
// @name            Luna Client (fixed)
// @namespace       luna-fixed
// @author          Luna and Skye, with help from Zenith and XTRFY
// @description     Luna 1.1 rebuilt against the current moomoo.io transport
// @version         1.1.1
// @match           *://moomoo.io/*
// @match           *://*.moomoo.io/*
// @run-at          document-start
// @grant           none
// ==/UserScript==
`;
  code = header + code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  applied.push("header: @run-at document-start");
}

/* ------------------------------------------------------------------ *
 * 2. The WebSocket hook, and deferring the rest
 *
 * Luna does not remove the real client - it lets it run, replaces
 * window.WebSocket, and connects its own socket to whatever address the real
 * client dials. That still works, but the timing does not: the client now
 * captures window.WebSocket and then freezes the property with
 * Object.defineProperty during its own module execution. Module scripts are
 * deferred, so that happens just before DOMContentLoaded - after a
 * document-idle userscript would have run, and before a document-start one
 * has a DOM to touch.
 *
 * So the hook is installed on its own at document-start, and everything else
 * waits for the DOM. The stub carries a prototype `send`, because the client
 * reads `window.WebSocket.prototype.send` off it at module scope and calls it
 * later.
 * ------------------------------------------------------------------ */

{
  const at = code.indexOf("/******/ (function (modules) { // webpackBootstrap");
  if (at === -1) throw new Error("anchor not found: webpack bootstrap");

  const early = `
var __lunaPendingAddress = null;
var __lunaConnect = null;

window.OriginalWebSocket = window.WebSocket;

function __LunaSocket(address) {
    if (__lunaConnect) {
        __lunaConnect(address);
    } else {
        __lunaPendingAddress = address;
    }
}
__LunaSocket.prototype.send = function () {};
__LunaSocket.prototype.close = function () {};
__LunaSocket.prototype.addEventListener = function () {};
__LunaSocket.prototype.removeEventListener = function () {};
__LunaSocket.CONNECTING = 0;
__LunaSocket.OPEN = 1;
__LunaSocket.CLOSING = 2;
__LunaSocket.CLOSED = 3;

try {
    Object.defineProperty(window, "WebSocket", {
        value: __LunaSocket,
        writable: true,
        configurable: true
    });
} catch (e) {
    window.WebSocket = __LunaSocket;
}

window.__lunaRegisterConnect = function (fn) {
    __lunaConnect = fn;
    if (__lunaPendingAddress) {
        var address = __lunaPendingAddress;
        __lunaPendingAddress = null;
        fn(address);
    }
};

function __lunaBoot() {
`;

  code = code.slice(0, at) + early + code.slice(at);
  code += `
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __lunaBoot);
} else {
    __lunaBoot();
}
`;
  applied.push("entry: hook installed at document-start, the client deferred to DOMContentLoaded");
}

edit(
  "entry: Luna's own hook feeds off the early one",
  `            window.OriginalWebSocket = window.WebSocket;
            window.WebSocket = class {
                constructor(wsAddr) {
                    if (!wsAddress) {
                        wsAddress = wsAddr;
                    }

                    connectSocket(wsAddr);
                };
            }`,
  `            window.__lunaRegisterConnect(function (wsAddr) {
                if (!wsAddress) {
                    wsAddress = wsAddr;
                }

                connectSocket(wsAddr);
            });`
);

/* ------------------------------------------------------------------ *
 * 3. Transport
 *
 * Only the frame changes. Luna's opcode names are already the current ones,
 * so they go straight through the permutation tables with no renaming.
 * ------------------------------------------------------------------ */

const crypto = `
            var LUNA_SIG = ${P.signatureBytes}, LUNA_MODE = ${P.encryptedMode}, LUNA_SALT = ${P.tableSalt};
            var LUNA_C2S = ${J(P.c2sAlphabet)};
            var LUNA_S2C = ${J(P.s2cAlphabet)};
            var LUNA_K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

            function lunaRotr(e, t) {
                return e >>> t | e << 32 - t;
            }

            function lunaSha256(e) {
                var t = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
                var i = e.length, s = i * 8, n = i + 9;
                var a = new Uint8Array(Math.ceil(n / 64) * 64);
                a.set(e);
                a[i] = 128;
                var o = new DataView(a.buffer);
                o.setUint32(a.length - 4, s >>> 0, false);
                o.setUint32(a.length - 8, Math.floor(s / 4294967296), false);
                var d = new Uint32Array(64);
                for (var m = 0; m < a.length; m += 64) {
                    for (var w = 0; w < 16; w++) d[w] = o.getUint32(m + w * 4, false);
                    for (var w = 16; w < 64; w++) {
                        var T = lunaRotr(d[w - 15], 7) ^ lunaRotr(d[w - 15], 18) ^ d[w - 15] >>> 3;
                        var A = lunaRotr(d[w - 2], 17) ^ lunaRotr(d[w - 2], 19) ^ d[w - 2] >>> 10;
                        d[w] = d[w - 16] + T + d[w - 7] + A | 0;
                    }
                    var g = t[0], h = t[1], u = t[2], p = t[3], x = t[4], I = t[5], P2 = t[6], f = t[7];
                    for (var w = 0; w < 64; w++) {
                        var T2 = lunaRotr(x, 6) ^ lunaRotr(x, 11) ^ lunaRotr(x, 25);
                        var A2 = x & I ^ ~x & P2;
                        var V = f + T2 + A2 + LUNA_K[w] + d[w] | 0;
                        var W = lunaRotr(g, 2) ^ lunaRotr(g, 13) ^ lunaRotr(g, 22);
                        var S = g & h ^ g & u ^ h & u;
                        var H = W + S | 0;
                        f = P2, P2 = I, I = x, x = p + V | 0, p = u, u = h, h = g, g = V + H | 0;
                    }
                    t[0] = t[0] + g | 0, t[1] = t[1] + h | 0, t[2] = t[2] + u | 0, t[3] = t[3] + p | 0,
                    t[4] = t[4] + x | 0, t[5] = t[5] + I | 0, t[6] = t[6] + P2 | 0, t[7] = t[7] + f | 0;
                }
                var l = new Uint8Array(32), c = new DataView(l.buffer);
                for (var m = 0; m < 8; m++) c.setUint32(m * 4, t[m], false);
                return l;
            }

            function lunaHmac(e, t) {
                var BLOCK = 64;
                var i = e;
                if (i.length > BLOCK) i = lunaSha256(i);
                var s = new Uint8Array(BLOCK);
                s.set(i);
                var n = new Uint8Array(BLOCK + t.length), a = new Uint8Array(BLOCK + 32);
                for (var o = 0; o < BLOCK; o++) {
                    n[o] = s[o] ^ 54;
                    a[o] = s[o] ^ 92;
                }
                n.set(t, BLOCK);
                a.set(lunaSha256(n), BLOCK);
                return lunaSha256(a);
            }

            function lunaUnhex(e) {
                var t = new Uint8Array(e.length / 2);
                for (var i = 0; i < t.length; i++) t[i] = parseInt(e.substr(i * 2, 2), 16);
                return t;
            }

            function lunaRng(e) {
                return function () {
                    e |= 0;
                    e = e + 1831565813 | 0;
                    var t = Math.imul(e ^ e >>> 15, 1 | e);
                    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
                    return ((t ^ t >>> 14) >>> 0) / 4294967296;
                };
            }

            function lunaPermute(e, t) {
                var i = e.length, s = e.map(function (d, l) { return l; }), n = lunaRng(t >>> 0);
                for (var d = i - 1; d > 0; d--) {
                    var l = Math.floor(n() * (d + 1)), c = s[d];
                    s[d] = s[l];
                    s[l] = c;
                }
                var a = {}, o = {};
                for (var d = 0; d < i; d++) {
                    a[e[d]] = s[d];
                    o[s[d]] = e[d];
                }
                return { enc: a, dec: o };
            }

            function lunaTables(e) {
                var t = (e ^ Math.imul(LUNA_SALT, 2654435761)) >>> 0;
                return { c2s: lunaPermute(LUNA_C2S, t), s2c: lunaPermute(LUNA_S2C, (t ^ 2246822507) >>> 0) };
            }

            var lunaState = null;

`;

edit(
  "packet: frame crypto and permutation tables",
  `            module.exports = {
                socket: null,
                connected: false,
                socketId: -1,`,
  crypto + `            module.exports = {
                socket: null,
                connected: false,
                socketId: -1,`
);

edit(
  "packet: io-init negotiation, and play starts after it rather than on open",
  `                        this.socket.onmessage = function (message) {

                            // PARSE MESSAGE:
                            var data = new Uint8Array(message.data);
                            var parsed = msgpack.decode(data);
                            var type = parsed[0];
                            var data = parsed[1];

                            // CALL EVENT:
                            if (type == "io-init") {
                                _this.socketId = data[0];
                            } else {
                                events[type].apply(undefined, data);
                            }
                        };
                        this.socket.onopen = function () {
                            _this.connected = true;
                            callback();
                        };`,
  `                        var greeted = false;
                        this.socket.onmessage = function (message) {

                            // PARSE MESSAGE:
                            var parsed = msgpack.decode(new Uint8Array(message.data));
                            var type = parsed[0];
                            var data = parsed[1];

                            // CALL EVENT:
                            if (type == "io-init") {
                                _this.socketId = data[0];
                                lunaState = data[3] === LUNA_MODE ? {
                                    key: lunaUnhex(data[2]),
                                    tables: lunaTables(data[1] >>> 0),
                                    seq: 0
                                } : null;
                                if (!greeted) {
                                    greeted = true;
                                    callback();
                                }
                                return;
                            }
                            if (lunaState && typeof type === "number") {
                                type = lunaState.tables.s2c.dec[type];
                                if (type === undefined) return;
                            }
                            var handler = events[type];
                            if (handler) handler.apply(undefined, data);
                        };
                        this.socket.onopen = function () {
                            _this.connected = true;
                        };`
);

edit(
  "packet: outbound frames carry a sequence number behind an HMAC prefix",
  `                send: function (type) {
                    var data = Array.prototype.slice.call(arguments, 1);
                    var binary = msgpack.encode([type, data]);

                    packets++;
                    if (packetInterval === undefined) {
                        packetInterval = setInterval(function () {
                            pps = packets;
                            packets = 0;
                        }, 1000);
                    }

                    this.socket.send(binary);
                },`,
  `                send: function (type) {
                    if (!this.socket || this.socket.readyState !== OriginalWebSocket.OPEN) return;
                    var data = Array.prototype.slice.call(arguments, 1);

                    packets++;
                    if (packetInterval === undefined) {
                        packetInterval = setInterval(function () {
                            pps = packets;
                            packets = 0;
                        }, 1000);
                    }

                    if (lunaState) {
                        var opcode = lunaState.tables.c2s.enc[type];
                        if (opcode === undefined) return;
                        var payload = msgpack.encode([opcode, data, ++lunaState.seq]);
                        var signature = lunaHmac(lunaState.key, payload).subarray(0, LUNA_SIG);
                        var frame = new Uint8Array(LUNA_SIG + payload.length);
                        frame.set(signature, 0);
                        frame.set(payload, LUNA_SIG);
                        this.socket.send(frame);
                        return;
                    }

                    this.socket.send(msgpack.encode([type, data]));
                },`
);

edit(
  "packet: close resets the negotiated state",
  `                close: function () {
                    this.socket && this.socket.close();
                }`,
  `                close: function () {
                    this.socket && this.socket.close();
                    this.socket = null;
                    this.connected = false;
                    lunaState = null;
                }`
);

/* ------------------------------------------------------------------ *
 * 4. Sandbox
 *
 * `process.env.VULTR_SCHEME` is how the server decides, and it is always
 * undefined in a browser, so Luna's inSandbox never turned on and sandbox
 * placement was gated at the normal limits. The only signal the shipped
 * client actually resolves in a browser is the hostname - its own
 * `inSandbox` is `Ut && {}.IS_SANDBOX`, equally dead, and the one place it
 * shows sandbox caps it uses the hostname instead.
 * ------------------------------------------------------------------ */

edit(
  "sandbox: detect by hostname, the way the shipped client does",
  `                module.exports.inSandbox = process && process.env.VULTR_SCHEME === "mm_exp";`,
  `                module.exports.inSandbox = window.location.hostname === "sandbox.moomoo.io" || window.location.hostname === "sandbox-dev.moomoo.io";`
);

edit(
  "sandbox: canBuild uses the bundle's per-group cap",
  `                this.canBuild = function (item) {
                    if (config.inSandbox)
                        return true;
                    if (item.group.limit && this.itemCounts[item.group.id] >= item.group.limit)
                        return false;
                    return this.hasRes(item);
                };`,
  `                this.canBuild = function (item) {
                    var limit = config.inSandbox ? item.group.sandboxLimit || Math.max(item.group.limit * 3, 99) : item.group.limit;
                    if (limit && this.itemCounts[item.group.id] >= limit)
                        return false;
                    return config.inSandbox ? true : this.hasRes(item);
                };`
);

edit(
  "placer: isItemLimit read sandboxLimit outside sandbox and ignored the real limit",
  `            function isItemLimit(id) {
                let group = items.list[id].group;
                let limit = (group.sandboxLimit || 99);

                if (myPlayer.itemCounts[group.id] >= limit) {
                    return true;
                }
            }`,
  `            function isItemLimit(id) {
                let group = items.list[id].group;
                let limit = config.inSandbox ? group.sandboxLimit || Math.max(group.limit * 3, 99) : group.limit;

                if (limit && myPlayer.itemCounts[group.id] >= limit) {
                    return true;
                }
            }`
);

/* ------------------------------------------------------------------ *
 * 5. Config scalars
 * ------------------------------------------------------------------ */

edit(
  `config: maxPlayers ${DRIVERS.config.maxPlayers} / maxPlayersHard ${DRIVERS.config.maxPlayersHard}`,
  `                module.exports.maxPlayers = Infinity; // (process && process.argv.indexOf("--largeserver") != -1) ? 80 : 50;
                module.exports.maxPlayersHard = Infinity; // module.exports.maxPlayers + 10;`,
  `                module.exports.maxPlayers = ${DRIVERS.config.maxPlayers};
                module.exports.maxPlayersHard = ${DRIVERS.config.maxPlayersHard};`
);

/* ------------------------------------------------------------------ *
 * 6. Item table
 *
 * Same gap luminary had: the five upgrades that need a prerequisite carry no
 * `pre`, so the upgrade menu offers them unconditionally. Luna normalises
 * `pre` to an absolute index on load exactly like the bundle, so restoring
 * the values is enough.
 * ------------------------------------------------------------------ */

{
  const at = code.indexOf("module.exports.list = [");
  if (at === -1) throw new Error("anchor not found: Luna item list");
  const start = code.indexOf("[", at);
  const body = code.slice(start);
  let depth = 0, quote = null, end = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("unterminated Luna item list");

  const forkItems = vm.runInNewContext("(" + body.slice(0, end + 1) + ")", {
    module: { exports: { groups: DRIVERS.itemGroups } },
    Math,
  });
  if (forkItems.length !== DRIVERS.items.length) {
    throw new Error(`item count drift: Luna has ${forkItems.length}, bundle has ${DRIVERS.items.length}`);
  }

  const kept = [];
  const rendered = "[" + DRIVERS.items.map((game, i) => {
    const fork = forkItems[i] || {};
    if (fork.name !== game.name) {
      throw new Error(`item ${i} is "${fork.name}" in Luna and "${game.name}" in the bundle`);
    }
    const fields = [];
    for (const k of Object.keys(game)) {
      if (k === "group") fields.push(`\n                    group: module.exports.groups[${game.group.id}]`);
      else fields.push(`\n                    ${k}: ${J(game[k])}`);
    }
    for (const k of Object.keys(fork)) {
      if (k === "group" || k in game) continue;
      kept.push(`${game.name}.${k}`);
      fields.push(`\n                    ${k}: ${J(fork[k])}`);
    }
    return "{" + fields.join(",") + "\n                }";
  }).join(", ") + "]";

  code = code.slice(0, start) + rendered + code.slice(start + end + 1);
  applied.push(`tables: item list rebuilt from the bundle (kept ${[...new Set(kept.map((k) => k.split(".")[1]))].join(", ")})`);
}

fs.writeFileSync(OUT, code);

console.log(`wrote ${path.relative(ROOT, OUT)} (${code.length} bytes)`);
for (const a of applied) console.log("  - " + a);
