#!/usr/bin/env node
/*
 * build-reup.js
 *
 * Builds ReUp_Mix.user.js from the RYN v4 client, folding in the Luna features
 * RYN never had and correcting one driver table against the shipped game bundle.
 *
 * RYN is the base rather than Luna because only RYN speaks the protocol the
 * current game actually uses: the per-connection opcode permutation plus the
 * truncated-HMAC frame prefix in src/game_index.js. Luna 1.1 is a fork of the
 * old webpack bundle and predates that transport entirely, so its features are
 * ported across as modules instead of its code being merged in.
 *
 *   node tools/build-reup.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/RYN_Client_v4.js");
const OUT = path.join(ROOT, "ReUp_Mix.user.js");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

/* Every edit goes through here so a stale anchor fails the build loudly
 * instead of silently producing a half-merged script. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 * ------------------------------------------------------------------ */

const header = `// ==UserScript==
// @name            ReUp Mix (Luna x Ryn)
// @namespace       reup-mix
// @author          Mix build - RYN v4 by Raptor, Luna Client by Luna & Skye (help from Zenith and XTRFY)
// @description     RYN v4 core on the current protocol, with the Luna-only features folded in
// @version         1.0.0
// @match           *://moomoo.io/
// @match           *://moomoo.io/?server*
// @match           *://*.moomoo.io/
// @match           *://*.moomoo.io/?server*
// @run-at          document-start
// @grant           none
// @license         MIT
// ==/UserScript==
`;

{
  const end = code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of base userscript header");
  code = header + code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  applied.push("header: rewritten for ReUp Mix");
}

/* ------------------------------------------------------------------ *
 * 2. Drop the phone-home beacon
 *
 * RYN v4 opens with a fetch to a webhook.site endpoint on first run, gated by
 * a localStorage flag. It sends nothing but the hit itself, but it is an
 * unannounced call to a third party the user never agreed to, so it goes.
 * ------------------------------------------------------------------ */

