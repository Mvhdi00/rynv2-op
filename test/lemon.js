// The two LemonMod scripts target the 2019 protocol, so the shim alone cannot
// make them play. What IS testable is the transport layer that was added:
//  - the Visuals script's io client now does the handshake and frames sends
//  - the main script's oldSend trampoline frames the mod's plain msgpack and
//    passes already-framed traffic through untouched
// Plus the standing evidence that the packet vocabularies do not line up,
// which is the reason these two still will not work.
const fs = require('fs');
const path = require('path');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const enc = new Encoder(), dec = new Decoder();

const ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
console.log('\n1. both scripts still parse and carry the shim');

for (const f of ['LemonModVisuals.user.js', 'LemonMod.user.js']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  check(src.includes('const EXP = (function() {'), f + ' carries the EXP shim');
  check(/^\/\/ @run-at\s+document-start$/m.test(src), f + ' runs at document-start');
  check(src.includes('READ THIS FIRST'), f + ' carries the protocol-generation warning');
}

// --------------------------------------------------------------------------
console.log('\n2. the vocabularies genuinely do not line up');

const oldOut = ['10', '11', '12', '13c', '14', '2', '33', '5', '6', '7', '8', '9', 'c', 'ch', 'pp', 'rmd', 'sp'];
const newOut = game.bo;
const missing = oldOut.filter(n => !newOut.includes(n));
check(missing.length === 14, missing.length + ' of ' + oldOut.length + ' outgoing names have no opcode today');

const oldIn = ['id', 'd', '1', '2', '4', '33', '5', '6', 'a', 'aa', '7', '8', 'sp', '9', 'h',
               '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
               'ac', 'ad', 'an', 'st', 'sa', 'us', 'ch', 'mm'];
const collide = oldIn.filter(n => game.To.includes(n));
check(collide.length === 9,
      collide.length + ' incoming names collide across generations: ' + collide.join(' '));

// --------------------------------------------------------------------------
console.log('\n3. main script: the oldSend trampoline');

// Load the shim + the transport glue exactly as the file ships them.
const lemon = fs.readFileSync(path.join(ROOT, 'LemonMod.user.js'), 'utf8').split('\n');
const shimStart = lemon.indexOf('const EXP = (function() {');
const glueStart = lemon.findIndex(l => l.startsWith('/* --- LemonMod transport glue'));
const glueEnd = lemon.indexOf('})();', glueStart);
const harness = `
class FakeWebSocket {
  constructor(url) { this.url = url; this.readyState = 1; this.binaryType=''; this._ls = []; this.sentRaw = []; }
  addEventListener(t, f) { if (t === 'message') this._ls.push(f); }
  deliver(d) { for (const f of this._ls.slice()) f({ data: d, target: this }); }
}
FakeWebSocket.prototype.send = function (d) { this.sentRaw.push(d); };
['CONNECTING','OPEN','CLOSING','CLOSED'].forEach((k,i)=>{FakeWebSocket[k]=i;});
Object.defineProperty(FakeWebSocket.prototype, 'onmessage', {
  configurable: true,
  set(fn) { this._onmessage = fn; if (fn) this.addEventListener('message', fn); },
  get() { return this._onmessage; }
});
global.window = { WebSocket: FakeWebSocket };
global.document = { getElementById(){ return null; } };
global.WebSocket = FakeWebSocket;
`;
const mod = harness
  + lemon.slice(shimStart, glueEnd + 1).join('\n')
  + '\nmodule.exports = { EXP, WebSocket: global.WebSocket, FakeWebSocket, window: global.window };\n';

const gen = path.join(__dirname, '.generated', 'lemon_glue.js');
fs.mkdirSync(path.dirname(gen), { recursive: true });
fs.writeFileSync(gen, mod);
const M = require(gen);

const SEED = 0x5EED0001;
const KEY_HEX = '0123456789abcdef0123456789abcdef';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const { EXP, FakeWebSocket } = M;
const WS = M.WebSocket;                 // prototype the glue patched
const Patched = M.window.WebSocket;     // constructor the shim installed

