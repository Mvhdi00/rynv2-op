#!/usr/bin/env node
// Logic check for the PERFORMANCE / FPS UNLOCK / PING block in
// novastorm_1.4_ryn.user.js.
//
// The block is lifted out of the userscript by text and evaluated against stub
// globals, so what is exercised here is the code that ships.
//
//   node tools/test-performance.js

const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'novastorm_1.4_ryn.user.js');
const src = fs.readFileSync(SCRIPT, 'utf8');

const start = src.indexOf('        const perf = {');
const end = src.indexOf('        // PING:\n        var lastPing = -1;');
if (start < 0 || end < 0) throw new Error('performance block not found');
const block = src.slice(start, end);

let failed = 0;
function check(name, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
}

// --- stub globals -----------------------------------------------------------
const calls = { raf: 0, timeout: [], post: 0 };
const win = { vars: { fpsUnlock: true, fpsLimit: 0, lightRender: true, pingStabilizer: true } };
const doc = { hidden: false };
let clock = 0;

const factory = new Function('window', 'document', 'requestAnimationFrame', 'setTimeout', 'MessageChannel', 'performance', 'calls', `
    let pings = [], minPingTime = Infinity, maxPingTime = 0, averagePing = 0, fps = 0;
    ${block}
    return {
        perf, syncPerfVars, scheduleFrame, trackFPS, updatePingStats, tickPing,
        stats: () => ({ pings: pings.slice(), minPingTime, maxPingTime, averagePing, pingJitter }),
        fps: () => fps,
        PING_WINDOW
    };
`);

const api = factory(
    win,
    doc,
    (fn) => { calls.raf++; },
    (fn, ms) => { calls.timeout.push(Math.round(ms)); },
    class {                       // MessageChannel stub: records the post, never fires
        constructor() {
            this.port1 = {};
            this.port2 = { postMessage: () => { calls.post++; } };
        }
    },
    { now: () => clock },
    calls
);

// --- FPS scheduling ---------------------------------------------------------
api.syncPerfVars();
check('settings read off window.vars', [api.perf.fpsUnlock, api.perf.fpsLimit, api.perf.lightRender, api.perf.pingStabilizer], [true, 0, true, true]);

// the first frames must stay on requestAnimationFrame: that is what makes the
// unpatch layer stop the bundle's own renderer
for (let i = 0; i < 3; i++) api.scheduleFrame(() => {});
check('first frames go through rAF', [calls.raf, calls.post, calls.timeout.length], [3, 0, 0]);

// unlocked with no limit -> straight to the message channel
api.scheduleFrame(() => {});
check('unlocked + no limit posts a frame', [calls.raf, calls.post], [3, 1]);

// unlocked with a limit -> paced with a timer
win.vars.fpsLimit = 120;
api.syncPerfVars();
clock = 1000;                     // frameStart is 0, so 1000ms have "passed"
api.scheduleFrame(() => {});
check('limit with the budget spent posts immediately', calls.post, 2);

const factory2 = () => {
    calls.timeout.length = 0;
    calls.post = 0;
};

// a fresh frame under a 120fps limit waits out the rest of the 8.3ms
factory2();
const paced = new Function('window', 'document', 'requestAnimationFrame', 'setTimeout', 'MessageChannel', 'performance', `
    let pings = [], minPingTime = Infinity, maxPingTime = 0, averagePing = 0, fps = 0;
    ${block}
    return { syncPerfVars, scheduleFrame, setStart: (t) => { frameStart = t; }, warm: () => { framesScheduled = 99; } };
`)(win, doc, () => {}, (fn, ms) => { calls.timeout.push(Math.round(ms)); }, class { constructor() { this.port1 = {}; this.port2 = { postMessage: () => { calls.post++; } }; } }, { now: () => clock });

paced.syncPerfVars();
paced.warm();
clock = 100;
paced.setStart(98);               // 2ms into an 8.33ms budget
paced.scheduleFrame(() => {});
check('limit waits out the rest of the budget', calls.timeout, [6]);

// hidden tab is paced to 60 even with the limit set to unlimited
factory2();
win.vars.fpsLimit = 0;
doc.hidden = true;
paced.syncPerfVars();
clock = 100;
paced.setStart(99);               // 1ms into a 16.7ms budget
paced.scheduleFrame(() => {});
check('hidden tab is paced to 60', calls.timeout, [16]);
doc.hidden = false;

