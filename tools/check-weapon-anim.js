#!/usr/bin/env node
/*
 * check-weapon-anim.js
 *
 * Drives the client's Realistic Weapon Animation System the way the rewritten
 * game bundle drives it -- every weapon, the whole animation window at frame
 * resolution, connecting hits and whiffs, idle stances, a building in hand,
 * weapon switching, rapid re-attacks -- and checks the invariants that keep it
 * a purely visual layer: no exceptions, no NaN, balanced canvas state, hands
 * that stay on the character, and no state that grows over a session.
 *
 *   node tools/check-weapon-anim.js [path/to/client.js]
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "Ryn_Type_2.user.js");
const client = fs.readFileSync(CLIENT_PATH, "utf8");
const start = client.indexOf("  const WA_LINEAR = 0;");
const end = client.indexOf("  const WeaponAnimation_default = WeaponAnimation;");
if (start === -1 || end === -1) throw new Error("module markers not found");
const moduleSrc = client.slice(start, end + "  const WeaponAnimation_default = WeaponAnimation;".length);

/* Loaded into this realm, not a vm context: the module reaches Math and
 * performance the way the browser hands them to it. */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const WA = new Function("clamp", moduleSrc + "\nreturn WeaponAnimation_default;")(clamp);

/* ---- weapon table copied from src/game_index.js (ids, speeds, offsets) ---- */
const WEAPONS = [
  { id: 0, name: "tool hammer", speed: 300, len: 140, w: 140, xOff: -3, yOff: 18 },
  { id: 1, name: "hand axe", speed: 400, len: 140, w: 140, xOff: 3, yOff: 24 },
  { id: 2, name: "great axe", speed: 400, len: 140, w: 140, xOff: -8, yOff: 25 },
  { id: 3, name: "short sword", speed: 300, len: 130, w: 210, xOff: -8, yOff: 46 },
  { id: 4, name: "katana", speed: 300, len: 130, w: 210, xOff: -8, yOff: 59 },
  { id: 5, name: "polearm", speed: 700, len: 130, w: 210, xOff: -8, yOff: 53 },
  { id: 6, name: "bat", speed: 300, len: 110, w: 180, xOff: -8, yOff: 53 },
  { id: 7, name: "daggers", speed: 100, len: 110, w: 110, xOff: 18, yOff: 0 },
  { id: 8, name: "stick", speed: 400, len: 140, w: 140, xOff: 3, yOff: 24 },
  { id: 9, name: "hunting bow", speed: 600, len: 120, w: 120, xOff: -6, yOff: 0, projectile: 0 },
  { id: 10, name: "great hammer", speed: 400, len: 140, w: 140, xOff: -9, yOff: 25 },
  { id: 11, name: "wooden shield", speed: 0, len: 120, w: 120, xOff: 6, yOff: 0 },
  { id: 12, name: "crossbow", speed: 700, len: 120, w: 120, xOff: -4, yOff: 0, aboveHand: 1, armS: .75, projectile: 2 },
  { id: 13, name: "repeater crossbow", speed: 230, len: 120, w: 120, xOff: -4, yOff: 0, aboveHand: 1, armS: .75, projectile: 3 },
  { id: 14, name: "mc grabby", speed: 700, len: 130, w: 210, xOff: -8, yOff: 53 },
  { id: 15, name: "musket", speed: 1500, len: 205, w: 205, xOff: 25, yOff: 0, aboveHand: 1, armS: .6, hndS: .3, hndD: 1.6, projectile: 5, hideProjectile: 1 },
];

/* ---- stub canvas ctx that tracks the transform stack ---- */
function makeCtx() {
  return {
    depth: 0,
    maxDepth: 0,
    tx: 0, ty: 0, rot: 0,
    stack: [],
    bad: [],
    save() { this.stack.push([this.tx, this.ty, this.rot]); this.depth++; if (this.depth > this.maxDepth) this.maxDepth = this.depth; },
    restore() { const s = this.stack.pop(); if (!s) { this.bad.push("restore underflow"); return; } this.tx = s[0]; this.ty = s[1]; this.rot = s[2]; this.depth--; },
    translate(x, y) { if (!isFinite(x) || !isFinite(y)) this.bad.push("translate NaN " + x + "," + y); this.tx += x; this.ty += y; },
    rotate(a) { if (!isFinite(a)) this.bad.push("rotate NaN " + a); this.rot += a; },
  };
}

