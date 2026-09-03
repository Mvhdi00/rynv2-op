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
 * 10. Single-target aim lock
 *
 * RYN ships two copies of the preplace / replace engine — AutoPlacer and
 * AutoRetrap — and each one opened its tick with its own
 * `EnemyManager.nearestEnemy` read. Two independent selectors on the same
 * frame, no memory between ticks: with two enemies at roughly equal range the
 * pick could differ between the two modules, and it could flip back and forth
 * every tick, throwing away the candidate set that had just been derived for
 * the other one.
 *
 * TargetLock is the single selector both of them now go through. It picks the
 * closest valid enemy inside the placer radius, holds it through a switch
 * margin, and caches the position / velocity / prediction / validity once per
 * tick. Everything downstream — preplace, replace, the gap-fill layer below,
 * and the on-screen ring — reads that one ActiveTarget.
 * ------------------------------------------------------------------ */

edit(
  "settings: target lock keys",
  `    _autoplacerRadius: 350,`,
  `    _autoplacerRadius: 350,
    _targetLock: true,
    _targetSwitchMargin: 60,
    _aimCircle: true,
    _aimCircleColor: "#8b5cf6",
    _trapGapFill: true,`
);

/* The aim circle is a marker, not an action, so it sits with the other
 * cosmetic toggles Legit Mode leaves alone. `_targetLock` and `_trapGapFill`
 * are placement behaviour and stay inside it. */
edit(
  "settings: keep the aim circle out of Legit Mode",
  `"_spikeRotation", "_millRotation", "_usernameCycler" ]);`,
  `"_spikeRotation", "_millRotation", "_usernameCycler", "_aimCircle" ]);`
);

