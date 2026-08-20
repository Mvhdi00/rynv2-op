// Tests for the mod-context swap in novastorm_1.5.user.js.
//
//   node tools/test-mod-context.js [path/to/novastorm_1.5.user.js]
//
// Full Mod works by handing the mod's module-scope singletons to a bot, running
// the mod's own tick, and handing yours back. The whole thing rests on one
// property: after ctxRun returns, every one of those singletons must hold
// exactly what it held before, and the bot must have kept what the tick changed.
// A single key missing from the list would be a silent leak between your player
// and a bot — which is precisely the failure that made the "swap the globals"
// approach look unsafe in the first place — so it is asserted here key by key.
//
// The block is lifted out of the shipped userscript, so this always runs against
// what actually ships.
const fs = require('fs');

const SCRIPT = process.argv[2] || (__dirname + '/../novastorm_1.5.user.js');
const src = fs.readFileSync(SCRIPT, 'utf8');
const lines = src.split('\n');

const from = lines.findIndex(l => l.trim().startsWith('const MOD_CTX_KEYS = ['));
const to = lines.findIndex(l => l.startsWith('        function updatePlayers(data) {'));
if (from < 0 || to < 0 || to <= from) {
    console.error('could not find the context block in ' + SCRIPT);
    process.exit(2);
}
const BLOCK = lines.slice(from, to).join('\n');

// The key list is the block's own first statement, so read it from there rather
// than keeping a second copy that could drift.
const KEYS = JSON.parse(BLOCK.slice(BLOCK.indexOf('['), BLOCK.indexOf('];') + 1));

// ------------------------------------------------------------------ harness
// Every key gets a distinctive starting value so a leak is visible, and the
// shapes match the real ones closely enough that ctxFresh's per-type reset is
// exercised: arrays, Maps, plain objects, numbers, booleans, null.
const SHAPES = {};
KEYS.forEach((k, i) => {
    const m = i % 6;
    SHAPES[k] = m === 0 ? ['master:' + k]
        : m === 1 ? new Map([['master', k]])
        : m === 2 ? { master: k }
        : m === 3 ? 1000 + i
        : m === 4 ? true
        : { master: k, isPlayer: true };
});
// A few need to be the real kind of thing the swap replaces.
['players', 'ais', 'gameObjects', 'projectiles', 'alliances', 'predictObjects',
 'visibleObjects'].forEach(k => { if (KEYS.includes(k)) SHAPES[k] = ['master:' + k]; });
['bannedAngles'].forEach(k => { if (KEYS.includes(k)) SHAPES[k] = new Map(); });
['myPlayer', 'objectManager', 'aiManager', 'projectileManager'].forEach(k => {
    if (KEYS.includes(k)) SHAPES[k] = { master: k };
});
['keys'].forEach(k => { if (KEYS.includes(k)) SHAPES[k] = { 87: true }; });
['tick', 'packets', 'attackState', 'mouseX', 'mouseY'].forEach(k => {
    if (KEYS.includes(k)) SHAPES[k] = 7;
});

const decls = KEYS.map(k => 'let ' + k + ' = SHAPES[' + JSON.stringify(k) + '];').join('\n');

const sent = [];
const io = { send: function () { sent.push(['master'].concat([].slice.call(arguments))); } };
let botViewSelf = null, botViewFor = null;
const botWorlds = new Map();
function botWorldSelect(bot) {
    botViewFor = bot;
    botViewSelf = botWorlds.get(bot).self;
    return botWorlds.get(bot);
}
const timers = [];
function setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; }
function runTimers() { const t = timers.splice(0); t.forEach(x => x.fn()); }

const ctx = eval('(function () {\n' + decls + '\n' + BLOCK +
    '\nreturn { ctxCapture, ctxRestore, ctxFresh, ctxRun, ctxDefer, inBotCtx,' +
    '  peek: (k) => eval(k), poke: (k, v) => { eval(k + " = v"); } };\n})()');

