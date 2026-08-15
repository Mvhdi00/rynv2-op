#!/usr/bin/env node
// Verifies the Aegis building engine inside RYN_v5.4.user.js.
//
//   node tools/verify-aegis.js [path/to/RYN_v5.4.user.js]
//
// Three things are checked, in order of how much they matter:
//
//   1. Geometry. The engine's free-placement arcs are compared, angle by
//      angle, against a direct simulation of the game's own
//      `checkItemLocation` — blockers, the river band and the map edge.
//      Any disagreement in either direction is a failure.
//   2. Behaviour. The module is driven through a mock tick loop: arbitration,
//      the packet reserve, the preplace ledger, and the per-tick cap.
//   3. Cost. What it actually spends per tick, against the 111ms server tick,
//      and how it compares to the 72-angle probe the ported placer used.
//
// The engine is loaded out of the userscript itself rather than copied here,
// so this cannot drift from what ships.
"use strict";

const fs = require("fs");
const path = require("path");

const FILE = process.argv[2] || path.join(__dirname, "..", "RYN_v5.4.user.js");
const src = fs.readFileSync(FILE, "utf8");

// ---------------------------------------------------------------- stand-ins
// The engine closes over a handful of RYN globals. These are the real values
// from the game bundle, not approximations.
const Config_default = { mapScale: 14400, riverWidth: 724, playerDecel: 0.993 };
const PLAYER = 35;
const getAngleDist = (a, b) => {
  const p = Math.abs(b - a) % (Math.PI * 2);
  return p > Math.PI ? Math.PI * 2 - p : p;
};
const getDistance = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
class Vector_default {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector_default(this.x, this.y); }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  angle(v) { return Math.atan2(v.y - this.y, v.x - this.x); }
  addDirection(a, len) { return new Vector_default(this.x + Math.cos(a) * len, this.y + Math.sin(a) * len); }
}
const Items = {
  6:  { id: 6,  itemGroup: 2, scale: 49, placeOffset: -5, damage: 20 },
  15: { id: 15, itemGroup: 5, scale: 50, placeOffset: -5, colDiv: 0.2, ignoreCollision: true, trap: true },
  18: { id: 18, itemGroup: 8, scale: 43, placeOffset: -5 },
};
class PlayerObject {
  constructor(id, x, y, type) {
    this.id = id;
    this.pos = { current: new Vector_default(x, y) };
    this.type = type;
    this.itemGroup = Items[type].itemGroup;
    this.ownerID = 99;
    this.canBeDestroyed = false;
    this.placementScale = Items[type].scale;
    this.collisionScale = Items[type].scale * (Items[type].colDiv ?? 1);
  }
  getDamage() { return Items[this.type].damage || 0; }
}
const Settings_default = {
  _aegis: true, _aegisPredict: true, _aegisPreplace: true,
  _aegisReplace: true, _aegisDenial: true, _aegisRadius: 350,
};

// ------------------------------------------------------------- load the code
const slice = (from, to) => {
  const a = src.indexOf(from);
  if (a < 0) throw new Error("cannot find in userscript: " + from);
  const b = to === null ? src.length : src.indexOf(to, a);
  if (b < 0) throw new Error("cannot find in userscript: " + to);
  return src.slice(a, b);
};
const AegisPlacer = new Function(
  "Config_default", "getAngleDist", "getDistance", "Vector_default",
  "Items", "PlayerObject", "Settings_default",
  slice("  const AEGIS_TWO_PI", "  const AegisPlacer_default") + "\nreturn AegisPlacer;"
)(Config_default, getAngleDist, getDistance, Vector_default, Items, PlayerObject, Settings_default);

let rng = 12345;
const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log("  ok   " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + ": " + e.message); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ================================================================ 1. geometry
// The game's own placement test, evaluated directly at one angle.
function gameRejects(center, itemID, blockers, angle) {
  const item = Items[itemID];
  const ring = PLAYER + item.scale + item.placeOffset;
  const x = center.x + Math.cos(angle) * ring;
  const y = center.y + Math.sin(angle) * ring;
  for (const b of blockers) {
    if (Math.hypot(x - b.x, y - b.y) < item.scale + b.scale) return true;
  }
  if (item.id !== 18) {
    const lo = Config_default.mapScale / 2 - Config_default.riverWidth / 2;
    const hi = Config_default.mapScale / 2 + Config_default.riverWidth / 2;
    if (y >= lo && y <= hi) return true;
  }
  return x > Config_default.mapScale - PLAYER || x < PLAYER
      || y > Config_default.mapScale - PLAYER || y < PLAYER;
}

