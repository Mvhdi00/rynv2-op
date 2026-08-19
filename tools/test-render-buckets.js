// Equivalence test for the renderGameObjects restructure in novastorm_1.5.user.js.
//
//   node tools/test-render-buckets.js
//
// The old code walked the whole gameObjects array once per layer (five times a
// frame). The new code walks it once, buckets the on-screen objects by layer,
// and each pass draws its own bucket. That is only safe if the two produce the
// same draw sequence, call update() on the same objects the same number of
// times, and mark the same spikes — so both are reimplemented here against the
// same synthetic worlds and compared.
//
// The one deliberate difference is asserted too: the old spike-marker pass had
// no on-screen check and drew every spike in the world, almost all of them off
// the canvas. The new one only marks visible spikes.

const LAYERS = [-1, 0, 1, 2, 3];
const SCREEN_W = 1920, SCREEN_H = 1080;

function isOnScreen(x, y, s) {
    return (x + s >= 0 && x - s <= SCREEN_W && y + s >= 0 && y - s <= SCREEN_H);
}

// ---------------------------------------------------------------- the old way
function oldFrame(gameObjects, xOffset, yOffset) {
    const draws = [], updates = [], spikes = [];
    for (const layer of LAYERS) {
        let spikeList = [];
        for (let i = 0; i < gameObjects.length; ++i) {
            const tmpObj = gameObjects[i];
            if (tmpObj.active) {
                const tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
                const tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;
                if (layer == 0 && tmpObj.isItem && tmpObj.name === "spikes") {
                    spikeList.push({ x: tmpX, y: tmpY });
                }
                if (layer == 0) updates.push(tmpObj.sid);
                if (tmpObj.layer == layer && isOnScreen(tmpX, tmpY, tmpObj.scale + (tmpObj.blocker || 0))) {
                    draws.push(layer + ':' + tmpObj.sid + ':' + tmpX + ':' + tmpY);
                }
            }
        }
        if (layer == 0) for (const s of spikeList) spikes.push(Math.round(s.x) + ',' + Math.round(s.y));
    }
    return { draws, updates, spikes };
}

// ---------------------------------------------------------------- the new way
function newFrame(gameObjects, xOffset, yOffset) {
    const draws = [], updates = [], spikes = [];
    const layerBuckets = [[], [], [], [], []];
    const spikeDots = [];
    for (let i = 0; i < gameObjects.length; ++i) {
        const o = gameObjects[i];
        if (!o.active) continue;
        updates.push(o.sid);
        const tmpX = o.x + o.xWiggle - xOffset;
        const tmpY = o.y + o.yWiggle - yOffset;
        if (!isOnScreen(tmpX, tmpY, o.scale + (o.blocker || 0))) continue;
        if (o.isItem && o.name === "spikes") spikeDots.push(tmpX, tmpY);
        const bi = o.layer + 1;
        if (bi >= 0 && bi < layerBuckets.length) layerBuckets[bi].push(o, tmpX, tmpY);
    }
    for (const layer of LAYERS) {
        const bucket = layerBuckets[layer + 1];
        for (let i = 0; bucket && i < bucket.length; i += 3) {
            draws.push(layer + ':' + bucket[i].sid + ':' + bucket[i + 1] + ':' + bucket[i + 2]);
        }
        if (layer == 0) for (let i = 0; i < spikeDots.length; i += 2) {
            spikes.push(Math.round(spikeDots[i]) + ',' + Math.round(spikeDots[i + 1]));
        }
    }
    return { draws, updates, spikes };
}

