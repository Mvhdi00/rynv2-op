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

/* Same, for the handful of methods the client carries in two copies (the
 * placer exists once on AutoPlacer and once on AutoRetrap). The count is
 * declared at the call site so an extra or missing copy still fails. */
function editAll(label, find, replace, expected) {
  const parts = code.split(find);
  if (parts.length - 1 !== expected) {
    throw new Error(`anchor hit ${parts.length - 1} times, expected ${expected}: ${label}`);
  }
  code = parts.join(replace);
  applied.push(`${label} (x${expected})`);
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

function patchPage(constName, anchorHtml, insertHtml) {
  const declaration = `const ${constName} = `;
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error(`page constant not found: ${constName}`);

  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");

  // eslint-disable-next-line no-eval
  const html = eval(literal);
  if (!html.includes(anchorHtml)) throw new Error(`page anchor not found in ${constName}`);

  const patched = html.replace(anchorHtml, insertHtml + anchorHtml);
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
 * 10. Angle engine
 *
 * Four places in the client decide on an angle, and each of them was
 * giving something away:
 *
 *   - The aim is `atan2(mouse - screen centre)`, which is only the
 *     direction of the cursor if the player is at the centre of the
 *     screen. The camera lerps toward the player rather than sitting on
 *     it, so while you move, the point under the cursor is not the point
 *     that angle describes. It was also only recomputed on mousemove and
 *     rounded to two decimals.
 *   - The facing was only resent once it was more than 0.3 rad (17
 *     degrees) away from what the server had, and the comparison was a
 *     plain subtraction, so it also fired every tick while aiming near
 *     the +/-pi wrap. RYN v5 fixes the wrap; the deadzone is ours.
 *   - The placer scores a 72 point ring and places on the grid angle it
 *     picked, up to 2.5 degrees off the angle it actually wanted.
 *   - Autobreak sweeps the same 72 point grid looking for the facing
 *     that hits the most objects, which can only find the multi-hit
 *     angles by luck.
 *
 * The shared math lives in ReUpAim; the rest of this section wires it in.
 * ------------------------------------------------------------------ */

edit(
  "angle: ReUpAim engine",
  `  const findMiddleAngle = (a, b) => {
    const x = Math.cos(a) + Math.cos(b);
    const y = Math.sin(a) + Math.sin(b);
    return Math.atan2(y, x);
  };`,
  `  const findMiddleAngle = (a, b) => {
    const x = Math.cos(a) + Math.cos(b);
    const y = Math.sin(a) + Math.sin(b);
    return Math.atan2(y, x);
  };
  const TAU = PI * 2;
  /* Signed shortest turn, so angle arithmetic survives the +/-pi wrap.
   * getAngleDist above is the unsigned version of the same thing. */
  const normalizeAngle = angle => {
    const wrapped = angle % TAU;
    return wrapped > PI ? wrapped - TAU : wrapped < -PI ? wrapped + TAU : wrapped;
  };
  const angleDelta = (from, to) => normalizeAngle(to - from);
  const ReUpAim = {
    mouseX: 0,
    mouseY: 0,
    known: false,
    setMouse(x, y) {
      this.mouseX = x;
      this.mouseY = y;
      this.known = true;
    },
    /* The cursor in world coordinates, rebuilt from the camera and zoom
     * the frame was actually drawn with: the renderer offset hook gives
     * the top-left corner of the view, so the camera is that plus half a
     * viewport, and a CSS pixel is 1/scale of a world unit.
     *
     * Null means the camera is not up yet (before the first frame, or
     * before the offset hook has run), which is the caller's cue to fall
     * back to the screen-centre angle. */
    worldMouse() {
      if (!this.known) return null;
      const smooth = ZoomHandler_default._scale._smooth;
      const viewW = Number(smooth._w);
      const viewH = Number(smooth._h);
      if (!(viewW > 0) || !(viewH > 0)) return null;
      const scale = Math.max(window.innerWidth / viewW, window.innerHeight / viewH);
      if (!(scale > 0)) return null;
      const offset = RYN._offset;
      if (!offset || offset.x === 0 && offset.y === 0) return null;
      const camX = offset.x + viewW / 2;
      const camY = offset.y + viewH / 2;
      return {
        x: camX + (this.mouseX - window.innerWidth / 2) / scale,
        y: camY + (this.mouseY - window.innerHeight / 2) / scale,
        camX: camX,
        camY: camY
      };
    },
    /* Angle from where the player actually is to the point under the
     * cursor - the angle the player means, rather than the one the
     * screen centre happens to describe. */
    cursorAngle(client) {
      const myPlayer = client && client.myPlayer;
      if (!myPlayer || !myPlayer.inGame) return null;
      const world = this.worldMouse();
      if (world === null) return null;
      const pos = myPlayer.pos.current;
      /* The camera trails the player by a few pixels. Much more than
       * that and it is following something else (spectate, ghost) or has
       * gone stale, and correcting against it would be worse than not. */
      if (Math.hypot(world.camX - pos.x, world.camY - pos.y) > 400) return null;
      const dx = world.x - pos.x;
      const dy = world.y - pos.y;
      if (dx * dx + dy * dy < 4) return null;
      return Math.atan2(dy, dx);
    },
    /* Where to point so the hit lands on a moving target: their position
     * advanced by the time our command needs to reach the server, plus
     * flight time when the weapon throws something. speed is the
     * distance they covered over the last server tick. */
    leadAngle(client, target) {
      const myPlayer = client.myPlayer;
      const from = myPlayer.pos.current;
      const to = target.pos.current;
      const tickMs = 1e3 / Config_default.serverUpdateRate;
      const ping = client.PacketManager && client.PacketManager.pong || 0;
      const speed = target.speed || 0;
      const vx = Math.cos(target.move_dir || 0) * speed;
      const vy = Math.sin(target.move_dir || 0) * speed;
      let ticks = (ping / 2 + tickMs) / tickMs;
      const weaponID = myPlayer.weapon && myPlayer.weapon.current;
      const weapon = weaponID != null ? DataHandler_default.getWeapon(weaponID) : null;
      const projectile = weapon && weapon.projectile != null ? Projectiles[weapon.projectile] : null;
      if (projectile && projectile.speed > 0) {
        for (let i = 0; i < 2; i++) {
          const flight = Math.hypot(to.x + vx * ticks - from.x, to.y + vy * ticks - from.y) / projectile.speed;
          ticks = (ping / 2 + tickMs + flight) / tickMs;
        }
      }
      ticks = clamp(ticks, 0, 4);
      return Math.atan2(to.y + vy * ticks - from.y, to.x + vx * ticks - from.x);
    },
    /* Nearest enemy, weighted toward the one the cursor is already
     * pointing at, so the lock sharpens the choice instead of taking it
     * away. Returns null when nobody is in range. */
    pickTarget(client) {
      const myPlayer = client && client.myPlayer;
      const playerManager = client && client.PlayerManager;
      if (!myPlayer || !myPlayer.inGame || !playerManager) return null;
      const from = myPlayer.pos.current;
      const range = Settings_default._targetLockRange ?? 400;
      const cursor = this.cursorAngle(client);
      let best = null;
      let bestScore = -Infinity;
      for (const enemy of playerManager.enemies) {
        if (!enemy || enemy === myPlayer) continue;
        const distance = from.distance(enemy.pos.current);
        if (distance > range) continue;
        let score = 1 - distance / range;
        if (cursor !== null) {
          score += 1.5 * (1 - getAngleDist(cursor, from.angle(enemy.pos.current)) / PI);
        }
        if (score > bestScore) {
          bestScore = score;
          best = enemy;
        }
      }
      return best;
    },
    /* The angle the owner should be facing this tick, or null to leave
     * the facing to whatever else decided it. */
    resolve(client) {
      if (Settings_default._targetLock) {
        const target = this.pickTarget(client);
        if (target !== null) return this.leadAngle(client, target);
      }
      if (Settings_default._smartAim) return this.cursorAngle(client);
      return null;
    },
    /* Every angle that can be optimal for "face the most objects at
     * once". A cone either covers an object or it does not, and it stops
     * covering it exactly on the edge of that object's window, so the
     * best facing always sits on one of those edges. Both sides of each
     * edge are offered, since covering an object and dodging one are
     * both worth points. */
    coverageCandidates(items, seed) {
      const out = [ seed ];
      const nudge = 1e-4;
      for (const item of items) {
        out.push(item.angle);
        out.push(item.angle + item.cone - nudge);
        out.push(item.angle - item.cone + nudge);
        out.push(item.angle + item.cone + nudge);
        out.push(item.angle - item.cone - nudge);
      }
      return out;
    }
  };`
);

/* Settings for the angle work. _targetLockRange is a number, so Legit
 * Mode leaves it alone; the three booleans below join the exclusion list
 * further down. */
edit(
  "angle: settings keys",
  `    _spikeRotation: true,`,
  `    _smartAim: true,
    _targetLock: false,
    _targetLockRange: 400,
    _placerRefine: true,
    _smartBreakAngle: true,
    _spikeRotation: true,`
);

/* Legit Mode silences automatic actions. Target lock is one and stays in
 * the sweep; the other three only change how an angle already being sent
 * is computed, and switching them off would quietly degrade the aim and
 * the placer after Legit Mode was turned back off. */
edit(
  "angle: keep aim precision out of Legit Mode",
  `"_spikeRotation", "_millRotation", "_usernameCycler" ]);`,
  `"_spikeRotation", "_millRotation", "_usernameCycler", "_smartAim", "_placerRefine", "_smartBreakAngle" ]);`
);

/* The cursor is now tracked whether or not the player is following it,
 * so locking rotation no longer freezes the position cursorPosition()
 * reads, and the angle keeps full precision instead of being rounded to
 * two decimals on the way in. */
edit(
  "angle: camera-corrected mouse aim",
  `    handleMouseMove(event) {
      const x = event.clientX;
      const y = event.clientY;
      const angle = parseFloat(getAngle(window.innerWidth / 2, window.innerHeight / 2, x, y).toFixed(2));
      this.mouse.angle = angle;
      if (this.rotation) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.client._ModuleHandler._currentAngle = angle;
      }
    }`,
  `    handleMouseMove(event) {
      const x = event.clientX;
      const y = event.clientY;
      this.mouse.x = x;
      this.mouse.y = y;
      if (this.client.isOwner) ReUpAim.setMouse(x, y);
      const angle = getAngle(window.innerWidth / 2, window.innerHeight / 2, x, y);
      this.mouse.angle = angle;
      if (this.rotation) {
        const corrected = this.client.isOwner && Settings_default._smartAim ? ReUpAim.cursorAngle(this.client) : null;
        this.client._ModuleHandler._currentAngle = corrected !== null ? corrected : angle;
      }
    }`
);

/* Same correction for the world position of the cursor, which follow
 * cursor and the bot positions are driven off. The old form assumed the
 * player was at the centre of the screen and read the target zoom rather
 * than the smoothed one the frame was drawn at. */
edit(
  "angle: camera-corrected cursor position",
  `      const {myPlayer: myPlayer} = this.client;
      const pos = myPlayer.pos.future;
      const {_w: w, _h: h} = ZoomHandler_default._scale.current;`,
  `      if (this.client.isOwner && Settings_default._smartAim) {
        const world = ReUpAim.worldMouse();
        if (world !== null) return new Vector_default(world.x, world.y);
      }
      const {myPlayer: myPlayer} = this.client;
      const pos = myPlayer.pos.future;
      const {_w: w, _h: h} = ZoomHandler_default._scale.current;`
);

/* Re-aim at the top of the tick. The cursor keeps pointing at the same
 * place on the screen while the player and the camera move under it, so
 * the angle it describes is only still true if it is recomputed - a
 * mousemove is not the only thing that changes it. Modules run after
 * this and can still take the facing for whatever they are doing. */
edit(
  "angle: re-aim every tick",
  `      const {isOwner: isOwner} = this.client;
      this.placeAngles[0] = null;`,
  `      const {isOwner: isOwner} = this.client;
      if (isOwner && this.client.InputHandler && this.client.InputHandler.rotation) {
        const aim = ReUpAim.resolve(this.client);
        if (aim !== null) this._currentAngle = aim;
      }
      this.placeAngles[0] = null;`
);

/* How far the server's idea of our facing may drift before it is
 * corrected. The stock 0.3 rad is 17 degrees of slack given away on
 * every hit and every placement; at 9 ticks a second the tighter figure
 * costs at most 9 packets a second out of a 70 packet budget, and it is
 * only paid while someone is close enough to hit. */
edit(
  "angle: adaptive resend threshold",
  `    updateAngle(angle, force = false) {`,
  `    reUpAngleThreshold() {
      if (!Settings_default._smartAim) return .3;
      if (this.packetCount + 12 > this.packetLimit) return .3;
      const enemyManager = this.client.EnemyManager;
      const enemy = enemyManager && enemyManager.nearestEnemy;
      return enemy ? .02 : .12;
    }
    updateAngle(angle, force = false) {`
);

/* The comparison itself was a plain subtraction, so aiming near the
 * +/-pi wrap read as 6 rad of drift and resent the angle every tick.
 * This is the RYN v5 fix, with the threshold now coming from above. */
edit(
  "angle: wrap-safe resend comparison",
  `      if (myPlayer && Math.abs(myPlayer.angle - sendDir) > .3) {`,
  `      if (myPlayer && getAngleDist(myPlayer.angle, sendDir) > mh.reUpAngleThreshold()) {`
);

/* The swing is sent later in the tick than the facing was chosen, so
 * when the lock is on, the lead is recomputed here against the target's
 * newest position rather than reusing the tick's opening aim. */
edit(
  "angle: target lock on the attack angle",
  `      if (MH._autoBreakActive && MH._lastBreakAngle != null) {
        return MH._lastBreakAngle;
      }
      return currentAngle;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;`,
  `      if (MH._autoBreakActive && MH._lastBreakAngle != null) {
        return MH._lastBreakAngle;
      }
      if (Settings_default._targetLock && this.client.isOwner) {
        const target = ReUpAim.pickTarget(this.client);
        if (target !== null) return ReUpAim.leadAngle(this.client, target);
      }
      return currentAngle;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;`
);

/* Placement angles come off a 72 point ring, so every one of them can be
 * up to 2.5 degrees away from the angle the placer meant - around 7px of
 * slack at spike radius, which is the width of the gap an enemy walks
 * out of. When the chosen angle sits next to a blocked one, bisect the
 * gap so the placement lands flush against whatever is blocking it. If
 * both neighbours are blocked it is a slot, and the middle of the free
 * arc is the only angle that fits.
 *
 * Both the placer and the retrapper carry their own copy of this method
 * set, so both get it. */
editAll(
  "angle: refine placement angles off the ring",
  `    _addPredictObject(id, angle, preplace, myPos) {
      const item = Items[id];`,
  `    _reupRefineAngle(id, angle, myPos) {
      if (!Settings_default._placerRefine) return angle;
      const ObjectManager2 = this.client.ObjectManager;
      const step = PI * 2 / 72;
      const canPlace = a => this._canPlace(id, a, myPos, ObjectManager2, null);
      if (!canPlace(angle)) return angle;
      const edge = direction => {
        if (canPlace(angle + direction * step)) return null;
        let open = angle;
        let blocked = angle + direction * step;
        for (let i = 0; i < 5; i++) {
          const mid = (open + blocked) / 2;
          if (canPlace(mid)) open = mid; else blocked = mid;
        }
        return open;
      };
      const clockwise = edge(1);
      const counter = edge(-1);
      if (clockwise !== null && counter !== null) return (clockwise + counter) / 2;
      if (clockwise !== null) return clockwise;
      if (counter !== null) return counter;
      return angle;
    }
    _addPredictObject(id, angle, preplace, myPos) {
      angle = this._reupRefineAngle(id, angle, myPos);
      const item = Items[id];`,
  2
);

/* Autobreak wants the facing that hits the most objects and sweeps 72
 * angles looking for it. A facing either covers an object or it does
 * not, and it stops covering it exactly on the edge of that object's
 * window, so the answer is always on one of those edges - a fixed sweep
 * only lands on one by luck. Testing the edges directly is exact, and
 * with a handful of objects in range it is also less work. */
edit(
  "angle: exact multi-hit angle for autobreak",
  `      let angle = angle1;
      let bestScore = scoreAngle(angle1);
      for (let i = 0; i < 72; i++) {
        const testA = i / 72 * Math.PI * 2;
        const s = scoreAngle(testA);
        if (s > bestScore) {
          bestScore = s;
          angle = testA;
        }
      }`,
  `      let angle = angle1;
      let bestScore = scoreAngle(angle1);
      const testAngles = [];
      if (Settings_default._smartBreakAngle) {
        const windows = [];
        const consider = obj => {
          if (!obj || !inRangeOf(obj)) return;
          windows.push({
            angle: pos1.angle(obj.pos.current),
            cone: obj === target ? gatherAngle / 2 : gatherAngle
          });
        };
        consider(target);
        consider(nearestEnemyForScore);
        for (const obj of hittable) consider(obj);
        for (const obj of nonHittable) consider(obj);
        testAngles.push(...ReUpAim.coverageCandidates(windows, angle1));
      } else {
        for (let i = 0; i < 72; i++) testAngles.push(i / 72 * Math.PI * 2);
      }
      for (const testA of testAngles) {
        const s = scoreAngle(testA);
        if (s > bestScore) {
          bestScore = s;
          angle = testA;
        }
      }`
);

/* The switches, at the top of Combat where the aim belongs. */
patchPage(
  "Combat_default",
  "\r\n\r\n    <!-- Instakills -->",
  `\r
\r
    <!-- Aim -->\r
    <div class="section">\r
        <div class="section-title">Aim<span class="sec-sub">Where the client says you are pointing.</span></div>\r
        <div class="section-content">\r
            <div class="content-option">\r
                <label class="option-title" for="_smartAim">Precision Aim</label>\r
                <label class="switch-checkbox">\r
                    <input id="_smartAim" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Aims from where you actually are to the point under the cursor, every tick, and corrects your facing as soon as it drifts instead of waiting for it to be 17 degrees out. The game aims from the centre of the screen, which is only where you are once the camera has caught up with you. Off restores the vanilla behaviour.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_targetLock">Target Lock</label>\r
                <label class="switch-checkbox">\r
                    <input id="_targetLock" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Points at the nearest enemy in range instead of at the cursor, led by how far they will move before the hit lands (plus arrow flight time on ranged weapons). Picks whichever enemy your cursor is closest to already, so you still choose the target. Very visible to everyone else.</span>\r
            </div>\r
            <div class="content-option">\r
                <span class="option-title">Target lock range</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_targetLockRange" type="range" step="25" min="100" max="800">\r
                </label>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_placerRefine">Flush Placement</label>\r
                <label class="switch-checkbox">\r
                    <input id="_placerRefine" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Placement angles are chosen on a 72 point ring, so they can sit up to 2.5 degrees - about 7px - away from the angle the placer meant. This slides each one onto the exact edge of whatever is blocking it, so walls close instead of leaving a seam.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_smartBreakAngle">Exact Break Angle</label>\r
                <label class="switch-checkbox">\r
                    <input id="_smartBreakAngle" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Autobreak looks for the facing that hits the most things at once by sweeping 72 angles. The best facing always sits exactly on the edge of some object's hit window, so this tests those edges instead - it finds the multi-hits the sweep walks past, and does less work doing it.</span>\r
            </div>\r
        </div>\r
    </div>`
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
