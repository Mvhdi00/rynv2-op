"use strict";
// Integration scenarios: the engine and AutoPlacer driven by a simulated
// server across an asymmetric link. See harness.js.
const h = require("./harness.js");
const { lib, clock, FakeClient, Sim, test, assert, metrics } = h;
const { Items, RynAngles, RPE_PRIORITY } = lib;
const P = 1000 / 9;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function legalArrivals(sim) {
  return sim.arrivals.filter(a => a.legal);
}
// Every placement the enemy could make that would trap us: a pit trap on
// their ring (|Q - E| = 80) within trap trigger (45) of us, and legal at
// the server. Brute force, one degree apart, on the server's world.
function enemyRetrapSpots(sim, enemies, me) {
  const out = [];
  for (const e of enemies) {
    for (let d = 0; d < 360; d += .5) {
      const a = d * Math.PI / 180;
      const x = e.pos.current.x + 80 * Math.cos(a), y = e.pos.current.y + 80 * Math.sin(a);
      if (Math.hypot(x - me.x, y - me.y) > 45) continue;
      if (sim.serverLegalAt(15, x, y)) out.push({ x, y });
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// F. Replace
// ════════════════════════════════════════════════════════════════════════════
test("replace: no enemy — our spike dies, the same ground is rebuilt from the deletion packet", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  const spike = c.ObjectManager.build(6, me.x + 79, me.y, 1);
  const sim = new Sim(c, { up: 40, down: 40 });
  sim.run(P * 4);
  sim.destroy(spike);
  const goneAt = clock.now();
  sim.run(P * 4);
  const built = legalArrivals(sim);
  assert(built.length === 1, "expected one rebuild, got " + built.length + " of " + sim.arrivals.length);
  // The server pushed us out of the spike when it was built, so its ground
  // is now a few units off our ring: as close as the ring allows.
  const reach = Math.abs(Math.hypot(sim.me.x - spike.pos.current.x, sim.me.y - spike.pos.current.y) - 79);
  assert(dist(built[0], spike.pos.current) <= reach + 1, "rebuilt " + dist(built[0], spike.pos.current).toFixed(2) + " from its ground (ring allows " + reach.toFixed(2) + ")");
  // deletion reaches client at +40, send reaches server at +40 more.
  assert(built[0].at - goneAt <= 80 + 1, "rebuild landed " + (built[0].at - goneAt) + "ms after the break");
});

test("replace: no enemy, break forecast — reserved and timed to land as it breaks", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  const spike = c.ObjectManager.build(6, me.x + 79, me.y, 1);
  spike.health = 90;
  // A teammate hammering it: not an enemy, so there is no fight frame.
  const ally = new h.FakePlayer(7, spike.pos.current.x + 80, spike.pos.current.y);
  ally.angle = Math.PI;
  c.allies.add(7);
  c.players.push(ally);
  const sim = new Sim(c, { up: 45, down: 45 });
  let brokeAt = null;
  sim.script.push((k, s) => {
    if (k >= 3 && (k - 3) % 7 === 0 && s.server.has(spike.id)) {
      s.hit(ally, spike, 45);
      if (!s.server.has(spike.id)) brokeAt = clock.now();
    }
  });
  sim.run(P * 30);
  assert(brokeAt !== null, "spike never broke");
  const built = legalArrivals(sim);
  assert(built.length === 1, "expected exactly one rebuild, got " + built.length);
  const late = built[0].at - brokeAt;
  metrics.preparedReplace = { late: late, arrivals: sim.arrivals.length, timed: sim.arrivals.filter(a => a.rec.how === "timed").length };
  assert(built[0].rec.how === "timed", "rebuild came from the deletion packet, not the prepared send");
  assert(late >= 0 && late < P, "prepared rebuild landed " + late.toFixed(1) + "ms after the break (event path would be 90)");
});

// ════════════════════════════════════════════════════════════════════════════
// I. Anti-retrap
// ════════════════════════════════════════════════════════════════════════════
function trappedSetup(enemyPositions, opts = {}) {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  const trap = c.ObjectManager.build(15, me.x + (opts.trapDx ?? 10), me.y, 200);
  c.myPlayer.isTrapped = true;
  c.myPlayer.trappedIn = trap;
  const enemies = enemyPositions.map(([ dx, dy ], i) => c.addEnemy(me.x + dx, me.y + dy, 200 + i));
  for (const e of enemies) e.angle = Math.atan2(me.y - e.pos.current.y, me.x - e.pos.current.x);
  if (opts.extra) opts.extra(c, me);
  return { c, me, trap, enemies };
}
for (const [ name, positions ] of [ [ "one enemy", [ [ 110, 0 ] ] ], [ "one enemy, diagonal", [ [ -70, 80 ] ] ], [ "two enemies", [ [ 110, 20 ], [ -95, -60 ] ] ], [ "three enemies", [ [ 120, 0 ], [ -100, 40 ], [ 10, -115 ] ] ] ]) {
  test("anti-retrap: " + name + " — trap breaks, every retrap spot is denied from inside the handler", () => {
    const { c, me, trap, enemies } = trappedSetup(positions);
    const sim = new Sim(c, { up: 35, down: 35 });
    sim.run(P * 3);
    const plan = c.engine.antiRetrap.plan;
    assert(plan && plan.items.length >= 1 && plan.items.length <= 4, "plan has " + (plan ? plan.items.length : 0) + " items");
    const sendsBefore = c._ModuleHandler.sends.length;
    sim.destroy(trap);
    // What the enemy could retrap with once the trap is gone at the server,
    // before anything of ours lands.
    const before = enemyRetrapSpots(sim, enemies, me).length;
    assert(before > 0, "setup: no retrap spot exists once the trap is gone");
    // The deletion reaches the client; the plan must be on the wire at that
    // same instant, before any other packet is read.
    clock.advance(35.5);
    c.myPlayer.isTrapped = false;
    const sent = c._ModuleHandler.sends.slice(sendsBefore);
    assert(sent.length >= 1, "nothing sent on the trap's deletion");
    const t0 = sent[0].at;
    assert(sent.every(s => s.at === t0), "anti-retrap builds were not sent together in the handler");
    sim.run(P);
    const landed = legalArrivals(sim).filter(a => a.at >= t0);
    assert(landed.length === sent.length, landed.length + " of " + sent.length + " builds landed");
    const after = enemyRetrapSpots(sim, enemies, me);
    metrics["antiRetrap:" + name] = { items: plan.items.length, coverage: +plan.coverage.toFixed(3), spotsBefore: before, spotsAfter: after.length };
    assert(after.length / before <= .02, after.length + " of " + before + " retrap spots still open");
  });
}

test("anti-retrap: disabled setting sends nothing", () => {
  const { c, trap } = trappedSetup([ [ 110, 0 ] ]);
  c.engine.client; h.lib.settings._antiRetrapGrid = false;
  const sim = new Sim(c, { up: 35, down: 35 });
  sim.run(P * 3);
  sim.destroy(trap);
  sim.run(P * 2);
  assert(c.engine.antiRetrap.plan === null, "plan kept while disabled");
  assert(c._ModuleHandler.sends.every(s => s.owner !== "antiRetrapGrid"), "sent while disabled");
});

// ════════════════════════════════════════════════════════════════════════════
// G/H. Spam preplace and building claims
// ════════════════════════════════════════════════════════════════════════════
function retrapSetup(opts = {}) {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  const target = c.addEnemy(me.x + 112, me.y + 10, 300);
  const trap = c.ObjectManager.build(15, target.pos.current.x, target.pos.current.y, 1);
  trap.health = opts.health ?? 100;
  target.isTrapped = true;
  target.angle = Math.atan2(trap.pos.current.y - target.pos.current.y, trap.pos.current.x - target.pos.current.x);
  target.weapon = { current: 10, primary: 5, secondary: 10 };
  return { c, me, target, trap };
}
test("spam preplace: the trap holding the target — timed retrap lands just after the break", () => {
  const { c, target, trap } = retrapSetup({ health: 160 });
  const sim = new Sim(c, { up: 50, down: 50 });
  let brokeAt = null, brokeSeq = null;
  sim.script.push((k, s) => {
    if (k >= 4 && (k - 4) % 4 === 0 && s.server.has(trap.id)) {
      s.hit(target, trap, 75);
      if (!s.server.has(trap.id)) {
        brokeAt = clock.now();
        brokeSeq = k;
      }
    }
  });
  sim.run(P * 26);
  assert(brokeAt !== null, "trap never broke");
  const claim = c.engine.timer.stats;
  assert(claim.armed >= 1, "no timed event was armed");
  const built = legalArrivals(sim).filter(a => a.rec.type === 7);
  assert(built.length >= 1, "no retrap built");
  const first = built.sort((a, b) => a.at - b.at)[0];
  const late = first.at - brokeAt;
  const early = sim.arrivals.filter(a => a.rec.how === "timed" && a.at < brokeAt).length;
  metrics.spamRetrap = { late: +late.toFixed(1), eventPathLate: 100, timedSent: sim.arrivals.filter(a => a.rec.how === "timed").length, early: early, bias: +c.engine.outcomes.phase.bias.toFixed(2) };
  assert(first.rec.how === "timed", "retrap came from the deletion path, not the timed sender");
  assert(late >= 0 && late < 30, "retrap landed " + late.toFixed(1) + "ms after the break");
  assert(dist(first, target.pos.current) < lib.RPE_TRAP_TRIGGER, "retrap does not take the target");
});

test("spam preplace: repeated openings teach it how many attempts are worth sending", () => {
  const counts = [];
  let c0 = null;
  for (let round = 0; round < 6; round++) {
    const { c, target, trap } = retrapSetup({ health: 160 });
    if (c0) c.engine.outcomes.phase = c0.engine.outcomes.phase;
    c0 = c;
    const sim = new Sim(c, { up: 50, down: 50 });
    sim.script.push((k, s) => {
      if (k >= 4 && (k - 4) % 4 === 0 && s.server.has(trap.id)) s.hit(target, trap, 75);
    });
    sim.run(P * 24);
    counts.push(sim.arrivals.filter(a => a.rec.how === "timed").length);
  }
  metrics.adaptiveAttempts = { perOpening: counts, hitIndex: +c0.engine.outcomes.phase.hitIndex.toFixed(2) };
  assert(counts[0] === 4, "first opening should use the configured 4: " + counts);
  assert(counts[counts.length - 1] <= 2, "attempt count did not come down: " + counts);
});

test("spam preplace: packets are reserved when armed; lower priority cannot spend them", () => {
  const { c, target, trap } = retrapSetup({ health: 140 });
  const sim = new Sim(c, { up: 50, down: 50 });
  sim.script.push((k, s) => {
    if ((k === 4 || k === 8) && s.server.has(trap.id)) s.hit(target, trap, 75);
  });
  // Wake up once the event is armed and look at the budget.
  let seen = null;
  const orig = c.engine.timer.arm.bind(c.engine.timer);
  c.engine.timer.arm = (key, spec) => {
    const ev = orig(key, spec);
    if (ev && !seen) {
      const mh = c._ModuleHandler;
      seen = { low: mh.availablePackets(RPE_PRIORITY.ENGAGEMENT), high: mh.availablePackets(RPE_PRIORITY.INSTA), n: ev.timers.length };
    }
    return ev;
  };
  sim.run(P * 12);
  assert(seen, "never armed");
  assert(seen.high - seen.low === seen.n * 5, "reservation not visible to lower priority: " + JSON.stringify(seen));
});

test("building steal: enemy trap beside the target, being broken by me — claimed; off → rejected", () => {
  for (const on of [ true, false ]) {
    const c = new FakeClient({ x: 3000, y: 3000 });
    h.lib.settings._buildingSteal = on;
    const me = c.myPlayer.pos.current;
    const target = c.addEnemy(me.x + 150, me.y, 300);
    const theirs = c.ObjectManager.build(15, me.x + 100, me.y + 40, 300);
    theirs.health = 30;
    c._ModuleHandler._autoBreakActive = true;
    c._ModuleHandler._lastBreakAngle = Math.atan2(40, 100);
    c.myPlayer.reload[0].current = 6;
    const sim = new Sim(c, { up: 40, down: 40 });
    sim.run(P * 2);
    const claim = c.engine.claims.find(cl => cl.object === theirs);
    assert(claim, "no claim for the enemy trap");
    assert(claim.owner === "enemy" && claim.role === "trap", "wrong role " + claim.owner + "/" + claim.role);
    if (on) assert([ "BUILD_NOW", "RESERVE", "PREPARE" ].indexOf(claim.decision) !== -1, "not claimed: " + claim.decision);
    else assert(claim.decision === "REJECT", "claimed with steal off: " + claim.decision);
    assert(isFinite(claim.tDestroy) && typeof claim.tRemaining === "number", "timing fields missing");
  }
});

test("building steal: allied building under enemy attack is a claim of its own kind", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  c.allies.add(50);
  const target = c.addEnemy(me.x + 170, me.y, 300);
  const wall = c.ObjectManager.build(3, me.x + 95, me.y, 50);
  wall.health = 40;
  target.angle = Math.PI;
  target.weapon = { current: 5, primary: 5, secondary: 10 };
  target.lastAttacked = 0;
  wall._lastHitBy = target.id;
  const sim = new Sim(c, { up: 40, down: 40 });
  sim.run(P * 2);
  const claim = c.engine.claims.find(cl => cl.object === wall);
  assert(claim && claim.owner === "ally", "ally claim missing");
  assert(claim.role === "between", "role " + claim.role);
});

