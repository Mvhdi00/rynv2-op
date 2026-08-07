#!/usr/bin/env node
/*
 * build-player.js
 *
 * The player build is the owner build with three things changed, and nothing
 * else - keeping them in one script is what stops the two files drifting apart.
 *
 *   1. the userscript @name tag
 *   2. RYN_ROLE, which decides which half of the owner/player handshake runs
 *   3. the "Mark RYN Players" row in Visuals, an owner-only readout whose code
 *      is gated on RYN_IS_OWNER_BUILD and so reads as a dead switch here
 *
 * Every edit is anchored to an exact string, and an anchor that is missing or
 * matches more than once fails the build rather than half-applying. The row is
 * found by the id of the control inside it and cut by walking div depth, so
 * editing its label or its wording does not silently orphan this script.
 *
 *   node tools/build-player.js [owner.user.js] [player.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OWNER = process.argv[2] || path.join(ROOT, "RYN_Client_v5_OWNER.user.js");
const PLAYER = process.argv[3] || path.join(ROOT, "RYN_Client_v5_PLAYER.user.js");

/* Menu rows to drop, named by the id of the control inside them. */
const OWNER_ONLY_ROWS = [{ page: "Visuals", id: "_markRynPlayers" }];

let src = fs.readFileSync(OWNER, "utf8");

function swap(from, to) {
  const hits = src.split(from).length - 1;
  if (hits !== 1) throw new Error(`expected 1 occurrence of ${JSON.stringify(from)}, found ${hits}`);
  src = src.replace(from, to);
}

/* Cuts the <div class="content-option"> ... </div> that wraps a given control,
 * by walking div depth forward from the row's opening tag. */
function cutRow(html, id) {
  const at = html.indexOf(`id="${id}"`);
  if (at === -1) throw new Error(`control ${id} not found`);

  const open = html.lastIndexOf('<div class="content-option', at);
  if (open === -1) throw new Error(`no content-option wrapping ${id}`);

  let depth = 0;
  let i = open;
  let end = -1;
  while (i < html.length) {
    const nextOpen = html.indexOf("<div", i);
    const nextClose = html.indexOf("</div>", i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
      continue;
    }
    depth--;
    i = nextClose + 6;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error(`unbalanced markup around ${id}`);

  /* Take the trailing newline and indent with it so the page keeps its shape. */
  const tail = html.slice(end).match(/^\r?\n\s*/);
  const cut = html.slice(0, end).slice(0, open) + html.slice(end + (tail ? tail[0].length : 0));
  if (cut.includes(`id="${id}"`)) throw new Error(`${id} survived the cut`);
  return cut;
}

swap("// @name            1! RYN Client v5 [OWNER]", "// @name            1! RYN Client v5 [PLAYER]");
swap('const RYN_ROLE = "owner";', 'const RYN_ROLE = "player";');

/* Each page is a JSON-encoded HTML blob on one line; decode, cut, re-encode. */
for (const { page, id } of OWNER_ONLY_ROWS) {
  const decl = src.match(new RegExp(`^(\\s*const ${page}_default = )(".*");$`, "m"));
  if (!decl) throw new Error(`${page}_default not found`);
  const cleaned = cutRow(JSON.parse(decl[2]), id);
  src = src.replace(decl[0], decl[1] + JSON.stringify(cleaned) + ";");
}

fs.writeFileSync(PLAYER, src);
console.log(
  `${path.relative(ROOT, PLAYER)} written from ${path.relative(ROOT, OWNER)} ` +
    `(dropped ${OWNER_ONLY_ROWS.map((r) => r.id).join(", ")})`
);
