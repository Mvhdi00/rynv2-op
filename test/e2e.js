// Drives the patched main socket (`ee`) against a simulated moomoo.io server
// speaking the current protocol, and checks the protocol port byte-for-byte
// against the helpers lifted out of the live game bundle.
const crypto = require('crypto');
const extract = require('./extract.js');

const { RVNP, game, msgpack } = extract.load();
const { Encoder, Decoder } = msgpack;

global.RVNP = RVNP;
global.rvnProto = null;

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
console.log('\n1. protocol port matches the game bundle');

check(RVNP.headerLen === game.jt, 'header length (' + RVNP.headerLen + ')');
check(RVNP.modeSecure === game.Ht, 'secure mode marker (' + RVNP.modeSecure + ')');

let tablesOk = true;
for (let n = 0; n < 5000 && tablesOk; n++) {
  const seed = (Math.random() * 4294967296) >>> 0;
  if (JSON.stringify(game.Po(seed)) !== JSON.stringify(RVNP.buildTables(seed))) tablesOk = false;
}
check(tablesOk, 'opcode tables identical over 5000 random seeds');

let hmacOk = true, hmacRefOk = true;
for (let n = 0; n < 400 && hmacOk && hmacRefOk; n++) {
  const key = crypto.randomBytes(1 + Math.floor(Math.random() * 100));
  const msg = crypto.randomBytes(Math.floor(Math.random() * 300));
  const ours = Buffer.from(RVNP.tag(key, msg));
  if (!ours.equals(Buffer.from(game.Eo(key, msg)))) hmacOk = false;
  if (!ours.equals(crypto.createHmac('sha256', key).update(msg).digest().subarray(0, game.jt))) hmacRefOk = false;
}
check(hmacOk, 'HMAC tag identical to the game over 400 random key/message pairs');
check(hmacRefOk, 'HMAC tag identical to node crypto HMAC-SHA256');

let hexOk = true;
for (let n = 0; n < 200 && hexOk; n++) {
  const hex = crypto.randomBytes(16 + Math.floor(Math.random() * 16)).toString('hex');
  if (Buffer.from(game.Ro(hex)).toString('hex') !== Buffer.from(RVNP.hexToBytes(hex)).toString('hex')) hexOk = false;
}
check(hexOk, 'hex key parsing identical over 200 samples');

// --------------------------------------------------------------------------
// stubs for the mod globals that connect()/send() touch
global.fS = { min: false };
global.packets = 0;
global.minutePackets = 0;
global.tick = 0;
global.lastAccept = 0;
global.moveAuto = null;
global.moveDirection = null;
global.Tn = null;
global.hitPacket = 0;
global.ww = 0;
global.primary = 0;
global.secondary = 1;
global.websocket = null;
global.addChatLog = () => {};
global.generateRandomColor = () => '#fff';
global.ql = new Encoder();
global.Wl = new Decoder();

const sent = [];
class FakeSocket {
  constructor() { this.readyState = 1; this.binaryType = ''; }
  send() { throw new Error('mod used socket.send() instead of the captured native send'); }
  close() {}
}
RVNP.nativeSend = function (d) { sent.push(Buffer.from(d)); };
global.WebSocket = FakeSocket;
global.WebSocket.OPEN = 1;

const ee = eval(extract.eeExpression());

const SEED = 0xC0FFEE01;
const KEY_HEX = '8f2b1c9d4e6a70b3c5d8e1f2a3b4c5d6';
const serverTables = game.Po(SEED);
const serverKey = game.Ro(KEY_HEX);
const enc = new Encoder(), dec = new Decoder();

let connectCalls = 0;
const received = [];
const handlers = {};
for (const name of game.To) handlers[name] = (...a) => received.push([name, a]);

ee.connect('wss://fake', () => { connectCalls++; }, handlers);
const sock = ee.socket;

// --------------------------------------------------------------------------
console.log('\n2. handshake ordering');
check(connectCalls === 0, 'connect callback does not fire before io-init');
sock.onopen();
check(connectCalls === 0, 'still not fired after onopen');
check(ee.connected === true, 'connected flag set on open');

sock.onmessage({ data: enc.encode(['io-init', [42, SEED, KEY_HEX, game.Ht]]).buffer });
check(connectCalls === 1, 'connect callback fires exactly once, on io-init');
check(ee.socketId === 42, 'socketId captured');
check(global.rvnProto !== null && global.rvnProto.mode === 1, 'secure protocol state established');

// --------------------------------------------------------------------------
console.log('\n3. client -> server framing');
sent.length = 0;
ee.send('M', { name: 'Revelation', moofoll: 1, skin: 0 });   // spawn / entry packet
check(sent.length === 1, 'spawn packet transmitted');

const frame = sent[0];
const payload = frame.subarray(game.jt);
check(Buffer.from(game.Eo(serverKey, payload)).equals(frame.subarray(0, game.jt)),
      'server-side HMAC verification passes');

const decoded = dec.decode(new Uint8Array(payload));
check(serverTables.c2s.dec[decoded[0]] === 'M', 'server maps opcode ' + decoded[0] + ' back to "M"');
check(JSON.stringify(decoded[1]) === JSON.stringify([{ name: 'Revelation', moofoll: 1, skin: 0 }]), 'args preserved');
check(decoded[2] === 1, 'sequence starts at 1');

sent.length = 0;
ee.send('D', 1.25);
ee.send('K', 1);
const seqs = sent.map(f => dec.decode(new Uint8Array(f.subarray(game.jt)))[2]);
check(JSON.stringify(seqs) === '[2,3]', 'sequence increments monotonically: ' + JSON.stringify(seqs));

sent.length = 0;
ee.send('NOT_A_PACKET', 1);
check(sent.length === 0, 'unknown packet name dropped, not sent as garbage');

// --------------------------------------------------------------------------
console.log('\n4. server -> client opcode mapping');
received.length = 0;
sock.onmessage({ data: enc.encode([serverTables.s2c.enc['A'], [{ teams: [] }]]).buffer });
sock.onmessage({ data: enc.encode([serverTables.s2c.enc['P'], []]).buffer });
check(received.length === 2, 'both packets dispatched');
check(received[0][0] === 'A', 'numeric opcode decoded to handler "A" (setInitData)');
check(received[1][0] === 'P', 'numeric opcode decoded to handler "P" (died)');

received.length = 0;
sock.onmessage({ data: enc.encode([9999, []]).buffer });
check(received.length === 0, 'unmapped opcode ignored instead of throwing');

// --------------------------------------------------------------------------
console.log('\n5. legacy fallback (server without secure mode)');
ee.close();
check(global.rvnProto === null, 'protocol state cleared on close');
ee.socket = null;
ee.connected = false;
connectCalls = 0;
ee.connect('wss://fake', () => { connectCalls++; }, handlers);
const sock2 = ee.socket;
sock2.onopen();
sock2.onmessage({ data: enc.encode(['io-init', [7]]).buffer });   // no seed/key/mode
check(connectCalls === 1, 'connect callback still fires on legacy io-init');
check(global.rvnProto === null, 'no secure state for a legacy server');

sent.length = 0;
ee.send('M', { name: 'x' });
const plain = dec.decode(new Uint8Array(sent[0]));
check(plain[0] === 'M' && plain.length === 2, 'legacy frame is plain [name, args] with no MAC');

received.length = 0;
sock2.onmessage({ data: enc.encode(['A', [{ teams: [] }]]).buffer });
check(received.length === 1 && received[0][0] === 'A', 'legacy string opcodes still dispatch');

console.log('\n' + (fails === 0 ? '=> ALL MAIN-SOCKET TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