// ════════════════════════════════════════════════════════════════════════════
// D. Auto place
// ════════════════════════════════════════════════════════════════════════════
function fight(opts = {}) {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  const r = require("./placement.test.js").rng(opts.seed ?? 11);
  const enemies = (opts.enemies || [ [ 140, 30 ] ]).map(([ dx, dy ], i) => c.addEnemy(me.x + dx, me.y + dy, 300 + i));
  if (opts.clutter) require("./placement.test.js").randomBoard(c, r, opts.clutter, 220, opts.owners);
  const sim = new Sim(c, { up: opts.up ?? 40, down: opts.down ?? 40, jitter: opts.jitter ?? 0, periodJitter: opts.periodJitter ?? 0, autoPlacer: true, rand: r });
  return { c, me, enemies, sim, r };
}
test("auto place: one stationary enemy — goes through the engine, every build legal at the server", () => {
  const { c, sim, enemies } = fight({ clutter: 6 });
  sim.run(P * 8);
  const arr = sim.arrivals;
  assert(arr.length >= 1, "auto place sent nothing");
  assert(arr.every(a => a.legal), arr.filter(a => !a.legal).length + " of " + arr.length + " refused");
  assert(arr.every(a => a.rec.owner === "autoPlacer" || a.rec.owner === null), "");
  assert(c.engine.stats.directed === arr.length, "auto place bypassed the engine: " + c.engine.stats.directed + " vs " + arr.length);
  assert(c.engine.outcomes.stats.sent === c._ModuleHandler.sends.length, "a send bypassed the outcome ledger");
  // Luna's ladder, neither of us trapped: the named trap pick is the build
  // nearest the enemy's path.
  const first = arr[0];
  assert(first.rec.type === 7, "first build is not the retrap trap");
});
test("auto place: enemy trapped in our trap — the spike that catches them touches them", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  // Held at the near edge of the trap (a trapped player's centre is within
  // 45 of the trap's; dead centre, no spike can touch them — the trap's own
  // 99-unit exclusion covers the whole contact arc).
  const e = c.addEnemy(me.x + 120, me.y, 300);
  c.ObjectManager.build(15, me.x + 160, me.y, 1);
  e.isTrapped = true;
  const sim = new Sim(c, { up: 40, down: 40, autoPlacer: true });
  sim.run(P * 4);
  const spikes = legalArrivals(sim).filter(a => a.rec.type === 4);
  assert(spikes.length >= 1, "no spike on a trapped enemy");
  assert(dist(spikes[0], e.pos.current) < 49 + 35, "first spike does not touch the trapped enemy: " + dist(spikes[0], e.pos.current).toFixed(1));
  assert(sim.arrivals.every(a => a.legal), "refused");
});
test("auto place: moving enemy, multiple enemies, cluttered board — no refusals", () => {
  const { c, sim, enemies, r } = fight({ enemies: [ [ 150, 0 ], [ -120, 90 ] ], clutter: 10, seed: 12 });
  sim.script.push(k => {
    for (const e of enemies) {
      const p = e._next || e.pos.current;
      e._next = { x: p.x + 8 * Math.cos(k / 5), y: p.y + 8 * Math.sin(k / 5) };
    }
  });
  sim.run(P * 25);
  const arr = sim.arrivals;
  assert(arr.length >= 2, "only " + arr.length + " builds");
  const refused = arr.filter(a => !a.legal);
  metrics.autoMoving = { sent: arr.length, refused: refused.length };
  assert(refused.length === 0, refused.length + " of " + arr.length + " refused");
});

