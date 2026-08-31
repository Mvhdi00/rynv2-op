#!/usr/bin/env node
/*
 * check-spike-tick.js
 *
 * The spike-tick modules place nothing unless preplace happens to be on.
 * SpikeTickController is a timing layer over the placement engine, and two
 * pieces of engine state it leans on only exist while the engine is planning —
 * which it only does when `_prePlace` is set:
 *
 *   · The ledger's only expire() call sits below the engine's early return, so
 *     with preplace off nothing ever expires. Every place() in the client
 *     reserves ground through ModuleHandler._notePlacement, so the ledger fills
 *     with permanent entries and answers "taken" forever. The controller reads
 *     that as `blocked`.
 *   · intentAt stamps a directed intent from `this._threat.frame`, only built
 *     during a cycle. With no frame the stamp writes createdTick 0, so the
 *     intent is born past RPE_INTENT_LIFETIME and the controller rejects it as
 *     `expired` on every tick after the sixth.
 *
 * This drives the real SpikeTickController with the real intentAt bound into a
 * stub engine, and checks the ledger ordering in the source. Run it against
 * stock v5.4 to see both faults, and against the build to see them gone.
 *
 *   node tools/check-spike-tick.js [path/to/client.js]
 */
const fs = require("fs");
const path = require("path");
const { classEnd } = require("./lib/extract");

const TARGET = process.argv[2] || path.join(__dirname, "..", "RYN_Client_v5.4_ReUp.user.js");
const S = fs.readFileSync(TARGET, "utf8");
const NAME = path.relative(process.cwd(), TARGET);

function span(from, to) {
  const a = S.indexOf(from);
  const b = S.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error("could not locate: " + from.trim());
  return S.slice(a, b);
}

/* One top-level object literal, cut on its own closing brace. */
function obj(name) {
  const a = S.indexOf("  const " + name + " = {");
  if (a < 0) throw new Error("no object " + name);
  const b = S.indexOf("\n  };", a);
  return S.slice(a, b + 5);
}

/* The real intentAt, lifted whole so the stamp under test is the shipped one. */
function realIntentAt() {
  const a = S.indexOf("    intentAt(type, angle, opts) {");
  if (a < 0) throw new Error("no intentAt");
  return S.slice(a, classEnd(S, a));
}

const SRC = [
  "  const RPE_PLACE_PACKETS = 5;",
  "  const RPE_INTENT_LIFETIME = 6;",
  obj("RPE_PRIORITY"),
  obj("RPE_MODE"),
  obj("RPE_INTENT"),
  obj("PlacementIntent"),
  span("  const SPIKE_TICK_PHASE = {", "  const SpikeTickController_default"),
  "  const __intentAt = { " + realIntentAt() + " };",
].join("\n");

const GameUI_default = { updateSpikeTick() {} };
const GeometrySolver = {
  norm(a) { const t = Math.PI * 2; a %= t; return a < 0 ? a + t : a; },
};

const loaded = new Function(
  "GameUI_default", "GeometrySolver",
  SRC + "\n return { SpikeTickController, PlacementIntent, RPE_PRIORITY, RPE_INTENT_LIFETIME, intentAt: __intentAt.intentAt };"
)(GameUI_default, GeometrySolver);

const { SpikeTickController, PlacementIntent, RPE_PRIORITY, RPE_INTENT_LIFETIME, intentAt } = loaded;

/* ---- the ledger, as the client's own one behaves ---- */
function makeLedger() {
  const entries = [];
  return {
    entries,
    reserve(x, y, radius, priority, owner, tick, ttl) {
      const token = entries.length + 1;
      entries.push({ x, y, radius, priority, owner, expires: tick + ttl, token, soft: false, value: 0 });
      return token;
    },
    expire(tick) {
      for (let i = entries.length - 1; i >= 0; i--) if (entries[i].expires <= tick) entries.splice(i, 1);
    },
    blocked: (x, y, radius) => entries.some((e) => Math.hypot(x - e.x, y - e.y) < radius + e.radius),
    releaseToken() {},
  };
}

