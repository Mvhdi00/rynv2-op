// Drives the real Pod block inside jsdom: builds the panel, sends messages,
// flips the language, toggles the voice, exercises the memory drawer, and runs
// a full fake Claude turn (streaming + a tool round-trip) end to end.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SCRIPT = path.join(__dirname, "..", "YoRHa_System.user.js");
const SRC = fs.readFileSync(SCRIPT, "utf8");
const START = "        const POD_UNITS = [";
const END = "        try { setInterval(function () { try { if (Pod.isOpen()) Pod._paint(); } catch (e) {} }, 500); } catch (e) {}";
const a = SRC.indexOf(START), b = SRC.indexOf(END);
if (a < 0 || b < 0) throw new Error("pod block markers not found");
const BLOCK = SRC.slice(a, b + END.length);

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const W = dom.window, D = W.document;

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log("  ok   " + n))
                            : (fail++, console.log("  FAIL " + n + (x !== undefined ? "  <= " + JSON.stringify(x) : ""))); };

// ---- mocks the block reads ------------------------------------------------
const store = {};
const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const nav = { language: "en-US" };

W.vars = {
  podChatIn: true, podChatPrefix: ".", podChatAll: false, podChatListen: true,
  podChatOut: false, podChatReply: false,
  podPilotAI: false, podPilotThink: 15,
  botPrimary: 5, botSecondary: 9, botAgeTrap: true, botAgeBoost: false, botAge8: "auto",
  podEnabled: true, podVariant: 0, podLang: "en", podMemory: true,
  podAI: false, podProvider: "anthropic", podModel: "",
  podKeyGemini: "", podKeyGroq: "", podKeyOpenRouter: "", podAIKey: "",
  podVoice: true, podVoiceCallouts: true, podVoiceName: "",
  podVoiceRate: 105, podVoicePitch: 85, podVoiceVolume: 100, podMic: true
};
let saved = 0;
const saveConfig = () => { saved++; };

// A speech engine that records instead of speaking.
const spoken = [];
class Utt {
  constructor(t) { this.text = t; }
}
const speechSynthesis = {
  speaking: false,
  _v: [{ name: "Daniel", lang: "en-GB" }, { name: "Samantha", lang: "en-US" }, { name: "Maged", lang: "ar-SA" }],
  getVoices() { return this._v; },
  speak(u) { spoken.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name, rate: u.rate, pitch: u.pitch, volume: u.volume }); if (u.onstart) u.onstart(); if (u.onend) u.onend(); },
  cancel() { this._cancels = (this._cancels || 0) + 1; },
  addEventListener() {}
};
W.speechSynthesis = speechSynthesis;
W.SpeechSynthesisUtterance = Utt;

// A recogniser that can be driven from the test.
const recs = [];
class Rec {
  constructor() { this.continuous = false; this.interimResults = false; recs.push(this); }
  start() { this.started = true; }
  stop() { this.started = false; if (this.onend) this.onend(); }
  emit(text, isFinal) {
    this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: isFinal })] });
  }
}
W.SpeechRecognition = Rec;

// Game-world stubs.
const myPlayer = { sid: 1, name: "Ryn", x: 1000, y: 1000, alive: true, health: 100, maxHealth: 100,
                   kills: 0, age: 3, upgradePoints: 0, weapons: [0, 9],
                   items: [0, 3, 6, 10, 15], weaponIndex: 0,
                   stats: { wood: 40, food: 12, stone: 8, gold: 3 } };
const players = [myPlayer];
const items = { weapons: [{ name: "tool hammer" }], list: [] };
const UTILS = { getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) };
const config = { mapScale: 14400 };
// A stone field to the east and an enemy base to the north, so the tactical
// layer has something real to point at.
const gameObjects = [];
for (let i = 0; i < 9; i++)
  gameObjects.push({ active: true, isItem: false, type: 2, x: 1900 + (i % 3) * 40, y: 1000 + ((i / 3) | 0) * 40 });
for (let i = 0; i < 7; i++)
  gameObjects.push({ active: true, isItem: true, owner: { sid: 99, name: "Enemy" },
                     x: 1000 + (i % 3) * 50, y: 200 + ((i / 3) | 0) * 50, name: "spikes" });

// fetch is replaced per-test.
let fetchImpl = async () => { throw new Error("no fetch configured"); };
const fetch = (...args) => fetchImpl(...args);

// What the pilot and the chat bridge reach for in the real client.
const sent = [];                                   // io.send calls
const io = { send: (...a) => sent.push(a) };
const acted = [];
const actAsBot = (...a) => { acted.push(a); return false; };
const findPlayerBySID = (sid) => players.find(p => p && p.sid === sid) || null;
const RynBots = { possessed: null, _push() {}, command: () => false };
const BOT_ITEM = { COOKIE: 1, GREATER_SPIKES: 7, SPINNING_SPIKES: 9, POWER_MILL: 12,
                   TRAP: 15, BOOST: 16, PLATFORM: 18 };
const calls = { heal: [], place: [], upgrade: [], atck: 0 };
const heal = (v) => calls.heal.push(v);
const place = (id, ang) => calls.place.push({ id, ang });
const sendUpgrade = (i) => calls.upgrade.push(i);
const sendAtckState = () => { calls.atck++; };

const make = new Function(
  "window", "document", "navigator", "localStorage", "fetch", "TextDecoder",
  "setInterval", "clearInterval", "saveConfig", "lerp",
  "myPlayer", "players", "botViewPlayers", "botViewSelf", "inBotView", "isAlly",
  "UTILS", "config", "killCount", "items", "ais", "gameObjects",
  "spikes_our", "traps_our", "attackState", "mainContext",
  "mouseX", "mouseY", "screenWidth", "screenHeight",
  "io", "actAsBot", "findPlayerBySID", "RynBots", "BOT_ITEM",
  "heal", "place", "sendUpgrade", "sendAtckState", "pathPosition", "pathMode",
  BLOCK + "\n return { Pod, PodVoice, PodEars, PodMemory, PodLines, PodWorld, PodTactics, PodRecon," +
          " PodMark, PodLink, PodChat, PodPilot, POD_BANK, POD_GOALS, podLangNow, PT, POD_TOOLS," +
          " podSystemPrompt, POD_UNITS," +
          " tick: { get pathPosition(){return pathPosition;}, get pathMode(){return pathMode;}," +
          "         get attackState(){return attackState;} } };");

