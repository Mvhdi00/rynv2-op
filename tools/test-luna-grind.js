#!/usr/bin/env node
/*
 * test-luna-grind.js
 *
 * Runs the auto grind (src/luna-grind/auto-grind.js — the code that goes into
 * the build, not a copy) against the game's own rules, taken from
 * src/game_index.js and drivers/game-drivers.json:
 *
 *   placement   73 units out (player 35 + turret 43 - 5), refused within
 *               86 of another structure (43 + 43); turret limit 2, or 99 in
 *               sandbox
 *   swing       hits a structure when (distance - its scale) <= the weapon's
 *               range and its direction is within 69.2 deg of the facing
 *   damage      dmg x sDmg x variant x 3.3 with the tank hat
 *   weapon XP   the weapon that destroys a structure gets its cost (turret:
 *               200 wood + 150 stone = 350); gold 3000, diamond 7000,
 *               ruby 12000
 *
 * Side by side with Ryn's aim (the centre of the turrets), from random mouse
 * directions, with the player shuffling a few units the way a standing player
 * does. It reports how many swings each takes to take the great hammer from
 * nothing to ruby, and whether it ever swings at nothing for good.
 *
 *   node tools/test-luna-grind.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DRIVERS = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8"));
const GRIND_SRC = fs.readFileSync(path.join(ROOT, "src/luna-grind/auto-grind.js"), "utf8");

const GATHER_ANGLE = DRIVERS.config.gatherAngle;              /* 1.2083 rad = 69.2 deg */
const PLAYER_SCALE = DRIVERS.config.playerScale;              /* 35 */
const VARIANTS = [ { xp: 0, val: 1 }, { xp: 3000, val: 1.1 }, { xp: 7000, val: 1.18 }, { xp: 12000, val: 1.18 } ];
const weaponsById = {};
DRIVERS.weapons.forEach(w => { weaponsById[w.id] = w; });
const itemsById = {};
DRIVERS.items.forEach((it, i) => { itemsById[it.id !== undefined ? it.id : i] = it; });
const TURRET = itemsById[17];
const TURRET_XP = TURRET.req.reduce((s, v, i) => (i % 2 ? s + v : s), 0);   /* 350 */
const TICK = 111;

const angleDist = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

