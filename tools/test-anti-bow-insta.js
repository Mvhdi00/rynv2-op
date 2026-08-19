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
let visibleObjects = [], packets = 0;
const placed = [];
// Item groups that matter here (game_index.js): walls are group 1 at layer 0,
// mills are group 3 at layer 1.
const GROUPS = { 1: { id: 1, layer: 0, limit: 30 }, 3: { id: 3, layer: 1, limit: 7 } };
const items = { list: [] };
items.list[3]  = { name: 'wood wall',       scale: 50, group: GROUPS[1] };
items.list[4]  = { name: 'stone wall',      scale: 50, group: GROUPS[1] };
items.list[5]  = { name: 'castle wall',     scale: 52, group: GROUPS[1] };
items.list[10] = { name: 'windmill',        scale: 45, group: GROUPS[3] };
items.list[11] = { name: 'faster windmill', scale: 47, group: GROUPS[3] };
items.list[12] = { name: 'power mill',      scale: 47, group: GROUPS[3] };
let placeableAngles = true, limitReached = {};
function isItemLimit(id) { return !!limitReached[id]; }
function canPlace(id, angle) { return placeableAngles; }
function place(id, angle) { placed.push({ id, angle }); }
global.window = { vars: {} };

const SCRIPT = process.argv[2] || (__dirname + '/../novastorm_1.5.user.js');
const lines = fs.readFileSync(SCRIPT, 'utf8').split('\n');
const from = lines.findIndex(l => l.includes('const BOW_TELL_HOLD'));
const to = lines.findIndex(l => l.trim() === 'function doSmartTickAnti() {');
if (from < 0 || to < 0 || to <= from) { console.error('could not find the Anti Bow Insta block'); process.exit(2); }
const block = lines.slice(from, to).join('\n');
const api = eval(block + '\n; ({ updateBowInstaThreat, bowSwitchTell, bowIncomingProjectileDamage, bowLookingAtMe,'
    + ' get dmg() { return bowIncomingDmg; }, get active() { return bowThreatActive; },'
    + ' get tellUntil() { return bowTellUntil; }, reset() { bowTellUntil = 0; },'
    + ' bowThreatSource, tryBowBlock, startBowDodge, ownedItemInGroup,'
    + ' get dodgeAngle() { return bowDodgeAngle; }, get dodgeUntil() { return bowDodgeUntil; },'
    + ' resetBlock() { bowDodgeAngle = null; bowDodgeUntil = 0; bowLastBlock = 0; } })');

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
    window.vars = { antiBowInsta: true, antiBowMinDist: 0, antiBowBlock: true, antiBowDodge: true };
    enemiesNear = []; projectiles = []; tick = 100;
    visibleObjects = []; packets = 0; placed.length = 0;
    placeableAngles = true; limitReached = {};
    me(); api.reset(); api.resetBlock();
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
t('a close swap tells too — they fire at any range', () => {
    enemiesNear = [enemy(2, 5000 - 150, 5000, 9, 5)];
    ok(api.bowSwitchTell(), 'up close the swap is the only warning there is');
});
t('the minimum-distance slider can silence close swaps', () => {
    window.vars.antiBowMinDist = 300;
    enemiesNear = [enemy(2, 5000 - 150, 5000, 9, 5)];
    no(api.bowSwitchTell(), '150 is inside a 300 gate');
    enemiesNear = [enemy(2, 5000 - 500, 5000, 9, 5)];
    ok(api.bowSwitchTell(), '500 is outside it');
    window.vars.antiBowMinDist = 0;
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

t('the full four-piece combo is read at its true 135', () => {
    reset();
    projectiles = [shot(0, 5000 - 200, 5000), shot(2, 5000 - 200, 5000),
                   shot(5, 5000 - 200, 5000), shot(1, 5000 - 200, 5000)];
    api.updateBowInstaThreat();
    eq(api.dmg, 25 + 35 + 50 + 25, 'bow + crossbow + musket + turret gear');
});
t('and the helmet is NOT enough for it', () => {
    // 135 * 0.75 = 101.25, which is still over 100. Detection is right; the
    // maths is what beats you. Recorded so the limit cannot be forgotten.
    ok(135 * 0.75 > 100, 'soldier should not save the four-piece');
    ok(110 * 0.75 < 100, 'but it does save bow + crossbow + musket');
});


// ---- blocking ---------------------------------------------------------------
console.log('\nblocking the shot');
reset();
t('a mill is preferred over a wall', () => {
    myPlayer.items = [0, 3, 6, 10];                 // wood wall + windmill
    projectiles = [shot(0, 5000 - 200, 5000)];
    ok(api.tryBowBlock(api.bowThreatSource()));
    eq(placed.length, 1);
    eq(placed[0].id, 10, 'should have placed the windmill');
});
t('the blocker goes down toward the shot, not away from it', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    projectiles = [shot(0, 5000 - 200, 5000)];      // coming from the west
    api.tryBowBlock(api.bowThreatSource());
    const a = placed[0].angle;
    ok(Math.abs(Math.abs(a) - Math.PI) < 0.3, 'expected roughly west (PI), got ' + a);
});
t('a wall is used when there is no mill', () => {
    reset();
    myPlayer.items = [0, 5, 6];                     // castle wall, no mill
    projectiles = [shot(0, 5000 - 200, 5000)];
    ok(api.tryBowBlock(api.bowThreatSource()));
    eq(placed[0].id, 5);
});
t('a turret shot is never answered with a wall', () => {
    reset();
    myPlayer.items = [0, 5, 6];                     // wall only, no mill
    const p = shot(1, 5000 - 200, 5000); p.layer = 1;
    projectiles = [p];
    const src = api.bowThreatSource();
    ok(src.turret, 'the source should be flagged as a turret shot');
    no(api.tryBowBlock(src), 'a wall cannot stop a layer-1 projectile');
    eq(placed.length, 0);
});
t('a turret shot IS answered with a mill', () => {
    reset();
    myPlayer.items = [0, 5, 6, 12];                 // wall + power mill
    const p = shot(1, 5000 - 200, 5000); p.layer = 1;
    projectiles = [p];
    ok(api.tryBowBlock(api.bowThreatSource()));
    eq(placed[0].id, 12, 'the mill is the only thing that stops it');
});
t('a group at its limit is skipped', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    limitReached[10] = true;                        // mills maxed
    projectiles = [shot(0, 5000 - 200, 5000)];
    ok(api.tryBowBlock(api.bowThreatSource()));
    eq(placed[0].id, 3, 'should fall back to the wall');
});
t('nothing owned means nothing placed', () => {
    reset();
    myPlayer.items = [0, 6];                        // food and spikes only
    projectiles = [shot(0, 5000 - 200, 5000)];
    no(api.tryBowBlock(api.bowThreatSource()));
});
t('a blocked spot is retried a little either side', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    let calls = 0;
    canPlace = (id, a) => (++calls > 2);             // first two angles occupied
    projectiles = [shot(0, 5000 - 200, 5000)];
    ok(api.tryBowBlock(api.bowThreatSource()));
    ok(calls >= 3, 'should have tried offsets');
    canPlace = () => placeableAngles;
});
t('one blocker per shot, not a wall every tick', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    projectiles = [shot(0, 5000 - 200, 5000)];
    ok(api.tryBowBlock(api.bowThreatSource()));
    no(api.tryBowBlock(api.bowThreatSource()), 'the cooldown should hold');
    eq(placed.length, 1);
});
t('the packet budget is respected', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    packets = 118;
    projectiles = [shot(0, 5000 - 200, 5000)];
    no(api.tryBowBlock(api.bowThreatSource()));
});
t('the toggle turns blocking off', () => {
    reset();
    window.vars.antiBowBlock = false;
    myPlayer.items = [0, 3, 6, 10];
    projectiles = [shot(0, 5000 - 200, 5000)];
    no(api.tryBowBlock(api.bowThreatSource()));
});

