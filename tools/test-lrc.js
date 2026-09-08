#!/usr/bin/env node
/*
 * test-lrc.js
 *
 * Exercises src/lrc/lrc-ai.js headlessly.
 *
 * The host is not a paraphrase of MusicPlayer: _parseLRC, _reflowLRC,
 * _wrapText, _splitLine, _tickSync and seekTo are extracted verbatim from
 * src/Ryn_Type_2.user.js and run as-is, so the sync assertions below are
 * against the real chat loop rather than a stand-in for it. Only play() is
 * modelled, because the original is mostly HTMLAudioElement I/O; the parts
 * of it the module depends on (session bump, lyric reset, currentIndex) are
 * reproduced exactly and asserted against the source.
 *
 *   node tools/test-lrc.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const BASE = fs.readFileSync(path.join(ROOT, "src/Ryn_Type_2.user.js"), "utf8");
const MODULE = fs.readFileSync(path.join(ROOT, "src/lrc/lrc-ai.js"), "utf8");

let passed = 0;
const failures = [];

/* Nothing this module does may escape as an unhandled rejection: in a
 * userscript that is a console full of noise at best, and a dead menu at
 * worst. Any that appear are reported as failures. */
const rejections = [];
process.on("unhandledRejection", r => rejections.push(String(r && r.stack || r)));

function ok(name, cond, detail) {
  if (cond) { passed++; return; }
  failures.push(name + (detail ? "\n      " + detail : ""));
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  ok(name, a === e, "expected " + e + "\n      actual   " + a);
}

/* ------------------------------------------------------------------ *
 * Extract real MusicPlayer methods from the base client
 * ------------------------------------------------------------------ */

function extractMethod(name) {
  const needle = "\n    " + name + "(";
  const start = BASE.indexOf(needle);
  if (start === -1) throw new Error("method not found in base client: " + name);
  const open = BASE.indexOf("{", BASE.indexOf(")", start));
  let depth = 0, i = open;
  for (; i < BASE.length; i++) {
    const c = BASE[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return BASE.slice(start + 1, i);
}

const REAL = ["_parseLRC", "_reflowLRC", "_wrapText", "_splitLine", "_tickSync",
              "seekTo", "_sendChat", "_doSendPacket", "_renderSongList"];
/* Spliced into an object literal, so they need separating commas. */
const realSource = REAL.map(extractMethod).join(",\n");

/* ------------------------------------------------------------------ *
 * Minimal DOM — only what the module's UI path touches
 * ------------------------------------------------------------------ */

function makeDom() {
  function El(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this._class = "";
    this._text = "";
    this.style = {};
    this.classList = {
      add: (...c) => { c.forEach(x => { if (!this._cls().includes(x)) this._class += " " + x; }); },
      remove: (...c) => {
        const keep = this._cls().filter(x => !c.includes(x));
        this._class = keep.join(" ");
      },
      contains: c => this._cls().includes(c),
      toggle: (c, on) => { on ? this.classList.add(c) : this.classList.remove(c); }
    };
  }
  El.prototype._cls = function () { return this._class.split(/\s+/).filter(Boolean); };
  Object.defineProperty(El.prototype, "className", {
    get() { return this._class.trim(); },
    set(v) { this._class = String(v); }
  });
  Object.defineProperty(El.prototype, "textContent", {
    get() {
      if (!this.children.length) return this._text;
      return this._text + this.children.map(c => c.textContent).join("");
    },
    set(v) { this._text = String(v); this.children = []; }
  });
  El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
  El.prototype.getAttribute = function (k) { return k in this.attrs ? this.attrs[k] : null; };
  El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); return c; };
  El.prototype.removeChild = function (c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null;
    return c;
  };
  El.prototype.insertBefore = function (c, ref) {
    const i = this.children.indexOf(ref);
    c.parentNode = this;
    this.children.splice(i < 0 ? this.children.length : i, 0, c);
    return c;
  };
  El.prototype._all = function (out) {
    for (const c of this.children) { out.push(c); c._all(out); }
    return out;
  };
  /* Supports: tag, .class, #id, [attr="v"], compounds and one descendant hop. */
  function matchSimple(el, sel) {
    let m;
    const parts = sel.match(/(^[a-zA-Z]+)|(\.[\w-]+)|(#[\w-]+)|(\[[^\]]+\])/g) || [];
    for (const p of parts) {
      if (p[0] === ".") { if (!el._cls().includes(p.slice(1))) return false; }
      else if (p[0] === "#") { if (el.attrs.id !== p.slice(1)) return false; }
      else if (p[0] === "[") {
        m = p.match(/^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
        if (!m) return false;
        if (!(m[1] in el.attrs)) return false;
        if (m[2] !== undefined && el.attrs[m[1]] !== m[2]) return false;
      } else if (el.tagName !== p.toUpperCase()) return false;
    }
    return true;
  }
  El.prototype.querySelectorAll = function (sel) {
    const hops = sel.trim().split(/\s+(?![^\[]*\])/);
    let pool = this._all([]);
    for (let h = 0; h < hops.length; h++) {
      const next = [];
      for (const el of pool) if (matchSimple(el, hops[h])) next.push(el);
      if (h === hops.length - 1) return next;
      pool = next.reduce((acc, el) => acc.concat(el._all([])), []);
    }
    return pool;
  };
  El.prototype.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };

  const doc = new El("document");
  doc.head = doc.appendChild(new El("head"));
  doc.body = doc.appendChild(new El("body"));
  doc.createElement = t => new El(t);
  doc.getElementById = id => doc.querySelector("#" + id);
  doc.documentElement = doc.body;
  return doc;
}

/* Build the row markup the player's _renderSongList produces. */
function buildRow(doc, index, song) {
  const row = doc.createElement("div");
  row.className = "rm-song-row";
  const num = doc.createElement("span"); num.className = "rm-snum"; num.textContent = String(index + 1);
  const title = doc.createElement("span"); title.className = "rm-stitle"; title.textContent = song.title;
  const artist = doc.createElement("span"); artist.className = "rm-sartist"; artist.textContent = song.artist || "";
  const icons = doc.createElement("span"); icons.className = "rm-s-icons";
  for (const c of ["rm-s-like", "rm-s-save", "rm-sdel"]) {
    const s = doc.createElement("span"); s.className = c; icons.appendChild(s);
  }
  row.appendChild(num); row.appendChild(title); row.appendChild(artist); row.appendChild(icons);
  return row;
}

/* ------------------------------------------------------------------ *
 * In-memory IndexedDB, localStorage, Audio, fetch
 * ------------------------------------------------------------------ */

function makeIndexedDB() {
  const dbs = {};
  function req(run) {
    const r = { onsuccess: null, onerror: null, onupgradeneeded: null, result: undefined };
    setImmediate(() => {
      try { run(r); } catch (e) { r.onerror && r.onerror({ target: { error: e } }); }
    });
    return r;
  }
  return {
    open(name, version) {
      return req(r => {
        if (!dbs[name]) dbs[name] = { name, version, stores: {}, objectStoreNames: { contains: () => false } };
        const db = dbs[name];
        const api = {
          objectStoreNames: { contains: n => n in db.stores },
          createObjectStore(n) { db.stores[n] = new Map(); return {}; },
          close() {},
          transaction(store) {
            const tx = { oncomplete: null, onerror: null };
            const os = {
              get(k) {
                const gr = { onsuccess: null, onerror: null };
                setImmediate(() => gr.onsuccess && gr.onsuccess({ target: { result: db.stores[store].get(k) } }));
                return gr;
              },
              put(v, k) { db.stores[store].set(k, v); setImmediate(() => tx.oncomplete && tx.oncomplete()); },
              delete(k) { db.stores[store].delete(k); setImmediate(() => tx.oncomplete && tx.oncomplete()); },
              openCursor() {
                const cr = { onsuccess: null, onerror: null };
                const entries = [...db.stores[store].entries()];
                let i = 0;
                const step = () => setImmediate(() => {
                  if (i >= entries.length) { cr.onsuccess && cr.onsuccess({ target: { result: null } }); return; }
                  const [k, v] = entries[i++];
                  cr.onsuccess && cr.onsuccess({ target: { result: { value: v, key: k, continue: step } } });
                });
                step();
                return cr;
              }
            };
            tx.objectStore = () => os;
            return tx;
          }
        };
        if (r.onupgradeneeded) r.onupgradeneeded({ target: { result: api } });
        r.onsuccess && r.onsuccess({ target: { result: api } });
      });
    },
    _dbs: dbs
  };
}

function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m
  };
}

