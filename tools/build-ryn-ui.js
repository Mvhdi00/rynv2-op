#!/usr/bin/env node
/*
 * build-ryn-ui.js
 *
 * Rebuilds the Ryn Type 2 userscript's interface layer from the sources in
 * tools/ryn-ui/. Only presentation is touched: markup, stylesheet, and the
 * few places where the client wrote inline colours straight onto elements.
 * Every element id, class hook and event wiring the client reads is kept.
 *
 *   node tools/build-ryn-ui.js [path/to/Ryn_Type_2.user.js]
 */

const fs = require("fs");
const path = require("path");

const target = process.argv[2] || path.join(__dirname, "..", "Ryn_Type_2.user.js");
const uiDir = path.join(__dirname, "ryn-ui");

let src = fs.readFileSync(target, "utf8");
let applied = 0;

function replaceOnce(find, replace, label) {
  const at = src.indexOf(find);
  if (at === -1) throw new Error(`anchor not found: ${label}`);
  if (src.indexOf(find, at + find.length) !== -1) throw new Error(`anchor is not unique: ${label}`);
  src = src.slice(0, at) + replace + src.slice(at + find.length);
  applied++;
}

function replaceAll(find, replace, label, expected) {
  let count = 0;
  let out = "";
  let rest = src;
  for (;;) {
    const at = rest.indexOf(find);
    if (at === -1) break;
    out += rest.slice(0, at) + replace;
    rest = rest.slice(at + find.length);
    count++;
  }
  src = out + rest;
  if (!count) throw new Error(`anchor not found: ${label}`);
  if (expected != null && count !== expected) {
    throw new Error(`anchor ${label}: expected ${expected} hits, found ${count}`);
  }
  applied += count;
}

function replaceAllWithin(startAnchor, endAnchor, find, replace, label) {
  const from = src.indexOf(startAnchor);
  if (from === -1) throw new Error(`region start not found: ${label}`);
  const to = src.indexOf(endAnchor, from);
  if (to === -1) throw new Error(`region end not found: ${label}`);
  const region = src.slice(from, to);
  const parts = region.split(find);
  if (parts.length === 1) throw new Error(`anchor not found in region: ${label}`);
  src = src.slice(0, from) + parts.join(replace) + src.slice(to);
  applied += parts.length - 1;
}

function ui(file) {
  return fs.readFileSync(path.join(uiDir, file), "utf8").replace(/\r\n/g, "\n").trimEnd();
}

/* ------------------------------------------------------------------
   1. templates
   ------------------------------------------------------------------ */

const templates = {
  Header: "",
  Navbar: ui("navbar.html"),
  Devtool: "",
  Keybinds: ui("keybinds.html"),
  Combat: ui("combat.html"),
  Visuals: ui("visuals.html"),
  Misc: ui("misc.html"),
  Bots: ui("bots.html"),
  Music: ui("music.html"),
  styles: ui("styles.css")
};

for (const name of Object.keys(templates)) {
  const re = new RegExp(`^  const ${name}_default = ".*";$`, "m");
  if (!re.test(src)) throw new Error(`template const not found: ${name}_default`);
  src = src.replace(re, `  const ${name}_default = ${JSON.stringify(templates[name])};`);
  applied++;
}

/* ------------------------------------------------------------------
   2. frame shell — the top bar is gone, the rail carries identity,
      search, categories, the section outline and the close control.
   ------------------------------------------------------------------ */

replaceOnce(
  '    getFrameContent() {\n      return `\\n            <!DOCTYPE html>\\n            <style>${styles_default}</style>\\n            <div id="menu-container" class="transparent">\\n                <div id="menu-wrapper">\\n                    ${Header_default}\\n\\n                    <main>\\n                        ${Navbar_default}\\n                        \\n                        <div id="page-container">\\n                            ${Keybinds_default}\\n                            ${Combat_default}\\n                            ${Visuals_default}\\n                            ${Misc_default}\\n                            ${Bots_default}\\n                            ${Devtool_default}\\n                            ${Music_default}\\n                                  </div>\\n                    </main>\\n                </div>\\n            </div>\\n        `;\n    }',
  '    getFrameContent() {\n      return `<!DOCTYPE html>\n<style>${styles_default}</style>\n<div id="menu-container" class="transparent">\n  <div id="menu-wrapper">\n    <main>\n      ${Navbar_default}\n      <div id="page-container">\n        ${Keybinds_default}\n        ${Visuals_default}\n        ${Combat_default}\n        ${Misc_default}\n        ${Music_default}\n        ${Bots_default}\n        ${Devtool_default}\n      </div>\n    </main>\n  </div>\n</div>`;\n    }',
  "getFrameContent"
);

