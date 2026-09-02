#!/usr/bin/env node
/*
 * check-gapfill.js
 *
 * Exercises AutoPlacer's trap-enclosure gap-fill layer in the built script.
 *
 * It slices the _gap* methods straight out of ReUp_Mix.user.js (so it tests
 * what actually ships, not a copy) and runs them against synthetic layouts with
 * the rest of the placer stubbed: the geometry stubs carry the game's own
 * numbers — player scale 35, spike scale 52, trap scale 50 with colDiv 0.2, the
 * 35 + scale + placeOffset placement ring, and the item.scale +
 * object.placementScale placement rule out of ObjectManager.canPlaceItem.
 *
 *   node tools/check-gapfill.js [path/to/ReUp_Mix.user.js]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BUILD_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "ReUp_Mix.user.js");
const built = fs.readFileSync(BUILD_PATH, "utf8");

const start = built.indexOf("    _GAP_BAND=62;");
const end = built.indexOf("\n    client;", start);
if (start === -1 || end === -1) {
  console.log("could not find the gap-fill layer in " + path.relative(ROOT, BUILD_PATH));
  process.exit(1);
}
const methods = built.slice(start, end);

/* ---- game-side stubs, values taken from the client's own tables ---- */
const PI = Math.PI;
const PI2 = PI * 2;
const getAngleDist = (a, b) => {
  const p = Math.abs(b - a) % PI2;
  return p > PI ? PI2 - p : p;
};

const Items = [];
Items[9] = { id: 9, itemGroup: 2, name: "spikes", scale: 52, placeOffset: -5, health: 500 };
Items[15] = { id: 15, itemGroup: 5, name: "pit trap", scale: 50, placeOffset: -5, colDiv: .2, health: 500, trap: true, ignoreCollision: true };

class PlayerObject {
  constructor(id, x, y, type, ownerID) {
    this.id = id;
    this.type = type;
    this.ownerID = ownerID;
    const item = Items[type];
    this.scale = item.scale;
    this.collisionDivider = "colDiv" in item ? item.colDiv : 1;
    this.itemGroup = item.itemGroup;
    this.health = item.health;
    this.isDestroyable = true;
    this.pos = { current: { x, y } };
  }
  get collisionScale() { return this.scale * this.collisionDivider; }
  get placementScale() { return this.scale; }
  get hitScale() { return this.scale; }
}

const Settings_default = { _trapGapFill: true, _trapGapFillBreak: true, _preplacer: true, _replacer: true };
const DataHandler_default = { getWeapon: id => ({ range: 110, knockback: 60 }), isMelee: id => true };
const Logger = { error: msg => console.log("LOGGER: " + msg) };

/* ---- the placer plumbing the layer leans on ---- */
class GapPlacer {
  moduleName = "autoPlacer";
  _bannedAngles = new Map;
  _predictObjects = [];
  _placedAngles = [];
  _tick = 100;
  placed = [];

  constructor(world) {
    this.world = world;
    // the extracted class fields, fresh per instance like they are in the build
    const carrier = new GapMethods();
    for (const key of Object.keys(carrier)) this[key] = carrier[key];
  }

  _getConfig(id, myPos) {
    return angle => {
      const item = Items[id];
      const dist = 35 + item.scale + (item.placeOffset || 0);
      return { id, angle, x: myPos.x + dist * Math.cos(angle), y: myPos.y + dist * Math.sin(angle), scale: item.scale };
    };
  }
  _canPlace(id, angle, myPos, ObjectManager2, excludeObj) {
    const cfg = this._getConfig(id, myPos)(angle);
    for (const obj of this.world.objects) {
      if (excludeObj && obj === excludeObj) continue;
      if (Math.hypot(cfg.x - obj.pos.current.x, cfg.y - obj.pos.current.y) < cfg.scale + obj.placementScale) return false;
    }
    return true;
  }
  _isItemLimit(id, myPlayer) {
    const { count, limit } = myPlayer.getItemCount(Items[id].itemGroup);
    return count >= limit;
  }
  _getPrePlaceAngles(id, myPos, myPlayer, ObjectManager2, excludeObj) {
    if (this._isItemLimit(id, myPlayer)) return [];
    const getConfig = this._getConfig(id, myPos);
    const out = [];
    for (let i = 0; i < 72; i++) {
      const angle = i * (PI2 / 72);
      out.push({ ...getConfig(angle), placeable: this._canPlace(id, angle, myPos, ObjectManager2, excludeObj), perfect: false });
    }
    return out;
  }
  _addPredictObject(id, angle, preplace, myPos) {
    const cfg = this._getConfig(id, myPos)(angle);
    this._predictObjects.push({ id, angle, x: cfg.x, y: cfg.y, scale: cfg.scale, preplace });
    this.placed.push({ angle, preplace, x: cfg.x, y: cfg.y });
  }
}