const drawn = [];
function drawTool(weapon, variant, x, y, ctx) {
  if (!isFinite(x) || !isFinite(y)) throw new Error("renderTool NaN pos " + x + "," + y);
  drawn.push({ kind: "tool", id: weapon.id, x, y, tx: ctx.tx, ty: ctx.ty, rot: ctx.rot });
}
function drawAmmo(x, y, proj, ctx) {
  if (!isFinite(x) || !isFinite(y)) throw new Error("renderProjectile NaN pos " + x + "," + y);
  drawn.push({ kind: "ammo", x, y, tx: ctx.tx, ty: ctx.ty, rot: ctx.rot });
}
const hands = [];
function circle(x, y, r) {
  if (!isFinite(x) || !isFinite(y) || r !== 14) throw new Error("hand NaN/scale " + x + "," + y + "," + r);
  hands.push([x, y]);
}

/* ---- the rewritten Dl(): identical statement order to the bundle ---- */
function renderPlayer(player, ctx, weapon) {
  const arm = Math.PI / 4 * (weapon.armS || 1);
  const hndS = (player.buildIndex < 0 && weapon.hndS) || 1;
  const hndD = (player.buildIndex < 0 && weapon.hndD) || 1;
  if (player.buildIndex < 0 && !weapon.aboveHand) {
    WA._drawWeapon(drawTool, weapon, "", player.scale, 0, ctx, player);
    if (weapon.projectile != null && !weapon.hideProjectile) WA._drawAmmo(drawAmmo, player.scale, 0, { indx: weapon.projectile, scale: 30 }, ctx, player);
  }
  WA._drawHands(circle, player, arm, hndS, hndD);
  if (player.buildIndex < 0 && weapon.aboveHand) {
    WA._drawWeapon(drawTool, weapon, "", player.scale, 0, ctx, player);
    if (weapon.projectile != null && !weapon.hideProjectile) WA._drawAmmo(drawAmmo, player.scale, 0, { indx: weapon.projectile, scale: 30 }, ctx, player);
  }
}

function newPlayer(sid) {
  return { sid, scale: 35, dir: 0, dirPlus: 0, targetAngle: 0, animTime: 0, animSpeed: 0, weaponIndex: 0, buildIndex: -1 };
}

/* Replays the bundle's own animate(): the clock this system only reads. */
const HIT_RETURN_RATIO = 0.25;
function animate(player, dt, state) {
  if (!(player.animTime > 0)) return;
  player.animTime -= dt;
  if (player.animTime <= 0) { player.animTime = 0; player.dirPlus = 0; state.c = 0; state.p = 0; return; }
  if (state.p === 0) {
    state.c += dt / (player.animSpeed * HIT_RETURN_RATIO);
    player.dirPlus = player.targetAngle * Math.min(1, state.c);
    if (state.c >= 1) { state.c = 1; state.p = 1; }
  } else {
    state.c -= dt / (player.animSpeed * (1 - HIT_RETURN_RATIO));
    player.dirPlus = player.targetAngle * Math.max(0, state.c);
  }
}

let failures = 0;
function fail(msg) { failures++; console.log("  FAIL " + msg); }