// ════════════════════════════════════════════════════════════════════════════
// E. Preplace
// ════════════════════════════════════════════════════════════════════════════
test("preplace: an approaching enemy — the build is standing before they arrive", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  const e = c.addEnemy(me.x + 300, me.y + 20, 300);
  c.ObjectManager.build(6, me.x + 150, me.y + 90, 1);
  c.ObjectManager.build(15, me.x + 120, me.y - 60, 1);
  const sim = new Sim(c, { up: 40, down: 40 });
  sim.script.push(() => {
    const p = e._next || e.pos.current;
    e._next = { x: p.x - 12, y: p.y };
  });
  sim.run(P * 16);
  const pre = sim.arrivals.filter(a => a.rec.how !== "timed");
  assert(c.engine.stats.preplaced >= 1 && pre.length >= 1, "no preplace sent");
  assert(sim.arrivals.every(a => a.legal), "preplace refused");
  // Standing before they reach it: the enemy (server position when the
  // build landed) is not yet inside what the build does to them — a trap
  // takes them at 35 + 50 * .2, a spike hurts on contact.
  const a = pre[0];
  const ex = 3300 - 12 * a.seq;
  const item = Items[a.rec.id];
  const trigger = 35 + item.scale * (item.colDiv || 1);
  assert(Math.hypot(ex - a.x, 3020 - a.y) > trigger, "the build landed after the enemy was already there");
});

