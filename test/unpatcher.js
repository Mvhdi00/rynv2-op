// Drives the universal unpatcher with two *unmodified* mods bolted on top of
// it -- one written for the 2019 protocol, one for the current names -- and a
// simulated server built from the game bundle's own crypto.
const fs = require('fs');
const path = require('path');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const enc = new Encoder(), dec = new Decoder();

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
// Load the unpatcher into a fresh sandbox with a fake WebSocket.
function loadUnpatcher() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'MooUnpatcher.user.js'), 'utf8');
  const body = src.slice(src.indexOf('// ==/UserScript=='));
  const harness = `
class FakeWebSocket {
  constructor(url) { this.url = url; this.readyState = 1; this.binaryType=''; this._ls = []; this.sentRaw = []; }
  addEventListener(t, f) { if (t === 'message') this._ls.push(f); }
  deliver(d) {
    const ev = { data: d, target: this, type: 'message' };
    if (this._om) this._om(ev);
    for (const f of this._ls.slice()) f(ev);
  }
}
FakeWebSocket.prototype.send = function (d) { this.sentRaw.push(d); };
['CONNECTING','OPEN','CLOSING','CLOSED'].forEach((k,i)=>{FakeWebSocket[k]=i;});
// a real WebSocket's onmessage is its own slot -- it does NOT register through
// addEventListener, so the fake must not either
Object.defineProperty(FakeWebSocket.prototype, 'onmessage', {
  configurable: true,
  set(fn) { this._om = fn; },
  get() { return this._om; }
});
global.FakeWebSocket = FakeWebSocket;
global.window = { WebSocket: FakeWebSocket };
global.WebSocket = FakeWebSocket;
global.document = { getElementById(){ return null; } };
// shadow console for the loaded module only -- replacing the global one
// would silence the test output too
const console = { info(){}, warn(){}, error(){}, log(){} };
`;
  const file = path.join(__dirname, '.generated', 'unpatcher_' + Math.random().toString(36).slice(2) + '.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, harness + body + '\nmodule.exports = { EXP, UNPATCH, WebSocket: global.WebSocket, window: global.window };\n');
  return require(file);
}

const SEED = 0x00DEFACE, KEY_HEX = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

function handshake(sock) {
  sock.deliver(enc.encode(['io-init', [1, SEED, KEY_HEX, game.Ht]]));
}
function frameFromServerSide(name, args, seq) {
  const p = enc.encode([tables.c2s.enc[name], args, seq]);
  const f = new Uint8Array(6 + p.length);
  f.set(game.Eo(key, p), 0);
  f.set(p, 6);
  return f;
}
function readFrame(buf) {
  const b = Buffer.from(buf);
  const ok = Buffer.from(game.Eo(key, b.subarray(6))).equals(b.subarray(0, 6));
  const d = dec.decode(new Uint8Array(b.subarray(6)));
  return { ok, name: tables.c2s.dec[d[0]], args: d[1], seq: d[2] };
}

// --------------------------------------------------------------------------
console.log('\n1. a 2019-generation mod, installed unchanged');
{
  const U = loadUnpatcher();
  const sock = new U.window.WebSocket('wss://server');
  handshake(sock);
  check(U.EXP.isSecure(sock), 'handshake captured');

  // the mod installs its hook exactly the way that family does
  const seen = [];
  U.WebSocket.prototype.nsend = U.WebSocket.prototype.send;   // pinned, ignored
  U.WebSocket.prototype.send = function (buf) {
    seen.push(U.EXP.decode(buf));
    this.nsend(buf);
  };

  // it spawns using the old name
  sock.sentRaw.length = 0;
  U.WebSocket.prototype.send.call(sock, U.EXP.encode(['sp', [{ name: 'x', moofoll: 1, skin: 0 }]]));
  check(U.UNPATCH.generation() === 'old', 'generation auto-detected as old from the spawn packet');
  check(sock.sentRaw.length === 1, 'the spawn packet went out');
  const f = readFrame(sock.sentRaw[0]);
  check(f.ok, 'server-side HMAC verifies');
  check(f.name === 'M', 'old "sp" arrived as current "M"');

  // a few more old names
  const cases = [['33', '9'], ['ch', '6'], ['13c', 'c'], ['c', 'F'], ['2', 'D'], ['5', 'z'], ['pp', '0']];
  let allOk = true, bad = null;
  for (const [oldName, want] of cases) {
    sock.sentRaw.length = 0;
    U.WebSocket.prototype.send.call(sock, U.EXP.encode([oldName, [1]]));
    if (!sock.sentRaw.length) { allOk = false; bad = oldName + ' (dropped)'; break; }
    const g = readFrame(sock.sentRaw[0]);
    if (g.name !== want) { allOk = false; bad = oldName + '->' + g.name; break; }
  }
  check(allOk, 'old outgoing names translate correctly' + (bad ? ' (failed on ' + bad + ')' : ''));

  // incoming: the game sets onmessage first, then the mod attaches
  const gameSaw = [], modSaw = [];
  const s2 = new U.window.WebSocket('wss://server2');
  s2.onmessage = (ev) => gameSaw.push(U.EXP.decode(ev.data));       // the game
  handshake(s2);
  s2.addEventListener('message', (ev) => modSaw.push(U.EXP.decode(ev.data)));  // the mod

  gameSaw.length = 0; modSaw.length = 0;
  s2.deliver(enc.encode([tables.s2c.enc['O'], [3, 77]]));
  check(gameSaw.length === 1 && typeof gameSaw[0][0] === 'number',
        'the game still receives the raw numeric opcode');
  check(modSaw.length === 1 && modSaw[0][0] === 'h',
        'the mod receives it as the old name "h" (updateHealth)');

  s2.deliver(enc.encode([tables.s2c.enc['a'], [[]]]));
  check(modSaw[1] && modSaw[1][0] === '33', 'updatePlayers reaches the mod as "33"');
}

