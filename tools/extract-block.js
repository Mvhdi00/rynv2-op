// Pull named top-level blocks out of the userscript by brace matching, so the
// tests below run the real code rather than a copy of it.
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || '/home/user/rynv2-op/Ryn_Type_2.user.js', 'utf8');
const LINES = SRC.split('\n');

function blockAt(header) {
  const idx = LINES.findIndex(l => l.startsWith(header));
  if (idx < 0) throw new Error('not found: ' + header);
  // brace-match from the first { on that line
  let depth = 0, started = false, out = [];
  for (let i = idx; i < LINES.length; i++) {
    const line = LINES[i];
    out.push(line);
    for (const ch of line) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') depth--;
    }
    if (started && depth === 0) return out.join('\n');
  }
  throw new Error('unterminated: ' + header);
}
function methodOf(classHeader, methodName) {
  const body = blockAt(classHeader).split('\n');
  const idx = body.findIndex(l => new RegExp('^\\s{4}' + methodName + '\\s*\\(').test(l));
  if (idx < 0) throw new Error('method not found: ' + methodName);
  let depth = 0, started = false, out = [];
  for (let i = idx; i < body.length; i++) {
    out.push(body[i]);
    for (const ch of body[i]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') depth--;
    }
    if (started && depth === 0) return out.join('\n');
  }
  throw new Error('unterminated method: ' + methodName);
}
module.exports = { SRC, LINES, blockAt, methodOf };
