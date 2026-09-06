#!/usr/bin/env node
/*
 * build-nova-ot.js
 *
 * Builds Nova_ChickenTick.user.js from the Nova Client (Recode) by ripping out
 * Nova's whole one tick and dropping chicken v4.6.2's in its place.
 *
 * Nova's one tick was five separate pieces that all fired the same combo in
 * slightly different ways -- `oneTick()`, `instaC.oneTickType` /
 * `threeOneTickType` / `zeroFrame` / `kmTickType` / `boostTickType`, the
 * `gotoGoal`-driven `tickMovement` / `kmTickMovement` / `boostTickMovement` /
 * `BoostOneTick`, and the auto-one-frame block (`doOneFrame`, `autoOneFrame`,
 * and the "AVOT" hat predictor). All of it goes.
 *
 * chicken keeps one: `instaManager`, a FIFO queue drained one entry per server
 * tick plus a four-band distance controller that walks you onto
 * `perfectOTDistance` and fires there. That is what lands in Nova, translated
 * into Nova's own API (`packet` / `buyEquip` / `selectWeapon` / `near`).
 *
 *   node tools/build-nova-ot.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Nova_Client_Recode.js");
const OUT = path.join(ROOT, "Nova_ChickenTick.user.js");

/* The upload is CRLF; every anchor below is written with \n. */
let code = fs.readFileSync(BASE, "utf8").replace(/\r\n/g, "\n");
const applied = [];

/* Exact-string edit. A stale or ambiguous anchor fails the build instead of
 * silently producing a half-transplanted script. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* Replace everything from `start` up to (not including) `end`. Both anchors
 * must be unique, `end` must follow `start`, and the span has to come out near
 * the size it was when this was written -- if the base client shifts under us,
 * that trips before anything is cut. */
function cut(label, start, end, replace, expectedLines) {
  const startParts = code.split(start);
  if (startParts.length === 1) throw new Error(`start anchor not found: ${label}`);
  if (startParts.length > 2) throw new Error(`start anchor is ambiguous: ${label}`);
  const endParts = code.split(end);
  if (endParts.length === 1) throw new Error(`end anchor not found: ${label}`);
  if (endParts.length > 2) throw new Error(`end anchor is ambiguous: ${label}`);

  const from = code.indexOf(start);
  const to = code.indexOf(end, from);
  if (to === -1) throw new Error(`end anchor does not follow start anchor: ${label}`);

  const span = code.slice(from, to);
  const lines = span.split("\n").length - 1;
  if (Math.abs(lines - expectedLines) > 4) {
    throw new Error(`span drifted for ${label}: expected ~${expectedLines} lines, found ${lines}`);
  }
  code = code.slice(0, from) + replace + code.slice(to);
  applied.push(`${label} (${lines} lines)`);
}

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 * ------------------------------------------------------------------ */

const header = `// ==UserScript==
// @name         Nova Client (chicken OT)
// @namespace    nova-chicken-ot
// @author       Nova Client by lvwercia_, one tick from chicken v4.6.2 by Mega & kwyxl
// @description  Nova Client with its one tick replaced by chicken's
// @version      v1-ot1
// @match        *://*.moomoo.io/*
// @run-at       document_idle
// @grant        none
// @icon         https://i.pinimg.com/736x/94/99/c5/9499c5f5d00acd847d019fca234ff832.jpg
// ==/UserScript==`;

{
  const end = code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of base userscript header");
  code = header + code.slice(end + "// ==/UserScript==".length);
  applied.push("header: rewritten for Nova (chicken OT)");
}

/* ------------------------------------------------------------------ *
 * 2. game.perfectOTDistance
 *
 * chicken's `game` carries the one tick's target distance as state
 * (`this.perfectOTDistance = 225`). Nova's `game` is an object literal, so it
 * goes in there, next to the other tick constants.
 * ------------------------------------------------------------------ */

edit(
  "game: perfectOTDistance",
  "        tickRate: (1000 / config.serverUpdateRate),",
  `        // chicken v4.6.2: the distance the one tick is taken from
        perfectOTDistance: 225,
        tickRate: (1000 / config.serverUpdateRate),`
);

/* ------------------------------------------------------------------ *
 * 3. Nova's oneTick() -> chicken's instaManager
 *
 * The function and its three flags go. `noMove`, `noWep` and
 * `onetick123modprov3asd` were written but never read anywhere in the client,
 * and the `traps.in` guard at the top of oneTick() read a field the Traps
 * class does not have (it is `inTrap`), so the "don't one tick out of a trap"
 * check never fired either.
 * ------------------------------------------------------------------ */

