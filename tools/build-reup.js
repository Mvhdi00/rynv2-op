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
 * 10. Bot capability layer
 *
 * A bot runs the same module list as the owner, so it fights the way the
 * owner fights. What it never does is anything outside a fight, and that is
 * not an accident of the bot code — it falls out of three gates in the base
 * client:
 *
 *   - every placement module is a *combat* placement module. AutoPlacer,
 *     SpikeTrap, AutoRetrap, PlacementDefense and the rest all return early
 *     without an EnemyManager.nearestEnemy to place against.
 *   - the two peacetime paths are sandbox-only. Automill.canAutomill and
 *     AutoBuy.postTick both require `myPlayer.isSandbox`.
 *   - ModuleHandler._buy refuses to send a store packet outside sandbox
 *     unless the call is `force`d, and the only force call sites are the
 *     owner's own store clicks (the handleBuy / handleEquip hooks) and the
 *     Placer's hotkey path.
 *
 * A bot has neither a store UI nor a keyboard, so on a normal server it farms
 * wood, stone and gold it can never spend: no windmills, so no income and no
 * age; no purchases, so `canBuy(0, id)` is false for every hat and the hat
 * modules that drive the owner's gear (DefaultHat, AutoHat, UtilityHat) all
 * resolve to "no hat" for a bot. Follow and swing is all that is left, which
 * is exactly what it looks like in game.
 *
 * BotBuilder is the missing placement half, BotShopper the missing store
 * half. Both run only for bots, both stand down the moment the tick is needed
 * for a fight, and neither changes anything about how the owner plays. Owning
 * the hats is the whole unlock on the gear side: once a purchase lands,
 * `bought` has the id and every existing hat module starts driving the bot
 * the same way it drives the owner.
 * ------------------------------------------------------------------ */

edit(
  "settings: bot control keys",
  `    _botFarmLimit: 0,
    _botFarmMode: "single",`,
  `    _botFarmLimit: 0,
    _botFarmMode: "single",
    _botBuilder: false,
    _botBuildMills: true,
    _botBuildSpikes: false,
    _botBuildTraps: false,
    _botBuildLimit: 7,
    _botAutoBuy: false,`
);

