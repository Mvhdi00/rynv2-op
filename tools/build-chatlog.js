#!/usr/bin/env node
/*
 * build-chatlog.js — integrates the Chat Log into Ryn Type 2.
 *
 * The client is a single 38k-line userscript, so the integration is expressed
 * as a list of anchored edits rather than a hand-edited blob. Every edit names
 * the exact text it expects to find and fails the build if that text is not
 * there exactly once, which is what keeps the integration honest against a
 * future version of the client: a moved anchor is a loud failure, not a silent
 * no-op.
 *
 *   node tools/build-chatlog.js            patch Ryn_Type2.user.js in place
 *   node tools/build-chatlog.js --check    report what would change, write nothing
 *
 * The module itself lives in tools/chatlog/chatlog.js and its stylesheet in
 * tools/chatlog/chatlog.css; both are injected verbatim.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, "Ryn_Type2.user.js");
const MODULE = path.join(ROOT, "tools", "chatlog", "chatlog.js");
const STYLE = path.join(ROOT, "tools", "chatlog", "chatlog.css");

const checkOnly = process.argv.includes("--check");

let source = fs.readFileSync(TARGET, "utf8");
const moduleSource = fs.readFileSync(MODULE, "utf8");
const styleSource = fs.readFileSync(STYLE, "utf8");

const applied = [];

/** Replace `find` with `replace`, requiring exactly one occurrence. */
function edit(name, find, replace) {
  const first = source.indexOf(find);
  if (first === -1) throw new Error(`[${name}] anchor not found`);
  if (source.indexOf(find, first + 1) !== -1) throw new Error(`[${name}] anchor is not unique`);
  source = source.slice(0, first) + replace + source.slice(first + find.length);
  applied.push(name);
}

/** Insert `text` immediately before `find`, requiring exactly one occurrence. */
function before(name, find, text) {
  edit(name, find, text + find);
}

/** Insert `text` immediately after `find`, requiring exactly one occurrence. */
function after(name, find, text) {
  edit(name, find, find + text);
}

/**
 * The menu pages are stored as JS string literals, so a fragment of one has to
 * be escaped the same way the client escapes them before it can be matched or
 * inserted. JSON's escaping is exactly what the client's build produced.
 */
function esc(html) {
  return JSON.stringify(html).slice(1, -1);
}

