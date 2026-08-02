// Peter Client is another hook-style mod, so it carries the same EXP shim.
// What is specific to it: it fetched msgpack by injecting a <script> tag at a
// dead host, it kept a second sender that deliberately bypassed its own rules,
// and both its bot handler and its move rule still used pre-2020 packet names.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const { EXP, window } = extract.loadPeter();
const enc = new Encoder(), dec = new Decoder();

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'PeterClient.user.js'), 'utf8');
const body = src.slice(src.indexOf('function __peterBoot() {'));

/**
 * Comments describe what was removed, so a plain substring search over the
 * source would keep finding the things the fix took out. Strip comments (while
 * respecting strings, so "wss://" survives) and search the code instead.
 */
function stripComments(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      out += s[i++];
      while (i < s.length && s[i] !== q) {
        if (s[i] === '\\') out += s[i++];
        out += s[i++];
      }
      out += s[i++];
      continue;
    }
    out += s[i++];
  }
  return out;
}
const code = stripComments(body);

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// --------------------------------------------------------------------------
console.log('\n1. load order');

check(/^\/\/ @run-at\s+document-start$/m.test(src.slice(0, src.indexOf('// ==/UserScript=='))),
      'runs at document-start');
check(src.indexOf('const EXP = (function() {') < src.indexOf('function __peterBoot() {'),
      'the shim is installed before the deferred body');
