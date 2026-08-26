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
 * 10. Driver manifest + runtime drift check
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

/* ------------------------------------------------------------------ *
 * 11. Auto Mills Force (replaces RYN's Automill)
 *
 * RYN's Automill was an opening routine, not a toggle: it only ran in sandbox,
 * only before age 20, only until the first placement of the tick, and it shut
 * itself off (`active = false`) the moment the mill cap was hit, so on a normal
 * server the key did nothing at all. Its side spacing was also computed from
 * the placement radius, which is not the spacing the YoRHa mod uses.
 *
 * It is dropped for a straight port of that mod's mill trail: a toggle on a key
 * of its own that lays mills behind you for as long as you are moving, on any
 * server, at any age, until the mill cap or your resources stop it. Everything
 * the port keeps and everything it deliberately keeps quirky is written up on
 * the class itself.
 * ------------------------------------------------------------------ */

edit(
  "module: Automill -> AutoMillsForce",
  `  class Automill {
    moduleName="autoMill";
    toggle=false;
    active=true;
    client;
    tickCount=0;
    constructor(client2) {
      this.client = client2;
    }
    get isActive() {
      return this.toggle && this.active;
    }
    reset() {
      this.active = true;
    }
    get canAutomill() {
      const isOwner = this.client.isOwner;
      const {attacking: attacking, placedOnce: placedOnce, staticModules: staticModules} = this.client._ModuleHandler;
      return Settings_default._automill && this.client.myPlayer.isSandbox && !placedOnce && (!isOwner || !attacking) && this.active && !staticModules.autoBuy.boughtEverything() && this.client.myPlayer.age < 20;
    }
    canPlaceWindmill(angle) {
      return this.client.myPlayer.canPlaceObject(5, angle);
    }
    placeWindmill(angle) {
      const {_ModuleHandler: ModuleHandler} = this.client;
      const type = 5;
      ModuleHandler.place(type, angle);
      ModuleHandler.placedOnce = true;
      ModuleHandler.placeAngles[0] = type;
      ModuleHandler.placeAngles[1].push(angle);
    }
    postTick() {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      this.toggle = true;
      if (!this.canAutomill) {
        this.toggle = false;
        return;
      }
      if (!myPlayer.canPlace(5)) {
        this.toggle = false;
        this.active = false;
        return;
      }
      const angle = ModuleHandler.reverse_move_dir;
      if (angle === null) {
        return;
      }
      const item = Items[myPlayer.getItemByType(5)];
      const distance = myPlayer.getItemPlaceScale(item.id);
      const offset = Math.asin((2 * item.scale + 9e-13) / (2 * distance)) * 2;
      const leftAngle = angle - offset;
      const rightAngle = angle + offset;
      if (this.canPlaceWindmill(angle) && this.canPlaceWindmill(leftAngle) && this.canPlaceWindmill(rightAngle)) {
        this.placeWindmill(angle);
        this.placeWindmill(leftAngle);
        this.placeWindmill(rightAngle);
      }
    }
  }
  const Automill_default = Automill;`,
  `  /* Auto Mills Force — the YoRHa mod's mill trail, on this core.
   *
   * A toggle and nothing else: while it is on and you are moving, every tick it
   * lays mills behind you — one straight back down your travel line and one to
   * either side of it.
   *
   * The side offset is the mod's own — the mill's scale plus half of it, read
   * as degrees — kept as written rather than recomputed from the placement
   * radius the way the old Automill did it. On a 45-scale windmill placed at
   * radius 85 that puts 94 units between neighbours against the 90 they need,
   * so the trail is laid as tight as it will go and still fit.
   *
   * The middle angle gates the set the way the mod does — if the mill straight
   * behind you does not fit, nothing goes down that tick — and each mill is
   * checked both against the world and against the mills this tick has already
   * spent, the job the mod's addPredictObject() does. Placements are sent, not
   * tracked, so the object manager cannot answer that second question yet, and
   * at four units of clearance it is not a question to skip.
   *
   * It stands down while you are sitting in an enemy trap. Past that only the
   * mill cap and the cost stop it: none of the sandbox, age or
   * first-placement-of-the-tick conditions the old Automill carried.
   */
  class AutoMillsForce {
    moduleName="autoMillsForce";
    client;
    placed=[];
    constructor(client2) {
      this.client = client2;
    }
    get isActive() {
      return this.placed.length !== 0;
    }
    reset() {
      this.placed.length = 0;
    }
    _tryPlace(id, angle, distance) {
      const {myPlayer: myPlayer, ObjectManager: ObjectManager2, _ModuleHandler: ModuleHandler} = this.client;
      const position = myPlayer.pos.current.addDirection(angle, distance);
      if (!ObjectManager2.canPlaceItem(id, position)) {
        return false;
      }
      const scale = Items[id].scale;
      for (const taken of this.placed) {
        if (position.distance(taken) < scale * 2) {
          return false;
        }
      }
      const type = 5;
      ModuleHandler.place(type, angle);
      ModuleHandler.placedOnce = true;
      ModuleHandler.placeAngles[0] = type;
      ModuleHandler.placeAngles[1].push(angle);
      this.placed.push(position);
      return true;
    }
    postTick() {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      this.placed.length = 0;
      if (!Settings_default._autoMillsForce || !myPlayer.inGame || myPlayer.isTrapped) {
        return;
      }
      const angle = ModuleHandler.reverse_move_dir;
      if (angle === null || !myPlayer.canPlace(5)) {
        return;
      }
      const id = myPlayer.getItemByType(5);
      const item = Items[id];
      const distance = myPlayer.getItemPlaceScale(id);
      const offset = toRadians(item.scale + item.scale / 2);
      if (!this._tryPlace(id, angle, distance)) {
        return;
      }
      this._tryPlace(id, angle - offset, distance);
      this._tryPlace(id, angle + offset, distance);
    }
  }
  const AutoMillsForce_default = AutoMillsForce;`
);

