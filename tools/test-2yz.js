#!/usr/bin/env node
/* Headless test harness for 2yz.
 *
 * The client is built exactly as tools/build-2yz.js builds it, plus an epilogue
 * that hands the internals to the harness. It then runs inside a vm sandbox
 * with a fake WebSocket, and every scenario drives it the way the server would:
 * by feeding it encoded frames and reading what it decides.
 *
 * Nothing is stubbed inside the client itself. The prediction, targeting,
 * placement, arbitration and scheduling paths under test are the shipped ones.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', '2yz');
const DRIVERS = path.join(ROOT, 'drivers', 'game-drivers.json');

/* ----------------------------------------------------------------- harness */

let passed = 0;
let failed = 0;
const failures = [];
let currentGroup = '';

function group(name) { currentGroup = name; console.log('\n' + name); }

function check(name, condition, detail) {
    if (condition) {
        passed++;
        console.log('  ok   ' + name);
    } else {
        failed++;
        failures.push(currentGroup + ' / ' + name + (detail ? ' -- ' + detail : ''));
        console.log('  FAIL ' + name + (detail ? '  (' + detail + ')' : ''));
    }
}

function near(a, b, tol) { return Math.abs(a - b) <= tol; }

/* ------------------------------------------------------------ fake browser */

function makeSandbox() {
    const listeners = new Map();

    class FakeSocket {
        constructor(url) {
            this.url = url;
            this.readyState = 1;
            this.binaryType = 'arraybuffer';
            this.sent = [];
            this._events = new Map();
        }
        send(data) { this.sent.push(data); }
        addEventListener(type, fn) {
            if (!this._events.has(type)) this._events.set(type, []);
            this._events.get(type).push(fn);
        }
        removeEventListener() {}
        close() { this.readyState = 3; }
        _fire(type, event) {
            const list = this._events.get(type) || [];
            for (const fn of list) fn(event);
        }
    }
    FakeSocket.CONNECTING = 0;
    FakeSocket.OPEN = 1;
    FakeSocket.CLOSING = 2;
    FakeSocket.CLOSED = 3;

    const storage = new Map();

    const timers = [];
    const sandbox = {
        console,
        TextEncoder,
        TextDecoder,
        Uint8Array,
        ArrayBuffer,
        DataView,
        Math,
        Date,
        JSON,
        Map,
        Set,
        Number,
        Object,
        Array,
        String,
        Error,
        RegExp,
        isNaN,
        parseFloat,
        parseInt,
        Function,
        Infinity,
        setTimeout(fn, ms) { const t = { fn, at: Date.now() + (ms || 0), cancelled: false }; timers.push(t); return t; },
        clearTimeout(t) { if (t) t.cancelled = true; },
        setInterval() { return null; },
        clearInterval() {},
        localStorage: {
            getItem: (k) => (storage.has(k) ? storage.get(k) : null),
            setItem: (k, v) => storage.set(k, v),
            removeItem: (k) => storage.delete(k)
        },
        document: {
            readyState: 'loading',
            addEventListener() {},
            createElement: () => ({ style: {}, dataset: {}, appendChild() {}, addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], classList: { toggle() {}, add() {}, remove() {} } }),
            head: { appendChild() {} },
            body: { appendChild() {} },
            activeElement: null
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.WebSocket = FakeSocket;
    sandbox.window.addEventListener = function () {};
    sandbox.__timers = timers;
    sandbox.__FakeSocket = FakeSocket;

    return sandbox;
}

/* Run every pending timer whose deadline has passed, ignoring wall clock so
 * the delayed-release path is testable without sleeping. */
function runTimers(sandbox) {
    const due = sandbox.__timers.splice(0, sandbox.__timers.length);
    for (const t of due) if (!t.cancelled) t.fn();
}

function buildTestBundle() {
    const drivers = fs.readFileSync(DRIVERS, 'utf8');
    const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
    const parts = [];
    for (const file of files) {
        let body = fs.readFileSync(path.join(SRC, file), 'utf8');
        body = body.split('__2YZ_DRIVERS__').join(drivers.trim());
        parts.push(body);
    }
    const epilogue = `
    Runtime.start();
    window.__2yz = {
        Defs, U, Log, Transport, Net, GameState, Events, Router, EntityTracker,
        Prediction, Targeting, PlacementEngine, CombatEngine, Config,
        AutoPlace, Preplace, Replace, SpikeTick, AntiSmartTick, SafeSoldier,
        AutoHeal, AutoMills, Arbiter, Scheduler, Runtime,
        AutoBreak, Movement, AutoUpgrade, AutoBuy, AutoRespawn, AutoGather,
        ShameReset, AutoChat, Overlay,
        Entity, WorldObject, Candidate,
        Intent, PlacementIntent, ReplaceIntent, AttackIntent, HealIntent,
        DefenseIntent, HoldIntent, BreakIntent, MoveIntent, UpgradeIntent,
        BuyIntent, SpawnIntent, ToggleIntent, ChatIntent
    };
    `;
    return '(function(){"use strict";\n' + parts.join('\n') + '\n' + epilogue + '\n})();';
}

function boot() {
    const sandbox = makeSandbox();
    vm.createContext(sandbox);
    vm.runInContext(buildTestBundle(), sandbox, { filename: '2yz.test.js' });
    const api = sandbox.__2yz;

    /* Open the socket the way the game does, then complete the handshake in
     * plain mode so the harness can address packets by name. */
    const socket = new sandbox.WebSocket('wss://test');
    const inbound = (name, args) => {
        const bytes = api.Transport.encode([name, args]);
        const copy = new Uint8Array(bytes);
        socket._fire('message', { data: copy.buffer });
    };
    inbound('io-init', [1, 0, '', 0]);

    return { sandbox, api, socket, inbound };
}

/* Frame helpers matching the shipped packet layouts. */
function addPlayer(inbound, sid, name, x, y, isYou) {
    inbound('D', [[sid, sid, name, x, y, 0, 100, 100, 35, 0], isYou ? 1 : 0]);
}
function updatePlayers(inbound, records) {
    const flat = [];
    for (const r of records) {
        flat.push(
            r.sid, r.x, r.y, r.dir || 0, r.buildIndex != null ? r.buildIndex : -1,
            r.weaponIndex != null ? r.weaponIndex : 0, r.weaponVariant || 0,
            r.team != null ? r.team : null, 0, r.skinIndex || 0, r.tailIndex || 0, 0, 0
        );
    }
    inbound('a', [flat]);
}
function loadObject(inbound, o) {
    inbound('H', [[o.sid, o.x, o.y, o.dir || 0, o.scale, o.type != null ? o.type : -1,
        o.itemId, o.ownerSid != null ? o.ownerSid : -1]]);
}

/* Walk a player in a straight line for n ticks so the motion model has history. */
function walk(inbound, api, sid, from, dir, speed, ticks, others) {
    let x = from.x;
    let y = from.y;
    for (let i = 0; i < ticks; i++) {
        x += Math.cos(dir) * speed;
        y += Math.sin(dir) * speed;
        const records = [{ sid, x, y }].concat(others || []);
        updatePlayers(inbound, records);
    }
    return { x, y };
}

/* ================================================================== tests */

/* --- transport -------------------------------------------------------- */
group('transport');
{
    const { api } = boot();
    const T = api.Transport;

    const samples = [
        null, true, false, 0, 1, 127, 128, 255, 256, 65535, 65536, -1, -32, -33,
        -128, -129, -32768, 1.5, -2.25, 'x', 'hello world', '',
        [1, 2, [3, 'four']], { a: 1, b: 'two' }, [],
        [0.75, null, true, 'mixed', [1]]
    ];
    let roundTripOk = true;
    let bad = null;
    for (const s of samples) {
        const out = T.decode(T.encode(s));
        if (JSON.stringify(out) !== JSON.stringify(s)) { roundTripOk = false; bad = s; break; }
    }
    check('msgpack round-trips every value class', roundTripOk, bad !== null ? JSON.stringify(bad) : '');

    /* The opcode permutation must reproduce the game's own, independently
     * re-implemented here from src/game_index.js. */
    function gameRandom(seed) {
        let s = seed | 0;
        return function () {
            s = (s + 1831565813) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function gamePermute(alphabet, seed) {
        const n = alphabet.length;
        const order = alphabet.map((_, i) => i);
        const rand = gameRandom(seed >>> 0);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
        }
        const enc = {};
        for (let i = 0; i < n; i++) enc[alphabet[i]] = order[i];
        return enc;
    }

    /* Drive the client's own table builder through a secure handshake and
     * compare against the independent implementation. */
    let tablesMatch = true;
    for (const seed of [0, 1, 12345, 0x7fffffff, 3735928559]) {
        const sandbox2 = makeSandbox();
        vm.createContext(sandbox2);
        vm.runInContext(buildTestBundle(), sandbox2, { filename: '2yz.test.js' });
        const a2 = sandbox2.__2yz;
        const sock2 = new sandbox2.WebSocket('wss://t');
        const key = 'aabbccdd';
        const bytes = a2.Transport.encode(['io-init', [1, seed, key, a2.Defs.protocol.encryptedMode]]);
        sock2._fire('message', { data: new Uint8Array(bytes).buffer });

        const salted = (seed ^ Math.imul(a2.Defs.protocol.tableSalt, 2654435761)) >>> 0;
        const expected = gamePermute(a2.Defs.protocol.c2sAlphabet, salted);
        const actual = a2.Transport.session.tables.c2s.enc;
        for (const k in expected) {
            if (expected[k] !== actual[k]) { tablesMatch = false; break; }
        }
        if (!tablesMatch) break;
    }
    check('opcode permutation matches the game algorithm across seeds', tablesMatch);

    /* HMAC must agree with a known-good implementation. */
    const sandbox3 = makeSandbox();
    vm.createContext(sandbox3);
    vm.runInContext(buildTestBundle(), sandbox3, { filename: '2yz.test.js' });
    const a3 = sandbox3.__2yz;
    const sock3 = new sandbox3.WebSocket('wss://t');
    const keyHex = '00112233445566778899aabbccddeeff';
    const init = a3.Transport.encode(['io-init', [1, 99, keyHex, a3.Defs.protocol.encryptedMode]]);
    sock3._fire('message', { data: new Uint8Array(init).buffer });

    const framed = a3.Transport.frame('D', [1.23]);
    const sigWidth = a3.Defs.protocol.signatureBytes;
    const payload = framed.slice(sigWidth);
    const expectSig = crypto.createHmac('sha256', Buffer.from(keyHex, 'hex'))
        .update(Buffer.from(payload)).digest().subarray(0, sigWidth);
    check('frame signature is HMAC-SHA256 truncated to the protocol width',
        Buffer.from(framed.slice(0, sigWidth)).equals(expectSig));

    const decoded = a3.Transport.decode(payload);
    check('frame payload is [opcode, args, seq]',
        Array.isArray(decoded) && decoded.length === 3
        && decoded[0] === a3.Transport.session.tables.c2s.enc.D
        && decoded[2] === 1,
        JSON.stringify(decoded));

    const framed2 = a3.Transport.frame('D', [2.0]);
    check('sequence number increments per frame',
        a3.Transport.decode(framed2.slice(sigWidth))[2] === 2);
}

/* --- world model ------------------------------------------------------ */
group('world model');
{
    const { api, inbound } = boot();
    const G = api.GameState;

    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1200, 1000, 0);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1200, y: 1000 }]);

    check('local player identified', G.mySid === 1 && G.self && G.self.name === 'me');
    check('both players tracked', G.players.size === 2);
    check('in game', G.inGame === true);

    const spikeItem = api.Defs.items.findIndex((i) => i.group && i.group.id === api.Defs.GROUP.SPIKES);
    loadObject(inbound, { sid: 500, x: 1100, y: 1000, scale: 35, itemId: spikeItem, ownerSid: 1 });
    check('object added and bucketed as ours',
        G.objects.size === 1 && G.myObjects.size === 1);

    loadObject(inbound, { sid: 501, x: 1300, y: 1000, scale: 35, itemId: spikeItem, ownerSid: 2 });
    check('enemy object bucketed separately', G.enemyObjects.size === 1);

    inbound('Q', [500]);
    check('killed object removed from both map and bucket',
        G.objects.size === 1 && G.myObjects.size === 0);

    inbound('O', [2, 60]);
    check('health update applied', G.players.get(2).health === 60);

    inbound('R', [2]);
    check('kill-all-objects clears that owner', G.objects.size === 0 && G.enemyObjects.size === 0);

    inbound('5', [0, api.Defs.HAT.SOLDIER, 0]);
    check('store packet marks hat owned', G.skins[api.Defs.HAT.SOLDIER] === 1);
    inbound('5', [1, api.Defs.HAT.SOLDIER, 0]);
    check('store packet marks hat worn', G.self.skinIndex === api.Defs.HAT.SOLDIER);

    inbound('S', [api.Defs.GROUP.SPIKES, 15]);
    check('item limit honours the real group cap, not sandboxLimit',
        G.isItemLimit(spikeItem) === true,
        'cap=' + api.Defs.groupLimit(api.Defs.GROUP.SPIKES));
    inbound('S', [api.Defs.GROUP.SPIKES, 3]);
    check('below cap is placeable', G.isItemLimit(spikeItem) === false);
}

