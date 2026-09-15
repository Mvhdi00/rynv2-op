const { blockAt, methodOf, SRC } = require(require('path').join(__dirname,'extract-block.js'));
let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); } };

const DRV = JSON.parse(require('fs').readFileSync('/home/user/rynv2-op/drivers/game-drivers.json', 'utf8'));
const cfg = DRV.config, ITEMS = DRV.items;
const PLAYER_SCALE = cfg.playerScale;

// shared scope the extracted blocks expect
const hyp = (a, b) => Math.hypot(a, b);
const Config_default = cfg;
const RPE_EPS = 1e-6, RPE_TAU = Math.PI * 2;
const LUNA_ANGLE_RESOLUTIONS = [36, 72, 144, 200];
const LUNA_ANGLE_STEPS_DEFAULT = 200;
let Settings_default = { _autoplacerResolution: 200 };
const RPE_MAX_BLOCK_RADIUS = 300;

const GeometrySolver = eval('(' + blockAt('  const GeometrySolver').replace(/^\s*const GeometrySolver\s*=\s*/, '').replace(/;\s*$/, '') + ')');
const RingScan = eval('(' + blockAt('  const RingScan').replace(/^\s*const RingScan\s*=\s*/, '').replace(/;\s*$/, '') + ')');

// ── F. aperture geometry vs the game's own checkItemLocation ───────────────
console.log('\n== F. apertures vs game checkItemLocation ==');
{
  // A verbatim transcription of the server rule (src/game_index.js):
  //   for each active object: T = obj.blocker ? obj.blocker : obj.getScale(.6, obj.isItem)
  //   blocked if getDistance(x,y,obj.x,obj.y) < itemScale + T
  //   plus: not in the river band unless indx == 18
  function gameCheckItemLocation(x, y, itemScale, indx, objects) {
    for (const o of objects) {
      const T = o.blocker ? o.blocker : o.scale;   // placed items: getScale(.6,true) === scale
      if (Math.hypot(x - o.x, y - o.y) < itemScale + T) return false;
    }
    if (indx !== 18) {
      const lo = cfg.mapScale / 2 - cfg.riverWidth / 2, hi = cfg.mapScale / 2 + cfg.riverWidth / 2;
      if (y >= lo && y <= hi) return false;
    }
    return true;
  }

  // deterministic PRNG so a failure is reproducible
  let seed = 1234567;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  const spike = ITEMS[6];
  const ringR = PLAYER_SCALE + spike.scale + spike.placeOffset;  // 79
  const footR = spike.scale;                                     // 49

  let boards = 0, samples = 0, mismatches = 0, worst = null;
  for (let b = 0; b < 400; b++) {
    // origin sometimes near the river so the band arcs are exercised
    const ox = 2000 + rnd() * 10000;
    const oy = b % 4 === 0 ? cfg.mapScale / 2 + (rnd() - 0.5) * 600 : 2000 + rnd() * 10000;
    const objs = [];
    const n = 1 + Math.floor(rnd() * 9);
    for (let i = 0; i < n; i++) {
      const ang = rnd() * RPE_TAU;
      const dist = 20 + rnd() * 200;
      const kind = rnd();
      objs.push({
        x: ox + Math.cos(ang) * dist,
        y: oy + Math.sin(ang) * dist,
        scale: kind < 0.12 ? 45 : (kind < 0.5 ? 49 : 50),
        blocker: kind < 0.12 ? 300 : undefined
      });
    }
    // the engine's analytic solve
    const blocked = [];
    for (const o of objs) {
      const arc = GeometrySolver.occlusion(ox, oy, ringR, footR, o.x, o.y, o.blocker ? o.blocker : o.scale);
      if (arc) blocked.push(arc);
    }
    for (const arc of GeometrySolver.riverOcclusion(oy, ringR)) blocked.push(arc);
    const free = GeometrySolver.invert(GeometrySolver.merge(blocked));

    boards++;
    for (let k = 0; k < 720; k++) {
      const a = k * RPE_TAU / 720;
      const px = ox + ringR * Math.cos(a), py = oy + ringR * Math.sin(a);
      const gameSays = gameCheckItemLocation(px, py, footR, spike.id, objs);
      const engineSays = GeometrySolver.inAperture(free, a) !== null;
      samples++;
      if (gameSays !== engineSays) {
        // an exact-boundary sample can legitimately disagree by a float hair;
        // only count it if it is not on an edge
        let onEdge = false;
        for (const o of objs) {
          const d = Math.hypot(px - o.x, py - o.y) - (footR + (o.blocker ? o.blocker : o.scale));
          if (Math.abs(d) < 1e-3) onEdge = true;
        }
        const lo = cfg.mapScale / 2 - cfg.riverWidth / 2, hi = cfg.mapScale / 2 + cfg.riverWidth / 2;
        if (Math.abs(py - lo) < 1e-3 || Math.abs(py - hi) < 1e-3) onEdge = true;
        if (!onEdge) { mismatches++; if (!worst) worst = { ox, oy, a, gameSays, engineSays, objs }; }
      }
    }
  }
  ok(`analytic apertures agree with the game rule over ${boards} boards / ${samples} samples`,
     mismatches === 0, mismatches + ' mismatches, first=' + JSON.stringify(worst && { a: worst.a, game: worst.gameSays, engine: worst.engineSays }));
}