/* ------------------------------------------------------------------
   3. sizing — the panel is laid out responsively in CSS; the scale is
      only a floor so the layout survives a very small window.
   ------------------------------------------------------------------ */

replaceOnce(
  "      const scale = Math.min(.9, Math.min(window.innerWidth / 1280, window.innerHeight / 720));\n" +
  "      this.menuScale = scale;\n" +
  "      menuContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;",
  "      const scale = Math.min(1, window.innerWidth / 920, window.innerHeight / 580);\n" +
  "      this.menuScale = scale;\n" +
  '      menuContainer.style.setProperty("--ryn-scale", scale.toFixed(4));',
  "handleResize"
);

/* ------------------------------------------------------------------
   4. sliders — feed the fill percentage the track paints itself with
   ------------------------------------------------------------------ */

replaceOnce(
  "        const updateSliderValue = () => {\n" +
  "          const sliderValue = slider.previousElementSibling;\n" +
  "          if (sliderValue instanceof this.frame.window.HTMLSpanElement) {\n" +
  '            sliderValue.textContent = slider.value + (slider.dataset.suffix || "");\n' +
  "          }\n" +
  "        };",
  "        const updateSliderValue = () => {\n" +
  "          const sliderValue = slider.previousElementSibling;\n" +
  "          if (sliderValue instanceof this.frame.window.HTMLSpanElement) {\n" +
  '            sliderValue.textContent = slider.value + (slider.dataset.suffix || "");\n' +
  "          }\n" +
  "          const min = Number(slider.min) || 0;\n" +
  "          const max = Number(slider.max);\n" +
  "          const span = max - min;\n" +
  "          const pct = span > 0 ? (Number(slider.value) - min) / span * 100 : 0;\n" +
  '          slider.style.setProperty("--val", pct.toFixed(2) + "%");\n' +
  "        };",
  "slider fill"
);

/* ------------------------------------------------------------------
   5. navigation — category switch plus the live section outline
   ------------------------------------------------------------------ */

