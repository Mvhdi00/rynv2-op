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

/* Decode a page constant, hand the markup to `transform`, re-encode. */
function editPage(constName, transform, label) {
  const declaration = `const ${constName} = `;
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error(`page constant not found: ${constName}`);

  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");

  // eslint-disable-next-line no-eval
  const html = eval(literal);
  const patched = transform(html);
  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(patched) +
    ";" +
    code.slice(lineEnd);
  applied.push(label);
}

function patchPage(constName, anchorHtml, insertHtml) {
  editPage(
    constName,
    (html) => {
      if (!html.includes(anchorHtml)) throw new Error(`page anchor not found in ${constName}`);
      return html.replace(anchorHtml, insertHtml + anchorHtml);
    },
    `menu: options added to ${constName}`
  );
}

/* Swap one block of menu markup for another. Unlike patchPage this removes
 * what it matched, so a stale anchor has to fail rather than silently leave
 * the old option on the page next to its replacement. */
function replaceInPage(constName, findHtml, replaceHtml, label) {
  editPage(
    constName,
    (html) => {
      const parts = html.split(findHtml);
      if (parts.length === 1) throw new Error(`page anchor not found in ${constName}: ${label}`);
      if (parts.length > 2) throw new Error(`page anchor is ambiguous in ${constName}: ${label}`);
      return parts[0] + replaceHtml + parts[1];
    },
    label
  );
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
 * 11. Knockback Strike (replaces TrapKB)
 *
 * TrapKB and the EnemyManager scan behind it are removed outright and one
 * module is put in their place. See the comment block written into the
 * client below for what changed and why.
 * ------------------------------------------------------------------ */

const KB_STRIKE_CLASS = `  // ── Knockback strike ──────────────────────────────────────────────────
  // Hit them so the recoil carries them onto something that hurts.
  //
  // The module this replaces asked one question, once per pit trap: does the
  // trap fall inside a cone drawn from me through them, and are they within
  // getActualMaxKnockback of it. Three things were wrong with that.
  //
  //   · A cone anchored at the player widens with distance, so a trap well
  //     behind the target passed the test while a spike sitting just off the
  //     push axis failed it.
  //   · The range gate spent a knockback budget with the secondary and the
  //     turret already folded in, whether or not either was going out that
  //     tick, so the module committed to pushes it could not deliver.
  //   · It only ever looked at pit traps. Every spike on the map was
  //     invisible to it, which is most of what a knockback is for.
  //
  // The push is a radial impulse along me -> them, so the honest question is
  // where that impulse runs out and what the segment between here and there
  // passes through:
  //
  //   travel   the weapon's own knockback figure straight off the item table
  //            (33.3 / 55.6 / 111.1 — that is 111ms x (0.3 + knock) under the
  //            game's 0.993/ms decay), plus the turret's 33.3 only on a tick
  //            the turret is actually going out
  //   path     a segment from their predicted position along the push axis,
  //            each hazard tested by closest approach to it, so a hazard is
  //            found wherever along the line it sits and one past the end of
  //            the travel is not found at all
  //   worth    what landing there does — a trap ends the fight, a spike deals
  //            its own damage, and a second hazard on the same line chains —
  //            so the target is chosen by outcome rather than by proximity
  //
  // Ours only, in both directions: their spikes are their prize, not ours,
  // and a target already pinned does not move when hit, so there is no push
  // to aim and nothing here can use them.
  const KB_STRIKE_TURRET_TRAVEL = 33.3;
  const KB_STRIKE_TRAP_CATCH = 47.5;
  const KB_STRIKE_TRAP_WORTH = 120;
  const KB_STRIKE_CHAIN = .6;
  const KB_STRIKE_MIN_WORTH = 15;
  const KB_STRIKE_CELLS = 3;

  class KnockbackStrike {
    moduleName="knockbackStrike";
    client;
    target=null;
    landing=null;
    worth=0;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.target = null;
      this.landing = null;
      this.worth = 0;
    }

    // Closest approach from a point to the segment a->b, squared. Testing the
    // segment rather than an angle is the whole point: it catches a hazard
    // wherever on the push it sits, and refuses one beyond the travel.
    _segmentDistance2(px, py, ax, ay, bx, by) {
      const dx = bx - ax;
      const dy = by - ay;
      const length2 = dx * dx + dy * dy;
      let t = length2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / length2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - (ax + t * dx);
      const ey = py - (ay + t * dy);
      return ex * ex + ey * ey;
    }

    // One hit's carry. The item table already holds the finished distance per
    // weapon, so the impulse and the decay are not re-derived here.
    _travel(primary, withTurret) {
      const travel = DataHandler_default.getWeapon(primary).knockback || 0;
      if (travel <= 0) {
        return 0;
      }
      return travel + (withTurret ? KB_STRIKE_TURRET_TRAVEL : 0);
    }

    // What the push line runs through, and what that is worth.
    _readPath(target, dir, travel) {
      const {ObjectManager: ObjectManager2, PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      const from = target.pos.future;
      const toX = from.x + Math.cos(dir) * travel;
      const toY = from.y + Math.sin(dir) * travel;
      const ids = ObjectManager2.grid2D.queryFull((from.x + toX) / 2, (from.y + toY) / 2, KB_STRIKE_CELLS);
      const reach = target.collisionScale;
      const allowTrap = Settings_default._knockbackStrikeTrap;
      let worth = 0;
      let landing = null;
      let bestWorth = 0;
      let found = 0;
      for (const id of ids) {
        const object = ObjectManager2.objects.get(id);
        if (!object) {
          continue;
        }
        const isBuild = object instanceof PlayerObject;
        if (isBuild && PlayerManager2.isEnemyByID(object.ownerID, myPlayer)) {
          continue;
        }
        const isTrap = isBuild && object.type === 15;
        if (isTrap && !allowTrap) {
          continue;
        }
        if (!isTrap && !(isBuild ? object.isSpike : object.isCactus)) {
          continue;
        }
        const pos = object.pos.current;
        // A trap catches at its own radius, not at the collision radius its
        // colDiv leaves behind — pit trap is scale 50 with colDiv 0.2, so
        // collisionScale would put the catch at 10 and miss every time.
        const radius = (isTrap ? KB_STRIKE_TRAP_CATCH : object.collisionScale) + reach;
        if (this._segmentDistance2(pos.x, pos.y, from.x, from.y, toX, toY) > radius * radius) {
          continue;
        }
        const value = isTrap ? KB_STRIKE_TRAP_WORTH : object.getDamage();
        if (value <= 0) {
          continue;
        }
        found++;
        // Only the first landing is certain; anything further along the line
        // depends on them still travelling, so it is worth a fraction.
        worth += found > 1 ? value * KB_STRIKE_CHAIN : value;
        if (value > bestWorth) {
          bestWorth = value;
          landing = object;
        }
      }
      return {
        worth: worth,
        landing: landing
      };
    }

    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      this.target = null;
      this.landing = null;
      this.worth = 0;
      if (!Settings_default._knockbackStrike || ModuleHandler.moduleActive || EnemyManager2.shouldIgnoreModule()) {
        return;
      }
      const {reloading: reloading} = ModuleHandler.staticModules;
      if (!reloading.isReloaded(0)) {
        return;
      }
      const primary = myPlayer.getItemByType(0);
      if (primary === null) {
        return;
      }
      const turretReady = ModuleHandler.hasStoreItem(0, 53) && reloading.isReloaded(2);
      const travel = this._travel(primary, turretReady);
      if (travel <= 0) {
        return;
      }
      const weaponRange = DataHandler_default.getWeapon(primary).range;
      const myPos = myPlayer.pos.current;
      let bestWorth = KB_STRIKE_MIN_WORTH;
      let bestTarget = null;
      let bestLanding = null;
      let bestAngle = 0;
      for (const enemy of PlayerManager2.enemies) {
        if (enemy.isTrapped) {
          continue;
        }
        if (!myPlayer.collidingEntity(enemy, weaponRange + enemy.hitScale)) {
          continue;
        }
        const dir = myPos.angle(enemy.pos.future);
        const read = this._readPath(enemy, dir, travel);
        if (read.worth <= bestWorth) {
          continue;
        }
        bestWorth = read.worth;
        bestTarget = enemy;
        bestLanding = read.landing;
        bestAngle = dir;
      }
      if (bestTarget === null) {
        return;
      }
      this.target = bestTarget;
      this.landing = bestLanding;
      this.worth = bestWorth;
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = bestAngle;
      // The turret is free knockback and free damage on the same tick, so it
      // is worn when it is up — the travel above was measured with it.
      if (turretReady) {
        ModuleHandler.forceHat = 53;
      }
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
    }
  }
`;

edit(
  "kb strike: replace the TrapKB class",
  `  class TrapKB {
    moduleName="trapKB";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      const nearestEnemy = EnemyManager2.nearestKBTrapEnemy;
      if (nearestEnemy === null || nearestEnemy.isTrapped || ModuleHandler.moduleActive || EnemyManager2.shouldIgnoreModule() || !Settings_default._trapKB) {
        return;
      }
      const pos1 = myPlayer.pos.current;
      const pos2 = nearestEnemy.pos.current;
      const angle = pos1.angle(pos2);
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primaryReloaded = reloading.isReloaded(0);
      const turretReloaded = ModuleHandler.hasStoreItem(0, 53) && reloading.isReloaded(2);
      if (!primaryReloaded) {
        return;
      }
      const range = DataHandler_default.getWeapon(myPlayer.getItemByType(0)).range + nearestEnemy.hitScale;
      if (!myPlayer.collidingSimple(nearestEnemy, range)) {
        return;
      }
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      if (turretReloaded) {
        ModuleHandler.forceHat = 53;
      }
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
    }
  }
`,
  KB_STRIKE_CLASS
);

edit(
  "kb strike: drop the EnemyManager pit-trap scan",
  `          if (!target.isTrapped && isEnemyObject && object.type === 15 && this.isNear(target, this.nearestKBTrapEnemy)) {
            const KBDistance = myPlayer.getActualMaxKnockback(target);
            const trapScale = object.collisionScale + target.collisionScale;
            const angleToEnemy = pos1.angle(pos2);
            const angleToSpike = pos1.angle(pos3);
            const distanceToTrap1 = pos1.distance(pos3);
            const offset = Math.asin(2 * trapScale / (2 * distanceToTrap1));
            const angleDistance = getAngleDist(angleToEnemy, angleToSpike);
            const intersecting = angleDistance <= offset;
            const overlapping = distanceToTarget <= distanceToTrap1;
            const inRange2 = KBDistance !== 0 && target.collidingObject(object, KBDistance);
            if (intersecting && overlapping && inRange2) {
              if (this.nearestKBTrap === null) {
                this.nearestKBTrapEnemy = target;
                this.nearestKBTrap = object;
              } else {
                const pos4 = this.nearestKBTrap.pos.current;
                const angle1 = pos2.angle(pos3);
                const angle2 = pos1.angle(pos3);
                const angle3 = pos2.angle(pos4);
                const angle4 = pos1.angle(pos4);
                const angleDist1 = getAngleDist(angle1, angle2);
                const angleDist2 = getAngleDist(angle3, angle4);
                if (angleDist1 < angleDist2) {
                  this.nearestKBTrapEnemy = target;
                  this.nearestKBTrap = object;
                }
              }
            }
          }
`,
  ""
);

edit(
  "kb strike: drop the EnemyManager pit-trap fields",
  `    nearestKBTrapEnemy=null;
    nearestKBTrap=null;
`,
  ""
);

edit(
  "kb strike: drop the EnemyManager pit-trap reset",
  `      this.nearestKBTrapEnemy = null;
      this.nearestKBTrap = null;
`,
  ""
);

edit(
  "kb strike: module registration",
  `        trapKB: new TrapKB(client2),`,
  `        knockbackStrike: new KnockbackStrike(client2),`
);

edit(
  "kb strike: module run order",
  `this.staticModules.trapKB, `,
  `this.staticModules.knockbackStrike, `
);

edit(
  "kb strike: settings keys",
  `    _trapKB: true,`,
  `    _knockbackStrike: true,
    _knockbackStrikeTrap: true,`
);

edit(
  "kb strike: default-on preset",
  `"_toolSpearInsta", "_trapKB", "_turretSteal"`,
  `"_toolSpearInsta", "_knockbackStrike", "_knockbackStrikeTrap", "_turretSteal"`
);

replaceInPage(
  "Combat_default",
  `            <div class="content-option">\r
                <label class="option-title" for="_trapKB">Trap KB</label>\r
                <label class="switch-checkbox">\r
                    <input id="_trapKB" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
            </div>\r
`,
  `            <div class="content-option">\r
                <label class="option-title" for="_knockbackStrike">KB Strike</label>\r
                <label class="switch-checkbox">\r
                    <input id="_knockbackStrike" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Hits when the recoil would carry them onto one of your spikes or traps.</span>\r
            </div>\r
            <div class="sub-options">\r
            <div class="content-option">\r
                <label class="option-title" for="_knockbackStrikeTrap">KB Strike (trap)</label>\r
                <label class="switch-checkbox">\r
                    <input id="_knockbackStrikeTrap" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Counts your pit traps as a landing spot, not just spikes.</span>\r
            </div>\r
            </div>\r
`,
  "kb strike: menu entries"
);


/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
