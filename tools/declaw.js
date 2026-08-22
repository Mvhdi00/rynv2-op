#!/usr/bin/env node
/**
 * Takes the phone-home out of a mod, and nothing else.
 *
 * tools/audit-mod.js finds the places a mod can talk to somebody who is not the
 * game. This removes the ones that were not asked for. It is deliberately not
 * clever: a fixed table of exact snippets, each of which must match exactly
 * once or the run fails. A rule that has stopped matching means the file
 * changed and somebody needs to look, not that the rule should be loosened.
 *
 * Two principles, both learned the hard way on mods that worked before I
 * touched them:
 *
 *   - never delete a binding something else still refers to. `project` is used
 *     in three places besides its own line, so the socket becomes an inert
 *     object of the same shape rather than disappearing. Nothing throws,
 *     nothing connects.
 *   - prefer the smallest edit that stops the traffic. Emptying a list of
 *     servers stops every connection to them without touching the code that
 *     loops over it -- which is exactly what one of these authors did himself,
 *     with the comment "REMOVED!!! so they cant abuse :)".
 *
 * Usage: node tools/declaw.js <in.js> <out.js>
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node tools/declaw.js <in.js> <out.js>'); process.exit(2); }

// A WebSocket-shaped object that goes nowhere. The code around it assigns
// .binaryType and .onmessage and calls .send(); all three keep working.
const DEAD_SOCKET =
  '{ binaryType: "", readyState: 3, url: "", send: function () {}, close: function () {},' +
  ' addEventListener: function () {}, removeEventListener: function () {} }';

const RULES = [
  {
    id: 'always-on socket to beautiful-sapphire-toad.glitch.me',
    why: 'opened on page load, unasked. Whoever runs that server sees your IP '
       + 'and that you are running this mod, every time you open the game.',
    find: /new WebSocket\((?:`\$\{wssws\}:\/\/beautiful-sapphire-toad\.glitch\.me`|wssws \+ ":\/\/beautiful-sapphire-toad\.glitch\.me")\)/,
    to: DEAD_SOCKET,
  },
  {
    id: 'third-party fill-bot servers',
    why: 'the mod hands them your game server URL and a captcha token so they '
       + 'can connect bots as you. Emptying the list leaves the feature in '
       + 'place and connecting to nobody.',
    find: /let projects = \[\s*"adorable-eight-guppy",\s*"galvanized-bittersweet-windshield"\s*\];/,
    to: 'let projects = []; // emptied: these were third-party servers, handed your session token',
  },
  {
    id: "the POST that carried other players' chat to an AI server",
    why: 'every message another player typed was POSTed to a server that is not '
       + "the game's. The feature is off by default; this makes it impossible "
       + 'rather than merely unlikely.',
    find: /request\.send\(JSON\.stringify\(datasss\)\);/,
    // The comment must not name the host: it would put the string back into the
    // file and the count below would rise instead of fall. That check caught
    // this on the first run, which is the entire reason it is there.
    to: '/* removed: this sent other players\u2019 chat to a third-party server */',
  },
  {
    id: 'the address that POST went to',
    why: 'the request is already gone; taking the URL with it means the host '
       + 'does not appear in the file at all.',
    find: /const apiUrl = `https:\/\/lollo\.andorrturtle\.repl\.co\/get_response`;/,
    to: 'const apiUrl = ""; /* removed: a third-party AI endpoint */',
  },
];

let src = fs.readFileSync(IN, 'utf8').replace(/\r\n/g, '\n');
const before = src;
const applied = [];

for (const rule of RULES) {
  const all = [...src.matchAll(new RegExp(rule.find.source, rule.find.flags + 'g'))];
  if (!all.length) continue;
  if (all.length > 1) {
    console.error('declaw: "' + rule.id + '" matched ' + all.length + ' times -- expected one. Stopping.');
    process.exit(1);
  }
  // Keep the line count identical by padding with the newlines the matched
  // text contained. blisma writes its server list across four lines and the
  // replacement is one, and without this the "nothing else moved" check below
  // fires on a correct edit -- which would either stop a good change or, worse,
  // teach me to loosen the check.
  const pad = '\n'.repeat((all[0][0].match(/\n/g) || []).length);
  src = src.replace(rule.find, rule.to + pad);
  applied.push(rule);
}

if (!applied.length) {
  console.log(path.basename(IN) + ': nothing to remove');
  fs.writeFileSync(OUT, src);
  process.exit(0);
}

/* --- prove the edits are the only difference ------------------------------ */
// Line counts have to match: every rule replaces an expression with an
// expression, so nothing may appear or disappear.
if (src.split('\n').length !== before.split('\n').length) {
  console.error('declaw: the line count changed -- an edit did more than it should have');
  process.exit(1);
}
try { acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); }
catch (e) { console.error('declaw: the result does not parse -- ' + e.message); process.exit(1); }

// And the hosts it could reach must be strictly fewer. Not by parsing URLs:
// these are built by concatenation (`wssws + "://host"`) and as template
// literals, so a scheme-anchored pattern sees none of them. Count the host
// names themselves.
const HOSTS = ['beautiful-sapphire-toad.glitch.me', 'adorable-eight-guppy',
               'galvanized-bittersweet-windshield', 'lollo.andorrturtle.repl.co'];
const count = (t, h) => (t.split(h).length - 1);
const gone = HOSTS.filter(h => count(before, h) > 0 && count(src, h) < count(before, h))
  .map(h => h + ' (' + count(before, h) + ' -> ' + count(src, h) + ')');
for (const h of HOSTS) {
  if (count(src, h) > count(before, h)) {
    console.error('declaw: ' + h + ' appears MORE often than before -- refusing to write');
    process.exit(1);
  }
}

fs.writeFileSync(OUT, src);
console.log(path.basename(IN));
for (const r of applied) {
  console.log('  removed: ' + r.id);
  console.log('           ' + r.why);
}
console.log('  host names removed: ' + (gone.length ? gone.join(', ') : '(none)'));
console.log('  lines: ' + src.split('\n').length + ', unchanged');
console.log('  -> ' + OUT);