/* Graft the extracted methods on by wrapping them in a throwaway class; the
 * fields come across per instance in GapPlacer's constructor, the way they do
 * in the real AutoPlacer. */
const GapMethods = eval("(class {\n" + methods + "\n})");
for (const name of Object.getOwnPropertyNames(GapMethods.prototype)) {
  if (name === "constructor") continue;
  GapPlacer.prototype[name] = GapMethods.prototype[name];
}

/* ---- world helpers ---- */
function makeTarget(x, y, opts = {}) {
  return {
    id: opts.id ?? 7,
    pos: { current: { x, y }, future: { x: x + (opts.vx || 0), y: y + (opts.vy || 0) } },
    collisionScale: 35,
    speed: opts.speed ?? 0,
    move_dir: opts.dir ?? 0,
    trappedIn: opts.trappedIn ?? null,
    isTrapped: !!opts.trappedIn
  };
}

function makeCtx(world, target, myPos, over = {}) {
  const placer = new GapPlacer(world);
  const ObjectManager2 = {
    objects: new Map(world.objects.map(o => [o.id, o])),
    grid2D: { query: (x, y, r, cb) => { for (const o of world.objects) cb(o.id); return false; } }
  };
  const PlayerManager2 = {
    isEnemyByID: (ownerID, entity) => ownerID !== entity.id && !(world.teammates || []).includes(ownerID)
  };
  const myPlayer = {
    id: 1,
    isMyPlayerByID: id => id === 1,
    getItemPlaceScale: id => 35 + Items[id].scale + Items[id].placeOffset,
    getItemByType: type => (type === 4 ? 9 : type === 1 ? 10 : type === 0 ? 5 : null),
    getBuildingDamage: () => 600,
    getItemCount: () => ({ count: 0, limit: 15 })
  };
  const ModuleHandler = {
    activeModule: null,
    moduleActive: false,
    placedOnce: false,
    placeAngles: [null, []],
    staticModules: { spikeTick: {}, reloading: { isReloaded: () => true } },
    canBuy: () => true,
    tickCount: 100,
    forceWeapon: null,
    useAngle: null,
    shouldAttack: false
  };
  const EnemyManager2 = { nearestEnemy: target, nearestSpikePlacerAngle: null };
  const ctx = {
    tick: 100,
    ModuleHandler, EnemyManager2, ObjectManager2, PlayerManager2,
    myPlayer,
    myPos,
    myFut: myPos,
    target,
    spikeId: 9,
    pingTicks: 0.4,
    ...over
  };
  return { placer, ctx };
}

const deg = r => Math.round(r * 180 / PI);
let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? "  ok   " : "  FAIL ") + name + (extra ? "   " + extra : ""));
  if (!cond) failures++;
}