/* ------------------------------------------------------------------ *
 * The sandbox
 * ------------------------------------------------------------------ */

function makeHost(opts) {
  opts = opts || {};
  const doc = makeDom();
  const songList = doc.createElement("div");
  songList.setAttribute("id", "song-list");
  doc.body.appendChild(songList);

  const net = { calls: [] };
  const sent = [];

  /* The player spaces chat chunks 2200 ms apart through setTimeout, so a
   * sweep of ticks emits nothing until those fire. Time is compressed 100x
   * inside the sandbox: ordering and the _songSessionId guards behave
   * exactly as they do live, the test just does not wait minutes for them. */
  const TIME_SCALE = 100;
  const scaled = (fn, ms) => setTimeout(fn, Math.ceil((ms || 0) / TIME_SCALE));

  const sandbox = {
    console: { warn() {}, error() {}, log() {} },
    setTimeout: scaled, clearTimeout, setInterval, clearInterval, setImmediate,
    Promise, Map, Set, Date, Math, JSON, String, Number, Array, Object,
    isFinite, parseInt, parseFloat, encodeURIComponent, RegExp, Error,
    URLSearchParams: require("url").URLSearchParams,
    atob: (x) => Buffer.from(x, "base64").toString("binary"),
    TextEncoder: require("util").TextEncoder,
    TextDecoder: require("util").TextDecoder,
    crypto: require("crypto").webcrypto,
    AbortController,
    indexedDB: makeIndexedDB(),
    localStorage: makeLocalStorage(),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    Audio: function () {
      this.preload = ""; this.muted = false; this.crossOrigin = null;
      this.duration = opts.duration || 0;
      Object.defineProperty(this, "src", {
        set(v) { setImmediate(() => this.onloadedmetadata && this.onloadedmetadata()); },
        get() { return ""; }
      });
      this.removeAttribute = () => {}; this.load = () => {};
    },
    fetch: async function (url) {
      net.calls.push(String(url));
      const r = opts.route ? opts.route(String(url)) : null;
      if (!r) return { ok: false, status: 404, json: async () => null };
      return { ok: true, status: 200, json: async () => r };
    },
    client: {
      SocketManager: { socket: { readyState: 1, OPEN: 1 } },
      PacketManager: { Encoder: {}, chat: t => sent.push(t) },
      myPlayer: { inGame: true },
      clients: []
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  /* The host object: real methods where they exist, a faithful play(). */
  const hostSrc = `
    const MusicPlayer = {
      _songs: [], _albums: [], _currentIndex: -1,
      _loop: false, _shuffle: false,
      _chatSync: true, _mixedSync: false, _botsOnlySync: false, _unifiedSync: false,
      _syncBot: false, _syncDelay: 0, _mixedTurn: 0, _volume: 0.7,
      _frameDoc: null, _audio: null,
      _lyrics: [], _lyricIndex: -1, _lastSentWall: 0, _songSessionId: 0,
      _rafId: null, _MIN_GAP_MS: 1500,
      _save() { this.__saves = (this.__saves || 0) + 1; },
      _toast(m) { (this.__toasts = this.__toasts || []).push(m); },
      _startRAF() {}, _stopRAF() {}, _updateUI() {}, _renderAll() {},
      _showStatus() {}, _updateNowPlayingLike() {}, _renderAlbumList() {},
      _updateAlbumSelect() {}, _updateAlbumFilterSelect() {},
      _sendLyricToBots() {}, _sendLyricUnified() {}, _sendLyricToBotsDistributed() {},
      /* modelled from play(): the lyric-state half of the original, verbatim */
      play(index) {
        if (index < 0 || index >= this._songs.length) return;
        this._currentIndex = index;
        const song = this._songs[index];
        this._songSessionId++;
        this._stopRAF();
        this._audio = { currentTime: 0, duration: ${opts.duration || 200}, paused: false };
        this._lyrics = this._parseLRC(song.lyrics || "");
        this._lyricIndex = -1;
        this._lastSentWall = 0;
        this._startRAF();
      },
      ${realSource}
    };
  `;
  vm.runInContext(hostSrc, sandbox);
  vm.runInContext(MODULE, sandbox);

  /* Top-level const in runInContext lands in the context's global lexical
   * scope — shared between scripts, but not a property of the sandbox
   * object — so both bindings are read back by evaluating their names. */
  const mp = vm.runInContext("MusicPlayer", sandbox);
  const lrc = vm.runInContext("RynLRC", sandbox);
  mp._frameDoc = doc;
  return { sandbox, mp, lrc, doc, songList, net, sent, buildRow: (i, s) => buildRow(doc, i, s) };
}

const tick = () => new Promise(r => setImmediate(r));
async function settle(n) { for (let i = 0; i < (n || 40); i++) await tick(); }
/* Real wall-clock wait, for the compressed chat timers to fire. */
const drain = (ms) => new Promise(r => setTimeout(r, ms || 250));

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const JA_LRC = [
  "[ti:Lemon]",
  "[ar:Kenshi Yonezu]",
  "[al:Lemon]",
  "[by:someone]",
  "[length:04:16]",
  "",
  "[00:12.50]君を忘れない",
  "[00:15.20]いつまでも",
  "[00:18.05][00:42.90]夢ならばどれほどよかったでしょう",
  "[00:24.999]<00:24.99>今でも<00:25.50>あなたはわたしの光",
  "[malformed",
  "[00:30.5]",
  "[01:23.45]切り分けた果実の片方の様に"
].join("\r\n");

const EN_LRC = [
  "[00:05.00]I walk this empty road",
  "[00:09.25]and the night is long",
  "[00:14.50]nothing here but the sound of rain",
  "[00:20.00]I will not forget what you said to me"
].join("\n");

/* ------------------------------------------------------------------ *
 * 1. Parser
 * ------------------------------------------------------------------ */
{
  const h = makeHost();
  const P = h.lrc.Parser;
  const r = P.parse(JA_LRC);

  eq("parser: metadata ti", r.meta.ti, "Lemon");
  eq("parser: metadata ar", r.meta.ar, "Kenshi Yonezu");
  eq("parser: metadata length", r.meta.length, "04:16");
  ok("parser: malformed line counted, not thrown", r.malformed === 1, "malformed=" + r.malformed);
  ok("parser: empty timed line skipped", r.emptyTimed === 1, "emptyTimed=" + r.emptyTimed);

  eq("parser: line count (multi-timestamp expands)", r.lines.length, 6);
  eq("parser: first timestamp ms", r.lines[0].ms, 12500);
  eq("parser: first ts string preserved", r.lines[0].ts, "00:12.50");
  eq("parser: 3-digit fraction is milliseconds", r.lines.find(l => l.ts === "00:24.999").ms, 24999);
  eq("parser: enhanced word tags stripped",
     r.lines.find(l => l.ts === "00:24.999").text, "今でも あなたはわたしの光");

  const dup = r.lines.filter(l => l.text === "夢ならばどれほどよかったでしょう");
  eq("parser: multi-timestamp line emitted twice", dup.length, 2);
  eq("parser: both timestamps kept", dup.map(l => l.ts), ["00:18.05", "00:42.90"]);

  const asc = r.lines.every((l, i) => i === 0 || l.ms >= r.lines[i - 1].ms);
  ok("parser: output is sorted", asc);

  /* round trip */
  const out = P.format(r.lines, null);
  const back = P.parse(out);
  eq("parser: round trip keeps every ts string",
     back.lines.map(l => l.ts), r.lines.map(l => l.ts));
  eq("parser: round trip keeps every ms", back.lines.map(l => l.ms), r.lines.map(l => l.ms));

  eq("parser: empty input is empty, not a throw", P.parse("").lines.length, 0);
  eq("parser: garbage input is empty, not a throw", P.parse("hello\nworld\n[[[").lines.length, 0);
  eq("parser: null input is empty, not a throw", P.parse(null).lines.length, 0);
  ok("parser: looksSynced true for LRC", P.looksSynced(EN_LRC));
  ok("parser: looksSynced false for plain", !P.looksSynced("just\nsome\nwords"));

  /* control characters never survive into a chat line */
  const nasty = P.parse("[00:01.00]hi\u0007there\u200Bnow");
  eq("parser: control chars become spaces, zero-width chars vanish",
     nasty.lines[0].text, "hi therenow");
}

/* ------------------------------------------------------------------ *
 * 2. Language detection
 * ------------------------------------------------------------------ */
{
  const h = makeHost();
  const D = h.lrc.Detector;
  const L = t => D.detect(t.split("\n").map(x => ({ text: x }))).lang;

  eq("detect: japanese", L("君を忘れない\nいつまでも\n夢ならばどれほど"), "ja");
  eq("detect: korean", L("너를 잊지 않아\n언제까지나\n우리 함께"), "ko");
  eq("detect: chinese", L("我不會忘記你\n直到永遠\n這個世界"), "zh");
  eq("detect: arabic", L("لن أنساك أبدا\nإلى الأبد\nيا حبيبي"), "ar");
  eq("detect: russian", L("Я не забуду тебя\nнавсегда\nмоя любовь"), "ru");
  eq("detect: hindi", L("मैं तुम्हें नहीं भूलूंगा\nहमेशा के लिए"), "hi");
  eq("detect: english",
     L("I will not forget you\nand the night is long\nnothing here but the sound"), "en");
  eq("detect: spanish",
     L("no te olvidaré nunca\ncuando todo el corazón\npara siempre más amor"), "es");
}

/* ------------------------------------------------------------------ *
 * 3. Validator
 * ------------------------------------------------------------------ */
{
  const h = makeHost();
  const V = h.lrc.Validator;
  const P = h.lrc.Parser;

  ok("validate: empty rejected", !V.validateParsed({ lines: [] }).ok);
  ok("validate: two lines rejected", !V.validateParsed(P.parse("[00:01.00]a\n[00:02.00]b")).ok);

  /* EN_LRC runs to 0:20, so it is a plausible lyric for a 1-minute track. */
  const good = P.parse(EN_LRC);
  const goodRes = V.validateParsed(good, { durationSec: 60 });
  ok("validate: good LRC accepted", goodRes.ok, goodRes.reason);
  eq("validate: stats count events", goodRes.stats.events, 4);

  const overrun = P.parse(EN_LRC.replace("[00:20.00]", "[09:20.00]"));
  const past = V.validateParsed(overrun, { durationSec: 60 });
  ok("validate: lyrics past the end rejected", !past.ok, past.reason);
  ok("validate: rejection says why", /past the end/.test(past.reason), past.reason);

  const short = V.validateParsed(good, { durationSec: 600 });
  ok("validate: lyrics covering a fraction rejected", !short.ok, short.reason);

  /* translation must not change the event list */
  const t1 = good.lines.map(l => ({ ms: l.ms, ts: l.ts, text: "x" }));
  ok("validate: matching translation accepted", V.validateTranslation(good.lines, t1).ok);
  ok("validate: dropped line rejected", !V.validateTranslation(good.lines, t1.slice(1)).ok);
  const t2 = t1.map(l => ({ ...l }));
  t2[1].ms += 10;
  ok("validate: shifted timestamp rejected", !V.validateTranslation(good.lines, t2).ok);
  const t3 = t1.map(l => ({ ...l }));
  t3[2].text = "";
  ok("validate: empty translated line rejected", !V.validateTranslation(good.lines, t3).ok);
}

/* ------------------------------------------------------------------ *
 * 4. Binary search
 * ------------------------------------------------------------------ */
{
  const h = makeHost();
  const S = h.lrc.Sync;
  const list = [];
  for (let i = 0; i < 500; i++) list.push({ ms: i * 137, text: "l" + i });
  const linear = ms => { let a = -1; for (let i = 0; i < list.length; i++) if (list[i].ms <= ms) a = i; else break; return a; };
  let same = true;
  for (let ms = -500; ms < 500 * 137 + 500; ms += 61) if (S.indexAt(list, ms) !== linear(ms)) same = false;
  ok("sync: binary search matches a linear scan at every position", same);
  eq("sync: before the first line", S.indexAt(list, -1), -1);
  eq("sync: empty list", S.indexAt([], 1000), -1);
}

/* ------------------------------------------------------------------ *
 * 5. End-to-end: prepare a Japanese song
 * ------------------------------------------------------------------ */

const TRANSLATIONS = {
  "君を忘れない": "I won't forget you",
  "いつまでも": "Forever",
  "夢ならばどれほどよかったでしょう": "If it were a dream how good that would have been",
  "今でも あなたはわたしの光": "Even now you are my light",
  "切り分けた果実の片方の様に": "Like one half of a fruit cut in two"
};

function route(url) {
  if (url.indexOf("lrclib.net/api/get?") === 0 || url.indexOf("https://lrclib.net/api/get?") === 0) {
    return { id: 4242, trackName: "Lemon", artistName: "Kenshi Yonezu", duration: 200,
             syncedLyrics: JA_LRC, plainLyrics: "..." };
  }
  if (url.indexOf("https://lrclib.net/api/search") === 0) {
    return [ { id: 4242, trackName: "Lemon", artistName: "Kenshi Yonezu", duration: 200,
               syncedLyrics: JA_LRC, plainLyrics: "..." } ];
  }
  if (url.indexOf("https://translate.googleapis.com/") === 0) {
    const q = decodeURIComponent(url.split("&q=")[1] || "");
    const t = TRANSLATIONS[q];
    if (!t) return null;
    return [ [ [ t, q, null, null, 10 ] ], null, "ja" ];
  }
  return null;
}

let e2e;
async function testPrepare() {
  const h = makeHost({ duration: 200, route });
  e2e = h;
  const mp = h.mp;
  mp._songs.push({ title: "Lemon", artist: "Kenshi Yonezu", url: "data:audio/mp3;base64,AAAA", lyrics: "" });
  h.songList.appendChild(h.buildRow(0, mp._songs[0]));
  h.lrc.UI.decorateRows();
  await settle();

  const btn = h.doc.querySelector("#song-list .rm-lrc-btn");
  ok("ui: a button is added to the row", !!btn);
  eq("ui: idle label", btn && btn.textContent, "LRC AI");

  await h.lrc.Manager.prepare(0, {});
  await settle(80);

  const meta = h.lrc.Cache.getMetaSync(mp._songs[0].lrcId);
  ok("prepare: metadata written", !!meta);
  eq("prepare: status ready", meta && meta.status, "ready");
  eq("prepare: source language detected", meta && meta.language, "ja");
  eq("prepare: target language", meta && meta.translation, "en");
  eq("prepare: line count", meta && meta.lineCount, 6);
  eq("prepare: offset starts at zero", meta && meta.offsetMs, 0);
  eq("prepare: provider recorded", meta && meta.provider, "gtx");
  ok("prepare: source recorded", meta && meta.source === "lrclib" && meta.sourceId === "4242");
  ok("prepare: songId is a content hash, not the filename",
     meta && /^[0-9a-f]{32}$/.test(meta.songId), meta && meta.songId);

  eq("ui: button reads ready", btn && btn.textContent, "✓ LRC");
  ok("ui: ready styling", btn && btn.classList.contains("is-ready"));

  const rec = await h.lrc.Cache.getLrc(meta.songId);
  ok("prepare: original.lrc cached", !!(rec && rec.originalLrc));
  ok("prepare: english.lrc cached", !!(rec && rec.englishLrc));

  /* The core promise: same timestamps, different words. */
  const P = h.lrc.Parser;
  const orig = P.parse(rec.originalLrc).lines;
  const eng = P.parse(rec.englishLrc).lines;
  eq("translate: same number of lyric events", eng.length, orig.length);
  eq("translate: every timestamp string is byte-identical",
     eng.map(l => l.ts), orig.map(l => l.ts));
  eq("translate: every timestamp in ms is identical",
     eng.map(l => l.ms), orig.map(l => l.ms));
  eq("translate: 00:12.50 line", eng[0].ts + " -> " + eng[0].text, "00:12.50 -> I won't forget you");
  eq("translate: 00:15.20 line", eng[1].ts + " -> " + eng[1].text, "00:15.20 -> Forever");
  ok("translate: no japanese survives in english.lrc",
     !/[぀-ゟ゠-ヿ一-鿿]/.test(rec.englishLrc), rec.englishLrc);
  ok("translate: repeated line translated once, reused twice",
     eng.filter(l => l.text === TRANSLATIONS["夢ならばどれほどよかったでしょう"]).length === 2);

  const gtx = h.net.calls.filter(u => u.indexOf("translate.googleapis") >= 0).length;
  eq("translate: one request per unique line, not per event", gtx, 5);

  /* Second prepare must not touch the network at all. */
  const before = h.net.calls.length;
  await h.lrc.Manager.prepare(0, {});
  await settle(40);
  eq("cache: a second prepare makes zero requests", h.net.calls.length - before, 0);
}

/* ------------------------------------------------------------------ *
 * 6. Playback, offset, seek, song change — through the real _tickSync
 * ------------------------------------------------------------------ */

async function testPlayback() {
  const h = e2e;
  const mp = h.mp;

  const netBefore = h.net.calls.length;
  mp.play(0);
  await settle(60);
  eq("playback: playing makes zero requests", h.net.calls.length - netBefore, 0);

  ok("playback: cached English lyrics auto-activated", mp._lyrics.length > 0);
  const active = h.lrc.Sync.active;
  ok("playback: sync session bound to this song", !!active && active.songIndex === 0);
  ok("playback: timeline is numeric, not text",
     mp._lyrics.every(l => typeof l.ms === "number" && typeof l.text === "string"));

  /* Drive the player's own tick loop across the song, then let the chunk
   * timers it queued actually fire before reading what reached chat. */
  const captured = [];
  h.sandbox.client.PacketManager.chat = t => captured.push(t);
  async function run(fromSec, toSec, stepSec) {
    captured.length = 0;
    for (let t = fromSec; t <= toSec; t += (stepSec || 0.25)) {
      mp._audio.currentTime = t;
      mp._lastSentWall = 0;             /* skip the 1.5s wall-clock throttle */
      mp._tickSync();
    }
    await drain(180);
    return captured.slice();
  }

  const emitted = await run(0, 90);
  ok("playback: lyrics reached chat", emitted.length > 0);
  ok("playback: first line is the 12.50s line",
     emitted[0] === "I won't forget you", emitted[0]);
  ok("playback: second line is the 15.20s line",
     emitted[1] === "Forever", emitted[1]);
  /* The whole song, exactly: each timestamp fires once and in order, the
   * line carried at both 00:18.05 and 00:42.90 fires at both, and lines
   * over the 30-char chat cap arrive as the player's own reflowed chunks. */
  eq("playback: the exact sequence sent for the whole song", emitted, [
    "I won't forget you",                 /* 00:12.50 */
    "Forever",                            /* 00:15.20 */
    "If it were a dream how",             /* 00:18.05, reflowed */
    "good that would have been",
    "Even now you are my light",          /* 00:24.999 */
    "If it were a dream how",             /* 00:42.90, the same line again */
    "good that would have been",
    "Like one half of a",                 /* 01:23.45, reflowed */
    "fruit cut in two"
  ]);
  ok("playback: every chunk fits the 30-char chat cap",
     emitted.every(t => t.length <= 30), JSON.stringify(emitted.filter(t => t.length > 30)));

  /* Seek forward: continue from the right place, replay nothing. */
  mp.play(0);
  await settle(40);
  await run(0, 20);
  const beforeSeek = mp._lyricIndex;
  mp._audio.currentTime = 20;
  mp.seekTo(80 / 200);                       /* jump to 1:20 */
  ok("seek: index moved forward", mp._lyricIndex > beforeSeek);
  const afterSeek = await run(80, 95);
  ok("seek: no earlier line replayed",
     !afterSeek.includes("I won't forget you") && !afterSeek.includes("Forever"),
     JSON.stringify(afterSeek));

  /* Seek backward: resume from there, and cancel stale queued chunks. */
  const sessionBefore = mp._songSessionId;
  mp._audio.currentTime = 90;
  mp.seekTo(10 / 200);                       /* back to 0:10 */
  ok("seek: a big jump bumps the play session so queued chunks are dropped",
     mp._songSessionId > sessionBefore);
  eq("seek: index re-seated before the first line", mp._lyricIndex, -1);
  const afterBack = await run(10, 20);
  ok("seek: playing forward again from 0:10 resends from there",
     afterBack[0] === "I won't forget you", JSON.stringify(afterBack));

  /* Offset: shifts the runtime timeline, never the cached file. */
  const songId = mp._songs[0].lrcId;
  const recBefore = await h.lrc.Cache.getLrc(songId);
  const firstBefore = mp._lyrics[0].ms;
  await h.lrc.Manager.setOffset(mp._songs[0], 300);
  await settle(40);
  eq("offset: +300 pushes every event 300ms later", mp._lyrics[0].ms, firstBefore + 300);
  const recAfter = await h.lrc.Cache.getLrc(songId);
  eq("offset: cached english.lrc is untouched", recAfter.englishLrc, recBefore.englishLrc);
  eq("offset: stored separately in metadata",
     h.lrc.Cache.getMetaSync(songId).offsetMs, 300);
  await h.lrc.Manager.setOffset(mp._songs[0], 0);
  await settle(20);

  /* Song change: song A's lines must not survive into song B. */
  mp._songs.push({ title: "Nothing Cached", artist: "", url: "data:audio/mp3;base64,BBBB", lyrics: "" });
  mp.play(1);
  await settle(60);
  eq("song change: previous sync session dropped", h.lrc.Sync.active, null);
  eq("song change: no lyrics carried over", mp._lyrics.length, 0);
  const bEmit = await run(0, 60);
  eq("song change: nothing from song A is sent while song B plays", bEmit.length, 0);

  /* Back to A: the cache is reused, still no network. */
  const netB = h.net.calls.length;
  mp.play(0);
  await settle(60);
  eq("replay: still zero requests", h.net.calls.length - netB, 0);
  ok("replay: timeline restored from cache", mp._lyrics.length > 0);
}

/* ------------------------------------------------------------------ *
 * 7. Failure paths — none of them may throw
 * ------------------------------------------------------------------ */

async function testFailures() {
  /* No lyrics anywhere. */
  {
    const h = makeHost({ duration: 200, route: () => null });
    h.mp._songs.push({ title: "Unknown Song", artist: "Nobody", url: "data:audio/mp3;base64,CCCC", lyrics: "" });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(60);
    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("fail: no lyrics -> status none", meta && meta.status, "none");
    const btn = h.doc.querySelector("#song-list .rm-lrc-btn");
    eq("fail: button offers a retry", btn && btn.textContent, "Retry LRC");

    const calls = h.net.calls.length;
    h.mp.play(0);
    await settle(40);
    eq("fail: playing a failed song makes no requests", h.net.calls.length - calls, 0);
    eq("fail: no lyrics loaded", h.mp._lyrics.length, 0);

    /* And it does not retry by itself. */
    const before = h.net.calls.length;
    await h.lrc.Manager.prepare(0, {});
    await settle(30);
    eq("fail: a cached failure is not re-fetched without force", h.net.calls.length - before, 0);
    await h.lrc.Manager.prepare(0, { force: true });
    await settle(60);
    ok("fail: retry does re-fetch", h.net.calls.length > before);
  }

  /* Plain lyrics only: recorded, never faked into a timeline. */
  {
    const h = makeHost({
      duration: 200,
      route: u => u.indexOf("https://lrclib.net/api/") === 0
        ? [ { id: 7, trackName: "Plain", artistName: "Someone", duration: 200,
              syncedLyrics: "", plainLyrics: "line one\nline two\nline three" } ]
        : null
    });
    h.mp._songs.push({ title: "Plain", artist: "Someone", url: "data:audio/mp3;base64,DDDD", lyrics: "" });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(60);
    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("plain: status plain", meta && meta.status, "plain");
    eq("plain: button says sync is unavailable",
       h.doc.querySelector("#song-list .rm-lrc-btn").textContent, "LRC: no sync");
    h.mp.play(0);
    await settle(40);
    eq("plain: never activated as a timeline", h.lrc.Sync.active, null);
    eq("plain: nothing loaded for chat", h.mp._lyrics.length, 0);
  }

  /* Lyrics that belong to a different release are rejected. */
  {
    const h = makeHost({
      duration: 30,                                    /* 30s of audio ... */
      route: u => u.indexOf("https://lrclib.net/api/") === 0
        ? [ { id: 9, trackName: "Mismatch", artistName: "X", duration: 30,
              syncedLyrics: EN_LRC.replace("[00:20.00]", "[09:20.00]"), plainLyrics: "" } ]
        : null
    });
    h.mp._songs.push({ title: "Mismatch", artist: "X", url: "data:audio/mp3;base64,EEEE", lyrics: "" });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(60);
    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("mismatch: rejected as an error", meta && meta.status, "error");
    ok("mismatch: reason recorded", /past the end/.test(meta.note), meta.note);
  }

  /* Translation unreachable: the song is not marked ready on English-less data. */
  {
    const h = makeHost({
      duration: 200,
      route: u => u.indexOf("https://lrclib.net/api/") === 0
        ? [ { id: 11, trackName: "Lemon", artistName: "Kenshi Yonezu", duration: 200,
              syncedLyrics: JA_LRC, plainLyrics: "" } ]
        : null      /* every translation provider fails */
    });
    h.mp._songs.push({ title: "Lemon", artist: "Kenshi Yonezu", url: "data:audio/mp3;base64,FFFF", lyrics: "" });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(80);
    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("no translator: not marked ready", meta && meta.status, "error");
    ok("no translator: reason recorded", /translation/i.test(meta.note), meta.note);
  }

  /* English lyrics are never sent to a translator. */
  {
    const h = makeHost({
      duration: 60,
      route: u => u.indexOf("https://lrclib.net/api/") === 0
        ? [ { id: 13, trackName: "Empty Road", artistName: "Someone", duration: 60,
              syncedLyrics: EN_LRC, plainLyrics: "" } ]
        : null
    });
    h.mp._songs.push({ title: "Empty Road", artist: "Someone", url: "data:audio/mp3;base64,GGGG", lyrics: "" });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(60);
    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("english: status ready", meta && meta.status, "ready");
    eq("english: detected as english", meta && meta.language, "en");
    eq("english: no translation provider used", meta && meta.provider, "");
    eq("english: zero translation requests",
       h.net.calls.filter(u => u.indexOf("translate") >= 0 || u.indexOf("lingva") >= 0).length, 0);
  }

  /* Two different files with the same title must not share a cache entry. */
  {
    const h = makeHost({ duration: 200, route });
    h.mp._songs.push({ title: "Lemon", artist: "Kenshi Yonezu", url: "data:audio/mp3;base64,AAAA", lyrics: "" });
    h.mp._songs.push({ title: "Lemon", artist: "Kenshi Yonezu", url: "data:audio/mp3;base64,ZZZZZZZZ", lyrics: "" });
    const a = await h.lrc.Identifier.identify(h.mp._songs[0], {});
    const b = await h.lrc.Identifier.identify(h.mp._songs[1], {});
    ok("identity: same title and artist, different audio -> different ids",
       a.songId !== b.songId, a.songId + " vs " + b.songId);
    const again = await h.lrc.Identifier.identify(h.mp._songs[0], {});
    eq("identity: stable across calls", again.songId, a.songId);
  }

  /* Corrupt cache must not take playback down. */
  {
    const h = makeHost({ duration: 200, route });
    h.mp._songs.push({ title: "Lemon", artist: "Kenshi Yonezu", url: "data:audio/mp3;base64,AAAA", lyrics: "" });
    const id = await h.lrc.Identifier.identify(h.mp._songs[0], {});
    await h.lrc.Cache.put(id.songId,
      { songId: id.songId, version: 1, status: "ready", lineCount: 3, durationSec: 200, offsetMs: 0 },
      { songId: id.songId, originalLrc: "\u0000garbage", englishLrc: "not an lrc at all" });
    let threw = false;
    try { h.mp.play(0); await settle(60); } catch (e) { threw = true; }
    ok("corrupt cache: play does not throw", !threw);
    eq("corrupt cache: nothing activated", h.lrc.Sync.active, null);
  }
}

/* ------------------------------------------------------------------ *
 * Build a real ID3-tagged "audio" data URL
 * ------------------------------------------------------------------ */

function id3v2(frames, major, audioBytes) {
  const parts = [];
  for (const [id, enc, text] of frames) {
    let body;
    if (enc === 1) body = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(text, "utf16le")]);
    else if (enc === 3) body = Buffer.from(text, "utf8");
    else body = Buffer.from(text, "latin1");
    /* ID3 text frames are NUL-terminated in the wild — two bytes for the
     * UTF-16 encodings, one for the byte-oriented ones. */
    const term = (enc === 1 || enc === 2) ? Buffer.from([0x00, 0x00]) : Buffer.from([0x00]);
    const data = Buffer.concat([Buffer.from([enc]), body, term]);
    const idLen = major <= 2 ? 3 : 4;
    const head = Buffer.alloc(major <= 2 ? 6 : 10);
    head.write(id.slice(0, idLen), 0, "latin1");
    if (major <= 2) {
      head[3] = (data.length >> 16) & 0xff; head[4] = (data.length >> 8) & 0xff; head[5] = data.length & 0xff;
    } else if (major >= 4) {
      /* syncsafe */
      head[4] = (data.length >> 21) & 0x7f; head[5] = (data.length >> 14) & 0x7f;
      head[6] = (data.length >> 7) & 0x7f;  head[7] = data.length & 0x7f;
    } else {
      head.writeUInt32BE(data.length, 4);
    }
    parts.push(head, data);
  }
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(10);
  header.write("ID3", 0, "latin1");
  header[3] = major; header[4] = 0; header[5] = 0;
  header[6] = (body.length >> 21) & 0x7f; header[7] = (body.length >> 14) & 0x7f;
  header[8] = (body.length >> 7) & 0x7f;  header[9] = body.length & 0x7f;
  return "data:audio/mpeg;base64," +
    Buffer.concat([header, body, audioBytes || Buffer.alloc(2048, 0x55)]).toString("base64");
}

