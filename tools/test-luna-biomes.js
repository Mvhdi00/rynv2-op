#!/usr/bin/env node
/*
 * test-luna-biomes.js
 *
 * The ground Luna draws should be the game's own colours (src/game_index.js):
 * grass #b6db66, snow #fff, desert #dbc666, river water #91b2db, under the
 * game's one overlay, rgba(0, 0, 70, 0.35). This boots the whole
 * Luna_Client.user.js against the local game server, spawns the player in
 * each biome, and reads the pixel Luna actually painted at the left edge of
 * the screen, level with the player — which must be what the game shows
 * there: the colour with the overlay blended over it.
 *
 *   node tools/test-luna-biomes.js        (needs playwright)
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { loadPlaywright, createGameServer, standInPage, ROOT } = require("./lib/fake-moomoo");

const { chromium, WebSocketServer } = loadPlaywright();
const LUNA = fs.readFileSync(path.join(ROOT, "Luna_Client.user.js"), "utf8");
const PAGE = standInPage(LUNA);

const BIOMES = [
  { name: "grass", spawn: [ 3000, 3000 ], want: "#b6db66" },
  { name: "snow", spawn: [ 3000, 1000 ], want: "#ffffff" },
  { name: "desert", spawn: [ 3000, 13500 ], want: "#dbc666" },
  { name: "river", spawn: [ 3000, 7200 ], want: "#91b2db" }
];

/* What the game shows: the ground colour, then rgba(0, 0, 70, 0.35) over it. */
const OVERLAY = { rgb: [ 0, 0, 70 ], a: 0.35 };
function onScreen(hex) {
  const c = [ 1, 3, 5 ].map(i => parseInt(hex.slice(i, i + 2), 16));
  return c.map((v, i) => Math.round(v * (1 - OVERLAY.a) + OVERLAY.rgb[i] * OVERLAY.a));
}
const hexOf = rgb => "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? "  ok   " : "  FAIL ") + name + (detail !== undefined && !ok ? "  -> " + JSON.stringify(detail) : ""));
}

(async () => {
  const launch = {};
  if (fs.existsSync("/opt/pw-browsers/chromium")) launch.executablePath = "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(launch);
  for (const biome of BIOMES) {
    const server = createGameServer((f, srv) => {
      if (f.name === "M") setInterval(() => srv.sendTo("a", [ [ 5, biome.spawn[0], biome.spawn[1], 0, -1, 0, 0, null, 0, 0, 0, 0, 0 ] ]), 111);
    }, { spawn: biome.spawn });
    const httpServer = http.createServer((req, res) => res.end(req.url === "/luna.js" ? LUNA : PAGE));
    const wss = new WebSocketServer({ server: httpServer });
    wss.on("connection", server.onConnection);
    await new Promise(r => httpServer.listen(0, "127.0.0.1", r));
    const port = httpServer.address().port;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    const page = await ctx.newPage();
    await page.goto("http://127.0.0.1:" + port + "/");
    await page.evaluate(p => { new WebSocket("ws://127.0.0.1:" + p + "/"); }, port);
    await page.waitForTimeout(2500);                              /* the camera settles on the player */
    const got = await page.evaluate(() => {
      const c = document.getElementById("gameCanvas");
      const d = c.getContext("2d").getImageData(20, Math.floor(c.height / 2), 1, 1).data;
      return [ d[0], d[1], d[2] ];
    });
    const want = onScreen(biome.want);
    const off = Math.max(...got.map((v, i) => Math.abs(v - want[i])));
    check(`${biome.name}: ${hexOf(got)} (game: ${biome.want} under its overlay = ${hexOf(want)})`, off <= 2, { got: hexOf(got), want: hexOf(want) });
    await ctx.close();
    wss.close();
    httpServer.close();
  }
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
