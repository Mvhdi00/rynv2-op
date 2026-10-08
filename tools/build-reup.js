#!/usr/bin/env node
/*
 * build-reup.js
 *
 * Builds ReUp_Mix.user.js: Ryn Type 2, repaired against the game bundle it has
 * to run on (tools/repairs.js), plus the Luna features RYN never had.
 *
 * RYN is the base rather than Luna because only RYN speaks the protocol the
 * current game actually uses — the per-connection opcode permutation, the
 * truncated-HMAC frame prefix, and now the per-frame xorshift mask and the
 * WebAssembly key mixer in src/game_protocol.js. Luna 1.1 is a fork of the old
 * webpack bundle and predates all of it, so its features are ported across as
 * modules instead of its code being merged in.
 *
 * For the repairs on their own, leaving Ryn Type 2 as Ryn Type 2, see
 * tools/fix-ryn.js.
 *
 * Every edit is anchored to an exact string in the base client, and an anchor
 * that is missing or ambiguous fails the build: dropping in a newer RYN shows
 * up as a build error rather than a half-merged script.
 *
 *   node tools/build-reup.js
 */

const fs = require("fs");
const path = require("path");

const { Editor } = require("./edits.js");
const repairs = require("./repairs.js");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Ryn_Type_2.user.js");
const OUT = path.join(ROOT, "ReUp_Mix.user.js");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

const editor = new Editor(fs.readFileSync(BASE, "utf8"));
const applied = editor.applied;
const edit = (label, find, replace) => editor.edit(label, find, replace);

/* ------------------------------------------------------------------ *
 * 0. The repairs, first: everything below is layered on a client that
 * already works against the shipped bundle.
 * ------------------------------------------------------------------ */

repairs.apply(editor, DRIVERS);

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 * ------------------------------------------------------------------ */

const header = `// ==UserScript==
// @name            ReUp Mix (Luna x Ryn)
// @namespace       reup-mix
// @author          Mix build - Ryn Type 2 by Raptor, Luna Client by Luna & Skye (help from Zenith and XTRFY)
// @description     The Ryn Type 2 core on the current protocol, with its bundle hooks repaired and the Luna-only features folded in
// @version         2.0.0
// @match           *://*.moomoo.io/*
// @icon            https://i.postimg.cc/G294sRHY/ryn-type-2.webp
// @run-at          document-start
// @grant           none
// @license         MIT
// ==/UserScript==
`;

{
  const end = editor.code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of base userscript header");
  editor.code =
    header + editor.code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  applied.push("header: rewritten for ReUp Mix");
}

/* ------------------------------------------------------------------ *
 * 2. Branding
 * ------------------------------------------------------------------ */

edit(
  "branding: window title",
  `  if (document.title !== "Ryn Type 2") document.title = "Ryn Type 2";`,
  `  if (document.title !== "ReUp Mix") document.title = "ReUp Mix";`
);

edit(
  "branding: client name in the Misc page",
  `<span id=\\\"author\\\" class=\\\"text-value\\\">Ryn Type 2</span>`,
  `<span id=\\\"author\\\" class=\\\"text-value\\\">ReUp Mix</span>`
);

/* ------------------------------------------------------------------ *
 * 3. Settings for the ported Luna features
 * ------------------------------------------------------------------ */

edit(
  "settings: ReUp keys",
  `    _velocityTickTimes: 0,
  };`,
  `    _velocityTickTimes: 0,
    // ReUp Mix: ported from Luna. The rotation toggles default to on, i.e.
    // vanilla behaviour — Luna defaulted them off, and a mix should not
    // silently change how the game looks on first run.
    _spikeRotation: true,
    _millRotation: true,
    _usernameCycler: false,
    _usernameList: "Luna1, Luna2, Luna3",
    _usernameIndex: 0,
    _menuTheme: "ryn",
  };`
);

/* ------------------------------------------------------------------ *
 * 4. Object spin (Luna: "spike rotation" / "mill rotation")
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
 * 5. Username cycler (Luna)
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
 * 6. Menu themes (Luna)
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
  `        this.attachTextInputs();
        this.attachSelects();`,
  `        this.attachTextInputs();
        this.attachReUpTheme();
        this.attachSelects();`
);

edit(
  "menu: attachReUpTheme",
  `    attachTextInputs() {`,
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
    attachTextInputs() {`
);

/* ------------------------------------------------------------------ *
 * 7. Menu markup for the ported features
 *
 * The page constants are JS string literals, so decode, splice, re-encode.
 * Checkboxes and text inputs bind themselves by id off the settings object.
 * The markup follows this client's own shape: a `.section` with a
 * `.section-title` carrying a `.sec-sub`, and each row an `.opt-main` pair of
 * title and description beside its control.
 * ------------------------------------------------------------------ */

const themeButtons = Object.entries(THEMES)
  .map(
    ([key, theme]) =>
      `                        <button class="reup-theme" data-theme="${key}" title="${theme.name}"></button>`
  )
  .join("\n");

