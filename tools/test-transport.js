#!/usr/bin/env node
/*
 * Checks src/moo-transport.js against the shipped game bundle.
 *
 *  1. the protocol primitives (SHA-256, truncated HMAC, seeded opcode tables)
 *     are compared against the same functions lifted out of src/game_index.js,
 *  2. the shim's msgpack is round-tripped against the bundle's own codec
 *     (src/game_vendor.js),
 *  3. the whole send/receive path is driven end to end against a fake socket
 *     running the bundle's io.send/onmessage code.
 *
 *   node tools/test-transport.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const indexSrc = fs.readFileSync(path.join(root, "src/game_index.js"), "utf8").split("\n");
const vendorSrc = fs.readFileSync(path.join(root, "src/game_vendor.js"), "utf8");
const shimSrc = fs.readFileSync(path.join(root, "src/moo-transport.js"), "utf8");

let failures = 0;
let checks = 0;
function ok(name, cond, extra) {
    checks++;
    if (cond) return;
    failures++;
    console.error("  FAIL " + name + (extra ? "  (" + extra + ")" : ""));
}
function section(name) {
    console.log("\n" + name);
}

/* ---------------------------------------------------------------- reference */
// lines are 1-based and inclusive, matching the beautified bundle
function lines(from, to) {
    return indexSrc.slice(from - 1, to).join("\n");
}
const constants = lines(278, 282).replace(/^\s*,\s*/, "");
const referenceSrc = [
    "const " + constants,
    lines(283, 318), // Co (rng), Oi (table), Po (tables)
    lines(319, 405), // K table, Vt (sha256), j (rotr), Ao/Eo (hmac), Ro (hex)
    "return { alphabetC2S: bo, alphabetS2C: To, sigBytes: jt, mode: Ht, salt: Io,",
    "         sha256: Vt, hmac: Ao, sign: Eo, tables: Po, shuffle: Oi, hex: Ro };",
].join("\n");
const reference = new Function(referenceSrc)();

// the bundle's msgpack codec: the leading section of the vendor chunk, up to
// and including the Decoder class (the rest of the chunk is unrelated and wants
// a real `window`)
const vendorCodec = vendorSrc.split("\n").slice(0, 1450).join("\n");
const vendor = new Function(vendorCodec + "\nreturn { Encoder: yn, Decoder: kn };")();
const gameEncoder = new vendor.Encoder();
const gameDecoder = new vendor.Decoder();

/* ------------------------------------------------------------------- shim */
// The shim installs onto window/WebSocket, so give it just enough of a DOM.
function makeWindow() {
    const listeners = new WeakMap();
    class FakeWS {
        constructor(url) {
            this.url = url;
            this.readyState = 1;
            this.sent = [];
            this.onmessage = null;
            listeners.set(this, []);
        }
        send(data) {
            this.sent.push(data);
        }
        addEventListener(type, fn) {
            listeners.get(this).push([type, fn]);
        }
        removeEventListener(type, fn) {
            const l = listeners.get(this);
            const i = l.findIndex((e) => e[0] === type && e[1] === fn);
            if (i >= 0) l.splice(i, 1);
        }
        // test helper: deliver a raw server frame
        _deliver(bytes) {
            const ev = { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), type: "message" };
            for (const [type, fn] of listeners.get(this).slice()) if (type === "message") fn.call(this, ev);
            if (this._onmessage) this._onmessage.call(this, ev);
        }
        _close() {
            this.readyState = 3;
            for (const [type, fn] of listeners.get(this).slice()) if (type === "close") fn.call(this, {});
        }
    }
    Object.defineProperty(FakeWS.prototype, "onmessage", {
        configurable: true,
        get() {
            return this._onmessage || null;
        },
        set(fn) {
            this._onmessage = fn;
        },
    });
    const win = {
        WebSocket: FakeWS,
        setInterval: () => 0,
        document: { documentElement: {}, getElementById: () => null },
        MutationObserver: null,
        TextEncoder,
        TextDecoder,
        console,
        location: { hostname: "moomoo.io", href: "https://moomoo.io/" },
        URL,
    };
    win.window = win;
    return win;
}

const win = makeWindow();
vm.createContext(win);
vm.runInContext(shimSrc, win);
const shim = win.__mooTransport;
const I = shim._internals;
ok("shim installed", !!shim);

/* ------------------------------------------------------------ 1. primitives */
section("protocol primitives vs src/game_index.js");

ok("c2s alphabet", JSON.stringify(I.C2S) === JSON.stringify(reference.alphabetC2S));
ok("s2c alphabet", JSON.stringify(I.S2C) === JSON.stringify(reference.alphabetS2C));
ok("signature width", 6 === reference.sigBytes, "bundle says " + reference.sigBytes);
ok("encrypted mode id", 1 === reference.mode, "bundle says " + reference.mode);
ok("table salt", 1 === reference.salt, "bundle says " + reference.salt);

