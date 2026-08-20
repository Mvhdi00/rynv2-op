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
// The trap play the speculative defence has to yield to: your traps, the enemy
// nearest you, and what is in your off hand.
let traps_our = [], nearestEnemy = null, mySecondary = 'hammer';
function getPlayerInfo(p, what) { return what === 'secondaryWeapon' ? mySecondary : null; }
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
// The real helpers the block leans on, copied in.
function botClamp(v, lo, hi) { v = Number(v); if (!isFinite(v)) return lo; return v < lo ? lo : (v > hi ? hi : v); }
function lineInCircle(x, y, x2, y2, cx, cy, scale) {
    const lv = { x: x2 - x, y: y2 - y };
    const tc = { x: cx - x, y: cy - y };
    const proj = (tc.x * lv.x + tc.y * lv.y) / (lv.x * lv.x + lv.y * lv.y);
    const cp = { x: x + proj * lv.x, y: y + proj * lv.y };
    if (cp.x >= Math.min(x, x2) && cp.x <= Math.max(x, x2) &&
        cp.y >= Math.min(y, y2) && cp.y <= Math.max(y, y2)) {
        return UTILS.getDistance(cp.x, cp.y, cx, cy) < scale;
    }
    return false;
}
// A structure standing in the world, for line-of-sight tests.
function obj(x, y, scale = 50, layer = 0, ignoreCollision = false) {
    return { active: true, x, y, layer, ignoreCollision, getScale: () => scale };
}
let placeableAngles = true, limitReached = {};
let soldierAnti = false, equippedHat = 0, ownedHats = { 6: true };
function isBoughtHat(id) { return !!ownedHats[id]; }
function hat(id) { equippedHat = id; }
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
    + ' tryPreBlock, rangedEnemyWithLineOnMe, lineIsCovered, placeBlockerToward,'
    + ' onProjectileSpawned, inTrapPlay, get soldier() { return soldierAnti; },'
    + ' resetBlock() { bowDodgeAngle = null; bowDodgeUntil = 0; bowLastBlock = 0; preBlockAt = 0; } })');

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
    window.vars = { antiBowInsta: true, antiBowMinDist: 0, antiBowBlock: true, antiBowDodge: true,
                    antiBowPreBlock: true, antiBowPreSoldier: true, preBlockRange: 900,
                    antiBowYieldToTick: true };
    enemiesNear = []; projectiles = []; tick = 100;
    visibleObjects = []; packets = 0; placed.length = 0;
    traps_our = []; nearestEnemy = null; mySecondary = 'hammer';
    placeableAngles = true; limitReached = {};
    soldierAnti = false; equippedHat = 0; ownedHats = { 6: true };
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

