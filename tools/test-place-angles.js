// Tests for the placer's angle sweep in YoRHa_System.user.js.
//
//   node tools/test-place-angles.js [path/to/YoRHa_System.user.js]
//
// PLACE_ANGLES is 144, but the sweep is not flat. Every second one of those
// angles is an angle of the original 72 grid (2 x 2.5deg == 5deg), so the
// coarse grid is tried first and alone; the finer half is only reached when the
// coarse circle is completely blocked.
//
// What that has to buy, and what these tests pin down:
//
//   * the same spot the placer always picked, from the same list, at the same
//     cost — 72 canPlace calls per sweep, not 144
//   * the same angle VALUES as the old grid, to the bit, because placedAngles
//     and bannedAngles are keyed on them
//   * 2.5deg steps still available, but only where 5deg genuinely had nothing
//
// buildPlaceAngles and getPerfectAngles are lifted out of the shipped script so
// this runs against what actually ships.
const fs = require('fs');

const SCRIPT = process.argv[2] || (__dirname + '/../YoRHa_System.user.js');
const lines = fs.readFileSync(SCRIPT, 'utf8').split('\n');

function lift(name) {
    const i = lines.findIndex(l => l.trim().startsWith('function ' + name + '('));
    if (i < 0) throw new Error('could not find ' + name + ' in ' + SCRIPT);
    const indent = lines[i].length - lines[i].trimStart().length;
    const out = [lines[i]];
    for (let j = i + 1; j < lines.length; j++) {
        out.push(lines[j]);
        if (lines[j] === ' '.repeat(indent) + '}') break;
    }
    return out.join('\n');
}

const PLACE_ANGLES = 144;
const UTILS = { toRad(d) { return d * Math.PI / 180; } };

// The world under test: a set of blocked angle windows, in degrees.
let blocked = [];
let canPlaceCalls = 0;
function canPlace(id, angle, customObjects) {
    canPlaceCalls++;
    const deg = (angle * 180 / Math.PI + 360) % 360;
    for (const [lo, hi] of blocked) {
        if (lo <= hi ? (deg >= lo && deg <= hi) : (deg >= lo || deg <= hi)) return false;
    }
    return true;
}
function getConfig(id, angle) {
    return { x: Math.cos(angle) * 87, y: Math.sin(angle) * 87, scale: 52 };
}

const api = eval('(function () {\n' + lift('buildPlaceAngles') + '\n' + lift('getPerfectAngles') +
    '\nreturn { buildPlaceAngles, getPerfectAngles };\n})()');

