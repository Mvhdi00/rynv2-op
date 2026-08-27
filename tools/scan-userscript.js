#!/usr/bin/env node
// Scan a userscript for the things that make one dangerous to run:
// hidden payloads, string obfuscation, code fetched at runtime, data leaving
// the machine, page wipes, and chat-triggered kill switches.
//
//   node tools/scan-userscript.js <file.user.js>
//
// It reports what it finds and where. It does not run any of the script.

const fs = require('fs');

const HOST_ALLOW = [
    'moomoo.io', 'fonts.googleapis.com', 'fonts.gstatic.com',
    'greasyfork.org', 'cdn.jsdelivr.net', 'unpkg.com',
    'static.wikia.nocookie.net', 'upload.wikimedia.org',
    'code.jquery.com', 'tampermonkey.net', 'i.postimg.cc'
];

// APIs worth a second look. Presence is not proof of anything - the report
// says where each one is so it can be read in context.
const API_PATTERNS = [
    ['sends data out', /\bfetch\s*\(|XMLHttpRequest|sendBeacon|GM_xmlhttpRequest|GM\.xmlHttpRequest/g],
    ['opens its own socket', /new\s+WebSocket|new\s+EventSource|RTCPeerConnection/g],
    ['runs code built at runtime', /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"]/g],
    ['loads code from a URL', /createElement\s*\(\s*['"]script['"]|import\s*\(|importScripts/g],
    ['reads stored credentials', /document\.cookie|localStorage\.getItem|sessionStorage|indexedDB/g],
    ['reads another origin in a frame', /createElement\s*\(\s*['"]iframe['"]|contentWindow|contentDocument/g],
    ['captures typing', /addEventListener\s*\(\s*['"](?:keydown|keypress|keyup|paste|input)['"]/g],
    ['sends the user somewhere', /location\s*\.\s*(?:href|replace)\s*[=(]|window\.open\s*\(/g],
    ['hides its own output', /console\.clear\s*\(/g],
    ['blanks the page', /(?:documentElement|document\.body)\s*\.\s*innerHTML\s*=\s*['"]{2}|['"]{2}\s*;?\s*$/g]
];

const file = process.argv[2];
if (!file) {
    console.error('usage: node tools/scan-userscript.js <file.user.js>');
    process.exit(2);
}
const src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');

let flags = 0;
const section = (title) => console.log(`\n== ${title}`);
const flag = (msg) => { flags++; console.log(`  [!] ${msg}`); };
const ok = (msg) => console.log(`  ok  ${msg}`);

// --- 1. hosts -------------------------------------------------------------
section('Hosts it talks to');
const hosts = new Map();
for (const m of src.matchAll(/https?:\/\/([A-Za-z0-9._-]+)[^\s'"`)]*/g)) {
    const host = m[1];
    if (host === '*') continue;
    const line = src.slice(0, m.index).split('\n').length;
    if (!hosts.has(host)) hosts.set(host, line);
}
for (const [host, line] of [...hosts].sort()) {
    const allowed = HOST_ALLOW.some(a => host === a || host.endsWith('.' + a));
    if (allowed) ok(`${host} (line ${line})`);
    else flag(`${host} (line ${line}) - not a known game/library host`);
}
if (!hosts.size) ok('no URLs at all');

// --- 2. hidden payloads ---------------------------------------------------
section('Code hidden off the right edge of a line');
let hidden = 0;
lines.forEach((l, i) => {
    // deeply indented minified code trips a naive "long run of spaces" test,
    // so the bar is a payload-sized chunk, not just a long line
    const m = l.match(/[ \t]{40,}/);
    if (m && l.length - (m.index + m[0].length) > 2000) {
        flag(`line ${i + 1}: ${l.length - m.index - m[0].length} chars parked after ${m[0].length} spaces`);
        hidden++;
    } else if (!m && l.length > 5000) {
        flag(`line ${i + 1}: single line of ${l.length} chars`);
        hidden++;
    }
});
if (!hidden) ok('nothing parked past a wall of whitespace');

// --- 3. string obfuscation ------------------------------------------------
section('String obfuscation');
let alphabets = 0;
lines.forEach((l, i) => {
    for (const m of l.matchAll(/"((?:[^"\\]|\\.){88,100})"/g)) {
        const raw = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        if (raw.length === 91 && new Set(raw).size === 91) {
            flag(`line ${i + 1}: 91-character alphabet - basE91 string table, strings are not readable as written`);
            alphabets++;
            break;
        }
    }
});
if (!alphabets) ok('no encoded string tables');

// --- 4. APIs --------------------------------------------------------------
section('What the code can do');
for (const [label, re] of API_PATTERNS) {
    const hits = [];
    for (const m of src.matchAll(re)) {
        if (m[0].length < 3) continue;
        hits.push(src.slice(0, m.index).split('\n').length);
    }
    if (hits.length) {
        const shown = hits.slice(0, 6).join(', ');
        console.log(`  --  ${label}: ${hits.length}x (line${hits.length > 1 ? 's' : ''} ${shown}${hits.length > 6 ? ', ...' : ''})`);
    }
}

// --- 5. kill switches -----------------------------------------------------
section('Remote kill switches');
const KILL = [
    ['a string check blanks the page (chat message, URL, ...)', /includes\s*\(\s*["'][^"']{3,12}["']\s*\)\s*\)?\s*\{[^}]{0,120}innerHTML\s*=\s*['"]{2}/g],
    ['a chat message disconnects you', /localeCompare\s*\(\s*message\s*\)[^}]{0,200}(?:leave|disconnect)/g],
    ['a missing variable blanks the page', /typeof\s+\w+\s*===?\s*["']undefined["'][^}]{0,160}innerHTML\s*=\s*['"]{2}/g],
    ['the page is blanked for some browsers', /navigator\.userAgent[^}]{0,200}innerHTML\s*=\s*['"]{2}/g]
];
let kills = 0;
for (const [label, re] of KILL) {
    for (const m of src.matchAll(re)) {
        flag(`line ${src.slice(0, m.index).split('\n').length}: ${label}`);
        kills++;
    }
}
if (!kills) ok('none found');

// --- 6. header ------------------------------------------------------------
section('Userscript header');
const header = src.slice(0, src.indexOf('==/UserScript==') + 1 || 4000);
for (const m of header.matchAll(/@(require|updateURL|downloadURL|connect|grant)\s+(\S+)/g)) {
    const [, key, value] = m;
    if (key === 'require') {
        const host = (value.match(/https?:\/\/([^/]+)/) || [])[1] || value;
        const allowed = HOST_ALLOW.some(a => host === a || host.endsWith('.' + a));
        allowed ? ok(`@require ${host}`) : flag(`@require ${host} - third-party code with full page access`);
    } else if (key === 'updateURL' || key === 'downloadURL') {
        flag(`@${key} ${value} - the author can replace this script on your machine silently`);
    } else {
        ok(`@${key} ${value}`);
    }
}

console.log(`\n${flags ? `${flags} thing(s) to look at` : 'nothing flagged'}`);
process.exit(flags ? 1 : 0);
