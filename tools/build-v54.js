#!/usr/bin/env node
/*
 * build-v54.js
 *
 * RYN Client v5.4 with one change: TrapKB is replaced by KnockbackStrike.
 * Everything else in v5.4 is left exactly as it shipped.
 *
 * Anchors live in tools/anchors/ and the module body in tools/modules/, so a
 * stale anchor fails the build loudly rather than producing a half-patched
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
 * Knockback Strike (replaces TrapKB)
 *
 * TrapKB asked, once per pit trap, whether the trap fell inside a cone drawn
 * from the player through the target and whether the target was within
 * getActualMaxKnockback of it. A cone anchored at the player widens with
 * distance, the range gate spent a knockback budget with the secondary and the
 * turret folded in whether or not either was firing, and it only ever looked
 * at pit traps.
 *
 * KnockbackStrike walks the actual push segment instead, and covers spikes and
 * cactus as well as traps. Its two switches are independent — spikes and traps
 * are separate reasons to swing, so neither is a sub-option of the other and
 * turning one off leaves the other running.
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

/* Two switches at the same level. Nesting the trap one under the spike one
 * made the spike switch a master that silenced both, which is not what either
 * of them is for. */
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
                <label class="option-title" for="_knockbackStrike">KB Strike (spike)</label>\r
                <label class="switch-checkbox">\r
                    <input id="_knockbackStrike" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_knockbackStrikeTrap">KB Strike (trap)</label>\r
                <label class="switch-checkbox">\r
                    <input id="_knockbackStrikeTrap" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
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