const instaManager = `    /* ================================================================== *
     * ONE TICK -- ported from chicken v4.6.2 (\`instaManager\`)
     *
     * Structure for structure, this is chicken's:
     *
     *   - \`onQueue\` is drained one entry per server tick (\`tickBase\`), so the
     *     combo keeps its shape when a tick packet arrives late. Nova's old
     *     one tick nested \`game.tickBase(..., 1)\` callbacks, which fire on an
     *     absolute tick number and bunch up when the connection stutters.
     *   - \`startInsta("ot" | "reverse")\` is the combo itself: turret gear on
     *     tick 0, bull helmet + hit on tick 1, release on tick 2.
     *   - \`oneTickMovement()\` is a four-band controller that walks the player
     *     onto \`game.perfectOTDistance\` by picking the hat/accessory speed
     *     multiplier that lands inside the +/-5 window, and fires when it is:
     *
     *       |error|   hat                accessory            net speed
     *       > 35      soldier    x0.94   monkey tail  x1.35   x1.27  close in
     *       20..35    soldier    x0.94   shadow wings x1.10   x1.03
     *       10..20    tank gear  x0.30   none         x1.00   x0.30  crawl
     *       <= 10     tank gear  x0.30   shadow wings x1.10   x0.33
     *       <= 5      fire, or hold with soldier + shadow wings
     *
     * Two things changed on the way across, both on purpose:
     *
     *   - chicken's fire gate reads \`e.skinindex != 6\` (lowercase i), so the
     *     "don't one tick into a soldier helmet" half of it never ran. Ported
     *     as \`skinIndex\`, which is what the line is for.
     *   - the trigger is Nova's. Hold T or ; -- the keys that used to run
     *     \`tickMovement\` / \`boostTickMovement\` -- instead of chicken's
     *     \`keyBinds.oneTickKey\`, and \`configs.autoOneFrame\` (the P toggle)
     *     still auto-fires, but through chicken's gate rather than Nova's.
     * ================================================================== */
    const oneTickKeys = ["t", ";"];
    let instaManager = {
        onQueue: [],
        holdModeOT: false,
        // chicken carries the insta type on \`chicken.autoaim\`; Nova aims off
        // \`my.autoAim\`, so the type is kept here and \`my.autoAim\` set alongside.
        autoaim: false,
        steering: false,

        /* chicken: instaManager.tickBase() -- one queued step per tick. */
        tickBase: function() {
            if (!inGame || !player || !player.alive) {
                if (this.onQueue.length || this.autoaim) {
                    this.onQueue = [];
                    this.finish();
                }
                return;
            }
            if (typeof this.onQueue[0] == "function") {
                this.onQueue[0]();
                this.onQueue.shift();
            }
        },
        addToQueue: function(set) {
            if (typeof set == "function") {
                this.onQueue.push(set);
            }
        },
        finish: function() {
            this.autoaim = false;
            my.autoAim = false;
            instaC.isTrue = false;
        },

        /* Nova helpers the ported code leans on. */
        hasTarget: function() {
            return !!(enemy.length && near && typeof near.sid == "number");
        },
        aim: function() {
            return this.hasTarget() ? near.aim2 : getAttackDir();
        },
        equipWeapon: function(index) {
            if (player.weaponIndex != index || player.buildIndex > -1) {
                selectWeapon(index);
            }
        },
        /* chicken: chicken.tickMovement(e). Nova's packet() already drops a
         * move packet that repeats the current direction, so the
         * movementDirection cache chicken keeps is not needed here. */
        moveTo: function(dir) {
            if (dir === "stop movement") {
                packet("9", undefined, 1);
            } else if (typeof dir == "number") {
                packet("9", dir, 1);
            } else {
                packet("9", getMoveDir(), 1);
            }
        },
        /* chicken: hatSystem.storeEquip(hat, 0, true) + storeEquip(acc, 1, true).
         * hatSystem.checkOnlySoldier() overrides the hat while chicken is
         * holding soldier for a threat; Nova's equivalent is my.anti0Tick. */
        stage: function(hat, acc) {
            buyEquip(my.anti0Tick > 0 ? 6 : hat, 0);
            buyEquip(acc, 1);
        },

        /* chicken: the gate inside oneTickMovement()'s \`n <= 5\` branch. Turret
         * gear and bull helmet are checked for ownership here because Nova's
         * buyEquip falls back to another hat instead of doing nothing. */
        canOneTick: function() {
            return this.hasTarget() &&
                near.skinIndex != 6 &&
                near.skinIndex != 22 &&
                player.tailIndex != 11 &&
                player.skins[53] &&
                player.skins[7] &&
                player.reloads[53] == 0 &&
                player.reloads[player.weapons[0]] == 0;
        },

        /* chicken: instaManager.startInsta(e) */
        startInsta: function(type) {
            if (!this.hasTarget() || this.autoaim) {
                return false;
            }
            this.autoaim = type;
            my.autoAim = true;
            instaC.isTrue = true;
            if (type == "reverse") {
                buyEquip(53, 0);
                this.equipWeapon(player.weapons[1]);
                packet("D", this.aim());
                sendAutoGather();
                this.addToQueue(() => {
                    buyEquip(7, 0);
                    this.equipWeapon(player.weapons[0]);
                    packet("D", this.aim());
                    this.moveTo(this.aim());
                });
                this.addToQueue(() => {
                    sendAutoGather();
                    this.finish();
                });
            } else {
                buyEquip(53, 0);
                this.equipWeapon(player.weapons[0]);
                this.addToQueue(() => {
                    buyEquip(7, 0);
                    packet("D", this.aim());
                    sendAutoGather();
                    this.moveTo(this.aim());
                });
                this.addToQueue(() => {
                    sendAutoGather();
                    this.finish();
                });
            }
            return true;
        },

        /* chicken: instaManager.oneTickMovement(). \`closing\` is chicken's \`s\`:
         * where the next tick puts us, measured against the error we already
         * have -- below zero means we are still coming in. */
        oneTickMovement: function() {
            if (!this.hasTarget()) {
                this.holdModeOT = false;
                return;
            }
            let aim = near.aim2;
            let diff = near.dist2 - game.perfectOTDistance;
            let closing = UTILS.getDist(near, player, 2, 3) - diff;
            let error = Math.abs(diff);
            if (player.weapons[1] == 10) {
                this.equipWeapon(10);
            }
            // chicken's shortcut, verbatim. As written it cannot fire:
            // \`closing\` is the predicted distance minus the error we already
            // have, and a tick of movement is ~40px, so it never goes negative.
            // The band table below is what actually decides. Left in place --
            // tools/verify-nova-ot.js pins that it stays unreachable.
            if (error <= 25 && closing < 0) {
                error = 5;
            }
            if (error <= 5) {
                if (this.canOneTick()) {
                    this.startInsta("ot");
                    return aim;
                }
                this.stage(6, 19);
                return "stop movement";
            }
            if (error <= 20) {
                this.stage(40, error <= 10 ? 19 : 0);
            } else {
                this.stage(6, error <= 35 ? 19 : 11);
            }
            return aim + (diff > 0 ? 0 : Math.PI);
        },

        /* Hold mode, run once a tick. chicken skips the whole action chain
         * while an insta owns the tick (\`if (this.autoaim);\`) -- same here. */
        drive: function() {
            if (this.autoaim) {
                return;
            }
            if (!this.holdModeOT) {
                if (this.steering) {
                    this.steering = false;
                    this.moveTo();
                }
                return;
            }
            if (traps.inTrap || traps.breakshit) {
                return;
            }
            this.steering = true;
            // Nova gates hatChanger/accChanger and autoPush on instaC.ticking,
            // which is how its own OT movement kept them off its gear.
            instaC.ticking = true;
            this.moveTo(this.oneTickMovement());
        },

        /* Nova's auto one frame (configs.autoOneFrame, toggled with P) kept as
         * a trigger, but firing on chicken's window instead of Nova's hat
         * predictor. No steering and no gear staging: this one only takes the
         * tick that is already there. */
        autoOneTick: function() {
            if (!configs.autoOneFrame || this.autoaim || instaC.isTrue) {
                return false;
            }
            if (traps.inTrap || traps.breakshit || !this.hasTarget()) {
                return false;
            }
            if (![4, 5].includes(player.weapons[0])) {
                return false;
            }
            if (configs.safeTick && (near.skinIndex === 6 || near.skinIndex === 22)) {
                return false;
            }
            let diff = near.dist2 - game.perfectOTDistance;
            let closing = UTILS.getDist(near, player, 2, 3) - diff;
            let error = Math.abs(diff);
            if (error <= 25 && closing < 0) {
                error = 5;
            }
            if (error > 5 || !this.canOneTick()) {
                return false;
            }
            return this.startInsta("ot");
        }
    };
`;

