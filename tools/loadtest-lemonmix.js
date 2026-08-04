#!/usr/bin/env node
/*
 * loadtest-lemonmix.js
 *
 * Loads LemonMod_Mix.user.js into a headless page and reports whether the mod
 * actually comes up.
 *
 * verify-lemonmix.js proves the packet layer is correct. That is not the same
 * as the script working: the first build passed every protocol check and still
 * showed nothing in game, because it threw on `null.addEventListener` before
 * it ever got as far as building a menu. Everything below that line was dead
 * and no check noticed, because no check ran the script.
 *
 * This one runs it. The page is built from the element ids the game bundle
 * itself reaches for, so a missing element here means the mod expects
 * something the game does not provide — not that the harness is thin.
 *
 *   npm i --no-save jsdom
 *   node tools/loadtest-lemonmix.js [path/to/LemonMod_Mix.user.js] [--start|--idle]
 */

const fs = require("fs");
const path = require("path");

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = require("jsdom"));
} catch (e) {
  console.error("needs jsdom: npm i --no-save jsdom");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const CLIENT_PATH = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(ROOT, "LemonMod_Mix.user.js"));
/* document-start is the harder case and the one the header asks for. */
const AT_START = !args.includes("--idle");

const script = fs.readFileSync(CLIENT_PATH, "utf8");
const gameSrc = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");

/* ------------------------------------------------------------------ *
 * Build the page out of what the game bundle expects to find
 * ------------------------------------------------------------------ */