// ---- dodging ----------------------------------------------------------------
console.log('\ndodging when nothing can be placed');
reset();
t('the step is perpendicular to the shot', () => {
    projectiles = [shot(0, 5000 - 200, 5000)];      // travelling east
    api.startBowDodge(api.bowThreatSource());
    const a = api.dodgeAngle;
    ok(a !== null, 'no dodge started');
    // east is 0, so perpendicular is +/- PI/2 (either side is a valid dodge)
    ok(UTILS.getAngleDist(a, Math.PI / 2) < 0.01 || UTILS.getAngleDist(a, -Math.PI / 2) < 0.01,
       'expected +/-PI/2, got ' + a);
});
t('it picks the side that is not walled off', () => {
    reset();
    projectiles = [shot(0, 5000 - 200, 5000)];
    // block the +PI/2 side (south, +y)
    visibleObjects = [{ x: 5000, y: 5070, ignoreCollision: false, getScale: () => 50 }];
    api.startBowDodge(api.bowThreatSource());
    // 3PI/2 and -PI/2 are the same heading; compare on the circle.
    ok(UTILS.getAngleDist(api.dodgeAngle, -Math.PI / 2) < 0.01,
       'should have gone north, got ' + api.dodgeAngle);
});
t('boxed in on both sides, no dodge', () => {
    reset();
    projectiles = [shot(0, 5000 - 200, 5000)];
    visibleObjects = [{ x: 5000, y: 5070, ignoreCollision: false, getScale: () => 50 },
                      { x: 5000, y: 4930, ignoreCollision: false, getScale: () => 50 }];
    api.startBowDodge(api.bowThreatSource());
    eq(api.dodgeAngle, null);
});
t('walk-over pads never block a dodge', () => {
    reset();
    projectiles = [shot(0, 5000 - 200, 5000)];
    visibleObjects = [{ x: 5000, y: 5070, ignoreCollision: true, getScale: () => 50 },
                      { x: 5000, y: 4930, ignoreCollision: true, getScale: () => 50 }];
    api.startBowDodge(api.bowThreatSource());
    ok(api.dodgeAngle !== null, 'a boost pad is not cover');
});
t('the dodge expires', () => {
    reset();
    projectiles = [shot(0, 5000 - 200, 5000)];
    api.startBowDodge(api.bowThreatSource());
    ok(api.dodgeUntil > Date.now(), 'window should be open');
    ok(api.dodgeUntil - Date.now() <= 250, 'and short: about two ticks');
});
t('the toggle turns dodging off', () => {
    reset();
    window.vars.antiBowDodge = false;
    projectiles = [shot(0, 5000 - 200, 5000)];
    api.startBowDodge(api.bowThreatSource());
    eq(api.dodgeAngle, null);
});

// ---- the source ------------------------------------------------------------
console.log('\nwhere the shot is coming from');
reset();
t('an arrow in the air beats the tell as the source', () => {
    projectiles = [shot(0, 5000 - 200, 5000)];
    enemiesNear = [enemy(2, 5000 + 800, 5000, 9, 5)];
    const src = api.bowThreatSource();
    ok(src.x < 5000, 'should point at the arrow to the west, not the enemy east');
});
t('with no arrow yet it falls back to the enemy that told', () => {
    reset();
    enemiesNear = [enemy(2, 5000 - 500, 5000, 9, 5)];
    const src = api.bowThreatSource();
    ok(src && src.x === 4500);
});
t('nothing happening, no source', () => {
    reset();
    eq(api.bowThreatSource(), null);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
