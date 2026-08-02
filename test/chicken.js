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
check(/CHKP\.requestToken\(\)/.test(src), 'the connect asks for a Turnstile token');
check(/return captchaToken \? "cf:" \+ captchaToken : null;/.test(src),
      'and prefixes it "cf:" the way the server expects');
check(/i \+= "\/\?token=" \+ encodeURIComponent\(e\);/.test(src), 'the token is encoded into the URL');

// --------------------------------------------------------------------------
console.log('\n9. the captcha is this script\'s own, not the page\'s');

// The page passes its callback to turnstile.render() *by value*, before this
// script runs, so wrapping window.onGotTurnstileToken afterwards never sees the
// token. And this client removes the page's menu -- and the widget with it.
check(!/Object\.defineProperty\(window, "onGotTurnstileToken"/.test(src),
      "it no longer tries to wrap the page's Turnstile callback");
check(/const SITEKEY = "0x4AAAAAAAMYHI96GFiJzMmp";/.test(src),
      "it carries the game's own Turnstile sitekey");
check(/widgetId = window\.turnstile\.render\(slot, \{/.test(src), 'and renders a widget of its own');
check(/slot\.id = "chkTurnstile";/.test(src) && /document\.body \|\| document\.documentElement/.test(src),
      'into its own panel on the body, which the page teardown cannot take with it');

// the panel is a step of its own, but it closes itself the moment the
// challenge passes -- the way any captcha does
check(/ui\.box\.remove\(\);\n\s*resolve\(token\(\)\);/.test(src),
      'the panel takes itself down as soon as the challenge passes');
check(/render\(ui\.slot, finish\);/.test(src),
      "and the widget's own callback is what closes it, so there is no extra click");
check(!/chkConnect/.test(src), 'no Connect button is left to press');
check(!/waited >= limit/.test(src) && !/timeoutMs/.test(src),
      'nothing times out while the player is solving it');
check(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/.test(src),
      'loading the Turnstile api itself if the page has not');
check(!/position:fixed;bottom:12px;left:12px;z-index:2147483646/.test(src),
      "the page's own widget is no longer re-parented -- that reloaded its iframe,"
      + ' and position:fixed leaves offsetParent null, which is exactly what the'
      + ' page checks before it will render');

// a challenge that wants a click takes longer than the client's own reload timer
check(src.indexOf('clearTimeout(mainMenuManager.connectionTimeout);') > -1
      && src.indexOf('clearTimeout(mainMenuManager.connectionTimeout);') < src.indexOf('await CHKP.requestToken()'),
      "the client's 30s reload is called off while the captcha is being solved");
check(/Verify to play/.test(src), 'and the menu says what it is waiting for');

// the sing-along feature fetches from a host that returns 410; without a catch
// that lands in the console as an unhandled rejection on every load
check(/async fetchSongChats\(\) \{\n[\s\S]{0,400}?try \{/.test(src),
      'the dead song-chat fetch no longer throws an unhandled rejection');

// --------------------------------------------------------------------------
console.log('\n9b. the page teardown');

check(!/document\.getElementById\("menuContainer"\)\.remove\(\)/.test(src),
      '#menuContainer removal is guarded like the rest');

// --------------------------------------------------------------------------
console.log('\n10. the server list cannot hang the loading screen');

check(/await Promise\.race\(\[/.test(src) && /new Promise\(\(done\) => setTimeout\(done, 100\)\),/.test(src),
      'the cross-origin ping is raced against 100ms, the way the live client does it');
check(!/const response = await fetch\(pingUrl\);/.test(src),
      'the unbounded await on the ping fetch is gone');
check(/\/servers\?v=1\.27`/.test(src) && !/\/servers\?v=1\.26`/.test(src),
      'the server-list request asks for the version the live client asks for');
for (const id of ['linksContainer2', 'menuCardHolder', 'gameName', 'loadingText', 'partyButton', 'joinPartyButton', 'settingsButton']) {
  check(!new RegExp('getElementById\\("' + id + '"\\)\\.remove\\(\\)').test(src),
        '#' + id + ' removal is guarded');
}
check(/if \(pageEl\("ageBarContainer"\)\)/.test(src), '#ageBarContainer lookup is guarded');
check(/if \(pageEl\("topInfoHolder"\)\)/.test(src), '#topInfoHolder lookup is guarded');
check(/Object\.defineProperty\(window, "requestAnimFrame"/.test(src),
      "the page's render loop is stopped so it cannot repaint over this client");

// --------------------------------------------------------------------------
console.log('\n11. the menu theme');

check(/window\.CHICKEN_COSMOS = \(function \(\) \{/.test(src), 'the theme module ships with the script');
check(/CHICKEN_COSMOS\.install\(mainMenu\);/.test(src), 'and is installed onto the menu');
check(!/backgroundImage = "url\('https:\/\/wallpapers/.test(src),
      'the remote city photograph the menu used to load is gone');
check(/this\.menuElement\.id = "ckMenu";/.test(src), 'the menu card carries the hook the theme styles');
check(/@keyframes ck-drift/.test(src) && /@keyframes ck-shoot/.test(src)
      && /@keyframes ck-twinkle/.test(src) && /@keyframes ck-float/.test(src),
      'starfield drift, shooting stars, twinkle and the planet are all animated');
check((src.match(/class="ck-stars ck-s\d"/g) || []).length === 3, 'three parallax star layers');
check((src.match(/class="ck-shoot [a-d]"/g) || []).length === 4, 'four shooting stars on staggered delays');
check(/prefers-reduced-motion: reduce/.test(src), 'and it all stops for prefers-reduced-motion');
check(/width: 760px !important;/.test(src) && /height: 380px !important;/.test(src),
      'the card is bigger than the 650x450 it was');

// the tail has to trail behind the head, and the head travels left and down
check(/\.ck-sky-box \.ck-shoot::before \{\n\s*content: ""; position: absolute; top: 50%; left: 2px;/.test(src),
      'the shooting-star tail sits behind the head, not in front of it');
check(/background: linear-gradient\(90deg, rgba\(255,255,255,\.95\)/.test(src),
      'and fades away from the head rather than towards it');
check(!/rotate\(14deg\)/.test(src) && (src.match(/rotate\(-12deg\)/g) || []).length === 2,
      'and the whole thing is rotated along the direction of travel');

// the mod menu gets the same scene
check(/CHICKEN_COSMOS\.dressMenu\(this\.menu\);/.test(src), 'the mod menu is themed too');
check(/#ckScriptMenu > \.ck-menusky \{/.test(src),
      'with its own sky, since the two are separate stacking contexts');
check((src.match(/document\.body\.appendChild\(this\.menu\);/g) || []).length === 1,
      'and it is still only appended once');
check(/width: 920px !important;/.test(src) && /height: 620px !important;/.test(src),
      'the mod menu is bigger than the 700x475 it was');
check(/#ckScriptMenu\[style\*="opacity: 1"\] \{ transform: translate\(-50%, -50%\) scale\(1\)/.test(src),
      'it scales in when opened -- the client toggles inline opacity, so ride that');
check(/#ckScriptMenu div\[id\^="tab:"\]::before \{/.test(src),
      'the tabs get a sliding accent bar');
check(/pointer-events: none"\]::before \{ height: 20px; \}/.test(src),
      "and the open tab is picked out by the flag the client already sets on it");
check(/#ckScriptMenu div\[id\^="toggle:id:"\]\[style\*="background-color: rgb\(33, 150, 243\)"\]/.test(src),
      'the switches light up off the colour the client sets, so no behaviour changes');
check(/@keyframes ck-row \{/.test(src) && /nth-child\(n\+9\)/.test(src),
      'and the rows fade in one after another when a tab opens');
check(/width: 236px !important;/.test(src) && /left: 236px !important;/.test(src),
      'the tab rail is wider, and the settings pane moved with it');
check(/height: 100% !important;/.test(src), 'the rail runs the full height now');
check(!/innerText = "Not connected"/.test(src) && !/this\.menu\.appendChild\(this\.socketPing\)/.test(src),
      'the "Not connected" strip is gone');

// --------------------------------------------------------------------------
console.log('\n12. the bits taken off the menu');

for (const [what, re] of [
  ['the Help button',        /mainMenu\.appendChild\(this\.controlsButton\)/],
  ['the Changelogs button',  /mainMenu\.appendChild\(this\.channelLogButton\)/],
  ['the Discord button',     /mainMenu\.appendChild\(this\.discordButton\)/],
  ['the credits line',       /mainMenu\.appendChild\(this\.createdByElement\)/],
]) check(!re.test(src), what + ' is no longer put on the menu');
check(!/Welcome back, \$\{getSavedVal/.test(src), 'the "Welcome back" line is gone');
check(!/function crate\(\) \{/.test(src) && !/cdn\.jsdelivr\.net\/npm\/chart\.js/.test(src),
      'the ping/FPS graph and the chart.js it pulled off jsDelivr are gone');
// the elements themselves stay: the panel close handlers reference them
check(/this\.discordButton\.style\.display = "block";/.test(src),
      'the objects still exist, so the handlers that touch them keep working');

// --------------------------------------------------------------------------
console.log('\n13. natural colours and no texture pack');

check(!/scriptMenu\.toggles\.hyperPerformance/.test(src),
      'nothing reads the Hyper Performance toggle any more');
check(!/label: "Hyper Performance"/.test(src), 'and the toggle is gone from the menu');
check(/if \(false\) \{                 \/\/ was the flat-yellow ground/.test(src),
      'the flat-yellow ground branch is dead');
check(/let i = false;/.test(src) && /let t = false;/.test(src),
      'the sprite builders take the game\'s own colours');
check(!/var newHatImgs|var newAccImgs|var newWeaponImgs/.test(src),
      'the hat, accessory and weapon overrides are gone');
check(!/i\.imgur\.com\/99Xb4Lm|i\.imgur\.com\/fgFsQJp/.test(src),
      'so are the emerald weapon sprites and the minimap texture');
check(/var emeraldSprites = \{\n\s*"hand axe": true,/.test(src),
      'emeraldSprites survives as a plain name set, which is all updateActionBar needs of it');
check(/if \(t == "acc"\) \{\n\s*return "\.\.\/\.\/img\/accessories/.test(src),
      "getTexturePackImg resolves to the game's own art only");

console.log('\n' + (fails === 0 ? '=> ALL CHICKEN TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);