/* ------------------------------------------------------------------ */
console.log("1. every weapon x every attack direction x hit/whiff x full window");
let framesRun = 0;
const bodyAngleSamples = [];
for (const weapon of WEAPONS) {
  for (const didHit of [true, false]) {
    for (const dir of [0, 1.2, Math.PI / 2, Math.PI, -2.4, -Math.PI / 2]) {
      const ctx = makeCtx();
      const player = newPlayer(3);
      player.weaponIndex = weapon.id;
      player.dir = dir;
      const speed = weapon.speed || 0;
      player.animTime = player.animSpeed = speed;
      player.targetAngle = didHit ? -Math.PI / 2 : -Math.PI;
      const state = { c: 0, p: 0 };
      const before = drawn.length;
      for (let f = 0; f < 260; f++) {
        WA.frame(performance.now());
        animate(player, 16.6, state);
        const body = WA._bodyAngle(player);
        if (!isFinite(body)) fail(weapon.name + " bodyAngle NaN");
        bodyAngleSamples.push(Math.abs(body));
        renderPlayer(player, ctx, weapon);
        framesRun++;
      }
      if (ctx.depth !== 0) fail(weapon.name + " ctx save/restore unbalanced: depth " + ctx.depth);
      if (ctx.stack.length !== 0) fail(weapon.name + " ctx stack leak: " + ctx.stack.length);
      if (ctx.bad.length) fail(weapon.name + " ctx: " + ctx.bad[0]);
      if (ctx.maxDepth > 1) fail(weapon.name + " nested save depth " + ctx.maxDepth);
      if (drawn.length === before) fail(weapon.name + " never drew");
    }
  }
}
console.log("   frames simulated: " + framesRun + ", draws: " + drawn.length + ", hands: " + hands.length);
console.log("   max |bodyAngle|: " + Math.max(...bodyAngleSamples).toFixed(4) + " (vanilla peak is " + Math.PI.toFixed(4) + ")");

/* ------------------------------------------------------------------ */
console.log("2. idle stance renders for every weapon, no ctx leak");
for (const weapon of WEAPONS) {
  const ctx = makeCtx();
  const player = newPlayer(11);
  player.weaponIndex = weapon.id;
  for (let f = 0; f < 120; f++) { WA.frame(performance.now()); renderPlayer(player, ctx, weapon); }
  if (ctx.depth !== 0) fail(weapon.name + " idle ctx unbalanced");
  if (ctx.bad.length) fail(weapon.name + " idle " + ctx.bad[0]);
  if (WA._bodyAngle(player) !== 0) fail(weapon.name + " idle bodyAngle non-zero");
}

/* ------------------------------------------------------------------ */
console.log("3. identity: a weapon with no profile must reach the vanilla draw untouched");
{
  const ctx = makeCtx();
  const player = newPlayer(1);
  player.weaponIndex = 99;
  const weapon = { id: 99, len: 100, w: 100, xOff: 0, yOff: 0, speed: 300 };
  drawn.length = 0;
  WA.frame(performance.now());
  renderPlayer(player, ctx, weapon);
  const d = drawn[drawn.length - 1];
  if (d.x !== 35 || d.y !== 0 || ctx.tx !== 0 || ctx.ty !== 0 || ctx.rot !== 0) fail("unprofiled weapon was transformed");
  player.dirPlus = -1.234;
  if (WA._bodyAngle(player) !== -1.234) fail("unprofiled weapon bodyAngle altered");
}

/* ------------------------------------------------------------------ */
console.log("4. building in hand keeps vanilla body swing and vanilla hands");
{
  const player = newPlayer(2);
  player.weaponIndex = 5;
  player.buildIndex = 3;
  player.dirPlus = -0.9;
  if (WA._bodyAngle(player) !== -0.9) fail("building-in-hand body swing was reduced");
  hands.length = 0;
  const arm = Math.PI / 4;
  WA._drawHands(circle, player, arm, 1, 1);
  const ax = 35 * Math.cos(arm), ay = 35 * Math.sin(arm);
  if (Math.abs(hands[0][0] - ax) > 1e-9 || Math.abs(hands[0][1] - ay) > 1e-9) fail("building-in-hand hands moved");
}

/* ------------------------------------------------------------------ */
console.log("5. rapid re-attacks and mid-animation weapon switching");
{
  const ctx = makeCtx();
  const player = newPlayer(7);
  const state = { c: 0, p: 0 };
  for (let i = 0; i < 400; i++) {
    if (i % 7 === 0) {
      const weapon = WEAPONS[i % WEAPONS.length];
      player.weaponIndex = weapon.id;
      player.animTime = player.animSpeed = weapon.speed || 0;
      player.targetAngle = i % 2 ? -Math.PI / 2 : -Math.PI;
      state.c = 0; state.p = 0;
    }
    WA.frame(i * 16.6);
    animate(player, 16.6, state);
    WA._bodyAngle(player);
    renderPlayer(player, ctx, WEAPONS[player.weaponIndex]);
  }
  if (ctx.depth !== 0) fail("switching ctx unbalanced");
  if (ctx.bad.length) fail("switching " + ctx.bad[0]);
}

