/* Measures a render loop directly instead of inferring it from pixels.
 *
 * chaos.js watches the canvas, which is only a proxy: a client sitting on a
 * menu barely animates, so two samples can match while the loop is perfectly
 * alive. Where the client exposes its frame scheduler on window, counting calls
 * to it answers the question outright — a loop that reschedules itself keeps
 * calling, a dead one stops.
 *
 *   node loop-alive.js <client.js> <window-scheduler> <render-anchor-line>
 *
 * e.g. node loop-alive.js ../revelation/Revelation.user.js requestAFrame "    if (mi < 120) {"
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");
const inject = require("./inject");

const HERE = __dirname;
const SRC = process.argv[2] || path.resolve(HERE, "../revelation/Revelation.user.js");
const SCHEDULER = process.argv[3] || "requestAFrame";
const ANCHOR = process.argv[4] || "function Of() {";
const MIME = { ".html": "text/html", ".js": "text/javascript" };

let client = fs.readFileSync(SRC, "utf8");
if (!client.includes(ANCHOR)) throw new Error("anchor not found in " + path.basename(SRC));
client = client.replace(ANCHOR, ANCHOR + `
    if (window.__chaos) { throw new Error("injected mid-frame fault"); }`);

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
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const installed = await inject.install(page, client);
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await installed.finish();
  await page.waitForTimeout(1000);

  // Count reschedules by wrapping the client's own scheduler.
  const wrapped = await page.evaluate((name) => {
    const original = window[name];
    if (typeof original !== "function") return false;
    window.__frames = 0;
    window[name] = function (fn) { window.__frames++; return original.apply(this, arguments); };
    return true;
  }, SCHEDULER);
  if (!wrapped) {
    console.log("window." + SCHEDULER + " is not a function on this client");
    await browser.close(); http_server.close(); return;
  }

  const count = async () => {
    const a = await page.evaluate(() => window.__frames);
    await page.waitForTimeout(500);
    return (await page.evaluate(() => window.__frames)) - a;
  };

  const before = await count();
  await page.evaluate(() => { window.__chaos = true; });
  await page.waitForTimeout(300);
  const during = await count();
  await page.evaluate(() => { window.__chaos = false; });
  await page.waitForTimeout(300);
  const after = await count();

  console.log(path.basename(SRC));
  console.log("  frames per 500ms, before fault:", before);
  console.log("  during fault:                  ", during);
  console.log("  after fault cleared:           ", after);
  console.log("  loop survived:", after > 0 ? "YES" : "NO — the loop is dead");

  await browser.close();
  http_server.close();
})();
