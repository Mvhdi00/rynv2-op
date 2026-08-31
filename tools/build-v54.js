#!/usr/bin/env node
/*
 * build-v54.js
 *
 * Applies the two fixes in this repo to RYN Client v5.4 and writes
 * RYN_Client_v5.4_ReUp.user.js.
 *
 * v5.4 is a newer client than the v4 that build-reup.js targets, so the two
 * builds are separate rather than one script guessing which base it has. What
 * v5.4 already fixed is left alone: its Automill has lost the sandbox/age
 * gates, no longer latches itself off on the first refusal, and already places
 * each mill on its own. Only what is still wrong is touched.
 *
 *   1. Automill spacing. The offset is exact tangency, and the game rounds the
 *      place angle to two decimals, so a gap with no clearance loses a mill —
 *      which one depending on the heading.
 *   2. TrapKB, replaced by KnockbackStrike, same as in the v4 build.
 *
 * Anchors live in tools/anchors/ and replacement bodies in tools/modules/, so
 * a stale anchor fails the build loudly rather than producing a half-patched
 * script.
 *
 *   node tools/build-v54.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/RYN_Client_v5.4.js");
const OUT = path.join(ROOT, "RYN_Client_v5.4_ReUp.user.js");

const anchor = (name) => fs.readFileSync(path.join(ROOT, "tools/anchors", name), "utf8");
const body = (name) => fs.readFileSync(path.join(ROOT, "tools/modules", name), "utf8");

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* Decode a page constant, hand the markup to `transform`, re-encode. */
function editPage(constName, transform, label) {
  const declaration = `const ${constName} = `;
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error(`page constant not found: ${constName}`);
  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");
  // eslint-disable-next-line no-eval
  const html = eval(literal);
  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(transform(html)) +
    ";" +
    code.slice(lineEnd);
  applied.push(label);
}

function replaceInPage(constName, findHtml, replaceHtml, label) {
  editPage(
    constName,
    (html) => {
      const parts = html.split(findHtml);
      if (parts.length === 1) throw new Error(`page anchor not found in ${constName}: ${label}`);
      if (parts.length > 2) throw new Error(`page anchor is ambiguous in ${constName}: ${label}`);
      return parts[0] + replaceHtml + parts[1];
    },
    label
  );
}

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 * ------------------------------------------------------------------ */

const header = `// ==UserScript==
// @name            RYN v5.4 (ReUp)
// @namespace       reup-mix
// @author          RYN v5.4 by Raptor
// @description     RYN v5.4 with the automill spacing fixed and Trap KB replaced by Knockback Strike
// @icon            https://i.postimg.cc/d0mMvHYF/ryn5.webp
// @version         5.4.1
// @match           *://moomoo.io/
// @match           *://moomoo.io/?server*
// @match           *://*.moomoo.io/
// @match           *://*.moomoo.io/?server*
// @run-at          document-start
// @grant           none
// @license         MIT
// ==/UserScript==
`;

{
  const end = code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of base userscript header");
  code = header + code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  applied.push("header: rewritten for the ReUp build");
}

/* ------------------------------------------------------------------ *
 * 2. Drop the phone-home beacon
 *
 * v5.4 opens with a fetch to a webhook.site endpoint on first run, gated by a
 * localStorage flag. It carries no payload beyond the hit itself, but it is an
 * unannounced call to a third party, so it goes — same as in the v4 build.
 * ------------------------------------------------------------------ */

