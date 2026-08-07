#!/usr/bin/env node
/*
 * build-player.js
 *
 * The player build is the owner build with three things changed, and nothing
 * else - keeping them in one script is what stops the two files drifting apart.
 *
 *   1. the userscript @name tag
 *   2. RYN_ROLE, which decides which half of the owner/player handshake runs
 *   3. the "Mark RYN Players" row in Visuals, an owner-only readout
 *
 *   node tools/build-player.js [owner.user.js] [player.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OWNER = process.argv[2] || path.join(ROOT, "RYN_Client_v5_OWNER.user.js");
const PLAYER = process.argv[3] || path.join(ROOT, "RYN_Client_v5_PLAYER.user.js");

let src = fs.readFileSync(OWNER, "utf8");

/* Exactly one hit each, or the owner build moved and this script is stale. */
function swap(from, to) {
  const hits = src.split(from).length - 1;
  if (hits !== 1) throw new Error(`expected 1 occurrence of ${JSON.stringify(from)}, found ${hits}`);
  src = src.replace(from, to);
}

swap("// @name            1! RYN Client v5 [OWNER]", "// @name            1! RYN Client v5 [PLAYER]");
swap('const RYN_ROLE = "owner";', 'const RYN_ROLE = "player";');

/* Visuals is a JSON-encoded HTML blob on one line; decode, cut the row, re-encode. */
const visuals = src.match(/^(\s*const Visuals_default = )(".*");$/m);
if (!visuals) throw new Error("Visuals_default not found");

const html = JSON.parse(visuals[2]);
const open = html.indexOf('<div class="content-option">\r\n                <span class="option-title">Mark RYN Players');
if (open === -1) throw new Error("Mark RYN Players row not found");
const close = html.indexOf("</div>\r\n", html.indexOf("Owner build only."));
if (close === -1) throw new Error("end of Mark RYN Players row not found");

const trimmed = html.slice(0, open) + html.slice(close + "</div>\r\n".length);
if (trimmed.includes("_markRynPlayers")) throw new Error("_markRynPlayers survived the cut");

src = src.replace(visuals[0], visuals[1] + JSON.stringify(trimmed) + ";");

fs.writeFileSync(PLAYER, src);
console.log(`${path.relative(ROOT, PLAYER)} written from ${path.relative(ROOT, OWNER)}`);