/* ---- a tiny world that follows the game's rules ---- */
function makeWorld(opts) {
  const w = {
    sandbox: opts.sandbox,
    player: { sid: 1, alive: true, x: 0, y: 0, weapons: [ opts.primary, 10 ], items: [ 0, 3, 6, 10, 15, 17 ], weaponVariants: {}, wood: 1e6, stone: 1e6, food: 1e6, points: 1e6 },
    xp: { [opts.primary]: 0, 10: 0 },
    objects: [],
    nextSid: 100,
    reload: { 0: 0, 1: 0 },
    hat: 0,
    held: 10,
    vx: 0, vy: 0,
    moveDir: null,
    swings: 0,
    hits: 0,
    emptySwings: 0,
    turretsPlaced: 0,
    kills: [],          /* turrets destroyed by each swing that destroyed any */
    swingSpots: [],     /* where the player stood for each swing, vs the set's anchor */
    anchors: []         /* where each set was placed from */
  };
  w.limit = w.sandbox ? 99 : TURRET.group.limit;
  w.variantOf = id => { let v = 0; VARIANTS.forEach((t, i) => { if ((w.xp[id] || 0) >= t.xp) v = i; }); return v; };
  w.syncVariants = () => { for (const id of w.player.weapons) w.player.weaponVariants[id] = w.variantOf(id); };
  w.canPlaceAt = (x, y) => w.objects.every(o => dist(x, y, o.x, o.y) >= TURRET.scale + o.scale);
  w.place = angle => {
    const r = PLAYER_SCALE + TURRET.scale + (TURRET.placeOffset || 0);
    const x = w.player.x + r * Math.cos(angle), y = w.player.y + r * Math.sin(angle);
    if (w.objects.length >= w.limit || !w.canPlaceAt(x, y)) return false;
    w.objects.push({ sid: w.nextSid++, id: 17, x, y, scale: TURRET.scale, health: TURRET.health, owner: { sid: 1 } });
    w.turretsPlaced++;
    return true;
  };
  /* One server tick of the player's movement, as the game's update():
   * speed 0.0016 x weapon x hat, then 0.993^ms of it kept. */
  w.physics = () => {
    const C = (weaponsById[w.held].spdMult || 1) * (w.hat === 40 ? 0.3 : 1);
    if (w.moveDir !== null && w.moveDir !== undefined) {
      w.vx += Math.cos(w.moveDir) * 0.0016 * C * TICK;
      w.vy += Math.sin(w.moveDir) * 0.0016 * C * TICK;
    }
    w.player.x += w.vx * TICK;
    w.player.y += w.vy * TICK;
    w.vx *= Math.pow(0.993, TICK);
    w.vy *= Math.pow(0.993, TICK);
  };
  /* One swing of `slot` toward `dir`, scored exactly as the game's gather(). */
  w.swing = (slot, dir) => {
    const weaponId = w.player.weapons[slot];
    const weapon = weaponsById[weaponId];
    const dmg = weapon.dmg * (weapon.sDmg || 1) * VARIANTS[w.variantOf(weaponId)].val * (w.hat === 40 ? 3.3 : 1);
    let hit = 0, killed = 0;
    for (const o of w.objects.slice()) {
      if (dist(w.player.x, w.player.y, o.x, o.y) - o.scale > weapon.range) continue;
      if (angleDist(Math.atan2(o.y - w.player.y, o.x - w.player.x), dir) > GATHER_ANGLE) continue;
      hit++;
      o.health -= dmg;
      if (o.health <= 0) {
        w.objects.splice(w.objects.indexOf(o), 1);
        w.xp[weaponId] = (w.xp[weaponId] || 0) + TURRET_XP;
        killed++;
      }
    }
    if (killed) w.kills.push(killed);
    const a = w.anchors[w.anchors.length - 1];
    if (a) w.swingSpots.push((a.x - w.player.x) * Math.cos(a.axis) + (a.y - w.player.y) * Math.sin(a.axis));
    w.swings++;
    w.hits += hit;
    if (!hit) w.emptySwings++;
    w.reload[slot] = weapon.speed;
    return hit;
  };
  return w;
}

/* ---- the build's grind, wired to that world ---- */
function lunaGrind(world) {
  const env = {
    config: { gatherAngle: GATHER_ANGLE, weaponVariants: VARIANTS, inSandbox: world.sandbox },
    items: { weapons: weaponsById, list: itemsById },
    UTILS: { getDistance: dist, toRad: d => d * Math.PI / 180 },
    window: { vars: { autoGrind: true, autoGrindTargetPrimary: "ruby", autoGrindTargetSecondary: "ruby" } }
  };
  const factory = new Function("env", `
    const { config, items, UTILS, window } = env;
    let myPlayer = null, nearestEnemy = null, autoMills = false, autoBreak = false, antiPush = false, autoaim = false;
    let visibleObjects = [], mouseX = 0, mouseY = 0, screenWidth = 1280, screenHeight = 800;
    let gatherGrind = false, grindAngle = null, grindHat = null, predictWeapon = 0, grindObjects = [];
    let isBoughtHat = () => true, canPlace = () => false, isItemLimit = () => false;
    ${GRIND_SRC}
    return {
      set(state) {
        myPlayer = state.myPlayer; visibleObjects = state.visibleObjects;
        mouseX = state.mouseX; mouseY = state.mouseY;
        canPlace = state.canPlace; isItemLimit = state.isItemLimit;
      },
      move: keyMove => lunaGrindMove(keyMove),
      anchor: () => lunaGrindAnchor,
      tick(state) {
        if (state) this.set(state);
        gatherGrind = false; grindAngle = null; grindHat = null; grindObjects = [];
        lunaAutoGrind();
        return { gatherGrind, grindAngle, grindHat, predictWeapon, grindObjects };
      },
      action: t => lunaGrindAction(t),
      setPlayer: p => { myPlayer = p; }
    };`);
  return factory(env);
}

