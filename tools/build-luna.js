#!/usr/bin/env node
/*
 * build-luna.js
 *
 * Builds Luna_Client.user.js: the Luna 1.1 client (src/Luna_Client_1.1_fixed.js,
 * the build that speaks the current protocol) with Ryn Type 2's Music page and
 * Ryn's LRC AI module ported into its menu.
 *
 * The page itself lives in src/luna-music/ as plain files — markup,
 * stylesheet, the player and LRC AI — and is spliced in here, so it can be
 * read and edited on its own instead of as a string buried in a 20k-line
 * bundle.
 *
 *   node tools/build-luna.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Luna_Client_1.1_fixed.js");
const MUSIC = path.join(ROOT, "src/luna-music");
const OUT = path.join(ROOT, "Luna_Client.user.js");

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

edit(
  "header: description",
  "// @description     Luna 1.1 fixed by raptor",
  "// @description     Luna 1.1 fixed by raptor, with Ryn Type 2's Music page and LRC AI"
);
edit("header: version", "// @version         1.1", "// @version         1.5");

/* ------------------------------------------------------------------ *
 * 2. Chat bridge, exported from app.js
 *
 * The menu is built by a separate IIFE after the webpack bundle, so it has no
 * reach into app.js's scope. Luna already hands the outside world what it
 * needs through window.* at the end of app.js ("EXPORT VALUES"); the Music
 * page gets its three entry points the same way. Sending goes through Luna's
 * own sendChat(), so it is the exact packet the chat box sends.
 * ------------------------------------------------------------------ */

edit(
  "app.js: music chat bridge",
  "            window.config = config;\n",
  `            window.config = config;

            // MUSIC PAGE CHAT BRIDGE:
            // The menu is built outside this module, so the Music page reaches
            // chat through here rather than holding io itself.
            window.__lunaMusicChat = {
                send: function (message) {
                    if (!socketReady() || !inGame || !myPlayer || !myPlayer.alive) return false;
                    sendChat(String(message));
                    return true;
                },
                status: function () {
                    var socket = io.socket;
                    return {
                        socket: socket ? ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][socket.readyState] : "NO_SOCKET",
                        handshake: !!(io.connected && io.socketId !== -1),
                        inGame: !!(inGame && myPlayer && myPlayer.alive)
                    };
                },
                ping: function () {
                    return window.pingTime || 0;
                }
            };
`
);

/* ------------------------------------------------------------------ *
 * 3. The Music page module
 * ------------------------------------------------------------------ */

const css = fs.readFileSync(path.join(MUSIC, "music.css"), "utf8");
const html = fs.readFileSync(path.join(MUSIC, "music.html"), "utf8");
let player = fs.readFileSync(path.join(MUSIC, "music-player.js"), "utf8");

for (const [token, value] of [["__LUNA_MUSIC_CSS__", css], ["__LUNA_MUSIC_HTML__", html]]) {
  const hits = player.split(token).length - 1;
  if (hits !== 1) throw new Error(`music-player.js: expected one ${token}, found ${hits}`);
  player = player.replace(token, () => JSON.stringify(value));
}

/* Ryn's LRC AI module, attached to the player the way Ryn attaches it: right
 * after the player is defined, so its wrappers are in place before the page's
 * first render and first play. A failure to attach leaves the player working
 * without it. */
const lrcAi = fs.readFileSync(path.join(MUSIC, "lrc-ai.js"), "utf8");
const attachLrc = `
try {
  RynLRC.attach(LunaMusic.player);
} catch (e) {
  try { console.warn("[RynLRC] attach failed:", e); } catch (_) {}
}
`;

edit(
  "menu: music module + LRC AI",
  "(function () {\n    'use strict';\n\n    const STORAGE_KEY = \"DELTEK_V4_CONFIG\";",
  player + "\n" + lrcAi + attachLrc + "\n(function () {\n    'use strict';\n\n    const STORAGE_KEY = \"DELTEK_V4_CONFIG\";"
);

/* ------------------------------------------------------------------ *
 * 4. Menu wiring
 * ------------------------------------------------------------------ */

/* The menu is a 620px grid with no row template, so its single implicit row
 * sizes to its content: a page taller than the menu pushes .deltek-main past
 * the bottom edge, where the root's overflow:hidden clips it, and nothing ever
 * scrolls. Luna's own tabs are short enough not to show it; the Music page is
 * not. Pinning the row to the menu's height lets the page scroll in place. */
edit(
  "menu: bounded grid row",
  "        display: grid; grid-template-columns: 240px 1fr;\n",
  "        display: grid; grid-template-columns: 240px 1fr; grid-template-rows: minmax(0, 1fr);\n"
);

