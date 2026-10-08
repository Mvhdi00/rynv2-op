#!/usr/bin/env node
/*
 * extract-drivers.js
 *
 * Pulls the "drivers" — the game-side protocol constants and data tables that a
 * client has to agree with byte-for-byte — straight out of the shipped game
 * assets (src/game_index.js, src/game_vendor.js, src/game_protocol.js) and
 * writes them to drivers/game-drivers.json.
 *
 * The bundles are checked in exactly as served, so this runs them through
 * tools/deobfuscate.js first: resolving the string-decoder calls, joining split
 * literals and folding the arithmetic-encoded numbers. Every table is then
 * located by a value only that table contains — `name:"tool hammer"` for
 * weapons, `src:"arrow_1"` for projectiles — and the enclosing literal is
 * sliced and evaluated on its own. The minifier renames these bindings on every
 * build, so nothing here depends on what they are called.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const wire = require("./game-wire.js");
const { esc } = wire;

const ROOT = path.resolve(__dirname, "..");
const SRC = wire.SOURCES;

const INDEX = wire.source().index;
const PROTOCOL = wire.source().protocol;
const VENDOR = wire.source().vendor;

/* ---- slicing ---------------------------------------------------------------
 * The bundle is one line, so literals are located by offset rather than by
 * line. `enclosing` walks the `<name> = [` / `<name> = {` openers that precede
 * an offset and returns the outermost one whose balanced span covers it.
 */

/* Index just past the balanced literal starting at `open` ("[" or "{"). */
function literalEnd(src, open) {
  const openCh = src[open];
  const closeCh = openCh === "[" ? "]" : "}";
  let depth = 0, quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}

