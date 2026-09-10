/* Oracle's connection, checked the way the SERVER checks it.
 *
 *   node oracle-net.js [client.js]
 *
 * Oracle spoke the pre-2023 protocol — msgpack([letter, args]) and nothing
 * else. The live server wants a permuted numeric opcode, a strictly increasing
 * sequence number, and a six-byte signature over the payload. A frame missing
 * any of those is discarded and the connection is closed on the first one,
 * which is what "disconnected" on the menu is.
 *
 * transport-check.js already proves the ported transport is byte-identical to
 * the game's own primitives. That is not the same as proving the client USES
 * them, which is what this file is for: it lifts Oracle's real `send` and its
 * real `onmessage` out of the io layer, runs them, and then verifies every
 * frame they produce the way the server would — split the prefix, recompute the
 * signature over the remainder with the same key, decode, and check the shape.
 *
 * What it CANNOT tell you: whether the live server accepts the connection, or
 * whether Cloudflare issues a token. Oracle does not boot in this harness.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const msgpack = require("./node_modules/@msgpack/msgpack");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = process.argv[2] || path.join(ROOT, "oracle/Oracle_Laffer_v1.2.user.js");
const src = fs.readFileSync(CLIENT, "utf8");

let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log("  " + (ok ? "ok  " : "FAIL") + "  " + line); };

console.log(path.basename(CLIENT) + " — the connection, checked as the server checks it\n");

// ── the game's own transport, for the server side of the check ─────────────
const game = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8").split("\n");
const gameBlock = game.slice(277, 405).join("\n").replace(", Io = 1", "const Io = 1", 1);
const gameCtx = { Math, Uint8Array, Uint32Array, DataView, parseInt };
vm.createContext(gameCtx);
vm.runInContext(gameBlock + "\n; this.__api = { tables: Po, sign: Eo, hex: Ro, sigBytes: jt, mode: Ht };", gameCtx);
const G = gameCtx.__api;

// ── lift Oracle's io layer ────────────────────────────────────────────────
/* Both methods are taken from the file by their own text, so this bench tests
 * the shipped code rather than a copy that could rot beside it. */
/* Comments are stripped from every slice. A check whose pattern also matches
 * the comment explaining it passes on its own documentation — that happened
 * twice while this file was being written, so it is done centrally now. */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
}

function slice(startMark, label) {
  const i = src.indexOf(startMark);
  if (i === -1) throw new Error("could not find " + label + " in " + path.basename(CLIENT));
  const open = src.indexOf("{", i + startMark.length - 1);
  let d = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return stripComments(src.slice(i, k + 1)); }
  }
  throw new Error("unbalanced " + label);
}

const sendSrc = slice("send: function (type) {", "io.send");
const connectSrc = slice("connect: function (address, callback, events) {", "io.connect");
function inConnect(mark, label) {
  const i = connectSrc.indexOf(mark);
  if (i === -1) throw new Error("could not find " + label + " inside io.connect");
  const open = connectSrc.indexOf("{", i + mark.length - 1);
  let d = 0;
  for (let k = open; k < connectSrc.length; k++) {
    if (connectSrc[k] === "{") d++;
    else if (connectSrc[k] === "}") { d--; if (!d) return connectSrc.slice(i, k + 1); }
  }
  throw new Error("unbalanced " + label);
}
const onOpenSrc = inConnect("this.socket.onopen = function () {", "onopen");
const onMessageSrc = (() => {
  const i = connectSrc.indexOf("this.socket.onmessage = function (message) {");
  const open = connectSrc.indexOf("{", i + 40);
  let d = 0;
  for (let k = open; k < connectSrc.length; k++) {
    if (connectSrc[k] === "{") d++;
    else if (connectSrc[k] === "}") { d--; if (!d) return connectSrc.slice(i, k + 1); }
  }
})();

const rt = (() => {
  const a = src.indexOf("const RevTransport = (function () {");
  if (a === -1) throw new Error("no RevTransport block — the transport was never ported");
  return src.slice(a, src.indexOf("\n})();", a) + "\n})();".length);
})();

/* One world: Oracle's real send and onmessage, over a socket that records the
 * bytes instead of sending them. */