if (source.includes("RYN TYPE 2 — CHAT LOG")) {
  console.error("Ryn_Type2.user.js already carries the Chat Log — nothing to do.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 1. Settings. The client prunes any stored key that is not in defaultSettings,
//    so every Chat Log setting has to be declared here to survive a reload.
// ---------------------------------------------------------------------------

before("defaults", `    _velocityTickTimes: 0,
  };
  const storedSettings = CustomStorage.get("RYN") || {};`, `    // ---- Chat Log ----------------------------------------------------
    // Everything the panel remembers between sessions. It rides the client's
    // own settings store — one localStorage record under "RYN", written
    // through SaveSettings — rather than a second store of its own.
    _chatLogOpen: true,
    _chatLogKey: "KeyL",
    _chatLogX: 14,
    _chatLogY: 52,
    // Joined to the Ryn Type 2 corner mark. Drag the panel away to separate
    // them, drop it back under the mark to join them again.
    _chatLogDocked: true,
    _chatLogW: 340,
    _chatLogH: 260,
    _chatLogBgOpacity: 55,
    _chatLogMsgOpacity: 100,
    _chatLogFont: "manrope",
    _chatLogFontSize: 12,
    _chatLogTime: true,
    _chatLogID: true,
    _chatLogLock: false,
    // Event filters. Display only — the log collects every event whatever
    // these say, so switching one back on shows what arrived while it was off.
    _chatLogFChat: true,
    _chatLogFJoin: true,
    _chatLogFLeave: true,
    _chatLogFDeath: true,
    _chatLogFClanNew: true,
    _chatLogFClanJoin: true,
    // Bots are yours and there can be forty of them, so their chat is off by
    // default and their arrivals and departures are not.
    _chatLogBotMsg: false,
    _chatLogBotEvents: true,
    // [[sid, lastKnownName], ...]. Keyed on the player id so a rename does not
    // shake a mute off.
    _chatLogMuted: [],
`);

// ---------------------------------------------------------------------------
// 2. The module. Placed after the settings store it reads and before the first
//    thing that calls into it.
// ---------------------------------------------------------------------------

before("module", "  const GameUI = new class {\n    getElements() {",
  "  const CHATLOG_CSS = " + JSON.stringify(styleSource) + ";\n\n" + moduleSource + "\n");

// ---------------------------------------------------------------------------
// 3. Packet observation. Each of these sits beside code that already runs for
//    the same packet, is taken only on the owner's connection, and cannot throw
//    into the handler around it.
// ---------------------------------------------------------------------------

after("packet:chat", `          const player = PlayerManager2.playerData.get(id);
          if (this.client.isOwner) {
            RYNLink.handleChat(this.client, id, player, message);
          }`, `
          if (this.client.isOwner) {
            try {
              ChatLog_default.onChat(this.client, id, player, message);
            } catch (_) {}
          }`);

before("packet:spawn", `          this.handlePlayerInit(player);`, `          // A connection's first "D" is an arrival; every later one is that
          // player respawning. The Chat Log tells them apart by the connection
          // id in data2[0], which is also how a leave is matched back to a
          // player id.
          if (this.client.isOwner) {
            try {
              ChatLog_default.onSpawn(this.client, data2);
            } catch (_) {}
          }
`);

edit("packet:leave+health", `       case "O":
        {
          const player = PlayerManager2.playerData.get(temp[1]);
          if (player !== void 0) {
            player.updateHealth(temp[2]);
          }
          break;
        }`, `       // Nothing in the client needed this: a player it stops being told
       // about simply stops being drawn, so the case never existed. It is the
       // only packet that means gone-for-good, which is exactly what separates
       // a leave from a death and from a respawn, so the Chat Log reads it
       // here. The client's own model is untouched.
       case "E":
        if (this.client.isOwner) {
          try {
            ChatLog_default.onRemove(this.client, temp[1]);
          } catch (_) {}
        }
        break;

       case "O":
        {
          const player = PlayerManager2.playerData.get(temp[1]);
          if (player !== void 0) {
            player.updateHealth(temp[2]);
          }
          // Zero health is the server stating a player is dead — the one death
          // signal this protocol carries for somebody else's character.
          if (this.client.isOwner) {
            try {
              ChatLog_default.onHealth(this.client, temp[1], temp[2]);
            } catch (_) {}
          }
          break;
        }`);

edit("packet:owndeath", `       case "P":
        myPlayer.reset();
        this.client.InputHandler.reset();
        break;`, `       case "P":
        // Ahead of the reset, which clears the state the entry is named from.
        // The server telling this client it died is the one death there can be
        // no argument about.
        if (this.client.isOwner) {
          try {
            ChatLog_default.onOwnDeath(this.client);
          } catch (_) {}
        }
        myPlayer.reset();
        this.client.InputHandler.reset();
        break;`);

after("packet:clan", `       case "g":
        PlayerManager2.createClan(temp[1].sid, temp[1].owner);`, `
        if (this.client.isOwner) {
          try {
            ChatLog_default.onClanCreated(this.client, temp[1].sid, temp[1].owner);
          } catch (_) {}
        }`);

// ---------------------------------------------------------------------------
// 4. Clan membership, read off the player update the client already decodes.
//    One reference read and one string comparison per visible player, inside a
//    loop that was running anyway — and the call only happens when the field
//    actually changed.
// ---------------------------------------------------------------------------

edit("tick:clan", `        const player = this.playerData.get(id);
        this.players.push(player);
        player.update(id, buffer[i + 1], buffer[i + 2], buffer[i + 3], buffer[i + 4], buffer[i + 5], buffer[i + 6], buffer[i + 7], buffer[i + 8], buffer[i + 9], buffer[i + 10], buffer[i + 11], buffer[i + 12]);
        player.corpseSeenTick = corpseTick;`, `        const player = this.playerData.get(id);
        this.players.push(player);
        // The clan the server last reported for this player, held across the
        // update so the real membership transition the update carries can be
        // seen. buffer[i + 7] is that field; the comparison is against what
        // update() writes from it rather than against the buffer, so it is the
        // client's own notion of the player's clan that is being watched.
        const prevClanName = player.clanName;
        player.update(id, buffer[i + 1], buffer[i + 2], buffer[i + 3], buffer[i + 4], buffer[i + 5], buffer[i + 6], buffer[i + 7], buffer[i + 8], buffer[i + 9], buffer[i + 10], buffer[i + 11], buffer[i + 12]);
        if (isOwner && player.clanName !== prevClanName) {
          try {
            ChatLog_default.onClanChange(this.client, player, prevClanName);
          } catch (_) {}
        }
        player.corpseSeenTick = corpseTick;`);

// ---------------------------------------------------------------------------
// 5. Deaths RYN credited you with, on the existing post-tick. Before the corpse
//    renderer, which consumes the same last-seen marker; the Chat Log keeps its
//    own stamp so neither can eat the other's evidence.
// ---------------------------------------------------------------------------

before("tick:death", `        // Purely visual, and last: it reads the kill flag tickUpdate has just
        // raised and writes nothing any module will see.
        CorpseHandler.tick(this);`, `        // Reads the same kill flag the corpse renderer does, and leaves after
        // two property reads on every tick where nobody died. Runs first
        // because CorpseHandler consumes corpseSeenTick when it claims a body.
        try {
          ChatLog_default.tick(this);
        } catch (_) {}
`);

// ---------------------------------------------------------------------------
// 6. Mute, at the game bundle's own presentation layer.
// ---------------------------------------------------------------------------

before("hook:chatMute", `    Hook.replace("maskFRVR", /window\\.FRVR/, "FRVR", "g");`, `    // The bundle's entire chat display:
    //
    //     function dl(e,t){const i=Rt(e);i&&(i.chatMessage=t,i.chatCountdown=y.chatCountdown)}
    //
    // \`e\` is the sender's sid and those two assignments are the whole act of
    // showing a message — the render loop draws the bubble for as long as
    // chatCountdown is above zero and reads nothing else about it. So not
    // making them for a muted sender is precisely a presentation filter: the
    // packet still arrives and is still decoded, the socket is untouched,
    // nothing is blocked, every other player's chat is unaffected, and what
    // this client sends is not involved at all. A mute asks about the sid, so
    // it holds through a rename.
    Hook.replace("chatMute", /function (\\w+)\\((\\w+),(\\w+)\\)\\{const (\\w+)=(\\w+)\\(\\2\\);\\4&&\\(\\4\\.chatMessage=\\3,\\4\\.chatCountdown=(\\w+)\\.chatCountdown\\)\\}/, "function $1($2,$3){if(RYN._ChatLog&&RYN._ChatLog.isMuted($2))return;const $4=$5($2);$4&&($4.chatMessage=$3,$4.chatCountdown=$6.chatCountdown)}");
`);

// ---------------------------------------------------------------------------
// 7. Exposure to the rewritten bundle, and start-up.
// ---------------------------------------------------------------------------

before("expose", `    _settings: Settings_default,
    _Renderer: Renderer_default,`, `    // Read by the bundle's chat display, and by nothing else in it.
    _ChatLog: ChatLog_default,
`);

// The Misc page's "Reset all settings" puts every key in the client back to its
// default, the Chat Log's among them. The panel is already drawn from the old
// ones, so it is told to read them again — the same thing resetFrame does for
// the menu on the next line.
edit("reset:global", `    SaveSettings();
    UI_default.resetFrame();
  };`, `    SaveSettings();
    UI_default.resetFrame();
    try {
      ChatLog_default.reload();
    } catch (_) {}
  };`);

edit("boot", `    client.InputHandler.init();
    GameUI_default.init();
    UI_default.init();
    StoreHandler_default.init();`, `    client.InputHandler.init();
    GameUI_default.init();
    UI_default.init();
    StoreHandler_default.init();
    ChatLog_default.init();`);

// ---------------------------------------------------------------------------
// 8. Playing or not. The panel belongs to the game rather than to the menu you
//    launch it from, so it stays out of sight until this client has spawned.
//    These are the client's own two answers to the question — nothing new is
//    tracked, and the log keeps collecting either way.
// ---------------------------------------------------------------------------

edit("state:spawn", `    playerSpawn() {
      this.inGame = true;`, `    playerSpawn() {
      this.inGame = true;
      if (this.client.isOwner) {
        try {
          ChatLog_default.setInGame(true);
        } catch (_) {}
      }`);

edit("state:reset", `      ModuleHandler.reset();
      this.inGame = false;
      this.wasDead = true;`, `      ModuleHandler.reset();
      this.inGame = false;
      // Dying puts moomoo back on its own menu card, so the panel goes with it
      // and returns on the next spawn.
      if (this.client.isOwner) {
        try {
          ChatLog_default.setInGame(false);
        } catch (_) {}
      }
      this.wasDead = true;`);

// ---------------------------------------------------------------------------
// 9. Keyboard. The hotkey sits with Toggle Menu, above the in-game guard, so it
//    works from the lobby too; and the chat key learns to leave the log's own
//    search box alone, which is the one branch here that acts without first
//    checking for a focused input.
// ---------------------------------------------------------------------------

edit("input:hotkey", `      if (event.code === Settings_default._toggleChat && !UI_default.isMenuOpened) {
        GameUI_default.handleEnter(event);
      }`, `      if (Settings_default._chatLogKey && event.code === Settings_default._chatLogKey && !isInput && !UI_default.isMenuOpened) {
        try {
          ChatLog_default.toggle();
        } catch (_) {}
      }
      if (event.code === Settings_default._toggleChat && !UI_default.isMenuOpened && !ChatLog_default.ownsInput()) {
        GameUI_default.handleEnter(event);
      }`);

// ---------------------------------------------------------------------------
// 10. Menu pages. The Misc switch and the bot preferences go through the
//     client's existing checkbox binding, and the hotkey through its existing
//     hotkey binding — no second settings path for either.
// ---------------------------------------------------------------------------

const MISC_ANCHOR = `    <div class="section">
        <div class="section-title">Menu<span class="sec-sub">How this interface itself behaves.</span></div>`;

const MISC_SECTION = `    <div class="section">
        <div class="section-title">Chat Log<span class="sec-sub">The log in the corner: what was said, who arrived, who left, who died, and who formed or joined a clan. Size, opacity, font, filters and mutes live behind the gear on the panel itself.</span></div>
        <div class="section-content">
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Show Chat Log</span>
                    <span class="opt-desc">Closing it only puts the panel away. It keeps recording, and everything from the last fifteen minutes is still there when you open it again.</span>
                </div>
                <label class="switch-checkbox"><input id="_chatLogOpen" type="checkbox"><span></span></label>
            </div>
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Bot messages</span>
                    <span class="opt-desc">Whether chat from your own bots is listed. Off by default &mdash; forty bots fill a log quickly.</span>
                </div>
                <label class="switch-checkbox"><input id="_chatLogBotMsg" type="checkbox"><span></span></label>
            </div>
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Bot events</span>
                    <span class="opt-desc">Whether your bots joining, leaving and dying is listed.</span>
                </div>
                <label class="switch-checkbox"><input id="_chatLogBotEvents" type="checkbox"><span></span></label>
            </div>
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Lock position</span>
                    <span class="opt-desc">Stops the panel being dragged by accident. Resizing still works.</span>
                </div>
                <label class="switch-checkbox"><input id="_chatLogLock" type="checkbox"><span></span></label>
            </div>
        </div>
    </div>

`;

before("misc:page", esc(MISC_ANCHOR), esc(MISC_SECTION));

const KEYBIND_ANCHOR = `            <div class="content-option">
                <div class="opt-main"><span class="option-title">Instakill</span></div>
                <div class="option-content"><span class="key-state"></span><button id="_instakill" class="hotkeyInput"></button></div>
            </div>`;

const KEYBIND_ROW = `
            <div class="content-option">
                <div class="opt-main"><span class="option-title">Toggle Chat Log</span></div>
                <div class="option-content"><span class="key-state"></span><button id="_chatLogKey" class="hotkeyInput"></button></div>
            </div>`;

after("keybinds:page", esc(KEYBIND_ANCHOR), esc(KEYBIND_ROW));

// The Misc switches have to do something the moment they are flipped; every
// other Chat Log control is a plain setting the module reads when it needs it.
edit("checkbox:toggle", `       case "_autoplacer":
        syncPlacerSlaves();
        SaveSettings();
        break;`, `       case "_autoplacer":
        syncPlacerSlaves();
        SaveSettings();
        break;

       case "_chatLogOpen":
        try {
          if (checked) ChatLog_default.show(); else ChatLog_default.hide();
        } catch (_) {}
        break;

       case "_chatLogBotMsg":
       case "_chatLogBotEvents":
        try {
          ChatLog_default.refresh();
        } catch (_) {}
        break;

       case "_chatLogLock":
        try {
          ChatLog_default.refresh();
        } catch (_) {}
        break;`);

// ---------------------------------------------------------------------------

if (checkOnly) {
  console.log("would apply " + applied.length + " edits:\n  " + applied.join("\n  "));
} else {
  fs.writeFileSync(TARGET, source);
  console.log("applied " + applied.length + " edits to " + path.relative(ROOT, TARGET) + ":\n  " + applied.join("\n  "));
}
