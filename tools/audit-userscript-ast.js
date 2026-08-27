#!/usr/bin/env node
// AST audit of a userscript: parse it and enumerate every construct that could
// move data off the machine or run code that is not in the file. Regex can be
// fooled by aliasing and string building; the parser cannot.
//
//   npm i --no-save acorn acorn-walk
//   node tools/audit-userscript-ast.js <file.user.js>
//
// Nothing is executed.
const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');

const file = process.argv[2];
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true, allowReturnOutsideFunction: true });

const NET_NAMES = new Set(['fetch','XMLHttpRequest','sendBeacon','WebSocket','EventSource','RTCPeerConnection',
                           'Worker','SharedWorker','ServiceWorker','navigator','importScripts','Image','Audio']);
const CODE_NAMES = new Set(['eval','Function','execScript','setTimeout','setInterval','write','writeln','insertAdjacentHTML']);
const STORE_PROPS = new Set(['cookie','localStorage','sessionStorage','indexedDB','credentials']);
const SINK_PROPS = new Set(['src','href','action','data','srcdoc','background']);

const hits = { network: [], dynamicCode: [], storage: [], sinks: [], computed: [], charCodes: [], urls: [], frames: [] };
const at = (n) => n.loc.start.line;
const name = (n) => n && n.type === 'Identifier' ? n.name : (n && n.type === 'Literal' ? String(n.value) : null);
const txt = (n) => src.slice(n.start, Math.min(n.end, n.start + 90)).replace(/\s+/g, ' ');

walk.simple(ast, {
    Identifier(n) {
        if (NET_NAMES.has(n.name) || n.name === 'sendBeacon') hits.network.push([at(n), n.name]);
        if (STORE_PROPS.has(n.name)) hits.storage.push([at(n), n.name]);
    },
    NewExpression(n) {
        const c = name(n.callee) || (n.callee.property && name(n.callee.property));
        if (c && (NET_NAMES.has(c) || c === 'Function')) hits.network.push([at(n), 'new ' + c]);
    },
    CallExpression(n) {
        const callee = n.callee;
        const fn = name(callee);
        if (fn && (NET_NAMES.has(fn) || CODE_NAMES.has(fn))) {
            (CODE_NAMES.has(fn) ? hits.dynamicCode : hits.network).push([at(n), txt(n)]);
        }
        if (callee.type === 'MemberExpression') {
            const prop = callee.computed ? null : name(callee.property);
            if (prop && CODE_NAMES.has(prop)) hits.dynamicCode.push([at(n), txt(n)]);
            if (prop === 'sendBeacon' || prop === 'open' && name(callee.object) === 'XMLHttpRequest') hits.network.push([at(n), txt(n)]);
            if (prop === 'postMessage') hits.frames.push([at(n), txt(n)]);
            if (prop === 'createElement') {
                const a = n.arguments[0];
                if (a && a.type === 'Literal' && /iframe|script|object|embed/i.test(String(a.value))) hits.frames.push([at(n), txt(n)]);
                if (!a || a.type !== 'Literal') hits.frames.push([at(n), 'createElement(<not a literal>) ' + txt(n)]);
            }
            if (prop === 'fromCharCode' || prop === 'fromCodePoint') {
                if (n.arguments.length > 2) hits.charCodes.push([at(n), txt(n)]);
            }
        }
        // setTimeout/setInterval given a string instead of a function
        if (fn === 'setTimeout' || fn === 'setInterval') {
            const a = n.arguments[0];
            if (a && (a.type === 'Literal' || a.type === 'TemplateLiteral')) hits.dynamicCode.push([at(n), 'timer with a string body: ' + txt(n)]);
        }
    },
    MemberExpression(n) {
        if (!n.computed) {
            const p = name(n.property);
            if (STORE_PROPS.has(p)) hits.storage.push([at(n), txt(n)]);
        } else {
            // window["fe"+"tch"] and friends: a property name that is not a plain literal
            const k = n.property;
            if (k.type !== 'Literal' || typeof k.value !== 'number') {
                const obj = name(n.object);
                if (['window','globalThis','self','top','parent','frames','document','navigator'].includes(obj)) {
                    hits.computed.push([at(n), txt(n)]);
                }
            }
        }
    },
    AssignmentExpression(n) {
        if (n.left.type === 'MemberExpression' && !n.left.computed) {
            const p = name(n.left.property);
            if (SINK_PROPS.has(p) && n.right.type !== 'Literal') hits.sinks.push([at(n), txt(n)]);
            else if (SINK_PROPS.has(p) && /:\/\//.test(String(n.right.value))) hits.sinks.push([at(n), txt(n)]);
        }
    },
    Literal(n) {
        if (typeof n.value === 'string' && /:\/\/|\.[a-z]{2,}\/|workers\.dev|webhook/i.test(n.value) && n.value.length < 200) {
            hits.urls.push([at(n), n.value]);
        }
    },
    BinaryExpression(n) {
        // string building that could hide a host or an API name
        if (n.operator === '+' ) {
            const l = n.left, r = n.right;
            const val = (x) => x.type === 'Literal' && typeof x.value === 'string' ? x.value : null;
            if (val(l) && val(r) && /^(https?|ws|\/\/|fet|XML|send)/i.test(val(l))) hits.urls.push([at(n), val(l) + ' + ' + val(r)]);
        }
    }
});

const show = (title, arr, limit = 25) => {
    console.log(`\n== ${title}: ${arr.length}`);
    const seen = new Set();
    for (const [line, what] of arr) {
        const key = String(what).slice(0, 60);
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size > limit) { console.log(`   ... ${arr.length - limit} more`); break; }
        console.log(`   line ${line}: ${what}`);
    }
    if (!arr.length) console.log('   none');
};

console.log(`### ${file}`);
console.log(`parsed ok: ${ast.body.length} top-level statements`);
show('network-capable names and calls', hits.network);
show('dynamic code execution', hits.dynamicCode);
show('storage / credential access', hits.storage);
show('assignments to src/href/action', hits.sinks);
show('computed access on window/document/navigator', hits.computed);
show('String.fromCharCode with 3+ args', hits.charCodes);
show('iframe / script creation, postMessage', hits.frames);
show('URL-ish strings', hits.urls, 40);