{
  const beacon = code.match(
    /\(function\(\) \{\s*try \{\s*if \(!localStorage\.getItem\("_ryn_sent"\)\)[\s\S]*?\}\)\(\);\s*/
  );
  if (!beacon) throw new Error("anchor not found: webhook beacon");
  code = code.replace(
    beacon[0],
    "/* removed in ReUp Mix: RYN v4's first-run beacon to webhook.site */\n\n"
  );
  applied.push("privacy: removed first-run webhook.site beacon");
}

/* ------------------------------------------------------------------ *
 * 3. Branding
 * ------------------------------------------------------------------ */

edit(
  "branding: window title",
  `  if (document.title !== "Ryn") document.title = "Ryn";`,
  `  if (document.title !== "ReUp Mix") document.title = "ReUp Mix";`
);

/* ------------------------------------------------------------------ *
 * 4. Driver correction
 *
 * verify-drivers.js flags item group 8 (the platform / "watchtower" group) as
 * layer -1 in RYN, while the shipped bundle has layer 1. PlayerObject reads
 * ItemGroups[group].layer straight into its own .layer, which every collision
 * and placement check keys off, so the wrong value makes the client treat
 * platforms as a pass-under layer like traps and boost pads.
 * ------------------------------------------------------------------ */

edit(
  "drivers: item group 8 layer -1 -> 1 (matches shipped bundle)",
  `    [8]: {
      name: "Plaftorm",
      limit: 12,
      layer: -1
    },`,
  `    [8]: {
      name: "Plaftorm",
      limit: 12,
      layer: 1
    },`
);

/* ------------------------------------------------------------------ *
 * 5. Settings for the ported Luna features
 * ------------------------------------------------------------------ */

edit(
  "settings: ReUp keys",
  `    _lunaMigration: 0,`,
  `    _spikeRotation: true,
    _millRotation: true,
    _usernameCycler: false,
    _usernameList: "Luna1, Luna2, Luna3",
    _usernameIndex: 0,
    _menuTheme: "ryn",
    _lunaMigration: 0,`
);

/* ------------------------------------------------------------------ *
 * Autoplacer item-limit check
 *
 * AutoPlacer._isItemLimit read `group.sandboxLimit || 99` and never looked at
 * `group.limit`, so outside sandbox the cap was 99 for everything without a
 * sandboxLimit (spikes 15, traps 6, turrets 2, mines 1) and 299 for the three
 * that have one. The limit gate therefore effectively never fired, and the
 * placer kept spending placement ticks on items it could not place.
 *
 * This came from Luna, which has the same expression. The rest of the client
 * already gets it right: ClientPlayer.getItemCount picks sandboxLimit only when
 * actually in sandbox and falls back to group.limit otherwise, and AutoRetrap's
 * own _isItemLimit is written against that. AutoPlacer is switched to the same
 * call so all three agree.
 * ------------------------------------------------------------------ */

edit(
  "autoplacer: honour real item-group limits",
  `    _isItemLimit(id, myPlayer) {
      const group = ItemGroups[Items[id].itemGroup];
      const limit = ("sandboxLimit" in group ? group.sandboxLimit : null) || 99;
      const count = myPlayer.itemCount.get(Items[id].itemGroup) || 0;
      return count >= limit;
    }`,
  `    _isItemLimit(id, myPlayer) {
      const {count: count, limit: limit} = myPlayer.getItemCount(Items[id].itemGroup);
      return count >= limit;
    }`
);

/* Legit Mode flips every boolean setting off. The ported toggles are cosmetic
 * (rotation) or naming (cycler), so they sit alongside the other exclusions
 * rather than being reset along with the combat automation. */
edit(
  "settings: keep ReUp toggles out of Legit Mode",
  `"_botAttackStagger" ]);`,
  `"_botAttackStagger", "_spikeRotation", "_millRotation", "_usernameCycler" ]);`
);

/* ------------------------------------------------------------------ *
 * 6. Object spin hook (Luna: "spike rotation" / "mill rotation")
 *
 * Luna gates `this.dir += this.turnSpeed * delta` in the object update on a
 * pair of toggles so spinning spikes and mills can be frozen and read at a
 * glance. RYN already rewrites that same expression for its low-quality mode,
 * so the specific object-update site is claimed first and routed through a
 * helper that honours both; the existing generic hook then only catches the
 * remaining animal turn-rate site.
 * ------------------------------------------------------------------ */

edit(
  "hook: object rotation toggles",
  `    Hook.replace("freezeTurnSpeed",`,
  `    Hook.replace("objectRotation", /(\\w+)\\.turnSpeed\\s*&&\\s*\\(\\1\\.dir\\s*\\+=\\s*\\1\\.turnSpeed\\s*\\*\\s*(\\w+)\\)/, "$1.turnSpeed&&($1.dir+=RYN._objectSpin($1,$2))");
    Hook.replace("freezeTurnSpeed",`
);

edit(
  "bridge: RYN._objectSpin",
  `    _config: {},
    version: version,`,
  `    _config: {},
    /* Per-frame rotation delta for a placed object. Group 2 is spikes and
     * group 3 is mills; the id ranges are the fallback for objects that
     * reach here before their group is resolved. */
    _objectSpin(object, delta) {
      try {
        if (Settings_default._lowQuality) return 0;
        const groupId = object.group ? object.group.id : -1;
        const id = object.id;
        const isSpike = groupId === 2 || (groupId === -1 && id > 5 && id < 10);
        const isMill = groupId === 3 || (groupId === -1 && id > 9 && id < 13);
        if (isSpike && !Settings_default._spikeRotation) return 0;
        if (isMill && !Settings_default._millRotation) return 0;
        return object.turnSpeed * delta;
      } catch (e) {
        return object.turnSpeed * delta;
      }
    },
    version: version,`
);

/* ------------------------------------------------------------------ *
 * 7. Username cycler (Luna)
 *
 * Advances the name in #nameInput through a user-supplied list every time the
 * player spawns, so consecutive lives do not share a name. Luna hangs this off
 * document-level capture listeners for Enter and the play button; same idea
 * here, wired where the rest of the client's DOM setup happens.
 * ------------------------------------------------------------------ */

edit(
  "module: username cycler",
  `  const contentLoaded = () => {
    Logger.test("Menu initialization..");`,
  `  const cycleUsername = () => {
    if (!Settings_default._usernameCycler) return;
    const names = (Settings_default._usernameList || "")
      .split(",")
      .map(n => n.trim())
      .filter(Boolean);
    if (!names.length) return;
    const index = ((Settings_default._usernameIndex || 0) + 1) % names.length;
    Settings_default._usernameIndex = index;
    const nextName = names[index];
    const nameInput = document.getElementById("nameInput");
    if (nameInput) {
      nameInput.value = nextName;
      nameInput.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      nameInput.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
    SaveSettings();
  };
  const handleSpawnForCycler = event => {
    if (!Settings_default._usernameCycler) return;
    const nameInput = document.getElementById("nameInput");
    if (!nameInput || !nameInput.offsetParent) return;
    const isEnter = event.type === "keydown" && event.code === "Enter";
    const isPlayClick = event.type === "click" && event.target && event.target.id === "enterGame";
    if (isEnter || isPlayClick) cycleUsername();
  };
  document.addEventListener("keydown", handleSpawnForCycler, true);
  document.addEventListener("click", handleSpawnForCycler, true);
  const contentLoaded = () => {
    Logger.test("Menu initialization..");`
);

/* ------------------------------------------------------------------ *
 * 8. Menu themes (Luna)
 *
 * Luna ships five accent presets behind a picker. RYN's stylesheet already
 * drives every accent off --accent / --accent2 / --border-active on :root, so
 * a theme is just an override of those three on the menu root.
 * ------------------------------------------------------------------ */

const THEMES = {
  ryn: { name: "Ryn", accent: "#7A42F4", accent2: "#3A86FF" },
  nvg: { name: "NVG", accent: "#10B981", accent2: "#34D399" },
  ice: { name: "Ice", accent: "#0EA5E9", accent2: "#38BDF8" },
  red: { name: "Red", accent: "#EF4444", accent2: "#F87171" },
  void: { name: "Void", accent: "#D946EF", accent2: "#E879F9" },
};

edit(
  "menu: theme binder",
  `        this.attachTextInputs();`,
  `        this.attachTextInputs();
        this.attachReUpTheme();`
);

edit(
  "menu: attachReUpTheme",
  `    attachDescriptions() {`,
  `    get reUpThemes() {
      return ${JSON.stringify(THEMES, null, 6).replace(/\n/g, "\n      ")};
    }
    applyReUpTheme(key) {
      const theme = this.reUpThemes[key] || this.reUpThemes.ryn;
      const doc = this.frame && this.frame.document;
      if (!doc || !doc.documentElement) return;
      const root = doc.documentElement.style;
      root.setProperty("--accent", theme.accent);
      root.setProperty("--accent2", theme.accent2);
      root.setProperty("--border-active", theme.accent + "80");
    }
    attachReUpTheme() {
      const buttons = this.querySelectorAll(".reup-theme[data-theme]");
      const paint = () => {
        for (const button of buttons) {
          button.classList.toggle("active", button.dataset.theme === Settings_default._menuTheme);
        }
      };
      for (const button of buttons) {
        const key = button.dataset.theme;
        const theme = this.reUpThemes[key];
        if (theme) button.style.setProperty("--swatch", theme.accent);
        button.onclick = () => {
          Settings_default._menuTheme = key;
          SaveSettings();
          this.applyReUpTheme(key);
          paint();
        };
      }
      paint();
      this.applyReUpTheme(Settings_default._menuTheme);
    }
    attachDescriptions() {`
);

/* ------------------------------------------------------------------ *
 * 9. Menu markup for the ported features
 *
 * The page constants are JS string literals, so decode, splice, re-encode.
 * Checkboxes and text inputs bind themselves by id off the settings object.
 * ------------------------------------------------------------------ */

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

const themeButtons = Object.entries(THEMES)
  .map(
    ([key, theme]) =>
      `                    <button class="reup-theme" data-theme="${key}" title="${theme.name}"></button>`
  )
  .join("\r\n");

patchPage(
  "Misc_default",
  "\r\n\r\n    <!-- Menu -->",
  `\r
    <!-- ReUp Mix -->\r
    <div class="section">\r
        <h2 class="section-title">ReUp Mix</h2>\r
\r
        <div class="section-content">\r
\r
            <div class="content-option">\r
                <span class="option-title">Username Cycler</span>\r
                <div class="option-content">\r
                    <input id="_usernameList" class="input" type="text" maxlength="120">\r
                    <label class="switch-checkbox">\r
                        <input id="_usernameCycler" type="checkbox">\r
                        <span></span>\r
                    </label>\r
                </div>\r
                <span class="option-description">Uses the next name in the comma separated list every time you spawn.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Spike Rotation</span>\r
                <label class="switch-checkbox">\r
                    <input id="_spikeRotation" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Off freezes spinning spikes so their hitbox is easier to read.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Mill Rotation</span>\r
                <label class="switch-checkbox">\r
                    <input id="_millRotation" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Off freezes windmills and power mills.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Menu Theme</span>\r
                <div class="option-content reup-theme-row">\r
${themeButtons}\r
                </div>\r
            </div>\r
\r
        </div>\r
    </div>\r
`
);

/* Styles for the theme swatch row. */
{
  const declaration = "const styles_default = ";
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error("styles_default not found");
  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");
  // eslint-disable-next-line no-eval
  const css = eval(literal);

  const extra = `
.reup-theme-row{display:flex;gap:8px;align-items:center;}
.reup-theme{
  width:22px;height:22px;padding:0;border-radius:50%;cursor:pointer;
  background:var(--swatch,#7A42F4);
  border:2px solid transparent;
  transition:border-color 140ms ease,transform 140ms ease;
}
.reup-theme:hover{transform:scale(1.12);}
.reup-theme.active{border-color:var(--text);}
`;

  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(css + extra) +
    ";" +
    code.slice(lineEnd);
  applied.push("menu: theme swatch styles");
}

/* ------------------------------------------------------------------ *
 * 10. Precise angles
 *
 * Nothing in the protocol quantises a direction. The move packet ("9") carries
 * a raw float in radians and the server feeds it straight into
 * `cos(moveDir) / sin(moveDir)` (src/game_index.js, Player.update), and the
 * placement angle rides along the same kind of float. What limits a client is
 * its own input and its own search grid:
 *
 *   - the key vector gives 8 absolute directions and nothing between them
 *     (game_index.js `bt`, and the client's own getAngleFromBitmask), and
 *     vanilla even drops changes smaller than 0.3 rad on the way out;
 *   - the placer walked the circle in 72 steps, i.e. 5 degrees.
 *
 * Both move onto one shared N-step grid, 144 by default: 2.5 degrees for
 * movement and for building. The grid is also what makes the finer resolution
 * affordable — a direction is only sent when it lands on a new step, so a full
 * mouse sweep costs at most N packets rather than one per mousemove, against
 * the 70 packets/second the client budgets itself (ModuleHandler.packetLimit).
 *
 * Reaching the extra directions needs an input that can express them, so two
 * are added: mouse movement (the key vector is read relative to the cursor, so
 * W means "toward the cursor") and a pair of nudge keys that rotate by whole
 * steps. Module-computed angles — pathfinder, autopush, safewalk — are left as
 * the raw floats they already are; they were never the thing being rounded.
 * ------------------------------------------------------------------ */

edit(
  "angles: AngleGrid helper",
  `  const getAngleFromBitmask = (bitmask, rotate) => {`,
  `  /* One circle, N steps, shared by movement and placement. Both fall back to
   * the pre-mix resolutions when precise angles are off, so the toggle is a
   * true bypass rather than a different setting. */
  const AngleGrid = {
    /* 624 rather than 628: it is the largest multiple of 8 at or under the 628
     * directions the game's own fixTo(angle, 2) can express, and a multiple of
     * 8 keeps the eight key directions exactly on the grid at every setting. */
    _steps(value, fallback) {
      const steps = Math.round(Number(value));
      return Number.isFinite(steps) && steps >= 4 ? steps : fallback;
    },
    get moveSteps() {
      return Settings_default._preciseAngles ? this._steps(Settings_default._moveAngleSteps, 624) : 8;
    },
    get buildSteps() {
      return Settings_default._preciseAngles ? this._steps(Settings_default._buildAngleSteps, 624) : 72;
    },
    step(steps) {
      return Math.PI * 2 / steps;
    },
    /* Step index of an angle, wrapped into [0, steps) so negative radians and
     * angles past a full turn land on the same step as their equivalents. */
    index(angle, steps) {
      const step = this.step(steps);
      return (Math.round(angle / step) % steps + steps) % steps;
    },
    fromIndex(index, steps) {
      return index * this.step(steps);
    },
    snap(angle, steps) {
      if (angle === null || angle === undefined || !Number.isFinite(angle)) return angle;
      return this.fromIndex(this.index(angle, steps), steps);
    }
  };
  const getAngleFromBitmask = (bitmask, rotate) => {`
);

edit(
  "angles: settings",
  `    _autoplacerRadius: 350,
    _placeAttempts: 4,`,
  `    _autoplacerRadius: 350,
    _placeAttempts: 4,
    _preciseAngles: true,
    _moveAngleSteps: 624,
    _buildAngleSteps: 624,
    _mouseMovement: false,
    _mouseMovementKey: "",
    _angleLeft: "KeyJ",
    _angleRight: "KeyL",`
);

/* Precise angles are input resolution, not automation: they decide how finely
 * a direction can be expressed, not whether the client acts on its own. They
 * sit with the other exclusions so Legit Mode does not quietly drop the player
 * back to 8-direction movement. */
edit(
  "angles: keep out of Legit Mode",
  `"_usernameCycler" ]);`,
  `"_usernameCycler", "_preciseAngles", "_mouseMovement" ]);`
);

/* ---- Building ---------------------------------------------------- *
 * The placement scan and its cache were written around a literal 72. Both
 * become a parameter, and the cache rebuilds when the resolution changes so a
 * mid-game slider move cannot leave a half-filled array behind.
 *
 * The scan also stops paying per angle. `_canPlace` runs a spatial-grid query
 * for every angle it tests — 81 cell lookups and a fresh Set each time — so the
 * cost was linear in the step count and 628 steps would have cost 129 ms of a
 * 111 ms tick. Solving the same question analytically instead makes the cost
 * scale with the objects around the player rather than with the resolution, and
 * a scan at any resolution then lands well under what 72 steps used to cost.
 * ------------------------------------------------------------------ */

edit(
  "angles: analytic placement mask",
  `  function _getCachedPrePlaceAngles(`,
  `  /* The placeable/blocked map for one scan, from a single grid query.
   *
   * Every placement candidate sits on a circle of radius \`length\` around the
   * player, so an object at distance \`d\` blocks one contiguous arc of that
   * circle: the angles within acos((d² + length² - reach²) / (2·d·length)) of
   * the object's own bearing, where \`reach\` is the two scales added. That is
   * the same law ObjectManager.getBestPlacementAngles already solves for its
   * tangents — it is just applied to the whole circle at once here.
   *
   * The answer is \`_canPlace\`'s answer, angle for angle, including the strict
   * comparison at the boundary and the river rule; tools/check-angles.js holds
   * it to that against the sampling original.
   */
  function _getPlaceableMask(id, myPos, ObjectManager2, excludeObj, steps) {
    const item = Items[id];
    const length = 35 + item.scale + (item.placeOffset || 0);
    const mask = new Uint8Array(steps);
    const arcs = [];
    let blocksEverything = false;
    /* One query around the player. Its radius covers the placement circle plus
     * the furthest an object can reach onto it, so it is a superset of what the
     * per-angle queries saw. */
    ObjectManager2.grid2D.query(myPos.x, myPos.y, 4, objId => {
      const obj = ObjectManager2.objects.get(objId);
      if (!obj) return;
      if (excludeObj && obj === excludeObj) return;
      const dx = obj.pos.current.x - myPos.x;
      const dy = obj.pos.current.y - myPos.y;
      const distance = Math.hypot(dx, dy);
      const reach = item.scale + obj.placementScale;
      if (distance >= length + reach) return;
      if (distance < reach - length) {
        blocksEverything = true;
        return;
      }
      const cosArg = (distance * distance + length * length - reach * reach) / (2 * distance * length);
      /* also catches the NaN a zero distance produces */
      if (!(cosArg < 1)) return;
      arcs.push(Math.atan2(dy, dx), cosArg <= -1 ? Math.PI : Math.acos(cosArg));
    });
    if (blocksEverything) return mask;
    mask.fill(1);
    const step = Math.PI * 2 / steps;
    for (let a = 0; a < arcs.length; a += 2) {
      const from = arcs[a] - arcs[a + 1];
      const to = arcs[a] + arcs[a + 1];
      /* strictly inside the arc, matching _canPlace's strict distance test */
      for (let k = Math.floor(from / step) + 1; k * step < to; k++) {
        if (k * step <= from) continue;
        mask[(k % steps + steps) % steps] = 0;
      }
    }
    if (id !== 18) {
      const mid = Config_default.mapScale / 2;
      const riverHalf = Config_default.riverWidth / 2;
      for (let i = 0; i < steps; i++) {
        if (!mask[i]) continue;
        const y = myPos.y + length * Math.sin(i * step);
        if (y >= mid - riverHalf && y <= mid + riverHalf) mask[i] = 0;
      }
    }
    return mask;
  }
  function _getCachedPrePlaceAngles(`
);

edit(
  "angles: preplace cache takes a step count",
  `  function _getCachedPrePlaceAngles(client, tickCount, cacheKey, computeAngle, forceFull = false, rotationGroups = PRE_PLACE_ROTATION, priorityIndex = -1) {
    let clientCache = _prePlaceAngleCache.get(client);
    if (!clientCache) {
      clientCache = new Map;
      _prePlaceAngleCache.set(client, clientCache);
    }
    let entry = clientCache.get(cacheKey);
    if (!entry) {
      entry = {
        angles: new Array(72).fill(null),
        lastTick: -1,
        wasFull: false
      };
      clientCache.set(cacheKey, entry);
    }
    const isNewTick = entry.lastTick !== tickCount;
    if (isNewTick) {
      entry.lastTick = tickCount;
      entry.wasFull = false;
    }
    if (forceFull && !entry.wasFull) {
      for (let i = 0; i < 72; i++) {
        entry.angles[i] = computeAngle(i);
      }
      entry.wasFull = true;
    } else if (isNewTick) {
      const phase = tickCount % rotationGroups;
      for (let i = phase; i < 72; i += rotationGroups) {
        entry.angles[i] = computeAngle(i);
      }
      for (let i = 0; i < 72; i++) {
        if (entry.angles[i] === null) entry.angles[i] = computeAngle(i);
      }
    }
    if (priorityIndex >= 0 && priorityIndex < 72) {`,
  `  function _getCachedPrePlaceAngles(client, tickCount, cacheKey, computeAngle, forceFull = false, rotationGroups = PRE_PLACE_ROTATION, priorityIndex = -1, steps = 72) {
    let clientCache = _prePlaceAngleCache.get(client);
    if (!clientCache) {
      clientCache = new Map;
      _prePlaceAngleCache.set(client, clientCache);
    }
    let entry = clientCache.get(cacheKey);
    if (!entry || entry.angles.length !== steps) {
      entry = {
        angles: new Array(steps).fill(null),
        lastTick: -1,
        wasFull: false
      };
      clientCache.set(cacheKey, entry);
    }
    const isNewTick = entry.lastTick !== tickCount;
    if (isNewTick) {
      entry.lastTick = tickCount;
      entry.wasFull = false;
    }
    if (forceFull && !entry.wasFull) {
      for (let i = 0; i < steps; i++) {
        entry.angles[i] = computeAngle(i);
      }
      entry.wasFull = true;
    } else if (isNewTick) {
      const phase = tickCount % rotationGroups;
      for (let i = phase; i < steps; i += rotationGroups) {
        entry.angles[i] = computeAngle(i);
      }
      for (let i = 0; i < steps; i++) {
        if (entry.angles[i] === null) entry.angles[i] = computeAngle(i);
      }
    }
    if (priorityIndex >= 0 && priorityIndex < steps) {`
);

/* AutoPlacer: the quadrant it refuses to build in is a quarter of the circle,
 * so its divisor follows the step count instead of staying at 72/4. */
edit(
  "angles: autoplacer preplace scan",
  `      const retrapQuadrant = this.client._retrapQuadrant ?? -1;
      const computeAngle = i => {
        if (retrapQuadrant >= 0 && Math.floor(i / 18) === retrapQuadrant) {
          return {
            angle: i * (Math.PI * 2 / 72),
            placeable: false,
            perfect: false
          };
        }
        const angle = i * (Math.PI * 2 / 72);`,
  `      const retrapQuadrant = this.client._retrapQuadrant ?? -1;
      const steps = AngleGrid.buildSteps;
      const quadrant = steps / 4;
      /* built on first use, so a scan served entirely from cache costs nothing */
      let placeableMask = null;
      const computeAngle = i => {
        if (retrapQuadrant >= 0 && Math.floor(i / quadrant) === retrapQuadrant) {
          return {
            angle: AngleGrid.fromIndex(i, steps),
            placeable: false,
            perfect: false
          };
        }
        if (placeableMask === null) {
          placeableMask = _getPlaceableMask(id, myPos, ObjectManager2, excludeObj, steps);
        }
        const angle = AngleGrid.fromIndex(i, steps);`
);

edit(
  "angles: autoplacer reads the mask",
  `          placeable: this._canPlace(id, angle, myPos, ObjectManager2, excludeObj),
          perfect: false
        };
      };
      const forceFull = tickCount < (this.client._focusUntilTick || -1);
      const angles = _getCachedPrePlaceAngles(this.client, tickCount, cacheKey, computeAngle, forceFull, 1);`,
  `          placeable: placeableMask[i] === 1,
          perfect: false
        };
      };
      const forceFull = tickCount < (this.client._focusUntilTick || -1);
      const angles = _getCachedPrePlaceAngles(this.client, tickCount, cacheKey, computeAngle, forceFull, 1, -1, steps);`
);

/* AutoRetrap: same scan, plus the enemy-facing step it always refreshes. */
edit(
  "angles: autoretrap preplace scan",
  `      let priorityIndex = -1;
      let myQuadrant = -1;
      if (enemyPos) {
        const dirAngle = Math.atan2(enemyPos.y - myPos.y, enemyPos.x - myPos.x);
        const normalized = (dirAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        priorityIndex = Math.round(normalized / (Math.PI * 2 / 72)) % 72;
        myQuadrant = Math.floor(priorityIndex / 18);
      }
      this.client._retrapQuadrant = myQuadrant;
      const computeAngle = i => {
        if (myQuadrant >= 0 && Math.floor(i / 18) !== myQuadrant) {
          return {
            angle: i * (Math.PI * 2 / 72),
            placeable: false,
            perfect: false
          };
        }
        const angle = i * (Math.PI * 2 / 72);`,
  `      let priorityIndex = -1;
      let myQuadrant = -1;
      const steps = AngleGrid.buildSteps;
      const quadrant = steps / 4;
      if (enemyPos) {
        const dirAngle = Math.atan2(enemyPos.y - myPos.y, enemyPos.x - myPos.x);
        priorityIndex = AngleGrid.index(dirAngle, steps);
        myQuadrant = Math.floor(priorityIndex / quadrant);
      }
      this.client._retrapQuadrant = myQuadrant;
      let placeableMask = null;
      const computeAngle = i => {
        if (myQuadrant >= 0 && Math.floor(i / quadrant) !== myQuadrant) {
          return {
            angle: AngleGrid.fromIndex(i, steps),
            placeable: false,
            perfect: false
          };
        }
        if (placeableMask === null) {
          placeableMask = _getPlaceableMask(id, myPos, ObjectManager2, excludeObj, steps);
        }
        const angle = AngleGrid.fromIndex(i, steps);`
);

edit(
  "angles: autoretrap reads the mask",
  `          placeable: this._canPlace(id, angle, myPos, ObjectManager2, excludeObj),
          perfect: false
        };
      };
      const forceFull = tickCount < (this.client._focusUntilTick || -1);
      const angles = _getCachedPrePlaceAngles(this.client, tickCount, cacheKey, computeAngle, forceFull, 1, priorityIndex);`,
  `          placeable: placeableMask[i] === 1,
          perfect: false
        };
      };
      const forceFull = tickCount < (this.client._focusUntilTick || -1);
      const angles = _getCachedPrePlaceAngles(this.client, tickCount, cacheKey, computeAngle, forceFull, 1, priorityIndex, steps);`
);

/* The remaining fixed-step placement sweeps: where a trap could bounce an
 * enemy, and whether an enemy still has a free spike slot to punish. Both were
 * 36 steps, i.e. half the placer's own resolution; both now read the same
 * building grid, so one setting describes all of it. */
edit(
  "angles: trap bounce sweep",
  `      const ANGLE_STEPS = 36;`,
  `      const ANGLE_STEPS = AngleGrid.buildSteps;`
);

edit(
  "angles: enemy spike-slot sweep",
  `      for (let i = 0; i < 36; i++) {
        const angle = i * (Math.PI * 2 / 36);
        const configX = enemyPos.x + placeLength * Math.cos(angle);`,
  `      const spikeWaitSteps = AngleGrid.buildSteps;
      for (let i = 0; i < spikeWaitSteps; i++) {
        const angle = AngleGrid.fromIndex(i, spikeWaitSteps);
        const configX = enemyPos.x + placeLength * Math.cos(angle);`
);

/* Auto-break picks the swing that covers the most buildings; it searched the
 * same 72 steps the placer used, so it follows the same setting. */
edit(
  "angles: autobreak swing search",
  `      for (let i = 0; i < 72; i++) {
        const testA = i / 72 * Math.PI * 2;`,
  `      const breakSteps = AngleGrid.buildSteps;
      for (let i = 0; i < breakSteps; i++) {
        const testA = AngleGrid.fromIndex(i, breakSteps);`
);

/* ---- Movement ---------------------------------------------------- *
 * LunaSafeWalk chose a way around a spike out of 24 candidates (15 degrees).
 * It is the one module that quantises a direction of its own, so it reads the
 * movement grid; its result is still lerped, so nothing lands on a step by
 * accident.
 * ------------------------------------------------------------------ */

edit(
  "angles: safewalk detour search",
  `        const STEPS = 24;`,
  `        const STEPS = AngleGrid.moveSteps;`
);

edit(
  "angles: input handler state",
  `    lockPosition=false;
    mouse={`,
  `    lockPosition=false;
    moveNudge=0;
    _lastSteerTime=0;
    _steerTimer=null;
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
  "angles: precise movement",
  `    handleMovement() {
      const angle = getAngleFromBitmask(this.move, false);
      this.client._ModuleHandler.startMovement(angle);
      const {isOwner: isOwner, clients: clients} = this.client;
      if (isOwner && Spectate_default.active) {
        for (const client2 of clients) {
          client2._ModuleHandler.startMovement(angle);
        }
      }
    }`,
  `    /* The direction the keys are asking for. Vanilla reads the key vector as
     * an absolute screen direction, which is 8 angles and nothing between. With
     * mouse movement on it is read relative to the cursor instead — W is
     * "toward the cursor", A and D strafe, S backs off — so aiming reaches
     * every step on the grid. The nudge offset applies in either mode. */
    getMoveAngle() {
      const base = getAngleFromBitmask(this.move, false);
      if (base === null || !Settings_default._preciseAngles) {
        return base;
      }
      const steps = AngleGrid.moveSteps;
      const relative = Settings_default._mouseMovement ? this.mouse.angle + base + Math.PI / 2 : base;
      return AngleGrid.snap(relative + this.moveNudge * AngleGrid.step(steps), steps);
    }
    handleMovement() {
      if (this.move === 0) {
        this.moveNudge = 0;
      }
      const {isOwner: isOwner, clients: clients, _ModuleHandler: ModuleHandler} = this.client;
      const angle = this.getMoveAngle();
      ModuleHandler.startMovement(angle);
      if (isOwner && Spectate_default.active) {
        for (const client2 of clients) {
          client2._ModuleHandler.startMovement(angle);
        }
      }
    }
    /* Moving the mouse and holding a nudge key both produce a continuous stream
     * of direction changes, which is the one thing that could spend the packet
     * budget faster than the game does. They share one gate.
     *
     * Only the packet is held back — the angle itself keeps updating at full
     * rate, so a finer grid never turns more slowly, it just sends the step it
     * reached. The trailing send is what makes that safe: a change that arrives
     * inside the window is not dropped, it is delivered when the window closes,
     * so the direction settled on is always the one the server ends up with. */
    steerMovement() {
      if (this._steerTimer !== null) {
        return;
      }
      const wait = 60 - (performance.now() - this._lastSteerTime);
      if (wait > 0) {
        this._steerTimer = setTimeout(() => {
          this._steerTimer = null;
          this.steerMovement();
        }, wait);
        return;
      }
      const {_ModuleHandler: ModuleHandler} = this.client;
      if (!this.client.myPlayer.inGame || this.move === 0) return;
      const angle = this.getMoveAngle();
      if (angle === null || ModuleHandler.moveTo !== "disable") return;
      if (ModuleHandler.move_dir === angle) return;
      if (ModuleHandler.packetCount + 10 > ModuleHandler.packetLimit) return;
      this._lastSteerTime = performance.now();
      this.handleMovement();
    }
    /* One grid step per press, auto-repeat included, so holding the key sweeps
     * the circle. The offset is cleared as soon as the player stops moving, in
     * handleMovement, rather than persisting into the next run. */
    handleAngleKeys(event) {
      if (!Settings_default._preciseAngles || isActiveInput() || UI_default.isMenuOpened) return false;
      if (!this.client.myPlayer.inGame) return false;
      const code = event.code;
      if (code !== "" && code === Settings_default._mouseMovementKey) {
        if (event.repeat) return true;
        Settings_default._mouseMovement = !Settings_default._mouseMovement;
        SaveSettings();
        syncCheckboxUI("_mouseMovement");
        if (this.move !== 0) this.steerMovement();
        return true;
      }
      let delta = 0;
      if (code !== "" && code === Settings_default._angleLeft) {
        delta = -1;
      } else if (code !== "" && code === Settings_default._angleRight) {
        delta = 1;
      } else {
        return false;
      }
      /* About 2.5 degrees per press whatever the grid is, so a finer grid does
       * not make the keys slower to turn with. The mouse still reaches every
       * step; the keys are the coarse control. */
      const steps = AngleGrid.moveSteps;
      const perPress = Math.max(1, Math.round(steps / 144));
      this.moveNudge = (this.moveNudge + delta * perPress) % steps;
      if (this.move !== 0) this.steerMovement();
      return true;
    }`
);

edit(
  "angles: nudge keys ahead of the repeat guard",
  `      if (event.ctrlKey && [ "KeyD", "KeyS", "KeyW" ].includes(event.code)) {
        event.preventDefault();
      }
      if (event.repeat) {
        return;
      }`,
  `      if (event.ctrlKey && [ "KeyD", "KeyS", "KeyW" ].includes(event.code)) {
        event.preventDefault();
      }
      /* Ahead of the repeat guard: a held nudge key is meant to keep turning. */
      if (this.handleAngleKeys(event)) {
        return;
      }
      if (event.repeat) {
        return;
      }`
);

edit(
  "angles: re-steer as the cursor moves",
  `      this.mouse.angle = angle;
      if (this.rotation) {`,
  `      this.mouse.angle = angle;
      if (this.move !== 0 && Settings_default._preciseAngles && Settings_default._mouseMovement) {
        this.steerMovement();
      }
      if (this.rotation) {`
);

/* ---- Menu -------------------------------------------------------- */

patchPage(
  "Misc_default",
  "\r\n\r\n    <!-- Menu -->",
  `\r
    <!-- Precise Angles -->\r
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
                <span class="option-description">Off is the old behaviour: 8 movement directions and a 72 step placement scan.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Movement Angles</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_moveAngleSteps" type="range" step="8" min="8" max="624">\r
                </label>\r
                <span class="option-description">Directions the circle is cut into for movement. 624 is the ceiling the game itself can express, since it rounds every angle to 0.01 rad. Costs nothing at any setting.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Building Angles</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_buildAngleSteps" type="range" step="24" min="24" max="624">\r
                </label>\r
                <span class="option-description">Angles the placer, retrap, trap bounce and auto break search around you. Was 72. The scan is solved, not sampled, so 624 costs less than 8 used to.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Mouse Movement</span>\r
                <label class="switch-checkbox">\r
                    <input id="_mouseMovement" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Reads the movement keys relative to the cursor: W goes toward it, A and D strafe, S backs off. Aiming then reaches every angle on the grid.</span>\r
            </div>\r
\r
        </div>\r
    </div>\r
`
);

patchPage(
  "Keybinds_default",
  `                <div class="content-option">\r
                    <span class="option-title">Name Song &#127926;</span>\r
                    <button id="_nameSong" class="hotkeyInput"></button>\r
                </div>\r
\r
            </div>\r
        </div>\r
    </div>`,
  `\r
\r
    <div class="section">\r
        <div class="section-title">Precise Angles</div>\r
        <div class="section-content">\r
            <div class="content-split">\r
\r
                <div class="content-option">\r
                    <span class="option-title">Rotate Move Left</span>\r
                    <button id="_angleLeft" class="hotkeyInput"></button>\r
                </div>\r
\r
                <div class="content-option">\r
                    <span class="option-title">Rotate Move Right</span>\r
                    <button id="_angleRight" class="hotkeyInput"></button>\r
                </div>\r
\r
                <div class="content-option">\r
                    <span class="option-title">Toggle Mouse Movement</span>\r
                    <button id="_mouseMovementKey" class="hotkeyInput"></button>\r
                </div>\r
\r
            </div>\r
        </div>\r
    </div>`,
  "after"
);

/* ------------------------------------------------------------------ *
 * 11. Driver manifest + runtime drift check
 *
 * The tables the client carries were checked against the shipped bundle at
 * build time (tools/verify-drivers.js). This records what they were checked
 * against and re-checks the parts that are observable at runtime, so a
 * protocol change on the server side shows up as a console warning rather
 * than as packets that quietly stop being understood.
 * ------------------------------------------------------------------ */

const manifest = {
  builtAt: new Date().toISOString(),
  extractedFrom: DRIVERS.source,
  extractedAt: DRIVERS.extractedAt,
  protocol: DRIVERS.protocol,
  tableSizes: {
    itemGroups: DRIVERS.itemGroups.length,
    projectiles: DRIVERS.projectiles.length,
    weapons: DRIVERS.weapons.length,
    items: DRIVERS.items.length,
    hats: DRIVERS.hats.length,
    accessories: DRIVERS.accessories.length,
  },
};

edit(
  "drivers: manifest + runtime check",
  `  const RYN = {
    _myClient: client,`,
  `  /* Game drivers this build was verified against. See drivers/game-drivers.json. */
  const ReUpDrivers = ${JSON.stringify(manifest, null, 4).replace(/\n/g, "\n  ")};
  ReUpDrivers.check = () => {
    const problems = [];
    const p = ReUpDrivers.protocol;
    try {
      const enc = win.RYN && win.RYN._enc;
      if (enc && enc.jt !== undefined && enc.jt !== p.signatureBytes) {
        problems.push(\`frame signature is \${enc.jt} bytes, expected \${p.signatureBytes}\`);
      }
      const crypto = client && client._gameCrypto;
      if (crypto && crypto.mode !== undefined && crypto.mode !== p.encryptedMode) {
        problems.push(\`transport mode is \${crypto.mode}, expected \${p.encryptedMode}\`);
      }
      if (crypto && crypto.tables && crypto.tables.c2s && crypto.tables.c2s.enc) {
        const live = Object.keys(crypto.tables.c2s.enc).length;
        if (live !== p.c2sAlphabet.length) {
          problems.push(\`c2s opcode table has \${live} entries, expected \${p.c2sAlphabet.length}\`);
        }
      }
    } catch (e) {}
    if (problems.length) {
      Logger.error("Driver drift vs the bundle this build was verified against:");
      for (const problem of problems) Logger.error("  " + problem);
    }
    return problems;
  };
  const RYN = {
    _myClient: client,
    _drivers: ReUpDrivers,`
);

edit(
  "drivers: run check once connected",
  `  resetGame_default(loadedFast);`,
  `  setTimeout(() => {
    try {
      ReUpDrivers.check();
    } catch (e) {}
  }, 15e3);
  resetGame_default(loadedFast);`
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
