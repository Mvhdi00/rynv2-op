/*
 * deobfuscate.js
 *
 * The 2025 game bundle ships through an obfuscator on top of the minifier.
 * Three things it does get in the way of reading constants and tables out of
 * the text:
 *
 *   1. String literals become calls into a decoder — `ne(466,"GFO1")` — backed
 *      by an RC4-over-base64 string array that an IIFE rotates into place
 *      before first use. There are several independent (array, decoder) pairs
 *      per bundle.
 *   2. Every numeric literal becomes an arithmetic expression: `6` is written
 *      `28*-185+2994+-274*-8`.
 *   3. Operators are routed through throwaway wrapper objects, so `a >>> b`
 *      reads `i["UdUrE"](a, b)`.
 *
 * `decode()` undoes (1) and (2), which is what slicing and evaluating a
 * literal needs. (3) is left alone: it never appears inside the data tables,
 * and the protocol helpers are read by hand.
 *
 * It works on the bundle exactly as shipped — one long line — so nothing here
 * depends on a formatter having run first. The only bundle code it evaluates is
 * the decoder machinery itself: the string-array functions, the decoders, and
 * the rotation IIFEs.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const B64 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";

/* Index just past the brace-balanced block whose `{` is the first one at or
 * after `from`. String and template bodies are skipped, so a brace inside
 * "./img/{n}" does not close the span early. */
function blockEnd(src, from) {
  let depth = 0, quote = null;
  const open = src.indexOf("{", from);
  if (open === -1) throw new Error("no block at offset " + from);
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return i + 1; }
  }
  throw new Error("unterminated block at offset " + from);
}

/* The `( … )` span starting at `from`, balanced, strings skipped. */
function balancedParens(src, from) {
  let depth = 0, quote = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return src.slice(from, i + 1); }
  }
  throw new Error("unterminated argument list at offset " + from);
}

/* Every `function <name>(<a>,<b>){...}` whose body carries the base64 alphabet
 * is a string decoder; the array it reads is named by the `<arr>()` call in its
 * head. */
function findDecoders(src) {
  const out = [];
  const re = /function ([A-Za-z_$][\w$]*)\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const end = blockEnd(src, m.index);
    const body = src.slice(m.index, end);
    if (!body.includes(B64)) continue;
    const arr = body.match(/=\s*([A-Za-z_$][\w$]*)\(\)\s*[;,]/);
    if (!arr) continue;
    out.push({ name: m[1], arrFn: arr[1], start: m.index, body });
  }
  return out;
}

/* The rotation IIFE for a string array: `(function(e,t){…})(<arr>, <checksum>)`,
 * which spins the array until a checksum over its own entries matches. The
 * decoder returns the wrong string until it has run.
 *
 * Found from the call site rather than the function keyword: take each
 * `(<arr>,` and walk the handful of `function` tokens just before it, keeping
 * the one whose body ends exactly where the call begins. */
function findRotation(src, arrFn) {
  const callRe = new RegExp("\\(\\s*" + arrFn.replace(/\$/g, "\\$") + "\\s*,", "g");
  let call;
  while ((call = callRe.exec(src))) {
    const at = call.index;
    const from = Math.max(0, at - 8000);
    const window = src.slice(from, at);
    let k = window.length;
    while ((k = window.lastIndexOf("function", k - 1)) !== -1) {
      const start = from + k;
      let end;
      try {
        end = blockEnd(src, start);
      } catch (e) {
        continue;
      }
      // `})(arr,` leaves one `)` between body and call; `}(arr,` leaves none.
      if (end !== at && !(end === at - 1 && src[at - 1] === ")")) continue;
      // Re-parenthesise rather than reusing the bundle's own wrapping, which
      // may be a `!` or a `;` that does not survive being sliced out.
      return "(" + src.slice(start, end) + ")" + balancedParens(src, at);
    }
  }
  throw new Error("no rotation IIFE for string array " + arrFn);
}

