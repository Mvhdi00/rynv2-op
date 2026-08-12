#!/usr/bin/env node
/**
 * novastorm's own removals, put back.
 *
 * The generic repair in tools/repair-mod.js only fixes what the years broke.
 * This is different: novastorm's author deliberately tore a piece of moomoo's
 * menu out, with a comment saying so --
 *
 *     document.getElementById("altServer").remove(); // REMOVE THE link to sandbox / normal moo
 *
 * -- and it survived only because, until the transport was fixed, novastorm
 * never ran far enough to reach that line. Now that it does, the link is gone,
 * and the player who uses it wants it. Their file, their call.
 *
 * Kept as its own step rather than folded into repair-mod.js, because
 * "undoing a choice the author made on purpose" is not a repair and should not
 * happen to every mod that passes through.
 *
 * Usage: node tools/patch-novastorm.js <in.js> <out.js>
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node tools/patch-novastorm.js <in.js> <out.js>'); process.exit(2); }

let src = fs.readFileSync(IN, 'utf8');
const report = [];

/* --- the sandbox link ----------------------------------------------------- */
// Matched with the author's own comment attached, so this can only ever hit the
// line it was written for. repair-mod.js has already made the call optional.
const link = /^[ \t]*document\.getElementById\("altServer"\)\??\.remove\(\);[^\n]*\n/m;
if (!link.test(src)) {
  console.error('patch-novastorm: the altServer removal is not there any more -- check whether this step is still needed');
  process.exit(1);
}
src = src.replace(link, '');
report.push('sandbox link kept ("Try the sandbox" / "Back to MooMoo")');

try { acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); }
catch (e) { console.error('patch-novastorm: the result does not parse -- ' + e.message); process.exit(1); }

fs.writeFileSync(OUT, src);
console.log('novastorm 1.4');
for (const line of report) console.log('  restored : ' + line);
console.log('  -> ' + path.relative(path.join(__dirname, '..'), OUT));
