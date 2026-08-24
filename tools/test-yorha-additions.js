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
let ghostRoam = false, ghostX = 0, ghostY = 0, ghostKeys = {};
let lastDeath = null;
const config = { mapScale: 14400 };
const GHOST_MOVE = eval("(" + liftObjectLiteral("GHOST_MOVE") + ")");
eval(lift("ghostMoveAngle"));
eval(lift("enterSpectate"));
eval(lift("onSpectateEnd"));

function resetGhost() {
    ghostRoam = false; ghostX = 0; ghostY = 0; ghostKeys = {};
    diedText = el(); gameUI = el(); menuCardHolder = el(); mainMenu = el();
    myPlayer = { alive: false, x: 100, y: 200 };
    lastDeath = null;
}

const bot = { alive: true, ws: { readyState: 1 } };
resetGhost();
RynBots = { list: [bot], possessed: null, possess() { this.possessed = bot; } };
ok("live bot: takes the seat", enterSpectate() === true);
ok("...hides the DIED text", diedText.style.display === "none");
ok("...and puts the game HUD back up", gameUI.style.display === "block");
ok("...and does NOT start the free camera", ghostRoam === false);

// Every bot path that cannot seat you falls through to the ghost camera —
// none of them may hand back false, because false leaves the death menu to
// run over a screen that spectate already took.
resetGhost();
RynBots = { list: [], possessed: null, possess() {} };
ok("no bots: falls back to the free camera", enterSpectate() === true && ghostRoam === true);

resetGhost();
RynBots = { list: [{ alive: false, ws: { readyState: 1 } }], possessed: null, possess() {} };
ok("only dead bots: free camera", enterSpectate() === true && ghostRoam === true);

resetGhost();
RynBots = { list: [{ alive: true, ws: { readyState: 3 } }], possessed: null, possess() {} };
ok("bot alive but socket closed: free camera", enterSpectate() === true && ghostRoam === true);

resetGhost();
RynBots = { list: [{ alive: true, ws: { readyState: 1 } }], possessed: null, possess() {} };
ok("possess() that seats nobody: free camera", enterSpectate() === true && ghostRoam === true);

resetGhost(); RynBots = null;
ok("no bot system at all: free camera", enterSpectate() === true && ghostRoam === true);

console.log("\nghost camera");
resetGhost(); RynBots = null; lastDeath = { x: 4000, y: 5000 };
enterSpectate();
ok("starts where you fell", ghostX === 4000 && ghostY === 5000);
resetGhost(); RynBots = null;
enterSpectate();
ok("falls back to your body when there is no death mark",
   ghostX === 100 && ghostY === 200);
ok("the HUD is hidden — there is nothing of yours to show", gameUI.style.display === "none");

ghostKeys = {};
ok("no keys held: no drift", ghostMoveAngle() === null);
ghostKeys[87] = 1;
ok("W goes up", ghostMoveAngle() === Math.atan2(-1, 0));
ghostKeys = { 68: 1 };
ok("D goes right", ghostMoveAngle() === 0);
ghostKeys = { 87: 1, 68: 1 };
ok("W+D is a diagonal", Math.abs(ghostMoveAngle() - Math.atan2(-1, 1)) < 1e-12);
ghostKeys = { 87: 1, 83: 1 };
ok("opposite keys cancel", ghostMoveAngle() === null);
ghostKeys = { 38: 1, 37: 1, 39: 1, 40: 1 };
ok("arrows do not steer — Up is the way out", ghostMoveAngle() === null);
ok("...and are absent from the move table",
   !GHOST_MOVE[38] && !GHOST_MOVE[37] && !GHOST_MOVE[39] && !GHOST_MOVE[40]);

resetGhost(); RynBots = null; enterSpectate();
ghostKeys[87] = 1;
onSpectateEnd();
ok("leaving clears the roam flag", ghostRoam === false);
ok("...and the held keys, so nothing leaks into your respawn",
   Object.keys(ghostKeys).length === 0);
ok("...and brings the respawn menu back",
   menuCardHolder.style.display === "block" && mainMenu.style.display === "block");

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

// The keydown handler is one else-if chain. The vanilla game keys in it are
// matched by RAW keyNum, so any of them bound to a mod feature is swallowed
// before the chain reaches a keyStr test — the key just silently does its
// vanilla thing. These checks keep every default clear of that, and keep the
// manual-insta test ahead of the raw ones so an explicit rebind still wins.
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
// Inside killPlayer, the spectate attempt has to come BEFORE the timer that
// raises the respawn menu — and return, or the menu lands on top of the view.
const killPlayerSrc = lift("killPlayer");
const spectateAt = killPlayerSrc.indexOf("spectateOnDeath && enterSpectate()) return;");
const menuAt = killPlayerSrc.indexOf('menuCardHolder.style.display = "block";');
ok("spectate is asked for inside killPlayer", spectateAt > -1);
ok("...before the respawn-menu timer", spectateAt > -1 && menuAt > -1 && spectateAt < menuAt,
   spectateAt + " vs " + menuAt);
ok("releasing possession hands the menu back", /try \{ onSpectateEnd\(\); \} catch \(e\) \{\}/.test(src));

// The keydown and keyup bodies both sit behind `myPlayer && myPlayer.alive`.
// Ghost input handled inside those would never run — the camera would not move
// and Up would not release, stranding you over a dead map with no menu. Both
// ghost branches must come FIRST.
const kd = src.slice(src.indexOf("let keyStr = event.code;"));
ok("ghost keydown is ahead of the alive gate",
   kd.indexOf("} else if (ghostRoam) {") > -1 &&
   kd.indexOf("} else if (ghostRoam) {") < kd.indexOf("} else if (myPlayer && myPlayer.alive && keysActive())"));
const ku = src.slice(src.indexOf("if (ghostKeys[gUp]) ghostKeys[gUp] = 0;") - 400);
ok("ghost keyup is ahead of its alive gate",
   ku.indexOf("if (ghostRoam) {") < ku.indexOf("if (myPlayer && myPlayer.alive) {"));
ok("ghost keeps its own key map, not the game's",
   /ghostKeys\[gNum\] = 1;/.test(src) && !/(?<!ghost)keys\[gNum\]/.test(src));
ok("respawning any other way still drops the roam flag",
   /if \(ghostRoam && myPlayer && myPlayer\.alive\) \{ ghostRoam = false; ghostKeys = \{\}; \}/.test(src));
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
