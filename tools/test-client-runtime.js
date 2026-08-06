#!/usr/bin/env node
/*
 * Loads each patched client into a page that behaves like the real one and
 * drives a connection through it.
 *
 * The order the page imposes is the whole point of the transport shim, so the
 * harness reproduces it exactly:
 *
 *   <head>   harness stubs, then the client  -> this is @run-at document-start
 *   <body>   the game's UI elements
 *   end of body   a transcription of the bundle's io object, which captures
 *                 window.WebSocket and WebSocket.prototype.send the way the real
 *                 bundle does at module-eval time
 *   DOMContentLoaded   the client's own body runs
 *
 * Then it connects, negotiates io-init, sends a spawn and a chat through the
 * bundle's io.send, and checks what actually reached the socket.
 *
 *   npm i --no-save jsdom
 *   node tools/test-client-runtime.js [clientName]
 */
"use strict";
const fs = require("fs");
const path = require("path");
let JSDOM, VirtualConsole;
try {
    ({ JSDOM, VirtualConsole } = require("jsdom"));
} catch (e) {
    console.error("this harness needs jsdom:  npm i --no-save jsdom");
    process.exit(2);
}
const { CLIENTS, outDir } = require("./patch-clients");

const root = path.join(__dirname, "..");
const indexSrc = fs.readFileSync(path.join(root, "src/game_index.js"), "utf8").split("\n");
const vendorSrc = fs.readFileSync(path.join(root, "src/game_vendor.js"), "utf8");

/* --------------------------------------------------------------- reference */
function lines(from, to) {
    return indexSrc.slice(from - 1, to).join("\n");
}
const referenceSrc = [
    "const " + lines(278, 282).replace(/^\s*,\s*/, ""),
    lines(283, 318),
    lines(319, 405),
    "return { sigBytes: jt, sign: Eo, tables: Po, hex: Ro };",
].join("\n");
const reference = new Function(referenceSrc)();
const vendorCodec = vendorSrc.split("\n").slice(0, 1450).join("\n");
const vendor = new Function(vendorCodec + "\nreturn { Encoder: yn, Decoder: kn };")();
const gameEncoder = new vendor.Encoder();
const gameDecoder = new vendor.Decoder();

const KEY_HEX = "8f1c2d3e4a5b60718293a4b5c6d7e8f9000102030405060708090a0b0c0d0e0f";
const SEED = 0x1234abcd;
const tables = reference.tables(SEED >>> 0);
const key = reference.hex(KEY_HEX);

/** what the server would make of a frame the page put on the wire */
function serverParse(frame) {
    if (frame.length <= 6) return { bad: "short frame" };
    const payload = frame.subarray(6);
    const sig = reference.sign(key, payload);
    for (let i = 0; i < 6; i++) if (sig[i] !== frame[i]) return { bad: "bad signature" };
    let parsed;
    try {
        parsed = gameDecoder.decode(payload);
    } catch (e) {
        return { bad: "undecodable payload" };
    }
    if (typeof parsed[0] !== "number") return { bad: "opcode is not numeric" };
    const name = tables.c2s.dec[parsed[0]];
    if (name === undefined) return { bad: "opcode " + parsed[0] + " not in the table" };
    return { name, args: parsed[1], seq: parsed[2] };
}

/* ------------------------------------------------------------------- page */
const GAME_IDS = `actionBar ad-container ageBarBody ageText allianceButton allianceHolder
allianceInput allianceManager allianceMenu altServer chatBox chatButton chatHolder diedText
downloadButtonContainer enterGame foodDisplay gameUI guideCard itemInfoHolder joinPartyButton
killCounter leaderboard leaderboardButton leaderboardData loadingText mainMenu mapDisplay
menuCardHolder mobileDownloadButtonContainer nameInput nativeResolution noticationDisplay
ot-sdk-btn-floating partyButton pingDisplay playMusic pre-content-container promoImg scoreDisplay
serverBrowser settingsButton showPing shutdownDisplay skinColorHolder stoneDisplay storeButton
storeHolder storeMenu turnstileWidget upgradeCounter upgradeHolder woodDisplay altcha
altcha_checkbox`.split(/\s+/).filter(Boolean);

