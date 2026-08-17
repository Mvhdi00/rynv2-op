#!/usr/bin/env node
/* Build 2yz.user.js from src/2yz/*.js.
 *
 * Modules are concatenated in filename order -- the numeric prefixes ARE the
 * dependency order -- and wrapped in one IIFE. There is no bundler and no
 * dependency on npm: every module declares top-level consts that the others
 * close over, which is exactly what concatenation inside a single scope gives.
 *
 * The one substitution is __2YZ_DRIVERS__ in 01-defs.js, replaced with the
 * contents of drivers/game-drivers.json. That is why no game constant is typed
 * into the client by hand.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', '2yz');
const DRIVERS = path.join(ROOT, 'drivers', 'game-drivers.json');
const OUT = path.join(ROOT, '2yz.user.js');

const HEADER = `// ==UserScript==
// @name         2yz
// @namespace    2yz
// @version      1.0.0
// @description  Decision-engine client for moomoo.io: one world model, one prediction layer, one target system, one arbiter, one packet scheduler.
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
`;

function main() {
    if (!fs.existsSync(DRIVERS)) {
        console.error('missing ' + path.relative(ROOT, DRIVERS) + ' -- run tools/extract-drivers.js first');
        process.exit(1);
    }
    const drivers = fs.readFileSync(DRIVERS, 'utf8');
    JSON.parse(drivers); // fail loudly on a corrupt drivers file

    const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
    if (!files.length) {
        console.error('no modules in ' + path.relative(ROOT, SRC));
        process.exit(1);
    }

    const parts = [];
    let substituted = 0;

    for (const file of files) {
        let body = fs.readFileSync(path.join(SRC, file), 'utf8');
        if (body.includes('__2YZ_DRIVERS__')) {
            body = body.split('__2YZ_DRIVERS__').join(drivers.trim());
            substituted++;
        }
        parts.push('/* ---- ' + file + ' ---- */\n' + body);
    }

    if (substituted !== 1) {
        console.error('expected exactly one __2YZ_DRIVERS__ placeholder, found ' + substituted);
        process.exit(1);
    }

    const out = HEADER
        + '\n(function () {\n"use strict";\n\n'
        + parts.join('\n\n')
        + '\n\nRuntime.start();\n\n})();\n';

    fs.writeFileSync(OUT, out);

    const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
    console.log('built ' + path.relative(ROOT, OUT) + '  ' + files.length + ' modules, ' + kb + ' KB');
    for (const file of files) console.log('  ' + file);
}

main();
