#!/usr/bin/env node
/*
 * obfuscate.js
 *
 * Renames every identifier in a built userscript to a random-looking name
 * (_k3ap7q, _0oas56f, ...) and packs the result onto one line. This is the
 * shipping step for the player build - the owner build stays readable.
 *
 * The rename is done by terser's mangler, so it is scope-aware: it will not
 * rename a property, a string, or a global it does not own. Compression is
 * deliberately off, so the only thing that changes is what things are called.
 *
 * The `@name`/`@match`/`@grant` metadata block at the top is what Tampermonkey
 * reads, so it is lifted off before minifying and put back afterwards.
 *
 * Names come from a seeded generator, so the same input always produces the
 * same output and two builds can be diffed against each other.
 *
 *   node tools/obfuscate.js <file> [--seed N] [-o out.user.js]
 */

const fs = require("fs");
const { minify_sync } = require("terser");

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("-"));
if (!file) {
  console.error("usage: node tools/obfuscate.js <file> [--seed N] [-o out.js]");
  process.exit(1);
}
const seedAt = args.indexOf("--seed");
const seed = seedAt === -1 ? 20260807 : Number(args[seedAt + 1]);
const outAt = args.indexOf("-o");
const outFile = outAt === -1 ? file : args[outAt + 1];

/* mulberry32 - small, seeded, and good enough for picking letters. */
function rng(state) {
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Terser asks for the nth name and expects the same answer every time, so the
 * generated names are memoised by index rather than drawn fresh per call. */
function nameGenerator(seedValue) {
  const random = rng(seedValue);
  const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
  const cache = [];
  const used = new Set();

  return {
    get(n) {
      if (cache[n] !== undefined) return cache[n];
      let name;
      do {
        /* A leading "_" keeps the name valid however the body starts, which is
         * what lets a digit lead the rest of it. */
        let body = "";
        const length = 6 + Math.floor(random() * 3);
        for (let i = 0; i < length; i++) {
          body += ALPHABET[Math.floor(random() * ALPHABET.length)];
        }
        name = "_" + body;
      } while (used.has(name));
      used.add(name);
      cache[n] = name;
      return name;
    },
    consider() {},
    sort() {},
    reset() {},
  };
}

/* Walks code and returns every plain string literal, sorted.
 *
 * A regex would not do: a quote inside a regex literal or inside a template is
 * not a string. Template literals are skipped outright, because a `${name}` in
 * one *is* expected to change when identifiers are renamed. */
function scanStrings(code) {
  const REGEX_KEYWORDS = new Set([
    "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
    "case", "do", "else", "yield", "await",
  ]);
  const found = [];
  let i = 0;
  let prev = "";
  let prevWord = "";

  const canStartRegex = () =>
    prev === "" || (!/[)\]}]/.test(prev) && !/[\w$]/.test(prev)) || REGEX_KEYWORDS.has(prevWord);

  const skipQuoted = (start, quote) => {
    let j = start + 1;
    while (j < code.length) {
      if (code[j] === "\\") { j += 2; continue; }
      if (code[j] === quote) { j++; break; }
      j++;
    }
    return j;
  };

  while (i < code.length) {
    const c = code[i];

    if (c === '"' || c === "'") {
      const end = skipQuoted(i, c);
      found.push(code.slice(i, end));
      i = end;
      prev = c;
      prevWord = "";
      continue;
    }

    if (c === "`") {
      let j = i + 1;
      let depth = 0;
      while (j < code.length) {
        if (code[j] === "\\") { j += 2; continue; }
        if (depth === 0 && code[j] === "`") { j++; break; }
        if (depth === 0 && code[j] === "$" && code[j + 1] === "{") { depth = 1; j += 2; continue; }
        if (depth > 0) {
          if (code[j] === "{") depth++;
          else if (code[j] === "}") depth--;
          else if (code[j] === '"' || code[j] === "'" || code[j] === "`") { j = skipQuoted(j, code[j]); continue; }
        }
        j++;
      }
      i = j;
      prev = "`";
      prevWord = "";
      continue;
    }

    if (c === "/" && canStartRegex()) {
      let j = i + 1;
      let inClass = false;
      while (j < code.length) {
        const ch = code[j];
        if (ch === "\\") { j += 2; continue; }
        if (ch === "[") inClass = true;
        else if (ch === "]") inClass = false;
        else if (ch === "/" && !inClass) { j++; break; }
        else if (ch === "\n") break;
        j++;
      }
      while (j < code.length && /[dgimsuvy]/.test(code[j])) j++;
      i = j;
      prev = "/";
      prevWord = "";
      continue;
    }

    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < code.length && /[\w$]/.test(code[j])) j++;
      prevWord = code.slice(i, j);
      prev = code[j - 1];
      i = j;
      continue;
    }

    if (!/\s/.test(c)) {
      prev = c;
      prevWord = "";
    }
    i++;
  }

  found.sort();
  return found;
}

/* Both sides go through terser with the same print settings first, so quoting
 * and escaping are already normalised by the time they are compared. */
function stringLiterals(code) {
  const out = minify_sync(code, { compress: false, mangle: false, format: { comments: false } });
  if (out.error) throw out.error;
  return scanStrings(out.code);
}

const source = fs.readFileSync(file, "utf8");

/* Split the metadata block off the top. */
const metaEnd = source.indexOf("// ==/UserScript==");
if (metaEnd === -1) throw new Error("userscript metadata block not found");
const cut = source.indexOf("\n", metaEnd) + 1;
const header = source.slice(0, cut);
const body = source.slice(cut);

const result = minify_sync(body, {
  compress: false, // rename only - nothing here should rewrite the logic
  mangle: { toplevel: true, nth_identifier: nameGenerator(seed) },
  format: { comments: false },
});
if (result.error) throw result.error;

/* Mangling never touches the contents of a plain string literal. If one moved,
 * something other than a rename happened and the build should not ship. */
const before = stringLiterals(body);
const after = stringLiterals(result.code);
if (before.length !== after.length || before.some((s, i) => s !== after[i])) {
  const at = before.findIndex((s, i) => s !== after[i]);
  throw new Error(
    "string literals changed during obfuscation - refusing to write.\n" +
      `  count ${before.length} -> ${after.length}\n` +
      `  first difference at ${at}:\n    ${String(before[at]).slice(0, 200)}\n    ${String(after[at]).slice(0, 200)}`
  );
}

const output = header + result.code + "\n";
fs.writeFileSync(outFile, output);

console.log(
  `${outFile}: ${source.length} -> ${output.length} bytes (seed ${seed}, ${before.length} string literals verified)`
);
