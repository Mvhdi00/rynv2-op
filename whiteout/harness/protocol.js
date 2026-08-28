/* Checks what the client puts on the wire.
 *
 * The real server drops a connection whose frames it cannot verify, and the
 * client shows that as "disconnected". This runs the client against a server
 * that validates the same things — signature, opcode, strictly increasing
 * sequence — and prints every frame it rejects.
 *
 *   node protocol.js [client.js] [strict]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");
const server = require("./server");

const HERE = __dirname;
const CLIENT = process.argv[2] || path.resolve(HERE, "../Whiteout_v4_1.user.js");
const STRICT = process.argv[3] === "strict";
const MIME = { ".html": "text/html", ".js": "text/javascript" };

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

  const sent = [];
  const violations = [];
  const wss = server.start(8322, (...a) => sent.push(a.join(" ")), {
    strict: STRICT,
    onViolation: (why, detail) => violations.push(why + (detail ? " (" + detail + ")" : "")),
  });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const closed = [];
  await page.exposeFunction("__reportClose", (code, reason) => closed.push(code + " " + reason));
  await page.addInitScript({ content: fs.readFileSync(CLIENT, "utf8") });
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    const s = new window.WebSocket("ws://127.0.0.1:8322");
    s.binaryType = "arraybuffer";
    s.onmessage = function () {};
    s.onclose = function (e) { window.__reportClose(e.code, e.reason || ""); };
  });
  await page.waitForTimeout(6000);

  const kinds = new Map();
  for (const line of sent) {
    const letter = line.split(" ")[1];
    kinds.set(letter, (kinds.get(letter) || 0) + 1);
  }

  console.log("frames accepted:", sent.length);
  console.log("  by opcode:", [...kinds].map(([k, n]) => k + "x" + n).join(" ") || "(none)");
  console.log("frames rejected:", violations.length);
  for (const v of [...new Set(violations)]) console.log("  " + v);
  console.log("socket closed:", closed.length ? closed.join(", ") : "no");

  await browser.close();
  wss.close();
  http_server.close();
})();