replaceOnce(
  "    attachOpenMenu() {\n" +
  "      const {openMenuButtons: openMenuButtons, menuPages: menuPages} = this.getElements();\n" +
  "      for (let i = 0; i < openMenuButtons.length; i++) {\n" +
  "        const button = openMenuButtons[i];\n" +
  '        const id = button.getAttribute("data-id");\n' +
  "        const menuPage = this.querySelector(`.menu-page[data-id='${id}']`);\n" +
  "        button.onclick = () => {\n" +
  "          if (menuPage instanceof this.frame.window.HTMLDivElement) {\n" +
  '            removeClass(openMenuButtons, "active");\n' +
  '            button.classList.add("active");\n' +
  '            removeClass(menuPages, "opened");\n' +
  '            menuPage.classList.add("opened");\n' +
  "            try {\n" +
  '              const pc = menuPage.closest("#page-container") || menuPage.parentElement;\n' +
  "              if (pc) pc.scrollTop = 0;\n" +
  "            } catch (_) {}\n" +
  "          } else {\n" +
  '            Logger.error(`attachOpenMenu Error: Cannot find "${button.textContent}" menu`);\n' +
  "          }\n" +
  "        };\n" +
  "      }\n" +
  "    }",

  "    attachOpenMenu() {\n" +
  "      const {openMenuButtons: openMenuButtons, menuPages: menuPages} = this.getElements();\n" +
  "      for (let i = 0; i < openMenuButtons.length; i++) {\n" +
  "        const button = openMenuButtons[i];\n" +
  '        const id = button.getAttribute("data-id");\n' +
  "        const menuPage = this.querySelector(`.menu-page[data-id='${id}']`);\n" +
  "        button.onclick = () => {\n" +
  "          if (menuPage instanceof this.frame.window.HTMLDivElement) {\n" +
  '            removeClass(openMenuButtons, "active");\n' +
  '            button.classList.add("active");\n' +
  '            removeClass(menuPages, "opened");\n' +
  '            menuPage.classList.add("opened");\n' +
  "            try {\n" +
  '              const pc = menuPage.closest("#page-container") || menuPage.parentElement;\n' +
  "              if (pc) pc.scrollTop = 0;\n" +
  "            } catch (_) {}\n" +
  "            this.buildOutline(menuPage);\n" +
  "          } else {\n" +
  '            Logger.error(`attachOpenMenu Error: Cannot find "${button.textContent}" menu`);\n' +
  "          }\n" +
  "        };\n" +
  "      }\n" +
  "    }\n" +
  "    // The rail lists the sections of whichever category is open, so a long\n" +
  "    // page can be jumped through without scrolling to look for a heading.\n" +
  "    buildOutline(menuPage) {\n" +
  "      try {\n" +
  "        const doc = this.frame.document;\n" +
  '        const outline = doc.getElementById("nav-outline");\n' +
  '        const container = doc.getElementById("page-container");\n' +
  "        if (!outline || !container || !menuPage) return;\n" +
  '        outline.innerHTML = "";\n' +
  "        this._outlineTargets = [];\n" +
  '        const titles = menuPage.querySelectorAll(".section > .section-title, .rm-sec > .rm-sec-head > .rm-sec-title");\n' +
  "        for (const titleEl of titles) {\n" +
  '          const section = titleEl.closest(".section, .rm-sec");\n' +
  "          if (!section) continue;\n" +
  "          const first = titleEl.childNodes[0];\n" +
  "          const label = (first && first.textContent || titleEl.textContent || \"\").trim();\n" +
  "          if (!label) continue;\n" +
  '          const item = doc.createElement("button");\n' +
  '          item.className = "outline-item";\n' +
  "          item.textContent = label;\n" +
  "          item.onclick = () => {\n" +
  "            const top = section.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 26;\n" +
  '            container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });\n' +
  "          };\n" +
  "          outline.appendChild(item);\n" +
  "          this._outlineTargets.push({ item: item, section: section });\n" +
  "        }\n" +
  "        this.syncOutline();\n" +
  "      } catch (_) {}\n" +
  "    }\n" +
  "    syncOutline() {\n" +
  "      const targets = this._outlineTargets;\n" +
  "      if (!targets || !targets.length) return;\n" +
  "      try {\n" +
  '        const container = this.frame.document.getElementById("page-container");\n' +
  "        if (!container) return;\n" +
  "        const line = container.getBoundingClientRect().top + 96;\n" +
  "        let current = 0;\n" +
  "        for (let i = 0; i < targets.length; i++) {\n" +
  "          if (targets[i].section.getBoundingClientRect().top <= line) current = i;\n" +
  "        }\n" +
  "        for (let i = 0; i < targets.length; i++) {\n" +
  '          targets[i].item.classList.toggle("current", i === current);\n' +
  "        }\n" +
  "      } catch (_) {}\n" +
  "    }",
  "attachOpenMenu + outline"
);

replaceOnce(
  '      const description = "RYN v" + RYN.version;\n' +
  "      if (scriptDescription) scriptDescription.textContent = description;",
  '      const description = "RYN v" + RYN.version;\n' +
  "      if (scriptDescription) scriptDescription.textContent = description;\n" +
  '      const versionEl = this.querySelector("#ryn-version");\n' +
  "      if (versionEl) versionEl.textContent = description;\n" +
  '      const scrollHost = this.querySelector("#page-container");\n' +
  "      if (scrollHost) {\n" +
  "        let outlineQueued = false;\n" +
  '        scrollHost.addEventListener("scroll", () => {\n' +
  "          if (outlineQueued) return;\n" +
  "          outlineQueued = true;\n" +
  "          this.frame.window.requestAnimationFrame(() => {\n" +
  "            outlineQueued = false;\n" +
  "            this.syncOutline();\n" +
  "          });\n" +
  "        }, { passive: true });\n" +
  "      }",
  "version + outline scroll"
);

