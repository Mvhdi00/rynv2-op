/* RYN's autoheal against X- Precision's, on the same fight.
 *
 * This is a MODEL, not the shipped code running. Neither client's heal path can
 * be lifted into a vm — X's lives inside one enormous inline tick block, RYN's
 * reaches through five managers — so both rules are transcribed here from
 * source, with the line each came from, and run against the same timeline.
 * Read the transcriptions before you believe the table.
 *
 * The one thing that is NOT a model is the shame rule. That is the game's own
 * server code, which X_Precision ships verbatim at line 18516:
 *
 *     if (this.hitTime) {
 *         var timeSinceHit = Date.now() - this.hitTime;
 *         this.hitTime = 0;                       // only the FIRST food after
 *         if (timeSinceHit <= 120) {              // a hit is ever judged
 *             this.shameCount++;
 *             if (this.shameCount >= 8) { this.shameTimer = 30000; this.shameCount = 0; }
 *         } else {
 *             this.shameCount -= 2;               // floored at 0
 *         }
 *     }
 *     if (this.shameTimer <= 0) worked = item.consume(this);
 *
 * Two consequences that decide this comparison, and neither is obvious:
 *   · `hitTime = 0` means a burst of five apples costs at most one shame point.
 *     Spamming food is not what gets you shamed; the TIMING of the first apple
 *     after a hit is.
 *   · shameTimer is 30 seconds during which food does nothing at all. Every
 *     apple sent inside that window is thrown away, and the packets with it.
 *
 *   node heal-duel.js
 */

const TICK = 111;          // moomoo's server tick
const RESTORE = 20;        // apple
const MAX_HP = 100;
const PLACE_PACKETS = 4;   // X's place(): selectToBuild + atck(1) + atck(0) + selectWeapon

// ── the server ────────────────────────────────────────────────────────────
class Server {
  constructor() {
    this.health = MAX_HP;
    this.hitTime = 0;
    this.shameCount = 0;
    this.shameTimer = 0;
    this.wastedShamed = 0;   // food eaten while shame-locked
    this.wastedFull = 0;     // food eaten at full health
    this.locks = 0;
    this.deaths = 0;
  }
  advance(now, dt) {
    if (this.shameTimer > 0) this.shameTimer = Math.max(0, this.shameTimer - dt);
  }
  damage(now, amount) {
    this.health -= amount;
    this.hitTime = now;
    if (this.health <= 0) { this.deaths++; this.health = MAX_HP; }
  }
  // One food packet arriving. Returns nothing; the counters are the output.
  consume(now) {
    if (this.hitTime) {
      const since = now - this.hitTime;
      this.hitTime = 0;
      if (since <= 120) {
        this.shameCount++;
        if (this.shameCount >= 8) { this.shameTimer = 30000; this.shameCount = 0; this.locks++; }
      } else {
        this.shameCount = Math.max(0, this.shameCount - 2);
      }
    }
    if (this.shameTimer > 0) { this.wastedShamed++; return; }
    if (this.health >= MAX_HP) { this.wastedFull++; return; }
    this.health = Math.min(MAX_HP, this.health + RESTORE);
  }
}

// ── X- Precision ──────────────────────────────────────────────────────────
// X_Precision_2.0.user.js:14895
//
//     if (currentHat == 6) totalDmgPot *= 0.75;
//     if (currentHat == 7) totalDmgPot += 5;
//     if (myPlayer.health <= totalDmgPot) healing = true;
//     if (((healing && myPlayer.shameCount < 7) || (tick - damageTick) > 0)
//         && myPlayer.health < 100) heal(100 - myPlayer.health);
//
// and heal() at 11759:
//
//     function heal(value) {
//         for (let i = 0; i < value; i += items.list[myPlayer.items[0]].heal)
//             place(myPlayer.items[0], null);
//     }
//
// myPlayer.health is the server's last echo. Nothing subtracts what is already
// on the wire, and nothing knows about shameTimer — the mod's only shame
// reference is nearestEnemy.shameAbuse.
class XRule {
  decide(s) {
    const healing = s.knownHealth <= s.dmgPot;
    const quiet = s.tick - s.damageTick > 0;
    if (!(((healing && s.knownShame < 7) || quiet) && s.knownHealth < MAX_HP)) return 0;
    return Math.ceil((MAX_HP - s.knownHealth) / RESTORE);
  }
}

