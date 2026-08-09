#!/usr/bin/env node
/*
 * build-v5.js
 *
 * Adds the precise-angle system to RYN Client v5 OWNER.
 *
 *   node tools/build-v5.js
 *
 * v5 is not v4 with more features on it — it is a different client, and the two
 * halves of this patch land very differently on it:
 *
 *   Movement is the same code. v5 carries the same InputHandler and the same
 *   getAngleFromBitmask, so the key vector gives it the same 8 directions and
 *   nothing between them. That half is character-for-character the v4 patch,
 *   shared through tools/precise-angles.js.
 *
 *   Building is already solved. v5 replaced RYN's AutoPlacer with the Auraro
 *   placer, which decides geometrically — it builds the blocked arcs around the
 *   player, inverts them into free arcs and takes the free angle nearest what it
 *   is aiming at. There is no step count in it to raise; its placement angles
 *   are already exact. So there is no _getPrePlaceAngles here to convert, and no
 *   claim to make about making the placer finer.
 *
 * What is left on the building side are three sweeps that still walk fixed step
 * counts, and those are what the building slider drives:
 *
 *   - the trap-bounce test, 36 steps, pure arithmetic
 *   - auto-break's swing search, 72 steps, pure arithmetic
 *   - the enemy spike-slot sweep, 36 steps, one canPlaceItem grid query per step
 *
 * Only the third one cost anything per step, so only the third one gets the
 * analytic mask. It sweeps a circle around the *enemy* rather than the player,
 * and passes canPlaceItem a negative addRadius, so the shared helper takes both
 * as parameters. canPlaceItem queries at search radius 1, so the mask matches
 * that rather than the placer's 4.
 */

const fs = require("fs");
const path = require("path");

const Angles = require("./precise-angles");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/RYN_Client_v5_OWNER.js");
const OUT = path.join(ROOT, "RYN_v5_OWNER.user.js");

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

/* Every edit goes through here so a stale anchor fails the build loudly
 * instead of silently producing a half-patched script. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* The page constants are JS string literals, so decode, splice, re-encode. */
function patchPage(constName, anchorHtml, insertHtml, where = "before") {
  const declaration = `const ${constName} = `;
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error(`page constant not found: ${constName}`);

  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");

  // eslint-disable-next-line no-eval
  const html = eval(literal);
  if (!html.includes(anchorHtml)) throw new Error(`page anchor not found in ${constName}`);
  if (html.indexOf(anchorHtml) !== html.lastIndexOf(anchorHtml)) {
    throw new Error(`page anchor is ambiguous in ${constName}`);
  }

  const patched = html.replace(
    anchorHtml,
    where === "after" ? anchorHtml + insertHtml : insertHtml + anchorHtml
  );
  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(patched) +
    ";" +
    code.slice(lineEnd);
  applied.push(`menu: options added to ${constName}`);
}

/* ------------------------------------------------------------------ *
 * 1. The grid and its settings
 * ------------------------------------------------------------------ */

edit(
  "angles: AngleGrid helper",
  `  const getAngleFromBitmask = (bitmask, rotate) => {`,
  Angles.ANGLE_GRID + `  const getAngleFromBitmask = (bitmask, rotate) => {`
);

edit(
  "angles: settings",
  `  const defaultSettings = {
    _primary: "Digit1",`,
  `  const defaultSettings = {
` + Angles.SETTINGS + `
    _primary: "Digit1",`
);

/* ------------------------------------------------------------------ *
 * 2. Movement
 *
 * v5's handleMovement destructures isOwner and clients and then does nothing
 * with them — the spectate fan-out v4 has was dropped somewhere along the way.
 * The shared block keeps the destructure (ModuleHandler comes out of the same
 * one) and passes no fan-out, so the behaviour is unchanged.
 * ------------------------------------------------------------------ */

edit(
  "angles: precise movement",
  `    handleMovement() {
      const angle = getAngleFromBitmask(this.move, false);
      this.client._ModuleHandler.startMovement(angle);
      const {isOwner: isOwner, clients: clients} = this.client;
    }`,
  Angles.movement()
);

edit(
  "angles: input handler state",
  `    lockPosition=false;
    mouse={`,
  `    lockPosition=false;
` + Angles.INPUT_STATE + `
    mouse={`
);

edit(
  "angles: reset nudge with the rest of the input state",
  `    reset() {
      this.hotkeys.clear();
      this.move = 0;
      this.instaReset();
    }`,
  `    reset() {
      this.hotkeys.clear();
      this.move = 0;
      this.moveNudge = 0;
      if (this._steerTimer !== null) {
        clearTimeout(this._steerTimer);
        this._steerTimer = null;
      }
      this.instaReset();
    }`
);

edit(
  "angles: nudge keys ahead of the repeat guard",
  Angles.KEYDOWN_HOOK_FIND,
  Angles.KEYDOWN_HOOK_REPLACE
);

