// Robotics Official is a fork of the Aurora source, so it lands in the same
// family and gets the same EXP shim. What is specific to it is checked here:
// the stray line in the metadata block that stopped it from running at all,
// the packet names it actually sends, and the pieces that were rewired.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const { EXP, FakeWebSocket, window } = extract.loadRobotics();
const enc = new Encoder(), dec = new Decoder();

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'Robotics.user.js'), 'utf8');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
console.log('\n1. the metadata block parses and the body is reachable');

const metaEnd = src.indexOf('// ==/UserScript==');
const meta = src.slice(0, metaEnd).split('\n');
check(meta.every(l => l === '' || l.startsWith('//')),
      'every line inside the metadata block is a comment');
check(!meta.some(l => l.trim() === 'a'),
      'the bare "a" that threw ReferenceError on load is gone');
check(/^\/\/ @run-at\s+document-start$/m.test(src.slice(0, metaEnd)),
      'runs at document-start');
check(/document\.addEventListener\("DOMContentLoaded", __robotisBoot/.test(src),
      'the body is deferred to DOMContentLoaded');
check(src.indexOf('const EXP = (function() {') < src.indexOf('function __robotisBoot() {'),
      'the shim is installed before the deferred body');

// --------------------------------------------------------------------------
console.log('\n2. shim parity');
check(extract.shimsMatch(), 'Robotics carries a byte-identical EXP shim');

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
console.log('\n3. the transport is actually wired in');

// nothing may still be reaching for the codec this script never defined
const body = src.slice(src.indexOf('function __robotisBoot() {'));
check(!/(^|[^.\w])msgpack\.(encode|decode)\(/.test(body),
      'no bare msgpack.encode/decode left (it was never defined or @require\'d)');
check(!/window\.msgpack\.(encode|decode)\(/.test(body),
      'no window.msgpack.encode/decode left in the client');
check(!/WebSocket\.prototype\.(n)?send\s*=/.test(body),
      'the client no longer reassigns WebSocket.prototype.send -- the shim owns it');
check(/EXP\.setHandler\(function \(message\) \{/.test(body),
      'the hook is registered through the shim instead');
check(/function applyOutgoing\(type, data\)/.test(body),
      'the outgoing rules are shared by the hook and packet()');
check((body.match(/EXP\.receive\(/g) || []).length === 3,
      'all three receive paths go through the shim (game, bot sniffer, bot client)');

// --------------------------------------------------------------------------
console.log('\n4. framing');

const SEED = 0x6B2D91F4;
const KEY_HEX = 'fedcba98765432100123456789abcdef';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const sock = new window.WebSocket('wss://server');
sock.deliver(enc.encode(['io-init', [3, SEED, KEY_HEX, game.Ht]]));
check(EXP.isSecure(sock), 'handshake captured at construction time');

sock.sentRaw.length = 0;
EXP.send(sock, 'M', [{ name: 'robotics', moofoll: true, skin: 0 }]);
const frame = Buffer.from(sock.sentRaw[0]);
check(Buffer.from(game.Eo(key, frame.subarray(6))).equals(frame.subarray(0, 6)),
      'server-side HMAC verification passes');
const parsed = dec.decode(new Uint8Array(frame.subarray(6)));
check(tables.c2s.dec[parsed[0]] === 'M', 'opcode maps back to "M"');
check(parsed[2] === 1, 'sequence starts at 1');

sock.sentRaw.length = 0;
EXP.send(sock, '9', [0.5, 1]);
EXP.send(sock, 'K', [1]);
const seqs = sock.sentRaw.map(f => dec.decode(new Uint8Array(Buffer.from(f).subarray(6)))[2]);
check(JSON.stringify(seqs) === '[2,3]', 'sequence increments monotonically: ' + JSON.stringify(seqs));

// --------------------------------------------------------------------------
console.log('\n5. the packet names Robotics sends');

// harvested from the packet(...) and sendWS(...) calls in the shipped file
const used = [...new Set((body.match(/(?:packet|sendWS)\("([^"]+)"/g) || [])
  .map(m => m.slice(m.indexOf('("') + 2, -1)))].sort();
let allKnown = true, failedName = null;
for (const name of used) {
  sock.sentRaw.length = 0;
  EXP.send(sock, name, [1]);
  if (sock.sentRaw.length !== 1) { allKnown = false; failedName = name; break; }
}
check(allKnown, 'all ' + used.length + ' names resolve to opcodes'
      + (failedName ? ' (failed on "' + failedName + '")' : ''));

sock.sentRaw.length = 0;
EXP.send(sock, 'd', [1, 2, 3]);
const dp = dec.decode(new Uint8Array(Buffer.from(sock.sentRaw[0]).subarray(6)));
check(tables.c2s.dec[dp[0]] === 'F', 'the legacy name "d" is remapped to "F"');

// --------------------------------------------------------------------------
console.log('\n6. incoming and the round trip the client relies on');

const inbound = EXP.receive(sock, enc.encode([tables.s2c.enc['C'], [12]]));
check(inbound.type === 'C' && inbound.args[0] === 12, 'numeric opcode decoded to "C" (setupGame)');
check(EXP.receive(sock, enc.encode([12345, []])) === null, 'unmapped opcode returns null');

// the hook unframes what the game handed it, applies the rules, then re-frames
sock.sentRaw.length = 0;
EXP.send(sock, '6', ['hello']);
const chat = Buffer.from(sock.sentRaw[0]);
const back = EXP.unframe(sock, chat);
check(back && back.type === '6' && back.args[0] === 'hello',
      'unframe() reverses send(), which is what the hook does on every packet');

// --------------------------------------------------------------------------
console.log('\n7. per-socket isolation (bots get their own key)');

const KEY2 = '00112233445566778899aabbccddeeff', SEED2 = 0x24681357;
const bot = new window.WebSocket('wss://bot');
bot.deliver(enc.encode(['io-init', [9, SEED2, KEY2, game.Ht]]));
bot.sentRaw.length = 0;
EXP.send(bot, 'M', [{ name: 'bot' }]);
const bf = Buffer.from(bot.sentRaw[0]);
check(Buffer.from(game.Eo(game.Ro(KEY2), bf.subarray(6))).equals(bf.subarray(0, 6)),
      'bot socket signs with its own key');
check(!Buffer.from(game.Eo(key, bf.subarray(6))).equals(bf.subarray(0, 6)),
      'the main socket\'s key does not validate it');

// --------------------------------------------------------------------------
console.log('\n8. captcha');

check(!/new AltSolver\(\)/.test(body), 'the ALTCHA solver is no longer used for bot tokens');
check(/EXP\.freshToken\(\)/.test(body), 'bots ask Turnstile for a token instead');
check(/Object\.defineProperty\(Altcha, "_pool"/.test(body),
      'the ALTCHA worker pool is allocated lazily, not one worker per core at load');

console.log('\n' + (fails === 0 ? '=> ALL ROBOTICS TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
