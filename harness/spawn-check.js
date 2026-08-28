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

const frames = [];

(async () => {
  await new Promise((r) => http_server.listen(8321, "127.0.0.1", r));
  /* Like the real one: it only puts you in the world once it accepts a spawn
   * frame, and it says out loud when a frame does not verify. */
  const violations = [];
  const wss = server.start(8322, (...a) => frames.push(a.slice(1).join(" ")), {
    requireSpawn: true,
    onViolation: (why, detail) => violations.push(why + (detail ? " (" + detail + ")" : "")),
  });

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
  gate: typeof Oh === "function" ? Oh : null,
  gateState: function () { return { ready: typeof ps !== "undefined" ? ps : "absent",
                                    token: typeof code !== "undefined" ? code : "absent",
                                    kind: typeof revTokenKind !== "undefined" ? revTokenKind : "absent" }; },
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

  /* Go through the client's real captcha gate rather than around it: hand the
   * page a Turnstile token the way the game does, then press Play. This is the
   * path that was dead — the client only ever connected if `code` was set, and
   * nothing set it. */
  const gate = await page.evaluate(() => {
    const out = {};
    try {
      if (typeof window.onGotTurnstileToken === "function") {
        window.onGotTurnstileToken("stub-token");
        out.tokenDelivered = true;
      }
    } catch (e) { out.tokenError = e.message; }
    out.beforePlay = window.__rev ? window.__rev.gateState() : null;
    try {
      if (window.__rev && window.__rev.gate) { window.__rev.gate(); out.played = "gate"; }
      else { const b = document.getElementById("enterGame"); if (b) { b.click(); out.played = "click"; } }
    } catch (e) { out.playError = e.message; }
    return out;
  });
  await page.waitForTimeout(2500);
  const connected = JSON.stringify(gate);
  await page.waitForTimeout(6000);
  const state = await page.evaluate(() => (window.__rev ? window.__rev.state() : window.__revErr || null));

  const result = await page.evaluate(() => {
    const out = {};
    out.socketsOpened = (window.__wsUrls || []).length;
    const c = document.getElementById("gameCanvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    /* The camera is locked to your player, so your body is drawn at the exact
     * centre of the canvas: a filled disc of skin colour, big enough to cover
     * the middle but far too small to be the background. Counting distinct
     * colours here is not enough — a washed-out world with nobody in it still
     * has hundreds. So take the centre pixel and ask how far it spreads. */
    const w = c.width, h = c.height, R = 90;
    const img = ctx.getImageData(Math.floor(w / 2) - R, Math.floor(h / 2) - R, R * 2, R * 2).data;
    const key = (i) => img[i] + "," + img[i + 1] + "," + img[i + 2];
    const seen = new Map();
    for (let i = 0; i < img.length; i += 4) seen.set(key(i), (seen.get(key(i)) || 0) + 1);
    const centre = key((R * (R * 2) + R) * 4);
    const sorted = [...seen.entries()].sort((a, b) => b[1] - a[1]);
    out.coloursAtCentre = seen.size;
    out.topColours = sorted.slice(0, 3).map(([k, n]) => k + " x" + n);
    out.centreColour = centre;
    out.centreSpread = seen.get(centre) || 0;
    out.background = sorted[0][0];
    // A body covers a few percent of this box. Background is tens of percent.
    out.isBody = centre !== sorted[0][0] && out.centreSpread > 150 && out.centreSpread < (R * 2) * (R * 2) * 0.4;
    return out;
  });

  console.log(path.basename(CLIENT), "| run-at:", installed.when);
  console.log("  captcha gate:", connected);
  console.log("  connect url:", await page.evaluate(() => (window.__wsUrls || [])[0] || "(none)"));
  console.log("  client state:", JSON.stringify(state));
  console.log("  sockets the page opened:", result.socketsOpened);
  console.log("  frames the server accepted:", frames.length ? frames.slice(0, 4).join(" | ") : "NONE");
  console.log("  frames it rejected:", violations.length ? [...new Set(violations)].join(" | ") : "none");
  console.log("  colour at the exact centre:", result.centreColour,
    "spreading over", result.centreSpread, "px");
  console.log("  background there:", result.background, " (" + result.coloursAtCentre + " distinct colours)");
  console.log("  your character drawn:", result.isBody
    ? "YES — a body-sized blob distinct from the ground"
    : "NO — the centre is the same as the ground behind it");
  if (errors.length) console.log("  errors:", [...new Set(errors)].slice(0, 4).join(" | "));

  await page.screenshot({ path: path.join(HERE, "spawn-" + path.basename(CLIENT) + ".png") });
  await browser.close();
  wss.close();
  http_server.close();
})();
