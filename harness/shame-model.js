/* Does RYN's picture of the shame counter match the server's?
 *
 * Every shame guard in the client is a bet on a NUMBER THE SERVER OWNS and the
 * client only estimates:
 *
 *   AntiInsta   `healing && myPlayer.shameCount < 7`   — refuses the heal that
 *               would be the eighth fast one, i.e. the one that locks you out.
 *   heal()      `if (myPlayer.shameActive) return;`    — stands down during the
 *               30 second lock.
 *   heal()      `_foodIsShameSafe()`                   — holds a press that
 *               would land inside the server's 120ms window.
 *
 * All three are wrong if the mirror is wrong, and nothing checked the mirror.
 * This does: the real server rule on one side, the client's real arithmetic on
 * the other, a wire with latency between them.
 *
 *   node shame-model.js [ryn.js]
 *
 * What it CANNOT tell you: whether the client's tick actually calls
 * updateHealth in the order modelled here, since RYN does not boot in this
 * harness. It tests the arithmetic and the timing, not the plumbing.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/RYN_Client_v5.4.user.js");
const src = fs.readFileSync(RYN, "utf8");

// ── the server, transcribed from X- Precision 18452 / 18518 / 18265 ─────────
// Three pieces, and the third is easy to miss: the 30s lock counts DOWN by
// delta on every server update, where the client counts UP.
class Server {
  constructor() {
    this.health = 100;
    this.hitTime = 0;
    this.shameCount = 0;
    this.shameTimer = 0;
    this.shameAbuse = false;
    this.apples = 0;          // food the server actually consumed
    this.refused = 0;         // food it threw away
    this.judgedFast = 0;      // presses the server counted UP for
    this.judgedSlow = 0;      // presses it counted down for
    this.locks = 0;
    this.everLocked = false;
  }
  // 18452: `if (amount < 0) this.hitTime = Date.now();` — ANY damage, weapon,
  // spike or poison alike.
  changeHealth(amount, now) {
    if (amount < 0) this.hitTime = now;
    this.health = Math.min(100, this.health + amount);
  }
  // 18265: `if (this.shameTimer > 0) { this.shameTimer -= delta; ... }`
  update(delta) {
    if (this.shameTimer > 0) {
      this.shameTimer -= delta;
      if (this.shameTimer <= 0) { this.shameTimer = 0; this.shameCount = 0; }
    }
  }
  // 18518, verbatim: the arithmetic runs ABOVE the refusal, so a press made
  // during the lock still moves the counter — it just does not heal.
  buildItem(now, restore) {
    if (this.hitTime) {
      const timeSinceHit = now - this.hitTime;
      this.hitTime = 0;
      if (timeSinceHit <= 120) {
        this.judgedFast++;
        this.shameCount++;
        if (this.shameCount > 0) this.shameAbuse = true;
        if (this.shameCount >= 8) { this.shameTimer = 30000; this.shameCount = 0; this.locks++; this.everLocked = true; }
      } else {
        this.judgedSlow++;
        this.shameCount -= 2;
        if (this.shameCount <= 0) this.shameCount = 0;
      }
    }
    if (this.shameTimer <= 0) {
      this.health = Math.min(100, this.health + restore);
      this.apples++;
      return true;
    }
    this.refused++;
    return false;
  }
  get locked() { return this.shameTimer > 0; }
}

// ── the client, lifted out of RYN ───────────────────────────────────────────
function lift(re, label) {
  const m = re.exec(src);
  if (!m) throw new Error("could not find " + label + " in " + path.basename(RYN));
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index, i + 1); }
  }
  throw new Error("unbalanced " + label);
}

/* Two pieces of the client, both taken from the file rather than described:
 *
 *   updateHealth   the +1 / -2 and the clamp, plus `receivedDamage`
 *   update(...)    the hat-45 latch and the 30s timer that counts UP
 *
 * `update` is a 90-line method that predicts weapons, reloads and hats; only
 * its shame block is wanted, so it is sliced between two anchors that are
 * checked to exist. If either anchor moves the bench refuses to run rather
 * than quietly testing nothing. */
const updateHealthSrc = lift(/\n {4}updateHealth\(health\) \{/, "updateHealth");

const SHAME_BLOCK_FROM = "      if (this.hatID === 45 && !this.shameActive) {";
const SHAME_BLOCK_TO = "      if (this.isBullTickTime()) {";
if (!src.includes(SHAME_BLOCK_FROM) || !src.includes(SHAME_BLOCK_TO))
  throw new Error("the hat-45 shame block moved — fix the anchors rather than trusting a pass");
const shameTickSrc = src.slice(src.indexOf(SHAME_BLOCK_FROM),
                               src.indexOf(SHAME_BLOCK_TO, src.indexOf(SHAME_BLOCK_FROM)));

const foodGuardSrc = (() => {
  const m = /\n {4}_foodIsShameSafe\(\) \{/.exec(src);
  if (!m) throw new Error("_foodIsShameSafe is gone");
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(m.index + 1, i + 1); }
  }
})();

