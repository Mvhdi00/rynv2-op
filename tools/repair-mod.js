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

/* --- 2c. ALTCHA, and other page furniture that has gone -------------------
 * moomoo replaced ALTCHA with Cloudflare Turnstile and stopped publishing
 * setupCard on window. Mods from that era still wire the old widget up at
 * their top level, so the first dereference throws and takes the boot with it.
 * The game solves Turnstile by itself now, so there is nothing to replace --
 * these only need to stop being fatal.
 */
let body2 = body;
const guards = [
  // window.setupCard.innerHTML += "<script-widget ... altcha ...>"
  [/^(\s*)window\.setupCard\.innerHTML \+=/m, '$1if (window.setupCard) window.setupCard.innerHTML +='],
  // window.altcha.replaceWith(window["script-altcha"])
  [/^(\s*)window\.altcha\.replaceWith\(/m, '$1if (window.altcha) window.altcha.replaceWith('],
];
for (const [re, rep] of guards) {
  if (re.test(body2)) { body2 = body2.replace(re, rep); report.guarded = (report.guarded || 0) + 1; }
}

// `let x = getEl("adCard"); x.remove();` -- the commonest failure in this
// whole family. The element is gone from the page, the mod only wants it gone,
// and the deref kills everything after it. The unpatcher stubs a closed list of
// ids, but mods reach for others too, so guard the pattern itself.
// The dereference is not always on the very next line -- novastorm fetches
// partyButton, does two other things, and removes it three lines later -- so
// allow a couple of statements in between, as long as they do not touch the
// variable themselves.
body2 = body2.replace(
  /^(\s*)(let|const|var) (\w+) = ((?:getEl|document\.getElementById)\([^)]*\));\n((?:(?!\3)[^\n]*\n){0,3}?)(\s*)\3\.(remove\(\)|style\.\w+ =|innerHTML =|innerText =)/gm,
  (m, i1, kw, v, call, between, i2, tail) => {
    report.guarded = (report.guarded || 0) + 1;
    // the call is kept exactly as written -- rewriting it to reach for `getEl`
    // defensively broke two mods that declare it later, or not at all
    return `${i1}${kw} ${v} = ${call};\n${between}${i2}if (${v}) ${v}.${tail}`;
  });

