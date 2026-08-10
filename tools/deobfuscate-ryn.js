#!/usr/bin/env node
"use strict";

// src/Ryn_V5_obfuscated.user.js -> "! Ryn client v5.user.js"
//
// The file is obfuscator.io output: a rotated string array, an RC4 +
// base64 decoder, and per-scope wrapper functions that offset the index before
// calling it. Nothing here reimplements the decoding — the original array
// function, decoder and rotation IIFE are lifted out and run in a sandbox, so
// every recovered string is exactly what the script itself would have produced.
//
// What it does:
//   1. run the prelude to get a working decoder
//   2. find every wrapper `function w(a, b) { return dec(a - N, b); }`,
//      including the ones with the arguments swapped
//   3. replace every call to a wrapper or to the decoder with the string
//   4. delete the array, the decoder, the rotation IIFE and the spent wrappers
//   5. fold the string concatenations the obfuscator split apart, and turn
//      o['name'] back into o.name
//   6. print readable code
//
// Run: node tools/deobfuscate-ryn.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

const ROOT = path.join(__dirname, "..");
const IN = path.join(ROOT, "src", "Ryn_V5_obfuscated.user.js");
const OUT = path.join(ROOT, "! Ryn client v5.user.js");

const source = fs.readFileSync(IN, "utf8");

// ── 1. lift the prelude and get a live decoder ───────────────────────────────

function blockEnd(src, from) {
  let depth = 0;
  const open = src.indexOf("{", from);
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error("unbalanced braces from " + from);
}

const ARRAY_NAME = "_0x1e47";
const DECODER_NAME = "_0x1fc0";

const arrStart = source.indexOf("function " + ARRAY_NAME + "(");
const decStart = source.indexOf("function " + DECODER_NAME + "(");
if (arrStart === -1 || decStart === -1) throw new Error("prelude functions not found");

const arrSrc = source.slice(arrStart, blockEnd(source, arrStart));
const decSrc = source.slice(decStart, blockEnd(source, decStart));

// The rotation IIFE runs the array until a checksum matches, which is what
// puts the entries in the order the decoder expects.
// It is written `(function(a, b) { ... }(array, checksum))`, so the call sits
// inside the outer parens — matching parens is the only way to find its end.
const rotStart = source.indexOf("(function(_0x1615bd,_0x4b38bd){");
if (rotStart === -1) throw new Error("rotation IIFE not found");
function parenEnd(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error("unbalanced parens from " + from);
}
const rotSrc = source.slice(rotStart, parenEnd(source, rotStart));

const sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(arrSrc + "\n" + decSrc + "\n" + rotSrc + ";\nthis.dec = " + DECODER_NAME + ";", sandbox, { filename: "prelude.js" });
const decode = sandbox.dec;

if (typeof decode !== "function") throw new Error("decoder did not evaluate");

// ── 2. parse ─────────────────────────────────────────────────────────────────

const ast = parser.parse(source, { sourceType: "script", errorRecovery: true });

// ── 3. collect the wrappers ──────────────────────────────────────────────────
//
// Two shapes, both common in this output:
//   function w(a, b) { return dec(a - N, b); }
//   function w(a, b) { return dec(b - N, a); }

const wrappers = new Map();

function readWrapper(node) {
  if (!node.id || !node.body || node.body.body.length !== 1) return null;
  const ret = node.body.body[0];
  if (!t.isReturnStatement(ret) || !t.isCallExpression(ret.argument)) return null;
  const call = ret.argument;
  if (!t.isIdentifier(call.callee)) return null;
  const callee = call.callee.name;
  if (callee !== DECODER_NAME && !wrappers.has(callee)) return null;
  if (call.arguments.length !== 2) return null;

  const params = node.params.map(p => p.name);
  const [first, second] = call.arguments;

  // Either argument can carry the offset, and either can be the bare param:
  //   return dec(a - N, b);      return dec(a, b - N);
  //   return dec(b - N, a);      return dec(b, a - N);
  // The inner callee always takes (index, key), so argument 0 builds the index
  // and argument 1 the key, whichever wrapper param each one happens to use.
  const literal = n => {
    if (t.isNumericLiteral(n)) return n.value;
    if (t.isUnaryExpression(n) && t.isNumericLiteral(n.argument)) {
      if (n.operator === "-") return -n.argument.value;
      if (n.operator === "+") return n.argument.value;
    }
    return null;
  };
  const part = n => {
    if (t.isIdentifier(n)) return { name: n.name, off: 0 };
    if (t.isBinaryExpression(n) && t.isIdentifier(n.left)) {
      const v = literal(n.right);
      if (v === null) return null;
      if (n.operator === "-") return { name: n.left.name, off: -v };
      if (n.operator === "+") return { name: n.left.name, off: v };
    }
    return null;
  };
  const idx = part(first), key = part(second);
  if (!idx || !key) return null;
  const idxAt = params.indexOf(idx.name), keyAt = params.indexOf(key.name);
  if (idxAt === -1 || keyAt === -1) return null;

  // Uniformly array-shaped so a wrapper can call another wrapper.
  const inner = callee === DECODER_NAME ? (a => decode(a[0], a[1])) : wrappers.get(callee).fn;
  return {
    name: node.id.name,
    fn: actual => inner([ actual[idxAt] + idx.off, actual[keyAt] + key.off ])
  };
}

