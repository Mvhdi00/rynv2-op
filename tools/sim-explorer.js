// Headless harness for Ryn Type 2's bot roaming.
//
//     node tools/sim-explorer.js [path/to/Ryn_Type_2.user.js]
//
// The exploration system is behaviour rather than data, so verify-drivers has
// nothing to say about it. This runs it instead: the block is pulled straight
// out of the shipped file (so it cannot drift from what ships), evaluated
// against a stub of the client surface it actually uses — ObjectManager's grid
// query, PlayerManager.canMoveOnTop / isEnemyByID, ModuleHandler.startMovement
// and the reload gate — and driven by an integrator that resolves circle
// collisions the way the game does, by pushing out of the overlap.
//
// What it asserts, per scenario:
//
//   open map      the bot crosses the server rather than milling about, and
//                 its movement packets are keepalives rather than corrections
//   gated wall    a wall with a gap is routed through the gap
//   solid wall    a breakable wall is broken through, and a breakable thing
//                 standing off to the side is not touched
//   two bots      a pair that meets separates, and never both re-target at once
//   fleet of 24   24 bots starting on one spot spread over the map, do not
//                 stay clustered, and cost a fraction of a millisecond a tick
//   roaming       over two hours of game time the bot stands in every sector,
//                 targets sectors it has already been to, reaches all four
//                 edges and the corners, and never shuffles. Then, with the
//                 random term pinned so the answer is deterministic: a sector
//                 it has just left is stepped away from, and once the cooldown
//                 expires that same sector is chosen again — which is the whole
//                 difference between roaming and one-time exploration
//   toggle        the switch turns roaming off on the tick it is flipped, with
//                 no walk-home phase to sit through, and back on again
//   trap          an enemy trap is broken the tick the bot is caught, without
//                 waiting for the stuck ladder; a clan trap is left alone
//
// Exits non-zero if any check fails.
const fs = require("fs");
const vm = require("vm");

const target = process.argv[2] || require("path").join(__dirname, "..", "Ryn_Type_2.user.js");
const src = fs.readFileSync(target, "utf8");
const startMark = "  // Persistent exploration — how a scattered bot crosses the server.";
const endMark = "  // Target selection that ignores a raised shield.";
const s = src.indexOf(startMark);
const e = src.indexOf(endMark);
if (s < 0 || e < 0 || e < s) throw new Error("could not locate the explorer block");
const block = src.slice(src.lastIndexOf("  // ====", s), e);

// ── stubs ──────────────────────────────────────────────────────────────────
class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  angle(v) { return Math.atan2(v.y - this.y, v.x - this.x); }
}
const Config_default = { mapScale: 14400, riverWidth: 724 };
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const PI = Math.PI;
const getAngleDist = (a, b) => { const p = Math.abs(b - a) % (PI * 2); return p > PI ? PI * 2 - p : p; };
const pointInRiver = p => p.y >= 14400 / 2 - 724 / 2 && p.y <= 14400 / 2 + 724 / 2;
const DataHandler_default = { getWeapon: () => ({ range: 110 }) };
const Settings_default = { _botsScattered: true, _botsFrozen: false };
class PlayerObject {
  constructor(id, x, y, r, opts = {}) {
    this.id = id;
    this.pos = { current: new Vec(x, y) };
    this.collisionScale = r;
    this.isDestroyable = !!opts.destroyable;
    this.health = opts.health || 100;
    this.ownerID = opts.ownerID === undefined ? 99 : opts.ownerID;
    this._walk = !!opts.walkable;
  }
  canMoveOnTop() { return this._walk; }
}

