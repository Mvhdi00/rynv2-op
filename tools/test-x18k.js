/*
 * Transport + login test for x18k_7_4_Fixed.user.js.
 *
 * x18k's socket is a top-level object rather than a module, so the `T = {...}`
 * literal is sliced out of the built userscript and run with stubs for the
 * globals it closes over. The server side is implemented from the primitives in
 * src/game_index.js.
 *
 * Part one drives every outbound name and every inbound opcode against a stub
 * socket. Part two runs a real WebSocket server on localhost that verifies the
 * truncated HMAC and rejects replayed sequence numbers, and takes the client
 * through a full login.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const msgpack = require('msgpack-lite');
const { WebSocketServer } = require('ws');

const ROOT = path.join(__dirname, '..');
const built = fs.readFileSync(path.join(ROOT, 'x18k_7_4_Fixed.user.js'), 'utf8');
const gameLines = fs.readFileSync(path.join(ROOT, 'src/game_index.js'), 'utf8').split('\n');

/* ---------- server primitives from the shipped bundle ---------- */
const gameCtx = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt, console };
vm.createContext(gameCtx);
{
  const lines = gameLines.slice(277, 405);
  lines[0] = 'const ' + lines[0].trimStart().slice(2);
  vm.runInContext(lines.join('\n') + '\n;this.__game = { Eo, Po, jt, Ht, bo, To };', gameCtx);
}
const game = gameCtx.__game;

/* ---------- slice the patched socket object out of the build ---------- */
function sliceSocketObject() {
  const at = built.indexOf('      T = {\n          socket: null,');
  if (at === -1) throw new Error('socket object not found in build');
  const open = built.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < built.length; i++) {
    if (built[i] === '{') depth++;
    else if (built[i] === '}') {
      depth--;
      if (depth === 0) return built.slice(at, i + 1);
    }
  }
  throw new Error('unbalanced braces in socket object');
}