edit(
  "module: register autoMillsForce",
  `        autoMill: new Automill_default(client2),`,
  `        autoMillsForce: new AutoMillsForce_default(client2),`
);

edit(
  "module: autoMillsForce in the run order",
  `this.staticModules.placer, this.staticModules.autoMill, this.staticModules.autoGrind`,
  `this.staticModules.placer, this.staticModules.autoMillsForce, this.staticModules.autoGrind`
);

/* Auto Grind stands aside while the trail is being laid, same as it did for
 * Automill — both want the tick's placement and the grind is the one that can
 * wait. */
edit(
  "autogrind: defer to autoMillsForce",
  `      const {autoMill: autoMill, reloading: reloading} = ModuleHandler.staticModules;
      if (autoMill.isActive) return;`,
  `      const {autoMillsForce: autoMillsForce, reloading: reloading} = ModuleHandler.staticModules;
      if (autoMillsForce.isActive) return;`
);

/* The mod's key is B, which Quad Traps already holds here, so the trail keeps
 * the key Automill was on. Both are rebindable in Keybinds -> Quick Actions.
 *
 * It also defaults off rather than on: Automill could only fire in a sandbox
 * opening, this one spends mills the moment you move. */
edit(
  "settings: _autoMillsForceKey",
  `    _autoMillKey: "KeyN",`,
  `    _autoMillsForceKey: "KeyN",`
);

edit(
  "settings: _autoMillsForce",
  `    _automill: true,`,
  `    _autoMillsForce: false,`
);

/* The parity migration force-enables everything in its list. The trail is not
 * something to switch on behind the user's back, so it is not in it. */
edit(
  "settings: drop _automill from the parity migration",
  `"_autoheal", "_automill", "_autoplacer"`,
  `"_autoheal", "_autoplacer"`
);

edit(
  "keys: toggle Auto Mills Force",
  `      if (event.code === Settings_default._autoMillKey) {
        try {
          Settings_default._automill = !Settings_default._automill;
          const autoMillEl = UI_default.frame && UI_default.frame.document && UI_default.frame.document.getElementById("_automill");
          if (autoMillEl) autoMillEl.checked = Settings_default._automill;
        } catch (_) {}
      }`,
  `      if (event.code === Settings_default._autoMillsForceKey) {
        try {
          Settings_default._autoMillsForce = !Settings_default._autoMillsForce;
          const autoMillsEl = UI_default.frame && UI_default.frame.document && UI_default.frame.document.getElementById("_autoMillsForce");
          if (autoMillsEl) autoMillsEl.checked = Settings_default._autoMillsForce;
          RYNNotify.show("Auto Mills Force", Settings_default._autoMillsForce);
        } catch (_) {}
      }`
);

/* A second listener toggled the same setting from a hard-coded KeyN, so the
 * bound key and this one both fired and cancelled each other out whenever the
 * keybind was left at its default. The keybind above is the only toggle now. */
edit(
  "keys: drop the hard-coded KeyN toggle",
  `    if (e.code === "KeyN") {
      Settings_default._automill = !Settings_default._automill;
    }
`,
  ``
);

edit(
  "menu: Auto Mills Force hotkey",
  String.raw`                <div class="content-option">\r\n                    <span class="option-title">Toggle Automill</span>\r\n                    <button id="_autoMillKey" class="hotkeyInput"></button>\r\n                </div>`,
  String.raw`                <div class="content-option">\r\n                    <span class="option-title">Toggle Auto Mills Force</span>\r\n                    <button id="_autoMillsForceKey" class="hotkeyInput"></button>\r\n                </div>`
);

edit(
  "menu: Auto Mills Force toggle",
  String.raw`            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_automill\">Automill</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_automill\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>`,
  String.raw`            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoMillsForce\">Auto Mills Force</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoMillsForce\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n                <span class=\"option-description\">Lays a mill trail behind you the whole time you are moving: one straight back and one to either side. Toggle it in-game with the Auto Mills Force key (Keybinds -> Quick Actions).</span>\r\n            </div>`
);

edit(
  "i18n: auto_mills_force",
  `      automill: "Automill",`,
  `      auto_mills_force: "Auto Mills Force",`
);

edit(
  "i18n: toggle_auto_mills_force",
  `      toggle_automill: "Toggle Automill",`,
  `      toggle_auto_mills_force: "Toggle Auto Mills Force",`
);

edit(
  "i18n: option map (toggle)",
  `[ "Automill", t.automill ]`,
  `[ "Auto Mills Force", t.auto_mills_force ]`
);

edit(
  "i18n: option map (hotkey)",
  `[ "Toggle Automill", t.toggle_automill ]`,
  `[ "Toggle Auto Mills Force", t.toggle_auto_mills_force ]`
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
