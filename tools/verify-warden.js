#!/usr/bin/env node
// Verifies the Warden anti-retrap module inside RYN_v5.4.user.js.
//
//   node tools/verify-warden.js [path/to/RYN_v5.4.user.js]
//
// Four things, in order of how much they matter:
//
//   1. The threat model. Warden's claim is that the set of retraps available
//      to the enemy is an exact arc. That is checked against a brute-force
//      sweep of their placement ring running the game's own rules.
//   2. Legality. Every build it sends is re-checked against the board as it
//      stood at the moment it was sent. A rejected placement costs five
//      packets and reports nothing, so this is the failure that matters most.
//   3. Whether the cage works — does the real, brute-forced threat actually
//      reach zero — and what the fan approach auraro and whiteout use scores
//      on the same boards.
//   4. Behaviour and cost.
//
// The module is loaded out of the userscript, so this cannot drift from what
// ships.
"use strict";

const fs = require("fs");
const path = require("path");
const FILE = process.argv[2] || path.join(__dirname, "..", "RYN_v5.4.user.js");
const src = fs.readFileSync(FILE, "utf8");

const Config_default = { mapScale: 14400, riverWidth: 724, playerDecel: 0.993 };
const PLAYER = 35;
const getAngleDist = (a, b) => { const p = Math.abs(b - a) % (Math.PI * 2); return p > Math.PI ? Math.PI * 2 - p : p; };
const getDistance = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
class Vector_default {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector_default(this.x, this.y); }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  angle(v) { return Math.atan2(v.y - this.y, v.x - this.x); }
  addDirection(a, l) { return new Vector_default(this.x + Math.cos(a) * l, this.y + Math.sin(a) * l); }
}
const Items = {
  4:  { id: 4,  itemGroup: 1, scale: 50, placeOffset: -5, health: 900 },
  6:  { id: 6,  itemGroup: 2, scale: 49, placeOffset: -5, damage: 20, health: 400 },
  15: { id: 15, itemGroup: 5, scale: 50, placeOffset: -5, colDiv: 0.2, ignoreCollision: true, trap: true, health: 500 },
  18: { id: 18, itemGroup: 8, scale: 43, placeOffset: -5 },
};
class PlayerObject {
  constructor(id, x, y, type) {
    this.id = id; this.pos = { current: new Vector_default(x, y) }; this.type = type;
    this.itemGroup = Items[type].itemGroup; this.ownerID = 99;
    this.canBeDestroyed = false; this.health = Items[type].health || 400; this.tempHealth = this.health;
    this.placementScale = Items[type].scale;
    this.collisionScale = Items[type].scale * (Items[type].colDiv ?? 1);
  }
  getDamage() { return Items[this.type].damage || 0; }
  canMoveOnTop() { return "ignoreCollision" in Items[this.type]; }
}
const Settings_default = { _warden: true, _wardenEscape: true, _aegis: false };
const Hats = { 20: { atkSpd: 1 }, 40: {} };

const slice = (from, to) => {
  const a = src.indexOf(from);
  const b = to === null ? src.length : src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error("slice: " + from);
  return src.slice(a, b);
};
const body = slice("  const AEGIS_TWO_PI", "  const AegisPlacer_default")
  + "\nconst AegisPlacer_default = AegisPlacer;\nreturn { Warden, AegisArcs, aegisHalfWidth, aegisRingRadius, AegisPlacer };";
const M = new Function("Config_default", "getAngleDist", "getDistance", "Vector_default",
  "Items", "PlayerObject", "Settings_default", "Hats", body)
  (Config_default, getAngleDist, getDistance, Vector_default, Items, PlayerObject, Settings_default, Hats);

const TWO_PI = Math.PI * 2;
const TRAP = Items[15];
const TRAP_RING = PLAYER + TRAP.scale + TRAP.placeOffset;     // 80
const CATCH = TRAP.scale * TRAP.colDiv + PLAYER;              // 45