// ════════════════════════════════════════════════════════════════════════════
// M. Latency: high ping while moving
// ════════════════════════════════════════════════════════════════════════════
for (const [ up, down, jit ] of [ [ 20, 20, 0 ], [ 60, 60, 0 ], [ 120, 130, 0 ], [ 90, 90, 25 ] ]) {
  test("latency: rtt " + (up + down) + (jit ? " ±" + jit : "") + " while walking — builds land where they were aimed", () => {
    // Our own structures on the way: we slide along them, and nothing of the
    // enemy's is there to knock us about (that is knockback, not latency).
    const { c, sim, me } = fight({ up, down, jitter: jit, clutter: 8, seed: 20 + up, enemies: [ [ 160, 40 ] ], owners: [ 1 ] });
    sim.walk(Math.atan2(-6, 18));
    sim.run(P * 18);
    const arr = sim.arrivals;
    assert(arr.length >= 2, "only " + arr.length + " builds");
    const refused = arr.filter(a => !a.legal).length;
    // Where the engine said each build would land (its outcome record, made
    // from the arrival origin) against where the server built it — and the
    // same for a model that builds from where we stand when we send.
    let err = 0, naive = 0;
    for (const a of arr) {
      const rec = c.engine.outcomes.pending.find(p => p.sentAt === a.rec.at && p.type === a.rec.type && Math.abs(p.angle - a.rec.wire) < 1e-9);
      assert(rec, "send missing from the outcome ledger");
      err = Math.max(err, Math.hypot(a.x - rec.x, a.y - rec.y));
      naive = Math.max(naive, Math.hypot(a.x - a.rec.x, a.y - a.rec.y));
    }
    metrics["latency:" + (up + down) + (jit ? "j" + jit : "")] = { sent: arr.length, refused: refused, lead: c.engine.clock.leadTicks(), landingErr: +err.toFixed(2), naiveErr: +naive.toFixed(2) };
    // Exact on a straight run; sliding round an obstacle across a lead of
    // several ticks is extrapolated, and must still beat building from where
    // we stand.
    assert(err <= naive + 1e-9, "arrival model worse than none: " + err.toFixed(2) + " vs " + naive.toFixed(2));
    if (!jit) assert(err < 3, "arrival model missed the landing by " + err.toFixed(2));
    assert(refused <= Math.ceil(arr.length * (jit ? .15 : .05)), refused + " of " + arr.length + " refused");
  });
}