cut(
  "oneTick(): removed, chicken instaManager in its place",
  "    let noMove = false;\n",
  "    // antionetick speed added ggez",
  instaManager,
  78
);

/* ------------------------------------------------------------------ *
 * 4. Instakill: drop the one tick members
 *
 * oneTickType / threeOneTickType / zeroFrame / kmTickType / boostTickType are
 * five spellings of the same combo; tickMovement / BoostOneTick /
 * kmTickMovement / boostTickMovement are four spellings of the approach.
 * `gotoGoal` stays -- `bowMovement` (middle click, bow insta) is the one
 * caller left and that is not a one tick.
 * ------------------------------------------------------------------ */

cut(
  "Instakill: oneTickType/threeOneTickType/zeroFrame/kmTickType/boostTickType",
  "            this.oneTickType = function() {",
  "            this.gotoGoal = function (goto, OT) {",
  "",
  166
);

cut(
  "Instakill: tickMovement/BoostOneTick/kmTickMovement",
  "            this.tickMovement = function () {",
  "            this.shameThing = function () {",
  "",
  39
);

cut(
  "Instakill: boostTickMovement",
  "            this.boostTickMovement = function () {",
  "            /** wait 1 tick for better quality */\n            this.perfCheck",
  "",
  15
);

/* ------------------------------------------------------------------ *
 * 5. Drain the queue once per server tick
 *
 * chicken drains it at the top of manageTickBase; Nova's equivalent point is
 * updatePlayers, right where its own tick queue runs -- `near` is already
 * resolved for this tick by then.
 * ------------------------------------------------------------------ */

