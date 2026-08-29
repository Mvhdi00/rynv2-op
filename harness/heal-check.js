/* Does auto heal actually fire, and how fast?
 *
 * Auto heal is not one switch — it is a damage prediction feeding a decision
 * feeding a placement. The prediction adds up poison ticks, spike contact while
 * trapped and incoming hits; the decision heals when health is at or below what
 * is predicted, or when a hit landed at all; the placement puts food down once
 * per `heal` value needed. Any of the three can be intact while the feature does
 * nothing.
 *
 * So hurt the player and watch the wire: healing is food placements, and each
 * placement is a select-build then two attack frames. Count them, and time the
 * first one from the damage that should have caused it.
 *
 *   node heal-check.js [client.js]
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

/* No hook into the client.
 *
 * These clients are webpack bundles: the heal path, the player and the damage
 * prediction all live inside closures, so appending code to the file reaches
 * none of them — an earlier version of this test read `heal is not defined` and
 * concluded the feature was broken when it was simply out of reach.
 *
 * Drive it from the wire instead, which is how the real game drives it. */

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

  let phase = "idle";
  let mark = 0;
  const got = [];
  let session = null;
  const wss = server.start(8322, (kind, letter, seq, args) => {
    got.push({ phase, letter, args, at: Date.now() - mark });
  }, { requireSpawn: true, onSession: (s) => { session = s; } });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const faults = [];
  page.on("pageerror", (e) => faults.push(String(e.message).slice(0, 120)));

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });

  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8"));
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  try { await installed.finish(); } catch (e) { faults.push("load: " + String(e.message).slice(0, 100)); }
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    try { if (typeof window.onGotTurnstileToken === "function") window.onGotTurnstileToken("stub-token"); } catch (e) {}
  }).catch(() => {});
  /* Press Play both ways, because the two clients need different ones.
   *
   * The game gates its own button behind checkTrusted, so a click dispatched
   * from evaluate() is ignored — but a real click needs the button to be laid
   * out and unobscured, which this unstyled page does not always manage. Try
   * the real one, fall back to the synthetic, and let whichever lands do it. */
  try { await page.click("#enterGame", { timeout: 2500 }); }
  catch (e) {
    try { await page.evaluate(() => { const b = document.getElementById("enterGame"); if (b) b.click(); }); }
    catch (e2) { faults.push("could not press Play"); }
  }
  await page.waitForTimeout(5000);

  const spawnedOk = got.some((g) => g.letter === "M");

  /* Hurt the player the way the game does: a health update from the server.
   * The client's own handler records the damage, and the tick after it is the
   * one that should decide to heal. */
  phase = "after damage"; mark = Date.now();
  if (session) session.send("O", [session.mySid, 40]);
  await page.waitForTimeout(2500);

  /* Again, harder, in case one drop was inside its tolerance. */
  phase = "after more damage"; mark = Date.now();
  if (session) session.send("O", [session.mySid, 15]);
  await page.waitForTimeout(2500);

  const inPhase = (p) => got.filter((g) => g.phase === p);
  const counts = (rows) => {
    const c = {};
    for (const r of rows) c[r.letter] = (c[r.letter] || 0) + 1;
    return Object.entries(c).map(([l, n]) => l + "x" + n).join(" ") || "nothing";
  };
  /* A placement is a select-to-build ("z", carrying the item id) followed by two
   * attack frames. Healing is the same shape with the food item, so the id in
   * the payload is what separates eating from walling. An earlier version of
   * this counted "G" and reported a busy client as doing nothing. */
  const FOOD = new Set([0, 16, 17]);          // apple, cookie, cheese
  const idOf = (r) => { try { return JSON.parse(r.args)[0]; } catch (e) { return null; } };
  const placesOf = (rows, want) => rows.filter((r) => r.letter === "z" && want(idOf(r)));
  const heals = (rows) => placesOf(rows, (id) => FOOD.has(id)).length;
  const builds = (rows) => placesOf(rows, (id) => id != null && !FOOD.has(id)).length;
  const firstHeal = (rows) => {
    const r = placesOf(rows, (id) => FOOD.has(id))[0];
    return r ? r.at + "ms" : "never";
  };
  const idsUsed = (rows) => [...new Set(rows.filter((r) => r.letter === "z").map(idOf))].join(",");

  const pad = (s, n) => String(s).padEnd(n);
  console.log(path.basename(CLIENT) + " — does auto heal fire?\n");
  console.log("  spawn accepted: " + (spawnedOk ? "yes" : "NO — nothing below means anything") + "\n");
  console.log(pad("phase", 20) + pad("food placed", 13) + pad("other builds", 14) +
    pad("item ids used", 16) + "first heal");
  console.log("-".repeat(84));
  for (const p of ["after damage", "after more damage"]) {
    const rows = inPhase(p);
    console.log(pad(p, 20) + pad(heals(rows), 13) + pad(builds(rows), 14) +
      pad(idsUsed(rows) || "-", 16) + firstHeal(rows));
  }
  if (faults.length) console.log("  page errors: " + [...new Set(faults)].slice(0, 3).join(" | "));

  const auto = heals(inPhase("after damage")) + heals(inPhase("after more damage"));
  /* Without a spawn there is no player to hurt, so "no food placed" says
   * nothing about the feature — only about the run. Reporting it as a verdict
   * is how a working client gets written off. */
  console.log("\n  " + (!spawnedOk
    ? "INCONCLUSIVE — this client never spawned here, so nothing was tested.\n" +
      "  A client that rides the page's own bundle needs the game's full menu flow,\n" +
      "  which this synthesised page does not reproduce."
    : auto > 0
      ? "auto heal fires on damage — " + auto + " food placement(s)"
      : "NO food placed after either drop — auto heal is not firing"));

  await browser.close();
  wss.close();
  http_server.close();
  process.exit(spawnedOk && auto > 0 ? 0 : 1);
})();