const api = make(
  W, D, nav, localStorage, fetch, TextDecoder,
  W.setInterval.bind(W), W.clearInterval.bind(W), saveConfig, (s, e, t) => s + (e - s) * t,
  myPlayer, players, players, null, () => false, () => false,
  UTILS, config, 0, items, [], gameObjects,
  [], [], 0, null,
  0, 0, 1920, 1080,
  io, actAsBot, findPlayerBySID, RynBots, BOT_ITEM,
  heal, place, sendUpgrade, sendAtckState, null, {});

const { Pod, PodVoice, PodEars, PodMemory, PodLines, PodWorld, PodTactics, PodRecon,
        PodMark, PodLink, PodChat, PodPilot, POD_BANK, POD_GOALS, podLangNow, PT,
        POD_TOOLS, podSystemPrompt } = api;

// ---- 1. panel construction ------------------------------------------------
console.log("\n[panel]");
Pod.buildPanel();
const panel = D.getElementById("pod-panel");
ok("panel mounted", !!panel);
ok("log present", !!D.getElementById("pod-log"));
ok("input present", !!D.getElementById("pod-in"));
ok("footer present", !!D.getElementById("pod-foot"));
ok("starts closed", !panel.classList.contains("open"));
// The shell keeps the panel's footprint while it is closed, so it must not be
// able to swallow a click meant for the game behind it.
const shell = D.getElementById("pod-shell");
ok("panel sits inside the shadow shell", !!shell && shell.contains(panel));
Pod.toggle(true);
ok("toggle opens", panel.classList.contains("open"));
ok("greeting rendered", D.querySelectorAll("#pod-log .pod-line").length === 1);
ok("placeholder localised", D.getElementById("pod-in").placeholder === PT("talk"), D.getElementById("pod-in").placeholder);

// The typewriter must actually finish.
const greetLine = Pod.lines[0];
for (let i = 0; i < 400 && greetLine.shown < greetLine.full.length; i++) W.document; // no-op
// Drive the typer synchronously instead of waiting on timers.
while (greetLine.shown < greetLine.full.length) {
  const behind = greetLine.full.length - greetLine.shown;
  greetLine.shown += Math.max(1, Math.min(behind, behind > 60 ? 8 : 2));
  Pod._paintLine(greetLine);
}
ok("greeting text reaches the DOM", greetLine.msgEl.textContent === greetLine.full, greetLine.msgEl.textContent);

// ---- 2. local (no-key) replies -------------------------------------------
console.log("\n[local replies]");
spoken.length = 0;
Pod.handle("status");
const last = Pod.lines[Pod.lines.length - 1];
ok("status answered locally", /Status/.test(last.full), last.full);
ok("reply was spoken", spoken.length === 1, spoken);
ok("spoken in en-GB voice", spoken[0].voice === "Daniel", spoken[0]);
ok("pitch applied", Math.abs(spoken[0].pitch - 0.85) < 1e-9, spoken[0].pitch);
ok("rate applied", Math.abs(spoken[0].rate - 1.05) < 1e-9, spoken[0].rate);

Pod.handle("threat");
ok("threat answered from the bank", Pod.lines[Pod.lines.length - 1].full.length > 8,
   Pod.lines[Pod.lines.length - 1].full);

// XSS: a chat line must never inject markup.
Pod.handle("<img src=x onerror=alert(1)>");
const opLine = Pod.lines.filter(l => l.who === "you").pop();
ok("operator text escaped", opLine.msgEl.innerHTML.indexOf("<img") < 0 && opLine.msgEl.textContent.indexOf("<img") === 0,
   opLine.msgEl.innerHTML);
ok("no img element created", D.querySelectorAll("#pod-log img").length === 0);

// ---- 3. the voice switch -------------------------------------------------
console.log("\n[voice]");
spoken.length = 0;
Pod.handle("/voice off");
ok("/voice off flips the var", W.vars.podVoice === false);
ok("/voice off persisted", saved > 0);
Pod.handle("status");
ok("nothing spoken while muted", spoken.length === 0, spoken);
Pod.handle("/voice on");
ok("/voice on restores", W.vars.podVoice === true);
spoken.length = 0;
Pod.handle("status");
ok("speaking again", spoken.length === 1);
// The header button is the same switch.
D.getElementById("pod-b-voice").click();
ok("header button mutes", W.vars.podVoice === false);
ok("header button label flips to MUTE", D.getElementById("pod-b-voice").textContent === "MUTE");
D.getElementById("pod-b-voice").click();
ok("header button unmutes", W.vars.podVoice === true);

// Call-outs are separately silenceable.
spoken.length = 0;
W.vars.podVoiceCallouts = false;
Pod.say("Alert: hostile east.", { callout: true });
ok("call-out muted independently", spoken.length === 0);
W.vars.podVoiceCallouts = true;
Pod.say("Alert: hostile east.", { callout: true });
ok("call-out spoken when enabled", spoken.length === 1);

// ---- 4. the language switch ----------------------------------------------
console.log("\n[language]");
spoken.length = 0;
Pod.handle("/lang ar");
ok("language switched to ar", podLangNow() === "ar");
ok("panel turns RTL", panel.classList.contains("rtl"));
ok("log direction rtl", D.getElementById("pod-log").dir === "rtl");
ok("placeholder now Arabic", D.getElementById("pod-in").placeholder === PT("talk"));
ok("send button Arabic", D.getElementById("pod-send").textContent === "إرسال", D.getElementById("pod-send").textContent);
ok("confirmation spoken with an Arabic voice", spoken.length && spoken[spoken.length - 1].voice === "Maged", spoken);
Pod.handle("وين اروح");
const arLine = Pod.lines[Pod.lines.length - 1];
ok("Arabic question gets an Arabic answer", /[؀-ۿ]/.test(arLine.full), arLine.full);
ok("no English leaked into the Arabic reply", !/[A-Za-z]{4,}/.test(arLine.full), arLine.full);
Pod.handle("status");
ok("English keyword still answers in Arabic", /[؀-ۿ]/.test(Pod.lines[Pod.lines.length - 1].full));
ok("system prompt orders Arabic", /ALWAYS reply in Arabic/.test(podSystemPrompt()));
Pod.handle("/lang en");
ok("switched back to en", podLangNow() === "en");
ok("panel leaves RTL", !panel.classList.contains("rtl"));
ok("system prompt orders English", /ALWAYS reply in English/.test(podSystemPrompt()));

