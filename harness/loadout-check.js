/* What do the hats and accessories a client equips actually do?
 *
 * The game's own descriptions understate. "Super speed but reduced damage" is
 * Monkey Tail, and the number behind it is dmgMultO: 0.2 — the game multiplies
 * your outgoing damage by it, so wearing it deals a fifth of the damage. Nothing
 * on screen says a fifth. Picking it because the description sounded fine is how
 * a client ends up barely able to kill anything with no error anywhere.
 *
 * So read the ids the client actually equips out of its own hatFc, and print
 * what the shipped game says each one does.
 *
 *   node loadout-check.js [client.js]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = process.argv[2] || path.join(ROOT, "xprecision/X_Precision_2.0.user.js");
const game = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const src = fs.readFileSync(CLIENT, "utf8");

/* Every entry in the game's hat and accessory tables, by id.
 *
 * They are two separate arrays and the same id means different things in each —
 * 12 is a hat and also an accessory. Slicing by a name landmark got this wrong
 * and reported hat 6 as "Winter Cape", so cut on the array declarations
 * themselves: `const ma = [{` is the hats, `pa = [{` the accessories. */
const HATS_AT = game.indexOf("const ma = [{");
const ACCS_AT = game.indexOf("pa = [{", HATS_AT);
if (HATS_AT === -1 || ACCS_AT === -1) throw new Error("could not find the game's hat/accessory tables");

function table(from, to) {
  const chunk = game.slice(from, to);
  const out = new Map();
  for (const m of chunk.matchAll(/id:\s*(\d+),\s*\n\s*name:\s*"([^"]+)",([\s\S]{0,340}?)(?=\n\s*\}\s*,\s*\{|\n\s*\}\s*\])/g)) {
    const body = m[3];
    const get = (k) => {
      const v = new RegExp("\\b" + k + ":\\s*(-?[\\d.e]+)").exec(body);
      return v ? Number(v[1]) : null;
    };
    out.set(Number(m[1]), {
      name: m[2],
      desc: (/desc:\s*"([^"]*)"/.exec(body) || [, ""])[1],
      dmgMultO: get("dmgMultO"), dmgMult: get("dmgMult"),
      spdMult: get("spdMult"), healthRegen: get("healthRegen"),
      dmgReduce: get("dmgReduce"),
    });
  }
  return out;
}
const hats = table(HATS_AT, ACCS_AT);
const accs = table(ACCS_AT, game.indexOf("\n}]", ACCS_AT) + 3);

/* The ids this client's hatFc actually puts on. */
function body(name) {
  const m = new RegExp("\\n\\s*function\\s+" + name + "\\s*\\(").exec(src);
  if (!m) return "";
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(open, i + 1); }
  }
  return "";
}
const fc = body("hatFc");
const hatIds = [...new Set([...fc.matchAll(/currentHat\s*=\s*(\d+)/g)].map((m) => Number(m[1])))];
const accIds = [...new Set([...fc.matchAll(/currentAcc\s*=\s*(\d+)/g)].map((m) => Number(m[1])))];

const pad = (s, n) => String(s).padEnd(n);
function show(label, ids, tbl) {
  console.log("\n" + label);
  console.log("  " + pad("id", 5) + pad("name", 20) + pad("dmg to others", 22) +
    pad("speed", 8) + pad("regen", 8) + "the game's words");
  console.log("  " + "-".repeat(96));
  let warn = 0;
  for (const id of ids.sort((a, b) => a - b)) {
    const e = tbl.get(id);
    // 0 is the client's own "wear nothing", not a table entry.
    if (!e) { console.log("  " + pad(id, 5) + (id === 0 ? "(none - bare)" : "not in the game's table")); continue; }
    const dmg = e.dmgMultO != null ? e.dmgMultO + "x" + (e.dmgMultO < 1 ? "  <- PENALTY" : "") : "-";
    if (e.dmgMultO != null && e.dmgMultO < 1) warn++;
    console.log("  " + pad(id, 5) + pad(e.name, 20) + pad(dmg, 22) +
      pad(e.spdMult != null ? e.spdMult + "x" : "-", 8) +
      pad(e.healthRegen != null ? e.healthRegen : "-", 8) + e.desc);
  }
  return warn;
}

console.log(path.basename(CLIENT) + " — what its loadout actually does");
const w1 = show("hats it equips", hatIds, hats);
const w2 = show("accessories it equips", accIds, accs);
console.log("\n  " + (w1 + w2
  ? (w1 + w2) + " of them cut your outgoing damage — check that is intended"
  : "nothing it equips reduces your damage"));
process.exit(0);
