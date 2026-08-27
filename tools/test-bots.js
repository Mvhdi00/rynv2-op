#!/usr/bin/env node
// Logic check for the BOTS — CONNECTION block in novastorm_1.4_ryn.user.js.
//
// The block is lifted out of the userscript by text and run against stub
// globals: a fake WebSocket that records what was sent, a fake EXP that frames
// nothing, and a fake Turnstile. What is exercised is the connection flow -
// token choice, URL, handshake, entering, holding, death, cleanup - not the
// game itself.
//
//   node tools/test-bots.js

const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'novastorm_1.4_ryn.user.js');
const src = fs.readFileSync(SCRIPT, 'utf8');

const start = src.indexOf('        const NOVABOT_SITEKEY');
const end = src.indexOf('        window.NovaBots = NovaBots;');
if (start < 0 || end < 0) throw new Error('bots block not found');

// the per-bot world comes along: a bot is given one the moment it connects
const worldStart = src.indexOf('        function NovaBotWorld(bot) {');
if (worldStart < 0) throw new Error('bot world block not found');
const block = src.slice(worldStart, start) + src.slice(start, end);

let failed = 0;
function check(name, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
}

// --- stubs ------------------------------------------------------------------
const sent = [];          // [socketName, type, args]
const sockets = [];

class FakeSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 1;          // pretend the socket opens at once
        this.listeners = {};
        this.closed = false;
        sockets.push(this);
    }
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    fire(type, ev) { (this.listeners[type] || []).forEach(fn => fn(ev)); }
    close() { this.closed = true; this.readyState = 3; this.fire('close', { code: 1000, reason: 'test' }); }
}

// what the game would hand back on each incoming packet
let incoming = new Map();          // socket -> parsed message queue

const EXP = {
    token: () => tokenState.captured,
    send: (sock, type, args) => { sent.push([sock.url, type, args]); return true; },
    // the test hands messages in as { type, args }; decode turns that into the
    // [type, args] array the real EXP.decode yields (string opcode = already
    // translated), and receive is the raw-number fallback path
    decode: (raw) => (raw && raw.type !== undefined) ? [raw.type, raw.args || []] : raw,
    receive: (sock, raw) => (raw && raw.type !== undefined) ? { type: raw.type, args: raw.args || [] } : null
};

const tokenState = { captured: null, widget: null, renderFails: false };

const turnstile = {
    render(holder, opts) {
        if (tokenState.renderFails) throw new Error('no widget');
        tokenState.widget = opts;
        if (tokenState.widgetToken !== undefined) {
            setTimeout(() => opts.callback(tokenState.widgetToken), 0);
        }
        return 1;
    },
    remove() {}
};

const elements = [];
const doc = {
    createElement: () => {
        const el = { style: {}, remove() {} };
        elements.push(el);
        return el;
    },
    body: { appendChild: () => {} },
    documentElement: { appendChild: () => {} }
};

const win = {
    vars: {
        botName: 'nova', botCount: 3, botHold: false, botAutospawn: true,
        botFollow: true, botFollowCursor: false, botFormation: 'none',
        botRadius: 150, botStopRadius: 50, botCircleRotate: false,
        botFreeze: false, botLock: false, botScatter: false,
        botAutoHeal: true, botAttackPrimary: false, botAttackSecondary: false,
        botAutoAccept: true, botAutoBreak: false,
        botScan: false, botScanTarget: '', botSafeWalk: false
    },
    turnstile,
    OriginalWebSocket: FakeSocket,
    top: null
};

let players = [];
let myPlayer = { sid: 99, x2: 1000, y2: 1000 };
let wsAddress = 'wss://sfo-1.moomoo.io:8008/?token=cf:masterToken';

