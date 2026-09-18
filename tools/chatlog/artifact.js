#!/usr/bin/env node
/*
 * artifact.js — builds a shareable, interactive preview of the Chat Log.
 *
 * Same trick as preview.js: the module is cut out of the built userscript, so
 * the page is the shipping code running against stubbed client objects. This
 * one is for looking at rather than for asserting on — the panel is live and
 * can be dragged, resized, searched, muted and reconfigured.
 *
 *   node tools/chatlog/artifact.js [out.html]
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const out = process.argv[2] || path.join(ROOT, "tools", "chatlog", "artifact.html");
const source = fs.readFileSync(path.join(ROOT, "Ryn_Type2.user.js"), "utf8");

const START = "  const CHATLOG_CSS = ";
const END = "  const ChatLog_default = ChatLog;";
const from = source.indexOf(START);
const to = source.indexOf(END);
if (from === -1 || to === -1) throw new Error("Chat Log module not found in Ryn_Type2.user.js");
const moduleSource = source.slice(from, to + END.length);

const defaults = {};
const block = source.slice(source.indexOf("  const defaultSettings = {"), source.indexOf("  const storedSettings ="));
const re = /^\s*(_chatLog\w*): (.+?),\s*$/gm;
let match;
while ((match = re.exec(block)) !== null) defaults[match[1]] = match[2];

const page = `<title>Ryn Type 2 Chat Log</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&family=Space+Grotesk:wght@500;700&display=swap">
<style>
/* One visual world on purpose: this is a translucent overlay that lives on top
   of a dark game canvas, and a light rendering of it would be a picture of
   something that does not exist. Every colour is painted explicitly so the page
   holds whatever ground the viewer's client puts behind it. */
:root {
  --ground: #07070A;
  --iris: #8E76CE;
  --sky: #9BC5E8;
  --sage: #A6D7B2;
  --rose: #D9A3AB;
  --tx-1: #F3F2F7;
  --tx-2: #ACA9BA;
  --tx-3: #726F80;
  --line: rgba(255,255,255,0.08);
  color-scheme: dark;
}
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--ground);
  color: var(--tx-2);
  font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 14px;
  overflow: hidden;
}
/* The stand-in for the game canvas. The panel has to be judged over something. */
#stage {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(1200px 700px at 20% 10%, #241e38 0%, rgba(36,30,56,0) 62%),
    radial-gradient(900px 600px at 86% 88%, #16292a 0%, rgba(22,41,42,0) 58%),
    var(--ground);
}
#stage::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 68px 68px;
  mask-image: radial-gradient(120% 110% at 40% 30%, #000 20%, transparent 78%);
  -webkit-mask-image: radial-gradient(120% 110% at 40% 30%, #000 20%, transparent 78%);
}

/* The legend. Bottom-anchored on desktop, out of the panel's way; it clears the
   phone's home indicator via the safe-area inset rather than a fixed margin. */
#legend {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 2;
  padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 22px;
  background: linear-gradient(to top, rgba(7,7,10,0.94), rgba(7,7,10,0));
  pointer-events: none;
}
#legend h1 {
  flex: 1 0 100%;
  margin: 0 0 2px;
  font-family: 'Space Grotesk', 'Manrope', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--tx-3);
}
#legend p { margin: 0; font-size: 12.5px; line-height: 1.6; }
#legend b { color: var(--tx-1); font-weight: 600; }
#legend .k {
  display: inline-block;
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 0 5px;
  font-family: 'Space Grotesk', monospace;
  font-size: 11px;
  color: var(--sky);
}
#legend .dot { color: var(--tx-3); }

/* The three event colours, named once so the log's palette is readable at a
   glance instead of having to be inferred from whatever scrolls past. */
#keys { flex: 1 0 100%; display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 4px; font-size: 11.5px; }
#keys span { display: inline-flex; align-items: center; gap: 6px; }
#keys i { width: 7px; height: 7px; border-radius: 2px; display: inline-block; }

/* The corner mark, reproduced from the client's own rules. The Chat Log docks
   into it — the panel's header opens up to the mark's height and the mark takes
   its seat inside, on one pane of glass. */
