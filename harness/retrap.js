/* Checks instant retrap end to end.
 *
 * Sets up the situation that matters: one of our traps with an enemy standing
 * in it. Then kills the trap and measures what the client sends back, and how
 * long it took. The point of the feature is that the replacement leaves in the
 * same tick as the break, so the reply has to beat the next render frame. A
 * client that waits for one shows up here as 16ms or more, or as nothing.
 *
 *   node retrap.js [client.js]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { encode, decode } = require("@msgpack/msgpack");
const { chromium } = require("playwright");
const inject = require("./inject");

const HERE = __dirname;
const CLIENT = process.argv[2] || path.resolve(HERE, "../novastorm/Novastorm_1.41.4.user.js");
const MIME = { ".html": "text/html", ".js": "text/javascript" };

const C2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
const S2C = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R",
  "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

function seededRandom(seed) {
  return function () {
    seed |= 0; seed = (seed + 1831565813) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function permute(alphabet, seed) {
  const n = alphabet.length, order = alphabet.map((_, i) => i), rand = seededRandom(seed >>> 0);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  const enc = {}, dec = {};
  for (let i = 0; i < n; i++) { enc[alphabet[i]] = order[i]; dec[order[i]] = alphabet[i]; }
  return { enc, dec };
}
function tablesFor(seed) {
  const t = (seed ^ Math.imul(1, 2654435761)) >>> 0;
  return { c2s: permute(C2S, t), s2c: permute(S2C, (t ^ 2246822507) >>> 0) };
}

const http_server = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const file = path.join(HERE, p);
  if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});

// Clear of the river band (6838..7562), where nothing may be placed at all.
const MID = 7000, MID_Y = 5000;
const MY_SID = 1, FOE_SID = 2, TRAP_SID = 90;
const received = [];
let breakSentAt = 0;

(async () => {
  await new Promise((r) => http_server.listen(8321, "127.0.0.1", r));

  const { WebSocketServer } = require("ws");
  const wss = new WebSocketServer({ port: 8322 });

  wss.on("connection", (ws) => {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const keyHex = crypto.randomBytes(32).toString("hex");
    const tables = tablesFor(seed);
    const send = (letter, args) => ws.send(Buffer.from(encode([tables.s2c.enc[letter], args])));

    ws.on("message", (raw) => {
      const bytes = new Uint8Array(raw);
      if (bytes.length <= 6) return;
      try {
        const frame = decode(bytes.subarray(6));
        const letter = tables.c2s.dec[frame[0]];
        if (breakSentAt) received.push({ letter, args: frame[1], dt: Date.now() - breakSentAt });
      } catch (e) { /* not ours */ }
    });

    ws.send(Buffer.from(encode(["io-init", [7, seed, keyHex, 1]])));

    setTimeout(() => {
      send("A", [{ teams: [] }]);
      send("C", [MY_SID]);
      send("D", [["p1", MY_SID, "tester", MID, MID_Y, 0, 100, 100, 35, 0], true]);
      send("D", [["p2", FOE_SID, "rival", MID + 60, MID_Y, 0, 100, 100, 35, 1], false]);
      // Our trap, with the enemy standing inside it.
      // [sid, x, y, dir, scale, type, itemId, ownerSid]
      send("H", [[TRAP_SID, MID + 60, MID_Y, 0, 45, null, 15, MY_SID]]);
      // items[4] is the trap slot; 15 is the pit trap.
      send("V", [[0, 3, 6, 10, 15], null]);
      send("V", [[0, 1], true]);                        // weapons
      send("S", [0, 0, 0]);
    }, 250);

    // Hold the pair in place so the trap keeps counting as occupied.
    const tick = setInterval(() => {
      send("a", [[
        MY_SID, MID, MID_Y, 0, -1, 0, 0, null, 0, 0, 0, 0, 0,
        FOE_SID, MID + 60, MID_Y, 3, -1, 0, 0, null, 0, 0, 0, 0, 0,
      ]]);
    }, 111);

    // Break it.
    setTimeout(() => {
      breakSentAt = Date.now();
      send("Q", [TRAP_SID]);
    }, 3000);

    ws.on("close", () => clearInterval(tick));
  });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

  const client = await inject.install(page, fs.readFileSync(CLIENT, "utf8"));
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await client.finish();
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const s = new window.WebSocket("ws://127.0.0.1:8322");
    s.binaryType = "arraybuffer";
    s.onmessage = function () {};
  });
  await page.waitForTimeout(4200);

  const reply = received.filter((r) => r.dt >= 0 && r.dt < 200);
  const select = reply.find((r) => r.letter === "z");
  const attack = reply.find((r) => r.letter === "F");

  console.log(path.basename(CLIENT));
  console.log("  frames after the break:", reply.map((r) => r.letter + "@" + r.dt + "ms").join(" ") || "(none)");
  console.log("  replacement sent:      ", select && attack ? "yes" : "NO");
  if (select && attack) {
    // Measured server side, so it includes the round trip both ways. What it
    // has to rule out is the client having waited for its next render frame,
    // which would put the reply on the far side of a 16ms boundary.
    const gap = Math.min(select.dt, attack.dt);
    console.log("  gap from break:        ", gap + "ms",
      gap < 16 ? "(inside the tick, round trip included)" : "(waited for a frame)");
  }
  if (errors.length) console.log("  page errors:", [...new Set(errors)].join(" | "));

  await browser.close();
  wss.close();
  http_server.close();
})();