edit(
  "module: BotBuilder + BotShopper",
  `  class ModuleHandler {`,
  `  /* Peacetime building for bots.
   *
   * Placement order is the settings order: windmills first because they are
   * the only thing that turns farmed wood into the gold the store runs on.
   * The tick is given up to the combat modules on any sign of a fight, and to
   * whichever placement module already claimed it this tick (placedOnce). */
  const BOT_BUILD_PLAN = [ {
    key: "_botBuildMills",
    type: 5,
    capped: true
  }, {
    key: "_botBuildSpikes",
    type: 4,
    capped: false
  }, {
    key: "_botBuildTraps",
    type: 7,
    capped: false
  } ];
  const BOT_BUILD_ANGLES = 16;
  const BOT_BUILD_COOLDOWN = 3;
  const BOT_BUILD_SAFE_DISTANCE = 500;
  const BOT_BUILD_CLEARANCE = 90;
  class BotBuilder {
    moduleName="botBuilder";
    client;
    cooldown=0;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.cooldown = 0;
    }
    /* A spike tick or a retrap needs the placement tick more than a windmill
     * does, so anything that reads as a fight stands the builder down. */
    _isFighting() {
      const {EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (myPlayer.isTrapped) {
        return true;
      }
      if (EnemyManager2.detectedEnemy || EnemyManager2.detectedDangerEnemy) {
        return true;
      }
      const enemy = EnemyManager2.nearestEnemy;
      return enemy !== null && myPlayer.pos.current.distance(enemy.pos.current) <= BOT_BUILD_SAFE_DISTANCE;
    }
    _ownerPosition() {
      const owner = this.client.ownerClient;
      const player = owner && owner.myPlayer;
      return player && player.inGame ? player.pos.current : null;
    }
    /* Build away from the owner and work outwards: a bot that drops a mill
     * between itself and the player it is following walls off its own way
     * back, and mills are a solid layer. */
    _angles() {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      const ownerPos = this._ownerPosition();
      const away = ownerPos !== null ? reverseAngle(myPlayer.pos.current.angle(ownerPos)) : ModuleHandler.reverse_move_dir !== null ? ModuleHandler.reverse_move_dir : 0;
      const step = Math.PI * 2 / BOT_BUILD_ANGLES;
      const angles = [];
      for (let i = 0; i < BOT_BUILD_ANGLES; i++) {
        const offset = Math.ceil(i / 2) * step;
        angles.push(i % 2 === 0 ? away + offset : away - offset);
      }
      return angles;
    }
    /* ObjectManager.canPlaceItem only knows about objects, so the owner and
     * the other bots have to be kept clear here. */
    _tooCloseToUs(id, angle) {
      const {myPlayer: myPlayer, ownerClient: owner} = this.client;
      const position = myPlayer.getPlacePosition(myPlayer.pos.current, id, angle);
      const ownerPos = this._ownerPosition();
      if (ownerPos !== null && position.distance(ownerPos) < BOT_BUILD_CLEARANCE) {
        return true;
      }
      if (owner !== null && owner !== undefined) {
        for (const other of owner.clients) {
          if (other === this.client) {
            continue;
          }
          const player = other.myPlayer;
          if (player && player.inGame && position.distance(player.pos.current) < BOT_BUILD_CLEARANCE) {
            return true;
          }
        }
      }
      return false;
    }
    _tryPlace(plan) {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      if (!Settings_default[plan.key] || !myPlayer.canPlace(plan.type)) {
        return false;
      }
      const id = myPlayer.getItemByType(plan.type);
      if (plan.capped) {
        const {count: count, limit: limit} = myPlayer.getItemCount(Items[id].itemGroup);
        if (count >= Math.min(limit, Settings_default._botBuildLimit)) {
          return false;
        }
      }
      for (const angle of this._angles()) {
        if (!myPlayer.canPlaceObject(plan.type, angle) || this._tooCloseToUs(id, angle)) {
          continue;
        }
        ModuleHandler.place(plan.type, angle);
        ModuleHandler.placedOnce = true;
        ModuleHandler.placeAngles[0] = plan.type;
        ModuleHandler.placeAngles[1].push(angle);
        ModuleHandler.moduleActive = true;
        return true;
      }
      return false;
    }
    postTick() {
      const {isOwner: isOwner, myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      if (isOwner || !Settings_default._botBuilder || !myPlayer.inGame) {
        return;
      }
      if (this.cooldown > 0) {
        this.cooldown -= 1;
        return;
      }
      if (ModuleHandler.placedOnce || ModuleHandler.healedOnce) {
        return;
      }
      if (ModuleHandler.packetCount > ModuleHandler.packetLimit - 8) {
        return;
      }
      if (this._isFighting()) {
        return;
      }
      for (const plan of BOT_BUILD_PLAN) {
        if (this._tryPlace(plan)) {
          this.cooldown = BOT_BUILD_COOLDOWN;
          return;
        }
      }
    }
  }
  /* The store, for bots.
   *
   * Every id here is one the client's own gear modules already ask for by
   * number, in the order a bot gets the most out of them: Soldier Helmet is
   * what _antienemy reaches for on every threat, Monkey Tail is the cheapest
   * real upgrade, and the 10k+ gear only starts landing once the windmills
   * have been paying for a while. A bot buys the highest-priority item it can
   * afford right now rather than saving up, so a slow farmer still ends up
   * wearing something.
   *
   * The buy goes through ModuleHandler._buy with force, which is the same
   * call the owner's own store clicks make - it checks what is already
   * bought, checks the gold, sends the packet and books the spend. That
   * bought set is only
   * written when the server confirms the purchase (packet "5"), so a rejected
   * buy is retried, and the attempt cap is what stops that becoming a loop. */
  const BOT_STORE_PLAN = [ [ 0, 6 ], [ 1, 11 ], [ 0, 31 ], [ 0, 15 ], [ 0, 12 ], [ 0, 22 ], [ 0, 7 ], [ 0, 53 ], [ 0, 11 ], [ 0, 40 ], [ 1, 19 ], [ 1, 21 ], [ 1, 13 ], [ 1, 18 ], [ 0, 5 ] ];
  const BOT_STORE_ATTEMPTS = 4;
  const BOT_STORE_COOLDOWN = 18;
  class BotShopper {
    moduleName="botShopper";
    client;
    cooldown=0;
    attempts=new Map;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.cooldown = 0;
      this.attempts.clear();
    }
    postTick() {
      const {isOwner: isOwner, myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      if (isOwner || !Settings_default._botAutoBuy) {
        return;
      }
      if (!myPlayer.inGame || myPlayer.isSandbox) {
        return;
      }
      if (this.cooldown > 0) {
        this.cooldown -= 1;
        return;
      }
      if (ModuleHandler.packetCount > ModuleHandler.packetLimit - 4) {
        return;
      }
      for (const [type, id] of BOT_STORE_PLAN) {
        if (ModuleHandler.hasStoreItem(type, id)) {
          continue;
        }
        const price = DataHandler_default.getStore(type)[id].price;
        if (price === 0 || myPlayer.tempGold < price) {
          continue;
        }
        const key = type + ":" + id;
        const tried = this.attempts.get(key) || 0;
        if (tried >= BOT_STORE_ATTEMPTS) {
          continue;
        }
        this.attempts.set(key, tried + 1);
        ModuleHandler._buy(type, id, true);
        this.cooldown = BOT_STORE_COOLDOWN;
        return;
      }
    }
  }
  class ModuleHandler {`
);

edit(
  "modules: construct BotBuilder + BotShopper",
  `        autoMill: new Automill_default(client2),
        autoGrind: new AutoGrind(client2),`,
  `        autoMill: new Automill_default(client2),
        botBuilder: new BotBuilder(client2),
        botShopper: new BotShopper(client2),
        autoGrind: new AutoGrind(client2),`
);

