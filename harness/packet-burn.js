/* How many packets a second does the client actually send, and does replace
 * push it over the line?
 *
 * moomoo drops a client that sends too fast, and this file guards its placements
 * with `packets + 5 > 119` against a counter that resets every second. That
 * guard only covers placements: attacks, aim, hat swaps and weapon selects all
 * increment the same counter without asking. So a placer that fires four
 * placements at four packets each does not break the guard, it eats the budget
 * everything else was going to spend.
 *
 * "Feels like it burns packets" is measurable, so measure it: destroy one of the
 * player's buildings every second and count what leaves the socket, with replace
 * off and on. The mock counts every frame it verifies, which is every frame the
 * client sends.
 *
 *   node packet-burn.js [client.js]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");
const server = require("./server");
const inject = require("./inject");

const HERE = __dirname;
const CLIENT = process.argv[2] || path.resolve(HERE, "../xprecision/X_Precision_2.0.user.js");
const MIME = { ".html": "text/html", ".js": "text/javascript" };

const LIMIT = 119;          // the number the client's own guard is written against
const WINDOW = 8000;        // long enough for several one-second buckets

const SERVER_LIST = (port) => `
(function () {
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input) {
    const url = String((input && input.url) || input);
    if (url.includes("/servers")) {
      return Promise.resolve(new Response(JSON.stringify([{
        region: 1, key: "0", name: "mock", index: 0, port: ${port},
        playerCount: 1, playerCapacity: 50
      }]), { status: 200, headers: { "content-type": "application/json" } }));
    }
    return realFetch.apply(this, arguments);
  };
})();
`;

const REDIRECT = (port) => `
(function () {
  const Native = window.WebSocket;
  function Redirected(url, protocols) {
    const target = "ws://127.0.0.1:${port}";
    return protocols === undefined ? new Native(target) : new Native(target, protocols);
  }
  Redirected.prototype = Native.prototype;
  Redirected.CONNECTING = Native.CONNECTING; Redirected.OPEN = Native.OPEN;
  Redirected.CLOSING = Native.CLOSING; Redirected.CLOSED = Native.CLOSED;
  try { window.WebSocket = Redirected; } catch (e) {}
})();
`;

async function run(httpPort, wsPort, replaceOn) {
  const http_server = http.createServer((req, res) => {
    let p = req.url.split("?")[0];
    if (p === "/") p = "/index.html";
    const file = path.join(HERE, p);
    if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => http_server.listen(httpPort, "127.0.0.1", r));

  let counting = false;
  const stamps = [];
  const byLetter = {};
  let session = null;
  const wss = server.start(wsPort, (kind, letter) => {
    if (!counting) return;
    stamps.push(Date.now());
    byLetter[letter] = (byLetter[letter] || 0) + 1;
  }, { requireSpawn: true, onSession: (s) => { session = s; } });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const faults = [];
  page.on("pageerror", (e) => faults.push(String(e.message).slice(0, 120)));

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: SERVER_LIST(wsPort) });
  await page.addInitScript({ content: REDIRECT(wsPort) });

  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8"));
  await page.goto("http://127.0.0.1:" + httpPort + "/", { waitUntil: "load" });
  try { await installed.finish(); } catch (e) { faults.push("load: " + String(e.message).slice(0, 100)); }
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    try { if (typeof window.onGotTurnstileToken === "function") window.onGotTurnstileToken("stub-token"); } catch (e) {}
  }).catch(() => {});
  try { await page.click("#enterGame", { timeout: 2500 }); }
  catch (e) {
    try { await page.evaluate(() => { const b = document.getElementById("enterGame"); if (b) b.click(); }); }
    catch (e2) { faults.push("could not press Play"); }
  }
  await page.waitForTimeout(4000);

  await page.evaluate((on) => { window.vars.prePlace2 = on; }, replaceOn);
  await page.waitForTimeout(500);

  /* A building of yours dies once a second, which is what replace answers.
   * It has to be re-added each time or there is nothing left to destroy. */
  counting = true;
  const start = Date.now();
  let sid = 100;
  while (Date.now() - start < WINDOW) {
    if (session) {
      session.send("H", [[sid, 7e3 + 60, 6e3 - 90, 0, 35, null, 4, 1]]);
      await page.waitForTimeout(300);
      session.send("Q", [sid]);
      sid++;
    }
    await page.waitForTimeout(700);
  }
  counting = false;

  /* Per-second buckets, because an average hides the spike that gets you
   * dropped and the guard is written against a one-second counter. */
  const buckets = new Map();
  for (const t of stamps) {
    const b = Math.floor((t - start) / 1000);
    buckets.set(b, (buckets.get(b) || 0) + 1);
  }
  const rates = [...buckets.values()];
  const peak = rates.length ? Math.max(...rates) : 0;
  const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  const top = Object.entries(byLetter).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([l, n]) => l + "x" + n).join(" ");

  await browser.close();
  wss.close();
  http_server.close();
  return { peak, avg, total: stamps.length, top, faults: [...new Set(faults)] };
}

(async () => {
  const off = await run(8381, 8382, false);
  const on = await run(8383, 8384, true);

  const pad = (s, n) => String(s).padEnd(n);
  console.log(path.basename(CLIENT) + " — packets a second on the wire\n");
  console.log("  a building of yours is destroyed once a second for " + (WINDOW / 1000) + "s");
  console.log("  the client's own placement guard is written against " + LIMIT + "/s\n");
  console.log("  " + pad("replace", 12) + pad("peak/s", 10) + pad("average/s", 12) +
    pad("total", 9) + "busiest packets");
  console.log("  " + "-".repeat(74));
  for (const [label, r] of [["off", off], ["on", on]]) {
    console.log("  " + pad(label, 12) + pad(r.peak + (r.peak > LIMIT ? " OVER" : ""), 10) +
      pad(r.avg.toFixed(1), 12) + pad(r.total, 9) + r.top);
  }
  const errs = [...new Set([...off.faults, ...on.faults])];
  if (errs.length) console.log("\n  page errors: " + errs.slice(0, 2).join(" | "));

  const over = on.peak > LIMIT;
  console.log("\n  " + (over
    ? "OVER the line — peak " + on.peak + "/s with replace on, against a " + LIMIT + " guard"
    : "under the line — peak " + on.peak + "/s with replace on, against a " + LIMIT + " guard") +
    "\n  replace adds " + (on.avg - off.avg).toFixed(1) + " packets a second on average");
  process.exit(over ? 1 : 0);
})();
