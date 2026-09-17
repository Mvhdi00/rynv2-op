#!/usr/bin/env node
/*
 * preview.js — builds a standalone page that runs the Chat Log exactly as it
 * ships.
 *
 * The module is cut out of the built Ryn_Type2.user.js rather than read from
 * tools/chatlog/chatlog.js, so what the page exercises is the integrated code,
 * not a copy of it. The handful of client objects it closes over (the settings
 * store, SaveSettings, Logger, the menu frame) are stubbed with the same
 * shapes the client gives them, and the observation entry points are then
 * driven with real packet payloads.
 *
 *   node tools/chatlog/preview.js [out.html]
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const out = process.argv[2] || path.join(ROOT, "tools", "chatlog", "preview.html");
const source = fs.readFileSync(path.join(ROOT, "Ryn_Type2.user.js"), "utf8");

const START = "  const CHATLOG_CSS = ";
const END = "  const ChatLog_default = ChatLog;";
const from = source.indexOf(START);
const to = source.indexOf(END);
if (from === -1 || to === -1) throw new Error("Chat Log module not found in Ryn_Type2.user.js");
const moduleSource = source.slice(from, to + END.length);

// The Chat Log defaults, read back out of the client's own defaultSettings so
// the page cannot drift from what ships.
const defaults = {};
const block = source.slice(source.indexOf("  const defaultSettings = {"), source.indexOf("  const storedSettings ="));
const re = /^\s*(_chatLog\w*): (.+?),\s*$/gm;
let match;
while ((match = re.exec(block)) !== null) defaults[match[1]] = match[2];

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ryn Type 2 — Chat Log</title>
<style>
  html, body { height: 100%; }
  body {
    margin: 0;
    background:
      radial-gradient(1100px 620px at 22% 14%, #2a2340 0%, rgba(42,35,64,0) 62%),
      radial-gradient(900px 560px at 84% 82%, #1b2c2a 0%, rgba(27,44,42,0) 60%),
      #0b0b10;
    font-family: 'Manrope', system-ui, sans-serif;
    color: #726f80;
    overflow: hidden;
  }
  /* A stand-in for the game canvas, so the panel is judged over something and
     not over a blank page. */
  #ground {
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
    background-size: 64px 64px;
    pointer-events: none;
  }
  #hint {
    position: fixed; right: 16px; bottom: 14px;
    font-size: 11px; letter-spacing: 0.04em; text-align: right; line-height: 1.7;
  }
  #hint b { color: #9bc5e8; font-weight: 600; }
  #tests {
    position: fixed; right: 16px; top: 16px;
    max-width: 330px;
    font: 11px/1.6 'Space Grotesk', ui-monospace, monospace;
    white-space: pre-wrap;
    color: #aca9ba;
  }
</style>
</head>
<body>
<div id="ground"></div>
<div id="tests"></div>
<p id="hint">
  drag the <b>header</b> &middot; drag the <b>corner</b> to resize<br>
  click a <b>name</b> to mute or copy &middot; double-click a <b>row</b> to copy<br>
  <b>gear</b> for settings &middot; <b>magnifier</b> to search
</p>
<script>
// ---- client stubs -------------------------------------------------------
const defaultSettings = {
${Object.keys(defaults).map(k => "  " + k + ": " + defaults[k] + ",").join("\n")}
};
const Settings_default = Object.assign({}, defaultSettings, { _chatLogMuted: [] });
const SaveSettings = () => {};
const Logger = { error: m => console.error(m), warn: m => console.warn(m), test: m => console.log(m) };
const UI_default = { frame: null };

${moduleSource}

// ---- the client objects the observation points are handed ----------------
function makePlayer(sid, nickname) {
  return { id: sid, nickname, clanName: null, corpseSeenTick: 0, pos: { current: { x: 0, y: 0 } } };
}
const playerData = new Map();
const client = {
  isOwner: true,
  clientIDList: new Set([ 900, 901 ]),
  isBotByID(sid) { return this.clientIDList.has(sid); },
  myPlayer: { id: 1, nickname: "Raptor", killedSomeone: false, resources: { kills: 0 },
              pos: { current: { x: 0, y: 0 } }, isEnemyByID: () => true },
  PlayerManager: { client: null, playerData, corpseTick: 0 }
};
client.PlayerManager.client = client;

