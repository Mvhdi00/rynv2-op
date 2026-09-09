#!/usr/bin/env node
/*
 * check-food-texture.js
 *
 * The food resource wears a sakura texture instead of the game's berry bush.
 * Three things have to hold and none of them are visible by reading the diff:
 *
 *   1. the resourceTint hook still rewrites the game's resource draw, and the
 *      code it produces still parses and still hands the resource through;
 *   2. the texture that ships in the file really is a transparent PNG of the
 *      right size — a re-encode that flattened the alpha onto black would look
 *      identical in a diff;
 *   3. only food takes it, at the sprite's own dimensions, with nothing painted
 *      behind it.
 *
 *   node tools/check-food-texture.js [path/to/Ryn_Type_2.user.js]
 *
 * Needs terser for the bundle half:  npm i --no-save terser
 * Exits non-zero if any check fails.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "Ryn_Type_2.user.js");
const client = fs.readFileSync(CLIENT_PATH, "utf8");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  — " + detail : ""));
}
function sliceBlock(startMarker, endMarker) {
  const start = client.indexOf(startMarker);
  if (start === -1) throw new Error("marker not found: " + startMarker);
  const end = client.indexOf(endMarker, start);
  if (end === -1) throw new Error("end marker not found: " + endMarker);
  return client.slice(start, end + endMarker.length);
}

// ── 1. the hook, against the real bundle ───────────────────────────────────
{
  let minify_sync = null;
  try {
    ({ minify_sync } = require("terser"));
  } catch (_) {}
  if (minify_sync === null) {
    console.log("SKIP  bundle half (terser not installed: npm i --no-save terser)");
  } else {
    const beautified = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
    const min = minify_sync(beautified, { module: true, compress: false, mangle: false, format: { comments: false } });
    if (min.error) throw min.error;

    const sandbox = { Logger: { error() {}, test() {}, warn() {} }, isProd: true, console: { log() {} } };
    vm.createContext(sandbox);
    vm.runInContext(sliceBlock("class Regexer {", "const Regexer_default = Regexer;") + "\n"
      + sliceBlock("const formatCode2 = code => {", "const formatCode_default = formatCode2;"), sandbox);
    sandbox.__bundle = min.code;
    const patched = vm.runInContext("formatCode2(__bundle)", sandbox);

    // The game draws a resource as `(s = El(r), ctx.drawImage(s, x - ...`, and
    // the hook wraps El's canvas. Both arguments matter: the sprite, and the
    // resource it belongs to — without the second the renderer cannot tell food
    // from wood and stone.
    const site = patched.match(/\((\w+)=RYN\._Renderer\._objectTint\((\w+)\((\w+)\),(\w+)\),(\w+)\.drawImage\(\1,/);
    check("hook: the resource draw is rewritten", site !== null,
      site ? site[0].slice(0, 78) + "…" : "no _objectTint call found in the resource draw");
    check("hook: the resource is handed through", site !== null && site[4] === site[3],
      site ? "sprite from " + site[2] + "(" + site[3] + "), entity " + site[4] : "n/a");

    // A bad substitution can still match and still produce broken code.
    let parsed = null;
    try {
      minify_sync(patched, { module: true, compress: false, mangle: false });
      parsed = true;
    } catch (e) {
      parsed = e.message;
    }
    check("hook: the rewritten bundle still parses", parsed === true, parsed === true ? "" : String(parsed));

    // The building draw has always passed its object; it must not have been
    // disturbed on the way past.
    check("hook: the building draw is untouched",
      /\.isItem\?\((\w+)=RYN\._Renderer\._objectTint\((\w+)\((\w+)\),\3\)/.test(patched));
  }
}

// ── 2. the texture that actually ships ─────────────────────────────────────
// A minimal PNG reader: header for the dimensions, then inflate and unfilter
// the image data far enough to read individual pixels. Enough to prove the file
// is a real RGBA PNG whose corners are transparent rather than black.
function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error("no IHDR");
  if (ihdr.colorType !== 6 || ihdr.depth !== 8 || ihdr.interlace !== 0) {
    throw new Error("expected non-interlaced 8-bit RGBA, got colorType=" + ihdr.colorType + " depth=" + ihdr.depth + " interlace=" + ihdr.interlace);
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = ihdr.width * bpp;
  const out = Buffer.alloc(ihdr.height * stride);
  let rp = 0;
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[rp + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v;
      if (filter === 0) v = cur;
      else if (filter === 1) v = cur + a;
      else if (filter === 2) v = cur + b;
      else if (filter === 3) v = cur + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error("bad filter " + filter);
      out[y * stride + x] = v & 255;
    }
    rp += stride;
  }
  return {
    ...ihdr,
    pixel(x, y) { const o = y * stride + x * bpp; return [out[o], out[o + 1], out[o + 2], out[o + 3]]; },
    alphaBBox() {
      let x0 = ihdr.width, y0 = ihdr.height, x1 = -1, y1 = -1;
      for (let y = 0; y < ihdr.height; y++) for (let x = 0; x < ihdr.width; x++) {
        if (out[y * stride + x * bpp + 3] !== 0) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      return [x0, y0, x1, y1];
    }
  };
}

let texture = null;
{
  const m = client.match(/const FOOD_TEXTURE_SRC = "data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  check("texture: embedded as a png data uri", m !== null, m ? Math.round(m[1].length / 1024) + "KB of base64" : "not found");
  if (m) {
    const png = readPng(Buffer.from(m[1], "base64"));
    texture = png;
    check("texture: is 8-bit RGBA, so it can carry an alpha channel", png.colorType === 6 && png.depth === 8);
    check("texture: square, so filling a square sprite cannot stretch it",
      png.width === png.height, png.width + "x" + png.height);
    check("texture: big enough for the largest food sprite",
      // El sizes the sprite canvas 2.1 * scale + 5.5, and bushScales tops out at 95.
      png.width >= Math.ceil(2.1 * 95 + 5.5), png.width + "px source vs " + Math.ceil(2.1 * 95 + 5.5) + "px largest sprite");
    const corners = [[0, 0], [png.width - 1, 0], [0, png.height - 1], [png.width - 1, png.height - 1]].map(([x, y]) => png.pixel(x, y));
    check("texture: transparent background, not a black one",
      corners.every(p => p[3] === 0), corners.map(p => "rgba(" + p.join(",") + ")").join(" "));
    const [x0, y0, x1, y1] = png.alphaBBox();
    check("texture: the flower is centred in its frame",
      Math.abs((x0 + x1) / 2 - png.width / 2) < png.width * 0.02 && Math.abs((y0 + y1) / 2 - png.height / 2) < png.height * 0.02,
      "content " + (x1 - x0 + 1) + "x" + (y1 - y0 + 1) + " at (" + x0 + "," + y0 + ")");
    // The sakura is pink over a dark outline. A flattened or recoloured asset
    // would not have a pink pixel at its centre of mass.
    const mid = png.pixel(png.width >> 1, Math.round(png.height * 0.32));
    check("texture: still the pink sakura", mid[3] > 200 && mid[0] > 180 && mid[1] < 160 && mid[2] > 100,
      "rgba(" + mid.join(",") + ") at the top petal");
  }
}

// ── 3. what the renderer does with it ──────────────────────────────────────
{
  const drawn = [];
  const filled = [];
  class FakeCtx {
    constructor(canvas) { this.canvas = canvas; this.globalCompositeOperation = "source-over"; this.globalAlpha = 1; this.fillStyle = ""; }
    drawImage(img, ...rest) { drawn.push({ canvas: this.canvas, img, rest }); }
    fillRect(...a) { filled.push({ canvas: this.canvas, a, style: this.fillStyle }); }
  }
  class FakeCanvas {
    constructor() { this.width = 0; this.height = 0; this._ctx = new FakeCtx(this); }
    getContext() { return this._ctx; }
  }
  class FakeImage {
    set src(v) { this._src = v; if (this.onload) this.onload.call(this); }
    get src() { return this._src; }
  }

  const sandbox = {
    console, Math, Map, Set, WeakMap, Array, JSON,
    performance: { now: () => 0 },
    document: { createElement: t => (t === "canvas" ? new FakeCanvas() : {}) },
    Image: FakeImage,
    Settings_default: { _objectTint: false, _objectTintOpacity: 45, _structureColors: false, _structureColorStrength: 60 },
    clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
    client: null,
    OBJECT_TINT_COLOR: "#7a3cc8",
    OBJECT_TINT_STRENGTH: 0.35,
    MAP_COLORS: { self: "#fff", team: "#fff", bot: "#fff", death: "#fff" },
    window: {}, setTimeout, clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(sliceBlock("  // The food resource's texture.", "const Renderer_default = Renderer;") + "\nthis.R = Renderer;", sandbox);
  const R = sandbox.R;

  const sprite = (w, h) => ({ width: w, height: h, _tag: "gameSprite" });
  const resource = (type, scale) => ({ type, scale, sid: 400 + type, isItem: false });

  // Food is resource type 1: the berry bush, and the cactus in the desert.
  drawn.length = 0; filled.length = 0;
  const bush = sprite(205, 205);
  const out = R._objectTint(bush, resource(1, 95));
  check("render: food gets a different sprite", out !== bush);
  check("render: at exactly the dimensions it replaces",
    out.width === bush.width && out.height === bush.height, out.width + "x" + out.height + " vs " + bush.width + "x" + bush.height);
  check("render: the texture is drawn over the whole sprite, not a slice",
    drawn.length === 1 && drawn[0].rest.join(",") === "0,0,205,205", drawn.length ? drawn[0].rest.join(",") : "nothing drawn");
  check("render: it is the embedded sakura that gets drawn",
    drawn.length === 1 && typeof drawn[0].img.src === "string" && drawn[0].img.src.startsWith("data:image/png;base64,"));
  check("render: nothing is painted behind it, so the png's transparency stands",
    filled.length === 0, filled.length + " fill(s)");

  // Everything else keeps the sprite the game built for it.
  for (const [type, what] of [[0, "wood"], [2, "stone"], [3, "gold"]]) {
    const s = sprite(200, 200);
    check("render: " + what + " (type " + type + ") is left alone", R._objectTint(s, resource(type, 90)) === s);
  }
  {
    const s = sprite(120, 120);
    check("render: a placed building is left alone", R._objectTint(s, { isItem: true, sid: 9, type: 1 }) === s);
    const s2 = sprite(120, 120);
    check("render: a sprite with no entity (animals) is left alone", R._objectTint(s2) === s2);
  }

  // One canvas per sprite size, not one per bush on screen.
  {
    const a = R._objectTint(sprite(205, 205), resource(1, 95));
    const b = R._objectTint(sprite(205, 205), resource(1, 95));
    check("render: the swapped sprite is cached per size", a === b);
    const c = R._objectTint(sprite(175, 175), resource(1, 80));
    check("render: a different scale gets its own", c !== a && c.width === 175);
  }

  // Before the data uri has decoded, the bush the game built is what draws.
  {
    const R2 = vm.runInContext("(function(){const r=Object.create(Object.getPrototypeOf(Renderer));r._foodCache=new Map;return r;})()", sandbox);
    vm.runInContext("_foodTextureImage.isLoaded=false;", sandbox);
    const s = sprite(205, 205);
    check("render: an unloaded texture falls back to the bush", R2._foodSprite(s, resource(1, 95)) === null);
    vm.runInContext("_foodTextureImage.isLoaded=true;", sandbox);
  }

  // The tint still applies on top, and still to food.
  {
    drawn.length = 0; filled.length = 0;
    sandbox.Settings_default._objectTint = true;
    const s = sprite(205, 205);
    const tinted = R._objectTint(s, resource(1, 95));
    check("render: the purple tint still applies over the new texture",
      tinted !== s && filled.length === 1 && filled[0].style === "#7a3cc8",
      filled.length + " fill(s)" + (filled.length ? " with " + filled[0].style : ""));
    check("render: the tint is composited onto the sprite's own pixels only",
      filled.length === 1 && filled[0].canvas._ctx.globalCompositeOperation === "source-atop");
    sandbox.Settings_default._objectTint = false;
  }
}

const failed = results.filter(r => !r.ok);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
process.exit(failed.length ? 1 : 0);