// ---- 5. memory -----------------------------------------------------------
console.log("\n[memory]");
PodMemory.clearAll();
Pod.handle("/remember I always run polearm and bull helmet");
ok("fact stored via command", PodMemory.load().facts.length === 1, PodMemory.load().facts);
Pod._toggleMemory();
ok("memory drawer opens", D.getElementById("pod-mem").classList.contains("open"));
ok("drawer lists the fact", D.querySelectorAll("#pod-mem .pod-mem-row").length === 1);
ok("drawer shows the text", D.querySelector("#pod-mem .pod-mem-txt").textContent.indexOf("polearm") >= 0);
ok("memory brief reaches the system prompt", podSystemPrompt().indexOf("polearm") >= 0);
D.querySelector("#pod-mem .pod-mem-x").click();
ok("row delete removes the fact", PodMemory.load().facts.length === 0);
ok("drawer redraws empty", !!D.querySelector("#pod-mem .pod-mem-empty"));
PodMemory.addFact("clan is YoRHa", "clan");
D.getElementById("pod-mem-clear").click();
ok("clear-all empties memory", PodMemory.load().facts.length === 0);
W.vars.podMemory = false;
ok("brief suppressed when memory is off", podSystemPrompt().indexOf("[OPERATOR RECORDS]") < 0);
W.vars.podMemory = true;

// ---- 6. the microphone ---------------------------------------------------
console.log("\n[mic]");
PodEars.start();
ok("recogniser created", recs.length === 1);
ok("recogniser started", recs[0].started === true);
ok("recogniser language follows the pod", recs[0].lang === "en-US", recs[0].lang);
ok("mic button lights", D.getElementById("pod-b-mic").classList.contains("on"));
recs[0].emit("where should I go", false);
ok("interim text lands in the input", D.getElementById("pod-in").value === "where should I go", D.getElementById("pod-in").value);
recs[0].emit("where should I go", true);
ok("final transcript clears the input", D.getElementById("pod-in").value === "");
ok("final transcript was answered", Pod.lines.filter(l => l.who === "you").pop().full === "where should I go");
PodEars.stop();
ok("mic button unlights", !D.getElementById("pod-b-mic").classList.contains("on"));
W.vars.podLang = "ar";
PodEars.start();
ok("recogniser follows a language change", recs[0].lang === "ar-SA", recs[0].lang);
PodEars.stop();
W.vars.podLang = "en";

// ---- 6b. the anti-repetition engine --------------------------------------
console.log("\n[no repeats]");
PodLines.reset();
// A deck must exhaust every line before any of them comes back.
const killBank = POD_BANK.kill.en;
const drawn = [];
for (let i = 0; i < killBank.length; i++) drawn.push(PodLines.draw("t", killBank));
ok("deck hands out every line before repeating", new Set(drawn).size === killBank.length,
   killBank.length + " lines, " + new Set(drawn).size + " distinct");
const next = PodLines.draw("t", killBank);
ok("reshuffle never repeats the last line", next !== drawn[drawn.length - 1], { next: next, last: drawn[drawn.length - 1] });
// Over a long run every line should appear at close to equal frequency.
PodLines.reset();
const counts = {};
for (let i = 0; i < killBank.length * 30; i++) {
  const l = PodLines.draw("t2", killBank);
  counts[l] = (counts[l] || 0) + 1;
}
const spread = Object.values(counts);
ok("long-run distribution stays even", Math.max(...spread) - Math.min(...spread) <= 2, counts);

// The novelty guard blocks an identical rendered sentence.
PodLines.reset();
ok("first utterance is fresh", PodLines.fresh("Alert: hostile north.", 60000) === true);
ok("identical utterance is suppressed", PodLines.fresh("Alert: hostile north.", 60000) === false);
ok("a different sentence passes", PodLines.fresh("Alert: hostile south.", 60000) === true);

// The chatter budget rations low-priority lines and never blocks alerts.
PodLines.reset();
let allowed = 0;
for (let i = 0; i < 20; i++) if (PodLines.allow(0)) allowed++;
ok("idle chatter is capped", allowed <= 3, allowed);
let alerts = 0;
for (let i = 0; i < 20; i++) if (PodLines.allow(3)) alerts++;
ok("alerts are never rationed", alerts === 20, alerts);

// Templates fill from live state and drop unused slots cleanly.
ok("template fills", PodLines.render("hostile {bearing} at {dist}", { bearing: "north", dist: 420 })
   === "hostile north at 420");
ok("unused slots are removed", PodLines.render("go {bearing}. {why}", { bearing: "east" }) === "go east.");

// Both language tables must carry every topic, or a language half-applies.
const bankGaps = Object.keys(POD_BANK).filter(k => !POD_BANK[k].ar || !POD_BANK[k].en ||
                                                   !POD_BANK[k].ar.length || !POD_BANK[k].en.length);
ok("every bank topic exists in both languages", bankGaps.length === 0, bankGaps);
// And the same slots on both sides, or a template renders blanks in one language.
const slotGaps = Object.keys(POD_BANK).filter(k => {
  const slots = (arr) => new Set((arr.join(" ").match(/\{[a-z0-9_]+\}/gi) || []));
  const a = slots(POD_BANK[k].en), b = slots(POD_BANK[k].ar);
  return [...a].some(s => !b.has(s)) || [...b].some(s => !a.has(s));
});
ok("template slots match across languages", slotGaps.length === 0, slotGaps);