// A player arriving is the "D" packet: [socketID, sid, nickname, ...].
function spawn(socketID, sid, nickname) {
  if (!playerData.has(sid)) playerData.set(sid, makePlayer(sid, nickname));
  playerData.get(sid).nickname = nickname;
  ChatLog.onSpawn(client, [ socketID, sid, nickname, 0, 0, 0, 100, 100, 35, 0 ]);
}

ChatLog.init();
ChatLog.show();

// ---- a plausible session ------------------------------------------------
spawn("s1", 1, "Raptor");
spawn("s2", 12, "Kenny");
spawn("s3", 47, "حسن");
spawn("s4", 108, "xXx_LongestNameOnTheServer_xXx");
spawn("s5", 900, "Ryn 1");
spawn("s6", 901, "Ryn 2");

ChatLog.onChat(client, 12, playerData.get(12), "hey");
ChatLog.onChat(client, 47, playerData.get(47), "السلام عليكم يا شباب");
ChatLog.onChat(client, 1, playerData.get(1), "wb");
ChatLog.onClanCreated(client, "NOVA", 12);
playerData.get(12).clanName = "NOVA";
ChatLog.onClanChange(client, playerData.get(12), null);
playerData.get(47).clanName = "NOVA";
ChatLog.onClanChange(client, playerData.get(47), null);
ChatLog.onChat(client, 47, playerData.get(47), "clan NOVA فيه 3 لاعبين now");
ChatLog.onChat(client, 108, playerData.get(108),
  "this one runs long on purpose so the wrap and the hanging indent can be judged at a glance");
ChatLog.onChat(client, 900, playerData.get(900), "bot line, hidden until Bot messages is on");
ChatLog.onHealth(client, 108, 0);
ChatLog.onChat(client, 12, playerData.get(12), "ez");
ChatLog.onChat(client, 12, playerData.get(12), "ez");
ChatLog.onChat(client, 12, playerData.get(12), "ez");
ChatLog.onRemove(client, "s4");
ChatLog.onChat(client, 47, playerData.get(47), "رحل 😭");

