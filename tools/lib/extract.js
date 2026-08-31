/*
 * Pulls a top-level class (plus any constants declared just above it) out of a
 * built client, by matching braces rather than by naming whatever class
 * happens to follow it. The neighbouring class differs between v4 and v5.4, so
 * a name-based end marker only works on one of them.
 */
function classEnd(source, start) {
  const open = source.indexOf("{", start);
  if (open === -1) return -1;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    } else if (c === '"' || c === "'" || c === "`") {
      // Skip string bodies so a brace inside one cannot unbalance the count.
      const quote = c;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") i += 2;
        else if (source[i] === quote) break;
        else i++;
      }
    } else if (c === "/" && source[i + 1] === "/") {
      i = source.indexOf("\n", i);
      if (i === -1) return -1;
    } else if (c === "/" && source[i + 1] === "*") {
      i = source.indexOf("*/", i);
      if (i === -1) return -1;
      i++;
    }
  }
  return -1;
}

/* `from` is the first line to keep (usually a constant above the class);
 * `className` names the class the slice must run to the end of. */
function extractModule(source, from, className) {
  const start = source.indexOf(from);
  if (start === -1) return null;
  const cls = source.indexOf("class " + className, start);
  if (cls === -1) return null;
  const end = classEnd(source, cls);
  if (end === -1) return null;
  return source.slice(start, end);
}

module.exports = { extractModule, classEnd };
