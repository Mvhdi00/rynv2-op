// Trap standoff, tested against the game's own collision resolution.
//
// The module is lifted out of the client and run on stubs; the opponent is
// moved by a transcription of moomoo's checkCollision player branch and its
// movement integration, so "did the enemy leave the trap" is answered by the
// game's arithmetic rather than by the module's own idea of it.

const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "..", "Ryn_Type_2.user.js");
const lines = fs.readFileSync(SRC, "utf8").split("\n");

function lift(header, closer) {
  const s = lines.findIndex(l => l === header);
  if (s === -1) throw new Error("not found: " + header);
  for (let i = s + 1; i < lines.length; i++) if (lines[i] === closer) return lines.slice(s, i + 1).join("\n");
  throw new Error("end not found: " + header);
}
function constant(name) {
  const line = lines.find(l => l.startsWith("  const " + name + " = "));
  if (!line) throw new Error("constant not found: " + name);
  return eval(line.slice(line.indexOf("=") + 1).replace(/;\s*$/, ""));
}

const TRAP_STANDOFF_MIN = constant("TRAP_STANDOFF_MIN");
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const Settings_default = { _trapStandoff: true, _trapStandoffRange: 95 };
// Derived in the client from the shipped config; recomputed here from the same
// three numbers so the test states them rather than trusting a lifted line.
const Config_default = { playerSpeed: 0.0016, playerDecel: 0.993, serverUpdateRate: 9 };
const TRAP_STANDOFF_STEP = Config_default.playerSpeed / (1 - Config_default.playerDecel) * (1e3 / Config_default.serverUpdateRate);
const TRAP_STANDOFF_RECOVER = TRAP_STANDOFF_STEP;

const TrapStandoff = new Function("Settings_default", "clamp", "Config_default",
  "TRAP_STANDOFF_MIN", "TRAP_STANDOFF_STEP", "TRAP_STANDOFF_RECOVER",
  lift("  class TrapStandoff {", "  }") + "\n  return TrapStandoff;"
)(Settings_default, clamp, Config_default, TRAP_STANDOFF_MIN, TRAP_STANDOFF_STEP, TRAP_STANDOFF_RECOVER);

// ── the game, transcribed ────────────────────────────────────────────────────
const PLAYER_SCALE = 35;
const TRAP_SCALE = 50, TRAP_COLDIV = 0.2;
const TRAP_HOLD = PLAYER_SCALE + TRAP_SCALE * TRAP_COLDIV;   // 45
const PUSH_AT = PLAYER_SCALE + PLAYER_SCALE;                 // 70
const SPEED = 0.0016, DECEL = 0.993, TICK_MS = 1000 / 9;
const PER_TICK = SPEED / (1 - DECEL) * TICK_MS;              // ~25.4

// checkCollision, player branch. getDirection(x1,y1,x2,y2) = atan2(y1-y2, x1-x2),
// so w points from u to h and each is displaced half the overlap outward.
function resolvePlayers(h, u) {
  const dx = h.x - u.x, dy = h.y - u.y;
  const dist = Math.hypot(dx, dy);
  const P = PLAYER_SCALE + PLAYER_SCALE;
  let f = dist - P;
  if (f > 0) return 0;
  const w = Math.atan2(h.y - u.y, h.x - u.x);
  f = f * -1 / 2;
  h.x += f * Math.cos(w); h.y += f * Math.sin(w);
  u.x -= f * Math.cos(w); u.y -= f * Math.sin(w);
  return f;
}

// ── harness ──────────────────────────────────────────────────────────────────
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function makeWorld(opts) {
  const trap = { x: opts.trapX, y: opts.trapY, ownerID: opts.trapOwner ?? 1 };
  const enemy = {
    id: 2, trappedIn: trap,
    pos: { current: { x: opts.enemyX, y: opts.enemyY }, future: null }
  };
  const me = {
    id: 1, inGame: true, trappedIn: null,
    pos: { current: { x: opts.meX, y: opts.meY }, future: null }
  };
  me.pos.current.distance = function (o) { return Math.hypot(this.x - o.x, this.y - o.y); };
  const ModuleHandler = { moveTo: "disable", move_dir: opts.moveDir ?? null };
  const client = {
    myPlayer: me,
    _ModuleHandler: ModuleHandler,
    PlayerManager: {
      enemies: [ enemy ],
      // trap owner 1 is me, anything else is an enemy's trap
      isEnemyByID: (ownerID) => ownerID !== 1
    }
  };
  return { client, me, enemy, trap, ModuleHandler };
}

