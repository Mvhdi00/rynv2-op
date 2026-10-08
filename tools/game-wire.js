/*
 * game-wire.js
 *
 * The game's own transport, loaded out of the shipped bundle: the names its
 * pieces go by on this build, and the pieces themselves, running.
 *
 * Everything else in tools/ reads the protocol through here, so the extracted
 * drivers and the wire check cannot disagree about what they are looking at.
 *
 * Nothing is looked up by name — the minifier renames all of it between builds.
 * The fixed point is the session object the socket is driven from, assembled in
 * the `io-init` handler:
 *
 *   s.socketId = k[0];
 *   const g = k[3], b = s.pinned = (k[4] === 1);
 *   if (g === MODE) {
 *     const B = (k[1] >>> 0), D = hex(k[2]), V = b ? mixKey(D, B) : D;
 *     pe = { mode: MODE, key: V, tables: b ? tables(B, BUILD_SALT) : tables(B),
 *            seq: 0, mask: b ? maskFrom(V) : null, received: 0 };
 *   }
 *
 * That one match names the mode constant, the hex reader, the key mixer, the
 * table builder, the build-salt binding and the mask splitter. The send and
 * receive paths name the rest:
 *
 *   receive:  pe && pe.mask && applyMask(frame, maskIn(pe.mask.s2c, ++pe.received))
 *   send:     sig = sign(pe.key, payload), frame = new Uint8Array(SIG + payload.length)
 *             pe.mask && applyMask(frame.subarray(SIG), maskVal(pe.mask.c2s, sig))
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { decode, assertParses, blockEnd } = require("./deobfuscate.js");

const ROOT = path.resolve(__dirname, "..");

const SOURCES = {
  index: "src/game_index.js",
  vendor: "src/game_vendor.js",
  protocol: "src/game_protocol.js",
};

/* A minified name may contain `$`, a group reference in a replacement and a
 * literal anywhere in a pattern — escape it before interpolating. */
const esc = (name) => name.replace(/\$/g, "\\$");

let cachedSource = null;

/* The three shipped assets, with the two obfuscated ones decoded. Nothing is
 * read out of a rewrite the parser rejects: a pass that landed in the middle of
 * something it misread would hand back something that looks plausible and is
 * wrong. */
function source() {
  if (cachedSource) return cachedSource;

  const vendor = fs.readFileSync(path.join(ROOT, SOURCES.vendor), "utf8");
  const index = decode(fs.readFileSync(path.join(ROOT, SOURCES.index), "utf8"));
  const protocol = decode(fs.readFileSync(path.join(ROOT, SOURCES.protocol), "utf8"));

  assertParses(index.code, SOURCES.index);
  assertParses(protocol.code, SOURCES.protocol);

  cachedSource = {
    files: SOURCES,
    index: index.code,
    protocol: protocol.code,
    vendor,
    stats: { index: index.stats, protocol: protocol.stats },
  };
  return cachedSource;
}

let cachedNames = null;

