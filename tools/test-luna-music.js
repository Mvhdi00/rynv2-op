#!/usr/bin/env node
/*
 * test-luna-music.js
 *
 * Drives the Music page of Luna_Client.user.js in headless Chromium. The game
 * itself cannot run here, so this lifts the parts that do not need it — the
 * Music module and Luna's menu — out of the build, mounts them on a blank page
 * and stands in for app.js's chat bridge with a recorder.
 *
 * What it checks: the tab mounts and switches; a song added from a file plays;
 * chat sync sends the right lines at the right song positions, with long lines
 * split under the 30-character cap and nothing sent while out of game; like /
 * save / filters / delete; Save lyrics; Send All Lyrics; export and import;
 * the library and the page's preferences surviving a reload; and the key and
 * wheel guards keeping typing and scrolling away from the game's listeners.
 *
 *   npm i --no-save playwright   (or use a global install)
 *   node tools/test-luna-music.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  ({ chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")));
}

const ROOT = path.resolve(__dirname, "..");
const BUILD = fs.readFileSync(path.join(ROOT, "Luna_Client.user.js"), "utf8");

/* The Music module plus the menu IIFE, i.e. everything from the module to the
 * end of __lunaBoot. */
const start = BUILD.indexOf("const LunaMusic = (function () {");
const end = BUILD.indexOf("\n}\n\nif (document.readyState");
if (start < 0 || end < 0) throw new Error("could not find the menu block in the build");
const MENU = BUILD.slice(start, end);

/* 12 s of quiet tone as a WAV, so the page has a real file to play. */
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

const LRC = [
  "[00:01.00]first line",
  "[00:03.00]second line",
  "[00:03.50]too close to the second",
  "[00:06.00]this one is far too long to fit in a single chat message",
  "[00:10.00][00:11.00]twice"
].join("\n");

const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#333">
<input id="nameInput">
<script>
  window.__sent = [];
  window.__inGame = true;
  window.__lunaMusicChat = {
    send(m) {
      if (!window.__inGame) return false;
      const a = document.querySelector(".lm-page") && window.__player && window.__player._audio;
      window.__sent.push({ m, pos: a ? a.currentTime : -1 });
      return true;
    },
    status() { return { socket: "OPEN", handshake: true, inGame: window.__inGame }; },
    ping() { return 80; }
  };
  window.__gameKeys = [];
  window.__gameWheel = 0;
  window.addEventListener("keydown", e => window.__gameKeys.push(e.key));
  window.addEventListener("wheel", e => { window.__gameWheel++; e.preventDefault(); }, { passive: false });
