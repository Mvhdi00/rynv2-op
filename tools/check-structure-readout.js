#!/usr/bin/env node
/*
 * check-structure-readout.js
 *
 * Ryn Type 2 draws Whiteout's structure readout — the owner's name over a
 * placed building, and a health bar under it — using its own bar primitives.
 * That only works because RYN's Config.barWidth / barHeight / barPad happen to
 * be the same 50 / 17 / 4.5 that Whiteout reads out of the game as
 * healthBarWidth and healthBarPad, so the check that matters is not "does it
 * draw something" but "does it draw Whiteout's rectangle, to the pixel".
 *
 *   node tools/check-structure-readout.js [path/to/Ryn_Type_2.user.js]
 *
 * Also checks the Visual page against Settings, because attachColorPickers and
 * attachCheckboxes silently skip a control whose id is not a setting — a
 * removed setting leaves a dead control that looks fine until you click it.
 *
 * Exits non-zero if any check fails.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CLIENT_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "..", "Ryn_Type_2.user.js");
const client = fs.readFileSync(CLIENT_PATH, "utf8");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  — " + detail : ""));
}
function sliceBlock(start, end) {
  const a = client.indexOf(start);
  if (a === -1) throw new Error("marker not found: " + start);
  const b = client.indexOf(end, a);
  if (b === -1) throw new Error("end marker not found: " + end);
  return client.slice(a, b + end.length);
}
function stringLiteralAt(src, quote) {
  let out = "", i = quote + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { const n = src[i + 1]; out += n === "n" ? "\n" : n === "t" ? "\t" : n; i += 2; continue; }
    if (c === '"') return out;
    out += c; i++;
  }
  throw new Error("unterminated string");
}

// ── the Visual page against Settings ───────────────────────────────────────
{
  const decl = client.indexOf("const Visuals_default = \"");
  const html = decl >= 0 ? stringLiteralAt(client, client.indexOf('"', decl)) : null;
  check("visual page: found", html !== null);
  if (html) {
    const settingKeys = new Set();
    const settingsBlock = client.slice(client.indexOf("_itemHealthBar: false,") - 6000, client.indexOf("_itemHealthBar: false,") + 6000);
    for (const m of settingsBlock.matchAll(/^\s{4}(_\w+):/gm)) settingKeys.add(m[1]);

    const colors = [...html.matchAll(/<input id="(\w+)" type="color"/g)].map(m => m[1]);
    const boxes = [...html.matchAll(/<input id="(\w+)" type="checkbox"/g)].map(m => m[1]);
    const orphanColors = colors.filter(id => id.startsWith("_itemHealth") && !client.includes("    " + id + ":"));
    check("visual page: every health-bar colour picker is a real setting",
      orphanColors.length === 0, orphanColors.length ? "orphans: " + orphanColors.join(", ") : colors.length + " pickers on the page");
    const orphanBoxes = boxes.filter(id => id.startsWith("_itemHealth") && !client.includes("    " + id + ":"));
    check("visual page: every health-bar toggle is a real setting",
      orphanBoxes.length === 0, orphanBoxes.length ? "orphans: " + orphanBoxes.join(", ") : "");

    // attachColorPickers reaches the reset button as picker.previousElementSibling
    // and does nothing if it is not there, so a button left behind by a removed
    // picker is a dead control. Scanned rather than matched with a lookahead:
    // a `\\s*` before a negative lookahead just backtracks to zero and passes.
    const stray = [];
    for (const m of html.matchAll(/<button class="reset-color"[^>]*><\/button>/g)) {
      const after = html.slice(m.index + m[0].length).replace(/^\s+/, "");
      if (!/^<input\b[^>]*type="color"/.test(after)) stray.push(after.slice(0, 40));
    }
    check("visual page: no reset button left without its colour input",
      stray.length === 0, stray.length ? "followed by: " + stray.join(" | ") : "all paired");

    check("visual page: the removed enemy colour is gone from the page",
      !html.includes("_itemHealthBarEnemyColor"));
    check("settings: the removed enemy colour is gone from Settings",
      !client.includes("_itemHealthBarEnemyColor"));
    check("visual page: both readout toggles are still there",
      boxes.includes("_itemHealthBar") && boxes.includes("_itemHealthBarEnemy"));
    check("visual page: one shared bar colour remains",
      colors.filter(id => id === "_itemHealthBarColor").length === 1);
  }
}

// ── the colour is a light sky blue ─────────────────────────────────────────
{
  const m = client.match(/_itemHealthBarColor: "(#[0-9a-fA-F]{6})"/);
  check("colour: the bar has a default", m !== null, m ? m[1] : "not found");
  if (m) {
    const hex = m[1];
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    // Sky blue: blue leads, green close behind it, red trailing. Light: every
    // channel high. Soft: not a saturated cyan, so red is not near zero.
    check("colour: reads as sky blue (blue > green > red)", b > g && g > r, `r${r} g${g} b${b}`);
    check("colour: light rather than deep", (r + g + b) / 3 > 170, "mean channel " + Math.round((r + g + b) / 3));
    check("colour: soft rather than a saturated cyan", b - r < 100, "blue-red spread " + (b - r));
  }
}

// ── what it actually draws ─────────────────────────────────────────────────
{
  const ops = [];
  function recorder() {
    const ctx = {
      _path: null, globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 0,
      lineJoin: "", textBaseline: "", textAlign: "", font: "",
      save() { ops.push({ op: "save" }); },
      restore() { ops.push({ op: "restore" }); },
      beginPath() { ctx._path = { x: NaN, y: NaN, w: 0, h: 0, xs: [], ys: [] }; },
      moveTo(x, y) { ctx._note(x, y); },
      arcTo(x1, y1, x2, y2, r) { ctx._note(x1, y1); ctx._note(x2, y2); ctx._path.r = r; },
      closePath() {},
      _note(x, y) { if (!ctx._path) return; ctx._path.xs.push(x); ctx._path.ys.push(y); },
      fill() {
        const p = ctx._path;
        ops.push({ op: "fill", style: ctx.fillStyle, r: p.r,
          x: Math.min(...p.xs), y: Math.min(...p.ys),
          w: Math.max(...p.xs) - Math.min(...p.xs), h: Math.max(...p.ys) - Math.min(...p.ys) });
      },
      strokeText(t, x, y) { ops.push({ op: "strokeText", t, x, y, font: ctx.font, align: ctx.textAlign, baseline: ctx.textBaseline, width: ctx.lineWidth, style: ctx.strokeStyle }); },
      fillText(t, x, y) { ops.push({ op: "fillText", t, x, y, font: ctx.font, align: ctx.textAlign, baseline: ctx.textBaseline, style: ctx.fillStyle }); },
      translate() {}, rotate() {}, arc() {}, stroke() {}, drawImage() {}, fillRect() {}, strokeRect() {}
    };
    return ctx;
  }

  class PlayerObject {}
  const settings = {
    _itemHealthBar: true, _itemHealthBarEnemy: false, _itemHealthBarColor: "#b3e5fc",
    _objectTint: false, _objectTintOpacity: 45, _structureColors: false, _structureColorStrength: 60,
    _lowQuality: false, _performanceOptimization: false,
    _collisionHitbox: false, _weaponHitbox: false, _placementHitbox: false,
    _renderHP: false, _playerTurretReloadBar: false, _weaponReloadBar: false
  };
  const sandbox = {
    console, Math, Map, Set, WeakMap, Array, JSON, Infinity, Number,
    performance: { now: () => 0 },
    document: { createElement: () => ({ getContext: () => ({ drawImage() {}, fillRect() {} }) }) },
    Image: class { set src(v) { this._src = v; if (this.onload) this.onload.call(this); } },
    Settings_default: settings,
    Config_default: { barWidth: 50, barHeight: 17, barPad: 4.5, nameY: 34, mapScale: 14400 },
    clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
    OBJECT_TINT_COLOR: "#7a3cc8", OBJECT_TINT_STRENGTH: 0.35,
    MAP_COLORS: { self: "#fff", team: "#fff", bot: "#fff", death: "#fff" },
    PlayerObject,
    RYN: { _offset: { x: 0, y: 0 } },
    ZoomHandler_default: { _scale: { current: { _w: 1920, _h: 1080 } } },
    Vector_default: class { constructor(x, y) { this.x = x; this.y = y; } sub() { return this; } },
    Items: [], DataHandler_default: {}, getTargetValue: () => ({}), setTargetValue: () => {},
    client: null, window: {}, setTimeout, clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(
    sliceBlock("  // The food resource's texture.", "const Renderer_default = Renderer;") + "\n"
    + sliceBlock("  // The structure readout", "const ObjectRenderer_default = ObjectRenderer;") + "\n"
    + "this.OR = ObjectRenderer;", sandbox);
  const OR = sandbox.OR;

  const entity = (x, y) => ({ x, y, xWiggle: 0, yWiggle: 0, scale: 45, sid: 12 });
  const object = (ownerID, health, maxHealth, destroyable = true) =>
    ({ ownerID, health, maxHealth, isDestroyable: destroyable });

  function setPlayers(me, owners) {
    sandbox.client = {
      myPlayer: {
        isMyPlayerByID: id => id === me,
        isTeammateByID: () => false
      },
      PlayerManager: { playerData: new Map(Object.entries(owners).map(([k, v]) => [Number(k), { nickname: v }])) }
    };
  }

  // Whiteout's own numbers, straight from its source:
  //   holder roundRect(x - 50/2 - 4.5, y - 4.5, 50 + 9, 17, 8)
  //   bar    roundRect(x - 50/2,       y,       50 * pct, 17 - 9, 7)
  const CX = 1000, CY = 800;
  setPlayers(1, { 1: "Raptor" });
  ops.length = 0;
  OR.structureInfo(recorder(), entity(CX, CY), object(1, 250, 500), CX, CY);

  const fills = ops.filter(o => o.op === "fill");
  check("draw: a holder and a bar, nothing else", fills.length === 2, fills.length + " filled shapes");
  if (fills.length === 2) {
    const [holder, bar] = fills;
    const near = (a, b) => Math.abs(a - b) < 0.001;
    check("draw: the holder is Whiteout's rectangle",
      near(holder.x, CX - 29.5) && near(holder.y, CY - 4.5) && near(holder.w, 59) && near(holder.h, 17) && near(holder.r, 8),
      `x${holder.x} y${holder.y} ${holder.w}x${holder.h} r${holder.r} — want x${CX - 29.5} y${CY - 4.5} 59x17 r8`);
    check("draw: the holder is the game's dark outline colour", holder.style === "#3d3f42", holder.style);
    // barContent asks for a radius of 7, and Whiteout asks for 7 too. Both get
    // 4: RYN's Renderer.roundRect and the roundRect Whiteout installs on
    // CanvasRenderingContext2D are the same function, and both clamp with
    // `if (h < 2 * r) r = h / 2` — so an 8-tall bar comes out with fully
    // rounded ends either way. 4 is the shape Whiteout actually draws.
    check("draw: the bar is Whiteout's rectangle at half health",
      near(bar.x, CX - 25) && near(bar.y, CY) && near(bar.w, 25) && near(bar.h, 8) && near(bar.r, 4),
      `x${bar.x} y${bar.y} ${bar.w}x${bar.h} r${bar.r} — want x${CX - 25} y${CY} 25x8 r4 (7 requested, clamped to h/2)`);
    check("draw: the bar wears the configured colour", bar.style === settings._itemHealthBarColor, bar.style);
  }

  const stroke = ops.find(o => o.op === "strokeText");
  const fillText = ops.find(o => o.op === "fillText");
  check("draw: the owner's name is drawn", stroke !== undefined && fillText !== undefined && fillText.t === "Raptor",
    fillText ? JSON.stringify(fillText.t) : "no text");
  if (fillText) {
    check("draw: outlined first, then filled — so it reads over any background",
      ops.indexOf(stroke) < ops.indexOf(fillText) && stroke.t === fillText.t);
    check("draw: the name sits where Whiteout puts it",
      fillText.x === CX && fillText.y === CY - 7, `(${fillText.x}, ${fillText.y}) — want (${CX}, ${CY - 7})`);
    check("draw: centred, 20px, on the dark outline",
      fillText.align === "center" && fillText.baseline === "middle" && /^20px /.test(fillText.font) && stroke.style === "#3d3f42",
      `${fillText.font} align=${fillText.align} outline=${stroke.style}`);
  }

  // Full health fills the bar; empty draws none of it.
  for (const [health, want] of [[500, 50], [0, 0]]) {
    ops.length = 0;
    OR.structureInfo(recorder(), entity(CX, CY), object(1, health, 500), CX, CY);
    const bar = ops.filter(o => o.op === "fill")[1];
    check(`draw: ${health}/500 health gives a ${want}px fill`, bar && Math.abs(bar.w - want) < 0.001, bar ? bar.w + "px" : "no bar");
  }

  // The gates.
  const drawsAnything = (ent, obj, cx, cy) => { ops.length = 0; OR.structureInfo(recorder(), ent, obj, cx, cy); return ops.some(o => o.op === "fill" || o.op === "fillText"); };
  check("gate: beyond 500 units, nothing is drawn",
    !drawsAnything(entity(CX + 501, CY), object(1, 250, 500), CX, CY));
  check("gate: at 499 units it still is",
    drawsAnything(entity(CX + 499, CY), object(1, 250, 500), CX, CY));
  check("gate: an indestructible structure has no bar to draw",
    !drawsAnything(entity(CX, CY), object(1, Infinity, Infinity, false), CX, CY));

  setPlayers(1, { 1: "Raptor", 2: "Someone" });
  check("gate: an enemy structure is skipped while the enemy toggle is off",
    !drawsAnything(entity(CX, CY), object(2, 250, 500), CX, CY));
  settings._itemHealthBarEnemy = true;
  check("gate: and drawn once it is on",
    drawsAnything(entity(CX, CY), object(2, 250, 500), CX, CY));
  {
    ops.length = 0;
    OR.structureInfo(recorder(), entity(CX, CY), object(2, 250, 500), CX, CY);
    const bar = ops.filter(o => o.op === "fill")[1];
    check("colour: an enemy bar is the same one colour, not a second one",
      bar.style === settings._itemHealthBarColor, bar.style);
  }
  settings._itemHealthBar = false;
  check("gate: your own structure is skipped while its toggle is off",
    !drawsAnything(entity(CX, CY), object(1, 250, 500), CX, CY));
  settings._itemHealthBar = true;

  // An owner who is not in the player list yet: bar, no name, no throw.
  setPlayers(1, {});
  ops.length = 0;
  let threw = null;
  try { OR.structureInfo(recorder(), entity(CX, CY), object(7, 250, 500), CX, CY); } catch (e) { threw = e; }
  check("draw: an unknown owner gets a bar and no name, without throwing",
    threw === null && ops.filter(o => o.op === "fill").length === 2 && !ops.some(o => o.op === "fillText"),
    threw ? String(threw.message) : "");
}

// ── the old circular bar is gone ───────────────────────────────────────────
check("cleanup: the circular bar it replaced is gone", !client.includes("circularBar"));

const failed = results.filter(r => !r.ok);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
process.exit(failed.length ? 1 : 0);
