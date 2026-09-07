#!/usr/bin/env node
/*
 * verify-ryn.js
 *
 * The menu binds itself by id: attachCheckboxes and friends walk the rendered
 * HTML, look each control's id up in defaultSettings, and log an error and skip
 * the control when it is not there. A typo in either half is therefore silent
 * at build time and shows up as a switch that does nothing. This cross-checks
 * the two halves, and then exercises the decision functions behind the new
 * features on real inputs.
 *
 *   node tools/verify-ryn.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Ryn_Type_2.user.js");

const client = fs.readFileSync(CLIENT_PATH, "utf8");

let failures = 0;
let checks = 0;
const fail = (m) => {
  failures++;
  console.log("  FAIL " + m);
};
const check = (c, m) => (c ? checks++ : fail(m));

function sliceBlock(start, end, from) {
  const s = client.indexOf(start, from || 0);
  if (s === -1) throw new Error("marker not found: " + start);
  const e = client.indexOf(end, s);
  if (e === -1) throw new Error("end marker not found: " + end);
  return client.slice(s, e + end.length);
}

/* ── settings keys ─────────────────────────────────────────────────────────── */

const defaultsSrc = sliceBlock("const defaultSettings = {", "\n  };");
const box = { Math };
vm.createContext(box);
vm.runInContext(defaultsSrc + "\nthis.__d = defaultSettings;", box);
const defaults = box.__d;
const keys = new Set(Object.keys(defaults));

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("");
console.log(`settings: ${keys.size} keys in defaultSettings`);

/* ── every menu control binds to a real setting ─────────────────────────────── */

/* The pages are JS string literals holding HTML. Pull the controls straight out
 * of the source text; the escaping does not affect an id="..." match. */
const CONTROL = /<(input|select)\b[^>]*\bid=\\?"([^"\\]+)\\?"[^>]*>/g;
const IGNORED = new Set([
  /* live UI, not settings-backed */
  "connectingBot", "add-bot-dynamic", "targetCooldown", "_targetCooldownVal",
]);

const seen = new Map();
let m;
while ((m = CONTROL.exec(client)) !== null) {
  const tag = m[1];
  const id = m[2];
  if (IGNORED.has(id)) continue;
  if (!id.startsWith("_")) continue; /* settings ids are all underscore-prefixed */
  const type = /type=\\?"([a-z]+)\\?"/.exec(m[0]);
  seen.set(id, { tag, type: type ? type[1] : tag });
}

let unbound = 0;
for (const [id, info] of seen) {
  if (!keys.has(id)) {
    fail(`menu control "${id}" (${info.type}) has no entry in defaultSettings`);
    unbound++;
  } else {
    checks++;
  }
}
console.log(`  ${seen.size} settings-backed controls, ${seen.size - unbound} bound`);

/* Types have to agree with what the attach* methods assume. */
for (const [id, info] of seen) {
  if (!keys.has(id)) continue;
  const v = defaults[id];
  if (info.type === "checkbox") check(typeof v === "boolean", `${id} is a checkbox but its default is ${typeof v}`);
  else if (info.type === "range") check(typeof v === "number", `${id} is a slider but its default is ${typeof v}`);
  else if (info.type === "color") check(typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v), `${id} is a colour but its default is "${v}"`);
  else if (info.type === "select") check(typeof v === "string", `${id} is a select but its default is ${typeof v}`);
}

/* ── the controls this change was supposed to add ──────────────────────────── */

console.log("\nnew controls");
const REQUIRED = [
  ["_structureColors", "checkbox"], ["_structureColorStrength", "range"],
  ["_ownSpikeColor", "color"], ["_allySpikeColor", "color"], ["_enemySpikeColor", "color"],
  ["_ownTrapColor", "color"], ["_allyTrapColor", "color"], ["_enemyTrapColor", "color"],
  ["_visualSmoothing", "checkbox"], ["_renderOptimization", "checkbox"],
  ["_performanceOptimization", "checkbox"], ["_shadowWings", "checkbox"],
  ["_breakPosition", "select"],
];
for (const [id, type] of REQUIRED) {
  const info = seen.get(id);
  check(info !== undefined && info.type === type, `${id} is missing from the menu, or is not a ${type}`);
}
console.log(`  all ${REQUIRED.length} present and bound`);

