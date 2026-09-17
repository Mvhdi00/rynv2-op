  // =========================================================================
  //  CHAT LOG
  //
  //  A log of the things a player actually cares about — what was said, who
  //  arrived, who left, who died, and who formed or joined a clan — read off
  //  the connection this client already has. Nothing here opens a socket, adds
  //  a listener to one, polls the world, or runs a frame loop. Every entry in
  //  it arrives because one of the six observation points below was called by
  //  code that was going to run anyway:
  //
  //    SocketManager "6"  → chat            (id, message)
  //    SocketManager "D"  → join / respawn  (socketID, sid, nickname)
  //    SocketManager "E"  → leave           (socketID)
  //    SocketManager "O"  → death           (sid, health) when health hits 0
  //    SocketManager "P"  → your own death
  //    SocketManager "g"  → clan created    (clan name, owner sid)
  //    PlayerManager tick → clan joined, and deaths RYN credited you with
  //
  //  Identity is the server's own: the player sid that "D" hands out and every
  //  later packet keys on. The nickname rides along as display metadata, so a
  //  name change keeps the same [id] and a mute keeps pointing at the same
  //  player.
  //
  //  Rendering is incremental. One event appends one row; one expiry removes
  //  one row; a filter, a mute or a font change writes a CSS property or a
  //  class and touches no rows at all. The only timer the whole system owns is
  //  a single self-rescheduling setTimeout that fires when the oldest entry is
  //  due to expire, and nothing at all runs while the log is idle.
  // =========================================================================

  const CHATLOG_LIFETIME = 15 * 60 * 1000;
  // The secondary guard. The lifetime above is what actually bounds the log in
  // practice; this is the ceiling that keeps a flood — a server full of bots
  // spamming chat — from putting thousands of rows in the DOM before the first
  // of them is fifteen minutes old.
  const CHATLOG_MAX = 400;
  // Death is only claimed for a player the server stopped reporting on the
  // tick RYN was credited with a kill, and only inside this many ticks of it.
  // Same window CorpseHandler uses, for the same reason: one tick of slack for
  // the kill credit and the last player update arriving in either order.
  const CHATLOG_DEATH_TICKS = 3;
  // And only within weapon reach of where you were standing. Without it, an
  // enemy who walked out of view on the tick you killed someone else would be
  // logged as dead — exactly the "ordinary disappearance" a death must not be
  // inferred from.
  const CHATLOG_DEATH_RANGE_SQ = 320 * 320;

  const CHATLOG_FONTS = {
    manrope: "'Manrope','Segoe UI',system-ui,sans-serif",
    grotesk: "'Space Grotesk','Manrope',system-ui,sans-serif",
    hammersmith: "'Hammersmith One','Manrope',Arial,sans-serif",
    system: "system-ui,'Segoe UI',Roboto,Arial,sans-serif",
    mono: "ui-monospace,'Space Grotesk',Consolas,monospace"
  };

  // kind → [settings key that shows it, sentence the event reads as]. The empty
  // verb on `chat` is what makes the chat row take the "name: message" shape
  // instead of the "name <verb>" shape.
  const CHATLOG_KINDS = {
    chat:     { flag: "_chatLogFChat",     verb: "" },
    join:     { flag: "_chatLogFJoin",     verb: " joined the server" },
    leave:    { flag: "_chatLogFLeave",    verb: " left the server" },
    death:    { flag: "_chatLogFDeath",    verb: " died" },
    clanNew:  { flag: "_chatLogFClanNew",  verb: " created clan " },
    clanJoin: { flag: "_chatLogFClanJoin", verb: " joined clan " }
  };

  const CHATLOG_ICONS = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.1-4.1"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 13h-.2a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1A1.6 1.6 0 0 0 10.3 2.2V2a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>'
  };

  const ChatLog = new class {
    // ---- state -----------------------------------------------------------
    // entries is append-only at the tail and shift-only at the head, which is
    // what lets expiry look at entries[0] alone instead of scanning.
    entries = [];
    seq = 0;
    root = null;
    ready = false;
    _built = false;
    // socketID → sid. "E" (leave) names a player by the connection id the game
    // gives out in "D"[0]; every other packet names them by sid. This is the
    // only bridge between the two, and the only reason a leave can be reported
    // with the same [id] the player's chat carried.
    _bySocket = new Map;
    // socketID → true once that connection has produced a "D". A second "D" for
    // the same connection is a respawn, not a join — the game reuses the player
    // object and only the first one is an arrival.
    _joined = new Set;
    // sid → { name, clan }. The last identity seen for a player, kept so a
    // leave or a death can still name someone the server has stopped sending.
    _known = new Map;
    // A clan the "g" packet has just named, so the membership transition that
    // follows for its owner is reported as the creation it is rather than as a
    // second, spurious join. Not deduplication: two different players joining
    // the same clan still produce two entries, and so does the same player
    // joining twice.
    _createdClan = new Map;
    _muted = new Map;
    _expiryTimer = 0;
    _follow = true;
    _pending = 0;
    _searchTerm = "";
    _searchTimer = 0;
    _saveTimer = 0;
    _menu = null;
    _cfgOpen = false;
    _drag = null;
    _raf = 0;
    _pos = { x: 14, y: 52 };

    // ---- settings helpers -------------------------------------------------
    _s(key) { return Settings_default[key]; }
    _set(key, value) {
      Settings_default[key] = value;
      this._saveSoon();
    }
    // Position, size and the mute table change many times a second while
    // someone is dragging a panel or a slider. They are coalesced into one
    // write instead of one write per pixel.
    _saveSoon() {
      if (this._saveTimer) return;
      this._saveTimer = setTimeout(() => {
        this._saveTimer = 0;
        try { SaveSettings(); } catch (_) {}
      }, 400);
    }

    // ---- lifecycle --------------------------------------------------------
    init() {
      if (this._built) return;
      try {
        this._build();
        this._built = true;
        this.ready = true;
        this._applyAll();
        if (this._s("_chatLogOpen")) this.show(); else this.hide();
      } catch (e) {
        // A chat log that cannot draw itself must not take the client with it.
        this.ready = false;
        try { Logger.error("ChatLog failed to initialise: " + e); } catch (_) {}
      }
    }

    // ======================================================================
    //  OBSERVATION — called from the packet handlers, never the other way
    //  round. Every one of these is wrapped at the call site, and every one
    //  returns immediately when the log is not up.
    // ======================================================================

    onChat(client2, sid, player, message) {
      if (!this.ready) return;
      const text = message == null ? "" : String(message);
      if (text === "") return;
      const name = this._name(sid, player);
      this._remember(sid, name, player ? player.clanName : null);
      // The message is passed through exactly as the server sent it. No
      // filtering, no masking, no trimming of content — if the game received
      // it, the log shows it.
      this._push("chat", sid, name, text, "", this._isBot(client2, sid));
    }

    // "D". data[0] is the connection id, data[1] the player sid, data[2] the
    // nickname. A connection's first "D" is an arrival; every later one is that
    // player respawning, which is not an arrival and is not logged.
    onSpawn(client2, data) {
      if (!this.ready || !data) return;
      const socketID = data[0];
      const sid = data[1];
      const name = String(data[2] == null ? "" : data[2]);
      if (sid == null) return;
      if (socketID != null) this._bySocket.set(socketID, sid);
      this._remember(sid, name, null);
      if (socketID != null) {
        if (this._joined.has(socketID)) return;
        this._joined.add(socketID);
      }
      this._push("join", sid, name, "", "", this._isBot(client2, sid));
    }

    // "E" — the server dropping a connection. This is the only packet that
    // means "gone", and it is not sent for a death or a respawn, so a leave is
    // never confused with either.
    onRemove(client2, socketID) {
      if (!this.ready || socketID == null) return;
      const sid = this._bySocket.get(socketID);
      this._bySocket.delete(socketID);
      this._joined.delete(socketID);
      if (sid === undefined) return;
      const known = this._known.get(sid);
      this._push("leave", sid, known ? known.name : "", "", "", this._isBot(client2, sid));
      // Nothing can refer to them again until a fresh "D" reintroduces them, so
      // the identity is released here. The entries already in the log carry
      // their own copy of the name and are unaffected. This is what keeps the
      // bookkeeping bounded by who is on the server rather than by how long the
      // session has been running.
      this.forget(sid);
    }

    // "O" — a health update. Zero or less is the server stating the player is
    // dead, which is the one death signal the protocol carries for someone
    // else's character.
    onHealth(client2, sid, health) {
      if (!this.ready) return;
      if (typeof health !== "number" || health > 0) return;
      const known = this._known.get(sid);
      if (known === undefined) return;
      this._claimDeath(client2, sid, known.name);
    }

    // "P" — the server telling this client it died. Authoritative, and the only
    // death anyone can be certain of without a kill credit.
    onOwnDeath(client2) {
      if (!this.ready) return;
      const myPlayer = client2 && client2.myPlayer;
      if (!myPlayer || myPlayer.id === -1) return;
      this._claimDeath(client2, myPlayer.id, myPlayer.nickname || "");
    }

    // "g" — a clan appearing. `name` is the clan's own id (moomoo keys clans by
    // their name) and `ownerID` the sid of the player who made it.
    onClanCreated(client2, name, ownerID) {
      if (!this.ready || name == null || ownerID == null) return;
      const known = this._known.get(ownerID);
      const who = known ? known.name : "";
      this._createdClan.set(ownerID, String(name));
      this._push("clanNew", ownerID, who, "", String(name), this._isBot(client2, ownerID));
    }

    // The clan membership transition itself, read off the player update the
    // client already decodes every tick. Called only when the field actually
    // changed, so this costs one string comparison per visible player per tick
    // inside a loop that was already running.
    onClanChange(client2, player, previous) {
      if (!this.ready) return;
      const clan = player.clanName;
      const sid = player.id;
      const name = player.nickname || "";
      this._remember(sid, name, clan);
      if (clan == null || clan === "") return;
      // Leaving one clan for another is still a join into the new one; only
      // leaving into no clan is not an event this log reports.
      const created = this._createdClan.get(sid);
      if (created === clan) {
        this._createdClan.delete(sid);
        return;
      }
      this._push("clanJoin", sid, name, "", String(clan), this._isBot(client2, sid));
    }

    // Deaths RYN was credited with. Runs once a tick from PlayerManager.postTick
    // and leaves after two property reads on every tick where nothing died,
    // which is almost all of them.
    tick(playerManager) {
      if (!this.ready) return;
      const client2 = playerManager.client;
      if (!client2.isOwner) return;
      const myPlayer = client2.myPlayer;
      // `killedSomeone` is the client's own kill event; the kill-count guard is
      // the one false positive it has — on the first tick of a new life the
      // counter is compared against a zeroed baseline, so a kill from a
      // previous life reads as a fresh one.
      if (!myPlayer.killedSomeone || myPlayer.resources.kills === 0) return;
      const tick = playerManager.corpseTick;
      const mine = myPlayer.pos.current;
      const cx = mine.x;
      const cy = mine.y;
      for (const player of playerManager.playerData.values()) {
        const seen = player.corpseSeenTick;
        if (seen <= 0) continue;
        const gone = tick - seen;
        if (gone < 1 || gone > CHATLOG_DEATH_TICKS) continue;
        // Our own marker, so claiming a body here neither consumes nor is
        // consumed by the corpse renderer's claim on the same tick.
        const id = player.id;
        if (!myPlayer.isEnemyByID(id)) continue;
        const pos = player.pos.current;
        const dx = pos.x - cx;
        const dy = pos.y - cy;
        if (dx * dx + dy * dy > CHATLOG_DEATH_RANGE_SQ) continue;
        // _claimDeath owns the stamp, so a body the zero-health update already
        // reported is not reported again here.
        this._claimDeath(client2, id, player.nickname || "");
      }
    }

    // A player's connection is gone for good — drop what was being kept for
    // them. Called from the same place the client forgets them.
    forget(sid) {
      this._known.delete(sid);
      this._createdClan.delete(sid);
    }

    // ---- identity ---------------------------------------------------------
    _name(sid, player) {
      if (player && player.nickname) return player.nickname;
      const known = this._known.get(sid);
      return known ? known.name : "";
    }
    _remember(sid, name, clan) {
      const known = this._known.get(sid);
      if (known === undefined) {
        this._known.set(sid, { name: name || "", clan: clan == null ? null : clan });
        return;
      }
      if (name) known.name = name;
      known.clan = clan == null ? null : clan;
    }
    // RYN's own bot register — the set of player ids belonging to connections
    // this client opened. Nobody else can land in it, so a real player is never
    // classed as a bot.
    _isBot(client2, sid) {
      try { return !!(client2 && client2.isBotByID && client2.isBotByID(sid)); } catch (_) { return false; }
    }
    // One character death is one entry.
    //
    // Three independent signals can witness the same death — the server's own
    // zero-health update, the "P" the server sends this client when it dies,
    // and the kill credit RYN raises when you are the one who did it — and for
    // an enemy you killed in view, two of them fire on the same tick. The stamp
    // below reconciles the witnesses on the game's own tick counter so the
    // death is written once.
    //
    // This is not event deduplication and does not behave like it: two separate
    // deaths of the same player are two entries, because a player cannot die,
    // respawn and die again inside the three ticks (a third of a second) this
    // covers. Nothing else in the log is coalesced — repeated chat, repeated
    // joins, repeated clan events all go in exactly as they arrive.
    _claimDeath(client2, sid, name) {
      const manager = client2 && client2.PlayerManager;
      const player = manager ? manager.playerData.get(sid) : undefined;
      if (player !== undefined && manager !== undefined) {
        const tick = manager.corpseTick;
        const stamped = player._chatLogDeathTick;
        if (stamped !== undefined && tick - stamped <= CHATLOG_DEATH_TICKS) return;
        player._chatLogDeathTick = tick;
      }
      const known = this._known.get(sid);
      if (known !== undefined) {
        if (name) known.name = name;
      }
      this._push("death", sid, name || (known ? known.name : ""), "", "", this._isBot(client2, sid));
    }

    // The client menu is opened over the whole page, so the panel is put away
    // for as long as it is up and comes back exactly as it was.
    setMenuOpen(open) {
      if (!this.root) return;
      this.root.style.visibility = open ? "hidden" : "";
      if (open) this._closeMenu();
    }

    // True while the log's own search box has the keyboard. The client's key
    // handler asks before it acts on the chat key, which is the one branch it
    // takes without first checking for a focused input.
    ownsInput() {
      return this.ready && document.activeElement === this._findInput;
    }

    // ======================================================================
    //  ENTRIES
    // ======================================================================

    _push(kind, sid, name, message, clan, isBot) {
      let entry;
      try {
        entry = {
          id: ++this.seq,
          t: Date.now(),
          kind: kind,
          sid: sid,
          name: name || "",
          msg: message || "",
          clan: clan || "",
          bot: !!isBot,
          el: null
        };
        this.entries.push(entry);
      } catch (_) { return; }
      try {
        if (this.entries.length > CHATLOG_MAX) this._dropOldest();
        this._render(entry);
        this._scheduleExpiry();
        this._updateCount();
      } catch (_) {}
    }

    _dropOldest() {
      const gone = this.entries.shift();
      if (gone && gone.el) {
        gone.el.remove();
        gone.el = null;
      }
    }

    // One timer for the whole log, armed for the moment the oldest entry turns
    // fifteen minutes old and rearmed from whatever is oldest after that. No
    // interval, no per-entry timer, and nothing running at all when the log is
    // empty.
    _scheduleExpiry() {
      if (this._expiryTimer) return;
      const head = this.entries[0];
      if (head === undefined) return;
      const wait = head.t + CHATLOG_LIFETIME - Date.now();
      this._expiryTimer = setTimeout(() => {
        this._expiryTimer = 0;
        try { this._expire(); } catch (_) {}
        this._scheduleExpiry();
      }, wait > 50 ? wait : 50);
    }

    _expire() {
      const cutoff = Date.now() - CHATLOG_LIFETIME;
      let removed = 0;
      while (this.entries.length > 0 && this.entries[0].t <= cutoff) {
        this._dropOldest();
        removed++;
      }
      if (removed > 0) {
        this._updateCount();
        this._updateEmpty();
      }
    }

    clear() {
      const list = this._list;
      for (let i = 0; i < this.entries.length; i++) this.entries[i].el = null;
      this.entries.length = 0;
      if (list) list.textContent = "";
      this._closeMenu();
      this._cancelScroll();
      if (this._expiryTimer) {
        clearTimeout(this._expiryTimer);
        this._expiryTimer = 0;
      }
      this._pending = 0;
      this._follow = true;
      this._updateNewPill();
      this._updateCount();
      this._updateEmpty();
    }

    // ======================================================================
    //  RENDERING
    // ======================================================================

    _render(entry) {
      const list = this._list;
      if (!list) return;
      const doc = document;
      const row = doc.createElement("div");
      row.className = "rcl-e";
      row.dataset.kind = entry.kind;
      row.dataset.sid = String(entry.sid);
      if (entry.bot) row.dataset.bot = "1";
      row._clEntry = entry;

      const time = doc.createElement("span");
      time.className = "rcl-time";
      time.textContent = this._clock(entry.t);
      row.appendChild(time);

      const text = doc.createElement("span");
      text.className = "rcl-txt";

      if (entry.bot) {
        const tag = doc.createElement("span");
        tag.className = "rcl-bot";
        tag.textContent = "BOT";
        text.appendChild(tag);
      }

      const who = doc.createElement("button");
      who.type = "button";
      who.className = "rcl-who";
      const nick = doc.createElement("span");
      nick.className = "rcl-nick";
      nick.dir = "auto";
      nick.textContent = entry.name || "unknown";
      who.appendChild(nick);
      const sid = doc.createElement("span");
      sid.className = "rcl-sid";
      sid.textContent = "[" + entry.sid + "]";
      who.appendChild(sid);
      text.appendChild(who);

      if (entry.kind === "chat") {
        const sep = doc.createElement("span");
        sep.className = "rcl-sep";
        sep.textContent = ": ";
        text.appendChild(sep);
        const msg = doc.createElement("span");
        msg.className = "rcl-msg";
        msg.dir = "auto";
        msg.textContent = entry.msg;
        text.appendChild(msg);
      } else {
        const act = doc.createElement("span");
        act.className = "rcl-act";
        act.textContent = CHATLOG_KINDS[entry.kind].verb;
        text.appendChild(act);
        if (entry.clan) {
          const clan = doc.createElement("span");
          clan.className = "rcl-clan";
          clan.dir = "auto";
          clan.textContent = entry.clan;
          text.appendChild(clan);
        }
      }

      row.appendChild(text);
      if (this._searchTerm !== "" && !this._matches(entry)) row.style.display = "none";
      entry.el = row;
      list.appendChild(row);

      this._updateEmpty();
      if (this._follow) {
        this._scrollSoon();
      } else {
        this._pending++;
        this._updateNewPill();
      }
    }

    // Following the tail means reading scrollHeight, and reading scrollHeight
    // right after appending a row forces the browser to lay the list out there
    // and then. Doing that once per message turns a burst into one forced
    // layout per message; doing it once per frame is the same result at a
    // fraction of the cost, and a frame is as often as a scroll position could
    // be seen anyway.
    _scrollSoon() {
      if (this._scrollRaf) return;
      this._scrollRaf = requestAnimationFrame(() => {
        this._scrollRaf = 0;
        if (!this._follow) return;
        const list = this._list;
        if (list) list.scrollTop = list.scrollHeight;
      });
    }

    _cancelScroll() {
      if (!this._scrollRaf) return;
      cancelAnimationFrame(this._scrollRaf);
      this._scrollRaf = 0;
    }

    _clock(ms) {
      const d = new Date(ms);
      const h = d.getHours();
      const m = d.getMinutes();
      return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    }

    // The exact text a copy produces, and also what search reads, so the two
    // never disagree about what an entry says.
    _line(entry) {
      const head = this._clock(entry.t) + " " + (entry.name || "unknown") + " [" + entry.sid + "]";
      if (entry.kind === "chat") return head + ": " + entry.msg;
      return head + CHATLOG_KINDS[entry.kind].verb + entry.clan;
    }

    // The immediate version, for the three places a person asked for it: the
    // new-events pill, reopening the panel, and letting go of the resize grip.
    _toBottom() {
      this._cancelScroll();
      const list = this._list;
      if (!list) return;
      list.scrollTop = list.scrollHeight;
      this._pending = 0;
      this._follow = true;
      this._updateNewPill();
    }

    _updateNewPill() {
      const pill = this._newPill;
      if (!pill) return;
      const show = !this._follow && this._pending > 0;
      if (show) {
        pill.lastChild.textContent = this._pending > 99 ? "99+ NEW" : this._pending + " NEW";
        pill.hidden = false;
      } else {
        pill.hidden = true;
      }
    }

    _updateCount() {
      if (this._countEl) this._countEl.textContent = String(this.entries.length);
    }

    _updateEmpty() {
      if (!this._emptyEl) return;
      this._emptyEl.hidden = this.entries.length > 0;
    }

    // ======================================================================
    //  FILTERING — all of it declarative
    //
    //  Kind filters and mutes are two stylesheets the module rewrites when a
    //  switch moves. Hiding every message from a player, or every join in the
    //  log, is therefore one string assignment regardless of how many entries
    //  are in the DOM, and the entries themselves are never touched: the log
    //  keeps collecting exactly what it collected before.
    // ======================================================================

    _applyFilters() {
      if (!this._filterSheet) return;
      let css = "";
      for (const kind in CHATLOG_KINDS) {
        if (!this._s(CHATLOG_KINDS[kind].flag)) {
          css += '#ryn-chatlog .rcl-e[data-kind="' + kind + '"]{display:none}';
        }
      }
      if (!this._s("_chatLogBotMsg")) {
        css += '#ryn-chatlog .rcl-e[data-bot="1"][data-kind="chat"]{display:none}';
      }
      if (!this._s("_chatLogBotEvents")) {
        css += '#ryn-chatlog .rcl-e[data-bot="1"]:not([data-kind="chat"]){display:none}';
      }
      this._filterSheet.textContent = css;
    }

    _applyMutes() {
      if (!this._muteSheet) return;
      let css = "";
      for (const sid of this._muted.keys()) {
        css += '#ryn-chatlog .rcl-e[data-kind="chat"][data-sid="' + sid + '"]{display:none}';
      }
      this._muteSheet.textContent = css;
    }

    // ---- mute -------------------------------------------------------------
    // The one question the game bundle asks. It is answered from the sid, which
    // is what the chat packet carries, so a player who renames themselves stays
    // muted and a player who takes the muted player's old name does not become
    // muted with them.
    isMuted(sid) {
      return this._muted.size !== 0 && this._muted.has(sid);
    }

    mute(sid, name) {
      if (sid == null) return;
      this._muted.set(sid, name || "");
      this._applyMutes();
      this._persistMutes();
      this._renderMuteList();
    }

    unmute(sid) {
      if (!this._muted.delete(sid)) return;
      this._applyMutes();
      this._persistMutes();
      this._renderMuteList();
    }

    _persistMutes() {
      const out = [];
      for (const pair of this._muted) out.push([ pair[0], pair[1] ]);
      this._set("_chatLogMuted", out);
    }

    _loadMutes() {
      this._muted.clear();
      const stored = this._s("_chatLogMuted");
      if (!Array.isArray(stored)) return;
      for (let i = 0; i < stored.length; i++) {
        const pair = stored[i];
        if (Array.isArray(pair) && pair[0] != null) this._muted.set(pair[0], String(pair[1] == null ? "" : pair[1]));
      }
    }

    // ---- search -----------------------------------------------------------
    // Debounced, and bounded by the entry cap rather than by the DOM: it walks
    // the entry array, which is at most CHATLOG_MAX long, and writes a display
    // value only on the rows whose visibility actually changed.
    _search(term) {
      this._searchTerm = term.trim().toLowerCase();
      let hits = 0;
      for (let i = 0; i < this.entries.length; i++) {
        const entry = this.entries[i];
        if (!entry.el) continue;
        const show = this._searchTerm === "" || this._matches(entry);
        if (show) hits++;
        const want = show ? "" : "none";
        if (entry.el.style.display !== want) entry.el.style.display = want;
      }
      if (this._hitsEl) {
        this._hitsEl.textContent = this._searchTerm === "" ? "" : hits + (hits === 1 ? " hit" : " hits");
      }
    }

    _matches(entry) {
      const term = this._searchTerm;
      if (term === "") return true;
      if (String(entry.sid).indexOf(term) !== -1) return true;
      if (entry.name.toLowerCase().indexOf(term) !== -1) return true;
      if (entry.msg.toLowerCase().indexOf(term) !== -1) return true;
      if (entry.clan.toLowerCase().indexOf(term) !== -1) return true;
      if (entry.kind.toLowerCase().indexOf(term) !== -1) return true;
      const verb = CHATLOG_KINDS[entry.kind].verb;
      return verb !== "" && verb.toLowerCase().indexOf(term) !== -1;
    }

    // ======================================================================
    //  APPEARANCE
    // ======================================================================

    _applyAll() {
      this._loadMutes();
      this._applyFilters();
      this._applyMutes();
      this._applyFont();
      this._applyOpacity();
      this._applySize();
      this._applyPosition(this._s("_chatLogX"), this._s("_chatLogY"));
      this._applyToggles();
    }

    _applyFont() {
      const root = this.root;
      if (!root) return;
      const family = CHATLOG_FONTS[this._s("_chatLogFont")] || CHATLOG_FONTS.manrope;
      root.style.setProperty("--cl-font", family);
      root.style.setProperty("--cl-fs", this._s("_chatLogFontSize") + "px");
    }

    _applyOpacity() {
      const root = this.root;
      if (!root) return;
      root.style.setProperty("--cl-bg-a", (this._s("_chatLogBgOpacity") / 100).toFixed(3));
      root.style.setProperty("--cl-fg-a", (this._s("_chatLogMsgOpacity") / 100).toFixed(3));
    }

    _applySize() {
      const root = this.root;
      if (!root) return;
      root.style.setProperty("--cl-w", this._s("_chatLogW") + "px");
      root.style.setProperty("--cl-h", this._s("_chatLogH") + "px");
      this._applyPosition(this._pos.x, this._pos.y);
    }

    _applyToggles() {
      const root = this.root;
      if (!root) return;
      root.classList.toggle("rcl-notime", !this._s("_chatLogTime"));
      root.classList.toggle("rcl-noid", !this._s("_chatLogID"));
      root.classList.toggle("rcl-lock", !!this._s("_chatLogLock"));
    }

    // Viewport-safe placement, applied on every move and on every window event
    // that can change the viewport — a resize, a zoom step, fullscreen in or
    // out, or a position restored from a session on a bigger monitor.
    //
    // While the panel fits, it is kept fully inside. When it does not — a very
    // small window, or a size dragged past the viewport — the header stays on
    // screen so the panel can always be grabbed and dragged back. There is no
    // arrangement of window size and saved position that can strand it.
    _applyPosition(x, y) {
      const root = this.root;
      if (!root) return;
      const w = root.offsetWidth || this._s("_chatLogW");
      const h = root.offsetHeight || this._s("_chatLogH");
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nx = vw >= w
        ? Math.min(Math.max(0, x), vw - w)
        : Math.min(0, Math.max(vw - w, x));
      const ny = Math.min(Math.max(0, y), Math.max(0, vh >= h ? vh - h : vh - 28));
      this._pos.x = nx;
      this._pos.y = ny;
      root.style.transform = "translate3d(" + nx + "px," + ny + "px,0)";
    }

    _savePosition() {
      Settings_default._chatLogX = Math.round(this._pos.x);
      Settings_default._chatLogY = Math.round(this._pos.y);
      this._saveSoon();
    }

    // ---- open / close -----------------------------------------------------
    // Closing hides the panel and nothing else. Every observation point above
    // keeps running, entries keep accumulating and keep expiring on schedule,
    // so reopening shows everything that arrived in the meantime.
    show() {
      if (!this.root) return;
      this.root.classList.remove("rcl-hidden");
      if (this._s("_chatLogOpen") !== true) {
        this._set("_chatLogOpen", true);
        this._syncMiscSwitch(true);
      }
      // Nothing laid out while the panel was hidden, so the list has no scroll
      // height to speak of until now.
      this._applyPosition(this._pos.x, this._pos.y);
      if (this._follow) this._toBottom();
    }

    hide() {
      if (!this.root) return;
      this.root.classList.add("rcl-hidden");
      this._closeMenu();
      // A hidden list has no layout to scroll; the jump to the tail is done
      // again by show().
      this._cancelScroll();
      if (this._s("_chatLogOpen") !== false) {
        this._set("_chatLogOpen", false);
        this._syncMiscSwitch(false);
      }
    }

    // The Misc page's switch and the panel's own close button are two ways to
    // the same setting, so whichever is used moves the other.
    _syncMiscSwitch(open) {
      try {
        const doc = UI_default.frame && UI_default.frame.document;
        if (!doc) return;
        const box = doc.getElementById("_chatLogOpen");
        if (box) box.checked = open;
      } catch (_) {}
    }

    toggle() {
      if (!this.ready) return;
      if (this.root.classList.contains("rcl-hidden")) this.show(); else this.hide();
    }

    isOpen() {
      return !!this.root && !this.root.classList.contains("rcl-hidden");
    }

    // A Chat Log setting was changed from somewhere other than the panel — the
    // Misc page. Re-reads the settings the panel draws from; it does not touch
    // a single entry.
    refresh() {
      if (!this.ready) return;
      this._applyFilters();
      this._applyToggles();
      this._syncControls();
    }

    // Every Chat Log setting changed at once, from the client's own global
    // reset. Same as refresh, plus the ones that are not simple switches.
    reload() {
      if (!this.ready) return;
      this._applyAll();
      this._syncControls();
      this._renderMuteList();
      if (this._s("_chatLogOpen")) this.show(); else this.hide();
    }

    // ---- resets -----------------------------------------------------------
    resetPosition() {
      Settings_default._chatLogX = defaultSettings._chatLogX;
      Settings_default._chatLogY = defaultSettings._chatLogY;
      this._saveSoon();
      this._applyPosition(defaultSettings._chatLogX, defaultSettings._chatLogY);
    }

    resetSize() {
      Settings_default._chatLogW = defaultSettings._chatLogW;
      Settings_default._chatLogH = defaultSettings._chatLogH;
      this._saveSoon();
      this._applySize();
      this._syncControls();
    }

    resetOpacity() {
      Settings_default._chatLogBgOpacity = defaultSettings._chatLogBgOpacity;
      Settings_default._chatLogMsgOpacity = defaultSettings._chatLogMsgOpacity;
      this._saveSoon();
      this._applyOpacity();
      this._syncControls();
    }

    resetFont() {
      Settings_default._chatLogFont = defaultSettings._chatLogFont;
      Settings_default._chatLogFontSize = defaultSettings._chatLogFontSize;
      this._saveSoon();
      this._applyFont();
      this._syncControls();
    }

    // Chat Log keys only. Nothing else in the client is touched — the reset
    // list is exactly the keys this feature owns.
    resetAll() {
      for (const key in defaultSettings) {
        if (key.indexOf("_chatLog") !== 0) continue;
        if (key === "_chatLogOpen" || key === "_chatLogKey") continue;
        const value = defaultSettings[key];
        Settings_default[key] = Array.isArray(value) ? value.slice() : value;
      }
      this._saveSoon();
      this._loadMutes();
      this._applyAll();
      this._syncControls();
      this._renderMuteList();
      this._search(this._searchTerm);
    }

    // ======================================================================
    //  DOM
    // ======================================================================

    _build() {
      const doc = document;
      const host = doc.body || doc.documentElement;

      const style = doc.createElement("style");
      style.id = "ryn-chatlog-style";
      style.textContent = CHATLOG_CSS;
      doc.head.appendChild(style);

      this._filterSheet = doc.createElement("style");
      this._filterSheet.id = "ryn-chatlog-filters";
      doc.head.appendChild(this._filterSheet);

      this._muteSheet = doc.createElement("style");
      this._muteSheet.id = "ryn-chatlog-mutes";
      doc.head.appendChild(this._muteSheet);

      const root = doc.createElement("div");
      root.id = "ryn-chatlog";
      root.className = "rcl-hidden";

      // --- header
      const head = doc.createElement("div");
      head.className = "rcl-head";
      const mark = doc.createElement("span");
      mark.className = "rcl-mark";
      mark.textContent = "RYN";
      const label = doc.createElement("span");
      label.className = "rcl-name-lbl";
      label.textContent = "Chat Log";
      const count = doc.createElement("span");
      count.className = "rcl-count";
      count.textContent = "0";
      this._countEl = count;
      head.appendChild(mark);
      head.appendChild(label);
      head.appendChild(count);

      const findBtn = this._iconButton("search", "Search");
      const cfgBtn = this._iconButton("gear", "Chat Log settings");
      const closeBtn = this._iconButton("close", "Close Chat Log");
      head.appendChild(findBtn);
      head.appendChild(cfgBtn);
      head.appendChild(closeBtn);
      root.appendChild(head);

      // --- search bar
      const find = doc.createElement("div");
      find.className = "rcl-find";
      find.hidden = true;
      const findInput = doc.createElement("input");
      findInput.type = "text";
      findInput.id = "ryn-chatlog-search";
      findInput.placeholder = "name, id, message, event";
      findInput.autocomplete = "off";
      findInput.spellcheck = false;
      this._findInput = findInput;
      const hits = doc.createElement("span");
      hits.className = "rcl-hits";
      this._hitsEl = hits;
      find.appendChild(findInput);
      find.appendChild(hits);
      root.appendChild(find);

      // --- body
      const body = doc.createElement("div");
      body.className = "rcl-body";
      const list = doc.createElement("div");
      list.className = "rcl-list";
      this._list = list;
      body.appendChild(list);
      const empty = doc.createElement("p");
      empty.className = "rcl-empty";
      empty.textContent = "Nothing yet. Chat, arrivals, departures, deaths and clans show up here.";
      this._emptyEl = empty;
      body.appendChild(empty);

      const pill = doc.createElement("button");
      pill.type = "button";
      pill.className = "rcl-new";
      pill.hidden = true;
      pill.innerHTML = CHATLOG_ICONS.down;
      pill.appendChild(doc.createTextNode("NEW"));
      this._newPill = pill;
      body.appendChild(pill);

      this._cfg = this._buildSettings(doc);
      body.appendChild(this._cfg);
      root.appendChild(body);

      const grip = doc.createElement("div");
      grip.className = "rcl-grip";
      root.appendChild(grip);

      host.appendChild(root);
      this.root = root;

      // --- wiring
      const closeFind = () => {
        find.hidden = true;
        findBtn.classList.remove("on");
        findInput.value = "";
        this._search("");
        findInput.blur();
      };
      findBtn.onclick = () => {
        if (find.hidden) {
          find.hidden = false;
          findBtn.classList.add("on");
          findInput.focus();
        } else {
          closeFind();
        }
      };
      cfgBtn.onclick = () => {
        this._cfgOpen = !this._cfgOpen;
        this._cfg.hidden = !this._cfgOpen;
        cfgBtn.classList.toggle("on", this._cfgOpen);
        if (this._cfgOpen) {
          this._syncControls();
          this._renderMuteList();
        }
      };
      closeBtn.onclick = () => this.hide();

      findInput.oninput = () => {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this._search(findInput.value), 120);
      };
      // The game bundle reads the keyboard off `window` in the bubble phase and
      // guards only on whether its own chat and clan panels are open — it does
      // not look at which element has focus. So a key typed into this box would
      // also swing a weapon or place a spike. Stopping propagation at the input
      // keeps it out of the bundle's handlers; the client's own handler sits in
      // the capture phase and already declines while an input has focus.
      const swallow = event => event.stopPropagation();
      findInput.addEventListener("keydown", event => {
        if (event.key === "Escape") closeFind();
        swallow(event);
      }, true);
      findInput.addEventListener("keyup", swallow, true);
      findInput.addEventListener("keypress", swallow, true);

      pill.onclick = () => this._toBottom();

      // Smart scroll. One passive listener, fired by the browser only when the
      // user actually scrolls, is the whole mechanism — there is no polling of
      // scroll position anywhere.
      list.addEventListener("scroll", () => {
        const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 12;
        if (atBottom === this._follow) return;
        this._follow = atBottom;
        if (atBottom) {
          this._pending = 0;
        }
        this._updateNewPill();
      }, { passive: true });

      list.addEventListener("click", event => this._onListClick(event));
      list.addEventListener("dblclick", event => {
        const row = this._rowOf(event.target);
        if (row) this._copy(row);
      });

      head.addEventListener("pointerdown", event => this._startDrag(event), true);
      grip.addEventListener("pointerdown", event => this._startResize(event), true);

      // One listener for the window, shared by every viewport concern there is:
      // resizing, zooming, entering and leaving fullscreen all arrive here.
      window.addEventListener("resize", () => this._applyPosition(this._pos.x, this._pos.y), { passive: true });

      doc.addEventListener("pointerdown", event => {
        if (this._menu && !this._menu.contains(event.target)) this._closeMenu();
      }, true);
    }

    _iconButton(icon, title) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rcl-ic";
      button.title = title;
      button.setAttribute("aria-label", title);
      button.innerHTML = CHATLOG_ICONS[icon];
      return button;
    }

    _rowOf(node) {
      while (node && node !== this._list) {
        if (node._clEntry !== undefined) return node;
        node = node.parentNode;
      }
      return null;
    }

    _onListClick(event) {
      const target = event.target;
      const who = target.closest ? target.closest(".rcl-who") : null;
      if (!who) return;
      const row = this._rowOf(who);
      if (row) this._openMenu(row, who);
    }

    _copy(row) {
      const entry = row._clEntry;
      if (!entry) return;
      const text = this._line(entry);
      const flash = () => {
        row.classList.add("rcl-copied");
        setTimeout(() => row.classList.remove("rcl-copied"), 380);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(flash, () => this._copyFallback(text, flash));
          return;
        }
      } catch (_) {}
      this._copyFallback(text, flash);
    }

    // execCommand still works where the clipboard API is refused — an insecure
    // origin, or a document that does not have focus.
    _copyFallback(text, done) {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.cssText = "position:fixed;top:-1000px;opacity:0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        done();
      } catch (_) {}
    }

    _openMenu(row, anchor) {
      this._closeMenu();
      const entry = row._clEntry;
      if (!entry) return;
      const doc = document;
      const menu = doc.createElement("div");
      menu.className = "rcl-menu";

      const header = doc.createElement("div");
      header.className = "rcl-menu-h";
      header.dir = "auto";
      header.textContent = (entry.name || "unknown") + " [" + entry.sid + "]";
      menu.appendChild(header);

      const copy = doc.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy entry";
      copy.onclick = () => { this._copy(row); this._closeMenu(); };
      menu.appendChild(copy);

      const muted = this.isMuted(entry.sid);
      const mute = doc.createElement("button");
      mute.type = "button";
      mute.textContent = muted ? "Unmute player" : "Mute player";
      if (!muted) mute.className = "danger";
      mute.onclick = () => {
        if (muted) this.unmute(entry.sid); else this.mute(entry.sid, entry.name);
        this._closeMenu();
      };
      menu.appendChild(mute);

      this.root.appendChild(menu);
      const box = this.root.getBoundingClientRect();
      const spot = anchor.getBoundingClientRect();
      const left = Math.min(Math.max(2, spot.left - box.left), Math.max(2, box.width - menu.offsetWidth - 2));
      const below = spot.bottom - box.top + 3;
      const top = below + menu.offsetHeight > box.height - 2
        ? Math.max(2, spot.top - box.top - menu.offsetHeight - 3)
        : below;
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      this._menu = menu;
    }

    _closeMenu() {
      if (!this._menu) return;
      this._menu.remove();
      this._menu = null;
    }

    // ---- drag / resize ----------------------------------------------------
    // Both share one pattern: the move listener is added on pointerdown and
    // removed on pointerup, so nothing is listening while nobody is dragging;
    // and the move handler only records coordinates, with the single write to
    // the element happening once per frame.
    _startDrag(event) {
      if (event.button !== 0 || this._s("_chatLogLock")) return;
      if (event.target.closest && event.target.closest(".rcl-ic")) return;
      event.preventDefault();
      this._beginPointer(event, {
        mode: "move",
        ox: event.clientX - this._pos.x,
        oy: event.clientY - this._pos.y
      });
      this.root.classList.add("rcl-drag");
    }

    _startResize(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      this._beginPointer(event, {
        mode: "size",
        ox: event.clientX - this.root.offsetWidth,
        oy: event.clientY - this.root.offsetHeight
      });
    }

    _beginPointer(event, state) {
      state.x = event.clientX;
      state.y = event.clientY;
      this._drag = state;
      const move = e => {
        if (!this._drag) return;
        this._drag.x = e.clientX;
        this._drag.y = e.clientY;
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
          this._raf = 0;
          this._applyPointer();
        });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (this._raf) {
          cancelAnimationFrame(this._raf);
          this._raf = 0;
          this._applyPointer();
        }
        const mode = this._drag ? this._drag.mode : "";
        this._drag = null;
        this.root.classList.remove("rcl-drag");
        if (mode === "move") {
          this._savePosition();
        } else if (mode === "size") {
          this._saveSoon();
          this._syncControls();
          if (this._follow) this._toBottom();
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    }

    _applyPointer() {
      const drag = this._drag;
      if (!drag || !this.root) return;
      if (drag.mode === "move") {
        this._applyPosition(drag.x - drag.ox, drag.y - drag.oy);
        return;
      }
      const w = Math.round(Math.min(Math.max(200, drag.x - drag.ox), Math.max(200, window.innerWidth - this._pos.x)));
      const h = Math.round(Math.min(Math.max(110, drag.y - drag.oy), Math.max(110, window.innerHeight - this._pos.y)));
      Settings_default._chatLogW = w;
      Settings_default._chatLogH = h;
      this.root.style.setProperty("--cl-w", w + "px");
      this.root.style.setProperty("--cl-h", h + "px");
    }

    // ======================================================================
    //  SETTINGS SHEET
    // ======================================================================

    _buildSettings(doc) {
      const cfg = doc.createElement("div");
      cfg.className = "rcl-cfg";
      cfg.hidden = true;
      const scroll = doc.createElement("div");
      scroll.className = "rcl-cfg-scroll";
      cfg.appendChild(scroll);
      this._controls = {};

      const group = title => {
        const el = doc.createElement("div");
        el.className = "rcl-grp";
        el.textContent = title;
        scroll.appendChild(el);
      };
      const row = title => {
        const el = doc.createElement("div");
        el.className = "rcl-row";
        const label = doc.createElement("span");
        label.textContent = title;
        el.appendChild(label);
        scroll.appendChild(el);
        return el;
      };
      const toggle = (title, key, after) => {
        const host = row(title);
        const wrap = doc.createElement("label");
        wrap.className = "rcl-sw";
        const input = doc.createElement("input");
        input.type = "checkbox";
        input.id = "ryn-chatlog-" + key;
        input.checked = !!this._s(key);
        const knob = doc.createElement("i");
        wrap.appendChild(input);
        wrap.appendChild(knob);
        host.appendChild(wrap);
        input.onchange = () => {
          this._set(key, input.checked);
          if (after) after();
        };
        this._controls[key] = input;
        return input;
      };
      const slider = (title, key, min, max, step, suffix, after) => {
        const host = row(title);
        const input = doc.createElement("input");
        input.type = "range";
        input.id = "ryn-chatlog-" + key;
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(this._s(key));
        const value = doc.createElement("span");
        value.className = "rcl-num";
        value.textContent = this._s(key) + suffix;
        host.appendChild(input);
        host.appendChild(value);
        input.oninput = () => {
          const n = Number(input.value);
          this._set(key, n);
          value.textContent = n + suffix;
          if (after) after();
        };
        this._controls[key] = input;
        this._controls[key + ":out"] = value;
        this._controls[key + ":sfx"] = suffix;
        return input;
      };
      const button = (title, cls, onClick) => {
        const el = doc.createElement("button");
        el.type = "button";
        el.className = "rcl-btn" + (cls ? " " + cls : "");
        el.textContent = title;
        el.onclick = onClick;
        return el;
      };

      group("Appearance");
      const fontRow = row("Font");
      const fontSelect = doc.createElement("select");
      fontSelect.id = "ryn-chatlog-font";
      const fontNames = {
        manrope: "Manrope",
        grotesk: "Space Grotesk",
        hammersmith: "Hammersmith One",
        system: "System",
        mono: "Monospace"
      };
      for (const key in CHATLOG_FONTS) {
        const option = doc.createElement("option");
        option.value = key;
        option.textContent = fontNames[key];
        fontSelect.appendChild(option);
      }
      fontSelect.value = this._s("_chatLogFont");
      fontSelect.onchange = () => {
        this._set("_chatLogFont", fontSelect.value);
        this._applyFont();
      };
      fontRow.appendChild(fontSelect);
      this._controls._chatLogFont = fontSelect;

      slider("Font size", "_chatLogFontSize", 10, 20, 1, "px", () => this._applyFont());
      slider("Background opacity", "_chatLogBgOpacity", 0, 100, 1, "%", () => this._applyOpacity());
      slider("Message opacity", "_chatLogMsgOpacity", 25, 100, 1, "%", () => this._applyOpacity());
      slider("Width", "_chatLogW", 200, 900, 5, "", () => this._applySize());
      slider("Height", "_chatLogH", 110, 800, 5, "", () => this._applySize());

      group("Display");
      toggle("Show time", "_chatLogTime", () => this._applyToggles());
      toggle("Show player ID", "_chatLogID", () => this._applyToggles());
      toggle("Lock position", "_chatLogLock", () => this._applyToggles());

      group("Events");
      toggle("Messages", "_chatLogFChat", () => this._applyFilters());
      toggle("Player join", "_chatLogFJoin", () => this._applyFilters());
      toggle("Player leave", "_chatLogFLeave", () => this._applyFilters());
      toggle("Player death", "_chatLogFDeath", () => this._applyFilters());
      toggle("Clan created", "_chatLogFClanNew", () => this._applyFilters());
      toggle("Clan join", "_chatLogFClanJoin", () => this._applyFilters());
      toggle("Bot messages", "_chatLogBotMsg", () => this._applyFilters());
      toggle("Bot events", "_chatLogBotEvents", () => this._applyFilters());

      group("Muted players");
      const muteList = doc.createElement("div");
      muteList.className = "rcl-muted";
      this._muteListEl = muteList;
      scroll.appendChild(muteList);

      group("Reset");
      const resets = doc.createElement("div");
      resets.className = "rcl-btns";
      resets.appendChild(button("Position", "", () => this.resetPosition()));
      resets.appendChild(button("Size", "", () => this.resetSize()));
      resets.appendChild(button("Opacity", "", () => this.resetOpacity()));
      resets.appendChild(button("Font", "", () => this.resetFont()));
      resets.appendChild(button("Reset all", "", () => this.resetAll()));
      resets.appendChild(button("Clear log", "danger", () => this.clear()));
      scroll.appendChild(resets);

      return cfg;
    }

    // Pulls the sheet back in line with the settings after something else
    // changed them — a reset, a drag on the resize grip, or the Misc page.
    _syncControls() {
      const controls = this._controls;
      if (!controls) return;
      for (const key in controls) {
        if (key.indexOf(":") !== -1) continue;
        const control = controls[key];
        const value = this._s(key);
        if (control.type === "checkbox") {
          control.checked = !!value;
        } else {
          control.value = String(value);
          const out = controls[key + ":out"];
          if (out) out.textContent = value + controls[key + ":sfx"];
        }
      }
    }

    _renderMuteList() {
      const host = this._muteListEl;
      if (!host) return;
      host.textContent = "";
      if (this._muted.size === 0) {
        const none = document.createElement("span");
        none.className = "rcl-none";
        none.textContent = "No one is muted.";
        host.appendChild(none);
        return;
      }
      for (const pair of this._muted) {
        const sid = pair[0];
        const chip = document.createElement("span");
        chip.className = "rcl-chip";
        const label = document.createElement("span");
        label.dir = "auto";
        label.textContent = (pair[1] || "unknown") + " [" + sid + "]";
        const off = document.createElement("button");
        off.type = "button";
        off.title = "Unmute";
        off.setAttribute("aria-label", "Unmute " + (pair[1] || sid));
        off.textContent = "✕";
        off.onclick = () => this.unmute(sid);
        chip.appendChild(label);
        chip.appendChild(off);
        host.appendChild(chip);
      }
    }
  }();
  const ChatLog_default = ChatLog;
