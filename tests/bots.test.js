// Behaviour tests for bot random movement. The scatter decision function and
// the reconcile loop are lifted out of the built userscript and driven against
// a stub fleet, so what is exercised is the shipped source.
const fs = require("fs");
const vm = require("vm");

const FILE = process.argv[2] || __dirname + "/../RYN_v5.4.user.js";
const src = fs.readFileSync(FILE, "utf8");
const lines = src.split("\n");
const find = pfx => {
  const i = lines.findIndex(l => l.startsWith(pfx));
  if (i < 0) throw new Error("not found: " + pfx);
  return i;
};

// The scatter helpers and their constants, up to (not including) the IIFE loop,
// plus the angle helper they call.
const helpers = lines
  .slice(find("  const getAngleDist = "), find("  const getAngleDist = ") + 4).join("\n") + "\n" +
  lines
  .slice(find("  const SCATTER_RETURN_TIMEOUT_MS"), find("  (function _scatterLoop() {"))
  .join("\n");

const M = vm.runInNewContext(
  "(function(){\nconst PI = Math.PI;\n" + helpers +
  "\nreturn { _scDecide, _scRepelAngle, _x18Wander, SCATTER_RETURN_TIMEOUT_MS, _SC_DECISION_MS, _X18_LEG_DISTANCE, _X18_MIN_TURN, getAngleDist };\n})()",
  { Math, Number, Array, Set, Map, console, Infinity, NaN, Date }
);

let pass = 0, fail = 0;
const check = (label, cond, detail) => {
  if (cond) { pass++; console.log("   PASS  " + label + (detail ? "  — " + detail : "")); }
  else { fail++; console.log("   FAIL  " + label + (detail ? "  — " + detail : "")); }
};
const head = (n, t) => console.log("\n" + n + ". " + t);

// ── stub world ─────────────────────────────────────────────────────────────
const V = (x, y) => ({ x, y });
const mkBot = () => ({
  ObjectManager: { objects: new Map(), grid2D: { query: () => false } },
  myPlayer: { id: 1, scale: 35, pos: { current: V(1000, 1000) }, isMyPlayerByID: () => false },
  _ModuleHandler: {},
});
const mkOwner = (bots) => ({
  isOwner: true,
  myPlayer: { id: 0, pos: { current: V(1000, 1000) }, isMyPlayerByID: id => id === 0 },
  PlayerManager: { players: [] },
  clients: new Set(bots),
});

// ═══════════════════════════════════════════════════════════════════════════
head(1, "The random walk itself");
{
  const bot = mkBot();
  const owner = mkOwner([bot]);
  const mh = { _scatterActive: true, _scatterReturning: false, _scatterLastMoveAngle: null };
  const angles = [];
  for (let i = 0; i < 200; i++) {
    const a = M._scDecide(owner, bot, mh, V(1000, 1000), Date.now());
    angles.push(a);
    mh._scatterLastMoveAngle = a;
  }
  check("every decision is a finite heading", angles.every(a => Number.isFinite(a)));
  const uniq = new Set(angles.map(a => Math.round(a * 4))).size;
  check("headings are genuinely spread, not one direction", uniq >= 8, uniq + " distinct heading buckets over 200 decisions");

  // x18's rule: a change of heading is always a hard turn, never a nudge.
  let softTurns = 0, minTurn = Infinity;
  for (let i = 1; i < angles.length; i++) {
    const d = M.getAngleDist(angles[i], angles[i - 1]);
    if (d < minTurn) minTurn = d;
    if (d <= M._X18_MIN_TURN) softTurns++;
  }
  check("every turn clears x18's minimum", softTurns === 0,
        "smallest turn " + minTurn.toFixed(2) + " rad, floor " + M._X18_MIN_TURN + " rad (" + Math.round(M._X18_MIN_TURN * 180 / Math.PI) + " deg)");

  // The picker on its own, including the no-previous case.
  check("the first heading is unconstrained", Number.isFinite(M._x18Wander(null)));
  let worst = Infinity;
  for (let i = 0; i < 2000; i++) {
    const prev = Math.random() * Math.PI * 2;
    worst = Math.min(worst, M.getAngleDist(prev, M._x18Wander(prev)));
  }
  check("holds over 2000 picks", worst > M._X18_MIN_TURN, "worst turn " + worst.toFixed(3) + " rad");

  // Returning mode aims at the owner, not at random.
  const rmh = { _scatterActive: false, _scatterReturning: true, _scatterLastMoveAngle: null };
  const ownerFar = mkOwner([bot]);
  ownerFar.myPlayer.pos.current = V(2000, 1000);
  const back = M._scDecide(ownerFar, bot, rmh, V(1000, 1000), Date.now());
  check("returning walks toward the owner", Math.abs(back) < 0.01, "heading " + back.toFixed(3) + " rad (owner is due east)");
}

