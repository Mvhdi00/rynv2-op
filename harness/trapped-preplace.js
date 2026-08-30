/* Does preplace still run while you are standing in the enemy's trap?
 *
 * It used not to. The gate read
 *
 *   window.vars.prePlace && nearestEnemy && dist < 300 && !(nearestTrap && spikeDmgCount > 0)
 *
 * and both halves of that last clause are reachable from the wire, which is what
 * makes this testable at all. `nearestTrap` is an enemy pit trap within 50 of
 * you, so it means trapped. `spikeDmgCount` counts consecutive ticks of spike
 * damage, and spike damage is recognised purely by the amount — updateHealth
 * pushes the delta, and distributionDamages keeps it only if it is 20, 30, 35,
 * 45 or one of those times 0.75. So a health packet that takes exactly 20 off is
 * a spike hit as far as the client is concerned.
 *
 * What this counts is the gate, not the placement. Counting placements was the
 * first attempt and it measured nothing: a preplace only happens when the enemy
 * is mid-swing at a building weak enough to die to it, and this mock does not
 * reproduce weapon reload timing or object health, so the untrapped run placed
 * nothing either and the comparison was empty. The gate is what changed, so the
 * gate is what to count — how many ticks reach the preplace search, trapped
 * against untrapped.
 *
 * The counter is injected at an anchor, like loop-alive.js does, and the run
 * fails loudly if the anchor moves rather than quietly reporting zero.
 *
 *   node trapped-preplace.js [client.js]
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

const SPIKE_HIT = 20;          // an amount distributionDamages counts as spikes

/* Count the ticks that reach the preplace search, and the ones that reach it
 * while the client believes it is trapped and being spiked — the exact state
 * the old gate excluded. */
/* Two probes, and the placement of them is the whole test.
 *
 * The first version put a single counter inside the block, after the gate. That
 * cannot see what the gate excluded — against the old build it reported "never
 * reached trapped+spiked" and called itself inconclusive, which is true but
 * useless. So: one probe OUTSIDE the gate recording the state every tick, and
 * one INSIDE recording that the search ran. Old build: state seen, search not
 * run. New build: both.
 *
 * The outside anchor is the part of the condition both builds share, so the same
 * test runs against either. */
const STATE_ANCHOR = "if (window.vars.prePlace && nearestEnemy && UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) < 300";
const STATE_PROBE = `if (nearestTrap) window.__sawTrap = (window.__sawTrap || 0) + 1;
                if (spikeDmgCount > 0) window.__sawSpike = (window.__sawSpike || 0) + 1;
                if (nearestTrap && spikeDmgCount > 0) window.__sawBoth = (window.__sawBoth || 0) + 1;
                `;

const RAN_ANCHOR = "let findObject = getPrePlaceObject();";
const RAN_PROBE = `window.__pp = (window.__pp || 0) + 1;
                    if (nearestTrap && spikeDmgCount > 0) window.__ppTrapped = (window.__ppTrapped || 0) + 1;
                    `;

const raw = fs.readFileSync(CLIENT, "utf8");
for (const [name, a] of [["state", STATE_ANCHOR], ["ran", RAN_ANCHOR]]) {
  if (raw.includes(a)) continue;
  console.error("the " + name + " anchor is not in " + path.basename(CLIENT) + ":");
  console.error("  " + a);
  console.error("the preplace block moved — fix the anchor rather than trusting a zero");
  process.exit(2);
}
const INSTRUMENTED = raw
  .replace(STATE_ANCHOR, STATE_PROBE + STATE_ANCHOR)
  .replace(RAN_ANCHOR, RAN_PROBE + RAN_ANCHOR);

const SERVER_LIST = `
(function () {
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input) {
    const url = String((input && input.url) || input);
    if (url.includes("/servers")) {
      return Promise.resolve(new Response(JSON.stringify([{
        region: 1, key: "0", name: "mock", index: 0, port: PORT,
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
    const target = "ws://127.0.0.1:PORT";
    return protocols === undefined ? new Native(target) : new Native(target, protocols);
  }
  Redirected.prototype = Native.prototype;
  Redirected.CONNECTING = Native.CONNECTING; Redirected.OPEN = Native.OPEN;
  Redirected.CLOSING = Native.CLOSING; Redirected.CLOSED = Native.CLOSED;
  try { window.WebSocket = Redirected; } catch (e) {}
})();
`;