/*
 * Where the quoted literals, templates, regexes and comments are.
 *
 * Needed because a regex cannot tell a string literal from text that merely
 * looks like one. In `String(e).split(".")[1].replace(/-/g,"+")` the stretch
 * from the closing quote of "." to the opening quote of "+" reads exactly like
 * a literal, and the `+` inside the next one reads exactly like concatenation —
 * a pattern-driven join turns the two `replace` calls into nonsense.
 *
 * Returns the literal tokens in source order: { start, end, kind }, kind being
 * "string" | "template" | "regex" | "comment".
 */
const REGEX_PRECEDERS = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
  "case", "do", "else", "yield", "await", "throw",
]);

function literalTokens(src) {
  const tokens = [];
  // The last significant character, for telling a regex from a division.
  let prev = "";
  let prevWord = "";

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      const end = nl === -1 ? src.length : nl;
      tokens.push({ start: i, end, kind: "comment" });
      i = end - 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const close = src.indexOf("*/", i + 2);
      const end = close === -1 ? src.length : close + 2;
      tokens.push({ start: i, end, kind: "comment" });
      i = end - 1;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      tokens.push({ start: i, end: j + 1, kind: "string" });
      i = j;
      prev = c; prevWord = "";
      continue;
    }
    if (c === "`") {
      // Templates nest: `${ `a` }` is legal, and so is a brace inside a
      // substitution, so track both depths.
      let j = i + 1, braces = 0;
      for (; j < src.length; j++) {
        if (src[j] === "\\") { j++; continue; }
        if (braces === 0 && src[j] === "`") break;
        if (src[j] === "$" && src[j + 1] === "{") { braces++; j++; continue; }
        if (braces > 0 && src[j] === "{") braces++;
        else if (braces > 0 && src[j] === "}") braces--;
      }
      tokens.push({ start: i, end: j + 1, kind: "template" });
      i = j;
      prev = "`"; prevWord = "";
      continue;
    }
    if (c === "/") {
      const division =
        /[\w$)\]]/.test(prev) && !REGEX_PRECEDERS.has(prevWord);
      if (!division) {
        let j = i + 1, cls = false;
        for (; j < src.length; j++) {
          const d = src[j];
          if (d === "\\") { j++; continue; }
          if (d === "[") cls = true;
          else if (d === "]") cls = false;
          else if (d === "/" && !cls) break;
          else if (d === "\n") { j = -1; break; } // not a regex after all
        }
        if (j > 0) {
          while (j + 1 < src.length && /[a-z]/.test(src[j + 1])) j++; // flags
          tokens.push({ start: i, end: j + 1, kind: "regex" });
          i = j;
          prev = "/"; prevWord = "";
          continue;
        }
      }
    }
    if (/\s/.test(c)) continue;
    if (/[\w$]/.test(c)) {
      let j = i;
      while (j < src.length && /[\w$]/.test(src[j])) j++;
      prevWord = src.slice(i, j);
      prev = src[j - 1];
      i = j - 1;
      continue;
    }
    prev = c;
    prevWord = "";
  }
  return tokens;
}

/* The source with every literal token's body replaced by `#`, delimiters kept.
 * Offsets are unchanged, so a pattern can be matched against this and the edit
 * applied to the real source — without the pattern ever matching text that is
 * inside a string, a regex or a comment. */
function maskLiterals(src, tokens) {
  const out = src.split("");
  for (const t of tokens || literalTokens(src)) {
    const from = t.kind === "comment" ? t.start : t.start + 1;
    const to = t.kind === "comment" ? t.end : t.end - 1;
    for (let i = from; i < to; i++) if (out[i] !== "\n") out[i] = "#";
  }
  return out.join("");
}

/*
 * Rejoin the obfuscator's split string literals: `"subarr"+"ay"` is one
 * property name, `"Game u"+"pdated"+" - ple"+"ase re"+"load"` one message.
 *
 * Driven off the real literal tokens, so only genuinely adjacent string
 * literals joined by `+` are merged.
 */
