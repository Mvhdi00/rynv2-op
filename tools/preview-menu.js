#!/usr/bin/env node
/**
 * Builds a standalone HTML preview of the themed LemonMod menu, so the design
 * can actually be looked at instead of shipped blind.
 *
 * Usage: node tools/preview-menu.js <out.html>
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'menu-preview.html');

// 1. the menu markup, exactly as the mod builds it
const lines = fs.readFileSync(path.join(ROOT, 'LemonMod.user.js'), 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('.innerHTML = "<div class=\\"circle\\"'));
if (idx < 0) { console.error('could not find the menu markup'); process.exit(1); }
const line = lines[idx];
const expr = line.slice(line.indexOf('innerHTML = ') + 'innerHTML = '.length).replace(/;\s*$/, '');
// the expression interpolates a few of the mod's variables; stub them all
const names = [...new Set((expr.match(/\b(?:_0x[0-9a-f]+|LEMONMOD_0x[0-9a-f]+)\b/g) || []))];
const values = names.map(n => (n === 'LEMONMOD_0x110d60' ? '3.0' : ''));
const html = new Function(...names, 'return ' + expr)(...values);

// 2. the theme CSS, pulled out of the module without running its DOM watcher
const themeSrc = fs.readFileSync(path.join(ROOT, 'tools', 'lemon-theme.js'), 'utf8');
const win = {};
const fakeDoc = {
  addEventListener() {}, getElementById() { return null; },
  documentElement: null, head: { appendChild() {} }, createElement() { return {}; }
};
new Function('window', 'document', 'console', themeSrc.replace(/^\s*watch\(\);\s*$/m, ''))
  (win, fakeDoc, { info() {} });
const css = win.LEMON_COSMOS.css;

// 3. the starfield markup the theme injects at runtime
const sky = '<div class="lc-sky">'
  + '<div class="lc-stars lc-s1"></div><div class="lc-stars lc-s2"></div><div class="lc-stars lc-s3"></div>'
  + '<div class="lc-shoot a"></div><div class="lc-shoot b"></div><div class="lc-shoot c"></div>'
  + '</div>';

const page = `<!doctype html>
<html><head><meta charset="utf-8">
<title>LemonMod menu preview</title>
<style>
  html,body { margin:0; height:100%; background:#04050c; display:grid; place-items:center;
              font-family:"Segoe UI",system-ui,sans-serif; }
</style>
<style>${css}</style>
</head><body>
<div id="mm-menu-container" class="i-container" style="display:block">${sky}${html}</div>
<script>
  // the mod marks the open tab with .is-active; do the same for the preview
  var b = document.getElementById('mm-main-menu-item');
  if (b) b.classList.add('is-active');
  document.querySelectorAll('.i-tab-content').forEach(function (el, i) {
    el.style.display = (el.id === 'mm-main-menu') ? '' : 'none';
  });
<\/script>
</body></html>`;

fs.writeFileSync(OUT, page);
console.log('wrote', OUT, '(' + page.length + ' bytes)');
