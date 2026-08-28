/* Is the second connection as good as the first?
 *
 * The signing key, both opcode tables and the sequence number all belong to one
 * connection. Carrying them into the next one signs with a key the new server
 * side has never issued, from a sequence it has never seen, so every frame is
 * rejected — the client looks connected and does nothing, which is the same
 * symptom as never connecting at all and is why it is worth a test of its own.
 *
 * Connects, spawns, drops the socket, connects again, and reports what the
 * server made of each session.
 *
 *   node reconnect-check.js [client.js]
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

const sessions = [];

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
;try { window.__rev = {
  play: function () { Fn = false; Jt = false; if (typeof Oh === "function") Oh(); },
  drop: function () { ee.close(); Jt = false; vi = false; Fn = false; },
  me: function () { return (typeof E !== "undefined" && E) ? { sid: E.sid, alive: E.alive } : null; },
  net: function () { return typeof revNet !== "undefined" && revNet
    ? { seq: revNet.seq, key: Array.from(revNet.key).slice(0, 4).join(",") } : null; },
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

  let current = null;
  const wss = server.start(8322, (kind, letter) => { if (current) current.accepted.push(letter); }, {
    requireSpawn: true,
    onSession: () => { current = { accepted: [], rejected: [] }; sessions.push(current); },
    onViolation: (why, detail) => { if (current) current.rejected.push(why + (detail ? " (" + detail + ")" : "")); },
  });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });

  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8") + HOOK);
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await installed.finish();
  await page.waitForTimeout(1500);

  const rounds = [];
  for (let n = 0; n < 2; n++) {
    if (n > 0) {
      await page.evaluate(() => window.__rev.drop());
      await page.waitForTimeout(800);
    }
    await page.evaluate(() => {
      try { if (typeof window.onGotTurnstileToken === "function") window.onGotTurnstileToken("stub-token"); } catch (e) {}
      window.__rev.play();
    });
    await page.waitForTimeout(3000);
    rounds.push(await page.evaluate(() => ({ me: window.__rev.me(), net: window.__rev.net() })));
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(path.basename(CLIENT) + " — connect, drop, connect again\n");
  console.log(pad("session", 10) + pad("spawn sent", 12) + pad("rejected", 10) + pad("seq", 6) + "local player");
  console.log("-".repeat(70));
  let bad = 0;
  for (let n = 0; n < rounds.length; n++) {
    const s = sessions[n] || { accepted: [], rejected: [] };
    const spawned = s.accepted.includes("M");
    const ok = spawned && !s.rejected.length && rounds[n].me;
    if (!ok) bad++;
    console.log(pad("#" + (n + 1), 10) + pad(spawned ? "accepted" : "NO", 12) +
      pad(s.rejected.length || "none", 10) +
      pad(rounds[n].net ? rounds[n].net.seq : "-", 6) +
      (rounds[n].me ? "sid " + rounds[n].me.sid + ", alive" : "NONE") +
      (s.rejected.length ? "   [" + s.rejected[0] + "]" : ""));
  }
  if (sessions.length !== rounds.length)
    console.log("\n  (server saw " + sessions.length + " connection(s) for " + rounds.length + " rounds)");
  if (errors.length) console.log("  page errors: " + [...new Set(errors)].slice(0, 3).join(" | "));
  console.log("\n" + (bad ? bad + " of " + rounds.length + " sessions failed" : "both sessions spawn, nothing rejected"));

  await browser.close();
  wss.close();
  http_server.close();
  process.exit(bad ? 1 : 0);
})();
