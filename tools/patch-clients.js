#!/usr/bin/env node
/*
 * clients/original/*.user.js  ->  clients/<name>_<version>.js
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
 * The spliced-in code is stripped of its comments on the way out: the shipped
 * client carries no commentary that was not in the original script. The
 * documented version lives in src/moo-transport.js.
 *
 * Anchors are exact strings and must match exactly once; a miss fails the build
 * rather than producing a half-patched script.
 *
 *   node tools/patch-clients.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { stripComments } = require("./strip-comments");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "clients/original");
const outDir = path.join(root, "clients");

const DEAD_MSGPACK = "https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js";
const LIVE_MSGPACK = "https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js";
const JQUERY = "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js";
// `$(...)`, but not `.$(`, `"$("`, or `$` inside a template placeholder
const USES_JQUERY = /(^|[^A-Za-z0-9_$."'`])\$\(/;

// output names carry each script's own @version instead of the .user suffix
const CLIENTS = [
    { file: "aurora_v5.5.user.js", out: "aurora_v5.5.js" },
    {
        file: "chocolate_illusion.user.js",
        out: "chocolate_illusion_2023-12-07.js",
        // a fork of the old bundle: it opens and reads the socket itself rather
        // than hooking WebSocket.prototype.send the way the others do
        fork: true,
        edits: [
            {
                what: "mark the fork's own socket as client-owned",
                // This client is a fork of the old game bundle: it opens the
                // socket itself and reads it with a string-keyed handler table,
                // so it wants legacy frames on the way in as well as out.
                from: "this.socket = new WebSocket(e),",
                to: "this.socket = window.__mooTransport ? window.__mooTransport.legacy(new WebSocket(e)) : new WebSocket(e),",
            },
        ],
    },
    { file: "porshe_client_v1.user.js", out: "porshe_client_v1.js" },
    {
        file: "project_aurora_v2.2.user.js",
        out: "project_aurora_v2.2.js",
        // Three full-screen overlays sat in front of this client, none of which
        // did anything: a splash you had to press Enter to clear, a nickname box
        // that only echoed the name back, and an obfuscated password gate whose
        // answer was hardcoded in the same file. Nothing downstream reads any of
        // them, so all three come out whole.
        absent: ["showPasswordPrompt", "showNicknamePrompt", "_0x4934", "_0x49fa", "keyHandler"],
        edits: [
            {
                what: "removed the press-Enter splash overlay",
                cut: ['(function () {\n    // create audio', '    document.addEventListener("keydown", keyHandler);\n})();'],
            },
            {
                what: "removed the nickname prompt",
                cut: ["function showNicknamePrompt() {", "setTimeout(showNicknamePrompt, 1200);"],
            },
            {
                what: "removed the password gate and its check",
                cut: ["(function(_0x352b46,_0xf87036){", "setTimeout(showPasswordPrompt,0x4b0);"],
            },
            {
                // toggleDay_NightMode() writes to a `nightMode` that is declared
                // nowhere in the script, and window.toggleNight() calls it during
                // load, so the ReferenceError took out everything defined after
                // it. There is no such element and no night1/night2 keyframes
                // either, so this only has to be somewhere for the writes to land.
                what: "declared the undeclared nightMode the night toggle writes to",
                from: "        let nightState = 1;\n        let nightStateTime = Date.now();",
                to: '        let nightState = 1;\n        let nightStateTime = Date.now();\n        let nightMode = document.getElementById("nightMode") || document.createElement("div");',
            },
        ],
    },
    { file: "project_zelta_reborn.user.js", out: "project_zelta_reborn_v0.1.js" },
    { file: "robotics_blood_v1.user.js", out: "robotics_blood_v1.0.js" },
];

function fail(file, msg) {
    throw new Error(file + ": " + msg);
}

/** locates an anchor, matching it against either line ending */
function findAnchor(text, anchor, from) {
    let at = text.indexOf(anchor, from);
    let used = anchor;
    if (at === -1 && anchor.includes("\n")) {
        used = anchor.split("\n").join("\r\n");
        at = text.indexOf(used, from);
    }
    return { at, length: used.length };
}

function replaceOnce(text, from, to, label, file) {
    const first = findAnchor(text, from, 0);
    if (first.at === -1) fail(file, 'anchor not found for "' + label + '": ' + from.slice(0, 60));
    if (findAnchor(text, from, first.at + first.length).at !== -1)
        fail(file, 'anchor is ambiguous for "' + label + '": ' + from.slice(0, 60));
    return text.slice(0, first.at) + to + text.slice(first.at + first.length);
}

/** deletes everything from the start anchor through the end anchor, inclusive */
function cutOnce(text, from, to, label, file) {
    const start = findAnchor(text, from, 0);
    if (start.at === -1) fail(file, 'cut start not found for "' + label + '": ' + from.slice(0, 60));
    if (findAnchor(text, from, start.at + start.length).at !== -1)
        fail(file, 'cut start is ambiguous for "' + label + '": ' + from.slice(0, 60));
    const end = findAnchor(text, to, start.at + start.length);
    if (end.at === -1) fail(file, 'cut end not found for "' + label + '": ' + to.slice(0, 60));
    if (findAnchor(text, to, end.at + end.length).at !== -1)
        fail(file, 'cut end is ambiguous for "' + label + '": ' + to.slice(0, 60));
    const head = text.slice(0, start.at).replace(/[ \t]*$/, "");
    const tail = text.slice(end.at + end.length).replace(/^[ \t]*(\r?\n)+/, "$1");
    return head + tail;
}