{
  const beacon = code.match(
    /\(function\(\) \{\s*try \{\s*if \(!localStorage\.getItem\("_ryn_sent"\)\)[\s\S]*?\}\)\(\);\s*/
  );
  if (beacon) {
    code = code.replace(
      beacon[0],
      "/* removed in the ReUp build: v5.4's first-run beacon to webhook.site */\n\n"
    );
    applied.push("privacy: removed first-run webhook.site beacon");
  }
}

/* ------------------------------------------------------------------ *
 * 3. Automill: three mills in every direction
 *
 * v5.4 already places each mill independently, so the all-or-nothing gate that
 * the v4 build had to remove is gone here. What is left is the spacing and the
 * reference position:
 *
 *   · The offset is exact tangency. Neighbouring mills land centre-to-centre
 *     at exactly 2 * scale and the server's test is a strict
 *     `distance < scaleA + scaleB`, so the build survives only while nothing
 *     rounds the gap down. The game rounds the place angle to two decimals
 *     (`M.fixTo(dir, 2)`, Ci() in src/game_index.js), which at the windmill's
 *     85-unit place radius is ~0.85 units of arc per angle. Whether a mill is
 *     lost depends on where base +/- offset lands on the 0.01 grid — the
 *     heading. Sweeping 72000 headings it is short at 89.5% of them.
 *   · canPlaceObject tests at pos.current, but a place sent this tick is
 *     applied after the move. AutoGrind.placeTurret already tests at
 *     pos.future.
 * ------------------------------------------------------------------ */

/* Two world units of clearance between neighbouring mills. One unit is the
 * minimum that survives the rounding above; two leaves the worst-case gap at
 * 91.3 against a bar of 90, and is invisible on a 90-unit-wide pair. */
edit(
  "automill: clearance constant",
  `  const AUTOMILL_PLACE_COST = 5;`,
  `  const AUTOMILL_PLACE_COST = 5;
  const AUTOMILL_MARGIN = 2;`
);

edit(
  "automill: spacing with real clearance",
  anchor("v54-automill-spacing.txt"),
  body("v54-automill-spacing.js")
);

edit(
  "automill: test where the server will place",
  anchor("v54-automill-canplace.txt"),
  body("v54-automill-canplace.js")
);

/* ------------------------------------------------------------------ *
 * 4. Knockback Strike (replaces TrapKB)
 *
 * Identical to the v4 build: TrapKB and the EnemyManager scan behind it are
 * removed and one module takes their place. See the comment written into the
 * client for what changed and why.
 * ------------------------------------------------------------------ */

edit(
  "kb strike: replace the TrapKB class",
  anchor("v54-trapkb-class.txt"),
  body("knockback-strike.js")
);

edit(
  "kb strike: drop the EnemyManager pit-trap scan",
  anchor("v54-kb-scan.txt"),
  ""
);

edit(
  "kb strike: drop the EnemyManager pit-trap fields",
  `    nearestKBTrapEnemy=null;
    nearestKBTrap=null;
`,
  ""
);

edit(
  "kb strike: drop the EnemyManager pit-trap reset",
  `      this.nearestKBTrapEnemy = null;
      this.nearestKBTrap = null;
`,
  ""
);

edit(
  "kb strike: module registration",
  `        trapKB: new TrapKB(client2),`,
  `        knockbackStrike: new KnockbackStrike(client2),`
);

edit(
  "kb strike: module run order",
  `this.staticModules.trapKB, `,
  `this.staticModules.knockbackStrike, `
);

edit(
  "kb strike: settings keys",
  `    _trapKB: true,`,
  `    _knockbackStrike: true,
    _knockbackStrikeTrap: true,`
);

replaceInPage(
  "Combat_default",
  `            <div class="content-option">\r
                <label class="option-title" for="_trapKB">Trap KB</label>\r
                <label class="switch-checkbox">\r
                    <input id="_trapKB" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
            </div>\r
`,
  `            <div class="content-option">\r
                <label class="option-title" for="_knockbackStrike">KB Strike</label>\r
                <label class="switch-checkbox">\r
                    <input id="_knockbackStrike" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Hits when the recoil would carry them onto one of your spikes or traps.</span>\r
            </div>\r
            <div class="sub-options">\r
            <div class="content-option">\r
                <label class="option-title" for="_knockbackStrikeTrap">KB Strike (trap)</label>\r
                <label class="switch-checkbox">\r
                    <input id="_knockbackStrikeTrap" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Counts your pit traps as a landing spot, not just spikes.</span>\r
            </div>\r
            </div>\r
`,
  "kb strike: menu entries"
);

/* Any leftover reference to the removed key would silently re-enable a module
 * that no longer exists. There should be none. */
{
  const left = code.split("_trapKB").length - 1;
  if (left > 0) throw new Error(`_trapKB still referenced ${left} time(s) after the swap`);
}

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
