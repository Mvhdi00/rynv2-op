/*
 * ryn-autoheal-engine.js — RYN Auto Heal Engine (v2, predictive survival)
 *
 * A survival engine for the RYN client. Every rule in it is derived from the
 * shipped game bundle (src/game_index.js) and the tables extracted from it
 * (drivers/game-drivers.json); tools/verify-autoheal.js re-derives the
 * constants and fails the build on drift. Design notes and the full mechanic
 * derivation live in docs/AUTOHEAL_ENGINE.md.
 *
 * What it owns, and nothing else:
 *
 *   - every automatic food press          (heal, shame recovery, pre-emption)
 *   - the defensive hat/gear decision     (one manager, one hat per tick)
 *   - projectile micro-evasion            (one move claim, reverted by the client)
 *   - the packet budget those three spend (one ledger, hard-capped)
 *
 * It does not place, sync, tick, mill, push or attack. Those systems are read
 * — never written — through HostAdapter.
 *
 * Shape: `createRynAutoHealEngine(deps)` returns the module class RYN's
 * ModuleHandler drives (`moduleName`, `constructor(client)`, `postTick()`,
 * `reset()`). `deps` is read lazily (the builder passes getters) because the
 * client's data tables are declared after the point the engine is spliced in.
 *
 * The pipeline, once per tick:
 *
 *   snapshot -> state -> budget -> damage -> shame -> threats -> prediction
 *            -> shame forecast -> priority -> defensive plan
 *            -> gear | evasion | heal -> commit
 *
 * Everything before "priority" observes. Everything after it spends, and
 * every spend goes through PacketBudget.
 */

