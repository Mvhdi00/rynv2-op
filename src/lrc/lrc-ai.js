/* ============================================================================
 * RYN TYPE 2 — LRC AI LYRICS
 *
 * Automatic synchronised lyrics for the Music library: find the .lrc for a
 * song, translate it to English when it is not already English, validate it,
 * cache it, and hand the finished timeline to the player's existing chat-sync
 * loop when that song plays.
 *
 * This module is self-contained. It reaches into exactly one existing object
 * (`MusicPlayer`) and wraps four of its methods; it does not modify any of
 * their bodies, does not touch any other Ryn system, and adds no per-frame
 * work of its own. Remove the module and the client behaves exactly as before.
 *
 * WHAT IT REUSES, RATHER THAN REBUILDING
 *   chat      MusicPlayer._tickSync -> _sendChat / _sendLyric* -> PacketManager
 *             There is no second chat path here. The module only decides what
 *             `MusicPlayer._lyrics` contains; the player still does the sending,
 *             so every existing sync mode (me / bots / mixed / unified), the
 *             30-char chunking and the 2200 ms spacing keep working unchanged.
 *   loop      MusicPlayer._startRAF / _tickSync. No new interval, no new RAF.
 *   reflow    MusicPlayer._reflowLRC, so lines are split for the 30-char chat
 *             cap exactly the way manually-pasted lyrics already are.
 *   toast     MusicPlayer._toast
 *   storage   the same IndexedDB-with-localStorage-fallback pattern as
 *             MusicPlayer._openDB, in its own database (see LRCCache).
 *
 * ARCHITECTURE
 *   LRCManager            orchestrates the prepare pipeline and playback lookup
 *   +- SongIdentifier     stable per-song id from title + artist + content hash
 *   +- LRCFetcher         LRCLIB lookup, synced preferred over plain
 *   +- LRCParser          timestamps, multi-timestamp lines, metadata tags
 *   +- LanguageDetector   script + stopword detection, no network
 *   +- TranslationManager provider chain, per-line, 1:1 with timestamps
 *   +- LRCValidator       is this usable, and does it belong to this song
 *   +- LRCCache           RynLRCDB: meta + original.lrc + english.lrc
 *   +- SyncEngine         timeline build, offset, binary-search seek
 *   +- ChatLyricsSender   sanitising + the handoff to the player's chat loop
 *   +- LRCUI              the [LRC AI] button and the details panel
 *
 * NETWORK POLICY
 *   Requests happen only while preparing a song — i.e. only when the user
 *   presses [LRC AI] or [Retry LRC]. Playback is served entirely from cache.
 *
 * SECURITY
 *   Downloaded lyrics are treated as plain text and nothing else. Text is
 *   stripped of control characters and length-capped at parse time, before it
 *   can reach either the chat packet or the DOM, and every element this module
 *   creates is built with createElement/textContent — never innerHTML.
 * ========================================================================== */