function joinStrings(src) {
  const tokens = literalTokens(src).filter((t) => t.kind === "string");
  const edits = [];

  for (let i = 0; i < tokens.length; ) {
    let last = i;
    for (;;) {
      const between = src.slice(tokens[last].end, tokens[last + 1] ? tokens[last + 1].start : src.length);
      if (!tokens[last + 1] || !/^\s*\+\s*$/.test(between)) break;
      last++;
    }
    if (last > i) {
      const expr = src.slice(tokens[i].start, tokens[last].end);
      let v;
      try {
        v = Function('"use strict";return (' + expr + ")")();
      } catch (e) {
        v = null;
      }
      if (typeof v === "string") {
        edits.push({ start: tokens[i].start, end: tokens[last].end, text: JSON.stringify(v) });
      }
    }
    i = last + 1;
  }

  let out = "", at = 0;
  for (const e of edits) {
    out += src.slice(at, e.start) + e.text;
    at = e.end;
  }
  return out + src.slice(at);
}

/*
 * Does this expression need bracketing before it is dropped into a larger one?
 *
 * The wrapper inliner substitutes arguments into bodies and bodies into call
 * sites, and bracketing everything turns `hl(B,Ad)` into `((hl)((B),(Ad)))` —
 * correct, unreadable, and a moving target for anything matching the result.
 * An expression with no operator at its top level cannot be re-associated by
 * its surroundings, so it goes in bare.
 */
