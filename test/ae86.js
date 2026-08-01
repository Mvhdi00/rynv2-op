// The AE86 script carries the same EXP shim as the External Client, so this
// checks that the copy is genuinely identical (rather than a drifted fork) and
// then re-runs the protocol checks against AE86's own copy.
const crypto = require('crypto');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const { EXP, FakeWebSocket, window } = extract.loadAe86();

const enc = new Encoder(), dec = new Decoder();

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
console.log('\n1. the shim is the same one the External Client ships');
check(extract.shimsMatch(), 'AE86 and ExternalClient carry a byte-identical EXP shim');

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

let mpOk = true;
for (let n = 0; n < 1500 && mpOk; n++) {
  const v = [String.fromCharCode(65 + (n % 26)), [n, n / 3, n % 2 === 0, null, { a: n }], n];
  if (!Buffer.from(EXP.encode(v)).equals(Buffer.from(enc.encode(v)))) mpOk = false;
  if (JSON.stringify(EXP.decode(enc.encode(v))) !== JSON.stringify(v)) mpOk = false;
}
check(mpOk, 'bundled msgpack round-trips against the game codec');

// --------------------------------------------------------------------------
console.log('\n3. framing on this script\'s own shim');

const SEED = 0x777AE86, KEY_HEX = 'feedfacedeadbeef0123456789abcdef';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const sock = new window.WebSocket('wss://server');
sock.deliver(enc.encode(['io-init', [9, SEED, KEY_HEX, game.Ht]]));
check(EXP.isSecure(sock), 'handshake captured at construction time');

sock.sentRaw.length = 0;
EXP.send(sock, 'M', [{ name: 'ae86', moofoll: 1, skin: 0 }]);
const frame = Buffer.from(sock.sentRaw[0]);
check(Buffer.from(game.Eo(key, frame.subarray(6))).equals(frame.subarray(0, 6)),
      'server-side HMAC verification passes');
const parsed = dec.decode(new Uint8Array(frame.subarray(6)));
check(tables.c2s.dec[parsed[0]] === 'M', 'opcode maps back to "M"');
check(parsed[2] === 1, 'sequence starts at 1');

// --------------------------------------------------------------------------
console.log('\n4. legacy names this script still uses');

// AE86 sends "f" for move, which is not a name the current server knows.
sock.sentRaw.length = 0;
EXP.send(sock, 'f', [1.0, 1]);
check(sock.sentRaw.length === 1, '"f" was transmitted');
const fp = dec.decode(new Uint8Array(Buffer.from(sock.sentRaw[0]).subarray(6)));
check(tables.c2s.dec[fp[0]] === '9', '"f" is remapped to the move opcode "9"');

const used = ['6', '9', 'D', 'F', 'H', 'K', 'M', 'N', 'S', 'b', 'c', 'e', 'z', 'f'];
let allKnown = true;
for (const name of used) {
  sock.sentRaw.length = 0;
  EXP.send(sock, name, [1]);
  if (sock.sentRaw.length !== 1) { allKnown = false; break; }
}
check(allKnown, 'all ' + used.length + ' names this script sends resolve to opcodes');

// --------------------------------------------------------------------------
console.log('\n5. incoming and trampoline');

const inbound = EXP.receive(sock, enc.encode([tables.s2c.enc['P'], [7]]));
check(inbound.type === 'P', 'numeric opcode decoded to "P" (killPlayer)');
check(EXP.receive(sock, enc.encode([9999, []])) === null, 'unmapped opcode returns null');

const captured = FakeWebSocket.prototype.send;
let reached = false;
EXP.setHandler(function () { reached = true; });
captured.call(new window.WebSocket('wss://x'), new Uint8Array([1]));
check(reached, 'the reference the game captured reaches the client handler');
EXP.setHandler(null);

console.log('\n' + (fails === 0 ? '=> ALL AE86 TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
