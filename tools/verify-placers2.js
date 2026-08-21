#!/usr/bin/env node
"use strict";
/*
 * verify-placers2.js — checks the built script against the promises made about
 * it: that it parses, that it is exactly what the build produces, that the v1
 * placers were not touched, that the four hooks are in place exactly once, that
 * the two engines cannot both be live, and that every setting the engine reads
 * has a default.
 *
 *   node tools/verify-placers2.js
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BASE = path.join(ROOT, "src", "YoRHa_System_v1.5.js");
const OUT = path.join(ROOT, "YoRHa_System.user.js");
const ENGINE = path.join(ROOT, "src", "placers2", "engine.js");

const base = fs.readFileSync(BASE, "utf8");
const out = fs.readFileSync(OUT, "utf8");
const engine = fs.readFileSync(ENGINE, "utf8");

let bad = 0;
function check(name, cond, detail) {
    if (cond) console.log("  ok    " + name);
    else { bad++; console.log("  FAIL  " + name + (detail ? "  — " + detail : "")); }
}
function count(hay, needle) {
    let n = 0, i = 0;
    for (;;) { const j = hay.indexOf(needle, i); if (j === -1) return n; n++; i = j + 1; }
}

console.log("syntax");
try {
    execFileSync(process.execPath, ["--check", OUT], { stdio: "pipe" });
    check("YoRHa_System.user.js parses", true);
} catch (e) {
    check("YoRHa_System.user.js parses", false, String(e.stderr || e));
}

console.log("\nbuild is reproducible");
{
    const tmp = path.join(ROOT, "YoRHa_System.user.js");
    const before = fs.readFileSync(tmp);
    execFileSync(process.execPath, [path.join(ROOT, "tools", "build-yorha-placers2.js")], { stdio: "pipe" });
    const after = fs.readFileSync(tmp);
    check("the committed build is what the build script produces", before.equals(after));
}

console.log("\nthe v1 placers are untouched");
// Every v1 function that decides or sends a placement, byte for byte.
const V1 = [
    "function getPrePlaceAngles(id, customObjects) {",
    "function isPrePlaceAngle(config, prePlaceObject, closestSpikeToEnemy, closestTrapToEnemy, closestSpikeToKb) {",
    "function isAutoPlaceAngle(config, closestSpikeToEnemy, closestTrapToEnemy, closestSpikeToKb) {",
    "function getPrePlaceObject() {",
    "function rynReplacePick(id, snap) {",
    "function rynDoReplace(removedSids) {",
    "function checkPredictObjects(angles) {",
    "function addPredictObject(id, angle, preplace) {",
    "function canPlace(id, angle, objects, velocity) {",
    "function isItemLimit(id) {"
];
for (const sig of V1) {
    const b = base.indexOf(sig);
    if (b === -1) { check("v1 " + sig.slice(9, 40), false, "not in the base script"); continue; }
    // the function, from its signature to the start of the next one in the same
    // block, must appear in the output verbatim
    const bEnd = base.indexOf("\n        function ", b + 1);
    const body = base.slice(b, bEnd);
    check("unchanged: " + sig.replace("function ", "").split("(")[0], out.includes(body));
}
check("the v1 preplace block still reads window.vars.prePlace",
    count(out, "if (window.vars.prePlace && nearestEnemy && UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) < 300") === 1);
check("the v1 replacer is still gated on window.vars.replace",
    count(out, "if (!window.vars.replace || !nearestEnemy || !myPlayer) return;") === 1);

console.log("\nhooks");
check("YP2.sample() once, at the top of getPredictObjects", count(out, "YP2.sample();") === 1);
check("YP2.run() once, after predictObjects is cleared", count(out, "YP2.run();") === 1);
check("YP2.removed() once, in killObject", count(out, "YP2.removed(sid);") === 1);
check("the engine is in the file exactly once", count(out, "const YP2 = (function () {") === 1);
{
    // run() must come after the line that empties predictObjects, or whatever it
    // commits is thrown away in the same call (which is what happens to v1's
    // replacer).
    const g = out.indexOf("function getPredictObjects() {");
    const clear = out.indexOf("predictObjects = [];", g);
    const run = out.indexOf("YP2.run();", g);
    check("YP2.run() runs after predictObjects is emptied", clear !== -1 && run > clear);
    const sample = out.indexOf("YP2.sample();", g);
    check("YP2.sample() runs before that", sample !== -1 && sample < clear);
}

console.log("\nengine lock — the two placers can never both be live");
check("menu: v1 preplacer is locked by the v2 pair",
    out.includes(`id: "prePlace", lockedWhen: ["prePlace2", "replace2"]`));
check("menu: v1 replacer is locked by the v2 pair",
    out.includes(`id: "replace", lockedWhen: ["prePlace2", "replace2"]`));
check("menu: Preplace 2 closes the v1 pair",
    out.includes(`id: "prePlace2", disables: ["prePlace", "replace"]`));
check("menu: Replace 2 closes the v1 pair",
    out.includes(`id: "replace2", disables: ["prePlace", "replace"]`));
check("menu: a locked toggle refuses the click", out.includes("if (isLocked) {"));
check("load: a saved config carrying both is repaired", out.includes("function enforcePlacerLocks()") &&
    out.includes("enforcePlacerLocks();"));
check("runtime: the engine re-checks it every tick", engine.includes("function yp2Lock()") &&
    engine.includes("yp2Lock();"));
check("keybind: the Placers key drives one engine, not both",
    out.includes("const useV2 = window.vars.prePlace2 || window.vars.replace2"));

console.log("\nsettings");
{
    const varsStart = out.indexOf("    window.vars = {");
    const varsEnd = out.indexOf("\n    };", varsStart);
    const varsBlock = out.slice(varsStart, varsEnd);
    const names = new Set();
    const re = /\b(?:v|on)\("([A-Za-z0-9_]+)"/g;
    let m;
    while ((m = re.exec(engine))) names.add(m[1]);
    for (const n of names) {
        check("default exists for " + n, new RegExp("\\n\\s+" + n + ":").test(varsBlock));
    }
    for (const id of ["prePlace2", "replace2", "pp2Range", "pp2MaxPerTick", "pp2Instant",
                      "pp2PreArm", "pp2Traps", "pp2Debug", "placerEngine"]) {
        check("menu or defaults carry " + id, varsBlock.includes(id + ":"));
    }
}

console.log("\nsafety");
check("the engine self-disables rather than breaking a tick", engine.includes("MAX_THROWS") &&
    engine.includes("s.off = true"));
check("every entry point is wrapped", count(engine, "guard(s, function ()") === 3);
check("the packet budget is respected", engine.includes("packets + 5 <= 119"));
check("state is per player context, so bots do not share it",
    engine.includes("botStates = new WeakMap()"));

console.log("\n" + (bad ? bad + " check(s) failed" : "all checks passed"));
process.exit(bad ? 1 : 0);