editor.patchPage(
  "Misc_default",
  `    <div class="section">
        <div class="section-title">Reset`,
  `    <div class="section">
        <div class="section-title">ReUp Mix<span class="sec-sub">The Luna-only features, ported onto this core.</span></div>
        <div class="section-content">
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Username Cycler</span>
                    <span class="opt-desc">Takes the next name in the comma separated list every time you spawn, so consecutive lives do not share a name.</span>
                </div>
                <div class="option-content">
                    <input id="_usernameList" class="input" type="text" maxlength="120" placeholder="Name, name, name">
                    <label class="switch-checkbox"><input id="_usernameCycler" type="checkbox"><span></span></label>
                </div>
            </div>
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Spike Rotation</span>
                    <span class="opt-desc">Off freezes spinning spikes so their hitbox is easier to read.</span>
                </div>
                <label class="switch-checkbox"><input id="_spikeRotation" type="checkbox"><span></span></label>
            </div>
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Mill Rotation</span>
                    <span class="opt-desc">Off freezes windmills and power mills.</span>
                </div>
                <label class="switch-checkbox"><input id="_millRotation" type="checkbox"><span></span></label>
            </div>
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Menu Theme</span>
                    <span class="opt-desc">The accent colour this menu is drawn in.</span>
                </div>
                <div class="option-content reup-theme-row">
${themeButtons}
                </div>
            </div>
        </div>
    </div>

`
);

/* Styles for the theme swatch row. */
editor.patchStyles(
  "styles_default",
  `
.reup-theme-row{display:flex;gap:8px;align-items:center;}
.reup-theme{
  width:22px;height:22px;padding:0;border-radius:50%;cursor:pointer;
  background:var(--swatch,#7A42F4);
  border:2px solid transparent;
  transition:border-color 140ms ease,transform 140ms ease;
}
.reup-theme:hover{transform:scale(1.12);}
.reup-theme.active{border-color:var(--text);}
`
);

/* ------------------------------------------------------------------ *
 * 8. Driver manifest + runtime drift check
 *
 * The tables and the transport this build carries were checked against the
 * shipped bundle (tools/verify-drivers.js, tools/check-wire.js). This records
 * what they were checked against and re-checks the parts that are observable
 * at runtime, so a change on the server side shows up as a console warning
 * rather than as packets that quietly stop being understood.
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
    _Login: Login_default,`,
  `  /* Game drivers this build was verified against. See drivers/game-drivers.json. */
  const ReUpDrivers = ${JSON.stringify(manifest, null, 4).replace(/\n/g, "\n  ")};
  ReUpDrivers.check = () => {
    const problems = [];
    const p = ReUpDrivers.protocol;
    const say = problem => problems.push(problem);
    try {
      const enc = win.RYN && win.RYN._enc;
      if (enc && enc.jt !== undefined && enc.jt !== null && enc.jt !== p.signatureBytes) {
        say(\`frame signature is \${enc.jt} bytes, expected \${p.signatureBytes}\`);
      }
      const crypto = client && client._gameCrypto;
      if (crypto && crypto.mode !== undefined && crypto.mode !== p.encryptedMode) {
        say(\`transport mode is \${crypto.mode}, expected \${p.encryptedMode}\`);
      }
      if (crypto && crypto.tables && crypto.tables.c2s && crypto.tables.c2s.enc) {
        const live = Object.keys(crypto.tables.c2s.enc).length;
        const want = crypto.mask ? p.c2sAlphabet.length : p.c2sLegacyCount;
        if (live !== want) say(\`c2s opcode table has \${live} entries, expected \${want}\`);
      }
      /* The key mixer is pinned to a build id. RynWire carries a copy of this
       * build's mixer to fall back on, and that copy is only right for this
       * build, so a server running a different one has to be said out loud. */
      const proto = win.RYN && win.RYN._modules && win.RYN._modules["moomoo-protocol"];
      const live = proto && proto.BUILD_ID;
      if (live && live !== p.keyMixer.buildId) {
        say(
          \`the game is build "\${live}", not the "\${p.keyMixer.buildId}" this was verified \` +
          "against; the built-in key mixer is for the latter, so bots will only connect " +
          "while the game's own moomoo-protocol module is reachable"
        );
      }
    } catch (e) {}
    if (problems.length) {
      try {
        console.warn("[ReUp] drift from the bundle this build was verified against:");
        for (const problem of problems) console.warn("  " + problem);
      } catch (_) {}
    }
    return problems;
  };
  const RYN = {
    _Login: Login_default,
    _drivers: ReUpDrivers,`
);

edit(
  "drivers: run the check once the game is up",
  `  resetGame_default(loadedFast);`,
  `  setTimeout(() => {
    try {
      ReUpDrivers.check();
    } catch (e) {}
  }, 15e3);
  resetGame_default(loadedFast);`
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, editor.code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  from ${path.relative(ROOT, BASE)}`);
console.log(
  `  ${(editor.code.length / 1024).toFixed(0)} KB, ${editor.code.split("\n").length} lines\n`
);
for (const step of applied) console.log("  + " + step);
