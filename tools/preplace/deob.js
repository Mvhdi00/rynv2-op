// Decode the javascript-obfuscator string-array layer of the RYN PLAYER build.
//
// Shape of the obfuscation: one big string array (`_0x1e47`) + an RC4/base64
// decoder (`_0x1fc0`), reached through a tree of per-scope wrapper functions
// that each just offset the index and forward to their parent wrapper.
const fs = require("fs");
const vm = require("vm");

const SRC = process.argv[2];
const OUT = process.argv[3];
let src = fs.readFileSync(SRC, "utf8");

function extractFn(name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("no " + name);
  let depth = 0;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    const c = src[j];
    if (c === "{") depth++;
    else if (c === "}") {
      if (--depth === 0) return src.slice(start, j + 1);
    } else if (c === "'" || c === '"') {
      const q = c;
      j++;
      while (j < src.length && src[j] !== q) {
        if (src[j] === "\\") j++;
        j++;
      }
    }
  }
  throw new Error("unbalanced " + name);
}

const arrFn = extractFn("_0x1e47");
const decFn = extractFn("_0x1fc0");
const rotStart = src.indexOf("(function(_0x1615bd,_0x4b38bd)");
const rotEndMark = "(_0x1e47,0x8bc13)";
const rotIIFE =
  src.slice(rotStart, src.indexOf(rotEndMark) + rotEndMark.length) + ");";

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(arrFn + "\n" + decFn + "\n" + rotIIFE, sandbox);
const decode = vm.runInContext("_0x1fc0", sandbox);
if (typeof decode(0xbd, 0) !== "string") throw new Error("decoder check failed");

// 1. Collect every `function N(a,b){return T(<expr>,<expr>);}` forwarder.
const declRe =
  /function (_0x[0-9a-f]+)\((_0x[0-9a-f]+),(_0x[0-9a-f]+)\)\{return (_0x[0-9a-f]+)\(([^;()]*(?:\([^()]*\)[^;()]*)*)\);\}/g;
const decls = new Map(); // name -> {src, parent}
const dupes = new Set();
let m;
while ((m = declRe.exec(src)) !== null) {
  const [, name, p1, p2, parent, args] = m;
  const body = `function ${name}(${p1},${p2}){return ${parent}(${args});}`;
  const prev = decls.get(name);
  if (prev) {
    if (prev.src !== body) dupes.add(name);
    continue;
  }
  decls.set(name, { src: body, parent });
}
for (const n of dupes) decls.delete(n);

// 2. Define them in dependency order so each resolves down to _0x1fc0.
const defined = new Set(["_0x1fc0"]);
let progress = true;
while (progress) {
  progress = false;
  for (const [name, d] of decls) {
    if (defined.has(name)) continue;
    if (!defined.has(d.parent)) continue;
    try {
      vm.runInContext(d.src, sandbox);
      defined.add(name);
      progress = true;
    } catch (e) {
      decls.delete(name);
    }
  }
}
const usable = [...decls.keys()].filter(n => defined.has(n));
console.error(
  `forwarders: ${usable.length} resolved, ${dupes.size} dropped as name-conflicting, ` +
    `${decls.size - usable.length} unreachable`
);

// 3. Constant-fold every call with two numeric-literal arguments.
// Match any two-numeric-argument call and decide by lookup, rather than
// building a 2000-way alternation.
const NUM = "(-?0x[0-9a-fA-F]+|-?\\d+(?:\\.\\d+)?)";
const callRe = new RegExp("\\b(_0x[0-9a-f]+)\\(" + NUM + "," + NUM + "\\)", "g");
const known = new Set([...usable, "_0x1fc0"]);
// Number("-0xe3") is NaN — JS only accepts hex literals unsigned.
function num(text) {
  return text[0] === "-" ? -Number(text.slice(1)) : Number(text);
}

let folded = 0,
  failed = 0;
// Anchors let a position in the folded text be mapped back to the original
// file, so a patch located here can be spliced into the untouched build.
const anchors = [[0, 0]];
let cursor = 0; // read position in the original
let outLen = 0; // written length of the folded output
let out = "";
for (const m2 of src.matchAll(callRe)) {
  const [whole, name, a, b] = m2;
  let replacement = whole;
  if (!known.has(name)) {
    failed++;
  } else {
    try {
      const fn = vm.runInContext(name, sandbox);
      const val = fn(num(a), num(b));
      if (typeof val === "string") {
        replacement = JSON.stringify(val);
        folded++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }
  }
  const gap = src.slice(cursor, m2.index);
  out += gap + replacement;
  outLen += gap.length;
  // both sides sit just before the call / its replacement
  anchors.push([m2.index, outLen]);
  outLen += replacement.length;
  cursor = m2.index + whole.length;
  anchors.push([cursor, outLen]);
}
out += src.slice(cursor);
console.error(`folded ${folded} calls, ${failed} left alone`);

fs.writeFileSync(OUT, out);
fs.writeFileSync(OUT + ".map.json", JSON.stringify(anchors));
