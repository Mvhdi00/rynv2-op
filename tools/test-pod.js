// Pulls the real Pod blocks out of the userscript and exercises them under
// mocks, so the SSE parser, the memory store and the language table are tested
// as shipped rather than as a copy.
const fs = require("fs");
const path = require("path");
const SCRIPT = path.join(__dirname, "..", "YoRHa_System.user.js");
const SRC = fs.readFileSync(SCRIPT, "utf8");

function slice(startMarker, endMarker) {
  const a = SRC.indexOf(startMarker);
  if (a < 0) throw new Error("start marker not found: " + startMarker);
  const b = SRC.indexOf(endMarker, a);
  if (b < 0) throw new Error("end marker not found: " + endMarker);
  return SRC.slice(a, b + endMarker.length);
}

// ---- mocks ----------------------------------------------------------------
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
// Node's own `navigator` is a read-only global, so the mock is passed in
// explicitly rather than assigned onto globalThis.
const nav = { language: "en-US" };
global.window = { vars: { podLang: "auto", podMemory: true } };
global.document = { activeElement: null };

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra !== undefined ? "  <= " + JSON.stringify(extra) : "")); }
}

// ---- 1. language table ----------------------------------------------------
console.log("\n[language]");
const langCode = slice("function podLangNow() {", "function PT(key, vars) {") +
  `
    const tbl0 = POD_STR[podLangNow()] || POD_STR.en;
    let s0 = tbl0[key] !== undefined ? tbl0[key] : (POD_STR.en[key] || key);
    if (vars) for (const k in vars) s0 = s0.split("{" + k + "}").join(vars[k]);
    return s0;
  }
  module.exports = { podLangNow, podIsRTL, PT, POD_STR };`;
const langMod = new Function("module", "window", "navigator", langCode);
const langOut = { exports: {} };
langMod(langOut, global.window, nav);
const { podLangNow, PT, POD_STR } = langOut.exports;

ok("auto resolves to en for en-US", podLangNow() === "en", podLangNow());
nav.language = "ar-SA";
ok("auto resolves to ar for ar-SA", podLangNow() === "ar", podLangNow());
global.window.vars.podLang = "en";
ok("explicit en wins over browser ar", podLangNow() === "en");
global.window.vars.podLang = "ar";
ok("explicit ar", podLangNow() === "ar");
ok("PT returns Arabic", PT("standby") === POD_STR.ar.standby, PT("standby"));
ok("PT interpolates", PT("bootBack", { n: 7 }).indexOf("7") >= 0, PT("bootBack", { n: 7 }));
global.window.vars.podLang = "en";
ok("PT returns English", PT("standby") === "STANDBY", PT("standby"));

// Every key present in en must exist in ar, or a language half-applies.
const missing = Object.keys(POD_STR.en).filter(k => POD_STR.ar[k] === undefined);
ok("ar table covers every en key", missing.length === 0, missing);
const missingEn = Object.keys(POD_STR.ar).filter(k => POD_STR.en[k] === undefined);
ok("en table covers every ar key", missingEn.length === 0, missingEn);

// ---- 2. memory store ------------------------------------------------------
console.log("\n[memory]");
const memCode = slice("const PodMemory = {", "\n        };") +
  "\n module.exports = PodMemory;";
const memMod = new Function("module", "window", "localStorage", memCode);
const memOut = { exports: {} };
memMod(memOut, global.window, global.localStorage);
const PodMemory = memOut.exports;

ok("blank load", PodMemory.load().facts.length === 0);
ok("addFact", PodMemory.addFact("operator plays polearm", "build") === true);
ok("duplicate rejected", PodMemory.addFact("Operator Plays Polearm", "build") === false);
ok("empty rejected", PodMemory.addFact("   ", "x") === false);
ok("fact stored", PodMemory.load().facts.length === 1);
ok("persisted to storage", !!store["yorha_pod_memory_v2"]);
ok("search hit", PodMemory.search("polearm").length === 1);
ok("search miss", PodMemory.search("zzz").length === 0);
PodMemory.note("kill", 3);
PodMemory.note("best", 5);
PodMemory.note("death");
ok("kills counted", PodMemory.load().stats.kills === 3, PodMemory.load().stats);
ok("best tracked", PodMemory.load().stats.best === 5, PodMemory.load().stats.best);
ok("deaths counted", PodMemory.load().stats.deaths === 1);
ok("session increments", PodMemory.startSession() === 1);
ok("session increments again", PodMemory.startSession() === 2);

// Cap enforcement.
for (let i = 0; i < 60; i++) PodMemory.addFact("fact number " + i, "bulk");
ok("facts capped at MAXF", PodMemory.load().facts.length === PodMemory.MAXF, PodMemory.load().facts.length);
for (let i = 0; i < 40; i++) PodMemory.pushTurn("user", "turn " + i);
ok("history capped at MAXH", PodMemory.load().history.length === PodMemory.MAXH, PodMemory.load().history.length);

const brief = PodMemory.brief();
ok("brief mentions stats", /lifetime_kills:3/.test(brief), brief.slice(0, 120));
ok("brief lists facts", /remembered:/.test(brief));

// Reload from disk: a fresh instance must see the same data.
const memOut2 = { exports: {} };
memMod(memOut2, global.window, global.localStorage);
ok("survives a reload", memOut2.exports.load().stats.kills === 3, memOut2.exports.load().stats);
ok("facts survive a reload", memOut2.exports.load().facts.length === PodMemory.MAXF);

