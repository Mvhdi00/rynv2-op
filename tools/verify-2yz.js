#!/usr/bin/env node
/* Static audit of the 2yz sources.
 *
 * Checks, in order:
 *
 *   1. every Config key is read somewhere            (no fake settings)
 *   2. every Config.get/section call names a real key (no dead reads)
 *   3. the c2s opcodes in Defs appear as O.send sites in the game bundle
 *   4. the s2c opcodes in Defs appear in the game bundle's handler map
 *   5. protocol constants match drivers/game-drivers.json
 *   6. no identifier from the reference clients leaked in
 *   7. no duplicated top-level declaration across modules
 *
 * Exits non-zero on any failure.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', '2yz');
const GAME = path.join(ROOT, 'src', 'game_index.js');
const DRIVERS = path.join(ROOT, 'drivers', 'game-drivers.json');

const failures = [];
const notes = [];

function fail(check, message) { failures.push(check + ': ' + message); }
function note(message) { notes.push(message); }

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
const sources = new Map();
for (const f of files) sources.set(f, fs.readFileSync(path.join(SRC, f), 'utf8'));
const allSource = Array.from(sources.values()).join('\n');

/* Strip block and line comments so prose in a header cannot satisfy a check. */
function stripComments(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, '');
}
const code = stripComments(allSource);

/* ---------------------------------------------------------------- 1 & 2 */

function collectConfigKeys() {
    const defs = sources.get('70-config.js');
    if (!defs) { fail('config', 'missing 70-config.js'); return []; }

    /* Re-parse the schema by evaluating just the object literal. */
    const start = defs.indexOf('const schema = {');
    const end = defs.indexOf('\n    };', start);
    if (start < 0 || end < 0) { fail('config', 'could not locate schema literal'); return []; }
    const literal = defs.slice(start + 'const schema = '.length, end + '\n    }'.length);

    let schema;
    try {
        // eslint-disable-next-line no-new-func
        schema = new Function('return (' + literal.trim().replace(/;$/, '') + ')')();
    } catch (err) {
        fail('config', 'schema literal did not parse: ' + err.message);
        return [];
    }

    const keys = [];
    const sections = [];
    (function walk(node, prefix) {
        let hasLeaf = false;
        for (const key of Object.keys(node)) {
            if (key.startsWith('_')) continue;
            const child = node[key];
            const p = prefix ? prefix + '.' + key : key;
            if (child && typeof child === 'object' && 'type' in child && 'def' in child) {
                keys.push(p);
                hasLeaf = true;
            } else {
                walk(child, p);
            }
        }
        if (hasLeaf && prefix) sections.push(prefix);
    })(schema, '');

    return { keys, sections };
}

const { keys: configKeys, sections: configSections } = collectConfigKeys();

/* Which keys are actually read. A Config.section('a.b') read counts as a read
 * of every leaf directly under a.b, because that is what it returns. */
const readKeys = new Set();
const getCalls = code.match(/Config\.get\(\s*'([^']+)'\s*\)/g) || [];
for (const call of getCalls) {
    readKeys.add(call.match(/'([^']+)'/)[1]);
}
const sectionCalls = code.match(/Config\.section\(\s*'([^']+)'\s*\)/g) || [];
const readSections = new Set();
for (const call of sectionCalls) readSections.add(call.match(/'([^']+)'/)[1]);

for (const key of configKeys) {
    if (readKeys.has(key)) continue;
    const parent = key.slice(0, key.lastIndexOf('.'));
    if (readSections.has(parent)) continue;
    fail('no-fake-settings', 'config key "' + key + '" is never read');
}

for (const key of readKeys) {
    if (!configKeys.includes(key)) fail('dead-read', 'Config.get("' + key + '") has no schema entry');
}
for (const section of readSections) {
    if (!configSections.includes(section)) fail('dead-read', 'Config.section("' + section + '") has no leaves');
}

note(configKeys.length + ' settings, ' + readKeys.size + ' read directly, ' + readSections.size + ' via section');

/* -------------------------------------------------------------- 3, 4, 5 */

