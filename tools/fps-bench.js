#!/usr/bin/env node
// Measures what "Full FPS" actually changes: how often the loop runs under
// requestAnimationFrame vs a MessageChannel, and -- the part that matters --
// how many frames the compositor actually presents while it does.
//
//   node tools/fps-bench.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.setContent('<canvas id="c" width="400" height="300"></canvas>');
  const r = await p.evaluate(async () => {
    const ctx = document.getElementById('c').getContext('2d');
    function bench(schedule, ms) {
      return new Promise(res => {
        let n = 0; const t0 = performance.now();
        function loop() {
          n++;
          // a token draw, so this is not an empty loop
          ctx.fillStyle = '#123'; ctx.fillRect(0, 0, 400, 300);
          if (performance.now() - t0 < ms) schedule(loop); else res(n / ((performance.now() - t0) / 1000));
        }
        schedule(loop);
      });
    }
    const raf = await bench(cb => requestAnimationFrame(cb), 1000);
    const ch = new MessageChannel();
    let cur = null;
    ch.port1.onmessage = () => cur && cur();
    const mc = await bench(cb => { cur = cb; ch.port2.postMessage(''); }, 1000);
    // how many times the compositor actually presented a frame during the MC run
    let presented = 0;
    const t0 = performance.now();
    (function count() { presented++; if (performance.now() - t0 < 1000) requestAnimationFrame(count); })();
    const cur2 = cur;
    await new Promise(r2 => setTimeout(r2, 1100));
    return { rafLoopsPerSec: Math.round(raf), messageChannelLoopsPerSec: Math.round(mc), framesActuallyPresented: presented };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
