// Add the Preplace / Replace rows to the Combat page and the two hotkey tiles
// to the Keybinds page. Both pages live inside JS string literals, so the HTML
// is spliced in already-escaped.
const path = require("path");
const fs = require("fs");
const p = path.resolve(__dirname, "..", "..", "RYN_Client_v5_OWNER.user.js");
let s = fs.readFileSync(p, "utf8");

const NL = "\\r\\n";
const I = "            ";

function toggle(id, label) {
  return (
    `${I}<div class=\\"content-option\\">${NL}` +
    `${I}    <label class=\\"option-title\\" for=\\"${id}\\">${label}</label>${NL}` +
    `${I}    <label class=\\"switch-checkbox\\">${NL}` +
    `${I}        <input id=\\"${id}\\" type=\\"checkbox\\"></input>${NL}` +
    `${I}        <span></span>${NL}` +
    `${I}    </label>${NL}` +
    `${I}</div>${NL}`
  );
}

function slider(id, label, step, min, max) {
  return (
    `${I}<div class=\\"content-option\\">${NL}` +
    `${I}    <span class=\\"option-title\\">${label}</span>${NL}` +
    `${I}    <label class=\\"slider\\">${NL}` +
    `${I}        <span class=\\"slider-value\\"></span>${NL}` +
    `${I}        <input id=\\"${id}\\" type=\\"range\\" step=\\"${step}\\" min=\\"${min}\\" max=\\"${max}\\">${NL}` +
    `${I}    </label>${NL}` +
    `${I}</div>${NL}`
  );
}

const combatAnchor =
  `<input id=\\"_autoplacerRadius\\" type=\\"range\\" step=\\"25\\" min=\\"100\\" max=\\"450\\">${NL}` +
  `                </label>${NL}            </div>${NL}`;

const combatRows =
  toggle("_prePlace", "Preplace") +
  slider("_prePlaceRadius", "Preplace radius", 10, 100, 450) +
  slider("_prePlaceHits", "Preplace break threshold", 1, 1, 6) +
  toggle("_replace", "Replace") +
  slider("_replaceRadius", "Replace radius", 25, 100, 500);

if (s.indexOf(combatAnchor) < 0) throw new Error("combat anchor not found");
s = s.replace(combatAnchor, combatAnchor + combatRows);

// Keybinds: Quick Actions section, right after the Autoplacer tile.
const keyAnchor =
  '<span class=\\"option-title\\">Toggle Autoplacer</span>\\n' +
  '                <button id=\\"_autoplacerKey\\" class=\\"hotkeyInput\\"></button>\\n' +
  "            </div>\\n";
if (s.indexOf(keyAnchor) < 0) throw new Error("keybind anchor not found");

function keyTile(id, label) {
  return (
    '            <div class=\\"content-option key-tile\\">\\n' +
    `                <span class=\\"option-title\\">${label}</span>\\n` +
    `                <button id=\\"${id}\\" class=\\"hotkeyInput\\"></button>\\n` +
    "            </div>\\n"
  );
}

s = s.replace(
  keyAnchor,
  keyAnchor + keyTile("_prePlaceKey", "Toggle Preplace") + keyTile("_replaceKey", "Toggle Replace")
);

fs.writeFileSync(p, s);
console.log("menu rows inserted");
