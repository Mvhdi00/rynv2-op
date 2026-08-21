#!/usr/bin/env node
"use strict";
/*
 * build-yorha-placers2.js
 *
 *   src/YoRHa_System_v1.5.js  +  src/placers2/engine.js  ->  YoRHa_System.user.js
 *
 * Every edit is anchored to an exact string in the base script. An anchor that
 * is missing, or that appears more than once, fails the build instead of
 * producing a half-patched file — drop in a newer YoRHa System and you get an
 * error naming the edit that no longer applies, not a script that silently
 * lost a feature.
 *
 * Nothing here rewrites the v1 preplacer or the v1 replacer. The only lines
 * touched outside the new engine are: four call sites, the settings defaults,
 * the placers menu page, the toggle renderer (locking), the placers keybind,
 * and the stylesheet.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = path.join(ROOT, "src", "YoRHa_System_v1.5.js");
const ENGINE = path.join(ROOT, "src", "placers2", "engine.js");
const OUT = path.join(ROOT, "YoRHa_System.user.js");

let src = fs.readFileSync(BASE, "utf8");
const engine = fs.readFileSync(ENGINE, "utf8");

let edits = 0;
function edit(name, find, replace) {
    const first = src.indexOf(find);
    if (first === -1) throw new Error(`[${name}] anchor not found`);
    if (src.indexOf(find, first + 1) !== -1) throw new Error(`[${name}] anchor is ambiguous`);
    src = src.slice(0, first) + replace + src.slice(first + find.length);
    edits++;
}

// ---------------------------------------------------------------------------
// 1. version stamp
// ---------------------------------------------------------------------------
edit("version",
`// @version      1.5`,
`// @version      1.6`);

// ---------------------------------------------------------------------------
// 2. the engine itself, in front of getPredictObjects()
// ---------------------------------------------------------------------------
edit("engine",
`        function getPredictObjects() {
            rynUpdateSnapshot(); // REPLACE: remember object positions for freed-ground fill`,
engine +
`        function getPredictObjects() {
            rynUpdateSnapshot(); // REPLACE: remember object positions for freed-ground fill
            YP2.sample();        // PLACER II: record the world before anything reads it`);

// ---------------------------------------------------------------------------
// 3. the decision pass — after predictObjects has been cleared for this tick,
//    so what it commits survives (v1's replacer adds to predictObjects one line
//    before that array is emptied, which is why its refills never reach the
//    wire; the v2 pass is placed where that cannot happen).
// ---------------------------------------------------------------------------
edit("run",
`            // GET AUTOPLACE ANGLES
            if (window.vars.autoPlace && nearestEnemy) {`,
`            // PLACER II — preplace / replace decisions for this tick
            YP2.run();

            // GET AUTOPLACE ANGLES
            if (window.vars.autoPlace && nearestEnemy) {`);

// ---------------------------------------------------------------------------
// 4. destruction hook — the earliest moment the freed ground is known
// ---------------------------------------------------------------------------
edit("killObject",
`        function killObject(sid) {
            removedObjects.push(sid);
            objectManager.disableBySid(sid);
        }`,
`        function killObject(sid) {
            removedObjects.push(sid);
            objectManager.disableBySid(sid);
            // PLACER II: the object is inactive now, so its ground reads as
            // free. Replace 2 can answer in this same turn, a whole tick
            // before any next-tick path could.
            YP2.removed(sid);
        }`);

// ---------------------------------------------------------------------------
// 5. settings defaults
// ---------------------------------------------------------------------------
edit("vars",
`        // Placers
        autoPlace: false,
        placeRange: 300,
        prePlace: true,
        replace: true,
`,
`        // Placers
        autoPlace: false,
        placeRange: 300,
        prePlace: true,
        replace: true,

        // Placers — engine II. Preplace 2 and Replace 2 are a second, separate
        // engine; switching either on closes and locks the v1 pair above, so the
        // two can never fight over the same tick.
        placerEngine: "v1",      // which engine the Placers key drives
        prePlace2: false,
        replace2: false,
        pp2Range: 320,           // 150 .. 500 — engagement range for both
        pp2MaxPerTick: 2,        // placements the engine may spend per tick
        pp2Instant: true,        // Replace 2 answers in the destroy packet's turn
        pp2PreArm: true,         // work the refill out before the break lands
        pp2SpikesOnly: true,     // spikes and nothing else
        pp2Traps: false,         // (only consulted when Spikes Only is off)
        pp2Direct: true,         // build now, not at the end of the tick window
        pp2AimLock: true,        // after every placement the aim goes back on them
        pp2Cage: true,           // up close, spend the extra spike that seals them in
        pp2Debug: false,         // corner readout: accept rate, prediction error
`);

// ---------------------------------------------------------------------------
// 6. the placers menu page
// ---------------------------------------------------------------------------
edit("menu",
`            {
                title: "Preplacer",
                items: [
                    { type: 'toggle', name: "Enable Preplacer", id: "prePlace" },
                    { type: 'toggle', name: "Enable Replace", id: "replace" }
                ]
            }
        ],`,
`            {
                title: "Preplacer",
                items: [
                    { type: 'toggle', name: "Enable Preplacer", id: "prePlace", lockedWhen: ["prePlace2", "replace2"], engineTag: "v1" },
                    { type: 'toggle', name: "Enable Replace", id: "replace", lockedWhen: ["prePlace2", "replace2"], engineTag: "v1" }
                ]
            },
            {
                title: "Placer II",
                items: [
                    { type: 'toggle', name: "Preplace 2", id: "prePlace2", disables: ["prePlace", "replace"], engineTag: "v2" },
                    { type: 'toggle', name: "Replace 2", id: "replace2", disables: ["prePlace", "replace"], engineTag: "v2" },
                    { type: 'toggle', name: "Spikes Only", id: "pp2SpikesOnly" },
                    { type: 'toggle', name: "Build Instantly", id: "pp2Direct" },
                    { type: 'toggle', name: "Aim Lock (stay on enemy)", id: "pp2AimLock" },
                    { type: 'toggle', name: "Cage (seal their escape)", id: "pp2Cage" },
                    { type: 'toggle', name: "Instant Replace", id: "pp2Instant" },
                    { type: 'toggle', name: "Predictive Refill", id: "pp2PreArm" },
                    { type: 'toggle', name: "Spend Traps (Spikes Only off)", id: "pp2Traps" },
                    { type: 'slider', name: "Engage Range", id: "pp2Range", min: 150, max: 500 },
                    { type: 'slider', name: "Places Per Tick", id: "pp2MaxPerTick", min: 1, max: 4 },
                    { type: 'toggle', name: "Accuracy Readout", id: "pp2Debug" }
                ]
            }
        ],`);

// ---------------------------------------------------------------------------
// 7. lock names + load-time enforcement
// ---------------------------------------------------------------------------
edit("enforce",
`    // --- SAVE FUNCTION ---
    function saveConfig() {`,
`    // Names shown on a locked toggle's tooltip.
    const LOCK_NAMES = {
        prePlace: "Preplacer", replace: "Replace",
        prePlace2: "Preplace 2", replace2: "Replace 2"
    };

    // One placement engine at a time, whatever the saved file says. The menu
    // refuses the click and the engine re-checks this every tick; this is the
    // third place, for a config written by an older build.
    function enforcePlacerLocks() {
        if (window.vars.prePlace2 || window.vars.replace2) {
            window.vars.prePlace = false;
            window.vars.replace = false;
            window.vars.placerEngine = "v2";
        }
    }
    enforcePlacerLocks();

    // --- SAVE FUNCTION ---
    function saveConfig() {`);

// ---------------------------------------------------------------------------
// 8. toggle renderer — locked state
// ---------------------------------------------------------------------------
edit("toggle",
`                    const isActive = window.vars[item.id];
                    const switchEl = document.createElement('div');
                    switchEl.className = \`switch \${isActive ? 'active' : ''}\`;
                    switchEl.innerHTML = \`<div class="knob"></div>\`;

                    switchEl.onclick = () => {
                        window.vars[item.id] = !window.vars[item.id];
                        switchEl.classList.toggle('active');
                        // A pair of toggles marked \`exclusive\` are two names for
                        // one choice (Trap / Boost Pad): switching one on closes
                        // the other, and the page redraws so both tiles agree.
                        if (item.exclusive && window.vars[item.id]) {
                            window.vars[item.exclusive] = false;
                            saveConfig();
                            render(currentTab);
                            return;
                        }
                        saveConfig(); // SAVE
                    };`,
`                    // A toggle may declare \`lockedWhen\`: while any setting in
                    // that list is on, this one is held off, drawn as LOCKED and
                    // deaf to clicks. \`disables\` is the other half — switching
                    // this on switches those off. The two together are what keeps
                    // Preplace 2 / Replace 2 and the v1 pair off each other.
                    const lockedBy = (item.lockedWhen || []).filter(k => window.vars[k]);
                    const isLocked = lockedBy.length > 0;
                    if (isLocked && window.vars[item.id]) window.vars[item.id] = false;

                    const isActive = window.vars[item.id];
                    const switchEl = document.createElement('div');
                    switchEl.className = \`switch \${isActive ? 'active' : ''}\${isLocked ? ' locked' : ''}\`;
                    switchEl.innerHTML = \`<div class="knob"></div>\`;

                    if (isLocked) {
                        switchEl.title = "Locked by " + lockedBy.map(k => LOCK_NAMES[k] || k).join(" / ");
                        const chip = document.createElement('span');
                        chip.className = 'feat-lock';
                        chip.innerText = 'Locked';
                        row.appendChild(chip);
                    }

                    switchEl.onclick = () => {
                        if (isLocked) {
                            // Say no visibly rather than silently.
                            switchEl.classList.remove('shake');
                            void switchEl.offsetWidth;
                            switchEl.classList.add('shake');
                            return;
                        }
                        window.vars[item.id] = !window.vars[item.id];
                        switchEl.classList.toggle('active');
                        // A pair of toggles marked \`exclusive\` are two names for
                        // one choice (Trap / Boost Pad): switching one on closes
                        // the other, and the page redraws so both tiles agree.
                        if (item.exclusive && window.vars[item.id]) {
                            window.vars[item.exclusive] = false;
                            saveConfig();
                            render(currentTab);
                            return;
                        }
                        if (window.vars[item.id] && item.engineTag) {
                            window.vars.placerEngine = item.engineTag;
                        }
                        if (item.disables && window.vars[item.id]) {
                            for (const k of item.disables) window.vars[k] = false;
                        }
                        if (item.disables || item.lockedWhen) {
                            // Something else on this page just changed state.
                            saveConfig();
                            render(currentTab);
                            return;
                        }
                        saveConfig(); // SAVE
                    };`);

// ---------------------------------------------------------------------------
// 9. the Placers keybind drives whichever engine is the active one
// ---------------------------------------------------------------------------
edit("keybind",
`                    else if (keyStr === window.vars.keyPlacers) {
                        // One key toggles Auto Place + Preplace + Replace together:
                        // if any is off, turn all on; otherwise turn all off.
                        const on = !(window.vars.autoPlace && window.vars.prePlace && window.vars.replace);
                        window.vars.autoPlace = on;
                        window.vars.prePlace = on;
                        window.vars.replace = on;
                    }`,
`                    else if (keyStr === window.vars.keyPlacers) {
                        // One key toggles Auto Place + the preplacer + the
                        // replacer: if any is off, turn all on; otherwise turn
                        // all off. Which pair that means is whichever engine is
                        // the active one -- the key never switches engines, and
                        // never turns on a pair the lock would close again.
                        const useV2 = window.vars.prePlace2 || window.vars.replace2 ||
                                      window.vars.placerEngine === "v2";
                        if (useV2) {
                            const on = !(window.vars.autoPlace && window.vars.prePlace2 && window.vars.replace2);
                            window.vars.autoPlace = on;
                            window.vars.prePlace2 = on;
                            window.vars.replace2 = on;
                            if (on) { window.vars.prePlace = false; window.vars.replace = false; }
                        } else {
                            const on = !(window.vars.autoPlace && window.vars.prePlace && window.vars.replace);
                            window.vars.autoPlace = on;
                            window.vars.prePlace = on;
                            window.vars.replace = on;
                        }
                    }`);

// ---------------------------------------------------------------------------
// 10. stylesheet — locked switch + the LOCKED chip
// ---------------------------------------------------------------------------
edit("css",
`    .switch.active { background: var(--ink); }
    .switch.active .knob { left: 27px; background: var(--paper); }`,
`    .switch.active { background: var(--ink); }
    .switch.active .knob { left: 27px; background: var(--paper); }

    /* A toggle held shut by the other placement engine. */
    .switch.locked { cursor: not-allowed; opacity: 0.42; }
    .switch.locked .knob { background: var(--ink-faint); box-shadow: none; }
    .switch.shake { animation: yp2-shake 0.18s linear; }
    @keyframes yp2-shake { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
    .feat-lock {
        margin-left: auto; margin-right: 10px;
        font-size: 9px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase;
        color: var(--paper); background: var(--ink);
        padding: 2px 7px; border: 2px solid var(--ink); border-radius: 0;
    }`);

fs.writeFileSync(OUT, src);
console.log(`ok  ${edits} anchored edits  ->  ${path.relative(ROOT, OUT)}  (${src.length} bytes)`);