replaceOnce(
  "        this.attachOpenMenu();\n" +
  '        this.createRipple(".open-menu");',
  "        this.attachOpenMenu();\n" +
  '        this.buildOutline(this.querySelector(".menu-page.opened"));\n' +
  '        this.createRipple(".open-menu");',
  "initial outline"
);

/* ------------------------------------------------------------------
   6. selectors that used to paint themselves with inline colours
   ------------------------------------------------------------------ */

replaceOnce(
  "        btns.forEach(b => {\n" +
  '          const active = b.getAttribute("data-wid") === String(wid);\n' +
  '          b.style.border = active ? "1px solid rgba(122,66,244,0.6)" : "1px solid rgba(255,255,255,0.08)";\n' +
  '          b.style.background = active ? "rgba(122,66,244,0.15)" : "rgba(255,255,255,0.03)";\n' +
  '          b.style.color = active ? "#c0a0ff" : "rgba(210,210,225,0.8)";\n' +
  "        });",
  "        btns.forEach(b => {\n" +
  '          b.classList.toggle("wpn-active", b.getAttribute("data-wid") === String(wid));\n' +
  "        });",
  "primary weapon active state"
);

replaceOnce(
  "          secBtns.forEach(b => {\n" +
  '            const active = b.getAttribute("data-swid") === String(swid);\n' +
  '            b.style.border = active ? "2px solid #9090c8" : "2px solid #2a204066";\n' +
  '            b.style.background = active ? "#1e1a30" : "#13101e";\n' +
  '            b.style.color = active ? "#9090c8" : "#d8d8f8";\n' +
  "          });",
  "          secBtns.forEach(b => {\n" +
  '            b.classList.toggle("wpn-active", b.getAttribute("data-swid") === String(swid));\n' +
  "          });",
  "secondary weapon active state"
);

replaceOnce(
  "              btns.forEach(b => {\n" +
  '                const active = b.getAttribute("data-age4id") === String(id);\n' +
  '                b.style.border = active ? "1px solid rgba(122,66,244,0.6)" : "1px solid rgba(255,255,255,0.08)";\n' +
  '                b.style.background = active ? "rgba(122,66,244,0.15)" : "rgba(255,255,255,0.03)";\n' +
  '                b.style.color = active ? "#c0a0ff" : "rgba(210,210,225,0.8)";\n' +
  "              });",
  "              btns.forEach(b => {\n" +
  '                b.classList.toggle("wpn-active", b.getAttribute("data-age4id") === String(id));\n' +
  "              });",
  "age 4 building active state"
);

replaceOnce(
  "              if (btnSingle) {\n" +
  '                btnSingle.style.background = isSingle ? "rgba(122,66,244,0.25)" : "rgba(255,255,255,0.05)";\n' +
  '                btnSingle.style.borderColor = isSingle ? "rgba(122,66,244,0.6)" : "rgba(255,255,255,0.1)";\n' +
  '                btnSingle.style.color = isSingle ? "#fff" : "#aaa";\n' +
  "              }\n" +
  "              if (btnNearest) {\n" +
  '                btnNearest.style.background = !isSingle ? "rgba(122,66,244,0.25)" : "rgba(255,255,255,0.05)";\n' +
  '                btnNearest.style.borderColor = !isSingle ? "rgba(122,66,244,0.6)" : "rgba(255,255,255,0.1)";\n' +
  '                btnNearest.style.color = !isSingle ? "#fff" : "#aaa";\n' +
  "              }",
  '              if (btnSingle) btnSingle.classList.toggle("seg-active", isSingle);\n' +
  '              if (btnNearest) btnNearest.classList.toggle("seg-active", !isSingle);',
  "farm mode active state"
);