edit(
  "module: TargetLock",
  `  class AutoPlacer {`,
  `  /* One game tick, in ms. The placer's own preplace timers are written
   * against the same number. */
  const TARGET_LOCK_TICK_MS = 111;
  class TargetLock {
    moduleName="targetLock";
    client;
    target=null;
    targetId=null;
    /* Bumped on every acquire and every release. Anything the placer derived
     * from an older generation is stale by definition, which is how the
     * preplace / replace candidates get invalidated on a switch. */
    generation=0;
    valid=false;
    distance=Infinity;
    pos=new Vector_default;
    predicted=new Vector_default;
    velocity=new Vector_default;
    moveDir=0;
    speed=0;
    lockedTick=-1;
    lockedAt=0;
    lastSwitchTick=-1;
    _spin=0;
    _tick=-1;
    constructor(client2) {
      this.client = client2;
    }
    get enabled() {
      return !!Settings_default._targetLock;
    }
    /* The configured targeting / placement range is the placer radius — the
     * same number every placement decision is already gated on. */
    get range() {
      return Settings_default._autoplacerRadius ?? 350;
    }
    /* Held a little past the acquire range so a target sitting on the edge
     * does not drop and re-acquire on alternating ticks. */
    get holdRange() {
      return this.range + 60;
    }
    get switchMargin() {
      return Settings_default._targetSwitchMargin ?? 60;
    }
    reset() {
      this._release();
      this._tick = -1;
    }
    /* Validity is the client's existing definition, not a new one: the entry
     * has to be in PlayerManager.enemies for this tick — which is what makes
     * it alive, visible, not a teammate and not one of our own bots — still
     * an enemy by clan, and carrying a position. */
    isValidTarget(enemy) {
      if (!enemy || !enemy.pos || !enemy.pos.current) return false;
      const {PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      if (!myPlayer || !myPlayer.inGame) return false;
      if (enemy === myPlayer) return false;
      if (enemy.currentHealth !== undefined && enemy.currentHealth <= 0) return false;
      if (PlayerManager2.enemies.indexOf(enemy) === -1) return false;
      try {
        if (!myPlayer.isEnemyByID(enemy.id)) return false;
      } catch (e) {
        return false;
      }
      return true;
    }
    activeTarget() {
      return this.valid ? this.target : null;
    }
    /* The prediction is only handed out for the locked target, so no caller
     * can end up aiming one enemy's predicted position at another. */
    predictedFor(enemy) {
      return this.valid && enemy === this.target ? this.predicted : null;
    }
    isStale(generation) {
      return generation !== this.generation;
    }
    _release() {
      if (this.target !== null) this.generation++;
      this.target = null;
      this.targetId = null;
      this.valid = false;
      this.distance = Infinity;
    }
    _lock(enemy, tick) {
      if (enemy === this.target) return;
      this.target = enemy;
      this.targetId = enemy.id;
      this.generation++;
      this.lockedTick = tick;
      this.lockedAt = Date.now();
      this.lastSwitchTick = tick;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, PlayerManager: PlayerManager2} = this.client;
      const tick = ModuleHandler.tickCount;
      /* Once per game tick. The renderer reads the cached fields at 60 fps and
       * never triggers a scan. */
      if (this._tick === tick) return;
      this._tick = tick;
      if (!this.enabled || !myPlayer || !myPlayer.inGame) {
        this._release();
        return;
      }
      const myPos = myPlayer.pos.current;
      let current = this.target;
      /* Cheapest path first: the locked target almost always survives, and
       * checking it costs one array lookup and one distance. */
      if (current !== null && !this.isValidTarget(current)) {
        this._release();
        current = null;
      }
      let currentDist = Infinity;
      if (current !== null) {
        currentDist = myPos.distance(current.pos.current);
        if (currentDist > this.holdRange) {
          this._release();
          current = null;
          currentDist = Infinity;
        }
      }
      /* A scan can only change the answer when nothing is locked or when
       * somebody else could be closer, so a single visible enemy never costs
       * one. Distances stay squared until a candidate actually wins. */
      if (current === null || PlayerManager2.enemies.length > 1) {
        const enemies = PlayerManager2.enemies;
        const range2 = this.range * this.range;
        let best = null;
        let bestDist2 = Infinity;
        for (let i = 0; i < enemies.length; i++) {
          const enemy = enemies[i];
          if (enemy === current) continue;
          const dist2 = myPos.distanceDefault(enemy.pos.current);
          if (dist2 > range2 || dist2 >= bestDist2) continue;
          if (!this.isValidTarget(enemy)) continue;
          bestDist2 = dist2;
          best = enemy;
        }
        if (best !== null) {
          if (current === null) {
            /* Nothing held: take it immediately. */
            this._lock(best, tick);
          } else if (tick - this.lastSwitchTick >= 2 && Math.sqrt(bestDist2) + this.switchMargin < currentDist) {
            /* Hysteresis: meaningfully closer, and not on the tick right
             * after the last switch. A → B → A cannot happen inside the
             * margin. */
            this._lock(best, tick);
          }
        }
      }
      this._refresh(myPos);
    }
    _refresh(myPos) {
      const target = this.target;
      if (target === null) {
        this.valid = false;
        this.distance = Infinity;
        return;
      }
      const current = target.pos.current;
      const future = target.pos.future ?? current;
      this.pos._setXY(current.x, current.y);
      this.moveDir = target.move_dir ?? 0;
      this.speed = target.speed ?? 0;
      this.velocity._setXY(future.x - current.x, future.y - current.y);
      /* pos.future is exactly one tick of travel. The ping lead stretches it
       * by the trip the placement packet still has to make, capped at two
       * ticks so a spike in latency cannot fling the aim point off the map. */
      const socket = this.client.SocketManager;
      const ping = socket && Number.isFinite(socket.pong) ? socket.pong : 0;
      const lead = 1 + Math.max(0, Math.min(2, ping / TARGET_LOCK_TICK_MS));
      this.predicted._setXY(current.x + this.velocity.x * lead, current.y + this.velocity.y * lead);
      this.distance = myPos.distance(current);
      this.valid = true;
    }
  }
  const TargetLock_default = TargetLock;
  class AutoPlacer {`
);

edit(
  "modules: register targetLock",
  `      this.staticModules = {
        tempData: new TempData_default(client2),`,
  `      this.staticModules = {
        targetLock: new TargetLock_default(client2),
        tempData: new TempData_default(client2),`
);

/* First in the list: every other module, the two placers included, reads the
 * ActiveTarget this leaves behind. */
edit(
  "modules: run targetLock first",
  `      this.modules = [ this.staticModules.autoAccept,`,
  `      this.modules = [ this.staticModules.targetLock, this.staticModules.autoAccept,`
);