// ---- the game's own answer, evaluated directly ----
// Can the enemy land a trap at this bearing that catches me?
function retrapWorks(enemyPos, myPos, objects, angle, excludeID) {
  const x = enemyPos.x + Math.cos(angle) * TRAP_RING;
  const y = enemyPos.y + Math.sin(angle) * TRAP_RING;
  for (const o of objects.values()) {
    if (o.id === excludeID) continue;
    if (Math.hypot(x - o.pos.current.x, y - o.pos.current.y) < TRAP.scale + o.placementScale) return false;
  }
  const lo = Config_default.mapScale / 2 - Config_default.riverWidth / 2;
  const hi = Config_default.mapScale / 2 + Config_default.riverWidth / 2;
  if (y >= lo && y <= hi) return false;
  if (x > Config_default.mapScale - PLAYER || x < PLAYER || y > Config_default.mapScale - PLAYER || y < PLAYER) return false;
  return Math.hypot(x - myPos.x, y - myPos.y) <= CATCH;
}
// Measure of the true threat set, in radians.
function trueThreat(enemyPos, myPos, objects, excludeID, steps = 7200) {
  let n = 0;
  for (let i = 0; i < steps; i++) if (retrapWorks(enemyPos, myPos, objects, i / steps * TWO_PI, excludeID)) n++;
  return n / steps * TWO_PI;
}

// ---- world ----
function makeWorld(enemyDist, extraObjects, trapOffset, trapBearing) {
  const objects = new Map();
  const grid = { query(x, y, s, cb) {
    for (const [id, o] of objects) {
      if (Math.abs(o.pos.current.x - x) <= s * 100 + 200 && Math.abs(o.pos.current.y - y) <= s * 100 + 200) { if (cb(id)) return true; }
    }
    return false;
  } };
  const myPos = new Vector_default(5000, 3000);
  const off = trapOffset === undefined ? 34 : trapOffset;
  const bear = trapBearing === undefined ? 2.4 : trapBearing;
  const trap = new PlayerObject(900, myPos.x + Math.cos(bear) * off, myPos.y + Math.sin(bear) * off, 15);
  objects.set(900, trap);
  for (const o of extraObjects) objects.set(o.id, o);
  const placed = [];
  const me = {
    inGame: true, hatID: 6,
    pos: { current: myPos, future: myPos.copy(), previous: myPos.copy() },
    collisionScale: 35, trappedIn: trap, isTrapped: true,
    getItemByType: t => t === 4 ? 6 : t === 7 ? 15 : t === 3 ? 4 : t === 1 ? 10 : t === 0 ? 5 : null,
    canPlace: () => true,
    getBuildingDamage: () => 75,
    getWeaponSpeed: () => 4,
  };
  const ang = Math.PI * 0.15;
  const enemy = {
    id: 7, collisionScale: 35, isTrapped: false, trappedIn: null,
    pos: {
      previous: new Vector_default(myPos.x + Math.cos(ang) * (enemyDist + 6), myPos.y + Math.sin(ang) * (enemyDist + 6)),
      current: new Vector_default(myPos.x + Math.cos(ang) * enemyDist, myPos.y + Math.sin(ang) * enemyDist),
      future: new Vector_default(myPos.x + Math.cos(ang) * (enemyDist - 6), myPos.y + Math.sin(ang) * (enemyDist - 6)),
    },
  };
  const MH = {
    tickCount: 0, moduleActive: false, placedOnce: false, placementLockTick: 0, placementReserved: [],
    packetLimit: 119, packetCount: 15, move_dir: null, moveTo: "disable", placeAngles: [null, []],
    staticModules: {},
    place(slot, angle) { placed.push({ slot, angle }); },
    reservePlacement() {},
  };
  MH.staticModules.aegis = new M.AegisPlacer({ _ModuleHandler: MH });
  const client = {
    _ModuleHandler: MH,
    ObjectManager: { objects, grid2D: grid, deletedObjects: new Set() },
    EnemyManager: { nearestEnemy: enemy, shouldIgnoreModule: () => false },
    PlayerManager: { enemies: [enemy], isEnemyByID: () => true },
    SocketManager: { pong: 80, TICK: 1000 / 9 },
    myPlayer: me,
  };
  return { client, MH, objects, me, enemy, trap, placed, myPos };
}
// Turn what Warden sent into objects on the board, as the server would.
function applyPlacements(w) {
  let n = 1;
  for (const p of w.placed) {
    const itemID = p.slot === 4 ? 6 : 4;
    const item = Items[itemID];
    const ring = PLAYER + item.scale + item.placeOffset;
    const x = w.myPos.x + Math.cos(p.angle) * ring;
    const y = w.myPos.y + Math.sin(p.angle) * ring;
    w.objects.set(7000 + n, new PlayerObject(7000 + n, x, y, itemID));
    n++;
  }
}

