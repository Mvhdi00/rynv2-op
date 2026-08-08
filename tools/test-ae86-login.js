/*
 * Login rehearsal for Ae86_v10_2_Fixed.user.js.
 *
 * Stands up a real WebSocket server on localhost that speaks the shipped
 * moomoo.io transport — it issues io-init, verifies the truncated HMAC on
 * every client frame, rejects replayed or out-of-order sequence numbers, and
 * answers on permuted opcodes — then drives the patched io-client module
 * through a full login: connect, handshake, spawn, receive game setup, and
 * exchange a latency probe.
 *
 * This exercises the real client code over a real socket. It is not a
 * substitute for the live servers, which this environment cannot reach; it
 * proves the frames Ae86 now puts on the wire are the frames the shipped
 * server expects.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const msgpack = require('msgpack-lite');
const { WebSocketServer } = require('ws');

const ROOT = path.join(__dirname, '..');
const built = fs.readFileSync(path.join(ROOT, 'Ae86_v10_2_Fixed.user.js'), 'utf8');
const gameLines = fs.readFileSync(path.join(ROOT, 'src/game_index.js'), 'utf8').split('\n');

const gameCtx = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt, console };
vm.createContext(gameCtx);
{
  const lines = gameLines.slice(277, 405);
  lines[0] = 'const ' + lines[0].trimStart().slice(2);
  vm.runInContext(lines.join('\n') + '\n;this.__game = { Po, jt, Ht };', gameCtx);
}
const game = gameCtx.__game;

const SEED = 0x21c4f70b;
const KEY = crypto.randomBytes(32);
const KEY_HEX = KEY.toString('hex');
const tables = game.Po(SEED >>> 0);

let failures = 0;
const log = [];
function check(name, ok, detail) {
  if (ok) console.log(`  ok    ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

/* ---------------- server ---------------- */
const seen = [];
let lastSeq = 0;
let badSig = 0;
let badSeq = 0;

const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });

function sendPacket(ws, name, args) {
  const op = tables.s2c.enc[name];
  ws.send(msgpack.encode([op, args]));
}

wss.on('connection', (ws, req) => {
  ws.binaryType = 'arraybuffer';
  seen.push({ kind: 'connect', url: req.url });
  // io-init: [socketId, tableSeed, hmacKeyHex, transportMode]
  ws.send(msgpack.encode(['io-init', [11, SEED, KEY_HEX, game.Ht]]));

  ws.on('message', (raw) => {
    const buf = Buffer.from(raw);
    const sig = buf.subarray(0, game.jt);
    const payload = buf.subarray(game.jt);
    const expect = crypto.createHmac('sha256', KEY).update(payload).digest().subarray(0, game.jt);
    if (!sig.equals(expect)) { badSig++; return; }

    const [op, args, seq] = msgpack.decode(payload);
    if (typeof seq !== 'number' || seq <= lastSeq) { badSeq++; return; }
    lastSeq = seq;

    const name = tables.c2s.dec[op];
    seen.push({ kind: 'packet', name, args, seq });

    if (name === 'M') {
      // spawn -> tell the client the game is set up, then send one update
      sendPacket(ws, 'C', [11]);
      sendPacket(ws, 'A', [{ teams: [] }]);
      sendPacket(ws, 'a', [[]]);
    } else if (name === '0') {
      sendPacket(ws, '0', []);
    }
  });
});

/* ---------------- client ---------------- */
function loadIoClient() {
  const marker = "'./src/js/libs/io-client.js': function (";
  const at = built.indexOf(marker);
  const argsEnd = built.indexOf(')', at);
  const args = built.slice(at + marker.length, argsEnd);
  const open = built.indexOf('{', argsEnd);
  let depth = 0, end = -1;
  for (let i = open; i < built.length; i++) {
    if (built[i] === '{') depth++;
    else if (built[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const sandbox = {
    console, Math, Date, Uint8Array, ArrayBuffer, DataView, parseInt,
    setTimeout, clearTimeout, WebSocket, encodeURIComponent,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/moomoo-transport.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ae86-protocol.js'), 'utf8'), sandbox);
  vm.runInContext('var antiKick = false, secPacket = 0, minPacket = 0, pktSended = 0;', sandbox);
  vm.runInContext(`this.__f = function (${args}) ${built.slice(open, end)};`, sandbox);
  const mod = { exports: {} };
  sandbox.__f(mod, mod.exports, () => msgpack);
  return mod.exports;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

wss.on('listening', async () => {
  const { port } = wss.address();
  const io = loadIoClient();

  const fired = [];
  const handlers = {};
  for (const n of ['id', 'd', '1', '2', '4', '33', '5', '6', 'a', 'aa', '7', '8', 'sp', '9', 'h',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', 'ac', 'ad', 'an', 'st', 'sa',
    'us', 'ch', 'mm', 't', 'p', 'pp']) {
    handlers[n] = (...args) => fired.push({ name: n, args });
  }

  let ready = false, readyErr = null;
  console.log('login');
  io.connect(`ws://127.0.0.1:${port}/?token=rehearsal`, (err) => {
    if (err) readyErr = err; else ready = true;
  }, handlers);

  await wait(250);
  check('handshake completed', ready && !readyErr, readyErr ? String(readyErr) : 'no io-init');
  check('socketId assigned by server', io.socketId === 11, String(io.socketId));
  check('transport negotiated', !!io.proto && io.proto.mode === game.Ht);

  // Spawn, exactly as the client's own menu path does.
  io.send('sp', { name: 'rehearsal', moofoll: 1, skin: 0 });
  await wait(250);

  const spawn = seen.find((s) => s.kind === 'packet' && s.name === 'M');
  check('spawn accepted by server', !!spawn, 'server never saw a valid spawn frame');
  check('spawn payload intact', !!spawn &&
    spawn.args[0] && spawn.args[0].name === 'rehearsal' && spawn.args[0].moofoll === 1,
    spawn ? JSON.stringify(spawn.args) : '');
  check('no signature rejections', badSig === 0, `${badSig} frame(s) failed HMAC`);
  check('no sequence rejections', badSeq === 0, `${badSeq} frame(s) had a bad seq`);

  check('client received game setup', fired.some((f) => f.name === '1'),
    fired.map((f) => f.name).join(',') || 'nothing');
  check('client received team init', fired.some((f) => f.name === 'id'));
  check('client received player update', fired.some((f) => f.name === '33'));

  // Latency probe round trip.
  fired.length = 0;
  io.send('pp');
  await wait(200);
  check('latency probe round trip', fired.some((f) => f.name === 'pp'));

  // Sequence numbers must strictly increase across the session.
  const seqs = seen.filter((s) => s.kind === 'packet').map((s) => s.seq);
  check('sequence numbers strictly increase',
    seqs.every((v, i) => i === 0 || v > seqs[i - 1]), JSON.stringify(seqs));

  console.log('\npackets the server accepted: ' +
    seen.filter((s) => s.kind === 'packet').map((s) => `${s.name}#${s.seq}`).join(' '));

  io.close();
  wss.close();
  console.log('');
  if (failures) { console.log(`${failures} check(s) FAILED`); process.exit(1); }
  console.log('Login rehearsal passed.');
});