// the game globals the behaviour layer reaches for
const UTILS = {
    getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    toRad: (d) => d * Math.PI / 180,
    // novastorm's own lineInRect (axis-aligned segment/box overlap)
    lineInRect: (recX, recY, recX2, recY2, x1, y1, x2, y2) => {
        let minX = x1, maxX = x2;
        if (x1 > x2) { minX = x2; maxX = x1; }
        if (maxX > recX2) maxX = recX2;
        if (minX < recX) minX = recX;
        if (minX > maxX) return false;
        let minY = y1, maxY = y2;
        const dx = x2 - x1;
        if (Math.abs(dx) > 0.0000001) {
            const a = (y2 - y1) / dx, b = y1 - a * x1;
            minY = a * minX + b; maxY = a * maxX + b;
        }
        if (minY > maxY) { const t = maxY; maxY = minY; minY = t; }
        if (maxY > recY2) maxY = recY2;
        if (minY < recY) minY = recY;
        if (minY > maxY) return false;
        return true;
    }
};
const items = { list: [] };
items.list[0] = { name: 'apple', heal: 20 };                        // the food slot
items.list[10] = { name: 'windmill', scale: 45, placeOffset: 5 };   // the mill slot

// movement-layer globals the master publishes
const gameGlobals = {
    tick: 0,
    lastMoveAngle: null,
    mouseX: 0, mouseY: 0,
    screenWidth: 1920, screenHeight: 1080,
    maxScreenWidth: 1920, maxScreenHeight: 1080,
    getAttackDir: () => 0
};

const factory = new Function(
    'EXP', 'window', 'document', 'players', 'myPlayer', 'wsAddress', 'io', 'URL', 'console',
    'UTILS', 'items', 'setAutoMills', 'G', 'peek',
    `let autoMills = false;
     setAutoMills.set = (v) => { autoMills = v; };
     let tick, lastMoveAngle, mouseX, mouseY, screenWidth, screenHeight, maxScreenWidth, maxScreenHeight, getAttackDir;
     // the per-player globals the context runner swaps
     let visibleObjects = [], predictWeapon = 0, nearestEnemy = null, enemiesNear = [];
     let primaryReload = [], secondaryReload = [], turretReload = [];
     let autoaim = false, autoaimAngle = null;
     G.sync = () => { ({ tick, lastMoveAngle, mouseX, mouseY, screenWidth, screenHeight, maxScreenWidth, maxScreenHeight, getAttackDir } = G); };
     G.sync();
     // lets the test read whatever the globals are at any moment (e.g. inside withBot)
     peek.read = () => ({ myPlayer, io, visibleObjects, predictWeapon, nearestEnemy, enemiesNear, primaryReload, autoaim });

     // the master's real place / heal path, verbatim from novastorm, so
     // _autoHeal exercises the actual reuse (io + myPlayer + predictWeapon)
     function selectToBuild(index) { io.send("z", index, false); }
     function selectWeapon(index) { io.send("z", index, true); }
     function sendAtck(id, angle) { io.send("F", id, angle); }
     function place(id, angle) {
       selectToBuild(id);
       sendAtck(1, angle);
       sendAtck(0, angle);
       selectWeapon(predictWeapon);
     }
     function heal(value) {
       for (let i = 0; i < value; i += items.list[myPlayer.items[0]].heal) {
         place(myPlayer.items[0], null);
       }
     }
     // scan reaches for the master's map ping and the map size
     const config = { mapScale: 14400 };
     function pingMap(x, y) { peek.pinged = { x, y }; }
     ${block}
     return NovaBots;`
);

const autoMillsCtl = () => {};
const peekCtl = () => {};
const NovaBots = factory(EXP, win, doc, players, myPlayer, wsAddress, null, URL, { log() {}, warn() {} }, UTILS, items, autoMillsCtl, gameGlobals, peekCtl);
const setAutoMills = (v) => autoMillsCtl.set(v);
const syncGlobals = () => gameGlobals.sync();
const peek = () => peekCtl.read();

// --- token choice -----------------------------------------------------------
console.log('-- token --');

tokenState.widgetToken = 'freshOne';
NovaBots._token().then(t => {
    check('a widget token is used when one comes back', t, 'cf:freshOne');
    check('the widget is rendered without asking for a click', tokenState.widget.appearance, 'interaction-only');
    check('the widget uses the game sitekey', tokenState.widget.sitekey, '0x4AAAAAAAMYHI96GFiJzMmp');
    return runFallback();
}).then(runFlow).then(() => {
    console.log(failed ? `\n${failed} failing case(s)` : '\nall cases pass');
    process.exit(failed ? 1 : 0);
});

