#!/usr/bin/env node
/**
 * Strips every comment from a userscript except the metadata block, and proves
 * it did not change the program: the syntax tree before and after must match
 * exactly, positions aside.
 *
 * Comments are found by the parser rather than by regex, so `//` inside a
 * string, a template literal or a regex literal is left alone. Each removed
 * comment keeps its own newlines, so line structure — and with it automatic
 * semicolon insertion — is untouched.
 *
 * Usage: node tools/strip-comments.js <in.js> [out.js]
 */
const fs = require('fs');
const acorn = require('acorn');

const IN = process.argv[2];
const OUT = process.argv[3] || IN;
const src = fs.readFileSync(IN, 'utf8');

// the metadata block is the one thing that has to survive
const metaEnd = src.indexOf('// ==/UserScript==');
if (metaEnd < 0) throw new Error('no userscript metadata block found');
const keepUntil = src.indexOf('\n', metaEnd) + 1;

const opts = { ecmaVersion: 'latest', allowReturnOutsideFunction: true };

const comments = [];
acorn.parse(src, Object.assign({ onComment: comments }, opts));

let out = '', at = 0;
for (const c of comments) {
  if (c.start < keepUntil) continue;              // the metadata block
  out += src.slice(at, c.start);
  // keep the newlines the comment spanned; anything else becomes one space so
  // two tokens cannot be glued together
  const text = src.slice(c.start, c.end);
  const newlines = (text.match(/\n/g) || []).join('');
  out += newlines || ' ';
  at = c.end;
}
out += src.slice(at);

// drop lines the comments left empty, keep the blank lines that were already there
const before = src.split('\n');
out = out.split('\n')
  .map(l => l.replace(/[ \t]+$/, ''))
  .filter((l, i) => l !== '' || before[i] === undefined || before[i].trim() === '')
  .join('\n');

// --- prove the program is unchanged ---------------------------------------
const strip = node => JSON.stringify(node, (k, v) =>
  (k === 'start' || k === 'end' || k === 'loc' || k === 'range') ? undefined : v);
if (strip(acorn.parse(src, opts)) !== strip(acorn.parse(out, opts))) {
  throw new Error('the syntax tree changed — refusing to write');
}

fs.writeFileSync(OUT, out);
console.log('stripped', comments.length, 'comments:',
  src.split('\n').length, '->', out.split('\n').length, 'lines,',
  src.length, '->', out.length, 'bytes');