// The same thing written inline, with no variable in between:
//   document.querySelector('#guideCard .menuText').remove();
//   document.getElementById("adCard").remove();
// Optional chaining is exactly the semantics wanted here -- remove it if it is
// there, do nothing if it is not -- and it cannot change what happens when the
// element does exist.
// Only method calls: `x?.style.display = "none"` is a syntax error, because
// optional chaining cannot be the target of an assignment. The parse check
// caught that on the first attempt.
body2 = body2.replace(
  /(document\.(?:querySelector|getElementById)\((?:[^()]|\([^()]*\))*\))\.(remove\(\)|classList\.(?:add|remove|toggle)\()/g,
  (m, call, tail) => { report.guarded = (report.guarded || 0) + 1; return call + '?.' + tail; });

// `let a = document.getElementById(x); let b = a.firstChild; if (b.nodeType`
// -- an empty or absent element makes firstChild null and the next line throws.
body2 = body2.replace(
  /^(\s*)(let|const|var) (\w+) = (\w+)\.firstChild;\n(\s*)if \(\3\.nodeType/m,
  (m, i1, kw, v, parent, i2) => {
    report.guarded = (report.guarded || 0) + 1;
    return `${i1}${kw} ${v} = ${parent} && ${parent}.firstChild;\n${i2}if (${v} && ${v}.nodeType`;
  });

/* --- 2c-2. an unskippable password prompt ---------------------------------
 * novastorm opens with:
 *
 *     let pass = prompt("Lutfen mod sifresini giriniz:");
 *     while (pass !== "novabruh") { pass = prompt("Yanlis sifre! ..."); }
 *
 * Two things are wrong with it. prompt() returns null when the dialog is
 * dismissed, and null never equals the password, so pressing Escape re-opens
 * it for ever -- the tab hangs and cannot be closed by the page. And the
 * password it is checking against sits in plaintext three lines above the
 * check, so it gates nothing anyway. Sakuna shipped the same shape.
 *
 * The loop goes. Only this shape is matched: a prompt assigned at the top
 * level, then a while comparing it to a string literal.
 */
{
  const gate = /^let (\w+) = prompt\([^)]*\);\n\s*while \(\1 !== "[^"]*"\) \{\n(?:[^\n]*\n)*?\s*\}\n/m;
  const m = gate.exec(body2);
  if (m) {
    body2 = body2.replace(gate, '');
    report.passwordGate = true;
  }
}

/* --- 2c-3. a client replacement waiting on ALTCHA -------------------------
 * A mod that carries its own copy of the client carries its own copy of the
 * entry state machine too, and in this generation that machine waits for
 * ALTCHA:
 *
 *     var V0;
 *     function U0(e) {
 *         e?.detail?.state === "verified" && (V0 = e.detail.payload, ...)
 *     }
 *     window.addEventListener("load", () => {
 *         document.getElementById("altcha_checkbox").click();       // null now
 *         ...addEventListener("statechange", U0)
 *     });
 *
 *     !O0 || $1 || ($1 = !0, ... V0 && th("alt:" + V0) : ...)
 *
 * The widget is gone, so the listener throws on its first line, `V0` is never
 * set, and the connect is the same latched dead end the game itself has: press
 * ENTER GAME, get "Connecting...", and nothing else ever happens. Guarding the
 * null would stop the throw and change nothing about the outcome.
 *
 * The token it wants is a captcha token, and there is one -- Cloudflare's. So
 * the ALTCHA wiring is replaced by a wait on EXP.token(). The "alt:" prefix the
 * mod puts on the wire is left alone: the shim's fixUrl already replaces a
 * stale alt:/re: token with the live cf: one on the way out, which is the job
 * it was written for.
 */
{
  const payload = /\(\s*(\w+) = \w+\.detail\.payload,/.exec(body2);
  const loader = /window\.addEventListener\("load", \(\) => \{\n\s*document\.getElementById\("altcha_checkbox"\)[\s\S]*?\n\}\);\n/.exec(body2);
  if (payload && loader) {
    const v = payload[1];
    // The original hangs this off window "load". The body is deferred now, so
    // "load" can have fired already -- and a listener added after the event is
    // a listener that never runs, which would be the same dead end by another
    // route. Start immediately if the page is done.
    body2 = body2.replace(loader[0],
      '(document.readyState === "complete" ? function (f) { f(); }\n' +
      '                                    : function (f) { window.addEventListener("load", f); })(function () {\n' +
      '    const btn = document.getElementById("enterGame");\n' +
      '    if (btn) btn.innerText = "Generating Token";\n' +
      '    (function wait() {\n' +
      '        const t = EXP.token();\n' +
      '        if (!t) return setTimeout(wait, 300);\n' +
      '        ' + v + ' = t.replace(/^cf:/, "");\n' +
      '        if (btn) {\n' +
      '            btn.innerText = "Enter Game";\n' +
      '            if (btn.classList) btn.classList.remove("disabled");\n' +
      '        }\n' +
      '    })();\n' +
      '});\n');
    report.altcha = v;
  }
}

/* --- 2c-4. a client that spawns before the handshake ----------------------
 * A mod carrying its own copy of the 2019 io-client opens the game like this:
 *
 *     this.socket.onopen = function () {
 *         _this.connected = true;
 *         callback();                       // "we are connected, go"
 *     };
 *     this.socket.onmessage = function (message) {
 *         ...
 *         if (type == "io-init") { _this.socketId = data[0]; }
 *
 * The current game does not. It calls its callback from *inside* onmessage,
 * on the io-init branch:
 *
 *     if (m === "io-init") { ... o || (o = !0, t()); return }
 *
 * and it has to, because io-init is what carries the seed and the key every
 * frame after it is signed with. A client that starts on `open` sends its
 * spawn into a socket that has no session yet: the packet goes out unsigned,
 * the server drops it, and the client sits on "Loading..." having said nothing
 * the server would answer. tools/probe-entry.js shows it on the wire --
 *
 *     rejected: unsigned ["M",[{"name":"...","moofoll":null,"skin":0}]]
 *
 * -- and no amount of transport shimming underneath can fix it, because the
 * shim has nothing to sign with that early either.
 *
 * So the callback moves to where the game keeps it. `connected` stays on open,
 * since that is what it means. Both novastorm and x18k carry this client, one
 * pretty-printed and one minified, so both spellings are matched.
 */
{
  const openShapes = [
    // this.socket.onopen = function () { _this.connected = true; callback(); };
    [/(\.onopen = function \(\) \{\s*(\w+)\.connected = true;)\s*(\w+)\(\);/, 1],
    // this.socket.onopen = function() { o.connected = !0, n() }
    [/(\.onopen = function\(\) \{\s*(\w+)\.connected = !0), (\w+)\(\)/, 2],
  ];
  let obj = null;
  for (const [re, style] of openShapes) {
    const m = re.exec(body2);
    if (!m) continue;
    obj = m[2];
    // The callback is stashed on the client object rather than called by name
    // at the io-init site. x18k is minified and its message handler opens with
    //     const n = ol.decode(t)
    // which shadows `n`, the callback -- calling it there got "n is not a
    // function". `open` always fires before the first message, so stashing it
    // here is both safe and immune to whatever the minifier called things.
    body2 = body2.replace(re, style === 1 ? `$1 ${obj}._go = $3;` : `$1, ${obj}._go = $3`);
    break;
  }
  if (obj) {
    const start = `${obj}._started || (${obj}._started = 1, ${obj}._go && ${obj}._go())`;
    const initShapes = [
      // if (type == "io-init") { _this.socketId = data[0]; }
      [new RegExp('(if \\(\\w+ == "io-init"\\) \\{\\s*' + obj + '\\.socketId = \\w+\\[0\\];)'),
       (m) => m[1] + ' ' + start + ';'],
      // i == "io-init" ? o.socketId = t[0] : ...
      [new RegExp('(\\w+ == "io-init" \\? )(' + obj + '\\.socketId = \\w+\\[0\\])( :)'),
       (m) => m[1] + '(' + m[2] + ', ' + start + ')' + m[3]],
    ];
    let done = false;
    for (const [re, build] of initShapes) {
      const m = re.exec(body2);
      if (!m) continue;
      body2 = body2.replace(re, build(m));
      done = true;
      break;
    }
    if (!done) {
      console.error('repair-mod: moved the client off socket-open but found no io-init branch to start it from');
      process.exit(1);
    }
    report.handshakeOrder = true;
  }
}

/* --- 2d. client replacements ----------------------------------------------
 * A mod that opens its own socket and decodes with its own bundled codec has
 * no game bundle underneath it, so its message handler is the FIRST one on
 * that socket -- and the shim's ordering rule ("the game got there first")
 * would hand it raw numeric opcodes. The shim can also tell from a stack
 * trace, but that is a guess about how the userscript manager injected the
 * file. Here the answer is known, so say it outright.
 */
const OWNS_SOCKET = /new (?:Original)?WebSocket\s*\(/.test(body2)
  && !/WebSocket\.prototype\.send\s*=/.test(body2);
if (OWNS_SOCKET) report.client = true;

/* --- 3. the unpatcher, inlined -------------------------------------------- */
const unpatcher = fs.readFileSync(path.join(ROOT, 'MooUnpatcher.user.js'), 'utf8');
const uMeta = unpatcher.indexOf('// ==/UserScript==');
let shim = stripComments(unpatcher.slice(uMeta + '// ==/UserScript=='.length), { metadata: false }).out.trim();
if (report.client) shim = 'window.UNPATCH_CLIENT = true;\n' + shim;

/* --- 4. defer the body ---------------------------------------------------- */
// Only if it needs it: a mod that already waits for the DOM must not be made
// to wait twice, and one that touches nothing at its top level loses nothing
// by running immediately.
// The first version only looked at column-0 lines, which is wrong for a
// webpack bundle: novastorm's DOM code all sits indented inside modules, so it
// was judged DOM-free and left to run at document-start against an empty page.
// Any use of the DOM at all is enough -- running a moment later costs a mod
// nothing, and running too early costs it everything.
const TOUCHES_DOM = /document\.(?:body|head|getElementById|querySelector)|\bgetEl\(/.test(body2);
let out;
if (TOUCHES_DOM) {
  report.deferred = true;
  out = meta + '// ==/UserScript==\n\n' + shim + '\n\nfunction __repairedBoot() {\n' + body2 +
    '\n}\n(function __repairedStart(tries) {\n' +
    '    tries = tries || 0;\n' +
    '    if ((document.readyState === "loading" || !document.getElementById("gameUI")) && tries < 400) {\n' +
    '        return setTimeout(function () { __repairedStart(tries + 1); }, 50);\n' +
    '    }\n' +
    '    __repairedBoot();\n' +
    '})();\n';
} else {
  out = meta + '// ==/UserScript==\n\n' + shim + '\n' + body2;
}

try { acorn.parse(out, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); }
catch (e) { console.error('repair-mod: the result does not parse -- ' + e.message); process.exit(1); }

report.bytes[1] = out.length;
fs.writeFileSync(OUT, out);

console.log(report.name.trim());
console.log('  @run-at  : ' + report.runAt);
console.log('  @require : ' + (report.requires.length ? report.requires.join(', ') : '(none dead)'));
if (report.passwordGate) console.log('  password : removed an unskippable prompt loop (dismissing it hung the tab for ever)');
if (report.handshakeOrder) console.log('  handshake: its client started on socket-open; moved to io-init, where the session key arrives');
if (report.altcha) console.log('  captcha  : its own ALTCHA wait replaced by the Turnstile token (was "' + report.altcha + '", never set)');
if (report.client) console.log('  transport: client replacement -- shim told to treat every handler as the mod\'s');
if (report.guarded) console.log('  guarded  : ' + report.guarded + ' dereference(s) of page furniture the game removed');
if (report.jquery) console.log('  jQuery   : added (used but never required)');
console.log('  body     : ' + (report.deferred ? 'deferred behind __repairedBoot' : 'left at top level (touches no DOM)'));
console.log('  -> ' + path.relative(ROOT, OUT));