function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}
function randomBytes(n) {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = (Math.random() * 256) | 0;
    return out;
}

let sha256Ok = true;
for (const len of [0, 1, 32, 55, 56, 63, 64, 65, 119, 120, 200, 1000]) {
    const msg = randomBytes(len);
    if (!bytesEqual(I.sha256(msg), reference.sha256(msg))) sha256Ok = false;
}
ok("sha256 matches bundle across block boundaries", sha256Ok);

let hmacOk = true;
for (const keyLen of [16, 32, 64, 65, 100]) {
    const key = randomBytes(keyLen);
    for (const msgLen of [0, 8, 64, 300]) {
        const msg = randomBytes(msgLen);
        if (!bytesEqual(I.hmac(key, msg), reference.hmac(key, msg))) hmacOk = false;
        if (!bytesEqual(I.hmac(key, msg).subarray(0, 6), reference.sign(key, msg))) hmacOk = false;
    }
}
ok("truncated hmac matches bundle", hmacOk);

let tablesOk = true;
let seenDistinct = new Set();
for (let i = 0; i < 500; i++) {
    const seed = (Math.random() * 4294967296) >>> 0;
    const mine = I.buildTables(seed);
    const theirs = reference.tables(seed);
    if (JSON.stringify(mine.c2s) !== JSON.stringify(theirs.c2s)) tablesOk = false;
    if (JSON.stringify(mine.s2c) !== JSON.stringify(theirs.s2c)) tablesOk = false;
    seenDistinct.add(JSON.stringify(mine.c2s.enc));
}
ok("opcode tables match bundle over 500 seeds", tablesOk);
ok("tables actually vary by seed", seenDistinct.size > 100, seenDistinct.size + " distinct");

ok("hex decode matches bundle", bytesEqual(I.hexToBytes("00ff10a9"), reference.hex("00ff10a9")));

/* --------------------------------------------------------------- 2. msgpack */
section("msgpack vs src/game_vendor.js");

const samples = [
    null,
    true,
    false,
    0,
    1,
    127,
    128,
    255,
    256,
    65535,
    65536,
    4294967295,
    4294967296,
    -1,
    -32,
    -33,
    -128,
    -129,
    -32768,
    -32769,
    -2147483648,
    -2147483649,
    1.5,
    -0.25,
    Math.PI,
    "",
    "a",
    "spike",
    "x".repeat(31),
    "x".repeat(32),
    "x".repeat(255),
    "x".repeat(256),
    "x".repeat(70000),
    "ünïcödé ✓ 😀",
    [],
    [1, 2, 3],
    new Array(16).fill(7),
    new Array(70000).fill(1),
    {},
    { name: "cow", moofoll: 1, skin: "__proto__" },
    [12, [{ a: [1, null, true] }, "x"], 9],
    ["M", [{ name: "", moofoll: true, skin: 10 }]],
];

let encodeOk = true;
let decodeOk = true;
for (const s of samples) {
    // our bytes must be readable by the bundle's decoder
    let viaGame;
    try {
        viaGame = gameDecoder.decode(shim.msgpack.encode(s));
    } catch (e) {
        encodeOk = false;
        console.error("    encode->game decode threw for", JSON.stringify(s).slice(0, 40), e.message);
        continue;
    }
    if (JSON.stringify(viaGame) !== JSON.stringify(s)) {
        encodeOk = false;
        console.error("    mismatch encoding", JSON.stringify(s).slice(0, 60));
    }
    // and the bundle's bytes must be readable by us
    let viaShim;
    try {
        viaShim = shim.msgpack.decode(gameEncoder.encode(s));
    } catch (e) {
        decodeOk = false;
        console.error("    game encode->decode threw for", JSON.stringify(s).slice(0, 40), e.message);
        continue;
    }
    if (JSON.stringify(viaShim) !== JSON.stringify(s)) {
        decodeOk = false;
        console.error("    mismatch decoding", JSON.stringify(s).slice(0, 60));
    }
}
ok("bundle decodes everything the shim encodes", encodeOk);
ok("shim decodes everything the bundle encodes", decodeOk);

let strictOk = false;
try {
    shim.msgpack.decode(new Uint8Array([0x01, 0x02]));
} catch (e) {
    strictOk = true;
}
ok("decode rejects trailing bytes", strictOk);

/* ------------------------------------------------------------ 3. end to end */
section("end to end against the bundle's io.send");

