/* Verify every change made to RYN, without being able to run the client.
 *
 * RYN does not boot in this harness — it builds DOM the mock page does not
 * provide, and that was true before any of these edits (boot-check reports the
 * identical appendChild fault on the pristine upload). So `node --check` is the
 * only whole-file check available, and it validates SYNTAX ONLY: it will not
 * notice a call to a helper that was deleted, an identifier that resolves
 * nowhere, or a UI id that no element carries. Those are exactly the mistakes
 * this kind of edit makes.
 *
 * So this closes the gap four ways:
 *
 *   1. EXECUTE   every changed block is lifted with `vm` and actually run
 *                against stubs. A ReferenceError inside the block surfaces here.
 *   2. RESOLVE   every free identifier the new code reads from an outer scope
 *                is confirmed declared somewhere in the file.
 *   3. WIRE      every setting, module registration, run-order slot and UI id
 *                is confirmed present and consistent.
 *   4. NO GHOSTS every helper the edits deleted is confirmed to have no
 *                surviving caller.
 *
 *   node ryn-changes-check.js [ryn.js]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/RYN_Client_v5.4.user.js");
const src = fs.readFileSync(RYN, "utf8");

let failures = 0;
const results = [];
/* A check returns [pass, note] — never a bare string.
 *
 * The first version of this file treated ANY returned string as a pass with a
 * note, so a check whose failure path returned "still read somewhere" printed
 * that message next to an "ok". A test that cannot fail is worse than no test,
 * so the contract is explicit: `true`, or a two-element [boolean, string]. */
function check(group, name, fn) {
  let ok = false, note = "";
  try {
    const r = fn();
    if (r === true) ok = true;
    else if (Array.isArray(r) && r.length === 2 && typeof r[0] === "boolean") {
      ok = r[0]; note = r[1];
    } else {
      ok = false;
      note = "check returned " + JSON.stringify(r) + " — it must return true or [pass, note]";
    }
  } catch (e) {
    ok = false;
    note = String(e.message).slice(0, 110);
  }
  if (!ok) failures++;
  results.push({ group, name, ok, note });
}

function lift(header, label) {
  const m = new RegExp(header).exec(src);
  if (!m) throw new Error("could not find " + label);
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index, i + 1); }
  }
  throw new Error("unbalanced " + label);
}

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}

// ── 1. EXECUTE ────────────────────────────────────────────────────────────
// Autoheal. No duel covers this block running — heal-duel.js compares a
// transcription of the rule, not the shipped method — so run the real one.
check("execute", "AntiInsta.postTick runs and heals the right number of times", () => {
  const cls = lift("class AntiInsta\\s*\\{", "AntiInsta");
  const sandbox = {
    Math, Object,
    Settings_default: { _autoheal: true, _antiSmartTick: false },
    Items: { 0: { restore: 20 } },
    Hats: { 6: { dmgMult: .75 } },
    ANTI_INSTA_DMG_CAP: 140,
    ANTI_INSTA_SCUBA_BIAS: 5,
  };
  vm.createContext(sandbox);
  vm.runInContext(cls + "\nthis.make = (c) => new AntiInsta(c);", sandbox);

  let heals = 0;
  const client = {
    myPlayer: {
      tempHealth: 55, maxHealth: 100, shameCount: 0, hatID: 0,
      tickCount: 10, damageTick: 2, isTrapped: false,
      getItemByType: () => 0,
    },
    _ModuleHandler: { heal: () => heals++, tickCount: 10, healedOnce: false, didAntiInsta: false },
    EnemyManager: { potentialDamage: 0, potentialSpikeDamage: 0, nearestEnemy: null },
  };
  const mod = sandbox.make(client);
  mod.postTick();
  // novastorm: for (i = 0; i < 100 - 55; i += 20) -> 3 presses
  if (heals !== 3) return [false, "expected 3 presses for 45 missing health, got " + heals];
  if (!client._ModuleHandler.healedOnce) return [false, "healedOnce not set — auto grind reads it"];
  if (mod.blockBreak !== false) return [false, "blockBreak not reset — autoBreak latches on it"];
  return [true, "3 presses, healedOnce set, blockBreak reset"];
});

