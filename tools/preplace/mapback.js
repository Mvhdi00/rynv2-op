// Translate an offset in the folded text back into the untouched build.
//
// The anchor list starts with [0,0], then adds two per folded call:
// [start-of-call, start-of-replacement] at an odd index and
// [end-of-call, end-of-replacement] at an even one. So a gap — text the fold
// left byte-for-byte identical, and the only region an offset maps across —
// runs from an even anchor to the next odd one.
const fs = require("fs");

function loadMap(mapPath) {
  const anchors = JSON.parse(fs.readFileSync(mapPath, "utf8"));

  function findAnchor(newOffset) {
    let lo = 0, hi = anchors.length - 1, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (anchors[mid][1] <= newOffset) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return best;
  }

  // Maps newOffset back, and returns the surrounding gap so callers can prove
  // the two files really are identical there.
  function locate(newOffset) {
    const idx = findAnchor(newOffset);
    const [o, n] = anchors[idx];
    const next = anchors[idx + 1];
    const inGap = idx % 2 === 0;
    return {
      origOffset: o + (newOffset - n),
      inGap,
      gapFoldedStart: n,
      gapFoldedEnd: next ? next[1] : Infinity,
      gapOrigStart: o,
      gapOrigEnd: next ? next[0] : Infinity,
    };
  }

  return Object.assign(newOffset => locate(newOffset).origOffset, { locate });
}

module.exports = { loadMap };

if (require.main === module) {
  const orig = fs.readFileSync(process.argv[2], "utf8");
  const folded = fs.readFileSync(process.argv[3], "utf8");
  const mapBack = loadMap(process.argv[3] + ".map.json");
  for (const lm of process.argv.slice(4)) {
    const n = folded.indexOf(lm);
    if (n < 0) { console.log(`MISSING in folded: ${lm}`); continue; }
    const o = mapBack(n);
    const ok = orig.startsWith(lm, o);
    console.log(`${ok ? "ok  " : "BAD "} ${JSON.stringify(lm)} folded@${n} -> orig@${o}`);
  }
}
