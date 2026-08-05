#!/usr/bin/env node
/*
 * mod-bundle.js
 *
 * Shared plumbing for reading the old-bundle mods in src/mods.
 *
 * They are all forks of the same webpack build, but they were not all shipped
 * the same way. Four are beautified and keep webpack's named module ids
 * ("./src/js/libs/io-client.js"); Chicken v3 is the minified asset, where the
 * module map is a plain array and ids are its indices. Everything here works
 * on both so the fixer and the verifier do not each need two code paths.
 */

/* ------------------------------------------------------------------ *
 * Source scanning
 * ------------------------------------------------------------------ */

/* Blanks out comments while preserving offsets, so a call site that only
 * survives inside a block comment is not mistaken for live code. Several of
 * the mods carry dead io.send() lines under pre-rename opcodes. */
function stripComments(src) {
  const out = src.split("");
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      const end = nl === -1 ? src.length : nl;
      for (let j = i; j < end; j++) out[j] = " ";
      i = end;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const cl = src.indexOf("*/", i);
      const end = cl === -1 ? src.length : cl + 2;
      for (let j = i; j < end; j++) if (out[j] !== "\n") out[j] = " ";
      i = end - 1;
      continue;
    }
  }
  return out.join("");
}

/* A `/` starts a regex literal rather than a division when what precedes it
 * cannot end an expression. Character classes inside those literals routinely
 * carry unbalanced braces and brackets, so they have to be skipped whole. */
function regexStartsHere(src, i) {
  for (let j = i - 1; j >= 0; j--) {
    const c = src[j];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") continue;
    return "(,=:[!&|?{};+-*%^~<>".includes(c) || /[\s]/.test(c);
  }
  return true;
}

function skipRegex(src, i) {
  let inClass = false;
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") { j++; continue; }
    if (c === "\n") return i;           // not a regex after all
    if (inClass) { if (c === "]") inClass = false; continue; }
    if (c === "[") { inClass = true; continue; }
    if (c === "/") return j;
  }
  return i;
}

/* Index of the closer matching the opener at `open`, skipping strings,
 * template literals, comments and regex literals. `pair` selects braces or
 * brackets — never both, because an unbalanced bracket inside a regex would
 * otherwise throw off a brace scan. */
function matchBrace(src, open, pair = "{}") {
  const [openCh, closeCh] = pair;
  let depth = 0;
  let quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const cl = src.indexOf("*/", i);
      i = cl === -1 ? src.length : cl + 1;
      continue;
    }
    if (c === "/" && regexStartsHere(src, i)) {
      const end = skipRegex(src, i);
      if (end !== i) { i = end; continue; }
    }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/* ------------------------------------------------------------------ *
 * Module lookup
 * ------------------------------------------------------------------ */

/* Body span of the factory following `at` — the region inside the braces of
 * `function (module, exports, __webpack_require__) { ... }`. */
function factoryBodyAt(src, at) {
  const fnAt = src.indexOf("function", at);
  if (fnAt === -1) throw new Error("no module factory after offset " + at);
  const argsOpen = src.indexOf("(", fnAt);
  const argsClose = src.indexOf(")", argsOpen);
  const open = src.indexOf("{", argsClose);
  const close = matchBrace(src, open);
  if (close === -1) throw new Error("unterminated module factory at " + fnAt);
  /* The minified build mangles the factory parameters to (e, t, n), so the
   * wrapper a loader builds has to reuse whatever names are actually there. */
  return { start: open + 1, end: close, params: src.slice(argsOpen + 1, argsClose).trim() };
}

/* Named bundles: look the module up by the id webpack wrote into the map. */
function namedModule(src, id) {
  const at = src.indexOf(JSON.stringify(id) + ":");
  if (at === -1) return null;
  return factoryBodyAt(src, at);
}

/* Minified bundles: the map is the array argument to the bootstrap IIFE, so
 * ids are positions in it. Split it at top level. */