const KEY_HEX = "8f1c2d3e4a5b60718293a4b5c6d7e8f9000102030405060708090a0b0c0d0e0f";
const SEED = 0x1234abcd;

// io.send, transcribed from src/game_index.js lines 467-486
function makeGameIo(socket, savedSend) {
    const Z = { mode: 1, key: reference.hex(KEY_HEX), tables: reference.tables(SEED >>> 0), seq: 0 };
    return {
        Z,
        send(type, ...args) {
            const opcode = Z.tables.c2s.enc[type];
            if (opcode === undefined) return;
            const seq = ++Z.seq;
            const payload = gameEncoder.encode([opcode, args, seq]);
            const sig = reference.sign(Z.key, payload);
            const frame = new Uint8Array(reference.sigBytes + payload.length);
            frame.set(sig, 0);
            frame.set(payload, reference.sigBytes);
            savedSend.call(socket, frame);
        },
    };
}

const WS = win.WebSocket;
// The bundle grabs these at module-eval time; the shim has to already be in place.
const savedSend = WS.prototype.send;
const sock = new WS("wss://test.moomoo.io");
sock.binaryType = "arraybuffer";

// io-init, exactly as the server frames it (string type, plain msgpack)
const ioInit = gameEncoder.encode(["io-init", [7, SEED, KEY_HEX, 1]]);

// the client's own message handler, unchanged from how these scripts write it
const received = [];
sock.addEventListener("message", function (msg) {
    const parsed = shim.msgpack.decode(new Uint8Array(msg.data));
    received.push([parsed[0], parsed[1]]);
});

sock._deliver(ioInit);
ok("io-init reaches client listeners as a string type", received.length === 1 && received[0][0] === "io-init");
ok("shim negotiated from io-init", shim.negotiated);

const io = makeGameIo(sock, savedSend);

// what actually went out must verify against the key and carry the right name
function serverParse(frame) {
    const payload = frame.subarray(6);
    const sig = reference.sign(reference.hex(KEY_HEX), payload);
    for (let i = 0; i < 6; i++) if (sig[i] !== frame[i]) return { bad: "signature" };
    const parsed = gameDecoder.decode(payload);
    const name = reference.tables(SEED >>> 0).c2s.dec[parsed[0]];
    return { name, args: parsed[1], seq: parsed[2] };
}

// (a) with no client hook installed the bundle's frames still go out intact
io.send("M", { name: "cow", moofoll: 1, skin: 0 });
ok("unhooked frame reaches the wire", sock.sent.length === 1);
{
    const out = serverParse(sock.sent[0]);
    ok("unhooked frame is signed", !out.bad, out.bad);
    ok("unhooked frame keeps its name", out.name === "M");
    ok("unhooked frame keeps its payload", out.args[0].name === "cow");
    ok("sequence starts at one", out.seq === 1, "seq " + out.seq);
}

// (b) now install the kind of hook these clients install, late, after load
let hookSaw = [];
let dropNext = false;
WS.prototype.nsend = WS.prototype.send;
WS.prototype.send = function (message) {
    const parsed = shim.msgpack.decode(new Uint8Array(message));
    const type = parsed[0];
    const data = parsed[1];
    hookSaw.push([type, data]);
    if (dropNext) {
        dropNext = false;
        return;
    }
    if (type === "6") data[0] = String(data[0]).slice(0, 30);
    this.nsend(shim.msgpack.encode([type, data]));
};

sock.sent.length = 0;
io.send("D", 1.25);
ok("client hook sees the bundle's packet as [name, args]", hookSaw.length === 1 && hookSaw[0][0] === "D" && hookSaw[0][1][0] === 1.25);
ok("hooked packet still reaches the wire", sock.sent.length === 1);

{
    const out = serverParse(sock.sent[0]);
    ok("server-side signature verifies", !out.bad, out.bad);
    ok("server-side opcode maps back to the name", out.name === "D");
    ok("server-side args survive", out.args[0] === 1.25);
}

// (c) client-originated packets, i.e. packet("6", "...") -> WS.send(msgpack)
sock.sent.length = 0;
hookSaw.length = 0;
sock.send(shim.msgpack.encode(["6", ["hello there this is a very long chat message that gets clipped"]]));
ok("client packet passes through its own hook", hookSaw.length === 1 && hookSaw[0][0] === "6");
{
    const out = serverParse(sock.sent[0]);
    ok("client packet is signed", !out.bad, out.bad);
    ok("client packet keeps its name", out.name === "6");
    ok("client packet edit applied", out.args[0].length === 30);
}