console.log("geometry — free arcs against the game's own checkItemLocation:");
const placer = new AegisPlacer({});
const TWO_PI = Math.PI * 2;
let boards = 0, samples = 0, disagreements = 0, worst = 0;

check("no disagreement across 4000 boards", () => {
  for (let trial = 0; trial < 4000; trial++) {
    // Open field, straddling the river, and both map corners, so the band and
    // edge arcs are exercised alongside the blocker arcs.
    let cx, cy;
    const mode = trial % 4;
    if (mode === 0) { cx = 3000 + rand() * 8000; cy = 3000 + rand() * 4000; }
    else if (mode === 1) { cx = 3000 + rand() * 8000; cy = 7200 + (rand() - 0.5) * 900; }
    else if (mode === 2) { cx = PLAYER + rand() * 200; cy = PLAYER + rand() * 200; }
    else { cx = Config_default.mapScale - PLAYER - rand() * 200; cy = 2000 + rand() * 3000; }
    const center = new Vector_default(cx, cy);
    const itemID = [6, 15, 18][trial % 3];
    const blockers = [];
    const n = Math.floor(rand() * 7);
    for (let i = 0; i < n; i++) {
      const a = rand() * TWO_PI, d = 20 + rand() * 200;
      blockers.push({
        x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
        scale: [49, 50, 45, 110, 52][Math.floor(rand() * 5)], id: i,
      });
    }
    const free = placer._freeArcs(center, itemID, blockers);
    boards++;
    const item = Items[itemID];
    const ring = PLAYER + item.scale + item.placeOffset;
    for (let s = 0; s < 3600; s++) {
      const angle = s / 3600 * TWO_PI;
      samples++;
      if (gameRejects(center, itemID, blockers, angle) !== free.contains(angle)) continue;
      // Agreement is the failure case here: `gameRejects === contains(free)`
      // means one says blocked while the other says free. Measure how far
      // inside the wrong region it is, so grid discretisation at an arc
      // boundary is not counted as a real error.
      const px = center.x + Math.cos(angle) * ring;
      const py = center.y + Math.sin(angle) * ring;
      let depth = Infinity;
      for (const b of blockers) depth = Math.min(depth, Math.abs(Math.hypot(px - b.x, py - b.y) - (item.scale + b.scale)));
      if (item.id !== 18) {
        depth = Math.min(depth, Math.abs(py - 6838), Math.abs(py - 7562));
      }
      depth = Math.min(depth, Math.abs(px - PLAYER), Math.abs(px - (Config_default.mapScale - PLAYER)),
                              Math.abs(py - PLAYER), Math.abs(py - (Config_default.mapScale - PLAYER)));
      if (depth > 0.75) { disagreements++; worst = Math.max(worst, depth); }
    }
  }
  assert(disagreements === 0, disagreements + " disagreements, worst " + worst.toFixed(2) + " units deep");
});
console.log("       " + boards + " boards, " + samples.toLocaleString("en-US") + " angles sampled");

// =============================================================== 2. behaviour
function makeWorld(opts = {}) {
  const objects = new Map();
  const grid = {
    query(x, y, s, cb) {
      for (const [id, o] of objects) {
        if (Math.abs(o.pos.current.x - x) <= s * 100 + 160 && Math.abs(o.pos.current.y - y) <= s * 100 + 160) {
          if (cb(id)) return true;
        }
      }
      return false;
    },
  };
  const places = [];
  const me = {
    pos: { current: new Vector_default(5000, 3000), future: new Vector_default(5000, 3000) },
    collisionScale: 35,
    getItemByType: t => t === 4 ? 6 : t === 7 ? 15 : null,
    canPlace: () => opts.canPlace !== false,
    getActualMaxKnockback: () => opts.knock ?? 0,
  };
  const enemy = {
    id: 7,
    pos: { previous: new Vector_default(5140, 3000), current: new Vector_default(5120, 3000), future: new Vector_default(5100, 3000) },
    collisionScale: 35, isTrapped: opts.trapped || false, trappedIn: opts.trappedIn || null,
  };
  const MH = {
    tickCount: 0, moduleActive: false, placedOnce: false,
    placementLockTick: 0, placementReserved: [],
    packetLimit: 119, packetCount: 0, move_dir: null, placeAngles: [null, []],
    place(type, angle) { places.push([type, +angle.toFixed(3)]); },
  };
  return {
    client: {
      _ModuleHandler: MH,
      ObjectManager: { objects, grid2D: grid, deletedObjects: new Set() },
      EnemyManager: { nearestEnemy: opts.noEnemy ? null : enemy, shouldIgnoreModule: () => opts.ignore || false },
      PlayerManager: { enemies: opts.noEnemy ? [] : [enemy], isEnemyByID: () => true },
      SocketManager: { pong: opts.pong ?? 80 },
      myPlayer: me,
    },
    MH, places, objects, enemy, me,
  };
}
const advance = (w, t, x, y) => {
  w.MH.tickCount = t;
  w.MH.placedOnce = false;
  w.MH.placeAngles = [null, []];
  w.enemy.pos.previous = w.enemy.pos.current.copy();
  w.enemy.pos.current = new Vector_default(x, y);
};

