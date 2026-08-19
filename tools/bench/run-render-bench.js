// Measures the render passes that Lite Mode turns off, in a real Chromium.
//
//   npm i --no-save playwright-core
//   node tools/bench/run-render-bench.js
//
// NOTE: in a headless container this runs on SwiftShader (software GL), so the
// absolute milliseconds are far worse than any real GPU. Read the ratios, not
// the numbers. Canvas draw calls are deferred, so the harness forces a pipeline
// flush (getImageData of one pixel) inside every timed frame and subtracts the
// cost of that flush — without it the timings measure command submission only
// and come out in the wrong order.
const { chromium } = require('playwright-core')  // or 'playwright';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + __dirname + '/bench.html');
  await p.waitForFunction(() => window.RESULTS);
  const r = await p.evaluate(() => window.RESULTS);
  const row = (a, b2, la, lb) =>
    console.log('  ' + la.padEnd(26) + r[a].toFixed(3).padStart(8) + ' ms   ' +
                lb.padEnd(22) + r[b2].toFixed(3).padStart(8) + ' ms   ' +
                'saves ' + (r[a] - r[b2]).toFixed(3) + ' ms/frame');
  console.log('per-frame cost of each pass (1920x1080 canvas)\n');
  row('vignette_uncached', 'vignette_cached', 'vignette per frame', 'vignette cached');
  row('rings_double', 'rings_single', '40 buildings, 2 strokes', '40 buildings, 1 stroke');
  row('names_with_icons', 'names_no_icons', '15 names + measureText', '15 names, no icons');
  console.log('\nrender scale, same scene (120 objects):');
  for (const [k, s] of [['scene_100','100%'],['scene_70','70%'],['scene_50','50%']])
    console.log('  ' + s.padEnd(6) + r[k].toFixed(3).padStart(8) + ' ms/frame' +
      (k === 'scene_100' ? '' : '   (' + ((1 - r[k]/r.scene_100)*100).toFixed(0) + '% less GPU time)'));
  await b.close();
})();
