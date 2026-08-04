#!/usr/bin/env node
/*
 * build-luminary.js
 *
 * Builds Luminary_Fixed.user.js from src/Luminary_v3.js.
 *
 * Luminary is a fork of the old webpack bundle.js: it strips the game's own
 * script and runs its own copy of the client. Its data tables still match the
 * shipped game (hats, accessories, weapons, items all diff clean against
 * drivers/game-drivers.json) but everything around the wire changed:
 *
 *   entry     the game no longer ships bundle.js, it ships ES modules
 *   packet    frames are now [opcode, args, seq] behind a 6-byte HMAC prefix,
 *             with the opcode alphabets permuted per connection from a seed
 *   opcodes   both alphabets were renamed; the order is preserved, so the old
 *             names map onto the new ones position for position
 *   discovery servers come from api.moomoo.io and are addressed by name, and
 *             the socket URL lost its port and gameIndex
 *   captcha   reCAPTCHA was replaced by Cloudflare Turnstile
 *
 * Every value below is read out of src/game_index.js / src/game_vendor.js
 * rather than hand-copied, and every edit is anchored to an exact string in
 * the fork so a stale anchor fails the build instead of half-patching it.
 *
 *   node tools/build-luminary.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Luminary_v3.js");
const OUT = path.join(ROOT, "Luminary_Fixed.user.js");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

const P = DRIVERS.protocol;
const need = [
  "signatureBytes", "encryptedMode", "tableSalt", "c2sAlphabet", "s2cAlphabet",
  "turnstileSitekey", "serverListVersion", "apiHost",
];
for (const k of need) {
  if (P[k] === undefined) throw new Error(`drivers/game-drivers.json is missing protocol.${k}`);
}

/* The old alphabets, in the order the fork's own tables list them. Both sides
 * were renamed wholesale but not reordered, so index i of the old list is
 * index i of the alphabet the game ships now. */
const OLD_C2S = ["sp", "2", "33", "rmd", "c", "5", "6", "7", "8", "9", "10", "11", "12", "13c", "ch", "14", "pp"];
const OLD_S2C = ["id", "d", "1", "2", "4", "33", "5", "6", "a", "aa", "7", "8", "sp", "9", "h", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "ac", "ad", "an", "st", "sa", "us", "ch", "mm", "t", "p", "pp"];

if (P.c2sAlphabet.length !== OLD_C2S.length) {
  throw new Error(`c2s alphabet is ${P.c2sAlphabet.length} long, the fork sends ${OLD_C2S.length} opcodes`);
}
if (P.s2cAlphabet.length !== OLD_S2C.length) {
  throw new Error(`s2c alphabet is ${P.s2cAlphabet.length} long, the fork handles ${OLD_S2C.length} opcodes`);
}

const J = (v) => JSON.stringify(v);

/* Elements the fork reads out of the page that the current client never
 * touches. Anything in that gap may have been dropped from the HTML along
 * with the code that used it, and the fork reads most of them unguarded at
 * boot - one missing node aborts the whole script before it can hide the
 * loading screen. `itemCounts*` are excluded: the fork builds those itself,
 * so a stub would shadow the real node. */
const LEGACY_IDS = (() => {
  const idsIn = (src) => new Set([...src.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]));
  const fork = idsIn(code);
  const game = idsIn(fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8"));
  return [...fork].filter((id) => !game.has(id) && !/^itemCounts\d+$/.test(id)).sort();
})();

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 *
 * The original @match has no scheme, so a manager either rejects the pattern
 * or never runs the script. It also has no @run-at, which defaults to
 * document-idle - long after the game's own modules have run.
 * ------------------------------------------------------------------ */

{
  const end = code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of the fork's userscript header");
  const header = `// ==UserScript==
// @name            luminary (fixed)
// @namespace       luminary-fixed
// @author          onion, dreadful - based on wespire
// @description     luminary rebuilt against the current moomoo.io transport
// @version         3.1.0
// @icon            https://f4.bcbits.com/img/a2660869780_10.jpg
// @match           *://moomoo.io/*
// @match           *://*.moomoo.io/*
// @run-at          document-start
// @grant           none
// ==/UserScript==
`;
  code = header + code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  applied.push("header: scheme-qualified @match, @run-at document-start");
}

/* ------------------------------------------------------------------ *
 * 2. Entry
 *
 * The fork materialises the page synchronously so its DOM lookups resolve
 * immediately, then deletes the game's script tag. It looks for bundle.js,
 * which the game stopped shipping - the real client now loads as ES modules
 * out of /assets, so nothing was being removed and both clients ran at once.
 *
 * The sync fetch stays (it is what makes the DOM exist this early); what it
 * strips changes, and a guard catches any game script the parser had already
 * queued before the swap.
 * ------------------------------------------------------------------ */

