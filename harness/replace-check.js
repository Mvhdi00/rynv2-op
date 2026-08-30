/* Does the "replace" switch answer what the enemy just broke?
 *
 * The menu has two placer switches. `prePlace` puts an object down *before* the
 * hit lands, predicting it. `prePlace2`, labelled "replace", answers the hit
 * that already happened — and in the file as shipped it appeared exactly once,
 * in the line that draws the toggle. Nothing read it, and the state it would
 * plausibly have driven was dead as well: `placeTick` is written twice and read
 * nowhere. So the switch did nothing either way, which is not something reading
 * the menu tells you.
 *
 * A feature that is off by default and does nothing look identical from outside,
 * so test the difference rather than the presence: destroy one of the player's
 * own buildings and count the placements that follow, once with the switch off
 * and once with it on. Off must place nothing, on must place the same item back.
 *
 *   node replace-check.js [client.js]
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

/* The object the mock loads as the player's own, and the item it is made of:
 * `3, mid + 60, mid - 90, 0, 35, null, 4, mySid` in server.js. */
const MY_OBJECT_SID = 3;
const MY_OBJECT_ITEM = 4;

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

async function run(port, wsPort, replaceOn) {
  const http_server = http.createServer((req, res) => {
    let p = req.url.split("?")[0];
    if (p === "/") p = "/index.html";
    const file = path.join(HERE, p);
    if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => http_server.listen(port, "127.0.0.1", r));

  let phase = "before";
  const got = [];
  let session = null;
  const wss = server.start(wsPort, (kind, letter, seq, args) => {
    got.push({ phase, letter, args });
  }, { requireSpawn: true, onSession: (s) => { session = s; } });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const faults = [];
  page.on("pageerror", (e) => faults.push(String(e.message).slice(0, 120)));

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT.replace("8322", String(wsPort)) });

  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8"));
  await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "load" });
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

  const spawned = got.some((g) => g.letter === "M");

  /* Set the switch the way this run wants it, and read it back — a toggle that
   * silently fails to take would make "off places nothing" true for the wrong
   * reason. */
  const varState = await page.evaluate((on) => {
    try {
      window.vars.prePlace2 = on;
      return { ok: true, value: window.vars.prePlace2, hasPrePlace: window.vars.prePlace };
    } catch (e) { return { ok: false, error: String(e.message) }; }
  }, replaceOn).catch((e) => ({ ok: false, error: String(e.message) }));

  await page.waitForTimeout(600);

  // Destroy the player's own building and watch what goes out after it.
  phase = "after break";
  if (session) session.send("Q", [MY_OBJECT_SID]);
  await page.waitForTimeout(2500);

  /* Count buildings, not placements.
   *
   * An earlier version asked whether item 4 -- the exact thing that broke --
   * went back down, which was the right question while replace was a put-back
   * and the wrong one now: it grades every reachable spot and takes the best,
   * so the answer is usually a different item in a better place. It also
   * counted food, and auto heal places food constantly, so a apple from a
   * different feature read as replace working. */
  const after = got.filter((g) => g.phase === "after break");
  const idOf = (r) => { try { return JSON.parse(r.args)[0]; } catch (e) { return null; } };
  const FOOD = new Set([0, 16, 17]);
  const places = after.filter((r) => r.letter === "z");
  const builds = places.filter((r) => { const id = idOf(r); return id != null && !FOOD.has(id); });
  const replaced = builds.length;
  const otherIds = [...new Set(builds.map(idOf))];

  await browser.close();
  wss.close();
  http_server.close();
  return { spawned, varState, replaced, otherIds, faults: [...new Set(faults)] };
}

(async () => {
  console.log(path.basename(CLIENT) + " — does \"replace\" put back what was broken?\n");
  const off = await run(8331, 8332, false);
  const on = await run(8333, 8334, true);

  const pad = (s, n) => String(s).padEnd(n);
  console.log("  the mock breaks the player's own item " + MY_OBJECT_ITEM +
    " (sid " + MY_OBJECT_SID + "), then watches the wire\n");
  console.log("  " + pad("replace", 12) + pad("spawned", 10) + pad("switch reads", 15) +
    pad("buildings placed", 18) + "which items");
  console.log("  " + "-".repeat(76));
  for (const [label, r] of [["off", off], ["on", on]]) {
    console.log("  " + pad(label, 12) + pad(r.spawned ? "yes" : "NO", 10) +
      pad(r.varState.ok ? String(r.varState.value) : "unreadable", 15) +
      pad(r.replaced, 16) + (r.otherIds.length ? r.otherIds.join(",") : "none"));
  }
  const errs = [...new Set([...off.faults, ...on.faults])];
  if (errs.length) console.log("\n  page errors: " + errs.slice(0, 3).join(" | "));

  let verdict;
  if (!off.spawned || !on.spawned) {
    verdict = "INCONCLUSIVE — a run never spawned, so nothing was tested.";
  } else if (on.replaced > 0 && off.replaced === 0) {
    verdict = "replace answers the break, and only when switched on — " +
      on.replaced + " building(s), item " + on.otherIds.join(" and ");
  } else if (on.replaced > 0) {
    verdict = "FAIL — it also fires with the switch off (" + off.replaced + "), so the switch is not the gate";
  } else {
    verdict = "FAIL — switched on, nothing was built after the break";
  }
  console.log("\n  " + verdict);
  process.exit(off.spawned && on.spawned && on.replaced > 0 && off.replaced === 0 ? 0 : 1);
})();