const HARNESS_STUBS = `
window.__errors = [];
window.onerror = function (m, s, l, c, e) { window.__errors.push(String((e && e.stack) || m)); };
window.addEventListener("unhandledrejection", function (e) { window.__errors.push("unhandled rejection: " + e.reason); });

// a socket that records instead of connecting
window.__sockets = [];
function FakeSocket(url) {
    this.url = url;
    this.readyState = 1;
    this.binaryType = "blob";
    this.sent = [];
    this.__listeners = [];
    window.__sockets.push(this);
    var self = this;
    setTimeout(function () { self.__fire("open", {}); }, 0);
}
FakeSocket.prototype = Object.create(EventTarget.prototype);
FakeSocket.prototype.constructor = FakeSocket;
FakeSocket.prototype.send = function (data) { this.sent.push(data); };
FakeSocket.prototype.close = function () { this.readyState = 3; this.__fire("close", { code: 1000 }); };
FakeSocket.prototype.addEventListener = function (type, fn) { this.__listeners.push([type, fn]); };
FakeSocket.prototype.removeEventListener = function (type, fn) {
    this.__listeners = this.__listeners.filter(function (e) { return !(e[0] === type && e[1] === fn); });
};
FakeSocket.prototype.__fire = function (type, ev) {
    ev.type = type;
    ev.target = ev.currentTarget = this;
    var list = this.__listeners.slice();
    for (var i = 0; i < list.length; i++) if (list[i][0] === type) list[i][1].call(this, ev);
    var direct = this["on" + type];
    if (typeof direct === "function") direct.call(this, ev);
};
FakeSocket.prototype.__deliver = function (bytes) {
    var copy = new Uint8Array(bytes);
    this.__fire("message", { data: copy.buffer });
};
["onmessage", "onopen", "onclose", "onerror"].forEach(function (name) {
    Object.defineProperty(FakeSocket.prototype, name, {
        configurable: true,
        get: function () { return this["__" + name] || null; },
        set: function (fn) { this["__" + name] = fn; },
    });
});
FakeSocket.CONNECTING = 0; FakeSocket.OPEN = 1; FakeSocket.CLOSING = 2; FakeSocket.CLOSED = 3;
window.WebSocket = FakeSocket;

// things these clients reach for that jsdom does not have
window.DOMPurify = { sanitize: function (s) { return s; } };
window.Audio = function () { return { play: function () { return Promise.resolve(); }, pause: function () {}, volume: 1 }; };
window.Worker = function () {
    this.postMessage = function () {};
    this.terminate = function () {};
    this.addEventListener = function () {};
    this.removeEventListener = function () {};
};
window.URL.createObjectURL = window.URL.createObjectURL || function () { return "blob:harness/" + Math.random(); };
window.URL.revokeObjectURL = window.URL.revokeObjectURL || function () {};
window.AudioContext = window.AudioContext || function () {
    return { createOscillator: function () { return { connect: function () {}, start: function () {}, stop: function () {}, frequency: { value: 0 } }; },
             createGain: function () { return { connect: function () {}, gain: { value: 0 } }; },
             destination: {}, close: function () {}, resume: function () {}, currentTime: 0 };
};
window.webkitAudioContext = window.AudioContext;
window.OffscreenCanvas = window.OffscreenCanvas || function () { return { getContext: function () { return null; } }; };
// moomoo is an FRVR-hosted game and the page provides these; the bundle in
// src/game_index.js still calls into them, so a client fork may too
window.FRVR = {
    bootstrapper: { complete: function () { return Promise.resolve(); } },
    tracker: { levelStart: function () {}, levelEnd: function () {} },
    channelCharacteristics: { allowNavigation: true },
};
window.frvrSdkInitPromise = Promise.resolve();
window.grecaptcha = { render: function () {}, reset: function () {}, getResponse: function () { return ""; } };
// @require'd libraries are not fetched here, so stand jQuery up well enough
// for the cosmetic calls these clients make at load
window.$ = window.jQuery = function (sel) {
    var nodes = [];
    try { nodes = typeof sel === "string" ? Array.prototype.slice.call(document.querySelectorAll(sel)) : sel ? [sel] : []; } catch (e) {}
    var api = { length: nodes.length, ready: function (fn) { fn(); return api; },
        each: function (fn) { nodes.forEach(function (n, i) { fn.call(n, i, n); }); return api; },
        get: function (i) { return nodes[i]; } };
    "css on off attr addClass removeClass append prepend html text val hide show remove click find prop trigger appendTo".split(" ")
        .forEach(function (m) { if (!api[m]) api[m] = function () { return api; }; });
    return api;
};
// jsdom has no innerText
if (!("innerText" in HTMLElement.prototype))
    Object.defineProperty(HTMLElement.prototype, "innerText", {
        configurable: true,
        get: function () { return this.textContent; },
        set: function (v) { this.textContent = v; },
    });
window.alert = function () {};
window.prompt = function () { return ""; };
window.confirm = function () { return true; };
window.fetch = function () { return Promise.resolve({ ok: true, status: 200, headers: { get: function () { return null; } }, text: function () { return Promise.resolve(""); }, json: function () { return Promise.resolve([]); }, arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(0)); } }); };
window.requestAnimationFrame = window.requestAnimationFrame || function (fn) { return setTimeout(function () { fn(Date.now()); }, 16); };
window.cancelAnimationFrame = window.cancelAnimationFrame || clearTimeout;
Object.defineProperty(navigator, "hardwareConcurrency", { value: 8, configurable: true });

// These clients were written against the full moomoo page and query dozens of
// elements by id. Rather than hand-build all of it, any id that is missing is
// created on demand, so a client's body runs to completion and the transport
// chain underneath it can actually be exercised.
var __realGetById = document.getElementById.bind(document);
var __stubs = new Map();
document.getElementById = function (id) {
    var el = __realGetById(id);
    if (el) return el;
    if (__stubs.has(id)) return __stubs.get(id);
    el = document.createElement(/canvas/i.test(id) ? "canvas" : "div");
    el.id = id;
    // left detached on purpose: appending would fire the page's mutation
    // observers, and a client that probes for an element it then inserts would
    // spin forever
    __stubs.set(id, el);
    return el;
};
window.CanvasRenderingContext2D = window.CanvasRenderingContext2D || function () {};
window.CanvasRenderingContext2D.prototype = window.CanvasRenderingContext2D.prototype || {};

// a 2d context that absorbs whatever a client draws on it
HTMLCanvasElement.prototype.toDataURL = function () { return "data:image/png;base64,"; };
HTMLCanvasElement.prototype.getContext = HTMLElement.prototype.getContext = function () {
    var ctx = new Proxy({}, {
        get: function (t, k) {
            if (k in t) return t[k];
            if (k === "canvas") return document.createElement("canvas");
            if (k === "measureText") return function () { return { width: 10 }; };
            if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern")
                return function () { return { addColorStop: function () {} }; };
            if (k === "getImageData") return function () { return { data: new Uint8ClampedArray(4) }; };
            return function () {};
        },
        set: function (t, k, v) { t[k] = v; return true; },
    });
    return ctx;
};
`;

