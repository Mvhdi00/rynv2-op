// Checks the three feature groups added to YoRHa_System_replace_falcon.user.js:
// manual insta, auto-accept clan requests, spectate on death, and the two
// overlay toggles (reload bars / item HP bars).
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

console.log("\nauto-accept clan requests");
let allianceNotifications = [];
let sent = [], notifRedraws = 0;
function aJoinReq(join) { sent.push({ sid: allianceNotifications[0].sid, join: join }); allianceNotifications.splice(0, 1); }
function updateNotifications() { notifRedraws++; }
eval(lift("allianceNotification"));

window.vars = { autoAccept: false };
allianceNotifications = []; sent = []; notifRedraws = 0;
allianceNotification(7, "someone");
ok("off: nothing is sent", sent.length === 0);
ok("off: the request is queued for the buttons", allianceNotifications.length === 1);
ok("off: the notification is redrawn", notifRedraws === 1);

window.vars = { autoAccept: true };
allianceNotifications = []; sent = []; notifRedraws = 0;
allianceNotification(7, "someone");
ok("on: the request is answered", sent.length === 1 && sent[0].join === 1);
ok("on: with the right sid", sent[0].sid === 7);
ok("on: the queue is left empty", allianceNotifications.length === 0);

// Requests that piled up while the toggle was off must not be stranded.
window.vars = { autoAccept: false };
allianceNotifications = []; sent = [];
allianceNotification(1, "a"); allianceNotification(2, "b");
window.vars.autoAccept = true;
allianceNotification(3, "c");
ok("on: drains the whole backlog, not just the newest", sent.length === 3, JSON.stringify(sent));
ok("...in arrival order", sent.map(s => s.sid).join(",") === "1,2,3");
ok("...all accepted", sent.every(s => s.join === 1));

// This runs inside the packet handler, so the drain is capped rather than
// trusted. Past the cap the leftovers fall through to the normal buttons.
window.vars = { autoAccept: true };
allianceNotifications = []; sent = []; notifRedraws = 0;
for (let i = 0; i < 40; i++) allianceNotifications.push({ sid: 100 + i, name: "x" });
allianceNotification(999, "last");
ok("on: the drain is bounded", sent.length === 32, String(sent.length));
ok("...and the remainder still reaches the buttons",
   allianceNotifications.length === 9 && notifRedraws === 1);

console.log("\nspectate on death");
const el = () => ({ style: {} });
let diedText = el(), gameUI = el(), menuCardHolder = el(), mainMenu = el();
let RynBots = null;
eval(lift("enterSpectate"));
eval(lift("onSpectateEnd"));

RynBots = { list: [], possessed: null, possess() { this.possessed = null; } };
ok("no bots at all: refuses, so the death menu still runs", enterSpectate() === false);

RynBots = { list: [{ alive: false, ws: { readyState: 1 } }], possessed: null, possess() {} };
ok("only dead bots: refuses", enterSpectate() === false);

RynBots = { list: [{ alive: true, ws: { readyState: 3 } }], possessed: null, possess() {} };
ok("bot alive but socket closed: refuses", enterSpectate() === false);

// possess() finding nobody must not leave us claiming a seat we never took.
RynBots = { list: [{ alive: true, ws: { readyState: 1 } }], possessed: null, possess() {} };
ok("possess() that seats nobody: refuses", enterSpectate() === false);

const bot = { alive: true, ws: { readyState: 1 } };
RynBots = { list: [bot], possessed: null, possess() { this.possessed = bot; } };
diedText = el(); gameUI = el();
ok("live bot: takes the seat", enterSpectate() === true);
ok("...hides the DIED text", diedText.style.display === "none");
ok("...and puts the game HUD back up", gameUI.style.display === "block");

RynBots = null;   // bots never loaded at all
ok("no bot system: refuses instead of throwing", enterSpectate() === false);

myPlayer = { alive: false };
gameUI = el(); menuCardHolder = el(); mainMenu = el();
onSpectateEnd();
ok("released while dead: respawn menu comes back",
   menuCardHolder.style.display === "block" && mainMenu.style.display === "block");
ok("...and the HUD goes away", gameUI.style.display === "none");

myPlayer = { alive: true };
gameUI = el(); menuCardHolder = el(); mainMenu = el();
onSpectateEnd();
ok("released while alive: menu is NOT forced up", menuCardHolder.style.display === undefined);

console.log("\nsource-level guarantees");
ok("manual insta is bound to its own key", /keyStr === window\.vars\.keyInsta/.test(src));
ok("the key has a default and a menu entry",
   /keyInsta: "R",/.test(src) && /id: "keyInsta"/.test(src));
ok("combo select offers every list in INSTA_COMBOS",
   Object.keys(INSTA_COMBOS).every(k => new RegExp('value: "' + k + '"').test(src)));
// Inside killPlayer, the spectate attempt has to come BEFORE the timer that
// raises the respawn menu — and return, or the menu lands on top of the view.
const killPlayerSrc = lift("killPlayer");
const spectateAt = killPlayerSrc.indexOf("spectateOnDeath && enterSpectate()) return;");
const menuAt = killPlayerSrc.indexOf('menuCardHolder.style.display = "block";');
ok("spectate is asked for inside killPlayer", spectateAt > -1);
ok("...before the respawn-menu timer", spectateAt > -1 && menuAt > -1 && spectateAt < menuAt,
   spectateAt + " vs " + menuAt);
ok("releasing possession hands the menu back", /try \{ onSpectateEnd\(\); \} catch \(e\) \{\}/.test(src));
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
ok("all five toggles default off",
   /reloadBars: false,/.test(src) && /itemHealthBar: false,/.test(src) &&
   /autoAccept: false,/.test(src) && /spectateOnDeath: false,/.test(src));

console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
process.exit(failures ? 1 : 0);
