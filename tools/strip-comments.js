/*
 * Comment stripper for the code this repo generates.
 *
 * Only ever applied to src/moo-transport.js and the wrapper around it, never to
 * a client's own body. Newlines inside a removed comment are kept so that no two
 * lines are ever joined, which would change where semicolons get inserted.
 *
 *   const { stripComments } = require("./strip-comments");
 */
"use strict";

// after one of these, a slash starts a regex literal rather than a division
const REGEX_OK_AFTER_KEYWORD = new Set([
    "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
    "throw", "case", "do", "else", "yield", "await",
]);

function isIdentChar(c) {
    return /[A-Za-z0-9_$]/.test(c);
}

/** true if a `/` at this point opens a regex literal, given what came before */
function regexCanFollow(prev) {
    if (!prev) return true;
    if (prev.type === "punct") return prev.value !== ")" && prev.value !== "]";
    if (prev.type === "word") return REGEX_OK_AFTER_KEYWORD.has(prev.value);
    return false; // number, string, template, regex
}

function stripComments(source) {
    let out = "";
    let prev = null; // last significant token
    let i = 0;
    const n = source.length;

    while (i < n) {
        const c = source[i];
        const d = source[i + 1];

        // line comment
        if (c === "/" && d === "/") {
            while (i < n && source[i] !== "\n") i++;
            continue;
        }

        // block comment: keep its newlines, drop everything else
        if (c === "/" && d === "*") {
            const end = source.indexOf("*/", i + 2);
            const stop = end === -1 ? n : end + 2;
            const newlines = source.slice(i, stop).split("\n").length - 1;
            out += newlines ? "\n".repeat(newlines) : " ";
            i = stop;
            continue;
        }

        // string
        if (c === '"' || c === "'") {
            const start = i;
            i++;
            while (i < n) {
                if (source[i] === "\\") i += 2;
                else if (source[i] === c) {
                    i++;
                    break;
                } else i++;
            }
            out += source.slice(start, i);
            prev = { type: "string" };
            continue;
        }

        // template literal, including ${ } which can nest anything
        if (c === "`") {
            const start = i;
            i++;
            let depth = 0;
            while (i < n) {
                if (source[i] === "\\") i += 2;
                else if (depth === 0 && source[i] === "`") {
                    i++;
                    break;
                } else if (depth === 0 && source[i] === "$" && source[i + 1] === "{") {
                    depth++;
                    i += 2;
                } else if (depth > 0 && source[i] === "{") {
                    depth++;
                    i++;
                } else if (depth > 0 && source[i] === "}") {
                    depth--;
                    i++;
                } else i++;
            }
            out += source.slice(start, i);
            prev = { type: "template" };
            continue;
        }

        // regex literal
        if (c === "/" && regexCanFollow(prev)) {
            const start = i;
            i++;
            let inClass = false;
            let closed = false;
            while (i < n) {
                const ch = source[i];
                if (ch === "\\") i += 2;
                else if (ch === "[") (inClass = true), i++;
                else if (ch === "]") (inClass = false), i++;
                else if (ch === "\n") break;
                else if (ch === "/" && !inClass) {
                    i++;
                    closed = true;
                    break;
                } else i++;
            }
            if (!closed) {
                // not a regex after all; fall back to a plain slash
                i = start + 1;
                out += "/";
                prev = { type: "punct", value: "/" };
                continue;
            }
            while (i < n && isIdentChar(source[i])) i++; // flags
            out += source.slice(start, i);
            prev = { type: "regex" };
            continue;
        }

        // identifier or number
        if (isIdentChar(c)) {
            const start = i;
            while (i < n && (isIdentChar(source[i]) || source[i] === ".")) i++;
            const word = source.slice(start, i);
            out += word;
            prev = /^[0-9.]/.test(word) ? { type: "number" } : { type: "word", value: word };
            continue;
        }

        out += c;
        if (!/\s/.test(c)) prev = { type: "punct", value: c };
        i++;
    }

    // squeeze the blank lines the removed comments left behind
    return out
        .split("\n")
        .map((line) => (/^\s+$/.test(line) ? "" : line.replace(/\s+$/, "")))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");
}

module.exports = { stripComments };
