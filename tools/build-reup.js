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
    _botAiBudget: 8,
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
                <span class="option-title">Bot AI Budget</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_botAiBudget" type="range" step="1" min="0" max="20">\r
                </label>\r
                <span class="option-description">Milliseconds per tick the bots may spend on threat analysis. Past the budget a bot reuses its last read and takes its turn in a 3 tick rotation, so none ever waits long and the cost stays flat; a bot in a fight is never held back, and it still moves, attacks and takes orders either way. Lower it if many bots cost you frames, 0 turns the budget off.</span>\r
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

/* ================================================================== *
 * 10. Bot performance
 *
 * A bot is a whole client. It keeps its own copy of the world, runs the same
 * threat analysis and the same ~60 module pipeline as the owner, and does it
 * on the owner's thread, every server tick. Two bots is fine. Twenty is not:
 * one enemy walking into view multiplies several spatial-grid queries and a
 * full instakill projection by twenty-one, inside the same 111 ms tick, and
 * the render loop gets whatever is left over.
 *
 * The edits below attack that from three sides: bound work by range (a threat
 * that cannot reach us is not computed), bound work by wall clock (an AI tick
 * budget with fair round-robin so nothing starves), and stop paying for work
 * whose result is discarded (owner-only panels, idle overlay canvases).
 * ------------------------------------------------------------------ */

edit(
  "perf: threat analysis is bounded by range",
  `      for (let i = 0, len = enemies.length; i < len; i++) {
        const enemy = enemies[i];
        if (ownerID !== undefined && enemy.id === ownerID) continue;
        this.checkCollision(enemy);
        this.handleDanger(enemy);
        this.handleNearest(0, enemy);
      }`,
  `      /* checkCollision() runs a spatial-grid query per enemy and handleDanger()
       * runs canPossiblyInstakill() -> detectSpikeInsta(), which is another grid
       * query. Both are relative to myPlayer, and nothing either one can find
       * reaches us from beyond THREAT_SCAN_RANGE: the widest ring in
       * canPossiblyInstakill is the turret one (700 + 130) and the widest read
       * is the ranged-bow tell, which is a musket projectile away (1400). 1600
       * clears both with margin. Enemies past it still go through
       * handleNearest, so nearestEnemy and every module keyed off it are
       * unchanged; only the analysis nobody could act on is skipped. */
      const THREAT_SCAN_RANGE = 1600;
      const myPos = myPlayer.pos.current;
      for (let i = 0, len = enemies.length; i < len; i++) {
        const enemy = enemies[i];
        if (ownerID !== undefined && enemy.id === ownerID) continue;
        if (myPos.distance(enemy.pos.current) <= THREAT_SCAN_RANGE) {
          this.checkCollision(enemy);
          this.handleDanger(enemy);
        } else {
          /* checkCollision is also where per-enemy trap state is cleared each
           * tick. Keep that part so a far enemy cannot stay marked trapped. */
          enemy.isTrapped = false;
          enemy.trappedInPrev = enemy.trappedIn;
          enemy.trappedIn = null;
        }
        this.handleNearest(0, enemy);
      }`
);

edit(
  "perf: skip the spike placement search when it cannot reach",
  `        const spikeID = myPlayer.getItemByType(itemType);
        const placeLength = myPlayer.getItemPlaceScale(spikeID);
        const angles = ObjectManager.getBestPlacementAngles({
          position: pos1,
          id: spikeID,
          targetAngle: angleToEnemy,
          ignoreID: null,
          preplace: false,
          reduce: false,
          fill: false
        });
        const spikeScale = Items[spikeID].scale;
        const possibleAngles = angles.filter(angle => {
          const spikePos = pos1.addDirection(angle, placeLength);
          const distance = pos2.distance(spikePos);
          const range = nearest.collisionScale + spikeScale;
          return distance <= range;
        });
        if (possibleAngles.length !== 0) {
          this.nearestSpikePlacerAngle = possibleAngles;
        }`,
  `        const spikeID = myPlayer.getItemByType(itemType);
        const placeLength = myPlayer.getItemPlaceScale(spikeID);
        const spikeScale = Items[spikeID].scale;
        /* A spike goes down at placeLength from us, so the closest it can ever
         * land to the enemy is dist - placeLength. The filter below keeps an
         * angle only when that lands inside collisionScale + spikeScale, which
         * makes the whole search provably empty past this reach - and the
         * search is a grid query plus a sort, run by every client every tick
         * for any enemy merely in view. */
        if (pos1.distance(pos2) <= placeLength + nearest.collisionScale + spikeScale) {
          const angles = ObjectManager.getBestPlacementAngles({
            position: pos1,
            id: spikeID,
            targetAngle: angleToEnemy,
            ignoreID: null,
            preplace: false,
            reduce: false,
            fill: false
          });
          const possibleAngles = angles.filter(angle => {
            const spikePos = pos1.addDirection(angle, placeLength);
            const distance = pos2.distance(spikePos);
            const range = nearest.collisionScale + spikeScale;
            return distance <= range;
          });
          if (possibleAngles.length !== 0) {
            this.nearestSpikePlacerAngle = possibleAngles;
          }
        }`
);

