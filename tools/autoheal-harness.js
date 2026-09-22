"use strict";
// Pulls the real Auto Heal engine and the real game tables out of
// Ryn_Type_2.user.js and makes them runnable under node, so the survival
// decisions can be exercised against scenarios instead of read.
//
// Nothing is retyped: every range below is sliced straight out of the
// userscript, so a change to the item table, the hat table or the engine shows
// up in the tests without the tests being touched.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SOURCE = path.join(__dirname, "..", "Ryn_Type_2.user.js");

function sliceBetween(lines, startNeedle, endNeedle) {
  const start = lines.findIndex(l => l.startsWith(startNeedle));
  if (start === -1) throw new Error(`harness: start not found: ${startNeedle}`);
  const end = lines.findIndex((l, i) => i >= start && l.startsWith(endNeedle));
  if (end === -1) throw new Error(`harness: end not found: ${endNeedle}`);
  return lines.slice(start, end + 1).join("\n");
}

function build() {
  const lines = fs.readFileSync(SOURCE, "utf8").split("\n");

  const parts = [
    // Config, weapon / item / variant / projectile tables, Vector
    sliceBetween(lines, "  const Config = {", "  const Vector_default = Vector;"),
    // math + geometry helpers
    sliceBetween(lines, "  const getAngle = (x1, y1", "  const lerp = (start, end, factor)"),
    sliceBetween(lines, "  const reverseAngle = ", "  const reverseAngle = "),
    sliceBetween(lines, "  const pointInRiver = position => {", "  const pointInDesert = position =>"),
    // store tables + data handler + object classes
    sliceBetween(lines, "  const Hats = {", "  const DataHandler_default = DataHandler;"),
    sliceBetween(lines, "  class ObjectItem {", "  class Entity {").replace(/\n\s*class Entity \{$/, ""),
    // Entity and the real Player, so enemy damage, reach, reload and the
    // instakill scan in the tests are the client's own and not a rewrite.
    sliceBetween(lines, "  class Entity {", "  const Entity_default = Entity;"),
    sliceBetween(lines, "  const scale_value = window.grbtp;", "  const Player_default = Player;"),
    // the engine
    sliceBetween(lines, "  const SURVIVE_HEAL_PACKETS = 3;", "  const AutoHeal_default = AutoHeal;")
  ];

  const prelude = `
    Math.LN1 = 100;
    var window = { grbtp: 35 };
    var isProd = false;
    var Logger = { log() {}, warn() {}, error() {}, test() {} };
    var Settings_default = { _autoheal: true };
    var HatPredictor_default = { train() {}, predict() { return null; } };
    var Hooker_default = { linker(v) { return [ v ]; } };
  `;

  const epilogue = `
    module.exports = {
      AutoHeal: AutoHeal,
      Items: Items,
      Hats: Hats,
      Accessories: Accessories,
      Weapons: Weapons,
      Projectiles: Projectiles,
      WeaponVariants: WeaponVariants,
      ItemGroups: ItemGroups,
      Config: Config_default,
      DataHandler: DataHandler_default,
      Vector: Vector_default,
      PlayerObject: PlayerObject,
      Resource: Resource,
      Player: Player_default,
      Entity: Entity_default,
      Settings: Settings_default,
      constants: {
        SURVIVE_HEAL_PACKETS: SURVIVE_HEAL_PACKETS,
        SURVIVE_SHAME_WINDOW: SURVIVE_SHAME_WINDOW,
        SURVIVE_SHAME_LIMIT: SURVIVE_SHAME_LIMIT,
        SURVIVE_DOT_PERIOD: SURVIVE_DOT_PERIOD,
        SURVIVE_POT_CEILING: SURVIVE_POT_CEILING,
        SURVIVE_SOLDIER_ANTI: SURVIVE_SOLDIER_ANTI,
        SURVIVE_SPIKE_DAMAGES: SURVIVE_SPIKE_DAMAGES,
        SURVIVE_TURRET_DAMAGE: SURVIVE_TURRET_DAMAGE
      }
    };
  `;

  const code = `(function () {\n"use strict";\n${prelude}\n${parts.join("\n")}\n${epilogue}\n})()`;
  const sandbox = { module: { exports: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "autoheal-harness-extract.js" });
  return sandbox.module.exports;
}

module.exports = build();
