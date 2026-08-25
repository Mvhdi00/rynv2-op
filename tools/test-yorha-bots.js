#!/usr/bin/env node
/*
 * test-yorha-bots.js
 *
 * Exercises the bot methods build-yorha.js changes — _peacetime, _ownerEngaged
 * and the two _botTick paths that call them — against stub bots.
 *
 * The methods are lifted out of the build output by name and run with every
 * collaborator stubbed, so what is checked is the decision: on which ticks a
 * bot gathers and builds, and on which ticks it leaves the tick to the fight.
 *
 *   node tools/test-yorha-bots.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "YoRHa_System.user.js");
const built = fs.readFileSync(OUT, "utf8");

/* ---------- lift the methods out of the build ---------- */

/* Object-literal methods, so the text runs from `name(args) {` to the brace
 * that closes it. Strings and comments inside are stepped over rather than
 * counted, or a `{` in a comment would end the method early. */
function method(name) {
  const start = built.indexOf("\n            " + name + "(");
  if (start === -1) throw new Error("method not found in the build: " + name);
  const open = built.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < built.length; i++) {
    const c = built[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < built.length && built[i] !== quote) i += built[i] === "\\" ? 2 : 1;
      continue;
    }
    if (c === "/" && built[i + 1] === "/") {
      i = built.indexOf("\n", i);
      if (i === -1) break;
      continue;
    }
    if (c === "/" && built[i + 1] === "*") {
      i = built.indexOf("*/", i) + 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      return built.slice(start + 1, i + 1);
    }
  }
  throw new Error("unbalanced braces reading " + name);
}

/* Free variables the lifted code closes over in the client. */
const env = {
  window: { vars: {} },
  UTILS: {
    getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    getAngleDist: (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))),
    toRad: deg => (deg * Math.PI) / 180,
  },
  items: { list: [], weapons: [] },
  botClamp: (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0)),
  inBotCtx: () => false,
  myPlayer: null,
  nearestEnemy: null,
};

/* The lifted code closes over these by name, so a value that changes between
 * cases (myPlayer, nearestEnemy) means building the object again with it. */
function build(names, overrides) {
  const scope = Object.assign({}, env, overrides || {});
  const body = names.map(method).join(",\n");
  const keys = Object.keys(scope);
  const make = new Function(...keys, "return {\n" + body + "\n};");
  return make(...keys.map(k => scope[k]));
}

const lifted = build(["_peacetime", "_ownerEngaged", "_botTick"]);

/* ---------- stub bot + call recorder ---------- */

function makeSquad(options = {}) {
  const calls = [];
  const bot = {
    alive: true,
    ws: { readyState: 1 },
    attacking: false,
    modAttacked: options.modAttacked === true,
    modMoved: options.modMoved === true,
    mod: options.mod === undefined ? {} : options.mod,
    x: 0,
    y: 0,
    farmTarget: null,
  };
  const squad = Object.assign(Object.create(lifted), {
    list: [bot],
    possessed: null,
    ceasefire: options.ceasefire === true,
    hunt: options.hunt || null,
    _syncUntil: 0,
    _manualAttack: false,
    /* what the tick is allowed to reach */
    _packetSpam() { calls.push(["spam"]); },
    _huntSeen() { return options.huntSeen || null; },
    _shadowPoint() { return { x: 300, y: 0 }; },
    _searchPoint() { return { x: 900, y: 0 }; },
    _ring() { return { x: 200, y: 0 }; },
    _spot() { return options.spot === undefined ? { x: 400, y: 0 } : options.spot; },
    _safeWalk(b, angle) { return angle; },
    _nearestEnemy() { return options.enemy || null; },
    _reach() { return 95; },
    _ownerEngaged() { return options.ownerEngaged === true; },
    _autoFarm() { return options.farm || null; },
    _autoMills(b, angle) {
      if (!options.mills || angle === null || angle === undefined) return false;
      calls.push(["mills", Math.round(angle * 100) / 100]);
      return true;
    },
    _sendWeapon(b, id) { calls.push(["weapon", id]); },
    _sendAim(b, angle) { calls.push(["aim", Math.round(angle * 100) / 100]); },
    _sendAttack(b, on) { calls.push(["attack", !!on]); },
    _sendMove(b, angle) { calls.push(["move", angle === null ? null : Math.round(angle * 100) / 100]); },
    /* the non-Full-Mod tail, past the point every test here stops */
    _autoHeal() { return false; },
    _autoPush() { return null; },
    _autoBreak() { return null; },
    _autoPlaceSpike() { return false; },
    _spikeTick() { return false; },
    _detour() {},
    _wander() {},
  });
  return { squad, bot, calls, did: name => calls.some(c => c[0] === name) };
}

/* ---------- assertions ---------- */

let failures = 0;
let checks = 0;
function check(name, condition) {
  checks += 1;
  if (condition) console.log("  ok    " + name);
  else { failures += 1; console.log("  FAIL  " + name); }
}