// Wrappers can chain, so keep sweeping until nothing new resolves.
let added = true;
while (added) {
  added = false;
  traverse(ast, {
    FunctionDeclaration(p) {
      if (wrappers.has(p.node.id && p.node.id.name)) return;
      const w = readWrapper(p.node);
      if (w) {
        wrappers.set(w.name, w);
        added = true;
      }
    }
  });
}

// ── 4. replace the calls ─────────────────────────────────────────────────────

let replaced = 0, failed = 0, rotationRemoved = 0;

traverse(ast, {
  CallExpression(p) {
    const callee = p.node.callee;
    if (!t.isIdentifier(callee)) return;
    const name = callee.name;
    const isDecoder = name === DECODER_NAME;
    const w = wrappers.get(name);
    if (!isDecoder && !w) return;
    const args = p.node.arguments;
    if (args.length !== 2 || !args.every(a => t.isNumericLiteral(a) || t.isUnaryExpression(a) && t.isNumericLiteral(a.argument))) return;
    const value = a => t.isNumericLiteral(a) ? a.value : (a.operator === "-" ? -a.argument.value : a.argument.value);
    const a0 = value(args[0]), a1 = value(args[1]);
    let out;
    try {
      out = isDecoder ? decode(a0, a1) : w.fn([ a0, a1 ]);
    } catch (e) {
      failed++;
      return;
    }
    if (typeof out !== "string") {
      failed++;
      return;
    }
    p.replaceWith(t.stringLiteral(out));
    replaced++;
  }
});

// ── 5. drop the spent machinery ──────────────────────────────────────────────

// Only if every call resolved. Leaving a reference to a decoder that has been
// deleted would produce a file that no longer runs, which is worse than a file
// that still carries the machinery.
if (failed > 0) {
  console.log("deobfuscate-ryn: " + failed + " call(s) unresolved — keeping the decoder so the output still runs");
}
traverse(ast, {
  FunctionDeclaration(p) {
    if (failed > 0) return;
    const name = p.node.id && p.node.id.name;
    if (name === ARRAY_NAME || name === DECODER_NAME || wrappers.has(name)) p.remove();
  },
  // The rotation IIFE calls the array function, which has just been deleted.
  // It is written inside a SequenceExpression, not as a statement of its own,
  // so removing ExpressionStatements never reached it — and leaving it behind
  // means the very first thing the script does is call a function that is no
  // longer there. Replacing the call with `undefined` keeps the surrounding
  // sequence valid.
  CallExpression(p) {
    if (failed > 0) return;
    const e = p.node;
    if (!t.isFunctionExpression(e.callee)) return;
    if (!e.arguments.some(a => t.isIdentifier(a) && a.name === ARRAY_NAME)) return;
    p.replaceWith(t.identifier("undefined"));
    rotationRemoved++;
  }
});

let leftover = 0;
traverse(ast, {
  Identifier(p) {
    if (p.node.name !== ARRAY_NAME && p.node.name !== DECODER_NAME) return;
    if (t.isMemberExpression(p.parent) && p.parent.property === p.node && !p.parent.computed) return;
    leftover++;
  }
});
if (failed === 0 && leftover > 0) {
  throw new Error(leftover + " reference(s) to the deleted string array or decoder survived — the output would not run");
}