const vec = (x, y) => ({
  x, y,
  angle: (o) => Math.atan2(o.y - y, o.x - x),
  distance: (o) => Math.hypot(o.x - x, o.y - y),
});

function makeClient(tick, opts) {
  opts = opts || {};
  const sent = [];
  const ledger = makeLedger();
  const profile = { type: 4, isDamage: true, footR: 35, ringR: 85 };
  const enemy = { id: 7, pos: { current: vec(100, 0), future: vec(100, 0) }, collisionScale: 35, hitScale: 63 };
  const client = {
    sent, enemy, ledger,
    isOwner: true,
    myPlayer: { pos: { current: vec(0, 0) }, canPlace: () => true },
    EnemyManager: { nearestEnemy: enemy },
    ObjectManager: {},
    _ModuleHandler: { tickCount: tick, packetLimit: 70, packetCount: 0, staticModules: {} },
  };
  const engine = {
    ledger,
    client,
    book: { pending: () => [] },
    // The engine only builds a frame while planning. With preplace off there is
    // none, which is the case under test.
    _threat: { frame: opts.frame === undefined ? null : opts.frame },
    _scheduler: { affords: () => true },
    _conflicts: { availableGround: (c) => !ledger.blocked(c.x, c.y, c.profile.footR) },
    profileFor: () => profile,
    priorityFor: () => RPE_PRIORITY.SYNC,
    anglesFor: () => [0, 0.3, -0.3],
    _validAt: (cand) => !ledger.blocked(cand.x, cand.y, cand.profile.footR),
    commitIntent(intent) { sent.push(intent.angle); return 1; },
    intentAt, // the real one
  };
  client._ModuleHandler.staticModules.placementEngine = engine;
  client.engine = engine;
  return client;
}

function fire(client) {
  const ctl = new SpikeTickController(client);
  ctl.arm(client.enemy, "spikeTick");
  ctl.postTick();
  return { sent: client.sent.length, outcome: Object.keys(ctl._outcomes || {})[0] || null };
}

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + "\n         got  " + JSON.stringify(got) + "  want " + JSON.stringify(want)); }
};

console.log("\nclient under test: " + NAME);

console.log("\nan armed spike tick, with the engine not planning (preplace off)");
{
  // Sweep well past RPE_INTENT_LIFETIME: a correctly stamped intent is fresh at
  // any tick, a zero-stamped one is expired at every tick past the sixth.
  const ticks = [2, 5, 8, 20, 60, 300, 5000];
  const results = ticks.map((t) => fire(makeClient(t, { frame: null })));
  for (let i = 0; i < ticks.length; i++) {
    console.log("       tick " + String(ticks[i]).padStart(4) + " -> sent " +
      results[i].sent + ", " + results[i].outcome);
  }
  check("a spike goes out at every tick", results.map((r) => r.sent), ticks.map(() => 1));
  check("none is rejected as expired", results.every((r) => r.outcome === "placed"), true);
}

console.log("\nthe same, with the engine planning (preplace on)");
{
  const frame = { tick: 300, myPos: vec(0, 0), targetPos: vec(100, 0), target: null, targetId: 7 };
  const r = fire(makeClient(300, { frame }));
  check("a live frame still works, unchanged", [r.sent, r.outcome], [1, "placed"]);
}

console.log("\nthe ledger is maintained whether or not the engine plans");
{
  // Source-level: the engine's expire() must not sit below the early return,
  // or nothing expires on a tick where no mode is enabled.
  const post = S.indexOf("      const modes = [];");
  const gate = S.indexOf("if (modes.length === 0) {", post);
  const exp = S.indexOf("this.ledger.expire(", post);
  check("expire() runs before the no-modes return", exp > 0 && exp < gate, true);

  // Behavioural: a reservation past its ttl must not still block a spike.
  const c = makeClient(50, { frame: null });
  c.ledger.reserve(85, 0, 35, RPE_PRIORITY.SYNC, "autoPlacer", 10, 2);
  check("an unexpired stale entry does block (the fault being fixed)", fire(c).sent, 0);
  c.ledger.expire(50);
  const c2 = makeClient(50, { frame: null });
  check("once expired, the ground is free again", fire(c2).sent, 1);
}

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
