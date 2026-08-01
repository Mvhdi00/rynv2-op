#!/usr/bin/env node
/**
 * Assembles MooUnpatcher.user.js from three pieces:
 *   - the metadata block + preamble already in the file
 *   - the EXP transport core, lifted from ExternalClient.user.js so the two
 *     can never drift apart
 *   - tools/unpatcher-glue.js, the universal adaptation layer
 *
 * Usage: node tools/build-unpatcher.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function lines(f) { return fs.readFileSync(f, 'utf8').split('\n').map(l => l.replace(/\r$/, '')); }

const ext = lines(path.join(ROOT, 'ExternalClient.user.js'));
const a = ext.indexOf('const EXP = (function() {');
const b = ext.indexOf(')();', a);
if (a < 0 || b < 0) { console.error('could not find the EXP core in ExternalClient.user.js'); process.exit(1); }
const core = ext.slice(a, b + 1).join('\n') + '\n';

const out = path.join(ROOT, 'MooUnpatcher.user.js');
const existing = fs.readFileSync(out, 'utf8');
const header = existing.slice(0, existing.indexOf('const EXP = (function() {'));
const glue = fs.readFileSync(path.join(ROOT, 'tools', 'unpatcher-glue.js'), 'utf8');

fs.writeFileSync(out, header + core + glue);
console.log('wrote', path.relative(ROOT, out));
