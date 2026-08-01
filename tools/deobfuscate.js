#!/usr/bin/env node
/**
 * Deobfuscator for the LemonMod build (javascript-obfuscator output).
 *
 * Undoes, in order:
 *   1. hex-escaped string concatenation      '\x61' + '\x62'      -> 'ab'
 *   2. constant arithmetic                   0x64b + 0x20f8 - 3   -> 8419
 *   3. the string-array indirection          LEMONMOD_0x3885(n)   -> 'literal'
 *      including the wrapper functions that forward to it with an offset
 *   4. always-false / always-true guards     if ('a' === 'b') {…} else {…}
 *   5. computed member access                obj['prop']          -> obj.prop
 *
 * What it cannot do: recover the original identifier names. Those are
 * destroyed by the obfuscator and are not recoverable from the output, so
 * `_0x1a2b3c` stays `_0x1a2b3c`.
 *
 * Usage: node tools/deobfuscate.js <in.js> <out.js>
 */
const fs = require('fs');
const acorn = require('acorn');
const { generate } = require('astring');

const IN = process.argv[2];
const OUT = process.argv[3];
if (!IN || !OUT) {
  console.error('usage: node tools/deobfuscate.js <in.js> <out.js>');
  process.exit(2);
}

/* ---------- pass 1: hex-escaped string concatenation ------------------- */
// Done textually, before parsing: '\x68\x74' + '\x74\x70' -> 'http'.
function decodeHexStrings(src) {
  const piece = String.raw`'(?:\\x[0-9a-fA-F]{2})+'`;
  const re = new RegExp(piece + String.raw`(?:\s*\+\s*` + piece + `)*`, 'g');
  return src.replace(re, (m) => {
    const parts = m.match(/'((?:\\x[0-9a-fA-F]{2})+)'/g) || [];
    let s = '';
    for (const p of parts) {
      const hex = p.slice(1, -1).replace(/\\x/g, '');
      s += Buffer.from(hex, 'hex').toString('latin1');
    }
    return JSON.stringify(s);
  });
}

/* ---------- generic walker --------------------------------------------- */
const SKIP = new Set(['type', 'start', 'end', 'loc', 'range']);
function walk(node, visit, parent = null, key = null) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = walk(node[i], visit, parent, key);
    return node;
  }
  if (typeof node.type !== 'string') return node;
  for (const k of Object.keys(node)) {
    if (SKIP.has(k)) continue;
    node[k] = walk(node[k], visit, node, k);
  }
  return visit(node, parent, key) || node;
}

function numLit(v) {
  return v < 0
    ? { type: 'UnaryExpression', operator: '-', prefix: true, argument: { type: 'Literal', value: -v } }
    : { type: 'Literal', value: v };
}
function asNumber(n) {
  if (n.type === 'Literal' && typeof n.value === 'number') return n.value;
  if (n.type === 'UnaryExpression' && n.operator === '-' && n.prefix) {
    const v = asNumber(n.argument);
    return v === null ? null : -v;
  }
  return null;
}
function asString(n) {
  return n && n.type === 'Literal' && typeof n.value === 'string' ? n.value : null;
}

/* ---------- pass 2: constant folding ----------------------------------- */
const ARITH = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b };
function foldConstants(ast) {
  let changed = 0;
  walk(ast, (n) => {
    if (n.type !== 'BinaryExpression') return;
    // numeric arithmetic
    if (ARITH[n.operator]) {
      const a = asNumber(n.left), b = asNumber(n.right);
      if (a !== null && b !== null) {
        const v = ARITH[n.operator](a, b);
        if (Number.isFinite(v)) { changed++; return numLit(v); }
      }
      // string concatenation
      if (n.operator === '+') {
        const s1 = asString(n.left), s2 = asString(n.right);
        if (s1 !== null && s2 !== null) { changed++; return { type: 'Literal', value: s1 + s2 }; }
      }
    }
  });
  return changed;
}

