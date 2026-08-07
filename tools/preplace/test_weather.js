// Drive the weather overlay out of a shipped build against a mock canvas.
// The point of the effect is that it is cheap, so most of these check cost:
// draw calls per frame, allocations, and canvas reallocation.
//
//   node test_weather.js            owner build
//   node test_weather.js --player   the copy spliced into the obfuscated build
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const REPO = path.resolve(__dirname, "..", "..");
const RYN_OWNER = path.join(REPO, "RYN_Client_v5_OWNER.user.js");
const RYN_PLAYER = path.join(REPO, "RYN_Client_v5_PLAYER.user.js");

const usePlayer = process.argv.includes("--player");
const src = fs.readFileSync(usePlayer ? RYN_PLAYER : RYN_OWNER, "utf8");
console.log(usePlayer ? "(player build)" : "(owner build)");

const START = "  const WEATHER_MAX_PARTICLES = 420;";
// stop at the rAF loop so the test drives the frames itself
const END = "  (function _weatherLoop(now) {";
const a = src.indexOf(START), b = src.indexOf(END);
if (a < 0 || b < a) throw new Error("could not slice the weather block out");
const code = src.slice(a, b);

// ---- mocks ----------------------------------------------------------------
const calls = { stroke: 0, fill: 0, clearRect: 0, resize: 0, arc: 0, moveTo: 0, lineTo: 0 };
function makeCtx() {
  return {
    globalAlpha: 1, strokeStyle: "", fillStyle: "", lineWidth: 1,
    clearRect: () => calls.clearRect++,
    beginPath() {},
    moveTo: () => calls.moveTo++,
    lineTo: () => calls.lineTo++,
    arc: () => calls.arc++,
    stroke: () => calls.stroke++,
    fill: () => calls.fill++,
  };
}
class FakeCanvas {
  constructor(tag) {
    this.tagName = tag;
    this.style = {};
    this.isConnected = false;
    this.parentNode = null;
    this._w = 0; this._h = 0;
    this._ctx = makeCtx();
  }
  get width() { return this._w; }
  set width(v) { if (v !== this._w) calls.resize++; this._w = v; }
  get height() { return this._h; }
  set height(v) { if (v !== this._h) calls.resize++; this._h = v; }
  getContext() { return this._ctx; }
  remove() { this.isConnected = false; this.parentNode = null; overlay = null; }
}

const gameCanvas = new FakeCanvas("canvas");
gameCanvas.isConnected = true;
gameCanvas._w = 1600; gameCanvas._h = 900;
gameCanvas.clientWidth = 1600; gameCanvas.clientHeight = 900;
let overlay = null;
gameCanvas.parentNode = { appendChild(el) { el.isConnected = true; el.parentNode = this; overlay = el; } };

const document_ = {
  querySelector: sel => (sel === "#gameCanvas" ? gameCanvas : null),
  createElement: tag => new FakeCanvas(tag),
};

const Config_default = { snowBiomeTop: 2400, mapScale: 14400, riverWidth: 724 };
const Settings_default = { _weather: true, _weatherAmount: 45, _lowQuality: false };
const myPlayer = { inGame: true, pos: { current: { x: 7200, y: 7000 } } };
const client = { myPlayer };

const globals = { Config_default, Settings_default, client };
const sandbox = { Math, Number, document: document_, performance: { now: () => 0 }, console };
if (usePlayer) {
  const NAMES = require("./names.js");
  for (const [logical, mangled] of Object.entries(NAMES)) {
    if (logical in globals) sandbox[mangled] = globals[logical];
  }
} else {
  Object.assign(sandbox, globals);
}
vm.createContext(sandbox);
vm.runInContext(code + "\nglobalThis.__W = Weather;", sandbox);
const W = sandbox.__W;

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
};
const reset = () => { for (const k in calls) calls[k] = 0; };

let t = 0;
const step = (ms = 16) => { t += ms; W.frame(t); };

