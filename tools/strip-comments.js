#!/usr/bin/env node
"use strict";

/* Removes comments from a userscript, keeping the ==UserScript== metadata
 * block, which is not documentation but the header the script manager reads.
 *
 * Comment ranges come from a real JavaScript parser rather than a regular
 * expression, so a "//" inside a string, a URL or a regex literal is left
 * alone. Everything outside the removed ranges is copied through byte for
 * byte: no reformatting, no reindenting, and the diff shows only the removed
 * lines.
 *
 * Usage: node tools/strip-comments.js <input> [output]
 */

const fs = require("fs");
const path = require("path");

let parser;
try {
    parser = require("@babel/parser");
} catch (error) {
    console.error("strip-comments: needs @babel/parser — install it with: npm i --no-save @babel/parser");
    process.exit(1);
}

const HEADER_OPEN = "// ==UserScript==";
const HEADER_CLOSE = "// ==/UserScript==";

function headerRange(source) {
    const open = source.indexOf(HEADER_OPEN);
    if (open === -1) {
        return null;
    }
    const close = source.indexOf(HEADER_CLOSE, open);
    if (close === -1) {
        return null;
    }
    return [open, close + HEADER_CLOSE.length];
}

function strip(source) {
    const ast = parser.parse(source, {
        sourceType: "unambiguous",
        errorRecovery: true,
        allowReturnOutsideFunction: true,
        plugins: ["classProperties", "classPrivateProperties", "optionalChaining", "nullishCoalescingOperator"]
    });

    const header = headerRange(source);
    const comments = (ast.comments || []).filter(comment => {
        return !(header && comment.start >= header[0] && comment.end <= header[1]);
    });

    if (comments.length === 0) {
        return { text: source, removed: 0, lines: 0 };
    }

    const keep = new Uint8Array(source.length).fill(1);
    for (const comment of comments) {
        for (let i = comment.start; i < comment.end; i++) {
            keep[i] = 0;
        }
    }

    const out = [];
    let droppedLines = 0;
    let cursor = 0;

    while (cursor <= source.length) {
        let end = source.indexOf("\n", cursor);
        const last = end === -1;
        if (last) {
            end = source.length;
        }

        let touched = false;
        let kept = "";
        for (let i = cursor; i < end; i++) {
            if (keep[i]) {
                kept += source[i];
            } else {
                touched = true;
            }
        }

        if (touched && kept.trim() === "") {
            /* The line was nothing but a comment — drop it rather than leave
             * a blank behind. */
            droppedLines++;
        } else {
            out.push(touched ? kept.replace(/\s+$/, "") : source.slice(cursor, end));
        }

        if (last) {
            break;
        }
        cursor = end + 1;
    }

    return {
        text: out.join("\n"),
        removed: comments.length,
        lines: droppedLines
    };
}

function main() {
    const input = process.argv[2];
    if (!input) {
        console.error("usage: node tools/strip-comments.js <input> [output]");
        process.exit(1);
    }
    const output = process.argv[3] || input;

    const source = fs.readFileSync(input, "utf8");
    const result = strip(source);
    fs.writeFileSync(output, result.text);

    const before = source.split("\n").length;
    const after = result.text.split("\n").length;
    console.log("strip-comments: " + path.basename(input));
    console.log("  comments removed : " + result.removed);
    console.log("  lines            : " + before + " -> " + after + " (" + result.lines + " dropped)");
    console.log("  bytes            : " + source.length + " -> " + result.text.length);
    if (headerRange(result.text)) {
        console.log("  metadata block   : kept");
    } else {
        console.log("  metadata block   : NOT FOUND — check the output");
    }
}

main();
