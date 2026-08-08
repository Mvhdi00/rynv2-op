/*
 * Find the DOM x18k assumes but the shipped page no longer has.
 *
 * x18k forked an older moomoo.io page. Where it dereferences an element that
 * the current page does not serve, the result is a TypeError at load — and a
 * throw in a top-level statement takes down everything after it, including the
 * menu wiring, long before any packet is sent.
 *
 * The shipped bundle (src/game_index.js) is the reference for what the live
 * page actually contains.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const x18k = fs.readFileSync(path.join(ROOT, process.argv[2] || 'src/x18k_7.4_original.js'), 'utf8');
const game = fs.readFileSync(path.join(ROOT, 'src/game_index.js'), 'utf8');

const idsIn = (src) => new Set(
  [...src.matchAll(/getElementById\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((m) => m[1])
);

const gameIds = idsIn(game);
const x18kIds = idsIn(x18k);

// An unguarded dereference is `getElementById("x").something` — no `?.`, no
// preceding truthiness test on the same expression.
const unguarded = new Map();
for (const m of x18k.matchAll(/getElementById\(\s*["'`]([^"'`]+)["'`]\s*\)\s*(\.|\[)/g)) {
  const id = m[1];
  const after = x18k.slice(m.index + m[0].length - 1, m.index + m[0].length + 24);
  if (!unguarded.has(id)) unguarded.set(id, new Set());
  unguarded.get(id).add(after.split(/[\s(;,)]/)[0]);
}

/*
 * Most ids x18k touches are its own menu, which it builds at runtime. Those
 * are not a compatibility problem. An id is only interesting when x18k never
 * creates it and the shipped bundle never mentions it — then it can only have
 * come from a page layout that no longer exists.
 */
function createdByX18k(id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`id\\s*=\\s*\\\\?["'\`]${esc}\\\\?["'\`]|id:\\s*["'\`]${esc}["'\`]|["'\`]${esc}["'\`]\\s*;?\\s*\\n?\\s*[a-zA-Z_$][\\w$]*\\.id`).test(x18k) ||
    new RegExp(`<[^>]*id=\\\\?["'\`]${esc}`).test(x18k);
}

const missing = [...x18kIds]
  .filter((id) => !gameIds.has(id))
  .filter((id) => !id.includes('${'))
  .filter((id) => !createdByX18k(id))
  .sort();

console.log(`element ids referenced by x18k : ${x18kIds.size}`);
console.log(`element ids referenced by game : ${gameIds.size}`);
console.log('');

if (!missing.length) {
  console.log('Every id x18k touches is also referenced by the shipped bundle.');
} else {
  console.log(`${missing.length} id(s) x18k expects that the shipped bundle never references:`);
  for (const id of missing) {
    const derefs = unguarded.get(id);
    const risk = derefs ? `  <-- dereferenced: ${[...derefs].join(', ')}` : '';
    console.log(`  ${id}${risk}`);
  }
  console.log('');
  console.log('Ids marked "dereferenced" throw a TypeError at load if absent,');
  console.log('which aborts the rest of the enclosing statement list.');
}