// Sockets must be built through the shim's constructor -- that is what attaches
// the io-init sniffer, exactly as it does in the browser.
const sock = new Patched('wss://server');
sock.deliver(enc.encode(['io-init', [1, SEED, KEY_HEX, game.Ht]]));
check(EXP.isSecure(sock), 'handshake captured on the socket');

// The mod installs its hook the way the obfuscated body does.
const shimSend = WS.prototype.send;
WS.prototype.oldSend = WS.prototype.send;
const seenByModHook = [];
WS.prototype.send = function (message) {
  seenByModHook.push(EXP.decode(message));
  this.oldSend(message);                       // exactly what the mod does
};

// Game-originated traffic: framed on the way in, must reach the mod hook as
// plain msgpack, and leave framed again.
const gamePayload = enc.encode([tables.c2s.enc['D'], [1.5], 7]);
const gameFrame = new Uint8Array(6 + gamePayload.length);
gameFrame.set(game.Eo(key, gamePayload), 0);
gameFrame.set(gamePayload, 6);

sock.sentRaw.length = 0;
shimSend.call(sock, gameFrame);                // the reference the game captured
check(seenByModHook.length === 1, 'the game\'s packet reached the mod hook');
check(Array.isArray(seenByModHook[0]) && seenByModHook[0][0] === 'D',
      'the mod hook saw plain msgpack with the string name, not a numeric opcode');
check(sock.sentRaw.length === 1, 'exactly one frame went out');
const out = Buffer.from(sock.sentRaw[0]);
check(Buffer.from(game.Eo(key, out.subarray(6))).equals(out.subarray(0, 6)),
      'what left the socket verifies against the server key');
check(tables.c2s.dec[dec.decode(new Uint8Array(out.subarray(6)))[0]] === 'D',
      'and carries the right opcode');

// Mod-originated traffic: the ~108 oldSend() call sites pass plain msgpack.
sock.sentRaw.length = 0;
WS.prototype.oldSend.call(sock, EXP.encode(['M', [{ name: 'lemon' }]]));
check(sock.sentRaw.length === 1, 'a direct oldSend() was transmitted');
const out2 = Buffer.from(sock.sentRaw[0]);
check(Buffer.from(game.Eo(key, out2.subarray(6))).equals(out2.subarray(0, 6)),
      'oldSend() framed the mod\'s plain msgpack');
check(tables.c2s.dec[dec.decode(new Uint8Array(out2.subarray(6)))[0]] === 'M',
      'with the right opcode');

// An old-generation name has no opcode, so it is dropped rather than sent raw.
sock.sentRaw.length = 0;
WS.prototype.oldSend.call(sock, EXP.encode(['sp', [{ name: 'lemon' }]]));
check(sock.sentRaw.length === 0,
      'the old name "sp" is dropped, not sent as garbage (this is why it still will not play)');

// Already-framed buffers must not be framed twice.
sock.sentRaw.length = 0;
WS.prototype.oldSend.call(sock, gameFrame);
check(sock.sentRaw.length === 1, 'an already-framed buffer went out once');
check(Buffer.from(sock.sentRaw[0]).equals(Buffer.from(gameFrame)),
      'and was passed through byte-for-byte, not re-framed');

// --------------------------------------------------------------------------
console.log('\n4. main script: opcode-aware msgpack.decode for incoming');

let decodedByMod = null;
sock.onmessage = function (ev) { decodedByMod = window.msgpack.decode(new Uint8Array(ev.data)); };
sock.deliver(enc.encode([tables.s2c.enc['P'], [3]]));
check(Array.isArray(decodedByMod) && decodedByMod[0] === 'P',
      'the mod\'s own msgpack.decode sees the name "P", not a numeric opcode');

sock.deliver(enc.encode(['io-init', [1, SEED, KEY_HEX, game.Ht]]));
check(decodedByMod[0] === 'io-init', 'the plaintext handshake still decodes normally');

console.log('\n' + (fails === 0 ? '=> ALL LEMONMOD TRANSPORT TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
console.log('   (transport only -- the packet vocabulary is still a generation behind)');
process.exit(fails ? 1 : 0);