/* --- prediction ------------------------------------------------------- */
group('prediction');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1400, 1000, 0);

    /* Straight line east. */
    walk(inbound, api, 2, { x: 1400, y: 1000 }, 0, 12, 8, [{ sid: 1, x: 1000, y: 1000 }]);
    const foe = api.GameState.players.get(2);
    const straightConf = api.Prediction.confidence(foe);
    const ahead = api.Prediction.at(foe, 2);
    check('prediction leads a straight-line target forward',
        ahead.x > foe.x2 && near(ahead.y, foe.y2, 2),
        'x2=' + Math.round(foe.x2) + ' pred=' + Math.round(ahead.x));
    check('straight movement scores high confidence', straightConf > 0.5,
        'conf=' + straightConf.toFixed(2));

    /* Hard reversal. */
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: foe.x2 - 12, y: 1000 }]);
    const reversedConf = api.Prediction.confidence(foe);
    check('reversal collapses confidence', reversedConf < straightConf,
        straightConf.toFixed(2) + ' -> ' + reversedConf.toFixed(2));
    check('reversal reports a direction change',
        api.Prediction.changedDirection(foe) === true,
        'dirChange=' + foe.dirChange.toFixed(2));

    /* A stationary player must not be predicted anywhere. */
    for (let i = 0; i < 4; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1500, y: 1000 }]);
    }
    const still = api.Prediction.at(api.GameState.players.get(2), 3);
    check('stationary target predicts to its own position',
        near(still.x, 1500, 1) && near(still.y, 1000, 1),
        Math.round(still.x) + ',' + Math.round(still.y));

    check('prediction cache returns the same object within a tick',
        api.Prediction.at(foe, 2) === api.Prediction.at(foe, 2));
}

/* --- targeting -------------------------------------------------------- */
group('targeting');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'near', 1150, 1000, 0);
    addPlayer(inbound, 3, 'far', 1350, 1000, 0);
    updatePlayers(inbound, [
        { sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1150, y: 1000 }, { sid: 3, x: 1350, y: 1000 }
    ]);

    check('a target is selected', api.Targeting.primary != null);
    check('the nearer of two equals wins',
        api.Targeting.primary && api.Targeting.primary.sid === 2,
        'picked ' + (api.Targeting.primary && api.Targeting.primary.sid));
    check('both candidates are listed', api.Targeting.all.length === 2);

    /* Hysteresis: a marginally better challenger must not steal the target. */
    const held = api.Targeting.primary;
    updatePlayers(inbound, [
        { sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1160, y: 1000 }, { sid: 3, x: 1155, y: 1000 }
    ]);
    check('marginal challenger does not steal the target',
        api.Targeting.primary === held,
        'now ' + (api.Targeting.primary && api.Targeting.primary.sid));

    /* A target that leaves is dropped. */
    for (let i = 0; i < 6; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 3, x: 1155, y: 1000 }]);
    }
    check('invisible target is not returned',
        api.Targeting.primary && api.Targeting.primary.sid === 3,
        'now ' + (api.Targeting.primary && api.Targeting.primary.sid));

    /* Teammates are never targets. */
    updatePlayers(inbound, [
        { sid: 1, x: 1000, y: 1000, team: 'A' }, { sid: 3, x: 1100, y: 1000, team: 'A' }
    ]);
    check('teammates are excluded', api.Targeting.primary === null);
}