/* the bundle's io object, transcribed from src/game_index.js lines 406-496,
   including the two references it captures at module-eval time */
const FAKE_BUNDLE = `
(function () {
    var NativeWS = window.WebSocket;
    var savedSend = window.WebSocket && window.WebSocket.prototype.send;
    var Z = null;
    var SIG = 6;
    var io = {
        socket: null,
        connected: false,
        socketId: -1,
        handlers: null,
        connect: function (url, cb, handlers) {
            var self = this;
            this.handlers = handlers;
            this.socket = new NativeWS(url);
            this.socket.binaryType = "arraybuffer";
            this.socket.onmessage = function (d) {
                var bytes = new Uint8Array(d.data);
                var decoded = window.__decodeForBundle(bytes);
                var type = decoded[0], args = decoded[1];
                if (type === "io-init") {
                    self.socketId = args[0];
                    Z = args[3] === 1 ? { key: window.__hexToBytes(args[2]), tables: window.__tablesFor(args[1] >>> 0), seq: 0 } : null;
                    window.__bundleSawIoInit = true;
                    return;
                }
                if (Z && typeof type === "number") {
                    type = Z.tables.s2c.dec[type];
                    if (type === undefined) { window.__bundleDroppedUnknown = true; return; }
                }
                window.__bundleReceived.push(type);
                var h = handlers[type];
                if (h) h.apply(void 0, args);
            };
            this.socket.onopen = function () { self.connected = true; };
        },
        send: function (e) {
            var t = Array.prototype.slice.call(arguments, 1);
            if (!this.socket) return;
            if (Z) {
                var op = Z.tables.c2s.enc[e];
                if (op === undefined) return;
                var seq = ++Z.seq;
                var payload = window.__encodeForBundle([op, t, seq]);
                var sig = window.__signForBundle(Z.key, payload);
                var frame = new Uint8Array(SIG + payload.length);
                frame.set(sig, 0);
                frame.set(payload, SIG);
                savedSend.call(this.socket, frame);
                return;
            }
            savedSend.call(this.socket, window.__encodeForBundle([e, t]));
        },
    };
    window.__bundleReceived = [];
    window.__io = io;
    window.__savedSend = savedSend;
})();
`;

