#!/usr/bin/env node
// Reads a Crab King recording (Ryn's menu: Misc -> Crab King recorder -> Save recording)
// and measures the King from it: its attacks (the warnings W: kind, size, time, line
// length, where, how far you were, its health), their order and the gaps between them,
// what each did to the players (damage, push), how fast it moves in each state, its dives,
// its crabs, its healing, where it went.
//
//   node tools/king-analyze.js crabking-XXXX.json [--json out.json]
//
// Times are the game's: ticks of 1000/9 ms where the recording counts ticks, and the
// page's clock otherwise (the server sends a tick's packets together).

const fs = require("fs");

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
if (!file) {
  console.error("usage: node tools/king-analyze.js <recording.json> [--json out.json]");
  process.exit(2);
}
const rec = JSON.parse(fs.readFileSync(file, "utf8"));
const TICK = rec.tickMs || 1000 / 9;
const DECEL = 0.993;
const POOLS = [ [ -2500, 7200, 1150 ], [ -3300, 6750, 750 ], [ -3200, 7750, 700 ], [ -1700, 6900, 600 ], [ -1800, 7550, 600 ] ];
const KIND = { 0: "splash", 1: "ring", 2: "splash 2", 3: "hit circle", 4: "charge line" };

const frames = rec.frames || [];
const events = rec.events || [];
const me = rec.me;
const byTick = new Map(frames.map(f => [ f.tick, f ]));
const kingAt = tick => {
  for (let t = tick; t > tick - 3; t--) {
    const f = byTick.get(t);
    if (f && f.king) return f.king;
  }
  return null;
};
const playerAt = (tick, sid) => {
  const f = byTick.get(tick);
  return f ? f.players.find(p => p[0] === sid) || null : null;
};

