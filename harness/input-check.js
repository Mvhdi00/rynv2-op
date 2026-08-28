/* Does moving and building reach the server?
 *
 * "I cannot move, I cannot build, I cannot do anything" is a claim about the
 * wire, not the picture. Every one of those actions is a packet: movement is
 * "9", aim is "D", attack is "F", picking a building is "G"/"z", placing it is
 * "z" with an angle. If they are not on the wire, no amount of rendering will
 * help; if they are, the fault is elsewhere.
 *
 * So spawn, then press the keys a player presses, and report what the server
 * actually accepted.
 *
 *   node input-check.js [client.js]
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

/* What each opcode is, so the output reads as actions rather than letters. */
const MEANING = {
  M: "spawn", "9": "move", D: "aim", F: "attack", K: "gather/hit",
  z: "place building", G: "select item", H: "buy/equip", N: "upgrade",
  b: "upgrade age", "0": "ping", L: "auto-attack", P: "chat/ping",
  Q: "keep-alive", S: "trade", c: "clan", e: "clan action", "6": "chat",
};

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
  me: function () { return (typeof E !== "undefined" && E)
    ? { sid: E.sid, x: Math.round(E.x), y: Math.round(E.y), visible: E.visible, alive: E.alive,
        buildIndex: E.buildIndex, weaponIndex: E.weaponIndex } : null; },
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

  let phase = "before spawn";
  const got = {};
  const rejected = [];
  const wss = server.start(8322, (kind, letter) => {
    (got[phase] = got[phase] || []).push(letter);
  }, {
    requireSpawn: true,
    onViolation: (why, detail) => rejected.push(why + (detail ? " (" + detail + ")" : "")),
  });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));

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
  await page.waitForTimeout(3000);

  const spawned = await page.evaluate(() => window.__rev.me());

  /* Real key and mouse events, dispatched at the page the way a player would.
   * The client listens on window/document, so focus the body first. */
  const canvas = await page.$("#gameCanvas");
  await page.evaluate(() => document.body.focus());

  /* Which packet each action is supposed to put on the wire. Without this the
   * report says "reaches the server" whenever anything at all was sent, and the
   * aim packets that flow continuously would cover for an action that never
   * happened. */
  const EXPECT = { move: ["9"], aim: ["D"], attack: ["F", "K"], build: ["z"] };

  const steps = [
    ["move", async () => {
      for (const k of ["KeyW", "KeyA", "KeyS", "KeyD"]) {
        await page.keyboard.down(k); await page.waitForTimeout(220); await page.keyboard.up(k);
        await page.waitForTimeout(120);
      }
    }],
    ["aim", async () => {
      const box = await canvas.boundingBox();
      for (const [dx, dy] of [[0.7, 0.3], [0.3, 0.7], [0.8, 0.8]]) {
        await page.mouse.move(box.x + box.width * dx, box.y + box.height * dy);
        await page.waitForTimeout(180);
      }
    }],
    ["attack", async () => {
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
      await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
      await page.waitForTimeout(300);
    }],
    ["build", async () => {
      // 1..5 select a building, then click places it.
      await page.keyboard.press("Digit3");
      await page.waitForTimeout(300);
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45);
      await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up();
      await page.waitForTimeout(400);
    }],
  ];

  for (const [name, run] of steps) {
    phase = name;
    await run();
    await page.waitForTimeout(300);
  }

  const after = await page.evaluate(() => window.__rev.me());

  const pad = (s, n) => String(s).padEnd(n);
  console.log(path.basename(CLIENT) + " — does input reach the server?\n");
  console.log("  spawned as: " + JSON.stringify(spawned));
  console.log("  after input: " + JSON.stringify(after) + "\n");
  console.log(pad("action", 10) + pad("packets the server accepted", 46) + "verdict");
  console.log("-".repeat(78));
  let dead = 0;
  for (const [name] of steps) {
    const list = got[name] || [];
    const counts = {};
    for (const l of list) counts[l] = (counts[l] || 0) + 1;
    const shown = Object.entries(counts)
      .map(([l, n]) => (MEANING[l] || l) + (n > 1 ? " x" + n : "")).join(", ");
    const want = EXPECT[name] || [];
    const seen = want.some((l) => list.includes(l));
    if (!seen) dead++;
    console.log(pad(name, 10) + pad(shown || "nothing", 46) +
      (seen ? "reaches the server"
            : "NO " + want.map((l) => MEANING[l] || l).join("/") + " PACKET"));
  }
  if (rejected.length) console.log("\n  rejected frames: " + [...new Set(rejected)].join(" | "));
  if (errors.length) console.log("  page errors: " + [...new Set(errors)].slice(0, 3).join(" | "));
  console.log("\n  " + (dead
    ? dead + " of " + steps.length + " actions never sent the packet they should"
    : "every action reaches the server"));

  await page.screenshot({ path: path.join(HERE, "input-" + path.basename(CLIENT) + ".png") });
  await browser.close();
  wss.close();
  http_server.close();
  process.exit(dead ? 1 : 0);
})();
