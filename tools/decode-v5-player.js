#!/usr/bin/env node
/*
 * decode-v5-player.js
 *
 * The PLAYER build of RYN v5 is put through obfuscator.io: every string in
 * it - including the property names it reads off objects - is RC4'd into a
 * shuffled array and fetched back through a decoder, behind per-scope
 * wrapper functions with their own index offsets.
 *
 * This resolves those calls back to the strings they return, which is
 * enough to read the file and to find code in it. It does not rename the
 * mangled identifiers; it does not need to.
 *
 * It also builds an index map from the decoded text back to the original,
 * so a patch located in the readable view can be applied to the shipped
 * file without deobfuscating it. See tools/patch-v5.js.
 *
 *   node tools/decode-v5-player.js [in] [out]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

/* Pull out a `function name(...){...}` by brace matching. */
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found`);
  let depth = 0;
  let i = source.indexOf("{", start);
  const bodyStart = i;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/* The shuffler runs once at load: `(function(a, b){ ... }(_0xNAME, 0x...))`.
 * It rotates the array until a checksum matches, so the decoder only lines
 * up after it has run. */
function extractShuffler(source, arrayName) {
  const marker = `}(${arrayName},`;
  const markerAt = source.indexOf(marker);
  if (markerAt === -1) throw new Error("shuffler call not found");
  const start = source.lastIndexOf("(function(", markerAt);
  if (start === -1) throw new Error("shuffler head not found");
  const end = source.indexOf(")", source.indexOf(",", markerAt)) + 1;
  /* Drop the leading paren of the IIFE and wrap the call, so it runs as an
   * expression instead of parsing as a function declaration. */
  return `void (${source.slice(start + 1, end)});`;
}

function buildDecoder(source) {
  const decoderName = (source.match(/function (_0x[0-9a-f]+)\(_0x[0-9a-f]+,_0x[0-9a-f]+\)\{_0x[0-9a-f]+=_0x[0-9a-f]+-0x[0-9a-f]+;const/) || [])[1];
  if (!decoderName) throw new Error("could not identify the decoder function");
  const arrayName = (source.match(new RegExp(`const _0x[0-9a-f]+=${decoderName}\\(\\)`)) ? null : null) ||
    (extractFunction(source, decoderName).match(/const _0x[0-9a-f]+=(_0x[0-9a-f]+)\(\);/) || [])[1];
  if (!arrayName) throw new Error("could not identify the string array function");

  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(extractFunction(source, arrayName), sandbox);
  vm.runInContext(extractFunction(source, decoderName), sandbox);
  vm.runInContext(extractShuffler(source, arrayName), sandbox);
  vm.runInContext(`globalThis.__decode = ${decoderName};`, sandbox);

  return { decode: sandbox.__decode, decoderName, arrayName };
}

/* Every scope gets its own alias for the decoder, each with its own index
 * offset, its arguments in either order, and the offset written either way
 * round (`a - 0xd2`, `a - -0x268`, `a + 0x33f`):
 *
 *   function _0x370972(a, b){ return _0x1fc0(a - 0xd2, b); }
 *   function _0x1cef50(a, b){ return _0x1fc0(b - 0xf0, a); }
 *   function _0x433c79(a, b){ return _0x1bd562(a, b - 0x515); }
 *
 * An alias is described by which of its own two parameters ends up as the
 * string index, and what has been added to it by the time it reaches the
 * decoder. Aliases chain off other aliases and are hoisted, so this runs
 * until the set stops growing.
 */
const ARGUMENT = "_0x[0-9a-f]+(?:\\s*[-+]\\s*-?0x[0-9a-f]+)?";

/* Number("-0x173") is NaN - the sign has to come off the hex literal
 * first, and plenty of call sites pass negative indices. */
const toNumber = text => (text.startsWith("-") ? -Number(text.slice(1)) : Number(text));

function parseArgument(text, paramA, paramB) {
  const match = text.match(/^(_0x[0-9a-f]+)(?:\s*([-+])\s*(-?0x[0-9a-f]+))?$/);
  if (!match) return null;
  const [, name, sign, rawDelta] = match;
  const param = name === paramA ? 0 : name === paramB ? 1 : -1;
  if (param === -1) return null;
  let delta = 0;
  if (sign) {
    delta = parseInt(rawDelta, 16);
    if (sign === "-") delta = -delta;
  }
  return { param, delta };
}

function collectAliases(source, decoderName) {
  const known = new Map([[decoderName, { index: 0, offset: 0 }]]);
  const pattern = new RegExp(
    `function (_0x[0-9a-f]+)\\((_0x[0-9a-f]+),(_0x[0-9a-f]+)\\)\\{return (_0x[0-9a-f]+)\\((${ARGUMENT}),(${ARGUMENT})\\);?\\}`,
    "g"
  );

  let added = true;
  let passes = 0;
  while (added && passes < 32) {
    added = false;
    passes++;
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const [, name, paramA, paramB, target, rawFirst, rawSecond] = match;
      if (known.has(name)) continue;
      const parent = known.get(target);
      if (!parent) continue;
      const args = [parseArgument(rawFirst, paramA, paramB), parseArgument(rawSecond, paramA, paramB)];
      const indexArg = args[parent.index];
      if (!indexArg) continue;
      known.set(name, { index: indexArg.param, offset: indexArg.delta + parent.offset });
      added = true;
    }
  }
  return known;
}

/* Replace every `alias(0x..., 0x...)` with the string it returns, and record
 * where each replacement landed so a later patch can be mapped back. */
function decode(source) {
  const { decode: decodeString, decoderName } = buildDecoder(source);
  const aliases = collectAliases(source, decoderName);

  const names = [...aliases.keys()].join("|");
  const pattern = new RegExp(`(${names})\\((0x[0-9a-f]+|-0x[0-9a-f]+|\\d+),(0x[0-9a-f]+|-0x[0-9a-f]+|\\d+)\\)`, "g");

  const spans = [];
  let out = "";
  let last = 0;
  let replaced = 0;
  let failed = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const [whole, name, argA, argB] = match;
    const alias = aliases.get(name);
    const args = [toNumber(argA), toNumber(argB)];
    const index = args[alias.index] + alias.offset;
    const key = args[1 - alias.index];
    let literal;
    try {
      const value = decodeString(index, key);
      literal = typeof value === "string" ? JSON.stringify(value) : null;
    } catch (error) {
      literal = null;
    }
    if (literal === null) {
      failed++;
      continue;
    }
    out += source.slice(last, match.index);
    spans.push({ decodedStart: out.length, decodedEnd: out.length + literal.length, originalStart: match.index, originalEnd: match.index + whole.length });
    out += literal;
    last = match.index + whole.length;
    replaced++;
  }
  out += source.slice(last);
  return { text: out, spans, replaced, failed, aliases: aliases.size };
}

module.exports = { decode };

if (require.main === module) {
  const input = process.argv[2] || path.join(ROOT, "v5-src/RYN_Client_v5_PLAYER.orig.js");
  const output = process.argv[3] || path.join(ROOT, "v5-src/RYN_Client_v5_PLAYER.decoded.js");
  const source = fs.readFileSync(input, "utf8");
  const result = decode(source);
  fs.writeFileSync(output, result.text);
  console.log(`decoded ${path.relative(ROOT, input)}`);
  console.log(`  ${result.aliases} decoder aliases`);
  console.log(`  ${result.replaced} calls resolved, ${result.failed} left alone`);
  console.log(`  -> ${path.relative(ROOT, output)}`);
}