function makeWorld(objects) {
  const map = new Map();
  for (const o of objects) map.set(o.id, o);
  return {
    objects: map,
    _deleted: false,
    isDestroyedObject() { const d = this._deleted; this._deleted = false; return d; },
    grid2D: {
      // Same contract as SpatialHashGrid2D.query: visit candidates near (x,y),
      // stop early when the callback returns true. The real grid has 100-unit
      // cells and inserts an object into every cell its radius covers, so a
      // search=2 query is guaranteed to see anything whose footprint comes
      // within 200 units per axis. This stub offers exactly that guarantee and
      // nothing more, so a caller that relies on a wider reach fails here.
      query(x, y, search, cb) {
        const reach = search * 100;
        for (const o of map.values()) {
          if (Math.abs(o.pos.current.x - x) > reach + o.collisionScale) continue;
          if (Math.abs(o.pos.current.y - y) > reach + o.collisionScale) continue;
          if (cb(o.id)) return true;
        }
        return false;
      }
    }
  };
}

function makeBot(owner, id, x, y, world) {
  const mh = {
    _scatterActive: false,
    _scatterReturning: false,
    move_dir: null,
    reverse_move_dir: null,
    moduleActive: false,
    placedOnce: false,
    shouldAttack: false,
    useAngle: null,
    forceWeapon: null,
    staticModules: { reloading: { isReloaded: () => true } },
    moveCalls: 0,
    startMovement(angle) {
      this.move_dir = angle;
      this.reverse_move_dir = angle === null ? null : angle + Math.PI;
      this.moveCalls++;
      return true;
    },
    stopMovement() { this.move_dir = null; }
  };
  const bot = {
    id,
    ownerClient: owner,
    ObjectManager: world,
    PlayerManager: {
      canMoveOnTop(o) { return o instanceof PlayerObject ? o.canMoveOnTop() : false; },
      isEnemyByID(ownerID) { return ownerID !== 1; }
    },
    _ModuleHandler: mh,
    myPlayer: {
      inGame: true,
      pos: { current: new Vec(x, y) },
      collisionScale: 35,
      speed: 0,
      isTrapped: false,
      trappedIn: null,
      getItemByType: t => (t === 0 ? 3 : 10)
    },
    get isOwner() { return false; }
  };
  return bot;
}

const ctx = vm.createContext({
  Math, Date, Map, Set, WeakMap, Array, Number, Infinity, console, JSON,
  Config_default, clamp, getAngleDist, pointInRiver, DataHandler_default,
  Settings_default, PlayerObject, PI,
  _isControlled: () => true,
  window: { _gbot1v1BotID: null, _gbot1v1WinCleanup: null }
});
vm.runInContext("(function(){\n" + block + "\n this.BotExplorer = BotExplorer; this.EXP = {EXP_SPACING_RADIUS, EXP_MIN_TRAVEL, EXP_SECTOR_SIZE, EXP_SECTOR_COLS, EXP_EDGE_MARGIN, EXP_SECTOR_COOLDOWN_MS};\n}).call(this)", ctx);
const { BotExplorer, EXP } = ctx;

// ── integrator ─────────────────────────────────────────────────────────────
const STEP = 35; // units per tick; the game's own legs are ~3300 over ~10s
function integrate(bot, world) {
  const p = bot.myPlayer.pos.current;
  const dir = bot._ModuleHandler.move_dir;
  const before = { x: p.x, y: p.y };
  if (dir !== null) {
    p.x = clamp(p.x + Math.cos(dir) * STEP, 35, 14400 - 35);
    p.y = clamp(p.y + Math.sin(dir) * STEP, 35, 14400 - 35);
  }
  // Push out of anything solid, which is what stops a blocked bot dead.
  for (let i = 0; i < 3; i++) {
    for (const o of world.objects.values()) {
      if (o.canMoveOnTop()) continue;
      const op = o.pos.current;
      const need = o.collisionScale + 35;
      const dx = p.x - op.x, dy = p.y - op.y;
      const d = Math.hypot(dx, dy);
      if (d < need && d > 0.001) {
        p.x = op.x + dx / d * need;
        p.y = op.y + dy / d * need;
      }
    }
  }
  bot.myPlayer.speed = Math.hypot(p.x - before.x, p.y - before.y);
}

function sectorOf(x, y) {
  const sx = clamp(Math.floor(x / EXP.EXP_SECTOR_SIZE), 0, EXP.EXP_SECTOR_COLS - 1);
  const sy = clamp(Math.floor(y / EXP.EXP_SECTOR_SIZE), 0, EXP.EXP_SECTOR_COLS - 1);
  return sy * EXP.EXP_SECTOR_COLS + sx;
}