/* ---------- _peacetime ---------- */

console.log("_peacetime");

{
  const { squad, bot, calls, did } = makeSquad({
    farm: { angle: 1, mode: "walk", weapon: 8 },
    mills: true,
  });
  const took = squad._peacetime(bot, 2.5);
  check("takes the tick when there is something to gather", took === true);
  check("lays the mill trail on the way", did("mills"));
  check("the trail goes down behind the walk, not the formation heading",
    calls.find(c => c[0] === "mills")[1] === 1);
  check("mills are placed before the gather swing",
    calls.findIndex(c => c[0] === "mills") < calls.findIndex(c => c[0] === "attack"));
  check("holds the gathering weapon", calls.some(c => c[0] === "weapon" && c[1] === 8));
  check("walks rather than swinging while out of reach",
    calls.some(c => c[0] === "attack" && c[1] === false) && calls.some(c => c[0] === "move" && c[1] === 1));
}

{
  const { squad, bot, calls, did } = makeSquad({
    farm: { angle: 1, mode: "hit", weapon: 8 },
    mills: true,
  });
  squad._peacetime(bot, 2.5);
  check("no mill trail while standing still on a resource", !did("mills"));
  check("swings at what it is standing on", calls.some(c => c[0] === "attack" && c[1] === true));
  check("stops walking to gather", calls.some(c => c[0] === "move" && c[1] === null));
}

{
  const { squad, bot, calls, did } = makeSquad({ farm: null, mills: true });
  const took = squad._peacetime(bot, 2.5);
  check("builds on the formation heading with nothing to gather", took === true && did("mills"));
  check("the trail follows where it is walking",
    calls.find(c => c[0] === "mills")[1] === 2.5);
  check("keeps walking after building", calls.some(c => c[0] === "move" && c[1] === 2.5));
}

{
  const { squad, bot } = makeSquad({ farm: null, mills: false });
  check("gives the tick back with nothing to do", squad._peacetime(bot, 2.5) === false);
}

{
  const { squad, bot, did } = makeSquad({ farm: null, mills: true });
  check("cannot build without a heading to build behind", squad._peacetime(bot, null) === false && !did("mills"));
}

/* ---------- _ownerEngaged ---------- */

console.log("_ownerEngaged");

const engaged = overrides => build(["_ownerEngaged"], overrides)._ownerEngaged();

check("nothing on you when you are not in game",
  engaged({ myPlayer: null, nearestEnemy: null }) === false);
check("someone at 400 counts as on you",
  engaged({ myPlayer: { x2: 0, y2: 0 }, nearestEnemy: { x2: 400, y2: 0 } }) === true);
check("someone at 1200 does not",
  engaged({ myPlayer: { x2: 0, y2: 0 }, nearestEnemy: { x2: 1200, y2: 0 } }) === false);
check("never answers from inside a bot context",
  engaged({ myPlayer: { x2: 0, y2: 0 }, nearestEnemy: { x2: 100, y2: 0 }, inBotCtx: () => true }) === false);

/* ---------- _botTick, Full Mod ---------- */

console.log("_botTick under Full Mod");

const FULL = { botFullMod: true, botSync: false, botStopRadius: 60, botAutoFarm: true, botAutoMills: true };

{
  env.window.vars = Object.assign({}, FULL);
  const { squad, bot, did } = makeSquad({ farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true });
  squad._botTick(bot);
  check("a quiet tick is spent gathering and building", did("mills") && did("weapon"));
}

{
  env.window.vars = Object.assign({}, FULL);
  const { squad, bot, did } = makeSquad({ farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true, modAttacked: true });
  squad._botTick(bot);
  check("a tick the mod swung on is left to the mod", !did("mills") && !did("weapon"));
}

{
  env.window.vars = Object.assign({}, FULL);
  const { squad, bot, did } = makeSquad({ farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true, modMoved: true });
  squad._botTick(bot);
  check("a tick the mod moved on is left to the mod", !did("mills") && !did("weapon"));
}

{
  env.window.vars = Object.assign({}, FULL);
  const { squad, bot, did } = makeSquad({
    farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true,
    enemy: { d: 90, p: {} },
  });
  squad._botTick(bot);
  check("stops gathering with someone in reach of it", !did("weapon"));
}

{
  env.window.vars = Object.assign({}, FULL);
  const { squad, bot, did } = makeSquad({
    farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true,
    enemy: { d: 900, p: {} },
  });
  squad._botTick(bot);
  check("keeps gathering with someone visible but far off", did("weapon"));
}

{
  env.window.vars = Object.assign({}, FULL);
  const { squad, bot, did } = makeSquad({
    farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true, ownerEngaged: true,
  });
  squad._botTick(bot);
  check("drops everything when something is on you", !did("weapon") && !did("mills"));
  check("and walks the formation instead", did("move"));
}

{
  env.window.vars = Object.assign({}, FULL, { botFreeze: true });
  const { squad, bot, did } = makeSquad({ farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true });
  squad._botTick(bot);
  check("frozen bots stay frozen", !did("weapon") && !did("mills"));
}

