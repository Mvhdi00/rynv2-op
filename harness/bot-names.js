/* Bot names: one name typed once, optionally numbered.
 *
 * Bots used to need a name typed per row — or a dice roll, or "Ryn". The Bots
 * page now has a single "Name bots" field and a "Number them" switch, and each
 * new row is prefilled from them.
 *
 * The prefill deliberately writes into the row's OWN input, because that field
 * is what the connect button already reads:
 *
 *     const nameInput = this.querySelector("#" + nameInputId);
 *     const botName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : "";
 *     ...
 *     player._botCustomName = botName;
 *
 * so one shared name flows down the existing path instead of a second one
 * running beside it, and every row stays editable.
 *
 * This drives the real row builder against a small DOM stub and reads back the
 * name each bot would connect with. _numberedBotName is lifted from the client.
 *
 *   node bot-names.js [ryn.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/RYN_Client_v5.4.user.js");
const src = fs.readFileSync(RYN, "utf8");

/* The naming rule, lifted rather than restated. */
function liftMethod(name) {
  const m = new RegExp("\\n    " + name + "\\(").exec(src);
  if (!m) throw new Error("could not find " + name);
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index + 1, i + 1); }
  }
  throw new Error("unbalanced " + name);
}
const sandbox = { Math, String };
vm.createContext(sandbox);
vm.runInContext("const holder = { " + liftMethod("_numberedBotName") + " };\nthis.numbered = (b, n) => holder._numberedBotName(b, n);", sandbox);
const { numbered } = sandbox;

/* The prefill block, as the row builder runs it. Lifted by locating the exact
 * lines in the client so this cannot drift from them silently. */
const PREFILL = (() => {
  const start = src.indexOf("const sharedName = (Settings_default._botNameAll");
  if (start < 0) throw new Error("prefill block not found — the row builder changed");
  const end = src.indexOf("if (sharedName) inp.placeholder = sharedName;", start);
  if (end < 0) throw new Error("prefill block not found — the row builder changed");
  return src.slice(start, end);
})();

function namesFor(settings, count) {
  const box = {
    Settings_default: settings,
    inp: { value: "", placeholder: "" },
    this_: { _numberedBotName: (b, n) => numbered(b, n), _generateRandomBotName: () => "RND" },
    out: [],
  };
  vm.createContext(box);
  for (let botCount = 1; botCount <= count; botCount++) {
    box.inp.value = "";
    // Wrapped in a block so each run gets its own scope — `let botCount` at
    // context top level would collide on the second bot.
    vm.runInContext(
      "{\n" +
      "  const botCount = " + botCount + ";\n" +
      "  const inp = this.inp; const Settings_default = this.Settings_default;\n" +
      "  const self = this.this_;\n" +
      PREFILL.replace(/this\._/g, "self._") +
      "\n  this.out.push(inp.value);\n}", box);
  }
  return box.out;
}

const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — what each bot connects as\n");
console.log("  the prefill block and _numberedBotName are lifted from the client\n");

const CASES = [
  ["name typed, numbering off", { _botNameAll: "Ryn", _botNumberNames: false, _autoRandomBotNames: false }],
  ["name typed, numbering on", { _botNameAll: "Ryn", _botNumberNames: true, _autoRandomBotNames: false }],
  ["name with spaces, numbered", { _botNameAll: "  King  ", _botNumberNames: true, _autoRandomBotNames: false }],
  ["no name, random names on", { _botNameAll: "", _botNumberNames: false, _autoRandomBotNames: true }],
  ["no name, nothing on", { _botNameAll: "", _botNumberNames: false, _autoRandomBotNames: false }],
  ["name set, random also on", { _botNameAll: "Ryn", _botNumberNames: false, _autoRandomBotNames: true }],
];
let bad = 0;
for (const [label, settings] of CASES) {
  const got = namesFor(settings, 4);
  console.log("  " + pad(label, 32) + got.map(v => v === "" ? "(blank)" : v).join(", "));
}

console.log("\n  numbering never loses the tail — moomoo caps a name at 15 characters, so");
console.log("  the base is trimmed to leave room for the digits:");
console.log("  " + pad("base", 20) + pad("bot", 7) + pad("name", 18) + "length");
console.log("  " + "-".repeat(56));
for (const [base, n] of [["Ryn", 1], ["Ryn", 42], ["Ryn", 100],
                         ["ExactlyFifteenX", 7], ["ExactlyFifteenX", 100]]) {
  const name = numbered(base, n);
  const over = name.length > 15;
  if (over) bad++;
  console.log("  " + pad(base, 20) + pad(n, 7) + pad(name, 18) + name.length + (over ? "  <- over 15" : ""));
  if (!name.endsWith(String(n))) { bad++; console.log("      <- does not end in the number"); }
}

/* The rules that matter, asserted rather than eyeballed. */
const checks = [
  ["a typed name reaches every bot",
   namesFor({ _botNameAll: "Ryn", _botNumberNames: false, _autoRandomBotNames: false }, 3)
     .every(v => v === "Ryn")],
  ["numbering gives 1, 2, 3",
   namesFor({ _botNameAll: "Ryn", _botNumberNames: true, _autoRandomBotNames: false }, 3)
     .join(",") === "Ryn1,Ryn2,Ryn3"],
  ["a typed name beats the random-name switch",
   namesFor({ _botNameAll: "Ryn", _botNumberNames: false, _autoRandomBotNames: true }, 2)
     .every(v => v === "Ryn")],
  ["with no name, the random switch still works",
   namesFor({ _botNameAll: "", _botNumberNames: false, _autoRandomBotNames: true }, 2)
     .every(v => v === "RND")],
  ["with nothing set, the row is left blank to type into",
   namesFor({ _botNameAll: "", _botNumberNames: false, _autoRandomBotNames: false }, 2)
     .every(v => v === "")],
  ["surrounding spaces are trimmed",
   namesFor({ _botNameAll: "  King  ", _botNumberNames: true, _autoRandomBotNames: false }, 1)[0] === "King1"],
];
console.log("");
for (const [label, ok] of checks) {
  if (!ok) bad++;
  console.log("  " + (ok ? "ok  " : "FAIL") + "  " + label);
}

console.log("\n  " + (bad === 0
  ? "one name reaches every bot, numbering counts, and nothing else changed"
  : bad + " problem(s) above"));
process.exit(bad === 0 ? 0 : 1);