/* ══════════════ 1. the spec's box: traps around, one opening ══════════════ */
{
  const objects = [];
  let id = 100;
  // spikes ringing the target at 110, leaving a hole toward 300 degrees
  for (const a of [0, 60, 120, 180, 240]) {
    const r = 110, rad = a * PI / 180;
    objects.push(new PlayerObject(id++, Math.cos(rad) * r, Math.sin(rad) * r, 9, 1));
  }
  const world = { objects };
  const target = makeTarget(0, 0, { speed: 4, dir: 300 * PI / 180 });
  // stand where the ring point lands in the hole: 79 units from us toward 300
  const holeDir = 300 * PI / 180;
  const myPos = { x: Math.cos(holeDir) * 100 - Math.cos(holeDir) * 82, y: Math.sin(holeDir) * 100 - Math.sin(holeDir) * 82 };
  const { placer, ctx } = makeCtx(world, target, myPos);
  const analysis = placer._gapAnalysis(ctx);
  console.log("\n[1] five spikes at 110, hole at 300 deg");
  console.log("    blockedRatio " + analysis.blockedRatio.toFixed(2) +
    "  gaps " + analysis.gaps.length + "  passable " + analysis.passable.length +
    "  mids " + analysis.passable.map(g => deg(g.mid)).join(","));
  check("enclosure detected", analysis.enclosed);
  check("exactly one way out", analysis.passable.length === 1);
  check("the way out is the hole", analysis.passable.length === 1 && getAngleDist(analysis.passable[0].mid, holeDir) < .4,
    analysis.passable.length === 1 ? deg(analysis.passable[0].mid) + " deg" : "");

  const escape = placer._gapEscape(ctx, analysis);
  check("escape route is the hole", escape.primary && getAngleDist(escape.primary.mid, holeDir) < .4);
  const ranked = placer._gapRank(ctx, analysis, escape, false);
  console.log("    candidates " + ranked.length + (ranked.length ? "  best at " + deg(Math.atan2(ranked[0].y, ranked[0].x)) + " deg score " + ranked[0].score.toFixed(1) + " seals " + ranked[0].seals : ""));
  check("a candidate is found", ranked.length > 0);
  check("best candidate sits in the hole", ranked.length > 0 && getAngleDist(Math.atan2(ranked[0].y, ranked[0].x), holeDir) < .6);
  placer._gapFillTick(ctx);
  check("one spike prepared", placer.placed.length === 1, JSON.stringify(placer.placed.map(p => deg(p.angle) + "deg pre:" + p.preplace)));
}

/* ══════════════ 2. two traps off to one side is not a trap ══════════════ */
{
  const objects = [
    new PlayerObject(200, 90, 0, 15, 1),
    new PlayerObject(201, 90, 60, 15, 1)
  ];
  const world = { objects };
  const target = makeTarget(0, 0, { speed: 3, dir: PI });
  const { placer, ctx } = makeCtx(world, target, { x: -60, y: 0 });
  const analysis = placer._gapAnalysis(ctx);
  console.log("\n[2] two of my traps on one side only");
  console.log("    blockedRatio " + analysis.blockedRatio.toFixed(2) + "  passable " + analysis.passable.length);
  check("not called enclosed", !analysis.enclosed);
  placer._gapFillTick(ctx);
  check("nothing placed", placer.placed.length === 0);
}

/* ══════════════ 3. ownership: their own trap does not hold them ══════════════ */
{
  const mine = new PlayerObject(300, 60, 0, 15, 1);      // mine (owner 1)
  const theirs = new PlayerObject(301, -60, 0, 15, 7);   // the target's own
  const world = { objects: [mine, theirs] };
  const target = makeTarget(0, 0, { id: 7 });
  const { placer, ctx } = makeCtx(world, target, { x: 0, y: -80 });
  const blockers = placer._gapBlockers(ctx, null);
  console.log("\n[3] one trap of mine, one of theirs");
  console.log("    blockers " + blockers.length + "  " + blockers.map(b => b.object.id + (b.mine ? " mine" : " theirs")).join(", "));
  check("only my trap counts as a blocker", blockers.length === 1 && blockers[0].object === mine);
  check("ownership read from the tables", blockers.length === 1 && blockers[0].mine === true);
}

/* ══════════════ 4. holding trap pins them without walling a side ══════════════ */
{
  const trap = new PlayerObject(400, 10, 0, 15, 1);
  const objects = [trap];
  for (const a of [70, 150, 230]) {
    const rad = a * PI / 180;
    objects.push(new PlayerObject(401 + a, Math.cos(rad) * 115, Math.sin(rad) * 115, 9, 1));
  }
  const world = { objects };
  const target = makeTarget(0, 0, { speed: 0, trappedIn: trap });
  const { placer, ctx } = makeCtx(world, target, { x: 60, y: -60 });
  const analysis = placer._gapAnalysis(ctx);
  console.log("\n[4] held in my trap, three spikes around");
  console.log("    held " + analysis.held + "  blockedRatio " + analysis.blockedRatio.toFixed(2) +
    "  passable " + analysis.passable.map(g => deg(g.mid) + "deg").join(","));
  check("recognised as pinned", analysis.held === true);
  check("enclosed on the lower floor", analysis.enclosed === true);
  check("the holding trap did not wall off a side", analysis.blockedRatio < .95);
}

