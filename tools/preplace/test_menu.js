// Check that the PLAYER's runtime menu transforms actually match the real page
// markup, and that the OWNER's edited markup carries the same rows.
const path = require("path");
const fs = require("fs");
const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");
const vm = require("vm");

const player = fs.readFileSync(RYN_PLAYER, "utf8");
const owner = fs.readFileSync(RYN_OWNER, "utf8");
const folded = fs.readFileSync(path.join(__dirname, "player_stage1.js"), "utf8");

// Pull the two helpers out of the patched player and run them.
const hs = player.indexOf("  const RYN_PP_COMBAT = html => {");
const he = player.indexOf("  };", player.indexOf("  const RYN_PP_KEYS")) + 4;
const helpers = player.slice(hs, he);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  helpers +
    "\nglobalThis.C = RYN_PP_COMBAT; globalThis.K = RYN_PP_KEYS; globalThis.V = RYN_PP_VISUALS;",
  sandbox
);

// Recover the real page strings from the folded copy.
function pageFrom(varName) {
  const i = folded.indexOf(varName + '="<div class=');
  const startQuote = folded.indexOf('"', i + varName.length);
  // walk the JS string literal
  let j = startQuote + 1;
  while (j < folded.length) {
    if (folded[j] === "\\") { j += 2; continue; }
    if (folded[j] === '"') break;
    j++;
  }
  return JSON.parse(folded.slice(startQuote, j + 1));
}

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
};

const combat = pageFrom("_0x222a58");
const keys = pageFrom("_0x4f695d");
check("recovered the Combat page", combat.includes('id="_autoplacer"'));
check("recovered the Keybinds page", keys.includes('id="_autoplacerKey"'));

const combatOut = sandbox.C(combat);
check("PLAYER combat transform fires", combatOut.length > combat.length);
for (const id of ["_prePlace", "_prePlaceRadius", "_prePlaceHits", "_replace", "_replaceRadius"]) {
  check(`PLAYER combat has ${id}`, combatOut.includes(`id="${id}"`));
}
check(
  "PLAYER rows land inside the Spikes & Traps section",
  combatOut.indexOf('id="_prePlace"') > combatOut.indexOf('id="_autoplacerRadius"') &&
    combatOut.indexOf('id="_prePlace"') < combatOut.indexOf('id="_spikeSync"')
);

const keysOut = sandbox.K(keys);
check("PLAYER keybind transform fires", keysOut.length > keys.length);
check("PLAYER keybinds has _prePlaceKey", keysOut.includes('id="_prePlaceKey"'));
check("PLAYER keybinds has _replaceKey", keysOut.includes('id="_replaceKey"'));

// OWNER: the same ids must be present in the source markup already.
for (const id of ["_prePlace", "_prePlaceRadius", "_prePlaceHits", "_replace", "_replaceRadius", "_prePlaceKey", "_replaceKey"]) {
  check(`OWNER markup has ${id}`, owner.includes(`id=\\"${id}\\"`));
}
// and every one of them must be a known setting, or attachCheckboxes logs an error
for (const id of ["_prePlace", "_prePlaceRadius", "_prePlaceHits", "_replace", "_replaceRadius", "_prePlaceKey", "_replaceKey"]) {
  check(`OWNER settings define ${id}`, new RegExp(`\\n\\s*${id}:`).test(owner));
  check(`PLAYER settings define ${id}`, player.includes(`_0xc709e6["${id}"]=`));
}

// The injected chunks themselves must be tag-balanced, and each page must come
// out with exactly as many extra <div>s as it gained rows.
const balanced = (before, after, expected) => {
  const d = html => (html.match(/<div/g) || []).length - (html.match(/<\/div>/g) || []).length;
  const added = (after.match(/<div/g) || []).length - (before.match(/<div/g) || []).length;
  return d(before) === d(after) && added === expected;
};
check("combat page stays balanced and gains 5 rows", balanced(combat, combatOut, 5));
check("keybinds page stays balanced and gains 2 tiles", balanced(keys, keysOut, 2));
check("transforms are a no-op without their anchor", sandbox.C("X") === "X" && sandbox.K("X") === "X");

// Weather rows live on the Visuals page.
const visuals = pageFrom("_0x5bc8e9");
check("recovered the Visuals page", visuals.includes('id="_objectTintOpacity"'));
const visualsOut = sandbox.V(visuals);
check("PLAYER visuals transform fires", visualsOut.length > visuals.length);
for (const id of ["_weather", "_weatherAmount"]) {
  check(`PLAYER visuals has ${id}`, visualsOut.includes(`id="${id}"`));
  check(`OWNER markup has ${id}`, owner.includes(`id=\\"${id}\\"`));
  check(`OWNER settings define ${id}`, new RegExp(`\\n\\s*${id}:`).test(owner));
  check(`PLAYER settings define ${id}`, player.includes(`_0xc709e6["${id}"]=`));
}
check("weather rows land after the tint slider",
      visualsOut.indexOf('id="_weather"') > visualsOut.indexOf('id="_objectTintOpacity"'));
check("visuals page stays balanced and gains a 5-div section", balanced(visuals, visualsOut, 5));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
