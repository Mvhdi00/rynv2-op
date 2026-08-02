// x18k is a full client replacement: it lets the page pick a server and clear
// Turnstile, then takes over the address. These checks cover the three things
// that were broken -- the metadata block, the document-start takeover, and the
// wire protocol -- plus the removal of the bundled token logger.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const enc = new Encoder(), dec = new Decoder();

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'X18K.user.js'), 'utf8');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
console.log('\n1. metadata block');

const meta = src.slice(0, src.indexOf('// ==/UserScript=='));
check(/^\/\/ @run-at\s+document-start$/m.test(meta),
      'runs at document-start (required to take the socket over)');
check(!/^\s*\/\/ @include/m.test(meta),
      'the wildcard @include is gone');
check(/^\/\/ @match\s+https:\/\/\*\.moomoo\.io\/\*$/m.test(meta),
      'still scoped to moomoo.io by @match');
check(!/@require/.test(meta),
      'the dead rawgit @require is gone');

// --------------------------------------------------------------------------
console.log('\n2. the bundled token logger is gone');

// The banner comment names what was removed, so scan the code below it.
const body = src.slice(src.indexOf('*/', src.indexOf('// ==/UserScript==')) + 2);
check(body.length > src.length - 2000, 'the banner is the only thing skipped');
for (const needle of ['iloveloggers', 'workers.dev', 'rawgit.com', 'tokenLoggerRan', 'Logged info']) {
  check(!body.includes(needle), 'no occurrence of "' + needle + '" in the code');
}
// the payload was one ~40 KB minified line; nothing near that should remain
const longest = body.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
check(longest < 8000, 'no obfuscated mega-line left (longest is ' + longest + ' chars)');

// --------------------------------------------------------------------------
console.log('\n3. protocol port matches the game bundle');

const x = extract.loadX18k();
const { X18P, io, FakeSocket } = x;

check(X18P.headerLen === game.jt, 'header length (' + X18P.headerLen + ')');
check(X18P.modeSecure === game.Ht, 'secure mode marker');

let tablesOk = true;
for (let n = 0; n < 3000 && tablesOk; n++) {
  const seed = (Math.random() * 4294967296) >>> 0;
  if (JSON.stringify(game.Po(seed)) !== JSON.stringify(X18P.buildTables(seed))) tablesOk = false;
}
check(tablesOk, 'opcode tables identical over 3000 random seeds');

let hmacOk = true;
for (let n = 0; n < 300 && hmacOk; n++) {
  const key = crypto.randomBytes(1 + Math.floor(Math.random() * 80));
  const msg = crypto.randomBytes(Math.floor(Math.random() * 250));
  if (!Buffer.from(X18P.tag(key, msg)).equals(Buffer.from(game.Eo(key, msg)))) hmacOk = false;
}
check(hmacOk, 'HMAC tags identical to the game over 300 random pairs');

// --------------------------------------------------------------------------
console.log('\n4. the document-start socket stub');

const stub = x.stub();
check(stub !== FakeSocket, 'window.WebSocket was replaced');
check(typeof stub.prototype.send === 'function',
      'the stub has a prototype.send, so the page\'s captured reference is callable');
check(stub.OPEN === 1, 'the stub carries the readyState constants');
check(x.window.OriginalWebSocket === FakeSocket, 'the real constructor is kept as OriginalWebSocket');

// before the client is ready the address has to be held, not dropped
new stub('wss://early.example?token=cf:AAA');
check(x.pending() === 'wss://early.example?token=cf:AAA', 'an early address is queued');

let handed = null;
x.setConnect(a => { handed = a; });
new stub('wss://late.example?token=cf:BBB');
check(handed === 'wss://late.example?token=cf:BBB', 'a later address is handed straight to the client');

// the page's render loop must not be able to re-arm itself
x.window.requestAnimFrame = function () { throw new Error('page loop ran'); };
check(typeof x.window.requestAnimFrame === 'function', 'requestAnimFrame is still readable');
x.window.requestAnimFrame(function () { throw new Error('page loop ran'); });
check(true, 'the page\'s assignment is swallowed and the getter returns a no-op');

