// Checks the two feature groups added to YoRHa_System_replace_falcon.user.js:
// manual insta, and the two overlay toggles (reload bars / item HP bars).
//
// The logic under test is lifted out of the userscript itself and run against
// stubs, so this fails if the file drifts. Rendering geometry is asserted at
// source level — there is no canvas here.
//
// Run: node tools/test-yorha-additions.js

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
// Returns just the `{...}` an object const is initialised with. A `const`
// declared inside a direct eval is scoped to that eval and would not be
// visible to the lifted functions, so the value is bound here instead.
function liftObjectLiteral(name) {
    const start = src.indexOf("const " + name + " = {");
    if (start < 0) throw new Error("not found in userscript: const " + name);
    return matchBraces(start).slice(("const " + name + " = ").length);
}

// --- shared stubs -----------------------------------------------------------
global.window = { vars: {} };
let myPlayer = null, nearestEnemy = null, instaKill = [];
let primaryReload = [], secondaryReload = [], turretReload = [];
let boughtHats = new Set();
function isBoughtHat(id) { return boughtHats.has(id); }

const INSTA_COMBOS = eval("(" + liftObjectLiteral("INSTA_COMBOS") + ")");
eval(lift("canFireInstaToken"));
eval(lift("fireManualInsta"));

function resetInsta() {
    myPlayer = { sid: 1, alive: true, weapons: [5, 15] };
    nearestEnemy = { sid: 2 };
    instaKill = [];
    primaryReload = []; secondaryReload = []; turretReload = [];
    primaryReload[1] = 1; secondaryReload[1] = 1; turretReload[1] = 1;
    boughtHats = new Set([53]);
    window.vars = { instaCombo: "secondary" };
}

console.log("manual insta — refuses the presses it should");
resetInsta();
ok("fires with everything ready", fireManualInsta() === true);
ok("writes the ranged->melee list", JSON.stringify(instaKill) === '["secondary","primary","stop"]',
   JSON.stringify(instaKill));

resetInsta();
instaKill = ["primary", "stop"];
ok("will not interrupt a combo in flight", fireManualInsta() === false);
ok("...and leaves the running list untouched",
   JSON.stringify(instaKill) === '["primary","stop"]');

resetInsta(); myPlayer.alive = false;
ok("refuses while dead", fireManualInsta() === false);
resetInsta(); nearestEnemy = null;
ok("refuses with no enemy", fireManualInsta() === false);
resetInsta(); myPlayer = null;
ok("refuses before spawn", fireManualInsta() === false);

resetInsta(); secondaryReload[1] = 0.4;
ok("refuses ranged->melee on a cold secondary", fireManualInsta() === false);
resetInsta(); myPlayer.weapons[1] = null;
ok("refuses ranged->melee with no secondary equipped", fireManualInsta() === false);

resetInsta(); window.vars.instaCombo = "turret"; boughtHats = new Set();
ok("refuses a turret combo without the turret hat", fireManualInsta() === false);
resetInsta(); window.vars.instaCombo = "turret"; turretReload[1] = 0.9;
ok("refuses a turret combo on a cold turret", fireManualInsta() === false);
resetInsta(); window.vars.instaCombo = "primaryturret"; primaryReload[1] = 0.5;
ok("primaryturret needs BOTH turret and primary", fireManualInsta() === false);

console.log("\nmanual insta — the lists themselves");
resetInsta(); window.vars.instaCombo = "turret"; fireManualInsta();
ok("turret list", JSON.stringify(instaKill) === '["turret","primary","stop"]');
resetInsta(); window.vars.instaCombo = "primaryturret"; fireManualInsta();
ok("primaryturret list", JSON.stringify(instaKill) === '["primaryturret","stop"]');
resetInsta(); window.vars.instaCombo = "full"; fireManualInsta();
ok("full list", JSON.stringify(instaKill) === '["secondary","primary","turret","stop"]');
resetInsta(); window.vars.instaCombo = "nonsense"; fireManualInsta();
ok("unknown combo name falls back to ranged->melee",
   JSON.stringify(instaKill) === '["secondary","primary","stop"]');