/* The outermost `<name> = <literal>` whose literal contains `offset`. */
function enclosing(src, offset) {
  const re = /([A-Za-z_$][\w$]*)\s*=\s*([[{])/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    if (open > offset) break;
    const end = literalEnd(src, open);
    if (end > offset) return { name: m[1], src: src.slice(open, end), at: m.index, end };
  }
  throw new Error("no enclosing literal at offset " + offset);
}


/* Locate a table by a value unique to it and evaluate it. `scope` supplies the
 * bindings the literal refers to — item rows carry `group: <itemGroups>[n]`. */
function tableBy(signature, scope = {}) {
  const at = INDEX.indexOf(signature);
  if (at === -1) throw new Error("table signature not found in game bundle: " + signature);
  const lit = enclosing(INDEX, at);
  const sandbox = Object.assign({ Math, Date }, scope);
  return { name: lit.name, value: vm.runInNewContext("(" + lit.src + ")", sandbox) };
}

/* ---- config ----------------------------------------------------------------
 * The config object is the tail of one long `const` run whose every other
 * binding is one of its values, so the whole run is evaluated and the object
 * read back out. `Ca` is the bundle's `process` shim (vendor's browser
 * polyfill); `maxPlayers` reads its argv.
 */
function extractConfig() {
  const at = INDEX.indexOf("maxScreenWidth:");
  if (at === -1) throw new Error("config object not found in game bundle");
  const lit = enclosing(INDEX, at);

  // Walk back through `const ` openers until the whole run evaluates.
  let cursor = lit.at;
  for (;;) {
    cursor = INDEX.lastIndexOf("const ", cursor - 1);
    if (cursor === -1) throw new Error("start of the config const run not found");
    const sandbox = { Math, Date, Ca: { argv: [], env: {} } };
    try {
      vm.runInNewContext(INDEX.slice(cursor, lit.end) + "\n;__out = " + lit.name + ";", sandbox);
    } catch (e) {
      continue;
    }
    if (sandbox.__out && typeof sandbox.__out === "object" && "maxScreenWidth" in sandbox.__out) {
      const out = {};
      const undetermined = [];
      for (const [k, v] of Object.entries(sandbox.__out)) {
        if (typeof v === "function") {
          // Functions in the config (fetchVariant) do not round-trip through
          // JSON; record them by name so a diff still sees the key.
          out[k] = "<function>";
        } else if (v === undefined) {
          /* A value the page decides, not the bundle — `inSandbox` reads the
           * URL. JSON would drop the key and the client's value would then
           * never be compared against anything, so the gap is named instead. */
          undetermined.push(k);
        } else {
          out[k] = v;
        }
      }
      return { config: out, undetermined };
    }
  }
}

/* ---- protocol --------------------------------------------------------------
 * Which piece of the transport is called what on this build is resolved by
 * tools/game-wire.js, from the code that uses each one; see its header. What is
 * left here is reading the values out of those bindings, each from the helper
 * that actually uses it.
 */
function num(src, re, what) {
  const m = src.match(re);
  if (!m) throw new Error("protocol constant not found: " + what);
  return Number(m[1]);
}

/* `<name> = <number>`, wherever the bundle declares it. */
function constant(name, what) {
  return num(
    INDEX,
    new RegExp("(?:const |[,;{(])" + esc(name) + "\\s*=\\s*(\\d+)[,;)]"),
    what + " (" + name + ")"
  );
}

/* `<name> = ["M","D",…]`, the opcode alphabet itself. */
function alphabet(name, what) {
  const m = INDEX.match(new RegExp("(?:const |[,;])" + esc(name) + '=(\\["[^\\]]*"\\])'));
  if (!m) throw new Error("opcode alphabet not found: " + what + " (" + name + ")");
  return JSON.parse(m[1]);
}

function extractProtocol() {
  const n = wire.names();

  /* The table builder's own body: the two seed constants. */
  const tablesSrc = wire.fnBody(n.tables, "opcode table builder");
  const tableSeedMul = num(tablesSrc, /Math\["imul"\]\(s,(\d+)\)/, "table seed multiplier");
  const s2cTableSeedXor = num(tablesSrc, /a\^(\d+)/, "s2c table seed xor");

  /* The mask splitter and the two keystream seed functions. */
  const maskSrc = wire.fnBody(n.maskFrom, "mask splitter");
  const maskC2sXor = num(maskSrc, /c2s:\(.*?\^(\d+)\)/, "c2s mask xor");
  const maskS2cXor = num(maskSrc, /s2c:\(.*?\^(\d+)\)/, "s2c mask xor");
  const maskCounterMul = num(
    wire.fnBody(n.maskIn, "inbound keystream seed"),
    /Math\["imul"\]\(t,(\d+)\)/,
    "mask counter multiplier"
  );

  const streamSrc = wire.fnBody(n.applyMask, "keystream");
  const keystreamSeedFallback = num(streamSrc, /&&\(s=(\d+)\)/, "keystream seed fallback");
  const keystreamRounds = (streamSrc.match(/s\^=\(?s(?:<<|>>>)\(?\d+/g) || []).map((r) =>
    r.replace(/\D/g, "")
  );

  return {
    transport: "opcode-table + truncated HMAC + xorshift mask",
    encryptedMode: constant(n.mode, "encrypted mode"),
    signatureBytes: constant(n.sigBytes, "frame signature width"),
    hmac: "sha256-truncated",
    codec: VENDOR.includes("encodeSharedRef") ? "msgpack" : "unknown",

    // io-init's arguments, in the order the handler reads them.
    ioInit: n.ioInit,
    pinnedWhen: n.pinnedValue,
    // c2s payload is msgpack([opcode, args, seq]) once the tables are on.
    framesCarrySequence: n.framesCarrySequence,
    buildIdQueryParam: n.buildIdQueryParam,

    c2sAlphabet: alphabet(n.c2sAlphabet, "c2s"),
    c2sLegacyCount: constant(n.c2sLegacyCount, "c2s legacy count"),
    s2cAlphabet: alphabet(n.s2cAlphabet, "s2c"),
    s2cLegacyCount: constant(n.s2cLegacyCount, "s2c legacy count"),

    legacyTableSalt: constant(n.legacySalt, "legacy table salt"),
    tableSeedMul,
    s2cTableSeedXor,
    shuffle: "fisher-yates over splitmix32",

    maskC2sXor,
    maskS2cXor,
    maskCounterMul,
    keystream: "xorshift32(" + keystreamRounds.join(",") + "), 4 bytes per round",
    keystreamSeedFallback,

    keyMixer: extractKeyMixer(),
  };
}

/* ---- the key mixer --------------------------------------------------------
 * `moomoo-protocol` exports BUILD_ID, BUILD_SALT and mixKey. mixKey XORs the
 * server's key with a byte stream from a one-function WebAssembly module
 * carried in the file as base64. The module is recorded here whole, along with
 * the integer pipeline it computes, so a client can agree with it without
 * having to get hold of the module's own export.
 */
function extractKeyMixer() {
  const buildId = PROTOCOL.match(/BUILD_ID\s*=\s*"([^"]*)"/);
  const buildSalt = PROTOCOL.match(/BUILD_SALT\s*=\s*(\d+)/);
  const mix = PROTOCOL.match(/MIX\s*=\s*"([A-Za-z0-9+/=]+)"/);
  if (!buildId) throw new Error("BUILD_ID not found in the protocol module");
  if (!buildSalt) throw new Error("BUILD_SALT not found in the protocol module");
  if (!mix) throw new Error("the mixer WebAssembly module not found in the protocol module");

  const wasm = Buffer.from(mix[1], "base64");
  const { steps, js } = disassembleMixer(wasm);
  checkMixerSteps(wasm, js);

  return {
    module: "moomoo-protocol",
    source: SRC.protocol,
    buildId: buildId[1],
    buildSalt: Number(buildSalt[1]),
    // mixKey(key, seed)[i] = key[i] ^ byte(seed, i)
    apply: "key[i] ^ byte(seed, i)",
    wasmBase64: mix[1],
    wasmSha256: require("crypto").createHash("sha256").update(wasm).digest("hex"),
    /* `byte(seed, i)`, as the module computes it: a straight line of 32-bit
     * wrapping integer steps, every `*` an imul and every `+` wrapping at 32
     * bits. Checked against the module itself before being written out, so a
     * client can be held to this list rather than to the base64. */
    byteSteps: steps,
    /* The same line in JavaScript, with every `*` an imul and every `+`
     * wrapping at 32 bits, so a client can carry the mixer without the
     * module. This is what the check above actually ran. */
    byteJs: js,
  };
}

/*
 * Read the mixer module's single exported function and render it as a sequence
 * of assignments to `x`.
 *
 * It is a stack machine with no locals beyond its two parameters and no control
 * flow, so a symbolic stack is enough: each `local.set` closes one step off.
 * Any opcode this does not model is an error rather than a silent omission —
 * the steps are what a client reimplements.
 */
function disassembleMixer(wasm) {
  const code = wasm.indexOf(0x0a, 8);
  if (code === -1) throw new Error("no code section in the mixer module");
  let p = code + 1;
  const leb = () => {
    let r = 0, s = 0, b;
    do { b = wasm[p++]; r |= (b & 0x7f) << s; s += 7; } while (b & 0x80);
    return r >>> 0;
  };
  const sleb = () => {
    let r = 0n, s = 0n, b;
    do { b = BigInt(wasm[p++]); r |= (b & 0x7fn) << s; s += 7n; } while (b & 0x80n);
    if (b & 0x40n) r -= 1n << s;
    return Number(BigInt.asUintN(32, r));
  };
  leb(); leb(); leb(); // section size, body count, body size
  if (leb() !== 0) throw new Error("the mixer function declares locals; unmodelled");

  /* The exported function is byte(seed, i). Each stack slot carries both the
   * text that goes into the drivers file and the equivalent JavaScript, built
   * side by side so the check below never has to re-parse the text. */
  const locals = [{ text: "seed", js: "seed" }, { text: "i", js: "i" }];
  const stack = [];
  const steps = [];
  const js = [];
  const binary = {
    0x6a: { text: "+", js: (a, b) => "((" + a + " + " + b + ") | 0)" },
    0x6c: { text: "*", js: (a, b) => "Math.imul(" + a + ", " + b + ")" },
    0x73: { text: "^", js: (a, b) => "(" + a + " ^ " + b + ")" },
    0x74: { text: "<<", js: (a, b) => "(" + a + " << " + b + ")" },
    0x76: { text: ">>>", js: (a, b) => "(" + a + " >>> " + b + ")" },
    0x71: { text: "&", js: (a, b) => "(" + a + " & " + b + ")" },
  };

  while (p < wasm.length) {
    const op = wasm[p++];
    if (op === 0x20) { stack.push(locals[leb()]); continue; }     // local.get
    if (op === 0x21) {                                            // local.set
      const n = leb();
      const value = stack.pop();
      if (value === undefined) throw new Error("mixer: local.set on an empty stack");
      steps.push("x = " + value.text);
      js.push("x = " + value.js);
      locals[n] = { text: "x", js: "x" };
      continue;
    }
    if (op === 0x41) {                                            // i32.const
      const c = sleb();
      stack.push({ text: String(c), js: String(c) });
      continue;
    }
    if (binary[op]) {
      const b = stack.pop(), a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("mixer: binary op on an empty stack");
      stack.push({
        text: "(" + a.text + " " + binary[op].text + " " + b.text + ")",
        js: binary[op].js(a.js, b.js),
      });
      continue;
    }
    if (op === 0x0b) {                                            // end
      const value = stack.pop();
      if (value === undefined) throw new Error("mixer: no value left to return");
      steps.push("return " + value.text);
      js.push("return " + value.js);
      continue;
    }
    throw new Error("unmodelled opcode 0x" + op.toString(16) + " in the mixer module");
  }
  return { steps, js };
}

/*
 * Hold the rendered steps against the module they came from.
 *
 * The steps are the part of this file a client is written against, so they are
 * run — as JavaScript, in 32-bit wrapping arithmetic — against the real
 * WebAssembly export over a spread of seeds and indices. A disassembly that
 * drifts from the module fails the extraction instead of being published.
 */
function checkMixerSteps(wasm, js) {
  const mixByte = new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports.m;
  if (typeof mixByte !== "function") throw new Error("the mixer module exports no function `m`");

  const byte = new Function("seed", "i", "let x;\n" + js.join(";\n") + ";");

  for (const seed of [0, 1, 7, 0x7fffffff, 0x80000000, 0xffffffff, 1015555175]) {
    for (const i of [0, 1, 2, 15, 16, 31, 255, 4096]) {
      const want = mixByte(seed | 0, i) >>> 0;
      const got = byte(seed | 0, i) >>> 0;
      if (want !== got) {
        throw new Error(
          "the mixer disassembly disagrees with the module: byte(" + seed + ", " + i + ") " +
          "is " + want + " but the steps give " + got
        );
      }
    }
  }
}

/* ---- output --------------------------------------------------------------- */

const configFromBundle = extractConfig();
const itemGroups = tableBy('name:"spikes"');
const items = tableBy('name:"apple"', { [itemGroups.name]: itemGroups.value });

const drivers = {
  extractedAt: new Date().toISOString(),
  source: SRC,
  deobfuscation: wire.source().stats,
  protocol: extractProtocol(),
  config: configFromBundle.config,
  // Config keys the bundle leaves to the page, so there is no value here to
  // hold the client's against.
  configUndetermined: configFromBundle.undetermined,
  itemGroups: itemGroups.value,
  projectiles: tableBy('src:"arrow_1"').value,
  weapons: tableBy('name:"tool hammer"').value,
  items: items.value,
  hats: tableBy('name:"Moo Cap"').value,
  accessories: tableBy('name:"Snowball"').value,
};

const outPath = path.join(ROOT, "drivers/game-drivers.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(drivers, null, 2));

console.log("wrote", path.relative(ROOT, outPath));
for (const k of ["itemGroups", "projectiles", "weapons", "items", "hats", "accessories"]) {
  console.log(`  ${k.padEnd(12)} ${drivers[k].length} entries`);
}
console.log(
  "  config       " + Object.keys(drivers.config).length + " keys" +
  (drivers.configUndetermined.length
    ? " (+" + drivers.configUndetermined.length + " the page decides: " + drivers.configUndetermined.join(", ") + ")"
    : "")
);
const p = drivers.protocol;
console.log(
  "  protocol     sig=" + p.signatureBytes +
  " mode=" + p.encryptedMode +
  " c2s=" + p.c2sAlphabet.length + "/" + p.c2sLegacyCount +
  " s2c=" + p.s2cAlphabet.length + "/" + p.s2cLegacyCount +
  " seq=" + p.framesCarrySequence
);
console.log("  mixer        build=" + p.keyMixer.buildId + " salt=" + p.keyMixer.buildSalt);
