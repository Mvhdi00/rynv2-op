#!/usr/bin/env node
/*
 * verify-deltek.js
 *
 * Runs the Replace feature as it actually ships: the code is pulled out of
 * Deltek_Replace.user.js and executed against a stand-in for the parts of
 * deltek it touches. Nothing here re-implements the feature — the stubs are the
 * client, and the code under test is the built file's.
 *
 *   node tools/verify-deltek.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "src/Deltek.user.js"), "utf8").split("\r\n").join("\n");
const BUILT_PATH = path.join(ROOT, "Deltek_Replace.user.js");

let failed = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(label, ok, detail) {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(label, 56)}${detail || ""}`);
}

if (!fs.existsSync(BUILT_PATH)) {
  check("Deltek_Replace.user.js exists (run node tools/build-deltek.js)", false);
  process.exit(1);
}
const built = fs.readFileSync(BUILT_PATH, "utf8").split("\r\n").join("\n");

/* ------------------------------------------------------------------ */
console.log("\n1. wiring\n");

check("the record is taken before disableBySid splices the object",
  /noteVacated\(gameObjects\.find\(object => object\.sid == sid\)\);\n\s*objectManager\.disableBySid\(sid\);/.test(built));
check("removedObjects still gets the sid, so its own consumers keep working",
  /removedObjects\.push\(sid\);/.test(built) &&
  (built.match(/removedObjects\.some/g) || []).length ===
  (SRC.match(/removedObjects\.some/g) || []).length);
check("it runs in the tick, after the auto placer",
  /\/\/ REPLACE\n\s*replaceVacated\(\);\n\s*\n\s*\/\/ PLAYER DIRECTION/.test(built));
check("the toggle is in the Placers menu",
  /\{ type: 'toggle', name: "Enable Replace", id: "replace" \}/.test(built));
check("and has a default", /\n\s*replace: true,/.test(built));
check("it reuses deltek's own place()", /place\(id, angle\);/.test(built));
check("and deltek's own canPlace(), not a second legality check",
  /canPlace\(id, aim\.angle, objects\)/.test(built) &&
  !/checkItemLocation/.test(built.slice(built.indexOf("REPLACE ===="),
    built.indexOf("REPLACE ====") + 7000)));
check("it works under the same packet ceiling as the auto placer",
  /if \(window\.packets \+ 5 > 119\) break;/.test(
    built.slice(built.indexOf("function replaceVacated"),
      built.indexOf("function replaceVacated") + 900)));

/* ------------------------------------------------------------------ *
 * Pull the feature out and run it.
 * ------------------------------------------------------------------ */
const start = built.indexOf("        // ==================== REPLACE ====================");
const endMark = "\n            vacatedObjects.length = 0;\n        }";
const end = built.indexOf(endMark, start);
check("the feature can be extracted from the built file", start > 0 && end > start);
if (start < 0 || end < 0) process.exit(1);
const featureSrc = built.slice(start, end + endMark.length);

/* ---- the stand-in client ----------------------------------------- */
function makeWorld(opts) {
  opts = opts || {};
  const groups = {
    1: { id: 1, name: "walls", place: true },
    2: { id: 2, name: "spikes", place: true },
    4: { id: 4, name: "trap", place: true },
    0: { id: 0, name: "food" }
  };
  /* item id -> definition, matching deltek's shape */
  const list = [];
  list[0] = { group: groups[0], scale: 22 };                 // apple
  list[3] = { group: groups[1], scale: 50 };                 // wood wall
  list[6] = { group: groups[2], scale: 35 };                 // spike
  list[15] = { group: groups[4], scale: 32, placeOffset: 0 };// trap

  const env = {
    tick: 10,
    placedAngles: [],
    placed: [],
    blocked: opts.blocked || [],           // angles canPlace refuses
    limitReached: opts.limitReached || [], // item ids at their cap
    Math, console,
    window: { vars: { replace: opts.replace !== false }, packets: opts.packets || 0 },
    myPlayer: {
      alive: true, sid: 1, x2: 0, y2: 0,
      items: [0, 3, 6, null, 15],          // food, wall, spike, -, trap
      itemCounts: {}
    },
    items: { list },
    nearestEnemy: opts.enemy || null,
    visibleObjects: opts.visibleObjects || [],
    gameObjects: [],
    UTILS: { toRad: d => d * Math.PI / 180 },
    isObjectMine: o => !!o && o.owner && o.owner.sid === 1,
    isItemLimit(id) { return env.limitReached.indexOf(id) !== -1; },
    canPlace(id, angle, objects) {
      if (env.isItemLimit(id)) return false;
      env.lastObjects = objects;
      const deg = Math.round((angle * 180 / Math.PI + 360) % 360);
      return env.blocked.indexOf(deg) === -1;
    },
    place(id, angle) {
      env.placed.push({ id, angle, deg: Math.round((angle * 180 / Math.PI + 360) % 360) });
      env.window.packets += 5;
    }
  };
  env.globalThis = env;
  vm.createContext(env);
  /* `let vacatedObjects` is a lexical binding, so it never lands on the context
   * object the way the function declarations do. One accessor, appended to the
   * script rather than woven into it, so the code under test is unchanged. */
  vm.runInContext(featureSrc + "\nglobalThis.queue = () => vacatedObjects;",
    env, { filename: "deltek-replace.js" });
  return env;
}

