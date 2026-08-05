#!/usr/bin/env node
// What does the player glow actually cost? Draws the same shapes the mod draws
// -- a body circle plus two hands per player -- with and without the shadowBlur
// and canvas filter it wraps them in, and times both in a real browser.
//
//   node tools/glow-bench.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.setContent('<canvas id="c" width="1920" height="1080"></canvas>');

  const rows = await page.evaluate(() => {
    const ctx = document.getElementById('c').getContext('2d');
    const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.stroke(); };

    // one player, the way renderPlayer draws it: body + two hands
    function drawPlayer(x, y, glow) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#bf8f54'; ctx.strokeStyle = '#3d3d3d'; ctx.lineWidth = 5.5;
      if (glow) { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 18;
                  ctx.filter = 'brightness(0.85) saturate(1.1)'; }
      circle(0, 0, 35);
      circle(35 * Math.cos(0.6), 35 * Math.sin(0.6), 14);
      circle(35 * Math.cos(-0.6), 35 * Math.sin(-0.6), 14);
      if (glow) { ctx.filter = 'none'; ctx.shadowBlur = 0; }
      ctx.restore();
    }

    function frame(n, glow) {
      ctx.clearRect(0, 0, 1920, 1080);
      for (let i = 0; i < n; i++) drawPlayer(120 + (i * 137) % 1700, 120 + (i * 91) % 900, glow);
    }

    function timeIt(n, glow) {
      for (let i = 0; i < 5; i++) frame(n, glow);            // warm up
      const t0 = performance.now();
      const N = 30;
      for (let i = 0; i < N; i++) frame(n, glow);
      return (performance.now() - t0) / N;                    // ms per frame
    }

    return [1, 5, 10, 20, 40].map(n => {
      const off = timeIt(n, false), on = timeIt(n, true);
      return { players: n, off: +off.toFixed(2), on: +on.toFixed(2),
               ratio: +(on / off).toFixed(1),
               fpsOn: Math.round(1000 / on), fpsOff: Math.round(1000 / off) };
    });
  });

  console.log('players   glow off      glow on       cost    ceiling off -> on');
  for (const r of rows) {
    console.log(
      String(r.players).padStart(5) + '   ' +
      (r.off + ' ms').padEnd(13) + (r.on + ' ms').padEnd(13) +
      (r.ratio + '×').padEnd(8) +
      r.fpsOff + ' fps -> ' + r.fpsOn + ' fps');
  }
  await browser.close();
})();
