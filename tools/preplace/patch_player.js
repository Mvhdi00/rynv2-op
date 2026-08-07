// Splice the ported auraro placer into the obfuscated PLAYER build, and delete
// the AutoPlacer it replaces.
//
// The build is javascript-obfuscator output, so every edit is located in the
// readable string-folded copy (player_stage1.js) and mapped back onto the
// untouched file. Each edit is checked to land in a "gap" — a region the fold
// left byte-for-byte identical — before it is applied.
const path = require("path");
const fs = require("fs");
const { loadMap } = require("./mapback.js");
const NAMES = require("./names.js");

const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");
const FOLDED = path.join(__dirname, "player_stage1.js");

const orig = fs.readFileSync(RYN_PLAYER, "utf8");
const folded = fs.readFileSync(FOLDED, "utf8");
const mapBack = loadMap(FOLDED + ".map.json");

const OLD_AUTOPLACER = "_0x544a5f"; // the class this replaces
const AUTOPLACER_ALIAS = "_0x266440"; // AutoPlacer_default
const CLIENT_ARG = "_0x4ad6f7"; // the client threaded through the module table
const KEYBINDS_PAGE = "_0x4f695d";
const COMBAT_PAGE = "_0x222a58";
const VISUALS_PAGE = "_0x5bc8e9";
const WIN_VAR = "_0x63a37"; // const <win> = window, ... — where the overlay goes

// ---------------------------------------------------------------- module code
const ownerSrc = fs.readFileSync(RYN_OWNER, "utf8");
const BLOCK_START = "  const AURA_TWO_PI = Math.PI * 2;";
const BLOCK_END = "  const Replacer_default = Replacer;";
const bs = ownerSrc.indexOf(BLOCK_START);
const be = ownerSrc.indexOf(BLOCK_END);
if (bs < 0 || be < bs) throw new Error("could not lift the placer out of the OWNER build");

let moduleBlock = ownerSrc.slice(bs, be + BLOCK_END.length);
// Rename the globals to whatever this build calls them. Longest first so no
// name is a prefix of another mid-substitution.
for (const [logical, mangled] of Object.entries(NAMES).sort((a, b) => b[0].length - a[0].length)) {
  moduleBlock = moduleBlock.replace(new RegExp("\\b" + logical + "\\b", "g"), mangled);
}
for (const logical of Object.keys(NAMES)) {
  if (new RegExp("\\b" + logical + "\\b").test(moduleBlock)) {
    throw new Error(`${logical} survived renaming`);
  }
}

// The weather overlay is lifted the same way.
const WBLOCK_START = "  const WEATHER_MAX_PARTICLES = 420;";
const WBLOCK_END = "  })(performance.now());";
const ws = ownerSrc.indexOf(WBLOCK_START);
const we = ownerSrc.indexOf(WBLOCK_END);
if (ws < 0 || we < ws) throw new Error("could not lift the weather block out of the OWNER build");
let weatherBlock = ownerSrc.slice(ws, we + WBLOCK_END.length);
for (const [logical, mangled] of Object.entries(NAMES).sort((a, b) => b[0].length - a[0].length)) {
  // `(?<!\.)` keeps `game.clientWidth` from being rewritten
  weatherBlock = weatherBlock.replace(new RegExp("(?<!\\.)\\b" + logical + "\\b", "g"), mangled);
}
for (const logical of Object.keys(NAMES)) {
  if (new RegExp("(?<!\\.)\\b" + logical + "\\b").test(weatherBlock)) {
    throw new Error(`${logical} survived renaming in the weather block`);
  }
}

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
const visualsAnchor =
  `<input id="_objectTintOpacity" type="range" step="5" min="0" max="100" data-suffix="%">${NL}` +
  `                </label>${NL}            </div>${NL}        </div>${NL}    </div>${NL}${NL}`;
const visualsRows =
  `    <div class="section">${NL}` +
  `        <div class="section-title">Weather<span class="sec-sub">Rain over the map, turning to snow in the snow biome.</span></div>${NL}` +
  `        <div class="section-content">${NL}` +
  toggle("_weather", "Rain &amp; Snow") +
  slider("_weatherAmount", "Intensity", 5, 0, 100) +
  `        </div>${NL}    </div>${NL}${NL}`;
const keyAnchor =
  `                <button id="_autoplacerKey" class="hotkeyInput"></button>\n` +
  `            </div>\n`;
