// Exercises the External Client's EXP protocol shim: the bundled msgpack, the
// opcode/HMAC framing, the send trampoline, and the old-name packet map --
// all against the codec and crypto lifted out of the live game bundle.
const extract = require('./extract.js');

const { game, msgpack } = extract.load();
const { EXP, FakeWebSocket, window } = extract.loadExternal();
const { Encoder, Decoder } = msgpack;

const gameEnc = new Encoder(), gameDec = new Decoder();

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
console.log('\n1. bundled msgpack vs the game codec');

function randomValue(depth) {
  const r = Math.random();
  if (depth > 3) return Math.floor(Math.random() * 1000);
  if (r < 0.10) return null;
  if (r < 0.18) return Math.random() < 0.5;
  if (r < 0.40) {
    const k = Math.random();
    return k < 0.4 ? Math.floor(Math.random() * 4e9) - 2e9
         : k < 0.7 ? Math.floor(Math.random() * 300)
                   : Math.random() * 1000 - 500;
  }
  if (r < 0.62) {
    const n = Math.floor(Math.random() * 40);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(32 + Math.floor(Math.random() * 200));
    return s;
  }
  if (r < 0.82) {
    const n = Math.floor(Math.random() * 6), a = [];
    for (let i = 0; i < n; i++) a.push(randomValue(depth + 1));
    return a;
  }
  const n = Math.floor(Math.random() * 5), o = {};
  for (let i = 0; i < n; i++) o['k' + i] = randomValue(depth + 1);
  return o;
}

let encDiff = 0, gameReadDiff = 0, weReadDiff = 0;
for (let i = 0; i < 4000; i++) {
  const v = randomValue(0);
  const ours = Buffer.from(EXP.encode(v));
  const theirs = Buffer.from(gameEnc.encode(v));
  if (!ours.equals(theirs)) encDiff++;
  if (JSON.stringify(gameDec.decode(ours)) !== JSON.stringify(v)) gameReadDiff++;
  if (JSON.stringify(EXP.decode(theirs)) !== JSON.stringify(v)) weReadDiff++;
}
check(encDiff === 0, 'our encoder is byte-identical to the game\'s over 4000 random values');
check(gameReadDiff === 0, 'the game decodes everything we encode');
check(weReadDiff === 0, 'we decode everything the game encodes');

// --------------------------------------------------------------------------
console.log('\n2. handshake sniffing');

const SEED = 0x5EED1234;
const KEY_HEX = 'd3adbeefcafe0011223344556677889a';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const sock = new window.WebSocket('wss://server');
check(EXP.stateOf(sock) === undefined, 'no protocol state before io-init');
sock.deliver(gameEnc.encode(['io-init', [11, SEED, KEY_HEX, game.Ht]]));
check(EXP.isSecure(sock), 'io-init observed at construction time, secure state built');

// --------------------------------------------------------------------------
console.log('\n3. outgoing framing');

sock.sentRaw.length = 0;
check(EXP.send(sock, 'M', [{ name: 'ext', moofoll: 1, skin: 0 }]) === true, 'spawn packet accepted');
const frame = Buffer.from(sock.sentRaw[0]);
const payload = frame.subarray(6);
check(Buffer.from(game.Eo(key, payload)).equals(frame.subarray(0, 6)), 'server-side HMAC verification passes');
const parsed = gameDec.decode(new Uint8Array(payload));
check(tables.c2s.dec[parsed[0]] === 'M', 'opcode maps back to "M"');
check(parsed[2] === 1, 'sequence starts at 1');

sock.sentRaw.length = 0;
EXP.send(sock, 'D', [1.5]);
EXP.send(sock, 'K', [1]);
const seqs = sock.sentRaw.map(f => gameDec.decode(new Uint8Array(Buffer.from(f).subarray(6)))[2]);
check(JSON.stringify(seqs) === '[2,3]', 'sequence increments monotonically: ' + JSON.stringify(seqs));

// --------------------------------------------------------------------------
console.log('\n4. old packet names are remapped');