edit(
  "entry: strip the game's module scripts instead of bundle.js",
  `var xhr = new XMLHttpRequest;
xhr.open("GET", document.URL, false);
xhr.send(null);
var content = xhr.responseText;
var doc = document.implementation.createHTMLDocument("" + (document.title || ""));
doc.open();
doc.write(content);
doc.close();
[...doc.getElementsByTagName("script")].find(e => e?.src.endsWith("bundle.js"))?.remove();
document.replaceChild(document.importNode(doc.documentElement, true), document.documentElement);`,
  `var isGameAsset = function(url) {
    if (!url) return false;
    return /\\/assets\\/(index|vendor)[-.][^/]*\\.js(\\?|$)/.test(url) || /(^|\\/)bundle\\.js(\\?|$)/.test(url);
};

(function() {
    var kill = function(node) {
        if (!node || node.nodeType !== 1) return;
        var tag = node.tagName;
        if (tag === "SCRIPT") {
            if (isGameAsset(node.src) || node.type === "module" && isGameAsset(node.src)) {
                node.type = "javascript/blocked";
                node.removeAttribute("src");
                node.remove();
            }
        } else if (tag === "LINK" && node.rel === "modulepreload" && isGameAsset(node.href)) {
            node.remove();
        }
    };
    document.addEventListener("beforescriptexecute", function(e) {
        if (isGameAsset(e.target && e.target.src)) {
            e.preventDefault();
            e.target.remove();
        }
    }, true);
    new MutationObserver(function(records) {
        for (var i = 0; i < records.length; i++) {
            var added = records[i].addedNodes;
            for (var j = 0; j < added.length; j++) kill(added[j]);
        }
    }).observe(document.documentElement, { childList: true, subtree: true });
})();

var xhr = new XMLHttpRequest;
xhr.open("GET", document.URL, false);
xhr.send(null);
var content = xhr.responseText;
var doc = document.implementation.createHTMLDocument("" + (document.title || ""));
doc.open();
doc.write(content);
doc.close();
[...doc.getElementsByTagName("script")].forEach(function(e) {
    if (isGameAsset(e.src)) e.remove();
});
[...doc.getElementsByTagName("link")].forEach(function(e) {
    if (e.rel === "modulepreload" && isGameAsset(e.href)) e.remove();
});
document.replaceChild(document.importNode(doc.documentElement, true), document.documentElement);

(function() {
    var legacy = ${J(LEGACY_IDS)};
    for (var i = 0; i < legacy.length; i++) {
        if (document.getElementById(legacy[i])) continue;
        var el = document.createElement("div");
        el.id = legacy[i];
        el.style.display = "none";
        (document.body || document.documentElement).appendChild(el);
    }
})();

(function() {
    var dead = ${J(["touch-controls-fullscreen", "touch-controls-left", "touch-controls-right", "pre-content-container", "userscript-warning"])};
    var apply = function() {
        for (var i = 0; i < dead.length; i++) {
            var el = document.getElementById(dead[i]);
            if (el) {
                el.style.display = "none";
                el.style.pointerEvents = "none";
            }
        }
        var play = document.getElementById("enterGame");
        if (play && play.classList.contains("disabled")) {
            play.classList.remove("disabled");
            play.style.pointerEvents = "auto";
        }
    };
    apply();
    setInterval(apply, 500);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
})();

var luminaryTurnstile = (function() {
    var SITEKEY = ${J(P.turnstileSitekey)};
    var token = null, widget = null, loading = false, host = null, signalled = false;
    var started = Date.now();
    var ready = function() {
        return !!(window.turnstile && typeof window.turnstile.render === "function");
    };
    var signal = function() {
        if (signalled || typeof window.captchaCallback !== "function") return;
        signalled = true;
        window.captchaCallback();
    };
    var load = function() {
        if (loading || ready()) return;
        loading = true;
        var s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.defer = true;
        (document.head || document.documentElement).appendChild(s);
    };
    var mount = function() {
        if (host) return host;
        if (!document.body) return null;
        host = document.createElement("div");
        host.id = "luminaryTurnstileHost";
        host.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:2147483000";
        document.body.appendChild(host);
        return host;
    };
    var render = function() {
        if (widget !== null || !ready() || !mount()) return;
        try {
            widget = window.turnstile.render(host, {
                sitekey: SITEKEY,
                theme: "light",
                callback: function(t) {
                    token = t;
                    host.style.display = "none";
                },
                "error-callback": function() {
                    token = null;
                },
                "expired-callback": function() {
                    token = null;
                    host.style.display = "";
                    try { window.turnstile.reset(widget); } catch (e) {}
                }
            });
        } catch (e) {
            widget = null;
        }
    };
    var tick = function() {
        load();
        render();
        if (ready() || Date.now() - started > 8000) signal();
    };
    setInterval(tick, 250);
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", tick);
    } else {
        tick();
    }
    return {
        get: function() { return token; },
        wait: function(cb) {
            if (token) return cb(token);
            var n = 0;
            var iv = setInterval(function() {
                if (token) { clearInterval(iv); cb(token); }
                else if (++n > 240) { clearInterval(iv); cb(null); }
            }, 250);
        }
    };
})();`
);