const SHAME_SAFE_WINDOW = Number(/const SHAME_SAFE_WINDOW = (\d+)/.exec(src)[1]);

function makeClient() {
  const box = {
    Math, Date: { now: () => box.__now }, __now: 0,
    clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
    SHAME_SAFE_WINDOW,
  };
  vm.createContext(box);
  // The player: real updateHealth, real shame-tick block, stubbed neighbours.
  vm.runInContext(`
    this.P = {
      currentHealth: 100, previousHealth: 100, tempHealth: 100,
      shameActive: false, shameTimer: 0, shameCount: 0,
      receivedDamage: null, tickDamage: 0, stackedDamage: 0, damages: [],
      damageTick: -1, tickCount: 0, poisonCount: 0, hatID: 0,
      isDmgOverTime: false, bullTick: -1, id: 1,
      client: { PlayerManager: { step: 0, lastEnemyReceivedDamage: [null, 0] },
                myPlayer: { isEnemyByID: () => false } },
      ${updateHealthSrc.trim().replace(/^updateHealth/, "updateHealth")},
      shameTick(step) {
        // The sliced block destructures PlayerManager out of this.client for
        // itself, so feed the step through there rather than declaring a
        // second binding of the same name beside it.
        this.client.PlayerManager.step = step;
${shameTickSrc.replace(/^ {6}/gm, "        ")}
      },
    };
    this.MH = {
      tickCount: 0, _foodHeldTick: -1, _foodFreeTick: -1,
      client: { myPlayer: this.P, SocketManager: { pong: 0 } },
      ${foodGuardSrc.trim().replace(/^_foodIsShameSafe/, "_foodIsShameSafe")}
    };
  `, box);
  return box;
}

// ── the wire ────────────────────────────────────────────────────────────────
/* One fight, driven a millisecond at a time so both clocks are honest.
 *
 * Latency is one-way `pong/2` in each direction, which is what the client's own
 * guard assumes when it adds `SocketManager.pong` to the age of the hit. The
 * server damages at T; the client sees the health drop at T + pong/2 and stamps
 * `receivedDamage` then; a press sent at T2 reaches the server at T2 + pong/2;
 * the resulting health rise reaches the client at T2 + pong.
 *
 * `guards` names which of the client's three shame guards are switched on, so
 * each can be run alone. Asking which one is load-bearing is the point: the
 * three are usually described as a set, and a set is not a measurement. */
const GUARDS = {
  none:   { lock: false, window: false, count: false },
  lock:   { lock: true,  window: false, count: false },
  count:  { lock: true,  window: false, count: true  },
  window: { lock: true,  window: true,  count: false },
  RYN:    { lock: true,  window: true,  count: true  },
};