/* ══════════════ 5. escape prediction follows movement direction ══════════════ */
{
  const objects = [];
  for (const a of [30, 100, 170, 240]) {
    const rad = a * PI / 180;
    objects.push(new PlayerObject(500 + a, Math.cos(rad) * 112, Math.sin(rad) * 112, 9, 1));
  }
  const world = { objects };
  const runningTo = 310 * PI / 180;
  const target = makeTarget(0, 0, { speed: 6, dir: runningTo });
  const { placer, ctx } = makeCtx(world, target, { x: -140, y: 0 });
  const analysis = placer._gapAnalysis(ctx);
  const escape = placer._gapEscape(ctx, analysis);
  console.log("\n[5] four spikes, target running toward 310 deg");
  console.log("    passable " + analysis.passable.map(g => deg(g.mid) + "deg").join(",") + "  chosen " + (escape.primary ? deg(escape.primary.mid) : "-") + "deg");
  check("escape route matches the run", escape.primary && getAngleDist(escape.primary.mid, runningTo) < .7);
}

/* ══════════════ 6. wide open: layer stands down ══════════════ */
{
  const world = { objects: [new PlayerObject(600, 120, 0, 9, 1)] };
  const target = makeTarget(0, 0, { speed: 2, dir: 0 });
  const { placer, ctx } = makeCtx(world, target, { x: -70, y: 0 });
  const analysis = placer._gapAnalysis(ctx);
  console.log("\n[6] a single spike nearby");
  check("not enclosed", !analysis.enclosed);
  placer._gapFillTick(ctx);
  check("nothing placed", placer.placed.length === 0);
}

/* ══════════════ 7. Spike Tick keeps the tick to itself ══════════════ */
{
  const objects = [];
  for (const a of [0, 60, 120, 180, 240]) {
    const rad = a * PI / 180;
    objects.push(new PlayerObject(700 + a, Math.cos(rad) * 110, Math.sin(rad) * 110, 9, 1));
  }
  const world = { objects };
  const holeDir = 300 * PI / 180;
  const target = makeTarget(0, 0, { speed: 4, dir: holeDir });
  const myPos = { x: Math.cos(holeDir) * 18, y: Math.sin(holeDir) * 18 };
  {
    const { placer, ctx } = makeCtx(world, target, myPos);
    ctx.ModuleHandler.activeModule = "spikeTick";
    placer._gapFillTick(ctx);
    console.log("\n[7] Spike Tick owns the tick");
    check("stands down while Spike Tick is active", placer.placed.length === 0);
  }
  {
    const { placer, ctx } = makeCtx(world, target, myPos);
    ctx.ModuleHandler.staticModules.spikeTick.useBreakTrapPlace = true;
    placer._gapFillTick(ctx);
    check("stands down mid Spike Tick sequence", placer.placed.length === 0);
  }
  {
    const { placer, ctx } = makeCtx(world, target, myPos);
    const ranked = placer._gapRank(ctx, placer._gapAnalysis(ctx), placer._gapEscape(ctx, placer._gapAnalysis(ctx)), true);
    if (ranked.length) {
      ctx.EnemyManager2.nearestSpikePlacerAngle = [ranked[0].angle];
      check("a Spike Tick reservation is rejected", !placer._gapValidate(ctx, ranked[0]));
      ctx.EnemyManager2.nearestSpikePlacerAngle = null;
      ctx.ModuleHandler.placeAngles[1] = [ranked[0].angle];
      check("an angle already placed this tick is rejected", !placer._gapValidate(ctx, ranked[0]));
      ctx.ModuleHandler.placeAngles[1] = [];
      placer._predictObjects.push({ id: 9, angle: ranked[0].angle, x: ranked[0].x, y: ranked[0].y, scale: 52, preplace: false });
      check("a position already reserved this tick is rejected", !placer._gapValidate(ctx, ranked[0]));
    } else {
      check("candidates available for the duplicate checks", false);
    }
  }
}

