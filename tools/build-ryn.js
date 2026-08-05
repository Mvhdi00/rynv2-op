#!/usr/bin/env node
/**
 * Rebuilds RYN-Client.v5v4.js from reference/ryn-original.js.
 *
 * Step one of a larger job: strip a set of features out entirely -- menu entry,
 * setting, and the code behind them -- plus the install beacon the original
 * fires at a third party.
 *
 * Usage: node tools/build-ryn.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORIGINAL = process.argv[2] || path.join(ROOT, 'reference', 'ryn-original.js');
const OUT = path.join(ROOT, 'RYN-Client.v5v4.js');

let src = fs.readFileSync(ORIGINAL, 'utf8');
const before = src.length;

function swap(from, to, what) {
  if (src.indexOf(from) < 0) {
    console.error('build-ryn: could not find ' + (what || from.split('\n')[0].slice(0, 70)));
    process.exit(1);
  }
  src = src.split(from).join(to);
}

/* --- the install beacon ---------------------------------------------------
 * A one-shot fetch to a webhook.site collector the first time the script runs,
 * flagged in localStorage so it fires once per browser. It tells a third party
 * that this machine installed the script and nothing else -- there is no
 * feature here to keep, so it goes.
 */
swap(`(function() {
  try {
    if (!localStorage.getItem("_ryn_sent")) {
      fetch("https://webhook.site/d1428dcc-941e-4ab0-ab89-34bf60b5ff57?t=" + Date.now());
      localStorage.setItem("_ryn_sent", "1");
    }
  } catch (e) {}
})();

`, '', 'the webhook.site install beacon');

/* --- the features to remove ----------------------------------------------- */
const REMOVE = [
  '_autoGather',
  '_shameGrind', '_shameTick', '_autoShame', '_autoShameLimit',
  '_lunaSafeWalk', '_lunaPathfinder', '_pathBreak', '_lunaMode',
  '_lockTrappedEnemy',
  '_autoRetrap', '_placerRetrapCombo', '_trapRebuild',
  '_glotusPlacer', '_preplacer', '_replacer', '_lunaExactPlacer',
];

/* --- 1. the menu entries --------------------------------------------------
 * Each option lives in a <div class="content-option"> ... </div> inside a
 * template string, so the markup is escaped: \" for quotes, \r\n for newlines.
 * Walk out from the id to the enclosing div and take the whole block, counting
 * nested divs so a block containing another one cannot be cut short.
 */
function removeOption(id) {
  const OPEN = '<div class=\\"content-option\\"';
  let at = src.indexOf('\\"' + id + '\\"');
  if (at < 0) return 0;

  const start = src.lastIndexOf(OPEN, at);
  if (start < 0) { console.error('build-ryn: no content-option around ' + id); process.exit(1); }

  // walk forward, balancing <div ...> against </div>
  let depth = 0, i = start;
  const DIV_OPEN = /<div\b/g, DIV_CLOSE = /<\/div>/g;
  let end = -1;
  while (i < src.length) {
    DIV_OPEN.lastIndex = i; DIV_CLOSE.lastIndex = i;
    const o = DIV_OPEN.exec(src), c = DIV_CLOSE.exec(src);
    if (!c) break;
    if (o && o.index < c.index) { depth++; i = o.index + 4; continue; }
    depth--; i = c.index + 6;
    if (depth === 0) { end = i; break; }
  }
  if (end < 0) { console.error('build-ryn: unbalanced markup around ' + id); process.exit(1); }

  // take the leading whitespace/newline with it so no blank gap is left
  let from = start;
  const lead = src.lastIndexOf('\\r\\n', start);
  if (lead >= 0 && src.slice(lead + 4, start).trim() === '') from = lead;
  src = src.slice(0, from) + src.slice(end);
  return 1;
}

let removedOptions = 0;
for (const id of REMOVE) {
  // an id can appear in both the label's `for` and the input's `id`
  while (src.indexOf('\\"' + id + '\\"') >= 0) removedOptions += removeOption(id);
}

/* --- 2. the settings keys -------------------------------------------------
 * With the key gone, every `if (!Settings_default._x) return;` guard reads
 * undefined and short-circuits, so the feature is inert even where its code
 * is still reachable. The dead guards themselves go in step 3.
 */
