/* The automatic Q: which guard actually stops the shame, and what it costs.
 *
 * v5.4 took novastorm's autoheal whole, which means an unconditional food
 * press. In play that reads as Q being held down and shame arriving in
 * seconds. This measures why, and what each candidate guard does about it,
 * against the game's OWN shame rule — not a model of it. X_Precision ships the
 * server code verbatim at 18516:
 *
 *     if (this.hitTime) {
 *         var timeSinceHit = Date.now() - this.hitTime;
 *         this.hitTime = 0;                    // only the FIRST food after a
 *         if (timeSinceHit <= 120) {           // hit is ever judged
 *             this.shameCount++;
 *             if (this.shameCount >= 8) { this.shameTimer = 30000; this.shameCount = 0; }
 *         } else {
 *             this.shameCount -= 2;            // floored at 0
 *         }
 *     }
 *     if (this.shameTimer <= 0) worked = item.consume(this);   // <- AFTER
 *
 * Two things fall out of those ten lines, and they are the whole story:
 *
 *   1. The shame arithmetic runs ABOVE the `shameTimer <= 0` refusal. Food
 *      sent during the 30s lock is thrown away AND still counted, so it can
 *      take the count back to 8 and re-arm another 30 seconds. And because the
 *      food never lands, health never rises, so `tempHealth < maxHealth` stays
 *      true and the rule asks again next tick — for thirty seconds. That is
 *      the Q that never lets go.
 *
 *   2. Only the FIRST food after each hit is judged. In a fight that is the
 *      emergency press, which goes out on the tick the health drop is seen —
 *      about one tick plus a round trip after the hit. On a good connection
 *      that is inside 120ms, so it is +1 shame per hit rather than -2.
 *      Eight of those is a lock.
 *
 * The candidates are measured one at a time so the table says which one does
 * the work. Four of the seven are here because they did NOT work, and the
 * table is the reason they are not in the client:
 *
 *   · "window, bypass" is inert. Letting an emergency press through defeats
 *     the guard completely, because the shaming press IS the emergency press.
 *   · "lock + wait forever" starves. Under damage every tick the window never
 *     opens, and at ping 30 and 100 it never eats at all.
 *   · "lock + wait unless held" collapses back to the lock guard: a burst is
 *     three consecutive ticks of damage, so "hits back to back" does not
 *     separate a burst you survive from a spike you do not.
 *
 *   node auto-q.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const TICK = 111;
const RESTORE = 20;
const MAX_HP = 100;
const PLACE_PACKETS = 4;
const SHAME_WINDOW = 125;   // the server's 120, plus a tick of margin

/* The row marked "<-" is not a description of the client, it IS the client:
 * ModuleHandler._foodIsShameSafe is lifted out of the file and asked the same
 * question on the same ticks. If someone edits that method, this table moves. */
