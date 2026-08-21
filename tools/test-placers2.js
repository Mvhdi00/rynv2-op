#!/usr/bin/env node
"use strict";
/*
 * test-placers2.js — runs src/placers2/engine.js against a simulated fight.
 *
 * The engine is written against the mod's module-scope world (myPlayer,
 * visibleObjects, tick, nearestEnemy, ...). Here that world is a stub, so the
 * decision logic, the recorder and the predictor can be exercised without a
 * browser or a game server. Item and group tables are copied from the shipped
 * bundle (src/game_index.js values).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const engineSrc = fs.readFileSync(path.join(ROOT, "src", "placers2", "engine.js"), "utf8")
    // the HUD talks to the DOM on a timer; not part of what is under test
    .replace(/setInterval\(yp2Hud, 500\);/, "");

// --- the pieces of the game the engine reads -------------------------------
const GROUPS = {
    spikes: { id: 2, name: "spikes", limit: 15, layer: 0 },
    trap: { id: 5, name: "trap", limit: 6, layer: -1 }
};
const ITEMS = [];
ITEMS[6] = { id: 6, name: "spikes", scale: 49, group: GROUPS.spikes };
ITEMS[7] = { id: 7, name: "greater spikes", scale: 52, group: GROUPS.spikes };
ITEMS[15] = { id: 15, name: "pit trap", scale: 50, placeOffset: -5, group: GROUPS.trap, trap: true };

const WEAPONS = [];
WEAPONS[5] = { name: "polearm", dmg: 45, range: 142, speed: 700 };
WEAPONS[10] = { name: "great hammer", dmg: 10, range: 275, speed: 400 };

const CONFIG = {
    mapScale: 14400, riverWidth: 724, playerScale: 35,
    isSandbox: false, inSandbox: false,
    weaponVariants: [{ val: 1 }, { val: 1.1 }, { val: 1.18 }, { val: 1.18 }]
};

const UTILS = {
    getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    toRad: (a) => a * Math.PI / 180
};

function segDist(ax, ay, bx, by, px, py) {
    const vx = bx - ax, vy = by - ay;
    const len = vx * vx + vy * vy;
    let t = len < 1e-9 ? 0 : ((px - ax) * vx + (py - ay) * vy) / len;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(ax + t * vx - px, ay + t * vy - py);
}

// --- world -----------------------------------------------------------------
function obj(o) {
    return Object.assign({
        active: true, isItem: true, sid: 0, x: 0, y: 0, scale: 49, id: 6,
        trap: false, dmg: true, health: 500, ignoreCollision: false,
        owner: { sid: 1 },
        getScale() { return this.scale; }
    }, o);
}
function player(p) {
    return Object.assign({
        sid: 2, x2: 0, y2: 0, xVel: 0, yVel: 0, scale: 35, alive: true,
        weapons: [5, 10], weaponVariants: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        items: [0, 3, 6, 10, 15, 17], itemCounts: {}, spikeDamage: 0, health: 100
    }, p);
}

const calls = { addPredict: [], place: [], send: [], defer: [] };

const harness = new Function("EXT", `
    "use strict";
    const { CONFIG, UTILS, ITEMS, WEAPONS, calls } = EXT;

    let tick = 0;
    let myPlayer = null;
    let visibleObjects = [];
    let predictObjects = [];
    let predictEnemyTraps = [];
    let enemiesNear = [];
    let nearestEnemy = null;
    let nearestTrap = null;
    let spikeDmgCount = 0;
    let predictMoveAngle = null;
    let spikes_our = [];
    let traps_our = [];
    let placedAngles = [];
    let bannedAngles = new Map();
    let packets = 0;
    let spamPrePlacer = false;
    let primaryReload = {};
    let secondaryReload = {};
    const items = { list: ITEMS, weapons: WEAPONS };
    const config = CONFIG;
    const botCtx = null;
    function inBotCtx() { return false; }
    function isAlly() { return false; }
    function addPredictObject(id, angle, preplace) { calls.addPredict.push({ id, angle, preplace, tick }); }
    function place(id, angle) { calls.place.push({ id, angle, tick }); }
    let autoaim = false;
    const io = { send: (op, a) => calls.send.push({ op, a, tick }) };
    function getAttackDir() { return 0; }
    function ctxDefer(fn, ms) { calls.defer.push(fn); return 0; }
    const window = { vars: {} };
    const document = { getElementById: () => null, createElement: () => ({ style: {} }), body: { appendChild() {} } };

${engineSrc}

    return {
        YP2,
        set(w) {
            if ("tick" in w) tick = w.tick;
            if ("myPlayer" in w) myPlayer = w.myPlayer;
            if ("visibleObjects" in w) visibleObjects = w.visibleObjects;
            if ("predictObjects" in w) predictObjects = w.predictObjects;
            if ("enemiesNear" in w) enemiesNear = w.enemiesNear;
            if ("nearestEnemy" in w) nearestEnemy = w.nearestEnemy;
            if ("nearestTrap" in w) nearestTrap = w.nearestTrap;
            if ("spikeDmgCount" in w) spikeDmgCount = w.spikeDmgCount;
            if ("predictMoveAngle" in w) predictMoveAngle = w.predictMoveAngle;
            if ("spikes_our" in w) spikes_our = w.spikes_our;
            if ("traps_our" in w) traps_our = w.traps_our;
            if ("packets" in w) packets = w.packets;
            if ("primaryReload" in w) primaryReload = w.primaryReload;
            if ("secondaryReload" in w) secondaryReload = w.secondaryReload;
            if ("predictEnemyTraps" in w) predictEnemyTraps = w.predictEnemyTraps;
        },
        vars: window.vars,
        get spam() { return spamPrePlacer; },
        resetSpam() { spamPrePlacer = false; }
    };
`)({ CONFIG, UTILS, ITEMS, WEAPONS, calls });

// --- assertions ------------------------------------------------------------
let pass = 0, fail = 0;
function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra ? "   " + extra : "")); }
}
function section(t) { console.log("\n" + t); }

const V = harness.vars;
function defaults() {
    Object.assign(V, {
        prePlace: true, replace: true,
        prePlace2: true, replace2: true,
        pp2Range: 320, pp2MaxPerTick: 2,
        pp2Instant: true, pp2PreArm: true, pp2Traps: false, pp2Debug: false,
        pp2SpikesOnly: true, pp2Direct: true, pp2AimLock: true, pp2Cage: true
    });
    calls.send.length = 0;
    calls.defer.length = 0;
}

// A fight: me at the origin, an enemy walking in from the east.
function fight(t, enemyX, enemyY, prevX, prevY) {
    const me = player({ sid: 1, x2: 0, y2: 0, xVel: 0, yVel: 0, itemCounts: {} });
    const e = player({ sid: 2, x2: enemyX, y2: enemyY, xVel: enemyX * 2 - prevX, yVel: enemyY * 2 - prevY });
    harness.set({
        tick: t, myPlayer: me, visibleObjects: [], predictObjects: [],
        enemiesNear: [e], nearestEnemy: e, nearestTrap: null, spikeDmgCount: 0,
        predictMoveAngle: null, spikes_our: [], traps_our: [], packets: 0,
        primaryReload: { 1: 1, 2: 1 }, secondaryReload: { 1: 1, 2: 1 },
        predictEnemyTraps: []
    });
    return { me, e };
}

// ===========================================================================
section("engine ownership");
defaults();
V.prePlace = true; V.replace = true;
harness.YP2.lock();
ok("v2 on forces v1 preplacer off", V.prePlace === false);
ok("v2 on forces v1 replacer off", V.replace === false);
V.prePlace2 = false; V.replace2 = false; V.prePlace = true; V.replace = true;
harness.YP2.lock();
ok("v2 off leaves v1 alone", V.prePlace === true && V.replace === true);

// ===========================================================================
section("preplace: an enemy walking in");
defaults();
calls.addPredict.length = 0;
let world;
for (let t = 1; t <= 4; t++) {
    const x = 300 - t * 30;
    world = fight(t, x, 0, x + 30, 0);
    harness.YP2.sample();
    harness.YP2.run();
}
ok("something was committed", calls.addPredict.length > 0,
   "commits=" + calls.addPredict.length);
ok("committed for this tick, not the end of it (Build Instantly)",
   calls.addPredict.every(c => c.preplace === false));
{
    const last = calls.addPredict[calls.addPredict.length - 1];
    const it = ITEMS[last.id];
    const off = 35 + it.scale + (it.placeOffset || 0);
    const px = off * Math.cos(last.angle), py = off * Math.sin(last.angle);
    // the enemy is due east, so the placement must be on that side
    ok("placed between me and the enemy", px > 0, "x=" + px.toFixed(1) + " y=" + py.toFixed(1));
    ok("placement is within the enemy's reach of my body",
       Math.hypot(px, py) < 150, "d=" + Math.hypot(px, py).toFixed(1));
    // and it must actually stand on the path the enemy is walking
    const e = world.e;
    const d = segDist(e.x2, e.y2, e.x2 - 30, e.y2, px, py);
    ok("the placement intercepts the enemy's path",
       d < it.scale + 35, "gap=" + (d - it.scale - 35).toFixed(1) + "px");
}

// ===========================================================================
section("predictor beats the game's one-step guess");
{
    defaults();
    // a curving, accelerating approach — the case a linear guess gets wrong
    let ex = 320, ey = -140, vx = -26, vy = 11, prev = { x: 346, y: -151 };
    let engineErr = 0, linearErr = 0, n = 0;
    for (let t = 10; t <= 22; t++) {
        const f = fight(t, ex, ey, prev.x, prev.y);
        harness.YP2.sample();
        harness.YP2.run();
        // the game's own guess for the next tick is (xVel, yVel)
        const linear = { x: f.e.xVel, y: f.e.yVel };
        prev = { x: ex, y: ey };
        vx += 2.2; vy -= 1.6;              // they turn and speed up
        ex += vx; ey += vy;
        if (t > 11) {
            linearErr += Math.hypot(linear.x - ex, linear.y - ey);
            n++;
        }
    }
    // one more sample so the last prediction is scored
    fight(23, ex, ey, prev.x, prev.y);
    harness.YP2.sample();
    const m = harness.YP2.metrics();
    engineErr = m.predictErrorPx;
    linearErr /= n;
    ok("engine measured its own prediction error", m.predictErrorPx > 0);
    ok("engine error beats the linear guess",
       engineErr < linearErr, "engine=" + engineErr.toFixed(1) + "px linear=" + linearErr.toFixed(1) + "px");
}

// ===========================================================================
section("item limits");
{
    defaults();
    calls.addPredict.length = 0;
    const f = fight(40, 150, 0, 180, 0);
    f.me.itemCounts[GROUPS.spikes.id] = 15;   // real cap outside sandbox
    f.me.itemCounts[GROUPS.trap.id] = 6;
    harness.YP2.sample();
    harness.YP2.run();
    ok("no placement once both groups are at their real limit", calls.addPredict.length === 0,
       "commits=" + calls.addPredict.length);

    calls.addPredict.length = 0;
    const g = fight(41, 150, 0, 180, 0);
    g.me.itemCounts[GROUPS.spikes.id] = 14;
    g.me.itemCounts[GROUPS.trap.id] = 6;
    harness.YP2.sample();
    harness.YP2.run();
    ok("one spike left is still spent", calls.addPredict.length === 1 && ITEMS[calls.addPredict[0].id].group.id === 2);
}

// ===========================================================================
section("no free ground");
{
    defaults();
    calls.addPredict.length = 0;
    const f = fight(50, 150, 0, 180, 0);
    // ring me completely with walls
    const wall = [];
    for (let i = 0; i < 24; i++) {
        const a = i * Math.PI * 2 / 24;
        wall.push(obj({ sid: 100 + i, x: 120 * Math.cos(a), y: 120 * Math.sin(a), scale: 50, id: 3, dmg: false }));
    }
    harness.set({ visibleObjects: wall });
    harness.YP2.sample();
    harness.YP2.run();
    ok("walled in: nothing committed, nothing thrown", calls.addPredict.length === 0);
    ok("engine still healthy", harness.YP2.metrics().disabled === false);
}

// ===========================================================================
section("replace 2: instant refill on freed ground");
{
    // A break nothing saw coming (a turret, a bull, a hit we did not model):
    // the spike is at full health, so the tick's preplace pass had no reason to
    // touch that ground. This is the case the instant path exists for.
    defaults();
    calls.place.length = 0;
    calls.addPredict.length = 0;
    fight(60, 140, 0, 170, 0);
    const mine = obj({ sid: 900, x: 84, y: 0, scale: 49, id: 6, owner: { sid: 1 }, health: 500 });
    harness.set({ visibleObjects: [mine], spikes_our: [mine] });
    harness.YP2.sample();                 // record it
    harness.YP2.run();
    calls.place.length = 0;
    mine.active = false;                  // ...and now it is gone
    harness.YP2.removed(900);
    ok("refill went out in the same turn", calls.place.length === 1,
       "places=" + calls.place.length);
    if (calls.place.length) {
        const c = calls.place[0];
        const it = ITEMS[c.id];
        const off = 35 + it.scale + (it.placeOffset || 0);
        const px = off * Math.cos(c.angle), py = off * Math.sin(c.angle);
        ok("refill lands near the ground that was freed",
           Math.hypot(px - 84, py - 0) < 130, "d=" + Math.hypot(px - 84, py).toFixed(1));
    }
    ok("the refill was counted as instant", harness.YP2.metrics().instant >= 1);
}

section("replace 2: a predicted break is claimed early AND refilled when it lands");
{
    // One hit from death, enemy loaded and in range. The preplace pass treats
    // that ground as already open and builds the cage around it this tick; when
    // the break actually lands the freed spot is filled as well. Both, not one:
    // a spike that is gone is a hole the enemy walks out through.
    defaults();
    calls.place.length = 0;
    calls.addPredict.length = 0;
    // (tick 68: past the spot reservation the previous scenario left behind)
    fight(68, 130, 0, 160, 0);
    const doomed = obj({ sid: 905, x: 84, y: 0, scale: 49, id: 6, owner: { sid: 1 }, health: 20 });
    harness.set({ visibleObjects: [doomed], spikes_our: [doomed] });
    harness.YP2.sample();
    harness.YP2.run();
    const near = calls.addPredict.filter(c => {
        const it = ITEMS[c.id];
        const off = 35 + it.scale + (it.placeOffset || 0);
        return Math.hypot(off * Math.cos(c.angle) - 84, off * Math.sin(c.angle)) < 140;
    });
    ok("the doomed ground is built around before the break", near.length > 0,
       "commits=" + calls.addPredict.length);
    ok("a placement onto still-occupied ground keeps the late timing",
       calls.addPredict.every(c => {
           const it = ITEMS[c.id];
           const off = 35 + it.scale + (it.placeOffset || 0);
           const onIt = Math.hypot(off * Math.cos(c.angle) - 84, off * Math.sin(c.angle)) < 98;
           return !onIt || c.preplace === true;
       }));
    calls.place.length = 0;
    doomed.active = false;
    harness.YP2.removed(905);
    ok("and the freed spot is filled the moment it opens", calls.place.length === 1,
       "places=" + calls.place.length);
}

// ===========================================================================
section("spikes only");
{
    defaults();                      // pp2SpikesOnly on by default
    calls.addPredict.length = 0;
    for (let t = 130; t <= 132; t++) {
        const x = 200 - (t - 130) * 25;
        fight(t, x, 0, x + 25, 0);
        harness.YP2.sample();
        harness.YP2.run();
    }
    ok("not one trap was spent", calls.addPredict.every(c => ITEMS[c.id].group.id === 2),
       JSON.stringify(calls.addPredict.map(c => ITEMS[c.id].name)));

    // With the spikes spent, Spikes Only is the difference between a trap and
    // nothing at all — which is the switch, stated as plainly as it gets.
    defaults();
    calls.addPredict.length = 0;
    let f = fight(140, 120, 0, 145, 0);
    f.me.itemCounts[GROUPS.spikes.id] = 15;     // no spikes left
    harness.YP2.sample();
    harness.YP2.run();
    ok("Spikes Only: out of spikes means nothing is placed", calls.addPredict.length === 0,
       JSON.stringify(calls.addPredict.map(c => ITEMS[c.id].name)));

    defaults();
    V.pp2SpikesOnly = false; V.pp2Traps = true;
    calls.addPredict.length = 0;
    f = fight(145, 120, 0, 145, 0);
    f.me.itemCounts[GROUPS.spikes.id] = 15;
    harness.YP2.sample();
    harness.YP2.run();
    ok("Spikes Only off lets it spend traps again",
       calls.addPredict.length > 0 && calls.addPredict.every(c => ITEMS[c.id].group.id === 5),
       JSON.stringify(calls.addPredict.map(c => ITEMS[c.id].name)));
}

// ===========================================================================
section("aim never stays on the building");
{
    defaults();
    fight(150, 0, 120, 0, 150);       // enemy due south
    const mine = obj({ sid: 980, x: 84, y: 0, scale: 49, id: 6, owner: { sid: 1 }, health: 500 });
    harness.set({ visibleObjects: [mine], spikes_our: [mine] });
    harness.YP2.sample();
    harness.YP2.run();
    calls.send.length = 0;
    calls.place.length = 0;
    mine.active = false;
    harness.YP2.removed(980);
    ok("the refill went out", calls.place.length === 1);
    const aim = calls.send.filter(s => s.op === "D");
    ok("an aim packet followed it", aim.length === 1, JSON.stringify(calls.send));
    if (aim.length) {
        const want = Math.atan2(120 - 0, 0 - 0);   // straight at the enemy
        let diff = Math.abs(aim[0].a - want);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        ok("and it points at the enemy, not at the build angle", diff < 0.01,
           "aim=" + aim[0].a.toFixed(2) + " want=" + want.toFixed(2) +
           " build=" + calls.place[0].angle.toFixed(2));
    }
    // ...and the tick pass queues the same correction after its own placements
    calls.defer.length = 0;
    calls.addPredict.length = 0;
    fight(156, 0, 115, 0, 130);   // past the reservations the refill just made
    harness.YP2.sample();
    harness.YP2.run();
    ok("the tick pass queues the same correction",
       calls.addPredict.length > 0 && calls.defer.length > 0,
       "commits=" + calls.addPredict.length + " deferred=" + calls.defer.length);
}

// ===========================================================================
section("cage: more than one spike in a tick when they are on top of you");
{
    defaults();
    calls.addPredict.length = 0;
    fight(160, 90, 0, 95, 0);         // adjacent, barely moving — they are on me
    harness.YP2.sample();
    harness.YP2.run();
    ok("the tick spends more than one spike", calls.addPredict.length >= 2,
       "commits=" + calls.addPredict.length);
    const angles = calls.addPredict.map(c => c.angle);
    const spread = angles.every((a, i) => angles.every((b, j) => i === j || Math.abs(a - b) > 0.2));
    ok("and they are different spots, not the same one twice", spread,
       JSON.stringify(angles.map(a => a.toFixed(2))));

    defaults();
    V.pp2Cage = false;
    calls.addPredict.length = 0;
    fight(170, 90, 0, 95, 0);
    harness.YP2.sample();
    harness.YP2.run();
    ok("Cage off holds it to the slider", calls.addPredict.length <= V.pp2MaxPerTick,
       "commits=" + calls.addPredict.length);
}

// ===========================================================================
section("a spike between me and the enemy is still rebuilt");
{
    // This is the one the old line-of-sight penalty used to veto: the broken
    // spike sits exactly between the two of you, which is where a cage spike
    // belongs.
    defaults();
    calls.place.length = 0;
    fight(180, 170, 0, 175, 0);
    const between = obj({ sid: 990, x: 84, y: 0, scale: 49, id: 6, owner: { sid: 1 }, health: 500 });
    harness.set({ visibleObjects: [between], spikes_our: [between] });
    harness.YP2.sample();
    harness.YP2.run();
    calls.place.length = 0;
    between.active = false;
    harness.YP2.removed(990);
    ok("it goes straight back", calls.place.length === 1, "places=" + calls.place.length);
    if (calls.place.length) {
        const c = calls.place[0];
        const it = ITEMS[c.id];
        const off = 35 + it.scale + (it.placeOffset || 0);
        ok("and back onto the ground it was on",
           Math.hypot(off * Math.cos(c.angle) - 84, off * Math.sin(c.angle)) < 60,
           "d=" + Math.hypot(off * Math.cos(c.angle) - 84, off * Math.sin(c.angle)).toFixed(1));
    }
}

// ===========================================================================
section("replace 2: only our own buildings, only near the fight");
{
    defaults();
    calls.place.length = 0;
    const f = fight(76, 140, 0, 170, 0);
    const theirs = obj({ sid: 901, x: 84, y: 0, id: 6, owner: { sid: 2 } });
    harness.set({ visibleObjects: [theirs] });
    harness.YP2.sample();
    theirs.active = false;
    harness.YP2.removed(901);
    ok("an enemy building is not refilled", calls.place.length === 0);

    calls.place.length = 0;
    const g = fight(77, 140, 0, 170, 0);
    const far = obj({ sid: 902, x: 900, y: 900, id: 6, owner: { sid: 1 } });
    harness.set({ visibleObjects: [far] });
    harness.YP2.sample();
    far.active = false;
    harness.YP2.removed(902);
    ok("a building far from the fight is not refilled", calls.place.length === 0);
}

// ===========================================================================
section("replace 2: a disappearance that never called killObject");
{
    // Bot worlds delete objects on their own path, and a mass removal never
    // calls killObject at all. The tick sweep has to catch those too.
    defaults();
    calls.addPredict.length = 0;
    const gone = obj({ sid: 970, x: 0, y: 84, scale: 49, id: 6, owner: { sid: 1 }, health: 500 });
    fight(120, 0, 140, 0, 170);
    harness.set({ visibleObjects: [gone], spikes_our: [gone] });
    harness.YP2.sample();
    harness.YP2.run();
    calls.addPredict.length = 0;
    fight(121, 0, 130, 0, 140);
    harness.set({ visibleObjects: [] });   // simply not there any more
    harness.YP2.sample();
    harness.YP2.run();
    const filled = calls.addPredict.some(c => {
        const it = ITEMS[c.id];
        const off = 35 + it.scale + (it.placeOffset || 0);
        return Math.hypot(off * Math.cos(c.angle) - 0, off * Math.sin(c.angle) - 84) < 130;
    });
    ok("the freed ground is filled on the next tick", filled,
       "commits=" + calls.addPredict.length);
}

// ===========================================================================
section("recorder: placements are confirmed or written off");
{
    defaults();
    V.replace2 = false;
    calls.addPredict.length = 0;
    const before = harness.YP2.metrics();
    let f = fight(80, 150, 0, 180, 0);
    harness.YP2.sample();
    harness.YP2.run();
    const committed = calls.addPredict[calls.addPredict.length - 1];
    const it = ITEMS[committed.id];
    const off = 35 + it.scale + (it.placeOffset || 0);
    const landed = obj({
        sid: 950, id: committed.id, scale: it.scale,
        x: off * Math.cos(committed.angle), y: off * Math.sin(committed.angle),
        owner: { sid: 1 }
    });
    // next tick the object is there — the ledger should confirm it
    f = fight(81, 150, 0, 180, 0);
    harness.set({ visibleObjects: [landed] });
    harness.YP2.sample();
    ok("a placement that landed is confirmed",
       harness.YP2.metrics().confirmed > before.confirmed,
       JSON.stringify(harness.YP2.metrics()));

    // and one that never appears is written off after the deadline
    const lostBefore = harness.YP2.metrics().lost;
    calls.addPredict.length = 0;
    for (let t = 82; t <= 90; t++) {
        fight(t, 150, 0, 180, 0);
        harness.YP2.sample();
        harness.YP2.run();
    }
    ok("a placement that never appeared is written off",
       harness.YP2.metrics().lost > lostBefore,
       "lost=" + harness.YP2.metrics().lost);
    ok("accept rate is a real number", typeof harness.YP2.metrics().accept === "number");
}

// ===========================================================================
section("rate limit and packet budget");
{
    defaults();
    V.pp2MaxPerTick = 1;
    calls.addPredict.length = 0;
    fight(100, 150, 0, 180, 0);
    harness.YP2.sample();
    harness.YP2.run();
    ok("one placement per tick when told one", calls.addPredict.length <= 1);

    defaults();
    calls.place.length = 0;
    const f = fight(101, 140, 0, 170, 0);
    const mine = obj({ sid: 960, x: 84, y: 0, id: 6, owner: { sid: 1 } });
    harness.set({ visibleObjects: [mine], packets: 118 });
    harness.YP2.sample();
    mine.active = false;
    harness.YP2.removed(960);
    ok("no instant place with the packet budget spent", calls.place.length === 0);
}

// ===========================================================================
section("engagement range");
{
    defaults();
    calls.addPredict.length = 0;
    V.pp2Range = 200;
    fight(110, 480, 0, 500, 0);
    harness.YP2.sample();
    harness.YP2.run();
    ok("nothing placed for an enemy out of range", calls.addPredict.length === 0);
}

// ===========================================================================
section("cost");
{
    defaults();
    const objects = [];
    // a sparse field, the way a real map looks: enough to scan, not a cage
    for (let i = 0; i < 240; i++) {
        const gx = -1400 + (i % 20) * 150;
        const gy = -900 + Math.floor(i / 20) * 150;
        if (Math.hypot(gx, gy) < 190) continue;          // leave me room to build
        objects.push(obj({ sid: 2000 + i, x: gx, y: gy, scale: 40, id: 3, dmg: false }));
    }
    let t0 = process.hrtime.bigint();
    for (let t = 200; t < 260; t++) {
        const x = 300 - (t % 20) * 12;
        fight(t, x, 20, x + 12, 18);
        harness.set({ visibleObjects: objects });
        harness.YP2.sample();
        harness.YP2.run();
    }
    const us = Number(process.hrtime.bigint() - t0) / 1000 / 60;
    ok("under 1 ms of decision time per tick with a full field of objects",
       us < 1000, us.toFixed(0) + " us/tick");
    ok("candidates were actually generated", harness.YP2.metrics().candidates > 0,
       "candidates=" + harness.YP2.metrics().candidates);
    console.log("       reported: " + JSON.stringify(harness.YP2.metrics()));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
