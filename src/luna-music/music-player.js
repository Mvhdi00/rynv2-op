/* ============================================================================
 * LUNA — MUSIC PAGE
 *
 * Ryn Type 2's Music page, ported into Luna's menu: a local song library that
 * plays inside the client and can type an .lrc file's lines into chat as the
 * song reaches them.
 *
 * Carried over from Ryn as-is: the now-playing card, transport, seek bar and
 * volume, the library with like / save / delete and its filter chips, the Add
 * song form with the .lrc guide, chat sync with a manual delay, Test chat,
 * Send All Lyrics, the debug log, and JSON backup / restore. Line reflow for
 * the 30-character chat cap and the 1500 ms / 2200 ms send spacing are Ryn's
 * own numbers.
 *
 * LRC AI — finding, translating and caching each song's lyrics — is its own
 * module (lrc-ai.js) and attaches to this player through the hooks marked
 * below; the player works on its own without it.
 *
 * Left out on purpose: the bot sync modes (mixed / bots only / unified / sync
 * bot) — there is one chat sync and it is yours — and albums. A Ryn backup
 * still imports; album tags on its songs are dropped.
 *
 * The page talks to the game only through window.__lunaMusicChat, which the
 * build exports from inside app.js next to Luna's other window exports.
 * ========================================================================== */