/* ---- Ryn's AutoGrind, for comparison (its aim and its action) ---- */
function rynTick(world, mouseAngle) {
  const p = world.player;
  const mine = world.objects.filter(o => dist(o.x, o.y, p.x, p.y) <= 300);
  if (!mine.length) {
    const s = Math.PI / 180;
    return { place: world.sandbox ? [ mouseAngle, mouseAngle - 75 * s, mouseAngle + 75 * s ] : [ mouseAngle - 40 * s, mouseAngle + 40 * s ] };
  }
  let sx = 0, sy = 0, nearest = null, nd = Infinity;
  for (const o of mine) { sx += o.x; sy += o.y; const d = dist(o.x, o.y, p.x, p.y); if (d < nd) { nd = d; nearest = o; } }
  const middle = Math.atan2(sy / mine.length - p.y, sx / mine.length - p.x);
  /* getGrindAction, hammer slot (the case this test grinds) */
  return { slot: 1, angle: middle, hat: 40, nearest };
}

/* ---- run one grind to ruby ---- */
function run(kind, opts, seed) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  const world = makeWorld(opts);
  Object.assign(world.xp, opts.xp || {});
  const until = opts.until || 10;
  const grind = kind === "luna" ? lunaGrind(world) : null;
  const mouseAngle = rnd() * 2 * Math.PI - Math.PI;
  let facing = 0, idle = 0;
  const target = 3;
  let prevX = world.player.x, prevY = world.player.y;
  for (let t = 0; t < 60000; t++) {
    /* the server's update, with the move the client sent last tick */
    world.physics();
    world.player.x += (rnd() - 0.5) * 0.4;                /* rounding on the wire */
    world.player.y += (rnd() - 0.5) * 0.4;
    world.syncVariants();
    if (world.variantOf(until) >= target) return { done: true, world, ticks: t };
    for (const k of [ 0, 1 ]) world.reload[k] = Math.max(0, world.reload[k] - TICK);

    let decision;
    if (kind === "luna") {
      /* what Luna knows: the position, and xVel = its next-position estimate */
      Object.assign(world.player, { x2: world.player.x, y2: world.player.y,
        xVel: world.player.x * 2 - prevX, yVel: world.player.y * 2 - prevY });
      prevX = world.player.x; prevY = world.player.y;
      grind.set({
        myPlayer: world.player,
        visibleObjects: world.objects,
        mouseX: 640 + Math.cos(mouseAngle) * 200, mouseY: 400 + Math.sin(mouseAngle) * 200,
        canPlace: (id, angle) => {
          const rr = PLAYER_SCALE + TURRET.scale + (TURRET.placeOffset || 0);
          return world.objects.length < world.limit && world.canPlaceAt(world.player.x + rr * Math.cos(angle), world.player.y + rr * Math.sin(angle));
        },
        isItemLimit: () => world.objects.length >= world.limit
      });
      /* no movement key held: the grind's step, or stand still */
      const mv = grind.move(null);
      world.moveDir = mv === undefined ? null : mv;
      const r = grind.tick();
      if (r.grindObjects.length) {
        const a = grind.anchor();
        world.anchors.push({ x: a.x, y: a.y, axis: a.axis });
        decision = { place: r.grindObjects.map(o => o.angle) };
      }
      else if (r.gatherGrind) decision = { slot: r.predictWeapon === 10 ? 1 : 0, angle: r.grindAngle, hat: r.grindHat };
    } else {
      decision = rynTick(world, mouseAngle);
    }
    if (!decision) { if (++idle > 200) return { done: false, world, ticks: t, why: "idle" }; continue; }
    idle = 0;
    if (decision.place) { decision.place.forEach(a => world.place(a)); continue; }
    world.hat = decision.hat;
    world.held = world.player.weapons[decision.slot];
    /* the server turns to the last facing it was sent (within 0.02 rad) */
    facing = decision.angle + (rnd() - 0.5) * 0.04;
    if (world.reload[decision.slot] === 0) world.swing(decision.slot, facing);
    if (world.emptySwings > 50 && world.emptySwings > world.swings * 0.5) return { done: false, world, ticks: t, why: "swinging at nothing" };
  }
  return { done: false, world, ticks: 60000, why: "timeout" };
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? "  ok   " : "  FAIL ") + name + (detail !== undefined && !ok ? "  -> " + JSON.stringify(detail) : ""));
}

