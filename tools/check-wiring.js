// Wiring audit for YoRHa_System.user.js.
//
//   node tools/check-wiring.js [path/to/file.js]
//
// Removing a feature by hand leaves two kinds of debris that neither
// `node --check` nor an undefined-identifier sweep can see, because both halves
// are individually valid JavaScript:
//
//   * a setting still READ by code, with no default left in the config object
//     — `window.vars.x` is `undefined`, so the feature silently behaves as if
//     it were switched off, or worse, half on
//   * a menu row pointing at a setting that no longer exists, or a default with
//     no way to reach it, or a tab with no nav item
//
// And the mirror of the undefined sweep: a top-level function nobody calls any
// more, which is what a half-finished removal looks like.
const fs = require('fs');

const FILE = process.argv[2] || (__dirname + '/../YoRHa_System.user.js');
const src = fs.readFileSync(FILE, 'utf8');

let problems = 0;
function bad(msg) { console.log('  ✗ ' + msg); problems++; }
function good(msg) { console.log('  ✓ ' + msg); }

// ---------------------------------------------------------------- settings
// The defaults object: `let defaultConfig = { ... }` / `window.vars = { ... }`.
function grabObject(startIdx) {
    let depth = 0, i = src.indexOf('{', startIdx);
    const from = i;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(from, i + 1); }
    }
    return '';
}
const cfgAt = src.search(/window\.vars\s*=\s*\{/);
if (cfgAt < 0) { console.error('could not find the window.vars defaults'); process.exit(2); }
const cfgText = grabObject(cfgAt);
const defaults = new Set();
for (const m of cfgText.matchAll(/^\s+([A-Za-z_$][\w$]*)\s*:/gm)) defaults.add(m[1]);

// Everything the code actually reads or writes off window.vars / vars.
const used = new Set();
for (const m of src.matchAll(/(?:window\.)?vars\.([A-Za-z_$][\w$]*)/g)) used.add(m[1]);
for (const m of src.matchAll(/(?:window\.)?vars\[["']([^"']+)["']\]/g)) used.add(m[1]);

console.log('settings');
const readNoDefault = [...used].filter(k => !defaults.has(k));
if (readNoDefault.length) {
    for (const k of readNoDefault) {
        const line = src.slice(0, src.indexOf('vars.' + k)).split('\n').length;
        bad('vars.' + k + ' is read but has no default (line ' + line + ') — it will be undefined');
    }
} else good(defaults.size + ' defaults, and every setting the code reads has one');

// ---------------------------------------------------------------- the menu
const menuAt = src.search(/(const|let|var)\s+MenuConfig\s*=/);
if (menuAt < 0) { console.error('could not find MenuConfig'); process.exit(2); }
const menuText = grabObject(menuAt);

const menuIds = new Set();
for (const m of menuText.matchAll(/\bid:\s*["']([^"']+)["']/g)) menuIds.add(m[1]);

console.log('\nmenu rows');
const rowsNoDefault = [...menuIds].filter(k => !defaults.has(k));
if (rowsNoDefault.length) rowsNoDefault.forEach(k => bad('menu row "' + k + '" points at a setting that does not exist'));
else good(menuIds.size + ' menu rows, every one bound to a real setting');

// Tabs on both sides.
const tabs = new Set();
for (const m of menuText.matchAll(/^\s+([A-Za-z_$][\w$]*)\s*:\s*\[/gm)) tabs.add(m[1]);
const navTabs = new Set();
for (const m of src.matchAll(/data-tab="([^"]+)"/g)) navTabs.add(m[1]);
const nameAt = src.indexOf('const tabNames = {');
const namedTabs = new Set();
if (nameAt >= 0) for (const m of grabObject(nameAt).matchAll(/^\s+([A-Za-z_$][\w$]*)\s*:/gm)) namedTabs.add(m[1]);

console.log('\nmenu tabs');
let tabOk = true;
for (const t of tabs) {
    if (!navTabs.has(t)) { bad('tab "' + t + '" has sections but no nav item — unreachable'); tabOk = false; }
    if (!namedTabs.has(t)) { bad('tab "' + t + '" has no title in tabNames'); tabOk = false; }
}
for (const t of navTabs) if (!tabs.has(t)) { bad('nav item "' + t + '" opens a tab with no sections'); tabOk = false; }
if (tabOk) good([...tabs].join(', '));

// Every item type the menu asks for must be handled by the renderer.
const types = new Set();
for (const m of menuText.matchAll(/\btype:\s*["']([^"']+)["']/g)) types.add(m[1]);
console.log('\nmenu item types');
let typeOk = true;
for (const ty of types) {
    if (!new RegExp("item\\.type === ['\"]" + ty + "['\"]").test(src)) {
        bad('item type "' + ty + '" is used but the renderer has no branch for it');
        typeOk = false;
    }
}
if (typeOk) good([...types].join(', ') + ' — all handled');

// ------------------------------------------------------- orphaned functions
// A top-level function whose name appears exactly once in the file is declared
// and never called: the shape a half-finished removal leaves.
console.log('\norphaned top-level functions');
const orphans = [];
for (const m of src.matchAll(/^        function ([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const name = m[1];
    const hits = (src.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length;
    if (hits === 1) orphans.push(name);
}
if (orphans.length) orphans.forEach(n => bad('function ' + n + '() is declared but never called'));
else good('none');

// ------------------------------------------------------------ packet table
console.log('\npacket table');
const tblAt = src.indexOf('ServerLog.wrap({');
if (tblAt < 0) bad('the packet table is not wrapped by ServerLog');
else {
    const tbl = grabObject(tblAt);
    const handlers = [...tbl.matchAll(/"([^"]+)":\s*[A-Za-z_$][\w$]*/g)].map(m => m[1]);
    const dupes = handlers.filter((h, i) => handlers.indexOf(h) !== i);
    if (dupes.length) bad('duplicate opcode(s) in the packet table: ' + dupes.join(', '));
    else good(handlers.length + ' opcodes, no duplicates, wrapped');
    for (const need of ['A', 'C', 'D', 'E', 'a', 'H', 'O', 'P', 'g', '1', '2', '3', '4', '6']) {
        if (!handlers.includes(need)) bad('opcode "' + need + '" is missing from the table');
    }
}

console.log('\n' + (problems ? problems + ' problem(s)' : 'no problems'));
process.exit(problems ? 1 : 0);
