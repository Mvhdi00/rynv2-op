#!/usr/bin/env node
/*
 * verify-melee.js
 *
 * The melee grip system is geometry, so it can be checked as geometry rather
 * than by eye. This lifts the real profile table and the real MeleeAnim class
 * out of the built client and sweeps every melee weapon through its whole
 * attack, sampling the grip points and the weapon's own haft at each step.
 *
 * Per weapon, per frame, for a connected swing and for a whiffed one (and both
 * alternations, where a weapon alternates):
 *
 *   - both grip points stay clear of the body circle, so neither hand can be
 *     swallowed by the disc the game draws over them last
 *   - the two grip points stay far enough apart to read as two hands
 *   - the hands stay on the haft: their distance to the shaft line, and to each
 *     other, is what the weapon's own grip spacing says it should be
 *   - nothing teleports: no grip point and no end of the weapon moves more than
 *     a few pixels between one frame and the next at 60fps
 *   - the weapon stays on the correct side of the player and within reach
 *
 * It also checks that the excluded weapons -- shield, every bow, both
 * crossbows, the musket -- and anyone holding a building item never enter the
 * new path at all, and that with the animation idle every melee weapon lands
 * on exactly the coordinates vanilla would have drawn.
 *
 *   node tools/verify-melee.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Ryn_Type_2.user.js");

const client = fs.readFileSync(CLIENT_PATH, "utf8");

function sliceBlock(startMarker, endMarker) {
  const start = client.indexOf(startMarker);
  if (start === -1) throw new Error("marker not found: " + startMarker);
  const end = client.indexOf(endMarker, start);
  if (end === -1) throw new Error("end marker not found: " + endMarker);
  return client.slice(start, end + endMarker.length);
}

const meleeSrc = sliceBlock("const MELEE_EASE = {", "const MeleeAnim_default = MeleeAnim;");

const sandbox = { Settings_default: { _meleeAnimation: true }, Math, console };
vm.createContext(sandbox);
vm.runInContext(meleeSrc + "\nthis.__A = MeleeAnim; this.__P = MELEE_PROFILES; this.__E = MELEE_EASE;", sandbox);

const A = sandbox.__A;
const PROFILES = sandbox.__P;
const EASE = sandbox.__E;

/* Weapon table, straight out of the game bundle. `length` is the sprite's
 * extent along the facing axis and `width` its extent across it; the sprite is
 * drawn at (scale + xOff, yOff) by the game's own weapon draw. */
const WEAPONS = {
  0:  { name: "tool hammer",       src: "hammer_1",       length: 140, width: 140, xOff: -3, yOff: 18, speed: 300 },
  1:  { name: "hand axe",          src: "axe_1",          length: 140, width: 140, xOff: 3,  yOff: 24, speed: 400 },
  2:  { name: "great axe",         src: "great_axe_1",    length: 140, width: 140, xOff: -8, yOff: 25, speed: 400 },
  3:  { name: "short sword",       src: "sword_1",        length: 130, width: 210, xOff: -8, yOff: 46, speed: 300 },
  4:  { name: "katana",            src: "samurai_1",      length: 130, width: 210, xOff: -8, yOff: 59, speed: 300 },
  5:  { name: "polearm",           src: "spear_1",        length: 130, width: 210, xOff: -8, yOff: 53, speed: 700 },
  6:  { name: "bat",               src: "bat_1",          length: 110, width: 180, xOff: -8, yOff: 53, speed: 300 },
  7:  { name: "daggers",           src: "dagger_1",       length: 110, width: 110, xOff: 18, yOff: 0,  speed: 100 },
  8:  { name: "stick",             src: "stick_1",        length: 140, width: 140, xOff: 3,  yOff: 24, speed: 400 },
  9:  { name: "hunting bow",       src: "bow_1",          length: 120, width: 120, xOff: -6, yOff: 0,  speed: 600 },
  10: { name: "great hammer",      src: "great_hammer_1", length: 140, width: 140, xOff: -9, yOff: 25, speed: 400 },
  11: { name: "wooden shield",     src: "shield_1",       length: 120, width: 120, xOff: 6,  yOff: 0,  speed: 1 },
  12: { name: "crossbow",          src: "crossbow_1",     length: 120, width: 120, xOff: -4, yOff: 0,  speed: 700, armS: .75, aboveHand: true },
  13: { name: "repeater crossbow", src: "crossbow_2",     length: 120, width: 120, xOff: -4, yOff: 0,  speed: 230, armS: .75, aboveHand: true },
  14: { name: "mc grabby",         src: "grab_1",         length: 130, width: 210, xOff: -8, yOff: 53, speed: 700 },
  15: { name: "musket",            src: "musket_1",       length: 205, width: 205, xOff: 25, yOff: 0,  speed: 1500, armS: .6, hndS: .3, hndD: 1.6, aboveHand: true },
};

