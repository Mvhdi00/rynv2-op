#!/usr/bin/env node
/*
 * build-deltek.js
 *
 * src/Deltek.user.js  ->  Deltek_Replace.user.js
 *
 * Adds a Replace feature: when one of your structures is destroyed, put one
 * back on the freed ground on the same tick. Five anchored edits, each an exact
 * string from the source — a missing or ambiguous anchor fails the build rather
 * than producing a half-patched script.
 *
 *   node tools/build-deltek.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src/Deltek.user.js");
const OUT = path.join(ROOT, "Deltek_Replace.user.js");
const FEATURE = path.join(ROOT, "src/deltek/replace.js");

const raw = fs.readFileSync(SRC, "utf8");
const EOL = raw.indexOf("\r\n") !== -1 ? "\r\n" : "\n";
let src = raw.split("\r\n").join("\n");
const steps = [];

function edit(label, anchor, replacement) {
  const n = src.split(anchor).length - 1;
  if (n !== 1) {
    throw new Error(`anchor ${n === 0 ? "not found" : `ambiguous (${n} matches)`}: ${label}`);
  }
  src = src.replace(anchor, replacement);
  steps.push(label);
}

const feature = fs.readFileSync(FEATURE, "utf8").split("\r\n").join("\n").replace(/\n+$/, "");

/* ------------------------------------------------------------------ *
 * 1. The feature itself, next to the other placement helpers and the
 *    removal bookkeeping it sits beside.
 * ------------------------------------------------------------------ */
edit(
  "replace: the feature",
  `        let lastPrePlaceObject = null;
        let removedObjects = [];`,
  `        let lastPrePlaceObject = null;
        let removedObjects = [];

${feature}`
);

/* ------------------------------------------------------------------ *
 * 2. Capture at the kill site.
 *
 * This is the only place the record can be taken. disableBySid splices the
 * object out of gameObjects on the next line, and nothing downstream ever sees
 * it again — removedObjects keeps the sid and nothing else.
 * ------------------------------------------------------------------ */
edit(
  "replace: capture the object before it is spliced away",
  `        function killObject(sid) {
            removedObjects.push(sid);
            objectManager.disableBySid(sid);
        }`,
  `        function killObject(sid) {
            removedObjects.push(sid);
            // Before disableBySid: it removes the object from gameObjects
            // outright, so this is the last moment its position and type
            // exist to be read.
            noteVacated(gameObjects.find(object => object.sid == sid));
            objectManager.disableBySid(sid);
        }`
);

/* ------------------------------------------------------------------ *
 * 3. Spend it in the tick, immediately after the auto placer, under the same
 *    packet ceiling and reusing placedAngles so the direction packet that
 *    follows accounts for it.
 * ------------------------------------------------------------------ */
edit(
  "replace: run it in the tick",
  `                        place(object.id, object.angle);
                        placedAngles.push(object.angle);

                    }

                    // PLAYER DIRECTION`,
  `                        place(object.id, object.angle);
                        placedAngles.push(object.angle);

                    }

                    // REPLACE
                    replaceVacated();

                    // PLAYER DIRECTION`
);

/* ------------------------------------------------------------------ *
 * 4 and 5. The toggle, and its default.
 * ------------------------------------------------------------------ */
edit(
  "replace: menu toggle",
  `                    { type: 'toggle', name: "Enable Preplacer", id: "prePlace" }`,
  `                    { type: 'toggle', name: "Enable Preplacer", id: "prePlace" }
                ]
            },
            {
                title: "Replace",
                items: [
                    { type: 'toggle', name: "Enable Replace", id: "replace" }`
);

edit(
  "replace: default on",
  `        autoPlace: true,
        placeRange: 300,
        prePlace: true,`,
  `        autoPlace: true,
        placeRange: 300,
        prePlace: true,
        replace: true,`
);

/* ------------------------------------------------------------------ *
 * 6-9. Velocity Tick.
 *
 * deltek already ships a version of this: toptop(), fired off setTimeout(93)
 * and setTimeout(210) behind a hardcoded T key. Wall-clock delays drift against
 * the server tick and against ping, and it checks none of the things that make
 * the shot worth taking. It is replaced, not extended.
 * ------------------------------------------------------------------ */
