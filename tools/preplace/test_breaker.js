// Drive Autobreak's weapon choice out of a shipped build, with the real
// numbers from the game files:
//
//   pit trap          500 hp
//   hammer            dmg 10, sDmg 7.5, range 75   -> 88 per swing, 292 on tank
//   katana (primary)  dmg 40, no sDmg,  range 118  -> 47 per swing, 156 on tank
//   Tank Gear (40)    bDmg 3.3
//
// The point of interest: the tank bonus is only real when the hat is on, and
// _antienemy rewrites forceHat to soldier after every module has run.
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");

// Autobreak is not part of the block lifted into the player, so the player
// copy is obfuscated and cannot be sliced by name. There the fix is verified
// by checking the spliced guard is present instead.
const usePlayer = process.argv.includes("--player");
if (usePlayer) {
  const player = fs.readFileSync(RYN_PLAYER, "utf8");
  console.log("(player build — checking the spliced guard)");
  let ok = 0, bad = 0;
  // Only the inserted text is verbatim in the patched file — the call it
  // guards still reaches canBuy through a string-array wrapper.
  for (const [what, guard] of [
    ["getDestroyingWeapon", '_0x14c863["hatID"]===0x28&&'],
    ["hammerDmg", '_0x3b7afb["hatID"]===0x28&&'],
  ]) {
    if (player.includes(guard)) { ok++; console.log("  ok   " + what + " counts tank only when worn"); }
    else { bad++; console.log("  FAIL " + what + " guard missing"); }
  }
  console.log(`\n${ok} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}
const src = fs.readFileSync(RYN_OWNER, "utf8");
console.log("(owner build)");

// Slice the two methods and rebuild them as a plain object. Match on the full
// signature: getWeaponRange also exists on Entity with a different one.
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
  throw new Error("unbalanced " + name);
}
const code = "globalThis.__B = {\n" + sliceMethod("getWeaponRange(id, target)") + ",\n" + sliceMethod("getDestroyingWeapon(target)") + "\n};";

const HAMMER = { id: 10, dmg: 10, sDmg: 7.5, range: 75, speed: 400, damage: 10 };
const KATANA = { id: 4, dmg: 40, range: 118, speed: 300, damage: 40 };
const WEAPONS = { 4: KATANA, 10: HAMMER };
const VARIANT = 1.18, TANK = 3.3;

const DataHandler_default = {
  getWeapon: id => WEAPONS[id],
  isMelee: id => WEAPONS[id] !== undefined,
};
const PlayerObject = class {};

function makeClient({ hatID = 0, secondary = 10, distance = 60, health = 500, targetScale = 50 }) {
  const myPlayer = {
    hatID,
    scale: 35,
    isTrapped: false,
    pos: { current: { x: 0, y: 0, distance: () => distance } },
    getItemByType: t => (t === 0 ? 4 : t === 1 ? secondary : null),
    // mirrors the game: dmg * variant * (sDmg||1) * (hat.bDmg||1)
    getBuildingDamage(id, isTank) {
      const w = WEAPONS[id];
      return w.dmg * VARIANT * (w.sDmg || 1) * (isTank ? TANK : 1);
    },
  };
  return {
    myPlayer,
    _ModuleHandler: { canBuy: () => true }, // Tank Gear owned — the old trigger
  };
}
const target = health => ({ health, hitScale: 50, pos: { current: { x: 0, y: 0 } } });

const sandbox = { DataHandler_default, PlayerObject, Math, Number, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const B = sandbox.__B;
const choose = opts => B.getDestroyingWeapon.call({ ...B, client: makeClient(opts) }, target(opts.health ?? 500));

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
};
const HAMMER_PICK = 1, PRIMARY_PICK = 0;

console.log("breaking a pit trap (500 hp)");
check("hammer in reach and not wearing tank -> hammer",
      choose({ hatID: 0, distance: 60 }) === HAMMER_PICK);
check("hammer in reach and wearing tank -> still hammer (156 < 500)",
      choose({ hatID: 40, distance: 60 }) === HAMMER_PICK);

console.log("a building the primary could one-shot only on tank (150 hp)");
// katana: 47 bare, 156 on tank. The old code assumed tank because the hat was
// owned, chose the primary, then _antienemy could swap in soldier and the
// swing landed at 47.
check("not wearing tank -> hammer, not a 47-damage swing",
      choose({ hatID: 0, distance: 60, health: 150 }) === HAMMER_PICK);
check("wearing tank -> primary is a genuine one-shot",
      choose({ hatID: 40, distance: 60, health: 150 }) === PRIMARY_PICK);

console.log("a building the primary really can one-shot bare (40 hp)");
check("not wearing tank -> primary",
      choose({ hatID: 0, distance: 60, health: 40 }) === PRIMARY_PICK);

console.log("reach");
// hammer reach 75 + hitScale 50 = 125; katana 118 + 50 = 168
check("inside hammer reach -> hammer", choose({ hatID: 0, distance: 120 }) === HAMMER_PICK);
check("past hammer reach, hammer equipped -> nothing rather than a weak swing",
      choose({ hatID: 0, distance: 150 }) === null);
check("no hammer equipped -> primary inside its own reach",
      choose({ hatID: 0, secondary: null, distance: 150 }) === PRIMARY_PICK);
check("out of both reaches -> nothing",
      choose({ hatID: 0, secondary: null, distance: 400 }) === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