/* Both go in the shared module list rather than botModules: botModules run
 * first, before any combat module has had the chance to claim the tick, and
 * a windmill must never be what stops a retrap from going down. Sitting here,
 * right after Automill, they see placedOnce already set by whatever placement
 * module needed it, and they still land before UpdateAttack / UpdateAngle
 * finalise the tick. Each one returns immediately for the owner. */
edit(
  "modules: run BotBuilder + BotShopper in the tick",
  `this.staticModules.autoMill, this.staticModules.autoGrind,`,
  `this.staticModules.autoMill, this.staticModules.botBuilder, this.staticModules.botShopper, this.staticModules.autoGrind,`
);

/* Chat commands, next to the ones that already steer bots from chat. */
edit(
  "commands: !bbuild / !bbuy",
  `            if (message === "!abot") {`,
  `            if (message === "!bbuild" || message === "!sbbuild") {
              const enable = message === "!bbuild";
              Settings_default._botBuilder = enable;
              if (enable) {
                Settings_default._botBuildMills = true;
              }
              SaveSettings();
              try {
                syncCheckboxUI("_botBuilder");
                syncCheckboxUI("_botBuildMills");
              } catch (e) {}
            }
            if (message === "!bbuy" || message === "!sbbuy") {
              Settings_default._botAutoBuy = message === "!bbuy";
              SaveSettings();
              try {
                syncCheckboxUI("_botAutoBuy");
              } catch (e) {}
            }
            if (message === "!abot") {`
);

/* Menu: Bots -> Full Control, above the Auto Farm block it feeds off. */
patchPage(
  "Bots_default",
  `\r\n\r\n    <div class="section">\r\n        <div class="section" style="margin-top:6px;">`,
  `\r
\r
    <div class="section">\r
        <div class="section-title">Full Control</div>\r
        <div class="section-content">\r
\r
            <div class="content-option">\r
                <span class="option-title">Bots build</span>\r
                <label class="switch-checkbox">\r
                    <input id="_botBuilder" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Bots place their own buildings whenever no enemy is near them. Combat placement always wins the tick.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Build windmills</span>\r
                <label class="switch-checkbox">\r
                    <input id="_botBuildMills" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">50 wood and 10 stone each, and the only thing that earns a bot gold. Set Farm Mode to Nearest so bots gather both.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Windmill limit</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_botBuildLimit" type="range" step="1" min="1" max="30">\r
                </label>\r
                <span class="option-description">Per bot. The server caps mills at 7 outside sandbox, so anything above that only matters in sandbox.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Build spikes</span>\r
                <label class="switch-checkbox">\r
                    <input id="_botBuildSpikes" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Off by default: spikes are solid for everyone, so a following bot lays them along your path.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Build traps</span>\r
                <label class="switch-checkbox">\r
                    <input id="_botBuildTraps" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Needs age 4 with Trap picked in Age 4 Building.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Bots buy gear</span>\r
                <label class="switch-checkbox">\r
                    <input id="_botAutoBuy" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Bots spend their own gold on the hats and accessories the client already asks for. Once a bot owns one, your hat logic equips it for the bot exactly like it does for you.</span>\r
            </div>\r
\r
        </div>\r
    </div>\r
`
);

/* Menu: the same two commands on the Chat Commands page. */
edit(
  "menu: bot building commands page section",
  `${"$"}{card("!sabot", t.sabot_title || "Stop auto-attack mode", "!sabot", t.sabot_example || "Bots stop attacking and return to follow or idle", t.sabot_note || "Use this to avoid triggering unwanted fights.")}\\n</div></div>`,
  `${"$"}{card("!sabot", t.sabot_title || "Stop auto-attack mode", "!sabot", t.sabot_example || "Bots stop attacking and return to follow or idle", t.sabot_note || "Use this to avoid triggering unwanted fights.")}\\n</div></div>\\n<div class="section"><div class="section-title">${"$"}{t.bot_building || "Bot Building"}</div>\\n<div class="section-content" style="display:flex;flex-direction:column;gap:8px;padding:8px 0">\\n${"$"}{card("!bbuild", t.bbuild_title || "Let bots build for themselves", "!bbuild", t.bbuild_example || "Bots place windmills whenever no enemy is near", t.bbuild_note || "Turns on Bots build and Build windmills on the Bots page.")}\\n${"$"}{card("!sbbuild", t.sbbuild_title || "Stop bots from building", "!sbbuild", t.sbbuild_example || "Bots stop placing buildings of their own", t.sbbuild_note || "Combat placement is unaffected either way.")}\\n${"$"}{card("!bbuy", t.bbuy_title || "Let bots spend their own gold", "!bbuy", t.bbuy_example || "Bots buy hats and accessories as they can afford them", t.bbuy_note || "Once bought, your hat logic equips them for the bot.")}\\n${"$"}{card("!sbbuy", t.sbbuy_title || "Stop bots from buying", "!sbbuy", t.sbbuy_example || "Bots keep their gold", t.sbbuy_note || "Anything already bought stays bought.")}\\n</div></div>`
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
