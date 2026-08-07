#!/usr/bin/env node
/**
 * Balthazar priv carries two fragments that a bad deobfuscation tore out of
 * the functions they belonged to and left sitting at the top level, where
 * neither can run. repair-mod.js handles faults that are common to the family;
 * these are this file's own, and each needs a decision, so they are here.
 *
 * Usage: node tools/patch-balthazar.js <in.js> <out.js>
 */
const fs = require('fs');
const acorn = require('acorn');
const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node tools/patch-balthazar.js <in> <out>'); process.exit(2); }
let src = fs.readFileSync(IN, 'utf8').replace(/\r\n/g, '\n');

function endOfBlock(open) {
  let d = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { const q = c; for (i++; i < src.length; i++) { if (src[i] === '\\') { i++; continue; } if (src[i] === q) break; } continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) i = src.length; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return i + 1; }
  }
  return -1;
}

/* --- 1. the D-key combo ---------------------------------------------------
 * `if (e.keyCode == 68) { ... }` at the top level, with no `e` in scope. It
 * already tests a keyboard event, so what it wants is unambiguous: it is a
 * keydown handler that lost its wrapper. Giving it one back preserves the
 * feature -- boost pad, weapon swap, hit -- rather than deleting it.
 *
 * The typing guard is the one addition: without it the combo fires while you
 * are writing a chat message containing the letter d.
 */
const kAt = src.indexOf('\nif (e.keyCode == 68) {');
if (kAt < 0) { console.error('patch-balthazar: the keyboard fragment is not there'); process.exit(1); }
const kEnd = endOfBlock(src.indexOf('{', kAt));
const combo = src.slice(kAt + 1, kEnd);
src = src.slice(0, kAt + 1) +
  'document.addEventListener("keydown", function (e) {\n' +
  '  var typing = document.activeElement &&\n' +
  '      /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);\n' +
  '  if (typing) return;\n' +
  combo.split('\n').map(l => l ? '  ' + l : l).join('\n') + '\n});\n' +
  src.slice(kEnd);

/* --- 2. the water-render fragment -----------------------------------------
 * `if (!firstSetup) { waterMult += ... renderWaterBodies(...) }`, also at the
 * top level. This one cannot be put back, and should not be:
 *
 *   - it reads delta, xOffset, yOffset and mainContext, which only exist
 *     inside a render loop;
 *   - this mod is a hook mod. It has no updateGame of its own, so there is no
 *     render loop here to return it to;
 *   - renderWaterBodies is not defined anywhere in the file. Its only two
 *     mentions are the two calls inside this fragment, so even in the right
 *     place it would throw.
 *
 * It is vanilla moomoo render code that a bad merge dragged in. The game draws
 * its own water. So it goes.
 */
const wAt = src.indexOf('\nif (!firstSetup) {');
if (wAt < 0) { console.error('patch-balthazar: the water fragment is not there'); process.exit(1); }
const wEnd = endOfBlock(src.indexOf('{', wAt));
const water = src.slice(wAt, wEnd);
if (!/renderWaterBodies/.test(water) || water.length > 900) {
  console.error('patch-balthazar: the water fragment is not what was expected'); process.exit(1);
}
src = src.slice(0, wAt) + src.slice(wEnd);

try { acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); }
catch (e) { console.error('patch-balthazar: result does not parse -- ' + e.message); process.exit(1); }

fs.writeFileSync(OUT, src);
console.log('patched Balthazar: D-key combo given a keydown handler, water debris removed');
