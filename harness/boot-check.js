/* Does pressing Play actually reach the client's connect path?
 *
 * spawn-check.js proved the captcha gate works by calling Oh() directly. That
 * skips the part of the boot that has to wire the button in the first place —
 * so a client whose menu never gets wired would pass it and still do nothing on
 * the real page. This clicks the button.
 *
 * Everything Revelation needs to play hangs off one line:
 *
 *   window.frvrSdkInitPromise.then(() => window.FRVR.bootstrapper.complete())
 *                            .then(() => $h());
 *
 * $h() fetches the server list and then calls Wh(), and Wh() is what sets
 * #enterGame.onclick. There is no catch and no timeout on that chain, and the
 * client runs at document-idle — so the page's own bundle has already run the
 * identical line and consumed the bootstrapper before the client gets to it.
 * That looked like a plausible way for the menu to end up unwired, so this runs
 * the client under four states of that SDK and clicks the real button each
 * time. It is not: the client reaches a connection under all four. Kept because
 * it is the only test that goes through the button, and because it tells the
 * two programs on the page apart — both open sockets, so counting them proves
 * nothing.
 *
 *   node boot-check.js [client.js]
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

/* The four ways the page can hand the SDK over. "ok" is what the old stub did
 * and the only one the client was ever run against. */
const MODES = {
  ok: "resolves, complete() is a no-op",
  consumed: "complete() throws once the page's bundle has called it",
  stalled: "frvrSdkInitPromise never settles",
  missing: "window.frvrSdkInitPromise is undefined",
};

function frvrStub(mode) {
  return `
window.__frvrMode = ${JSON.stringify(mode)};
(function () {
  var completed = false;
  window.FRVR = {
    bootstrapper: {
      complete: function () {
        if (window.__frvrMode === "consumed" && completed)
          throw new Error("bootstrapper already completed");
        completed = true;
      }
    },
    tracker: { levelStart() {}, levelEnd() {} },
    ads: { show() { return Promise.resolve(); } },
    channelCharacteristics: { allowNavigation: true },
    profile: null,
    setChannel() {},
  };
  if (window.__frvrMode === "stalled") window.frvrSdkInitPromise = new Promise(function () {});
  else if (window.__frvrMode === "missing") window.frvrSdkInitPromise = undefined;
  else window.frvrSdkInitPromise = Promise.resolve();
})();
window.turnstile = {
  render() { return "stub"; }, reset() {}, remove() {},
  getResponse() { return "stub-token"; },
};
`;
}

const SERVER_LIST = `
(function () {
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input) {
    const url = String((input && input.url) || input);
    if (url.includes("/servers")) {
      window.__serversFetched = (window.__serversFetched || 0) + 1;
      return Promise.resolve(new Response(JSON.stringify([{
        region: 1, key: "0", name: "mock", index: 0, port: 8322,
        playerCount: 1, playerCapacity: 50
      }]), { status: 200, headers: { "content-type": "application/json" } }));
    }
    return realFetch.apply(this, arguments);
  };
})();
`;

/* Both programs are on this page and both open sockets, so counting them
 * answers nothing — attribute each one. The page's bundle is a module served
 * from /assets, the client is evaluated as a string and has no source URL. */
const REDIRECT = `
(function () {
  const Native = window.WebSocket;
  function Redirected(url, protocols) {
    window.__wsUrls = window.__wsUrls || [];
    window.__wsUrls.push(String(url));
    const stack = new Error().stack || "";
    window.__wsBy = window.__wsBy || [];
    window.__wsBy.push(/assets\\/index-/.test(stack) ? "page" : "client");
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
  gateState: function () { return { ready: typeof ps !== "undefined" ? ps : "absent",
                                    token: typeof code !== "undefined" ? code : "absent",
                                    kind: typeof revTokenKind !== "undefined" ? revTokenKind : "absent",
                                    servers: typeof qe !== "undefined" && qe.servers ? Object.keys(qe.servers).length : "none",
                                    selected: typeof bi !== "undefined" ? bi : "absent" }; },
}; } catch (e) { window.__revErr = String(e); }`;

async function run(browser, mode, source) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));

  await page.addInitScript({ content: frvrStub(mode) });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });

  const installed = await inject.install(page, source + HOOK);
  await page.goto("http://127.0.0.1:8321/", { waitUntil: "load" });
  await installed.finish();
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    try { if (typeof window.onGotTurnstileToken === "function") window.onGotTurnstileToken("stub-token"); } catch (e) {}
  });
  await page.waitForTimeout(300);

  const before = await page.evaluate(() => ({
    wired: !!(document.getElementById("enterGame") || {}).onclick,
    gate: window.__rev ? window.__rev.gateState() : (window.__revErr || "no hook"),
    fetches: window.__serversFetched || 0,
  }));

  /* A real click: the client guards its handler with checkTrusted. */
  try { await page.click("#enterGame", { timeout: 2000 }); } catch (e) { errors.push("click: " + e.message.split("\n")[0]); }
  await page.waitForTimeout(3000);

  const after = await page.evaluate(() => {
    const by = window.__wsBy || [];
    return {
      sockets: by.length,
      byClient: by.filter((x) => x === "client").length,
      byPage: by.filter((x) => x === "page").length,
      url: (window.__wsUrls || [])[0] || "(none)",
    };
  });

  await page.close();
  return { mode, ...before, ...after, errors: [...new Set(errors)] };
}

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
  const wss = server.start(8322, null);

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const source = fs.readFileSync(CLIENT, "utf8");

  console.log(path.basename(CLIENT) + " — pressing the real Play button\n");
  const rows = [];
  for (const mode of Object.keys(MODES)) rows.push(await run(browser, mode, source));

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("FRVR SDK", 10) + pad("button", 9) + pad("servers", 9) + pad("client ws", 11) + pad("page ws", 9) + "what the client did");
  console.log("-".repeat(80));
  for (const r of rows) {
    const gate = typeof r.gate === "object" ? r.gate : {};
    console.log(
      pad(r.mode, 10) +
      pad(r.wired ? "wired" : "DEAD", 9) +
      pad(gate.servers === undefined ? "?" : gate.servers, 9) +
      pad(r.byClient, 11) +
      pad(r.byPage, 9) +
      (r.byClient ? "connects" : "NOTHING") + (r.errors.length ? "  [" + r.errors[0] + "]" : "")
    );
  }
  console.log("\n" + Object.entries(MODES).map(([k, v]) => "  " + pad(k, 10) + v).join("\n"));

  const bad = rows.filter((r) => !r.byClient);
  console.log("\n" + (bad.length
    ? bad.length + " of " + rows.length + " states leave the client dead: " + bad.map((r) => r.mode).join(", ")
    : "all " + rows.length + " states reach a connection"));

  await browser.close();
  wss.close();
  http_server.close();
  process.exit(bad.length ? 1 : 0);
})();