/* ------------------------------------------------------------------ */
console.log("6. daggers alternate between consecutive attacks");
{
  const player = newPlayer(4);
  player.weaponIndex = 7;
  const seen = [];
  for (let a = 0; a < 4; a++) {
    player.animTime = player.animSpeed = 100;
    player.targetAngle = -Math.PI / 2;
    const state = { c: 0, p: 0 };
    for (let f = 0; f < 3; f++) {
      WA.frame(f * 16.6);
      animate(player, 16.6, state);
      WA._pose(player);
    }
    seen.push(WA._lat.toFixed(3));
  }
  if (seen[0] === seen[1]) fail("dagger strokes are identical: " + seen.join(" "));
  else console.log("   lateral offset per stroke: " + seen.join(", "));
}

/* ------------------------------------------------------------------ */
console.log("7. ammo hides at release and returns before the next shot");
for (const id of [9, 12, 13]) {
  const weapon = WEAPONS[id];
  const player = newPlayer(5);
  player.weaponIndex = id;
  player.animTime = player.animSpeed = weapon.speed;
  player.targetAngle = -Math.PI / 2;
  const ctx = makeCtx();
  const state = { c: 0, p: 0 };
  let hidden = 0, shown = 0;
  const steps = 120;
  for (let f = 0; f < steps; f++) {
    WA.frame(f * 16.6);
    animate(player, weapon.speed / steps, state);
    const before = drawn.length;
    WA._drawAmmo(drawAmmo, 35, 0, { indx: weapon.projectile, scale: 30 }, ctx, player);
    if (drawn.length === before) hidden++; else shown++;
  }
  if (hidden === 0) fail(weapon.name + ": ammo never left the string");
  if (shown === 0) fail(weapon.name + ": ammo never came back");
  if (ctx.depth !== 0) fail(weapon.name + " ammo ctx unbalanced");
  console.log("   " + weapon.name + ": " + hidden + " frames released / " + shown + " frames nocked");
}

/* ------------------------------------------------------------------ */
console.log("8. spear thrusts: the shaft drives forward and slides through the grip");
{
  const p = WA._table[5];
  const player = newPlayer(6);
  player.weaponIndex = 5;
  player.animTime = player.animSpeed = 700;
  player.targetAngle = -Math.PI / 2;
  const state = { c: 0, p: 0 };
  WA.frame(0);
  WA._pose(player);
  const restAX = WA._ax, restAY = WA._ay, restRot = WA._rot;
  hands.length = 0;
  WA._drawHands(circle, player, Math.PI / 4, 1, 1);
  const restH = [hands[0].slice(), hands[1].slice()];
  let drive = 0, spin = 0, slid = 0, handMove = 0;
  for (let f = 0; f < 120; f++) {
    WA.frame(f * 16.6);
    animate(player, 700 / 120, state);
    WA._pose(player);
    drive = Math.max(drive, Math.hypot(WA._ax - restAX, WA._ay - restAY));
    spin = Math.max(spin, Math.abs(WA._rot - restRot));
    slid = Math.max(slid, Math.abs(WA._slide));
    hands.length = 0;
    WA._drawHands(circle, player, Math.PI / 4, 1, 1);
    handMove = Math.max(handMove,
      Math.hypot(hands[0][0] - restH[0][0], hands[0][1] - restH[0][1]),
      Math.hypot(hands[1][0] - restH[1][0], hands[1][1] - restH[1][1]));
  }
  const bodySwing = Math.abs(-Math.PI / 2 * p.body) * 180 / Math.PI;
  console.log("   shaft drives forward:        " + drive.toFixed(1) + " units");
  console.log("   shaft slides through grip:   " + slid.toFixed(1) + " units");
  console.log("   hands move:                  " + handMove.toFixed(1) + " units");
  console.log("   shaft rotates:               " + (spin * 180 / Math.PI).toFixed(1) + " deg");
  console.log("   body rotates:                " + bodySwing.toFixed(1) + " deg (vanilla: 90.0)");
  if (drive < 25) fail("spear thrust is too short (" + drive.toFixed(1) + " units)");
  if (spin * 180 / Math.PI > 15) fail("spear rotates like a swing (" + (spin * 180 / Math.PI).toFixed(1) + " deg)");
  if (bodySwing > 15) fail("spear still spins the body (" + bodySwing.toFixed(1) + " deg)");
  if (slid < 15) fail("shaft does not slide through the grip (" + slid.toFixed(1) + " units)");
  if (handMove > 14) fail("hands are dragged along instead of the shaft sliding (" + handMove.toFixed(1) + " units)");
}

