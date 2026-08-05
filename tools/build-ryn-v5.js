#!/usr/bin/env node
/*
 * build-ryn-v5.js
 *
 * Produces RYN_Client_v5_Custom.user.js from src/RYN_Client_v5.js.
 *
 * Three kinds of change:
 *
 *   1. Skin colours. Config_default.skinColors was in a different order from
 *      the game's table and carried an extra 11th entry, so the swatch you
 *      clicked sent a different index than the colour you saw. Replaced with
 *      the game's exact array.
 *
 *   2. Removals. Each target loses its menu entry, its stored setting, and its
 *      runtime effect — reads of a removed setting collapse to a constant so
 *      the guarded branch is dead rather than dangling.
 *
 *   3. Menu. Bigger, fully glass, and the category bar becomes a wheel.
 *
 * Every edit is anchored; a missing or ambiguous anchor fails the build.
 *
 *   node tools/build-ryn-v5.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src/RYN_Client_v5.js");
const OUT = path.join(ROOT, "RYN_Client_v5_Custom.user.js");

let code = fs.readFileSync(SRC, "utf8");
const applied = [];
const note = (m) => applied.push(m);

function edit(name, find, replace, { count = 1 } = {}) {
  if (find instanceof RegExp) {
    const re = new RegExp(find.source, find.flags.includes("g") ? find.flags : find.flags + "g");
    const hits = [...code.matchAll(re)];
    if (hits.length === 0) throw new Error("anchor not found: " + name);
    if (count !== "any" && hits.length !== count)
      throw new Error(`anchor hit ${hits.length}x, expected ${count}: ${name}`);
    code = code.replace(re, replace);
    note(name);
    return;
  }
  const parts = code.split(find);
  if (parts.length === 1) throw new Error("anchor not found: " + name);
  if (count !== "any" && parts.length - 1 !== count)
    throw new Error(`anchor hit ${parts.length - 1}x, expected ${count}: ${name}`);
  code = parts.join(replace);
  note(name);
}

/* ------------------------------------------------------------------ *
 * 1. Skin colours
 * ------------------------------------------------------------------ */

const GAME_SKIN_COLORS = [
  "#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec",
  "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373",
];

edit(
  "colors: skinColors restored to the game's table, in the game's order",
  /skinColors: \[[^\]]*\]/,
  "skinColors: [ " + GAME_SKIN_COLORS.map((c) => `"${c}"`).join(", ") + " ]"
);

/* The picker stores the index and the server stores the index; with the array
 * matching the game's, an out-of-range value saved by the old build would still
 * point past the end, so it is clamped on read. */
edit(
  "colors: stored skin index clamped into the game's range",
  'this.selectSkinColor(CustomStorage.get("skin_color") || 0);',
  'this.selectSkinColor(Math.min(Math.max(0, Number(CustomStorage.get("skin_color")) || 0), Config_default.skinColors.length - 1));'
);

/* ------------------------------------------------------------------ *
 * 2. Texture pack
 * ------------------------------------------------------------------ */
{
  const at = code.indexOf('"./img/hats/hat_12.png":');
  if (at === -1) throw new Error("anchor not found: hat texture map");
  let open = code.lastIndexOf("{", at);
  let depth = 0, close = -1;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close === -1) throw new Error("unterminated hat texture map");
  code = code.slice(0, open) + "{}" + code.slice(close + 1);
  note("textures: hat image replacements removed in full (flipper hat_31 included)");
}

/* ------------------------------------------------------------------ *
 * 3. Removals
 * ------------------------------------------------------------------ */

/* Menu rows. The page markup lives in escaped string literals, in two quoting
 * styles, so both are matched. A row is a .content-option div; it is removed
 * whole, together with the description that belongs to it. */
function dropMenuRow(id, label) {
  const q = '(?:\\\\"|")';
  const re = new RegExp(
    `<div class=${q}content-option${q}>(?:(?!<div class=${q}content-option${q}>)[\\s\\S])*?${id}\\b[\\s\\S]*?<\\/div>\\\\r\\\\n`,
    "g"
  );
  const hits = [...code.matchAll(re)];
  if (hits.length === 0) throw new Error("menu row not found: " + id);
  code = code.replace(re, "");
  note(`menu: removed row ${label} (${id})`);
}

