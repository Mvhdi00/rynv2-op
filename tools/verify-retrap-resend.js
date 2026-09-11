#!/usr/bin/env node
/*
 * verify-retrap-resend.js
 *
 * A retrap retransmission is the same claim put on the wire again, not a
 * second placement. The two things that have to hold are the gate - only for
 * our own trap, only with the enemy standing in it, only as the break closes -
 * and the fact that the repeat files nothing: no footprint, no ground claim,
 * or it would collide with the claim its own original already holds.
 *
 * The ramp and the scheduler are pulled out of the client verbatim and driven
 * against a stub world.
 *
 *   node tools/verify-retrap-resend.js [path/to/client.js]
 */

const fs = require("fs");
const nodePath = require("path");

const ROOT = nodePath.resolve(__dirname, "..");
const file = process.argv[2] ? nodePath.resolve(process.argv[2]) : nodePath.join(ROOT, "Ryn_Type_2.user.js");
const src = fs.readFileSync(file, "utf8");
const lines = src.split("\n");

const grab = name => {
  const i = lines.findIndex(l => l.trim().startsWith(name));
  if (i < 0) {
    console.log(`FAIL  ${name} is missing - this client predates the retrap resend.`);
    process.exit(1);
  }
  const indent = lines[i].match(/^\s*/)[0];
  for (let j = i + 1; j < lines.length; j++) if (lines[j] === indent + "}") return lines.slice(i, j + 1).join("\n");
  throw new Error("no end for " + name);
};
const num = name => {
  const m = src.match(new RegExp("const " + name + " = ([\\d.e/ ]+);"));
  if (!m) { console.log(`FAIL  ${name} is missing.`); process.exit(1); }
  return eval(m[1]);
};

const RPE_TICK_MS = num("RPE_TICK_MS");
const RPE_RETRAP_RESEND_MAX = num("RPE_RETRAP_RESEND_MAX");
const RPE_MODE = { AUTO: "auto", PREPLACE: "preplace", REPLACE: "replace" };
const Settings_default = { _spamPrePlace: true, _retrapResend: 2 };