/* What each piece of the transport is called on this build. */
function names() {
  if (cachedNames) return cachedNames;
  const INDEX = source().index;

  const match = (re, what) => {
    const m = INDEX.match(re);
    if (!m) throw new Error("protocol site not found in game bundle: " + what);
    return m;
  };

  const session = match(
    /\{mode:([\w$]+),key:([\w$]+),tables:([\w$]+)\?([\w$]+)\(([\w$]+),([\w$]+)\):\4\(\5\),seq:0,mask:\3\?([\w$]+)\(\2\):null,received:0\}/,
    "session assembly"
  );
  const [, mode, keyVar, pinnedVar, tables, seedVar, buildSalt, maskFrom] = session;

  const keys = match(
    new RegExp(
      "const " + esc(seedVar) + "=\\(k\\[(\\d+)\\]>>>0\\),([\\w$]+)=([\\w$]+)\\(k\\[(\\d+)\\]\\)," +
      esc(keyVar) + "=" + esc(pinnedVar) + "\\?([\\w$]+)\\(\\2," + esc(seedVar) + "\\):\\2;"
    ),
    "io-init key fields"
  );
  const flags = match(
    new RegExp(
      "const ([\\w$]+)=k\\[(\\d+)\\]," + esc(pinnedVar) +
      "=\\w+\\[\"pinned\"\\]=\\(k\\[(\\d+)\\]===\\(?(\\d+)\\)?\\)"
    ),
    "io-init mode and pinned flags"
  );
  const socketIdField = Number(match(/\w+\["socketId"\]=k\[(\d+)\];const/, "io-init socket id")[1]);

  const ioInit = [];
  ioInit[socketIdField] = "socketId";
  ioInit[Number(keys[1])] = "seed";
  ioInit[Number(keys[4])] = "keyHex";
  ioInit[Number(flags[2])] = "mode";
  ioInit[Number(flags[3])] = "pinned";

  const inbound = match(
    /&&([\w$]+)\(\w+,([\w$]+)\(\w+\["mask"\]\["s2c"\],\(?\+\+\w+\["received"\]\)?\)\)/,
    "inbound mask"
  );
  const outbound = match(
    /,([\w$]+)=([\w$]+)\(\w+\["key"\],([\w$]+)\),([\w$]+)=new Uint8Array\(\(?([\w$]+)\+\3\["length"\]\)?\)/,
    "frame signing"
  );
  const maskVal = match(
    /\w+\["subarray"\]\([\w$]+\),([\w$]+)\(\w+\["mask"\]\["c2s"\],[\w$]+\)\)/,
    "outbound mask"
  )[1];

  /* The table builder's body names the legacy salt and both alphabets, each
   * with the length its pre-2025 prefix had. */
  const tablesSrc = fnBody(tables, "opcode table builder");
  const legacySalt = match(/s=o\?([\w$]+):t/, "legacy table salt binding")[1];
  const alphabets = tablesSrc.match(
    /c2s:[\w$]+\(\(?o\?([\w$]+)\["slice"\]\(0,([\w$]+)\)[^,]*,\s*a\),s2c:[\w$]+\(o\?([\w$]+)\["slice"\]\(0,([\w$]+)\)/
  );
  if (!alphabets) throw new Error("opcode alphabets not named by the table builder");

  const build = match(
    /\["indexOf"\]\("\?"\)[^;]{0,60}?\+"([\w$]+)="\)?\+([\w$]+)/,
    "build id query parameter"
  );

  cachedNames = {
    // functions
    tables,
    maskFrom,
    applyMask: inbound[1],
    maskIn: inbound[2],
    maskVal,
    sign: outbound[2],
    hex: keys[3],
    mixKey: keys[5],
    // constants
    mode,
    sigBytes: outbound[5],
    legacySalt,
    buildSalt,
    c2sAlphabet: alphabets[1],
    c2sLegacyCount: alphabets[2],
    s2cAlphabet: alphabets[3],
    s2cLegacyCount: alphabets[4],
    buildId: build[2],
    // shape
    ioInit,
    pinnedValue: Number(flags[4]),
    buildIdQueryParam: build[1],
    framesCarrySequence: /\+\+\w+\["seq"\],[\w$]+=\w+\["encode"\]\(\[[\w$]+,[\w$]+,[\w$]+\]\)/.test(INDEX),
  };
  return cachedNames;
}

/* The body of `function <name>(…){…}`. */
function fnBody(name, what) {
  const INDEX = source().index;
  const at = INDEX.indexOf("function " + name + "(");
  if (at === -1) throw new Error("protocol helper not found: " + what + " (" + name + ") ");
  return INDEX.slice(at, blockEnd(INDEX, at));
}

/* Where the bundle declares `<name>`, as a [start, end) span covering the whole
 * statement, so slicing it out leaves something evaluable. A minified name may
 * start with `$`, which is not a word character, so the boundaries are spelt
 * out rather than left to `\b`. */