const LunaMusic = (function () {
  "use strict";

  const CSS = __LUNA_MUSIC_CSS__;
  const HTML = __LUNA_MUSIC_HTML__;

  const CHAT_MAX = 30;          /* the server cuts chat at 30 characters */
  const MIN_GAP_MS = 1500;      /* never two synced lines closer than this */
  const CHUNK_GAP_MS = 2200;    /* spacing between the parts of one long line */
  const SEND_ALL_GAP_MS = 2300; /* spacing for Send All Lyrics */
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const DEBUG_LINES = 200;

  /* The game side of the page. Every call is guarded: the menu can be open
   * before app.js has exported the bridge, and a missing bridge must read as
   * "not connected", not throw. */
  const Chat = {
    bridge() {
      return window.__lunaMusicChat || null;
    },
    status() {
      const b = this.bridge();
      if (!b) return { socket: "NO_SOCKET", handshake: false, inGame: false };
      try {
        return b.status();
      } catch (_) {
        return { socket: "NO_SOCKET", handshake: false, inGame: false };
      }
    },
    send(text) {
      const b = this.bridge();
      if (!b) return false;
      try {
        return b.send(text) === true;
      } catch (_) {
        return false;
      }
    },
    ping() {
      const b = this.bridge();
      try {
        const p = b ? Number(b.ping()) : 0;
        return isFinite(p) && p > 0 ? Math.min(p, 1000) : 0;
      } catch (_) {
        return 0;
      }
    }
  };

  /* Fallback store for the page's own preferences when mount() is not handed
   * Luna's config. */
  const MemoryPrefs = {
    _v: {},
    get(k, d) { return k in this._v ? this._v[k] : d; },
    set(k, v) { this._v[k] = v; }
  };

  const MusicPlayer = new class {
    _songs = [];
    _currentIndex = -1;
    _loop = false;
    _shuffle = false;
    _chatSync = false;
    _syncDelay = 0;
    _autoDelay = true;
    _volume = 0.7;
    _root = null;
    _prefs = MemoryPrefs;
    _audio = null;
    _lyrics = [];
    _lyricIndex = -1;
    _lastSentWall = 0;
    _rafId = null;
    _songSessionId = 0;  /* bumped by play, stop and seek: drops queued chat parts */
    _playGen = 0;        /* bumped by play and stop only: "is this still the same song?" */
    _dbgLines = [];
    _db = null;
    _DB_NAME = "LunaMusicDB";
    _DB_VERSION = 1;
    _DB_STORE = "musicData";
    _storageKey = "luna_music_data";

    _q(sel) {
      return this._root ? this._root.querySelector(sel) : null;
    }

    /* ---------------------------------------------------------------- *
     * Storage: IndexedDB, falling back to localStorage
     * ---------------------------------------------------------------- */

    _openDB() {
      return new Promise((resolve, reject) => {
        if (this._db) {
          resolve(this._db);
          return;
        }
        if (typeof indexedDB === "undefined") {
          reject(new Error("no indexedDB"));
          return;
        }
        const req = indexedDB.open(this._DB_NAME, this._DB_VERSION);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this._DB_STORE)) db.createObjectStore(this._DB_STORE);
        };
        req.onsuccess = e => {
          this._db = e.target.result;
          resolve(this._db);
        };
        req.onerror = e => reject(e);
      });
    }
    _saveLocal(data) {
      try {
        localStorage.setItem(this._storageKey, JSON.stringify(data));
      } catch (_) {
        this._toast("⚠ Could not save the library", true);
      }
    }
    _save() {
      const data = { songs: this._songs };
      this._openDB().then(db => {
        const tx = db.transaction(this._DB_STORE, "readwrite");
        tx.objectStore(this._DB_STORE).put(data, this._storageKey);
        tx.onerror = () => this._saveLocal(data);
      }).catch(() => this._saveLocal(data));
    }
    _normalizeSong(s) {
      if (!s || typeof s !== "object") return null;
      if (typeof s.title !== "string" || !s.title.trim()) return null;
      if (typeof s.url !== "string" || !s.url) return null;
      const out = {
        title: s.title.trim().slice(0, 50),
        artist: typeof s.artist === "string" ? s.artist.trim().slice(0, 30) : "",
        url: s.url,
        lyrics: typeof s.lyrics === "string" ? s.lyrics : "",
        liked: !!s.liked,
        saved: !!s.saved
      };
      /* LRC AI's identity for the song, so its cached lyrics are found again
       * without re-hashing the audio. */
      if (typeof s.lrcId === "string" && /^[0-9a-f]{32}$/.test(s.lrcId)) out.lrcId = s.lrcId;
      if (typeof s.lrcHash === "string" && /^[0-9a-f]{32}$/.test(s.lrcHash)) out.lrcHash = s.lrcHash;
      if (s.lrcTags && typeof s.lrcTags === "object") {
        const t = s.lrcTags;
        out.lrcTags = {
          title: typeof t.title === "string" ? t.title.slice(0, 120) : "",
          artist: typeof t.artist === "string" ? t.artist.slice(0, 120) : "",
          album: typeof t.album === "string" ? t.album.slice(0, 120) : ""
        };
      }
      return out;
    }

    /* Hooks for LRC AI (lrc-ai.js wraps these). No-ops on their own. */
    _songAdded(index) {}
    _lyricsEdited(index) {}
    _initExtras(root) {}
    _applyData(data) {
      const songs = data && Array.isArray(data.songs) ? data.songs : [];
      this._songs = songs.map(s => this._normalizeSong(s)).filter(Boolean);
      this._renderAll();
    }
    _load() {
      const fromLocal = () => {
        try {
          return JSON.parse(localStorage.getItem(this._storageKey));
        } catch (_) {
          return null;
        }
      };
      this._openDB().then(db => {
        const tx = db.transaction(this._DB_STORE, "readonly");
        const req = tx.objectStore(this._DB_STORE).get(this._storageKey);
        req.onsuccess = e => this._applyData(e.target.result || fromLocal());
        req.onerror = () => this._applyData(fromLocal());
      }).catch(() => this._applyData(fromLocal()));
    }

    /* ---------------------------------------------------------------- *
     * Lyrics
     * ---------------------------------------------------------------- */

    _parseLRC(raw) {
      const lines = (raw || "").replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      const result = [];
      const stamp = /^\s*\[(\d+):(\d+)(?:[.:](\d+))?\]/;
      for (let line of lines) {
        /* A line may carry several timestamps — "[00:12.00][01:40.00]chorus"
         * — when the same words come back later in the song. */
        const times = [];
        let m;
        while ((m = line.match(stamp))) {
          times.push((parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 + (m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3)) : 0));
          line = line.slice(m[0].length);
        }
        const text = line.trim();
        if (!times.length || !text) continue;
        times.forEach(ms => result.push({ ms: ms, text: text }));
      }
      return this._reflowLRC(result.sort((a, b) => a.ms - b.ms));
    }
    _reflowLRC(list) {
      const MIN_STEP = 1600;
      const MAX_STEP = 2600;
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const cur = list[i];
        const parts = this._wrapText(cur.text, CHAT_MAX);
        if (parts.length <= 1) {
          out.push(cur);
          continue;
        }
        const next = list[i + 1];
        const span = next ? Math.max(0, next.ms - cur.ms) : parts.length * MAX_STEP;
        let step = Math.floor(span / parts.length);
        if (step < MIN_STEP) step = MIN_STEP;
        if (step > MAX_STEP) step = MAX_STEP;
        parts.forEach((p, k) => out.push({
          ms: cur.ms + k * step,
          text: p
        }));
      }
      return out.sort((a, b) => a.ms - b.ms);
    }
    _wrapText(text, max) {
      const t = String(text == null ? "" : text).trim().replace(/\s+/g, " ");
      if (!t) return [];
      if (t.length <= max) return [ t ];
      const words = [];
      for (const w of t.split(" ")) {
        let r = w;
        while (r.length > max) {
          words.push(r.slice(0, max));
          r = r.slice(max);
        }
        if (r) words.push(r);
      }
      const pack = n => {
        const target = Math.ceil(t.length / n);
        const out = [];
        let cur = "";
        for (const w of words) {
          const cand = cur ? cur + " " + w : w;
          if (cur && cand.length > target && out.length < n - 1) {
            out.push(cur);
            cur = w;
          } else if (cand.length > max) {
            out.push(cur);
            cur = w;
          } else {
            cur = cand;
          }
        }
        if (cur) out.push(cur);
        return out.length <= n && out.every(x => x.length <= max) ? out : null;
      };
      const least = Math.ceil(t.length / max);
      for (let n = least; n <= Math.min(least + 3, 12); n++) {
        const got = pack(n);
        if (got) return got;
      }
      const out = [];
      let rest = t;
      while (rest.length > max && out.length < 12) {
        let cut = rest.lastIndexOf(" ", max);
        if (cut <= 0) cut = max;
        out.push(rest.slice(0, cut).trimEnd());
        rest = rest.slice(cut).trimStart();
      }
      if (rest) out.push(rest);
      return out;
    }
    _splitLine(text) {
      return this._wrapText(text, CHAT_MAX);
    }

    /* ---------------------------------------------------------------- *
     * Chat sync
     * ---------------------------------------------------------------- */

    _effectiveDelay() {
      return (this._syncDelay || 0) + (this._autoDelay ? Chat.ping() : 0);
    }
    _startRAF() {
      if (this._rafId !== null) return;
      const tick = () => {
        this._rafId = requestAnimationFrame(tick);
        this._tickSync();
      };
      this._rafId = requestAnimationFrame(tick);
    }
    _stopRAF() {
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    }
    _tickSync() {
      if (!this._chatSync) return;
      if (!this._audio || this._audio.paused) return;
      if (!this._lyrics.length) return;
      const nowMs = this._audio.currentTime * 1000 + this._effectiveDelay();
      for (let i = this._lyricIndex + 1; i < this._lyrics.length; i++) {
        if (nowMs - this._lyrics[i].ms > 500) {
          this._lyricIndex = i;
        } else break;
      }
      const next = this._lyricIndex + 1;
      if (next >= this._lyrics.length) return;
      if (nowMs < this._lyrics[next].ms) return;
      const wallNow = Date.now();
      if (wallNow - this._lastSentWall < MIN_GAP_MS) return;
      const text = this._lyrics[next].text;
      this._lyricIndex = next;
      this._lastSentWall = wallNow;
      this._dbg("line " + (next + 1) + "/" + this._lyrics.length + " @" + this._fmtTime(this._lyrics[next].ms / 1000) + "  " + text);
      this._sendChat(text);
    }
    _doSendPacket(chunk) {
      if (Chat.send(chunk)) {
        this._dbg("  sent: " + chunk);
      } else {
        const st = Chat.status();
        this._dbg("  dropped (sock:" + st.socket + " inGame:" + st.inGame + "): " + chunk);
      }
    }
    _sendChat(text) {
      const chunks = [];
      if (text.length <= CHAT_MAX) {
        chunks.push(text);
      } else {
        let cutAt = CHAT_MAX;
        const spaceIdx = text.lastIndexOf(" ", CHAT_MAX - 1);
        if (spaceIdx > 0) cutAt = spaceIdx;
        const part1 = text.slice(0, cutAt).trimEnd();
        const part2 = text.slice(cutAt).trimStart();
        chunks.push(part1);
        if (part2.length > 0) chunks.push(part2);
      }
      const sessionId = this._songSessionId;
      chunks.forEach((chunk, i) => {
        setTimeout(() => {
          if (this._songSessionId !== sessionId) return;
          this._doSendPacket(chunk);
        }, i * CHUNK_GAP_MS);
      });
    }

    /* ---------------------------------------------------------------- *
     * Playback
     * ---------------------------------------------------------------- */

    _releaseAudio() {
      const a = this._audio;
      this._audio = null;
      if (!a) return;
      a.onended = null;
      a.onerror = null;
      a.ontimeupdate = null;
      a.onplay = null;
      a.onpause = null;
      try {
        a.pause();
        a.removeAttribute("src");
        a.load();
      } catch (_) {}
    }
    play(index) {
      if (index < 0 || index >= this._songs.length) return;
      this._currentIndex = index;
      const song = this._songs[index];
      this._songSessionId++;
      this._playGen++;
      this._stopRAF();
      this._releaseAudio();
      if (!song.url || song.url === "__FILE_TOO_LARGE__") {
        this._lyrics = [];
        this._showStatus("File too large - use a URL instead", true);
        this._updateUI();
        this._renderSongList();
        return;
      }
      const audio = new Audio;
      this._audio = audio;
      audio.volume = this._volume;
      audio.preload = "auto";
      audio.ontimeupdate = () => {
        this._updateProgress();
        /* requestAnimationFrame stops while the tab is in the background;
         * timeupdate keeps coming, so the sync keeps going with it. */
        this._tickSync();
      };
      audio.onplay = () => this._updatePlayBtn();
      audio.onpause = () => this._updatePlayBtn();
      audio.onended = () => {
        this._stopRAF();
        if (this._loop) this.play(this._currentIndex); else if (this._shuffle) this.play(this._randomIndex()); else this.next();
      };
      audio.onerror = () => {
        if (this._audio !== audio) return;
        /* A failed source can leave the element reporting "not paused". */
        try {
          audio.pause();
        } catch (_) {}
        this._stopRAF();
        this._dbg("could not load: " + song.title);
        this._showStatus("Could not load this song", true);
        this._updatePlayBtn();
      };
      audio.src = song.url;
      audio.play().catch(e => {
        this._dbg("play() rejected: " + (e && e.name || e));
      });
      this._lyrics = this._parseLRC(song.lyrics || "");
      this._lyricIndex = -1;
      this._lastSentWall = 0;
      this._dbg("play: " + song.title + " (" + this._lyrics.length + " lyric lines)");
      this._startRAF();
      this._updateUI();
      this._renderSongList();
    }
    _randomIndex() {
      const n = this._songs.length;
      if (n <= 1) return 0;
      let i = Math.floor(Math.random() * (n - 1));
      if (i >= this._currentIndex) i++;
      return i;
    }
    next() {
      if (!this._songs.length) return;
      if (this._shuffle) {
        this.play(this._randomIndex());
        return;
      }
      this.play((this._currentIndex + 1) % this._songs.length);
    }
    prev() {
      if (!this._songs.length) return;
      this.play((this._currentIndex - 1 + this._songs.length) % this._songs.length);
    }
    stop() {
      this._songSessionId++;
      this._playGen++;
      this._stopRAF();
      this._releaseAudio();
      this._currentIndex = -1;
      this._lyrics = [];
      this._lyricIndex = -1;
      this._updateUI();
    }
    togglePause() {
      if (!this._audio) {
        if (this._songs.length) this.play(this._currentIndex >= 0 ? this._currentIndex : 0);
        return;
      }
      if (this._audio.paused) {
        this._audio.play().catch(() => {});
        this._startRAF();
      } else {
        this._audio.pause();
      }
      setTimeout(() => this._updatePlayBtn(), 60);
    }
    setVolume(v) {
      this._volume = v;
      if (this._audio) this._audio.volume = v;
    }
    seekTo(pct) {
      if (!this._audio || !isFinite(this._audio.duration) || !this._audio.duration) return;
      pct = Math.max(0, Math.min(1, pct));
      const newTime = pct * this._audio.duration;
      this._audio.currentTime = newTime;
      const newMs = newTime * 1000;
      this._lyricIndex = -1;
      for (let i = 0; i < this._lyrics.length; i++) {
        if (this._lyrics[i].ms <= newMs) this._lyricIndex = i; else break;
      }
      this._lastSentWall = 0;
      /* Parts of a line from before the jump would land after it. */
      this._songSessionId++;
      this._dbg("seek -> " + this._fmtTime(newTime));
      this._updateProgress();
    }

    /* ---------------------------------------------------------------- *
     * View
     * ---------------------------------------------------------------- */

    _fmtTime(sec) {
      if (!isFinite(sec) || sec < 0) sec = 0;
      const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return m + ":" + (s < 10 ? "0" : "") + s;
    }
    _updatePlayBtn() {
      const btn = this._q("#music-play");
      const isPlaying = !!(this._audio && !this._audio.paused);
      if (btn) btn.innerHTML = isPlaying ? "&#9646;&#9646;" : "&#9654;";
      const art = this._q("#rm-art");
      if (art) art.classList.toggle("playing", isPlaying);
    }
    _updateProgress() {
      const fill = this._q("#music-progress-fill");
      const cur = this._q("#music-time-current");
      const tot = this._q("#music-time-total");
      if (!this._audio || !isFinite(this._audio.duration) || !this._audio.duration) {
        /* Nothing loaded yet (or a live stream): start from zero rather than
         * leaving the previous song's position on screen. */
        if (fill) fill.style.width = "0%";
        if (cur) cur.textContent = this._fmtTime(this._audio ? this._audio.currentTime : 0);
        if (tot) tot.textContent = "0:00";
        return;
      }
      const pct = this._audio.currentTime / this._audio.duration * 100;
      if (fill) fill.style.width = pct + "%";
      if (cur) cur.textContent = this._fmtTime(this._audio.currentTime);
      if (tot) tot.textContent = this._fmtTime(this._audio.duration);
    }
    _updateUI() {
      if (!this._root) return;
      const song = this._songs[this._currentIndex];
      const titleEl = this._q("#music-title");
      const artistEl = this._q("#music-artist");
      if (titleEl) titleEl.textContent = song ? song.title : "No song selected";
      if (artistEl) artistEl.textContent = song ? song.artist || "--" : "--";
      this._updatePlayBtn();
      this._updateProgress();
      this._updateNowPlayingLike();
    }
    _updateNowPlayingLike() {
      const song = this._songs[this._currentIndex];
      const btn = this._q("#rm-like-now");
      if (btn) {
        const liked = !!(song && song.liked);
        btn.classList.toggle("liked", liked);
        btn.innerHTML = liked ? "&#9829;" : "&#9825;";
      }
      const save = this._q("#rm-save-now");
      if (save) save.classList.toggle("on", !!(song && song.saved));
    }
    _showStatus(msg, isErr) {
      this._toast(msg, isErr);
    }
    _toast(msg, isErr) {
      const t = this._q("#rm-toast");
      if (!t) return;
      t.textContent = msg;
      t.classList.toggle("err", !!isErr);
      t.style.display = "block";
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        t.style.display = "none";
      }, isErr ? 3200 : 2200);
    }
    _dbg(msg) {
      const a = this._audio;
      const pos = a && isFinite(a.currentTime) ? a.currentTime : 0;
      const tenth = Math.floor(pos * 10) % 10;
      this._dbgLines.push("[" + this._fmtTime(pos) + "." + tenth + "] " + msg);
      if (this._dbgLines.length > DEBUG_LINES) this._dbgLines.splice(0, this._dbgLines.length - DEBUG_LINES);
      this._renderDebug();
    }
    _renderDebug() {
      const wrap = this._q("#bm-dbg-wrap");
      const box = this._q("#bm-dbg-box");
      if (!box || !wrap || wrap.style.display === "none") return;
      box.textContent = this._dbgLines.length ? this._dbgLines.join("\n") : "Nothing logged yet.";
      box.scrollTop = box.scrollHeight;
    }
    _renderAll() {
      this._renderSongList();
      this._updateUI();
    }
    _activeFilter() {
      const btn = this._q(".rm-filter-btn.active");
      return btn ? btn.getAttribute("data-filter") || "" : "";
    }
    _setFilter(val) {
      if (!this._root) return;
      this._root.querySelectorAll(".rm-filter-btn").forEach(b => {
        b.classList.toggle("active", (b.getAttribute("data-filter") || "") === val);
      });
      this._renderSongList();
    }
    _deleteSong(i) {
      const wasCurrent = i === this._currentIndex;
      this._songs.splice(i, 1);
      if (wasCurrent) {
        this.stop();
      } else if (i < this._currentIndex) {
        this._currentIndex--;
      }
      this._save();
      this._renderAll();
    }
    _renderSongList() {
      const list = this._q("#song-list");
      if (!list) return;
      list.textContent = "";
      const filterVal = this._activeFilter();
      const visible = [];
      this._songs.forEach((s, i) => {
        if (filterVal === "__liked" && !s.liked) return;
        if (filterVal === "__saved" && !s.saved) return;
        visible.push(i);
      });
      if (!visible.length) {
        const empty = document.createElement("div");
        empty.className = "rm-empty";
        empty.textContent = filterVal === "__liked" ? "No liked songs yet" : filterVal === "__saved" ? "No saved songs yet" : "Library is empty";
        list.appendChild(empty);
        return;
      }
      const el = (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
      };
      visible.forEach(i => {
        const song = this._songs[i];
        const row = el("div", "rm-song-row" + (i === this._currentIndex ? " active" : ""));
        row.appendChild(el("span", "rm-snum", String(i + 1)));
        const title = el("span", "rm-stitle", song.title);
        if (song.lyrics) title.appendChild(el("span", "rm-lrc-mark", "♪"));
        row.appendChild(title);
        row.appendChild(el("span", "rm-sartist", song.artist || ""));
        const icons = el("span", "rm-s-icons");
        const like = el("span", "rm-s-like" + (song.liked ? " on" : ""), "♥");
        like.title = "Like";
        const save = el("span", "rm-s-save" + (song.saved ? " on" : ""), "★");
        save.title = "Save";
        const del = el("span", "rm-sdel", "✕");
        del.title = "Delete";
        icons.appendChild(like);
        icons.appendChild(save);
        icons.appendChild(del);
        row.appendChild(icons);
        like.onclick = e => {
          e.stopPropagation();
          song.liked = !song.liked;
          this._save();
          this._renderSongList();
          this._updateNowPlayingLike();
        };
        save.onclick = e => {
          e.stopPropagation();
          song.saved = !song.saved;
          this._save();
          this._renderSongList();
          this._updateNowPlayingLike();
          this._toast(song.saved ? "✓ Song saved" : "Song unsaved");
        };
        del.onclick = e => {
          e.stopPropagation();
          this._deleteSong(i);
        };
        row.onclick = () => this.play(i);
        list.appendChild(row);
      });
    }

    /* ---------------------------------------------------------------- *
     * Wiring
     * ---------------------------------------------------------------- */

    init(root, prefs) {
      this._root = root;
      if (prefs) this._prefs = prefs;
      const P = this._prefs;
      const q = sel => this._q(sel);
      this._load();

      root.querySelectorAll(".rm-sec-head").forEach(head => {
        head.onclick = () => head.closest(".rm-sec").classList.toggle("open");
      });

      q("#music-play").onclick = () => this.togglePause();
      q("#music-prev").onclick = () => this.prev();
      q("#music-next").onclick = () => this.next();

      const loopBtn = q("#music-loop");
      this._loop = !!P.get("musicLoop", false);
      loopBtn.classList.toggle("rm-on", this._loop);
      loopBtn.onclick = () => {
        this._loop = !this._loop;
        loopBtn.classList.toggle("rm-on", this._loop);
        P.set("musicLoop", this._loop);
      };
      const shfBtn = q("#music-shuffle");
      this._shuffle = !!P.get("musicShuffle", false);
      shfBtn.classList.toggle("rm-on", this._shuffle);
      shfBtn.onclick = () => {
        this._shuffle = !this._shuffle;
        shfBtn.classList.toggle("rm-on", this._shuffle);
        P.set("musicShuffle", this._shuffle);
      };

      const volSlider = q("#music-volume");
      const volLabel = q("#music-volume-label");
      const vol = Math.max(0, Math.min(100, parseInt(P.get("musicVolume", 70)) || 0));
      volSlider.value = vol;
      volLabel.textContent = vol + "%";
      this.setVolume(vol / 100);
      volSlider.oninput = () => {
        this.setVolume(parseInt(volSlider.value) / 100);
        volLabel.textContent = volSlider.value + "%";
      };
      volSlider.onchange = () => P.set("musicVolume", parseInt(volSlider.value));

      const progBar = q("#music-progress-bar");
      progBar.onclick = e => {
        const rect = progBar.getBoundingClientRect();
        this.seekTo((e.clientX - rect.left) / rect.width);
      };

      /* Chat sync always starts off: a reload must never start typing into
       * chat on its own. */
      const chatSync = q("#music-chat-sync");
      chatSync.checked = false;
      this._chatSync = false;
      chatSync.onchange = () => {
        this._chatSync = chatSync.checked;
        this._lastSentWall = 0;
        this._dbg("chat sync " + (this._chatSync ? "on" : "off"));
      };

      const autoDelay = q("#music-auto-delay");
      const autoBadge = q("#bm-auto-delay-badge");
      const updAutoBadge = () => {
        if (!autoBadge) return;
        const p = Chat.ping();
        autoBadge.textContent = !this._autoDelay ? "off" : p ? p + "ms" : "on";
      };
      this._autoDelay = !!P.get("musicAutoDelay", true);
      autoDelay.checked = this._autoDelay;
      autoDelay.onchange = () => {
        this._autoDelay = autoDelay.checked;
        P.set("musicAutoDelay", this._autoDelay);
        updAutoBadge();
      };
      updAutoBadge();
      setInterval(updAutoBadge, 2500);

      const delaySlider = q("#music-sync-delay");
      const delayLabel = delaySlider.previousElementSibling;
      const paintDelay = () => {
        const min = Number(delaySlider.min), max = Number(delaySlider.max);
        const pct = (Number(delaySlider.value) - min) / (max - min) * 100;
        const zero = (0 - min) / (max - min) * 100;
        delaySlider.style.setProperty("--lo", Math.min(pct, zero).toFixed(2) + "%");
        delaySlider.style.setProperty("--hi", Math.max(pct, zero).toFixed(2) + "%");
        if (delayLabel) delayLabel.textContent = delaySlider.value + "ms";
      };
      this._syncDelay = Math.max(-3000, Math.min(3000, parseInt(P.get("musicSyncDelay", 0)) || 0));
      delaySlider.value = this._syncDelay;
      paintDelay();
      delaySlider.oninput = () => {
        this._syncDelay = parseInt(delaySlider.value);
        paintDelay();
      };
      delaySlider.onchange = () => P.set("musicSyncDelay", this._syncDelay);

      const testBtn = q("#bm-test-chat");
      const testSt = q("#bm-test-chat-status");
      testBtn.onclick = () => {
        const st = Chat.status();
        testSt.textContent = "sock:" + st.socket + " enc:" + st.handshake + " inGame:" + st.inGame;
        testSt.style.color = st.socket === "OPEN" ? "var(--sage)" : "var(--rose)";
        clearTimeout(this._testTimer);
        this._testTimer = setTimeout(() => {
          testSt.textContent = "";
        }, 4000);
        if (st.socket === "OPEN" && st.handshake && st.inGame) {
          this._doSendPacket("🎵 Luna music sync test");
        } else {
          this._dbg("test chat: not in game (sock:" + st.socket + " enc:" + st.handshake + " inGame:" + st.inGame + ")");
        }
      };

      const sendAllLyricsBtn = q("#bm-send-all-lyrics");
      const sendLyricsStatusEl = q("#bm-send-lyrics-status");
      let _sendLyricsActive = false;
      let _sendLyricsTimer = null;
      let _lyricsGen = 0;
      const _stopSendAllLyrics = () => {
        _lyricsGen++;
        _sendLyricsActive = false;
        clearTimeout(_sendLyricsTimer);
        _sendLyricsTimer = null;
        sendAllLyricsBtn.textContent = "♬ Send All Lyrics: OFF";
        sendAllLyricsBtn.classList.remove("primary");
        sendLyricsStatusEl.textContent = "";
      };
      const _startSendAllLyrics = () => {
        const song = this._currentIndex >= 0 ? this._songs[this._currentIndex] : null;
        /* The playing song's timeline: its own .lrc, or what LRC AI found. */
        const lines = song && this._lyrics.length ? this._lyrics : this._parseLRC(song ? song.lyrics || "" : "");
        if (!lines.length) {
          _stopSendAllLyrics();
          sendLyricsStatusEl.textContent = song ? "No LRC lyrics for this song." : "Play a song first.";
          return;
        }
        const allChunks = [];
        lines.forEach(({ text }) => {
          this._splitLine(text).forEach(c => allChunks.push(c));
        });
        let idx = 0;
        const myGen = ++_lyricsGen;
        this._dbg("send all lyrics: " + allChunks.length + " messages");
        const sendNext = () => {
          if (myGen !== _lyricsGen || !_sendLyricsActive) return;
          if (idx >= allChunks.length) {
            _stopSendAllLyrics();
            return;
          }
          this._doSendPacket(allChunks[idx++]);
          sendLyricsStatusEl.textContent = idx + " / " + allChunks.length;
          if (idx < allChunks.length) {
            _sendLyricsTimer = setTimeout(sendNext, SEND_ALL_GAP_MS);
          } else {
            _sendLyricsTimer = setTimeout(_stopSendAllLyrics, 1200);
          }
        };
        sendNext();
      };
      sendAllLyricsBtn.onclick = () => {
        if (_sendLyricsActive) {
          _stopSendAllLyrics();
          return;
        }
        _sendLyricsActive = true;
        sendAllLyricsBtn.textContent = "♬ Send All Lyrics: ON";
        sendAllLyricsBtn.classList.add("primary");
        _startSendAllLyrics();
      };

      const dbgBtn = q("#bm-dbg-toggle");
      const dbgWrap = q("#bm-dbg-wrap");
      dbgBtn.onclick = () => {
        const shown = dbgWrap.style.display !== "none";
        dbgWrap.style.display = shown ? "none" : "block";
        dbgBtn.textContent = shown ? "Show Debug Log" : "Hide Debug Log";
        this._renderDebug();
      };

      q("#rm-filter-bar").addEventListener("click", e => {
        const btn = e.target.closest(".rm-filter-btn");
        if (!btn) return;
        this._setFilter(btn.getAttribute("data-filter") || "");
      });

      q("#rm-like-now").onclick = () => {
        const song = this._songs[this._currentIndex];
        if (!song) return;
        song.liked = !song.liked;
        this._save();
        this._updateNowPlayingLike();
        this._renderSongList();
        this._toast(song.liked ? "♥ Liked!" : "Unliked");
      };
      q("#rm-save-now").onclick = () => {
        const song = this._songs[this._currentIndex];
        if (!song) return;
        song.saved = !song.saved;
        this._save();
        this._updateNowPlayingLike();
        this._renderSongList();
        this._toast(song.saved ? "✓ Saved!" : "Unsaved");
      };

      const lrcFileInput = q("#lrc-file-input");
      const lrcStatus = q("#lrc-status");
      const lyricsArea = q("#song-lyrics-input");
      const songFileInput = q("#song-file-input");
      const songTitleInp = q("#song-title-input");
      const songArtistInp = q("#song-artist-input");
      const songUrlInp = q("#song-url-input");
      const countLines = text => (String(text).match(/^\s*\[\d+:\d+/gm) || []).length;
      lrcFileInput.onchange = () => {
        const f = lrcFileInput.files[0];
        if (!f) return;
        const reader = new FileReader;
        reader.onload = ev => {
          lyricsArea.value = ev.target.result;
          lrcStatus.textContent = countLines(ev.target.result) + " lines";
        };
        reader.readAsText(f, "utf-8");
      };
      lyricsArea.oninput = () => {
        const n = countLines(lyricsArea.value);
        lrcStatus.textContent = n ? n + " lines" : "";
      };
      songFileInput.onchange = () => {
        const f = songFileInput.files[0];
        if (!f) return;
        if (!songTitleInp.value.trim()) songTitleInp.value = f.name.replace(/\.[^.]+$/, "").replace(/[_\-]/g, " ").trim().slice(0, 50);
      };

      q("#add-song").onclick = async () => {
        const title = songTitleInp.value.trim();
        const artist = songArtistInp.value.trim();
        const url = songUrlInp.value.trim();
        const lyr = lyricsArea.value || "";
        const file = songFileInput.files[0];
        if (!title) {
          this._showStatus("⚠ Title required", true);
          return;
        }
        let finalUrl = url;
        if (!finalUrl && file) {
          if (file.size > MAX_FILE_BYTES) {
            this._showStatus("⚠ File too large (max 20MB) — use URL instead", true);
            return;
          }
          finalUrl = await new Promise(res => {
            const r = new FileReader;
            r.onload = e => res(e.target.result);
            r.onerror = () => res("");
            r.readAsDataURL(file);
          });
        }
        if (!finalUrl) {
          this._showStatus("⚠ URL or file required", true);
          return;
        }
        this._songs.push({
          title: title,
          artist: artist,
          url: finalUrl,
          lyrics: lyr,
          liked: false,
          saved: false
        });
        this._save();
        this._toast("✓ Song added");
        this._songAdded(this._songs.length - 1);
        songTitleInp.value = "";
        songArtistInp.value = "";
        songUrlInp.value = "";
        lyricsArea.value = "";
        lrcStatus.textContent = "";
        songFileInput.value = "";
        lrcFileInput.value = "";
        const autoSync = q("#song-autosync");
        if (autoSync.checked) {
          this._chatSync = true;
          chatSync.checked = true;
          this._dbg("chat sync on");
          this.play(this._songs.length - 1);
        }
        this._renderAll();
      };

      q("#save-song-btn").onclick = () => {
        const i = this._currentIndex;
        if (i < 0 || i >= this._songs.length) {
          this._showStatus("⚠ No song selected", true);
          return;
        }
        const lyr = lyricsArea.value;
        if (!lyr.trim()) {
          this._showStatus("⚠ The lyrics box is empty", true);
          return;
        }
        this._songs[i].lyrics = lyr;
        this._lyrics = this._parseLRC(lyr);
        this._lyricIndex = -1;
        this._save();
        this._lyricsEdited(i);
        this._renderSongList();
        this._toast("✓ Saved");
        lrcStatus.textContent = this._lyrics.length ? this._lyrics.length + " lines" : "";
      };

      const backupStatus = (msg, ok) => {
        const st = q("#music-backup-status");
        st.textContent = msg;
        st.style.color = ok ? "var(--sage)" : "var(--rose)";
        clearTimeout(this._backupTimer);
        if (ok) this._backupTimer = setTimeout(() => {
          st.textContent = "";
        }, 3000);
      };
      q("#music-export-btn").onclick = () => {
        try {
          const json = JSON.stringify({ songs: this._songs }, null, 2);
          const blob = new Blob([ json ], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "luna_music_backup.json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          backupStatus("✓ Exported " + this._songs.length + " songs!", true);
        } catch (e) {
          backupStatus("⚠ Export failed", false);
        }
      };
      const importFile = q("#music-import-file");
      q("#music-import-btn").onclick = () => importFile.click();
      importFile.onchange = () => {
        const f = importFile.files[0];
        if (!f) return;
        const reader = new FileReader;
        reader.onload = ev => {
          importFile.value = "";
          let data;
          try {
            data = JSON.parse(ev.target.result);
          } catch (e) {
            backupStatus("⚠ Invalid file", false);
            return;
          }
          const incoming = Array.isArray(data) ? data : data && Array.isArray(data.songs) ? data.songs : null;
          if (!incoming) {
            backupStatus("⚠ Invalid file", false);
            return;
          }
          let added = 0;
          incoming.forEach(raw => {
            const s = this._normalizeSong(raw);
            if (!s) return;
            if (this._songs.some(x => x.title === s.title && x.url === s.url)) return;
            this._songs.push(s);
            added++;
          });
          this._save();
          this._renderAll();
          backupStatus("✓ Imported " + added + " songs!", true);
        };
        reader.readAsText(f, "utf-8");
      };

      this._initExtras(root);
    }
  };

  /* ------------------------------------------------------------------ *
   * Mounting into the Luna menu
   * ------------------------------------------------------------------ */

  let page = null;

  /* Luna's menu lives in the game document, not in an iframe the way Ryn's
   * does, so two game listeners on window see everything that happens in it:
   * the keyboard handler (typing "v" in a text box would place a spike, Enter
   * would open chat) and the wheel zoom (which also preventDefaults, so the
   * page would never scroll). Both are stopped at the page. */
  function isTextEntry(el) {
    if (!el || !el.tagName) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName !== "INPUT") return false;
    return /^(text|search|url|number|email|password)$/i.test(el.type || "text");
  }
  function guardInput(root) {
    const stopKeys = e => {
      if (e.key === "Escape" || e.code === "Insert") return;
      if (isTextEntry(e.target)) e.stopPropagation();
    };
    root.addEventListener("keydown", stopKeys);
    root.addEventListener("keyup", stopKeys);
    root.addEventListener("keypress", stopKeys);
    root.addEventListener("wheel", e => e.stopPropagation(), { passive: true });
    /* A toggle or slider keeps focus after a click, and would then eat the
     * space bar or the arrow keys meant for the game. */
    root.addEventListener("change", e => {
      const t = e.target;
      if (t && t.tagName === "INPUT" && !isTextEntry(t)) t.blur();
    });
  }

  function mount(host, prefs) {
    if (page) return page;
    const style = document.createElement("style");
    style.id = "luna-music-style";
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);

    page = document.createElement("div");
    page.className = "lm-page";
    page.innerHTML = HTML;
    host.appendChild(page);
    guardInput(page);

    /* When the menu closes, let go of any field in the page that still has
     * focus — otherwise the next key presses would land in it, not the game. */
    const menu = host.closest(".deltek-root");
    if (menu && typeof MutationObserver === "function") {
      new MutationObserver(() => {
        if (menu.classList.contains("active")) return;
        const a = document.activeElement;
        if (a && page.contains(a)) a.blur();
      }).observe(menu, { attributes: true, attributeFilter: [ "class" ] });
    }

    MusicPlayer.init(page, prefs);
    return page;
  }
  function show() {
    if (!page) return;
    page.classList.add("opened");
    page.scrollTop = 0;
  }
  function hide() {
    if (!page) return;
    page.classList.remove("opened");
  }

  return {
    mount: mount,
    show: show,
    hide: hide,
    player: MusicPlayer
  };
})();