let clock = 0;
const realNow = Date.now;
function advanceClock() { clock += 111; }
Date.now = () => 1e12 + clock;

// Scenarios 2 and 3 are about following a route past an obstacle, not about
// choosing where to go, so they pin the destination: _pickDestination is
// replaced with one that always installs the same point, using the same state
// fields the real one sets. Letting the real chooser run and then overwriting
// state.dest afterwards is not the same thing — the path would still be built
// toward whatever it chose.
function pinDestination(ex, dest) {
  ex._pickDestination = function (now, pos, state) {
    state.dest = { x: dest.x, y: dest.y };
    state.destSector = -1;
    state.committedAt = now;
    state.legHeading = Math.atan2(dest.y - pos.y, dest.x - pos.x);
    state.path = null;
    state.node = 0;
    state.nextPlanAt = 0;
    state.recovery = 0;
    state.recoveryAt = now;
    state.stuckTicks = 0;
    state.noProgress = 0;
    state.progressAt = now;
    state.progressDist = Math.hypot(dest.x - pos.x, dest.y - pos.y);
    state.breakTarget = null;
    state.wantsNewDest = false;
    state.yieldAway = null;
  };
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  — " + detail : ""));
}

// ── 1. one bot, open map: does it actually cross the server? ────────────────
{
  const world = makeWorld([]);
  const owner = { clients: new Set(), getClientIndex: b => [...owner.clients].indexOf(b) };
  const bot = makeBot(owner, 1, 1200, 1200, world);
  owner.clients.add(bot);
  const ex = new BotExplorer(bot);
  bot._ModuleHandler.staticModules.botExplorer = ex;

  const sectors = new Set();
  let headings = [];
  let flips = 0, prevDelta = 0;
  let realTurns = 0, lastSent = null;
  const wrapped = bot._ModuleHandler.startMovement.bind(bot._ModuleHandler);
  bot._ModuleHandler.startMovement = function (angle) {
    if (angle !== null && lastSent !== null && getAngleDist(lastSent, angle) > 0.06) realTurns++;
    lastSent = angle;
    return wrapped(angle);
  };
  let path = 0;
  let prev = { x: bot.myPlayer.pos.current.x, y: bot.myPlayer.pos.current.y };
  for (let t = 0; t < 4000; t++) {
    advanceClock();
    ex.postTick();
    integrate(bot, world);
    const p = bot.myPlayer.pos.current;
    path += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = { x: p.x, y: p.y };
    sectors.add(sectorOf(p.x, p.y));
    const h = bot._ModuleHandler.move_dir;
    if (headings.length) {
      const d = Math.atan2(Math.sin(h - headings[headings.length - 1]), Math.cos(h - headings[headings.length - 1]));
      if (Math.abs(d) > 0.02) {
        if (d * prevDelta < 0) flips++;
        prevDelta = d;
      }
    }
    headings.push(h);
  }
  check("open map: visits many sectors", sectors.size >= 6, sectors.size + " sectors in 4000 ticks");
  check("open map: keeps walking", path > 100000, Math.round(path) + " units travelled");
  // A reversal here is the heading trend changing sign, which is what a new
  // destination on the other side legitimately does. The failure mode this
  // guards is per-tick alternation, which would show up in the hundreds.
  check("open map: no left/right oscillation", flips <= 15, flips + " direction reversals in 4000 ticks");
  // A send is either a real change of heading or the 2s keepalive. Almost all
  // of them should be the keepalive: that is what "no micro-corrections" means.
  const keepalives = bot._ModuleHandler.moveCalls - realTurns;
  check("open map: sends are keepalives, not corrections", realTurns < 40,
    realTurns + " heading changes vs " + keepalives + " keepalives over 4000 ticks");
}