console.log("\nbehaviour — the module driven through a mock tick loop:");

check("no enemy on the board is a clean no-op", () => {
  const w = makeWorld({ noEnemy: true }); const p = new AegisPlacer(w.client);
  for (let t = 0; t < 5; t++) { w.MH.tickCount = t; p.postTick(); }
  assert(w.places.length === 0, "placed with no enemy");
});

check("an approaching enemy in reach draws placements", () => {
  const w = makeWorld(); const p = new AegisPlacer(w.client);
  for (let t = 0; t < 4; t++) { advance(w, t, 5120 - t * 9, 3000); p.postTick(); }
  assert(w.places.length > 0, "never placed against an approaching enemy");
  for (const [slot, angle] of w.places) {
    assert(slot === 4 || slot === 7, "bad slot " + slot);
    assert(isFinite(angle), "non-finite angle");
  }
});

check("every angle sent is already on the wire grid", () => {
  const w = makeWorld(); const p = new AegisPlacer(w.client);
  for (let t = 0; t < 6; t++) { advance(w, t, 5120 - t * 8, 3000 + t * 3); p.postTick(); }
  for (const [, angle] of w.places) {
    assert(Math.abs(angle - parseFloat(angle.toFixed(2))) < 1e-9, angle + " is not a fixTo(a,2) value");
  }
});

check("stands down when another module owns the tick", () => {
  const w = makeWorld(); const p = new AegisPlacer(w.client);
  w.MH.moduleActive = true;
  for (let t = 0; t < 5; t++) { w.MH.tickCount = t; p.postTick(); }
  assert(w.places.length === 0, "placed while another module owned the tick");
});

check("stands down while a sequence holds the placement lock", () => {
  const w = makeWorld(); const p = new AegisPlacer(w.client);
  w.MH.placementLockTick = 10;
  for (let t = 0; t < 8; t++) { advance(w, t, 5120 - t * 8, 3000); p.postTick(); }
  assert(w.places.length === 0, "placed through a placement lock");
});

check("never spends into the packet reserve", () => {
  const w = makeWorld(); const p = new AegisPlacer(w.client);
  w.MH.packetCount = 119 - 20;
  for (let t = 0; t < 5; t++) { advance(w, t, 5120 - t * 8, 3000); p.postTick(); }
  assert(w.places.length === 0, "spent into the tick reserve");
});

check("keeps out of angles a sequence reserved", () => {
  const w = makeWorld(); const p = new AegisPlacer(w.client);
  for (let a = 0; a < TWO_PI; a += 0.3) w.MH.placementReserved.push(a);
  for (let t = 0; t < 5; t++) { advance(w, t, 5120 - t * 8, 3000); p.postTick(); }
  assert(w.places.length === 0, "placed into reserved angles");
});

check("ledger holds a preplace until the slot opens, then fires", () => {
  const w = makeWorld({ trapped: true }); const p = new AegisPlacer(w.client);
  const trap = new PlayerObject(500, 5105, 3000, 15);
  trap.canBeDestroyed = true;
  w.objects.set(500, trap);
  w.enemy.trappedIn = trap;
  for (let t = 0; t < 3; t++) { w.MH.tickCount = t; w.MH.placedOnce = false; p.postTick(); }
  const before = w.places.length;
  assert(p.intents.size > 0, "no intent raised against a dying trap");
  w.objects.delete(500);
  w.MH.tickCount = 4; w.MH.placedOnce = false; p.postTick();
  assert(w.places.length > before, "intent never fired once the slot opened");
});

check("never exceeds the per-tick placement cap", () => {
  const w = makeWorld(); const p = new AegisPlacer(w.client);
  let max = 0;
  for (let t = 0; t < 40; t++) {
    const before = w.places.length;
    advance(w, t, 5120 - (t % 12) * 6, 3000);
    p.postTick();
    max = Math.max(max, w.places.length - before);
  }
  assert(max <= 3, "placed " + max + " times in one tick");
});

