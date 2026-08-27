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
    receive: (sock, raw) => raw     // the test hands parsed messages straight in
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
        botFreeze: false, botLock: false, botScatter: false
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
    toRad: (d) => d * Math.PI / 180
};
const items = { list: [] };
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
    'UTILS', 'items', 'setAutoMills', 'G',
    `let autoMills = false;
     setAutoMills.set = (v) => { autoMills = v; };
     let tick, lastMoveAngle, mouseX, mouseY, screenWidth, screenHeight, maxScreenWidth, maxScreenHeight, getAttackDir;
     G.sync = () => { ({ tick, lastMoveAngle, mouseX, mouseY, screenWidth, screenHeight, maxScreenWidth, maxScreenHeight, getAttackDir } = G); };
     G.sync();
     ${block}
     return NovaBots;`
);

const autoMillsCtl = () => {};
const NovaBots = factory(EXP, win, doc, players, myPlayer, wsAddress, null, URL, { log() {}, warn() {} }, UTILS, items, autoMillsCtl, gameGlobals);
const setAutoMills = (v) => autoMillsCtl.set(v);
const syncGlobals = () => gameGlobals.sync();

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

    // cleanup
    console.log('\n-- cleanup --');
    NovaBots.killAll();
    check('kill all closes every socket', NovaBots.list.length, 0);
    check('the sockets were actually closed', sockets.every(s => s.closed), true);
    NovaBots.tick();
    check('ticking with no bots is harmless', NovaBots.list.length, 0);
}
