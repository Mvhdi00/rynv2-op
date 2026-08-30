/* Does the custom weapon carry actually draw, and does it leave the canvas clean?
 *
 * Two questions, and the second is the one that matters. Tilting the weapon
 * means a save/rotate/restore around the draw, and an unbalanced pair there is
 * the fault this file already carries an unwind for: the transform survives into
 * every later frame and the whole screen drifts. So this counts save and restore
 * calls per frame and requires them equal.
 *
 * The first question needs a picture. Sprite hosts are unreachable from the
 * sandbox, so every weapon image is broken here and renderTool draws nothing —
 * a screenshot would show the change to the hands and nothing else. So any image
 * the client requests from the weapons folder is answered with a solid bar
 * instead, which makes the tilt visible.
 *
 *   node weapon-style.js [client.js]
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

/* A long solid bar, so a weapon is visible and its angle obvious. */
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

/* Count save/restore on the 2d context, so an unbalanced pair is measurable
 * rather than something you notice three frames later as a drifting screen. */
const COUNT_SAVES = `
(function () {
  const proto = CanvasRenderingContext2D.prototype;
  const save = proto.save, restore = proto.restore;
  window.__saves = 0; window.__restores = 0;
  proto.save = function () { window.__saves++; return save.apply(this, arguments); };
  proto.restore = function () { window.__restores++; return restore.apply(this, arguments); };
})();
`;

const SERVER_LIST = `
(function () {
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input) {
    const url = String((input && input.url) || input);
    if (url.includes("/servers")) {
      return Promise.resolve(new Response(JSON.stringify([{
        region: 1, key: "0", name: "mock", index: 0, port: 8362,
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
    const target = "ws://127.0.0.1:8362";
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
  await new Promise((r) => http_server.listen(8361, "127.0.0.1", r));

  const got = [];
  let session = null;
  const wss = server.start(8362, (kind, letter) => got.push(letter),
    { requireSpawn: true, onSession: (s) => { session = s; } });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const faults = [];
  page.on("pageerror", (e) => faults.push(String(e.message).slice(0, 140)));

  await page.addInitScript({ content: fs.readFileSync(path.join(HERE, "assets/frvr-stub.js"), "utf8") });
  await page.addInitScript({ content: FAKE_SPRITES });
  await page.addInitScript({ content: COUNT_SAVES });
  await page.addInitScript({ content: SERVER_LIST });
  await page.addInitScript({ content: REDIRECT });

  const installed = await inject.install(page, fs.readFileSync(CLIENT, "utf8"));
  await page.goto("http://127.0.0.1:8361/", { waitUntil: "load" });
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
  const spawned = got.includes("M");

  /* Cut the picture out of the canvas, not off the page.
   *
   * A page screenshot of this crop caught the mod menu sitting over the canvas
   * and none of the character. The canvas is the thing under test, so read the
   * pixels straight out of it and scale them up — no DOM, no overlays, no
   * dependence on where an unstyled page happens to put things. */
  const CROP = 150, ZOOM = 3;
  const shot = async (name) => {
    const dataUrl = await page.evaluate(({ crop, zoom }) => {
      const c = document.getElementById("gameCanvas");
      const out = document.createElement("canvas");
      out.width = crop * zoom; out.height = crop * zoom;
      const g = out.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(c, c.width / 2 - crop / 2, c.height / 2 - crop / 2, crop, crop,
        0, 0, crop * zoom, crop * zoom);
      return out.toDataURL("image/png");
    }, { crop: CROP, zoom: ZOOM });
    const file = path.join(OUT, name);
    fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
    return file;
  };

  /* Two samples, because "a player changed" is not the question once the style
   * is meant to cover everyone. The mock puts you at the centre and the rival
   * 150 right and 40 down, so read both patches and require both to move. */
  const read = async () => page.evaluate(() => {
    const c = document.getElementById("gameCanvas");
    const g = c.getContext("2d");
    const patch = (dx, dy) => {
      const d = g.getImageData(c.width / 2 + dx - 80, c.height / 2 + dy - 80, 160, 160).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7;
      return sum;
    };
    return { me: patch(0, 0), rival: patch(150, 40) };
  });

  const set = async (on) => {
    await page.evaluate((v) => { window.vars.xWeaponStyle = v; }, on);
    await page.waitForTimeout(700);
  };

  await set(false);
  const off = await read();
  const offShot = await shot("weapon-style-off.png");

  await set(true);
  const on = await read();
  const onShot = await shot("weapon-style-on.png");

  /* Whether MY save/restore pair is balanced — which is not the same as whether
   * the counters agree.
   *
   * Two earlier versions of this check were wrong. Comparing saves to restores
   * across a window counts a read landing mid-frame as a leak. Watching the gap
   * grow does not work either: doUpdate's finally calls restore() 32 times
   * unconditionally every frame, so the gap marches away from zero on a
   * perfectly healthy loop and no leak could persist across a frame anyway.
   *
   * What is left, and what actually answers the question: the net save-restore
   * per frame must be the SAME with the style on as with it off. One unbalanced
   * save in the player draw shifts that by one per player per frame. */
  const perFrame = async (frames) => {
    return page.evaluate((n) => new Promise((resolve) => {
      const start = window.__saves - window.__restores;
      let seen = 0;
      const step = () => {
        if (++seen >= n) return resolve((window.__saves - window.__restores - start) / n);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), frames);
  };
  await set(false);
  const rateOff = await perFrame(40);
  await set(true);
  const rateOn = await perFrame(40);
  const balanced = Math.abs(rateOff - rateOn) < 0.5;

  console.log(path.basename(CLIENT) + " — custom weapon carry\n");
  const pad = (s, n) => String(s).padEnd(n);
  console.log("  " + pad("spawned", 26) + (spawned ? "yes" : "NO — nothing below means anything"));
  console.log("  " + pad("pixels around me", 26) +
    (off.me === on.me ? "IDENTICAL — nothing changed" : "changed with the switch"));
  console.log("  " + pad("pixels around the rival", 26) +
    (off.rival === on.rival ? "IDENTICAL — other players unstyled" : "changed with the switch"));
  console.log("  " + pad("save/restore balance", 26) +
    (balanced
      ? "same net per frame either way (" + rateOff.toFixed(1) + " vs " + rateOn.toFixed(1) + ")"
      : "UNBALANCED — " + rateOff.toFixed(1) + " per frame off, " + rateOn.toFixed(1) + " on"));
  if (faults.length) console.log("  " + pad("page errors", 26) + faults.slice(0, 2).join(" | "));
  console.log("\n  " + offShot + "\n  " + onShot);

  const ok = spawned && off.me !== on.me && off.rival !== on.rival && balanced && !faults.length;
  console.log("\n  " + (ok
    ? "the carry draws, and leaves the canvas as it found it"
    : "FAIL — see the rows above"));

  await browser.close();
  wss.close();
  http_server.close();
  process.exit(ok ? 0 : 1);
})();
