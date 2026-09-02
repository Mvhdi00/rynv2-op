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
check("it runs in the tick, after the auto placer and the retrap rush",
  /\/\/ RETRAP RUSH\n\s*retrapRush\(\);\n\s*\n\s*\/\/ REPLACE\n\s*replaceVacated\(\);/.test(built));
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
console.log("\n6. velocity tick\n");

check("deltek's setTimeout version is gone",
  !/function toptop\(\)/.test(built) && !/}, 93\);/.test(built));
check("it speaks deltek's own combo vocabulary",
  /instaKill = \["turret", "primary", "stop"\];/.test(built));
check("and never equips hats itself — deltek's hat stage does that from `insta`",
  !/hat\(53, 0\);[\s\S]{0,400}instaKill = \["turret"/.test(built) &&
  /if \(insta\.primary && isBoughtHat\(7, 0\)\)/.test(built) &&
  /\(insta\.primaryturret \|\| insta\.turret\) && isBoughtHat\(53, 0\)/.test(built));
check("it does not touch movement at all",
  !/predictMoveAngle = armAngle|predictMoveAngle = fireAngle/.test(built));
check("it yields to a combo already running",
  /nearestEnemy && !instaKill\.length/.test(built));
check("the band is RYN's 220-245, not 222-262",
  /vtDist >= 220 && vtDist <= 245/.test(built) && !/minimumOTRange/.test(built));
check("it measures the enemy's future position",
  /nearestEnemy\.xVel, nearestEnemy\.yVel\n\s*\);/.test(built));
check("it is a real keybind with an on-screen notice",
  /keyStr === window\.vars\.keyVelocityTick/.test(built) &&
  /keyVelocityTick: "T",/.test(built) &&
  /name: "Velocity Tick", id: "keyVelocityTick"/.test(built) &&
  !/velotick:/.test(built));
check("the trap branch is not present", !/velocityTickTrap/i.test(built));

const vStart = built.indexOf("                    // ==================== VELOCITY TICK ====================");
const vEndMark = 'instaKill = ["turret", "primary", "stop"];\n                            }\n                        }\n                    }';
const vEnd = built.indexOf(vEndMark, vStart);
check("the combo can be extracted", vStart > 0 && vEnd > vStart);

function velocityWorld(o) {
  o = o || {};
  const env = {
    Math, console,
    window: { vars: { velocityTick: o.on !== false } },
    game: { tickRate: 111 },
    instaKill: o.busy ? ["secondary", "stop"] : [],
    myPlayer: { alive: o.alive !== false, sid: 1, x2: 0, y2: 0,
      weapons: [o.primary === undefined ? 5 : o.primary, 15] },
    nearestEnemy: o.enemy === null ? null : Object.assign({
      sid: 2, x2: 230, y2: 0, xVel: 230, yVel: 0, skinIndex: 0, weapons: [7, 10], scale: 35
    }, o.enemy || {}),
    items: { weapons: { 5: { speed: 300 }, 7: { speed: 100 }, 15: { speed: 1500 } } },
    primaryReload: { 1: o.myPrimary === undefined ? 1 : o.myPrimary,
                     2: o.theirPrimary === undefined ? 0 : o.theirPrimary },
    turretReload: { 1: o.myTurret === undefined ? 1 : o.myTurret },
    UTILS: { getDistance: (x1,y1,x2,y2) => Math.hypot(x2-x1, y2-y1) },
    getPlayerInfo: (p, k) => k === "primaryVariant" ? (o.variant === undefined ? 2 : o.variant) : null
  };
  env.globalThis = env;
  vm.createContext(env);
  vm.runInContext(built.slice(vStart, vEnd + vEndMark.length), env, { filename: "velocity.js" });
  return env;
}

console.log("\n7. velocity tick — the combo\n");
{
  const fire = velocityWorld({});
  check("in the window, it queues the whole combo",
    fire.instaKill.join(",") === "turret,primary,stop", JSON.stringify(fire.instaKill));
  check("turret first, so the shot goes out before the swing",
    fire.instaKill[0] === "turret");
  check("then the polearm, which is where hat 7 comes from",
    fire.instaKill[1] === "primary");
  check("and a stop, so it does not hold the attack down",
    fire.instaKill[2] === "stop");

  const busy = velocityWorld({ busy: true });
  check("a combo already running is not stomped",
    busy.instaKill.join(",") === "secondary,stop");
}