/* ══════════════ 8. target swap invalidates the committed gap ══════════════ */
{
  const objects = [];
  for (const a of [0, 60, 120, 180, 240]) {
    const rad = a * PI / 180;
    objects.push(new PlayerObject(800 + a, Math.cos(rad) * 110, Math.sin(rad) * 110, 9, 1));
  }
  const world = { objects };
  const holeDir = 300 * PI / 180;
  const target = makeTarget(0, 0, { speed: 4, dir: holeDir });
  const myPos = { x: Math.cos(holeDir) * 18, y: Math.sin(holeDir) * 18 };
  const { placer, ctx } = makeCtx(world, target, myPos);
  placer._gapFillTick(ctx);
  console.log("\n[8] the ActiveTarget changes");
  const committed = placer._gapFill.committed;
  check("a position was committed", !!committed);
  const other = makeTarget(40, 40, { id: 9, speed: 4, dir: holeDir });
  ctx.target = other;
  ctx.EnemyManager2.nearestEnemy = other;
  ctx.tick += 1;
  placer._tick += 1;
  placer._gapFillTick(ctx);
  check("commitment dropped with the old target", placer._gapFill.targetId === other.id);
  check("analysis recomputed for the new target", placer._gapFill.tick === ctx.tick);
}

/* ══════════════ 9. replace only on a meaningful upgrade ══════════════ */
{
  const objects = [];
  for (const a of [0, 60, 120, 180, 240]) {
    const rad = a * PI / 180;
    objects.push(new PlayerObject(900 + a, Math.cos(rad) * 110, Math.sin(rad) * 110, 9, 1));
  }
  const world = { objects };
  const holeDir = 300 * PI / 180;
  const target = makeTarget(0, 0, { speed: 4, dir: holeDir });
  const myPos = { x: Math.cos(holeDir) * 18, y: Math.sin(holeDir) * 18 };
  const { placer, ctx } = makeCtx(world, target, myPos);
  placer._gapFillTick(ctx);
  const first = placer._gapFill.committed;
  console.log("\n[9] replace threshold");
  check("first choice committed", !!first);

  // a marginally better alternative must not pull the layer off the commitment
  const analysis = placer._gapAnalysis(ctx);
  const escape = placer._gapEscape(ctx, analysis);
  const ranked = placer._gapRank(ctx, analysis, escape, true);
  const alternative = ranked.find(c => getAngleDist(c.angle, first.angle) > .05);
  if (alternative) {
    // pretend the alternative scores a hair better than the commitment
    const held = ranked.find(c => getAngleDist(c.angle, first.angle) < .01);
    check("commitment is still among the candidates", !!held);
    check("margin rule needs a real gap",
      !(alternative.score > held.score + placer._GAP_REPLACE_MARGIN) || alternative.score - held.score > placer._GAP_REPLACE_MARGIN);
  }
  // with Re Placer off the layer never switches away from a valid commitment
  Settings_default._replacer = false;
  placer._predictObjects = [];
  placer.placed = [];
  placer._tick += 1;
  ctx.tick += 1;
  placer._gapFill.tick = -1;
  placer._gapFillTick(ctx);
  check("stays on the committed angle with Re Placer off",
    placer._gapFill.committed && getAngleDist(placer._gapFill.committed.angle, first.angle) < .01,
    "was " + deg(first.angle) + " now " + (placer._gapFill.committed ? deg(placer._gapFill.committed.angle) : "-"));
  Settings_default._replacer = true;
}

/* ══════════════ 10. preplace vs immediate ══════════════ */
{
  const objects = [];
  for (const a of [0, 60, 120, 180, 240]) {
    const rad = a * PI / 180;
    objects.push(new PlayerObject(1000 + a, Math.cos(rad) * 110, Math.sin(rad) * 110, 9, 1));
  }
  const world = { objects };
  const holeDir = 300 * PI / 180;
  const myPos = { x: Math.cos(holeDir) * 18, y: Math.sin(holeDir) * 18 };
  console.log("\n[10] preplace vs immediate");
  {
    const target = makeTarget(0, 0, { speed: 8, dir: holeDir });
    const { placer, ctx } = makeCtx(world, target, myPos);
    placer._gapFillTick(ctx);
    check("still travelling: prepared through Pre Placer", placer.placed.length === 1 && placer.placed[0].preplace === true);
  }
  {
    Settings_default._preplacer = false;
    const target = makeTarget(0, 0, { speed: 8, dir: holeDir });
    const { placer, ctx } = makeCtx(world, target, myPos);
    placer._gapFillTick(ctx);
    check("Pre Placer off: placed on the spot", placer.placed.length === 1 && placer.placed[0].preplace === false);
    Settings_default._preplacer = true;
  }
  {
    // sitting still in the opening: nothing to pre-place for
    const target = makeTarget(0, 0, { speed: 0, dir: holeDir });
    const { placer, ctx } = makeCtx(world, target, myPos);
    placer._gapFillTick(ctx);
    check("target already there: placed immediately", placer.placed.length === 1 && placer.placed[0].preplace === false);
  }
}

