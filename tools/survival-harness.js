// Extracts the real game tables, the real helpers and the real SurvivalCore
// out of Ryn_Type_2.user.js and runs them against synthetic worlds. Nothing is
// re-implemented: every number the module reads comes from the shipped tables,
// and the module source is the file's own bytes.
"use strict";
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "Ryn_Type_2.user.js"), "utf8");
const LINES = SRC.split("\n");

function lineOf(marker) {
  for (let i = 0; i < LINES.length; i++) if (LINES[i].startsWith(marker)) return i;
  throw new Error("marker not found: " + marker);
}
function slice(a, b) {
  return LINES.slice(a, b).join("\n");
}

const tables = slice(lineOf("  const Config = {"), lineOf("  const formatDate = date =>"));
const hats = slice(lineOf("  const Hats = {"), lineOf("  const DataHandler_default = DataHandler;") + 1);
const coreStart = lineOf("  //  RYN SURVIVAL CORE — Auto Heal 2.0") - 1;
const coreEnd = lineOf("  const AntiInsta_default = SurvivalCore;") + 1;
const core = slice(coreStart, coreEnd);

const prelude = `
  "use strict";
  class PlayerObject {
    constructor(o) { Object.assign(this, o); }
    get collisionScale() { return this.scale; }
    get hitScale() { return this.scale * 1.8; }
    getDamage() { return this.damage || 0; }
  }
  const Logger = { log() {}, warn() {}, error() {}, test() {} };
  let __activeClient = null;
  const AC = () => __activeClient;
  const Settings_default = { _autoheal: true };
`;

const epilogue = `
  return {
    SurvivalCore, PlayerObject, Settings_default,
    Vector: Vector_default, Items, Hats, Accessories, Weapons, Projectiles,
    WeaponVariants, Config, DataHandler: DataHandler_default,
    names: HEAL_PRIORITY_NAMES,
    T: { IDLE: SV_T_IDLE, RECOVER: SV_T_RECOVER, SHAME: SV_T_SHAME, CHIP: SV_T_CHIP,
         PREHEAL: SV_T_PREHEAL, LETHAL: SV_T_LETHAL, INSTA: SV_T_INSTA, CRITICAL: SV_T_CRITICAL },
    consts: { HORIZON: SV_HORIZON, TICK_MS: SV_TICK_MS, SHAME_WINDOW: SV_SHAME_WINDOW_MS,
              WALL: SV_SHAME_WALL, HEAL_PACKETS: SV_HEAL_PACKETS, MAX_USES: SV_MAX_USES,
              DOT: SV_DOT_PERIOD_TICKS },
    setActive(c) { __activeClient = c; }
  };
`;

const body = prelude + "\n" + tables + "\n" + hats + "\n" + core + "\n" + epilogue;
let M;
try {
  M = new Function("window", "document", body)({ localStorage: {} }, {});
} catch (e) {
  throw e;
}
module.exports = M;
