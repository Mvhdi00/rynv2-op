#!/usr/bin/env node
/*
 * deobfuscate-lemonmod.js
 *
 * Turns the shipped "! LemonMod v3.0 !" userscript into src/LemonMod_v3.0.js.
 *
 * The shipped script is javascript-obfuscator output: a rotated string array
 * behind two decoder functions, several hundred proxy functions that each take
 * sixty-odd dummy parameters and forward exactly one of them to a decoder,
 * every number written as an arithmetic expression, and an opaque predicate
 * (`"abcde" === "fghij"`) wrapped around most statements.
 *
 * Four passes, in order:
 *
 *   1. Evaluate the string array and its decoders in a sandbox, then replace
 *      every proxy call and direct decoder call with the string it produces.
 *      Numbers and string concatenations are constant-folded between rounds so
 *      that arguments become literals the proxies can be evaluated with.
 *   2. Fold the opaque predicates and drop the branches they made dead. This
 *      is where the file halves in size.
 *   3. Drop the now-unreferenced string array and decoders, refusing to do so
 *      if anything still points at them.
 *   4. Normalise: hex escapes back to plain strings, o["x"] back to o.x.
 *
 * The result is behaviour-preserving — nothing here rewrites logic, only the
 * encoding of literals and the branches that were provably constant. The
 * identifier names are whatever the obfuscator left behind; they carry no
 * meaning, but they are stable, which is what lets tools/build-lemonmix.js
 * anchor its edits to exact strings.
 *
 *   npm i --no-save @babel/parser @babel/traverse @babel/generator @babel/types
 *   node tools/deobfuscate-lemonmod.js <shipped-script.js> src/LemonMod_v3.0.js
 */

const fs = require("fs");
const vm = require("vm");

let parser, traverse, generate, t;
try {
  parser = require("@babel/parser");
  traverse = require("@babel/traverse").default;
  generate = require("@babel/generator").default;
  t = require("@babel/types");
} catch (e) {
  console.error("needs babel: npm i --no-save @babel/parser @babel/traverse @babel/generator @babel/types");
  process.exit(1);
}

const IN = process.argv[2];
const OUT = process.argv[3];
if (!IN || !OUT) {
  console.error("usage: node tools/deobfuscate-lemonmod.js <input.js> <output.js>");
  process.exit(1);
}

const ast = parser.parse(fs.readFileSync(IN, "utf8"), { sourceType: "script", errorRecovery: true });

/* ---------------------------------------------------------------- *
 * Pass 1 - string array
 * ---------------------------------------------------------------- */

const fnByName = new Map();
for (const n of ast.program.body) if (n.type === "FunctionDeclaration") fnByName.set(n.id.name, n);

/* A decoder is a self-replacing function that indexes an array built by
 * another function: `function D(a,b){ var arr=A(); D=function(x,y){...}; ... }` */
