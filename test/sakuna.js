// Sakuna 44 is a hook mod, so it carries the same EXP shim as the other hook
// mods. What makes this one different is what had to come *out* of it: the
// author left a Google home-address harvester, a disguised password prompt and
// a per-frame telemetry payload in the file. Those checks come first, because
// they are the ones that must never regress.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const enc = new Encoder(), dec = new Decoder();

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'Sakuna.user.js'), 'utf8');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

// the script's own comments describe what was removed, so assertions about
// removal have to look at code only
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

// --------------------------------------------------------------------------
console.log('\n1. the surveillance is gone');

check(!/myaccount\.google\.com/.test(code),
      "nothing reaches into the user's Google account");
check(!/maps\/vt\/data/.test(code), 'no map tile of their home is built');
check(!/\bdm_\b|\bdn_\b|\bda_\b/.test(code),
      'the variables that held the address, the name and the map tile are gone');
check(!/GM_xmlhttpRequest/.test(code),
      'and the cross-origin request that fetched it is gone with them');

check(!/String\.fromCharCode\(69, ?110, ?116/.test(code),
      'the "Enter your Password" prompt, spelled out in char codes, is gone');
// the one surviving prompt is the alliance-rename dialog, a real feature
check(/prompt\("unique name"/.test(code) && (code.match(/prompt\(/g) || []).length === 1,
      'the only prompt left is the alliance rename, and it goes nowhere near a socket');

check(!/serverIsOpen/.test(code), "the author's telemetry gate is gone");
check(!/socket\.send/.test(code), 'and so is every send into that socket');
check(!/version: 44\.5/.test(code) && !/ModPing:/.test(code),
      'the per-frame payload carrying sid, position, ping, fps and URL is gone');
check(!/\bhref: window\.location\.href\b/.test(code),
      'including the page URL it reported');

// the mod's own features must survive the removal
check(/function AIReply\(/.test(code), 'the features around it are untouched');
check(/getEl\("modsyncshoot"\)/.test(code) || /modsyncshoot/.test(code),
      'the sync toggles it read are still there');

// --------------------------------------------------------------------------
console.log('\n2. the shim is the one every hook mod here carries');

check(extract.shimsMatch(), 'Sakuna carries a byte-identical EXP shim');

const { EXP } = extract.loadSakuna();

check(EXP._internals.HEADER_LEN === game.jt, 'header length (' + EXP._internals.HEADER_LEN + ')');
check(EXP._internals.MODE_SECURE === game.Ht, 'secure mode marker');

let tablesOk = true;
for (let n = 0; n < 2000 && tablesOk; n++) {
  const seed = (Math.random() * 4294967296) >>> 0;
  if (JSON.stringify(game.Po(seed)) !== JSON.stringify(EXP._internals.buildTables(seed))) tablesOk = false;
}
check(tablesOk, 'opcode tables identical to the game over 2000 random seeds');

let hmacOk = true;
for (let n = 0; n < 200 && hmacOk; n++) {
  const key = crypto.randomBytes(1 + Math.floor(Math.random() * 70));
  const msg = crypto.randomBytes(Math.floor(Math.random() * 200));
  if (!Buffer.from(EXP._internals.tag(key, msg)).equals(Buffer.from(game.Eo(key, msg)))) hmacOk = false;
}
check(hmacOk, 'HMAC tags identical to the game over 200 random pairs');

const rt = EXP.decode(EXP.encode(['M', [{ name: 'x', moofoll: true, skin: 0 }]]));
check(rt[0] === 'M' && rt[1][0].name === 'x',
      'the bundled msgpack round-trips (the rawgit @require it replaces is long dead)');

// --------------------------------------------------------------------------
console.log('\n3. framing on a live socket');

const SEED = 0x1A2B3C4D;
const KEY_HEX = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const sock = new global.window.WebSocket('wss://test.moomoo.io/?token=cf%3AX');
sock.deliver(enc.encode(['io-init', [1, SEED, KEY_HEX, game.Ht]]));
check(EXP.isSecure(sock), 'io-init is captured at construction, before the client attaches');

sock.sentRaw.length = 0;
EXP.send(sock, 'M', [{ name: 'sakuna' }]);
const frame = Buffer.from(sock.sentRaw[0]);
check(Buffer.from(game.Eo(key, frame.subarray(6))).equals(frame.subarray(0, 6)),
      'server-side HMAC verification passes');
const body = dec.decode(new Uint8Array(frame.subarray(6)));
check(tables.c2s.dec[body[0]] === 'M', 'opcode maps back to "M" (spawn)');
check(body[2] === 1, 'sequence starts at 1');

// --------------------------------------------------------------------------
console.log('\n4. the packet names it uses');

// the scraper is gone; the names are a fixed table now
check(!/data\.split\(`keyup`\)/.test(code) && !/data\.split\(`abs\(e-`\)/.test(code),
      'the bundle string-scraper that produced these names is gone');
check(/const code = \{/.test(code), 'they are a fixed table instead');

const NAMES = {
  attack: 'F', move: '9', upgrade: 'H', gather: 'K', select: 'z',
  aim: 'D', chat: '6', store: 'c', spawn: 'M', join: 'P',
  kick: 'Q', joinclan: 'b', creatclan: 'L', removeclan: 'N', ping: '0',
};
const declared = {};
const block = src.slice(src.indexOf('const code = {'), src.indexOf('};', src.indexOf('const code = {')));
for (const m of block.matchAll(/(\w+):\s*"([^"]+)"/g)) declared[m[1]] = m[2];
check(JSON.stringify(declared) === JSON.stringify(NAMES),
      'and every one of the 15 matches the name the current server uses');

let allResolve = true, failed = null;
for (const name of Object.values(NAMES)) {
  sock.sentRaw.length = 0;
  EXP.send(sock, name, [1]);
  if (sock.sentRaw.length !== 1) { allResolve = false; failed = name; break; }
  const op = dec.decode(new Uint8Array(Buffer.from(sock.sentRaw[0]).subarray(6)))[0];
  if (tables.c2s.dec[op] !== name) { allResolve = false; failed = name; break; }
}
check(allResolve, 'all 15 resolve to opcodes and back'
      + (failed ? ' (failed on "' + failed + '")' : ''));

// --------------------------------------------------------------------------
console.log('\n5. incoming');

const inbound = EXP.receive(sock, enc.encode([tables.s2c.enc['P'], [7]]));
check(inbound && inbound.type === 'P' && inbound.args[0] === 7,
      'a numeric opcode is decoded back to its handler name');
check(EXP.receive(sock, enc.encode([9999, []])) === null,
      'an unmapped opcode returns null rather than throwing');
check(/EXP\.receive\(message\.target \|\| WS, message\.data\)/.test(code),
      'getMessage reads through the shim, so the handler table still keys on names');

// --------------------------------------------------------------------------
console.log('\n6. it can actually run');

check(/@run-at\s+document-start/.test(src), 'it runs at document-start now');
check(/function __sakunaBoot\(\)/.test(code), 'with the DOM work deferred');
check(/DOMContentLoaded", __sakunaBoot/.test(code), 'until the document is ready');
check(!/rawgit\.com/.test(code), 'the dead rawgit msgpack injection is gone');
// the shim's own trampoline (NativeWebSocket.prototype.send) is the point; what
// must be gone is the client's own override of the global prototype
check(!/^WebSocket\.prototype\.send = function/m.test(code)
      && !/^WebSocket\.prototype\.nsend/m.test(code),
      'it no longer overwrites a prototype method the game already captured');
check(!/const originalSend = /.test(code),
      'and the stale capture of that method is gone too');
check(/EXP\.setHandler\(/.test(code), 'it registers with the shim instead');
check(/function applyOutgoing\(type, data\)/.test(code),
      'the packet rules are shared, so injected packets get the same treatment');
check(/const outgoing = applyOutgoing\(type, data\);/.test(code),
      'and packet() really does go through them');

// --------------------------------------------------------------------------
console.log('\n7. captcha');

check(!/altcha_checkbox/.test(code), 'it no longer clicks an element the page dropped');
check(!/"alt:"/.test(code), 'and no longer mints ALTCHA tokens the server rejects');
check(/EXP\.freshToken\(\)/.test(code), 'tokens come from Turnstile');
check(/const botToken = await EXP\.freshToken\(\);/.test(code),
      'including one per bot, since Turnstile tokens are single-use');
check(!/GM_getValue\(|GM_setValue\(/.test(code),
      'the GM_ storage calls, undefined under "@grant none", are gone');
check(/localStorage\.setItem\("sakuna_tokenlist"/.test(code)
      && /localStorage\.setItem\("sakuna_chatalist"/.test(code),
      'replaced with localStorage on both call sites');

console.log('\n' + (fails === 0 ? '=> ALL SAKUNA TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