{
  env.window.vars = Object.assign({}, FULL, { botFollowCursor: true });
  const { squad, bot, did } = makeSquad({ farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true });
  squad._botTick(bot);
  check("a bot you are steering by cursor is yours", !did("weapon"));
}

{
  env.window.vars = Object.assign({}, FULL);
  const hunt = { sid: 7, x: 500, y: 0, foundBy: null, lastPing: 0 };
  const { squad, bot, did } = makeSquad({
    farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true, hunt: hunt,
  });
  squad._botTick(bot);
  check("a hunt outranks gathering", !did("weapon") && !did("mills"));
}

{
  env.window.vars = Object.assign({}, FULL);
  const { squad, bot, calls } = makeSquad({ farm: null, mills: false, spot: { x: 400, y: 0 } });
  squad._botTick(bot);
  check("with nothing to do it still walks the formation",
    calls.some(c => c[0] === "move" && c[1] === 0));
}

{
  env.window.vars = Object.assign({}, FULL);
  const { squad, bot, calls } = makeSquad({ farm: null, mills: false, modMoved: true });
  squad._botTick(bot);
  check("never fights the mod for the wheel", !calls.some(c => c[0] === "move"));
}

{
  env.window.vars = Object.assign({}, FULL);
  const { squad, bot, calls } = makeSquad({ farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true });
  squad.possessed = bot;
  squad._botTick(bot);
  check("hands off the bot you are driving", !calls.some(c => c[0] !== "spam"));
}

/* ---------- _botTick, Full Mod off ---------- */

console.log("_botTick with Full Mod off");

const HAND = { botFullMod: false, botSync: false, botStopRadius: 60, botAutoFarm: true, botAutoMills: true };

{
  env.window.vars = Object.assign({}, HAND);
  const { squad, bot, did } = makeSquad({ farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true, mod: null });
  squad._botTick(bot);
  check("gathers and builds on the hand-written path too", did("mills") && did("weapon"));
}

{
  env.window.vars = Object.assign({}, HAND);
  const { squad, bot, did } = makeSquad({ farm: null, mills: true, mod: null });
  squad._botTick(bot);
  check("builds with nothing left to gather", did("mills"));
}

{
  env.window.vars = Object.assign({}, HAND);
  const { squad, bot, did } = makeSquad({
    farm: { angle: 1, mode: "walk", weapon: 8 }, mills: true, mod: null, ownerEngaged: true,
  });
  squad._botTick(bot);
  /* The mill line further down this path is the original one and still runs;
   * what the guard has to stop is the bot walking off to a tree. */
  check("your fight still stops the farm", !did("weapon"));
}

/* ---------- the shipped defaults ---------- */

console.log("defaults");

{
  const defaults = {};
  const block = built.slice(built.indexOf("window.vars = {"), built.indexOf("// --- LOAD SAVED SETTINGS ---"));
  for (const [, key, value] of block.matchAll(/^\s{8}(\w+):\s*([^,\n]+),/gm)) defaults[key] = value.trim();
  const on = key => defaults[key] === "true";
  check("bots gather out of the box", on("botAutoFarm"));
  check("bots lay the mill trail out of the box", on("botAutoMills"));
  check("bots run the whole mod out of the box", on("botFullMod"));
  check("the placer is on out of the box", on("autoPlace"));
  check("bots place in a fight out of the box", on("botAutoPlace"));
  check("bots eat out of the box", on("botAutoHeal"));
  check("bots respawn out of the box", on("botAutoSpawn"));
  check("farming stops at a stock rather than never", Number(defaults.botFarmLimit) > 0);
  check("the migration key ships at 0", defaults.botCapability === "0");
  check("the migration bumps past it", /const BOT_CAPABILITY = ([1-9])/.test(built));
  check("the migration writes the config back", built.includes("localStorage.setItem(STORAGE_KEY, JSON.stringify(window.vars));"));
  check("the hat mirror stands down under Full Mod",
    built.includes("if (V.botAutoBuyHats && !V.botFullMod && myPlayer"));

  /* groupLimit is called from inside RynBots, so it has to be declared in the
   * scope RynBots is declared in — the same one pingMap is in, which RynBots
   * already calls. Getting this wrong is a ReferenceError that only shows up
   * the first time a bot tries to place a mill. */
  const atModScope = name => new RegExp("^        function " + name + "\\(", "m").test(built);
  check("groupLimit sits in the scope the bots can reach",
    atModScope("groupLimit") && atModScope("pingMap") && built.includes("pingMap(h.x, h.y)"));
  check("the mill trail asks it for the cap",
    /_autoMills\(bot, moveAngle\) \{[\s\S]{0,900}groupLimit\(item\.group\)/.test(built));
  check("the placer asks it for the cap too",
    /function isItemLimit\(id\) \{[\s\S]{0,200}groupLimit\(group\)/.test(built));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