/* A structure of mine at (x, y). The trap's own place radius is
 * 35 + 32 = 67, the spike's 35 + 35 = 70, the wall's 35 + 50 = 85. */
const mine = (id, x, y, scale, sid) =>
  ({ sid: sid || 99, id, x, y, scale, owner: { sid: 1 } });

console.log("\n2. capture\n");
{
  const w = makeWorld({});
  w.noteVacated(mine(15, 67, 0, 32));
  check("a destroyed structure of mine is recorded", w.queue().length === 1);
  check("with the ground it was standing on",
    w.queue()[0].x === 67 && w.queue()[0].y === 0);
  check("and what it was", w.queue()[0].groupId === 4);

  const other = makeWorld({});
  other.noteVacated({ sid: 5, id: 15, x: 67, y: 0, scale: 32, owner: { sid: 2 } });
  check("an enemy's structure is not recorded", other.queue().length === 0);

  const food = makeWorld({});
  food.noteVacated(mine(0, 67, 0, 22));
  check("something that never held ground is not recorded", food.queue().length === 0);

  const off = makeWorld({ replace: false });
  off.noteVacated(mine(15, 67, 0, 32));
  check("nothing is recorded while the feature is off", off.queue().length === 0);

  const gone = makeWorld({});
  gone.noteVacated(undefined);
  check("a sid with no object behind it is survived", gone.queue().length === 0);
}

console.log("\n3. what goes back\n");
{
  /* Trap dies at its own place radius, dead ahead. */
  const w = makeWorld({});
  w.noteVacated(mine(15, 67, 0, 32));
  w.replaceVacated();
  check("a trap is replaced by a trap", w.placed.length === 1 && w.placed[0].id === 15,
    JSON.stringify(w.placed));
  check("on the ground that just opened", w.placed[0].deg === 0);
  check("and the queue is spent", w.queue().length === 0);

  const wall = makeWorld({});
  wall.noteVacated(mine(3, 85, 0, 50));
  wall.replaceVacated();
  check("a wall is replaced by a wall", wall.placed.length === 1 && wall.placed[0].id === 3);

  /* An enemy standing on the freed ground. */
  const denied = makeWorld({ enemy: { x2: 67, y2: 0, scale: 35 } });
  denied.noteVacated(mine(15, 67, 0, 32));
  denied.replaceVacated();
  check("an enemy standing on it gets a spike, not a rebuild",
    denied.placed.length === 1 && denied.placed[0].id === 6,
    JSON.stringify(denied.placed));

  /* No trap in hand. */
  const noTrap = makeWorld({});
  noTrap.myPlayer.items = [0, 3, 6, null, null];
  noTrap.noteVacated(mine(15, 67, 0, 32));
  noTrap.replaceVacated();
  check("with nothing of that kind in hand, a spike holds the ground",
    noTrap.placed.length === 1 && noTrap.placed[0].id === 6);

  const capped = makeWorld({ limitReached: [15] });
  capped.noteVacated(mine(15, 67, 0, 32));
  capped.replaceVacated();
  check("an item at its cap is not sent", capped.placed.length === 0);
}