// ── 2. a building with a gate: does it route through the opening? ───────────
{
  // A wall across the bot's line of travel with a 260-unit gap in the middle.
  const objs = [];
  let id = 0;
  for (let y = 4000; y <= 10400; y += 100) {
    if (Math.abs(y - 7200) < 190) continue; // the gate
    objs.push(new PlayerObject(id++, 7200, y, 50, { ownerID: 1 })); // ally-owned: cannot be broken
  }
  const world = makeWorld(objs);
  const owner = { clients: new Set(), getClientIndex: () => 0 };
  const bot = makeBot(owner, 1, 6000, 7200, world);
  owner.clients.add(bot);
  const ex = new BotExplorer(bot);
  bot._ModuleHandler.staticModules.botExplorer = ex;
  pinDestination(ex, { x: 9500, y: 7200 });
  let crossed = false;
  for (let t = 0; t < 900; t++) {
    advanceClock();
    ex.postTick();
    integrate(bot, world);
    if (bot.myPlayer.pos.current.x > 7500) { crossed = true; break; }
  }
  const gateY = Math.round(bot.myPlayer.pos.current.y);
  check("gated wall: routes through the opening", crossed && Math.abs(gateY - 7200) < 400,
    crossed ? "crossed at y=" + gateY + " (gate is at 7200, wall spans 4000-10400)"
            : "stuck at x=" + Math.round(bot.myPlayer.pos.current.x));
}

// ── 3. a solid breakable wall: does it swing, and only at what blocks it? ───
{
  const objs = [];
  let id = 0;
  for (let y = 4000; y <= 10400; y += 100) {
    objs.push(new PlayerObject(id++, 7200, y, 50, { destroyable: true, ownerID: 99, health: 100 }));
  }
  // Something breakable well off to the side that must never be touched.
  const bystander = new PlayerObject(9999, 6000, 6600, 50, { destroyable: true, ownerID: 99 });
  objs.push(bystander);
  const world = makeWorld(objs);
  const owner = { clients: new Set(), getClientIndex: () => 0 };
  const bot = makeBot(owner, 1, 6700, 7200, world);
  owner.clients.add(bot);
  const ex = new BotExplorer(bot);
  bot._ModuleHandler.staticModules.botExplorer = ex;
  pinDestination(ex, { x: 9500, y: 7200 });

  let swings = 0, hitBystander = false, brokeThrough = false;
  for (let t = 0; t < 1200; t++) {
    advanceClock();
    bot._ModuleHandler.moduleActive = false;
    bot._ModuleHandler.shouldAttack = false;
    bot._ModuleHandler.useAngle = null;
    ex.postTick();
    if (bot._ModuleHandler.shouldAttack) {
      swings++;
      const target = world.objects.get(bot._ModuleHandler._scatterBreakTarget);
      if (target === bystander) hitBystander = true;
      // Damage what it is aiming at, as a real swing would.
      if (target) {
        target.health -= 40;
        if (target.health <= 0) { world.objects.delete(target.id); world._deleted = true; }
      }
    }
    integrate(bot, world);
    if (bot.myPlayer.pos.current.x > 7500) { brokeThrough = true; break; }
  }
  check("solid wall: breaks through it", brokeThrough, swings + " swings, x=" + Math.round(bot.myPlayer.pos.current.x));
  check("solid wall: leaves the bystander alone", !hitBystander);
}

