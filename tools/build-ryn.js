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
const acorn = require('acorn');
const { stripComments } = require('./strip-comments.js');

// Every structural cut below is verified immediately: if the file stops
// parsing, the build stops and names the step. A brace miscounted in one
// removal silently corrupts the boundaries of every removal after it, which is
// exactly the failure this catches.
let lastGood = null;
function mustParse(step) {
  try { acorn.parse(src, { ecmaVersion: 'latest' }); lastGood = step; }
  catch (e) {
    console.error('build-ryn: "' + step + '" left the file unparseable');
    console.error('  ' + e.message);
    console.error('  last step that parsed cleanly: ' + (lastGood || '(none)'));
    process.exit(1);
  }
}

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
  const re = new RegExp('^[ \\t]*' + id + ':[ \\t]*[^,\\n]+,[ \\t]*$\\n?', 'm');
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
          break;
        }

`, '', 'the Retrap combo switch case');
dead += 4;
dead += dropLine('settings._lunaMode = false;');
dead += dropLine('settings._lunaExactPlacer = false;');
dead += dropLine('settings._lockTrappedEnemy = false;');

// and the legit-mode exclusion list
swap('"_legitMode", "_lunaMode", "_lunaExactPlacer", "_hideHUD"',
     '"_legitMode", "_hideHUD"', 'the LEGIT_MODE_EXCLUDE entries');
dead += 2;

/* --- 4. the feature code itself -------------------------------------------
 * Steps 1-3 left the features inert but still present: an entry guard that
 * returns immediately, and a body behind it nothing can reach. This takes the
 * bodies out -- whole classes where the class IS the feature, single members
 * where it is one part of a class that does other things, and the registration
 * and tick-list entries that would otherwise name something that no longer
 * exists.
 */

// Delete a `{ ... }` body starting at `open`, by brace balance, ignoring
// braces inside strings, template literals, comments and regex-ish contexts.
function endOfBlock(open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {          // skip the string
      const q = c;
      for (i++; i < src.length; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === q) break;
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) i = src.length; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return i + 1; }
  }
  return -1;
}

function cut(startIdx, endIdx) {
  let from = startIdx;
  const bol = src.lastIndexOf('\n', startIdx);
  if (bol >= 0 && src.slice(bol + 1, startIdx).trim() === '') from = bol;
  let to = endIdx;
  if (src[to] === '\n') to++;
  src = src.slice(0, from) + src.slice(to);
}

function dropClass(name) {
  const re = new RegExp('^[ \\t]*class ' + name + '\\b[^{]*\\{', 'm');
  const m = re.exec(src);
  if (!m) { console.error('dropClass: no class ' + name); process.exit(1); }
  const end = endOfBlock(m.index + m[0].length - 1);
  if (end < 0) { console.error('dropClass: unbalanced ' + name); process.exit(1); }
  cut(m.index, end);
  return 1;
}

// A method of a class: `<indent>name(args) {`
function dropMethod(name) {
  const re = new RegExp('^[ \\t]*' + name + '\\s*\\([^)]*\\)\\s*\\{', 'm');
  const m = re.exec(src);
  if (!m) { console.error('dropMethod: no method ' + name); process.exit(1); }
  const end = endOfBlock(m.index + m[0].length - 1);
  if (end < 0) { console.error('dropMethod: unbalanced ' + name); process.exit(1); }
  cut(m.index, end);
  return 1;
}

// An arrow-function const: `<indent>const name = (...) => {`
// `const name = function () {` or `const name = () => {`
function dropArrowConstOrFunction(name) {
  const re = new RegExp('^[ \\t]*const ' + name + '\\s*=\\s*(?:function\\s*)?\\([^)]*\\)\\s*(?:=>\\s*)?\\{', 'm');
  const m = re.exec(src);
  if (!m) { console.error('dropArrowConstOrFunction: no ' + name); process.exit(1); }
  let end = endOfBlock(m.index + m[0].length - 1);
  if (end < 0) { console.error('unbalanced ' + name); process.exit(1); }
  if (src[end] === ';') end++;
  cut(m.index, end);
  return 1;
}

function dropArrowConst(name, times) {
  let n = 0;
  for (;;) {
    const re = new RegExp('^[ \\t]*const ' + name + '\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{', 'm');
    const m = re.exec(src);
    if (!m) break;
    const end = endOfBlock(m.index + m[0].length - 1);
    if (end < 0) { console.error('dropArrowConst: unbalanced ' + name); process.exit(1); }
    // include a trailing semicolon if there is one
    let e = end;
    if (src[e] === ';') e++;
    cut(m.index, e);
    n++;
    if (times && n >= times) break;
  }
  if (!n) { console.error('dropArrowConst: never found ' + name); process.exit(1); }
  return n;
}

let excised = 0;

// classes that exist for nothing but a removed feature
for (const cls of ['AutoGatherBreak', 'TrapRebuild', 'LunaSafeWalk', 'AutoRetrap',
                   'AutoHitToShame', 'LunaPathfinder']) {
  excised += dropClass(cls);
  mustParse('drop class ' + cls);
}

// the aliases those classes are registered under, and the registrations
// These are packed several to a line --
//   const AutoPlay_default = AutoPlay;  const AutoGatherBreak_default = ...
// -- so the fragment comes out, not the line. A line-anchored pattern silently
// matched none of them, and the probe caught it as "AutoGatherBreak is not
// defined": exactly the kind of thing a parse check cannot see, because the
// file was still perfectly valid JavaScript.
for (const cls of ['AutoGatherBreak', 'TrapRebuild', 'LunaSafeWalk', 'LunaPathfinder']) {
  const frag = 'const ' + cls + '_default = ' + cls + ';';
  if (src.indexOf(frag) < 0) { console.error('build-ryn: no alias for ' + cls); process.exit(1); }
  src = src.split(frag + '  ').join('').split(frag).join('');
  excised++;
}
mustParse('drop the class aliases');
for (const reg of ['autoHitToShame: new AutoHitToShame(client2),',
                   'autoRetrap: new AutoRetrap(client2),',
                   'autoGatherBreak: new AutoGatherBreak_default(client2),',
                   'trapRebuild: new TrapRebuild_default(client2),',
                   'lunaPathfinder: new LunaPathfinder_default(client2),',
                   'lunaSafeWalk: new LunaSafeWalk_default(client2),']) {
  excised += dropLine(reg);
}

// and their places in the tick list. Splicing these out of the text by hand
// glued neighbours together -- "shameSpamthis.staticModules.spikeSyncHammer" --
// so the array is taken apart on its separators, filtered, and put back.
{
  const GONE_KEYS = new Set(['autoGatherBreak', 'trapRebuild', 'lunaSafeWalk',
                             'autoRetrap', 'autoHitToShame', 'lunaPathfinder']);
  src = src.replace(/^(\s*this\.(?:modules|botModules) = \[)([^\]]*)(\];)$/gm,
    (whole, head, body, tail) => {
      const kept = body.split(',')
        .map(e => e.trim())
        .filter(Boolean)
        .filter(e => {
          const m = e.match(/^this\.staticModules\.([A-Za-z_$][\w$]*)$/);
          if (!m) return true;                 // leave anything unfamiliar alone
          if (!GONE_KEYS.has(m[1])) return true;
          excised++;
          return false;
        });
      return head + ' ' + kept.join(', ') + ' ' + tail;
    });
}
mustParse('prune the tick lists');

// members of classes that do other things too
// The last read of the Auto Gather module. It was already null-safe --
// `_agb && _agb._on` -- so it was harmless once the module went, but harmless
// is not the same as gone. Fold it to what it now evaluates to.
swap(`      const _agb = _mh.staticModules.autoGatherBreak;
      const _autogathering = _agb && _agb._on || _mh.autoattack || _mh.forceWeapon !== null;`,
     `      const _autogathering = _mh.autoattack || _mh.forceWeapon !== null;`,
     'the last Auto Gather module read');
excised++;
mustParse('fold the Auto Gather read');

excised += dropMethod('_lunaPathBreak');           // Path Break, inside Autobreak
mustParse('drop _lunaPathBreak');
swap('const enemyFirst = () => reachable(fallback) ? fallback : this._lunaPathBreak();',
     'const enemyFirst = () => fallback;', 'the _lunaPathBreak call site');
excised++;

excised += dropMethod('_glotusPlace');             // Glotus Placer Mode, inside AutoPlacer
mustParse('drop _glotusPlace');
// The two shame helpers sit next to each other inside AutoPlacer and are both
// going, so they come out as one region: from the head of canShamePlace to the
// line that closes canAutoShame at the same indent. Boundaries are taken from
// the text rather than computed by brace balance -- and the removed region is
// checked to contain exactly what was meant, so an overrun is a build failure
// instead of something quietly missing later.
{
  const lines = src.split('\n');
  const head = lines.findIndex(l => /^\s*const canShamePlace\s*=\s*\(\)\s*=>\s*\{/.test(l));
  if (head < 0) { console.error('build-ryn: no canShamePlace'); process.exit(1); }
  const indent = lines[head].match(/^\s*/)[0];
  const second = lines.findIndex((l, i) => i > head && /^\s*const canAutoShame\s*=\s*\(\)\s*=>\s*\{/.test(l));
  if (second < 0) { console.error('build-ryn: no canAutoShame after canShamePlace'); process.exit(1); }
  let end = -1;
  for (let i = second + 1; i < lines.length; i++) {
    if (lines[i] === indent + '};') { end = i; break; }
  }
  if (end < 0) { console.error('build-ryn: canAutoShame never closes'); process.exit(1); }

  const region = lines.slice(head, end + 1).join('\n');
  const sane = region.includes('_shameGrind') && region.includes('_autoShame')
    && !region.includes('class ')
    && (region.match(/^\s*const can(ShamePlace|AutoShame)\s*=/gm) || []).length === 2
    && (end - head) < 40;
  if (!sane) {
    console.error('build-ryn: the shame-helper region is not what was expected');
    console.error(region.slice(0, 300));
    process.exit(1);
  }
  lines.splice(head, end - head + 1);
  src = lines.join('\n');
  excised += 2;
}
mustParse('drop the shame helpers');
dropLine('// تشتغل بدل منطق RYN لما يكون Settings._glotusPlacer مفعّلاً. أبسط بكثير');
excised++;

// Exact Placer is gone, so its "not exact" arm is the only arm: unwrap it.
swap(`            if (!Settings_default._lunaExactPlacer) {`, `            {`,
     'the Exact Placer branch');
excised++;

// Auto Gather is gone, so the second half of this can never be true
swap('if (ModuleHandler.shouldAttack && !(Settings_default._autoGather && ModuleHandler.staticModules.autoGatherBreak._on && !ModuleHandler._comboAttack)) {',
     'if (ModuleHandler.shouldAttack) {', 'the Auto Gather attack condition');
excised++;


/* --- 5. the leftovers a name-level audit found --------------------------
 * Checking only the settings ids said the job was done. Sweeping for the
 * feature *names* instead turned up a display-name table, an orphaned worker
 * body, and three members whose only caller had already been deleted. None of
 * them could run, but "cannot run" is not "removed".
 */

// The menu's display-name table, and the optionMap rows that pair an English
// string with a key in it. Nothing renders these now, but they still name the
// removed features.
for (const [key, label] of [['replacer', 'Replacer'], ['shame_grind', 'Shame Grind'],
                            ['shame_tick', 'Shame Tick'], ['preplacer', 'PrePlacer'],
                            ['auto_retrap', 'Auto Retrap']]) {
  const entry = new RegExp('^[ \\t]*' + key + ': "' + label + '",?[ \\t]*$\\n?', 'm');
  if (!entry.test(src)) { console.error('build-ryn: no label entry ' + key); process.exit(1); }
  src = src.replace(entry, '');
  excised++;
  // and its row in optionMap: [ "Auto Retrap", t.auto_retrap ],
  const row = new RegExp('\\[ "[^"]*", t\\.' + key + ' \\], ?');
  if (row.test(src)) { src = src.replace(row, ''); excised++; }
}
mustParse('drop the display-name entries');

// Three orphans are deliberately left in place: _lunaPfWorkerBody (the Luna
// pathfinder's worker source), _glotusAngles/_glotusCount (two unused fields)
// and _glotusCanKnockbackSpike (a method with no caller). Cutting them by
// brace balance moved a boundary elsewhere in the file -- the parse check
// above caught it every time -- and none of them is reachable or named in any
// user-visible surface, so leaving them beats a cut I cannot prove is right.

/* --- the page guards ------------------------------------------------------
 * RYN carries its own client and its own Turnstile handling, so it has no EXP
 * core to inherit these from -- and it needs both. Without them it shows the
 * game's red "userscript manager detected" bar, and it goes through the game's
 * own ENTER GAME handler, which latches on "Connecting..." for ever if the
 * page's Turnstile widget never rendered. tools/probe-entry.js reproduces both.
 *
 * The two functions are lifted verbatim from ExternalClient.user.js rather than
 * copied into this file, so there is one source for them and no way for the
 * copies to drift. They take their token accessors as parameters for exactly
 * this reason; here they read RYN's own captured token, falling back to asking
 * Turnstile directly.
 */
{
  const ext = fs.readFileSync(path.join(ROOT, 'ExternalClient.user.js'), 'utf8');
  const a = ext.indexOf('// BEGIN page-guards');
  const b = ext.indexOf('// END page-guards');
  if (a < 0 || b < 0) { console.error('build-ryn: no page-guards block in ExternalClient.user.js'); process.exit(1); }
  const guards = stripComments(ext.slice(a, b), { metadata: false }).out.trim();
  const meta = '// ==/UserScript==\n';
  if (src.indexOf(meta) < 0) { console.error('build-ryn: no metadata block'); process.exit(1); }
  src = src.replace(meta, meta + '\n(function () {\n' + guards + `
    let held = null;
    function readToken() {
        if (held) return held;
        try {
            const client = typeof RYN !== "undefined" && RYN._myClient;
            if (client && client._turnstileToken) return client._turnstileToken;
        } catch (e) {}
        try {
            if (window.turnstile && typeof window.turnstile.getResponse === "function")
                return window.turnstile.getResponse() || null;
        } catch (e) {}
        return null;
    }
    try { suppressWarningBanner(); } catch (e) {}
    try {
        if (window.MOO_ENTRY_GUARD !== false)
            guardEntry(readToken, function (t) { held = t; });
    } catch (e) {}
})();
`);
  mustParse('add the banner and entry guards');
}

fs.writeFileSync(OUT, src);
console.log('wrote', path.relative(ROOT, OUT));
console.log('  dead sites removed   :', dead);
console.log('  feature code excised :', excised);
console.log('  menu options removed :', removedOptions);
console.log('  settings keys removed:', removedKeys, '/', REMOVE.length);
console.log('  bytes:', before, '->', src.length);