function fight({ pong, guards, hits, seed = 7 }) {
  const g = GUARDS[guards];
  const box = makeClient();
  const { P, MH } = box;
  MH.client.SocketManager.pong = pong;
  const server = new Server();

  let rng = seed;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  const inbound = [];   // {at, kind, value} — server → client
  const outbound = [];  // {at} — client → server (a food press)
  const half = pong / 2;

  const TICK = 111;     // moomoo's own tick
  let nextTick = 0, lastTick = 0;
  /* Drift is measured only while NEITHER side thinks it is locked. Inside a
   * lock the two numbers are supposed to disagree: the server resets its count
   * to 0 the moment it locks, and RYN parks its mirror at 8 so that every
   * count-based guard refuses as well as the shameActive one. Averaging those
   * together would report a design decision as an 8-point error. */
  let drift = 0, driftSamples = 0, maxDrift = 0;
  let heldPresses = 0, sentPresses = 0;
  let believedUnlockedWhileLocked = 0;
  let parkedAtEight = 0, lockTicks = 0, peakCountFree = 0;
  /* The 30 second unlock, on both sides. The client's clock starts when it sees
   * hat 45 and counts UP; the server's started at the judgement and counts
   * DOWN. What matters is that the client's ends LATER — a client that frees
   * itself early walks straight back into the lock. */
  let serverUnlockAt = null, clientUnlockAt = null, clientEverLocked = false;

  for (let t = 0; t <= 40000; t++) {
    box.__now = t;

    // server side ------------------------------------------------------------
    server.update(1);
    const hit = hits.find(h => h.at === t);
    if (hit) {
      server.changeHealth(-hit.dmg, t);
      inbound.push({ at: t + half, health: server.health });
    }
    while (outbound.length && outbound[0].at <= t) {
      outbound.shift();
      const before = server.health;
      server.buildItem(t, 20);
      if (server.health !== before) inbound.push({ at: t + half, health: server.health });
      // The shame hat (45) is what the client sees when the lock lands.
      inbound.push({ at: t + half, hat: server.locked ? 45 : 0 });
    }

    // client side ------------------------------------------------------------
    while (inbound.length && inbound[0].at <= t) {
      const msg = inbound.shift();
      if (msg.hat !== undefined) P.hatID = msg.hat;
      if (msg.health !== undefined) P.updateHealth(msg.health);
    }

    if (t >= nextTick) {
      P.tickCount++; MH.tickCount++;
      P.shameTick(t - lastTick);
      lastTick = t; nextTick = t + TICK;

      // Compare the two counters once per tick, which is as often as the
      // client could possibly act on its own.
      if (server.locked && !P.shameActive) believedUnlockedWhileLocked++;
      if (P.shameActive) clientEverLocked = true;
      if (serverUnlockAt === null && server.everLocked && !server.locked) serverUnlockAt = t;
      if (clientUnlockAt === null && clientEverLocked && !P.shameActive) clientUnlockAt = t;
      if (P.shameActive) {
        lockTicks++;
        if (P.shameCount === 8) parkedAtEight++;
      } else if (!server.locked) {
        if (P.shameCount > peakCountFree) peakCountFree = P.shameCount;
        driftSamples++;
        const d = Math.abs(P.shameCount - server.shameCount);
        drift += d;
        if (d > maxDrift) maxDrift = d;
      }

      // The heal decision, reduced to its shame half: the client presses when
      // it is missing health. Everything else about AntiInsta is beside the
      // point here and is covered by heal-duel.js.
      const wants = P.currentHealth < 100;
      if (wants) {
        let allowed = true;
        // The three guards, in the order the client applies them.
        if (g.lock && P.shameActive) allowed = false;
        else if (g.window && !MH._foodIsShameSafe()) allowed = false;
        else if (g.count && !(P.shameCount < 7)) allowed = false;
        if (allowed) { outbound.push({ at: t + half }); sentPresses++; }
        else heldPresses++;
      }
    }
  }

  return {
    apples: server.apples, refused: server.refused,
    shameAbuse: server.shameAbuse, locked: server.shameTimer > 0,
    finalServerCount: server.shameCount,
    avgDrift: driftSamples ? drift / driftSamples : 0, maxDrift,
    judgedFast: server.judgedFast, judgedSlow: server.judgedSlow, locks: server.locks,
    parkedAtEight, lockTicks, peakCountFree,
    serverUnlockAt, clientUnlockAt, clientEverLocked,
    believedUnlockedWhileLocked,
    sentPresses, heldPresses, health: server.health,
  };
}

// A burst then a lull, repeated — the shape that both raises the counter and
// gives it a chance to come back down.
function burstFight() {
  const hits = [];
  for (let cycle = 0; cycle < 8; cycle++) {
    const base = cycle * 5000;
    for (let i = 0; i < 4; i++) hits.push({ at: base + i * 90, dmg: 12 });
    hits.push({ at: base + 2500, dmg: 8 });
  }
  return hits;
}

const pad = (v, w) => String(v).padEnd(w);
console.log(path.basename(RYN) + " — the shame counter, client mirror vs server truth\n");
console.log("  The server rule is X- Precision 18518 transcribed; the client side is");
console.log("  RYN's own updateHealth, hat-45 block and _foodIsShameSafe, lifted.\n");

console.log("  " + pad("ping", 7) + pad("guards", 9) + pad("ate", 6) + pad("refused", 9) +
            pad("judged +1", 11) + pad("judged -2", 11) + pad("locks", 7) +
            pad("drift avg", 11) + "drift max");
console.log("  " + "-".repeat(86));
const rows = [];
for (const pong of [0, 30, 100, 200]) {
  for (const guards of ["none", "lock", "count", "window", "RYN"]) {
    const r = fight({ pong, guards, hits: burstFight() });
    rows.push({ pong, guards, ...r });
    console.log("  " + pad(pong, 7) + pad(guards, 9) +
                pad(r.apples, 6) + pad(r.refused, 9) + pad(r.judgedFast, 11) +
                pad(r.judgedSlow, 11) + pad(r.locks, 7) +
                pad(r.avgDrift.toFixed(2), 11) + r.maxDrift);
  }
  if (pong !== 200) console.log("");
}
console.log("\n  `judged +1` is presses the server counted UP for — the ones that shame you.");
console.log("  `lock` is shameActive alone, `count` adds shameCount < 7, `window` adds the");
console.log("  120ms guard instead, `RYN` is all three — which is what the client ships.");
console.log("  Drift is sampled once a tick and ONLY while neither side is locked; see below.\n");