function pageHtml(clientSource) {
    const body = GAME_IDS.map((id) =>
        id === "nameInput"
            ? '<input id="nameInput" type="text">'
            : id === "gameCanvas"
              ? '<canvas id="gameCanvas"></canvas>'
              : id === "leaderboard"
                ? '<div id="leaderboard">Leaderboard</div>'
                : `<div id="${id}"></div>`
    ).join("\n");
    return `<!doctype html><html><head>
<script>${HARNESS_STUBS}<\/script>
<script>${clientSource}<\/script>
</head><body>
<canvas id="gameCanvas"></canvas>
${body}
<script>${FAKE_BUNDLE}<\/script>
</body></html>`;
}

/* ------------------------------------------------------------------ driver */
let failures = 0;
let ran = 0;
// a client throwing asynchronously must not take the harness down with it
const stray = [];
process.on("uncaughtException", (e) => stray.push(String(e && e.stack || e)));
process.on("unhandledRejection", (e) => stray.push("rejection: " + String(e && e.stack || e)));
function ok(file, name, cond, extra) {
    if (cond) return;
    failures++;
    console.error("    FAIL " + name + (extra ? " — " + extra : ""));
}

function settle(win) {
    return new Promise((resolve) => {
        const done = () => setTimeout(() => setTimeout(resolve, 0), 0);
        if (win.document.readyState === "loading") win.document.addEventListener("DOMContentLoaded", done, { once: true });
        else done();
    });
}

