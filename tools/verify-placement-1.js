const { blockAt, methodOf } = require(require('path').join(__dirname,'extract-block.js'));

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
};
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps);

// ── Game constants, straight from drivers/game-drivers.json ────────────────
const DRV = JSON.parse(require('fs').readFileSync('/home/user/rynv2-op/drivers/game-drivers.json', 'utf8'));
const cfg = DRV.config;
const ITEMS = DRV.items;
const TICK_MS = 1000 / cfg.serverUpdateRate;
const PLAYER_SCALE = cfg.playerScale;

// The game's own placement / collision rules, transcribed from src/game_index.js:
//   buildItem:        w = player.scale + item.scale + (item.placeOffset||0)
//   checkItemLocation: blocked if dist < item.scale + (obj.blocker ?? obj.getScale(.6, obj.isItem))
//   getScale(t,i):    scale * (isItem||type==2||type==3 ? 1 : .6*t) * (i ? 1 : colDiv)
//   checkCollision:   P = player.scale + obj.getScale();  contact when dist <= P
const gameRingR   = item => PLAYER_SCALE + item.scale + (item.placeOffset || 0);
const gamePlaceR  = item => item.blocker ? item.blocker : item.scale;           // isItem => colDiv not applied
const gameContactR= item => PLAYER_SCALE + item.scale * ('colDiv' in item ? item.colDiv : 1);

const SPIKE = ITEMS[6], GSPIKE = ITEMS[7], TRAP = ITEMS[15], WALL = ITEMS[3], PLATFORM = ITEMS[18];

console.log('\n== A. game-file baselines ==');
ok('spike ring radius is 79',  gameRingR(SPIKE) === 79, gameRingR(SPIKE));
ok('greater spike ring is 82', gameRingR(GSPIKE) === 82, gameRingR(GSPIKE));
ok('trap ring radius is 80',   gameRingR(TRAP) === 80, gameRingR(TRAP));
ok('trap contact radius is 45 (not 50)', gameContactR(TRAP) === 45, gameContactR(TRAP));
ok('spike contact radius is 84', gameContactR(SPIKE) === 84, gameContactR(SPIKE));
ok('greater spike contact is 87', gameContactR(GSPIKE) === 87, gameContactR(GSPIKE));
ok('trap placement radius ignores colDiv (50)', gamePlaceR(TRAP) === 50, gamePlaceR(TRAP));
ok('server tick is 111.11ms', near(TICK_MS, 1000/9, 1e-9));

// ── B. SpatialHashGrid2D: dedup, early-out, re-entrancy, no Set churn ──────
console.log('\n== B. SpatialHashGrid2D ==');
const Grid = eval('(' + blockAt('  class SpatialHashGrid2D').trim() + ')');
{
  const g = new Grid(100);
  // one object spanning many cells => must be handed to the callback once
  g.insert(500, 500, 250, 7);
  let n = 0;
  g.query(500, 500, 3, () => { n++; return false; });
  ok('object spanning many cells visited exactly once', n === 1, 'visits=' + n);

  for (let i = 0; i < 50; i++) g.insert(500 + i, 500, 10, 100 + i);
  let seen = new Set, dup = false;
  g.query(500, 500, 3, id => { if (seen.has(id)) dup = true; seen.add(id); return false; });
  ok('no duplicate ids across 51 objects', !dup && seen.size === 51, 'size=' + seen.size);

  // repeated queries must not leak stamps between calls
  let a = 0, b = 0;
  g.query(500, 500, 3, () => { a++; return false; });
  g.query(500, 500, 3, () => { b++; return false; });
  ok('two consecutive queries see the same set', a === b && a === 51, a + '/' + b);

  // early-out
  let visited = 0;
  const hit = g.query(500, 500, 3, () => { visited++; return true; });
  ok('early-out returns true and stops at 1', hit === true && visited === 1, 'visited=' + visited);

  // re-entrancy: inner query inside a callback must not corrupt the outer walk
  const outer = new Set; let outerDup = false;
  g.query(500, 500, 3, id => {
    if (outer.has(id)) outerDup = true;
    outer.add(id);
    g.query(500, 500, 3, () => false);   // nested full walk
    return false;
  });
  ok('nested query does not corrupt outer dedup', !outerDup && outer.size === 51, 'size=' + outer.size + ' dup=' + outerDup);

  // remove works
  g.remove(500, 500, 250, 7);
  let after = 0;
  g.query(500, 500, 3, () => { after++; return false; });
  ok('removed object no longer visited', after === 50, 'after=' + after);
}

// ── C. rpeTrapHolding against the game rule ───────────────────────────────
console.log('\n== C. rpeTrapHolding (trap state) ==');
{
  const Config_default = cfg;
  const fn = eval('(' + blockAt('  function rpeTrapHolding').trim().replace(/^function /, 'function ') + ')');
  const mkTrap = (x, y, id) => ({
    id, scale: TRAP.scale, collisionScale: TRAP.scale * TRAP.colDiv,
    pos: { current: { x, y, distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); } } }
  });
  const mkEnemy = (x, y, extra) => Object.assign({
    collisionScale: PLAYER_SCALE, isTrapped: false, trappedIn: null,
    pos: { current: { x, y, distance(o) { return Math.hypot(this.x - o.x, this.y - o.y); } } }
  }, extra || {});

  const t = mkTrap(0, 0, 1);
  // The old test was `distance < trap.scale` (50). The game pins at 45.
  ok('47 units away: game says free, helper says free',
     fn(mkEnemy(47, 0), [t]) === null);
  ok('47 units away: the old 50-unit test would have said trapped',
     47 < TRAP.scale);
  ok('44 units away: helper says trapped', fn(mkEnemy(44, 0), [t]) === t);
  ok('45.0 units: boundary is inclusive, matches game <= P', fn(mkEnemy(45, 0), [t]) === t);
  ok('45.1 units: just outside', fn(mkEnemy(45.1, 0), [t]) === null);
  // the client's own swept answer wins when it has one
  const held = mkTrap(300, 300, 9);
  ok('client isTrapped/trappedIn is preferred over the radius',
     fn(mkEnemy(9999, 9999, { isTrapped: true, trappedIn: held }), [held]) === held);
  ok('a trap that is not ours does not count',
     fn(mkEnemy(9999, 9999, { isTrapped: true, trappedIn: mkTrap(0,0,77) }), [t]) === null);
  ok('empty trap list is null', fn(mkEnemy(0,0), []) === null);
  // nearest wins
  const t2 = mkTrap(20, 0, 2);
  ok('nearest of two overlapping traps wins', fn(mkEnemy(18, 0), [t, t2]) === t2);
}

