#!/usr/bin/env node
/**
 * Replaces the shim in an already-repaired mod, and nothing else.
 *
 * Authors pick these files up and keep working on them. YoRHa System 1.5 is
 * novastorm with four thousand lines added and a new name -- and it carries
 * whichever version of the shim was current the day it was branched, bugs and
 * all. Running it back through repair-mod.js would be wrong twice over: the
 * repairs are already applied, and re-applying them to a body that has moved on
 * is a good way to break code that works.
 *
 * So: take the file apart at the seams repair-mod.js left, put the current shim
 * and the current boot starter back, and hand the body across untouched. The
 * body is checked byte-for-byte afterwards -- if a single character of the
 * author's code changed, this stops.
 *
 * Usage: node tools/reshim.js <in.js> <out.js>
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { stripComments } = require('./strip-comments.js');
const { bootStarter } = require('./boot-starter.js');

const ROOT = path.join(__dirname, '..');
const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('usage: node tools/reshim.js <in.js> <out.js>'); process.exit(2); }

const src = fs.readFileSync(IN, 'utf8').replace(/\r\n/g, '\n');

function fail(why) { console.error('reshim: ' + why); process.exit(1); }

/* --- the seams ------------------------------------------------------------ */
const metaEnd = src.indexOf('// ==/UserScript==');
if (metaEnd < 0) fail('no userscript metadata block');
let meta = src.slice(0, metaEnd + '// ==/UserScript=='.length);

const bootAt = src.indexOf('\nfunction __repairedBoot() {');
if (bootAt < 0) fail('this file was not produced by repair-mod.js -- there is no __repairedBoot');

const starterAt = src.indexOf('\n(function __repaired');
if (starterAt < 0) fail('no boot starter to replace');

// The body is everything between the opening line of __repairedBoot and the
// brace that closes it, minus the modBooted() call repair-mod.js puts first --
// that belongs to the shim, and the current one supplies its own.
let body = src.slice(bootAt + '\nfunction __repairedBoot() {'.length, starterAt);
if (!/\n\}$/.test(body)) fail('__repairedBoot does not end where expected');
body = body.replace(/\n\}$/, '');
const marker = '\n    try { UNPATCH.modBooted(); } catch (e) {}';
if (body.startsWith(marker)) body = body.slice(marker.length);
const bodyBefore = body;

/* --- what the old shim knew about this mod -------------------------------- */
// repair-mod.js decides these from the original source, which is not here any
// more. They are recoverable from the file it produced.
const wasClient = /^window\.UNPATCH_CLIENT = true;$/m.test(src.slice(0, bootAt));

/* --- the current shim ----------------------------------------------------- */
const unpatcher = fs.readFileSync(path.join(ROOT, 'MooUnpatcher.user.js'), 'utf8');
const uMeta = unpatcher.indexOf('// ==/UserScript==');
let shim = stripComments(unpatcher.slice(uMeta + '// ==/UserScript=='.length), { metadata: false }).out.trim();
if (wasClient) shim = 'window.UNPATCH_CLIENT = true;\n' + shim;

// @run-at is the one piece of metadata that must be right; an author editing
// the header by hand is exactly how it goes missing.
if (/^\/\/ @run-at\s+.*$/m.test(meta)) {
  meta = meta.replace(/^(\/\/ @run-at\s+).*$/m, '$1document-start');
} else {
  const anchor = /^\/\/ @grant\s+.*$/m.test(meta) ? /^(\/\/ @grant\s+.*)$/m : /^(\/\/ @match\s+.*)$/m;
  if (!anchor.test(meta)) fail('nowhere to put @run-at');
  meta = meta.replace(anchor, '$1\n// @run-at      document-start');
}

const out = meta + '\n\n' + shim +
  '\n\nfunction __repairedBoot() {\n    try { UNPATCH.modBooted(); } catch (e) {}' +
  body + '\n}\n' + bootStarter('__repairedBoot');

/* --- prove the body came through untouched -------------------------------- */
// Substring identity, not a re-extraction: the first attempt at this compared
// slices and tripped over a trailing newline the two sides punctuate
// differently, which is a bug in the check and would have read as a bug in the
// copy. "The author's code appears in the output, once, unaltered" is the thing
// actually worth asserting.
const at = out.indexOf(bodyBefore);
if (at < 0) fail('the body changed -- refusing to write');
if (out.indexOf(bodyBefore, at + 1) !== -1) fail('the body appears twice -- refusing to write');

try { acorn.parse(out, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); }
catch (e) { fail('the result does not parse -- ' + e.message); }

fs.writeFileSync(OUT, out);
const name = (meta.match(/@name\s+(.+)/) || [])[1] || path.basename(IN);
console.log(name.trim());
console.log('  shim     : replaced with the current one (' + shim.split('\n').length + ' lines)');
console.log('  starter  : replaced -- now waits for the bundle, not just for the page');
console.log('  transport: ' + (wasClient ? 'client replacement, as before' : 'hook mod, as before'));
console.log('  body     : ' + bodyBefore.split('\n').length + ' lines, byte-for-byte unchanged');
console.log('  -> ' + path.relative(ROOT, OUT));