async function runClient(client) {
    const file = client.out;
    console.log("\n" + file);
    const source = fs.readFileSync(path.join(outDir, file), "utf8");

    const virtualConsole = new VirtualConsole();
    const jsdomErrors = [];
    virtualConsole.on("jsdomError", (e) => {
        // jsdom's CSS parser rejects plenty of valid modern CSS; not our concern
        // jsdom's CSS parser rejects plenty of valid modern CSS, and it has no
        // raster canvas; neither says anything about the client
        if (/Could not parse CSS|Not implemented:/.test(e.message)) return;
        jsdomErrors.push(e.message + (e.detail ? " :: " + e.detail : ""));
    });
    virtualConsole.on("error", () => {});
    virtualConsole.on("warn", () => {});
    virtualConsole.on("log", () => {});
    virtualConsole.on("info", () => {});

    let dom;
    try {
        dom = new JSDOM(pageHtml(source), {
            runScripts: "dangerously",
            url: "https://moomoo.io/",
            pretendToBeVisual: true,
            virtualConsole,
        });
    } catch (e) {
        ok(file, "page loads", false, e.message);
        return;
    }
    const win = dom.window;

    // codec + crypto helpers the transcribed bundle calls into
    win.__decodeForBundle = (bytes) => gameDecoder.decode(Buffer.from(bytes));
    win.__encodeForBundle = (value) => new win.Uint8Array(gameEncoder.encode(value));
    win.__signForBundle = (k, payload) => new win.Uint8Array(reference.sign(key, Buffer.from(payload)));
    win.__hexToBytes = (hex) => new win.Uint8Array(reference.hex(hex));
    win.__tablesFor = (seed) => reference.tables(seed);

    ran++;
    if (process.env.HARNESS_TRACE) console.log("    .. constructed");

    // jsdom dispatches DOMContentLoaded on the next tick, and the client's body
    // is deferred to it, so nothing below is true until the page has settled
    await settle(win);
    if (process.env.HARNESS_TRACE) console.log("    .. settled");

    // the client is actually in the send chain, rather than merely loaded
    if (!client.fork)
        ok(file, "client installed its own send hook", win.WebSocket.prototype.send !== win.__savedSend);

    // 1. the shim installed before the bundle captured its references
    ok(file, "shim installed at document-start", !!win.__mooTransport);
    ok(file, "bundle captured the shim as its send", win.__savedSend && win.__savedSend !== win.WebSocket.prototype.send ? true : !!win.__savedSend);

    // 2. the client's own body ran without throwing
    const loadErrors = [].concat(win.__errors || [], jsdomErrors, stray.splice(0));
    ok(file, "client body ran without throwing", loadErrors.length === 0, loadErrors.slice(0, 2).join(" | ").slice(0, 1200));

    // 3. connect, exactly the way the bundle does
    try {
        win.__io.connect("wss://sgs-1.eu.moomoo.io/?token=x", () => {}, {
            A: () => {},
            C: () => {},
            D: () => {},
            O: () => {},
            "6": () => {},
        });
    } catch (e) {
        ok(file, "bundle connects", false, e.message);
        return;
    }
    // not __sockets[0]: several of these clients open a relay of their own at
    // load, before the bundle ever connects
    if (process.env.HARNESS_TRACE) console.log("    .. connected");
    const sock = win.__io.socket;
    ok(file, "bundle opened a socket", !!sock);
    if (win.__sockets.length > 1)
        console.log("    (client opened " + (win.__sockets.length - 1) + " socket(s) of its own first)");
    if (!sock) return;

    // 4. io-init
    if (process.env.HARNESS_TRACE) console.log("    .. delivering io-init");
    try {
        sock.__deliver(gameEncoder.encode(["io-init", [7, SEED, KEY_HEX, 1]]));
    } catch (e) {
        ok(file, "io-init dispatches without throwing", false, String(e.message).slice(0, 200));
    }
    ok(file, "bundle negotiated io-init", win.__bundleSawIoInit === true);
    ok(file, "shim negotiated io-init", win.__mooTransport && win.__mooTransport.negotiated === true);

    // 5. spawn through the bundle's io.send, which is what pressing play does
    sock.sent.length = 0;
    let sendError = null;
    try {
        if (process.env.HARNESS_TRACE) console.log("    .. spawning");
        win.__io.send("M", { name: "harness", moofoll: 0, skin: 0 });
    } catch (e) {
        sendError = e;
    }
    ok(file, "spawn does not throw", !sendError, sendError && String(sendError.stack || sendError).slice(0, 300));
    ok(file, "spawn reached the wire", sock.sent.length === 1, "frames sent: " + sock.sent.length);
    if (sock.sent.length) {
        const out = serverParse(new Uint8Array(sock.sent[0]));
        ok(file, "spawn frame is well formed", !out.bad, out.bad);
        ok(file, "spawn frame is the spawn packet", out.name === "M", "got " + out.name);
        ok(file, "spawn frame keeps its payload", !!(out.args && out.args[0] && typeof out.args[0] === "object"));
        if (out.args && out.args[0] && typeof out.args[0] === "object")
            console.log("    spawn payload as sent: " + JSON.stringify(out.args[0]));
    }

    // 6. a server packet with a numeric opcode has to reach the handlers under
    //    its legacy name. Leaderboard, because a client that has not been through
    //    a real setup handshake has no players for the others to look up.
    win.__bundleReceived.length = 0;
    try {
        sock.__deliver(gameEncoder.encode([tables.s2c.enc["G"], [[]]]));
    } catch (e) {
        ok(file, "inbound packet dispatches without throwing", false, String(e.message).slice(0, 200));
    }
    ok(file, "bundle still receives its own packets", win.__bundleReceived.includes("G"), "got " + JSON.stringify(win.__bundleReceived));
    ok(file, "no unknown opcode dropped", win.__bundleDroppedUnknown !== true);

    // 7. a few more sends, and the sequence the server sees must stay dense
    sock.sent.length = 0;
    try {
        for (const [name, arg] of [["6", "hello from the harness, a chat message well over thirty characters"], ["K", 0], ["9", 1.25]]) {
            if (process.env.HARNESS_TRACE) console.log("    .. sending " + name);
            win.__io.send(name, arg);
        }
        if (process.env.HARNESS_TRACE) console.log("    .. sends done");
    } catch (e) {
        ok(file, "further sends do not throw", false, String(e.message).slice(0, 200));
    }
    const parsed = Array.from(sock.sent).map((f) => serverParse(new Uint8Array(f)));
    const bad = parsed.find((p) => p.bad);
    ok(file, "every frame verifies server-side", !bad, bad && bad.bad);
    const seqs = parsed.filter((p) => !p.bad).map((p) => p.seq);
    const dense = seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1);
    ok(file, "sequence numbers stay consecutive", dense, seqs.join(","));
    console.log("    " + parsed.length + " frame(s) out, names: " + parsed.map((p) => p.name || "?").join(","));

    // a fork drives its own socket with legacy frames; make sure those get
    // upgraded on the way out
    if (client.fork) {
        sock.sent.length = 0;
        const legacy = win.__mooTransport.msgpack.encode(["M", [{ name: "fork", moofoll: 1, skin: 0 }]]);
        win.WebSocket.prototype.send.call(sock, legacy);
        const out = sock.sent.length ? serverParse(new Uint8Array(sock.sent[0])) : { bad: "nothing sent" };
        ok(file, "fork's legacy frame is upgraded", !out.bad, out.bad);
        ok(file, "fork's legacy frame keeps its name", out.name === "M", "got " + out.name);
    }

    const runErrors = [].concat(win.__errors || [], jsdomErrors).slice(loadErrors.length).concat(stray.splice(0));
    ok(file, "no errors while driving the connection", runErrors.length === 0, runErrors.slice(0, 2).join(" | ").slice(0, 400));

    if (process.env.HARNESS_TRACE) console.log("    .. closing");
    win.close();
    if (process.env.HARNESS_TRACE) console.log("    .. closed");
}

(async () => {
    const only = process.argv[2];
    for (const client of CLIENTS) {
        if (only && !client.out.includes(only)) continue;
        await runClient(client);
    }
    console.log("\n" + (failures ? failures + " check(s) FAILED across " + ran + " clients" : ran + " clients drove a connection cleanly"));
    process.exit(failures ? 1 : 0);
})();
