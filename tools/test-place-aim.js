#!/usr/bin/env node
"use strict";

// Tests for the placer aiming layer in YoRHa_System.user.js.
//
// The placer lives inside the userscript's one big closure, so the two marked
// blocks are lifted out of the file as source and instantiated here with every
// free variable they read passed in as a parameter. That means these tests run
// the shipped code, not a copy of it: edit the script and the tests follow.
//
//   node tools/test-place-aim.js

const fs = require("fs");
const path = require("path");

const SCRIPT = path.join(__dirname, "..", "YoRHa_System.user.js");
const source = fs.readFileSync(SCRIPT, "utf8");

function lift(startMark, endMark) {
    const start = source.indexOf(startMark);
    const end = source.indexOf(endMark);
    if (start < 0 || end < 0 || end < start) {
        throw new Error("markers not found in YoRHa_System.user.js: " + startMark);
    }

    return source.slice(start + startMark.length, end);
}

const AIM_SRC = lift("// ---8<--- aim layer, lifted by tools/test-place-aim.js ---8<---",
                     "// ---8<--- end aim layer ---8<---");
const SCORE_SRC = lift("// ---8<--- placer scoring, lifted by tools/test-place-aim.js ---8<---",
                       "// ---8<--- end placer scoring ---8<---");

// The game's own UTILS, the three the placer uses. getDistance/getAngleDist are
// trivial; lineInRect is copied from the bundle so the segment test the placer
// gets here is the one it gets in game.
const UTILS = {
    getDistance: (x1, y1, x2, y2) => Math.sqrt((x2 -= x1) * x2 + (y2 -= y1) * y2),
    getAngleDist: (a, b) => {
        const p = Math.abs(b - a) % (Math.PI * 2);
        return p > Math.PI ? (Math.PI * 2) - p : p;
    },
    lineInRect: (recX, recY, recX2, recY2, x1, y1, x2, y2) => {
        let minX = x1, maxX = x2;
        if (x1 > x2) { minX = x2; maxX = x1; }
        if (maxX > recX2) maxX = recX2;
        if (minX < recX) minX = recX;
        if (minX > maxX) return false;
        let minY = y1, maxY = y2;
        const dx = x2 - x1;
        if (Math.abs(dx) > 0.0000001) {
            const a = (y2 - y1) / dx;
            const b = y1 - a * x1;
            minY = a * minX + b;
            maxY = a * maxX + b;
        }
        if (minY > maxY) { const tmp = maxY; maxY = minY; minY = tmp; }
        if (maxY > recY2) maxY = recY2;
        if (minY < recY) minY = recY;
        if (minY > maxY) return false;
        return true;
    },
};

// Build the placer with a given world around it. Every name the lifted source
// reads from its closure is a parameter, so each scenario gets its own world.
function placer(world) {
    const w = Object.assign({
        vars: { placeAim: true, placeLead: 100 },
        myPlayer: { x2: 0, y2: 0, xVel: 0, yVel: 0 },
        imTrapped: false,
        predictMoveAngle: null,
        lastMoveDir: null,
        lastMoveAngle: null,
        withinPath: () => false,
    }, world);

    const body = AIM_SRC + "\n" + SCORE_SRC + "\n" + `return {
        aimStep, aimLead, aimLeadTicks, aimSpikeReach, aimSpikeHits, aimTrapCatches,
        aimPathHits, aimClosing, aimOffAngle, aimMyMoveDir, prePlaceLOS, prePlaceScore,
        prePlaceReaches,
    };`;

    return new Function(
        "UTILS", "window", "myPlayer", "imTrapped",
        "predictMoveAngle", "lastMoveDir", "lastMoveAngle", "replaceWithinPath",
        body
    )(UTILS, { vars: w.vars }, w.myPlayer, w.imTrapped,
      w.predictMoveAngle, w.lastMoveDir, w.lastMoveAngle, w.withinPath);
}

let failed = 0;
function check(name, condition, detail) {
    if (condition) {
        console.log("  ok    " + name);
        return;
    }

    failed++;
    console.log("  FAIL  " + name + (detail === undefined ? "" : "   " + detail));
}

function near(a, b, tol) {
    return Math.abs(a - b) <= (tol === undefined ? 0.001 : tol);
}

// A ring slot, as buildPlaceAngles() hands it over.
function slot(x, y, scale, angle, id) {
    return { x: x, y: y, scale: scale, angle: angle === undefined ? Math.atan2(y, x) : angle, id: id === undefined ? 9 : id };
}

