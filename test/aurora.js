// Aurora carries the same EXP shim as the External Client and AE86. This
// checks the copies have not drifted, then re-runs the protocol checks against
// Aurora's own copy and covers the packet names Aurora actually sends.
const crypto = require('crypto');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const { EXP, FakeWebSocket, window } = extract.loadAurora();

const enc = new Encoder(), dec = new Decoder();

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
console.log('\n1. shim parity across all three hook-based scripts');
check(extract.shimsMatch(), 'ExternalClient, AE86 and Aurora carry a byte-identical EXP shim');

// --------------------------------------------------------------------------
console.log('\n2. protocol port matches the game bundle');

check(EXP._internals.HEADER_LEN === game.jt, 'header length (' + EXP._internals.HEADER_LEN + ')');
check(EXP._internals.MODE_SECURE === game.Ht, 'secure mode marker');

let tablesOk = true;
for (let n = 0; n < 3000 && tablesOk; n++) {
  const seed = (Math.random() * 4294967296) >>> 0;
  if (JSON.stringify(game.Po(seed)) !== JSON.stringify(EXP._internals.buildTables(seed))) tablesOk = false;
}
check(tablesOk, 'opcode tables identical over 3000 random seeds');

let hmacOk = true;
for (let n = 0; n < 300 && hmacOk; n++) {
  const key = crypto.randomBytes(1 + Math.floor(Math.random() * 80));
  const msg = crypto.randomBytes(Math.floor(Math.random() * 250));
  if (!Buffer.from(EXP._internals.tag(key, msg)).equals(Buffer.from(game.Eo(key, msg)))) hmacOk = false;
}
check(hmacOk, 'HMAC tags identical to the game over 300 random pairs');

// --------------------------------------------------------------------------
console.log('\n3. framing');

const SEED_OK = 0x5A1B2C3D;
const KEY_HEX = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const tables = game.Po(SEED_OK);
const key = game.Ro(KEY_HEX);

const sock = new window.WebSocket('wss://server');
sock.deliver(enc.encode(['io-init', [4, SEED_OK, KEY_HEX, game.Ht]]));
check(EXP.isSecure(sock), 'handshake captured at construction time');

sock.sentRaw.length = 0;
EXP.send(sock, 'M', [{ name: 'aurora', moofoll: 1, skin: 0 }]);
const frame = Buffer.from(sock.sentRaw[0]);
check(Buffer.from(game.Eo(key, frame.subarray(6))).equals(frame.subarray(0, 6)),
      'server-side HMAC verification passes');
const parsed = dec.decode(new Uint8Array(frame.subarray(6)));
check(tables.c2s.dec[parsed[0]] === 'M', 'opcode maps back to "M"');
check(parsed[2] === 1, 'sequence starts at 1');

sock.sentRaw.length = 0;
EXP.send(sock, 'D', [0.5]);
EXP.send(sock, '9', [1.0, 1]);
const seqs = sock.sentRaw.map(f => dec.decode(new Uint8Array(Buffer.from(f).subarray(6)))[2]);
check(JSON.stringify(seqs) === '[2,3]', 'sequence increments monotonically: ' + JSON.stringify(seqs));

// --------------------------------------------------------------------------
console.log('\n4. the packet names Aurora sends');

// everything Aurora emits via packet()/sendWS, including the legacy "d"
const used = ['0', '6', '9', 'D', 'F', 'H', 'K', 'M', 'N', 'P', 'Q', 'S', 'b', 'c', 'd', 'e', 'z'];
let allKnown = true, failedName = null;
for (const name of used) {
  sock.sentRaw.length = 0;
  EXP.send(sock, name, [1]);
  if (sock.sentRaw.length !== 1) { allKnown = false; failedName = name; break; }
}
check(allKnown, 'all ' + used.length + ' names Aurora sends resolve to opcodes'
      + (failedName ? ' (failed on "' + failedName + '")' : ''));

sock.sentRaw.length = 0;
EXP.send(sock, 'd', [1, 2, 3]);
const dp = dec.decode(new Uint8Array(Buffer.from(sock.sentRaw[0]).subarray(6)));
check(tables.c2s.dec[dp[0]] === 'F', 'the legacy name "d" is remapped to "F"');

// --------------------------------------------------------------------------
console.log('\n5. incoming and trampoline');

const inbound = EXP.receive(sock, enc.encode([tables.s2c.enc['C'], [12]]));
check(inbound.type === 'C', 'numeric opcode decoded to "C" (setupGame)');
check(EXP.receive(sock, enc.encode([12345, []])) === null, 'unmapped opcode returns null');

const captured = FakeWebSocket.prototype.send;
let reached = false;
EXP.setHandler(function () { reached = true; });
captured.call(new window.WebSocket('wss://x'), new Uint8Array([1]));
check(reached, 'the reference the game captured reaches the client handler');
EXP.setHandler(null);

// --------------------------------------------------------------------------
console.log('\n6. per-socket isolation (bots get their own key)');

const KEY2 = 'aaaabbbbccccddddeeeeffff00001111', SEED2 = 0x13572468;
const bot = new window.WebSocket('wss://bot');
bot.deliver(enc.encode(['io-init', [5, SEED2, KEY2, game.Ht]]));
bot.sentRaw.length = 0;
EXP.send(bot, 'M', [{ name: 'bot' }]);
const bf = Buffer.from(bot.sentRaw[0]);
check(Buffer.from(game.Eo(game.Ro(KEY2), bf.subarray(6))).equals(bf.subarray(0, 6)),
      'bot socket signs with its own key');
check(!Buffer.from(game.Eo(key, bf.subarray(6))).equals(bf.subarray(0, 6)),
      'the main socket\'s key does not validate it');

console.log('\n' + (fails === 0 ? '=> ALL AURORA TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
