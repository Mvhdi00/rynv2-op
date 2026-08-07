#!/usr/bin/env node
/*
 * fix-mods.js
 *
 * Rebuilds the third-party userscripts in src/mods/ against the shipped game
 * bundle, writing installable scripts to mods/.
 *
 * None of these mods could talk to the current game. They were written for the
 * old transport — bare msgpack `[typeString, args]` in both directions — and
 * the game now negotiates a per-connection opcode permutation and signs every
 * client frame. See src/moo-transport-shim.js for the protocol and the
 * approach; the shim is what restores the old contract, and this tool is only
 * concerned with getting it in front of each mod correctly.
 *
 * Four edits per mod:
 *
 *   1. The metadata block is moved to the top of the file if it is not already
 *      there. A userscript manager only parses it when it comes first.
 *
 *   2. `@run-at document-start` is added. The game captures
 *      WebSocket.prototype.send into a private binding as its bundle evaluates
 *      and calls that captured reference for every packet, then locks
 *      window.WebSocket with defineProperty. Anything installed after the
 *      bundle is simply never called.
 *
 *   3. Dead `@require` lines are dropped. rawgit.com was shut down in 2019, so
 *      the mods that pulled msgpack-lite from it have had an undefined
 *      `msgpack` global ever since. The shim carries its own codec and
 *      publishes `window.msgpack`, so the dependency goes away rather than
 *      moving to another host.
 *
 *   4. The body is wrapped in a readiness gate. document-start is early enough
 *      that `document.body` does not exist yet, and several of these mods build
 *      DOM at top level. The gate holds the body until <body> exists — and,
 *      for the mods that use jQuery, until the page's jQuery has loaded. That
 *      still lands well before the game bundle runs, because the bundle is a
 *      module script and module scripts are deferred to after parsing.
 *
 *   node tools/fix-mods.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src/mods");
const OUT = path.join(ROOT, "mods");

const shim = fs.readFileSync(path.join(ROOT, "src/moo-transport-shim.js"), "utf8");

/* @require targets that no longer serve what the mod expects. */
const DEAD_REQUIRE = /^\s*\/\/\s*@require\s+.*(rawgit\.com|energyaproton2\.onrender\.com|msgpack)/i;

const META_START = "// ==UserScript==";
const META_END = "// ==/UserScript==";

/* Two of these mods also inject a <script src=...> for the same dead msgpack
 * copy at runtime, on top of the @require. The request 404s and the mod then
 * runs on whatever `msgpack` happens to be defined — which, with the shim
 * loaded, is the shim's own codec. Point the tag at an empty data: URL so the
 * element still appends but nothing is fetched. */
const DEAD_SCRIPT_SRC =
  /(\.src\s*=\s*)["']https?:\/\/(?:rawgit\.com|energyaproton2\.onrender\.com)[^"']*["']/g;

function splitScript(src) {
  const start = src.indexOf(META_START);
  const end = src.indexOf(META_END);
  if (start === -1 || end === -1) throw new Error("no userscript metadata block");

  const meta = src.slice(start, end + META_END.length).split(/\r?\n/);
  const body = (src.slice(0, start) + src.slice(end + META_END.length)).replace(/^\s*\n/, "");
  return { meta, body, wasFirst: start === 0 };
}

function fixMeta(meta, notes) {
  const out = [];
  let dropped = 0;

  for (const line of meta) {
    if (DEAD_REQUIRE.test(line)) { dropped++; continue; }
    out.push(line.replace(/\s+$/, ""));
  }
  if (dropped) notes.push(`dropped ${dropped} dead @require line(s) — the shim provides window.msgpack`);

  if (!out.some((l) => /@run-at/.test(l))) {
    out.splice(out.length - 1, 0, "// @run-at        document-start");
    notes.push("added @run-at document-start");
  }

  return out;
}

const BOOT = (needsJQuery) => `
/* ---- readiness gate --------------------------------------------------
 * @run-at document-start runs before <body> exists, and this script builds
 * DOM at top level. Hold it until the document has a body${needsJQuery ? " and the page's\n * jQuery has loaded" : ""}.
 *
 * This still runs before the game does: the game bundle is a module script,
 * and module scripts are deferred until after the document is parsed. So the
 * gate opens while parsing is still in progress, which leaves any
 * WebSocket.prototype.send hook below in place before the bundle captures it.
 * -------------------------------------------------------------------- */
(function (start) {
  var started = false;
  function ready() {
    return !!document.body${needsJQuery ? ' && typeof window.$ === "function"' : ""};
  }
  function go() {
    if (started || !ready()) return;
    started = true;
    if (observer) observer.disconnect();
    start();
  }
  var observer = window.MutationObserver
    ? new MutationObserver(go)
    : null;
  if (observer) observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", go);
  window.addEventListener("load", go);
  go();
})(function () {
`;

function build(file) {
  const name = path.basename(file, ".js");
  const src = fs.readFileSync(path.join(SRC, file), "utf8");
  const notes = [];

  const { meta, body: rawBody, wasFirst } = splitScript(src);
  if (!wasFirst) notes.push("moved the metadata block to the top of the file — a userscript manager only parses it there");

  const fixedMeta = fixMeta(meta, notes);

  let injected = 0;
  const body = rawBody.replace(DEAD_SCRIPT_SRC, (_, lhs) => {
    injected++;
    return lhs + '"data:text/javascript,"';
  });
  if (injected) {
    notes.push(`neutralised ${injected} runtime <script> injection(s) of the dead msgpack CDN`);
  }

  /* Only gate on jQuery for the mods that actually use it; waiting on a global
   * a script never touches would hang it forever on a page without jQuery. */
  const needsJQuery = /(^|[^\w.$])\$\s*\(/.test(body) || /\bjQuery\b/.test(body);
  if (needsJQuery) notes.push("body gated on jQuery as well as <body> — it calls $() at top level");

  const out = [
    fixedMeta.join("\n"),
    "",
    "/* Rebuilt by tools/fix-mods.js against src/game_index.js + src/game_vendor.js.",
    " * Source: src/mods/" + file,
    " *",
    " * Changes:",
    ...notes.map((n) => " *   - " + n),
    " *   - prepended src/moo-transport-shim.js so the script speaks the game's",
    " *     current transport (permuted opcodes, sequence counter, signed frames)",
    " */",
    "",
    shim.trim(),
    "",
    BOOT(needsJQuery),
    body,
    "});",
    "",
  ].join("\n");

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name + ".user.js"), out);

  return { name, notes, bytes: out.length };
}

const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".js")).sort();
if (!files.length) {
  console.error("no mods in src/mods");
  process.exit(1);
}

console.log("shim   : src/moo-transport-shim.js");
console.log("");

for (const file of files) {
  const r = build(file);
  console.log(`mods/${r.name}.user.js`);
  for (const n of r.notes) console.log("  - " + n);
  console.log("");
}

console.log(`built ${files.length} script(s) into mods/`);