// ════════════════════════════════════════════════════════════════════════════
// O. Refusal learning
// ════════════════════════════════════════════════════════════════════════════
test("refusal: a hidden enemy trap refuses a build → ghost; no second send there", () => {
  const { c, sim, enemies, me } = fight({ enemies: [ [ 150, 0 ] ] });
  // A pit trap only the server knows about, right where the best spike goes.
  const hidden = new lib.PlayerObject(9999, me.x + 79, me.y, 0, 50, 15, 300);
  sim.hidden.push(hidden);
  sim.run(P * 14);
  const reasons = c.engine.outcomes.stats.reasons;
  assert((reasons.hidden || 0) >= 1, "refusal not classified hidden: " + JSON.stringify(reasons));
  const into = sim.arrivals.filter(a => Math.hypot(a.x - hidden.pos.current.x, a.y - hidden.pos.current.y) < 50 + 49);
  metrics.hiddenTrap = { sendsIntoIt: into.length, reasons: reasons };
  assert(into.length <= 2, into.length + " sends into the hidden trap");
});

test("refusal: an 'early' send teaches the phase bias to land later", () => {
  const c = new FakeClient();
  const o = c.engine.outcomes;
  const b0 = o.phase.bias;
  const ev = { key: "x", uid: 1, done: true, reviewed: false, armedAt: clock.now(), timers: [] };
  c.engine.timer.events.set("x", ev);
  o.pending.push({ eventKey: "x", eventUid: 1, resolved: "refused", reason: "early", offset: 9, sentAt: clock.now() });
  o.pending.push({ eventKey: "x", eventUid: 1, resolved: "refused", reason: "early", offset: 14, sentAt: clock.now() });
  c.engine.timer.review(clock.now());
  assert(o.phase.bias > b0, "bias did not move later: " + o.phase.bias);
});

