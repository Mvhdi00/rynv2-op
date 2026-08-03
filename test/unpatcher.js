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
// `pre` is JS spliced in after the fake page is built but before the unpatcher
// loads -- the same position a userscript manager gives you.
function loadUnpatcher(pre) {
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

// --- just enough page for the shims to have something to act on ----------
class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.id = ''; this.style = {}; this.children = []; this.parentNode = null;
    this.textContent = ''; this.innerHTML = '';
    this.classList = { add(){}, remove(){}, contains(){ return false; } };
  }
  get parentElement() { return this.parentNode; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; }
    return c;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
}
const realEls = Object.create(null);
global.FakeElement = FakeElement;
global.addRealElement = function (id) {
  const el = new FakeElement('div'); el.id = id; realEls[id] = el; return el;
};
global.document = {
  documentElement: new FakeElement('html'),
  body: null,
  head: new FakeElement('head'),
  createElement(tag) { return new FakeElement(tag); },
  getElementById(id) { return realEls[id] || null; }
};

const storage = new Map();
const listeners = {};
global.window = {
  WebSocket: FakeWebSocket,
  localStorage: {
    get length() { return storage.size; },
    key(i) { return [...storage.keys()][i]; },
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); },
    removeItem(k) { storage.delete(k); }
  },
  addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
  dispatch(t, ev) { (listeners[t] || []).forEach(f => f(ev)); }
};
global.WebSocket = FakeWebSocket;
global.navigator = { clipboard: { writeText() { return Promise.resolve(); } } };
${pre || ''}
// shadow console for the loaded module only -- replacing the global one would
// silence the test output too. Kept, not discarded: what the shim says is part
// of what it does.
const said = { info: [], warn: [], error: [], log: [] };
global.said = said;
const console = {
  info(...a) { said.info.push(a.join(' ')); },
  warn(...a) { said.warn.push(a.join(' ')); },
  error(...a) { said.error.push(a.join(' ')); },
  log(...a) { said.log.push(a.join(' ')); }
};
`;
  const file = path.join(__dirname, '.generated', 'unpatcher_' + Math.random().toString(36).slice(2) + '.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, harness + body +
    '\nmodule.exports = { EXP, UNPATCH, WebSocket: global.WebSocket, window: global.window,' +
    ' document: global.document, storage, addRealElement: global.addRealElement, said: global.said };\n');
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

// A script from this repo already frames its own packets. Stacking the two is
// the one configuration that is worse than running neither, so it has to keep
// working AND say so.
{
  const U = loadUnpatcher();
  const sock = new U.window.WebSocket('wss://server');
  handshake(sock);
  U.WebSocket.prototype.send = function (buf) { this.nsend(buf); };   // a mod hook
  const already = frameFromServerSide('9', [1.5], 7);
  sock.sentRaw.length = 0;
  U.WebSocket.prototype.send.call(sock, already);

  check(sock.sentRaw.length === 1 && Buffer.from(sock.sentRaw[0]).equals(Buffer.from(already)),
        'a mod that frames for itself still gets its frame out untouched');
  check(U.said.warn.some(w => /does not need the unpatcher/.test(w)),
        'and is told it does not need the unpatcher');
}

// --------------------------------------------------------------------------
// Everything below is the non-protocol half: the reasons a mod dies before it
// ever reaches the socket. Each of these was a separate hand fix in this repo
// before it became a shim.
console.log('\n5. the "@grant none" holes');
{
  const U = loadUnpatcher();
  const w = U.window;
  check(w.unsafeWindow === w, 'unsafeWindow is the page window, which is what it means under @grant none');

  w.GM_setValue('hats', { primary: 6 });
  check(JSON.stringify(w.GM_getValue('hats')) === '{"primary":6}', 'GM_setValue / GM_getValue round-trip');
  check(w.GM_getValue('never-set', 'fallback') === 'fallback', 'and an unset key gives the caller its default');
  check(U.storage.has('unpatch.gm:hats'), 'backed by localStorage under a namespaced key');
  check(w.GM_listValues().indexOf('hats') !== -1, 'GM_listValues sees it');
  w.GM_deleteValue('hats');
  check(w.GM_getValue('hats') === undefined, 'GM_deleteValue removes it');

  const style = w.GM_addStyle('body{color:red}');
  check(style && style.tagName === 'STYLE' && style.parentNode === U.document.head,
        'GM_addStyle really puts a <style> in the head');
  check(typeof w.GM_registerMenuCommand === 'function' && typeof w.GM_info === 'object',
        'the remaining GM_* names exist so referencing them cannot throw');

  w.GM.setValue('x', 4);
  check(w.GM.getValue('x') instanceof Promise, 'the GM.* namespace is promise-shaped');
  check(w.GM_getValue('x') === 4, 'and shares one store with the GM_* functions');
}

console.log('\n6. the codec, in all three shapes mods ask for it');
{
  const U = loadUnpatcher();
  const w = U.window;
  const round = (v) => w.msgpack.decode(w.msgpack.encode(v));
  check(JSON.stringify(round(['sp', [{ name: 'a' }]])) === '["sp",[{"name":"a"}]]',
        'window.msgpack round-trips (msgpack-lite shape)');
  check(typeof w.msgpack5 === 'function' && w.msgpack5().encode === w.msgpack.encode,
        'msgpack5() returns the same codec');
  const e = new w.msgpack.Encoder(), d = new w.msgpack.Decoder();
  check(JSON.stringify(d.decode(e.encode([1, 2]))) === '[1,2]',
        'and the Encoder/Decoder classes the game vendor uses work too');
}

console.log('\n7. page elements the game deleted');
{
  const U = loadUnpatcher();
  const doc = U.document;

  // the line that kills most of these mods, verbatim
  let threw = null;
  try {
    const el = doc.getElementById('adCard');
    el.parentNode.removeChild(el);
    doc.getElementById('promoImgHolder').style.display = 'none';
    doc.getElementById('ot-sdk-btn-floating').remove();
  } catch (err) { threw = err; }
  check(threw === null, 'the ad/promo teardown every mod opens with no longer throws');

  check(doc.getElementById('gameCanvas') === null, 'an id that is not on the list still returns null');
  check(doc.getElementById('turnstileWidget') === null, 'so feature tests keep telling the truth');

  const real = U.addRealElement('adsWrapper');
  check(doc.getElementById('adsWrapper') === real, 'a real element always wins over the placeholder');

  const rep = U.UNPATCH.report();
  check(rep.placeholdersHandedOut.indexOf('adCard') !== -1, 'and the report names every placeholder handed out');
}
{
  const U = loadUnpatcher("global.window.UNPATCH_EXTRA_IDS = ['someModsOwnDiv'];");
  check(U.document.getElementById('someModsOwnDiv') !== null, 'UNPATCH_EXTRA_IDS extends the list');
  check(U.document.getElementById('stillNotListed') === null, 'without opening it up to everything');
}

console.log('\n8. the constructor the bundle tries to freeze');
{
  const U = loadUnpatcher();
  const w = U.window;
  const ours = w.WebSocket;

  // exactly what the game does: capture, then pin it beyond reach
  let hardened = true;
  try {
    Object.defineProperty(w, 'WebSocket', { value: ours, writable: false, configurable: false });
  } catch (e) { hardened = false; }          // the bundle swallows this too
  check(hardened === false, "the game's pin is refused, the way it is in a real page");
  check(w.WebSocket === ours, 'and the constructor is still ours afterwards');

  // which is the whole point: a mod can still wrap it
  const seen = [];
  const previous = w.WebSocket;
  w.WebSocket = function (url) { seen.push(url); return new previous(url); };
  const sock = new w.WebSocket('wss://example');
  check(seen.length === 1 && sock instanceof U.WebSocket, "a mod's own wrapper still takes effect");
}

console.log('\n9. the connect URL');
{
  const U = loadUnpatcher();
  const w = U.window;
  check(U.UNPATCH.fixUrl('wss://x.moomoo.io?token=old-recaptcha') === 'wss://x.moomoo.io?token=old-recaptcha',
        'with no token of our own, the URL is left exactly as it was');

  w.turnstile = { getResponse() { return 'TOK'; } };
  check(U.UNPATCH.fixUrl('wss://x.moomoo.io?token=old-recaptcha') === 'wss://x.moomoo.io?token=cf%3ATOK',
        'a stale reCAPTCHA token is replaced with the live Turnstile one');
  check(U.UNPATCH.fixUrl('wss://x.moomoo.io') === 'wss://x.moomoo.io?token=cf%3ATOK',
        'and a missing one is added');
  check(U.UNPATCH.fixUrl('wss://x.moomoo.io?token=cf%3AALREADY') === 'wss://x.moomoo.io?token=cf%3AALREADY',
        'a token that is already current is not touched');
  check(U.UNPATCH.fixUrl('https://api.moomoo.io/x') === 'https://api.moomoo.io/x',
        'and nothing that is not a socket URL is rewritten');

  const sock = new w.WebSocket('wss://x.moomoo.io');
  check(sock.url === 'wss://x.moomoo.io?token=cf%3ATOK', 'a mod opening a socket gets the repaired URL');
}

console.log('\n10. naming what is left');
{
  const U = loadUnpatcher();
  const D = U.UNPATCH.diagnose;
  check(/@grant none/.test(D('unsafeWindow is not defined') || ''), 'unsafeWindow -> the grant');
  check(/@grant none/.test(D('GM_getValue is not defined') || ''), 'GM_* -> the grant');
  check(/rawgit/.test(D('msgpack is not defined') || ''), 'msgpack -> the dead CDN');
  check(/jQuery @require/.test(D('$ is not defined') || ''), 'jQuery -> its @require');
  check(/UNPATCH_EXTRA_IDS/.test(D("Cannot read properties of null (reading 'parentNode')") || ''),
        'a null page element -> the placeholder list');
  check(/ordered ABOVE|order it above/i.test(D("Cannot assign to read only property 'WebSocket' of object '#<Window>'") || ''),
        'a frozen WebSocket -> the load order');
  check(/scrape the game bundle/.test(D('Qo is not defined') || ''),
        'and an unknown global -> a bundle scraper, which needs a real edit');
  check(D('something nobody has seen before') === null, 'anything else is reported as unknown, not guessed at');

  // the errors really are captured, not just diagnosable
  U.window.dispatch('error', { message: 'GM_setValue is not defined' });
  U.window.dispatch('error', { message: 'GM_setValue is not defined' });
  const rep = U.UNPATCH.report();
  check(rep.errors.length === 1, 'an uncaught error is recorded once, not once per throw');
  check(rep.errors[0].diagnosis !== null, 'with its diagnosis attached');
}

console.log('\n11. the report, which is the thing you paste back');
{
  const U = loadUnpatcher();
  const sock = new U.window.WebSocket('wss://server');
  handshake(sock);
  U.WebSocket.prototype.send = function (buf) { this.nsend(buf); };
  U.WebSocket.prototype.send.call(sock, U.EXP.encode(['sp', [{ name: 'x' }]]));
  U.WebSocket.prototype.send.call(sock, U.EXP.encode(['not-a-packet', []]));

  const rep = U.UNPATCH.report();
  check(rep.handshake === true, 'it says whether the handshake was ever captured');
  check(rep.generation === 'old', 'which generation the mod turned out to be');
  check(rep.packetsFramed === 1, 'how many packets it framed');
  check(rep.unknownPacketNames.join() === 'not-a-packet', 'and names the ones it had to drop');
  check(rep.shims.indexOf('msgpack') !== -1 && rep.shims.indexOf('unsafeWindow') !== -1,
        'plus every shim it installed');
}

console.log('\n12. a full client replacement, which owns the socket outright');
{
  const U = loadUnpatcher();
  const got = [];
  // A client replacement is the FIRST handler on its socket -- there is no game
  // bundle underneath -- so the ordering rule alone would mistake it for the
  // game and hand it raw numeric opcodes. The stack says otherwise: this
  // handler is installed from an extension URL.
  const installFromExtension = new Function('sock', 'decode', 'out',
    'sock.onmessage = function (ev) { out.push(decode(ev.data)); };\n' +
    '//# sourceURL=chrome-extension://abcdefghijklmnop/mod.user.js');

  const sock = new U.window.WebSocket('wss://server');
  installFromExtension(sock, U.EXP.decode, got);
  handshake(sock);
  U.UNPATCH.setGeneration('current');
  got.length = 0;
  sock.deliver(enc.encode([tables.s2c.enc['O'], [3, 77]]));
  check(got.length === 1, 'the handler ran');
  check(got[0] && got[0][0] === 'O',
        'and got a named packet, not the raw opcode, even though it was first on the socket');
}

console.log('\n' + (fails === 0 ? '=> ALL UNPATCHER TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
