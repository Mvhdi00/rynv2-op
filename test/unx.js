// unX (the script formerly called chicken) is a full client replacement with
// its own `io` object and its own
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
const src = fs.readFileSync(path.join(ROOT, 'UnX.user.js'), 'utf8');

let fails = 0;
// checks that can only settle on a timer; awaited before the summary is printed
const pending = [];
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
// scoped to requestToken: the bot-token path below it is headless and does need
// a timeout, but the panel a human is looking at must never give up on them
{
  const panel = src.slice(src.indexOf('function requestToken()'), src.indexOf('let botSlot = null;'));
  check(!/waited/.test(panel) && !/timeoutMs/.test(panel),
        'nothing times out while the player is solving it');
}
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
// the mod menu is left at the client's own look
check(!/dressMenu/.test(src) && !/ckScriptMenu/.test(src),
      'the mod menu carries no theming of ours at all');

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
check(/if \(false\) \{\n\s*mainContext\.fillStyle = "#ffff00";/.test(src),
      'the flat-yellow ground branch is dead');
check(/let i = false;/.test(src) && /let t = false;/.test(src),
      'the sprite builders take the game\'s own colours');
check(!/var newHatImgs|var newAccImgs|var newWeaponImgs/.test(src),
      'the hat, accessory and weapon overrides are gone');
check(!/i\.imgur\.com\/99Xb4Lm/.test(src), 'so are the emerald weapon sprites');
check(/mapDisplay\.style\.backgroundImage = "url\('https:\/\/i\.imgur\.com\/fgFsQJp\.png'\)";/.test(src),
      'but the minimap texture is kept, as asked');
check(/var emeraldSprites = \{\n\s*"hand axe": true,/.test(src),
      'emeraldSprites survives as a plain name set, which is all updateActionBar needs of it');
check(/if \(t == "acc"\) \{\n\s*return "\.\.\/\.\/img\/accessories/.test(src),
      "getTexturePackImg resolves to the game's own art only");

// --------------------------------------------------------------------------
console.log('\n14. the rename');

const meta = src.slice(0, src.indexOf('// ==/UserScript=='));
check(/^\/\/ @name\s+unX$/m.test(meta), 'the script is called unX');
check(!/>Chicken V4\.6\.2</.test(src), 'the old name is off the main menu');
check(/>unX<\/span>/.test(src), 'and the new one is on it');
check(/transform: translateX\(-50%\);">unX<\/div>/.test(src), 'and on the mod menu');

// --------------------------------------------------------------------------
console.log('\n15. the bots run here now, not on a dead relay');

{
  const B = extract.loadUnxBots();

  // a relay that records what the bot layer reports back to botManager
  function makeRelay() {
    const manager = { botSids: [] };
    const relay = new B.LocalRelay('slot', manager);
    relay.events = [];
    relay.onmessage = m => relay.events.push(JSON.parse(m.data));
    return relay;
  }

  // stands a bot up through a real io-init handshake and returns it
  function makeBot(relay, slot) {
    const bot = new B.BotSocket(relay || makeRelay(), slot || 0);
    bot.connect('wss://test.moomoo.io', 'cf:tok', 'unX');
    bot.ws.deliver(enc.encode(['io-init', [3, SEED, KEY_HEX, 1]]));
    return bot;
  }

  const SEED = 0x5EED1234;
  const KEY_HEX = '00112233445566778899aabbccddeeff';
  const key = Buffer.from(KEY_HEX, 'hex');
  const tables = game.Po(SEED);

  // decodes one frame the bot sent, checking the tag the way the server would
  function readFrame(buf) {
    const payload = buf.subarray(game.jt);
    const want = Buffer.from(crypto.createHmac('sha256', key).update(payload).digest()).subarray(0, game.jt);
    const body = dec.decode(payload);
    return { tagOk: Buffer.compare(want, buf.subarray(0, game.jt)) === 0, name: tables.c2s.dec[body[0]], args: body[1], seq: body[2] };
  }
  const sentNames = bot => bot.ws.sent.map(b => readFrame(b).name);

  const relay0 = makeRelay();
  const bot = makeBot(relay0);

  check(bot.ready === true, 'the bot builds its protocol state from its own io-init');
  check(bot.proto.seq === 1 && bot.ws.sent.length === 1,
        'and sends exactly one packet once the handshake lands');

  const spawn = readFrame(bot.ws.sent[0]);
  check(spawn.tagOk, 'the spawn frame carries a tag the server will accept');
  check(spawn.name === 'M', 'and it is the spawn packet');
  check(spawn.args[0] && typeof spawn.args[0].name === 'string',
        'with a name, the way the client spawns');
  check(spawn.seq === 1, 'the bot starts its own sequence at 1, not the main socket\'s');

  // two bots must not share key material or sequence numbers
  const other = makeBot(makeRelay());
  other.ws.deliver(enc.encode(['io-init', [4, SEED ^ 0xff, KEY_HEX, 1]]));
  check(other.proto.tables.c2s.enc.M !== bot.proto.tables.c2s.enc.M,
        'a second bot with a different seed gets a different opcode table');

  bot.ws.sent.length = 0;
  bot.ws.deliver(enc.encode([tables.s2c.enc.C, [42]]));
  check(bot.sid === 42 && bot.spawned === true, 'setupGame marks the bot spawned and records its sid');
  check(relay0.events.some(e => e.type === 'botSid' && e.sid === 42),
        'and the sid is reported up so the client knows this player is ours');

  bot.ws.deliver(enc.encode([tables.s2c.enc.a, [[42, 100, 200, 0.5, 0, 0, 0, null, 0, 0, 0, 0, 0,
                                                 99, 400, 200, 0, 0, 0, 0, null, 0, 0, 0, 0, 0]]]));
  check(bot.x === 100 && bot.y === 200, 'the bot tracks its own position from the 13-field stride');
  check(bot.players.length === 2, 'and sees the other player in the same update');

  // --- targeting ---
  const msg = {
    ownerPos: { x: 100, y: 260, buildings: [], cursorLocation: { x: 0, y: 0 } },
    ownerTeam: null, botModule: 0, botMovement: 'normal', targetType: 'bot',
    circleRad: 300, playerDist: 200, breakingRad: 900, primaryWeaponSelector: 0,
    targetSids: [], botNames: '', autoplace: false, killOnSight: true, fixedCircles: [],
  };
  check(bot.pickTarget(msg).sid === 99, 'with kill-on-sight the bot picks the nearest enemy');

  relay0.manager.botSids = [99];
  check(bot.pickTarget(msg) === null, 'but never one of our own bots');
  relay0.manager.botSids = [];

  relay0.ownerSid = 99;
  check(bot.pickTarget(msg) === null, 'and never its owner');
  relay0.ownerSid = null;

  bot.players[1].team = 'AAA';
  check(bot.pickTarget(Object.assign({}, msg, { ownerTeam: 'AAA' })) === null,
        'and never a player on the owner\'s team');
  bot.players[1].team = null;

  check(bot.pickTarget(Object.assign({}, msg, { killOnSight: false })) === null,
        'with kill-on-sight off and no target list it attacks nobody');
  check(bot.pickTarget(Object.assign({}, msg, { killOnSight: false, targetSids: [99] })).sid === 99,
        'but an explicit target sid still gets attacked');

  // --- one AI tick ---
  bot.ws.sent.length = 0;
  bot.tick(msg);
  const names = sentNames(bot);
  check(names.includes('D'), 'a tick aims at the target');
  check(names.includes('F'), 'and swings at it');
  check(bot.ws.sent.every(b => readFrame(b).tagOk), 'every packet a tick sends is correctly tagged');

  bot.ws.sent.length = 0;
  bot.tick(msg);
  check(!sentNames(bot).includes('F'), 'the attack is not re-sent while it is already swinging');

  // movement: inside playerDist the bot holds still, outside it walks in
  bot.ws.sent.length = 0;
  bot.lastMoveDir = 12345;
  bot.tick(Object.assign({}, msg, { ownerPos: { x: 100, y: 210, buildings: [] } }));
  const held = bot.ws.sent.map(readFrame).find(f => f.name === '9');
  check(held && held.args[0] == null, 'inside Player Distance it stops moving');

  bot.ws.sent.length = 0;
  bot.lastMoveDir = 12345;
  bot.tick(Object.assign({}, msg, { ownerPos: { x: 100, y: 900, buildings: [] } }));
  const walk = bot.ws.sent.map(readFrame).find(f => f.name === '9');
  check(walk && typeof walk.args[0] === 'number', 'outside it, it walks towards the owner');

  bot.ws.sent.length = 0;
  bot.lastMoveDir = 12345;
  bot.tick(Object.assign({}, msg, { botMovement: 'stop' }));
  const stopped = bot.ws.sent.map(readFrame).find(f => f.name === '9');
  check(stopped && stopped.args[0] == null, '"Stop Moving" really does stop it');

  bot.ws.sent.length = 0;
  bot.lastMoveDir = 12345;
  bot.tick(Object.assign({}, msg, { botMovement: 'circle', fixedCircles: [0, 1.5, 3, 4.5] }));
  check(bot.ws.sent.map(readFrame).some(f => f.name === '9' && typeof f.args[0] === 'number'),
        '"Circle Player" steers onto the ring the client hands it');

  // autoplace uses the client's own three-packet placement sequence
  bot.ws.sent.length = 0;
  bot.lastPlace = 0;
  bot.itemIds = [15];
  bot.tick(Object.assign({}, msg, { autoplace: true }));
  const seq = sentNames(bot).join(',');
  check(/z,F,z/.test(seq), 'auto-place sends select-item, swing, re-select-weapon like the client does');

  // death and respawn
  bot.ws.sent.length = 0;
  bot.ws.deliver(enc.encode([tables.s2c.enc.P, []]));
  check(bot.dead === true && bot.spawned === false, 'the bot notices it died');
  check(relay0.events.some(e => e.type === 'botSidRemove'), 'and takes its sid back out of the list');
  bot.spawnedAt = Date.now() - 5000;
  bot.tick(msg);
  check(sentNames(bot).includes('M'), 'and respawns on the next tick');

  // --- the relay speaks the protocol botManager already sends ---
  const relay = makeRelay();
  check(relay.readyState === 1 || relay.readyState === 0, 'the relay stands in for the glitch socket');
  relay.send(JSON.stringify({ type: 'add', ip: 'wss://test.moomoo.io', tokens: ['cf:a', 'cf:b'] }));
  check(relay.sockets.length === 2, 'an "add" with two tokens opens two real connections');
  check(relay.sockets[0].ws.url.includes('token=cf%3Aa'),
        'each bot connects with its own token in the query string');
  check(relay.sockets[0].ws.url !== relay.sockets[1].ws.url,
        'and no two bots are handed the same one');
  relay.send(JSON.stringify({ type: 'remove', amount: 1 }));
  check(relay.sockets.length === 1, 'a "remove" drops one');
  relay.send(JSON.stringify({ type: 'remove', amount: 1 }));
  check(relay.readyState === 3, 'and the relay closes once its last bot is gone');

  check(/CHKP\.freshToken\(\)/.test(src) && !/altKeyManager\.getToken\(\)/.test(src),
        'tokens come from Turnstile now, not the dropped ALTCHA solver');
  check(!/wss:\/\/\$\{o\.link\}\.glitch\.me/.test(src) && /new LocalRelay\(o\.link, this\)/.test(src),
        'addBots opens a local relay instead of a dead glitch.me project');
  check(!/glitch\.me\/dc\?auth=/.test(src),
        'and "!c!dc bots" drops our own bots instead of asking nine dead hosts to');

  // The bot captcha has to be on screen: Turnstile in managed mode decides per
  // request whether to show a checkbox, and nobody can tick one parked at
  // left:-10000px. That is why no bot ever connected.
  check(!/left:-10000px/.test(src), 'the bot captcha is no longer hidden off-screen');
  check(/box\.id = "chkBotCaptcha"/.test(src) || /botBox\.id = "chkBotCaptcha"/.test(src),
        'it has a panel of its own');
  check(/position:fixed[\s\S]{0,200}chkBotCaptcha|chkBotCaptcha[\s\S]{0,400}position:fixed/.test(src),
        'centred and above the page');
  check(/botSlot\.style\.cssText = "display:flex/.test(src),
        'with the widget slot in normal flow, so its offsetParent is never null');
  check(/window\.turnstile\.render\(botSlot,/.test(src), 'and the widget renders into that slot');
  check(/awaitBotToken\(120000\)/.test(src),
        'the wait is long enough for a person to notice the panel and tick a box');
  check(/botCancelled = true/.test(src), 'and there is a way out if you change your mind');
  check(/bot\(s\) got no captcha token and were not connected/.test(src),
        'a bot that got no token is reported instead of vanishing silently');

  // ------------------------------------------------------------------------
  console.log('\n15b. the kill chat is two editable lines, not one fixed one');

  check(!/autoGG Master Race/.test(src), 'the hardcoded "gg - autoGG Master Race" line is gone');
  check(/id: "killChatMessage"/.test(src) && /id: "killCountMessage"/.test(src),
        'both lines are text fields in the mod menu');
  check(/value: "gg \{name\}"/.test(src) && /value: "\{kills\} idiots down"/.test(src),
        'with sensible defaults you can overwrite');

  B.setKills(7);
  B.setLastKill('noob', Date.now());
  check(B.formatKillChat('gg {name}', 'noob') === 'gg noob', '{name} is the player you just killed');
  check(B.formatKillChat('{kills} idiots down', 'noob') === '7 idiots down', '{kills} is your running total');
  check(B.formatKillChat('{KILLS} down {Name}', 'noob') === '7 down noob', 'the placeholders are case-insensitive');
  check(B.formatKillChat('x'.repeat(60), '').length === 30, 'and the result is trimmed to the 30 the game allows');
  check(B.formatKillChat('', 'noob') === '' && B.formatKillChat(null, 'noob') === '',
        'an empty template sends nothing at all, so either line can be switched off');

  B.sentChats.length = 0;
  B.sendKillChat();
  check(B.sentChats.length === 1 && B.sentChats[0] === 'gg noob',
        'a kill sends the kill line straight away');

  // the count line is deliberately delayed: the server rate-limits chat
  pending.push(new Promise(r => setTimeout(r, 1100)).then(() => {
    check(B.sentChats.length === 2 && B.sentChats[1] === '7 idiots down',
          'and the count line a beat later, so the server does not drop it');
  }));

  B.setLastKill('stale', Date.now() - 5000);
  check(B.formatKillChat('gg {name}', '') === 'gg', 'a name older than a second is not reused on the next kill');

  const relay2 = makeRelay();
  relay2.send(JSON.stringify({ type: 'add', ip: 'wss://test.moomoo.io', tokens: ['cf:z'] }));
  relay2.sockets[0].ws.deliver(enc.encode(['io-init', [9, SEED, KEY_HEX, 1]]));
  relay2.sockets[0].ws.deliver(enc.encode([tables.s2c.enc.C, [55]]));
  relay2.sockets[0].ws.sent.length = 0;
  relay2.send(JSON.stringify({ type: 'killChat', name: 'noob' }));
  const botChat = relay2.sockets[0].ws.sent.map(readFrame).find(f => f.name === '6');
  check(botChat && botChat.args[0] === 'gg noob',
        'the bots chat the same kill line, which they never did before');

  B.scriptMenu.toggles.killChatMessage = '';
  relay2.sockets[0].ws.sent.length = 0;
  relay2.send(JSON.stringify({ type: 'killChat', name: 'noob' }));
  check(!relay2.sockets[0].ws.sent.length, 'and stay quiet when you blank the line');
  B.scriptMenu.toggles.killChatMessage = 'gg {name}';

}

// --------------------------------------------------------------------------
console.log('\n15c. auto grind behaves like the RYN client\'s module');

{
  const G = extract.loadUnxGrind();
  const { unxGrind: grind, owner, calls } = G;

  // great hammer (10) as secondary, polearm (5) as primary
  G.setWeapons([
    { dmg: 25, sDmg: 3.3, range: 70 }, {}, {}, {}, {}, { dmg: 55, sDmg: 3.3, range: 110 },
    {}, {}, { dmg: 1, sDmg: 1 }, {}, { dmg: 40, sDmg: 7.5, range: 110 },
  ]);
  const mkPlayer = xp => ({
    sid: 1, x: 0, y: 0, points: 10000, weaponIndex: 5,
    weapons: [5, 10], items: [0, 0, 0, 0, 0, 17], skins: {}, weaponXP: xp,
  });
  const turret = (x, y, health) => ({ active: true, name: 'turret', x, y, health, owner: { sid: 1 } });

  G.setPlayer(mkPlayer([]));
  check(grind.variantOf(5) === 0, 'no XP is variant 0');
  G.setPlayer(mkPlayer({ 5: 3000 }));
  check(grind.variantOf(5) === 1, '3000 XP is variant 1');
  G.setPlayer(mkPlayer({ 5: 12000 }));
  check(grind.variantOf(5) === 3, '12000 XP is ruby');

  // --- the stop condition, which the old one never had ---
  G.setPlayer(mkPlayer({ 5: 12000, 10: 12000 }));
  check(grind.isFullyUpgraded() === true, 'both weapons at ruby counts as done');
  calls.length = 0;
  check(grind.tick(owner) === false, 'and grinding stops rather than carrying on for XP that cannot be earned');
  check(G.scriptMenu.toggles.autoGrind === false, 'the toggle turns itself off');
  check(calls.length === 0, 'nothing is placed or swung after that');
  G.scriptMenu.toggles.autoGrind = true;

  G.setPlayer(mkPlayer({ 5: 12000, 10: 0 }));
  check(grind.isFullyUpgraded() === false, 'a primary at ruby alone is not done -- the hammer still needs XP');

  // --- placement: two turrets either side of the aim, not four on a compass ---
  G.setPlayer(mkPlayer({ 5: 0, 10: 0 }));
  G.setObjects([]);
  G.setSandbox(false);
  owner.aim = 0;
  calls.length = 0;
  check(grind.tick(owner) === true, 'with no turret of ours in range it lays some down');
  const placed = calls.filter(c => c[0] === 'place');
  check(placed.length === 2, 'two of them, not the four the old code placed');
  check(placed.every(c => c[1] === 17), 'and they are the turret from the item slot');
  const spread = Math.PI / 180 * 40;
  check(Math.abs(placed[0][2] - -spread) < 1e-9 && Math.abs(placed[1][2] - spread) < 1e-9,
        'at 40 degrees either side of where we are already aiming');

  G.setSandbox(true);
  calls.length = 0;
  grind.tick(owner);
  check(calls.filter(c => c[0] === 'place').length === 3, 'sandbox gets three, at the wider spread');
  G.setSandbox(false);

  // --- aiming at the turrets, not the cursor ---
  G.setObjects([turret(100, 0, 800), turret(0, 100, 800)]);
  calls.length = 0;
  grind.tick(owner);
  check(Math.abs(grind.angle - Math.PI / 4) < 1e-9,
        'with turrets down it aims at their centre, which the old code never did');

  // --- weapon and hat choice ---
  G.setPlayer(mkPlayer({ 5: 0, 10: 0 }));
  G.setObjects([turret(100, 0, 800)]);
  let act = grind.action({ health: 800 });
  check(act.weapon === 1, 'the great hammer is levelled first');
  check(act.hat === 40, 'wearing the tank hat while the turret can take it');

  // While the hammer still needs XP the health of the turret does not enter
  // into it -- RYN returns the hammer and the tank hat straight away.
  act = grind.action({ health: 1 });
  check(act.weapon === 1 && act.hat === 40,
        'and it does so even on an almost-dead turret, exactly as RYN does');

  // Once the hammer is ruby the primary is the one earning XP, and now the
  // turret's health decides what actually gets swung.
  G.setPlayer(mkPlayer({ 5: 0, 10: 12000 }));
  const primaryDmg = grind.buildingDamage(5, true);
  const secondaryDmg = grind.buildingDamage(10, true);

  act = grind.action({ health: primaryDmg + secondaryDmg + 100 });
  check(act.weapon === 1 && act.hat === 40,
        'a turret too healthy for both weapons together is softened with the hammer and the tank hat');

  act = grind.action({ health: primaryDmg + 1 });
  check(act.weapon === 1 && act.hat === 0,
        'a turret it would overkill loses the tank hat -- this is what stops it destroying its own turrets');

  act = grind.action({ health: primaryDmg - 1 });
  check(act.weapon === 0 && act.hat === 40,
        'and only once the turret is inside one primary hit does the primary swing');

  G.setPlayer(mkPlayer({ 5: 12000, 10: 12000 }));
  check(grind.action({ health: 800 }) === null, 'with nothing left to level it asks for no swing at all');

  // --- safety: an enemy on top of you ---
  // back to a player with XP still to earn; the action() checks above left it
  // fully upgraded, which would just switch the module off
  G.setPlayer(mkPlayer({ 5: 0, 10: 0 }));
  G.scriptMenu.toggles.autoGrind = true;
  G.setObjects([turret(100, 0, 800)]);
  G.setEnemy({ x: 50, y: 0 });
  calls.length = 0;
  check(grind.tick(owner) === false, 'it will not grind with an enemy in range');
  check(calls.length === 0, 'and does nothing at all in that case');
  G.setEnemy({ x: 5000, y: 5000 });
  check(grind.tick(owner) === true, 'a distant enemy is fine');

  // --- reload gate ---
  G.setReloaded(0.5);
  calls.length = 0;
  grind.tick(owner);
  check(!calls.some(c => c[0] === 'hit'), 'it does not swing while the weapon is still reloading');
  G.setReloaded(1);
  calls.length = 0;
  grind.tick(owner);
  check(calls.some(c => c[0] === 'hit'), 'and does once it is ready');

  // --- no turret in the item slot ---
  const noTurret = mkPlayer({ 5: 0, 10: 0 });
  noTurret.items[5] = 0;
  G.setPlayer(noTurret);
  check(grind.tick(owner) === false, 'without a turret in the build slot it does nothing');

  // --- and the shape of it in the shipped file ---
  check(!/for \(let m = 0; m < 4; m\+\+\) \{\n\s*placer\.regCheckPlace/.test(src),
        'the four fixed compass angles are gone from the script');
  check(/unxGrind\.tick\(this\)/.test(src), 'the action loop calls the ported module');
  check(/typeof unxGrind\.angle == "number"/.test(src),
        'and getAttackDir prefers its angle over the cursor');
}

// --------------------------------------------------------------------------
console.log('\n16. the file carries no comments but its metadata block');

{
  const acorn = require('acorn');
  const found = [];
  acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true, onComment: found });
  const metaEnd = src.indexOf('\n', src.indexOf('// ==/UserScript==')) + 1;
  const stray = found.filter(cm => cm.start >= metaEnd);
  check(stray.length === 0,
        'no comment survives past the metadata block' +
        (stray.length ? ' (first at offset ' + stray[0].start + ')' : ''));
  check(found.length > 0 && found.every(cm => cm.start < metaEnd),
        'the metadata block itself is still there, comments and all');
  check(/^\/\/ ==UserScript==/.test(src), 'and it is still the first thing in the file');
  check(src.split('\n').length < 15000,
        'the file is ' + src.split('\n').length + ' lines, down from the 35140 it shipped as');
}

Promise.all(pending).then(() => {
  console.log('\n' + (fails === 0 ? '=> ALL UNX TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
  process.exit(fails ? 1 : 0);
});

