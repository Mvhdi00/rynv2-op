#!/usr/bin/env node
/*
 * fix-ryn.js
 *
 * Repairs Ryn Type 2 against the game bundle it has to run on, and changes
 * nothing else. The output is Ryn Type 2 — same name, same features, same
 * branding — with the nine orphaned bundle hooks re-anchored and the transport
 * gaps closed. It is a drop-in replacement for the input.
 *
 * What it fixes, and why each one matters, is in tools/repairs.js. In short:
 * the hook that starts the game, the four that name the transport's own
 * functions, the one that was deleting 924 characters of the wrong code, two
 * renderer hooks, and the two places the client was relying on values that
 * happen to be right rather than on reading the bundle.
 *
 * For the same repairs plus the Luna features, see tools/build-reup.js.
 *
 *   node tools/fix-ryn.js
 */

const fs = require("fs");
const path = require("path");

const { Editor } = require("./edits.js");
const repairs = require("./repairs.js");
const tweaks = require("./tweaks.js");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Ryn_Type_2.user.js");
const OUT = path.join(ROOT, "Ryn_Type_2.user.js");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

const editor = new Editor(fs.readFileSync(BASE, "utf8"));

/* The groups this base still needs. 2.9.4 absorbed the hook and transport
 * repairs upstream (tools/check-hooks.js, tools/check-wire.js); what it still
 * gets wrong on the bot path is the device each bot joins as, getting each
 * bot its Cloudflare check when the page's window.turnstile is dead, and a
 * fleet that runs into the join API's per-address limit giving up. */
const GROUPS = ["bots", "turnstile", "joins"];
repairs.apply(editor, DRIVERS, GROUPS);

// What the user asked for on top (tools/tweaks.js): the token pool at 50, a
// bottom-right corner that stays empty unless Cloudflare wants a click, no
// building and no Flipper in the Crab King's arena, and "Crabking movment" in
// the Bots menu.
tweaks.apply(editor, ["pool50", "quietChecks", "crabArena", "crabMovement"]);

/* The version, so an installed copy can be told from the one it replaced.
 * Everything else in the header is the client's own. */
{
  const version = editor.code.match(/^\/\/ @version(\s+)([\d.]+)\s*$/m);
  if (!version) throw new Error("could not find @version in the userscript header");
  editor.edit(
    "header: version " + version[2] + " -> " + version[2] + "-fix4",
    version[0],
    "// @version" + version[1] + version[2] + "-fix4"
  );
}

fs.writeFileSync(OUT, editor.code);

console.log("wrote", path.relative(ROOT, OUT));
console.log(`  from ${path.relative(ROOT, BASE)}`);
console.log(`  ${(editor.code.length / 1024).toFixed(0)} KB, ${editor.code.split("\n").length} lines\n`);
for (const step of editor.applied) console.log("  + " + step);
console.log(
  "\nverify:\n" +
  "  node tools/check-hooks.js Ryn_Type_2.user.js\n" +
  "  node tools/check-wire.js Ryn_Type_2.user.js\n" +
  "  node tools/verify-drivers.js Ryn_Type_2.user.js\n" +
  "  node --check Ryn_Type_2.user.js"
);
