/* Can the client talk again after the server goes quiet?
 *
 * The outgoing rate limiter allows 120 packets a second, and the counter it
 * measures against is cleared in exactly one place — inside playerUpdate, every
 * ninth tick. That makes the limiter's release depend on the server still
 * talking to you.
 *
 * So a stall costs more than the stall: while ticks are missing, the count
 * climbs on whatever you send, reaches 120, and every send from then on returns
 * early. Nothing clears it, because the only thing that could is a tick you can
 * no longer ask for. The socket is open, the render loop is drawing, and not one
 * packet leaves again — a frozen game that reports itself as connected.
 *
 * So: spawn, let the server go quiet, hold a key down through it, and see
 * whether anything reaches the server once the world starts moving again.
 *
 *   node silence-check.js [client.js]
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
  /* The limiter's own counter, so the report can name the cause rather than
   * just observing that nothing arrived. */
  packets: function () { return typeof packets !== "undefined" ? packets : -1; },
  spam: function (n) { for (var i = 0; i < n; i++) ee.send("D", Math.random() * 6); },
}; } catch (e) { window.__revErr = String(e); }`;

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

  let phase = "spawn";
  const got = {};
  let session = null;
  const wss = server.start(8322, (kind, letter) => {
    (got[phase] = got[phase] || []).push(letter);
  }, { requireSpawn: true, onSession: (s) => { session = s; } });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });

  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8") + HOOK);
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await installed.finish();
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    try { if (typeof window.onGotTurnstileToken === "function") window.onGotTurnstileToken("stub-token"); } catch (e) {}
    if (window.__rev && window.__rev.gate) window.__rev.gate();
  });
  await page.waitForTimeout(2500);

  /* The world goes quiet. Nothing about the socket changes — this is a stall,
   * not a disconnect. */
  phase = "while quiet";
  if (session) session.stopTicks();
  /* A player holding a key through a stall keeps producing packets, which is
   * what pushes the counter to its ceiling with nothing left to clear it. */
  await page.evaluate(() => window.__rev.spam(200));
  await page.waitForTimeout(1500);
  const stuckAt = await page.evaluate(() => window.__rev.packets());

  /* Now let it settle, and try to play again. */
  await page.waitForTimeout(2000);
  phase = "after the stall";
  const freedAt = await page.evaluate(() => window.__rev.packets());
  await page.evaluate(() => window.__rev.spam(5));
  await page.waitForTimeout(800);

  const pad = (s, n) => String(s).padEnd(n);
  const after = got["after the stall"] || [];
  console.log(path.basename(CLIENT) + " — the server goes quiet for a few seconds\n");
  console.log(pad("moment", 22) + pad("limiter counter", 18) + "packets the server got");
  console.log("-".repeat(70));
  console.log(pad("during the stall", 22) + pad(stuckAt + " / 120", 18) + (got["while quiet"] || []).length);
  console.log(pad("after it, on input", 22) + pad(freedAt + " / 120", 18) + after.length);
  console.log("\n  " + (after.length
    ? "the client talks again"
    : "THE CLIENT IS SILENT FOR GOOD — connected, drawing, sending nothing"));

  await browser.close();
  wss.close();
  http_server.close();
  process.exit(after.length ? 0 : 1);
})();