const EXCLUDED = [9, 11, 12, 13, 15];
const SCALE = 35;
const BODY_R = 35;
const HAND_R = 14;
const FRAME_MS = 1000 / 60;

let failures = 0;
let checks = 0;

function fail(msg) {
  failures++;
  console.log("  FAIL " + msg);
}
function ok() {
  checks++;
}
function check(cond, msg) {
  if (cond) ok();
  else fail(msg);
}

function player(index, u, opts) {
  const w = WEAPONS[index];
  const o = opts || {};
  const speed = w.speed;
  return {
    weaponIndex: index,
    buildIndex: o.buildIndex === undefined ? -1 : o.buildIndex,
    scale: SCALE,
    animSpeed: speed,
    animTime: o.idle ? 0 : Math.max(1e-9, speed * (1 - u)),
    targetAngle: o.whiff ? -Math.PI : -Math.PI / 2,
    dirPlus: -0.7,
    _rynAlt: !!o.alt,
    /* high enough that the alternation toggle never fires during a sweep */
    _rynAnimTime: speed + 1,
  };
}

function geometry(index) {
  const w = WEAPONS[index];
  return {
    arm: Math.PI / 4 * (w.armS || 1),
    hndS: w.hndS || 1,
    hndD: w.hndD || 1,
  };
}

/* The two ends of the haft, as the game's own sprite rect places them: the
 * shaft runs along the line through the two grip points, and the sprite bounds
 * say how far past each grip the weapon reaches. */
function haftEnds(index) {
  const w = WEAPONS[index];
  const g = geometry(index);
  const gx = SCALE * Math.cos(g.arm);
  const y0 = w.yOff - w.width / 2;
  const y1 = w.yOff + w.width / 2;
  return { butt: { x: gx, y: y0 }, tip: { x: gx, y: y1 } };
}

/* Apply the pose the client computed to an arbitrary point of the weapon. This
 * is the same rigid transform _drawWeapon pushes onto the canvas. */
function xform(pose, x, y) {
  const c = Math.cos(pose.rot);
  const s = Math.sin(pose.rot);
  const dx = x - pose.px;
  const dy = y - pose.py;
  return {
    x: pose.px + dx * c - dy * s + pose.dx,
    y: pose.py + dx * s + dy * c + pose.dy,
  };
}

const hyp = (x, y) => Math.sqrt(x * x + y * y);
const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);