console.log("\n4. where it goes\n");
{
  /* Ground that the placement ring cannot reach: too close in. */
  const near = makeWorld({});
  near.noteVacated(mine(15, 10, 0, 32));
  near.replaceVacated();
  check("ground the ring cannot reach falls back to the nearest angle",
    near.placed.length === 1 && near.placed[0].deg === 0,
    JSON.stringify(near.placed));

  /* The freed angle is blocked; the next one along should be taken. */
  const blocked = makeWorld({ blocked: [0] });
  blocked.noteVacated(mine(15, 67, 0, 32));
  blocked.replaceVacated();
  check("a blocked freed angle falls back to the nearest placeable one",
    blocked.placed.length === 1 && blocked.placed[0].deg === 5,
    JSON.stringify(blocked.placed));

  /* Everything within a quarter turn blocked: it must not wander. */
  const walled = makeWorld({ blocked: [] });
  for (let d = 0; d < 360; d += 5) if (d <= 90 || d >= 270) walled.blocked.push(d);
  walled.noteVacated(mine(15, 67, 0, 32));
  walled.replaceVacated();
  check("past a quarter turn it is not that ground any more, so nothing is sent",
    walled.placed.length === 0, JSON.stringify(walled.placed));

  /* Out of range. */
  const far = makeWorld({});
  far.noteVacated(mine(15, 400, 0, 32));
  far.replaceVacated();
  check("ground beyond 300 is left alone", far.placed.length === 0);

  const edge = makeWorld({});
  edge.noteVacated(mine(15, 299, 0, 32));
  edge.replaceVacated();
  check("ground just inside 300 is answered", edge.placed.length === 1);
}

console.log("\n5. the dead object, and the ceiling\n");
{
  /* visibleObjects is only rebuilt once a tick, so the corpse can still be in
   * it when Replace runs. It must not block its own replacement. */
  const corpse = mine(15, 67, 0, 32, 77);
  const w = makeWorld({ visibleObjects: [corpse, mine(6, 0, 70, 35, 78)] });
  w.noteVacated(corpse);
  w.replaceVacated();
  check("the destroyed object is excluded from the collision set",
    Array.isArray(w.lastObjects) && !w.lastObjects.some(o => o.sid === 77),
    w.lastObjects ? `${w.lastObjects.length} objects` : "not passed");
  check("but everything else is still in it",
    w.lastObjects.some(o => o.sid === 78));

  /* The packet ceiling is the auto placer's, and it is respected. */
  const tight = makeWorld({ packets: 116 });
  tight.noteVacated(mine(15, 67, 0, 32));
  tight.replaceVacated();
  check("nothing is sent with no packet budget left", tight.placed.length === 0);

  const many = makeWorld({ packets: 100 });
  for (let i = 0; i < 8; i++) many.noteVacated(mine(15, 67, 0, 32, 200 + i));
  many.replaceVacated();
  check("a burst stops at the ceiling rather than blowing it",
    many.window.packets <= 119, `${many.window.packets} packets`);
  check("and the queue is cleared either way", many.queue().length === 0);

  /* Dead player. */
  const dead = makeWorld({});
  dead.noteVacated(mine(15, 67, 0, 32));
  dead.myPlayer.alive = false;
  dead.replaceVacated();
  check("nothing is sent while dead", dead.placed.length === 0);

  /* Toggle off between capture and spend. */
  const flipped = makeWorld({});
  flipped.noteVacated(mine(15, 67, 0, 32));
  flipped.window.vars.replace = false;
  flipped.replaceVacated();
  check("turning it off drops the queue instead of draining it",
    flipped.placed.length === 0 && flipped.queue().length === 0);
}

/* ------------------------------------------------------------------ *
 * Velocity Tick.
 * ------------------------------------------------------------------ */
console.log("\n6. velocity tick — wiring\n");

check("deltek's setTimeout version is gone",
  !/function toptop\(\)/.test(built) && !/}, 93\);/.test(built));
check("the T key and the menu are the same switch",
  /window\.vars\.velocityTick = !window\.vars\.velocityTick;/.test(built) &&
  !/autoVelocityTickToggled = !autoVelocityTickToggled/.test(built));
check("the toggle is in the menu", /name: "Enable Velocity Tick", id: "velocityTick"/.test(built));
check("and defaults off", /\n\s*velocityTick: false,/.test(built));
check("the band is RYN's 220-245, not 222-262",
  /VELOCITY_MIN_KB = 220;/.test(built) && /VELOCITY_MAX_KB = 245;/.test(built) &&
  !/minimumOTRange/.test(built));
check("it arms against the enemy's future position",
  /const futureX = nearestEnemy\.xVel;/.test(built));