// ── D. _retrapOffsets: arrival timing ─────────────────────────────────────
console.log('\n== D. _retrapOffsets (server-arrival timing) ==');
{
  const RPE_TICK_MS = TICK_MS;
  const src = methodOf('  class RynPlacementEngine', '_retrapOffsets').trim();
  const holder = eval('({' + src + '})');
  const off = holder._retrapOffsets.bind({});

  for (const pong of [70, 90, 120]) {
    const o = off(1, pong, pong);
    // derivation: we read tick N's frame pong/2 after the server made it; the
    // next server tick is TICK - pong/2 away; the send needs another pong/2.
    // Past a round trip of one whole tick the ideal moment is already behind
    // us, and the only thing left to do is send now -- which is the floor.
    const want = Math.max(4, RPE_TICK_MS - pong);
    ok(`ping ${pong}: single shot fires at max(now, TICK-ping) = ${want.toFixed(1)}ms`, Math.abs(o[0] - want) <= 1, JSON.stringify(o));
    const oldAnchor = RPE_TICK_MS - pong / 2;
    ok(`ping ${pong}: that is ${(oldAnchor-want).toFixed(0)}ms earlier than the old anchor`, want < oldAnchor - 30);
  }
  {
    const o = off(4, 120, 70);
    ok('jitter shot at TICK-minPing is present and later than the anchor',
       o.length >= 2 && o[1] > o[0] && Math.abs(o[1] - (RPE_TICK_MS - 70)) <= 1, JSON.stringify(o));
    ok('every offset lands inside the tick window', o.every(v => v >= 0 && v < RPE_TICK_MS), JSON.stringify(o));
    ok('count never exceeds what was asked for', o.length <= 4, JSON.stringify(o));
  }
  {
    // a ping longer than a tick must still produce a legal, immediate offset
    const o = off(3, 400, 400);
    ok('ping > tick clamps rather than going negative', o.every(v => v >= 0 && v < RPE_TICK_MS), JSON.stringify(o));
  }
  {
    const o = off(6, 90, 60);
    const uniq = new Set(o);
    ok('no duplicate offsets', uniq.size === o.length, JSON.stringify(o));
  }
}

// ── E. StealForecast: does it survive the enemy's reload? ─────────────────
console.log('\n== E. StealForecast across a reload cycle ==');
{
  const RPE_STEAL_HISTORY_TICKS = 14, RPE_STEAL_MAX_TRACKED = 32, RPE_STEAL_MAX_LEAD = 3;
  const SF = eval('(' + blockAt('  class StealForecast').trim() + ')');
  const f = new SF();
  // A pit trap (500hp) worked on by a great hammer: 50 dmg to buildings, and
  // moomoo's hammer swings every ~300ms => loaded on roughly one tick in three.
  const obj = { id: 1, health: 120 };
  const ready = t => (t % 3 === 0) ? 50 : 0;     // loaded every third tick
  const potential = 50;                            // always in reach
  let finiteTicks = 0, infiniteTicks = 0;
  for (let t = 0; t < 9; t++) {
    if (t % 3 === 0 && t > 0) obj.health -= 50;    // the swing lands
    const v = f.assess(obj, t, potential, ready(t));
    if (isFinite(v.ticks)) finiteTicks++; else infiniteTicks++;
  }
  ok('forecast produces a finite deadline on every tick of the cycle',
     infiniteTicks === 0, 'blank ticks=' + infiniteTicks);
  ok('and it is inside the booking horizon at least most of the time', finiteTicks === 9);

  // Belief is unchanged: something nobody has touched still scores zero.
  const f2 = new SF();
  const fresh = { id: 2, health: 900 };
  const v0 = f2.assess(fresh, 0, 25, 0);
  ok('an untouched full-health wall still scores no confidence', v0.confidence === 0, JSON.stringify(v0));
  // ...and one loaded weapon that out-damages what is left needs no history
  const f3 = new SF();
  const doomed = { id: 3, health: 30 };
  const v1 = f3.assess(doomed, 0, 50, 50);
  ok('one loaded swing that kills it outright is believed immediately', v1.confidence === 1 && v1.ticks === 1, JSON.stringify(v1));
  // health going back up resets the story
  const f4 = new SF();
  const reused = { id: 4, health: 100 };
  f4.assess(reused, 0, 50, 50); reused.health = 60;
  f4.assess(reused, 1, 50, 50); reused.health = 500;
  const v2 = f4.assess(reused, 2, 50, 0);
  ok('an id reused for a different object starts again', f4.tracks.get(4).hits === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
