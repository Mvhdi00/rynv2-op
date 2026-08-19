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
    ['apple'], ['cookie'], ['cheese'],
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
    getAngleDist(a, b) {
        const p = Math.abs(b - a) % (Math.PI * 2);
        return p > Math.PI ? (Math.PI * 2) - p : p;
    }
};
const io = { send() {} };
let myPlayer = { sid: 1, alive: true, x2: 5000, y2: 5000, skinIndex: 0, tailIndex: 0 };
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
        botPrimary: 5, botSecondary: 9, botAgeTrap: true, botAgeBoost: false, botAge8: 'auto'
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
    sent.length = 0;
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

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
