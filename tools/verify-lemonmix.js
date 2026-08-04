#!/usr/bin/env node
/*
 * verify-lemonmix.js
 *
 * Checks LemonMod_Mix.user.js against the shipped game bundle.
 *
 * The interesting failure mode for this build is not a syntax error, it is a
 * packet that encodes cleanly under a name the server has never heard of. So
 * rather than eyeballing the tables, this lifts the real transport out of
 * src/game_index.js, runs it next to the build's translation layer, and
 * asserts that a packet LemonMod sends comes out as the same bytes the
 * vanilla client would have produced.
 *
 *   node tools/verify-lemonmix.js [path/to/LemonMod_Mix.user.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "LemonMod_Mix.user.js");

const client = fs.readFileSync(CLIENT_PATH, "utf8");
const game = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8"));
const indexSrc = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8").split(/\r?\n/);
const vendorSrc = fs.readFileSync(path.join(ROOT, "src/game_vendor.js"), "utf8").split(/\r?\n/);

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);
const note = (m) => notes.push(m);

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("game   :", game.source.index, "+", game.source.vendor);
console.log("");

/* ------------------------------------------------------------------ *
 * 1. Transport constants
 * ------------------------------------------------------------------ */
{
  const p = game.protocol;
  const want = [
    [`signature width ${p.signatureBytes}`, new RegExp("\\bjt\\s*=\\s*" + p.signatureBytes + "\\b")],
    [`encrypted mode ${p.encryptedMode}`, new RegExp("\\bHt\\s*=\\s*" + p.encryptedMode + "\\b")],
    [`table salt ${p.tableSalt}`, new RegExp("\\bIo\\s*=\\s*" + p.tableSalt + "\\b")],
    ["c2s alphabet", new RegExp(p.c2sAlphabet.map((c) => `"${c}"`).join(",\\s*"))],
    ["s2c alphabet", new RegExp(p.s2cAlphabet.map((c) => `"${c}"`).join(",\\s*"))],
  ];
  for (const [label, re] of want) {
    if (!re.test(client)) fail(`protocol: build does not carry ${label}`);
  }
  note(`protocol: checked ${want.length} transport constants`);
}

/* ------------------------------------------------------------------ *
 * 2. Load the build's translation layer
 *
 * Only the prelude is evaluated — the mod body below it wants a live page.
 * The prelude ends where the deobfuscated LemonMod source begins.
 * ------------------------------------------------------------------ */
const BODY_MARKER = "\n/* ==================================================================== *\n * LemonMod v3.0";
const bodyAt = client.indexOf(" * LemonMod v3.0\n *\n * Deobfuscated from the shipped script");
if (bodyAt === -1) throw new Error("could not find where the mod body starts in the build");
const preludeEnd = client.lastIndexOf("/* =====", bodyAt);
let prelude = client.slice(client.indexOf("(function() {") + "(function() {".length, preludeEnd);

/* The injector installs a MutationObserver and claims the page's bundle; none
 * of that belongs in a headless check. */
const injectorAt = prelude.indexOf("const Injector = new class");
if (injectorAt === -1) throw new Error("could not find the injector in the prelude");
const preludeCore = prelude.slice(0, injectorAt);

const sandbox = {
  console: { log() {}, warn() {}, error() {} },
  setInterval() { return 0; },
  clearInterval() {},
  setTimeout() { return 0; },
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  Image: function () {},
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    readyState: "complete",
  },
  XMLHttpRequest: function () {},
  MutationObserver: function () { this.observe = () => {}; },
  HTMLScriptElement: function () {},
  HTMLLinkElement: function () {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(preludeCore + "\n;globalThis.__LemonMix = LemonMix; globalThis.__msgpack = msgpack;", sandbox);
} catch (e) {
  fail("prelude: failed to evaluate - " + e.message);
}
const LemonMix = sandbox.__LemonMix;
const msgpack = sandbox.__msgpack;

