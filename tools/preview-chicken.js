#!/usr/bin/env node
/**
 * Builds a standalone HTML preview of the themed chicken menu, so the design
 * can be looked at instead of shipped blind.
 *
 * Usage: node tools/preview-chicken.js <out.html>
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'chicken-preview.html');

const lines = fs.readFileSync(path.join(ROOT, 'Chicken.user.js'), 'utf8').split('\n');

// the two template literals the client builds the menu from, verbatim
function template(startsWith) {
  const i = lines.findIndex(l => l.trim().startsWith(startsWith));
  if (i < 0) throw new Error('not found: ' + startsWith);
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^\s*`;\s*$/.test(lines[j])) break;
    out.push(lines[j]);
  }
  return out.join('\n');
}

const shell = template('this.menuElement.innerHTML = `');
const items = template('this.mainMenuItemHolder.innerHTML = `')
  .replace(/\$\{isSandbox \? "" : "selected"\}/g, 'selected')
  .replace(/\$\{isSandbox \? "selected" : ""\}/g, '')
  .replace(/\$\{getSavedVal\("moo_discord_username"\) \|\| "unknown user"\}/g, 'unknown user');

// the theme module, evaluated without touching a real DOM
const themeSrc = fs.readFileSync(path.join(ROOT, 'tools', 'chicken-theme.js'), 'utf8');
const win = {};
new Function('window', themeSrc)(win);
const { css, sky } = win.CHICKEN_COSMOS;

const page = `<!doctype html>
<html><head><meta charset="utf-8">
<title>chicken menu preview</title>
<link href="https://fonts.googleapis.com/css?family=Hammersmith+One" rel="stylesheet">
<style>
  html,body { margin:0; height:100%; font-family:"Hammersmith One",system-ui,sans-serif; }
  /* what the client's own code sets on these */
  #mainMenu { position:fixed; inset:0; }
  #ckMenu   { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
              width:760px; height:380px; }
  #gameName { top:70px !important; }
  #loadingText { display:none; }
</style>
<style>${css}</style>
</head><body>
<div id="mainMenu">
  <div id="ck-sky" class="ck-sky-box">${sky}</div>
  <div id="ckMenu">${shell}</div>
</div>
<script>
  document.getElementById('mainMenuItemHolder').innerHTML = ${JSON.stringify(items)};
  // the client paints eleven skin swatches in here at runtime
  var holder = document.getElementById('playerSkinHolder');
  ['#bf8f54','#cbb091','#896c4b','#fadadc','#ececec','#c37373','#4c4c4c','#ecaff7','#738cc3','#8bc373','#91b2db']
    .forEach(function (c) {
      var d = document.createElement('div');
      d.style.cssText = 'width:25px;height:25px;margin:0 3px;cursor:pointer;background-color:' + c;
      holder.appendChild(d);
    });
<\/script>
</body></html>`;

fs.writeFileSync(OUT, page);
console.log('wrote', OUT, '(' + page.length + ' bytes)');
