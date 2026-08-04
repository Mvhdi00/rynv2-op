#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const {extractGameTransport, loadGameCodec} = require("./game-transport");

const ROOT = path.join(__dirname, "..");
const DRIVERS = path.join(ROOT, "drivers", "game-drivers.json");

const target = process.argv[2] || path.join(ROOT, "Ae86_Fixed.user.js");

let failures = 0;

function ok(label) {
    console.log("  ok    " + label);
}

function bad(label, detail) {
    failures += 1;
    console.log("  FAIL  " + label + (detail ? " — " + detail : ""));
}

function check(label, condition, detail) {
    if (condition) {
        ok(label);
    } else {
        bad(label, detail);
    }
}

function section(name) {
    console.log("\n" + name);
}

function loadBootstrap(built) {
    const cut = built.indexOf("\nfunction __ae86Bundle() {");
    if (cut === -1) {
        throw new Error("built script has no __ae86Bundle wrapper");
    }
    const prelude = built.slice(0, cut);

    const nullElement = {
        style: {},
        offsetParent: {},
        appendChild: function() {},
        setAttribute: function() {},
        removeAttribute: function() {},
        getAttribute: function() {
            return null;
        }
    };
    const documentStub = {
        readyState: "complete",
        documentElement: nullElement,
        head: nullElement,
        body: nullElement,
        addEventListener: function() {},
        createElement: function() {
            return Object.create(nullElement);
        },
        querySelector: function() {
            return null;
        },
        getElementById: function() {
            return null;
        }
    };
    const windowStub = {
        addEventListener: function() {}
    };

    class FakeWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        send() {}
        addEventListener() {}
    }

    class FakeXHR {
        open() {}
        send() {}
        abort() {}
        setRequestHeader() {}
        getAllResponseHeaders() {
            return "";
        }
        getResponseHeader() {
            return null;
        }
        overrideMimeType() {}
        addEventListener() {}
        removeEventListener() {}
    }

    const sandbox = {
        window: windowStub,
        document: documentStub,
        EventTarget: class {
            addEventListener() {}
        },
        console: {
            log: function() {},
            warn: function() {},
            error: function() {}
        },
        WebSocket: FakeWebSocket,
        XMLHttpRequest: FakeXHR,
        MutationObserver: class {
            observe() {}
            disconnect() {}
        },
        fetch: function() {
            return Promise.resolve({
                json: function() {
                    return Promise.resolve([]);
                }
            });
        },
        Promise: Promise,
        URL: URL,
        URLSearchParams: URLSearchParams,
        TextEncoder: TextEncoder,
        TextDecoder: TextDecoder,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Math: Math,
        JSON: JSON,
        Date: Date,
        Object: Object,
        Array: Array,
        Number: Number,
        String: String,
        Error: Error,
        Uint8Array: Uint8Array,
        Uint32Array: Uint32Array,
        ArrayBuffer: ArrayBuffer,
        DataView: DataView,
        WeakMap: WeakMap,
        parseInt: parseInt
    };
    windowStub.location = {
        hostname: "moomoo.io",
        href: "https://moomoo.io/",
        search: "",
        protocol: "https:"
    };
    windowStub.WebSocket = FakeWebSocket;
    windowStub.XMLHttpRequest = FakeXHR;
    sandbox.location = windowStub.location;
    sandbox.unsafeWindow = undefined;
    vm.createContext(sandbox);
    vm.runInContext(prelude, sandbox);
    if (!windowStub.Ae86Net) {
        throw new Error("bootstrap did not expose Ae86Net");
    }
    return {
        net: windowStub.Ae86Net,
        window: windowStub
    };
}

function bytesEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function normalize(value) {
    if (value instanceof Uint8Array) {
        return Array.from(value);
    }
    if (Array.isArray(value)) {
        return value.map(normalize);
    }
    if (value && typeof value === "object") {
        const out = {};
        for (const key of Object.keys(value).sort()) {
            out[key] = normalize(value[key]);
        }
        return out;
    }
    return value;
}