check("execute", "AntiInsta.postTick declines at full health", () => {
  const cls = lift("class AntiInsta\\s*\\{", "AntiInsta");
  const sandbox = {
    Math, Object,
    Settings_default: { _autoheal: true, _antiSmartTick: false },
    Items: { 0: { restore: 20 } }, Hats: { 6: { dmgMult: .75 } },
    ANTI_INSTA_DMG_CAP: 140, ANTI_INSTA_SCUBA_BIAS: 5,
  };
  vm.createContext(sandbox);
  vm.runInContext(cls + "\nthis.make = (c) => new AntiInsta(c);", sandbox);
  let heals = 0;
  sandbox.make({
    myPlayer: { tempHealth: 100, maxHealth: 100, shameCount: 0, hatID: 0,
                tickCount: 10, damageTick: 2, isTrapped: false, getItemByType: () => 0 },
    _ModuleHandler: { heal: () => heals++, tickCount: 10 },
    EnemyManager: { potentialDamage: 0, potentialSpikeDamage: 0, nearestEnemy: null },
  }).postTick();
  return heals === 0 ? [true, "no presses at full health"]
                     : [false, "healed " + heals + " times at full health"];
});

/* Automill. The reported symptom was a ragged wall — one mill in one place,
 * three in another — and the cause was placing whichever of the trio fit. This
 * runs the real module and requires all-or-nothing: with one spot blocked it
 * must place ZERO, not two. */