// ── 5b. neutralise the self-defence ─────────────────────────────────────────
//
// obfuscator.io's "self-defending" option. Decoded, it reads:
//
//   const guard = harness(this, function () {
//     if (guard.bind().toString().indexOf('\n') !== -1) return;
//     return guard.toString().search("(((.+)+)+)+$") ...
//   });
//   guard();
//
// `(((.+)+)+)+$` is a catastrophic-backtracking regex. Against the original
// single-line source it settles quickly; against reformatted source it explodes
// and never returns, which is the point — it is there to punish beautifying,
// and it hangs the page before the client ever starts.
//
// It fires regardless of the string substitution: printing the untouched AST
// reproduces the hang exactly, which is how it was told apart from a decoding
// mistake. Emptying the function that carries the regex is enough; the guard
// does nothing else.
let defused = 0;
const REDOS = '(((.+)+)+)+$';
traverse(ast, {
  "FunctionExpression|FunctionDeclaration|ArrowFunctionExpression"(p) {
    if (!p.node.body || !t.isBlockStatement(p.node.body)) return;
    let carries = false;
    p.traverse({
      StringLiteral(q) {
        if (q.node.value === REDOS) carries = true;
      }
    });
    if (!carries) return;
    p.node.body = t.blockStatement([]);
    defused++;
  }
});

// ── 6. tidy what the obfuscator broke apart ──────────────────────────────────

let folded = 0, dotted = 0;
traverse(ast, {
  BinaryExpression: {
    exit(p) {
      if (p.node.operator !== "+") return;
      if (t.isStringLiteral(p.node.left) && t.isStringLiteral(p.node.right)) {
        p.replaceWith(t.stringLiteral(p.node.left.value + p.node.right.value));
        folded++;
      }
    }
  },
  ClassProperty(p) {
    // Class fields keep a computed ["name"] key once the decoder call becomes a
    // string; turn those back into plain field names too.
    const key = p.node.key;
    if (!p.node.computed || !t.isStringLiteral(key)) return;
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key.value)) return;
    p.node.key = t.identifier(key.value);
    p.node.computed = false;
    dotted++;
  },
  ObjectProperty(p) {
    const key = p.node.key;
    if (!p.node.computed || !t.isStringLiteral(key)) return;
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key.value)) return;
    p.node.key = t.identifier(key.value);
    p.node.computed = false;
    dotted++;
  },
  ClassMethod(p) {
    const key = p.node.key;
    if (!p.node.computed || !t.isStringLiteral(key)) return;
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key.value)) return;
    p.node.key = t.identifier(key.value);
    p.node.computed = false;
    dotted++;
  },
  MemberExpression(p) {
    const prop = p.node.property;
    if (!p.node.computed || !t.isStringLiteral(prop)) return;
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(prop.value)) return;
    p.node.property = t.identifier(prop.value);
    p.node.computed = false;
    dotted++;
  }
});

// ── 7. write it out ──────────────────────────────────────────────────────────

// The metadata block is prepended by hand, and generate() is told to drop
// comments — otherwise Babel re-emits the same block as leading comments on the
// first statement and the file ends up with two of them. Dropping them also
// clears every // comment out of the body, which is all the obfuscator left.
const header = source
  .slice(0, source.indexOf("(function("))
  .trimEnd()
  .replace(/^(\/\/ @name\s+).*$/m, "$1! Ryn client v5");

if (!/@name\s+! Ryn client v5/.test(header)) throw new Error("could not set @name");

// shouldPrintComment is explicit because `comments: false` alone still keeps
// anything matching @license or @preserve, which is Babel's default, and the
// obfuscator wraps its output in exactly such a comment.
const code = generate(ast, {
  comments: false,
  shouldPrintComment: () => false,
  jsescOption: { minimal: true },
  retainLines: false
}).code;

// Checked on the AST, not the printed text: the client embeds CSS in template
// literals, and those legitimately contain lines starting with //.
let lineComments = 0;
traverse(ast, {
  enter(p) {
    for (const key of [ "leadingComments", "trailingComments", "innerComments" ]) {
      const list = p.node[key];
      if (list) lineComments += list.filter(c => c.type === "CommentLine").length;
    }
  }
});
if (code.length === 0) throw new Error("generator produced nothing");

fs.writeFileSync(OUT, header + "\n" + code + "\n");

console.log("deobfuscate-ryn: wrappers resolved   " + wrappers.size);
console.log("deobfuscate-ryn: strings recovered   " + replaced);
console.log("deobfuscate-ryn: calls left alone    " + failed);
console.log("deobfuscate-ryn: concats folded      " + folded);
console.log("deobfuscate-ryn: o['x'] -> o.x       " + dotted);
console.log("deobfuscate-ryn: self-defence defused    " + defused);
console.log("deobfuscate-ryn: rotation IIFEs removed " + rotationRemoved);
console.log("deobfuscate-ryn: line comments in body " + lineComments + " (dropped at print time)");
console.log("deobfuscate-ryn: wrote " + path.relative(ROOT, OUT) + " (" + (code.split("\n").length + 1) + " lines)");
