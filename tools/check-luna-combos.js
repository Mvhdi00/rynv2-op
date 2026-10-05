#!/usr/bin/env node
/*
 * check-luna-combos.js
 *
 * Checks Luna_Client.user.js's "sync spike 2" and "Spike Kb" against the
 * client's own code. Nothing is re-implemented here: the trigger predicates,
 * the instaKill step engine, hatFc and the weapon / auto-attack helpers are cut
 * out of the script by text markers and run, verbatim, on synthetic game
 * states (players, spikes, reloads, owned hats).
 *
 * It covers
 *   - when each feature may fire (toggle, ring, spike contact, reloads, hats,
 *     range, push line, trapped enemy, new-enemy NaN positions, cooldown)
 *   - the per-tick weapon / hat / auto-attack sequence the engine produces
 *   - that the existing plain velocity spike tick is left alone
 *
 * It cannot say how the combos land on a live server; that depends on ping and
 * server tick alignment. A marker that no longer exists fails loudly.
 *
 *   node tools/check-luna-combos.js [path/to/Luna_Client.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Luna_Client.user.js");
const src = fs.readFileSync(CLIENT_PATH, "utf8");

// ---------------------------------------------------------------- extraction helpers
function idx(s, marker, from = 0) {
  const i = s.indexOf(marker, from);
  if (i < 0) throw new Error("marker not found: " + JSON.stringify(marker));
  return i;
}
function between(startMarker, endMarker, from = 0) {
  const a = idx(src, startMarker, from);
  const b = idx(src, endMarker, a + startMarker.length);
  return src.slice(a, b);
}
function extractModule(modPath) {
  const at = idx(src, '/***/ "' + modPath + '":');
  const hdr = "(function (module, exports) {";
  const start = idx(src, hdr, at);
  let body = src.slice(start + hdr.length);
  const next = body.indexOf('/***/ "./src/');
  const mapEnd = body.indexOf("/******/");
  const end = next >= 0 ? next : mapEnd;
  if (end >= 0) body = body.slice(0, end);
  return body.replace(/\/\*\*\*\/\s*\}\)\s*,?\s*$/, "");
}

const utilsBody = extractModule("./src/js/libs/utils.js");
const itemsBody = extractModule("./src/js/data/items.js");
const weaponVariants = (src.match(/module\.exports\.weaponVariants = (\[[\s\S]*?\}\]);/) || [])[1];
if (!weaponVariants) throw new Error("weaponVariants not found");

const T = {
  constants: between("// VELOCITY TICK (from Misery)", "let spamPrePlacer = false;"),
  getPlayerInfo: between("function getPlayerInfo(player, type) {", "function checkBuildingDamage("),
  canVelocitySpikeTick: between("function canVelocitySpikeTick() {", "// SYNC SPIKE 2 / SPIKE KB"),
  mine: between("// SYNC SPIKE 2 / SPIKE KB", "function doSmartTickAnti() {"),
  branches: between("if (canVelocitySpikeTick()) {", "// AI Slop anti-retrap: break our trap while pushing"),
  engine: between("// INTSA KILL FUNCTION", "antiPush = isNearestEnemyPushPlayer();"),
  isBadTail: between("function isBadTail() {", "// PATHFINDER WITH WEB WORKER"),
  needAutoGather: between("function needAutoGather() {", "function isBadTail() {"),
  hatFc: between("function hatFc() {", "// FIND OBJECTS BY ID/SID:"),
  equipHelpers: between("function isBoughtHat(id, type) {", "function getConfig(id, angle, velocity) {"),
  sendAutoGather: between("function sendAutoGather() {", "function selectToBuild(index) {"),
  selectWeapon: between("function selectWeapon(index, isPlace) {", "function sendAtck(id, angle) {"),
  endOfTick: between("// PLAYER WEAPON", "// CHECK GATHER"),
};