edit(
  "perf: bot AI tick budget",
  `  class PlayerManager {
    playerData=new Map;`,
  `  /* Wall-clock budget for the bot threat-analysis stage.
   *
   * Bots are analysed freely until the budget for this tick is spent. Past
   * that, a bot only gets a full read on its own turn of a "period" tick
   * rotation - so no bot ever waits more than that many ticks, about 3 Hz at
   * the default, and the guaranteed reads are staggered by slot so they spread
   * across ticks instead of landing together as one spike. Missing a turn
   * skips the analysis only: the module pipeline still runs, the bot still
   * re-acquires its target, still moves, still attacks and still answers
   * commands. A bot with an enemy inside combatRange is never held back at
   * all, because that is where one stale tick is the difference between eating
   * an insta and blocking it. The owner is never held back.
   *
   * Set the budget to 0 to turn this off and have every bot analysed every
   * tick, the way it worked before. */
  const ReUpBotAI = {
    defaultBudgetMs: 8,
    combatRange: 350,
    period: 3,
    windowStart: 0,
    spent: 0,
    tick: 0,
    slots: new WeakMap,
    nextSlot: 0,
    get budgetMs() {
      const value = Settings_default._botAiBudget;
      return typeof value === "number" && value >= 0 ? value : this.defaultBudgetMs;
    },
    shouldAnalyse(client2, enemies) {
      if (client2.isOwner) return true;
      const budget = this.budgetMs;
      if (budget === 0) return true;
      const now = performance.now();
      if (now - this.windowStart >= 111) {
        this.windowStart = now;
        this.spent = 0;
        this.tick += 1;
      }
      if (this.spent < budget) return true;
      let slot = this.slots.get(client2);
      if (slot === undefined) {
        slot = this.nextSlot++;
        this.slots.set(client2, slot);
      }
      if ((this.tick + slot) % this.period === 0) return true;
      return this.inCombat(client2, enemies);
    },
    inCombat(client2, enemies) {
      const myPlayer = client2.myPlayer;
      if (!myPlayer || !myPlayer.inGame) return false;
      const pos = myPlayer.pos.current;
      for (let i = 0, len = enemies.length; i < len; i++) {
        if (pos.distance(enemies[i].pos.current) <= this.combatRange) return true;
      }
      return false;
    },
    charge(startedAt) {
      this.spent += performance.now() - startedAt;
    }
  };
  class PlayerManager {
    playerData=new Map;`
);

edit(
  "perf: run threat analysis through the budget",
  `      ProjectileManager.postTick();
      EnemyManager2.handleEnemies(this.enemies);`,
  `      ProjectileManager.postTick();
      if (ReUpBotAI.shouldAnalyse(this.client, this.enemies)) {
        const analysisStart = performance.now();
        EnemyManager2.handleEnemies(this.enemies);
        ReUpBotAI.charge(analysisStart);
      } else {
        EnemyManager2.handleNearestOnly(this.enemies);
      }`
);

edit(
  "perf: nearest tracking survives a deferred tick",
  `    handleEnemies(enemies) {
      this.reset();`,
  `    /* What a deferred tick still has to do. preReset() clears nearestEnemy at
     * the top of every tick and handleEnemies is what fills it back in, so
     * skipping the whole thing would blink a bot's target off and stop it
     * mid-swing. Re-acquire the target - that is cheap - and leave the threat
     * booleans on last tick's read, which is the whole point of deferring. */
    handleNearestOnly(enemies) {
      const ownerID = this.client.ownerClient?.myPlayer?.id;
      for (let i = 0, len = enemies.length; i < len; i++) {
        const enemy = enemies[i];
        if (ownerID !== undefined && enemy.id === ownerID) continue;
        this.handleNearest(0, enemy);
      }
    }
    handleEnemies(enemies) {
      this.reset();`
);

