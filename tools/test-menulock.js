#!/usr/bin/env node
"use strict";
/*
 * test-menulock.js — exercises the toggle renderer *as shipped*.
 *
 * The block that decides whether a toggle is locked, and what a click does, is
 * cut out of the built YoRHa_System.user.js and run against a DOM stub, so the
 * lock is tested as the code that actually runs, not as a copy of it.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const out = fs.readFileSync(path.join(ROOT, "YoRHa_System.user.js"), "utf8");

const START = "                    // A toggle may declare `lockedWhen`:";
const END = "                    row.appendChild(switchEl);";
const a = out.indexOf(START);
const b = out.indexOf(END, a);
if (a === -1 || b === -1) {
    console.error("could not find the toggle renderer in the build");
    process.exit(1);
}
const block = out.slice(a, b);

// Also lift the real MenuConfig entries for the placers page, so the item
// definitions under test are the shipped ones too.
function menuItem(id) {
    const re = new RegExp("\\{ type: 'toggle', name: \"[^\"]+\", id: \"" + id + "\"[^}]*\\}");
    const m = out.match(re);
    if (!m) { console.error("no menu entry for " + id); process.exit(1); }
    return eval("(" + m[0] + ")");
}

const LOCK_NAMES = {
    prePlace: "Preplacer", replace: "Replace",
    prePlace2: "Preplace 2", replace2: "Replace 2"
};

function el() {
    const set = new Set();
    return {
        className: "", innerHTML: "", innerText: "", title: "", offsetWidth: 1,
        children: [],
        appendChild(c) { this.children.push(c); },
        classList: {
            add: (c) => set.add(c),
            remove: (c) => set.delete(c),
            toggle: (c) => (set.has(c) ? set.delete(c) : set.add(c)),
            has: (c) => set.has(c)
        },
        _set: set
    };
}

const runner = new Function("item", "window", "LOCK_NAMES", "document", "saveConfig", "render", "currentTab", `
    const row = document.createElement('div');
${block}
    return { switchEl, row, isLocked };
`);

let saves = 0, renders = 0;
const doc = { createElement: () => el() };
function build(item, vars) {
    const w = { vars };
    const r = runner(item, w, LOCK_NAMES, doc, () => saves++, () => renders++, "placers");
    return { r, vars: w.vars };
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra ? "   " + extra : "")); }
}

const PRE1 = menuItem("prePlace");
const REP1 = menuItem("replace");
const PRE2 = menuItem("prePlace2");
const REP2 = menuItem("replace2");

console.log("the shipped menu entries");
ok("Preplacer is locked by the v2 pair",
   JSON.stringify(PRE1.lockedWhen) === JSON.stringify(["prePlace2", "replace2"]));
ok("Replace is locked by the v2 pair",
   JSON.stringify(REP1.lockedWhen) === JSON.stringify(["prePlace2", "replace2"]));
ok("Preplace 2 closes the v1 pair",
   JSON.stringify(PRE2.disables) === JSON.stringify(["prePlace", "replace"]));
ok("Replace 2 closes the v1 pair",
   JSON.stringify(REP2.disables) === JSON.stringify(["prePlace", "replace"]));

console.log("\nswitching Preplace 2 on");
{
    const vars = { prePlace: true, replace: true, prePlace2: false, replace2: false, placerEngine: "v1" };
    const { r } = build(PRE2, vars);
    ok("not locked", r.isLocked === false);
    r.switchEl.onclick();
    ok("Preplace 2 is on", vars.prePlace2 === true);
    ok("the v1 preplacer was switched off", vars.prePlace === false);
    ok("the v1 replacer was switched off", vars.replace === false);
    ok("the key now drives engine II", vars.placerEngine === "v2");
    ok("the page redrew so the other tiles agree", renders > 0);
}

console.log("\nthe v1 toggles while Preplace 2 is on");
{
    const vars = { prePlace: true, replace: false, prePlace2: true, replace2: false };
    const { r } = build(PRE1, vars);
    ok("drawn as locked", r.isLocked === true);
    ok("a stale 'on' is corrected on sight", vars.prePlace === false);
    ok("the switch carries the locked class", r.switchEl.className.includes("locked"));
    ok("a LOCKED chip is shown", r.row.children.some(c => c.className === "feat-lock"));
    ok("the tooltip names what holds it", r.switchEl.title.includes("Preplace 2"));
    const savesBefore = saves;
    r.switchEl.onclick();
    ok("the click does nothing", vars.prePlace === false && saves === savesBefore);
    ok("the click is refused visibly", r.switchEl._set.has("shake"));
}

console.log("\nwith Replace 2 alone");
{
    const vars = { prePlace: true, replace: true, prePlace2: false, replace2: true };
    const { r } = build(REP1, vars);
    ok("Replace 2 alone is enough to lock the v1 pair", r.isLocked === true);
    ok("and it forces the v1 replacer off", vars.replace === false);
}

console.log("\nswitching the v2 pair back off");
{
    const vars = { prePlace: false, replace: false, prePlace2: true, replace2: false };
    const off = build(PRE2, vars);
    off.r.switchEl.onclick();
    ok("Preplace 2 is off", vars.prePlace2 === false);
    const back = build(PRE1, vars);
    ok("the v1 preplacer is clickable again", back.r.isLocked === false);
    back.r.switchEl.onclick();
    ok("and it switches on", vars.prePlace === true);
}

console.log("\nunrelated toggles are unaffected");
{
    const vars = { autoBuy: false };
    const { r } = build({ type: "toggle", name: "Autobuy", id: "autoBuy" }, vars);
    ok("no lock", r.isLocked === false);
    r.switchEl.onclick();
    ok("plain toggle still toggles", vars.autoBuy === true);
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