// One tick: run the module, walk me in whatever direction survived, then let
// the game resolve the overlap.
function step(w, range) {
  Settings_default._trapStandoffRange = range;
  w.ModuleHandler.moveTo = "disable";
  // The client extrapolates one tick ahead; mirror that for both sides.
  const dir = w.ModuleHandler.move_dir;
  w.me.pos.future = dir === null ? { x: w.me.pos.current.x, y: w.me.pos.current.y }
    : { x: w.me.pos.current.x + Math.cos(dir) * PER_TICK, y: w.me.pos.current.y + Math.sin(dir) * PER_TICK };
  w.enemy.pos.future = { x: w.enemy.pos.current.x, y: w.enemy.pos.current.y };

  const mod = new TrapStandoff(w.client);
  mod.postTick();

  const walk = w.ModuleHandler.moveTo !== "disable" ? w.ModuleHandler.moveTo : w.ModuleHandler.move_dir;
  if (walk !== null && walk !== undefined) {
    w.me.pos.current.x += Math.cos(walk) * PER_TICK;
    w.me.pos.current.y += Math.sin(walk) * PER_TICK;
  }
  resolvePlayers(w.me.pos.current, w.enemy.pos.current);
  return walk;
}

const escaped = w => Math.hypot(w.enemy.pos.current.x - w.trap.x, w.enemy.pos.current.y - w.trap.y) >= TRAP_HOLD;

console.log("\ngame constants, derived from the shipped tables");
check("push threshold is 70", PUSH_AT === 70, `= ${PUSH_AT}`);
check("trap holds to 45", TRAP_HOLD === 45, `= ${TRAP_HOLD}`);
check("travel per tick ~25", Math.abs(PER_TICK - 25.4) < 0.2, `= ${PER_TICK.toFixed(1)}`);
check("slider floor is the push threshold", TRAP_STANDOFF_MIN === PUSH_AT);

// ── the thing the feature exists for ─────────────────────────────────────────
console.log("\nwalking straight at an enemy held in my trap, 40 ticks");
for (const label of [ "OFF", "ON" ]) {
  Settings_default._trapStandoff = label === "ON";
  const w = makeWorld({ trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000, meX: 1000 - 200, meY: 1000 });
  w.ModuleHandler.move_dir = 0;   // due east, straight into them
  let minGap = Infinity, ticks = 0;
  for (let t = 0; t < 40; t++) {
    step(w, 95);
    minGap = Math.min(minGap, Math.hypot(w.me.pos.current.x - w.enemy.pos.current.x, w.me.pos.current.y - w.enemy.pos.current.y));
    if (escaped(w)) break;
    ticks++;
  }
  const drift = Math.hypot(w.enemy.pos.current.x - w.trap.x, w.enemy.pos.current.y - w.trap.y);
  console.log(`  standoff ${label.padEnd(3)}  closest approach ${minGap.toFixed(1)}   enemy drifted ${drift.toFixed(1)} of ${TRAP_HOLD}   ${escaped(w) ? "ESCAPED on tick " + ticks : "still trapped"}`);
  if (label === "OFF") check("without it, walking in frees them", escaped(w));
  else {
    check("with it, they never leave the trap", !escaped(w));
    check("with it, they are never even touched", drift === 0, `drift ${drift.toFixed(3)}`);
    check("with it, I never come inside 70", minGap >= PUSH_AT - 1e-9, `closest ${minGap.toFixed(1)}`);
  }
}

