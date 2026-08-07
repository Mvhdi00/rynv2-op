#!/usr/bin/env node
/*
 * strip-comments.js
 *
 * Removes JS comments from a built userscript without touching anything else -
 * no reformatting, no renaming, no minification. The userscript metadata block
 * at the top is a comment the loader actually reads, so it is kept verbatim.
 *
 * The scan is a character walk that tracks which construct it is inside
 * (string, template literal, regex literal, comment), because a "//" inside a
 * string or a regex is not a comment. Regex-vs-division is decided from the
 * last significant character, the usual heuristic.
 *
 * Correctness is checked by the caller: terser-minifying the file before and
 * after must produce byte-identical output, since terser drops comments too.
 *
 *   node tools/strip-comments.js <file> [more files...]
 */

const fs = require("fs");

/* A "/" right after one of these is division, not the start of a regex. */
function startsRegex(prev) {
  if (prev === "") return true;
  if (/[)\]}]/.test(prev)) return false;
  if (/[\w$]/.test(prev)) return false;
  return true;
}

/* Keywords that end in a word character but can still be followed by a regex
 * literal, e.g. `return /x/.test(s)` or `typeof /x/`. */
const REGEX_KEYWORDS = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
  "case", "do", "else", "yield", "await",
]);

function stripComments(source) {
  const out = [];
  let i = 0;
  let prev = "";        // last significant char emitted
  let prevWord = "";    // last identifier emitted, for the keyword check

  const emit = (text) => {
    out.push(text);
    for (let k = text.length - 1; k >= 0; k--) {
      if (!/\s/.test(text[k])) { prev = text[k]; break; }
    }
  };

  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];

    /* Line comment. */
    if (c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      i = end === -1 ? source.length : end;   // leave the newline in place
      continue;
    }

    /* Block comment. */
    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const body = source.slice(i, end === -1 ? source.length : end + 2);
      i = end === -1 ? source.length : end + 2;
      /* Keep the line structure: a comment spanning N lines leaves N-1 blank
       * lines behind rather than gluing two statements onto one line. */
      const newlines = body.split("\n").length - 1;
      if (newlines > 0) out.push("\n".repeat(newlines));
      continue;
    }

    /* String literal. */
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === "\\") { j += 2; continue; }
        if (source[j] === c) { j++; break; }
        j++;
      }
      emit(source.slice(i, j));
      i = j;
      prevWord = "";
      continue;
    }

    /* Template literal, including nested ${ ... } which may hold anything. */
    if (c === "`") {
      let j = i + 1;
      let depth = 0;
      while (j < source.length) {
        if (source[j] === "\\") { j += 2; continue; }
        if (depth === 0 && source[j] === "`") { j++; break; }
        if (depth === 0 && source[j] === "$" && source[j + 1] === "{") { depth = 1; j += 2; continue; }
        if (depth > 0) {
          if (source[j] === "{") depth++;
          else if (source[j] === "}") depth--;
          else if (source[j] === '"' || source[j] === "'" || source[j] === "`") {
            const quote = source[j];
            j++;
            while (j < source.length) {
              if (source[j] === "\\") { j += 2; continue; }
              if (source[j] === quote) break;
              j++;
            }
          }
        }
        j++;
      }
      emit(source.slice(i, j));
      i = j;
      prevWord = "";
      continue;
    }

    /* Regex literal. */
    if (c === "/" && (startsRegex(prev) || REGEX_KEYWORDS.has(prevWord))) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length) {
        const ch = source[j];
        if (ch === "\\") { j += 2; continue; }
        if (ch === "[") inClass = true;
        else if (ch === "]") inClass = false;
        else if (ch === "/" && !inClass) { j++; break; }
        else if (ch === "\n") break;   // unterminated: treat as division after all
        j++;
      }
      while (j < source.length && /[dgimsuvy]/.test(source[j])) j++;
      emit(source.slice(i, j));
      i = j;
      prevWord = "";
      continue;
    }

    /* Identifier / keyword, tracked so `return /re/` is not read as division. */
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < source.length && /[\w$]/.test(source[j])) j++;
      prevWord = source.slice(i, j);
      emit(prevWord);
      i = j;
      continue;
    }

    if (!/\s/.test(c)) prevWord = "";
    emit(c);
    i++;
  }

  return out.join("");
}

/* The `// ==UserScript== ... // ==/UserScript==` block is metadata, not a
 * comment to strip. Split it off, strip the rest, put it back. */
function stripUserscript(source) {
  const end = source.indexOf("// ==/UserScript==");
  if (end === -1) return stripComments(source);
  const cut = source.indexOf("\n", end) + 1;
  return source.slice(0, cut) + stripComments(source.slice(cut));
}

/* Comment-only lines leave blanks behind; collapse runs of them. */
function collapseBlankRuns(source) {
  return source.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n").replace(/[ \t]+$/gm, "");
}

for (const file of process.argv.slice(2)) {
  const before = fs.readFileSync(file, "utf8");
  const after = collapseBlankRuns(stripUserscript(before));
  fs.writeFileSync(file, after);
  console.log(`${file}: ${before.length} -> ${after.length} bytes`);
}
