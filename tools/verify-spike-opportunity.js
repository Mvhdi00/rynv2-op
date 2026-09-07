// Harness: runs the REAL SpikeOpportunity evaluator + the REAL AutoPlacer
// helpers extracted verbatim from Ryn_Type_2.user.js, against synthetic
// geometry covering the scenarios in Phase 15.
const fs = require("fs");
const SRC = fs.readFileSync(process.argv[2] || "Ryn_Type_2.user.js", "utf8");
const lines = SRC.split("\n");

function slice(startPat, endLine) {
  const s = lines.findIndex(l => l.includes(startPat));
  if (s < 0) throw new Error("not found: " + startPat);
  return lines.slice(s, endLine).join("\n");
}
// Ends on the first line that is EXACTLY endLine, so a nested closing brace
// at deeper indentation cannot terminate the slice early.
function grab(startPat, endLine) {
  const s = lines.findIndex(l => l.includes(startPat));
  if (s < 0) throw new Error("not found: " + startPat);
  for (let i = s + 1; i < lines.length; i++) {
    if (lines[i] === endLine) return lines.slice(s, i + 1).join("\n");
  }
  throw new Error("end not found for " + startPat);
}

// --- real helpers, lifted verbatim -----------------------------------------
const getAngleDistSrc = grab("const getAngleDist = (a, b) => {", "  };");
const lineInRectSrc = grab("const lineInRect = (x1, y1, x2, y2, ax, ay, bx, by) => {", "  };");
// evaluator: from the SO_ constants through the close of SpikeOpportunity
const evalStart = lines.findIndex(l => l.includes("const SO_MAX_ALIGN"));
const evalEnd = lines.findIndex((l, i) => i > evalStart && l.includes("── Geometry ──"));
const evaluatorSrc = lines.slice(evalStart, evalEnd - 1).join("\n");
// the AutoPlacer picker, lifted verbatim
const pickerSrc = grab("_bestPrimaryKbSpike(spikeAngles, ctx) {", "    }");

const PI = Math.PI;
const RPE_DECEL = .993, RPE_KB_IMPULSE = 1.5;
const RPE_KB_TRAVEL = RPE_KB_IMPULSE / (1 - RPE_DECEL);

const sandbox = { Math, console };
const code = `
${getAngleDistSrc}
${lineInRectSrc}
${evaluatorSrc}
const picker = { ${pickerSrc} };
return { SpikeOpportunity, picker, SO_TRAP_VETO_STRENGTH, SO_MAX_ALIGN };
`;
const { SpikeOpportunity, picker, SO_TRAP_VETO_STRENGTH, SO_MAX_ALIGN } =
  new Function("PI", "RPE_KB_TRAVEL", code)(PI, RPE_KB_TRAVEL);

// --- fakes matching the client's shapes ------------------------------------
const P = (x, y) => ({ x, y });
function spike(x, y, scale = 35) {
  return { pos: { current: P(x, y) }, collisionScale: scale };
}
function client(knockback, inRange = true, reloaded = true) {
  return {
    _ModuleHandler: { tickCount: tick },
    myPlayer: {
      pos: { current: playerPos },
      getPrimaryKnockback() {
        return reloaded && inRange ? knockback : 0;
      }
    }
  };
}
let tick = 1;
let playerPos = P(0, 0);

const ENEMY = { id: 7 };
const ESCALE = 35;
// A candidate spike ring slot: matches AutoPlacer's angle entries.
function cand(x, y, scale = 35) { return { x, y, scale, id: 4 }; }

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
}
function ctxFor(spikes, enemy, kb = 55.6, inRange = true, reloaded = true, key) {
  tick++;
  SpikeOpportunity.reset();
  return SpikeOpportunity.context(client(kb, inRange, reloaded), ENEMY, enemy, ESCALE, spikes, key || "now");
}

console.log("\n== Phase 15 scenarios ==\n");

// 1. Enemy with no friendly spike nearby
{
  const c = ctxFor([], P(200, 0));
  check("1 no friendly spike -> no chain", c !== null && c.strength === 0 && c.best === null,
    c && ("strength=" + c.strength));
  // a candidate on the push line is still a terminal opportunity
  check("1b candidate on push line still scores", SpikeOpportunity.score(c, 260, 0, 35) > 0);
}

// 2. Friendly spike behind the enemy (player 0,0 -> enemy 200,0 -> spike 300,0)
{
  const c = ctxFor([spike(300, 0)], P(200, 0));
  check("2 spike behind enemy -> chain live", c.best !== null && c.strength > 0, "strength=" + (c && c.strength));
  check("2b alignment is dead-on", c.best.align < 0.01, "align=" + c.best.align);
}

