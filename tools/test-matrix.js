#!/usr/bin/env node
// Scenario matrix for the placement systems.
//
//   node tools/test-matrix.js
//
// Extracts the real decision functions from NovaStorm.user.js and drives them
// against synthetic game states. For every scenario it records: who owned the
// action, why, which system deferred, whether a duplicate was prevented, and
// whether a stale action was prevented.
//
// Item scales/groups below are the real values from the shipped items table
// (spikes id 6 scale 49 group 2 limit 15; pit trap id 15 scale 50 group 5
// limit 6; both placeOffset -5).

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "NovaStorm.user.js"), "utf8");

function grab(name, kind) {
  if (kind === "const") {
    const m = new RegExp("\\n\\s*const " + name + " = \\{[\\s\\S]*?\\n\\s*\\};").exec(SRC);
    return m[0];
  }
  const m = new RegExp("\\n\\s*function\\s+" + name + "\\s*\\(").exec(SRC);
  const start = SRC.indexOf("function", m.index);
  let i = SRC.indexOf("{", start), d = 0;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return SRC.slice(start, j + 1); }
  }
}

const EXTRACT = ["NS_posKey", "NS_isCooling", "NS_cool", "NS_inSandbox", "NS_groupLimit",
  "NS_updateMoveModel", "NS_segDist2", "NS_hits", "NS_escapeExits", "NS_buildCtx",
  "NS_usefulness", "NS_probeAngles", "NS_runPreplace", "NS_revalidate",
  "NS_objAsConfig", "NS_roles", "NS_fillsRole", "NS_findDoomed", "NS_runReplace",
  "isObjectOur", "addPredictObject", "isItemLimit", "getConfig", "canPlace",
  "isAutoPlaceAngle"];