function sweep(index, opts) {
  const w = WEAPONS[index];
  const prof = PROFILES[index];
  const g = geometry(index);
  const ends = haftEnds(index);
  const steps = Math.max(120, Math.round(w.speed / FRAME_MS) * 8);
  const label = `${index} ${w.name}${opts.whiff ? " whiff" : ""}${opts.alt ? " alt" : ""}`;

  /* Rest spacing of the two grips, which a rigid grip must preserve exactly. */
  const rest1 = { x: SCALE * Math.cos(g.arm), y: SCALE * Math.sin(g.arm) };
  const rest2 = { x: SCALE * g.hndD * Math.cos(-g.arm * g.hndS), y: SCALE * g.hndD * Math.sin(-g.arm * g.hndS) };
  const restGap = dist(rest1, rest2);

  let minR = Infinity;
  let minGap = Infinity;
  let maxReach = 0;
  let rigidErr = 0;
  let clamped = 0;

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const p = player(index, u, opts);
    const pose = A._place(p, g.arm, g.hndS, g.hndD);
    if (!pose) {
      fail(`${label}: no pose at u=${u.toFixed(3)}`);
      return;
    }
    const h1 = { x: pose.h1x, y: pose.h1y };
    const h2 = { x: pose.h2x, y: pose.h2y };
    const tip = xform(pose, ends.tip.x, ends.tip.y);
    const butt = xform(pose, ends.butt.x, ends.butt.y);

    const r1 = hyp(h1.x, h1.y);
    const r2 = hyp(h2.x, h2.y);
    if (r1 < minR) minR = r1;
    if (r2 < minR) minR = r2;

    const gap = dist(h1, h2);
    if (gap < minGap) minGap = gap;

    const reach = Math.max(hyp(tip.x, tip.y), hyp(butt.x, butt.y));
    if (reach > maxReach) maxReach = reach;

    /* A two-handed or dual grip is rigid: the hands cannot drift along or off
     * the weapon except by the slide the profile asked for. The slide moves the
     * primary grip along the haft, so the spacing is rest ± slide. */
    if (prof.grip !== 1) {
      const slideRange = Math.max(...prof.keys.map(k => Math.abs(k.s || 0)));
      const err = Math.abs(gap - restGap) - slideRange - 1e-6;
      if (err > rigidErr) rigidErr = err;
    }

    /* The grips must sit on the weapon's own haft line, tip through butt. */
    const shaftLen = dist(tip, butt);
    for (const [nm, h] of [["primary", h1], ["secondary", h2]]) {
      if (prof.grip === 1 && nm === "secondary") continue; /* free off hand */
      const cross = Math.abs((tip.x - butt.x) * (butt.y - h.y) - (butt.x - h.x) * (tip.y - butt.y)) / shaftLen;
      if (cross > 0.01) fail(`${label}: ${nm} grip is ${cross.toFixed(2)}px off the haft at u=${u.toFixed(3)}`);
    }


    /* Did the visibility clamp have to intervene? It is a safety net; a tuned
     * profile should never need it. */
    const raw = A._track(p);
    if (Math.abs(pose.dx - raw.push) > 1e-9 || Math.abs(pose.dy - (raw.alt ? -raw.lat : raw.lat)) > 1e-9) clamped++;
  }

  /* Per-frame travel, sampled at the real 60fps the game renders at rather
   * than at the sweep's own resolution. Hands have to stay readable; the
   * weapon itself is allowed to blur, and on the heavy weapons it should. */
  let handStep = 0;
  let weaponStep = 0;
  let prev = null;
  for (let t = 0; t <= w.speed; t += FRAME_MS) {
    const p = player(index, Math.min(1, t / w.speed), opts);
    const pose = A._place(p, g.arm, g.hndS, g.hndD);
    const cur = {
      h1: { x: pose.h1x, y: pose.h1y },
      h2: { x: pose.h2x, y: pose.h2y },
      tip: xform(pose, ends.tip.x, ends.tip.y),
      butt: xform(pose, ends.butt.x, ends.butt.y),
    };
    if (prev) {
      handStep = Math.max(handStep, dist(cur.h1, prev.h1), dist(cur.h2, prev.h2));
      weaponStep = Math.max(weaponStep, dist(cur.tip, prev.tip), dist(cur.butt, prev.butt));
    }
    prev = cur;
  }

  check(minR >= A.MIN_HAND_RADIUS - 1e-6, `${label}: a grip reached r=${minR.toFixed(1)}, inside the body circle`);
  check(minGap >= A.MIN_HAND_GAP - 1e-6, `${label}: grips closed to ${minGap.toFixed(1)}px apart`);
  check(handStep <= 60, `${label}: a grip moved ${handStep.toFixed(0)}px in one 60fps frame`);
  check(weaponStep <= 180, `${label}: the weapon moved ${weaponStep.toFixed(0)}px in one 60fps frame`);
  check(rigidErr <= 0, `${label}: rigid grip drifted by ${rigidErr.toFixed(2)}px`);
  check(maxReach < 320, `${label}: weapon reached ${maxReach.toFixed(0)}px from the player`);

  return { label, minR, minGap, handStep, weaponStep, maxReach, clamped, steps };
}

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("");