/* ------------------------------------------------------------------ *
 * 3. Transport
 *
 * Replaces the fork's socket module. Three things happen here that did not
 * before: io-init carries the permutation seed, the HMAC key and the
 * transport mode; outbound frames carry a sequence number and a truncated
 * HMAC; and both opcode alphabets are translated at the boundary so the
 * ~12k lines of game and mod code above keep speaking the old names.
 * ------------------------------------------------------------------ */

const socketModule = `    i(0),
        e.exports = (function() {
        var SIG = ${P.signatureBytes}, MODE = ${P.encryptedMode}, SALT = ${P.tableSalt};
        var C2S = ${J(P.c2sAlphabet)};
        var S2C = ${J(P.s2cAlphabet)};
        var OLD_C2S = ${J(OLD_C2S)};
        var OLD_S2C = ${J(OLD_S2C)};
        var TX = {}, RX = {};
        for (var q = 0; q < C2S.length; q++) TX[OLD_C2S[q]] = C2S[q];
        for (var q = 0; q < S2C.length; q++) RX[S2C[q]] = OLD_S2C[q];

        var K256 = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

        function rotr(e, t) {
            return e >>> t | e << 32 - t;
        }

        function sha256(e) {
            var t = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
            var i = e.length, s = i * 8, n = i + 9;
            var a = new Uint8Array(Math.ceil(n / 64) * 64);
            a.set(e), a[i] = 128;
            var o = new DataView(a.buffer);
            o.setUint32(a.length - 4, s >>> 0, false);
            o.setUint32(a.length - 8, Math.floor(s / 4294967296), false);
            var d = new Uint32Array(64);
            for (var m = 0; m < a.length; m += 64) {
                for (var w = 0; w < 16; w++) d[w] = o.getUint32(m + w * 4, false);
                for (var w = 16; w < 64; w++) {
                    var T = rotr(d[w - 15], 7) ^ rotr(d[w - 15], 18) ^ d[w - 15] >>> 3;
                    var A = rotr(d[w - 2], 17) ^ rotr(d[w - 2], 19) ^ d[w - 2] >>> 10;
                    d[w] = d[w - 16] + T + d[w - 7] + A | 0;
                }
                var g = t[0], h = t[1], u = t[2], p = t[3], x = t[4], I = t[5], P = t[6], f = t[7];
                for (var w = 0; w < 64; w++) {
                    var T2 = rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);
                    var A2 = x & I ^ ~x & P;
                    var V = f + T2 + A2 + K256[w] + d[w] | 0;
                    var W = rotr(g, 2) ^ rotr(g, 13) ^ rotr(g, 22);
                    var S = g & h ^ g & u ^ h & u;
                    var H = W + S | 0;
                    f = P, P = I, I = x, x = p + V | 0, p = u, u = h, h = g, g = V + H | 0;
                }
                t[0] = t[0] + g | 0, t[1] = t[1] + h | 0, t[2] = t[2] + u | 0, t[3] = t[3] + p | 0,
                t[4] = t[4] + x | 0, t[5] = t[5] + I | 0, t[6] = t[6] + P | 0, t[7] = t[7] + f | 0;
            }
            var l = new Uint8Array(32), c = new DataView(l.buffer);
            for (var m = 0; m < 8; m++) c.setUint32(m * 4, t[m], false);
            return l;
        }

        var BLOCK = 64;

        function hmac(e, t) {
            var i = e;
            i.length > BLOCK && (i = sha256(i));
            var s = new Uint8Array(BLOCK);
            s.set(i);
            var n = new Uint8Array(BLOCK + t.length), a = new Uint8Array(BLOCK + 32);
            for (var o = 0; o < BLOCK; o++) n[o] = s[o] ^ 54, a[o] = s[o] ^ 92;
            return n.set(t, BLOCK), a.set(sha256(n), BLOCK), sha256(a);
        }

        function sign(e, t) {
            return hmac(e, t).subarray(0, SIG);
        }

        function unhex(e) {
            var t = new Uint8Array(e.length / 2);
            for (var i = 0; i < t.length; i++) t[i] = parseInt(e.substr(i * 2, 2), 16);
            return t;
        }

        function rng(e) {
            return function() {
                e |= 0, e = e + 1831565813 | 0;
                var t = Math.imul(e ^ e >>> 15, 1 | e);
                return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
        }

        function permute(e, t) {
            var i = e.length, s = e.map(function(d, l) { return l; }), n = rng(t >>> 0);
            for (var d = i - 1; d > 0; d--) {
                var l = Math.floor(n() * (d + 1)), c = s[d];
                s[d] = s[l], s[l] = c;
            }
            var a = {}, o = {};
            for (var d = 0; d < i; d++) a[e[d]] = s[d], o[s[d]] = e[d];
            return { enc: a, dec: o };
        }

        function tablesFor(e) {
            var t = (e ^ Math.imul(SALT, 2654435761)) >>> 0;
            return { c2s: permute(C2S, t), s2c: permute(S2C, (t ^ 2246822507) >>> 0) };
        }

        var state = null;

        return {
            socket: null,
            connected: !1,
            socketId: -1,
            connect: function(e, t, i) {
                if (this.socket) return;
                var n = this;
                try {
                    var s = !1, greeted = !1;
                    this.socket = new WebSocket(e),
                        this.socket.binaryType = "arraybuffer",
                        this.socket.onmessage = function(e) {
                        var d = a.decode(new Uint8Array(e.data));
                        var m = d[0], g = d[1];
                        if (m === "io-init") {
                            n.socketId = g[0],
                                state = g[3] === MODE ? {
                                key: unhex(g[2]),
                                tables: tablesFor(g[1] >>> 0),
                                seq: 0
                            } : null,
                                greeted || (greeted = !0, t());
                            return;
                        }
                        if (state && typeof m === "number") {
                            m = state.tables.s2c.dec[m];
                            if (m === void 0) return;
                        }
                        var name = RX[m];
                        name === void 0 && (name = m);
                        var h = i[name];
                        h && h.apply(void 0, g);
                    },
                        this.socket.onopen = function() {
                        n.connected = !0;
                    },
                        this.socket.onclose = function(e) {
                        n.connected = !1,
                            state = null,
                            4001 == e.code ? t("Invalid Connection") : s || t("disconnected");
                    },
                        this.socket.onerror = function(e) {
                        this.socket && this.socket.readyState != WebSocket.OPEN && (s = !0,
                                                                                    console.error("Socket error", arguments),
                                                                                    t("Socket error"));
                    };
                } catch (e) {
                    console.warn("Socket connection error:", e),
                        t(e);
                }
            },
            send: function(e) {
                if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
                var t = Array.prototype.slice.call(arguments, 1);
                var name = TX[String(e)];
                if (name === void 0) return;
                if (state) {
                    var op = state.tables.c2s.enc[name];
                    if (op === void 0) return;
                    var seq = ++state.seq;
                    var payload = o.encode([op, t, seq]);
                    var sig = sign(state.key, payload);
                    var frame = new Uint8Array(SIG + payload.length);
                    frame.set(sig, 0), frame.set(payload, SIG),
                        this.socket.send(frame);
                    return;
                }
                this.socket.send(o.encode([name, t]));
            },
            socketReady: function() {
                return this.socket && this.connected;
            },
            close: function() {
                this.socket && this.socket.close(),
                    this.socket = null,
                    this.connected = !1,
                    state = null;
            }
        };
    })()
`;