edit(
  "angles: re-steer as the cursor moves",
  Angles.MOUSEMOVE_HOOK_FIND,
  Angles.MOUSEMOVE_HOOK_REPLACE
);

/* ------------------------------------------------------------------ *
 * 3. The three fixed-step sweeps
 * ------------------------------------------------------------------ */

edit(
  "angles: analytic sweep mask",
  `  class SpatialHashGrid2D {`,
  Angles.PLACEABLE_MASK + `  class SpatialHashGrid2D {`
);

/* Trap bounce: does a trap dropped around the enemy sit where the enemy or my
 * own knockback would run into it. Three lineInRect tests per step, no query. */
edit(
  "angles: trap bounce sweep",
  `      const ANGLE_STEPS = 36;
      for (let i = 0; i < ANGLE_STEPS; i++) {
        const angle = i * (Math.PI * 2 / ANGLE_STEPS);`,
  `      const ANGLE_STEPS = AngleGrid.buildStepsOr(36);
      for (let i = 0; i < ANGLE_STEPS; i++) {
        const angle = AngleGrid.fromIndex(i, ANGLE_STEPS);`
);

/* Auto-break: which swing angle covers the most buildings. Scoring only. */
edit(
  "angles: autobreak swing search",
  `      for (let i = 0; i < 72; i++) {
        const testA = i / 72 * Math.PI * 2;`,
  `      const breakSteps = AngleGrid.buildStepsOr(72);
      for (let i = 0; i < breakSteps; i++) {
        const testA = AngleGrid.fromIndex(i, breakSteps);`
);

/* Enemy spike slots: the one sweep that cost a grid query per step. The mask
 * answers the same question in one query, so the slider is free here too.
 * canPlaceItem's river rule is already in the mask; its addRadius and its
 * search radius of 1 are passed through. */
edit(
  "angles: enemy spike-slot sweep",
  `      for (let i = 0; i < 36; i++) {
        const angle = i * (Math.PI * 2 / 36);
        const configX = enemyPos.x + placeLength * Math.cos(angle);
        const configY = enemyPos.y + placeLength * Math.sin(angle);
        const configPos = new Vector_default(configX, configY);
        const canPlace = ObjectManager2.canPlaceItem(spikeId, configPos, 0.6 * spikeScale - spikeScale);`,
  `      const slotSteps = AngleGrid.buildStepsOr(36);
      const slotMask = _getPlaceableMask(spikeId, enemyPos, ObjectManager2, null, slotSteps, .6 * spikeScale - spikeScale, 1);
      for (let i = 0; i < slotSteps; i++) {
        const angle = AngleGrid.fromIndex(i, slotSteps);
        const configX = enemyPos.x + placeLength * Math.cos(angle);
        const configY = enemyPos.y + placeLength * Math.sin(angle);
        const canPlace = slotMask[i] === 1;`
);

/* ------------------------------------------------------------------ *
 * 4. Menu
 *
 * v5's Misc page uses h2 section titles, and its Keybinds page lays keys out in
 * a key-grid of key-tiles rather than v4's content-split.
 * ------------------------------------------------------------------ */

patchPage(
  "Misc_default",
  `\r\n\r\n    <div class="section">\r\n        <h2 class="section-title">Auto Chat</h2>`,
  `\r
\r
    <div class="section">\r
        <h2 class="section-title">Precise Angles</h2>\r
\r
        <div class="section-content">\r
\r
            <div class="content-option">\r
                <span class="option-title">Precise Angles</span>\r
                <label class="switch-checkbox">\r
                    <input id="_preciseAngles" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">${Angles.COPY.master}</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Movement Angles</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_moveAngleSteps" type="range" step="8" min="8" max="624">\r
                </label>\r
                <span class="option-description">${Angles.COPY.move}</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Building Angles</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_buildAngleSteps" type="range" step="24" min="24" max="624">\r
                </label>\r
                <span class="option-description">${Angles.COPY.build} The Auraro placer is geometric already, so this drives the trap bounce, auto break and enemy spike slot sweeps.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Mouse Movement</span>\r
                <label class="switch-checkbox">\r
                    <input id="_mouseMovement" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">${Angles.COPY.mouse}</span>\r
            </div>\r
\r
        </div>\r
    </div>`
);

patchPage(
  "Keybinds_default",
  `        </div>
    </div>
</div>`,
  `

    <div class="section">
        <div class="section-title">Precise Angles</div>
        <div class="section-content key-grid">
            <div class="content-option key-tile">
                <span class="option-title">Rotate Move Left</span>
                <button id="_angleLeft" class="hotkeyInput"></button>
            </div>
            <div class="content-option key-tile">
                <span class="option-title">Rotate Move Right</span>
                <button id="_angleRight" class="hotkeyInput"></button>
            </div>
            <div class="content-option key-tile">
                <span class="option-title">Toggle Mouse Movement</span>
                <button id="_mouseMovementKey" class="hotkeyInput"></button>
            </div>
        </div>
    </div>`,
  "after"
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
