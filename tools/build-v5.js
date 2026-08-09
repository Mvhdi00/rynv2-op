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
 *
 * v5 also takes the feature without any new keybinds, so the nudge keys and the
 * mouse-movement hotkey are switched off in the shared module. The mouse is then
 * the way onto the fine grid: the Mouse Movement checkbox in Misc.
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
  Angles.angleGrid({ moveSteps: 720 }) + `  const getAngleFromBitmask = (bitmask, rotate) => {`
);

edit(
  "angles: settings",
  `  const defaultSettings = {
    _primary: "Digit1",`,
  `  const defaultSettings = {
` + Angles.settings({ nudgeKeys: false, moveSteps: 720 }) + `
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
  Angles.movement("", { nudgeKeys: false, wire: "wireAngle" })
);

edit(
  "angles: input handler state",
  `    lockPosition=false;
    mouse={`,
  `    lockPosition=false;
` + Angles.inputState({ nudgeKeys: false }) + `
    mouse={`
);

edit(
  "angles: clear the steer timer with the rest of the input state",
  `    reset() {
      this.hotkeys.clear();
      this.move = 0;
      this.instaReset();
    }`,
  `    reset() {
      this.hotkeys.clear();
      this.move = 0;
      if (this._steerTimer !== null) {
        clearTimeout(this._steerTimer);
        this._steerTimer = null;
      }
      this.instaReset();
    }`
);

/* No keydown hook here: it exists only to dispatch handleAngleKeys, and v5 was
 * asked for the feature without new keybinds. Leaving the hook in would have
 * called a method that is no longer generated — a TypeError on every keypress. */

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
 * 4. Spike back in the placer
 *
 * v5's port collapsed auraro's spike/trap alternation to trap-only —
 * `autoPlace(0, AURA_SPIKE, AURA_TRAP)` became `autoPlace(0, AURA_TRAP, null)`,
 * and PrePlacer and Replacer were pinned to the trap as well.
 *
 * The spike comes back, gated on distance to the enemy: inside `_spikeRange` it
 * takes the slots the trap would have taken, and past that range every module
 * stays trap-only exactly as before. Auraro's own pairing does the rest — mode 1
 * puts a spike next to an existing trap and a trap next to an existing spike —
 * so passing the spike as the primary with the trap as its fallback is the
 * arrangement auraro shipped, just distance-gated.
 *
 * The port's reason for dropping the spike from PrePlacer was that it would
 * fight the spike-tick modules over a slot. That guard already exists and still
 * holds: `auraSpikeTickBusy` makes all three placers yield the tick outright
 * whenever a spike-tick module has claimed it.
 * ------------------------------------------------------------------ */

edit(
  "spike: range gate",
  `  function auraSpikeTickBusy(ModuleHandler) {`,
  `  /* Should this placement be a spike rather than a trap? Only within
   * _spikeRange of the enemy, and only if a spike is actually placeable — the
   * caller falls back to the trap otherwise. */
  function auraUseSpike(client, distance) {
    if (!Settings_default._spikePlacer) return false;
    if (distance > (Settings_default._spikeRange ?? 150)) return false;
    return client.myPlayer.canPlace(AURA_SPIKE);
  }
  function auraSpikeTickBusy(ModuleHandler) {`
);

/* AutoPlacer: the dispatch. Spike primary, trap as type2, so auraro's own
 * fallback path covers everywhere the spike does not fit. */
edit(
  "spike: autoplacer dispatch",
  `      const pushing = Settings_default._autoPush && dist <= (Settings_default._autoPushRange ?? 250);
      if (pushing) {
        if (dist <= 169 || dist > 222) {
          placer.autoPlace(0, AURA_TRAP, null);
        }
        return;
      }
      if (dist <= 222) {
        if (enemy.isTrapped || enemy.wasTrapped && enemy.wasTrapped()) {
          placer.autoPlace(0, AURA_TRAP, null);
        } else {
          placer.autoPlace(1, AURA_TRAP, null, false);
        }
        return;
      }
      if (dist > 269 && dist < 400) {
        placer.autoPlace(0, AURA_TRAP, null);
      } else if (dist <= 269) {
        placer.autoPlace(1, AURA_TRAP, null, false);
      }`,
  `      const spike = auraUseSpike(this.client, dist);
      const first = spike ? AURA_SPIKE : AURA_TRAP;
      const second = spike ? AURA_TRAP : null;
      const pushing = Settings_default._autoPush && dist <= (Settings_default._autoPushRange ?? 250);
      if (pushing) {
        if (dist <= 169 || dist > 222) {
          placer.autoPlace(0, first, second);
        }
        return;
      }
      if (dist <= 222) {
        if (enemy.isTrapped || enemy.wasTrapped && enemy.wasTrapped()) {
          placer.autoPlace(0, first, second);
        } else {
          placer.autoPlace(1, first, second, false);
        }
        return;
      }
      if (dist > 269 && dist < 400) {
        placer.autoPlace(0, first, second);
      } else if (dist <= 269) {
        placer.autoPlace(1, first, second, false);
      }`
);

/* PrePlacer: the slot it is about to free gets a spike when the enemy is close
 * enough, a trap otherwise. The range cache is keyed by item so the two never
 * read each other's arcs. */
edit(
  "spike: preplacer slot item",
  `        // Traps only. Auraro would spike here when the enemy is pinned by
        // something else; leaving spikes to the spike-tick modules keeps the
        // two from fighting over the same slot.
        if (!myPlayer.canPlace(AURA_TRAP)) {
          continue;
        }
        // Straight at the slot it is about to free. preplaceCheck is the right
        // test here: it skips the doomed build and demands the landing overlap
        // it, which is exactly "the same place".
        const exact = placer.rebuildAngle(obj.pos.current, pred.x, pred.y, AURA_TRAP, {
          freeing: obj
        });
        let angle = exact ? exact.angle : null;
        if (angle === null) {
          const key = obj.id + "_" + AURA_TRAP;
          if (!this._rangeCache[key]) {
            placer.calcPreplace(obj, AURA_TRAP, pred.x, pred.y);
            this._rangeCache[key] = placer.preplaceRanges[AURA_TRAP];
          } else {
            placer.preplaceRanges[AURA_TRAP] = this._rangeCache[key];
          }
          angle = placer.findPlacementAngle(AURA_TRAP, obj, pred.x, pred.y, enemy);
        }
        if (angle !== null && placer.send(AURA_TRAP, angle)) {
          found += 1;
        }`,
  `        // Spike when the enemy is inside the spike range, trap otherwise. The
        // spike-tick modules cannot be fighting for this slot: auraSpikeTickBusy
        // has already yielded the whole tick to them if one claimed it.
        const item = auraUseSpike(this.client, myPlayer.pos.current.distance(enemy.pos.current)) ? AURA_SPIKE : AURA_TRAP;
        if (!myPlayer.canPlace(item)) {
          continue;
        }
        // Straight at the slot it is about to free. preplaceCheck is the right
        // test here: it skips the doomed build and demands the landing overlap
        // it, which is exactly "the same place".
        const exact = placer.rebuildAngle(obj.pos.current, pred.x, pred.y, item, {
          freeing: obj
        });
        let angle = exact ? exact.angle : null;
        if (angle === null) {
          const key = obj.id + "_" + item;
          if (!this._rangeCache[key]) {
            placer.calcPreplace(obj, item, pred.x, pred.y);
            this._rangeCache[key] = placer.preplaceRanges[item];
          } else {
            placer.preplaceRanges[item] = this._rangeCache[key];
          }
          angle = placer.findPlacementAngle(item, obj, pred.x, pred.y, enemy);
        }
        if (angle !== null && placer.send(item, angle)) {
          found += 1;
        }`
);

/* Replacer: what goes back into a building that just broke. */
edit(
  "spike: replacer rebuild item",
  `      const pred = auraPredictPos(this.client, 1);
      placer.rangesUpdated[AURA_TRAP] = false;
      placer.angleRanges(AURA_TRAP, pred.x, pred.y);
      const rTrap = placer.ranges[AURA_TRAP];`,
  `      const pred = auraPredictPos(this.client, 1);
      const rebuild = auraUseSpike(this.client, myPos.distance(enemy.pos.current)) ? AURA_SPIKE : AURA_TRAP;
      placer.rangesUpdated[rebuild] = false;
      placer.angleRanges(rebuild, pred.x, pred.y);
      const rTrap = placer.ranges[rebuild];`
);

/* ------------------------------------------------------------------ *
 * 5. Placement speed
 *
 * Two things held the placers back, and both are measurable rather than felt.
 *
 * ModuleHandler.place sends four packets every time — select the building,
 * attack, stop, put the weapon back — with no state check, so placing two
 * spikes in a row re-selected the spike and restored the weapon twice for
 * nothing. Against the client's own 70 packets/second that capped every module
 * together at roughly 14-17 placements a second.
 *
 * The select is now skipped when that item is already in hand, and the weapon
 * restore is deferred to the end of the module that placed — so a burst of N
 * costs 2N + 2 packets instead of 4N. The restore is flushed between modules,
 * not at the end of the tick, so nothing after the placers ever runs with the
 * wrong item held.
 *
 * `currentHolding` is the right thing to test against because selectItem and
 * whichWeapon are the only two writers, so anything else changing the held item
 * is seen here immediately.
 *
 * The second limit was AURA_MAX_PER_TICK, which stopped PrePlacer and Replacer
 * after two placements each. With the packet cost halved it goes to four.
 * ------------------------------------------------------------------ */

edit(
  "speed: batch the placement packets",
  `    place(type, angle = this._currentAngle, reset = false) {
      this.totalPlaces += 1;
      this.selectItem(type);
      this.attack(angle, 1);
      this.stopAttack(angle);
      this.whichWeapon(this._getPredictWeapon());
    }`,
  `    place(type, angle = this._currentAngle, reset = false) {
      this.totalPlaces += 1;
      /* Already holding it from the previous placement in this burst. */
      if (this.currentHolding !== type) {
        this.selectItem(type);
      }
      this.attack(angle, 1);
      this.stopAttack(angle);
      this._placeBatchOpen = true;
    }
    _placeBatchOpen=false;
    /* Put the weapon back, once, after the module that placed is done with the
     * tick. Called between modules so nothing downstream sees a building in
     * hand. */
    _flushPlaceBatch() {
      if (!this._placeBatchOpen) {
        return;
      }
      this._placeBatchOpen = false;
      this.whichWeapon(this._getPredictWeapon());
    }`
);

edit(
  "speed: flush the batch between modules",
  `      for (const module of this.modules) {
        const prevg = this.moduleActive;
        module.postTick();
        if (!prevg && this.moduleActive) {
          this.activeModule = module.moduleName;
        }
      }`,
  `      for (const module of this.modules) {
        const prevg = this.moduleActive;
        module.postTick();
        this._flushPlaceBatch();
        if (!prevg && this.moduleActive) {
          this.activeModule = module.moduleName;
        }
      }`
);

edit(
  "speed: more placements per tick",
  `  const AURA_MAX_PER_TICK = 2;`,
  `  const AURA_MAX_PER_TICK = 4;`
);

edit(
  "spike: settings",
  `  const defaultSettings = {
` + Angles.settings({ nudgeKeys: false, moveSteps: 720 }) + `
    _primary: "Digit1",`,
  `  const defaultSettings = {
` + Angles.settings({ nudgeKeys: false, moveSteps: 720 }) + `
    _spikePlacer: true,
    _spikeRange: 150,
    _primary: "Digit1",`
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
        <h2 class="section-title">Precise Angles &amp; Spike Placer</h2>\r
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
                    <input id="_moveAngleSteps" type="range" step="8" min="8" max="720">\r
                </label>\r
                <span class="option-description">Steps the circle is cut into for movement, before the client rounds the angle the way it already rounds every place angle. At 720 that lands on 628 distinct directions — the most the game can express — with all eight key directions still exact. Costs nothing at any setting.</span>\r
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
                <span class="option-title">Spike Placer</span>\r
                <label class="switch-checkbox">\r
                    <input id="_spikePlacer" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Autoplace, preplace and replace put a spike in the slot instead of a trap while the enemy is inside the spike range. Past that range they stay trap-only. Off is trap-only everywhere, as before.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Spike Range</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_spikeRange" type="range" step="10" min="60" max="250">\r
                </label>\r
                <span class="option-description">How close the enemy has to be before the spike takes over the slot. A spike can only land touching them at about 170 and under; below that it is strictly a contact spike.</span>\r
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

/* No Keybinds page section either — the three tiles bound ids that no longer
 * exist in defaultSettings, which the menu binder reports and then ignores. */

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