// The executor shifts tokens off instaKill. If the press handed out the shared
// array instead of a copy, the second use of a combo would start half-spent.
resetInsta(); fireManualInsta();
instaKill.shift(); instaKill.shift();
resetInsta(); fireManualInsta();
ok("each press gets its own copy of the list",
   JSON.stringify(instaKill) === '["secondary","primary","stop"]', JSON.stringify(instaKill));
ok("every combo ends in stop (clears insta.* and re-arms reload)",
   Object.values(INSTA_COMBOS).every(c => c[c.length - 1] === "stop"));

console.log("\nkeybind chain — no key is swallowed");
const VANILLA = { 69: "E", 67: "C", 88: "X", 82: "R", 81: "Q", 32: "Space" };
const vanillaLetters = Object.values(VANILLA);
const varsBlock = src.slice(src.indexOf("window.vars = {"), src.indexOf("window.vars = {") + 4000);
const binds = {};
for (const m of varsBlock.matchAll(/^\s+(key[A-Za-z0-9]+): "([^"]+)",/gm)) binds[m[1]] = m[2];

ok("found the keybind defaults", Object.keys(binds).length >= 15, Object.keys(binds).length + " found");

const clashing = Object.entries(binds).filter(([, k]) => vanillaLetters.includes(k));
ok("no default sits on a vanilla hardcoded key", clashing.length === 0, JSON.stringify(clashing));

const seen = {}, dupes = [];
for (const [id, k] of Object.entries(binds)) {
    if (seen[k]) dupes.push(seen[k] + " and " + id + " both on " + k);
    seen[k] = id;
}
ok("no two keybinds share a default", dupes.length === 0, dupes.join("; "));

const chain = src.slice(src.indexOf("let keyStr = event.code;"));
const instaAt = chain.indexOf("keyStr === window.vars.keyInsta");
const firstRawAt = Math.min(...Object.keys(VANILLA).map(n => {
    const at = chain.indexOf("keyNum == " + n);
    return at < 0 ? Infinity : at;
}));
ok("manual insta is tested before every raw keyNum branch",
   instaAt > -1 && instaAt < firstRawAt, instaAt + " vs " + firstRawAt);
ok("...and only once", chain.split("window.vars.keyInsta").length - 1 === 2);
ok("...guarded so an empty binding matches nothing",
   /if \(window\.vars\.keyInsta && keyStr === window\.vars\.keyInsta\)/.test(src));

console.log("\nsource-level guarantees");
ok("manual insta is bound to its own key", /keyStr === window\.vars\.keyInsta/.test(src));
ok("the key has a default and a menu entry",
   /keyInsta: "[A-Z]",/.test(src) && /id: "keyInsta"/.test(src));
ok("combo select offers every list in INSTA_COMBOS",
   Object.keys(INSTA_COMBOS).every(k => new RegExp('value: "' + k + '"').test(src)));
ok("the arc and the bar never draw together",
   /if\(!window\.vars\.itemHealthBar && UTILS\.getDistance/.test(src));
ok("item bars only mark damaged objects",
   /if \(!\(object\.health < object\.maxHealth\)\) continue;/.test(src));
ok("item bars are clipped to the screen", /if \(!isOnScreen\(ox, oy, object\.scale \+ 40\)\) continue;/.test(src));
ok("reload bars read the weapon actually held",
   /const secondaryOut = tmpObj\.weaponIndex >= 9;/.test(src));
ok("...matching doWeaponStuff's own split",
   /if \(player\.weaponIndex < 9\) \{/.test(src));
ok("turret bar is drawn only while the turret is down",
   /if \(tRaw !== undefined && tRaw < 1\) drawBar/.test(src));
ok("both overlay toggles default off",
   /reloadBars: false,/.test(src) && /itemHealthBar: false,/.test(src));
ok("nothing from the reverted round is left behind",
   !/autoAccept|spectateOnDeath|ghostRoam|enterSpectate/.test(src));

console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
process.exit(failures ? 1 : 0);