const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/RYN_Client_v5.4.user.js");
const src = fs.readFileSync(RYN, "utf8");
const lifted = (() => {
  const m = /\n {4}_foodIsShameSafe\(\) \{/.exec(src);
  if (!m) throw new Error("_foodIsShameSafe is gone from the client");
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index + 1, i + 1); }
  }
  throw new Error("unbalanced _foodIsShameSafe");
})();
if (!/const SHAME_SAFE_WINDOW = (\d+);/.exec(src)) throw new Error("SHAME_SAFE_WINDOW is gone");
const CLIENT_WINDOW = Number(/const SHAME_SAFE_WINDOW = (\d+);/.exec(src)[1]);
if (CLIENT_WINDOW !== SHAME_WINDOW) {
  throw new Error("the client's window is " + CLIENT_WINDOW + ", this bench assumes " + SHAME_WINDOW);
}
// heal()'s own first guard, lifted the same way rather than restated.
if (!/heal\(\) \{[\s\S]{0,900}?if \(myPlayer && myPlayer\.shameActive\) \{\s*return;/.test(src)) {
  throw new Error("heal() no longer stands down during the shame lock");
}
const box = { SHAME_SAFE_WINDOW: CLIENT_WINDOW, Infinity, Date: { now: () => box.__now } };
vm.createContext(box);
vm.runInContext(
  "this.MH = { tickCount: 0, _foodHeldTick: -1, _foodFreeTick: -1," +
  "  client: { myPlayer: { receivedDamage: null }, SocketManager: { pong: 0 } }," +
  lifted + " };", box);
const MH = box.MH;

// ── the server, quoted above ──────────────────────────────────────────────
class Server {
  constructor() {
    this.health = MAX_HP;
    this.hitTime = 0;
    this.shameCount = 0;
    this.shameTimer = 0;
    this.locks = 0;
    this.deaths = 0;
    this.refused = 0;       // food that arrived while locked: spent, no effect
    this.judged = { plus: 0, minus: 0 };
  }
  advance(dt) {
    if (this.shameTimer > 0) this.shameTimer = Math.max(0, this.shameTimer - dt);
  }
  damage(now, amount) {
    this.health -= amount;
    this.hitTime = now;
    if (this.health <= 0) { this.deaths++; this.health = MAX_HP; }
  }
  consume(now) {
    if (this.hitTime) {
      const since = now - this.hitTime;
      this.hitTime = 0;
      if (since <= 120) {
        this.judged.plus++;
        this.shameCount++;
        if (this.shameCount >= 8) { this.shameTimer = 30000; this.shameCount = 0; this.locks++; }
      } else {
        this.judged.minus++;
        this.shameCount = Math.max(0, this.shameCount - 2);
      }
    }
    if (this.shameTimer > 0) { this.refused++; return; }
    if (this.health >= MAX_HP) return;
    this.health = Math.min(MAX_HP, this.health + RESTORE);
  }
}

/* novastorm 15697 / X_Precision 14905, which is what v5.4 shipped:
 *
 *     if (((healing && shameCount < 7) || (tick - damageTick) > 0) && health < 100)
 *         heal(100 - health);
 *
 * `guards` is the only thing that varies between rows.
 */
function rule(s, guards, mem) {
  const healing = s.knownHealth <= s.dmgPot;
  const quiet = s.tick - s.damageTick > 0;
  if (!(((healing && s.knownShame < 7) || quiet) && s.knownHealth < MAX_HP)) return 0;

  // GUARD "lock": the food cannot be consumed and can re-arm the timer.
  if (guards.lock && s.shameActive) return 0;

  // GUARD "window": would this press land inside the server's 120ms? It leaves
  // now and arrives half a round trip later; the hit happened half a round trip
  // before the client saw it. So arrival-minus-hit is now - lastSeenHit + pong.
  //
  // GUARD "lifted": the client's own _foodIsShameSafe, asked the same question.
  if (guards.lifted) {
    box.__now = s.now;
    MH.tickCount = s.tick;
    MH.client.myPlayer.receivedDamage = s.hitAt;
    MH.client.SocketManager.pong = s.ping;
    if (!MH._foodIsShameSafe()) return 0;
  } else {
    const safeTime = !s.lastSeenHit || (s.now - s.lastSeenHit + s.ping) >= SHAME_WINDOW;
    if (guards.window && !safeTime) {
      const sustained = guards.sustained && s.sawHit && mem.lastHit === s.tick - 1;
      const forced = (guards.emergencyBypass && healing) || sustained ||
                     (guards.holdOnce && mem.held);
      if (!forced) { mem.held = true; return 0; }
    }
    mem.held = false;
  }

  let presses = 0;
  for (let i = 0; i < MAX_HP - s.knownHealth; i += RESTORE) presses++;
  return presses;
}

function run(guards, script, ping, seconds) {
  const srv = new Server();
  const half = ping / 2;
  const inbound = [];
  const outbound = [];
  const st = {
    tick: 0, damageTick: -1, now: 0, ping,
    knownHealth: MAX_HP, knownShame: 0, shameActive: false,
    lastSeenHit: 0, dmgPot: 0, sawHit: false,
    // The client's own myPlayer.receivedDamage: stamped when a hit is seen,
    // and cleared the moment health is seen to rise — which is the same moment
    // the server clears hitTime.
    hitAt: null,
  };

  let apples = 0, pressTicks = 0;
  const mem = { held: false, lastHit: -99 };
  MH._foodHeldTick = -1;
  MH._foodFreeTick = -1;
  const total = Math.round((seconds * 1000) / TICK);

  for (let t = 0; t < total; t++) {
    const now = t * TICK;
    st.now = now; st.tick = t;
    if (st.sawHit) mem.lastHit = t - 1;
    st.sawHit = false;
    srv.advance(TICK);

    const dmg = script(t);
    if (dmg > 0) srv.damage(now, dmg);

    while (inbound.length && inbound[0].at <= now) {
      const e = inbound.shift();
      if (e.health > st.knownHealth) st.hitAt = null;
      st.knownHealth = e.health; st.knownShame = e.shame; st.shameActive = e.shameActive;
      if (e.hit) { st.damageTick = t + 1; st.lastSeenHit = now; st.sawHit = true; st.hitAt = now; }
    }
    inbound.push({ at: now + half, health: srv.health, shame: srv.shameCount,
                   shameActive: srv.shameTimer > 0, hit: dmg > 0 });

    st.dmgPot = dmg > 0 ? Math.min(140, dmg * 2) : (now - st.lastSeenHit < 400 ? 40 : 0);

    const count = rule(st, guards, mem);
    if (count > 0) {
      apples += count;
      pressTicks++;
      for (let i = 0; i < count; i++) outbound.push({ at: now + half + i * 2 });
    }
    while (outbound.length && outbound[0].at <= now + TICK) srv.consume(outbound.shift().at);
  }

  return {
    apples, packets: apples * PLACE_PACKETS,
    perSec: apples / seconds,
    pressTicks: (pressTicks / total) * 100,
    refused: srv.refused, locks: srv.locks, deaths: srv.deaths,
    plus: srv.judged.plus, minus: srv.judged.minus,
  };
}

const SCRIPTS = {
  "trade, a hit every 5 ticks": (t) => (t % 5 === 0 ? 35 : 0),
  "burst, 3 ticks on 12 off":   (t) => (t % 15 < 3 ? 30 : 0),
  "spike pressure, every tick": (t) => 12,
};
// The first two are fights. The third is a death loop — 12 damage every single
// tick, no gap, ever — and nothing in the table survives it: every candidate
// dies about once a second. It is here because it is the one shape where
// holding a press costs anything, and that cost should be visible.
const SURVIVABLE = ["trade, a hit every 5 ticks", "burst, 3 ticks on 12 off"];

const PINGS = [30, 100, 200];
const SECONDS = 40;

const MODELLED = { lock: true, window: true, holdOnce: true };
const SHIPPED = { lock: true, lifted: true };
const CANDIDATES = [
  ["v5.4 as shipped", {}],
  ["lock", { lock: true }],
  ["window, bypass", { window: true, emergencyBypass: true }],
  ["lock + bypass", { lock: true, window: true, emergencyBypass: true }],
  ["lock + wait forever", { lock: true, window: true }],
  ["lock + wait unless held", { lock: true, window: true, sustained: true }],
  ["lock + wait 1 tick", MODELLED],
  ["RYN v5.4 now  <-", SHIPPED],
];

const pad = (s, n) => String(s).padEnd(n);
console.log("the automatic Q — one guard at a time, against the game's own shame rule\n");
console.log("  " + SECONDS + "s per row. \"judged +1\" is a food that reached the server within");
console.log("  120ms of a hit; \"judged -2\" is one that did not. Eight +1 is a 30s lock.");
console.log("  \"refused\" is food spent while locked: no health from it, and it still counts.\n");

const totals = {};
for (const [label] of CANDIDATES) totals[label] = { apples: 0, refused: 0, locks: 0, deaths: 0, plus: 0, minus: 0 };

for (const [name, script] of Object.entries(SCRIPTS)) {
  console.log("  " + name + (SURVIVABLE.includes(name) ? "" : "   (a death loop — see the note in this file)"));
  console.log("  " + pad("ping", 7) + pad("guards", 25) + pad("Q/sec", 8) + pad("ticks Q'd", 11) +
    pad("refused", 9) + pad("judged +1", 11) + pad("judged -2", 11) + pad("locks", 7) + "deaths");
  console.log("  " + "-".repeat(103));
  for (const ping of PINGS) {
    for (const [label, guards] of CANDIDATES) {
      const r = run(guards, script, ping, SECONDS);
      const a = totals[label];
      a.apples += r.apples; a.refused += r.refused; a.locks += r.locks;
      a.deaths += r.deaths; a.plus += r.plus; a.minus += r.minus;
      console.log("  " + pad(ping, 7) + pad(label, 25) + pad(r.perSec.toFixed(1), 8) +
        pad(r.pressTicks.toFixed(0) + "%", 11) + pad(r.refused, 9) + pad(r.plus, 11) +
        pad(r.minus, 11) + pad(r.locks, 7) + r.deaths);
    }
    console.log("");
  }
}

console.log("  totals across every row");
console.log("  " + pad("guards", 25) + pad("apples", 9) + pad("refused", 10) +
  pad("judged +1", 11) + pad("judged -2", 11) + pad("locks", 8) + "deaths");
console.log("  " + "-".repeat(83));
for (const [label] of CANDIDATES) {
  const a = totals[label];
  console.log("  " + pad(label, 25) + pad(a.apples, 9) + pad(a.refused, 10) +
    pad(a.plus, 11) + pad(a.minus, 11) + pad(a.locks, 8) + a.deaths);
}

/* What the shipped guard has to satisfy. These are properties, not a snapshot
 * of the numbers above: each is checked on every fight and every ping. */
const rows = [];
for (const [name, script] of Object.entries(SCRIPTS)) {
  for (const ping of PINGS) {
    rows.push({ name, ping, live: SURVIVABLE.includes(name),
                base: run({}, script, ping, SECONDS),
                fixed: run(SHIPPED, script, ping, SECONDS) });
  }
}
const sum = (sel, pick) => rows.filter(sel).reduce((a, r) => a + pick(r), 0);
const all = () => true;
const live = (r) => r.live;

const checks = [
  ["food sent into the 30s lock all but disappears (99% less)",
   sum(all, r => r.fixed.refused) <= sum(all, r => r.base.refused) * 0.01],
  ["shame locks drop at least fivefold across the table",
   sum(all, r => r.fixed.locks) * 5 <= sum(all, r => r.base.locks)],
  ["food now counts DOWN more often than up; before, it counted up",
   sum(all, r => r.fixed.minus) > sum(all, r => r.fixed.plus) &&
   sum(all, r => r.base.minus) < sum(all, r => r.base.plus)],
  ["on a fight anyone survives it never takes more shame than before",
   rows.filter(live).every(r => r.fixed.plus <= r.base.plus)],
  // At a 200ms round trip the hit the client is aiming away from is already
  // stale: during a burst the server has taken another hit that this client
  // will not see for another half trip, and it is the newest hit the server
  // measures against. Nothing on this side can close that gap, so the guard
  // stops helping there rather than starting to hurt.
  ["and at a 100ms round trip or better it takes none at all",
   rows.filter(r => r.live && r.ping <= 100).every(r => r.fixed.plus === 0)],
  ["and on those fights it eats at least as often as before",
   rows.filter(live).every(r => r.fixed.apples >= r.base.apples)],
  ["nobody dies who did not die before, on any survivable fight",
   rows.filter(live).every(r => r.fixed.deaths <= r.base.deaths)],
  ["the guard never stops the eating outright, even under damage every tick",
   rows.every(r => r.fixed.apples > 0)],
  // The client's method and the model of it are two separate descriptions of
  // the same rule. If they ever stop agreeing, one of them is wrong and the
  // table above is not about the shipped code any more.
  ["the client's own method agrees with the model of it on every row",
   Object.entries(SCRIPTS).every(([, script]) => PINGS.every(ping =>
     JSON.stringify(run(MODELLED, script, ping, SECONDS)) ===
     JSON.stringify(run(SHIPPED, script, ping, SECONDS))))],
];

console.log("");
let bad = 0;
for (const [label, ok] of checks) {
  if (!ok) bad++;
  console.log("  " + (ok ? "ok  " : "FAIL") + "  " + label);
}

const dLive = sum(live, r => r.fixed.deaths) - sum(live, r => r.base.deaths);
const dAll = sum(all, r => r.fixed.deaths) - sum(all, r => r.base.deaths);
console.log("\n  Cost, stated plainly: deaths across the whole table go " +
  (dAll >= 0 ? "UP by " + dAll : "DOWN by " + -dAll) + ", and every one");
console.log("  of them is on the death-loop row (survivable fights: " +
  (dLive === 0 ? "no change" : dLive) + "). Holding a press one tick costs");
console.log("  something only when the damage never stops, and there you are dying either way.");

console.log("\n  " + (bad === 0
  ? "the lock guard stops the runaway; the one-tick wait stops the counting up"
  : bad + " property above does not hold"));
process.exit(bad === 0 ? 0 : 1);
