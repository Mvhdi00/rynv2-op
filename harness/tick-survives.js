/* Can one player's data stop the whole world?
 *
 * playerUpdate is the tick everything hangs off: it marks who is on screen,
 * refreshes every player's derived state, and then rebuilds the object lists,
 * the pathfinder position and the bot state. It is async, so a throw inside it
 * becomes an unhandled rejection — nothing in the console anyone would notice —
 * and the rest of the loop never runs. Every player after the bad one stays
 * invisible, your own included, while the objects and the leaderboard keep
 * updating from their own handlers.
 *
 * That is indistinguishable, on screen, from never having joined: a world drawn
 * with nobody in it and no response to any key.
 *
 * So feed it a tick whose FIRST record is malformed and check that the players
 * behind it still arrive.
 *
 *   node tick-survives.js [client.js]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");
const server = require("./server");
const inject = require("./inject");

const HERE = __dirname;
const CLIENT = process.argv[2] || path.resolve(HERE, "../revelation/Revelation.user.js");
const MIME = { ".html": "text/html", ".js": "text/javascript" };

const SERVER_LIST = `
(function () {
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input) {
    const url = String((input && input.url) || input);
    if (url.includes("/servers")) {
      return Promise.resolve(new Response(JSON.stringify([{
        region: 1, key: "0", name: "mock", index: 0, port: 8322,
        playerCount: 1, playerCapacity: 50
      }]), { status: 200, headers: { "content-type": "application/json" } }));
    }
    return realFetch.apply(this, arguments);
  };
})();
`;

const REDIRECT = `
(function () {
  const Native = window.WebSocket;
  function Redirected(url, protocols) {
    const target = "ws://127.0.0.1:8322";
    return protocols === undefined ? new Native(target) : new Native(target, protocols);
  }
  Redirected.prototype = Native.prototype;
  Redirected.CONNECTING = Native.CONNECTING; Redirected.OPEN = Native.OPEN;
  Redirected.CLOSING = Native.CLOSING; Redirected.CLOSED = Native.CLOSED;
  try { window.WebSocket = Redirected; } catch (e) {}
})();
`;

const HOOK = `
;try { window.__rev = {
  gate: typeof Oh === "function" ? Oh : null,
  /* The server keeps ticking underneath, so a later good tick would mask the
   * result. Clear everyone, run exactly this tick, and read the answer before
   * yielding — the per-player loop is synchronous up to its first await. */
  probe: function (arr) {
    (typeof J !== "undefined" ? J : []).forEach(function (p) { p.visible = false; });
    var sync = null;
    try {
      var r = playerUpdate(arr);
      if (r && r.catch) r.catch(function () {});
    } catch (e) { sync = "threw synchronously: " + e.message; }
    return { meVisible: !!(typeof E !== "undefined" && E && E.visible), sync: sync };
  },
  vis: function () { return (typeof J !== "undefined" ? J : []).map(function (p) {
    return { sid: p.sid, name: p.name, visible: p.visible }; }); },
  me: function () { return (typeof E !== "undefined" && E) ? { sid: E.sid, visible: E.visible } : null; },
}; } catch (e) { window.__revErr = String(e); }`;

/* A tick with two players in it. The first record is poisoned; the second is
 * the local player, so if the loop gives up on the first, you disappear. */
function tick(poison) {
  const mid = 7e3;
  const rival = [2, mid + 150, mid + 40, 3, -1, poison, 1, null, 0, 6, 11, 1, 0];
  const me = [1, mid, mid, 0, -1, 0, 0, null, 0, 0, 0, 0, 0];
  return rival.concat(me);
}

(async () => {
  const http_server = http.createServer((req, res) => {
    let p = req.url.split("?")[0];
    if (p === "/") p = "/index.html";
    const file = path.join(HERE, p);
    if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => http_server.listen(8321, "127.0.0.1", r));
  const wss = server.start(8322, null, { requireSpawn: true });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const reported = [];
  const rejections = [];
  page.on("console", (m) => { if (m.text().includes("[revelation]")) reported.push(m.text().slice(0, 120)); });
  page.on("pageerror", (e) => rejections.push(String(e.message).slice(0, 120)));

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });
  await page.addInitScript({ content: `window.addEventListener("unhandledrejection", (e) => {
    window.__unhandled = window.__unhandled || [];
    window.__unhandled.push(String((e.reason && e.reason.message) || e.reason).slice(0, 120));
  });` });

  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8") + HOOK);
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await installed.finish();
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    try { if (typeof window.onGotTurnstileToken === "function") window.onGotTurnstileToken("stub-token"); } catch (e) {}
    if (window.__rev && window.__rev.gate) window.__rev.gate();
  });
  await page.waitForTimeout(3000);

  /* Poison values, mildest first: a weapon index the tables do not have, then
   * one that is not a number at all. Each is a thing a live server, a modded
   * peer, or a new game version can put in a tick. */
  const cases = [
    ["a weapon index off the end of the table", 999],
    ["a weapon index that is not a number", "x"],
    ["a null weapon index", null],
  ];

  const rows = [];
  for (const [label, poison] of cases) {
    const out = await page.evaluate((t) => { window.__unhandled = []; return window.__rev.probe(t); }, tick(poison));
    await page.waitForTimeout(400);
    const unhandled = await page.evaluate(() => window.__unhandled || []);
    rows.push({ label, meVisible: out.meVisible, unhandled, threw: out.sync });
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(path.basename(CLIENT) + " — a bad record ahead of you in the tick\n");
  console.log(pad("poisoned field", 42) + pad("you are drawn", 15) + "what the tick did");
  console.log("-".repeat(80));
  let bad = 0;
  for (const r of rows) {
    if (!r.meVisible) bad++;
    console.log(pad(r.label, 42) + pad(r.meVisible ? "yes" : "NO", 17) +
      (r.threw ? String(r.threw).slice(0, 62)
        : r.unhandled.length ? "died silently: " + r.unhandled[0].slice(0, 47)
        : "survived"));
  }
  if (reported.length) console.log("\n  the client reported: " + [...new Set(reported)].slice(0, 4).join("\n                       "));
  console.log("\n  " + (bad
    ? bad + " of " + rows.length + " ticks left you off the screen"
    : "every tick still put you on the screen"));

  await browser.close();
  wss.close();
  http_server.close();
  process.exit(bad ? 1 : 0);
})();