let rng = 4242;
const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let failures = 0;
const check = (name, fn) => { try { fn(); console.log("  ok   " + name); } catch (e) { failures++; console.log("  FAIL " + name + ": " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

// ============================================== 1. threat model vs brute force
console.log("threat model — the arc of retraps available to them:");
{
  let worst = 0, cases = 0;
  check("matches brute force across 1200 boards", () => {
    for (let t = 0; t < 1200; t++) {
      const d = 40 + rand() * 130;
      const extras = [];
      const n = Math.floor(rand() * 5);
      for (let i = 0; i < n; i++) {
        const a = rand() * TWO_PI, dd = 70 + rand() * 150;
        extras.push(new PlayerObject(100 + i, 5000 + Math.cos(a) * dd, 3000 + Math.sin(a) * dd, rand() < 0.5 ? 6 : 4));
      }
      const w = makeWorld(d, extras);
      const warden = new M.Warden(w.client);
      const model = warden._threatArc(w.enemy.pos.current, w.myPos, w.trap.id).measure();
      const truth = trueThreat(w.enemy.pos.current, w.myPos, w.objects, w.trap.id);
      worst = Math.max(worst, Math.abs(model - truth));
      cases++;
    }
    // One brute-force sample is 2pi/7200 rad wide, so agreement to within a
    // couple of samples is exact agreement.
    assert(worst < 0.004, "worst disagreement " + worst.toFixed(5) + " rad");
  });
  console.log("       " + cases + " boards, worst disagreement " + worst.toFixed(5) + " rad (one sample = " + (TWO_PI / 7200).toFixed(5) + ")");
}

// ============================================ 2. does the cage actually close?
console.log("\ncage — does it drive the real threat to zero, and at what cost:");
{
  // The fan the other clients build: spikes across a 180-degree arc opposite
  // the trap, at 30-degree steps, whatever fits.
  function fanCage(w) {
    const trapAim = w.myPos.angle(w.trap.pos.current);
    const dir = trapAim + Math.PI;
    const item = Items[6], ring = PLAYER + item.scale + item.placeOffset;
    let placed = 0, n = 1;
    for (let off = -Math.PI / 2; off <= Math.PI / 2 + 1e-6; off += Math.PI / 6) {
      const a = dir + off;
      const x = w.myPos.x + Math.cos(a) * ring, y = w.myPos.y + Math.sin(a) * ring;
      let blocked = false;
      for (const o of w.objects.values()) {
        if (Math.hypot(x - o.pos.current.x, y - o.pos.current.y) < item.scale + o.placementScale) { blocked = true; break; }
      }
      if (blocked) continue;
      w.objects.set(8000 + n, new PlayerObject(8000 + n, x, y, 6));
      n++; placed++;
    }
    return placed;
  }

  let trials = 0, wardenClosed = 0, fanClosed = 0, phaseABuilds = 0, phaseBBuilds = 0;
  let wardenBuilds = 0, fanBuilds = 0, wardenResid = 0, fanResid = 0, startThreat = 0;
  let noThreatSkipped = 0;

  for (let t = 0; t < 600; t++) {
    const d = 45 + rand() * 75;   // inside retrap range: 80 - 45 .. 80 + 45
    const offset = 22 + rand() * 23;   // caught at the rim, 22-45 units out
    const bearing = rand() * TWO_PI;
    const extras = [];
    const n = Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const a = rand() * TWO_PI, dd = 80 + rand() * 140;
      extras.push(new PlayerObject(100 + i, 5000 + Math.cos(a) * dd, 3000 + Math.sin(a) * dd, rand() < 0.5 ? 6 : 4));
    }
    const probe = makeWorld(d, extras, offset, bearing);
    const before = trueThreat(probe.enemy.pos.current, probe.myPos, probe.objects, 900);
    if (before <= 0.08) { noThreatSkipped++; continue; }
    trials++; startThreat += before;

    // Warden: run it over as many ticks as it wants, then apply and re-measure.
    const wa = makeWorld(d, extras, offset, bearing);
    const warden = new M.Warden(wa.client);
    // Phase A: stuck. Most of the ring is blocked by the trap itself.
    for (let tick = 0; tick < 3; tick++) { wa.MH.tickCount = tick; warden.postTick(); }
    const phaseA = wa.placed.length;
    // The trap breaks: it leaves the board and lockMove releases.
    wa.objects.delete(900); wa.me.trappedIn = null; wa.me.isTrapped = false;
    // Phase B: the ring is open and this is the tick they aim the retrap at.
    for (let tick = 3; tick < 6; tick++) { wa.MH.tickCount = tick; wa.MH.moveTo = "disable"; warden.postTick(); }
    phaseABuilds += phaseA; phaseBBuilds += wa.placed.length - phaseA;
    applyPlacements(wa);
    const wResid = trueThreat(wa.enemy.pos.current, wa.myPos, wa.objects, 900);
    wardenBuilds += wa.placed.length; wardenResid += wResid;
    if (wResid <= 0.08) wardenClosed++;

    // The fan, on the same board.
    const fa = makeWorld(d, extras, offset, bearing);
    const fBuilds = fanCage(fa);
    fa.objects.delete(900);
    const fResid = trueThreat(fa.enemy.pos.current, fa.myPos, fa.objects, 900);
    fanBuilds += fBuilds; fanResid += fResid;
    if (fResid <= 0.08) fanClosed++;
  }

  console.log("       " + trials + " boards where a retrap was actually available (" + noThreatSkipped + " skipped as already safe)");
  console.log("       average threat before        : " + (startThreat / trials).toFixed(3) + " rad");
  console.log("       Warden : closed " + (100 * wardenClosed / trials).toFixed(1) + "% of boards, "
    + (wardenBuilds / trials).toFixed(2) + " builds/board, " + (wardenResid / trials).toFixed(3) + " rad left");
  console.log("                (" + (phaseABuilds / trials).toFixed(2) + " while stuck, "
    + (phaseBBuilds / trials).toFixed(2) + " on the tick the ring opened)");
  console.log("       fan    : closed " + (100 * fanClosed / trials).toFixed(1) + "% of boards, "
    + (fanBuilds / trials).toFixed(2) + " builds/board, " + (fanResid / trials).toFixed(3) + " rad left");

  check("Warden closes the retrap on most boards", () => {
    assert(wardenClosed / trials > 0.8, "only closed " + (100 * wardenClosed / trials).toFixed(1) + "%");
  });
  check("Warden beats the fan on residual threat", () => {
    assert(wardenResid < fanResid, "Warden left " + (wardenResid / trials).toFixed(3) + ", fan left " + (fanResid / trials).toFixed(3));
  });
  // The fan spends less because most of its fan is illegal and it stops when
  // it runs out of fan, not when the threat is closed. Builds are not the
  // figure of merit for anti-retrap — a half-closed cage still gets you
  // retrapped. What matters is whether the threat reaches zero, and what each
  // build buys on the way.
  console.log("       closed per build             : Warden "
    + ((startThreat - wardenResid) / wardenBuilds).toFixed(3) + " rad, fan "
    + ((startThreat - fanResid) / Math.max(1, fanBuilds)).toFixed(3) + " rad");
  check("Warden closes far more boards than the fan", () => {
    assert(wardenClosed > fanClosed * 1.5, "Warden " + wardenClosed + " vs fan " + fanClosed);
  });
  check("Warden's cage stays within its episode budget", () => {
    assert(wardenBuilds / trials <= 4.0, "averaged " + (wardenBuilds / trials).toFixed(2) + " builds/board");
  });
}

// ------- marginal value of each build, to check the cap is set sensibly -----
{
  const closedAfter = [0, 0, 0, 0, 0];
  let boards = 0;
  for (let t = 0; t < 400; t++) {
    const d = 45 + rand() * 75;
    const offset = 22 + rand() * 23;
    const bearing = rand() * TWO_PI;
    const probe = makeWorld(d, [], offset, bearing);
    if (trueThreat(probe.enemy.pos.current, probe.myPos, probe.objects, 900) <= 0.08) continue;
    boards++;
    for (let cap = 1; cap <= 4; cap++) {
      const w = makeWorld(d, [], offset, bearing);
      const warden = new M.Warden(w.client);
      for (let tick = 0; tick < 3; tick++) { w.MH.tickCount = tick; warden.postTick(); }
      w.objects.delete(900); w.me.trappedIn = null; w.me.isTrapped = false;
      for (let tick = 3; tick < 6; tick++) { w.MH.tickCount = tick; w.MH.moveTo = "disable"; warden.postTick(); }
      w.placed.length = Math.min(w.placed.length, cap);
      applyPlacements(w);
      if (trueThreat(w.enemy.pos.current, w.myPos, w.objects, 900) <= 0.08) closedAfter[cap]++;
    }
  }
  console.log("\nmarginal value of each build (" + boards + " boards):");
  for (let cap = 1; cap <= 4; cap++) {
    console.log("       capped at " + cap + " build" + (cap > 1 ? "s" : " ") + " : " + (100 * closedAfter[cap] / boards).toFixed(1) + "% closed");
  }
}

// ---- every build must be legal on the board as it stood when it was sent ----
// This is the failure mode that matters most: a placement the server rejects
// costs five packets and buys nothing, and nothing in the client reports it.
console.log("\nlegality — each build checked against the board at the moment it was sent:");
{
  let sent = 0, illegal = 0, whileStuck = 0, illegalWhileStuck = 0;
  const legalAt = (objects, myPos, itemID, angle) => {
    const item = Items[itemID];
    const ring = PLAYER + item.scale + item.placeOffset;
    const x = myPos.x + Math.cos(angle) * ring, y = myPos.y + Math.sin(angle) * ring;
    for (const o of objects.values()) {
      if (Math.hypot(x - o.pos.current.x, y - o.pos.current.y) < item.scale + o.placementScale) return false;
    }
    const lo = Config_default.mapScale / 2 - Config_default.riverWidth / 2;
    const hi = Config_default.mapScale / 2 + Config_default.riverWidth / 2;
    if (y >= lo && y <= hi) return false;
    return !(x > Config_default.mapScale - PLAYER || x < PLAYER || y > Config_default.mapScale - PLAYER || y < PLAYER);
  };
  check("no build is sent into a spot the server would reject", () => {
    for (let t = 0; t < 500; t++) {
      const d = 45 + rand() * 75;
      const offset = 22 + rand() * 23;
      const bearing = rand() * TWO_PI;
      const extras = [];
      const n = Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const a = rand() * TWO_PI, dd = 85 + rand() * 130;
        extras.push(new PlayerObject(100 + i, 5000 + Math.cos(a) * dd, 3000 + Math.sin(a) * dd, rand() < 0.5 ? 6 : 4));
      }
      const w = makeWorld(d, extras, offset, bearing);
      const warden = new M.Warden(w.client);
      let seen = 0, nextId = 7000;
      // Each tick: run, then commit whatever it sent to the board, exactly as
      // the server would, before the next tick sees it.
      for (let tick = 0; tick < 7; tick++) {
        if (tick === 3) { w.objects.delete(900); w.me.trappedIn = null; w.me.isTrapped = false; }
        w.MH.tickCount = tick; w.MH.moveTo = "disable";
        warden.postTick();
        while (seen < w.placed.length) {
          const p = w.placed[seen++];
          const itemID = p.slot === 4 ? 6 : 4;
          sent++;
          if (tick < 3) whileStuck++;
          if (!legalAt(w.objects, w.myPos, itemID, p.angle)) {
            illegal++;
            if (tick < 3) illegalWhileStuck++;
          } else {
            const item = Items[itemID];
            const ring = PLAYER + item.scale + item.placeOffset;
            w.objects.set(nextId, new PlayerObject(nextId, w.myPos.x + Math.cos(p.angle) * ring, w.myPos.y + Math.sin(p.angle) * ring, itemID));
            nextId++;
          }
        }
      }
    }
    assert(illegal === 0, illegal + " of " + sent + " builds would have been rejected");
  });
  console.log("       " + sent + " builds sent (" + whileStuck + " while stuck), " + illegal + " rejected");
}

// ================================================================ 3. behaviour
console.log("\nbehaviour:");

check("does nothing when the enemy is too far to retrap", () => {
  const w = makeWorld(200, []);
  const warden = new M.Warden(w.client);
  for (let t = 0; t < 4; t++) { w.MH.tickCount = t; warden.postTick(); }
  assert(w.placed.length === 0, "built a cage against an enemy 200 away (max retrap reach is 125)");
});

check("never claims the tick, so autobreak keeps swinging", () => {
  const w = makeWorld(70, []);
  const warden = new M.Warden(w.client);
  for (let t = 0; t < 3; t++) { w.MH.tickCount = t; warden.postTick(); }
  w.objects.delete(900); w.me.trappedIn = null; w.me.isTrapped = false;
  for (let t = 3; t < 6; t++) { w.MH.tickCount = t; w.MH.moveTo = "disable"; warden.postTick(); }
  assert(w.placed.length > 0, "did not build at all");
  assert(w.MH.moduleActive === false, "set moduleActive and would have blocked the break swing");
});

check("respects the per-episode build cap", () => {
  const w = makeWorld(60, []);
  const warden = new M.Warden(w.client);
  for (let t = 0; t < 3; t++) { w.MH.tickCount = t; warden.postTick(); }
  w.objects.delete(900); w.me.trappedIn = null; w.me.isTrapped = false;
  for (let t = 3; t < 20; t++) { w.MH.tickCount = t; w.MH.moveTo = "disable"; warden.postTick(); }
  assert(w.placed.length <= 4, "spent " + w.placed.length + " builds in one episode");
});

check("a new trap starts a new episode budget", () => {
  const w = makeWorld(60, []);
  const warden = new M.Warden(w.client);
  for (let t = 0; t < 3; t++) { w.MH.tickCount = t; warden.postTick(); }
  w.objects.delete(900); w.me.trappedIn = null; w.me.isTrapped = false;
  for (let t = 3; t < 8; t++) { w.MH.tickCount = t; w.MH.moveTo = "disable"; warden.postTick(); }
  const first = w.placed.length;
  assert(first > 0, "built nothing in the first episode");
  const second = new PlayerObject(901, w.myPos.x + 30, w.myPos.y + 12, 15);
  w.objects.set(901, second);
  w.me.trappedIn = second; w.me.isTrapped = true;
  for (let t = 20; t < 24; t++) { w.MH.tickCount = t; warden.postTick(); }
  w.objects.delete(901); w.me.trappedIn = null; w.me.isTrapped = false;
  for (let t = 24; t < 28; t++) { w.MH.tickCount = t; w.MH.moveTo = "disable"; warden.postTick(); }
  assert(w.placed.length > first, "did not re-arm for a second trap");
});

check("respects the packet reserve", () => {
  const w = makeWorld(60, []);
  w.MH.packetCount = 119 - 18;
  const warden = new M.Warden(w.client);
  for (let t = 0; t < 3; t++) { w.MH.tickCount = t; warden.postTick(); }
  w.objects.delete(900); w.me.trappedIn = null; w.me.isTrapped = false;
  for (let t = 3; t < 6; t++) { w.MH.tickCount = t; w.MH.moveTo = "disable"; w.MH.packetCount = 119 - 18; warden.postTick(); }
  assert(w.placed.length === 0, "spent into the reserve");
});

check("steers the escape only once free, and only if nobody else is steering", () => {
  const w = makeWorld(60, []);
  const warden = new M.Warden(w.client);
  for (let t = 0; t < 3; t++) { w.MH.tickCount = t; warden.postTick(); }
  assert(w.MH.moveTo === "disable", "steered while still trapped, where lockMove makes it useless");
  w.objects.delete(900); w.me.trappedIn = null; w.me.isTrapped = false;
  w.MH.tickCount = 3; warden.postTick();
  assert(typeof w.MH.moveTo === "number", "did not steer on the tick it came free");
  const lane = w.MH.moveTo;
  const toEnemy = w.myPos.angle(w.enemy.pos.current);
  assert(getAngleDist(lane, toEnemy) > Math.PI / 2, "escape lane points towards the enemy");
});

check("survives 300 ticks of churn without throwing", () => {
  const w = makeWorld(70, []);
  const warden = new M.Warden(w.client);
  for (let t = 0; t < 300; t++) {
    w.MH.tickCount = t;
    w.MH.moveTo = "disable";
    w.MH.packetCount = Math.floor(rand() * 50);
    if (rand() < 0.15) { w.me.trappedIn = w.me.trappedIn ? null : w.trap; w.me.isTrapped = !!w.me.trappedIn; }
    w.enemy.pos.previous = w.enemy.pos.current.copy();
    w.enemy.pos.current = new Vector_default(5000 + (rand() - 0.5) * 240, 3000 + (rand() - 0.5) * 240);
    if (rand() < 0.2) { const id = 3000 + t; w.objects.set(id, new PlayerObject(id, 5000 + (rand() - 0.5) * 280, 3000 + (rand() - 0.5) * 280, 6)); }
    warden.postTick();
  }
});

// ==================================================================== 4. cost
{
  const w = makeWorld(70, []);
  for (let i = 0; i < 10; i++) {
    const a = rand() * TWO_PI, d = 80 + rand() * 130;
    w.objects.set(5000 + i, new PlayerObject(5000 + i, 5000 + Math.cos(a) * d, 3000 + Math.sin(a) * d, 6));
  }
  const warden = new M.Warden(w.client);
  const N = 4000; let acc = 0;
  for (let t = 0; t < N; t++) {
    w.MH.tickCount = t; w.MH.moveTo = "disable";
    const s = process.hrtime.bigint(); warden.postTick(); acc += Number(process.hrtime.bigint() - s);
  }
  console.log("\ncost: " + (acc / N / 1000).toFixed(1) + " us/tick while trapped with 10 builds around ("
    + (acc / N / 1000 / 1000 / (1000 / 9) * 100).toFixed(3) + "% of a tick)");
}

console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures ? 1 : 0);