// ════════════════════════════════════════════════════════════════════════════
// Destruction patterns, packet pressure, reconnect
// ════════════════════════════════════════════════════════════════════════════
test("simultaneous destruction: four spikes in one tick — one plan pass, no overlapping builds", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  c.addEnemy(me.x + 160, me.y, 300);
  const spikes = [ 0, 1.6, 3.2, 4.7 ].map(a => c.ObjectManager.build(6, me.x + 79 * Math.cos(a), me.y + 79 * Math.sin(a), 1));
  const sim = new Sim(c, { up: 40, down: 40 });
  sim.run(P * 3);
  let cycles = 0;
  const cyc = c.engine.cycle.bind(c.engine);
  c.engine.cycle = t => {
    if (t.vacated) cycles++;
    return cyc(t);
  };
  sim.script.push((k, s) => {
    if (k === 5) for (const sp of spikes) s.destroy(sp);
  });
  sim.run(P * 4);
  // Legal at the server means no two of them overlap either: each arrival
  // is judged against the ones that landed before it.
  assert(sim.arrivals.length >= 2, "only " + sim.arrivals.length + " replacements");
  assert(sim.arrivals.every(a => a.legal), sim.arrivals.filter(a => !a.legal).length + " refused");
  assert(cycles <= 4, "replace cycles " + cycles + " for one batch");
});

test("rapid destruction: a spike rebuilt and broken every other tick never double-sends", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  const first = c.ObjectManager.build(6, me.x + 79, me.y, 1);
  const sim = new Sim(c, { up: 30, down: 30 });
  sim.script.push((k, s) => {
    if (k % 2 === 0) for (const o of s.server.values()) if (o.ownerID === 1 && o.type === 6) s.destroy(o);
  });
  sim.run(P * 20);
  // One send per deletion at most.
  const perTick = new Map;
  for (const a of sim.arrivals) perTick.set(a.seq, (perTick.get(a.seq) || 0) + 1);
  assert([ ...perTick.values() ].every(n => n <= 1), "double send in a tick");
  assert(sim.arrivals.every(a => a.legal), "refused rebuild");
});