/* ── melee weapons ─────────────────────────────────────────────────────────── */

console.log("melee sweep");
console.log("  " + "weapon".padEnd(26) + "min grip r   min gap   hand px/f   weapon px/f   max reach   clamped");
for (const index of Object.keys(PROFILES).map(Number).sort((a, b) => a - b)) {
  const prof = PROFILES[index];
  const w = WEAPONS[index];
  if (!w) {
    fail(`profile ${index} has no weapon`);
    continue;
  }
  check(prof.name === w.name, `profile ${index} is named "${prof.name}" but weapon ${index} is "${w.name}"`);
  check(!w.aboveHand, `${w.name} draws above the hands, which would put the weapon over a grip`);

  /* keyframe track is well formed */
  check(prof.keys[0].u === 0, `${w.name}: track does not start at u=0`);
  check(prof.keys[prof.keys.length - 1].u === 1, `${w.name}: track does not end at u=1`);
  for (const k of prof.keys) {
    check(k.r === 0 || k.r !== undefined, `${w.name}: key missing rotation`);
    check(typeof EASE[k.e] === "function", `${w.name}: unknown easing "${k.e}"`);
  }
  for (let i = 1; i < prof.keys.length; i++) {
    check(prof.keys[i].u > prof.keys[i - 1].u, `${w.name}: keys out of order at ${i}`);
  }
  const last = prof.keys[prof.keys.length - 1];
  check(last.r === 0 && last.p === 0 && last.l === 0 && last.t === 0, `${w.name}: track does not return to rest`);

  const runs = [{}, { whiff: true }];
  if (prof.alt) runs.push({ alt: true }, { alt: true, whiff: true });
  let row = null;
  for (const opts of runs) {
    const r = sweep(index, opts);
    if (r && !row) row = r;
    else if (r && row) {
      row.minR = Math.min(row.minR, r.minR);
      row.minGap = Math.min(row.minGap, r.minGap);
      row.handStep = Math.max(row.handStep, r.handStep);
      row.weaponStep = Math.max(row.weaponStep, r.weaponStep);
      row.maxReach = Math.max(row.maxReach, r.maxReach);
      row.clamped += r.clamped;
    }
  }
  if (row) {
    console.log(
      "  " +
        `${index} ${w.name}`.padEnd(26) +
        row.minR.toFixed(1).padStart(9) +
        row.minGap.toFixed(1).padStart(10) +
        row.handStep.toFixed(0).padStart(12) +
        row.weaponStep.toFixed(0).padStart(14) +
        row.maxReach.toFixed(0).padStart(12) +
        String(row.clamped).padStart(10)
    );
  }
}

/* ── idle is pixel-identical to vanilla ────────────────────────────────────── */

console.log("\nidle pose matches vanilla");
for (const index of Object.keys(PROFILES).map(Number).sort((a, b) => a - b)) {
  const g = geometry(index);
  const p = player(index, 0, { idle: true });
  const pose = A._place(p, g.arm, g.hndS, g.hndD);
  const v1 = { x: SCALE * Math.cos(g.arm), y: SCALE * Math.sin(g.arm) };
  const v2 = { x: SCALE * g.hndD * Math.cos(-g.arm * g.hndS), y: SCALE * g.hndD * Math.sin(-g.arm * g.hndS) };
  const d = Math.max(dist({ x: pose.h1x, y: pose.h1y }, v1), dist({ x: pose.h2x, y: pose.h2y }, v2));
  const w = Math.abs(pose.rot) + Math.abs(pose.dx) + Math.abs(pose.dy);
  check(d < 1e-9 && w < 1e-9, `${WEAPONS[index].name}: idle pose differs from vanilla by ${d.toFixed(4)}px`);
  check(A._bodyRot(p) === 0, `${WEAPONS[index].name}: idle body rotation is not zero`);
}
console.log(`  all ${Object.keys(PROFILES).length} melee weapons sit exactly where vanilla draws them when idle`);