const remaps = [['a', '9'], ['f', '9'], ['33', '9'], ['d', 'F'], ['G', 'z'], ['ch', '6'], ['pp', '0'], ['13c', 'c']];
let remapOk = true;
for (const [oldName, newName] of remaps) {
  sock.sentRaw.length = 0;
  EXP.send(sock, oldName, [1]);
  if (!sock.sentRaw.length) { remapOk = false; break; }
  const p = gameDec.decode(new Uint8Array(Buffer.from(sock.sentRaw[0]).subarray(6)));
  if (tables.c2s.dec[p[0]] !== newName) { remapOk = false; break; }
}
check(remapOk, 'all ' + remaps.length + ' legacy names map to their current opcodes');

sock.sentRaw.length = 0;
check(EXP.send(sock, 'kys', [{}]) === false, 'a name the server does not know is dropped');
check(sock.sentRaw.length === 0, 'nothing was transmitted for it');

// --------------------------------------------------------------------------
console.log('\n5. unframe round-trips what the game sends');

// build a frame exactly the way the game bundle does, then read it back
const gameSeq = 41;
const gamePayload = gameEnc.encode([tables.c2s.enc['D'], [2.25], gameSeq]);
const gameFrame = new Uint8Array(6 + gamePayload.length);
gameFrame.set(game.Eo(key, gamePayload), 0);
gameFrame.set(gamePayload, 6);

const un = EXP.unframe(sock, gameFrame);
check(un !== null && un.type === 'D', 'game frame unframed to name "D"');
check(JSON.stringify(un.args) === '[2.25]', 'args recovered');
check(EXP.unframe(sock, new Uint8Array([1, 2, 3])) === null, 'garbage unframes to null instead of throwing');

// --------------------------------------------------------------------------
console.log('\n6. incoming opcode mapping');

const inbound = EXP.receive(sock, gameEnc.encode([tables.s2c.enc['O'], [3, 77]]));
check(inbound.type === 'O', 'numeric opcode decoded to "O" (updateHealth)');
check(JSON.stringify(inbound.args) === '[3,77]', 'payload intact');
check(EXP.receive(sock, gameEnc.encode([31337, []])) === null, 'unmapped opcode returns null');

// --------------------------------------------------------------------------
console.log('\n7. send trampoline');

// The game captures WebSocket.prototype.send at load; that reference must be
// the shim's, and it must route to whatever handler the client registers.
const captured = FakeWebSocket.prototype.send;
let sawHandler = null;
EXP.setHandler(function (data) { sawHandler = { self: this, data }; });
const sock2 = new window.WebSocket('wss://other');
captured.call(sock2, new Uint8Array([9, 9, 9]));
check(sawHandler !== null, 'the reference the game captured reaches the client handler');
check(sawHandler.self === sock2, 'handler receives the right socket as `this`');
EXP.setHandler(null);

sock2.sentRaw.length = 0;
captured.call(sock2, new Uint8Array([1, 2]));
check(sock2.sentRaw.length === 1, 'with no handler installed, traffic passes straight through');

// --------------------------------------------------------------------------
console.log('\n8. per-socket key isolation');

const SEED2 = 0x0BADF00D, KEY2 = '00112233445566778899aabbccddeeff';
const sock3 = new window.WebSocket('wss://bot');
sock3.deliver(gameEnc.encode(['io-init', [12, SEED2, KEY2, game.Ht]]));
sock3.sentRaw.length = 0;
EXP.send(sock3, 'M', [{ name: 'bot' }]);
const botFrame = Buffer.from(sock3.sentRaw[0]);
check(Buffer.from(game.Eo(game.Ro(KEY2), botFrame.subarray(6))).equals(botFrame.subarray(0, 6)),
      'second socket signs with its own key');
check(!Buffer.from(game.Eo(key, botFrame.subarray(6))).equals(botFrame.subarray(0, 6)),
      'the first socket\'s key does not validate it');

// --------------------------------------------------------------------------
console.log('\n9. legacy server fallback');

const legacy = new window.WebSocket('wss://legacy');
legacy.deliver(gameEnc.encode(['io-init', [1]]));       // no seed/key/mode
check(!EXP.isSecure(legacy), 'no secure state negotiated');
legacy.sentRaw.length = 0;
EXP.send(legacy, 'a', [1.0]);                            // still remapped
const legacyMsg = gameDec.decode(new Uint8Array(Buffer.from(legacy.sentRaw[0])));
check(legacyMsg[0] === '9' && legacyMsg.length === 2, 'plain [name, args] frame, name still remapped');

console.log('\n' + (fails === 0 ? '=> ALL EXTERNAL CLIENT TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
