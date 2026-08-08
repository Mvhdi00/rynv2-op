/*
 * src/Ae86_v10.2_webcrack.js -> src/Ae86_v10.2_deobfuscated.js
 *
 * webcrack removes the obfuscator's string array and proxy wrappers but leaves
 * the numeric-expression padding ("0x7f1 + -0xd * 0x238 + 0xa75 * 0x2") and
 * bracketed member access. Folding both is what makes the result greppable,
 * which is what the protocol work depends on.
 */
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const traverse = _traverse.default ?? _traverse;
const generate = _generate.default ?? _generate;

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN = path.join(ROOT, 'src/Ae86_v10.2_webcrack.js');
const OUT = path.join(ROOT, 'src/Ae86_v10.2_deobfuscated.js');

const code = fs.readFileSync(IN, 'utf8');
const ast = parse(code, { sourceType: 'script', errorRecovery: true });

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const ARITH = ['+', '-', '*', '/', '%', '<<', '>>', '>>>', '|', '&', '^'];

traverse(ast, {
  BinaryExpression: {
    exit(path) {
      if (!ARITH.includes(path.node.operator)) return;
      const ev = path.evaluate();
      if (ev.confident && typeof ev.value === 'number' && Number.isFinite(ev.value)) {
        path.replaceWith(t.numericLiteral(ev.value));
        path.skip();
      }
    },
  },
  UnaryExpression: {
    exit(path) {
      const ev = path.evaluate();
      if (!ev.confident) return;
      // !![] -> true, ![] -> false
      if (typeof ev.value === 'boolean') path.replaceWith(t.booleanLiteral(ev.value));
      else if (path.node.operator === 'void') path.replaceWith(t.identifier('undefined'));
    },
  },
  MemberExpression(path) {
    const { node } = path;
    if (node.computed && t.isStringLiteral(node.property) && IDENT.test(node.property.value)) {
      node.property = t.identifier(node.property.value);
      node.computed = false;
    }
  },
  ObjectProperty(path) {
    const { node } = path;
    if (!node.computed && t.isStringLiteral(node.key) && IDENT.test(node.key.value)) {
      node.key = t.identifier(node.key.value);
    }
  },
});

const out = generate(ast, { comments: true, jsescOption: { minimal: true } }).code;
fs.writeFileSync(OUT, out);
console.error(`wrote ${out.length} bytes -> ${path.relative(ROOT, OUT)}`);