function world() {
  const sent = [];
  const handled = [];
  const box = {
    console, Math, Uint8Array, Uint32Array, DataView, parseInt, Array, setInterval: () => 1,
    msgpack: { encode: v => msgpack.encode(v), decode: b => msgpack.decode(b) },
    ORACLE_NATIVE_SEND: function (bytes) { sent.push(bytes); },
    __sent: sent, __handled: handled,
  };
  vm.createContext(box);
  vm.runInContext(rt + `
    let oracleNet = null;
    let oracleHandshake = false;
    let packets = 0, packetInterval, pps = 0;
    function oracleNetInit(args){
      if (!args || args[3] !== RevTransport.encryptedMode) return null;
      return { key: RevTransport.keyFromHex(args[2]), tables: RevTransport.tables(args[1]), seq: 0 };
    }
    function oracleNetType(type){
      if (oracleNet && typeof type === "number") return oracleNet.tables.s2c.dec[type];
      return type;
    }
    const _this = { socketId: -1, connected: false, socket: { readyState: 1 } };
    /* A real table with only the letters the client actually handles. The
     * first version was a Proxy that answered to ANY key, so
     * events[9999].apply(...) could never throw and the guard this bench
     * exists to check was untestable. */
    const events = {};
    ["A","B","C","D","E","a","G","H","I","J","K","L","M","N","O","P","Q","R","S",
     "T","U","V","X","Y","Z","g","1","2","3","4","5","6","7","8","9","0"]
      .forEach(function(k){
        events[k] = function(){ __handled.push([k, Array.prototype.slice.call(arguments)]); };
      });
    let calledBack = false;
    let callback = function(){ __handled.push(["__callback__", []]); };
    const io = { socket: { readyState: 1 }, ${sendSrc} };
    ${onMessageSrc.replace("this.socket.onmessage =", "const onmessage =")}
    ${onOpenSrc.replace("this.socket.onopen =", "const onopen =")}
    this.API = {
      send: function(){ return io.send.apply(io, arguments); },
      recv: function(bytes){ return onmessage({ data: bytes }); },
      open: function(){ return onopen(); },
      net: function(){ return oracleNet; },
      shook: function(){ return oracleHandshake; },
    };
  `, box);
  return { api: box.API, sent, handled };
}

// ── 1. the handshake comes first ──────────────────────────────────────────
console.log("  HANDSHAKE — nothing may go out before io-init\n");
{
  const w = world();
  w.api.send("M", { name: "x" });
  say(w.sent.length === 0,
      "a send before io-init puts nothing on the wire (" + w.sent.length + " frames)");
  say(w.handled.length === 0, "and no callback has fired yet");
  /* onopen must NOT fire the connect callback. It used to, and that is the
   * ordering bug: open happens before io-init, so everything the callback
   * starts runs with no key and no opcode table. */
  w.api.open();
  say(w.handled.length === 0,
      "onopen does not fire the connect callback — io-init does, which is what the game does");
}

const SEED = 0x9e3779b9 >>> 0;
const KEYHEX = "0badc0ffee1122334455667788990011";
const initArgs = [7, SEED, KEYHEX, G.mode];

{
  const w = world();
  w.api.recv(msgpack.encode(["io-init", initArgs]));
  say(w.handled.some(h => h[0] === "__callback__"),
      "io-init fires the connect callback — not onopen, which is what the game does too");
  say(w.api.shook() === true && w.api.net() !== null, "and it builds the signed session");
  w.api.send("M", { name: "x" });
  say(w.sent.length === 1, "after io-init a send does reach the wire");
}

// ── 2. every frame verified the way the server verifies it ────────────────
console.log("\n  FRAMES — split the prefix, recompute the signature, decode\n");
const tables = G.tables(SEED);
const key = G.hex(KEYHEX);

function verify(frame, expectLetter, expectArgs, expectSeq) {
  if (!(frame instanceof Uint8Array)) return "not a Uint8Array";
  if (frame.length <= G.sigBytes) return "shorter than the signature";
  const sig = frame.slice(0, G.sigBytes);
  const payload = frame.slice(G.sigBytes);
  const want = G.sign(key, payload);
  for (let i = 0; i < G.sigBytes; i++) {
    if (sig[i] !== want[i]) return "signature byte " + i + " is " + sig[i] + ", server computes " + want[i];
  }
  let decoded;
  try { decoded = msgpack.decode(payload); } catch (e) { return "payload is not msgpack: " + e.message; }
  if (!Array.isArray(decoded) || decoded.length !== 3) return "payload is not [op, args, seq]";
  const [op, args, seq] = decoded;
  if (op !== tables.c2s.enc[expectLetter])
    return "opcode " + op + ", server expects " + tables.c2s.enc[expectLetter] + " for \"" + expectLetter + "\"";
  if (seq !== expectSeq) return "seq " + seq + ", expected " + expectSeq;
  if (JSON.stringify(args) !== JSON.stringify(expectArgs))
    return "args " + JSON.stringify(args) + " != " + JSON.stringify(expectArgs);
  return null;
}

