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
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const server = require("./server");

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
const tag = id => CANVAS.has(id) ? `<canvas id="${id}" width="1280" height="720"></canvas>`
  : CHECK.has(id) ? `<input id="${id}" type="checkbox">`
  : TEXT.has(id) ? `<input id="${id}" type="text" value="">`
  : id === "gameMenuTabs" ? `<div id="${id}"><a data-tab="settings"></a><a data-tab="clan"></a><a data-tab="friends"></a></div>`
  : id === "enterGame" ? `<div id="${id}" class="menuButton"><span>Enter Game</span></div>`
  : `<div id="${id}"><span></span></div>`;

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
    requestEmailLoginCode: function () { window.__loginCodeRequested = true; return Promise.resolve({}); },
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
</style>
</head>
<body>
<div id="menuContainer">
${ids.map(tag).join("\n")}
<div id="menuNav"><a data-view="play">Play</a><a data-view="settings">Settings</a><a data-view="friends">Friends</a></div>
<div class="menuView" data-view="play"><div class="viewBack"></div><div class="viewBody"></div></div>
<div class="menuView" data-view="settings"><div class="viewBack"></div><div class="viewBody"></div></div>
<div class="menuView" data-view="friends"><div class="viewBack"></div><div class="viewBody"><span class="friendsOnline"></span></div></div>
<div class="staffPanel"></div><span class="noteDot"></span>
</div>
${Array.from({ length: 23 }, (_, i) => `<div id="actionBarItem${i}"></div>`).join("")}
</body>
</html>`;

const PROTOCOL_MODULE = `export const BUILD_ID = "test-build";
export const BUILD_SALT = 7;
export function mixKey(key, seed) { return key; }`;

const TURNSTILE = `window.turnstile = {
  render: function (el, o) { window.__tsRenders = (window.__tsRenders || 0) + 1;
    setTimeout(function () { o && o.callback && o.callback("cf-token-" + Date.now()); }, 60); return "ts1"; },
  reset: function () {}, remove: function () {}, getResponse: function () { return null; },
};`;

const SERVERS = [
  { region: "us-east", name: "1", key: "abc1", playerCount: 12, playerCapacity: 40 },
  { region: "us-east", name: "2", key: "abc2", playerCount: 30, playerCapacity: 40 },
  { region: "eu-west", name: "1", key: "def1", playerCount: 5, playerCapacity: 40 },
  { region: "eu-west", name: "9", key: "def9", playerCount: 3, playerCapacity: 40, auth: true },
];

// ── one run ───────────────────────────────────────────────────────────────
async function run(mode) {
  const out = { mode, errors: [], consoleErrors: [], sockets: [], joins: [], frames: [], notes: [] };
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on("pageerror", e => out.errors.push(String(e && e.stack || e).split("\n").slice(0, 4).join(" | ")));
  page.on("console", m => {
    if (m.type() === "error") out.consoleErrors.push(m.text().slice(0, 300));
    if (process.env.VERBOSE) console.log("    [console." + m.type() + "] " + m.text().slice(0, 300));
  });

  const ryn = fs.readFileSync(RYN_PATH, "utf8");
  let html = PAGE;
  if (mode === "late") {
    // A userscript manager that injects once <head> exists: the module tag has
    // already been parsed (and so will run), loadedFast is false.
    html = html.replace("</head>", "<script>" + ryn.replace(/<\/script/gi, "<\\/script") + "</script>\n</head>");
  }

  await context.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    const send = (body, type, status) => route.fulfill({ status: status || 200, contentType: type, body,
      headers: { "access-control-allow-origin": "*" } });
    if (url.hostname === "moomoo.io") {
      if (url.pathname === "/" ) return send(html, "text/html");
      if (url.pathname === "/assets/" + INDEX) return send(bundle, "text/javascript");
      if (url.pathname === "/assets/" + VENDOR) return send(vendor, "text/javascript");
      if (url.pathname === "/assets/" + PROTO) return send(PROTOCOL_MODULE, "text/javascript");
      return send("", "text/plain", 404);
    }
    if (url.hostname === "cdn.frvr.com") return send(FRVR_SDK, "text/javascript");
    if (url.hostname === "challenges.cloudflare.com") return send(TURNSTILE, "text/javascript");
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
        return send(JSON.stringify({ ticket: "T" + out.joins.length, did: "did-1" }), "application/json");
      }
      if (url.pathname === "/name-check") return send("{}", "application/json");
      if (url.pathname === "/top") return send(JSON.stringify({ players: [], clans: [] }), "application/json");
      return send("{}", "application/json");
    }
    if (/\.moomoo\.io$/.test(url.hostname) && url.pathname === "/ping") return send("ok", "text/plain");
    out.aborted = (out.aborted || []).concat(req.url().slice(0, 120));
    return route.abort();
  });

  await context.routeWebSocket(/^wss:\/\/[^/]*moomoo\.io/, ws => {
    out.sockets.push(ws.url());
    const handlers = { message: [], close: [] };
    const sock = {
      send: buf => { try { ws.send(Buffer.from(buf)); } catch (e) {} },
      on: (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); },
      close: (code, reason) => { try { ws.close({ code, reason }); } catch (e) {} },
    };
    ws.onMessage(m => { const b = typeof m === "string" ? Buffer.from(m) : m; handlers.message.forEach(f => f(b)); });
    ws.onClose(() => handlers.close.forEach(f => f()));
    server.attach(sock, (...a) => out.frames.push(a.join(" ").slice(0, 160)), {
      requireSpawn: true,
      proto: 2025,
      onViolation: (why, detail) => out.notes.push("server rejected a frame: " + why + (detail ? " (" + detail + ")" : "")),
    });
  });

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
    await page.addInitScript({ content: "window.__headAtStart = document.head === null;\n" + ryn });
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
    lobbyRows: document.querySelectorAll("#ryn-lobby [data-server], #ryn-lobby .ryn-server-row, #ryn-lobby .row").length,
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

  // join: type a name, press the real button with a real click
  try {
    await page.fill("#nameInput", "tester");
  } catch (e) { out.notes.push("could not type a name: " + e.message.split("\n")[0]); }
  try {
    await page.click("#enterGame", { timeout: 5000, force: true });
    out.clicked = true;
  } catch (e) { out.clicked = false; out.notes.push("could not click #enterGame: " + e.message.split("\n")[0]); }

  // wait for the spawn frame to reach the server, then for a few world ticks
  const t0 = Date.now();
  while (Date.now() - t0 < 12000 && !out.frames.some(f => /^c2s M /.test(f))) await page.waitForTimeout(200);
  out.spawnSent = out.frames.some(f => /^c2s M /.test(f));
  await page.waitForTimeout(2500);

  out.after = await page.evaluate(() => ({
    enterGame: (() => { const b = document.getElementById("enterGame"); if (!b) return null; const r = b.getBoundingClientRect();
      return { cls: b.className, rect: [r.x, r.y, r.width, r.height].map(Math.round), top: (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) || {}).id }; })(),
    tsRenders: window.__tsRenders,
    texts: ["loadingText", "nameHint", "signInHint", "verifyText", "menuNotice", "serverNote"].map(id => {
      const e = document.getElementById(id); return e && e.textContent.trim() ? id + "=" + e.textContent.trim().slice(0, 80) : null; }).filter(Boolean),
    gameUI: (() => { const g = document.getElementById("gameUI"); return g ? getComputedStyle(g).display : null; })(),
    menuShown: (() => { const m = document.getElementById("menuCardHolder"); return m ? getComputedStyle(m).display : null; })(),
    renderer: !!window.__renderer, drawCalls: window.__drawCalls,
  }));

  if (mode !== "vanilla") {
    const code = await page.evaluate(() => window.__rynBundleCode || null);
    out.bundleRan = !!code;
    if (code) fs.writeFileSync(path.join(__dirname, "boot-2025-" + mode + ".bundle.js"), code);
  }

  // Is the player on screen? It spawns at the centre of the view; compare the
  // middle of the frame against a ring around it.
  const shot = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(__dirname, "boot-2025-" + mode + ".png"), shot);
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
    return { distinctColours: colours.size, skin, outline };
  }, shot.toString("base64"));

  await browser.close();
  return out;
}

function report(r) {
  const ok = (c, s) => console.log("  " + (c ? "ok  " : "FAIL") + "  " + s);
  console.log("\n== " + r.mode + (r.mode === "vanilla" ? " (control, no RYN)" : " (RYN " + path.basename(RYN_PATH) + ")"));
  if (r.state.headAtStart !== undefined) console.log("    document.head at RYN start: " + (r.state.headAtStart ? "null (loadedFast)" : "present"));
  ok(r.errors.length === 0, "no uncaught page errors" + (r.errors.length ? ":\n        " + r.errors.slice(0, 6).join("\n        ") : ""));
  const ce = r.consoleErrors.filter(t => !/Failed to load resource|ERR_FAILED|net::/.test(t));
  if (ce.length) console.log("    console errors:\n        " + ce.slice(0, 8).join("\n        "));
  ok(r.gameServerList, "the game's own server list loaded (" + r.state.regionDropdown + " regions, " + r.state.serverDropdown + " servers)");
  if (r.mode !== "vanilla") {
    ok(r.state.hasRynLobby, "RYN's lobby is built");
    ok(!/WAITING FOR THE SERVER LIST/i.test(r.state.lobbyText), "RYN's server panel is not stuck waiting");
    console.log("    lobby: " + r.state.lobbyText.slice(0, 300));
    ok(r.state.ads === 0, "no interstitial ad was requested (" + r.state.ads + ")");
    ok(r.state.frvrHasAuth, "FRVR.auth is intact, so sign-in can work");
    ok(!r.state.userscriptWarning, "the game's userscript warning banner is not shown");
  }
  if (process.env.VERBOSE && r.aborted) console.log("    aborted: " + [...new Set(r.aborted)].join("\n             "));
  ok(!r.oldApi, "nothing asks the retired api.moomoo.io host" + (r.oldApi ? " (" + [...new Set(r.oldApi)].join(", ") + ")" : ""));
  if (process.env.VERBOSE) console.log("    after click: " + JSON.stringify({ enterGame: r.after.enterGame, ts: r.after.tsRenders, texts: r.after.texts }));
  ok(r.clicked, "the Enter Game button could be clicked");
  ok(r.joins.length > 0, "the join went through api /join (" + r.joins.length + ")" +
     (r.joins[0] ? " — " + JSON.stringify(r.joins[0]).slice(0, 120) : ""));
  ok(r.sockets.length === 1, "exactly one game socket opened (" + r.sockets.length + ")" +
     (r.sockets.length ? ": " + r.sockets.join(" , ").slice(0, 200) : ""));
  ok(r.sockets.every(u => /token=tk%3AT\d/.test(u) && /[?&]b=test-build/.test(u)),
     "the socket carries the /join ticket (tk:) and ?b=<BUILD_ID>");
  ok(r.spawnSent, "the spawn frame reached the server");
  ok(r.notes.filter(n => /server rejected/.test(n)).length === 0, "the server accepted every frame" +
     (r.notes.length ? ":\n        " + r.notes.slice(0, 5).join("\n        ") : ""));
  ok(r.after.gameUI && r.after.gameUI !== "none", "the in-game UI is showing (" + r.after.gameUI + ")");
  ok(r.centre.skin > 300, "the player is drawn at the centre of the screen (" + r.centre.skin +
     " of 900 centre px are not grass " + r.centre.outline + ")");
}

(async () => {
  const modes = which === "all" ? ["vanilla", "fast", "late"] : which.split(",");
  for (const m of modes) {
    let r;
    try { r = await run(m); } catch (e) { console.log("\n== " + m + "\n  FAIL  harness crashed: " + e.stack); process.exitCode = 1; continue; }
    report(r);
    if (process.env.DUMP) console.log(JSON.stringify(r, null, 1).slice(0, 4000));
  }
})();
