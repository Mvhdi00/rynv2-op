#!/usr/bin/env node
/*
 * check-scopes.js
 *
 * `node --check` proves a file parses. It does not prove a name that is read
 * anywhere in it was ever declared — and deleting 550 lines out of a 27k-line
 * userscript is exactly the way to leave a reference behind pointing at nothing.
 * A dangling name inside a packet handler does not fail at load; it throws the
 * first time that branch runs, in the middle of a fight.
 *
 * This parses the whole client, builds the real scope chain, and reports every
 * identifier that is read or written without a declaration anywhere up that
 * chain — minus the browser and game globals it is legitimately allowed to use.
 *
 *   node tools/check-scopes.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "YoRHa_System.user.js");

const src = fs.readFileSync(CLIENT_PATH, "utf8");

// Names the script may use without declaring: the language, the browser, and
// the handful the userscript header or the page itself provides.
const AMBIENT = new Set([
  // language
  "undefined", "NaN", "Infinity", "globalThis", "arguments", "eval",
  "Object", "Function", "Boolean", "Symbol", "Error", "EvalError", "RangeError",
  "ReferenceError", "SyntaxError", "TypeError", "URIError", "AggregateError",
  "Number", "BigInt", "Math", "Date", "String", "RegExp", "Array", "JSON",
  "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
  "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array",
  "BigUint64Array", "Map", "Set", "WeakMap", "WeakSet", "WeakRef", "ArrayBuffer",
  "SharedArrayBuffer", "DataView", "Promise", "Reflect", "Proxy", "Intl",
  "parseInt", "parseFloat", "isNaN", "isFinite", "decodeURI", "decodeURIComponent",
  "encodeURI", "encodeURIComponent", "escape", "unescape", "structuredClone",
  "queueMicrotask", "AbortController", "AbortSignal", "TextEncoder", "TextDecoder",
  "URL", "URLSearchParams", "Blob", "File", "FileReader", "FormData", "Headers",
  "Request", "Response", "fetch", "atob", "btoa", "crypto", "Worker",
  // browser
  "window", "document", "location", "navigator", "history", "screen", "console",
  "localStorage", "sessionStorage", "indexedDB", "performance", "WebSocket",
  "XMLHttpRequest", "Image", "Audio", "Option", "Event", "CustomEvent",
  "MutationObserver", "IntersectionObserver", "ResizeObserver", "MessageChannel",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "alert", "confirm",
  "prompt", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle",
  "HTMLElement", "Element", "Node", "NodeList", "DOMParser", "CanvasRenderingContext2D",
  "devicePixelRatio", "innerWidth", "innerHeight", "self", "top", "parent", "frames",
  "close", "open", "postMessage", "addEventListener", "removeEventListener",
  "requestIdleCallback", "Notification", "speechSynthesis", "SpeechSynthesisUtterance",
  "OffscreenCanvas", "Path2D", "ImageData", "createImageBitmap",
  // userscript / page-provided
  "GM", "GM_info", "GM_setValue", "GM_getValue", "GM_deleteValue", "GM_listValues",
  "GM_xmlhttpRequest", "GM_addStyle", "unsafeWindow", "$", "jQuery", "msgpack",
  "Howl", "Howler", "grecaptcha", "turnstile",
  // node, for the parts the harness lifts
  "module", "exports", "require", "process", "Buffer", "global", "__dirname", "__filename",
]);

// ---------------------------------------------------------------------------
const ast = acorn.parse(src, {
  ecmaVersion: "latest",
  sourceType: "script",
  allowReturnOutsideFunction: true,
  locations: true,
});

// A scope: its declared names, its parent, and whether it is a function scope
// (which is what var hoists to).
function makeScope(parent, isFunction) {
  return { names: new Set(), parent, isFunction };
}

const problems = [];
const globalScope = makeScope(null, true);

function declare(scope, name, kind) {
  // var and function declarations hoist to the nearest function scope.
  if (kind === "var" || kind === "function") {
    let s = scope;
    while (s && !s.isFunction) s = s.parent;
    (s || globalScope).names.add(name);
  } else {
    scope.names.add(name);
  }
}

function declarePattern(scope, node, kind) {
  if (!node) return;
  switch (node.type) {
    case "Identifier": declare(scope, node.name, kind); break;
    case "ObjectPattern":
      for (const p of node.properties) {
        if (p.type === "RestElement") declarePattern(scope, p.argument, kind);
        else declarePattern(scope, p.value, kind);
      }
      break;
    case "ArrayPattern":
      for (const el of node.elements) declarePattern(scope, el, kind);
      break;
    case "AssignmentPattern": declarePattern(scope, node.left, kind); break;
    case "RestElement": declarePattern(scope, node.argument, kind); break;
  }
}

function resolve(scope, name) {
  let s = scope;
  while (s) {
    if (s.names.has(name)) return true;
    s = s.parent;
  }
  return AMBIENT.has(name);
}

// Two passes per scope: hoist every declaration first, then walk the bodies.
// Without that, a function calling something declared below it reads as missing.
function hoist(scope, node) {
  if (!node || typeof node.type !== "string") return;

  switch (node.type) {
    case "VariableDeclaration":
      for (const d of node.declarations) declarePattern(scope, d.id, node.kind);
      break;
    case "FunctionDeclaration":
      if (node.id) declare(scope, node.id.name, "function");
      return;                                  // its body is its own scope
    case "ClassDeclaration":
      if (node.id) declare(scope, node.id.name, "let");
      return;
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return;
  }

  for (const key of Object.keys(node)) {
    if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach(c => hoist(scope, c));
    else if (child && typeof child.type === "string") hoist(scope, child);
  }
}

function walk(node, scope) {
  if (!node || typeof node.type !== "string") return;

  switch (node.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression": {
      const inner = makeScope(scope, true);
      if (node.type === "FunctionExpression" && node.id) inner.names.add(node.id.name);
      for (const p of node.params) declarePattern(inner, p, "let");
      inner.names.add("arguments");
      hoist(inner, node.body);
      walk(node.body, inner);
      return;
    }

    case "ClassDeclaration":
    case "ClassExpression": {
      const inner = makeScope(scope, false);
      if (node.id) inner.names.add(node.id.name);
      if (node.superClass) walk(node.superClass, scope);
      walk(node.body, inner);
      return;
    }

    case "BlockStatement": {
      const inner = makeScope(scope, false);
      hoist(inner, node);
      for (const s of node.body) walk(s, inner);
      return;
    }

    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement": {
      const inner = makeScope(scope, false);
      if (node.init) { hoist(inner, node.init); walk(node.init, inner); }
      if (node.left) { hoist(inner, node.left); walk(node.left, inner); }
      if (node.right) walk(node.right, inner);
      if (node.test) walk(node.test, inner);
      if (node.update) walk(node.update, inner);
      walk(node.body, inner);
      return;
    }

    case "CatchClause": {
      const inner = makeScope(scope, false);
      if (node.param) declarePattern(inner, node.param, "let");
      hoist(inner, node.body);
      walk(node.body, inner);
      return;
    }

    case "MemberExpression":
      walk(node.object, scope);
      if (node.computed) walk(node.property, scope);
      return;

    case "Property":
      if (node.computed) walk(node.key, scope);
      walk(node.value, scope);
      return;

    case "MethodDefinition":
    case "PropertyDefinition":
      if (node.computed) walk(node.key, scope);
      if (node.value) walk(node.value, scope);
      return;

    case "LabeledStatement":
      walk(node.body, scope);
      return;

    case "BreakStatement":
    case "ContinueStatement":
      return;

    case "Identifier":
      if (!resolve(scope, node.name)) {
        problems.push({ name: node.name, line: node.loc.start.line });
      }
      return;
  }

  for (const key of Object.keys(node)) {
    if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach(c => walk(c, scope));
    else if (child && typeof child.type === "string") walk(child, scope);
  }
}

hoist(globalScope, ast);
for (const s of ast.body) walk(s, globalScope);

// ---------------------------------------------------------------------------
const byName = new Map();
for (const p of problems) {
  if (!byName.has(p.name)) byName.set(p.name, []);
  byName.get(p.name).push(p.line);
}

console.log(`${path.basename(CLIENT_PATH)}: ${ast.body.length} top-level statements parsed`);

if (!byName.size) {
  console.log("\n✓ every identifier read in this file resolves to a declaration");
  process.exit(0);
}

console.log(`\n✗ ${byName.size} undeclared identifier(s):\n`);
for (const [name, lines] of [...byName].sort((a, b) => b[1].length - a[1].length)) {
  const shown = lines.slice(0, 6).join(", ");
  console.log(`   ${name}  (${lines.length}x)  lines ${shown}${lines.length > 6 ? " …" : ""}`);
}
process.exit(1);