async function run(httpPort, wsPort, trapped) {
  const http_server = http.createServer((req, res) => {
    let p = req.url.split("?")[0];
    if (p === "/") p = "/index.html";
    const file = path.join(HERE, p);
    if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => http_server.listen(httpPort, "127.0.0.1", r));

  let phase = "idle";
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
  await page.addInitScript({ content: SERVER_LIST.replace("PORT", String(wsPort)) });
  await page.addInitScript({ content: REDIRECT.replace("PORT", String(wsPort)) });

  const installed = await inject.install(page, INSTRUMENTED);
  await page.goto("http://127.0.0.1:" + httpPort + "/", { waitUntil: "load" });
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

  if (trapped && session) {
    /* An enemy pit trap right on top of the player. nearestTrap wants item id
     * 15, an owner who is not you, and a distance of 50 or less. */
    session.send("H", [[20, 7e3 + 10, 6e3 + 10, 0, 45, null, 15, 2]]);
    await page.waitForTimeout(400);
  }

  /* Spike damage, repeatedly: spikeDmgCount resets to 0 on any tick without it,
   * so one hit is not the state the gate was testing for. */
  phase = "measuring";
  for (let i = 0; i < 6; i++) {
    if (session) {
      session.send("O", [session.mySid, 100 - SPIKE_HIT]);
      session.send("O", [session.mySid, 100]);
    }
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(1200);

  const counts = await page.evaluate(() => ({
    reached: window.__pp || 0,
    reachedWhileTrapped: window.__ppTrapped || 0,
    sawTrap: window.__sawTrap || 0,
    sawSpike: window.__sawSpike || 0,
    sawBoth: window.__sawBoth || 0,
  })).catch(() => ({ reached: 0, reachedWhileTrapped: 0, sawTrap: 0, sawSpike: 0, sawBoth: 0 }));

  await browser.close();
  wss.close();
  http_server.close();
  return { spawned, ...counts, faults: [...new Set(faults)] };
}

(async () => {
  console.log(path.basename(CLIENT) + " — does preplace survive being trapped?\n");
  const free = await run(8351, 8352, false);
  const stuck = await run(8353, 8354, true);

  const pad = (s, n) => String(s).padEnd(n);
  console.log("  " + pad("run", 20) + pad("spawned", 10) + pad("trapped", 11) +
    pad("spiked", 11) + pad("both at once", 14) + "preplace ran while both");
  console.log("  " + "-".repeat(88));
  for (const [label, r] of [["no trap", free], ["trapped, spiked", stuck]]) {
    console.log("  " + pad(label, 20) + pad(r.spawned ? "yes" : "NO", 10) +
      pad(r.sawTrap + " ticks", 11) + pad(r.sawSpike + " ticks", 11) +
      pad(r.sawBoth + " ticks", 14) +
      (r.sawBoth ? r.reachedWhileTrapped + " of " + r.sawBoth : "-"));
  }

  const errs = [...new Set([...free.faults, ...stuck.faults])];
  if (errs.length) console.log("\n  page errors: " + errs.slice(0, 3).join(" | "));

  let verdict, ok = false;
  if (!free.spawned || !stuck.spawned) {
    verdict = "INCONCLUSIVE — a run never spawned, so nothing was tested.";
  } else if (!stuck.sawBoth) {
    verdict = "INCONCLUSIVE — the trapped run never reached trapped+spiked at the same\n" +
      "  tick, so the gate was never asked the question. Check the trap packet\n" +
      "  and that the damage amount is one distributionDamages counts as spikes.";
  } else if (stuck.reachedWhileTrapped === stuck.sawBoth) {
    verdict = "preplace runs every tick you are trapped and being spiked — " +
      stuck.reachedWhileTrapped + " of " + stuck.sawBoth;
    ok = true;
  } else if (stuck.reachedWhileTrapped > 0) {
    verdict = "partly — the search ran on " + stuck.reachedWhileTrapped + " of " +
      stuck.sawBoth + " trapped-and-spiked ticks, so something still gates it";
  } else {
    verdict = "FAIL — trapped and spiked on " + stuck.sawBoth +
      " ticks and the search never ran on any of them";
  }
  console.log("\n  " + verdict);
  process.exit(ok ? 0 : 1);
})();
