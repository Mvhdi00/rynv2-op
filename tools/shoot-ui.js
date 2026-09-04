#!/usr/bin/env node
/* Screenshot every menu tab of ui/preview.html and run interaction checks. */
"use strict";

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright-core");

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PREVIEW = "file://" + path.resolve(__dirname, "..", "ui", "preview.html");
const OUTDIR = process.argv[2] || "/tmp/ryn-shots";

const TABS = [
  ["1", "keybinds"], ["2", "combat"], ["3", "visuals"],
  ["4", "misc"], ["5", "bots"], ["7", "music"]
];

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--force-color-profile=srgb"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(PREVIEW);
  await page.waitForSelector("#menu-wrapper");
  await page.addStyleTag({ content: "html,body{background:#1b2f21;}" });

  const wrapper = page.locator("#menu-wrapper");
  const box = await wrapper.boundingBox();
  console.log(`panel: ${Math.round(box.width)} x ${Math.round(box.height)}`);

  for (const [id, name] of TABS) {
    // the active tab is pointer-events:none by design — it is already open
    const isActive = await page.$eval(`.open-menu[data-id="${id}"]`, el => el.classList.contains("active"));
    if (!isActive) await page.click(`.open-menu[data-id="${id}"]`);
    await page.waitForTimeout(220);
    await wrapper.screenshot({ path: path.join(OUTDIR, `${name}.png`) });
    const opened = await page.$eval(`.menu-page[data-id="${id}"]`, el => el.classList.contains("opened"));
    if (!opened) errors.push(`tab ${name} did not open`);
  }

  /* --- interaction checks ------------------------------------------- */
  await page.click('.open-menu[data-id="2"]');
  await page.waitForTimeout(200);

  // toggle: click the label, the bound input must flip
  const before = await page.$eval("#_spikeTick", el => el.checked);
  await page.click('label.option-title[for="_spikeTick"]');
  const after = await page.$eval("#_spikeTick", el => el.checked);
  if (before === after) errors.push("label click did not toggle _spikeTick");

  // the enabled row marker and section dot must respond
  await page.waitForTimeout(250);
  const marker = await page.$eval('.content-option:has(#_spikeTick)', el =>
    getComputedStyle(el, "::before").opacity);
  if (marker !== "1") errors.push(`row marker opacity ${marker} (expected 1)`);

  // slider: fill variable tracks the value
  await page.click('.open-menu[data-id="3"]');
  await page.waitForTimeout(150);
  await page.$eval("#_objectTintOpacity", el => {
    el.value = 75; el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const val = await page.$eval("#_objectTintOpacity", el => el.style.getPropertyValue("--val"));
  if (!val.startsWith("75")) errors.push(`slider --val is "${val}" (expected 75%)`);
  const label = await page.$eval("#_objectTintOpacity", el => el.previousElementSibling.textContent);
  if (label !== "75%") errors.push(`slider label is "${label}"`);

  // search dropdown renders on top of the page
  await page.fill("#ryn-search-input", "spike");
  await page.waitForTimeout(120);
  await page.$eval("#ryn-search-dropdown", el => { el.style.display = "block"; });
  await page.$eval("#ryn-search-dropdown", el => {
    el.innerHTML = '<div class="ryn-sl">Combat</div>' +
      '<div class="ryn-si"><span class="ryn-st"><mark>Spike</mark> Tick</span><span class="ryn-sp">Instakills</span></div>' +
      '<div class="ryn-si ryn-fx"><span class="ryn-st"><mark>Spike</mark> Gear Insta</span><span class="ryn-sp">Instakills</span></div>';
  });
  await page.waitForTimeout(120);
  await wrapper.screenshot({ path: path.join(OUTDIR, "search.png") });

  // no horizontal overflow anywhere
  const overflow = await page.$eval("#page-container", el => el.scrollWidth - el.clientWidth);
  if (overflow > 1) errors.push(`page container scrolls horizontally by ${overflow}px`);

  // hover + closing animation frame
  await page.hover('.open-menu[data-id="4"]');
  await page.waitForTimeout(150);
  await wrapper.screenshot({ path: path.join(OUTDIR, "hover.png") });

  // every control state on one screen: on / off / recording / conflict
  await page.fill("#ryn-search-input", "");
  await page.$eval("#ryn-search-dropdown", el => { el.style.display = "none"; });
  await page.click('.open-menu[data-id="2"]');
  await page.waitForTimeout(150);
  await page.$$eval("#_spikeTickBreak, #_spikeTickNear, #_toolSpearInsta, #_autoSync", els =>
    els.forEach(e => { e.checked = true; }));
  await page.waitForTimeout(300);
  await wrapper.screenshot({ path: path.join(OUTDIR, "states-combat.png") });

  await page.click('.open-menu[data-id="1"]');
  await page.waitForTimeout(150);
  await page.$eval("#_food", el => { el.classList.add("active"); el.textContent = "Wait..."; });
  await page.$$eval("#_wall, #_spike", els => els.forEach(e => e.classList.add("red")));
  await page.hover("#_windmill");
  await page.waitForTimeout(250);
  await wrapper.screenshot({ path: path.join(OUTDIR, "states-keys.png") });

  // nothing may animate while the menu just sits there
  await page.$eval("#_food", el => { el.classList.remove("active"); el.textContent = "Q"; });
  await page.click('.open-menu[data-id="7"]');
  await page.waitForTimeout(600);
  const running = await page.evaluate(() =>
    document.getAnimations()
      .filter(a => a.playState === "running")
      .map(a => (a.animationName || "") + "@" + (a.effect && a.effect.target && a.effect.target.className)));
  if (running.length) errors.push(`idle animations still running: ${running.join(", ")}`);

  await browser.close();

  if (errors.length) {
    console.error("FAILURES:\n  " + errors.join("\n  "));
    process.exit(1);
  }
  console.log(`ok — shots in ${OUTDIR}`);
})();