/* ------------------------------------------------------------------ */
console.log("9. no leak across a long session (per-call allocation: check 14)");
{
  const ctx = makeCtx();
  const state = { c: 0, p: 0 };
  /* 40 players, every weapon, attacking and idling, for ~20k frames. */
  const roster = [];
  for (let s = 0; s < 40; s++) {
    const p = newPlayer(s);
    p.weaponIndex = s % WEAPONS.length;
    roster.push(p);
  }
  const run = frames => {
    for (let f = 0; f < frames; f++) {
      WA.frame(f * 16.6);
      for (let s = 0; s < roster.length; s++) {
        const p = roster[s];
        if ((f + s) % 37 === 0) {
          p.weaponIndex = (p.weaponIndex + 1) % WEAPONS.length;
          p.animTime = p.animSpeed = WEAPONS[p.weaponIndex].speed || 0;
          p.targetAngle = f % 2 ? -Math.PI / 2 : -Math.PI;
          state.c = 0; state.p = 0;
        }
        animate(p, 16.6, state);
        WA._bodyAngle(p);
        renderPlayer(p, ctx, WEAPONS[p.weaponIndex]);
        drawn.length = 0;
        hands.length = 0;
      }
    }
  };
  if (!global.gc) console.log("   (skipped: run with --expose-gc)");
  else {
    run(2000);
    global.gc(); global.gc();
    const before = process.memoryUsage().heapUsed;
    run(20000);
    global.gc(); global.gc();
    const retained = process.memoryUsage().heapUsed - before;
    console.log("   40 players x 20000 frames retained " + (retained / 1024).toFixed(1) + " KB after GC");
    if (retained > 512 * 1024) fail("state grows over a session (" + (retained / 1024).toFixed(1) + " KB)");
  }
  if (ctx.depth !== 0) fail("session ctx unbalanced");
  if (ctx.bad.length) fail("session " + ctx.bad[0]);
}

/* ------------------------------------------------------------------ */
console.log("10. pose cache serves the repeated calls Dl() makes per player");
{
  const player = newPlayer(12);
  player.weaponIndex = 3;
  player.animTime = player.animSpeed = 300;
  player.targetAngle = -Math.PI / 2;
  WA.frame(performance.now());
  const p1 = WA._pose(player);
  const r1 = WA._rot, d1 = WA._reach;
  WA._pose(player); WA._pose(player); WA._pose(player);
  if (WA._rot !== r1 || WA._reach !== d1 || WA._pose(player) !== p1) fail("cache returned a different pose within one frame");
  WA.frame(performance.now());
  player.animTime -= 16;
  WA._pose(player);
  if (WA._rot === r1 && WA._reach === d1) fail("cache did not refresh on the next frame");
}

