/* Injects a transient mid-frame throw, of the exact shape the bowTie draw had
 * (a throw after ctx.save() and before the matching restore()), then clears it.
 * A loop that only survives lucky frames stays broken after the fault goes
 * away; a loop that resets its state per frame comes straight back.
 *
 *   node chaos.js [client.js] [render-anchor-line]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");
const server = require("./server");
const inject = require("./inject");

const HERE = __dirname;
const SRC = process.argv[2] || path.resolve(HERE, "../whiteout/Whiteout_v4_1.user.js");
const MIME = { ".html": "text/html", ".js": "text/javascript" };

/* A line inside the client's per-frame render, after which the fault is
 * injected. Differs per client, so it can be passed in. */
const ANCHORS = [
  "    renderVolcanoDamageZone(xOffset, yOffset);",   // Whiteout
  "                // DEATH TEXT:",                    // Novastorm
  "function Of() {",                                  // Revelation
];
const ANCHOR = process.argv[3] || ANCHORS.find((a) => fs.readFileSync(SRC, "utf8").includes(a));
if (!ANCHOR) throw new Error("no known render anchor in " + path.basename(SRC) + "; pass one as argv[3]");
const INJECT = ANCHOR + `
    if (window.__chaos) { mainContext.save(); mainContext.translate(9999, 9999); throw new Error("injected mid-frame fault"); }`;

let client = fs.readFileSync(SRC, "utf8");
if (!client.includes(ANCHOR)) throw new Error("anchor not found");
client = client.replace(ANCHOR, INJECT);

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

  await page.addInitScript({ content: "window.__nativeWS = window.WebSocket;" });
  const installed = await inject.install(page, client);
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await installed.finish();
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    const s = new window.WebSocket("ws://127.0.0.1:8322");
    s.binaryType = "arraybuffer";
    s.onmessage = function () {};
  });
  await page.waitForTimeout(2000);

  /* Colour count alone cannot tell a healthy frame from a frozen one: a wedged
   * loop leaves the last good image on the canvas and it still looks rich. So
   * also check liveness — the scene animates, so a loop that is really drawing
   * produces a different image 250ms later. */
  const snapshot = () => page.evaluate(() => {
    const c = document.getElementById("gameCanvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const seen = new Set();
    let sig = "";
    for (let x = 20; x < c.width; x += 40) for (let y = 20; y < c.height; y += 40) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      const px = d[0] + "," + d[1] + "," + d[2];
      seen.add(px);
      sig += px + ";";
    }
    return { colours: seen.size, sig };
  });

  const sample = async () => {
    const a = await snapshot();
    await page.waitForTimeout(250);
    const b = await snapshot();
    return { colours: b.colours, live: a.sig !== b.sig };
  };

  const before = await sample();
  await page.evaluate(() => { window.__chaos = true; });
  await page.waitForTimeout(1000);
  const during = await sample();
  await page.evaluate(() => { window.__chaos = false; });
  await page.waitForTimeout(1000);
  const after = await sample();

  const show = (label, s) => console.log("  " + label.padEnd(20), "colours=" + String(s.colours).padStart(2), "drawing=" + (s.live ? "yes" : "no"));
  console.log(path.basename(SRC));
  show("before fault", before);
  show("during fault", during);
  show("after fault cleared", after);
  const ok = after.live && after.colours >= Math.round(before.colours * 0.8);
  console.log("  recovered:", ok ? "YES" : "NO");

  await page.screenshot({ path: path.join(HERE, "chaos-" + path.basename(SRC) + ".png") });
  await browser.close();
  wss.close();
  http_server.close();
})();
