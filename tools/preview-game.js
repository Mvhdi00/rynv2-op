#!/usr/bin/env node
/* Mock up the parts of the game page RYN restyles — lobby card, vitals HUD,
 * session stats, hat picker — so the in-game layer can be eyeballed too. */
"use strict";

const fs = require("fs");
const path = require("path");

const file = process.argv[2] || path.resolve(__dirname, "..", "Ryn_Type_2.user.js");
const out = path.resolve(__dirname, "..", "ui", "preview-game.html");
const lines = fs.readFileSync(file, "utf8").split("\n");

const template = name => {
  const marker = `  const ${name}_default = `;
  const hit = lines.find(l => l.startsWith(marker));
  if (!hit) throw new Error(`missing ${name}_default`);
  return JSON.parse(hit.slice(marker.length).replace(/;\s*$/, ""));
};

/* the lobby sheet lives inside injectStyles(), between two known markers */
const src = lines.join("\n");
const a = src.indexOf("rynCSS.textContent = `");
const b = src.indexOf("`;", a);
if (a === -1 || b === -1) throw new Error("lobby stylesheet not found");
const lobby = src.slice(a + "rynCSS.textContent = `".length, b);

const skins = ["#bf8f54", "#cbb091", "#8d6b3f", "#a05235", "#4c4a4b", "#8b5cf6", "#e5384a", "#f2f2f6"];

const doc = `<!DOCTYPE html>
<meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:#1e3d29;font-family:system-ui,sans-serif;}
  #wrap{position:relative;height:100%;}
  .menuCard{position:absolute;}
  #setupCard{left:50%;top:50%;transform:translate(-50%,-50%);}
  #gameUI{position:absolute;inset:0;pointer-events:none;}
</style>
<style>${template("Game")}</style>
<style>${template("Store")}</style>
<style>${lobby}</style>
<div id="wrap">
  <div id="setupCard" class="menuCard">
    <input id="nameInput" type="text" maxlength="15" placeholder="Enter name...">
    <div id="serverBrowser">
      <select size="5">
        <option disabled>Europe</option>
        <option selected>eu:0 — 34/50</option>
        <option>eu:1 — 12/50</option>
        <option disabled>America</option>
        <option>us:0 — 48/50</option>
      </select>
    </div>
    <div id="nativeCheckHolder" class="settingRadio"><input type="checkbox" checked>Native resolution</div>
    <button id="enterGame">Play</button>
    <a href="#">Discord</a>
  </div>

  <div id="gameUI">
    <div id="rynStats">
      <span><i>Players</i><b>34</b></span>
      <span><i>Bots</i><b>4/4</b></span>
      <span><i>Ping</i><b><span>28</span>ms</b></span>
      <span><i>FPS</i><b>144</b></span>
      <span><i>Packets</i><b>61</b></span>
      <span><i>Fast Q</i><b>true</b></span>
    </div>
    <div id="ryn-store-container">
      <div id="ryn-store-toggle">Hats</div>
      <div id="ryn-store-items">
        <div class="storeItemContainer"><div class="storeHat"></div><span class="storeItemName">Bull Helmet</span><div class="equipButton">Equip</div></div>
        <div class="storeItemContainer"><div class="storeHat"></div><span class="storeItemName">Soldier Helmet</span><div class="equipButton">Unequip</div></div>
        <div class="storeItemContainer"><div class="storeHat"></div><span class="storeItemName">Emp Helmet</span><div class="equipButton">Buy</div></div>
        <div class="storeItemContainer"><div class="storeHat"></div><span class="storeItemName">Booster Hat</span><div class="equipButton">Equip</div></div>
      </div>
    </div>
  </div>

  <div class="ryn-v2-wrapper"><img class="ryn-v2-avatar" alt=""><div class="ryn-v2-badge">Ryn 5</div></div>
</div>
<script>
  var holder = document.createElement("div");
  holder.id = "ryn-skin-holder";
  ${JSON.stringify(skins)}.forEach(function (c, i) {
    var d = document.createElement("div");
    d.className = "skinColorItem" + (i === 5 ? " activeSkin" : "");
    d.style.backgroundColor = c;
    holder.appendChild(d);
  });
  document.getElementById("setupCard").appendChild(holder);

  var hud = document.createElement("div");
  hud.id = "ryn-topright-hud";
  hud.innerHTML = '<div class="ryn-hud-row"><span class="ryn-hud-label">HP</span><div class="ryn-hud-bar-bg"><div id="ryn-hud-hp-fill" class="ryn-hud-bar-fill ok"></div></div><span id="ryn-hud-hp-val" class="ryn-hud-val">100</span></div>' +
    '<div class="ryn-hud-row" id="ryn-hud-r1-row"><span class="ryn-hud-label">Rel</span><div class="ryn-hud-bar-bg"><div id="ryn-hud-r1-fill" class="ryn-hud-bar-fill"></div></div><span id="ryn-hud-r1-val" class="ryn-hud-val">64%</span></div>';
  document.getElementById("gameUI").appendChild(hud);
  document.getElementById("ryn-hud-hp-fill").style.transform = "scaleX(0.72)";
  document.getElementById("ryn-hud-r1-fill").style.transform = "scaleX(0.64)";
</script>
`;

fs.writeFileSync(out, doc);
console.log(`preview-game: wrote ${path.relative(process.cwd(), out)}`);
