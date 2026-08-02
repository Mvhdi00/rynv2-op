#!/usr/bin/env node
/*
 * verify-lemon.js
 *
 * Checks LemonMod_Fixed.user.js against the game.
 *
 *   node tools/verify-lemon.js [LemonMod_Fixed.user.js]
 *
 * Six passes:
 *
 *   1. the userscript header and the shape of the build;
 *   2. the bridge's opcode tables against drivers/game-drivers.json - every
 *      opcode the game can send or receive accounted for exactly once, no two
 *      sharing a name, and the ones LemonMod's handlers switch on landing on
 *      the right names;
 *   3. a round trip through the bridge, in a sandbox: a game frame reaching
 *      LemonMod's send hook as an old-style frame and leaving validly signed,
 *      permuted and sequenced, a mod frame doing the same, and a server frame
 *      reaching the mod's message listener under the name it switches on;
 *   4. what a real hook does - sending from inside the hook, swallowing a
 *      frame, reading through onmessage on a bot socket, a second connection;
 *   5. the hats, accessories and upgrade slots the mod names by id;
 *   6. the visuals overlay - the reload model off real frames, both directions
 *      of the shame counter, and the nametag drawing it hangs off.
 *
 * Passes 3 and 4 build and check their frames with the bundle's *own* crypto,
 * lifted out of src/game_index.js rather than reimplemented here, so the test
 * cannot agree with the bridge by sharing its mistakes.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const DRIVERS = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8"));
const GAME = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const BUILD = path.resolve(process.argv[2] || path.join(ROOT, "LemonMod_Fixed.user.js"));

const problems = [];
const notes = [];

function check(ok, message) {
  if (!ok) problems.push(message);
  return ok;
}

/* ------------------------------------------------------------------ *
 * A browser small enough for the bridge and no smaller
 * ------------------------------------------------------------------ */

const BROWSER_SHIM = `
  var __listeners = new WeakMap();
  var EventTargetShim = class {
    addEventListener(type, fn) {
      let byType = __listeners.get(this);
      if (!byType) { byType = {}; __listeners.set(this, byType); }
      (byType[type] = byType[type] || []).push(fn);
    }
    removeEventListener() {}
    dispatchEvent(event) {
      const byType = __listeners.get(this) || {};
      for (const fn of (byType[event.type] || []).slice()) fn.call(this, event);
      return true;
    }
  };
  var WebSocketShim = class extends EventTargetShim {
    constructor(url) { super(); this.url = url; this.readyState = 1; }
    send(data) { __wire.push(data); }
  };
  WebSocketShim.CONNECTING = 0;
  WebSocketShim.OPEN = 1;
  WebSocketShim.CLOSING = 2;
  WebSocketShim.CLOSED = 3;
  var window = globalThis;
  window.EventTarget = EventTargetShim;
  window.WebSocket = WebSocketShim;
  window.document = {
    readyState: "loading",
    documentElement: { appendChild: function () {} },
    head: { appendChild: function () {} },
    createElement: function () { return { style: {} }; },
    addEventListener: function () {}
  };
  var document = window.document;
  window.setTimeout = function (fn) { return 0; };
  window.clearTimeout = function () {};
  var setTimeout = window.setTimeout;
  var clearTimeout = window.clearTimeout;
`;

/* Enough canvas for the overlay: it hooks the prototype's text methods and
 * draws paths, so calls are recorded rather than rasterised. */
const CANVAS_SHIM = `
  var CanvasRenderingContext2DShim = class {
    constructor(canvasId) { this.canvas = { id: canvasId }; this.calls = []; }
    record(op, args) { this.calls.push({ op: op, args: args }); }
    fillText() { this.record("fillText", Array.prototype.slice.call(arguments)); }
    strokeText() { this.record("strokeText", Array.prototype.slice.call(arguments)); }
    save() { this.record("save", []); }
    restore() { this.record("restore", []); }
    beginPath() { this.record("beginPath", []); }
    closePath() { this.record("closePath", []); }
    moveTo() { this.record("moveTo", Array.prototype.slice.call(arguments)); }
    lineTo() { this.record("lineTo", Array.prototype.slice.call(arguments)); }
    arcTo() { this.record("arcTo", Array.prototype.slice.call(arguments)); }
    arc() { this.record("arc", Array.prototype.slice.call(arguments)); }
    fill() { this.record("fill", []); }
    stroke() { this.record("stroke", []); }
  };
  var CanvasRenderingContext2D = CanvasRenderingContext2DShim;
  window.CanvasRenderingContext2D = CanvasRenderingContext2DShim;
  window.setInterval = function () { return 0; };
  window.clearInterval = function () {};
  window.document.getElementById = function () { return null; };
  window.document.cookie = "";
`;

