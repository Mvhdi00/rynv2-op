#!/usr/bin/env node
/*
 * verify-lemon.js
 *
 * Checks LemonMod_Fixed.user.js against the game.
 *
 *   node tools/verify-lemon.js [LemonMod_Fixed.user.js]
 *
 * Five passes:
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
 *   5. the hats, accessories and upgrade slots the mod names by id.
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

/* The bridge as it actually sits in the built userscript, so what gets checked
 * is the shipped copy and not tools/lemon-bridge.js beside it. */
function extractBridge(script) {
  const start = script.indexOf("(function () {\n  \"use strict\";");
  const end = script.indexOf("/* --- LemonMod body:");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("could not find the bridge in the build output");
  }
  return script.slice(start, end);
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

const bridgeSource = extractBridge(script);

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
    check(renumbered[0] === 250 && renumbered[2] === 4,
      `unmapped frame: went out as opcode ${renumbered[0]} seq ${renumbered[2]}, expected 250 seq 4`);
  }

  /* Bot sockets read through onmessage, which the build points at the bridge. */
  const chat = mp.encode([tables.s2c.enc[6], [3, "hi"]]);
  socket.dispatchEvent({
    type: "message",
    data: chat.buffer.slice(chat.byteOffset, chat.byteOffset + chat.byteLength)
  });
  check(botSaw.length === 2 && botSaw[0][0] === "io-init",
    "bot socket: io-init should reach the handler untouched, ahead of anything else");
  check(botSaw.length === 2 && botSaw[1][0] === "ch",
    `bot socket: chat reached the handler as ${JSON.stringify(botSaw[1] && botSaw[1][0])}, expected "ch"`);

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

report();