/* ------------------------------------------------------------------ *
 * 11. Both placers read the one ActiveTarget
 *
 * AutoPlacer is the preplace / replace engine; AutoRetrap is the second copy
 * of it behind `_autoRetrap`. Both had their own `nearestEnemy` read. Both now
 * take the locked target, its ping-adjusted predicted position, and drop
 * whatever they had derived for a previous target the moment the lock moves.
 * ------------------------------------------------------------------ */

const RETARGET = (indent, tail) => `${indent}const _lock = ModuleHandler.staticModules.targetLock;
${indent}const enemy = _lock.enabled ? _lock.activeTarget() : EnemyManager2.nearestEnemy;
${indent}if (!enemy) {
${indent}  this._lockGeneration = _lock.generation;
${indent}  return;
${indent}}
${indent}/* Target moved: every candidate, ban and reservation below was scored
${indent} * against the old one, so none of it survives. The forced full angle
${indent} * rescan on the next tick is the placer's own _focusUntilTick path. */
${indent}if (this._lockGeneration !== _lock.generation) {
${indent}  this._lockGeneration = _lock.generation;
${indent}  this._predictObjects.length = 0;
${indent}  this._placedAngles.length = 0;
${indent}  this._bannedAngles.clear();
${indent}  this._lastPrePlaceObj = null;
${indent}  this._gapFill = null;
${indent}  this.client._focusUntilTick = ModuleHandler.tickCount + 1;
${indent}}
${tail}`;

edit(
  "autoplacer: preplace/replace follow the locked target",
  `      const enemy = EnemyManager2.nearestEnemy;
      if (!enemy) return;
      const myPos = myPlayer.pos.current;
      const myFut = myPlayer.pos.future;
      const enemyPos = enemy.pos.current;
      const enemyFut = enemy.pos.future;
      const enemyScale = enemy.collisionScale;
      const trapId = myPlayer.getItemByType(7);`,
  RETARGET(
    "      ",
    `      const myPos = myPlayer.pos.current;
      const myFut = myPlayer.pos.future;
      const enemyPos = enemy.pos.current;
      /* Where the target is going, not where it was: one tick of travel plus
       * the ping lead. The ring on screen still shows the current position. */
      const enemyFut = _lock.predictedFor(enemy) ?? enemy.pos.future;
      const enemyScale = enemy.collisionScale;
      const trapId = myPlayer.getItemByType(7);`
  )
);

edit(
  "autoretrap: preplace/replace follow the same locked target",
  `      const myPos = myPlayer.pos.current;
      const myFut = myPlayer.pos.future;
      const enemy = EnemyManager2.nearestEnemy;
      if (!enemy) return;
      const enemyPos = enemy.pos.current;
      const enemyFut = enemy.pos.future;
      const enemyScale = enemy.collisionScale;
      const spikesOur = [];`,
  `      const myPos = myPlayer.pos.current;
      const myFut = myPlayer.pos.future;
` +
    RETARGET(
      "      ",
      `      const enemyPos = enemy.pos.current;
      const enemyFut = _lock.predictedFor(enemy) ?? enemy.pos.future;
      const enemyScale = enemy.collisionScale;
      const spikesOur = [];`
    )
);

/* AutoRetrap keeps its own copies of these three, but not _predictObjects
 * under that name and not a gap-fill cache, so the shared invalidation block
 * needs the fields to exist on it too. */
edit(
  "autoretrap: fields the shared invalidation touches",
  `  class AutoRetrap {`,
  `  class AutoRetrap {
    _lockGeneration=-1;
    _gapFill=null;`
);

edit(
  "autoplacer: lock generation field",
  `  class AutoPlacer {
    moduleName="autoPlacer";`,
  `  class AutoPlacer {
    moduleName="autoPlacer";
    _lockGeneration=-1;
    _gapFill=null;
    _gapBreak=null;`
);

/* ------------------------------------------------------------------ *
 * 12. Trap enclosure + smart spike gap fill
 *
 * A tactical layer on top of the placer, not a new placer. When the locked
 * target is boxed in by traps and obstacles it works out which openings are
 * left, which one the target is running for, and fills that one with a single
 * spike — chosen out of the candidate angles the placer already computed this
 * tick, executed through the placer's existing preplace path, and dropped the
 * moment the target is loose again.
 *
 * It never touches Spike Tick: it stands down while Spike Tick is the active
 * module and rejects any angle Spike Tick has reserved this tick.
 * ------------------------------------------------------------------ */

