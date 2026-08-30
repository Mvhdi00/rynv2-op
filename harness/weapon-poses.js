/* A contact sheet of weapon poses, so an angle can be chosen by looking.
 *
 * X_STYLE.holdAngle is the one number that decides where the weapon points, and
 * describing it in words does not settle anything — "out to the side" and
 * "trailing back" are the same sentence for two poses that look nothing alike.
 * So render the same character at a spread of angles and put them side by side.
 *
 * Weapon sprites are unreachable from the sandbox, so a solid bar stands in;
 * what the sheet answers is where the weapon sits relative to the body, which is
 * the part the angle controls.
 *
 *   node weapon-poses.js [client.js]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");
const server = require("./server");
const inject = require("./inject");

const HERE = __dirname;
const CLIENT = process.argv[2] || path.resolve(HERE, "../xprecision/X_Precision_2.0.user.js");
const OUT = process.env.OUT_DIR || HERE;
const MIME = { ".html": "text/html", ".js": "text/javascript" };

const ANGLES = [
  { a: 0, label: "0.0  the game's own" },
  { a: -0.5, label: "-0.5  across the body" },
  { a: -1.2, label: "-1.2  half out" },
  { a: -1.6, label: "-1.6  straight out to the side" },
  { a: -2.2, label: "-2.2  out and back" },
  { a: -2.6, label: "-2.6  over the shoulder" },
  { a: -3.14, label: "-3.14  reversed along the back" },
];

const BAR = "data:image/svg+xml;base64," + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24">' +
  '<rect width="120" height="24" rx="6" fill="#c0392b" stroke="#2c1810" stroke-width="4"/>' +
  '<rect x="86" width="34" height="24" rx="6" fill="#e8b647" stroke="#2c1810" stroke-width="4"/>' +
  "</svg>").toString("base64");

const FAKE_SPRITES = `
(function () {
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, String(v).indexOf("/weapons/") !== -1 ? ${JSON.stringify(BAR)} : v); }
  });
})();
`;

const SERVER_LIST = `
(function () {
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input) {
    const url = String((input && input.url) || input);
    if (url.includes("/servers")) {
      return Promise.resolve(new Response(JSON.stringify([{
        region: 1, key: "0", name: "mock", index: 0, port: 8372,
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
    const target = "ws://127.0.0.1:8372";
    return protocols === undefined ? new Native(target) : new Native(target, protocols);
  }
  Redirected.prototype = Native.prototype;
  Redirected.CONNECTING = Native.CONNECTING; Redirected.OPEN = Native.OPEN;
  Redirected.CLOSING = Native.CLOSING; Redirected.CLOSED = Native.CLOSED;
  try { window.WebSocket = Redirected; } catch (e) {}
})();
`;

(async () => {
  const http_server = http.createServer((req, res) => {
    let p = req.url.split("?")[0];
    if (p === "/") p = "/index.html";
    const file = path.join(HERE, p);
    if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => http_server.listen(8371, "127.0.0.1", r));

  const got = [];
  const wss = server.start(8372, (kind, letter) => got.push(letter), { requireSpawn: true });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const faults = [];
  page.on("pageerror", (e) => faults.push(String(e.message).slice(0, 140)));

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: FAKE_SPRITES });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });

  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8"));
  await page.goto("http://127.0.0.1:8371/", { waitUntil: "load" });
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

  if (!got.includes("M")) {
    console.log("never spawned — nothing to draw"); process.exit(1);
  }
  const reachable = await page.evaluate(() => !!window.X_STYLE);
  if (!reachable) {
    console.log("X_STYLE is not on window, so the sweep cannot set it.\n" +
      "The client needs `window.X_STYLE = X_STYLE;` for this to work.");
    await browser.close(); wss.close(); http_server.close(); process.exit(2);
  }

  /* A wide crop, deliberately. The stand-in sprite is drawn at the weapon's own
   * length and width, which for a polearm is large, so a tight frame fills with
   * bar and the pose — the thing being chosen — is unreadable. */
  const CELL = 300, ZOOM = 1.2;
  const tiles = [];
  for (const { a, label } of ANGLES) {
    await page.evaluate((v) => { window.vars.xWeaponStyle = true; window.X_STYLE.holdAngle = v; }, a);
    await page.waitForTimeout(450);
    const dataUrl = await page.evaluate(({ cell, zoom }) => {
      const c = document.getElementById("gameCanvas");
      const out = document.createElement("canvas");
      out.width = cell * zoom; out.height = cell * zoom;
      const g = out.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(c, c.width / 2 - cell / 2, c.height / 2 - cell / 2, cell, cell, 0, 0, cell * zoom, cell * zoom);
      return out.toDataURL("image/png");
    }, { cell: CELL, zoom: ZOOM });
    tiles.push({ label, dataUrl });
  }

  /* Stitch in the page, where a canvas already exists — no image library, and
   * the labels go on so a tile cannot be mistaken for its neighbour. */
  const sheet = await page.evaluate(async ({ tiles, cell, zoom }) => {
    const cols = 4, rows = Math.ceil(tiles.length / cols), pad = 26;
    const w = cell * zoom, h = cell * zoom;
    const out = document.createElement("canvas");
    out.width = cols * w; out.height = rows * (h + pad);
    const g = out.getContext("2d");
    g.fillStyle = "#1a1a1a"; g.fillRect(0, 0, out.width, out.height);
    for (let i = 0; i < tiles.length; i++) {
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = tiles[i].dataUrl; });
      const x = (i % cols) * w, y = Math.floor(i / cols) * (h + pad);
      g.drawImage(img, x, y + pad);
      g.fillStyle = "#eee"; g.font = "bold 16px monospace";
      g.fillText(tiles[i].label, x + 6, y + 18);
    }
    return out.toDataURL("image/png");
  }, { tiles, cell: CELL, zoom: ZOOM });

  const file = path.join(OUT, "weapon-poses.png");
  fs.writeFileSync(file, Buffer.from(sheet.split(",")[1], "base64"));
  console.log(path.basename(CLIENT) + " — holdAngle, one tile per value\n");
  for (const { a, label } of ANGLES) console.log("  " + label);
  if (faults.length) console.log("\n  page errors: " + faults.slice(0, 2).join(" | "));
  console.log("\n  " + file);

  await browser.close();
  wss.close();
  http_server.close();
  process.exit(0);
})();
