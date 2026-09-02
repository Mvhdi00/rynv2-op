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

fs.writeFileSync(OUT, src.split("\n").join(EOL));

console.log(`\nbuild-deltek: wrote ${path.relative(ROOT, OUT)}`);
for (const s of steps) console.log(`  - ${s}`);
console.log("");