const keyRows = keyTile("_prePlaceKey", "Toggle Preplace") + keyTile("_replaceKey", "Toggle Replace");

// The menu pages are encrypted string-array entries and cannot be edited in
// place, so the rows are grafted on at runtime instead.
const menuHelpers =
  `\n  const RYN_PP_COMBAT = html => {\n` +
  `    const anchor = ${JSON.stringify(combatAnchor)};\n` +
  `    return html.indexOf(anchor) < 0 ? html : html.replace(anchor, anchor + ${JSON.stringify(combatRows)});\n` +
  `  };\n` +
  `  const RYN_PP_VISUALS = html => {\n` +
  `    const anchor = ${JSON.stringify(visualsAnchor)};\n` +
  `    return html.indexOf(anchor) < 0 ? html : html.replace(anchor, anchor + ${JSON.stringify(visualsRows)});\n` +
  `  };\n` +
  `  const RYN_PP_KEYS = html => {\n` +
  `    const anchor = ${JSON.stringify(keyAnchor)};\n` +
  `    return html.indexOf(anchor) < 0 ? html : html.replace(anchor, anchor + ${JSON.stringify(keyRows)});\n` +
  `  };\n`;

// ----------------------------------------------------------- old class extent
// Brace-match the class body in the folded copy, skipping string literals.
function classExtent(name) {
  const start = folded.indexOf("class " + name + "{");
  if (start < 0) throw new Error("no class " + name);
  let depth = 0;
  for (let i = folded.indexOf("{", start); i < folded.length; i++) {
    const c = folded[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      i++;
      while (i < folded.length && folded[i] !== q) {
        if (folded[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return { start, end: i + 1 };
  }
  throw new Error("unbalanced class " + name);
}
const oldClass = classExtent(OLD_AUTOPLACER);
const oldText = folded.slice(oldClass.start, oldClass.end);
if (!oldText.includes('["moduleName"]="autoPlacer"')) {
  throw new Error("the class matched is not the autoPlacer");
}
console.log(`old AutoPlacer: ${oldText.length} chars in the folded copy`);

// ----------------------------------------------------------------- operations
const settingsDefaults =
  `_0xc709e6["_prePlace"]=!![],_0xc709e6["_prePlaceRadius"]=0x10e,` +
  `_0xc709e6["_prePlaceHits"]=0x4,_0xc709e6["_prePlaceKey"]='',` +
  `_0xc709e6["_replace"]=!![],_0xc709e6["_replaceRadius"]=0x12c,_0xc709e6["_replaceKey"]='',` +
  `_0xc709e6["_weather"]=!![],_0xc709e6["_weatherAmount"]=0x2d,`;

const S = NAMES.Settings_default;
function toggleHandler(keyProp, valueProp, elementId) {
  return (
    `if(${S}["${keyProp}"]&&_0x292e56["code"]===${S}["${keyProp}"])` +
    `try{${S}["${valueProp}"]=!${S}["${valueProp}"];` +
    `const _rynPPEl=_0x58927a["frame"]&&_0x58927a["frame"]["document"]&&` +
    `_0x58927a["frame"]["document"]["getElementById"]("${elementId}");` +
    `if(_rynPPEl)_rynPPEl["checked"]=${S}["${valueProp}"];}catch(_rynPPErr){}`
  );
}

const edits = [
  {
    // One replace, not an insert plus a delete: those would share a start
    // offset and the second would eat the first.
    name: "old AutoPlacer -> ported placer",
    from: oldClass.start,
    to: oldClass.end,
    text: "\n" + moduleBlock + menuHelpers + "\n",
  },
  {
    name: "point AutoPlacer_default at the new class",
    landmark: `const ${AUTOPLACER_ALIAS}=${OLD_AUTOPLACER};`,
    from: `const ${AUTOPLACER_ALIAS}=`.length,
    toEnd: 1,
    text: "AutoPlacer",
  },
  {
    name: "staticModules entries",
    landmark: `'autoPlacer':new ${AUTOPLACER_ALIAS}(${CLIENT_ARG}),`,
    after: true,
    text: `'prePlacer':new PrePlacer_default(${CLIENT_ARG}),'replacer':new Replacer_default(${CLIENT_ARG}),`,
  },
  {
    name: "modules order (replacer first)",
    landmark: '"autoPlay"],this["staticModules"]["autoPlacer"],',
    at: '"autoPlay"],'.length,
    text: 'this["staticModules"]["replacer"],',
  },
  {
    name: "modules order (preplacer last)",
    landmark: '["autoPlacer"],this["staticModules"]["trapTick"]',
    at: '["autoPlacer"],'.length,
    text: 'this["staticModules"]["prePlacer"],',
  },
  {
    name: "settings defaults",
    landmark: '_0xc709e6["_autoplacer"]=!![],',
    after: true,
    text: settingsDefaults,
  },
  {
    name: "keybind handlers",
    landmark: `if(_0x4dafe3)_0x4dafe3["checked"]=${S}["_autoplacer"];}catch(_0x1f2353){}`,
    after: true,
    text: toggleHandler("_prePlaceKey", "_prePlace", "_prePlace") + toggleHandler("_replaceKey", "_replace", "_replace"),
  },
  {
    name: "weather overlay",
    landmark: `const ${WIN_VAR}=window,`,
    at: 0,
    text: "\n" + weatherBlock + "\n",
  },
  { name: "visuals wrap (open)", landmark: `"+${VISUALS_PAGE}+"`, at: 2, text: "RYN_PP_VISUALS(" },
  { name: "visuals wrap (close)", landmark: `"+${VISUALS_PAGE}+"`, at: 2 + VISUALS_PAGE.length, text: ")" },
  { name: "keybinds wrap (open)", landmark: `"+${KEYBINDS_PAGE}+"`, at: 2, text: "RYN_PP_KEYS(" },
  { name: "keybinds wrap (close)", landmark: `"+${KEYBINDS_PAGE}+"`, at: 2 + KEYBINDS_PAGE.length, text: ")" },
  { name: "combat wrap (open)", landmark: `"+${COMBAT_PAGE}+"`, at: 2, text: "RYN_PP_COMBAT(" },
  { name: "combat wrap (close)", landmark: `"+${COMBAT_PAGE}+"`, at: 2 + COMBAT_PAGE.length, text: ")" },
];

// A position only maps across inside a gap, so prove that before using it.
function mapPoint(label, foldedPos) {
  const loc = mapBack.locate(foldedPos);
  if (!loc.inGap) throw new Error(`${label}: point is inside a folded string`);
  const gapFolded = folded.slice(loc.gapFoldedStart, Math.min(loc.gapFoldedEnd, folded.length));
  const gapOrig = orig.slice(loc.gapOrigStart, Math.min(loc.gapOrigEnd, orig.length));
  if (gapFolded !== gapOrig) throw new Error(`${label}: the gap does not line up`);
  if (foldedPos < loc.gapFoldedStart || foldedPos > loc.gapFoldedEnd) {
    throw new Error(`${label}: point fell outside its gap`);
  }
  return loc.origOffset;
}

const resolved = [];
for (const edit of edits) {
  let foldedFrom, foldedTo;
  if (edit.landmark !== undefined) {
    const hits = folded.split(edit.landmark).length - 1;
    if (hits !== 1) throw new Error(`${edit.name}: landmark matched ${hits} times, need exactly 1`);
    const at = folded.indexOf(edit.landmark);
    if (edit.after) {
      foldedFrom = foldedTo = at + edit.landmark.length;
    } else if (edit.toEnd !== undefined) {
      foldedFrom = at + edit.from;
      foldedTo = at + edit.landmark.length - edit.toEnd;
    } else {
      foldedFrom = foldedTo = at + edit.at;
    }
  } else {
    foldedFrom = edit.from;
    foldedTo = edit.to;
  }
  const origFrom = mapPoint(edit.name, foldedFrom);
  const origTo = foldedTo === foldedFrom ? origFrom : mapPoint(edit.name + " (end)", foldedTo);
  resolved.push({ ...edit, origFrom, origTo });
  const delta = edit.text.length - (origTo - origFrom);
  console.log(`ok  ${edit.name.padEnd(38)} orig@${origFrom}${origTo !== origFrom ? "-" + origTo : ""} (${delta >= 0 ? "+" : ""}${delta})`);
}

// Apply back-to-front so earlier offsets stay valid.
resolved.sort((a, b) => b.origFrom - a.origFrom);
let out = orig;
for (const edit of resolved) {
  out = out.slice(0, edit.origFrom) + edit.text + out.slice(edit.origTo);
}
fs.writeFileSync(RYN_PLAYER, out);
console.log(`\npatched: ${orig.length} -> ${out.length} chars`);