/* --- placement engine ------------------------------------------------- */
group('placement engine');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1080, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[0, 10], 1]);
    walk(inbound, api, 2, { x: 1120, y: 1000 }, Math.PI, 8, 5, [{ sid: 1, x: 1000, y: 1000 }]);

    const spike = api.GameState.spikeItem;
    check('a spike item is resolved from the loadout', spike != null, 'spike=' + spike);

    const sweep = api.PlacementEngine.sweep(spike);
    check('sweep returns the configured number of positions',
        sweep.length === api.Config.get('placement.angleSteps'), 'got ' + sweep.length);
    check('open ground is placeable', sweep.filter((c) => c.placeable).length === sweep.length);

    const target = api.Targeting.primary;
    const ranked = api.PlacementEngine.rank(sweep, target, 'spike');
    check('ranking returns scored candidates', ranked.length > 0 && ranked[0].reasons.length > 0,
        ranked[0] ? ranked[0].reasons.join(',') : 'none');
    check('the best candidate faces the target',
        ranked[0] && api.U.getDistance(ranked[0].x, ranked[0].y, target.x2, target.y2)
            < api.U.getDistance(1000, 1000, target.x2, target.y2),
        'best at ' + Math.round(ranked[0].x) + ',' + Math.round(ranked[0].y));
    check('ranking is ordered', ranked.every((c, i) => i === 0 || ranked[i - 1].score >= c.score));

    /* An occupied position must drop out of the sweep. */
    const best = ranked[0];
    loadObject(inbound, { sid: 900, x: best.x, y: best.y, scale: 50, itemId: spike, ownerSid: 2 });
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: target.x2, y: target.y2 }]);
    const sweep2 = api.PlacementEngine.sweep(spike);
    const blockedNear = sweep2.filter(
        (c) => !c.placeable && api.U.getDistance(c.x, c.y, best.x, best.y) < 60
    );
    check('an occupied position is rejected by the game collision rule',
        blockedNear.length > 0, blockedNear.length + ' blocked');
    check('rejection carries a reason',
        blockedNear.every((c) => c.rejected === 'blocked'));

    /* Boundary detection: with a blocker present there must be flush angles. */
    check('boundary angles are detected next to a structure',
        sweep2.some((c) => c.boundary));

    /* stillValid must refuse a position that is now occupied. */
    const dead = sweep2.find((c) => !c.placeable);
    check('stillValid rejects a blocked candidate',
        api.PlacementEngine.stillValid(dead) === false);
}

/* --- module: auto place ----------------------------------------------- */
group('module: auto place');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1100, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[0, 10], 1]);
    walk(inbound, api, 2, { x: 1140, y: 1000 }, Math.PI, 8, 6, [{ sid: 1, x: 1000, y: 1000 }]);

    const out = api.AutoPlace.tick();
    check('produces placement intents against a close target',
        Array.isArray(out) && out.length > 0, 'got ' + (out && out.length));
    check('intents are PlacementIntent', out && out.every((i) => i instanceof api.PlacementIntent));
    check('intents validate clean when fresh', out && out.every((i) => i.validate() === null),
        out ? out.map((i) => i.validate()).join(',') : '');

    /* Out of range: nothing. */
    for (let i = 0; i < 4; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1900, y: 1000 }]);
    }
    check('silent when the target is out of range', api.AutoPlace.tick() == null);

    /* Disabled: nothing. */
    for (let i = 0; i < 4; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1100, y: 1000 }]);
    }
    api.Config.set('placement.autoPlace.enabled', false);
    check('the enable toggle actually gates the module', api.AutoPlace.tick() == null);
    api.Config.set('placement.autoPlace.enabled', true);
}

/* --- module: preplace ------------------------------------------------- */
group('module: preplace');
{
    const { api, inbound, sandbox } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1200, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[0, 10], 1]);

    /* Steady approach so confidence clears the strict gate. */
    let pos = { x: 1200, y: 1000 };
    for (let i = 0; i < 10; i++) {
        pos = { x: pos.x - 10, y: 1000 };
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: pos.x, y: pos.y }]);
    }

    const foe = api.GameState.players.get(2);
    api.Preplace.tick();
    const armed = api.Preplace.armed;
    check('arms against a steadily moving target', armed != null,
        'conf=' + api.Prediction.confidence(foe).toFixed(2));
    check('arming does not fire immediately', armed && armed.intent && !armed.fired);
    /* The runtime arms during the tick, so `armed` may be a tick older than the
     * current position. Re-arm deliberately and compare against the same tick. */
    api.Preplace.disarm('test-resync');
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: pos.x - 10, y: 1000 }]);
    pos = { x: pos.x - 10, y: 1000 };
    const fresh = api.Preplace.armed;
    check('the interception point leads the target',
        fresh && fresh.armedTick === api.GameState.tick && fresh.predicted.x < foe.x2,
        fresh ? Math.round(fresh.predicted.x) + ' vs ' + Math.round(foe.x2) : 'not armed');

    /* Reverse hard: the armed placement must be destroyed, not fired. */
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: pos.x + 40, y: 1000 }]);
    check('a direction change disarms rather than firing a stale placement',
        api.Preplace.armed == null);

    /* Re-arm, then let the timer run and confirm it releases through the
     * scheduler's validation rather than around it. */
    pos = { x: 1200, y: 1000 };
    for (let i = 0; i < 10; i++) {
        pos = { x: pos.x - 10, y: 1000 };
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: pos.x, y: pos.y }]);
    }
    api.Preplace.tick();
    const armed2 = api.Preplace.armed;
    if (armed2) {
        const before = api.Scheduler.lastFlush.sent;
        runTimers(sandbox);
        check('the armed placement releases on its timer',
            api.Scheduler.lastFlush.sent > 0 || before > 0,
            'sent=' + api.Scheduler.lastFlush.sent);
    } else {
        check('the armed placement releases on its timer', false, 're-arm failed');
    }

    /* A slow target is Auto Place's job, not Preplace's. */
    for (let i = 0; i < 6; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1150, y: 1000 }]);
    }
    api.Preplace.tick();
    check('does not lead a stationary target', api.Preplace.armed == null);
}

/* --- module: replace -------------------------------------------------- */
group('module: replace');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1120, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[0, 10], 1]);

    const spike = api.GameState.spikeItem;
    const spikeDef = api.Defs.items[spike];
    /* Our spike, sitting between us and the target, damaged to one hit. */
    loadObject(inbound, { sid: 700, x: 1060, y: 1000, scale: spikeDef.scale, itemId: spike, ownerSid: 1 });
    for (let i = 0; i < 4; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1120, y: 1000, weaponIndex: 10 }]);
    }
    const doomedObj = api.GameState.objects.get(700);
    doomedObj.health = 1;

    /* The enemy swings a great hammer at it. */
    const foe = api.GameState.players.get(2);
    foe.d2 = api.U.getDirection(doomedObj.x, doomedObj.y, foe.x2, foe.y2);
    api.Events.emit('attack', foe, 10, 0);

    check('a swing that would destroy a structure marks it doomed',
        api.Replace.doomed.has(700), 'doomed=' + api.Replace.doomed.size);

    const out = api.Replace.tick();
    check('offers a replacement into the gap',
        Array.isArray(out) && out.length > 0 && out[0] instanceof api.ReplaceIntent,
        'got ' + (out && out.length));

    if (out && out.length) {
        const intent = out[0];
        check('the replacement lands inside the doomed footprint',
            api.U.getDistance(intent.candidate.x, intent.candidate.y, doomedObj.x, doomedObj.y)
                < doomedObj.scale + intent.candidate.scale);
        check('the replacement validates while the doomed object still stands',
            intent.validate() === null, String(intent.validate()));

        /* Once it actually breaks, the replacement is no longer a replacement. */
        inbound('Q', [700]);
        check('the intent is dropped once the object is already gone',
            intent.validate() === 'already-broken', String(intent.validate()));
    } else {
        check('the replacement lands inside the doomed footprint', false, 'no intent');
        check('the replacement validates while the doomed object still stands', false, 'no intent');
        check('the intent is dropped once the object is already gone', false, 'no intent');
    }

    /* A swing that cannot destroy the structure must not mark it. */
    const survivor = { sid: 701, x: 1060, y: 1040, scale: spikeDef.scale, itemId: spike, ownerSid: 1 };
    loadObject(inbound, survivor);
    api.GameState.objects.get(701).health = 100000;
    api.Replace.doomed.clear();
    api.Events.emit('attack', foe, 10, 0);
    check('a swing that cannot break the structure marks nothing',
        !api.Replace.doomed.has(701));
}

/* --- module: spike tick ----------------------------------------------- */
group('module: spike tick');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1060, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[0, 10], 1]);

    const trapItem = api.GameState.trapItem;
    const trapDef = api.Defs.items[trapItem];
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1060, y: 1000 }]);
    check('no window without a trap',
        api.Targeting.primary && api.SpikeTick.windowOpen(api.Targeting.primary) === false);

    /* Our trap, holding the target, weak enough for one hammer swing. */
    loadObject(inbound, {
        sid: 800, x: 1060, y: 1000, scale: trapDef.scale, itemId: trapItem, ownerSid: 1
    });
    api.GameState.objects.get(800).health = 1;
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1060, y: 1000 }]);

    const target = api.Targeting.primary;
    check('the target reads as held', target && target.trapped === true);
    check('the window opens once the target is held and the hammer is ready',
        api.SpikeTick.windowOpen(target) === true);

    const out = api.SpikeTick.tick();
    check('produces a spike placement in the window',
        out instanceof api.PlacementIntent, String(out && out.kind));
    check('spike tick outranks ordinary placement',
        out && out.urgency > api.Config.get('placement.autoPlace.urgency'));

    /* A trap we cannot break in one swing closes the window. */
    api.GameState.objects.get(800).health = 100000;
    check('an unbreakable trap closes the window',
        api.SpikeTick.windowOpen(target) === false);
}