/* A setting that nothing reads is a switch that does nothing. Every new
 * toggle has to appear somewhere other than its default, its control and this
 * list. */
for (const id of ["_structureColors", "_structureColorStrength", "_ownSpikeColor",
  "_allySpikeColor", "_enemySpikeColor", "_ownTrapColor", "_allyTrapColor",
  "_enemyTrapColor", "_visualSmoothing", "_renderOptimization",
  "_performanceOptimization", "_shadowWings", "_breakPosition"]) {
  const reads = (client.match(new RegExp("Settings_default\\." + id + "\\b", "g")) || []).length;
  check(reads >= 1, `${id} is declared and shown in the menu but never read`);
}
console.log("  every new setting is read by real code");

/* the select needs its own binder, and it needs to be called */
check(/attachSelects\(\)\s*\{/.test(client), "attachSelects is not defined");
check(/this\.attachSelects\(\);/.test(client), "attachSelects is never called");
check(/selects: this\.querySelectorAll\("select\[id\]"\)/.test(client), "getElements does not collect selects");
check(defaults._breakPosition === "inside" || defaults._breakPosition === "outside",
  `_breakPosition default is "${defaults._breakPosition}"`);
console.log("  select binding wired into the existing settings persistence");

/* ── automatic Q Fast is gone ──────────────────────────────────────────────── */

console.log("\nautomatic Q Fast");
for (const token of ["didAntiInsta", "FastQ", "rynFastQ", "updateFastQ"]) {
  check(!client.includes(token), `"${token}" still appears in the client`);
}
/* ...and Auto Heal, which raised it, is untouched */
check(/if \(!Settings_default\._autoheal\) \{/.test(client), "AntiInsta no longer gates on _autoheal");
check(/ModuleHandler\.heal\(\);/.test(client), "AntiInsta no longer heals");
check(/const needTimes = Math\.ceil\(\(maxHealth - tempHealth\) \/ restore\);/.test(client),
  "AntiInsta's heal-amount calculation changed");
check(/isSaveHealTick\(\)/.test(client), "AntiInsta's save-heal tick test is gone");
check(client.includes("_antiSmartTick"), "Anti Smart Tick is gone");
console.log("  readout and flag removed; Auto Heal and Anti Smart Tick intact");

/* ── one frame driver, not eight loops ─────────────────────────────────────── */

console.log("\nframe loops");
const alwaysOn = (client.match(/requestAnimationFrame\(/g) || []).length;
check(/const FrameDriver = new class/.test(client), "FrameDriver is missing");
const adds = (client.match(/FrameDriver\.add\(/g) || []).length;
check(adds === 8, `expected 8 passes registered on the frame driver, found ${adds}`);
for (const dead of ["_weatherLoop", "_halvesLoop", "_squadLoop", "_scatterLoop", "_cleanupTick", "_winCleanupTick", "_autoFarmLoop"]) {
  check(!client.includes(dead), `${dead} still exists as its own loop`);
}
/* the music sync loop starts and stops on demand and is deliberately left alone */
check(/_startRAF\(\)/.test(client), "the on-demand lyric sync loop was removed");
/* every pass has to register after the driver exists, or it hits the TDZ */
const driverAt = client.indexOf("const FrameDriver = new class");
let addAt = -1;
let earliest = Infinity;
while ((addAt = client.indexOf("FrameDriver.add(", addAt + 1)) !== -1) earliest = Math.min(earliest, addAt);
check(earliest > driverAt, "a frame pass registers before FrameDriver is declared");
console.log(`  8 passes on one driver; ${alwaysOn} requestAnimationFrame call sites remain`);

/* ── per-frame lookups that used to run every frame ────────────────────────── */

console.log("\nper-frame work");
check(!/const canvas = document\.querySelector\("#gameCanvas"\);\s*const ctx = canvas\.getContext/.test(client),
  "_postRender still looks the game canvas up every frame");
check(/_gameCtx=null;/.test(client), "the game context is not cached");
check(/const _targetCtx = _targetCanvas\.getContext\("2d"\);/.test(client),
  "the target overlay context is not cached");
check(!/this\.totalTimes/.test(client), "the FPS timestamp list is still there");
check(/_setSmoothing\(ctx, /.test(client), "imageSmoothingEnabled is still written unconditionally");
check(/_byDistance=\(a, b\) =>/.test(client), "the object sort still allocates a comparator per frame");
console.log("  canvas contexts cached, FPS counter is O(1), sort comparator hoisted");

/* ── decision functions, on real inputs ────────────────────────────────────── */

console.log("\nbreak position");
{
  const src = sliceBlock("    _breakTrapTarget(myPlayer, nearestTrap) {", "\n    }");
  const sb = { Settings_default: {} };
  vm.createContext(sb);
  vm.runInContext("this.f = function " + src.trim().replace("_breakTrapTarget", "") + ";", sb);
  const f = sb.f;

  const trapA = { id: "A" };
  const trapB = { id: "B" };
  const cases = [
    /* mode,      isTrapped, trappedIn, nearestTrap, expected */
    ["inside", true, trapA, trapA, trapA, "in a trap, that trap is the target"],
    ["inside", true, trapA, trapB, trapA, "in a trap, takes the one it is in, not the nearest"],
    ["inside", false, null, trapB, null, "not in a trap, takes nothing"],
    ["inside", false, null, null, null, "no trap anywhere"],
    ["outside", false, null, trapB, trapB, "not in a trap, takes the nearest"],
    ["outside", true, trapA, trapA, null, "in a trap, will not take that trap"],
    ["outside", true, trapA, trapB, trapB, "in a trap, still takes a different one"],
    ["outside", false, null, null, null, "no trap anywhere"],
  ];
  for (const [mode, isTrapped, trappedIn, nearest, expected, label] of cases) {
    sb.Settings_default._breakPosition = mode;
    const got = f.call({}, { isTrapped, trappedIn }, nearest);
    check(got === expected, `${mode}: ${label} — expected ${expected && expected.id}, got ${got && got.id}`);
  }
  console.log(`  ${cases.length} cases across both modes`);

  /* The mode must reach exactly one place at runtime. Everything else that
   * mentions it is the default, the sanitiser and the menu control. */
  const reads = (client.match(/Settings_default\._breakPosition/g) || []).length;
  check(reads === 1, `_breakPosition is read at runtime in ${reads} places, expected 1`);
  const autobreakClass = sliceBlock("class Autobreak {", "\n  }\n  class ");
  check(autobreakClass.includes("_breakTrapTarget"), "_breakTrapTarget is not inside Autobreak");
  check(autobreakClass.includes("Settings_default._breakPosition"), "the only read is not inside Autobreak");
  console.log("  read once, inside Autobreak, by nothing else");
}

console.log("\nstructure colours");
{
  const src = sliceBlock("    _structureColor(entity) {", "\n    }");
  const settings = {
    _structureColors: true,
    _ownSpikeColor: "own-spike", _allySpikeColor: "ally-spike", _enemySpikeColor: "enemy-spike",
    _ownTrapColor: "own-trap", _allyTrapColor: "ally-trap", _enemyTrapColor: "enemy-trap",
  };
  const objects = new Map();
  const myPlayer = {
    isMyPlayerByID: (id) => id === 1,
    isTeammateByID: (id) => id === 2,
  };
  const sb = {
    Settings_default: settings,
    client: { ObjectManager: { objects }, myPlayer },
  };
  vm.createContext(sb);
  vm.runInContext("this.f = function " + src.trim().replace("_structureColor", "") + ";", sb);
  const f = sb.f;

  /* itemGroup 2 is the spike group, 5 the trap group */
  const put = (sid, itemGroup, ownerID) => objects.set(sid, { itemGroup, ownerID });
  put(10, 2, 1); put(11, 2, 2); put(12, 2, 3);
  put(20, 5, 1); put(21, 5, 2); put(22, 5, 3);
  put(30, 1, 3);  /* a wall  */
  put(31, 3, 3);  /* a mill  */
  put(32, 7, 3);  /* a turret */

  const cases = [
    [10, "own-spike"], [11, "ally-spike"], [12, "enemy-spike"],
    [20, "own-trap"], [21, "ally-trap"], [22, "enemy-trap"],
    [30, null], [31, null], [32, null],
  ];
  for (const [sid, expected] of cases) {
    check(f.call({}, { sid }) === expected, `sid ${sid}: expected ${expected}`);
  }
  check(f.call({}, undefined) === null, "no entity should mean no structure colour");
  check(f.call({}, {}) === null, "an entity with no sid should mean no structure colour");
  check(f.call({}, { sid: 999 }) === null, "an unknown sid should mean no structure colour");
  settings._structureColors = false;
  check(f.call({}, { sid: 12 }) === null, "the feature switch should turn every structure colour off");
  settings._structureColors = true;
  console.log(`  ${cases.length} owner/kind combinations, walls mills and turrets left alone`);

  /* the tint must reach the sprite through the item draw, with the object */
  check(/RYN\._Renderer\._objectTint\(\$2\(\$3\),\$3\)/.test(client),
    "the building tint hook does not pass the object through");
  check(/_objectTint\(sprite, entity\)/.test(client), "_objectTint does not take the object");
  check(/variants\.set\(key, canvas\)/.test(client), "the tint cache is not keyed per colour");
  console.log("  tint reaches the sprite cache keyed per colour");
}

console.log("\nshadow wings");
{
  check(/const soldierActive = myPlayer\.hatID === 6 \|\| ModuleHandler\.forceHat === 6 \|\| ModuleHandler\.shouldEquipSoldier;/.test(client),
    "the soldier check is not the sticky union of the three states");
  check(/if \(soldierActive && Settings_default\._shadowWings && useShadow\) \{\n        return 19;/.test(client),
    "Shadow Wings is not returned for soldier");
  /* the accessory swap must not have moved anything about soldier itself */
  check(/const _safeSoldier = Settings_default\._safeSoldier && _dist < SAFE_SOLDIER_RANGE;/.test(client),
    "Safe Soldier's range test changed");
  check(/this\.forceHat = 6;\n          this\.shouldEquipSoldier = true;/.test(client),
    "the soldier hat equip changed");
  console.log("  accessory 19 with soldier; soldier's own logic untouched");
}

/* ── nothing gameplay-critical was disturbed ───────────────────────────────── */

console.log("\nregression anchors");
const ANCHORS = [
  ["Auto Place", /moduleName="autoPlacer"/],
  ["Replace", /_replace\b/],
  ["Preplace", /_prePlace\b/],
  ["Spike Tick", /moduleName="spikeTickController"/],
  ["Auto Heal", /moduleName="antiInsta"/],
  ["Safe Soldier", /_safeSoldier/],
  ["Anti Smart Tick", /antiSmartTick\(myPlayer, nearestEnemy, ModuleHandler/],
  ["Auto Break", /moduleName="autoBreak"/],
  ["packet budget", /packetLimit=119;/],
  ["packet counting at the transport", /socket\._rynCounted = true;/],
  ["melee grip system", /const MeleeAnim = new class/],
];
for (const [name, re] of ANCHORS) check(re.test(client), `${name} is missing`);
console.log(`  all ${ANCHORS.length} present`);

console.log(`\n${checks} checks passed, ${failures} failed.`);
process.exit(failures ? 1 : 0);
