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
edit("header: version", "// @version         1.1", "// @version         1.7");

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
 * 5. Auto grind: Luna's own, with two changes
 *
 * Luna's AUTOGRIND block (the "dynamic farm" key, G) stays as it is: three
 * turrets 73° apart, the same aim, the same targets (secondary to gold,
 * primary to diamond), the same stop. Only two things change:
 *
 *   - the secondary (great hammer) is ground first, then the primary.
 *     Luna did the primary first — the hammer chipped and the primary took
 *     the kills until it was diamond — and only then gave the hammer kills;
 *   - the turrets go toward the mouse. Luna tried angles from 0° (straight
 *     right) in 10° steps and used the first where all three fit.
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

edit(
  "grind: secondary first, then primary",
  `                                    if (allOneshotByHammer && getPlayerInfo(myPlayer, "primaryVariant") < 2) {
                                        predictWeapon = myPlayer.weapons[0];
                                        grindAngle = findOptimalAngle(candidateTurrets);
                                    }
                                    else if (getPlayerInfo(myPlayer, "primaryVariant") < 2) {
                                        predictWeapon = myPlayer.weapons[1];
                                        let validTurrets = candidateTurrets.filter(turret => turret.health > hammerDmg);

                                        if (validTurrets.length > 0) {
                                            grindAngle = findOptimalAngle(validTurrets);
                                        }
                                    }
                                    else {
                                        predictWeapon = myPlayer.weapons[1];
                                        grindAngle = findOptimalAngle(candidateTurrets);
                                    }
`,
  `                                    // secondary first: the hammer takes the kills until it is gold
                                    if (getPlayerInfo(myPlayer, "secondaryVariant") < 1) {
                                        predictWeapon = myPlayer.weapons[1];
                                        grindAngle = findOptimalAngle(candidateTurrets);
                                    }
                                    // then the primary: the hammer chips, the primary takes the kills until it is diamond
                                    else if (allOneshotByHammer && getPlayerInfo(myPlayer, "primaryVariant") < 2) {
                                        predictWeapon = myPlayer.weapons[0];
                                        grindAngle = findOptimalAngle(candidateTurrets);
                                    }
                                    else if (getPlayerInfo(myPlayer, "primaryVariant") < 2) {
                                        predictWeapon = myPlayer.weapons[1];
                                        let validTurrets = candidateTurrets.filter(turret => turret.health > hammerDmg);

                                        if (validTurrets.length > 0) {
                                            grindAngle = findOptimalAngle(validTurrets);
                                        }
                                    }
`
);

edit(
  "grind: turrets toward the mouse",
  `                                    for (let i = 0; i < 36; i++) {
                                        const angle = UTILS.toRad(i * (360 / 36));
                                        if (canPlace(myPlayer.items[5], angle) &&
                                            canPlace(myPlayer.items[5], angle - UTILS.toRad(73)) &&
                                            canPlace(myPlayer.items[5], angle + UTILS.toRad(73))) {
                                                grindObjects.push({
                                                    id: myPlayer.items[5],
                                                    angle: angle,
                                                    preplace: false
                                                });
                                                grindObjects.push({
                                                    id: myPlayer.items[5],
                                                    angle: angle - UTILS.toRad(73),
                                                    preplace: false
                                                });
                                                grindObjects.push({
                                                    id: myPlayer.items[5],
                                                    angle: angle + UTILS.toRad(73),
                                                    preplace: false
                                                });
                                                break;
                                        }
                                    }
`,
  `                                    // toward the mouse
                                    const angle = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
                                    if (canPlace(myPlayer.items[5], angle) &&
                                        canPlace(myPlayer.items[5], angle - UTILS.toRad(73)) &&
                                        canPlace(myPlayer.items[5], angle + UTILS.toRad(73))) {
                                            grindObjects.push({
                                                id: myPlayer.items[5],
                                                angle: angle,
                                                preplace: false
                                            });
                                            grindObjects.push({
                                                id: myPlayer.items[5],
                                                angle: angle - UTILS.toRad(73),
                                                preplace: false
                                            });
                                            grindObjects.push({
                                                id: myPlayer.items[5],
                                                angle: angle + UTILS.toRad(73),
                                                preplace: false
                                            });
                                    }
`
);