function arrayModules(src) {
  const boot = src.search(/\}\(\s*\[\s*function/);
  if (boot === -1) return null;
  const open = src.indexOf("[", boot);
  const close = matchBrace(src, open, "[]");
  if (close === -1) throw new Error("unterminated webpack module array");

  const spans = [];
  let i = open + 1;
  while (i < close) {
    const fnAt = src.indexOf("function", i);
    if (fnAt === -1 || fnAt > close) break;
    const body = factoryBodyAt(src, fnAt);
    spans.push(body);
    i = body.end + 1;
  }
  return spans;
}

/* The one module every fix targets. Named bundles have it under its webpack
 * id; the minified one is found by the shape of its exports object, and the
 * rebuilt module leaves a sentinel so it can be found again afterwards. */
const IO_CLIENT_ID = "./src/js/libs/io-client.js";
const IO_CLIENT_SENTINEL = "/* @reup-io-client */";

function ioClientRange(src) {
  const sentinel = src.indexOf(IO_CLIENT_SENTINEL);
  if (sentinel !== -1) {
    /* Already rebuilt: the sentinel is the first thing in the body, so the
     * nearest preceding `function` is the factory rather than one of the
     * transport helpers the body goes on to declare. */
    const fnAt = src.lastIndexOf("function", sentinel);
    return factoryBodyAt(src, fnAt);
  }

  const named = namedModule(src, IO_CLIENT_ID);
  if (named) return named;

  const at = src.search(/socketId\s*:\s*-1/);
  if (at === -1) throw new Error("could not locate the io-client module");
  const fnAt = src.lastIndexOf("function", at);
  if (fnAt === -1) throw new Error("io-client module has no factory");
  return factoryBodyAt(src, fnAt);
}

/* Resolve a module to whatever id its bundle uses — a webpack id in the named
 * builds, an array index in the minified one.
 *
 * The named builds are asked for the id directly. Content matching is only the
 * fallback, because several of these mods keep edited copies of the config and
 * item tables inside app.js as well, and a signature search finds those first.
 */
function findModuleId(src, { id, signature }) {
  if (id && namedModule(src, id)) return id;

  const spans = arrayModules(src);
  if (spans) {
    for (let i = 0; i < spans.length; i++) {
      if (src.slice(spans[i].start, spans[i].end).includes(signature)) return i;
    }
  }
  throw new Error("could not resolve module: " + (id || signature));
}

/* ------------------------------------------------------------------ *
 * Evaluation
 * ------------------------------------------------------------------ */

const vm = require("vm");

/* The mods destructure Math at the top of the userscript and lean on those
 * bindings from inside bundle modules, so a sandbox has to supply them. */
const MATH_SHORTHANDS = {
  sin: Math.sin, cos: Math.cos, min: Math.min, max: Math.max, random: Math.random,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, PI: Math.PI, sqrt: Math.sqrt,
  abs: Math.abs, pow: Math.pow, log: Math.log, LN2: Math.LN2, atan2: Math.atan2,
};

function baseSandbox(extra = {}) {
  const sandbox = Object.assign(
    {
      Math, JSON, console, Date, RegExp, String, Number, Object, Array, Error,
      setTimeout, clearTimeout, setInterval, clearInterval,
      Uint8Array, Uint32Array, Int32Array, Float32Array, Float64Array,
      DataView, ArrayBuffer, parseInt, parseFloat, isNaN,
    },
    MATH_SHORTHANDS,
    extra
  );
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

/* Runs bundle modules on demand. `id` is a webpack id in named bundles and an
 * index in minified ones; callers pass whichever the bundle uses. */
function createLoader(src, extra = {}) {
  const spans = arrayModules(src);
  const cache = new Map();
  const processShim = { env: {}, argv: [], nextTick: (f) => setTimeout(f, 0) };

  function rangeOf(id) {
    if (typeof id === "number") {
      if (!spans || !spans[id]) throw new Error("no module at index " + id);
      return spans[id];
    }
    const range = namedModule(src, id);
    if (!range) throw new Error("no module named " + id);
    return range;
  }

  function req(id) {
    if (cache.has(id)) return cache.get(id).exports;
    const m = { exports: {} };
    cache.set(id, m);

    const sandbox = baseSandbox(
      Object.assign(
        {
          module: m, exports: m.exports, __webpack_require__: req,
          process: processShim,
          window: { location: { hostname: "moomoo.io" }, navigator: { userAgent: "node" } },
        },
        extra
      )
    );
    const range = rangeOf(id);
    vm.createContext(sandbox);
    vm.runInContext(
      "(function(" + range.params + "){" + src.slice(range.start, range.end) +
        "\n})(module,exports,__webpack_require__)",
      sandbox
    );
    return m.exports;
  }

  /* The named bundles resolve `process` through a module of their own. */
  cache.set("./node_modules/process/browser.js", { exports: processShim });

  req.isArrayForm = !!spans;
  req.moduleCount = spans ? spans.length : null;
  return req;
}

module.exports = {
  stripComments,
  findModuleId,
  matchBrace,
  factoryBodyAt,
  namedModule,
  arrayModules,
  ioClientRange,
  createLoader,
  baseSandbox,
  MATH_SHORTHANDS,
  IO_CLIENT_ID,
  IO_CLIENT_SENTINEL,
};
