// Exercises the Laffer remake: the LAF shim's protocol port and WebSocket
// hijack, plus the patched io client, against a simulated current-protocol
// server built from the game bundle's own code.
const crypto = require('crypto');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const { LAF, HijackedWebSocket, FakeWebSocket } = extract.loadLaffer();

const enc = new Encoder(), dec = new Decoder();

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
console.log('\n1. protocol port matches the game bundle');

check(LAF.headerLen === game.jt, 'header length (' + LAF.headerLen + ')');
check(LAF.modeSecure === game.Ht, 'secure mode marker (' + LAF.modeSecure + ')');

let tablesOk = true;
for (let n = 0; n < 5000 && tablesOk; n++) {
  const seed = (Math.random() * 4294967296) >>> 0;
  if (JSON.stringify(game.Po(seed)) !== JSON.stringify(LAF.buildTables(seed))) tablesOk = false;
}
check(tablesOk, 'opcode tables identical over 5000 random seeds');

let hmacOk = true, refOk = true;
for (let n = 0; n < 400 && hmacOk && refOk; n++) {
  const key = crypto.randomBytes(1 + Math.floor(Math.random() * 100));
  const msg = crypto.randomBytes(Math.floor(Math.random() * 300));
  const ours = Buffer.from(LAF.tag(key, msg));
  if (!ours.equals(Buffer.from(game.Eo(key, msg)))) hmacOk = false;
  if (!ours.equals(crypto.createHmac('sha256', key).update(msg).digest().subarray(0, game.jt))) refOk = false;
}
check(hmacOk, 'HMAC tag identical to the game over 400 random key/message pairs');
check(refOk, 'HMAC tag identical to node crypto HMAC-SHA256');

// --------------------------------------------------------------------------
console.log('\n2. WebSocket hijack');

check(HijackedWebSocket !== FakeWebSocket, 'window.WebSocket was replaced');

let handed = null;
LAF.onAddress(a => { handed = a; });
const gameSocket = new HijackedWebSocket('wss://server.moomoo.io?token=cf:abc123');
check(handed === 'wss://server.moomoo.io?token=cf:abc123',
      'the address the game built (token included) is handed to the mod');
check(LAF.address() === handed, 'address is also retrievable after the fact');

// the game will poke at its stand-in socket; none of that may throw
let inert = true;
try {
  gameSocket.binaryType = 'arraybuffer';
  gameSocket.onmessage = () => {};
  gameSocket.onopen = () => {};
  gameSocket.send(new Uint8Array([1, 2, 3]));
  HijackedWebSocket.prototype.send.call(gameSocket, new Uint8Array([1]));
  gameSocket.close();
  gameSocket.addEventListener('message', () => {});
} catch (e) { inert = false; }
check(inert, 'the stand-in tolerates everything the game does to it');
check(typeof HijackedWebSocket.OPEN === 'number', 'readyState constants present for the game\'s checks');

// a listener registered after the address arrived still fires
let late = null;
LAF.onAddress(a => { late = a; });
check(late === handed, 'a late listener fires immediately with the stored address');

// --------------------------------------------------------------------------
console.log('\n3. io client handshake');

// stubs the io module closes over
global.OriginalWebSocket = FakeWebSocket;
global.msgpack = { encode: v => enc.encode(v), decode: b => dec.decode(b) };
global.packets = 0;
global.packetInterval = 0;   // truthy-ish so the interval branch is skipped
global.pps = 0;
global.LAF = LAF;

const io = eval(extract.lafferIoExpression());

const SEED = 0xABCDEF01;
const KEY_HEX = '112233445566778899aabbccddeeff00';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

let connectCalls = 0, connectArg = 'unset';
const received = [];
const events = {};
for (const name of game.To) events[name] = (...a) => received.push([name, a]);

io.connect('wss://fake', err => { connectCalls++; connectArg = err; }, events);
const sock = io.socket;
check(sock instanceof FakeWebSocket, 'io opened a real socket via OriginalWebSocket');
check(sock.binaryType === 'arraybuffer', 'binaryType set');

check(connectCalls === 0, 'connect callback does not fire before io-init');
sock.onopen();
check(connectCalls === 0, 'still not fired on open');
check(io.connected === true, 'connected flag set on open');