function id3v1(title, artist, album) {
  const pad = (t, n) => {
    const b = Buffer.alloc(n, 0);
    const src = Buffer.isBuffer(t) ? t : Buffer.from(String(t), "latin1");
    src.copy(b, 0, 0, Math.min(n, src.length));
    return b;
  };
  const tag = Buffer.concat([
    Buffer.from("TAG", "latin1"), pad(title, 30), pad(artist, 30), pad(album, 30),
    Buffer.alloc(4, 0x30), Buffer.alloc(30, 0), Buffer.from([0xff])
  ]);
  return "data:audio/mpeg;base64," +
    Buffer.concat([Buffer.alloc(3000, 0x55), tag]).toString("base64");
}

/* ------------------------------------------------------------------ *
 * 6b. Reading the file's own metadata
 * ------------------------------------------------------------------ */

async function testTags() {
  const h = makeHost({ duration: 200, route: () => null });
  const T = h.lrc.Tags;

  const v23 = id3v2([["TIT2", 1, "Lemon"], ["TPE1", 1, "\u7C73\u6D25\u7384\u5E2B"], ["TALB", 1, "Lemon"]], 3);
  eq("id3: v2.3 UTF-16 title", T.read(v23).title, "Lemon");
  eq("id3: v2.3 UTF-16 japanese artist", T.read(v23).artist, "\u7C73\u6D25\u7384\u5E2B");
  eq("id3: v2.3 album", T.read(v23).album, "Lemon");

  const v24 = id3v2([["TIT2", 3, "\u788E\u3051\u3066\u3044\u304F"], ["TPE1", 3, "Aimer"]], 4);
  eq("id3: v2.4 syncsafe + UTF-8 title", T.read(v24).title, "\u788E\u3051\u3066\u3044\u304F");
  eq("id3: v2.4 artist", T.read(v24).artist, "Aimer");

  const v22 = id3v2([["TT2", 0, "Old Tag"], ["TP1", 0, "Someone"]], 2);
  eq("id3: v2.2 three-letter frames", T.read(v22).title, "Old Tag");

  eq("id3: v1 fallback title", T.read(id3v1("Plastic Love", "Mariya", "Album")).title, "Plastic Love");
  eq("id3: v1 fallback artist", T.read(id3v1("Plastic Love", "Mariya", "Album")).artist, "Mariya");
  /* Real Shift-JIS bytes: ID3v1 has no encoding flag, and Japanese taggers
     wrote Shift-JIS into it for years. */
  const sjisRemon = Buffer.from([0x83, 0x8C, 0x83, 0x82, 0x83, 0x93]);          /* レモン */
  const sjisYonezu = Buffer.from([0x95, 0xC4, 0x92, 0xC3, 0x8C, 0xBA, 0x8E, 0x74]); /* 米津玄師 */
  eq("id3: v1 shift-jis title is decoded",
     T.read(id3v1(sjisRemon, sjisYonezu, "")).title, "\u30EC\u30E2\u30F3");
  eq("id3: v1 shift-jis artist is decoded",
     T.read(id3v1(sjisRemon, sjisYonezu, "")).artist, "\u7C73\u6D25\u7384\u5E2B");

  /* Nothing here may throw, whatever it is handed. */
  eq("id3: no tags at all", T.read("data:audio/mpeg;base64," + Buffer.alloc(900, 0x55).toString("base64")).title, "");
  eq("id3: remote url is not a data url", T.read("https://example.com/a.mp3").title, "");
  eq("id3: empty", T.read("").title, "");
  eq("id3: junk base64", T.read("data:audio/mpeg;base64,!!!!not base64!!!!").title, "");
  eq("id3: truncated header", T.read("data:audio/mpeg;base64,SUQz").title, "");
  eq("id3: claims a huge tag", T.read("data:audio/mpeg;base64," +
     Buffer.concat([Buffer.from([0x49,0x44,0x33,3,0,0,0x7f,0x7f,0x7f,0x7f]), Buffer.alloc(200)])
       .toString("base64")).title, "");

  /* And the tags reach the search: the library title is junk, the tags are
   * clean, and only the tag-shaped query matches what the provider has. */
  const seen = [];
  const h2 = makeHost({
    duration: 200,
    route: u => {
      seen.push(u);
      if (u.indexOf("https://lrclib.net/api/") !== 0) return null;
      /* Only answers when asked with the real artist from the tags. */
      if (u.indexOf(encodeURIComponent("\u7C73\u6D25\u7384\u5E2B")) < 0) return [];
      return [ { id: 99, trackName: "Lemon", artistName: "\u7C73\u6D25\u7384\u5E2B",
                 duration: 200, syncedLyrics: EN_LRC.replace("[00:20.00]", "[02:20.00]"),
                 plainLyrics: "" } ];
    }
  });
  h2.mp._songs.push({
    title: "\u3010MV\u3011Lemon\uFF0F\u7C73\u6D25\u7384\u5E2B (Official Video) [4K]",
    artist: "", url: v23, lyrics: ""
  });
  h2.songList.appendChild(h2.buildRow(0, h2.mp._songs[0]));
  h2.lrc.UI.decorateRows();
  await h2.lrc.Manager.prepare(0, {});
  await settle(80);
  const meta = h2.lrc.Cache.getMetaSync(h2.mp._songs[0].lrcId);
  eq("id3: a junk filename still finds the song via its tags", meta && meta.status, "ready");
  eq("id3: matched the right artist", meta && meta.matchedArtist, "\u7C73\u6D25\u7384\u5E2B");
  ok("id3: tags cached on the song, not re-parsed",
     h2.mp._songs[0].lrcTags && h2.mp._songs[0].lrcTags.title === "Lemon");
}

