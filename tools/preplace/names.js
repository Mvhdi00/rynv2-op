// Resolve the obfuscated build's names for the globals the placer needs, by
// matching them against how RYN uses each one. Run after deob.js.
const fs = require("fs");
const path = require("path");

const s = fs.readFileSync(path.join(__dirname, "player_stage1.js"), "utf8");

function keysOf(name) {
  const re = new RegExp(name.replace(/\$/g, "\\$") + '\\["([a-zA-Z0-9_]+)"\\]', "g");
  return [...new Set([...s.matchAll(re)].map(m => m[1]))];
}

// Every candidate is checked against a property set only that global has.
const probes = {
  Settings_default: { re: /(_0x[0-9a-f]+)\["_autoplacerRadius"\]/, want: ["_autoplacer", "_safeWalk"] },
  PlayerObject: { re: /class (_0x[0-9a-f]+) extends _0x[0-9a-f]+\{\["type"\];\["ownerID"\];\["collisionDivider"\]/, want: [] },
  DataHandler_default: { re: /(_0x[0-9a-f]+)\["isWeapon"\]\(/, want: ["getWeapon", "isMelee"] },
  Items: { re: /const _0x5ca083=(_0x[0-9a-f]+)\[/, want: [] },
  Config_default: { re: /class _0x[0-9a-f]+\{\["speed"\]=(_0x[0-9a-f]+)\["playerSpeed"\]/, want: ["mapScale", "riverWidth", "playerSpeed"] },
  MovementSimulation: { re: /class (_0x[0-9a-f]+)\{\["speed"\]=_0x[0-9a-f]+\["playerSpeed"\]/, want: [] },
  // the client itself, read off the RYN global literal
  client: { re: /\{'_myClient':(_0x[0-9a-f]+),'_settings':_0x[0-9a-f]+/, want: ["SocketManager"] },
};

const out = {};
for (const [logical, { re, want }] of Object.entries(probes)) {
  const m = s.match(re);
  if (!m) throw new Error(`could not locate ${logical}`);
  const name = m[1];
  for (const key of want) {
    if (!keysOf(name).includes(key)) {
      throw new Error(`${logical} resolved to ${name}, but it has no "${key}"`);
    }
  }
  out[logical] = name;
}

if (require.main === module) {
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(22), v);
}
module.exports = out;
