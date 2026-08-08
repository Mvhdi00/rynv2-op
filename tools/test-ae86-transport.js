/*
 * End-to-end transport test for Ae86_v10_2_Fixed.user.js.
 *
 * This drives the patched io-client module itself — the module factory is
 * lifted out of the built userscript and run against a stub WebSocket — with
 * the server side implemented from the primitives in src/game_index.js. It
 * checks that every frame the client emits is one the shipped server would
 * accept, and that every opcode the server emits reaches the handler Ae86
 * registered for it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const msgpack = require('msgpack-lite');

const ROOT = path.join(__dirname, '..');
const built = fs.readFileSync(path.join(ROOT, 'Ae86_v10_2_Fixed.user.js'), 'utf8');
const gameLines = fs.readFileSync(path.join(ROOT, 'src/game_index.js'), 'utf8').split('\n');

/* ---------- server side, straight out of the shipped bundle ---------- */
const gameCtx = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt, console };
vm.createContext(gameCtx);
{
  const lines = gameLines.slice(277, 405);
  lines[0] = 'const ' + lines[0].trimStart().slice(2);
  vm.runInContext(lines.join('\n') + '\n;this.__game = { Eo, Po, jt, Ht };', gameCtx);
}
const game = gameCtx.__game;

/* ---------- pull the patched io-client module out of the build ---------- */
function extractModule(src, key) {
  const marker = `'${key}': function (`;
  const at = src.indexOf(marker);
  if (at === -1) throw new Error(`module not found: ${key}`);
  const open = src.indexOf('{', src.indexOf(')', at));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(at + marker.length - '(function ('.length + 1, i + 1);
    }
  }
  throw new Error('unbalanced braces');
}

const modBody = (() => {
  const marker = "'./src/js/libs/io-client.js': function (";
  const at = built.indexOf(marker);
  if (at === -1) throw new Error('io-client module not found in build');
  const argsEnd = built.indexOf(')', at);
  const args = built.slice(at + marker.length, argsEnd);
  const open = built.indexOf('{', argsEnd);
  let depth = 0;
  for (let i = open; i < built.length; i++) {
    if (built[i] === '{') depth++;
    else if (built[i] === '}') {
      depth--;
      if (depth === 0) return { args, body: built.slice(open, i + 1) };
    }
  }
  throw new Error('unbalanced braces in io-client module');
})();

/* ---------- sandbox ---------- */
let sent = [];
class StubSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    StubSocket.last = this;
  }
  send(data) { sent.push(data); }
  close() { this.closed = true; }
}
StubSocket.OPEN = 1;

