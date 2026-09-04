#!/usr/bin/env node
/* ===========================================================================
 * build-ui.js — RYN Type 2 UI redesign
 *
 *   src/Ryn_Type_2_v5.4.js  +  ui/*.css, ui/*.html   ->   Ryn_Type_2.user.js
 *
 * Every edit is anchored to an exact string in the base script. An anchor
 * that is missing or ambiguous fails the build, so dropping in a newer RYN
 * surfaces as an error rather than a half-applied redesign.
 *
 * This build only ever touches presentation: stylesheets, menu markup, and
 * the DOM-writing half of the UI code. No gameplay module is edited.
 * ======================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src", "Ryn_Type_2_v5.4.js");
const OUT = path.join(ROOT, "Ryn_Type_2.user.js");
const UIDIR = path.join(ROOT, "ui");

const asset = name => fs.readFileSync(path.join(UIDIR, name), "utf8").trim();
const js = s => JSON.stringify(s);

let text = fs.readFileSync(SRC, "utf8");
let applied = 0;

/* -- edit helpers -------------------------------------------------------- */

function fail(label, why) {
  console.error(`\n  build-ui: ${label}\n    ${why}\n`);
  process.exit(1);
}

/** Replace one exact occurrence of `find`. */
function once(label, find, replace) {
  const first = text.indexOf(find);
  if (first === -1) fail(label, "anchor not found");
  if (text.indexOf(find, first + find.length) !== -1) fail(label, "anchor is ambiguous");
  text = text.slice(0, first) + replace + text.slice(first + find.length);
  applied++;
}

/** Replace the whole line that uniquely contains `find`. */
function line(label, find, replacement) {
  const lines = text.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(find)) hits.push(i);
  if (hits.length === 0) fail(label, "line anchor not found");
  if (hits.length > 1) fail(label, `line anchor matched ${hits.length} lines`);
  lines[hits[0]] = replacement;
  text = lines.join("\n");
  applied++;
}

/** Replace the inclusive line range between two unique anchors. */
function block(label, startFind, endFind, replacement) {
  const lines = text.split("\n");
  const find = needle => {
    const hits = [];
    for (let i = 0; i < lines.length; i++) if (lines[i].includes(needle)) hits.push(i);
    return hits;
  };
  const a = find(startFind);
  const b = find(endFind);
  if (a.length !== 1) fail(label, `start anchor matched ${a.length} lines`);
  if (b.length !== 1) fail(label, `end anchor matched ${b.length} lines`);
  if (b[0] < a[0]) fail(label, "end anchor precedes start anchor");
  lines.splice(a[0], b[0] - a[0] + 1, ...(replacement === null ? [] : [replacement]));
  text = lines.join("\n");
  applied++;
}

/* -- palette ------------------------------------------------------------- *
 * Old scheme: violet #7A42F4 + blue #3A86FF + pink-red #ff4d6d + slate #9090c8
 * New scheme: black structure, red #E5384A action, violet #8B5CF6 selection.
 * Applied only to markup/CSS strings that carry hard-coded colour, never to
 * the canvas renderer.                                                      */