const velocity = fs.readFileSync(path.join(ROOT, "src/deltek/velocitytick.js"), "utf8")
  .split("\r\n").join("\n").replace(/\n+$/, "");

/* The armed target, beside the other combo state. */
/* The combo itself, in place of toptop() and its caller. */
edit(
  "velocity: replace toptop with the two-tick combo",
  `                    function toptop() {
                        if (primaryReload[myPlayer.sid] == 1 && turretReload[myPlayer.sid] == 1) {
                            hat(53, 0);
                            keyCodeWeapon = myPlayer.weapons[0];
                            selectWeapon(keyCodeWeapon);
                            setTimeout(() => {
                                autoaim = true;
                                keyCodeWeapon = myPlayer.weapons[0];
                                selectWeapon(keyCodeWeapon);
                                hat(7, 0);
                                io.send("F", 1);
                                setTimeout(() => {
                                    autoaim = false;
                                    io.send("F", 0);
                                }, 210);
                            }, 93);
                        }
                    }
                    if (autoVelocityTickToggled) {
                        if (nearestEnemy && myPlayer && myPlayer.alive) {
                            // velocity range around 242
                            let minimumOTRange = 222; // 242 - 20
                            let maximumOTRange = 262; // 242 + 20

                            // simple velocity calculation
                            let distance = UTILS.getDistance(
                                myPlayer.x2, myPlayer.y2,
                                nearestEnemy.x2, nearestEnemy.y2
                            );

                            if (!nearestTrap && (distance < maximumOTRange && distance > minimumOTRange)) {
                                toptop(); // replace with your function
                            }
                        }
                    }`,
  velocity
);

/* The T key kept its own toggle; point it at the setting so the key and the
 * menu are the same switch instead of two. */
/* The key was hardcoded to T and announced itself in chat, which every other
 * player can read. It becomes a real keybind like the rest, with the same
 * on-screen toast the spike tick uses. */
edit(
  "velocity: a real keybind with an on-screen notice",
  `                    } else if (event.key == "T") {
                        autoVelocityTickToggled = !autoVelocityTickToggled;
                        const oneFrameStatus = autoVelocityTickToggled ? "on" : "off";
                        sendChat(\`velotick: \${(oneFrameStatus)}\`);`,
  `                    } else if (keyStr === window.vars.keyVelocityTick) {
                        window.vars.velocityTick = !window.vars.velocityTick;
                        showSettingText(900, window.vars.velocityTick
                            ? "Velocity Tick: ON" : "Velocity Tick: OFF");`
);

edit(
  "velocity: the keybind's default",
  `        keyPlaceTurret: "H",`,
  `        keyPlaceTurret: "H",
        keyVelocityTick: "T",`
);

edit(
  "velocity: the keybind in the menu",
  `                    { type: 'keybind', name: "Auto Clear", id: "keyPathBreak" }`,
  `                    { type: 'keybind', name: "Auto Clear", id: "keyPathBreak" },
                    { type: 'keybind', name: "Velocity Tick", id: "keyVelocityTick" }`
);

edit(
  "velocity: menu toggle",
  `                    { type: 'toggle', name: "Enable Replace", id: "replace" }`,
  `                    { type: 'toggle', name: "Enable Replace", id: "replace" }
                ]
            },
            {
                title: "Velocity Tick",
                items: [
                    { type: 'toggle', name: "Enable Velocity Tick", id: "velocityTick" }`
);

edit(
  "velocity: default off",
  `        prePlace: true,
        replace: true,`,
  `        prePlace: true,
        replace: true,
        velocityTick: false,`
);

/* ------------------------------------------------------------------ *
 * 10-13. Naming.
 *
 * deltek's Shame Combat toggles are named after the joke, not the feature, so
 * the spike tick is impossible to find in the menu. Every one of these is the
 * same setting id as before -- only the label changes -- and the names are
 * novastorm's, which is the same codebase with the same functions behind them:
 *
 *   shameTick   gates canTrapTick()        novastorm calls it "Spike Tick"
 *   shameTick2  gates canTrapTick2()       a second variant, deltek-only
 *   shameGrind  gates advancedShameCombat() novastorm calls it "Shame Grinder"
 * ------------------------------------------------------------------ */