// ── 4. two bots on top of each other: exactly one gives way ────────────────
{
  const world = makeWorld([]);
  const owner = { clients: new Set(), getClientIndex: b => [...owner.clients].indexOf(b) };
  const a = makeBot(owner, 1, 7000, 7200, world);
  const b = makeBot(owner, 2, 7080, 7200, world);
  owner.clients.add(a); owner.clients.add(b);
  const ea = new BotExplorer(a), eb = new BotExplorer(b);
  a._ModuleHandler.staticModules.botExplorer = ea;
  b._ModuleHandler.staticModules.botExplorer = eb;

  // A destination also changes on arrival and on timeout, and two of those
  // landing on one tick is a coincidence rather than a violation. What must
  // never happen is both bots re-targeting *because of each other*, so record
  // the picks that were avoidance yields specifically — state.yieldAway is set
  // only on the bot the spacing pass chose — and check those.
  let tick = 0;
  const yieldTick = { a: -1, b: -1 };
  const yields = { a: 0, b: 0 };
  let bothYieldedAtOnce = 0;
  for (const [tag, ex] of [["a", ea], ["b", eb]]) {
    const orig = ex._pickDestination.bind(ex);
    ex._pickDestination = function (now, pos, state) {
      if (state.yieldAway !== null) { yieldTick[tag] = tick; yields[tag]++; }
      return orig(now, pos, state);
    };
  }
  for (tick = 0; tick < 2500; tick++) {
    advanceClock();
    ea.postTick(); eb.postTick();
    if (yieldTick.a === tick && yieldTick.b === tick) bothYieldedAtOnce++;
    integrate(a, world); integrate(b, world);
  }
  const sep = a.myPlayer.pos.current.distance(b.myPlayer.pos.current);
  check("two bots: separate", sep > EXP.EXP_SPACING_RADIUS, "final separation " + Math.round(sep));
  check("two bots: only one of a pair ever yields", bothYieldedAtOnce === 0,
    yields.a + " yields by A, " + yields.b + " by B, " + bothYieldedAtOnce + " on the same tick");
}

// ── 5. a full fleet: do they spread out, and does it stay cheap? ────────────
{
  const world = makeWorld([]);
  const owner = { clients: new Set(), getClientIndex: b => [...owner.clients].indexOf(b) };
  const bots = [];
  for (let i = 0; i < 24; i++) {
    const bot = makeBot(owner, i, 7200 + (i % 5) * 40, 7200 + Math.floor(i / 5) * 40, world);
    owner.clients.add(bot);
    const ex = new BotExplorer(bot);
    bot._ModuleHandler.staticModules.botExplorer = ex;
    bots.push({ bot, ex });
  }
  const t0 = realNow();
  let crowdedSamples = 0, samples = 0;
  for (let t = 0; t < 2000; t++) {
    advanceClock();
    for (const { ex } of bots) ex.postTick();
    for (const { bot } of bots) integrate(bot, world);
    // Passing close is fine; living close is the clustering. Sample the last
    // half of the run and ask how much of the time a bot has a neighbour
    // inside the separation radius.
    if (t >= 1000) {
      for (let i = 0; i < bots.length; i++) {
        samples++;
        for (let j = 0; j < bots.length; j++) {
          if (i === j) continue;
          if (bots[i].bot.myPlayer.pos.current.distance(bots[j].bot.myPlayer.pos.current) < EXP.EXP_SPACING_RADIUS) {
            crowdedSamples++;
            break;
          }
        }
      }
    }
  }
  const ms = realNow() - t0;
  const sectors = new Set(bots.map(({ bot }) => sectorOf(bot.myPlayer.pos.current.x, bot.myPlayer.pos.current.y)));
  const crowded = crowdedSamples / samples;
  check("fleet of 24: spreads across the map", sectors.size >= 8, sectors.size + " distinct sectors occupied");
  check("fleet of 24: does not stay clustered", crowded < 0.1,
    (crowded * 100).toFixed(1) + "% of bot-ticks had a neighbour inside the separation radius (24 bots started on one spot)");
  check("fleet of 24: cheap", ms < 4000, ms + "ms for 24 bots x 2000 ticks (" + (ms / 2000).toFixed(2) + "ms/tick for the whole fleet)");
}