const DECODERS = [];
for (const n of ast.program.body) {
  if (n.type !== "FunctionDeclaration") continue;
  const src = generate(n).code;
  if (/=\s*function\s*\([^)]*\)\s*\{[\s\S]*return\s+\w+\(/.test(src) && /\[\s*\w+\s*\]/.test(src)) {
    DECODERS.push(n.id.name);
  }
}
if (!DECODERS.length) throw new Error("no string-array decoders found");

/* Everything the decoders reach, plus the rotation IIFEs that shuffle the
 * array into position before anything reads it. */
const need = new Set(DECODERS);
const idsOf = (node) => {
  const s = new Set();
  traverse(t.file(t.program([node])), { Identifier(p) { s.add(p.node.name); } });
  return s;
};
for (let changed = true; changed; ) {
  changed = false;
  for (const name of Array.from(need)) {
    const fn = fnByName.get(name);
    if (!fn) continue;
    for (const id of idsOf(fn)) if (fnByName.has(id) && !need.has(id)) { need.add(id); changed = true; }
  }
}
const MACHINERY = new Set(need);
const preamble = [
  ...ast.program.body.filter((n) => n.type === "FunctionDeclaration" && need.has(n.id.name)),
  ...ast.program.body.filter(
    (n) =>
      n.type === "ExpressionStatement" &&
      n.expression.type === "CallExpression" &&
      n.expression.arguments.some((a) => a.type === "Identifier" && need.has(a.name))
  ),
].map((n) => generate(n).code).join("\n");

const sandbox = { console: { log() {} } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(preamble, sandbox, { timeout: 30000 });
const DEC = new Set(DECODERS);

/* A proxy forwards two arithmetic expressions over its own parameters to a
 * decoder or to another proxy, and does nothing else. */
function proxyInfo(fn) {
  if (!fn.body || fn.body.type !== "BlockStatement") return null;
  const stmts = fn.body.body.filter((s) => s.type !== "FunctionDeclaration");
  if (stmts.length !== 1 || stmts[0].type !== "ReturnStatement") return null;
  const r = stmts[0].argument;
  if (!r || r.type !== "CallExpression" || r.callee.type !== "Identifier" || r.arguments.length !== 2) return null;
  return {
    params: fn.params.map((p) => (p.type === "Identifier" ? p.name : null)),
    target: r.callee.name,
    idx: r.arguments[0],
    key: r.arguments[1],
  };
}

function ev(node, env) {
  switch (node.type) {
    case "NumericLiteral": return node.value;
    case "StringLiteral": return node.value;
    case "Identifier":
      if (node.name in env) return env[node.name];
      throw 0;
    case "UnaryExpression": {
      const v = ev(node.argument, env);
      if (node.operator === "-") return -v;
      if (node.operator === "+") return +v;
      if (node.operator === "!") return !v;
      throw 0;
    }
    case "BinaryExpression": {
      const a = ev(node.left, env), b = ev(node.right, env);
      switch (node.operator) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "%": return a % b;
        case "|": return a | b;
        case "&": return a & b;
        case "^": return a ^ b;
        case "<<": return a << b;
        case ">>": return a >> b;
        default: throw 0;
      }
    }
    case "ParenthesizedExpression": return ev(node.expression, env);
    default: throw 0;
  }
}

const PROXY = new Map();
function registerProxies() {
  PROXY.clear();
  traverse(ast, {
    "FunctionDeclaration|FunctionExpression"(p) {
      const info = proxyInfo(p.node);
      if (!info) return;
      if (DEC.has(info.target)) { PROXY.set(p.node, info); return; }
      const b = p.scope.getBinding(info.target);
      if (!b) return;
      let target = null;
      if (b.path.isFunctionDeclaration()) target = b.path.node;
      else if (b.path.isVariableDeclarator() && b.path.node.init && /Function/.test(b.path.node.init.type)) target = b.path.node.init;
      if (!target) return;
      info.targetNode = target;
      PROXY.set(p.node, info);
    },
  });
}

function callProxy(node, args, depth) {
  if (depth > 12) throw 0;
  const info = PROXY.get(node);
  if (!info) throw 0;
  const env = {};
  info.params.forEach((p, i) => { if (p != null) env[p] = args[i]; });
  const idx = ev(info.idx, env), key = ev(info.key, env);
  if (DEC.has(info.target)) return sandbox[info.target](idx, key);
  if (!info.targetNode) throw 0;
  return callProxy(info.targetNode, [idx, key], depth + 1);
}

const fold = {
  BinaryExpression: {
    exit(p) {
      const { operator } = p.node;
      if (!["+", "-", "*", "/", "%", "|", "&", "^", "<<", ">>"].includes(operator)) return;
      const L = p.get("left").evaluate(), R = p.get("right").evaluate();
      if (!L.confident || !R.confident) return;
      if (typeof L.value === "object" || typeof R.value === "object") return;
      let v;
      try {
        v = ev(p.node, {});
      } catch (e) {
        if (operator === "+" && (typeof L.value === "string" || typeof R.value === "string")) v = L.value + R.value;
        else return;
      }
      if (typeof v === "number" && Number.isFinite(v)) {
        p.replaceWith(v < 0 ? t.unaryExpression("-", t.numericLiteral(-v)) : t.numericLiteral(v));
      } else if (typeof v === "string") p.replaceWith(t.stringLiteral(v));
    },
  },
  UnaryExpression: {
    exit(p) {
      const a = p.node.argument;
      if (p.node.operator === "!" && a.type === "UnaryExpression" && a.operator === "!" && a.argument.type === "NumericLiteral") {
        p.replaceWith(t.booleanLiteral(!!a.argument.value));
      }
    },
  },
};

let replaced = 0;
for (let round = 0; round < 8; round++) {
  traverse(ast, fold);
  registerProxies();
  let n = 0;
  traverse(ast, {
    CallExpression(p) {
      const c = p.node.callee;
      if (c.type !== "Identifier") return;
      if (DEC.has(c.name)) {
        let idx, key;
        try {
          idx = ev(p.node.arguments[0], {});
          key = p.node.arguments[1] ? ev(p.node.arguments[1], {}) : 0;
        } catch (e) { return; }
        let v;
        try { v = sandbox[c.name](idx, key); } catch (e) { return; }
        if (typeof v !== "string") return;
        p.replaceWith(t.stringLiteral(v));
        n++;
        return;
      }
      const b = p.scope.getBinding(c.name);
      if (!b) return;
      let fn = null;
      if (b.path.isFunctionDeclaration()) fn = b.path.node;
      else if (b.path.isVariableDeclarator() && b.path.node.init && /Function/.test(b.path.node.init.type)) fn = b.path.node.init;
      if (!fn || !PROXY.has(fn)) return;
      let args;
      try { args = p.node.arguments.map((a) => ev(a, {})); } catch (e) { return; }
      let v;
      try { v = callProxy(fn, args, 0); } catch (e) { return; }
      if (typeof v !== "string") return;
      p.replaceWith(t.stringLiteral(v));
      n++;
    },
  });
  replaced += n;
  if (n === 0) break;
}
console.log("pass 1: decoded", replaced, "obfuscated string references");

/* Proxies nobody calls any more. */
registerProxies();
let proxiesRemoved = 0;
traverse(ast, {
  FunctionDeclaration(p) {
    if (!PROXY.has(p.node)) return;
    const binding = p.scope.getBinding(p.node.id.name);
    if (binding && binding.referencePaths.length === 0) { p.remove(); proxiesRemoved++; }
  },
});

/* ---------------------------------------------------------------- *
 * Pass 2 - opaque predicates
 * ---------------------------------------------------------------- */

let folded = 0, pruned = 0;
for (let round = 0; round < 6; round++) {
  let n = 0;
  traverse(ast, {
    BinaryExpression: {
      exit(p) {
        const { left, right, operator } = p.node;
        if (!["===", "!==", "==", "!="].includes(operator)) return;
        if (left.type !== "StringLiteral" || right.type !== "StringLiteral") return;
        const eq = left.value === right.value;
        p.replaceWith(t.booleanLiteral(operator[0] === "!" ? !eq : eq));
        n++; folded++;
      },
    },
    ConditionalExpression: {
      exit(p) {
        if (p.node.test.type !== "BooleanLiteral") return;
        p.replaceWith(p.node.test.value ? p.node.consequent : p.node.alternate);
        n++; pruned++;
      },
    },
    IfStatement: {
      exit(p) {
        if (p.node.test.type !== "BooleanLiteral") return;
        const keep = p.node.test.value ? p.node.consequent : p.node.alternate;
        if (!keep) p.remove();
        else if (keep.type === "BlockStatement") p.replaceWithMultiple(keep.body.length ? keep.body : [t.emptyStatement()]);
        else p.replaceWith(keep);
        n++; pruned++;
      },
    },
    LogicalExpression: {
      exit(p) {
        const { left, operator } = p.node;
        if (left.type !== "BooleanLiteral") return;
        if (operator === "&&") p.replaceWith(left.value ? p.node.right : t.booleanLiteral(false));
        else if (operator === "||") p.replaceWith(left.value ? t.booleanLiteral(true) : p.node.right);
        else return;
        n++; pruned++;
      },
    },
  });
  if (!n) break;
}
console.log("pass 2: folded", folded, "opaque predicates, pruned", pruned, "dead branches");

/* ---------------------------------------------------------------- *
 * Pass 3 - drop the machinery
 * ---------------------------------------------------------------- */

const before = ast.program.body.length;
ast.program.body = ast.program.body.filter((n) => {
  const isMachinery = n.type === "FunctionDeclaration" && MACHINERY.has(n.id.name);
  const isRotator =
    n.type === "ExpressionStatement" &&
    n.expression.type === "CallExpression" &&
    n.expression.arguments.some((a) => a.type === "Identifier" && MACHINERY.has(a.name));
  return !(isMachinery || isRotator);
});
const leftovers = new Set();
traverse(ast, { ReferencedIdentifier(p) { if (MACHINERY.has(p.node.name)) leftovers.add(p.node.name); } });
if (leftovers.size) throw new Error("string-array machinery is still referenced: " + [...leftovers].join(", "));
console.log("pass 3: dropped", before - ast.program.body.length, "machinery statements and", proxiesRemoved, "dead proxies");

/* ---------------------------------------------------------------- *
 * Pass 4 - normalise
 * ---------------------------------------------------------------- */

let strings = 0, members = 0;
traverse(ast, {
  StringLiteral(p) { if (p.node.extra) { delete p.node.extra; strings++; } },
  NumericLiteral(p) { if (p.node.extra && /^0x/i.test(p.node.extra.raw || "")) delete p.node.extra; },
  MemberExpression(p) {
    const n = p.node;
    if (n.computed && n.property.type === "StringLiteral" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n.property.value)) {
      n.computed = false;
      n.property = t.identifier(n.property.value);
      members++;
    }
  },
});
console.log("pass 4: normalised", strings, "string literals and", members, "member accesses");

fs.writeFileSync(OUT, generate(ast, { comments: true, jsescOption: { minimal: true } }).code + "\n");
console.log("wrote", OUT);