function declSpan(name, text) {
  const INDEX = text || source().index;
  const at = INDEX.indexOf("function " + name + "(");
  if (at !== -1) return [at, blockEnd(INDEX, at)];

  /* A const run declares several names at once — `const $f=1,Uo=6;` — so find
   * the assignment, then the statement it belongs to. */
  const assign = new RegExp("(?<![\\w$.])" + esc(name) + "\\s*=(?!=)", "g");
  let m;
  while ((m = assign.exec(INDEX))) {
    let start = m.index;
    while (start > 0 && !";{}".includes(INDEX[start - 1])) start--;
    if (!/^\s*(?:const|let|var)\s/.test(INDEX.slice(start, m.index))) continue;

    // The statement runs to the `;` that closes it, brackets and strings
    // skipped.
    let depth = 0, quote = null;
    for (let i = m.index; i < INDEX.length; i++) {
      const c = INDEX[i];
      if (quote) {
        if (c === "\\") { i++; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth--;
      else if (c === ";" && depth === 0) return [start, i + 1];
    }
  }
  throw new Error("declaration not found in game bundle: " + name);
}

const WIRE_EXPORTS = [
  "tables", "maskFrom", "applyMask", "maskIn", "maskVal", "sign", "hex",
  "mode", "sigBytes", "legacySalt", "c2sAlphabet", "c2sLegacyCount",
  "s2cAlphabet", "s2cLegacyCount",
];

/*
 * Evaluate the game's transport out of one rewrite of the bundle.
 *
 * The protocol code sits in one stretch, so the span covering every
 * declaration it needs is sliced out and run on its own. A reference the span
 * does not cover widens it and the slice is retried, which is what keeps this
 * working when the bundle is laid out differently.
 */
function evaluate(INDEX, n) {
  let lo = Infinity, hi = -Infinity;
  for (const name of WIRE_EXPORTS.map((k) => n[k])) {
    const [a, b] = declSpan(name, INDEX);
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }

  const exports =
    ";globalThis.__wire={" + WIRE_EXPORTS.map((k) => k + ":" + n[k]).join(",") + "};";

  let lastError = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const sandbox = {
      Math, parseInt, String, Array, JSON, decodeURIComponent,
      Uint8Array, Uint32Array, Int32Array, DataView, ArrayBuffer,
    };
    try {
      vm.runInNewContext(INDEX.slice(lo, hi) + exports, sandbox);
      return sandbox.__wire;
    } catch (e) {
      lastError = e;
      const missing = /^(\w[\w$]*) is not defined$/.exec(e.message);
      if (!missing) break;
      const [a, b] = declSpan(missing[1], INDEX);
      if (a >= lo && b <= hi) break; // already covered: not a span problem
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
  }
  throw new Error("could not evaluate the game's transport: " + (lastError && lastError.message));
}

let cachedLive = null;

/*
 * The game's transport, running — and checked against itself.
 *
 * What is returned comes out of the fully rewritten bundle, which is readable
 * but is also four textual passes away from what the game ships. A pass that
 * misreads something does not have to produce a syntax error: the first
 * version of the operator-unwrapper substituted a wrapper's parameters one
 * after another, so `o >>> s` called as `(s, 7)` came out as `7 >>> 7` — valid
 * code, in the middle of the PRNG the opcode tables are shuffled with, and the
 * reference everything else here is measured against.
 *
 * So the transport is evaluated twice, once from the rewrite that stops before
 * the unwrapper, and the two are run against each other. A rewrite that
 * changed behaviour fails here rather than being published as ground truth.
 */
function live() {
  if (cachedLive) return cachedLive;
  const n = names();
  const full = evaluate(source().index, n);
  const plain = evaluate(sourceWithoutUnwrap(), n);

  agree(full, plain);

  cachedLive = full;
  return cachedLive;
}

let cachedPlain = null;

function sourceWithoutUnwrap() {
  if (cachedPlain) return cachedPlain;
  const raw = fs.readFileSync(path.join(ROOT, SOURCES.index), "utf8");
  cachedPlain = decode(raw, { unwrap: false }).code;
  return cachedPlain;
}

/* Hold two rewrites of the same transport against each other. */
function agree(a, b) {
  const hex = (bytes) => Buffer.from(bytes).toString("hex");
  const complain = (what, x, y) => {
    throw new Error(
      "the deobfuscated bundle does not behave like the bundle it came from: " +
      what + " gives " + JSON.stringify(x) + " after the operator pass and " +
      JSON.stringify(y) + " before it"
    );
  };
  const check = (what, x, y) => {
    if (JSON.stringify(x) !== JSON.stringify(y)) complain(what, x, y);
  };

  for (const k of ["mode", "sigBytes", "legacySalt", "c2sLegacyCount", "s2cLegacyCount"]) {
    check(k, a[k], b[k]);
  }
  check("c2sAlphabet", a.c2sAlphabet, b.c2sAlphabet);
  check("s2cAlphabet", a.s2cAlphabet, b.s2cAlphabet);

  const keyHex = "00112233445566778899aabbccddeeff";
  for (const seed of [0, 1, 0x7fffffff, 0xffffffff, 1015555175]) {
    for (const salt of [null, 1, 1015555175]) {
      const x = a.tables(seed, salt), y = b.tables(seed, salt);
      check("tables(" + seed + ", " + salt + ").c2s", x.c2s, y.c2s);
      check("tables(" + seed + ", " + salt + ").s2c", x.s2c, y.s2c);
    }
    const ka = a.hex(keyHex), kb = b.hex(keyHex);
    check("hex()", hex(ka), hex(kb));
    check("maskFrom()", a.maskFrom(ka), b.maskFrom(kb));
    check("maskIn(" + seed + ")", a.maskIn(seed, 3), b.maskIn(seed, 3));

    const sig = new Uint8Array([1, 2, 3, 4, 5, 6]);
    check("maskVal(" + seed + ")", a.maskVal(seed, sig), b.maskVal(seed, sig));

    for (const len of [0, 3, 40, 64, 120]) {
      const payload = new Uint8Array(len).map((_, i) => (i * 37 + seed) & 255);
      check("sign(" + len + " bytes)", hex(a.sign(ka, payload)), hex(b.sign(kb, payload)));

      const pa = payload.slice(), pb = payload.slice();
      a.applyMask(pa, seed);
      b.applyMask(pb, seed);
      check("applyMask(" + len + " bytes, " + seed + ")", hex(pa), hex(pb));
    }
  }
}

let cachedMixer = null;

/* `moomoo-protocol`'s three exports. mixKey XORs the server's key with a byte
 * stream from a one-function WebAssembly module carried in the file as base64. */
function mixer() {
  if (cachedMixer) return cachedMixer;
  const PROTOCOL = source().protocol;

  const pick = (re, what) => {
    const m = PROTOCOL.match(re);
    if (!m) throw new Error(what + " not found in the protocol module");
    return m[1];
  };
  const buildId = pick(/BUILD_ID\s*=\s*"([^"]*)"/, "BUILD_ID");
  const buildSalt = Number(pick(/BUILD_SALT\s*=\s*(\d+)/, "BUILD_SALT"));
  const base64 = pick(/MIX\s*=\s*"([A-Za-z0-9+/=]+)"/, "the mixer WebAssembly module");

  const wasm = Buffer.from(base64, "base64");
  const byte = new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports.m;
  if (typeof byte !== "function") throw new Error("the mixer module exports no function `m`");

  cachedMixer = {
    buildId,
    buildSalt,
    base64,
    wasm,
    byte,
    mixKey(key, seed) {
      const out = new Uint8Array(key.length);
      for (let i = 0; i < key.length; i++) out[i] = key[i] ^ byte(seed | 0, i);
      return out;
    },
  };
  return cachedMixer;
}

module.exports = { SOURCES, source, names, fnBody, declSpan, live, mixer, esc };