// ---- checks -------------------------------------------------------------
// Assertions over the module's real state, printed on the page so a screenshot
// carries the result.
const results = [];
const check = (name, ok, detail) => results.push((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  (" + detail + ")" : ""));
const kinds = k => ChatLog.entries.filter(e => e.kind === k).length;
const visible = () => Array.from(document.querySelectorAll("#ryn-chatlog .rcl-e"))
  .filter(el => getComputedStyle(el).display !== "none").length;

check("join x6", kinds("join") === 6, kinds("join"));
check("respawn is not a join", (spawn("s2", 12, "Kenny"), kinds("join") === 6), kinds("join"));
check("leave x1", kinds("leave") === 1, kinds("leave"));
check("death x1", kinds("death") === 1, kinds("death"));
check("one death, three detectors",
  (ChatLog.onHealth(client, 108, 0), ChatLog.onHealth(client, 108, -5), kinds("death") === 1), kinds("death"));
check("clan created x1", kinds("clanNew") === 1, kinds("clanNew"));
check("clan join x1 (creator is not a joiner)", kinds("clanJoin") === 1, kinds("clanJoin"));
check("repeated identical chat is kept", ChatLog.entries.filter(e => e.msg === "ez").length === 3);
check("arabic preserved byte for byte",
  ChatLog.entries.some(e => e.msg === "السلام عليكم يا شباب"));
check("message content untouched",
  ChatLog.entries.some(e => e.msg === "clan NOVA فيه 3 لاعبين now"));
check("bot chat hidden by default",
  !Array.from(document.querySelectorAll('#ryn-chatlog .rcl-e[data-bot="1"][data-kind="chat"]'))
    .some(el => getComputedStyle(el).display !== "none"));
check("bot events shown by default",
  Array.from(document.querySelectorAll('#ryn-chatlog .rcl-e[data-bot="1"][data-kind="join"]'))
    .some(el => getComputedStyle(el).display !== "none"));

const before = visible();
ChatLog.mute(12, "Kenny");
const afterMute = visible();
check("mute hides that player's chat only",
  afterMute === before - 4 && ChatLog.isMuted(12) && !ChatLog.isMuted(47),
  before + " -> " + afterMute);
check("muted player's events still listed",
  getComputedStyle(document.querySelector('#ryn-chatlog .rcl-e[data-kind="clanNew"]')).display !== "none");
check("other players stay visible",
  Array.from(document.querySelectorAll('#ryn-chatlog .rcl-e[data-sid="47"][data-kind="chat"]'))
    .every(el => getComputedStyle(el).display !== "none"));
ChatLog.unmute(12);
check("unmute restores", visible() === before, visible() + " vs " + before);

ChatLog._search("47");
check("search by id", document.querySelectorAll('#ryn-chatlog .rcl-e[data-sid="47"]').length > 0 &&
  Array.from(document.querySelectorAll("#ryn-chatlog .rcl-e"))
    .filter(el => el.style.display !== "none").every(el => el.dataset.sid === "47"));
ChatLog._search("ez");
check("search by message", visible() === 3, visible());
ChatLog._search("");
check("search cleared", visible() === before, visible());

const line = ChatLog._line(ChatLog.entries.find(e => e.kind === "chat" && e.sid === 12));
check("copy format", /^\\d\\d:\\d\\d Kenny \\[12\\]: /.test(line), line);
const joinLine = ChatLog._line(ChatLog.entries.find(e => e.kind === "join" && e.sid === 12));
check("copy format (event)", /^\\d\\d:\\d\\d Kenny \\[12\\] joined the server$/.test(joinLine), joinLine);

check("one expiry timer", typeof ChatLog._expiryTimer === "number" && ChatLog._expiryTimer !== 0);
const kept = ChatLog.entries.length;
ChatLog.entries[0].t = Date.now() - 16 * 60 * 1000;
ChatLog._expire();
check("15-minute expiry drops the entry and its row",
  ChatLog.entries.length === kept - 1 && document.querySelectorAll("#ryn-chatlog .rcl-e").length === kept - 1);

// Closed, still recording.
ChatLog.hide();
ChatLog.onChat(client, 47, playerData.get(47), "while closed");
const whileClosed = ChatLog.entries.length;
ChatLog.show();
check("records while closed",
  ChatLog.entries.length === whileClosed && ChatLog.entries[ChatLog.entries.length - 1].msg === "while closed");

// Filters are display-only: the entries stay, the rows stop being drawn.
const chatCount = kinds("chat");
const joinCount = kinds("join");
Settings_default._chatLogFJoin = false;
ChatLog.refresh();
check("join filter hides rows, keeps entries",
  kinds("join") === joinCount && !Array.from(document.querySelectorAll('#ryn-chatlog .rcl-e[data-kind="join"]'))
    .some(el => getComputedStyle(el).display !== "none"));
Settings_default._chatLogFJoin = true;
Settings_default._chatLogBotMsg = true;
ChatLog.refresh();
check("bot messages on reveals what arrived while off",
  Array.from(document.querySelectorAll('#ryn-chatlog .rcl-e[data-bot="1"][data-kind="chat"]'))
    .some(el => getComputedStyle(el).display !== "none"));
Settings_default._chatLogBotMsg = false;
ChatLog.refresh();
check("chat entries untouched by filtering", kinds("chat") === chatCount);

// Drag, resize, lock, and the viewport clamp.
ChatLog._applyPosition(400, 300);
check("drag moves the panel", ChatLog._pos.x === 400 && ChatLog._pos.y === 300);
ChatLog._applyPosition(99999, 99999);
check("clamped inside the viewport",
  ChatLog._pos.x + Settings_default._chatLogW <= window.innerWidth &&
  ChatLog._pos.y + Settings_default._chatLogH <= window.innerHeight,
  ChatLog._pos.x + "," + ChatLog._pos.y);
ChatLog._applyPosition(-99999, -99999);
check("clamped at the origin too", ChatLog._pos.x === 0 && ChatLog._pos.y === 0);
Settings_default._chatLogLock = true;
ChatLog.refresh();
check("lock disables dragging",
  ChatLog.root.classList.contains("rcl-lock") &&
  (ChatLog._startDrag({ button: 0, target: ChatLog.root.querySelector(".rcl-head"),
                        clientX: 0, clientY: 0, preventDefault() {} }), ChatLog._drag === null));
Settings_default._chatLogLock = false;
ChatLog.refresh();

// A window resize is the same code path as fullscreen and a zoom step.
Settings_default._chatLogW = 900;
Settings_default._chatLogH = 800;
ChatLog._applySize();
check("oversized panel keeps its header on screen",
  ChatLog._pos.y >= 0 && ChatLog._pos.y <= window.innerHeight - 28, ChatLog._pos.y);
ChatLog.resetSize();
check("reset size", Settings_default._chatLogW === defaultSettings._chatLogW &&
  Settings_default._chatLogH === defaultSettings._chatLogH);
Settings_default._chatLogFontSize = 19;
Settings_default._chatLogBgOpacity = 10;
ChatLog.resetFont();
ChatLog.resetOpacity();
check("reset font and opacity",
  Settings_default._chatLogFontSize === defaultSettings._chatLogFontSize &&
  Settings_default._chatLogBgOpacity === defaultSettings._chatLogBgOpacity);

// Reset All touches Chat Log keys and nothing else.
Settings_default._killMessageText = "do not touch";
Settings_default._chatLogTime = false;
ChatLog.mute(47, "حسن");
ChatLog.resetAll();
check("reset all clears Chat Log state only",
  Settings_default._chatLogTime === true && ChatLog._muted.size === 0 &&
  Settings_default._killMessageText === "do not touch");

// A player who left and came back is a new arrival, and the id still resolves.
const joinsBefore = kinds("join");
const leavesBefore = kinds("leave");
ChatLog.onRemove(client, "s3");
spawn("s3", 47, "حسن");
check("rejoin after leave is an arrival again",
  kinds("join") === joinsBefore + 1 && kinds("leave") === leavesBefore + 1,
  kinds("join") + "/" + kinds("leave"));
check("identity survives the round trip",
  ChatLog.entries[ChatLog.entries.length - 1].sid === 47 &&
  ChatLog.entries[ChatLog.entries.length - 1].name === "حسن");

// The entry cap, and what a flood costs. 2000 messages is far past anything a
// server will actually deliver — moomoo rate-limits chat hard — so this is a
// ceiling, not a working load.
const t0 = performance.now();
for (let i = 0; i < 2000; i++) ChatLog.onChat(client, 12, playerData.get(12), "flood " + i);
const ms = performance.now() - t0;
check("entry cap holds at 400",
  ChatLog.entries.length === 400 && document.querySelectorAll("#ryn-chatlog .rcl-e").length === 400,
  ChatLog.entries.length + " entries / " + document.querySelectorAll("#ryn-chatlog .rcl-e").length + " rows");
check("2000 events stay under 0.1ms each", ms / 2000 < 0.1, (ms / 2000).toFixed(3) + "ms per event");
check("still one expiry timer after the flood", ChatLog._expiryTimer !== 0);
check("one scroll frame for the whole flood", ChatLog._scrollRaf !== 0);

ChatLog.clear();
check("clear empties the log", ChatLog.entries.length === 0 &&
  document.querySelectorAll("#ryn-chatlog .rcl-e").length === 0 && ChatLog._expiryTimer === 0);
ChatLog.onChat(client, 12, playerData.get(12), "after clear");
check("logging continues after clear", ChatLog.entries.length === 1);

document.getElementById("tests").textContent = results.join("\\n");
window.__chatLogResults = results;
</script>
</body>
</html>
`;

fs.writeFileSync(out, page);
console.log("wrote " + path.relative(ROOT, out));