{
  const w = world();
  w.api.recv(msgpack.encode(["io-init", initArgs]));
  const cases = [
    ["M", [{ name: "moo", moofoll: 1, skin: 0 }]],
    ["9", [1.25]],
    ["F", [1, null]],
    ["z", [3, 0]],
    ["K", [0]],
    ["6", ["hello"]],
  ];
  let allOk = true, firstErr = null;
  cases.forEach(([letter, args], i) => {
    w.api.send.apply(null, [letter].concat(args));
    const err = verify(w.sent[i], letter, args, i + 1);
    if (err && !firstErr) { firstErr = letter + ": " + err; }
    if (err) allOk = false;
  });
  say(w.sent.length === cases.length, "every opcode produced a frame (" + w.sent.length + "/" + cases.length + ")");
  say(allOk, allOk
    ? "all " + cases.length + " verify against the server's own signature, table and sequence"
    : "a frame does not verify — " + firstErr);
}

// The sequence is what stops a replay, so it has to be strictly increasing
// across every opcode, not per-opcode.
{
  const w = world();
  w.api.recv(msgpack.encode(["io-init", initArgs]));
  const order = ["M", "9", "9", "F", "M"];
  order.forEach(l => w.api.send(l, 1));
  const seqs = w.sent.map(f => msgpack.decode(f.slice(G.sigBytes))[2]);
  say(seqs.join(",") === "1,2,3,4,5",
      "the sequence increases across all opcodes, not per opcode (" + seqs.join(",") + ")");
}

// An opcode the server has no slot for must be dropped, not sent malformed.
{
  const w = world();
  w.api.recv(msgpack.encode(["io-init", initArgs]));
  w.api.send("~unknown~", 1);
  say(w.sent.length === 0, "an opcode the server does not take is dropped, not sent (" + w.sent.length + ")");
  w.api.send("M", 1);
  const seq = msgpack.decode(w.sent[0].slice(G.sigBytes))[2];
  say(seq === 1, "and the dropped frame did not burn a sequence number (seq " + seq + ")");
}

// ── 3. incoming ───────────────────────────────────────────────────────────
console.log("\n  INCOMING — permuted numeric opcodes map back to letters\n");
{
  const w = world();
  w.api.recv(msgpack.encode(["io-init", initArgs]));
  const letter = "D";                                  // addPlayer
  const numeric = tables.s2c.enc[letter];
  w.api.recv(msgpack.encode([numeric, ["p1", 42]]));
  const hit = w.handled.find(h => h[0] === letter);
  say(!!hit, "a numeric server opcode reaches the handler its letter is keyed on");
  say(hit && JSON.stringify(hit[1]) === JSON.stringify(["p1", 42]), "with its arguments intact");
}
{
  const w = world();
  w.api.recv(msgpack.encode(["io-init", initArgs]));
  /* Two different ways an opcode can be unhandled, and they hit two different
   * guards. A NUMERIC one that is not in the table is stopped by the
   * `type === undefined` return after oracleNetType; a non-numeric one passes
   * straight through it and reaches the handler lookup. Only the second
   * exercises the `if (handler)` guard, which is why testing the numeric case
   * alone left that guard untested and a mutation removing it undetected. */
  let threwNumeric = false;
  try { w.api.recv(msgpack.encode([9999, [1]])); } catch (e) { threwNumeric = true; }
  say(!threwNumeric, "a numeric opcode outside the table is dropped rather than throwing");

  let threwLetter = false;
  try { w.api.recv(msgpack.encode(["~nohandler~", [1]])); } catch (e) { threwLetter = true; }
  say(!threwLetter,
      "and an opcode with no handler is skipped — this used to be a bare " +
      "events[type].apply(...), which threw inside onmessage and took the rest of the message with it");
}

// ── 3b. surviving a disconnect ────────────────────────────────────────────
/* The reported complaint is losing the connection, so the reconnect path is
 * checked on the shipped source rather than assumed. Three latches decide it
 * and all three used to be one-way. */
console.log("\n  RECONNECT — a drop must not be permanent\n");
{
  const closeFn = slice("close: function () {", "io.close");
  say(/this\.socket\s*=\s*null/.test(closeFn),
      "close() nulls the socket — connect() opens with `if (this.socket) return`, so leaving " +
      "it set made the first drop permanent");
  say(/oracleNet\s*=\s*null/.test(closeFn) && /oracleHandshake\s*=\s*false/.test(closeFn),
      "and drops the signed session, so the next connection re-handshakes instead of " +
      "signing with a stale key");

  const discFn = slice("function disconnect(reason) {", "disconnect");
  say(/inGame\s*=\s*false/.test(discFn),
      "disconnect() clears inGame — enterGame() is `if (!inGame && socketReady())`, and only " +
      "killPlayer() used to clear it, so a drop was not a death and Play stayed dead");
  say(/oracleConnecting\s*=\s*false/.test(discFn),
      "and releases the connect guard, or the retry is the one thing that cannot happen");

  const connFn = slice("function connectSocket(wsAddress) {", "connectSocket");
  say(/oraclePingTimer === null/.test(connFn),
      "the ping interval is started once, not once per callback — the callback fires on " +
      "io-init AND on every close, so this used to multiply with every drop");
}

