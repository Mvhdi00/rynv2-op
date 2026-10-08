/* Boots the 2025 game in a real browser, with and without RYN, and plays it.
 *
 *   node boot-2025.js [vanilla|fast|late|all] [ryn.js]
 *
 * The last update was "verified" by reading hook patterns against the bundle's
 * text, and the very first thing RYN does with that text — turn an ES module
 * into something Function() can run — was never executed. It threw on the
 * second `import`, the game never started, and every check stayed green. This
 * one runs it: the real bundle and vendor, served as ES modules from
 * https://moomoo.io/assets/ through an import map, exactly the way the page
 * loads them, and drives the result through the menu, a join and a spawn.
 *
 * Faked, because this container cannot reach moomoo.io:
 *   - the page HTML, synthesised from the ids the bundle reaches for;
 *   - `moomoo-protocol` (BUILD_ID / mixKey / BUILD_SALT), a stub module;
 *   - the FRVR SDK, a stub with the auth surface the sign-in UI calls;
 *   - api-prod2.moomoo.io (/servers, /join, /name-check), Turnstile;
 *   - the game server, harness/server.js behind routeWebSocket (unpinned).
 *
 * Modes:
 *   vanilla  no RYN — the control. If this fails the harness is wrong.
 *   fast     RYN at document-start before <head> exists (loadedFast): the
 *            bundle's <script> is removed before it runs, RYN runs its copy.
 *   late     RYN after <head> was parsed — what the console in the report
 *            shows (win.requestAnimFrame -> Injector.init). The page's own
 *            module has already run by then; RYN's copy takes over its loop.
 *
 * Flags, joined with "+" (late+grind+quiet):
 *   pinned       the server pins the session (mask, mixKey, salted tables)
 *   interactive  every Turnstile challenge wants a click
 *   hidpi        150% display scaling
 *   reshaped     the bundle's crypto code reshaped the way the obfuscator
 *                reshapes it between builds (bots must still join)
 *   grind        Auto Grind on, the server playing the swing (server.js sim)
 *   trap         Trap Animal on, a 2025 boar standing still a step away
 *   kill         the rival dies to me: no sign-in prompt, RYN keeps drawing
 *   visuals      every Visual option on, a kill under each kill animation
 *   heal         the server hurts me: Auto Heal has to eat
 *   slowclick    a bot's check wants a click, answered only after 25 s
 *   silentname   the server ignores a bot's spawn under one name, silently
 *   kickname     the server turns a bot away by name, saying why ("B")
 *   tserror      a bot's Cloudflare check fails outright
 *   hats         I wear a hat (Bull Helmet), and the store is opened: every
 *                picture in it loads, and the hat is drawn on me
 *   spritefail   the site answers 503 the first time each hat and weapon is
 *                asked for (with +hats: they still come)
 *   restyled     the bundle's grid and name-colour code written another way,
 *                so RYN's hooks for them find nothing (the live build): the
 *                grid must still go, and my name must still take my colour
 *   signedin     I am signed in to an account: my join goes through on it, and
 *                the game never loads Cloudflare's script (the live build) —
 *                a bot still needs a check, and RYN has to load it
 *   oddname      with restyled: the renderer is handed my name in a form RYN
 *                cannot recognise as mine, so only RYN's own redraw of it,
 *                from the player, can colour it
 *   boss         a Crab King (2025 boss) above me: its health bar and number go
 *                under it, like any animal's, not across the top of the screen
 *   lag          every frame takes 45 ms each way (a 90 ms ping)
 *   quiet        the server sends no player update on a tick with no change
 *   heartbeat    quiet, but an empty update once a second
 *   members      the join API turns the bot away: a signed-in players' server
 *   busy         the join API answers the bot's first join "too many"
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { chromium } = require("playwright");
const server = require("./server");

/* The game's sprites (/img/...): solid 16x16 PNGs in colours nothing else in
 * the scene is — hats magenta, weapons cyan, accessories orange, the rest
 * yellow — so a sprite that is drawn can be found on screen, and told from
 * one that failed. */