/* Preferences the page keeps between sessions, stored with the rest of
 * Luna's settings. Chat sync is deliberately not one of them. */
edit(
  "menu: music defaults",
  '        chatMsg2: "this doesnt work rn",\n',
  `        chatMsg2: "this doesnt work rn",

        // Music
        musicVolume: 70,
        musicLoop: false,
        musicShuffle: false,
        musicSyncDelay: 0,
        musicAutoDelay: true,
`
);

edit(
  "menu: music tab",
  "</svg>misc</div>\n",
  `</svg>misc</div>
                    <div class="nav-item" data-tab="music"><svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V7h4V3h-6z"/></svg>music</div>
`
);

edit(
  "menu: mount music page",
  "    const searchInput = document.querySelector('.search-input');\n",
  `    const searchInput = document.querySelector('.search-input');

    // MUSIC PAGE (ported from Ryn Type 2). It is built once and kept, so a
    // half-filled form or an open section survives switching tabs.
    LunaMusic.mount(document.querySelector('.deltek-main'), {
        get: (key, fallback) => (key in window.vars ? window.vars[key] : fallback),
        set: (key, value) => { window.vars[key] = value; saveConfig(); }
    });
`
);

edit(
  "menu: render music tab",
  "    function render(tab, searchResults = null) {\n        content.innerHTML = '';\n",
  `    function render(tab, searchResults = null) {
        if (!searchResults && tab === 'music') {
            headerTitle.innerText = 'Music Player';
            currentTab = tab;
            content.style.display = 'none';
            LunaMusic.show();
            return;
        }
        LunaMusic.hide();
        content.style.display = '';
        content.innerHTML = '';
`
);

/* ------------------------------------------------------------------ *
 * 5. Auto grind (Ryn Type 2's AutoGrind, ported)
 *
 * Replaces Luna's "dynamic farm". The logic lives in
 * src/luna-grind/auto-grind.js and is placed inside app.js, next to the hat
 * logic it feeds, because it works on app.js's own state (myPlayer,
 * visibleObjects, the reload arrays, the auto placer).
 * ------------------------------------------------------------------ */

/* Replace the text between two markers that each occur exactly once. */
function replaceBetween(label, startMarker, endMarker, replacement) {
  const a = code.split(startMarker).length - 1;
  const b = code.split(endMarker).length - 1;
  if (a !== 1 || b !== 1) throw new Error(`markers not unique (${a}, ${b}): ${label}`);
  const start = code.indexOf(startMarker);
  const end = code.indexOf(endMarker);
  if (end < start) throw new Error(`markers out of order: ${label}`);
  code = code.slice(0, start) + replacement + code.slice(end);
  applied.push(label);
}

const grind = fs.readFileSync(path.join(ROOT, "src/luna-grind/auto-grind.js"), "utf8");

edit(
  "grind: hat state",
  "let grindAngle = null;\n",
  "let grindAngle = null;\nlet grindHat = null;\n"
);

/* Luna skipped a grind angle of exactly 0 (aiming straight right) and fell
 * back to the mouse — one of the ways its grind swung at nothing. */
edit(
  "grind: angle 0 is an angle",
  "                    if (gatherGrind && grindAngle) {\n",
  "                    if (gatherGrind && grindAngle !== null) {\n"
);

/* The key now flips the same setting as the menu switch, as in Ryn. */
edit(
  "grind: key toggles the setting",
  "                            gPressed = !gPressed;\n",
  `                            window.vars.autoGrind = !window.vars.autoGrind;
                            window.dispatchEvent(new CustomEvent("luna-vars-changed", { detail: "autoGrind" }));
`
);

replaceBetween(
  "grind: tick runs Ryn's auto grind",
  "                        // AUTOGRIND\n",
  "\n\n\n\n// --- KILL DETECTION & AUTO STOP ---",
  `                        // AUTOGRIND (Ryn Type 2's AutoGrind — see lunaAutoGrind)
                        grindAngle = null;
                        gatherGrind = false;
                        grindHat = null;
                        grindObjects = [];
                        lunaAutoGrind();
`
);

edit(
  "grind: module",
  "            function hatFc() {\n",
  grind + "\n            function hatFc() {\n"
);

/* Ryn forces the grind hat: tank, or none while the primary is being set up
 * for the kill. A real threat (soldier) still wins, as before. */
edit(
  "grind: hat",
  "                if (isBoughtHat(6, 0)) {\n                    if (soldierAnti) {\n",
  `                // AUTO GRIND
                if (gatherGrind && grindHat !== null) {
                    currentHat = grindHat;
                }

                if (isBoughtHat(6, 0)) {
                    if (soldierAnti) {
`
);

