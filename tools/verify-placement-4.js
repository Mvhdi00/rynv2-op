const { blockAt, methodOf } = require(require('path').join(__dirname,'extract-block.js'));
let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); } };

const DRV = JSON.parse(require('fs').readFileSync('/home/user/rynv2-op/drivers/game-drivers.json', 'utf8'));
const ITEMS = DRV.items, cfg = DRV.config;
const RPE_STEAL_HISTORY_TICKS = 14, RPE_STEAL_MAX_TRACKED = 32, RPE_STEAL_MAX_LEAD = 3;
const RPE_STEAL_BOOK_CONFIDENCE = .3, RPE_RETRAP_LEAD = 4;
const StealForecast = eval('(' + blockAt('  class StealForecast').trim() + ')');
const attritionSrc = methodOf('  class RynPlacementEngine', 'attrition').trim();

// ── K. retrap candidate continuity across a real reload cycle ─────────────
console.log('\n== K. attrition() across an enemy reload cycle ==');
function run(useOldReading) {
  const trap = { id: 1, health: ITEMS[15].health, pos: { current: { x: 100, y: 0 } } };
  const forecast = new StealForecast();
  const engine = eval('({ forecast: null, _sweep: null, _imm: null,' +
    ' _attritionSweep(frame){ return this._sweep; },' +
    ' _imminentBreak(){ return this._imm; },' +
    attritionSrc.replace(/^attrition/, 'attrition') + '})');
  engine.forecast = forecast;

  const frame = {
    tick: 0,
    targetTrapped: trap,
    targetPos: { x: 0, y: 0, distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); } }
  };
  // Great hammer: 50 to buildings, ~300ms swing => loaded on 1 tick in 3.
  const HAMMER = 50;
  const produced = [];
  for (let t = 0; t < 30 && trap.health > 0; t++) {
    frame.tick = t;
    const loaded = (t % 3 === 0);
    if (loaded && t > 0) trap.health = Math.max(0, trap.health - HAMMER);
    const legacy = new Map();
    if (loaded) legacy.set(trap, Math.max(1, Math.ceil(trap.health / HAMMER)));
    const damage = new Map([[trap, { potential: HAMMER, ready: loaded ? HAMMER : 0 }]]);
    engine._sweep = useOldReading ? { legacy, damage: new Map() } : { legacy, damage };
    const out = engine.attrition(frame);
    produced.push(out.some(e => e.object === trap && e.retrap));
  }
  return { produced, health: trap.health };
}

const now = run(false);
const before = run(true);   // the old behaviour: legacy only
// only the tail of the run matters -- early on the trap is at full health and
// genuinely too far from breaking for either reading to report it.
const tail = a => a.slice(Math.max(0, a.length - 9));
const nowTail = tail(now.produced), beforeTail = tail(before.produced);
const rate = a => a.filter(Boolean).length / a.length;

console.log('    last 9 ticks before the break:');
console.log('      legacy-only reading : ' + beforeTail.map(v => v ? '#' : '.').join('') + '  (' + (rate(beforeTail) * 100).toFixed(0) + '% of ticks)');
console.log('      full-sweep reading  : ' + nowTail.map(v => v ? '#' : '.').join('') + '  (' + (rate(nowTail) * 100).toFixed(0) + '% of ticks)');

ok('the old reading only saw the trap on the ticks a swing was loaded',
   rate(beforeTail) <= 1 / 2, (rate(beforeTail) * 100).toFixed(0) + '%');
ok('the new reading sees it on every tick inside the window',
   rate(nowTail) === 1, (rate(nowTail) * 100).toFixed(0) + '%');
ok('and it is strictly a superset -- nothing the old reading reported is lost',
   now.produced.every((v, i) => v || !before.produced[i]));

// ── L. the edge detector reaches attrition even when the sweep rejects ────
console.log('\n== L. the break edge detector ==');
{
  const wall = { id: 9, health: 380, pos: { current: { x: 60, y: 0 } } };
  const forecast = new StealForecast();
  const engine = eval('({ forecast: null, _sweep: null, _imm: null,' +
    ' _attritionSweep(frame){ return this._sweep; },' +
    ' _imminentBreak(){ return this._imm; },' + attritionSrc + '})');
  engine.forecast = forecast;
  const frame = { tick: 5, targetTrapped: null, targetPos: { x: 0, y: 0, distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); } } };

  // sweep sees the wall but far from death: 380hp against a 25-damage tool
  engine._sweep = { legacy: new Map(), damage: new Map([[wall, { potential: 25, ready: 0 }]]) };
  engine._imm = null;
  ok('a full wall under a tool hammer produces no candidate', engine.attrition(frame).length === 0);

  // now the detector names it: a weapon just came ready that kills it outright
  engine._imm = wall;
  const out = engine.attrition(frame);
  ok('the edge detector puts it in the list at one hit',
     out.length === 1 && out[0].object === wall && out[0].hits === 1, JSON.stringify(out.map(o => o.hits)));

  // and it is not double-counted when the sweep already reported it
  const doomed = { id: 10, health: 40, pos: { current: { x: 60, y: 0 } } };
  engine._sweep = { legacy: new Map([[doomed, 1]]), damage: new Map([[doomed, { potential: 50, ready: 50 }]]) };
  engine._imm = doomed;
  const out2 = engine.attrition(frame);
  ok('an object the sweep already reported is not added twice',
     out2.filter(e => e.object === doomed).length === 1, JSON.stringify(out2.length));
}

// ── M. the tracking cap is not churned by bystanders ──────────────────────
console.log('\n== M. forecast history stays on what is under attack ==');
{
  const forecast = new StealForecast();
  const engine = eval('({ forecast: null, _sweep: null, _imm: null,' +
    ' _attritionSweep(frame){ return this._sweep; },' +
    ' _imminentBreak(){ return this._imm; },' + attritionSrc + '})');
  engine.forecast = forecast;
  const frame = { tick: 1, targetTrapped: null, targetPos: { x: 0, y: 0, distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); } } };
  const damage = new Map();
  // 40 healthy walls standing in weapon range, plus one that is nearly dead
  for (let i = 0; i < 40; i++) damage.set({ id: 100 + i, health: 900, pos: { current: { x: 60 + i, y: 0 } } }, { potential: 25, ready: 0 });
  const dying = { id: 999, health: 30, pos: { current: { x: 60, y: 0 } } };
  damage.set(dying, { potential: 50, ready: 50 });
  engine._sweep = { legacy: new Map(), damage };
  engine._imm = null;
  const out = engine.attrition(frame);
  ok('only the endangered build is reported', out.length === 1 && out[0].object === dying, 'len=' + out.length);
  ok('and only it opened a history record', forecast.tracks.size === 1, 'tracked=' + forecast.tracks.size);
  ok('so the cap of ' + RPE_STEAL_MAX_TRACKED + ' is nowhere near touched', forecast.tracks.size < RPE_STEAL_MAX_TRACKED);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
