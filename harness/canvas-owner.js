/* Who is painting the canvas?
 *
 * A client that carries its own copy of the game does not replace the page's
 * bundle — it runs beside it. Both draw on #gameCanvas, and what you see is
 * whichever one drew last. The page's bundle never enters a game, so what it
 * paints is its menu backdrop: the world, plus a 35% dark wash over the whole
 * canvas, every frame. Your character is only in the other program's frames.
 *
 * Half the frames having no character in them is not something a screenshot can
 * settle — sample once and you catch whichever loop drew last. So measure both:
 * where the full-canvas draws come from, and how many of the frames actually
 * have your body in the middle.
 *
 *   node canvas-owner.js [client.js]
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

const HOOK = `
;try { window.__rev = { gate: typeof Oh === "function" ? Oh : null }; } catch (e) { window.__revErr = String(e); }`;

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

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });

  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8") + HOOK);
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await installed.finish();
  await page.waitForTimeout(1500);

  /* Before there is any connection, this client has nothing to draw. If its
   * layer is on screen anyway it paints an empty world over the game the player
   * is actually in — worse than doing nothing, because it takes the screen away
   * from a program that works. */
  const idle = await page.evaluate(() => {
    const mine = document.getElementById("gameCanvas");
    const page_ = document.getElementById("revPageCanvas");
    return {
      overlay: mine ? getComputedStyle(mine).visibility : "absent",
      pageCanvasKept: !!page_ && getComputedStyle(page_).visibility !== "hidden",
    };
  });

  await page.evaluate(() => {
    try { if (typeof window.onGotTurnstileToken === "function") window.onGotTurnstileToken("stub-token"); } catch (e) {}
    if (window.__rev && window.__rev.gate) window.__rev.gate();
  });
  await page.waitForTimeout(4000);
  const live = await page.evaluate(() => {
    const mine = document.getElementById("gameCanvas");
    return mine ? getComputedStyle(mine).visibility : "absent";
  });

  /* Full-canvas fills are what set the picture's base colour, so attribute
   * those. A draw to a canvas no longer in the document is not on screen. */
  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const realFill = proto.fillRect;
    window.__by = { client: 0, page: 0, offscreen: 0 };
    proto.fillRect = function (x, y, w, h) {
      try {
        const c = this.canvas;
        if (c && c.id === "gameCanvas" && w >= c.width * 0.9 && h >= c.height * 0.9) {
          if (!c.isConnected) window.__by.offscreen++;
          else if (/assets\/index-/.test(new Error().stack || "")) window.__by.page++;
          else window.__by.client++;
        }
      } catch (e) {}
      return realFill.apply(this, arguments);
    };

    /* And per frame: is your body in the middle of the canvas? */
    window.__frames = { withBody: 0, total: 0 };
    const c = document.getElementById("gameCanvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const R = 60;
    const sample = () => {
      if (window.__frames.total >= 90) return;
      window.__frames.total++;
      const d = ctx.getImageData(Math.floor(c.width / 2) - R, Math.floor(c.height / 2) - R, R * 2, R * 2).data;
      const key = (i) => d[i] + "," + d[i + 1] + "," + d[i + 2];
      const seen = new Map();
      for (let i = 0; i < d.length; i += 4) seen.set(key(i), (seen.get(key(i)) || 0) + 1);
      // The biggest patch that is not the ground — see spawn-check.js: the
      // exact centre pixel can be the sid number drawn over the body.
      const sorted = [...seen.entries()].sort((a, b) => b[1] - a[1]);
      const n = sorted[1] ? sorted[1][1] : 0;
      if (n > 150 && n < (R * 2) * (R * 2) * 0.5) window.__frames.withBody++;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.waitForTimeout(2500);

  const { by, frames } = await page.evaluate(() => ({ by: window.__by, frames: window.__frames }));
  await page.screenshot({ path: path.join(HERE, "canvas-" + path.basename(CLIENT) + ".png") });

  const total = by.client + by.page;
  const pct = total ? Math.round((by.page / total) * 100) : 0;
  const seen = frames.total ? Math.round((frames.withBody / frames.total) * 100) : 0;

  console.log(path.basename(CLIENT) + " — who paints #gameCanvas\n");
  console.log("  with no connection, this client's layer: " + idle.overlay +
    (idle.overlay === "hidden" ? "   (the page's game shows through)" : "   <- painting over the page's game"));
  console.log("  the page's own canvas is still there:    " + (idle.pageCanvasKept ? "yes" : "no"));
  console.log("  once connected, this client's layer:     " + live + "\n");
  console.log("  full-canvas draws by the client:      " + by.client);
  console.log("  full-canvas draws by the page bundle: " + by.page + (by.page ? "   <- painting over your frames (" + pct + "%)" : ""));
  console.log("  draws that never reach the screen:    " + by.offscreen + (by.offscreen ? "   (the page bundle, on a detached canvas)" : ""));
  console.log("\n  frames with your character in the middle: " +
    frames.withBody + " of " + frames.total + "  (" + seen + "%)");
  const ok = by.page === 0 && seen >= 90;
  console.log("\n  " + (ok
    ? "the client owns the canvas, and your character is in every frame"
    : by.page
      ? "two programs are drawing one canvas — your character is in " + seen + "% of frames"
      : "the client owns the canvas, but your character is only in " + seen + "% of frames"));

  await browser.close();
  wss.close();
  http_server.close();
  process.exit(ok ? 0 : 1);
})();