/* Stored settings. */
function dropSetting(id) {
  const re = new RegExp(`\\n\\s*${id}: [^\\n]*?,(?=\\n)`, "g");
  const hits = [...code.matchAll(re)];
  if (hits.length === 0) throw new Error("setting not found: " + id);
  code = code.replace(re, "");
  note(`settings: removed ${id}`);
}

/* Writes to a removed setting are dropped; reads collapse to a constant so the
 * branch they guard is dead. Reads and writes are told apart by what follows —
 * a lone `=` is an assignment, `==`/`===` is a comparison. */
function neutralise(id, value) {
  const write = new RegExp(`Settings_default\\.${id}\\s*=(?!=)[^;\\n]*;?`, "g");
  const writes = (code.match(write) || []).length;
  if (writes) code = code.replace(write, "void 0;");

  const read = new RegExp(`Settings_default\\.${id}\\b`, "g");
  const reads = (code.match(read) || []).length;
  if (reads) code = code.replace(read, value);

  if (writes || reads) note(`logic: ${id} — ${reads} read(s) -> ${value}, ${writes} write(s) dropped`);
}

/* Some rows label themselves with a plain <span class="option-title"> instead
 * of a <label for=...>, so there is no id to anchor on — those are matched by
 * their visible text. */
function dropMenuRowByLabel(label) {
  const q = '(?:\\\\"|")';
  const re = new RegExp(
    `<div class=${q}content-option${q}>(?:(?!<div class=${q}content-option${q}>)[\\s\\S])*?>${label}<(?:(?!<div class=${q}content-option${q}>)[\\s\\S])*?<\\/div>`,
    "g"
  );
  const hits = [...code.matchAll(re)];
  if (hits.length === 0) throw new Error("menu row not found by label: " + label);
  code = code.replace(re, "");
  note(`menu: removed row "${label}"`);
}

const REMOVE = [
  ["_disableAutoTickCombat", "Manual Mode", "false"],
  ["_velocityTick", "Velocity tick", "false"],
  ["_comboApproach", "Combo Approach", "false"],
  ["_kbPredictInsta", "KB Predict Insta", "false"],
  ["_spectateOnDeath", "Spectate on Death", "false"],
  ["_ghostMode", "Ghost Mode", "false"],
  ["_ghostModeOpacity", "Ghost Mode Opacity", "0.35"],
  ["_spectateHideHUD", "Spectate Hide HUD", "false"],
  ["_ghostBody", "Ghost Body", "false"],
  ["_ghostOpacity", "Ghost Opacity", "0.35"],
  ["_attackSyncDelay", "Attack Sync Delay", "false"],
  ["_syncDelayStep", "Sync Delay Step", "0"],
];

for (const [id, label] of REMOVE) {
  try { dropMenuRow(id, label); } catch (e) { note(`menu: no row for ${id} (nothing to remove)`); }
}
for (const [id, , value] of REMOVE) {
  try { dropSetting(id); } catch (e) { note(`settings: no entry for ${id}`); }
  neutralise(id, value);
}

/* Rows the client labels with a span rather than a label-for. */
for (const label of [
  "Spectate on Death", "Ghost Mode", "Ghost Mode Opacity", "Spectate Hide HUD",
  "Ghost Body", "Ghost Opacity", "Attack Sync Delay", "Sync Delay Step",
  "Toggle Shop", "Toggle Clan",
]) {
  try { dropMenuRowByLabel(label); } catch (e) { note(`menu: no row "${label}"`); }
}

/* The settings those rows drove. */
for (const [id, value] of [
  ["_spectate", "false"], ["_spectateGhost", "false"], ["_spectateGhostOpacity", "0.35"],
  ["_spectateBotVision", "false"],
  ["_botAttackStagger", "false"], ["_botAttackStaggerMs", "0"],
]) {
  try { dropSetting(id); } catch (e) { note(`settings: no entry for ${id}`); }
  neutralise(id, value);
}

/* Commands: this build has no page 9 markup left, only the search label and
 * the orphaned strings it used. Both go. */
edit("menu: Commands dropped from the page index", /\n\s*9: "Commands"/, "");
{
  const before = code.length;
  code = code.replace(/\n\s*(?:commands_desc|gbots_[a-z_]+|bot_follow|recall_bots|auto_attack_cmd|one_v_one): "[^"]*",/g, "");
  if (code.length < before) note("menu: Commands strings removed");
}