edit(
  "autoplacer: gap-fill layer",
  `    // GLOTUS MODE`,
  `    /* Local geometry around the target. Blocking is the game's own rule from
     * checkCollision: an ignoreCollision object does not push a player, with
     * the one exception of a trap, which locks the movement of anyone who is
     * not its owner and not on the owner's team. Search radius 2 on a 100-unit
     * grid — a 500x500 window around the target, never the map. */
    _gapBlockers(target, targetPos, ObjectManager2, PlayerManager2, myPlayer) {
      const blockers = [];
      const reach = target.collisionScale + 130;
      ObjectManager2.grid2D.query(targetPos.x, targetPos.y, 2, id => {
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !obj.pos || !obj.pos.current) return;
        const isPlayerObject = obj instanceof PlayerObject;
        const isTrap = isPlayerObject && obj.type === 15;
        let mine = false;
        let holdsTarget = false;
        if (isPlayerObject) {
          try {
            mine = obj.ownerID === myPlayer.id;
            holdsTarget = isTrap && PlayerManager2.isEnemyByID(obj.ownerID, target);
          } catch (e) {
            mine = false;
            holdsTarget = false;
          }
        }
        if (obj.canMoveOnTop && obj.canMoveOnTop() && !holdsTarget) return;
        const scale = obj.collisionScale ?? obj.scale ?? 0;
        const dist = targetPos.distance(obj.pos.current);
        if (dist > reach + scale) return;
        blockers.push({
          x: obj.pos.current.x,
          y: obj.pos.current.y,
          escapeScale: scale,
          dist: dist,
          isTrap: isTrap,
          mine: mine,
          holdsTarget: holdsTarget,
          obj: isPlayerObject ? obj : null
        });
      });
      return blockers;
    }
    /* Which way the target leaves. Moving: its own direction. Standing still
     * in a box: away from me, which is where it will break for. */
    _gapEscapeDir(lock, enemy, enemyPos, myPos) {
      if (lock.valid && enemy === lock.target && lock.speed > 0.6) return lock.moveDir;
      if ((enemy.speed ?? 0) > 0.6) return enemy.move_dir ?? 0;
      return Math.atan2(enemyPos.y - myPos.y, enemyPos.x - myPos.x);
    }
    /* Angles already claimed this tick. placeAngles is the live reservation
     * list — Spike Tick fills it through attemptSpikePlacement and every
     * placement path pushes into it — and it is cleared at the top of each
     * ModuleHandler tick, so what is in it now is exactly what has been
     * committed this tick and nothing older. EnemyManager.nearestSpikePlacerAngle
     * deliberately is not consulted: it is recomputed for the nearest enemy
     * every tick whether or not Spike Tick fires, so treating it as a
     * reservation would blanket-ban the angles this layer exists to use. */
    _gapReserved(angle, ModuleHandler) {
      const claimed = ModuleHandler.placeAngles;
      if (claimed && claimed[1]) {
        for (const other of claimed[1]) {
          if (Math.abs(other - angle) < 0.05) return true;
        }
      }
      for (const pending of this._placedAngles) {
        if (Math.abs(pending - angle) < 0.05) return true;
      }
      for (const queued of this._predictObjects) {
        if (Math.abs(queued.angle - angle) < 0.05) return true;
      }
      return false;
    }
    /* Re-checked in the preplace timers, milliseconds before the packet goes
     * out: same target, same generation, still placeable against the live
     * grid, still within the item limit, Spike Tick still not mid-execution. */
    _gapFillStillValid(entry) {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, ObjectManager: ObjectManager2} = this.client;
      const lock = ModuleHandler.staticModules.targetLock;
      if (!lock || lock.isStale(entry.generation) || lock.activeTarget() === null) return false;
      if (!myPlayer || !myPlayer.inGame) return false;
      if (ModuleHandler.activeModule === "spikeTick") return false;
      if (this._isItemLimit(entry.id, myPlayer)) return false;
      return this._canPlace(entry.id, entry.angle, myPlayer.pos.current, ObjectManager2, null);
    }
    /* Scores one candidate against one opening. Sealing the route and standing
     * in it outweigh raw closeness, so a slightly farther spike that closes the
     * escape beats a closer one that does nothing. Returns null for a candidate
     * that is not in the opening at all. */
    _gapScorer(blockers, exits, enemyPos, enemyScale, spikeScale, predicted, myPos) {
      const nearWindow = enemyScale + spikeScale + 90;
      return (cfg, exit, cone) => {
        const gapDist = Math.hypot(cfg.x - enemyPos.x, cfg.y - enemyPos.y);
        if (gapDist > nearWindow) return null;
        const fromTarget = Math.atan2(cfg.y - enemyPos.y, cfg.x - enemyPos.x);
        const off = getAngleDist(fromTarget, exit.angle);
        if (off > cone) return null;
        /* Does it actually take an exit away? Re-run the same escape test with
         * the candidate standing in the gap. */
        const after = SiegeAnalysis.isEscapable(enemyPos.x, enemyPos.y, enemyScale, blockers.concat([ {
          x: cfg.x,
          y: cfg.y,
          escapeScale: spikeScale,
          dist: gapDist
        } ]));
        const sealed = Math.max(0, exits.length - after.exits.length) * 150;
        const closeness = Math.max(0, 120 - Math.max(0, gapDist - enemyScale - spikeScale));
        const routeAlign = (1 - off / cone) * 120;
        const touches = gapDist < enemyScale + spikeScale + 12 ? 70 : 0;
        const onPredicted = Math.max(0, 90 - Math.hypot(cfg.x - predicted.x, cfg.y - predicted.y) / 2);
        const reach = Math.hypot(cfg.x - myPos.x, cfg.y - myPos.y) / 20;
        return sealed + routeAlign + closeness + touches + onPredicted - reach;
      };
    }
    /* Which of my own traps is standing between the placer and the opening,
     * and what to build once it is gone.
     *
     * Two shapes of the same question. The box is sealed and one of my traps
     * is the wall a spike belongs in; or the box has an opening and one of my
     * traps sits on the spot inside it. Both reduce to: drop trap T, see what
     * opens, and score the angles that only T was blocking — which is what the
     * placer's own excludeObj argument on _canPlace is for.
     *
     * Reported, never acted on. Breaking it would mean choosing a weapon and
     * an attack angle, which is a second scheduler and an override of Spike
     * Tick's decisions. The prepared spike goes in by itself on the first tick
     * the angle frees up. */
    _gapBreakCandidate(ctx) {
      const {blockers: blockers, enemyPos: enemyPos, enemyScale: enemyScale, spikeId: spikeId, spikeScale: spikeScale, myPos: myPos, predicted: predicted, angles: angles, ObjectManager2: ObjectManager2, ModuleHandler: ModuleHandler} = ctx;
      let best = null;
      for (const blocker of blockers) {
        if (!blocker.isTrap || !blocker.mine || blocker.obj === null) continue;
        const without = blockers.filter(other => other !== blocker);
        const opened = SiegeAnalysis.isEscapable(enemyPos.x, enemyPos.y, enemyScale, without).exits;
        if (opened.length === 0) continue;
        const score = this._gapScorer(without, opened, enemyPos, enemyScale, spikeScale, predicted, myPos);
        for (const cfg of angles) {
          if (!cfg || cfg.id !== spikeId) continue;
          /* Only angles that are blocked right now, and only by this trap. */
          if (cfg.placeable) continue;
          if (this._bannedAngles.has(cfg.angle)) continue;
          if (this._gapReserved(cfg.angle, ModuleHandler)) continue;
          if (!this._canPlace(spikeId, cfg.angle, myPos, ObjectManager2, blocker.obj)) continue;
          for (const exit of opened) {
            const value = score(cfg, exit, 0.85);
            if (value === null) continue;
            if (best === null || value > best.score) {
              best = {
                trap: blocker.obj,
                angle: cfg.angle,
                x: cfg.x,
                y: cfg.y,
                score: value
              };
            }
          }
        }
      }
      return best;
    }
    _gapStandDown() {
      this._gapFill = null;
      this._gapBreak = null;
      this.client._gapFillBreak = null;
      return false;
    }
    /* The whole layer. Returns true when it queued a spike. */
    _gapFillPlace(ctx) {
      const {enemy: enemy, enemyPos: enemyPos, enemyScale: enemyScale, myPos: myPos, myPlayer: myPlayer, spikeId: spikeId, lock: lock, ObjectManager2: ObjectManager2, PlayerManager2: PlayerManager2, ModuleHandler: ModuleHandler} = ctx;
      if (!Settings_default._trapGapFill || spikeId === null || spikeId === undefined) return this._gapStandDown();
      if (this._isItemLimit(spikeId, myPlayer)) return this._gapStandDown();
      /* Never on top of a Spike Tick execution, and not on the tick before one
       * either: useBreakTrapPlace / useBreakTrapFollowup mean Spike Tick has
       * already committed to calling attemptSpikePlacement on the next tick. */
      if (ModuleHandler.activeModule === "spikeTick") return false;
      const spikeTick = ModuleHandler.staticModules.spikeTick;
      if (spikeTick && (spikeTick.useBreakTrapPlace || spikeTick.useBreakTrapFollowup)) return false;
      if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) return false;
      if (myPos.distance(enemyPos) > (Settings_default._autoplacerRadius ?? 350)) return this._gapStandDown();
      const blockers = this._gapBlockers(enemy, enemyPos, ObjectManager2, PlayerManager2, myPlayer);
      /* Two objects near an enemy is not an enclosure — a trap that happens to
       * sit beside them is not a box. isEscapable says the same thing and
       * returns early below three. */
      const held = blockers.some(b => b.holdsTarget && b.dist <= enemyScale + b.escapeScale);
      if (blockers.length < 3) return this._gapStandDown();
      const siege = SiegeAnalysis.isEscapable(enemyPos.x, enemyPos.y, enemyScale, blockers);
      const exits = siege.exits;
      const spikeScale = Items[spikeId].scale;
      const predicted = lock.predictedFor(enemy) ?? enemy.pos.future ?? enemyPos;
      /* The placer already computed and cached these this tick — asking again
       * is a map lookup, not a rescan. */
      const angles = this._getPrePlaceAngles(spikeId, myPos, myPlayer, ObjectManager2, null);
      const breakCtx = {
        blockers: blockers,
        enemyPos: enemyPos,
        enemyScale: enemyScale,
        spikeId: spikeId,
        spikeScale: spikeScale,
        myPos: myPos,
        predicted: predicted,
        angles: angles,
        ObjectManager2: ObjectManager2,
        ModuleHandler: ModuleHandler
      };
      /* Sealed shut. Nothing to fill, but this is the case where one of my own
       * traps is the wall a spike belongs in, so run that analysis and place
       * nothing. */
      if (exits.length === 0) {
        this._gapFill = null;
        this._gapBreak = this._gapBreakCandidate(breakCtx);
        this.client._gapFillBreak = this._gapBreak;
        return false;
      }
      /* Too many ways out is a target standing in clutter, not an enclosure.
       * One physically held in my trap is not going anywhere, so a leakier box
       * around it is still worth sealing. */
      if (exits.length > (held ? 4 : 3)) return this._gapStandDown();
      const escapeDir = this._gapEscapeDir(lock, enemy, enemyPos, myPos);
      let escapeExit = exits[0];
      let escapeScore = Infinity;
      for (const exit of exits) {
        const diff = getAngleDist(exit.angle, escapeDir);
        if (diff < escapeScore) {
          escapeScore = diff;
          escapeExit = exit;
        }
      }
      const score = this._gapScorer(blockers, exits, enemyPos, enemyScale, spikeScale, predicted, myPos);
      /* The gap the target is running for first, with a tight cone. Only when
       * that yields nothing: the other openings, then the same gap with a
       * wider cone. Every pass stays anchored to an opening — there is no
       * fallback that would let a spike land anywhere around the target. */
      const passes = [ [ escapeExit, 0.85 ] ];
      for (const exit of exits) {
        if (exit !== escapeExit) passes.push([ exit, 0.85 ]);
      }
      passes.push([ escapeExit, 1.6 ]);
      let best = null;
      for (const [exit, cone] of passes) {
        for (const cfg of angles) {
          if (!cfg || cfg.id !== spikeId || !cfg.placeable) continue;
          if (this._bannedAngles.has(cfg.angle)) continue;
          if (this._gapReserved(cfg.angle, ModuleHandler)) continue;
          const value = score(cfg, exit, cone);
          if (value === null) continue;
          if (best === null || value > best.score) {
            best = {
              id: spikeId,
              angle: cfg.angle,
              x: cfg.x,
              y: cfg.y,
              score: value
            };
          }
        }
        if (best !== null) break;
      }
      const blocked = this._gapBreakCandidate(breakCtx);
      this._gapBreak = blocked !== null && (best === null || blocked.score > best.score + 60) ? blocked : null;
      this.client._gapFillBreak = this._gapBreak;
      if (best === null) {
        this._gapFill = null;
        return false;
      }
      /* Replace, not churn: an opening already chosen for this target is kept
       * unless the new one is meaningfully better. */
      const chosen = this._gapFill;
      if (chosen !== null && chosen.generation === lock.generation && !this._bannedAngles.has(chosen.angle) && this._canPlace(spikeId, chosen.angle, myPos, ObjectManager2, null) && best.score <= chosen.score + 45) {
        best = chosen;
      }
      best.generation = lock.generation;
      /* _addPredictObject drops anything overlapping a placement already
       * queued this tick, which is the anti-duplicate gate. */
      const before = this._predictObjects.length;
      this._addPredictObject(best.id, best.angle, true, myPos);
      if (this._predictObjects.length === before) return false;
      const queued = this._predictObjects[before];
      queued.gapFill = true;
      queued.validate = () => this._gapFillStillValid(best);
      this._gapFill = best;
      return true;
    }
    // GLOTUS MODE`
);