function makeBrowser(wire) {
  const context = {
    console, Math, Date, JSON, Array, Object, Number, String, Error, TypeError, RangeError,
    Uint8Array, ArrayBuffer, DataView, WeakMap, parseInt, isNaN
  };
  context.globalThis = context;
  context.window = context;
  context.__wire = wire || [];
  vm.createContext(context);
  vm.runInContext(BROWSER_SHIM, context, { filename: "browser-shim.js" });
  return context;
}

/* The bridge and the visuals overlay as they actually sit in the built
 * userscript, so what gets checked is the shipped copy and not the files in
 * tools/ beside it. */
function extractBridge(script) {
  const start = script.indexOf("(function () {\n  \"use strict\";");
  const end = script.indexOf("/* --- LemonMod body:");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("could not find the bridge in the build output");
  }
  return script.slice(start, end);
}

/* The visuals ship as their own userscript now, carrying their own copy of
 * the bridge so they run with or without LemonMod beside them. */
function extractBridgeFrom(script) {
  const start = script.indexOf("(function () {\n  \"use strict\";");
  const at = script.indexOf("* lemon-visuals.js");
  if (start === -1 || at === -1) throw new Error("could not find the bridge in the visuals build");
  return script.slice(start, script.lastIndexOf("/*", at));
}

function extractVisuals(script) {
  const at = script.indexOf("* lemon-visuals.js");
  if (at === -1) throw new Error("could not find the visuals overlay in the visuals build");
  return script.slice(script.lastIndexOf("/*", at));
}

function extractFunction(src, name) {
  const start = src.indexOf(`\nfunction ${name}(`);
  if (start === -1) throw new Error(`could not find function ${name} in the bundle`);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start + 1, i + 1);
    }
  }
  throw new Error(`could not find the end of function ${name}`);
}

/* Pull the bundle's own transport crypto out of src/game_index.js and run it,
 * so the round trip is checked against the game rather than against a second
 * copy of the bridge's assumptions. */
function loadGameCrypto() {
  const pieces = [];
  const constants = GAME.match(/const Do = new Uint32Array\(\[[\s\S]*?\]\);/);
  if (!constants) throw new Error("could not find the SHA-256 constant table in the bundle");
  pieces.push(constants[0]);
  pieces.push("const he = 64, jt = 6, Io = 1;");
  const c2s = GAME.match(/\bbo = (\["M",[^\]]*\])/);
  const s2c = GAME.match(/\bTo = (\["A",[^\]]*\])/);
  if (!c2s || !s2c) throw new Error("could not find the opcode alphabets in the bundle");
  pieces.push(`const bo = ${c2s[1]}, To = ${s2c[1]};`);
  for (const name of ["Vt", "j", "Ao", "Eo", "Ro", "Co", "Oi", "Po"]) {
    pieces.push(extractFunction(GAME, name));
  }
  pieces.push("({ Po: Po, Eo: Eo, Ro: Ro, bo: bo, To: To });");
  return vm.runInNewContext(pieces.join("\n"), {
    Math, Uint8Array, Uint32Array, DataView, parseInt, Error, RangeError
  });
}

