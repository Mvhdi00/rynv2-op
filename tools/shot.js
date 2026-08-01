#!/usr/bin/env node
/** Screenshot an HTML file. Usage: node tools/shot.js <page.html> <out.png> [w] [h] */
const { chromium } = require('playwright');
(async () => {
  const [, , page, out, w = '1120', h = '780'] = process.argv;
  // this environment ships Chromium already; point at it rather than letting
  // playwright try to download a build that matches its own version
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const p = await browser.newPage({
    viewport: { width: +w, height: +h },
    deviceScaleFactor: 2,
  });
  await p.goto('file://' + require('path').resolve(page));
  await p.waitForTimeout(1500);          // let the entry animation settle
  await p.screenshot({ path: out });
  await browser.close();
  console.log('wrote', out);
})();