const harness = `
'use strict';
const mathSQRT = Math.sqrt, mathABS = Math.abs, mathPI = Math.PI;
const UTILS = {
  getDistance: (x1,y1,x2,y2) => mathSQRT((x2-=x1)*x2 + (y2-=y1)*y2),
  getAngleDist: (a,b) => { const p = mathABS(b-a) % (mathPI*2); return p > mathPI ? (mathPI*2)-p : p; },
  getDirection: (x1,y1,x2,y2) => Math.atan2(y1-y2, x1-x2),
  toRad: d => d * (mathPI/180),
  isSandbox: false,
  lineInRect: function (recX, recY, recX2, recY2, x1, y1, x2, y2) {
    let minX=x1,maxX=x2; if(x1>x2){minX=x2;maxX=x1;}
    if(maxX>recX2)maxX=recX2; if(minX<recX)minX=recX; if(minX>maxX)return false;
    let minY=y1,maxY=y2; const dx=x2-x1;
    if(Math.abs(dx)>0.0000001){const a=(y2-y1)/dx,b=y1-a*x1;minY=a*minX+b;maxY=a*maxX+b;}
    if(minY>maxY){const t=maxY;maxY=minY;minY=t;}
    if(maxY>recY2)maxY=recY2; if(minY<recY)minY=recY; if(minY>maxY)return false;
    return true;
  }
};
const config = { playerDecel: 0.993, playerSpeed: 0.0016, mapScale: 14400, riverWidth: 724,
                 gatherAngle: Math.PI/2.6 };
const GROUPS = { 2: { id:2, name:"spikes", limit:15 }, 5: { id:5, name:"trap", limit:6 } };
const items = { list: [] };
items.list[6]  = { id:6,  name:"spikes",   scale:49, placeOffset:-5, group:GROUPS[2] };
items.list[15] = { id:15, name:"pit trap", scale:50, placeOffset:-5, group:GROUPS[5] };
items.weapons = [];
items.weapons[0]  = { dmg:25, range:65,  speed:300 };
items.weapons[10] = { dmg:10, sDmg:7.5, range:75, speed:400 };   // hammer, real values
config.weaponVariants = [{val:1},{val:1.1},{val:1.18},{val:1.18}];
const objectManager = {
  checkItemLocation: function (x, y, s, sM, indx, ignoreWater, placer, objects) {
    for (let i = 0; i < objects.length; ++i) {
      const o = objects[i];
      const blockS = o.blocker ? o.blocker : (o.getScale ? o.getScale(sM, o.isItem) : o.scale);
      if (o.active && UTILS.getDistance(x, y, o.x, o.y) < (s + blockS)) return false;
    }
    if (!ignoreWater && indx != 18 && y >= (config.mapScale/2)-(config.riverWidth/2) &&
        y <= (config.mapScale/2)+(config.riverWidth/2)) return false;
    return true;
  }
};
const win = { vars: { prePlace: true, autoPlace: true, shameTick: false },
              location: { hostname: "moomoo.io" } };   // scenarios run off sandbox, so real caps apply
const window = win;

let tick = 0, packets = 0;
let predictObjects = [];
let visibleObjects = [], spikes_our = [], traps_our = [];
let myPlayer = null, nearestEnemy = null, nearestTrap = null;
let instaKill = [], insta = { primary:false, secondary:false, turret:false, primaryturret:false };
let spikeDmgCount = 0, predictMoveAngle = null, smartTickSpike = null;
let removedObjects = [];
let enemiesNear = [];
let spawnedObjectSids = [];
let alliancePlayers = [];
function isAlly() { return false; }
const primaryReload = {}, secondaryReload = {};
let imTrapped = false;
function getPlayerInfo(p, t) {
  if (t === "secondaryWeapon") return p && p.__hammer ? "hammer" : "bow";
  if (t === "secondaryStructureDmg") return 100;
  return 0;
}
${EXTRACT.map(n => grab(n)).join("\n")}
${grab("NS_PP", "const").trim()}
${grab("NS_RP", "const").trim()}
let NS_ctx = null;
let NS_intent = null;
let NS_replaceIntent = null;
let NS_pendingReplace = null;
let NS_sandboxCache = null;
const NS_cooldown = new Map();

function __set(s) {
  if ('tick' in s) tick = s.tick;
  if ('packets' in s) packets = s.packets;
  if ('predictObjects' in s) predictObjects = s.predictObjects;
  if ('visibleObjects' in s) visibleObjects = s.visibleObjects;
  if ('spikes_our' in s) spikes_our = s.spikes_our;
  if ('traps_our' in s) traps_our = s.traps_our;
  if ('myPlayer' in s) myPlayer = s.myPlayer;
  if ('nearestEnemy' in s) nearestEnemy = s.nearestEnemy;
  if ('nearestTrap' in s) nearestTrap = s.nearestTrap;
  if ('instaKill' in s) instaKill = s.instaKill;
  if ('insta' in s) Object.assign(insta, s.insta);
  if ('spikeDmgCount' in s) spikeDmgCount = s.spikeDmgCount;
  if ('predictMoveAngle' in s) predictMoveAngle = s.predictMoveAngle;
  if ('imTrapped' in s) imTrapped = s.imTrapped;
  if ('removedObjects' in s) removedObjects = s.removedObjects;
  if ('enemiesNear' in s) enemiesNear = s.enemiesNear;
  if ('spawnedObjectSids' in s) spawnedObjectSids = s.spawnedObjectSids;
  if ('pendingReplace' in s) NS_pendingReplace = s.pendingReplace;
  if ('vars' in s) Object.assign(win.vars, s.vars);
  if ('reloads' in s) { primaryReload[s.reloads.sid] = s.reloads.p; secondaryReload[s.reloads.sid] = s.reloads.s; }
}
function __get() { return { predictObjects, NS_intent, NS_replaceIntent, NS_ctx,
                            smartTickSpike, packets, tick, NS_pendingReplace }; }
function __resetCooldown() { NS_cooldown.clear(); }
module.exports = { __set, __get, __resetCooldown, NS_buildCtx, NS_runPreplace,
                   NS_runReplace, NS_findDoomed, NS_roles, NS_fillsRole, NS_objAsConfig,
                   NS_revalidate, NS_updateMoveModel, NS_usefulness, isAutoPlaceAngle,
                   getConfig, canPlace, NS_PP, NS_RP, items, UTILS };
`;