PodMemory.dropFact(0);
ok("dropFact removes one", PodMemory.load().facts.length === PodMemory.MAXF - 1);
PodMemory.clearHistory();
ok("clearHistory empties history", PodMemory.load().history.length === 0);
ok("clearHistory keeps facts", PodMemory.load().facts.length > 0);
PodMemory.clearAll();
ok("clearAll wipes", PodMemory.load().facts.length === 0 && PodMemory.load().stats.kills === 0);

// Corrupt storage must not throw.
store["yorha_pod_memory_v2"] = "{not json";
const memOut3 = { exports: {} };
memMod(memOut3, global.window, global.localStorage);
let threw = false;
try { memOut3.exports.load(); } catch (e) { threw = true; }
ok("corrupt storage does not throw", !threw);
ok("corrupt storage yields a blank store", memOut3.exports.load().facts.length === 0);

// Memory disabled -> empty brief.
global.window.vars.podMemory = false;
ok("brief empty when memory is off", PodMemory.brief() === "");
global.window.vars.podMemory = true;

// ---- 3. the SSE parser ----------------------------------------------------
console.log("\n[sse]");
// The parser is a method on Pod; lift the body into a standalone async fn.
const streamBody = slice("async _stream(body, onText) {", "return { content: blocks.filter(Boolean), stop_reason: stop };");
const inner = streamBody
  .replace("async _stream(body, onText) {", "")
  .replace(/^\s*const res = await fetch\([\s\S]*?\}\);\s*$/m, "");
// Rebuild as a function taking a prepared Response-like object.
const parseSrc = `
  return async function parse(res, onText) {
    ${inner.slice(inner.indexOf("if (!res.ok || !res.body)"))}
    return { content: blocks.filter(Boolean), stop_reason: stop };
  };`;
const parse = new Function("TextDecoder", parseSrc)(TextDecoder);

function fakeRes(chunks, opts) {
  opts = opts || {};
  let i = 0;
  return {
    ok: opts.ok !== false,
    status: opts.status || 200,
    body: opts.noBody ? null : {
      getReader: () => ({
        read: async () => (i < chunks.length
          ? { done: false, value: Buffer.from(chunks[i++], "utf8") }
          : { done: true })
      })
    },
    text: async () => opts.text || ""
  };
}

(async () => {
  // A plain text reply, split across chunk boundaries mid-frame.
  const sse =
    'event: message_start\ndata: {"type":"message_start","message":{"id":"m"}}\n\n' +
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Alert: "}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hostile north."}}\n\n' +
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n' +
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n' +
    'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  // Deliberately nasty split points.
  const chunks = [];
  for (let p = 0; p < sse.length; p += 37) chunks.push(sse.slice(p, p + 37));

  let streamed = "";
  let r = await parse(fakeRes(chunks), t => { streamed += t; });
  ok("text assembled across chunk splits", r.content[0].text === "Alert: hostile north.", r.content[0]);
  ok("onText saw every delta", streamed === "Alert: hostile north.", streamed);
  ok("stop_reason captured", r.stop_reason === "end_turn", r.stop_reason);

  // CRLF line endings.
  r = await parse(fakeRes([sse.replace(/\n/g, "\r\n")]), () => {});
  ok("CRLF stream parses", r.content[0].text === "Alert: hostile north.", r.content[0]);

  // A tool call, with the JSON arriving in fragments.
  const toolSse =
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n' +
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Scanning."}}\n\n' +
    'data: {"type":"content_block_stop","index":0}\n\n' +
    'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"scan","input":{}}}\n\n' +
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"rad"}}\n\n' +
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"ius\\": 700}"}}\n\n' +
    'data: {"type":"content_block_stop","index":1}\n\n' +
    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}\n\n';
  r = await parse(fakeRes([toolSse]), () => {});
  ok("tool_use block captured", r.content[1] && r.content[1].type === "tool_use", r.content[1]);
  ok("tool name", r.content[1].name === "scan");
  ok("tool id", r.content[1].id === "toolu_1");
  ok("fragmented tool JSON parsed", r.content[1].input.radius === 700, r.content[1].input);
  ok("stop_reason tool_use", r.stop_reason === "tool_use");
  ok("text block still present", r.content[0].text === "Scanning.");

  // Thinking deltas must be ignored, not concatenated into the reply.
  const thinkSse =
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}\n\n' +
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"secret"}}\n\n' +
    'data: {"type":"content_block_stop","index":0}\n\n' +
    'data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}\n\n' +
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Affirmative."}}\n\n' +
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n';
  streamed = "";
  r = await parse(fakeRes([thinkSse]), t => { streamed += t; });
  ok("thinking never reaches onText", streamed === "Affirmative.", streamed);
  const textOnly = r.content.filter(b => b.type === "text").map(b => b.text).join("");
  ok("thinking excluded from text", textOnly === "Affirmative.", textOnly);

  // A refusal.
  r = await parse(fakeRes(['data: {"type":"message_delta","delta":{"stop_reason":"refusal"}}\n\n']), () => {});
  ok("refusal surfaced", r.stop_reason === "refusal");

  // An in-stream error must throw, not return junk.
  threw = false;
  try {
    await parse(fakeRes(['data: {"type":"error","error":{"message":"overloaded"}}\n\n']), () => {});
  } catch (e) { threw = /overloaded/.test(e.message); }
  ok("stream error throws with the server message", threw);

  // A non-2xx response must throw with the API's message.
  threw = false;
  try {
    await parse(fakeRes([], { ok: false, status: 401, text: '{"error":{"message":"invalid x-api-key"}}' }), () => {});
  } catch (e) { threw = /invalid x-api-key/.test(e.message) && e.status === 401; }
  ok("HTTP error carries the API message and status", threw);

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