edit(
  "packet: permuted opcodes, HMAC frame prefix, sequence number, io-init negotiation",
  `    i(0),
        e.exports = {
        socket: null,
        connected: !1,
        socketId: -1,
        connect: function(e, t, i) {
            if (!this.socket) {
                var n = this;
                try {
                    var s = !1,
                        o = e;
                    this.socket = new WebSocket(o),
                        this.socket.binaryType = "arraybuffer",
                        this.socket.onmessage = function(e) {
                        var t = new Uint8Array(e.data),
                            s = a.decode(t),
                            o = s[0];
                        t = s[1],
                            "io-init" == o ? n.socketId = t[0] : i[o].apply(void 0, t)
                    },
                        this.socket.onopen = function() {
                        n.connected = !0,
                            t()
                    },
                        this.socket.onclose = function(e) {
                        n.connected = !1,
                            4001 == e.code ? t("Invalid Connection") : s || t("disconnected")
                    },
                        this.socket.onerror = function(e) {
                        this.socket && this.socket.readyState != WebSocket.OPEN && (s = !0,
                                                                                    console.error("Socket error", arguments),
                                                                                    t("Socket error"))
                    }
                } catch (e) {
                    console.warn("Socket connection error:", e),
                        t(e)
                }
            }
        },
        send: function(e) {
            var t = Array.prototype.slice.call(arguments, 1),
                i = o.encode([e, t]);
            this.socket.send(i)
        },
        socketReady: function() {
            return this.socket && this.connected
        },
        close: function() {
            this.socket && this.socket.close()
        },
    }
`,
  socketModule
);

