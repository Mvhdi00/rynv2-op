#!/usr/bin/env node
/*
 * clients/original/*.user.js  ->  clients/*.user.js
 *
 * Every client in clients/original was written against the pre-rewrite moomoo
 * protocol and, as shipped, cannot talk to the live game at all. This applies
 * the same four fixes to each of them:
 *
 *   entry      @run-at document-start, so the transport hook is in place before
 *              the game bundle evaluates and captures WebSocket.prototype.send.
 *              The client's own body is deferred to DOMContentLoaded, which is
 *              where it used to run, so nothing else changes about its timing.
 *   packet     src/moo-transport.js is spliced in ahead of the body. It carries
 *              the negotiated opcode tables and the HMAC frame signature, and
 *              presents the old `msgpack([type, args])` shape in both
 *              directions, so the client's packet code is left alone.
 *   requires   rawgit.com shut down in 2019; @require lines pointing at it
 *              silently load nothing, which leaves `msgpack` undefined. Those
 *              are repointed at cdnjs. Clients that never required msgpack at
 *              all get it from the shim.
 *   forks      a client that owns its socket instead of hooking the bundle's is
 *              marked as such, so it keeps getting legacy frames.
 *
 * Anchors are exact strings and must match exactly once; a miss fails the build
 * rather than producing a half-patched script.
 *
 *   node tools/patch-clients.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "clients/original");
const outDir = path.join(root, "clients");
const shim = fs.readFileSync(path.join(root, "src/moo-transport.js"), "utf8").trimEnd();

const DEAD_MSGPACK = "https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js";
const LIVE_MSGPACK = "https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js";

const CLIENTS = [
    { file: "aurora_v5.5.user.js" },
    { file: "chocolate_illusion.user.js", edits: [
        {
            what: "mark the fork's own socket as client-owned",
            // This client is a fork of the old game bundle: it opens the socket
            // itself and reads it with a string-keyed handler table, so it wants
            // legacy frames on the way in as well as out.
            from: "this.socket = new WebSocket(e),",
            to: "this.socket = window.__mooTransport ? window.__mooTransport.legacy(new WebSocket(e)) : new WebSocket(e),",
        },
    ] },
    { file: "porshe_client_v1.user.js" },
    { file: "project_aurora_v2.2.user.js" },
    { file: "project_zelta_reborn.user.js" },
    { file: "robotics_blood_v1.user.js" },
];

function replaceOnce(text, from, to, label, file) {
    const first = text.indexOf(from);
    if (first === -1)
        fail(file, 'anchor not found for "' + label + '": ' + from.slice(0, 60));
    if (text.indexOf(from, first + from.length) !== -1)
        fail(file, 'anchor is ambiguous for "' + label + '": ' + from.slice(0, 60));
    return text.slice(0, first) + to + text.slice(first + from.length);
}

let failed = false;
function fail(file, msg) {
    failed = true;
    throw new Error(file + ": " + msg);
}

function patch(client) {
    const file = client.file;
    let text = fs.readFileSync(path.join(srcDir, file), "utf8");
    const notes = [];

    /* ---- metadata block -------------------------------------------------- */
    const open = text.indexOf("// ==UserScript==");
    const close = text.indexOf("// ==/UserScript==");
    if (open === -1 || close === -1 || close < open)
        fail(file, "no userscript metadata block");
    const closeEnd = text.indexOf("\n", close) + 1;
    let meta = text.slice(open, closeEnd);
    let body = text.slice(closeEnd);
    const preamble = text.slice(0, open);

    // both the @require lines and the <script src> some of them inject at runtime
    const deadCount = text.split(DEAD_MSGPACK).length - 1;
    if (deadCount) {
        meta = meta.split(DEAD_MSGPACK).join(LIVE_MSGPACK);
        body = body.split(DEAD_MSGPACK).join(LIVE_MSGPACK);
        notes.push("repointed " + deadCount + " dead rawgit msgpack URL" + (deadCount > 1 ? "s" : ""));
    }
    if (!/@run-at/.test(meta)) {
        meta = meta.replace("// ==/UserScript==", "// @run-at       document-start\n// ==/UserScript==");
        notes.push("added @run-at document-start");
    } else {
        meta = meta.replace(/\/\/ @run-at\s+\S+/, "// @run-at       document-start");
        notes.push("forced @run-at document-start");
    }

    /* ---- per-client edits, before the body gets wrapped ------------------- */
    for (const edit of client.edits || []) {
        body = replaceOnce(body, edit.from, edit.to, edit.what, file);
        notes.push(edit.what);
    }

    /* ---- shim + deferred body -------------------------------------------- */
    const head = [
        "",
        "/* === transport shim =====================================================",
        " * Generated by tools/patch-clients.js from src/moo-transport.js.",
        " * Runs at document-start, ahead of the game bundle. Do not edit here.",
        " * ==================================================================== */",
        shim,
        "",
        "/* === original client body ===============================================",
        " * Held until the DOM exists, which is where this code ran before the",
        " * script was moved to document-start.",
        " * ==================================================================== */",
        "(function () {",
        "    var __clientMain = function () {",
        "",
    ].join("\n");
    const tail = [
        "",
        "    };",
        '    if (document.readyState === "loading")',
        '        document.addEventListener("DOMContentLoaded", __clientMain, { once: true });',
        "    else",
        "        __clientMain();",
        "})();",
        "",
    ].join("\n");

    const out = preamble + meta + head + body.replace(/\s*$/, "\n") + tail;
    fs.writeFileSync(path.join(outDir, file), out);
    return notes;
}

let count = 0;
for (const client of CLIENTS) {
    const notes = patch(client);
    count++;
    console.log(client.file);
    for (const n of notes)
        console.log("  - " + n);
    console.log("  - spliced transport shim, deferred body to DOMContentLoaded");
}
console.log("\n" + count + " client" + (count === 1 ? "" : "s") + " written to clients/");
process.exit(failed ? 1 : 0);