const spritePng = rgb => {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1;
    return c >>> 0;
  });
  const crc = buf => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 255] ^ c >>> 8;
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4), sum = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const W = 16, H = 16, ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw.set([rgb[0], rgb[1], rgb[2], 255], y * (W * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};
const SPRITES = { hats: spritePng([255, 0, 255]), weapons: spritePng([0, 255, 255]), accessories: spritePng([255, 128, 0]), other: spritePng([255, 255, 0]) };
let wireCache = null;
const wire = () => wireCache || (wireCache = require("./proto-2025")());

const ROOT = path.resolve(__dirname, "..");
const FIX = path.join(__dirname, "fixtures");
const which = process.argv[2] || "all";
const RYN_PATH = path.resolve(process.argv[3] || path.join(ROOT, "ryn/Ryn_Type_2.user.js"));

const INDEX = "index-cfaab428.js";
const VENDOR = "vendor-a3a301f0.js";
const PROTO = "protocol-5f1c2b.js";
const bundle = fs.readFileSync(path.join(FIX, "moomoo_index_new.js"), "utf8");
const vendor = fs.readFileSync(path.join(FIX, "moomoo_vendor_new.js"), "utf8");

// ── the page ──────────────────────────────────────────────────────────────
const ids = [];
for (const m of bundle.matchAll(/getElementById\("([^"]+)"\)/g)) if (!ids.includes(m[1])) ids.push(m[1]);
// and through the bundle's own `Re = id => document.getElementById(id)` (the
// account / sign-in card, new in 2025)
for (const a of bundle.matchAll(/(?:const |let |,|function )([\w$]+)(?:=function)?\((\w)\)\{return document\.getElementById\(\2\)\}/g))
  for (const m of bundle.matchAll(new RegExp("[^\\w$.]" + a[1].replace(/\$/g, "\\$") + "\\(\"([^\"]+)\"\\)", "g")))
    if (!ids.includes(m[1])) ids.push(m[1]);
const CANVAS = new Set(["gameCanvas", "mapDisplay"]);
const CHECK = new Set(["nativeResolution", "showPing", "showFps", "playMusic"]);
const TEXT = new Set(["nameInput", "chatBox", "allianceInput", "friendName", "accountEmail", "accountCode", "accountPassword"]);
/* Where things sit. The real 2025 index.html is not available here, so this is
 * a guess — but a deliberate one: the menu's controls and the 2025 overlays
 * (account card, human-check dialog) are put INSIDE #mainMenu, which is the
 * container RYN sweeps and hides. A page that left them loose would let a
 * client that hides the sign-in card pass the sign-in check. */
const PARENT = {
  menuCardHolder: "mainMenu", setupCard: "menuCardHolder",
  nameInput: "setupCard", enterGame: "setupCard", signInButton: "setupCard", signInHint: "setupCard",
  accountRow: "setupCard", serverBrowser: "setupCard", regionSelect: "serverPicker", serverSelect: "serverPicker",
  serverPicker: "setupCard", serverNote: "setupCard", skinColorHolder: "setupCard", nameHint: "setupCard",
  accountCard: "mainMenu", verifyBackdrop: "mainMenu", verifyDialog: "mainMenu",
  turnstileWidget: "verifyDialog", verifyText: "verifyDialog", verifyRetry: "verifyDialog", verifyClose: "verifyDialog",
  accountTitle: "accountCard", accountNote: "accountCard", accountEmail: "accountCard", accountCode: "accountCard",
  accountPassword: "accountCard", accountStatus: "accountCard", accountSubmit: "accountCard",
  accountLinkA: "accountCard", accountLinkB: "accountCard", accountClose: "accountCard",
  promoImgHolder: "mainMenu", promoImg: "promoImgHolder", menuNotice: "mainMenu",
  // the menu's own nav links, written out in #menuNav (MENU_DIALOG)
  clanNav: "menuNav", friendsNav: "menuNav", menuDialog: "mainMenu",
  clanName: "clanCard", clanStatus: "clanCard", clanBody: "clanCard", clanClose: "clanCard",
};
if (!ids.includes("setupCard")) ids.push("setupCard");
const MENU_DIALOG = `<div id="menuNav"><a data-view="play">Play</a><a id="clanNav" data-view="clan">Clan</a><a id="friendsNav" data-view="friends">Friends</a><a data-view="settings">Settings</a></div>
<div class="menuView" data-view="play"><div class="viewBack"></div><div class="viewBody"></div></div>
<div class="menuView" data-view="settings"><div class="viewBack"></div><div class="viewBody"></div></div>
<div class="menuView" data-view="friends" style="display:none"><div class="viewBack">Back</div><div class="viewBody"><span class="friendsOnline">Friends online</span></div></div>`;
const tag = id => CANVAS.has(id) ? `<canvas id="${id}" width="1280" height="720"></canvas>`
  : CHECK.has(id) ? `<input id="${id}" type="checkbox">`
  : TEXT.has(id) ? `<input id="${id}" type="text" value="">`
  : id === "gameMenuTabs" ? `<div id="${id}"><a data-tab="settings"></a><a data-tab="clan"></a><a data-tab="friends"></a></div>`
  : id === "enterGame" ? `<div id="${id}" class="menuButton"><span>Enter Game</span></div>`
  // Empty, as Turnstile's container is on any page: the <span> every other
  // div gets made RYN's loading screen think a challenge was already in it,
  // so this page never showed that screen moving the container (and the
  // challenge with it) into a slot the 2025 game never reveals.
  : id === "turnstileWidget" ? `<div id="${id}"></div>`
  // the game's menu: its nav and its views live in #menuDialog, which is
  // where the bundle looks for them (zi.querySelectorAll("#menuNav a"))
  : id === "menuDialog" ? `<div id="${id}"><span></span>${MENU_DIALOG}${ids.filter(c => PARENT[c] === id).map(c => tag(c)).join("")}</div>`
  : `<div id="${id}"><span></span>${ids.filter(c => PARENT[c] === id).map(c => tag(c)).join("")}</div>`;

const FRVR_SDK = `
/* stand-in for the FRVR SDK: the surface the 2025 bundle calls, and a record
 * of every ad it was asked to show */
window.__ads = 0;
window.FRVR = {
  bootstrapper: { complete: function () { window.__bootstrapped = (window.__bootstrapped || 0) + 1; } },
  tracker: { levelStart: function () {}, levelEnd: function () {} },
  ads: { show: function () { window.__ads++; return Promise.resolve(); } },
  channelCharacteristics: { allowNavigation: true },
  setChannel: function () {},
  profile: { name: function () { return "frvr-user"; } },
  auth: {
    _in: false, _l: [],
    isLoggedIn: function () { return this._in; },
    isVerified: function () { return this._in; },
    getFRVRID: function () { return this._in ? "frvr-1" : null; },
    getAccessToken: function () { return this._in ? "acc-token" : null; },
    getFreshAccessToken: function () { return Promise.resolve(this.getAccessToken()); },
    authenticatedFetch: function (url, opts) { return fetch(url, opts); },
    requestEmailLoginCode: function (e) { (window.__frvrCalls = window.__frvrCalls || []).push("requestEmailLoginCode:" + e); return Promise.resolve({}); },
    requestEmailRegisterCode: function (e) { (window.__frvrCalls = window.__frvrCalls || []).push("requestEmailRegisterCode:" + e); return Promise.resolve({}); },
    registerOnFRVR: function (o) { (window.__frvrCalls = window.__frvrCalls || []).push("registerOnFRVR:" + (o && o.email)); return Promise.resolve({}); },
    loginToFRVR: function (o) { (window.__frvrCalls = window.__frvrCalls || []).push("loginToFRVR"); return Promise.resolve({}); },
    addStatusChangeListener: function (f) { this._l.push(f); },
  },
  init: function () { return Promise.resolve(); },
};`;

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MooMoo.io</title>
<script type="importmap">{"imports":{"moomoo-protocol":"/assets/${PROTO}"}}</script>
<script src="https://cdn.frvr.com/sdk/frvr-sdk.min.js"></script>
<script>
  window.frvrSdkInitPromise = (window.FRVR ? window.FRVR.init({}) : Promise.reject(new Error("no sdk")))
    .catch(function (e) { console.error("[FRVR] sdk failed init", e); });
</script>
<script type="module" crossorigin src="/assets/${INDEX}"></script>
<link rel="modulepreload" crossorigin href="/assets/${VENDOR}">
<style>
html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
#gameCanvas { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; }
#touch-controls-fullscreen { position: fixed; inset: 0; z-index: 1; }
#enterGame, #nameInput { position: relative; z-index: 5; display: block; min-height: 30px; }
#menuContainer, #mainMenu, #menuCardHolder { position: relative; z-index: 10; }
/* the game's own stylesheet keeps these closed until it opens them */
#accountCard, #clanCard, #profileCard, #confirmCard { display: none; }
#verifyDialog:not(.showing), #verifyBackdrop:not(.showing) { display: none; }
#accountCard input, #accountSubmit, #accountClose, #signInButton { display: inline-block; min-width: 60px; min-height: 20px; }
</style>
</head>
<body>
<div id="menuContainer">
${ids.filter(id => !PARENT[id]).map(tag).join("\n")}
<div class="staffPanel"></div><span class="noteDot"></span>
</div>
${Array.from({ length: 23 }, (_, i) => `<div id="actionBarItem${i}"></div>`).join("")}
</body>
</html>`;

/* moomoo-protocol, stubbed — with a mixKey that actually mixes, so a client
 * that calls it with the wrong key or seed (or not at all) is told so by the
 * server rather than passing because the stub handed its key straight back. */
const mixKeyStub = (key, seed) => {
  const out = new Uint8Array(key.length);
  for (let i = 0; i < key.length; i++) out[i] = key[i] ^ (seed >>> 8 * (i & 3) & 255) ^ (i * 29 & 255);
  return out;
};
const PROTOCOL_MODULE = `export const BUILD_ID = "test-build";
export const BUILD_SALT = 7;
export const mixKey = ${mixKeyStub.toString()};`;

/* The same game, written the way another build of the obfuscator might have
 * written it. Each rewrite changes nothing at run time — a quoted key, a
 * call through (0,f), an explicit `()` after `new`, a split string — and
 * each one takes away the shape one of RYN's crypto hooks recognises. The
 * live game is a newer build than the fixture, so this is what RYN has to
 * survive: the player's own connection must still be read, and a bot must
 * still join, with none of those hooks installed. */
function reshape(code) {
  const out = code
    .replace(/const (\w+)=new (\w+),(\w+)=new (\w+);let (\w+)=null/, "const $1=new $2(),$3=new $4();let $5=null")
    .replace(/=\{mode:(\w+),key:/, '={"mode":$1,"key":')
    .replace(/&&(\w+)\((\w+),(\w+)\((\w+)\[(\w+\(\d+,"[^"]*"\))\]\[(\w+\(\d+,"[^"]*"\))\],\+\+\4\[/, "&&(0,$1)($2,(0,$3)($4[$5][$6],++$4[")
    .replace(/\]\((\w+),(\w+\[\w+\(\d+,"[^"]*"\)\],\w+\),\w+=new Uint8Array\()/, "]($1 ,$2")
    .replace(/(\w+)\((\w+\[\w+\(\d+,"[^"]*"\)\+"ay"\]\(\w+\)),(\w+)\((\w+\[)/, "(0,$1)($2,(0,$3)($4")
    .replace(/\+"b=",(\w+)\)/, '+"b"+"=",$1)');
  return out;
}

/* The bundle's drawing code, written the way another build might write it:
 * the grid's alpha as 0.06 rather than .06, a name's colour in brackets. Each
 * changes nothing at run time, and each takes away the shape RYN's RenderGrid
 * and nameColor hooks look for — as the live build did: its grid stayed and
 * your name stayed white. */
/* +signedin: the game loads Cloudflare's script only for a player who needs
 * a check, and one signed in to an account does not (live build). */
function signedIn(code) {
  return code
    .replace(/\}il\(\);const (\w+)=document\.getElementById\("nameHint"\)/, '}window.__signedIn||il();const $1=document.getElementById("nameHint")')
    .replace(/(\.value=\w+\|\|"",\w+\(\),)il\(\)\}/, "$1window.__signedIn||il()}");
}

function restyle(code) {
  return code
    .replace(/(\.globalAlpha=)\.06(;const \w+=\w+\/18;for)/, "$10.06$2")
    .replace(/,(\w+)=(\w+)\?(\w+):"#fff",(\w+)=\{color:\1,/, ',$1=($2?$3:"#fff"),$4={color:$1,');
}

/* Cloudflare Turnstile, as far as the login depends on it:
 *
 *   - the script arrives late (TS_SCRIPT_MS), and loaded twice it keeps the
 *     first copy and warns;
 *   - a second render into a container that already holds a widget is
 *     refused — it warns and returns undefined;
 *   - a challenge takes time to solve (TS_SOLVE_MS) and runs in an iframe,
 *     and an iframe that changes parent is reloaded from scratch: the
 *     challenge in it starts over (counted in __tsReloads);
 *   - `+interactive`: every challenge wants a click. A person can only click
 *     what they can see, so the harness answers a challenge only when its
 *     frame is on screen and on top (see answerChallenge). "interaction-only"
 *     widgets have no size until then, as Cloudflare's do. */
const TS_SCRIPT_MS = 500;
const TS_SOLVE_MS = 900;
const TURNSTILE = (interactive, errorBots) => `(function () {
  window.__tsLoads = (window.__tsLoads || 0) + 1;
  if (window.turnstile && window.turnstile.__harness) {
    console.warn("[Cloudflare Turnstile] Turnstile already has been loaded. Was Turnstile imported multiple times?");
    return;
  }
  const INTERACTIVE = ${!!interactive};
  const seen = new WeakSet(), widgets = new Map();
  let n = 0;
  const run = w => {
    clearTimeout(w.timer);
    w.token = null;
    if (INTERACTIVE && !w.clicked) {
      w.needsClick = true;
      w.frame.style.width = "300px";
      w.frame.style.height = "65px";
      try { w.o["before-interactive-callback"] && w.o["before-interactive-callback"](); } catch (e) {}
      return;
    }
    w.timer = setTimeout(function () {
      if (!w.frame.isConnected || !widgets.has(w.id)) return;
      w.token = "cf-token-" + (window.__tsTokens = (window.__tsTokens || 0) + 1);
      try { w.o.callback && w.o.callback(w.token); } catch (e) { console.error(e); }
    }, ${TS_SOLVE_MS});
  };
  window.turnstile = {
    __harness: true,
    render: function (el, o) {
      window.__tsRenders = (window.__tsRenders || 0) + 1;
      if (typeof el === "string") el = document.querySelector(el);
      if (seen.has(el)) {
        console.warn("[Cloudflare Turnstile] Turnstile has already been rendered in this container.");
        window.__tsRefused = (window.__tsRefused || 0) + 1;
        return undefined;
      }
      if (/\\/assets\\/index-[^/]*\\.js/.test(new Error().stack || "")) window.__tsByPage = (window.__tsByPage || 0) + 1;
      seen.add(el);
      const id = "ts" + (++n);
      // +tserror: a check that is not the game's own fails outright
      if (${!!errorBots} && !(el && el.id === "turnstileWidget")) {
        setTimeout(function () { try { o && o["error-callback"] && o["error-callback"](); } catch (e) {} }, 300);
        return id;
      }
      const frame = document.createElement("iframe");
      frame.className = "cf-turnstile-frame";
      frame.style.cssText = "border:0;display:block;" + (o && o.appearance === "interaction-only" ? "width:0;height:0;" : "width:300px;height:65px;");
      const w = { id: id, el: el, o: o || {}, frame: frame, loads: 0, clicked: false, needsClick: false, token: null, timer: 0 };
      widgets.set(id, w);
      frame.addEventListener("load", function () {
        w.loads++;
        if (w.loads > 1) {
          // moved: a new document, a new challenge
          window.__tsReloads = (window.__tsReloads || 0) + 1;
          w.clicked = false;
        }
        try {
          frame.contentDocument.addEventListener("click", function () {
            if (!w.needsClick) return;
            w.needsClick = false;
            w.clicked = true;
            window.__tsClicked = (window.__tsClicked || 0) + 1;
            try { w.o["after-interactive-callback"] && w.o["after-interactive-callback"](); } catch (e) {}
            run(w);
          });
        } catch (e) {}
        run(w);
      });
      el.appendChild(frame);
      return id;
    },
    reset: function (id) { const w = widgets.get(id); if (w) { w.clicked = false; run(w); } },
    remove: function (id) { const w = widgets.get(id); if (w) { clearTimeout(w.timer); widgets.delete(id); seen.delete(w.el); w.frame.remove(); } },
    getResponse: function (id) { const w = widgets.get(id); return w ? w.token : undefined; },
  };
  // challenges waiting on a click, and whether a person could make it
  window.__tsPending = function () {
    return [...widgets.values()].filter(function (w) { return w.needsClick && w.frame.isConnected; }).map(function (w) {
      const r = w.frame.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { id: w.id, x: x, y: y, w: Math.round(r.width), h: Math.round(r.height),
               onTop: r.width > 0 && r.height > 0 && document.elementFromPoint(x, y) === w.frame,
               where: (w.frame.parentElement && w.frame.parentElement.parentElement || {}).id || "" };
    });
  };
})();`;

const SERVERS = [
  { region: "us-east", name: "1", key: "abc1", playerCount: 12, playerCapacity: 40 },
  { region: "us-east", name: "2", key: "abc2", playerCount: 30, playerCapacity: 40 },
  { region: "eu-west", name: "1", key: "def1", playerCount: 5, playerCapacity: 40 },
  { region: "eu-west", name: "9", key: "def9", playerCount: 3, playerCapacity: 40, auth: true },
];

// ── one run ───────────────────────────────────────────────────────────────
async function run(spec) {
  const [mode, ...flags] = spec.split("+");
  const pinned = flags.includes("pinned");
  /* +slowclick: a bot's challenge wants a click, and the person takes 25
   * seconds to get to it — past the 20 a bot's check used to wait. */
  const slowclick = flags.includes("slowclick");
  /* +silentname: the server ignores a bot that spawns as bot1101 — not a word,
   * just no spawn. The bot has to notice, say so, and come back as bot1201. */
  const silentname = flags.includes("silentname");
  // +kickname: the server turns the bot away by name, saying why ("B")
  const kickname = flags.includes("kickname");
  /* +tserror: a bot's Cloudflare check fails. No token, no bot — and it must
   * not reach for yours, which your own join has already spent. */
  const tserror = flags.includes("tserror");
  const interactive = flags.includes("interactive") || slowclick;
  const reshaped = flags.includes("reshaped");
  const restyled = flags.includes("restyled");
  const signedin = flags.includes("signedin");
  const oddname = flags.includes("oddname");
  const boss = flags.includes("boss");
  // +lag: 45 ms each way, a 90 ms ping (NET_DELAY_MS sets any other)
  const laggy = flags.includes("lag");
  const hats = flags.includes("hats");
  const spritefail = flags.includes("spritefail");
  /* +members / +busy (or JOIN_REFUSE=members|busy): the join API refuses the
   * bot the way the live one can —
   * "members" answers every join after the player's with 403 {error:"auth"}
   * (a server for signed-in players; bots are guests), "busy" answers the
   * bot's first join with 429. */
  const joinRefuse = flags.includes("members") ? "members" : flags.includes("busy") ? "busy" : process.env.JOIN_REFUSE || null;
  let served = reshaped ? reshape(bundle) : bundle;
  if (reshaped && served === bundle) throw new Error("reshape changed nothing");
  if (signedin) {
    const before = served;
    served = signedIn(served);
    if ((served.match(/window\.__signedIn\|\|il\(\)/g) || []).length !== 2) throw new Error("signedIn did not take");
  }
  if (restyled) {
    served = restyle(served);
    if (!served.includes(".globalAlpha=0.06;const") || !/=\(\w+\?\w+:"#fff"\),\w+=\{color:/.test(served))
      throw new Error("restyle did not take");
  }
  if (oddname) {
    const before = served;
    served = served.replace(/M\.text\(p\.name\|\|"",/, 'M.text((p.name||"")+"\u200b",');
    if (served === before) throw new Error("oddname did not take");
  }
  // 150% display scaling: the game draws at the device pixel ratio ("native
  // resolution", on by default), so its canvas has more pixels than CSS px.
  const hidpi = flags.includes("hidpi");
  /* Auto Grind on, my own turrets in reach, and the server playing the
   * swing by the game's rules (server.js `sim`): how often does it hit?
   * +quiet: the server says nothing on a tick where nothing changed (no
   * player update at all), so standing still grinding, the updates stop. */
  const grind = flags.includes("grind");
  const quiet = flags.includes("quiet") || process.env.SIM_QUIET === "1";
  // +heartbeat: quiet, except for an empty update once a second
  const heartbeat = flags.includes("heartbeat") ? 1000 : 0;
  /* Trap Animal on, a pit trap in the bar, and a boar — one of the 2025
   * animals — standing a step away: announced once, never updated, the way
   * the 2025 server leaves an animal that is not moving. Then the boar goes
   * and a crab takes its place, which no trap can hold. */
  const trap = flags.includes("trap");
  /* +kill: the rival dies to me (server.js session.killFoe). Watched for
   * three seconds after: nothing asks you to sign in, and RYN keeps drawing —
   * its corpse and kill animation run on exactly this. */
  const kill = flags.includes("kill");
  /* +visuals: every option on RYN's Visual page switched on, the ones off by
   * default included, and the rival killed once under each of the twenty kill
   * animations in turn. Each of them draws the victim through the game's own
   * player drawer; all of them went through the sign-in card's opener instead
   * before renderPlayer was pinned. */
  const visuals = flags.includes("visuals");
  /* +heal: the server takes my health down to 60 (a hit, "O" for my sid).
   * Auto Heal is on by default; it has to eat. */
  const heal = flags.includes("heal");
  const out = { mode: spec, base: mode, pinned, interactive, joinRefuse, signedin, errors: [], consoleErrors: [], sockets: [], joins: [], frames: [], notes: [], swings: [], simEvents: [] };
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: hidpi ? 1.5 : 1 });
  const page = await context.newPage();

  page.on("pageerror", e => out.errors.push(String(e && e.stack || e).split("\n").slice(0, 4).join(" | ")));
  page.on("console", m => {
    if (m.type() === "error") out.consoleErrors.push(m.text().slice(0, 300));
    if (/\[RYN\] render hook failed/.test(m.text())) (out.renderFaults = out.renderFaults || []).push(m.text().slice(0, 240));
    if (process.env.VERBOSE) console.log("    [console." + m.type() + "] " + m.text().slice(0, 300));
  });

  const ryn = fs.readFileSync(RYN_PATH, "utf8");
  let html = PAGE;
  if (mode === "late") {
    // A userscript manager that injects once <head> exists: the module tag has
    // already been parsed (and so will run), loadedFast is false.
    // A function replacement: the client's own text contains `$&` and `$\``,
    // which a string replacement would expand.
    html = html.replace("</head>", () => "<script>" + ryn.replace(/<\/script/gi, "<\\/script") + "</script>\n</head>");
  }

  await context.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    const send = (body, type, status) => route.fulfill({ status: status || 200, contentType: type, body,
      headers: { "access-control-allow-origin": "*" } });
    if (url.hostname === "moomoo.io") {
      if (url.pathname === "/" ) return send(html, "text/html");
      if (url.pathname === "/assets/" + INDEX) return send(served, "text/javascript");
      if (url.pathname === "/assets/" + VENDOR) return send(vendor, "text/javascript");
      if (url.pathname === "/assets/" + PROTO) return send(PROTOCOL_MODULE, "text/javascript");
      // the game's own sprites, served as the live site serves them
      if (/^\/img\/.+\.png$/.test(url.pathname)) {
        (out.sprites = out.sprites || []).push(url.pathname);
        /* +spritefail: the first time a hat or a weapon is asked for, the
         * site answers 503 — a moment it was busy. The game asks once. */
        if (spritefail && new RegExp("^/img/(" + (process.env.SPRITEFAIL_KINDS || "hats|weapons") + ")/").test(url.pathname)) {
          out.spriteFirst = out.spriteFirst || new Set();
          if (!out.spriteFirst.has(url.pathname)) {
            out.spriteFirst.add(url.pathname);
            out.spriteFails = (out.spriteFails || 0) + 1;
            return route.fulfill({ status: 503, contentType: "text/html", body: "<h1>busy</h1>" });
          }
        }
        // debug aid: a slow site rather than a refusing one
        if (process.env.SPRITE_DELAY && /^\/img\/hats\//.test(url.pathname)) await new Promise(r => setTimeout(r, +process.env.SPRITE_DELAY));
        const kind = /^\/img\/(hats|weapons|accessories)\//.exec(url.pathname);
        return route.fulfill({ status: 200, contentType: "image/png", body: SPRITES[kind ? kind[1] : "other"] });
      }
      return send("", "text/plain", 404);
    }
    if (url.hostname === "cdn.frvr.com") return send(signedin ? FRVR_SDK.replace("_in: false", "_in: true") : FRVR_SDK, "text/javascript");
    if (url.hostname === "challenges.cloudflare.com") {
      await new Promise(r => setTimeout(r, TS_SCRIPT_MS));
      return send(TURNSTILE(interactive, tserror), "text/javascript");
    }
    if (url.hostname === "api.moomoo.io") {
      // the pre-2025 API host. The 2025 bundle on moomoo.io talks to
      // api-prod2 (api-<prod|sandbox>2); anything still asking here is stale.
      out.oldApi = (out.oldApi || []).concat(url.pathname);
      return send("", "application/json");
    }
    if (url.hostname === "api-prod2.moomoo.io") {
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: {
        "access-control-allow-origin": "*", "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET,POST" } });
      if (url.pathname === "/servers") return send(JSON.stringify(SERVERS), "application/json");
      if (url.pathname === "/join") {
        let body = {};
        try { body = JSON.parse(req.postData() || "{}"); } catch (e) {}
        out.joins.push(body);
        const n = out.joins.length;
        const refuse = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body),
          headers: { "access-control-allow-origin": "*" } });
        if (n >= 2 && joinRefuse === "members") return refuse(403, { error: "auth" });
        if (n === 2 && joinRefuse === "busy") return refuse(429, { error: "rate" });
        /* A Cloudflare token is good once: the API's siteverify refuses one
         * it has seen, and the join answers 403. A bot that falls back on
         * your token — already spent on your own join — is refused here as
         * it would be live. */
        out.captchas = out.captchas || new Set();
        if (body.captcha && out.captchas.has(body.captcha)) { out.reused = (out.reused || 0) + 1; return refuse(403, {}); }
        if (body.captcha) out.captchas.add(body.captcha);
        // a device id for a first join, the one it sent back for a later one
        return send(JSON.stringify({ ticket: "T" + n, did: body.did || "did-" + n }), "application/json");
      }
      /* Names that belong to someone. The bot the harness adds is typed as
       * "bot1", so slot 1 makes it bot11 — taken here, so a bot has to step
       * past it to bot1101. */
      if (url.pathname === "/name-check") {
        const name = url.searchParams.get("name") || "";
        (out.nameChecks = out.nameChecks || []).push(name);
        return send(JSON.stringify(name === "bot11" ? { reserved: true } : {}), "application/json");
      }
      if (url.pathname === "/top") return send(JSON.stringify({ players: [], clans: [] }), "application/json");
      if (url.pathname === "/clan/mine") return send(JSON.stringify({ clan: null, role: null, invites: [], requests: [] }), "application/json");
      return send("{}", "application/json");
    }
    if (/\.moomoo\.io$/.test(url.hostname) && url.pathname === "/ping") return send("ok", "text/plain");
    out.aborted = (out.aborted || []).concat(req.url().slice(0, 120));
    return route.abort();
  });

  out.conns = [];
  await context.routeWebSocket(/^wss:\/\/[^/]*moomoo\.io/, ws => {
    out.sockets.push(ws.url());
    const conn = { url: ws.url(), letters: [], violations: [] };
    out.conns.push(conn);
    const handlers = { message: [], close: [] };
    /* NET_DELAY_MS: each way, for every frame — a ping of twice that. The
     * container's own is near zero, which hides anything that only goes
     * wrong when a frame takes as long as a real one does. */
    const lag = +(process.env.NET_DELAY_MS || (laggy ? 45 : 0));
    const later = fn => lag ? setTimeout(fn, lag) : fn();
    const sock = {
      send: buf => { const b = Buffer.from(buf); later(() => { try { ws.send(b); } catch (e) {} }); },
      on: (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); },
      close: (code, reason) => { try { ws.close({ code, reason }); } catch (e) {} },
    };
    ws.onMessage(m => { const b = typeof m === "string" ? Buffer.from(m) : m; later(() => handlers.message.forEach(f => f(b))); });
    ws.onClose(() => handlers.close.forEach(f => f()));
    server.attach(sock, (...a) => {
      out.frames.push(a.join(" ").slice(0, 160));
      conn.letters.push(a[1]);
      if (a[0] === "c2s" && a[1] === "M" && conn.spawnName === undefined) {
        const m = /"name":"([^"]*)"/.exec(String(a[3] || ""));
        conn.spawnName = m ? m[1] : null;
      }
      if (a[0] === "c2s" && a[1] === "M" && out.conns[0] === conn && !out.spawnAt) out.spawnAt = Date.now();
      if (a[0] === "c2s" && a[1] === "M" && !conn.spawnAt) conn.spawnAt = Date.now();
    }, {
      requireSpawn: true,
      proto: 2025,
      sim: (grind || trap) && out.conns.length === 1 ? out.sim = {
        positions: process.env.SIM_POSITIONS || "always",
        quiet: quiet || !!heartbeat,
        heartbeat,
        trap,
        // Tank Gear (40) owned: Auto Grind wears it to hit buildings harder
        hats: process.env.SIM_HATS === "none" ? [] : [40],
        latch: process.env.SIM_LATCH !== "0",
        onSwing: (t, weapon, hit) => out.swings.push([t, weapon, hit]),
        onEvent: what => out.simEvents.push([Date.now(), what]),
      } : null,
      pinned,
      crypto: pinned ? wire() : null,
      mixKey: mixKeyStub,
      onSession: session => { if (out.conns[0] === conn) out.session = session; },
      ignoreNames: silentname && out.conns[0] !== conn ? ["bot1101"] : [],
      kickNames: kickname && out.conns[0] !== conn ? { bot1101: "This name belongs to someone else" } : {},
      onSpawned: name => { conn.spawnedAs = name; },
      // +hats: I wear the Bull Helmet
      mySkin: hats && out.conns[0] === conn ? 7 : 0,
      foeAway: hats || boss,
      boss: boss && out.conns[0] === conn,
      onViolation: (why, detail) => {
        conn.violations.push(why);
        out.notes.push("server rejected a frame: " + why + (detail ? " (" + detail + ")" : ""));
      },
    });
  });

  if (process.env.SHOW_TRACE) {
    // Debug aid: who shows a given element (sets its style.display).
    await page.addInitScript({ content: `(function () {
      const id = ${JSON.stringify(process.env.SHOW_TRACE)};
      const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "style");
      const proxies = new WeakMap();
      Object.defineProperty(HTMLElement.prototype, "style", { configurable: true, enumerable: d.enumerable, set: d.set, get: function () {
        const real = d.get.call(this);
        if (this.id !== id) return real;
        let p = proxies.get(real);
        if (!p) {
          p = new Proxy(real, {
            set(t, k, v) { if (k === "display" && v !== "none") (window.__showStacks = window.__showStacks || []).push(v + ": " + (new Error().stack || "").split("\\n").slice(2, 14).join(" <- ")); t[k] = v; return true; },
            get(t, k) { const v = t[k]; return typeof v === "function" ? v.bind(t) : v; },
          });
          proxies.set(real, p);
        }
        return p;
      } });
    })();` });
  }
  if (process.env.TRACE_ID) {
    // Debug aid: who takes a given element out of the document.
    await page.addInitScript({ content: `(function () {
      const id = ${JSON.stringify(process.env.TRACE_ID)};
      const note = (how) => (window.__trace = window.__trace || []).push(how + ": " + (new Error().stack || "").split("\\n").slice(2, 8).join(" <- "));
      const rm = Element.prototype.remove;
      Element.prototype.remove = function () { if (this.id === id) note("remove"); return rm.apply(this, arguments); };
      const rc = Node.prototype.removeChild;
      Node.prototype.removeChild = function (c) { if (c && c.id === id) note("removeChild"); return rc.apply(this, arguments); };
      const ap = Node.prototype.appendChild;
      Node.prototype.appendChild = function (c) { if (c && c.id === id) note("appendChild to " + (this.id || this.nodeName)); return ap.apply(this, arguments); };
      const ih = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
      Object.defineProperty(Element.prototype, "innerHTML", { configurable: true, get: ih.get, set(v) { if (this.querySelector && this.querySelector("#" + id)) note("innerHTML on " + (this.id || this.nodeName)); return ih.set.call(this, v); } });
      document.addEventListener("DOMContentLoaded", () => note("DCL exists=" + !!document.getElementById(id)), true);
    })();` });
  }
  if (signedin) await page.addInitScript({ content: "window.__signedIn = true;" });
  /* RYN's loading screen: every line it shows, when Play became pressable,
   * and when the screen went. */
  await page.addInitScript({ content: `(function () {
    if (window.top !== window) return;
    window.__bootTexts = [];
    const seen = () => {
      const t = document.querySelector("#ryn-boot .rb-text");
      if (t) { const v = t.textContent.replace(/ · \\d+s$/, ""); if (window.__bootTexts[window.__bootTexts.length - 1] !== v) { window.__bootTexts.push(v); if (v === "Ready" && !window.__readyAt) window.__readyAt = performance.now(); } }
      if (window.__bootSeen && !document.getElementById("ryn-boot") && !window.__bootGoneAt) window.__bootGoneAt = performance.now();
      if (document.getElementById("ryn-boot")) window.__bootSeen = true;
      const play = document.getElementById("enterGame");
      if (play && !play.classList.contains("disabled") && !window.__gateAt && window.__bootSeen) window.__gateAt = performance.now();
    };
    new MutationObserver(seen).observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  })();` });
  // +boss: what RYN writes on its overlay (the boss's health number)
  if (boss) await page.addInitScript({ content: `(function () {
    const fill = CanvasRenderingContext2D.prototype.fillText;
    window.__overlayTexts = new Set();
    CanvasRenderingContext2D.prototype.fillText = function (t) {
      if (this.canvas && this.canvas.id === "ryn-gl-overlay" && window.__overlayTexts.size < 500) window.__overlayTexts.add(String(t));
      return fill.apply(this, arguments);
    };
  })();` });
  if (grind || trap || visuals || restyled || oddname) {
    const settings = JSON.stringify(grind ? { _autoGrind: true } : trap ? { _trapAnimal: true } : restyled || oddname ? { _myNameColor: true } : {
      _myNameColor: true, _markRynPlayers: true, _showPlayerID: true, _weaponReloadRing: true, _renderHP: true,
      _positionPrediction: true, _playerTurretReloadBar: true, _displayPlayerAngle: true, _objectTint: true,
      _weather: true, _deathCorpse: true, _itemHealthBar: true, _itemHealthBarEnemy: true, _structureColors: true,
      _weaponHitbox: true, _collisionHitbox: true, _placementHitbox: true, _possiblePlacement: true, _meleeAnimation: true,
    });
    await page.addInitScript({ content: `try { if (window.top === window) localStorage.setItem("RYN", ${JSON.stringify(settings)}); } catch (e) {}` });
  }
  /* How many copies of the game ran, and whose. The bundle sets
   * window.loadedScript early in its top level: from the page's own module
   * the stack names /assets/index-*.js, from RYN's copy (Function()) it does
   * not. Injected late, both used to run — two server pollers, two Turnstile
   * scripts, two sets of timers — and the page's copy was only stopped at its
   * first frame. */
  await page.addInitScript({ content: `(function () {
    if (window.top !== window) return;
    let v;
    Object.defineProperty(window, "loadedScript", { configurable: true, get: function () { return v; }, set: function (x) {
      (window.__copies = window.__copies || []).push(/\\/assets\\/index-[^/]*\\.js/.test(new Error().stack || "") ? "page" : "ryn");
      v = x;
    } });
  })();` });
  /* Writes to the game canvas's size. Each one allocates a new drawing buffer,
   * and on the 2025 renderer it comes with a renderer resize that throws away
   * every cached glyph and shape: RYN's zoom used to fire one every frame,
   * zoom moving or not, and that was the frame rate. */
  await page.addInitScript({ content: `(function () {
    if (window.top !== window) return;
    for (const prop of ["width", "height"]) {
      const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, prop);
      Object.defineProperty(HTMLCanvasElement.prototype, prop, { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) {
        if (this.id === "gameCanvas") window.__gameCanvasSizes = (window.__gameCanvasSizes || 0) + 1;
        return d.set.call(this, v);
      } });
    }
  })();` });
  // Who sends a frame too short to carry a signature: record the stack.
  await page.addInitScript({ content: `(function () {
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) {
      try {
        const n = d && (d.byteLength !== undefined ? d.byteLength : d.length);
        if (n !== undefined && n <= 6) (window.__shortFrames = window.__shortFrames || []).push(n + " bytes: " + (new Error().stack || "").split("\\n").slice(2, 7).join(" <- "));
      } catch (e) {}
      return send.apply(this, arguments);
    };
  })();` });
  // Keep a copy of the code RYN hands to Function(), so a failure inside the
  // rewritten bundle can be traced to the hook that produced it.
  await page.addInitScript({ content: `(function () {
    const F = window.Function;
    window.Function = new Proxy(F, { apply(t, th, a) {
      const body = a.length ? String(a[a.length - 1]) : "";
      if (body.length > 100000) window.__rynBundleCode = body;
      return Reflect.apply(t, th, a);
    } });
  })();` });
  if (mode === "fast") {
    /* Top frame only. RYN draws its own menu in a blob: iframe, and
     * addInitScript would run a second RYN inside it — which no userscript
     * manager does for a @match of *://*.moomoo.io/* — and report that copy's
     * missing #gameUI as a failure of the real one. */
    await page.addInitScript({ content: "if (window.top === window && location.protocol !== \"blob:\") {\nwindow.__headAtStart = document.head === null;\n" + ryn + "\n}" });
  }
  await page.goto("https://moomoo.io/", { waitUntil: "domcontentloaded" });

  const has = sel => page.evaluate(s => !!document.querySelector(s), sel);
  const isRyn = mode !== "vanilla";

  // the menu, with a server list
  try {
    await page.waitForFunction(() => {
      const d = document.querySelector("#serverSelect .dropdownList");
      return d && d.children.length > 0;
    }, null, { timeout: 15000 });
    out.gameServerList = true;
  } catch (e) { out.gameServerList = false; }

  await page.waitForTimeout(2500);
  out.state = await page.evaluate(() => ({
    headAtStart: window.__headAtStart,
    rynBundleRan: !!(window.RYN_BUNDLE_RAN),
    hasRynLobby: !!document.getElementById("ryn-lobby"),
    lobbyRows: document.querySelectorAll("#ryn-lobby .rs-row").length,
    lockedRows: document.querySelectorAll("#ryn-lobby .rs-row.rs-locked").length,
    lobbyText: (document.getElementById("ryn-lobby") || { innerText: "" }).innerText.replace(/\s+/g, " ").slice(0, 400),
    regionDropdown: (document.querySelector("#regionSelect .dropdownList") || { children: [] }).children.length,
    serverDropdown: (document.querySelector("#serverSelect .dropdownList") || { children: [] }).children.length,
    loadingText: (document.getElementById("loadingText") || {}).textContent,
    menuShown: (() => { const m = document.getElementById("menuCardHolder"); return m ? getComputedStyle(m).display : null; })(),
    enterGameVisible: (() => { const b = document.getElementById("enterGame"); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
    ads: window.__ads, bootstrapped: window.__bootstrapped, tsRenders: window.__tsRenders,
    frvrHasAuth: !!(window.FRVR && window.FRVR.auth),
    userscriptWarning: !!document.getElementById("userscript-warning"),
  }));

  // debug aid: the lobby as it first shows
  if (process.env.LOBBY_PNG) fs.writeFileSync(process.env.LOBBY_PNG.replace(/\.png$/, "") + "-" + spec.replace(/\+/g, "-") + ".png", await page.screenshot({ type: "png" }));
  /* RYN's lobby, top row: Sign in (or who you are and Sign out), Clan and
   * Friends, up by the mark rather than in the middle of the controls — and
   * each one doing what the game's own does. */
  if (isRyn) out.lobbyAccount = await (async () => {
    const look = () => page.evaluate(() => {
      const box = id => {
        const n = document.getElementById(id);
        if (!n) return null;
        const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
        const onScreen = r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
        return { shown: r.width > 0 && r.height > 0 && onScreen && cs.display !== "none" && cs.visibility !== "hidden", top: Math.round(r.top), text: n.textContent.trim().slice(0, 40) };
      };
      const view = document.querySelector('.menuView[data-view="friends"]');
      const vr = view ? view.getBoundingClientRect() : null;
      return { signin: box("ryn-signin"), signout: box("ryn-signout"), clan: box("ryn-clan"), friends: box("ryn-friends"), chip: (document.querySelector(".rl-acc-chip") || {}).textContent || "",
               gameSignIn: box("signInButton"), accountCard: box("accountCard"), clanCard: box("clanCard"),
               friendsView: vr ? vr.width > 0 && vr.height > 0 && getComputedStyle(view).display !== "none" : null };
    });
    const res = { before: await look() };
    if (process.env.LOBBY_DEBUG) console.log(await require(process.env.LOBBY_DEBUG)(page));
    try {
      await page.click("#ryn-clan", { timeout: 3000 });
      await page.waitForTimeout(400);
      res.afterClan = await look();
      // close whatever it opened
      await page.evaluate(() => { for (const id of ["accountClose", "clanClose"]) { const b = document.getElementById(id); if (b) b.click(); } });
      await page.waitForTimeout(200);
      if (!signedin) {
        await page.click("#ryn-friends", { timeout: 3000 });
        await page.waitForTimeout(400);
        res.afterFriends = await look();
        await page.evaluate(() => { const b = document.getElementById("accountClose"); if (b) b.click(); });
        await page.waitForTimeout(200);
      } else {
        // the friends service is up (the game shows its Friends link then)
        await page.evaluate(() => { document.getElementById("friendsNav").style.display = ""; });
        await page.waitForTimeout(150);
        await page.click("#ryn-friends", { timeout: 3000 });
        await page.waitForTimeout(400);
        res.afterFriends = await look();
        await page.evaluate(() => { const b = document.querySelector('.menuView[data-view="friends"] .viewBack'); if (b) b.click(); });
        await page.waitForTimeout(200);
        res.afterBack = await look();
      }
    } catch (e) { res.error = e.message.split("\n").filter(l => /intercept|stable|visible|enabled|waiting|retrying/i.test(l)).slice(-3).join(" / ") || e.message.split("\n")[0]; }
    if (process.env.LOBBY_DEBUG) console.log(JSON.stringify(res));
    return res;
  })();

  // Sign in: the game's own button opens its account card, and the card
  // reaches FRVR.auth. Done before joining, and closed again afterwards.
  out.signIn = await (async () => {
    try {
      // RYN's lobby has its own Sign in button (top row); the game's is kept
      // out of sight and pressed by it
      const sel = isRyn ? "#ryn-signin" : "#signInButton";
      const btn = await page.$(sel);
      if (!btn) return { error: "no " + sel };
      if (!(await btn.isVisible())) return { error: sel + " is not visible" };
      await page.click(sel, { timeout: 3000 });
      await page.waitForTimeout(250);
      const card = await page.evaluate(() => {
        const c = document.getElementById("accountCard");
        if (!c) return null;
        let hidden = false;
        for (let n = c; n; n = n.parentElement) if (getComputedStyle(n).display === "none") hidden = true;
        const r = c.getBoundingClientRect();
        return { hidden, w: Math.round(r.width), h: Math.round(r.height) };
      });
      if (!card || card.hidden || !card.w) return { error: "the account card did not open: " + JSON.stringify(card) };
      await page.fill("#accountEmail", "player@example.com");
      await page.click("#accountSubmit", { timeout: 3000 });
      await page.waitForTimeout(400);
      const calls = await page.evaluate(() => window.__frvrCalls || []);
      await page.click("#accountClose", { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(150);
      return { ok: calls.some(c => /^requestEmailLoginCode:player@example\.com$/.test(c)), calls };
    } catch (e) {
      return { error: e.message.split("\n")[0] };
    }
  })();

  /* The person at the keyboard, as far as the human check goes: they click a
   * challenge that wants a click if, and only if, they can see it — its frame
   * has a size and nothing is drawn over it. */
  out.answered = 0;
  const answerChallenge = async () => {
    const pending = await page.evaluate(() => (window.__tsPending ? window.__tsPending() : [])).catch(() => []);
    for (const p of pending) {
      if (!p.onTop) continue;
      await page.mouse.click(p.x, p.y);
      out.answered++;
      return true;
    }
    return false;
  };

  // join: type a name, press the real button with a real click
  try {
    await page.fill("#nameInput", "tester");
  } catch (e) { out.notes.push("could not type a name: " + e.message.split("\n")[0]); }
  await answerChallenge();
  try {
    out.clickAt = Date.now();
    await page.click("#enterGame", { timeout: 5000, force: true });
    out.clicked = true;
  } catch (e) { out.clicked = false; out.notes.push("could not click #enterGame: " + e.message.split("\n")[0]); }

  // wait for the spawn frame to reach the server, then for a few world ticks
  const t0 = Date.now();
  while (Date.now() - t0 < 12000 && !out.frames.some(f => /^c2s M /.test(f))) {
    await answerChallenge();
    await page.waitForTimeout(200);
  }
  out.joinMs = out.spawnAt && out.clickAt ? out.spawnAt - out.clickAt : null;
  out.unanswerable = out.spawnAt ? [] : await page.evaluate(() => (window.__tsPending ? window.__tsPending() : [])).catch(() => []);
  out.spawnSent = out.frames.some(f => /^c2s M /.test(f));
  out.mainSockets = out.conns.length;
  await page.waitForTimeout(2500);
  // in the game, standing still, nothing zooming: how often is the canvas resized?
  {
    const before = await page.evaluate(() => window.__gameCanvasSizes || 0);
    await page.waitForTimeout(2000);
    out.canvasSizes = (await page.evaluate(() => window.__gameCanvasSizes || 0)) - before;
  }

  /* +hats: the store, opened the way a player opens it — every picture in it
   * has to load — and then closed, so the hat I wear can be seen on me. With
   * +spritefail every hat was refused once first. */
  if (hats) {
    await page.evaluate(() => {
      const b = document.getElementById("storeButton");
      if (b) b.style.cssText += ";position:fixed;top:330px;left:4px;width:40px;height:40px;z-index:2147483646;display:block";
    });
    await page.click("#storeButton", { timeout: 3000, force: true }).catch(e => out.notes.push("store: " + e.message.split("\n")[0]));
    // long enough for a picture refused once to be asked for again
    await page.waitForTimeout(spritefail ? 4500 : 1200);
    out.store = await page.evaluate(() => [...document.querySelectorAll("img.hatPreview")]
      .map(i => ({ src: (i.getAttribute("src") || "").replace(/^.*\/img\//, ""), w: i.naturalWidth })));
    await page.click("#storeButton", { timeout: 3000, force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }

  if (kill && out.session) {
    const look = () => page.evaluate(() => {
      const shown = id => {
        const e = document.getElementById(id);
        if (!e) return false;
        for (let n = e; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === "none" || cs.visibility === "hidden") return false;
        }
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const toast = document.getElementById("rynBotToast"), notes = document.getElementById("friendNotes");
      const cv = document.getElementById("ryn-gl-overlay");
      let px = -1;
      if (cv && cv.width) {
        const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
        px = 0;
        for (let i = 3; i < d.length; i += 16) if (d[i] > 0) px++;
      }
      const chain = [];
      for (let n = document.getElementById("accountCard"); n && n !== document.body; n = n.parentElement)
        chain.push((n.id || n.className || n.tagName) + ":" + getComputedStyle(n).display + (n.style.display ? "(" + n.style.display + ")" : ""));
      return { accountCard: shown("accountCard"), notes: notes ? notes.textContent.trim() : "",
               toast: toast && toast.style.opacity !== "0" ? toast.textContent : "", overlayPx: px,
               chain: chain.join(" < "), died: shown("diedText"), menu: shown("mainMenu"), gameUI: shown("gameUI") };
    });
    const errorsBefore = out.errors.length, faultsBefore = (out.renderFaults || []).length;
    out.beforeKill = await look();
    out.session.killFoe();
    const seen = [];
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      seen.push(await look());
      if (i === 3) fs.writeFileSync(path.join(__dirname, "boot-2025-" + spec.replace(/\+/g, "-") + "-kill.png"), await page.screenshot({ type: "png" }));
    }
    out.kill = { seen, errors: out.errors.slice(errorsBefore), faults: (out.renderFaults || []).slice(faultsBefore) };
    if (process.env.SHOW_TRACE) console.log((await page.evaluate(() => window.__showStacks || [])).join("\n\n"));
    if (process.env.KILL_DEBUG) console.log("before: " + JSON.stringify(out.beforeKill) + "\n" + seen.map(v => JSON.stringify(v)).join("\n"));
  }

  if (heal && out.session) {
    const from = out.frames.length;
    out.session.send("O", [out.session.mySid, 60]);
    await page.waitForTimeout(1500);
    const sent = out.frames.slice(from).filter(f => /^c2s /.test(f));
    out.heal = { frames: sent.slice(0, 12), ate: sent.some(f => /^c2s z seq=\d+ \[0,false\]/.test(f)) && sent.some(f => /^c2s F seq=\d+ \[1,/.test(f)) };
    // back to full, so what is measured after this is the usual scene
    out.session.send("O", [out.session.mySid, 100]);
    await page.waitForTimeout(500);
  }

  if (visuals && out.session) {
    const menu = page.frames().find(f => /^blob:/.test(f.url()));
    const styles = menu ? await menu.evaluate(() => [...document.querySelectorAll("#_killAnimation option")].map(o => o.value)).catch(() => []) : [];
    const errorsBefore = out.errors.length, faultsBefore = (out.renderFaults || []).length;
    const sweep = [];
    for (const id of styles) {
      await menu.evaluate(v => { const el = document.getElementById("_killAnimation"); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); }, id).catch(() => {});
      out.session.reviveFoe();
      await page.waitForTimeout(400);
      out.session.killFoe();
      await page.waitForTimeout(700);
      const card = await page.evaluate(() => { const c = document.getElementById("accountCard"); return !!c && c.style.display === "block"; });
      sweep.push({ id, card, errors: out.errors.length - errorsBefore, faults: (out.renderFaults || []).length - faultsBefore });
      if (id === "angel") fs.writeFileSync(path.join(__dirname, "boot-2025-" + spec.replace(/\+/g, "-") + "-angel.png"), await page.screenshot({ type: "png" }));
    }
    out.visuals = { styles, sweep, errors: out.errors.slice(errorsBefore), faults: (out.renderFaults || []).slice(faultsBefore) };
  }

  if (grind) {
    // The two upgrades, picked the way a player picks them: the game's own
    // upgrade buttons (RYN learns its inventory from these clicks).
    for (const id of ["upgradeItem10", "upgradeItem33"]) {
      try {
        await page.waitForSelector("#" + id, { state: "attached", timeout: 5000 });
        await page.evaluate(i => document.getElementById(i).click(), id);
        await page.waitForTimeout(300);
      } catch (e) { out.notes.push("could not pick " + id + ": " + e.message.split("\n")[0]); }
    }
    // Stand still and let Auto Grind work: count the swings the server made.
    const from = Date.now();
    const quietFrom = out.sim ? out.sim.quietTicks || 0 : 0;
    const GRIND_MS = +(process.env.GRIND_MS || 8000);
    await page.waitForTimeout(GRIND_MS);
    const swings = out.swings.filter(([t]) => t >= from);
    const gaps = [];
    for (let i = 1; i < swings.length; i++) gaps.push(swings[i][0] - swings[i - 1][0]);
    out.grind = {
      swings: swings.length,
      hits: swings.filter(sw => sw[2]).length,
      firstAfter: swings.length ? swings[0][0] - from : null,
      maxGap: gaps.length ? Math.max(...gaps) : null,
      meanGap: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
      weapons: [...new Set(swings.map(sw => sw[1]))],
      all: out.swings.length,
      ms: GRIND_MS,
      events: out.simEvents.filter(([t]) => t >= from).map(([t, w]) => w),
      quiet: out.sim && out.sim.quiet ? (out.sim.quietTicks || 0) - quietFrom : null,
    };
    /* Switched off in RYN's menu, with nothing else going on: the held attack
     * has to be let go by RYN itself — a press left down keeps swinging at
     * whatever is in front of you. */
    if (out.sim) {
      const menu = page.frames().find(f => /^blob:/.test(f.url()));
      out.grind.offToggled = menu ? await menu.evaluate(() => {
        const el = document.getElementById("_autoGrind");
        if (!el) return false;
        if (el.checked) el.click();
        return !el.checked;
      }).catch(() => false) : false;
      const off = Date.now();
      await page.waitForTimeout(1500);
      out.grind.afterOff = out.swings.filter(([t]) => t >= off + 700).length;
      out.grind.offState = out.sim.state ? out.sim.state() : null;
      // and back on, for the enemy below
      if (menu) await menu.evaluate(() => { const el = document.getElementById("_autoGrind"); if (el && !el.checked) el.click(); }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    // An enemy walks up: grinding stands down, and the held attack has to be
    // let go — a press left down would swing at whatever comes next.
    if (out.sim) {
      out.sim.foeNear = true;
      const near = Date.now();
      await page.waitForTimeout(2000);
      out.grind.afterEnemy = out.swings.filter(([t]) => t >= near + 700).length;
      out.grind.releasedState = out.sim.state ? out.sim.state() : null;
    }
    if (process.env.GRIND_TRACE) {
      const evs = out.swings.map(([t, w, h]) => [t, "swing w" + w + (h ? "" : " (miss)")]).concat(out.simEvents).sort((a, b) => a[0] - b[0]);
      const t0 = evs.length ? evs[0][0] : 0;
      console.log(evs.map(([t, w]) => String(t - t0).padStart(6) + "  " + w).join("\n"));
    }
    if (process.env.GRIND_DEBUG) {
      console.log(out.frames.filter(f => /^c2s /.test(f)).slice(-50).join("\n"));
      console.log(JSON.stringify(await page.evaluate(() => {
        try { const s = JSON.parse(localStorage.getItem("RYN") || "{}"); return { autoGrind: s._autoGrind }; } catch (e) { return String(e); }
      })));
    }
  }

  if (trap && out.sim) {
    // The pit trap, picked from the game's own upgrade bar (age 4).
    try {
      await page.waitForSelector("#upgradeItem31", { state: "attached", timeout: 5000 });
      await page.evaluate(() => document.getElementById("upgradeItem31").click());
    } catch (e) { out.notes.push("could not pick the pit trap: " + e.message.split("\n")[0]); }
    const from = Date.now();
    await page.waitForTimeout(+(process.env.TRAP_MS || 3000));
    const traps = since => out.simEvents.filter(([t, w]) => t >= since && /^place 15 /.test(w)).map(([t, w]) => +w.split(" at ")[1]);
    out.trap = { boar: traps(from) };
    // The boar goes out of view — Trap Animal stands down — and then a crab
    // walks up to the same spot.
    const { x, y } = out.sim.at;
    out.sim.animals([], [11]);
    await page.waitForTimeout(1000);
    out.sim.animals([12, 13, x + 120, y, 314, 500, 0, 0], []);
    const crabFrom = Date.now();
    await page.waitForTimeout(+(process.env.TRAP_MS || 3000));
    out.trap.crab = traps(crabFrom);
    if (process.env.TRAP_DEBUG) console.log(out.simEvents.map(([t, w]) => (t - from) + " " + w).join("\n") + "\n" +
      out.frames.filter(f => /^c2s (z|F|H)/.test(f)).slice(-30).join("\n"));
  }

  // A bot, through RYN's own menu: its own Turnstile token, its own /join
  // ticket, and RYN's own signing and masking — the path the main client
  // never takes, because the game's bundle does that part for it.
  if (mode !== "vanilla" && !process.env.NO_BOTS) {
    out.bot = await (async () => {
      const frame = page.frames().find(f => /^blob:/.test(f.url()));
      if (!frame) return { error: "RYN's menu frame not found" };
      const before = out.conns.length;
      // Cloudflare's script, already there before any bot asks for it?
      const preloaded = await page.evaluate(() => window.__tsLoads || 0).catch(() => null);
      try {
        await frame.evaluate(() => document.getElementById("add-bot-dynamic").click());
        await frame.waitForSelector("#dyn-bot-input-1", { state: "attached", timeout: 4000 });
        await frame.evaluate(() => {
          document.getElementById("dyn-bot-input-1").value = "bot1";
          document.getElementById("dyn-bot-btn-1").click();
        });
      } catch (e) {
        return { error: e.message.split("\n")[0] };
      }
      const t1 = Date.now();
      // a bot's token is a challenge of its own; when it wants a click, the
      // person clicks it if they can see it (+slowclick: after 25 s)
      let label = null;
      // whatever the bot's check puts up, it is never in the middle of the
      // screen (the user's call: v2.6's card there is gone)
      let middle = null;
      while (Date.now() - t1 < (slowclick ? 40000 : silentname ? 25000 : 15000) &&
             !(out.conns.length > before && out.conns[before].letters.includes("M") && (!silentname || out.conns[before].spawnedAs))) {
        if (slowclick && label === null) label = await page.evaluate(() => [...document.querySelectorAll("div")].some(d => /Cloudflare wants a click to let your bot in/.test(d.textContent) && d.getBoundingClientRect().width > 0)).catch(() => null) || null;
        if (!slowclick || Date.now() - t1 > 25000) await answerChallenge();
        if (middle === null) middle = await page.evaluate(() => {
          const at = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
          return at && at.closest("[data-ryn-captcha], #ryn-bot-verify, .cf-turnstile-frame") ? (at.id || at.className || at.tagName) : null;
        }).catch(() => null);
        await page.waitForTimeout(250);
      }
      // RYN's bot pings once at io-init and again only after it has READ the
      // server's pong — so a second ping is proof it decodes what it is sent.
      const t2 = Date.now();
      while (Date.now() - t2 < 9000 && out.conns[before] && out.conns[before].letters.filter(l => l === "0").length < 2) await page.waitForTimeout(250);
      const c = out.conns[before];
      const toast = await page.evaluate(() => (document.getElementById("rynBotToast") || {}).textContent || "").catch(() => "");
      const devices = await page.evaluate(() => { try { return { mine: localStorage.getItem("moo_did") }; } catch (e) { return null; } }).catch(() => null);

      return c ? { url: c.url, spawned: c.letters.includes("M"), frames: c.letters.length, violations: c.violations, toast,
                   pings: c.letters.filter(l => l === "0").length, spawnName: c.spawnName, spawnedAs: c.spawnedAs, devices, label, middle,
                   ms: c.spawnAt ? c.spawnAt - t1 : null, preloaded,
                   join: out.joins.length > 1 ? out.joins[out.joins.length - 1] : null } : { error: "no bot socket opened", toast, middle };
    })();
  }

  if (process.env.PERF) {
    // Frames per second over a fixed window, the main thread's script time,
    // and where that time went — for comparing a run with RYN to one without.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    const m0 = (await cdp.send("Performance.getMetrics")).metrics;
    await cdp.send("Profiler.start");
    const frames = await page.evaluate(() => new Promise(done => {
      let n = 0;
      const t0 = performance.now();
      const step = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(step); else done(n); };
      requestAnimationFrame(step);
    }));
    const { profile } = await cdp.send("Profiler.stop");
    const m1 = (await cdp.send("Performance.getMetrics")).metrics;
    const metric = (m, k) => (m.find(x => x.name === k) || {}).value || 0;
    const self = new Map();
    const dt = profile.timeDeltas || [];
    const byId = new Map(profile.nodes.map(n => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
    const label = n => { const cf = n.callFrame; return (cf.functionName || "(anon)") + " " + (cf.url ? cf.url.replace(/^.*\//, "") : "<eval>") + ":" + (cf.lineNumber + 1); };
    for (let i = 0; i < profile.samples.length; i++) {
      const n = byId.get(profile.samples[i]);
      let key = label(n);
      // A native's time is charged to the script that called it.
      if (n.callFrame.lineNumber < 0 && !/^\((idle|program|garbage collector|root)\)/.test(n.callFrame.functionName)) {
        const chain = [];
        for (let p = parent.get(n.id); p && chain.length < 3; p = parent.get(p)) {
          const pn = byId.get(p);
          if (pn.callFrame.lineNumber >= 0) chain.push(label(pn));
        }
        key += "  <-  " + chain.join(" <- ");
      }
      self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000);
    }
    const layers = await page.evaluate(() => [...document.querySelectorAll("canvas")].filter(c => c.isConnected && c.width * c.height > 200000)
      .map(c => (c.id || "(no id)") + " " + c.width + "x" + c.height + " " + getComputedStyle(c).display));
    out.perf = {
      layers,
      fps: +(frames / 5).toFixed(1),
      scriptMs: Math.round((metric(m1, "ScriptDuration") - metric(m0, "ScriptDuration")) * 1000),
      taskMs: Math.round((metric(m1, "TaskDuration") - metric(m0, "TaskDuration")) * 1000),
      top: [...self.entries()].filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25)
        .map(([k, v]) => v.toFixed(0).padStart(6) + " ms  " + k),
      idle: Math.round(self.get("(idle) <eval>:0") || 0),
      gc: Math.round(self.get("(garbage collector) <eval>:0") || 0),
    };
  }

  out.after = await page.evaluate(() => ({
    // what RYN drew this frame on its overlay over the WebGL canvas
    // the overlay's box on screen against the game canvas's: they have to be
    // the same box, or everything RYN draws is off its player
    overlayBox: (() => {
      const cv = document.getElementById("ryn-gl-overlay"), game = document.getElementById("gameCanvas");
      if (!cv || !game) return null;
      const a = cv.getBoundingClientRect(), b = game.getBoundingClientRect();
      return { overlay: [a.x, a.y, a.width, a.height].map(Math.round), game: [b.x, b.y, b.width, b.height].map(Math.round), px: [cv.width, cv.height, game.width, game.height] };
    })(),
    /* The HP number under my bar: the white pixels RYN drew in a band below
     * the player (who stands at the centre), and how far their middle is from
     * the player's. Drawn left-aligned it sat half its width to the right. */
    hpText: (() => {
      const cv = document.getElementById("ryn-gl-overlay");
      if (!cv || !cv.width) return null;
      const k = cv.width / cv.getBoundingClientRect().width;
      const cx = cv.width / 2, cy = cv.height / 2;
      // just under my own bar: the rival's number, further right, stays out
      const x0 = Math.round(cx - 45 * k), x1 = Math.round(cx + 45 * k), y0 = Math.round(cy + 60 * k), y1 = Math.round(cy + 90 * k);
      const w = x1 - x0, d = cv.getContext("2d").getImageData(x0, y0, w, y1 - y0).data;
      let sx = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200 && d[i + 3] > 200) { sx += (i / 4) % w; n++; }
      }
      return { offset: n ? +((x0 + sx / n - cx) / k).toFixed(1) : null, px: n };
    })(),
    overlayPx: (() => {
      const cv = document.getElementById("ryn-gl-overlay");
      if (!cv || !cv.width) return -1;
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
      return n;
    })(),
    enterGame: (() => { const b = document.getElementById("enterGame"); if (!b) return null; const r = b.getBoundingClientRect();
      return { cls: b.className, rect: [r.x, r.y, r.width, r.height].map(Math.round), top: (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) || {}).id }; })(),
    tsRenders: window.__tsRenders,
    boot: { texts: window.__bootTexts || [], ready: window.__readyAt || null, gone: window.__bootGoneAt || null },
    tsRefused: window.__tsRefused || 0,
    tsByPage: window.__tsByPage || 0,
    tsLoads: window.__tsLoads || 0,
    tsReloads: window.__tsReloads || 0,
    copies: window.__copies || [],
    texts: ["loadingText", "nameHint", "signInHint", "verifyText", "menuNotice", "serverNote"].map(id => {
      const e = document.getElementById(id); return e && e.textContent.trim() ? id + "=" + e.textContent.trim().slice(0, 80) : null; }).filter(Boolean),
    gameUI: (() => { const g = document.getElementById("gameUI"); return g ? getComputedStyle(g).display : null; })(),
    menuShown: (() => { const m = document.getElementById("menuCardHolder"); return m ? getComputedStyle(m).display : null; })(),
    renderer: !!window.__renderer, drawCalls: window.__drawCalls,
    bossNumber: window.__overlayTexts ? [...window.__overlayTexts].find(t => /^\d{5,}$/.test(t)) || null : null,
  }));

  if (process.env.OVERLAY_PNG) {
    const url = await page.evaluate(() => { const cv = document.getElementById("ryn-gl-overlay"); return cv ? cv.toDataURL("image/png") : null; });
    if (url) fs.writeFileSync(process.env.OVERLAY_PNG, Buffer.from(url.split(",")[1], "base64"));
  }
  out.shortFrames = await page.evaluate(() => window.__shortFrames || []);
  if (process.env.TRACE_ID) console.log((await page.evaluate(() => window.__trace || [])).join("\n"));
  if (mode !== "vanilla") {
    const code = await page.evaluate(() => window.__rynBundleCode || null);
    out.bundleRan = !!code;
    if (code) fs.writeFileSync(path.join(__dirname, "boot-2025-" + spec.replace(/\+/g, "-") + ".bundle.js"), code);
  }

  // Is the player on screen? It spawns at the centre of the view; compare the
  // middle of the frame against a ring around it.
  const shot = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(__dirname, "boot-2025-" + spec.replace(/\+/g, "-") + ".png"), shot);
  out.centre = await page.evaluate(async b64 => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = "data:image/png;base64," + b64; });
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const cx = img.width >> 1, cy = img.height >> 1;
    const d = x.getImageData(cx - 40, cy - 40, 80, 80).data;
    const colours = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4);
      colours.set(k, (colours.get(k) || 0) + 1);
    }
    /* The grass is whatever dominates a strip along the top edge; the player
     * is a filled circle about 25px across at the centre. Count the pixels in
     * the middle 30x30 that are nowhere near the grass. */
    const top = x.getImageData(0, 40, img.width, 4).data, hist = new Map();
    for (let i = 0; i < top.length; i += 4) { const k = top[i] + "," + top[i + 1] + "," + top[i + 2]; hist.set(k, (hist.get(k) || 0) + 1); }
    const grass = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
    const mid = x.getImageData(cx - 15, cy - 15, 30, 30).data;
    let skin = 0, outline = 0;
    for (let i = 0; i < mid.length; i += 4) {
      const dist = Math.abs(mid[i] - grass[0]) + Math.abs(mid[i + 1] - grass[1]) + Math.abs(mid[i + 2] - grass[2]);
      if (dist > 40) skin++;
    }
    outline = grass.join("/");
    /* The ground grid: grass under black at 6% (x0.94), in lines across the
     * whole screen. A screen with the grid has about one grass pixel in eight
     * that colour; one without, next to none. */
    const all = x.getImageData(0, 0, img.width, img.height).data;
    const want = grass.map(v => v * 0.94);
    let gridPx = 0, grassPx = 0;
    for (let i = 0; i < all.length; i += 4) {
      if (all[i] === grass[0] && all[i + 1] === grass[1] && all[i + 2] === grass[2]) grassPx++;
      else if (Math.abs(all[i] - want[0]) <= 2.5 && Math.abs(all[i + 1] - want[1]) <= 2.5 && Math.abs(all[i + 2] - want[2]) <= 2.5) gridPx++;
    }
    /* the hat on me (hats are served magenta; under the game's night tint
     * it comes out a darker purple), in the middle 60x60 */
    const hatBox = x.getImageData(cx - 30, cy - 30, 60, 60).data;
    let hatPx = 0;
    for (let i = 0; i < hatBox.length; i += 4) {
      const [r, g, b] = [hatBox[i], hatBox[i + 1], hatBox[i + 2]];
      if (g < 40 && r > 110 && b > 120 && Math.abs(r - b) < 60) hatPx++;
    }
    // my name, above me, in RYN's default name colour #B388FF
    const nameBox = x.getImageData(cx - 110, cy - 115, 220, 75).data;
    let namePx = 0;
    for (let i = 0; i < nameBox.length; i += 4) {
      if (Math.abs(nameBox[i] - 179) < 40 && Math.abs(nameBox[i + 1] - 136) < 40 && nameBox[i + 2] > 215) namePx++;
    }
    /* +boss: the game's boss bar is a dark rounded tray across the top
     * centre (#3d3f42); RYN's bar for the King, red, sits between it and me. */
    const topBand = x.getImageData(cx - 260, 0, 520, 110).data;
    let topTray = 0;
    for (let i = 0; i < topBand.length; i += 4) if (topBand[i] === 61 && topBand[i + 1] === 63 && topBand[i + 2] === 66) topTray++;
    const kingBand = x.getImageData(cx - 60, cy - 200, 120, 140).data;
    let kingBar = 0;
    for (let i = 0; i < kingBand.length; i += 4) if (Math.abs(kingBand[i] - 204) < 20 && Math.abs(kingBand[i + 1] - 81) < 20 && Math.abs(kingBand[i + 2] - 81) < 20) kingBar++;
    return { topTray, kingBar, distinctColours: colours.size, skin, outline, gridRatio: +(gridPx / Math.max(1, grassPx)).toFixed(4), hatPx, namePx };
  }, shot.toString("base64"));

  /* The zoom: eight notches of the wheel out, then back. RYN's HP bar under
   * the player is a fixed size in the world, so its width in the overlay is
   * the zoom, measured. 1.1 per notch: out by 1.1^8 = 2.14. */
  if (mode !== "vanilla") {
    const barWidth = () => page.evaluate(() => {
      const cv = document.getElementById("ryn-gl-overlay");
      if (!cv || !cv.width) return null;
      const k = cv.width / cv.getBoundingClientRect().width;
      const cx = Math.round(cv.width / 2), cy = Math.round(cv.height / 2);
      const h = Math.round(140 * k), w = Math.round(160 * k);
      const d = cv.getContext("2d").getImageData(cx - w, cy, 2 * w, h).data;
      // the bar's extent in its row: a rain streak drawn across it (the
      // weather shares this canvas) splits a run but not the extent
      let best = 0;
      for (let y = 0; y < h; y++) {
        let lo = -1, hi = -1;
        for (let x = 0; x < 2 * w; x++) {
          const i = (y * 2 * w + x) * 4;
          if (d[i + 3] > 200 && Math.abs(d[i] - 142) < 30 && Math.abs(d[i + 1] - 204) < 30 && Math.abs(d[i + 2] - 81) < 30) {
            if (lo < 0) lo = x;
            hi = x;
          }
        }
        if (lo >= 0 && hi - lo + 1 > best) best = hi - lo + 1;
      }
      return best / k;
    });
    const vp = page.viewportSize();
    await page.mouse.move(vp.width / 2, vp.height / 2);
    const z0 = await barWidth();
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(40); }
    await page.waitForTimeout(1500);
    const zOut = await barWidth();
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(40); }
    await page.waitForTimeout(1500);
    const zBack = await barWidth();
    out.zoom = { before: z0, out: zOut, back: zBack };
  }

  await browser.close();
  return out;
}

function report(r) {
  const ok = (c, s) => console.log("  " + (c ? "ok  " : "FAIL") + "  " + s);
  console.log("\n== " + r.mode + (r.base === "vanilla" ? " (control, no RYN)" : " (RYN " + path.basename(RYN_PATH) + ")") +
    (r.pinned ? " — pinned session: mixed key, salted tables, every frame masked" : ""));
  if (r.state.headAtStart !== undefined) console.log("    document.head at RYN start: " + (r.state.headAtStart ? "null (loadedFast)" : "present"));
  ok(r.errors.length === 0, "no uncaught page errors" + (r.errors.length ? ":\n        " + r.errors.slice(0, 6).join("\n        ") : ""));
  const ce = r.consoleErrors.filter(t => !/Failed to load resource|ERR_FAILED|net::/.test(t));
  if (ce.length) console.log("    console errors:\n        " + ce.slice(0, 8).join("\n        "));
  ok(r.gameServerList, "the game's own server list loaded (" + r.state.regionDropdown + " regions, " + r.state.serverDropdown + " servers)");
  if (r.base !== "vanilla") {
    ok(r.state.hasRynLobby, "RYN's lobby is built");
    ok(!/WAITING FOR THE SERVER LIST/i.test(r.state.lobbyText), "RYN's server panel is not stuck waiting");
    console.log("    lobby: " + r.state.lobbyText.slice(0, 300));
    ok(r.state.ads === 0, "no interstitial ad was requested (" + r.state.ads + ")");
    ok(r.state.frvrHasAuth, "FRVR.auth is intact, so sign-in can work");
    const locked = r.signedin ? 0 : 1;
    ok(r.state.lobbyRows === SERVERS.length && r.state.lockedRows === locked,
       "every server is listed (" + r.state.lobbyRows + "/" + SERVERS.length + "), the members-only one marked locked " +
       (r.signedin ? "for nobody, signed in" : "for a guest") + " (" + r.state.lockedRows + ")");
  }
  if (r.base !== "vanilla" && r.after.boot) {
    /* The loading screen says what it is waiting for — the game, the servers,
     * then Cloudflare (a guest) or the session (signed in) — and goes when
     * that is done, not on a clock. */
    const b = r.after.boot, wait = r.signedin ? "Opening your session" : "Waiting for Cloudflare";
    const lag = b.ready !== null && b.gone !== null ? Math.round(b.gone - b.ready) : null;
    ok(b.texts.includes("Loading the game") && b.texts.includes(wait) && lag !== null && lag < 900,
       "the loading screen names each wait (" + b.texts.join(" → ") + ") and is gone " + lag + " ms after it is ready");
  }
  if (r.lobbyAccount) {
    const a = r.lobbyAccount, b = a.before || {};
    const up = x => x && x.shown && x.top < 120;
    if (r.signedin) {
      ok(up(b.signout) && !(b.signin && b.signin.shown) && /Signed in/.test(b.chip), "signed in, the lobby's top row says so and has Sign out, up by the mark (" +
        JSON.stringify({ signout: b.signout, chip: b.chip }) + ")");
      ok(up(b.clan) && a.afterClan && a.afterClan.clanCard && a.afterClan.clanCard.shown, "the lobby's Clan opens the game's clan card" + (a.error ? " — " + a.error : ""));
      ok(a.afterFriends && up(a.afterFriends.friends) && a.afterFriends.friendsView === true && a.afterBack && a.afterBack.friendsView === false,
         "the lobby's Friends opens the game's friends list over the lobby, and its back button closes it" + (a.error ? " — " + a.error : ""));
    } else {
      ok(up(b.signin) && /Sign in/i.test(b.signin.text) && !(b.gameSignIn && b.gameSignIn.shown) && !(b.signout && b.signout.shown),
         "a guest gets a labelled Sign in in the lobby's top row, not an empty box beside Play (" + JSON.stringify({ signin: b.signin, game: b.gameSignIn }) + ")");
      ok(up(b.clan) && up(b.friends) && a.afterClan && a.afterClan.accountCard && a.afterClan.accountCard.shown && a.afterFriends && a.afterFriends.accountCard && a.afterFriends.accountCard.shown,
         "Clan and Friends are in the top row, and each asks a guest to sign in, as the game does" + (a.error ? " — " + a.error : ""));
    }
  }
  if (process.env.VERBOSE && r.aborted) console.log("    aborted: " + [...new Set(r.aborted)].join("\n             "));
  ok(!r.oldApi, "nothing asks the retired api.moomoo.io host" + (r.oldApi ? " (" + [...new Set(r.oldApi)].join(", ") + ")" : ""));
  if (process.env.VERBOSE) console.log("    after click: " + JSON.stringify({ enterGame: r.after.enterGame, ts: r.after.tsRenders, texts: r.after.texts }));
  if (!r.signedin) ok(r.signIn && r.signIn.ok, "Sign in opens the account card and reaches FRVR.auth" +
     (r.signIn && !r.signIn.ok ? " — " + (r.signIn.error || JSON.stringify(r.signIn.calls)) : ""));
  ok(!r.after.tsRefused, "no Turnstile render was refused as already rendered (" + r.after.tsRefused + ")");
  if (r.base === "late") ok(!r.after.tsByPage, "only RYN's copy renders Turnstile — the page's own copy is told no (" + r.after.tsByPage + ")");
  ok(r.clicked, "the Enter Game button could be clicked");
  ok(r.joins.length > 0, "the join went through api /join (" + r.joins.length + ")" +
     (r.joins[0] ? " — " + JSON.stringify(r.joins[0]).slice(0, 120) : ""));
  const mainSockets = r.mainSockets !== undefined ? r.mainSockets : r.sockets.length;
  ok(mainSockets === 1, "exactly one game socket opened for the player (" + mainSockets + ")" +
     (r.sockets.length ? ": " + r.sockets[0].slice(0, 120) : ""));
  ok(r.sockets.length > 0 && /token=tk%3AT\d/.test(r.sockets[0]) && /[?&]b=test-build/.test(r.sockets[0]),
     "the socket carries the /join ticket (tk:) and ?b=<BUILD_ID>");
  ok(r.spawnSent, "the spawn frame reached the server" + (r.joinMs !== null ? " — " + r.joinMs + " ms after Play" : "") +
     (r.unanswerable && r.unanswerable.length ? " — a challenge wanted a click nobody could make: " + JSON.stringify(r.unanswerable[0]) : ""));
  /* First try, without waiting: the token is ready before Play (or, when the
   * check wants a click, the box is in front of the player within the game's
   * own 1.5 s) and Play goes straight through. */
  const budget = r.interactive ? 4500 : 2500;
  ok(r.joinMs !== null && r.joinMs <= budget, "Play gets you in on the first press, inside " + budget + " ms" +
     (r.joinMs !== null ? " (" + r.joinMs + " ms)" : " (never)"));
  if (r.interactive) ok(r.answered > 0, "the human check that wants a click is on screen where it can be clicked (" + r.answered + " answered)");
  const copies = r.after.copies.join(",");
  ok(copies === (r.base === "vanilla" ? "page" : "ryn"), "one copy of the game runs" +
     (r.base === "vanilla" ? "" : ", RYN's — the page's own module is stopped before it does anything") + " (" + (copies || "none") + ")");
  // Signed in, the game itself never loads it; RYN does, once, as you join
  // (a bot's check then starts at once).
  const tsWant = r.signedin && r.base === "vanilla" ? 0 : 1;
  ok(r.after.tsLoads === tsWant, "Turnstile's script is loaded " + (tsWant ? "once" : "not at all, signed in without RYN") +
     (r.signedin && tsWant ? ", by RYN, though signed in the game never does" : "") + " (" + r.after.tsLoads + ")");
  ok(!r.after.tsReloads, "no challenge was thrown away by moving its frame — a moved iframe reloads (" + r.after.tsReloads + ")");
  const pings = r.conns.length ? r.conns[0].letters.filter(l => l === "0").length : 0;
  ok(pings >= 1, "the player's connection pings the server (" + pings + ")");
  if (r.shortFrames && r.shortFrames.length) console.log("    short frames sent:\n        " + r.shortFrames.slice(0, 3).join("\n        "));
  ok(r.notes.filter(n => /server rejected/.test(n)).length === 0, "the server accepted every frame" +
     (r.notes.length ? ":\n        " + r.notes.slice(0, 5).join("\n        ") : ""));
  ok(r.after.gameUI && r.after.gameUI !== "none", "the in-game UI is showing (" + r.after.gameUI + ")");
  if (r.bot && r.joinRefuse === "members") {
    // refused for good: it says why, and it does not try the server with a raw token
    ok(r.bot.error === "no bot socket opened" && /signed-in players/.test(r.bot.toast || ""),
       "a bot the join API refuses as a guest on a members-only server says why and opens no socket (" +
       (r.bot.error || "it connected") + "; said: " + JSON.stringify(r.bot.toast || "") + ")");
  } else if (r.bot && r.mode.includes("tserror")) {
    const b = r.bot;
    ok(!r.reused && /No Cloudflare check for the bot/.test(b.toast || ""),
       "a bot whose Cloudflare check fails says so, and never offers /join a token it has already seen (" +
       (r.reused || 0) + " reused; said: " + JSON.stringify(b.toast || "") + ")");
  } else if (r.bot) {
    const b = r.bot;
    if (r.joinRefuse === "busy") ok(/Too many joins/.test(b.toast || "") && r.joins.length >= 3,
       "a bot told \"too many joins\" waits, asks again with a new token, and gets in (" + r.joins.length + " joins)");
    ok(!b.error && /token=tk%3AT\d/.test(b.url) && /[?&]b=test-build/.test(b.url),
       "a bot connects with its own /join ticket and the build id" + (b.error ? " — " + b.error : " (" + String(b.url).replace(/^wss:\/\/[^/]+/, "") + ")"));
    ok(!b.error && b.spawned, "the bot's spawn frame reached the server" + (b.error ? "" : " (" + b.frames + " frames)"));
    /* From Connect to the bot's spawn: Cloudflare's check (0.9 s here), its
     * token straight to /join, the socket. A check that wants a click, a
     * busy API or a refused name each add their own wait. */
    if (r.signedin) ok(b.preloaded === 1, "signed in, Cloudflare's script is already loaded when the first bot is added (" + b.preloaded + " loads before)");
    if (!/interactive|slowclick|busy|silentname/.test(r.mode)) ok(b.ms !== null && b.ms <= 4000,
       "a bot is in quickly: " + b.ms + " ms from Connect to its spawn, the token spent the moment it came");
    if (r.mode.includes("kickname")) ok(/turned a bot away: This name belongs to someone else/.test(b.toast || ""),
       "a bot the server turns away says why, in the server's own words (said: " + JSON.stringify(b.toast || "") + ")");
    if (r.mode.includes("silentname")) ok(b.spawnedAs === "bot1201" && /never let it spawn/.test(b.toast || ""),
       "a bot the server silently will not spawn under its name says so and comes back under the next one (spawned as " +
       JSON.stringify(b.spawnedAs) + "; said: " + JSON.stringify(b.toast || "") + ")");
    if (r.mode.includes("slowclick")) ok(b.label === true && !b.error && b.spawned,
       "a bot's check that wants a click says so over its box in the corner, and waits 25 s for it (" + (b.label ? "label shown" : "no label") + ")");
    /* Typed as "bot1", slot 1: bot11, which the name check says belongs to
     * someone, so the bot steps past it to the next free number. */
    ok(!b.error && b.spawnName === "bot1101", "a bot's name carries its number and steps past one that is taken (typed bot1: bot11 is taken, joined as " +
       JSON.stringify(b.spawnName) + ")");
    /* As Glotus's bots join, and they get in on the live game: as this
     * browser — your moo_did, the device id the game sends with your own
     * join — and on the host name alone. */
    const d = b.devices || {};
    ok(!b.error && b.join && typeof d.mine === "string" && d.mine !== "" && b.join.did === d.mine && b.join.host === new URL(b.url).hostname,
       "a bot joins as this browser, the way Glotus's do: your device id (moo_did) and the server's host name (" +
       "yours " + JSON.stringify(d.mine) + ", the bot sent " + JSON.stringify(b.join && b.join.did) + " for " + JSON.stringify(b.join && b.join.host) + ")");
    ok(b.middle === null, "the bot's Cloudflare check never sits in the middle of the screen" + (b.middle ? " (" + b.middle + " was there)" : ""));
    // (+kickname sends the bot away on purpose: there is nothing after that to read)
    if (!r.mode.includes("kickname")) ok(!b.error && b.pings >= 2, "the bot reads what the server sends — it answered a pong with its next ping" +
       (r.pinned ? ", through the per-message mask" : "") + " (" + (b.pings || 0) + " pings)");
    ok(!b.error && b.violations.length === 0, "the server accepted every frame the bot sent — RYN's own signing" +
       (r.pinned ? " and masking" : "") + (b.violations && b.violations.length ? ": " + b.violations[0] : ""));
  }
  if (r.grind) {
    const g = r.grind;
    /* The great hammer reloads in 400 ms, which the server counts down in
     * 111 ms ticks: a swing every fifth tick, ~555 ms, at best. Over 8 s that
     * is 14; a client that keeps up gets most of them. */
    /* With the press held across the end of the reload, a swing every 556 ms
     * however the updates fall and however long a frame takes: +quiet+lag
     * used to drop it to one every 668. */
    if (r.mode.includes("lag")) ok(g.meanGap !== null && g.meanGap <= 600, "Auto Grind swings as fast as the great hammer allows with a 90 ms ping and a quiet server (mean gap " +
      g.meanGap + " ms; 556 is every fifth tick, 668 one tick late)");
    ok(g.swings >= Math.floor(g.ms / 800) && g.maxGap !== null && g.maxGap <= 1200, "Auto Grind keeps swinging while you stand still: " + g.swings +
       " swings in " + g.ms / 1000 + " s (" + g.hits + " landed), mean gap " + g.meanGap + " ms, longest " + g.maxGap + " ms, weapons " + g.weapons.join("/") +
       " (" + g.all + " swings since spawn" + (g.quiet !== null ? "; the server skipped " + g.quiet + " ticks with nothing in them" : "") + ")");
    /* The whole cycle, not just the swing: the turrets it hits break, the
     * count the server keeps of them comes down, and new ones go up. */
    const broke = g.events.filter(e => e === "destroy").length;
    const placedAfter = g.events.slice(g.events.indexOf("destroy") + 1).filter(e => e === "place").length;
    ok(broke >= 2 && placedAfter >= 2, "Auto Grind breaks its turrets and puts new ones down (" + broke + " broken, " + placedAfter +
       " placed after the first break" + (g.events.includes("place refused (limit)") ? ", some refused over the limit" : "") + ")");
    if (g.offState) ok(g.offToggled && g.afterOff === 0 && g.offState.mouseState === 0, "switched off in the menu, Auto Grind lets go of the attack (" +
       (g.offToggled ? g.afterOff + " swings after, mouse " + (g.offState.mouseState ? "still down" : "up") : "the menu's Auto Grind switch was not found") + ")");
    if (g.releasedState) ok(g.afterEnemy === 0 && g.releasedState.mouseState === 0, "with an enemy in reach Auto Grind stops and lets go of the attack (" +
       g.afterEnemy + " swings after, mouse " + (g.releasedState.mouseState ? "still down" : "up") + ")");
  }
  if (r.heal) ok(r.heal.ate, "Auto Heal eats when the server hurts me down to 60" + (r.heal.ate ? "" : " — sent: " + (r.heal.frames.join(" | ") || "nothing")));
  if (r.visuals) {
    const v = r.visuals;
    const firstBad = v.sweep.find(x => x.errors || x.faults);
    ok(v.styles.length >= 20 && v.errors.length === 0 && v.faults.length === 0,
       "every visual on, the rival killed under each of the " + v.styles.length + " kill animations: no page error, no render hook failed" +
       (firstBad ? " — first at " + firstBad.id + ": " + (v.errors[0] || v.faults[0]) : ""));
    const carded = v.sweep.filter(x => x.card).map(x => x.id);
    ok(carded.length === 0, "no kill animation opens the sign-in card" + (carded.length ? " — " + carded.join(", ") : ""));
  }
  if (r.kill) {
    const k = r.kill, last = k.seen[k.seen.length - 1] || {};
    const asked = k.seen.filter(v => v.accountCard || /sign|log ?in|account|register/i.test(v.notes + " " + v.toast));
    ok(asked.length === 0, "a kill brings up no sign-in card and no sign-in message" + (asked.length ? ": " + JSON.stringify(asked[0]) : ""));
    ok(k.errors.length === 0 && k.faults.length === 0, "RYN draws on through a kill: no page error, no render hook failed" +
       (k.errors.length ? ": " + k.errors[0] : k.faults.length ? ": " + k.faults[0] : ""));
    ok(last.overlayPx > 50, "RYN's overlay still draws three seconds after the kill (" + last.overlayPx + " px)");
  }
  if (r.trap) {
    const t = r.trap;
    // the boar is due east of me: a trap for it goes down at angle ~0
    ok(t.boar.length >= 1 && t.boar.every(a => Math.abs(a) < .6), "Trap Animal traps a boar (a 2025 animal) standing a step away — " +
       "sent once, never updated (" + (t.boar.length ? t.boar.length + " trap(s) at " + t.boar.map(a => a.toFixed(2)).join(", ") + " rad" : "no trap placed") + ")");
    ok(t.crab.length === 0, "Trap Animal leaves a crab alone — the game's traps cannot hold one (" + t.crab.length + " trap(s) placed)");
  }
  if (r.base !== "vanilla") {
    ok(r.after.overlayPx > 50, "RYN's overlay draws over the WebGL canvas (" + r.after.overlayPx + " px)");
    const hp = r.after.hpText;
    ok(hp && hp.px > 20 && Math.abs(hp.offset) <= 3, "the HP number sits centred under the player's bar" +
       (hp ? " (" + (hp.offset === null ? "not found" : "off by " + hp.offset + " px") + ", " + hp.px + " px of text)" : " (no overlay)"));
    const box = r.after.overlayBox;
    ok(box && box.overlay.join() === box.game.join() && box.px[0] === box.px[2] && box.px[1] === box.px[3],
       "RYN's overlay covers exactly the game canvas, at its resolution" + (box ? " (screen " + box.overlay.join(",") + " vs " + box.game.join(",") +
       "; pixels " + box.px.slice(0, 2).join("x") + " vs " + box.px.slice(2).join("x") + ")" : " (no overlay)"));
    ok(!r.renderFaults, "no RYN render hook failed" + (r.renderFaults ? ": " + r.renderFaults[0] : ""));
  }
  if (r.perf) {
    console.log("    PERF: " + r.perf.fps + " fps over 5 s; main thread busy " + r.perf.taskMs + " ms, script " + r.perf.scriptMs +
      " ms, gc " + r.perf.gc + " ms, idle " + r.perf.idle + " ms");
    console.log("      canvases: " + r.perf.layers.join(" | "));
    console.log("      " + r.perf.top.slice(0, +(process.env.PERF_TOP || 12)).join("\n      "));
  }
  if (r.zoom) {
    const z = r.zoom, ratio = z.before && z.out ? z.before / z.out : 0;
    ok(ratio > 1.9 && z.back && Math.abs(z.back - z.before) <= 2, "the zoom goes out and comes back: the HP bar " +
       (z.before || 0).toFixed(0) + " px, " + (z.out || 0).toFixed(0) + " px eight notches out (x" + ratio.toFixed(2) + " of 2.14), " +
       (z.back || 0).toFixed(0) + " px back in");
  }
  ok(r.canvasSizes === 0, "the game canvas is left alone between frames (" + r.canvasSizes + " size writes in 2 s standing still) — " +
     "resizing it every frame was the frame-rate drop");
  if (r.base === "vanilla") ok(r.centre.gridRatio > .05, "the ground grid is there without RYN — the measure sees it (" + r.centre.gridRatio + " of the grass)");
  else ok(r.centre.gridRatio < .03, "the ground grid is gone" + (r.mode.includes("restyled") ? ", though the bundle's grid code is not the shape RYN's hook looks for" : "") +
    " (" + r.centre.gridRatio + " of the grass is grid line)");
  if (r.base !== "vanilla" && /visuals|restyled|oddname/.test(r.mode)) ok(r.centre.namePx > 40, "my name is drawn in my colour" +
    (r.mode.includes("oddname") ? ", from the player itself — the renderer was handed it in a form RYN cannot tell is mine" : r.mode.includes("restyled") ? ", though the nameColor hook found nothing" : "") +
    " (" + r.centre.namePx + " px of #B388FF above me)");
  if (r.mode.includes("boss")) {
    if (r.base === "vanilla") ok(r.centre.kingBar === 0, "the game draws no health bar under a boss (" + r.centre.kingBar + " px) — the control");
    else ok(r.centre.kingBar > 150 && r.after.bossNumber, "the Crab King has a health bar under it, and its number, like any animal (" +
      r.centre.kingBar + " px of bar; number " + JSON.stringify(r.after.bossNumber) + ")");
  }
  if (r.store) {
    const broken = r.store.filter(i => !(i.w > 0));
    ok(r.store.length >= 5 && broken.length === 0, "every picture in the store loads" + (r.mode.includes("spritefail") ? ", each one refused once first" : "") +
      " (" + (r.store.length - broken.length) + "/" + r.store.length + (broken.length ? "; broken: " + broken.slice(0, 4).map(i => i.src).join(", ") : "") + ")");
    ok(r.centre.hatPx > 800, "the hat I wear is drawn on me" + (r.mode.includes("spritefail") ? ", though the site refused it once" : "") + " (" + r.centre.hatPx + " of 3600 centre px are the hat)");
  }
  ok(r.centre.skin > 300, "the player is drawn at the centre of the screen (" + r.centre.skin +
     " of 900 centre px are not grass " + r.centre.outline + ")");
}

(async () => {
  const modes = which === "all" ? ["vanilla", "fast", "late", "vanilla+pinned", "fast+pinned", "late+pinned",
    "vanilla+interactive", "fast+interactive", "late+interactive", "late+hidpi", "late+grind",
    "late+grind+quiet", "late+grind+heartbeat", "late+trap+quiet", "fast+pinned+reshaped", "late+pinned+reshaped",
    "fast+members", "fast+busy", "late+kill", "late+visuals", "late+heal", "fast+slowclick", "fast+silentname",
    "fast+kickname", "fast+tserror", "fast+signedin", "late+signedin", "fast+hats", "late+hats+spritefail", "late+restyled",
    "late+restyled+oddname", "late+boss", "late+grind+quiet+lag"] : which.split(",");
  for (const m of modes) {
    let r;
    try { r = await run(m); } catch (e) { console.log("\n== " + m + "\n  FAIL  harness crashed: " + e.stack); process.exitCode = 1; continue; }
    report(r);
    if (process.env.DUMP) console.log(JSON.stringify(r, null, 1).slice(0, 4000));
  }
})();
