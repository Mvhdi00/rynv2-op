#!/usr/bin/env node
/*
 * check-hooks.js
 *
 * The client rewrites the game bundle at load with a list of regex hooks. Each
 * one is pinned to a shape of minified code, so a game update can silently
 * orphan a hook and take a feature with it — or, worse, match the wrong site
 * and delete something the game needs.
 *
 * This lifts the real Regexer class and the real hook list out of the client
 * and runs them against src/game_index.js, which is checked in exactly as
 * served. The match is therefore the one the client will actually make: no
 * re-minification, no approximation of the obfuscator's output.
 *
 * It reports which hooks bind, and — because a hook that binds can still be
 * wrong — how much of the bundle each rewrite moved.
 *
 *   node tools/check-hooks.js [path/to/client.js] [--diff <hook>]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const diffAt = args.indexOf("--diff");
const diffHook = diffAt === -1 ? null : args[diffAt + 1];
const clientArg = args.filter((_, i) => diffAt === -1 || (i !== diffAt && i !== diffAt + 1))[0];

const CLIENT_PATH = clientArg ? path.resolve(clientArg) : path.join(ROOT, "ReUp_Mix.user.js");
const client = fs.readFileSync(CLIENT_PATH, "utf8");
const bundle = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");

/* Slice a run of the client between two exact markers. */
function sliceBlock(startMarker, endMarker) {
  const start = client.indexOf(startMarker);
  if (start === -1) throw new Error("marker not found: " + startMarker);
  const end = client.indexOf(endMarker, start);
  if (end === -1) throw new Error("end marker not found: " + endMarker);
  return client.slice(start, end + endMarker.length);
}

const regexerSrc = sliceBlock("class Regexer {", "const Regexer_default = Regexer;");
const formatSrc = sliceBlock("const formatCode2 = code => {", "const formatCode_default = formatCode2;");

/* Only the client's own dependencies go in. Handing the context host
 * intrinsics such as RegExp would break Regexer.isRegExp, which is an
 * instanceof check against the realm the pattern literals were created in. */
const sandbox = {
  Logger: { error() {}, test() {}, warn() {}, log() {} },
  isProd: true,
  console: { log() {}, warn() {}, error() {} },
};

vm.createContext(sandbox);
vm.runInContext(regexerSrc + "\n" + formatSrc, sandbox);

/*
 * Record every attempt, not just the failures, and how far each rewrite
 * reached. A hook that binds is not necessarily a hook that bound where it was
 * meant to: the 2024 `RenderGrid` pattern matched 1,238 characters of the 2025
 * bundle and deleted a const the render loop needed. So the size of what each
 * rewrite removed or added is reported alongside, and a jump there is worth a
 * look even when everything says "bound".
 */
vm.runInContext(
  `
  const _origFormat = Regexer.prototype.format;
  const _origReplace = Regexer.prototype.replace;
  const _origTemplate = Regexer.prototype.template;

  Regexer.prototype.format = function (name, regex, flags) {
    const before = this.hookCount;
    const out = _origFormat.call(this, name, regex, flags);
    __record(name, this.hookCount > before, String(out));
    return out;
  };
  Regexer.prototype.replace = function (name, regex, substr, flags) {
    const was = this.code;
    const out = _origReplace.call(this, name, regex, substr, flags);
    __size(name, was, this.code);
    return out;
  };
  Regexer.prototype.template = function (name, regex, substr, getIndex) {
    const was = this.code;
    const out = _origTemplate.call(this, name, regex, substr, getIndex);
    __size(name, was, this.code);
    return out;
  };
  `,
  sandbox
);

const seen = [];
const byName = new Map();
sandbox.__record = (name, ok, pattern) => {
  const hook = { name, ok, pattern, delta: 0, matched: 0 };
  seen.push(hook);
  byName.set(name, hook);
};
sandbox.__size = (name, before, after) => {
  const hook = byName.get(name);
  if (!hook) return;
  hook.delta = after.length - before.length;
  if (diffHook === name) {
    // Where the two first and last differ: the span the rewrite touched.
    let a = 0;
    while (a < before.length && a < after.length && before[a] === after[a]) a++;
    let b = 0;
    while (
      b < before.length - a && b < after.length - a &&
      before[before.length - 1 - b] === after[after.length - 1 - b]
    ) b++;
    hook.diff = {
      removed: before.slice(a, before.length - b),
      added: after.slice(a, after.length - b),
    };
  }
};

let threw = null;
try {
  vm.runInContext("formatCode2(__bundle)", Object.assign(sandbox, { __bundle: bundle }));
} catch (e) {
  threw = e;
}

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("bundle :", "src/game_index.js (as shipped)");
console.log("");

const bound = seen.filter((h) => h.ok);
const missing = seen.filter((h) => !h.ok);

for (const hook of seen) {
  const size = hook.delta === 0 ? "" : (hook.delta > 0 ? "  +" : "  ") + hook.delta;
  console.log(`  ${hook.ok ? "bound  " : "MISSING"} ${hook.name}${size}`);
}

console.log(`\n${bound.length}/${seen.length} hooks bind against the shipped bundle.`);

const big = seen.filter((h) => h.delta < -200);
if (big.length) {
  console.log(
    "\nrewrites that removed more than 200 characters — worth checking that each " +
    "took only what it meant to:\n  " +
    big.map((h) => h.name + " (" + h.delta + ")").join("\n  ")
  );
}

if (diffHook) {
  const hook = byName.get(diffHook);
  if (!hook) console.log("\nno hook named " + diffHook);
  else if (!hook.diff) console.log("\n" + diffHook + " changed nothing");
  else {
    console.log("\n" + diffHook + "\n  pattern: " + hook.pattern);
    console.log("\n  removed (" + hook.diff.removed.length + "):\n" + hook.diff.removed);
    console.log("\n  added (" + hook.diff.added.length + "):\n" + hook.diff.added);
  }
}

if (threw) {
  console.log("\nformatCode2 threw after the hook pass: " + threw.message);
}

if (missing.length) {
  console.log("\nunbound: " + missing.map((h) => h.name).join(", "));
  process.exit(1);
}
