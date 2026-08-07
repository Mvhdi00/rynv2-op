#!/usr/bin/env node
/*
 * obfuscate.js
 *
 * Shipping step for the player build. The owner build stays readable; this one
 * goes out unreadable.
 *
 * Two passes, in this order:
 *
 *   1. terser - drops all whitespace and mangles names, including the two
 *      top-level ones that pass 2 deliberately leaves alone. Compression is
 *      off, so the only thing that changes is what things are called.
 *
 *   2. javascript-obfuscator - moves every string literal into an encoded,
 *      rotated, shuffled array reached through wrapper functions, renames every
 *      local to a hex name, and rewrites object keys as computed lookups. After
 *      this there are no readable strings and no readable names left.
 *
 * stringArrayCallsTransform is off with the rest of the heavy options: it added
 * half a megabyte and put a wrapper call in front of every string read, which
 * is not a thing to do to code that runs per-entity per-frame.
 *
 * What is deliberately NOT enabled, and why: controlFlowFlattening and
 * deadCodeInjection both cost real runtime, and this is a client that runs hook
 * code inside a 60fps render loop. debugProtection freezes devtools, which
 * would also fight whoever is maintaining the thing.
 *
 * Regex literals are left untouched by both passes. That matters more than it
 * sounds: the client rewrites the game bundle with a list of regex hooks, and a
 * mangled pattern would silently stop matching. tools/e2e-hooks.js is the check
 * for that - run it on the output, not just on the source.
 *
 *   node tools/obfuscate.js <file> [--seed N] [-o out.user.js]
 */

const fs = require("fs");
const { minify_sync } = require("terser");
const JsObfuscator = require("javascript-obfuscator");

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

/* Walks code and returns every regex literal, sorted.
 *
 * A regex would not do the job here: a "/" inside a string or a template is not
 * the start of one. Regex-vs-division is decided from the last significant
 * character, the usual heuristic. */
function scanRegexes(code) {
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
      i = skipQuoted(i, c);
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
      found.push(code.slice(i, j));
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

const source = fs.readFileSync(file, "utf8");

/* Split the metadata block off the top - that is what Tampermonkey reads. */
const metaEnd = source.indexOf("// ==/UserScript==");
if (metaEnd === -1) throw new Error("userscript metadata block not found");
const cut = source.indexOf("\n", metaEnd) + 1;
const header = source.slice(0, cut);
const body = source.slice(cut);

/* Pass 1 - rename and pack. */
const renamed = minify_sync(body, {
  compress: false,
  mangle: { toplevel: true },
  format: { comments: false },
});
if (renamed.error) throw renamed.error;

/* Pass 2 - hide the strings. */
const obfuscated = JsObfuscator.obfuscate(renamed.code, {
  seed,
  compact: true,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false, // pass 1 already did the top level, safely

  stringArray: true,
  stringArrayThreshold: 1,
  stringArrayEncoding: ["base64"],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersType: "function",

  transformObjectKeys: true,
  selfDefending: true,

  // Off on purpose: these cost frame time in a client that hooks the render loop.
  stringArrayCallsTransform: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  numbersToExpressions: false,
  splitStrings: false,

  // Off on purpose: this fights whoever maintains the build.
  debugProtection: false,

  unicodeEscapeSequence: false,
}).getObfuscatedCode();

/* Neither pass rewrites a regex literal, and the bundle-rewrite hooks are all
 * regex literals. If one moved, the hooks are about to silently stop binding. */
const beforeRegexes = scanRegexes(body);
const afterRegexes = scanRegexes(obfuscated);
if (
  beforeRegexes.length !== afterRegexes.length ||
  beforeRegexes.some((r, i) => r !== afterRegexes[i])
) {
  const at = beforeRegexes.findIndex((r, i) => r !== afterRegexes[i]);
  throw new Error(
    "regex literals changed during obfuscation - refusing to write.\n" +
      `  count ${beforeRegexes.length} -> ${afterRegexes.length}\n` +
      `  first difference at ${at}:\n    ${String(beforeRegexes[at]).slice(0, 200)}\n    ${String(afterRegexes[at]).slice(0, 200)}`
  );
}

const output = header + obfuscated + "\n";
fs.writeFileSync(outFile, output);

const kb = (n) => (n / 1024).toFixed(0) + " KB";
console.log(
  `${outFile}: ${kb(source.length)} -> ${kb(output.length)} ` +
    `(seed ${seed}, ${beforeRegexes.length} regex literals verified intact)`
);
console.log(`  pass 1 renamed + packed : ${kb(renamed.code.length)}`);
console.log(`  pass 2 strings hidden   : ${kb(obfuscated.length)}`);