// --------------------------------------------------------------------------
console.log('\n5. handshake and framing through the io client');

const SEED = 0x3C5A17B9;
const KEY_HEX = '112233445566778899aabbccddeeff00';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const received = [];
const events = {
  A: (...a) => received.push(['A', a]),
  C: (...a) => received.push(['C', a]),
  9: (...a) => received.push(['9', a]),
};
let callbacks = 0, lastError;
io.connect('wss://server?token=cf:CCC', err => { callbacks++; lastError = err; }, events);
const sock = io.socket;
check(sock instanceof FakeSocket, 'the real constructor is used for the actual connection');

sock.open();
check(callbacks === 0, 'the callback does NOT fire on open -- the tables do not exist yet');

// anything sent before the handshake would be dropped by the server
io.send('M', { name: 'x18k' });
check(sock.sent.length === 0, 'nothing is sent before io-init');

sock.deliver(enc.encode(['io-init', [7, SEED, KEY_HEX, game.Ht]]));
check(callbacks === 1 && lastError === undefined, 'the callback fires once, on io-init');
check(io.socketId === 7, 'socket id captured');
check(x.proto() !== null && x.proto().mode === X18P.modeSecure, 'secure mode negotiated');

io.send('M', { name: 'x18k', moofoll: 1, skin: 0 });
check(sock.sent.length === 1, 'the spawn packet goes out after the handshake');

const frame = sock.sent[0];
check(Buffer.from(game.Eo(key, frame.subarray(6))).equals(frame.subarray(0, 6)),
      'server-side HMAC verification passes');
const parsed = dec.decode(new Uint8Array(frame.subarray(6)));
check(tables.c2s.dec[parsed[0]] === 'M', 'opcode maps back to "M" (spawn)');
check(parsed[1][0].name === 'x18k', 'arguments survive the round trip');
check(parsed[2] === 1, 'sequence starts at 1');

sock.sent.length = 0;
io.send('D', 0.5);
io.send('9', 1.0, 1);
const seqs = sock.sent.map(f => dec.decode(new Uint8Array(f.subarray(6)))[2]);
check(JSON.stringify(seqs) === '[2,3]', 'sequence increments monotonically: ' + JSON.stringify(seqs));

// --------------------------------------------------------------------------
console.log('\n6. every packet name x18k sends resolves to an opcode');

// harvested from the io.send(...) calls in the shipped file
const used = [...new Set((src.match(/io\.send\("([^"]+)"/g) || [])
  .map(m => m.slice('io.send("'.length, -1)))].sort();
let allKnown = true, failedName = null;
for (const name of used) {
  sock.sent.length = 0;
  io.send(name, 1);
  if (sock.sent.length !== 1) { allKnown = false; failedName = name; break; }
}
check(allKnown, 'all ' + used.length + ' names resolve'
      + (failedName ? ' (failed on "' + failedName + '")' : ''));

// --------------------------------------------------------------------------
console.log('\n7. incoming opcodes reach the right handler');

received.length = 0;
sock.deliver(enc.encode([tables.s2c.enc['C'], [12]]));
check(received.length === 1 && received[0][0] === 'C' && received[0][1][0] === 12,
      'numeric opcode routed to setupGame with its arguments');

received.length = 0;
sock.deliver(enc.encode([tables.s2c.enc['9'], [1, 2]]));
check(received.length === 1 && received[0][0] === '9', 'a second opcode routes independently');

received.length = 0;
sock.deliver(enc.encode([12345, []]));
check(received.length === 0, 'an unmapped opcode is ignored rather than throwing');

received.length = 0;
sock.deliver(enc.encode([tables.s2c.enc['B'], ['bye']]));
check(received.length === 0, 'an opcode with no handler is ignored');

// --------------------------------------------------------------------------
console.log('\n8. teardown clears the per-connection state');

sock.close();
check(x.proto() === null, 'the key and tables are dropped on close');
check(io.connected === false, 'connected flag cleared');
io.send('M', {});
check(true, 'sending after close does not throw');

console.log('\n' + (fails === 0 ? '=> ALL X18K TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