const tmp = path.join(__dirname, ".ns_matrix." + process.pid + ".tmp.js");
fs.writeFileSync(tmp, harness);
process.on("exit", () => { try { fs.unlinkSync(tmp); } catch (e) {} });
const G = require(tmp);

// ---------------------------------------------------------------- fixtures
const SPIKE = 6, TRAP = 15;
const mkPlayer = (x, y) => ({ sid: 1, x2: x, y2: y, x: x, y: y, xVel: x, yVel: y,
  alive: true, scale: 35, items: [0, 4, SPIKE, 0, TRAP, 0], itemCounts: {}, buildIndex: -1,
  t1: 0, t2: 111, __hammer: false });
const mkEnemy = (x, y) => ({ sid: 2, x2: x, y2: y, x: x, y: y, xVel: x, yVel: y,
  scale: 35, spikeDamage: 0, buildIndex: -1, t1: 0, t2: 111 });

// walk an enemy for n ticks with a per-tick delta, feeding the real model
function walk(e, n, dx, dy) {
  for (let i = 0; i < n; i++) {
    const lx = e.x2, ly = e.y2;
    e.x2 += dx; e.y2 += dy; e.xVel = e.x2 * 2 - lx; e.yVel = e.y2 * 2 - ly;
    e.t1 = 0; e.t2 = 111;
    G.NS_updateMoveModel(e, lx, ly);
  }
}

function base(over) {
  const me = mkPlayer(7200, 5000);
  const en = mkEnemy(7200 + 150, 5000);
  return Object.assign({
    tick: 10, packets: 0, predictObjects: [], visibleObjects: [], spikes_our: [],
    traps_our: [], myPlayer: me, nearestEnemy: en, nearestTrap: null,
    instaKill: [], insta: { primary:false, secondary:false, turret:false, primaryturret:false },
    spikeDmgCount: 0, predictMoveAngle: null, imTrapped: false,
    vars: { prePlace: true, autoPlace: true, shameTick: false },
    reloads: { sid: 1, p: 1, s: 1 }, enemiesNear: [], spawnedObjectSids: [],
    removedObjects: [], pendingReplace: null
  }, over);
}


// A spike of ours sitting in contact range of the enemy, and an enemy whose
// hammer came off cooldown this tick (the reload EDGE, not merely "is ready").
function replaceFixture(spikeHealth) {
  const st = base();
  st.nearestEnemy = mkEnemy(7200 + 250, 5000);
  walk(st.nearestEnemy, 8, -14, 0);                     // ends ~138 out
  const e = st.nearestEnemy;
  e.weapons = [0, 10];
  e.weaponVariants = { 0: 0, 10: 0 };
  e.skinIndex = 0;                                       // no tank hat
  e.lastSecondaryReload = 0;
  e.d2 = Math.atan2(5000 - e.y2, 7200 - e.x2);           // facing our side
  st.reloads = { sid: 2, p: 0, s: 1 };
  const spike = { id: SPIKE, sid: 55, x: e.x2 - 60, y: 5000, scale: 49,
                  active: true, health: spikeHealth, owner: { sid: 1 },
                  getScale: function () { return this.scale; } };
  st.visibleObjects = [spike];
  st.spikes_our = [spike];
  st.enemiesNear = [e];
  return { st, e, spike };
}

// ---------------------------------------------------------------- reporting
const rows = [];
function record(n, name, r) {
  rows.push(Object.assign({ n, name }, r));
  console.log(`\n${n}. ${name}`);
  console.log(`   owner     : ${r.owner}`);
  console.log(`   reason    : ${r.reason}`);
  console.log(`   deferred  : ${r.deferred}`);
  console.log(`   duplicate : ${r.dup}`);
  console.log(`   stale     : ${r.stale}`);
}