/* ---------- pass 3: string-array indirection --------------------------- */
// Build the table by running the obfuscator's own array + decoder, then
// replace every call to the decoder (and to the wrappers that forward to it).
function resolveStringArray(ast, src) {
  const arrFn = /function\s+(LEMONMOD_0x5a9e)\s*\(/.exec(src);
  const decFn = /function\s+(LEMONMOD_0x3885)\s*\(/.exec(src);
  if (!arrFn || !decFn) return { table: null, resolved: 0 };

  // pull the two function sources out and evaluate them in isolation
  function extractFn(name) {
    const i = src.indexOf('function ' + name);
    let depth = 0, started = false;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') { depth++; started = true; }
      else if (src[j] === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
    }
    return null;
  }
  const arrSrc = extractFn('LEMONMOD_0x5a9e');
  const decSrc = extractFn('LEMONMOD_0x3885');
  let decode;
  try {
    decode = new Function(arrSrc + '\n' + decSrc + '\nreturn LEMONMOD_0x3885;')();
  } catch (e) {
    console.error('  ! could not evaluate the string array:', e.message);
    return { table: null, resolved: 0 };
  }

  // wrappers: function f(a,b,…) { return LEMONMOD_0x3885(<param> ± off, …); }
  const wrappers = new Map();
  walk(ast, (n) => {
    if (n.type !== 'FunctionDeclaration' || !n.id) return;
    const body = n.body.body;
    if (body.length !== 1 || body[0].type !== 'ReturnStatement') return;
    const call = body[0].argument;
    if (!call || call.type !== 'CallExpression') return;
    if (call.callee.type !== 'Identifier' || call.callee.name !== 'LEMONMOD_0x3885') return;
    const arg = call.arguments[0];
    if (!arg || arg.type !== 'BinaryExpression') return;
    const pname = arg.left.type === 'Identifier' ? arg.left.name : null;
    const off = asNumber(arg.right);
    if (pname === null || off === null) return;
    const idx = n.params.findIndex((p) => p.type === 'Identifier' && p.name === pname);
    if (idx < 0) return;
    wrappers.set(n.id.name, { idx, delta: arg.operator === '-' ? -off : off });
  });

  let resolved = 0;
  walk(ast, (n) => {
    if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier') return;
    const name = n.callee.name;
    if (name === 'LEMONMOD_0x3885') {
      const k = asNumber(n.arguments[0]);
      if (k === null) return;
      try { const v = decode(k); if (typeof v === 'string') { resolved++; return { type: 'Literal', value: v }; } } catch (e) {}
      return;
    }
    const w = wrappers.get(name);
    if (!w) return;
    const k = asNumber(n.arguments[w.idx]);
    if (k === null) return;
    try { const v = decode(k + w.delta); if (typeof v === 'string') { resolved++; return { type: 'Literal', value: v }; } } catch (e) {}
  });
  return { table: true, resolved, wrappers: wrappers.size };
}

function declaresHoisted(node) {
  let found = false;
  (function scan(n) {
    if (!n || typeof n !== 'object' || found) return;
    if (Array.isArray(n)) { n.forEach(scan); return; }
    if (typeof n.type !== 'string') return;
    if (n.type === 'FunctionDeclaration') { found = true; return; }
    if (n.type === 'VariableDeclaration' && n.kind === 'var') { found = true; return; }
    // do not descend into nested functions -- their scope is their own
    if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') return;
    for (const k of Object.keys(n)) { if (!SKIP.has(k)) scan(n[k]); }
  })(node);
  return found;
}

/* ---------- pass 4: dead-branch pruning -------------------------------- */
// The obfuscator sprinkles `if ('AbCd' === 'WxYz')` to bury real code in an
// else-branch. Both sides are literals, so the outcome is decidable.
function pruneDeadBranches(ast) {
  let pruned = 0;
  walk(ast, (n) => {
    if (n.type !== 'IfStatement') return;
    const t = n.test;
    if (t.type !== 'BinaryExpression') return;
    if (!['===', '==', '!==', '!='].includes(t.operator)) return;
    const a = asString(t.left), b = asString(t.right);
    if (a === null || b === null) return;
    const eq = a === b;
    const truthy = t.operator === '===' || t.operator === '==' ? eq : !eq;
    const drop = truthy ? n.alternate : n.consequent;
    // `var` and function declarations are hoisted out of the branch, so a
    // discarded branch that declares either could still be referenced.
    if (drop && declaresHoisted(drop)) return;
    pruned++;
    const keep = truthy ? n.consequent : n.alternate;
    if (!keep) return { type: 'EmptyStatement' };
    return keep.type === 'BlockStatement' ? keep : { type: 'BlockStatement', body: [keep] };
  });
  return pruned;
}

/* ---------- pass 5: dot notation --------------------------------------- */
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RESERVED = new Set(['break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally','for','function','if','import','in','instanceof','new','return','super','switch','this','throw','try','typeof','var','void','while','with','yield','let','static','enum','await','implements','package','protected','interface','private','public','null','true','false']);
function dotNotation(ast) {
  let n2 = 0;
  walk(ast, (n) => {
    if (n.type !== 'MemberExpression' || !n.computed) return;
    const s = asString(n.property);
    if (s === null || !IDENT.test(s) || RESERVED.has(s)) return;
    n.computed = false;
    n.property = { type: 'Identifier', name: s };
    n2++;
  });
  return n2;
}

/* ---------- run --------------------------------------------------------- */
console.log('reading', IN);
let src = fs.readFileSync(IN, 'utf8');

// keep the userscript metadata block verbatim -- it is comments, and the
// generator would drop it
const metaEnd = src.indexOf('// ==/UserScript==');
let meta = '';
if (metaEnd !== -1) {
  const cut = metaEnd + '// ==/UserScript=='.length;
  meta = src.slice(0, cut) + '\n';
  src = src.slice(cut);
}

// Everything up to (and including) the marker is hand-written and commented;
// astring would drop those comments, so it is passed through verbatim.
const MARK = process.env.DEOB_AFTER;
const END = process.env.DEOB_UNTIL;
let prefix = '', suffix = '';
if (MARK) {
  const at = src.indexOf(MARK);
  if (at === -1) { console.error('  ! prefix marker not found:', MARK); process.exit(3); }
  prefix = src.slice(0, at + MARK.length) + '\n';
  src = src.slice(at + MARK.length);
}
if (END) {
  const at = src.lastIndexOf(END);
  if (at === -1) { console.error('  ! suffix marker not found:', END); process.exit(3); }
  suffix = '\n' + src.slice(at);
  src = src.slice(0, at);
}

const before = src.length;
src = decodeHexStrings(src);
console.log('  hex strings decoded');

let ast = acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true });

let folded = 0;
for (let i = 0; i < 3; i++) folded += foldConstants(ast);
console.log('  constant expressions folded:', folded);

const sa = resolveStringArray(ast, src);
console.log('  string-array calls resolved:', sa.resolved, '(via', sa.wrappers, 'wrappers)');

let total = 0;
for (let round = 0; round < 6; round++) {
  const p = pruneDeadBranches(ast);
  const f = foldConstants(ast);
  total += p;
  if (!p && !f) break;
}
console.log('  dead branches pruned:', total);

console.log('  member accesses converted to dot notation:', dotNotation(ast));

const out = meta + prefix + generate(ast, { indent: '  ' }) + suffix;
fs.writeFileSync(OUT, out);
console.log('wrote', OUT, '(' + before + ' -> ' + out.length + ' bytes)');
