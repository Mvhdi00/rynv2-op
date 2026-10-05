#!/usr/bin/env node
/*
 * test-luna-chat-e2e.js
 *
 * Does chat sync reach the game? This loads the whole of Luna_Client.user.js —
 * not an extract — into a stand-in moomoo page in headless Chromium, and
 * points it at a local WebSocket server that speaks the game's protocol:
 *
 *   io-init  [socketId, seed, key, 1]   per-connection opcode tables + HMAC key
 *   client   6-byte HMAC-SHA256 prefix + msgpack([opcode, args, seq])
 *   server   msgpack([opcode, args])
 *
 * The server checks every frame the client sends the way the game server has
 * to: the signature with Node's own HMAC-SHA256, the sequence number, and the
 * opcode through tables built by the game's own functions, lifted verbatim
 * from src/game_index.js — not Luna's copy of them. It spawns the player when
 * asked and then records every chat message that arrives.
 *
 * Then a song is added on the Music page with chat sync on, and what reaches
 * the server is compared with the .lrc: the right text, at most 30 characters
 * a message, at the right moment, nothing while dead. It also checks Test
 * chat, Send All Lyrics, and an LRC AI timeline (LRCLIB and Google Translate
 * answered from here) going out over the wire in English.
 *
 *   node tools/test-luna-chat-e2e.js        (needs playwright, as test-luna-music.js)
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { loadPlaywright, createGameServer, standInPage, ROOT } = require("./lib/fake-moomoo");

const { chromium, WebSocketServer } = loadPlaywright();
const LUNA = fs.readFileSync(path.join(ROOT, "Luna_Client.user.js"), "utf8");
const PAGE = standInPage(LUNA);
const server = createGameServer();

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? "  ok   " : "  FAIL ") + name + (detail !== undefined && !ok ? "  -> " + JSON.stringify(detail) : ""));
}

function wav(seconds) {
  const rate = 8000, n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / rate * 2 * Math.PI * 220) * 800), 44 + i * 2);
  return buf;
}

/* The lyric file: short lines, a long one, an Arabic one over 30 characters,
 * and two lines too close together. Expected messages are what Ryn's player
 * produces for it (same 30-char wrap, same spacing). */
const LRC = [
  "[00:01.00]first line here",
  "[00:03.00]this one is far too long to fit in a single chat message",
  "[00:08.00]يا حبيبي تحت المطر قلبي ما نسيتك أبداً",
  "[00:11.00]close one",
  "[00:11.40]too close to send",
  "[00:14.00]last line"
].join("\n");
const EXPECT = [
  { text: "first line here", at: 1.0 },
  { text: "this one is far too long to", at: 3.0 },
  { text: "fit in a single chat message", at: 5.5 },
  { text: "يا حبيبي تحت المطر", at: 8.0 },
  { text: "قلبي ما نسيتك أبداً", at: 9.6 },
  { text: "close one", at: 11.0 },
  { text: "last line", at: 14.0 }
];

