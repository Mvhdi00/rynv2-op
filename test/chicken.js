// chicken is a full client replacement with its own `io` object and its own
// bundled msgpack, so it gets a protocol module rather than the hook shim.
// It also targets two servers at once -- moomoo.io on the current protocol and
// mohmoh on the 2019 one -- so the checks below cover both paths.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const enc = new Encoder(), dec = new Decoder();

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'Chicken.user.js'), 'utf8');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

const c = extract.loadChicken();
const { CHKP, io, FakeSocket } = c;

// --------------------------------------------------------------------------
console.log('\n1. protocol port matches the game bundle');

check(CHKP.headerLen === game.jt, 'header length (' + CHKP.headerLen + ')');
check(CHKP.modeSecure === game.Ht, 'secure mode marker');

let tablesOk = true;
for (let n = 0; n < 3000 && tablesOk; n++) {
  const seed = (Math.random() * 4294967296) >>> 0;
  if (JSON.stringify(game.Po(seed)) !== JSON.stringify(CHKP.buildTables(seed))) tablesOk = false;
}
check(tablesOk, 'opcode tables identical over 3000 random seeds');

let hmacOk = true, nodeOk = true;
for (let n = 0; n < 300 && hmacOk; n++) {
  const key = crypto.randomBytes(1 + Math.floor(Math.random() * 80));
  const msg = crypto.randomBytes(Math.floor(Math.random() * 250));
  if (!Buffer.from(CHKP.tag(key, msg)).equals(Buffer.from(game.Eo(key, msg)))) hmacOk = false;
  const ref = crypto.createHmac('sha256', key).update(msg).digest().subarray(0, 6);
  if (!Buffer.from(CHKP.tag(key, msg)).equals(ref)) nodeOk = false;
}
check(hmacOk, 'HMAC tags identical to the game over 300 random pairs');
check(nodeOk, "HMAC tags identical to node's crypto over the same pairs");

let hexOk = true;
for (let n = 0; n < 200 && hexOk; n++) {
  const hex = crypto.randomBytes(16).toString('hex');
  if (!Buffer.from(CHKP.hexToBytes(hex)).equals(Buffer.from(game.Ro(hex)))) hexOk = false;
}
check(hexOk, 'hex key parsing identical over 200 samples');

// --------------------------------------------------------------------------
console.log('\n2. handshake ordering');

const SEED = 0x2B7F1E93;
const KEY_HEX = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const received = [];
const events = {
  A: (...a) => received.push(['A', a]),
  C: (...a) => received.push(['C', a]),
  a: (...a) => received.push(['a', a]),
};
let callbacks = 0, lastError;
io.connect('wss://server/?token=cf%3AAAA', err => { callbacks++; lastError = err; }, events);
const sock = io.socket;
check(sock instanceof FakeSocket, 'the socket is created');

sock.open();
check(callbacks === 0, 'the callback does NOT fire on open -- the tables do not exist yet');

io.send('M', { name: 'chicken' });
check(sock.sent.length === 0, 'nothing goes out before io-init');

sock.deliver(enc.encode(['io-init', [4, SEED, KEY_HEX, game.Ht]]));
check(callbacks === 1 && lastError === undefined, 'the callback fires once, on io-init');
check(io.socketId === 4, 'socket id captured');
check(c.proto() !== null && c.proto().mode === CHKP.modeSecure, 'secure mode negotiated');

// --------------------------------------------------------------------------
console.log('\n3. framing');

io.send('M', { name: 'chicken', moofoll: true, skin: 0 });
check(sock.sent.length === 1, 'the spawn packet goes out after the handshake');

const frame = sock.sent[0];
check(Buffer.from(game.Eo(key, frame.subarray(6))).equals(frame.subarray(0, 6)),
      'server-side HMAC verification passes');
const parsed = dec.decode(new Uint8Array(frame.subarray(6)));
check(tables.c2s.dec[parsed[0]] === 'M', 'opcode maps back to "M" (spawn)');
check(parsed[1][0].name === 'chicken', 'arguments survive the round trip');
check(parsed[2] === 1, 'sequence starts at 1');

sock.sent.length = 0;
io.send('D', 0.4);
io.send('9', 1.1, 1);
const seqs = sock.sent.map(f => dec.decode(new Uint8Array(f.subarray(6)))[2]);
check(JSON.stringify(seqs) === '[2,3]', 'sequence increments monotonically: ' + JSON.stringify(seqs));

// the client's own rules still run: "D" with a repeated direction is dropped
sock.sent.length = 0;
io.send('D', 0.4);
check(sock.sent.length === 0, 'the repeated-direction rule still drops the packet');

// --------------------------------------------------------------------------
console.log('\n4. every packet name chicken sends resolves to an opcode');

