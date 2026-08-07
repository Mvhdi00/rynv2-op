// Splice the preplace/replace feature into the obfuscated PLAYER build.
//
// The build is javascript-obfuscator output, so it is located through the
// string-folded copy (player_stage1.js) and every edit is mapped back onto the
// untouched file. Only insertions are made — no original byte is rewritten.
const path = require("path");
const fs = require("fs");
const { loadMap } = require("./mapback.js");

const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");

const ORIG = RYN_PLAYER;
const FOLDED = path.join(__dirname, "player_stage1.js");

const orig = fs.readFileSync(ORIG, "utf8");
const folded = fs.readFileSync(FOLDED, "utf8");
const mapBack = loadMap(FOLDED + ".map.json");

// Mangled names this build uses for the things the feature needs.
const SETTINGS = "_0x35d81b"; // Settings_default
const PLAYEROBJECT = "_0xcd92ac"; // PlayerObject
const CLIENT_ARG = "_0x4ad6f7"; // the client passed around in the module table
const KEYBINDS_PAGE = "_0x4f695d";
const COMBAT_PAGE = "_0x222a58";

// ---------------------------------------------------------------- module code
const ownerSrc = fs.readFileSync(RYN_OWNER, "utf8");
const BLOCK_START = "  const PREPLACE_SCAN_CELLS = 2;";
const BLOCK_END = "  const Replacer_default = Replacer;";
const bs = ownerSrc.indexOf(BLOCK_START);
const be = ownerSrc.indexOf(BLOCK_END);
if (bs < 0 || be < bs) throw new Error("could not lift the module block from the OWNER build");
const moduleBlock = ownerSrc
  .slice(bs, be + BLOCK_END.length)
  .replace(/\bSettings_default\b/g, SETTINGS)
  .replace(/\bPlayerObject\b/g, PLAYEROBJECT);

// ------------------------------------------------------------------ menu rows
const NL = "\r\n";
const I = "            ";
const toggle = (id, label) =>
  `${I}<div class="content-option">${NL}` +
  `${I}    <label class="option-title" for="${id}">${label}</label>${NL}` +
  `${I}    <label class="switch-checkbox">${NL}` +
  `${I}        <input id="${id}" type="checkbox"></input>${NL}` +
  `${I}        <span></span>${NL}` +
  `${I}    </label>${NL}` +
  `${I}</div>${NL}`;
const slider = (id, label, step, min, max) =>
  `${I}<div class="content-option">${NL}` +
  `${I}    <span class="option-title">${label}</span>${NL}` +
  `${I}    <label class="slider">${NL}` +
  `${I}        <span class="slider-value"></span>${NL}` +
  `${I}        <input id="${id}" type="range" step="${step}" min="${min}" max="${max}">${NL}` +
  `${I}    </label>${NL}` +
  `${I}</div>${NL}`;
const keyTile = (id, label) =>
  `            <div class="content-option key-tile">\n` +
  `                <span class="option-title">${label}</span>\n` +
  `                <button id="${id}" class="hotkeyInput"></button>\n` +
  `            </div>\n`;

const combatAnchor =
  `<input id="_autoplacerRadius" type="range" step="25" min="100" max="450">${NL}` +
  `                </label>${NL}            </div>${NL}`;
const combatRows =
  toggle("_prePlace", "Preplace") +
  slider("_prePlaceRadius", "Preplace radius", 10, 100, 450) +
  slider("_prePlaceHits", "Preplace break threshold", 1, 1, 6) +
  toggle("_replace", "Replace") +
  slider("_replaceRadius", "Replace radius", 25, 100, 500);

const keyAnchor =
  `                <button id="_autoplacerKey" class="hotkeyInput"></button>\n` +
  `            </div>\n`;
const keyRows = keyTile("_prePlaceKey", "Toggle Preplace") + keyTile("_replaceKey", "Toggle Replace");

// The pages are encrypted string-array entries, so the rows are grafted on at
// runtime instead of being written into the markup.
const menuHelpers =
  `\n  const RYN_PP_COMBAT = html => {\n` +
  `    const anchor = ${JSON.stringify(combatAnchor)};\n` +
  `    return html.indexOf(anchor) < 0 ? html : html.replace(anchor, anchor + ${JSON.stringify(combatRows)});\n` +
  `  };\n` +
  `  const RYN_PP_KEYS = html => {\n` +
  `    const anchor = ${JSON.stringify(keyAnchor)};\n` +
  `    return html.indexOf(anchor) < 0 ? html : html.replace(anchor, anchor + ${JSON.stringify(keyRows)});\n` +
  `  };\n`;

// ----------------------------------------------------------------- insertions
const settingsDefaults =
  `${SETTINGS ? "" : ""}_0xc709e6["_prePlace"]=!![],_0xc709e6["_prePlaceRadius"]=0x10e,` +
  `_0xc709e6["_prePlaceHits"]=0x4,_0xc709e6["_prePlaceKey"]='',` +
  `_0xc709e6["_replace"]=!![],_0xc709e6["_replaceRadius"]=0x12c,_0xc709e6["_replaceKey"]='',`;

