'use strict';
// Pull the real source of the pieces under test out of the userscript, so the
// harness exercises the shipped code rather than a restatement of it.
const fs = require('fs');

function sliceBalanced(src, startIdx) {
  // startIdx points at the first `{` of a block; return through its match.
  let depth = 0, i = startIdx, inStr = null, inCmt = null;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inCmt === 'line') { if (c === '\n') inCmt = null; continue; }
    if (inCmt === 'block') { if (c === '*' && n === '/') { inCmt = null; i++; } continue; }
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inCmt = 'line'; i++; continue; }
    if (c === '/' && n === '*') { inCmt = 'block'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error('unbalanced from ' + startIdx);
}

// Extract a class method by its signature, returned as an object-literal-safe
// `name(args) { ... }` string.
function method(src, className, methodName) {
  const cls = src.indexOf('class ' + className + ' ');
  if (cls < 0) throw new Error('no class ' + className);
  const body = sliceBalanced(src, src.indexOf('{', cls));
  const re = new RegExp('^(\\s*)' + methodName + '\\s*\\(', 'm');
  const m = re.exec(body);
  if (!m) throw new Error('no method ' + className + '.' + methodName);
  const sigStart = m.index + m[1].length;
  const braceIdx = body.indexOf('{', body.indexOf('(', sigStart));
  const block = sliceBalanced(body, braceIdx);
  return body.slice(sigStart, braceIdx) + block;
}

// Extract `const NAME = ...;` up to and including the terminating semicolon at
// depth zero.
function constant(src, name) {
  const re = new RegExp('^\\s*const ' + name + ' = ', 'm');
  const m = re.exec(src);
  if (!m) throw new Error('no const ' + name);
  let i = m.index + m[0].length, depth = 0, inStr = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
    else if (c === ';' && depth === 0) break;
  }
  return src.slice(m.index, i + 1).trim();
}

// Extract `name=value;` class fields, returned as `name: value` pairs.
function fields(src, className, names) {
  const cls = src.indexOf('class ' + className + ' ');
  if (cls < 0) throw new Error('no class ' + className);
  const body = sliceBalanced(src, src.indexOf('{', cls));
  return names.map(n => {
    const m = new RegExp('^\\s*' + n + '=(.*?);\\s*$', 'm').exec(body);
    if (!m) throw new Error('no field ' + className + '.' + n);
    return n + ': ' + m[1].trim();
  }).join(',\n');
}

module.exports = { sliceBalanced, method, constant, fields, read: p => fs.readFileSync(p, 'utf8') };