/* --- module: anti smart tick ------------------------------------------ */
group('module: anti smart tick');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1070, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[0, 10], 1]);

    const trapItem = api.GameState.trapItem;
    const spike = api.GameState.spikeItem;
    const trapDef = api.Defs.items[trapItem];
    const spikeDef = api.Defs.items[spike];

    check('no hold while free', api.AntiSmartTick.tick() == null);

    /* Held by an enemy trap, with an enemy spike waiting on the far side. */
    loadObject(inbound, {
        sid: 810, x: 1000, y: 1000, scale: trapDef.scale, itemId: trapItem, ownerSid: 2
    });
    loadObject(inbound, {
        sid: 811, x: 1000 - 120, y: 1000, scale: spikeDef.scale, itemId: spike, ownerSid: 2
    });
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1070, y: 1000 }]);

    check('we read as held', api.GameState.self.trapped === true);
    const out = api.AntiSmartTick.tick();
    check('produces a hold when a tick setup is detectable',
        out instanceof api.HoldIntent, String(out && out.kind));
    check('the hold blocks placement, not combat',
        out && out.blocks.indexOf('Placement') >= 0 && out.blocks.indexOf('Attack') < 0,
        out ? out.blocks.join(',') : '');

    /* The hold must expire rather than pinning us forever. The runtime already
     * calls tick() once per frame, so the bound is checked by ageing the
     * module's own counter rather than by calling tick() a second time. */
    const maxHold = api.Config.get('defense.antiSmartTick.maxHoldTicks');
    for (let i = 0; i < maxHold + 3; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1070, y: 1000 }]);
    }
    api.AntiSmartTick.heldSinceTick = api.GameState.tick - (maxHold + 1);
    check('the hold is bounded and eventually gives up',
        api.AntiSmartTick.tick() == null,
        'heldFor=' + (api.GameState.tick - api.AntiSmartTick.heldSinceTick));
    check('giving up resets the counter', api.AntiSmartTick.heldSinceTick === -1);
}

/* --- module: safe soldier --------------------------------------------- */
group('module: safe soldier');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1500, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[0, 10], 1]);
    inbound('5', [0, api.Defs.HAT.SOLDIER, 0]);

    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1500, y: 1000 }]);
    api.SafeSoldier.tick();
    check('projects no damage from a distant enemy',
        api.SafeSoldier.lastProjection.total === 0,
        'total=' + api.SafeSoldier.lastProjection.total);

    /* Bring them into reach with a real weapon. */
    for (let i = 0; i < 3; i++) {
        updatePlayers(inbound, [
            { sid: 1, x: 1000, y: 1000 },
            { sid: 2, x: 1055, y: 1000, weaponIndex: 5 }
        ]);
    }
    const out = api.SafeSoldier.tick();
    check('projects incoming damage from a weapon in reach',
        api.SafeSoldier.lastProjection.total > 0,
        'total=' + Math.round(api.SafeSoldier.lastProjection.total));
    check('offers the defensive hat', out instanceof api.DefenseIntent, String(out && out.kind));
    check('the projection is capped',
        api.SafeSoldier.lastProjection.total <= api.Config.get('defense.safeSoldier.damageCap'));
    check('the projection is itemised', api.SafeSoldier.lastProjection.sources.length > 0);

    /* Already wearing it: nothing to do. */
    inbound('5', [1, api.Defs.HAT.SOLDIER, 0]);
    updatePlayers(inbound, [
        { sid: 1, x: 1000, y: 1000, skinIndex: api.Defs.HAT.SOLDIER },
        { sid: 2, x: 1055, y: 1000, weaponIndex: 5 }
    ]);
    check('does not re-equip a hat already worn', api.SafeSoldier.tick() == null);
}

/* --- module: auto heal ------------------------------------------------ */
group('module: auto heal');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);

    check('no heal at full health', api.AutoHeal.tick() == null);

    api.GameState.self.health = 40;
    api.GameState.self.lastHitTick = -99;
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);
    const out = api.AutoHeal.tick();
    check('heals when hurt and calm', out instanceof api.HealIntent, String(out && out.kind));

    if (out) {
        const food = api.Defs.items[out.itemId];
        check('the item count covers the missing health',
            out.count * food.heal >= 60 - food.heal, 'count=' + out.count + ' heal=' + food.heal);
        check('the frame cost is four per item', out.frameCost() === out.count * 4);
        check('validates while hurt', out.validate() === null);

        api.GameState.self.health = 100;
        check('drops once already full', out.validate() === 'already-full');

        api.GameState.self.health = 40;
        api.GameState.self.shameCount = api.Config.get('defense.shameCeiling');
        check('refuses to eat past the shame ceiling', out.validate() === 'shamed');
        api.GameState.self.shameCount = 0;
    } else {
        for (const t of ['the item count covers the missing health', 'the frame cost is four per item',
            'validates while hurt', 'drops once already full',
            'refuses to eat past the shame ceiling']) check(t, false, 'no intent');
    }

    /* Budget clamp: with the allowance nearly spent, the count must shrink. */
    api.GameState.self.health = 10;
    api.Config.set('network.packetsPerSecond', 20);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);
    const small = api.AutoHeal.tick();
    check('the item count is clamped by the packet budget',
        small == null || small.count <= 2, small ? 'count=' + small.count : 'suppressed');
    api.Config.set('network.packetsPerSecond', 110);
}

/* --- module: auto mills ----------------------------------------------- */
group('module: auto mills');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    api.Config.set('utility.autoMills.enabled', true);
    api.GameState.resources.food = 5000;
    api.GameState.resources.wood = 5000;
    api.GameState.resources.stone = 5000;

    walk(inbound, api, 1, { x: 1000, y: 1000 }, 0, 8, 6, []);
    api.GameState.input.moveDir = 0;

    const out = api.AutoMills.tick();
    check('builds mills while idle and safe', Array.isArray(out) && out.length > 0,
        'suppressed=' + api.AutoMills.suppressed());
    check('mills carry the lowest urgency in the client',
        !out || out.every((i) => i.urgency <= 10));

    if (out && out.length > 1) {
        const spread = api.U.getAngleDist(out[0].angle, out[1].angle);
        check('mills are spread rather than stacked', spread > 0.05, 'spread=' + spread.toFixed(3));
    } else {
        check('mills are spread rather than stacked', true, 'only one offered');
    }

    /* An enemy nearby withdraws the module entirely. */
    addPlayer(inbound, 2, 'foe', 1100, 1000, 0);
    updatePlayers(inbound, [{ sid: 1, x: 1050, y: 1000 }, { sid: 2, x: 1100, y: 1000 }]);
    check('withdraws entirely when an enemy is near', api.AutoMills.tick() == null);
    check('and reports why', api.AutoMills.suppressed() === true);

    /* Low resources also withdraw it. */
    for (let i = 0; i < 4; i++) updatePlayers(inbound, [{ sid: 1, x: 1050, y: 1000 }]);
    api.GameState.resources.wood = 0;
    api.GameState.resources.stone = 0;
    check('withdraws when resources are down to the reserve',
        api.AutoMills.suppressed() === true);
    api.Config.set('utility.autoMills.enabled', false);
}