function report() {
  console.log(`verifying ${path.relative(ROOT, BUILD)}`);
  console.log("  against drivers/game-drivers.json + src/game_index.js\n");
  for (const note of notes) console.log("  . " + note);
  if (problems.length === 0) {
    console.log("\n  all checks passed");
    process.exit(0);
  }
  console.log("");
  for (const problem of problems) console.log("  ! " + problem);
  console.log(`\n  ${problems.length} problem(s)`);
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * 1. Build shape
 * ------------------------------------------------------------------ */

const script = fs.readFileSync(BUILD, "utf8");
const header = script.slice(0, script.indexOf("// ==/UserScript=="));

check(/@run-at\s+document-start/.test(header),
  "header: @run-at document-start is missing - the bundle caches WebSocket.prototype.send before a later hook could land");
check(/@match\s+\*:\/\/\*\.moomoo\.io\/\*/.test(header), "header: the moomoo.io @match is gone");
check(script.includes("window.__lemonBridge"), "build: the protocol bridge is not in the output");
check(script.includes("__lemonBoot"), "build: the mod body is not gated on the DOM");
check(!script.includes("'\\x74']('\\x26')[0x16b1"), "build: the bot socket URL still splits on '&'");
check(script.includes(`|| document.activeElement.id.toLowerCase() === "nameinput") {`),
  "build: the mod's send gate can still swallow the spawn while the name field has focus");

const VISUALS_BUILD = path.resolve(
  process.argv[3] || path.join(path.dirname(BUILD), "LemonMod_Visuals_Fixed.user.js")
);
const visualsScript = fs.existsSync(VISUALS_BUILD) ? fs.readFileSync(VISUALS_BUILD, "utf8") : null;
if (!visualsScript) problems.push(`build: ${path.relative(ROOT, VISUALS_BUILD)} is missing`);

check(!script.includes("* lemon-visuals.js"),
  "build: the visuals overlay is still inside the mod script - it ships on its own");
if (visualsScript) {
  check(/@run-at\s+document-start/.test(visualsScript.slice(0, visualsScript.indexOf("// ==/UserScript=="))),
    "visuals build: @run-at document-start is missing");
  check(visualsScript.includes("window.__lemonBridge"),
    "visuals build: it does not carry the bridge, so it would need the mod script");
}

const bridgeSource = extractBridge(script);
const visualsSource = visualsScript ? extractVisuals(visualsScript) : "";

/* ------------------------------------------------------------------ *
 * 2. Opcode tables
 * ------------------------------------------------------------------ */

const tableEnv = makeBrowser();
vm.runInContext(bridgeSource, tableEnv, { filename: "lemon-bridge.js", timeout: 20000 });
const bridge = tableEnv.window.__lemonBridge;
if (!bridge) {
  problems.push("bridge: did not install itself in the sandbox");
  report();
}

{
  const p = DRIVERS.protocol;
  const bp = bridge.protocol;
  check(bp.signatureBytes === p.signatureBytes,
    `protocol: frame signature is ${bp.signatureBytes} bytes, the bundle uses ${p.signatureBytes}`);
  check(bp.encryptedMode === p.encryptedMode,
    `protocol: transport mode ${bp.encryptedMode}, the bundle uses ${p.encryptedMode}`);
  check(bp.tableSalt === p.tableSalt,
    `protocol: table salt ${bp.tableSalt}, the bundle uses ${p.tableSalt}`);
  check(bp.c2sAlphabet.join() === p.c2sAlphabet.join(), "protocol: c2s alphabet differs from the bundle");
  check(bp.s2cAlphabet.join() === p.s2cAlphabet.join(), "protocol: s2c alphabet differs from the bundle");

  /* Every opcode the game understands needs exactly one LemonMod name, and no
   * two may share one - otherwise a packet quietly becomes a different packet. */
  const c2sTargets = Object.values(bridge.c2s);
  for (const [oldOp, newOp] of Object.entries(bridge.c2s)) {
    check(p.c2sAlphabet.includes(newOp), `c2s: "${oldOp}" maps to "${newOp}", which the bundle never sends`);
  }
  check(new Set(c2sTargets).size === c2sTargets.length,
    "c2s: two LemonMod opcodes map to the same game opcode");
  for (const op of p.c2sAlphabet) {
    check(c2sTargets.includes(op), `c2s: nothing maps to the game opcode "${op}"`);
  }

  const s2cKeys = Object.keys(bridge.s2c);
  const s2cNames = Object.values(bridge.s2c);
  for (const op of p.s2cAlphabet) {
    check(s2cKeys.includes(op), `s2c: the game opcode "${op}" has no LemonMod name`);
  }
  for (const op of s2cKeys) {
    check(p.s2cAlphabet.includes(op), `s2c: "${op}" is not an opcode the bundle sends`);
  }
  check(new Set(s2cNames).size === s2cNames.length,
    "s2c: two game opcodes carry the same LemonMod name - one would be handled as the other");

  notes.push(`opcodes: ${Object.keys(bridge.c2s).length} c2s and ${s2cKeys.length} s2c names bound`);
}

/* The sixteen server opcodes LemonMod's message handler switches on. Wrong
 * here and the mod reads, say, an alliance deletion as its own spawn. */
const HANDLED = {
  C: "1", D: "2", H: "6", K: "7", L: "8", N: "9", P: "11", Q: "12",
  R: "13", U: "16", V: "17", X: "18", a: "33", g: "ac", 6: "ch", O: "h"
};
for (const [op, name] of Object.entries(HANDLED)) {
  check(bridge.s2c[op] === name,
    `s2c: "${op}" should reach LemonMod as "${name}", got ${JSON.stringify(bridge.s2c[op])}`);
}

/* ------------------------------------------------------------------ *
 * 3. Round trip against the bundle's own crypto
 * ------------------------------------------------------------------ */

const game = loadGameCrypto();
check(game.bo.join() === DRIVERS.protocol.c2sAlphabet.join(),
  "drivers: the recorded c2s alphabet no longer matches the bundle");
check(game.To.join() === DRIVERS.protocol.s2cAlphabet.join(),
  "drivers: the recorded s2c alphabet no longer matches the bundle");

{
  const SIG = DRIVERS.protocol.signatureBytes;
  const seed = 0x5eed1234;
  const keyHex = "8f2ba17c04d95ee6310bcaf7290d5b83a1c4e07f66d2b9581e3a4c70dd9b2f15";
  const tables = game.Po(seed >>> 0);
  const key = game.Ro(keyHex);

  const wire = [];
  const modSaw = [];
  const listenerSaw = [];
  const env = makeBrowser(wire);
  env.__modSaw = modSaw;
  env.__listenerSaw = listenerSaw;
  vm.runInContext(bridgeSource, env, { filename: "lemon-bridge.js", timeout: 20000 });
  const mp = env.window.__lemonBridge.msgpack;

  /* A stand-in for LemonMod: hooks send the way the mod does - keep the old
   * one, inspect the frame, hand it back - and listens through
   * addEventListener, which is how the mod gets at incoming packets. */
  vm.runInContext(`
    WebSocket.prototype.oldSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      __modSaw.push(window.__lemonBridge.msgpack.decode(new Uint8Array(data)));
      this.oldSend(data);
    };
    var __socket = new WebSocket("wss://test.moomoo.io/");
    __socket.addEventListener("message", function (event) {
      __listenerSaw.push(window.__lemonBridge.msgpack.decode(new Uint8Array(event.data)));
    });
  `, env, { filename: "fake-lemonmod.js" });

  const socket = env.__socket;

  const deliver = (value) => {
    const bytes = mp.encode(value);
    socket.dispatchEvent({
      type: "message",
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    });
  };

  const signed = (opcode, args, seq) => {
    const payload = mp.encode([opcode, args, seq]);
    const sig = game.Eo(key, payload);
    const out = new Uint8Array(SIG + payload.length);
    out.set(sig, 0);
    out.set(payload, SIG);
    return out;
  };

  /* Decode a frame the bridge put on the wire using the bundle's own crypto:
   * the signature has to verify, the opcode has to be the permuted one for
   * this connection, and the sequence number has to be the next one. */
  const verifyWire = (frame, expectedOp, expectedArgs, expectedSeq, label) => {
    if (!frame) {
      problems.push(`wire: ${label} never reached the socket`);
      return null;
    }
    const bytes = frame instanceof Uint8Array ? frame : new Uint8Array(frame);
    const payload = bytes.subarray(SIG);
    const expectSig = game.Eo(key, payload);
    let sigOk = bytes.length > SIG;
    for (let i = 0; i < SIG; i++) if (bytes[i] !== expectSig[i]) sigOk = false;
    check(sigOk, `wire: ${label} carries a signature the bundle would reject`);

    let decoded;
    try {
      decoded = mp.decode(payload);
    } catch (e) {
      problems.push(`wire: ${label} payload is not msgpack (${e.message})`);
      return null;
    }
    check(decoded[0] === tables.c2s.enc[expectedOp],
      `wire: ${label} used opcode ${decoded[0]}, expected ${tables.c2s.enc[expectedOp]} ("${expectedOp}")`);
    check(decoded[2] === expectedSeq, `wire: ${label} used sequence ${decoded[2]}, expected ${expectedSeq}`);
    if (expectedArgs) {
      check(JSON.stringify(decoded[1]) === JSON.stringify(expectedArgs),
        `wire: ${label} arguments are ${JSON.stringify(decoded[1])}, expected ${JSON.stringify(expectedArgs)}`);
    }
    return decoded;
  };

  deliver(["io-init", [7, seed, keyHex, DRIVERS.protocol.encryptedMode]]);
  check(listenerSaw.length === 1 && listenerSaw[0][0] === "io-init",
    "incoming: io-init did not reach the mod's listener untouched");

  /* (a) the game sends an aim packet - "D" to the bundle, "2" to LemonMod */
  socket.send(signed(tables.c2s.enc.D, [1.23], 1));
  check(modSaw.length === 1 && modSaw[0][0] === "2",
    `outgoing: the game's "D" reached the mod as ${JSON.stringify(modSaw[0] && modSaw[0][0])}, expected "2"`);
  check(modSaw[0] && Array.isArray(modSaw[0][1]) && modSaw[0][1][0] === 1.23,
    "outgoing: the game's arguments were lost in translation");
  verifyWire(wire.pop(), "D", [1.23], 1, "the game's own packet");

  /* (b) the mod sends a chat packet - "ch" to LemonMod, "6" to the bundle */
  socket.send(mp.encode(["ch", ["hello"]]));
  check(modSaw.length === 2 && modSaw[1][0] === "ch",
    "outgoing: the mod's own packet did not reach its hook unchanged");
  verifyWire(wire.pop(), "6", ["hello"], 2, "the mod's own packet");

  /* (c) a spawn, which carries a map rather than scalars */
  socket.send(mp.encode(["sp", [{ name: "lemon", moofoll: 1, skin: 0 }]]));
  const spawned = verifyWire(wire.pop(), "M", null, 3, "spawn");
  check(!!(spawned && spawned[1] && spawned[1][0] && spawned[1][0].name === "lemon"),
    "outgoing: the spawn payload did not survive re-encoding");

  /* (d) the sequence counter stays monotonic across both senders, which is the
   *     reason the bridge re-signs the game's frames instead of only its own */
  socket.send(signed(tables.c2s.enc[9], [0.5], 2));
  verifyWire(wire.pop(), "9", [0.5], 4, "a game packet after the mod's");

  /* (e) server -> mod, for every opcode LemonMod handles */
  for (const [op, expected] of Object.entries(HANDLED)) {
    const before = listenerSaw.length;
    deliver([tables.s2c.enc[op], [1, 2, 3]]);
    const got = listenerSaw[before];
    check(!!got && got[0] === expected,
      `incoming: the bundle's "${op}" reached the mod as ${JSON.stringify(got && got[0])}, expected "${expected}"`);
    check(!!got && Array.isArray(got[1]) && got[1].length === 3,
      `incoming: arguments lost translating "${op}"`);
  }

  /* (f) an opcode LemonMod has no handler for must not arrive wearing another
   *     handler's name */
  const beforeUnknown = listenerSaw.length;
  deliver([tables.s2c.enc.Z, [42]]);
  check(listenerSaw.length === beforeUnknown + 1 && listenerSaw[beforeUnknown][0] === "sd",
    "incoming: the shutdown notice should arrive under its own name, not another handler's");

  notes.push(`round trip: ${modSaw.length} frames through the mod's hook, ${listenerSaw.length} into its listener`);
}

/* ------------------------------------------------------------------ *
 * 4. The awkward things a real mod hook does
 * ------------------------------------------------------------------ */

{
  const SIG = DRIVERS.protocol.signatureBytes;
  const seed = 0x0badf00d;
  const keyHex = "1122334455667788990011223344556677889900112233445566778899001122";
  const tables = game.Po(seed >>> 0);
  const key = game.Ro(keyHex);

  const wire = [];
  const botSaw = [];
  const env = makeBrowser(wire);
  env.__botSaw = botSaw;
  vm.runInContext(bridgeSource, env, { filename: "lemon-bridge.js", timeout: 20000 });
  const mp = env.window.__lemonBridge.msgpack;

  /* Auto-heal and friends send from inside the hook, before handing the
   * original frame back - the bridge has to place both without recursing. */
  vm.runInContext(`
    var __drop = false;
    WebSocket.prototype.oldSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      var frame = window.__lemonBridge.msgpack.decode(new Uint8Array(data));
      if (frame[0] === "2") {
        this.send(window.__lemonBridge.msgpack.encode(["5", [0, true]]));
      }
      if (__drop) return;
      this.oldSend(data);
    };
    var __socket = new WebSocket("wss://test.moomoo.io/");
    __socket.__lemonBotMessage = function (event) {
      __botSaw.push(window.__lemonBridge.msgpack.decode(new Uint8Array(event.data)));
    };
  `, env, { filename: "fake-lemonmod-2.js" });

  const socket = env.__socket;
  const ioInit = mp.encode(["io-init", [1, seed, keyHex, DRIVERS.protocol.encryptedMode]]);
  socket.dispatchEvent({
    type: "message",
    data: ioInit.buffer.slice(ioInit.byteOffset, ioInit.byteOffset + ioInit.byteLength)
  });

  const opcodeOf = (frame) => mp.decode((frame instanceof Uint8Array ? frame : new Uint8Array(frame)).subarray(SIG));

  const payload = mp.encode([tables.c2s.enc.D, [0.75], 1]);
  const sig = game.Eo(key, payload);
  const gameFrame = new Uint8Array(SIG + payload.length);
  gameFrame.set(sig, 0);
  gameFrame.set(payload, SIG);
  socket.send(gameFrame);

  check(wire.length === 2, `nested send: expected 2 frames on the wire, got ${wire.length}`);
  if (wire.length === 2) {
    const injected = opcodeOf(wire[0]);
    const original = opcodeOf(wire[1]);
    check(injected[0] === tables.c2s.enc.z,
      `nested send: the injected packet used opcode ${injected[0]}, expected ${tables.c2s.enc.z} ("z")`);
    check(original[0] === tables.c2s.enc.D,
      `nested send: the game's packet used opcode ${original[0]}, expected ${tables.c2s.enc.D} ("D")`);
    check(injected[2] === 1 && original[2] === 2,
      `nested send: sequence numbers are ${injected[2]} and ${original[2]}, expected 1 then 2`);
  }

  /* A hook that swallows a frame - LemonMod does this while you are typing -
   * must swallow it, not have the bridge send it anyway. */
  wire.length = 0;
  vm.runInContext("__drop = true;", env);
  socket.send(gameFrame);
  check(wire.length === 1 && opcodeOf(wire[0])[0] === tables.c2s.enc.z,
    "dropped frame: only the injected packet should have reached the wire");

  /* A swallowed spawn is what leaves people stuck looking at the world with
   * no menu and no HUD, so it goes out whatever the hook decides. */
  wire.length = 0;
  socket.send(mp.encode(["sp", [{ name: "stuck", moofoll: 1, skin: 0 }]]));
  const spawnFrames = wire.filter((f) => {
    const decoded = opcodeOf(f);
    return decoded[0] === tables.c2s.enc.M;
  });
  check(spawnFrames.length === 1,
    `swallowed spawn: the spawn should reach the wire even when the hook drops it, saw ${spawnFrames.length}`);

  /* `window.hasSpawned` is what LemonMod's timer reads before it hides the
   * menu. It has to answer the wire, not the click, and ignore being set. */
  check(vm.runInContext("window.hasSpawned", env) === false,
    "hasSpawned: should be false until the server starts the game");
  vm.runInContext("window.hasSpawned = true;", env);
  check(vm.runInContext("window.hasSpawned", env) === false,
    "hasSpawned: the mod's optimistic write should not take");
  const setup = mp.encode([tables.s2c.enc.C, [7]]);
  socket.dispatchEvent({
    type: "message",
    data: setup.buffer.slice(setup.byteOffset, setup.byteOffset + setup.byteLength)
  });
  check(vm.runInContext("window.hasSpawned", env) === true,
    "hasSpawned: the setup frame should turn it on");
  const died = mp.encode([tables.s2c.enc.P, []]);
  socket.dispatchEvent({
    type: "message",
    data: died.buffer.slice(died.byteOffset, died.byteOffset + died.byteLength)
  });
  check(vm.runInContext("window.hasSpawned", env) === false,
    "hasSpawned: dying should turn it off so the menu comes back");

  /* A signed frame the bridge has no old-style name for still has to be
   * re-numbered rather than passed through, or the counter on the wire stops
   * being the bridge's alone. */
  wire.length = 0;
  const strayPayload = mp.encode([250, [1], 99]);
  const straySig = game.Eo(key, strayPayload);
  const stray = new Uint8Array(SIG + strayPayload.length);
  stray.set(straySig, 0);
  stray.set(strayPayload, SIG);
  socket.send(stray);
  check(wire.length === 1, `unmapped frame: expected 1 frame on the wire, got ${wire.length}`);
  if (wire.length === 1) {
    const renumbered = opcodeOf(wire[0]);
    check(renumbered[0] === 250 && renumbered[2] === 5,
      `unmapped frame: went out as opcode ${renumbered[0]} seq ${renumbered[2]}, expected 250 seq 5`);
  }

  /* Bot sockets read through onmessage, which the build points at the bridge. */
  const chat = mp.encode([tables.s2c.enc[6], [3, "hi"]]);
  socket.dispatchEvent({
    type: "message",
    data: chat.buffer.slice(chat.byteOffset, chat.byteOffset + chat.byteLength)
  });
  check(botSaw.length > 0 && botSaw[0][0] === "io-init",
    "bot socket: io-init should reach the handler untouched, ahead of anything else");
  const lastSeen = botSaw[botSaw.length - 1];
  check(!!lastSeen && lastSeen[0] === "ch",
    `bot socket: chat reached the handler as ${JSON.stringify(lastSeen && lastSeen[0])}, expected "ch"`);

  /* Two connections, two key schedules: state has to be per socket. */
  const otherWire = [];
  env.__wire = otherWire;
  const second = vm.runInContext(`new WebSocket("wss://other.moomoo.io/")`, env);
  const otherSeed = 0x12345678;
  const otherTables = game.Po(otherSeed >>> 0);
  const otherInit = mp.encode(["io-init", [2, otherSeed, keyHex, DRIVERS.protocol.encryptedMode]]);
  second.dispatchEvent({
    type: "message",
    data: otherInit.buffer.slice(otherInit.byteOffset, otherInit.byteOffset + otherInit.byteLength)
  });
  vm.runInContext("__drop = false;", env);
  second.send(mp.encode(["ch", ["second"]]));
  check(otherWire.length === 1, `second socket: expected 1 frame, got ${otherWire.length}`);
  if (otherWire.length) {
    const frame = opcodeOf(otherWire[0]);
    check(frame[0] === otherTables.c2s.enc[6],
      "second socket: used the first connection's opcode table");
    check(frame[2] === 1, `second socket: sequence started at ${frame[2]}, expected 1`);
  }

  notes.push("hook behaviour: nested sends, dropped frames, bot sockets and a second connection");
}

/* ------------------------------------------------------------------ *
 * 5. The game data LemonMod hardcodes
 *
 * The mod's autos name hats, accessories and upgrades by id. Those ids are
 * spread through the obfuscated body as folded arithmetic, so they are listed
 * here as read out of it once - what this pass is for is the other side of the
 * comparison: if the bundle ever drops one of them, or shortens the upgrade
 * list, that shows up as a failure here rather than as an auto that quietly
 * equips nothing.
 * ------------------------------------------------------------------ */

{
  const hats = [6, 7, 11, 12, 21, 26, 40, 53, 55];          // 0 is "unequip"
  const accessories = [13, 18, 19, 21];
  const upgrades = [4, 5, 6, 7, 8, 9, 10, 12, 15, 17, 19, 23, 25, 28, 31, 32, 33, 38];

  const haveHats = new Set(DRIVERS.hats.map((h) => h.id));
  const haveAcc = new Set(DRIVERS.accessories.map((a) => a.id));
  for (const id of hats) check(haveHats.has(id), `data: LemonMod equips hat ${id}, which the bundle no longer has`);
  for (const id of accessories) {
    check(haveAcc.has(id), `data: LemonMod equips accessory ${id}, which the bundle no longer has`);
  }

  const upgradeSlots = DRIVERS.weapons.length + DRIVERS.items.length;
  for (const index of upgrades) {
    check(index < upgradeSlots,
      `data: LemonMod buys upgrade ${index}, past the end of the bundle's ${upgradeSlots} upgrade slots`);
  }
  notes.push(`data: ${hats.length} hats, ${accessories.length} accessories and ${upgrades.length} upgrade slots still exist`);
}

/* ------------------------------------------------------------------ *
 * 6. The visuals overlay
 *
 * Driven end to end: frames go in through the bridge on a real (sandbox)
 * socket, and the overlay is then asked to draw the way the bundle asks it to
 * - a strokeText immediately followed by an identical fillText, which is how a
 * nametag is distinguished from a chat bubble.
 * ------------------------------------------------------------------ */

{
  const seed = 0x2468ace0;
  const keyHex = "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";
  const tables = game.Po(seed >>> 0);

  const env = makeBrowser([]);
  vm.runInContext(CANVAS_SHIM, env, { filename: "canvas-shim.js" });
  vm.runInContext(extractBridgeFrom(visualsScript), env, { filename: "lemon-bridge.js", timeout: 20000 });
  vm.runInContext(visualsSource, env, { filename: "lemon-visuals.js", timeout: 20000 });

  const visuals = env.window.__lemonVisuals;
  if (!visuals) {
    problems.push("visuals: the overlay did not install itself in the sandbox");
    report();
  }

  const mp = env.window.__lemonBridge.msgpack;
  const socket = vm.runInContext(`new WebSocket("wss://test.moomoo.io/")`, env);
  const deliver = (value) => {
    const bytes = mp.encode(value);
    socket.dispatchEvent({
      type: "message",
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    });
  };
  const send = (op, args) => deliver([tables.s2c.enc[op], args]);

  deliver(["io-init", [1, seed, keyHex, DRIVERS.protocol.encryptedMode]]);
  send("C", [1]);                                   // our own sid
  send("D", [[9, 2, "victim", 0, 0, 0, 100, 100, 35, 0], false]);

  /* Holding a hand axe (400ms) - one tick recharges 111/400 of the bar. */
  const tickWith = (weapon, buildIndex) =>
    send("a", [[2, 100, 200, 0, buildIndex === undefined ? -1 : buildIndex, weapon, 0, null, 0, 0, 0, 0, 0]]);

  tickWith(1);                                      // first sight: learns the weapon
  const victim = visuals.players.get(2);
  check(!!victim, "visuals: the player from the add-player frame was not tracked");
  if (victim) {
    victim.primaryReload = 0;
    tickWith(1);
    const step = 111 / 400;
    check(Math.abs(victim.primaryReload - step) < 1e-9,
      `visuals: a tick recharged the bar by ${victim.primaryReload}, expected ${step}`);

    /* Building does not recharge anything. */
    const held = victim.primaryReload;
    tickWith(1, 3);
    check(victim.primaryReload === held, "visuals: the bar recharged while the player was building");

    /* The swing empties it; a musket shot leaves it alone. */
    victim.primaryReload = 1;
    send("K", [2, 1, 1]);
    check(victim.primaryReload === 0, "visuals: the attack did not empty the primary bar");
    victim.primaryReload = 1;
    send("K", [2, 1, 15]);
    check(victim.primaryReload === 1, "visuals: a musket shot emptied the primary bar");

    /* Great hammer and mc grabby are the two secondaries that swing. */
    victim.secondaryReload = 1;
    send("K", [2, 1, 10]);
    check(victim.secondaryReload === 0, "visuals: the great hammer swing did not empty the secondary bar");

    /* Shame: damage, then healing back inside two ticks. */
    victim.clown = 0;
    send("O", [2, 90]);
    send("a", [[2, 100, 200, 0, -1, 1, 0, null, 0, 0, 0, 0, 0]]);
    send("O", [2, 100]);
    check(victim.clown === 1, `visuals: the shame counter is ${victim.clown} after a heal out of damage, expected 1`);

    /* Healing long after the damage walks it back down instead. */
    victim.clown = 5;
    send("O", [2, 90]);
    for (let i = 0; i < 4; i++) send("a", [[2, 100, 200, 0, -1, 1, 0, null, 0, 0, 0, 0, 0]]);
    send("O", [2, 100]);
    check(victim.clown === 3, `visuals: the shame counter is ${victim.clown} after a late heal, expected 3`);
  }

  /* Now the drawing: the bundle strokes a nametag and then fills the same
   * string at the same spot, and nothing else on that canvas does. */
  const ctx = vm.runInContext(`new CanvasRenderingContext2D("gameCanvas")`, env);
  ctx.calls.length = 0;
  ctx.strokeText("victim", 400, 300);
  ctx.fillText("victim", 400, 300);

  const texts = ctx.calls.filter((c) => c.op === "fillText");
  check(texts.length === 1 && /^victim <\d+\/7>$/.test(texts[0].args[0]),
    `visuals: the nametag was drawn as ${JSON.stringify(texts[0] && texts[0].args[0])}, expected a shame counter after it`);
  check(ctx.calls.some((c) => c.op === "fill"), "visuals: no reload bars were drawn under the nametag");

  /* The bars belong 13px above the health bar, which sits 2 * (scale + nameY)
   * below the nametag. */
  const firstBar = ctx.calls.find((c) => c.op === "moveTo");
  check(!!firstBar && Math.abs(firstBar.args[1] - (300 + 2 * (35 + 34) - 13)) < 0.001,
    `visuals: the bars were drawn at y ${firstBar && firstBar.args[1]}, expected ${300 + 2 * (35 + 34) - 13}`);

  /* A chat bubble is filled without being stroked, and must be left alone. */
  ctx.calls.length = 0;
  ctx.fillText("victim", 400, 300);
  const chat = ctx.calls.filter((c) => c.op === "fillText");
  check(chat.length === 1 && chat[0].args[0] === "victim",
    "visuals: a chat bubble was decorated as though it were a nametag");
  check(!ctx.calls.some((c) => c.op === "fill"), "visuals: bars were drawn under a chat bubble");

  /* Text on any other canvas is not ours either. */
  const other = vm.runInContext(`new CanvasRenderingContext2D("mapDisplay")`, env);
  other.strokeText("victim", 10, 10);
  other.fillText("victim", 10, 10);
  check(other.calls.filter((c) => c.op === "fillText")[0].args[0] === "victim",
    "visuals: text on another canvas was decorated");

  notes.push("visuals: reload model, shame counter and nametag drawing behave");
}

report();
