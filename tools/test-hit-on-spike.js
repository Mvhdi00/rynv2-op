#!/usr/bin/env node
// Logic check for the HIT ON SPIKE block in novastorm_1.4_ryn.user.js.
//
// The userscript only runs inside the game, so the block is lifted out of the
// file by text and evaluated against stub game state. UTILS.lineInRect is
// lifted out of the same file, so the geometry under test is the real one.
//
//   node tools/test-hit-on-spike.js

const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'novastorm_1.4_ryn.user.js');
const src = fs.readFileSync(SCRIPT, 'utf8');

function slice(from, to) {
    const start = src.indexOf(from);
    const end = src.indexOf(to, start);
    if (start < 0 || end < 0) throw new Error(`could not find ${JSON.stringify(from)} .. ${JSON.stringify(to)}`);
    return src.slice(start, end);
}

const block = slice('        const HIT_ON_SPIKE_TRAP_MEMORY', '        function doSmartTickAnti() {');
const lineInRectSrc = slice('        module.exports.lineInRect = function (recX', '\n        };') + '\n        };';

const UTILS = {
    getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    lineInRect: new Function(`const module = { exports: {} };\n${lineInRectSrc}\nreturn module.exports.lineInRect;`)()
};

const state = {
    tick: 100,
    myPlayer: null,
    nearestEnemy: null,
    spikes_our: [],
    traps_our: [],
    visibleObjects: [],
    removedObjects: [],
    autoaim: false,
    primaryReload: {},
    itemLimit: false,
    retrapAngles: []
};

const scope = {
    UTILS,
    window: { vars: { hitOnSpike: true } },
    items: { weapons: { 5: { range: 142 }, 4: { range: 110 } } },
    getPlayerInfo: (player, key) => (key === 'primaryKnockback' ? 0.3 : 0),
    isItemLimit: () => state.itemLimit,
    getPrePlaceAngles: () => state.retrapAngles
};

const factory = new Function(...Object.keys(scope), `
    let tick, myPlayer, nearestEnemy, spikes_our, traps_our, visibleObjects, removedObjects, autoaim, primaryReload;
    ${block}
    return {
        sync: (s) => { ({ tick, myPlayer, nearestEnemy, spikes_our, traps_our, visibleObjects, removedObjects, autoaim, primaryReload } = s); },
        trackHitOnSpikeTrap,
        canHitOnSpike,
        get pinned() { return hitOnSpikePinned; }
    };
`);
const hos = factory(...Object.values(scope));

const me = { sid: 1, alive: true, x2: 0, y2: 0, xVel: 0, yVel: 0, scale: 35, weapons: [5, 3], items: [0, 0, 4, 3, 15, 17] };
const enemyAt = (x, y) => ({ sid: 2, x2: x, y2: y, xVel: x, yVel: y, scale: 35 });
const spikeAt = (x, y) => ({ sid: 10, x, y, scale: 35 });
const trapAt = (x, y, sid = 20) => ({ sid, x, y, scale: 45 });

let failed = 0;

function reset(extra) {
    Object.assign(state, {
        myPlayer: me, nearestEnemy: null, spikes_our: [], traps_our: [], visibleObjects: [],
        removedObjects: [], autoaim: false, primaryReload: { 1: 1 }, itemLimit: false, retrapAngles: []
    }, extra);
}

function check(name, expect) {
    hos.sync(state);
    const got = hos.canHitOnSpike();
    const ok = got === expect;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${got}, want ${expect}${got ? `, pinned=${hos.pinned}` : ''})`);
}

function run(name, setup, expect) {
    state.tick++;
    reset();
    setup(state);
    check(name, expect);
}

// --- he is on a spike / the swing puts him on one ---------------------------
run('enemy pinned on our spike, in range', s => {
    s.nearestEnemy = enemyAt(90, 0);
    s.spikes_our = [spikeAt(120, 0)];
}, true);

run('enemy pinned on spike but out of range', s => {
    s.nearestEnemy = enemyAt(400, 0);
    s.spikes_our = [spikeAt(430, 0)];
}, false);

run('enemy on spike, primary still reloading', s => {
    s.nearestEnemy = enemyAt(90, 0);
    s.spikes_our = [spikeAt(120, 0)];
    s.primaryReload = { 1: 0.4 };
}, false);

run('enemy in range, no spike of ours', s => {
    s.nearestEnemy = enemyAt(90, 0);
}, false);

run('knockback lands him on a spike further back', s => {
    s.nearestEnemy = enemyAt(100, 0);
    s.spikes_our = [spikeAt(220, 0)];
}, true);

run('spike sits behind me, not behind him', s => {
    s.nearestEnemy = enemyAt(100, 0);
    s.spikes_our = [spikeAt(-200, 0)];
}, false);

run('feature toggled off', s => {
    s.nearestEnemy = enemyAt(90, 0);
    s.spikes_our = [spikeAt(120, 0)];
    scope.window.vars.hitOnSpike = false;
}, false);
scope.window.vars.hitOnSpike = true;

// --- his trap breaks and cannot be replaced ---------------------------------
console.log('\n-- trap-break window --');

// tick A: a trap of ours is holding him
reset({ tick: 200, nearestEnemy: enemyAt(100, 0), traps_our: [trapAt(100, 0)] });
hos.sync(state);
hos.trackHitOnSpikeTrap();

// tick B: that trap is destroyed
state.tick++;
state.traps_our = [];
state.removedObjects = [20];
hos.sync(state);
hos.trackHitOnSpikeTrap();

function afterBreak(name, setup, expect) {
    reset({ tick: state.tick, nearestEnemy: enemyAt(100, 0) });
    setup(state);
    check(name, expect);
}

// spike 100 away: outside the touching margin (70), inside the trap-break one (105)
afterBreak('trap broke, no retrap slot, spike near him', s => {
    s.spikes_our = [spikeAt(100, 100)];
}, true);

afterBreak('trap broke but a retrap slot still catches him', s => {
    s.spikes_our = [spikeAt(100, 100)];
    s.retrapAngles = [{ placeable: true, x: 105, y: 5 }];
}, false);

afterBreak('trap broke, traps at item limit, so hit instead', s => {
    s.spikes_our = [spikeAt(100, 100)];
    s.retrapAngles = [{ placeable: true, x: 105, y: 5 }];
    s.itemLimit = true;
}, true);

afterBreak('trap broke but another trap of ours still holds him', s => {
    s.spikes_our = [spikeAt(100, 100)];
    s.traps_our = [trapAt(100, 0, 21)];
}, false);

state.tick += 10;
afterBreak('trap-break window expired', s => {
    s.spikes_our = [spikeAt(100, 100)];
}, false);

console.log(failed ? `\n${failed} failing case(s)` : '\nall cases pass');
process.exit(failed ? 1 : 0);