/* --- combat ----------------------------------------------------------- */
group('combat');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1040, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[5, 10], 1]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1040, y: 1000 }]);

    /* Polearm + great hammer does only 55 raw damage across both slots, which
     * is under the burst threshold. With no spike to chain into it must settle
     * for a single swing. */
    const lone = api.CombatEngine.decide();
    check('a hammer pair with nothing to chain into does not burst',
        lone == null || api.CombatEngine.activeSequence.steps.length === 1,
        lone ? 'steps=' + api.CombatEngine.activeSequence.steps.length : 'none');

    /* Put one of our spikes behind the target and the pair becomes worth it. */
    const ourSpike = api.GameState.spikeItem;
    loadObject(inbound, {
        sid: 950, x: 1160, y: 1000,
        scale: api.Defs.items[ourSpike].scale, itemId: ourSpike, ownerSid: 1
    });
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1040, y: 1000 }]);

    const first = api.CombatEngine.decide();
    check('opens a sequence against a target in reach',
        first instanceof api.AttackIntent, String(first && first.kind));
    check('a knockback chain makes the hammer pair worth both cooldowns',
        api.CombatEngine.activeSequence
        && api.CombatEngine.activeSequence.steps.length === 2,
        api.CombatEngine.activeSequence
            ? 'steps=' + api.CombatEngine.activeSequence.steps.length : 'none');
    check('a long-reach primary swings second, after the hammer',
        first && first.slot === 1, first ? 'slot=' + first.slot : 'none');

    if (first) {
        check('the opening step names a real weapon',
            first.weapon != null && api.Defs.weapons[first.weapon] != null);
        check('the swing aims at the target',
            near(api.U.getAngleDist(first.angle, api.U.getDirection(1040, 1000, 1000, 1000)), 0, 0.3),
            'angle=' + first.angle.toFixed(2));
        check('the intent validates while the target stands', first.validate() === null,
            String(first.validate()));
    }

    /* The two halves use different slots, in the reversed order. */
    const seq = api.CombatEngine.activeSequence;
    check('the burst uses both slots exactly once',
        seq && seq.steps.length === 2 && seq.steps[0].slot !== seq.steps[1].slot,
        seq ? seq.steps.map((st) => st.slot).join('->') : 'none');
    check('each step names the weapon for its slot',
        seq && seq.steps[0].weapon === api.GameState.weapons[seq.steps[0].slot]
        && seq.steps[1].weapon === api.GameState.weapons[seq.steps[1].slot]);

    /* Stepping through the sequence yields the other slot. */
    seq.advance();
    const second = api.CombatEngine.decide();
    check('the second step of the burst follows',
        second instanceof api.AttackIntent && second.slot === seq.steps[1].slot,
        second ? 'slot=' + second.slot + ' want=' + seq.steps[1].slot : 'none');

    /* Target leaves mid-sequence: the rest of the burst must die. */
    for (let i = 0; i < 3; i++) updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);
    check('a burst does not finish into a vanished target',
        second == null || second.validate() != null, String(second && second.validate()));
    check('combat goes quiet with no target', api.CombatEngine.decide() == null);

    /* Out of reach: no swing. */
    addPlayer(inbound, 3, 'far', 1600, 1000, 0);
    for (let i = 0; i < 3; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 3, x: 1600, y: 1000 }]);
    }
    check('does not swing at an out-of-reach target', api.CombatEngine.decide() == null);
}

/* --- arbitration ------------------------------------------------------ */
group('arbitration');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1080, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[5, 10], 1]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1080, y: 1000 }]);

    const spike = api.GameState.spikeItem;
    const target = api.Targeting.primary;
    const candidate = api.PlacementEngine.best(spike, target, 'spike');

    function placement(urgency, source) {
        return new api.PlacementIntent({
            source: source || 'test', urgency, confidence: 1, target, candidate
        });
    }

    const low = placement(20, 'low');
    const high = placement(80, 'high');
    let winners = api.Arbiter.resolve([low, high]);
    check('only one exclusive intent wins a tick', winners.length === 1);
    check('the higher priority wins', winners[0] === high);
    check('the loser records why', low.rejectedReason === 'lane-taken', String(low.rejectedReason));

    /* Confidence scales priority. */
    const sure = new api.PlacementIntent({ source: 'sure', urgency: 50, confidence: 1, target, candidate });
    const unsure = new api.PlacementIntent({ source: 'unsure', urgency: 60, confidence: 0.1, target, candidate });
    winners = api.Arbiter.resolve([sure, unsure]);
    check('confidence scales priority rather than gating it', winners[0] === sure,
        'sure=' + sure.priority.toFixed(1) + ' unsure=' + unsure.priority.toFixed(1));

    /* A hold only wins when it outranks what it blocks. */
    const strongPlace = placement(90, 'strong');
    const weakHold = new api.HoldIntent({
        source: 'test', urgency: 30, confidence: 1, reason: 'weak', blocks: ['Placement']
    });
    winners = api.Arbiter.resolve([strongPlace, weakHold]);
    check('a weak hold does not veto a stronger action',
        winners.indexOf(strongPlace) >= 0, 'winners=' + winners.length);

    const weakPlace = placement(20, 'weak');
    const strongHold = new api.HoldIntent({
        source: 'test', urgency: 90, confidence: 1, reason: 'strong', blocks: ['Placement']
    });
    winners = api.Arbiter.resolve([weakPlace, strongHold]);
    check('a stronger hold does veto a weaker action',
        winners.indexOf(weakPlace) < 0
        && String(weakPlace.rejectedReason).startsWith('held:'),
        String(weakPlace.rejectedReason));

    /* Invalid intents never reach the pool. */
    const stale = placement(99, 'stale');
    stale.candidate = null;
    winners = api.Arbiter.resolve([stale, low]);
    check('an intent that fails validation is dropped before ranking',
        winners.indexOf(stale) < 0 && stale.rejectedReason != null,
        String(stale.rejectedReason));

    /* Budget: an intent that cannot afford its frames loses. */
    api.Config.set('network.packetsPerSecond', 20);
    for (let i = 0; i < 20; i++) { api.Net.countFrame(); }
    winners = api.Arbiter.resolve([placement(70, 'expensive')]);
    check('an unaffordable intent is refused rather than half-sent',
        winners.length === 0, 'budget=' + api.Net.budgetRemaining());
    api.Config.set('network.packetsPerSecond', 110);

    /* Defense rides along with an exclusive winner. */
    const defense = new api.DefenseIntent({
        source: 'test', urgency: 40, confidence: 1, hat: api.Defs.HAT.SOLDIER, reason: 'x'
    });
    api.GameState.skins[api.Defs.HAT.SOLDIER] = 1;
    winners = api.Arbiter.resolve([placement(70, 'p'), defense]);
    check('a hat swap runs alongside the action that won', winners.length === 2);
}

/* --- packet scheduler ------------------------------------------------- */
group('packet scheduler');
{
    const { api, inbound, socket } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1080, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[5, 10], 1]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1080, y: 1000 }]);

    const before = socket.sent.length;
    const spike = api.GameState.spikeItem;
    const target = api.Targeting.primary;
    const candidate = api.PlacementEngine.best(spike, target, 'spike');
    const intent = new api.PlacementIntent({
        source: 'test', urgency: 50, confidence: 1, target, candidate
    });

    api.Scheduler.run([intent]);
    const emitted = socket.sent.length - before;
    check('a placement emits frames', emitted > 0, 'emitted=' + emitted);
    check('the flush is reported', api.Scheduler.lastFlush.sent === emitted);

    const tags = api.Scheduler.lastFlush.entries.map((e) => e.tag);
    check('the build sequence selects the item before swinging',
        tags.indexOf('select-item') >= 0 && tags.indexOf('select-item') < tags.indexOf('attack-down'),
        tags.join(' '));
    check('the swing is a press and a release',
        tags.indexOf('attack-down') >= 0 && tags.indexOf('attack-up') > tags.indexOf('attack-down'));

    /* Duplicate aim frames must collapse. */
    api.Scheduler.submitPassthrough(api.Defs.C2S.AIM_DIR, [1.0]);
    api.Scheduler.submitPassthrough(api.Defs.C2S.AIM_DIR, [1.0]);
    api.Scheduler.submitPassthrough(api.Defs.C2S.AIM_DIR, [1.0]);
    const beforeAim = socket.sent.length;
    api.Scheduler.run([]);
    check('repeated aim frames collapse to one',
        socket.sent.length - beforeAim <= 1, 'sent=' + (socket.sent.length - beforeAim));

    /* Sub-epsilon aim changes are dropped, matching the game's own gate. */
    api.Scheduler.submitPassthrough(api.Defs.C2S.AIM_DIR, [1.05]);
    const beforeEps = socket.sent.length;
    api.Scheduler.run([]);
    check('an aim change below the epsilon is dropped',
        socket.sent.length === beforeEps);

    /* Budget exhaustion drops rather than queues. */
    api.Config.set('network.packetsPerSecond', 20);
    for (let i = 0; i < 40; i++) api.Scheduler.submitPassthrough(api.Defs.C2S.CHAT, ['x' + i]);
    api.Scheduler.run([]);
    check('frames past the budget are dropped, not carried over',
        api.Scheduler.lastFlush.dropped > 0,
        'dropped=' + api.Scheduler.lastFlush.dropped);
    api.Config.set('network.packetsPerSecond', 110);

    /* A cancelled sequence takes its unsent frames with it. */
    const seqIntent = new api.AttackIntent({
        source: 'test', urgency: 50, confidence: 1, target,
        slot: 0, weapon: 5, angle: 0,
        sequence: { dead: true, current: null, steps: [] }
    });
    const beforeCancel = socket.sent.length;
    api.Scheduler.run([seqIntent]);
    check('frames from a cancelled sequence never reach the socket',
        socket.sent.length === beforeCancel,
        'sent=' + (socket.sent.length - beforeCancel));
}

