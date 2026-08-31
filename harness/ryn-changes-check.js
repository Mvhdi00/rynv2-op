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
  ["SHAME_SAFE_WINDOW", "const SHAME_SAFE_WINDOW"],
  ["SPIKE_TICK_TYPE", "const SPIKE_TICK_TYPE"],
  ["SPIKE_TICK_KB_SAFE", "const SPIKE_TICK_KB_SAFE"],
  ["SPIKE_TICK_STICK", "const SPIKE_TICK_STICK"],
  ["SPIKE_TICK_TURN_LIMIT", "const SPIKE_TICK_TURN_LIMIT"],
  ["SPIKE_TICK_LEAD", "const SPIKE_TICK_LEAD"],
  ["SPIKE_TICK_MIN_CONFIDENCE", "const SPIKE_TICK_MIN_CONFIDENCE"],
  ["SPIKE_TICK_ANGLE_LIMIT", "const SPIKE_TICK_ANGLE_LIMIT"],
  ["SPIKE_TICK_TRAPPED_BONUS", "const SPIKE_TICK_TRAPPED_BONUS"],
  ["SPIKE_TICK_REASON", "const SPIKE_TICK_REASON"],
  ["SPIKE_TICK_HOLD_LEAD", "const SPIKE_TICK_HOLD_LEAD"],
  ["SPIKE_TICK_HOLD_CONFIDENCE", "const SPIKE_TICK_HOLD_CONFIDENCE"],
  ["SPIKE_TICK_HOLD_TTL", "const SPIKE_TICK_HOLD_TTL"],
  ["SPIKE_TICK_HOLD_ANGLES", "const SPIKE_TICK_HOLD_ANGLES"],
  ["SPIKE_TICK_BULL_MULT", "const SPIKE_TICK_BULL_MULT"],
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

for (const [key, want] of [["_velocityTick", "false"], ["_velocityTickTrap", "false"],
                           ["_spikeTick", "false"], ["_spikeTickTrapped", "true"],
                           ["_spikeTickFree", "true"], ["_spikeTickDebug", "false"],
                           ["_botNameAll", '""'], ["_botNumberNames", "false"],
                           ["_knockbackTick", "false"],
                           ["_velocityTickTimes", "0"], ["_knockbackTickTimes", "0"]]) {
  check("wire", key + " has a default", () => {
    const re = new RegExp("\\b" + key + ":\\s*" + want + "\\s*,");
    return re.test(src) ? [true, key + ": " + want] : [false, "missing or not " + want];
  });
}

for (const id of ["_velocityTick", "_velocityTickTrap", "_knockbackTick",
                  "_spikeTick", "_spikeTickTrapped", "_spikeTickFree", "_spikeTickDebug",
                  "_botNameAll", "_botNumberNames",
                  "_velocityTickTimes", "_knockbackTickTimes", "_spikeTickOutcome"]) {
  check("wire", id + " has a UI element", () => {
    const asInput = src.includes('id=\\"' + id + '\\" type=\\"checkbox\\"');
    const asSpan = src.includes('id=\\"' + id + '\\" class=\\"text-value\\"');
    // A text field carries its class between the id and the type, so the two
    // patterns above miss it — the first version of this check reported a
    // present element as missing.
    const asText = new RegExp('id=\\\\"' + id + '\\\\"[^>]*type=\\\\"text\\\\"').test(src);
    if (!asInput && !asSpan && !asText) return [false, "no element carries this id"];
    return [true, asInput ? "checkbox" : asText ? "text field" : "stat span"];
  });
}

check("wire", "the checkbox binder picks settings up by id", () =>
  src.includes("querySelectorAll(\"input[type='checkbox'][id]\")")
    ? [true, "generic id binder present, so _velocityTick binds itself"]
    : [false, "no generic binder — the new checkbox would be inert"]);

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

check("wire", "one bot name reaches every bot row", () => {
  if (!/_botNameAll: ""/.test(src)) return [false, "_botNameAll has no default"];
  if (!src.includes("const sharedName = (Settings_default._botNameAll"))
    return [false, "the row builder does not read it"];
  if (!/inp\.value = Settings_default\._botNumberNames/.test(src))
    return [false, "the numbering switch is not consulted"];
  // It must prefill the row's own input, not open a second path to the socket.
  if (!/\? this\._numberedBotName\(sharedName, botCount\)\s*\n\s*: sharedName;/.test(src))
    return [false, "numbering does not use _numberedBotName"];
  return [true, "prefills the row input the connect button already reads"];
});

