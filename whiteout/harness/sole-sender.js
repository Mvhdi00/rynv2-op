/* Checks that only one packet sequence is ever opened on a socket.
 *
 * Every frame carries a sequence number the server verifies. Two senders on one
 * socket means two counters, duplicate numbers, and a server-side close — which
 * the player sees as "disconnected" the moment they spawn.
 *
 * Three arrangements, all of which must end with the connection alive:
 *
 *   solo      one copy of the client, normal load order — it sends
 *   duplicate two copies installed at once — the second must stand down
 *   late      the game bundle already ran, so it holds a pristine
 *             WebSocket.send this client cannot route — it must not send
 *
 *   node sole-sender.js [client.js]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");
const server = require("./server");

const HERE = __dirname;
const CLIENT = process.argv[2] || path.resolve(HERE, "../Whiteout_v4_1.user.js");
const MIME = { ".html": "text/html", ".js": "text/javascript" };
const source = fs.readFileSync(CLIENT, "utf8");

let session = null;

const http_server = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/__session") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(session));
    return;
  }
  if (p === "/") p = "/index.html";
  const file = path.join(HERE, p);
  if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});

/* Stands in for the game bundle's own sending. In the "late" arrangement the
 * bundle holds a WebSocket.send captured before the client loaded, so its
 * frames never pass through the client's gate: it signs them itself and keeps
 * its own sequence counter, starting at 1 just like the client's. */
const EMULATE_GAME_SENDER = `
window.__gameSend = async function (socket, letter, count) {
  const s = await (await fetch("/__session")).json();
  const raw = Uint8Array.from(atob(s.keyB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  for (let i = 1; i <= count; i++) {
    // msgpack [op, [], seq] — every value small enough for a fixint.
    const payload = new Uint8Array([0x93, s.c2s[letter], 0x90, i]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, payload)).subarray(0, 6);
    const frame = new Uint8Array(6 + payload.length);
    frame.set(sig, 0);
    frame.set(payload, 6);
    window.__pristineSend.call(socket, frame);
    await new Promise((r) => setTimeout(r, 60));
  }
};
`;

async function run(browser, mode) {
  const sent = [];
  const violations = [];
  // strict: close on the first unverifiable frame, exactly as the real server does.
  const wss = server.start(8322, (...a) => sent.push(a.join(" ")), {
    strict: true,
    onViolation: (why, detail) => violations.push(why + (detail ? " (" + detail + ")" : "")),
    onSession: (info) => {
      session = { keyB64: Buffer.from(info.keyHex, "hex").toString("base64"), c2s: info.c2s };
    },
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const closed = [];
  await page.exposeFunction("__reportClose", (code) => closed.push(code));

  // Captured before the client loads — this is the handle the game bundle keeps
  // when it wins the race, and the reason its frames bypass the client.
  await page.addInitScript({ content: "window.__pristineSend = WebSocket.prototype.send;" });
  if (mode === "late") {
    // Stand in for the game bundle having already run its top level.
    await page.addInitScript({ content: "window.loadedScript = true;" });
  }
  await page.addInitScript({ content: source });
  if (mode === "duplicate") await page.addInitScript({ content: source });
  await page.addInitScript({ content: EMULATE_GAME_SENDER });

  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const s = new window.WebSocket("ws://127.0.0.1:8322");
    s.binaryType = "arraybuffer";
    s.onmessage = function () {};
    s.onclose = function (e) { window.__reportClose(e.code); };
    window.__socket = s;
  });
  await page.waitForTimeout(1500);
  if (mode === "late") {
    // The bundle talks to the server on its own, as it does on the real site.
    await page.evaluate(() => window.__gameSend(window.__socket, "9", 8)).catch(() => {});
  }
  await page.waitForTimeout(3500);

  const drawn = await page.evaluate(() => {
    const c = document.getElementById("gameCanvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const seen = new Set();
    for (let x = 20; x < c.width; x += 40) for (let y = 20; y < c.height; y += 40) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      seen.add(d[0] + "," + d[1] + "," + d[2]);
    }
    return seen.size;
  });

  await page.close();
  wss.close();
  await new Promise((r) => setTimeout(r, 200));

  const alive = closed.length === 0 && violations.length === 0;
  console.log(
    "  " + mode.padEnd(10),
    "frames=" + String(sent.length).padStart(3),
    "rejected=" + String(violations.length).padStart(2),
    "closed=" + (closed.length ? closed.join(",") : "no"),
    "colours=" + String(drawn).padStart(2),
    alive ? "OK" : "DISCONNECTED");
  for (const v of [...new Set(violations)]) console.log("      " + v);
  return alive;
}

(async () => {
  await new Promise((r) => http_server.listen(8321, "127.0.0.1", r));
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });

  console.log(path.basename(CLIENT));
  let ok = true;
  for (const mode of ["solo", "duplicate", "late"]) ok = (await run(browser, mode)) && ok;
  console.log("  connection survived every arrangement:", ok ? "YES" : "NO");

  await browser.close();
  http_server.close();
})();
