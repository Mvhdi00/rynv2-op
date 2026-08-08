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

// The three spike ticks are lifted the same way. The block is self-contained —
// its constants and its two tick stamps live inside it — so it drops in whole
// and the two builds cannot drift.
const SBLOCK_START = "  const SPIKE_TICK_RANGE = 170;";
const SBLOCK_END = "  class SpikeSync {";
const ss = ownerSrc.indexOf(SBLOCK_START);
const se = ownerSrc.indexOf(SBLOCK_END);
if (ss < 0 || se < ss) throw new Error("could not lift the spike ticks out of the OWNER build");
let spikeBlock = ownerSrc.slice(ss, se);
for (const [logical, mangled] of Object.entries(NAMES).sort((a, b) => b[0].length - a[0].length)) {
  spikeBlock = spikeBlock.replace(new RegExp("\\b" + logical + "\\b", "g"), mangled);
}
for (const logical of Object.keys(NAMES)) {
  if (new RegExp("\\b" + logical + "\\b").test(spikeBlock)) {
    throw new Error(`${logical} survived renaming in the spike tick block`);
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
// Preplace and replace share the autoplacer's radius, so they have no radius
// slider of their own.
const combatRows = toggle("_prePlace", "Preplace") + toggle("_replace", "Replace");
// The spike tick sub-options gain the counter-threat switch, last row inside
// the group so it reads as belonging to the three above it.
const tickAnchor =
  `<input id="_spikeTickTrap" type="checkbox"></input>${NL}` +
  `                    <span></span>${NL}` +
  `                </label>${NL}            </div>${NL}`;
const tickRows = toggle("_antiSpikeTick", "Anti Spike Tick");
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
  `    if (html.indexOf(anchor) >= 0) html = html.replace(anchor, anchor + ${JSON.stringify(combatRows)});\n` +
  `    const tickAnchor = ${JSON.stringify(tickAnchor)};\n` +
  `    if (html.indexOf(tickAnchor) >= 0) html = html.replace(tickAnchor, tickAnchor + ${JSON.stringify(tickRows)});\n` +
  `    return html;\n` +
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
// Brace-match a class body starting from an arbitrary offset.
function braceEnd(from) {
  let depth = 0;
  for (let i = folded.indexOf("{", from); i < folded.length; i++) {
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
    else if (c === "}" && --depth === 0) return i + 1;
  }
  throw new Error("unbalanced body");
}
// The spike ticks are three classes preceded by a comma-chained const of three
// arrows, and the whole run is contiguous. Find it by content rather than by
// mangled name: the head is the const that opens spikeTickTarget, the tail is
// the close of the SpikeTickTrap class.
function spikeTickExtent() {
  const mark = '["_spikeTick"]||!';
  if (folded.split(mark).length - 1 !== 1) throw new Error("_spikeTick gate is not unique");
  const start = folded.lastIndexOf("const ", folded.indexOf(mark));
  if (!/^const [_$\w]+=\([_$\w]+,[_$\w]+\)=>\{/.test(folded.slice(start))) {
    throw new Error("the const before the _spikeTick gate is not spikeTickTarget");
  }
  const trapMark = '["moduleName"]="spikeTickTrap"';
  if (folded.split(trapMark).length - 1 !== 1) throw new Error("spikeTickTrap is not unique");
  const cls = folded.lastIndexOf("class ", folded.indexOf(trapMark));
  return { start, end: braceEnd(cls) };
}
const oldSpikeTicks = spikeTickExtent();
{
  const text = folded.slice(oldSpikeTicks.start, oldSpikeTicks.end);
  for (const n of [ "spikeTickBreak", "spikeTickNear", "spikeTickTrap" ]) {
    if (!text.includes(`["moduleName"]="${n}"`)) throw new Error(`${n} is not inside the span`);
  }
  if (text.includes('"spikeSync"')) throw new Error("the span ran past spikeTickTrap");
  console.log(`old spike ticks: ${text.length} chars in the folded copy`);
}

// The module table names the old classes; repoint each at its replacement.
const spikeTickCtorEdits = [
  [ "spikeTickBreak", "SpikeTickBreak" ],
  [ "spikeTickNear", "SpikeTickNear" ],
  [ "spikeTickTrap", "SpikeTickTrap" ],
].map(([key, cls]) => {
  const head = `'${key}':new `;
  const m = new RegExp(head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([_$\\w]+)\\(").exec(folded);
  if (!m) throw new Error(`no module table entry for ${key}`);
  return {
    name: `staticModules: ${key}`,
    landmark: head + m[1] + "(",
    from: head.length,
    toEnd: 1,
    text: cls,
  };
});

const oldClass = classExtent(OLD_AUTOPLACER);
const oldText = folded.slice(oldClass.start, oldClass.end);
if (!oldText.includes('["moduleName"]="autoPlacer"')) {
  throw new Error("the class matched is not the autoPlacer");
}
console.log(`old AutoPlacer: ${oldText.length} chars in the folded copy`);

// ----------------------------------------------------------------- operations
const settingsDefaults =
  `_0xc709e6["_prePlace"]=!![],_0xc709e6["_prePlaceKey"]='',` +
  `_0xc709e6["_replace"]=!![],_0xc709e6["_replaceKey"]='',` +
  `_0xc709e6["_weather"]=!![],_0xc709e6["_weatherAmount"]=0x2d,` +
  `_0xc709e6["_antiSpikeTick"]=!![],`;

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
    name: "old spike ticks -> reworked spike ticks",
    from: oldSpikeTicks.start,
    to: oldSpikeTicks.end,
    text: "\n" + spikeBlock + "\n",
  },
  ...spikeTickCtorEdits,
  // EnemyManager.handleEnemies works out the angles attemptSpikePlacement lays
  // spikes with. Core code, outside both lifted blocks, so the "measure from
  // where the server will be, aim at where they will be" correction is its own
  // splice. auraPredictPos resolves because the placer block is lifted in.
  {
    name: "spike placement aims from the prediction",
    landmark: 'const _0x4dae89=_0xb166fe["pos"]["current"],_0x28488f=_0x4a8d6e["pos"]["current"],',
    from: 'const _0x4dae89='.length,
    toEnd: 1,
    text: '(()=>{const _p=_0xb166fe["pos"]["current"]["copy"](),_q=auraPredictPos(this["client"],1);_p.x=_q.x,_p.y=_q.y;return _p;})(),_0x28488f=_0x4a8d6e["pos"]["future"]??_0x4a8d6e["pos"]["current"]',
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
  // Autobreak lives outside the lifted block, so its tank-assumption fix has
  // to be spliced separately. The call spans a folded string, which cannot be
  // replaced in one piece, so the guard is inserted in front of it instead:
  //   hatID === 40 && canBuy(0, 40)   ==   hatID === 40
  // (wearing the hat means you own it, so canBuy is true whenever hatID is 40).
  {
    name: "getDestroyingWeapon: only count tank when worn",
    landmark: '_0x14c863["getBuildingDamage"](_0x2519c2,_0x1f750c["canBuy"](0x0,0x28))',
    at: '_0x14c863["getBuildingDamage"](_0x2519c2,'.length,
    text: '_0x14c863["hatID"]===0x28&&',
  },
  {
    name: "hammerDmg: only count tank when worn",
    landmark: '_0x3b7afb["getBuildingDamage"]?.(_0x89ebbd,this["client"]["_ModuleHandler"]["canBuy"](0x0,0x28))',
    at: '_0x3b7afb["getBuildingDamage"]?.(_0x89ebbd,'.length,
    text: '_0x3b7afb["hatID"]===0x28&&',
  },
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
