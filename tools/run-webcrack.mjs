/*
 * src/Ae86_v10.2_original.js -> src/Ae86_v10.2_webcrack.js
 *
 * Ae86 v10.2 ships under javascript-obfuscator: an RC4 string array behind a
 * rotator IIFE, per-scope proxy wrappers, and numeric expressions folded into
 * arithmetic. webcrack undoes all of that; tools/polish-ae86.mjs then folds the
 * leftover constant arithmetic and normalises member access.
 */
import { webcrack } from 'webcrack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN = path.join(ROOT, 'src/Ae86_v10.2_original.js');
const OUT = path.join(ROOT, 'src/Ae86_v10.2_webcrack.js');

const src = fs.readFileSync(IN, 'utf8');
console.error(`input  ${src.length} bytes`);

const t0 = Date.now();
const result = await webcrack(src, {
  jsx: false,
  unpack: true,
  deobfuscate: true,
  unminify: false,
  mangle: false,
});
console.error(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

fs.writeFileSync(OUT, result.code);
console.error(`output ${result.code.length} bytes -> ${path.relative(ROOT, OUT)}`);