const LEMON = {
  id: 4242, trackName: "Lemon", artistName: "Kenshi Yonezu", albumName: "Lemon", duration: 16, instrumental: false,
  plainLyrics: "", syncedLyrics: "[00:01.00] 夢ならばどれほどよかったでしょう\n[00:04.00] 未だにあなたのことを夢にみる\n[00:07.00] 忘れた物を取りに帰るように"
};
const TRANSLATE = {
  "夢ならばどれほどよかったでしょう": "If only this were a dream",
  "未だにあなたのことを夢にみる": "I still see you in my dreams",
  "忘れた物を取りに帰るように": "Like going back for something"
};

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "luna-chat-e2e-"));
  const songPath = path.join(tmp, "song.wav");
  const lrcPath = path.join(tmp, "song.lrc");
  fs.writeFileSync(songPath, wav(16));
  fs.writeFileSync(lrcPath, LRC);

  const httpServer = http.createServer((req, res) => {
    if (req.url === "/luna.js") { res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" }); return res.end(LUNA); }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
  });
  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", server.onConnection);
  await new Promise(r => httpServer.listen(0, "127.0.0.1", r));
  const port = httpServer.address().port;

  const launch = { args: [ "--autoplay-policy=no-user-gesture-required" ] };
  if (fs.existsSync("/opt/pw-browsers/chromium")) launch.executablePath = "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => {
    const u = new URL(route.request().url());
    const json = body => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (u.hostname === "lrclib.net" && /lemon/i.test(u.search)) return json(u.pathname === "/api/get" ? LEMON : [ LEMON ]);
    if (u.hostname === "lrclib.net") return json([]);
    if (u.hostname === "translate.googleapis.com") {
      const q = u.searchParams.get("q");
      return json([ [ [ TRANSLATE[q] || q, q, null, null, 10 ] ], null, TRANSLATE[q] ? "ja" : "en" ]);
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  /* The stand-in page has no game world, so Luna's game loop may throw; what
   * matters is that nothing throws from the Music page or LRC AI. Errors are
   * placed by the line they come from in luna.js. */
  const lines = LUNA.split("\n");
  const lineOf = needle => lines.findIndex(l => l.includes(needle)) + 1;
  const musicFrom = lineOf("const LunaMusic = (function () {");
  const musicTo = lineOf("const STORAGE_KEY = \"DELTEK_V4_CONFIG\";");
  const errors = [];
  page.on("pageerror", e => {
    const m = String(e && e.stack || "").match(/luna\.js:(\d+):/);
    errors.push({ message: String(e && e.message || e), line: m ? +m[1] : 0 });
  });
  await page.goto("http://127.0.0.1:" + port + "/");

  console.log("connect + spawn");
  await page.waitForFunction(() => window.__lunaMusicChat && document.querySelector(".lm-page"), null, { timeout: 10000 }).catch(() => {});
  check("Luna booted with its menu and the Music tab", await page.locator('.nav-item[data-tab="music"]').count() === 1);
  check("chat bridge exported from app.js", await page.evaluate(() => !!window.__lunaMusicChat));
  /* What the game's own page script does: open the socket. Luna intercepts it. */
  await page.evaluate(p => { new WebSocket("ws://127.0.0.1:" + p + "/"); }, port);
  await page.waitForFunction(() => window.__lunaMusicChat.status().inGame, null, { timeout: 10000 }).catch(() => {});
  const st = await page.evaluate(() => window.__lunaMusicChat.status());
  check("bridge reports socket open, handshake done, in game", st.socket === "OPEN" && st.handshake && st.inGame, st);
  check("spawn request reached the server", server.frames.some(f => f.name === "M"));

  console.log("chat sync over the wire");
  await page.click('.nav-item[data-tab="music"]');
  await page.click(".rm-sec-head:has-text('Add song')");
  await page.setInputFiles("#song-file-input", songPath);
  await page.fill("#song-title-input", "Wire test");
  await page.setInputFiles("#lrc-file-input", lrcPath);
  await page.waitForFunction(() => document.querySelector("#song-lyrics-input").value.length > 0);
  await page.check("#song-autosync");
  const chatsBefore = server.chats.length;
  await page.click("#add-song");
  await page.waitForFunction(() => { const a = window.__song(); return a && !a.paused && a.currentTime > 0.1; }, null, { timeout: 5000 });
  const startWall = await page.evaluate(() => Date.now() - window.__song().currentTime * 1000);
  await page.waitForFunction(() => { const a = window.__song(); return a && a.currentTime > 15.5; }, null, { timeout: 25000 });
  await page.click("#music-play");
  await page.waitForTimeout(300);
  const got = server.chats.slice(chatsBefore).map(c => ({ text: c.text, at: +((c.at - startWall) / 1000).toFixed(2) }));
  console.log("    server received:", JSON.stringify(got));
  const ping = await page.evaluate(() => window.pingTime || 0);
  check("server got the lyric messages, in order", JSON.stringify(got.map(c => c.text)) === JSON.stringify(EXPECT.map(e => e.text)), got.map(c => c.text));
  check("every message within the 30-character chat cap", got.every(c => c.text.length <= 30), got.map(c => c.text.length));
  check("every frame validly signed (HMAC-SHA256, 6 bytes)", server.frames.every(f => f.sigOk));
  check("sequence numbers unbroken", server.frames.every(f => f.seqOk));
  check("chat goes out as the game's chat opcode", server.frames.filter(f => f.name === "6").length >= EXPECT.length);
  const lateness = got.map((c, i) => EXPECT[i] ? +(c.at - EXPECT[i].at).toFixed(2) : null);
  console.log("    arrival vs .lrc time (s):", JSON.stringify(lateness), " auto delay ping:", ping, "ms");
  check("each line arrives on its beat (within 0.25 s)", lateness.every(d => d !== null && Math.abs(d) <= 0.25), lateness);

  console.log("test chat + send all");
  await page.click(".rm-sec-head:has-text('Chat sync')");
  let n = server.chats.length;
  await page.click("#bm-test-chat");
  await page.waitForTimeout(400);
  check("Test chat reaches the server", server.chats.slice(n).some(c => c.text === "🎵 Luna music sync test"), server.chats.slice(n));
  n = server.chats.length;
  await page.click("#bm-send-all-lyrics");
  await page.waitForTimeout(5200);
  await page.click("#bm-send-all-lyrics");
  const all = server.chats.slice(n);
  check("Send All Lyrics sends the lines in order", all.length >= 3 && all[0].text === "first line here" && all[1].text === "this one is far too long to", all.map(c => c.text));
  const gaps = all.slice(1).map((c, i) => c.at - all[i].at);
  check("Send All Lyrics keeps ~2.3 s between messages", gaps.every(g => g > 2100 && g < 2600), gaps);

  console.log("dead: nothing sent");
  server.sendTo("P", []);                                         /* killPlayer */
  await page.waitForFunction(() => !window.__lunaMusicChat.status().inGame, null, { timeout: 5000 }).catch(() => {});
  check("bridge sees the death", !(await page.evaluate(() => window.__lunaMusicChat.status().inGame)));
  n = server.chats.length;
  await page.locator(".rm-song-row").first().click();
  await page.waitForTimeout(3600);
  check("no chat while dead", server.chats.length === n, server.chats.slice(n));
  await page.click("#music-play");

  console.log("respawn + LRC AI lyrics over the wire");
  await page.keyboard.press("Escape");                            /* close Luna's menu */
  await page.click("#enterGame");
  await page.keyboard.press("Escape");                            /* and open it again */
  await page.waitForFunction(() => window.__lunaMusicChat.status().inGame, null, { timeout: 5000 }).catch(() => {});
  check("back in game after respawn", await page.evaluate(() => window.__lunaMusicChat.status().inGame));
  await page.setInputFiles("#song-file-input", songPath);
  await page.fill("#song-title-input", "Kenshi Yonezu - Lemon");
  await page.fill("#song-lyrics-input", "");
  await page.uncheck("#song-autosync");
  await page.click("#add-song");
  await page.waitForTimeout(300);
  await page.locator(".rm-lrc-btn").nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll(".rm-lrc-btn")[1].textContent === "✓ LRC", null, { timeout: 15000 }).catch(() => {});
  check("LRC AI ready", (await page.locator(".rm-lrc-btn").nth(1).textContent()) === "✓ LRC");
  n = server.chats.length;
  await page.locator(".rm-song-row").nth(1).click();
  await page.waitForFunction(() => { const a = window.__song(); return a && a.currentTime > 9; }, null, { timeout: 15000 });
  await page.click("#music-play");
  await page.waitForTimeout(200);
  const ai = server.chats.slice(n).map(c => c.text);
  console.log("    server received:", JSON.stringify(ai));
  check("LRC AI's English lines reach the server", JSON.stringify(ai) === JSON.stringify([ "If only this were a dream", "I still see you in my dreams", "Like going back for something" ]), ai);

  const ours = errors.filter(e => e.line >= musicFrom && e.line <= musicTo);
  console.log("    page errors from Luna's game loop on the stand-in page:", errors.length - ours.length,
    errors.length ? "(" + [ ...new Set(errors.map(e => e.message)) ].slice(0, 2).join(" | ") + ")" : "");
  check("no errors from the Music page or LRC AI", ours.length === 0, ours.slice(0, 5));

  await browser.close();
  wss.close();
  httpServer.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