// ── what the numbers have to say ────────────────────────────────────────────
let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log("  " + (ok ? "ok  " : "FAIL") + "  " + line); };
console.log("");

const at = (pong, guards) => rows.find(r => r.pong === pong && r.guards === guards);
const all = guards => rows.filter(r => r.guards === guards);
const ryn = all("RYN"), bare = all("none");

say(ryn.every(r => r.locks === 0),
    "as shipped the server never locks the player out, at any ping");
say(bare.some(r => r.locks > 0),
    "with no guards it does — so this fight is one that can actually shame you");
say(ryn.every(r => r.refused === 0),
    "no shipped press is thrown away by the server (" +
    bare.map(r => r.refused).join("/") + " thrown away with none)");
say(ryn.every(r => r.believedUnlockedWhileLocked === 0),
    "the client never believes it is free while the server has it locked");

/* WHICH GUARD CARRIES. The three are usually described together, so it is worth
 * knowing that they are not interchangeable: run each alone against the same
 * fight and see which one actually stops the lock. */
const countOnly = all("count"), windowOnly = all("window"), lockOnly = all("lock");
say(windowOnly.every(r => r.locks === 0) && windowOnly.every(r => r.apples >= 32),
    "the 120ms window guard ALONE prevents every lock and still eats (" +
    windowOnly.map(r => r.apples).join("/") + " apples) — it is the load-bearing one");
say(lockOnly.some(r => r.locks > 0),
    "shameActive alone does not: it only reacts once the lock has already landed (" +
    lockOnly.reduce((a, r) => a + r.locks, 0) + " locks)");

/* The count guard alone also takes no locks — but look at what it eats. It is
 * safe the way not playing is safe, and the reason is a trap in the guard
 * itself: `shameCount` only comes DOWN on a press the server judges slow, so a
 * guard that refuses every press once the count reaches 7 removes the only
 * thing that could lower it. It starves and never recovers. */
const starve = countOnly.filter(r => r.pong <= 100);
say(starve.every(r => r.locks === 0) && starve.every(r => r.judgedSlow <= 1),
    "shameCount < 7 alone takes no locks either — by starving: " +
    starve.map(r => r.apples).join("/") + " apples against " +
    windowOnly.filter(r => r.pong <= 100).map(r => r.apples).join("/") +
    ", and " + starve.reduce((a, r) => a + r.judgedSlow, 0) + " slow presses in three runs");
/* The claim to check is not "more slow presses than fast" — at 100ms the two
 * are within one of each other and the count still never saturates. It is the
 * saturation itself, so measure that: the highest the mirror ever reaches while
 * the player is free. At 7 the count guard has shut the client down. */
say(ryn.every(r => r.peakCountFree < 7) && countOnly.some(r => r.peakCountFree >= 7),
    "the three together break that trap: shipped peaks at " +
    Math.max(...ryn.map(r => r.peakCountFree)) + ", count-alone reaches " +
    Math.max(...countOnly.map(r => r.peakCountFree)) + " and stops eating there");

/* The mirror's accuracy, as a number rather than a "matches". A drift of 1 is
 * expected: the client samples once a tick, so between the server judging a
 * press and the client's next tick it is one behind. */
const lowPing = rows.filter(r => r.pong <= 100);
const worstLow = Math.max(...lowPing.map(r => r.maxDrift));
say(worstLow <= 1,
    "at 100ms and below the mirror is never more than one tick behind (worst: " + worstLow + ")");

/* At 200ms it IS worse, and that is a property of the client worth stating
 * rather than asserting away: 200ms of latency spans nearly two 111ms ticks, so
 * two judgements can land between samples. This is exactly why the count guard
 * cannot be the load-bearing one, and the row above shows it is not. */
const worst200 = Math.max(...rows.filter(r => r.pong === 200).map(r => r.maxDrift));
say(worst200 === 2,
    "at 200ms it is two behind (" + worst200 + ") — 200ms spans nearly two 111ms ticks");

/* Inside a lock the two are SUPPOSED to disagree, in the intended direction:
 * the server zeroes its count on locking, RYN parks its mirror at 8, so every
 * count-based guard refuses as well as the shameActive one. */