// ── G. ring resolution: what the extra 56 samples actually buy ─────────────
console.log('\n== G. ring resolution 144 vs 200 ==');
{
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  ok('144 and 200 share exactly 8 samples', gcd(144, 200) === 8);

  const t144 = RingScan.table(144), t200 = RingScan.table(200);
  ok('tables are the uniform lattice', Math.abs(t200.angle[1] - RPE_TAU / 200) < 1e-12);

  // every 144-interval receives at least one new interior sample
  const step144 = RPE_TAU / 144;
  const counts = new Array(144).fill(0);
  const shared = new Set();
  for (let i = 0; i < 200; i++) {
    const a = t200.angle[i];
    const idx = Math.floor(a / step144 + 1e-12);
    const onLattice = Math.abs(a / step144 - Math.round(a / step144)) < 1e-9;
    if (onLattice) shared.add(Math.round(a / step144) % 144);
    else counts[idx % 144]++;
  }
  ok('the 8 shared samples are the ones 45 deg apart', shared.size === 8 && [...shared].every(i => i % 18 === 0), [...shared].join(','));
  ok('every one of the 144 intervals is subdivided', counts.every(c => c >= 1), counts.filter(c => c === 0).length + ' empty');
  const ones = counts.filter(c => c === 1).length, twos = counts.filter(c => c === 2).length;
  ok('96 intervals gain one sample and 48 gain two', ones === 96 && twos === 48, ones + '/' + twos);

  // minimum separation is the step itself -- no near-duplicates
  const spikeRing = PLAYER_SCALE + ITEMS[6].scale + ITEMS[6].placeOffset;
  const arc200 = spikeRing * RPE_TAU / 200, arc144 = spikeRing * RPE_TAU / 144;
  ok('arc between neighbours at the spike ring: 2.48u at 200 vs 3.45u at 144',
     Math.abs(arc200 - 2.482) < 0.01 && Math.abs(arc144 - 3.447) < 0.01, arc200.toFixed(3) + '/' + arc144.toFixed(3));
  ok('worst-case aim error drops 28%', Math.abs((arc200 / arc144) - 0.72) < 0.01, (arc200/arc144).toFixed(3));

  // resolve() honours the setting and snaps down between rungs
  for (const [want, expect] of [[36,36],[71,36],[72,72],[143,72],[144,144],[199,144],[200,200],[999,200]]) {
    Settings_default._autoplacerResolution = want;
    const got = RingScan.resolve();
    if (got !== expect) { ok(`resolve(${want}) -> ${expect}`, false, 'got ' + got); }
  }
  Settings_default._autoplacerResolution = 144;
  ok('144 mode is selectable and exact', RingScan.resolve() === 144);
  Settings_default._autoplacerResolution = 200;
  ok('200 mode is selectable and exact', RingScan.resolve() === 200);
  ok('the table is built once and cached', RingScan.table(200) === t200);
}

// ── H. offer order: contact beats mere nearness ───────────────────────────
console.log('\n== H. auto place offer order ==');
{
  const m = SRC.match(/const offerKey = a => \{[\s\S]*?\n        \};/);
  ok('offerKey extracted from source', !!m);
  const enemyScale = PLAYER_SCALE;
  const enemyFut = { x: 0, y: 0 };
  const named = new Set();
  const offerKey = eval('(function(){ const named = arguments[0], enemyFut = arguments[1], enemyScale = arguments[2];' +
                        m[0].replace(/^const offerKey = /, 'return ') + '})')(named, enemyFut, enemyScale);

  const spikeScale = ITEMS[6].scale;                 // 49
  const contact = enemyScale + spikeScale;           // 84, the game's own radius
  const touching = { x: contact - 2, y: 0, scale: spikeScale };
  const nearMiss = { x: contact + 2, y: 0, scale: spikeScale };
  const farther  = { x: contact + 40, y: 0, scale: spikeScale };
  ok('a spike that reaches the enemy outranks one two units short',
     offerKey(touching) < offerKey(nearMiss));
  ok('a near miss still outranks a far one', offerKey(nearMiss) < offerKey(farther));
  named.add(farther);
  ok('a named pick outranks everything, however far', offerKey(farther) < offerKey(touching));
  named.delete(farther);
  const alsoTouching = { x: contact - 30, y: 0, scale: spikeScale };
  ok('among builds that all reach, the nearest wins', offerKey(alsoTouching) < offerKey(touching));
  // tier 0 = named (< 1e9), tier 1 = reaches (< 2e9), tier 2 = does not
  ok('the tier boundary is the game contact radius exactly, and inclusive',
     offerKey({ x: contact, y: 0, scale: spikeScale }) < 2e9 &&
     offerKey({ x: contact + 1e-4, y: 0, scale: spikeScale }) >= 2e9,
     offerKey({ x: contact, y: 0, scale: spikeScale }) + ' / ' + offerKey({ x: contact + 1e-4, y: 0, scale: spikeScale }));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