const sandbox = {
  console, Math, Date, Uint8Array, ArrayBuffer, DataView, parseInt, setTimeout, clearTimeout,
  WebSocket: StubSocket,
  encodeURIComponent,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/moomoo-transport.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ae86-protocol.js'), 'utf8'), sandbox);

// antiKick gating lives outside the module in the real build.
vm.runInContext('var antiKick = false, secPacket = 0, minPacket = 0, pktSended = 0;', sandbox);

const fakeRequire = () => msgpack;
vm.runInContext(
  `this.__makeModule = function (${modBody.args}) ${modBody.body};`,
  sandbox
);
const moduleObj = { exports: {} };
sandbox.__makeModule(moduleObj, moduleObj.exports, fakeRequire);
const io = moduleObj.exports;

/* ---------- checks ---------- */
let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`  ok    ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
const bytes = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const SEED = 0x5bf03a21;
const KEY_HEX = '0f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aabbccddeeff0';
const serverTables = game.Po(SEED >>> 0);
const serverKey = (() => {
  const t = new Uint8Array(KEY_HEX.length / 2);
  for (let i = 0; i < t.length; i++) t[i] = parseInt(KEY_HEX.substr(i * 2, 2), 16);
  return t;
})();

// Handler table mirroring the one Ae86 registers, recording what fires.
const fired = [];
const OLD_NAMES = ['id', 'd', '1', '2', '4', '33', '5', '6', 'a', 'aa', '7', '8', 'sp', '9', 'h',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', 'ac', 'ad', 'an', 'st', 'sa', 'us',
  'ch', 'mm', 't', 'p', 'pp'];
const handlers = {};
for (const n of OLD_NAMES) handlers[n] = (...args) => fired.push([n, args]);

let readyCalls = 0;
io.connect('wss://example.invalid', (err) => { readyCalls++; if (err) fired.push(['__err', [err]]); }, handlers);
const sock = StubSocket.last;

console.log('handshake');
check('socket opened', !!sock);
check('url has no legacy port/gameIndex', !/:8008|gameIndex/.test(sock.url), sock.url);

sock.onopen();
check('ready callback not fired on open', readyCalls === 0);

sock.onmessage({ data: msgpack.encode(['io-init', [7, SEED, KEY_HEX, game.Ht]]) });
check('ready callback fired on io-init', readyCalls === 1);
check('socketId recorded', io.socketId === 7, String(io.socketId));
check('transport state built', !!io.proto);
check('c2s table matches server', JSON.stringify(io.proto.tables.c2s.enc) === JSON.stringify(serverTables.c2s.enc));
check('s2c table matches server', JSON.stringify(io.proto.tables.s2c.dec) === JSON.stringify(serverTables.s2c.dec));

/* ---------- outbound: every Ae86 name must produce a valid frame ---------- */
console.log('outbound frames');
const C2S = { 'sp': 'M', '2': 'D', '33': '9', 'rmd': 'e', 'c': 'F', '5': 'z', '6': 'H', '7': 'K',
  '8': 'L', '9': 'N', '10': 'b', '11': 'P', '12': 'Q', '13c': 'c', 'ch': '6', '14': 'S', 'pp': '0' };

let expectedSeq = 0;
for (const [oldName, newName] of Object.entries(C2S)) {
  sent = [];
  io.send(oldName, 1, 2);
  if (sent.length !== 1) { check(`send "${oldName}"`, false, 'no frame emitted'); continue; }
  const frame = bytes(sent[0]);
  const payload = frame.subarray(game.jt);
  const sig = frame.subarray(0, game.jt);
  const expectSig = game.Eo(serverKey, payload);
  const decoded = msgpack.decode(Buffer.from(payload));
  expectedSeq++;
  const okOp = decoded[0] === serverTables.c2s.enc[newName];
  const okArgs = JSON.stringify(decoded[1]) === JSON.stringify([1, 2]);
  const okSeq = decoded[2] === expectedSeq;
  const okSig = same(sig, expectSig);
  check(`send "${oldName}" -> "${newName}"`, okOp && okArgs && okSeq && okSig,
    !okOp ? `opcode ${decoded[0]} != ${serverTables.c2s.enc[newName]}`
      : !okArgs ? `args ${JSON.stringify(decoded[1])}`
        : !okSeq ? `seq ${decoded[2]} != ${expectedSeq}`
          : 'bad signature');
}

console.log('outbound: unknown packet is dropped, not sent raw');
sent = [];
io.send('not-a-real-packet', 1);
check('unknown name emits nothing', sent.length === 0);

/* ---------- inbound: every server opcode must reach the right handler ---------- */
console.log('inbound dispatch');
const S2C = { 'A': 'id', 'B': 'd', 'C': '1', 'D': '2', 'E': '4', 'a': '33', 'G': '5', 'H': '6',
  'I': 'a', 'J': 'aa', 'K': '7', 'L': '8', 'M': 'sp', 'N': '9', 'O': 'h', 'P': '11', 'Q': '12',
  'R': '13', 'S': '14', 'T': '15', 'U': '16', 'V': '17', 'X': '18', 'Y': '19', 'Z': '20',
  'g': 'ac', '1': 'ad', '2': 'an', '3': 'st', '4': 'sa', '5': 'us', '6': 'ch', '7': 'mm',
  '8': 't', '9': 'p', '0': 'pp' };

for (const [newName, oldName] of Object.entries(S2C)) {
  fired.length = 0;
  const opcode = serverTables.s2c.enc[newName];
  sock.onmessage({ data: msgpack.encode([opcode, ['payload', 42]]) });
  const ok = fired.length === 1 && fired[0][0] === oldName &&
    JSON.stringify(fired[0][1]) === JSON.stringify(['payload', 42]);
  check(`opcode ${String(opcode).padStart(2)} ("${newName}") -> handler "${oldName}"`, ok,
    fired.length ? `got "${fired[0][0]}"` : 'no handler fired');
}

console.log('inbound: unknown opcode is ignored');
fired.length = 0;
sock.onmessage({ data: msgpack.encode([9999, ['x']]) });
check('unmapped opcode ignored', fired.length === 0);

console.log('close');
io.close();
check('state cleared on close', io.proto === null && io.connected === false);

console.log('');
if (failures) { console.log(`${failures} check(s) FAILED`); process.exit(1); }
console.log('Transport test passed.');