replaceOnce(
  "            const farmTypeBtns = doc.querySelectorAll(\".farm-type-btn\");\n" +
  "            const farmTypeActive = {\n" +
  '              border: "rgba(122,66,244,0.6)",\n' +
  '              bg: "rgba(122,66,244,0.25)",\n' +
  '              color: "#fff"\n' +
  "            };\n" +
  "            function _applyFarmType(idx) {\n" +
  "              Settings_default._botFarmType = idx;\n" +
  "              if (ftSel) ftSel.value = idx;\n" +
  "              farmTypeBtns.forEach((btn, i) => {\n" +
  "                if (i === idx) {\n" +
  '                  btn.style.border = "1.5px solid " + farmTypeActive.border;\n' +
  "                  btn.style.background = farmTypeActive.bg;\n" +
  "                  btn.style.color = farmTypeActive.color;\n" +
  "                } else {\n" +
  '                  btn.style.border = "1.5px solid rgba(255,255,255,0.08)";\n' +
  '                  btn.style.background = "rgba(255,255,255,0.03)";\n' +
  '                  btn.style.color = "#666";\n' +
  "                }\n" +
  "              });\n" +
  "            }",
  '            const farmTypeBtns = doc.querySelectorAll(".farm-type-btn");\n' +
  "            function _applyFarmType(idx) {\n" +
  "              Settings_default._botFarmType = idx;\n" +
  "              if (ftSel) ftSel.value = idx;\n" +
  '              farmTypeBtns.forEach((btn, i) => btn.classList.toggle("seg-active", i === idx));\n' +
  "            }",
  "farm type active state"
);

/* ------------------------------------------------------------------
   7. formation picker — its stylesheet now lives in the main sheet
   ------------------------------------------------------------------ */

{
  const start = src.indexOf('      if (!doc.getElementById("_formationStyles")) {');
  if (start === -1) throw new Error("anchor not found: formation styles");
  const endMark = "        doc.head.appendChild(st);\n      }\n";
  const end = src.indexOf(endMark, start);
  if (end === -1) throw new Error("anchor not found: formation styles end");
  src = src.slice(0, start) + src.slice(end + endMark.length);
  applied++;
}

/* ------------------------------------------------------------------
   8. bot rows built in script
   ------------------------------------------------------------------ */

replaceOnce(
  '          nameInput && (nameInput.style.border = "1px solid #ff4444");\n' +
  "          setTimeout(() => {\n" +
  '            nameInput && (nameInput.style.border = "1px solid #9090c8");\n' +
  "          }, 1500);",
  '          nameInput && nameInput.classList.add("invalid");\n' +
  "          setTimeout(() => {\n" +
  '            nameInput && nameInput.classList.remove("invalid");\n' +
  "          }, 1500);",
  "bot name validation"
);

replaceOnce(
  '                rowEl.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(144,144,200,0.07);border-radius:8px;border:1px solid #9090c844;";\n' +
  '                rowEl.innerHTML = "";\n' +
  '                const check = this.frame.document.createElement("svg");\n' +
  '                check.setAttribute("xmlns", "http://www.w3.org/2000/svg");\n' +
  '                check.setAttribute("viewBox", "0 0 24 24");\n' +
  '                check.style.cssText = "width:16px;height:16px;flex-shrink:0;fill:#9090c8;";\n' +
  "                check.innerHTML = '<path d=\"M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z\"/>';\n" +
  '                const nameSpan = this.frame.document.createElement("span");\n' +
  '                nameSpan.className = "option-title";\n' +
  '                nameSpan.style.cssText = "flex:1;font-size:1.05em;color:#d8d8f8;font-weight:600;";\n' +
  "                nameSpan.textContent = botName;\n" +
  '                const delBtn = this.frame.document.createElement("button");\n' +
  '                delBtn.style.cssText = "background:transparent;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;";',
  '                rowEl.style.cssText = "";\n' +
  '                rowEl.className = "bot-row connected";\n' +
  '                rowEl.innerHTML = "";\n' +
  '                const check = this.frame.document.createElement("svg");\n' +
  '                check.setAttribute("xmlns", "http://www.w3.org/2000/svg");\n' +
  '                check.setAttribute("viewBox", "0 0 24 24");\n' +
  '                check.setAttribute("class", "bot-row-check");\n' +
  "                check.innerHTML = '<path d=\"M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z\"/>';\n" +
  '                const nameSpan = this.frame.document.createElement("span");\n' +
  '                nameSpan.className = "bot-row-name";\n' +
  "                nameSpan.textContent = botName;\n" +
  '                const delBtn = this.frame.document.createElement("button");\n' +
  '                delBtn.className = "icon-btn danger";\n' +
  '                delBtn.title = "Disconnect bot";',
  "connected bot row"
);