/* ---- placement geometry ---- */
console.log("placement");
const minGap = 2 * Math.asin((2 * TURRET.scale) / (2 * (PLAYER_SCALE + TURRET.scale + TURRET.placeOffset)));
console.log("    turrets from one spot must be >= " + (minGap * 180 / Math.PI).toFixed(1) + " deg apart; a swing reaches " + (GATHER_ANGLE * 180 / Math.PI).toFixed(1) + " deg either side");
check("sandbox spacing (75 deg) is placeable", 75 * Math.PI / 180 >= minGap);
check("normal spacing (80 deg) is placeable", 80 * Math.PI / 180 >= minGap);
check("three from one spot can never share one swing", minGap > GATHER_ANGLE);

for (const sandbox of [ true, false ]) {
  console.log(sandbox ? "sandbox: 3 turrets toward the mouse" : "normal server: 2 turrets toward the mouse");
  const w = makeWorld({ sandbox, primary: 5 });
  const g = lunaGrind(w);
  let placed = [];
  for (let i = 0; i < 12; i++) {
    const mouse = -Math.PI + i * Math.PI / 6;
    const r = g.tick({
      myPlayer: Object.assign(w.player, { x2: 0, y2: 0 }), visibleObjects: [],
      mouseX: 640 + Math.cos(mouse) * 200, mouseY: 400 + Math.sin(mouse) * 200,
      canPlace: () => true, isItemLimit: () => false
    });
    const want = sandbox ? [ 0, -75, 75 ] : [ -40, 40 ];
    placed.push(r.grindObjects.length === want.length &&
      r.grindObjects.every((o, k) => angleDist(o.angle, mouse + want[k] * Math.PI / 180) < 1e-9));
  }
  check("places toward the mouse, in every direction", placed.every(Boolean));
}

/* ---- the action matches Ryn's getGrindAction ---- */
console.log("weapon and hat (Ryn's getGrindAction)");
{
  const w = makeWorld({ sandbox: true, primary: 5 });
  const g = lunaGrind(w);
  const P = weaponsById[5], H = weaponsById[10];
  const pd = P.dmg * (P.sDmg || 1) * 3.3, hd = H.dmg * (H.sDmg || 1) * 3.3;
  const cases = [
    { pv: 0, hv: 0, hp: 800, want: { weapon: 1, hat: 40 } },                    /* hammer first */
    { pv: 0, hv: 3, hp: 800, want: { weapon: 1, hat: 40 } },                    /* primary: chip with tank */
    { pv: 0, hv: 3, hp: pd + 1, want: { weapon: 1, hat: 0 } },                  /* chip without tank */
    { pv: 0, hv: 3, hp: pd - 1, want: { weapon: 0, hat: 40 } },                 /* primary takes the kill */
    { pv: 3, hv: 3, hp: 800, want: null }                                       /* done */
  ];
  for (const c of cases) {
    w.player.weaponVariants = { 5: c.pv, 10: c.hv };
    g.setPlayer(w.player);
    const got = g.action({ health: c.hp });
    check(`primary ${c.pv}, hammer ${c.hv}, turret ${Math.round(c.hp)} hp -> ` + JSON.stringify(c.want), JSON.stringify(got) === JSON.stringify(c.want), got);
  }
  void hd;
}