// ---------------------------------------------------------------- sandbox
const sandboxSrc = `
"use strict";
var UTILS = (function(){ var module={exports:{}}; (function(module, exports){ ${utilsBody}
})(module, module.exports); return module.exports; })();
var items = (function(){ var module={exports:{}}; var config={}; (function(module, exports){ ${itemsBody}
})(module, module.exports); return module.exports; })();
var config = { weaponVariants: ${weaponVariants} };

// ---- game state the real code reads/writes (same names as the client)
var tick = 0, nearestEnemy = null, spikes_our = [], traps_our = [];
var primaryReload = [], secondaryReload = [], turretReload = [];
var instaKill = [], insta = { primary: false, secondary: false }, autoaim = false, autoaimAngle = null, predictWeapon = 0;
var antiRetrapArmed = false, antiRetrapPushAngle = null, smartTickObject = null, autoReload = false;
var enemy_collidingspike = false, enemy_lastcollidngspike = false, imTrapped = false;
var autogathering = false, autoBreak = false, antiPush = false, gatherGrind = false, soldierAnti = false, canStillGather = false;
var ePress = false, rightClick = false, leftClick = false, shouldResetShame = false, spikeDmgCount = 0, spikeTickAnti = false;
var currentHat = 0, nearestTrap = null, checkGather = false;
var window = { vars: {} };
var myPlayer = null;
var packets = [];
var io = { send: function(){ packets.push(Array.prototype.slice.call(arguments)); } };
function storeEquip(id, type) { packets.push(["equip", id, type]); if (type === 0) myPlayer.skinIndex = id; else myPlayer.tailIndex = id; }

// ---- REAL code, extracted from the client
${T.constants}
${T.equipHelpers}
${T.sendAutoGather}
${T.selectWeapon}
${T.getPlayerInfo}
${T.canVelocitySpikeTick}
${T.mine}
${T.isBadTail}
${T.needAutoGather}
${T.hatFc}

function runTick() {
  tick++;
  packets = [];
  predictWeapon = myPlayer.weapons[0];   // per-tick default (the client uses getPredictWeapon())
  if (nearestEnemy) { nearestEnemy.lastPrimaryReload = nearestEnemy.lastPrimaryReload || 1; }
  // decision branches
  ${T.branches}
  // instaKill engine
  ${T.engine}
  // end of tick: weapon, auto gather, hats
  ${T.endOfTick}
  // PLAYER AUTO GATHER (as in updatePlayers)
  if (needAutoGather()) { if (!autogathering) sendAutoGather(); } else { if (autogathering) sendAutoGather(); }
  hatFc();
  return {
    tick: tick, queue: instaKill.slice(), autoaim: autoaim, autoaimAngle: autoaimAngle, weapon: predictWeapon,
    hat: myPlayer.skinIndex, autogathering: autogathering, insta: Object.assign({}, insta), packets: packets.slice(),
  };
}

return {
  runTick: runTick,
  api: {
    // direct eval keeps the sandbox's own bindings reachable
    set: function(o){ for (var k in o) { eval(k + " = o[k]"); } },
    get: function(k){ return eval(k); },
    canSyncSpike2: function(){ return canSyncSpike2(); },
    canSpikeKb: function(){ return canSpikeKb(); },
    canVelocitySpikeTick: function(){ return canVelocitySpikeTick(); },
  },
};
`;
const sandbox = new Function(sandboxSrc)();
const { runTick, api } = sandbox;