/* ------------------------------------------------------------------ *
 * 4. Captcha and socket URL
 *
 * reCAPTCHA is gone; the game gates connecting on a Turnstile token passed as
 * ?token=cf:<token>. The socket URL also lost its :8008 port and its
 * gameIndex query - servers are addressed by hostname alone now.
 * ------------------------------------------------------------------ */

edit(
  "captcha: reCAPTCHA -> Cloudflare Turnstile",
  `    function w() {
        lt && ht && (k = !0,
                     n ? window.grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
            action: "homepage"
        }).then((function(e) {
            v(e)
        })) : v(null))
    }`,
  `    function w() {
        lt && ht && (k = !0,
                     n ? luminaryTurnstile.wait((function(e) {
            v(e ? "cf:" + e : null)
        })) : v(null))
    }`
);

edit(
  "socket url: drop :8008 and gameIndex, token moves to the first query param",
  `            var c = (n ? "wss" : "ws") + "://" + t + ":8008/?gameIndex=" + a;
            e && (c += "&token=" + encodeURIComponent(e)),`,
  `            var c = (n ? "wss" : "ws") + "://" + t;
            e && (c += "?token=" + encodeURIComponent(e)),`
);

/* ------------------------------------------------------------------ *
 * 5. Server discovery
 *
 * The fork reads a `vultr` global the old page defined, addresses servers by
 * numeric index and reaches them at ip_<hash>.moomoo.io:<port>. The list now
 * comes from api.moomoo.io/servers, servers carry a name and a key, and the
 * address is <key>.<region>.moomoo.io.
 * ------------------------------------------------------------------ */

edit(
  "discovery: constructor no longer reads the vultr global",
  `            this.errorCallback = void 0,
            this.processServers(vultr.servers)`,
  `            this.errorCallback = void 0,
            this.servers = void 0,
            this.rawServers = []`
);

edit(
  "discovery: start() fetches the list, then honours ?server= or auto-picks",
  `        o.prototype.start = function(e, t) {
        this.callback = e,
            this.errorCallback = t;
        var i = this.parseServerQuery();
        i ? (this.log("Found server in query."),
             this.password = i[3],
             this.connect(i[0], i[1], i[2])) : (this.log("Pinging servers..."),
                                                this.pingServers())
    },`,
  `        o.prototype.serverListUrl = function() {
        var e = "sandbox.moomoo.io" == location.hostname || "sandbox-dev.moomoo.io" == location.hostname ? ${J(P.apiHost.replace("api.", "api-sandbox."))} : "dev.moomoo.io" == location.hostname || "dev2.moomoo.io" == location.hostname ? ${J(P.apiHost.replace("api.", "api-dev."))} : ${J(P.apiHost)};
        return e + ${J("/servers?v=" + P.serverListVersion)}
    },
        o.prototype.loadServers = function() {
        var e = this;
        return fetch(this.serverListUrl()).then((function(t) {
            return t.json()
        })).then((function(t) {
            return e.rawServers = t,
                e.processServers(t),
                t
        }))
    },
        o.prototype.pickServer = function() {
        var e = [];
        for (var t in this.servers)
            e = e.concat(this.servers[t]);
        if (e = e.filter((function(i) {
            return !i.isPrivate && i.playerCount < i.playerCapacity
        })),
            !e.length)
            return null;
        return e.reduce((function(i, n) {
            return i.playerCount > n.playerCount ? i : n
        }))
    },
        o.prototype.start = function(e, t) {
        this.callback = e,
            this.errorCallback = t;
        var i = this,
            n = function() {
            var s = i.parseServerQuery();
            if (s && s[0] && s[1] && i.findServer(s[0], s[1]))
                return i.log("Found server in query."),
                    i.password = s[2],
                    void i.connect(s[0], s[1]);
            var o = i.pickServer();
            o ? i.connect(o.region, o.name) : i.errorCallback("Unable to find server")
        };
        this.servers ? n() : this.loadServers().then(n).catch((function(s) {
            console.error("Failed to load server data:", s),
                i.errorCallback("Unable to find server")
        }))
    },`
);

edit(
  "discovery: ?server= is region:name now, not region:index:gameIndex",
  `        o.prototype.parseServerQuery = function() {
        var e = n.parse(location.href, !0),
            t = e.query.server;`,
  `        o.prototype.parseServerQueryLegacy = function() {
        var e = n.parse(location.href, !0),
            t = e.query.server;`
);