// the toggle off puts everything back on rAF
factory2();
win.vars.fpsUnlock = false;
api.syncPerfVars();
const rafBefore = calls.raf;
api.scheduleFrame(() => {});
check('unlock off goes back to rAF', [calls.raf - rafBefore, calls.post], [1, 0]);
win.vars.fpsUnlock = true;
api.syncPerfVars();

// --- FPS counting -----------------------------------------------------------
clock = 0;
for (let i = 0; i < 250; i++) api.trackFPS();
clock = 1000;
api.trackFPS();                   // the frame that closes the one-second window
check('fps counts loop frames, not refreshes', api.fps(), 251);
check('fps is published for the HUD', win.gameFps, 251);

// --- ping -------------------------------------------------------------------
console.log('\n-- ping --');
[40, 42, 41, 300, 39].forEach(p => api.updatePingStats(p));
const stats = api.stats();
check('average covers every sample', stats.averagePing, Math.round((40 + 42 + 41 + 300 + 39) / 5));
check('min / max track the extremes', [stats.minPingTime, stats.maxPingTime], [39, 300]);
check('jitter is the spread of the window', stats.pingJitter, 300 - 39);
check('the spike does not move the smoothed ping', win.pingSmooth, 41);
check('tick timer runs on the smoothed value', api.tickPing(), 41);

win.vars.pingStabilizer = false;
api.syncPerfVars();
win.pingTime = 300;
check('stabiliser off uses the raw round trip', api.tickPing(), 111);   // clamped into the tick
win.pingTime = 45;
check('raw round trip passes through when sane', api.tickPing(), 45);
win.vars.pingStabilizer = true;
api.syncPerfVars();

// rolling window: the oldest samples fall out instead of the buffer being wiped
for (let i = 0; i < api.PING_WINDOW + 10; i++) api.updatePingStats(50);
check('window stays bounded', api.stats().pings.length, api.PING_WINDOW);
check('average settles on the recent samples', api.stats().averagePing, 50);

// --- render list ------------------------------------------------------------
console.log('\n-- render list --');

const renderStart = src.indexOf('        const renderActive = [];');
const renderEnd = src.indexOf('        // RENDER GAME OBJECTS:\n        function renderGameObjects');
if (renderStart < 0 || renderEnd < 0) throw new Error('render list block not found');
const renderBlock = src.slice(renderStart, renderEnd);

const objects = [
    { id: 'a', active: true,  layer: 0 },
    { id: 'b', active: false, layer: 1 },   // destroyed: must never be drawn
    { id: 'c', active: true,  layer: 1 },
    { id: 'd', active: true,  layer: -1 },
    { id: 'e', active: true,  layer: 3 },
    { id: 'f', active: true,  layer: 0 },
    { id: 'g', active: true,  layer: 2 }
];

const renderApi = new Function('perf', 'gameObjects', `
    ${renderBlock}
    return { buildRenderList, renderPassList, renderActive, renderStrays };
`)({ lightRender: true }, objects);

// what the original code would have considered for a layer: every active
// object, in gameObjects order
const original = (layer) => objects.filter(o => o.active && o.layer == layer).map(o => o.id);
const viaPass = (layer) => renderApi.renderPassList(layer).filter(o => o.active && o.layer == layer).map(o => o.id);

renderApi.buildRenderList();

for (const layer of [-1, 0, 1, 2, 3]) {
    check(`layer ${layer} draws exactly what the full pass drew`, viaPass(layer), original(layer));
}

check('layer 0 still sees every active object (update runs on all of them)',
      renderApi.renderPassList(0).map(o => o.id),
      objects.filter(o => o.active).map(o => o.id));

check('destroyed objects are dropped', renderApi.renderActive.some(o => !o.active), false);

// an object on an unexpected layer must not fall through the buckets
const strayObjects = objects.concat([{ id: 'z', active: true, layer: 9 }]);
const strayApi = new Function('perf', 'gameObjects', `
    ${renderBlock}
    return { buildRenderList, renderPassList, renderStrays };
`)({ lightRender: true }, strayObjects);
strayApi.buildRenderList();
check('a stray layer is noticed', strayApi.renderStrays.map(o => o.id), ['z']);
check('a stray layer sends the pass back to the full list',
      strayApi.renderPassList(1).map(o => o.id),
      strayObjects.filter(o => o.active).map(o => o.id));

// light render off = the original array, untouched
const offApi = new Function('perf', 'gameObjects', `
    ${renderBlock}
    return { renderPassList };
`)({ lightRender: false }, objects);
check('light render off uses gameObjects as before', offApi.renderPassList(1) === objects, true);


console.log(failed ? `\n${failed} failing case(s)` : '\nall cases pass');
process.exit(failed ? 1 : 0);
