// RoBoTic CaraMila v6.9.5 is a hook mod of the usual shape and gets the usual
// EXP shim. What is specific to it: it had no @run-at at all, it carried two
// CDN requires of which one is unused, it still drives the ALTCHA captcha the
// game replaced, and its own "Primary Sync" switch only worked one way.
const fs = require('fs');
const path = require('path');
const extract = require('./extract.js');

const { game, msgpack: vendor } = extract.load();
const { Encoder, Decoder } = vendor;
const { EXP, FakeWebSocket } = extract.loadCaramila();
const enc = new Encoder(), dec = new Decoder();

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'RoBoTic-CaraMila.v6.9.5.js'), 'utf8');
const original = fs.readFileSync(path.join(ROOT, 'reference', 'caramila-original.js'), 'utf8');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

const shimStart = src.indexOf('const EXP = (function() {');
const shimEnd = src.indexOf('\n)();\n', shimStart) + 5;
const modCode = src.slice(0, shimStart) + src.slice(shimEnd);

// --------------------------------------------------------------------------
console.log('\n1. metadata');

const meta = src.slice(0, src.indexOf('// ==/UserScript=='));
check(/^\/\/ @run-at\s+document-start$/m.test(meta),
      'it runs at document-start; the original had no @run-at at all, so it ran '
      + 'after the bundle had already taken WebSocket.prototype.send');
check(!/@require/.test(meta), 'both CDN requires are gone');
check(/three\.min\.js/.test(original) && !/THREE\./.test(original),
      'and one of them was three.js, which the original never used once');
check(meta.split('\n').every(l => l === '' || l.startsWith('//')),
      'the metadata block is still all comments');

// --------------------------------------------------------------------------
console.log('\n2. the shim, and when things run');

{
  const { stripComments } = require('../tools/strip-comments.js');
  const mine = extract.shimOf('RoBoTic-CaraMila.v6.9.5.js');
  const ref = stripComments(extract.shimOf('ExternalClient.user.js'), { metadata: false }).out;
  check(mine === ref, 'the bundled shim is the same code every other hook mod carries');
}
const bootAt = src.indexOf('function __carBoot() {');
check(bootAt > 0 && shimStart < bootAt,
      'the body is deferred and the shim is outside it, so the shim is early and the body is not');
check(src.indexOf('document.body.appendChild(menuDiv)') > bootAt,
      'the DOM work waits, since at document-start there is no body to append to');
{
  const starter = src.slice(src.indexOf('(function __carStart(tries)'));
  check(/document\.readyState === "loading"/.test(starter) && /getElementById\("gameUI"\)/.test(starter),
        'and waits for both the document and gameUI');
  check(/tries < 400/.test(starter), 'with a bounded poll');
}

// --------------------------------------------------------------------------
console.log('\n3. the transport');

