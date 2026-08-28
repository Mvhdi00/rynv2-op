/* Do the client and the shipped game read a packet the same way?
 *
 * A correct transport delivers the right bytes to the right handler and stops
 * there. Most game packets are a flat array of fixed-width records — the player
 * update is 13 fields per player, objects are 8, animals 7 — and the width is
 * not on the wire: each side just knows it. Get it wrong by one and every field
 * after the first comes out of the wrong slot, which decodes without error and
 * renders as nonsense.
 *
 * So compare the strides, and the highest index each handler reaches, against
 * the shipped bundle's own handlers.
 *
 *   node packet-layout.js [client.js]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = process.argv[2] || path.join(ROOT, "revelation/Revelation.user.js");
const game = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const rev = fs.readFileSync(CLIENT, "utf8");

/* handler letter -> [game function, revelation function] */
const PAIRS = {
  // A client may split a handler into a guard plus the body that does the work.
  a: ["Jl", ["playerUpdateTick", "playerUpdate"]],
  G: ["Tl", "updateLeaderboard"],
  H: ["Vl", "loadObject"],
  I: ["Xl", "animalUpdate"],
  V: ["Nn", "itemUpdate"],
  7: ["il", "updateMinimap"],
};

function body(src, name) {
  const pats = [
    new RegExp("\\nfunction " + name + "\\(", ""),
    new RegExp("\\nasync function " + name + "\\(", ""),
  ];
  for (const p of pats) {
    const m = p.exec(src);
    if (!m) continue;
    let i = src.indexOf("{", m.index + m[0].length - 1);
    let depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") { depth--; if (!depth) return src.slice(i, j + 1); }
    }
  }
  return null;
}

/* Every "+= N" that advances a loop over the packet. */
function strides(b) {
  if (!b) return null;
  const out = new Set();
  for (const m of b.matchAll(/\+=\s*(\d+)\b/g)) out.add(Number(m[1]));
  for (const m of b.matchAll(/\+\s*(\d+)\s*\]/g)) out.add("max index " + m[1]);
  return out;
}

const pad = (s, n) => String(s).padEnd(n);
console.log(path.basename(CLIENT) + " vs the shipped game\n");
console.log(pad("packet", 8) + pad("game fn", 10) + pad("game strides", 22) + pad("client fn", 20) + "client strides");
console.log("-".repeat(96));
let bad = 0;
for (const [letter, [g, r]] of Object.entries(PAIRS)) {
  const names = Array.isArray(r) ? r : [r];
  let rb = null, rName = names[0];
  for (const n of names) { const b = body(rev, n); if (b) { rb = b; rName = n; break; } }
  const gb = body(game, g);
  if (!rb) { console.log(pad(letter, 8) + pad(g, 10) + pad("", 22) + pad(rName, 20) + "handler not found under that name"); continue; }
  const gs = strides(gb), rs = strides(rb);
  const num = (s) => s ? [...s].filter((x) => typeof x === "number").sort((a, b) => a - b) : [];
  const gi = (s) => s ? Math.max(-1, ...[...s].filter((x) => typeof x === "string").map((x) => +x.split(" ")[2])) : -1;
  const gN = num(gs), rN = num(rs);
  /* Neither side looping over a flat record array is agreement, not a
   * difference — those packets carry a single record. */
  const agree = gN.join() === rN.join() && gi(gs) === gi(rs);
  const note = gN.length ? (agree ? "" : "   <- differs") : "   (not a record array)";
  if (!agree) bad++;
  console.log(pad(letter, 8) + pad(g, 10) +
    pad(gN.join(",") + " (max idx " + gi(gs) + ")", 22) +
    pad(rName, 20) + rN.join(",") + " (max idx " + gi(rs) + ")" + note);
}
console.log(bad ? "\n" + bad + " packet(s) parsed differently" : "\nall bulk packets parsed identically");
process.exit(bad ? 1 : 0);