function isPrimary(expr) {
  const text = expr.trim();
  if (text === "") return true;
  if (/^[A-Za-z_$][\w$]*$/.test(text)) return true;
  if (/^-?\d+(\.\d+)?$/.test(text)) return true;
  if (/^void 0$/.test(text)) return true;

  let depth = 0, quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(" || c === "[" || c === "{") { depth++; continue; }
    if (c === ")" || c === "]" || c === "}") { depth--; continue; }
    if (depth > 0) continue;
    // An operator or a separator outside any bracket: the expression's shape
    // depends on what it is embedded in.
    if ("+-*/%^&|<>?:=!~,".includes(c)) return false;
    if (/[\w$]/.test(c)) {
      let j = i;
      while (j < text.length && /[\w$]/.test(text[j])) j++;
      if (/^(instanceof|in|typeof|void|new|delete|await|yield)$/.test(text.slice(i, j))) return false;
      i = j - 1;
    }
  }
  return depth === 0;
}

const paren = (expr) => (isPrimary(expr) ? expr.trim() : "(" + expr.trim() + ")");

/* Split an argument list body at its top-level commas. */
function splitArgs(text) {
  const out = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  if (text.trim() !== "") out.push(text.slice(start));
  return out;
}

/*
 * Inline the obfuscator's operator wrappers.
 *
 * Every function it touches grows a throwaway dictionary of one-expression
 * functions and routes its own operators through it, so `a >>> b` is written
 *
 *     const i = { UdUrE: function (l, d) { return l >>> d; } };
 *     i["UdUrE"](a, b)
 *
 * both as an object literal and as a run of `n["hSKmu"]=function(o,s){…}`
 * assignments, and sometimes behind an alias (`const o = i`). This collects
 * every such member and substitutes the call sites, bracketing each argument so
 * precedence survives. A wrapper body may itself hold wrapper calls, so it runs
 * to a fixed point. Constant members — the dictionaries also hold the strings
 * and numbers their function uses — are substituted in place.
 *
 * Only members whose body is a single `return <expr>` are inlined; anything
 * else is left exactly as it is.
 *
 * The dictionaries are indexed by variable name across the whole bundle, which
 * works because the member keys are random: every function calls its wrapper
 * `i`, `n` or `o`, but no two of them use the same key for different code.
 */
function unwrapOperators(src) {
  const tables = new Map(); // var -> Map(key -> {params, body} | {constant})
  const table = (v) => {
    if (!tables.has(v)) tables.set(v, new Map());
    return tables.get(v);
  };
  const put = (v, k, entry) => table(v).set(k, entry);

  /*
   * Substitute a wrapper's parameters with the arguments it was called with.
   *
   * All of them at once. Done one after another, the second pass sees what the
   * first wrote: `function (o, s) { return o >>> s }` called as `(s, 7)` has
   * `o` replaced by `s`, leaving `s >>> s`, and then both of those replaced by
   * `7` — so `s >>> 7` becomes `7 >>> 7`. That is a silent, syntactically
   * valid corruption, and it landed in the middle of the game's PRNG the first
   * time this ran.
   *
   * Matching runs against the masked body so a parameter name that also
   * appears inside a string in the body is left alone.
   */
  function substitute(body, params, actual) {
    if (!params.every((p) => /^[A-Za-z_$][\w$]*$/.test(p))) return null;
    if (!params.length) return body;
    const re = new RegExp(
      "(?<![\\w$.])(" + params.map((p) => p.replace(/\$/g, "\\$")).join("|") + ")(?![\\w$])",
      "g"
    );
    const masked = maskLiterals(body);
    let out = "", at = 0, mm;
    while ((mm = re.exec(masked))) {
      out += body.slice(at, mm.index) + paren(actual[params.indexOf(mm[1])]);
      at = mm.index + mm[1].length;
    }
    return out + body.slice(at);
  }

  const member =
    /^\s*(["']?)([A-Za-z_$][\w$]*)\1\s*:\s*(?:function\s*\(([^)]*)\)\s*\{\s*return\s+([\s\S]*?);?\s*\}|("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?))\s*$/;
  const toEntry = (mm) =>
    mm[5] !== undefined
      ? { constant: mm[5] }
      : { params: splitArgs(mm[3]).map((s) => s.trim()), body: mm[4] };

  // `<var> = { KEY: function (…) { return …; }, KEY2: "…", … }`
  const objRe = /\b([A-Za-z_$][\w$]*)\s*=\s*\{(?=\s*["']?[A-Za-z_$][\w$]*["']?\s*:\s*function)/g;
  let m;
  while ((m = objRe.exec(src))) {
    const open = src.indexOf("{", m.index + m[1].length);
    let end;
    try { end = blockEnd(src, open); } catch (e) { continue; }
    for (const part of splitArgs(src.slice(open + 1, end - 1))) {
      const mm = member.exec(part);
      if (mm) put(m[1], mm[2], toEntry(mm));
    }
  }

  // `<var>["KEY"] = function (…) { return …; }` / `<var>["KEY"] = "…"`
  const assignRe =
    /\b([A-Za-z_$][\w$]*)(?:\["([A-Za-z_$][\w$]*)"\]|\.([A-Za-z_$][\w$]*))\s*=\s*(?:function\s*\(([^)]*)\)\s*\{\s*return\s+([^;}]*?);?\s*\}|("(?:[^"\\]|\\.)*"))(?=[,;)])/g;
  while ((m = assignRe.exec(src))) {
    const key = m[2] || m[3];
    put(m[1], key, m[6] !== undefined
      ? { constant: m[6] }
      : { params: splitArgs(m[4]).map((s) => s.trim()), body: m[5] });
  }

  if (!tables.size) return { code: src, inlined: 0 };

  /* `<var> = <known table var>` hands the same dictionary to another name.
   * The members are merged rather than the map shared, because the alias may
   * already carry members of its own from another function. */
  const aliasRe = /\b([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\b(?!\s*[(=])/g;
  while ((m = aliasRe.exec(src))) {
    if (!tables.has(m[2]) || m[1] === m[2]) continue;
    const into = table(m[1]);
    for (const [k, v] of tables.get(m[2])) into.set(k, v);
  }

  /* A wrapper with a single use is written out at the call site rather than
   * given a name: `({DEuQv:function(i,o,s){return i(o,s)}})["DEuQv"](Ea,e,0)`.
   * No table to look up — the body is right there. */
  let inlinedAnonymous = 0;
  {
    const anonRe =
      /\{\s*(["']?)([A-Za-z_$][\w$]*)\1\s*:\s*function\s*\(([^)]*)\)\s*\{\s*return\s+([^;{}]*?);?\s*\}\s*\}\s*(?:\[\s*["']\2["']\s*\]|\.\2)\s*\(/g;
    let out = "", last = 0, m2;
    while ((m2 = anonRe.exec(src))) {
      const openParen = m2.index + m2[0].length - 1;
      let args;
      try { args = balancedParens(src, openParen); } catch (e) { continue; }
      const params = splitArgs(m2[3]).map((s) => s.trim());
      const actual = splitArgs(args.slice(1, -1));
      if (actual.length !== params.length) continue;
      const body = substitute(m2[4], params, actual);
      if (body === null) continue;
      out += src.slice(last, m2.index) + paren(body);
      last = openParen + args.length;
      anonRe.lastIndex = last;
      inlinedAnonymous++;
    }
    src = out + src.slice(last);
  }

  // Constant members: `o["IsoNM"]["split"]("|")` becomes a plain string.
  let constants = 0;
  src = src.replace(
    /\b([A-Za-z_$][\w$]*)\["([A-Za-z_$][\w$]*)"\](?!\s*[(=])/g,
    (whole, v, k) => {
      const e = tables.get(v) && tables.get(v).get(k);
      if (!e || e.constant === undefined) return whole;
      constants++;
      return e.constant;
    }
  );

  const callRe = /\b([A-Za-z_$][\w$]*)(?:\["([A-Za-z_$][\w$]*)"\]|\.([A-Za-z_$][\w$]*))\(/g;
  let inlined = 0;
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    let out = "";
    let last = 0;
    callRe.lastIndex = 0;
    while ((m = callRe.exec(src))) {
      const entry = tables.get(m[1]) && tables.get(m[1]).get(m[2] || m[3]);
      if (!entry || entry.constant !== undefined) continue;
      const openParen = m.index + m[0].length - 1;
      let args;
      try {
        args = balancedParens(src, openParen);
      } catch (e) {
        continue;
      }
      const actual = splitArgs(args.slice(1, -1));
      if (actual.length !== entry.params.length) continue;
      const body = substitute(entry.body, entry.params, actual);
      if (body === null) continue;
      out += src.slice(last, m.index) + paren(body);
      last = openParen + args.length;
      callRe.lastIndex = last;
      inlined++;
      changed = true;
    }
    if (!changed) break;
    src = out + src.slice(last);
  }

  return { code: src, inlined: inlined + inlinedAnonymous, constants };
}

/* Fold `-1*4504+1*-8913+13430` down to `17`. Only spans made entirely of
 * numeric literals and + - * are considered, and only integer results are
 * kept, so nothing holding an identifier or a division is touched. Matching
 * runs against the masked source so a span inside a string or a comment is
 * never a candidate. */
function foldNumbers(src) {
  const NUM = "(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)";
  const re = new RegExp(
    "(?<![\\w$.\\])\"'#])(-?\\s*" + NUM + "(?:\\s*[-+*]\\s*-?\\s*" + NUM + ")+)(?![\\w$#])",
    "g"
  );
  const masked = maskLiterals(src);
  let out = "", at = 0, m;
  while ((m = re.exec(masked))) {
    const expr = src.slice(m.index, m.index + m[0].length);
    let v;
    try {
      v = Function('"use strict";return (' + expr + ")")();
    } catch (e) {
      continue;
    }
    if (typeof v !== "number" || !Number.isInteger(v)) continue;
    out += src.slice(at, m.index) + String(v);
    at = m.index + m[0].length;
  }
  return out + src.slice(at);
}

/*
 * Resolve the bundle's string-decoder calls and fold its numeric expressions.
 *
 * Which decoder a call site uses is decided by the alias in scope: the
 * obfuscator opens each function with `const i=ne` and then calls `i(…)`,
 * sometimes aliasing again (`const r=i`). One forward pass over the source
 * tracks those assignments and rewrites calls as it meets them, which is
 * enough because an alias is always assigned ahead of the calls using it.
 *
 * `options.unwrap: false` stops before the operator-wrapper pass. That output
 * is uglier but closer to the bundle, which makes it the thing to check the
 * unwrapped version against — see game-wire.js, where the two are run against
 * each other.
 */
function decode(src, options) {
  const decoders = findDecoders(src);
  if (!decoders.length) throw new Error("no string decoders found in bundle");

  let setup = "";
  for (const d of decoders) {
    const at = src.indexOf("function " + d.arrFn + "(");
    if (at === -1) throw new Error("string array function not found: " + d.arrFn);
    setup += src.slice(at, blockEnd(src, at)) + "\n" + d.body + "\n" + findRotation(src, d.arrFn) + ";\n";
  }
  setup +=
    ";globalThis.__dec={" + decoders.map((d) => d.name + ":" + d.name).join(",") + "};" +
    "globalThis.__arr={" + decoders.map((d) => d.name + ":" + d.arrFn + "()").join(",") + "};";

  const sandbox = { parseInt, String, Math, decodeURIComponent, Array };
  vm.runInNewContext(setup, sandbox);
  const dec = sandbox.__dec;
  const arrays = sandbox.__arr;

  const alias = Object.create(null);
  for (const d of decoders) alias[d.name] = d.name;

  /* One scanner over both shapes, so aliases and the calls that use them are
   * seen in source order:
   *   group 1/2  an alias assignment, `i=ne`
   *   group 3/4/5 a decoder call, `i(466,"GFO1")`
   *
   * The index is decimal in the game bundle and hex in the protocol module,
   * and the RC4 key is single-quoted in one and double-quoted in the other, so
   * both spellings are accepted. */
  const scan =
    /\b([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\b(?!\s*[(=])|\b([A-Za-z_$][\w$]*)\(\s*(0[xX][0-9a-fA-F]+|\d+)\s*,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g;

  let resolved = 0;
  const code = src.replace(scan, (whole, lhs, rhs, id, num, key) => {
    if (lhs !== undefined) {
      if (alias[rhs]) alias[lhs] = alias[rhs];
      return whole;
    }
    const which = alias[id];
    if (!which) return whole;
    let v;
    try {
      v = dec[which](Number(num), JSON.parse('"' + key.slice(1, -1).replace(/"/g, '\\"') + '"'));
    } catch (e) {
      return whole;
    }
    if (typeof v !== "string") return whole;
    resolved++;
    return JSON.stringify(v);
  });

  const joined = joinStrings(code);
  const unwrapped = (options && options.unwrap === false)
    ? { code: joined, inlined: 0, constants: 0 }
    : unwrapOperators(joined);

  return {
    code: foldNumbers(unwrapped.code),
    stats: {
      decoders: decoders.map((d) => ({
        name: d.name,
        array: d.arrFn,
        entries: arrays[d.name].length,
      })),
      resolved,
      inlinedOperators: unwrapped.inlined,
      inlinedConstants: unwrapped.constants,
    },
  };
}

/*
 * Syntax-check a rewritten bundle.
 *
 * Every pass here is a textual rewrite, and the failure mode that matters is a
 * rewrite that lands in the middle of something it misread: the output still
 * looks plausible and the table sliced out of it is quietly wrong. Handing the
 * result to the real parser catches that, so callers run this before reading
 * anything out of `decode()`'s output.
 */
function assertParses(code, label) {
  const os = require("os");
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "moo-deob-")),
    "bundle.mjs"
  );
  fs.writeFileSync(file, code);
  const run = require("child_process").spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
  if (run.status !== 0) {
    const why = (run.stderr || "").split("\n").filter((l) => /^\w*Error/.test(l))[0] || "parse failed";
    throw new Error("deobfuscated " + label + " does not parse: " + why);
  }
}

module.exports = {
  decode,
  foldNumbers,
  joinStrings,
  unwrapOperators,
  literalTokens,
  maskLiterals,
  splitArgs,
  blockEnd,
  assertParses,
};