edit(
  "discovery: address servers by name",
  `        o.prototype.serverAddress = function(e, t) {
        return "127.0.0.1" == e || "7f000001" == e || "903d62ef5d1c2fecdcaeb5e7dd485eff" == e ? window.location.hostname : this.rawIPs ? t ? "ip_" + this.hashIP(e) + "." + this.baseUrl : e : "ip_" + e + "." + this.baseUrl
    },
        o.prototype.serverPort = function(e) {
        return 0 == e.region ? this.devPort : location.protocol.startsWith("https") ? 443 : 80
    },
        o.prototype.processServers = function(e) {
        for (var t = {}, i = 0; i < e.length; i++) {
            var n = e[i],
                s = t[n.region];
            null == s && (s = [],
                          t[n.region] = s),
                s.push(n)
        }
        for (var o in t)
            t[o] = t[o].sort((function(e, t) {
                return e.index - t.index
            }));
        this.servers = t
    },`,
  `        o.prototype.parseServerQuery = function(e) {
        var t = new URLSearchParams(location.search),
            i = e || t.get("server");
        if ("string" != typeof i)
            return null;
        var n = i.split(":");
        return [n[0], n[1], t.get("password")]
    },
        o.prototype.serverAddress = function(e) {
        return 0 == e.region ? window.location.hostname : e.key + "." + e.region + "." + this.baseUrl
    },
        o.prototype.serverPort = function(e) {
        return e.port
    },
        o.prototype.processServers = function(e) {
        for (var t = {}, i = 0; i < e.length; i++) {
            var n = e[i],
                s = t[n.region];
            null == s && (s = [],
                          t[n.region] = s),
                s.push(n)
        }
        for (var o in t)
            t[o] = t[o].sort((function(e, t) {
                return t.playerCount - e.playerCount
            }));
        this.servers = t
    },`
);

edit(
  "discovery: findServer / connect / switchServer / generateHref key off the name",
  `        o.prototype.connect = function(e, t, i) {
        if (!this.connected) {
            var n = this.findServer(e, t);
            null != n ? (this.log("Connecting to server", n, "with game index", i),
                         n.games[i].playerCount >= this.lobbySize ? this.errorCallback("Server is already full.") : (window.history.replaceState(document.title, document.title, this.generateHref(e, t, i, this.password)),
                                                                                                                     this.server = n,
                                                                                                                     this.gameIndex = i,
                                                                                                                     this.log("Calling callback with address", this.serverAddress(n.ip), "on port", this.serverPort(n), "with game index", i),
                                                                                                                     this.callback(this.serverAddress(n.ip), this.serverPort(n), i))) : this.errorCallback("Failed to find server for region " + e + " and index " + t)
        }
    },
        o.prototype.switchServer = function(e, t, i, n) {
        this.switchingServers = !0,
            window.location.href = this.generateHref(e, t, i, n)
    },
        o.prototype.generateHref = function(e, t, i, n) {
        var s = "/?server=" + (e = this.stripRegion(e)) + ":" + t + ":" + i;
        return n && (s += "&password=" + encodeURIComponent(n)),
            s
    },`,
  `        o.prototype.connect = function(e, t) {
        if (!this.connected) {
            var i = this.findServer(e, t);
            null != i ? i.playerCount >= i.playerCapacity ? this.errorCallback("Server is already full.") : (window.history.replaceState(document.title, document.title, this.generateHref(e, t, this.password)),
                                                                                                            this.server = i,
                                                                                                            this.gameIndex = 0,
                                                                                                            this.log("Calling callback with address", this.serverAddress(i), "on port", this.serverPort(i)),
                                                                                                            this.callback(this.serverAddress(i), this.serverPort(i), 0)) : this.errorCallback("Failed to find server for region " + e + " and name " + t)
        }
    },
        o.prototype.switchServer = function(e, t) {
        this.switchingServers = !0,
            window.location.href = this.generateHref(e, t, null)
    },
        o.prototype.generateHref = function(e, t, i) {
        var n = window.location.href.split("?")[0];
        return n += "?server=" + e + ":" + t,
            i && (n += "&password=" + encodeURIComponent(i)),
            n
    },`
);

edit(
  "discovery: findServer matches on name",
  `        o.prototype.findServer = function(e, t) {
        var i = this.servers[e];
        if (Array.isArray(i)) {
            for (var n = 0; n < i.length; n++) {
                var s = i[n];
                if (s.index == t)
                    return s
            }
            console.warn("Could not find server in region " + e + " with index " + t + ".")
        } else
            this.errorCallback("No server list for region " + e)
    },`,
  `        o.prototype.findServer = function(e, t) {
        var i = this.servers[e];
        if (null == i)
            return null;
        for (var n = 0; n < i.length; n++)
            if (i[n].name === t)
                return i[n];
        return null
    },`
);

/* ------------------------------------------------------------------ *
 * 6. Server list UI
 *
 * The list shape changed with it: flat named servers carrying their own
 * capacity, instead of a server holding an array of games.
 * ------------------------------------------------------------------ */