// ---------------------------------------------------------------- scenario builders
const SPIKE = { scale: 52, id: 9 };
function mkMe(over) {
  return Object.assign({
    sid: 1, alive: true, visible: true, x: 0, y: 0, x2: 0, y2: 0, xVel: 0, yVel: 0, scale: 35,
    weapons: [4, 10], weaponVariants: [], weaponIndex: 4, buildIndex: -1,
    skins: { 6: 1, 7: 1, 12: 1, 40: 1, 53: 1 }, tails: { 19: 1 }, skinIndex: 12, tailIndex: 0, spikeDamage: 0,
    y: 5000,
  }, over || {});
}
function mkEnemy(x, y, over) {
  return Object.assign({
    sid: 2, alive: true, visible: true, x: x, y: y, x2: x, y2: y, xVel: x, yVel: y, scale: 35,
    weapons: [5, 10], weaponVariants: [], spikeDamage: 0, health: 100, shameCount: 0, lastPrimaryReload: 1, lastSecondaryReload: 1,
  }, over || {});
}
function mkSpike(x, y) { return { x: x, y: y, scale: SPIKE.scale, id: SPIKE.id, dmg: 45 }; }
function resetWorld(opts = {}) {
  const me = mkMe(opts.me);
  api.set({
    tick: 100, myPlayer: me, nearestEnemy: null, spikes_our: [], traps_our: [],
    primaryReload: [], secondaryReload: [], turretReload: [],
    instaKill: [], insta: { primary: false, secondary: false }, autoaim: false, autoaimAngle: null, predictWeapon: 0,
    antiRetrapArmed: false, antiRetrapPushAngle: null, smartTickObject: null, autoReload: false,
    imTrapped: false, autogathering: false, autoBreak: false, antiPush: false, gatherGrind: false, soldierAnti: false,
    window: { vars: Object.assign({ syncSpike2: false, spikeKb: false, safeSoldier: false }, opts.vars || {}) },
    syncSpike2Tick: -9,
  });
  const meObj = api.get("myPlayer");
  api.get("primaryReload")[meObj.sid] = 1;
  api.get("secondaryReload")[meObj.sid] = 1;
  api.get("turretReload")[meObj.sid] = 1;
  return meObj;
}
function setEnemy(e) {
  api.set({ nearestEnemy: e });
  api.get("primaryReload")[e.sid] = 1; api.get("secondaryReload")[e.sid] = 1; api.get("turretReload")[e.sid] = 1;
}

// ---------------------------------------------------------------- tiny test runner
let pass = 0, fail = 0; const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
}
function section(t) { console.log("\n== " + t); }

// ================================================================= SYNC SPIKE 2 predicate
section("sync spike 2 - trigger");
{
  // enemy 240 away (inside the 221-261 ring), moving into a spike of ours that sits just beyond them
  const base = () => {
    resetWorld({ vars: { syncSpike2: true } });
    const e = mkEnemy(240, 0, { xVel: 270, yVel: 0 });
    setEnemy(e);
    api.set({ spikes_our: [mkSpike(330, 0)] });
    return e;
  };
  base(); check("fires: ring distance + reaches our spike next tick + primary/turret ready", api.canSyncSpike2() === true);

  resetWorld({ vars: { syncSpike2: false } }); setEnemy(mkEnemy(240, 0, { xVel: 270 })); api.set({ spikes_our: [mkSpike(330, 0)] });
  check("toggle off -> no", api.canSyncSpike2() === false);

  base(); api.set({ spikes_our: [mkSpike(900, 0)] });
  check("no spike near the enemy -> no", api.canSyncSpike2() === false);

  base(); api.set({ spikes_our: [] });
  check("no spikes at all -> no", api.canSyncSpike2() === false);

  for (const [d, want] of [[200, false], [221, false], [221.5, true], [240, true], [260.5, true], [261, false], [300, false]]) {
    resetWorld({ vars: { syncSpike2: true } });
    setEnemy(mkEnemy(d, 0, { xVel: d + 30 })); api.set({ spikes_our: [mkSpike(d + 90, 0)] });
    check("ring edge: distance " + d + " -> " + want, api.canSyncSpike2() === want);
  }

  base(); api.get("primaryReload")[1] = 0.5;
  check("primary not ready -> no", api.canSyncSpike2() === false);
  base(); api.get("turretReload")[1] = 0.5;
  check("turret not ready -> no", api.canSyncSpike2() === false);
  base(); api.get("myPlayer").skins = { 7: 1 };
  check("turret gear (53) not owned -> no", api.canSyncSpike2() === false);

  // observed contact: enemy standing at our spike and took spike damage this tick
  resetWorld({ vars: { syncSpike2: true } });
  setEnemy(mkEnemy(240, 0, { xVel: 240, spikeDamage: 45 })); api.set({ spikes_our: [mkSpike(320, 0)] });
  check("observed spike damage while touching our spike -> yes", api.canSyncSpike2() === true);
  resetWorld({ vars: { syncSpike2: true } });
  setEnemy(mkEnemy(240, 0, { xVel: 240, spikeDamage: 45 })); api.set({ spikes_our: [mkSpike(700, 0)] });
  check("spike damage but not near OUR spike (someone else's) -> no", api.canSyncSpike2() === false);

  // first tick an enemy is seen: xVel/yVel are NaN (x2*2 - undefined) and lineInRect answers true for NaN
  resetWorld({ vars: { syncSpike2: true } });
  setEnemy(mkEnemy(240, 0, { xVel: NaN, yVel: NaN })); api.set({ spikes_our: [mkSpike(900, 0)] });
  check("NaN velocity position (new enemy) never counts as touching a spike", api.canSyncSpike2() === false);

  base(); api.set({ autoaim: true });
  check("combo already running (autoaim) -> no", api.canSyncSpike2() === false);
  base(); api.set({ insta: { primary: false, secondary: false, turret: true } });
  check("combo already running (insta.turret) -> no", api.canSyncSpike2() === false);

  base(); api.set({ tick: 105, syncSpike2Tick: 100 });
  check("cooldown: 5 ticks after the last fire -> no", api.canSyncSpike2() === false);
  base(); api.set({ tick: 109, syncSpike2Tick: 100 });
  check("cooldown elapsed (9 ticks) -> yes", api.canSyncSpike2() === true);
}

