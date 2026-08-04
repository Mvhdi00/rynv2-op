"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const GAME_INDEX = path.join(ROOT, "src", "game_index.js");
const GAME_VENDOR = path.join(ROOT, "src", "game_vendor.js");

function extractFunction(source, name) {
    const marker = "\nfunction " + name + "(";
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error("cannot find function " + name + " in the game bundle");
    }
    const from = start + 1;
    let i = source.indexOf("{", from);
    let depth = 0;
    let quote = null;
    while (i < source.length) {
        const ch = source[i];
        if (quote !== null) {
            if (ch === "\\") {
                i += 2;
                continue;
            }
            if (ch === quote) {
                quote = null;
            }
            i += 1;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
            quote = ch;
            i += 1;
            continue;
        }
        if (ch === "/" && source[i + 1] === "/") {
            i = source.indexOf("\n", i);
            if (i === -1) {
                break;
            }
            continue;
        }
        if (ch === "{") {
            depth += 1;
        } else if (ch === "}") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(from, i + 1);
            }
        }
        i += 1;
    }
    throw new Error("unbalanced braces while extracting " + name);
}

function extractGameTransport() {
    const source = fs.readFileSync(GAME_INDEX, "utf8");

    const constants = source.match(/,\s*Io = (\d+)\s*,\s*jt = (\d+)\s*,\s*Ht = (\d+)\s*,\s*bo = (\[[^\]]*\])\s*,\s*To = (\[[^\]]*\]);/);
    if (!constants) {
        throw new Error("cannot find the protocol constants in the game bundle");
    }
    const roundConstants = source.match(/const Do = new Uint32Array\(\[[^\]]*\]\);/);
    if (!roundConstants) {
        throw new Error("cannot find the sha-256 round constants in the game bundle");
    }
    const blockSize = source.match(/const he = (\d+);/);
    if (!blockSize) {
        throw new Error("cannot find the hmac block size in the game bundle");
    }

    const pieces = [
        "const Io = " + constants[1] + ", jt = " + constants[2] + ", Ht = " + constants[3] + ";",
        "const bo = " + constants[4] + ", To = " + constants[5] + ";",
        roundConstants[0],
        "const he = " + blockSize[1] + ";",
        extractFunction(source, "j"),
        extractFunction(source, "Vt"),
        extractFunction(source, "Ao"),
        extractFunction(source, "Eo"),
        extractFunction(source, "Ro"),
        extractFunction(source, "Co"),
        extractFunction(source, "Oi"),
        extractFunction(source, "Po"),
        "module.exports = { Io, jt, Ht, bo, To, Vt, Ao, Eo, Ro, Co, Oi, Po };"
    ];

    const sandbox = {
        module: {
            exports: {}
        },
        Math: Math,
        Uint8Array: Uint8Array,
        Uint32Array: Uint32Array,
        DataView: DataView,
        parseInt: parseInt
    };
    vm.createContext(sandbox);
    vm.runInContext(pieces.join("\n"), sandbox);
    return sandbox.module.exports;
}

async function loadGameCodec() {
    const noop = function() {};
    const element = {
        style: {},
        addEventListener: noop,
        removeEventListener: noop,
        appendChild: noop,
        setAttribute: noop,
        getContext: function() {
            return null;
        }
    };
    globalThis.window = globalThis.window || globalThis;
    globalThis.self = globalThis.self || globalThis;
    if (!globalThis.navigator) {
        Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: {
                userAgent: "node",
                maxTouchPoints: 0
            }
        });
    }
    globalThis.document = globalThis.document || {
        readyState: "complete",
        documentElement: element,
        body: element,
        head: element,
        addEventListener: noop,
        removeEventListener: noop,
        createElement: function() {
            return Object.create(element);
        },
        getElementById: function() {
            return null;
        },
        querySelectorAll: function() {
            return [];
        }
    };
    const vendor = await import("file://" + GAME_VENDOR);
    return {
        encoder: new vendor.E(),
        decoder: new vendor.D()
    };
}

module.exports = {
    ROOT: ROOT,
    GAME_INDEX: GAME_INDEX,
    GAME_VENDOR: GAME_VENDOR,
    extractFunction: extractFunction,
    extractGameTransport: extractGameTransport,
    loadGameCodec: loadGameCodec
};