function runFallback() {
    console.log('\n-- fallback --');
    tokenState.renderFails = true;
    tokenState.captured = 'cf:masterToken';
    return NovaBots._token().then(t => {
        check("the master's captured token is the fallback", t, 'cf:masterToken');
        tokenState.captured = null;
        return NovaBots._token();
    }).then(t => {
        check('no token at all is reported as none', t, null);
        tokenState.renderFails = false;
        tokenState.widgetToken = 'perBot';
        tokenState.captured = 'cf:masterToken';
    });
}

// --- connection flow --------------------------------------------------------
async function runFlow() {
    console.log('\n-- connecting --');

    check('the bot connects to the master server with its own token',
          NovaBots._url('cf:perBot'), 'wss://sfo-1.moomoo.io:8008/?token=cf%3AperBot');

    // _connect only settles on io-init, so the handshake is fired while it waits
    const connecting = NovaBots._connect('nova1');
    await new Promise(r => setTimeout(r, 5));      // let the token promise settle

    const sock = sockets[sockets.length - 1];
    check('a socket was opened', typeof sock.url, 'string');

    // the handshake
    sock.fire('message', { data: { type: 'io-init', args: [1] } });
    const bot = await connecting;
    check('connect resolves once the handshake lands', bot.name, 'nova1');
    const types = sent.filter(s => s[0] === sock.url).map(s => s[1]);
    check('the handshake is answered with a ping and the spawn packet', types, ['0', 'M']);

    const spawn = sent.find(s => s[1] === 'M');
    check('the spawn packet carries the bot name', spawn[2][0].name, 'nova1');
    check('the bot is marked connected', [bot.ready, bot.held], [true, false]);

    // entering the world
    sock.fire('message', { data: { type: 'C', args: [1234] } });
    check('"C" gives the bot its sid', [bot.sid, bot.inGame], [1234, true]);
    const st = NovaBots.status();
    check('status counts it', [st.connected, st.inGame, st.held], [1, 1, 0]);
    check('status reports what the bot can see', st.views[0].name, 'nova1');

    // the master's player list is read for its position
    players.push({ name: 'nova1', sid: 1234, x2: 500, y2: 600, team: 'RYN' });
    NovaBots.tick();
    check('the position comes off the master player list', [bot.x, bot.y, bot.team], [500, 600, 'RYN']);

    // ... until the bot's own stream arrives, which then takes over
    sock.fire('message', { data: { type: 'a', args: [[
        1234, 800, 900, 0, -1, 0, 0, 'RYN', 0, 0, 0, 0, 0,
        4321, 850, 900, 0, -1, 5, 2, null, 0, 0, 0, 0, 0
    ]] } });
    check('the socket feeds the bot its own world', bot.world.players.size, 2);
    NovaBots.tick();
    check('its own view wins over the master list', [bot.x, bot.y], [800, 900]);
    check('it sees an enemy the master never reported', bot.world.nearestEnemy().sid, 4321);

    sock.fire('message', { data: { type: 'H', args: [[77, 810, 900, 0, 50, 0, -1, -1]] } });
    check('objects reach the bot world too', bot.world.resourcesNear(0, 400).length, 1);

    // --- auto mills, per bot, on the master's own toggle --------------------
    console.log('\n-- auto mills --');
    bot.world.objects.clear();          // clear ground around the bot
    bot.world.self.dir = 0;
    bot.world.self.weaponIndex = 0;

    sent.length = 0;
    NovaBots.tick();
    check('mills are not placed while the toggle is off', sent.filter(s => s[1] === 'F').length, 0);

    setAutoMills(true);
    sent.length = 0;
    NovaBots.tick();
    const millTypes = sent.map(s => s[1]);
    check('the toggle makes the bot build', millTypes.includes('z') && millTypes.includes('F'), true);
    const placed = sent.filter(s => s[1] === 'F' && s[2][0] === 1).map(s => Math.round(s[2][1] * 100) / 100);
    check('it fans three mills behind its facing', placed.length, 3);
    check('the fan is centred behind the bot (dir + 180)', placed.includes(Math.round(Math.PI * 100) / 100), true);
    check('it returns to its weapon afterwards', sent[sent.length - 1].slice(1), ['z', [0, true]]);

    // a mill already sitting in a slot blocks that slot
    const spread = (45 + 45 / 2) * Math.PI / 180;
    const reach = 35 + 45 + 5;
    const blockAngle = Math.PI;
    bot.world.objects.set(500, {
        sid: 500, scale: 45, owner: bot.world.self.sid,
        x: bot.world.self.x + reach * Math.cos(blockAngle),
        y: bot.world.self.y + reach * Math.sin(blockAngle)
    });
    sent.length = 0;
    NovaBots.tick();
    const placed2 = sent.filter(s => s[1] === 'F' && s[2][0] === 1);
    check('a filled slot is skipped', placed2.length, 2);

    setAutoMills(false);

    // --- movement & formations, per bot ------------------------------------
    console.log('\n-- movement --');
    // the bot at (800,900), master at (1000,1000)
    bot.world.self.x = 800; bot.world.self.y = 900;
    bot._lastMoveAngle = undefined;
    syncGlobals();

    sent.length = 0;
    NovaBots.tick();
    let mv = sent.find(s => s[1] === '9');
    const expectAngle = Math.atan2(1000 - 900, 1000 - 800);
    check('follow walks the bot toward the master', Math.round(mv[2][0] * 100), Math.round(expectAngle * 100));

    // inside the stop radius it holds still (null heading)
    bot.world.self.x = 980; bot.world.self.y = 990;
    bot._lastMoveAngle = undefined;
    sent.length = 0;
    NovaBots.tick();
    mv = sent.find(s => s[1] === '9');
    check('inside stop radius it stops', mv[2][0], null);

    // freeze overrides everything
    win.vars.botFreeze = true;
    bot.world.self.x = 500; bot.world.self.y = 500;
    bot._lastMoveAngle = undefined;
    sent.length = 0;
    NovaBots.tick();
    mv = sent.find(s => s[1] === '9');
    check('freeze sends a stop', mv[2][0], null);
    win.vars.botFreeze = false;

    // lock holds the spot where it was switched on
    win.vars.botLock = true;
    bot.world.self.x = 500; bot.world.self.y = 500;
    bot._lastMoveAngle = undefined;
    NovaBots.tick();                       // lock captured here at (500,500)
    bot.world.self.x = 700; bot.world.self.y = 500;   // shoved away
    bot._lastMoveAngle = undefined;
    sent.length = 0;
    NovaBots.tick();
    mv = sent.find(s => s[1] === '9');
    check('lock walks back toward the locked spot', Math.round(mv[2][0] * 100), Math.round(Math.PI * 100));
    win.vars.botLock = false;
    NovaBots._lockPos = null;

    // a circle formation puts the single bot on the ring, not on the master
    win.vars.botFormation = 'circle';
    win.vars.botRadius = 200;
    bot.world.self.x = 800; bot.world.self.y = 800;
    bot._lastMoveAngle = undefined;
    sent.length = 0;
    NovaBots.tick();
    mv = sent.find(s => s[1] === '9');
    // one bot, index 0 -> slot angle 0 -> target is master + (radius, 0)
    const target = { x: 1000 + 200, y: 1000 };
    const wantAngle = Math.atan2(target.y - 800, target.x - 800);
    check('a formation sends the bot to its slot, not the master', Math.round(mv[2][0] * 100), Math.round(wantAngle * 100));
    win.vars.botFormation = 'none';

    // scatter picks a heading and moves
    win.vars.botScatter = true;
    bot._lastMoveAngle = undefined;
    sent.length = 0;
    NovaBots.tick();
    mv = sent.find(s => s[1] === '9');
    check('scatter sends some heading', typeof mv[2][0], 'number');
    win.vars.botScatter = false;

    // death and respawn
    sent.length = 0;
    sock.fire('message', { data: { type: 'P', args: [] } });
    check('"P" marks the bot dead', [bot.inGame, bot.sid], [false, null]);

    bot.deadAt = Date.now() - 2000;            // pretend the wait has passed
    NovaBots.tick();
    check('autospawn sends a new spawn packet', sent.map(s => s[1]), ['M']);

    sent.length = 0;
    win.vars.botAutospawn = false;
    bot.inGame = false;
    bot.deadAt = Date.now() - 2000;
    NovaBots.tick();
    check('autospawn off leaves the bot down', sent.length, 0);
    win.vars.botAutospawn = true;

    // --- auto accept (clan join, staggered) --------------------------------
    console.log('\n-- auto accept --');
    bot.inGame = true;
    bot.world.self.sid = 1234;
    bot.world.self.team = null;              // bot has no clan
    myPlayer.team = 'CLAN';                   // master is in one
    NovaBots._lastClanJoin = 0;
    sent.length = 0;
    NovaBots.tick();
    check('a clanless bot asks to join the master clan', sent.find(s => s[1] === 'b')[2], ['CLAN']);

    // a second bot the same tick does not also ask (1.5s stagger)
    sent.length = 0;
    NovaBots.tick();
    check('no second join within 1.5s', sent.filter(s => s[1] === 'b').length, 0);

    bot.world.self.team = 'CLAN';            // now in the clan
    sent.length = 0;
    NovaBots.tick();
    check('a bot already in the clan does not ask', sent.filter(s => s[1] === 'b').length, 0);
    myPlayer.team = null;
    bot.world.self.team = null;

    // hold and release
    console.log('\n-- hold / release --');
    win.vars.botHold = true;
    const holding = NovaBots._connect('nova2');
    await new Promise(r => setTimeout(r, 5));
    const heldSock = sockets[sockets.length - 1];
    sent.length = 0;
    heldSock.fire('message', { data: { type: 'io-init', args: [1] } });
    await holding;
    check('a held bot pings but does not enter', sent.map(s => s[1]), ['0']);
    check('it is counted as held', NovaBots.status().held, 1);

    NovaBots.releaseAll();
    check('release sends its spawn packet', sent.map(s => s[1]), ['0', 'M']);
    check('nothing is held afterwards', NovaBots.status().held, 0);
    win.vars.botHold = false;

    // --- the context runner: "everyone is a master" ------------------------
    console.log('\n-- context runner --');
    const realConnect = NovaBots._connect('ctx1');
    await new Promise(r => setTimeout(r, 5));
    const cs = sockets[sockets.length - 1];
    cs.fire('message', { data: { type: 'io-init', args: [1] } });
    const b = await realConnect;
    cs.fire('message', { data: { type: 'C', args: [7] } });
    cs.fire('message', { data: { type: 'a', args: [[
        7, 200, 200, 0, -1, 5, 2, 'T', 0, 0, 0, 0, 0,
        8, 260, 200, 0, -1, 0, 0, null, 0, 0, 0, 0, 0
    ]] } });
    cs.fire('message', { data: { type: 'H', args: [[90, 220, 200, 0, 50, 0, -1, -1]] } });

    // capture what the globals look like INSIDE the runner
    const before = peek();
    let inside = null;
    let sentInside = null;
    NovaBots.withBot(b, () => {
        inside = peek();
        inside.io.send('9', 1.23);          // a feature would send like this
        sentInside = sent[sent.length - 1];
    });
    const after = peek();

    check('inside, myPlayer IS the bot', inside.myPlayer === b.world.self, true);
    check('inside, nearestEnemy is what the bot sees', inside.nearestEnemy.sid, 8);
    check('inside, the object list has the bot ground', inside.visibleObjects.length, 1);
    check('inside, the objects wear the master shape', typeof inside.visibleObjects[0].getScale, 'function');
    check('inside, io.send routes to the bot socket', [sentInside[0], sentInside[1]], [cs.url, '9']);
    check('inside, the bot reads as reloaded', inside.primaryReload[7], 1);

    check('afterward, myPlayer is the master again', after.myPlayer === myPlayer, true);
    check('afterward, nearestEnemy is restored', after.nearestEnemy, before.nearestEnemy);
    check('afterward, io is restored', after.io, before.io);

    // even if the feature throws, the globals are put back
    try { NovaBots.withBot(b, () => { throw new Error('boom'); }); } catch (e) {}
    const afterThrow = peek();
    check('a throw inside still restores the master', afterThrow.myPlayer === myPlayer, true);

    // --- auto heal: the master's real heal() routed onto a bot --------------
    console.log('\n-- auto heal (routed) --');
    b.world.self.health = 60;           // hurt, missing 40; apple heals 20 -> two places
    b.world.self.maxHealth = 100;
    sent.length = 0;
    NovaBots._autoHeal(b);
    const foods = sent.filter(s => s[0] === cs.url && s[1] === 'z' && s[2][0] === 0 && s[2][1] === false);
    check('auto heal spends food on the bot socket', foods.length, 2);
    check('the heal packets are framed for the bot, not the master',
          sent.every(s => s[0] === cs.url), true);
    check('afterward the master globals are back', peek().myPlayer === myPlayer, true);

    b.world.self.health = 100;
    sent.length = 0;
    NovaBots._autoHeal(b);
    check('a full-health bot does not heal', sent.length, 0);

    win.vars.botAutoHeal = false;
    b.world.self.health = 50;
    sent.length = 0;
    NovaBots._autoHeal(b);
    check('the toggle off stops healing', sent.length, 0);
    win.vars.botAutoHeal = true;

    // --- attack buttons ----------------------------------------------------
    console.log('\n-- attack --');
    b.world.self.x2 = 200; b.world.self.y2 = 200; b.world.self.dir = 0;
    // an enemy at (260,200) is already in the bot's world from earlier
    sent.length = 0;
    NovaBots._attack(b);
    check('idle bot does not attack', sent.length, 0);

    win.vars.botAttackPrimary = true;
    sent.length = 0;
    NovaBots._attack(b);
    const atkTypes = sent.filter(s => s[0] === cs.url).map(s => s[1]);
    check("primary attack equips, faces and swings", atkTypes, ['z', 'D', 'F']);
    check('it equips the primary weapon (0)', sent.find(s => s[1] === 'z')[2][0], 0);
    check('it aims at the nearest enemy', Math.round(sent.find(s => s[1] === 'D')[2][0] * 100), 0);
    check('the swing is held down (F 1)', sent.find(s => s[1] === 'F')[2][0], 1);

    win.vars.botAttackSecondary = true;
    sent.length = 0;
    NovaBots._attack(b);
    check('secondary wins when both are on (weapon 1)', sent.find(s => s[1] === 'z')[2][0], 1);
    win.vars.botAttackSecondary = false;

    win.vars.botAttackPrimary = false;
    sent.length = 0;
    NovaBots._attack(b);
    check('turning off sends one stop (F 0)', sent.filter(s => s[1] === 'F').map(s => s[2][0]), [0]);
    sent.length = 0;
    NovaBots._attack(b);
    check('and then stays quiet', sent.length, 0);

    // --- auto break --------------------------------------------------------
    console.log('\n-- auto break --');
    win.vars.botAutoBreak = true;
    b.world.self.x2 = 500; b.world.self.y2 = 500; b.world.self.scale = 35;
    b.world.objects.clear();
    // a wall (id 3) right in front, to the +x, plus a tree (resource) beside it
    b.world.objects.set(1, { sid: 1, x: 560, y: 500, scale: 25, id: 3, owner: 8 });
    b.world.objects.set(2, { sid: 2, x: 560, y: 560, scale: 50, id: 0, owner: -1 }); // tree
    b._wantMove = 0;          // heading +x, into the wall
    b._stuck = 0; b._lastBX = 500; b._lastBY = 500;

    // first two ticks it is still measuring "stuck", no break yet
    sent.length = 0; NovaBots._autoBreak(b);
    sent.length = 0; NovaBots._autoBreak(b);
    check('it waits a few stuck ticks before breaking', sent.length, 0);

    NovaBots._autoBreak(b);   // third stuck tick
    check('then it swings at the blocking wall', sent.filter(s => s[1] === 'F').length, 1);
    check('it faces the wall, not the tree', Math.round(sent.find(s => s[1] === 'D')[2][0] * 100), 0);

    // moving freely resets the stuck counter -> no break
    b._lastBX = 500;
    b.world.self.x2 = 560;    // it moved 60
    sent.length = 0;
    NovaBots._autoBreak(b);
    check('moving freely does not break anything', sent.filter(s => s[1] === 'F').length, 0);

    win.vars.botAutoBreak = false;
    b._stuck = 5;
    sent.length = 0;
    NovaBots._autoBreak(b);
    check('the toggle off stops breaking', sent.length, 0);

    // --- scan --------------------------------------------------------------
    console.log('\n-- scan --');
    NovaBots._scanFound = null;
    NovaBots._lastPing = 0;
    peekCtl.pinged = null;
    b.world.players.clear();
    b.world.self.sid = 1234; b.world.self.x2 = 3000; b.world.self.y2 = 3000;
    b._roamTo = null;

    // no target set -> scan is inactive
    check('scan is off with no target', NovaBots._scanActive(), false);

    win.vars.botScan = true;
    win.vars.botScanTarget = '77';
    check('scan is active with a target', NovaBots._scanActive(), true);

    // target not in view -> the bot roams the whole map
    sent.length = 0;
    NovaBots._scan(b);
    check('with no sighting the bot roams', sent.filter(s => s[1] === '9').length, 1);
    check('the roam point is somewhere on the map', b._roamTo.x >= 0 && b._roamTo.x <= 14400, true);

    // the target (id 77) appears far off in the bot's world
    b.world.players.set(50, { sid: 50, id: 77, name: 'prey', x2: 3400, y2: 3000 });
    peekCtl.pinged = null;
    sent.length = 0;
    NovaBots._scan(b);
    check('finding the target pings your minimap at its spot', peekCtl.pinged, { x: 3400, y: 3000 });
    check('the finder becomes the beacon', NovaBots._scanFound.name, b.name);
    check('the beacon closes toward a far target', Math.round(sent.find(s => s[1] === '9')[2][0] * 100), 0);

    // a second bot that does NOT see the target goes home to the master
    const b2 = { name: 'nova9', ws: new FakeSocket('wss://helper-x/?t=1'), inGame: true,
                 world: null, _lastMoveAngle: undefined };
    // give it a minimal world via the real constructor path
    NovaBots.list.push(b2);
    b2.world = { self: { sid: 999, x2: 1000, y2: 1000, dir: 0, team: null }, players: new Map(),
                 nearestEnemy: () => null };
    sent.length = 0;
    NovaBots._scan(b2);
    const homeMove = sent.find(s => s[0] === b2.ws.url && s[1] === '9');
    const wantHome = Math.atan2(1000 - 1000, 1000 - 1000);
    check('a non-finder heads home to the master', typeof (homeMove && homeMove[2][0]) !== 'undefined', true);
    NovaBots.list = NovaBots.list.filter(x => x !== b2);
    win.vars.botScan = false; win.vars.botScanTarget = '';

    // --- safe walk ---------------------------------------------------------
    console.log('\n-- safe walk --');
    win.vars.botSafeWalk = true;
    b.world.objects.clear();
    b.world.self.x2 = 0; b.world.self.y2 = 0; b.world.self.scale = 35;
    // an enemy spike (id 6) straight ahead on the +x path
    b.world.objects.set(1, { sid: 1, x: 120, y: 0, scale: 35, id: 6, owner: 8 });

    const bent = NovaBots._safeHeading(b, 0);
    check('a spike dead ahead bends the heading', bent !== 0, true);
    // the bent path must itself be clear of the spike
    const fx = b.world.self.x2 + Math.cos(bent) * 200, fy = b.world.self.y2 + Math.sin(bent) * 200;
    const clearOfSpike = !UTILS.lineInRect(120 - 70, -70, 120 + 70, 70,
        Math.cos(bent) * 35, Math.sin(bent) * 35, fx, fy);
    check('the chosen heading clears the spike', clearOfSpike, true);

    // a clear path is left exactly as asked
    b.world.objects.clear();
    check('a clear path is unchanged', NovaBots._safeHeading(b, 1.0), 1.0);

    // resources are not hazards
    b.world.objects.set(2, { sid: 2, x: 120, y: 0, scale: 50, id: 0, owner: -1 });
    check('a tree in the way is not avoided', NovaBots._safeHeading(b, 0), 0);

    win.vars.botSafeWalk = false;
    b.world.objects.set(3, { sid: 3, x: 120, y: 0, scale: 35, id: 6, owner: 8 });
    check('the toggle off walks straight through', NovaBots._safeHeading(b, 0), 0);

    // cleanup
    console.log('\n-- cleanup --');
    NovaBots.killAll();
    check('kill all closes every socket', NovaBots.list.length, 0);
    check('the sockets were actually closed', sockets.filter(s => s.url.includes('sfo')).every(s => s.closed), true);
    NovaBots.tick();
    check('ticking with no bots is harmless', NovaBots.list.length, 0);
}
