/* End-to-end probe.
 *
 *   node play.js <client.js> [hooked|native]
 *
 * "hooked" opens the game socket through window.WebSocket, i.e. the client's
 * hook is in place when the game bundle captures the constructor.
 * "native" opens it through a constructor snapshotted before the client ran —
 * exactly what the game does when the userscript lands late.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");
const server = require("./server");

const HERE = __dirname;
const CLIENT = process.argv[2] || path.resolve(HERE, "../Whiteout_v4_1.user.js");
const MODE = process.argv[3] || "hooked";
const MIME = { ".html": "text/html", ".js": "text/javascript" };

const http_server = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const file = path.join(HERE, p);
  if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((r) => http_server.listen(8321, "127.0.0.1", r));
  const wss = server.start(8322, null);

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
  page.on("console", (m) => {
    // willReadFrequently is the browser reacting to this probe's own pixel
    // readbacks, not to anything the client does.
    if (m.text().includes("willReadFrequently")) return;
    if (m.type() === "error" || m.type() === "warning") errors.push(m.type().toUpperCase() + ": " + m.text().slice(0, 240));
  });

  // Snapshot the pristine constructor the way the game bundle's line 34 does,
  // before the client gets a chance to install its hook.
  await page.addInitScript({ content: "window.__nativeWS = window.WebSocket;" });
  await page.addInitScript({ content: fs.readFileSync(CLIENT, "utf8") });

  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await page.waitForTimeout(1500);

  await page.evaluate((mode) => {
    const Ctor = mode === "native" ? window.__nativeWS : window.WebSocket;
    const sock = new Ctor("ws://127.0.0.1:8322");
    sock.binaryType = "arraybuffer";
    window.__gameSocket = sock;
    // The game bundle installs its own onmessage; mimic that so the ordering
    // between the client's listener and the game's handler is realistic.
    sock.onmessage = function () {};
  }, MODE);

  await page.waitForTimeout(8000);

  const probe = await page.evaluate(() => {
    const out = {};
    const c = document.getElementById("gameCanvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const px = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return d[0] + "," + d[1] + "," + d[2]; };
    out.center = px(Math.floor(c.width / 2), Math.floor(c.height / 2));
    // Sample a grid; a live world has many distinct colours, an empty one has ~1.
    const seen = new Set();
    for (let x = 20; x < c.width; x += 40) for (let y = 20; y < c.height; y += 40) seen.add(px(x, y));
    out.distinctColours = seen.size;
    return out;
  });

  console.log("mode:", MODE);
  console.log(JSON.stringify(probe, null, 2));
  const seen = new Set();
  console.log("errors:");
  for (const e of errors) { const k = e.slice(0, 150); if (seen.has(k)) continue; seen.add(k); console.log("  " + e); }

  await page.screenshot({ path: path.join(HERE, "shot-" + MODE + ".png") });
  await browser.close();
  wss.close();
  http_server.close();
})();
