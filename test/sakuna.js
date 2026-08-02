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
check(/__sakunaStart\(\);/.test(code), 'until the game is ready');
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

// --------------------------------------------------------------------------
console.log('\n8. the boot survives running early');

// Moving to document-start broke this once already: `unsafeWindow` is undefined
// under "@grant none", and at document-end window.config always happened to be
// set, so the || short-circuited and nobody noticed. Booting earlier made the
// right-hand side evaluate, which threw and killed the rest of the boot -- the
// game ran with none of the mod on screen.
check(!/window\.config \|\| unsafeWindow\.config/.test(code),
      'the bare unsafeWindow fallback is gone');
check(/typeof unsafeWindow !== "undefined"/.test(code),
      'and the only reference left is behind a typeof guard');

check(/function __sakunaStart\(waited\)/.test(code),
      'the boot waits on the game, not merely on the DOM');
check(/if \(window\.config && document\.body\)/.test(code),
      'specifically on window.config, which is what it reads first');
check(/waited > 30000/.test(code), 'and gives up loudly rather than polling forever');
check(/function __sakunaBootSafely\(\)/.test(code)
      && /the mod failed to start/.test(src),
      'a boot that throws says so instead of just not appearing');

// every identifier the boot reaches before any function call must exist
{
  const acorn = require('acorn');
  const ast = acorn.parse(src, { ecmaVersion: 'latest' });
  let boot = null;
  for (const n of ast.body) if (n.type === 'FunctionDeclaration' && n.id.name === '__sakunaBoot') boot = n;
  const declared = new Set(require('module').builtinModules ? [] : []);
  for (const g of ['window','document','console','Math','JSON','Date','Object','Array','String','Number',
                   'Boolean','Promise','Map','Set','Symbol','RegExp','Error','parseInt','parseFloat','isNaN',
                   'setTimeout','setInterval','clearTimeout','clearInterval','fetch','localStorage','navigator',
                   'location','performance','requestAnimationFrame','Uint8Array','DataView','ArrayBuffer',
                   'TextEncoder','TextDecoder','Image','Audio','WebSocket','Blob','FileReader','URL','btoa',
                   'atob','alert','prompt','screen','history','Event','Storage','CanvasRenderingContext2D',
                   'MessageChannel','crypto','undefined','NaN','Infinity','globalThis']) declared.add(g);
  // a name the file guards with `typeof x !== "undefined"` cannot throw where
  // it is used, so treat it as safe rather than build a reachability analyser
  for (const m of src.matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*[!=]==?\s*["']undefined["']/g)) declared.add(m[1]);
  (function collect(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(collect);
    if ((n.type === 'VariableDeclarator' || n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration')
        && n.id && n.id.name) declared.add(n.id.name);
    if (/Function/.test(n.type)) (n.params || []).forEach(p => { if (p.name) declared.add(p.name); });
    for (const k in n) if (k !== 'type' && k !== 'start' && k !== 'end') collect(n[k]);
  })(ast);

  const risky = [];
  for (const st of boot.body.body) {
    if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') continue;
    (function scan(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(scan);
      if (/FunctionExpression|ArrowFunctionExpression/.test(n.type)) return;   // deferred, not boot-time
      // `typeof x` on an undeclared name is legal and is exactly how the
      // unsafeWindow reference is guarded
      if (n.type === 'UnaryExpression' && n.operator === 'typeof'
          && n.argument.type === 'Identifier') return;
      if (n.type === 'Identifier' && !declared.has(n.name)) risky.push(n.name);
      if (n.type === 'MemberExpression') { scan(n.object); if (n.computed) scan(n.property); return; }
      if (n.type === 'Property') { if (n.computed) scan(n.key); scan(n.value); return; }
      for (const k in n) if (k !== 'type' && k !== 'start' && k !== 'end') scan(n[k]);
    })(st);
  }
  check(risky.length === 0,
        'nothing the boot touches immediately is an undeclared identifier'
        + (risky.length ? ' (found: ' + [...new Set(risky)].join(', ') + ')' : ''));
}

// --------------------------------------------------------------------------
console.log('\n9. three boot failures a browser found that reading could not');

// 1. `hue` shared a declaration with `code` (`let code, hue = 0;`). Replacing
// the packet scraper took that line out and left `hue` undeclared; updateGame()
// reads it every frame, so the render loop threw on every tick.
check(/^let hue = 0;$/m.test(code), '`hue` is declared');
check(/hue = \(hue \+ delta\/FPS60\) % 360;/.test(code), 'and the render loop that reads it is intact');

// 2. Five page elements torn down with no null check. The ad card, promo image
// and Google Ad Manager slot are all absent when ads are blocked.
for (const [name, guard] of [
  ['gameName', /if \(gameName\) gameName\.innerText/],
  ['adCard', /if \(adCard\) adCard\.remove\(\)/],
  ['promoImgHolder', /if \(promoImageHolder\) promoImageHolder\.remove\(\)/],
  ['the ad banner slot', /if \(adBanner\) adBanner\.remove\(\)/],
  ['chatButton', /if \(chatButton\) chatButton\.remove\(\)/],
]) check(guard.test(code), name + ' is only touched when it exists');

// 3. `window.CG = function () {...}` with no terminating semicolon, followed by
// a leftover boilerplate IIFE, parsed as one expression -- so the function was
// *called* on load, with WS undefined.
check(/console\.log\("close"\)\n\};/.test(code),
      'the window.CG assignment is terminated');
check(!/\/\/ @name {9}New Userscript/.test(src),
      'and the empty boilerplate whose "(" caused it is gone');
{
  const acorn = require('acorn');
  // preserveParens tells a deliberate IIFE -- `x = (function(){}）()` -- apart
  // from the accident, where an unparenthesised function expression is glued to
  // a following `(` by the absence of a semicolon
  const ast = acorn.parse(src, { ecmaVersion: 'latest', preserveParens: true });
  let boot = null;
  for (const n of ast.body) if (n.type === 'FunctionDeclaration' && n.id.name === '__sakunaBoot') boot = n;
  const accidental = [];
  for (const st of boot.body.body) {
    if (st.type !== 'ExpressionStatement') continue;
    const e = st.expression;
    if (e.type === 'AssignmentExpression' && e.right.type === 'CallExpression'
        && /FunctionExpression/.test(e.right.callee.type)) {
      accidental.push(src.slice(st.start, st.start + 40).replace(/\n/g, ' '));
    }
  }
  check(accidental.length === 0,
        'no unparenthesised function expression in the boot is called by accident'
        + (accidental.length ? ' (' + accidental[0] + ')' : ''));
}

console.log('\n' + (fails === 0 ? '=> ALL SAKUNA TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