replaceOnce(
  "                delBtn.innerHTML = '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 30 30\" style=\"width:18px;height:18px;fill:#9090c877;\"><path d=\"M 7 4 C 6.744125 4 6.4879687 4.0974687 6.2929688 4.2929688 L 4.2929688 6.2929688 C 3.9019687 6.6839688 3.9019687 7.3170313 4.2929688 7.7070312 L 11.585938 15 L 4.2929688 22.292969 C 3.9019687 22.683969 3.9019687 23.317031 4.2929688 23.707031 L 6.2929688 25.707031 C 6.6839688 26.098031 7.3170313 26.098031 7.7070312 25.707031 L 15 18.414062 L 22.292969 25.707031 C 22.682969 26.098031 23.317031 26.098031 23.707031 25.707031 L 25.707031 23.707031 C 26.098031 23.316031 26.098031 22.682969 25.707031 22.292969 L 18.414062 15 L 25.707031 7.7070312 C 26.098031 7.3170312 26.098031 6.6829688 25.707031 6.2929688 L 23.707031 4.2929688 C 23.316031 3.9019687 22.682969 3.9019687 22.292969 4.2929688 L 15 11.585938 L 7.7070312 4.2929688 C 7.5115312 4.0974687 7.255875 4 7 4 z\"/></svg>';\n" +
  "                delBtn.onmouseenter = () => {\n" +
  '                  delBtn.querySelector("svg").style.fill = "#cc5151";\n' +
  "                };\n" +
  "                delBtn.onmouseleave = () => {\n" +
  '                  delBtn.querySelector("svg").style.fill = "#9090c877";\n' +
  "                };\n" +
  "                delBtn.onclick = () => {",
  '                delBtn.textContent = "\\u2715";\n' +
  "                delBtn.onclick = () => {",
  "connected bot delete button"
);

replaceOnce(
  '        row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(201,162,39,0.05);border-radius:8px;border:1px solid #9090c833;";\n' +
  '        const label = doc.createElement("span");\n' +
  '        label.className = "option-title";\n' +
  '        label.style.cssText = "min-width:80px;font-size:1.1em;color:#7070a8;";\n' +
  "        label.textContent = `Bot ${botCount} Name`;\n" +
  '        const inp = doc.createElement("input");\n' +
  "        inp.id = inputId;\n" +
  '        inp.type = "text";\n' +
  '        inp.placeholder = "e.g. Ryn " + (30 + botCount);\n' +
  "        inp.maxLength = 15;\n" +
  '        inp.style.cssText = "background:transparent;border:1px solid #9090c8;border-radius:4px;color:#d8d8f8;padding:5px 8px;font-size:13px;outline:none;flex:1;min-width:0;";',
  '        row.className = "bot-row";\n' +
  '        const label = doc.createElement("span");\n' +
  '        label.className = "bot-row-label";\n' +
  "        label.textContent = `Bot ${botCount}`;\n" +
  '        const inp = doc.createElement("input");\n' +
  "        inp.id = inputId;\n" +
  '        inp.type = "text";\n' +
  '        inp.className = "input";\n' +
  '        inp.placeholder = "e.g. Ryn " + (30 + botCount);\n' +
  "        inp.maxLength = 15;",
  "dynamic bot row"
);