// ================================================================= SPIKE KB predicate
section("spike kb - trigger");
{
  const base = () => {
    resetWorld({ vars: { spikeKb: true } });
    setEnemy(mkEnemy(110, 0));
    api.set({ spikes_our: [mkSpike(200, 0)] });   // behind the enemy, on the line away from us
  };
  base(); check("fires: enemy in front of our spike, me behind, both weapons ready + in range", api.canSpikeKb() === true);

  resetWorld({ vars: { spikeKb: false } }); setEnemy(mkEnemy(110, 0)); api.set({ spikes_our: [mkSpike(200, 0)] });
  check("toggle off -> no", api.canSpikeKb() === false);

  base(); api.set({ spikes_our: [mkSpike(200, 150)] });
  check("spike off to the side (not in the push line) -> no", api.canSpikeKb() === false);
  base(); api.set({ spikes_our: [mkSpike(-100, 0)] });
  check("spike behind ME (enemy would be pushed away from it) -> no", api.canSpikeKb() === false);
  base(); api.set({ spikes_our: [mkSpike(500, 0)] });
  check("spike too far for the combined knockback -> no", api.canSpikeKb() === false);

  base(); api.get("secondaryReload")[1] = 0.4;
  check("secondary on reload -> no", api.canSpikeKb() === false);
  base(); api.get("primaryReload")[1] = 0.4;
  check("primary on reload -> no", api.canSpikeKb() === false);
  base(); api.get("myPlayer").weapons = [4, 15];
  check("secondary is a musket, not the hammer -> no", api.canSpikeKb() === false);

  for (const [d, want] of [[100, true], [130, true], [137, true], [145, false], [175, false]]) {
    resetWorld({ vars: { spikeKb: true } });
    setEnemy(mkEnemy(d, 0)); api.set({ spikes_our: [mkSpike(d + 90, 0)] });
    check("range: enemy " + d + " away (hammer reach 138) -> " + want, api.canSpikeKb() === want);
  }

  resetWorld({ vars: { spikeKb: true } });
  setEnemy(mkEnemy(110, 0, { xVel: NaN, yVel: NaN })); api.set({ spikes_our: [mkSpike(200, 0)] });
  check("NaN velocity position (new enemy) is never 'in range' -> no", api.canSpikeKb() === false);

  base(); api.set({ traps_our: [{ x: 110, y: 0, scale: 50 }] });
  check("enemy held in our trap -> no (a push does not move them)", api.canSpikeKb() === false);
  base(); api.set({ autoaim: true });
  check("combo already running -> no", api.canSpikeKb() === false);
}

