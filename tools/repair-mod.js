#!/usr/bin/env node
/**
 * Repairs a hook-style moomoo mod by bundling the unpatcher into it.
 *
 * Annihilator and CaraMila were each rewired by hand: find the mod's socket
 * hook, replace it with EXP.setHandler, redirect its packet helpers, rewrite
 * its decode path. That works, but every mod's seams are worded differently,
 * so it is bespoke surgery each time.
 *
 * There is a shortcut, and it is not a compromise: MooUnpatcher already sits
 * *underneath* an unmodified hook and translates in both directions. Inlining
 * it means the mod's own `WebSocket.prototype.send = ...` hook keeps working
 * exactly as written -- no seams to find, nothing mod-specific to get wrong --
 * and what goes in is a component with its own 77 checks and a browser probe
 * behind it.
 *
 * So the repair per mod is only the three things the unpatcher cannot do from
 * outside a file it is not part of:
 *
 *   1. @run-at document-start, because the game captures
 *      WebSocket.prototype.send once at bundle load;
 *   2. dead @requires dropped, since a @require that 404s aborts the whole
 *      userscript before its first statement (and the shim brings msgpack);
 *   3. the body deferred, because @run-at document-start means the DOM does
 *      not exist yet, and these mods build menus at their top level. That trap
 *      cost a round trip on Annihilator: fixing only @run-at stopped it
 *      loading at all.
 *
 * Usage: node tools/repair-mod.js <in.js> <out.js>
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { stripComments } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('usage: node tools/repair-mod.js <in.js> <out.js>'); process.exit(2); }

let src = fs.readFileSync(IN, 'utf8').replace(/\r\n/g, '\n');
const report = { name: null, runAt: null, requires: [], deferred: false, bytes: [src.length, 0] };

const metaEnd = src.indexOf('// ==/UserScript==');
if (metaEnd < 0) { console.error('repair-mod: no userscript metadata block'); process.exit(1); }
let meta = src.slice(0, metaEnd);
const body = src.slice(metaEnd + '// ==/UserScript=='.length + 1);

report.name = (meta.match(/@name\s+(.+)/) || [])[1] || path.basename(IN);

/* --- 1. @run-at ----------------------------------------------------------- */
if (/^\/\/ @run-at\s+document-start\s*$/m.test(meta)) {
  report.runAt = 'already document-start';
} else if (/^\/\/ @run-at\s+.*$/m.test(meta)) {
  meta = meta.replace(/^(\/\/ @run-at\s+).*$/m, '$1document-start');
  report.runAt = 'corrected to document-start';
} else {
  // put it next to @grant if there is one, else after @match
  const anchor = /^\/\/ @grant\s+.*$/m.test(meta) ? /^(\/\/ @grant\s+.*)$/m : /^(\/\/ @match\s+.*)$/m;
  if (!anchor.test(meta)) { console.error('repair-mod: nowhere to put @run-at'); process.exit(1); }
  meta = meta.replace(anchor, '$1\n// @run-at       document-start');
  report.runAt = 'added (was absent, so it ran at document-end)';
}

/* --- 2. @require ---------------------------------------------------------- */
// rawgit.com has been offline since 2019. msgpack of any flavour is replaced
// by the bundled shim. Anything else is left alone -- jQuery from a live CDN
// is somebody's real dependency.
meta = meta.replace(/^\/\/ @require\s+(\S+).*$\n?/gm, (line, url) => {
  if (/rawgit\.com|msgpack/i.test(url)) { report.requires.push(url); return ''; }
  return line;
});

/* --- 2b. jQuery ------------------------------------------------------------
 * moomoo does not ship jQuery. A mod that calls $() without requiring it threw
 * "$ is not defined" on the first call and took whatever was around it down --
 * which for Balthazar was its whole boot. If it uses $ and has no jQuery
 * @require, give it one from a CDN that is still up.
 */
if (/[^\w$]\$\(/.test(body) && !/@require.*jquery/i.test(meta)) {
  const at = /^(\/\/ @run-at\s+.*)$/m;
  meta = meta.replace(at, '// @require      https://code.jquery.com/jquery-3.7.1.min.js\n$1');
  report.jquery = true;
}

/* --- 3. the unpatcher, inlined -------------------------------------------- */
const unpatcher = fs.readFileSync(path.join(ROOT, 'MooUnpatcher.user.js'), 'utf8');
const uMeta = unpatcher.indexOf('// ==/UserScript==');
const shim = stripComments(unpatcher.slice(uMeta + '// ==/UserScript=='.length), { metadata: false }).out.trim();

/* --- 4. defer the body ---------------------------------------------------- */
// Only if it needs it: a mod that already waits for the DOM must not be made
// to wait twice, and one that touches nothing at its top level loses nothing
// by running immediately.
const TOUCHES_DOM = /^[^\s/].*\b(?:document\.(?:body|getElementById|querySelector)|getEl\()/m.test(body)
  || /^\s{0,2}(?:let|const|var)\s+\w+\s*=\s*(?:document\.getElementById|getEl)\(/m.test(body);
let out;
if (TOUCHES_DOM) {
  report.deferred = true;
  out = meta + '// ==/UserScript==\n\n' + shim + '\n\nfunction __repairedBoot() {\n' + body +
    '\n}\n(function __repairedStart(tries) {\n' +
    '    tries = tries || 0;\n' +
    '    if ((document.readyState === "loading" || !document.getElementById("gameUI")) && tries < 400) {\n' +
    '        return setTimeout(function () { __repairedStart(tries + 1); }, 50);\n' +
    '    }\n' +
    '    __repairedBoot();\n' +
    '})();\n';
} else {
  out = meta + '// ==/UserScript==\n\n' + shim + '\n' + body;
}

try { acorn.parse(out, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); }
catch (e) { console.error('repair-mod: the result does not parse -- ' + e.message); process.exit(1); }

report.bytes[1] = out.length;
fs.writeFileSync(OUT, out);

console.log(report.name.trim());
console.log('  @run-at  : ' + report.runAt);
console.log('  @require : ' + (report.requires.length ? report.requires.join(', ') : '(none dead)'));
if (report.jquery) console.log('  jQuery   : added (used but never required)');
console.log('  body     : ' + (report.deferred ? 'deferred behind __repairedBoot' : 'left at top level (touches no DOM)'));
console.log('  -> ' + path.relative(ROOT, OUT));