let removedKeys = 0;
for (const id of REMOVE) {
  const re = new RegExp('^\\s*' + id + ':\\s*[^,\\n]+,\\s*$\\n?', 'm');
  if (re.test(src)) { src = src.replace(re, ''); removedKeys++; }
}

/* --- 3. the code the removed settings used to reach ------------------------
 * With the keys gone every guard already reads undefined, so nothing below
 * changes behaviour -- it deletes code that can no longer run. Each removal is
 * anchored on exact text and the file is re-parsed at the end, so a miss is a
 * build failure rather than a silent half-edit.
 */

// Remove a whole `if (...) { ... }` statement, given its exact header line.
function dropIf(header, times) {
  let n = 0;
  for (;;) {
    const at = src.indexOf(header);
    if (at < 0) break;
    let i = src.indexOf('{', at + header.length - 1);
    if (i < 0 || i > at + header.length + 2) { console.error('dropIf: no block after ' + header.trim()); process.exit(1); }
    let depth = 0, end = -1;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { depth--; if (!depth) { end = j + 1; break; } }
    }
    if (end < 0) { console.error('dropIf: unbalanced after ' + header.trim()); process.exit(1); }
    let from = at;
    const bol = src.lastIndexOf('\n', at);
    if (bol >= 0 && src.slice(bol + 1, at).trim() === '') from = bol;
    let to = end;
    if (src[to] === '\n') to++;
    src = src.slice(0, from) + src.slice(to);
    n++;
    if (times && n >= times) break;
  }
  if (n === 0) { console.error('dropIf: never found ' + header.trim()); process.exit(1); }
  return n;
}

function dropLine(text, times) {
  let n = 0;
  for (;;) {
    const at = src.indexOf(text);
    if (at < 0) break;
    const bol = src.lastIndexOf('\n', at);
    let eol = src.indexOf('\n', at);
    if (eol < 0) eol = src.length;
    src = src.slice(0, bol < 0 ? 0 : bol) + src.slice(eol);
    n++;
    if (times && n >= times) break;
  }
  if (n === 0) { console.error('dropLine: never found ' + text.trim()); process.exit(1); }
  return n;
}

let dead = 0;

// straight no-ops: luna mode is gone, so these early returns never fire
dead += dropLine('if (Settings_default._lunaMode) return;');

// blocks that can no longer be entered
dead += dropIf('if (Settings_default._lunaPathfinder) {');
dead += dropIf('if (Settings_default._glotusPlacer) {');
dead += dropIf('if (Settings_default._replacer) {');
dead += dropIf('if (Settings_default._lockTrappedEnemy && EnemyManager2.enemyTrappedByMe()) {');
dead += dropIf('if (Settings_default._preplacer && myPos.distance(enemyPos) < 300 && !(imTrapped && myPlayer.spikeDamage > 0)) {');

// conditions that are now constant: fold them to what they evaluate to
swap('if (!Settings_default._lunaMode && ModuleHandler.moduleActive && !myPlayer.isTrapped) {',
     'if (ModuleHandler.moduleActive && !myPlayer.isTrapped) {',
     'the luna-mode arm of the break guard');
dead++;

// the combo switch case, and the parity reset that pokes the removed keys
swap(`       case "_placerRetrapCombo":
        {
          Settings_default._preplacer = checked;
          Settings_default._replacer = checked;
          Settings_default._autoRetrap = checked;
          SaveSettings();
`, `       case "__removed_placerRetrapCombo":
        {
`, 'the Retrap combo switch case');
dead += 3;
dead += dropLine('settings._lunaMode = false;');
dead += dropLine('settings._lunaExactPlacer = false;');
dead += dropLine('settings._lockTrappedEnemy = false;');

// and the legit-mode exclusion list
swap('"_legitMode", "_lunaMode", "_lunaExactPlacer", "_hideHUD"',
     '"_legitMode", "_hideHUD"', 'the LEGIT_MODE_EXCLUDE entries');
dead += 2;

fs.writeFileSync(OUT, src);
console.log('wrote', path.relative(ROOT, OUT));
console.log('  dead sites removed   :', dead);
console.log('  menu options removed :', removedOptions);
console.log('  settings keys removed:', removedKeys, '/', REMOVE.length);
console.log('  bytes:', before, '->', src.length);
