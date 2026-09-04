#!/usr/bin/env node
/* ===========================================================================
 * verify-ui.js — proves the redesign did not change what the menu does.
 *
 *   node tools/verify-ui.js
 *
 * Builds a DOM from the base client and from the redesigned build, then
 * checks that every control, id and wiring contract the client's JS depends
 * on survived: same ids, same tabs, same control shapes, same settings keys.
 * Also asserts the performance rules the redesign is meant to hold to.
 * ======================================================================== */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = path.join(ROOT, "src", "Ryn_Type_2_v5.4.js");
const BUILT = path.join(ROOT, "Ryn_Type_2.user.js");

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

/* the base client puts the tabs inside <main>; the build puts them above it.
 * preview-ui.js emits the build's layout either way, which is fine — the
 * checks below are about ids and control shapes, not about the wrapper. */
function previewOf(script, tag) {
  const out = path.join(os.tmpdir(), `ryn-preview-${tag}.html`);
  execFileSync(process.execPath, [path.join(ROOT, "tools", "preview-ui.js"), script, out], { stdio: "pipe" });
  return "file://" + out;
}

const SURVEY = () => {
  const q = s => Array.from(document.querySelectorAll(s));
  const ids = sel => q(sel).map(e => e.id).filter(Boolean).sort();
  return {
    allIds: q("[id]").map(e => e.id).sort(),
    checkboxes: ids('input[type="checkbox"][id]'),
    sliders: ids('input[type="range"][id]'),
    colors: ids('input[type="color"][id]'),
    texts: ids('input[type="text"][id]'),
    hotkeys: ids(".hotkeyInput[id]"),
    buttons: ids(".option-button[id]"),
    tabs: q(".open-menu[data-id]").map(e => e.dataset.id).sort(),
    pages: q(".menu-page[data-id]").map(e => e.dataset.id).sort(),
    optionTitles: q(".content-option .option-title").map(e => e.textContent.trim()).filter(Boolean).sort(),
    sectionTitles: q(".section-title").map(e => e.childNodes[0] && e.childNodes[0].textContent.trim()).filter(Boolean),
    // wiring contracts the client's attach* methods rely on
    badSliderSibling: q('input[type="range"][id]').filter(e => {
      const p = e.previousElementSibling;
      return !p || p.tagName !== "SPAN" || !p.classList.contains("slider-value");
    }).map(e => e.id),
    badColorSibling: q('input[type="color"][id]').filter(e => {
      const p = e.previousElementSibling;
      return !p || p.tagName !== "BUTTON" || !p.classList.contains("reset-color");
    }).map(e => e.id),
    badHotkeyTag: q(".hotkeyInput[id]").filter(e => e.tagName !== "BUTTON").map(e => e.id),
    badSwitch: q('.switch-checkbox input[type="checkbox"]').filter(e => {
      const s = e.nextElementSibling;
      return !s || s.tagName !== "SPAN";
    }).map(e => e.id),
    // labels that flip a toggle by `for=`
    orphanLabels: q("label.option-title[for]").filter(l => !document.getElementById(l.getAttribute("for"))).map(l => l.getAttribute("for"))
  };
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto(previewOf(BASE, "base"));
  const before = await page.evaluate(SURVEY);

  await page.goto(previewOf(BUILT, "built"));
  const after = await page.evaluate(SURVEY);

  /* --- 1. nothing lost ------------------------------------------------- */
  const same = (a, b, what) => {
    const missing = a.filter(x => !b.includes(x));
    const added = b.filter(x => !a.includes(x));
    check(missing.length === 0, `${what}: missing after redesign -> ${missing.join(", ")}`);
    if (added.length) console.log(`  note: ${what} gained ${added.join(", ")}`);
  };
  same(before.checkboxes, after.checkboxes, "toggles");
  same(before.sliders, after.sliders, "sliders");
  same(before.colors, after.colors, "colour pickers");
  same(before.texts, after.texts, "text inputs");
  same(before.hotkeys, after.hotkeys, "hotkey buttons");
  same(before.buttons, after.buttons, "option buttons");
  same(before.allIds, after.allIds, "element ids");
  same(before.tabs, after.tabs, "tabs");
  same(before.pages, after.pages, "pages");
  same(before.optionTitles, after.optionTitles, "option labels");
  same(before.sectionTitles, after.sectionTitles, "section titles");

  /* --- 2. wiring contracts the client's JS depends on ------------------- */
  /* relative to the base client: the redesign may not introduce new breakage.
   * (#music-volume has never had a .slider-value sibling — the music page owns
   * it, attachSliders skips it because it is not a settings key.) */
  const noNew = (b, a, what) => {
    const added = a.filter(x => !b.includes(x));
    check(added.length === 0, `${what}: ${added.join(", ")}`);
  };
  noNew(before.badSliderSibling, after.badSliderSibling, "sliders newly missing a .slider-value sibling");
  noNew(before.badColorSibling, after.badColorSibling, "colour pickers newly missing a .reset-color button");
  noNew(before.badHotkeyTag, after.badHotkeyTag, ".hotkeyInput newly not a <button>");
  noNew(before.badSwitch, after.badSwitch, "toggles newly missing their track <span>");
  noNew(before.orphanLabels, after.orphanLabels, "labels newly pointing at a missing input");

  /* --- 3. every tab has a page and vice versa --------------------------- */
  for (const id of after.tabs) check(after.pages.includes(id), `tab ${id} has no page`);

  /* --- 4. required structural hooks ------------------------------------ */
  const hooks = await page.evaluate(() => [
    "#menu-container", "#menu-wrapper", "#page-container", "#close-button",
    "#ryn-search-wrap", "#ryn-search-input", "#ryn-search-dropdown", "#ryn-search-clear",
    "#bot-container", "#navbar-container", "#_formationGrid",
    "#dynamic-bot-list", "#add-bot-dynamic", "#autoChatMsgList", "#addAutoChatMsg",
    "#autoBotChatMsgList", "#addAutoBotChatMsg", "#script-description", "#author",
    "#bot-weapon-selector", "#bot-sec-weapon-selector", "#bot-age4-selector"
  ].filter(s => !document.querySelector(s)));
  check(hooks.length === 0, `missing structural hooks: ${hooks.join(", ")}`);

  await browser.close();

  /* --- 5. performance rules the redesign commits to -------------------- */
  const built = fs.readFileSync(BUILT, "utf8");
  const base = fs.readFileSync(BASE, "utf8");

  const between = (s, a, b) => {
    const i = s.indexOf(a), j = s.indexOf(b, i);
    return i === -1 || j === -1 ? "" : s.slice(i, j);
  };
  const uiRegion = s => between(s, "const UI = new class {", "const FORMATION_IDS = new Set");

  const styleText = between(built, "const styles_default = ", "\n") +
                    between(built, "rynCSS.textContent = `", "`;") +
                    between(built, "const Game_default = ", "\n");
  /* The UI font is fetched with a <link> (parallel, non-blocking) and there is
   * exactly one family; a render-blocking @import is what we do not want back. */
  check(!/@import\s/.test(styleText), "a stylesheet pulls a font with a render-blocking @import");
  const families = [...built.matchAll(/fonts\.googleapis\.com\/css2\?family=([A-Za-z+]+)/g)].map(m => m[1]);
  check(new Set(families).size <= 1, `more than one web font family requested: ${[...new Set(families)]}`);
  check(!/backdrop-filter\s*:/.test(styleText), "a stylesheet still uses backdrop-filter");
  check(!/animation:\s*shimmer/.test(styleText), "the always-on shimmer animation is still present");

  /* the panel must render 1:1 rather than at a fractional scale, or every
   * glyph is rasterised off-pixel and the authored sizes arrive shrunk */
  check(/const scale = Math\.min\(1, Math\.min\(window\.innerWidth/.test(built),
    "handleResize still downscales the panel below 1:1");

  const uiBefore = uiRegion(base), uiAfter = uiRegion(built);
  const intervals = s => (s.match(/setInterval\(/g) || []).length;
  check(intervals(uiAfter) < intervals(uiBefore),
    `UI timers did not go down (${intervals(uiBefore)} -> ${intervals(uiAfter)})`);
  check(!/requestAnimationFrame/.test(uiAfter), "a requestAnimationFrame loop was added to the UI class");
  console.log(`  UI-class timers: ${intervals(uiBefore)} -> ${intervals(uiAfter)}`);

  /* the gameplay half of the script must be byte-identical */
  const gameplay = s => {
    const start = s.indexOf("const DataHandler = new class");
    const end = s.indexOf("const UI = new class {");
    return s.slice(start, end);
  };
  check(gameplay(base) === gameplay(built),
    "the gameplay region between DataHandler and UI is not byte-identical");

  if (fails.length) {
    console.error("\nverify-ui: FAILED\n  " + fails.join("\n  ") + "\n");
    process.exit(1);
  }
  console.log("verify-ui: ok — controls, ids and wiring preserved; perf rules hold");
})();