console.log("\n8. velocity tick — the gates\n");
{
  const armed = o => velocityWorld(o).instaKill.length > 0;
  check("too close to need the combo", !armed({ enemy: { xVel: 150 } }));
  check("too far for the knockback to reach", !armed({ enemy: { xVel: 300 } }));
  check("both edges of the window are inside it",
    armed({ enemy: { xVel: 220 } }) && armed({ enemy: { xVel: 245 } }));
  check("no polearm, no combo", !armed({ primary: 1 }));
  check("below diamond, no combo", !armed({ variant: 1 }));
  check("primary not reloaded, no combo", !armed({ myPrimary: 0.5 }));
  check("turret not reloaded, no combo", !armed({ myTurret: 0 }));
  check("no enemy, no combo", !armed({ enemy: null }));
  check("toggled off, no combo", !armed({ on: false }));
  check("dead, no combo", !armed({ alive: false }));

  /* The hat term only decides when their weapon is slower than a tick. */
  const slow = { weapons: [5, 10] };
  check("a soldier hat is not worth the turret",
    !armed({ enemy: Object.assign({ skinIndex: 6 }, slow), theirPrimary: 0 }));
  check("hat 22 eats the knockback, so it is not worth it",
    !armed({ enemy: Object.assign({ skinIndex: 22 }, slow), theirPrimary: 0 }));
  check("an ordinary hat is",
    armed({ enemy: Object.assign({ skinIndex: 0 }, slow), theirPrimary: 0 }));
  check("a swing about to land is worth it whatever they wear",
    armed({ enemy: Object.assign({ skinIndex: 6 }, slow), theirPrimary: 0.9 }));
  check("and a dagger holder is always about to swing",
    armed({ enemy: { skinIndex: 6 }, theirPrimary: 0 }));
}

/* ------------------------------------------------------------------ *
 * Retrap rush.
 * ------------------------------------------------------------------ */
console.log("\n9. retrap rush\n");

check("it runs before Replace and the escape ring",
  /\/\/ RETRAP RUSH\n\s*retrapRush\(\);\n\s*\n\s*\/\/ REPLACE/.test(built));
check("the toggle is in the menu and defaults on",
  /name: "Rush The Next Trap", id: "retrapRush"/.test(built) &&
  /\n\s*retrapRush: true,/.test(built));
check("it uses deltek's own angle sweep",
  /getPrePlaceAngles\(id, objects\)/.test(built));

const qStart = built.indexOf("        // ==================== RETRAP RUSH ====================");
const qEndMark = "            placedAngles.push(best.angle);\n        }";
const qEnd = built.indexOf(qEndMark, qStart);
check("the feature can be extracted", qStart > 0 && qEnd > qStart);

function rushWorld(o) {
  o = o || {};
  const heldTrap = o.held === null ? null
    : Object.assign({ sid: 900, x: 0, y: 0, scale: 32 }, o.held || {});
  const env = {
    Math, console,
    window: { vars: { retrapRush: o.on !== false }, packets: o.packets || 0 },
    myPlayer: { alive: o.alive !== false, sid: 1, x2: 0, y2: 0, items: [0, 3, 6, null, 15] },
    nearestEnemy: o.enemy === null ? null
      : Object.assign({ sid: 2, x2: 0, y2: 0, xVel: 0, yVel: 0, scale: 35 }, o.enemy || {}),
    traps_our: heldTrap ? [heldTrap] : [],
    visibleObjects: [heldTrap, { sid: 901 }].filter(Boolean),
    placedAngles: [],
    placed: [],
    limitReached: o.limitReached || [],
    UTILS: { getDistance: (x1,y1,x2,y2) => Math.hypot(x2-x1, y2-y1) },
    isItemLimit(id) { return env.limitReached.indexOf(id) !== -1; },
    /* deltek's sweep: 72 angles on the placement ring, scale 32, all legal
     * unless the scenario says otherwise. */
    getPrePlaceAngles(id, objects) {
      env.lastObjects = objects;
      const out = [];
      for (let i = 0; i < 72; i++) {
        const angle = i * (Math.PI * 2 / 72);
        const r = o.ring === undefined ? 67 : o.ring;
        out.push({
          angle, scale: 32,
          x: Math.cos(angle) * r, y: Math.sin(angle) * r,
          placeable: (o.unplaceable || []).indexOf(i) === -1
        });
      }
      return out;
    },
    place(id, angle) { env.placed.push({ id, angle }); env.window.packets += 5; }
  };
  env.globalThis = env;
  vm.createContext(env);
  vm.runInContext(built.slice(qStart, qEnd + qEndMark.length), env, { filename: "retraprush.js" });
  return env;
}

