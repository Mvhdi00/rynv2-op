#!/usr/bin/env node
// Item-limit tests for NovaStorm.user.js.
//
//   node tools/test-limits.js
//
// The cap has three regimes and all three have been wrong at some point:
//   - shipped 1.4:  group.sandboxLimit || 99  -> never fires for spikes/traps
//   - first fix:    fell through to group.limit in sandbox -> capped at 15/6
//                   on a server that caps nothing
//   - correct:      group.limit off sandbox; uncapped in sandbox except the
//                   three groups carrying an explicit sandboxLimit
//
// The game's own PlayerObject.canBuild returns true unconditionally in sandbox.

const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "NovaStorm.user.js"), "utf8");

function grab(name) {
  const m = new RegExp("\\n\\s*function\\s+" + name + "\\s*\\(").exec(SRC);
  const start = SRC.indexOf("function", m.index);
  let i = SRC.indexOf("{", start), d = 0;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return SRC.slice(start, j + 1); }
  }
}
const sandboxCacheDecl = /let NS_sandboxCache = null;/.exec(SRC)[0];

// One factory per host, so NS_sandboxCache is fresh each time.
const harness = `
module.exports = function (hostname, inSandboxFlag, isSandboxFlag) {
  const window = { location: { hostname: hostname } };
  const config = { inSandbox: inSandboxFlag };
  const UTILS = { isSandbox: isSandboxFlag };
  const GROUPS = {
    spikes:     { id: 2,  name: "spikes",     limit: 15 },
    trap:       { id: 5,  name: "trap",       limit: 6  },
    turret:     { id: 7,  name: "turret",     limit: 2  },
    mill:       { id: 3,  name: "mill",       limit: 7, sandboxLimit: 299 },
    booster:    { id: 6,  name: "booster",    limit: 12, sandboxLimit: 299 },
    teleporter: { id: 13, name: "teleporter", limit: 2, sandboxLimit: 299 }
  };
  const items = { list: [] };
  items.list[6]  = { group: GROUPS.spikes };
  items.list[15] = { group: GROUPS.trap };
  items.list[17] = { group: GROUPS.turret };
  items.list[10] = { group: GROUPS.mill };
  let myPlayer = { itemCounts: {} };
  ${sandboxCacheDecl}
  ${grab("NS_inSandbox")}
  ${grab("NS_groupLimit")}
  ${grab("isItemLimit")}
  return { NS_inSandbox, NS_groupLimit, isItemLimit, GROUPS,
           setCount: (gid, n) => { myPlayer.itemCounts[gid] = n; } };
};
`;
const tmp = path.join(__dirname, ".ns_limits." + process.pid + ".tmp.js");
fs.writeFileSync(tmp, harness);
process.on("exit", () => { try { fs.unlinkSync(tmp); } catch (e) {} });
const make = require(tmp);

let ok = 0, bad = 0;
const t = (n, c, extra) => { if (c) { ok++; console.log("  ok   " + n); }
  else { bad++; console.log("  FAIL " + n + (extra ? " — " + extra : "")); } };

console.log("\nSandbox detection");
{
  t("sandbox.moomoo.io", make("sandbox.moomoo.io", false, false).NS_inSandbox() === true);
  t("sandbox-dev.moomoo.io", make("sandbox-dev.moomoo.io", false, false).NS_inSandbox() === true);
  t("moomoo.io is not sandbox", make("moomoo.io", false, false).NS_inSandbox() === false);
  t("a regional server is not sandbox",
    make("sfo.moomoo.io", false, false).NS_inSandbox() === false);
  t("a lookalike host is not sandbox",
    make("notsandbox.moomoo.io", false, false).NS_inSandbox() === false, "regex must anchor on a dot or start");
  t("UTILS.isSandbox still honoured", make("moomoo.io", false, true).NS_inSandbox() === true);
  t("config.inSandbox still honoured", make("moomoo.io", true, false).NS_inSandbox() === true);
  t("missing window.location does not throw",
    (() => { try { return make(undefined, false, false).NS_inSandbox() === false; }
             catch (e) { return false; } })());
}

console.log("\nCaps off sandbox — the real server limits");
{
  const G = make("moomoo.io", false, false);
  t("spikes cap 15", G.NS_groupLimit(G.GROUPS.spikes) === 15);
  t("traps cap 6", G.NS_groupLimit(G.GROUPS.trap) === 6);
  t("turrets cap 2", G.NS_groupLimit(G.GROUPS.turret) === 2);
  t("mill cap 7 (not its sandboxLimit)", G.NS_groupLimit(G.GROUPS.mill) === 7);
  G.setCount(2, 14); t("14/15 spikes: still placeable", G.isItemLimit(6) !== true);
  G.setCount(2, 15); t("15/15 spikes: limited", G.isItemLimit(6) === true);
  G.setCount(5, 6);  t("6/6 traps: limited", G.isItemLimit(15) === true);
}

console.log("\nCaps in sandbox — the regression this file exists for");
{
  const G = make("sandbox.moomoo.io", false, false);
  t("spikes uncapped", !G.NS_groupLimit(G.GROUPS.spikes));
  t("traps uncapped", !G.NS_groupLimit(G.GROUPS.trap));
  t("turrets uncapped", !G.NS_groupLimit(G.GROUPS.turret));
  t("mill keeps its explicit sandboxLimit 299", G.NS_groupLimit(G.GROUPS.mill) === 299);
  G.setCount(2, 15);  t("15 spikes placed: NOT limited", G.isItemLimit(6) !== true,
                        "this is the bug that capped sandbox play at 15");
  G.setCount(2, 400); t("400 spikes placed: still not limited", G.isItemLimit(6) !== true);
  G.setCount(5, 200); t("200 traps placed: not limited", G.isItemLimit(15) !== true);
  G.setCount(3, 298); t("298/299 mills: still placeable", G.isItemLimit(10) !== true);
  G.setCount(3, 299); t("299/299 mills: limited", G.isItemLimit(10) === true);
}

console.log(`\n${ok} passed, ${bad} failed\n`);
process.exit(bad ? 1 : 0);