// ---------------------------------------------------------------------------
console.log("startup");
step();
check("creates one overlay canvas", overlay !== null);
check("the overlay does not take pointer events", /pointer-events:\s*none/.test(overlay.style.cssText));
check("it sits behind the HUD", /z-index:\s*49/.test(overlay.style.cssText));
check("it matches the game canvas size", overlay.width === 1600 && overlay.height === 900);
check("particles were pooled", W.particles.length > 0);

// ---------------------------------------------------------------------------
console.log("cost per frame");
for (let i = 0; i < 5; i++) step(); // settle
reset();
step();
check("clears once a frame", calls.clearRect === 1);
check("rain is a single stroke", calls.stroke === 1);
check("no snow pass outside the biome", calls.fill === 0);
check("one moveTo+lineTo per drop, nothing more",
      calls.moveTo === W.count && calls.lineTo === W.count);
check("no canvas reallocation on a steady frame", calls.resize === 0);

const poolBefore = W.particles.length;
const snapshot = W.particles[0];
for (let i = 0; i < 120; i++) step();
check("the pool never grows after warm-up", W.particles.length === poolBefore);
check("particles are recycled in place, not reallocated", W.particles[0] === snapshot);

// draw calls stay flat as particle count rises
Settings_default._weatherAmount = 100;
step(); step();
reset();
step();
check("draw calls stay flat at max intensity", calls.stroke === 1 && calls.clearRect === 1);
check("max intensity really does raise the count", W.count > 200);
Settings_default._weatherAmount = 45;

// ---------------------------------------------------------------------------
console.log("snow biome");
myPlayer.pos.current.y = 1000; // above snowBiomeTop
for (let i = 0; i < 200; i++) step();
check("turns to snow inside the biome", W.snow > 0.95);
reset();
step();
check("snow is a single fill", calls.fill === 1);
check("rain has faded out", calls.stroke === 0);
check("one arc per flake", calls.arc === W.count);

// crossing back
myPlayer.pos.current.y = 7000;
step();
check("does not snap back instantly", W.snow > 0.5);
for (let i = 0; i < 200; i++) step();
check("returns to rain outside the biome", W.snow < 0.05);

// mid-transition both layers draw
myPlayer.pos.current.y = 1000;
for (let i = 0; i < 12; i++) step();
reset();
step();
check("both layers draw mid-transition", calls.stroke === 1 && calls.fill === 1);
myPlayer.pos.current.y = 7000;
for (let i = 0; i < 200; i++) step();

// ---------------------------------------------------------------------------
console.log("teardown");
Settings_default._weather = false;
step();
check("removes the canvas when switched off", overlay === null);
reset();
step();
check("costs nothing while off", calls.clearRect === 0 && calls.stroke === 0 && calls.fill === 0);
Settings_default._weather = true;
step();
check("comes back when switched on", overlay !== null);

myPlayer.inGame = false;
step();
check("removes the canvas out of game", overlay === null);
myPlayer.inGame = true;
step();
check("comes back in game", overlay !== null);

// ---------------------------------------------------------------------------
console.log("edge cases");
for (let i = 0; i < 5; i++) step();
reset();
gameCanvas._w = 1280; gameCanvas._h = 720;
gameCanvas.clientWidth = 1280; gameCanvas.clientHeight = 720;
step();
check("follows a resize", overlay.width === 1280 && overlay.height === 720);
reset();
step();
check("but does not resize again once settled", calls.resize === 0);

Settings_default._weatherAmount = 0;
step();
reset();
step();
check("intensity 0 draws nothing", calls.stroke === 0 && calls.fill === 0);
Settings_default._weatherAmount = 45;

Settings_default._lowQuality = true;
step(); step();
const lowCount = W.count;
Settings_default._lowQuality = false;
step(); step();
check("low quality thins the field", lowCount < W.count);

// a backgrounded tab hands back a huge delta
for (let i = 0; i < 5; i++) step();
const yBefore = W.particles[0].y;
step(5000);
const moved = Math.abs(W.particles[0].y - yBefore);
check("a huge frame gap does not teleport particles", moved < 200 || W.particles[0].y < 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