edit(
  "autoplacer: run the gap-fill layer",
  `      const autoObjects = this._predictObjects.filter(o => !o.preplace);
      const preObjects = this._predictObjects.filter(o => o.preplace);
      for (const obj of autoObjects) {
        if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) break;`,
  `      this._gapFillPlace({
        enemy: enemy,
        enemyPos: enemyPos,
        enemyScale: enemyScale,
        myPos: myPos,
        myPlayer: myPlayer,
        spikeId: spikeId,
        lock: _lock,
        ObjectManager2: ObjectManager2,
        PlayerManager2: PlayerManager2,
        ModuleHandler: ModuleHandler
      });
      const autoObjects = this._predictObjects.filter(o => !o.preplace);
      const preObjects = this._predictObjects.filter(o => o.preplace);
      for (const obj of autoObjects) {
        if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) break;`
);

/* Last-moment validation, in both preplace send passes. Objects without a
 * validate() — everything the placer queued the way it always did — are
 * unaffected. */
edit(
  "autoplacer: validate gap-fill candidates before the first send",
  `            for (const obj of preObjects) {
              if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) break;
              const type = obj.id === trapId ? 7 : 4;
              ModuleHandler.place(type, obj.angle);
              ModuleHandler.placedOnce = true;`,
  `            for (const obj of preObjects) {
              if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) break;
              if (obj.validate && !obj.validate()) continue;
              const type = obj.id === trapId ? 7 : 4;
              ModuleHandler.place(type, obj.angle);
              ModuleHandler.placedOnce = true;`
);

