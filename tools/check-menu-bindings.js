#!/usr/bin/env node
/*
 * check-menu-bindings.js
 *
 * The menu is markup inside string literals and the settings are an object
 * literal a long way away, and nothing connects them until the page is open in
 * a browser. attachCheckboxes, attachSliders, attachTextInputs,
 * attachColorPickers and attachSelects each look their control's id up in
 * Settings and, when it is not there, log an error and move on — so a control
 * whose setting was renamed or removed looks completely normal and simply does
 * nothing when clicked.
 *
 * This walks every menu page and checks:
 *
 *   - every checkbox, slider, colour picker, text input and select on every
 *     page is bound to a real key of Settings
 *   - no element id is used twice across the whole menu
 *   - every reset-color button is immediately followed by its colour input,
 *     which is how attachColorPickers finds it (previousElementSibling)
 *   - every module named in ModuleHandler's tick lists is actually constructed
 *
 *   node tools/check-menu-bindings.js [path/to/Ryn_Type_2.user.js]
 *
 * Exits non-zero if any check fails.
 */
const fs = require("fs");
const path = require("path");

const CLIENT_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "..", "Ryn_Type_2.user.js");
const client = fs.readFileSync(CLIENT_PATH, "utf8");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  — " + detail : ""));
}

/* Read a double-quoted JS string literal starting at `quote`, unescaping it. */
function stringLiteralAt(src, quote) {
  let out = "";
  let i = quote + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      const n = src[i + 1];
      out += n === "n" ? "\n" : n === "t" ? "\t" : n;
      i += 2;
      continue;
    }
    if (c === '"') return out;
    out += c;
    i++;
  }
  throw new Error("unterminated string literal");
}

const PAGES = ["Keybinds", "Combat", "Visuals", "Misc", "Bots", "Music", "Navbar"];
const pages = new Map();
for (const name of PAGES) {
  const decl = client.indexOf(`const ${name}_default = "`);
  if (decl < 0) continue;
  pages.set(name, stringLiteralAt(client, client.indexOf('"', decl)));
}
check("menu: every page is present", pages.size === PAGES.length,
  [...pages.keys()].join(", ") + (pages.size === PAGES.length ? "" : " — missing " + PAGES.filter(p => !pages.has(p)).join(", ")));

/* The Settings object literal, found through a key that is certainly in it. */
const anchor = client.indexOf("_itemHealthBar: false,");
if (anchor < 0) throw new Error("could not locate Settings");
const settingsBlock = client.slice(client.lastIndexOf("= {", anchor), client.indexOf("\n  };", anchor));
const settings = new Set([...settingsBlock.matchAll(/^\s{4}(_\w+):/gm)].map(m => m[1]));
check("settings: the object literal was found", settings.size > 50, settings.size + " keys");

/* Controls, per page, per kind. */
const KINDS = [
  ["checkbox", /<input id="(\w+)" type="checkbox"/g],
  ["slider", /<input id="(\w+)" type="range"/g],
  ["colour", /<input id="(\w+)" type="color"/g],
  ["text", /<input id="(\w+)" type="text"/g],
  ["select", /<select id="(\w+)"/g]
];
const unbound = [];
let controls = 0;
for (const [page, html] of pages) {
  for (const [kind, pattern] of KINDS) {
    for (const m of html.matchAll(pattern)) {
      controls++;
      if (!settings.has(m[1])) unbound.push(`${page}: ${kind} "${m[1]}"`);
    }
  }
}
check("menu: every control is bound to a real setting",
  unbound.length === 0, unbound.length ? unbound.join(" | ") : controls + " controls across " + pages.size + " pages");

/* Element ids, across the whole menu. `data-id` is not an id — the lookbehind
 * keeps `data-id="3"` on the nav buttons out of it. */
const seen = new Map();
for (const [page, html] of pages) {
  for (const m of html.matchAll(/(?<![-\w])id="([^"]+)"/g)) {
    if (!seen.has(m[1])) seen.set(m[1], []);
    seen.get(m[1]).push(page);
  }
}
const dupes = [...seen].filter(([, ps]) => ps.length > 1);
check("menu: no id is used twice",
  dupes.length === 0, dupes.length ? dupes.map(([i, ps]) => `"${i}" in ${ps.join("+")}`).join(", ") : seen.size + " unique ids");

/* attachColorPickers takes the reset button as picker.previousElementSibling
 * and silently does nothing when it is not one, so a button orphaned by a
 * removed picker is a dead control. */
const stray = [];
for (const [page, html] of pages) {
  for (const m of html.matchAll(/<button class="reset-color"[^>]*><\/button>/g)) {
    const after = html.slice(m.index + m[0].length).replace(/^\s+/, "");
    if (!/^<input\b[^>]*type="color"/.test(after)) stray.push(page + ": " + after.slice(0, 40));
  }
}
check("menu: every reset-color button still has its colour input",
  stray.length === 0, stray.length ? stray.join(" | ") : "all paired");

/* Modules named in the tick lists have to exist in staticModules. */
const built = new Set([...client.matchAll(/^\s{8}(\w+): new /gm)].map(m => m[1]));
const referenced = new Set();
for (const list of client.matchAll(/this\.(?:botModules|modules) = \[([^\]]*)\]/g)) {
  for (const m of list[1].matchAll(/this\.staticModules\.(\w+)/g)) referenced.add(m[1]);
}
const missingModules = [...referenced].filter(name => !built.has(name));
check("modules: every module in the tick lists is constructed",
  missingModules.length === 0,
  missingModules.length ? "missing: " + missingModules.join(", ") : referenced.size + " referenced, " + built.size + " built");

/* Nothing should be left pointing at a removed symbol. */
const removed = ["circularBar", "_itemHealthBarEnemyColor", "_scatterReturning", "SCATTER_RETURN_TIMEOUT_MS"];
const lingering = removed.filter(name => client.includes(name));
check("cleanup: nothing references a symbol that was removed",
  lingering.length === 0, lingering.length ? "still present: " + lingering.join(", ") : removed.join(", ") + " all gone");

const failed = results.filter(r => !r.ok);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
process.exit(failed.length ? 1 : 0);