// ── RYN v5.4 ──────────────────────────────────────────────────────────────
// RYN_Client_v5.4:14298 — same rule, four guards on top.
//
//     if (myPlayer.shameActive) return;                       // 14302
//     const quiet = this.isSaveHealTick() && this.isSaveHealTime();   // 14370
//     const inFlight = this._healsInFlight(ModuleHandler);            // 14380
//     const needTimes = Math.max(0, Math.ceil((maxHealth - tempHealth) / restore) - inFlight);
//
// isSaveHealTime() (14155): Date.now() - receivedDamage + pong >= 125
// heal() (17246): defers if within 130ms of a hit, flushes after; and refuses
// outright when fewer than 3 packets of budget are left.
class RynRule {
  constructor() { this.sent = null; this.queue = 0; this.queueDue = null; }
  decide(s) {
    if (s.shameActive) return 0;                       // food is being refused
    if (s.knownHealth >= MAX_HP) return 0;

    const healing = s.knownHealth <= s.dmgPot;
    const quietTick = s.tick - s.damageTick > 0;
    const quietTime = s.now - s.lastSeenHit + s.ping >= 125;
    if (!((healing && s.knownShame < 7) || (quietTick && quietTime))) return 0;

    // in flight: expires when the health it was sent against moves, or when
    // the round trip has had time to complete
    let inFlight = 0;
    if (this.sent) {
      if (s.knownHealth !== this.sent.health) this.sent = null;
      else if (s.tick - this.sent.tick > Math.ceil(s.ping * 2 / TICK) + 1) this.sent = null;
      else inFlight = this.sent.count;
    }
    const need = Math.max(0, Math.ceil((MAX_HP - s.knownHealth) / RESTORE) - inFlight);
    if (need === 0) return 0;
    this.sent = { count: need, tick: s.tick, health: s.knownHealth };
    return need;
  }
  // heal()'s shame guard: an apple that would land inside the 130ms window is
  // held rather than dropped, and goes out when the window closes.
  gate(count, s) {
    const out = [];
    if (this.queue > 0 && s.now >= this.queueDue) { out.push(this.queue); this.queue = 0; this.queueDue = null; }
    if (count > 0) {
      const since = s.now - s.lastSeenHit;
      if (s.lastSeenHit && since <= 130 && !(s.knownHealth <= s.dmgPot)) {
        this.queue = Math.min(this.queue + count, 12);
        this.queueDue = s.lastSeenHit + 130;
      } else out.push(count);
    }
    return out.reduce((a, b) => a + b, 0);
  }
}

// ── RYN after the port ────────────────────────────────────────────────────
// ryn/RYN_Client_v5.4.user.js, AntiInsta.postTick, transcribed the same way.
// The DECISION is novastorm's and nothing else — that is the point of the port,
// and it is what this row has to show:
//
//     let totalDmgPot = EnemyManager.potentialDamage + EnemyManager.potentialSpikeDamage;
//     if (totalDmgPot > 140) totalDmgPot = 140;
//     if (hatID === 6) totalDmgPot *= Hats[6].dmgMult;
//     if (hatID === 7) totalDmgPot += 5;
//     const healing = tempHealth <= totalDmgPot;
//     if (!(((healing && myPlayer.shameCount < 7) || myPlayer.tickCount - myPlayer.damageTick > 0)
//           && tempHealth < maxHealth)) return;
//     for (let i = 0; i < maxHealth - tempHealth; i += restore) ModuleHandler.heal();
class RynPortedRule {
  decide(s) {
    const healing = s.knownHealth <= s.dmgPot;
    const quiet = s.tick - s.damageTick > 0;
    if (!(((healing && s.knownShame < 7) || quiet) && s.knownHealth < MAX_HP)) return 0;
    let presses = 0;
    for (let i = 0; i < MAX_HP - s.knownHealth; i += RESTORE) presses++;
    return presses;
  }
}