edit(
  "naming: Clown Aids -> Spike Tick",
  `{ type: 'toggle', name: "Clown Aids", id: "shameTick" },`,
  `{ type: 'toggle', name: "Spike Tick", id: "shameTick" },`
);
edit(
  "naming: LOL aids -> Spike Tick 2",
  `{ type: 'toggle', name: "LOL aids", id: "shameTick2" },`,
  `{ type: 'toggle', name: "Spike Tick 2", id: "shameTick2" },`
);
edit(
  "naming: Giving Aids -> Shame Grinder",
  `{ type: 'toggle', name: "Giving Aids", id: "shameGrind" },`,
  `{ type: 'toggle', name: "Shame Grinder", id: "shameGrind" },`
);

/* The on-screen toasts name the feature that fired. Both said "LOL aids",
 * including the one inside canTrapTick, which is the spike tick. */
edit(
  "naming: the spike tick's own toast",
  `                    showSettingText(900, "LOL Aids")`,
  `                    showSettingText(900, "Spike Tick")`
);
edit(
  "naming: the second variant's toast",
  `                    showSettingText(900, "LOL aids")`,
  `                    showSettingText(900, "Spike Tick 2")`
);

/* ------------------------------------------------------------------ *
 * Trap escape ring.
 *
 * Nothing in deltek stops placing while you are held in an enemy trap --
 * Auto Place, Preplace and Replace all keep building, and that stays as it is.
 * This adds the one thing that was missing: when the trap is a hit from
 * breaking, take the four ways in so the ground cannot be re-trapped the moment
 * you are out of it.
 * ------------------------------------------------------------------ */
const trapring = fs.readFileSync(path.join(ROOT, "src/deltek/trapring.js"), "utf8")
  .split("\r\n").join("\n").replace(/\n+$/, "");

edit(
  "trap ring: the feature",
  `${feature}`,
  `${feature}

${trapring}`
);

edit(
  "trap ring: run it in the tick, after Replace",
  `                    // REPLACE
                    replaceVacated();`,
  `                    // REPLACE
                    replaceVacated();

                    // TRAP ESCAPE RING
                    trapEscapeRing();`
);

edit(
  "trap ring: menu toggle",
  `                    { type: 'toggle', name: "Enable Replace", id: "replace" }`,
  `                    { type: 'toggle', name: "Enable Replace", id: "replace" }
                ]
            },
            {
                title: "Trap Escape",
                items: [
                    { type: 'toggle', name: "Hold The Four Ways In", id: "trapEscapeRing" }`
);

edit(
  "trap ring: default on",
  `        replace: true,`,
  `        replace: true,
        trapEscapeRing: true,`
);

/* ------------------------------------------------------------------ *
 * Retrap rush. While the enemy is held in one of my traps, get the next one
 * down before the first breaks.
 * ------------------------------------------------------------------ */
const retraprush = fs.readFileSync(path.join(ROOT, "src/deltek/retraprush.js"), "utf8")
  .split("\r\n").join("\n").replace(/\n+$/, "");

edit(
  "retrap rush: the feature",
  `${trapring}`,
  `${trapring}

${retraprush}`
);

/* Ahead of Replace and the escape ring: while they are held, this is the
 * placement that matters most, so it gets the packet budget first. */
edit(
  "retrap rush: run it first in the tick",
  `                    // REPLACE
                    replaceVacated();`,
  `                    // RETRAP RUSH
                    retrapRush();

                    // REPLACE
                    replaceVacated();`
);

edit(
  "retrap rush: menu toggle",
  `                    { type: 'toggle', name: "Hold The Four Ways In", id: "trapEscapeRing" }`,
  `                    { type: 'toggle', name: "Hold The Four Ways In", id: "trapEscapeRing" }
                ]
            },
            {
                title: "Retrap",
                items: [
                    { type: 'toggle', name: "Rush The Next Trap", id: "retrapRush" }`
);

edit(
  "retrap rush: default on",
  `        trapEscapeRing: true,`,
  `        trapEscapeRing: true,
        retrapRush: true,`
);

fs.writeFileSync(OUT, src.split("\n").join(EOL));

console.log(`\nbuild-deltek: wrote ${path.relative(ROOT, OUT)}`);
for (const s of steps) console.log(`  - ${s}`);
console.log("");
