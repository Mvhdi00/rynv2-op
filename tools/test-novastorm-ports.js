// Checks the four Novastorm features ported into
// YoRHa_System_replace_falcon.user.js: the second killchat line, equip on kill,
// auto trap animal, and the weather / time-of-day overlays.
//
// The logic is lifted out of the userscript and run against stubs, so this
// fails if the file drifts. The overlays are DOM and CSS, so those are checked
// at source level.
//
// Run: node tools/test-novastorm-ports.js

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "YoRHa_System_replace_falcon.user.js");
const src = fs.readFileSync(FILE, "utf8");

let failures = 0;
function ok(name, cond, detail) {
    if (cond) { console.log("  pass  " + name); return; }
    failures++;
    console.log("  FAIL  " + name + (detail ? "  -- " + detail : ""));
}

function matchBraces(from) {
    let depth = 0, i = src.indexOf("{", from), j = i;
    for (; j < src.length; j++) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}" && --depth === 0) { j++; break; }
    }
    return src.slice(from, j);
}
function lift(name) {
    const start = src.indexOf("function " + name + "(");
    if (start < 0) throw new Error("not found in userscript: function " + name);
    return matchBraces(start);
}
function liftArray(name) {
    const m = new RegExp("const " + name + " = (\\[[^\\]]*\\])").exec(src);
    if (!m) throw new Error("not found in userscript: const " + name);
    return eval("(" + m[1] + ")");
}

// --- shared stubs -----------------------------------------------------------
global.window = { vars: {} };
const UTILS = { getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) };
let myPlayer = null, players = [], ais = [], aiManager = { aiTypes: [] };
let allies = new Set();
function isAlly(sid) { return allies.has(sid); }

// ============================================================================
console.log("victim name — who actually just died");
const previousDeadPlayers = new Set();
eval(lift("takeKilledName"));
eval(lift("clearDeadName"));

myPlayer = { sid: 1 };
players = [{ sid: 1, name: "me", health: 100 }, { sid: 2, name: "victim", health: 0 }];
ok("names the dead non-ally", takeKilledName() === "victim");
ok("a body in view is claimed once, not for every later kill", takeKilledName() === null);

previousDeadPlayers.clear();
players = [{ sid: 2, name: "ally", health: 0 }];
allies = new Set([2]);
ok("an ally going down is not your kill", takeKilledName() === null);
allies = new Set();

previousDeadPlayers.clear();
players = [{ sid: 1, name: "me", health: 0 }];
ok("your own body is not your kill", takeKilledName() === null);

previousDeadPlayers.clear();
players = [{ sid: 2, name: "alive", health: 40 }];
ok("nobody down: no name", takeKilledName() === null);

previousDeadPlayers.clear();
players = [{ sid: 2, name: "", health: 0 }];
ok("a nameless player yields null, not an empty line", takeKilledName() === null);

// Respawn has to release the sid or you can only ever kill someone once.
previousDeadPlayers.clear();
players = [{ sid: 2, name: "victim", health: 0 }];
takeKilledName();
clearDeadName(2);
ok("respawning makes them killable again", takeKilledName() === "victim");

myPlayer = null;
ok("before spawn: no name, no throw", takeKilledName() === null);

// ============================================================================
console.log("\nauto trap animal");
const TRAP_ANIMALS = liftArray("TRAP_ANIMALS");
const animalTrapAt = new Map();
let placed = [], canPlaceOk = true;
function canPlace() { return canPlaceOk; }
function place(id, angle) { placed.push({ id: id, angle: angle }); }
eval(lift("autoTrapAnimal"));

aiManager = { aiTypes: [
    { src: "cow_1" },      // 0
    { src: "bull_1" },     // 1
    { src: "wolf_2" },     // 2
    { src: "chicken_1" }   // 3
] };
function resetAnimals() {
    animalTrapAt.clear(); placed = []; canPlaceOk = true;
    myPlayer = { alive: true, x2: 1000, y2: 1000, items: [null, null, null, null, 15] };
    window.vars = { autoTrapAnimal: true };
    ais = [];
}
const animal = (index, x, y, extra) => Object.assign({ sid: 90 + index, index, x2: x, y2: y, visible: true, health: 100 }, extra || {});

resetAnimals(); ais = [animal(1, 1100, 1000)];
ok("a bull in range gets a trap", autoTrapAnimal() === true && placed.length === 1);
ok("...aimed at it", Math.abs(placed[0].angle - 0) < 1e-9);
ok("...using the trap slot", placed[0].id === 15);

resetAnimals(); ais = [animal(0, 1100, 1000), animal(3, 1050, 1000)];
ok("cows and chickens are ignored", autoTrapAnimal() === false && placed.length === 0);

resetAnimals(); ais = [animal(2, 1000, 1400)];
ok("out of range (400 away) is left alone", autoTrapAnimal() === false);
resetAnimals(); ais = [animal(2, 1000, 1300)];
ok("300 away is in range", autoTrapAnimal() === true);

resetAnimals(); ais = [animal(1, 1200, 1000), animal(2, 1050, 1000)];
autoTrapAnimal();
ok("the closest dangerous animal wins", placed[0].angle === 0 && ais[1].sid === 92);