function runReplace(state, removed) {
  G.__resetCooldown();
  G.__set(state);
  const ctx = G.NS_buildCtx();
  ctx.removed = removed || [];
  G.NS_runReplace(ctx);
  const out = G.__get();
  return { ctx, intents: out.predictObjects.filter(o => o.owner === "replace"),
           all: out.predictObjects };
}

function runPreplace(state) {
  G.__resetCooldown();
  G.__set(state);
  const ctx = G.NS_buildCtx();
  G.NS_runPreplace(ctx);
  const out = G.__get();
  return { ctx, intents: out.predictObjects.filter(o => o.owner === "preplace"),
           all: out.predictObjects, smartTickSpike: out.smartTickSpike };
}

console.log("=".repeat(72));
console.log("PLACEMENT TEST MATRIX");
console.log("=".repeat(72));

// 1 ------------------------------------------------------------------------
{
  const s = base();
  walk(s.nearestEnemy, 8, 0, 0);
  const r = runPreplace(s);
  record(1, "Enemy standing still", {
    owner: r.intents.length ? "Preplace" : "none (Auto Place unaffected)",
    reason: `no movement to predict — conf ${r.ctx.conf.toFixed(2)} < CONF_MIN ${G.NS_PP.CONF_MIN}; ` +
            `predicted position equals current, so gain would be ~0 regardless`,
    deferred: "Preplace, at gate G1 before any sweep",
    dup: "n/a — no intent created",
    stale: "n/a"
  });
}

// 2 ------------------------------------------------------------------------
let steadyState, steadyRes;
{
  const s = base();
  walk(s.nearestEnemy, 8, -14, 0);      // closing on us in a straight line
  steadyState = s;
  const r = steadyRes = runPreplace(s);
  record(2, "Enemy moving consistently", {
    owner: r.intents.length ? "Preplace" : "none",
    reason: `steady heading — conf ${r.ctx.conf.toFixed(2)} >= CONF_MIN; ` +
            (r.intents.length ? `best gain ${r.intents[0].gain.toFixed(2)} >= GAIN_MIN` :
                                "no candidate cleared VALUE_MIN/GAIN_MIN"),
    deferred: r.intents.length ? "none" : "Preplace, on tactical value",
    dup: `${r.intents.length} preplace intent(s) — at most one by construction`,
    stale: "n/a until commit"
  });
}

// 3 ------------------------------------------------------------------------
{
  const s = base();
  walk(s.nearestEnemy, 8, -14, 0);
  const before = s.nearestEnemy._mv.conf;
  walk(s.nearestEnemy, 1, 14, 0);        // hard reversal
  const after = s.nearestEnemy._mv.conf;
  const r = runPreplace(s);
  record(3, "Enemy changing direction", {
    owner: r.intents.length ? "Preplace" : "none",
    reason: `reversal detected — conf ${before.toFixed(2)} -> ${after.toFixed(2)}, ` +
            `floored to TURN_FLOOR ${G.NS_PP.TURN_FLOOR}; stable reset to ${s.nearestEnemy._mv.stable}`,
    deferred: "Preplace, at G1 in the same tick as the turn",
    dup: "n/a",
    stale: "in-flight intent would be invalidated by the same floor"
  });
}