edit(
  "server list: fetch from the api host instead of /serverData",
  `    function pt() {
        var e = new XMLHttpRequest;
        e.onreadystatechange = function() {
            4 == this.readyState && (200 == this.status ? (window.vultr = JSON.parse(this.responseText),
                                                           y.processServers(vultr.servers),
                                                           ft()) : console.error("Failed to load server data with status code:", this.status))
        },
            e.open("GET", "/serverData", !0),
            e.send()
    }`,
  `    function pt() {
        y.loadServers().then((function() {
            ft()
        })).catch((function(e) {
            console.error("Failed to load server data:", e)
        }))
    }`
);

edit(
  "server list: render named servers with their own capacity",
  `            for (var o = y.servers[s], a = 0, c = 0; c < o.length; c++)
                for (var l = 0; l < o[c].games.length; l++)
                    a += o[c].games[l].playerCount;
            n += a;
            var h = y.regionInfo[s].name;
            i += "<option disabled>" + h + " - " + a + " players</option>";
            for (var u = 0; u < o.length; u++)
                for (var d = o[u], f = 0; f < d.games.length; f++) {
                    var p = d.games[f],
                        g = 1 * d.index + f + 1,
                        m = y.server && y.server.region === d.region && y.server.index === d.index && y.gameIndex == f,
                        k = h + " " + g + " [" + Math.min(p.playerCount, r.maxPlayers) + "/" + r.maxPlayers + "]";
                    let e = y.stripRegion(s) + ":" + u + ":" + f;
                    m && (de.getElementsByTagName("span")[0].innerText = e),
                        i += "<option value='" + e + "' " + (m ? "selected" : "") + ">" + k + "</option>"
                }
            i += "<option disabled></option>"`,
  `            for (var o = y.servers[s], a = 0, c = 0; c < o.length; c++)
                a += o[c].playerCount;
            n += a;
            var h = y.regionInfo[s] ? y.regionInfo[s].name : s;
            i += "<option disabled>" + h + " - " + a + " players</option>";
            for (var u = 0; u < o.length; u++) {
                var d = o[u],
                    m = y.server && y.server.region === d.region && y.server.name === d.name,
                    k = h + " " + d.name + " [" + Math.min(d.playerCount, d.playerCapacity) + "/" + d.playerCapacity + "]";
                let e = s + ":" + d.name;
                m && (de.getElementsByTagName("span")[0].innerText = e),
                    i += "<option value='" + e + "' " + (m ? "selected" : "") + ">" + k + "</option>"
            }
            i += "<option disabled></option>"`
);

edit(
  "server list: switching servers takes region and name",
  `        let e = be.value.split(":");
        y.switchServer(e[0], e[1], e[2])
    })));`,
  `        let e = be.value.split(":");
        y.switchServer(e[0], e[1])
    })));`
);

/* ------------------------------------------------------------------ *
 * 7. Item group limits
 *
 * The fork flattened every placement limit to 99 and dropped sandboxLimit, so
 * its own limit checks never fire and the placer spends ticks on items the
 * server will refuse. Restored from the shipped tables.
 * ------------------------------------------------------------------ */

{
  const at = code.indexOf("e.exports.groups = [{");
  if (at === -1) throw new Error("anchor not found: item groups table");
  const body = code.slice(code.indexOf("[", at));
  let depth = 0, end = -1;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "[") depth++;
    else if (body[i] === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("unterminated item groups table");

  const rendered = "[" + DRIVERS.itemGroups.map((g) => {
    const fields = ["id", "name", "place", "limit", "sandboxLimit", "layer"]
      .filter((k) => g[k] !== undefined)
      .map((k) => `\n        ${k}: ${g[k] === true ? "!0" : J(g[k])}`);
    return "{" + fields.join(",") + "\n    }";
  }).join(", ") + "]";

  const start = code.indexOf("[", at);
  code = code.slice(0, start) + rendered + code.slice(start + end + 1);
  applied.push("tables: item group limits restored from the shipped bundle");
}

/* ------------------------------------------------------------------ *
 * 8. Item table
 *
 * The fork's items agree with the bundle on everything it kept, but it
 * dropped two fields:
 *
 *   turnSpeed  the three windmills. The fork spins objects with
 *              `this.turnSpeed && (this.dir += this.turnSpeed * delta)`, so
 *              without it mills sit still.
 *   pre        castle wall, poison/spinning spikes, faster/power mill. The
 *              fork has the machinery (it normalises `pre` to an absolute
 *              index on load) and gates the upgrade menu on it, so without
 *              the values those upgrades offer themselves with no
 *              prerequisite.
 *
 * Rebuilt from the shipped table, keeping the fields the fork added on top
 * (`consume` on the foods, which its own HUD reads).
 * ------------------------------------------------------------------ */