const Engine = new Function("Settings_default", "RPE_MODE", "RPE_TICK_MS", "RPE_RETRAP_RESEND_MAX",
  "class Engine {\n  constructor(c){ this.client=c; this.stats={retrapped:0}; }\n" +
  "  _attritionSweep(){ return this.client._sweep; }\n" +
  "  get forecast(){ return this.client._forecast; }\n" +
  grab("_retrapResends(cand, frame)") + "\n" + grab("_scheduleRetrap(cand, frame)") +
  "\n}\nreturn Engine;")(Settings_default, RPE_MODE, RPE_TICK_MS, RPE_RETRAP_RESEND_MAX);

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `   got=${got} want=${want}`}`);
};

const trap = { id: 7, scale: 50 };
const mk = ({ ticks = 1, pong = 100, inTrap = true, dealt = true } = {}) => {
  const sends = [];
  const client = {
    myPlayer: { inGame: true, canPlace: () => true },
    SocketManager: { pong },
    _forecast: { assess: () => ({ ticks, confidence: 1 }) },
    _sweep: { damage: new Map(dealt ? [[trap, { potential: 200, ready: 200 }]] : []) },
    _ModuleHandler: {
      packetCount: 0, packetLimit: 119,
      resendPlace(type, angle) { sends.push({ type, angle }); return true; },
      place() { throw new Error("a retransmission must not go through place()"); },
    },
  };
  return { engine: new Engine(client), sends, client };
};
const cand = (over = {}) => ({
  profile: { type: 4 }, angle: 1.2, mode: RPE_MODE.PREPLACE, kind: "vacating",
  vacates: trap.id, vacated: false, ...over,
});
const frame = { tick: 10, targetTrapped: trap };

// ── the ramp ───────────────────────────────────────────────────────────────
Settings_default._retrapResend = 3;
t("three ticks out spends nothing", mk({ ticks: 3 }).engine._retrapResends(cand(), frame), 0);
t("two ticks out spends one", mk({ ticks: 2 }).engine._retrapResends(cand(), frame), 1);
t("one tick out spends the lot", mk({ ticks: 1 }).engine._retrapResends(cand(), frame), 3);
t("zero ticks out spends the lot", mk({ ticks: 0 }).engine._retrapResends(cand(), frame), 3);
t("an unforecastable trap spends nothing",
  mk({ ticks: Infinity }).engine._retrapResends(cand(), frame), 0);

Settings_default._retrapResend = 1;
t("the setting caps the ramp", mk({ ticks: 1 }).engine._retrapResends(cand(), frame), 1);
Settings_default._retrapResend = 99;
t("the hard ceiling caps the setting", mk({ ticks: 1 }).engine._retrapResends(cand(), frame), RPE_RETRAP_RESEND_MAX);
Settings_default._retrapResend = 0;
t("zero turns it off", mk({ ticks: 1 }).engine._retrapResends(cand(), frame), 0);
Settings_default._retrapResend = 2;

// ── the gate ───────────────────────────────────────────────────────────────
t("off with Spam Preplace off", (() => {
  Settings_default._spamPrePlace = false;
  const n = mk().engine._retrapResends(cand(), frame);
  Settings_default._spamPrePlace = true;
  return n;
})(), 0);
t("only the vacating kind", mk().engine._retrapResends(cand({ kind: "steal" }), frame), 0);
t("not for an already-open slot", mk().engine._retrapResends(cand({ vacated: true }), frame), 0);
t("not when no enemy is in the trap",
  mk().engine._retrapResends(cand(), { tick: 10, targetTrapped: null }), 0);
t("not for a different build than the one they are in",
  mk().engine._retrapResends(cand({ vacates: 999 }), frame), 0);
t("not when nothing is hitting it", mk({ dealt: false }).engine._retrapResends(cand(), frame), 0);

// ── the schedule ───────────────────────────────────────────────────────────
{
  const w = mk({ ticks: 1 });
  const armed = w.engine._scheduleRetrap(cand(), frame);
  t("a due trap arms the sends", armed, 2);
  t("...and counts them", w.engine.stats.retrapped, 2);
  t("...but nothing is on the wire yet", w.sends.length, 0);
}
{
  // Offsets must land inside the rest of this tick, never past it.
  const w = mk({ ticks: 1, pong: 400 });
  const delays = [];
  const real = global.setTimeout;
  global.setTimeout = (fn, ms) => { delays.push(ms); return real(() => {}, 0); };
  w.engine._scheduleRetrap(cand(), frame);
  global.setTimeout = real;
  t("a huge ping still schedules inside the tick",
    delays.every(d => d >= 8 && d <= RPE_TICK_MS - 6), true);
  t("...and still arms them all", delays.length, 2);
}
{
  // What actually reaches the wire, and by which door.
  const w = mk({ ticks: 1 });
  const real = global.setTimeout;
  const queued = [];
  global.setTimeout = fn => { queued.push(fn); return 0; };
  w.engine._scheduleRetrap(cand(), frame);
  global.setTimeout = real;
  queued.forEach(fn => fn());
  t("the repeats reach resendPlace", w.sends.length, 2);
  t("...carrying the original angle", w.sends[0].angle, 1.2);
  t("...and the original item", w.sends[0].type, 4);
  // Leaving the game between the schedule and the fire cancels the rest.
  const w2 = mk({ ticks: 1 });
  const q2 = [];
  global.setTimeout = fn => { q2.push(fn); return 0; };
  w2.engine._scheduleRetrap(cand(), frame);
  global.setTimeout = real;
  w2.client.myPlayer.inGame = false;
  q2.forEach(fn => fn());
  t("a dead player sends nothing", w2.sends.length, 0);
}

// ── the repeat must claim nothing ──────────────────────────────────────────
{
  const body = grab("resendPlace(type, angle)");
  t("resendPlace files no footprint", /_notePlacement/.test(body), false);
  t("...counts no placement", /totalPlaces/.test(body), false);
  t("...but re-tests the budget", /packetCount \+ RPE_PLACE_PACKETS > this\.packetLimit/.test(body), true);
  t("...and restores the weapon", /whichWeapon/.test(body), true);
}
t("_retrapResend has a default", /_retrapResend:\s*\d+,/.test(src), true);
t("_retrapResend has a menu slider", src.includes('id=\\"_retrapResend\\" type=\\"range\\"'), true);

console.log("");
if (fail) {
  console.log(`${fail} check(s) failed - the retrap resend is not wired as intended.`);
  process.exit(1);
}
console.log(`OK - ${pass} checks passed.`);