// ── 6. roaming, not exploring: does it keep coming back? ───────────────────
{
  const world = makeWorld([]);
  const owner = { clients: new Set(), getClientIndex: () => 0 };
  const bot = makeBot(owner, 1, 7200, 7200, world);
  owner.clients.add(bot);
  const ex = new BotExplorer(bot);
  bot._ModuleHandler.staticModules.botExplorer = ex;

  // Every destination the bot commits to, in order.
  const legs = [];
  const origPick = ex._pickDestination.bind(ex);
  ex._pickDestination = function (now, pos, state) {
    origPick(now, pos, state);
    if (state.dest) legs.push({ x: state.dest.x, y: state.dest.y, sector: sectorOf(state.dest.x, state.dest.y) });
  };

  const occupied = new Map();
  for (let t = 0; t < 40000; t++) {
    advanceClock();
    ex.postTick();
    integrate(bot, world);
    const p = bot.myPlayer.pos.current;
    const sec = sectorOf(p.x, p.y);
    occupied.set(sec, (occupied.get(sec) || 0) + 1);
  }

  const total = EXP.EXP_SECTOR_COLS * EXP.EXP_SECTOR_COLS;
  check("roaming: covers the whole map", occupied.size === total,
    occupied.size + "/" + total + " sectors stood in over " + legs.length + " legs");

  // The point of the correction: a sector it has already been to is picked
  // again. If any "visited = ignore" rule survived, destination sectors would
  // be unique and this would be 0.
  const destCounts = new Map();
  for (const leg of legs) destCounts.set(leg.sector, (destCounts.get(leg.sector) || 0) + 1);
  const revisited = [...destCounts.values()].filter(n => n > 1).length;
  const busiest = Math.max(...destCounts.values());
  check("roaming: previously visited sectors are chosen again",
    revisited >= 20 && busiest >= 3,
    revisited + " sectors targeted more than once, busiest " + busiest + " times");
  // Coverage over a finite run is coupon-collecting — 36 sectors need about
  // 150 draws to all come up even when the draw is fair — so a run of ~130 legs
  // landing on 30-ish is sampling, not exclusion. It is still worth a floor
  // well above what any "visited = ignore" rule could produce.
  check("roaming: most of the map is targeted within one run",
    destCounts.size >= total - 8, destCounts.size + "/" + total + " distinct sectors targeted in " + legs.length + " legs");

  // The exclusion question asked directly, and deterministically. Coverage over
  // a finite run cannot answer it — a sector can be missed by luck — so pin the
  // random term and ask the chooser the same question three ways.
  {
    const realRandom = Math.random;
    bot.myPlayer.pos.current.x = 900;
    bot.myPlayer.pos.current.y = 900;
    const pickWith = mark => {
      const st = ex._newState(Date.now());
      if (mark) mark(st);
      st.dest = null;
      origPick(Date.now(), bot.myPlayer.pos.current, st);
      return st.dest ? sectorOf(st.dest.x, st.dest.y) : null;
    };
    Math.random = () => 0.5;
    const baseline = pickWith(null);
    const cooled = pickWith(st => st.visited.set(baseline, Date.now() - EXP.EXP_SECTOR_COOLDOWN_MS - 1));
    const hot = pickWith(st => st.visited.set(baseline, Date.now()));
    Math.random = realRandom;

    check("roaming: a sector just left is stepped away from",
      hot !== baseline && hot !== null, "would pick " + baseline + "; while it is cooling picks " + hot);
    check("roaming: once the cooldown expires it is worth exactly what it was",
      cooled === baseline, "never visited picks " + baseline + ", visited long ago picks " + cooled);
  }

  // Legs are journeys, not shuffles.
  let short = 0;
  for (let i = 1; i < legs.length; i++) {
    if (Math.hypot(legs[i].x - legs[i - 1].x, legs[i].y - legs[i - 1].y) < EXP.EXP_MIN_TRAVEL * 0.5) short++;
  }
  check("roaming: consecutive destinations are far apart",
    short / legs.length < 0.1, short + " of " + legs.length + " legs under half the minimum travel");

  // The edges and the corners, not just the middle.
  const band = EXP.EXP_EDGE_MARGIN + 400;
  const hitN = legs.some(l => l.y < band), hitS = legs.some(l => l.y > 14400 - band);
  const hitW = legs.some(l => l.x < band), hitE = legs.some(l => l.x > 14400 - band);
  check("roaming: reaches all four edges", hitN && hitS && hitW && hitE,
    `N${hitN ? "y" : "n"} S${hitS ? "y" : "n"} W${hitW ? "y" : "n"} E${hitE ? "y" : "n"}`);
  const corners = legs.filter(l => (l.x < band || l.x > 14400 - band) && (l.y < band || l.y > 14400 - band)).length;
  check("roaming: reaches the corners", corners > 0, corners + " corner destinations");
}