{
  const w = rushWorld({});
  w.retrapRush();
  check("an enemy held in my trap gets the next one placed",
    w.placed.length === 1 && w.placed[0].id === 15, JSON.stringify(w.placed));
  check("the trap already holding them is not counted as competition",
    Array.isArray(w.lastObjects) && !w.lastObjects.some(o => o && o.sid === 900) &&
    w.lastObjects.some(o => o && o.sid === 901));

  const free = rushWorld({ held: null });
  free.retrapRush();
  check("an enemy who is not held gets nothing", free.placed.length === 0);

  const off = rushWorld({ on: false });
  off.retrapRush();
  check("nor when the toggle is off", off.placed.length === 0);

  const none = rushWorld({ enemy: null });
  none.retrapRush();
  check("nor with no enemy", none.placed.length === 0);

  const dead = rushWorld({ alive: false });
  dead.retrapRush();
  check("nor while dead", dead.placed.length === 0);

  const capped = rushWorld({ limitReached: [15] });
  capped.retrapRush();
  check("traps at their cap send nothing", capped.placed.length === 0);

  const broke = rushWorld({ packets: 116 });
  broke.retrapRush();
  check("and neither does an empty packet budget", broke.placed.length === 0);

  /* Out of reach of the target: a trap on the floor is not a retrap. */
  const farRing = rushWorld({ ring: 400 });
  farRing.retrapRush();
  check("a placement that cannot reach them is not made", farRing.placed.length === 0);

  /* Every angle refused. */
  const blocked = rushWorld({ unplaceable: Array.from({ length: 72 }, (_, i) => i) });
  blocked.retrapRush();
  check("nothing legal, nothing sent", blocked.placed.length === 0);

  /* It aims at where they will be, not where they are. */
  const moving = rushWorld({ enemy: { x2: 0, y2: 0, xVel: 60, yVel: 0 } });
  moving.retrapRush();
  check("it aims at where they will be",
    moving.placed.length === 1 &&
    Math.abs(moving.placed[0].angle) < 0.5, JSON.stringify(moving.placed));
}

/* ------------------------------------------------------------------ *
 * Naming. Labels only — the setting ids and the code behind them are the
 * things that must NOT have moved.
 * ------------------------------------------------------------------ */
console.log("\n10. spike tick — naming\n");

check("the spike tick is findable in the menu",
  /name: "Spike Tick", id: "shameTick"/.test(built) && !/Clown Aids/.test(built));
check("so is its second variant",
  /name: "Spike Tick 2", id: "shameTick2"/.test(built) && !/LOL aids/i.test(built));
check("and the shame grinder", 
  /name: "Shame Grinder", id: "shameGrind"/.test(built) && !/Giving Aids/.test(built));
check("the toasts name the feature that fired",
  /showSettingText\(900, "Spike Tick"\)/.test(built) &&
  /showSettingText\(900, "Spike Tick 2"\)/.test(built));

/* The ids are the contract: rename the label, keep the setting. */
for (const id of ["shameTick", "shameTick2", "shameGrind"]) {
  const re = new RegExp(`window\\.vars\\.${id}\\b`, "g");
  check(`window.vars.${id} is untouched`,
    (built.match(re) || []).length === (SRC.match(re) || []).length,
    `${(built.match(re) || []).length} vs ${(SRC.match(re) || []).length}`);
}