check(!/msgpack\./.test(modCode), 'nothing in the mod encodes or decodes for itself');
check(!/\.nsend\(/.test(modCode), 'and nothing calls nsend');
check(!/WebSocket\.prototype\.send\s*=/.test(modCode), 'the shim owns prototype.send');
check(/EXP\.setHandler\(function \(message\) \{/.test(src), 'outgoing goes through the handler');
check(/if \(this\.isModSocket\) return EXP\.nativeSend\.call\(this, message\);/.test(src),
      "the mod's own server sockets are still let through untouched -- their traffic is JSON");
check(/if \(WS != this\) return EXP\.nativeSend\.call\(this, message\);/.test(src),
      'as is the second one, which never marks itself');
check(/sendFiltered\(this, unframed\.type, unframed\.args\);/.test(src),
      "and game packets reach the mod's own filters by name");
check(/if \(!dontSend\) \{\s*EXP\.send\(sock, type, data\);/.test(src), 'the send is framed by the shim');
check(/let parsed = EXP\.receive\(message\.target \|\| WS, message\.data\);/.test(src),
      'incoming comes back through the shim');
check(/if \(type == "io-init"\)/.test(src),
      'and io-init still arrives by name, so socketID keeps working');

// --------------------------------------------------------------------------
console.log('\n4. the page, and the captcha the game replaced');

check(/const GONE_IDS = \[/.test(src), 'getEl hands back a hidden stub for ids moomoo deleted');
check(/if \(GONE_IDS\.indexOf\(id\) === -1\) return el;/.test(src),
      'and null for every other id, so feature tests still tell the truth');
check(/"adCard", "ad-container", "wideAdCard"/.test(src), 'the ad elements this mod reaches for are on the list');
check(!/"altcha"/.test(src.slice(src.indexOf('const GONE_IDS'), src.indexOf('const goneStubs'))),
      'altcha deliberately is not, so its polling loop can retire instead of clicking a stub forever');
check(/if \(altcha\) altcha\.style\.display = 'none';/.test(src),
      'the ALTCHA teardown is guarded; moomoo moved to Turnstile and getEl("altcha") is null');
check(/if \(!altcha \|\| !altchaButton\) return clearInterval\(annoyingAltchaStuff\);/.test(src),
      'and the once-a-second poll stops itself');

// --------------------------------------------------------------------------
console.log('\n5. the verification box had nowhere to appear');

// The mod builds its own inputCard and hides the game's setupCard. The
// Turnstile widget lives inside setupCard, and the game refuses to render into
// something that is not laid out:
//     if (!e || e.offsetParent === null) return !1;
// So no checkbox, no token, and Play stays "disabled" for ever -- the game only
// clears that class from onGotTurnstileToken.
check(!/turnstileWidget/.test(original),
      'the original never mentioned the widget at all, which is why it stayed buried');
check(/const widget = getEl\("turnstileWidget"\);/.test(src),
      'the build now takes hold of it');
{
  const move = src.slice(src.indexOf('const widget = getEl("turnstileWidget")'));
  const block = move.slice(0, 1400);
  check(/holder\.appendChild\(widget\);/.test(block) && /inputCard\.appendChild\(holder\);/.test(block),
        'and moves it into the card the mod actually shows');
  check(block.indexOf('inputCard.appendChild(holder)') < block.indexOf('inputCard.appendChild(divider)') ||
        src.indexOf('inputCard.appendChild(holder)') < src.indexOf('inputCard.appendChild(divider)'),
        'directly under the name-and-Play row, above the divider, since Play is what it gates');
  check(/widget\.style\.display = "";/.test(block),
        'clearing any inline display:none it inherited');
  check(/sitekey: "0x4AAAAAAAMYHI96GFiJzMmp"/.test(block),
        "the fallback render uses the game's own production sitekey");
  check(/callback: window\.onGotTurnstileToken/.test(block),
        "and the game's own callback, so Play is what gets re-enabled");
  check(/if \(widget\.childElementCount > 0 \|\| \+\+tries > 60\) return clearInterval\(settle\);/.test(block),
        'the fallback stands down the moment anything has rendered, so the two cannot both render');
  check(/if \(tries < 12\) return;/.test(block),
        "and waits three seconds first, because the game's own poll should win");
}
check(src.indexOf('getEl("turnstileWidget")') < src.indexOf("setupCard.style.display = 'none'"),
      'the move happens before setupCard is hidden, inside the window the game polls in');

// --------------------------------------------------------------------------
console.log('\n6. the server browser came up empty');

// getServers() has no catch anywhere above it, so anything that goes wrong in
// there leaves the panel silently blank -- which is what it did.
check(/servers\?v=1\.26/.test(original) && !/servers\?v=1\.27/.test(original),
      'the original pinned v=1.26 on sandbox and sent no version at all on production; '
      + 'the game asks for ?v=1.27');
check(/"1\.27", ""/.test(src),
      'it now asks for exactly what the game asks for, then falls back to the bare URL');
{
  const g = src.slice(src.indexOf('async function getServers()'));
  const block = g.slice(0, 1600);
  check(/if \(!response\.ok\) continue;/.test(block),
        'a refused response moves on to the next shape rather than being parsed');
  check(/if \(Array\.isArray\(data\) && data\.length\)/.test(block),
        'and a response that is not a non-empty array does not count as success');
  check(/return \[\];/.test(block) && /console\.error\("\[caramila\]/.test(block),
        'when nothing works it returns an empty list and says so, instead of throwing '
        + 'into a panel that just stays blank');
  check(/if \(server\.port\) pingHost \+= ":" \+ server\.port;/.test(block),
        'the ping URL carries the port, the way the game builds it');
  check(!/moomoo\.io\/ping\/`/.test(block), 'and has lost the trailing slash it had');
}
check(/\$\{server\.key\}\.\$\{server\.region\}\.moomoo\.io\/ping\/`/.test(original),
      'which the original did not: no port, trailing slash');

// --------------------------------------------------------------------------
console.log('\n7. the thing that was eating the frame rate');

// shadowBlur is a Gaussian pass over everything drawn under it; canvas filter
// is worse, dropping the 2D context onto a path that allocates an offscreen
// surface, rasterises, filters and composites. The original ran both around
// every player draw with no switch at all. tools/glow-bench.js measures it at
// roughly 8x the cost of the same draw without them.
{
  const ungated = [];
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    if (!/filter = "brightness/.test(l)) return;
    // walk back for the nearest gate
    let gate = null;
    for (let j = i; j > i - 40 && j >= 0; j--) {
      const t = lines[j].trim();
      if (/^if \(.*(glow|Ghost)/.test(t)) { gate = t; break; }
    }
    if (!gate) ungated.push(i + 1);
  });
  check(ungated.length === 0,
        'every canvas filter around a player draw is behind a switch' +
        (ungated.length ? ' (ungated at line ' + ungated.join(', ') + ')' : ''));
}
check(/dc\.BoxF\("Player Glow"/.test(src), 'and there is a Player Glow switch in the Visuals tab');
check(/costs a lot of FPS/.test(src), 'whose description says what it costs');
check((src.match(/isC\("playerGlow"\)\.checked/g) || []).length === 3,
      'all three player-draw sites read it');
check(!/playerGlow/.test(original), 'none of which the original had');
check(!/playerGlow:/.test(src),
      'it is deliberately absent from the configs defaults, so BoxF starts it at '
      + 'localStorage false -- off unless you turn it on, which is the right way '
      + 'round for something that only changes how things look');
// the ghost overlay does the same thing but was already opt-in; left alone
check(/if \(isC\("Ghost"\)\.checked && playerGhost\.active/.test(src),
      "the ghost overlay's own glow is untouched, since it was already behind a toggle");

// --------------------------------------------------------------------------
console.log('\n8. Primary Sync now works in both directions');

// The mod streams name, sid, server, ping and live x2/y2 to a server of its
// own. That is its advertised feature, not something smuggled in -- but the
// switch for it only governed what came back.
check(/dc\.BoxF\("Primary Sync"/.test(src), 'the setting exists in the menu, as it always did');
check(/function sendPlayerInfo\(\) \{\s*if \(!configs\.serverSync\) return;/.test(src),
      'and nothing goes out when it is off');
check(/if \(!configs\.serverSync\) return;[\s\S]{0,200}socket\.readyState === WebSocket\.OPEN/.test(src),
      'the check is before the socket test, so off also means it stops dialling out');
check(!/if \(!configs\.serverSync\) return;/.test(original),
      'which the original did not do: it reported the setting inside the payload and sent anyway');

// --------------------------------------------------------------------------
console.log('\n9. the wire, against the game bundle\'s own crypto');

const SEED = 0x1234BEEF, KEY_HEX = 'ff00aa5511bb66cc22dd77ee33990088';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const sock = new FakeWebSocket('wss://x.moomoo.io');
sock.readyState = 1;
EXP._internals.states.set(sock, { mode: 1, key, tables: game.Po(SEED), seq: 0 });

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
  check(f.name === 'M' && f.seq === 1, 'as the right opcode, with the first sequence number');
}
{
  const names = [...new Set(
    [...src.matchAll(/(?:packet|io\.send)\(\s*"([^"]+)"/g)].map(m => m[1])
  )];
  const bad = names.filter(n => tables.c2s.enc[n] === undefined);
  check(names.length >= 8, 'the mod sends a real vocabulary (' + names.length + ' names)');
  check(bad.length === 0, 'and every one resolves to an opcode' + (bad.length ? ' (bad: ' + bad.join(', ') + ')' : ''));
}
{
  const framed = enc.encode([tables.s2c.enc['O'], [5, 90]]);
  const got = EXP.receive(sock, framed);
  check(got && got.type === 'O' && JSON.stringify(got.args) === '[5,90]',
        'and an incoming opcode comes back as the name its events table is keyed by');
  check(/O: updateHealth/.test(src), 'which is how that table is written');
}

console.log('\n' + (fails === 0 ? '=> ALL CARAMILA TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