function sameValue(a, b) {
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

const CORPUS = [
    ["M", [{
        name: "cow",
        moofoll: 1,
        skin: 0
    }], 1],
    ["D", [1.5707963267948966], 2],
    ["9", [null], 3],
    ["F", [1, null], 4],
    ["F", [0, -3.141592653589793], 5],
    ["c", [1, 51, 0], 6],
    ["6", ["hello world"], 7],
    ["z", [15, 1], 8],
    ["e", [], 9],
    ["0", [], 4294967295],
    ["S", [1], 128],
    ["P", [1234, 1], 65535],
    [0, [[1, 2, 3, 4, 5, 6, 7, 8]], 65536],
    [35, [-1, -32, -33, -129, -32769, -2147483649], 12],
    [17, ["ünïcödé ✓ 𝄞", "", "x".repeat(300)], 13],
    [7, [new Uint8Array([0, 1, 2, 253, 254, 255])], 14],
    [12, [true, false, null, 0.1, 1e300, -1e300], 15],
    [3, [Array.from({
        length: 40
    }, (unused, i) => i * 7)], 16]
];

async function main() {
    console.log("verify-ae86: " + path.relative(ROOT, target));

    if (!fs.existsSync(target)) {
        bad("built script exists", target);
        process.exit(1);
    }
    const built = fs.readFileSync(target, "utf8");

    section("Structure");
    check("userscript metadata block", built.startsWith("// ==UserScript==") && built.includes("\n// ==/UserScript=="));
    check("runs at document-start", /@run-at\s+document-start/.test(built));
    check("bundle is wrapped and booted", built.includes("\nfunction __ae86Bundle() {") && built.includes("\n__ae86Boot(__ae86Bundle);"));
    check("original metadata block removed from the bundle", built.indexOf("// ==/UserScript==") === built.lastIndexOf("// ==/UserScript=="));
    check("legacy io-client module still present", built.includes("'./src/js/libs/io-client.js':function("));

    const {net: net} = loadBootstrap(built);
    const drivers = JSON.parse(fs.readFileSync(DRIVERS, "utf8"));
    const game = extractGameTransport();

    section("Protocol constants vs drivers/game-drivers.json");
    check("frame signature width", net.signatureBytes === drivers.protocol.signatureBytes, net.signatureBytes + " vs " + drivers.protocol.signatureBytes);
    check("transport mode", net.encryptedMode === drivers.protocol.encryptedMode);
    check("opcode table salt", net.tableSalt === drivers.protocol.tableSalt);
    check("c2s alphabet", sameValue(net.c2sAlphabet, drivers.protocol.c2sAlphabet));
    check("s2c alphabet", sameValue(net.s2cAlphabet, drivers.protocol.s2cAlphabet));

    section("Protocol constants vs src/game_index.js");
    check("frame signature width matches the bundle", net.signatureBytes === game.jt);
    check("transport mode matches the bundle", net.encryptedMode === game.Ht);
    check("table salt matches the bundle", net.tableSalt === game.Io);
    check("c2s alphabet matches the bundle", sameValue(net.c2sAlphabet, game.bo));
    check("s2c alphabet matches the bundle", sameValue(net.s2cAlphabet, game.To));

    section("Opcode translation");
    const legacyC2S = Object.keys(net.c2sFromLegacy);
    const mappedC2S = legacyC2S.map(k => net.c2sFromLegacy[k]);
    check("c2s map covers every current opcode", new Set(mappedC2S).size === game.bo.length && game.bo.every(letter => mappedC2S.includes(letter)), mappedC2S.length + " entries");
    check("c2s map is one-to-one", new Set(mappedC2S).size === mappedC2S.length);
    const s2cKeys = Object.keys(net.s2cToLegacy);
    const mappedS2C = s2cKeys.map(k => net.s2cToLegacy[k]);
    check("s2c map covers every current opcode", s2cKeys.length === game.To.length && game.To.every(letter => Object.prototype.hasOwnProperty.call(net.s2cToLegacy, letter)), s2cKeys.length + " entries");
    check("s2c map is one-to-one", new Set(mappedS2C).size === mappedS2C.length);
    check("legacy names are disjoint from each other", new Set(legacyC2S).size === legacyC2S.length);

    section("Opcode table generation vs src/game_index.js");
    let tablesMatch = true;
    let tableDetail = "";
    const seeds = [0, 1, 7, 12345, 2654435761, 4294967295, 1013904223, 987654321, 42, 999999937];
    for (const seed of seeds) {
        const mine = net.buildTables(seed >>> 0);
        const theirs = game.Po(seed >>> 0);
        if (!sameValue(mine.c2s.enc, theirs.c2s.enc) || !sameValue(mine.c2s.dec, theirs.c2s.dec) || !sameValue(mine.s2c.enc, theirs.s2c.enc) || !sameValue(mine.s2c.dec, theirs.s2c.dec)) {
            tablesMatch = false;
            tableDetail = "seed " + seed;
            break;
        }
    }
    check("permuted tables match for " + seeds.length + " seeds", tablesMatch, tableDetail);

    section("Frame signature vs src/game_index.js");
    let signaturesMatch = true;
    let signatureDetail = "";
    const key = game.Ro("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");
    const longKey = game.Ro("ff".repeat(80));
    for (const [keyBytes, keyLabel] of [[key, "32-byte key"], [longKey, "80-byte key"]]) {
        for (let length = 0; length < 200; length += 7) {
            const message = new Uint8Array(length);
            for (let i = 0; i < length; i++) {
                message[i] = i * 31 % 256;
            }
            const mine = net.frameSignature(keyBytes, message);
            const theirs = game.Eo(keyBytes, message);
            if (mine.length !== game.jt || !bytesEqual(mine, theirs)) {
                signaturesMatch = false;
                signatureDetail = keyLabel + ", message length " + length;
                break;
            }
        }
    }
    check("truncated hmac matches for keys and payload lengths 0..196", signaturesMatch, signatureDetail);

    section("msgpack codec vs src/game_vendor.js");
    const codec = await loadGameCodec();
    let encodeMatches = true;
    let decodeMatches = true;
    let roundTrips = true;
    let codecDetail = "";
    for (const sample of CORPUS) {
        const mine = net.encode(sample);
        const theirs = codec.encoder.encode(sample);
        if (!bytesEqual(mine, theirs)) {
            encodeMatches = false;
            codecDetail = JSON.stringify(normalize(sample)).slice(0, 60);
            break;
        }
        if (!sameValue(net.decode(theirs), sample)) {
            decodeMatches = false;
            codecDetail = JSON.stringify(normalize(sample)).slice(0, 60);
            break;
        }
        if (!sameValue(codec.decoder.decode(mine), sample)) {
            roundTrips = false;
            codecDetail = JSON.stringify(normalize(sample)).slice(0, 60);
            break;
        }
    }
    check("our encoder produces the bundle's bytes", encodeMatches, codecDetail);
    check("our decoder reads the bundle's bytes", decodeMatches, codecDetail);
    check("the bundle's decoder reads our bytes", roundTrips, codecDetail);

    section("End-to-end frame");
    const tables = net.buildTables(0x1234abcd);
    const seq = 1;
    const opcode = tables.c2s.enc["M"];
    const body = net.encode([opcode, [{
        name: "cow",
        moofoll: 1,
        skin: 0
    }], seq]);
    const frame = new Uint8Array(net.signatureBytes + body.length);
    frame.set(net.frameSignature(key, body), 0);
    frame.set(body, net.signatureBytes);
    check("frame is signature + payload", frame.length === net.signatureBytes + body.length);
    check("signature verifies against the bundle's hmac", bytesEqual(frame.subarray(0, net.signatureBytes), game.Eo(key, body)));
    check("payload decodes as [opcode, args, seq]", sameValue(codec.decoder.decode(body), [opcode, [{
        name: "cow",
        moofoll: 1,
        skin: 0
    }], seq]));
    check("opcode round-trips through the s2c table", tables.s2c.dec[tables.s2c.enc["A"]] === "A");

    console.log("");
    if (failures > 0) {
        console.log("verify-ae86: " + failures + " check(s) failed");
        process.exit(1);
    }
    console.log("verify-ae86: all checks passed");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