t('the blocker follows the shot around all eight directions', () => {
    const dirs = [['E',1,0],['NE',1,-1],['N',0,-1],['NW',-1,-1],
                  ['W',-1,0],['SW',-1,1],['S',0,1],['SE',1,1]];
    for (const [label, dx, dy] of dirs) {
        reset();
        myPlayer.items = [0, 3, 6, 10];
        const L = Math.hypot(dx, dy);
        const sx = 5000 + (dx / L) * 300, sy = 5000 + (dy / L) * 300;
        projectiles = [shot(0, sx, sy)];                 // fired from that side
        ok(api.tryBowBlock(api.bowThreatSource()), label + ': nothing placed');
        const want = Math.atan2(sy - 5000, sx - 5000);   // from me toward the shot
        ok(UTILS.getAngleDist(placed[0].angle, want) < 0.3,
           label + ': placed at ' + placed[0].angle.toFixed(2) + ' want ' + want.toFixed(2));
    }
});
t('an enemy directly behind gets a blocker directly behind', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    // facing east, shot coming from due west (behind)
    projectiles = [shot(0, 5000 - 300, 5000)];
    api.tryBowBlock(api.bowThreatSource());
    ok(UTILS.getAngleDist(placed[0].angle, Math.PI) < 0.3,
       'expected roughly PI (west/behind), got ' + placed[0].angle.toFixed(2));
});
t('the blocker tracks the arrow, not the shooter who has since moved', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    projectiles = [shot(0, 5000 - 300, 5000)];           // arrow to the west
    enemiesNear = [enemy(2, 5000 + 700, 5000, 9, 5)];     // shooter now to the east
    api.tryBowBlock(api.bowThreatSource());
    ok(UTILS.getAngleDist(placed[0].angle, Math.PI) < 0.3,
       'should block the arrow (west), got ' + placed[0].angle.toFixed(2));
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


// ---- pre-block: cover before the shot ---------------------------------------
console.log('\npre-block, before anything is fired');
reset();
function armed(sid, x, y, sec = 9) {
    const e = enemy(sid, x, y, 5, 0);
    e.weapons = [5, sec];          // they have shown they carry a bow
    return e;
}
t('an armed enemy with an open line gets cover built on it', () => {
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(2, 5000 - 400, 5000)];
    ok(api.tryPreBlock(), 'nothing was placed');
    ok(UTILS.getAngleDist(placed[0].angle, Math.PI) < 0.3, 'cover should face them');
});
t('it prefers the mill, which also stops turret shots', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(2, 5000 - 400, 5000)];
    api.tryPreBlock();
    eq(placed[0].id, 10);
});
t('nobody armed, nothing built', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [enemy(2, 5000 - 400, 5000, 5, 0)];   // pure melee
    no(api.tryPreBlock());
});
t('a line that is already covered is left alone', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(2, 5000 - 400, 5000)];
    visibleObjects = [obj(5000 - 200, 5000)];           // a wall already between us
    no(api.tryPreBlock(), 'should not spend a mill on a line that is already blocked');
});
t('walk-over pads are not cover', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(2, 5000 - 400, 5000)];
    visibleObjects = [obj(5000 - 200, 5000, 50, -1, true)];   // boost pad
    ok(api.tryPreBlock(), 'a boost pad should not count as cover');
});
t('out of firing range is not worth a mill', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    window.vars.preBlockRange = 400;
    enemiesNear = [armed(2, 5000 - 900, 5000)];
    no(api.tryPreBlock());
});
t('it covers the nearest open line when several are armed', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(2, 5000 - 800, 5000), armed(3, 5000 + 250, 5000)];
    ok(api.tryPreBlock());
    ok(Math.abs(placed[0].angle) < 0.3, 'should cover the closer one to the east, got ' + placed[0].angle.toFixed(2));
});
t('an enemy currently holding a bow counts even with no history', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    const e = enemy(2, 5000 - 400, 5000, 9, 9);
    e.weapons = [5, undefined];
    enemiesNear = [e];
    ok(api.tryPreBlock());
});
t('upkeep has a slower beat than the panic block', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(2, 5000 - 400, 5000)];
    ok(api.tryPreBlock());
    no(api.tryPreBlock(), 'should not build again immediately');
    eq(placed.length, 1);
});
t('the toggle turns pre-block off', () => {
    reset();
    window.vars.antiBowPreBlock = false;
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(2, 5000 - 400, 5000)];
    no(api.tryPreBlock());
});
t('the packet budget is respected here too', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    packets = 118;
    enemiesNear = [armed(2, 5000 - 400, 5000)];
    no(api.tryPreBlock());
});

console.log('\nline of sight');
reset();
t('a wall on the segment counts', () => {
    visibleObjects = [obj(5200, 5000)];
    ok(api.lineIsCovered(5000, 5000, 5400, 5000));
});
t('a wall off to the side does not', () => {
    reset();
    visibleObjects = [obj(5200, 5300)];
    no(api.lineIsCovered(5000, 5000, 5400, 5000));
});
t('a wall past the far end does not', () => {
    reset();
    visibleObjects = [obj(5800, 5000)];
    no(api.lineIsCovered(5000, 5000, 5400, 5000));
});
t('a trap on the ground is not cover', () => {
    reset();
    visibleObjects = [obj(5200, 5000, 50, -1, false)];   // layer -1
    no(api.lineIsCovered(5000, 5000, 5400, 5000));
});


// ---- the instant path -------------------------------------------------------
console.log('\nreacting on the packet, not the next tick');
reset();
t('a musket spawning gets helmet + blocker on the spot', () => {
    myPlayer.items = [0, 3, 6, 10];
    const p = shot(5, 5000 - 300, 5000);
    api.onProjectileSpawned(p);
    ok(api.soldier, 'soldierAnti not raised');
    eq(equippedHat, 6, 'the helmet was not sent directly');
    eq(placed.length, 1, 'no blocker went down');
});
t('it dodges when nothing can be built', () => {
    reset();
    myPlayer.items = [0, 6];                      // no wall, no mill
    api.onProjectileSpawned(shot(5, 5000 - 300, 5000));
    ok(api.dodgeAngle !== null, 'should have stepped out of the line');
});
t('a shot that misses is left alone', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    api.onProjectileSpawned(shot(0, 5000 - 200, 5000, 0.6));
    eq(placed.length, 0);
    no(api.soldier);
});
t('a shot going the other way is left alone', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    api.onProjectileSpawned(shot(0, 5000 - 200, 5000, Math.PI));
    eq(placed.length, 0);
});
t('the spawn window is wider than the tick window', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    // 600 units of bow flight is 375 ms: past the tick path's 260, inside 450
    const far = shot(0, 5000 - 600, 5000);
    projectiles = [far];
    eq(api.bowIncomingProjectileDamage(), 0, 'the tick path should ignore it');
    api.onProjectileSpawned(far);
    eq(placed.length, 1, 'the spawn path should act on it early');
});
t('a shot too far out is still ignored', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    api.onProjectileSpawned(shot(0, 5000 - 1000, 5000));   // 625 ms
    eq(placed.length, 0);
});
t('a turret shot on spawn is answered with a mill, never a wall', () => {
    reset();
    myPlayer.items = [0, 5, 6];                   // wall only
    const p = shot(1, 5000 - 300, 5000); p.layer = 1;
    api.onProjectileSpawned(p);
    eq(placed.length, 0, 'a wall cannot stop it, so nothing should be placed');
    ok(api.dodgeAngle !== null, 'it should dodge instead');
});
t('the toggle silences the instant path', () => {
    reset();
    window.vars.antiBowInsta = false;
    myPlayer.items = [0, 3, 6, 10];
    api.onProjectileSpawned(shot(5, 5000 - 300, 5000));
    eq(placed.length, 0);
    no(api.soldier);
});
t('being dead silences it', () => {
    reset();
    myPlayer.alive = false;
    myPlayer.items = [0, 3, 6, 10];
    api.onProjectileSpawned(shot(5, 5000 - 300, 5000));
    eq(placed.length, 0);
});