/* ------------------------------------------------------------------ *
 * 6c. More providers behind LRCLIB
 * ------------------------------------------------------------------ */

async function testProviders() {
  eq("providers: order is lrclib, netease, textyl",
     makeHost({}).lrc.Fetcher.providers.map(p => p.id), ["lrclib", "netease", "textyl"]);

  /* LRCLIB empty -> NetEase answers. */
  {
    const h = makeHost({
      duration: 200,
      route: u => {
        if (u.indexOf("https://lrclib.net/") === 0) return [];
        if (u.indexOf("https://music.163.com/api/search") === 0) {
          return { code: 200, result: { songs: [ { id: 5, name: "Lemon",
                   artists: [ { name: "Kenshi Yonezu" } ], duration: 200000 } ] } };
        }
        if (u.indexOf("https://music.163.com/api/song/lyric") === 0) {
          return { lrc: { lyric: JA_LRC }, tlyric: { lyric: "[00:12.50]\u4E0D\u4F1A\u5FD8\u8BB0\u4F60" } };
        }
        return route(u);
      }
    });
    h.mp._songs.push({ title: "Lemon", artist: "Kenshi Yonezu", url: "data:audio/mp3;base64,NNN1", lyrics: "" });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(90);
    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("netease: used when lrclib has nothing", meta && meta.source, "netease");
    eq("netease: ready", meta && meta.status, "ready");
    eq("netease: song id recorded", meta && meta.sourceId, "5");
    const rec = await h.lrc.Cache.getLrc(meta.songId);
    ok("netease: original translated to english, not to chinese",
       rec.englishLrc.indexOf("I won't forget you") >= 0 &&
       !/[\u4E00-\u9FFF]/.test(rec.englishLrc), rec.englishLrc.slice(0, 120));
  }

  /* LRCLIB and NetEase empty -> Textyl's second-resolution timings. */
  {
    const h = makeHost({
      duration: 200,
      route: u => {
        if (u.indexOf("https://api.textyl.co/") === 0) {
          return [ { seconds: 5, lyrics: "I walk this empty road" },
                   { seconds: 9, lyrics: "and the night is long" },
                   { seconds: 14, lyrics: "nothing here but rain" },
                   { seconds: 62, lyrics: "the morning comes again" },
                   { seconds: 118, lyrics: "and I am still here waiting" },
                   { seconds: 170, lyrics: "I will not forget you" } ];
        }
        return null;
      }
    });
    h.mp._songs.push({ title: "Empty Road", artist: "Someone", url: "data:audio/mp3;base64,TTT1", lyrics: "" });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(90);
    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("textyl: used as the last provider", meta && meta.source, "textyl");
    eq("textyl: ready", meta && meta.status, "ready");
    const rec = await h.lrc.Cache.getLrc(meta.songId);
    const lines = h.lrc.Parser.parse(rec.englishLrc).lines;
    eq("textyl: seconds converted to timestamps", lines[0].ts, "00:05.00");
    eq("textyl: english is not re-translated", meta && meta.provider, "");
  }

  /* Every provider silent -> one clean failure, not a throw. */
  {
    const h = makeHost({ duration: 200, route: () => null });
    h.mp._songs.push({ title: "Ghost", artist: "Nobody", url: "data:audio/mp3;base64,GGG1", lyrics: "" });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    let threw = false;
    try { await h.lrc.Manager.prepare(0, {}); await settle(90); } catch (e) { threw = true; }
    ok("providers: all silent does not throw", !threw);
    eq("providers: all silent -> none",
       (h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId) || {}).status, "none");
    ok("providers: all three were asked",
       h.net.calls.some(u => u.indexOf("lrclib") >= 0) &&
       h.net.calls.some(u => u.indexOf("163.com") >= 0) &&
       h.net.calls.some(u => u.indexOf("textyl") >= 0),
       h.net.calls.join("\n      "));
  }
}