</script>
<script>
${MENU}
window.__player = LunaMusic.player;
</script></body></html>`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? "  ok   " : "  FAIL ") + name + (detail !== undefined && !ok ? "  -> " + JSON.stringify(detail) : ""));
}

/* ------------------------------------------------------------------------ *
 * LRC AI
 *
 * LRCLIB and Google's translate endpoint are answered from here, in the
 * shapes those services return, so the whole pipeline runs — lookup, parse,
 * validate, detect, translate, cache, hand-off to chat sync — without the
 * network. Everything else off-machine is refused, which is also what makes
 * the NetEase and Textyl fallbacks come back empty.
 * ------------------------------------------------------------------------ */

const LEMON = {
  id: 4242,
  trackName: "Lemon",
  artistName: "Kenshi Yonezu",
  albumName: "Lemon",
  duration: 12,
  instrumental: false,
  plainLyrics: "夢ならばどれほどよかったでしょう\n未だにあなたのことを夢にみる",
  syncedLyrics: [
    "[00:01.00] 夢ならばどれほどよかったでしょう",
    "[00:03.50] 未だにあなたのことを夢にみる",
    "[00:06.00] 忘れた物を取りに帰るように",
    "[00:09.00] 古びた思い出の埃を払う"
  ].join("\n")
};

const SPANISH_LRC = [
  "[00:01.00]Te quiero con todo mi corazón",
  "[00:03.00]Cuando la noche llega",
  "[00:05.00]Siempre pienso en tu amor",
  "[00:07.00]Nada es como antes"
].join("\n");

const TRANSLATE = {
  "夢ならばどれほどよかったでしょう": [ "If only this were a dream", "ja" ],
  "未だにあなたのことを夢にみる": [ "I still see you in my dreams", "ja" ],
  "忘れた物を取りに帰るように": [ "Like going back for something I forgot", "ja" ],
  "古びた思い出の埃を払う": [ "Dusting off old memories", "ja" ],
  "Te quiero con todo mi corazón": [ "I love you with all my heart", "es" ],
  "Cuando la noche llega": [ "When the night comes", "es" ],
  "Siempre pienso en tu amor": [ "I always think of your love", "es" ],
  "Nada es como antes": [ "Nothing is like before", "es" ]
};

async function lrcAiPhase(browser, url, tmp, songPath) {
  console.log("LRC AI");
  const net = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => {
    const u = new URL(route.request().url());
    /* Fonts are the menu's stylesheet, not a lookup. */
    if (!/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) net.push(u.hostname + u.pathname);
    const json = (body, status) => route.fulfill({
      status: status || 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body)
    });
    if (u.hostname === "lrclib.net") {
      const asked = (u.searchParams.get("track_name") || u.searchParams.get("q") || "").toLowerCase();
      const hit = asked.includes("lemon") ? LEMON : null;
      if (u.pathname === "/api/get") return hit ? json(hit) : json({ code: 404, name: "TrackNotFound" }, 404);
      if (u.pathname === "/api/search") return json(hit ? [ hit ] : []);
    }
    if (u.hostname === "translate.googleapis.com") {
      const q = u.searchParams.get("q");
      const t = TRANSLATE[q];
      return json(t ? [ [ [ t[0], q, null, null, 10 ] ], null, t[1] ] : [ [ [ q, q, null, null, 10 ] ], null, "en" ]);
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(url);
  await page.click('.nav-item[data-tab="music"]');

  const addSong = async (title, lyrics, autoplay) => {
    await page.evaluate(() => {
      const sec = [ ...document.querySelectorAll(".rm-sec") ].find(s => s.textContent.includes("Add song"));
      sec.classList.add("open");
    });
    await page.fill("#song-title-input", title);
    await page.setInputFiles("#song-file-input", songPath);
    await page.fill("#song-title-input", title);
    await page.fill("#song-lyrics-input", lyrics || "");
    if (autoplay) await page.check("#song-autosync"); else await page.uncheck("#song-autosync");
    await page.click("#add-song");
  };
  const btnText = i => page.locator(".rm-lrc-btn").nth(i).textContent();
  const waitBtn = (i, text) => page.waitForFunction(([ i, text ]) => {
    const b = document.querySelectorAll(".rm-lrc-btn")[i];
    return b && b.textContent === text;
  }, [ i, text ], { timeout: 15000 }).then(() => true, () => false);

  check("LRC AI section on by default", await page.isChecked("#lrc-ai-auto"));

  /* 1. A song added with nothing but "Artist - Title" and a file. */
  await addSong("Kenshi Yonezu - Lemon", "", true);
  check("lyrics found and translated by themselves", await waitBtn(0, "✓ LRC"), await btnText(0));
  check("asked LRCLIB for the right song", net.some(n => n === "lrclib.net/api/get"));
  check("translated through Google", net.filter(n => n.startsWith("translate.googleapis.com")).length >= 4);
  check("timeline handed to chat sync is English",
    await page.evaluate(() => window.__player._lyrics.length > 0 && window.__player._lyrics.every(l => /^[\x20-\x7e]+$/.test(l.text))),
    await page.evaluate(() => window.__player._lyrics));

  await page.waitForFunction(() => window.__player._audio && (window.__player._audio.ended || window.__player._audio.currentTime > 11.5), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  const sent = await page.evaluate(() => window.__sent.slice());
  console.log("    sent:", JSON.stringify(sent.map(s => s.m + " @" + s.pos.toFixed(2))));
  const msgs = sent.map(s => s.m);
  check("first English line sent on time", sent[0] && sent[0].m === "If only this were a dream" && sent[0].pos < 1.3, sent[0]);
  check("every line sent in English", [ "I still see you in my dreams", "Like going back for", "something I forgot", "Dusting off old memories" ].every(m => msgs.includes(m)), msgs);
  check("no Japanese reached chat", msgs.every(m => /^[\x20-\x7e]+$/.test(m)));

  /* 2. Details panel and per-song offset. */
  await page.locator(".rm-lrc-btn").first().click();
  const kv = async key => page.evaluate(k => {
    const row = [ ...document.querySelectorAll(".rm-lrc-kv") ].find(r => r.querySelector(".rm-lrc-k").textContent === k);
    return row ? row.querySelector(".rm-lrc-v").textContent : null;
  }, key);
  check("panel opens", await page.locator(".rm-lrc-panel").isVisible());
  check("panel: source language", (await kv("Source language")) === "Japanese (detector)", await kv("Source language"));
  check("panel: translation", (await kv("Translation")) === "English via gtx", await kv("Translation"));
  check("panel: lines", (await kv("Lyric lines")) === "4");
  check("panel: synced", (await kv("Sync status")) === "synchronised");
  check("panel: source", (await kv("Lyrics source")) === "lrclib #4242");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(tmp, "4-lrc-panel.png") });
  await page.evaluate(() => window.__player.play(0));
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => window.__player._lyrics[0].ms);
  await page.click(".rm-lrc-off button:has-text('+250')");
  await page.waitForTimeout(300);
  check("offset moves the live timeline", (await page.evaluate(() => window.__player._lyrics[0].ms)) === before + 250);
  check("offset toast", (await page.textContent("#rm-toast")) === "Offset +250 ms");
  await page.click(".rm-lrc-acts button:has-text('Close')");
  check("panel closes", await page.locator(".rm-lrc-panel").count() === 0);

  /* 3. Replays come from the cache. */
  const afterReady = net.length;
  await page.evaluate(() => window.__player.play(0));
  await page.waitForTimeout(800);
  check("replay makes no request", net.length === afterReady, net.slice(afterReady));
  check("replay still English", (await page.evaluate(() => window.__player._lyrics[0].text)) === "If only this were a dream");

  /* 4. Send All Lyrics uses what LRC AI found. */
  await page.evaluate(() => { window.__sent.length = 0; });
  await page.evaluate(() => [ ...document.querySelectorAll(".rm-sec") ].find(s => s.textContent.includes("Chat sync")).classList.add("open"));
  await page.click("#bm-send-all-lyrics");
  await page.waitForTimeout(200);
  check("send all lyrics sends the English lines", (await page.evaluate(() => window.__sent[0] && window.__sent[0].m)) === "If only this were a dream");
  await page.click("#bm-send-all-lyrics");

  /* 5. Nothing found: reported once, remembered, retried only by the button. */
  await addSong("Nothing Here", "", false);
  check("not found is reported", await waitBtn(1, "Retry LRC"), await btnText(1));
  const afterNone = net.length;
  await page.evaluate(() => window.__player.play(1));
  await page.waitForTimeout(800);
  check("a remembered miss is not looked up again on play", net.length === afterNone, net.slice(afterNone));
  await page.locator(".rm-lrc-btn").nth(1).click();
  await page.waitForTimeout(800);
  check("Retry looks it up again", net.length > afterNone);

  /* 6. Pasted lyrics in another language get translated, not searched. */
  const beforeEs = net.length;
  await addSong("Mi Cancion", SPANISH_LRC, false);
  check("pasted Spanish lyrics become ready", await waitBtn(2, "✓ LRC"), await btnText(2));
  check("pasted lyrics are not searched for", !net.slice(beforeEs).some(n => n.startsWith("lrclib.net")), net.slice(beforeEs));
  const esMeta = await page.evaluate(async () => LunaLRC.Cache.getMeta(window.__player._songs[2].lrcId));
  check("source is the pasted file, Spanish", esMeta && esMeta.source === "local" && esMeta.language === "es", esMeta);
  const esLrc = await page.evaluate(async () => (await LunaLRC.Cache.getLrc(window.__player._songs[2].lrcId)).englishLrc);
  check("translated file keeps the timestamps", /\[00:01\.00\]I love you with all my heart/.test(esLrc) && /\[00:07\.00\]Nothing is like before/.test(esLrc), esLrc);

  /* 7. Automatic lookup can be switched off. */
  await page.click(".switch-checkbox:has(#lrc-ai-auto) span");
  check("auto switch turns off", !(await page.isChecked("#lrc-ai-auto")));
  const beforeOff = net.length;
  await addSong("Off Song", "", false);
  await page.waitForTimeout(800);
  check("auto off: adding makes no request", net.length === beforeOff, net.slice(beforeOff));
  check("auto off: button waits", (await btnText(3)) === "LRC AI");
  await page.click(".switch-checkbox:has(#lrc-ai-auto) span");
  check("auto switch is saved", await page.evaluate(() => JSON.parse(localStorage.getItem("DELTEK_V4_CONFIG")).musicLrcAuto === true));

  /* 8. The whole library, for songs that came in some other way. */
  await page.evaluate(() => {
    window.__player._songs.push({ title: "Kenshi Yonezu - Lemon (Official Video)", artist: "", url: window.__player._songs[0].url + "AAAA", lyrics: "", liked: false, saved: false });
    window.__player._save();
    window.__player._renderAll();
  });
  await page.click("#lrc-ai-all");
  await page.waitForFunction(() => document.querySelector("#lrc-ai-status").textContent.startsWith("Done"), null, { timeout: 20000 });
  check("whole library: looks up only what was never looked up",
    (await page.textContent("#lrc-ai-status")) === "Done — 3 of 5 songs have synced lyrics (2 looked up now).",
    await page.textContent("#lrc-ai-status"));
  check("whole library: the imported song is ready", (await btnText(4)) === "✓ LRC", await btnText(4));

  /* 9. A reload: everything comes back from the cache. */
  const beforeReload = net.length;
  await page.reload();
  await page.click('.nav-item[data-tab="music"]');
  await page.waitForFunction(() => document.querySelectorAll(".rm-lrc-btn").length === 5, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  check("states survive a reload", (await btnText(0)) === "✓ LRC" && (await btnText(1)) === "Retry LRC" && (await btnText(2)) === "✓ LRC");
  await page.evaluate(() => window.__player.play(0));
  await page.waitForTimeout(800);
  check("after reload, English from cache", (await page.evaluate(() => window.__player._lyrics[0].text)) === "If only this were a dream");
  check("after reload, no request", net.length === beforeReload, net.slice(beforeReload));
  check("offset survives a reload", (await page.evaluate(() => window.__player._lyrics[0].ms)) === 1250, await page.evaluate(() => window.__player._lyrics[0].ms));

  /* 10. Clear cache returns the song to its own lyrics. */
  await page.locator(".rm-lrc-btn").first().click();
  await page.click(".rm-lrc-acts button:has-text('Clear cache')");
  await page.waitForTimeout(400);
  check("clear cache resets the button", (await btnText(0)) === "LRC AI", await btnText(0));
  check("clear cache drops the AI timeline", (await page.evaluate(() => window.__player._lyrics.length)) === 0);

  await page.evaluate(() => [ ...document.querySelectorAll(".rm-sec") ].forEach(s => s.classList.toggle("open", /Library|LRC AI/.test(s.textContent.slice(0, 40)))));
  await page.evaluate(() => { document.querySelector(".lm-page").scrollTop = 0; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(tmp, "5-lrc-library.png") });
  check("LRC AI: no page errors", errors.length === 0, errors);
  await ctx.close();
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "luna-music-"));
  const songPath = path.join(tmp, "test_song-name.wav");
  const lrcPath = path.join(tmp, "test.lrc");
  fs.writeFileSync(songPath, wav(12));
  fs.writeFileSync(lrcPath, LRC);

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port + "/";

  const launch = { args: [ "--autoplay-policy=no-user-gesture-required" ] };
  if (fs.existsSync("/opt/pw-browsers/chromium")) launch.executablePath = "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
  /* Nothing leaves the machine: LRC AI's lookups are answered by the mock in
   * the LRC AI phase below, and refused here. */
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(url);

  console.log("mount");
  check("music tab exists", await page.locator('.nav-item[data-tab="music"]').count() === 1);
  await page.click('.nav-item[data-tab="music"]');
  check("music page shown", await page.locator(".lm-page.opened").isVisible());
  check("settings grid hidden", !(await page.locator(".deltek-content").isVisible()));
  check("header says Music Player", (await page.textContent(".header-title")) === "Music Player");
  check("no album UI", await page.locator("#rm-album-grid, #song-album-select, #music-album-badge").count() === 0);
  check("no bot sync UI", await page.locator("#music-mixed-sync, #music-bots-only-sync, #music-unified-sync, #music-sync-bot-btn").count() === 0);
  check("empty library message", (await page.textContent("#song-list")).includes("Library is empty"));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(tmp, "1-empty.png") });

  console.log("guards");
  await page.click(".rm-sec-head:has-text('Add song')");
  await page.click("#song-title-input");
  await page.keyboard.type("vfh");
  await page.keyboard.press("Enter");
  check("typing does not reach the game", (await page.evaluate(() => window.__gameKeys.length)) === 0, await page.evaluate(() => window.__gameKeys));
  await page.fill("#song-title-input", "");
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  check("wheel does not reach the game", (await page.evaluate(() => window.__gameWheel)) === 0);
  check("page scrolls", (await page.evaluate(() => document.querySelector(".lm-page").scrollTop)) > 0);

  console.log("add + play + sync");
  check("title required", await page.evaluate(() => { document.querySelector("#add-song").click(); return document.querySelector("#rm-toast").textContent; }) === "⚠ Title required");
  await page.setInputFiles("#song-file-input", songPath);
  check("title filled from file name", (await page.inputValue("#song-title-input")) === "test song name");
  await page.fill("#song-artist-input", "Tester");
  await page.setInputFiles("#lrc-file-input", lrcPath);
  await page.waitForFunction(() => document.querySelector("#song-lyrics-input").value.length > 0);
  check("lrc line count", (await page.textContent("#lrc-status")) === "5 lines", await page.textContent("#lrc-status"));
  await page.check("#song-autosync");
  await page.click("#add-song");
  await page.waitForFunction(() => window.__player._audio && !window.__player._audio.paused && window.__player._audio.currentTime > 0.2, null, { timeout: 5000 });
  check("song row rendered", (await page.locator(".rm-song-row").count()) === 1);
  check("artist kept", (await page.textContent(".rm-sartist")) === "Tester");
  check("now playing title", (await page.textContent("#music-title")) === "test song name");
  check("chat sync switched on", await page.isChecked("#music-chat-sync"));
  check("art shows playing", await page.locator("#rm-art.playing").count() === 1);
  await page.click(".rm-sec-head:has-text('Chat sync')");
  await page.click("#bm-dbg-toggle");
  await page.evaluate(() => { document.querySelector(".lm-page").scrollTop = 0; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(tmp, "2-playing.png") });
  await page.locator(".rm-sec-head:has-text('Chat sync')").scrollIntoViewIfNeeded();
  await page.evaluate(() => { const p = document.querySelector(".lm-page"); p.scrollTop += 180; });
  await page.screenshot({ path: path.join(tmp, "2-sync.png") });

  await page.waitForFunction(() => window.__player._audio && (window.__player._audio.ended || window.__player._audio.currentTime > 11.6), null, { timeout: 20000 });
  await page.waitForTimeout(2600);
  const sent = await page.evaluate(() => window.__sent.slice());
  console.log("    sent:", JSON.stringify(sent.map(s => s.m + " @" + s.pos.toFixed(2))));
  const msgs = sent.map(s => s.m);
  check("first line sent", msgs[0] === "first line");
  check("first line on time (80ms auto delay)", sent[0] && sent[0].pos >= 0.85 && sent[0].pos <= 1.2, sent[0]);
  check("second line sent", msgs.includes("second line"));
  check("line inside the 1.5s gap is dropped, not bunched", !msgs.includes("too close to the second"));
  check("every message within 30 chars", msgs.every(m => m.length <= 30), msgs);
  check("long line split", msgs.filter(m => /far|too long|chat message/.test(m)).length >= 2, msgs);
  check("multi-timestamp line sent", msgs.includes("twice"));
  check("debug log written", (await page.textContent("#bm-dbg-box")).includes("sent: first line"));

  console.log("controls");
  const before = await page.evaluate(() => window.__sent.length);
  await page.evaluate(() => { window.__inGame = false; });
  await page.evaluate(() => window.__player.play(0));
  await page.waitForTimeout(1600);
  check("nothing sent while out of game", (await page.evaluate(() => window.__sent.length)) === before);
  check("dropped send is logged", (await page.textContent("#bm-dbg-box")).includes("dropped"));
  await page.evaluate(() => { window.__inGame = true; });
  await page.click("#music-play");
  await page.waitForTimeout(150);
  check("pause", await page.evaluate(() => window.__player._audio.paused));
  await page.click("#music-play");
  await page.waitForTimeout(150);
  check("resume", await page.evaluate(() => !window.__player._audio.paused));
  const rail = await page.locator("#music-progress-bar").boundingBox();
  await page.mouse.click(rail.x + rail.width * 0.5, rail.y + rail.height / 2);
  await page.waitForTimeout(150);
  const t = await page.evaluate(() => window.__player._audio.currentTime);
  check("seek to middle", t > 5.5 && t < 7.5, t);
  await page.evaluate(() => { const s = document.querySelector("#music-volume"); s.value = "35"; s.dispatchEvent(new Event("input")); s.dispatchEvent(new Event("change")); });
  check("volume applied", Math.abs(await page.evaluate(() => window.__player._audio.volume) - 0.35) < 0.001);
  check("volume label", (await page.textContent("#music-volume-label")) === "35%");
  await page.click("#music-loop");
  check("loop on", await page.locator("#music-loop.rm-on").count() === 1);
  await page.evaluate(() => { const s = document.querySelector("#music-sync-delay"); s.value = "500"; s.dispatchEvent(new Event("input")); s.dispatchEvent(new Event("change")); });
  check("delay label", (await page.textContent("#bm-manual-delay-row .slider-value")) === "500ms");
  check("auto delay badge shows ping", (await page.textContent("#bm-auto-delay-badge")) === "80ms");

  console.log("library");
  await page.click("#rm-like-now");
  check("liked from now playing", await page.locator(".rm-s-like.on").count() === 1);
  await page.click("#rm-save-now");
  check("save-now lights up", await page.locator("#rm-save-now.on").count() === 1);
  await page.click('.rm-filter-btn[data-filter="__liked"]');
  check("liked filter lists it", await page.locator(".rm-song-row").count() === 1);
  await page.click('.rm-filter-btn[data-filter="__saved"]');
  check("saved filter lists it", await page.locator(".rm-song-row").count() === 1);
  await page.locator(".rm-s-save").click();
  check("unsaved leaves saved filter empty", (await page.textContent("#song-list")).includes("No saved songs yet"));
  await page.click('.rm-filter-btn[data-filter=""]');

  await page.fill("#song-lyrics-input", "");
  await page.click("#save-song-btn");
  check("empty lyrics refused", (await page.textContent("#rm-toast")) === "⚠ The lyrics box is empty");
  await page.fill("#song-lyrics-input", "[00:02.00]replaced");
  await page.click("#save-song-btn");
  check("lyrics saved", await page.evaluate(() => window.__player._songs[0].lyrics === "[00:02.00]replaced"));

  const sentBefore = await page.evaluate(() => window.__sent.length);
  await page.click("#bm-send-all-lyrics");
  await page.waitForTimeout(300);
  check("send all lyrics sends first", (await page.evaluate(() => window.__sent.slice(-1)[0].m)) === "replaced");
  await page.waitForTimeout(1500);
  check("send all lyrics finishes", (await page.textContent("#bm-send-all-lyrics")).includes("OFF"));
  check("send all lyrics sent once", (await page.evaluate(() => window.__sent.length)) - sentBefore >= 1);

  await page.click("#bm-test-chat");
  check("test chat status", (await page.textContent("#bm-test-chat-status")) === "sock:OPEN enc:true inGame:true");
  check("test chat sent", (await page.evaluate(() => window.__sent.slice(-1)[0].m)) === "🎵 Luna music sync test");

  console.log("backup");
  await page.click(".rm-sec-head:has-text('Backup')");
  const [ download ] = await Promise.all([ page.waitForEvent("download"), page.click("#music-export-btn") ]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  check("export holds the song", exported.songs.length === 1 && exported.songs[0].title === "test song name");
  const ryn = path.join(tmp, "ryn_music_backup.json");
  fs.writeFileSync(ryn, JSON.stringify({
    songs: [
      { title: "From Ryn", artist: "<b>x</b>", url: "data:audio/wav;base64,AAAA", album: "Old", lyrics: "" },
      exported.songs[0],
      { title: "", url: "nope" }
    ],
    albums: [ "Old" ]
  }));
  await page.setInputFiles("#music-import-file", ryn);
  await page.waitForFunction(() => document.querySelector("#music-backup-status").textContent.includes("Imported"));
  check("import adds only the new valid song", (await page.textContent("#music-backup-status")) === "✓ Imported 1 songs!");
  check("imported song has no album", await page.evaluate(() => !("album" in window.__player._songs[1])));
  check("artist rendered as text", (await page.locator(".rm-sartist").nth(1).textContent()) === "<b>x</b>");

  console.log("persistence");
  await page.waitForTimeout(400);
  await page.reload();
  await page.click('.nav-item[data-tab="music"]');
  await page.waitForFunction(() => document.querySelectorAll(".rm-song-row").length === 2, null, { timeout: 5000 }).catch(() => {});
  check("library survives reload", await page.locator(".rm-song-row").count() === 2);
  check("liked survives reload", await page.locator(".rm-s-like.on").count() === 1);
  check("volume survives reload", (await page.inputValue("#music-volume")) === "35");
  check("loop survives reload", await page.locator("#music-loop.rm-on").count() === 1);
  check("delay survives reload", (await page.inputValue("#music-sync-delay")) === "500");
  check("chat sync starts off", !(await page.isChecked("#music-chat-sync")));

  console.log("delete + tabs");
  await page.evaluate(() => window.__player.play(0));
  await page.waitForTimeout(200);
  await page.locator(".rm-song-row").first().hover();
  await page.locator(".rm-sdel").first().click();
  check("deleting the playing song stops it", await page.evaluate(() => window.__player._audio === null && window.__player._currentIndex === -1));
  check("one song left", await page.locator(".rm-song-row").count() === 1);
  check("now playing cleared", (await page.textContent("#music-title")) === "No song selected");
  await page.click('.nav-item[data-tab="combat"]');
  check("other tab hides music", !(await page.locator(".lm-page").isVisible()) && await page.locator(".deltek-content").isVisible());
  await page.click('.nav-item[data-tab="music"]');
  await page.fill(".search-input", "shame");
  check("search shows results over music", await page.locator(".deltek-content .feature-row").count() > 0 && !(await page.locator(".lm-page").isVisible()));
  await page.fill(".search-input", "");
  check("clearing search returns to music", await page.locator(".lm-page").isVisible());
  await page.evaluate(() => document.querySelector(".deltek-root").classList.add("t-ice"));
  await page.evaluate(() => window.__player.play(0));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(tmp, "3-theme.png") });
  check("unloadable song reports the error", await page.evaluate(() => window.__player._dbgLines.some(l => l.includes("could not load: From Ryn"))));
  check("unloadable song shows as paused", await page.locator("#rm-art.playing").count() === 0 && (await page.innerHTML("#music-play")) === "▶");

  check("no page errors", errors.length === 0, errors);

  await lrcAiPhase(browser, url, tmp, songPath);

  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed — screenshots in ${tmp}`);
  process.exit(failed ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
