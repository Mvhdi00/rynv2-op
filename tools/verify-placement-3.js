const { blockAt, methodOf, SRC } = require(require('path').join(__dirname,'extract-block.js'));
let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); } };

// ── I. the tick flush ─────────────────────────────────────────────────────
console.log('\n== I. SocketManager tick flush ==');
(async () => {
  const RYN_TICK_FLUSH_HOPS = 4;
  const immSrc = SRC.match(/const _rynImmediate = \(function\(\)\s*\{[\s\S]*?\n  \}\)\(\);/);
  ok('_rynImmediate extracted', !!immSrc);
  const _rynImmediate = eval(immSrc[0].replace(/^const _rynImmediate = /, '') .replace(/;$/, ''));
  ok('MessageChannel path is available in this runtime', _rynImmediate !== null);

  const src = methodOf('  class SocketManager', '_scheduleTickFlush').trim();
  const host = eval('({ packetSeq: 0, ' + src + '})');

  // 1. fires exactly once, after the burst stops
  await new Promise(res => {
    let runs = 0;
    host.packetSeq = 10;
    host._scheduleTickFlush(() => { runs++; });
    // simulate three more frames landing in later task turns
    let n = 0;
    const tick = () => {
      if (n < 3) { host.packetSeq++; n++; setImmediate(tick); }
      else setTimeout(() => {
        ok('flush runs exactly once', runs === 1, 'runs=' + runs);
        ok('flush waited for the burst to stop', n === 3);
        res();
      }, 20);
    };
    setImmediate(tick);
  });

  // 2. the returned handle fires it early and cancels the timer (the "H" path)
  await new Promise(res => {
    let runs = 0;
    const fire = host._scheduleTickFlush(() => { runs++; });
    fire();
    ok('early fire is synchronous', runs === 1, 'runs=' + runs);
    fire();
    ok('early fire is idempotent', runs === 1, 'runs=' + runs);
    setTimeout(() => { ok('the backstop timer does not fire again', runs === 1, 'runs=' + runs); res(); }, 25);
  });

  // 3. a burst that never stops is bounded, not starved
  await new Promise(res => {
    let runs = 0;
    host._scheduleTickFlush(() => { runs++; });
    const iv = setInterval(() => { host.packetSeq++; }, 0);
    setTimeout(() => {
      clearInterval(iv);
      ok('a continuous burst still flushes (bounded hops / timer backstop)', runs === 1, 'runs=' + runs);
      res();
    }, 30);
  });

  // 4. it runs sooner than the 1ms timer it replaced, under a busy main thread
  await new Promise(res => {
    const t0 = process.hrtime.bigint();
    let immediateAt = null, timerAt = null;
    host.packetSeq = 0;
    host._scheduleTickFlush(() => { immediateAt = process.hrtime.bigint(); });
    setTimeout(() => { timerAt = process.hrtime.bigint(); }, 1);
    // occupy the thread the way a canvas frame would
    const spin = Date.now() + 8; while (Date.now() < spin) {}
    setTimeout(() => {
      ok('flush lands no later than a 1ms timer', immediateAt !== null && (timerAt === null || immediateAt <= timerAt),
         'imm=' + immediateAt + ' timer=' + timerAt);
      res();
    }, 30);
  });

  // ── J. blockersAround keeps the blocker without widening every sweep ────
  console.log('\n== J. blockersAround ==');
  {
    const RPE_MAX_BLOCK_RADIUS = 300;
    const hyp = (a, b) => Math.hypot(a, b);
    const src2 = methodOf('  class CandidateGenerator', 'blockersAround').trim();

    const mk = (x, y, scale, isBlocker) => ({
      id: Math.round(x * 1e4 + y), pos: { current: { x, y } },
      scale, placementScale: isBlocker ? 300 : scale, collisionScale: scale
    });
    const objs = [];
    for (let i = 0; i < 30; i++) objs.push(mk(1000 + (i % 6) * 50, 1000 + Math.floor(i / 6) * 50, 49, false));
    const farBlocker = mk(1000 + 380, 1000, 45, true);   // 380 out: far outside the tight sweep

    let queriedCells = null;
    const grid = {
      cellSize: 100,
      query(x, y, search, cb) {
        queriedCells = (2 * search + 1) ** 2;
        for (const o of objs) {
          if (Math.abs(o.pos.current.x - x) <= search * 100 + 100 && Math.abs(o.pos.current.y - y) <= search * 100 + 100) {
            if (cb(o.id)) return true;
          }
        }
        return false;
      }
    };
    const byId = new Map(objs.concat([farBlocker]).map(o => [o.id, o]));
    const client = { ObjectManager: { grid2D: grid, objects: byId, blockers: new Set([farBlocker]) } };
    const gen = eval('({ client: null, ' + src2 + '})');
    gen.client = client;

    const out = gen.blockersAround(1000, 1000, 82, 52);
    ok('the tight sweep is 7x7 cells, not 13x13', queriedCells === 49, 'cells=' + queriedCells);
    ok('a blocker 380 units out is still returned', out.indexOf(farBlocker) !== -1);
    ok('ordinary objects are still returned', out.length >= 30, 'len=' + out.length);
    const dupes = out.length !== new Set(out).size;
    ok('no duplicates when a blocker is also inside the tight sweep', !dupes);

    // a blocker beyond ring+foot+300 is correctly dropped
    client.ObjectManager.blockers = new Set([mk(1000 + 600, 1000, 45, true)]);
    const out2 = gen.blockersAround(1000, 1000, 82, 52);
    ok('a blocker out of reach of the ring is not collected', out2.length === out.length - 1, out2.length + '/' + out.length);

    // with no blockers on the board the set costs nothing
    client.ObjectManager.blockers = new Set();
    const out3 = gen.blockersAround(1000, 1000, 82, 52);
    ok('an empty blocker registry changes nothing', out3.length === out.length - 1);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
