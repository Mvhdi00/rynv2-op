#!/usr/bin/env node
"use strict";

// Differential smoke test for the deobfuscated client.
//
// A deobfuscator can produce a file that parses cleanly and is still dead —
// deleting the string array while something still calls it leaves a
// ReferenceError on the first line executed, and `node --check` says nothing
// about it. So both files are executed against the same minimal browser stub
// and the outcomes compared: whatever the original does, the rewrite must do.
//
// The stub is deliberately thin. Neither file gets far into the real client, so
// both should fail at the same missing browser global — the point is that they
// fail at the *same* one, and not on a name the rewrite deleted.
//
// Run: node tools/test-deobfuscated.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const ORIGINAL = path.join(ROOT, "src", "Ryn_V5_obfuscated.user.js");
const REWRITTEN = path.join(ROOT, "! Ryn client v5.user.js");

function run(file) {
  const noop = () => {};
  const element = () => ({
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, contains: () => false },
    setAttribute: noop,
    appendChild: noop,
    addEventListener: noop,
    remove: noop,
    querySelector: () => null,
    querySelectorAll: () => []
  });
  const sandbox = {
    console: { log: noop, warn: noop, error: noop, info: noop },
    setTimeout: noop, setInterval: noop, clearTimeout: noop, clearInterval: noop,
    requestAnimationFrame: noop,
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    TypeError, RangeError, Map, Set, WeakMap, WeakSet, Symbol, Promise, Proxy, Reflect,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    Uint8Array, Uint32Array, Int32Array, Float32Array, DataView, ArrayBuffer,
    performance: { now: () => 0 },
    navigator: { userAgent: "node", hardwareConcurrency: 4 },
    location: { href: "https://moomoo.io/", hostname: "moomoo.io", search: "" },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
    document: Object.assign(element(), { head: null, body: null, title: "", cookie: "" }),
    MutationObserver: function () { this.observe = noop; this.disconnect = noop; },
    WebSocket: function () {},
    URL: { createObjectURL: () => "blob:", revokeObjectURL: noop },
    Worker: function () { this.postMessage = noop; this.terminate = noop; },
    Blob: function () {},
    Image: function () {},
    // Present so neither file bails early on it: the original used to stop here
    // while the rewrite ran on, which showed up as a difference between them
    // that was really just a difference in how far each got.
    Event: function () {},
    CustomEvent: function () {},
    EventTarget: function () {},
    XMLHttpRequest: function () { this.open = noop; this.send = noop; },
    HTMLElement: function () {},
    CanvasRenderingContext2D: function () {},
    atob: s => Buffer.from(s, "base64").toString("binary"),
    btoa: s => Buffer.from(s, "binary").toString("base64")
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  try {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: path.basename(file), timeout: 20000 });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e.constructor.name + ": " + String(e.message) };
  }
}

let failures = 0;
function check(name, condition, detail) {
  if (condition) console.log("  ok   " + name);
  else {
    failures += 1;
    console.log("  FAIL " + name + (detail === undefined ? "" : " — " + detail));
  }
}

console.log("deobfuscated client vs. the original\n");

const before = run(ORIGINAL);
const after = run(REWRITTEN);

console.log("  original   : " + (before.ok ? "ran to completion" : before.error));
console.log("  rewritten  : " + (after.ok ? "ran to completion" : after.error));
console.log("");

check("both reach the same outcome", before.ok === after.ok && before.error === after.error,
  "original stopped at " + JSON.stringify(before.error) + ", rewrite at " + JSON.stringify(after.error));

// The specific failure the rewrite can introduce: deleting the string array or
// the decoder while something still reaches for them.
const dead = /_0x1e47|_0x1fc0\b/.test(after.error || "");
check("the rewrite does not reference deleted machinery", !dead, after.error);

console.log("\n" + (failures === 0 ? "all checks passed" : failures + " check(s) failed"));
process.exit(failures === 0 ? 0 : 1);