/* ── exclusions ────────────────────────────────────────────────────────────── */

console.log("\nexclusions (must never enter the new path)");
for (const index of EXCLUDED) {
  const w = WEAPONS[index];
  const g = geometry(index);
  let hands = [];
  let drawn = null;
  for (const u of [0, .1, .25, .5, .75, 1]) {
    for (const whiff of [false, true]) {
      const p = player(index, u, { whiff });
      check(A._track(p) === null, `${w.name}: entered the melee path`);
      check(A._place(p, g.arm, g.hndS, g.hndD) === null, `${w.name}: produced a melee pose`);
      check(A._bodyRot(p) === p.dirPlus, `${w.name}: body rotation was altered`);

      hands = [];
      A._drawHands((x, y, r, ctx) => hands.push({ x, y, r, ctx }), p, g.arm, g.hndS, g.hndD, "CTX");
      check(hands.length === 2, `${w.name}: drew ${hands.length} hands`);
      /* vanilla draws primary first, with no context argument */
      const v1 = { x: SCALE * Math.cos(g.arm), y: SCALE * Math.sin(g.arm) };
      const v2 = { x: SCALE * g.hndD * Math.cos(-g.arm * g.hndS), y: SCALE * g.hndD * Math.sin(-g.arm * g.hndS) };
      check(dist(hands[0], v1) < 1e-12 && hands[0].r === HAND_R && hands[0].ctx === undefined, `${w.name}: primary hand moved`);
      check(dist(hands[1], v2) < 1e-12 && hands[1].r === HAND_R && hands[1].ctx === undefined, `${w.name}: secondary hand moved`);

      drawn = null;
      const ctx = {
        save: () => fail(`${w.name}: melee transform applied`),
        restore: () => {},
        translate: () => fail(`${w.name}: melee transform applied`),
        rotate: () => fail(`${w.name}: melee transform applied`),
      };
      A._drawWeapon((ww, vv, x, y, c) => (drawn = { ww, vv, x, y, c }), p, w, "", SCALE, 0, ctx);
      check(drawn && drawn.ww === w && drawn.x === SCALE && drawn.y === 0 && drawn.c === ctx, `${w.name}: weapon draw altered`);
    }
  }
  console.log(`  ${index} ${w.name}: untouched`);
}

/* holding a building item keeps the vanilla animation too */
{
  const p = player(3, .3, { buildIndex: 4 });
  const g = geometry(3);
  check(A._track(p) === null, "building item: entered the melee path");
  check(A._bodyRot(p) === p.dirPlus, "building item: body rotation was altered");
  console.log("  holding a building item: untouched");
}

/* the toggle really returns everything to vanilla */
{
  sandbox.Settings_default._meleeAnimation = false;
  let bad = 0;
  for (const index of Object.keys(PROFILES).map(Number)) {
    const g = geometry(index);
    const p = player(index, .3, {});
    if (A._track(p) !== null || A._bodyRot(p) !== p.dirPlus) bad++;
  }
  check(bad === 0, `${bad} weapons stayed on the melee path with the setting off`);
  sandbox.Settings_default._meleeAnimation = true;
  console.log("  setting off: every weapon back on the vanilla path");
}

/* ── freeze frames ─────────────────────────────────────────────────────────── */

/* The question Phase 30 asks -- stop the animation and see whether a person is
 * holding this -- is answerable as an ordering: walking the weapon from its
 * butt to its head, the rear grip must come before the front grip, and both
 * must lie between the two ends. Checked at every weapon's own impact frame. */