sock.onmessage({ data: enc.encode(['io-init', [55, SEED, KEY_HEX, game.Ht]]) });
check(connectCalls === 1 && connectArg === undefined, 'callback fires once, with no error, on io-init');
check(io.socketId === 55, 'socketId captured');
check(io.proto !== null && io.proto.mode === 1, 'secure protocol state established');

sock.onmessage({ data: enc.encode(['io-init', [55, SEED, KEY_HEX, game.Ht]]) });
check(connectCalls === 1, 'a repeated io-init does not re-fire the callback');

// --------------------------------------------------------------------------
console.log('\n4. outgoing framing');

sock.sentRaw.length = 0;
io.send('M', { name: 'laffer', moofoll: 1, skin: 0 });
check(sock.sentRaw.length === 1, 'spawn packet transmitted');

const frame = Buffer.from(sock.sentRaw[0]);
const payload = frame.subarray(game.jt);
check(Buffer.from(game.Eo(key, payload)).equals(frame.subarray(0, game.jt)),
      'server-side HMAC verification passes');
const parsed = dec.decode(new Uint8Array(payload));
check(tables.c2s.dec[parsed[0]] === 'M', 'opcode maps back to "M"');
check(JSON.stringify(parsed[1]) === JSON.stringify([{ name: 'laffer', moofoll: 1, skin: 0 }]), 'args preserved');
check(parsed[2] === 1, 'sequence starts at 1');

sock.sentRaw.length = 0;
io.send('D', 1.25);
io.send('K', 1);
const seqs = sock.sentRaw.map(f => dec.decode(new Uint8Array(Buffer.from(f).subarray(game.jt)))[2]);
check(JSON.stringify(seqs) === '[2,3]', 'sequence increments monotonically: ' + JSON.stringify(seqs));

// every packet name this mod actually uses must have an opcode
const used = ['0', '6', '9', 'D', 'F', 'H', 'K', 'L', 'M', 'N', 'P', 'Q', 'S', 'b', 'c', 'e', 'z'];
let allKnown = true;
for (const name of used) {
  sock.sentRaw.length = 0;
  io.send(name, 1);
  if (sock.sentRaw.length !== 1) { allKnown = false; break; }
  const p = dec.decode(new Uint8Array(Buffer.from(sock.sentRaw[0]).subarray(game.jt)));
  if (tables.c2s.dec[p[0]] !== name) { allKnown = false; break; }
}
check(allKnown, 'all ' + used.length + ' packet names this mod sends have valid opcodes');

sock.sentRaw.length = 0;
io.send('nonsense', 1);
check(sock.sentRaw.length === 0, 'an unknown name is dropped instead of sent as garbage');

// --------------------------------------------------------------------------
console.log('\n5. incoming opcode mapping');

received.length = 0;
sock.onmessage({ data: enc.encode([tables.s2c.enc['A'], [{ teams: [] }]]) });
sock.onmessage({ data: enc.encode([tables.s2c.enc['O'], [1, 90]]) });
check(received.length === 2, 'both packets dispatched');
check(received[0][0] === 'A', 'numeric opcode decoded to "A" (setInitData)');
check(received[1][0] === 'O', 'numeric opcode decoded to "O" (updateHealth)');

received.length = 0;
let threw = false;
try { sock.onmessage({ data: enc.encode([4242, []]) }); } catch (e) { threw = true; }
check(!threw && received.length === 0, 'an unmapped opcode is ignored, not a crash');

threw = false;
try { sock.onmessage({ data: enc.encode(['nosuchevent', []]) }); } catch (e) { threw = true; }
check(!threw, 'an event with no handler no longer throws');

// --------------------------------------------------------------------------
console.log('\n6. teardown and legacy fallback');

io.close();
check(io.proto === null, 'protocol state cleared on close');

const io2 = eval(extract.lafferIoExpression());
let cb2 = 0;
io2.connect('wss://legacy', () => { cb2++; }, events);
io2.socket.onopen();
io2.socket.onmessage({ data: enc.encode(['io-init', [3]]) });   // no seed/key/mode
check(cb2 === 1, 'callback still fires on a legacy io-init');
check(io2.proto === null, 'no secure state for a legacy server');
io2.socket.sentRaw.length = 0;
io2.send('M', { name: 'x' });
const plain = dec.decode(new Uint8Array(Buffer.from(io2.socket.sentRaw[0])));
check(plain[0] === 'M' && plain.length === 2, 'legacy frame is plain [name, args] with no MAC');

console.log('\n' + (fails === 0 ? '=> ALL LAFFER REMAKE TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