/* Luna only re-sends its facing when it is off by more than 0.3 rad (17°).
 * While grinding the swing has to land where it was aimed, so it follows
 * closely. */
edit(
  "grind: precise facing",
  "                            if (Math.abs(myPlayer.d2 - angle) > 0.3) {\n",
  "                            if (Math.abs(myPlayer.d2 - angle) > (gatherGrind ? 0.02 : 0.3)) {\n"
);

edit(
  "grind: settings",
  "        // Utilities\n        autoBuy: true,\n",
  `        // Utilities
        autoBuy: true,
        autoGrind: false,
        autoGrindTargetPrimary: "ruby",
        autoGrindTargetSecondary: "ruby",
`
);

edit(
  "grind: keybind label",
  `{ type: 'keybind', name: "dynamic farm", id: "keyAutoGrind" }`,
  `{ type: 'keybind', name: "auto grind", id: "keyAutoGrind" }`
);

edit(
  "grind: menu section",
  `                title: "ACTIONS",
                items: [
                    { type: 'toggle', name: "autobuy", id: "autoBuy" },
                ]
            }
`,
  `                title: "ACTIONS",
                items: [
                    { type: 'toggle', name: "autobuy", id: "autoBuy" },
                ]
            },
            {
                title: "Auto Grind",
                items: [
                    { type: 'toggle', name: "auto grind", id: "autoGrind" },
                    { type: 'select', name: "grind until (primary)", id: "autoGrindTargetPrimary", options: [["gold", "Gold"], ["diamond", "Diamond"], ["ruby", "Ruby"]] },
                    { type: 'select', name: "grind until (secondary)", id: "autoGrindTargetSecondary", options: [["gold", "Gold"], ["diamond", "Diamond"], ["ruby", "Ruby"]] }
                ]
            }
`
);

/* Luna's menu had no dropdown; the grind targets need one. */
edit(
  "menu: select control",
  "                // KEYBIND (NEW)\n",
  `                // SELECT
                else if (item.type === 'select') {
                    const row = document.createElement('div');
                    row.className = 'feature-row';
                    row.innerHTML = \`<span class="feat-label">\${item.name}</span>\`;

                    const select = document.createElement('select');
                    select.className = 'select-styled';
                    item.options.forEach(([value, label]) => {
                        const option = document.createElement('option');
                        option.value = value;
                        option.textContent = label;
                        select.appendChild(option);
                    });
                    select.value = window.vars[item.id];

                    select.onchange = () => {
                        window.vars[item.id] = select.value;
                        saveConfig(); // SAVE
                        select.blur();
                    };

                    row.appendChild(select);
                    itemsContainer.appendChild(row);
                }
                // KEYBIND (NEW)
`
);

edit(
  "menu: select style",
  "    .text-input-styled:focus {",
  `    .select-styled {
        background: var(--bg-input);
        border: 1px solid var(--border);
        color: #fff; padding: 6px 10px;
        font-size: 12px; border-radius: 6px;
        font-family: 'JetBrains Mono', monospace;
        cursor: pointer; transition: 0.2s;
    }
    .select-styled:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-dim); }
    .select-styled option { background: #14141c; color: #fff; }

    .text-input-styled:focus {`
);

/* ------------------------------------------------------------------ *
 * 6. FPS / Ping counter (top centre)
 * ------------------------------------------------------------------ */

edit(
  "counter: count rendered frames",
  "                updateGame();\n",
  "                updateGame();\n                window.__lunaFrames = (window.__lunaFrames || 0) + 1;\n"
);

edit(
  "counter: setting",
  "        // Visuals\n",
  "        // Visuals\n        hudCounter: true,\n"
);

edit(
  "counter: menu toggle",
  `                    { type: 'toggle', name: "mill rotation", id: "millRotation" }
`,
  `                    { type: 'toggle', name: "mill rotation", id: "millRotation" }
                ]
            },
            {
                title: "HUD",
                items: [
                    { type: 'toggle', name: "fps & ping counter", id: "hudCounter" }
`
);

const counter = fs.readFileSync(path.join(ROOT, "src/luna-hud/counter.js"), "utf8");
edit(
  "counter: module + grind key sync",
  "    render('keybinds');\n",
  counter + `
    // A setting flipped from outside the menu (the auto grind key): save it,
    // and redraw the tab if it is the one showing that setting.
    window.addEventListener('luna-vars-changed', () => {
        saveConfig();
        if (currentTab === 'utilities' && !searchInput.value) render('utilities');
    });

    render('keybinds');
`
);

fs.writeFileSync(OUT, code);
console.log(`wrote ${path.relative(ROOT, OUT)} (${code.length} bytes)`);
for (const a of applied) console.log("  - " + a);