/* ------------------------------------------------------------------ *
 * 6. Biome colours back to the game's own
 *
 * Luna repainted the ground: grass white, desert #A9B8EC, and the river in
 * two reds. These are the game's values, branch for branch, from its
 * background pass in src/game_index.js: grass #b6db66, desert #dbc666,
 * snow #fff, river bank #dbc666 and water #91b2db — and the game's own
 * blue-tinted overlay on top of them.
 * ------------------------------------------------------------------ */

replaceBetween(
  "biomes: game colours",
  "                    // RENDER BACKGROUND:\n",
  "                    // RENDER GRID:\n",
  `                    // RENDER BACKGROUND (the game's own colours):
                    if (config.snowBiomeTop - yOffset <= 0 && config.mapScale - config.snowBiomeTop - yOffset >= maxScreenHeight) {
                        mainContext.fillStyle = "#b6db66";
                        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
                    } else if (config.mapScale - config.snowBiomeTop - yOffset <= 0) {
                        mainContext.fillStyle = "#dbc666";
                        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
                    } else if (config.snowBiomeTop - yOffset >= maxScreenHeight) {
                        mainContext.fillStyle = "#fff";
                        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
                    } else if (config.snowBiomeTop - yOffset >= 0) {
                        mainContext.fillStyle = "#fff";
                        mainContext.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - yOffset);
                        mainContext.fillStyle = "#b6db66";
                        mainContext.fillRect(0, config.snowBiomeTop - yOffset, maxScreenWidth,
                            maxScreenHeight - (config.snowBiomeTop - yOffset));
                    } else {
                        mainContext.fillStyle = "#b6db66";
                        mainContext.fillRect(0, 0, maxScreenWidth,
                            (config.mapScale - config.snowBiomeTop - yOffset));
                        mainContext.fillStyle = "#dbc666";
                        mainContext.fillRect(0, (config.mapScale - config.snowBiomeTop - yOffset), maxScreenWidth,
                            maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
                    }

                    // RENDER WATER AREAS:
                    if (!firstSetup) {
                        waterMult += waterPlus * config.waveSpeed * delta;
                        if (waterMult >= config.waveMax) {
                            waterMult = config.waveMax;
                            waterPlus = -1;
                        } else if (waterMult <= 1) {
                            waterMult = waterPlus = 1;
                        }
                        mainContext.globalAlpha = 1;
                        mainContext.fillStyle = "#dbc666";
                        renderWaterBodies(xOffset, yOffset, mainContext, config.riverPadding);
                        mainContext.fillStyle = "#91b2db";
                        renderWaterBodies(xOffset, yOffset, mainContext, (waterMult - 1) * 250);
                    }

`
);

/* Over the ground Luna laid a black 15% gradient four times (about half the
 * light gone), which turned every colour above muddy. The game lays one
 * rgba(0, 0, 70, 0.35) over the whole screen, at this same point — after the
 * map edges, before names and health bars. */
replaceBetween(
  "biomes: game overlay",
  "// RENDER DAY/NIGHT TIME (Fixed - No more darkness)\n",
  "                    // FROM HERE",
  `                    // RENDER DAY/NIGHT TIME (the game's own overlay):
                    mainContext.globalAlpha = 1;
                    mainContext.fillStyle = "rgba(0, 0, 70, 0.35)";
                    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);

`
);

/* ------------------------------------------------------------------ *
 * 7. FPS / Ping counter (top centre)
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
  "counter: module",
  "    render('keybinds');\n",
  counter + `
    render('keybinds');
`
);

fs.writeFileSync(OUT, code);
console.log(`wrote ${path.relative(ROOT, OUT)} (${code.length} bytes)`);
for (const a of applied) console.log("  - " + a);