/* ------------------------------------------------------------------ *
 * 7a. A pasted .lrc is a source, not just a fallback
 * ------------------------------------------------------------------ */

async function testLocalSource() {
  /* A song the provider knows nothing about, but whose Japanese .lrc the
   * user pasted in by hand. The pasted file must be used, translated, and
   * cached — without a single lyrics-provider request. */
  {
    const h = makeHost({
      duration: 200,
      route: u => u.indexOf("https://translate.googleapis.com/") === 0 ? route(u) : null
    });
    h.mp._songs.push({ title: "Obscure B-side", artist: "", url: "data:audio/mp3;base64,LLL1",
                       lyrics: JA_LRC });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(80);

    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("local: pasted lyrics are used", meta && meta.status, "ready");
    eq("local: recorded as the source", meta && meta.source, "local");
    eq("local: language detected from the pasted file", meta && meta.language, "ja");
    eq("local: no lyrics-provider request was made",
       h.net.calls.filter(u => u.indexOf("lrclib") >= 0).length, 0);
    ok("local: it was still translated",
       h.net.calls.filter(u => u.indexOf("translate") >= 0).length > 0);

    const rec = await h.lrc.Cache.getLrc(meta.songId);
    const P = h.lrc.Parser;
    const orig = P.parse(JA_LRC).lines, eng = P.parse(rec.englishLrc).lines;
    eq("local: timestamps preserved from the pasted file",
       eng.map(l => l.ts), orig.map(l => l.ts));
    eq("local: first line translated", eng[0].text, "I won't forget you");
    eq("local: button reads ready",
       h.doc.querySelector("#song-list .rm-lrc-btn").textContent, "\u2713 LRC");

    /* Playback uses the cached English, not the pasted Japanese. */
    h.mp.play(0);
    await settle(60);
    ok("local: playback activates the English timeline",
       h.mp._lyrics.length > 0 && !/[\u3040-\u30FF\u4E00-\u9FFF]/.test(
         h.mp._lyrics.map(l => l.text).join("")),
       JSON.stringify(h.mp._lyrics.slice(0, 2)));

    /* Replacing the pasted .lrc must invalidate the cache rather than keep
     * serving the translation of the old one. */
    h.mp._songs[0].lyrics = EN_LRC;
    const st = h.lrc.UI.stateOf(h.mp._songs[0]);
    eq("local: the entry survives a re-read on its own", st.state, "ready");
    eq("local: but a replaced .lrc is no longer usable",
       h.lrc.Cache.isUsable(meta, 200, EN_LRC), false);
    eq("local: the original .lrc is still usable",
       h.lrc.Cache.isUsable(meta, 200, JA_LRC), true);
  }

  /* A pasted .lrc that does not match the audio falls through to LRCLIB
   * rather than being accepted or ending the run. */
  {
    const h = makeHost({ duration: 200, route });
    h.mp._songs.push({
      title: "Lemon", artist: "Kenshi Yonezu", url: "data:audio/mp3;base64,LLL2",
      lyrics: "[00:01.00]wrong\n[00:02.00]file\n[59:00.00]entirely\n[59:30.00]here"
    });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(80);
    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("local mismatch: falls through to the provider", meta && meta.source, "lrclib");
    eq("local mismatch: still ends ready", meta && meta.status, "ready");
  }

  /* Pasted lyrics with no timestamps are not treated as a synced source. */
  {
    const h = makeHost({ duration: 200, route: () => null });
    h.mp._songs.push({ title: "Words Only", artist: "", url: "data:audio/mp3;base64,LLL3",
                       lyrics: "just some words\nwith no timestamps" });
    h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
    h.lrc.UI.decorateRows();
    await h.lrc.Manager.prepare(0, {});
    await settle(60);
    const meta = h.lrc.Cache.getMetaSync(h.mp._songs[0].lrcId);
    eq("local unsynced: not accepted as a timeline", meta && meta.status, "none");
  }
}