// ================================================================= engine: tick-by-tick sequences
function describe(s) {
  const pk = s.packets.map((p) => p[0] === "equip" ? "hat" + p[1] : p[0] === "z" ? "weapon" + p[1] : p[0] === "K" ? "gather" : p[0]).join(",");
  return "t" + s.tick + " queue=[" + s.queue + "] autoaim=" + s.autoaim + " weapon=" + s.weapon + " hat=" + s.hat + " gather=" + s.autogathering + " sent=[" + pk + "]";
}

section("sync spike 2 - tick-by-tick through the real engine + hatFc");
{
  resetWorld({ vars: { syncSpike2: true } });
  const me = api.get("myPlayer");
  me.weaponIndex = 10;   // hammer in hand: the primary step must switch back to the katana
  setEnemy(mkEnemy(240, 0, { xVel: 270, yVel: 0 }));
  api.set({ spikes_our: [mkSpike(330, 0)] });
  const s0 = runTick(); console.log("   " + describe(s0));
  check("t0: velocity tick armed, turret gear (53) equipped, no attack yet", s0.hat === 53 && s0.autoaim === false && s0.autogathering === false && s0.queue.join() === "primary,stop");
  const s1 = runTick(); console.log("   " + describe(s1));
  check("t1: primary selected, bull helmet (7), aiming at the enemy, auto-attack on", s1.weapon === 4 && s1.hat === 7 && s1.autoaim === true && s1.autogathering === true && Math.abs(s1.autoaimAngle) < 1e-9, "angle=" + s1.autoaimAngle);
  check("t1: weapon packet selects the katana (id 4)", s1.packets.some((p) => p[0] === "z" && p[1] === 4));
  const s2 = runTick(); console.log("   " + describe(s2));
  check("t2: stop - auto-attack off, flags cleared, queue empty", s2.queue.length === 0 && s2.autoaim === false && s2.autogathering === false && !s2.insta.primary && !s2.insta.turret);
  // after it the primary is on reload: nothing re-arms
  api.get("primaryReload")[1] = 0.3;
  const s3 = runTick();
  check("t3: nothing re-arms while primary reloads", s3.queue.length === 0);
  // primary ready again but still inside the cooldown
  api.get("primaryReload")[1] = 1; api.get("turretReload")[1] = 1;
  const s4 = runTick();
  check("t4: cooldown holds even with everything ready again", s4.queue.length === 0 && s4.hat !== 53);
  // armed at tick 101, cooldown 9: quiet through tick 109, fires exactly at tick 110
  let quiet = true;
  for (let i = 0; i < 4; i++) { const q = runTick(); if (q.queue.length || q.hat === 53) quiet = false; }   // ticks 106..109
  check("quiet through tick 109 (cooldown not over)", quiet);
  const s5 = runTick(); console.log("   " + describe(s5));
  check("fires again at tick 110 (cooldown over, enemy still touching)", s5.tick === 110 && s5.hat === 53 && s5.queue.join() === "primary,stop");
}

