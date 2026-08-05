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

const opts = { ecmaVersion: 'latest', allowReturnOutsideFunction: true };

/**
 * Strip comments from `src`. By default the userscript metadata block is kept
 * and its absence is an error; pass { metadata: false } for a plain fragment
 * such as a single shim, which has no metadata block to protect.
 */
function stripComments(src, options) {
  const wantMeta = !options || options.metadata !== false;
  let keepUntil = 0;
  if (wantMeta) {
    const metaEnd = src.indexOf('// ==/UserScript==');
    if (metaEnd < 0) throw new Error('no userscript metadata block found');
    keepUntil = src.indexOf('\n', metaEnd) + 1;
  }

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

  // drop lines the comments left empty, keep the blank lines already there
  const before = src.split('\n');
  out = out.split('\n')
    .map(l => l.replace(/[ \t]+$/, ''))
    .filter((l, i) => l !== '' || before[i] === undefined || before[i].trim() === '')
    .join('\n');

  // --- prove the program is unchanged -------------------------------------
  const tree = node => JSON.stringify(node, (k, v) =>
    (k === 'start' || k === 'end' || k === 'loc' || k === 'range') ? undefined : v);
  if (tree(acorn.parse(src, opts)) !== tree(acorn.parse(out, opts))) {
    throw new Error('the syntax tree changed \u2014 refusing to write');
  }
  return { out, removed: comments.length };
}

module.exports = { stripComments };

if (require.main === module) {
  const IN = process.argv[2];
  const OUT = process.argv[3] || IN;
  const src = fs.readFileSync(IN, 'utf8');
  const { out, removed } = stripComments(src);
  fs.writeFileSync(OUT, out);
  console.log('stripped', removed, 'comments:',
    src.split('\n').length, '->', out.split('\n').length, 'lines,',
    src.length, '->', out.length, 'bytes');
}