console.log('\nwhat one blocked projectile is worth');
t('removing ANY single shot from the four-piece makes it survivable', () => {
    const P = { bow: 25, crossbow: 35, musket: 50, turret: 25 };
    const all = P.bow + P.crossbow + P.musket + P.turret;
    ok(all * 0.75 > 100, 'the full four-piece should still be lethal in soldier');
    for (const k of Object.keys(P)) {
        const left = (all - P[k]) * 0.75;
        ok(left < 100, 'blocking the ' + k + ' should save you, got ' + left);
    }
});
t('soldier is the only damage reduction that exists', () => {
    // game_index.js: changeHealth applies skin.dmgMult and tail.dmgMult, and
    // dmgMult appears on exactly one item in the whole game.
    ok(0.75 * 135 > 100, 'so 135 raw cannot be survived by gear alone');
});


// ---------------------------------------------------------------------------
// Yielding to a live trap play.
//
// Two of the three defensive halves are speculative: the pre-block builds cover
// every 700 ms whenever anyone with a bow has a line, and the tell-driven half
// blocks or sidesteps on a weapon swap. Both cost the trap tick — a wall in the
// spot canTrapTick() needs, an angle banned for 18 ticks, or a sidestep out of
// the dist(trap, me) < scale + 95 window. While the play is live they stand
// down. The arrow-already-in-the-air path does not.
// ---------------------------------------------------------------------------
function trapPlay(hammer, inside) {
    nearestEnemy = enemy(7, 5000, 5120, 0, 5);
    mySecondary = (hammer === false) ? 'bow' : 'hammer';
    // Out of the play means the trap is somewhere else, not that it is small.
    traps_our = [{ x: (inside === false) ? 5600 : 5000, y: 5120, scale: 50 }];
}
console.log('\nyielding to a live trap play');
t('their body in my trap with a hammer in hand is a live play', () => {
    reset(); trapPlay();
    ok(api.inTrapPlay());
});
t('no hammer, no play', () => {
    reset(); trapPlay(false);
    no(api.inTrapPlay());
});
t('a trap they are not standing in is not a play', () => {
    reset(); trapPlay(true, false);
    no(api.inTrapPlay());
});
t('no trap at all is not a play', () => {
    reset();
    nearestEnemy = enemy(7, 5000, 5120, 0, 5);
    no(api.inTrapPlay());
});
t('the toggle turns the yielding off', () => {
    reset(); trapPlay();
    window.vars.antiBowYieldToTick = false;
    no(api.inTrapPlay());
});
t('the pre-block stands down during the play', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(3, 5000 - 400, 5000)];
    ok(api.tryPreBlock(), 'it should build with no play running');
    reset();
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(3, 5000 - 400, 5000)];
    trapPlay();
    no(api.tryPreBlock(), 'it built a wall in the middle of the tick');
    eq(placed.length, 0);
});
t('and starts again the moment they are out of the trap', () => {
    reset();
    myPlayer.items = [0, 3, 6, 10];
    enemiesNear = [armed(3, 5000 - 400, 5000)];
    trapPlay();
    no(api.tryPreBlock());
    traps_our = [];
    ok(api.tryPreBlock(), 'cover should come back once the play is over');
});
t('an arrow already in the air is still answered mid-play', () => {
    reset();
    trapPlay();
    api.onProjectileSpawned(shot(0, 5000, 4800));
    eq(api.soldier, true, 'the helmet is free and always goes on');
    ok(placed.length > 0 || api.dodgeAngle !== null,
       'a real shot outranks the tick and must still be answered');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
