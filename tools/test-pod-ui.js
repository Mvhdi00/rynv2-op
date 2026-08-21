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
  podEnabled: true, podVariant: 0, podLang: "en", podMemory: true,
  podAI: false, podAIKey: "", podAIModel: "",
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
const myPlayer = { sid: 1, x: 1000, y: 1000, alive: true, health: 100, maxHealth: 100, kills: 0,
                   age: 3, items: [0, 3, 6, 10], weaponIndex: 0, stats: { wood: 40, food: 12, stone: 8, gold: 3 } };
const players = [myPlayer];
const items = { weapons: [{ name: "tool hammer" }], list: [] };
const UTILS = { getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) };
const config = { mapScale: 14400 };

// fetch is replaced per-test.
let fetchImpl = async () => { throw new Error("no fetch configured"); };
const fetch = (...args) => fetchImpl(...args);

const make = new Function(
  "window", "document", "navigator", "localStorage", "fetch", "TextDecoder",
  "setInterval", "clearInterval", "saveConfig", "lerp",
  "myPlayer", "players", "botViewPlayers", "botViewSelf", "inBotView", "isAlly",
  "UTILS", "config", "killCount", "items", "ais", "gameObjects",
  "spikes_our", "traps_our", "attackState", "mainContext",
  "mouseX", "mouseY", "screenWidth", "screenHeight",
  BLOCK + "\n return { Pod, PodVoice, PodEars, PodMemory, podLangNow, PT, POD_TOOLS, podSystemPrompt, POD_UNITS };");

const api = make(
  W, D, nav, localStorage, fetch, TextDecoder,
  W.setInterval.bind(W), W.clearInterval.bind(W), saveConfig, (s, e, t) => s + (e - s) * t,
  myPlayer, players, players, null, () => false, () => false,
  UTILS, config, 0, items, [], [],
  [], [], 0, null,
  0, 0, 1920, 1080);

const { Pod, PodVoice, PodEars, PodMemory, podLangNow, PT, POD_TOOLS, podSystemPrompt } = api;

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
ok("threat answered", /No hostiles|Nearest hostile/.test(Pod.lines[Pod.lines.length - 1].full));

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
  ok("tools declared", seen[0].body.tools.length === 3);
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

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