const RynLRC = (function () {
  "use strict";

  const CACHE_VERSION = 1;
  const DB_NAME = "RynLRCDB";
  const DB_VERSION = 1;
  const STORE_META = "meta";      /* RynData/Lyrics/<SongID>/metadata.json */
  const STORE_LRC = "lyrics";     /* RynData/Lyrics/<SongID>/{original,english}.lrc */
  const GLOBAL_OFFSET_KEY = "ryn_lrc_global_offset";
  const LS_PREFIX = "ryn_lrc_";   /* localStorage fallback when IDB is unusable */

  const NET_TIMEOUT_MS = 12000;
  const META_TIMEOUT_MS = 8000;
  const TRANSLATE_CONCURRENCY = 4;
  const TRANSLATE_STAGGER_MS = 60;
  const MAX_LINE_CHARS = 300;     /* a lyric line longer than this is not a lyric */
  const DURATION_DRIFT_S = 5;     /* cached lyrics stop matching past this */
  const SEEK_RESET_S = 3;         /* a jump this big cancels pending chat chunks */

  /* The host player. Set by attach(). */
  const Host = { mp: null };

  /* ---------------------------------------------------------------------- *
   * Small helpers
   * ---------------------------------------------------------------------- */

  function warn(where, err) {
    try { console.warn("[RynLRC] " + where + ":", err); } catch (_) {}
  }

  /* Every callback that crosses back into the player goes through this, so a
   * bug in the lyrics module can never take the music player down with it. */
  function guard(where, fn) {
    return function () {
      try { return fn.apply(this, arguments); } catch (e) { warn(where, e); }
    };
  }

  /* A sync try/catch does not catch a rejected promise, so every async entry
   * point called from an event handler or a wrapper goes through here. */
  function fire(promise, where) {
    try {
      if (promise && typeof promise.catch === "function") {
        promise.catch(function (e) { warn(where, e); });
      }
    } catch (e) { warn(where, e); }
    return undefined;
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* fetch + timeout + "never throw at the caller". */
  async function httpJson(url, timeoutMs) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(function () { try { ctl && ctl.abort(); } catch (_) {} },
      timeoutMs || NET_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: ctl ? ctl.signal : undefined
      });
      if (!res.ok) return { ok: false, status: res.status, data: null };
      const data = await res.json();
      return { ok: true, status: res.status, data: data };
    } catch (e) {
      return { ok: false, status: 0, data: null, error: e };
    } finally {
      clearTimeout(timer);
    }
  }

  async function sha256Hex(text) {
    try {
      if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        const bytes = new Uint8Array(buf);
        let out = "";
        for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
        return out;
      }
    } catch (_) {}
    return fnv1aHex(text);
  }

  /* Fallback when SubtleCrypto is unavailable (insecure context). 128 bits of
   * FNV-1a over four differently-seeded lanes — weaker than SHA-256, but this
   * is only ever used to tell two songs apart, never as a security boundary. */
  function fnv1aHex(text) {
    const seeds = [ 0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b ];
    let out = "";
    for (let s = 0; s < seeds.length; s++) {
      let h = seeds[s] >>> 0;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i) & 0xff;
        h = Math.imul(h, 0x01000193) >>> 0;
        h ^= text.charCodeAt(i) >>> 8;
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      out += h.toString(16).padStart(8, "0");
    }
    return out;
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  function clampInt(v, lo, hi, dflt) {
    const n = parseInt(v, 10);
    if (!isFinite(n)) return dflt;
    return Math.max(lo, Math.min(hi, n));
  }

  function fmtClock(sec) {
    if (!isFinite(sec) || sec <= 0) return "--:--";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------------------------------------------------------------------- *
   * ChatLyricsSender
   *
   * Deliberately thin. Ryn already has a chat architecture and the brief says
   * not to grow a second one, so this owns only the two things the existing
   * path does not do: making downloaded text safe to hand over, and saying
   * whether the player is currently in a state where lyrics would be sent.
   * ---------------------------------------------------------------------- */

  const ChatLyricsSender = {
    /* Downloaded LRC is untrusted plain text. Strip anything that is not a
     * printable lyric before it can reach a chat packet or the DOM. */
    sanitize: function (text) {
      let t = String(text == null ? "" : text);
      /* control chars, bidi overrides and zero-width joiners */
      t = t.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
      t = t.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "");
      t = t.replace(/\s+/g, " ").trim();
      if (t.length > MAX_LINE_CHARS) t = t.slice(0, MAX_LINE_CHARS).trim();
      return t;
    },

    /* True when one of the player's four sync modes is on. The module never
     * flips these itself — enabling chat output stays the user's decision. */
    chatSyncActive: function () {
      const mp = Host.mp;
      if (!mp) return false;
      return !!(mp._chatSync || mp._mixedSync || mp._botsOnlySync || mp._unifiedSync);
    },

    /* The handoff. The player's own _tickSync reads _lyrics every frame and
     * does the sending, chunking and per-mode routing. */
    handoff: function (timeline, seedIndex) {
      const mp = Host.mp;
      if (!mp) return;
      mp._lyrics = timeline;
      mp._lyricIndex = seedIndex;
      mp._lastSentWall = 0;
    }
  };

  /* ---------------------------------------------------------------------- *
   * LRCParser
   *
   * Handles what the player's built-in _parseLRC does not: multiple
   * timestamps on one line, [ti:]/[ar:]/[al:]/[au:]/[by:]/[length:]/[offset:]
   * metadata, enhanced word-level <mm:ss.xx> markers, and malformed input.
   *
   * Each parsed line keeps `ts`, the exact bracket text it came from, so the
   * English .lrc can be written back with byte-identical timestamps rather
   * than re-derived ones.
   * ---------------------------------------------------------------------- */

  const TIME_TAG = /\[(\d{1,4}):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g;
  const META_TAG = /^\[([a-zA-Z#]+):(.*)\]$/;
  const WORD_TAG = /<\d{1,4}:\d{1,2}(?:[.:]\d{1,3})?>/g;

  const LRCParser = {
    parse: function (raw) {
      const meta = {};
      const lines = [];
      let malformed = 0;
      let emptyTimed = 0;

      let text = String(raw == null ? "" : raw);
      text = text.replace(/^\uFEFF/, "");            /* UTF-8 BOM */
      text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      const rows = text.split("\n");
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r].trim();
        if (!row) continue;

        /* Metadata: a single bracket pair whose tag is alphabetic. Anything
         * unparseable in here is skipped rather than thrown. */
        const mm = row.match(META_TAG);
        if (mm && !/^\d/.test(mm[1])) {
          const key = mm[1].toLowerCase();
          const val = mm[2].trim();
          if (key === "offset") {
            const n = parseInt(val, 10);
            if (isFinite(n) && Math.abs(n) < 600000) meta.offset = n;
          } else if (key.length <= 12) {
            meta[key] = val.slice(0, 200);
          }
          continue;
        }

        /* Timestamps. Collect every leading tag, then take what is left. */
        TIME_TAG.lastIndex = 0;
        const stamps = [];
        let cursor = 0;
        let m;
        while ((m = TIME_TAG.exec(row)) !== null) {
          if (m.index !== cursor) break;           /* tags must be contiguous */
          cursor = TIME_TAG.lastIndex;
          const min = parseInt(m[1], 10);
          const sec = parseInt(m[2], 10);
          let frac = 0;
          if (m[3]) {
            /* 1 digit = tenths, 2 = hundredths, 3 = milliseconds */
            const d = m[3];
            frac = parseInt(d, 10) * (d.length === 1 ? 100 : d.length === 2 ? 10 : 1);
          }
          if (!isFinite(min) || !isFinite(sec)) continue;
          stamps.push({
            ms: (min * 60 + sec) * 1000 + frac,
            ts: m[0].slice(1, -1)
          });
        }

        if (!stamps.length) {
          if (row[0] === "[") malformed++;
          continue;
        }

        let body = row.slice(cursor);
        body = body.replace(WORD_TAG, " ");        /* enhanced LRC word timings */
        body = ChatLyricsSender.sanitize(body);

        if (!body) { emptyTimed += stamps.length; continue; }   /* instrumental gap */

        for (let s = 0; s < stamps.length; s++) {
          lines.push({ ms: stamps[s].ms, ts: stamps[s].ts, text: body });
        }
      }

      /* [offset:] convention: a positive offset shifts the lyrics earlier, so
       * it is subtracted from every timestamp. Kept out of `ms` here and
       * applied at timeline build time instead, so `ms` always mirrors the
       * file and the stored .lrc stays untouched. */
      lines.sort(function (a, b) { return a.ms - b.ms || (a.text < b.text ? -1 : 1); });

      /* Drop exact duplicates (same instant, same words). */
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const prev = out[out.length - 1];
        if (prev && prev.ms === lines[i].ms && prev.text === lines[i].text) continue;
        out.push(lines[i]);
      }

      return { meta: meta, lines: out, malformed: malformed, emptyTimed: emptyTimed };
    },

    /* True when the text carries at least one real timestamp. Used to tell a
     * synced .lrc apart from plain lyrics without a full parse. */
    looksSynced: function (raw) {
      TIME_TAG.lastIndex = 0;
      return TIME_TAG.test(String(raw == null ? "" : raw));
    },

    /* Serialise back to .lrc. Timestamps are written from the `ts` string the
     * line was parsed from, so they survive a round trip exactly. */
    format: function (lines, header) {
      const out = [];
      if (header) {
        if (header.ti) out.push("[ti:" + header.ti + "]");
        if (header.ar) out.push("[ar:" + header.ar + "]");
        if (header.al) out.push("[al:" + header.al + "]");
        if (header.by) out.push("[by:" + header.by + "]");
        if (header.length) out.push("[length:" + header.length + "]");
        if (out.length) out.push("");
      }
      for (let i = 0; i < lines.length; i++) {
        const ts = lines[i].ts || LRCParser.msToTs(lines[i].ms);
        out.push("[" + ts + "]" + lines[i].text);
      }
      return out.join("\n") + "\n";
    },

    msToTs: function (ms) {
      const total = Math.max(0, Math.round(ms));
      const min = Math.floor(total / 60000);
      const sec = Math.floor((total % 60000) / 1000);
      const cs = Math.floor((total % 1000) / 10);
      return String(min).padStart(2, "0") + ":" +
             String(sec).padStart(2, "0") + "." +
             String(cs).padStart(2, "0");
    }
  };

  /* ---------------------------------------------------------------------- *
   * LanguageDetector
   *
   * Offline. Script ranges settle the non-Latin languages outright; Latin
   * script falls through to stopword and diacritic scoring. Anything it is
   * not sure about comes back as "und", and the translation provider's own
   * detection settles it before a single line is translated.
   * ---------------------------------------------------------------------- */

  const SCRIPTS = [
    { lang: "ja", re: /[぀-ゟ゠-ヿ]/g },
    { lang: "ko", re: /[가-힯ᄀ-ᇿ㄰-㆏]/g },
    { lang: "ar", re: /[؀-ۿݐ-ݿࢠ-ࣿ]/g },
    { lang: "ru", re: /[Ѐ-ӿ]/g },
    { lang: "hi", re: /[ऀ-ॿ]/g },
    { lang: "he", re: /[֐-׿]/g },
    { lang: "th", re: /[฀-๿]/g },
    { lang: "el", re: /[Ͱ-Ͽ]/g },
    { lang: "zh", re: /[一-鿿㐀-䶿]/g }   /* last: kana beats Han */
  ];

  const STOPWORDS = {
    en: ("the and you that with have this for not are your but all was what when there " +
         "from just then they will can dont cant were been into about only over").split(/\s+/),
    es: "que los las por con una para como pero más este esta cuando todo nada siempre corazón amor vida".split(/\s+/),
    fr: "les des que pour dans une avec pas plus sur mais tout comme elle nous vous toujours amour coeur".split(/\s+/),
    de: "die der und das ich nicht mit auch für ein eine ist wie aber wenn immer mich dich liebe".split(/\s+/),
    pt: "que com uma para não mais como você seu meu quando tudo nada sempre coração amor vida".split(/\s+/),
    it: "che non per una con come più sono nel della anche quando tutto niente sempre cuore amore".split(/\s+/),
    tr: "bir ben sen için ama daha çok gibi her şey zaman kalp aşk seni beni".split(/\s+/),
    nl: "een het niet van voor met maar ook nog wel dat ik je mijn jouw liefde".split(/\s+/),
    pl: "nie jest tak jak dla ale tylko jeszcze wszystko kiedy ciebie mnie serce".split(/\s+/),
    id: "yang dan untuk tidak ini itu dengan aku kamu kita akan sudah cinta hati".split(/\s+/),
    vi: "không được người này thì một cho anh em với những trong tình yêu".split(/\s+/)
  };

  const DIACRITIC_HINTS = [
    { lang: "es", re: /[ñ¿¡]/gi },
    { lang: "fr", re: /[œàèùêôçâ]/gi },
    { lang: "de", re: /[äöüß]/gi },
    { lang: "pt", re: /[ãõ]/gi },
    { lang: "tr", re: /[ğışİ]/gi },
    { lang: "pl", re: /[ąćęłńśźż]/gi }
  ];

  const LANG_NAMES = {
    en: "English", ja: "Japanese", ko: "Korean", zh: "Chinese", ar: "Arabic",
    es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian",
    ru: "Russian", tr: "Turkish", hi: "Hindi", he: "Hebrew", th: "Thai",
    el: "Greek", nl: "Dutch", pl: "Polish", id: "Indonesian", vi: "Vietnamese",
    und: "Unknown"
  };

  const LanguageDetector = {
    name: function (code) {
      return LANG_NAMES[code] || String(code || "unknown");
    },

    detect: function (lines) {
      const sample = lines.slice(0, 120).map(function (l) { return l.text; }).join(" ");
      if (!sample.trim()) return { lang: "und", confidence: 0 };

      const letters = (sample.match(/\S/g) || []).length || 1;

      /* Non-Latin scripts are decisive. Kana or Hangul anywhere in a lyric
       * means Japanese or Korean even when Han characters outnumber them. */
      const hits = {};
      for (let i = 0; i < SCRIPTS.length; i++) {
        const s = SCRIPTS[i];
        s.re.lastIndex = 0;
        hits[s.lang] = (sample.match(s.re) || []).length;
      }
      if (hits.ja / letters > 0.03) return { lang: "ja", confidence: 0.98 };
      if (hits.ko / letters > 0.05) return { lang: "ko", confidence: 0.98 };
      if (hits.ar / letters > 0.10) return { lang: "ar", confidence: 0.97 };
      if (hits.ru / letters > 0.10) return { lang: "ru", confidence: 0.97 };
      if (hits.hi / letters > 0.10) return { lang: "hi", confidence: 0.96 };
      if (hits.he / letters > 0.10) return { lang: "he", confidence: 0.96 };
      if (hits.th / letters > 0.10) return { lang: "th", confidence: 0.96 };
      if (hits.el / letters > 0.10) return { lang: "el", confidence: 0.95 };
      if (hits.zh / letters > 0.10) return { lang: "zh", confidence: 0.95 };

      /* Latin script: score stopwords, then let diacritics break ties. */
      const words = sample.toLowerCase().match(/[a-zà-öø-ÿğışçăâîșțąćęłńśźż']+/g) || [];
      if (words.length < 4) return { lang: "und", confidence: 0 };

      const wordSet = Object.create(null);
      for (let i = 0; i < words.length; i++) wordSet[words[i]] = (wordSet[words[i]] || 0) + 1;

      const scores = {};
      for (const lang in STOPWORDS) {
        const list = STOPWORDS[lang];
        let hitCount = 0;
        for (let i = 0; i < list.length; i++) if (wordSet[list[i]]) hitCount += wordSet[list[i]];
        scores[lang] = hitCount / words.length;
      }
      for (let i = 0; i < DIACRITIC_HINTS.length; i++) {
        const h = DIACRITIC_HINTS[i];
        h.re.lastIndex = 0;
        const n = (sample.match(h.re) || []).length;
        if (n) scores[h.lang] = (scores[h.lang] || 0) + Math.min(0.08, n / letters * 2);
      }

      let best = "und", bestScore = 0, second = 0;
      for (const lang in scores) {
        if (scores[lang] > bestScore) { second = bestScore; bestScore = scores[lang]; best = lang; }
        else if (scores[lang] > second) { second = scores[lang]; }
      }

      /* Below this the sample is too thin to call, and "und" sends the
       * question to the translation provider instead of guessing wrong. */
      if (bestScore < 0.035) return { lang: "und", confidence: 0 };
      const margin = bestScore - second;
      return { lang: best, confidence: Math.min(0.95, 0.5 + margin * 6) };
    }
  };

  /* ---------------------------------------------------------------------- *
   * TranslationManager
   *
   * One request per unique line, never a batch that could come back with a
   * different number of lines than it went out with. Repeated lines (choruses
   * are most of a lyric) are translated once and reused, which is what keeps
   * the request count sane.
   *
   * Providers are tried in order until one answers; the first that works is
   * kept for the rest of the song. A line no provider can translate keeps its
   * original text — a timestamp is never dropped because a request failed.
   * ---------------------------------------------------------------------- */

  const PROVIDERS = [
    {
      id: "gtx",
      /* Also reports the source language it detected, which is what settles
       * an "und" from LanguageDetector. */
      translate: async function (text, src) {
        const url = "https://translate.googleapis.com/translate_a/single" +
          "?client=gtx&sl=" + encodeURIComponent(src || "auto") +
          "&tl=en&dt=t&q=" + encodeURIComponent(text);
        const r = await httpJson(url, NET_TIMEOUT_MS);
        if (!r.ok || !Array.isArray(r.data) || !Array.isArray(r.data[0])) return null;
        let out = "";
        for (let i = 0; i < r.data[0].length; i++) {
          const seg = r.data[0][i];
          if (seg && typeof seg[0] === "string") out += seg[0];
        }
        out = out.trim();
        if (!out) return null;
        return { text: out, detected: typeof r.data[2] === "string" ? r.data[2] : null };
      }
    },
    {
      id: "lingva",
      translate: async function (text, src) {
        const url = "https://lingva.ml/api/v1/" + encodeURIComponent(src && src !== "und" ? src : "auto") +
          "/en/" + encodeURIComponent(text);
        const r = await httpJson(url, NET_TIMEOUT_MS);
        if (!r.ok || !r.data || typeof r.data.translation !== "string") return null;
        const out = r.data.translation.trim();
        if (!out) return null;
        return { text: out, detected: r.data.info && r.data.info.detectedSource || null };
      }
    },
    {
      id: "mymemory",
      translate: async function (text, src) {
        if (!src || src === "und" || src === "auto") return null;   /* needs a pair */
        const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) +
          "&langpair=" + encodeURIComponent(src) + "%7Cen";
        const r = await httpJson(url, NET_TIMEOUT_MS);
        if (!r.ok || !r.data || !r.data.responseData) return null;
        const out = String(r.data.responseData.translatedText || "").trim();
        if (!out || /^(MYMEMORY WARNING|INVALID)/i.test(out)) return null;
        return { text: out, detected: null };
      }
    }
  ];

  const TranslationManager = {
    /* Ask a provider what language a sample is. Only called when the offline
     * detector was not confident, and only ever on one line. */
    probeLanguage: async function (sample) {
      for (let i = 0; i < PROVIDERS.length; i++) {
        try {
          const r = await PROVIDERS[i].translate(sample, "auto");
          if (r && r.detected) return { lang: String(r.detected).slice(0, 5).toLowerCase(), provider: PROVIDERS[i].id };
        } catch (e) { warn("probeLanguage/" + PROVIDERS[i].id, e); }
      }
      return { lang: null, provider: null };
    },

    /*
     * texts    the original lines, in order
     * src      source language code
     * onTick   progress callback (done, total)
     * token    { cancelled: bool } — a song change or a Clear aborts the run
     *
     * Returns { texts, provider, failed } with texts.length === texts.in.length
     * always, so the caller can zip translations back onto timestamps by index.
     */
    translateLines: async function (texts, src, onTick, token) {
      const unique = [];
      const byText = new Map();
      for (let i = 0; i < texts.length; i++) {
        if (!byText.has(texts[i])) { byText.set(texts[i], null); unique.push(texts[i]); }
      }

      let provider = null;
      let failed = 0;
      let done = 0;

      /* Find a provider that answers, using the first line as the probe. */
      for (let p = 0; p < PROVIDERS.length && unique.length; p++) {
        if (token && token.cancelled) return { texts: texts.slice(), provider: null, failed: texts.length, cancelled: true };
        try {
          const r = await PROVIDERS[p].translate(unique[0], src);
          if (r && r.text) {
            provider = PROVIDERS[p];
            byText.set(unique[0], r.text);
            done = 1;
            if (onTick) onTick(done, unique.length);
            break;
          }
        } catch (e) { warn("translate probe/" + PROVIDERS[p].id, e); }
      }
      if (!provider) return { texts: texts.slice(), provider: null, failed: texts.length };

      /* Remaining unique lines, bounded concurrency, small stagger. */
      const queue = unique.slice(done);
      let cursor = 0;

      async function worker(slot) {
        await sleep(slot * TRANSLATE_STAGGER_MS);
        while (cursor < queue.length) {
          if (token && token.cancelled) return;
          const line = queue[cursor++];
          let got = null;
          try {
            got = await provider.translate(line, src);
          } catch (e) { warn("translate/" + provider.id, e); }
          if (!got || !got.text) {
            /* One retry down the chain before giving up on this line. */
            for (let p = 0; p < PROVIDERS.length; p++) {
              if (PROVIDERS[p] === provider) continue;
              try {
                const alt = await PROVIDERS[p].translate(line, src);
                if (alt && alt.text) { got = alt; break; }
              } catch (e) { warn("translate alt/" + PROVIDERS[p].id, e); }
            }
          }
          if (got && got.text) byText.set(line, got.text);
          else { byText.set(line, null); failed++; }
          done++;
          if (onTick) onTick(done, unique.length);
        }
      }

      const workers = [];
      for (let w = 0; w < Math.min(TRANSLATE_CONCURRENCY, queue.length); w++) workers.push(worker(w));
      await Promise.all(workers);

      if (token && token.cancelled) {
        return { texts: texts.slice(), provider: provider.id, failed: failed, cancelled: true };
      }

      /* Zip back by index. A line whose translation failed keeps its original
       * words rather than vanishing, so the event count never changes. */
      const out = new Array(texts.length);
      for (let i = 0; i < texts.length; i++) {
        const t = byText.get(texts[i]);
        out[i] = t ? ChatLyricsSender.sanitize(t) : texts[i];
      }
      return { texts: out, provider: provider.id, failed: failed };
    }
  };

  /* ---------------------------------------------------------------------- *
   * LRCValidator
   *
   * The gate in front of "✓ LRC Ready". Everything it rejects comes back as a
   * reason string the details panel can show verbatim.
   * ---------------------------------------------------------------------- */

  const LRCValidator = {
    validateParsed: function (parsed, opts) {
      opts = opts || {};
      const lines = parsed && parsed.lines || [];

      if (!lines.length) return { ok: false, reason: "no timestamped lines in the file" };

      let withText = 0;
      for (let i = 0; i < lines.length; i++) if (lines[i].text && lines[i].text.length > 1) withText++;
      if (withText < 3) return { ok: false, reason: "fewer than 3 lines carry any words" };

      /* parse() sorts, so this only catches a genuinely broken clock. */
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].ms < lines[i - 1].ms) return { ok: false, reason: "timestamps are out of order" };
      }

      const first = lines[0].ms;
      const last = lines[lines.length - 1].ms;
      if (first < 0) return { ok: false, reason: "first timestamp is negative" };
      if (last <= 0) return { ok: false, reason: "every timestamp is zero" };
      if (last > 3 * 3600 * 1000) return { ok: false, reason: "timestamps run past three hours" };

      /* Does this lyric belong to this song? A synced file whose last line
       * lands well past the end of the audio is a different release, or a
       * different song entirely. */
      const dur = opts.durationSec;
      if (dur && isFinite(dur) && dur > 1) {
        const durMs = dur * 1000;
        /* Some slack: an .lrc can carry a trailing credit line, and the file
         * on disk is often a slightly different edit. Scaled to the track so
         * a 30-second clip is not judged by a four-minute song's tolerance. */
        const slack = Math.min(45000, Math.max(15000, durMs * 0.1));
        if (last > durMs + slack) {
          return { ok: false, reason: "lyrics run " + Math.round((last - durMs) / 1000) +
            "s past the end of the audio — likely a different release" };
        }
        /* Deliberately loose: a long instrumental outro is normal, so this is
         * only meant to catch a file that is plainly for a different track.
         * The check above is the one that does the real work. */
        if (last < durMs * 0.15 && durMs > 60000) {
          return { ok: false, reason: "lyrics cover only " +
            Math.round(last / durMs * 100) + "% of the audio" };
        }
      }

      return {
        ok: true,
        reason: "",
        stats: { events: lines.length, withText: withText, firstMs: first, lastMs: last }
      };
    },

    /* The translation layer must not change how many lyric events there are;
     * if it did, the timestamps and the words are no longer the same list. */
    validateTranslation: function (original, translated) {
      if (!Array.isArray(translated) || translated.length !== original.length) {
        return { ok: false, reason: "translation returned " +
          (translated ? translated.length : 0) + " lines for " + original.length };
      }
      for (let i = 0; i < original.length; i++) {
        if (translated[i].ms !== original[i].ms) {
          return { ok: false, reason: "timestamp changed on line " + (i + 1) };
        }
        if (translated[i].ts !== original[i].ts) {
          return { ok: false, reason: "timestamp text changed on line " + (i + 1) };
        }
        if (!translated[i].text) {
          return { ok: false, reason: "line " + (i + 1) + " came back empty" };
        }
      }
      return { ok: true, reason: "" };
    }
  };

  /* ---------------------------------------------------------------------- *
   * LRCCache
   *
   *   RynData/Lyrics/<SongID>/metadata.json  ->  RynLRCDB.meta[songId]
   *   RynData/Lyrics/<SongID>/original.lrc   ->  RynLRCDB.lyrics[songId].originalLrc
   *   RynData/Lyrics/<SongID>/english.lrc    ->  RynLRCDB.lyrics[songId].englishLrc
   *
   * A separate database from the player's BeeMusicDB on purpose: adding a
   * store to that one means opening it at a higher version, and a second
   * connection doing that can knock the music library's own connection over.
   * The lyrics cache is not worth that risk, so it lives next door.
   *
   * Metadata is a store of its own so the song list can colour every button
   * from one small read, without pulling every .lrc body into memory.
   * ---------------------------------------------------------------------- */

  const LRCCache = {
    _db: null,
    _dbFailed: false,
    _metaMem: new Map(),      /* songId -> meta, warmed once at first render */
    _lrcMem: new Map(),       /* songId -> { originalLrc, englishLrc } */
    _warmed: false,

    _open: function () {
      const self = this;
      if (this._db) return Promise.resolve(this._db);
      if (this._dbFailed) return Promise.reject(new Error("idb unavailable"));
      return new Promise(function (resolve, reject) {
        let req;
        try {
          req = indexedDB.open(DB_NAME, DB_VERSION);
        } catch (e) {
          self._dbFailed = true;
          reject(e);
          return;
        }
        req.onupgradeneeded = function (e) {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
          if (!db.objectStoreNames.contains(STORE_LRC)) db.createObjectStore(STORE_LRC);
        };
        req.onsuccess = function (e) {
          self._db = e.target.result;
          self._db.onversionchange = function () {
            try { self._db.close(); } catch (_) {}
            self._db = null;
          };
          resolve(self._db);
        };
        req.onerror = function (e) { self._dbFailed = true; reject(e); };
        req.onblocked = function () { self._dbFailed = true; reject(new Error("idb blocked")); };
      });
    },

    _idbGet: function (store, key) {
      return this._open().then(function (db) {
        return new Promise(function (resolve, reject) {
          const tx = db.transaction(store, "readonly");
          const req = tx.objectStore(store).get(key);
          req.onsuccess = function (e) { resolve(e.target.result); };
          req.onerror = function (e) { reject(e); };
        });
      });
    },

    _idbPut: function (store, key, value) {
      return this._open().then(function (db) {
        return new Promise(function (resolve, reject) {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(value, key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function (e) { reject(e); };
        });
      });
    },

    _idbDelete: function (store, key) {
      return this._open().then(function (db) {
        return new Promise(function (resolve, reject) {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).delete(key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function (e) { reject(e); };
        });
      });
    },

    _idbAllMeta: function () {
      return this._open().then(function (db) {
        return new Promise(function (resolve, reject) {
          const out = [];
          const tx = db.transaction(STORE_META, "readonly");
          const req = tx.objectStore(STORE_META).openCursor();
          req.onsuccess = function (e) {
            const cur = e.target.result;
            if (!cur) { resolve(out); return; }
            out.push(cur.value);
            cur.continue();
          };
          req.onerror = function (e) { reject(e); };
        });
      });
    },

    /* localStorage fallback, used only when IndexedDB refuses to open. */
    _lsGet: function (kind, songId) {
      try {
        const raw = localStorage.getItem(LS_PREFIX + kind + "_" + songId);
        return raw ? JSON.parse(raw) : undefined;
      } catch (_) { return undefined; }
    },
    _lsPut: function (kind, songId, value) {
      try { localStorage.setItem(LS_PREFIX + kind + "_" + songId, JSON.stringify(value)); return true; }
      catch (_) { return false; }
    },
    _lsDelete: function (kind, songId) {
      try { localStorage.removeItem(LS_PREFIX + kind + "_" + songId); } catch (_) {}
    },

    /* One pass over the metadata store so every [LRC AI] button can render
     * from memory. Called once, on the first song-list render. */
    warm: async function () {
      if (this._warmed) return;
      this._warmed = true;
      try {
        const all = await this._idbAllMeta();
        for (let i = 0; i < all.length; i++) {
          if (all[i] && all[i].songId) this._metaMem.set(all[i].songId, all[i]);
        }
      } catch (e) {
        warn("cache warm", e);
      }
    },

    getMetaSync: function (songId) {
      return songId ? this._metaMem.get(songId) || null : null;
    },

    getMeta: async function (songId) {
      if (!songId) return null;
      if (this._metaMem.has(songId)) return this._metaMem.get(songId);
      let meta = null;
      try { meta = await this._idbGet(STORE_META, songId); }
      catch (e) { meta = this._lsGet("meta", songId); }
      if (meta === undefined) meta = null;
      if (meta) this._metaMem.set(songId, meta);
      return meta;
    },

    getLrc: async function (songId) {
      if (!songId) return null;
      if (this._lrcMem.has(songId)) return this._lrcMem.get(songId);
      let rec = null;
      try { rec = await this._idbGet(STORE_LRC, songId); }
      catch (e) { rec = this._lsGet("lrc", songId); }
      if (rec === undefined) rec = null;
      if (rec) this._lrcMem.set(songId, rec);
      return rec;
    },

    put: async function (songId, meta, lrc) {
      if (!songId) return false;
      this._metaMem.set(songId, meta);
      if (lrc) this._lrcMem.set(songId, lrc);
      let ok = true;
      try {
        await this._idbPut(STORE_META, songId, meta);
        if (lrc) await this._idbPut(STORE_LRC, songId, lrc);
      } catch (e) {
        warn("cache put", e);
        ok = this._lsPut("meta", songId, meta);
        if (lrc) ok = this._lsPut("lrc", songId, lrc) && ok;
      }
      return ok;
    },

    remove: async function (songId) {
      if (!songId) return;
      this._metaMem.delete(songId);
      this._lrcMem.delete(songId);
      try {
        await this._idbDelete(STORE_META, songId);
        await this._idbDelete(STORE_LRC, songId);
      } catch (e) { warn("cache remove", e); }
      this._lsDelete("meta", songId);
      this._lsDelete("lrc", songId);
    },

    /* A cache entry stops being trusted when the module's format moves on,
     * when the audio it was matched against is no longer the same length, or
     * when it was built from a pasted .lrc that has since been replaced —
     * otherwise pasting a better file would silently keep serving the old
     * translation. */
    isUsable: function (meta, durationSec, localRaw) {
      if (!meta) return false;
      if (meta.version !== CACHE_VERSION) return false;
      if (meta.status !== "ready" && meta.status !== "plain") return false;
      if (durationSec && meta.durationSec &&
          Math.abs(durationSec - meta.durationSec) > DURATION_DRIFT_S) return false;
      if (meta.source === "local" && meta.sourceId && localRaw !== undefined) {
        const raw = String(localRaw || "");
        const now = LRCParser.looksSynced(raw) ? fnv1aHex(raw).slice(0, 8) : "";
        if (now !== meta.sourceId) return false;
      }
      return true;
    },

    globalOffset: function () {
      try {
        const raw = localStorage.getItem(GLOBAL_OFFSET_KEY);
        return clampInt(raw, -30000, 30000, 0);
      } catch (_) { return 0; }
    },

    setGlobalOffset: function (ms) {
      try { localStorage.setItem(GLOBAL_OFFSET_KEY, String(clampInt(ms, -30000, 30000, 0))); }
      catch (_) {}
    }
  };

  /* ---------------------------------------------------------------------- *
   * AudioTagReader
   *
   * Reads the title, artist and album out of the audio file itself.
   *
   * This is what makes the difference for a track ripped off YouTube. The
   * library's title is whatever the filename was — "【MV】Lemon／米津玄師
   * (Official Video) [4K]" — which is a poor thing to search a lyrics
   * database with. The file's own ID3 tags usually carry the real values,
   * "Lemon" and "米津玄師", and those find the song.
   *
   * Local and free: the bytes are already in the data URL, so this costs no
   * request. Only the first ~1 MB is decoded (ID3v2 lives at the front) plus
   * the last 128 bytes for an ID3v1 fallback, so a 20 MB song is not
   * base64-decoded in full.
   * ---------------------------------------------------------------------- */

  const TEXT_FRAMES = {
    TIT2: "title", TPE1: "artist", TALB: "album",   /* ID3v2.3 / v2.4 */
    TT2:  "title", TP1:  "artist", TAL:  "album"    /* ID3v2.2         */
  };

  const AudioTagReader = {
    /* Decode a byte range out of a base64 payload without decoding the rest.
     * Slicing on 4-char boundaries keeps every chunk valid base64. */
    _bytes: function (payload, byteOffset, byteCount) {
      const startBlock = Math.floor(byteOffset / 3);
      const endBlock = Math.min(Math.ceil(payload.length / 4),
                                Math.ceil((byteOffset + byteCount) / 3));
      if (endBlock <= startBlock) return null;
      const chunk = payload.slice(startBlock * 4, endBlock * 4);
      if (chunk.length < 4) return null;
      let bin;
      try { bin = atob(chunk); } catch (_) { return null; }
      const skip = byteOffset - startBlock * 3;
      const out = new Uint8Array(Math.max(0, Math.min(byteCount, bin.length - skip)));
      for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(skip + i) & 0xff;
      return out;
    },

    _decode: function (bytes, encoding) {
      if (!bytes || !bytes.length) return "";
      const label = encoding === 1 ? "utf-16" : encoding === 2 ? "utf-16be"
                  : encoding === 3 ? "utf-8" : "windows-1252";
      try {
        if (typeof TextDecoder !== "undefined") {
          return new TextDecoder(label, { fatal: false }).decode(bytes);
        }
      } catch (_) {}

      /* Without TextDecoder, a byte-per-char loop would turn UTF-16 into
       * "ÿþL e m o n" and UTF-8 into mojibake, so both are decoded by hand
       * rather than handed back wrong. */
      if (encoding === 1 || encoding === 2) {
        let be = encoding === 2;
        let i = 0;
        if (bytes.length >= 2) {
          if (bytes[0] === 0xff && bytes[1] === 0xfe) { be = false; i = 2; }
          else if (bytes[0] === 0xfe && bytes[1] === 0xff) { be = true; i = 2; }
        }
        let s = "";
        for (; i + 1 < bytes.length; i += 2) {
          const code = be ? (bytes[i] << 8) | bytes[i + 1] : (bytes[i + 1] << 8) | bytes[i];
          if (code === 0) break;
          s += String.fromCharCode(code);
        }
        return s;
      }
      if (encoding === 3) {
        try { return decodeURIComponent(escape(this._latin1(bytes))); }
        catch (_) { /* not valid UTF-8 after all */ }
      }
      return this._latin1(bytes);
    },

    _latin1: function (bytes) {
      let s = "";
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    },

    /* ID3v1 carries no encoding flag. Japanese taggers commonly wrote
     * Shift-JIS there, so a byte run that is not valid UTF-8 gets a second
     * reading before falling back to Latin-1. */
    _decodeLegacy: function (bytes) {
      const tryLabel = function (label) {
        try {
          if (typeof TextDecoder === "undefined") return null;
          const s = new TextDecoder(label, { fatal: true }).decode(bytes);
          return s;
        } catch (_) { return null; }
      };
      let high = false;
      for (let i = 0; i < bytes.length; i++) if (bytes[i] > 0x7f) { high = true; break; }
      if (!high) return this._decode(bytes, 0);
      return tryLabel("utf-8") || tryLabel("shift_jis") || this._decode(bytes, 0);
    },

    _clean: function (s) {
      /* ID3 text frames are NUL-padded to the frame size, and a tag whose
       * declared encoding does not match its bytes leaves U+FFFD behind.
       * Both are stripped wherever they land, not just at the end — either
       * one inside a search query poisons the query. */
      return ChatLyricsSender.sanitize(
        String(s || "").replace(/[\u0000\uFFFD]/g, "")).slice(0, 120);
    },

    _syncsafe: function (b, o) {
      return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) |
             ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
    },

    _u32: function (b, o) {
      return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
    },

    /* Returns { title, artist, album } — any field may be "". Never throws. */
    read: function (url) {
      const empty = { title: "", artist: "", album: "" };
      try {
        const u = String(url || "");
        const comma = u.indexOf(",");
        if (u.slice(0, 5) !== "data:" || comma < 0) return empty;
        if (!/;base64/i.test(u.slice(0, comma))) return empty;
        const payload = u.slice(comma + 1);
        if (payload.length < 64) return empty;

        const head = this._bytes(payload, 0, 10);
        if (head && head.length === 10 &&
            head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {   /* "ID3" */
          const major = head[3];
          const size = this._syncsafe(head, 6);
          if (size > 0 && size < 8 * 1024 * 1024) {
            const body = this._bytes(payload, 10, Math.min(size, 1024 * 1024));
            const got = this._readV2(body, major);
            if (got.title || got.artist) return got;
          }
        }

        /* ID3v1: the last 128 bytes of the file. The decoded length is not
         * payload.length/4*3 — trailing "=" padding stands for bytes that
         * are not there, and being one or two bytes out lands the read past
         * the "TAG" magic and finds nothing. */
        let total = Math.floor(payload.length / 4) * 3;
        if (payload.slice(-2) === "==") total -= 2;
        else if (payload.slice(-1) === "=") total -= 1;
        const tail = this._bytes(payload, Math.max(0, total - 128), 128);
        if (tail && tail.length >= 128 &&
            tail[0] === 0x54 && tail[1] === 0x41 && tail[2] === 0x47) {   /* "TAG" */
          return {
            title: this._clean(this._decodeLegacy(tail.subarray(3, 33))),
            artist: this._clean(this._decodeLegacy(tail.subarray(33, 63))),
            album: this._clean(this._decodeLegacy(tail.subarray(63, 93)))
          };
        }
      } catch (e) {
        warn("readTags", e);
      }
      return empty;
    },

    _readV2: function (body, major) {
      const out = { title: "", artist: "", album: "" };
      if (!body) return out;
      const idLen = major <= 2 ? 3 : 4;
      const headLen = major <= 2 ? 6 : 10;
      let p = 0;
      let guard = 0;

      while (p + headLen <= body.length && guard++ < 400) {
        if (body[p] === 0) break;                       /* padding */
        let id = "";
        for (let i = 0; i < idLen; i++) id += String.fromCharCode(body[p + i]);

        let size;
        if (major <= 2) size = (body[p + 3] << 16) | (body[p + 4] << 8) | body[p + 5];
        /* v2.4 sizes are syncsafe; v2.3 are plain. Some taggers get v2.4
         * wrong, so a size that overruns the tag is retried the other way. */
        else if (major >= 4) {
          size = this._syncsafe(body, p + 4);
          const plain = this._u32(body, p + 4);
          if (p + headLen + size > body.length && p + headLen + plain <= body.length) size = plain;
        } else size = this._u32(body, p + 4);

        if (size <= 0 || p + headLen + size > body.length) break;

        const field = TEXT_FRAMES[id];
        if (field && !out[field]) {
          const data = body.subarray(p + headLen, p + headLen + size);
          if (data.length > 1) {
            out[field] = this._clean(this._decode(data.subarray(1), data[0]));
          }
        }
        p += headLen + size;
        if (out.title && out.artist && out.album) break;
      }
      return out;
    }
  };

  /* ---------------------------------------------------------------------- *
   * SongIdentifier
   *
   * A filename is not an identity. Two files called "song.mp3" must not share
   * a lyric cache entry, and renaming a song in the library must not throw its
   * lyrics away, so the id is built from the title, the artist and a hash of
   * the audio itself.
   *
   *   songId = SHA-256(title | artist | contentHash) truncated to 32 hex
   *
   * Duration is deliberately NOT part of the id. It arrives asynchronously
   * from the audio element, so folding it in would give the same song two
   * different ids depending on whether metadata had loaded yet. It is stored
   * in metadata instead, where it does the same job better: it is what the
   * lyrics provider is asked to match against, what the validator checks the
   * timeline against, and what invalidates a cache entry when it drifts.
   * ---------------------------------------------------------------------- */

  const SongIdentifier = {
    _durationCache: new Map(),   /* url -> seconds */

    normalise: function (s) {
      let t = String(s == null ? "" : s).toLowerCase();
      try {
        /* fold accents so "cafe" and "café" compare equal */
        t = t.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      } catch (_) {}
      return t.replace(/\s+/g, " ").trim();
    },

    /* Strip the noise a downloaded filename carries so the lyrics provider is
     * searched with something close to the real track title. */
    cleanTitle: function (title) {
      let t = String(title == null ? "" : title);
      t = t.replace(/\.(mp3|ogg|wav|flac|aac|m4a)$/i, "");
      t = t.replace(/\((?:official|lyric|lyrics|audio|video|music|mv|hd|hq|4k|full)[^)]*\)/gi, " ");
      t = t.replace(/\[(?:official|lyric|lyrics|audio|video|music|mv|hd|hq|4k|full)[^\]]*\]/gi, " ");
      t = t.replace(/[\-–—]\s*(?:official|lyric|lyrics|audio|video|topic)\s*$/i, " ");
      t = t.replace(/^\s*\d{1,2}\s*[.\-)]\s+/, "");        /* leading track number */
      t = t.replace(/\s+/g, " ").trim();
      return t || String(title == null ? "" : title).trim();
    },

    /* A title like "Artist - Track" carries the artist the library never got. */
    splitArtist: function (title, artist) {
      const known = String(artist == null ? "" : artist).trim();
      if (known) return { title: title, artist: known };
      const m = title.match(/^(.{2,60}?)\s+[\-–—]\s+(.{2,80})$/);
      if (m) return { title: m[2].trim(), artist: m[1].trim() };
      return { title: title, artist: "" };
    },

    /* Content hash. A data: URL is the file itself, so it is sampled — head,
     * tail and length are enough to separate two different songs while
     * staying fast on a 20 MB base64 string. A remote URL is hashed as text,
     * since CORS means its bytes are usually not readable from here. */
    contentHash: async function (url) {
      const u = String(url == null ? "" : url);
      if (!u) return "nourl";
      if (u.slice(0, 5) === "data:") {
        const HEAD = 65536;
        const sample = u.length <= HEAD * 2
          ? u
          : u.slice(0, HEAD) + "|" + u.slice(-HEAD);
        return (await sha256Hex("d" + u.length + "|" + sample)).slice(0, 32);
      }
      return (await sha256Hex("u|" + u)).slice(0, 32);
    },

    /* Read duration without disturbing the song that is playing: a throwaway
     * element with preload="metadata", torn down as soon as it answers. */
    readDuration: function (url) {
      const self = this;
      if (this._durationCache.has(url)) return Promise.resolve(this._durationCache.get(url));
      return new Promise(function (resolve) {
        let el = null;
        let settled = false;
        const finish = function (v) {
          if (settled) return;
          settled = true;
          if (el) {
            try { el.removeAttribute("src"); el.load(); } catch (_) {}
            el = null;
          }
          if (v && isFinite(v) && v > 0) self._durationCache.set(url, v);
          resolve(v || 0);
        };
        const timer = setTimeout(function () { finish(0); }, META_TIMEOUT_MS);
        try {
          el = new Audio();
          el.preload = "metadata";
          el.muted = true;
          if (/^https?:/i.test(url)) el.crossOrigin = "anonymous";
          el.onloadedmetadata = function () {
            clearTimeout(timer);
            finish(el && isFinite(el.duration) ? el.duration : 0);
          };
          el.onerror = function () { clearTimeout(timer); finish(0); };
          el.src = url;
        } catch (e) {
          clearTimeout(timer);
          warn("readDuration", e);
          finish(0);
        }
      });
    },

    /*
     * Returns { songId, hash, title, artist, durationSec }.
     * The id is written back onto the song object and persisted through the
     * player's own _save(), so it survives reloads, export and import.
     */
    identify: async function (song, opts) {
      opts = opts || {};
      if (!song) return null;
      const mp = Host.mp;

      const cleaned = this.cleanTitle(song.title);
      const split = this.splitArtist(cleaned, song.artist);

      let songId = song.lrcId;
      let hash = song.lrcHash;
      if (!songId || !hash) {
        hash = await this.contentHash(song.url);
        songId = (await sha256Hex(
          this.normalise(split.title) + "|" + this.normalise(split.artist) + "|" + hash
        )).slice(0, 32);
        song.lrcId = songId;
        song.lrcHash = hash;
        try { mp && mp._save(); } catch (e) { warn("identify/save", e); }
      }

      /* The playing element already knows the duration; anything else needs a
       * metadata read, which only happens when the caller asks for it. */
      let durationSec = 0;
      if (mp && mp._audio && mp._songs[mp._currentIndex] === song &&
          isFinite(mp._audio.duration) && mp._audio.duration > 0) {
        durationSec = mp._audio.duration;
        this._durationCache.set(song.url, durationSec);
      } else if (opts.needDuration) {
        durationSec = await this.readDuration(song.url);
      } else {
        durationSec = this._durationCache.get(song.url) || 0;
      }

      /* Tags are read once and kept on the song, so this costs nothing on a
       * replay. They are used for searching only — never folded into songId,
       * which would re-key every song already in the cache. */
      if (song.lrcTags === undefined && opts.needTags) {
        song.lrcTags = AudioTagReader.read(song.url);
        try { mp && mp._save(); } catch (e) { warn("identify/saveTags", e); }
      }
      const tags = song.lrcTags || { title: "", artist: "", album: "" };

      return {
        songId: songId,
        hash: hash,
        title: split.title,
        artist: split.artist,
        album: song.album || "",
        durationSec: durationSec,
        tags: tags
      };
    }
  };

  /* ---------------------------------------------------------------------- *
   * LRCFetcher
   *
   * LRCLIB (lrclib.net) — a public, key-less, CORS-enabled synced-lyrics
   * database. It is already the provider the Music page's own "how to add a
   * song" guide points at for .lrc files, so this automates exactly the step
   * the user was being asked to do by hand.
   *
   *   /api/get     exact lookup; wants artist + track + duration (+-2s)
   *   /api/search  fuzzy; returns candidates to score
   *
   * Synced lyrics always win over plain. Plain is returned only so the caller
   * can report "found, but not synchronised" rather than "nothing found".
   * ---------------------------------------------------------------------- */

  const LRCLIB = "https://lrclib.net";

  const LRCFetcher = {
    _tokens: function (s) {
      return SongIdentifier.normalise(s).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    },

    /* Token overlap, 0..1. Good enough to reject a wrong match and cheap. */
    similarity: function (a, b) {
      const ta = this._tokens(a), tb = this._tokens(b);
      if (!ta.length || !tb.length) return 0;
      const set = new Set(tb);
      let hit = 0;
      for (let i = 0; i < ta.length; i++) if (set.has(ta[i])) hit++;
      return hit / Math.max(ta.length, tb.length);
    },

    score: function (cand, want) {
      const titleSim = this.similarity(cand.trackName || "", want.title);
      const artistSim = want.artist ? this.similarity(cand.artistName || "", want.artist) : 0.5;
      let s = titleSim * 0.6 + artistSim * 0.3;
      if (want.durationSec && cand.duration) {
        const d = Math.abs(cand.duration - want.durationSec);
        if (d <= 2) s += 0.15;
        else if (d <= 6) s += 0.08;
        else if (d > 20) s -= 0.25;
      }
      if (cand.syncedLyrics) s += 0.1;
      if (cand.instrumental) s -= 0.5;
      return s;
    },

    /*
     * The distinct ways this song is worth asking for, best first.
     *
     * One query is not enough. A downloaded file's library title is often
     * the filename, its artist field is often empty, and the artist is often
     * buried in the title as "Artist - Track". The file's own ID3 tags are
     * usually the cleanest of the lot, so they lead.
     */
    queries: function (want) {
      const tags = want.tags || { title: "", artist: "", album: "" };
      const out = [];
      const push = function (title, artist) {
        const t = String(title || "").trim();
        const a = String(artist || "").trim();
        if (!t || out.length >= 3) return;
        const key = (t + "|" + a).toLowerCase();
        for (let i = 0; i < out.length; i++) {
          if ((out[i].title + "|" + out[i].artist).toLowerCase() === key) return;
        }
        out.push({ title: t, artist: a, album: want.album || "", durationSec: want.durationSec });
      };
      push(tags.title, tags.artist);        /* the file's own metadata */
      push(want.title, want.artist);        /* what the library says   */
      push(tags.title, want.artist);
      push(want.title, tags.artist);
      push(want.title, "");                 /* last resort: title only */
      return out;
    },

    /*
     * Providers, tried in order by the manager. Each returns
     *   { synced, plain, source, sourceId, matchedTitle, matchedArtist,
     *     matchedDuration, score }
     * or null, and never throws — a provider that is unreachable, blocked by
     * CORS or simply has nothing is just a provider that returned null.
     */
    providers: [
      {
        /* LRCLIB — public, key-less, CORS-enabled, and the provider the
         * Music page's own guide already points at. */
        id: "lrclib",
        find: async function (want, token) {
          const F = LRCFetcher;
          const queries = F.queries(want);
          let best = null;
          let bestScore = -Infinity;

          for (let q = 0; q < queries.length; q++) {
            const want1 = queries[q];
            const attempts = [];

            /* The exact endpoint is the one that gets the right release. */
            if (want1.artist && want1.durationSec > 0) {
              const p = new URLSearchParams({
                artist_name: want1.artist,
                track_name: want1.title,
                duration: String(Math.round(want1.durationSec))
              });
              if (want1.album) p.set("album_name", want1.album);
              attempts.push({ url: LRCLIB + "/api/get?" + p.toString(), single: true });
            }
            attempts.push({
              url: LRCLIB + "/api/search?" + new URLSearchParams(
                want1.artist ? { track_name: want1.title, artist_name: want1.artist }
                             : { q: want1.title }
              ).toString(),
              single: false
            });

            for (let i = 0; i < attempts.length; i++) {
              if (token && token.cancelled) return null;
              const r = await httpJson(attempts[i].url, NET_TIMEOUT_MS);
              if (!r.ok || !r.data) continue;

              const list = attempts[i].single ? [ r.data ] : (Array.isArray(r.data) ? r.data : []);
              for (let c = 0; c < list.length && c < 20; c++) {
                const cand = list[c];
                if (!cand || typeof cand !== "object") continue;
                if (!cand.syncedLyrics && !cand.plainLyrics) continue;
                const s = attempts[i].single ? 1.5 : F.score(cand, want1);
                if (s > bestScore) { bestScore = s; best = cand; }
              }
              if (attempts[i].single && best && best.syncedLyrics) break;
            }
            /* A strong synced hit means the later query shapes are wasted
             * requests. */
            if (best && best.syncedLyrics && bestScore >= 0.75) break;
          }

          if (!best) return null;
          /* Below this the "match" is somebody else's song. */
          if (bestScore < 0.35) return null;

          return {
            synced: typeof best.syncedLyrics === "string" ? best.syncedLyrics : "",
            plain: typeof best.plainLyrics === "string" ? best.plainLyrics : "",
            source: "lrclib",
            sourceId: best.id != null ? String(best.id) : "",
            matchedTitle: String(best.trackName || ""),
            matchedArtist: String(best.artistName || ""),
            matchedDuration: Number(best.duration) || 0,
            score: bestScore
          };
        }
      },

      {
        /* NetEase Cloud Music. Its catalogue of Japanese, Korean and Chinese
         * tracks is far deeper than LRCLIB's, which is exactly where LRCLIB
         * tends to come up empty. Two requests: search, then fetch the lrc
         * for the best hit.
         *
         * `tlyric` on this API is a Chinese translation; it is ignored. The
         * original goes through this module's own translation instead, so
         * the output is English rather than a translation of a translation. */
        id: "netease",
        find: async function (want, token) {
          const F = LRCFetcher;
          const queries = F.queries(want).slice(0, 2);
          let best = null;
          let bestScore = -Infinity;

          for (let q = 0; q < queries.length; q++) {
            if (token && token.cancelled) return null;
            const want1 = queries[q];
            const r = await httpJson(
              "https://music.163.com/api/search/get?" + new URLSearchParams({
                s: (want1.title + " " + want1.artist).trim(),
                type: "1", limit: "8", offset: "0"
              }).toString(), NET_TIMEOUT_MS);
            const songs = r.ok && r.data && r.data.result && Array.isArray(r.data.result.songs)
              ? r.data.result.songs : [];

            for (let i = 0; i < songs.length && i < 8; i++) {
              const s = songs[i];
              if (!s || s.id == null) continue;
              const cand = {
                id: s.id,
                trackName: String(s.name || ""),
                artistName: (Array.isArray(s.artists) ? s.artists : [])
                  .map(function (a) { return a && a.name || ""; }).filter(Boolean).join(", "),
                duration: Math.round(Number(s.duration || 0) / 1000),
                /* NetEase lyrics are synced when they exist at all, so the
                 * candidate is scored as if it carries them. */
                syncedLyrics: "?"
              };
              const sc = F.score(cand, want1);
              if (sc > bestScore) { bestScore = sc; best = cand; }
            }
            if (best && bestScore >= 0.75) break;
          }

          if (!best || bestScore < 0.4) return null;
          if (token && token.cancelled) return null;

          const l = await httpJson("https://music.163.com/api/song/lyric?" +
            new URLSearchParams({ id: String(best.id), lv: "1", kv: "0", tv: "-1" }).toString(),
            NET_TIMEOUT_MS);
          const raw = l.ok && l.data && l.data.lrc && typeof l.data.lrc.lyric === "string"
            ? l.data.lrc.lyric : "";
          if (!raw.trim()) return null;

          return {
            synced: raw,
            plain: "",
            source: "netease",
            sourceId: String(best.id),
            matchedTitle: best.trackName,
            matchedArtist: best.artistName,
            matchedDuration: best.duration,
            score: bestScore
          };
        }
      },

      {
        /* Textyl — one request, second-resolution timings. Coarser than a
         * real .lrc, so it is last: only reached when the other two have
         * nothing, where coarse beats nothing. */
        id: "textyl",
        find: async function (want, token) {
          const q = LRCFetcher.queries(want)[0];
          if (!q) return null;
          if (token && token.cancelled) return null;

          const r = await httpJson("https://api.textyl.co/api/lyrics?q=" +
            encodeURIComponent((q.artist + " " + q.title).trim()), NET_TIMEOUT_MS);
          if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;

          const lines = [];
          for (let i = 0; i < r.data.length; i++) {
            const row = r.data[i];
            if (!row || typeof row.lyrics !== "string") continue;
            const sec = Number(row.seconds);
            if (!isFinite(sec) || sec < 0 || sec > 3 * 3600) continue;
            const text = ChatLyricsSender.sanitize(row.lyrics);
            if (!text) continue;
            lines.push("[" + LRCParser.msToTs(sec * 1000) + "]" + text);
          }
          if (lines.length < 3) return null;

          return {
            synced: lines.join("\n"),
            plain: "",
            source: "textyl",
            sourceId: "",
            matchedTitle: q.title,
            matchedArtist: q.artist,
            matchedDuration: 0,
            score: 0.5
          };
        }
      }
    ]
  };

  /* ---------------------------------------------------------------------- *
   * SyncEngine
   *
   * Owns the numeric timeline and the index into it. It does not send
   * anything and it does not run a loop — the player's existing _tickSync
   * already walks _lyrics every frame, so the engine's whole job is to make
   * sure the array that loop is reading is the right one, positioned at the
   * right place.
   *
   * Timestamps are parsed once, at prepare time. Nothing here parses, fetches
   * or serialises during playback.
   * ---------------------------------------------------------------------- */

  const SyncEngine = {
    active: null,        /* { songId, songIndex, session, lines, offsetMs, synced } */

    /* Last index whose timestamp is <= ms, or -1. O(log n). */
    indexAt: function (list, ms) {
      let lo = 0, hi = list.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid].ms <= ms) { ans = mid; lo = mid + 1; }
        else { hi = mid - 1; }
      }
      return ans;
    },

    /* Offset is applied here, never to the stored file. english.lrc keeps the
     * timestamps it was cached with; the runtime array is what moves.
     *
     * Sign follows the brief: lyrics landing 300 ms early are fixed with
     * +300 ms, so a positive offset pushes every event later. */
    buildTimeline: function (lines, offsetMs) {
      const mp = Host.mp;
      const shifted = new Array(lines.length);
      for (let i = 0; i < lines.length; i++) {
        shifted[i] = { ms: Math.max(0, lines[i].ms + offsetMs), text: lines[i].text };
      }
      shifted.sort(function (a, b) { return a.ms - b.ms; });
      /* Reuse the player's own reflow so a long line is split for the 30-char
       * chat cap exactly as a hand-pasted lyric would be. */
      try {
        if (mp && typeof mp._reflowLRC === "function") return mp._reflowLRC(shifted);
      } catch (e) { warn("reflow", e); }
      return shifted;
    },

    /* Hand a prepared song's timeline to the player and seat the index at the
     * current playback position, so a cache read that lands a moment after
     * play() does not dump the opening lines all at once. */
    activate: function (ctx) {
      const mp = Host.mp;
      if (!mp) return;
      const timeline = this.buildTimeline(ctx.lines, ctx.offsetMs);
      const nowMs = (mp._audio && isFinite(mp._audio.currentTime) ? mp._audio.currentTime : 0) * 1000;
      /* -500 mirrors the player's own "already missed it" rule in _tickSync,
       * so a line due right now still fires. */
      const seed = this.indexAt(timeline, nowMs - 500);
      ChatLyricsSender.handoff(timeline, seed);
      this.active = {
        songId: ctx.songId,
        songIndex: ctx.songIndex,
        session: ctx.session,
        lines: ctx.lines,
        offsetMs: ctx.offsetMs,
        synced: true,
        count: timeline.length
      };
    },

    /* A song change, a delete or a restart drops the session. Never let Song
     * A's lines survive into Song B. */
    reset: function () {
      this.active = null;
    },

    isActiveFor: function (songIndex, session) {
      const a = this.active;
      const mp = Host.mp;
      if (!a || !mp) return false;
      return a.songIndex === songIndex && a.session === session;
    },

    /* Offset changed while the song is playing: rebuild and re-seat, without
     * replaying anything already sent. */
    reapplyOffset: function (offsetMs) {
      const mp = Host.mp;
      const a = this.active;
      if (!mp || !a) return false;
      if (mp._songSessionId !== a.session) return false;
      a.offsetMs = offsetMs;
      const timeline = this.buildTimeline(a.lines, offsetMs);
      const nowMs = (mp._audio && isFinite(mp._audio.currentTime) ? mp._audio.currentTime : 0) * 1000;
      ChatLyricsSender.handoff(timeline, this.indexAt(timeline, nowMs - 500));
      a.count = timeline.length;
      return true;
    },

    /*
     * Called after the player's own seekTo has run. That already re-seats
     * _lyricIndex by a forward scan; this redoes it with a binary search so
     * the cost does not grow with the lyric count, and — on a real jump —
     * bumps the play session so chat chunks queued for the old position are
     * dropped instead of arriving late over the new one.
     */
    onSeek: function (beforeSec) {
      const mp = Host.mp;
      if (!mp || !mp._audio) return;
      const afterSec = isFinite(mp._audio.currentTime) ? mp._audio.currentTime : 0;
      const jumped = Math.abs(afterSec - (beforeSec || 0)) > SEEK_RESET_S;

      if (jumped && mp._lyrics && mp._lyrics.length) {
        /* _songSessionId is the player's own guard on its pending setTimeout
         * chunks. Bumping it here is what "reset on a significant seek" means
         * in this architecture; it cancels stale sends and nothing else. */
        mp._songSessionId++;
        if (this.active) this.active.session = mp._songSessionId;
      }

      if (!mp._lyrics || !mp._lyrics.length) return;
      mp._lyricIndex = this.indexAt(mp._lyrics, afterSec * 1000);
      mp._lastSentWall = jumped ? Date.now() : 0;
    }
  };

  /* ---------------------------------------------------------------------- *
   * LRCUI
   *
   * Renders into the menu iframe the player already owns. The Music page's
   * HTML and stylesheet are left untouched — the button, its styles and the
   * details panel are all created from here, so removing this module leaves
   * no trace in the page.
   *
   * Nothing here uses innerHTML with lyric or provider text. Song titles,
   * artist names and error strings come from a file downloaded off the
   * internet, and they go in through textContent only.
   * ---------------------------------------------------------------------- */

  const STATE_LABEL = {
    idle:        "LRC AI",
    identifying: "LRC AI: Loading...",
    fetching:    "LRC AI: Loading...",
    parsing:     "LRC AI: Loading...",
    translating: "LRC AI: Translating...",
    validating:  "LRC AI: Loading...",
    caching:     "LRC AI: Loading...",
    ready:       "✓ LRC",
    plain:       "LRC: no sync",
    none:        "Retry LRC",
    error:       "Retry LRC"
  };

  const STYLE_ID = "ryn-lrc-style";
  const STYLE_TEXT = [
    ".rm-lrc-btn{",
    "  flex-shrink:0;height:26px;padding:0 10px;",
    "  display:inline-flex;align-items:center;justify-content:center;",
    "  border-radius:var(--r1);border:1px solid var(--line-2);",
    "  background:rgba(255,255,255,.04);",
    "  font-family:var(--mono);font-size:10.5px;font-weight:700;",
    "  letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;",
    "  color:var(--tx-3);cursor:pointer;",
    "  transition:background 140ms var(--ease),color 140ms var(--ease),border-color 140ms var(--ease);",
    "}",
    ".rm-lrc-btn:hover{background:rgba(255,255,255,.09);color:var(--tx-1);border-color:var(--line-3);}",
    ".rm-lrc-btn.is-ready{color:var(--sage);border-color:var(--sage-40);background:var(--sage-14);}",
    ".rm-lrc-btn.is-busy{color:var(--sky);border-color:var(--sky-45);background:var(--sky-12);cursor:progress;}",
    ".rm-lrc-btn.is-plain{color:var(--iris-hi);border-color:var(--iris-45);background:var(--iris-12);}",
    ".rm-lrc-btn.is-fail{color:var(--rose);border-color:rgba(217,163,171,.4);background:var(--rose-12);}",
    "",
    ".rm-lrc-panel{",
    "  position:fixed;inset:0;z-index:9999;",
    "  display:flex;align-items:center;justify-content:center;",
    "  background:rgba(4,4,8,.66);backdrop-filter:blur(3px);",
    "}",
    ".rm-lrc-card{",
    "  width:min(520px,92vw);max-height:86vh;overflow:auto;",
    "  padding:26px 28px 22px;border-radius:var(--r3);",
    "  background:var(--ink-2);border:1px solid var(--line-2);",
    "  box-shadow:0 24px 64px rgba(0,0,0,.55);",
    "}",
    ".rm-lrc-card h3{",
    "  margin:0 0 4px;font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--tx-1);",
    "  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
    "}",
    ".rm-lrc-card .rm-lrc-sub{margin:0 0 20px;font-size:12.5px;font-weight:500;color:var(--tx-4);}",
    ".rm-lrc-kv{display:flex;justify-content:space-between;gap:18px;padding:7px 0;border-bottom:1px solid var(--line);}",
    ".rm-lrc-kv:last-of-type{border-bottom:none;}",
    ".rm-lrc-k{font-size:12px;font-weight:600;color:var(--tx-4);white-space:nowrap;}",
    ".rm-lrc-v{font-size:12.5px;font-weight:700;color:var(--tx-2);text-align:right;",
    "  overflow:hidden;text-overflow:ellipsis;}",
    ".rm-lrc-v.ok{color:var(--sage);} .rm-lrc-v.warn{color:var(--rose);} .rm-lrc-v.info{color:var(--sky);}",
    ".rm-lrc-off{display:flex;align-items:center;gap:8px;margin:18px 0 4px;}",
    ".rm-lrc-off input{",
    "  width:92px;height:34px;padding:0 10px;border-radius:var(--r1);",
    "  background:rgba(255,255,255,.05);border:1px solid var(--line-2);",
    "  color:var(--tx-1);font-family:var(--mono);font-size:12.5px;text-align:right;",
    "}",
    ".rm-lrc-off button{",
    "  height:34px;padding:0 12px;border-radius:var(--r1);",
    "  background:rgba(255,255,255,.05);border:1px solid var(--line-2);",
    "  color:var(--tx-2);font-family:var(--mono);font-size:12px;font-weight:700;cursor:pointer;",
    "}",
    ".rm-lrc-off button:hover{background:rgba(255,255,255,.1);color:var(--tx-1);}",
    ".rm-lrc-hint{margin:6px 0 0;font-size:11.5px;font-weight:500;line-height:1.6;color:var(--tx-4);}",
    ".rm-lrc-acts{display:flex;gap:9px;margin-top:22px;flex-wrap:wrap;}"
  ].join("\n");

  const LRCUI = {
    doc: function () {
      const mp = Host.mp;
      return mp && mp._frameDoc ? mp._frameDoc : null;
    },

    /* Checked against the live document rather than a flag: UI.resetFrame()
     * throws the menu iframe away and builds a new one, and the new document
     * needs its own copy of these rules. */
    injectStyle: function () {
      const doc = this.doc();
      if (!doc || doc.getElementById(STYLE_ID)) return;
      const el = doc.createElement("style");
      el.setAttribute("id", STYLE_ID);
      el.textContent = STYLE_TEXT;
      (doc.head || doc.body || doc.documentElement).appendChild(el);
    },

    /* Called after the player's own _renderSongList has rebuilt the rows. */
    decorateRows: function () {
      const mp = Host.mp;
      const doc = this.doc();
      if (!mp || !doc) return;
      this.injectStyle();

      /* One read of the metadata store paints every button; after that the
       * states live in memory and rendering touches no storage at all. */
      if (!LRCCache._warmed) {
        LRCCache.warm().then(guard("warm rerender", function () {
          try { mp._renderSongList(); } catch (e) { warn("rerender", e); }
        }));
      }

      const rows = doc.querySelectorAll("#song-list .rm-song-row");
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const icons = row.querySelector(".rm-s-icons");
        if (!icons || row.querySelector(".rm-lrc-btn")) continue;

        /* The player stamps the library index (1-based) on the number cell,
         * so read it back from there rather than re-deriving the filter. The
         * title is checked against the row as well: if the two ever disagree
         * the row gets no button, instead of a button wired to the wrong
         * song. */
        const numEl = row.querySelector(".rm-snum");
        const idx = numEl ? parseInt(numEl.textContent, 10) - 1 : -1;
        const song = mp._songs[idx];
        if (!song) continue;
        const titleEl = row.querySelector(".rm-stitle");
        if (titleEl && String(song.title || "").trim() &&
            titleEl.textContent.indexOf(String(song.title).trim()) !== 0) continue;

        const btn = doc.createElement("span");
        btn.className = "rm-lrc-btn";
        btn.setAttribute("data-lrc-index", String(idx));
        btn.onclick = guard("lrc button", function (e) {
          e.stopPropagation();
          LRCUI.onClick(idx);
        });
        row.insertBefore(btn, icons);
        this.paint(idx);
      }
    },

    /* Current display state for a song, from memory only. */
    stateOf: function (song) {
      if (!song) return { state: "idle", meta: null };
      const live = LRCManager.progress.get(song.lrcId || ("i:" + song.title));
      if (live) return { state: live.state, meta: null, note: live.note };
      const meta = LRCCache.getMetaSync(song.lrcId);
      if (!meta) return { state: "idle", meta: null };
      if (meta.status === "ready") return { state: "ready", meta: meta };
      if (meta.status === "plain") return { state: "plain", meta: meta };
      return { state: meta.status === "error" ? "error" : "none", meta: meta };
    },

    paint: function (index) {
      const mp = Host.mp;
      const doc = this.doc();
      if (!mp || !doc) return;
      const btn = doc.querySelector('#song-list .rm-lrc-btn[data-lrc-index="' + index + '"]');
      if (!btn) return;
      const song = mp._songs[index];
      const st = this.stateOf(song);

      btn.textContent = STATE_LABEL[st.state] || STATE_LABEL.idle;
      btn.classList.remove("is-ready", "is-busy", "is-plain", "is-fail");
      if (st.state === "ready") btn.classList.add("is-ready");
      else if (st.state === "plain") btn.classList.add("is-plain");
      else if (st.state === "none" || st.state === "error") btn.classList.add("is-fail");
      else if (st.state !== "idle") btn.classList.add("is-busy");

      let title = "Find and cache English lyrics for this song";
      if (st.state === "ready" && st.meta) {
        title = st.meta.lineCount + " lines · " +
          LanguageDetector.name(st.meta.language) +
          (st.meta.language === "en" ? "" : " → English") +
          " · click for details";
      } else if (st.state === "plain") {
        title = "Lyrics found — synchronisation unavailable";
      } else if (st.state === "none" || st.state === "error") {
        title = (st.meta && st.meta.note) || "No synchronised lyrics found — click to retry";
      } else if (st.note) {
        title = st.note;
      }
      btn.title = title;
    },

    repaintAll: function () {
      const mp = Host.mp;
      const doc = this.doc();
      if (!mp || !doc) return;
      const btns = doc.querySelectorAll("#song-list .rm-lrc-btn");
      for (let i = 0; i < btns.length; i++) {
        this.paint(parseInt(btns[i].getAttribute("data-lrc-index"), 10));
      }
    },

    onClick: function (index) {
      const mp = Host.mp;
      const song = mp && mp._songs[index];
      if (!song) return;
      const st = this.stateOf(song);
      if (st.state === "ready" || st.state === "plain") { fire(this.openPanel(index), "openPanel"); return; }
      if (st.state === "idle" || st.state === "none" || st.state === "error") {
        fire(LRCManager.prepare(index, { force: st.state !== "idle" }), "prepare");
      }
      /* A button already mid-pipeline is left alone. */
    },

    toast: function (msg) {
      const mp = Host.mp;
      try { mp && mp._toast && mp._toast(msg); } catch (e) { warn("toast", e); }
    },

    /* -- details panel ---------------------------------------------------- */

    closePanel: function () {
      const doc = this.doc();
      if (!doc) return;
      const old = doc.getElementById("rm-lrc-panel");
      if (old && old.parentNode) old.parentNode.removeChild(old);
    },

    kv: function (doc, parent, key, value, cls) {
      const row = doc.createElement("div");
      row.className = "rm-lrc-kv";
      const k = doc.createElement("span");
      k.className = "rm-lrc-k";
      k.textContent = key;
      const v = doc.createElement("span");
      v.className = "rm-lrc-v" + (cls ? " " + cls : "");
      v.textContent = value;                       /* never innerHTML */
      row.appendChild(k);
      row.appendChild(v);
      parent.appendChild(row);
      return v;
    },

    openPanel: async function (index) {
      const mp = Host.mp;
      const doc = this.doc();
      if (!mp || !doc) return;
      const song = mp._songs[index];
      if (!song) return;
      const meta = await LRCCache.getMeta(song.lrcId);
      if (!meta) { this.toast("No cached lyrics for this song"); return; }

      this.injectStyle();
      this.closePanel();

      const wrap = doc.createElement("div");
      wrap.className = "rm-lrc-panel";
      wrap.id = "rm-lrc-panel";
      wrap.onclick = function (e) { if (e.target === wrap) LRCUI.closePanel(); };

      const card = doc.createElement("div");
      card.className = "rm-lrc-card";

      const h = doc.createElement("h3");
      h.textContent = meta.title || song.title || "Untitled";
      card.appendChild(h);

      const sub = doc.createElement("p");
      sub.className = "rm-lrc-sub";
      sub.textContent = meta.artist || song.artist || "Unknown artist";
      card.appendChild(sub);

      const synced = meta.status === "ready";
      this.kv(doc, card, "Source language",
        LanguageDetector.name(meta.language) + (meta.languageSource ? " (" + meta.languageSource + ")" : ""));
      this.kv(doc, card, "Translation",
        meta.language === "en" ? "not needed — already English"
                               : "English" + (meta.provider ? " via " + meta.provider : ""),
        meta.language === "en" ? "" : "info");
      this.kv(doc, card, "Lyric lines", String(meta.lineCount || 0));
      this.kv(doc, card, "Sync status",
        synced ? "synchronised" : "found, synchronisation unavailable",
        synced ? "ok" : "warn");
      this.kv(doc, card, "Duration", fmtClock(meta.durationSec));
      this.kv(doc, card, "Lyrics source",
        (meta.source || "unknown") + (meta.sourceId ? " #" + meta.sourceId : ""));
      this.kv(doc, card, "Cache", "stored · v" + meta.version + " · " +
        (meta.lastUpdate ? String(meta.lastUpdate).slice(0, 10) : "unknown"), "ok");
      this.kv(doc, card, "Song ID", String(meta.songId || "").slice(0, 16) + "…");
      const chatV = this.kv(doc, card, "Chat sync",
        ChatLyricsSender.chatSyncActive() ? "on" : "off — enable it under Chat sync",
        ChatLyricsSender.chatSyncActive() ? "ok" : "warn");
      if (chatV) chatV.title = "Lyrics load automatically; sending them to chat stays your choice.";

      if (synced) {
        const offWrap = doc.createElement("div");
        offWrap.className = "rm-lrc-off";

        const label = doc.createElement("span");
        label.className = "rm-lrc-k";
        label.textContent = "LRC offset";
        offWrap.appendChild(label);

        const minus = doc.createElement("button");
        minus.textContent = "−250";
        const input = doc.createElement("input");
        input.type = "number";
        input.step = "50";
        input.value = String(meta.offsetMs || 0);
        const plus = doc.createElement("button");
        plus.textContent = "+250";
        const zero = doc.createElement("button");
        zero.textContent = "0";

        const commit = guard("offset commit", function (v) {
          const ms = clampInt(v, -30000, 30000, 0);
          input.value = String(ms);
          fire(LRCManager.setOffset(song, ms), "setOffset");
        });
        minus.onclick = function () { commit(parseInt(input.value, 10) - 250); };
        plus.onclick = function () { commit(parseInt(input.value, 10) + 250); };
        zero.onclick = function () { commit(0); };
        input.onchange = function () { commit(input.value); };

        offWrap.appendChild(minus);
        offWrap.appendChild(input);
        offWrap.appendChild(plus);
        offWrap.appendChild(zero);
        card.appendChild(offWrap);

        const hint = doc.createElement("p");
        hint.className = "rm-lrc-hint";
        hint.textContent = "Lyrics arriving early? Raise the offset. Arriving late? Lower it. " +
          "The cached .lrc keeps its original timestamps — the offset is applied as the " +
          "song plays, and takes effect immediately.";
        card.appendChild(hint);

        const gHint = doc.createElement("p");
        gHint.className = "rm-lrc-hint";
        gHint.textContent = "Global offset: " + LRCCache.globalOffset() +
          " ms, added to every song on top of this one.";
        card.appendChild(gHint);
      } else if (meta.note) {
        const note = doc.createElement("p");
        note.className = "rm-lrc-hint";
        note.textContent = meta.note;
        card.appendChild(note);
      }

      const acts = doc.createElement("div");
      acts.className = "rm-lrc-acts";

      const refetch = doc.createElement("button");
      refetch.className = "option-button";
      refetch.textContent = "Re-fetch";
      refetch.onclick = guard("refetch", function () {
        LRCUI.closePanel();
        fire(LRCManager.prepare(index, { force: true }), "prepare");
      });

      const clear = doc.createElement("button");
      clear.className = "option-button";
      clear.textContent = "Clear cache";
      clear.onclick = guard("clear cache", function () {
        LRCUI.closePanel();
        fire(LRCManager.clear(index), "clear");
      });

      const close = doc.createElement("button");
      close.className = "option-button";
      close.textContent = "Close";
      close.onclick = function () { LRCUI.closePanel(); };

      acts.appendChild(refetch);
      acts.appendChild(clear);
      acts.appendChild(close);
      card.appendChild(acts);

      wrap.appendChild(card);
      (doc.body || doc.documentElement).appendChild(wrap);
    }
  };

  /* ---------------------------------------------------------------------- *
   * LRCManager
   *
   * The pipeline behind one press of [LRC AI], and the cache-only lookup
   * behind every press of Play.
   *
   *   identify -> cache hit? -> fetch -> parse -> validate -> detect
   *            -> translate -> validate -> cache -> "Ready"
   *
   * Failure is a state, not an exception: every step that can fail writes a
   * cache entry saying so, which is what stops the module retrying by itself.
   * Only the button asks again.
   * ---------------------------------------------------------------------- */

  const LRCManager = {
    progress: new Map(),      /* songId -> { state, note } while a run is live */
    _running: new Map(),      /* songId -> token, so one song runs once        */

    /* A run starts before the song has an id and finishes after it has one,
     * so both keys are cleared on the way out. */
    _setState: function (song, index, state, note) {
      const pre = "i:" + song.title;
      const key = song.lrcId || pre;
      if (state === null) {
        this.progress.delete(key);
        this.progress.delete(pre);
      } else {
        this.progress.set(key, { state: state, note: note || "" });
      }
      try { LRCUI.paint(index); } catch (e) { warn("paint", e); }
    },

    /* What the playback engine actually shifts timestamps by:
     *   per-song calibration + the global one, minus the file's own [offset:]
     * tag, which the LRC spec says shifts lyrics earlier by that many ms. */
    effectiveOffset: function (meta) {
      if (!meta) return LRCCache.globalOffset();
      return (meta.offsetMs || 0) + LRCCache.globalOffset() - (meta.fileOffsetMs || 0);
    },

    /* ---- the prepare pipeline ---- */

    prepare: async function (index, opts) {
      opts = opts || {};
      const mp = Host.mp;
      if (!mp) return;
      const song = mp._songs[index];
      if (!song) return;

      const preKey = song.lrcId || ("i:" + song.title);
      if (this._running.has(preKey)) return;                 /* already working */
      const token = { cancelled: false };
      this._running.set(preKey, token);

      try {
        await this._run(song, index, opts, token);
      } catch (e) {
        warn("prepare", e);
        this._setState(song, index, null);
        await this._writeFailure(song, index, "error", "Preparation failed: " + (e && e.message || e));
      } finally {
        this._running.delete(preKey);
        if (song.lrcId) this._running.delete(song.lrcId);
      }
    },

    _run: async function (song, index, opts, token) {
      const mp = Host.mp;

      /* 1-4. Identify: title, artist, metadata, duration, stable identity. */
      this._setState(song, index, "identifying");
      const id = await SongIdentifier.identify(song, { needDuration: true, needTags: true });
      if (!id) { this._setState(song, index, null); return; }
      /* Re-key the run now that the id exists. */
      this._running.set(id.songId, token);

      /* 5. Cache first. A prepared song is never fetched or translated twice
       *    unless the user explicitly asked to re-fetch. */
      if (!opts.force) {
        const cached = await LRCCache.getMeta(id.songId);
        if (LRCCache.isUsable(cached, id.durationSec, song.lyrics)) {
          this._setState(song, index, null);
          LRCUI.paint(index);
          LRCUI.toast(cached.status === "ready" ? "✓ LRC Ready (cached)" : "Cached lyrics are not synced");
          this._maybeActivate(index);
          return;
        }
        /* A remembered failure is also a cache hit. Without this the module
         * would go back to the network every time the song list was touched,
         * which is exactly the retry loop the brief rules out — only the
         * Retry button, which passes force, gets to ask again. */
        if (cached && cached.version === CACHE_VERSION &&
            (cached.status === "none" || cached.status === "error")) {
          this._setState(song, index, null);
          LRCUI.toast(cached.status === "none" ? "No synchronised lyrics found" : "LRC unavailable");
          return;
        }
      }

      /* 6-8. Source the lyrics, then parse and validate what came back.
       *
       * A synced .lrc the user already pasted into the song comes first: it
       * is already here, it costs no network, and they chose it deliberately.
       * LRCLIB is the fallback — and also the second chance if the pasted
       * file turns out not to match this audio.
       *
       * This is the point of the whole feature for a song whose only .lrc is
       * in another language: paste it, press the button, get it in English
       * with its timestamps untouched. */
      const localRaw = String(song.lyrics || "");
      const sources = [];
      if (LRCParser.looksSynced(localRaw)) {
        sources.push({
          busy: "parsing",
          get: function () {
            return Promise.resolve({
              synced: localRaw,
              plain: "",
              source: "local",
              sourceId: fnv1aHex(localRaw).slice(0, 8),
              matchedTitle: id.title,
              matchedArtist: id.artist,
              matchedDuration: id.durationSec,
              score: 1
            });
          }
        });
      }
      /* Then every lyrics provider, in order. Each is validated on its own,
       * so a provider that answers with the wrong release falls through to
       * the next instead of ending the run. */
      const want = {
        title: id.title,
        artist: id.artist,
        album: id.album,
        durationSec: id.durationSec,
        tags: id.tags || { title: "", artist: "", album: "" }
      };
      LRCFetcher.providers.forEach(function (prov) {
        sources.push({
          busy: "fetching",
          get: function () { return prov.find(want, token); }
        });
      });

      let found = null;       /* the source that validated */
      let parsed = null;      /* its parsed lines */
      let plainOnly = null;   /* unsynced lyrics, kept only as a last resort */
      let lastReason = "";    /* why the previous candidate was rejected */

      for (let s = 0; s < sources.length && !parsed; s++) {
        this._setState(song, index, sources[s].busy);
        const cand = await sources[s].get();
        if (token.cancelled) { this._setState(song, index, null); return; }
        if (!cand || (!cand.synced && !cand.plain)) continue;

        if (!cand.synced || !LRCParser.looksSynced(cand.synced)) {
          if (!plainOnly) plainOnly = cand;
          continue;
        }
        const p = LRCParser.parse(cand.synced);
        const c = LRCValidator.validateParsed(p, { durationSec: id.durationSec });
        if (c.ok) { found = cand; parsed = p; }
        else lastReason = c.reason;
      }

      /* Plain lyrics only: recorded, labelled honestly, never faked into a
       * timeline. A synchronisation engine could be added later without
       * touching anything else here. */
      if (!parsed && plainOnly) {
        await this._writeResult(song, index, id, {
          status: "plain",
          language: LanguageDetector.detect(
            String(plainOnly.plain).split("\n").map(function (t) { return { text: t }; })
          ).lang,
          languageSource: "detector",
          originalLrc: String(plainOnly.plain || "").slice(0, 200000),
          englishLrc: "",
          lineCount: String(plainOnly.plain || "").split("\n").filter(function (l) { return l.trim(); }).length,
          note: "Lyrics found — synchronisation unavailable.",
          found: plainOnly
        });
        this._setState(song, index, null);
        LRCUI.toast("Lyrics found — sync unavailable");
        return;
      }

      if (!parsed) {
        this._setState(song, index, null);
        if (lastReason) {
          await this._writeFailure(song, index, "error", "LRC unavailable: " + lastReason);
          LRCUI.toast("LRC unavailable");
        } else {
          await this._writeFailure(song, index, "none",
            "No synchronised lyrics found for this title and artist.");
          LRCUI.toast("No synchronised lyrics found");
        }
        return;
      }

      /* 9. Detect the language. No user choice, no manual step. */
      let det = LanguageDetector.detect(parsed.lines);
      let languageSource = "detector";
      if (det.lang === "und" || det.confidence < 0.55) {
        const probe = await TranslationManager.probeLanguage(parsed.lines[0].text);
        if (probe.lang) {
          det = { lang: probe.lang.split("-")[0], confidence: 0.9 };
          languageSource = probe.provider;
        }
      }
      if (token.cancelled) { this._setState(song, index, null); return; }

      /* 10-12. Translate when needed. Timestamps are carried across
       *        untouched: only the `text` field of each line changes. */
      let english = parsed.lines;
      let provider = "";
      let failedLines = 0;

      if (det.lang !== "en") {
        this._setState(song, index, "translating");
        const originals = parsed.lines.map(function (l) { return l.text; });
        const tr = await TranslationManager.translateLines(
          originals,
          det.lang === "und" ? "auto" : det.lang,
          guard("translate progress", function (done, total) {
            LRCManager._setState(song, index, "translating",
              "Translating " + done + "/" + total + " lines");
          }),
          token
        );
        if (token.cancelled) { this._setState(song, index, null); return; }

        if (!tr.provider) {
          this._setState(song, index, null);
          await this._writeFailure(song, index, "error",
            "Lyrics found in " + LanguageDetector.name(det.lang) +
            " but no translation service could be reached.");
          LRCUI.toast("Translation unavailable");
          return;
        }
        provider = tr.provider;
        failedLines = tr.failed;
        english = parsed.lines.map(function (l, i) {
          return { ms: l.ms, ts: l.ts, text: tr.texts[i] };   /* ms and ts untouched */
        });
      }

      /* 13. Validate the translation against the original event for event. */
      this._setState(song, index, "validating");
      const tcheck = LRCValidator.validateTranslation(parsed.lines, english);
      if (!tcheck.ok) {
        this._setState(song, index, null);
        await this._writeFailure(song, index, "error", "LRC unavailable: " + tcheck.reason);
        LRCUI.toast("LRC unavailable");
        return;
      }

      /* 14. Cache: metadata.json + original.lrc + english.lrc. */
      this._setState(song, index, "caching");
      const header = {
        ti: id.title,
        ar: id.artist || found.matchedArtist,
        al: id.album,
        by: "Ryn LRC AI",
        length: fmtClock(id.durationSec)
      };
      await this._writeResult(song, index, id, {
        status: "ready",
        language: det.lang,
        languageSource: languageSource,
        originalLrc: LRCParser.format(parsed.lines, header),
        englishLrc: LRCParser.format(english, header),
        lineCount: english.length,
        fileOffsetMs: parsed.meta.offset || 0,
        provider: provider,
        untranslated: failedLines,
        note: failedLines
          ? failedLines + " line(s) kept their original words — translation failed for those."
          : "",
        found: found
      });

      /* 15. Ready. */
      this._setState(song, index, null);
      LRCUI.toast("✓ LRC Ready");
      this._maybeActivate(index);
    },

    /* ---- cache writes ---- */

    _writeResult: async function (song, index, id, r) {
      const meta = {
        songId: id.songId,
        version: CACHE_VERSION,
        title: id.title,
        artist: id.artist || (r.found && r.found.matchedArtist) || "",
        album: id.album || "",
        durationSec: Math.round(id.durationSec || 0),
        hash: id.hash,
        language: r.language || "und",
        languageSource: r.languageSource || "",
        translation: "en",
        status: r.status,
        offsetMs: 0,
        lastUpdate: nowIso(),
        source: (r.found && r.found.source) || "",
        sourceId: (r.found && r.found.sourceId) || "",
        matchedTitle: (r.found && r.found.matchedTitle) || "",
        matchedArtist: (r.found && r.found.matchedArtist) || "",
        lineCount: r.lineCount || 0,
        fileOffsetMs: r.fileOffsetMs || 0,
        provider: r.provider || "",
        untranslated: r.untranslated || 0,
        note: r.note || ""
      };
      /* Keep any offset the user had already dialled in for this song. */
      const prev = await LRCCache.getMeta(id.songId);
      if (prev && typeof prev.offsetMs === "number") meta.offsetMs = prev.offsetMs;

      await LRCCache.put(id.songId, meta, {
        songId: id.songId,
        originalLrc: r.originalLrc || "",
        englishLrc: r.englishLrc || r.originalLrc || ""
      });
      LRCUI.paint(index);
    },

    /* A failure is cached too. That is what "do not continuously retry"
     * means: the state persists, and only the button clears it. */
    _writeFailure: async function (song, index, status, note) {
      const songId = song.lrcId;
      if (!songId) { LRCUI.paint(index); return; }
      const prev = await LRCCache.getMeta(songId);
      const meta = {
        songId: songId,
        version: CACHE_VERSION,
        title: SongIdentifier.cleanTitle(song.title),
        artist: song.artist || "",
        album: song.album || "",
        durationSec: prev ? prev.durationSec : 0,
        hash: song.lrcHash || "",
        language: "und",
        translation: "en",
        status: status,
        offsetMs: prev && typeof prev.offsetMs === "number" ? prev.offsetMs : 0,
        lastUpdate: nowIso(),
        source: "",
        sourceId: "",
        lineCount: 0,
        provider: "",
        note: note || ""
      };
      await LRCCache.put(songId, meta, null);
      LRCUI.paint(index);
    },

    clear: async function (index) {
      const mp = Host.mp;
      const song = mp && mp._songs[index];
      if (!song || !song.lrcId) return;
      const wasActive = SyncEngine.active && SyncEngine.active.songId === song.lrcId;
      await LRCCache.remove(song.lrcId);
      if (wasActive) {
        SyncEngine.reset();
        /* Hand playback back to whatever the song itself carried. */
        try { mp._lyrics = mp._parseLRC(song.lyrics || ""); mp._lyricIndex = -1; }
        catch (e) { warn("clear/restore", e); }
      }
      LRCUI.paint(index);
      LRCUI.toast("Cache cleared");
    },

    setOffset: async function (song, ms) {
      if (!song || !song.lrcId) return;
      const meta = await LRCCache.getMeta(song.lrcId);
      if (!meta) return;
      meta.offsetMs = ms;
      meta.lastUpdate = nowIso();
      await LRCCache.put(song.lrcId, meta, null);
      /* Live songs pick the change up on the next line, with no replay. */
      if (SyncEngine.active && SyncEngine.active.songId === song.lrcId) {
        SyncEngine.reapplyOffset(this.effectiveOffset(meta));
      }
      LRCUI.toast("Offset " + (ms > 0 ? "+" : "") + ms + " ms");
    },

    /* ---- playback ---- */

    /*
     * Play was pressed. Cache only: no fetch, no parse of anything that was
     * not already parsed, no translation, no network. If there is nothing
     * cached the player keeps whatever lyrics the song itself carried, which
     * is the pre-existing behaviour.
     */
    onSongStart: async function (index) {
      const mp = Host.mp;
      if (!mp) return;
      SyncEngine.reset();

      const song = mp._songs[index];
      if (!song) return;
      const session = mp._songSessionId;

      /* An unidentified song is identified in the background so its button
       * and its cache entry line up, but that never blocks playback. */
      const id = await SongIdentifier.identify(song, { needDuration: false });
      if (!id) return;
      if (mp._songSessionId !== session || mp._currentIndex !== index) return;   /* song changed */

      const meta = await LRCCache.getMeta(id.songId);
      if (mp._songSessionId !== session || mp._currentIndex !== index) return;
      if (!meta || meta.status !== "ready") { LRCUI.paint(index); return; }

      const liveDur = mp._audio && isFinite(mp._audio.duration) ? mp._audio.duration : 0;
      if (!LRCCache.isUsable(meta, liveDur, song.lyrics)) {
        /* The audio behind this id changed length; the cached timeline is no
         * longer the right one for it. */
        LRCUI.paint(index);
        return;
      }

      const rec = await LRCCache.getLrc(id.songId);
      if (mp._songSessionId !== session || mp._currentIndex !== index) return;
      if (!rec || !rec.englishLrc) { LRCUI.paint(index); return; }

      const parsed = LRCParser.parse(rec.englishLrc);
      if (!parsed.lines.length) { LRCUI.paint(index); return; }

      SyncEngine.activate({
        songId: id.songId,
        songIndex: index,
        session: session,
        lines: parsed.lines,
        offsetMs: this.effectiveOffset(meta)
      });
      LRCUI.paint(index);
    },

    /* Used after a prepare finishes while that same song is already playing. */
    _maybeActivate: function (index) {
      const mp = Host.mp;
      if (!mp || mp._currentIndex !== index) return;
      fire(this.onSongStart(index), "reactivate");
    }
  };

  /* ---------------------------------------------------------------------- *
   * attach
   *
   * Four wrappers, no rewrites. Each calls the original first and then adds
   * the lyric behaviour, inside a guard, so the player's own logic runs
   * exactly as it did before this module existed.
   * ---------------------------------------------------------------------- */

  function attach(mp) {
    if (!mp || mp.__rynLrcAttached) return false;
    mp.__rynLrcAttached = true;
    Host.mp = mp;

    /* play(): a new song, a loop restart or a next/prev all land here, and
     * the player has already bumped _songSessionId and reset its index by
     * the time the wrapper runs. */
    const origPlay = mp.play;
    mp.play = function (index) {
      const r = origPlay.call(this, index);
      try { fire(LRCManager.onSongStart(index), "onSongStart"); } catch (e) { warn("play hook", e); }
      return r;
    };

    /* seekTo(): the position before the seek is only readable before the
     * original runs, so it is captured here. */
    const origSeek = mp.seekTo;
    mp.seekTo = function (pct) {
      let before = 0;
      try { before = this._audio && isFinite(this._audio.currentTime) ? this._audio.currentTime : 0; }
      catch (_) {}
      const r = origSeek.call(this, pct);
      try { SyncEngine.onSeek(before); } catch (e) { warn("seek hook", e); }
      return r;
    };

    /* _renderSongList(): rows are rebuilt from scratch each time, so the
     * buttons are re-added each time too. */
    const origRender = mp._renderSongList;
    mp._renderSongList = function () {
      const r = origRender.call(this);
      try { LRCUI.decorateRows(); } catch (e) { warn("render hook", e); }
      return r;
    };

    /* _save() runs after every library mutation, including a delete — and a
     * delete shifts every index after it. Re-check that the song the engine
     * is synchronising is still the one playing, by id rather than by index,
     * so Song A's lines can never survive into Song B. */
    const origSave = mp._save;
    mp._save = function () {
      const r = origSave.call(this);
      try {
        const a = SyncEngine.active;
        if (a) {
          const cur = this._songs[this._currentIndex];
          if (!cur || cur.lrcId !== a.songId) SyncEngine.reset();
          else a.songIndex = this._currentIndex;
        }
      } catch (e) { warn("save hook", e); }
      return r;
    };

    return true;
  }

  return {
    attach: attach,
    /* Exposed for the details panel, the console and any later module. */
    Manager: LRCManager,
    Cache: LRCCache,
    Parser: LRCParser,
    Detector: LanguageDetector,
    Translator: TranslationManager,
    Validator: LRCValidator,
    Identifier: SongIdentifier,
    Tags: AudioTagReader,
    Fetcher: LRCFetcher,
    Sync: SyncEngine,
    UI: LRCUI,
    version: CACHE_VERSION
  };
})();

/* Wire it up. MusicPlayer is defined immediately above this block, and its
 * init() runs later when the menu iframe is built, so the wrappers are in
 * place well before the first render or the first play. */
try {
  RynLRC.attach(MusicPlayer);
} catch (e) {
  try { console.warn("[RynLRC] attach failed:", e); } catch (_) {}
}