// 3. Friendly spike in front (between player and enemy) -> no chain
{
  const c = ctxFor([spike(100, 0)], P(200, 0));
  check("3 spike in front -> no chain", c.best === null && c.strength === 0);
}

// 4/5. Player behind vs in front of the enemy flips the push axis
{
  const behind = ctxFor([spike(300, 0)], P(200, 0));           // player at 0,0
  playerPos = P(400, 0);
  const front = ctxFor([spike(300, 0)], P(200, 0));            // player past the enemy
  playerPos = P(0, 0);
  check("4 player behind enemy -> spike catches", behind.best !== null);
  check("5 player in front -> push goes the other way, no catch", front.best === null);
}

// 6/7. Wrong vs correct knockback direction (spike off to the side)
{
  const wrong = ctxFor([spike(200, 300)], P(200, 0));   // perpendicular, far
  const right = ctxFor([spike(255, 0)], P(200, 0));
  check("6 wrong kb direction -> no chain", wrong.best === null);
  check("7 correct kb direction -> chain", right.best !== null);
}

// 8/9. Moving enemy: predicted position changes the chain
{
  const now = ctxFor([spike(300, 0)], P(200, 0), 55.6, true, true, "now");
  // fast enemy predicted well off the axis
  const next = ctxFor([spike(300, 0)], P(200, 120), 55.6, true, true, "next");
  check("8 moving enemy, current frame chain holds", now.best !== null);
  check("9 fast enemy predicted off-axis -> chain lost", next.best === null);
}

// 10. Multiple friendly spikes -> pair bonus
{
  const one = ctxFor([spike(300, 0)], P(200, 0));
  const two = ctxFor([spike(290, -18), spike(290, 18)], P(200, 0));
  check("10 two straddling spikes score above one", two.strength > one.strength,
    one.strength + " vs " + two.strength);
  check("10b pair detected", two.pairs > 0);
}

// 11. Candidate spike unavailable (empty angle set)
{
  const c = ctxFor([spike(300, 0)], P(200, 0));
  check("11 no candidate angles -> picker returns null", picker._bestPrimaryKbSpike([], c) === null);
}

// 12/13. Trap-vs-spike arbitration threshold
{
  const strong = ctxFor([spike(300, 0)], P(200, 0));
  check("13 dead-on chain clears the trap veto bar", strong.strength >= SO_TRAP_VETO_STRENGTH,
    "strength=" + strong.strength);
  // a glancing chain: spike near the edge of the allowed cone
  const ang = SO_MAX_ALIGN * 0.92, d = 60;
  const glance = ctxFor([spike(200 + d * Math.cos(ang), d * Math.sin(ang), 30)], P(200, 0));
  check("12 glancing chain stays below the bar (trap keeps its slot)",
    glance.best === null || glance.strength < SO_TRAP_VETO_STRENGTH,
    "strength=" + (glance && glance.strength));
}

// 14/15. Prediction: preplace uses the predicted frame, and it is cached apart
{
  tick++;
  SpikeOpportunity.reset();
  const cl = client(55.6);
  const a = SpikeOpportunity.context(cl, ENEMY, P(200, 0), ESCALE, [spike(300, 0)], "now");
  const b = SpikeOpportunity.context(cl, ENEMY, P(200, 200), ESCALE, [spike(300, 0)], "next");
  check("14 now/next solved separately", a.best !== null && b.best === null);
  const again = SpikeOpportunity.context(cl, ENEMY, P(9999, 9999), ESCALE, [], "now");
  check("15 same key in one tick is memoised", again === a);
}

// 16. Auto place decision: picker prefers the better-aligned terminal
{
  const c = ctxFor([], P(200, 0));
  const good = cand(258, 0);     // straight down the push axis
  const off = cand(232, 46);     // same distance, well off axis
  const best = picker._bestPrimaryKbSpike([off, good], c);
  check("16 picker chooses the aligned terminal", best === good);
}

// 18. Packet-limit conditions are the host's; evaluator must be side-effect free
{
  const c = ctxFor([spike(300, 0)], P(200, 0));
  const before = JSON.stringify(c);
  SpikeOpportunity.score(c, 258, 0, 35);
  SpikeOpportunity.onPath(c, 258, 0, 35);
  check("18 evaluator does not mutate its context", JSON.stringify(c) === before);
}

