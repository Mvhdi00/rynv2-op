#!/usr/bin/env node
/*
 * build-luna.js
 *
 * Builds Luna_Client.user.js: the Luna 1.1 client (src/Luna_Client_1.1_fixed.js,
 * the build that speaks the current protocol) with Ryn Type 2's Music page and
 * its LRC AI lyrics module ported into its menu.
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
edit("header: version", "// @version         1.1", "// @version         1.3");

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

/* LRC AI attaches to the player before the menu exists, so its wrappers are in
 * place before the page's first render and first play — the same order Ryn
 * wires it in. A failure to attach leaves the player working without it. */
const lrcAi = fs.readFileSync(path.join(MUSIC, "lrc-ai.js"), "utf8");
const attach = `
try {
  LunaLRC.attach(LunaMusic.player);
} catch (e) {
  try { console.warn("[LunaLRC] attach failed:", e); } catch (_) {}
}
`;

edit(
  "menu: music module + LRC AI",
  "(function () {\n    'use strict';\n\n    const STORAGE_KEY = \"DELTEK_V4_CONFIG\";",
  player + "\n" + lrcAi + attach + "\n(function () {\n    'use strict';\n\n    const STORAGE_KEY = \"DELTEK_V4_CONFIG\";"
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
        musicLrcAuto: true,
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

fs.writeFileSync(OUT, code);
console.log(`wrote ${path.relative(ROOT, OUT)} (${code.length} bytes)`);
for (const a of applied) console.log("  - " + a);