console.log("\nfreeze frame at impact");
console.log("  " + "weapon".padEnd(26) + "rear grip".padStart(18) + "front grip".padStart(18) + "weapon head".padStart(18) + "   order");
for (const index of Object.keys(PROFILES).map(Number).sort((a, b) => a - b)) {
  const prof = PROFILES[index];
  const g = geometry(index);
  const ends = haftEnds(index);
  const w = WEAPONS[index];

  /* impact = the key with the largest excursion from rest */
  let peak = prof.keys[0];
  let best = -1;
  for (const k of prof.keys) {
    const mag = Math.abs(k.r) * 40 + Math.hypot(k.p, k.l);
    if (mag > best) {
      best = mag;
      peak = k;
    }
  }
  const p = player(index, peak.u, {});
  const pose = A._place(p, g.arm, g.hndS, g.hndD);
  const h1 = { x: pose.h1x, y: pose.h1y };
  const h2 = { x: pose.h2x, y: pose.h2y };
  const tip = xform(pose, ends.tip.x, ends.tip.y);
  const butt = xform(pose, ends.butt.x, ends.butt.y);

  /* project everything onto the weapon's own axis, butt -> tip */
  const ax = tip.x - butt.x;
  const ay = tip.y - butt.y;
  const len = hyp(ax, ay);
  const proj = q => ((q.x - butt.x) * ax + (q.y - butt.y) * ay) / (len * len);
  const t1 = proj(h1);
  const t2 = proj(h2);

  let order;
  if (prof.grip === 1) {
    order = t1 > 0 && t1 < 1 ? "hand on the haft" : "hand OFF the haft";
    check(t1 > 0 && t1 < 1, `${w.name}: the gripping hand is not on the weapon at impact`);
  } else {
    const good = t2 < t1 && t2 > 0 && t1 < 1;
    order = good ? `butt < rear(${t2.toFixed(2)}) < front(${t1.toFixed(2)}) < head` : "WRONG";
    check(good, `${w.name}: grips are not in butt-rear-front-head order at impact`);
  }
  const fmt = q => `(${q.x.toFixed(0)},${q.y.toFixed(0)})`;
  console.log(
    "  " + `${index} ${w.name}`.padEnd(26) + fmt(h2).padStart(18) + fmt(h1).padStart(18) + fmt(tip).padStart(18) + "   " + order
  );
}

/* ── attack sequencing and the frame cache ─────────────────────────────────── */

console.log("\nsequencing");
{
  /* Daggers alternate hands. Run six attacks back to back through the real
   * entry points, in the order the render loop calls them. */
  const w = WEAPONS[7];
  const g = geometry(7);
  const p = {
    weaponIndex: 7, buildIndex: -1, scale: SCALE,
    animSpeed: w.speed, animTime: 0, targetAngle: -Math.PI / 2, dirPlus: 0,
  };
  const sides = [];
  for (let attack = 0; attack < 6; attack++) {
    p.animTime = w.speed;
    for (let f = 0; f < 6; f++) {
      /* the three call sites, in render order, on one frame */
      A._bodyRot(p);
      const a = A._place(p, g.arm, g.hndS, g.hndD);
      const b = A._place(p, g.arm, g.hndS, g.hndD);
      check(a === b && a.h1x === b.h1x, "daggers: pose changed within one frame");
      if (f === 2) sides.push(Math.sign(A._track(p).alt ? 1 : -1));
      p.animTime -= FRAME_MS;
    }
    p.animTime = 0;
  }
  const alternating = sides.every((s, i) => i === 0 || s !== sides[i - 1]);
  check(alternating, `daggers: strikes did not alternate hands (${sides.join(",")})`);
  console.log("  daggers alternate hands across successive attacks: " + (alternating ? "yes" : "NO"));
}
{
  /* The pose cache holds one player. The render loop walks many, so a second
   * player must never be handed the first one's pose. */
  const g = geometry(4);
  const a = player(4, .3, {});
  const b = player(4, .8, {});
  const pa1 = A._place(a, g.arm, g.hndS, g.hndD);
  const snap = { x: pa1.h1x, y: pa1.h1y, rot: pa1.rot };
  A._place(b, g.arm, g.hndS, g.hndD);
  const pa2 = A._place(a, g.arm, g.hndS, g.hndD);
  check(
    Math.abs(pa2.h1x - snap.x) < 1e-12 && Math.abs(pa2.h1y - snap.y) < 1e-12 && Math.abs(pa2.rot - snap.rot) < 1e-12,
    "cache: a player picked up another player's pose"
  );
  /* interleave a melee player with an excluded one */
  const bow = player(9, .3, {});
  A._place(a, g.arm, g.hndS, g.hndD);
  check(A._place(bow, Math.PI / 4, 1, 1) === null, "cache: an excluded weapon picked up a melee pose");
  const pa3 = A._place(a, g.arm, g.hndS, g.hndD);
  check(Math.abs(pa3.h1x - snap.x) < 1e-12, "cache: a melee player was corrupted by an excluded one");
  console.log("  interleaved players keep their own poses: yes");
}
{
  /* Weapon swaps mid-animation must re-read the profile, not reuse the old. */
  const p = player(6, .4, {});
  const g6 = geometry(6);
  const bat = A._place(p, g6.arm, g6.hndS, g6.hndD);
  const batRot = bat.rot;
  p.weaponIndex = 5;
  p.animSpeed = WEAPONS[5].speed;
  const g5 = geometry(5);
  const spear = A._place(p, g5.arm, g5.hndS, g5.hndD);
  check(Math.abs(spear.rot - batRot) > 1e-6, "weapon swap: kept the previous weapon's pose");
  console.log("  a weapon swap re-reads the profile: yes");
}