function loadSocket(WebSocketImpl) {
  const sandbox = {
    console, Math, Date, Uint8Array, ArrayBuffer, DataView, parseInt,
    setTimeout, clearTimeout, WebSocket: WebSocketImpl, encodeURIComponent, Array,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/moomoo-transport.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/x18k-protocol.js'), 'utf8'), sandbox);

  // Globals the socket object closes over: the bundled codec, the client's own
  // rate-limit counters, and a few bits of unrelated client state.
  vm.runInContext(`
    var sl = { encode: function (v) { return __encode(v); } };
    var ol = { decode: function (v) { return __decode(v); } };
    var q3 = null, Wt = {}, We = 0, He = 0, np = null, v = 0;
    var ni = 0, Dn = null, ui = 0, St = 0, qt = 0, A = 0, ee = 0;
    function b() {}
    function Hy() { return 0; }
    var ${sliceSocketObject()};
    this.__T = T;
  `, sandbox);
  sandbox.__encode = (v) => msgpack.encode(v);
  sandbox.__decode = (v) => msgpack.decode(Buffer.from(v));
  return sandbox.__T;
}

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`  ok    ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
const bytes = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/* ================= part zero: the client's own tables ================= *
 * The dynamic tests below supply their own handler map, so check separately
 * that the map x18k actually registers covers the shipped inbound alphabet and
 * that everything it sends is a name the shipped server knows.
 */
console.log('client tables');
{
  const at = built.indexOf('T.connect(i, function(e) {');
  const open = built.indexOf('{', built.indexOf('}, {', at) + 3);
  let depth = 0, end = -1;
  for (let i = open; i < built.length; i++) {
    if (built[i] === '{') depth++;
    else if (built[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const mapSrc = built.slice(open + 1, end);
  const keys = [...mapSrc.matchAll(/(?:^|,)\s*([A-Za-z0-9]+)\s*:/g)].map((m) => m[1]);
  const missing = game.To.filter((n) => !keys.includes(n));
  const extra = keys.filter((n) => !game.To.includes(n));
  check(`handler map covers all ${game.To.length} inbound names`,
    missing.length === 0 && extra.length === 0,
    missing.length ? `missing ${missing.join(',')}` : `unexpected ${extra.join(',')}`);

  // Outbound names, after the three the script rewrites inline.
  const rewrite = { d: 'F', a: '9', G: 'z' };
  const sends = [...built.matchAll(/\bT\.send\("([^"]+)"/g)].map((m) => m[1]);
  const wire = [...new Set(sends.map((n) => rewrite[n] || n))];
  const unknown = wire.filter((n) => !game.bo.includes(n));
  check(`all ${wire.length} outbound names exist in the shipped alphabet`,
    unknown.length === 0, unknown.join(','));
}

/* ================= part one: stub socket ================= */
let sent = [];
class StubSocket {
  constructor(url) { this.url = url; this.readyState = 1; StubSocket.last = this; }
  send(data) { sent.push(data); }
  close() { this.closed = true; }
}
StubSocket.OPEN = 1;

const SEED = 0x3fa27c15;
const KEY_HEX = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';
const tables = game.Po(SEED >>> 0);
const KEY = Buffer.from(KEY_HEX, 'hex');

const T = loadSocket(StubSocket);

const fired = [];
const handlers = {};
for (const n of game.To) handlers[n] = (...args) => fired.push([n, args]);

let readyCalls = 0;
T.connect('wss://example.invalid', (err) => { readyCalls++; if (err) fired.push(['__err', [err]]); }, handlers);
const sock = StubSocket.last;

console.log('handshake');
check('socket opened', !!sock);
sock.onopen();
check('ready callback not fired on open', readyCalls === 0);
sock.onmessage({ data: msgpack.encode(['io-init', [5, SEED, KEY_HEX, game.Ht]]) });
check('ready callback fired on io-init', readyCalls === 1);
check('socketId recorded', T.socketId === 5, String(T.socketId));
check('transport negotiated', !!T.proto);
check('c2s table matches server',
  JSON.stringify(T.proto.tables.c2s.enc) === JSON.stringify(tables.c2s.enc));

/* x18k's own outbound vocabulary, with the three names it rewrites inline. */
console.log('outbound frames');
const OUTBOUND = {
  'M': 'M', 'D': 'D', 'a': '9', 'd': 'F', 'G': 'z', 'H': 'H', 'K': 'K', 'L': 'L',
  'N': 'N', 'b': 'b', 'P': 'P', 'Q': 'Q', 'c': 'c', '6': '6', 'S': 'S', '0': '0',
};
let expectedSeq = 0;
for (const [clientName, wireName] of Object.entries(OUTBOUND)) {
  sent = [];
  T.send(clientName, 1, 2);
  if (sent.length !== 1) { check(`send "${clientName}"`, false, 'no frame emitted'); continue; }
  const frame = bytes(sent[0]);
  const sig = frame.subarray(0, game.jt);
  const payload = frame.subarray(game.jt);
  const decoded = msgpack.decode(Buffer.from(payload));
  expectedSeq++;
  const okOp = decoded[0] === tables.c2s.enc[wireName];
  const okSeq = decoded[2] === expectedSeq;
  const okSig = same(sig, game.Eo(new Uint8Array(KEY), payload));
  check(`send "${clientName}" -> "${wireName}"`, okOp && okSeq && okSig,
    !okOp ? `opcode ${decoded[0]} != ${tables.c2s.enc[wireName]}`
      : !okSeq ? `seq ${decoded[2]} != ${expectedSeq}` : 'bad signature');
}

console.log('outbound: unknown packet is dropped');
sent = [];
T.send('definitely-not-a-packet', 1);
check('unknown name emits nothing', sent.length === 0);

console.log('inbound dispatch');
for (const wireName of game.To) {
  fired.length = 0;
  sock.onmessage({ data: msgpack.encode([tables.s2c.enc[wireName], ['payload', 7]]) });
  const ok = fired.length === 1 && fired[0][0] === wireName &&
    JSON.stringify(fired[0][1]) === JSON.stringify(['payload', 7]);
  check(`opcode ${String(tables.s2c.enc[wireName]).padStart(2)} -> handler "${wireName}"`, ok,
    fired.length ? `got "${fired[0][0]}"` : 'no handler fired');
}

console.log('inbound: unknown opcode ignored');
fired.length = 0;
sock.onmessage({ data: msgpack.encode([4242, ['x']]) });
check('unmapped opcode ignored', fired.length === 0);

console.log('close');
T.close();
check('state cleared on close', T.proto === null && T.connected === false);

/* ================= part two: real socket login ================= */
const L_SEED = 0x77c1a9e3;
const L_KEY = crypto.randomBytes(32);
const L_TABLES = game.Po(L_SEED >>> 0);
const seen = [];
let lastSeq = 0, badSig = 0, badSeq = 0;

const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
wss.on('connection', (ws) => {
  ws.send(msgpack.encode(['io-init', [3, L_SEED, L_KEY.toString('hex'), game.Ht]]));
  ws.on('message', (raw) => {
    const buf = Buffer.from(raw);
    const sig = buf.subarray(0, game.jt);
    const payload = buf.subarray(game.jt);
    const expect = crypto.createHmac('sha256', L_KEY).update(payload).digest().subarray(0, game.jt);
    if (!sig.equals(expect)) { badSig++; return; }
    const [op, args, seq] = msgpack.decode(payload);
    if (typeof seq !== 'number' || seq <= lastSeq) { badSeq++; return; }
    lastSeq = seq;
    const name = L_TABLES.c2s.dec[op];
    seen.push({ name, args, seq });
    if (name === 'M') {
      ws.send(msgpack.encode([L_TABLES.s2c.enc['C'], [3]]));
      ws.send(msgpack.encode([L_TABLES.s2c.enc['A'], [{ teams: [] }]]));
    } else if (name === '0') {
      ws.send(msgpack.encode([L_TABLES.s2c.enc['0'], []]));
    }
  });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

wss.on('listening', async () => {
  const { port } = wss.address();
  const T2 = loadSocket(WebSocket);
  const got = [];
  const h2 = {};
  for (const n of game.To) h2[n] = (...args) => got.push(n);

  let ready = false, err = null;
  console.log('\nlogin');
  T2.connect(`ws://127.0.0.1:${port}/?token=rehearsal`, (e) => { if (e) err = e; else ready = true; }, h2);
  await wait(300);
  check('handshake completed', ready && !err, err ? String(err) : 'no io-init');
  check('transport negotiated', !!T2.proto);

  T2.send('M', { name: 'rehearsal', moofoll: 1, skin: 0 });
  await wait(300);
  const spawn = seen.find((s) => s.name === 'M');
  check('spawn accepted by server', !!spawn);
  check('spawn payload intact', !!spawn && spawn.args[0] && spawn.args[0].name === 'rehearsal',
    spawn ? JSON.stringify(spawn.args) : '');
  check('no signature rejections', badSig === 0, `${badSig} frame(s) failed HMAC`);
  check('no sequence rejections', badSeq === 0, `${badSeq} frame(s) had a bad seq`);
  check('client received game setup', got.includes('C'), got.join(',') || 'nothing');
  check('client received team init', got.includes('A'));

  got.length = 0;
  T2.send('0');
  await wait(250);
  check('latency probe round trip', got.includes('0'));

  const seqs = seen.map((s) => s.seq);
  check('sequence numbers strictly increase',
    seqs.every((v, i) => i === 0 || v > seqs[i - 1]), JSON.stringify(seqs));

  console.log('\npackets the server accepted: ' + seen.map((s) => `${s.name}#${s.seq}`).join(' '));
  T2.close();
  for (const client of wss.clients) client.terminate();
  wss.close();
  console.log('');
  if (failures) {
    console.log(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log('x18k transport + login passed.');
  process.exit(0);
});