// The original 72-angle sweep, written out as it stood, to compare against.
function oldSweep(id) {
    const angles = [];
    for (let i = 0; i < 72; i++) {
        const angle = UTILS.toRad(i * (360 / 72));
        angles.push({ id, angle, placeable: canPlace(id, angle), ...getConfig(id, angle) });
    }
    api.getPerfectAngles(angles);
    return angles;
}

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('  ok   ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + ' -> ' + e.message); fail++; }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function ok(v, m) { if (!v) throw new Error(m || 'expected truthy'); }
function sameList(a, b, what) {
    eq(a.length, b.length, what + ' length');
    for (let i = 0; i < a.length; i++) {
        // Angle values are compared with === on purpose: placedAngles and
        // bannedAngles are keyed on them, so a value that merely rounds the
        // same is not good enough.
        eq(a[i].angle, b[i].angle, what + '[' + i + '].angle');
        eq(a[i].placeable, b[i].placeable, what + '[' + i + '].placeable');
        eq(a[i].perfect, b[i].perfect, what + '[' + i + '].perfect');
        eq(a[i].x, b[i].x, what + '[' + i + '].x');
        eq(a[i].y, b[i].y, what + '[' + i + '].y');
    }
}
function reset(b) { blocked = b || []; canPlaceCalls = 0; }
// Blocked everywhere except 2.5deg exactly: the 5deg grid steps straight over
// that slot, the 2.5deg grid lands on it.
const ONLY_2_5 = [[0, 2.4], [2.6, 360]];

// ---------------------------------------------------------------------- tests
console.log('the open circle: identical to the old 72 sweep');
[['nothing in the way', []],
 ['one wall to the east', [[350, 20]]],
 ['half the circle gone', [[0, 180]]],
 ['three separate walls', [[10, 40], [120, 155], [250, 262]]],
 ['a single 5deg notch', [[95, 99]]],
 ['everything but one 5deg window', [[0, 174], [186, 359]]]
].forEach(([label, b]) => {
    t(label, () => {
        reset(b); const oldA = oldSweep(7);
        reset(b); const newA = api.buildPlaceAngles(7);
        sameList(newA, oldA, 'sweep');
    });
});

console.log('\nthe cost is the old cost');
t('72 canPlace calls a sweep, not 144', () => {
    reset([[350, 20]]);
    api.buildPlaceAngles(7);
    eq(canPlaceCalls, 72);
});
t('the old sweep cost the same', () => {
    reset([[350, 20]]);
    oldSweep(7);
    eq(canPlaceCalls, 72);
});
t('a fully blocked circle is the only time it costs 144', () => {
    reset([[0, 360]]);
    api.buildPlaceAngles(7);
    eq(canPlaceCalls, 144);
});

console.log('\nwhat 144 actually buys: reach where 72 had nothing');
t('a gap that only exists between two old angles is found', () => {
    // Everything blocked except 2.5deg exactly — an angle the 5deg grid steps
    // straight over, and the 2.5deg grid lands on.
    reset(ONLY_2_5);
    const a = api.buildPlaceAngles(7);
    eq(a.length, 144, 'should have fallen through to the fine grid');
    const found = a.filter(x => x.placeable);
    ok(found.length > 0, 'the fine grid should have found the gap');
    for (const f of found) {
        const deg = (f.angle * 180 / Math.PI + 360) % 360;
        ok(Math.abs(deg - 2.5) < 1e-9, 'expected the 2.5deg slot, got ' + deg);
    }
});
t('the old grid finds nothing there at all', () => {
    reset(ONLY_2_5);
    eq(oldSweep(7).filter(x => x.placeable).length, 0);
});
t('the fallback keeps the old angles, at the old indices', () => {
    reset(ONLY_2_5);
    const a = api.buildPlaceAngles(7);
    reset(ONLY_2_5);
    const oldA = oldSweep(7);
    for (let i = 0; i < 72; i++) {
        eq(a[i * 2].angle, oldA[i].angle, 'coarse angle ' + i + ' moved');
        eq(a[i * 2].x, oldA[i].x, 'coarse x ' + i + ' moved');
    }
    for (let i = 1; i < 144; i += 2) {
        const deg = (a[i].angle * 180 / Math.PI + 360) % 360;
        ok(Math.abs((deg / 2.5) % 2 - 1) < 1e-9, 'index ' + i + ' is not an in-between angle');
    }
});
t('one placeable old angle is enough to stay on the old grid', () => {
    reset([[2.6, 359]]);     // 0deg is open, and 0 is on the coarse grid
    const a = api.buildPlaceAngles(7);
    eq(a.length, 72, 'it went fine when the coarse grid still had a spot');
    eq(canPlaceCalls, 72);
});

console.log('\nperfect angles — the gap edges — are marked as before');
[['one wall', [[30, 70]]],
 ['two walls', [[0, 45], [200, 240]]],
 ['a narrow slot', [[0, 174], [186, 359]]]
].forEach(([label, b]) => {
    t(label, () => {
        reset(b); const oldA = oldSweep(7);
        reset(b); const newA = api.buildPlaceAngles(7);
        const oldPerfect = oldA.filter(a => a.perfect).map(a => a.angle);
        const newPerfect = newA.filter(a => a.perfect).map(a => a.angle);
        eq(JSON.stringify(newPerfect), JSON.stringify(oldPerfect));
    });
});

console.log('\ncustomObjects still reaches canPlace');
t('getPrePlaceAngles\' third argument is forwarded, not dropped', () => {
    // canTrapTick passes the trapped trap out of the object list; losing that
    // argument would make every spot next to it read as blocked.
    ok(lift('buildPlaceAngles').includes('canPlace(id, angle, customObjects)'),
       'the sweep must forward customObjects');
    const gp = lift('getPrePlaceAngles');
    ok(/return buildPlaceAngles\(id, customObjects\)/.test(gp), gp);
});
t('updateAngles sweeps against the live world', () => {
    ok(/buildPlaceAngles\(id\)/.test(lift('updateAngles')), 'no customObjects here');
});

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