replaceOnce(
  '        const diceBtn = doc.createElement("button");\n' +
  '        diceBtn.type = "button";\n' +
  '        diceBtn.title = "Random name (1-7 chars)";\n' +
  '        diceBtn.style.cssText = "background:rgba(122,66,244,0.12);border:1.5px solid rgba(122,66,244,0.4);color:#c8b8ff;border-radius:6px;padding:6px 9px;cursor:pointer;font-size:1em;line-height:1;flex-shrink:0;transition:all 150ms;";\n' +
  '        diceBtn.textContent = "🎲";\n' +
  "        diceBtn.onmouseenter = () => {\n" +
  '          diceBtn.style.background = "rgba(122,66,244,0.22)";\n' +
  "        };\n" +
  "        diceBtn.onmouseleave = () => {\n" +
  '          diceBtn.style.background = "rgba(122,66,244,0.12)";\n' +
  "        };\n" +
  "        diceBtn.onclick = () => {\n" +
  "          inp.value = this._generateRandomBotName();\n" +
  "        };\n" +
  '        const connectBtn = doc.createElement("button");\n' +
  "        connectBtn.id = btnId;\n" +
  '        connectBtn.className = "option-button";\n' +
  '        connectBtn.style.cssText = "padding:8px 18px;font-size:1em;white-space:nowrap;";\n' +
  "        connectBtn.textContent = `Connect Bot ${botCount}`;\n" +
  '        const delBtn = doc.createElement("button");\n' +
  '        delBtn.style.cssText = "background:#853838;border:2px solid #6f2f2f;color:#c07878;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:0.9em;font-weight:800;";\n' +
  '        delBtn.textContent = "✕";',
  '        const diceBtn = doc.createElement("button");\n' +
  '        diceBtn.type = "button";\n' +
  '        diceBtn.title = "Random name (1-7 chars)";\n' +
  '        diceBtn.className = "icon-btn";\n' +
  '        diceBtn.textContent = "\\u2684";\n' +
  "        diceBtn.onclick = () => {\n" +
  "          inp.value = this._generateRandomBotName();\n" +
  "        };\n" +
  '        const connectBtn = doc.createElement("button");\n' +
  "        connectBtn.id = btnId;\n" +
  '        connectBtn.className = "option-button primary";\n' +
  '        connectBtn.textContent = "Connect";\n' +
  '        const delBtn = doc.createElement("button");\n' +
  '        delBtn.className = "icon-btn danger";\n' +
  '        delBtn.title = "Remove row";\n' +
  '        delBtn.textContent = "\\u2715";',
  "dynamic bot row buttons"
);

// the fleet list sits at the top of the page now, so bring the new row into
// view instead of throwing the whole page to the bottom
replaceOnce(
  "      botContainer.appendChild(div.firstElementChild);\n" +
  "      pageContainer.scrollTop = pageContainer.scrollHeight;",
  "      const botRow = div.firstElementChild;\n" +
  "      botContainer.appendChild(botRow);\n" +
  "      if (pageContainer) {\n" +
  "        try {\n" +
  '          botRow.scrollIntoView({ block: "nearest", behavior: "smooth" });\n' +
  "        } catch (_) {}\n" +
  "      }",
  "connected bot scroll"
);

replaceOnce(
  "        dynamicList.appendChild(row);\n" +
  "        const withDelay = !isFirst;\n" +
  "        this.handleBotCreation(connectBtn, inputId, withDelay, rowId);\n" +
  '        const pageContainer = doc.querySelector("#page-container");\n' +
  "        if (pageContainer) pageContainer.scrollTop = pageContainer.scrollHeight;",
  "        dynamicList.appendChild(row);\n" +
  "        const withDelay = !isFirst;\n" +
  "        this.handleBotCreation(connectBtn, inputId, withDelay, rowId);\n" +
  "        try {\n" +
  '          row.scrollIntoView({ block: "nearest", behavior: "smooth" });\n' +
  "        } catch (_) {}\n" +
  "        inp.focus();",
  "new bot row scroll"
);

/* ------------------------------------------------------------------
   9. auto chat rows
   ------------------------------------------------------------------ */

replaceAll(
  '        del.className = "option-button red";\n' +
  '        del.style.cssText = "padding:4px 12px;font-size:1em;";',
  '        del.className = "icon-btn danger";',
  "auto chat delete button",
  2
);

replaceOnce('        del.textContent = "X";', '        del.textContent = "\\u2715";', "bot chat delete glyph");

replaceAll(
  '        row.className = "content-option";\n' +
  '        row.style.gap = "8px";',
  '        row.className = "content-option chat-row";\n' +
  '        row.style.gap = "10px";',
  "auto chat row",
  2
);

replaceAll(
  '        inp.style.width = "190px";',
  '        inp.style.flex = "1";\n        inp.style.width = "auto";',
  "auto chat input width",
  2
);

/* ------------------------------------------------------------------
   10. music surfaces that were styled from script
   ------------------------------------------------------------------ */

replaceOnce(
  '        const empty = this._frameDoc.createElement("div");\n' +
  '        empty.style.cssText = "text-align:center;font-size:0.75em;color:#7A42F433;padding:14px 0;font-family:Orbitron,monospace;letter-spacing:0.08em;";\n' +
  '        empty.textContent = filterVal === "__liked" ? "— NO LIKED SONGS —" : "— EMPTY —";',
  '        const empty = this._frameDoc.createElement("div");\n' +
  '        empty.className = "rm-empty";\n' +
  '        empty.textContent = filterVal === "__liked" ? "No liked songs yet" : "Library is empty";',
  "music empty state"
);

