// Annihilator v0.8.9 is a hook mod of the usual shape, so it gets the usual
// EXP shim. What is specific to it is checked here: the two metadata mistakes
// that meant not one line of the file ever ran, and the three seams where its
// own socket code was rewired onto the shim.
const fs = require('fs');
const path = require('path');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const { EXP, FakeWebSocket } = extract.loadAnnihilator();
const enc = new Encoder(), dec = new Decoder();

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'Annihilator.user.js'), 'utf8');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// The mod's own code, with the bundled shim cut out, so "no leftover old
// transport" cannot be satisfied by the shim's own internals.
const shimStart = src.indexOf('const EXP = (function() {');
const shimEnd = src.indexOf('\n)();\n', shimStart) + 5;
const modCode = src.slice(0, shimStart) + src.slice(shimEnd);

// --------------------------------------------------------------------------
console.log('\n1. the two metadata mistakes, either of which alone was fatal');

const metaEnd = src.indexOf('// ==/UserScript==');
const meta = src.slice(0, metaEnd);
check(/^\/\/ @run-at\s+document-start$/m.test(meta),
      'the @run-at value is document-start');
check(!/document_start/.test(meta),
      'and not "document_start", which is not a value Tampermonkey accepts -- '
      + 'it silently fell back to document-end, long after the game had taken '
      + 'its reference to WebSocket.prototype.send');
check(!/@require/.test(meta),
      'the rawgit.com @require is gone; a @require that 404s aborts the entire '
      + 'userscript, so every line of this file was dead');
check(meta.split('\n').every(l => l === '' || l.startsWith('//')),
      'the metadata block is still all comments');

// --------------------------------------------------------------------------
console.log('\n2. the shim');

check(extract.shimsMatch(),
      'the bundled shim is byte-identical to the one every other hook mod carries');
check(shimStart < src.indexOf('EXP.setHandler('),
      'and is installed before anything that uses it');
check(/window\.msgpack = \{ encode: encode, decode: decode \}/.test(src),
      'it publishes window.msgpack, replacing the dead @require');

// --------------------------------------------------------------------------
console.log('\n3. no part of the mod still speaks the old transport');

check(!/window\.msgpack\./.test(modCode),
      'nothing in the mod encodes or decodes for itself any more');
check(!/\.nsend\(/.test(modCode),
      'no calls to nsend, which no longer means anything');
check(!/WebSocket\.prototype\.send\s*=/.test(modCode),
      'and the mod no longer installs its own prototype hook -- the shim owns it');

// --------------------------------------------------------------------------
console.log('\n4. the three seams');

check(/EXP\.setHandler\(function \(message, sid\) \{/.test(src),
      'outgoing traffic arrives through the shim handler');
check(/const unframed = EXP\.unframe\(this, message\);/.test(src),
      'which unframes what the game hands it');
check(/sendFiltered\(this, unframed\.type, unframed\.args\);/.test(src),
      'and passes the name and arguments to the mod\'s own filters');
check(/function sendFiltered\(sock, type, data\) \{/.test(src),
      "the filters live in a function now, so the mod's own packet() reaches them");
check(/if \(!dontSend\) \{\s*EXP\.send\(sock, type, data\);/.test(src),
      'and the one place that used to encode-and-nsend now frames through the shim');

// packet() must keep going through the filters; origPacket() must keep skipping
// them. That was the difference between WS.send and WS.nsend before.
{
  const p = src.slice(src.indexOf('function packet(type) {'));
  check(/sendFiltered\(WS, type, data\);/.test(p.slice(0, 200)),
        'packet() still runs through the filters, as WS.send did');
  const o = src.slice(src.indexOf('function origPacket(type) {'));
  check(/EXP\.send\(WS, type, data\);/.test(o.slice(0, 200)),
        'origPacket() still bypasses them, as WS.nsend did');
}

check(/let parsed = EXP\.receive\(message\.target \|\| WS, message\.data\);/.test(src),
      'incoming packets come back through the shim');
check(/if \(!parsed\) return;/.test(src),
      'and an opcode the shim cannot place is dropped rather than crashing the handler');

// --------------------------------------------------------------------------
console.log('\n5. the wire, against the game bundle\'s own crypto');

const SEED = 0x5AFE5EED, KEY_HEX = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const sock = new FakeWebSocket('wss://x.moomoo.io');
sock.readyState = 1;
EXP._internals.states.set(sock, {
  mode: 1, key, tables: game.Po(SEED), seq: 0
});

// what the mod sends, read back the way the server would
function readFrame(buf) {
  const b = Buffer.from(buf);
  const ok = Buffer.from(game.Eo(key, b.subarray(6))).equals(b.subarray(0, 6));
  const d = dec.decode(new Uint8Array(b.subarray(6)));
  return { ok, name: tables.c2s.dec[d[0]], args: d[1], seq: d[2] };
}

sock.sentRaw.length = 0;
EXP.send(sock, 'M', [{ name: 'probe', moofoll: 1, skin: 0 }]);
check(sock.sentRaw.length === 1, 'a spawn packet goes out');
{
  const f = readFrame(sock.sentRaw[0]);
  check(f.ok, 'the server-side HMAC verifies');
  check(f.name === 'M', 'it arrives as the opcode the server expects for "M"');
  check(f.seq === 1, 'carrying the first sequence number');
}

// every name this mod actually sends must resolve to an opcode
{
  const names = [...new Set(
    [...src.matchAll(/(?:packet|origPacket|io\.send)\(\s*"([^"]+)"/g)].map(m => m[1])
  )];
  const resolved = names.filter(n => tables.c2s.enc[n] !== undefined);
  const unresolved = names.filter(n => tables.c2s.enc[n] === undefined);
  check(names.length >= 10, 'the mod sends a real vocabulary (' + names.length + ' names)');
  check(unresolved.join() === 'kys',
        'all of them resolve to opcodes except "kys"' +
        (unresolved.join() === 'kys' ? '' : ' (unresolved: ' + unresolved.join(', ') + ')'));
  check(resolved.length === names.length - 1,
        '"kys" is the mod\'s own joke in window.leave, not a packet -- the shim '
        + 'drops it instead of putting garbage on a signed channel');
}

// and what the server sends, read the way the mod's events table is keyed
{
  const framed = enc.encode([tables.s2c.enc['O'], [7, 42]]);
  const got = EXP.receive(sock, framed);
  check(got && got.type === 'O', 'an incoming opcode comes back as the name "O" (updateHealth)');
  check(JSON.stringify(got.args) === '[7,42]', 'with its arguments intact');
  check(/O: updateHealth/.test(src), 'which is the key the mod\'s events table uses');
}

console.log('\n' + (fails === 0 ? '=> ALL ANNIHILATOR TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