edit(
  "autoplacer: validate gap-fill candidates before the spam send",
  `            for (const obj of preObjects) {
              if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) break;
              const type = obj.id === trapId ? 7 : 4;
              ModuleHandler.place(type, obj.angle);
              ModuleHandler.placeAngles[1].push(obj.angle);`,
  `            for (const obj of preObjects) {
              if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) break;
              if (obj.validate && !obj.validate()) continue;
              const type = obj.id === trapId ? 7 : 4;
              ModuleHandler.place(type, obj.angle);
              ModuleHandler.placeAngles[1].push(obj.angle);`
);

/* ------------------------------------------------------------------ *
 * 13. Aim circle
 *
 * Display only. It reads TargetLock and draws; it never selects anything, and
 * because it keys off the render entity's interpolated position it follows the
 * target at frame rate without any smoothing of its own.
 * ------------------------------------------------------------------ */

edit(
  "renderer: drawAimLock",
  `    drawDanger(ctx, entity) {}`,
  `    drawDanger(ctx, entity) {}
    /* One ring on the locked enemy, one faint ring for the targeting radius
     * around me. Exactly one target exists, so exactly one of these is ever
     * drawn. */
    drawAimLock(ctx, entity, player, isMyPlayer, ModuleHandler) {
      if (!Settings_default._aimCircle || isMyPlayer || !entity.isPlayer) return;
      const lock = ModuleHandler.staticModules.targetLock;
      if (!lock || !lock.valid || entity.sid !== lock.targetId) return;
      const color = Settings_default._aimCircleColor || "#8b5cf6";
      /* Eased in over ~200 ms so a switch reads as a move, not a pop. */
      const fade = Math.max(0, Math.min(1, (Date.now() - lock.lockedAt) / 200));
      const radius = entity.scale + 14;
      Renderer_default.circle(ctx, entity.x, entity.y, radius, color, .85 * fade, 2.5);
      Renderer_default.circle(ctx, player.x, player.y, lock.range, color, .12 * fade, 1.5);
      if (!Settings_default._lowQuality) lock._spin = (lock._spin + .012) % 6.28;
      const offset = RYN._offset;
      ctx.save();
      ctx.globalAlpha = .9 * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.translate(entity.x - offset.x, entity.y - offset.y);
      ctx.rotate(lock._spin);
      for (let i = 0; i < 4; i++) {
        const mid = i * (Math.PI / 2);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 7, mid - .17, mid + .17);
        ctx.stroke();
      }
      ctx.restore();
    }`
);