edit(
  "updatePlayers: drain instaManager queue",
  "            if (game.tickQueue[game.tick]) {",
  `            instaManager.tickBase();

            if (game.tickQueue[game.tick]) {`
);

/* ------------------------------------------------------------------ *
 * 6. Hold mode on T / ;
 *
 * Nova ran tickMovement off `macro.t` and boostTickMovement off `macro[";"]`,
 * each behind its own weapon/reload precondition. chicken's hold mode has no
 * weapon precondition for the approach -- only for the shot -- so the keys now
 * just arm it.
 * ------------------------------------------------------------------ */

cut(
  "update loop: T / ; drive chicken hold mode",
  "                    if (macro.t) {",
  "                if (player.weapons[1] && !clicks.left && !clicks.right",
  `                }

                instaManager.holdModeOT = !instaC.isTrue && !traps.inTrap && oneTickKeys.some((key) => macro[key]);
                instaManager.drive();

`,
  12
);

/* ------------------------------------------------------------------ *
 * 6b. Weapon management stands off while hold mode is steering
 *
 * The reloaded-weapon swap right after the trigger re-selects a weapon every
 * tick, which fights `oneTickMovement`'s own choice on the way in. chicken
 * never has this fight: hold mode is one branch of an if/else chain, so
 * autoSelect does not run at all while it is steering.
 * ------------------------------------------------------------------ */

edit(
  "weapon management: off while steering the one tick",
  "                if (player.weapons[1] && !clicks.left && !clicks.right && !traps.inTrap && !traps.breakshit && !instaC.isTrue &&",
  "                if (player.weapons[1] && !clicks.left && !clicks.right && !traps.inTrap && !traps.breakshit && !instaC.isTrue && !instaManager.steering &&"
);

/* ------------------------------------------------------------------ *
 * 7. Auto one frame: doOneFrame / autoOneFrame
 *
 * Both are Nova's. The AOT distance gate also read `traps.in`, the field that
 * does not exist, and the reaction log called `loging.success()` -- `loging`
 * is never defined anywhere in the client, so that line would have thrown the
 * moment `configs.OneTickReactionMode` was ever set.
 * ------------------------------------------------------------------ */

cut(
  "auto one frame: doOneFrame/autoOneFrame removed",
  "                function doOneFrame() {",
  "                function predictHat(",
  "",
  45
);

edit(
  "auto one frame: dead toggle removed",
  "let autoOneFrameToggled = false;\n",
  ""
);

edit(
  "auto one frame: call site removed",
  `                if (!instaC.isTrue && configs.autoOneFrame && autoOneFrameToggled) {
                    autoOneFrame();
                }
`,
  ""
);

/* ------------------------------------------------------------------ *
 * 8. The AVOT block
 *
 * ~70 lines of hat prediction feeding `oneTick(1)`, built around
 * `near.skinIndex.length` -- skinIndex is a number, so `arrayCount` was always
 * undefined and every branch below it fell through on NaN comparisons. What is
 * left of it is the one thing downstream cares about: whether we ticked this
 * frame, which now comes from chicken's gate.
 * ------------------------------------------------------------------ */

cut(
  "AVOT block -> instaManager.autoOneTick()",
  "                let oneticked = false;\n",
  "                if (!oneticked && player.skinIndex != 53) {",
  `                let oneticked = instaManager.autoOneTick();
                let antiOneticked = false;
`,
  76
);

/* ------------------------------------------------------------------ *
 * Write it out
 * ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log(`wrote ${path.relative(ROOT, OUT)}  (${code.split("\n").length} lines)`);
for (const label of applied) console.log(`  - ${label}`);