// ── 7. the toggle turns it off on the spot ─────────────────────────────────
{
  const world = makeWorld([]);
  const owner = { clients: new Set(), getClientIndex: () => 0 };
  const bot = makeBot(owner, 1, 3000, 3000, world);
  owner.clients.add(bot);
  const ex = new BotExplorer(bot);
  bot._ModuleHandler.staticModules.botExplorer = ex;
  Settings_default._botsScattered = true;
  for (let t = 0; t < 60; t++) { advanceClock(); ex.postTick(); integrate(bot, world); }
  check("toggle: on means roaming", bot._ModuleHandler._scatterActive === true && ex.state !== null);

  // Second press: the flag drops and the bot stops on that same tick, so
  // Movement.postTick — which only stands aside while the flag is set — has it
  // walking back from the very next tick.
  Settings_default._botsScattered = false;
  advanceClock();
  ex.postTick();
  check("toggle: off drops the flag immediately", bot._ModuleHandler._scatterActive === false);
  check("toggle: and stops the roaming heading on the same tick", bot._ModuleHandler.move_dir === null);
  check("toggle: and lets go of its state", ex.state === null);

  // And back on again, with no walk-home phase in between to sit through.
  Settings_default._botsScattered = true;
  advanceClock();
  ex.postTick();
  check("toggle: on again resumes at once", bot._ModuleHandler._scatterActive === true);
  Settings_default._botsScattered = true;
}

// ── 8. walking into a trap ─────────────────────────────────────────────────
{
  const world = makeWorld([]);
  const owner = { clients: new Set(), getClientIndex: () => 0 };
  const bot = makeBot(owner, 1, 5000, 5000, world);
  owner.clients.add(bot);
  const ex = new BotExplorer(bot);
  bot._ModuleHandler.staticModules.botExplorer = ex;
  const mh = bot._ModuleHandler;

  const enemyTrap = new PlayerObject(500, 5000, 5000, 10, { destroyable: true, ownerID: 99 });
  const clanTrap  = new PlayerObject(501, 5000, 5000, 10, { destroyable: true, ownerID: 1 });

  function tick() { advanceClock(); mh.moduleActive = false; mh.shouldAttack = false; mh.useAngle = null; ex.postTick(); }
  for (let t = 0; t < 20; t++) { tick(); integrate(bot, world); }

  // Not trapped: no swing.
  tick();
  check("trap: nothing is swung at while free", mh.shouldAttack === false);

  // Trapped by an enemy: swung at on the very next tick, without waiting for
  // the stuck ladder — state.recovery is still 0 here.
  bot.myPlayer.isTrapped = true;
  bot.myPlayer.trappedIn = enemyTrap;
  tick();
  check("trap: an enemy trap is broken immediately, not after the stuck ladder",
    mh.shouldAttack === true && ex.state.recovery === 0,
    "shouldAttack=" + mh.shouldAttack + " recovery=" + ex.state.recovery);
  check("trap: aimed at the trap and marked as the break target",
    mh._scatterBreakTarget === enemyTrap.id && mh.forceWeapon !== null,
    "target=" + mh._scatterBreakTarget + " weapon=" + mh.forceWeapon);
  check("trap: the bot faces its swing", mh._scatterAngle === mh.useAngle);

  // A clan trap does not hold you and cannot be damaged, so it is not hit.
  bot.myPlayer.trappedIn = clanTrap;
  tick();
  check("trap: a clan trap is left alone", mh.shouldAttack === false);

  // Freed again: back to walking.
  bot.myPlayer.isTrapped = false;
  bot.myPlayer.trappedIn = null;
  tick();
  check("trap: once free it stops swinging and walks on",
    mh.shouldAttack === false && mh.move_dir !== null);
}

Date.now = realNow;
const failed = results.filter(r => !r.ok);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
process.exit(failed.length ? 1 : 0);