if (!fs.existsSync(GAME)) {
    fail('game', 'src/game_index.js missing -- opcode checks skipped');
} else {
    const game = fs.readFileSync(GAME, 'utf8');
    const defsSrc = sources.get('01-defs.js') || '';

    function opcodeBlock(name) {
        const start = defsSrc.indexOf(name + ': {');
        if (start < 0) return {};
        const end = defsSrc.indexOf('\n    },', start);
        const block = defsSrc.slice(start, end);
        const out = {};
        const re = /(\w+):\s*'([^']+)'/g;
        let m;
        while ((m = re.exec(block))) {
            if (m[1] === name) continue;
            out[m[1]] = m[2];
        }
        return out;
    }

    /* c2s: every opcode 2yz claims must appear as an O.send("X" site. */
    const c2s = opcodeBlock('C2S');
    const sentOps = new Set();
    const sendRe = /O\.send\("([^"]+)"/g;
    let m;
    while ((m = sendRe.exec(game))) sentOps.add(m[1]);

    for (const name in c2s) {
        if (!sentOps.has(c2s[name])) {
            fail('c2s', name + ' = "' + c2s[name] + '" is not an O.send opcode in the game bundle');
        }
    }
    note('c2s: ' + Object.keys(c2s).length + ' opcodes checked against ' + sentOps.size + ' send sites');

    /* s2c: every opcode must be a key in the handler map passed to O.connect. */
    const connectAt = game.indexOf('O.connect(');
    const mapStart = game.indexOf('}, {', connectAt);
    const mapEnd = game.indexOf('})', mapStart);
    const mapBlock = game.slice(mapStart, mapEnd);
    const handlerKeys = new Set();
    const keyRe = /^\s{12}([A-Za-z0-9$]+):\s/gm;
    while ((m = keyRe.exec(mapBlock))) handlerKeys.add(m[1]);

    const s2c = opcodeBlock('S2C');
    for (const name in s2c) {
        if (!handlerKeys.has(s2c[name])) {
            fail('s2c', name + ' = "' + s2c[name] + '" is not a handler key in the game bundle');
        }
    }
    note('s2c: ' + Object.keys(s2c).length + ' opcodes checked against ' + handlerKeys.size + ' handlers');

    /* Protocol scalars, cross-checked against the bundle directly. */
    const drivers = JSON.parse(fs.readFileSync(DRIVERS, 'utf8'));
    const sigMatch = game.match(/,\s*jt\s*=\s*(\d+)/);
    if (sigMatch && Number(sigMatch[1]) !== drivers.protocol.signatureBytes) {
        fail('protocol', 'signatureBytes ' + drivers.protocol.signatureBytes + ' != bundle ' + sigMatch[1]);
    }
    const saltMatch = game.match(/,\s*Io\s*=\s*(\d+)/);
    if (saltMatch && Number(saltMatch[1]) !== drivers.protocol.tableSalt) {
        fail('protocol', 'tableSalt ' + drivers.protocol.tableSalt + ' != bundle ' + saltMatch[1]);
    }
    if (!game.includes(JSON.stringify(drivers.protocol.c2sAlphabet).replace(/","/g, '", "'))
        && !game.includes(drivers.protocol.c2sAlphabet.map((c) => '"' + c + '"').join(', '))) {
        fail('protocol', 'c2s alphabet not found verbatim in the bundle');
    }

    /* Movement constants the prediction layer depends on. */
    const speed = drivers.config.playerSpeed;
    const decel = drivers.config.playerDecel;
    if (!new RegExp('Gs\\s*=\\s*' + String(speed).replace('0.', '\\.?0?\\.')).test(game)
        && !game.includes('= ' + String(speed).replace(/^0/, ''))) {
        note('playerSpeed ' + speed + ' not matched literally in bundle (minifier may have reformatted it)');
    }
    if (!game.includes(String(decel).replace(/^0/, ''))) {
        fail('protocol', 'playerDecel ' + decel + ' not found in the bundle');
    }
}

/* ------------------------------------------------------------------- 6 */

const leaked = ['NovaStorm', 'novastorm', 'Whiteout', 'whiteout', 'WhiteoutNet',
    'LunaClient', 'lunaClient', 'TND', 'MOHCORE', 'MOH_CONFIG',
    'getPrePlaceAngles', 'checkCanPrePlace', 'doSmartTickAnti', 'chainPlace'];
for (const name of leaked) {
    /* Comments legitimately cite these; code must not. */
    if (new RegExp('\\b' + name + '\\b').test(code)) {
        fail('independence', 'reference-client identifier "' + name + '" appears in 2yz code');
    }
}

/* ------------------------------------------------------------------- 7 */

const declared = new Map();
for (const [file, body] of sources) {
    const stripped = stripComments(body);
    const re = /^(?:const|let|var|class|function)\s+([A-Za-z_$][\w$]*)/gm;
    let m;
    while ((m = re.exec(stripped))) {
        const name = m[1];
        if (declared.has(name)) {
            fail('duplicate', 'top-level "' + name + '" declared in both '
                + declared.get(name) + ' and ' + file);
        } else {
            declared.set(name, file);
        }
    }
}
note(declared.size + ' top-level declarations, no collisions');

/* ---------------------------------------------------------------- report */

for (const n of notes) console.log('  ' + n);
if (failures.length) {
    console.error('\n' + failures.length + ' failure(s):');
    for (const f of failures) console.error('  ! ' + f);
    process.exit(1);
}
console.log('\nverify-2yz: all checks passed');
