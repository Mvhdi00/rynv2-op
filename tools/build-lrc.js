#!/usr/bin/env node
/*
 * build-lrc.js
 *
 * Builds Ryn_Type_2_LRC.user.js by folding src/lrc/lrc-ai.js into
 * src/Ryn_Type_2.user.js.
 *
 * The module is injected, not merged: it goes in as one contiguous block
 * immediately after the MusicPlayer singleton is defined, inside the same
 * IIFE, and attaches itself by wrapping four MusicPlayer methods. Nothing in
 * the base client is rewritten, so a newer Ryn Type 2 can be dropped into
 * src/ and rebuilt.
 *
 * Every edit goes through edit(), so a stale or ambiguous anchor fails the
 * build loudly instead of silently producing a half-injected script.
 *
 *   node tools/build-lrc.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Ryn_Type_2.user.js");
const MODULE = path.join(ROOT, "src/lrc/lrc-ai.js");
const OUT = path.join(ROOT, "Ryn_Type_2_LRC.user.js");

let code = fs.readFileSync(BASE, "utf8");
const module_ = fs.readFileSync(MODULE, "utf8");
const applied = [];

function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* ------------------------------------------------------------------ *
 * 0. Sanity: the module has to be able to find what it hooks
 *
 * These are the only things in the base client the module touches. If a
 * newer Ryn renames any of them, the build stops here rather than shipping
 * a script whose lyrics button does nothing.
 * ------------------------------------------------------------------ */

const REQUIRED = [
  ["MusicPlayer singleton",   "const MusicPlayer = new class {"],
  ["MusicPlayer.play",        "\n    play(index) {"],
  ["MusicPlayer.seekTo",      "\n    seekTo(pct) {"],
  ["MusicPlayer._renderSongList", "\n    _renderSongList() {"],
  ["MusicPlayer._reflowLRC",  "\n    _reflowLRC(list) {"],
  ["MusicPlayer._parseLRC",   "\n    _parseLRC(raw) {"],
  ["MusicPlayer._save",       "\n    _save() {"],
  ["MusicPlayer._toast",      "\n    _toast(msg) {"],
  ["MusicPlayer._tickSync",   "\n    _tickSync() {"],
  ["song list container",     'querySelector("#song-list")'],
  ["song row icons",          'class="rm-s-icons"'],
  ["song row number cell",    'class="rm-snum"']
];

for (const [label, needle] of REQUIRED) {
  const hits = code.split(needle).length - 1;
  if (hits === 0) throw new Error(`required hook site missing: ${label}`);
  if (hits > 1 && !label.startsWith("song row")) {
    throw new Error(`required hook site is ambiguous (${hits} hits): ${label}`);
  }
  applied.push(`verified: ${label}`);
}

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 *
 * Same script, one minor version on, with the module named in the
 * description so an installed copy is identifiable at a glance.
 * ------------------------------------------------------------------ */

const header = `// ==UserScript==
// @name           ! Ryn Type 2
// @author          By : Raptor
// @description     ! have fun — Type 2 teaches auto place, preplace and replace the primary-knockback spike chain from Novastorm, plus LRC AI: automatic synced lyrics, translated to English and cached per song
// @match        *://*.moomoo.io/*
// @icon            https://i.postimg.cc/d0mMvHYF/ryn5.webp
// @version         2.1
// @run-at          document-start
// @grant           none
// @license         MIT
// ==/UserScript==`;

{
  const start = code.indexOf("// ==UserScript==");
  const end = code.indexOf("// ==/UserScript==");
  if (start !== 0 || end === -1) throw new Error("could not find the base userscript header");
  code = header + code.slice(end + "// ==/UserScript==".length);
  applied.push("header: version 2.1, LRC AI noted in the description");
}

/* ------------------------------------------------------------------ *
 * 2. Inject the module
 *
 * The anchor is the first statement after the MusicPlayer singleton's
 * closing brace. Injecting here puts the module in the same scope as
 * MusicPlayer (which it wraps) and after its definition (so the attach call
 * at the bottom of the module runs against a defined binding), while
 * MusicPlayer.init() — which fires later, when the menu iframe is built —
 * still finds the wrapped methods in place.
 * ------------------------------------------------------------------ */

const ANCHOR = "  let fKeyHeld = false, fKeyInterval = null;";

edit(
  "inject LRC AI module after the MusicPlayer singleton",
  ANCHOR,
  "\n" +
  "  /* ==== BEGIN LRC AI (src/lrc/lrc-ai.js) ==== */\n" +
  module_.trimEnd() + "\n" +
  "  /* ==== END LRC AI ==== */\n\n" +
  ANCHOR
);

/* ------------------------------------------------------------------ *
 * 3. Write it out
 * ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

const moduleLines = module_.split("\n").length;
console.log(`built ${path.relative(ROOT, OUT)}`);
console.log(`  base    ${path.relative(ROOT, BASE)}  (${code.split("\n").length - moduleLines} lines)`);
console.log(`  module  ${path.relative(ROOT, MODULE)}  (${moduleLines} lines)`);
console.log("");
for (const a of applied) console.log(`  - ${a}`);