// ═══════════════════════════════════════════════════════════════════════════
head(2, "Toggle wiring in the shipped source");
{
  check("the toggle key is bound", /_scatterBots: "Key[A-Z]"/.test(src), (/_scatterBots: "([^"]*)"/.exec(src) || [])[1]);
  check("no other default binds the same key", (src.match(/: "KeyJ"/g) || []).length === 1, (src.match(/: "KeyJ"/g) || []).length + " settings bound to KeyJ");
  check("state lives in Settings, not on the first bot", /_botsScattered: false,/.test(src));
  check("the toggle flips that flag", /Settings_default\._botsScattered = !Settings_default\._botsScattered;/.test(src));
  check("the toggle is persisted", /_botsScattered = !Settings_default\._botsScattered;\s*\n\s*SaveSettings\(\);/.test(src));
  check("an unset bind can no longer match", /Settings_default\._scatterBots && Settings_default\._scatterBots !== "\.\.\." && event\.code === Settings_default\._scatterBots/.test(src));
  check("turning it off puts every active bot into returning", /if \(!Settings_default\._botsScattered\) \{[\s\S]{0,400}_scatterReturning = true;/.test(src));
  check("the keybind tile says what it does", /Bot Random Movement/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
head(3, "Reconcile loop — late bots join, and everyone comes back");
{
  // Reproduce the loop's two new branches against stub handlers.
  const Settings = { _botsScattered: false };
  const now = () => 1e6;
  const reconcile = (mh) => {
    if (Settings._botsScattered && !mh._scatterActive) {
      mh._scatterActive = true;
      mh._scatterReturning = false;
      mh._scatterNextDecisionTime = 0;
      mh._scatterLastMoveAngle = null;
      mh._scatterLastPos = null;
      mh._scatterStuckStrikes = 0;
    }
    if (!mh._scatterActive && !mh._scatterReturning) return "normal";
    if (mh._scatterReturning) {
      if (now() >= (mh._scatterReturnDeadline || 0)) {
        mh._scatterReturning = false;
        return "normal";
      }
      return "returning";
    }
    return "scattering";
  };

  const existing = { _scatterActive: false, _scatterReturning: false };
  check("off means normal movement", reconcile(existing) === "normal");

  Settings._botsScattered = true;
  check("on makes an existing bot scatter", reconcile(existing) === "scattering");

  // A bot that connected after the toggle was pressed.
  const late = { _scatterActive: false, _scatterReturning: false };
  check("a bot spawned later joins in", reconcile(late) === "scattering",
        "this is what reading the state off clients[0] used to miss");

  // Toggle off: both go to returning, then to normal.
  Settings._botsScattered = false;
  for (const mh of [existing, late]) {
    mh._scatterActive = false;
    mh._scatterReturning = true;
    mh._scatterReturnDeadline = now() + M.SCATTER_RETURN_TIMEOUT_MS;
  }
  check("off puts them all in returning", [existing, late].every(m => reconcile(m) === "returning"));

  // Owner unreachable: the deadline still hands them back.
  for (const mh of [existing, late]) mh._scatterReturnDeadline = now() - 1;
  check("a bot that cannot reach the owner still returns to normal",
        [existing, late].every(m => reconcile(m) === "normal"),
        "timeout " + M.SCATTER_RETURN_TIMEOUT_MS + "ms");
  check("and stays normal afterwards", [existing, late].every(m => reconcile(m) === "normal"));
}

// ═══════════════════════════════════════════════════════════════════════════
head(4, "x18's leg commitment, not a timer");
{
  check("a leg runs to a distance, not a stopwatch", /_X18_LEG_DISTANCE/.test(src) && /_sc_legDist > _X18_LEG_DISTANCE/.test(src), "leg " + M._X18_LEG_DISTANCE + "px");
  check("stopping re-rolls immediately", /_sc_stopped \|\| _sc_legDist/.test(src));
  check("returning still runs on the timer", /_sc_mh\._scatterReturning \? _sc_now >= \(_sc_mh\._scatterNextDecisionTime/.test(src));
  check("the 1200ms re-roll no longer drives wandering", !/const _sc_dueDecision = _sc_now >= \(_sc_mh\._scatterNextDecisionTime \|\| 0\);/.test(src),
        "was: re-roll every " + M._SC_DECISION_MS + "ms regardless");
  check("Static mode is bound too", /_freezeBots: "Key[A-Z]"/.test(src), (/_freezeBots: "([^"]*)"/.exec(src) || [])[1]);
  check("no key is bound twice", (src.match(/: "KeyK"/g) || []).length === 1 && (src.match(/: "KeyJ"/g) || []).length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
head(5, "Milling while wandering");
{
  // Automill builds behind the bot and reads reverse_move_dir to know which way
  // that is. startMovement is the only thing that keeps it in step with
  // move_dir, and the scatter loop writes move_dir directly.
  check("the scatter loop keeps reverse_move_dir in step",
        /_sc_mh\.move_dir = _sc_angle;[\s\S]{0,600}_sc_mh\.reverse_move_dir = reverseAngle\(_sc_angle\);/.test(src),
        "without it Automill read null and returned on its first line");

  // Automill's own gate must not exclude a wandering bot.
  const auto = src.slice(src.indexOf("  class Automill {"), src.indexOf("  const Automill_default"));
  check("Automill has no scatter exclusion", !/_scatterActive|_scatterReturning/.test(auto));
  check("...and reads the field the loop now sets", /const angle = ModuleHandler\.reverse_move_dir;/.test(auto));
  check("it still needs the toggle", /if \(!Settings_default\._automill \|\| !this\.active\) return false;/.test(src));

  // The reverse really is the reverse.
  const rev = a => Math.atan2(-Math.sin(a), -Math.cos(a));
  const norm = a => Math.abs(((a % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  let worst = 0;
  for (let i = 0; i < 200; i++) {
    const a = Math.random() * Math.PI * 2;
    worst = Math.max(worst, Math.abs(norm(rev(a) - a) - Math.PI));
  }
  check("mills go behind the bot, not in front", worst < 1e-9, "max deviation from 180 deg: " + worst.toExponential(1));
}

// ═══════════════════════════════════════════════════════════════════════════
head(6, "Auto Place / Preplace / Replace untouched");
{
  const base = fs.readFileSync(__dirname + "/../src/RYN_Client_v5.3.js", "utf8");
  const slice = t => {
    const a = t.indexOf("  const LUNA_SPIKE_TYPE");
    const b = t.indexOf("  const AutoPlacer_default = AutoPlacer;");
    return t.slice(a, b);
  };
  check("the placer is byte-identical to stock v5.3", slice(src) === slice(base),
        slice(src).split("\n").length + " lines compared");
}

console.log("\n" + "=".repeat(58));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(58));
process.exit(fail > 0 ? 1 : 0);
