// Drive the packet accounting out of a shipped build.
//
//   node test_packets.js            owner build
//
// The point of the counter is the refusal count: if nothing is ever refused,
// raising packetLimit changes nothing, and the number says so.
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const REPO = path.resolve(__dirname, "..", "..");
const src = fs.readFileSync(path.join(REPO, "RYN_Client_v5_OWNER.user.js"), "utf8");
console.log("(owner build)");

function sliceMethod(signature) {
  const start = src.indexOf("    " + signature + " {");
  if (start < 0) throw new Error("no " + signature);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error("unbalanced " + signature);
}

const code =
  "globalThis.__PM = class {\n" +
  "  packetCount = 0; packetPeak = 0; packetDenied = 0; packetDeniedLast = 0;\n" +
  "  packetLastSecond = 0; packetSpend = new Map; packetSpendLast = new Map;\n" +
  "  constructor(client) { this.client = client; }\n" +
  "  roll() {\n" +
  "    this.packetLastSecond = this.packetCount;\n" +
  "    this.packetPeak = Math.max(this.packetPeak, this.packetCount);\n" +
  "    this.packetDeniedLast = this.packetDenied;\n" +
  "    this.packetSpendLast = this.packetSpend;\n" +
  "    this.packetCount = 0; this.packetDenied = 0; this.packetSpend = new Map;\n" +
  "  }\n" +
  sliceMethod("_spent()") + "\n" +
  sliceMethod("noteDenied()") + "\n" +
  sliceMethod("packetStats()") + "\n" +
  "};";

const sandbox = { Math, Map, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const PM = sandbox.__PM;

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
};

const mk = (limit = 70) => {
  const client = { _ModuleHandler: { activeModule: null, packetLimit: limit } };
  return { pm: new PM(client), client };
};

console.log("\ncounting");
{
  const { pm, client } = mk();
  client._ModuleHandler.activeModule = "autoPlacer";
  for (let i = 0; i < 5; i++) pm._spent();
  client._ModuleHandler.activeModule = "spikeTickNear";
  for (let i = 0; i < 3; i++) pm._spent();
  client._ModuleHandler.activeModule = null;
  pm._spent();
  check("the second's total is every send", pm.packetCount === 9);
  pm.roll();
  const s = pm.packetStats();
  check("used is the completed second", s.used === 9);
  check("spend is attributed to the module that claimed the tick",
        s.spend.get("autoPlacer") === 5 && s.spend.get("spikeTickNear") === 3);
  check("sends outside a module land in other", s.spend.get("other") === 1);
  check("the counter resets for the next second", pm.packetCount === 0);
}

console.log("\npeak");
{
  const { pm } = mk();
  for (let i = 0; i < 12; i++) pm._spent();
  pm.roll();
  for (let i = 0; i < 4; i++) pm._spent();
  pm.roll();
  const s = pm.packetStats();
  check("peak keeps the highest second", s.peak === 12);
  check("used still shows the latest one", s.used === 4);
}

console.log("\nrefusals");
{
  const { pm } = mk();
  pm.roll();
  check("nothing refused reads zero", pm.packetStats().denied === 0);
  pm.noteDenied(); pm.noteDenied();
  pm.roll();
  check("refusals are counted", pm.packetStats().denied === 2);
  pm.roll();
  check("and they do not carry into the next second", pm.packetStats().denied === 0);
}

console.log("\nlimit");
{
  const { pm } = mk(120);
  pm.roll();
  check("the reported limit follows the setting", pm.packetStats().limit === 120);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