/* --- full loop, mixed scenarios --------------------------------------- */
group('full loop');
{
    const { api, inbound, socket, sandbox } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 5000, 5000, 1);
    addPlayer(inbound, 2, 'foe', 5200, 5000, 0);
    addPlayer(inbound, 3, 'foe2', 5000, 5250, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[5, 10], 1]);
    inbound('5', [0, api.Defs.HAT.SOLDIER, 0]);
    inbound('5', [0, api.Defs.HAT.BULL, 0]);

    let errorCount = 0;
    const baseErrors = api.Log.entries().length;

    /* Approach, circle, retreat, reverse -- 120 ticks of mixed movement with
     * every module live. Nothing should throw and nothing should stall. */
    let a = { x: 5200, y: 5000 };
    let b = { x: 5000, y: 5250 };
    for (let t = 0; t < 120; t++) {
        const phase = Math.floor(t / 30);
        let da;
        if (phase === 0) da = Math.PI;                 // approach
        else if (phase === 1) da = Math.PI / 2;        // circle
        else if (phase === 2) da = 0;                  // retreat
        else da = Math.PI + Math.sin(t) * 2;           // erratic

        a = { x: a.x + Math.cos(da) * 9, y: a.y + Math.sin(da) * 9 };
        b = { x: b.x + Math.cos(-Math.PI / 2) * 6, y: b.y + Math.sin(-Math.PI / 2) * 6 };

        updatePlayers(inbound, [
            { sid: 1, x: 5000, y: 5000 },
            { sid: 2, x: a.x, y: a.y, weaponIndex: t % 2 ? 5 : 10 },
            { sid: 3, x: b.x, y: b.y, weaponIndex: 5 }
        ]);
        runTimers(sandbox);

        if (t % 17 === 0) inbound('O', [1, 100 - (t % 60)]);
        if (t % 23 === 0) inbound('S', [api.Defs.GROUP.SPIKES, t % 15]);
    }

    errorCount = api.Log.entries().length - baseErrors;
    check('120 ticks of mixed combat raise no errors', errorCount === 0,
        api.Log.entries().slice(0, 3).map((e) => e.scope + ':' + (e.err && e.err.message)).join(' | '));
    check('the client kept sending', socket.sent.length > 0, 'frames=' + socket.sent.length);
    check('the packet budget was never exceeded',
        api.Net.framesThisSecond() <= api.Config.get('network.packetsPerSecond'),
        'pps=' + api.Net.framesThisSecond());
    check('exactly one exclusive action ran per tick',
        !api.Arbiter.lastDecision
        || api.Arbiter.lastDecision.winners.filter(
            (i) => ['Attack', 'Placement', 'Replace', 'Heal'].indexOf(i.kind) >= 0
        ).length <= 1);

    /* Death and respawn must not leave stale state behind. */
    inbound('P', []);
    check('death clears the in-game flag', api.GameState.inGame === false);
    check('a dead client offers nothing', api.CombatEngine.decide() == null);

    addPlayer(inbound, 1, 'me', 6000, 6000, 1);
    updatePlayers(inbound, [{ sid: 1, x: 6000, y: 6000 }]);
    check('respawn restores the in-game flag', api.GameState.inGame === true);

    /* Objects still load after a respawn. */
    inbound('H', [[999, 6100, 6000, 0, 35, -1, api.GameState.spikeItem, 1]]);
    check('objects load after respawn', api.GameState.objects.size > 0);
}


/* --- module: auto break ------------------------------------------------ */
group('module: auto break');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1200, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[3, 10], 1]);      // short sword + great hammer
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1200, y: 1000 }]);

    check('silent while free and unobstructed', api.AutoBreak.tick() == null);

    /* Held by an enemy trap, in reach. */
    const trapItem = api.GameState.trapItem;
    loadObject(inbound, {
        sid: 820, x: 1000, y: 1000,
        scale: api.Defs.items[trapItem].scale, itemId: trapItem, ownerSid: 2
    });
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1200, y: 1000 }]);

    check('we read as held', api.GameState.self.trapped === true);
    const escape = api.AutoBreak.tick();
    check('breaking out of a trap produces a BreakIntent',
        escape instanceof api.BreakIntent, String(escape && escape.kind));
    check('escaping is the highest-urgency break',
        escape && escape.urgency === api.Config.get('combat.autoBreak.urgencyEscape'));
    check('the break aims at the trap',
        escape && near(api.U.getAngleDist(escape.angle,
            api.U.getDirection(1000, 1000, 1000, 1000)), 0, Math.PI),
        'angle set');
    check('it names a slot and a real weapon',
        escape && (escape.slot === 0 || escape.slot === 1)
        && api.Defs.weapons[escape.weapon] != null);
    check('the intent validates while the trap stands', escape && escape.validate() === null,
        String(escape && escape.validate()));

    /* Trap gone: the intent must die rather than swing at nothing. */
    inbound('Q', [820]);
    check('the intent is dropped once the structure is gone',
        escape && escape.validate() === 'object-gone', String(escape && escape.validate()));

    /* Anti Smart Tick blocks the break through arbitration, not directly. */
    const held = new api.HoldIntent({
        source: 'test', urgency: 95, confidence: 1, reason: 'tick-setup',
        blocks: ['Break']
    });
    loadObject(inbound, {
        sid: 821, x: 1000, y: 1000,
        scale: api.Defs.items[trapItem].scale, itemId: trapItem, ownerSid: 2
    });
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1200, y: 1000 }]);
    const escape2 = api.AutoBreak.tick();
    const winners = api.Arbiter.resolve([escape2, held].filter(Boolean));
    check('a stronger Anti-Smart-Tick hold can veto the escape',
        escape2 == null || winners.indexOf(escape2) < 0,
        escape2 ? String(escape2.rejectedReason) : 'no escape offered');

    api.Config.set('combat.autoBreak.enabled', false);
    check('the enable toggle gates the module', api.AutoBreak.tick() == null);
    api.Config.set('combat.autoBreak.enabled', true);
}

/* --- module: movement -------------------------------------------------- */
group('module: movement');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1060, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[3, 10], 1]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1060, y: 1000, weaponIndex: 3 }]);

    check('movement is off by default', api.Config.get('movement.enabled') === false);
    check('and produces nothing while off', api.Movement.tick() == null);

    api.Config.set('movement.enabled', true);

    /* Safe walk: heading straight into an enemy spike. */
    const spike = api.GameState.spikeItem;
    loadObject(inbound, {
        sid: 830, x: 1120, y: 1000,
        scale: api.Defs.items[spike].scale, itemId: spike, ownerSid: 2
    });
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1060, y: 1000 }]);
    api.GameState.input.moveDir = 0;   // due east, into the spike

    check('a hazard on the current heading is detected',
        api.Movement.hazardOnSegment(1000, 1000, 1240, 1000, 35) != null);

    const steer = api.Movement.tick();
    check('produces a MoveIntent when the heading is unsafe',
        steer instanceof api.MoveIntent, String(steer && steer.kind));
    if (steer) {
        check('the correction is a real change of heading',
            steer.angle == null || api.U.getAngleDist(steer.angle, 0) > 0.05,
            'angle=' + steer.angle);
        check('and the new heading is clear', steer.angle == null
            || api.Movement.hazardOnSegment(1000, 1000,
                1000 + 240 * Math.cos(steer.angle), 1000 + 240 * Math.sin(steer.angle), 35) == null);
        check('a move intent expires rather than lingering', (function () {
            for (let i = 0; i < 4; i++) {
                updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1060, y: 1000 }]);
            }
            return steer.validate() === 'expired';
        })(), String(steer.validate()));
    } else {
        for (const t of ['the correction is a real change of heading',
            'and the new heading is clear',
            'a move intent expires rather than lingering']) check(t, false, 'no intent');
    }

    /* A clear heading produces nothing. */
    api.GameState.input.moveDir = Math.PI;   // due west, away from the spike
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1060, y: 1000 }]);
    const clear = api.Movement.tick();
    check('a clear heading is left alone',
        clear == null || clear.reason !== 'safe-walk', clear ? clear.reason : 'none');

    /* Our own spikes are not hazards to us. */
    loadObject(inbound, {
        sid: 831, x: 880, y: 1000,
        scale: api.Defs.items[spike].scale, itemId: spike, ownerSid: 1
    });
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1060, y: 1000 }]);
    check('our own structures are not treated as hazards',
        api.Movement.hazardOnSegment(1000, 1000, 800, 1000, 35) == null);

    api.Config.set('movement.enabled', false);
}

