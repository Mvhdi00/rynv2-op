// Regression tests for the Novastorm bot engine.
//
//   node tools/test-novastorm-bots.js [path/to/novastorm_1.5.user.js]
//
// The RynBots block is evaluated out of the shipped userscript with stubs
// standing in for the game module scope it normally lives in, so the packets
// the engine would put on a bot socket can be inspected directly.
const fs = require('fs');

const sent = [];   // every packet the engine puts on a bot socket

const EXP = {
    _internals: { MODE_SECURE: 1, states: new Map(), hexToBytes: () => new Uint8Array(), buildTables: () => ({}) },
    send(sock, type, args) { sent.push({ sock: sock.tag, type, args }); return true; },
    receive() { return null; }
};

// items table, trimmed to what the engine reads
const items = {
    weapons: [
        { id: 0, dmg: 25, speed: 300, range: 65 },
        { id: 1, dmg: 30, speed: 400, range: 70 },
        { id: 2, dmg: 35, speed: 400, range: 75 },
        { id: 3, dmg: 35, speed: 300, range: 110 },
        { id: 4, dmg: 40, speed: 300, range: 118 },
        { id: 5, dmg: 45, speed: 700, range: 142 },
        { id: 6, dmg: 20, speed: 300, range: 110 },
        { id: 7, dmg: 20, speed: 100, range: 65 },
        { id: 8, dmg: 1, speed: 400, range: 70 },
        { id: 9, speed: 600, projectile: 0, range: 70 },
        { id: 10, dmg: 10, sDmg: 7.5, speed: 400, range: 75 },
        { id: 11, speed: 0, range: 75 },
        { id: 12, speed: 700, projectile: 2 },
        { id: 13, speed: 230, projectile: 3 },
        { id: 14, dmg: 0, speed: 700, range: 125 },
        { id: 15, speed: 1500, projectile: 5 }
    ],
    list: []
};
const ITEM_DEFS = [
    ['apple', 20, { heal: 20 }], ['cookie', 22, { heal: 40 }], ['cheese', 27, { heal: 30 }],
    ['wood wall', 27], ['stone wall', 50], ['castle wall', 50],
    ['spikes', 52, { dmg: 20 }], ['greater spikes', 49, { dmg: 35 }],
    ['poison spikes', 52, { dmg: 30 }], ['spinning spikes', 52, { dmg: 45 }],
    ['windmill', 45], ['faster windmill', 47], ['power mill', 47],
    ['mine', 65], ['sapling', 110],
    ['pit trap', 50, { trap: true }], ['boost pad', 45, { ignoreCollision: true }],
    ['turret', 43], ['platform', 43, { ignoreCollision: true }],
    ['healing pad', 45, { ignoreCollision: true }], ['spawn pad', 45, { ignoreCollision: true }],
    ['blocker', 45], ['teleporter', 45, { ignoreCollision: true }]
];
ITEM_DEFS.forEach(([name, scale, extra]) => items.list.push(Object.assign({ name, scale }, extra || {})));

