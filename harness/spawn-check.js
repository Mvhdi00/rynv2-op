/* Does the client draw your own character after it spawns?
 *
 * play.js opens the socket itself, which suits a client that hooks
 * window.WebSocket. A client that connects on its own — Revelation carries its
 * own copy of the game — never sees that socket, so it sits on its menu
 * background and proves nothing. Here every WebSocket the page opens is
 * redirected to the mock server instead, so the client's own connection is the
 * one under test.
 *
 * Then it spawns a player at a known spot and looks for them on the canvas.
 *
 *   node spawn-check.js [client.js]
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

const http_server = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const file = path.join(HERE, p);
  if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});

/* The server list never loads in a sandbox with no outbound network, so a
 * client that connects on its own never opens a socket at all. Hand it one
 * server so it gets as far as connecting; the ping fetches are allowed to fail,
 * which the game's own code tolerates. */
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

/* Point every socket the page opens at the mock, whoever opens it. */
const REDIRECT = `
(function () {
  const Native = window.WebSocket;
  function Redirected(url, protocols) {
    window.__wsUrls = window.__wsUrls || [];
    window.__wsUrls.push(String(url));
    const target = "ws://127.0.0.1:8322";
    return protocols === undefined ? new Native(target) : new Native(target, protocols);
  }
  Redirected.prototype = Native.prototype;
  Redirected.CONNECTING = Native.CONNECTING; Redirected.OPEN = Native.OPEN;
  Redirected.CLOSING = Native.CLOSING; Redirected.CLOSED = Native.CLOSED;
  try { window.WebSocket = Redirected; } catch (e) {}
})();
`;

(async () => {
  await new Promise((r) => http_server.listen(8321, "127.0.0.1", r));
  const wss = server.start(8322, null);

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "warning" && m.text().includes("[")) errors.push("WARN: " + m.text().slice(0, 200));
  });

  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });
  /* The client's own top-level names are not on window. Since the harness is
   * what evaluates the source, append an export in the same scope — a test hook
   * that leaves the shipped file untouched. */
  let source = fs.readFileSync(CLIENT, "utf8");
  if (source.includes("const ee = {")) {
    source += `
;try { window.__rev = {
  connect: typeof gn === "function" ? gn : null,
  socket: function () { return ee.socket; },
  state: function () { return { net: typeof revNet !== "undefined" ? revNet : "absent",
                                me: typeof E !== "undefined" && E ? { sid: E.sid, x: E.x, y: E.y, visible: E.visible, alive: E.alive } : null,
                                players: typeof J !== "undefined" ? J.length : -1 }; }
}; } catch (e) { window.__revErr = String(e); }`;
  }
  const installed = await inject.install(page, source);
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await installed.finish();
  await page.waitForTimeout(1500);

  // Drive the client's own connect, past the captcha gate the sandbox cannot pass.
  const connected = await page.evaluate(() => {
    if (window.__rev && window.__rev.connect) { try { window.__rev.connect(); return "called"; } catch (e) { return "threw: " + e.message; } }
    const play = document.getElementById("enterGame");
    if (play) { play.click(); return "clicked"; }
    return "no way in";
  });
  await page.waitForTimeout(6000);
  const state = await page.evaluate(() => (window.__rev ? window.__rev.state() : window.__revErr || null));

  const result = await page.evaluate(() => {
    const out = {};
    out.socketsOpened = (window.__wsUrls || []).length;
    const c = document.getElementById("gameCanvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    // The player is drawn at the centre of the view. A body is a filled disc of
    // skin colour with a dark outline, so look for a distinct blob there.
    const w = c.width, h = c.height;
    const img = ctx.getImageData(Math.floor(w / 2) - 90, Math.floor(h / 2) - 90, 180, 180).data;
    const seen = new Map();
    for (let i = 0; i < img.length; i += 4) {
      const k = img[i] + "," + img[i + 1] + "," + img[i + 2];
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    out.coloursAtCentre = seen.size;
    out.topColours = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, n]) => k + " x" + n);
    return out;
  });

  console.log(path.basename(CLIENT), "| run-at:", installed.when);
  console.log("  connect:", connected);
  console.log("  client state:", JSON.stringify(state));
  console.log("  sockets the page opened:", result.socketsOpened);
  console.log("  distinct colours where the player should be:", result.coloursAtCentre);
  console.log("  most common:", result.topColours.join("  "));
  console.log("  character drawn:", result.coloursAtCentre > 3 ? "likely yes" : "NO — the middle is flat background");
  if (errors.length) console.log("  errors:", [...new Set(errors)].slice(0, 4).join(" | "));

  await page.screenshot({ path: path.join(HERE, "spawn-" + path.basename(CLIENT) + ".png") });
  await browser.close();
  wss.close();
  http_server.close();
})();