check("turret gear on the arm tick, bull on the fire tick",
  /hat\(53, 0\);/.test(built) && /hat\(7, 0\);/.test(built));
check("the trap branch is not present",
  !/velocityTickTrap/i.test(built) && !/_pinnedInMyTrap/.test(built));

/* ---- run the combo ---------------------------------------------- */
const vStart = built.indexOf("                    // ==================== VELOCITY TICK ====================");
const vEndMark = "                        velocityTarget = null;\n                    }";
const vEnd = built.indexOf(vEndMark, vStart);
check("the combo can be extracted", vStart > 0 && vEnd > vStart);

function velocityWorld(o) {
  o = o || {};
  const env = {
    Math, console,
    window: { vars: { velocityTick: o.on !== false } },
    game: { tickRate: 111 },
    myPlayer: { alive: o.alive !== false, sid: 1, x2: 0, y2: 0,
      weapons: [o.primary === undefined ? 5 : o.primary, 15] },
    nearestEnemy: o.enemy === null ? null : Object.assign({
      sid: 2, x2: 230, y2: 0, xVel: 230, yVel: 0, skinIndex: 0, weapons: [7, 10]
    }, o.enemy || {}),
    items: { weapons: { 5: { speed: 300 }, 7: { speed: 100 }, 15: { speed: 1500 } } },
    primaryReload: { 1: o.myPrimary === undefined ? 1 : o.myPrimary,
                     2: o.theirPrimary === undefined ? 0 : o.theirPrimary },
    turretReload: { 1: o.myTurret === undefined ? 1 : o.myTurret },
    velocityTarget: o.armed === undefined ? null : o.armed,
    UTILS: { getDistance: (x1,y1,x2,y2) => Math.hypot(x2-x1, y2-y1) },
    getPlayerInfo: (p, k) => k === "primaryVariant" ? (o.variant === undefined ? 2 : o.variant) : null,
    hats: [], weaponSel: [], sent: [],
    autoaim: false, autoaimAngle: null, predictMoveAngle: null,
    shouldntPathfind: false, keyCodeWeapon: null,
    hat(id) { env.hats.push(id); },
    selectWeapon(w) { env.weaponSel.push(w); },
    io: { send: (t, a) => env.sent.push({ t, a }) }
  };
  env.globalThis = env;
  vm.createContext(env);
  vm.runInContext(built.slice(vStart, vEnd + vEndMark.length) +
    "\nglobalThis.armed = () => velocityTarget;", env, { filename: "velocity.js" });
  return env;
}

console.log("\n7. velocity tick — the combo\n");
{
  const arm = velocityWorld({});
  check("arms in the window", arm.armed() !== null);
  check("with turret gear", arm.hats.indexOf(53) !== -1, JSON.stringify(arm.hats));
  check("and walks at them", typeof arm.predictMoveAngle === "number" && arm.shouldntPathfind);
  check("without swinging yet", arm.sent.length === 0);

  const fire = velocityWorld({ armed: { x2: 200, y2: 0 } });
  check("fires on the next tick", fire.hats.indexOf(7) !== -1, JSON.stringify(fire.hats));
  check("swinging at where they are now", fire.sent.length === 1 && fire.sent[0].t === "F");
  check("and disarms", fire.armed() === null);
  check("with autoaim on the target", fire.autoaim === true && fire.autoaimAngle === 0);
}