// (d) sequence numbers stay dense even when the hook drops a packet
sock.sent.length = 0;
const seqs = [];
dropNext = true;
io.send("K", 0); // dropped by the hook
io.send("K", 1);
io.send("K", 0);
for (const frame of sock.sent) seqs.push(serverParse(frame).seq);
ok("dropped packet does not reach the wire", sock.sent.length === 2);
ok("sequence numbers stay consecutive", seqs[1] === seqs[0] + 1, seqs.join(","));

// (e) numeric server packets are handed to client listeners under their names
received.length = 0;
{
    const tables = reference.tables(SEED >>> 0);
    const opcode = tables.s2c.enc["O"]; // updateHealth
    sock._deliver(gameEncoder.encode([opcode, [12, 84]]));
}
ok("numeric s2c opcode arrives as its legacy name", received.length === 1 && received[0][0] === "O", JSON.stringify(received[0]));
ok("numeric s2c args survive", received.length === 1 && received[0][1][1] === 84);

// (f) a second socket is client-owned: it speaks legacy and gets legacy back
const bot = new WS("wss://test.moomoo.io");
bot.sent.length = 0;
const botSeen = [];
bot.onmessage = function (msg) {
    const parsed = shim.msgpack.decode(new Uint8Array(msg.data));
    botSeen.push(parsed[0]);
};
bot._deliver(gameEncoder.encode(["io-init", [9, SEED, KEY_HEX, 1]]));
bot.send(shim.msgpack.encode(["M", [{ name: "bot", moofoll: 1, skin: "__proto__" }]]));
ok("bot socket frame is upgraded", bot.sent.length === 1 && !serverParse(bot.sent[0]).bad);
ok("bot socket frame keeps its name", serverParse(bot.sent[0]).name === "M");
{
    const tables = reference.tables(SEED >>> 0);
    bot._deliver(gameEncoder.encode([tables.s2c.enc["C"], [[]]]));
}
ok("bot onmessage is translated to legacy names", botSeen.join(",") === "io-init,C", botSeen.join(","));

// (g) a server that does not negotiate the new transport keeps plain framing
const plain = new WS("wss://private.example");
plain._deliver(gameEncoder.encode(["io-init", [3]]));
plain.sent.length = 0;
plain.send(shim.msgpack.encode(["6", ["hi"]]));
ok("mode-0 server keeps legacy framing", plain.sent.length === 1 && JSON.stringify(gameDecoder.decode(plain.sent[0])) === JSON.stringify(["6", ["hi"]]));

// (h) the three-layer chain porshe/zelta build: shim -> client hook -> a
//     packet-renaming Proxy the client installs underneath it -> shim
const renamed = [];
{
    const RENAME = { d: "F", G: "z", a: "9" };
    // start from a clean prototype, the way a fresh page would
    WS.prototype.send = savedSend;
    delete WS.prototype.nsend;
    const under = WS.prototype.send; // what the rename layer captures
    WS.prototype.send = new Proxy(under, {
        apply: (target, self, args) => {
            const parsed = shim.msgpack.decode(new Uint8Array(args[0]));
            if (RENAME[parsed[0]]) parsed[0] = RENAME[parsed[0]];
            renamed.push(parsed[0]);
            return target.apply(self, [shim.msgpack.encode(parsed)]);
        },
    });
    const clientHook = WS.prototype.send;
    WS.prototype.nsend = clientHook;
    WS.prototype.send = function (message) {
        this.nsend(message);
    };

    sock.sent.length = 0;
    sock.send(shim.msgpack.encode(["d", [1, 0.5]]));
    const out = serverParse(sock.sent[0]);
    ok("rename layer runs between the hook and the wire", renamed.join(",") === "F");
    ok("renamed packet is signed", !out.bad, out.bad);
    ok("renamed packet uses the renamed opcode", out.name === "F", out.name);
}

// (j) a relay the client opens before the game connects must not take the game
//     socket's place, or the bundle would start getting rewritten packets
{
    sock._close();
    const relay = new WS("wss://beautiful-sapphire-toad.glitch.me");
    ok("relay does not become the game socket", shim.socket !== relay);
    ok("relay is treated as client-owned", I.stateFor(relay).owner === "mod");
    const reconnect = new WS("wss://sgs-1.eu.moomoo.io");
    ok("a game reconnect takes the game socket back", shim.socket === reconnect);
    ok("the reconnected socket is game-owned", I.stateFor(reconnect).owner === "game");
}

// (i) a client that has no working msgpack of its own gets one
ok("window.msgpack is provided when missing", typeof win.msgpack === "object" && typeof win.msgpack.decode === "function");

/* ------------------------------------------------------------------ report */
console.log("\n" + (failures ? failures + " of " + checks + " checks FAILED" : checks + " checks passed"));
process.exit(failures ? 1 : 0);