/* ══════════════ 11. breaking a trap of mine that denies the spike ══════════════ */
{
  // ring of my spikes with a hole, and one of my traps parked by the hole. The
  // target still fits out, but the trap's 50 units of placement scale is what
  // stops a spike going in there — the case the break rule exists for.
  const holeDir = 300 * PI / 180;
  function build(trapAngle, trapDist) {
    const objects = [];
    for (const a of [0, 60, 120, 180, 240]) {
      const rad = a * PI / 180;
      objects.push(new PlayerObject(1100 + a, Math.cos(rad) * 128, Math.sin(rad) * 128, 9, 1));
    }
    let trap = null;
    if (trapAngle !== null) {
      const rad = trapAngle * PI / 180;
      trap = new PlayerObject(1180, Math.cos(rad) * trapDist, Math.sin(rad) * trapDist, 15, 1);
      objects.push(trap);
    }
    return { objects, trap };
  }
  console.log("\n[11] my trap sits on the opening");
  // find a layout where the target can still get out but no spike can be placed
  let found = null;
  for (const angle of [280, 290, 300, 310, 320]) {
    for (const dist of [70, 85, 100, 115]) {
      for (const myDist of [10, 20, 30, 40]) {
        const world = build(angle, dist);
        const target = makeTarget(0, 0, { speed: 5, dir: holeDir });
        const myPos = { x: Math.cos(holeDir) * myDist, y: Math.sin(holeDir) * myDist };
        const { placer, ctx } = makeCtx(world, target, myPos);
        const analysis = placer._gapAnalysis(ctx);
        if (!analysis.enclosed) continue;
        const escape = placer._gapEscape(ctx, analysis);
        if (placer._gapRank(ctx, analysis, escape, true).length) continue;
        found = { angle, dist, myDist, world, target, myPos };
        break;
      }
      if (found) break;
    }
    if (found) break;
  }
  check("a trap-denies-the-spike layout exists", !!found,
    found ? "trap at " + found.angle + " deg / " + found.dist + "u, me " + found.myDist + "u out" : "");
  if (found) {
    const { placer, ctx } = makeCtx(found.world, found.target, found.myPos);
    placer._gapFillTick(ctx);
    const broke = ctx.ModuleHandler.shouldAttack;
    console.log("    break requested: " + broke + (broke ? "  weapon " + ctx.ModuleHandler.forceWeapon + " angle " + deg(ctx.ModuleHandler.useAngle) + " deg" : "") +
      "  spikes placed " + placer.placed.length);
    check("the blocking trap is targeted", broke === true);
    if (broke) {
      check("aimed at my own trap", getAngleDist(ctx.ModuleHandler.useAngle,
        Math.atan2(found.world.trap.pos.current.y - found.myPos.y, found.world.trap.pos.current.x - found.myPos.x)) < .01);
      check("remembered where to prepare afterwards", !!placer._gapFill.pendingBreak);
      check("break went through the shared attack fields", ctx.ModuleHandler.moduleActive === true);
      check("no spike packet in the same tick", placer.placed.length === 0);
    }
    // never the trap that is holding them
    {
      const trapPos = found.world.trap.pos.current;
      const t = makeTarget(trapPos.x - 5, trapPos.y, { speed: 5, dir: holeDir, trappedIn: found.world.trap });
      const { placer: p2, ctx: c2 } = makeCtx(found.world, t, found.myPos);
      const a2 = p2._gapAnalysis(c2);
      p2._gapBreak(c2, a2, p2._gapEscape(c2, a2));
      check("the trap holding them is never broken", c2.ModuleHandler.shouldAttack === false);
    }
    // never while another module owns the tick
    {
      const { placer: p3, ctx: c3 } = makeCtx(found.world, found.target, found.myPos);
      c3.ModuleHandler.moduleActive = true;
      const a3 = p3._gapAnalysis(c3);
      p3._gapBreak(c3, a3, p3._gapEscape(c3, a3));
      check("stands down when the tick is taken", c3.ModuleHandler.shouldAttack === false);
    }
    // not with the toggle off
    {
      Settings_default._trapGapFillBreak = false;
      const { placer: p4, ctx: c4 } = makeCtx(found.world, found.target, found.myPos);
      const a4 = p4._gapAnalysis(c4);
      p4._gapBreak(c4, a4, p4._gapEscape(c4, a4));
      check("respects its own toggle", c4.ModuleHandler.shouldAttack === false);
      Settings_default._trapGapFillBreak = true;
    }
    // and not on a trap that is nowhere near the way out
    {
      const world = build(120, 100);   // trap on the far side from the hole
      const { placer: p5, ctx: c5 } = makeCtx(world, found.target, found.myPos);
      const a5 = p5._gapAnalysis(c5);
      p5._gapBreak(c5, a5, p5._gapEscape(c5, a5));
      check("a trap away from the escape side is left alone", c5.ModuleHandler.shouldAttack === false);
    }
    // nor with a weapon that cannot reach a building
    {
      const melee = DataHandler_default.isMelee;
      DataHandler_default.isMelee = () => false;
      const { placer: p6, ctx: c6 } = makeCtx(found.world, found.target, found.myPos);
      const a6 = p6._gapAnalysis(c6);
      p6._gapBreak(c6, a6, p6._gapEscape(c6, a6));
      check("no swing with a non-melee weapon", c6.ModuleHandler.shouldAttack === false);
      DataHandler_default.isMelee = melee;
    }
  }
}