// ── RYN as it stands now ──────────────────────────────────────────────────
// The same decision, with two questions asked inside ModuleHandler.heal —
// which is where every automatic food press in the client goes through, so they
// apply to anti sync and anti smart tick as well:
//
//     if (myPlayer && myPlayer.shameActive) return;       // the 30s lock
//     if (!this._foodIsShameSafe()) return;               // the 120ms window
//
// Neither changes WHICH ticks decide to heal — RynPortedRule.decide is called
// here unchanged, and the rows prove it — only whether the press it asks for is
// one the server would refuse or count against you.
//
// This is a transcription, like everything else in this file. auto-q.js lifts
// _foodIsShameSafe out of the client and runs the real thing.
class RynNowRule {
  constructor() { this.heldTick = -1; this.freeTick = -1; }
  _shameSafe(s) {
    if (this.freeTick === s.tick) return true;
    if (this.heldTick === s.tick) return false;
    const lands = !s.hitAt ? Infinity : s.now - s.hitAt + s.ping;
    if (lands >= 125 || this.heldTick === s.tick - 1) { this.freeTick = s.tick; return true; }
    this.heldTick = s.tick;
    return false;
  }
  decide(s) {
    const want = RynPortedRule.prototype.decide.call(this, s);
    if (!want) return 0;
    if (s.shameActive) return 0;
    return this._shameSafe(s) ? want : 0;
  }
}

// ── the fight ─────────────────────────────────────────────────────────────
function run(rule, script, ping, seconds) {
  const srv = new Server();
  const half = ping / 2;
  const inbound = [];     // {at, health, shame, shameActive} echoes to the client
  const outbound = [];    // {at, count} food arriving at the server
  const hits = [];        // {at} damage the client has learned about

  const st = {
    tick: 0, damageTick: -1, now: 0, ping,
    knownHealth: MAX_HP, knownShame: 0, shameActive: false,
    lastSeenHit: 0, dmgPot: 0,
    // myPlayer.receivedDamage: stamped when a hit is seen, cleared the moment
    // health is seen to rise — the same moment the server clears hitTime.
    hitAt: null,
  };

  let apples = 0, packets = 0;
  const total = Math.round((seconds * 1000) / TICK);

  for (let t = 0; t < total; t++) {
    const now = t * TICK;
    st.now = now; st.tick = t;
    srv.advance(now, TICK);

    // damage the server applies this tick
    const dmg = script(t);
    if (dmg > 0) srv.damage(now, dmg);

    // echoes the client receives now (one half-trip behind)
    while (inbound.length && inbound[0].at <= now) {
      const e = inbound.shift();
      if (e.health > st.knownHealth) st.hitAt = null;
      st.knownHealth = e.health; st.knownShame = e.shame; st.shameActive = e.shameActive;
      if (e.hit) { st.damageTick = t + 1; st.lastSeenHit = now; st.hitAt = now; }
    }
    // the server queues this tick's state for the client
    inbound.push({ at: now + half, health: srv.health, shame: srv.shameCount,
                   shameActive: srv.shameTimer > 0, hit: dmg > 0 });

    // what the client believes it is about to take: the damage it just saw,
    // which is what both clients' potential-damage sums amount to here
    st.dmgPot = dmg > 0 ? Math.min(140, dmg * 2) : (now - st.lastSeenHit < 400 ? 40 : 0);

    let count = rule.decide(st);
    if (rule.gate) count = rule.gate(count, st);
    if (count > 0) {
      apples += count;
      packets += count * PLACE_PACKETS;
      for (let i = 0; i < count; i++) outbound.push({ at: now + half + i * 2 });
    }

    while (outbound.length && outbound[0].at <= now + TICK) {
      const f = outbound.shift();
      srv.consume(f.at);
    }
  }

  const wasted = srv.wastedFull + srv.wastedShamed;
  return {
    apples, packets, wasted, full: srv.wastedFull, shamed: srv.wastedShamed,
    locks: srv.locks, deaths: srv.deaths,
    waste: apples ? (wasted / apples) * 100 : 0,
  };
}

const SCRIPTS = {
  // someone poking at you between reloads
  "trade, a hit every 5 ticks": (t) => (t % 5 === 0 ? 35 : 0),
  // a combo: three ticks of damage, then a breath
  "burst, 3 ticks on 12 off":   (t) => (t % 15 < 3 ? 30 : 0),
  // standing in spikes, hit every single tick
  "spike pressure, every tick": (t) => 12,
};

const PINGS = [30, 100, 200];
const SECONDS = 40;

const pad = (s, n) => String(s).padEnd(n);
console.log("autoheal — RYN v5.4 against X- Precision, same fight, same server rule\n");
console.log("  " + SECONDS + "s per row; the shame rule is the game's own, quoted at the top of this file\n");