/* And the functions those settings gate are byte-identical to deltek's own. */
function fnBody(src, name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) return null;
  let d = 0, o = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "{") { d++; o = true; }
    else if (c === "}") { d--; if (o && d === 0) return src.slice(i, j + 1); }
  }
  return null;
}
for (const fn of ["canTrapTick", "canTrapTick2", "advancedShameCombat",
                  "canVelocitySpikeTick", "doSmartTickAnti", "canSmartTick",
                  "canShamePlus", "canAutoShame", "canShamePlace"]) {
  const before = fnBody(SRC, fn);
  const after = fnBody(built, fn);
  /* canTrapTick and canTrapTick2 carry a toast string that was renamed; every
   * other line of them, and all of the rest, must be identical. */
  const renamedToast = fn === "canTrapTick" || fn === "canTrapTick2";
  const norm = x => x && x.replace(/showSettingText\(900, "[^"]*"\)/g, "TOAST");
  check(`${fn}() is unchanged${renamedToast ? " apart from its toast" : ""}`,
    before !== null && after !== null &&
    (renamedToast ? norm(before) === norm(after) : before === after));
}

/* ------------------------------------------------------------------ *
 * Trap escape ring.
 * ------------------------------------------------------------------ */
console.log("\n11. trap escape ring\n");

check("it runs in the tick, after Replace",
  /\/\/ TRAP ESCAPE RING\n\s*trapEscapeRing\(\);/.test(built));
check("the toggle is in the menu and defaults on",
  /name: "Hold The Four Ways In", id: "trapEscapeRing"/.test(built) &&
  /\n\s*trapEscapeRing: true,/.test(built));
check("near-break uses deltek's own test, not a new one",
  /trap\.health > breakDmg/.test(built) &&
  /getPlayerInfo\(myPlayer, "secondaryStructureDmg"\)/.test(built));

const rStart = built.indexOf("        // ==================== TRAP ESCAPE RING ====================");
const rEndMark = "            escapeRingAngles = left;\n        }";
const rEnd = built.indexOf(rEndMark, rStart);
check("the ring can be extracted", rStart > 0 && rEnd > rStart);

function ringWorld(o) {
  o = o || {};
  const trap = o.trap === null ? null
    : Object.assign({ sid: 500, health: 10, scale: 32 }, o.trap || {});
  const env = {
    Math, console,
    window: { vars: { trapEscapeRing: o.on !== false }, packets: o.packets || 0 },
    myPlayer: { alive: o.alive !== false, sid: 1, x2: 0, y2: 0, items: [0, 3, 6, null, 15] },
    imTrapped: o.trapped === false ? null : trap,
    trap_where_im_in: trap,
    visibleObjects: o.visibleObjects || [],
    placedAngles: [],
    placed: [],
    blocked: o.blocked || [],
    limitReached: o.limitReached || [],
    /* primary 20, hammer 30 -> a 10hp trap dies to one hit */
    getPlayerInfo: (p, k) => k === "primaryStructureDmg" ? 20
      : k === "secondaryStructureDmg" ? 30 : 0,
    isItemLimit(id) { return env.limitReached.indexOf(id) !== -1; },
    canPlace(id, angle, objects) {
      env.lastObjects = objects;
      const deg = Math.round((angle * 180 / Math.PI + 360) % 360) % 360;
      return env.blocked.indexOf(deg) === -1;
    },
    place(id, angle) {
      env.placed.push({ id, deg: Math.round((angle * 180 / Math.PI + 360) % 360) % 360 });
      env.window.packets += 5;
    }
  };
  env.globalThis = env;
  vm.createContext(env);
  vm.runInContext(built.slice(rStart, rEnd + rEndMark.length) +
    "\nglobalThis.pending = () => escapeRingAngles;", env, { filename: "trapring.js" });
  return env;
}

{
  const w = ringWorld({});
  w.trapEscapeRing();
  check("a trap one hit from breaking gets the ring",
    w.placed.length === 4, JSON.stringify(w.placed.map(p => p.deg)));
  check("right, left, up and down",
    w.placed.map(p => p.deg).sort((a, b) => a - b).join(",") === "0,90,180,270");
  check("spikes, which deny the ground rather than just block it",
    w.placed.every(p => p.id === 6));
  check("and it does not lay it twice", (w.trapEscapeRing(), w.placed.length === 4));

  const healthy = ringWorld({ trap: { health: 200 } });
  healthy.trapEscapeRing();
  check("a trap that is not close to breaking is left alone", healthy.placed.length === 0);

  const free = ringWorld({ trapped: false });
  free.trapEscapeRing();
  check("nothing happens when not trapped", free.placed.length === 0);

  const off = ringWorld({ on: false });
  off.trapEscapeRing();
  check("nor when the toggle is off", off.placed.length === 0);

  const dead = ringWorld({ alive: false });
  dead.trapEscapeRing();
  check("nor while dead", dead.placed.length === 0);

  /* The trap must not be what refuses the ring — it is about to be gone. */
  const corpse = ringWorld({ visibleObjects: [{ sid: 500 }, { sid: 501 }] });
  corpse.trapEscapeRing();
  check("the trap is excluded from the collision set",
    Array.isArray(corpse.lastObjects) && !corpse.lastObjects.some(o => o.sid === 500) &&
    corpse.lastObjects.some(o => o.sid === 501));

  /* A way in that is already held is not asked about again. */
  const partial = ringWorld({ blocked: [90, 270] });
  partial.trapEscapeRing();
  check("a way in something already holds is skipped",
    partial.placed.length === 2 &&
    partial.placed.map(p => p.deg).sort((a, b) => a - b).join(",") === "0,180");
  check("and is not retried", (partial.trapEscapeRing(), partial.placed.length === 2));

  /* Budget: only two fit, the rest carry to the next tick. */
  const tight = ringWorld({ packets: 108 });
  tight.trapEscapeRing();
  check("what does not fit the packet budget waits",
    tight.placed.length === 2 && tight.pending().length === 2,
    `${tight.placed.length} placed, ${tight.pending().length} pending`);
  tight.window.packets = 0;
  tight.trapEscapeRing();
  check("and goes down on the next tick", tight.placed.length === 4);

  /* A different trap starts a fresh ring. */
  const again = ringWorld({});
  again.trapEscapeRing();
  again.trap_where_im_in = { sid: 600, health: 10, scale: 32 };
  again.imTrapped = again.trap_where_im_in;
  again.trapEscapeRing();
  check("being re-trapped lays a fresh ring", again.placed.length === 8);

  /* Escaping clears the state so the next trap is not treated as the same one. */
  const escaped = ringWorld({});
  escaped.trapEscapeRing();
  escaped.imTrapped = null;
  escaped.trap_where_im_in = null;
  escaped.trapEscapeRing();
  check("escaping clears the ring's memory", escaped.pending().length === 0);

  const capped = ringWorld({ limitReached: [6] });
  capped.trapEscapeRing();
  check("spikes at their cap send nothing", capped.placed.length === 0);
}

/* ------------------------------------------------------------------ */
console.log("\n12. nothing else moved\n");
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
    "const oneFrameStatus = autoVelocityTickToggled ? \"on\" : \"off\";",
    /* labels and toasts, renamed in place */
    "{ type: 'toggle', name: \"Clown Aids\", id: \"shameTick\" },",
    "{ type: 'toggle', name: \"LOL aids\", id: \"shameTick2\" },",
    "{ type: 'toggle', name: \"Giving Aids\", id: \"shameGrind\" },",
    "showSettingText(900, \"LOL Aids\")",
    "showSettingText(900, \"LOL aids\")",
    /* the old hardcoded T key and its chat announcement */
    "} else if (event.key == \"T\") {",
    "sendChat(`velotick: ${(oneFrameStatus)}`);",
    /* gained a trailing comma when the velocity keybind was appended after it */
    "{ type: 'keybind', name: \"Auto Clear\", id: \"keyPathBreak\" }"
  ];
  const unexpected = removed.filter(l => OLD_VELOCITY.indexOf(l.trim()) === -1);
  check("the only lines removed are deltek's old velocity tick",
    unexpected.length === 0, unexpected.slice(0, 3).map(s => s.trim()).join(" | "));
  check("the additions are the two features and their hooks",
    added > 150 && added < 520, `${added} lines added`);
}

console.log(failed
  ? `\nverify-deltek: ${failed} check(s) failed\n`
  : "\nverify-deltek: all checks pass\n");
process.exit(failed ? 1 : 0);
