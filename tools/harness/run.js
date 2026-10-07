#!/usr/bin/env node
/*
 * Offline harness: the shipped game bundle, a userscript injected at
 * document-start, and a mock game server, all in a real Chromium.
 *
 * Nothing goes to the network. moomoo.io, the server list, /join, Turnstile
 * and the game socket are all answered locally:
 *   /                     page.html (the DOM ids the bundle and Ryn look up)
 *   /assets/index-*.js    src/game_index-cfaab428.js
 *   /assets/vendor-*.js   src/game_vendor-a3a301f0.js
 *   /p/s16nqv.js          protocol.js (moomoo-protocol: BUILD_ID, BUILD_SALT, mixKey)
 *   /img/**               a flat 64x64 red sprite
 *   wss://*.moomoo.io     mock.js (io-init, spawn, player updates, store)
 *
 *   npm i --no-save playwright-core
 *   node tools/harness/run.js [ryn=Ryn_Type_2.user.js] [scenario=./scen_snow.js]
 *        [eval=ev_play.js] [pre=pre_namecolor.js] [late=1] [shot=out.png]
 *
 * Options:
 *   ryn=      userscript to inject (default Ryn_Type_2.user.js)
 *   scenario= module passed to mock.js (pinned session, positions, hats)
 *   pre=      script injected before the userscript (e.g. seeded settings)
 *   late=1    inject after <head> is parsed instead of at document-start
 *   eval=     script evaluated in the page after `wait` ms
 *   shot=     screenshot path
 *   bundle=   game bundle to serve instead of src/game_index-cfaab428.js
 *   failimg=1 answer the first request for each hat sprite with a 404
 */

let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch (e) {
  console.error("playwright-core is not installed: npm i --no-save playwright-core");
  process.exit(1);
}
const fs = require("fs"), path = require("path"), zlib = require("zlib");

const ROOT = path.resolve(__dirname, "../..");
const HERE = __dirname;
const at = p => path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
const opts = Object.fromEntries(process.argv.slice(2).map(a => [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)]));
const RYN = fs.readFileSync(opts.ryn ? at(opts.ryn) : path.join(ROOT, "Ryn_Type_2.user.js"), "utf8");
const INDEX = fs.readFileSync(opts.bundle ? at(opts.bundle) : path.join(ROOT, "src/game_index-cfaab428.js"));
const VENDOR = fs.readFileSync(path.join(ROOT, "src/game_vendor-a3a301f0.js"));
const servers = [{ region: "us-east", name: "1", key: "abcd1234", playerCount: 5, playerCapacity: 40 }];

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c >>> 1 ^ 0xedb88320 & -(c & 1);
  }
  return ~c >>> 0;
}
function png(w, h, rgba) {
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array(w).fill(rgba).flat())])));
  const chunk = (t, d) => { const b = Buffer.alloc(4); b.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([Buffer.from(t), d]))); return Buffer.concat([b, Buffer.from(t), d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const SPRITE = png(64, 64, [200, 30, 30, 255]);

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const log = { push: m => console.log(m) };
  const imgReqs = [];
  await ctx.route("**/*", async route => {
    const u = new URL(route.request().url());
    const send = (body, type, status = 200) => route.fulfill({ status, body, headers: { "content-type": type, "access-control-allow-origin": "*" } });
    if (u.hostname === "moomoo.io") {
      if (u.pathname === "/") return send(fs.readFileSync(path.join(HERE, "page.html")), "text/html");
      if (u.pathname === "/assets/index-cfaab428.js") return send(INDEX, "application/javascript");
      if (u.pathname === "/assets/vendor-a3a301f0.js") return send(VENDOR, "application/javascript");
      if (u.pathname === "/p/s16nqv.js") return send(fs.readFileSync(path.join(HERE, "protocol.js")), "application/javascript");
      if (u.pathname.startsWith("/img/")) {
        imgReqs.push(u.pathname + u.search);
        // failimg=1: the first, plain request for a hat fails, as a request
        // that never got its image would.
        if (opts.failimg === "1" && u.pathname.startsWith("/img/hats/") && !u.search) return send("", "text/plain", 404);
        return send(SPRITE, "image/png");
      }
      log.push("404 " + u.href); return send("", "text/plain", 404);
    }
    if (/^api(-prod2)?\.moomoo\.io$/.test(u.hostname) && u.pathname === "/servers") return send(JSON.stringify(servers), "application/json");
    if (/^api(-prod2)?\.moomoo\.io$/.test(u.hostname) && u.pathname === "/join") {
      const body = JSON.parse(route.request().postData() || "{}");
      log.push("[api] /join did=" + (body.did || "(none)") + " host=" + body.host);
      // Like the real API: a first join is issued a device id.
      return send(JSON.stringify(body.did ? { ticket: "TICKET1" } : { ticket: "TICKET1", did: "DID-issued-1" }), "application/json");
    }
    if (u.hostname === "challenges.cloudflare.com") return send(fs.readFileSync(path.join(HERE, "turnstile.js")), "application/javascript");
    if (/\.moomoo\.io$/.test(u.hostname) && u.pathname === "/ping") return send("", "text/plain");
    if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    imgReqs.push("EXT " + u.href.slice(0, 120));
    return route.abort();
  });
  const page = await ctx.newPage();
  const mock = require("./mock.js");
  const scenario = opts.scenario ? require(at(opts.scenario)) : {};
  await page.routeWebSocket(/moomoo\.io/, ws => { log.push("[mock] connect " + ws.url().slice(0, 90)); mock.attach(ws, log, scenario); });
  page.on("console", m => { if (!/ERR_FAILED/.test(m.text())) log.push("[console." + m.type() + "] " + m.text().slice(0, 300)); });
  page.on("pageerror", e => log.push("[pageerror] " + (e.stack || e.message).slice(0, 600)));
  if (opts.pre) await page.addInitScript({ content: fs.readFileSync(at(opts.pre), "utf8") });
  if (opts.late === "1") {
    await page.addInitScript({ content: "window.__RYN_SRC=" + JSON.stringify(RYN) + ";new MutationObserver(function(m,o){if(document.head&&document.querySelector('script[type=module]')&&document.body){o.disconnect();(0,eval)(window.__RYN_SRC);}}).observe(document,{childList:true,subtree:true});" });
  } else if (opts.noryn !== "1") {
    await page.addInitScript({ content: RYN });
  }
  await page.goto("https://moomoo.io/", { waitUntil: "load" });
  await page.waitForTimeout(+(opts.wait || 4000));
  if (opts.eval) {
    try {
      const r = await Promise.race([
        page.evaluate(fs.readFileSync(at(opts.eval), "utf8")),
        new Promise((_, j) => setTimeout(() => j(new Error("eval timeout")), +(opts.evalTimeout || 40000)))
      ]);
      log.push("[eval] " + JSON.stringify(r).slice(0, 6000));
    } catch (e) {
      log.push("[eval-error] " + e.message.slice(0, 1000));
    }
    await page.waitForTimeout(+(opts.wait2 || 1500));
  }
  if (opts.shot) await page.screenshot({ path: at(opts.shot) });
  console.log("sprite requests:\n  " + [...new Set(imgReqs)].join("\n  "));
  await browser.close();
  // The mock's tick timers would keep node alive.
  process.exit(0);
})().catch(e => { console.error("RUNNER", e); process.exit(1); });