check("wire", "a numbered bot name never exceeds moomoo's 15 characters", () => {
  const m = /_numberedBotName\(base, n\) \{([\s\S]*?)\n    \}/.exec(src);
  if (!m) return [false, "_numberedBotName not found"];
  if (!/15 - suffix\.length/.test(m[1]))
    return [false, "the base is not trimmed to leave room for the digits"];
  return [true, "base trimmed so the number always survives"];
});

check("wire", "automill reports what it sent", () => {
  const cls = lift("class Automill\\s*\\{", "Automill");
  if (!/this\._report\(3\);/.test(cls)) return [false, "the trio does not report"];
  if (!/updateAutomill/.test(cls)) return [false, "_report does not reach the UI"];
  if (!src.includes('id=\\"_automillSent\\"')) return [false, "no Devtool row carries #_automillSent"];
  const q = /updateAutomill\(state\) \{[\s\S]{0,160}?querySelector\("#([A-Za-z_]+)"\)/.exec(src);
  if (!q) return [false, "updateAutomill not found or does not query"];
  if (q[1] !== "_automillSent") return [false, "paints #" + q[1] + ", row is #_automillSent"];
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

/* The food guard, lifted and actually run rather than pattern-matched. Three
 * behaviours, and all three matter: it holds the first press inside the
 * window, it gives up holding after one tick so a fight with no gap in it
 * cannot starve you, and it answers once per tick so a heal asking for four
 * presses gets four or none. */
check("execute", "_foodIsShameSafe holds once, then gives way", () => {
  const m = /\n {4}_foodIsShameSafe\(\) \{/.exec(src);
  if (!m) return [false, "the method is gone"];
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0, body = null;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) { body = src.slice(m.index + 1, i + 1); break; } }
  }
  const box = { SHAME_SAFE_WINDOW: 125, Infinity, Date: { now: () => box.__now } };
  vm.createContext(box);
  vm.runInContext("this.MH = { tickCount: 0, _foodHeldTick: -1, _foodFreeTick: -1," +
    " client: { myPlayer: { receivedDamage: null }, SocketManager: { pong: 30 } }," +
    body + " };", box);
  const MH = box.MH;

  box.__now = 1000;
  if (MH._foodIsShameSafe() !== true) return [false, "held a press with no hit behind it"];

  MH.tickCount = 1; box.__now = 1050; MH.client.myPlayer.receivedDamage = 1040;
  if (MH._foodIsShameSafe() !== false) return [false, "did not hold a press 10ms after a hit"];
  if (MH._foodIsShameSafe() !== false) return [false, "changed its mind inside one tick"];
  // Date.now() moves while a tick runs, and a heal asking for four presses asks
  // four times. If the window opens between two of those calls the tick must
  // still answer the way it already answered, or the heal goes out in pieces.
  box.__now = 1400;
  if (MH._foodIsShameSafe() !== false) return [false, "let a press through mid-tick after holding the tick"];
  box.__now = 1050;

  MH.tickCount = 2; box.__now = 1060;
  if (MH._foodIsShameSafe() !== true) return [false, "held for a second tick — that is how you starve"];
  if (MH._foodIsShameSafe() !== true) return [false, "released only the first press of the tick"];

  MH.tickCount = 3; box.__now = 1400;
  if (MH._foodIsShameSafe() !== true) return [false, "held a press well outside the window"];

  MH.tickCount = 4; box.__now = 1410; MH.client.myPlayer.receivedDamage = null;
  if (MH._foodIsShameSafe() !== true) return [false, "held after the hit stamp was cleared"];
  return [true, "holds one tick, releases the whole tick, free once the window is past"];
});

/* The spike tick. It is a timing module: everything it knows about placement
 * it asks the engine for, and everything it sends goes back through the engine.
 * These are the properties that make that true, checked against the source
 * rather than assumed. harness/spike-tick.js runs the class itself. */
check("wire", "SpikeTick is defined, registered, and runs before the placers", () => {
  if (!/class SpikeTick\s*\{/.test(src)) return [false, "no `class SpikeTick {`"];
  if (!src.includes("spikeTick: new SpikeTick_default(client2)")) return [false, "not registered"];
  const m = /this\.modules = \[([^\]]+)\]/.exec(src);
  const order = m[1].split(",").map(x => x.trim().replace("this.staticModules.", ""));
  const i = order.indexOf("spikeTick");
  if (i < 0) return [false, "not in the run order"];
  for (const later of ["autoPlacer", "placementEngine", "updateAttack"]) {
    const j = order.indexOf(later);
    if (j >= 0 && j < i) return [false, "runs after " + later + ", so it cannot set the swing or read a clean world"];
  }
  const hammer = order.indexOf("spikeSyncHammer");
  if (hammer >= 0 && hammer > i) return [false, "spikeSyncHammer runs after it, so its delegated strike would be a tick late"];
  return [true, "slot " + i + " of " + order.length + ", before autoPlacer and updateAttack"];
});

check("wire", "the spike tick takes no ground of its own", () => {
  const cls = lift("class SpikeTick\\s*\\{", "SpikeTick");
  for (const bad of ["preempt(", "ledger.reserve", "claimPlacement", "_conflicts.take"]) {
    if (cls.includes(bad)) return [false, "calls " + bad + " - that takes ground from a placer"];
  }
  if (!/requestPlaceMany\(SPIKE_TICK_TYPE/.test(cls))
    return [false, "does not send through requestPlaceMany, so it is off the engine's packet path"];
  return [true, "reads the ledger, sends through the engine, reserves nothing itself"];
});

check("wire", "it stands down rather than paying twice", () => {
  const cls = lift("class SpikeTick\\s*\\{", "SpikeTick");
  if (!/_coveredBy\(/.test(cls)) return [false, "no _coveredBy"];
  for (const src2 of ["ledger.entries", "book.pending()"]) {
    if (!cls.includes(src2)) return [false, "does not consult " + src2];
  }
  if (!/if \(sent <= 0\) return false;/.test(cls))
    return [false, "swings even when the placement did not go out"];
  return [true, "standing spikes, hard reservations and the preplace book all read"];
});

check("wire", "it uses the engine's motion track, not one of its own", () => {
  const cls = lift("class SpikeTick\\s*\\{", "SpikeTick");
  if (!/engine\.motion\.predict/.test(cls)) return [false, "does not use engine.motion.predict"];
  if (!/engine\.motion\.get/.test(cls)) return [false, "does not read the track"];
  if (/new TargetMotion/.test(cls)) return [false, "builds a second motion tracker"];
  if (!/engine\.anglesFor/.test(cls)) return [false, "does not use the engine's angle solver"];
  return [true, "one tracker, one solver, both the engine's"];
});

check("wire", "SpikeSyncHammer delegates its strike instead of repeating it", () => {
  const cls = lift("class SpikeSyncHammer\\s*\\{", "SpikeSyncHammer");
  if (!/spikeTick\.strike\(/.test(cls)) return [false, "does not delegate"];
  if (/forceHat = 7;/.test(cls)) return [false, "still sets the bull helmet itself"];
  if (/requestPlace\(itemType/.test(cls)) return [false, "still places the spikes itself"];
  return [true, "one execution path for a spike tick"];
});

/* The execution-order fix. Auto place was the one placement path that sent
 * without consulting the resolver, and a trap forbids a spike within 77
 * degrees — wider than the reach window at any distance — so its trap took the
 * tick's ground before the tick could ask for it. harness/spike-vs-trap.js
 * measures the behaviour; these check the wiring it depends on. */
check("wire", "auto place asks the resolver before it sends", () => {
  const cls = lift("class AutoPlacer\\s*\\{", "AutoPlacer");
  if (!/const placementEngine = ModuleHandler\.staticModules && ModuleHandler\.staticModules\.placementEngine;/.test(cls))
    return [false, "does not resolve the engine"];
  const m = /const emit = obj => \{([\s\S]*?)\n      \};/.exec(cls);
  if (!m) return [false, "emit not found"];
  if (!/groundIsFree\(type, obj\.angle, "autoPlacer"\)/.test(m[1]))
    return [false, "emit still sends without asking"];
  if (m[1].indexOf("groundIsFree") > m[1].indexOf("ModuleHandler.place("))
    return [false, "asks after sending, which answers nothing"];
  return [true, "emit declines ground another module holds"];
});

check("wire", "the ladder that chooses auto place's angles is untouched", () => {
  const cls = lift("class AutoPlacer\\s*\\{", "AutoPlacer");
  // The one thing that must not have been done: quietly reordering or gating
  // Luna's own decision so spikes win. The trap branch is still unconditional.
  if (!/if \(isTrap\) \{[\s\S]{0,320}?if \(neitherTrapped\) return true;/.test(cls))
    return [false, "the trap branch has been changed"];
  if (!/\[ \[ trapId, LUNA_TRAP_TYPE, trapAngles \], \[ spikeId, LUNA_SPIKE_TYPE, spikeAngles \] \]/.test(cls))
    return [false, "the trapped fallback order has been changed"];
  return [true, "isAutoPlaceAngle and the fallback order are as they were"];
});

check("wire", "the spike tick holds ground softly and gives it back", () => {
  const cls = lift("class SpikeTick\\s*\\{", "SpikeTick");
  if (!/engine\.holdGround\(SPIKE_TICK_TYPE/.test(cls)) return [false, "never holds"];
  if (!/_release\("fired"\)/.test(cls)) return [false, "does not release when it fires"];
  if (!/_release\("nothingSoon"\)/.test(cls)) return [false, "does not release a stale hold"];
  if (!/_holdVerdict\(/.test(cls)) return [false, "no trap-versus-spike comparison"];
  if (!/roomForBoth/.test(cls)) return [false, "does not check the trap still has somewhere to go"];
  if (!/const why = this\._holdVerdict\(/.test(cls) || !/if \(!why\) \{/.test(cls))
    return [false, "the verdict is computed and then ignored"];
  const hold = /holdGround\(type, angle, owner, value, ttl\) \{([\s\S]*?)\n    \}/.exec(src);
  if (!hold) return [false, "engine.holdGround not found"];
  if (!/ttl === undefined \? 2 : ttl, true\)/.test(hold[1]))
    return [false, "the claim is not soft — it would not yield to an insta"];
  return [true, "soft SYNC claim, released on fire and on staleness"];
});

check("wire", "updateSpikeTick targets the id the Devtool row uses", () => {
  const m = /updateSpikeTick\(state\) \{[\s\S]{0,160}?querySelector\("#([A-Za-z_]+)"\)/.exec(src);
  if (!m) return [false, "updateSpikeTick not found or does not query"];
  return m[1] === "_spikeTickOutcome" ? [true, "queries #" + m[1]]
                                      : [false, "queries #" + m[1] + ", row is #_spikeTickOutcome"];
});

// ── 4. NO GHOSTS ──────────────────────────────────────────────────────────
const DELETED = [
  "_healsInFlight", "isSaveHealTime", "isSaveHealTick", "isSaveHeal", "_healSent",
  "_rawHeal", "_healBudgetLeft", "_flushShameHealQueue", "_shameHealQueue",
  "_shameHealDeadline", "_SHAME_GUARD_MARGIN", "pushingOnSpike",
  // SpikeSync, and the three EnemyManager members that existed only to gate it.
  "canSpikeSync", "nearestPlaceSpikeAngle", "prevNearestSpikePlacerAngle",
  // The spike tick's own angle cooldown: unreachable behind _coveredBy, and
  // PlacementMemory already owns the case it would have covered.
  "_onCooldown", "SPIKE_TICK_COOLDOWN", "_askedAngle",
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

check("no ghosts", "heal() carries no queue and no packet budget", () => {
  const m = /\n    heal\(\) \{([\s\S]*?)\n    \}/.exec(src);
  if (!m) return [false, "heal() not found"];
  const body = m[1];
  // The old deferral queue and budget are still gone. What is back is two
  // questions asked inline, both of them about the server's shame rule.
  for (const bad of ["_healBudgetLeft", "_shameHealQueue", "packetCount"]) {
    if (body.includes(bad)) return [false, "still references " + bad];
  }
  if (!/if \(myPlayer && myPlayer\.shameActive\) \{\s*\n\s*return;/.test(body))
    return [false, "does not stand down during the 30s lock"];
  if (!/if \(!this\._foodIsShameSafe\(\)\) \{\s*\n\s*return;/.test(body))
    return [false, "does not consult the shame window"];
  if (!/this\.selectItem\(2\);[\s\S]*this\.attack\(null, 1\);/.test(body))
    return [false, "no longer sends the food"];
  return [true, "lock, window, then the same three sends"];
});

check("no ghosts", "the stand-off set no longer names modules that do not exist", () => {
  const m = /const LUNA_SPIKE_TICK_MODULES = new Set\(\[([^\]]+)\]\)/.exec(src);
  if (!m) return [false, "the set is gone — autoPlacer would stop standing off"];
  const names = m[1].split(",").map(x => x.trim().replace(/"/g, ""));
  const dead = names.filter(n => !src.includes('moduleName="' + n + '"'));
  return dead.length === 0 ? [true, names.length + " names, all real modules"]
                           : [false, "names a module that no longer exists: " + dead.join(", ")];
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