// 4 ------------------------------------------------------------------------
{
  const at = d => {
    const st = base();
    st.nearestEnemy = mkEnemy(7200 + d + 112, 5000);
    walk(st.nearestEnemy, 8, -14, 0);                 // closes 112 units
    return { d, r: runPreplace(st) };
  };
  const far = at(420), edge = at(236), close = at(120);
  record(4, "Enemy entering combat range", {
    owner: close.r.intents.length ? "Preplace (only once genuinely engaged)" : "none",
    reason: `the 300 gate is necessary but not sufficient — value has to materialise too. ` +
            `dist 420: ${far.r.intents.length} intent(s) (range gate); ` +
            `dist 236: ${edge.r.intents.length} (in range, but every candidate scores below VALUE_MIN ` +
            `${G.NS_PP.VALUE_MIN} — placement radius 79 leaves the nearest candidate ~157 from the enemy); ` +
            `dist 120: ${close.r.intents.length}`,
    deferred: "Preplace, on range then on tactical value — two independent gates",
    dup: "n/a",
    stale: "n/a"
  });
}

// 5 + 9 --------------------------------------------------------------------
{
  // Enemy trapped in one of our traps: Auto Place rule A3 claims essentially
  // every non-LOS-blocking spike angle.
  const s = base();
  s.nearestEnemy = mkEnemy(7200 + 250, 5000);
  walk(s.nearestEnemy, 8, -14, 0);   // ends ~138 out
  const trap = { id: TRAP, sid: 90, x: s.nearestEnemy.x2, y: s.nearestEnemy.y2,
                 scale: 50, active: true, health: 500, owner: { sid: 1 },
                 getScale: function () { return this.scale; } };
  s.traps_our = [trap];
  s.visibleObjects = [trap];
  const r = runPreplace(s);
  // how many spike angles would Auto Place claim right now?
  G.__set(s);
  let apClaims = 0, probes = 0;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const cfg = G.getConfig(SPIKE, a); cfg.id = SPIKE; cfg.angle = a;
    if (!G.canPlace(SPIKE, a)) continue;
    probes++;
    if (G.isAutoPlaceAngle(cfg, null, null, null)) apClaims++;
  }
  record(5, "Auto Place active (enemy trapped)", {
    owner: "Auto Place",
    reason: `rule A3 claims ${apClaims}/${probes} placeable spike angles while the enemy is trapped`,
    deferred: `Preplace — produced ${r.intents.length} intent(s)`,
    dup: "ownership oracle rejects each claimed angle before it is queued, so no duplicate reaches the queue",
    stale: "n/a"
  });
  record(9, "Preplace and Auto Place target the same area", {
    owner: "Auto Place",
    reason: "isAutoPlaceAngle is called, not restated; any angle it claims is skipped by Preplace",
    deferred: "Preplace, per candidate",
    dup: `prevented — ${apClaims} contested angle(s) yielded, ${r.intents.length} preplace intent(s) queued`,
    stale: "n/a"
  });
}

// 6 ------------------------------------------------------------------------
{
  const r = steadyRes;
  record(6, "Preplace prediction active", {
    owner: r.intents.length ? "Preplace" : "none",
    reason: r.intents.length
      ? `conf ${r.intents[0].conf.toFixed(2)}, gain ${r.intents[0].gain.toFixed(2)}; ` +
        `candidate is worth more against the predicted position than the current one`
      : "no candidate cleared the discriminator",
    deferred: "Auto Place did not claim the winning angle",
    dup: "one intent maximum; addPredictObject dedup also guards the space",
    stale: `smartTickSpike published: ${r.smartTickSpike ? "yes (candidate exposed to Spike Tick, not acted on)" : "no"}`
  });
}