/* ------------------------------------------------------------------ */
console.log("11. every profile is well formed");
{
  const seenIds = new Set();
  const TRACKS = ["r", "d", "l", "g", "s"];
  for (let id = 0; id <= 15; id++) {
    const p = WA._table[id];
    if (!p) { fail("no profile for weapon " + id); continue; }
    if (seenIds.has(p.id)) fail("duplicate profile id " + p.id);
    seenIds.add(p.id);
    if (!(p.tW < p.tH && p.tH <= p.tHold && p.tHold < p.tF && p.tF < 1)) fail(p.name + ": stage times out of order");
    if (!(p.body >= 0 && p.body <= 1)) fail(p.name + ": body factor out of range " + p.body);
    if (p.hands !== 1 && p.hands !== 2) fail(p.name + ": grip mode is " + p.hands);
    if (!(p.ammoHide >= 0 && p.ammoHide < 1)) fail(p.name + ": ammo window out of range");
    if (Math.abs(p.cha * p.cha + p.sha * p.sha - 1) > 1e-9) fail(p.name + ": shaft vector is not a unit vector");
    const fields = ["gripX", "gripY", "cha", "sha", "h1d", "h1p", "h2d", "h2p",
                    "freeX", "freeY", "freeSwing", "thrust", "bob", "wide", "restAX", "restAY"];
    for (const t of TRACKS) for (let k = 0; k <= 3; k++) fields.push(t + k);
    for (const k of fields) {
      if (typeof p[k] !== "number" || !isFinite(p[k])) fail(p.name + ": field " + k + " is " + p[k]);
    }
  }
  const shape = Object.keys(WA._table[0]).join(",");
  for (let id = 1; id <= 15; id++) if (Object.keys(WA._table[id]).join(",") !== shape) fail("profile " + id + " has a different object shape");
  if (Object.keys(WA._neutral).join(",") !== shape) fail("neutral profile has a different object shape");
  const twoHanded = [];
  const oneHanded = [];
  for (let id = 0; id <= 15; id++) (WA._table[id].hands === 2 ? twoHanded : oneHanded).push(WA._table[id].name);
  console.log("   16 profiles, one shared object shape, " + Object.keys(WA._table[0]).length + " fields");
  console.log("   two-handed: " + twoHanded.join(", "));
  console.log("   one-handed: " + oneHanded.join(", "));
}

/* ------------------------------------------------------------------ */
console.log("12. easing curves are monotone-bounded and anchored at 0/1");
{
  for (let e = 0; e <= 8; e++) {
    if (WA._ease(e, 0) !== 0) fail("ease " + e + " f(0) != 0");
    if (WA._ease(e, 1) !== 1) fail("ease " + e + " f(1) != 1");
    if (WA._ease(e, -5) !== 0 || WA._ease(e, 5) !== 1) fail("ease " + e + " not clamped");
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const v = WA._ease(e, t);
      if (!isFinite(v)) fail("ease " + e + " NaN at " + t);
      if (e !== 6 && (v < -0.001 || v > 1.001)) fail("ease " + e + " out of range at " + t + ": " + v);
      if (e === 6 && (v < -0.2 || v > 1.2)) fail("ease 6 overshoot too large at " + t + ": " + v);
    }
  }
}

/* ------------------------------------------------------------------ */
console.log("13. every weapon is actually held: hands sit on its grip points");
{
  /* The pose puts the sprite's pivot at (_ax, _ay) and turns the sprite about
   * it, so a hand at (along, across) in the weapon's own frame must land at
   * the same place the sprite's corresponding point does. Recomputing that
   * here independently is the check. */
  const geom = [];
  let worstOn = 0, minR = 1e9, maxR = 0, minSep = 1e9, worstFree = 0;
  for (const weapon of WEAPONS) {
    const p = WA._table[weapon.id];
    const player = newPlayer(2);
    player.weaponIndex = weapon.id;
    const rows = [];
    for (const didHit of [true, false]) {
      player.animTime = player.animSpeed = weapon.speed || 0;
      player.targetAngle = didHit ? -Math.PI / 2 : -Math.PI;
      const state = { c: 0, p: 0 };
      for (let f = 0; f < 200; f++) {
        WA.frame(f * 16.6);
        animate(player, 8, state);
        hands.length = 0;
        WA._drawHands(circle, player, Math.PI / 4 * (weapon.armS || 1), weapon.hndS || 1, weapon.hndD || 1);
        if (hands.length !== 2) { fail(weapon.name + ": drew " + hands.length + " hands"); break; }
        const ax = WA._ax, ay = WA._ay, c = WA._cr, s = WA._sr;
        const place = (along, across) => {
          const lx = along * p.cha - across * p.sha;
          const ly = along * p.sha + across * p.cha;
          return [ax + lx * c - ly * s, ay + lx * s + ly * c];
        };
        /* primary hand is on its grip point, always */
        const want1 = place(p.h1d - WA._slide, p.h1p * WA._flip);
        worstOn = Math.max(worstOn, Math.hypot(hands[0][0] - want1[0], hands[0][1] - want1[1]));
        if (p.hands === 2) {
          const want2 = place(p.h2d - WA._slide - WA._sep, p.h2p * WA._flip);
          worstOn = Math.max(worstOn, Math.hypot(hands[1][0] - want2[0], hands[1][1] - want2[1]));
          minSep = Math.min(minSep, Math.hypot(hands[0][0] - hands[1][0], hands[0][1] - hands[1][1]));
        } else {
          worstFree = Math.max(worstFree, Math.hypot(hands[1][0] - p.freeX, hands[1][1] - p.freeY * WA._flip));
        }
        for (const h of hands) {
          const rr = Math.hypot(h[0], h[1]);
          minR = Math.min(minR, rr);
          maxR = Math.max(maxR, rr);
        }
        rows.push(0);
      }
    }
    geom.push(weapon.name);
  }
  console.log("   hand vs. its grip point:     " + worstOn.toFixed(6) + " units apart (exact placement)");
  console.log("   hand distance from centre:   " + minR.toFixed(1) + " .. " + maxR.toFixed(1) + " (body radius 35)");
  console.log("   two-handed grip separation:  " + minSep.toFixed(1) + " units minimum");
  console.log("   free hand from its rest pose: " + worstFree.toFixed(1) + " units maximum");
  if (worstOn > 1e-9) fail("a hand is not on its grip point (" + worstOn.toFixed(4) + " units off)");
  if (minR < 15) fail("a hand ends up inside the body (r=" + minR.toFixed(1) + ")");
  if (maxR > 62) fail("a hand detaches from the character (r=" + maxR.toFixed(1) + ")");
  if (minSep < 9) fail("a two-handed grip collapses to one point (" + minSep.toFixed(1) + " units)");
  for (let id = 0; id <= 15; id++) {
    const p = WA._table[id];
    if (p.hands !== 2) continue;
    const along = Math.abs(p.h2d - p.h1d), across = Math.abs(p.h2p - p.h1p);
    const rest = Math.hypot(along, across);
    if (rest < 14) fail(p.name + ": resting two-handed grip is only " + rest.toFixed(1) + " units wide");
  }
  if (worstFree > 26) fail("a free hand wanders (" + worstFree.toFixed(1) + " units)");
}