// Two ticks in a row on an unchanged world must not produce the same line twice.
console.log("\n[tick behaviour]");
PodLines.reset();
const before = Pod.lines.length;
for (let i = 0; i < 12; i++) Pod.tick();
const said = Pod.lines.slice(before).map(l => l.full);
ok("repeated ticks do not spam", said.length <= 6, said.length);
ok("no identical line twice in a burst", new Set(said).size === said.length, said);

// ---- 6c. world archive, tactics, recon -----------------------------------
console.log("\n[world]");
const enemy = { sid: 42, name: "Kaine", x: 1600, y: 1000, visible: true, health: 60, maxHealth: 100 };
players.push(enemy);
PodWorld.observe();
ok("contact logged", !!PodWorld.contacts[42], Object.keys(PodWorld.contacts));
ok("contact carries a position", PodWorld.contacts[42].x === 1600);
let f = PodWorld.find("kai");
ok("live contact found by partial name", f.kind === "live", f.kind);
ok("bearing computed", f.bearing[0] === "east", f.bearing);
ok("distance computed", Math.round(f.d) === 600, f.d);
// Age it out of sensor range.
PodWorld.contacts[42].t = Date.now() - 30000;
f = PodWorld.find("kaine");
ok("stale contact reported as stale", f.kind === "stale", f.kind);
ok("stale record keeps its age", f.age >= 29000, f.age);
enemy.visible = false;
ok("unknown name returns none", PodWorld.find("nobodyhere").kind === "none");

// The leaderboard is read off the HUD, which is the one server-wide signal.
const board = D.createElement("div");
board.id = "leaderboardData";
board.innerHTML =
  '<div class="leaderHolder"><div class="leaderboardItem">1. Adam</div><div class="leaderScore">9k</div></div>' +
  '<div class="leaderHolder"><div class="leaderboardItem">2. Eve</div><div class="leaderScore">7k</div></div>';
D.body.appendChild(board);
const changed = PodWorld.readBoard();
ok("board parsed", PodWorld.roster.length === 2, PodWorld.roster);
ok("board strips the rank prefix", PodWorld.roster[0].name === "Adam", PodWorld.roster[0]);
ok("board reports a change on first read", !!changed);
ok("unchanged board reports nothing", PodWorld.readBoard() === null);
ok("roster lookup finds a never-seen player", PodWorld.find("adam").kind === "roster");

// Tactics must point at real ground with a real reason.
console.log("\n[tactics]");
const farm = PodTactics._build("farm", myPlayer);
ok("farm directive found the stone field", !!farm, farm);
ok("farm points east", farm && farm.bearing[0] === "east", farm && farm.bearing);
ok("farm carries a distance", farm && farm.dist > 400 && farm.dist < 1400, farm && farm.dist);
ok("farm explains itself", farm && /stone/i.test(farm.why), farm && farm.why);
const base = PodTactics._build("base", myPlayer);
ok("enemy base detected", !!base, base);
ok("base points north", base && base.bearing[0] === "north", base && base.bearing);
ok("base counts the structures", base && /7|[4-9]/.test(base.why), base && base.why);
const safe = PodWorld.safestDir();
ok("safest direction computed", !!safe && isFinite(safe.ang));

// A directive marks a point you can walk to.
PodMark.clear();
Pod.direct(farm, { priority: 3 });
ok("directive drops a waypoint", PodMark.live());
ok("waypoint is the directive's position", Math.round(PodMark.x) === Math.round(farm.x));

// /find and /go go through the same paths.
console.log("\n[commands]");
enemy.visible = true;
PodWorld.observe();
PodMark.clear();
Pod.handle("/find kaine");
ok("/find marks the target", PodMark.live());
ok("/find names the target", /KAINE/i.test(PodMark.label), PodMark.label);
PodMark.clear();
Pod.handle("/go farm");
ok("/go farm marks a destination", PodMark.live());
Pod.handle("/board");
ok("/board lists the server", /Adam/.test(Pod.lines[Pod.lines.length - 1].full), Pod.lines[Pod.lines.length - 1].full);

// Recon actually leaves and comes back.
console.log("\n[recon]");
ok("recon starts idle", !PodRecon.busy());
const msg = Pod.startRecon("east", "", 800);
ok("recon launches", PodRecon.busy(), msg);
ok("recon is outbound", PodRecon.state === "outbound", PodRecon.state);
ok("second launch is refused", /already in progress/.test(Pod.startRecon("west", "", 800)));
let guard = 0;
while (PodRecon.state === "outbound" && guard++ < 600) PodRecon.anchor();
ok("recon reaches the target", PodRecon.state === "sweep", PodRecon.state);
ok("recon anchor pulls the drone off your shoulder", Math.abs(PodRecon.x - myPlayer.x) > 400);
PodRecon.until = Date.now() - 1;
PodRecon.anchor();
ok("sweep completes into the return leg", PodRecon.state === "inbound", PodRecon.state);
guard = 0;
while (PodRecon.state === "inbound" && guard++ < 600) PodRecon.anchor();
ok("recon returns to idle", PodRecon.state === "idle", PodRecon.state);
ok("recon reported something", Pod.lines.slice(-6).some(l => /sweep|contact|empty|قطاع|مسح/i.test(l.full)),
   Pod.lines.slice(-4).map(l => l.full));

// ---- 7. a full Claude turn, with a tool round-trip -----------------------
console.log("\n[ai turn]");
function sseResponse(frames) {
  let i = 0;
  return {
    ok: true, status: 200,
    body: { getReader: () => ({ read: async () => (i < frames.length ? { done: false, value: Buffer.from(frames[i++]) } : { done: true }) }) },
    text: async () => ""
  };
}
const seen = [];
fetchImpl = async (url, opts) => {
  const body = JSON.parse(opts.body);
  seen.push({ url, headers: opts.headers, body });
  if (seen.length === 1) {
    // First turn: a little text, then a scan tool call.
    return sseResponse([
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}\n\n' +
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"SIGABC"}}\n\n' +
      'data: {"type":"content_block_stop","index":0}\n\n' +
      'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_9","name":"scan","input":{}}}\n\n' +
      'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"radius\\":500}"}}\n\n' +
      'data: {"type":"content_block_stop","index":1}\n\n' +
      'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}\n\n'
    ]);
  }
  // Second turn: the answer, plus a remember call is not needed.
  return sseResponse([
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Analysis: area clear."}}\n\n',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n'
  ]);
};

