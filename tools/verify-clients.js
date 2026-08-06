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
const { CLIENTS, build, splitMetadata, applyEdits, srcDir, outDir, DEAD_MSGPACK, LIVE_MSGPACK } = require("./patch-clients");

let failures = 0;
function ok(file, name, cond, extra) {
    if (cond) return;
    failures++;
    console.error("  " + file + ": FAIL " + name + (extra ? " (" + extra + ")" : ""));
}

for (const client of CLIENTS) {
    const file = client.out;
    const outPath = path.join(outDir, file);
    if (!fs.existsSync(outPath)) {
        ok(file, "exists", false, "run tools/patch-clients.js");
        continue;
    }
    const out = fs.readFileSync(outPath, "utf8");
    const src = fs.readFileSync(path.join(srcDir, client.file), "utf8");
    const meta = splitMetadata(out, file).meta;

    // on disk is what the patcher produces, i.e. nobody hand-edited the output
    ok(file, "matches a fresh build", out === build(client).text);

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
    ok(file, "no dead rawgit requires", !out.includes(DEAD_MSGPACK), "still present");
    ok(file, "body deferred to DOMContentLoaded", out.includes('document.addEventListener("DOMContentLoaded", __clientMain'));

    // the shim is present and ahead of everything else
    const shimAt = out.indexOf("window.__mooTransport");
    ok(file, "transport shim spliced in", shimAt !== -1);
    const firstProtoPatch = out.indexOf("WebSocket.prototype", out.indexOf("__clientMain = function"));
    ok(
        file,
        "shim installs before the client touches WebSocket.prototype",
        shimAt !== -1 && (firstProtoPatch === -1 || shimAt < firstProtoPatch)
    );

    // the metadata block is comments only: no client code stranded ahead of the
    // shim, where it would run at document-start instead of on a built page
    ok(
        file,
        "metadata block holds no code",
        meta.split("\n").every((l) => l.trim() === "" || l.trim().startsWith("//"))
    );

    // the client's own code is carried over untouched apart from declared edits
    let bodySrc = splitMetadata(src, client.file).body;
    bodySrc = bodySrc.split(DEAD_MSGPACK).join(LIVE_MSGPACK);
    bodySrc = applyEdits(bodySrc, client, client.file);
    ok(file, "client body preserved", out.includes(bodySrc.replace(/\s*$/, "")), "body was altered beyond the declared edits");

    // nothing of ours was added above the client's own code
    const added = out.slice(0, out.indexOf(bodySrc.slice(0, 200)));
    const addedAfterMeta = added.slice(added.indexOf("// ==/UserScript==") + "// ==/UserScript==".length);
    ok(file, "no comments added above the client body", !/\/\*|\/\//.test(addedAfterMeta), "spliced code still carries comments");

    // anything the client was supposed to lose is actually gone, references included
    for (const name of client.absent || [])
        ok(file, "removed " + name, !out.includes(name), "still referenced");

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

// nothing stale left over from the older naming
const strays = fs.readdirSync(outDir).filter((f) => f.endsWith(".js") && !CLIENTS.some((c) => c.out === f));
ok("clients/", "no stale outputs", strays.length === 0, strays.join(", "));

console.log(
    failures
        ? "\n" + failures + " check(s) FAILED across " + CLIENTS.length + " clients"
        : CLIENTS.length + " clients verified"
);
process.exit(failures ? 1 : 0);