/* ------------------------------------------------------------------ */
console.log("15. no two weapons move the same way");
{
  /* Hide the sprites and compare only how the character moves: stage timing,
   * how far the shaft swings, how far it drives forward and across, how much
   * the shaft slides through the grip, how far the off hand draws, and how
   * much the body commits. */
  const sig = p => {
    const span = t => Math.max(p[t + "0"], p[t + "1"], p[t + "2"], p[t + "3"]) -
                      Math.min(p[t + "0"], p[t + "1"], p[t + "2"], p[t + "3"]);
    return [p.tW, p.tH, p.tF, p.tHold - p.tH, span("r") / Math.PI,
            span("d") / 40, span("l") / 30, p.body, span("g") / 25, span("s") / 20, p.thrust];
  };
  const pairs = [];
  for (let i = 0; i <= 15; i++)
    for (let j = i + 1; j <= 15; j++) {
      const a = sig(WA._table[i]), b = sig(WA._table[j]);
      let d = 0;
      for (let k = 0; k < a.length; k++) d += (a[k] - b[k]) * (a[k] - b[k]);
      pairs.push([Math.sqrt(d), WA._table[i].name, WA._table[j].name]);
    }
  pairs.sort((x, y) => x[0] - y[0]);
  for (const [d, a, b] of pairs.slice(0, 5)) console.log("   " + d.toFixed(3) + "  " + a + " / " + b);
  if (pairs[0][0] < 0.25) fail("two weapons move too similarly: " + pairs[0][1] + " / " + pairs[0][2] + " (" + pairs[0][0].toFixed(3) + ")");
}

/* ------------------------------------------------------------------ */
console.log("14. per-call allocation (clean process: heapUsed deltas need one)");
let allocFailed = false;
try {
  const out = execFileSync(process.execPath, ["--expose-gc", path.join(__dirname, "check-weapon-anim-alloc.js"), CLIENT_PATH], { encoding: "utf8" });
  for (const line of out.trim().split("\n")) if (line.trim()) console.log("   " + line.trim());
} catch (e) {
  allocFailed = true;
  console.log((e.stdout || "").trim().split("\n").map(l => "   " + l.trim()).join("\n"));
  fail("allocation checks failed");
}

console.log("");
console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