const locked = rows.filter(r => r.lockTicks > 0);
say(locked.length > 0 && locked.every(r => r.parkedAtEight === r.lockTicks),
    "during a lock RYN holds its mirror at 8, so `< 7` refuses too (" +
    locked.length + " runs, every locked tick)");

/* The 30 second unlock. Only the runs that actually lock can say anything, and
 * the claim is one-sided on purpose: the client must free itself LATER than the
 * server, never earlier. Its clock starts when it sees hat 45, a round trip
 * after the server started counting, so later is what the arithmetic should
 * give — but "should" is why this is measured. */
const lockedRuns = rows.filter(r => r.clientEverLocked && r.serverUnlockAt !== null);
say(lockedRuns.length > 0, "the fight produces runs that actually lock, so the unlock can be measured (" +
    lockedRuns.length + ")");
say(lockedRuns.every(r => r.clientUnlockAt !== null),
    "in every one of them the client's 30s timer does run out and free it again");
say(lockedRuns.every(r => r.clientUnlockAt >= r.serverUnlockAt),
    "and never before the server does — latest client lead over server: " +
    Math.min(...lockedRuns.map(r => r.clientUnlockAt - r.serverUnlockAt)) + "ms");

/* The direct measure, taken on the server side rather than inferred from the
 * client's intentions: how many presses did the server count UP for. */
const bareFast = bare.reduce((a, r) => a + r.judgedFast, 0);
const rynFast = ryn.reduce((a, r) => a + r.judgedFast, 0);
say(rynFast < bareFast,
    "across all four pings the server judged " + rynFast + " shipped presses as fast, " +
    "against " + bareFast + " unguarded");

/* Shipped presses ARE still judged fast sometimes, and that is the documented
 * trade: the window guard holds for at most one tick, because a guard that
 * waits for a gap that never comes stops you eating (measured in auto-q.js).
 * What matters is that they never reach eight in a row. */
say(rynFast > 0,
    "some still are — the window guard holds one tick only, by design (auto-q.js)");

/* Eating MORE than the unguarded client reads backwards and is the expected
 * result: the unguarded client spends thirty seconds locked out. */
const b30 = at(30, "none"), r30 = at(30, "RYN");
say(r30.apples > b30.apples,
    "at 30ms the shipped client eats MORE, not less — " + r30.apples + " against " +
    b30.apples + " — because the unguarded one is locked out for 30s of the fight");

// ── where the two models genuinely differ, stated rather than smoothed over ──
console.log("\n  four places the mirror cannot be exact, by construction:\n");
console.log("    the counter's ceiling  the server counts to 8 and then locks; RYN clamps to 7 and");
console.log("                           never predicts a lock at all — it waits to SEE hat 45. So");
console.log("                           shameCount < 7 is exactly \"not the press that locks\".");
console.log("    inside the lock        the server zeroes its count on locking, RYN sets its mirror");
console.log("                           to 8. Deliberate: it makes the count-based guard refuse as");
console.log("                           well as the shameActive one. Measured above.");
console.log("    what clears the stamp  the server clears hitTime on the food ATTEMPT, RYN clears");
console.log("                           receivedDamage when health is seen to RISE. Inside the lock");
console.log("                           food never heals, so RYN would never clear it — moot only");
console.log("                           because updateHealth early-returns while shameActive.");
console.log("    the lock's clock       the server counts 30000 DOWN from the judgement; RYN counts");
console.log("                           UP from the tick it first sees hat 45, which is a round trip");
console.log("                           later. RYN stays cautious slightly longer, never shorter —");
console.log("                           the safe direction.");

// One result that is not a client property and should not be read as one.
console.log("\n  Two things in the table that are not client properties:\n");
console.log("    at 200ms every row is identical. The round trip alone pushes every press");
console.log("    past 120ms, so no guard binds and the bare rule is accidentally safe. The");
console.log("    0 and 30ms rows are where the guards are doing the work.");
console.log("");
console.log("    `count` alone looks safe (0 locks) and is not: 7 apples in a fight the");
console.log("    shipped client eats 32 in. shameCount only comes DOWN on a press judged");
console.log("    slow, so refusing every press at 7 removes the only thing that lowers it.");
console.log("    That is a trap in the guard, not a property of the fight, and it is why");
console.log("    the window guard has to be the one in front.\n");

console.log("\n  Not covered: the client booting, and the order its tick really calls");
console.log("  updateHealth in. This tests the arithmetic and the timing, not the plumbing.");
console.log("\n  " + (bad ? bad + " assertion(s) failed" : "all assertions hold"));
process.exit(bad ? 1 : 0);