if (!LemonMix) {
  console.log(problems.map((p) => "FAIL  " + p).join("\n"));
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * 3. Packet-name coverage
 *
 * Every name the build can emit has to exist in the game's c2s alphabet, and
 * every name the build claims to understand has to exist in the game's s2c
 * dispatch table. A name that is merely plausible encodes fine and then
 * vanishes at the server.
 * ------------------------------------------------------------------ */
{
  const c2s = new Set(game.protocol.c2sAlphabet);
  for (const [legacy, current] of Object.entries(LemonMix.C2S)) {
    if (!c2s.has(current)) fail(`c2s: "${legacy}" maps to "${current}", which is not in the game's c2s alphabet`);
  }
  const mapped = new Set(Object.values(LemonMix.C2S));
  const unmapped = [...c2s].filter((n) => !mapped.has(n));
  note(`c2s: ${mapped.size}/${c2s.size} packets mapped` + (unmapped.length ? `; unused by the mod: ${unmapped.join(", ")}` : ""));

  /* The s2c handler map is the authority on which names the server sends. */
  const at = indexSrc.findIndex((l) => /^\s*A: \w+,$/.test(l));
  if (at === -1) {
    fail("s2c: could not find the game's dispatch table");
  } else {
    const names = new Set();
    for (let i = at; i < at + 45; i++) {
      const m = /^\s*"?([A-Za-z0-9]+)"?:\s*[\w$]+,?$/.exec(indexSrc[i] || "");
      if (!m) break;
      names.add(m[1]);
    }
    for (const [legacy, current] of Object.entries(LemonMix.S2C)) {
      if (!names.has(current)) fail(`s2c: "${legacy}" maps to "${current}", which the game does not dispatch`);
    }
    note(`s2c: ${Object.keys(LemonMix.S2C).length} names mapped out of ${names.size} the game dispatches`);
  }

  /* Both directions have to round-trip, or a packet gets translated into a
   * different one on the way back. */
  for (const [legacy, current] of Object.entries(LemonMix.S2C)) {
    if (LemonMix.S2C_LEGACY[current] !== legacy) fail(`s2c: "${current}" does not translate back to "${legacy}"`);
  }
  for (const [legacy, current] of Object.entries(LemonMix.C2S)) {
    if (LemonMix.C2S_LEGACY[current] !== legacy) fail(`c2s: "${current}" does not translate back to "${legacy}"`);
  }
}

/* ------------------------------------------------------------------ *
 * 4. Live frame test
 *
 * The game's own transport, running for real, fed by the build's send path.
 * ------------------------------------------------------------------ */
{
  const codecEnd = vendorSrc.findIndex((l, i) => i > 1400 && l === "}();");
  const codec = vendorSrc.slice(0, codecEnd + 1).join("\n");

  /* `function Co` through the closing brace of the `O` object: the seeded
   * permutation, the HMAC, and the send/receive path that uses them. */
  const cryptoFirst = indexSrc.findIndex((l) => l === "function Co(e) {");
  const netFirst = indexSrc.findIndex((l) => l === "const O = {");
  const netLast = indexSrc.findIndex((l, i) => i > netFirst && l === "};");
  if (cryptoFirst === -1 || netFirst === -1 || netLast === -1) {
    fail("frames: could not slice the game's transport out of src/game_index.js");
  } else {
    const transport = indexSrc.slice(cryptoFirst, netLast + 1).join("\n");

    /* Everything the slice reads from the rest of the bundle, supplied here so
     * the transport itself stays byte-identical to what ships. */
    const framesOut = [];
    const preamble = [
      /* The codec is scoped so its Decoder (`kn`) does not collide with the
       * bundle's WebSocket alias of the same name. */
      "(function () {\n" + codec + "\nglobalThis.__mpEncoder = yn; globalThis.__mpDecoder = kn;\n})();",
      "const rs = globalThis.__mpEncoder, cs = globalThis.__mpDecoder;",
      `const Io = ${game.protocol.tableSalt};`,
      `const jt = ${game.protocol.signatureBytes};`,
      `const Ht = ${game.protocol.encryptedMode};`,
      `const bo = ${JSON.stringify(game.protocol.c2sAlphabet)};`,
      `const To = ${JSON.stringify(game.protocol.s2cAlphabet)};`,
      "const Ri = function (bytes) { globalThis.__frames.push(bytes); };",
      "const kn = function (url) { this.url = url; };",
    ].join("\n");

    const box = {
      console: { warn() {}, error() {} },
      Math,
      Date,
      Uint8Array,
      Uint32Array,
      Int32Array,
      DataView,
      ArrayBuffer,
      Array,
      Object,
      Number,
      String,
      Symbol,
      Promise,
      TextEncoder,
      TextDecoder,
      RangeError,
      TypeError,
      Error,
      parseInt,
      process: { env: {} },
      __frames: framesOut,
    };
    box.globalThis = box;
    vm.createContext(box);
    try {
      vm.runInContext(
        preamble + "\n" + transport +
          "\n;globalThis.__O = O; globalThis.__Po = Po; globalThis.__Ro = Ro;" +
          " globalThis.__setZ = v => { Z = v; };" +
          " globalThis.__enc = new rs(); globalThis.__dec = new cs();",
        box
      );
    } catch (e) {
      fail("frames: could not run the game's transport - " + e.message);
    }

    if (box.__O) {
      const seed = 0x5eed1234;
      const keyHex = "0123456789abcdef0123456789abcdef";
      const tables = box.__Po(seed >>> 0);
      const key = box.__Ro(keyHex);

      /* The crypto state the game would have built from io-init, installed on
       * both sides: the real transport, and the build's view of it. */
      const state = { mode: game.protocol.encryptedMode, key, tables, seq: 0 };
      box.__setZ(state);
      box.__O.socket = {};
      box.__O.connected = true;

      LemonMix._net = box.__O;
      LemonMix._crypto = state;

      /* Each case goes through LemonMix.send, into the game's own io.send,
       * and out as a real frame. The frame is then taken apart and compared
       * against what the vanilla client would have produced for the same
       * action. */
      const cases = [
        [["ch", ["hello"]], "6", ["hello"]],
        [["sp", [{ name: "x", moofoll: 1, skin: 0 }]], "M", [{ name: "x", moofoll: 1, skin: 0 }]],
        [["13c", [1, 7, 0]], "c", [1, 7, 0]],
        [["5", [3, true]], "z", [3, true]],
        [["c", [1, null]], "F", [1, null]],
        [["9", [null]], "N", []],
        [["33", [1.25]], "9", [1.25]],
        [["2", [0.5]], "D", [0.5]],
        [["6", [17]], "H", [17]],
      ];
      let expectedSeq = 0;
      for (const [packet, wantName, wantArgs] of cases) {
        framesOut.length = 0;
        LemonMix.send(packet);
        const frame = framesOut[0];
        if (!frame) {
          fail(`frames: ${JSON.stringify(packet[0])} produced no frame`);
          continue;
        }
        expectedSeq++;
        const payload = frame.slice(game.protocol.signatureBytes);
        const decoded = box.__dec.decode(payload);
        const wantOpcode = tables.c2s.enc[wantName];
        if (decoded[0] !== wantOpcode) {
          fail(`frames: "${packet[0]}" went out as opcode ${decoded[0]}, the table says ${wantOpcode} for "${wantName}"`);
        }
        if (JSON.stringify(decoded[1]) !== JSON.stringify(wantArgs)) {
          fail(`frames: "${packet[0]}" args ${JSON.stringify(decoded[1])}, expected ${JSON.stringify(wantArgs)}`);
        }
        if (decoded[2] !== expectedSeq) {
          fail(`frames: "${packet[0]}" seq ${decoded[2]}, expected ${expectedSeq}`);
        }
        if (frame.length !== game.protocol.signatureBytes + payload.length) {
          fail(`frames: "${packet[0]}" frame length does not match signature + payload`);
        }
      }
      note(`frames: ${cases.length} packets framed by the game's own io.send and decoded back`);

      /* One sequence counter for the connection, shared by the mod and the
       * game. Two would desync. */
      framesOut.length = 0;
      box.__O.send("D", 1);
      LemonMix.send(["2", [2]]);
      const seqs = framesOut.map((f) => box.__dec.decode(f.slice(game.protocol.signatureBytes))[2]);
      if (seqs.length !== 2 || seqs[1] !== seqs[0] + 1) {
        fail(`frames: mod and game do not share one sequence counter (saw ${JSON.stringify(seqs)})`);
      } else {
        note("frames: the mod and the game increment one shared sequence counter");
      }

      /* The bot path builds its own frames. Check one all the way to bytes. */
      const botFrames = [];
      const botSocket = {
        readyState: 1,
        binaryType: "",
        send: (bytes) => botFrames.push(bytes),
      };
      LemonMix.Bot.wrap(botSocket);
      LemonMix.Bot.receive(botSocket, {
        data: box.__enc.encode(["io-init", [1, seed, keyHex, 1]]),
      });
      if (!botSocket._lemonCrypto) {
        fail("frames: the bot socket did not pick up crypto state from io-init");
      } else {
        botSocket.emit(["ch", ["hi"]]);
        const frame = botFrames[0];
        if (!frame) fail("frames: the bot socket produced no frame");
        else {
          const sig = frame.slice(0, game.protocol.signatureBytes);
          const payload = frame.slice(game.protocol.signatureBytes);
          const decoded = box.__dec.decode(payload);
          const wantOpcode = tables.c2s.enc["6"];
          if (decoded[0] !== wantOpcode) {
            fail(`frames: bot chat used opcode ${decoded[0]}, the table says ${wantOpcode}`);
          }
          if (JSON.stringify(decoded[1]) !== JSON.stringify(["hi"])) {
            fail(`frames: bot chat args ${JSON.stringify(decoded[1])}, expected ["hi"]`);
          }
          if (decoded[2] !== 1) fail(`frames: bot chat seq ${decoded[2]}, expected 1`);
          if (sig.length !== game.protocol.signatureBytes) {
            fail(`frames: bot frame carries ${sig.length} signature bytes, expected ${game.protocol.signatureBytes}`);
          }
          note("frames: bot frame signed and framed to the game's layout");
        }
      }

      /* Inbound translation, driven the way the packetIn rewrite drives it. */
      const seen = [];
      LemonMix.onPacket((p) => seen.push(p));
      LemonMix._in("a", [[]]);
      LemonMix._in("O", [12, 80]);
      LemonMix._in("6", [12, "gg"]);
      if (seen.length !== 3) fail(`inbound: ${seen.length} packets delivered, expected 3`);
      else {
        const got = seen.map((p) => p.type).join(",");
        if (got !== "33,h,ch") fail(`inbound: names came through as ${got}, expected 33,h,ch`);
      }
      note("inbound: dispatch names translated back to the ones the mod switches on");
    }
  }
}

/* ------------------------------------------------------------------ *
 * 4b. The rewritten bundle
 *
 * check-hooks.js reports which hooks bind. This one runs the whole rewrite
 * and checks the result is still parseable JavaScript with every injection
 * point present — a replacement string that binds but produces a syntax
 * error would take the entire game down, silently, at load.
 * ------------------------------------------------------------------ */
{
  let minify;
  try {
    ({ minify_sync: minify } = require("terser"));
  } catch (e) {
    note("bundle: skipped the rewrite check (needs: npm i --no-save terser)");
  }
  if (minify) {
    const sliceBlock = (start, end) => {
      const a = client.indexOf(start);
      const b = client.indexOf(end, a);
      if (a === -1 || b === -1) throw new Error("could not slice " + start);
      return client.slice(a, b + end.length);
    };
    const engine =
      sliceBlock("class Regexer {", "const Regexer_default = Regexer;") + "\n" +
      sliceBlock("const formatCode2 = code => {", "const formatCode_default = formatCode2;");

    const minified = minify(fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8"), {
      module: true,
      compress: false,
      mangle: false,
      format: { comments: false },
    });
    if (minified.error) throw minified.error;

    const box = { Logger: { error: (m) => fail("bundle: " + m), test() {} }, console: { log() {} }, window: {} };
    vm.createContext(box);
    vm.runInContext(engine, box);
    let rewritten;
    try {
      rewritten = vm.runInContext("formatCode2(__bundle)", Object.assign(box, { __bundle: minified.code }));
    } catch (e) {
      fail("bundle: the rewrite threw - " + e.message);
    }
    if (rewritten) {
      try {
        new vm.Script("(async function(){" + rewritten.replace(/^import[^\n;]*;?/m, "") + "})();");
        note("bundle: rewritten bundle still parses");
      } catch (e) {
        fail("bundle: rewritten bundle does not parse - " + e.message);
      }
      const marks = [
        ["exposeGameNet", "LemonMix._net={socket"],
        ["exposeGameCrypto", "LemonMix._crypto={mode"],
        ["packetIn", "LemonMix._in("],
        ["packetOut", "LemonMix._out("],
        ["captureTurnstile", "LemonMix._turnstile="],
        ["playerOverlay", "LemonMix._Visuals._draw("],
      ];
      for (const [name, mark] of marks) {
        if (!rewritten.includes(mark)) fail(`bundle: ${name} bound but injected nothing`);
      }
      note(`bundle: ${marks.length} injection points present in the rewritten bundle`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 5. Visuals data
 * ------------------------------------------------------------------ */
{
  const mine = LemonMix.Weapons || [];
  if (mine.length !== game.weapons.length) {
    fail(`weapons: build carries ${mine.length} entries, game has ${game.weapons.length}`);
  }
  for (let i = 0; i < Math.min(mine.length, game.weapons.length); i++) {
    if (mine[i].name !== game.weapons[i].name) {
      fail(`weapons: index ${i} is "${mine[i].name}", game has "${game.weapons[i].name}"`);
    }
    if (mine[i].speed !== game.weapons[i].speed) {
      fail(`weapons: "${game.weapons[i].name}" speed=${mine[i].speed}, game has ${game.weapons[i].speed}`);
    }
  }
  note(`weapons: ${mine.length} reload speeds match the shipped table`);
}

/* ------------------------------------------------------------------ *
 * 6. Nothing calls home
 * ------------------------------------------------------------------ */
{
  const banned = [
    ["crCheck.php", "kill-switch check"],
    ["cr.php", "remote-eval payload"],
    ["latest.php", "version ping"],
    ["api/death", "death telemetry"],
    ["ksw2-center.glitch.me", "Visuals beacon"],
    ["bundle/latest/bundle.user.js", "Visuals download"],
    ["LemonModStyleSheetCSSRaw", "remote stylesheet"],
    ["lemonmod.com/sound/", "remote audio"],
    ["lemonmod.com/img/", "remote images"],
    ["lemonmod.com/cursor.cur", "remote cursor"],
  ];
  /* Comments are stripped first — the header documents what was removed, and
   * naming a path there is not the same as calling it. */
  const codeOnly = client
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const [needle, what] of banned) {
    if (codeOnly.includes(needle)) fail(`callback: build still references ${what} (${needle})`);
  }
  note(`callbacks: checked ${banned.length} call-home paths, none present`);
}

console.log(notes.map((n) => "note  " + n).join("\n"));
console.log("");

if (problems.length) {
  console.log(problems.map((p) => "FAIL  " + p).join("\n"));
  console.log(`\n${problems.length} problem(s).`);
  process.exit(1);
}

console.log("OK - build agrees with the shipped game bundle.");
