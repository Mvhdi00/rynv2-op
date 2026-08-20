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
    ['wood wall', 27, { health: 380 }], ['stone wall', 50, { health: 900 }], ['castle wall', 50, { health: 1500 }],
    ['spikes', 52, { dmg: 20, health: 400 }], ['greater spikes', 49, { dmg: 35, health: 500 }],
    ['poison spikes', 52, { dmg: 30, health: 600 }], ['spinning spikes', 52, { dmg: 45, health: 500 }],
    ['windmill', 45, { health: 400 }], ['faster windmill', 47, { health: 500 }], ['power mill', 47, { health: 800 }],
    ['mine', 65], ['sapling', 110],
    ['pit trap', 50, { trap: true, health: 500 }], ['boost pad', 45, { ignoreCollision: true, health: 150 }],
    ['turret', 43, { health: 800 }], ['platform', 43, { ignoreCollision: true, health: 300 }],
    ['healing pad', 45, { ignoreCollision: true, health: 400 }], ['spawn pad', 45, { ignoreCollision: true, health: 400 }],
    ['blocker', 45, { health: 400 }], ['teleporter', 45, { ignoreCollision: true, health: 200 }]
];
ITEM_DEFS.forEach(([name, scale, extra]) => items.list.push(Object.assign({ name, scale }, extra || {})));