edit(
  "perf: the chat log is the owner's panel",
  `    add(kind, text, who) {
      if (!Settings_default._chatLog) return;`,
  `    add(kind, text, who) {
      if (!Settings_default._chatLog) return;
      /* Only the owner ever builds a panel (see postTick), but every bot client
       * decodes the same join/leave/chat packets and was filling a row buffer
       * nothing would ever render. In a twenty-bot lobby that is twenty-one
       * copies of every row, timestamped and escaped, for one visible list. */
      if (!this.client.isOwner) return;`
);

/* ------------------------------------------------------------------ *
 * Trap rebuild: per-client broken list, and only scan near a fight
 *
 * TrapRebuild kept the ids of destroyed objects on `window._rynBrokenSids` - a
 * single array shared by every client, which each of them appended to and each
 * of them cleared, so whose breakage a given client was reacting to came down
 * to tick order. It also mapped our own traps out of a 9x9 grid sweep every
 * tick, on every client, even though the rebuild it feeds needs an enemy
 * inside 300 to do anything at all.
 * ------------------------------------------------------------------ */

edit(
  "fix: broken-object ids are per client",
  `        if (window._rynBrokenSids) window._rynBrokenSids.push(temp[1]);`,
  `        (this.client._brokenSids || (this.client._brokenSids = [])).push(temp[1]);`
);

edit(
  "fix: trap rebuild reads its own client's broken ids",
  `      if (!window._rynBrokenSids) window._rynBrokenSids = [];`,
  `      if (!client2._brokenSids) client2._brokenSids = [];`
);

edit(
  "fix: trap rebuild reads its own client's broken ids (postTick)",
  `      const broken = window._rynBrokenSids || [];`,
  `      const broken = this.client._brokenSids || [];`
);

edit(
  "perf: map our traps only when a fight is close enough to need it",
  `      broken.length = 0;
      this._mine.clear();
      OM.grid2D.query(myPos.x, myPos.y, 4, id => {`,
  `      broken.length = 0;
      this._mine.clear();
      /* _mine exists to feed the rebuild above, which needs an enemy inside
       * 300. 600 keeps the map warm well before that gate can open, and spares
       * every idle bot a 9x9 grid sweep per tick. */
      const rebuildEnemy = EM.nearestEnemy;
      if (rebuildEnemy === null || myPos.distance(rebuildEnemy.pos.current) > 600) {
        return;
      }
      OM.grid2D.query(myPos.x, myPos.y, 4, id => {`
);

/* ------------------------------------------------------------------ *
 * Bot chat listener
 *
 * The listener re-read every bot socket with JSON.parse(ev.data). The frames
 * are binary msgpack, so ev.data stringifies to "[object ArrayBuffer]" and the
 * parse threw on literally every packet of every bot - a caught exception, so
 * it was silent, but it also meant the feature had never once fired. The
 * decoded chat packet is already in hand in SocketManager, so take it there.
 * ------------------------------------------------------------------ */

edit(
  "fix: bot chat listener off the raw packet path",
  `  const _seen = new Set;
  setInterval(() => {
    try {
      for (const bot of client.clients) {
        const sm = bot.SocketManager;
        if (!sm || !sm.socket || sm.socket._aiPatched) continue;
        sm.socket._aiPatched = true;
        const orig = sm.socket.onmessage;
        sm.socket.onmessage = function(ev) {
          try {
            const d = JSON.parse(ev.data);
            if (Array.isArray(d) && d[0] === "6") {
              const sid = d[1], msg = d[2];
              const key = sid + ":" + msg;
              if (!_seen.has(key)) {
                _seen.add(key);
                if (_seen.size > 300) _seen.delete(_seen.values().next().value);
                _onChat(sid, msg, bot);
              }
            }
          } catch (e) {}
          if (orig) orig.call(this, ev);
        };
      }
    } catch (e) {}
  }, 2000);`,
  `  /* Called once per chat message, from the owner's already-decoded packet.
   *
   * Left switched off, because it has never actually run: with the parse
   * throwing on every frame, the bot chat replies and the "nyx <n>" duel
   * trigger below have been dead code for as long as the listener has existed.
   * Fixing the plumbing should not silently start twenty bots talking in
   * public chat, so turning it on stays a deliberate act:
   *
   *   RYN._botChat = true    (or window._reupBotChatEnabled = true) */
  window._reupBotChatEnabled = false;
  window._reupBotChat = (senderID, message) => {
    if (!window._reupBotChatEnabled) return;
    try {
      _onChat(senderID, message, client);
    } catch (e) {}
  };`
);

