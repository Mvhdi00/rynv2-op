/*
 * Differential test: src/ae86-protocol.js vs. the transport primitives lifted
 * straight out of src/game_index.js.
 *
 * The game's Vt/Ao/Eo/Ro/Co/Oi/Po live in one contiguous run of the bundle, so
 * we slice that run, eval it, and compare it against the shim over random
 * input. Any drift in SHA-256, HMAC truncation, the seeded shuffle or the
 * table salt shows up as a mismatch here.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const gameSrc = fs.readFileSync(path.join(ROOT, 'src/game_index.js'), 'utf8').split('\n');

// Lines are 1-indexed in the bundle; this range covers Io/jt/Ht, both
// alphabets, Co, Oi, Po, the SHA-256 constant table, Vt, j, Ao, Eo and Ro.
const FIRST = 278;
const LAST = 405;

function sliceGame() {
  const lines = gameSrc.slice(FIRST - 1, LAST);
  // Line 278 is "  , Io = 1" — a continuation of an earlier const list.
  lines[0] = 'const ' + lines[0].trimStart().slice(2);
  return lines.join('\n');
}

const sandbox = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt, console };
vm.createContext(sandbox);
vm.runInContext(
  sliceGame() + '\n;this.__game = { Vt, Ao, Eo, Ro, Co, Oi, Po, bo, To, jt, Ht, Io };',
  sandbox
);
const game = sandbox.__game;

const shimCtx = { console };
vm.createContext(shimCtx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ae86-protocol.js'), 'utf8'), shimCtx);
const shim = shimCtx.Ae86Proto;

let failures = 0;
function check(name, ok, detail) {
  if (ok) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');

console.log('constants');
check('signature width (jt)', shim.SIG_LEN === game.jt, `${shim.SIG_LEN} vs ${game.jt}`);
check('permuted mode (Ht)', shim.MODE_PERMUTED === game.Ht, `${shim.MODE_PERMUTED} vs ${game.Ht}`);
check('c2s alphabet count', Object.keys(shim.C2S_MAP).length === game.bo.length,
  `${Object.keys(shim.C2S_MAP).length} vs ${game.bo.length}`);
check('s2c alphabet count', Object.keys(shim.S2C_MAP).length === game.To.length,
  `${Object.keys(shim.S2C_MAP).length} vs ${game.To.length}`);
check('c2s map targets == game alphabet',
  new Set(Object.values(shim.C2S_MAP)).size === game.bo.length &&
  Object.values(shim.C2S_MAP).every((n) => game.bo.includes(n)));
check('s2c map sources == game alphabet',
  new Set(Object.keys(shim.S2C_MAP)).size === game.To.length &&
  Object.keys(shim.S2C_MAP).every((n) => game.To.includes(String(n))));

console.log('sha-256');
for (const len of [0, 1, 55, 56, 63, 64, 65, 119, 120, 200, 1000]) {
  const data = new Uint8Array(len);
  for (let i = 0; i < len; i++) data[i] = (i * 31 + 7) & 255;
  check(`sha256 len=${len}`, sameBytes(shim.sha256(data), game.Vt(data)));
}
// Known-answer test: SHA-256("abc")
check('sha256 KAT "abc"',
  hex(shim.sha256(new Uint8Array([97, 98, 99]))) ===
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

console.log('hmac + truncated signature');
for (const keyLen of [1, 6, 16, 32, 64, 65, 100]) {
  for (const dataLen of [0, 10, 64, 300]) {
    const key = new Uint8Array(keyLen);
    for (let i = 0; i < keyLen; i++) key[i] = (i * 17 + 3) & 255;
    const data = new Uint8Array(dataLen);
    for (let i = 0; i < dataLen; i++) data[i] = (i * 13 + 5) & 255;
    check(`hmac key=${keyLen} data=${dataLen}`, sameBytes(shim.hmacSha256(key, data), game.Ao(key, data)));
    check(`sign key=${keyLen} data=${dataLen}`, sameBytes(shim.sign(key, data), game.Eo(key, data)));
  }
}

console.log('hex decode');
check('hexToBytes', sameBytes(shim.hexToBytes('00ff10a9de'), game.Ro('00ff10a9de')));

console.log('opcode tables');
for (const seed of [0, 1, 2, 12345, 0xdeadbeef, 0xffffffff, 987654321, 42]) {
  const mine = shim.makeTables(seed >>> 0);
  const theirs = game.Po(seed >>> 0);
  check(`tables seed=${seed} c2s.enc`, JSON.stringify(mine.c2s.enc) === JSON.stringify(theirs.c2s.enc));
  check(`tables seed=${seed} c2s.dec`, JSON.stringify(mine.c2s.dec) === JSON.stringify(theirs.c2s.dec));
  check(`tables seed=${seed} s2c.enc`, JSON.stringify(mine.s2c.enc) === JSON.stringify(theirs.s2c.enc));
  check(`tables seed=${seed} s2c.dec`, JSON.stringify(mine.s2c.dec) === JSON.stringify(theirs.s2c.dec));
}

console.log('');
if (failures) {
  console.log(`${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('All protocol checks passed.');