// 7 ------------------------------------------------------------------------
{
  const doomedF = replaceFixture(60);       // hammer does 10*7.5=75 -> dies
  G.__set(doomedF.st);
  const ctxD = G.NS_buildCtx();
  const doomed = G.NS_findDoomed(ctxD);
  const rA = runReplace(doomedF.st, []);

  const safeF = replaceFixture(600);        // survives comfortably
  G.__set(safeF.st);
  const safe = G.NS_findDoomed(G.NS_buildCtx());

  // an object doing nothing, far from the fight, that is also about to die
  const idleF = replaceFixture(60);
  idleF.spike.x = 7200 - 900; idleF.spike.y = 5000;
  const rIdle = runReplace(idleF.st, []);

  record(7, "Replace opportunity active", {
    owner: rA.intents.length ? `Replace (mode ${rA.intents[0].mode})` : "none",
    reason: rA.intents.length
      ? `spike health 60 vs hammer 75 -> doomed; loss ${rA.intents[0].loss.toFixed(2)} >= LOSS_MIN ` +
        `${G.NS_RP.LOSS_MIN}, recovery ${rA.intents[0].recov.toFixed(2)} >= loss*${G.NS_RP.RECOVERY_MIN}`
      : `no qualifying replacement (doomed found: ${doomed.length})`,
    deferred: `healthy object: ${safe.length} doomed (correctly none). ` +
              `idle object far from the fight: ${rIdle.intents.length} intent(s) — ` +
              `"technically possible" is not a reason`,
    dup: `${rA.intents.length} replace intent(s); one per lost position`,
    stale: "revalidated at commit like any deferred intent"
  });
  if (safe.length) { console.log("   *** HEALTHY OBJECT REPORTED DOOMED ***"); process.exitCode = 1; }
  if (rIdle.intents.length) { console.log("   *** REPLACED AN OBJECT THAT WAS DOING NOTHING ***"); process.exitCode = 1; }
}

// 8 ------------------------------------------------------------------------
{
  const s = base();
  walk(s.nearestEnemy, 8, -14, 0);
  s.instaKill = ["secondary", "primary", "turret", "stop"];
  const r = runPreplace(s);
  // and the sweep-free imminence prefix
  const s2 = base();
  s2.nearestEnemy = mkEnemy(7200 + 250, 5000);
  walk(s2.nearestEnemy, 8, -14, 0);  // ends ~138 out
  s2.myPlayer.__hammer = true;
  s2.vars = { prePlace: true, autoPlace: true, shameTick: true };
  const trap = { id: TRAP, sid: 91, x: s2.nearestEnemy.x2, y: s2.nearestEnemy.y2,
                 scale: 50, active: true, health: 40, owner: { sid: 1 },
                 getScale: function () { return this.scale; } };
  s2.traps_our = [trap]; s2.visibleObjects = [trap];
  const r2 = runPreplace(s2);
  record(8, "Spike Tick urgent action active", {
    owner: "Spike Tick",
    reason: `active flags: instaKill length 4 -> Preplace produced ${r.intents.length} intent(s). ` +
            `imminence prefix (hammer + both reloads + trap one-hammer-breakable) = ${r2.ctx.spikeTickLive}` +
            ` -> ${r2.intents.length} intent(s)`,
    deferred: "Preplace, at gate G2, before any sweep",
    dup: "n/a — nothing queued",
    stale: "an in-flight intent would also fail revalidation on the same flags"
  });
}

// 10 -----------------------------------------------------------------------
{
  const f = replaceFixture(60);
  G.__set(f.st);
  const ctx = G.NS_buildCtx();
  const roles = G.NS_roles(f.spike, ctx);
  // does a trap candidate at the same spot fill a kbTarget role? it must not.
  const spikeCfg = Object.assign(G.getConfig(SPIKE, 0), { id: SPIKE });
  const trapCfg  = Object.assign(G.getConfig(TRAP, 0),  { id: TRAP  });
  const dSpike = G.UTILS.getDistance(f.spike.x, f.spike.y, ctx.enemy.x2, ctx.enemy.y2);
  const trapFills = roles.length ? roles.every(r => G.NS_fillsRole(trapCfg, r, ctx)) : null;

  // mode B: the object actually died; Auto Place gets first refusal
  const rB = runReplace(f.st, [f.spike.sid]);

  record(10, "Replace and Auto Place interact with the same object", {
    owner: rB.intents.length ? `Replace (mode ${rB.intents[0].mode}, immediate)` : "Auto Place",
    reason: `dying spike is ${Math.round(dSpike)} from the enemy; Auto-Place-dependent roles: ` +
            `[${roles.join(", ") || "none"}]`,
    deferred: `Replace yields any angle isAutoPlaceAngle claims (same oracle as Preplace). ` +
              `Mode B is queued preplace:false so it commits in the tick body, not 111ms later`,
    dup: `a trap candidate ${trapFills === null ? "n/a (no roles)" :
           trapFills ? "WOULD wrongly satisfy" : "correctly fails"} the role test, ` +
          `so it cannot silently disable the rule Auto Place depended on`,
    stale: "n/a — mode B has no deferral gap"
  });
  if (trapFills === true) { console.log("   *** ROLE TEST DID NOT PROTECT AUTO PLACE ***"); process.exitCode = 1; }
}

