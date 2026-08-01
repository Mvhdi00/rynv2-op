#!/usr/bin/env node
/*
 * check-hooks.js
 *
 * The client rewrites the game bundle at load time with a list of regex hooks.
 * Each one is pinned to a specific shape of minified code, so a game update can
 * silently orphan a hook and take a feature with it.
 *
 * This lifts the real Regexer class and the real hook list out of the built
 * script, runs them against src/game_index.js, and reports which ones bind.
 *
 * The hook patterns are written against minified code, and the bundle checked
 * in here is beautified, so it is re-minified first. That approximates the
 * shipped asset closely enough for whitespace-sensitive patterns; it does not
 * reproduce the original mangled identifier names, which the patterns match
 * generically anyway.
 *
 *   node tools/check-hooks.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { minify_sync } = require("terser");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "ReUp_Mix.user.js");

const client = fs.readFileSync(CLIENT_PATH, "utf8");

const beautified = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const minified = minify_sync(beautified, {
  module: true,
  compress: false, // keep the statement shapes the hooks anchor on
  mangle: false,
  format: { comments: false },
});
if (minified.error) throw minified.error;
const bundle = minified.code;

/* Slice `class Regexer { ... }` through the end of formatCode2. */
function sliceBlock(startMarker, endMarker) {
  const start = client.indexOf(startMarker);
  if (start === -1) throw new Error("marker not found: " + startMarker);
  const end = client.indexOf(endMarker, start);
  if (end === -1) throw new Error("end marker not found: " + endMarker);
  return client.slice(start, end + endMarker.length);
}

const regexerSrc = sliceBlock("class Regexer {", "const Regexer_default = Regexer;");
const formatSrc = sliceBlock("const formatCode2 = code => {", "const formatCode_default = formatCode2;");

/* Only the client's own dependencies go in. Handing the context host intrinsics
 * such as RegExp would break Regexer.isRegExp, which is an instanceof check
 * against the realm the pattern literals were created in. */
const sandbox = {
  Logger: { error() {}, test() {}, warn() {} },
  isProd: true,
  console: { log() {} },
};

vm.createContext(sandbox);
vm.runInContext(regexerSrc + "\n" + formatSrc, sandbox);

/* Wrap format() so every attempt is recorded, not just the failures. */
vm.runInContext(
  `
  const _origFormat = Regexer.prototype.format;
  Regexer.prototype.format = function (name, regex, flags) {
    const before = this.hookCount;
    const out = _origFormat.call(this, name, regex, flags);
    __record(name, this.hookCount > before);
    return out;
  };
  `,
  sandbox
);

const seen = [];
sandbox.__record = (name, ok) => seen.push({ name, ok });

let threw = null;
try {
  vm.runInContext("formatCode2(__bundle)", Object.assign(sandbox, { __bundle: bundle }));
} catch (e) {
  threw = e;
}

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("bundle :", "src/game_index.js");
console.log("");

const bound = seen.filter((h) => h.ok);
const missing = seen.filter((h) => !h.ok);

for (const hook of seen) {
  console.log(`  ${hook.ok ? "bound  " : "MISSING"} ${hook.name}`);
}

console.log(`\n${bound.length}/${seen.length} hooks bind against the current bundle.`);

if (threw) {
  console.log("\nformatCode2 threw after the hook pass: " + threw.message);
}

if (missing.length) {
  console.log("\nunbound: " + missing.map((h) => h.name).join(", "));
  process.exit(1);
}