replaceOnce(
  '<span style="color:rgba(122,66,244,0.38);font-size:0.8em;">♪</span>',
  '<span style="color:var(--sky);font-size:0.85em;">♪</span>',
  "music lyric marker"
);

replaceOnce(
  "        syncBotBtn.textContent = this._syncBot ? \"ON\" : \"OFF\";\n" +
  '        syncBotBtn.style.background = this._syncBot ? "#2a1f00" : "#0d0a14";\n' +
  '        syncBotBtn.style.borderColor = this._syncBot ? "#9090c8" : "#9090c844";\n' +
  '        syncBotBtn.style.color = this._syncBot ? "#e8e8ff" : "#9090c8";\n' +
  '        syncBotBtn.style.boxShadow = this._syncBot ? "0 0 10px #9090c844" : "none";',
  '        syncBotBtn.textContent = this._syncBot ? "ON" : "OFF";\n' +
  '        syncBotBtn.classList.toggle("primary", this._syncBot);',
  "music sync bot button"
);

replaceOnce(
  "        if (sendAllLyricsBtn) {\n" +
  '          sendAllLyricsBtn.textContent = "♬ Send All Lyrics: OFF";\n' +
  '          sendAllLyricsBtn.style.color = "#9090c8";\n' +
  '          sendAllLyricsBtn.style.borderColor = "#9090c866";\n' +
  '          sendAllLyricsBtn.style.background = "#0d0a14";',
  "        if (sendAllLyricsBtn) {\n" +
  '          sendAllLyricsBtn.textContent = "\\u266C Send All Lyrics: OFF";\n' +
  '          sendAllLyricsBtn.classList.remove("primary");',
  "send all lyrics off state (stop)"
);

replaceOnce(
  "          if (sendAllLyricsBtn) {\n" +
  '            sendAllLyricsBtn.textContent = "♬ Send All Lyrics: OFF";\n' +
  '            sendAllLyricsBtn.style.color = "#9090c8";\n' +
  '            sendAllLyricsBtn.style.borderColor = "#9090c866";\n' +
  '            sendAllLyricsBtn.style.background = "#0d0a14";',
  "          if (sendAllLyricsBtn) {\n" +
  '            sendAllLyricsBtn.textContent = "\\u266C Send All Lyrics: OFF";\n' +
  '            sendAllLyricsBtn.classList.remove("primary");',
  "send all lyrics off state (no lyrics)"
);

replaceOnce(
  '            sendAllLyricsBtn.textContent = "♬ Send All Lyrics: ON";\n' +
  '            sendAllLyricsBtn.style.color = "#e8e8ff";\n' +
  '            sendAllLyricsBtn.style.borderColor = "#9090c8";\n' +
  '            sendAllLyricsBtn.style.background = "#2a1f00";',
  '            sendAllLyricsBtn.textContent = "\\u266C Send All Lyrics: ON";\n' +
  '            sendAllLyricsBtn.classList.add("primary");',
  "send all lyrics on state"
);

// only inside MusicPlayer — these hexes also appear in canvas drawing code,
// where a CSS custom property would not resolve
replaceAllWithin(
  "  const MusicPlayer = new class {",
  "  let fKeyHeld = false, fKeyInterval = null;",
  '"#9090c8"',
  '"var(--sage)"',
  "music status ok colour"
);
replaceAllWithin(
  "  const MusicPlayer = new class {",
  "  let fKeyHeld = false, fKeyInterval = null;",
  '"#cc5151"',
  '"var(--rose)"',
  "music status error colour"
);

/* ------------------------------------------------------------------
   11. search result flash
   ------------------------------------------------------------------ */

replaceAll(
  'item.opt.style.background = "rgba(122,66,244,0.18)";',
  'item.opt.style.background = "rgba(142,118,206,0.20)";',
  "search flash colour"
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(target, src);
console.log(`ryn-ui: ${applied} edits applied to ${path.relative(process.cwd(), target)}`);