edit(
  "fix: feed the bot chat listener from the decoded packet",
  `          if (player != null && player.isLeader && player.clanName !== null && myPlayer.isEnemyByID(player.id) && /owner/i.test(player.clanName) && /bee op then your hack/.test(message) && this.client.isOwner) {`,
  `          if (this.client.isOwner && typeof window._reupBotChat === "function") {
            window._reupBotChat(id, message);
          }
          if (player != null && player.isLeader && player.clanName !== null && myPlayer.isEnemyByID(player.id) && /owner/i.test(player.clanName) && /bee op then your hack/.test(message) && this.client.isOwner) {`
);

/* ------------------------------------------------------------------ *
 * Overlay canvases
 *
 * Assigning canvas.width reallocates the backing store even when the value is
 * unchanged, and the target overlay cleared a full-screen canvas on every
 * animation frame whether or not it had a single target to draw.
 * ------------------------------------------------------------------ */

edit(
  "perf: halves overlay keeps its backing store",
  `    cv.width = gameCanvas.width;
    cv.height = gameCanvas.height;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const offset = RYN._offset;
    const bots = _getOwnerBots();
    for (const side of [ "left", "right" ]) {`,
  `    if (cv.width !== gameCanvas.width || cv.height !== gameCanvas.height) {
      cv.width = gameCanvas.width;
      cv.height = gameCanvas.height;
    }
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const offset = RYN._offset;
    const bots = _getOwnerBots();
    for (const side of [ "left", "right" ]) {`
);

edit(
  "perf: squad overlay keeps its backing store",
  `    cv.width = gameCanvas.width;
    cv.height = gameCanvas.height;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const offset = RYN._offset;
    const bots = _getOwnerBots();
    const groups = new Map;`,
  `    if (cv.width !== gameCanvas.width || cv.height !== gameCanvas.height) {
      cv.width = gameCanvas.width;
      cv.height = gameCanvas.height;
    }
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const offset = RYN._offset;
    const bots = _getOwnerBots();
    const groups = new Map;`
);

edit(
  "perf: target overlay idles instead of clearing every frame",
  `  const _drawTargets = () => {
    const cv = _targetCanvas;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const now = Date.now();`,
  `  let _targetsDrawn = false;
  const _drawTargets = () => {
    const cv = _targetCanvas;
    if (_targets.size === 0 && !_targetsDrawn) {
      requestAnimationFrame(_drawTargets);
      return;
    }
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    _targetsDrawn = _targets.size !== 0;
    const now = Date.now();`
);

/* ================================================================== *
 * 11. Bots frozen holding a bow, crossbow or musket
 *
 * The freeze was a reload counter that could stop advancing.
 *
 * UpdateAttack only lets a client change weapon once reloading.isReloaded() is
 * true for the weapon in its hand, and PreAttack clamps shouldAttack the same
 * way. Reloading mirrors those counters straight off myPlayer.reload, and
 * Player.updateReloads() advanced only the reload of the weapon currently held
 * and returned early whenever a placeable item was in hand. So a reload that
 * started on the secondary and then lost its tick - the bot placed something,
 * or switched - never finished, isReloaded stayed false forever, and the
 * client could neither swing nor let go of what it was holding.
 *
 * Only the ranged secondaries have a reload window long enough for that race
 * to land, which is exactly why it was always a bow, a crossbow or a musket.
 *
 * Three layers: make the counters advance the way real reloads do, refuse to
 * store a max that can never be reached, and put a watchdog on the mirror so a
 * lost packet cannot park a client again.
 * ------------------------------------------------------------------ */

edit(
  "fix: reload timers advance for both weapons",
  `    updateReloads() {
      this.updateTurretReload();
      if (this.currentItem !== -1) {
        return;
      }
      const weapon = DataHandler_default.getWeapon(this.weapon.current);
      const reload = this.reload[weapon.itemType];
      this.increaseReload(reload);
      if ("projectile" in weapon) {`,
  `    updateReloads() {
      this.updateTurretReload();
      /* A reload runs on the weapon, not on the hand: switching weapons or
       * holding a placeable does not pause it. The original advanced only the
       * held weapon's counter and skipped the tick entirely while an item was
       * in hand, which is what left ranged secondaries stuck mid-reload. */
      this.increaseReload(this.reload[0]);
      this.increaseReload(this.reload[1]);
      if (this.currentItem !== -1) {
        return;
      }
      const weapon = DataHandler_default.getWeapon(this.weapon.current);
      const reload = this.reload[weapon.itemType];
      if ("projectile" in weapon) {`
);