W.vars.podAI = true;
W.vars.podAIKey = "sk-ant-test";
spoken.length = 0;

(async () => {
  await Pod._askAI("what is around me");

  ok("two requests made (tool round-trip)", seen.length === 2, seen.length);
  ok("streaming requested", seen[0].body.stream === true);
  ok("model defaults to opus 5", seen[0].body.model === "claude-opus-5", seen[0].body.model);
  ok("effort low", seen[0].body.output_config.effort === "low");
  ok("no budget_tokens sent", JSON.stringify(seen[0].body).indexOf("budget_tokens") < 0);
  ok("no thinking param sent", seen[0].body.thinking === undefined);
  ok("browser-access header set", seen[0].headers["anthropic-dangerous-direct-browser-access"] === "true");
  ok("api version header set", seen[0].headers["anthropic-version"] === "2023-06-01");
  ok("api key header set", seen[0].headers["x-api-key"] === "sk-ant-test");
  ok("fallback beta on opus 5", seen[0].headers["anthropic-beta"] === "server-side-fallback-2026-07-01", seen[0].headers);
  ok("fallbacks default", seen[0].body.fallbacks === "default");
  ok("tools declared", seen[0].body.tools.length === POD_TOOLS.length, seen[0].body.tools.length);
  ok("field state attached", /\[FIELD\]/.test(seen[0].body.messages[0].content));
  ok("operator text attached", /what is around me/.test(seen[0].body.messages[0].content));

  const replay = seen[1].body.messages;
  const asst = replay.find(m => m.role === "assistant");
  ok("assistant turn replayed", !!asst, replay.map(m => m.role));
  const think = asst.content.find(c => c.type === "thinking");
  ok("thinking block replayed", !!think, asst.content);
  ok("thinking signature preserved", think && think.signature === "SIGABC", think);
  const tu = asst.content.find(c => c.type === "tool_use");
  ok("tool_use replayed with parsed input", tu && tu.input.radius === 500, tu);
  const tr = replay[replay.length - 1];
  ok("tool_result sent back", tr.role === "user" && tr.content[0].type === "tool_result");
  ok("tool_result matches the call id", tr.content[0].tool_use_id === "toolu_9");
  ok("scan produced real world data", /hostiles\(/.test(tr.content[0].content), tr.content[0].content);

  const aiLine = Pod.lines[Pod.lines.length - 1];
  ok("reply landed in the log", aiLine.full === "Analysis: area clear.", aiLine.full);
  ok("reply was spoken", spoken.some(s => /area clear/.test(s.text)), spoken);
  ok("turn stored in memory history", PodMemory.load().history.length === 2, PodMemory.load().history);
  ok("busy flag released", Pod.isBusy() === false);

  // A hard API failure must fall back to local analysis, not go silent.
  fetchImpl = async () => ({ ok: false, status: 401, body: null, text: async () => '{"error":{"message":"invalid x-api-key"}}' });
  const before = Pod.lines.length;
  await Pod._askAI("status");
  ok("failure surfaces the API message", Pod.lines.some(l => /invalid x-api-key/.test(l.full)),
     Pod.lines.slice(before).map(l => l.full));
  ok("failure still answers locally", /Status/.test(Pod.lines[Pod.lines.length - 1].full),
     Pod.lines[Pod.lines.length - 1].full);
  ok("busy released after failure", Pod.isBusy() === false);

  // The remember tool actually writes to the store.
  ok("remember tool stores", Pod._tool("remember", { fact: "prefers katana", tag: "build" }) === "stored." &&
     PodMemory.load().facts.some(f => /katana/.test(f.text)));
  ok("recall tool finds it", /katana/.test(Pod._tool("recall", { query: "katana" })));
  ok("unknown tool is handled", Pod._tool("nope", {}) === "unknown tool.");

  // ---- 7b. the game-chat bridge -------------------------------------------
  console.log("\n[game chat]");
  W.vars.podProvider = "anthropic"; W.vars.podAI = false; W.vars.podLang = "en";
  const chatBefore = Pod.lines.length;
  ok("prefixed chat is consumed", PodChat.intercept(".status") === true);
  ok("prefixed chat reached the pod", Pod.lines.slice(chatBefore).some(l => /Status/.test(l.full)),
     Pod.lines.slice(chatBefore).map(l => l.full));
  ok("plain chat passes through to the server", PodChat.intercept("hello everyone") === false);
  ok("'pod ...' also reaches it", PodChat.intercept("pod status") === true);
  ok("Arabic 'بود ...' also reaches it", PodChat.intercept("بود الحالة") === true);
  ok("a bare prefix is swallowed", PodChat.intercept(".") === true);
  W.vars.podChatAll = true;
  ok("route-all captures plain chat", PodChat.intercept("where do I go") === true);
  W.vars.podChatAll = false;
  W.vars.podChatIn = false;
  ok("disabled bridge passes everything through", PodChat.intercept(".status") === false);
  W.vars.podChatIn = true;
  W.vars.podChatPrefix = "!";
  ok("a custom prefix is honoured", PodChat.intercept("!status") === true);
  ok("the old prefix stops working", PodChat.intercept(".status") === false);
  W.vars.podChatPrefix = ".";

  // Listening to the room.
  players.push({ sid: 77, name: "Adam", x: 1200, y: 1000, visible: true, health: 100, maxHealth: 100 });
  PodChat.log.length = 0;
  PodChat.heard(77, "gg easy");
  ok("other players' chat is logged", PodChat.log.length === 1, PodChat.log);
  ok("the log names the speaker", PodChat.log[0].name === "Adam", PodChat.log[0]);
  ok("chat reaches the model's briefing", /Adam: gg easy/.test(Pod._field()), Pod._field().slice(-200));
  PodChat.heard(1, "my own echo");
  ok("our own chat is not logged back", PodChat.log.length === 1, PodChat.log);
  const namedBefore = Pod.lines.length;
  PodChat.heard(77, "Ryn you are next");
  ok("being named raises a call-out", Pod.lines.slice(namedBefore).some(l => /named you|ذكر اسمك/.test(l.full)),
     Pod.lines.slice(namedBefore).map(l => l.full));
  W.vars.podChatListen = false;
  const quiet = PodChat.log.length;
  PodChat.heard(77, "ignored");
  ok("listening off stops logging", PodChat.log.length === quiet);
  W.vars.podChatListen = true;

  // Speaking publicly is off by default and rate limited when on.
  sent.length = 0;
  ok("public chat is refused while off", PodChat.say("hello") === false);
  ok("nothing was sent", sent.length === 0);
  W.vars.podChatOut = true;
  PodChat._lastOut = 0;
  ok("public chat sends when enabled", PodChat.say("Proposal: move east now") === true);
  ok("it went out on the chat packet", sent.length === 1 && sent[0][0] === "6", sent);
  ok("the YoRHa prefix is stripped for chat", !/Proposal/.test(sent[0][1]), sent[0][1]);
  ok("second line is rate limited", PodChat.say("again") === false);
  PodChat._lastOut = 0;
  PodChat.say("x".repeat(80));
  ok("long lines are clipped to what the game carries", sent[sent.length - 1][1].length <= 30,
     sent[sent.length - 1][1].length);
  // The tool refuses when the operator has not opted in.
  W.vars.podChatOut = false;
  ok("the chat tool refuses without consent", /refused/.test(Pod._tool("say_in_game_chat", { text: "hi" })));
  W.vars.podChatOut = true;
  PodChat._lastOut = 0;
  ok("the chat tool sends with consent", /sent to game chat/.test(Pod._tool("say_in_game_chat", { text: "hi" })));
  W.vars.podChatOut = false;

  // ---- 7c. the autopilot ---------------------------------------------------
  console.log("\n[pilot]");
  players.length = 1;                                  // back to just us
  PodMemory.load().tactics = {};
  ok("starts off", PodPilot.on === false);
  ok("not driving while off", PodPilot.driving() === false);
  PodPilot.enable(true);
  ok("enables", PodPilot.on === true);
  ok("drives once enabled", PodPilot.driving() === true);
  ok("announces itself", Pod.lines.slice(-3).some(l => /pilot engaged|قيادة البود/i.test(l.full)),
     Pod.lines.slice(-3).map(l => l.full));

  // Human override.
  PodPilot.nudge();
  ok("a human input pauses it", PodPilot.paused() === true && PodPilot.driving() === false);
  PodPilot._humanUntil = 0;
  ok("it resumes on its own", PodPilot.driving() === true);
  // A possessed bot means the pilot is not the one steering.
  RynBots.possessed = {};
  ok("possession suspends the pilot", PodPilot.driving() === false);
  RynBots.possessed = null;
  // Turning the pod off must take the autopilot with it — no invisible driver.
  W.vars.podEnabled = false;
  ok("a hidden pod cannot fly", PodPilot.driving() === false);
  W.vars.podEnabled = true;

  // Goal selection follows the safety rules first.
  myPlayer.health = 100;
  ok("healthy and alone picks a peaceful goal",
     ["farm", "build", "explore"].indexOf(PodPilot._choose(myPlayer)) >= 0, PodPilot._choose(myPlayer));
  myPlayer.health = 30;
  ok("hurt picks heal", PodPilot._choose(myPlayer) === "heal", PodPilot._choose(myPlayer));
  myPlayer.stats.food = 0;
  players.push({ sid: 55, name: "Foe", x: 1150, y: 1000, visible: true, health: 100, maxHealth: 100 });
  ok("hurt with no food and an enemy picks flee", PodPilot._choose(myPlayer) === "flee", PodPilot._choose(myPlayer));
  myPlayer.health = 100; myPlayer.stats.food = 20;
  ok("healthy with one enemy picks fight", PodPilot._choose(myPlayer) === "fight", PodPilot._choose(myPlayer));
  for (let i = 0; i < 3; i++)
    players.push({ sid: 60 + i, name: "M" + i, x: 1120 + i * 10, y: 1010, visible: true, health: 100, maxHealth: 100 });
  ok("outnumbered picks flee", PodPilot._choose(myPlayer) === "flee", PodPilot._choose(myPlayer));
  players.length = 1;
  myPlayer.upgradePoints = 1;
  ok("an unspent upgrade point wins", PodPilot._choose(myPlayer) === "upgrade");
  myPlayer.upgradePoints = 0;

  // Steering feeds the client's own pathfinder.
  PodPilot._open("farm");
  PodPilot.steer();
  ok("farm sets a destination", !!api.tick.pathPosition, api.tick.pathPosition);
  ok("farm heads for the stone field", api.tick.pathPosition.x > 1500, api.tick.pathPosition);
  ok("farm avoids enemy spikes", api.tick.pathMode.avoidEnemySpikes === true);
  // Far enough away that it should close but not swing yet.
  players.push({ sid: 55, name: "Foe", x: 1500, y: 1000, visible: true, health: 100, maxHealth: 100 });
  PodPilot._open("fight");
  calls.atck = 0;
  PodPilot.steer();
  ok("fight closes on the enemy", !!api.tick.pathPosition && api.tick.pathPosition.x > 1300, api.tick.pathPosition);
  ok("fight holds its swing out of range", api.tick.attackState === 0, api.tick.attackState);
  players[players.length - 1].x = 1150;                // now inside reach
  PodPilot.steer();
  ok("fight swings when in range", api.tick.attackState === 1, api.tick.attackState);
  ok("the swing was actually sent", calls.atck === 1, calls.atck);
  PodPilot.steer();
  ok("an unchanged swing is not re-sent", calls.atck === 1, calls.atck);
  PodPilot._open("flee");
  PodPilot.steer();
  ok("flee stops swinging", api.tick.attackState === 0);
  ok("flee avoids enemies", api.tick.pathMode.avoidEnemy === true);
  players.length = 1;

  // The non-movement actions use the client's own primitives.
  calls.heal.length = 0; calls.place.length = 0; calls.upgrade.length = 0;
  myPlayer.health = 40;
  PodPilot.goal = "heal"; PodPilot._doHeal(myPlayer);
  ok("heal eats food", calls.heal.length === 1, calls.heal);
  myPlayer.health = 100;
  myPlayer.upgradePoints = 1; myPlayer.upgrAge = 2;
  PodPilot._doUpgrade(myPlayer);
  ok("upgrade follows the shared age path", calls.upgrade[0] === 5, calls.upgrade);
  myPlayer.upgradePoints = 0;
  myPlayer.stats.wood = 500;
  PodPilot._lastBuild = 0;
  PodPilot._doBuild(myPlayer);
  ok("build places a windmill", calls.place.length === 1 && calls.place[0].id === myPlayer.items[3], calls.place);
  PodPilot._doBuild(myPlayer);
  ok("building is rate limited", calls.place.length === 1);
  players.push({ sid: 55, name: "Foe", x: 1150, y: 1000, visible: true, health: 100, maxHealth: 100 });
  PodPilot._lastSpike = 0;
  PodPilot._doCombatItems(myPlayer);
  ok("combat drops a spike on a close enemy", calls.place.length === 2 &&
     calls.place[1].id === myPlayer.items[2], calls.place);
  players.length = 1;

  // Learning: episodes are scored and the table steers later choices.
  console.log("\n[learning]");
  PodMemory.load().tactics = {};
  PodPilot._open("farm");
  PodPilot._episode.start.t = Date.now() - 20000;      // a 20-second episode
  myPlayer.kills = 3;                                  // three kills happened
  PodPilot._close("test");
  const table = PodMemory.load().tactics;
  ok("an episode is recorded", Object.keys(table).length === 1, table);
  ok("it is keyed by goal and situation", !!table["farm@clear"], Object.keys(table));
  ok("kills score positively", table["farm@clear"].avg > 0, table["farm@clear"]);
  const good = table["farm@clear"].avg;
  // A short episode is noise, not evidence.
  PodPilot._open("build");
  PodPilot._close("test");
  ok("episodes under four seconds are discarded", !table["build@clear"], Object.keys(table));
  // A death is scored against the goal that was running.
  PodPilot._open("explore");
  PodPilot._episode.start.t = Date.now() - 15000;
  myPlayer.alive = false;
  PodPilot._close("test");
  myPlayer.alive = true;
  ok("dying scores against the goal", table["explore@clear"].avg < good, table["explore@clear"]);
  ok("rating reads back", PodPilot.rating("farm", "clear") === table["farm@clear"].avg);
  ok("an untried goal has no rating", PodPilot.rating("heal", "heavy") === null);
  ok("the record renders for the model", /farm@clear/.test(PodPilot.report()), PodPilot.report());
  ok("the record reaches the briefing", /what has worked/.test(Pod._field()), Pod._field().slice(-260));

  // The learned table survives a reload, which is the whole point of learning.
  PodMemory.save();
  PodMemory.data = null;
  ok("learning persists across sessions", !!PodMemory.load().tactics["farm@clear"],
     PodMemory.load().tactics);

  // With farm rated well above explore, the policy should prefer it.
  PodMemory.load().tactics = { "farm@clear": { n: 30, sum: 300, avg: 10 },
                               "explore@clear": { n: 30, sum: -300, avg: -10 },
                               "build@clear": { n: 30, sum: -300, avg: -10 } };
  let farmPicks = 0;
  for (let i = 0; i < 200; i++) if (PodPilot._choose(myPlayer) === "farm") farmPicks++;
  ok("the policy follows what worked", farmPicks > 140, farmPicks + "/200");
  ok("…but still explores sometimes", farmPicks < 200, farmPicks + "/200");

  // The director's plan is validated and time-limited.
  ok("set_plan rejects nonsense", /unknown goal/.test(PodPilot.setPlan("conquer", "")));
  ok("set_plan accepts a real goal", /plan set: fight/.test(PodPilot.setPlan("fight", "they are hurt")));
  ok("the plan takes effect", PodPilot.goal === "fight", PodPilot.goal);
  PodPilot._aiUntil = Date.now() - 1;
  myPlayer.health = 100;
  // The policy is deliberately stochastic, so this asserts the property that
  // matters: an expired plan no longer forces its goal.
  const afterStale = [];
  for (let i = 0; i < 60; i++) afterStale.push(PodPilot._choose(myPlayer));
  ok("a stale plan stops overriding", afterStale.indexOf("fight") < 0, [...new Set(afterStale)]);

  // The tools the model actually calls.
  ok("pilot tool reports", /autopilot/.test(Pod._tool("pilot", { action: "status" })));
  ok("pilot tool stops it", /off/.test(Pod._tool("pilot", { action: "off" })) && PodPilot.on === false);
  ok("pilot tool starts it", /flying|paused/.test(Pod._tool("pilot", { action: "on" })) && PodPilot.on === true);
  ok("set_plan tool works", /plan set: farm/.test(Pod._tool("set_plan", { goal: "farm", why: "quiet" })));
  Pod.handle("/pilot off");
  ok("/pilot off disengages", PodPilot.on === false);
  Pod.handle("play for me");
  ok("plain language engages it", PodPilot.on === true);
  Pod.handle("stop playing for me");
  ok("plain language stops it", PodPilot.on === false);
  // Regression: "top" used to match inside "stop", so this asked for the
  // leaderboard instead of stopping the autopilot.
  const boardBefore = Pod.lines.length;
  Pod.handle("stop");
  ok("a short keyword does not match inside a longer word",
     !Pod.lines.slice(boardBefore).some(l => /Server board/.test(l.full)),
     Pod.lines.slice(boardBefore).map(l => l.full));
  Pod.handle("top");
  ok("…but still matches on its own",
     Pod.lines.slice(boardBefore).some(l => /Server board|Leaderboard is not/.test(l.full)),
     Pod.lines.slice(boardBefore).map(l => l.full));
  ok("every goal in POD_GOALS is reachable", POD_GOALS.every(g => /plan set/.test(PodPilot.setPlan(g, ""))),
     POD_GOALS);
  PodPilot.enable(false);
  PodMemory.load().tactics = {};

  // ---- 8. the free providers ----------------------------------------------
  // Each speaks a different wire format. These check the request we build and
  // the stream we parse, including the tool round trip, for all of them.
  console.log("\n[gemini]");
  PodMemory.clearHistory();
  const gSeen = [];
  fetchImpl = async (url, opts) => {
    gSeen.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    if (gSeen.length === 1) {
      return sseResponse([
        'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"recommend_move","args":{"goal":"farm"}}}]}}]}\n\n'
      ]);
    }
    return sseResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"اقتراح: "}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"تحرّك شرقك."}]},"finishReason":"STOP"}]}\n\n'
    ]);
  };
  W.vars.podAI = true;
  W.vars.podProvider = "gemini";
  W.vars.podKeyGemini = "AIza-test";
  PodMark.clear();
  await Pod._askAI("وين أروح");

  ok("gemini made two calls", gSeen.length === 2, gSeen.length);
  ok("gemini streaming endpoint", /:streamGenerateContent\?alt=sse/.test(gSeen[0].url), gSeen[0].url);
  ok("gemini default model in the path", /models\/gemini-2\.0-flash:/.test(gSeen[0].url), gSeen[0].url);
  ok("gemini key in the query", /key=AIza-test/.test(gSeen[0].url));
  ok("gemini sends no auth header", !gSeen[0].headers["authorization"]);
  ok("gemini system_instruction set", !!gSeen[0].body.system_instruction.parts[0].text);
  ok("gemini tools declared", gSeen[0].body.tools[0].function_declarations.length === POD_TOOLS.length);
  ok("gemini contents carry the field brief", /\[FIELD\]/.test(gSeen[0].body.contents[0].parts[0].text));
  const gReplay = gSeen[1].body.contents;
  ok("gemini replays the model turn", gReplay.some(c => c.role === "model" && c.parts.some(p => p.functionCall)),
     gReplay.map(c => c.role));
  const fr = gReplay[gReplay.length - 1].parts[0].functionResponse;
  ok("gemini sends a functionResponse", !!fr, gReplay[gReplay.length - 1]);
  ok("functionResponse names the tool", fr && fr.name === "recommend_move", fr);
  ok("functionResponse carries the result", fr && /destination marked/.test(fr.response.result), fr);
  ok("gemini reply reached the log", /تحرّك/.test(Pod.lines[Pod.lines.length - 1].full),
     Pod.lines[Pod.lines.length - 1].full);
  ok("the tool ran and marked the map", PodMark.live());

  console.log("\n[openai-compatible]");
  PodMemory.clearHistory();
  const oSeen = [];
  let scanRuns = 0;
  const realTool = Pod._tool.bind(Pod);
  Pod._tool = (n, i) => { if (n === "scan") scanRuns++; return realTool(n, i); };
  fetchImpl = async (url, opts) => {
    oSeen.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    if (oSeen.length === 1) {
      // Tool call arriving as indexed fragments, the way these APIs stream it.
      return sseResponse([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_7","function":{"name":"scan","arguments":"{\\"rad"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ius\\":600}"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n'
      ]);
    }
    return sseResponse([
      'data: {"choices":[{"delta":{"content":"Analysis: "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"one hostile east."},"finish_reason":"stop"}]}\n\n'
    ]);
  };
  W.vars.podProvider = "groq";
  W.vars.podKeyGroq = "gsk-test";
  W.vars.podLang = "en";
  await Pod._askAI("what is out there");

  ok("groq made two calls", oSeen.length === 2, oSeen.length);
  ok("groq endpoint", oSeen[0].url === "https://api.groq.com/openai/v1/chat/completions", oSeen[0].url);
  ok("groq bearer auth", oSeen[0].headers["authorization"] === "Bearer gsk-test", oSeen[0].headers);
  ok("groq default model", oSeen[0].body.model === "llama-3.3-70b-versatile", oSeen[0].body.model);
  ok("groq system message first", oSeen[0].body.messages[0].role === "system");
  ok("groq tools in function shape", oSeen[0].body.tools[0].type === "function" &&
     !!oSeen[0].body.tools[0].function.parameters, oSeen[0].body.tools[0]);
  const oReplay = oSeen[1].body.messages;
  const oAsst = oReplay.find(m => m.role === "assistant" && m.tool_calls);
  ok("assistant turn replayed with tool_calls", !!oAsst, oReplay.map(m => m.role));
  ok("fragmented arguments assembled", oAsst && JSON.parse(oAsst.tool_calls[0].function.arguments).radius === 600,
     oAsst && oAsst.tool_calls[0]);
  const oTool = oReplay[oReplay.length - 1];
  ok("tool result sent as a tool message", oTool.role === "tool" && oTool.tool_call_id === "call_7", oTool);
  ok("tool result carries the scan", /hostiles\(/.test(oTool.content), oTool.content);
  ok("each tool call runs exactly once", scanRuns === 1, scanRuns);
  ok("openai reply reached the log", /one hostile east/.test(Pod.lines[Pod.lines.length - 1].full),
     Pod.lines[Pod.lines.length - 1].full);
  Pod._tool = realTool;

  // Ollama is the same adapter without a key, on localhost.
  const lSeen = [];
  fetchImpl = async (url, opts) => {
    lSeen.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    return sseResponse(['data: {"choices":[{"delta":{"content":"Affirmative."},"finish_reason":"stop"}]}\n\n']);
  };
  W.vars.podProvider = "ollama";
  ok("ollama needs no key", PodLink.ready() === true);
  await Pod._askAI("status");
  ok("ollama hits localhost", /^http:\/\/localhost:11434/.test(lSeen[0].url), lSeen[0].url);
  ok("ollama sends no auth header", !lSeen[0].headers["authorization"], lSeen[0].headers);
  ok("ollama reply reached the log", /Affirmative/.test(Pod.lines[Pod.lines.length - 1].full));

  // Readiness gating: a provider with no key must not fire a request.
  W.vars.podProvider = "openrouter";
  W.vars.podKeyOpenRouter = "";
  ok("provider without a key is not ready", PodLink.ready() === false);
  const guardCount = lSeen.length;
  await Pod._askAI("hello");
  ok("no request without a key", lSeen.length === guardCount, lSeen.length);
  ok("falls back to local analysis", Pod.lines.some(l => /No AI provider configured/.test(l.full)));

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