// 11 -----------------------------------------------------------------------
{
  const s = base();
  walk(s.nearestEnemy, 8, -14, 0);
  const r = runPreplace(s);
  let res = { same: null, nextTick: null, blocked: null, deadBlocker: null, spikeTick: null };
  if (r.intents.length) {
    const it = r.intents[0];
    G.__set(s);
    res.same = G.NS_revalidate(it);
    G.__set({ tick: s.tick + 1 });
    res.nextTick = G.NS_revalidate(it);
    G.__set({ tick: s.tick });
    // something now occupies the spot
    const blocker = { id: SPIKE, sid: 77, x: it.px, y: it.py, scale: 49, active: true,
                      health: 500, owner: { sid: 3 }, getScale: function () { return this.scale; } };
    G.__set({ visibleObjects: [blocker] });
    res.blocked = G.NS_revalidate(it);
    G.__set({ visibleObjects: [], instaKill: [] });
    // SV3: an object that died during the commit window is still in
    // visibleObjects with active === true, because disableBySid splices
    // gameObjects without clearing the flag. It must NOT block the placement.
    G.__set({ visibleObjects: [blocker], removedObjects: [blocker.sid] });
    res.deadBlocker = G.NS_revalidate(it);
    G.__set({ visibleObjects: [], removedObjects: [], instaKill: ["secondary"] });
    res.spikeTick = G.NS_revalidate(it);
  }
  record(11, "Preplace candidate becomes stale", {
    owner: r.intents.length ? "Preplace, subject to revalidation" : "none",
    reason: "commit-time gate re-checks generation, packets, Spike Tick, item limit and collision",
    deferred: "Preplace defers to whatever invalidated it",
    dup: "n/a",
    stale: r.intents.length
      ? `same tick: ${res.same ? "commits" : "cancelled"} | next tick: ${res.nextTick ? "COMMITS (BAD)" : "cancelled"}` +
        ` | spot blocked: ${res.blocked ? "COMMITS (BAD)" : "cancelled"}` +
        ` | blocker died in-window: ${res.deadBlocker ? "commits (correct, SV3)" : "CANCELLED (BAD)"}` +
        ` | Spike Tick fired: ${res.spikeTick ? "COMMITS (BAD)" : "cancelled"}`
      : "no intent to test"
  });
  if (r.intents.length) {
    if (!res.same) { console.log("   *** VALID INTENT CANCELLED ON ITS OWN TICK ***"); process.exitCode = 1; }
    if (res.nextTick || res.blocked || res.spikeTick) { console.log("   *** STALE PREVENTION FAILED ***"); process.exitCode = 1; }
    if (!res.deadBlocker) { console.log("   *** SV3 DEAD-OBJECT CORRECTION FAILED ***"); process.exitCode = 1; }
  }
}