// ── it must not freeze you ───────────────────────────────────────────────────
console.log("\nit constrains, it does not stop you");
{
  Settings_default._trapStandoff = true;
  const w = makeWorld({ trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000, meX: 1000 - 95, meY: 1000 });
  w.ModuleHandler.move_dir = Math.PI / 2;   // straight across, tangential
  const before = { ...w.me.pos.current };
  const walk = step(w, 95);
  const moved = Math.hypot(w.me.pos.current.x - before.x, w.me.pos.current.y - before.y);
  check("tangential movement is allowed through untouched", walk !== null && moved > PER_TICK - 1e-6, `moved ${moved.toFixed(1)}`);
}
{
  const w = makeWorld({ trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000, meX: 1000 - 80, meY: 1000 });
  w.ModuleHandler.move_dir = Math.PI;   // walking away
  w.ModuleHandler.moveTo = "disable";
  const mod = new TrapStandoff(w.client);
  w.me.pos.future = { x: w.me.pos.current.x - PER_TICK, y: w.me.pos.current.y };
  w.enemy.pos.future = { x: w.enemy.pos.current.x, y: w.enemy.pos.current.y };
  mod.postTick();
  check("retreating is left alone, no packet spent", w.ModuleHandler.moveTo === "disable");
}
{
  // Standing still, already inside the ring: an overlap pushes every tick
  // whether or not anyone walks, so this case has to actively back off.
  const w = makeWorld({ trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000, meX: 1000 - 60, meY: 1000 });
  w.ModuleHandler.move_dir = null;
  const walk = step(w, 95);
  check("standing still inside the ring backs off", walk !== null && Math.abs(walk - Math.PI) < 1e-6, `angle ${walk === null ? "null" : walk.toFixed(3)}`);
}
{
  const w = makeWorld({ trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000, meX: 1000 - 200, meY: 1000 });
  w.ModuleHandler.move_dir = null;
  const walk = step(w, 95);
  check("standing still far away is not disturbed", walk === null);
}

// ── ownership and precedence ─────────────────────────────────────────────────
console.log("\nwhose trap, and who wins the tick");
{
  const w = makeWorld({ trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000, meX: 1000 - 50, meY: 1000, trapOwner: 9 });
  w.ModuleHandler.move_dir = 0;
  step(w, 95);
  check("an enemy's own trap is not defended", w.ModuleHandler.moveTo === "disable");
}
{
  const w = makeWorld({ trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000, meX: 1000 - 50, meY: 1000 });
  w.ModuleHandler.move_dir = 0;
  w.ModuleHandler.moveTo = 1.234;         // auto push already claimed the tick
  const mod = new TrapStandoff(w.client);
  w.me.pos.future = { x: w.me.pos.current.x + PER_TICK, y: w.me.pos.current.y };
  w.enemy.pos.future = { x: w.enemy.pos.current.x, y: w.enemy.pos.current.y };
  mod.postTick();
  check("auto push keeps the tick it claimed", w.ModuleHandler.moveTo === 1.234);
}
{
  const w = makeWorld({ trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000, meX: 1000 - 50, meY: 1000 });
  w.me.trappedIn = { x: 0, y: 0 };        // pinned myself
  w.ModuleHandler.move_dir = 0;
  step(w, 95);
  check("does nothing while I am pinned myself", w.ModuleHandler.moveTo === "disable");
}
{
  Settings_default._trapStandoff = false;
  const w = makeWorld({ trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000, meX: 1000 - 50, meY: 1000 });
  w.ModuleHandler.move_dir = 0;
  step(w, 95);
  check("off means off", w.ModuleHandler.moveTo === "disable");
  Settings_default._trapStandoff = true;
}

// ── every slider value has to hold ───────────────────────────────────────────
console.log("\nevery slider value, approached from every angle");
{
  let worst = Infinity, worstAt = null, anyEscape = false;
  for (let range = 70; range <= 120; range += 5) {
    for (let a = 0; a < 32; a++) {
      const ang = a * Math.PI * 2 / 32;
      const w = makeWorld({
        trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000,
        meX: 1000 + Math.cos(ang) * 220, meY: 1000 + Math.sin(ang) * 220
      });
      // Charge the enemy head-on from this bearing.
      w.ModuleHandler.move_dir = Math.atan2(1000 - w.me.pos.current.y, 1000 - w.me.pos.current.x);
      for (let t = 0; t < 30; t++) {
        step(w, range);
        const gap = Math.hypot(w.me.pos.current.x - w.enemy.pos.current.x, w.me.pos.current.y - w.enemy.pos.current.y);
        if (gap < worst) { worst = gap; worstAt = { range, bearing: (ang * 180 / Math.PI).toFixed(0) }; }
        if (escaped(w)) { anyEscape = true; break; }
      }
    }
  }
  console.log(`  closest approach over all runs: ${worst.toFixed(1)} (range ${worstAt.range}, bearing ${worstAt.bearing} deg)`);
  check("no slider value ever lets them out", !anyEscape);
  check("no slider value ever reaches the push threshold", worst >= PUSH_AT - 1e-9);
}

