#!/usr/bin/env node
/*
 * build-pathbreak.js
 *
 * Builds RYN_PathBreak.user.js from RYN Client v5 (the Luna-placer variant) by
 * folding in Path Break: tick-accurate pathfinding that breaks through what
 * blocks it.
 *
 * v5 ships `ModuleHandler.followPath` and `ModuleHandler.endTarget` — a
 * minimap click sets them and the minimap draws a marker for them — but no
 * code anywhere reads them to move the player. The pathfinder v4 had
 * (`LunaPathfinder`) was dropped from v5 and nothing replaced it, so the
 * marker is all that is left of the feature. Path Break fills that hole.
 *
 * The implementation lives in src/pathbreak.js and is spliced in verbatim, so
 * it can be read and syntax-checked on its own.
 *
 *   node tools/build-pathbreak.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/RYN_Client_v5.js");
const FEATURE = path.join(ROOT, "src/pathbreak.js");
const OUT = path.join(ROOT, "RYN_PathBreak.user.js");

let code = fs.readFileSync(BASE, "utf8");
const feature = fs.readFileSync(FEATURE, "utf8").replace(/\s*$/, "\n");
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

/* The menu pages are HTML kept as JS string literals. Writing the markup as
 * plain text and escaping it here keeps the patch readable. */
function asLiteral(html) {
  return JSON.stringify(html).slice(1, -1);
}

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 *
 * A separate @name so this installs alongside a stock v5 rather than
 * silently replacing it.
 * ------------------------------------------------------------------ */

const header = `// ==UserScript==
// @name            ! RYN Client v5 - Path Break
// @namespace       ryn-pathbreak
// @author          By : Raptor - Path Break build
// @description     RYN Client v5 with tick-accurate pathfinding that breaks through what blocks it
// @icon            https://i.postimg.cc/d0mMvHYF/ryn5.webp
// @version         v5-pathbreak
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
  applied.push("header: rewritten for the Path Break build");
}

/* ------------------------------------------------------------------ *
 * 2. Drop the phone-home beacon
 *
 * v5 opens with a fetch to a webhook.site endpoint on first run, gated by a
 * localStorage flag. It carries nothing but the hit itself, but it is an
 * unannounced call to a third party, it fires before anything else, and
 * nothing in the client needs it. Same call ReUp Mix makes on v4.
 * ------------------------------------------------------------------ */

{
  const beacon = code.match(
    /\(function\(\) \{\s*try \{\s*if \(!localStorage\.getItem\("_ryn_sent"\)\)[\s\S]*?\}\)\(\);\s*/
  );
  if (!beacon) throw new Error("anchor not found: webhook beacon");
  code = code.replace(
    beacon[0],
    "/* removed in the Path Break build: RYN v5's first-run beacon to webhook.site */\n\n"
  );
  applied.push("privacy: removed first-run webhook.site beacon");
}

/* ------------------------------------------------------------------ *
 * 3. Settings
 *
 * _pathBreakAvoidSpikes defaults on so the search and Safe Walk agree about
 * what is walkable. With it off, the search will happily plan a route across
 * an enemy spike and Safe Walk will then refuse to send the move, which reads
 * as the pathfinder freezing.
 * ------------------------------------------------------------------ */

edit(
  "settings: path break toggles",
  `    _autobreak: true,
    _safeWalk: true,`,
  `    _autobreak: true,
    _pathBreak: true,
    _pathBreakObstacles: true,
    _pathBreakAvoidSpikes: true,
    _pathBreakRender: true,
    _safeWalk: true,`
);

/* KeyG is Aurora's pathfinder key, but v5 already binds it to the spawn pad,
 * so the default moves to KeyN. It is rebindable either way. */
edit(
  "settings: path break hotkey",
  `    _instakill: "KeyR",`,
  `    _instakill: "KeyR",
    _pathBreakKey: "KeyN",`
);

/* ------------------------------------------------------------------ *
 * 4. Combat menu — Utility section
 * ------------------------------------------------------------------ */

const AUTOBREAK_OPTION = asLiteral(
  `            <div class="content-option">\r
                <label class="option-title" for="_autobreak">Autobreak</label>\r
                <label class="switch-checkbox">\r
                    <input id="_autobreak" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
            </div>\r
`
);

const PATHBREAK_OPTIONS = asLiteral(
  `            <div class="content-option">\r
                <label class="option-title" for="_pathBreak">Path Break</label>\r
                <label class="switch-checkbox">\r
                    <input id="_pathBreak" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Walks you to a point on the map and breaks what is in the way. Press the Path Break key to route to your cursor, or click the minimap.</span>\r
            </div>\r
            <div class="sub-options">\r
            <div class="content-option">\r
                <label class="option-title" for="_pathBreakObstacles">Break obstacles</label>\r
                <label class="switch-checkbox">\r
                    <input id="_pathBreakObstacles" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_pathBreakAvoidSpikes">Avoid spikes</label>\r
                <label class="switch-checkbox">\r
                    <input id="_pathBreakAvoidSpikes" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_pathBreakRender">Show path</label>\r
                <label class="switch-checkbox">\r
                    <input id="_pathBreakRender" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
            </div>\r
            </div>\r