const config = { mapScale: 14400 };
const UTILS = {
    getDistance(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    getDirection(x1, y1, x2, y2) { return Math.atan2(y1 - y2, x1 - x2); },
    fixTo(n, d) { return parseFloat(n.toFixed(d)); },
    getAngleDist(a, b) {
        const p = Math.abs(b - a) % (Math.PI * 2);
        return p > Math.PI ? (Math.PI * 2) - p : p;
    }
};
const io = { send() {} };
let myPlayer = { sid: 1, alive: true, x2: 5000, y2: 5000, skinIndex: 0, tailIndex: 0 };
let players = [ myPlayer ];
let nearestEnemy = null;
let attackState = 0, leftClick = false, ePress = false;
const keys = {};
const moveKeys = { 87: [0,-1], 38: [0,-1], 83: [0,1], 40: [0,1], 65: [-1,0], 37: [-1,0], 68: [1,0], 39: [1,0] };
const pings = [];
function pingMap(x, y) { pings.push({ x, y }); }
let camX = 5000, camY = 5000, mouseX = 800, mouseY = 400;
let screenWidth = 1600, screenHeight = 900, maxScreenWidth = 1920, maxScreenHeight = 1080;
let wsAddress = 'wss://example.test';
function addChatLog() {}

global.window = { vars: {}, turnstile: null };
global.document = { querySelector: () => null, createElement: () => ({ style: {}, appendChild() {}, remove() {} }), head: null, documentElement: { appendChild() {} } };

// Lift the RynBots block straight out of the userscript, so this test always
// runs against what actually ships rather than against a copy.
const SCRIPT = process.argv[2] || (__dirname + '/../novastorm_1.5.user.js');
const lines = fs.readFileSync(SCRIPT, 'utf8').split('\n');
const from = lines.findIndex(l => l.trim().startsWith('const BOT_ITEM = {'));
const to = lines.findIndex(l => l.includes('window.RynBots = RynBots'));
if (from < 0 || to < 0 || to <= from) {
    console.error('could not find the bot block in ' + SCRIPT);
    process.exit(2);
}
const RynBots = eval(lines.slice(from, to).join('\n') + '\n; RynBots');

// ---------------------------------------------------------------- helpers
function defaults() {
    return {
        botName: 'nova', botCount: 5, botHold: false, botRandomNames: false,
        botAutoSpawn: true, botAutoBreak: true, botAutoAttack: true, botSync: true,
        botFreeze: false, botFollowCursor: false, botRandomMove: false, botAutoBuyHats: true,
        botCircleRadius: 150, botStopRadius: 60,
        botPrimary: 5, botSecondary: 9, botAgeTrap: true, botAgeBoost: false, botAge8: 'auto',
        botAutoHeal: true, botAutoPlace: true,
        botScanKeep: 350, botGuardRadius: 300, botPossessKeys: true,
        autoPlay: false
    };
}
function mkBot(tag) {
    const ws = { tag, readyState: 1, addEventListener() {} };
    const b = RynBots._newBot(ws);
    b.ready = true; b.alive = true; b.sid = tag;
    RynBots.list.push(b);
    return b;
}
function reset() {
    RynBots.list.length = 0;
    RynBots._nameSeq = 0;
    RynBots._syncUntil = 0;
    RynBots._manualAttack = false;
    RynBots.hunt = null;
    RynBots.ceasefire = false;
    RynBots.possessed = null;
    RynBots._autoPlayForced = false;
    RynBots._log.length = 0;
    sent.length = 0;
    pings.length = 0;
    players = [ myPlayer ];
    nearestEnemy = null;
    attackState = 0; leftClick = false; ePress = false;
    for (const k in keys) delete keys[k];
    window.vars = defaults();
}
let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('  ok   ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + ' -> ' + e.message); fail++; }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function ok(v, m) { if (!v) throw new Error(m || 'expected truthy'); }
const last = ty => [...sent].reverse().find(p => p.type === ty);

// ---------------------------------------------------------------- tests
console.log('names');
reset();
t('sequential names off random', () => { eq(RynBots._makeName(), 'nova1'); eq(RynBots._makeName(), 'nova2'); });
t('random names still carry the number', () => {
    window.vars.botRandomNames = true;
    const n = RynBots._makeName();
    ok(/^[a-z]+3$/.test(n), 'got ' + n);
});

console.log('age path');
reset();
t('age 2 sends the chosen primary', () => {
    const b = mkBot(10); sent.length = 0;
    RynBots._chooseUpgrade(b, 1, 2);
    eq(last('H').args[0], 5);
});
t('age 3 is cookie (16+1)', () => {
    const b = mkBot(11); sent.length = 0;
    RynBots._chooseUpgrade(b, 1, 3); eq(last('H').args[0], 17);
});
t('age 4 trap by default (16+15)', () => {
    const b = mkBot(12); sent.length = 0;
    RynBots._chooseUpgrade(b, 1, 4); eq(last('H').args[0], 31);
});
t('age 4 boost when trap is off (16+16)', () => {
    const b = mkBot(13); sent.length = 0;
    window.vars.botAgeTrap = false; window.vars.botAgeBoost = true;
    RynBots._chooseUpgrade(b, 1, 4); eq(last('H').args[0], 32);
});
t('age 5 greater spikes (16+7)', () => {
    const b = mkBot(14); sent.length = 0;
    RynBots._chooseUpgrade(b, 1, 5); eq(last('H').args[0], 23);
});
t('age 6 sends the chosen secondary', () => {
    const b = mkBot(15); sent.length = 0;
    window.vars.botSecondary = 10;
    RynBots._chooseUpgrade(b, 1, 6); eq(last('H').args[0], 10);
});
t('age 7 platform (16+18)', () => {
    const b = mkBot(16); sent.length = 0;
    RynBots._chooseUpgrade(b, 1, 7); eq(last('H').args[0], 34);
});
t('age 8 crossbow when the bot holds a bow', () => {
    const b = mkBot(17); b.weapons = [5, 9]; sent.length = 0;
    RynBots._chooseUpgrade(b, 1, 8); eq(last('H').args[0], 12);
});
t('age 8 power mill otherwise (16+12)', () => {
    const b = mkBot(18); b.weapons = [5, 10]; sent.length = 0;
    RynBots._chooseUpgrade(b, 1, 8); eq(last('H').args[0], 28);
});
t('age 9 spinning spikes (16+9)', () => {
    const b = mkBot(19); sent.length = 0;
    RynBots._chooseUpgrade(b, 1, 9); eq(last('H').args[0], 25);
});
t('no upgrade sent with zero points', () => {
    const b = mkBot(20); sent.length = 0;
    RynBots._chooseUpgrade(b, 0, 5); eq(sent.length, 0);
});

console.log('break weapon');
reset();
t('great hammer beats a polearm', () => {
    const b = mkBot(30); b.weapons = [5, 10]; eq(RynBots._breakWeapon(b), 10);
});
t('bows / musket / shield / grabby are never picked', () => {
    for (const sec of [9, 11, 12, 13, 14, 15]) {
        const b = RynBots._newBot({ tag: 0, readyState: 1 });
        b.weapons = [1, sec];
        eq(RynBots._breakWeapon(b), 1, 'sec ' + sec);
    }
});
t('daggers out-break a hand axe', () => {
    const b = mkBot(31); b.weapons = [7, 9]; eq(RynBots._breakWeapon(b), 7);
});

console.log('targeting');
reset();
t('a bot never targets you or another bot', () => {
    const a = mkBot(40), b = mkBot(41);
    a.x = 0; a.y = 0;
    a.players.set(1, { sid: 1, x: 10, y: 0, visible: true });    // me
    a.players.set(41, { sid: 41, x: 20, y: 0, visible: true });  // sibling bot
    a.players.set(99, { sid: 99, x: 300, y: 0, visible: true }); // real player
    eq(RynBots._nearestEnemy(a).p.sid, 99);
});
t('same-team players are skipped', () => {
    const a = mkBot(42); a.x = 0; a.y = 0; a.team = 'clan';
    a.players.set(70, { sid: 70, x: 10, y: 0, visible: true, team: 'clan' });
    a.players.set(71, { sid: 71, x: 500, y: 0, visible: true, team: null });
    eq(RynBots._nearestEnemy(a).p.sid, 71);
});
t('invisible players are skipped', () => {
    const a = mkBot(43); a.x = 0; a.y = 0;
    a.players.set(80, { sid: 80, x: 10, y: 0, visible: false });
    eq(RynBots._nearestEnemy(a), null);
});

console.log('world model');
reset();
t('updatePlayers fills self and others', () => {
    const b = mkBot(50);
    const row = (sid, x, y) => [sid, x, y, 1.5, -1, 0, 0, null, 0, 0, 0, 0, 0];
    RynBots._onPacket(b, 'a', [[].concat(row(50, 100, 200), row(51, 400, 200))]);
    eq(b.x, 100); eq(b.y, 200);
    eq(b.players.get(51).x, 400);
    ok(b.players.get(51).visible);
});
t('loadGameObject / killObject / killObjects', () => {
    const b = mkBot(51);
    RynBots._onPacket(b, 'H', [[1, 10, 10, 0, 50, 0, 4, 51, 2, 90, 10, 0, 50, 0, 4, 99]]);
    eq(b.objects.size, 2);
    RynBots._onPacket(b, 'Q', [1]);
    eq(b.objects.size, 1);
    RynBots._onPacket(b, 'R', [99]);
    eq(b.objects.size, 0);
});
t('death marks the bot dead and re-sends spawn', () => {
    const b = mkBot(52); sent.length = 0;
    RynBots._onPacket(b, 'P', []);
    eq(b.alive, false);
    ok(last('M'), 'no spawn packet');
});
t('auto spawn off means no respawn packet', () => {
    const b = mkBot(53); window.vars.botAutoSpawn = false; sent.length = 0;
    RynBots._onPacket(b, 'P', []);
    eq(sent.length, 0);
});
t('updateItems refreshes the weapon pair', () => {
    const b = mkBot(54);
    RynBots._onPacket(b, 'V', [[4, 10], true]);
    eq(b.weapons[0], 4); eq(b.weapons[1], 10);
});
t('store packets track owned + equipped hats', () => {
    const b = mkBot(55);
    RynBots._onPacket(b, '5', [0, 7, 0]);   // bought hat 7
    RynBots._onPacket(b, '5', [1, 7, 0]);   // equipped hat 7
    eq(b.skins[7], 1); eq(b.skinIndex, 7);
});

console.log('formation + movement');
reset();
t('bots spread around the circle and stop inside the deadzone', () => {
    const b = mkBot(60), c = mkBot(61);
    window.vars.botCircleRadius = 300;
    const s0 = RynBots._spot(b, 0, 2), s1 = RynBots._spot(c, 1, 2);
    eq(Math.round(s0.x), 5300); eq(Math.round(s0.y), 5000);
    eq(Math.round(s1.x), 4700);
    b.x = s0.x - 10; b.y = s0.y;             // already on its spot
    sent.length = 0; RynBots._botTick(b);
    eq(last('9').args[0], null, 'should have stopped');
});
t('a bot far from its spot walks toward it', () => {
    const b = mkBot(62);
    b.x = 0; b.y = 5000;
    sent.length = 0; RynBots._botTick(b);
    const a = last('9').args[0];
    ok(a !== null && Math.abs(a) < 0.1, 'heading east, got ' + a);
});
t('freeze stops everyone', () => {
    const b = mkBot(63); b.x = 0; b.y = 0;
    window.vars.botFreeze = true;
    sent.length = 0; RynBots._botTick(b);
    eq(last('9').args[0], null);
});
t('follow cursor aims at the mouse in world space', () => {
    const b = mkBot(64);
    window.vars.botFollowCursor = true;
    window.vars.botCircleRadius = 50;
    const s = RynBots._spot(b, 0, 1);
    // k = 1 / max(1600/1920, 900/1080) = 1.2 ; cursor 800,400 -> +0, -60
    eq(Math.round(s.x - 50), 5000);
    eq(Math.round(s.y), Math.round(5000 - 60));
});

console.log('auto break');
reset();
t('three stalled ticks then a swing at the wall', () => {
    const b = mkBot(70); b.x = 0; b.y = 0; b.speed = 0; b.weapons = [5, 10];
    b.objects.set(1, { sid: 1, x: 90, y: 0, scale: 50, type: -1, id: 4, owner: 99 });
    eq(RynBots._autoBreak(b, 0), null);
    eq(RynBots._autoBreak(b, 0), null);
    const aim = RynBots._autoBreak(b, 0);
    ok(aim !== null && Math.abs(aim) < 1e-9, 'aim ' + aim);
});
t('a moving bot is never stuck', () => {
    const b = mkBot(71); b.speed = 40;
    b.objects.set(1, { sid: 1, x: 90, y: 0, scale: 50, type: -1, id: 4, owner: 99 });
    for (let i = 0; i < 6; i++) eq(RynBots._autoBreak(b, 0), null);
});
t('walkable pads are never a blocker', () => {
    const b = mkBot(72); b.x = 0; b.y = 0; b.speed = 0; b.weapons = [5, 10];
    b.objects.set(1, { sid: 1, x: 60, y: 0, scale: 45, type: -1, id: 16, owner: 99 });
    for (let i = 0; i < 4; i++) RynBots._autoBreak(b, 0);
    eq(b.breakAim, null);
});
t('a tree cannot be broken, so the bot turns instead', () => {
    const b = mkBot(73); b.x = 0; b.y = 0; b.speed = 0; b.weapons = [5, 10];
    b.objects.set(1, { sid: 1, x: 60, y: 0, scale: 50, type: 0, id: null, owner: -1 });
    for (let i = 0; i < 6; i++) RynBots._autoBreak(b, 0);
    eq(b.breakAim, null);
    ok(b.detourUntil > Date.now(), 'no detour started');
});
t('auto break off never swings', () => {
    const b = mkBot(74); b.x = 0; b.y = 0; b.speed = 0;
    window.vars.botAutoBreak = false;
    b.objects.set(1, { sid: 1, x: 60, y: 0, scale: 50, type: -1, id: 4, owner: 99 });
    for (let i = 0; i < 6; i++) eq(RynBots._autoBreak(b, 0), null);
});

console.log('safe walk');
reset();
t('steps around an enemy spike', () => {
    const b = mkBot(80); b.x = 0; b.y = 0;
    b.objects.set(1, { sid: 1, x: 70, y: 0, scale: 52, type: -1, id: 6, owner: 99 });
    const a = RynBots._safeWalk(b, 0);
    ok(Math.abs(a) > 0.3, 'still heading into the spike: ' + a);
});
t('does not dodge its own side spikes', () => {
    const b = mkBot(81); b.x = 0; b.y = 0; b.sid = 81;
    b.objects.set(1, { sid: 1, x: 70, y: 0, scale: 52, type: -1, id: 6, owner: 81 });
    eq(RynBots._safeWalk(b, 0), 0);
});

console.log('sync + manual attack');
reset();
t('sync makes the squad swing when you swing', () => {
    const b = mkBot(90); b.x = 0; b.y = 5000;
    sent.length = 0;
    RynBots.onMasterSwing();
    RynBots._botTick(b);
    eq(last('F').args[0], 1);
});
t('sync off ignores your swing', () => {
    const b = mkBot(91); b.x = 0; b.y = 5000; b.attacking = true;
    window.vars.botSync = false; window.vars.botAutoAttack = false;
    RynBots.onMasterSwing();
    sent.length = 0; RynBots._botTick(b);
    eq(last('F').args[0], 0);
});
t('the manual key swings while Sync is off', () => {
    const b = mkBot(92); b.x = 0; b.y = 5000;
    window.vars.botSync = false;
    RynBots.setManualAttack(true);
    sent.length = 0; RynBots._botTick(b);
    eq(last('F').args[0], 1);
});
t('placement is not a swing', () => {
    reset();
    RynBots._masterPlacing = true;
    RynBots.onMasterSwing();
    eq(RynBots._syncUntil, 0);
    RynBots._masterPlacing = false;
});

console.log('random move');
reset();
t('a destination is picked inside the map', () => {
    const b = mkBot(100); b.x = 5000; b.y = 5000;
    window.vars.botRandomMove = true;
    const w = RynBots._wander(b);
    ok(w.x > 200 && w.x < 14200 && w.y > 200 && w.y < 14200, JSON.stringify(w));
});
t('two bots on the same line: the later one re-rolls', () => {
    const a = mkBot(101), b = mkBot(102);
    window.vars.botRandomMove = true;
    a.x = 1000; a.y = 1000; a.wander = { x: 2000, y: 1000 };
    b.x = 1050; b.y = 1000; b.wander = { x: 2100, y: 1000 };
    RynBots.tick();
    eq(b.wander, null);
    ok(a.wander !== null, 'the first bot kept its destination');
});
t('bots far apart keep their own destinations', () => {
    reset();
    const a = mkBot(103), b = mkBot(104);
    window.vars.botRandomMove = true;
    a.x = 1000; a.y = 1000; a.wander = { x: 2000, y: 1000 };
    b.x = 9000; b.y = 9000; b.wander = { x: 9500, y: 9000 };
    RynBots.tick();
    ok(b.wander !== null);
});

console.log('auto buy');
reset();
t('bots buy then equip the hat you wear', () => {
    const b = mkBot(110);
    myPlayer.skinIndex = 11;
    RynBots._lastBuyCheck = 0;
    sent.length = 0;
    RynBots.tick();
    const cs = sent.filter(p => p.type === 'c');
    eq(cs.length, 2);
    eq(cs[0].args[0], 1); eq(cs[0].args[1], 11);   // buy
    eq(cs[1].args[0], 0); eq(cs[1].args[1], 11);   // equip
});
t('already wearing it means no packets', () => {
    reset();
    const b = mkBot(111); b.skinIndex = 11; b.skins[11] = 1;
    myPlayer.skinIndex = 11; myPlayer.tailIndex = 0;
    RynBots._lastBuyCheck = 0; sent.length = 0;
    RynBots.tick();
    eq(sent.filter(p => p.type === 'c').length, 0);
});
myPlayer.skinIndex = 0;

console.log('packet throttling');
reset();
t('the same heading is not re-sent every tick', () => {
    const b = mkBot(120);
    sent.length = 0;
    RynBots._sendMove(b, 1.0); RynBots._sendMove(b, 1.01); RynBots._sendMove(b, 1.0);
    eq(sent.filter(p => p.type === '9').length, 1);
    RynBots._sendMove(b, 2.0);
    eq(sent.filter(p => p.type === '9').length, 2);
});
t('attack state flips once per change', () => {
    const b = mkBot(121); sent.length = 0;
    RynBots._sendAttack(b, true); RynBots._sendAttack(b, true); RynBots._sendAttack(b, false);
    eq(sent.filter(p => p.type === 'F').length, 2);
});

console.log('auto heal');
reset();
t('a hurt bot eats, then puts its weapon back', () => {
    const b = mkBot(130); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    b.health = 40;
    sent.length = 0;
    ok(RynBots._autoHeal(b), 'did not heal');
    const z = sent.filter(p => p.type === 'z');
    const f = sent.filter(p => p.type === 'F');
    eq(z[0].args[0], 0, 'food slot');   eq(z[0].args[1], false);
    eq(f.length % 2, 0, 'swings come in pairs');
    eq(z[z.length - 1].args[0], 5, 'weapon back');
    eq(z[z.length - 1].args[1], true);
});
t('a full bot never eats', () => {
    const b = mkBot(131); b.health = 100; sent.length = 0;
    eq(RynBots._autoHeal(b), false);
    eq(sent.length, 0);
});
t('the burst is capped at three units', () => {
    const b = mkBot(132); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    b.health = 1; sent.length = 0;
    RynBots._autoHeal(b);
    eq(sent.filter(p => p.type === 'F' && p.args[0] === 1).length, 3);
});
t('auto heal off means no food', () => {
    const b = mkBot(133); b.health = 20; window.vars.botAutoHeal = false;
    sent.length = 0;
    eq(RynBots._autoHeal(b), false);
});
t('healing takes the whole tick', () => {
    reset();
    const b = mkBot(134); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    b.health = 30; b.x = 0; b.y = 5000;
    sent.length = 0;
    RynBots._botTick(b);
    eq(sent.filter(p => p.type === '9').length, 0, 'should not have re-steered');
});

console.log('auto place');
reset();
t('a spike goes down on whoever closes in', () => {
    const b = mkBot(140); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    b.x = 0; b.y = 0;
    sent.length = 0;
    ok(RynBots._autoPlaceSpike(b, { p: { x: 120, y: 0 }, d: 120 }));
    const z = sent.filter(p => p.type === 'z');
    eq(z[0].args[0], 6);  eq(z[0].args[1], false);
    eq(z[z.length - 1].args[0], 5);
});
t('the hardest spike owned wins', () => {
    const b = mkBot(141); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 9, 10];
    b.x = 0; b.y = 0; sent.length = 0;
    RynBots._autoPlaceSpike(b, { p: { x: 120, y: 0 }, d: 120 });
    eq(sent.filter(p => p.type === 'z')[0].args[0], 9);
});
t('nothing is stacked on a spike already there', () => {
    const b = mkBot(142); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    b.x = 0; b.y = 0;
    b.objects.set(1, { sid: 1, x: 87, y: 0, scale: 52, type: -1, id: 6, owner: 142 });
    sent.length = 0;
    eq(RynBots._autoPlaceSpike(b, { p: { x: 150, y: 0 }, d: 150 }), false);
});
t('an enemy out of range is not worth a spike', () => {
    const b = mkBot(143); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    eq(RynBots._autoPlaceSpike(b, { p: { x: 900, y: 0 }, d: 900 }), false);
});

console.log('bot console');
reset();
t('!find resolves a name off the master player list', () => {
    players = [ myPlayer, { sid: 77, name: 'Sw1ft', x2: 100, y2: 100 } ];
    ok(RynBots.command('!find sw1ft'));
    eq(RynBots.hunt.sid, 77);
    eq(RynBots.hunt.name, 'Sw1ft');
});
t('!find takes a raw sid for someone not on the list yet', () => {
    reset();
    ok(RynBots.command('!find 4242'));
    eq(RynBots.hunt.sid, 4242);
});
t('!find never resolves to you or to a bot', () => {
    reset();
    const b = mkBot(55); b.sid = 55;
    players = [ myPlayer, { sid: 55, name: 'nova1' }, { sid: 88, name: 'novaX' } ];
    RynBots.command('!find nova');
    eq(RynBots.hunt.sid, 88);
});
t('!cf cancels the hunt and silences everyone', () => {
    reset();
    RynBots.command('!find 5');
    ok(RynBots.command('!cf'));
    eq(RynBots.hunt, null);
    eq(RynBots.ceasefire, true);
});
t('!fire lifts the ceasefire', () => {
    ok(RynBots.command('!fire'));
    eq(RynBots.ceasefire, false);
});
t('!find lifts a standing ceasefire', () => {
    reset();
    RynBots.command('!cf');
    RynBots.command('!find 9');
    eq(RynBots.ceasefire, false);
});
t('!c cancels the hunt but keeps them free to fight', () => {
    reset();
    RynBots.command('!find 9');
    ok(RynBots.command('!c'));
    eq(RynBots.hunt, null);
    eq(RynBots.ceasefire, false);
});
t('plain chat is not a command', () => {
    eq(RynBots.command('hello there'), false);
    eq(RynBots.command('!nonsense'), false);
});
t('every command writes a line to the console log', () => {
    reset();
    RynBots.command('!bots');
    ok(RynBots._log.length > 0);
});

console.log('scan and kill');
reset();
t('a ceasefire stops the swinging', () => {
    const b = mkBot(150); b.x = 0; b.y = 5000; b.attacking = true;
    b.players.set(99, { sid: 99, x: 40, y: 5000, visible: true });
    RynBots.ceasefire = true;
    sent.length = 0;
    RynBots._botTick(b);
    eq(last('F').args[0], 0);
});
t('the spotter holds its distance and does not swing', () => {
    reset();
    const b = mkBot(151); b.weapons = [5, 10];
    b.x = 0; b.y = 0; b.attacking = true;
    window.vars.botScanKeep = 350;
    RynBots.command('!find 99');
    b.players.set(99, { sid: 99, name: 'prey', x: 100, y: 0, visible: true });
    sent.length = 0;
    RynBots._botTick(b);
    eq(RynBots.hunt.foundBy, b, 'should be the spotter');
    eq(last('F').args[0], 0, 'the spotter swung');
    // 100 units away with a 350 ring: it must be backing off, i.e. heading -x
    const mv = last('9').args[0];
    ok(mv !== null && Math.abs(Math.abs(mv) - Math.PI) < 0.6, 'not retreating: ' + mv);
});
t('the rest of the squad regroups on you', () => {
    reset();
    const spotter = mkBot(160), other = mkBot(161);
    RynBots.command('!find 99');
    spotter.players.set(99, { sid: 99, x: 100, y: 0, visible: true });
    spotter.x = 0; spotter.y = 0;
    RynBots._botTick(spotter);
    eq(RynBots.hunt.foundBy, spotter);
    other.x = 0; other.y = 0;       // far from you (5000,5000)
    sent.length = 0;
    RynBots._botTick(other);
    const mv = last('9').args[0];
    ok(mv !== null && mv > 0.5 && mv < 1.1, 'not heading for you: ' + mv);
});
t('regrouping beats Random Move', () => {
    reset();
    window.vars.botRandomMove = true;
    const spotter = mkBot(165), other = mkBot(166);
    RynBots.command('!find 99');
    spotter.x = 0; spotter.y = 0;
    spotter.players.set(99, { sid: 99, x: 100, y: 0, visible: true });
    RynBots._botTick(spotter);
    other.x = 0; other.y = 0;
    sent.length = 0;
    RynBots._botTick(other);
    const mv = last('9').args[0];
    ok(mv !== null && mv > 0.5 && mv < 1.1, 'roamed off instead of regrouping: ' + mv);
});
t('bots sweep their own slice of the map while searching', () => {
    reset();
    const a = mkBot(170), b = mkBot(171), c = mkBot(172), d = mkBot(173);
    RynBots.command('!find ghost');
    const pts = [a, b, c, d].map((bt, i) => RynBots._searchPoint(bt, i, 4));
    // 4 bots over a 14400 map is a 2x2 grid: two on each half, in both axes
    eq(pts.filter(p => p.x < 7200).length, 2);
    eq(pts.filter(p => p.y < 7200).length, 2);
});
t('a stale sighting hands the hunt back to the sweep', () => {
    reset();
    const b = mkBot(180);
    RynBots.command('!find 99');
    RynBots.hunt.foundBy = b;
    RynBots.hunt.foundAt = Date.now() - 9000;
    RynBots.tick();
    eq(RynBots.hunt.foundBy, null);
});
t('the spotter pings your minimap on a beat', () => {
    reset();
    const b = mkBot(181);
    RynBots.command('!find 99');
    RynBots.hunt.foundBy = b;
    RynBots.hunt.foundAt = Date.now();
    RynBots.hunt.x = 1234; RynBots.hunt.y = 5678;
    pings.length = 0;
    RynBots.tick();
    eq(pings.length, 1);
    eq(pings[0].x, 1234);
    RynBots.tick();              // too soon for a second
    eq(pings.length, 1);
});

console.log('possession');
reset();
t('left steps forward through the bots, up gives you back', () => {
    const a = mkBot(190), b = mkBot(191);
    RynBots.possess(1); eq(RynBots.possessed, a);
    RynBots.possess(1); eq(RynBots.possessed, b);
    RynBots.possess(1); eq(RynBots.possessed, a, 'should wrap');
    RynBots.release();  eq(RynBots.possessed, null);
});
t('right steps backwards', () => {
    reset();
    const a = mkBot(192), b = mkBot(193);
    RynBots.possess(-1); eq(RynBots.possessed, b);
    RynBots.possess(-1); eq(RynBots.possessed, a);
});
t('nothing to possess is not a crash', () => {
    reset();
    RynBots.possess(1);
    eq(RynBots.possessed, null);
});
t('your mouse and keys drive the possessed bot', () => {
    reset();
    const b = mkBot(200); b.x = 0; b.y = 0;
    RynBots._enter(b);
    keys[68] = 1;              // D -> east
    attackState = 1;
    sent.length = 0;
    RynBots._possessTick();
    eq(last('9').args[0], 0, 'should walk east');
    eq(last('F').args[0], 1, 'should swing');
    ok(last('D') !== undefined, 'no aim sent');
    keys[68] = 0; attackState = 0;
});
t('the AI keeps its hands off a bot you are driving', () => {
    reset();
    const b = mkBot(201); b.x = 0; b.y = 5000;
    RynBots._enter(b);
    sent.length = 0;
    RynBots._botTick(b);
    eq(sent.length, 0);
});
t('releasing stops the swing it was holding', () => {
    reset();
    const b = mkBot(202);
    RynBots._enter(b);
    b.attacking = true;
    sent.length = 0;
    RynBots.release();
    eq(last('F').args[0], 0);
});
t('number keys are the bot action bar: weapon then building', () => {
    reset();
    const b = mkBot(203); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    RynBots._enter(b);
    sent.length = 0;
    ok(RynBots.possessSlot(1));
    eq(last('z').args[0], 10, 'slot 2 is the secondary');
    sent.length = 0;
    ok(RynBots.possessSlot(2));                 // first building
    eq(sent.filter(p => p.type === 'z')[0].args[0], 0);
    eq(sent.filter(p => p.type === 'F').length, 2, 'place = one swing');
});
t('Autoplay guards your frozen body and then lets go', () => {
    reset();
    const b = mkBot(210);
    RynBots._enter(b);
    nearestEnemy = { x2: 5100, y2: 5000 };      // 100 away from you
    RynBots.tick();
    eq(window.vars.autoPlay, true);
    nearestEnemy = { x2: 9000, y2: 9000 };      // gone
    RynBots.tick();
    eq(window.vars.autoPlay, false);
});
t('releasing hands Autoplay back the way it was', () => {
    reset();
    const b = mkBot(211);
    RynBots._enter(b);
    nearestEnemy = { x2: 5100, y2: 5000 };
    RynBots.tick();
    eq(window.vars.autoPlay, true);
    RynBots.release();
    eq(window.vars.autoPlay, false);
    nearestEnemy = null;
});
t('a death does not kick you out while Auto Spawn is on', () => {
    reset();
    const b = mkBot(214);
    RynBots._enter(b);
    RynBots._onPacket(b, 'P', []);       // it died; auto spawn re-sends
    RynBots._possessTick();
    eq(RynBots.possessed, b, 'lost the seat');
});
t('a bot that drops out is not left possessed', () => {
    reset();
    const b = mkBot(212);
    RynBots._enter(b);
    RynBots._remove(b);
    eq(RynBots.possessed, null);
});
t('killAll clears the hunt and the possession', () => {
    reset();
    const b = mkBot(213);
    RynBots.command('!find 5');
    RynBots._enter(b);
    RynBots.killAll();
    eq(RynBots.hunt, null);
    eq(RynBots.possessed, null);
});

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
