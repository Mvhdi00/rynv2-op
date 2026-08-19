// Tests for Anti Bow Insta, evaluated out of the shipped userscript.
//
//   node tools/test-anti-bow-insta.js [path/to/novastorm_1.5.user.js]
//
// The block is lifted between its own markers and run against stubs for the
// game module scope it normally lives in. Projectile damage values are the real
// ones from src/game_index.js:1552.

const fs = require('fs');

// ---- stubs for the game module scope --------------------------------------
const UTILS = {
    getDistance(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    getAngleDist(a, b) {
        const p = Math.abs(b - a) % (Math.PI * 2);
        return p > Math.PI ? (Math.PI * 2) - p : p;
    }
};
// game_index.js:1552 — flat, never scaled by variant or shooter hat.
const PROJ = [
    { dmg: 25, speed: 1.6, range: 1000 },   // 0 hunting bow
    { dmg: 25, speed: 1.6, range: 700 },    // 1 turret
    { dmg: 35, speed: 2.5, range: 1200 },   // 2 crossbow
    { dmg: 30, speed: 2.0, range: 1200 },   // 3 repeater crossbow
    { dmg: 16, speed: 1.6, range: 700 },    // 4 mine
    { dmg: 50, speed: 3.6, range: 1400 }    // 5 musket
];
let myPlayer = null, enemiesNear = [], projectiles = [], tick = 100;
global.window = { vars: {} };

const SCRIPT = process.argv[2] || (__dirname + '/../novastorm_1.5.user.js');
const lines = fs.readFileSync(SCRIPT, 'utf8').split('\n');
const from = lines.findIndex(l => l.includes('const BOW_TELL_MIN_DIST'));
const to = lines.findIndex(l => l.trim() === 'function doSmartTickAnti() {');
if (from < 0 || to < 0 || to <= from) { console.error('could not find the Anti Bow Insta block'); process.exit(2); }
const block = lines.slice(from, to).join('\n');
const api = eval(block + '\n; ({ updateBowInstaThreat, bowSwitchTell, bowIncomingProjectileDamage, bowLookingAtMe,'
    + ' get dmg() { return bowIncomingDmg; }, get active() { return bowThreatActive; },'
    + ' get tellUntil() { return bowTellUntil; }, reset() { bowTellUntil = 0; } })');

// ---- helpers ---------------------------------------------------------------
function me(x = 5000, y = 5000, health = 100) {
    myPlayer = { x2: x, y2: y, scale: 35, alive: true, health: health };
    return myPlayer;
}
// A projectile launched from `from`, aimed `off` radians away from my centre.
function shot(indx, fromX, fromY, off = 0, rangeLeft) {
    const p = PROJ[indx];
    const aim = Math.atan2(myPlayer.y2 - fromY, myPlayer.x2 - fromX) + off;
    return { active: true, indx, x: fromX, y: fromY, dir: aim,
             speed: p.speed, dmg: p.dmg, scale: 103,
             range: rangeLeft === undefined ? p.range : rangeLeft };
}
function enemy(sid, x, y, cur, old, aimOff = 0, swapTick = tick) {
    const dir = Math.atan2(myPlayer.y2 - y, myPlayer.x2 - x) + aimOff;
    return { sid, x2: x, y2: y, d2: dir, visible: true,
             weaponIndex: cur, oldWeaponIndex: old, weaponSwapTick: swapTick };
}
function reset() {
    window.vars = { antiBowInsta: true };
    enemiesNear = []; projectiles = []; tick = 100;
    me(); api.reset();
}

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('  ok   ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + ' -> ' + e.message); fail++; }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function ok(v, m) { if (!v) throw new Error(m || 'expected truthy'); }
function no(v, m) { if (v) throw new Error(m || 'expected falsy'); }

// ---- incoming projectiles --------------------------------------------------
console.log('projectiles already in the air');
reset();
t('an arrow on course counts its real damage', () => {
    projectiles = [shot(0, 5000 - 200, 5000)];
    eq(api.bowIncomingProjectileDamage(), 25);
});
t('each bow type carries its own number', () => {
    for (const [indx, dmg] of [[0, 25], [2, 35], [3, 30], [5, 50]]) {
        projectiles = [shot(indx, 5000 - 200, 5000)];
        eq(api.bowIncomingProjectileDamage(), dmg, 'projectile ' + indx);
    }
});
t('a volley adds up', () => {
    projectiles = [shot(0, 5000 - 200, 5000), shot(2, 5000, 5000 - 200), shot(5, 5000 + 200, 5000)];
    eq(api.bowIncomingProjectileDamage(), 25 + 35 + 50);
});
t('a shot travelling away is not a threat', () => {
    projectiles = [shot(0, 5000 - 200, 5000, Math.PI)];
    eq(api.bowIncomingProjectileDamage(), 0);
});
t('a shot that misses my body is not a threat', () => {
    // 200 units out, angled far enough that the path clears me
    projectiles = [shot(0, 5000 - 200, 5000, 0.6)];
    eq(api.bowIncomingProjectileDamage(), 0);
});
t('a graze that still clips me counts', () => {
    // perpendicular miss ~ 200*sin(0.05) = 10 units, inside 35+20
    projectiles = [shot(0, 5000 - 200, 5000, 0.05)];
    eq(api.bowIncomingProjectileDamage(), 25);
});
t('a spent arrow that cannot reach me is not a threat', () => {
    projectiles = [shot(0, 5000 - 400, 5000, 0, 100)];   // 400 away, 100 range left
    eq(api.bowIncomingProjectileDamage(), 0);
});
t('an arrow still seconds away is not a hat decision yet', () => {
    // 1.6 units/ms: 900 units is ~560 ms out, past the ~two-tick window
    projectiles = [shot(0, 5000 - 900, 5000)];
    eq(api.bowIncomingProjectileDamage(), 0);
});
t('the same arrow inside the window does count', () => {
    projectiles = [shot(0, 5000 - 300, 5000)];   // ~190 ms
    eq(api.bowIncomingProjectileDamage(), 25);
});
t('inactive projectiles are ignored', () => {
    const p = shot(0, 5000 - 200, 5000); p.active = false;
    projectiles = [p];
    eq(api.bowIncomingProjectileDamage(), 0);
});

// ---- the switch tell -------------------------------------------------------
console.log('\nthe switch tell');
reset();
t('swapping into a hunting bow from range, aimed at me', () => {
    enemiesNear = [enemy(2, 5000 - 500, 5000, 9, 5)];
    ok(api.bowSwitchTell());
});
t('bow -> crossbow and crossbow -> musket both tell', () => {
    enemiesNear = [enemy(2, 5000 - 500, 5000, 12, 9)];
    ok(api.bowSwitchTell(), 'bow to crossbow');
    enemiesNear = [enemy(2, 5000 - 500, 5000, 15, 12)];
    ok(api.bowSwitchTell(), 'crossbow to musket');
});
t('holding a bow they already had is not a tell', () => {
    enemiesNear = [enemy(2, 5000 - 500, 5000, 9, 9)];
    no(api.bowSwitchTell());
});
t('a melee swap is not a tell', () => {
    enemiesNear = [enemy(2, 5000 - 500, 5000, 5, 0)];
    no(api.bowSwitchTell());
});
t('inside melee range it is not a bow insta', () => {
    enemiesNear = [enemy(2, 5000 - 150, 5000, 9, 5)];
    no(api.bowSwitchTell(), '150 units is not a ranged play');
});
t('not aimed at me, no tell', () => {
    enemiesNear = [enemy(2, 5000 - 500, 5000, 9, 5, 0.8)];
    no(api.bowSwitchTell());
});
t('a stale swap stops telling', () => {
    enemiesNear = [enemy(2, 5000 - 500, 5000, 9, 5, 0, tick - 10)];
    no(api.bowSwitchTell(), 'a swap 10 ticks ago should not still fire');
});
t('one enemy in a crowd is enough', () => {
    enemiesNear = [enemy(2, 5000 - 500, 5000, 5, 0), enemy(3, 5000 + 600, 5000, 12, 9)];
    ok(api.bowSwitchTell());
});
t('aim tolerance scales with distance', () => {
    // asin(70/2d): at 400 the half-angle is ~0.0875 rad, at 1200 it is ~0.029
    enemiesNear = [enemy(2, 5000 - 400, 5000, 9, 5, 0.05)];
    ok(api.bowSwitchTell(), 'inside the cone at 400');
    enemiesNear = [enemy(2, 5000 - 1200, 5000, 9, 5, 0.05)];
    no(api.bowSwitchTell(), 'same angle is outside the cone at 1200');
});

// ---- the combined threat ---------------------------------------------------
console.log('\nthe threat flag');
reset();
t('an arrow in the air raises it', () => {
    projectiles = [shot(0, 5000 - 200, 5000)];
    api.updateBowInstaThreat();
    ok(api.active); eq(api.dmg, 25);
});
t('a tell raises it before any arrow exists', () => {
    reset();
    enemiesNear = [enemy(2, 5000 - 500, 5000, 9, 5)];
    api.updateBowInstaThreat();
    ok(api.active, 'tell did not raise the flag');
    eq(api.dmg, 0, 'no arrow yet');
    ok(api.tellUntil > Date.now(), 'the hold window did not open');
});
t('the tell keeps holding after the enemy stops telling', () => {
    reset();
    enemiesNear = [enemy(2, 5000 - 500, 5000, 9, 5)];
    api.updateBowInstaThreat();
    enemiesNear = [];                       // they swapped away
    api.updateBowInstaThreat();
    ok(api.active, 'the helmet should stay on through the hold window');
});
t('quiet means quiet', () => {
    reset();
    api.updateBowInstaThreat();
    no(api.active); eq(api.dmg, 0);
});
t('the toggle off silences it completely', () => {
    reset();
    window.vars.antiBowInsta = false;
    projectiles = [shot(5, 5000 - 200, 5000)];
    enemiesNear = [enemy(2, 5000 - 500, 5000, 9, 5)];
    api.updateBowInstaThreat();
    no(api.active); eq(api.dmg, 0);
});
t('being dead silences it', () => {
    reset();
    myPlayer.alive = false;
    projectiles = [shot(0, 5000 - 200, 5000)];
    api.updateBowInstaThreat();
    no(api.active);
});

// ---- the decision the helmet is made on ------------------------------------
console.log('\nwhat the helmet is worth');
t('a musket shot on a hurt player is lethal bare and survivable in soldier', () => {
    reset();
    me(5000, 5000, 45);
    projectiles = [shot(5, 5000 - 200, 5000)];      // 50
    api.updateBowInstaThreat();
    const melee = 0;
    const total = melee + api.dmg;
    ok(total >= myPlayer.health, 'bare: ' + total + ' vs ' + myPlayer.health);
    ok(total * 0.75 < myPlayer.health, 'soldier 0.75 should carry it: ' + (total * 0.75));
});
t('musket plus a polearm hit is the classic insta', () => {
    reset();
    me(5000, 5000, 100);
    projectiles = [shot(5, 5000 - 200, 5000)];      // 50
    api.updateBowInstaThreat();
    const polearm = 45 * 1.5;                        // diamond variant
    ok(polearm + api.dmg >= 100, 'should read as lethal: ' + (polearm + api.dmg));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