{
  const at = code.indexOf("e.exports.list = [{");
  if (at === -1) throw new Error("anchor not found: item list table");
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
  if (end === -1) throw new Error("unterminated item list table");

  const forkItems = vm.runInNewContext("(" + body.slice(0, end + 1) + ")", {
    e: { exports: { groups: DRIVERS.itemGroups } },
    Math,
  });
  if (forkItems.length !== DRIVERS.items.length) {
    throw new Error(`item count drift: fork has ${forkItems.length}, bundle has ${DRIVERS.items.length}`);
  }

  const kept = [];
  const rendered = "[" + DRIVERS.items.map((game, i) => {
    const fork = forkItems[i] || {};
    if (fork.name !== game.name) {
      throw new Error(`item ${i} is "${fork.name}" in the fork and "${game.name}" in the bundle`);
    }
    const fields = [];
    for (const k of Object.keys(game)) {
      if (k === "group") fields.push(`\n            group: e.exports.groups[${game.group.id}]`);
      else fields.push(`\n            ${k}: ${J(game[k])}`);
    }
    for (const k of Object.keys(fork)) {
      if (k === "group" || k in game) continue;
      kept.push(`${game.name}.${k}`);
      fields.push(`\n            ${k}: ${J(fork[k])}`);
    }
    return "{" + fields.join(",") + "\n        }";
  }).join(", ") + "]";

  code = code.slice(0, start) + rendered + code.slice(start + end + 1);
  applied.push(`tables: item list rebuilt from the bundle (kept ${kept.join(", ")})`);
}

/* ------------------------------------------------------------------ *
 * 9. Config scalars
 *
 * shieldAngle is a deliberate change in the fork - the comment on it reads
 * "was divided by 3" - but the server still resolves shield coverage at
 * PI/3, so a client at PI/2 mispredicts every block. maxPlayers was left at
 * the old lobby size.
 * ------------------------------------------------------------------ */

{
  const shield = DRIVERS.config.shieldAngle;
  if (Math.abs(shield - Math.PI / 3) > 1e-12) {
    throw new Error(`bundle shieldAngle is ${shield}, expected PI/3`);
  }
  edit(
    "config: shieldAngle back to the bundle's PI/3",
    `            e.exports.shieldAngle = Math.PI / 2, // was divided by 3`,
    `            e.exports.shieldAngle = Math.PI / 3,`
  );

  edit(
    `config: maxPlayers ${DRIVERS.config.maxPlayers} to match the bundle`,
    `            e.exports.maxPlayers = 100,`,
    `            e.exports.maxPlayers = ${DRIVERS.config.maxPlayers},`
  );
}

/* ------------------------------------------------------------------ *
 * 10. Sandbox placement limits
 *
 * The fork caps every group at a flat 99 in sandbox. The bundle resolves it
 * per group:
 *
 *   inSandbox ? group.sandboxLimit || Math.max(group.limit * 3, 99)
 *             : group.limit
 *
 * so mills, boosters and teleporters get 299 there, not 99. Both the gate and
 * the counter in the item tooltip read it, and the fork had the flat cap in
 * the gate and the plain limit in the tooltip.
 *
 * The resource half of the bundle's canBuild needs no port: the fork's hasRes
 * already returns true in sandbox.
 * ------------------------------------------------------------------ */

const sandboxCap = (v) =>
  `${v}.inSandbox ? e.group.sandboxLimit || Math.max(e.group.limit * 3, 99) : e.group.limit`;

edit(
  "sandbox: canBuild honours sandboxLimit instead of a flat 99",
  `            if (e.group.limit && this.itemCounts[e.group.id] >= (i.inSandbox ? 99 : e.group.limit)) return false;
            return this.hasRes(e);`,
  `            var lmt = ${sandboxCap("i")};
            if (lmt && this.itemCounts[e.group.id] >= lmt) return false;
            return this.hasRes(e);`
);

edit(
  "sandbox: the item tooltip counts against the sandbox cap",
  `                e.group.limit && o.generateElement({
                    class: "itemInfoLmt",
                    text: (A.itemCounts[e.group.id] || 0) + "/" + e.group.limit,
                    parent: ze
                })`,
  `                var lmt = ${sandboxCap("r")};
                e.group.limit && o.generateElement({
                    class: "itemInfoLmt",
                    text: (A.itemCounts[e.group.id] || 0) + "/" + lmt,
                    parent: ze
                })`
);

/* The bundle also refuses to eat while wearing a noEat hat. The fork's table
 * carries the flag but its buildItem never checked it. */
edit(
  "buildItem: honour the noEat hat flag",
  `            return this.canBuild(e) && (e.consume || u.checkItemLocation(n, i, e.scale, 0.6, e.id, false, this));`,
  `            return this.canBuild(e) && !(e.consume && this.skin && this.skin.noEat) && (e.consume || u.checkItemLocation(n, i, e.scale, 0.6, e.id, false, this));`
);

fs.writeFileSync(OUT, code);

console.log(`wrote ${path.relative(ROOT, OUT)} (${code.length} bytes)`);
for (const a of applied) console.log("  - " + a);