section("spike kb - tick-by-tick through the real engine + hatFc");
{
  resetWorld({ vars: { spikeKb: true } });
  setEnemy(mkEnemy(110, 0));
  api.set({ spikes_our: [mkSpike(200, 0)], smartTickObject: { x: 5000, y: 5000, scale: 50 } });   // stale object from an old smart tick
  const s0 = runTick(); console.log("   " + describe(s0));
  check("t0: secondary - hammer selected (id 10), tank gear (40), aiming at the ENEMY not the stale object", s0.weapon === 10 && s0.hat === 40 && s0.autoaim === true && s0.autogathering === true && Math.abs(s0.autoaimAngle) < 0.2, "angle=" + s0.autoaimAngle);
  check("t0: queue continues turret, primary, stop", s0.queue.join() === "turret,primary,stop");
  const s1 = runTick(); console.log("   " + describe(s1));
  check("t1: turret gear (53), auto-attack off", s1.hat === 53 && s1.autoaim === false && s1.autogathering === false);
  const s2 = runTick(); console.log("   " + describe(s2));
  check("t2: primary + bull helmet, aimed at the enemy, auto-attack on", s2.weapon === 4 && s2.hat === 7 && s2.autoaim === true && s2.autogathering === true && Math.abs(s2.autoaimAngle) < 1e-9);
  const s3 = runTick(); console.log("   " + describe(s3));
  check("t3: stop - everything cleared", s3.queue.length === 0 && s3.autoaim === false && s3.autogathering === false);

  // no re-arming mid-combo even though readiness flags were never consumed
  resetWorld({ vars: { spikeKb: true } });
  setEnemy(mkEnemy(110, 0)); api.set({ spikes_our: [mkSpike(200, 0)] });
  const seq = []; for (let i = 0; i < 4; i++) { const s = runTick(); seq.push(s.queue.join("|")); }
  check("mid-combo ticks never restart the queue (hits not yet observed)", seq.join(" / ") === "turret|primary|stop / primary|stop / stop / ", seq.join(" / "));
}

section("spike kb - turret not ready -> secondary then primary only");
{
  resetWorld({ vars: { spikeKb: true } });
  api.get("turretReload")[1] = 0.2;
  setEnemy(mkEnemy(110, 0)); api.set({ spikes_our: [mkSpike(200, 0)] });
  const s0 = runTick(); console.log("   " + describe(s0));
  check("queue skips the turret step", s0.queue.join() === "primary,stop" && s0.weapon === 10);
}

section("interplay with the existing plain velocity spike tick");
{
  // enemy in reach AND about to be pushed into our spike: plain tick says primary; with Spike Kb on and both weapons ready the combo wins
  resetWorld({ vars: { spikeKb: true } });
  setEnemy(mkEnemy(110, 0)); api.set({ spikes_our: [mkSpike(200, 0)] });
  const plain = api.canVelocitySpikeTick();
  const s0 = runTick();
  console.log("   plain velocity spike tick alone would be: " + plain + " ; combo queue after tick: [" + s0.queue + "] weapon=" + s0.weapon);
  check("Spike Kb on: combo overrides the plain primary-only tick", s0.weapon === 10 && s0.queue.join() === "turret,primary,stop");

  resetWorld({ vars: { spikeKb: false } });
  setEnemy(mkEnemy(110, 0)); api.set({ spikes_our: [mkSpike(200, 0)] });
  const s1 = runTick(); console.log("   " + describe(s1));
  check("Spike Kb off: existing behaviour untouched (plain primary tick or nothing)", s1.weapon !== 10 && s1.hat !== 53);

  // hammer on cooldown: Spike Kb must not swallow the plain tick
  resetWorld({ vars: { spikeKb: true } });
  api.get("secondaryReload")[1] = 0.3;
  setEnemy(mkEnemy(110, 0)); api.set({ spikes_our: [mkSpike(200, 0)] });
  const s2 = runTick(); console.log("   " + describe(s2));
  check("hammer reloading: plain tick still fires (primary)", s2.weapon === 4 && s2.autoaim === true && s2.queue.join() === "stop");

  // sync spike 2 off with enemy in ring touching: nothing
  resetWorld({ vars: { syncSpike2: false } });
  setEnemy(mkEnemy(240, 0, { xVel: 270 })); api.set({ spikes_our: [mkSpike(330, 0)] });
  const s3 = runTick();
  check("sync spike 2 off: nothing fires", s3.queue.length === 0 && s3.hat !== 53);
}

console.log("\n" + (fail === 0 ? "ALL " + pass + " CHECKS PASSED" : fail + " FAILED / " + (pass + fail) + ": " + failures.join("; ")));
process.exit(fail === 0 ? 0 : 1);
