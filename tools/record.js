#!/usr/bin/env node
/**
 * Records the themed menu so the motion can actually be seen: writes an
 * animated GIF and reports how many pixels change between frames -- a static
 * background would show 0.
 *
 * Usage: node tools/record.js <page.html> <outdir> [seconds] [fps]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PNG } = require('pngjs');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const W = 620, H = 430;

(async () => {
  const [, , page, outDir, secs = '8', fps = '10'] = process.argv;
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + path.resolve(page));
  await p.waitForTimeout(1200);           // let the entry animation settle

  const delay = Math.round(1000 / +fps);
  const count = Math.round(+secs * +fps);
  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push(await p.screenshot({ type: 'png' }));
    await p.waitForTimeout(delay);
  }
  await browser.close();

  // report motion by counting changed pixels, so "it moves" is measured
  const decoded = frames.map(b => PNG.sync.read(b));
  for (let i = 1; i < Math.min(decoded.length, 5); i++) {
    const a = decoded[i - 1].data, b = decoded[i].data;
    let changed = 0;
    for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2]) changed++;
    const pct = (changed / (a.length / 4) * 100).toFixed(2);
    console.log(`frame${i - 1} -> frame${i}: ${changed} px changed (${pct}%)`);
  }

  const gif = GIFEncoder();
  for (const png of decoded) {
    const data = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, W, H, { palette, delay });
  }
  gif.finish();
  const out = path.join(outDir, 'menu.gif');
  fs.writeFileSync(out, Buffer.from(gif.bytes()));
  console.log('wrote', out, '(' + fs.statSync(out).size + ' bytes,', decoded.length, 'frames)');
})();