check(/document\.addEventListener\("DOMContentLoaded", __peterBoot/.test(src),
      'the body waits for the document');
check(extract.shimsMatch(), 'Peter carries a byte-identical EXP shim');

// --------------------------------------------------------------------------
console.log('\n2. the dead msgpack dependency');

check(!/rawgit\.com/.test(code) && !/createElement\("script"\)/.test(code),
      'the rawgit <script> injection is gone');
// the only remaining window.msgpack calls are the glitch.me relay, which speaks
// plain msgpack and is not a game socket
const remaining = code.match(/window\.msgpack\.(encode|decode)/g) || [];
check(remaining.length === 2, 'only the relay still uses window.msgpack (' + remaining.length + ' call sites)');
check(!/(^|[^.\w])msgpack\.(encode|decode)\(/.test(code), 'no bare msgpack.* left');
check(/window\.msgpack = \{ encode: encode, decode: decode \};/.test(src),
      'the shim publishes window.msgpack, so the relay calls still resolve');

// --------------------------------------------------------------------------
console.log('\n3. the transport is wired in');

check(!/WebSocket\.prototype\.(n)?send\s*=/.test(code),
      'the client no longer reassigns WebSocket.prototype.send');
check(!/\bnsend\b/.test(code), 'no nsend call sites left');
check(/EXP\.setHandler\(function\(message\) \{/.test(body), 'the hook goes through the shim');
check(/function applyOutgoing\(type, data\)/.test(body), 'the outgoing rules are shared');
check((code.match(/EXP\.receive\(/g) || []).length === 2,
      'both receive paths go through the shim (game and bot)');
check((code.match(/EXP\.send\(/g) || []).length === 4,
      'all four send paths go through the shim (hook, packet, origPacket, bot)');
// origPacket() exists to skip the client's own rules -- but it still has to frame
check(/EXP\.send\(WS, type, data\);\n    \}/.test(body),
      'origPacket() still bypasses applyOutgoing but is framed now');

// --------------------------------------------------------------------------
console.log('\n4. protocol port matches the game bundle');

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
console.log('\n5. framing');

const SEED = 0x1F2E3D4C;
const KEY_HEX = '89abcdef0123456776543210fedcba98';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const sock = new window.WebSocket('wss://server');
sock.deliver(enc.encode(['io-init', [6, SEED, KEY_HEX, game.Ht]]));
check(EXP.isSecure(sock), 'handshake captured at construction time');

sock.sentRaw.length = 0;
EXP.send(sock, 'M', [{ name: 'peter', moofoll: 1, skin: 0 }]);
const frame = Buffer.from(sock.sentRaw[0]);
check(Buffer.from(game.Eo(key, frame.subarray(6))).equals(frame.subarray(0, 6)),
      'server-side HMAC verification passes');
const parsed = dec.decode(new Uint8Array(frame.subarray(6)));
check(tables.c2s.dec[parsed[0]] === 'M', 'opcode maps back to "M"');
check(parsed[2] === 1, 'sequence starts at 1');

// --------------------------------------------------------------------------
console.log('\n6. the pre-2020 packet names this client still used');

// outgoing: it emits the move packet as "f"; the game sends the same packet as "9"
sock.sentRaw.length = 0;
EXP.send(sock, 'f', [1.2, 1]);
const moved = dec.decode(new Uint8Array(Buffer.from(sock.sentRaw[0]).subarray(6)));
check(tables.c2s.dec[moved[0]] === '9', '"f" is remapped to "9" (move) on the way out');
check(/if \(Object\.prototype\.hasOwnProperty\.call\(EXP\.PACKET_MAP, type\)\) type = EXP\.PACKET_MAP\[type\];/.test(body),
      'applyOutgoing folds the old names first, so one rule covers both');
check(/\} else if \(type == "9"\) \{/.test(code) && !/\} else if \(type == "f"\) \{/.test(code),
      'the move-dedup rule now matches the name the game actually sends');

// incoming: the bot handler branched on the 2019 names
check(!/if \(type == "1"\) \{/.test(code), 'the bot no longer waits for "1" (2019 setupGame)');
check(/if \(type == "C"\) \{\n                botSID = data\[0\];/.test(body),
      'it reads its sid from "C" instead');
check(!/if \(type == "f"\) \{/.test(code), 'the bot no longer waits for "f" (2019 updatePlayers)');
check(/if \(type == "a"\) \{\n                let tmpData = data\[0\];/.test(body),
      'it reads the player array from "a" instead');

// --------------------------------------------------------------------------
console.log('\n7. junk packets are dropped, not sent');

sock.sentRaw.length = 0;
const sent = EXP.send(sock, 'kys', [{ 'frvr is so bad': true }]);
check(sent === false && sock.sentRaw.length === 0,
      'window.leave()\'s "kys" packet has no opcode, so it is dropped rather than'
      + ' put on a MAC-authenticated channel');

// --------------------------------------------------------------------------
console.log('\n8. incoming routing and per-socket isolation');

const inbound = EXP.receive(sock, enc.encode([tables.s2c.enc['C'], [12]]));
check(inbound.type === 'C' && inbound.args[0] === 12, 'numeric opcode decoded to "C"');
check(EXP.receive(sock, enc.encode([12345, []])) === null, 'unmapped opcode returns null');

const KEY2 = '0f0f0f0f1e1e1e1e2d2d2d2d3c3c3c3c', SEED2 = 0x77AA33BB;
const bot = new window.WebSocket('wss://bot');
bot.deliver(enc.encode(['io-init', [2, SEED2, KEY2, game.Ht]]));
bot.sentRaw.length = 0;
EXP.send(bot, 'M', [{ name: 'Trash Slave' }]);
const bf = Buffer.from(bot.sentRaw[0]);
check(Buffer.from(game.Eo(game.Ro(KEY2), bf.subarray(6))).equals(bf.subarray(0, 6)),
      'bot socket signs with its own key');
check(!Buffer.from(game.Eo(key, bf.subarray(6))).equals(bf.subarray(0, 6)),
      'the main socket\'s key does not validate it');

// --------------------------------------------------------------------------
console.log('\n9. captcha and the DOM guards');

check(!/grecaptcha/.test(code), 'no reCAPTCHA call sites left');
check((code.match(/EXP\.freshToken\(\)/g) || []).length === 2,
      'both bot paths ask Turnstile for a token');
check(!/\?token=re:/.test(code), 'the "re:" token prefix is gone from the bot URLs');

check(/if \(adCard\) adCard\.remove\(\);/.test(body), '#adCard removal is null-guarded');
check(/if \(promoImageHolder\) promoImageHolder\.remove\(\);/.test(body),
      '#promoImgHolder removal is null-guarded');
check(/if \(document\.getElementById\("gameName"\) && document\.getElementById\("enterGame"\)\) \{/.test(body),
      'the menu intro is guarded, so a missing element cannot kill the client');

console.log('\n' + (fails === 0 ? '=> ALL PETER CLIENT TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