const RECOLOUR = [
  [/rgba\(122,\s*66,\s*244,/g, "rgba(139,92,246,"],
  [/rgba\(160,\s*122,\s*244,/g, "rgba(160,132,250,"],
  [/rgba\(168,\s*140,\s*255,/g, "rgba(160,132,250,"],
  [/rgba\(214,\s*204,\s*255,/g, "rgba(238,238,245,"],
  [/rgba\(58,\s*134,\s*255,/g, "rgba(139,92,246,"],
  [/rgba\(255,\s*77,\s*109,/g, "rgba(229,56,74,"],
  [/rgba\(201,\s*162,\s*39,/g, "rgba(139,92,246,"],
  [/rgba\(200,\s*195,\s*220,/g, "rgba(238,238,245,"],
  [/rgba\(200,\s*200,\s*220,/g, "rgba(238,238,245,"],
  [/rgba\(210,\s*210,\s*225,/g, "rgba(238,238,245,"],
  [/#7A42F4/gi, "#8B5CF6"],
  [/#a07af4/gi, "#B9A2FF"],
  [/#3A86FF/gi, "#8B5CF6"],
  [/#ff4d6d/gi, "#E5384A"],
  [/#ff8fa3/gi, "#E5384A"],
  [/#cc5151/gi, "#E5384A"],
  [/#ff4444/gi, "#E5384A"],
  [/#c0a0ff|#c0a8ff|#c8b8ff|#e0d4ff|#d0c8ff/gi, "#B9A2FF"],
  [/#9090f8/gi, "#B9A2FF"],
  [/#9090c8/gi, "#8B5CF6"],
  [/#d8d8f8/gi, "#EDEDF2"],
  [/#7070a8/gi, "rgba(238,238,245,0.52)"],
  [/#853838/gi, "rgba(229,56,74,0.14)"],
  [/#6f2f2f/gi, "rgba(229,56,74,0.42)"],
  [/#c07878/gi, "#E5384A"],
  [/#80eefc/gi, "#B9A2FF"],
  [/#1e1a30/gi, "#141419"],
  [/#13101e/gi, "#0D0D12"],
  [/#2A2140/gi, "#191323"],
  [/#141323/gi, "#101016"],
  [/#1E1830/gi, "#141019"],
  [/#12111E/gi, "#0C0C11"],
  [/#0B0B10/gi, "#08080B"],
  [/#141420/gi, "#0D0D12"],
  [/#1B1B2B/gi, "#141419"],
  [/\bcolor:#666\b/g, "color:rgba(238,238,245,0.34)"],
  [/\bcolor:#888\b/g, "color:rgba(238,238,245,0.5)"],
  [/'Inter','Poppins',sans-serif/g, SYS()],
  [/'Poppins','Inter',sans-serif/g, SYS()],
  [/'Orbitron',\s*monospace/g, MONO()],
  [/Orbitron,monospace/g, MONO()],
  [/'Exo 2',\s*sans-serif/g, SYS()]
];

function SYS() { return 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif'; }
function MONO() { return "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"; }

const recolour = s => RECOLOUR.reduce((acc, [re, to]) => acc.replace(re, to), s);

/** Recolour a `const <name>_default = "...";` template literal in place. */
function recolourTemplate(name, extra) {
  const marker = `  const ${name}_default = `;
  const lines = text.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith(marker)) hits.push(i);
  if (hits.length !== 1) fail(`recolour ${name}`, `matched ${hits.length} declarations`);
  const raw = lines[hits[0]].slice(marker.length).replace(/;\s*$/, "");
  let value = JSON.parse(raw);
  value = recolour(value);
  if (typeof extra === "function") value = extra(value);
  lines[hits[0]] = `${marker}${js(value)};`;
  text = lines.join("\n");
  applied++;
}

/* =======================================================================
 * 1. Stylesheets and chrome markup
 * ==================================================================== */

line("styles_default", "  const styles_default = ", `  const styles_default = ${js(asset("menu.css"))};`);
line("Header_default", "  const Header_default = ", `  const Header_default = ${js(asset("header.html"))};`);
line("Navbar_default", "  const Navbar_default = ", `  const Navbar_default = ${js(asset("navbar.html"))};`);
line("Game_default", "  const Game_default = ", `  const Game_default = ${js(asset("game.css"))};`);
line("Store_default", "  const Store_default = ", `  const Store_default = ${js(asset("store.css"))};`);

/* The bots page ships its own stylesheet and a pile of inline colour. Both are
 * replaced so its pickers, cards and buttons inherit the design system. */
const BOTS_SHEET = "";  /* the design system owns these controls now */


recolourTemplate("Bots", page => {
  /* drop the page's private stylesheet — every rule in it now lives in the
   * design system, so keeping a second copy here only lets the two drift */
  const a = page.indexOf("<style>");
  const b = page.indexOf("</style>");
  if (a === -1 || b === -1) fail("bots stylesheet", "no <style> block in the bots page");
  page = page.slice(0, a) + BOTS_SHEET + page.slice(b + "</style>".length);

  const swap = (find, to) => {
    if (!page.includes(find)) fail("bots inline style", `missing: ${find.slice(0, 60)}`);
    page = page.split(find).join(to);
  };
  /* section bodies */
  swap('style="padding:14px 16px;gap:16px;display:flex;flex-direction:column;"',
       'style="padding:11px 12px;gap:13px;display:flex;flex-direction:column;"');
  /* the two call-to-action buttons: let .option-button style them */
  swap('style="padding:8px 22px;background:rgba(139,92,246,0.1);border:1.5px solid rgba(139,92,246,0.4);border-radius:7px;color:#FFFFFF;font-size:0.95em;font-weight:700;cursor:pointer;"',
       'style="padding:6px 16px;"');
  swap('style="display:flex;align-items:center;gap:8px;padding:10px 28px;background:rgba(139,92,246,0.1);border:1.5px solid rgba(139,92,246,0.4);border-radius:7px;color:#FFFFFF;font-size:1.1em;font-weight:800;letter-spacing:0.04em;transition:all 200ms;cursor:pointer;"',
       'style="display:flex;align-items:center;gap:6px;padding:7px 18px;"');
  /* auto-farm heading + cards */
  swap('style="font-size:0.75em;letter-spacing:0.18em;color:rgba(160,132,250,0.75);text-transform:uppercase;margin-bottom:14px;"',
       'style="padding-left:11px;margin-bottom:10px;"');
  swap('background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.18);border-radius:10px;padding:14px 16px;',
       'background:rgba(255,255,255,0.022);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:11px 12px;');
  swap('style="font-size:0.7em;letter-spacing:0.14em;color:rgba(160,132,250,0.6);text-transform:uppercase;"',
       'style="font-size:11px;font-weight:600;color:#F2F2F6;"');
  swap('style="font-size:0.82em;color:rgba(238,238,245,0.6);margin:0;line-height:1.5;"',
       'style="font-size:11px;color:rgba(238,238,245,0.52);margin:0;line-height:1.55;"');
  swap('style="font-size:0.83em;color:rgba(238,238,245,0.5);line-height:1.5;"',
       'style="font-size:11px;color:rgba(238,238,245,0.52);line-height:1.55;"');
  /* mode + resource buttons: the class, not the attribute, carries the state */
  page = page.replace(/style="flex:1;padding:9px 0;border-radius:8px;border:1\.5px solid [^;]+;background:[^;]+;color:[^;]+;cursor:pointer;font-family:inherit;font-weight:700;font-size:0\.9em;letter-spacing:0\.04em;transition:all 0\.15s;"/g,
    'class="mode-btn" style="flex:1;padding:7px 0;font-size:11.5px;font-weight:500;cursor:pointer;"');
  page = page.replace(/class="farm-type-btn" style="flex:1;padding:10px 4px;border-radius:8px;border:1\.5px solid [^;]+;background:[^;]+;color:[^;]+;cursor:pointer;font-family:inherit;font-weight:700;font-size:0\.85em;letter-spacing:0\.03em;transition:all 0\.15s;"/g,
    'class="farm-type-btn" style="flex:1;padding:8px 4px;font-size:11.5px;font-weight:500;cursor:pointer;"');
  swap('style="width:110px;height:40px;font-size:1em;padding:0 12px;border-radius:8px;flex-shrink:0;"',
       'style="width:92px;flex-shrink:0;"');
  /* the mode buttons carry id + class now; _applyMode adds .mode-btn too */
  return page;
});

recolourTemplate("Music", page => {
  const overrides = `
/* --- redesign overrides: align the music page with the client shell --- */
.rm-root{--rm-accent2:#E5384A;font-size:13px;}
.rm-player{border-radius:9px;box-shadow:none;background:linear-gradient(160deg,#141019 0%,#0C0C11 55%,#08080B 100%);}
.rm-player::before{display:none;}
.rm-art{border-radius:8px;box-shadow:none;}
.rm-art.playing{box-shadow:none;}
.rm-sec{border-radius:9px;}
.rm-play-btn{background:#E5384A;color:#FFFFFF;box-shadow:none;}
.rm-play-btn:hover{background:#F04155;box-shadow:none;}
.rm-like-btn.on{text-shadow:none;}
.rm-save-now-btn.on{text-shadow:none;}
.rm-prog-rail{height:4px;}
.rm-prog-wrap:hover .rm-prog-rail{height:4px;}
.rm-title{font-size:14px;font-weight:600;}
.rm-sec-head{padding:9px 13px;}
.rm-sec-title{font-size:12px;font-weight:600;letter-spacing:.01em;text-transform:none;color:var(--rm-text);}
.rm-sec-dot{width:5px;height:5px;box-shadow:none;}
.rm-filter-btn{border-radius:6px;font-size:11px;font-weight:500;}
.rm-filter-btn.active{background:var(--rm-accent);color:#FFFFFF;}
.rm-album-badge{text-transform:none;letter-spacing:.01em;border-radius:5px;font-size:10px;}
.rm-song-row{border-radius:6px;}
.rm-vol input[type=range]{
  -webkit-appearance:none;appearance:none;
  height:3px;border-radius:3px;border:none;outline:none;
  background:linear-gradient(90deg,var(--rm-accent) var(--val,70%),rgba(255,255,255,.10) var(--val,70%));
}
.rm-vol input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none;appearance:none;
  width:11px;height:11px;border-radius:50%;
  background:#B9A2FF;border:2px solid #08080B;
}
`;
  const i = page.lastIndexOf("</style>");
  if (i === -1) fail("Music overrides", "no </style> in the music page");
  return page.slice(0, i) + overrides + page.slice(i);
});

/* =======================================================================
 * 2. Menu shell — tabs move out of the sidebar into a top strip
 * ==================================================================== */

line("getFrameContent layout", "<!DOCTYPE html>\\n            <style>${styles_default}",
  "      return `\\n<!DOCTYPE html>\\n<style>${styles_default}</style>\\n" +
  "<div id=\"menu-container\" class=\"transparent\">\\n  <div id=\"menu-wrapper\">\\n" +
  "    ${Header_default}\\n    ${Navbar_default}\\n" +
  "    <main>\\n      <div id=\"page-container\">\\n" +
  "        ${Keybinds_default}\\n        ${Combat_default}\\n        ${Visuals_default}\\n" +
  "        ${Misc_default}\\n        ${Bots_default}\\n        ${Devtool_default}\\n        ${Music_default}\\n" +
  "      </div>\\n    </main>\\n  </div>\\n</div>\\n`;");

/* =======================================================================
 * 3. Lobby stylesheet — replaces the old glass card CSS wholesale
 * ==================================================================== */

block("lobby stylesheet",
  "@import url('https://fonts.googleapis.com/css2?family=Orbitron",
  ".ryn-v2-wrapper:hover .ryn-v2-badge { color: rgba(214,204,255,0.85) !important; }",
  asset("lobby.css"));

/* The setup card is injected exactly once; stop observing after that so the
 * callback is not re-entered on every DOM mutation for the rest of the run. */
once("setup card observer",
`        const observer = new MutationObserver(() => injectRynCardUI());
        const startObs = () => observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true
        });`,
`        const observer = new MutationObserver(() => {
          injectRynCardUI();
          const card = document.getElementById("setupCard");
          if (card && card._rynInjected) observer.disconnect();
        });
        const startObs = () => observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true
        });`);

/* The old "#ryn-main-logo" was force-hidden by its own stylesheet
 * (display:none !important; pointer-events:none !important), so the element,
 * its listener and the 500 ms visibility poll were all unreachable. The
 * corner badge (.ryn-v2-wrapper) is what actually opens the menu. */
block("dead logo block",
  "      const logoStyle = document.createElement(\"style\");",
  "      }, 500);",
  null);

/* =======================================================================
 * 4. Controls — event-driven state, no per-frame work
 * ==================================================================== */

/* Slider fill: --val was read by the stylesheet but never written, so every
 * range track was painted at a flat 50%. Set it where the value changes. */
once("slider fill",
`        const updateSliderValue = () => {
          const sliderValue = slider.previousElementSibling;
          if (sliderValue instanceof this.frame.window.HTMLSpanElement) {
            sliderValue.textContent = slider.value + (slider.dataset.suffix || "");
          }
        };`,
`        const updateSliderValue = () => {
          const sliderValue = slider.previousElementSibling;
          if (sliderValue instanceof this.frame.window.HTMLSpanElement) {
            sliderValue.textContent = slider.value + (slider.dataset.suffix || "");
          }
          const min = Number(slider.min || 0);
          const max = Number(slider.max || 100);
          const pct = max > min ? (Number(slider.value) - min) / (max - min) * 100 : 0;
          slider.style.setProperty("--val", pct.toFixed(2) + "%");
        };`);

/* Formation picker stylesheet. */
line("formation stylesheet", "st.textContent = `\\n                    #_formationGrid{",
  "        st.textContent = " + js(asset("formation.css")) + ";");

/* Weapon / farm / age pickers: swap six inline-style rewrites per click for a
 * single class toggle each. Same state, same events, styled from the sheet. */
once("primary weapon picker",
`        btns.forEach(b => {
          const active = b.getAttribute("data-wid") === String(wid);
          b.style.border = active ? "1px solid rgba(122,66,244,0.6)" : "1px solid rgba(255,255,255,0.08)";
          b.style.background = active ? "rgba(122,66,244,0.15)" : "rgba(255,255,255,0.03)";
          b.style.color = active ? "#c0a0ff" : "rgba(210,210,225,0.8)";
        });`,
`        btns.forEach(b => {
          b.classList.toggle("is-active", b.getAttribute("data-wid") === String(wid));
        });`);

once("secondary weapon picker",
`          secBtns.forEach(b => {
            const active = b.getAttribute("data-swid") === String(swid);
            b.style.border = active ? "2px solid #9090c8" : "2px solid #2a204066";
            b.style.background = active ? "#1e1a30" : "#13101e";
            b.style.color = active ? "#9090c8" : "#d8d8f8";
          });`,
`          secBtns.forEach(b => {
            b.classList.toggle("is-active", b.getAttribute("data-swid") === String(swid));
          });`);

once("farm mode buttons",
`              if (btnSingle) {
                btnSingle.style.background = isSingle ? "rgba(122,66,244,0.25)" : "rgba(255,255,255,0.05)";
                btnSingle.style.borderColor = isSingle ? "rgba(122,66,244,0.6)" : "rgba(255,255,255,0.1)";
                btnSingle.style.color = isSingle ? "#fff" : "#aaa";
              }
              if (btnNearest) {
                btnNearest.style.background = !isSingle ? "rgba(122,66,244,0.25)" : "rgba(255,255,255,0.05)";
                btnNearest.style.borderColor = !isSingle ? "rgba(122,66,244,0.6)" : "rgba(255,255,255,0.1)";
                btnNearest.style.color = !isSingle ? "#fff" : "#aaa";
              }`,
`              if (btnSingle) {
                btnSingle.classList.add("mode-btn");
                btnSingle.classList.toggle("is-active", isSingle);
              }
              if (btnNearest) {
                btnNearest.classList.add("mode-btn");
                btnNearest.classList.toggle("is-active", !isSingle);
              }`);

once("farm type buttons",
`              farmTypeBtns.forEach((btn, i) => {
                if (i === idx) {
                  btn.style.border = "1.5px solid " + farmTypeActive.border;
                  btn.style.background = farmTypeActive.bg;
                  btn.style.color = farmTypeActive.color;
                } else {
                  btn.style.border = "1.5px solid rgba(255,255,255,0.08)";
                  btn.style.background = "rgba(255,255,255,0.03)";
                  btn.style.color = "#666";
                }
              });`,
`              farmTypeBtns.forEach((btn, i) => {
                btn.classList.toggle("is-active", i === idx);
              });`);

once("age 4 buttons",
`              btns.forEach(b => {
                const active = b.getAttribute("data-age4id") === String(id);
                b.style.border = active ? "1px solid rgba(122,66,244,0.6)" : "1px solid rgba(255,255,255,0.08)";
                b.style.background = active ? "rgba(122,66,244,0.15)" : "rgba(255,255,255,0.03)";
                b.style.color = active ? "#c0a0ff" : "rgba(210,210,225,0.8)";
              });`,
`              btns.forEach(b => {
                b.classList.toggle("is-active", b.getAttribute("data-age4id") === String(id));
              });`);

/* =======================================================================
 * 5. Search — build the index once instead of on every keystroke
 * ==================================================================== */

once("search index cache",
`    var focIdx = -1;
    function buildIdx() {`,
`    var focIdx = -1;
    var _idxCache = null;
    var _idxCount = -1;
    function getIdx() {
      var n = doc.querySelectorAll(".content-option").length;
      if (_idxCache === null || n !== _idxCount) {
        _idxCache = buildIdx();
        _idxCount = n;
      }
      return _idxCache;
    }
    function buildIdx() {`);

once("search index use", "      var idx = buildIdx();", "      var idx = getIdx();");

once("search result flash",
`                item.opt.style.background = "rgba(122,66,244,0.18)";`,
`                item.opt.classList.add("ryn-flash");`);
once("search result unflash",
`                  item.opt.style.background = "";
                }, 1200);`,
`                  item.opt.classList.remove("ryn-flash");
                }, 1200);`);

/* Stop the 800 ms search-attach poll once the frame exists. */
once("search attach poll",
`  setInterval(function() {
    try {
      var frame = UI_default.frame && UI_default.frame.target;
      if (!frame || !frame.contentDocument) return;
      var si = frame.contentDocument.getElementById("ryn-search-input");
      if (si && !si._rynSI) _initRynSearch(frame.contentDocument);
    } catch (e) {}
  }, 800);`,
`  var _rynSearchPoll = null;
  function _rynStartSearchPoll() {
    if (_rynSearchPoll !== null) return;
    _rynSearchPoll = setInterval(function() {
      try {
        var frame = UI_default.frame && UI_default.frame.target;
        if (!frame || !frame.contentDocument) return;
        var si = frame.contentDocument.getElementById("ryn-search-input");
        if (!si) return;
        if (!si._rynSI) _initRynSearch(frame.contentDocument);
        clearInterval(_rynSearchPoll);
        _rynSearchPoll = null;
      } catch (e) {}
    }, 800);
  }
  _rynStartSearchPoll();
  (window._rynUIRearm = window._rynUIRearm || []).push(_rynStartSearchPoll);`);

/* Stop the 1500 ms page-attach poll once both pages have been wired up. */
once("page attach poll start",
`  setInterval(() => {
    try {
      const frame = UI_default.frame && UI_default.frame.target;
      if (!frame || !frame.contentDocument) return;
      const page = frame.contentDocument.querySelector('.menu-page[data-id="1"]');`,
`  let _rynPagePoll = null;
  function _rynStartPagePoll() {
    if (_rynPagePoll !== null) return;
    _rynPagePoll = setInterval(() => {
    try {
      const frame = UI_default.frame && UI_default.frame.target;
      if (!frame || !frame.contentDocument) return;
      const page = frame.contentDocument.querySelector('.menu-page[data-id="1"]');`);

once("page attach poll stop",
`            if (gValEl) gValEl.textContent = gSlider.value + "px";
          };
        }
      }
    } catch (e) {}
  }, 1500);`,
`            if (gValEl) gValEl.textContent = gSlider.value + "px";
          };
        }
      }
      if (page && page._targetAttached && botsPage && botsPage._guardDistAttached) {
        clearInterval(_rynPagePoll);
        _rynPagePoll = null;
      }
    } catch (e) {}
    }, 1500);
  }
  _rynStartPagePoll();
  (window._rynUIRearm = window._rynUIRearm || []).push(_rynStartPagePoll);`);

/* =======================================================================
 * 6. In-game HUD — write to the DOM only when a value actually changes
 * ==================================================================== */

block("vitals hud",
"        setInterval(function() {",
"        }, 50);",
`        var _hudShown = null, _hudHp = -1, _hudTier = "", _hudR1 = -1, _hudR1Shown = null;
        var _hpFill = null, _hpVal = null, _r1Row = null, _r1Fill = null, _r1Val = null;
        setInterval(function() {
          try {
            if (_hpFill === null) {
              _hpFill = document.getElementById("ryn-hud-hp-fill");
              _hpVal = document.getElementById("ryn-hud-hp-val");
              _r1Row = document.getElementById("ryn-hud-r1-row");
              _r1Fill = document.getElementById("ryn-hud-r1-fill");
              _r1Val = document.getElementById("ryn-hud-r1-val");
            }
            var live = !!(window.client && client.myPlayer && client.myPlayer.inGame);
            if (_hudShown !== live) {
              _hudShown = live;
              hud.style.display = live ? "flex" : "none";
            }
            if (!live) return;
            var mp = client.myPlayer;
            var hp = Math.max(0, Math.floor(mp.currentHealth || mp.health || 100));
            var maxHp = mp.maxHealth || 100;
            if (hp !== _hudHp) {
              _hudHp = hp;
              var hpPct = Math.min(100, hp / maxHp * 100);
              var tier = hpPct > 60 ? "ok" : hpPct > 30 ? "mid" : "";
              if (_hpFill) {
                _hpFill.style.transform = "scaleX(" + (hpPct / 100).toFixed(3) + ")";
                if (tier !== _hudTier) {
                  _hudTier = tier;
                  _hpFill.className = "ryn-hud-bar-fill" + (tier ? " " + tier : "");
                }
              }
              if (_hpVal) _hpVal.textContent = hp;
            }
            var PM = client.PlayerManager;
            var pd = PM && PM.playerData.get(mp.sid);
            var pri = pd && pd.reload && pd.reload[0];
            var hasReload = !!(pri && pri.max > 0);
            if (_hudR1Shown !== hasReload) {
              _hudR1Shown = hasReload;
              if (_r1Row) _r1Row.style.display = hasReload ? "" : "none";
            }
            if (hasReload) {
              var rPct = Math.round(Math.min(100, pri.current / pri.max * 100));
              if (rPct !== _hudR1) {
                _hudR1 = rPct;
                if (_r1Fill) _r1Fill.style.transform = "scaleX(" + (rPct / 100).toFixed(3) + ")";
                if (_r1Val) _r1Val.textContent = rPct + "%";
              }
            }
          } catch (e) {}
        }, 100);`);

/* Session stats: label / value rows. Every id the update methods write to is
 * kept exactly as it was (#rynPlayers, #rynBots, #rynPing, ...). */
once("session stats markup",
  `      div.innerHTML = '\\n            <span>PLAYERS: <span id="rynPlayers">?</span></span>\\n            <span>BOTS: <span id="rynBots">0/0</span></span>\\n            <span>PING: <span id="rynPing"></span>ms</span>\\n            <span>FPS: <span id="rynFPS"></span></span>\\n            <span>PACKETS: <span id="rynPackets"></span></span>\\n            <span>FastQ: <span id="rynFastQ">false</span></span>\\n        ';`,
  `      div.innerHTML = '<span><i>Players</i><b id="rynPlayers">?</b></span>' +
        '<span><i>Bots</i><b id="rynBots">0/0</b></span>' +
        '<span><i>Ping</i><b><span id="rynPing"></span>ms</b></span>' +
        '<span><i>FPS</i><b id="rynFPS"></b></span>' +
        '<span><i>Packets</i><b id="rynPackets"></b></span>' +
        '<span><i>Fast Q</i><b id="rynFastQ">false</b></span>';`);

/* Bars are transform-driven now, so they must start at full width. */
once("hud markup",
  `hud.innerHTML = '<div class="ryn-hud-row"><span class="ryn-hud-label"><span id="ryn-hud-hp-val" class="ryn-hud-val">100</span></span><div class="ryn-hud-bar-bg"><div id="ryn-hud-hp-fill" class="ryn-hud-bar-fill" style="width:100%"></div></div></div><div class="ryn-hud-row" id="ryn-hud-r1-row" style="display:none"><span class="ryn-hud-label"><span id="ryn-hud-r1-val" class="ryn-hud-val"></span></span><div class="ryn-hud-bar-bg"><div id="ryn-hud-r1-fill" class="ryn-hud-bar-fill" style="width:100%"></div></div></div>';`,
  `hud.innerHTML = '<div class="ryn-hud-row"><span class="ryn-hud-label">HP</span><div class="ryn-hud-bar-bg"><div id="ryn-hud-hp-fill" class="ryn-hud-bar-fill ok"></div></div><span id="ryn-hud-hp-val" class="ryn-hud-val">100</span></div><div class="ryn-hud-row" id="ryn-hud-r1-row" style="display:none"><span class="ryn-hud-label">Rel</span><div class="ryn-hud-bar-bg"><div id="ryn-hud-r1-fill" class="ryn-hud-bar-fill"></div></div><span id="ryn-hud-r1-val" class="ryn-hud-val"></span></div>';`);

/* =======================================================================
 * 7. Branding observer — one check per frame instead of one per mutation
 * ==================================================================== */

once("branding observer",
`new MutationObserver(_applyRynBranding).observe(document, {
  subtree: true,
  childList: true
});`,
`let _brandingQueued = false;
new MutationObserver(() => {
  if (_brandingQueued) return;
  _brandingQueued = true;
  requestAnimationFrame(() => {
    _brandingQueued = false;
    _applyRynBranding();
  });
}).observe(document, {
  subtree: true,
  childList: true
});`);

/* =======================================================================
 * 8. Remaining inline colour on runtime-built rows
 * ==================================================================== */

once("connected bot row",
  `rowEl.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(144,144,200,0.07);border-radius:8px;border:1px solid #9090c844;";`,
  `rowEl.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(139,92,246,0.07);border-radius:6px;border:1px solid rgba(139,92,246,0.28);";`);
once("connected bot check",
  `check.style.cssText = "width:16px;height:16px;flex-shrink:0;fill:#9090c8;";`,
  `check.style.cssText = "width:14px;height:14px;flex-shrink:0;fill:#8B5CF6;";`);
once("connected bot name",
  `nameSpan.style.cssText = "flex:1;font-size:1.05em;color:#d8d8f8;font-weight:600;";`,
  `nameSpan.style.cssText = "flex:1;font-size:12.5px;color:#F2F2F6;font-weight:500;";`);
once("connected bot delete",
  `delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" style="width:18px;height:18px;fill:#9090c877;">`,
  `delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" style="width:15px;height:15px;fill:rgba(238,238,245,0.28);">`);
once("connected bot delete hover in",
  `                  delBtn.querySelector("svg").style.fill = "#cc5151";`,
  `                  delBtn.querySelector("svg").style.fill = "#E5384A";`);
once("connected bot delete hover out",
  `                  delBtn.querySelector("svg").style.fill = "#9090c877";`,
  `                  delBtn.querySelector("svg").style.fill = "rgba(238,238,245,0.28)";`);

once("bot name validation flash",
`          nameInput && (nameInput.style.border = "1px solid #ff4444");
          setTimeout(() => {
            nameInput && (nameInput.style.border = "1px solid #9090c8");
          }, 1500);`,
`          nameInput && (nameInput.style.borderColor = "#E5384A");
          setTimeout(() => {
            nameInput && (nameInput.style.borderColor = "");
          }, 1500);`);

once("dynamic bot row",
  `        row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(201,162,39,0.05);border-radius:8px;border:1px solid #9090c833;";`,
  `        row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.025);border-radius:6px;border:1px solid rgba(255,255,255,0.07);";`);
once("dynamic bot label",
  `        label.style.cssText = "min-width:80px;font-size:1.1em;color:#7070a8;";`,
  `        label.style.cssText = "min-width:74px;font-size:11.5px;color:rgba(238,238,245,0.5);";`);
once("dynamic bot input",
  `        inp.style.cssText = "background:transparent;border:1px solid #9090c8;border-radius:4px;color:#d8d8f8;padding:5px 8px;font-size:13px;outline:none;flex:1;min-width:0;";`,
  `        inp.style.cssText = "background:#141419;border:1px solid rgba(255,255,255,0.07);border-radius:6px;color:#F2F2F6;padding:5px 8px;font-size:12px;outline:none;flex:1;min-width:0;";`);
once("dynamic bot dice",
  `        diceBtn.style.cssText = "background:rgba(122,66,244,0.12);border:1.5px solid rgba(122,66,244,0.4);color:#c8b8ff;border-radius:6px;padding:6px 9px;cursor:pointer;font-size:1em;line-height:1;flex-shrink:0;transition:all 150ms;";`,
  `        diceBtn.className = "option-button";
        diceBtn.style.cssText = "padding:5px 8px;line-height:1;flex-shrink:0;";`);
once("dynamic bot dice hover in",
  `        diceBtn.onmouseenter = () => {
          diceBtn.style.background = "rgba(122,66,244,0.22)";
        };
        diceBtn.onmouseleave = () => {
          diceBtn.style.background = "rgba(122,66,244,0.12)";
        };`,
  "");
once("dynamic bot connect",
  `        connectBtn.style.cssText = "padding:8px 18px;font-size:1em;white-space:nowrap;";`,
  `        connectBtn.classList.add("primary");
        connectBtn.style.cssText = "padding:6px 14px;white-space:nowrap;";`);
once("dynamic bot delete",
  `        delBtn.style.cssText = "background:#853838;border:2px solid #6f2f2f;color:#c07878;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:0.9em;font-weight:800;";`,
  `        delBtn.className = "option-button red";
        delBtn.style.cssText = "padding:5px 10px;";`);

once("chat row delete button",
  `        del.className = "option-button red";
        del.style.cssText = "padding:4px 12px;font-size:1em;";
        del.textContent = "X";`,
  `        del.className = "option-button red";
        del.style.cssText = "padding:4px 11px;";
        del.textContent = "\\u2715";`);
once("chat row delete button 2",
  `        del.className = "option-button red";
        del.style.cssText = "padding:4px 12px;font-size:1em;";
        del.textContent = "✕";`,
  `        del.className = "option-button red";
        del.style.cssText = "padding:4px 11px;";
        del.textContent = "\\u2715";`);

once("bot toast",
  `t.style.cssText = "position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:2147483647;background:rgba(0,0,0,0.8);color:#9090f8;font-family:sans-serif;font-size:14px;padding:8px 16px;border-radius:8px;border:1px solid #9090c8;`,
  `t.style.cssText = "position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:2147483647;background:rgba(8,8,11,0.92);color:#B9A2FF;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12.5px;font-weight:500;padding:7px 14px;border-radius:8px;border:1px solid rgba(139,92,246,0.35);`);

/* Music volume: paint the same range fill the rest of the client uses. */
once("music volume fill",
`      if (volSlider) volSlider.oninput = () => {
        this.setVolume(parseInt(volSlider.value) / 100);
        if (volLabel) volLabel.textContent = volSlider.value + "%";
      };`,
`      const paintVol = () => {
        if (volSlider) volSlider.style.setProperty("--val", volSlider.value + "%");
      };
      paintVol();
      if (volSlider) volSlider.oninput = () => {
        this.setVolume(parseInt(volSlider.value) / 100);
        if (volLabel) volLabel.textContent = volSlider.value + "%";
        paintVol();
      };`);

/* Music player status colours. */
once("music status colour", `      el.style.color = isErr ? "#cc5151" : "#9090c8";`, `      el.style.color = isErr ? "#E5384A" : "#B9A2FF";`);
text = text.replace(/style\.color = "#9090c8"/g, 'style.color = "#B9A2FF"');
text = text.replace(/style\.color = st === "OPEN" \? "#9090c8" : "#cc5151"/g, 'style.color = st === "OPEN" ? "#B9A2FF" : "#E5384A"');
text = text.replace(/style\.borderColor = "#9090c8"/g, 'style.borderColor = "#8B5CF6"');
text = text.replace(/this\._syncBot \? "#9090c8" : "#9090c844"/g, 'this._syncBot ? "#8B5CF6" : "rgba(139,92,246,0.27)"');
text = text.replace(/color:#7A42F433/g, "color:rgba(139,92,246,0.2)");
text = text.replace(/font-family:Orbitron,monospace/g, "font-family:" + MONO());
text = text.replace(/color:rgba\(122,66,244,0\.38\)/g, "color:rgba(139,92,246,0.38)");

/* =======================================================================
 * 9. resetFrame() safety — listeners bound once, polls re-armed
 * ==================================================================== */

/* resetFrame() drops the iframe and re-runs init(). Listeners on the parent
 * window outlive that, so binding them per init stacked a new resize handler
 * (and three preventDefault handlers) on every "Reset Settings". Bind those
 * once; the frame's own listeners still die with the frame. */
once("window listeners bound once",
`      preventDefaults(window);
      preventDefaults(this.frame.window);`,
`      if (!this._windowBound) {
        this._windowBound = true;
        preventDefaults(window);
      }
      preventDefaults(this.frame.window);`);

once("resize bound once",
`      this.handleResize();
      window.addEventListener("resize", () => this.handleResize());`,
`      this.handleResize();
      if (!this._resizeBound) {
        this._resizeBound = true;
        window.addEventListener("resize", () => this.handleResize());
      }`);

/* The attach polls stop once they have wired the frame up, so a rebuilt frame
 * has to put them back. resetFrame() is the only place that rebuilds one. */
once("rearm polls on frame reset",
`    resetFrame() {
      this.frame.target.remove();
      this.init();
    }`,
`    resetFrame() {
      this.frame.target.remove();
      this.init();
      try {
        (window._rynUIRearm || []).forEach(fn => fn());
      } catch (_) {}
    }`);

/* --- leftovers: music chat-sync button, lyric button, dead colour table --- */
once("music sync button",
`        syncBotBtn.style.background = this._syncBot ? "#2a1f00" : "#0d0a14";`,
`        syncBotBtn.style.background = this._syncBot ? "rgba(139,92,246,0.14)" : "#0D0D12";`);
text = text.replace(/syncBotBtn\.style\.color = this\._syncBot \? "#e8e8ff" : "#9090c8";/g,
  'syncBotBtn.style.color = this._syncBot ? "#FFFFFF" : "#B9A2FF";');
text = text.replace(/syncBotBtn\.style\.boxShadow = this\._syncBot \? "0 0 10px #9090c844" : "none";/g,
  'syncBotBtn.style.boxShadow = "none";');
text = text.replace(/style\.borderColor = "#9090c866"/g, 'style.borderColor = "rgba(139,92,246,0.4)"');
text = text.replace(/style\.background = "#0d0a14"/g, 'style.background = "#0D0D12"');
text = text.replace(/style\.color = "#e8e8ff"/g, 'style.color = "#FFFFFF"');

/* the farm buttons are class-driven now, so this colour table has no reader */
once("dead farm colour table",
`            const farmTypeActive = {
              border: "rgba(122,66,244,0.6)",
              bg: "rgba(122,66,244,0.25)",
              color: "#fff"
            };
`, "");

/* =======================================================================
 * write
 * ==================================================================== */

fs.writeFileSync(OUT, text);
console.log(`build-ui: ${applied} anchored edits applied -> ${path.relative(ROOT, OUT)}`);