function createRynAutoHealEngine(deps) {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Constants. Every one of these is a fact from the shipped bundle, and
   * tools/verify-autoheal.js re-derives it from src/game_index.js and
   * drivers/game-drivers.json.
   * ------------------------------------------------------------------ */
  const AH = {
    /* ---- the shame rule (game_index.js:2461-2469) ------------------- *
     *
     *   if (this.hitTime) {
     *       const W = Date.now() - this.hitTime;
     *       this.hitTime = 0;                       // only the FIRST press
     *       W <= 120 ? (this.shameCount++,          // after a hit is judged
     *                   this.shameCount >= 8 && (this.shameTimer = 3e4,
     *                                            this.shameCount = 0))
     *                : (this.shameCount -= 2,
     *                   this.shameCount <= 0 && (this.shameCount = 0));
     *   }
     *   this.shameTimer <= 0 && (V = f.consume(this));
     *
     * Four things follow, and the whole shame engine is built on them:
     *   1. a press inside 120ms of a hit is +1;
     *   2. a press later than that is -2;
     *   3. a press with no hit pending changes nothing at all;
     *   4. the press that reaches 8 arms a 30s lock *before* consume is
     *      reached, so it does not even heal.
     */
    SHAME_WINDOW_MS: 120,
    /* The window is measured on the server. What we can compute locally is a
     * lower bound (see ShameEngine.verdict), so a few ms of slack keeps a
     * borderline press on the safe side of it. RYN's own gate uses 125. */
    SHAME_WINDOW_MARGIN_MS: 5,
    /* game_index.js:2464 — `shameCount >= 8` arms the lock. */
    SHAME_LOCK_AT: 8,
    /* game_index.js:2465 — `shameTimer = 3e4`. */
    SHAME_LOCK_MS: 30000,
    /* game_index.js:2466 — a late press is worth -2. */
    SHAME_CREDIT: 2,
    /* The ceiling. Never the operating point: see SHAME_TARGET. */
    SHAME_MAX: 7,

    /* ---- the objective --------------------------------------------- *
     *
     * The count the engine steers to, at all times. 7 is the state one
     * press short of a thirty-second food lock; it is a cliff edge, not a
     * budget to spend down to. Everything above 0 is a debt, and a debt is
     * repaid at the first safe opportunity rather than when it gets big. */
    SHAME_TARGET: 0,
    /* A debt of this size or more makes shame recovery a defensive-class
     * action rather than a housekeeping one: it may take the tick and it may
     * spend reserved packets. Two, because two is what one credit repays —
     * below it a single ordinary credit press already clears the board. */
    SHAME_DEBT_DEFENSIVE: 2,
    /* Where a charged press stops being merely expensive and starts being
     * the thing that ends the fight. */
    SHAME_WARN_HIGH: 5,

    /* ---- health, regen and the one-second tick ---------------------- */
    /* game_index.js:2234 — the server spawns players with maxHealth 100. */
    MAX_HEALTH: 100,
    /* game_index.js:2323 — the regen / damage-over-time counter resets to 1e3. */
    DOT_PERIOD_MS: 1000,
    /* 1000ms / (1000/9 ms per tick); RYN spells the same 9 in
     * Player.isBullTickTime (`% 9 === 0`). */
    DOT_PERIOD_TICKS: 9,
    /* config.serverUpdateRate 9 -> 111.11ms; used only if the client's
     * SocketManager.TICK is missing. */
    TICK_MS: 1000 / 9,

    /* ---- hats that matter ------------------------------------------- *
     * Read as capabilities, not names. The gear manager asks what a hat
     * *does* (dmgMult, antiTurret, healthRegen) and these ids are only how
     * it finds them in the table. */
    HAT_SHAME: 45,        // forced on during the lock; game_index.js:2603
    HAT_SOLDIER: 6,       // dmgMult 0.75 — the only real damage reduction
    HAT_BULL: 7,          // healthRegen -5: self-damage on every DoT tick
    HAT_EMP: 22,          // antiTurret 1: turrets will not fire at us
    HAT_TURRET_GEAR: 53,  // turret {proj:1, range:700, rate:2500}
    HAT_TANK: 40,
    HAT_ASSASSIN: 56,     // noEat: food is refused outright
    HAT_BOOSTER: 12,

    /* ---- weapons and projectiles (drivers/game-drivers.json) -------- */
    WEAPON_TOOL_HAMMER: 0,
    WEAPON_SHORT_SWORD: 3,
    WEAPON_KATANA: 4,
    WEAPON_POLEARM: 5,
    WEAPON_BAT: 6,
    WEAPON_DAGGER: 7,
    WEAPON_BOW: 9,
    WEAPON_GREAT_HAMMER: 10,
    WEAPON_SHIELD: 11,
    WEAPON_CROSSBOW: 12,
    WEAPON_REPEATER: 13,
    WEAPON_MUSKET: 15,
    /* The melee weapons a one-tick is actually built out of: reach plus a
     * damage number that a hat multiplier can carry over a full bar. */
    ONETICK_WEAPONS: [5, 4, 3],
    PROJ_TURRET: 1,
    PROJ_MUSKET: 5,
    PROJ_ARROWS: [0, 2, 3],        // hunting bow, crossbow, repeater crossbow
    /* projectiles[1].dmg — a turret shot, whether from the item or the gear. */
    TURRET_DAMAGE: 25,
    /* items[17].shootRange, and hats[53].turret.range. */
    TURRET_RANGE: 700,
    /* items[17].shootRate 2200 / hats[53].turret.rate 2500, in ms. */
    TURRET_RATE_MS: 2200,
    TURRET_GEAR_RATE_MS: 2500,
    ITEM_SPIKE_GROUP: 2,
    ITEM_TRAP: 15,                 // pit trap, group 5
    ITEM_TRAP_GROUP: 5,
    ITEM_TURRET_GROUP: 7,
    ITEM_HEAL_GROUP: 9,            // healing pad, healCol 15
    HEAL_PAD_SCALE: 45,            // items[19].scale

    /* SpatialHashGrid2D's cell size, so a reach in pixels can be turned into
     * the cell radius its query takes. */
    GRID_CELL_PX: 100,
    /* How far we may walk before the cached turret sweep is the wrong sweep.
     * Turrets do not move; only we do. */
    TURRET_SCAN_MOVE_PX: 150,

    /* Item type 2 is the food slot in RYN's inventory map. */
    FOOD_TYPE: 2,

    /* ---- packet costs, counted at the wire -------------------------- *
     * PacketManager.send increments packetCount once per frame, so every
     * cost here is a count of send() calls in the primitive named. */
    PACKETS_PRESS: 3,        // selectItem + attack + whichWeapon
    PACKETS_PRESS_BODY: 2,   // selectItem + attack, inside a burst
    PACKETS_PRESS_RESTORE: 1,// whichWeapon, once per burst
    PACKETS_EQUIP: 1,        // PacketManager.equip
    PACKETS_MOVE: 1,         // PacketManager.move, sent by SafeWalk
    /* What the rest of the client needs left over. The placement engine
     * spends four a placement plus two per batched follow-up; the mills
     * drop three windmills in a tick. */
    PACKET_RESERVE_PLACER: 12,
    PACKET_RESERVE_MILL: 6,

    /* novastorm's cap on a single tick's predicted damage; the largest real
     * one-tick burst in the tables (katana 40*1.18 + spinning spikes 45 +
     * turret 25) sits just under it. */
    DMG_CAP: 140,

    /* ---- detection windows ------------------------------------------ */
    /* How long a weapon or hat switch stays evidence of a sequence. A moomoo
     * combo is assembled inside about half a second; past that the switch is
     * just what they are carrying. */
    SEQUENCE_WINDOW_TICKS: 5,
    /* A spike sequence is one sequence while the hits keep coming. */
    SPIKE_SEQUENCE_GAP_TICKS: 6,
    /* Repeated-hit detectors measure over this window. */
    PRESSURE_WINDOW_TICKS: 12,
    SUSTAINED_WINDOW_TICKS: 27,
    SHAME_RATE_WINDOW_TICKS: 45,
    SHAME_HORIZON_TICKS: 9,
    /* VelocityTick's knockback band, defaulted only if the module is absent:
     * the module declares minKB/maxKB itself and the adapter reads them. */
    VELOCITY_KB_MIN: 150,
    VELOCITY_KB_MAX: 270,

    /* How much of a predicted threat has to be the deterministic kind before
     * the engine spends food on it. Below LOW it is a rumour, not a forecast. */
    CONFIDENCE_HIGH: 0.7,
    CONFIDENCE_LOW: 0.4,

    /* ---- prediction -------------------------------------------------- */
    PREDICT_HORIZON_TICKS: 6,
    PREEMPT_HORIZON_TICKS: 3,
    PREDICT_MAX_AGE_TICKS: 9,
    PREDICT_TURN_RADIANS: Math.PI / 4,
    PREDICT_STOP_SPEED: 0.5,
    PREDICT_MOVING_SPEED: 2,
    PREDICT_PLAYER_MOVE_PX: 60,
    PREDICT_RELEVANT_RANGE: 700,
    PREDICT_MAX_TRACKED: 4,

    /* ---- ping ------------------------------------------------------- */
    /* Smoothing factor for the round-trip estimate, and how many deviations
     * of jitter the reaction budget carries. One deviation covers the
     * ordinary wobble; more than that and the engine would be defending
     * against a connection rather than an enemy. */
    PING_ALPHA: 0.2,
    PING_JITTER_ALPHA: 0.25,
    PING_JITTER_SIGMAS: 1,
    PING_MAX_MS: 600,

    /* ---- evasion ---------------------------------------------------- */
    /* Extra clearance past the geometric miss, in px. A dodge that clears by
     * nothing is a dodge that fails on the next position packet. */
    EVADE_MARGIN_PX: 12,
    /* Never dodge into a body radius of a spike, trap edge or melee reach. */
    EVADE_SAFETY_PAD_PX: 20,
    /* A projectile further out than this is not worth a move claim yet: the
     * fight will have changed shape before it arrives. */
    EVADE_MAX_LEAD_TICKS: 5,
    /* ...and one closer than this cannot be beaten by a move that has to
     * cross the wire first. */
    EVADE_MIN_LEAD_TICKS: 1,

    /* ---- gear ------------------------------------------------------- */
    /* A defensive hat is held for at least this many ticks once equipped, so
     * a threat that flickers cannot make the engine flap the hat slot. */
    GEAR_MIN_HOLD_TICKS: 2,
    /* ...and released this many ticks after the last qualifying threat. */
    GEAR_RELEASE_TICKS: 2,

    /* ---- engine pacing ----------------------------------------------- */
    MAX_PRESSES_PER_TICK: 6,
    INFLIGHT_TTL_TICKS: 1,
    HOLD_TICKS_DEFAULT: 1,
    BACKOFF_BASE_TICKS: 2,
    BACKOFF_MAX_TICKS: 18,
    DEAD_PRESS_LIMIT: 3
  };

  /* What a press sent right now would do to the shame count, server-side. */
  const VERDICT = {
    FREE: "free",       // no hit pending: the arithmetic does not run at all
    CREDIT: "credit",   // pending hit, window passed: -2
    CHARGED: "charged"  // pending hit, still inside 120ms: +1
  };

  /* Threat confidence. Five levels, and a number for each so the aggregate can
   * be weighted by damage. A detector that cannot find evidence returns NONE;
   * the levels above it are earned by what is observable, not by how bad the
   * situation would be if it were true. */
  const CONFIDENCE = {
    NONE: "NONE", LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL"
  };
  const CONFIDENCE_VALUE = { NONE: 0, LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, CRITICAL: 1 };
  const CONFIDENCE_RANK = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

  /* The threat types the engine reports. One per requested Anti, plus the two
   * generic shapes that catch what no specific detector claimed. */
  const THREAT = {
    INSTAKILL: "insta-kill",             // bull -> turret gear
    INSTA_REV: "insta-reverse",          // turret gear -> bull
    ONE_TICK: "one-tick",                // polearm reach + a hat multiplier
    VELOCITY_TICK: "velocity-tick",      // turret knockback + reach
    VELOCITY_COMBO: "velocity-hammer-spike",
    MUSKET: "musket",
    BOW: "bow",
    SPAM_BOW: "spam-bow",
    MIXED_INSTA: "primary-ranged-insta", // melee + a shot timed onto it
    SPAM_DAGGER: "spam-dagger",
    SPAM_SHAME: "spam-shame",
    SPIKE_TICK: "spike-tick",            // trap break -> spike
    SPIKE_PUSH: "spike-push-insta",
    KB_TICK: "kb-tick",                  // knocked onto a spike
    TURRET_STACK: "turret-stack",
    SPIKE: "spike",
    TRAP: "trap",
    BURST: "burst",
    SUSTAINED: "sustained"
  };

  /* The base order of requirement 22, as numbers. The arbiter starts here and
   * then lets measured impact time override it — the closest threat is not
   * automatically the most dangerous one, and a lethal sequence three ticks
   * out outranks a dagger landing now. */
  const THREAT_ORDER = {
    [THREAT.INSTAKILL]: 100,
    [THREAT.INSTA_REV]: 100,
    [THREAT.MIXED_INSTA]: 95,
    [THREAT.ONE_TICK]: 92,
    [THREAT.TURRET_STACK]: 90,
    [THREAT.SPIKE_PUSH]: 85,
    [THREAT.KB_TICK]: 85,
    [THREAT.SPIKE_TICK]: 80,
    [THREAT.VELOCITY_COMBO]: 78,
    [THREAT.MUSKET]: 70,
    [THREAT.BOW]: 68,
    [THREAT.SPAM_BOW]: 66,
    [THREAT.VELOCITY_TICK]: 64,
    [THREAT.SPIKE]: 60,
    [THREAT.TRAP]: 55,
    [THREAT.SPAM_DAGGER]: 50,
    [THREAT.BURST]: 45,
    [THREAT.SPAM_SHAME]: 40,
    [THREAT.SUSTAINED]: 30
  };

  /* The shame zones. SAFE is the operating state, not a lucky accident. */
  const ZONE = {
    SAFE: "safe",         // 0        — the target
    WARNING: "warning",   // 1 to 4   — a debt, repaid at the first opening
    HIGH: "high",         // 5 to 6   — no charge may leave except to survive
    CRITICAL: "critical"  // 7        — no charge may leave, at all
  };

  const HEAL_STATE = {
    IDLE: "idle", PRESSING: "pressing", AWAITING: "awaiting",
    BACKOFF: "backoff", LOCKED: "locked"
  };
  const COOLDOWN_STATE = { FREE: "free", HOLDING: "holding", BACKOFF: "backoff" };

  /* Urgency classes, ordered. See docs/AUTOHEAL_ENGINE.md#priority-model. */
  const URGENCY = {
    BLOCKED: 0,
    IDLE: 1,
    TOPUP: 2,
    RECOVER: 3,     // shame debt repayment
    PREEMPT: 4,
    SUSTAIN: 5,
    CRITICAL: 6,
    LOCKGUARD: 7
  };

  /* Packet priority (requirement 29). Emergency outranks defensive, which
   * outranks shame recovery, which outranks an ordinary top-up — and a
   * recovery that prevents a known lethal chain is promoted to EMERGENCY by
   * PacketBudget.promote rather than by an exception somewhere else. */
  const PACKET_PRIORITY = {
    NORMAL: 1,
    SHAME: 2,
    DEFENSIVE: 3,
    EMERGENCY: 4
  };

  const DECISION = {
    HEAL_NOW: "HEAL_NOW",
    WAIT: "WAIT",
    PREPARE: "PREPARE",
    CANCEL: "CANCEL",
    RECALCULATE: "RECALCULATE"
  };

  const INVALIDATION = {
    NONE: "", FIRST: "first", AGE: "aged-out", TARGET: "target-changed",
    TURNED: "enemy-turned", STOPPED: "enemy-stopped",
    PROJECTILE: "projectile-changed", COLLISION: "collision-changed",
    MOVED: "player-moved", GONE: "threat-gone", WORLD: "world-changed"
  };

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const num = v => (typeof v === "number" && isFinite(v) ? v : null);
  const angleDist = (a, b) => {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  /* ================================================================== *
   * PingModel — requirement 25.
   *
   * `effectiveReactionTime` is how far ahead of an impact a decision has to
   * be taken for the frame it produces to arrive in time. It is not "ping
   * added to every timer": what actually stands between the decision and the
   * server acting on it is
   *
   *     the rest of this tick   (we decide at a tick boundary, the server
   *                              applies on its next update)
   *   + the send leg            (half the smoothed round trip)
   *   + the jitter allowance    (one deviation of the recent variation)
   *
   * and the receive leg is *not* in it, because we are not waiting to see the
   * result — we are trying to be early. Adding the whole round trip would
   * make the engine defend a tick sooner than it needs to on every connection
   * and burn food doing it.
   * ================================================================== */
  class PingModel {
    constructor() { this.reset(); }

    reset() {
      this.raw = 0;
      this.smooth = 0;
      this.jitter = 0;
      this.samples = 0;
      this.reactionMs = AH.TICK_MS;
      this.reactionTicks = 1;
      this.unstable = false;
    }

    update(snap) {
      const raw = clamp(snap.pong || 0, 0, AH.PING_MAX_MS);
      this.raw = raw;
      if (this.samples === 0) {
        this.smooth = raw;
        this.jitter = 0;
      } else {
        const deviation = Math.abs(raw - this.smooth);
        this.jitter = this.jitter + AH.PING_JITTER_ALPHA * (deviation - this.jitter);
        this.smooth = this.smooth + AH.PING_ALPHA * (raw - this.smooth);
      }
      this.samples += 1;

      const tick = snap.TICK || AH.TICK_MS;
      const sendLeg = this.smooth / 2;
      const allowance = this.jitter * AH.PING_JITTER_SIGMAS;
      this.reactionMs = tick + sendLeg + allowance;
      this.reactionTicks = Math.max(1, Math.ceil(this.reactionMs / tick));
      /* Jitter worth more than a tick means the arrival time of anything we
       * send is a range rather than a moment. Detectors widen their windows
       * on this rather than pretending the number is sharp. */
      this.unstable = this.jitter > tick;
      return this;
    }

    /* Whether an impact `ticks` away can still be answered by a frame sent on
     * this tick. */
    canReach(ticks, snap) {
      const tick = snap.TICK || AH.TICK_MS;
      return ticks * tick >= this.reactionMs - tick;
    }
  }

  /* ================================================================== *
   * PacketBudget — requirements 26 to 29.
   *
   * One ledger. Every frame this engine sends is asked for here first, and
   * the question is asked against the *live* counter rather than a number
   * copied at the top of the tick, so the limit cannot be exceeded even
   * momentarily by work another module did in between.
   *
   * Three rules:
   *
   *   1. Hard cap. `canSend` re-reads ModuleHandler.packetCount and refuses
   *      anything that would put it over ModuleHandler.packetLimit. Nothing
   *      in this engine sends without passing it, and there is no path that
   *      sends more frames than it asked for.
   *   2. Reservation. A lethal threat books the frames its answer will need
   *      before anything cheaper is allowed to plan. Lower priorities see a
   *      budget with the reservation already taken out of it.
   *   3. Priority. EMERGENCY > DEFENSIVE > SHAME > NORMAL, and a shame
   *      recovery that is what stands between us and a lock is promoted
   *      rather than special-cased.
   * ================================================================== */
  class PacketBudget {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.limit = 119;
      this.startCount = 0;
      this.spent = 0;
      /* Frames this engine has authorised that the client has not sent yet.
       *
       * A hat claim and a move claim are both consumed later in the same tick
       * — Autohat sends the equip, SafeWalk sends the move — so the live
       * counter does not know about them while the heal is deciding how many
       * presses it can afford. Without this the last press of a burst and a
       * queued equip could between them land one frame over the limit, which
       * is exactly the "not even temporarily" the budget is for. */
      this.deferred = 0;
      this.reservations = [];
      this.grants = [];
      this.refusals = 0;
      this.externalReserve = 0;
      this.lastPlan = null;
    }

    begin(snap) {
      this.limit = snap.packetLimit;
      this.startCount = snap.packetCount;
      this.spent = 0;
      this.deferred = 0;
      this.reservations.length = 0;
      this.grants.length = 0;
      this.lastPlan = null;
      /* What the rest of the client is going to need this tick. Survival is
       * allowed to spend it; nothing else is. */
      const sys = snap.systems;
      this.externalReserve = (sys.placer ? AH.PACKET_RESERVE_PLACER : 0) +
        (sys.mills ? AH.PACKET_RESERVE_MILL : 0);
      return this;
    }

    /* The live headroom: the client's own counter, less anything we have
     * authorised that has not reached the socket yet. */
    free() {
      return Math.max(0, this.limit - this.adapter.livePacketCount() - this.deferred);
    }

    /* Book frames for a threat that has not been answered yet. Reservations
     * are consumed by the action that claims the same tag; everything else
     * sees the budget without them. */
    reserve(tag, packets, priority) {
      const want = Math.max(0, Math.round(packets));
      if (!want) return 0;
      const existing = this.reservations.find(r => r.tag === tag);
      if (existing) {
        existing.packets = Math.max(existing.packets, want);
        existing.priority = Math.max(existing.priority, priority);
        return existing.packets;
      }
      /* A reservation cannot book what does not exist. */
      const room = this.free() - this.reservedTotal();
      const booked = clamp(want, 0, Math.max(0, room));
      if (booked > 0) this.reservations.push({ tag, packets: booked, priority });
      return booked;
    }

    reservedTotal() {
      let sum = 0;
      for (const r of this.reservations) sum += r.packets;
      return sum;
    }

    /* Frames booked by somebody this caller may not take from: anything at a
     * higher priority, and anything at the same priority under another tag. */
    reservedAgainst(tag, priority) {
      let sum = 0;
      for (const r of this.reservations) {
        if (r.tag === tag) continue;
        if (r.priority >= priority) sum += r.packets;
      }
      return sum;
    }

    /* Promote a reservation — requirement 29's dynamic redistribution. Used
     * when shame recovery stops being housekeeping and becomes the thing
     * preventing a lethal chain. */
    promote(tag, priority) {
      const r = this.reservations.find(x => x.tag === tag);
      if (r && priority > r.priority) r.priority = priority;
      return !!r;
    }

    /* How many frames this action may plan for. Never more than the live
     * headroom, and never into somebody else's reservation. */
    grant(tag, packets, priority) {
      let room = this.free();
      if (priority < PACKET_PRIORITY.EMERGENCY) room -= this.externalReserve;
      room -= this.reservedAgainst(tag, priority);
      const granted = clamp(Math.min(packets, room), 0, Math.max(0, packets));
      this.grants.push({ tag, asked: packets, granted, priority });
      if (granted < packets) this.refusals += 1;
      return granted;
    }

    /* How many whole presses a grant is worth. A burst pays for the weapon
     * restore once, so N presses cost 2N + 1 frames. */
    pressesFor(tag, presses, priority) {
      if (presses <= 0) return 0;
      const frames = presses * AH.PACKETS_PRESS_BODY + AH.PACKETS_PRESS_RESTORE;
      const granted = this.grant(tag, frames, priority);
      if (granted < AH.PACKETS_PRESS_BODY + AH.PACKETS_PRESS_RESTORE) return 0;
      return Math.floor((granted - AH.PACKETS_PRESS_RESTORE) / AH.PACKETS_PRESS_BODY);
    }

    /* The hard cap, asked immediately before every single frame. */
    canSend(packets, priority) {
      const live = this.adapter.livePacketCount() + this.deferred;
      if (live + packets > this.limit) return false;
      if (priority >= PACKET_PRIORITY.EMERGENCY) return true;
      /* Below emergency, the reserved frames are not ours to take. */
      return live + packets + this.reservedAgainst(null, priority) <= this.limit;
    }

    /* Book-keeping after frames have actually left. */
    commit(tag, packets) {
      this.spent += packets;
      const r = this.reservations.find(x => x.tag === tag);
      if (r) r.packets = Math.max(0, r.packets - packets);
      return this.spent;
    }

    /* ...and for frames the client will send later in this same tick on our
     * behalf. They count against the cap from the moment they are authorised. */
    commitDeferred(tag, packets) {
      this.deferred += packets;
      return this.commit(tag, packets);
    }

    release(tag) {
      const i = this.reservations.findIndex(x => x.tag === tag);
      if (i >= 0) this.reservations.splice(i, 1);
    }

    report() {
      return {
        limit: this.limit,
        used: this.adapter.livePacketCount(),
        spent: this.spent,
        deferred: this.deferred,
        reserved: this.reservedTotal(),
        external: this.externalReserve,
        reservations: this.reservations.map(r => `${r.tag}:${r.packets}@${r.priority}`),
        grants: this.grants.map(g => `${g.tag}:${g.granted}/${g.asked}`)
      };
    }
  }

  /* ================================================================== *
   * HostAdapter — the integration layer.
   *
   * Every read of the client happens here and nowhere else, and every read is
   * guarded: a future RYN change should cost the engine an opinion, not throw
   * inside ModuleHandler's module loop.
   *
   * Every read is also memoised per tick. The threat engine, the prediction
   * engine, the gear manager and the evasion planner all want the same enemy
   * list and the same projectile list; walking them once and handing the same
   * arrays out is the difference between one scan a tick and four.
   * ================================================================== */
  class HostAdapter {
    constructor(client) {
      this.client = client;
      this._warned = false;
      this._tick = -1;
      this._cache = {};
      this._turrets = null;
      /* True from the moment a press asks for food until the weapon is back.
       * The executor restores on this flag in a finally, so no path out of a
       * burst — including a throw partway through one — can leave the client
       * holding a cookie into Combat's turn. */
      this.holdingFood = false;
    }

    get Items() { return deps.Items; }
    get Hats() { return deps.Hats; }
    get Accessories() { return deps.Accessories; }
    get Settings() { return deps.Settings; }
    get Weapons() { return deps.Weapons; }
    get Projectiles() { return deps.Projectiles; }
    get Config() { return deps.Config; }

    get mh() { return this.client && this.client._ModuleHandler; }
    get me() { return this.client && this.client.myPlayer; }

    /* The engine's own switches. */
    get enabled() { return !!(this.Settings && this.Settings._autoHealEngine); }
    /* The manufactured (bull) wash only. Natural credit recovery is not a
     * feature toggle: keeping the count at 0 is the objective, and it costs
     * nothing at full health (game_index.js:2418 — changeHealth returns false
     * so useRes is never reached). */
    get washEnabled() { return !!(this.Settings && this.Settings._autoHealWash); }
    get strict() { return !!(this.Settings && this.Settings._autoHealStrict); }
    /* Defensive gear and micro-evasion, each on its own switch so a player
     * who wants the heal engine without the movement can have it. Both
     * default on; the settings block the builder installs declares them. */
    get gearEnabled() {
      const s = this.Settings;
      return !s || s._autoHealGear === undefined ? true : !!s._autoHealGear;
    }
    get evadeEnabled() {
      const s = this.Settings;
      return !s || s._autoHealEvade === undefined ? true : !!s._autoHealEvade;
    }
    get reserveHealth() {
      const v = this.Settings && num(this.Settings._autoHealReserve);
      return v === null ? 15 : clamp(v, 0, 40);
    }

    /* One cache generation per tick. Everything below that is expensive goes
     * through _once. */
    beginTick(tick) {
      if (this._tick === tick) return;
      this._tick = tick;
      this._cache = {};
    }

    _once(key, build) {
      const hit = this._cache[key];
      if (hit !== undefined) return hit;
      let value;
      try { value = build(); } catch (_) { value = null; }
      this._cache[key] = value;
      return value;
    }

    /* The client's Player.maxHealth is `Math.LN1`, i.e. undefined (v5.4:3294),
     * which makes every comparison against it false and every subtraction NaN.
     * The server's own value is 100 (game_index.js:2234), so that is what the
     * engine uses unless the client ever reports a real number. */
    maxHealth() {
      const me = this.me;
      const v = me && num(me.maxHealth);
      return v !== null && v > 0 ? v : AH.MAX_HEALTH;
    }

    snapshot() {
      const client = this.client;
      const me = this.me;
      const mh = this.mh;
      if (!client || !me || !mh) return null;

      const now = Date.now();
      const sock = client.SocketManager;
      const em = client.EnemyManager;
      const pm = client.ProjectileManager;
      const Items = this.Items;

      const foodId = num(me.getItemByType ? me.getItemByType(AH.FOOD_TYPE) : null);
      const foodItem = foodId !== null && Items ? Items[foodId] : null;
      const res = me.resources || {};

      const hatId = num(me.hatID) || 0;
      const accId = num(me.accessoryID) || 0;
      const hat = this.Hats ? this.Hats[hatId] : null;
      const acc = this.Accessories ? this.Accessories[accId] : null;
      /* hatID is the server-confirmed hat and lags by a round trip, so the hat
       * the client has already asked for is read from the store as well
       * (ModuleHandler._equip records it in store[type].last). */
      const storeHat = mh.store && mh.store[0] ? mh.store[0].last : null;

      const tick = num(me.tickCount) || 0;
      this.beginTick(tick);

      return {
        now,
        tick,
        TICK: (sock && num(sock.TICK)) || AH.TICK_MS,
        pong: Math.max(0, (sock && num(sock.pong)) || 0),

        inGame: !!me.inGame,
        sandbox: !!me.isSandbox,
        health: num(me.currentHealth) === null ? AH.MAX_HEALTH : me.currentHealth,
        prevHealth: num(me.previousHealth) === null ? AH.MAX_HEALTH : me.previousHealth,
        maxHealth: this.maxHealth(),

        foodId,
        restore: foodItem && num(foodItem.restore) ? foodItem.restore : this._foodRestore(foodItem),
        foodCost: foodItem && foodItem.cost && num(foodItem.cost.food) ? foodItem.cost.food
          : this._foodCost(foodItem),
        isCheese: !!(foodItem && foodItem.name === "cheese"),
        foodStock: num(res.food) === null ? 0 : res.food,

        hatId,
        accId,
        storeHat,
        noEat: !!(hat && hat.noEat),
        soldierOn: hatId === AH.HAT_SOLDIER || storeHat === AH.HAT_SOLDIER,
        bullOn: hatId === AH.HAT_BULL || storeHat === AH.HAT_BULL,
        empOn: hatId === AH.HAT_EMP || storeHat === AH.HAT_EMP,
        hatRegen: (hat && num(hat.healthRegen)) || 0,
        accRegen: (acc && num(acc.healthRegen)) || 0,
        soldierMult: this.hatDamageMult(AH.HAT_SOLDIER),

        /* RYN's client-side replay of the server shame rule (Entity.updateHealth,
         * v5.4:3484-3518). It clamps to 0..7 and only moves when health is seen
         * to rise, which is why ShameEngine keeps its own count too. */
        mirrorShame: clamp(num(me.shameCount) || 0, 0, AH.SHAME_MAX),
        shameActive: !!me.shameActive || hatId === AH.HAT_SHAME,
        receivedDamage: num(me.receivedDamage),

        poisonCount: num(me.poisonCount) || 0,
        isDmgOverTime: !!me.isDmgOverTime,
        bullTick: num(me.bullTick) || 0,
        damageTick: num(me.damageTick) || 0,

        isTrapped: !!me.isTrapped,
        pos: me.pos && me.pos.current ? me.pos.current : null,
        scale: num(me.scale) || 35,
        /* Last tick's travel, as Entity.setFuturePosition measures it. */
        speed: num(me.speed) || 0,
        moveDir: num(me.move_dir),

        packetCount: num(mh.packetCount) || 0,
        packetLimit: num(mh.packetLimit) || 119,
        moduleActive: !!mh.moduleActive,
        activeModule: mh.activeModule || null,
        healedOnce: !!mh.healedOnce,
        placedOnce: !!mh.placedOnce,
        totalPlaces: num(mh.totalPlaces) || 0,
        attacking: num(mh.attacking) || 0,
        shouldAttack: !!mh.shouldAttack,
        forceHat: mh.forceHat === undefined ? null : mh.forceHat,
        moveClaimed: mh.moveTo !== undefined && mh.moveTo !== "disable",

        threat: this._readThreat(em, pm),
        systems: this._readSystems(mh, storeHat)
      };
    }

    /* The tables carry `req: ["food", 10]` and the consume closure rather than
     * a `restore` field; RYN's own Items copy adds both. Reading the table
     * shape as a fallback keeps the engine honest if that ever changes. */
    _foodRestore(item) {
      if (!item) return 0;
      const byName = { apple: 20, cookie: 40, cheese: 30 };
      return byName[item.name] || 0;
    }
    _foodCost(item) {
      if (!item || !Array.isArray(item.req)) return 0;
      for (let i = 0; i < item.req.length; i += 2) {
        if (item.req[i] === "food") return num(item.req[i + 1]) || 0;
      }
      return 0;
    }

    /* A hat's damage multiplier, from the table rather than from memory.
     * Soldier is 0.75 (drivers: hats[6].dmgMult); anything without one is 1. */
    hatDamageMult(id) {
      const hats = this.Hats;
      const hat = hats && hats[id];
      const v = hat && num(hat.dmgMult);
      return v === null || v === undefined ? 1 : v;
    }

    /* Does the player own this hat, and can it be equipped right now. */
    ownsHat(id) {
      const mh = this.mh;
      if (!mh) return false;
      try { return !!mh.canBuy(0, id); } catch (_) { return false; }
    }

    /* Combat's own numbers. The engine does not re-derive damage; it reads what
     * EnemyManager already summed this tick (v5.4:3113-3143). */
    _readThreat(em, pm) {
      if (!em) {
        return {
          potential: 0, spike: 0, spikeKB: 0, primary: 0, projectile: 0,
          instaThreat: false, dangerEnemy: false, dangerNoSoldier: false,
          collidingSpike: false, willCollideSpike: false, spikeSync: false,
          nearestDistance: Infinity
        };
      }
      let nearestDistance = Infinity;
      try {
        const me = this.me;
        const near = em.nearestEnemy;
        if (near && near.pos && near.pos.current && me && me.pos && me.pos.current) {
          nearestDistance = me.pos.current.distance(near.pos.current);
        }
      } catch (_) {}
      let instaThreat = false;
      try { instaThreat = !!(em.instaThreat && em.instaThreat()); } catch (_) {}
      return {
        potential: num(em.potentialDamage) || 0,
        spike: num(em.potentialSpikeDamage) || 0,
        spikeKB: num(em.potentialSpikeKnockbackDamage) || 0,
        primary: num(em.primaryDamage) || 0,
        projectile: (pm && num(pm.totalDamage)) || 0,
        instaThreat,
        dangerEnemy: !!em.detectedDangerEnemy,
        dangerNoSoldier: !!em.dangerWithoutSoldier,
        collidingSpike: !!em.collidingSpike,
        willCollideSpike: !!em.willCollideSpike,
        /* The spike-tick threat EnemyManager already computes for its own
         * defensive pass (v5.4:3955-3962): an enemy standing where a spike it
         * places would touch me, summed across enemies until the combined
         * spike damage clears 100. This is the client's spike-tick warning and
         * the engine consumes it — it does not run a second placement scan. */
        spikeSync: !!em.spikeSyncThreat,
        nearestDistance
      };
    }

    /* The systems the engine is allowed to read, and nothing more. Each field
     * is one specific question, so a rename in RYN degrades one answer rather
     * than the whole arbiter. */
    _readSystems(mh, storeHat) {
      const s = (mh && mh.staticModules) || {};
      const S = this.Settings || {};
      const has = m => !!m;
      return {
        /* Anti Smart Tick eats on the tick it refuses to break out. */
        antiSmartTick: !!S._antiSmartTick && has(s.antiInsta) && !!s.antiInsta.blockBreak,
        antiInstaForceHeal: has(s.antiInsta) && !!s.antiInsta.forceHeal,
        /* Safe Soldier, soldier default and Anti Sync all express themselves
         * through state the engine already reads live: the hat slot below, and
         * ModuleHandler.healedOnce for a module that has pressed food this
         * tick. Reading their settings flags on top of that would stand the
         * engine down for anyone who merely has them switched on. */
        soldierClaimed: mh ? mh.forceHat === AH.HAT_SOLDIER || storeHat === AH.HAT_SOLDIER : false,
        safeSoldier: !!S._safeSoldier,
        /* Placement systems share the packet budget with us. */
        placer: !!(S._autoplacer || S._prePlace || S._replace),
        placementEngineBusy: has(s.placementEngine) && !!s.placementEngine.sending,
        /* Spike ticks commit a tick to a placement combo. Read from the armed
         * state each module keeps rather than from the settings flags, which
         * answer a different question: whether the feature is switched on at
         * all, which is not a reason to stand down. */
        spikeTick: (has(s.spikeSync) && !!s.spikeSync.useTurret) ||
                   (has(s.spikeSyncHammer) &&
                     (!!s.spikeSyncHammer.useTurret || s.spikeSyncHammer.targetEnemy != null)),
        /* Auto Mills drops three windmills in a tick when it fires. */
        mills: has(s.autoMill) && !!s.autoMill.isActive,
        /* Velocity Tick owns Bull for its combo; never contest it. */
        velocityArmed: has(s.velocityTick) &&
          (s.velocityTick.nearestTarget !== null || s.velocityTick.target !== null),
        /* The knockback window the combo is built around, read from the module
         * that owns it rather than kept as a second copy of the same two
         * numbers. */
        velocityBand: this._velocityBand(s.velocityTick)
      };
    }

    /* VelocityTick's window, measured the same way the module measures it —
     * the gap between my position and the target's against minKB/maxKB — so
     * the numbers transfer directly when the combo is pointed at me instead of
     * by me. The only thing that has to be added is the error in the reading:
     * my own displacement, because the module compares against `pos.future`
     * and the detector has only `pos.current`. Entity.speed is precisely last
     * tick's travel, so it is the measurement, not an estimate; it floors at
     * my collision scale because positions are not meaningful below a body
     * radius. The enemy's own displacement is added per enemy by the detector. */
    _velocityBand(vt) {
      const min = vt && num(vt.minKB) !== null ? num(vt.minKB) : AH.VELOCITY_KB_MIN;
      const max = vt && num(vt.maxKB) !== null ? num(vt.maxKB) : AH.VELOCITY_KB_MAX;
      const me = this.me;
      const drift = Math.max((num(me && me.scale) || 35), (num(me && me.speed) || 0));
      return { min, max, drift, source: vt ? "module" : "default" };
    }

    /* ---- combat evidence, for the threat engine --------------------- *
     *
     * Everything here is state the client already computes for its own combat
     * modules. None of it is re-derived, and none of it is an assumption about
     * what an enemy might do: a weapon id is only ever reported alongside the
     * reload, range and facing that say whether it can be used on us now.
     */

    /* One entry per live enemy, with the state a detector may reason from.
     * Walked once per tick. */
    enemyList() {
      return this._once("enemies", () => this._buildEnemyList()) || [];
    }

    _buildEnemyList() {
      const client = this.client;
      const me = this.me;
      const pm = client && client.PlayerManager;
      if (!pm || !me || !me.pos || !Array.isArray(pm.enemies)) return [];
      const out = [];
      for (const enemy of pm.enemies) {
        if (!enemy || !enemy.pos || !enemy.pos.current) continue;
        try {
          const weapon = enemy.weapon || {};
          const primary = num(weapon.primary);
          const secondary = num(weapon.secondary);
          const current = num(weapon.current);
          const distance = me.pos.current.distance(enemy.pos.current);
          /* Is it pointed at me: the same offset test the client uses for a
           * projectile's line (ProjectileManager.foundProjectile). */
          let facing = false;
          let angleTo = 0;
          if (distance > 0) {
            angleTo = enemy.pos.current.angle(me.pos.current);
            const offset = Math.asin(Math.min(1, (2 * (num(me.scale) || 35)) / (2 * distance)));
            facing = Math.abs(angleDist(angleTo, num(enemy.angle) || 0)) <= offset;
          }
          out.push({
            ref: enemy,
            id: enemy.id,
            distance,
            angleTo,
            facing,
            pos: enemy.pos.current,
            /* movement, measured: Entity.setFuturePosition stores last tick's
             * travel as `speed` and its direction as `move_dir`. */
            speed: num(enemy.speed) || 0,
            moveDir: num(enemy.move_dir),
            closing: this._closing(enemy, me),
            weaponCurrent: current,
            weaponPrimary: primary,
            weaponSecondary: secondary,
            weaponPrevious: num(weapon.oldCurrent),
            primaryReloaded: this._reloaded(enemy, 0),
            secondaryReloaded: this._reloaded(enemy, 1),
            turretReloaded: this._reloaded(enemy, 2),
            primaryEmpty: this._emptyReload(enemy, 0),
            secondaryEmpty: this._emptyReload(enemy, 1),
            turretEmpty: this._emptyReload(enemy, 2),
            primaryRange: this._weaponRange(enemy, primary),
            secondaryRange: this._weaponRange(enemy, secondary),
            primaryDamage: this._weaponDamage(enemy, primary),
            secondaryDamage: this._weaponDamage(enemy, secondary),
            primaryKnock: this._weaponKnock(primary),
            hatId: num(enemy.hatID) || 0,
            accId: num(enemy.accessoryID) || 0,
            health: num(enemy.currentHealth),
            trapped: !!enemy.isTrapped,
            usingBoost: !!enemy.usingBoost,
            canUseTurret: !!enemy.canUseTurret,
            lastAttacked: num(enemy.lastAttacked) || 0,
            /* the client's own per-enemy verdicts (Player.canPossiblyInstakill,
             * v5.4:3899-3970) — computed facts, not possession */
            danger: num(enemy.danger) || 0,
            reverseInsta: !!enemy.reverseInsta,
            toolHammerInsta: !!enemy.toolHammerInsta,
            rangedBowInsta: !!enemy.rangedBowInsta,
            canPlaceSpike: !!enemy.canPlaceSpike,
            spikeDamage: num(enemy.spikeDamage) || 0,
            potentialDamage: num(enemy.potentialDamage) || 0
          });
        } catch (_) { /* one unreadable enemy must not cost the whole list */ }
      }
      return out;
    }

    /* Moving toward me, in the sense the client's own Entity uses: last tick's
     * travel direction against the direction to me. */
    _closing(enemy, me) {
      try {
        const prev = enemy.pos.previous, cur = enemy.pos.current;
        if (!prev || !cur) return 0;
        return prev.distance(me.pos.current) - cur.distance(me.pos.current);
      } catch (_) { return 0; }
    }

    _reloaded(enemy, type) {
      try { return !!enemy.isReloaded(type, 1); } catch (_) { return false; }
    }
    _emptyReload(enemy, type) {
      try { return !!enemy.isEmptyReload(type); } catch (_) { return false; }
    }
    _weaponRange(enemy, id) {
      if (id === null) return 0;
      try { return num(enemy.getWeaponRange(id)) || 0; } catch (_) { return 0; }
    }
    _weaponDamage(enemy, id) {
      if (id === null) return 0;
      try { return num(enemy.getMaxWeaponDamage(id, false)) || 0; } catch (_) { return 0; }
    }
    /* weapons[i].knock — the impulse a hit adds, before the flat 0.3 every hit
     * carries (game_index.js:2547: `0.3 * (weightM||1) + weapon.knock`). */
    _weaponKnock(id) {
      const w = this.Weapons && id !== null ? this.Weapons[id] : null;
      return (w && num(w.knock)) || 0;
    }

    /* How far that impulse actually carries a player.
     *
     * RYN's own weapon table already publishes it — `knockback`, in pixels,
     * next to `knock` — so that number is used rather than a second derivation
     * of the same thing. The fallback integrates the bundle's own decay for a
     * table that does not carry it: an impulse v decaying by `playerDecel` per
     * millisecond (game_index.js:2371) travels v / (1 - decel). */
    weaponKnockback(id, decel) {
      const w = this.Weapons && id !== null && id !== undefined ? this.Weapons[id] : null;
      const published = w && num(w.knockback);
      if (published !== null && published !== undefined) return published;
      const impulse = 0.3 + ((w && num(w.knock)) || 0);
      return impulse / Math.max(1e-4, 1 - (decel === undefined ? 0.993 : decel));
    }

    /* The two data tables in this repo spell the same fields differently: the
     * game bundle uses `dmg`, and RYN's own copy — which is what the client
     * actually holds — uses `damage`. Both are read, so the engine works
     * against either and against a future table that renames one of them
     * without silently pricing everything at zero. */
    tableDamage(entry) {
      if (!entry) return 0;
      const a = num(entry.damage);
      if (a !== null) return a;
      const b = num(entry.dmg);
      return b === null ? 0 : b;
    }

    /* What a weapon's projectile is worth, from the tables. */
    projectileDamageFor(weaponId) {
      try {
        const weapons = this.Weapons;
        const projectiles = this.Projectiles;
        if (!weapons || !projectiles || weaponId === null) return 0;
        const weapon = weapons[weaponId];
        if (!weapon || weapon.projectile === undefined) return 0;
        return this.tableDamage(projectiles[weapon.projectile]);
      } catch (_) { return 0; }
    }

    /* Projectiles already in the air and already established as being on a line
     * to me — the client adds a projectile to dangerProjectiles only after its
     * own facing test (ProjectileManager.foundProjectile). Fired, not owned. */
    incomingProjectiles(snap) {
      return this._once("projectiles", () => this._buildProjectiles(snap)) || [];
    }

    _buildProjectiles(snap) {
      const client = this.client;
      const me = this.me;
      const pm = client && client.ProjectileManager;
      if (!pm || !pm.dangerProjectiles || !me || !me.pos) return [];
      const out = [];
      const tick = (snap && snap.TICK) || AH.TICK_MS;
      const myPos = me.pos.current;
      const myScale = num(me.scale) || 35;
      try {
        for (const proj of pm.dangerProjectiles) {
          if (!proj || !proj.pos || !proj.pos.current) continue;
          const p = proj.pos.current;
          const distance = p.distance(myPos);
          const speed = num(proj.speed) || 0;
          const angle = num(proj.angle) || 0;
          /* How far my centre sits from the shot's line, and therefore how far
           * I have to be off it to be missed. The client's own hit test is a
           * radius sum, so that is the radius used here. */
          const dx = myPos.x - p.x, dy = myPos.y - p.y;
          const perpendicular = Math.abs(-Math.sin(angle) * dx + Math.cos(angle) * dy);
          const along = Math.cos(angle) * dx + Math.sin(angle) * dy;
          const hitRadius = myScale + (num(proj.scale) || 0) / 2;
          out.push({
            ref: proj,
            type: num(proj.type),
            damage: this.tableDamage(proj),
            angle,
            speed,
            distance,
            along,
            perpendicular,
            hitRadius,
            /* the client's own arrival arithmetic, from
             * ProjectileManager.foundProjectileThreat */
            ticksToImpact: speed > 0 ? Math.ceil(distance / (speed * tick)) : Infinity,
            msToImpact: speed > 0 ? distance / speed : Infinity,
            life: num(proj.life) || 0,
            range: num(proj.range) || 0,
            isTurret: !!proj.isTurret,
            ownerId: proj.ownerClient ? proj.ownerClient.id : null
          });
        }
      } catch (_) { return out; }
      out.sort((a, b) => a.ticksToImpact - b.ticksToImpact);
      return out;
    }

    /* Spikes near enough to matter, and whether one is being touched. The
     * collision flags are EnemyManager's, computed in its own pass. */
    spikeContext(snap) {
      return this._once("spike", () => this._buildSpike(snap)) ||
        { colliding: false, willCollide: false, pushing: false, damage: 0,
          nearestDistance: Infinity, pusher: null, nearest: null };
    }

    _buildSpike(snap) {
      const em = this.client && this.client.EnemyManager;
      const me = this.me;
      const out = {
        colliding: false, willCollide: false, pushing: false,
        damage: 0, nearestDistance: Infinity, pusher: null, nearest: null
      };
      if (!em) return out;
      out.colliding = !!em.collidingSpike;
      out.willCollide = !!em.willCollideSpike;
      out.pushing = !!em.pushingOnSpike;
      out.damage = Math.max(num(em.potentialSpikeDamage) || 0,
        num(em.potentialSpikeKnockbackDamage) || 0);
      try {
        const spike = em.nearestPushSpike || em.nearestSpike || em.spikeCollider || em.nearestCollider;
        if (spike && spike.pos && spike.pos.current && me && me.pos) {
          out.nearest = spike;
          out.nearestDistance = me.pos.current.distance(spike.pos.current) -
            (num(spike.collisionScale) || 0) - (num(me.scale) || 35);
          if (!out.damage && typeof spike.getDamage === "function") {
            out.damage = num(spike.getDamage()) || 0;
          }
        }
        out.pusher = em.nearestEnemyPush || null;
      } catch (_) {}
      return out;
    }

    /* Trap state: whose trap, whether we are in it, and whether we could get
     * out of it with the weapon we are carrying. */
    trapContext() {
      return this._once("trap", () => this._buildTrap()) ||
        { trapped: false, enemyOwned: false, health: 0, breakable: false,
          breakTicks: Infinity, nearestDistance: Infinity, trap: null };
    }

    _buildTrap() {
      const client = this.client;
      const me = this.me;
      const em = client && client.EnemyManager;
      const out = {
        trapped: false, enemyOwned: false, health: 0, breakable: false,
        breakTicks: Infinity, nearestDistance: Infinity, trap: null
      };
      if (!me) return out;
      out.trapped = !!me.isTrapped;
      try {
        const trap = me.trappedIn;
        if (trap) {
          out.trap = trap;
          const pm = client.PlayerManager;
          out.enemyOwned = pm ? !!pm.isEnemyByID(trap.ownerID, me) : true;
          out.health = num(trap.tempHealth) === null ? num(trap.health) || 0 : trap.tempHealth;
          const secondary = num(me.getItemByType(1));
          const primary = num(me.getItemByType(0));
          let best = 0;
          for (const id of [primary, secondary]) {
            if (id === null) continue;
            try {
              const dmg = num(me.getBuildingDamage(id, false)) || 0;
              if (dmg > best) best = dmg;
            } catch (_) {}
          }
          if (best > 0 && out.health > 0) {
            out.breakTicks = Math.ceil(out.health / best);
            out.breakable = out.breakTicks <= 3;
          }
        }
        const near = em && em.nearestTrap;
        if (near && near.pos && near.pos.current && me.pos) {
          out.nearestDistance = me.pos.current.distance(near.pos.current);
        }
      } catch (_) {}
      return out;
    }

    /* Every turret that can reach me, counted once — requirement 20 needs the
     * stack, not the nearest one. Two kinds contribute: turret objects (item
     * group 7, shootRange 700) and players wearing Turret Gear (hats[53],
     * turret.range 700). Both are read from state the client already keeps.
     *
     * The object scan is a bounded grid query at my own position, which is the
     * same primitive the healing-pad read uses; there is no full-map walk. */
    turretContext(snap) {
      return this._once("turrets", () => this._buildTurrets(snap)) ||
        { present: false, count: 0, distance: Infinity, sources: [],
          combinedDamage: 0, readyNow: 0 };
    }

    _buildTurrets(snap) {
      const out = {
        present: false, count: 0, distance: Infinity, sources: [],
        combinedDamage: 0, readyNow: 0
      };
      const me = this.me;
      const client = this.client;
      if (!me || !me.pos || !snap || !snap.pos) return out;

      /* 1. turret gear and turret-capable players. EnemyManager keeps the
       *    nearest one; the enemy list has all of them, with the reload state
       *    that says whether the shot is available. */
      for (const e of this.enemyList()) {
        const gear = e.hatId === AH.HAT_TURRET_GEAR;
        if (!gear && !e.canUseTurret) continue;
        if (e.distance > AH.TURRET_RANGE) continue;
        out.sources.push({
          kind: gear ? "turret-gear" : "turret-player",
          distance: e.distance,
          ready: e.turretReloaded,
          damage: AH.TURRET_DAMAGE,
          id: e.id
        });
      }

      /* 2. placed turrets. Item group 7, owned by an enemy, within reach.
       *
       * The grid's cells are 100px, so covering a turret's 700px reach is a
       * 15-by-15 block of them — far too much to sweep every tick for a
       * structure that cannot move. So the sweep is cached and the distances
       * are not: the list of nearby enemy turrets is refreshed once a second
       * (a turret's own fire rate is 2200ms, so that is well inside its
       * cadence) or as soon as we have moved far enough for the block to be
       * the wrong block, and every tick in between only re-measures the
       * handful of objects it already found. */
      for (const entry of this._turretObjects(snap)) {
        const obj = entry.ref;
        const p = obj && obj.pos && obj.pos.current;
        if (!p) continue;
        const distance = snap.pos.distance(p);
        if (distance > AH.TURRET_RANGE) continue;
        out.sources.push({
          kind: "turret-object",
          distance,
          /* A turret with no reload state readable is treated as ready: being
           * wrong the other way is the read that gets us killed. */
          ready: obj.turretReloaded === undefined ? true : !!obj.turretReloaded,
          damage: AH.TURRET_DAMAGE,
          id: obj.sid === undefined ? entry.id : obj.sid
        });
      }

      for (const s of out.sources) {
        out.combinedDamage += s.damage;
        if (s.ready) out.readyNow += 1;
        if (s.distance < out.distance) out.distance = s.distance;
      }
      out.count = out.sources.length;
      out.present = out.count > 0;
      return out;
    }

    /* The cached half of the turret scan: which enemy turret objects are near
     * enough to matter. Rebuilt on a clock and on real movement, never on
     * every tick. Objects that have been destroyed drop out because the
     * ObjectManager no longer has them. */
    _turretObjects(snap) {
      const cache = this._turrets;
      const om = this.client && this.client.ObjectManager;
      const moved = cache && cache.pos && snap.pos
        ? Math.hypot(snap.pos.x - cache.pos.x, snap.pos.y - cache.pos.y) : Infinity;
      if (cache && snap.tick - cache.tick < AH.DOT_PERIOD_TICKS &&
          moved <= AH.TURRET_SCAN_MOVE_PX) {
        /* Still the right block. Drop anything that has been destroyed since
         * the sweep — the ObjectManager forgetting it is how we know. */
        if (!om || !om.objects) return cache.list;
        const live = cache.list.filter(e => om.objects.get(e.id) === e.ref);
        if (live.length !== cache.list.length) cache.list = live;
        return cache.list;
      }
      return this._scanTurrets(snap);
    }

    _scanTurrets(snap) {
      const me = this.me;
      const om = this.client && this.client.ObjectManager;
      const pm = this.client && this.client.PlayerManager;
      const list = [];
      if (om && om.grid2D && om.objects && snap.pos) {
        try {
          const cells = Math.ceil(AH.TURRET_RANGE / AH.GRID_CELL_PX);
          om.grid2D.query(snap.pos.x, snap.pos.y, cells, id => {
            const obj = om.objects.get(id);
            if (!obj || obj.itemGroup !== AH.ITEM_TURRET_GROUP) return;
            if (pm && me && !pm.isEnemyByID(obj.ownerID, me)) return;
            const p = obj.pos && obj.pos.current;
            if (!p) return;
            /* Kept a little wider than the reach so walking a short distance
             * does not have to re-sweep to find a turret that was always
             * there. */
            if (snap.pos.distance(p) > AH.TURRET_RANGE + AH.TURRET_SCAN_MOVE_PX) return;
            list.push({ id, ref: obj });
          });
        } catch (_) { /* a grid without query is a grid we do not scan */ }
      }
      this._turrets = {
        tick: snap.tick,
        pos: snap.pos ? { x: snap.pos.x, y: snap.pos.y } : null,
        list
      };
      return list;
    }

    /* Standing on a healing pad is +15/s of real health income
     * (game_index.js:2322, item 19 healCol 15) and belongs in the projection. */
    healingPadRegen(snap) {
      return this._once("pad", () => {
        const om = this.client && this.client.ObjectManager;
        const Items = this.Items;
        if (!om || !om.grid2D || !om.objects || !snap || !snap.pos || !Items) return 0;
        let best = 0;
        om.grid2D.query(snap.pos.x, snap.pos.y, 1, id => {
          const obj = om.objects.get(id);
          if (!obj || obj.itemGroup !== AH.ITEM_HEAL_GROUP) return;
          const item = Items[obj.type];
          const heal = item && num(item.healCol);
          if (!heal) return;
          const p = obj.pos && obj.pos.current;
          if (!p) return;
          const reach = (num(obj.collisionScale) || num(obj.scale) || 45) + snap.scale;
          if (snap.pos.distance(p) <= reach && heal > best) best = heal;
        });
        return best;
      }) || 0;
    }

    /* Whether a point is somewhere it would be worse to stand: inside a spike
     * or a trap, inside a wall. Used only by the evasion planner, and only for
     * the two candidate destinations it is choosing between, so this is a
     * bounded query and not a scan. */
    hazardAt(x, y, radius) {
      const om = this.client && this.client.ObjectManager;
      const Items = this.Items;
      const me = this.me;
      const pm = this.client && this.client.PlayerManager;
      if (!om || !om.grid2D || !om.objects) return null;
      let hazard = null;
      try {
        /* The callback's return value stops the sweep (SpatialHashGrid2D.query),
         * so the first hazard found ends it. */
        om.grid2D.query(x, y, 1, id => {
          const obj = om.objects.get(id);
          if (!obj) return false;
          const p = obj.pos && obj.pos.current;
          if (!p) return false;
          const scale = num(obj.collisionScale) || num(obj.scale) || 0;
          const gap = Math.hypot(p.x - x, p.y - y) - scale - radius;
          if (gap > 0) return false;
          const group = obj.itemGroup;
          if (group === AH.ITEM_SPIKE_GROUP) { hazard = "spike"; return true; }
          if (group === AH.ITEM_TRAP_GROUP) {
            const mine = pm && me ? !pm.isEnemyByID(obj.ownerID, me) : false;
            if (mine) return false;
            hazard = "trap";
            return true;
          }
          const item = Items && Items[obj.type];
          if (item && item.health && !item.ignoreCollision) { hazard = "blocked"; return true; }
          return false;
        });
      } catch (_) { return null; }
      return hazard;
    }

    /* RYN's own priority scale, read rather than reinvented.
     *
     * The placement engine defines RPE_PRIORITY — INSTA 90, SYNC 80, DEFENSE
     * 70, RECOVERY 60, ANTICIPATION 50, ENGAGEMENT 40, UTILITY 20 — and
     * classifies module names into it with `priorityFor`. Healing, gear and
     * placing are then ranked by one authority instead of three. */
    priorityClass(name) {
      const engine = this._priorityHost();
      if (this._priorityCacheFor !== engine) {
        this._priorityCacheFor = engine;
        this._priorityCache = {};
      }
      const hit = this._priorityCache[name];
      if (hit !== undefined) return hit;
      return (this._priorityCache[name] = this._resolvePriorityClass(name, engine));
    }

    _priorityHost() {
      const mh = this.mh;
      return (mh && mh.staticModules && mh.staticModules.placementEngine) || null;
    }

    _resolvePriorityClass(name, engine) {
      const fallback = {
        INSTA: 90, SYNC: 80, DEFENSE: 70, RECOVERY: 60,
        ANTICIPATION: 50, ENGAGEMENT: 40, UTILITY: 20
      };
      try {
        if (engine && typeof engine.priorityFor === "function") {
          const probe = {
            INSTA: "insta", SYNC: "sync", DEFENSE: "anti",
            ANTICIPATION: "autoPlacer", ENGAGEMENT: "placementEngine", UTILITY: ""
          }[name];
          if (probe !== undefined) {
            const v = num(engine.priorityFor(probe));
            if (v !== null) return v;
          }
        }
      } catch (_) {}
      return fallback[name] === undefined ? fallback.UTILITY : fallback[name];
    }

    /* Where the module that already claimed this tick sits on that scale. */
    priorityOf(moduleName) {
      try {
        const engine = this._priorityHost();
        if (engine && typeof engine.priorityFor === "function") {
          const v = num(engine.priorityFor(moduleName));
          if (v !== null) return v;
        }
      } catch (_) {}
      if (!moduleName) return this.priorityClass("UTILITY");
      if (moduleName.indexOf("nsta") !== -1) return this.priorityClass("INSTA");
      if (moduleName.indexOf("ync") !== -1 || moduleName.indexOf("ick") !== -1) {
        return this.priorityClass("SYNC");
      }
      if (moduleName.indexOf("nti") !== -1) return this.priorityClass("DEFENSE");
      return this.priorityClass("UTILITY");
    }

    /* RYN already has a motion predictor, and a good one: the placement
     * engine's TargetMotion keeps a short sample history per entity and turns
     * it into velocity, heading, a stability score and `predict(ticks)` with a
     * horizon decay, plus `intercept()` for the earliest tick a path enters a
     * circle. A private instance is constructed from its class: same code,
     * separate tracks, no interference with the planner that owns it. */
    borrowTargetMotion() {
      try {
        const engine = this._priorityHost();
        const motion = engine && engine.motion;
        if (!motion || typeof motion.observe !== "function" ||
            typeof motion.predict !== "function") return null;
        const Ctor = motion.constructor;
        if (typeof Ctor !== "function") return null;
        const instance = new Ctor();
        return typeof instance.observe === "function" ? instance : null;
      } catch (_) { return null; }
    }

    /* ---- writes ------------------------------------------------------ *
     * Four, and only four: a food press, a hat claim, a move claim, and the
     * tick claim every RYN module sets. Each one is counted by PacketBudget
     * before it leaves.
     */

    livePacketCount() {
      const mh = this.mh;
      if (!mh) return 0;
      return num(mh.packetCount) || 0;
    }

    packetsLeft() {
      const mh = this.mh;
      if (!mh) return 0;
      const limit = num(mh.packetLimit) || 119;
      return Math.max(0, limit - this.livePacketCount());
    }

    /* One press of food: select + attack + weapon restore. Going through
     * ModuleHandler's own primitives keeps currentHolding, the sent-angle
     * priority and the packet counter consistent. ModuleHandler.heal()'s own
     * gate is deliberately bypassed — the engine gates its presses itself, and
     * has to: an emergency press must not be held for a tick, and a charged
     * press at shameCount 7 must never leave at all. */
    pressFood() {
      const mh = this.mh;
      if (!mh) return false;
      try {
        this.holdingFood = true;
        mh.selectItem(AH.FOOD_TYPE);
        mh.attack(null, 1);
        mh.whichWeapon(mh._getPredictWeapon());
        this.holdingFood = false;
        return true;
      } catch (e) {
        return this._pressFailed(e);
      }
    }

    /* The same two frames without the weapon restore, so a burst can pay for
     * that once at the end instead of once per press. Select is not optional:
     * a successful consume clears buildIndex server-side (game_index.js:2476),
     * so the next attack would swing rather than eat. */
    pressFoodOnly() {
      const mh = this.mh;
      if (!mh) return false;
      try {
        /* Set before the select, not after: if selectItem lands and attack
         * throws, the client is holding food and the restore is mandatory. */
        this.holdingFood = true;
        mh.selectItem(AH.FOOD_TYPE);
        mh.attack(null, 1);
        return true;
      } catch (e) {
        return this._pressFailed(e);
      }
    }

    restoreWeapon() {
      const mh = this.mh;
      if (!mh) return false;
      try {
        mh.whichWeapon(mh._getPredictWeapon());
        this.holdingFood = false;
        return true;
      } catch (e) {
        return this._pressFailed(e);
      }
    }

    _pressFailed(e) {
      if (!this._warned) {
        this._warned = true;
        try { console.warn("[RYN AutoHeal] press failed:", e); } catch (_) {}
      }
      return false;
    }

    /* The defensive gear claim.
     *
     * `forceHat` alone is not enough to be the single decision requirement 23
     * asks for: modules later in the loop assign it directly, so the last
     * writer would win rather than the highest priority. The lock is what
     * makes the decision final — Autohat reads it ahead of forceHat, and it
     * carries the tick it was made on so it can never outlive the threat that
     * produced it.
     *
     * The lock is only ever set for a hat this engine actually decided on, and
     * only while a qualifying threat is live; with the engine off, or idle,
     * nothing is written and the client's own hat logic is untouched. */
    claimHat(hatId, priority, reason) {
      const mh = this.mh;
      if (!mh) return false;
      if (!this.ownsHat(hatId)) return false;
      const tick = num(mh.tickCount) || 0;
      const held = mh._ahGearLock;
      if (held && held.tick === tick && held.priority > priority) return false;
      mh._ahGearLock = { hat: hatId, tick, priority, reason };
      /* forceHat as well, so anything that reads it directly — the accessory
       * chooser picks Shadow with turret gear and Blood Wings with bull — sees
       * the same answer the equip will use. setForceHat yields to a claim that
       * is already there, which is the contract for modules that ran first. */
      if (mh.forceHat === null) {
        try { mh.setForceHat(hatId); } catch (_) { mh.forceHat = hatId; }
      }
      return true;
    }

    releaseHat() {
      const mh = this.mh;
      if (mh && mh._ahGearLock) mh._ahGearLock = null;
    }

    heldHatLock() {
      const mh = this.mh;
      return (mh && mh._ahGearLock) || null;
    }

    /* Whether a hat claim would actually cost a frame. ModuleHandler._equip
     * refuses a no-op (`store.last === id && storeData[type] === id`), so
     * holding a hat we are already wearing is free. */
    hatChangeCost(hatId) {
      const mh = this.mh;
      const me = this.me;
      if (!mh || !me) return AH.PACKETS_EQUIP;
      const store = mh.store && mh.store[0];
      const last = store ? store.last : null;
      const worn = me.storeData ? me.storeData[0] : me.hatID;
      return last === hatId && worn === hatId ? 0 : AH.PACKETS_EQUIP;
    }

    /* The move claim. RYN's movement contract is `ModuleHandler.moveTo`:
     * SafeWalk compares it against last tick's value and sends exactly one
     * `move` frame when it changed. Claiming it is therefore one packet, and
     * releasing it is automatic — moveTo is reset to "disable" at the top of
     * every tick, so a dodge lasts precisely one tick and the player's own key
     * direction is restored by the same code that sent the dodge. */
    claimMove(angle) {
      const mh = this.mh;
      if (!mh) return false;
      if (mh.moveTo !== "disable") return false;
      mh.moveTo = angle;
      return true;
    }

    moveClaimed() {
      const mh = this.mh;
      return !!mh && mh.moveTo !== "disable";
    }

    claimTick(critical) {
      const mh = this.mh;
      if (!mh) return;
      mh.moduleActive = true;
      mh.healedOnce = true;
      if (critical) mh.didAntiInsta = true;
    }

    claimModule() {
      const mh = this.mh;
      if (mh) mh.moduleActive = true;
    }

    /* The live read that runs immediately before a press.
     *
     * Deliberately not the full snapshot: this is on the execution path, and
     * everything here is a direct field read off two objects the client has
     * already updated this tick. No grid queries, no enemy walk, no projectile
     * scan — those belong to the decision, which has already happened. */
    liveState() {
      const me = this.me;
      const mh = this.mh;
      if (!me) return null;
      const hatId = num(me.hatID) || 0;
      const hat = this.Hats ? this.Hats[hatId] : null;
      const foodId = num(me.getItemByType ? me.getItemByType(AH.FOOD_TYPE) : null);
      const Items = this.Items;
      const item = foodId !== null && Items ? Items[foodId] : null;
      const res = me.resources || {};
      return {
        /* shame */
        count: clamp(num(me.shameCount) || 0, 0, AH.SHAME_MAX),
        active: !!me.shameActive || hatId === AH.HAT_SHAME,
        receivedDamage: num(me.receivedDamage),
        /* hp */
        health: num(me.currentHealth),
        /* healing availability */
        foodId,
        restore: item && num(item.restore) ? item.restore : this._foodRestore(item),
        foodCost: item && item.cost && num(item.cost.food) ? item.cost.food : this._foodCost(item),
        foodStock: num(res.food) === null ? 0 : res.food,
        /* player state */
        inGame: !!me.inGame,
        noEat: !!(hat && hat.noEat),
        trapped: !!me.isTrapped,
        hatId,
        /* combat state and priority */
        packetCount: mh ? num(mh.packetCount) || 0 : 0,
        packetLimit: mh ? num(mh.packetLimit) || 119 : 119,
        moduleActive: mh ? !!mh.moduleActive : false,
        activeModule: mh ? mh.activeModule || null : null,
        healedOnce: mh ? !!mh.healedOnce : false
      };
    }
  }

  /* ================================================================== *
   * StateTracker — the self model, and the hit latch.
   * ================================================================== */
  class StateTracker {
    constructor() { this.reset(); }

    reset() {
      this.tick = 0;
      this.lastTickAt = 0;
      this.health = AH.MAX_HEALTH;
      this.prevHealth = AH.MAX_HEALTH;
      this.delta = 0;
      this.history = [];
      /* The engine's mirror of the server's `hitTime`: when the hit was seen,
       * and — the one that decides the verdict — which tick it was seen on. */
      this.hitAt = 0;
      this.hitTick = null;
      this.pending = false;
      this.tickStartedAt = 0;
      this.lastPressTick = -999;
      this.lastPressAt = 0;
      this.lastDamageTick = -999;
      this.healLandedThisTick = false;
      this.hiddenDamage = 0;
      this.cheeseUntil = 0;
      this.alive = false;
      this.seeded = false;
      /* Requirement 4's "time since last damage", in ms and in ticks. */
      this.msSinceDamage = Infinity;
      this.ticksSinceDamage = Infinity;
    }

    update(snap, ledger) {
      const wasAlive = this.alive;
      this.alive = snap.inGame;
      const spawned = !wasAlive && this.alive;
      if (spawned) this.onSpawn();

      this.tick = snap.tick;
      this.lastTickAt = snap.now;
      this.tickStartedAt = snap.now;
      /* The first tick of a life has nothing to difference against. Seeding
       * from the bar rather than from the constructor's 100 is what stops a
       * spawn at anything other than full health from reading as a hit — and a
       * phantom hit is a phantom pending stamp, which is a press the engine
       * would price as charged for no reason at all. */
      this.prevHealth = spawned || !this.seeded ? snap.health : this.health;
      this.seeded = true;
      this.health = snap.health;
      this.delta = this.health - this.prevHealth;
      this.healLandedThisTick = this.delta > 0;

      this.history.push({ tick: snap.tick, at: snap.now, health: this.health, delta: this.delta });
      if (this.history.length > 32) this.history.shift();

      /* Damage sets hitTime server-side on every negative changeHealth
       * (game_index.js:2422) — enemy hits, spike contact, poison and the Bull
       * helmet's own -5 regen all count.
       *
       * Damage that landed on the same tick as a heal is invisible in the net
       * health: forty of cookie and twenty of katana read as "+20, nothing hit
       * me". The server disagrees — hitTime was stamped — and the next press
       * would be charged while the engine believed it was free. That is the
       * press that walks the count to 8.
       *
       * The in-flight ledger is what makes it visible: a press sent last tick
       * is worth a known amount of health this tick, so health short of
       * (previous + what landed) is damage, whatever the net sign says. */
      const landed = ledger ? ledger.landedExpectation(snap) : 0;
      const expected = Math.min(snap.maxHealth, this.prevHealth + landed);
      this.hiddenDamage = landed > 0 ? Math.max(0, expected - this.health) : 0;

      let hit = false;
      if (this.delta < 0) {
        this.hitAt = snap.receivedDamage !== null ? snap.receivedDamage : snap.now;
        this.hitTick = snap.tick;
        hit = true;
      } else if (this.hiddenDamage >= 1) {
        this.hitAt = snap.now;
        this.hitTick = snap.tick;
        hit = true;
      } else if (snap.receivedDamage !== null && snap.receivedDamage > this.hitAt) {
        /* Damage the health sampler missed between ticks. */
        this.hitAt = snap.receivedDamage;
        this.hitTick = snap.tick;
        hit = true;
      }
      if (hit) {
        this.pending = true;
        this.lastDamageTick = snap.tick;
      }

      /* The latch is cleared only by a food press, because that is the only
       * thing that clears hitTime on the server (game_index.js:2463). Health
       * rising does not: regen gear and healing pads raise health with the hit
       * still pending, so clearing on a rise would let a charged press through
       * believing it was free. `healedOnce` covers presses the modules ahead of
       * us in the tick sent through ModuleHandler.heal. */
      if (snap.healedOnce) this.pending = false;

      this.msSinceDamage = this.hitAt > 0 ? snap.now - this.hitAt : Infinity;
      this.ticksSinceDamage = this.lastDamageTick > -999
        ? snap.tick - this.lastDamageTick : Infinity;

      if (snap.now > this.cheeseUntil) this.cheeseUntil = 0;
    }

    onSpawn() {
      this.hitAt = 0;
      this.hitTick = null;
      this.pending = false;
      this.seeded = false;
      this.history.length = 0;
      this.cheeseUntil = 0;
      this.lastDamageTick = -999;
    }

    notePress(snap) {
      this.pending = false;
      this.lastPressTick = snap.tick;
      this.lastPressAt = snap.now;
      /* Cheese leaves dmgOverTime.dmg = -10 for 5 seconds, i.e. +10/s
       * (game_index.js:1897). */
      if (snap.isCheese) this.cheeseUntil = snap.now + 5000;
    }

    /* Damage seen over the last `ticks` ticks, the sustained-pressure term. */
    recentDamage(ticks) {
      let sum = 0;
      for (let i = this.history.length - 1, n = 0; i >= 0 && n < ticks; i--, n++) {
        if (this.history[i].delta < 0) sum -= this.history[i].delta;
      }
      return sum;
    }
  }

  /* ================================================================== *
   * DamageAnalyzer — what just hit us, how often, and when the next
   * self-inflicted tick lands.
   * ================================================================== */
  class DamageAnalyzer {
    constructor() { this.reset(); }

    reset() {
      this.burst = 0;
      this.rate = 0;
      this.dotPerSecond = 0;
      this.regenPerSecond = 0;
      this.dotActive = false;
      this.ticksUntilDot = AH.DOT_PERIOD_TICKS;
      this.msUntilDot = AH.DOT_PERIOD_MS;
      this.underFire = false;
      this.hits = [];
      this.intervals = [];
      this.damageFrequency = 0;
      this.meanInterval = Infinity;
      this.expectedNextHitTicks = Infinity;
    }

    update(snap, state) {
      this.burst = Math.max(state.delta < 0 ? -state.delta : 0, state.hiddenDamage);
      this.rate = state.recentDamage(AH.DOT_PERIOD_TICKS);
      this.underFire = snap.tick - snap.damageTick <= 1;

      /* Damage events per second over the rate window. This is the term the
       * shame forecast multiplies: every hit is a stamp on hitTime, and every
       * stamp is a +1 or a -2 waiting to be decided. */
      if (this.burst > 0) {
        const last = this.hits.length ? this.hits[this.hits.length - 1] : null;
        if (last !== null && snap.tick > last) this.intervals.push(snap.tick - last);
        this.hits.push(snap.tick);
      }
      while (this.hits.length && snap.tick - this.hits[0] > AH.SHAME_RATE_WINDOW_TICKS) {
        this.hits.shift();
      }
      while (this.intervals.length > 8) this.intervals.shift();
      this.damageFrequency =
        this.hits.length / ((AH.SHAME_RATE_WINDOW_TICKS * snap.TICK) / 1000);

      /* The cadence, and therefore when the next one is due. A regular
       * attacker — spam daggers, a repeater, a turret on its own rate — has an
       * interval; an irregular one has a wide spread and the forecast says so
       * by returning Infinity rather than a number nobody should trust. */
      if (this.intervals.length >= 2) {
        let sum = 0;
        for (const v of this.intervals) sum += v;
        const mean = sum / this.intervals.length;
        let spread = 0;
        for (const v of this.intervals) spread += Math.abs(v - mean);
        spread /= this.intervals.length;
        this.meanInterval = spread <= Math.max(1, mean * 0.5) ? mean : Infinity;
      } else {
        this.meanInterval = Infinity;
      }
      if (this.meanInterval !== Infinity && this.hits.length) {
        const since = snap.tick - this.hits[this.hits.length - 1];
        this.expectedNextHitTicks = Math.max(0, Math.round(this.meanInterval - since));
      } else {
        this.expectedNextHitTicks = Infinity;
      }

      /* Signed damage-over-time per second. Bull is healthRegen -5
       * (drivers: hats[7]) and poison is a flat -5 while poisonCount is set
       * (v5.4:6267-6277, matching game_index.js:2319). */
      const regen = snap.hatRegen + snap.accRegen;
      const poison = snap.poisonCount > 0 ? -5 : 0;
      const net = regen + poison;
      this.dotPerSecond = net < 0 ? -net : 0;
      this.regenPerSecond = net > 0 ? net : 0;
      this.dotActive = this.dotPerSecond > 0;

      /* RYN tracks the phase of the one-second tick: bullTick is the tick a
       * damage-over-time hit was last seen on, and isBullTickTime is
       * `(tickCount - bullTick) % 9 === 0`. The next one is therefore a known
       * number of ticks away, which is what lets the engine put a heal in
       * front of a self-inflicted hit instead of into the 120ms shadow behind
       * it. */
      const since = ((snap.tick - snap.bullTick) % AH.DOT_PERIOD_TICKS + AH.DOT_PERIOD_TICKS) %
        AH.DOT_PERIOD_TICKS;
      this.ticksUntilDot = since === 0 ? AH.DOT_PERIOD_TICKS : AH.DOT_PERIOD_TICKS - since;
      this.msUntilDot = this.ticksUntilDot * snap.TICK;
    }
  }

  /* ================================================================== *
   * The shame engine — requirements 1 to 4, and the reason the rest of the
   * engine exists in the shape it does.
   *
   * The objective is SHAME_TARGET, which is 0. Not "under 7", not "under 5":
   * zero, held, and returned to immediately whenever something forces it up.
   *
   * That is achievable because of what the rule actually costs (see AH above):
   *
   *   - a press with no hit pending is free — it changes nothing;
   *   - a press more than 120ms after a hit is -2;
   *   - a press at full health consumes no food either, because
   *     changeHealth refuses a heal at the cap and buildItem only calls
   *     useRes when consume returned true (game_index.js:2418, 2475).
   *
   * So the way down is nearly free, and the engine's job is to take it the
   * moment it opens rather than to ration it. What it costs is three packets
   * and one tick of patience.
   *
   * The way up is the only thing that has to be rationed: a charged press.
   * There are exactly two situations that justify one, and they are both
   * survival — waiting drops us below the reserve floor, or waiting kills us.
   * Everything else waits the tick out.
   * ================================================================== */

  /* ---- what the count is doing, and how fast ------------------------ */
  class ShameTracker {
    constructor() { this.reset(); }

    reset() {
      this.current = 0;
      this.previous = 0;
      this.delta = 0;
      this.events = [];            // {tick, at, delta}
      this.increaseRate = 0;       // charges per second, over the rate window
      this.decreaseRate = 0;       // credits per second
      this.zone = ZONE.SAFE;
      this.previousZone = ZONE.SAFE;
      this.zoneSinceTick = 0;
      this.ticksInZone = 0;
      this.healingState = HEAL_STATE.IDLE;
      this.cooldownState = COOLDOWN_STATE.FREE;
      /* Requirement 4's centralised state, all of it in one place. */
      this.health = AH.MAX_HEALTH;
      this.maxHealth = AH.MAX_HEALTH;
      this.incomingDamage = 0;
      this.recentDamage = 0;
      this.damageFrequency = 0;
      this.msSinceDamage = Infinity;
      this.expectedNextHitTicks = Infinity;
      this.threatLevel = CONFIDENCE.NONE;
      this.peak = 0;
      this.debtSinceTick = -1;
      this.worstDebtTicks = 0;
    }

    static zoneFor(count) {
      if (count >= AH.SHAME_MAX) return ZONE.CRITICAL;
      if (count >= AH.SHAME_WARN_HIGH) return ZONE.HIGH;
      return count > AH.SHAME_TARGET ? ZONE.WARNING : ZONE.SAFE;
    }

    update(snap, count, ctx) {
      this.previous = this.current;
      this.current = count;
      this.delta = this.current - this.previous;
      if (this.current > this.peak) this.peak = this.current;

      if (this.delta !== 0) this.events.push({ tick: snap.tick, at: snap.now, delta: this.delta });
      while (this.events.length && snap.tick - this.events[0].tick > AH.SHAME_RATE_WINDOW_TICKS) {
        this.events.shift();
      }
      const windowSeconds = (AH.SHAME_RATE_WINDOW_TICKS * snap.TICK) / 1000;
      let up = 0, down = 0;
      for (const e of this.events) {
        if (e.delta > 0) up += e.delta;
        else down -= e.delta;
      }
      this.increaseRate = up / windowSeconds;
      this.decreaseRate = down / windowSeconds;

      this.previousZone = this.zone;
      this.zone = ShameTracker.zoneFor(ctx.locked ? AH.SHAME_MAX : count);
      if (this.zone !== this.previousZone) this.zoneSinceTick = snap.tick;
      this.ticksInZone = snap.tick - this.zoneSinceTick;

      /* How long the count has been off target. This is the number that says
       * whether recovery is working, and it is the one to watch in a trace:
       * a debt that persists is a bug in the opportunity finder, not bad luck. */
      if (count > AH.SHAME_TARGET) {
        if (this.debtSinceTick < 0) this.debtSinceTick = snap.tick;
        this.worstDebtTicks = Math.max(this.worstDebtTicks, snap.tick - this.debtSinceTick);
      } else {
        this.debtSinceTick = -1;
      }

      this.health = snap.health;
      this.maxHealth = snap.maxHealth;
      this.incomingDamage = ctx.incomingDamage;
      this.recentDamage = ctx.recentDamage;
      this.damageFrequency = ctx.damageFrequency;
      this.msSinceDamage = ctx.msSinceDamage;
      this.expectedNextHitTicks = ctx.expectedNextHitTicks;
      this.threatLevel = ctx.threatLevel;
      this.healingState = ctx.locked ? HEAL_STATE.LOCKED
        : ctx.backoff ? HEAL_STATE.BACKOFF
        : ctx.pressedLastTick ? HEAL_STATE.PRESSING
        : ctx.inFlight > 0 ? HEAL_STATE.AWAITING
        : HEAL_STATE.IDLE;
      this.cooldownState = ctx.backoff ? COOLDOWN_STATE.BACKOFF
        : ctx.holding ? COOLDOWN_STATE.HOLDING
        : COOLDOWN_STATE.FREE;
    }

    get debtTicks() {
      return this.debtSinceTick < 0 ? 0 : Math.max(0, this.current > 0 ? 1 : 0);
    }

    get approachingCritical() {
      return this.current >= AH.SHAME_WARN_HIGH && this.current < AH.SHAME_MAX;
    }
  }

  /* ---- where the count is heading, and how sure we are --------------- *
   *
   * The forecast answers one question early enough to matter: is the next
   * stretch of this fight going to force charged presses, and if so should the
   * engine be topping up *now*, while presses are still free? Waiting until
   * the count is actually high is waiting until the only moves left are the
   * expensive ones.
   * ------------------------------------------------------------------- */
  class ShamePredictor {
    constructor() { this.reset(); }

    reset() {
      this.confidence = 0;
      this.expectedEvents = 0;
      this.expectedCharges = 0;
      this.expectedCredits = 0;
      this.projected = 0;
      this.ticksToCritical = Infinity;
      this.willReachCritical = false;
      this.forcedShare = 0;
    }

    forecast(snap, count, damage, threat, predict) {
      const horizonTicks = AH.SHAME_HORIZON_TICKS;
      const horizonSeconds = (horizonTicks * snap.TICK) / 1000;

      /* How reliable the incoming damage actually is. A poison tick is
       * arithmetic; an enemy standing in range holding a reloaded weapon is a
       * guess. Spending food on the guess is what wastes healing resources. */
      this.confidence = threat.confidence;

      /* Damage events expected in the horizon: the observed hit frequency,
       * plus the damage-over-time tick if one falls inside it. Both measured. */
      const dotEvents = damage.dotActive && damage.ticksUntilDot <= horizonTicks ? 1 : 0;
      this.expectedEvents = damage.damageFrequency * horizonSeconds + dotEvents;

      /* Of those, the share we would be forced to heal through inside the
       * window rather than waiting a tick for credit. Being one food short of
       * the threat is what forces it. */
      const headroom = predict.projected - threat.effective;
      const restore = snap.restore || 1;
      this.forcedShare = headroom <= 0 ? 1
        : headroom <= restore ? 0.75
        : headroom <= restore * 2 ? 0.35
        : 0;

      const charges = this.expectedEvents * this.forcedShare * Math.max(this.confidence, 0);
      this.expectedCharges = charges;
      /* Every event we are not forced to heal through inside the window is a
       * credit instead, worth two — but only one credit per event, and only if
       * we eat at all, so it is capped by how much healing we will want to do. */
      const unforced = Math.max(0, this.expectedEvents - charges);
      this.expectedCredits = Math.min(unforced, count / AH.SHAME_CREDIT) * AH.SHAME_CREDIT;

      this.projected = clamp(
        count + this.expectedCharges - this.expectedCredits, 0, AH.SHAME_MAX
      );
      const perTick = this.expectedCharges / horizonTicks;
      this.ticksToCritical = perTick > 0
        ? Math.max(0, (AH.SHAME_MAX - count) / perTick)
        : Infinity;
      this.willReachCritical =
        this.projected >= AH.SHAME_MAX || this.ticksToCritical <= horizonTicks;
      return this;
    }

    get actionable() { return this.confidence >= AH.CONFIDENCE_LOW; }
    get reliable() { return this.confidence >= AH.CONFIDENCE_HIGH; }
  }

  /* ---- the earliest valid way down ---------------------------------- *
   *
   * Credit is not something that accumulates; it is a single -2 attached to a
   * pending hit, and the first press after that hit either takes it or spends
   * it the wrong way. So "reduce shame" is always a question of *when*, and
   * there are exactly three answers.
   * ------------------------------------------------------------------- */
  class ShameOpportunity {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.mode = "none";
      this.etaTicks = Infinity;
      this.reason = "";
    }

    find(snap, state, damage, threat, shame, systems) {
      this.mode = "none";
      this.etaTicks = Infinity;
      this.reason = "";

      if (shame.locked) { this.reason = "locked"; return this; }
      if (shame.count <= AH.SHAME_TARGET) { this.reason = "on-target"; return this; }

      /* 1. A hit is pending and the window has passed: press now, take the -2.
       *    At full health it also costs no food (game_index.js:2475), which is
       *    what makes holding the count at zero affordable at all. */
      if (shame.verdictNow === VERDICT.CREDIT) {
        this.mode = "credit-now";
        this.etaTicks = 0;
        this.reason = "pending-hit-past-window";
        return this;
      }

      /* 2. A hit is pending but still inside the window: the credit is one
       *    tick away. Named even though the decision may not be able to wait
       *    for it — that trade is made against health, not here. */
      if (shame.verdictNow === VERDICT.CHARGED) {
        this.mode = "credit-wait";
        this.etaTicks = 1;
        this.reason = "window-opens-next-tick";
        return this;
      }

      /* 3. Nothing pending, so there is no credit to take and one has to be
       *    manufactured. Bull Helmet's healthRegen -5 stamps a hit on the next
       *    one-second tick (game_index.js:2317), and a press after that tick is
       *    a -2 that also heals the 5 back. Only on a quiet field: Bull carries
       *    no damage reduction, so arming it in front of anything that can hit
       *    back trades health for a point a natural credit would have given
       *    free. novastorm gates its own reset the same way. */
      if (!this.adapter.washEnabled) { this.reason = "manufacture-off"; return this; }
      if (threat.effective > 0 || damage.underFire || threat.spikeContact) {
        this.reason = "not-quiet";
        return this;
      }
      if (snap.poisonCount > 0 || snap.bullOn) { this.reason = "already-ticking"; return this; }
      if (systems.velocityArmed || systems.soldierClaimed) { this.reason = "hat-claimed"; return this; }
      if (snap.forceHat !== null) { this.reason = "hat-claimed"; return this; }

      this.mode = "bull";
      this.etaTicks = Math.max(1, damage.ticksUntilDot);
      this.reason = "manufacture-hit";
      return this;
    }
  }

  /* ---- the facade the rest of the engine talks to -------------------- */
  class ShameEngine {
    constructor(adapter) {
      this.adapter = adapter;
      this.tracker = new ShameTracker();
      this.predictor = new ShamePredictor();
      this.opportunity = new ShameOpportunity(adapter);
      this.reset();
    }

    reset() {
      this.count = 0;
      this.mirrorPrev = 0;
      this.locked = false;
      this.verdictNow = VERDICT.FREE;
      this.msUntilCredit = 0;
      this.deferred = [];      // adjustments the mirror will not see
      this.washMode = null;    // "natural" | "bull" | null
      this.lastWashTick = -999;
      this.revalidations = 0;
      /* Set the moment a charge is spent, cleared when the debt it created is
       * repaid. Requirement 3: the recovery is not something the next tick
       * might get round to, it is an outstanding obligation the engine carries
       * until the count is back on target. */
      this.owedSinceTick = -1;
      this.chargesSpent = 0;
      this.creditsTaken = 0;
      this.tracker.reset();
      this.predictor.reset();
      this.opportunity.reset();
    }

    get zone() { return this.tracker.zone; }
    get safe() { return this.tracker.zone === ZONE.SAFE; }
    get warning() { return this.tracker.zone === ZONE.WARNING; }
    get high() { return this.tracker.zone === ZONE.HIGH; }
    get critical() { return this.tracker.zone === ZONE.CRITICAL; }
    get approachingCritical() {
      return this.tracker.approachingCritical || this.predictor.willReachCritical;
    }
    /* The debt, which is the whole of the objective: anything above the target
     * is owed and is repaid at the first safe opportunity. */
    get debt() { return Math.max(0, this.count - AH.SHAME_TARGET); }
    get onTarget() { return this.count <= AH.SHAME_TARGET; }

    update(snap, state, damage, ctx) {
      this.locked = snap.shameActive;
      if (this.locked) {
        /* The lock zeroes the count when it expires (game_index.js:2313). */
        this.count = 0;
        this.mirrorPrev = snap.mirrorShame;
        this.deferred.length = 0;
        this.verdictNow = VERDICT.CHARGED;
        this.tracker.update(snap, 0, Object.assign({ locked: true }, ctx));
        return;
      }

      /* Mirror-driven: every press that actually healed moves RYN's count, and
       * that delta is the server's own arithmetic replayed on observed times.
       * Adopt it rather than second-guessing it. */
      if (snap.mirrorShame !== this.mirrorPrev) {
        this.count = clamp(this.count + (snap.mirrorShame - this.mirrorPrev), 0, AH.SHAME_MAX);
        this.mirrorPrev = snap.mirrorShame;
        /* A mirror move means a heal landed, so any adjustment we deferred for
         * that press is the mirror's now, not ours. */
        this.deferred.length = 0;
      }

      /* Engine-driven: presses at full health change no health, so the mirror
       * never sees them. They are applied a couple of ticks later, and only if
       * no health rise turned up in the meantime. */
      for (let i = this.deferred.length - 1; i >= 0; i--) {
        const d = this.deferred[i];
        if (snap.tick - d.tick < 2) continue;
        this.deferred.splice(i, 1);
        this.count = clamp(this.count + d.delta, 0, AH.SHAME_MAX);
      }

      if (this.count <= AH.SHAME_TARGET) this.owedSinceTick = -1;

      this.verdictNow = this.verdict(snap, state);
      this.msUntilCredit = this.creditIn(snap, state);
      this.tracker.update(snap, this.count, Object.assign({ locked: false }, ctx));
    }

    /* Second half of the tick's shame work, once the threat and the projection
     * exist: where the count is heading, and the earliest way down. */
    project(snap, state, damage, threat, predict, systems) {
      this.predictor.forecast(snap, this.count, damage, threat, predict);
      this.opportunity.find(snap, state, damage, threat, this, systems);
      return this;
    }

    /* What a press leaving now would do, server-side.
     *
     * The wall-clock reading of the rule is that we can only bound the
     * server's gap from below — the hit landed at least half a round trip
     * before we saw it and the press arrives at least half a round trip after
     * we send it, so the gap is at least (now - hitObservedAt) + pong. That
     * bound is correct but weak: at pong 0 it says a press one tick later is
     * still charged.
     *
     * The tick grid is sharper, and it is the shape the game actually has.
     * Both ends of the comparison happen inside the server's update pass:
     * hitTime is stamped by a changeHealth call during a tick
     * (game_index.js:2422) and the comparison runs in buildItem during a later
     * one (:2462). The gap is therefore very close to a whole number of ticks,
     * and at 1000/9 ms per tick the only value that lands inside the 120ms
     * window is one tick (111ms). Two ticks is 222ms and always credit.
     *
     * A press sent on the tick we saw the damage is processed on the tick
     * after the damage tick: one tick, charged. A press sent on any later tick
     * is two or more: credit. Every error in this model runs the safe way — a
     * delayed health packet or a pong over one tick only pushes the real gap
     * further out, never nearer.
     *
     * The wall-clock lower bound is kept as a second route to credit, for the
     * case where latency alone has already carried the press past the window. */
    verdict(snap, state) {
      if (!state.pending) return VERDICT.FREE;
      if (state.hitTick !== null && state.hitTick < snap.tick) return VERDICT.CREDIT;
      const lower = (snap.now - state.hitAt) + snap.pong;
      return lower >= AH.SHAME_WINDOW_MS + AH.SHAME_WINDOW_MARGIN_MS
        ? VERDICT.CREDIT
        : VERDICT.CHARGED;
    }

    /* How long until a press stops being charged: the rest of this tick. */
    creditIn(snap, state) {
      if (!state.pending || this.verdictNow === VERDICT.CREDIT) return 0;
      const elapsedInTick = Math.max(0, snap.now - state.tickStartedAt);
      const byClock = (AH.SHAME_WINDOW_MS + AH.SHAME_WINDOW_MARGIN_MS) -
        ((snap.now - state.hitAt) + snap.pong);
      return Math.max(0, Math.min(snap.TICK - elapsedInTick, byClock));
    }

    /* The count to gate a charged press on: the higher of the engine's own and
     * the client's mirror.
     *
     * The two can disagree in both directions — the mirror is blind to presses
     * that healed nothing, the engine is blind to presses other modules sent
     * that it never saw land — and the cost of the disagreement is not
     * symmetric. Being one too low here is the press that arms the lock. Being
     * one too high only postpones a heal. */
    chargeSafeCount(snap) {
      return Math.max(this.count, snap ? snap.mirrorShame : 0);
    }

    /* How many +1 presses are left before the count would reach 8. Zero at 7,
     * which is the hard invariant: the press that reaches 8 sets the 30s lock
     * BEFORE consume is reached (game_index.js:2465-2469), so it does not heal
     * either. There is never a survival case for sending it. */
    chargeBudget(snap) {
      return Math.max(0, AH.SHAME_MAX - this.chargeSafeCount(snap));
    }

    /* May a charged press leave at all — requirement 1, as a constraint rather
     * than a price.
     *
     * The engine's operating point is 0, so a charge is never taken to be
     * comfortable. It is taken when not taking it costs health that cannot be
     * bought back, and nowhere else:
     *
     *   - never at the ceiling: the press arms the lock and heals nothing;
     *   - with Strict Shame Guard on, only to survive the tick;
     *   - otherwise, only when waiting would drop the bar under the reserve
     *     floor, or when survival says waiting is fatal.
     *
     * Note what is *not* here: being under half health, being in a fight,
     * being at count 3 rather than 6. None of those is a reason to spend a
     * charge when the same food is available one tick later for -2 instead. */
    mayCharge(snap, ctx) {
      if (this.chargeSafeCount(snap) >= AH.SHAME_MAX) return { ok: false, why: "lockguard" };
      if (ctx.survival) return { ok: true, why: "survival" };
      if (this.adapter.strict) return { ok: false, why: "strict-guard" };
      if (ctx.belowFloorAfterWait) return { ok: true, why: "floor-breached-by-wait" };
      return { ok: false, why: "credit-is-one-tick-away" };
    }

    /* Credit is only available while a hit is pending — one -2 per damage
     * event, no more (hitTime is cleared by the first press). */
    creditAvailable() {
      return this.count > AH.SHAME_TARGET && this.verdictNow === VERDICT.CREDIT;
    }

    /* The wash the decision engine should take this tick, if any. */
    planWash() {
      const mode = this.opportunity.mode;
      this.washMode = mode === "credit-now" ? "natural" : mode === "bull" ? "bull" : null;
      return this.washMode;
    }

    /* ---- validation -------------------------------------------------- *
     *
     * Nothing is pressed on a shame count that was read at the top of the tick
     * and could have moved since. The client is single-threaded, so inside one
     * postTick the window is small — but it is not nothing, and what it costs
     * when it is wrong is the one press that arms the lock without healing.
     *
     * So the live count, the live lock and the live hit stamp are re-read
     * immediately before execution, the verdict is re-derived from them, and
     * the plan is recalculated against what came back. */
    revalidate(snap, state, live, plan) {
      this.revalidations += 1;
      const out = {
        ok: true, verdict: plan.verdict, presses: plan.presses, reason: "", changed: false
      };
      if (!live) return out;

      if (live.active) {
        return { ok: false, verdict: plan.verdict, presses: 0, reason: "locked", changed: true };
      }

      /* Re-derive the verdict from the live hit stamp. A hit that landed after
       * the snapshot turns a free press into a charged one. */
      let verdict = plan.verdict;
      if (live.receivedDamage !== null && live.receivedDamage > state.hitAt) {
        verdict = VERDICT.CHARGED;
      } else if (live.receivedDamage === null && !state.pending) {
        verdict = VERDICT.FREE;
      }
      if (verdict !== plan.verdict) out.changed = true;
      out.verdict = verdict;

      /* Re-gate on the live count. */
      const gate = Math.max(this.count, live.count);
      if (verdict === VERDICT.CHARGED && gate >= AH.SHAME_MAX) {
        return { ok: false, verdict, presses: 0, reason: "lockguard", changed: true };
      }
      /* A press that was planned free or credit and came back charged has to
       * clear the charge policy it was never asked about. Only survival buys
       * a charge the plan did not price. */
      if (verdict === VERDICT.CHARGED && plan.verdict !== VERDICT.CHARGED &&
          plan.urgency < URGENCY.SUSTAIN) {
        return { ok: false, verdict, presses: 0, reason: "became-charged", changed: true };
      }
      if (verdict === VERDICT.CHARGED && gate > this.chargeSafeCount(snap) &&
          plan.urgency < URGENCY.CRITICAL) {
        /* The count went up while we were deciding, and this was not an
         * emergency: let the next tick re-plan against the new number. */
        return { ok: false, verdict, presses: 0, reason: "count-moved", changed: true };
      }

      /* Recalculate the press count against live health: a heal that landed in
       * the meantime is health we no longer have to buy. */
      if (typeof live.health === "number" && snap.restore > 0) {
        if (live.health >= snap.maxHealth && plan.urgency !== URGENCY.RECOVER) {
          return { ok: false, verdict, presses: 0, reason: "already-full", changed: true };
        }
        const needed = Math.ceil((snap.maxHealth - live.health) / snap.restore);
        if (plan.urgency !== URGENCY.RECOVER && out.presses > needed) {
          out.presses = Math.max(1, needed);
          out.changed = true;
        }
      }
      return out;
    }

    /* Record what the press we just sent should do. It is deferred rather than
     * applied, because the mirror may or may not see the same press: it moves
     * only on an observed health rise, so it catches a press that healed and is
     * blind to one that did not. If the mirror moves within two ticks its delta
     * wins and this one is dropped; if it does not, this one lands. Either way
     * the count moves once. */
    notePress(snap, verdict) {
      if (verdict === VERDICT.FREE) return;
      const delta = verdict === VERDICT.CHARGED ? 1 : -AH.SHAME_CREDIT;
      this.deferred.push({ tick: snap.tick, delta });
      if (verdict === VERDICT.CHARGED) {
        this.chargesSpent += 1;
        if (this.owedSinceTick < 0) this.owedSinceTick = snap.tick;
      } else {
        this.creditsTaken += 1;
        this.lastWashTick = snap.tick;
      }
    }
  }

  /* ================================================================== *
   * The threat engine — requirements 6 to 21.
   *
   * One engine, one enemy walk, one projectile walk, one shared context.
   * Every detector reads that context and returns at most one report; nothing
   * in here touches the client and nothing in here sends anything.
   *
   * The damage number the heal engine spends against is still Combat's own:
   * EnemyManager has already summed weapons in range and off reload, spike
   * contact, turret and knock-onto-spike, and ProjectileManager has already
   * summed what is in the air. None of that is re-derived.
   *
   * What the detectors add is the *shape* of the threat rather than its size:
   * which sequence it is, how sure we are, how much it is worth, how soon it
   * lands, what gear answers it and how many packets that costs. Every one of
   * them is built on the same rule (requirement 31) — evidence, not
   * possession. An enemy carrying a musket is not a musket threat. A musket
   * ball in the air on a line to me is; a musket held by someone facing me,
   * in range, off reload, freshly switched to, is one at lower confidence.
   * ================================================================== */

  /* The defensive answers a detector may ask for. Named by what they do,
   * because that is what the gear manager selects on: the game's own tables
   * say Soldier Helmet is the damage reduction (dmgMult 0.75) and Emp Helmet
   * is the turret denial (antiTurret 1). Bull Helmet is neither — healthRegen
   * -5 and dmgMultO 1.5 are an offensive trade — so no detector asks for it. */
  const GEAR = {
    NONE: null,
    SOLDIER: "soldier",   // hats[6].dmgMult 0.75, applied server-side in changeHealth
    EMP: "emp"            // hats[22].antiTurret 1, turrets do not fire at us
  };

  /* One detector's answer. `additive` says whether the severity is damage the
   * baseline has not already counted — almost always false, because Combat has
   * usually counted it, and the places it is true are named where they are set. */
  function threatReport(type, confidence, severity, timing, evidence, opts) {
    const o = opts || {};
    const value = Math.max(0, Math.round(severity || 0));
    return {
      type,
      confidence,
      value: CONFIDENCE_VALUE[confidence] || 0,
      rank: CONFIDENCE_RANK[confidence] || 0,
      severity: value,
      /* Ticks until it lands. 0 means it is landing now. */
      timing: timing === undefined || timing === null ? Infinity : timing,
      evidence: evidence || [],
      additive: !!o.additive,
      /* What the additive path may add, when that is smaller than the severity
       * the report ranks on. A detector reports the whole threat so it sorts
       * against the others, but may only contribute the slice the baseline has
       * not already counted — anything more would double it. */
      addAmount: o.addAmount === undefined ? value : Math.max(0, Math.round(o.addAmount)),
      /* Whether `severity` is one event's damage or a rate per second. The
       * sustained detectors are the rates, and the difference matters: 95
       * damage a second is ordinary pressure, 95 damage in one hit is a death. */
      rate: !!o.rate,
      /* The defensive answer this threat calls for, if any, and whether it can
       * be stepped out of. Both are advisory: the gear manager and the evasion
       * planner arbitrate between every report before either one acts. */
      gear: o.gear === undefined ? GEAR.NONE : o.gear,
      evadable: !!o.evadable,
      /* What answering it is expected to cost, in frames. */
      packets: o.packets === undefined ? 0 : o.packets,
      /* Which enemy, when the report is about one. */
      source: o.source === undefined ? null : o.source
    };
  }

  /* ---- sequence memory ---------------------------------------------- *
   *
   * Half the requested Antis are defined by a *transition* — bull then turret
   * gear, turret gear then bull, hammer then polearm, bow then crossbow then
   * musket — and a transition is not visible in a single frame of state. This
   * keeps the last switch of each kind per enemy, with the tick it happened
   * on, and nothing else: two small records per tracked enemy, dropped when
   * the enemy goes away.
   *
   * It is a memory, not a predictor. It answers "did this change, and how long
   * ago"; every detector decides for itself what that is worth.
   * ------------------------------------------------------------------- */
  class SequenceTracker {
    constructor() { this.reset(); }

    reset() { this.tracks = new Map(); }

    observe(snap, enemies) {
      const live = new Set();
      for (const e of enemies) {
        live.add(e.id);
        let t = this.tracks.get(e.id);
        if (!t) {
          t = {
            hat: e.hatId, hatFrom: null, hatTick: -999,
            weapon: e.weaponCurrent, weaponFrom: null, weaponTick: -999,
            /* the last three weapons held, for the bow -> crossbow -> musket
             * chain the client itself uses in canPossiblyInstakill */
            weaponChain: [e.weaponCurrent],
            firstSeen: snap.tick
          };
          this.tracks.set(e.id, t);
          continue;
        }
        if (e.hatId !== t.hat) {
          t.hatFrom = t.hat;
          t.hat = e.hatId;
          t.hatTick = snap.tick;
        }
        if (e.weaponCurrent !== t.weapon) {
          t.weaponFrom = t.weapon;
          t.weapon = e.weaponCurrent;
          t.weaponTick = snap.tick;
          t.weaponChain.push(e.weaponCurrent);
          if (t.weaponChain.length > 3) t.weaponChain.shift();
        }
      }
      for (const id of this.tracks.keys()) if (!live.has(id)) this.tracks.delete(id);
    }

    get(id) { return this.tracks.get(id) || null; }

    /* Did this enemy go from hat `from` to hat `to`, recently enough that the
     * switch is still part of a sequence rather than just what they wear? */
    hatChain(snap, id, from, to) {
      const t = this.tracks.get(id);
      if (!t || t.hat !== to || t.hatFrom !== from) return null;
      const age = snap.tick - t.hatTick;
      return age <= AH.SEQUENCE_WINDOW_TICKS ? { age, from, to } : null;
    }

    weaponChain(snap, id, from, to) {
      const t = this.tracks.get(id);
      if (!t || t.weapon !== to || t.weaponFrom !== from) return null;
      const age = snap.tick - t.weaponTick;
      return age <= AH.SEQUENCE_WINDOW_TICKS ? { age, from, to } : null;
    }

    /* Held `weapon` at any point in the last three switches. */
    heldRecently(snap, id, weapon) {
      const t = this.tracks.get(id);
      if (!t) return false;
      if (t.weapon === weapon) return true;
      return t.weaponChain.indexOf(weapon) !== -1 &&
        snap.tick - t.weaponTick <= AH.SEQUENCE_WINDOW_TICKS;
    }
  }

  /* ---- 1. Anti Insta Kill — bull hat then turret gear (requirement 7) *
   *
   * The sequence, as the game makes it: the attacker wears Bull for the
   * multiplier on the melee (hats[7].dmgMultO 1.5, and RYN's own
   * getMaxWeaponDamage already prices every melee as if they do), swings, and
   * switches to Turret Gear so the turret shot (projectiles[1].dmg 25) lands
   * on top of the swing rather than after it.
   *
   * What is detected is that transition, on someone who can actually reach us
   * — not the fact that somebody owns a bull helmet. Three independent pieces
   * of evidence, and the confidence is what they add up to:
   *
   *   - the hat chain 7 -> 53 inside the sequence window;
   *   - the client's own verdicts, which are computed from real reload and
   *     range state: `danger` 3 means "kills through soldier", and
   *     `toolHammerInsta` is the hammer/bull opener;
   *   - reach: reloaded, inside their own weapon range, pointed at us.
   * ------------------------------------------------------------------- */
  class AntiInstaKillDetector {
    constructor() { this.id = THREAT.INSTAKILL; }

    detect(ctx) {
      let best = null;
      for (const e of ctx.enemies) {
        const evidence = [];
        let staged = false;

        const chain = ctx.sequence.hatChain(ctx.snap, e.id, AH.HAT_BULL, AH.HAT_TURRET_GEAR);
        if (chain) { evidence.push("hat:bull->turret-gear@" + chain.age); staged = true; }
        /* Wearing bull with the swing still to come is the first half of the
         * same sequence; it is evidence, but on its own it is only a hat. */
        const bullNow = e.hatId === AH.HAT_BULL;
        if (bullNow) evidence.push("hat:bull");
        if (e.toolHammerInsta) { evidence.push("client:tool-hammer-insta"); staged = true; }
        if (e.danger >= 3) { evidence.push("client:danger-3"); staged = true; }
        else if (e.danger === 2) evidence.push("client:danger-2");

        /* Reach, measured: the ranges are the enemy's own getWeaponRange, so a
         * dagger has to be at 65 and a polearm may be at 142. */
        const reach = Math.max(e.primaryRange, e.secondaryRange);
        const armed = e.primaryReloaded || e.secondaryReloaded;
        const inReach = reach > 0 && e.distance <= reach;
        const closing = e.closing > 0;
        if (inReach) evidence.push("in-reach:" + Math.round(e.distance) + "/" + Math.round(reach));
        if (armed) evidence.push("loaded");
        if (e.facing) evidence.push("facing");
        if (closing) evidence.push("closing");

        /* Requirement 31: possession is not detection. Without a staged
         * sequence *and* a way to use it, there is nothing here. */
        if (!staged || !(inReach || closing)) continue;
        if (!armed && !chain) continue;

        const turretReady = e.turretReloaded &&
          (e.hatId === AH.HAT_TURRET_GEAR || e.canUseTurret) && e.distance <= AH.TURRET_RANGE;
        if (turretReady) evidence.push("turret-ready");

        const combined = Math.max(e.primaryDamage, 0) + Math.max(e.secondaryDamage, 0) +
          (turretReady ? AH.TURRET_DAMAGE : 0);
        /* Lethality is measured against the damage as it arrives, not as it
         * arrives through the hat we are already wearing: ThreatPriority applies
         * the mitigation once, and applying it here as well would both count it
         * twice and make the threat vanish the moment the gear answering it went
         * on — which is a hat that flaps once a second. */
        const lethal = combined >= ctx.health;

        let confidence;
        if (chain && inReach && armed && lethal) confidence = CONFIDENCE.CRITICAL;
        else if ((chain || e.danger >= 3) && inReach && armed) confidence = CONFIDENCE.HIGH;
        else if (staged && inReach) confidence = CONFIDENCE.MEDIUM;
        else if (staged && closing) confidence = CONFIDENCE.LOW;
        else continue;

        /* Timing: in reach and loaded, the swing is this tick. Closing, it is
         * the tick they arrive, which the motion model owns — here the honest
         * answer is one tick, because a moomoo player crosses the last body
         * length inside one. */
        const timing = inReach && armed ? 0 : 1;
        const report = threatReport(this.id, confidence, combined, timing, evidence, {
          gear: GEAR.SOLDIER,
          source: e.id,
          packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
        });
        if (!best || report.rank > best.rank ||
            (report.rank === best.rank && report.severity > best.severity)) best = report;
      }
      return best;
    }
  }

  /* ---- 2. Anti Reverse Insta Kill — turret gear then bull (req. 8) --- *
   *
   * A different attack with a different clock, which is why it is not the
   * detector above with a flag.
   *
   * Forward: the melee lands first and the turret is switched in behind it, so
   * the dangerous tick is the one the turret shot arrives on — a tick out.
   *
   * Reverse: the shot is *held* at empty reload while the attacker closes, and
   * the bull swing is timed to land on the same tick the turret fires. The
   * client already recognises exactly that shape from real reload state —
   * `reverseInsta` is set when primary, secondary and turret all reach us and
   * secondary and turret are both at empty reload with the primary loaded
   * (Player.canPossiblyInstakill, v5.4:3935) — so there is nothing to invent.
   * The dangerous tick is *now*: everything is already loaded and the only
   * thing left is the swing.
   * ------------------------------------------------------------------- */
  class AntiReverseInstaDetector {
    constructor() { this.id = THREAT.INSTA_REV; }

    detect(ctx) {
      let best = null;
      for (const e of ctx.enemies) {
        const evidence = [];
        let staged = false;

        if (e.reverseInsta) { evidence.push("client:reverse-insta"); staged = true; }
        const chain = ctx.sequence.hatChain(ctx.snap, e.id, AH.HAT_TURRET_GEAR, AH.HAT_BULL);
        if (chain) { evidence.push("hat:turret-gear->bull@" + chain.age); staged = true; }
        /* The reload shape on its own, without the client's range test having
         * passed: both secondaries held empty behind a loaded primary is a
         * player waiting to release two things at once. */
        const held = e.secondaryEmpty && e.turretEmpty && e.primaryReloaded;
        if (held) { evidence.push("held:secondary+turret"); staged = true; }
        if (!staged) continue;

        const reach = Math.max(e.primaryRange, e.secondaryRange);
        const inReach = reach > 0 && e.distance <= reach;
        if (inReach) evidence.push("in-reach:" + Math.round(e.distance));
        if (e.facing) evidence.push("facing");
        if (e.closing > 0) evidence.push("closing");

        const turretInRange = e.distance <= AH.TURRET_RANGE;
        const combined = Math.max(e.primaryDamage, 0) + Math.max(e.secondaryDamage, 0) +
          (turretInRange ? AH.TURRET_DAMAGE : 0);
        const lethal = combined >= ctx.health;

        let confidence;
        if (e.reverseInsta && lethal) confidence = CONFIDENCE.CRITICAL;
        else if (e.reverseInsta) confidence = CONFIDENCE.HIGH;
        else if (chain && inReach) confidence = CONFIDENCE.HIGH;
        else if (held && inReach && lethal) confidence = CONFIDENCE.HIGH;
        else if (held && inReach) confidence = CONFIDENCE.MEDIUM;
        else if (chain || held) confidence = CONFIDENCE.LOW;
        else continue;

        /* Everything is already loaded: the release is this tick if they can
         * reach, the next one if they are still closing. */
        const report = threatReport(this.id, confidence, combined, inReach ? 0 : 1, evidence, {
          gear: GEAR.SOLDIER,
          source: e.id,
          packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
        });
        if (!best || report.rank > best.rank ||
            (report.rank === best.rank && report.severity > best.severity)) best = report;
      }
      return best;
    }
  }

  /* ---- 3. Anti One Tick (requirement 14) ---------------------------- *
   *
   * One weapon, one swing, the whole bar. It exists because of the numbers in
   * the tables rather than any combo: polearm 45 damage at 142 range, katana
   * 40 at 118, and RYN's getMaxWeaponDamage already carries the bull
   * multiplier (1.5) and the weapon variant into those, so a diamond polearm
   * under bull is priced at what it actually hits for.
   *
   * The range is the enemy's own `getWeaponRange`, never a constant of ours,
   * and the window it opens is widened by exactly one thing: how far they can
   * travel in the tick it takes us to react (measured speed, ping-aware).
   * ------------------------------------------------------------------- */
  class AntiOneTickDetector {
    constructor() { this.id = THREAT.ONE_TICK; }

    detect(ctx) {
      let best = null;
      for (const e of ctx.enemies) {
        const weapon = e.weaponCurrent;
        if (weapon === null) continue;
        /* Held, not owned. The weapon in their hands is the one that can swing
         * on this tick; anything else is a switch away and belongs to the
         * sequence detectors. */
        if (AH.ONETICK_WEAPONS.indexOf(weapon) === -1) continue;
        if (!e.primaryReloaded && weapon === e.weaponPrimary) continue;

        const range = weapon === e.weaponPrimary ? e.primaryRange : e.secondaryRange;
        if (range <= 0) continue;
        /* The reaction window: their travel over the ticks it takes a frame of
         * ours to reach the server. Nothing is padded — `speed` is last tick's
         * measured travel. */
        const lead = ctx.ping.reactionTicks * (e.speed || 0);
        const inReach = e.distance <= range;
        const arriving = e.distance <= range + lead && e.closing > 0;
        if (!inReach && !arriving) continue;

        const damage = weapon === e.weaponPrimary ? e.primaryDamage : e.secondaryDamage;
        if (damage <= 0) continue;
        /* A one-tick is a one-tick because it can take the bar. Anything less
         * is an ordinary swing, and Combat has already counted it. */
        const share = ctx.health > 0 ? damage / ctx.health : 0;
        if (share < 0.6) continue;

        const evidence = [
          "weapon:" + weapon,
          "range:" + Math.round(e.distance) + "/" + Math.round(range),
          "dmg:" + Math.round(damage)
        ];
        if (e.hatId === AH.HAT_BULL) evidence.push("bull");
        if (e.facing) evidence.push("facing");
        if (arriving && !inReach) evidence.push("arriving:+" + Math.round(lead));

        let confidence;
        if (share >= 1 && inReach && e.facing) confidence = CONFIDENCE.CRITICAL;
        else if (share >= 1 && inReach) confidence = CONFIDENCE.HIGH;
        else if (inReach && e.facing) confidence = CONFIDENCE.HIGH;
        else if (inReach) confidence = CONFIDENCE.MEDIUM;
        else confidence = CONFIDENCE.LOW;

        const report = threatReport(this.id, confidence, damage, inReach ? 0 : 1, evidence, {
          gear: GEAR.SOLDIER,
          source: e.id,
          packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
        });
        if (!best || report.rank > best.rank ||
            (report.rank === best.rank && report.severity > best.severity)) best = report;
      }
      return best;
    }
  }

  /* ---- 4. Anti Velocity Tick (requirement 6) ------------------------- *
   *
   * The combo aimed at us rather than one of ours: a turret shot knocks the
   * target into a band where a long weapon covers the gap while they are still
   * travelling. The band is read from RYN's own VelocityTick module (minKB /
   * maxKB), so a retune there moves this detector with it, and both readings
   * are a tick stale so the window opens by my measured drift plus theirs.
   *
   * The client's VelocityTick is never touched — only read.
   * ------------------------------------------------------------------- */
  class AntiVelocityTickDetector {
    constructor() { this.id = THREAT.VELOCITY_TICK; }

    detect(ctx) {
      const turretInAir = ctx.projectiles.some(p => p.isTurret);
      if (!ctx.turret.present && !turretInAir) return null;

      let best = null;
      for (const e of ctx.enemies) {
        /* The reach half of the combo, held: a polearm, or the turret gear
         * that supplies the knockback itself. */
        const polearm = e.weaponCurrent === AH.WEAPON_POLEARM;
        const turretGear = e.hatId === AH.HAT_TURRET_GEAR;
        if (!polearm && !turretGear) continue;

        const band = (ctx.snap.systems && ctx.snap.systems.velocityBand) ||
          { min: AH.VELOCITY_KB_MIN, max: AH.VELOCITY_KB_MAX, drift: 35 };
        const slack = band.drift + e.speed;
        const inBand = e.distance >= band.min - slack && e.distance <= band.max + slack;
        if (!inBand) continue;

        const evidence = ["band:" + Math.round(e.distance) +
          " in " + Math.round(band.min) + "-" + Math.round(band.max)];
        if (polearm) evidence.push("polearm");
        if (turretGear) evidence.push("turret-gear");
        if (e.hatId === AH.HAT_BULL) evidence.push("bull");
        if (turretInAir) evidence.push("turret-shot-in-air");
        if (ctx.turret.present) evidence.push("turret-in-range:" + ctx.turret.count);
        if (e.primaryReloaded) evidence.push("primary-loaded");
        if (e.closing > 0) evidence.push("closing");
        if (e.facing) evidence.push("facing");

        const armed = e.primaryReloaded && e.facing;
        const turretReady = turretInAir || e.turretReloaded || ctx.turret.readyNow > 0;
        let confidence;
        if (armed && turretInAir) confidence = CONFIDENCE.HIGH;
        else if (armed && turretReady && e.closing > 0) confidence = CONFIDENCE.HIGH;
        else if (armed && turretReady) confidence = CONFIDENCE.MEDIUM;
        else if (armed || turretReady) confidence = CONFIDENCE.LOW;
        else continue;

        const severity = Math.max(e.primaryDamage, 0) + AH.TURRET_DAMAGE;
        /* A shot already in the air has a measured arrival; otherwise the
         * knockback is a tick away at best. */
        const inAir = ctx.projectiles.find(p => p.isTurret);
        const timing = inAir ? inAir.ticksToImpact : 1;
        const report = threatReport(this.id, confidence, severity, timing, evidence, {
          /* The turret half is what makes it a velocity tick, so denying the
           * turret is the answer that removes the combo rather than surviving
           * it — but only when the turret is the bigger half. */
          gear: AH.TURRET_DAMAGE >= e.primaryDamage ? GEAR.EMP : GEAR.SOLDIER,
          evadable: !!inAir,
          source: e.id,
          packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS
        });
        if (!best || report.rank > best.rank) best = report;
      }
      return best;
    }
  }

  /* ---- 5. Anti Velocity Tick + Hammer + Spike (requirement 18) ------- *
   *
   * The full three-stage version: the primary opens, the great hammer follows
   * (weapons[10], the structure weapon, switched in for the swing), and a
   * spike is placed into the space the knockback puts us in. What makes it one
   * threat rather than three is the switch: the hammer only appears in a
   * player's hands for a moment, and it appearing *between* a primary and a
   * placement is the signature.
   *
   * The spike half is the client's own placement scan — `canPlaceSpike` and
   * `spikeDamage` come from Player.detectSpikeInsta, which actually asks
   * ObjectManager whether a spike placed from where they stand would touch us.
   * ------------------------------------------------------------------- */
  class AntiVelocityComboDetector {
    constructor() { this.id = THREAT.VELOCITY_COMBO; }

    detect(ctx) {
      let best = null;
      for (const e of ctx.enemies) {
        const hammerNow = e.weaponCurrent === AH.WEAPON_GREAT_HAMMER;
        const hammerRecent = ctx.sequence.heldRecently(ctx.snap, e.id, AH.WEAPON_GREAT_HAMMER);
        if (!hammerNow && !hammerRecent) continue;

        const reach = Math.max(e.primaryRange, e.secondaryRange);
        const inReach = reach > 0 && e.distance <= reach + (e.speed || 0);
        if (!inReach) continue;

        const evidence = [hammerNow ? "hammer-held" : "hammer-recent"];
        const chain = ctx.sequence.weaponChain(ctx.snap, e.id, AH.WEAPON_GREAT_HAMMER, e.weaponCurrent);
        if (chain) evidence.push("switch:hammer->" + chain.to + "@" + chain.age);
        if (e.canPlaceSpike) evidence.push("spike-placeable:" + Math.round(e.spikeDamage));
        if (ctx.spike.willCollide) evidence.push("will-collide");
        if (e.turretReloaded && e.distance <= AH.TURRET_RANGE) evidence.push("turret-ready");
        if (e.closing > 0) evidence.push("closing");

        /* Primary + hammer + the spike the client says they can land. The
         * hammer's own player damage is small (weapons[10].dmg 10) — it is in
         * the combo for the knockback, and the spike is what the knockback is
         * worth. */
        const spike = e.canPlaceSpike ? e.spikeDamage : 0;
        const hammer = ctx.weaponDamage(AH.WEAPON_GREAT_HAMMER);
        const severity = Math.max(e.primaryDamage, 0) + hammer + spike;

        let confidence;
        if (hammerNow && e.canPlaceSpike && e.primaryReloaded) confidence = CONFIDENCE.HIGH;
        else if (e.canPlaceSpike && (hammerNow || chain)) confidence = CONFIDENCE.MEDIUM;
        else if (hammerNow && e.primaryReloaded) confidence = CONFIDENCE.MEDIUM;
        else confidence = CONFIDENCE.LOW;

        const report = threatReport(this.id, confidence, severity, e.canPlaceSpike ? 1 : 2,
          evidence, {
            gear: GEAR.SOLDIER,
            source: e.id,
            packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
          });
        if (!best || report.rank > best.rank) best = report;
      }
      return best;
    }
  }

  /* ---- 6/7. Anti Musket and Anti Bow (requirements 9, 16) ----------- *
   *
   * Ranged threats, and the clearest case of the possession rule. A musket in
   * someone's hands is not a threat; a bullet in the air on a line to me is,
   * and the client has already done that line test — dangerProjectiles only
   * contains what passed it (ProjectileManager.foundProjectile). Everything
   * the requirement asks for about a projectile is then arithmetic on state
   * the client already carries: origin and direction (pos, angle), velocity
   * (speed), lifetime (life), range, my position and my hit radius (scale +
   * the projectile's own), and the impact time the adapter computes from them.
   *
   * A held ranged weapon still counts, but the bar is deliberately high,
   * because this is exactly where a threat engine starts crying wolf: a musket
   * reaches 1400, which is most of the screen, so "loaded and pointed roughly
   * at me" describes half the players on the map at any moment. It has to be
   * loaded, pointed at me, and either inside half its own reach or freshly
   * switched to — the client's own wind-up signature. Never above MEDIUM:
   * nothing has been fired.
   * ------------------------------------------------------------------- */
  class RangedDetector {
    constructor(id, projectileTypes, weaponIds, gear) {
      this.id = id;
      this.projectileTypes = projectileTypes;
      this.weaponIds = weaponIds;
      this.gear = gear;
    }

    detect(ctx) {
      /* In the air, aimed at me: the strongest evidence there is. */
      let inFlight = null;
      for (const p of ctx.projectiles) {
        if (this.projectileTypes.indexOf(p.type) === -1) continue;
        /* Out of range before it arrives is not a threat: projectiles carry a
         * `range` and a `life`, and the client removes them on either. */
        if (p.life <= 0) continue;
        if (!inFlight || p.ticksToImpact < inFlight.ticksToImpact) inFlight = p;
      }
      if (inFlight) {
        const lethal = inFlight.damage >= ctx.health;
        const soon = inFlight.ticksToImpact <= 2;
        const confidence = lethal && soon ? CONFIDENCE.CRITICAL
          : soon ? CONFIDENCE.HIGH
          : CONFIDENCE.MEDIUM;
        return threatReport(this.id, confidence, inFlight.damage, inFlight.ticksToImpact, [
          "in-flight",
          "impact:" + inFlight.ticksToImpact + "t",
          "offset:" + Math.round(inFlight.perpendicular) + "/" + Math.round(inFlight.hitRadius)
        ], {
          gear: this.gear,
          /* Only a shot we are actually on the line of can be stepped out of;
           * the planner checks the geometry again before it moves. */
          evadable: inFlight.perpendicular <= inFlight.hitRadius,
          packets: AH.PACKETS_PRESS
        });
      }

      /* Nothing in the air: the wind-up, at a much lower ceiling. */
      let best = null;
      for (const e of ctx.enemies) {
        if (this.weaponIds.indexOf(e.weaponCurrent) === -1) continue;
        const ready = e.weaponCurrent === e.weaponPrimary ? e.primaryReloaded : e.secondaryReloaded;
        if (!ready || !e.facing) continue;

        const reach = ctx.weaponReach(e.weaponCurrent);
        const justSwitched = e.weaponPrevious !== null && e.weaponPrevious !== e.weaponCurrent;
        const close = reach > 0 && e.distance <= reach * 0.5;
        if (!close && !justSwitched) continue;

        const evidence = ["holding:" + e.weaponCurrent, "loaded", "facing"];
        if (justSwitched) evidence.push("just-switched");
        if (close) evidence.push("inside-half-reach:" + Math.round(e.distance));
        if (e.closing > 0) evidence.push("closing");

        const confidence = close && justSwitched ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;
        const report = threatReport(this.id, confidence,
          ctx.projectileDamageFor(e.weaponCurrent), 1, evidence, {
            gear: this.gear, source: e.id, packets: AH.PACKETS_PRESS
          });
        if (!best || report.rank > best.rank) best = report;
      }
      return best;
    }
  }

  /* ---- 8. Anti Spam Bow (requirement 16) ---------------------------- *
   *
   * Continuous fire, treated as one stream rather than a series of unrelated
   * arrows. What makes it a stream is a cadence: arrivals from the same owner
   * at a repeatable interval. With one, the next arrival is a prediction
   * rather than a surprise, which is the whole point — the engine pre-empts
   * the next arrow instead of reacting to each one, and it does not spend a
   * press on a shot whose geometry says it misses.
   * ------------------------------------------------------------------- */
  class AntiSpamBowDetector {
    constructor() {
      this.id = THREAT.SPAM_BOW;
      this.reset();
    }

    reset() { this.seen = new Map(); this.arrivals = []; }

    detect(ctx) {
      const tick = ctx.snap.tick;
      /* One record per projectile id, so an arrow in the air for four ticks is
       * one event and not four. */
      for (const p of ctx.projectiles) {
        if (AH.PROJ_ARROWS.indexOf(p.type) === -1) continue;
        const key = p.ref && p.ref.id !== undefined ? p.ref.id : null;
        if (key === null) continue;
        if (this.seen.has(key)) continue;
        this.seen.set(key, tick);
        this.arrivals.push({ tick, owner: p.ownerId, damage: p.damage });
      }
      while (this.arrivals.length && tick - this.arrivals[0].tick > AH.PRESSURE_WINDOW_TICKS * 2) {
        this.arrivals.shift();
      }
      for (const [key, at] of this.seen) {
        if (tick - at > AH.PRESSURE_WINDOW_TICKS * 2) this.seen.delete(key);
      }
      if (this.arrivals.length < 2) return null;

      /* The cadence, and the next one. A repeater crossbow (weapons[13],
       * speed 230) fires about every two ticks; a hunting bow every five. The
       * measured interval is what is used, not either of those numbers. */
      let gaps = 0, sum = 0;
      for (let i = 1; i < this.arrivals.length; i++) {
        sum += this.arrivals[i].tick - this.arrivals[i - 1].tick;
        gaps += 1;
      }
      const mean = gaps ? sum / gaps : Infinity;
      const since = tick - this.arrivals[this.arrivals.length - 1].tick;
      const nextIn = mean === Infinity ? Infinity : Math.max(0, Math.round(mean - since));

      const perShot = this.arrivals[this.arrivals.length - 1].damage;
      const count = this.arrivals.length;
      const evidence = ["shots:" + count, "interval:" + Math.round(mean)];
      const live = ctx.projectiles.find(p => AH.PROJ_ARROWS.indexOf(p.type) !== -1);
      if (live) evidence.push("in-air:" + live.ticksToImpact + "t");

      const confidence = count >= 4 ? CONFIDENCE.HIGH
        : count >= 3 ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      /* Two shots' worth is what the next exchange costs, which is the number
       * the heal engine has to be able to absorb. */
      return threatReport(this.id, confidence, perShot * Math.min(2, count),
        live ? live.ticksToImpact : nextIn, evidence, {
          evadable: !!live && live.perpendicular <= live.hitRadius,
          packets: AH.PACKETS_PRESS
        });
    }
  }

  /* ---- 9. Anti Primary + Musket / Bow (requirement 19) --------------- *
   *
   * The mixed instakill: a melee weapon in reach and a shot timed to land with
   * it. Neither half is lethal alone, which is exactly why it works and why
   * detecting the halves separately is not enough — the two reports would both
   * be MEDIUM and neither would ask for anything.
   *
   * So this one composes: it looks for an enemy who can reach us with a melee
   * weapon *and* has either a shot in the air or a loaded ranged weapon
   * pointed at us, and asks whether the two together clear the bar inside one
   * exchange. The timing is the overlap — the later of the two, because that
   * is when the pair completes.
   * ------------------------------------------------------------------- */
  class AntiMixedInstaDetector {
    constructor() { this.id = THREAT.MIXED_INSTA; }

    detect(ctx) {
      let best = null;
      for (const e of ctx.enemies) {
        /* The melee half, held and usable. */
        const meleeId = e.weaponCurrent === e.weaponPrimary ? e.weaponPrimary : e.weaponCurrent;
        const meleeRange = e.primaryRange;
        const meleeDamage = e.primaryDamage;
        const meleeReady = e.primaryReloaded;
        if (meleeRange <= 0 || meleeDamage <= 0) continue;
        const meleeLead = ctx.ping.reactionTicks * (e.speed || 0);
        const meleeInReach = e.distance <= meleeRange + meleeLead;
        if (!meleeInReach || !meleeReady) continue;
        /* Requirement 19 names the two that matter — short sword and polearm —
         * and the katana is the same shape one age later. */
        if (AH.ONETICK_WEAPONS.indexOf(meleeId) === -1 &&
            AH.ONETICK_WEAPONS.indexOf(e.weaponPrimary) === -1) continue;

        /* The ranged half. In the air from this owner, or loaded and aimed. */
        let shot = null;
        for (const p of ctx.projectiles) {
          if (p.isTurret) continue;
          if (p.ownerId !== null && p.ownerId !== e.id) continue;
          if (!shot || p.ticksToImpact < shot.ticksToImpact) shot = p;
        }
        let rangedDamage = 0, rangedTiming = Infinity, rangedEvidence = null;
        if (shot) {
          rangedDamage = shot.damage;
          rangedTiming = shot.ticksToImpact;
          rangedEvidence = "shot-in-air:" + shot.ticksToImpact + "t";
        } else {
          const sec = e.weaponSecondary;
          const shootable = sec !== null &&
            (sec === AH.WEAPON_MUSKET || AH.PROJ_ARROWS.length &&
              [AH.WEAPON_BOW, AH.WEAPON_CROSSBOW, AH.WEAPON_REPEATER].indexOf(sec) !== -1);
          if (shootable && e.secondaryReloaded && e.facing) {
            rangedDamage = ctx.projectileDamageFor(sec);
            rangedTiming = 1;
            rangedEvidence = "ranged-loaded:" + sec;
          }
        }
        if (rangedDamage <= 0) continue;

        const combined = meleeDamage + rangedDamage;
        /* Neither half alone clears the bar, or this is simply a one-tick and
         * that detector owns it. */
        if (combined < ctx.health) continue;

        const evidence = [
          "melee:" + Math.round(meleeDamage) + "@" + Math.round(e.distance),
          rangedEvidence,
          "combined:" + Math.round(combined)
        ];
        if (e.facing) evidence.push("facing");

        const confidence = shot && e.distance <= meleeRange ? CONFIDENCE.CRITICAL
          : shot ? CONFIDENCE.HIGH
          : e.distance <= meleeRange ? CONFIDENCE.MEDIUM
          : CONFIDENCE.LOW;
        /* The pair completes when the later half lands. */
        const timing = Math.min(AH.PREDICT_HORIZON_TICKS,
          Math.max(e.distance <= meleeRange ? 0 : 1, rangedTiming === Infinity ? 1 : rangedTiming));
        const report = threatReport(this.id, confidence, combined, timing, evidence, {
          gear: GEAR.SOLDIER,
          evadable: !!(shot && shot.perpendicular <= shot.hitRadius),
          source: e.id,
          packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
        });
        if (!best || report.rank > best.rank) best = report;
      }
      return best;
    }
  }

  /* ---- 10. Anti Spam Daggers (requirement 15) ------------------------ *
   *
   * Daggers swing every 100ms (weapons[7].speed) — under one server tick — for
   * 20 a hit, and RYN prices them at the bull multiplier, so the threat is the
   * frequency rather than any single number. Evidence is the frequency itself:
   * repeated damage at close range from someone holding one. The bull hat is
   * part of the requirement and part of the price, but it is never the trigger.
   * ------------------------------------------------------------------- */
  class AntiSpamDaggerDetector {
    constructor() {
      this.id = THREAT.SPAM_DAGGER;
      this.hits = [];
    }

    reset() { this.hits.length = 0; }

    detect(ctx) {
      const tick = ctx.snap.tick;

      /* Who, if anyone, is holding a dagger inside its own reach right now. */
      let holder = null;
      for (const e of ctx.enemies) {
        if (e.weaponCurrent !== AH.WEAPON_DAGGER) continue;
        const reach = e.primaryRange || 0;
        if (reach > 0 && e.distance <= reach + (e.speed || 0)) { holder = e; break; }
      }

      /* Damage landing while one is in reach is what makes it dagger pressure
       * rather than someone standing nearby with a dagger. */
      if (ctx.damage.burst > 0 && holder && !ctx.spike.colliding) this.hits.push(tick);
      while (this.hits.length && tick - this.hits[0] > AH.PRESSURE_WINDOW_TICKS) this.hits.shift();

      if (!holder) return null;
      const count = this.hits.length;
      if (!count) {
        return holder.primaryReloaded && holder.facing
          ? threatReport(this.id, CONFIDENCE.LOW, holder.primaryDamage, 1,
            ["dagger-in-reach", "loaded"], { source: holder.id, packets: AH.PACKETS_PRESS })
          : null;
      }

      const evidence = ["hits:" + count, "distance:" + Math.round(holder.distance)];
      if (holder.hatId === AH.HAT_BULL) evidence.push("bull");
      if (holder.closing > 0) evidence.push("closing");
      /* The next one is due on the cadence the damage analyzer measured; a
       * dagger's is under a tick, so it is effectively "now". */
      const nextIn = ctx.damage.expectedNextHitTicks === Infinity
        ? 1 : Math.min(1, ctx.damage.expectedNextHitTicks);
      if (ctx.damage.expectedNextHitTicks !== Infinity) {
        evidence.push("next:" + ctx.damage.expectedNextHitTicks + "t");
      }

      const perHit = holder.primaryDamage || 20;
      const confidence = count >= 4 ? CONFIDENCE.CRITICAL
        : count >= 3 ? CONFIDENCE.HIGH
        : count >= 2 ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      return threatReport(this.id, confidence, perHit * Math.min(2, count), nextIn, evidence, {
        gear: count >= 3 ? GEAR.SOLDIER : GEAR.NONE,
        source: holder.id,
        packets: AH.PACKETS_PRESS * 2
      });
    }
  }

  /* ---- 11. Anti Spam Shame (requirement 17) -------------------------- *
   *
   * Any weapon, used as a shame pump rather than as damage: hit, hit, hit, at
   * a rate that forces a press inside the 120ms window every time, until the
   * count reaches 8 and food stops working for thirty seconds.
   *
   * Detecting it is not about the damage — the numbers are usually small on
   * purpose. It is about the shape: damage events arriving at a regular
   * interval short enough that every heal would be charged, and a shame count
   * that has actually been rising. What the report is *for* is the policy it
   * turns on: the arbiter reads it and the heal engine stops pressing into the
   * window at all, batching instead and taking every credit the gaps allow.
   * ------------------------------------------------------------------- */
  class AntiSpamShameDetector {
    constructor() { this.id = THREAT.SPAM_SHAME; }

    detect(ctx) {
      const damage = ctx.damage;
      const shame = ctx.shameTracker;
      if (!shame) return null;
      /* Two events in the window is a fight; a cadence is a pump. */
      if (damage.hits.length < 3) return null;

      /* Every hit lands inside the shadow of the last one: the window never
       * opens on its own, so every press we are forced into is a charge. */
      const interval = damage.meanInterval;
      const chargesEveryHit = interval !== Infinity && interval <= 2;
      const rising = shame.increaseRate > shame.decreaseRate && shame.current > 0;
      if (!chargesEveryHit && !rising) return null;

      const evidence = [
        "events:" + damage.hits.length,
        "interval:" + (interval === Infinity ? "?" : Math.round(interval)),
        "shame:" + shame.current,
        "up/s:" + shame.increaseRate.toFixed(2)
      ];
      if (damage.expectedNextHitTicks !== Infinity) {
        evidence.push("next:" + damage.expectedNextHitTicks + "t");
      }

      const confidence = rising && chargesEveryHit ? CONFIDENCE.HIGH
        : rising ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      /* Reported as a rate: this is pressure, not a burst, and ranking it
       * against one-hit numbers without the flag would make every busy fight
       * look like a death. */
      const perSecond = damage.rate;
      return threatReport(this.id, confidence, perSecond,
        damage.expectedNextHitTicks === Infinity ? 1 : damage.expectedNextHitTicks,
        evidence, { rate: true, packets: AH.PACKETS_PRESS });
    }
  }

  /* ---- 12. Anti Spike Tick (requirement 13) -------------------------- *
   *
   * Two things under one name, because they are two halves of one attack.
   *
   * The half that has started: repeated spike damage, tracked as one sequence.
   * The evidence for "that was a spike" is not the size of the number —
   * soldier and variants move it around — but the collision state at the
   * moment it landed, which EnemyManager computes in its own pass.
   *
   * The half that has not: pinned in an enemy trap, with the trap being broken
   * and a spike ready for the moment it opens. That is the sequence the
   * requirement is really about — trap break, exposure, spike — and the point
   * of detecting it is that the defence has to be *already up* when the trap
   * goes, not requested after the first spike hit. The trap's own health is
   * what gives the timing: it is falling at a measurable rate, and the tick it
   * reaches zero is the tick we are exposed.
   * ------------------------------------------------------------------- */
  class AntiSpikeTickDetector {
    constructor() {
      this.id = THREAT.SPIKE_TICK;
      this.reset();
    }

    reset() {
      this.resetSequence();
      this.trapHealth = null;
      this.trapDrop = 0;
      this.trapRef = null;
    }

    /* The contact sequence only. The trap sampler is separate state about a
     * different half of the same attack, and dropping it when a spike sequence
     * ends would throw away the break-rate measurement that gives the *next*
     * exposure its timing. */
    resetSequence() {
      this.hits = [];
      this.startTick = null;
      this.lastTick = -999;
      this.intervals = [];
      this.totalDamage = 0;
    }

    detect(ctx) {
      const tick = ctx.snap.tick;

      const tookDamage = ctx.damage.burst > 0;
      const onSpike = ctx.spike.colliding || ctx.spike.pushing;
      if (tookDamage && onSpike) {
        if (this.startTick === null || tick - this.lastTick > AH.SPIKE_SEQUENCE_GAP_TICKS) {
          this.startTick = tick;
          this.hits.length = 0;
          this.intervals.length = 0;
          this.totalDamage = 0;
        } else if (this.lastTick > 0) {
          this.intervals.push(tick - this.lastTick);
        }
        this.hits.push(tick);
        this.lastTick = tick;
        this.totalDamage += ctx.damage.burst;
      }

      if (this.startTick !== null && tick - this.lastTick > AH.SPIKE_SEQUENCE_GAP_TICKS) {
        this.resetSequence();
        return this._trapBreak(ctx);
      }
      if (!this.hits.length) {
        return this._trapBreak(ctx) || this._beforeFirstHit(ctx);
      }

      const count = this.hits.length;
      const meanInterval = this.intervals.length
        ? this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length
        : AH.SPIKE_SEQUENCE_GAP_TICKS;
      const sinceLast = tick - this.lastTick;
      const nextIn = Math.max(0, Math.round(meanInterval - sinceLast));

      const evidence = ["hits:" + count];
      if (ctx.spike.colliding) evidence.push("touching-spike");
      if (ctx.spike.pushing) evidence.push("pushed-onto-spike");
      if (ctx.spike.pusher) evidence.push("enemy-pushing");
      if (this.intervals.length) evidence.push("interval:" + Math.round(meanInterval));

      const stillOn = ctx.spike.colliding || ctx.spike.willCollide;
      let confidence;
      if (count >= 3 && stillOn && ctx.spike.pusher) confidence = CONFIDENCE.CRITICAL;
      else if (count >= 3 && stillOn) confidence = CONFIDENCE.HIGH;
      else if (count >= 2 && stillOn) confidence = CONFIDENCE.MEDIUM;
      else if (count >= 2) confidence = CONFIDENCE.LOW;
      else if (stillOn) confidence = CONFIDENCE.LOW;
      else return null;

      const perHit = this.totalDamage / count;
      /* Additive only when the next hit is a prediction: EnemyManager's
       * potentialSpikeDamage already carries a spike we are touching, so
       * counting that one again would double it. */
      const additive = !ctx.spike.colliding && stillOn &&
        CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK.HIGH;

      return threatReport(this.id, confidence, perHit, nextIn, evidence, {
        additive, gear: GEAR.SOLDIER, packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
      });
    }

    /* Pinned, and the trap is coming down. The exposure tick is arithmetic on
     * the trap's own health, sampled rather than assumed: whoever is breaking
     * it is doing so at some rate, and the rate is visible. */
    _trapBreak(ctx) {
      const t = ctx.trap;
      if (!t.trapped || !t.enemyOwned || !t.trap) {
        this.trapHealth = null;
        this.trapRef = null;
        return null;
      }
      if (this.trapRef !== t.trap) {
        this.trapRef = t.trap;
        this.trapHealth = t.health;
        this.trapDrop = 0;
      }
      const drop = this.trapHealth === null ? 0 : Math.max(0, this.trapHealth - t.health);
      /* Smoothed, so one big hit does not claim the trap opens next tick and
       * a pause does not claim it never will. */
      this.trapDrop = this.trapDrop === 0 ? drop : this.trapDrop * 0.6 + drop * 0.4;
      this.trapHealth = t.health;
      if (this.trapDrop <= 0) return null;

      const ticksToOpen = Math.max(0, Math.ceil(t.health / this.trapDrop));
      if (ticksToOpen > AH.PREDICT_HORIZON_TICKS) return null;

      /* And someone who can use the opening. A spike they can already place,
       * or one we are about to be pushed onto. */
      let placer = null;
      for (const e of ctx.enemies) {
        if (!e.canPlaceSpike) continue;
        if (!placer || e.spikeDamage > placer.spikeDamage) placer = e;
      }
      const spikeDamage = placer ? placer.spikeDamage : ctx.spike.damage;
      if (!spikeDamage && !ctx.spike.willCollide) return null;

      const evidence = [
        "trapped", "trap-hp:" + Math.round(t.health),
        "break-rate:" + Math.round(this.trapDrop) + "/t",
        "opens-in:" + ticksToOpen + "t"
      ];
      if (placer) evidence.push("spike-ready:" + Math.round(placer.spikeDamage));
      if (ctx.spike.willCollide) evidence.push("will-collide");

      const confidence = placer && ticksToOpen <= 2 ? CONFIDENCE.HIGH
        : placer ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      return threatReport(this.id, confidence, spikeDamage, ticksToOpen, evidence, {
        gear: GEAR.SOLDIER,
        source: placer ? placer.id : null,
        packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
      });
    }

    /* The spike tick before it has landed anything, on the client's own
     * verdict. EnemyManager runs a real placement scan per enemy — can this
     * enemy put a spike where it would touch me, right now
     * (Player.detectSpikeInsta) — and raises spikeSyncThreat once the combined
     * damage clears 100. That is a computed fact about the board, not "an
     * enemy owns spikes", and the engine consumes it rather than running the
     * scan a second time. It never exceeds MEDIUM: a spike that can be placed
     * still has to be placed. */
    _beforeFirstHit(ctx) {
      if (!ctx.snap.threat || !ctx.snap.threat.spikeSync) return null;

      const placers = ctx.enemies.filter(e => e.canPlaceSpike);
      let worst = 0;
      for (const e of placers) if (e.spikeDamage > worst) worst = e.spikeDamage;
      const damage = worst || ctx.spike.damage;
      if (damage <= 0) return null;

      const evidence = ["spike-sync-threat", "placers:" + placers.length];
      if (ctx.spike.willCollide) evidence.push("will-collide");
      if (ctx.spike.pusher) evidence.push("enemy-pushing");

      /* Only the part the baseline has not already counted is new damage:
       * potentialSpikeDamage is banked on the tick a placer becomes one, so on
       * a sustained hold the flag is still up while the damage figure has gone
       * back to zero. That gap is the only thing worth adding. */
      const uncounted = Math.max(0, worst - ctx.spike.damage);
      const imminent = ctx.spike.pusher || ctx.spike.willCollide;
      return threatReport(this.id, imminent ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW,
        damage, imminent ? 1 : 2, evidence, {
          additive: uncounted > 0, addAmount: uncounted,
          gear: imminent ? GEAR.SOLDIER : GEAR.NONE,
          packets: AH.PACKETS_PRESS
        });
    }
  }

  /* ---- 13. Anti Spike Push + Insta (requirement 11) ------------------ *
   *
   * Being walked onto a spike: boxed in, with somebody using their own body to
   * close the last gap. The client already tracks the two entities this needs
   * — `nearestEnemyPush` is the enemy whose collision is pushing us and
   * `nearestPushSpike` is the spike they are pushing us onto (EnemyManager's
   * own push pass) — so the detection is about *when*, and the answer comes
   * from the gap and how fast it is closing.
   *
   * The bull/turret-gear half the requirement names is what makes it lethal
   * rather than merely painful, and it is priced, not required: a push onto a
   * spike is a threat whoever is wearing what.
   * ------------------------------------------------------------------- */
  class AntiSpikePushDetector {
    constructor() {
      this.id = THREAT.SPIKE_PUSH;
      this.gap = null;
    }

    reset() { this.gap = null; }

    detect(ctx) {
      const s = ctx.spike;
      const pusher = s.pusher;
      const enclosed = ctx.trap.trapped || (isFinite(s.nearestDistance) && s.nearestDistance < 100);
      if (!pusher && !s.pushing) { this.gap = null; return null; }

      /* How fast the gap to the spike is closing, measured rather than
       * modelled: last tick's gap against this one's. */
      const gap = isFinite(s.nearestDistance) ? s.nearestDistance : Infinity;
      const closing = this.gap !== null && isFinite(this.gap) && isFinite(gap)
        ? this.gap - gap : 0;
      this.gap = gap;
      const ticksToContact = s.colliding ? 0
        : closing > 0 && isFinite(gap) ? Math.max(1, Math.ceil(gap / closing))
        : s.willCollide ? 1
        : Infinity;
      if (ticksToContact > AH.PREDICT_HORIZON_TICKS) return null;

      const evidence = [];
      if (ctx.trap.trapped) evidence.push("trapped");
      if (enclosed) evidence.push("enclosed");
      if (s.pushing) evidence.push("pushing");
      if (s.colliding) evidence.push("contact");
      if (isFinite(gap)) evidence.push("gap:" + Math.round(gap));
      if (closing > 0) evidence.push("closing:" + Math.round(closing) + "/t");
      if (ticksToContact !== Infinity) evidence.push("contact-in:" + ticksToContact + "t");

      /* The insta half. */
      let escort = null;
      for (const e of ctx.enemies) {
        if (pusher && e.ref !== pusher && e.id !== pusher.id) continue;
        escort = e;
        break;
      }
      let combined = s.damage || 0;
      if (escort) {
        if (escort.hatId === AH.HAT_BULL) evidence.push("pusher-bull");
        if (escort.hatId === AH.HAT_TURRET_GEAR) evidence.push("pusher-turret-gear");
        const reach = Math.max(escort.primaryRange, escort.secondaryRange);
        if (reach > 0 && escort.distance <= reach && escort.primaryReloaded) {
          evidence.push("pusher-armed");
          combined += escort.primaryDamage;
        }
        if (escort.turretReloaded && escort.distance <= AH.TURRET_RANGE) {
          combined += AH.TURRET_DAMAGE;
        }
      }

      let confidence;
      if (s.colliding && escort) confidence = CONFIDENCE.CRITICAL;
      else if (ticksToContact <= 1 && escort) confidence = CONFIDENCE.HIGH;
      else if (ticksToContact <= 2) confidence = CONFIDENCE.MEDIUM;
      else confidence = CONFIDENCE.LOW;

      return threatReport(this.id, confidence, combined, ticksToContact, evidence, {
        gear: GEAR.SOLDIER,
        source: escort ? escort.id : null,
        packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
      });
    }
  }

  /* ---- 14. Anti KB Tick (requirement 12) ----------------------------- *
   *
   * Knocked onto a spike rather than pushed onto one. The mechanics are in the
   * bundle: a melee hit adds an impulse of `0.3 * (weightM || 1) + weapon.knock`
   * to the target's velocity along the hit direction (game_index.js:2547), and
   * velocity decays by `playerDecel` per millisecond (:2371). The total travel
   * of an impulse v is therefore v / (1 - decel) to a very good approximation,
   * which for a polearm (knock 0.2) is about seventy pixels and for a bat
   * (knock 0.7) about a hundred and forty.
   *
   * So the prediction is: where does that put me, and is there a spike there.
   * The client answers the second half already — `potentialSpikeKnockbackDamage`
   * is exactly the damage of a spike we would be knocked into — so that number
   * anchors the report, and the displacement model is what gives it a *time*
   * and lets the detector see a spike the client has not flagged yet.
   * ------------------------------------------------------------------- */
  class AntiKBTickDetector {
    constructor() { this.id = THREAT.KB_TICK; }

    detect(ctx) {
      const kbDamage = ctx.snap.threat.spikeKB || 0;
      let best = null;

      for (const e of ctx.enemies) {
        const reach = Math.max(e.primaryRange, e.secondaryRange);
        if (reach <= 0 || e.distance > reach + (e.speed || 0)) continue;
        if (!e.primaryReloaded && !e.secondaryReloaded) continue;

        /* How far this enemy's swing would carry us, from RYN's own weapon
         * table where it publishes the number and from the bundle's decay
         * where it does not. */
        const weaponId = e.weaponCurrent === null ? e.weaponPrimary : e.weaponCurrent;
        const travel = ctx.weaponKnockback(weaponId);
        const impulse = 0.3 + (e.primaryKnock || 0);
        /* Where it would put me: away from them, along the hit direction. */
        const dir = e.angleTo;
        const landing = ctx.pos
          ? { x: ctx.pos.x + Math.cos(dir) * travel, y: ctx.pos.y + Math.sin(dir) * travel }
          : null;

        const evidence = [
          "knock:" + impulse.toFixed(2),
          "travel:" + Math.round(travel)
        ];
        if (e.hatId === AH.HAT_BULL) evidence.push("bull");
        if (e.hatId === AH.HAT_TURRET_GEAR) evidence.push("turret-gear");

        /* Is there a spike where that lands. The client's own knock-onto-spike
         * number is the strongest evidence; a hazard probe at the landing
         * point catches the ones it has not flagged. */
        let spikeDamage = kbDamage;
        let hazard = null;
        if (!spikeDamage && landing) {
          hazard = ctx.hazardAt(landing.x, landing.y, ctx.scale);
          if (hazard === "spike") spikeDamage = ctx.spike.damage || 0;
        }
        if (!spikeDamage) continue;
        if (kbDamage) evidence.push("client:knock-onto-spike:" + Math.round(kbDamage));
        if (hazard) evidence.push("landing:" + hazard);

        const combined = e.primaryDamage + spikeDamage +
          (e.turretReloaded && e.distance <= AH.TURRET_RANGE ? AH.TURRET_DAMAGE : 0);

        let confidence;
        if (kbDamage && e.facing && e.distance <= reach) confidence = CONFIDENCE.HIGH;
        else if (kbDamage) confidence = CONFIDENCE.MEDIUM;
        else if (hazard === "spike" && e.facing) confidence = CONFIDENCE.MEDIUM;
        else confidence = CONFIDENCE.LOW;

        /* The swing is this tick; the spike contact is the tick after it. */
        const report = threatReport(this.id, confidence, combined, 1, evidence, {
          gear: GEAR.SOLDIER,
          source: e.id,
          packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
        });
        if (!best || report.rank > best.rank) best = report;
      }
      return best;
    }
  }

  /* ---- 15. Anti Turret Stack (requirement 20) ------------------------ *
   *
   * Several turrets firing into the same moment. Each shot is 25
   * (projectiles[1].dmg) and each source is either a placed turret
   * (items[17], shootRange 700, shootRate 2200) or a player wearing Turret
   * Gear (hats[53], range 700, rate 2500), so four of them inside 700px is a
   * hundred damage waiting for a tick where they line up.
   *
   * The stack is counted once per tick by the adapter, from a bounded grid
   * query at our own position plus the enemy list — never a map walk. What
   * this decides is whether the combined number is lethal before it is fired,
   * and whether stepping out is even possible: 700 is a long way, so the
   * honest answer is usually no, which is why the gear answer here is Emp
   * Helmet (hats[22].antiTurret) rather than movement. That is the game's own
   * counter to turrets, and it is the one piece of gear that removes the
   * threat instead of surviving it.
   * ------------------------------------------------------------------- */
  class AntiTurretStackDetector {
    constructor() { this.id = THREAT.TURRET_STACK; }

    detect(ctx) {
      const t = ctx.turret;
      if (t.count < 2) return null;

      const inAir = ctx.projectiles.filter(p => p.isTurret);
      const combined = t.combinedDamage;
      const readyDamage = t.readyNow * AH.TURRET_DAMAGE +
        inAir.reduce((sum, p) => sum + p.damage, 0);
      const effective = readyDamage;
      if (effective <= 0) return null;

      const evidence = [
        "sources:" + t.count,
        "ready:" + t.readyNow,
        "combined:" + Math.round(combined),
        "nearest:" + Math.round(t.distance)
      ];
      for (const s of t.sources) evidence.push(s.kind + "@" + Math.round(s.distance));
      if (inAir.length) evidence.push("in-air:" + inAir.length);

      /* Can we simply leave? Everything is inside 700 of us and our measured
       * travel is a body length a tick, so this is nearly always false — but
       * it is asked rather than assumed, because when it is true the answer is
       * to walk out rather than to spend food. */
      const escapeTicks = ctx.speed > 0
        ? Math.ceil((AH.TURRET_RANGE - t.distance) / ctx.speed) : Infinity;
      if (escapeTicks <= 3) evidence.push("escape:" + escapeTicks + "t");

      const lethal = effective >= ctx.health;
      let confidence;
      if (lethal && inAir.length) confidence = CONFIDENCE.CRITICAL;
      else if (lethal && t.readyNow >= 2) confidence = CONFIDENCE.HIGH;
      else if (t.readyNow >= 2) confidence = CONFIDENCE.MEDIUM;
      else confidence = CONFIDENCE.LOW;

      const timing = inAir.length
        ? Math.min.apply(null, inAir.map(p => p.ticksToImpact))
        : t.readyNow > 0 ? 1 : 2;
      return threatReport(this.id, confidence, readyDamage, timing, evidence, {
        gear: GEAR.EMP,
        evadable: escapeTicks <= 3,
        packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
      });
    }
  }

  /* ---- 16. Anti Spike — direct exposure ----------------------------- */
  class AntiSpikeDetector {
    constructor() { this.id = THREAT.SPIKE; }

    detect(ctx) {
      const s = ctx.spike;
      if (!s.colliding && !s.willCollide && !s.pushing) return null;

      const evidence = [];
      if (s.colliding) evidence.push("colliding");
      if (s.willCollide) evidence.push("will-collide");
      if (s.pushing) evidence.push("pushing");
      if (s.pusher) evidence.push("enemy-pushing");
      if (isFinite(s.nearestDistance)) evidence.push("gap:" + Math.round(s.nearestDistance));

      let confidence;
      if (s.colliding && s.pusher) confidence = CONFIDENCE.CRITICAL;
      else if (s.colliding) confidence = CONFIDENCE.HIGH;
      else if (s.pushing) confidence = CONFIDENCE.MEDIUM;
      else confidence = CONFIDENCE.LOW;

      return threatReport(this.id, confidence, s.damage, s.colliding ? 0 : 1, evidence, {
        gear: s.colliding ? GEAR.SOLDIER : GEAR.NONE,
        packets: AH.PACKETS_PRESS
      });
    }
  }

  /* ---- 17. Anti Trap — pinned, and what that lets somebody do -------- */
  class AntiTrapDetector {
    constructor() {
      this.id = THREAT.TRAP;
      this.damageWhileTrapped = 0;
      this.trappedSince = null;
    }

    reset() {
      this.damageWhileTrapped = 0;
      this.trappedSince = null;
    }

    detect(ctx) {
      const t = ctx.trap;
      if (!t.trapped) {
        this.reset();
        /* Not pinned, but standing on top of one with an enemy closing is the
         * situation that becomes the threat a tick later. */
        if (isFinite(t.nearestDistance) && t.nearestDistance < 100) {
          const closer = ctx.enemies.find(e => e.closing > 0 && e.distance < 300);
          if (closer) {
            return threatReport(this.id, CONFIDENCE.LOW, 0, 2,
              ["trap-underfoot:" + Math.round(t.nearestDistance), "enemy-closing"],
              { source: closer.id });
          }
        }
        return null;
      }

      if (this.trappedSince === null) this.trappedSince = ctx.snap.tick;
      this.damageWhileTrapped += ctx.damage.burst;

      const evidence = ["trapped:" + (ctx.snap.tick - this.trappedSince)];
      if (t.enemyOwned) evidence.push("enemy-trap");
      if (!t.breakable) evidence.push("break-ticks:" + (isFinite(t.breakTicks) ? t.breakTicks : "?"));
      if (this.damageWhileTrapped > 0) evidence.push("damage:" + Math.round(this.damageWhileTrapped));

      let attacker = null;
      for (const e of ctx.enemies) {
        const reach = Math.max(e.primaryRange, e.secondaryRange);
        if (reach > 0 && e.distance <= reach && (e.primaryReloaded || e.secondaryReloaded)) {
          attacker = e;
          break;
        }
      }
      if (attacker) evidence.push("attacker-in-reach");

      let confidence;
      if (attacker && t.enemyOwned && !t.breakable) confidence = CONFIDENCE.CRITICAL;
      else if (attacker && t.enemyOwned) confidence = CONFIDENCE.HIGH;
      else if (t.enemyOwned) confidence = CONFIDENCE.MEDIUM;
      else confidence = CONFIDENCE.LOW;

      const severity = attacker
        ? attacker.primaryDamage + attacker.secondaryDamage
        : this.damageWhileTrapped;
      return threatReport(this.id, confidence, severity, attacker ? 0 : 2, evidence, {
        gear: attacker ? GEAR.SOLDIER : GEAR.NONE,
        source: attacker ? attacker.id : null,
        packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 2
      });
    }
  }

  /* ---- 18. Generic burst — damage that already landed ---------------- */
  class BurstDamageDetector {
    constructor() { this.id = THREAT.BURST; }

    detect(ctx) {
      const burst = ctx.damage.burst;
      if (burst <= 0) return null;
      const share = ctx.maxHealth > 0 ? burst / ctx.maxHealth : 0;
      if (share < 0.15) return null;

      const evidence = ["burst:" + Math.round(burst)];
      if (ctx.state.hiddenDamage >= 1) evidence.push("hidden-under-heal");

      const confidence = share >= 0.5 ? CONFIDENCE.HIGH
        : share >= 0.3 ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      return threatReport(this.id, confidence, burst, 0, evidence, {
        packets: AH.PACKETS_PRESS
      });
    }
  }

  /* ---- 19. Generic sustained — pressure that is not any one thing ---- */
  class SustainedDamageDetector {
    constructor() {
      this.id = THREAT.SUSTAINED;
      this.window = [];
    }

    reset() { this.window.length = 0; }

    detect(ctx) {
      const tick = ctx.snap.tick;
      if (ctx.damage.burst > 0) this.window.push({ tick, amount: ctx.damage.burst });
      while (this.window.length && tick - this.window[0].tick > AH.SUSTAINED_WINDOW_TICKS) {
        this.window.shift();
      }
      if (this.window.length < 2) return null;

      const total = this.window.reduce((a, b) => a + b.amount, 0);
      const spanTicks = Math.max(1, tick - this.window[0].tick);
      const perSecond = total / ((spanTicks * ctx.snap.TICK) / 1000);
      const ticksToEmpty = perSecond > 0
        ? Math.round((ctx.health / perSecond) * (1000 / ctx.snap.TICK))
        : Infinity;

      const evidence = ["events:" + this.window.length, "dps:" + Math.round(perSecond)];
      const confidence = this.window.length >= 5 && perSecond >= 60 ? CONFIDENCE.HIGH
        : this.window.length >= 3 && perSecond >= 30 ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      return threatReport(this.id, confidence, perSecond, ticksToEmpty, evidence, {
        rate: true, packets: AH.PACKETS_PRESS
      });
    }
  }

  /* ---- the engine ---------------------------------------------------- */
  class ThreatEngine {
    constructor(adapter) {
      this.adapter = adapter;
      this.sequence = new SequenceTracker();
      this.detectors = [
        new AntiInstaKillDetector(),
        new AntiReverseInstaDetector(),
        new AntiOneTickDetector(),
        new AntiMixedInstaDetector(),
        new AntiVelocityTickDetector(),
        new AntiVelocityComboDetector(),
        new RangedDetector(THREAT.MUSKET, [AH.PROJ_MUSKET], [AH.WEAPON_MUSKET], GEAR.SOLDIER),
        new RangedDetector(THREAT.BOW, AH.PROJ_ARROWS,
          [AH.WEAPON_BOW, AH.WEAPON_CROSSBOW, AH.WEAPON_REPEATER], GEAR.SOLDIER),
        new AntiSpamBowDetector(),
        new AntiSpamDaggerDetector(),
        new AntiSpamShameDetector(),
        new AntiSpikeTickDetector(),
        new AntiSpikePushDetector(),
        new AntiKBTickDetector(),
        new AntiTurretStackDetector(),
        new AntiSpikeDetector(),
        new AntiTrapDetector(),
        new BurstDamageDetector(),
        new SustainedDamageDetector()
      ];
      this.reset();
    }

    reset() {
      this.raw = 0;
      this.effective = 0;
      this.spikeContact = false;
      this.insta = false;
      this.sources = [];
      this.confidence = 0;
      this.reports = [];
      this.byType = {};
      this.top = null;
      this.escalation = CONFIDENCE.NONE;
      this.soonest = Infinity;
      this.lastEnemies = [];
      this.lastProjectiles = [];
      this.sequence.reset();
      for (const d of this.detectors) if (d.reset) d.reset();
    }

    evaluate(snap, damage, state, shame, ping) {
      const t = snap.threat;

      /* ---- the damage number, unchanged ----------------------------- *
       * EnemyManager already summed melee-in-range-and-off-reload, secondary
       * and turret into potentialDamage, and took the larger of direct spike
       * contact and knock-onto-spike (v5.4:3124-3130). Projectiles in flight
       * are the ProjectileManager's own total. Nothing here is re-derived. */
      const spike = Math.max(t.spike, t.spikeKB);
      let raw = t.potential + spike + t.projectile;
      if (damage.dotActive && damage.ticksUntilDot <= 2) raw += damage.dotPerSecond;
      raw = Math.min(raw, AH.DMG_CAP);

      /* Soldier Helmet's dmgMult is applied by the server inside changeHealth
       * (game_index.js:2420), so it is a true reduction. */
      const soldierMult = snap.soldierOn ? snap.soldierMult : 1;
      let eff = raw * soldierMult;
      if (snap.bullOn) eff += 5;

      this.raw = raw;
      this.effective = eff;
      this.spikeContact = t.collidingSpike || t.willCollideSpike;
      this.insta = t.instaThreat || t.dangerNoSoldier;
      this.sources = [];
      if (t.potential) this.sources.push("hit:" + Math.round(t.potential));
      if (spike) this.sources.push("spike:" + Math.round(spike));
      if (t.projectile) this.sources.push("proj:" + Math.round(t.projectile));
      if (damage.dotActive) this.sources.push("dot:" + damage.dotPerSecond);

      /* ---- the detectors -------------------------------------------- */
      const ctx = this._context(snap, damage, state, shame, ping, eff, soldierMult);
      /* The adapter reads are done once per tick and published here, so the
       * predictive defense engine, the gear manager and the evasion planner
       * work from the same enemy list and the same projectile list rather than
       * gathering their own copies. */
      this.lastEnemies = ctx.enemies;
      this.lastProjectiles = ctx.projectiles;
      this.sequence.observe(snap, ctx.enemies);

      this.reports = [];
      this.byType = {};
      this.top = null;
      this.soonest = Infinity;
      for (const detector of this.detectors) {
        let report = null;
        try {
          report = detector.detect(ctx);
        } catch (_) { report = null; }
        if (!report || report.rank === 0) continue;
        this.reports.push(report);
        this.byType[report.type] = report;
        if (report.timing < this.soonest) this.soonest = report.timing;
        if (!this.top || report.rank > this.top.rank ||
            (report.rank === this.top.rank && report.severity > this.top.severity)) {
          this.top = report;
        }
      }
      this.reports.sort((a, b) => b.rank - a.rank || b.severity - a.severity);
      this.escalation = this.top ? this.top.confidence : CONFIDENCE.NONE;

      /* A detector may add damage the baseline has not counted — in practice
       * only the next hit of a spike sequence we are no longer touching. The
       * cap still applies, and soldier still reduces it. */
      let additive = 0;
      for (const r of this.reports) {
        if (r.additive && r.timing <= 1) additive = Math.max(additive, r.addAmount);
      }
      if (additive > 0) {
        this.raw = Math.min(AH.DMG_CAP, this.raw + additive);
        this.effective = this.raw * soldierMult + (snap.bullOn ? 5 : 0);
        this.sources.push("predicted:" + Math.round(additive));
      }

      this.confidence = this._confidence(t, spike, damage);
      return this;
    }

    /* How much of the threat can actually land inside the next `ticks` ticks.
     *
     * This is what the detectors' timing is for. The heal engine's one real
     * trade is whether it can wait a tick for the shame window, and without a
     * timing model the only safe answer is to assume the whole number lands
     * immediately — which spends a charge on every exchange, including the
     * ones where the next hit is three ticks out.
     *
     * The relaxation is deliberately narrow: any credible report landing
     * inside the window returns the full number, and no detector view at all
     * returns the full number too. Only when every credible threat is
     * demonstrably further out does the wait become affordable. */
    imminentWithin(ticks) {
      if (!this.reports.length) return this.effective;
      let credible = false;
      let worst = 0;
      for (const r of this.reports) {
        if (r.rank < CONFIDENCE_RANK.MEDIUM) continue;
        credible = true;
        if (r.timing <= ticks) worst = Math.max(worst, r.rate ? 0 : r.severity);
      }
      if (!credible) return this.effective;
      if (worst > 0) return this.effective;
      /* Nothing credible lands in the window. What is already touching us
       * still does. */
      return this.spikeContact ? this.effective : worst;
    }

    /* How much of the damage number is going to happen rather than could.
     *
     * The floor is the source weighting: a damage-over-time tick is
     * arithmetic, an arrow has already been fired, a spike being touched deals
     * contact damage, and an enemy in range holding a reloaded weapon is a
     * player who may not swing. A detector that found real evidence for most
     * of the number can raise it above that floor, but nothing lowers it. */
    _confidence(t, spike, damage) {
      const parts = [];
      if (damage.dotActive && damage.ticksUntilDot <= 2) parts.push([damage.dotPerSecond, 1]);
      if (t.projectile) parts.push([t.projectile, 0.85]);
      if (spike) parts.push([spike, t.collidingSpike ? 0.9 : 0.5]);
      if (t.potential) parts.push([t.potential, t.instaThreat ? 0.8 : t.primary ? 0.6 : 0.4]);
      let sum = 0, weighted = 0;
      for (const [d, w] of parts) { sum += d; weighted += d * w; }
      let confidence = sum > 0 ? weighted / sum : 0;
      if (this.top && this.raw > 0 && this.top.severity >= this.raw * 0.5) {
        confidence = Math.max(confidence, this.top.value);
      }
      return confidence;
    }

    /* Everything a detector may look at, read once per tick through the
     * adapter so the detectors themselves never touch the client. */
    _context(snap, damage, state, shame, ping, effective, soldierMult) {
      const adapter = this.adapter;
      const config = adapter.Config;
      const packets = adapter.packetsLeft();
      return {
        snap,
        damage,
        state,
        ping,
        sequence: this.sequence,
        shameTracker: shame ? shame.tracker : null,
        enemies: adapter.enemyList(),
        projectiles: adapter.incomingProjectiles(snap),
        spike: adapter.spikeContext(snap),
        trap: adapter.trapContext(),
        turret: adapter.turretContext(snap),
        health: snap.health,
        maxHealth: snap.maxHealth,
        restore: snap.restore,
        pos: snap.pos,
        scale: snap.scale,
        speed: snap.speed,
        effective,
        soldierMult,
        /* game config: the per-millisecond velocity decay the knockback model
         * integrates over (game_index.js:2371). */
        playerDecel: (config && num(config.playerDecel)) || 0.993,
        pressesAffordable: Math.floor(packets / AH.PACKETS_PRESS),
        shameCritical: shame ? shame.critical : false,
        projectileDamageFor: id => adapter.projectileDamageFor(id),
        weaponDamage: id => adapter.tableDamage(adapter.Weapons && adapter.Weapons[id]),
        weaponKnockback: id =>
          adapter.weaponKnockback(id, (config && num(config.playerDecel)) || 0.993),
        weaponReach: id => {
          const w = adapter.Weapons && adapter.Weapons[id];
          if (!w) return 0;
          if (num(w.range)) return w.range;
          /* A shootable weapon's reach is its projectile's range. */
          const projectiles = adapter.Projectiles;
          const p = projectiles && w.projectile !== undefined ? projectiles[w.projectile] : null;
          return (p && num(p.range)) || 0;
        },
        hazardAt: (x, y, r) => adapter.hazardAt(x, y, r)
      };
    }
  }

  /* ================================================================== *
   * Prediction — act before the bar moves, not after.
   *
   * Reacting to health is reacting late: by the time the number changed, the
   * hit landed and the shame window is already open. This engine's job is the
   * tick before that, and its whole discipline is knowing when it is allowed
   * to spend anything on a guess.
   *
   *   1. It never spends a shame charge on a prediction. A press that would
   *      count +1 is a press for damage that has already landed.
   *   2. Confidence gates the action, not the reporting.
   *   3. A prediction is thrown away the moment the world that produced it
   *      changes, and the ways that happens are named.
   * ================================================================== */

  /* Motion, borrowed from the placement engine's TargetMotion where it exists.
   * The fallback is not a second predictor — it is the linear extrapolation
   * every Entity already carries (pos.previous -> pos.current, `speed` and
   * `move_dir`), read one tick at a time. */
  class MotionSource {
    constructor(adapter) {
      this.adapter = adapter;
      this.impl = null;
      this.kind = "pending";
    }

    reset() {
      this.impl = null;
      this.kind = "pending";
    }

    _ensure() {
      if (this.kind !== "pending") return;
      this.impl = this.adapter.borrowTargetMotion();
      this.kind = this.impl ? "ryn-target-motion" : "entity-fallback";
    }

    observe(enemy, tick) {
      this._ensure();
      if (!this.impl) return null;
      try { return this.impl.observe(enemy.ref, tick); } catch (_) { return null; }
    }

    expire(tick) {
      if (this.impl && typeof this.impl.expire === "function") {
        try { this.impl.expire(tick); } catch (_) {}
      }
    }

    predict(enemy, ticks) {
      this._ensure();
      if (this.impl) {
        try { return this.impl.predict(enemy.ref, ticks); } catch (_) {}
      }
      const pos = enemy.ref && enemy.ref.pos && enemy.ref.pos.current;
      if (!pos) return null;
      const speed = enemy.speed || 0;
      const dir = enemy.moveDir;
      if (dir === null || dir === undefined || speed <= 0) {
        return { x: pos.x, y: pos.y, confidence: ticks === 0 ? 1 : 0.3 };
      }
      return {
        x: pos.x + Math.cos(dir) * speed * ticks,
        y: pos.y + Math.sin(dir) * speed * ticks,
        confidence: Math.max(0.05, 0.45 * Math.exp(-ticks / 3.5))
      };
    }

    intercept(enemy, x, y, radius, maxTicks) {
      this._ensure();
      if (this.impl && typeof this.impl.intercept === "function") {
        try { return this.impl.intercept(enemy.ref, x, y, radius, maxTicks); } catch (_) {}
      }
      for (let n = 0; n <= maxTicks; n++) {
        const p = this.predict(enemy, n);
        if (!p) return null;
        if (Math.hypot(p.x - x, p.y - y) <= radius) {
          return { tick: n, confidence: p.confidence, x: p.x, y: p.y };
        }
      }
      return null;
    }

    track(enemy) {
      if (!this.impl || typeof this.impl.get !== "function") return null;
      try { return this.impl.get(enemy.id); } catch (_) { return null; }
    }
  }

  /* What the world looked like when a prediction was made, reduced to the
   * things that would change the answer. Two identical fingerprints mean the
   * cached forecast is still right and nothing needs rebuilding. */
  class PredictionFingerprint {
    static of(snap, threat, enemies, projectiles, motion) {
      const parts = [
        Math.round(snap.health / 5),
        threat.top ? threat.top.type + ":" + threat.top.confidence : "-",
        projectiles.length,
        projectiles.length ? Math.min.apply(null, projectiles.map(p => p.ticksToImpact)) : -1,
        snap.systems && snap.systems.soldierClaimed ? "s" : "-",
        threat.spikeContact ? "spike" : "-",
        snap.isTrapped ? "trap" : "-"
      ];
      for (const e of enemies) {
        const track = motion.track(e);
        const heading = track && track.heading !== null && track.heading !== undefined
          ? Math.round(track.heading / (Math.PI / 8))
          : "-";
        parts.push([
          e.id,
          Math.round(e.distance / 40),
          heading,
          Math.round((e.speed || 0) / 2),
          e.weaponCurrent,
          e.hatId,
          e.primaryReloaded ? 1 : 0,
          e.secondaryReloaded ? 1 : 0
        ].join(","));
      }
      return parts.join("|");
    }
  }

  class PredictiveDefenseEngine {
    constructor(adapter) {
      this.adapter = adapter;
      this.motion = new MotionSource(adapter);
      this.reset();
    }

    reset() {
      this.inFlight = 0;
      this.projected = AH.MAX_HEALTH;
      this.regenPerSecond = 0;
      this.padRegen = 0;

      this.forecast = this._empty();
      this.motion.reset();
      this._cache = null;
      this._cacheTick = -999;
      this._fingerprint = "";
      this._lastPos = null;
      this._lastTargetId = null;
      this._lastProjectiles = -1;
      this._lastCollision = "";
      this._hadThreat = false;
      this._motionState = new Map();
      this.invalidatedBy = INVALIDATION.FIRST;
      this.cacheHits = 0;
      this.cacheMisses = 0;
    }

    _empty() {
      return {
        incomingDamage: 0,
        timing: Infinity,
        expectedHealth: AH.MAX_HEALTH,
        expectedShameDelta: 0,
        threatDuration: 0,
        confidence: 0,
        level: CONFIDENCE.NONE,
        sources: [],
        motion: "none"
      };
    }

    /* ---- the health projection the heal engine spends against ------- */
    build(snap, state, damage, threat, ledger) {
      this.inFlight = ledger.expectedHeal(snap);
      this.padRegen = this.adapter.healingPadRegen(snap);

      /* Every positive term the server applies on its one-second tick
       * (game_index.js:2316-2322): regen gear, the healing pad, and cheese's
       * dmgOverTime while it is still running. */
      const cheese = snap.now < state.cheeseUntil ? 10 : 0;
      this.regenPerSecond = damage.regenPerSecond + this.padRegen + cheese;

      this.projected = clamp(
        snap.health + this.inFlight - damage.dotPerSecond * (damage.ticksUntilDot <= 1 ? 1 : 0),
        0, snap.maxHealth
      );
      return this;
    }

    /* Post-execution: the health a press just bought is real, and the rest of
     * this tick should see it. */
    commitHeal(amount, snap) {
      this.projected = clamp(this.projected + amount, 0, snap.maxHealth);
      this._cache = null;
      this.invalidatedBy = INVALIDATION.WORLD;
    }

    /* Health after `ms`, if nothing is done: what a shame-window hold costs. */
    afterHold(snap, damage, ms) {
      const seconds = ms / 1000;
      const dotHits = damage.dotActive && ms >= damage.msUntilDot ? damage.dotPerSecond : 0;
      return this.projected + this.regenPerSecond * seconds - dotHits;
    }

    /* Would waiting `ms` for the shame window still leave us alive if the
     * damage that can land during the wait does land? */
    survivesHold(snap, damage, threat, ms) {
      const ticks = Math.max(1, Math.round(ms / (snap.TICK || AH.TICK_MS)));
      const incoming = typeof threat.imminentWithin === "function"
        ? threat.imminentWithin(ticks)
        : threat.effective;
      return this.afterHold(snap, damage, ms) - incoming > 0;
    }

    /* ...and the softer version of the same question, which is what decides
     * whether a charge is allowed at all: does waiting drop the bar under the
     * floor the reserve setting draws? */
    holdsAboveFloor(snap, damage, threat, ms, floor) {
      const ticks = Math.max(1, Math.round(ms / (snap.TICK || AH.TICK_MS)));
      const incoming = typeof threat.imminentWithin === "function"
        ? threat.imminentWithin(ticks)
        : threat.effective;
      return this.afterHold(snap, damage, ms) - incoming >= floor;
    }

    healsNeeded(target, restore) {
      if (restore <= 0) return 0;
      const gap = target - this.projected;
      return gap <= 0 ? 0 : Math.ceil(gap / restore);
    }

    /* ---- the forecast ------------------------------------------------ */
    predictAhead(snap, state, damage, threat, shame) {
      const enemies = this._relevant(threat.lastEnemies || []);
      const projectiles = threat.lastProjectiles || [];
      const tick = snap.tick;

      this.motion.expire(tick);
      for (const e of enemies) this.motion.observe(e, tick);

      const reason = this._invalidation(snap, threat, enemies, projectiles);
      this._recordMotionState(enemies);
      if (!reason && this._cache) {
        this.cacheHits += 1;
        this.forecast = this._cache;
        this.invalidatedBy = INVALIDATION.NONE;
        return this.forecast;
      }

      this.cacheMisses += 1;
      this.invalidatedBy = reason;
      const forecast = this._compute(snap, state, damage, threat, shame, enemies, projectiles);
      this._cache = forecast;
      this._cacheTick = tick;
      this._fingerprint = PredictionFingerprint.of(snap, threat, enemies, projectiles, this.motion);
      this._lastPos = snap.pos ? { x: snap.pos.x, y: snap.pos.y } : null;
      this._lastTargetId = enemies.length ? enemies[0].id : null;
      this._lastProjectiles = projectiles.length;
      this._lastCollision = this._collisionKey(snap, threat);
      this._hadThreat = threat.reports.length > 0;
      this.forecast = forecast;
      return forecast;
    }

    _recordMotionState(enemies) {
      const live = new Set();
      for (const e of enemies) {
        live.add(e.id);
        const track = this.motion.track(e);
        if (!track) continue;
        this._motionState.set(e.id, {
          stopped: (track.peakSpeed || 0) >= AH.PREDICT_MOVING_SPEED &&
            (track.speed || 0) < AH.PREDICT_STOP_SPEED,
          heading: track.heading
        });
      }
      for (const id of this._motionState.keys()) {
        if (!live.has(id)) this._motionState.delete(id);
      }
    }

    _relevant(enemies) {
      const out = [];
      for (const e of enemies) {
        if (e.distance > AH.PREDICT_RELEVANT_RANGE) continue;
        out.push(e);
      }
      out.sort((a, b) => a.distance - b.distance);
      return out.slice(0, AH.PREDICT_MAX_TRACKED);
    }

    _collisionKey(snap, threat) {
      return (threat.spikeContact ? "s" : "-") + (snap.isTrapped ? "t" : "-");
    }

    _invalidation(snap, threat, enemies, projectiles) {
      if (!this._cache) return INVALIDATION.FIRST;
      if (snap.tick - this._cacheTick >= AH.PREDICT_MAX_AGE_TICKS) return INVALIDATION.AGE;

      const targetId = enemies.length ? enemies[0].id : null;
      if (targetId !== this._lastTargetId) return INVALIDATION.TARGET;
      if (this._hadThreat && threat.reports.length === 0) return INVALIDATION.GONE;
      if (projectiles.length !== this._lastProjectiles) return INVALIDATION.PROJECTILE;
      if (this._collisionKey(snap, threat) !== this._lastCollision) return INVALIDATION.COLLISION;

      if (this._lastPos && snap.pos) {
        const moved = Math.hypot(snap.pos.x - this._lastPos.x, snap.pos.y - this._lastPos.y);
        if (moved > AH.PREDICT_PLAYER_MOVE_PX) return INVALIDATION.MOVED;
      }

      /* An enemy turned or stopped. Both are edge-triggered: a prediction is
       * invalidated by someone *becoming* stationary, not by their continuing
       * to stand there — re-firing on the standing would rebuild the same
       * answer every tick, which is the one thing this cache exists to avoid. */
      for (const e of enemies) {
        const track = this.motion.track(e);
        if (!track) continue;
        const was = this._motionState.get(e.id);
        if ((track.headingShift || 0) > AH.PREDICT_TURN_RADIANS) return INVALIDATION.TURNED;
        const stopped = (track.peakSpeed || 0) >= AH.PREDICT_MOVING_SPEED &&
          (track.speed || 0) < AH.PREDICT_STOP_SPEED;
        if (stopped && (!was || !was.stopped)) return INVALIDATION.STOPPED;
      }

      const print = PredictionFingerprint.of(snap, threat, enemies, projectiles, this.motion);
      if (print !== this._fingerprint) return INVALIDATION.WORLD;

      return INVALIDATION.NONE;
    }

    _compute(snap, state, damage, threat, shame, enemies, projectiles) {
      const H = AH.PREDICT_HORIZON_TICKS;
      const out = this._empty();
      const events = [];

      /* 1. What is already in the air. */
      for (const p of projectiles) {
        if (p.ticksToImpact > H) continue;
        events.push({
          damage: p.damage, tick: p.ticksToImpact, confidence: 0.85, source: "projectile",
          key: "proj:" + (p.ref && p.ref.id !== undefined ? p.ref.id : p.ticksToImpact)
        });
      }

      /* 2. Who is going to be able to reach me, and when. This is the part
       *    that is genuinely ahead of the health bar. */
      const myPos = snap.pos;
      for (const e of enemies) {
        const reach = Math.max(e.primaryRange, e.secondaryRange);
        if (reach <= 0) continue;
        const armed = e.primaryReloaded || e.secondaryReloaded;
        const damageIfHit = Math.max(e.primaryDamage, e.secondaryDamage);
        if (damageIfHit <= 0) continue;

        if (e.distance <= reach) {
          if (armed) {
            events.push({
              damage: damageIfHit, tick: 1,
              confidence: e.facing ? 0.6 : 0.4, source: "in-reach",
              key: "enemy:" + e.id
            });
          }
          continue;
        }
        if (!myPos) continue;
        const hit = this.motion.intercept(e, myPos.x, myPos.y, reach, H);
        if (!hit) continue;
        events.push({
          damage: damageIfHit,
          tick: Math.max(1, hit.tick),
          confidence: (hit.confidence || 0.3) * (armed ? 1 : 0.6) * (e.facing ? 1 : 0.8),
          source: "closing",
          key: "enemy:" + e.id
        });
      }

      /* 3. The damage-over-time tick, a period rather than a guess. */
      if (damage.dotActive && damage.ticksUntilDot <= H) {
        events.push({
          damage: damage.dotPerSecond, tick: damage.ticksUntilDot,
          confidence: 1, source: "dot", key: "dot"
        });
      }

      /* 4. Every non-rate detector's own prediction, at its own confidence.
       *    The detectors have already done the work of saying what lands and
       *    when; the forecast is where those become one number. */
      for (const r of threat.reports) {
        if (r.rate || r.timing > H || r.rank < CONFIDENCE_RANK.MEDIUM) continue;
        if (r.type === THREAT.BURST) continue;   // already landed, not a forecast
        events.push({
          damage: r.severity, tick: r.timing, confidence: r.value, source: r.type,
          /* Keyed by whoever it is about, so one enemy's swing counted by three
           * detectors is one swing. Without this the forecast sums the same hit
           * under every name it has and reports a lethal number for an ordinary
           * exchange — which makes every tick an emergency. */
          key: r.source !== null && r.source !== undefined ? "enemy:" + r.source : "type:" + r.type
        });
      }

      if (!events.length) return out;

      /* Only credible events are spent against. The rest are still reported —
       * they are what makes the confidence low. Events are deduplicated by
       * tick: the same swing reported by three detectors is one swing, so the
       * worst number on a tick is taken rather than their sum. */
      const bySource = new Map();
      let total = 0, weighted = 0;
      for (const ev of events) {
        total += ev.damage;
        weighted += ev.damage * ev.confidence;
        out.sources.push(`${ev.source}:${Math.round(ev.damage)}@${ev.tick}`);
        if (ev.confidence < AH.CONFIDENCE_LOW) continue;
        const key = ev.key || ev.source;
        const prev = bySource.get(key);
        /* One entry per thing that can hit us, carrying its worst number and
         * the earliest tick that number could land on. An enemy cannot swing
         * twice in a tick however many detectors describe the swing. */
        if (!prev || ev.damage > prev.damage) {
          bySource.set(key, { damage: ev.damage, tick: ev.tick });
        } else if (ev.tick < prev.tick) {
          prev.tick = ev.tick;
        }
      }
      let credible = 0, soonest = Infinity;
      for (const entry of bySource.values()) {
        credible += entry.damage;
        if (entry.tick < soonest) soonest = entry.tick;
      }
      const confidence = total > 0 ? weighted / total : 0;

      out.incomingDamage = Math.min(AH.DMG_CAP, credible) *
        (snap.soldierOn ? snap.soldierMult : 1);
      out.timing = soonest;
      out.confidence = confidence;
      out.level = confidence >= AH.CONFIDENCE_HIGH ? CONFIDENCE.HIGH
        : confidence >= AH.CONFIDENCE_LOW ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      out.motion = this.motion.kind;

      const seconds = (soonest === Infinity ? 0 : soonest) * (snap.TICK / 1000);
      out.expectedHealth = clamp(
        this.projected + this.regenPerSecond * seconds - out.incomingDamage,
        0, snap.maxHealth
      );

      /* Expected shame: the hit stamps hitTime, and what it costs depends on
       * when the first press after it lands. Healing on the damage tick is +1,
       * a tick later is -2 — the shame engine's own arithmetic, asked rather
       * than repeated. */
      const willHaveToHeal = out.expectedHealth < snap.maxHealth * 0.5 ||
        out.expectedHealth <= threat.effective;
      out.expectedShameDelta = willHaveToHeal
        ? (out.expectedHealth <= out.incomingDamage ? 1 : -AH.SHAME_CREDIT)
        : 0;
      if (shame && shame.critical && out.expectedShameDelta > 0) {
        out.expectedShameDelta = 0;
      }

      let duration = 0;
      for (const e of enemies) {
        const reach = Math.max(e.primaryRange, e.secondaryRange);
        if (reach <= 0) continue;
        for (let n = 0; n <= H; n++) {
          const p = this.motion.predict(e, n);
          if (!p || !myPos) break;
          if (Math.hypot(p.x - myPos.x, p.y - myPos.y) <= reach) duration = Math.max(duration, n + 1);
        }
      }
      const sustained = threat.byType[THREAT.SUSTAINED];
      if (sustained) duration = Math.max(duration, Math.min(H, sustained.timing));
      out.threatDuration = duration;

      return out;
    }
  }

  /* ================================================================== *
   * ThreatPriority — requirement 22, and requirement 21's single ranking.
   *
   * Two jobs, both centralised here so no other part of the engine decides
   * what matters more than what.
   *
   * First: order the threats. The requested order is the starting point and
   * lives in THREAT_ORDER, but it is a *prior*, not a verdict — the
   * requirement is explicit that measured impact time may override it, and
   * that the closest threat is not automatically the most dangerous. So the
   * ordering is done in tiers:
   *
   *   tier 2  lethal, and landing inside the reaction window
   *   tier 1  lethal, landing later
   *   tier 0  everything else
   *
   * and inside a tier by urgency — severity times confidence, divided by how
   * far away it is. THREAT_ORDER only breaks ties. A musket ball two ticks out
   * that takes the bar therefore outranks a dagger landing this tick that
   * takes a fifth of it, which is the whole point.
   *
   * Second: whether this engine may act at all, against the rest of the
   * client. That comparison runs on RYN's own scale — the placement engine's
   * RPE_PRIORITY classes, read through its own `priorityFor` — so healing,
   * gear and placing are ranked by one authority rather than three.
   * ================================================================== */
  class ThreatPriority {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.ranked = [];
      this.rank = null;
      this.yielded = "";
      this.overrode = "";
    }

    /* Urgency in health-per-tick: how much damage, how sure, how soon. */
    _urgency(severity, confidence, timing, health) {
      const soon = 1 / (1 + Math.max(0, timing === Infinity ? 9 : timing));
      const catastrophic = severity >= health ? 3 : 1;
      return severity * confidence * soon * catastrophic;
    }

    classify(snap, threat, predict, shame, damage, ping) {
      const health = predict.projected;
      const forecast = predict.forecast;
      const reactionTicks = ping.reactionTicks;
      const ranked = [];

      for (const report of threat.reports) {
        /* A rate is converted to what it does in one tick before it is ranked
         * against amounts, and a rate is never "lethal now" however large. */
        const amount = report.rate ? report.severity * (snap.TICK / 1000) : report.severity;
        const effective = amount * (snap.soldierOn ? snap.soldierMult : 1);
        const lethal = !report.rate && effective >= health;
        const imminent = report.timing <= reactionTicks;
        ranked.push({
          report,
          label: report.type,
          base: THREAT_ORDER[report.type] || 0,
          amount,
          severity: effective,
          timing: report.timing,
          lethal,
          tier: lethal ? (imminent ? 2 : 1) : 0,
          urgency: this._urgency(effective, report.value, report.timing, health),
          cls: this.adapter.priorityClass(
            lethal ? "INSTA" : report.rank >= CONFIDENCE_RANK.HIGH ? "DEFENSE" : "RECOVERY"
          ),
          survival: lethal,
          gear: report.gear,
          evadable: report.evadable,
          packets: report.packets
        });
      }

      /* The forecast, as one more candidate. It ranks below anything that has
       * already been observed by construction: its timing is in the future and
       * its confidence is under one, and both divide the urgency. */
      if (forecast.incomingDamage > 0) {
        const lethal = forecast.incomingDamage >= health;
        ranked.push({
          report: null,
          label: "forecast",
          base: 20,
          amount: forecast.incomingDamage,
          severity: forecast.incomingDamage,
          timing: forecast.timing,
          lethal,
          tier: lethal ? (forecast.timing <= reactionTicks ? 2 : 1) : 0,
          urgency: this._urgency(forecast.incomingDamage, forecast.confidence,
            forecast.timing, health),
          cls: this.adapter.priorityClass("ANTICIPATION"),
          survival: lethal,
          gear: GEAR.NONE,
          evadable: false,
          packets: AH.PACKETS_PRESS
        });
      }

      /* Combat's own aggregate, as the floor. If EnemyManager says the number
       * on the board is already lethal, that outranks every detector's opinion
       * about which sequence it belongs to. */
      const imminentNow = typeof threat.imminentWithin === "function"
        ? threat.imminentWithin(1) : threat.effective;
      if (imminentNow >= health && imminentNow > 0) {
        ranked.push({
          report: null,
          label: "critical-survival",
          base: 110,
          amount: imminentNow,
          severity: imminentNow,
          timing: 0,
          lethal: true,
          tier: 2,
          urgency: this._urgency(imminentNow, 1, 0, health) * 10,
          cls: this.adapter.priorityClass("INSTA"),
          survival: true,
          gear: GEAR.SOLDIER,
          evadable: false,
          packets: AH.PACKETS_EQUIP + AH.PACKETS_PRESS * 3
        });
      }

      /* Shame recovery is on the same board as everything else rather than in
       * a branch of its own, so it is ordered by what it is worth rather than
       * by decree. With nothing threatening it is the only thing on the board;
       * with a debt near the ceiling it climbs, because the thing it prevents
       * is thirty seconds of not being able to eat. */
      if (shame.debt > 0) {
        const nearCeiling = shame.count >= AH.SHAME_WARN_HIGH;
        ranked.push({
          report: null,
          label: "shame-recovery",
          base: nearCeiling ? 88 : 10,
          amount: 0,
          severity: 0,
          timing: shame.opportunity.etaTicks,
          lethal: false,
          tier: 0,
          /* Not zero, so it beats "quiet" — and scaled by the debt, so a count
           * of 6 is taken seriously and a count of 1 is housekeeping. */
          urgency: 0.01 + shame.count * (nearCeiling ? 0.5 : 0.05),
          cls: this.adapter.priorityClass(
            shame.count >= AH.SHAME_DEBT_DEFENSIVE ? "DEFENSE" : "UTILITY"
          ),
          survival: false,
          gear: GEAR.NONE,
          evadable: false,
          packets: AH.PACKETS_PRESS
        });
      }

      ranked.sort((a, b) =>
        b.tier - a.tier || b.urgency - a.urgency || b.base - a.base);

      this.ranked = ranked;
      const best = ranked.length ? ranked[0] : {
        label: "quiet", urgency: 0, severity: 0, timing: Infinity, tier: 0, base: 0,
        cls: this.adapter.priorityClass("UTILITY"), survival: false,
        gear: GEAR.NONE, evadable: false, packets: 0, report: null
      };

      /* Say so when the tiering moved something up past a higher-listed
       * threat: it is the interesting line in a trace, and it is the
       * requirement working rather than a bug. */
      this.overrode = "";
      if (ranked.length > 1) {
        for (let i = 1; i < ranked.length; i++) {
          if (ranked[i].base > best.base) {
            this.overrode = `${best.label}@${best.timing} over ${ranked[i].label}@${ranked[i].timing}`;
            break;
          }
        }
      }

      this.rank = best;
      return best;
    }

    /* Every ranked entry asking for defensive gear, worst first. */
    gearCandidates() {
      return this.ranked.filter(r => r.gear !== GEAR.NONE && r.gear !== undefined);
    }

    /* Whether the engine may take this tick, judged on RYN's own priority
     * scale. A heal that answers a lethal burst is an INSTA-class action and
     * outranks a sync; a top-up is UTILITY and yields to almost anything. */
    mayAct(snap, rank) {
      this.yielded = "";
      const sys = snap.systems;

      /* Anti Smart Tick's whole answer to a trap it will not break out of is
       * to eat instead; it presses on this same tick. A second opinion here is
       * just double food, whatever the class. */
      if (sys.antiSmartTick || sys.antiInstaForceHeal) {
        this.yielded = "anti-smart-tick";
        return false;
      }

      /* A system mid-commit. The placement engine sending a batch and a spike
       * tick holding a placement combo are both critical work already under
       * way, and neither has set moduleActive yet, so the ordinary comparison
       * below would not see them. The exception is the one the architecture
       * itself names: RPE_PRIORITY puts DEFENSE above the classes those
       * systems act in, so a heal that genuinely reaches DEFENSE takes the
       * tick. That is the existing arbitration deciding, not a rule of ours. */
      if (sys.placementEngineBusy || sys.spikeTick) {
        if (rank.cls < this.adapter.priorityClass("DEFENSE")) {
          this.yielded = sys.placementEngineBusy ? "placement-engine" : "spike-tick";
          return false;
        }
      }

      if (!snap.moduleActive) return true;

      const theirs = this.adapter.priorityOf(snap.activeModule);
      if (rank.cls > theirs) return true;
      this.yielded = `module:${snap.activeModule || "unknown"}`;
      return false;
    }
  }

  /* ================================================================== *
   * DefensiveGearManager — requirements 23 and 24.
   *
   * One manager, one hat decision per tick, taken from the ranked threat list
   * rather than by each Anti reaching for the hat slot on its own. Nothing
   * else in this engine writes gear.
   *
   * What it may equip, and why those and not others — every answer is from the
   * tables in drivers/game-drivers.json:
   *
   *   Soldier Helmet (6)   dmgMult 0.75. The server applies it inside
   *                        changeHealth (game_index.js:2420), so it is a real
   *                        25% reduction on everything: melee, spike, turret,
   *                        projectile. This is the defensive hat.
   *   Emp Helmet (22)      antiTurret 1. Turrets do not fire at us at all.
   *                        Against a turret stack this removes the threat
   *                        rather than surviving it, which no amount of
   *                        healing does. It costs spdMult 0.7, so it is only
   *                        chosen when the turret half is the bigger half and
   *                        we are not being walked onto a spike.
   *
   * And what it will not equip. Bull Helmet (7) is healthRegen -5 and
   * dmgMultO 1.5: it drains five health a second and multiplies damage we
   * *deal*. It has no defensive property at all, so equipping it in front of
   * an incoming insta would cost health and reduce nothing. The requirement's
   * "Bull Hat -> Turret Gear" and "Turret Gear -> Bull Hat" are the shapes of
   * the *attacker's* sequence, and that is where this engine reads them: the
   * two insta detectors watch for exactly those transitions on the enemy and
   * answer both with the hat that actually reduces the damage. The only bull
   * this engine ever asks for is the shame wash on a quiet field, which is a
   * different thing entirely and goes through ShameOpportunity.
   *
   * Transitions are synchronised rather than instant:
   *
   *   - equipped early enough that the frame lands before the impact, which
   *     is what PingModel.reactionTicks measures;
   *   - held for GEAR_MIN_HOLD_TICKS once on, so a threat that flickers cannot
   *     flap the hat slot;
   *   - released GEAR_RELEASE_TICKS after the last qualifying threat, so we do
   *     not stand around permanently in Soldier (requirement 24) — and a
   *     release is free, because it is simply not re-asserting the claim.
   * ================================================================== */
  class DefensiveGearManager {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.current = null;        // the hat id we are holding, or null
      this.sinceTick = -1;
      this.lastSeenTick = -1;
      this.reason = "";
      this.want = null;
      this.blocked = "";
      this.equips = 0;
      this.holds = 0;
      this.releases = 0;
    }

    /* Which concrete hat answers a requested family, if we own it. */
    _hatFor(family) {
      if (family === GEAR.SOLDIER) return AH.HAT_SOLDIER;
      if (family === GEAR.EMP) return AH.HAT_EMP;
      return null;
    }

    /* The decision. Returns a plan; nothing is sent from here. */
    plan(snap, priority, threat, shame, ping, budget) {
      this.want = null;
      this.blocked = "";
      const none = reason => ({ hat: null, reason, packets: 0, priority: PACKET_PRIORITY.DEFENSIVE });

      if (!this.adapter.gearEnabled) return none("gear-off");
      if (snap.shameActive) return none("shame-lock");

      /* Somebody else already owns the slot this tick. VelocityTick's combo is
       * the one that matters — it needs bull in our hands and contesting it
       * would break a system this engine is not allowed to touch. */
      if (snap.systems.velocityArmed) return none("velocity-tick-owns-hat");

      /* What the board is asking for, worst first. */
      const candidates = priority.gearCandidates();

      /* A module that ran before us already put a hat in the slot — Utility
       * Hat's tank gear for breaking, say. That is a real decision made for a
       * real reason, and taking it away because something might hit us would
       * be exactly the kind of cross-system fight requirement 23 is about. It
       * is overridden for one thing only: a threat that is actually lethal,
       * where surviving outranks whatever the hat was for. */
      const claimedByAnother = snap.forceHat !== null && snap.forceHat !== this.current;
      if (claimedByAnother && !candidates.some(c => c.survival)) {
        this.blocked = "hat-claimed:" + snap.forceHat;
        return none("hat-claimed:" + snap.forceHat);
      }
      let choice = null;
      for (const c of candidates) {
        /* Only threats that are actually going to land inside the window the
         * equip can reach. Anything further out is re-asked next tick, when it
         * is cheaper to be right about. */
        const reachable = c.timing <= ping.reactionTicks + AH.GEAR_MIN_HOLD_TICKS;
        if (!reachable) continue;
        /* And only threats worth a hat: a fifth of the bar or a lethal one.
         * Below that, Soldier's own movement penalty costs more than the
         * damage it saves. */
        const worth = c.lethal || c.severity >= snap.maxHealth * 0.2;
        if (!worth) continue;
        const hat = this._hatFor(c.gear);
        if (hat === null || !this.adapter.ownsHat(hat)) continue;
        /* Emp is a trade, not a free win: it slows us to 0.7 speed
         * (hats[22].spdMult). Refuse it while something is walking us onto a
         * spike, where movement is the thing keeping us alive. */
        if (hat === AH.HAT_EMP) {
          const push = threat.byType[THREAT.SPIKE_PUSH] || threat.byType[THREAT.KB_TICK];
          if (push && push.rank >= CONFIDENCE_RANK.MEDIUM) continue;
        }
        choice = { hat, from: c };
        break;
      }

      const tick = snap.tick;
      if (choice) {
        this.want = choice.hat;
        this.lastSeenTick = tick;
        const cost = this.adapter.hatChangeCost(choice.hat);
        /* A change we cannot pay for is not a change. The claim is still made
         * when the cost is zero — that is the hold, and it is what stops
         * anything later in the tick taking the slot back. */
        if (cost > 0 && !budget.canSend(cost, PACKET_PRIORITY.DEFENSIVE)) {
          this.blocked = "no-packet-budget";
          return none("gear-blocked:no-packets");
        }
        return {
          hat: choice.hat,
          reason: `${choice.from.label}@${choice.from.timing}t:${choice.from.report
            ? choice.from.report.confidence : "aggregate"}`,
          packets: cost,
          priority: choice.from.survival ? PACKET_PRIORITY.EMERGENCY : PACKET_PRIORITY.DEFENSIVE,
          from: choice.from
        };
      }

      /* Nothing is asking. Hold what we have for the minimum, then let go —
       * requirement 24: the defensive hat is not the resting state. */
      if (this.current !== null) {
        const held = tick - this.sinceTick;
        const quiet = tick - this.lastSeenTick;
        if (held < AH.GEAR_MIN_HOLD_TICKS || quiet < AH.GEAR_RELEASE_TICKS) {
          const cost = this.adapter.hatChangeCost(this.current);
          return {
            hat: this.current,
            reason: `hold:${held}t`,
            packets: cost,
            priority: PACKET_PRIORITY.DEFENSIVE
          };
        }
      }
      return none("no-threat-needs-gear");
    }

    /* Book-keeping after the claim actually went out. */
    commit(snap, plan, sent) {
      if (!plan || plan.hat === null) {
        if (this.current !== null) {
          this.releases += 1;
          this.current = null;
          this.sinceTick = -1;
          this.reason = "";
        }
        return;
      }
      if (this.current !== plan.hat) {
        this.current = plan.hat;
        this.sinceTick = snap.tick;
        this.equips += 1;
      } else {
        this.holds += 1;
      }
      this.reason = plan.reason;
      if (sent === 0) this.holds += 0;
    }
  }

  /* ================================================================== *
   * EvasionPlanner — requirement 10.
   *
   * A projectile is the one threat in this game that can be answered by not
   * being there. It travels in a straight line at a known speed (the
   * projectile tables), the client has already established that it is on a
   * line to us, and the hit test is a radius sum — so "will it hit" and "how
   * far do I have to move" are both arithmetic rather than judgement.
   *
   * The rules the requirement sets are the rules here, in order:
   *
   *   - smallest practical movement, and only perpendicular to the shot,
   *     because that is the direction that costs the least distance;
   *   - only when it can actually be completed in time, which is measured
   *     against our own last-tick travel and the ping-aware reaction window;
   *   - never into a spike, a trap, another projectile's line, or an enemy's
   *     melee reach;
   *   - never at all when the shot already misses;
   *   - and if it cannot be dodged safely, say so and let the heal engine and
   *     the gear manager answer it instead.
   *
   * It is temporary and reversible for free: RYN's movement contract resets
   * `ModuleHandler.moveTo` to "disable" at the top of every tick, and SafeWalk
   * sends the player's own key direction again the moment it changes back. So
   * a dodge is one packet out, one packet back, and it lasts exactly one tick
   * unless it is re-asked.
   * ================================================================== */
  class EvasionPlanner {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.last = null;
      this.lastTick = -999;
      this.dodges = 0;
      this.refusals = [];
    }

    /* The travel a player reaches in one tick at the game's own terminal
     * speed: acceleration over the decay, times the tick. */
    terminalPerTick(snap) {
      const config = this.adapter.Config;
      const accel = (config && num(config.playerSpeed)) || 0.0016;
      const decel = (config && num(config.playerDecel)) || 0.993;
      return (accel / Math.max(1e-4, 1 - decel)) * (snap.TICK || AH.TICK_MS);
    }

    plan(snap, threat, priority, ping, budget) {
      this.refusals = [];
      const none = reason => { this.refusals.push(reason); return null; };

      if (!this.adapter.evadeEnabled) return none("evade-off");
      if (!snap.pos) return none("no-position");
      /* Movement is claimed by whoever asked first, and several RYN systems
       * ask: Auto Push, Velocity Tick, Dash. If one of them has the slot, the
       * dodge is not ours to make. */
      if (snap.moveClaimed || this.adapter.moveClaimed()) return none("move-claimed");

      const projectiles = threat.lastProjectiles || [];
      if (!projectiles.length) return none("nothing-in-air");

      /* The shot that matters: soonest, still coming, and actually on us. */
      let target = null;
      for (const p of projectiles) {
        if (p.along <= 0) continue;                       // already past us
        if (p.perpendicular > p.hitRadius) continue;      // geometry says it misses
        if (p.ticksToImpact > AH.EVADE_MAX_LEAD_TICKS) continue;
        if (!target || p.ticksToImpact < target.ticksToImpact) target = p;
      }
      if (!target) return none("no-shot-on-line");

      /* Can a move sent now beat it? The frame has to cross the wire, and the
       * displacement has to happen after that. */
      if (target.ticksToImpact < AH.EVADE_MIN_LEAD_TICKS) return none("too-late");
      if (!ping.canReach(target.ticksToImpact, snap)) return none("ping-too-high");

      /* How far off the line we have to be, and how far we can travel in the
       * time left. `speed` is last tick's measured travel, so this is what we
       * actually move, not what the config says we could. */
      const need = target.hitRadius - target.perpendicular + AH.EVADE_MARGIN_PX;
      const ticksAvailable = Math.max(0, target.ticksToImpact - ping.reactionTicks + 1);
      /* What we can cover per tick. `speed` is last tick's measured travel and
       * is the honest number while we are moving; standing still it is zero,
       * which is not the same as "cannot move". The floor is the game's own
       * terminal speed — acceleration config.playerSpeed against the same
       * per-millisecond decay, so v = playerSpeed / (1 - playerDecel) — taken
       * at half, because a standing start spends the window accelerating into
       * it rather than travelling at it. */
      const perTick = Math.max(snap.speed || 0, this.terminalPerTick(snap) * 0.5);
      const reach = perTick * ticksAvailable;
      if (reach <= 0) return none("cannot-move");
      if (need > reach) return none(`cannot-clear:${Math.round(need)}>${Math.round(reach)}`);

      /* Two candidates, perpendicular to the shot in each direction. The
       * smallest practical movement is the perpendicular one: anything else
       * covers the same lateral distance over a longer path. */
      const options = [target.angle + Math.PI / 2, target.angle - Math.PI / 2];
      const step = Math.min(reach, need + AH.EVADE_MARGIN_PX);
      let best = null;
      for (const angle of options) {
        const x = snap.pos.x + Math.cos(angle) * step;
        const y = snap.pos.y + Math.sin(angle) * step;
        const verdict = this._safe(snap, threat, x, y, target);
        if (verdict !== true) { this.refusals.push(`${Math.round(angle * 57.3)}:${verdict}`); continue; }
        /* Prefer the side that moves us away from the nearest enemy rather
         * than across their face. */
        let score = 0;
        for (const e of threat.lastEnemies || []) {
          if (e.distance > 400) continue;
          score += Math.hypot(x - e.pos.x, y - e.pos.y) - e.distance;
        }
        if (!best || score > best.score) best = { angle, x, y, score };
      }
      if (!best) return none("no-safe-side");

      if (!budget.canSend(AH.PACKETS_MOVE, PACKET_PRIORITY.DEFENSIVE)) {
        return none("no-packet-budget");
      }

      return {
        angle: best.angle,
        packets: AH.PACKETS_MOVE,
        priority: PACKET_PRIORITY.DEFENSIVE,
        reason: `dodge ${target.isTurret ? "turret" : "shot"}:` +
          `${target.ticksToImpact}t need ${Math.round(need)} reach ${Math.round(reach)}`
      };
    }

    /* Everything the requirement forbids moving into, asked at the
     * destination. Two probes a tick at most, each a bounded grid query. */
    _safe(snap, threat, x, y, incoming) {
      const hazard = this.adapter.hazardAt(x, y, snap.scale + AH.EVADE_SAFETY_PAD_PX);
      if (hazard) return hazard;

      /* Into somebody's reach. */
      for (const e of threat.lastEnemies || []) {
        const reach = Math.max(e.primaryRange, e.secondaryRange);
        if (reach <= 0) continue;
        const after = Math.hypot(x - e.pos.x, y - e.pos.y);
        if (after < reach + AH.EVADE_SAFETY_PAD_PX && after < e.distance) return "melee-range";
      }

      /* Into another shot's line. */
      for (const p of threat.lastProjectiles || []) {
        if (p === incoming) continue;
        if (p.along <= 0) continue;
        const dx = x - p.ref.pos.current.x, dy = y - p.ref.pos.current.y;
        const perpendicular = Math.abs(-Math.sin(p.angle) * dx + Math.cos(p.angle) * dy);
        if (perpendicular <= p.hitRadius + AH.EVADE_SAFETY_PAD_PX) return "other-projectile";
      }

      /* Off a healing pad we are standing on. The pad is 15 health a second
       * (items[19].healCol) and stepping off it to dodge an arrow worth 25 is
       * a bad trade twice over. A pad is scale 45, so a step longer than that
       * leaves it. */
      if (this.adapter.healingPadRegen(snap) > 0 &&
          Math.hypot(x - snap.pos.x, y - snap.pos.y) > AH.HEAL_PAD_SCALE) {
        return "leaves-healing-pad";
      }
      return true;
    }

    commit(snap, plan) {
      this.last = plan;
      this.lastTick = snap.tick;
      this.dodges += 1;
    }
  }

  /* ================================================================== *
   * AntiSpamManager — the in-flight ledger, the duplicate guard and the
   * backoff. Requirement 26's "no duplicate heal requests" lives here.
   * ================================================================== */
  class AntiSpamManager {
    constructor() { this.reset(); }

    reset() {
      this.entries = [];
      this.backoffUntilTick = -1;
      this.deadPresses = 0;
      this.pressedTotal = 0;
      this.judgedPressTick = -1;
      this.pendingAction = null;
      this.duplicatesBlocked = 0;
    }

    /* The identity of an action, so the same one is never sent twice while the
     * first is still in the air. Two presses of the same food aiming at the
     * same bar are the same action; a press aiming higher because more damage
     * landed is a different one. */
    static signature(plan, snap, target) {
      return `heal:${snap.foodId}:${Math.round(target / 5) * 5}:${plan.urgency}`;
    }

    isPending(signature, snap) {
      const p = this.pendingAction;
      if (!p) return false;
      if (p.signature !== signature) return false;
      if (snap.tick - p.tick > this.visibleTicks(snap)) return false;
      return !p.resolved;
    }

    notePending(signature, snap, presses, expect) {
      this.pendingAction = { signature, tick: snap.tick, presses, expect, resolved: false };
    }

    resolvePending(snap, state) {
      const p = this.pendingAction;
      if (!p) return;
      if (state.healLandedThisTick) { p.resolved = true; return; }
      if (snap.tick - p.tick > this.visibleTicks(snap)) this.pendingAction = null;
    }

    /* How many ticks pass before a press sent now shows up in the health this
     * client reads: one tick for the server to process it, plus half a round
     * trip each way. At a normal ping that is one tick; at 250ms it is three,
     * and an engine that forgets its presses after one tick spends the
     * difference pressing again into food it has already eaten. */
    visibleTicks(snap) {
      const legs = Math.round((snap.pong / 2) / (snap.TICK || AH.TICK_MS));
      return AH.INFLIGHT_TTL_TICKS + 2 * Math.max(0, legs);
    }

    expectedHeal(snap) {
      const ttl = this.visibleTicks(snap);
      let sum = 0;
      for (const e of this.entries) {
        if (snap.tick - e.tick > ttl) continue;
        sum += e.expect;
      }
      return sum;
    }

    /* What an earlier tick's presses are worth in the health being read right
     * now — the term that makes damage hidden under a heal visible. */
    landedExpectation(snap) {
      const age = this.visibleTicks(snap);
      let sum = 0;
      for (const e of this.entries) {
        if (snap.tick - e.tick === age) sum += e.expect;
      }
      return sum;
    }

    update(snap, state) {
      this.resolvePending(snap, state);
      if (state.healLandedThisTick) {
        this.entries.length = 0;
        this.deadPresses = 0;
        this.backoffUntilTick = -1;
      } else {
        const ttl = this.visibleTicks(snap);
        this.entries = this.entries.filter(e => snap.tick - e.tick <= ttl);
      }
    }

    /* A press that should have healed and did not means the server is refusing
     * food — no resources, a lock we have not noticed, or a hat we cannot eat
     * in. Asking again every tick is how a client burns its whole packet
     * budget on nothing. */
    noteOutcome(snap, state, expectedHeal) {
      if (!expectedHeal) return;
      if (state.healLandedThisTick) {
        this.deadPresses = 0;
        this.backoffUntilTick = -1;
        return;
      }
      if (snap.tick - state.lastPressTick > this.visibleTicks(snap) && state.lastPressTick > 0 &&
          this.judgedPressTick !== state.lastPressTick) {
        this.judgedPressTick = state.lastPressTick;
        this.deadPresses += 1;
        if (this.deadPresses >= AH.DEAD_PRESS_LIMIT) {
          const n = this.deadPresses - AH.DEAD_PRESS_LIMIT;
          const wait = Math.min(AH.BACKOFF_MAX_TICKS, AH.BACKOFF_BASE_TICKS * Math.pow(2, n));
          this.backoffUntilTick = snap.tick + wait;
        }
      }
    }

    backedOff(snap) { return snap.tick < this.backoffUntilTick; }

    notePress(snap, expect) {
      this.entries.push({ tick: snap.tick, expect });
      this.pressedTotal += 1;
    }
  }

  /* ================================================================== *
   * HealValueModel — what things are worth, in health.
   *
   * One health point is one point. Everything else is priced against it, and
   * every price is anchored to something the game actually does:
   *
   *   - dying costs the whole bar and the run that produced it, so it is worth
   *     several bars, not one;
   *   - food costs nothing while you have plenty and a great deal when you are
   *     nearly out, because what it really costs is the next heal you cannot
   *     make;
   *   - a packet costs nothing until the budget is tight, at which point it
   *     costs the placement engine its tick;
   *   - a shame charge costs two things: the option it consumes, which is
   *     convex in the count, *and* leaving the target state at all, which is
   *     flat and is the price of the objective (requirement 1). Without that
   *     second term a charge at count 0 prices at six points and every
   *     exchange spends one; with it, a charge has to buy real health to be
   *     worth taking, which is what keeps the count at zero.
   * ================================================================== */
  class HealValueModel {
    constructor(adapter) { this.adapter = adapter; }

    lifeValue(snap) { return snap.maxHealth * 3; }

    foodValue(snap) {
      if (snap.sandbox) return 0;
      const cost = snap.foodCost || 0;
      if (!cost) return 0;
      const pressesLeft = snap.foodStock / cost;
      if (pressesLeft >= 8) return 0;
      return (8 - pressesLeft) * 4;
    }

    /* Per press, and only real when the budget is tight enough that spending
     * frames costs somebody else their tick. The numbers come from the budget
     * rather than from the snapshot, so a reservation somebody else holds is
     * visible here as a price. */
    packetValue(snap, budget) {
      const spare = budget.free() - budget.externalReserve - budget.reservedTotal();
      if (spare >= AH.PACKETS_PRESS * 4) return 0;
      if (spare <= 0) return this.lifeValue(snap);      // effectively forbidden
      return (AH.PACKETS_PRESS * 4 - spare) * 3;
    }

    /* The price of a charged press at count c.
     *
     * Two terms. The convex one is the option it consumes: at count c there
     * are (7 - c) charges left before a press stops healing at all, so the
     * last one is worth nearly a life. The flat one is the objective itself —
     * the count is supposed to be zero, and a charge is what takes it off
     * zero, whatever the count happens to be. */
    shamePenalty(snap, count) {
      const budget = Math.max(0, AH.SHAME_MAX - count);
      /* At the ceiling the press is forbidden outright, and that is enforced
       * as a constraint before anything is priced — so the price here only has
       * to dominate every other term, not be infinite. Infinity would be the
       * honest number and a terrible one: it makes the comparison arithmetic
       * produce NaN the moment it meets a zero probability, and a NaN loses
       * every comparison it is in. */
      if (budget <= 0) return this.lifeValue(snap) * 4;
      const option = this.lifeValue(snap) / (budget * budget);
      const target = this.lifeValue(snap) * 0.08;
      return option + target;
    }

    /* What a credit press is worth: the options it hands back, plus getting
     * back to target if it is what closes the debt. */
    creditValue(snap, count) {
      if (count <= AH.SHAME_TARGET) return 0;
      const after = Math.max(0, count - AH.SHAME_CREDIT);
      return this.shamePenalty(snap, count) - this.shamePenalty(snap, after);
    }

    /* Health a press actually delivers, which is not the same as its restore:
     * anything over the cap is thrown away (game_index.js:2418). */
    healthGain(presses, restore, from, max) {
      return Math.max(0, Math.min(presses * restore, max - from));
    }

    now(ctx, candidate) {
      const { snap, shame, verdict } = ctx;
      const gain = this.healthGain(candidate.presses, snap.restore, ctx.health, snap.maxHealth);
      const food = this.foodValue(snap) * candidate.presses;
      const packets = this.packetValue(snap, ctx.budget) * candidate.presses;
      const charge = verdict === VERDICT.CHARGED
        ? this.shamePenalty(snap, shame.chargeSafeCount(snap)) : 0;
      const credit = verdict === VERDICT.CREDIT
        ? this.creditValue(snap, shame.count) : 0;
      const survival = ctx.lethalNow && gain > 0
        ? this.lifeValue(snap) * ctx.lethalConfidence : 0;
      const total = gain + credit + survival - food - packets - charge;
      return { total, gain, credit, survival, food, packets, charge };
    }

    /* Pressing on the next tick instead. The heal itself does not go away —
     * that is the whole point of the comparison — so what differs is the shame
     * arithmetic, the risk taken while waiting, and how much of the restore is
     * still wasted once the incoming damage has landed. */
    wait(ctx, candidate) {
      const { snap, damage, shame } = ctx;
      /* Damage expected inside the wait, and whether it lands at all. Being
       * pinned changes that answer rather than the damage: a pit trap holds
       * you where you are, so the swing that is coming is one you cannot walk
       * out of. */
      let pHit = clamp(damage.damageFrequency * (snap.TICK / 1000), 0, 1);
      if (ctx.trapped) pHit = Math.max(pHit, 0.9);
      const incoming = ctx.imminent;
      const healthThen = Math.max(0, ctx.health - incoming * pHit + ctx.regenPerTick);
      const gain = this.healthGain(candidate.presses, snap.restore, healthThen, snap.maxHealth);
      const food = this.foodValue(snap) * candidate.presses;
      const packets = this.packetValue(snap, ctx.budget) * candidate.presses;

      /* What the shame arithmetic does to a press deferred by one tick, which
       * is the whole reason waiting is ever worth anything.
       *
       * A charged press becomes a credit press — but only if no new damage
       * refreshes the stamp in the meantime, and the measured hit frequency is
       * what says how likely that is. Under damage every tick the window never
       * opens and `converts` goes to zero on its own.
       *
       * A press that is already a credit has the opposite exposure: waiting
       * risks *losing* it, because a fresh hit restamps hitTime and the next
       * press is charged again. That term is what stops the model sitting on a
       * credit forever congratulating itself. */
      let credit = 0, chargeAvoided = 0, chargeRisk = 0, converts = 0;
      if (ctx.verdict === VERDICT.CHARGED) {
        converts = 1 - pHit;
        credit = converts * this.creditValue(snap, shame.count);
        chargeAvoided = converts * this.shamePenalty(snap, shame.chargeSafeCount(snap));
      } else if (ctx.verdict === VERDICT.CREDIT) {
        credit = (1 - pHit) * this.creditValue(snap, shame.count);
        chargeRisk = pHit * this.shamePenalty(snap, shame.chargeSafeCount(snap));
      }

      const dies = ctx.health - incoming <= 0;
      const risk = dies ? this.lifeValue(snap) * ctx.lethalConfidence * pHit : 0;

      /* The shame the forecast says the wait will cost. The predictive engine
       * has already worked out what the coming hit does to the count: if it
       * lands on a bar too low to ignore, the heal that answers it is the first
       * press after a fresh stamp, and that press is a charge. Buying the
       * buffer now, while the window is free, is what stops that charge from
       * ever being needed. */
      const forecast = ctx.forecast;
      const futureCharge = forecast && forecast.expectedShameDelta > 0 && gain > 0
        ? forecast.expectedShameDelta *
          this.shamePenalty(snap, shame.chargeSafeCount(snap)) *
          clamp(forecast.confidence, 0, 1)
        : 0;

      /* The price of not taking a way down that is open right now.
       *
       * Requirement 3: a debt is repaid at the first opportunity, not at the
       * first convenient one. Without this term the two sides tie exactly
       * whenever the field is quiet — pressing banks -2, waiting keeps a -2
       * that nothing is threatening — and a tie means WAIT, so the count sits
       * where it is for the rest of the fight while the engine reports that it
       * is about to fix it.
       *
       * It is not a fudge factor: the credit is attached to one hit stamp, the
       * next hit overwrites that stamp, and every tick spent off target is a
       * tick in which a forced charge starts nearer the ceiling. Deferring a
       * credit genuinely costs a share of what it is worth. */
      const deferredDebt = ctx.verdict === VERDICT.CREDIT && shame.debt > 0
        ? this.shamePenalty(snap, shame.count) * 0.25 : 0;

      const total = gain + credit + chargeAvoided
        - food - packets - risk - chargeRisk - futureCharge - deferredDebt;
      return {
        total, gain, credit, chargeAvoided, chargeRisk, risk, futureCharge,
        deferredDebt, converts, pHit
      };
    }
  }

  /* ================================================================== *
   * HealDecisionEngine — is healing now worth more than healing later?
   *
   * Not "HP below X, eat". A threshold cannot answer the question this engine
   * faces, because the same 40 health is worth wildly different amounts
   * depending on what it costs: at shame 0 with a full larder a press is
   * nearly free, and at shame 6 the same press spends the last charge standing
   * between us and a thirty-second lock.
   *
   * So every candidate is priced, in health-equivalent points, twice: once for
   * pressing now and once for pressing on the next tick instead. The larger
   * number wins, and the reason it won is the reason reported.
   *
   * Above the pricing sit two constraints, because some things are not trades:
   * the press that reaches shame 8 must never leave, and a charged press
   * outside survival must never leave either (requirement 1). Constraints
   * first, arithmetic second.
   * ================================================================== */
  class HealDecisionEngine {
    constructor(adapter) {
      this.adapter = adapter;
      this.value = new HealValueModel(adapter);
    }

    plan(snap, state, damage, shame, threat, predict, cooldown, priority, ping, budget, rank) {
      const restore = snap.restore;
      const max = snap.maxHealth;
      const health = predict.projected;
      const verdict = shame.verdictNow;
      const reserve = this.adapter.reserveHealth;
      const forecast = predict.forecast;

      /* ---- hard constraints, before any arithmetic ------------------ */
      if (shame.locked) {
        return this._plan(DECISION.CANCEL, URGENCY.BLOCKED, 0, 0,
          "shame-lock: food is refused for the whole 30s", verdict, rank);
      }

      /* Healing at full health does nothing at all (game_index.js:2418), so no
       * amount of predicted damage makes a press worth sending while the bar
       * is still full. Shame recovery is the exception: there the point is the
       * -2, and at full health it does not even cost food. */
      const canHeal = snap.health < max;

      if (!priority.mayAct(snap, rank)) {
        return this._plan(DECISION.CANCEL, URGENCY.BLOCKED, 0, 0,
          `yield:${priority.yielded}`, verdict, rank);
      }

      /* The one press that must never be sent: at the ceiling a charged press
       * arms the lock *before* consume is reached, so it does not heal either
       * (game_index.js:2465-2469). No price can make that trade good, which is
       * why it is a constraint and not a term. */
      if (shame.chargeSafeCount(snap) >= AH.SHAME_MAX && verdict === VERDICT.CHARGED) {
        return this._plan(DECISION.WAIT, URGENCY.LOCKGUARD, 0, shame.msUntilCredit,
          "lockguard: a charged press at 7 arms the lock and heals nothing",
          verdict, rank);
      }

      /* ---- the candidate this situation calls for -------------------- */
      const defensiveBias = shame.critical ? reserve
        : shame.approachingCritical ? reserve / 2 : 0;
      const floor = Math.min(max, threat.effective + reserve + defensiveBias);
      const candidate = this._candidate(
        snap, damage, shame, threat, predict, rank, canHeal, floor, restore, max, health, verdict
      );
      if (!candidate) {
        return this._plan(DECISION.WAIT, URGENCY.IDLE, 0, 0,
          canHeal ? "nothing worth pressing for" : "at full health", verdict, rank);
      }
      if (candidate.prepare) {
        return this._plan(DECISION.PREPARE, URGENCY.RECOVER, 0, 0,
          candidate.reason, verdict, rank, { wantBull: true });
      }

      /* ---- the charge policy (requirement 1) ------------------------- *
       *
       * This is the rule that keeps the count at zero, and it runs before the
       * pricing rather than inside it, because "the count is supposed to be 0"
       * is not a number to be outbid. A charged press leaves only when the
       * wait costs health we cannot buy back. */
      if (verdict === VERDICT.CHARGED) {
        const waitMs = shame.msUntilCredit || snap.TICK;
        const survival = rank.survival &&
          !predict.survivesHold(snap, damage, threat, waitMs);
        /* The floor the charge gate asks about is the *reserve*, not the
         * sustain floor above.
         *
         * The sustain floor is `threat + reserve` and it is the right target
         * for a press: it is the bar we want to be at so the next exchange
         * does not reach us. It is the wrong question for a charge, because
         * holdsAboveFloor already subtracts the incoming damage — asking it
         * against a floor that also contains the incoming damage counts the
         * threat twice, and a gate that counts the threat twice says yes to
         * almost every exchange. That is exactly how a shame guard ends up
         * walking the count to seven while believing it is being careful.
         *
         * So: a charge is bought only when waiting would leave the bar under
         * the reserve — that is, with no room left to answer anything. */
        const chargeFloor = Math.min(max, this.adapter.reserveHealth);
        const belowFloorAfterWait =
          !predict.holdsAboveFloor(snap, damage, threat, waitMs, chargeFloor);
        const gate = shame.mayCharge(snap, { survival, belowFloorAfterWait });
        if (!gate.ok) {
          return this._plan(DECISION.WAIT, URGENCY.LOCKGUARD, 0, waitMs,
            `shame-target-0: ${gate.why} (count ${shame.count})`, verdict, rank);
        }
        candidate.chargeReason = gate.why;
      }

      /* ---- the packet budget (requirements 26 to 28) ----------------- *
       *
       * One ledger, asked once, with this action's own priority. A lethal
       * threat has already reserved what its answer needs; anything cheaper
       * sees a budget with that reservation taken out. */
      const packetPriority = rank.survival ? PACKET_PRIORITY.EMERGENCY
        : candidate.urgency >= URGENCY.SUSTAIN ? PACKET_PRIORITY.DEFENSIVE
        : candidate.urgency === URGENCY.RECOVER ? PACKET_PRIORITY.SHAME
        : PACKET_PRIORITY.NORMAL;
      /* The tag has to be the one the reservation was booked under, or the
       * emergency response would be refused the frames reserved for it. */
      const tag = packetPriority >= PACKET_PRIORITY.EMERGENCY ? "lethal" : "heal";
      const affordable = budget.pressesFor(tag, candidate.presses, packetPriority);
      if (affordable <= 0) {
        return this._plan(DECISION.CANCEL, URGENCY.BLOCKED, 0, 0,
          "no packet budget left after reservations", verdict, rank);
      }
      candidate.presses = Math.min(candidate.presses, affordable, AH.MAX_PRESSES_PER_TICK);

      /* ---- now, or next tick? --------------------------------------- */
      const ctx = {
        snap, damage, shame, verdict, health, budget,
        forecast,
        trapped: !!snap.isTrapped,
        regenPerTick: predict.regenPerSecond / AH.DOT_PERIOD_TICKS,
        imminent: typeof threat.imminentWithin === "function"
          ? threat.imminentWithin(1) : threat.effective,
        lethalNow: rank.survival,
        lethalConfidence: rank.survival
          ? Math.max(threat.confidence, forecast.confidence, 0.5) : 0
      };
      const now = this.value.now(ctx, candidate);
      const wait = this.value.wait(ctx, candidate);

      /* Survival is not a term to be outbid. If waiting kills us, the shame
       * arithmetic does not get a vote — which is the rule that healing must
       * never be sacrificed to keep the count at zero, stated as code. */
      const waitIsFatal = rank.survival &&
        !predict.survivesHold(snap, damage, threat, shame.msUntilCredit || snap.TICK);

      if (waitIsFatal) {
        return this._plan(DECISION.HEAL_NOW, URGENCY.CRITICAL, candidate.presses, 0,
          `survival: waiting loses ${Math.round(this.value.lifeValue(snap))} to save ` +
          `${Math.round(now.charge)} of shame`, verdict, rank,
          { values: { now, wait }, packetPriority });
      }

      if (now.total > wait.total) {
        return this._plan(DECISION.HEAL_NOW, candidate.urgency, candidate.presses, 0,
          `${candidate.label}: now ${Math.round(now.total)} > wait ${Math.round(wait.total)}`,
          verdict, rank, { values: { now, wait }, packetPriority });
      }

      const holdable = cooldown.mayHold(snap, shame);
      if (!holdable && canHeal && candidate.presses > 0 && verdict !== VERDICT.CHARGED) {
        /* The hold has run out. Press anyway rather than stall forever — the
         * failure mode a shame guard has to avoid is refusing to eat at all.
         * A charged press is excluded: the policy above already decided that
         * one, and a timeout is not a reason to overrule it. */
        return this._plan(DECISION.HEAL_NOW, candidate.urgency, candidate.presses, 0,
          `${candidate.label}: hold expired, pressing at ${Math.round(now.total)}`,
          verdict, rank, { values: { now, wait }, packetPriority });
      }
      const why = wait.converts > 0
        ? `credit worth ${Math.round(wait.credit + wait.chargeAvoided)} beats pressing at ` +
          `${Math.round(now.total)}`
        : `wait ${Math.round(wait.total)} >= now ${Math.round(now.total)}`;
      return this._plan(DECISION.WAIT, candidate.urgency, 0, shame.msUntilCredit || snap.TICK,
        `${candidate.label}: ${why}`, verdict, rank, { values: { now, wait } });
    }

    /* Which shape of press this situation calls for. The candidate carries the
     * target it fills to and the urgency class it reports as; the value model
     * decides whether it happens at all.
     *
     * The order is deliberate and is the survival model of requirement 35:
     * stay alive, then stay above the floor, then get ahead of what is coming,
     * then pay the shame debt down, then top up. */
    _candidate(snap, damage, shame, threat, predict, rank, canHeal, floor,
      restore, max, health, verdict) {
      const forecast = predict.forecast;

      /* Survival and sustain both fill to the top when the press is charged,
       * because a charge is paid once per damage event however many presses
       * follow it (game_index.js:2461-2463) — the first press clears hitTime
       * and every press behind it in the same burst is free. Batching is
       * therefore not an optimisation, it is the only way a forced charge
       * costs one point instead of several. */
      const chargedBurst = verdict === VERDICT.CHARGED;

      if (canHeal && rank.survival) {
        const presses = predict.healsNeeded(max, restore);
        if (presses > 0) return { label: "survival", urgency: URGENCY.CRITICAL, presses };
      }
      if (canHeal && health < floor) {
        const presses = predict.healsNeeded(
          chargedBurst ? max : Math.min(max, floor + restore), restore
        );
        if (presses > 0) return { label: "sustain", urgency: URGENCY.SUSTAIN, presses };
      }
      /* Ahead of the bar: something credible lands soon and would leave us
       * under the floor the moment it does. */
      if (canHeal && forecast.incomingDamage > 0 &&
          forecast.timing <= AH.PREEMPT_HORIZON_TICKS &&
          forecast.level !== CONFIDENCE.LOW) {
        const futureFloor = Math.min(max, forecast.incomingDamage + floor);
        if (forecast.expectedHealth < futureFloor) {
          /* To be above the floor *after* the hit, the bar has to be that much
           * higher *before* it — the incoming damage is added, not compared
           * against. Targeting the floor itself asks for a press whenever the
           * bar is already over it, which is a press of nothing. */
          const target = Math.min(max, futureFloor + forecast.incomingDamage);
          const presses = predict.healsNeeded(target, restore);
          if (presses > 0) return { label: "preempt", urgency: URGENCY.PREEMPT, presses };
        }
      }

      /* The way back to zero (requirements 1 and 3). A credit press is worth
       * -2 whether or not it heals, and at full health it costs no food at all,
       * so this is taken the moment it is available rather than when the count
       * gets uncomfortable. If there is healing to do as well, the same press
       * does both: the first press takes the credit, the rest of the burst is
       * free of shame either way. */
      const wash = shame.planWash();
      if (wash === "natural") {
        const heal = canHeal ? predict.healsNeeded(Math.min(max, floor + restore), restore) : 0;
        return { label: "recover", urgency: URGENCY.RECOVER, presses: Math.max(1, heal) };
      }
      if (wash === "bull") {
        return { prepare: true, reason: "prepare: bull hat to manufacture a hit to wash" };
      }

      if (canHeal) {
        /* Ordinary top-up. The food-economy rule stands at shame 0 and relaxes
         * while a debt is owed, because then the press buys the credit too. */
        const gap = max - health;
        const worthCredit = !shame.onTarget && verdict === VERDICT.CREDIT;
        const believable = threat.effective > 0 && shame.predictor.actionable;
        if (gap >= restore || !damage.underFire || worthCredit || believable) {
          const presses = predict.healsNeeded(max, restore);
          if (presses > 0) return { label: "topup", urgency: URGENCY.TOPUP, presses };
        }
      }
      return null;
    }

    _plan(decision, urgency, presses, holdMs, reason, verdict, rank, extra) {
      return Object.assign({
        decision, urgency, presses, holdMs, reason, verdict,
        rank: rank || null,
        packetPriority: PACKET_PRIORITY.NORMAL
      }, extra || {});
    }
  }

  /* ================================================================== *
   * ActionValidator — refuse what the server would refuse or punish.
   * ================================================================== */
  class ActionValidator {
    constructor(adapter) { this.adapter = adapter; }

    check(plan, snap, shame, budget) {
      if (!plan.presses && !plan.wantBull) return plan;

      const fail = reason => Object.assign({}, plan, {
        urgency: URGENCY.BLOCKED, presses: 0, wantBull: false,
        decision: DECISION.CANCEL, reason
      });

      if (!snap.inGame) return fail("invalid:not-in-game");
      if (snap.foodId === null || !snap.restore) return fail("invalid:no-food-item");

      /* game_index.js:2462 — a noEat skin refuses food outright, and the Shame
       * hat is the server telling us the lock is on. */
      if (snap.noEat) return fail("invalid:noeat-hat");
      if (shame.locked) return fail("invalid:shame-lock");

      /* game_index.js:2496 — canBuild checks hasRes first, and a press that
       * fails it changes nothing at all, not even the shame count. Sandbox
       * skips the cost. */
      if (!snap.sandbox && snap.foodStock < snap.foodCost) return fail("invalid:no-food");

      /* A press at full health heals nothing (game_index.js:2418). It is only
       * ever worth sending as a shame recovery, where the point is the -2 and
       * where it also costs no food. */
      if (snap.health >= snap.maxHealth && plan.urgency !== URGENCY.RECOVER) {
        return fail("invalid:full-health");
      }

      /* The hard packet cap, checked against the live counter. */
      const frames = plan.presses * AH.PACKETS_PRESS_BODY + AH.PACKETS_PRESS_RESTORE;
      if (!budget.canSend(frames, plan.packetPriority || PACKET_PRIORITY.NORMAL)) {
        return fail("invalid:packet-limit");
      }
      return plan;
    }

    /* ---- final validation, immediately before the wire ---------------- *
     *
     * The plan was made against a snapshot taken at the top of the tick. This
     * runs against the state as it is at the moment of pressing, and it checks
     * everything the decision leaned on rather than only the shame count.
     *
     * The distinction between the two answers matters. CANCEL means the action
     * was wrong and should not be retried as-is. RECALCULATE means the world
     * moved and the same question deserves a fresh answer. */
    final(plan, snap, state, shame, threat, predict, ledger, live) {
      const stop = (decision, reason) => ({ ok: false, decision, reason, presses: 0 });
      if (!live) return stop(DECISION.RECALCULATE, "no-live-state");

      if (!live.inGame) return stop(DECISION.CANCEL, "not-in-game");
      if (live.noEat) return stop(DECISION.CANCEL, "noeat-hat");
      if (live.trapped !== !!snap.isTrapped) return stop(DECISION.RECALCULATE, "trapped-changed");

      if (live.active) return stop(DECISION.CANCEL, "shame-lock");

      if (live.foodId === null || !live.restore) return stop(DECISION.CANCEL, "no-food-item");
      if (live.foodId !== snap.foodId) return stop(DECISION.RECALCULATE, "food-changed");
      if (!snap.sandbox && live.foodStock < live.foodCost) return stop(DECISION.CANCEL, "no-food");

      if (typeof live.health === "number") {
        if (live.health >= snap.maxHealth && plan.urgency !== URGENCY.RECOVER) {
          return stop(DECISION.CANCEL, "already-full");
        }
      }

      if (ledger.backedOff(snap)) return stop(DECISION.CANCEL, "backoff");

      if (live.moduleActive && live.activeModule && live.activeModule !== "autoHealEngine") {
        const theirs = this.adapter.priorityOf(live.activeModule);
        const mine = plan.rank ? plan.rank.cls : this.adapter.priorityClass("UTILITY");
        if (mine <= theirs) return stop(DECISION.CANCEL, `outranked:${live.activeModule}`);
      }
      /* Another module already ate on this tick: the hit stamp it consumed is
       * not ours to spend again. */
      if (live.healedOnce) return stop(DECISION.RECALCULATE, "already-healed-this-tick");

      if (plan.rank && plan.rank.survival) {
        const stillLethal = typeof threat.imminentWithin === "function"
          ? threat.imminentWithin(1) >= (typeof live.health === "number"
            ? live.health : snap.health)
          : threat.effective >= snap.health;
        if (!stillLethal && threat.reports.length === 0) {
          return stop(DECISION.RECALCULATE, "threat-gone");
        }
      }
      if (predict.invalidatedBy === INVALIDATION.TARGET ||
          predict.invalidatedBy === INVALIDATION.GONE) {
        if (plan.urgency === URGENCY.PREEMPT) {
          return stop(DECISION.RECALCULATE, `prediction:${predict.invalidatedBy}`);
        }
      }

      const shameCheck = shame.revalidate(snap, state, live, plan);
      if (!shameCheck.ok) {
        return stop(
          shameCheck.reason === "lockguard" ? DECISION.CANCEL : DECISION.RECALCULATE,
          shameCheck.reason
        );
      }
      return {
        ok: true,
        decision: DECISION.HEAL_NOW,
        reason: shameCheck.changed ? "recalculated" : "",
        presses: shameCheck.presses,
        verdict: shameCheck.verdict
      };
    }
  }

  /* ================================================================== *
   * CooldownManager — pacing, and the one clock allowed to stall.
   * ================================================================== */
  class CooldownManager {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.holdSinceTick = -1;
      this.holdReason = "";
      this.pressedThisTick = 0;
      this.lastPressTick = -999;
    }

    heldTicks(snap) {
      return this.holdSinceTick < 0 ? 0 : snap.tick - this.holdSinceTick;
    }

    /* Whether the decision is still allowed to stall for the shame window.
     *
     * Bounded at one tick by default: under damage every tick the window never
     * opens, because the hit stamp is refreshed faster than 120ms elapses, and
     * a guard that waits for it forever is a guard that stops you eating.
     *
     * Unbounded at count 7, and only there. That press cannot heal — the lock
     * is armed before consume is reached — so waiting gives up nothing. */
    mayHold(snap, shame) {
      if (shame.count >= AH.SHAME_MAX) return true;
      return this.heldTicks(snap) < AH.HOLD_TICKS_DEFAULT;
    }

    notePress(snap, presses) {
      this.pressedThisTick = presses;
      this.holdSinceTick = -1;
      this.holdReason = "";
      this.lastPressTick = snap.tick;
    }

    pace(plan, snap) {
      this.pressedThisTick = plan.presses || 0;
      if (!plan.presses && plan.holdMs > 0 && plan.urgency >= URGENCY.SUSTAIN) {
        if (this.holdSinceTick < 0) this.holdSinceTick = snap.tick;
        this.holdReason = plan.reason;
      } else {
        this.holdSinceTick = -1;
        this.holdReason = "";
      }
      return plan;
    }
  }

  /* ================================================================== *
   * DefenseExecutor — validate, send, commit.
   *
   * Three actions in the order the tick needs them: gear first, because an
   * equip that lands after the swing is worth nothing; then the dodge, which
   * has to be in the same tick as the decision to be in front of the shot; and
   * then food, which is the only one of the three that is worth sending late.
   *
   * There are no delays anywhere in here and there is no scheduler. Everything
   * leaves in the same synchronous call that decided to send it, which is the
   * only way to be fast in a client whose tick is 111ms wide: anything that
   * waits has already missed the tick it was waiting for.
   *
   * Every frame passes PacketBudget.canSend immediately before it is sent, so
   * the limit is respected against the live counter and not against a number
   * copied at the top of the tick.
   * ================================================================== */
  class DefenseExecutor {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.lastReason = "";
      this.lastPresses = 0;
      this.lastDecision = null;
      this.totalPresses = 0;
      this.lastPackets = 0;
      this.gearSent = 0;
      this.moveSent = 0;
      this.blocked = [];
    }

    /* ---- gear -------------------------------------------------------- */
    runGear(plan, snap, budget, gearManager) {
      if (!plan || plan.hat === null) {
        gearManager.commit(snap, null, 0);
        /* Not re-asserting the claim is the release; nothing is sent. */
        if (gearManager.current === null) this.adapter.releaseHat();
        return 0;
      }
      const tag = plan.priority >= PACKET_PRIORITY.EMERGENCY ? "lethal" : "gear";
      const cost = plan.packets;
      /* Every way out below leaves the manager's state alone rather than
       * committing: the hat on our head did not change, so neither should its
       * record of what it is holding. Committing a release here would drop the
       * hold and re-equip on the next tick that succeeds, which is the flap the
       * hold exists to prevent. */
      if (cost > 0) {
        if (budget.grant(tag, cost, plan.priority) < cost) {
          this.blocked.push("gear:budget");
          return 0;
        }
        if (!budget.canSend(cost, plan.priority)) {
          this.blocked.push("gear:cap");
          return 0;
        }
      }
      if (!this.adapter.claimHat(plan.hat, plan.priority, plan.reason)) {
        this.blocked.push("gear:claim-refused");
        return 0;
      }
      /* The claim is what equips: Autohat reads the lock later in the same
       * tick and sends the frame. The cost is booked here because that is
       * where the decision to spend it was taken. */
      if (cost > 0) {
        /* Autohat sends the equip later in this tick, so the frame is spent
         * from here even though it has not left yet. */
        budget.commitDeferred(tag, cost);
        this.gearSent += 1;
      }
      this.adapter.claimModule();
      gearManager.commit(snap, plan, cost);
      return cost;
    }

    /* ---- evasion ----------------------------------------------------- */
    runEvade(plan, snap, budget, evasion) {
      if (!plan) return 0;
      if (!budget.canSend(plan.packets, plan.priority)) {
        this.blocked.push("evade:cap");
        return 0;
      }
      if (budget.grant("evade", plan.packets, plan.priority) < plan.packets) {
        this.blocked.push("evade:budget");
        return 0;
      }
      if (!this.adapter.claimMove(plan.angle)) {
        this.blocked.push("evade:move-claimed");
        return 0;
      }
      /* SafeWalk sends the move later in this tick. */
      budget.commitDeferred("evade", plan.packets);
      this.moveSent += 1;
      evasion.commit(snap, plan);
      this.adapter.claimModule();
      return plan.packets;
    }

    /* ---- food -------------------------------------------------------- */
    runHeal(plan, snap, state, shame, ledger, threat, predict, cooldown, budget) {
      this.lastReason = plan.reason;
      this.lastPresses = 0;
      this.lastDecision = null;
      this.lastPackets = 0;

      /* PREPARE: no press, one hat request, which is refused if another module
       * already claimed the slot. */
      if (plan.wantBull) {
        const cost = this.adapter.hatChangeCost(AH.HAT_BULL);
        if (cost === 0 || (budget.canSend(cost, PACKET_PRIORITY.SHAME) &&
            budget.grant("wash", cost, PACKET_PRIORITY.SHAME) >= cost)) {
          if (this.adapter.claimHat(AH.HAT_BULL, PACKET_PRIORITY.SHAME, "shame-wash")) {
            if (cost > 0) budget.commit("wash", cost);
            this.adapter.claimModule();
            this.lastReason = plan.reason + "+bull";
          }
        }
        return 0;
      }
      if (!plan.presses) return 0;

      /* ---- 1. final validation ------------------------------------- */
      const live = this.adapter.liveState();
      const check = this.validator.final(
        plan, snap, state, shame, threat, predict, ledger, live
      );
      if (!check.ok) {
        this.lastReason = `${plan.reason}+${check.decision === DECISION.CANCEL
          ? "cancel" : "stale"}:${check.reason}`;
        this.lastDecision = check.decision;
        return 0;
      }
      if (check.reason) this.lastReason = plan.reason + "+recalc";

      const presses = Math.min(plan.presses, check.presses);
      if (presses <= 0) {
        this.lastReason = plan.reason + "+cancel:nothing-left-to-heal";
        this.lastDecision = DECISION.CANCEL;
        return 0;
      }

      /* ---- 2. anti-spam: is this action already in the air? ---------- */
      const health = typeof live.health === "number" ? live.health : snap.health;
      const target = Math.min(snap.maxHealth, health + presses * snap.restore);
      const signature = AntiSpamManager.signature(plan, snap, target);
      if (ledger.isPending(signature, snap)) {
        ledger.duplicatesBlocked += 1;
        this.lastReason = plan.reason + "+cancel:already-pending";
        this.lastDecision = DECISION.CANCEL;
        return 0;
      }

      /* ---- 3. execution --------------------------------------------- *
       *
       * The client's own primitives, in the order the game requires: the food
       * has to be selected again for every press, because a successful consume
       * clears buildIndex on the server (game_index.js:2476), so the next
       * attack would swing the weapon instead of eating.
       *
       * The weapon is restored once, after the burst, rather than once per
       * press. Nothing can observe the intermediate state — the whole burst is
       * one synchronous call — and it is one frame instead of N: three presses
       * cost seven frames rather than nine. */
      const priority = plan.packetPriority || PACKET_PRIORITY.NORMAL;
      const tag = priority >= PACKET_PRIORITY.EMERGENCY ? "lethal" : "heal";
      const verdict = check.verdict;
      const willHeal = health < snap.maxHealth;
      let sent = 0;
      let frames = 0;
      let expected = health;

      try {
        for (let i = 0; i < presses; i++) {
          /* Per-press revalidation. Inside one synchronous burst the only
           * thing that changes is what we ourselves have already sent, so this
           * is what that costs: frames spent, and health already bought.
           *
           * The restore frame is reserved on every iteration, not just the
           * last: bailing out of the loop still has to pay for it, and a
           * budget that cannot is a budget that would leave the client holding
           * a cookie. */
          const need = AH.PACKETS_PRESS_BODY + AH.PACKETS_PRESS_RESTORE;
          if (!budget.canSend(need, priority)) break;
          if (expected >= snap.maxHealth && plan.urgency !== URGENCY.RECOVER) break;
          if (!this.adapter.pressFoodOnly()) break;
          sent += 1;
          frames += AH.PACKETS_PRESS_BODY;
          budget.commit(tag, AH.PACKETS_PRESS_BODY);
          expected += snap.restore;
          /* Only the first press of a burst is judged: it clears hitTime, so
           * the rest are free whatever they cost in food. */
          if (sent === 1) shame.notePress(snap, verdict);
          ledger.notePress(snap, willHeal ? snap.restore : 0);
        }
      } finally {
        /* One weapon restore for the whole burst, and it happens on every way
         * out of the loop. Combat, Auto Place and the placement engine all run
         * after us on this tick and all assume the weapon in hand is a weapon;
         * a burst that threw or bailed early must not hand them food. */
        if (this.adapter.holdingFood) {
          this.adapter.restoreWeapon();
          frames += AH.PACKETS_PRESS_RESTORE;
          budget.commit(tag, AH.PACKETS_PRESS_RESTORE);
        }
      }

      if (!sent) {
        this.lastReason = plan.reason + "+cancel:no-packets";
        this.lastDecision = DECISION.CANCEL;
        return 0;
      }

      /* ---- 4. commit ------------------------------------------------ */
      state.notePress(snap);
      ledger.notePending(signature, snap, sent, sent * snap.restore);
      cooldown.notePress(snap, sent);
      /* The projection is stale the moment a press goes out: the health it is
       * about to buy is real and the rest of this tick should see it. */
      predict.commitHeal(sent * snap.restore, snap);
      this.adapter.claimTick(plan.urgency >= URGENCY.CRITICAL);

      this.lastDecision = DECISION.HEAL_NOW;
      this.totalPresses += sent;
      this.lastPresses = sent;
      this.lastPackets = frames;
      return sent;
    }
  }

  /* ================================================================== *
   * The module RYN sees.
   * ================================================================== */
  class AutoHealEngine {
    constructor(client) {
      this.moduleName = "autoHealEngine";
      this.client = client;
      this.adapter = new HostAdapter(client);
      this.budget = new PacketBudget(this.adapter);
      this.ping = new PingModel();
      this.state = new StateTracker();
      this.damage = new DamageAnalyzer();
      this.shame = new ShameEngine(this.adapter);
      this.threat = new ThreatEngine(this.adapter);
      this.predict = new PredictiveDefenseEngine(this.adapter);
      this.ledger = new AntiSpamManager();
      this.priority = new ThreatPriority(this.adapter);
      this.gear = new DefensiveGearManager(this.adapter);
      this.evasion = new EvasionPlanner(this.adapter);
      this.decision = new HealDecisionEngine(this.adapter);
      this.validator = new ActionValidator(this.adapter);
      this.cooldown = new CooldownManager(this.adapter);
      this.executor = new DefenseExecutor(this.adapter);
      /* The executor runs the final validation itself, immediately before the
       * wire, so it holds the validator rather than being handed a verdict
       * from a stage that ran earlier. */
      this.executor.validator = this.validator;
      this._pressedThisTick = false;
      this.telemetry = {
        urgency: "idle", reason: "init", presses: 0, shame: 0,
        verdict: VERDICT.FREE, threat: 0, projected: AH.MAX_HEALTH
      };
    }

    /* ModuleHandler.reset() runs this on every spawn and death. */
    reset() {
      this.state.reset();
      this.damage.reset();
      this.shame.reset();
      this.threat.reset();
      this.predict.reset();
      this.ledger.reset();
      this.cooldown.reset();
      this.executor.reset();
      this.priority.reset();
      this.gear.reset();
      this.evasion.reset();
      this.ping.reset();
      this.budget.reset();
      this.adapter.releaseHat();
      this._pressedThisTick = false;
    }

    /* Whether the engine is driving healing. The two ownership guards the
     * builder installs — in AntiInsta's heal rule and in ShameReset — gate on
     * the same setting, so the shipped paths stand down instead of pressing
     * alongside it and come straight back when the toggle goes off. */
    owns() {
      return this.adapter.enabled;
    }

    postTick() {
      this._pressedThisTick = false;
      if (!this.adapter.enabled) {
        /* Leave nothing behind when switched off mid-fight. */
        if (this.gear.current !== null) {
          this.gear.reset();
          this.adapter.releaseHat();
        }
        return;
      }

      let snap;
      try {
        snap = this.adapter.snapshot();
      } catch (_) {
        return;
      }
      if (!snap || !snap.inGame) {
        if (snap && !snap.inGame) this.state.alive = false;
        return;
      }

      /* --- observe --------------------------------------------------- */
      this.ping.update(snap);
      this.budget.begin(snap);
      this.state.update(snap, this.ledger);
      this.ledger.update(snap, this.state);
      this.damage.update(snap, this.state);
      this.shame.update(snap, this.state, this.damage, {
        recentDamage: this.damage.rate,
        damageFrequency: this.damage.damageFrequency,
        msSinceDamage: this.state.msSinceDamage,
        expectedNextHitTicks: this.damage.expectedNextHitTicks,
        incomingDamage: 0,
        threatLevel: CONFIDENCE.NONE,
        inFlight: this.ledger.expectedHeal(snap),
        pressedLastTick: snap.tick - this.state.lastPressTick <= 1,
        holding: this.cooldown.holdSinceTick >= 0,
        backoff: this.ledger.backedOff(snap)
      });
      this.threat.evaluate(snap, this.damage, this.state, this.shame, this.ping);
      this.predict.build(snap, this.state, this.damage, this.threat, this.ledger);
      /* Ahead of the health bar: what is going to land, when, and how sure we
       * are. Rebuilt only when the world that produced it changed. */
      this.predict.predictAhead(snap, this.state, this.damage, this.threat, this.shame);
      /* The forecast and the way down both need the threat and the projection,
       * so the shame engine's second half runs after them. */
      this.shame.project(snap, this.state, this.damage, this.threat, this.predict, snap.systems);
      /* ...and the tracker's threat fields are now knowable. */
      this.shame.tracker.incomingDamage = Math.round(this.threat.effective);
      this.shame.tracker.threatLevel = this.threat.escalation;
      this.ledger.noteOutcome(snap, this.state, this.predict.inFlight);

      /* --- rank ------------------------------------------------------ */
      const rank = this.priority.classify(
        snap, this.threat, this.predict, this.shame, this.damage, this.ping
      );

      /* --- reserve (requirement 28) ---------------------------------- *
       *
       * A lethal threat books what its answer will cost before anything
       * cheaper is allowed to plan against the same budget. The number is the
       * detector's own estimate — a gear change plus the presses it takes to
       * get back over the bar — not a guess made here. */
      if (rank.survival) {
        const presses = snap.restore > 0
          ? Math.ceil(Math.max(0, snap.maxHealth - this.predict.projected) / snap.restore) : 0;
        const need = (rank.packets || 0) +
          presses * AH.PACKETS_PRESS_BODY + AH.PACKETS_PRESS_RESTORE;
        this.budget.reserve("lethal", need, PACKET_PRIORITY.EMERGENCY);
      }
      /* Requirement 29's promotion: a debt that the forecast says will reach
       * the ceiling is no longer housekeeping — the lock it leads to is a
       * thirty-second stretch of not being able to heal at all. */
      if (this.shame.debt > 0 && this.shame.predictor.willReachCritical) {
        this.budget.reserve("shame", AH.PACKETS_PRESS, PACKET_PRIORITY.DEFENSIVE);
        this.budget.promote("shame", PACKET_PRIORITY.DEFENSIVE);
      }

      /* --- act, in the order the tick needs ------------------------- */
      this.executor.blocked = [];

      const gearPlan = this.gear.plan(
        snap, this.priority, this.threat, this.shame, this.ping, this.budget
      );
      const gearPackets = this.executor.runGear(gearPlan, snap, this.budget, this.gear);

      const evadePlan = this.evasion.plan(
        snap, this.threat, this.priority, this.ping, this.budget
      );
      const evadePackets = this.executor.runEvade(evadePlan, snap, this.budget, this.evasion);

      let plan;
      if (this.ledger.backedOff(snap)) {
        plan = {
          urgency: URGENCY.BLOCKED, presses: 0, holdMs: 0,
          reason: "backoff", verdict: this.shame.verdictNow, rank
        };
      } else {
        plan = this.decision.plan(
          snap, this.state, this.damage, this.shame, this.threat, this.predict,
          this.cooldown, this.priority, this.ping, this.budget, rank
        );
        /* Plan-time legality. The final, pre-wire revalidation is the
         * executor's own first stage: nothing runs between it and the press. */
        plan = this.validator.check(plan, snap, this.shame, this.budget);
      }

      const sent = this.executor.runHeal(
        plan, snap, this.state, this.shame, this.ledger,
        this.threat, this.predict, this.cooldown, this.budget
      );
      /* Pacing is bookkeeping for the next tick, so it runs after the press
       * rather than between the decision and it. */
      this.cooldown.pace(plan, snap);
      this._pressedThisTick = sent > 0;

      this._telemetry(snap, plan, rank, sent, gearPlan, gearPackets, evadePlan, evadePackets);
    }

    _telemetry(snap, plan, rank, sent, gearPlan, gearPackets, evadePlan, evadePackets) {
      const tracker = this.shame.tracker;
      const forecast = this.shame.predictor;
      this.telemetry = {
        urgency: this._urgencyName(plan.urgency),
        decision: this.executor.lastDecision || plan.decision || DECISION.CANCEL,
        reason: this.executor.lastReason,
        presses: sent,

        /* priority */
        rank: rank ? rank.label : "quiet",
        rankTier: rank ? rank.tier : 0,
        rankClass: rank ? rank.cls : 0,
        rankUrgency: rank ? Number(rank.urgency.toFixed(2)) : 0,
        override: this.priority.overrode,
        ranked: this.priority.ranked.slice(0, 4).map(
          r => `${r.label}@${r.timing}t:${Math.round(r.severity)}${r.lethal ? "!" : ""}`
        ),
        valueNow: plan.values ? Math.round(plan.values.now.total) : 0,
        valueWait: plan.values ? Math.round(plan.values.wait.total) : 0,

        /* shame control */
        shame: this.shame.count,
        shameTarget: AH.SHAME_TARGET,
        shamePrev: tracker.previous,
        shameDelta: tracker.delta,
        zone: tracker.zone,
        debt: this.shame.debt,
        debtTicks: tracker.debtSinceTick < 0 ? 0 : snap.tick - tracker.debtSinceTick,
        worstDebtTicks: tracker.worstDebtTicks,
        charges: this.shame.chargesSpent,
        credits: this.shame.creditsTaken,
        upRate: Number(tracker.increaseRate.toFixed(2)),
        downRate: Number(tracker.decreaseRate.toFixed(2)),
        shameGate: this.shame.chargeSafeCount(snap),
        forecastShame: Number(forecast.projected.toFixed(2)),
        ticksToCritical: forecast.ticksToCritical === Infinity
          ? "-" : Math.round(forecast.ticksToCritical),
        opportunity: this.shame.opportunity.mode + ":" + this.shame.opportunity.reason,
        healingState: tracker.healingState,
        cooldownState: tracker.cooldownState,
        verdict: this.shame.verdictNow,
        creditIn: Math.round(this.shame.msUntilCredit),

        /* threat engine */
        threat: Math.round(this.threat.effective),
        escalation: this.threat.escalation,
        topThreat: this.threat.top
          ? this.threat.top.type + ":" + this.threat.top.confidence
          : "none",
        threats: this.threat.reports.map(
          r => `${r.type}:${r.confidence}:${r.severity}@${r.timing}`
        ),
        evidence: this.threat.top ? this.threat.top.evidence.join(" ") : "",
        soonest: this.threat.soonest === Infinity ? "-" : this.threat.soonest,
        sources: this.threat.sources.join(" "),
        damageFrequency: Number(this.damage.damageFrequency.toFixed(2)),
        nextHit: this.damage.expectedNextHitTicks === Infinity
          ? "-" : this.damage.expectedNextHitTicks,
        rate: Math.round(this.damage.rate),
        projected: Math.round(this.predict.projected),
        inFlight: this.predict.inFlight,

        /* predictive defense */
        forecastDamage: Math.round(this.predict.forecast.incomingDamage),
        forecastTiming: this.predict.forecast.timing === Infinity
          ? "-" : this.predict.forecast.timing,
        forecastHealth: Math.round(this.predict.forecast.expectedHealth),
        forecastLevel: this.predict.forecast.level,
        forecastConfidence: Number(this.predict.forecast.confidence.toFixed(2)),
        threatDuration: this.predict.forecast.threatDuration,

        /* gear and movement */
        gear: gearPlan && gearPlan.hat !== null ? gearPlan.hat : "-",
        gearReason: gearPlan ? gearPlan.reason : "",
        gearHeld: this.gear.current === null ? "-" : this.gear.current,
        gearEquips: this.gear.equips,
        evade: evadePlan ? Math.round(evadePlan.angle * 57.3) + "deg" : "-",
        evadeReason: evadePlan ? evadePlan.reason : this.evasion.refusals.join(","),
        dodges: this.evasion.dodges,

        /* ping */
        ping: Math.round(this.ping.smooth),
        jitter: Math.round(this.ping.jitter),
        reactionMs: Math.round(this.ping.reactionMs),
        reactionTicks: this.ping.reactionTicks,
        pingUnstable: this.ping.unstable,

        /* packets */
        packets: this.executor.lastPackets + gearPackets + evadePackets,
        packetsUsed: this.budget.spent,
        packetsFree: this.budget.free(),
        packetLimit: this.budget.limit,
        reserved: this.budget.reservedTotal(),
        budget: this.budget.report().reservations.join(" "),
        blocked: this.executor.blocked.join(","),
        duplicatesBlocked: this.ledger.duplicatesBlocked,
        pending: this.ledger.pendingAction && !this.ledger.pendingAction.resolved
          ? this.ledger.pendingAction.signature : "-",
        invalidatedBy: this.predict.invalidatedBy,
        predictCache: `${this.predict.cacheHits}/${this.predict.cacheHits + this.predict.cacheMisses}`,
        motionSource: this.predict.motion.kind
      };
    }

    _urgencyName(u) {
      for (const key in URGENCY) if (URGENCY[key] === u) return key.toLowerCase();
      return "unknown";
    }
  }

  AutoHealEngine.AH = AH;
  AutoHealEngine.URGENCY = URGENCY;
  AutoHealEngine.VERDICT = VERDICT;
  AutoHealEngine.ZONE = ZONE;
  AutoHealEngine.GEAR = GEAR;
  AutoHealEngine.zoneFor = ShameTracker.zoneFor;
  AutoHealEngine.CONFIDENCE = CONFIDENCE;
  AutoHealEngine.CONFIDENCE_VALUE = CONFIDENCE_VALUE;
  AutoHealEngine.DECISION = DECISION;
  AutoHealEngine.INVALIDATION = INVALIDATION;
  AutoHealEngine.THREAT = THREAT;
  AutoHealEngine.THREAT_ORDER = THREAT_ORDER;
  AutoHealEngine.PACKET_PRIORITY = PACKET_PRIORITY;
  return AutoHealEngine;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createRynAutoHealEngine };
}