/* Legit Mode: a row, a setting, its backup slot, its exclusion set and the
 * switch that drives it. */
try { dropMenuRow("_legitMode", "Legit Mode"); } catch (e) { note("menu: no Legit Mode row"); }
edit(
  "logic: Legit Mode apply routine reduced to a no-op",
  /const alreadyApplied = !!Settings_default\._legitModeBackup;/,
  "const alreadyApplied = false; if (true) return;"
);
neutralise("_legitMode", "false");
neutralise("_legitModeBackup", "null");
try { dropSetting("_legitMode"); } catch (e) {}
edit("settings: removed _legitModeBackup", /\n\s*_legitModeBackup: null/, "");
edit(
  "logic: Legit Mode case dropped from the settings switch",
  /\n\s*case "_legitMode":/,
  '\n      case "__removed_legitMode":'
);

/* Toggle Shop / Toggle Clan keybinds. */
edit(
  "keybinds: Toggle Shop and Toggle Clan handlers removed",
  /if \(event\.code === Settings_default\._toggleShop\) \{[\s\S]*?\n\s*if \(event\.code === Settings_default\._toggleClan\) \{[\s\S]*?\n      \}\n/,
  ""
);
for (const id of ["_toggleShop", "_toggleClan"]) {
  try { dropSetting(id); } catch (e) {}
  neutralise(id, '""');
  try { dropMenuRow(id, id); } catch (e) {}
}

/* Commands page: its markup constant, its nav entry and its page div. */
{
  const re = /\n\s*const Commands_default = (?:"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*');/;
  if (re.test(code)) {
    code = code.replace(re, "\n  const Commands_default = '';");
    note("menu: Commands page markup emptied");
  } else {
    note("menu: no Commands_default constant found");
  }
}


/* The flipper hat ships as its own inline base64 image, separate from the URL
 * map above — that is the texture pack the request singled out. */
{
  const re = /\n?\s*"\.\/img\/hats\/hat_31\.png": "data:image\/png;base64,[^"]*",?/g;
  if (re.test(code)) { code = code.replace(re, ""); note("textures: flipper hat inline image removed"); }
  else note("textures: no inline flipper image");
}

/* Devtool statistics row for a counter that no longer ticks. */
{
  const re = /<div class=(?:\\"|")content-option left-flex text(?:\\"|")>(?:(?!<div class=)[\s\S])*?Velocity tick[\s\S]*?<\/div>/g;
  if (re.test(code)) { code = code.replace(re, ""); note("menu: Velocity tick statistics row removed"); }
}

/* The Misc page kept an empty "Legit Mode" section once its row went. */
{
  const re = /\\x3c!-- Legit Mode --\\x3e[\s\S]*?<div class=(?:\\"|")section(?:\\"|")>[\s\S]*?<\/div>\\r\\n\s*<\/div>/;
  if (re.test(code)) { code = code.replace(re, ""); note("menu: empty Legit Mode section removed"); }
  else note("menu: no Legit Mode section wrapper");
}

/* Its warning, its exclusion list, and the search-index and i18n entries for
 * everything that is gone. */
{
  const before = code.length;
  code = code.replace(/\n[^\n]*RYNNotify\.(?:warn|show)\("Legit Mode[^\n]*\n/g, "\n");
  code = code.replace(/\n\s*const LEGIT_MODE_EXCLUDE = new Set\(\[[^\]]*\]\);/g, "\n  const LEGIT_MODE_EXCLUDE = new Set([]);");
  code = code.replace(/\n\s*(?:kb_predict_insta|toggle_shop|toggle_clan|velocity_tick|combo_approach|manual_mode|legit_mode|ghost_mode|ghost_body|ghost_opacity|spectate_on_death|spectate_hide_hud|attack_sync_delay|sync_delay_step): "[^"]*",/g, "");
  code = code.replace(/\[ "(?:KB Predict Insta|Toggle Shop|Toggle Clan|Velocity tick|Combo Approach|Manual Mode|Legit Mode|Ghost Mode|Ghost Body|Ghost Opacity|Spectate on Death|Spectate Hide HUD|Attack Sync Delay|Sync Delay Step)", t\.[a-z_]+ \], /g, "");
  if (code.length < before) note("menu: search-index and translation entries removed");
}

/* ------------------------------------------------------------------ *
 * 4. Menu: bigger, full glass, wheel-shaped category picker
 * ------------------------------------------------------------------ */

const MENU_CSS = String.raw`

/* ═════════════════ RYN v5 — glass wheel menu ═════════════════
   Bigger panel, iOS-style glass all the way through, and the flat
   category bar rearranged into a wheel around the panel's left edge. */

:root{
  --glass-tint: rgba(122,66,244,0.10);
  --glass-edge: rgba(255,255,255,0.16);
  --wheel-size: 300px;
  --wheel-radius: 118px;
}

#menu-container{
  width: 1600px !important;
  height: 900px !important;
}

/* The panel itself: no solid fill at all, only blur + a hairline edge. */
#menu-wrapper{
  width: 95% !important;
  height: 94% !important;
  background: var(--glass-tint) !important;
  backdrop-filter: blur(44px) saturate(185%) !important;
  -webkit-backdrop-filter: blur(44px) saturate(185%) !important;
  border: 1px solid var(--glass-edge) !important;
  border-radius: 34px !important;
  box-shadow:
    0 24px 80px rgba(0,0,0,0.45),
    inset 0 1px 0 rgba(255,255,255,0.20),
    inset 0 -1px 0 rgba(0,0,0,0.18) !important;
  overflow: visible !important;
}
#menu-wrapper::before{
  content:'' !important;
  position:absolute !important; inset:0 !important;
  border-radius:34px !important;
  background: linear-gradient(155deg, rgba(160,110,255,0.12) 0%, rgba(58,134,255,0.05) 55%, rgba(0,0,0,0) 100%) !important;
  pointer-events:none !important;
}

/* ── the wheel ───────────────────────────────────────────────
   Each nav button is rotated out around a shared centre, then the
   label is counter-rotated so it stays upright. */
#navbar-container{
  position: relative !important;
  width: var(--wheel-size) !important;
  min-width: var(--wheel-size) !important;
  height: var(--wheel-size) !important;
  align-self: center !important;
  margin: 0 26px 0 18px !important;
  padding: 0 !important;
  border: none !important;
  background: none !important;
  display: block !important;
  overflow: visible !important;
  flex: 0 0 var(--wheel-size) !important;
}
/* hub */
#navbar-container::after{
  content:'' !important;
  position:absolute !important;
  left:50% !important; top:50% !important;
  width: 132px !important; height: 132px !important;
  transform: translate(-50%,-50%) !important;
  border-radius: 50% !important;
  background: rgba(255,255,255,0.05) !important;
  backdrop-filter: blur(18px) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  pointer-events:none !important;
}

#navbar-container > *{
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  width: 74px !important;
  height: 74px !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 3px !important;
  border-radius: 50% !important;
  background: rgba(255,255,255,0.06) !important;
  backdrop-filter: blur(16px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(150%) !important;
  border: 1px solid rgba(255,255,255,0.13) !important;
  box-shadow: 0 6px 20px rgba(0,0,0,0.28) !important;
  transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease !important;
}
#navbar-container > *:hover{
  background: rgba(122,66,244,0.24) !important;
  border-color: rgba(168,140,255,0.60) !important;
  box-shadow: 0 8px 26px rgba(122,66,244,0.35) !important;
}
#navbar-container > *.active{
  background: rgba(122,66,244,0.34) !important;
  border-color: rgba(190,165,255,0.85) !important;
  box-shadow: 0 0 0 1px rgba(190,165,255,0.35), 0 10px 30px rgba(122,66,244,0.45) !important;
}

/* Eight seats around the hub; the inner content is counter-rotated so text
   and icons stay upright at every seat. */
#navbar-container > *:nth-child(1){ transform: translate(-50%,-50%) rotate(-90deg)  translate(var(--wheel-radius)) rotate(90deg)  !important; }
#navbar-container > *:nth-child(2){ transform: translate(-50%,-50%) rotate(-45deg)  translate(var(--wheel-radius)) rotate(45deg)  !important; }
#navbar-container > *:nth-child(3){ transform: translate(-50%,-50%) rotate(0deg)    translate(var(--wheel-radius)) rotate(0deg)   !important; }
#navbar-container > *:nth-child(4){ transform: translate(-50%,-50%) rotate(45deg)   translate(var(--wheel-radius)) rotate(-45deg) !important; }
#navbar-container > *:nth-child(5){ transform: translate(-50%,-50%) rotate(90deg)   translate(var(--wheel-radius)) rotate(-90deg) !important; }
#navbar-container > *:nth-child(6){ transform: translate(-50%,-50%) rotate(135deg)  translate(var(--wheel-radius)) rotate(-135deg)!important; }
#navbar-container > *:nth-child(7){ transform: translate(-50%,-50%) rotate(180deg)  translate(var(--wheel-radius)) rotate(-180deg)!important; }
#navbar-container > *:nth-child(8){ transform: translate(-50%,-50%) rotate(225deg)  translate(var(--wheel-radius)) rotate(-225deg)!important; }

.nav-icon{ font-size: 1.20em !important; margin: 0 !important; }
.nav-label{
  font-size: 0.56em !important;
  letter-spacing: 0.04em !important;
  text-align: center !important;
  line-height: 1.05 !important;
  max-width: 66px !important;
  opacity: 0.92 !important;
}

/* ── pages ─────────────────────────────────────────────────── */
#page-container{
  flex: 1 1 auto !important;
  padding: 30px 34px !important;
  background: none !important;
  border-radius: 0 34px 34px 0 !important;
}
#page-container::-webkit-scrollbar{ width: 8px !important; }
#page-container::-webkit-scrollbar-thumb{
  background: rgba(255,255,255,0.16) !important;
  border-radius: 4px !important;
}

.menu-page .page-title{ font-size: 1.9em !important; letter-spacing: 0.01em !important; }
.page-description{ font-size: 0.86em !important; opacity: 0.68 !important; }

/* Sections and rows: glass cards, roomier, no solid backgrounds. */
.menu-page > .section{
  background: rgba(255,255,255,0.045) !important;
  backdrop-filter: blur(20px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(150%) !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  border-radius: 20px !important;
  padding: 16px 18px !important;
  margin-bottom: 18px !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.10) !important;
}
.menu-page > .section:hover{ border-color: rgba(168,140,255,0.34) !important; }

.section-title{ font-size: 1.02em !important; letter-spacing: 0.02em !important; }

.content-option{
  padding: 12px 14px !important;
  border-radius: 14px !important;
  background: rgba(255,255,255,0.03) !important;
  border: 1px solid transparent !important;
  margin-bottom: 8px !important;
  transition: background 160ms ease, border-color 160ms ease !important;
}
.content-option:hover{
  background: rgba(255,255,255,0.075) !important;
  border-color: rgba(255,255,255,0.13) !important;
}
.option-title{ font-size: 0.95em !important; }
.option-description{ font-size: 0.76em !important; opacity: 0.60 !important; }

/* The client's own "transparent" toggle should not put a solid panel back. */
#menu-container.transparent #menu-wrapper{
  background: rgba(122,66,244,0.04) !important;
  backdrop-filter: blur(30px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(30px) saturate(160%) !important;
}
`;

{
  const marker = "const styles_default = ";
  const at = code.indexOf(marker);
  if (at === -1) throw new Error("anchor not found: styles_default");
  const semi = code.indexOf(";\n", at);
  if (semi === -1) throw new Error("unterminated styles_default");
  code = code.slice(0, semi) + " + " + JSON.stringify(MENU_CSS) + code.slice(semi);
  note("menu: glass wheel stylesheet appended (bigger panel, radial categories)");
}

/* ------------------------------------------------------------------ *
 * Write + self-check
 * ------------------------------------------------------------------ */

const survivors = [];
for (const [id] of REMOVE) {
  if (new RegExp(`Settings_default\\.${id}\\b`).test(code)) survivors.push(id);
}
for (const id of ["_legitMode", "_legitModeBackup", "_toggleShop", "_toggleClan"]) {
  if (new RegExp(`Settings_default\\.${id}\\b`).test(code)) survivors.push(id);
}
if (survivors.length) throw new Error("settings still referenced: " + survivors.join(", "));

fs.writeFileSync(OUT, code);
console.log(path.relative(ROOT, OUT));
for (const line of applied) console.log("  - " + line);
console.log("\nno surviving references to any removed setting.");