const config = {
    mapScale: 14400,
    weaponVariants: [{ val: 1 }, { val: 1.1 }, { val: 1.18 }, { val: 1.18 }]
};
const hats = [{ id: 0 }, { id: 6, dmgMult: 0.75 }, { id: 20, atkSpd: 0.78 }, { id: 40 }, { id: 53 }];
let packets = 0;
function lineInCircle(x, y, x2, y2, cx, cy, scale) {
    const lv = { x: x2 - x, y: y2 - y };
    const tc = { x: cx - x, y: cy - y };
    const proj = (tc.x * lv.x + tc.y * lv.y) / (lv.x * lv.x + lv.y * lv.y);
    const cp = { x: x + proj * lv.x, y: y + proj * lv.y };
    if (cp.x >= Math.min(x, x2) && cp.x <= Math.max(x, x2) &&
        cp.y >= Math.min(y, y2) && cp.y <= Math.max(y, y2)) {
        return Math.hypot(cp.x - cx, cp.y - cy) < scale;
    }
    return false;
}
const UTILS = {
    getDistance(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    getDirection(x1, y1, x2, y2) { return Math.atan2(y1 - y2, x1 - x2); },
    fixTo(n, d) { return parseFloat(n.toFixed(d)); },
    getAngleDist(a, b) {
        const p = Math.abs(b - a) % (Math.PI * 2);
        return p > Math.PI ? (Math.PI * 2) - p : p;
    },
    toRad(d) { return d * Math.PI / 180; }
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
// The mod-context guard lives outside the RynBots block; from here we are
// always the master, never inside a bot's context.
function inBotCtx() { return false; }

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
        botAutoHeal: true, botAutoPlace: true, botAutoMills: false, botAutoPush: true,
        botSpikeTick: true,
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
t('the object model keeps every field the renderer seeds from', () => {
    // The bot view rebuilds real GameObjects out of this model when you step
    // into a bot, passing them to objectManager.add in the same order
    // loadGameObject does:
    //   add(sid, x, y, dir, scale, type, items.list[id], true, owner)
    // so the field names and the packet order have to stay lined up. An
    // off-by-one here renders nothing and looks like an empty green screen.
    const b = mkBot(56);
    RynBots._onPacket(b, 'H', [[7, 1200, 3400, 1.25, 55, 2, 4, 99]]);
    const o = b.objects.get(7);
    eq(o.sid, 7);      eq(o.x, 1200);   eq(o.y, 3400);
    eq(o.dir, 1.25);   eq(o.scale, 55); eq(o.type, 2);
    eq(o.id, 4);       eq(o.owner, 99);
});
t('a natural resource keeps a null id so it seeds as a resource, not an item', () => {
    const b = mkBot(57);
    RynBots._onPacket(b, 'H', [[8, 500, 500, 0, 70, 3, null, -1]]);
    const o = b.objects.get(8);
    eq(o.id, null, 'items.list[null] is undefined, which is what makes it a resource');
    eq(o.owner, -1, 'and a negative owner seeds as unowned');
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
t('the HUD numbers a possessed bot shows are tracked', () => {
    const b = mkBot(58);
    RynBots._onPacket(b, 'N', ['food', 137]);
    RynBots._onPacket(b, 'N', ['wood', 42]);
    RynBots._onPacket(b, 'N', ['stone', 9]);
    RynBots._onPacket(b, 'N', ['points', 5100]);
    RynBots._onPacket(b, 'N', ['kills', 3]);
    eq(b.stats.food, 137); eq(b.stats.wood, 42); eq(b.stats.stone, 9);
    eq(b.stats.points, 5100); eq(b.stats.kills, 3);
});
t('the age bar has XP and maxXP to draw from, not just the age', () => {
    const b = mkBot(59);
    RynBots._onPacket(b, 'T', [180, 900, 4]);
    eq(b.XP, 180); eq(b.maxXP, 900); eq(b.age, 4);
});
t('placed-item counts are tracked per group', () => {
    const b = mkBot(60);
    RynBots._onPacket(b, 'S', [2, 11]);     // 11 spikes down
    RynBots._onPacket(b, 'S', [3, 4]);      // 4 mills
    eq(b.itemCounts[2], 11);
    eq(b.itemCounts[3], 4);
});
t('a non-string player value is ignored rather than making a junk key', () => {
    const b = mkBot(61);
    const before = Object.keys(b.stats).length;
    RynBots._onPacket(b, 'N', [7, 123]);
    eq(Object.keys(b.stats).length, before);
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

console.log('auto heal (the mod\'s, not an approximation)');
reset();
function hurt(b, to) {                      // a real health packet, which is what sets hurtAt
    RynBots._onPacket(b, 'O', [b.sid, to]);
}
t('it tops all the way back to 100 in one go, like heal(100 - health)', () => {
    const b = mkBot(130); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    hurt(b, 40);                            // 60 missing, apples heal 20 -> 3
    sent.length = 0;
    ok(RynBots._autoHeal(b), 'did not heal');
    eq(sent.filter(p => p.type === 'F' && p.args[0] === 1).length, 3, 'ceil(60/20)');
    const z = sent.filter(p => p.type === 'z');
    eq(z[0].args[0], 0, 'food slot');   eq(z[0].args[1], false);
    eq(z[z.length - 1].args[0], 5, 'weapon back');
});
t('one point of damage is enough to trigger it', () => {
    reset();
    const b = mkBot(131); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    hurt(b, 99);
    sent.length = 0;
    ok(RynBots._autoHeal(b), 'the old version waited for 15 missing; the mod does not');
    eq(sent.filter(p => p.type === 'F' && p.args[0] === 1).length, 1);
});
t('a bigger food eats fewer of them', () => {
    reset();
    const b = mkBot(132); b.weapons = [5, 10]; b.itemsOwned = [1, 3, 6, 10];  // cookie, heal 40
    hurt(b, 20);                            // 80 missing -> ceil(80/40) = 2
    sent.length = 0;
    RynBots._autoHeal(b);
    eq(sent.filter(p => p.type === 'F' && p.args[0] === 1).length, 2);
});
t('undamaged means no eating, however long ago it was hurt', () => {
    reset();
    const b = mkBot(133); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    b.health = 55; b.hurtAt = Date.now() - 5000;
    sent.length = 0;
    eq(RynBots._autoHeal(b), false, 'a stale hit is not a reason to eat');
});
t('full health never eats', () => {
    reset();
    const b = mkBot(134); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    hurt(b, 100);
    eq(RynBots._autoHeal(b), false);
});
t('auto heal off means no food', () => {
    reset();
    const b = mkBot(135); b.itemsOwned = [0, 3, 6, 10];
    window.vars.botAutoHeal = false;
    hurt(b, 20);
    eq(RynBots._autoHeal(b), false);
});
t('healing takes the whole tick', () => {
    reset();
    const b = mkBot(136); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    b.x = 0; b.y = 5000;
    hurt(b, 30);
    sent.length = 0;
    RynBots._botTick(b);
    eq(sent.filter(p => p.type === '9').length, 0, 'should not have re-steered');
});

console.log('auto mills (the mod\'s three-mill trail)');
reset();
t('three mills go down BEHIND the direction of travel', () => {
    const b = mkBot(137); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    b.x = 5000; b.y = 5000;
    window.vars.botAutoMills = true;
    sent.length = 0;
    ok(RynBots._autoMills(b, 0), 'nothing placed');        // walking east
    const swings = sent.filter(p => p.type === 'F' && p.args[0] === 1);
    eq(swings.length, 3, 'the mod places three');
    for (const sw of swings) {
        ok(UTILS.getAngleDist(sw.args[1], Math.PI) < 1.4,
           'each should be roughly behind (PI), got ' + sw.args[1].toFixed(2));
    }
});
t('the weapon comes back afterwards', () => {
    reset();
    const b = mkBot(138); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    window.vars.botAutoMills = true;
    sent.length = 0;
    RynBots._autoMills(b, 0);
    const z = sent.filter(p => p.type === 'z');
    eq(z[z.length - 1].args[0], 5);
    eq(z[z.length - 1].args[1], true);
});
t('standing still lays no trail', () => {
    reset();
    const b = mkBot(139); b.itemsOwned = [0, 3, 6, 10];
    window.vars.botAutoMills = true;
    eq(RynBots._autoMills(b, null), false);
});
t('a pinned bot lays no trail', () => {
    reset();
    const b = mkBot(140); b.itemsOwned = [0, 3, 6, 10];
    window.vars.botAutoMills = true;
    b.stuckTicks = 2;
    eq(RynBots._autoMills(b, 0), false, 'being stuck is the bot\'s nearestTrap guard');
});
t('no mill owned, no trail', () => {
    reset();
    const b = mkBot(141); b.itemsOwned = [0, 3, 6];      // no mill in slot 3
    window.vars.botAutoMills = true;
    eq(RynBots._autoMills(b, 0), false);
});
t('the toggle is off by default', () => {
    reset();
    const b = mkBot(142); b.itemsOwned = [0, 3, 6, 10];
    eq(RynBots._autoMills(b, 0), false);
});
t('an occupied spot is skipped', () => {
    reset();
    const b = mkBot(143); b.weapons = [5, 10]; b.itemsOwned = [0, 3, 6, 10];
    b.x = 0; b.y = 0;
    window.vars.botAutoMills = true;
    // Something small sitting exactly where the straight-back mill would go.
    // It has to be small: the mod's offsets are toRad(scale + scale/2), which
    // at the mill's placement radius puts the three spots only ~94 units apart,
    // so a wide blocker covers all three and none go down.
    const r = 35 + 45 + 5;
    b.objects.set(1, { sid: 1, x: -r, y: 0, scale: 15, type: -1, id: 4, owner: 9 });
    sent.length = 0;
    RynBots._autoMills(b, 0);
    eq(sent.filter(p => p.type === 'F' && p.args[0] === 1).length, 2, 'two of three');
});
t('the packet budget stops the trail', () => {
    reset();
    const b = mkBot(144); b.itemsOwned = [0, 3, 6, 10];
    window.vars.botAutoMills = true;
    packets = 118;
    eq(RynBots._autoMills(b, 0), false);
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
t('log appends exactly one line, and the sink sees it', () => {
    reset();
    let seen = 0;
    window._novaBotLogSink = () => seen++;
    RynBots.log('hello');
    eq(RynBots._log.length, 1);
    eq(seen, 1);
    window._novaBotLogSink = null;
});
t('_push feeds the same buffer without going through log', () => {
    reset();
    RynBots._push('Mod: from addChatLog');
    eq(RynBots._log.length, 1);
    eq(RynBots._log[0].text, 'Mod: from addChatLog');
});
t('the console buffer is capped', () => {
    reset();
    for (let i = 0; i < 90; i++) RynBots._push('line ' + i);
    eq(RynBots._log.length, 60);
    eq(RynBots._log[59].text, 'line 89');
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


console.log('auto push (the mod\'s trap-into-spike play)');
reset();
// A bot at the origin, an enemy east of it standing in the bot's own trap,
// with the bot's own spike just past the trap.
function pushSetup(opts) {
    opts = opts || {};
    const b = mkBot(150);
    b.x = 0; b.y = 0;
    const ex = opts.ex === undefined ? 300 : opts.ex;
    const e = { sid: 99, x: ex, y: 0, visible: true };
    b.players.set(99, e);
    b.objects.set(1, { sid: 1, x: ex, y: 0, scale: 50, type: -1, id: 15,
                       owner: opts.trapOwner === undefined ? b.sid : opts.trapOwner });
    // The spike has to clear the enemy's own body (35 + 50 = 85) or it reads as
    // "already on it", while staying inside 35/2 + 50 + 50 = 117.5 of the trap.
    // 100 sits in that band, which is where a spike beside a trap really lands.
    b.objects.set(2, { sid: 2, x: ex + 100, y: 0, scale: 50, type: -1, id: 6,
                       owner: opts.spikeOwner === undefined ? b.sid : opts.spikeOwner });
    return { b, e };
}
t('a trapped enemy next to my spike gives a push heading', () => {
    const { b } = pushSetup();
    const a = RynBots._autoPush(b, RynBots._nearestEnemy(b));
    ok(a !== null, 'no push angle');
    ok(Math.abs(a) < 0.6, 'should head toward them in the east, got ' + a.toFixed(2));
});
t('no trap, no push', () => {
    reset();
    const { b } = pushSetup();
    b.objects.delete(1);
    eq(RynBots._autoPush(b, RynBots._nearestEnemy(b)), null);
});
t('someone else\'s trap is not my play', () => {
    reset();
    const { b } = pushSetup({ trapOwner: 77 });
    eq(RynBots._autoPush(b, RynBots._nearestEnemy(b)), null);
});
t('someone else\'s spike is not my play either', () => {
    reset();
    const { b } = pushSetup({ spikeOwner: 77 });
    eq(RynBots._autoPush(b, RynBots._nearestEnemy(b)), null);
});
t('an enemy already on the spike is left alone', () => {
    reset();
    const b = mkBot(151);
    b.x = 0; b.y = 0;
    b.players.set(99, { sid: 99, x: 300, y: 0, visible: true });
    b.objects.set(1, { sid: 1, x: 300, y: 0, scale: 50, type: -1, id: 15, owner: b.sid });
    b.objects.set(2, { sid: 2, x: 320, y: 0, scale: 50, type: -1, id: 6, owner: b.sid });
    eq(RynBots._autoPush(b, RynBots._nearestEnemy(b)), null, 'already touching it');
});
t('a spike too far from the trap does not count', () => {
    reset();
    const { b } = pushSetup();
    b.objects.get(2).x = 300 + 400;   // way outside 117.5 of the trap
    eq(RynBots._autoPush(b, RynBots._nearestEnemy(b)), null);
});
t('the toggle turns it off', () => {
    reset();
    const { b } = pushSetup();
    window.vars.botAutoPush = false;
    eq(RynBots._autoPush(b, RynBots._nearestEnemy(b)), null);
});
t('an enemy spike on the path calls it off', () => {
    reset();
    const { b } = pushSetup();
    // their spike sitting on the walk line, halfway to the enemy
    b.objects.set(3, { sid: 3, x: 150, y: 0, scale: 50, type: -1, id: 7, owner: 77 });
    eq(RynBots._autoPush(b, RynBots._nearestEnemy(b)), null, 'walking through their spike is not worth it');
});
t('my own trap on the path does not call it off', () => {
    reset();
    const { b } = pushSetup();
    b.objects.set(3, { sid: 3, x: 150, y: 0, scale: 50, type: -1, id: 15, owner: b.sid });
    ok(RynBots._autoPush(b, RynBots._nearestEnemy(b)) !== null, 'my own trap is not an obstacle');
});
t('a push overrides where the bot was walking, and it keeps swinging', () => {
    reset();
    const { b } = pushSetup();
    sent.length = 0;
    RynBots._botTick(b);
    const mv = last('9');
    ok(mv && mv.args[0] !== null, 'should be moving');
    ok(Math.abs(mv.args[0]) < 0.6, 'toward the push, got ' + mv.args[0]);
    eq(last('F').args[0], 1, 'should be attacking while it shoves');
});

// ---------------------------------------------------------------------------
// The spike-tick foundation: reload clocks, structure damage, object health.
// ---------------------------------------------------------------------------
console.log('reload clocks off the server\'s own swing packet');
reset();
t('a swing puts that weapon on cooldown for its speed', () => {
    const b = mkBot(200);
    ok(RynBots._weaponReady(b, 5), 'a fresh weapon is ready');
    RynBots._onPacket(b, 'K', [b.sid, false, 5]);      // polearm, speed 700
    ok(!RynBots._weaponReady(b, 5), 'should be reloading');
    b.readyAt[5] = Date.now() - 1;
    ok(RynBots._weaponReady(b, 5), 'and ready again after it');
});
t('samurai armor shortens it by its atkSpd', () => {
    reset();
    const b = mkBot(201);
    const t0 = Date.now();
    RynBots._onPacket(b, 'K', [b.sid, false, 5]);
    const plain = b.readyAt[5] - t0;
    b.skinIndex = 20;
    RynBots._onPacket(b, 'K', [b.sid, false, 5]);
    const fast = b.readyAt[5] - Date.now();
    ok(fast < plain, 'expected a shorter reload, got ' + fast + ' vs ' + plain);
    ok(Math.abs(fast - 700 * 0.78) <= 5, 'expected ~546ms, got ' + fast);
});
t('another player\'s swing does not touch my clocks', () => {
    reset();
    const b = mkBot(202);
    b.players.set(9, { sid: 9, x: 0, y: 0, dir: 0 });
    RynBots._onPacket(b, 'K', [9, false, 5]);
    ok(RynBots._weaponReady(b, 5), 'that was their cooldown, not mine');
});

console.log('\nstructure damage and object health');
reset();
t('objects load at full health', () => {
    const b = mkBot(210);
    RynBots._onPacket(b, 'H', [[1, 300, 0, 0, 50, -1, 15, b.sid]]);
    eq(b.objects.get(1).health, 500, 'a fresh pit trap');
    eq(b.objects.get(1).maxHealth, 500);
});
t('a re-send of a tracked object does not heal it back to full', () => {
    reset();
    const b = mkBot(211);
    RynBots._onPacket(b, 'H', [[1, 300, 0, 0, 50, -1, 15, b.sid]]);
    b.objects.get(1).health = 60;
    RynBots._onPacket(b, 'H', [[1, 300, 0, 0, 50, -1, 15, b.sid]]);
    eq(b.objects.get(1).health, 60);
});
t('resources carry no health and are never damaged', () => {
    reset();
    const b = mkBot(212);
    RynBots._onPacket(b, 'H', [[1, 60, 0, 0, 50, 0, null, null]]);   // a tree
    eq(b.objects.get(1).health, undefined);
    b.x = 0; b.y = 0; b.dir = 0; b.weaponVariant = 0;
    RynBots._onPacket(b, 'K', [b.sid, true, 10]);
    eq(b.objects.get(1).health, undefined, 'still nothing to damage');
});
t('a landed hammer swing takes 75 off what is in the cone', () => {
    reset();
    const b = mkBot(213);
    b.x = 0; b.y = 0; b.dir = 0;
    RynBots._onPacket(b, 'H', [[1, 60, 0, 0, 50, -1, 15, b.sid]]);
    RynBots._onPacket(b, 'K', [b.sid, true, 10]);          // 10 dmg x 7.5 sDmg
    eq(b.objects.get(1).health, 425);
});
t('a swing that hit nothing costs the trap nothing', () => {
    reset();
    const b = mkBot(214);
    b.x = 0; b.y = 0; b.dir = 0;
    RynBots._onPacket(b, 'H', [[1, 60, 0, 0, 50, -1, 15, b.sid]]);
    RynBots._onPacket(b, 'K', [b.sid, false, 10]);
    eq(b.objects.get(1).health, 500);
});
t('behind me is out of the cone', () => {
    reset();
    const b = mkBot(215);
    b.x = 0; b.y = 0; b.dir = 0;                            // facing east
    RynBots._onPacket(b, 'H', [[1, -60, 0, 0, 50, -1, 15, b.sid]]);   // trap to the west
    RynBots._onPacket(b, 'K', [b.sid, true, 10]);
    eq(b.objects.get(1).health, 500);
});
t('out of range is out of reach', () => {
    reset();
    const b = mkBot(216);
    b.x = 0; b.y = 0; b.dir = 0;
    RynBots._onPacket(b, 'H', [[1, 400, 0, 0, 50, -1, 15, b.sid]]);   // hammer range 75
    RynBots._onPacket(b, 'K', [b.sid, true, 10]);
    eq(b.objects.get(1).health, 500);
});
t('a diamond hammer and tank gear scale the damage', () => {
    reset();
    const b = mkBot(217);
    b.weaponVariant = 2; b.skinIndex = 40;
    eq(Math.round(RynBots._structDmg(b, 10)), Math.round(10 * 7.5 * 1.18 * 3.3));
});

console.log('\nspike tick (the mod\'s trap tick)');
reset();
// The enemy stands in the bot's own trap, close enough that the placing ring
// reaches them. The trap is beaten down to where one hammer hit finishes it.
function tickSetup(opts) {
    opts = opts || {};
    const b = mkBot(220);
    b.x = 0; b.y = 0;
    b.weapons = [5, opts.sec === undefined ? 10 : opts.sec];
    b.itemsOwned = [0, 3, 6, 10];
    const ex = opts.ex === undefined ? 120 : opts.ex;
    b.players.set(99, { sid: 99, x: ex, y: 0, visible: true });
    b.objects.set(1, {
        sid: 1, x: ex, y: 0, scale: 50, type: -1, id: 15,
        owner: opts.trapOwner === undefined ? b.sid : opts.trapOwner,
        health: opts.hp === undefined ? 60 : opts.hp, maxHealth: 500
    });
    return { b, e: b.players.get(99) };
}
t('a charged hammer over a nearly-dead trap fires the tick', () => {
    const { b } = tickSetup();
    ok(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), 'expected a tick');
});
t('the packets are hammer-at-the-trap, then the spike, then the primary back', () => {
    reset();
    const { b } = tickSetup();
    sent.length = 0;
    RynBots._spikeTick(b, RynBots._nearestEnemy(b));
    const z = sent.filter(p => p.type === 'z').map(p => p.args[0]);
    eq(z[0], 10, 'hammer first');
    eq(z[1], 6, 'then the spike');
    eq(z[2], 5, 'then the primary back');
    const f = sent.filter(p => p.type === 'F');
    eq(f.length, 4, 'one swing for the trap, one for the placement');
    // the first swing points at the trap, due east
    ok(Math.abs(f[0].args[1]) < 0.01, 'hammer aimed at the trap, got ' + f[0].args[1]);
});
t('the trap is dropped from the world model the moment it is popped', () => {
    reset();
    const { b } = tickSetup();
    RynBots._spikeTick(b, RynBots._nearestEnemy(b));
    eq(b.objects.has(1), false);
});
t('a full-health trap is not tickable — the hammer cannot finish it', () => {
    reset();
    const { b } = tickSetup({ hp: 500 });
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('no hammer, no tick', () => {
    reset();
    const { b } = tickSetup({ sec: 9 });       // bow
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('a hammer still on cooldown waits', () => {
    reset();
    const { b } = tickSetup();
    b.readyAt[10] = Date.now() + 300;
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('a primary still on cooldown waits too', () => {
    reset();
    const { b } = tickSetup();
    b.readyAt[5] = Date.now() + 300;
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('someone else\'s trap is not mine to tick', () => {
    reset();
    const { b } = tickSetup({ trapOwner: 77 });
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('an enemy already bleeding on a spike is skipped', () => {
    reset();
    const { b } = tickSetup();
    b.objects.set(2, { sid: 2, x: 120, y: 40, scale: 50, type: -1, id: 6, owner: b.sid });
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('the toggle turns it off', () => {
    reset();
    const { b } = tickSetup();
    window.vars.botSpikeTick = false;
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('no spike owned, nothing to tick onto', () => {
    reset();
    const { b } = tickSetup();
    b.itemsOwned = [0, 3, 10];
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('a trap out past the placing ring is out of the play', () => {
    reset();
    const { b } = tickSetup({ ex: 600 });
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('the spike lands within reach of them', () => {
    reset();
    const { b } = tickSetup();
    sent.length = 0;
    RynBots._spikeTick(b, RynBots._nearestEnemy(b));
    const place = sent.filter(p => p.type === 'F')[2];   // the placing swing
    const a = place.args[1];
    const r = 35 + 52;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    ok(Math.hypot(px - 120, py) < 52 + 55, 'spike ' + Math.round(Math.hypot(px - 120, py)) + ' away from them');
});
t('the knockback is never aimed back at me', () => {
    reset();
    const { b } = tickSetup();
    sent.length = 0;
    RynBots._spikeTick(b, RynBots._nearestEnemy(b));
    const a = sent.filter(p => p.type === 'F')[2].args[1];
    const r = 35 + 52;
    const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
    const kb = Math.atan2(0 - sy, 120 - sx);            // spike -> enemy
    const toMe = Math.atan2(0 - 0, 0 - 120);            // enemy -> me
    ok(UTILS.getAngleDist(kb, toMe) >= Math.PI / 5, 'that shove would hand them the gap');
});
t('a point-blank enemy is not ticked onto the spike behind them', () => {
    reset();
    // Inside the placing ring: the spot nearest them sits past them, so its
    // knockback runs straight back at the bot. The mod refuses that spot, and
    // so does this — it takes a flanking one instead.
    const { b } = tickSetup({ ex: 40 });
    sent.length = 0;
    ok(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), 'should still find a spot');
    const a = sent.filter(p => p.type === 'F')[2].args[1];
    ok(Math.abs(a) > 0.3, 'took the spot straight past them, angle ' + a.toFixed(2));
    const r = 35 + 52;
    const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
    ok(UTILS.getAngleDist(Math.atan2(0 - sy, 40 - sx), Math.PI) >= Math.PI / 5);
});
t('the weapon variant reaches the bot from updatePlayers', () => {
    reset();
    const b = mkBot(230);
    RynBots._onPacket(b, 'a', [[b.sid, 0, 0, 0, -1, 10, 2, null, 0, 0, 0, 0, 0]]);
    eq(b.weaponVariant, 2);
    eq(Math.round(RynBots._structDmg(b, 10)), Math.round(10 * 7.5 * 1.18));
});
t('the tick does not fire twice in the same third of a second', () => {
    reset();
    const { b } = tickSetup();
    ok(RynBots._spikeTick(b, RynBots._nearestEnemy(b)));
    b.objects.set(1, { sid: 1, x: 120, y: 0, scale: 50, type: -1, id: 15,
                       owner: b.sid, health: 60, maxHealth: 500 });
    eq(RynBots._spikeTick(b, RynBots._nearestEnemy(b)), false);
});
t('a full tick keeps swinging on the next tick', () => {
    reset();
    const { b } = tickSetup();
    RynBots._spikeTick(b, RynBots._nearestEnemy(b));
    b.objects.clear();
    b.players.set(99, { sid: 99, x: 900, y: 0, visible: true });   // out of reach now
    window.vars.botSync = false;
    sent.length = 0;
    RynBots._botTick(b);
    eq(last('F').args[0], 1, 'should follow the tick up');
});

console.log('\nfull mod: what the bot engine still does, and what it hands over');
reset();
function fullBot(tag) {
    const b = mkBot(tag);
    b.x = 0; b.y = 0;
    b.weapons = [5, 10];
    window.vars.botFullMod = true;
    b.mod = { tick: 0 };                 // a context exists -> the mod is driving
    b.modSend = RynBots._makeModSend(b);
    return b;
}
t('the hand-ported combat stands down', () => {
    const b = fullBot(300);
    // A textbook trap tick sitting there: with the mod driving, the engine
    // must not fire its own.
    b.itemsOwned = [0, 3, 6, 10];
    b.players.set(99, { sid: 99, x: 120, y: 0, visible: true });
    b.objects.set(1, { sid: 1, x: 120, y: 0, scale: 50, type: -1, id: 15,
                       owner: b.sid, health: 60, maxHealth: 500 });
    sent.length = 0;
    RynBots._botTick(b);
    eq(sent.filter(p => p.type === 'z').length, 0, 'the engine placed something');
});
t('but it still walks the formation', () => {
    reset();
    const b = fullBot(301);
    myPlayer.x2 = 4000; myPlayer.y2 = 4000;
    sent.length = 0;
    RynBots._botTick(b);
    const mv = last('9');
    ok(mv && mv.args[0] !== null, 'the bot should still be told where to go');
});
t('a move the mod already sent wins', () => {
    reset();
    const b = fullBot(302);
    myPlayer.x2 = 4000; myPlayer.y2 = 4000;
    b.modMoved = true;                   // the mod dodged this tick
    sent.length = 0;
    RynBots._botTick(b);
    eq(sent.filter(p => p.type === '9').length, 0, 'the formation overrode a dodge');
});
t('sync still swings the bot when the mod did not decide', () => {
    reset();
    const b = fullBot(303);
    RynBots._syncUntil = Date.now() + 200;
    sent.length = 0;
    RynBots._botTick(b);
    const f = last('F');
    ok(f && f.args[0] === 1, 'sync should still reach a bot under full mod');
});
t('an attack the mod already decided is left alone', () => {
    reset();
    const b = fullBot(304);
    RynBots._syncUntil = Date.now() + 200;
    b.modAttacked = true;
    sent.length = 0;
    RynBots._botTick(b);
    eq(sent.filter(p => p.type === 'F').length, 0, 'sync fought the mod');
});
t('a ceasefire still silences it', () => {
    reset();
    const b = fullBot(305);
    RynBots.ceasefire = true;
    RynBots._syncUntil = Date.now() + 200;
    sent.length = 0;
    RynBots._botTick(b);
    eq(sent.filter(p => p.type === 'F').length, 0);
});
t('modSend turns io.send\'s positional arguments into a bot packet', () => {
    reset();
    const b = fullBot(306);
    sent.length = 0;
    b.modSend('z', 5, true);
    b.modSend('F', 1, 0.5);
    eq(sent[0].type, 'z');
    eq(JSON.stringify(sent[0].args), JSON.stringify([5, true]));
    eq(sent[1].type, 'F');
    eq(JSON.stringify(sent[1].args), JSON.stringify([1, 0.5]));
});
t('modSend records what the mod did, and never lets a bot chat', () => {
    reset();
    const b = fullBot(307);
    sent.length = 0;
    b.modSend('9', 1.2);
    eq(b.modMoved, true);
    b.modSend('F', 1, 0);
    eq(b.modAttacked, true);
    eq(b.attacking, true);
    b.modSend('6', 'hello');
    eq(sent.filter(p => p.type === '6').length, 0, 'a bot sent chat');
});
t('modSend counts packets so the mod\'s own rate limit still applies', () => {
    reset();
    const b = fullBot(308);
    for (let i = 0; i < 7; i++) b.modSend('D', 0);
    eq(b.pktCount, 7);
});
t('you are never a bot\'s enemy, whoever is asking', () => {
    reset();
    const b = mkBot(310);
    RynBots._mySid = myPlayer.sid;
    b.players.set(myPlayer.sid, { sid: myPlayer.sid, x: 10, y: 0, visible: true });
    eq(RynBots._friendlySid(myPlayer.sid), true);
    eq(RynBots._nearestEnemy(b), null, 'it targeted you');
});

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