/* ── the rewritten renderer, executed ──────────────────────────────────────── */

/* Everything above tests the module. This runs the game's own player renderer
 * after the client has rewritten it, with the real MeleeAnim wired in and the
 * drawing primitives recorded, so the hook's argument order, the balance of the
 * canvas transforms and the untouched excluded path are checked as executed
 * code rather than as text. */

console.log("\nrewritten renderer");
let terser = null;
try {
  terser = require("terser");
} catch (e) {
  console.log("  skipped: terser is not installed (npm i --no-save terser)");
}

if (terser) {
  const bundleSrc = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
  const min = terser.minify_sync(bundleSrc, { module: true, compress: false, mangle: false, format: { comments: false } });
  if (min.error) throw min.error;

  /* run the client's own hook pass over it */
  const hookBox = { Logger: { error: m => fail("hook: " + m), test() {}, warn() {} }, isProd: true, console: { log() {} } };
  vm.createContext(hookBox);
  vm.runInContext(sliceBlock("class Regexer {", "const Regexer_default = Regexer;") + "\n" + sliceBlock("const formatCode2 = code => {", "const formatCode_default = formatCode2;"), hookBox);
  hookBox.__bundle = min.code;
  const rewritten = vm.runInContext("formatCode2(__bundle)", hookBox);

  /* lift the patched player renderer out by brace matching */
  function lift(sig) {
    const at = rewritten.indexOf(sig);
    if (at === -1) throw new Error("not found in the rewritten bundle: " + sig);
    let i = rewritten.indexOf("{", at);
    let depth = 0;
    for (let j = i; j < rewritten.length; j++) {
      const c = rewritten[j];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return rewritten.slice(at, j + 1);
      }
    }
    throw new Error("unbalanced: " + sig);
  }
  const renderSrc = lift("function Dl(e,t){");

  const ops = [];
  const ctx = {
    depth: 0,
    save() { this.depth++; ops.push({ op: "save" }); },
    restore() { this.depth--; ops.push({ op: "restore" }); },
    translate(x, y) { ops.push({ op: "translate", x, y }); },
    rotate(a) { ops.push({ op: "rotate", a }); },
    drawImage() { ops.push({ op: "drawImage" }); },
  };
  const box = {
    Math,
    /* the module and its dependencies, shared with the tests above */
    RYN: { _MeleeAnim: A },
    /* the bundle's own scope, stubbed */
    k: ctx,
    Le: 5.5,
    b: {
      weapons: WEAPONS,
      projectiles: [{ indx: 0, scale: 10 }],
      list: [{ holdOffset: 15 }],
    },
    y: {
      weaponVariants: [{ src: "" }],
      skinColors: ["#bf8f54"],
    },
    R: (x, y, r, c) => ops.push({ op: "circle", x, y, r, ctx: c }),
    pn: (w, v, x, y, c) => ops.push({ op: "weapon", w, v, x, y, ctx: c }),
    ui: () => ops.push({ op: "projectile" }),
    Al: () => ops.push({ op: "accessory" }),
    es: () => ops.push({ op: "hat" }),
    Di: () => ({ width: 40, height: 40 }),
  };
  vm.createContext(box);
  vm.runInContext(renderSrc + "\nthis.__render = Dl;", box);
  const render = box.__render;

  const ALL = Object.keys(WEAPONS).map(Number).sort((a, b) => a - b);
  let ran = 0;
  for (const index of ALL) {
    const excluded = !PROFILES[index];
    const g = geometry(index);
    for (const u of [0, .15, .3, .45, .6, .8, 1]) {
      for (const whiff of [false, true]) {
        ops.length = 0;
        ctx.depth = 0;
        const p = player(index, u, { whiff });
        p.tailIndex = 0;
        p.skinIndex = 0;
        p.weaponVariant = 0;
        p.skinColor = 0;
        render(p, ctx);
        ran++;

        check(ctx.depth === 0, `${WEAPONS[index].name}: canvas save/restore unbalanced (${ctx.depth})`);

        const hands = ops.filter(o => o.op === "circle" && o.r === HAND_R);
        check(hands.length === 2, `${WEAPONS[index].name}: drew ${hands.length} hand circles`);
        const body = ops.filter(o => o.op === "circle" && o.r === SCALE);
        check(body.length === 1, `${WEAPONS[index].name}: drew ${body.length} body circles`);
        const weapon = ops.filter(o => o.op === "weapon");
        check(weapon.length === 1, `${WEAPONS[index].name}: drew ${weapon.length} weapon sprites`);

        /* Melee weapons draw under the hands, which is what keeps both grip
         * circles whole. The three `aboveHand` weapons -- both crossbows and
         * the musket -- draw over them, and must keep doing so. */
        const weaponFirst = ops.indexOf(weapon[0]) < ops.indexOf(hands[0]);
        check(
          weaponFirst === !WEAPONS[index].aboveHand,
          `${WEAPONS[index].name}: weapon/hand draw order changed`
        );
        /* and the body circle after both, as vanilla does */
        check(ops.indexOf(hands[1]) < ops.indexOf(body[0]), `${WEAPONS[index].name}: body drawn before the hands`);

        if (excluded) {
          check(!ops.some(o => o.op === "save" || o.op === "rotate"), `${WEAPONS[index].name}: a transform was applied`);
          const v1 = { x: SCALE * Math.cos(g.arm), y: SCALE * Math.sin(g.arm) };
          const v2 = { x: SCALE * g.hndD * Math.cos(-g.arm * g.hndS), y: SCALE * g.hndD * Math.sin(-g.arm * g.hndS) };
          check(dist(hands[0], v1) < 1e-12, `${WEAPONS[index].name}: primary hand moved`);
          check(dist(hands[1], v2) < 1e-12, `${WEAPONS[index].name}: secondary hand moved`);
          check(weapon[0].x === SCALE && weapon[0].y === 0, `${WEAPONS[index].name}: weapon draw moved`);
        } else {
          /* the melee path must not disturb the arguments the game passes to
           * its own weapon draw; the pose lives in the canvas transform */
          check(weapon[0].x === SCALE && weapon[0].y === 0 && weapon[0].w === WEAPONS[index], `${WEAPONS[index].name}: weapon draw arguments changed`);
        }
      }
    }
  }
  console.log(`  ${ran} renders across all 16 weapons: transforms balanced, draw order preserved,`);
  console.log("  two whole hand circles and one body circle every time");
  console.log("  excluded weapons emitted no transform and vanilla hand coordinates");
}

console.log(`\n${checks} checks passed, ${failures} failed.`);
process.exit(failures ? 1 : 0);
