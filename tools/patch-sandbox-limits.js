#!/usr/bin/env node
/**
 * Makes a mod's build caps agree with the game's, in sandbox.
 *
 * The complaint: six traps in sandbox and no more. The cause is not the cap
 * itself, it is which flag the cap is read behind.
 *
 * The mod has two sandbox flags:
 *
 *     module.exports.inSandbox = process && process.env.VULTR_SCHEME === "mm_exp";
 *     module.exports.isSandbox = window.location.hostname == "sandbox.moomoo.io";
 *
 * The first is moomoo's SERVER config, carried into the client bundle by
 * accident: `process.env` in a browser is the webpack shim's empty object, so
 * `inSandbox` is false everywhere, always. And `inSandbox` is the one the caps
 * are read behind -- canBuild and isItemLimit both consult it -- so in sandbox
 * the client goes on enforcing the live-server numbers: 6 traps, 15 spikes.
 * (The game's own bundle has the identical dead line, `Vs = Ut && {}.IS_SANDBOX`.
 * What it uses in the browser is a hostname test, `Cn`.)
 *
 * The number to use, when it is sandbox, is the game's own and not one I chose:
 *
 *     const w = i.inSandbox ? f.group.sandboxLimit || Math.max(f.group.limit * 3, 99)
 *                           : f.group.limit;                    // ClientPlayer.canBuild
 *
 * -- so 99 for traps and spikes, 299 for the three groups that name a
 * sandboxLimit of their own. Every site that reads a cap now goes through one
 * helper that says exactly that, including the two that only draw "3/6" under
 * the item, which would otherwise disagree with what you can actually build.
 *
 * Resources are deliberately left alone. The game bypasses hasRes in sandbox on
 * the same dead flag, so bypassing it here would be a change nobody asked for
 * and a way to desync from a server that has not agreed to it.
 *
 * Usage: node tools/patch-sandbox-limits.js <in.js> <out.js>
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node tools/patch-sandbox-limits.js <in.js> <out.js>'); process.exit(2); }

let src = fs.readFileSync(IN, 'utf8').replace(/\r\n/g, '\n');
const before = src;
const done = [];

function edit(id, find, to) {
  const all = [...src.matchAll(new RegExp(find.source, (find.flags || '') + 'g'))];
  if (all.length !== 1) {
    console.error('patch-sandbox-limits: "' + id + '" matched ' + all.length + ' times, expected 1');
    process.exit(1);
  }
  const replacement = to;
  const grew = (replacement.match(/\n/g) || []).length - (all[0][0].match(/\n/g) || []).length;
  src = src.replace(find, replacement);
  done.push(id + (grew ? ' (+' + grew + ' lines)' : ''));
}

/* --- 1. one place that knows what a cap is -------------------------------- */
// Put it next to the config module's own sandbox flag, so it is defined before
// anything that reads a cap runs, and so the hostname test lives in one place.
edit('the cap helper, next to the config flags',
  /(module\.exports\.isSandbox = window\.location\.hostname == "sandbox\.moomoo\.io";)/,
  `$1
            // The game's own sandbox test in the browser is the hostname, not
            // the dead process.env one above. sandbox-dev is included because
            // the game includes it.
            module.exports.onSandboxHost = /^sandbox(-dev)?\\.moomoo\\.io$/.test(window.location.hostname);
            // ClientPlayer.canBuild, verbatim: sandboxLimit if the group names
            // one, otherwise three times the live cap or 99, whichever is more.
            module.exports.buildLimit = function (group) {
                if (!group) return 0;
                return module.exports.onSandboxHost
                    ? (group.sandboxLimit || Math.max(group.limit * 3, 99))
                    : group.limit;
            };`);

/* --- 2. the gate the placers ask ------------------------------------------ */
edit('isItemLimit, which every placer asks before queueing',
  /const limit = \(config\.isSandbox && group\.sandboxLimit\) \|\| group\.limit;/,
  'const limit = config.buildLimit(group);');
edit('isItemLimit no longer short-circuits on the dead flag',
  /if \(config\.inSandbox\) return false;\n(\s*)\n(\s*)const limit = config\.buildLimit\(group\);/,
  'const limit = config.buildLimit(group);');

/* --- 3. the gate the player asks ------------------------------------------ */
// The captured group is the indent of the STATEMENT, not of the `return` that
// follows it -- taking the latter is how the replacement came out with its
// first line one level shallower than the two below it.
edit('canBuild',
  /^(\s*)if \(item\.group\.limit && this\.itemCounts\[item\.group\.id\] >= item\.group\.limit\)\n\s*return false;/m,
  '$1const cap = config.buildLimit(item.group);\n$1if (cap && this.itemCounts[item.group.id] >= cap)\n$1    return false;');

/* --- 4. the two counters under the item ----------------------------------- */
// If these keep showing "/6" while you can place 99, the mod is lying to you
// about its own state, which is how a "fix" gets reported as still broken.
edit('the item-info counter',
  /text: \(myPlayer\.itemCounts\[item\.group\.id\] \|\| 0\) \+ "\/" \+ item\.group\.limit,/,
  'text: (myPlayer.itemCounts[item.group.id] || 0) + "/" + config.buildLimit(item.group),');

fs.writeFileSync(OUT, src);

/* --- checks --------------------------------------------------------------- */
try { acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); }
catch (e) { console.error('patch-sandbox-limits: the result does not parse -- ' + e.message); process.exit(1); }
if (/config\.inSandbox/.test(src.slice(src.indexOf('canBuild')))) {
  // useRes still uses it, and should: see the note about resources above.
}

console.log(path.basename(IN));
for (const d of done) console.log('  patched: ' + d);
console.log('  lines: ' + before.split('\n').length + ' -> ' + src.split('\n').length);
console.log('  -> ' + OUT);