`
);

edit("menu: Path Break options in Combat > Utility", AUTOBREAK_OPTION, AUTOBREAK_OPTION + PATHBREAK_OPTIONS);

/* ------------------------------------------------------------------ *
 * 5. Keybinds menu — Controls section
 * ------------------------------------------------------------------ */

const INSTAKILL_TILE = asLiteral(
  `            <div class="content-option key-tile">
                <span class="option-title">Instakill</span>
                <button id="_instakill" class="hotkeyInput"></button>
            </div>
`
);

const PATHBREAK_TILE = asLiteral(
  `            <div class="content-option key-tile">
                <span class="option-title">Path Break</span>
                <button id="_pathBreakKey" class="hotkeyInput"></button>
            </div>
`
);

edit("menu: Path Break hotkey tile", INSTAKILL_TILE, INSTAKILL_TILE + PATHBREAK_TILE);

/* ------------------------------------------------------------------ *
 * 6. The feature itself
 *
 * Ahead of ModuleHandler, so the class is defined by the time the handler's
 * constructor instantiates it.
 * ------------------------------------------------------------------ */

edit("feature: PathBreak module + worker + overlay", "  class ModuleHandler {", feature + "  class ModuleHandler {");

/* ------------------------------------------------------------------ *
 * 7. Register the module
 *
 * Ordered immediately before safeWalk. Path Break issues the move for the
 * tick; safeWalk gets the last word on whether that move is survivable, as it
 * does for every other module that moves the player.
 * ------------------------------------------------------------------ */

edit(
  "module: staticModules entry",
  "        safeWalk: new SafeWalk(client2),",
  `        pathBreak: new PathBreak(client2),
        safeWalk: new SafeWalk(client2),`
);

edit(
  "module: tick order before safeWalk",
  "this.staticModules.safeWalk, this.staticModules.guardModule",
  "this.staticModules.pathBreak, this.staticModules.safeWalk, this.staticModules.guardModule"
);

/* ------------------------------------------------------------------ *
 * 8. Hotkey — route to the cursor, press again to cancel
 * ------------------------------------------------------------------ */

edit(
  "input: Path Break hotkey",
  `      if (event.code === Settings_default._instakill) {
        this.instaToggle = !this.instaToggle;
      }`,
  `      if (event.code === Settings_default._instakill) {
        this.instaToggle = !this.instaToggle;
      }
      if (event.code === Settings_default._pathBreakKey && Settings_default._pathBreakKey !== "" && Settings_default._pathBreak) {
        const cursor = this.cursorPosition(true);
        ModuleHandler.staticModules.pathBreak.toggleTarget(cursor.x, cursor.y);
      }`
);

/* ------------------------------------------------------------------ *
 * 9. Walking cancels the route
 *
 * Without this the player and the pathfinder both write move_dir every tick
 * and the pathfinder wins, so holding W does nothing until the route ends.
 * Touching a movement key is the clearest possible "I'll take it from here".
 * ------------------------------------------------------------------ */

edit(
  "input: a movement key cancels the route",
  `    handleMovement() {
      const angle = getAngleFromBitmask(this.move, false);`,
  `    handleMovement() {
      const {pathBreak: pathBreak} = this.client._ModuleHandler.staticModules;
      if (pathBreak.active && this.move !== 0) {
        pathBreak.stop(false);
      }
      const angle = getAngleFromBitmask(this.move, false);`
);

/* ------------------------------------------------------------------ *
 * 10. Minimap click
 *
 * This is the click that already sets endTarget and followPath. With Path
 * Break on it now starts a route to the clicked point; with it off the
 * behaviour is exactly what it was.
 * ------------------------------------------------------------------ */

edit(
  "input: minimap click starts a route",
  `        client._ModuleHandler.endTarget._setXY(posX, posY);
        client._ModuleHandler.followPath = true;`,
  `        if (Settings_default._pathBreak && client.myPlayer.inGame) {
          client._ModuleHandler.staticModules.pathBreak.setTarget(posX, posY);
        } else {
          client._ModuleHandler.endTarget._setXY(posX, posY);
          client._ModuleHandler.followPath = true;
        }`
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log(`wrote ${path.relative(ROOT, OUT)} (${code.split("\n").length} lines)`);
for (const label of applied) console.log(`  - ${label}`);