// ── the slider has to mean what it says ──────────────────────────────────────
// A step is 25 units and a tangent step is a chord, not an arc, so holding a
// direction against the ring drifts outward by a few units a tick. The result
// is a limit cycle, not a fixed radius: approach until one more step would
// cross the line, drift out while turning, approach again. So what the slider
// promises is the floor of that cycle, and the test is that the floor is the
// setting — never under it, and never far over it either, or the number would
// be meaningless in the other direction.
console.log("\nwhere each slider value actually holds you");
{
  let worstUnder = 0, worstOver = 0;
  const ceilings = {};
  console.log("  setting   floor   ceiling");
  let seed = 7;
  const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >> 17; seed ^= seed << 5; seed >>>= 0; return seed / 0x100000000; };
  for (const range of [ 70, 80, 90, 95, 100, 110, 120 ]) {
    let floor = Infinity, ceiling = 0;
    for (let a = 0; a < 64; a++) {
      const ang = rnd() * Math.PI * 2;
      // Randomised start, so the run does not sample one fixed phase of the
      // cycle and mistake it for the whole of it.
      const start = 150 + rnd() * 140;
      const w = makeWorld({
        trapX: 1000, trapY: 1000, enemyX: 1000, enemyY: 1000,
        meX: 1000 + Math.cos(ang) * start, meY: 1000 + Math.sin(ang) * start
      });
      w.ModuleHandler.move_dir = Math.atan2(1000 - w.me.pos.current.y, 1000 - w.me.pos.current.x);
      for (let t = 0; t < 60; t++) {
        // Keep charging whatever the module last allowed, the way a player
        // holding a key does.
        const walk = step(w, range);
        if (walk !== null) w.ModuleHandler.move_dir = Math.atan2(1000 - w.me.pos.current.y, 1000 - w.me.pos.current.x);
        if (t < 20) continue;
        const gap = Math.hypot(w.me.pos.current.x - w.enemy.pos.current.x, w.me.pos.current.y - w.enemy.pos.current.y);
        floor = Math.min(floor, gap);
        ceiling = Math.max(ceiling, gap);
      }
    }
    worstUnder = Math.max(worstUnder, range - floor);
    worstOver = Math.max(worstOver, floor - range);
    ceilings[range] = ceiling;
    console.log(`     ${String(range).padStart(3)}    ${floor.toFixed(1).padStart(5)}    ${ceiling.toFixed(1).padStart(5)}`);
  }
  check("the floor is never under the setting", worstUnder <= 1e-6, `worst breach ${worstUnder.toFixed(2)}`);
  check("the floor is within a step of the setting", worstOver <= TRAP_STANDOFF_STEP, `worst gap ${worstOver.toFixed(1)} vs step ${TRAP_STANDOFF_STEP.toFixed(1)}`);
  // The ceiling is what decides whether the standoff costs a hit. A melee
  // swing reaches weapon.range + target.scale * 1.8, and the shortest primary
  // in the game is 65, so anything the cycle tops out under 128 is free.
  const SHORTEST_REACH = 65 + PLAYER_SCALE * 1.8;
  console.log(`\n  shortest melee reach in the game (tool hammer / daggers): ${SHORTEST_REACH}`);
  for (const range of [ 70, 80, 90, 95, 100, 110, 120 ]) {
    const ok = ceilings[range] <= SHORTEST_REACH;
    console.log(`    ${String(range).padStart(3)}  tops out at ${ceilings[range].toFixed(1).padStart(5)}  ${ok ? "in reach of everything" : "shortest weapons drop out at the top"}`);
  }
  check("the default 95 keeps every melee weapon in reach all cycle", ceilings[95] <= SHORTEST_REACH, `ceiling ${ceilings[95].toFixed(1)} vs ${SHORTEST_REACH}`);
}

console.log(failures === 0 ? "\nPASS" : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