edit(
  "renderer: draw the aim lock on the active target",
  `      if (Settings_default._collisionHitbox) {
        Renderer_default.circle(ctx, entity.x, entity.y, entity.scale, "#c7fff2", .5, 1);
      }`,
  `      this.drawAimLock(ctx, entity, player, isMyPlayer, ModuleHandler);
      if (Settings_default._collisionHitbox) {
        Renderer_default.circle(ctx, entity.x, entity.y, entity.scale, "#c7fff2", .5, 1);
      }`
);

/* Menu entries, next to the placer options they belong to. */
patchPage(
  "Combat_default",
  `<div class="content-option">\r
                <span class="option-title">Autoplacer radius</span>`,
  `<div class="content-option">\r
                <label class="option-title" for="_targetLock">Single Target Lock</label>\r
                <label class="switch-checkbox">\r
                    <input id="_targetLock" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Pre Placer and Re Placer both work one enemy: the closest valid one inside the autoplacer radius. Off goes back to each module re-picking the nearest enemy every tick.</span>\r
            </div>\r
            <div class="content-option">\r
                <span class="option-title">Aim Circle</span>\r
                <div class="option-content">\r
                    <button class="reset-color" title="Reset Color"></button>\r
                    <input id="_aimCircleColor" type="color" title="Select Color">\r
                    <label class="switch-checkbox">\r
                        <input id="_aimCircle" type="checkbox"></input>\r
                        <span></span>\r
                    </label>\r
                </div>\r
                <span class="option-description">Ring on the locked enemy plus the targeting radius. Display only - it never picks the target.</span>\r
            </div>\r
            <div class="content-option">\r
                <span class="option-title">Target switch margin</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_targetSwitchMargin" type="range" step="5" min="0" max="200">\r
                </label>\r
                <span class="option-description">How much closer another enemy has to get before the lock moves to it. 0 switches on any tie.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_trapGapFill">Trap Gap Fill</label>\r
                <label class="switch-checkbox">\r
                    <input id="_trapGapFill" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">When the locked enemy is boxed in, fills the opening they are running for with one spike. Uses the placer's own candidates and stands down for Spike Tick.</span>\r
            </div>\r
            `
);

edit(
  "bridge: RYN._TargetLock",
  `    _config: {},`,
  `    /* Read-only view of the one ActiveTarget, for checking what the placer
     * is actually locked onto. */
    get _TargetLock() {
      return client._ModuleHandler.staticModules.targetLock;
    },
    _config: {},`
);

/* ------------------------------------------------------------------ *
 * 14. Driver manifest + runtime drift check
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