/* ---- grinding the great hammer to ruby ---- */
for (const sandbox of [ true, false ]) {
  console.log((sandbox ? "sandbox" : "normal server") + ": great hammer from nothing to ruby, 40 random mouse directions");
  const luna = [], ryn = [];
  for (let i = 0; i < 40; i++) {
    luna.push(run("luna", { sandbox, primary: 5 }, 1000 + i));
    ryn.push(run("ryn", { sandbox, primary: 5 }, 1000 + i));
  }
  const avg = list => Math.round(list.reduce((s, r) => s + r.world.swings, 0) / list.length);
  const stuck = list => list.filter(r => !r.done).length;
  const empty = list => (list.reduce((s, r) => s + r.world.emptySwings, 0) / list.reduce((s, r) => s + r.world.swings, 0) * 100).toFixed(1);
  console.log(`    Luna: reached ruby ${40 - stuck(luna)}/40, ${avg(luna)} swings, ${empty(luna)}% swings hit nothing`);
  console.log(`    Ryn : reached ruby ${40 - stuck(ryn)}/40, ${stuck(ryn) ? "stuck: " + (ryn.find(r => !r.done) || {}).why : avg(ryn) + " swings"}, ${empty(ryn)}% swings hit nothing`);
  check("Luna always reaches ruby", stuck(luna) === 0, luna.filter(r => !r.done).map(r => r.why));
  check("no swing at empty air", luna.every(r => r.world.emptySwings === 0), luna.map(r => r.world.emptySwings));
  const perSwing = list => list.reduce((s, r) => s + r.world.hits, 0) / list.reduce((s, r) => s + r.world.swings, 0);
  const together = list => { const k = [].concat(...list.map(r => r.world.kills)); return k.filter(n => n === (sandbox ? 3 : 2)).length / k.length; };
  const spots = [].concat(...luna.map(r => r.world.swingSpots));
  const anchorsDrift = Math.max(...luna.map(r => Math.max(...r.world.anchors.map(a => dist(a.x, a.y, r.world.anchors[0].x, r.world.anchors[0].y)))));
  console.log(`    turrets hit per swing: Luna ${perSwing(luna).toFixed(2)}, Ryn ${perSwing(ryn).toFixed(2)}`);
  console.log(`    sets broken by one swing: Luna ${(together(luna) * 100).toFixed(0)}%, Ryn ${(together(ryn) * 100).toFixed(0)}%`);
  console.log(`    standing ${Math.min(...spots).toFixed(1)}-${Math.max(...spots).toFixed(1)} units behind the placing spot when swinging; placing spot drifts at most ${anchorsDrift.toFixed(1)}`);
  if (sandbox) {
    check("every swing hits all three", perSwing(luna) >= 2.95, perSwing(luna));
    check("every set of three breaks on one swing", together(luna) === 1, together(luna));
    check("swings from 15-45 units back (inside the window where three fit)", spots.every(b => b >= 15 && b <= 45), [ Math.min(...spots), Math.max(...spots) ]);
  } else {
    check("both turrets every swing with two", perSwing(luna) >= 1.95, perSwing(luna));
    check("no step needed with two: swings from the placing spot (within the 8-unit walk-back tolerance)", spots.every(b => Math.abs(b) < 8), [ Math.min(...spots), Math.max(...spots) ]);
  }
  check("walks back after each set: the placing spot stays put", anchorsDrift < 12, anchorsDrift);
}

console.log("primary (polearm) from nothing to ruby, hammer already ruby — hammer chips, polearm kills");
{
  const res = [];
  for (let i = 0; i < 20; i++) res.push(run("luna", { sandbox: true, primary: 5, until: 5, xp: { 10: 12000 } }, 2000 + i));
  check("polearm reaches ruby every time", res.every(r => r.done), res.filter(r => !r.done).map(r => r.why));
  check("the hammer gains nothing while the polearm is ground", res.every(r => r.world.xp[10] === 12000), res.map(r => r.world.xp[10]));
  console.log(`    ${Math.round(res.reduce((s, r) => s + r.world.swings, 0) / res.length)} swings on average, ${Math.round(res.reduce((s, r) => s + r.world.turretsPlaced, 0) / res.length)} turrets`);
}

const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
