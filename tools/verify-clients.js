#!/usr/bin/env node
/*
 * Checks the patched clients in clients/ against their sources in
 * clients/original/ and against src/moo-transport.js.
 *
 *   node tools/verify-clients.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "clients/original");
const outDir = path.join(root, "clients");
const shim = fs.readFileSync(path.join(root, "src/moo-transport.js"), "utf8").trimEnd();

let failures = 0;
function ok(file, name, cond, extra) {
    if (cond) return;
    failures++;
    console.error("  " + file + ": FAIL " + name + (extra ? " (" + extra + ")" : ""));
}

const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".user.js"));
if (!files.length) {
    console.error("no patched clients in clients/ - run tools/patch-clients.js");
    process.exit(1);
}

for (const file of files) {
    const out = fs.readFileSync(path.join(outDir, file), "utf8");
    const src = fs.readFileSync(path.join(srcDir, file), "utf8");
    const meta = out.slice(out.indexOf("// ==UserScript=="), out.indexOf("// ==/UserScript=="));

    // parses at all
    let parses = true;
    try {
        new vm.Script(out, { filename: file });
    } catch (e) {
        parses = false;
        ok(file, "parses", false, e.message);
    }
    if (parses) ok(file, "parses", true);

    // entry
    ok(file, "runs at document-start", /@run-at\s+document-start/.test(meta));
    ok(file, "no dead rawgit requires", !/rawgit\.com/.test(out), "still present");
    ok(file, "body deferred to DOMContentLoaded", out.includes('document.addEventListener("DOMContentLoaded", __clientMain'));

    // the shim is present, exactly once, and ahead of everything else
    const shimAt = out.indexOf("window.__mooTransport");
    ok(file, "transport shim spliced in", shimAt !== -1);
    ok(file, "transport shim matches src/moo-transport.js", out.includes(shim));
    const firstProtoPatch = out.indexOf("WebSocket.prototype", out.indexOf("__clientMain = function"));
    ok(
        file,
        "shim installs before the client touches WebSocket.prototype",
        shimAt !== -1 && (firstProtoPatch === -1 || shimAt < firstProtoPatch)
    );

    // the client's own code is carried over untouched apart from declared edits
    const bodySrc = src.slice(src.indexOf("\n", src.indexOf("// ==/UserScript==")) + 1);
    const edited = bodySrc
        .split("https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js")
        .join("https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js")
        .replace(
            "this.socket = new WebSocket(e),",
            "this.socket = window.__mooTransport ? window.__mooTransport.legacy(new WebSocket(e)) : new WebSocket(e),"
        )
        .replace(/\s*$/, "");
    ok(file, "client body preserved", out.includes(edited), "body was altered beyond the declared edits");

    // whatever msgpack the client reaches for now resolves
    const usesMsgpack = /\bmsgpack\s*\.\s*(en|de)code/.test(bodySrc);
    const requiresMsgpack = /@require.*msgpack/.test(meta);
    ok(
        file,
        "msgpack is reachable",
        !usesMsgpack || requiresMsgpack || out.includes("window.msgpack = {"),
        "uses msgpack with no @require and no shim fallback"
    );
}

console.log(
    failures
        ? "\n" + failures + " check(s) FAILED across " + files.length + " clients"
        : files.length + " clients verified"
);
process.exit(failures ? 1 : 0);