check("200 ticks of churn without throwing or leaking", () => {
  const w = makeWorld(); const p = new AegisPlacer(w.client);
  for (let t = 0; t < 200; t++) {
    w.MH.tickCount = t; w.MH.placedOnce = false; w.MH.placeAngles = [null, []];
    w.MH.packetCount = Math.floor(rand() * 60);
    w.MH.move_dir = rand() < 0.5 ? null : rand() * TWO_PI;
    w.enemy.pos.previous = w.enemy.pos.current.copy();
    w.enemy.pos.current = new Vector_default(5000 + (rand() - 0.5) * 400, 3000 + (rand() - 0.5) * 400);
    w.me.pos.current = new Vector_default(5000 + (rand() - 0.5) * 60, 3000 + (rand() - 0.5) * 60);
    w.me.pos.future = w.me.pos.current.copy();
    if (rand() < 0.3) {
      const id = 1000 + t;
      w.objects.set(id, new PlayerObject(id, w.me.pos.current.x + (rand() - 0.5) * 260, w.me.pos.current.y + (rand() - 0.5) * 260, rand() < 0.5 ? 6 : 15));
    }
    if (rand() < 0.2 && w.objects.size) {
      const k = w.objects.keys().next().value;
      w.client.ObjectManager.deletedObjects.add(w.objects.get(k));
      w.objects.delete(k);
    }
    p.postTick();
    w.client.ObjectManager.deletedObjects.clear();
  }
  assert(p.intents.size < 40, "intent ledger leaked (" + p.intents.size + " entries)");
  assert(p.tracks.size <= 1, "track table leaked");
});

// ==================================================================== 3. cost
console.log("\ncost — against the 111ms server tick:");
{
  const dense = () => {
    const c = new Vector_default(5000 + rand() * 100, 3000 + rand() * 100);
    const b = [];
    for (let i = 0; i < 9; i++) {
      const a = rand() * TWO_PI, d = 60 + rand() * 140;
      b.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, scale: [49, 50, 52, 45][Math.floor(rand() * 4)], id: i });
    }
    return { c, b };
  };
  const scenes = [];
  for (let i = 0; i < 2000; i++) scenes.push(dense());

  let t0 = process.hrtime.bigint();
  for (const s of scenes) { placer._freeArcs(s.c, 6, s.b); placer._freeArcs(s.c, 15, s.b); }
  const arcNs = Number(process.hrtime.bigint() - t0) / scenes.length;

  t0 = process.hrtime.bigint();
  for (const s of scenes) {
    for (const id of [6, 15]) for (let k = 0; k < 72; k++) gameRejects(s.c, id, s.b, k / 72 * TWO_PI);
  }
  const probeNs = Number(process.hrtime.bigint() - t0) / scenes.length;

  // How often the 72-angle probe the ported placer used reports no legal
  // angle on a board where one exists.
  let placeable = 0, probeMissed = 0;
  for (let i = 0; i < 4000; i++) {
    const { c, b } = dense();
    const free = placer._freeArcs(c, 6, b);
    if (free.full === false && free.spans.length === 0) continue;
    placeable++;
    let probeFound = false;
    for (let k = 0; k < 72; k++) if (!gameRejects(c, 6, b, k / 72 * TWO_PI)) { probeFound = true; break; }
    if (!probeFound) probeMissed++;
  }

  const w = makeWorld(); const p = new AegisPlacer(w.client);
  for (let i = 0; i < 14; i++) {
    const a = rand() * TWO_PI, d = 70 + rand() * 150;
    w.objects.set(2000 + i, new PlayerObject(2000 + i, 5000 + Math.cos(a) * d, 3000 + Math.sin(a) * d, rand() < 0.6 ? 6 : 15));
  }
  const N = 3000;
  let acc = 0;
  for (let t = 0; t < N; t++) {
    advance(w, t, 5000 + Math.cos(t * 0.1) * 120, 3000 + Math.sin(t * 0.1) * 120);
    w.MH.packetCount = 20;
    const s = process.hrtime.bigint();
    p.postTick();
    acc += Number(process.hrtime.bigint() - s);
  }
  const perTick = acc / N / 1000;

  console.log("  free arcs, both items, 9 blockers : " + (arcNs / 1000).toFixed(1) + " us");
  console.log("  the 72-angle probe, same board    : " + (probeNs / 1000).toFixed(1) + " us  (" + (probeNs / arcNs).toFixed(1) + "x)");
  console.log("  probe finds no angle where one exists: " + probeMissed + "/" + placeable + " dense boards (" + (100 * probeMissed / placeable).toFixed(1) + "%)");
  console.log("  full postTick, 14 builds, denial on : " + perTick.toFixed(1) + " us  (" + (perTick / 1000 / (1000 / 9) * 100).toFixed(3) + "% of a tick)");
}

console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures ? 1 : 0);