/* ------------------------------------------------------------------ *
 * 7b. Storage that will not open
 * ------------------------------------------------------------------ */

async function testStorageFallback() {
  const h = makeHost({ duration: 200, route });
  /* Every open() fails, as it does in a private window or with site data
   * blocked. The module must fall back to localStorage and carry on. */
  h.sandbox.indexedDB = {
    open() {
      const r = { onsuccess: null, onerror: null, onupgradeneeded: null };
      setImmediate(() => r.onerror && r.onerror({ target: { error: new Error("blocked") } }));
      return r;
    }
  };
  h.mp._songs.push({ title: "Lemon", artist: "Kenshi Yonezu", url: "data:audio/mp3;base64,AAAA", lyrics: "" });
  h.songList.appendChild(h.buildRow(0, h.mp._songs[0]));
  h.lrc.UI.decorateRows();

  let threw = false;
  try { await h.lrc.Manager.prepare(0, {}); await settle(80); } catch (e) { threw = true; }
  ok("no idb: prepare does not throw", !threw);

  const songId = h.mp._songs[0].lrcId;
  const meta = await h.lrc.Cache.getMeta(songId);
  eq("no idb: metadata still stored", meta && meta.status, "ready");
  ok("no idb: it went to localStorage",
     h.sandbox.localStorage._map.has("ryn_lrc_meta_" + songId),
     [...h.sandbox.localStorage._map.keys()].join(","));

  h.mp.play(0);
  await settle(60);
  ok("no idb: playback still activates from the fallback cache", h.mp._lyrics.length > 0);
}

