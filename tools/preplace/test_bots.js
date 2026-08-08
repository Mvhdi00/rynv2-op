// Drive the !trust command out of a shipped build.
//
//   node test_bots.js            owner build
//
// !trust is the one bot feature that stayed. The registry it writes to is read
// by ClientPlayer.isTeammateByID, and every targeting decision in the client
// runs through isEnemyByID, which is that function negated — so a trusted id
// never reaches an enemy list and no module has to remember to check for it.
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const REPO = path.resolve(__dirname, "..", "..");
const src = fs.readFileSync(path.join(REPO, "RYN_Client_v5_OWNER.user.js"), "utf8");
console.log("(owner build)");

const START = "  const botTrustedIDs =";
const END = "  function botSayOnce(ownerClient, text) {";
const a = src.indexOf(START);
const b = src.indexOf(END, a);
if (a < 0 || b < a) throw new Error("could not slice the trust code out");
// botSayOnce goes in too, brace-matched off its own opening.
let depth = 0, end = -1;
for (let i = src.indexOf("{", b); i < src.length; i++) {
  const c = src[i];
  if (c === "{") depth++;
  else if (c === "}" && --depth === 0) { end = i + 1; break; }
}
if (end < 0) throw new Error("unbalanced botSayOnce");
const code = src.slice(a, end);

const sandbox = { Math, Number, Set, String, RegExp, console, window: {} };
vm.createContext(sandbox);
vm.runInContext(
  code + "\nglobalThis.__T = { trust: botHandleTrustCommand, ids: botTrustedIDs };",
  sandbox
);
const T = sandbox.__T;

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
};

// Whatever the owner says goes out as chat unless the command claims it, so
// the return value doubles as "was this swallowed".
const said = [];
const owner = {
  myPlayer: { id: 1 },
  PacketManager: { chat: text => said.push(text) },
};

console.log("\nwho may use it");
T.ids.clear();
check("a stranger cannot call off the bots", T.trust(owner, 99, "!trust 7") === false);
check("and nothing was trusted by trying", T.ids.size === 0);
check("the owner can", T.trust(owner, 1, "!trust 7") === true && T.ids.has(7));

console.log("\nthe command itself");
check("!untrust takes it back", T.trust(owner, 1, "!untrust 7") === true && !T.ids.has(7));
check("case does not matter", T.trust(owner, 1, "!TRUST 8") === true && T.ids.has(8));
check("spacing does not matter", T.trust(owner, 1, "  !trust   9  ") === true && T.ids.has(9));
check("a bare !trust lists rather than adds",
      T.trust(owner, 1, "!trust") === true && T.ids.size === 2);
check("trusting twice is harmless", T.trust(owner, 1, "!trust 8") === true && T.ids.size === 2);
check("untrusting someone who was never trusted is harmless",
      T.trust(owner, 1, "!untrust 404") === true && T.ids.size === 2);

console.log("\nwhat it leaves alone");
check("ordinary chat passes through", T.trust(owner, 1, "hello") === false);
check("a word that merely starts the same passes through",
      T.trust(owner, 1, "!trusted 7") === false);
check("no leading bang, no command", T.trust(owner, 1, "trust 7") === false);
check("a non-numeric id is not a command", T.trust(owner, 1, "!trust bob") === false);
check("the id has to be the whole rest of the line",
      T.trust(owner, 1, "!trust 7 and also 8") === false);

console.log("\nit answers");
said.length = 0;
T.trust(owner, 1, "!trust 12");
check("adding says so", said.length === 1 && said[0] === "trusted 12");
said.length = 0;
T.trust(owner, 1, "!untrust 12");
check("removing says so", said.length === 1 && said[0] === "untrusted 12");
said.length = 0;
T.ids.clear();
T.trust(owner, 1, "!trust");
check("an empty list says so too", said.length === 1 && said[0] === "trusted: nobody");

console.log("\nno owner, no command");
check("a client with no player does nothing",
      T.trust({ myPlayer: null }, 1, "!trust 7") === false);
check("no client at all does nothing", T.trust(null, 1, "!trust 7") === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