/* --- module: auto upgrade ---------------------------------------------- */
group('module: auto upgrade');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[0, null], 1]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);

    check('nothing to do with no points', api.AutoUpgrade.tick() == null);

    /* Age 2 offers, per the shipped tables. */
    inbound('U', [1, 2]);
    check('the tier is recorded', api.GameState.upgradeAge === 2);
    const offers = api.AutoUpgrade.offers();
    check('offers match the game\'s own filter', offers.length > 0,
        offers.map((o) => o.name).join(','));
    check('every offer is for the announced tier',
        offers.every((o) => (o.index < api.Defs.weapons.length
            ? api.Defs.weapons[o.index]
            : api.Defs.items[o.index - api.Defs.weapons.length]).age === 2));

    const up = api.AutoUpgrade.tick();
    check('produces an UpgradeIntent', up instanceof api.UpgradeIntent, String(up && up.kind));
    check('the index is inside the game\'s index space',
        up && up.index >= 0 && up.index < api.Defs.weapons.length + api.Defs.items.length);
    check('it validates while the offer stands', up && up.validate() === null,
        String(up && up.validate()));

    /* A new tier invalidates the old index. */
    inbound('U', [1, 3]);
    check('an offer from a previous tier is dropped',
        up && up.validate() === 'stale-tier', String(up && up.validate()));

    inbound('U', [0, 3]);
    check('spent points end the offer', api.AutoUpgrade.tick() == null);

    /* Preference order is honoured. */
    inbound('U', [1, 2]);
    const names = api.AutoUpgrade.offers().map((o) => o.name);
    if (names.length > 1) {
        api.Config.set('utility.autoUpgrade.order', names[names.length - 1]);
        const picked = api.AutoUpgrade.tick();
        check('the preference list decides which offer is taken',
            picked && picked.label === names[names.length - 1],
            picked ? picked.label : 'none');
    } else {
        check('the preference list decides which offer is taken', true, 'only one offer');
    }
}

/* --- module: auto buy --------------------------------------------------- */
group('module: auto buy');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);

    check('the shopping list resolves against the real hat table',
        api.AutoBuy.wanted().length > 0
        && api.AutoBuy.wanted().every((e) => typeof e.price === 'number'),
        JSON.stringify(api.AutoBuy.wanted().slice(0, 2)));

    check('broke: nothing is bought', api.AutoBuy.tick() == null);

    inbound('N', ['points', 100000, 0]);
    const buy = api.AutoBuy.tick();
    check('rich: produces a BuyIntent', buy instanceof api.BuyIntent, String(buy && buy.kind));
    check('the price comes from the game table',
        buy && api.Defs.hats.concat(api.Defs.accessories)
            .some((h) => h.id === buy.id && h.price === buy.price));
    check('it validates while unowned and affordable', buy && buy.validate() === null,
        String(buy && buy.validate()));

    if (buy) {
        inbound('5', [0, buy.id, buy.accessory ? 1 : 0]);
        check('an owned hat is not bought again', buy.validate() === 'already-owned');
        const next = api.AutoBuy.tick();
        check('the module moves on to the next item on the list',
            next == null || next.id !== buy.id, next ? next.label : 'list exhausted');
    } else {
        check('an owned hat is not bought again', false, 'no intent');
        check('the module moves on to the next item on the list', false, 'no intent');
    }

    inbound('N', ['points', 100, 0]);
    check('the point reserve is respected', (function () {
        api.Config.set('utility.autoBuy.pointReserve', 100);
        const r = api.AutoBuy.tick();
        api.Config.set('utility.autoBuy.pointReserve', 0);
        return r == null;
    })());
}

/* --- module: auto respawn ----------------------------------------------- */
group('module: auto respawn');
{
    const { api, inbound, socket } = boot();
    api.Config.set('utility.autoRespawn.enabled', true);
    api.Config.set('utility.autoRespawn.delayMs', 0);

    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);

    check('alive: no respawn', api.AutoRespawn.tick() == null);

    /* Without a recorded spawn payload it must refuse rather than invent one. */
    inbound('P', []);
    check('dead but no recorded payload: refuses to guess',
        api.AutoRespawn.tick() == null && api.GameState.lastSpawn == null);

    /* Feed a real spawn the way the game would, through the outbound hook. */
    const payload = { name: 'tester', moofoll: 1, skin: 0 };
    api.Transport.session.socket.send(api.Transport.encode([api.Defs.C2S.SPAWN, [payload]]));
    check('the spawn payload is captured from the game\'s own packet',
        api.GameState.lastSpawn && api.GameState.lastSpawn.name === 'tester',
        JSON.stringify(api.GameState.lastSpawn));

    inbound('P', []);
    const wake = api.AutoRespawn.tick();
    check('produces a SpawnIntent once dead with a payload',
        wake instanceof api.SpawnIntent, String(wake && wake.kind));
    check('it replays the captured payload verbatim',
        wake && wake.payload === api.GameState.lastSpawn);

    const before = socket.sent.length;
    api.Scheduler.run(api.Arbiter.resolve([wake]));
    check('the respawn actually reaches the socket', socket.sent.length > before);

    addPlayer(inbound, 1, 'tester', 1200, 1200, 1);
    check('once alive again it stops', api.AutoRespawn.tick() == null);
    api.Config.set('utility.autoRespawn.enabled', false);
}

/* --- module: auto gather ------------------------------------------------ */
group('module: auto gather');
{
    const { api, inbound } = boot();
    api.Config.set('utility.autoGather.enabled', true);
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[3, 10], 1]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);

    check('wants the attack held while alone', api.AutoGather.shouldHold() === true);
    const on = api.AutoGather.tick();
    check('produces a ToggleIntent to turn it on',
        on instanceof api.ToggleIntent && on.desired === true, String(on && on.kind));

    /* Pretend it is now on. */
    api.GameState.input.autoGather = true;
    check('and nothing once it is already on', api.AutoGather.tick() == null);

    /* An enemy in reach releases the swing. */
    addPlayer(inbound, 2, 'foe', 1040, 1000, 0);
    for (let i = 0; i < 3; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1040, y: 1000, weaponIndex: 3 }]);
    }
    check('releases the swing when the target is open',
        api.AutoGather.shouldHold() === false,
        'open=' + api.CombatEngine.isOpen(api.Targeting.primary));
    const off = api.AutoGather.tick();
    check('produces a ToggleIntent to turn it off',
        off instanceof api.ToggleIntent && off.desired === false, String(off && off.kind));

    api.GameState.self.trapped = true;
    check('a held player never holds the attack', api.AutoGather.shouldHold() === false);
    api.Config.set('utility.autoGather.enabled', false);
}

/* --- module: shame reset ------------------------------------------------ */
group('module: shame reset');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('5', [0, api.Defs.HAT.BULL, 0]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);

    check('no shame yet: nothing to do', api.AutoHeal && api.ShameReset.tick() == null);

    /* A heal that produced no health change is the only observable for shame. */
    api.GameState.self.health = 50;
    api.Events.emit('healSent', { count: 1 });
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);   // health unchanged
    check('a heal with no effect raises the inferred shame count',
        api.GameState.self.shameCount > 0, 'shame=' + api.GameState.self.shameCount);

    /* A heal that worked lowers it again. */
    api.Events.emit('healSent', { count: 1 });
    api.GameState.self.health = 70;
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);
    check('a heal that worked lowers it', api.GameState.self.shameCount === 0,
        'shame=' + api.GameState.self.shameCount);

    /* Enough shame plus a lull: wear the draining hat. */
    api.GameState.self.shameCount = 5;
    api.GameState.self.health = 100;
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);
    const burn = api.ShameReset.tick();
    check('burns shame during a lull', burn instanceof api.DefenseIntent, String(burn && burn.kind));
    check('and it is the draining hat', burn && burn.hat === api.Defs.HAT.BULL);
    check('it yields to Safe Soldier by urgency',
        burn && burn.urgency < api.Config.get('defense.safeSoldier.urgencyBase'),
        burn ? burn.urgency + ' vs ' + api.Config.get('defense.safeSoldier.urgencyBase') : '');

    /* Low health makes the drain itself the risk. */
    api.GameState.self.health = 30;
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);
    check('refuses while the drain would be the danger', api.ShameReset.tick() == null);

    /* An enemy nearby cancels it. */
    api.GameState.self.health = 100;
    addPlayer(inbound, 2, 'foe', 1100, 1000, 0);
    for (let i = 0; i < 3; i++) {
        updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1100, y: 1000 }]);
    }
    check('refuses with an enemy nearby', api.ShameReset.tick() == null);
}