/* ------------------------------------------------------------------ *
 * 8. The wrappers leave the player intact
 * ------------------------------------------------------------------ */

async function testNonInterference() {
  const h = makeHost({ duration: 200, route: () => null });
  const mp = h.mp;

  /* A song with hand-pasted lyrics and no cache keeps working exactly as
   * it did before the module existed. */
  mp._songs.push({ title: "Manual", artist: "", url: "data:audio/mp3;base64,HHHH", lyrics: EN_LRC });
  mp.play(0);
  await settle(60);
  eq("non-interference: hand-pasted lyrics still parsed by the player, reflowed for chat",
     mp._lyrics.length, 6);
  ok("non-interference: reflow is the player's, not the module's",
     mp._lyrics.every(l => l.text.length <= 30));
  eq("non-interference: module did not take the session", h.lrc.Sync.active, null);

  const out = [];
  const spy = h.sandbox.client.PacketManager.chat;
  h.sandbox.client.PacketManager.chat = t => out.push(t);
  for (let t = 0; t <= 25; t += 0.25) { mp._audio.currentTime = t; mp._lastSentWall = 0; mp._tickSync(); }
  await drain(180);
  h.sandbox.client.PacketManager.chat = spy;
  ok("non-interference: manual lyrics still reach chat", out.length >= 4, JSON.stringify(out));

  /* Sync modes off means nothing is sent, cached or not. */
  mp._chatSync = false;
  const out2 = [];
  h.sandbox.client.PacketManager.chat = t => out2.push(t);
  mp.play(0);
  await settle(40);
  for (let t = 0; t <= 25; t += 0.25) { mp._audio.currentTime = t; mp._lastSentWall = 0; mp._tickSync(); }
  await drain(120);
  h.sandbox.client.PacketManager.chat = spy;
  eq("non-interference: chat sync off sends nothing", out2.length, 0);
  mp._chatSync = true;

  /* attach() is idempotent — a double build cannot double-wrap. */
  eq("non-interference: attach is idempotent", h.lrc.attach(mp), false);

  /* UI.resetFrame() rebuilds the menu iframe; the new document needs its
   * own copy of the module's styles, and its own buttons. */
  h.songList.appendChild(h.buildRow(0, mp._songs[0]));
  h.lrc.UI.decorateRows();
  eq("frame reset: styles injected into the first document",
     h.doc.querySelectorAll("#ryn-lrc-style").length, 1);
  const doc2 = makeDom();
  const list2 = doc2.createElement("div");
  list2.setAttribute("id", "song-list");
  doc2.body.appendChild(list2);
  list2.appendChild(buildRow(doc2, 0, mp._songs[0]));
  mp._frameDoc = doc2;
  h.lrc.UI.decorateRows();
  eq("frame reset: styles injected into the rebuilt document",
     doc2.querySelectorAll("#ryn-lrc-style").length, 1);
  eq("frame reset: the button comes back", doc2.querySelectorAll(".rm-lrc-btn").length, 1);
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

(async () => {
  try {
    await testPrepare();
    await testPlayback();
    await testTags();
    await testProviders();
    await testFailures();
    await testLocalSource();
    await testStorageFallback();
    await testNonInterference();
  } catch (e) {
    failures.push("harness threw: " + (e && e.stack || e));
  }

  await drain(120);
  for (const r of rejections) failures.push("unhandled rejection escaped the module\n      " + r);
  if (!rejections.length) passed++;

  console.log("");
  if (!failures.length) {
    console.log(`  ${passed} checks passed`);
    process.exit(0);
  }
  console.log(`  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) console.log("  x " + f);
  process.exit(1);
})();