// 19/20. Invalid input and out-of-range enemy
{
  check("19 null context scores 0", SpikeOpportunity.score(null, 1, 2, 3) === 0);
  check("19b null context is not on path", SpikeOpportunity.onPath(null, 1, 2, 3) === false);
  const out = ctxFor([spike(300, 0)], P(200, 0), 55.6, false);
  check("20 enemy out of primary range -> no context", out === null);
  const unready = ctxFor([spike(300, 0)], P(200, 0), 55.6, true, false);
  check("20b primary not reloaded -> no context", unready === null);
  const tiny = ctxFor([spike(300, 0)], P(200, 0), 5);
  check("20c travel below floor -> no context", tiny === null);
}

// 21. Multiple targets: context is keyed by enemy id
{
  tick++;
  SpikeOpportunity.reset();
  const cl = client(55.6);
  const one = SpikeOpportunity.context(cl, { id: 1 }, P(200, 0), ESCALE, [spike(300, 0)], "now");
  const two = SpikeOpportunity.context(cl, { id: 2 }, P(0, 200), ESCALE, [spike(0, 300)], "now");
  check("21 separate targets get separate contexts", one !== two && one.best && two.best);
}

// 22. No valid opportunity -> candidate scores nothing
{
  const c = ctxFor([], P(200, 0));
  check("22 candidate far off the push line scores 0", SpikeOpportunity.score(c, 200, -400, 35) === 0);
}

// 23/24. Chained / rebound pressure (Phase 8): spike behind + candidate in front
{
  const c = ctxFor([spike(300, 0)], P(200, 0));
  const sandwich = cand(150, 0);   // back down the rebound line
  const elsewhere = cand(200, -300);
  const sScore = SpikeOpportunity.score(c, sandwich.x, sandwich.y, sandwich.scale);
  const eScore = SpikeOpportunity.score(c, elsewhere.x, elsewhere.y, elsewhere.scale);
  check("24 rebound sandwich scores", sScore > 0, "score=" + sScore);
  check("23 unrelated ground does not", eScore === 0, "score=" + eScore);
  check("24b picker prefers the sandwich", picker._bestPrimaryKbSpike([elsewhere, sandwich], c) === sandwich);
}

// 12b/17. The trap veto: exactly the expression the ladder uses, over the real
// evaluator. A trap only loses ground when a chain clears the bar AND a spike
// was actually picked to use it.
{
  const vetoOf = (ctx, spike) =>
    spike !== null && ctx !== null && ctx.strength >= SO_TRAP_VETO_STRENGTH;

  const live = ctxFor([spike(300, 0)], P(200, 0));
  const pick = picker._bestPrimaryKbSpike([cand(258, 0)], live);
  check("12b live chain + picked spike -> veto arms", vetoOf(live, pick) === true);

  const noSpikes = ctxFor([], P(200, 0));
  const pick2 = picker._bestPrimaryKbSpike([cand(258, 0)], noSpikes);
  check("12c terminal-only opportunity does NOT arm the veto (traps keep ground)",
    pick2 !== null && vetoOf(noSpikes, pick2) === false);

  const noPick = ctxFor([spike(300, 0)], P(200, 0));
  check("12d chain but no spike angle available -> veto stays off",
    vetoOf(noPick, picker._bestPrimaryKbSpike([], noPick)) === false);

  check("12e no primary swing -> nothing arms",
    vetoOf(ctxFor([spike(300, 0)], P(200, 0), 55.6, false), null) === false);

  // onPath is what decides which traps are given up.
  const c = ctxFor([spike(300, 0)], P(200, 0));
  check("12f trap on the knockback path is identified", SpikeOpportunity.onPath(c, 240, 0, 40) === true);
  check("12g trap off the path is left alone", SpikeOpportunity.onPath(c, 200, -260, 40) === false);
}

// perf sanity: one solve + many candidate tests
{
  const c = ctxFor([spike(300, 0), spike(290, 40)], P(200, 0));
  const t0 = process.hrtime.bigint();
  let acc = 0;
  for (let i = 0; i < 72000; i++) {
    const a = (i % 72) * (Math.PI * 2 / 72);
    acc += SpikeOpportunity.score(c, 200 + 60 * Math.cos(a), 60 * Math.sin(a), 35);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`  perf 72000 candidate scores in ${ms.toFixed(1)}ms (${(ms / 1000).toFixed(4)}ms per 72-angle pass)`);
  check("perf under 1ms per 72-angle pass", ms / 1000 < 1);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