.ryn-v2-wrapper {
  position: fixed;
  top: 12px; left: 12px;
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  user-select: none;
}
.ryn-v2-mark {
  width: 44px; height: 44px; flex: none;
  border-radius: 13px;
  background: linear-gradient(140deg, #3b3357, #1a1728);
  box-shadow: 0 2px 10px rgba(0,0,0,0.38), inset 0 0 0 1px rgba(0,0,0,0.28);
  opacity: .92;
  transition: transform 170ms cubic-bezier(.34,1.56,.64,1), opacity 200ms ease;
}
.ryn-v2-badge {
  display: flex; align-items: baseline; gap: 5px;
  font-family: 'Space Grotesk', 'Manrope', sans-serif;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 1px 5px rgba(0,0,0,0.78);
  pointer-events: none;
}
.ryn-v2-n1 { color: rgba(255,255,255,0.88); font-size: 13px; letter-spacing: 0.14em; transition: color 200ms ease; }
.ryn-v2-n2 { color: rgba(255,255,255,0.46); font-size: 10px; letter-spacing: 0.22em; }
.ryn-v2-wrapper:hover .ryn-v2-mark { opacity: 1; transform: translateY(-1px) scale(1.04); }

@media (max-width: 560px) {
  #legend p { flex: 1 0 100%; }
}
</style>

<div id="stage"></div>
<!-- The client's own corner mark, at the size and position the client gives
     it, so the docking geometry here is the real geometry. -->
<div id="ryn-v2-wrapper" class="ryn-v2-wrapper">
  <div class="ryn-v2-mark"></div>
  <div class="ryn-v2-badge">
    <span class="ryn-v2-n1">Ryn</span>
    <span class="ryn-v2-n2">Type 2</span>
  </div>
</div>
<div id="legend">
  <h1>Ryn Type 2 &middot; Chat Log</h1>
  <p><b>Drag</b> it off the mark to separate them <span class="dot">&middot;</span> <b>drop it back</b> to join</p>
  <p><b>Click a name</b> to mute or copy <span class="dot">&middot;</span> <b>double-click a row</b> to copy</p>
  <p><span class="k">&#9881;</span> settings <span class="dot">&middot;</span> <span class="k">&#9906;</span> search <span class="dot">&middot;</span> <span class="k">L</span> in game</p>
  <div id="keys">
    <span><i style="background:var(--sky)"></i> player name and id</span>
    <span><i style="background:var(--sage)"></i> joined</span>
    <span><i style="background:var(--rose)"></i> died</span>
    <span><i style="background:var(--iris)"></i> clan</span>
    <span><i style="background:var(--tx-3)"></i> left</span>
  </div>
</div>

<script>
// ---- stand-ins for the client objects the module closes over --------------
const defaultSettings = {
${Object.keys(defaults).map(k => "  " + k + ": " + defaults[k] + ",").join("\n")}
};
const Settings_default = Object.assign({}, defaultSettings, { _chatLogMuted: [], _chatLogH: 300 });
// The real client writes one localStorage record here. The preview keeps the
// settings in memory instead, so opening this page cannot touch anything.
const SaveSettings = () => {};
const Logger = { error: m => console.error(m), warn: m => console.warn(m), test: () => {} };
const UI_default = { frame: null };

${moduleSource}

// ---- a session, fed in through the real observation points ----------------
const playerData = new Map();
const client = {
  isOwner: true,
  clientIDList: new Set([ 900 ]),
  isBotByID(sid) { return this.clientIDList.has(sid); },
  myPlayer: { id: 1, nickname: "Raptor", killedSomeone: false, resources: { kills: 0 },
              pos: { current: { x: 0, y: 0 } }, isEnemyByID: () => true },
  PlayerManager: { client: null, playerData, corpseTick: 0 }
};
client.PlayerManager.client = client;

function spawn(socketID, sid, nickname) {
  if (!playerData.has(sid)) {
    playerData.set(sid, { id: sid, nickname, clanName: null, corpseSeenTick: 0, pos: { current: { x: 0, y: 0 } } });
  }
  playerData.get(sid).nickname = nickname;
  ChatLog.onSpawn(client, [ socketID, sid, nickname, 0, 0, 0, 100, 100, 35, 0 ]);
}
function join(sid, clan) {
  playerData.get(sid).clanName = clan;
  ChatLog.onClanChange(client, playerData.get(sid), null);
}

ChatLog.init();
// The panel belongs to the game, so it stays away until this client spawns.
ChatLog.setInGame(true);

spawn("s1", 1, "Raptor");
spawn("s2", 12, "Kenny");
spawn("s3", 47, "حسن");
spawn("s4", 108, "xXx_LongestNameOnTheServer_xXx");
spawn("s5", 900, "Ryn 1");
ChatLog.onChat(client, 12, playerData.get(12), "hey");
ChatLog.onChat(client, 47, playerData.get(47), "السلام عليكم");
ChatLog.onChat(client, 1, playerData.get(1), "wb");
ChatLog.onClanCreated(client, "NOVA", 12);
join(12, "NOVA");
join(47, "NOVA");
ChatLog.onChat(client, 47, playerData.get(47), "clan NOVA فيه 3 لاعبين now");
ChatLog.onChat(client, 108, playerData.get(108),
  "a long one, so the wrap and the hanging indent can be judged at a glance");
ChatLog.onHealth(client, 108, 0);
ChatLog.onChat(client, 12, playerData.get(12), "ez");
ChatLog.onRemove(client, "s4");
ChatLog.onChat(client, 47, playerData.get(47), "رحل 😭");

// A slow trickle, so the entry animation, the live counter and — once you have
// scrolled up to read something — the "new" pill are all visible at rest.
const chatter = [
  [ 12, "one sec" ], [ 47, "تمام" ], [ 1, "regear" ], [ 12, "spike him" ],
  [ 47, "خلاص جاي" ], [ 1, "gg" ], [ 12, "who has stone" ], [ 47, "أنا عندي" ]
];
let n = 0;
setInterval(() => {
  const line = chatter[n++ % chatter.length];
  ChatLog.onChat(client, line[0], playerData.get(line[0]), line[1]);
}, 4200);
</script>
`;

fs.writeFileSync(out, page);
console.log("wrote " + path.relative(ROOT, out));