// ---- small statistics ----
const sorted = a => a.slice().sort((x, y) => x - y);
const median = a => {
  if (!a.length) return null;
  const s = sorted(a);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (a, p) => (a.length ? sorted(a)[Math.min(a.length - 1, Math.floor(a.length * p))] : null);
const r1 = v => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
const r3 = v => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);
const spread = a => (a.length ? { n: a.length, median: r1(median(a)), min: r1(Math.min(...a)), p90: r1(pct(a, 0.9)), max: r1(Math.max(...a)) } : { n: 0 });
const values = a => {
  const c = {};
  for (const v of a) c[v] = (c[v] || 0) + 1;
  return Object.entries(c).sort((x, y) => y[1] - x[1]).map(([v, n]) => v + (n > 1 ? " (x" + n + ")" : ""));
};
const angleDiff = (a, b) => Math.abs(((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);

const out = { file, recorded: rec.started, host: rec.host, me };

// ---- the recording ----
const kingFrames = frames.filter(f => f.king);
const span = frames.length ? (frames[frames.length - 1].t - frames[0].t) / 1000 : 0;
out.recording = {
  seconds: Math.round(span),
  ticks: frames.length,
  kingTicks: kingFrames.length,
  crabTicks: frames.filter(f => f.crabs.length).length,
  ping: spread(frames.map(f => f.ping).filter(Number.isFinite)),
  warnings: events.filter(e => e[2] === "W").length
};

// ---- its states (0 up, 1 going under, 2 under, 3 coming up) ----
const runs = [];
for (const f of kingFrames) {
  const st = f.king[5];
  const last = runs[runs.length - 1];
  if (last && last.state === st && f.tick === last.endTick + 1) {
    last.endTick = f.tick;
    last.endT = f.t;
  } else runs.push({ state: st, startTick: f.tick, endTick: f.tick, startT: f.t, endT: f.t });
}
const stateMs = st => runs.filter((r, i) => r.state === st && i > 0 && i < runs.length - 1).map(r => (r.endTick - r.startTick + 1) * TICK);
out.states = { goingUnder: spread(stateMs(1)), under: spread(stateMs(2)), comingUp: spread(stateMs(3)) };

// ---- its movement ----
const steps = { walk: [], under: [], charge: [], up: [], goingUnder: [] };
const turns = [];
const lineWindows = events.filter(e => e[2] === "W" && e[3][0] === 4).map(e => [ e[0] + e[3][4], e[0] + e[3][4] + 6000 ]);
const inLine = t => lineWindows.some(w => t >= w[0] && t <= w[1]);
for (let i = 1; i < kingFrames.length; i++) {
  const a = kingFrames[i - 1], b = kingFrames[i];
  if (b.tick !== a.tick + 1 || a.king[0] !== b.king[0]) continue;
  const d = Math.hypot(b.king[1] - a.king[1], b.king[2] - a.king[2]);
  if (d > 2000) continue; // respawned
  const st = b.king[5];
  if (st === 2) steps.under.push(d);
  else if (st === 1) steps.goingUnder.push(d);
  else if (st === 3) steps.up.push(d);
  else if (inLine(b.t) && d > 1) steps.charge.push(d);
  else {
    steps.walk.push(d);
    if (d > 0.5) turns.push(angleDiff(b.king[3], a.king[3]));
  }
}
out.movement = {
  perTick: { walking: spread(steps.walk), charging: spread(steps.charge), underWater: spread(steps.under), goingUnder: spread(steps.goingUnder), comingUp: spread(steps.up) },
  turnPerTick: spread(turns.map(t => t * 1000).filter(t => t > 0.01)),
  note: "units a tick; turn in milliradians a tick while walking"
};

// ---- its attacks ----
const warns = events.filter(e => e[2] === "W").map(e => {
  const [ kind, x, y, r, ms, x2, y2 ] = e[3];
  const k = kingAt(e[1]);
  const mine = me !== null && me !== undefined ? playerAt(e[1], me) : null;
  const w = { t: e[0], tick: e[1], kind, name: KIND[kind] || "kind " + kind, x, y, r, ms, len: Math.round(Math.hypot((x2 ?? x) - x, (y2 ?? y) - y)) };
  if (k) {
    w.fromKing = Math.round(Math.hypot(x - k[1], y - k[2]));
    w.kingHealth = r3(k[4] / 480000);
    w.kingState = k[5];
    if (mine) w.youFromKing = Math.round(Math.hypot(mine[1] - k[1], mine[2] - k[2]));
  }
  if (mine) w.youFromIt = Math.round(Math.hypot(mine[1] - x, mine[2] - y));
  return w;
});
out.attacks = {};
for (const kind of [ ...new Set(warns.map(w => w.kind)) ].sort()) {
  const list = warns.filter(w => w.kind === kind);
  out.attacks[KIND[kind] || "kind " + kind] = {
    count: list.length,
    radius: values(list.map(w => w.r)),
    ms: values(list.map(w => w.ms)),
    lineLength: kind === 4 ? spread(list.map(w => w.len)) : undefined,
    fromKing: spread(list.filter(w => w.fromKing !== undefined).map(w => w.fromKing)),
    youFromKingWhenChosen: spread(list.filter(w => w.youFromKing !== undefined).map(w => w.youFromKing)),
    kingHealthWhenChosen: spread(list.filter(w => w.kingHealth !== undefined).map(w => w.kingHealth * 100))
  };
}
// order and gaps (a warning group: those that start in the same tick)
const groups = [];
for (const w of warns) {
  const g = groups[groups.length - 1];
  if (g && g.tick === w.tick) g.kinds.push(w.kind);
  else groups.push({ tick: w.tick, t: w.t, kinds: [ w.kind ] });
}
out.order = groups.slice(0, 80).map(g => g.kinds.map(k => KIND[k] || k).join("+")).join(" > ");
out.gapsMs = spread(groups.slice(1).map((g, i) => g.t - groups[i].t));
out.together = values(groups.map(g => g.kinds.length + " at once"));

// ---- what each did: damage and the push, to every player near ----
const health = {};
const drops = [];
for (const e of events) {
  if (e[2] !== "O") continue;
  const [ sid, h ] = e[3];
  if (health[sid] !== undefined && h < health[sid]) drops.push({ t: e[0], tick: e[1], sid, dmg: Math.round((health[sid] - h) * 100) / 100 });
  health[sid] = h;
}
const anims = events.filter(e => e[2] === "J");
out.effects = {};
for (const kind of [ ...new Set(warns.map(w => w.kind)) ].sort()) {
  const dmg = [], push = [], jGap = [];
  for (const w of warns.filter(x => x.kind === kind)) {
    const end = w.t + w.ms;
    const until = kind === 4 ? end + 6000 : end + 400;
    for (const d of drops) {
      if (d.t < end - 200 || d.t > until) continue;
      const p0 = playerAt(d.tick - 1, d.sid), p1 = playerAt(d.tick, d.sid), p2 = playerAt(d.tick + 1, d.sid);
      if (kind !== 4 && p1 && Math.hypot(p1[1] - w.x, p1[2] - w.y) > w.r + 200) continue;
      dmg.push(d.dmg);
      // the push: the speed it added, from how far they went the next tick (the game slows
      // a velocity by 0.993 a ms; a push v moves them v x 111 ms the first tick)
      // (their own walking cancels out: the step after minus the step before, as vectors)
      if (p0 && p1 && p2) push.push(Math.hypot(p2[1] - 2 * p1[1] + p0[1], p2[2] - 2 * p1[2] + p0[2]) / TICK);
    }
    const j = anims.find(a => Math.abs(a[0] - end) < 400);
    if (j) jGap.push(j[0] - end);
  }
  out.effects[KIND[kind] || "kind " + kind] = { damage: values(dmg), push: spread(push.map(v => v * 1000)), jAnimationAfterEndMs: spread(jGap), note: "push in units a second (0.6 a ms = 600)" };
}
out.jAnimations = anims.length;

// ---- its crabs ----
const crabFirst = new Map();
for (const f of frames) for (const c of f.crabs) if (!crabFirst.has(c[0])) crabFirst.set(c[0], { t: f.t, tick: f.tick, index: c[1], state: c[6], king: f.king ? r3(f.king[4] / 480000) : null });
const waves = [];
for (const [ sid, c ] of [ ...crabFirst.entries() ].sort((a, b) => a[1].t - b[1].t)) {
  const w = waves[waves.length - 1];
  if (w && c.t - w.t < 2000) w.crabs.push(c.index);
  else waves.push({ t: c.t, king: c.king, crabs: [ c.index ], firstState: c.state });
}
out.crabs = {
  waves: waves.map((w, i) => ({ afterMs: i ? w.t - waves[i - 1].t : null, kingHealth: w.king !== null ? Math.round(w.king * 100) + "%" : "?", kinds: values(w.crabs.map(k => (k === 13 ? "Crab" : "Crabling"))), cameUpState: w.firstState })),
  mostAtOnce: Math.max(0, ...frames.map(f => f.crabs.length)),
  states: values(frames.flatMap(f => f.crabs.map(c => c[6]))),
  pace: spread((() => {
    const s = [];
    for (let i = 1; i < frames.length; i++) {
      if (frames[i].tick !== frames[i - 1].tick + 1) continue;
      for (const c of frames[i].crabs) {
        const p = frames[i - 1].crabs.find(x => x[0] === c[0]);
        if (p) s.push(Math.hypot(c[2] - p[2], c[3] - p[3]));
      }
    }
    return s;
  })())
};

// ---- its health: healing, deaths, coming back ----
const heals = { under: [], up: [] };
for (let i = 1; i < kingFrames.length; i++) {
  const a = kingFrames[i - 1], b = kingFrames[i];
  if (b.tick !== a.tick + 1) continue;
  const gain = b.king[4] - a.king[4];
  if (gain > 0) (b.king[5] === 2 ? heals.under : heals.up).push(gain / (TICK / 1000) / 4800);
}
const deaths = [];
for (let i = 1; i < kingFrames.length; i++) {
  const a = kingFrames[i - 1], b = kingFrames[i];
  if (b.king[0] !== a.king[0] || Math.hypot(b.king[1] - a.king[1], b.king[2] - a.king[2]) > 2000 || (b.king[4] > a.king[4] * 2 && a.king[4] < 48000)) deaths.push({ lastSeen: a.t, back: b.t, afterS: Math.round((b.t - a.t) / 1000) });
}
out.health = {
  healPercentPerSecond: { underWater: spread(heals.under), onTop: spread(heals.up) },
  deathsAndReturns: deaths
};

// ---- where it went ----
const inPools = (x, y, r) => POOLS.some(c => Math.hypot(x - c[0], y - c[1]) <= c[2] - r);
const edge = (x, y) => Math.max(...POOLS.map(c => c[2] - Math.hypot(x - c[0], y - c[1])));
out.arena = {
  king: kingFrames.length ? { x: [ Math.min(...kingFrames.map(f => f.king[1])), Math.max(...kingFrames.map(f => f.king[1])) ], y: [ Math.min(...kingFrames.map(f => f.king[2])), Math.max(...kingFrames.map(f => f.king[2])) ], ticksOutsideItsPools: kingFrames.filter(f => !inPools(f.king[1], f.king[2], 280)).length, closestToAPoolEdge: r1(Math.min(...kingFrames.map(f => edge(f.king[1], f.king[2])))) } : null,
  crabs: { ticksOutsidePools: frames.reduce((n, f) => n + f.crabs.filter(c => !inPools(c[2], c[3], c[1] === 13 ? 78 : 39)).length, 0) }
};

// ---- print ----
const show = (title, obj) => {
  console.log("\n== " + title);
  console.log(JSON.stringify(obj, null, 1).replace(/\n\s*([\]}])/g, " $1").replace(/\[\n\s*/g, "[").replace(/,\n\s+(?=[\d"-])/g, ", "));
};
console.log("Crab King recording: " + file + (rec.host ? " (" + rec.host + ", " + rec.started + ")" : ""));
show("Recording", out.recording);
show("States (ms)", out.states);
show("Movement", out.movement);
show("Attacks (warnings)", out.attacks);
console.log("\n== Order\n" + out.order);
show("Gaps between attacks (ms), how many at once", { gaps: out.gapsMs, together: out.together });
show("What they did", out.effects);
show("Crabs", out.crabs);
show("Health", out.health);
show("Arena", out.arena);
if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(out, null, 2));
  console.log("\nWritten: " + jsonOut);
}