/* And the session really is rebuilt: a second io-init with a different seed and
 * key must produce frames the server verifies with the NEW pair, not the old. */
{
  const w = world();
  const seed2 = 0x1234567 >>> 0, key2 = "ffeeddccbbaa99887766554433221100";
  w.api.recv(msgpack.encode(["io-init", [7, SEED, KEYHEX, G.mode]]));
  w.api.send("M", 1);
  w.api.recv(msgpack.encode(["io-init", [8, seed2, key2, G.mode]]));
  w.api.send("M", 1);
  const t2 = G.tables(seed2), k2 = G.hex(key2);
  const frame = w.sent[1];
  const payload = frame.slice(G.sigBytes);
  const sig = frame.slice(0, G.sigBytes);
  const want = G.sign(k2, payload);
  let sigOk = true;
  for (let i = 0; i < G.sigBytes; i++) if (sig[i] !== want[i]) sigOk = false;
  const dec = msgpack.decode(payload);
  say(sigOk, "after a second io-init the frame is signed with the NEW key");
  say(dec[0] === t2.c2s.enc.M, "and addressed through the NEW opcode table");
  say(dec[2] === 1, "with the sequence restarted at 1, as a fresh session must (" + dec[2] + ")");
}

// ── 4. the address ────────────────────────────────────────────────────────
/* The game builds it as
 *     serverAddress(e){ return e.region==0?"localhost":e.key+"."+e.region+"."+this.baseUrl }
 *     serverPort(e){ return e.port }
 *     let a = "wss://"+t; e && (a += "?token="+encodeURIComponent(e));
 * so the client's has to agree, or it connects to nothing. */
console.log("\n  ADDRESS — the same formula the game uses\n");
{
  const hostFn = slice("function oracleServerHost(server) {", "oracleServerHost");
  const box = { location: { hostname: "moomoo.io" } };
  vm.createContext(box);
  vm.runInContext('const ORACLE_BASE_URL = "moomoo.io";\n' + hostFn + "\nthis.h = oracleServerHost;", box);
  const cases = [
    [{ region: "eu", key: "0", port: 0 }, "0.eu.moomoo.io"],
    [{ region: "eu", key: "3", port: 8008 }, "3.eu.moomoo.io:8008"],
    [{ region: 0, key: "0", port: 0 }, "localhost"],
  ];
  let ok = true, note = "";
  for (const [server, want] of cases) {
    const got = box.h(server);
    if (got !== want) { ok = false; note = got + " != " + want; break; }
  }
  say(ok, ok ? "region/key/port build the host the game builds" : note);
  say(src.includes('encodeURIComponent("cf:" + token)'),
      "and the Turnstile token goes on as ?token=cf:<token>, which is the form the server reads");
}

// ── 5. the old protocol is really gone ────────────────────────────────────
console.log("\n  NO GHOSTS\n");
{
  const s = sendSrc.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  say(!/msgpack\.encode\(\[type, data\]\)\s*;\s*$/m.test(s) || /oracleHandshake/.test(s),
      "send no longer emits a bare [type, data] frame unconditionally");
  say(/RevTransport\.sign/.test(s), "it signs");
  say(/\+\+oracleNet\.seq/.test(s), "it sequences");
  say(/tables\.c2s\.enc\[type\]/.test(s), "it maps the opcode through the server's table");
  /* Comments are stripped first. The explanation of WHY the hook had to go
   * quotes the old line, and a raw substring search reported the quotation as
   * the code still being there — a check that fails on its own documentation
   * is a check nobody will keep. */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  say(!/window\.WebSocket\s*=\s*class/.test(code),
      "the window.WebSocket hook is gone from the code — the bundle locks that property and never reads it");
  say(/window\.OriginalWebSocket\s*=\s*window\.WebSocket/.test(code),
      "but the native constructor is still captured, which is what io.connect opens with");
  say(!src.includes("rawgit.com"), "the dead rawgit @require is gone (the host shut down in 2019)");
}

console.log("\n  Not covered: the live server accepting the connection, and Cloudflare");
console.log("  issuing a token. Oracle does not boot in this harness.");
console.log("\n  " + (bad ? bad + " assertion(s) failed" : "all assertions hold"));
process.exit(bad ? 1 : 0);