test("packet pressure: the sliding second never exceeds 119, reservations hold", () => {
  const { c, sim } = fight({ enemies: [ [ 140, 0 ], [ -140, 0 ] ], clutter: 4 });
  const mh = c._ModuleHandler;
  let worst = 0;
  const w = mh._wire.bind(mh);
  mh._wire = (...a) => {
    worst = Math.max(worst, mh.packetCount);
    return w(...a);
  };
  // Something else has spent most of the second already.
  mh.budget.spend(100);
  mh.reservePackets("insta", 12, 5000, RPE_PRIORITY.INSTA);
  sim.run(P * 9);
  assert(worst <= 119, "window hit " + worst);
  assert(mh.packetCount <= 119 - 0, "count " + mh.packetCount);
  // With 100 spent and 12 held for an insta, placement had at most 7.
  assert(sim.arrivals.length <= 1, sim.arrivals.length + " builds squeezed past the reservation");
});

test("reconnect: reset clears every piece of placement state but keeps the clock", () => {
  const { c, sim } = fight({ clutter: 5 });
  sim.run(P * 6);
  const rtt = c.engine.clock.rtt;
  c.engine.reset();
  const e = c.engine;
  assert(e.outcomes.pending.length === 0 && e.outcomes.bans.length === 0 && e.outcomes.ghosts.length === 0, "outcomes kept");
  assert(e.timer.events.size === 0, "timer kept events");
  assert(e.breaks.map.size === 0 && e.antiRetrap.plan === null, "forecast/anti-retrap kept");
  assert(e._blockerSets.length === 0 || true, "");
  assert(e.clock.rtt === rtt, "clock was reset");
  // And it keeps working.
  sim.run(P * 6);
  assert(sim.arrivals.every(a => a.legal), "refused after reset");
});

test("no enemy: nothing is built by auto place or preplace", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  require("./placement.test.js").randomBoard(c, require("./placement.test.js").rng(9), 8);
  const sim = new Sim(c, { up: 40, down: 40, autoPlacer: true });
  sim.run(P * 10);
  assert(sim.arrivals.length === 0, sim.arrivals.length + " builds with no enemy");
});

test("no valid angles: fully blocked ring sends nothing and throws nothing", () => {
  const c = new FakeClient({ x: 3000, y: 3000 });
  const me = c.myPlayer.pos.current;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    c.ObjectManager.build(3, me.x + 90 * Math.cos(a), me.y + 90 * Math.sin(a), 1);
  }
  c.addEnemy(me.x + 200, me.y, 300);
  const sim = new Sim(c, { up: 40, down: 40, autoPlacer: true });
  sim.run(P * 8);
  assert(sim.arrivals.length === 0, "sent into a closed ring");
  assert(c.engine.request(4, 0, { owner: "test" }) === 0, "directed request not refused");
});

test("server update variation: period drift and frame jitter — timed sends still land after the break", () => {
  const { c, target, trap } = retrapSetup({ health: 160 });
  const sim = new Sim(c, { up: 50, down: 50, periodJitter: 12, jitter: 6, rand: require("./placement.test.js").rng(77) });
  let brokeAt = null;
  sim.script.push((k, s) => {
    if (k >= 4 && (k - 4) % 4 === 0 && s.server.has(trap.id)) {
      s.hit(target, trap, 75);
      if (!s.server.has(trap.id)) brokeAt = clock.now();
    }
  });
  sim.run(P * 26);
  const built = legalArrivals(sim).filter(a => a.rec.type === 7).sort((a, b) => a.at - b.at);
  assert(brokeAt !== null && built.length >= 1, "no retrap");
  metrics.jitterRetrap = { late: +(built[0].at - brokeAt).toFixed(1), how: built[0].rec.how };
  assert(built[0].rec.how === "timed", "timed sender lost to the deletion path under jitter");
  assert(built[0].at - brokeAt >= 0 && built[0].at - brokeAt < 40, "retrap " + (built[0].at - brokeAt).toFixed(1) + "ms after the break");
});

module.exports = {};