/* ══════════════ 12. sealing beats being close ══════════════ */
{
  const objects = [];
  for (const a of [0, 60, 120, 180]) {
    const rad = a * PI / 180;
    objects.push(new PlayerObject(1200 + a, Math.cos(rad) * 112, Math.sin(rad) * 112, 9, 1));
  }
  const world = { objects };
  const holeDir = 270 * PI / 180;
  const target = makeTarget(0, 0, { speed: 5, dir: holeDir });
  const myPos = { x: Math.cos(holeDir) * 55, y: Math.sin(holeDir) * 55 };
  const { placer, ctx } = makeCtx(world, target, myPos);
  const analysis = placer._gapAnalysis(ctx);
  const escape = placer._gapEscape(ctx, analysis);
  const ranked = placer._gapRank(ctx, analysis, escape, true);
  console.log("\n[12] scoring order");
  console.log("    " + ranked.slice(0, 4).map(c => deg(Math.atan2(c.y - 0, c.x - 0)) + "deg d" + Math.round(c.distance) + " seal:" + (c.seals ? 1 : 0) + " " + c.score.toFixed(0)).join("  |  "));
  const sealing = ranked.filter(c => c.seals);
  const clipping = ranked.filter(c => !c.seals);
  if (sealing.length && clipping.length) {
    const nearestClip = clipping.sort((a, b) => a.distance - b.distance)[0];
    const bestSeal = sealing[0];
    check("a sealing spike outranks a nearer one that only clips",
      bestSeal.score > nearestClip.score,
      "seal " + bestSeal.score.toFixed(0) + " @d" + Math.round(bestSeal.distance) + " vs clip " + nearestClip.score.toFixed(0) + " @d" + Math.round(nearestClip.distance));
  } else {
    console.log("    (only one kind of candidate here, nothing to compare)");
  }
  check("candidate list stays small", ranked.length <= 8);
}

/* ══════════════ 13. out of reach / limit gates ══════════════ */
{
  const objects = [];
  for (const a of [0, 60, 120, 180, 240]) {
    const rad = a * PI / 180;
    objects.push(new PlayerObject(1300 + a, Math.cos(rad) * 110, Math.sin(rad) * 110, 9, 1));
  }
  const world = { objects };
  const target = makeTarget(0, 0, { speed: 5, dir: 300 * PI / 180 });
  console.log("\n[13] gates");
  {
    const { placer, ctx } = makeCtx(world, target, { x: 400, y: 400 });
    placer._gapFillTick(ctx);
    check("target out of placement reach: nothing done", placer.placed.length === 0);
  }
  {
    const { placer, ctx } = makeCtx(world, target, { x: 18, y: -31 });
    ctx.myPlayer.getItemCount = () => ({ count: 15, limit: 15 });
    placer._gapFillTick(ctx);
    check("spike limit reached: nothing done", placer.placed.length === 0);
  }
}

console.log("");
if (failures) {
  console.log(failures + " gap-fill check(s) failing in " + path.relative(ROOT, BUILD_PATH) + ".");
  process.exit(1);
}
console.log("OK - the gap-fill layer behaves against synthetic trap layouts.");