check("execute", "Automill places the whole trio or nothing", () => {
  const cls = lift("class Automill\\s*\\{", "Automill");
  const sandbox = {
    Math, Object,
    Settings_default: { _automill: true },
    Items: { 10: { id: 10, scale: 45, placeOffset: 5 } },
    AUTOMILL_PLACE_COST: 5,
    GameUI_default: { updateAutomill: () => {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(cls + "\nthis.make = (c) => new Automill(c);", sandbox);

  const run = (blockedIndex) => {
    const placed = [];
    let seen = 0;
    const client = {
      isOwner: true,
      _ModuleHandler: {
        attacking: false, placedOnce: false, reverse_move_dir: 0.7,
        packetLimit: 119, packetCount: 0,
        placeAngles: [ null, [] ],
        requestPlace: (t, a) => placed.push(a),
      },
      myPlayer: {
        isTrapped: false,
        canPlace: () => true,
        getItemByType: () => 10,
        getItemPlaceScale: () => 85,
        // canPlaceObject is asked about each of the three in order; refuse the
        // nominated one.
        canPlaceObject: () => (seen++ !== blockedIndex),
      },
      EnemyManager: { nearestTrap: null },
    };
    sandbox.make(client).postTick();
    return placed.length;
  };

  if (run(-1) !== 3) return [false, "clean ground placed " + run(-1) + ", expected 3"];
  for (const i of [0, 1, 2]) {
    const n = run(i);
    if (n !== 0) return [false, "with spot " + i + " blocked it placed " + n + ", expected 0"];
  }
  return [true, "3 on clean ground, 0 when any one spot is blocked"];
});

// The spike tick reporter — new code, no duel.
check("execute", "SpikeTickController._report formats and reaches the UI", () => {
  const cls = lift("class SpikeTickController\\s*\\{", "SpikeTickController");
  let painted = null;
  const sandbox = {
    Math, Object,
    GameUI_default: { updateSpikeTick: (s) => { painted = s; } },
    SPIKE_TICK_PHASE: { IDLE: 0, PREPARE: 1, VALIDATE: 2, REPLAN: 3, EXECUTE: 4, COMPLETE: 5, CANCEL: 6 },
    RPE_INTENT_LIFETIME: 6, RPE_PRIORITY: {}, RPE_INTENT: {}, PlacementIntent: {},
    SPIKE_TICK_REPLANS: 2, SPIKE_TICK_SELF_DRIFT: 45, SPIKE_TICK_TARGET_DRIFT: 70,
    RPE_PLACE_PACKETS: 5,
  };
  vm.createContext(sandbox);
  vm.runInContext(cls + "\nthis.make = (c) => new SpikeTickController(c);", sandbox);
  const mod = sandbox.make({ isOwner: true, _ModuleHandler: { tickCount: 1 } });
  mod.stats.armed = 47;
  mod.stats.executed = 3;
  mod._report("outOfReach");
  mod._report("outOfReach");
  mod._report("noGround");
  if (painted === null) return [false, "nothing reached the UI"];
  if (!/^3\/47/.test(painted)) return [false, "expected to open with 3/47, got: " + painted];
  if (!/outOfReach 2/.test(painted)) return [false, "outcome tally missing: " + painted];
  return [true, painted];
});

check("execute", "_report stays silent for a non-owner client", () => {
  const cls = lift("class SpikeTickController\\s*\\{", "SpikeTickController");
  let painted = null;
  const sandbox = {
    Math, Object,
    GameUI_default: { updateSpikeTick: (s) => { painted = s; } },
    SPIKE_TICK_PHASE: { IDLE: 0, CANCEL: 6 },
  };
  vm.createContext(sandbox);
  vm.runInContext(cls + "\nthis.make = (c) => new SpikeTickController(c);", sandbox);
  sandbox.make({ isOwner: false, _ModuleHandler: { tickCount: 1 } })._report("x");
  return painted === null ? [true, "silent, as bots must be"]
                          : [false, "a bot painted the owner's UI"];
});

check("execute", "StatsManager.velocityTickTimes accumulates and paints", () => {
  const cls = lift("class StatsManager\\s*\\{", "StatsManager");
  let painted = null;
  const sandbox = {
    Math, Object,
    UI_default: { updateStats: (id, v) => { painted = [id, v]; } },
    Settings_default: { _totalKills: 0, _globalKills: 0, _deaths: 0, _autoSyncTimes: 0,
                        _velocityTickTimes: 0, _spikeSyncHammerTimes: 0, _spikeSyncTimes: 0 },
  };
  vm.createContext(sandbox);
  vm.runInContext(cls + "\nthis.make = (c) => new StatsManager(c);", sandbox);
  const m = sandbox.make({ isOwner: true });
  m.init();
  m.velocityTickTimes = 1;
  m.velocityTickTimes = 1;
  if (m.velocityTickTimes !== 2) return [false, "counter reads " + m.velocityTickTimes + ", expected 2"];
  if (!painted || painted[0] !== "_velocityTickTimes") return [false, "painted " + JSON.stringify(painted)];
  return [true, "counts to 2 and paints #_velocityTickTimes"];
});

// ── 2. RESOLVE ────────────────────────────────────────────────────────────
// Every identifier the new code takes from an outer scope. A typo here is a
// ReferenceError the moment the branch runs, which node --check cannot see.
const OUTER = [
  ["Settings_default", "const Settings_default"],
  ["DataHandler_default", "const DataHandler_default"],
  ["GameUI_default", "const GameUI_default"],
  ["UI_default", "const UI_default"],
  ["PlayerObject", "class PlayerObject"],
  ["Items", "const Items"],
  ["Hats", "const Hats"],
  ["inRange", "const inRange"],
  ["ANTI_INSTA_DMG_CAP", "const ANTI_INSTA_DMG_CAP"],
  ["ANTI_INSTA_SCUBA_BIAS", "const ANTI_INSTA_SCUBA_BIAS"],
  ["SPIKE_TICK_PHASE", "const SPIKE_TICK_PHASE"],
];
for (const [name, decl] of OUTER) {
  check("resolve", name + " is declared", () =>
    src.includes(decl) ? true : [false, "no `" + decl + "` in the file"]);
}

// ── 3. WIRE ───────────────────────────────────────────────────────────────
/* Anchored on a word boundary, because the first version used indexOf("class
 * VelocityTick") and a mutation renaming the class to VelocityTickX still
 * matched it as a prefix — the check stayed green while the class it was
 * looking for no longer existed. */
check("wire", "VelocityTick class is defined before it is instantiated", () => {
  const m = /class VelocityTick\s*\{/.exec(src);
  const use = src.indexOf("velocityTick: new VelocityTick(client2)");
  if (!m) return [false, "no `class VelocityTick {` in the file"];
  if (use < 0) return [false, "never registered in staticModules"];
  return m.index < use ? [true, "defined before use"] : [false, "used before defined"];
});

/* Every constructor named in staticModules must actually name something. This
 * catches a registration pointing at a class that was renamed or removed —
 * for every module, not only the ones these edits touched. */
check("wire", "every staticModules registration names a real constructor", () => {
  const block = /staticModules\s*=\s*\{[\s\S]*?\n      \};/.exec(src) ||
                /this\.staticModules = \{([\s\S]*?)\n      \};/.exec(src);
  const region = block ? block[0] : src;
  const missing = [];
  const seen = new Set();
  for (const m of region.matchAll(/(\w+):\s*new\s+(\w+)\(/g)) {
    const ctor = m[2];
    if (seen.has(ctor)) continue;
    seen.add(ctor);
    const declared = new RegExp("class " + ctor + "\\s*\\{").test(src) ||
                     new RegExp("const " + ctor + "\\s*=").test(src);
    if (!declared) missing.push(m[1] + " -> " + ctor);
  }
  return missing.length === 0
    ? [true, seen.size + " constructors, all declared"]
    : [false, "undeclared: " + missing.join(", ")];
});

check("wire", "velocityTick runs in the module loop, after autoPush", () => {
  const m = /this\.modules = \[([^\]]+)\]/.exec(src);
  if (!m) return [false, "module list not found"];
  const order = m[1].split(",").map(s => s.trim().replace("this.staticModules.", ""));
  const i = order.indexOf("velocityTick");
  if (i < 0) return [false, "velocityTick not in the run order"];
  if (order[i - 1] !== "autoPush") return [false, "sits after " + order[i - 1] + ", Glotus puts it after autoPush"];
  return [true, "slot " + i + " of " + order.length + ", right after autoPush"];
});

check("wire", "spikeTickController still runs after the three spike tick modules", () => {
  const m = /this\.modules = \[([^\]]+)\]/.exec(src);
  const order = m[1].split(",").map(s => s.trim().replace("this.staticModules.", ""));
  const ctrl = order.indexOf("spikeTickController");
  for (const n of ["spikeTickBreak", "spikeTickNear", "spikeTickTrap"]) {
    if (order.indexOf(n) > ctrl) return [false, n + " runs after the controller — its arm would be a tick late"];
  }
  return [true, "controller at " + ctrl + ", after all three"];
});

for (const [key, want] of [["_velocityTick", "false"], ["_velocityTickTrap", "false"],
                           ["_knockbackTick", "false"],
                           ["_velocityTickTimes", "0"], ["_knockbackTickTimes", "0"]]) {
  check("wire", key + " has a default", () => {
    const re = new RegExp("\\b" + key + ":\\s*" + want + "\\s*,");
    return re.test(src) ? [true, key + ": " + want] : [false, "missing or not " + want];
  });
}

for (const id of ["_velocityTick", "_velocityTickTrap", "_knockbackTick",
                  "_velocityTickTimes", "_knockbackTickTimes", "_spikeTickOutcome"]) {
  check("wire", id + " has a UI element", () => {
    const asInput = src.includes('id=\\"' + id + '\\" type=\\"checkbox\\"');
    const asSpan = src.includes('id=\\"' + id + '\\" class=\\"text-value\\"');
    if (!asInput && !asSpan) return [false, "no element carries this id"];
    return [true, asInput ? "checkbox" : "stat span"];
  });
}

check("wire", "the checkbox binder picks settings up by id", () =>
  src.includes("querySelectorAll(\"input[type='checkbox'][id]\")")
    ? [true, "generic id binder present, so _velocityTick binds itself"]
    : [false, "no generic binder — the new checkbox would be inert"]);

check("wire", "updateSpikeTick targets the id the Devtool row uses", () => {
  const m = /updateSpikeTick\(state\) \{[\s\S]{0,160}?querySelector\("#([A-Za-z_]+)"\)/.exec(src);
  if (!m) return [false, "updateSpikeTick not found or does not query"];
  return m[1] === "_spikeTickOutcome" ? [true, "queries #" + m[1]]
                                     : [false, "queries #" + m[1] + ", row is #_spikeTickOutcome"];
});

/* Blood Wings on a stationary player was an explicit branch; the check is that
 * it is gone from THAT branch without disturbing the two legitimate ones (bull
 * helmet active, and the _cowboyWhenSafe toggle). */
check("wire", "standing still no longer forces Blood Wings", () => {
  const cls = lift("class DefaultAcc\\s*\\{", "DefaultAcc");
  const m = /if \(!ModuleHandler\.isMoving[\s\S]{0,240}?\n      \}/.exec(cls);
  if (m && /useBloodWings/.test(m[0]))
    return [false, "the stationary branch still returns 18"];
  const remaining = (cls.match(/if \(useBloodWings\) return 18;/g) || []).length;
  if (remaining !== 2)
    return [false, remaining + " useBloodWings returns left, expected 2 (bullActive, cowboyWhenSafe)"];
  return [true, "idle branch gone, bullActive and cowboyWhenSafe kept"];
});

check("wire", "the spike tick takes yes for an answer", () => {
  const cls = lift("class SpikeTickController\\s*\\{", "SpikeTickController");
  if (!/_alreadyCovered\(\)/.test(cls)) return [false, "no _alreadyCovered"];
  if (!/if \(this\._alreadyCovered\(\)\)/.test(cls))
    return [false, "noGround does not consult it"];
  if (!/lastReason = "covered"/.test(cls)) return [false, "the covered outcome is not named"];
  if (!/SPIKE_TICK_PHASE\.COMPLETE;\n              return this\.postTick\(\);/.test(cls))
    return [false, "covered does not complete — it would still read as a failure"];
  return [true, "an existing spike completes the tick instead of cancelling it"];
});

/* The acquire walk takes ground from nobody. If it ever starts preempting,
 * that is the three placers being damaged, which is the thing not to do. */
check("wire", "the spike tick never preempts the other placers", () => {
  const cls = lift("class SpikeTickController\\s*\\{", "SpikeTickController");
  if (/\.preempt\(/.test(cls)) return [false, "it calls preempt — that takes ground from a placer"];
  if (!/availableGround\(c\)/.test(cls)) return [false, "acquire does not check availability"];
  return [true, "checks availability, never preempts"];
});

check("wire", "automill reports what it sent", () => {
  const cls = lift("class Automill\\s*\\{", "Automill");
  if (!/this\._report\(3\);/.test(cls)) return [false, "the trio does not report"];
  if (!/updateAutomill/.test(cls)) return [false, "_report does not reach the UI"];
  if (!src.includes('id=\\"_automillSent\\"')) return [false, "no Devtool row carries #_automillSent"];
  return [true, "rows and mills sent, painted to #_automillSent"];
});

check("wire", "KnockbackTick is defined, registered and in the run order", () => {
  if (!/class KnockbackTick\s*\{/.test(src)) return [false, "no `class KnockbackTick {`"];
  if (!src.includes("knockbackTick: new KnockbackTick(client2)")) return [false, "not registered"];
  const m = /this\.modules = \[([^\]]+)\]/.exec(src);
  const order = m[1].split(",").map(x => x.trim().replace("this.staticModules.", ""));
  const i = order.indexOf("knockbackTick");
  if (i < 0) return [false, "not in the run order"];
  // Glotus runs it just before antiRetrap.
  if (order[i + 1] !== "antiRetrap")
    return [false, "sits before " + order[i + 1] + ", Glotus puts it before antiRetrap"];
  return [true, "slot " + i + ", right before antiRetrap"];
});

/* The turret follow-up is the half a port loses quietly: the swing still lands,
 * and a missing latch only shows as the enemy stopping short of the spike. */
check("wire", "the knockback turret follow-up is still wired", () => {
  const cls = lift("class KnockbackTick\\s*\\{", "KnockbackTick");
  if (!/isPrimaryEnough/.test(cls)) return [false, "no isPrimaryEnough — the two-tier budget is gone"];
  if (!/if \(!isPrimaryEnough\) \{\s*this\.useTurret = true;/.test(cls))
    return [false, "useTurret is not latched when the primary alone cannot cover the gap"];
  if (!/if \(this\.useTurret\) \{/.test(cls)) return [false, "nothing consumes useTurret"];
  if (!/forceHat = 53/.test(cls)) return [false, "the follow-up does not equip turret gear"];
  return [true, "latched when needed, consumed next tick, hat 53"];
});

check("wire", "the trap branch widens the window rather than replacing it", () => {
  const cls = lift("class VelocityTick\\s*\\{", "VelocityTick");
  const m = /const inAttackRange = ([\s\S]*?);/.exec(cls);
  if (!m) return [false, "inAttackRange not found"];
  const expr = m[1];
  if (!/inRange\(dist1, this\.minKB, this\.maxKB\)/.test(expr))
    return [false, "the knockback window is no longer part of the condition"];
  if (!/pinned/.test(expr)) return [false, "the trap branch is not in the condition"];
  if (!/\|\|/.test(expr)) return [false, "not an OR — replacing the window loses the 220-245 band"];
  return [true, "window OR pinned-and-close"];
});

check("wire", "the trap branch only counts traps that are mine", () => {
  const cls = lift("class VelocityTick\\s*\\{", "VelocityTick");
  if (!/_pinnedInMyTrap/.test(cls)) return [false, "no _pinnedInMyTrap"];
  if (!/isEnemyByID\(trappedIn\.ownerID, myPlayer\)/.test(cls))
    return [false, "does not check who owns the trap"];
  if (!/Settings_default\._velocityTickTrap/.test(cls))
    return [false, "not behind its own toggle"];
  return [true, "own toggle, and ownership checked"];
});

check("wire", "_report is called on both outcomes, placed and cancelled", () => {
  const placed = src.includes('this._report("placed")');
  const cancelled = src.includes('this._report(this.lastReason || "cancelled")');
  if (!placed) return [false, "never reports a success — the ratio would only ever fall"];
  if (!cancelled) return [false, "never reports a stand-down"];
  return [true, "both arms report"];
});

// ── 4. NO GHOSTS ──────────────────────────────────────────────────────────
const DELETED = [
  "_healsInFlight", "isSaveHealTime", "isSaveHealTick", "isSaveHeal", "_healSent",
  "_rawHeal", "_healBudgetLeft", "_flushShameHealQueue", "_shameHealQueue",
  "_shameHealDeadline", "_SHAME_GUARD_MARGIN", "pushingOnSpike",
];
/* A line mentioning the name is a WRITE if it is a field declaration or an
 * assignment to it, and a READ otherwise. Comments do not count either way.
 * The point of separating them: pushingOnSpike is still written by
 * EnemyManager and that is fine — what must be zero is readers. */
function mentions(name) {
  const write = new RegExp("(^\\s*|\\.)" + name + "\\s*=[^=]");
  let reads = 0, writes = 0;
  for (const line of src.split("\n")) {
    if (!line.includes(name)) continue;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;      // comment
    if (write.test(line)) writes++; else reads++;
  }
  return { reads, writes };
}
for (const name of DELETED) {
  check("no ghosts", name + " has no surviving reader", () => {
    const { reads, writes } = mentions(name);
    if (name === "pushingOnSpike") {
      return reads === 0
        ? [true, writes + " write(s), 0 readers — dead but harmless, as documented"]
        : [false, reads + " reader(s) remain"];
    }
    if (reads === 0 && writes === 0) return [true, "gone entirely"];
    return [false, reads + " read(s) and " + writes + " write(s) remain"];
  });
}

check("no ghosts", "AntiSpikePush no longer reads EnemyManager.pushingOnSpike", () => {
  const cls = lift("class AntiSpikePush\\s*\\{", "AntiSpikePush");
  const code = cls.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  return code.includes("pushingOnSpike") ? [false, "still reads it"] : [true, "clean"];
});

check("no ghosts", "heal() is a plain press with no queue or budget", () => {
  const m = /\n    heal\(\) \{([\s\S]*?)\n    \}/.exec(src);
  if (!m) return [false, "heal() not found"];
  const body = m[1];
  for (const bad of ["_healBudgetLeft", "_shameHealQueue", "receivedDamage"]) {
    if (body.includes(bad)) return [false, "still references " + bad];
  }
  return [true, "selectItem / attack / whichWeapon, unconditional"];
});

// ── report ────────────────────────────────────────────────────────────────
const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — verifying every change\n");
let last = null;
for (const r of results) {
  if (r.group !== last) {
    const titles = {
      execute: "EXECUTE — changed blocks lifted and actually run",
      resolve: "RESOLVE — outer identifiers the new code reads",
      wire: "WIRE — settings, registration, run order, UI ids",
      "no ghosts": "NO GHOSTS — deleted helpers have no callers left",
    };
    console.log("  " + titles[r.group]);
    last = r.group;
  }
  console.log("    " + (r.ok ? "ok  " : "FAIL") + "  " + pad(r.name, 62) + r.note);
}
console.log("\n  " + results.length + " checks, " + failures + " failed");
console.log("\n  Not covered: the client booting, and any of this running against a real");
console.log("  server. RYN does not boot in this harness and did not before these edits.");
process.exit(failures === 0 ? 0 : 1);