const used = [...new Set((src.match(/io\.send\("([^"]+)"/g) || [])
  .map(m => m.slice('io.send("'.length, -1)))].sort();
let allKnown = true, failedName = null;
for (const name of used) {
  sock.sent.length = 0;
  // "6" is chat and wants a string; "D"/"F" carry direction rules that can drop
  // the packet, so feed values that pass them
  if (name === '6') io.send(name, 'hello');
  else io.send(name, Math.random(), 1, 1);
  if (sock.sent.length !== 1) { allKnown = false; failedName = name; break; }
}
check(allKnown, 'all ' + used.length + ' names resolve'
      + (failedName ? ' (failed on "' + failedName + '")' : ''));

sock.sent.length = 0;
io.send('notapacket', 1);
check(sock.sent.length === 0, 'an unknown name is dropped, not put on the wire');

// --------------------------------------------------------------------------
console.log('\n5. incoming opcodes reach the right handler');

received.length = 0;
sock.deliver(enc.encode([tables.s2c.enc['C'], [12]]));
check(received.length === 1 && received[0][0] === 'C' && received[0][1][0] === 12,
      'numeric opcode routed to setupGame with its arguments');

received.length = 0;
sock.deliver(enc.encode([tables.s2c.enc['a'], [[1, 2, 3]]]));
check(received.length === 1 && received[0][0] === 'a', 'a second opcode routes independently');

received.length = 0;
sock.deliver(enc.encode([12345, []]));
check(received.length === 0, 'an unmapped opcode is ignored rather than throwing');

// --------------------------------------------------------------------------
console.log('\n6. teardown');

sock.close();
check(c.proto() === null, 'the key and tables are dropped on close');
check(io.connected === false, 'connected flag cleared');

// --------------------------------------------------------------------------
console.log('\n7. the mohmoh path is untouched');

// mohmoh runs the 2019 protocol: it never sends mode=1, so nothing is framed
// and the old names still go out.
c.setHref('https://mohmoh.dev.tc/');
io.socket = null;
io.connected = false;
io.connect('wss://mohmoh.dev.tc', () => {}, {});
const legacy = io.socket;
legacy.open();
legacy.deliver(enc.encode(['io-init', [1]]));
check(c.proto() === null, 'no protocol state is built when the server does not negotiate');

legacy.sent.length = 0;
io.send('M', { name: 'x' });
const plain = dec.decode(new Uint8Array(legacy.sent[0]));
check(plain[0] === 'sp', 'the packet still goes out under its 2019 name ("M" -> "sp")');
check(plain.length === 2, 'and in the plain two-element form, with no MAC and no sequence');
c.setHref('https://moomoo.io/');

// --------------------------------------------------------------------------
console.log('\n8. captcha');

check(!/window\.superman = `alt:/.test(src), 'executeRecaptcha no longer mints an ALTCHA token');
check(/window\.superman = token;/.test(src),
      'window.superman now carries the Turnstile token, so the bot relays get the right prefix');
// one `alt:` string survives, in altKeyManager's worker branch -- that branch
// sits after an unconditional `return`, so it is unreachable
const altUses = (src.match(/`alt:/g) || []).length;
check(altUses === 1 && /e\(window\.superman\);\n\s*return;/.test(src),
      'the only ALTCHA string left is in altKeyManager\'s already-unreachable branch');
check(/CHKP\.waitForToken\(\)/.test(src), 'the connect waits for a Turnstile token');
check(/return captchaToken \? "cf:" \+ captchaToken : null;/.test(src),
      'and prefixes it "cf:" the way the server expects');
check(/onGotTurnstileToken/.test(src), "the page's Turnstile callback is wrapped to capture the token");
check(/i \+= "\/\?token=" \+ encodeURIComponent\(e\);/.test(src), 'the token is encoded into the URL');

// --------------------------------------------------------------------------
console.log('\n9. the page teardown no longer destroys what it needs');

check(/document\.body\.appendChild\(w\);/.test(src) && src.indexOf('pageEl("turnstileWidget")') < src.indexOf('dropEl("menuContainer")'),
      'the Turnstile widget is moved out before #menuContainer is removed');
check(!/document\.getElementById\("menuContainer"\)\.remove\(\)/.test(src),
      'nothing removes #menuContainer with the widget still inside it');
for (const id of ['linksContainer2', 'menuCardHolder', 'gameName', 'loadingText', 'partyButton', 'joinPartyButton', 'settingsButton']) {
  check(!new RegExp('getElementById\\("' + id + '"\\)\\.remove\\(\\)').test(src),
        '#' + id + ' removal is guarded');
}
check(/if \(pageEl\("ageBarContainer"\)\)/.test(src), '#ageBarContainer lookup is guarded');
check(/if \(pageEl\("topInfoHolder"\)\)/.test(src), '#topInfoHolder lookup is guarded');
check(/Object\.defineProperty\(window, "requestAnimFrame"/.test(src),
      "the page's render loop is stopped so it cannot repaint over this client");

console.log('\n' + (fails === 0 ? '=> ALL CHICKEN TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