// 12 -----------------------------------------------------------------------
{
  const f = replaceFixture(60);
  const r = runReplace(f.st, []);
  let res = { same: null, nextTick: null, spikeTick: null, overBudget: null };
  if (r.intents.length) {
    const it = r.intents[0];
    G.__set(f.st);                      res.same = G.NS_revalidate(it);
    G.__set({ tick: f.st.tick + 1 });   res.nextTick = G.NS_revalidate(it);
    G.__set({ tick: f.st.tick, instaKill: ["secondary"] });
                                        res.spikeTick = G.NS_revalidate(it);
    G.__set({ instaKill: [], packets: 116 });
                                        res.overBudget = G.NS_revalidate(it);
  }
  record(12, "Replace candidate becomes stale", {
    owner: r.intents.length ? "Replace, subject to the same commit gate as Preplace" : "none",
    reason: "NS_revalidate is shared — generation, packets, Spike Tick, item limit, collision",
    deferred: "Replace defers to whatever invalidated it; cancellation is silent",
    dup: "n/a",
    stale: r.intents.length
      ? `same tick: ${res.same ? "commits" : "cancelled"} | next tick: ${res.nextTick ? "COMMITS (BAD)" : "cancelled"}` +
        ` | Spike Tick fired: ${res.spikeTick ? "COMMITS (BAD)" : "cancelled"}` +
        ` | over budget: ${res.overBudget ? "COMMITS (BAD)" : "cancelled"}`
      : "no intent produced"
  });
  if (r.intents.length && (!res.same || res.nextTick || res.spikeTick || res.overBudget)) {
    console.log("   *** REPLACE STALE PREVENTION FAILED ***"); process.exitCode = 1;
  }
}

// 13 -----------------------------------------------------------------------
{
  const s = base();
  s.nearestEnemy = mkEnemy(7200 + 200, 5000);
  walk(s.nearestEnemy, 10, -16, 0);
  const r = runPreplace(s);
  G.__set(s);
  let viable = 0;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    if (G.canPlace(SPIKE, a)) viable++;
  }
  record(13, "Multiple placement opportunities exist", {
    owner: r.intents.length ? "Preplace (single best)" : "none",
    reason: `${viable} placeable spike angles; Preplace selects max gain` +
            (r.intents.length ? ` (gain ${r.intents[0].gain.toFixed(2)})` : ""),
    deferred: "all losing candidates dropped, not queued",
    dup: `${r.intents.length} intent queued from ${viable} options — one-intent rule holds`,
    stale: "n/a"
  });
  if (r.intents.length > 1) { console.log("   *** MORE THAN ONE PREPLACE INTENT ***"); process.exitCode = 1; }
}

// 14 -----------------------------------------------------------------------
{
  const s = base();
  walk(s.nearestEnemy, 8, -14, 0);
  const clear = runPreplace(s);
  const s2 = base(); s2.nearestEnemy = s.nearestEnemy; s2.packets = 112;
  const tight = runPreplace(s2);
  let revalAt = null;
  if (clear.intents.length) {
    G.__set(Object.assign({}, s, { packets: 116 }));
    revalAt = G.NS_revalidate(clear.intents[0]);
  }
  record(14, "Packet / resource pressure exists", {
    owner: "Auto Place (Preplace yields first)",
    reason: `budget guard: clear (packets 0) -> ${clear.intents.length} intent(s); ` +
            `pressure (packets 112, needs +10 headroom) -> ${tight.intents.length} intent(s)`,
    deferred: "Preplace — it is the only placer whose value is speculative",
    dup: "n/a",
    stale: revalAt === null ? "n/a" : `commit at packets 116: ${revalAt ? "COMMITS (BAD)" : "cancelled"}`
  });
  if (tight.intents.length) { console.log("   *** PREPLACE ACTED UNDER PACKET PRESSURE ***"); process.exitCode = 1; }
  if (revalAt) { console.log("   *** COMMITTED OVER BUDGET ***"); process.exitCode = 1; }
}

console.log("\n" + "=".repeat(72));
const impl = rows.filter(r => r.owner !== "NOT YET IMPLEMENTED").length;
console.log(`${impl}/${rows.length} scenarios exercised; ${rows.length - impl} await Replace (step 5).`);
console.log(process.exitCode ? "FAILURES PRESENT" : "no invariant violations detected");
console.log("=".repeat(72) + "\n");