// ---------------------------------------------------------------- worlds
function makeWorld(n, seed, spread) {
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const out = [];
    for (let i = 0; i < n; i++) {
        const isItem = rnd() < 0.6;
        out.push({
            sid: i,
            active: rnd() > 0.1,
            x: rnd() * spread, y: rnd() * spread,
            xWiggle: rnd() < 0.2 ? rnd() * 8 : 0,
            yWiggle: rnd() < 0.2 ? rnd() * 8 : 0,
            scale: 20 + rnd() * 60,
            blocker: rnd() < 0.05 ? 80 : undefined,
            layer: LAYERS[Math.floor(rnd() * LAYERS.length)],
            isItem: isItem,
            name: isItem && rnd() < 0.3 ? "spikes" : "wall"
        });
    }
    return out;
}

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('  ok   ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + ' -> ' + e.message); fail++; }
}
function eqArr(a, b, what) {
    if (a.length !== b.length) throw new Error(what + ': length ' + a.length + ' vs ' + b.length);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) throw new Error(what + ' differ at ' + i + ': ' + a[i] + ' vs ' + b[i]);
}

console.log('draw-sequence equivalence');
for (const [n, spread, label] of [[50, 2500, 'small, all on screen'],
                                  [400, 6000, 'medium, half off screen'],
                                  [3000, 40000, 'long session, mostly off screen'],
                                  [200, 1200, 'dense base']]) {
    t(label + ' (n=' + n + ')', () => {
        const world = makeWorld(n, n * 7 + spread, spread);
        for (const [ox, oy] of [[0, 0], [1500, 900], [-400, 300]]) {
            const o = oldFrame(world, ox, oy), w = newFrame(world, ox, oy);
            eqArr(o.draws, w.draws, 'draws');
            eqArr(o.updates.slice().sort(), w.updates.slice().sort(), 'updates');
        }
    });
}

console.log('\nupdate() still runs for every active object, exactly once');
t('one update per active object, on screen or not', () => {
    const world = makeWorld(500, 99, 30000);
    const w = newFrame(world, 0, 0);
    const active = world.filter(o => o.active).length;
    if (w.updates.length !== active) throw new Error('expected ' + active + ' got ' + w.updates.length);
    if (new Set(w.updates).size !== active) throw new Error('an object was updated twice');
});
t('the old code also updated each active object once per frame', () => {
    const world = makeWorld(500, 99, 30000);
    const o = oldFrame(world, 0, 0);
    const active = world.filter(x => x.active).length;
    if (o.updates.length !== active) throw new Error('expected ' + active + ' got ' + o.updates.length);
});

console.log('\nthe deliberate difference: off-screen spike markers');
t('old marked spikes with no bounds check, new marks only visible ones', () => {
    const world = makeWorld(1200, 5, 40000);
    const o = oldFrame(world, 0, 0), w = newFrame(world, 0, 0);
    if (!(w.spikes.length < o.spikes.length)) throw new Error('expected fewer markers, got ' + w.spikes.length + ' vs ' + o.spikes.length);
    // everything the new one draws, the old one drew too
    const oldSet = new Set(o.spikes);
    for (const s of w.spikes) if (!oldSet.has(s)) throw new Error('new marker was never drawn before: ' + s);
    console.log('       ' + o.spikes.length + ' markers a frame -> ' + w.spikes.length +
                ' (' + (100 - w.spikes.length / o.spikes.length * 100).toFixed(0) + '% were off canvas)');
});
t('every visible spike is still marked', () => {
    const world = makeWorld(600, 11, 2200);
    const w = newFrame(world, 0, 0);
    const expect = world.filter(o => o.active && o.isItem && o.name === 'spikes' &&
        isOnScreen(o.x + o.xWiggle, o.y + o.yWiggle, o.scale + (o.blocker || 0))).length;
    if (w.spikes.length !== expect) throw new Error('expected ' + expect + ' got ' + w.spikes.length);
});

console.log('\nwork done per frame');
for (const n of [500, 3000]) {
    const world = makeWorld(n, 3, 30000);
    let oldIter = 0, newIter = 0;
    for (const layer of LAYERS) for (let i = 0; i < world.length; i++) oldIter++;
    for (let i = 0; i < world.length; i++) newIter++;
    console.log('  n=' + String(n).padStart(4) + '  old ' + String(oldIter).padStart(6) +
                ' iterations/frame   new ' + String(newIter).padStart(6) +
                '   (' + (oldIter / newIter).toFixed(0) + 'x fewer)');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