const blank = () => ({ apples: 0, packets: 0, wasted: 0, locks: 0, deaths: 0 });
const totals = { "X-": blank(), "RYN (was)": blank(), "RYN (ported)": blank(), "RYN (now)": blank() };
const CLIENTS = [
  ["X-", () => new XRule()],
  ["RYN (was)", () => new RynRule()],
  ["RYN (ported)", () => new RynPortedRule()],
  ["RYN (now)", () => new RynNowRule()],
];
const rowsByClient = {};

for (const [name, script] of Object.entries(SCRIPTS)) {
  console.log("  " + name);
  console.log("  " + pad("ping", 8) + pad("client", 15) + pad("apples", 9) + pad("packets", 10) +
    pad("wasted", 11) + pad("shame-locked", 14) + pad("shame locks", 13) + "deaths");
  console.log("  " + "-".repeat(94));
  for (const ping of PINGS) {
    for (const [label, make] of CLIENTS) {
      const r = run(make(), script, ping, SECONDS);
      const a = totals[label];
      a.apples += r.apples; a.packets += r.packets; a.wasted += r.wasted;
      a.locks += r.locks; a.deaths += r.deaths;
      (rowsByClient[label] = rowsByClient[label] || []).push(
        [r.apples, r.packets, r.wasted, r.shamed, r.locks, r.deaths].join(","));
      console.log("  " + pad(ping, 8) + pad(label, 15) + pad(r.apples, 9) + pad(r.packets, 10) +
        pad(r.wasted + " (" + r.waste.toFixed(0) + "%)", 11) + pad(r.shamed, 14) +
        pad(r.locks, 13) + r.deaths);
    }
  }
  console.log("");
}

console.log("  totals across every row");
console.log("  " + pad("client", 15) + pad("apples", 9) + pad("packets", 10) + pad("wasted", 12) +
  pad("shame locks", 13) + "deaths");
console.log("  " + "-".repeat(66));
for (const [label] of CLIENTS) {
  const a = totals[label];
  console.log("  " + pad(label, 15) + pad(a.apples, 9) + pad(a.packets, 10) +
    pad(a.wasted + " (" + ((a.wasted / a.apples) * 100).toFixed(0) + "%)", 12) +
    pad(a.locks, 13) + a.deaths);
}
console.log("\n  wasted = the apple reached the server at full health, or while shame-locked.");
console.log("  Both cost " + PLACE_PACKETS + " packets and one food either way.");

/* What these rows have to show, and what they deliberately do not.
 *
 * First: the port is still a port. "RYN (ported)" is novastorm's decision with
 * nothing on top, so it must land on X- exactly, row for row. If it ever
 * drifts, a guard has crept back into the DECISION, which is not where the two
 * that shipped live.
 *
 * Second: what ships costs fewer shame locks and spends less food into a lock
 * than the bare rule, on every row.
 *
 * What it does NOT have to do is send fewer apples. On the burst row it sends
 * MORE: a press held one tick is one more tick of damage before the top-up, so
 * `heal(100 - health)` asks for a bigger number. That is the same arithmetic on
 * a lower figure, not a regression — and the row that matters, shame locks,
 * still goes the right way. */
const col = { apples: 0, packets: 1, wasted: 2, shamed: 3, locks: 4, deaths: 5 };
const at = (label, i, c) => Number(rowsByClient[label][i].split(",")[col[c]]);
const everyRow = (c, cmp) => rowsByClient["RYN (now)"].every((_, i) =>
  cmp(at("RYN (now)", i, c), at("RYN (ported)", i, c)));

const checks = [
  ["the ported rule is still exactly X-'s, row for row",
   rowsByClient["X-"].join("|") === rowsByClient["RYN (ported)"].join("|")],
  ["what ships never takes more shame locks than the bare rule",
   everyRow("locks", (a, b) => a <= b)],
  ["and never spends more food into a lock",
   everyRow("shamed", (a, b) => a <= b)],
  ["and takes strictly fewer locks somewhere, so the guard is not inert",
   rowsByClient["RYN (now)"].some((_, i) => at("RYN (now)", i, "locks") < at("RYN (ported)", i, "locks"))],
];
let bad = 0;
console.log("");
for (const [label, ok] of checks) {
  if (!ok) bad++;
  console.log("  " + (ok ? "ok  " : "FAIL") + "  " + label);
}
console.log("\n  " + (bad === 0
  ? "the decision is novastorm's; the guard only refuses presses the server would not have counted for you"
  : bad + " of the above does not hold"));
process.exit(bad === 0 ? 0 : 1);