function applyEdits(body, client, file) {
    for (const edit of client.edits || []) {
        body = edit.cut
            ? cutOnce(body, edit.cut[0], edit.cut[1], edit.what, file)
            : replaceOnce(body, edit.from, edit.to, edit.what, file);
    }
    return body;
}

/**
 * Splits a script into preamble / metadata block / body.
 *
 * The block ends at `// ==/UserScript==`, but one of these scripts never writes
 * that line where it belongs and lets thirteen lines of real code sit inside its
 * header instead. Ending the header at the first line of code keeps that code in
 * the body, where it gets deferred with everything else, instead of stranding it
 * ahead of the shim at document-start.
 */
function splitMetadata(text, file) {
    const lines = text.split("\n");
    const open = lines.findIndex((l) => l.trim() === "// ==UserScript==");
    if (open === -1) fail(file, "no userscript metadata block");

    let end = -1;
    let closed = false;
    let lastComment = open;
    for (let i = open + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "// ==/UserScript==") {
            end = i;
            closed = true;
            break;
        }
        if (line.startsWith("//")) {
            lastComment = i;
            continue;
        }
        if (line === "") continue;
        end = lastComment;
        break;
    }
    if (end === -1) fail(file, "metadata block never ends");

    const meta = lines.slice(open, end + 1).join("\n") + "\n";
    if (!/^\/\/\s*@\w/m.test(meta)) fail(file, "metadata block has no directives");
    return {
        preamble: lines.slice(0, open).join("\n") + (open ? "\n" : ""),
        meta: closed ? meta : meta + "// ==/UserScript==\n",
        body: lines.slice(end + 1).join("\n"),
        closed,
    };
}

/**
 * The old bundle published its data tables on `window`; the current one is a
 * module and publishes nothing. Clients that carry their own tables are
 * unaffected, but the ones that read `window.config` off the page find undefined
 * and die on the first property they touch. This hands them the real thing,
 * extracted from the shipped bundle into drivers/game-drivers.json, and only
 * when the page has not already provided it.
 */
function gameGlobals() {
    const drivers = JSON.parse(fs.readFileSync(path.join(root, "drivers/game-drivers.json"), "utf8"));
    return [
        "(function () {",
        '    if (typeof window === "undefined" || window.config)',
        "        return;",
        "    window.config = " + JSON.stringify(drivers.config, null, 4).split("\n").join("\n    ") + ";",
        "})();",
    ].join("\n");
}

/** the shim plus the boot wrapper, with every comment of ours removed */
function injected() {
    const shim = fs.readFileSync(path.join(root, "src/moo-transport.js"), "utf8");
    return stripComments(shim).trim() + "\n\n" + gameGlobals();
}

function build(client) {
    const file = client.file;
    const text = fs.readFileSync(path.join(srcDir, file), "utf8");
    const notes = [];

    const { preamble, meta: metaSrc, body: bodySrc, closed } = splitMetadata(text, file);
    let meta = metaSrc;
    let body = bodySrc;
    if (!closed) notes.push("closed the metadata block the original left open around its code");

    // both the @require lines and the <script src> some of them inject at runtime
    const deadCount = text.split(DEAD_MSGPACK).length - 1;
    if (deadCount) {
        meta = meta.split(DEAD_MSGPACK).join(LIVE_MSGPACK);
        body = body.split(DEAD_MSGPACK).join(LIVE_MSGPACK);
        notes.push("repointed " + deadCount + " dead rawgit msgpack URL" + (deadCount > 1 ? "s" : ""));
    }
    // The old moomoo page shipped jQuery, so several of these use `$` without
    // ever declaring it. The current page does not, and the first `$(...)` at
    // top level takes the whole client down with it.
    if (USES_JQUERY.test(body) && !/@require[^\n]*jquery/i.test(meta)) {
        meta = meta.replace("// ==/UserScript==", "// @require      " + JQUERY + "\n// ==/UserScript==");
        notes.push("added the jQuery @require the script assumed the page provided");
    }
    if (!/@run-at/.test(meta)) {
        meta = meta.replace("// ==/UserScript==", "// @run-at       document-start\n// ==/UserScript==");
        notes.push("added @run-at document-start");
    } else {
        meta = meta.replace(/\/\/ @run-at\s+\S+/, "// @run-at       document-start");
        notes.push("forced @run-at document-start");
    }

    body = applyEdits(body, client, file);
    for (const edit of client.edits || []) notes.push(edit.what);

    const head = "\n" + injected() + "\n\n(function () {\n    var __clientMain = function () {\n\n";
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

    notes.push("spliced transport shim, deferred body to DOMContentLoaded");
    return { text: preamble + meta + head + body.replace(/\s*$/, "\n") + tail, notes };
}

module.exports = { CLIENTS, build, splitMetadata, applyEdits, srcDir, outDir, DEAD_MSGPACK, LIVE_MSGPACK, USES_JQUERY };

if (require.main === module) {
    for (const client of CLIENTS) {
        const { text, notes } = build(client);
        fs.writeFileSync(path.join(outDir, client.out), text);
        console.log(client.out);
        for (const n of notes) console.log("  - " + n);
    }
    console.log("\n" + CLIENTS.length + " clients written to clients/");
}
