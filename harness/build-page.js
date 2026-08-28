/* Builds a mock moomoo.io page good enough to run the client against.
 *
 * The real page is not checked in, so this synthesises one from the element ids
 * the game bundle and the client actually reach for, and serves the game
 * bundles from ../src. It reproduces load order and script types — the game
 * ships as an ES module, which is what makes its WebSocket capture race with a
 * userscript — but not layout or art.
 */
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const ROOT = path.resolve(HERE, "..");
const CLIENT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "whiteout/Whiteout_v4_1.user.js");

const sources = [
  fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8"),
  fs.readFileSync(CLIENT, "utf8"),
];

const ids = new Set();
for (const s of sources) {
  for (const m of s.matchAll(/getElementById\(\s*"([^"]+)"\s*\)/g)) ids.add(m[1]);
  for (const m of s.matchAll(/getEl\(\s*"([^"]+)"\s*\)/g)) ids.add(m[1]);
  for (const m of s.matchAll(/\$\(\s*"#([A-Za-z0-9_-]+)"/g)) ids.add(m[1]);
  for (const m of s.matchAll(/querySelector\(\s*"#([A-Za-z0-9_-]+)"\s*\)/g)) ids.add(m[1]);
}
// In the real index.html but only reached through a parent or class.
["adCard", "promoImgHolder", "promoImg", "menuChatDiv", "mChMain", "mChBox",
 "linksContainer", "gameName", "loadingText"].forEach((id) => ids.add(id));

const CANVAS = new Set(["gameCanvas", "mapDisplay"]);
const SELECT = new Set(["instaType", "predictType", "serverBrowser", "altServer",
  "mode", "spin", "musketSync", "antikick", "healMsg"]);
const INPUT = new Set(["nameInput", "chatBox", "allianceInput", "nativeResolution",
  "showPing", "playMusic", "rageMult", "rageRange"]);

function tag(id) {
  if (CANVAS.has(id)) return `<canvas id="${id}" width="1920" height="1080"></canvas>`;
  if (SELECT.has(id)) return `<select id="${id}"><option value="0">0</option><option value="1">1</option></select>`;
  if (INPUT.has(id)) return `<input id="${id}" type="text" value="">`;
  if (/-checkbox$/.test(id)) return `<input id="${id}" type="checkbox">`;
  if (/-text$/.test(id)) return `<input id="${id}" type="text" value="">`;
  return `<div id="${id}"></div>`;
}

const actionBar = Array.from({ length: 23 }, (_, i) => `<div id="actionBarItem${i}"></div>`).join("");

fs.writeFileSync(path.join(HERE, "index.html"), `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>mock moomoo</title>
<script src="/assets/jquery.js"></script>
<script src="/assets/frvr-stub.js"></script>
<script type="module" crossorigin src="/assets/index-f3a4c1ad.js"></script>
<style>
/* Not the real stylesheet — just the two elements whose *geometry* changes what
 * the client can do. The canvas has to fill the window or every screen-space
 * coordinate is off, and mouse input is bound to #touch-controls-fullscreen,
 * which in the real page is a transparent layer over the whole screen. Left in
 * normal flow it has no area, so no click ever reaches the client and the
 * harness reports actions as unsent that a player can perform perfectly well.
 * The menu stays above both so the Play button is still clickable. */
html, body { margin: 0; height: 100%; overflow: hidden; }
#gameCanvas { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; }
#touch-controls-fullscreen { position: fixed; inset: 0; z-index: 1; }
#menuCardHolder, #mainMenu, #enterGame, #nameInput, #serverBrowser, #altcha,
#turnstileWidget, #linksContainer { position: relative; z-index: 10; }
</style>
</head>
<body>
  ${[...ids].sort().map(tag).join("\n  ")}
  ${actionBar}
</body>
</html>
`);

fs.copyFileSync(path.join(ROOT, "src/game_index.js"), path.join(HERE, "assets/index-f3a4c1ad.js"));
fs.copyFileSync(path.join(ROOT, "src/game_vendor.js"), path.join(HERE, "assets/vendor-b760dbba.js"));
fs.copyFileSync(path.join(HERE, "node_modules/jquery/dist/jquery.js"), path.join(HERE, "assets/jquery.js"));

console.log("built mock page with " + ids.size + " elements");
