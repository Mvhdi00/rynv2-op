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

const shimSrc = fs.readFileSync(path.join(ROOT, "src/moo-transport-shim.js"), "utf8");

/* The shipped scripts carry no commentary of ours — only the mod's own. Strip
 * the shim's comments rather than maintaining a second copy of it, tracking
 * string state so a `//` inside a literal survives. The shim contains no regex
 * literals, which is the one case this does not handle. */
function stripComments(src) {
  let out = "";
  for (let i = 0; i < src.length; ) {
    const c = src[i];

    if (c === '"' || c === "'" || c === "`") {
      out += c;
      for (i++; i < src.length; ) {
        if (src[i] === "\\") { out += src[i] + src[i + 1]; i += 2; continue; }
        out += src[i];
        if (src[i] === c) { i++; break; }
        i++;
      }
      continue;
    }

    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }

    if (c === "/" && src[i + 1] === "*") {
      for (i += 2; i < src.length && !(src[i] === "*" && src[i + 1] === "/"); i++);
      i += 2;
      continue;
    }

    out += c;
    i++;
  }

  return out
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const shim = stripComments(shimSrc);

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

/* Match the block's own column layout — these headers are hand-aligned and
 * each file pads differently. */
function metaLine(lines, key, value) {
  const sample = lines.find((l) => /^\/\/\s+@[\w-]+\s+\S/.test(l));
  if (!sample) return `// ${key} ${value}`;

  const lead = sample.match(/^\/\/(\s+)/)[1];
  const column = sample.match(/^\/\/(\s+@[\w-]+\s+)\S/)[1].length;

  let gap = lead + key;
  gap += gap.length < column ? " ".repeat(column - gap.length) : " ";
  return "//" + gap + value;
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
    out.splice(out.length - 1, 0, metaLine(out, "@run-at", "document-start"));
    notes.push("added @run-at document-start");
  }

  return out;
}

const BOOT = (needsJQuery) => `
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
    shim,
    "",
    BOOT(needsJQuery),
    body,
    "});",
    "",
  ].join("\n");

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name + ".js"), out);

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
  console.log(`mods/${r.name}.js`);
  for (const n of r.notes) console.log("  - " + n);
  console.log("");
}

console.log(`built ${files.length} script(s) into mods/`);