edit(
  "fix: a reload max below zero can never be reached",
  `      const speed = myPlayer.getWeaponSpeed(id, store2.last) - pingAccount;
      reload.current = speed;
      reload.max = speed;`,
  `      /* getWeaponSpeed returns -1 for an empty slot, and a bad ping can drag a
       * real speed under zero. Either way isReloaded() compares against a max
       * no counter can reach, and answers false for the rest of the round. */
      const speed = Math.max(0, myPlayer.getWeaponSpeed(id, store2.last) - pingAccount);
      reload.current = speed;
      reload.max = speed;`
);

edit(
  "fix: watchdog on the mirrored reload counters",
  `      this.clientReload[2].current = myPlayer.reload[2].current;
    }
  }
  const Reloading_default = Reloading;`,
  `      this.clientReload[2].current = myPlayer.reload[2].current;
      this._watchdog();
    }
    _lastSeen=[ null, null, null ];
    _stalled=[ 0, 0, 0 ];
    /* Last resort. Everything above is mirrored from myPlayer.reload, which is
     * driven by server packets, and a counter that stops receiving them parks
     * below its max - which UpdateAttack reads as "still reloading" and refuses
     * to switch weapon on, for good. A healthy reload gains exactly one per
     * tick, so a counter that has not moved at all in two seconds is not a
     * reload in progress. Top it up and let the pipeline move again. */
    _watchdog() {
      for (let type = 0; type < 2; type++) {
        const reload = this.clientReload[type];
        const stalled = reload.max > 0 && reload.current < reload.max && reload.current === this._lastSeen[type];
        this._lastSeen[type] = reload.current;
        this._stalled[type] = stalled ? this._stalled[type] + 1 : 0;
        if (this._stalled[type] > 18) {
          reload.current = reload.max;
          this._stalled[type] = 0;
        }
      }
    }
  }
  const Reloading_default = Reloading;`
);

edit(
  "fix: let go of a weapon whose reload never finishes",
  `      const nextWeapon = forceWeapon !== null ? forceWeapon : useWeapon;
      if (nextWeapon !== null && (nextWeapon !== weapon || ModuleHandler.currentHolding !== nextWeapon || myPlayer.currentItem !== -1)) {
        const isReloaded = reloading.isReloaded(weapon);
        if (isReloaded || forceWeapon !== null) {
          ModuleHandler.whichWeapon(nextWeapon);
        }
      }`,
  `      const nextWeapon = forceWeapon !== null ? forceWeapon : useWeapon;
      if (nextWeapon !== null && (nextWeapon !== weapon || ModuleHandler.currentHolding !== nextWeapon || myPlayer.currentItem !== -1)) {
        /* Wanting a weapon we are not holding is normal for the tick or two the
         * one in hand needs to finish reloading. Wanting it for two solid
         * seconds is not a reload, it is a client that has stopped moving - the
         * shape the bow, crossbow and musket freeze took. Switch anyway at that
         * point: a swing the server refuses costs one packet, a bot that never
         * lets go of its bow costs the whole bot. */
        this.wantedTicks += 1;
        const isReloaded = reloading.isReloaded(weapon);
        if (isReloaded || forceWeapon !== null || this.wantedTicks > 18) {
          ModuleHandler.whichWeapon(nextWeapon);
          this.wantedTicks = 0;
        }
      } else {
        this.wantedTicks = 0;
      }`
);

edit(
  "fix: weapon-switch stall counter",
  `  class UpdateAttack {
    moduleName="updateAttack";
    client;
    didReset=false;`,
  `  class UpdateAttack {
    moduleName="updateAttack";
    client;
    didReset=false;
    wantedTicks=0;`
);

/* ------------------------------------------------------------------ *
 * 12. Driver manifest + runtime drift check
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
  "bridge: RYN._botAI and RYN._botChat",
  `    _drivers: ReUpDrivers,`,
  `    _drivers: ReUpDrivers,
    _botAI: ReUpBotAI,
    get _botChat() {
      return win._reupBotChatEnabled === true;
    },
    set _botChat(on) {
      win._reupBotChatEnabled = on === true;
    },`
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