function mkWorld(tag) {
    const w = {
        objects: ['obj:' + tag], ais: ['ai:' + tag], players: ['ply:' + tag],
        projectiles: ['prj:' + tag],
        objectManager: { tag }, aiManager: { tag }, projectileManager: { tag },
        self: { sid: tag, isPlayer: true }
    };
    return w;
}
function mkBot(tag) {
    const w = mkWorld(tag);
    const bot = { tag, alive: true, ws: { readyState: 1 }, mod: null };
    botWorlds.set(bot, w);
    bot.mod = ctx.ctxFresh(w);
    bot.modSend = function () { sent.push([tag].concat([].slice.call(arguments))); };
    return bot;
}

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('  ok   ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + ' -> ' + e.message); fail++; }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function ok(v, m) { if (!v) throw new Error(m || 'expected truthy'); }

// ------------------------------------------------------------------- tests
console.log('the key list');
t('every key is listed once', () => {
    eq(new Set(KEYS).size, KEYS.length, 'duplicate key');
    ok(KEYS.length > 100, 'suspiciously short list: ' + KEYS.length);
});
t('the singletons the mod actually reads are all in it', () => {
    for (const k of ['myPlayer', 'players', 'gameObjects', 'ais', 'projectiles',
                     'objectManager', 'visibleObjects', 'enemiesNear', 'nearestEnemy',
                     'primaryReload', 'secondaryReload', 'turretReload', 'predictObjects',
                     'packets', 'tick', 'imTrapped', 'spikes_our', 'traps_our',
                     'bannedAngles', 'keys', 'attackState']) {
        ok(KEYS.includes(k), k + ' is missing from MOD_CTX_KEYS');
    }
});

console.log('\ncapture and restore');
t('a capture round-trips every key by identity', () => {
    const s = ctx.ctxCapture();
    for (const k of KEYS) eq(s[k], ctx.peek(k), k);
    ctx.ctxRestore(s);
    for (const k of KEYS) eq(ctx.peek(k), SHAPES[k], k + ' after restore');
});

console.log('\na fresh context starts clean and points at the bot\'s world');
t('arrays, maps, objects, numbers and booleans all reset', () => {
    const w = mkWorld('w1');
    const f = ctx.ctxFresh(w);
    for (const k of KEYS) {
        const v = f[k], o = SHAPES[k];
        if (['myPlayer', 'myPlayerSID', 'players', 'ais', 'gameObjects', 'projectiles',
             'alliances', 'objectManager', 'aiManager', 'projectileManager',
             'keys', 'attackState'].includes(k)) continue;
        if (Array.isArray(o)) { ok(Array.isArray(v) && v.length === 0, k + ' should be []'); }
        else if (o instanceof Map) { ok(v instanceof Map && v.size === 0, k + ' should be an empty Map'); }
        else if (typeof o === 'number') eq(v, 0, k);
        else if (typeof o === 'boolean') eq(v, false, k);
    }
});
t('the world pointers are the bot\'s, not yours', () => {
    const w = mkWorld('w2');
    const f = ctx.ctxFresh(w);
    eq(f.myPlayer, w.self);
    eq(f.myPlayerSID, 'w2');
    eq(f.players, w.players);
    eq(f.ais, w.ais);
    eq(f.gameObjects, w.objects);
    eq(f.projectiles, w.projectiles);
    eq(f.objectManager, w.objectManager);
    eq(f.aiManager, w.aiManager);
    eq(f.projectileManager, w.projectileManager);
});
t('no hands on the keyboard', () => {
    const f = ctx.ctxFresh(mkWorld('w3'));
    eq(Object.keys(f.keys).length, 0, 'a held key would jam forever');
    eq(f.attackState, 0);
});
t('plain objects are copied, not shared with yours', () => {
    const f = ctx.ctxFresh(mkWorld('w4'));
    const k = KEYS.find(x => SHAPES[x] && SHAPES[x].constructor === Object &&
                             !['myPlayer', 'objectManager', 'aiManager', 'projectileManager', 'keys'].includes(x));
    ok(f[k] !== SHAPES[k], k + ' is the same object as yours');
});

console.log('\nrunning as a bot');
t('the tick sees the bot\'s world, not yours', () => {
    const bot = mkBot('b1');
    let seen = null;
    ctx.ctxRun(bot, function () { seen = { my: ctx.peek('myPlayer'), objs: ctx.peek('gameObjects') }; return true; });
    eq(seen.my.sid, 'b1');
    eq(seen.objs[0], 'obj:b1');
});
t('not one key leaks back into yours', () => {
    const bot = mkBot('b2');
    ctx.ctxRun(bot, function () {
        for (const k of KEYS) ctx.poke(k, 'TOUCHED_BY_BOT');
        return true;
    });
    for (const k of KEYS) {
        ok(ctx.peek(k) !== 'TOUCHED_BY_BOT', k + ' leaked out of the bot context');
        eq(ctx.peek(k), SHAPES[k], k + ' was not restored');
    }
});
t('what the tick changed stays with the bot', () => {
    const bot = mkBot('b3');
    ctx.ctxRun(bot, function () { ctx.poke('tick', 41); ctx.poke('packets', 5); return true; });
    eq(bot.mod.tick, 41);
    eq(bot.mod.packets, 5);
    ctx.ctxRun(bot, function () { ctx.poke('tick', ctx.peek('tick') + 1); return true; });
    eq(bot.mod.tick, 42, 'the bot should carry its own tick counter forward');
});
t('two bots never see each other\'s state', () => {
    const a = mkBot('b4'), b = mkBot('b5');
    ctx.ctxRun(a, function () { ctx.poke('tick', 100); return true; });
    ctx.ctxRun(b, function () { ctx.poke('tick', 200); return true; });
    eq(a.mod.tick, 100);
    eq(b.mod.tick, 200);
    let seen;
    ctx.ctxRun(a, function () { seen = ctx.peek('tick'); return true; });
    eq(seen, 100);
});
t('a throw inside the tick still restores everything', () => {
    const bot = mkBot('b6');
    ctx.ctxRun(bot, function () { ctx.poke('tick', 9); throw new Error('boom'); });
    for (const k of KEYS) eq(ctx.peek(k), SHAPES[k], k + ' was not restored after a throw');
    eq(bot.mod.tick, 9, 'and the bot keeps what it got as far as it got');
});
t('io.send goes to the bot\'s socket while it runs, and yours after', () => {
    const bot = mkBot('b7');
    sent.length = 0;
    ctx.ctxRun(bot, function () { io.send('z', 5, true); return true; });
    io.send('z', 9, true);
    eq(sent.length, 2);
    eq(sent[0][0], 'b7', 'the bot\'s packet went to the wrong socket');
    eq(sent[0][2], 5);
    eq(sent[1][0], 'master', 'your packet went to a bot');
});
t('inBotCtx is true only inside', () => {
    const bot = mkBot('b8');
    eq(ctx.inBotCtx(), false);
    let inside = null;
    ctx.ctxRun(bot, function () { inside = ctx.inBotCtx(); return true; });
    eq(inside, true);
    eq(ctx.inBotCtx(), false);
});
t('a bot with no context is refused rather than run as you', () => {
    const bot = mkBot('b9');
    bot.mod = null;
    eq(ctx.ctxRun(bot, () => true), false);
});

console.log('\ndeferred work re-enters the bot that scheduled it');
t('a timeout scheduled inside a bot runs inside that bot', () => {
    const bot = mkBot('c1');
    sent.length = 0;
    ctx.ctxRun(bot, function () {
        ctx.ctxDefer(function () { io.send('F', 1, 0); }, 1);
        return true;
    });
    eq(sent.length, 0, 'nothing should have gone out yet');
    runTimers();
    eq(sent.length, 1);
    eq(sent[0][0], 'c1', 'the pre-placer fired on the wrong socket');
});
t('the timeout body sees the bot\'s state, not yours', () => {
    const bot = mkBot('c2');
    ctx.ctxRun(bot, function () {
        ctx.poke('tick', 55);
        ctx.ctxDefer(function () { ctx.poke('placeTick', ctx.peek('tick')); }, 1);
        return true;
    });
    runTimers();
    eq(bot.mod.placeTick, 55);
    eq(ctx.peek('placeTick'), SHAPES.placeTick, 'yours was written to');
});
t('a timeout for a bot that died before it fired is dropped', () => {
    const bot = mkBot('c3');
    sent.length = 0;
    ctx.ctxRun(bot, function () { ctx.ctxDefer(function () { io.send('F', 1, 0); }, 1); return true; });
    bot.alive = false;
    runTimers();
    eq(sent.length, 0, 'a dead bot placed a building');
});
t('a timeout on a closed socket is dropped too', () => {
    const bot = mkBot('c4');
    sent.length = 0;
    ctx.ctxRun(bot, function () { ctx.ctxDefer(function () { io.send('F', 1, 0); }, 1); return true; });
    bot.ws.readyState = 3;
    runTimers();
    eq(sent.length, 0);
});
t('outside a bot, ctxDefer is a plain timeout', () => {
    sent.length = 0;
    ctx.ctxDefer(function () { io.send('F', 1, 0); }, 1);
    runTimers();
    eq(sent.length, 1);
    eq(sent[0][0], 'master');
});

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