console.log("\n8. velocity tick — the gates\n");
{
  const near = velocityWorld({ enemy: { xVel: 150, yVel: 0 } });
  check("too close to need the combo: no arm", near.armed() === null);
  const far = velocityWorld({ enemy: { xVel: 300, yVel: 0 } });
  check("too far for the knockback to reach: no arm", far.armed() === null);
  const edgeLo = velocityWorld({ enemy: { xVel: 220, yVel: 0 } });
  const edgeHi = velocityWorld({ enemy: { xVel: 245, yVel: 0 } });
  check("both edges of the window are inside it",
    edgeLo.armed() !== null && edgeHi.armed() !== null);

  check("no polearm, no combo", velocityWorld({ primary: 1 }).armed() === null);
  check("below diamond, no combo", velocityWorld({ variant: 1 }).armed() === null);
  check("primary not reloaded, no combo", velocityWorld({ myPrimary: 0.5 }).armed() === null);
  check("turret not reloaded, no combo", velocityWorld({ myTurret: 0 }).armed() === null);
  check("no enemy, no combo", velocityWorld({ enemy: null }).armed() === null);
  check("toggled off, no combo", velocityWorld({ on: false }).armed() === null);

  /* Hats the combo cannot beat. The enemy needs a weapon slower than one tick
   * for the hat to be the deciding term at all — a dagger reloads in 100ms, so
   * its holder is always about to swing and the shot is always worth taking.
   * Polearm at 300ms is the honest case. */
  const slow = { weapons: [5, 10] };
  const soldier = velocityWorld({ enemy: Object.assign({ skinIndex: 6 }, slow), theirPrimary: 0 });
  check("a soldier hat is not worth the turret", soldier.armed() === null);
  const absorber = velocityWorld({ enemy: Object.assign({ skinIndex: 22 }, slow), theirPrimary: 0 });
  check("hat 22 eats the knockback, so it is not worth it", absorber.armed() === null);
  const plain = velocityWorld({ enemy: Object.assign({ skinIndex: 0 }, slow), theirPrimary: 0 });
  check("an ordinary hat is", plain.armed() !== null);

  /* ...and a swing about to land justifies it whatever they are wearing. */
  const swinging = velocityWorld({ enemy: Object.assign({ skinIndex: 6 }, slow), theirPrimary: 0.9 });
  check("a swing about to land is worth it regardless of the hat",
    swinging.armed() !== null);
  const dagger = velocityWorld({ enemy: { skinIndex: 6 }, theirPrimary: 0 });
  check("and a dagger holder is always about to swing", dagger.armed() !== null);

  /* Half-fired combo must not survive being switched off or dying. */
  const dropped = velocityWorld({ on: false, armed: { x2: 200, y2: 0 } });
  check("toggling off mid-combo drops the armed target", dropped.armed() === null);
  check("and does not swing", dropped.sent.length === 0);
  const dead = velocityWorld({ alive: false, armed: { x2: 200, y2: 0 } });
  check("dying mid-combo drops it too", dead.armed() === null);
}

/* ------------------------------------------------------------------ */
console.log("\n9. nothing else moved\n");
{
  const a = SRC.split("\n");
  const b = built.split("\n");
  let added = 0;
  const removed = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (b[j] !== undefined && a.indexOf(b[j], i) === -1) { added++; j++; continue; }
    if (a[i] !== undefined && b.indexOf(a[i], j) === -1) { removed.push(a[i]); i++; continue; }
    i++; j++;
  }
  /* Replace is purely additive. Velocity Tick is not: it takes deltek's own
   * setTimeout version out. So the bar is that every removed line belongs to
   * that old version and nothing else. */
  const OLD_VELOCITY = [
    "function toptop() {", "if (primaryReload[myPlayer.sid] == 1 && turretReload[myPlayer.sid] == 1) {",
    "setTimeout(() => {", "autoaim = true;", "hat(53, 0);", "hat(7, 0);",
    "io.send(\"F\", 1);", "autoaim = false;", "io.send(\"F\", 0);", "}, 210);", "}, 93);",
    "if (autoVelocityTickToggled) {", "if (nearestEnemy && myPlayer && myPlayer.alive) {",
    "// velocity range around 242", "let minimumOTRange = 222; // 242 - 20",
    "let maximumOTRange = 262; // 242 + 20", "// simple velocity calculation",
    "let distance = UTILS.getDistance(", "myPlayer.x2, myPlayer.y2,",
    "nearestEnemy.x2, nearestEnemy.y2", ");",
    "if (!nearestTrap && (distance < maximumOTRange && distance > minimumOTRange)) {",
    "toptop(); // replace with your function", "}", "}", "}",
    "keyCodeWeapon = myPlayer.weapons[0];", "selectWeapon(keyCodeWeapon);",
    "autoVelocityTickToggled = !autoVelocityTickToggled;",
    "const oneFrameStatus = autoVelocityTickToggled ? \"on\" : \"off\";"
  ];
  const unexpected = removed.filter(l => OLD_VELOCITY.indexOf(l.trim()) === -1);
  check("the only lines removed are deltek's old velocity tick",
    unexpected.length === 0, unexpected.slice(0, 3).map(s => s.trim()).join(" | "));
  check("the additions are the two features and their hooks",
    added > 150 && added < 330, `${added} lines added`);
}

console.log(failed
  ? `\nverify-deltek: ${failed} check(s) failed\n`
  : "\nverify-deltek: all checks pass\n");
process.exit(failed ? 1 : 0);