// --------------------------------------------------------------------------
console.log('\n2. a current-generation mod, installed unchanged');
{
  const U = loadUnpatcher();
  const sock = new U.window.WebSocket('wss://server');
  handshake(sock);

  U.WebSocket.prototype.send = function (buf) { this.nsend(buf); };

  sock.sentRaw.length = 0;
  U.WebSocket.prototype.send.call(sock, U.EXP.encode(['M', [{ name: 'y' }]]));
  check(U.UNPATCH.generation() === 'current', 'generation auto-detected as current');
  const f = readFrame(sock.sentRaw[0]);
  check(f.ok && f.name === 'M', 'spawn framed correctly, name untouched');

  // a straggler name that was renamed within this generation
  sock.sentRaw.length = 0;
  U.WebSocket.prototype.send.call(sock, U.EXP.encode(['d', [1, 2, 3]]));
  check(readFrame(sock.sentRaw[0]).name === 'F', 'the straggler "d" still maps to "F"');

  sock.sentRaw.length = 0;
  U.WebSocket.prototype.send.call(sock, U.EXP.encode(['z', [5, true]]));
  check(readFrame(sock.sentRaw[0]).name === 'z', 'a current name is left alone');
}

// --------------------------------------------------------------------------
console.log('\n3. traffic from the game itself');
{
  const U = loadUnpatcher();
  const sock = new U.window.WebSocket('wss://server');
  handshake(sock);
  U.UNPATCH.setGeneration('old');

  const seen = [];
  const shimSend = U.WebSocket.prototype.send;      // what the game captured
  U.WebSocket.prototype.send = function (buf) { seen.push(U.EXP.decode(buf)); this.nsend(buf); };

  sock.sentRaw.length = 0;
  shimSend.call(sock, frameFromServerSide('D', [1.25], 9));   // game sends aim
  check(seen.length === 1, "the game's packet was routed through the mod's hook");
  check(seen[0][0] === '2', 'and reached it under the old name "2"');
  check(sock.sentRaw.length === 1, 'exactly one frame left the socket');
  const f = readFrame(sock.sentRaw[0]);
  check(f.ok && f.name === 'D', 'and it went back out correctly as "D"');
}

// --------------------------------------------------------------------------
console.log('\n4. safety');
{
  const U = loadUnpatcher();
  const sock = new U.window.WebSocket('wss://server');
  handshake(sock);
  U.UNPATCH.setGeneration('old');

  sock.sentRaw.length = 0;
  U.EXP.nativeSend = U.EXP.nativeSend;   // untouched
  U.WebSocket.prototype.nsend.call(sock, Uint8Array.from([159, 18, 223, 1, 76, 246, 3]));
  check(sock.sentRaw.length === 0, 'malformed buffers are dropped, not sent raw');

  sock.sentRaw.length = 0;
  U.WebSocket.prototype.nsend.call(sock, U.EXP.encode(['totally-unknown', [1]]));
  check(sock.sentRaw.length === 0, 'a name with no opcode is dropped');

  // already-framed traffic must not be framed twice
  const already = frameFromServerSide('K', [1], 4);
  sock.sentRaw.length = 0;
  U.WebSocket.prototype.nsend.call(sock, already);
  check(sock.sentRaw.length === 1 && Buffer.from(sock.sentRaw[0]).equals(Buffer.from(already)),
        'already-framed traffic passes through byte-for-byte');

  // the aliases mods use must all resolve to the framing path, not to the hook
  const aliases = ['nsend', 'oldSend', 'staticSend'];
  let pinned = true;
  for (const a of aliases) {
    U.WebSocket.prototype[a] = function () { throw new Error('should have been ignored'); };
    if (typeof U.WebSocket.prototype[a] !== 'function') { pinned = false; break; }
    sock.sentRaw.length = 0;
    U.WebSocket.prototype[a].call(sock, U.EXP.encode(['sp', [{ name: 'z' }]]));
    if (sock.sentRaw.length !== 1) { pinned = false; break; }
  }
  check(pinned, 'nsend / oldSend / staticSend are pinned to the framing path');
}

console.log('\n' + (fails === 0 ? '=> ALL UNPATCHER TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