// An enemy: x2/y2 is where the server put him, xVel/yVel that position stepped
// once more along his last step.
function enemy(x, y, stepX, stepY) {
    return { x2: x, y2: y, xVel: x + (stepX || 0), yVel: y + (stepY || 0), scale: 35, spikeDamage: 0 };
}

console.log("aimStep / aimLead");
{
    const P = placer({});

    check("standing player steps nowhere", (() => {
        const s = P.aimStep(enemy(500, 500, 0, 0));
        return s.x === 0 && s.y === 0;
    })());

    check("a running step is passed through", (() => {
        const s = P.aimStep(enemy(500, 500, 24, 0));
        return near(s.x, 24) && near(s.y, 0);
    })());

    check("a teleport is clamped to one tick of running", (() => {
        const s = P.aimStep(enemy(500, 500, 900, 0));
        return near(s.x, 40) && near(s.y, 0);
    })());

    check("lead of one tick lands on the stepped position", (() => {
        const lead = P.aimLead(enemy(500, 500, 24, 7));
        return near(lead.x, 524) && near(lead.y, 507);
    })());

    check("lead scales with the slider", (() => {
        const half = placer({ vars: { placeAim: true, placeLead: 50 } });
        const lead = half.aimLead(enemy(500, 500, 24, 0));
        return near(lead.x, 512);
    })());

    check("Aim off collapses the lead onto the present tense", (() => {
        const off = placer({ vars: { placeAim: false, placeLead: 100 } });
        const lead = off.aimLead(enemy(500, 500, 24, 0));
        return near(lead.x, 500) && near(lead.y, 500);
    })());
}

console.log("reach");
{
    const P = placer({});
    const spike = slot(0, 0, 52);

    check("spike reach is playerScale + spikeScale + slack", near(P.aimSpikeReach(spike), 35 + 52 + 10));
    check("a body inside the reach is a hit", P.aimSpikeHits(spike, 96, 0));
    check("a body past the reach is not", !P.aimSpikeHits(spike, 98, 0));
    check("the old scale + 55 test called 105px a hit", 52 + 55 > 97,
          "(kept as a note: 105 > the real 97)");

    check("a trap catches inside 50", P.aimTrapCatches(slot(0, 0, 32), 49, 0));
    check("and not outside it", !P.aimTrapCatches(slot(0, 0, 32), 51, 0));
}

console.log("path");
{
    const P = placer({ vars: { placeAim: true, placeLead: 300 } });
    // He runs past the slot: neither end of his path is inside the catch
    // radius, but he crosses it on the way. Endpoint-only tests miss this.
    const runner = enemy(0, 0, 40, 0);
    const trap = slot(60, 40, 32);

    check("both endpoints are out of catch range",
          !P.aimTrapCatches(trap, runner.x2, runner.y2) &&
          !P.aimTrapCatches(trap, P.aimLead(runner).x, P.aimLead(runner).y));
    check("but the path crosses the trap", P.aimPathHits(trap, runner, 50));

    check("running at a slot closes on it", near(P.aimClosing(slot(200, 0, 52), runner), 1, 0.01));
    check("running away from one does not", near(P.aimClosing(slot(-200, 0, 52), runner), -1, 0.01));
    check("a standing player closes on nothing", P.aimClosing(slot(200, 0, 52), enemy(0, 0, 0, 0)) === 0);
}

console.log("angle");
{
    const P = placer({ myPlayer: { x2: 0, y2: 0, xVel: 0, yVel: 0 } });

    check("a slot pointed at him is dead on", near(P.aimOffAngle(slot(96, 0, 52, 0), 300, 0), 0));
    check("a slot across the ring is a quarter turn off",
          near(P.aimOffAngle(slot(0, 96, 52, Math.PI / 2), 300, 0), Math.PI / 2));
    check("a slot behind me is half a turn off",
          near(P.aimOffAngle(slot(-96, 0, 52, Math.PI), 300, 0), Math.PI));
}

console.log("line of sight with no move key down");
{
    // predictMoveAngle is null whenever no move key is down, and Math.cos(null)
    // is 1 — the old code invented a future position 222px due east and vetoed
    // slots against it. A standing player has no walk to block.
    const standing = placer({});
    const ctx = { moveDir: standing.aimMyMoveDir(), lead: { x: 300, y: 0 } };
    const east = slot(96, 0, 52, 0);

    check("a standing player reports no move direction", ctx.moveDir === null);
    check("and nothing blocks a walk that is not happening", !standing.prePlaceLOS(east, ctx).future);
    check("the slot between us still blocks the swing", standing.prePlaceLOS(east, ctx).enemy);

    const walking = placer({ predictMoveAngle: 0 });
    const wctx = { moveDir: walking.aimMyMoveDir(), lead: { x: 300, y: 0 } };
    check("a slot on the walk does block it", walking.prePlaceLOS(east, wctx).future);
}