function toggleHandler(keyProp, valueProp, elementId) {
  return (
    `if(${SETTINGS}["${keyProp}"]&&_0x292e56["code"]===${SETTINGS}["${keyProp}"])` +
    `try{${SETTINGS}["${valueProp}"]=!${SETTINGS}["${valueProp}"];` +
    `const _rynPPEl=_0x58927a["frame"]&&_0x58927a["frame"]["document"]&&` +
    `_0x58927a["frame"]["document"]["getElementById"]("${elementId}");` +
    `if(_rynPPEl)_rynPPEl["checked"]=${SETTINGS}["${valueProp}"];}catch(_rynPPErr){}`
  );
}
const keyHandlers =
  toggleHandler("_prePlaceKey", "_prePlace", "_prePlace") +
  toggleHandler("_replaceKey", "_replace", "_replace");

// Each entry: a landmark in the folded text, whether to insert before or after
// it, and the text to insert.
const edits = [
  {
    name: "module classes",
    landmark: "const _0x266440=_0x544a5f;",
    where: "after",
    text: "\n" + moduleBlock + menuHelpers,
  },
  {
    name: "staticModules entries",
    landmark: `'autoPlacer':new _0x266440(${CLIENT_ARG}),`,
    where: "after",
    text: `'prePlacer':new PrePlacer_default(${CLIENT_ARG}),'replacer':new Replacer_default(${CLIENT_ARG}),`,
  },
  {
    name: "modules order (replacer first)",
    landmark: '"autoPlay"],this["staticModules"]["autoPlacer"],',
    where: "at",
    offsetInLandmark: '"autoPlay"],'.length,
    text: 'this["staticModules"]["replacer"],',
  },
  {
    name: "modules order (preplacer last)",
    landmark: '["autoPlacer"],this["staticModules"]["trapTick"]',
    where: "at",
    offsetInLandmark: '["autoPlacer"],'.length,
    text: 'this["staticModules"]["prePlacer"],',
  },
  {
    name: "settings defaults",
    landmark: '_0xc709e6["_autoplacer"]=!![],',
    where: "after",
    text: settingsDefaults,
  },
  {
    name: "keybind handlers",
    landmark: `if(_0x4dafe3)_0x4dafe3["checked"]=${SETTINGS}["_autoplacer"];}catch(_0x1f2353){}`,
    where: "after",
    text: keyHandlers,
  },
  {
    name: "keybinds page wrap (open)",
    landmark: `"+${KEYBINDS_PAGE}+"`,
    where: "at",
    offsetInLandmark: 2,
    text: "RYN_PP_KEYS(",
  },
  {
    name: "keybinds page wrap (close)",
    landmark: `"+${KEYBINDS_PAGE}+"`,
    where: "at",
    offsetInLandmark: 2 + KEYBINDS_PAGE.length,
    text: ")",
  },
  {
    name: "combat page wrap (open)",
    landmark: `"+${COMBAT_PAGE}+"`,
    where: "at",
    offsetInLandmark: 2,
    text: "RYN_PP_COMBAT(",
  },
  {
    name: "combat page wrap (close)",
    landmark: `"+${COMBAT_PAGE}+"`,
    where: "at",
    offsetInLandmark: 2 + COMBAT_PAGE.length,
    text: ")",
  },
];

const resolved = [];
for (const edit of edits) {
  const hits = folded.split(edit.landmark).length - 1;
  if (hits !== 1) throw new Error(`${edit.name}: landmark matched ${hits} times, need exactly 1`);
  const at = folded.indexOf(edit.landmark);
  let foldedPos;
  if (edit.where === "after") foldedPos = at + edit.landmark.length;
  else if (edit.where === "at") foldedPos = at + edit.offsetInLandmark;
  else foldedPos = at;
  // The mapping is only exact inside the gaps the fold left untouched, so
  // require the point to sit in one and prove that gap is byte-identical.
  const loc = mapBack.locate(foldedPos);
  const origPos = loc.origOffset;
  if (!loc.inGap) throw new Error(`${edit.name}: insertion point is inside a folded string`);
  const gapFolded = folded.slice(loc.gapFoldedStart, Math.min(loc.gapFoldedEnd, folded.length));
  const gapOrig = orig.slice(loc.gapOrigStart, Math.min(loc.gapOrigEnd, orig.length));
  if (gapFolded !== gapOrig) {
    throw new Error(
      `${edit.name}: gap around ${origPos} does not line up\n` +
        `  folded: ${JSON.stringify(gapFolded.slice(0, 60))}\n` +
        `  orig:   ${JSON.stringify(gapOrig.slice(0, 60))}`
    );
  }
  if (foldedPos < loc.gapFoldedStart || foldedPos > loc.gapFoldedEnd) {
    throw new Error(`${edit.name}: insertion point fell outside its gap`);
  }
  resolved.push({ ...edit, origPos });
  console.log(`ok  ${edit.name} -> orig@${origPos} (+${edit.text.length} chars)`);
}

// Apply back-to-front so earlier offsets stay valid.
resolved.sort((a, b) => b.origPos - a.origPos);
let out = orig;
for (const edit of resolved) {
  out = out.slice(0, edit.origPos) + edit.text + out.slice(edit.origPos);
}
fs.writeFileSync(ORIG, out);
console.log(`\npatched: ${orig.length} -> ${out.length} chars`);
