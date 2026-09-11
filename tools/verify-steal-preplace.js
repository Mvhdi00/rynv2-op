#!/usr/bin/env node
/*
 * verify-steal-preplace.js
 *
 * Checks the one thing that decides whether an enemy build's ground is taken
 * on the tick it falls or a round trip later: PlacementScheduler.due, and the
 * speculative-claim handback (_noteSpeculative / _canRetry / _attachRetry)
 * that keeps an early send from locking the engine out of the slot it
 * prepared.
 *
 * The classes are pulled out of the client verbatim and driven through the
 * tick sequence a steal actually goes through, so this tests the shipped code
 * rather than a paraphrase of it.
 *
 *   node tools/verify-steal-preplace.js [path/to/client.js]
 */

const fs = require("fs");
const nodePath = require("path");

const ROOT = nodePath.resolve(__dirname, "..");
const path = process.argv[2]
  ? nodePath.resolve(process.argv[2])
  : nodePath.join(ROOT, "Ryn_Type_2.user.js");
const lines = fs.readFileSync(path, "utf8").split("\n");
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

const find = re => {
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  throw new Error("not found: " + re);
};
const ledgerAt = find(/^  class PlacementLedger \{/);
const conflictAt = find(/^  class ConflictResolver \{/);
const schedAt = find(/^  class PlacementScheduler \{/);
const engineAt = find(/^  class RynPlacementEngine \{/);

// Class bodies end at the first line that is exactly two-space "}".
const endOf = start => {
  for (let i = start; i < lines.length; i++) if (lines[i] === "  }") return i + 1;
  throw new Error("no end for " + start);
};

const src = [
  slice(ledgerAt, endOf(ledgerAt)),
  slice(conflictAt, endOf(conflictAt)),
  slice(schedAt, endOf(schedAt)),
].join("\n\n");

// The three retry methods are pulled out of the engine class and re-wrapped as
// a standalone class, so they are the shipped bodies verbatim.
const engineEnd = endOf(engineAt);
const engineBody = lines.slice(engineAt - 1, engineEnd);
const grab = name => {
  const i = engineBody.findIndex(l => l.trim().startsWith(name));
  if (i < 0) throw new Error("no method " + name);
  const indent = engineBody[i].match(/^\s*/)[0];
  for (let j = i + 1; j < engineBody.length; j++) {
    if (engineBody[j] === indent + "}") return engineBody.slice(i, j + 1).join("\n");
  }
  throw new Error("no end for " + name);
};
const retryClass = "class Retries {\n  _retries = [];\n" +
  [grab("_noteSpeculative("), grab("_canRetry("), grab("_attachRetry(")].join("\n") + "\n}";

const hyp = (a, b) => Math.sqrt(a * a + b * b);
const RPE_PRIORITY = { ANTICIPATION: 2, ENGAGEMENT: 3, RECOVERY: 4 };
const RPE_MODE = { AUTO: "auto", PREPLACE: "preplace", REPLACE: "replace" };
const RPE_SOFT_DOMINANCE = 1.5;
const RPE_PREPLACE_MIN_CONFIDENCE = 0.3;
const RPE_PREPLACE_FIRE_LEAD = 2;
const RPE_MAX_RETRIES = 4;
const RPE_PLACE_PACKETS = 5;
const RPE_BATCH_PACKETS = 2;
const Settings_default = { _spamPrePlace: true };

const scope = { hyp, RPE_PRIORITY, RPE_MODE, RPE_SOFT_DOMINANCE, RPE_PREPLACE_MIN_CONFIDENCE,
  RPE_PREPLACE_FIRE_LEAD, RPE_MAX_RETRIES, RPE_PLACE_PACKETS, RPE_BATCH_PACKETS, Settings_default };
const names = Object.keys(scope);
const [PlacementLedger, ConflictResolver, PlacementScheduler, Retries] =
  new Function(...names, src + "\n" + retryClass +
    "\nreturn [PlacementLedger, ConflictResolver, PlacementScheduler, Retries];")(...names.map(n => scope[n]));

// ── harness ────────────────────────────────────────────────────────────────
const profile = { type: 2, footR: 35, ringR: 70 };
const mkCand = (over = {}) => ({
  profile, x: 100, y: 100, angle: 0, priority: RPE_PRIORITY.ANTICIPATION,
  mode: RPE_MODE.PREPLACE, kind: "steal", confidence: 0.8, value: 10,
  dueTick: 5, interceptTick: 1, vacated: false, ...over,
});

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `   got=${got} want=${want}`}`);
};

const sched = new PlacementScheduler({ _ModuleHandler: { packetLimit: 119, packetCount: 0 } });

// 1. The gate itself.
Settings_default._spamPrePlace = false;
t("spam OFF: steal not due before the deletion", sched.due(mkCand(), 6), false);
t("spam OFF: steal due once vacated", sched.due(mkCand({ vacated: true }), 6), true);

Settings_default._spamPrePlace = true;
t("spam ON: steal fires on its forecast at dueTick", sched.due(mkCand(), 5), true);
t("spam ON: steal still waits before dueTick", sched.due(mkCand(), 4), false);
t("spam ON: steal still due once vacated", sched.due(mkCand({ vacated: true }), 6), true);
t("spam ON: low confidence still refused", sched.due(mkCand({ confidence: 0.2 }), 9), false);
t("vacating kind unchanged", sched.due(mkCand({ kind: "vacating" }), 5), true);
t("intercept kind unchanged", sched.due(mkCand({ kind: "intercept", interceptTick: 1 }), 9), true);
t("non-preplace mode unchanged", sched.due(mkCand({ mode: RPE_MODE.REPLACE }), 0), true);

// 2. The full two-tick sequence: speculative send on tick 5 files a hard claim;
//    the wall falls on tick 6 and REPLACE must still reach the same ground.
const run = spamOn => {
  Settings_default._spamPrePlace = spamOn;
  const ledger = new PlacementLedger();
  const book = { records: [], has: () => false };
  const conflicts = new ConflictResolver(ledger, { sentThisTick: () => false }, book);
  const retries = new Retries();

  const steal = mkCand();
  if (!sched.due(steal, 5)) return { sent: false, replaceReached: false };
  // Executor._record: the send files a hard claim, ttl 2, then offers it back.
  const token = conflicts.take(steal, "preplace", 5, 2, false);
  retries._noteSpeculative(steal, token, 5);

  // Tick 6: the deletion packet arrives, _generateReplace offers the freed ground.
  ledger.expire(6);
  const replace = mkCand({ mode: RPE_MODE.REPLACE, kind: "replace", priority: RPE_PRIORITY.RECOVERY });
  retries._attachRetry(replace, 6);
  return { sent: !!token, replaceReached: conflicts.availableGround(replace) };
};

const on = run(true);
t("spam ON: speculative steal reaches the wire on tick 5", on.sent, true);
t("spam ON: REPLACE is not locked out by that send on tick 6", on.replaceReached, true);

// Same sequence with _noteSpeculative's steal admission removed, to show the
// change is load-bearing rather than decorative.
const noteOnly = new Retries();
const strictSteal = mkCand();
Settings_default._spamPrePlace = true;
const l2 = new PlacementLedger();
const c2 = new ConflictResolver(l2, { sentThisTick: () => false }, { records: [], has: () => false });
const tok2 = c2.take(strictSteal, "preplace", 5, 2, false);
// emulate the pre-change guard: vacating/intercept only
if (strictSteal.kind === "vacating" || strictSteal.kind === "intercept") noteOnly._noteSpeculative(strictSteal, tok2, 5);
l2.expire(6);
const r2 = mkCand({ mode: RPE_MODE.REPLACE, kind: "replace", priority: RPE_PRIORITY.RECOVERY });
noteOnly._attachRetry(r2, 6);
t("without the _noteSpeculative change, REPLACE is blocked", c2.availableGround(r2), false);

// 3. The claim must not outlive its usefulness: ttl 2 means tick 7 is clear
//    even if nothing spends the retry.
const l3 = new PlacementLedger();
const c3 = new ConflictResolver(l3, { sentThisTick: () => false }, { records: [], has: () => false });
c3.take(mkCand(), "preplace", 5, 2, false);
l3.expire(7);
t("hard claim expires by tick 7, no permanent lockout",
  c3.availableGround(mkCand({ mode: RPE_MODE.REPLACE, priority: RPE_PRIORITY.RECOVERY })), true);

console.log("");
if (fail) {
  console.log(`${fail} check(s) failed - speculative steal is not wired as intended.`);
  process.exit(1);
}
console.log(`OK - ${pass} checks passed.`);