console.log("preplace scoring");
{
    const P = placer({});
    // A bush breaking north-east of me; he is running in from the east.
    const hole = { x: 0, y: -96, scale: 30, isItem: false, getScale: () => 30 };
    const him = enemy(200, 0, -30, 0);
    const ctx = {
        enemy: him,
        lead: P.aimLead(him),
        enemyTrapped: null,
        spikeTick: false,
        moveDir: null,
        closestSpikeToEnemy: null,
        closestTrapToEnemy: null,
        closestSpikeToKb: null,
    };

    const trapAtHim = slot(82, 0, 32, 0, 15);        // ring slot on his side
    const trapBehindMe = slot(-82, 0, 32, Math.PI, 15);
    const trapOnHole = slot(0, -82, 32, -Math.PI / 2, 15);

    const atHim = P.prePlaceScore(trapAtHim, true, hole, ctx);
    const behind = P.prePlaceScore(trapBehindMe, true, hole, ctx);
    const onHole = P.prePlaceScore(trapOnHole, true, hole, ctx);

    check("the trap on his side beats the one behind me", atHim > behind, `${atHim.toFixed(1)} vs ${behind.toFixed(1)}`);
    check("...and beats the one merely sitting on the hole", atHim > onHole, `${atHim.toFixed(1)} vs ${onHole.toFixed(1)}`);
    check("the hole still counts for something", onHole > behind, `${onHole.toFixed(1)} vs ${behind.toFixed(1)}`);

    // Loose enemy, close enough for a trap to close on him: the trap is the
    // play, not a spike that reaches the same ground.
    const near_ = enemy(120, 0, -30, 0);
    const nctx = Object.assign({}, ctx, { enemy: near_, lead: P.aimLead(near_) });
    const trapSlot = slot(82, 0, 32, 0, 15);
    const spikeSlot = slot(96, 0, 52, 0, 9);
    check("a trap that catches a loose enemy beats a spike on the same angle",
          P.prePlaceScore(trapSlot, true, hole, nctx) > P.prePlaceScore(spikeSlot, false, hole, nctx));

    // Once he is held, a second trap is one of six spent on nothing and the
    // spike beside him is the play.
    const held = Object.assign({}, nctx, { enemyTrapped: { x: 90, y: 0, scale: 32 } });
    check("once he is trapped the spike beats another trap",
          P.prePlaceScore(spikeSlot, false, hole, held) > P.prePlaceScore(trapSlot, true, hole, held));

    // Aim, plainly: same distance from him, better angle wins.
    const sideA = slot(82 * Math.cos(0.4), 82 * Math.sin(0.4), 32, 0.4, 15);
    const sideB = slot(82 * Math.cos(1.4), 82 * Math.sin(1.4), 32, 1.4, 15);
    check("the better-aimed of two equal slots wins",
          P.prePlaceScore(sideA, true, hole, ctx) > P.prePlaceScore(sideB, true, hole, ctx));

    // And the walk veto still bites.
    const onPath = placer({ withinPath: () => true });
    check("a slot on my own walk is docked",
          onPath.prePlaceScore(trapAtHim, true, hole, ctx) < atHim);
}

console.log("combo partner");
{
    const P = placer({});
    const him = enemy(120, 0, -30, 0);
    const ctx = {
        enemy: him,
        lead: P.aimLead(him),
        enemyTrapped: null,
        spikeTick: false,
        moveDir: null,
        closestSpikeToEnemy: null,
        closestTrapToEnemy: null,
        closestSpikeToKb: null,
    };

    check("a spike beside the trap reaches him", P.prePlaceReaches(slot(96, 0, 52, 0, 9), false, ctx));
    check("a spike on the far side of my ring does not",
          !P.prePlaceReaches(slot(-96, 0, 52, Math.PI, 9), false, ctx));
    check("a trap on him reaches him", P.prePlaceReaches(slot(82, 0, 32, 0, 15), true, ctx));
    check("a trap a quarter turn away does not",
          !P.prePlaceReaches(slot(0, 82, 32, Math.PI / 2, 15), true, ctx));
}

console.log("");
if (failed) {
    console.log(failed + " check(s) failed");
    process.exit(1);
}
console.log("all checks passed");