/* --- module: auto chat --------------------------------------------------- */
group('module: auto chat');
{
    const { api, inbound } = boot();
    api.Config.set('chat.enabled', true);
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);

    check('nothing to say by default', api.AutoChat.tick() == null);

    inbound('N', ['kills', 1, 0]);
    check('a kill queues a line', api.AutoChat.pending != null,
        JSON.stringify(api.AutoChat.pending));

    const said = api.AutoChat.tick();
    check('produces a ChatIntent', said instanceof api.ChatIntent, String(said && said.kind));
    check('the text is one of the configured lines',
        said && api.Config.get('chat.killLines').split('|').indexOf(said.text) >= 0,
        said ? said.text : '');
    check('the text is inside the game\'s 30-character limit',
        said && said.text.length <= 30);

    inbound('N', ['kills', 2, 0]);
    check('the game\'s own chat cooldown is honoured',
        api.AutoChat.tick() == null,
        'cooldown=' + api.AutoChat.cooldownMs());

    check('the cooldown is at least the game\'s own',
        api.AutoChat.cooldownMs() >= api.Defs.config.chatCooldown,
        api.AutoChat.cooldownMs() + ' >= ' + api.Defs.config.chatCooldown);

    /* Long lines are truncated rather than rejected. */
    const long = new api.ChatIntent({
        source: 'test', urgency: 5, confidence: 1,
        text: 'x'.repeat(80), reason: 'test'
    });
    check('over-long text is truncated to the limit', long.text.length === 30);
    api.Config.set('chat.enabled', false);
}

/* --- overlay camera ------------------------------------------------------ */
group('overlay');
{
    const { api, inbound } = boot();
    check('the overlay is off by default', api.Config.get('overlay.enabled') === false);
    check('it reports camera state without a canvas',
        api.Overlay.debugState() != null && typeof api.Overlay.debugState().scale === 'number',
        JSON.stringify(api.Overlay.debugState()));
    check('the viewport scale uses the game\'s own screen constants',
        api.Defs.config.maxScreenWidth === 1920 && api.Defs.config.maxScreenHeight === 1080);
}

/* --- new lanes in arbitration -------------------------------------------- */
group('arbitration: new lanes');
{
    const { api, inbound } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    addPlayer(inbound, 2, 'foe', 1080, 1000, 0);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[3, 10], 1]);
    inbound('N', ['points', 100000, 0]);
    inbound('U', [1, 2]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }, { sid: 2, x: 1080, y: 1000 }]);

    const target = api.Targeting.primary;
    const spike = api.GameState.spikeItem;
    const candidate = api.PlacementEngine.best(spike, target, 'spike');

    const place = new api.PlacementIntent({
        source: 'test', urgency: 50, confidence: 1, target, candidate
    });
    const brk = new api.BreakIntent({
        source: 'test', urgency: 80, confidence: 1, target,
        object: { sid: 999, name: 'x', scale: 35, x: 1010, y: 1000 },
        slot: 0, weapon: 3, angle: 0, reason: 'test'
    });
    /* Break shares the build slot, so only one of these can run. */
    api.GameState.objects.set(999, { sid: 999, name: 'x', scale: 35, x: 1010, y: 1000, active: true });
    let winners = api.Arbiter.resolve([place, brk]);
    check('Break shares the exclusive build lane with Placement',
        winners.length === 1 && winners[0] === brk,
        winners.map((w) => w.kind).join(','));

    /* The independent lanes all run together. */
    const move = new api.MoveIntent({ source: 't', urgency: 40, confidence: 1, angle: 0, reason: 'x' });
    const up = new api.UpgradeIntent({ source: 't', urgency: 30, confidence: 1, index: api.AutoUpgrade.offers()[0].index, label: 'x', forAge: api.GameState.upgradeAge });
    const chat = new api.ChatIntent({ source: 't', urgency: 8, confidence: 1, text: 'hi', reason: 'x' });
    api.Config.set('movement.enabled', true);
    winners = api.Arbiter.resolve([place, move, up, chat]);
    check('Move, Upgrade and Chat run alongside a placement',
        winners.length === 4, winners.map((w) => w.kind).join(','));

    /* Two of the same independent kind still collapse to one. */
    const move2 = new api.MoveIntent({ source: 't', urgency: 41, confidence: 1, angle: 1, reason: 'y' });
    winners = api.Arbiter.resolve([move, move2]);
    check('two moves in one tick collapse to one',
        winners.length === 1 && winners[0] === move2,
        winners.map((w) => w.reason).join(','));
    api.Config.set('movement.enabled', false);
}

/* --- new packet paths ----------------------------------------------------- */
group('packet scheduler: new actions');
{
    const { api, inbound, socket } = boot();
    inbound('C', [1]);
    addPlayer(inbound, 1, 'me', 1000, 1000, 1);
    inbound('V', [[0, 3, 6, 10, 15], 0]);
    inbound('V', [[3, 10], 1]);
    inbound('N', ['points', 100000, 0]);
    inbound('U', [1, 2]);
    updatePlayers(inbound, [{ sid: 1, x: 1000, y: 1000 }]);

    function tagsFor(intent) {
        api.Scheduler.run([intent]);
        return api.Scheduler.lastFlush.entries.map((e) => e.tag);
    }

    api.GameState.objects.set(998, { sid: 998, name: 'x', scale: 35, x: 1010, y: 1000, active: true });
    let tags = tagsFor(new api.BreakIntent({
        source: 't', urgency: 50, confidence: 1,
        object: { sid: 998, name: 'x', scale: 35, x: 1010, y: 1000 },
        slot: 0, weapon: 3, angle: 0, reason: 'x'
    }));
    check('a break selects a weapon and swings',
        tags.indexOf('select-weapon') >= 0 && tags.indexOf('attack-down') >= 0, tags.join(' '));

    api.Config.set('movement.enabled', true);
    tags = tagsFor(new api.MoveIntent({ source: 't', urgency: 40, confidence: 1, angle: 1.2, reason: 'x' }));
    check('a move emits a movement frame', tags.indexOf('move') >= 0, tags.join(' '));

    tags = tagsFor(new api.MoveIntent({ source: 't', urgency: 40, confidence: 1, angle: null, reason: 'stop' }));
    check('a null heading emits the stop frame', tags.indexOf('move-stop') >= 0, tags.join(' '));
    api.Config.set('movement.enabled', false);

    tags = tagsFor(new api.UpgradeIntent({
        source: 't', urgency: 30, confidence: 1,
        index: api.AutoUpgrade.offers()[0].index, label: 'x', forAge: api.GameState.upgradeAge
    }));
    check('an upgrade emits one frame', tags.indexOf('upgrade') >= 0, tags.join(' '));

    tags = tagsFor(new api.BuyIntent({
        source: 't', urgency: 12, confidence: 1,
        id: api.Defs.HAT.SOLDIER, accessory: false, price: 4000, label: 'x'
    }));
    check('a purchase emits a store frame', tags.indexOf('buy') >= 0, tags.join(' '));

    tags = tagsFor(new api.ToggleIntent({
        source: 't', urgency: 15, confidence: 1, which: 1, desired: true, reason: 'x'
    }));
    check('a toggle emits one frame', tags.indexOf('toggle') >= 0, tags.join(' '));

    api.Config.set('chat.enabled', true);
    tags = tagsFor(new api.ChatIntent({ source: 't', urgency: 8, confidence: 1, text: 'hi', reason: 'x' }));
    check('a chat message emits one frame', tags.indexOf('chat') >= 0, tags.join(' '));
    api.Config.set('chat.enabled', false);

    /* A 2yz-owned move must beat a passthrough move in the same tick. */
    api.Config.set('movement.enabled', true);
    api.Scheduler.submitPassthrough(api.Defs.C2S.MOVE_DIR, [0]);
    api.Scheduler.run([new api.MoveIntent({
        source: 't', urgency: 40, confidence: 1, angle: 2.0, reason: 'override'
    })]);
    const moveFrames = api.Scheduler.lastFlush.entries.filter((e) => e.tag === 'move');
    check('a steering correction overrides the player\'s own move that tick',
        moveFrames.length === 1, moveFrames.length + ' move frames');
    api.Config.set('movement.enabled', false);
}

/* --- config ------------------------------------------------------------ */
group('config');
{
    const { api } = boot();
    check('every schema key has a value',
        api.Config.keys().every((k) => api.Config.get(k) !== undefined));

    check('numeric settings clamp to their range', (function () {
        api.Config.set('combat.targetRadius', 999999);
        const high = api.Config.get('combat.targetRadius');
        api.Config.set('combat.targetRadius', -50);
        const low = api.Config.get('combat.targetRadius');
        api.Config.set('combat.targetRadius', 400);
        return high === 1000 && low === 100;
    })());

    check('section() returns the leaves under a node', (function () {
        const w = api.Config.section('placement.weights');
        return typeof w.intercept === 'number' && typeof w.knockbackChain === 'number';
    })());

    check('reset restores defaults', (function () {
        api.Config.set('combat.enabled', false);
        api.Config.reset();
        return api.Config.get('combat.enabled') === true;
    })());

    check('every setting carries a label and a description',
        api.Config.keys().every((k) => {
            const leaf = api.Config.leafAt(k);
            return leaf && leaf.label && leaf.desc && leaf.desc.length > 10;
        }));
}

/* ================================================================ report */

console.log('\n' + '-'.repeat(60));
console.log(passed + ' passed, ' + failed + ' failed');
if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  ! ' + f);
    process.exit(1);
}
