#!/usr/bin/env node
/* Extract the menu iframe document out of a built RYN script so the redesign
 * can be opened, screenshotted and clicked through outside the game. */
"use strict";

const fs = require("fs");
const path = require("path");

const file = process.argv[2] || path.resolve(__dirname, "..", "Ryn_Type_2.user.js");
const out = process.argv[3] || path.resolve(__dirname, "..", "ui", "preview.html");

const lines = fs.readFileSync(file, "utf8").split("\n");
const names = ["Header", "Navbar", "Devtool", "Keybinds", "Combat", "Visuals", "Misc", "Bots", "Music", "styles", "Game", "Store"];
const T = {};

for (const name of names) {
  const marker = `  const ${name}_default = `;
  const hit = lines.find(l => l.startsWith(marker));
  if (!hit) throw new Error(`missing template: ${name}_default`);
  T[name] = JSON.parse(hit.slice(marker.length).replace(/;\s*$/, ""));
}

/* the formation picker injects its own sheet at runtime; pull it in so the
 * popup can be previewed too */
const formationLine = lines.find(l => l.trimStart().startsWith('st.textContent = "') && l.includes("#_formationGrid"));
let formation = "";
if (formationLine) {
  const body = formationLine.trim().slice("st.textContent = ".length).replace(/;\s*$/, "");
  try { formation = JSON.parse(body); } catch (_) { formation = ""; }
}

const doc = `<!DOCTYPE html>
<meta charset="utf-8">
<style>${T.styles}</style>
<style>${formation}</style>
<div id="menu-container" class="transparent">
  <div id="menu-wrapper">
    ${T.Header}
    ${T.Navbar}
    <main>
      <div id="page-container">
        ${T.Keybinds}
        ${T.Combat}
        ${T.Visuals}
        ${T.Misc}
        ${T.Bots}
        ${T.Devtool}
        ${T.Music}
      </div>
    </main>
  </div>
</div>
<script>
/* Mirrors UI.attachOpenMenu / attachSliders so tabs and ranges can be driven
 * in the preview. The client wires the same selectors at runtime. */
(function () {
  var buttons = document.querySelectorAll(".open-menu[data-id]");
  var pages = document.querySelectorAll(".menu-page[data-id]");
  buttons.forEach(function (b) {
    b.onclick = function () {
      buttons.forEach(function (x) { x.classList.remove("active"); });
      pages.forEach(function (x) { x.classList.remove("opened"); });
      b.classList.add("active");
      var p = document.querySelector('.menu-page[data-id="' + b.dataset.id + '"]');
      if (p) p.classList.add("opened");
      document.getElementById("page-container").scrollTop = 0;
    };
  });
  document.querySelectorAll('input[type="range"][id]').forEach(function (s) {
    var paint = function () {
      var min = Number(s.min || 0), max = Number(s.max || 100);
      var pct = max > min ? (Number(s.value) - min) / (max - min) * 100 : 0;
      s.style.setProperty("--val", pct.toFixed(2) + "%");
      var v = s.previousElementSibling;
      if (v && v.tagName === "SPAN") v.textContent = s.value + (s.dataset.suffix || "");
    };
    s.addEventListener("input", paint);
    paint();
  });
  document.querySelectorAll(".hotkeyInput[id]").forEach(function (h, i) {
    h.textContent = ["Q", "E", "R", "F", "V", "C", "Z", "X", "1", "2"][i % 10];
  });
  var d = document.getElementById("script-description");
  if (d) d.textContent = "v5.4";

  /* formation picker, as _attachFormationSelector builds it */
  var grid = document.getElementById("_formationGrid");
  if (grid) {
    grid.innerHTML = '<div class="fsel-trigger"><span class="fsel-icon">\u25cf</span>' +
      '<span class="fsel-label">Circle</span><span class="fsel-arrow">\u25be</span></div>';
    var pop = document.createElement("div");
    pop.className = "fsel-popup";
    pop.id = "fsel-preview";
    pop.style.cssText = "left:24px;top:190px;display:none;";
    var cells = [["\u2715","None"],["\u25cf","Circle"],["\u2665","Heart"],["\u25b2","Triangle"],
                 ["\u25a0","Square"],["\u2503","Line Up"],["\u2501","Line Side"],["\u{1F682}","Train"]];
    pop.innerHTML = '<div class="fsel-popup-header"><span class="fsel-popup-title">Formation</span>' +
      '<div class="fsel-popup-close">\u2715</div></div><div class="fsel-popup-body">' +
      cells.map(function (c, i) {
        return '<div class="fcat-btn' + (i === 1 ? " active" : "") + '">' + c[0] +
          '<span class="fcat-key' + (i === 1 ? " set" : "") + '">' + (i === 1 ? "F1" : "\u2022") + '</span>' +
          '<span class="fcat-tip">' + c[1] + '</span></div>';
      }).join("") +
      '</div><div class="fsel-popup-footer"><div class="fsel-reset-all">\u2715 Reset All Hotkeys</div></div>';
    document.body.appendChild(pop);
  }
})();
</script>
`;

fs.writeFileSync(out, doc);
console.log(`preview-ui: wrote ${path.relative(process.cwd(), out)} (${doc.length} bytes)`);
