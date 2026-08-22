#!/usr/bin/env node
/**
 * Looks through a userscript for the things that would make it unsafe to run:
 * data leaving the machine, credentials being collected, and code that is
 * assembled at runtime so you cannot see what it does by reading it.
 *
 * This is a reading aid, not a verdict. Every hit needs a human to look at the
 * line -- half of what it finds is a mod drawing an icon from a CDN, and the
 * other half is the same call with a player's name in the query string. What it
 * is for is making sure nothing gets skipped in a megabyte of minified code.
 *
 * Three passes:
 *
 *   1. every string literal that looks like a URL, grouped by host, so the
 *      complete list of places the file could talk to is in front of you;
 *   2. the calls that can send something (fetch, XHR, sendBeacon, WebSocket,
 *      Image().src, script/link injection) with their surrounding line;
 *   3. patterns worth a second look on their own -- password gates, cookie and
 *      clipboard reads, keystroke capture, and runtime code assembly.
 *
 * Usage: node tools/audit-mod.js <file.js> [...]
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

// Hosts a moomoo mod has an innocent reason to touch. Being on this list is not
// a pass -- what is SENT still matters -- it only keeps the report readable.
const EXPECTED = [
  /(^|\.)moomoo\.io$/, /(^|\.)sandbox\.moomoo\.io$/,
  /(^|\.)greasyfork\.org$/, /(^|\.)openuserjs\.org$/,
  /(^|\.)jquery\.com$/, /(^|\.)jsdelivr\.net$/, /(^|\.)unpkg\.com$/,
  /(^|\.)cloudflare\.com$/, /(^|\.)cdnjs\.cloudflare\.com$/,
  /(^|\.)googleapis\.com$/, /(^|\.)gstatic\.com$/,
  /(^|\.)github\.com$/, /(^|\.)githubusercontent\.com$/,
  /(^|\.)imgur\.com$/, /(^|\.)postimg\.cc$/, /(^|\.)ibb\.co$/,
  /(^|\.)youtube\.com$/, /(^|\.)youtu\.be$/,
  /(^|\.)w3\.org$/, /(^|\.)mozilla\.org$/,
];

// Hosts that exist to receive data.
const SINKS = [
  [/discord(app)?\.com\/api\/webhooks/i, 'Discord webhook'],
  [/webhook\.site/i, 'webhook.site collector'],
  [/api\.telegram\.org/i, 'Telegram bot API'],
  [/pastebin\.com|hastebin|paste\.ee/i, 'paste service'],
  [/ipify|ipinfo\.io|ip-api\.com|ipapi\.co|geolocation-db/i, 'IP / geolocation lookup'],
  [/google-analytics|googletagmanager|mixpanel|segment\.io|amplitude/i, 'analytics'],
];

const SEND_CALLS = [
  [/\bfetch\s*\(/g, 'fetch'],
  [/\bnew\s+XMLHttpRequest\b|\.open\s*\(\s*["'](?:POST|GET|PUT)["']/g, 'XMLHttpRequest'],
  [/navigator\.sendBeacon\s*\(/g, 'sendBeacon'],
  [/new\s+(?:\w+\.)?WebSocket\s*\(/g, 'WebSocket'],
  [/new\s+Image\s*\(\s*\)[\s\S]{0,40}?\.src\s*=/g, 'Image().src (a GET with no response)'],
  [/document\.createElement\s*\(\s*["']script["']\s*\)/g, 'injected <script>'],
  [/\bimportScripts\s*\(/g, 'importScripts'],
  [/navigator\.clipboard\.readText/g, 'clipboard read'],
];

const FLAGS = [
  [/\bprompt\s*\(/g, 'prompt() -- check whether it is a password gate'],
  [/password|passwd|\bpwd\b/gi, 'the word "password"'],
  [/\bhwid\b|fingerprint|deviceId/gi, 'device fingerprinting vocabulary'],
  [/document\.cookie/g, 'document.cookie'],
  [/localStorage\s*\[|localStorage\.getItem|GM_getValue/g, 'stored-value read'],
  [/\beval\s*\(/g, 'eval()'],
  [/new\s+Function\s*\(/g, 'new Function()'],
  [/\batob\s*\(/g, 'atob() -- base64, often around code or a URL'],
  [/addEventListener\s*\(\s*["']keydown["']/g, 'keydown listener'],
  [/\.key\b[\s\S]{0,30}?(push|\+=)/g, 'keystrokes being accumulated'],
];

function hostOf(u) {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(u);
  return m ? m[1].toLowerCase() : null;
}
function lineOf(src, index) { return src.slice(0, index).split('\n').length; }
function context(src, index, width) {
  const from = src.lastIndexOf('\n', index) + 1;
  let to = src.indexOf('\n', index);
  if (to < 0) to = src.length;
  const line = src.slice(from, to);
  // minified files are one enormous line; show a window instead
  if (line.length > (width || 160)) {
    const at = index - from;
    return '…' + line.slice(Math.max(0, at - 70), at + 90).trim() + '…';
  }
  return line.trim();
}

function audit(file) {
  const src = fs.readFileSync(file, 'utf8');
  const name = path.basename(file);
  console.log('\n' + '='.repeat(72));
  console.log(name + '   ' + src.length.toLocaleString() + ' bytes, ' +
              src.split('\n').length.toLocaleString() + ' lines');
  const meta = /@name\s+(.+)/.exec(src);
  if (meta) console.log('  declares itself: ' + meta[1].trim());
  console.log('='.repeat(72));

  /* --- 1. every host it could reach ------------------------------------- */
  // From the AST, not from a regex over the source. Genessis keeps every string
  // in one array and refers to them as _0x50dfda(0x2fc), so a regex over the
  // text finds nothing at all and reports a clean file. Parsing gets the
  // strings whatever the source looks like, and it also catches template
  // literals and concatenations a quote-anchored pattern would miss.
  const hosts = new Map();
  const literals = [];
  let parsed = null;
  try {
    parsed = acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true, locations: true });
  } catch (e) {
    console.log('\n(!) this file does not parse -- falling back to a text scan, which an '
      + 'obfuscated file can hide from: ' + e.message);
  }
  if (parsed) {
    walk.simple(parsed, {
      Literal(n) { if (typeof n.value === 'string') literals.push({ v: n.value, line: n.loc.start.line }); },
      TemplateElement(n) { if (n.value && n.value.cooked) literals.push({ v: n.value.cooked, line: 0 }); },
    });
  } else {
    for (const m of src.matchAll(/["'`]([^"'`\n]{4,})["'`]/g))
      literals.push({ v: m[1], line: lineOf(src, m.index) });
  }
  console.log('\n   (' + literals.length.toLocaleString() + ' string literals read'
    + (parsed ? ' from the parsed file' : ' by text scan') + ')');
  for (const { v, line } of literals) {
    for (const m of String(v).matchAll(/(?:https?|wss?):\/\/[^\s"'`<>]+/g)) {
      const h = hostOf(m[0]);
      if (!h) continue;
      if (!hosts.has(h)) hosts.set(h, []);
      if (hosts.get(h).length < 4) hosts.get(h).push({ url: m[0], line });
    }
  }
  const foreign = [...hosts.keys()].filter(h => !EXPECTED.some(re => re.test(h)));
  console.log('\n-- hosts named in the file --');
  console.log('   ' + hosts.size + ' distinct; ' + (hosts.size - foreign.length) +
              ' are the game, a CDN or an image host');
  if (!foreign.length) console.log('   nothing else');
  for (const h of foreign) {
    console.log('   ' + h);
    for (const u of hosts.get(h)) console.log('       line ' + u.line + '  ' + u.url.slice(0, 110));
  }

  /* --- 1b. the API names, wherever they are written --------------------- */
  // An obfuscated file does not write `fetch(`. It writes
  // window[_0x50dfda(0x1a2)](...), and the name is in the string table. So the
  // pattern scan below, which reads source text, proves nothing on its own for
  // a file like Genessis: it can only report "none" whether or not there is
  // something. Every dynamically-accessed property has to exist as a string
  // somewhere, so that is where to look.
  const NAMES = ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
                 'cookie', 'localStorage', 'sessionStorage', 'indexedDB', 'clipboard',
                 'eval', 'Function', 'atob', 'btoa', 'importScripts', 'Worker',
                 'geolocation', 'userAgent', 'appendChild', 'createElement'];
  const seen = new Map();
  for (const { v } of literals) {
    const t = String(v);
    for (const n of NAMES) if (t === n || t === 'on' + n) seen.set(n, (seen.get(n) || 0) + 1);
  }
  if (seen.size) {
    console.log('\n-- API names present as strings (how obfuscated code reaches them) --');
    console.log('   ' + [...seen.entries()].map(([n, c]) => n + (c > 1 ? ' x' + c : '')).join(', '));
    const risky = ['fetch', 'XMLHttpRequest', 'sendBeacon', 'EventSource', 'cookie',
                   'clipboard', 'eval', 'importScripts', 'geolocation'].filter(n => seen.has(n));
    console.log('   ' + (risky.length
      ? 'of those, worth chasing down: ' + risky.join(', ')
      : 'none of the ones that can move data off the machine'));
  }

  /* --- 2. anything that could carry data out ---------------------------- */
  console.log('\n-- calls that can send --');
  let sent = 0;
  for (const [re, label] of SEND_CALLS) {
    const hits = [...src.matchAll(re)];
    if (!hits.length) continue;
    sent += hits.length;
    console.log('   ' + label + ': ' + hits.length);
    for (const h of hits.slice(0, 6))
      console.log('       line ' + lineOf(src, h.index) + '  ' + context(src, h.index));
    if (hits.length > 6) console.log('       ... and ' + (hits.length - 6) + ' more');
  }
  if (!sent) console.log('   none');

  /* --- 3. worth a second look ------------------------------------------- */
  console.log('\n-- worth a second look --');
  let flagged = 0;
  for (const [re, label] of FLAGS) {
    const hits = [...src.matchAll(re)];
    if (!hits.length) continue;
    flagged++;
    console.log('   ' + label + ': ' + hits.length);
    for (const h of hits.slice(0, 3))
      console.log('       line ' + lineOf(src, h.index) + '  ' + context(src, h.index));
  }
  if (!flagged) console.log('   nothing');

  /* --- known collectors, called out separately -------------------------- */
  const found = SINKS.filter(([re]) => re.test(src));
  console.log('\n-- known data collectors --');
  console.log(found.length ? found.map(([, l]) => '   ' + l).join('\n') : '   none');
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node tools/audit-mod.js <file.js> [...]'); process.exit(2); }
files.forEach(audit);