const ids = new Set();
for (const m of gameSrc.matchAll(/getElementById\("([^"]+)"\)/g)) ids.add(m[1]);
for (const m of gameSrc.matchAll(/id="([^"]+)"/g)) ids.add(m[1]);

/* Static markup the game serves but never looks up by id from the bundle. */
for (const id of [
  "setupCard", "gameName", "adCard", "promoImgHolder", "linksContainer2",
  "desktopInstructions", "youtuberOf", "moomooio_728x90_home", "guideCard",
  "menuContainer", "mainMenu", "menuCardHolder",
]) ids.add(id);

const tagFor = (id) => {
  if (id === "gameCanvas" || /canvas/i.test(id)) return "canvas";
  if (id === "serverBrowser") return "select";
  if (/Input$|^nameInput$/.test(id)) return "input";
  if (/Button$/.test(id)) return "button";
  return "div";
};

const markup = [...ids].map((id) => {
  const tag = tagFor(id);
  if (tag === "select") return `<select id="${id}"><option value="vult:0:0:0">EU 1</option></select>`;
  if (tag === "input") return `<input id="${id}" type="text">`;
  return `<${tag} id="${id}"></${tag}>`;
}).join("\n");

const HTML = `<!doctype html><html><head><title>MooMoo.io</title></head><body>\n${markup}\n</body></html>`;

/* ------------------------------------------------------------------ *
 * Page shims
 * ------------------------------------------------------------------ */

const timerErrors = [];
const consoleErrors = [];
const vc = new VirtualConsole();
/* jsdom's CSS parser rejects rules every browser accepts, and it reports that
 * on the same channel as real exceptions. */
const HARNESS_NOISE = /Could not parse CSS stylesheet|Not implemented: HTMLCanvasElement/;
vc.on("jsdomError", (e) => {
  if (HARNESS_NOISE.test(e.message)) return;
  const at = (e.stack || "").split("\n").find((l) => /<anonymous>:\d+/.test(l)) || "";
  timerErrors.push(e.message.split("\n")[0] + (at ? "  " + at.trim() : ""));
});
vc.on("error", (...a) => consoleErrors.push(String(a[0]).slice(0, 200)));

const dom = new JSDOM(HTML, {
  runScripts: "outside-only",
  pretendToBeVisual: true,
  url: "https://moomoo.io/",
  virtualConsole: vc,
  beforeParse(win) {
    const ctx = new Proxy({}, {
      get: (t, k) => (k === "canvas" ? {} : k in t ? t[k] : () => ({ addColorStop() {}, width: 10 })),
      set: () => true,
    });
    win.HTMLCanvasElement.prototype.getContext = () => ctx;
    win.Audio = function () {
      return { play: () => Promise.resolve(), pause() {}, addEventListener() {}, volume: 0, loop: false };
    };
    win.WebSocket = function () { this.send = () => {}; this.close = () => {}; this.addEventListener = () => {}; };
    win.WebSocket.prototype = { send() {}, close() {}, addEventListener() {} };
    win.requestAnimationFrame = () => 0;
    win.alert = () => {};
    win.prompt = () => null;
    win.open = () => null;
    win.fetch = () => Promise.resolve({ text: () => Promise.resolve("data={\"servers\":[]};"), json: () => Promise.resolve({}) });
    /* jsdom only defines this when the optional `canvas` package is present.
     * Every browser has it; the shim is a harness gap, not a finding. */
    if (!win.CanvasRenderingContext2D) {
      win.CanvasRenderingContext2D = function () {};
      win.CanvasRenderingContext2D.prototype = { rotate() {}, roundRect() {}, fill() {} };
    }
  },
});

const win = dom.window;
const windowErrors = [];
win.addEventListener("error", (e) => windowErrors.push(String(e.error || e.message)));

let threw = null;
function evaluate(label) {
  try {
    win.eval(script);
    console.log(`  evaluated at ${label} with no thrown error`);
  } catch (e) {
    threw = e;
    const at = (e.stack || "").split("\n").find((l) => /<anonymous>:\d+/.test(l)) || "";
    console.log(`  THREW at ${label}: ${e.constructor && e.constructor.name}: ${e.message}`);
    if (at) console.log(`    ${at.trim()}`);
  }
}

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("page   :", ids.size, "elements, built from src/game_index.js");
console.log("timing :", AT_START ? "document-start" : "document-idle");
console.log("");

if (AT_START || win.document.readyState !== "loading") {
  evaluate(AT_START ? "document-start" : "document-idle");
} else {
  win.document.addEventListener("DOMContentLoaded", () => evaluate("document-idle"));
}

/* ------------------------------------------------------------------ *
 * What should exist once the mod is up
 * ------------------------------------------------------------------ */

const WANT = [
  ["mm-menu-container", "the settings menu"],
  ["modSettingsButton", "the menu button"],
  ["consoleButton", "the console button"],
  ["instaDisplay", "the insta HUD readout"],
  ["shameDisplay", "the shame counter"],
  ["newScoreDisplay", "the score readout"],
  ["onekey", "the keystroke overlay"],
  ["reloadBars", "the reload-bar toggle (Visuals)"],
  ["autoPlace", "the autoplace toggle"],
  ["silentMode", "the silent-chat toggle"],
];

setTimeout(() => {
  console.log("");
  const missing = [];
  for (const [id, what] of WANT) {
    const ok = !!win.document.getElementById(id);
    if (!ok) missing.push(`${id} (${what})`);
    console.log(`  ${ok ? "built  " : "MISSING"} ${id.padEnd(20)} ${what}`);
  }

  console.log("");
  console.log("  window.LemonMix   :", win.LemonMix ? "present" : "MISSING");
  console.log("  body still intact :", win.document.body && win.document.body.children.length > 5 ? "yes" : "NO - something cleared it");

  const errs = [...timerErrors, ...windowErrors];
  if (errs.length) {
    console.log("");
    console.log("  runtime errors:");
    for (const e of [...new Set(errs)].slice(0, 8)) console.log("    " + e);
  }
  if (consoleErrors.length) {
    console.log("");
    console.log("  console.error:");
    for (const e of [...new Set(consoleErrors)].slice(0, 5)) console.log("    " + e);
  }

  console.log("");
  const bad = threw || missing.length || errs.length;
  if (bad) {
    if (threw) console.log("FAIL - the script threw on load");
    if (missing.length) console.log("FAIL - the mod did not finish building: " + missing.join(", "));
    if (errs.length) console.log("FAIL - " + errs.length + " runtime error(s)");
    process.exit(1);
  }
  console.log("OK - the mod loads and builds its UI.");
  process.exit(0);
}, 3000);
