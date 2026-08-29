/* Do the mod's own features actually run?
 *
 * A client can connect, spawn, draw and move while none of what it was
 * installed for works — auto heal, auto mill, the buyer, the reloads. All of
 * those live in the tail of the same per-tick function, after the state update,
 * so one throw part-way down that tail takes every feature below it and leaves
 * the game itself looking perfectly healthy.
 *
 * The tick is async, so such a throw is a rejection, not an error. Counting the
 * calls is the way to see it: wrap the functions the tail ends with and watch
 * whether the tick ever reaches them.
 *
 *   node features-check.js [client.js]
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

/* Named in the order the tick calls them, so the first one at zero is where it
 * stops. */
const STAGES = ["reload", "fastwep", "miller", "handleVelTick", "autobuyer"];

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

/* Appended in the client's own scope, so it can reach its top-level function
 * declarations and count them without the client being changed. */
const HOOK = `
;try {
  window.__rev = { gate: typeof Oh === "function" ? Oh : null, stages: {}, ticks: 0 };
  ${STAGES.map((n) => `
  if (typeof ${n} === "function") {
    window.__rev.stages[${JSON.stringify(n)}] = 0;
    const __orig_${n} = ${n};
    ${n} = function () { window.__rev.stages[${JSON.stringify(n)}]++; return __orig_${n}.apply(this, arguments); };
  } else { window.__rev.stages[${JSON.stringify(n)}] = "not a function"; }`).join("")}
  const __origTick = playerUpdateTick;
  playerUpdateTick = function () { window.__rev.ticks++; return __origTick.apply(this, arguments); };
  /* Which of the menu elements the features read are actually in the page. A
   * null here is a throw the moment the tick touches it. */
  window.__rev.menu = function () {
    /* The real ids, taken from the client's own getElementById calls — a
     * guessed name reports as missing and sends you looking for a fault that
     * is not there. */
    const ids = ["auto heal", "auto place", "auto break", "mill rotate",
                 "Shaders", "Light Mode", "Default Visuals"];
    const out = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      out[id] = el ? (el.type === "checkbox" ? (el.checked ? "on" : "off") : el.tagName) : false;
    });
    return out;
  };
} catch (e) { window.__revErr = String(e); }`;

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
  const faults = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/\[revelation\]/.test(t) && (m.type() === "error" || m.type() === "warning")) faults.push(t.slice(0, 150));
  });
  page.on("pageerror", (e) => faults.push("page error: " + String(e.message).slice(0, 130)));

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });

  let loadError = null;
  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8") + HOOK);
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  try { await installed.finish(); } catch (e) { loadError = String(e.message).split("\n")[0].slice(0, 110); }
  await page.waitForTimeout(2000);

  const menu = loadError ? null : await page.evaluate(() => window.__rev.menu());

  await page.evaluate(() => {
    try { if (typeof window.onGotTurnstileToken === "function") window.onGotTurnstileToken("stub-token"); } catch (e) {}
    if (window.__rev && window.__rev.gate) window.__rev.gate();
  }).catch(() => {});
  await page.waitForTimeout(6000);

  const out = loadError ? { ticks: 0, stages: {} }
    : await page.evaluate(() => ({ ticks: window.__rev.ticks, stages: window.__rev.stages }));

  const pad = (s, n) => String(s).padEnd(n);
  console.log(path.basename(CLIENT) + " — do the mod's own features run?\n");
  if (loadError) console.log("  the client threw at load: " + loadError + "\n");
  if (menu) {
    const missing = Object.entries(menu).filter(([, v]) => v === false).map(([id]) => id);
    console.log("  controls the features read: " +
      (missing.length ? missing.length + " MISSING — " + missing.join(", ")
        : Object.entries(menu).map(([k, v]) => k + "=" + v).join(", ")));
  }
  console.log("  ticks the client processed:      " + out.ticks + "\n");
  console.log(pad("stage in the tick", 20) + "times reached");
  console.log("-".repeat(40));
  let stoppedAt = null;
  for (const n of STAGES) {
    const v = out.stages[n];
    if (stoppedAt === null && v === 0 && out.ticks > 0) stoppedAt = n;
    console.log(pad(n, 20) + (v === undefined ? "not found" : v));
  }
  if (faults.length) console.log("\n  reported: " + [...new Set(faults)].slice(0, 5).join("\n            "));
  console.log("\n  " + (out.ticks === 0
    ? "the tick never ran at all"
    : stoppedAt
      ? "THE TICK STOPS BEFORE " + stoppedAt + " — every feature from there down is dead"
      : "the tick reaches the end; every feature runs"));

  await browser.close();
  wss.close();
  http_server.close();
  process.exit(out.ticks > 0 && !stoppedAt ? 0 : 1);
})();
