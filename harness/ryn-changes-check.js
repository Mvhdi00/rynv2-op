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

/* Read a `const NAME = <number>;` out of the client rather than restating its
 * value here. A bench that hard-codes 350 next to a client that says 350 is not
 * testing the client — mutate the client to 200 and the bench stays green,
 * which is exactly what happened the first time these were written. */
function constant(name) {
  const m = new RegExp("const " + name + " = (-?[0-9.]+)").exec(src);
  if (!m) throw new Error("no `const " + name + "` in the file");
  return Number(m[1]);
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

/* The two branches of novastorm's heal rule, run rather than read. Mutation
 * testing found this gap: the case above passes shameCount 0, so removing
 * `myPlayer.shameCount < 7` from the rule left every check green. These drive
 * the guard from both sides.
 *
 *     if (((healing && myPlayer.shameCount < 7) || (tick - damageTick) > 0) ...
 *
 * The OR is what makes the guard subtle. At shameCount 7 the LEFT branch is
 * shut, but the right one — a tick passed without being hit — still heals, and
 * must, or a shamed player could never top up again. So the guard has to be
 * tested with the right branch shut too: damageTick == tickCount. */
check("execute", "the heal rule shuts the healing branch at shameCount 7", () => {
  const cls = lift("class AntiInsta\\s*\\{", "AntiInsta");
  const sandbox = {
    Math, Object,
    Settings_default: { _autoheal: true, _antiSmartTick: false },
    Items: { 0: { restore: 20 } }, Hats: { 6: { dmgMult: .75 } },
    ANTI_INSTA_DMG_CAP: 140, ANTI_INSTA_SCUBA_BIAS: 5,
  };
  vm.createContext(sandbox);
  vm.runInContext(cls + "\nthis.make = (c) => new AntiInsta(c);", sandbox);

  // shameCount, and whether a tick has passed without damage. tickCount ===
  // damageTick means one has NOT, so the right branch of the OR is shut.
  const run = (shameCount, quietTick) => {
    let heals = 0;
    sandbox.make({
      myPlayer: {
        tempHealth: 30, maxHealth: 100, shameCount, hatID: 0,
        tickCount: 10, damageTick: quietTick ? 2 : 10,
        isTrapped: false, getItemByType: () => 0,
      },
      _ModuleHandler: { heal: () => heals++, tickCount: 10 },
      // 60 predicted against 30 health: `healing` is true.
      EnemyManager: { potentialDamage: 60, potentialSpikeDamage: 0, nearestEnemy: null },
    }).postTick();
    return heals;
  };

  if (run(0, false) === 0) return [false, "did not heal at shameCount 0 under lethal damage"];
  if (run(6, false) === 0) return [false, "did not heal at shameCount 6 — the guard is `< 7`"];
  if (run(7, false) !== 0) return [false, "healed at shameCount 7 with no quiet tick — the guard is not being read"];
  // ...and the right branch of the OR must still work, or a shamed player could
  // never top up again.
  if (run(7, true) === 0) return [false, "a quiet tick no longer heals at shameCount 7 — the OR is gone"];
  return [true, "heals at 0 and 6, refuses at 7, and a quiet tick still heals at 7"];
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
  ["ANTI_TURRET_RANGE", "const ANTI_TURRET_RANGE"],
  ["ANTI_TURRET_DAMAGE", "const ANTI_TURRET_DAMAGE"],
  ["ANTI_TURRET_LOW_HEALTH", "const ANTI_TURRET_LOW_HEALTH"],
  ["ANTI_VELOCITY_TICK_MIN", "const ANTI_VELOCITY_TICK_MIN"],
  ["ANTI_VELOCITY_TICK_HAT", "const ANTI_VELOCITY_TICK_HAT"],
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
                           ["_botNameAll", '""'], ["_botNumberNames", "false"],
                           ["_knockbackTick", "false"],
                           ["_velocityTickTimes", "0"], ["_knockbackTickTimes", "0"]]) {
  check("wire", key + " has a default", () => {
    const re = new RegExp("\\b" + key + ":\\s*" + want + "\\s*,");
    return re.test(src) ? [true, key + ": " + want] : [false, "missing or not " + want];
  });
}

for (const id of ["_velocityTick", "_velocityTickTrap", "_knockbackTick",
                  "_botNameAll", "_botNumberNames",
                  "_velocityTickTimes", "_knockbackTickTimes"]) {
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

/* The spike tick is gone, in every form. Checked by naming the things that
 * would have to exist if any of it were left, rather than by grepping for the
 * word — auto place has carried its own `canSpikeTick` local and
 * LUNA_SPIKE_TICK_MODULES since long before any of this, and a substring
 * search would either flag those or be silently defeated by them. */
check("wire", "no spike tick module, setting, constant or UI survives", () => {
  const left = [];
  if (/class SpikeTick\s*\{/.test(src)) left.push("class SpikeTick");
  if (/\bspikeTick:\s*new /.test(src)) left.push("a staticModules registration");
  if (/staticModules\.spikeTick\b/.test(src)) left.push("a run-order slot");
  if (/moduleName\s*=\s*"spikeTick"/.test(src)) left.push('moduleName="spikeTick"');
  if (/const SPIKE_TICK_[A-Z_]+/.test(src)) left.push("SPIKE_TICK_* constants");
  if (/_spikeTick(Trapped|Free|Debug|Outcome)?\s*[:=]/.test(src)) left.push("a _spikeTick setting");
  if (/updateSpikeTick/.test(src)) left.push("GameUI.updateSpikeTick");
  if (left.length) return [false, "still present: " + left.join(", ")];
  // ...and the two names auto place has always had are still there, because
  // deleting those would be deleting part of auto place.
  if (!/const LUNA_SPIKE_TICK_MODULES/.test(src)) return [false, "auto place's stand-off set went with it"];
  if (!/let canSpikeTick =/.test(src)) return [false, "auto place's own canSpikeTick went with it"];
  return [true, "gone; auto place's own canSpikeTick and stand-off set untouched"];
});

/* The three placement systems the spike tick work reached into, put back.
 * `git diff` says the client is byte-identical to the pre-spike-tick commit
 * apart from the EnemyManager anti block, but a diff is a fact about one
 * checkout and this file has to keep being true afterwards — so the two
 * specific intrusions are named. */
check("wire", "auto place sends the way Luna wrote it, consulting nothing", () => {
  const m = /const emit = obj => \{([\s\S]*?)\n {6}\};/.exec(src);
  if (!m) return [false, "auto place's emit not found"];
  const body = m[1];
  if (/groundIsFree|holdGround|placementEngine/.test(body))
    return [false, "emit still asks the placement engine before it sends"];
  if (!/if \(!myPlayer\.canPlace\(type\)\) return;/.test(body))
    return [false, "the resource check went missing"];
  if (!/ModuleHandler\.place\(type, obj\.angle\);/.test(body))
    return [false, "emit no longer sends"];
  // Luna's ladder: the trap branch is unconditional and the spike branches are
  // not. That asymmetry is auto place's design, and it is back.
  if (!/if \(neitherTrapped\) return true;/.test(src))
    return [false, "Luna's unconditional trap branch is not as she wrote it"];
  return [true, "canPlace, then place — nothing between them"];
});

check("wire", "the placement engine has no reservation API bolted on", () => {
  const cls = lift("class RynPlacementEngine\\s*\\{", "RynPlacementEngine");
  for (const added of ["groundIsFree", "holdGround"]) {
    if (cls.includes(added)) return [false, "still carries " + added + "()"];
  }
  /* Preplace and replace are the engine's two jobs and every part of both is
   * still here. Anchored on the METHOD DEFINITION (four-space indent, open
   * paren) rather than on any mention: renaming `_generatePreplace(` to
   * `_generatePreplaceX(` leaves `this._generatePreplace(` at the call site,
   * and a bare-name search stayed green through exactly that mutation. */
  for (const kept of ["_generatePreplace", "_generateReplace", "_replaceContext",
                      "promoteRecord", "onVacated"]) {
    if (!new RegExp("\\n {4}" + kept + "\\(").test(cls)) return [false, "lost " + kept + "()"];
  }
  return [true, "preplace and replace intact, nothing added"];
});

/* The two long-range turret antis ported from novastorm 15473 / X- 14681.
 * harness/anti-audit.js runs the shipped method against a transcription of
 * novastorm's block over every world; these are the wiring facts that bench
 * cannot see, because it calls the method directly. */
check("wire", "antiLongRangeTurret is summed into the same total as every other anti", () => {
  const cls = lift("class EnemyManager\\s*\\{", "EnemyManager");
  if (!/antiLongRangeTurret\(enemy\) \{/.test(cls)) return [false, "the method is gone"];
  const dh = /handleDanger\(enemy\) \{([\s\S]*?)\n    \}/.exec(cls);
  if (!dh) return [false, "handleDanger not found"];
  const call = dh[1].indexOf("this.antiLongRangeTurret(enemy);");
  if (call < 0) return [false, "handleDanger never calls it"];
  // It adds to enemy.potentialDamage, so it has to run BEFORE that field is
  // folded into the manager's running total — after it, the additions are
  // written and then never read, which is exactly the pushingOnSpike bug.
  const sum = dh[1].indexOf("this.potentialDamage += enemy.potentialDamage;");
  if (sum < 0) return [false, "handleDanger no longer sums enemy.potentialDamage"];
  if (call > sum) return [false, "called after the sum, so its +25 is written and dropped"];
  return [true, "called before the sum, so the +25 reaches the heal"];
});

check("wire", "it reads the spike flags that belong to me, not to the enemy", () => {
  const cls = lift("class EnemyManager\\s*\\{", "EnemyManager");
  const m = /antiLongRangeTurret\(enemy\) \{([\s\S]*?)\n    \}/.exec(cls);
  const body = m[1];
  // collidingSpike/willCollideSpike are set by checkCollision inside `if
  // (isOwner)`, so `this.` is mine. `enemy.collidingSpike` would be a field
  // nothing writes — silently undefined, and the anti would never fire.
  for (const f of ["collidingSpike", "willCollideSpike"]) {
    if (!new RegExp("this\\." + f).test(body)) return [false, "does not read this." + f];
    if (new RegExp("enemy\\." + f).test(body)) return [false, "reads enemy." + f + ", which nothing writes"];
  }
  const guard = /if \(isOwner\) \{/.test(cls);
  return guard ? [true, "this.collidingSpike / this.willCollideSpike, both owner-side"]
               : [false, "checkCollision no longer has the isOwner block those flags live in"];
});

/* The distances below are literals on purpose. The constants come out of the
 * client, so shrinking ANTI_TURRET_RANGE to 200 or zeroing ANTI_TURRET_DAMAGE
 * moves the answer at 349 and these go red; what they assert is the reach and
 * the size of the prediction, not that the file contains the digits 350. */
const ANTI_CONSTANTS = () => ({
  ANTI_TURRET_RANGE: constant("ANTI_TURRET_RANGE"),
  ANTI_TURRET_DAMAGE: constant("ANTI_TURRET_DAMAGE"),
  ANTI_TURRET_LOW_HEALTH: constant("ANTI_TURRET_LOW_HEALTH"),
  ANTI_VELOCITY_TICK_MIN: constant("ANTI_VELOCITY_TICK_MIN"),
  ANTI_VELOCITY_TICK_HAT: constant("ANTI_VELOCITY_TICK_HAT"),
});

check("execute", "antiLongRangeTurret adds 25 at 349 and nothing at 351", () => {
  const cls = lift("class EnemyManager\\s*\\{", "EnemyManager");
  const m = /( {4}antiLongRangeTurret\(enemy\) \{[\s\S]*?\n {4}\})/.exec(cls);
  if (!m) return [false, "the method is gone"];
  const box = { ...ANTI_CONSTANTS(), Vec };
  vm.createContext(box);
  vm.runInContext("this.EM = { collidingSpike: true, willCollideSpike: false," +
    " potentialDamage: 0, potentialSpikeDamage: 0," +
    " client: { myPlayer: { pos: { current: new Vec(0, 0) }, currentHealth: 100 }," +
    "           PlayerManager: { lookingShield: () => false } },\n" +
    m[1].replace(/^ {4}/, "") + "\n};", box);
  const EM = box.EM;
  const at = d => {
    const enemy = {
      pos: { current: new Vec(d, 0) }, hatID: 6, potentialDamage: 0,
      reload: [{ previous: 3, max: 3 }, {}, {}],
      weapon: { primary: 0 }, getMaxWeaponDamage: () => 35,
      isReloaded: (i) => i === 2,          // turret up, primary spent this tick
    };
    EM.antiLongRangeTurret(enemy);
    return enemy.potentialDamage;
  };
  if (at(349) !== 25) return [false, "no turret damage predicted at 349, got " + at(349)];
  if (at(350) !== 25) return [false, "the turret test is `<= 350` and 350 gave " + at(350)];
  if (at(351) !== 0) return [false, "fired past 350, got " + at(351)];
  return [true, "25 in at 349 and 350, nothing at 351"];
});

check("execute", "the velocity-tick band is open at 151 and shut at 150 and 350", () => {
  const cls = lift("class EnemyManager\\s*\\{", "EnemyManager");
  const m = /( {4}antiLongRangeTurret\(enemy\) \{[\s\S]*?\n {4}\})/.exec(cls);
  const box = { ...ANTI_CONSTANTS(), Vec };
  vm.createContext(box);
  vm.runInContext("this.EM = { collidingSpike: false, willCollideSpike: false," +
    " potentialDamage: 0, potentialSpikeDamage: 0," +
    " client: { myPlayer: { pos: { current: new Vec(0, 0) }, currentHealth: 100 }," +
    "           PlayerManager: { lookingShield: () => false } },\n" +
    m[1].replace(/^ {4}/, "") + "\n};", box);
  const EM = box.EM;
  const at = (d, hat) => {
    const enemy = {
      pos: { current: new Vec(d, 0) }, hatID: hat, potentialDamage: 0,
      reload: [{ previous: 3, max: 3 }, {}, {}],
      weapon: { primary: 0 }, getMaxWeaponDamage: () => 35,
      isReloaded: (i) => i === 0,          // primary up, turret spent
    };
    EM.antiLongRangeTurret(enemy);
    return enemy.potentialDamage;
  };
  // novastorm's band is `dist > 150 && dist < 350` — strictly inside both ends,
  // and the outer guard alone (`> 350`) would have let 350 through.
  if (at(151, 53) !== 60) return [false, "turret gear at 151 predicted " + at(151, 53) + ", want 25 + 35"];
  if (at(150, 53) !== 0) return [false, "fired at exactly 150"];
  if (at(350, 53) !== 0) return [false, "fired at exactly 350 — the band is `< 350`"];
  if (at(200, 6) !== 0) return [false, "fired on a soldier hat, not turret gear"];
  return [true, "25 + primary inside (150, 350), and only on hat 53"];
});

// ── 4. NO GHOSTS ──────────────────────────────────────────────────────────
const DELETED = [
  "_healsInFlight", "isSaveHealTime", "isSaveHealTick", "isSaveHeal", "_healSent",
  "_rawHeal", "_healBudgetLeft", "_flushShameHealQueue", "_shameHealQueue",
  "_shameHealDeadline", "_SHAME_GUARD_MARGIN", "pushingOnSpike",
  // Nothing from the spike tick is listed here: it was not pared back, it was
  // removed whole, and "no spike tick module, setting, constant or UI
  // survives" above is the check for that. SpikeSync and the three
  // EnemyManager getters that gate it are the client's own code and are back.
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