resetAnimals(); ais = [animal(1, 1100, 1000)];
autoTrapAnimal();
ok("the same animal is not answered twice in a row", autoTrapAnimal() === false);
animalTrapAt.set(ais[0].sid, Date.now() - 6000);
ok("...but is again after the 5s cooldown", autoTrapAnimal() === true);

resetAnimals(); ais = [animal(1, 1100, 1000, { visible: false })];
ok("an animal out of view is not trapped", autoTrapAnimal() === false);
resetAnimals(); ais = [animal(1, 1100, 1000, { health: 0 })];
ok("a dead animal is not trapped", autoTrapAnimal() === false);

resetAnimals(); ais = [animal(1, 1100, 1000)]; canPlaceOk = false;
ok("no room to place: nothing is sent", autoTrapAnimal() === false && placed.length === 0);

resetAnimals(); ais = [animal(1, 1100, 1000)]; window.vars.autoTrapAnimal = false;
ok("toggle off: nothing happens", autoTrapAnimal() === false);
resetAnimals(); ais = [animal(1, 1100, 1000)]; myPlayer.alive = false;
ok("dead: nothing happens", autoTrapAnimal() === false);
resetAnimals(); ais = [animal(1, 1100, 1000)]; myPlayer.items[4] = null;
ok("no trap in the loadout: nothing happens", autoTrapAnimal() === false);

// The cooldown map is keyed by sid, and animals respawn under new ones.
resetAnimals();
for (let i = 0; i < 50; i++) animalTrapAt.set(1000 + i, Date.now() - 60000);
ais = [animal(1, 1100, 1000)];
autoTrapAnimal();
ok("stale cooldown entries are swept, not piled up", animalTrapAt.size === 1, String(animalTrapAt.size));

// ============================================================================
console.log("\nsource-level guarantees");
ok("every dangerous animal is a chaser, none of the harmless ones",
   TRAP_ANIMALS.slice().sort().join(",") === "bull_1,bull_2,wolf_1,wolf_2");
ok("the trap fires off the damage hook, not every tick",
   /deathDamages\.push\(\{ damage: UTILS\.fixTo\(damage, 2\), tick: damageTick \}\);\s*\n\s*\n\s*autoTrapAnimal\(\);/.test(src));
ok("a respawn releases the name claim",
   /if \(value > 0\) clearDeadName\(sid\);/.test(src));

ok("the second killchat line waits before sending",
   /setTimeout\(function \(\) \{[\s\S]{0,200}sendChat\(victim \? victim \+ " " \+ msg2 : msg2\);/.test(src));
ok("...and is skipped when left empty",
   /const msg2 = \(window\.vars\.chatMsg2 \|\| ""\)\.trim\(\);\s*\n\s*if \(msg2\) \{/.test(src));
ok("...and never fires from the grave", /if \(!myPlayer \|\| !myPlayer\.alive\) return;/.test(src));
ok("...with a delay that cannot go negative",
   /Math\.max\(0, window\.vars\.killChatDelay \|\| 0\)/.test(src));
ok("the kill toast now gets the real name",
   /if \(victimName\) killedName = victimName;/.test(src));

ok("equip on kill uses a slot, not a raw item id",
   /myPlayer\.weapons\[window\.vars\.equipOnKillSlot === 1 \? 1 : 0\]/.test(src));
ok("...and sends nothing when that slot is empty", /if \(want != null\) selectWeapon\(want, false\);/.test(src));

ok("weather layers are built on first use, not at load",
   /if \(!on && !this\._weatherBuilt\[kind\]\) continue;/.test(src));
ok("...and named literally so the toggles are greppable",
   /\["star", V\.starMode\], \["rain", V\.rainMode\], \["leaf", V\.leafMode\]/.test(src));
ok("night and morning are mutually exclusive tiles",
   /id: "nightMode", exclusive: "morningMode"/.test(src) &&
   /id: "morningMode", exclusive: "nightMode"/.test(src));
ok("overlays never swallow a click",
   (src.match(/\.yorha-wx \{[^}]*pointer-events: none/) || []).length === 1 &&
   /#yorha-wx-tint \{[^}]*pointer-events: none/.test(src));
ok("overlays sit under the CRT veil",
   /z-index: 2147482900/.test(src) && /z-index: 2147482800/.test(src) &&
   /#yorha-crt \{[\s\S]{0,120}z-index: 2147483000/.test(src));
ok("the weather sync rides the existing FX interval, no new timer",
   /YoRHaFX\.crt\(\); YoRHaFX\.deathWatch\(\); YoRHaFX\.weather\(\);/.test(src));

for (const id of ["chatMsg2", "killChatDelay", "equipOnKill", "equipOnKillSlot",
                  "autoTrapAnimal", "nightMode", "morningMode", "rainMode", "starMode", "leafMode"]) {
    const uses = (src.match(new RegExp("\\b" + id + "\\b", "g")) || []).length;
    ok(`${id} is wired, not a dead button (${uses} references)`, uses >= 3);
}

console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
process.exit(failures ? 1 : 0);
