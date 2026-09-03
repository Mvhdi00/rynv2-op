  // ==========================================================================
  // SURVIVAL LAYER — shame, threat, defence, packets
  //
  // One layer, four parts, one tick order. Every Anti reads from it; none of
  // them keeps its own timer, its own target, or its own packet arithmetic.
  //
  // Every constant below comes from the shipped bundle, not from another
  // client:
  //
  //   shame window     game_index.js:2464 — `W <= 120` raises, else -2
  //   shame ban        game_index.js:2465 — `>= 8` sets shameTimer = 30000
  //   hitTime source   game_index.js:2422 — set by changeHealth only when f < 0
  //   hitTime consumed game_index.js:2463 — zeroed by the first eat after a hit
  //   regen cadence    game_index.js:2323 — the 1000ms timer that pays
  //                    healthRegen, which for Bull Helmet is -5
  //   Soldier          game_index.js:2756 — id 6, dmgMult 0.75
  //   Bull             game_index.js:2794 — id 7, healthRegen -5, dmgMultO 1.5
  // ==========================================================================

  /* game_index.js:2464. The comparison is `<=`, so 120 exactly still shames. */
  const SV_SHAME_WINDOW = 120;
  /* game_index.js:2465-2466. */
  const SV_SHAME_BAN_AT = 8;
  /* Clear the boundary rather than sit on it. Ping is measured, not exact. */
  const SV_SHAME_PAD = 10;
  /* selectItem + attack + whichWeapon. Counted at the transport, so this is
   * the real number of frames on the wire, not an estimate. */
  const SV_HEAL_COST = 3;
  const SV_SOLDIER = 6;
  const SV_BULL = 7;
  /* Items[17], game_index.js:2080-2092 — turret, shootRange 700, projectile 1,
   * which game_index.js:1560-1564 gives dmg 25. */
  const SV_TURRET_TYPE = 17;
  const SV_TURRET_RANGE = 700;
  const SV_TURRET_DMG = 25;

  // ── Shame ─────────────────────────────────────────────────────────────────
  //
  // The rule the whole engine turns on, from game_index.js:2454-2469:
  //
  //     if (this.hitTime) {
  //         const W = Date.now() - this.hitTime;
  //         this.hitTime = 0;
  //         W <= 120 ? (shameCount++, shameCount >= 8 && ban())
  //                  : (shameCount -= 2, clamp0());
  //     }
  //     this.shameTimer <= 0 && (consumed = food.consume(this));
  //
  // Three consequences decide everything below, and the old code acted on none
  // of them:
  //
  //   1. hitTime is set ONLY by damage (changeHealth with f < 0) and is
  //      CONSUMED by the first eat that follows. So exactly one eat per hit
  //      carries a shame verdict. Every further eat before the next hit is
  //      shame-neutral — the `if (this.hitTime)` block does not run at all.
  //      The old code re-checked the window on every apple in a top-up, which
  //      delayed apples two through five for a rule that could no longer apply
  //      to them.
  //
  //   2. Shame only falls when an eat lands MORE than 120ms after a hit. With
  //      no hitTime an eat does nothing to shame at all. You cannot "heal shame
  //      down" at will; you can only answer a hit late. Which is why Bull
  //      Helmet matters: healthRegen -5 manufactures one hit per second.
  //
  //   3. The 120ms is measured on the server, between its own hitTime and its
  //      processing of the eat. We learn of the damage one downstream latency
  //      after it happened and our eat arrives one upstream latency after we
  //      send, so the server always sees MORE elapsed time than we measure —
  //      by the whole round trip. The guard therefore ADDS ping. Subtracting
  //      it, or ignoring it, is what made a high-ping client wait through a
  //      window that had already closed.
  class ShameEngine {
    client;
    /* Mirrors of the server state, refreshed once a tick. */
    shame = 0;
    previousShame = 0;
    delta = 0;
    /* Wall clock of the damage that armed the current hitTime, or null when
     * there is nothing pending for the server to judge. */
    hitAt = null;
    /* Set when we send an eat, so the next verdict knows hitTime is spent even
     * though the server has not echoed anything back yet. */
    spentAt = null;
    lastDamageAt = 0;
    damageStreak = 0;
    lastStreakAt = 0;
    recovered = 0;
    incurred = 0;
    _tick = -1;
    constructor(client2) {
      this.client = client2;
    }
    pong() {
      const s = this.client.SocketManager;
      const p = s && Number.isFinite(s.pong) ? s.pong : 0;
      return p < 0 ? 0 : p;
    }
    /* What the server's `Date.now() - this.hitTime` will read when an eat sent
     * now arrives. Infinity when there is no armed hitTime, which is the
     * shame-neutral case. */
    serverElapsed(now) {
      if (this.hitAt === null) return Infinity;
      if (this.spentAt !== null && this.spentAt >= this.hitAt) return Infinity;
      return now - this.hitAt + this.pong();
    }
    /* SAFE      an eat now takes 2 off the count
     * NEUTRAL   hitTime is spent or was never armed; the eat is free
     * SHAMEFUL  an eat now adds 1, and 8 is a thirty-second food ban */
    /* The comparison is >=, not >, so that msUntilSafe names a moment that is
     * actually safe rather than the last unsafe one. The pad already puts the
     * boundary clear of the game's own `<= 120`. */
    verdict(now = Date.now()) {
      const e = this.serverElapsed(now);
      if (e === Infinity) return "neutral";
      return e >= SV_SHAME_WINDOW + SV_SHAME_PAD ? "safe" : "shameful";
    }
    /* How long to wait before an eat stops costing shame. Zero when it already
     * does not. */
    msUntilSafe(now = Date.now()) {
      const e = this.serverElapsed(now);
      if (e === Infinity) return 0;
      const need = SV_SHAME_WINDOW + SV_SHAME_PAD - e;
      return need > 0 ? need : 0;
    }
    /* The count the server would hold after one eat sent now. This is what
     * makes the engine predictive rather than reactive: it can see the ban
     * coming before the eat that would cause it. */
    projected(now = Date.now()) {
      const v = this.verdict(now);
      if (v === "safe") return Math.max(0, this.shame - 2);
      if (v === "shameful") {
        const next = this.shame + 1;
        return next >= SV_SHAME_BAN_AT ? 0 : next;
      }
      return this.shame;
    }
    /* True when an eat sent now would trip the thirty-second ban. The old model
     * could not answer this at all: it clamped its own count at 7, so the
     * transition to 8 — the only one that matters — was unrepresentable, and
     * the ban was only ever noticed after the fact, from the Shame! hat
     * arriving. */
    wouldBan(now = Date.now()) {
      return this.verdict(now) === "shameful" && this.shame + 1 >= SV_SHAME_BAN_AT;
    }
    /* Recording an eat locally. hitTime is consumed server-side by the first
     * eat after a hit, so the second and later apples of a top-up are free and
     * must not be delayed by the window. */
    noteEat(now = Date.now()) {
      if (this.hitAt !== null && (this.spentAt === null || this.spentAt < this.hitAt)) {
        const late = this.serverElapsed(now) >= SV_SHAME_WINDOW + SV_SHAME_PAD;
        this.spentAt = now;
        if (late) this.recovered += 1; else this.incurred += 1;
      }
    }
    noteDamage(now = Date.now()) {
      this.hitAt = now;
      this.spentAt = null;
      if (now - this.lastDamageAt < 900) {
        this.damageStreak += 1;
        this.lastStreakAt = now;
      } else if (now - this.lastStreakAt > 2500) {
        this.damageStreak = 1;
      }
      this.lastDamageAt = now;
    }
    /* Repeated small hits with no let-up is the shape of an opponent farming
     * shame rather than trying to kill (§17). It does not change what is safe;
     * it changes how much the engine is willing to spend to stay at zero.
     *
     * Takes the clock rather than reading it, like every other predicate here,
     * so the answer is a function of its inputs. */
    isSpamming(now = Date.now()) {
      return this.damageStreak >= 3 && now - this.lastStreakAt < 1500;
    }
    sync(tick) {
      if (this._tick === tick) return;
      this._tick = tick;
      const myPlayer = this.client.myPlayer;
      if (!myPlayer) return;
      this.previousShame = this.shame;
      this.shame = myPlayer.shameCount || 0;
      this.delta = this.shame - this.previousShame;
      /* myPlayer.receivedDamage is the client's own stamp of the last health
       * drop, and it is nulled by the client's model when a heal lands. Reading
       * the stamp rather than subscribing keeps this to one field read; the
       * transition is what arms hitAt. */
      const rd = myPlayer.receivedDamage;
      if (rd && rd !== this.hitAt) this.noteDamage(rd);
      if (this.damageStreak && Date.now() - this.lastDamageAt > 2500) this.damageStreak = 0;
    }
  }

  // ── Packets ───────────────────────────────────────────────────────────────
  //
  // One budget for the whole client. It does not replace PacketManager's count
  // — that is the transport's own tally of frames actually sent, and stays the
  // only source of truth for how many have gone out. What this adds is the
  // half the client did not have: a way for an imminent lethal threat to hold
  // packets that a routine top-up or a placement cannot then spend.
  //
  // The guarantee is structural rather than a promise. Nothing here sends; it
  // only ever answers "can you afford this", and it answers by subtracting
  // from the live transport count, so a caller that asks and obeys can never
  // exceed the limit however many other callers there are.
  class PacketBudget {
    client;
    reservations = [];
    constructor(client2) {
      this.client = client2;
    }
    get limit() {
      return this.client._ModuleHandler.packetLimit;
    }
    get used() {
      return this.client._ModuleHandler.packetCount;
    }
    expire(tick) {
      for (let i = this.reservations.length - 1; i >= 0; i--) {
        if (this.reservations[i].expires <= tick) this.reservations.splice(i, 1);
      }
    }
    /* Held for one owner at one priority. Re-reserving replaces rather than
     * stacks, so a threat that persists across ticks holds one reservation and
     * not one per tick. */
    reserve(owner, cost, priority, tick, ttl = 2) {
      this.release(owner);
      if (cost <= 0) return 0;
      const room = this.limit - this.used - this.reservedAbove(-Infinity);
      const held = Math.max(0, Math.min(cost, room));
      if (held > 0) {
        this.reservations.push({
          owner: owner,
          cost: held,
          priority: priority,
          expires: tick + ttl
        });
      }
      return held;
    }
    release(owner) {
      for (let i = this.reservations.length - 1; i >= 0; i--) {
        if (this.reservations[i].owner === owner) this.reservations.splice(i, 1);
      }
    }
    reservedAbove(priority, ignoreOwner) {
      let sum = 0;
      for (const r of this.reservations) {
        if (ignoreOwner !== undefined && r.owner === ignoreOwner) continue;
        if (r.priority > priority) sum += r.cost;
      }
      return sum;
    }
    /* What a caller at this priority may spend. Anything reserved by something
     * more urgent is simply not part of the answer, which is what stops a
     * routine heal from eating the packets an emergency is holding. */
    available(priority = 0, owner) {
      const free = this.limit - this.used - this.reservedAbove(priority, owner);
      return free > 0 ? free : 0;
    }
    canAfford(cost, priority = 0, owner) {
      return cost > 0 && this.available(priority, owner) >= cost;
    }
    /* How many whole actions of this cost fit. */
    affords(cost, priority = 0, owner) {
      if (cost <= 0) return 0;
      return Math.floor(this.available(priority, owner) / cost);
    }
  }

  // ── Threats ───────────────────────────────────────────────────────────────
  //
  // EnemyManager already walks the enemies, the objects and the projectiles
  // once a tick and leaves its findings on itself — potentialDamage,
  // potentialSpikeDamage, reverseInsta, toolHammerInsta, rangedBowInsta,
  // spikeSyncThreat, collidingSpike, willCollideSpike, nearestPushSpike,
  // nearestKBTrap, nearestTurretEntity. This reads those. It does not scan
  // anything itself, which is the difference between a threat layer and a
  // second EnemyManager.
  //
  // Each entry is one shape of attack with a severity, an estimated bite, a
  // time to impact and what it wants worn. Ranking is by time to impact
  // weighted by severity, because the nearest enemy is not the most dangerous
  // one — the one that lands first is.
  const SV_THREAT = {
    LETHAL: 100,
    SEQUENCE: 80,
    SPIKE: 70,
    PROJECTILE: 60,
    VELOCITY: 50,
    SHAME: 30,
    DAMAGE: 10
  };

  class ThreatEngine {
    client;
    threats = [];
    top = null;
    incoming = 0;
    impactTicks = 99;
    turretCount = 0;
    _tick = -1;
    constructor(client2) {
      this.client = client2;
    }
    _add(kind, severity, damage, impactTicks, gear, why) {
      this.threats.push({
        kind: kind,
        severity: severity,
        damage: damage,
        impactTicks: impactTicks,
        gear: gear,
        why: why
      });
    }
    /* Network delay a defensive action has to be early by: the round trip, plus
     * how unsteady that round trip has been, plus one tick — nothing decided
     * now reaches the server before the next one.
     *
     * Jitter is measured rather than padded for. A steady 200ms link is
     * predictable and needs no allowance beyond its own latency; a link
     * swinging between 40 and 200 needs the swing. The client exposes pong and
     * nothing else, so the spread is taken from the samples themselves — eight
     * of them, one a tick, mean absolute deviation. §25 asks for exactly this
     * and warns against just adding raw ping to every timer. */
    _pongs = [];
    _samplePong() {
      const s = this.client.SocketManager;
      const pong = s && Number.isFinite(s.pong) ? s.pong : 0;
      this._pongs.push(pong < 0 ? 0 : pong);
      if (this._pongs.length > 8) this._pongs.shift();
    }
    pongJitter() {
      const n = this._pongs.length;
      if (n < 2) return 0;
      let mean = 0;
      for (const p of this._pongs) mean += p;
      mean /= n;
      let dev = 0;
      for (const p of this._pongs) dev += Math.abs(p - mean);
      return dev / n;
    }
    reactionMs() {
      const s = this.client.SocketManager;
      const pong = s && Number.isFinite(s.pong) ? s.pong : 0;
      return (pong < 0 ? 0 : pong) + this.pongJitter() + RPE_TICK_MS;
    }
    reactionTicks() {
      return Math.ceil(this.reactionMs() / RPE_TICK_MS);
    }
    /* Enemy turrets that actually bear on us, counted from the grid the client
     * already keeps rather than from a map sweep. Bounded to the turret's own
     * 700 shootRange, and only run at all when something is already threatening
     * or health is down — a full-health player with nothing incoming does not
     * pay for this. §34. */
    _countTurrets(myPos) {
      const {ObjectManager: ObjectManager2, PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      if (!ObjectManager2 || !ObjectManager2.grid2D) return 0;
      const cells = Math.ceil(SV_TURRET_RANGE / ObjectManager2.grid2D.cellSize) + 1;
      let count = 0;
      ObjectManager2.grid2D.query(myPos.x, myPos.y, cells, id => {
        const obj = ObjectManager2.objects.get(id);
        if (!obj || obj.type !== SV_TURRET_TYPE || !obj.pos || !obj.pos.current) return false;
        if (!PlayerManager2.isEnemyByID(obj.ownerID, myPlayer)) return false;
        if (myPos.distance(obj.pos.current) > SV_TURRET_RANGE) return false;
        count += 1;
        return false;
      });
      return count;
    }
    build(tick) {
      if (this._tick === tick) return this;
      this._tick = tick;
      this._samplePong();
      this.threats.length = 0;
      this.top = null;
      this.incoming = 0;
      this.impactTicks = 99;
      const {myPlayer: myPlayer, EnemyManager: EnemyManager2} = this.client;
      if (!myPlayer || !myPlayer.inGame || !EnemyManager2) return this;
      const hp = myPlayer.tempHealth;
      const lead = this.reactionTicks();

      /* The one number the client already computes for "what can land on me
       * this tick", adjusted for the hat actually on. This is the floor of the
       * model, not the whole of it. */
      let pot = EnemyManager2.potentialDamage + EnemyManager2.potentialSpikeDamage;
      if (pot > ANTI_INSTA_DMG_CAP) pot = ANTI_INSTA_DMG_CAP;
      const hatID = myPlayer.hatID;
      if (hatID === SV_SOLDIER) pot *= Hats[SV_SOLDIER].dmgMult;
      if (hatID === SV_BULL) pot += ANTI_INSTA_SCUBA_BIAS;
      this.incoming = pot;

      if (pot > 0) {
        /* Lethal is the only severity that reserves packets, so it is the only
         * one that has to be measured against health rather than guessed at. */
        if (pot >= hp) {
          this._add("lethal", SV_THREAT.LETHAL, pot, 1, SV_SOLDIER, "potential damage >= health");
        } else {
          this._add("damage", SV_THREAT.DAMAGE, pot, 1, null, "potential damage");
        }
      }

      /* Named sequences. Each is EnemyManager's own detection — a flag it
       * raised from an actual weapon state and range, not from an enemy merely
       * owning something. Wiring them here is what stops each Anti from
       * equipping a hat of its own. */
      if (EnemyManager2.reverseInsta) {
        this._add("reverseInsta", SV_THREAT.SEQUENCE, pot, 1, SV_SOLDIER, "turret gear then bull");
      }
      if (EnemyManager2.toolHammerInsta) {
        this._add("toolHammerInsta", SV_THREAT.SEQUENCE, pot, 1, SV_SOLDIER, "tool hammer sequence");
      }
      if (EnemyManager2.rangedBowInsta) {
        this._add("rangedInsta", SV_THREAT.SEQUENCE, pot, lead, SV_SOLDIER, "primary plus ranged");
      }
      if (EnemyManager2.spikeSyncThreat) {
        this._add("spikeSync", SV_THREAT.SEQUENCE, pot, 1, SV_SOLDIER, "spike sync");
      }
      /* Spike geometry. collidingSpike is contact now; willCollideSpike is the
       * client's own prediction of contact from current velocity, which is the
       * knockback case — the defence has to be on before the push completes,
       * not after the spike bites. */
      if (EnemyManager2.collidingSpike) {
        this._add("spikeContact", SV_THREAT.SPIKE, EnemyManager2.potentialSpikeDamage, 1, SV_SOLDIER, "on a spike");
      } else if (EnemyManager2.willCollideSpike) {
        this._add("spikePush", SV_THREAT.SPIKE, EnemyManager2.potentialSpikeDamage, 2, SV_SOLDIER, "pushed onto a spike");
      }
      if (EnemyManager2.possibleToKnockback && EnemyManager2.potentialSpikeKnockbackDamage > 0) {
        this._add("kbTick", SV_THREAT.SPIKE, EnemyManager2.potentialSpikeKnockbackDamage, 2, SV_SOLDIER, "knocked onto a spike");
      }
      /* Trapped with an enemy able to place is the spike-tick setup: the trap
       * breaks, we are exposed, and the spike is already there. The defence
       * has to be standing before the break, so this is raised on the setup
       * rather than on the break. */
      if (myPlayer.isTrapped && EnemyManager2.enemyCanPlaceSpike) {
        this._add("spikeTick", SV_THREAT.SEQUENCE, pot, 2, SV_SOLDIER, "trapped, enemy can spike");
      } else if (myPlayer.isTrapped && pot > 0) {
        /* Trapped at all, with anything incoming. A trap sets lockMove
         * (game_index.js:943) and lockMove zeroes both velocities
         * (game_index.js:2331-2333), so moving out of the way — the other half
         * of surviving anything — is not available. When the only lever left is
         * taking less, Soldier is worth its 6% speed, which is itself worth
         * nothing to someone who cannot move. */
        this._add("trapped", SV_THREAT.SPIKE, pot, 1, SV_SOLDIER, "trapped and under fire");
      }
      /* Turret stack. One turret is 25 and EnemyManager already prices it into
       * potentialDamage; the case this adds is several bearing at once, where
       * the combined volley is lethal and no single one of them is. §20 asks
       * for the estimate before they all fire, not after. */
      if (pot > 0 || hp < myPlayer.maxHealth) {
        const turrets = this._countTurrets(myPlayer.pos.current);
        this.turretCount = turrets;
        if (turrets >= 2) {
          const stack = turrets * SV_TURRET_DMG;
          this._add("turretStack", stack >= hp ? SV_THREAT.LETHAL : SV_THREAT.PROJECTILE, stack, lead + 1, SV_SOLDIER, turrets + " turrets bearing");
        }
      } else {
        this.turretCount = 0;
      }

      /* Ranking. Severity first, then what lands soonest, then the bigger
       * bite — so a lethal hit two ticks out outranks a scratch landing now,
       * and two threats of the same shape are separated by arrival rather than
       * by the order EnemyManager happened to find them in. */
      this.threats.sort((a, b) => b.severity - a.severity || a.impactTicks - b.impactTicks || b.damage - a.damage);
      this.top = this.threats.length ? this.threats[0] : null;
      if (this.top) this.impactTicks = this.top.impactTicks;
      return this;
    }
    get lethal() {
      return this.top !== null && this.top.severity >= SV_THREAT.LETHAL;
    }
    has(kind) {
      for (const t of this.threats) if (t.kind === kind) return true;
      return false;
    }
  }



  // ── Defence ───────────────────────────────────────────────────────────────
  //
  // One decision per tick about what is worn, so the Antis cannot fight over
  // it. Soldier is worn for a threat that is actually arriving and taken off
  // when it is not, because it costs 6% movement and reduces nothing when
  // nothing is incoming. Bull is worn for the shame reset and only when the
  // engine has decided shame is worth the 5 health.
  class DefenceState {
    client;
    want = null;
    reason = "";
    since = 0;
    _tick = -1;
    constructor(client2) {
      this.client = client2;
    }
    decide(tick, threats, shame) {
      if (this._tick === tick) return this.want;
      this._tick = tick;
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      this.want = null;
      this.reason = "";
      if (!myPlayer || !myPlayer.inGame) return null;
      /* Anything that has already claimed the hat this tick for a reason of its
       * own — a placement that needs Tank, an insta that needs Bull — keeps it.
       * The survival layer decides what is worn for defence, not what is worn
       * full stop. */
      if (ModuleHandler.forceHat !== null && ModuleHandler.forceHat !== undefined) {
        this.reason = "held by " + (ModuleHandler.activeModule || "another module");
        return null;
      }
      const top = threats.top;
      if (top !== null && top.gear === SV_SOLDIER && ModuleHandler.canBuy(0, SV_SOLDIER)) {
        this.want = SV_SOLDIER;
        this.reason = top.kind;
        this.since = tick;
        return this.want;
      }
      /* Shame recovery. Bull's healthRegen of -5 is the only way to arm a
       * hitTime on demand, and a hitTime is the only thing an eat can answer to
       * take shame down. It is worn on the regen beat and only while nothing is
       * incoming, because 5 health is a real price. */
      if (shame.shame > 0 && !myPlayer.shameActive && myPlayer.poisonCount === 0 && threats.incoming === 0 && myPlayer.tempHealth > SV_BULL_MIN_HP && myPlayer.isBullTickTime() && ModuleHandler.canBuy(0, SV_BULL)) {
        this.want = SV_BULL;
        this.reason = "shame " + shame.shame + " -> 0";
        this.since = tick;
        return this.want;
      }
      return null;
    }
  }
  /* Bull drains 5 a second. Below this the drain is a bigger risk than the
   * shame it is clearing. */
  const SV_BULL_MIN_HP = 55;

  // ── Evasion ───────────────────────────────────────────────────────────────
  //
  // The smallest sidestep that takes every incoming shot off us, and nothing
  // when there is no such step.
  //
  // The shape matters more than anything else here. game_index.js:3106 tests a
  // projectile against a player with
  //
  //     lineInRect(l.x - l.scale, l.y - l.scale, l.x + l.scale, l.y + l.scale,
  //                this.x, this.y, this.x + g*cos(dir), this.y + g*sin(dir))
  //
  // — an axis-aligned SQUARE of half-side player.scale swept against the
  // projectile's segment, not a circle. A dodge computed against a circle
  // steps out of a shape the server is not using: it clears the circle and
  // stays inside the corner of the square. GeometrySolver.boxCrossesSegment is
  // the client's own model of that same test, already written for the placement
  // path, so the evasion asks the question in the shape the server answers it
  // in.
  //
  // Everything else follows from three limits the brief sets: the step is small
  // (one tick, perpendicular), it is reversible (movement goes back the moment
  // nothing is incoming), and it does not happen at all when the ground is not
  // clear.
  const SV_EVADE_COST = 2;
  /* One tick of walking from a standing start is about 20 units
   * (playerSpeed 0.0016/ms over a 111ms tick, twice). Anything under a third of
   * that means the simulation put us straight back where we started, which is
   * what a wall does. */
  const SV_EVADE_MIN_STEP = 7;
  /* How far past the last shot the sidestep is held, so a volley arriving one
   * tick apart is not answered with a move, a release and another move. */
  const SV_EVADE_HOLD = 2;
  /* Steady walking speed, from the game's own numbers: playerSpeed 0.0016 per
   * ms accelerates the player each tick and playerDecel 0.993 per ms takes it
   * back, so velocity settles at accel / (1 - decay^tick). About 0.33 units per
   * ms, or 36 a tick. */
  const SV_WALK_VEL = Config_default.playerSpeed * RPE_TICK_MS / (1 - Math.pow(Config_default.playerDecel, RPE_TICK_MS));
  /* A shot further out than this is not worth projecting a walk over — the
   * enemy will have moved and re-aimed long before it lands. */
  const SV_EVADE_MAX_TICKS = 5;

  class ProjectileEvasion {
    client;
    active = false;
    angle = null;
    holdUntil = -1;
    reason = "idle";
    incoming = [];
    _sim = null;
    _tick = -1;
    constructor(client2) {
      this.client = client2;
    }
    scale() {
      const p = this.client.myPlayer;
      return p && p.collisionScale ? p.collisionScale : 35;
    }
    /* The segment the shot will travel over what is left of its range. */
    _segment(proj) {
      const from = proj.pos.current;
      const reach = Number.isFinite(proj.range) && proj.range > 0 ? proj.range : proj.maxRange || 1200;
      return [ from.x, from.y, from.x + reach * Math.cos(proj.angle), from.y + reach * Math.sin(proj.angle) ];
    }
    /* Would this shot cross a player standing at (px, py)? The game's shape,
     * not a circle. */
    wouldHit(proj, px, py) {
      const s = this._segment(proj);
      return GeometrySolver.boxCrossesSegment(px, py, this.scale(), s[0], s[1], s[2], s[3]);
    }
    /* Cover between us and the shot. game_index.js:3113 stops a projectile on
     * the first object with `layer >= projectile layer` that is not
     * ignoreCollision, and it uses the same box test. A shot a wall is going to
     * eat is not a threat, and dodging it is the false positive §31 forbids.
     *
     * Only the ground immediately around us is checked — one grid cell — which
     * is the case that actually comes up, cover you are standing behind. A wall
     * halfway down a 1000-unit flight is not searched for, and the shot is
     * treated as live. */
    shielded(proj) {
      const {ObjectManager: ObjectManager2, myPlayer: myPlayer} = this.client;
      if (!ObjectManager2 || !ObjectManager2.grid2D) return false;
      const s = this._segment(proj);
      const me = myPlayer.pos.current;
      const layer = Projectiles[proj.type] ? Projectiles[proj.type].layer : 0;
      let blocked = false;
      ObjectManager2.grid2D.query(me.x, me.y, 1, id => {
        if (blocked) return true;
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !obj.pos || !obj.pos.current) return false;
        if (obj.canMoveOnTop && obj.canMoveOnTop()) return false;
        if (layer > (obj.layer === undefined ? 0 : obj.layer)) return false;
        const p = obj.pos.current;
        const r = obj.collisionScale === undefined ? obj.scale : obj.collisionScale;
        /* It only shields us if it is hit BEFORE we are. */
        if (!GeometrySolver.boxCrossesSegment(p.x, p.y, r, s[0], s[1], s[2], s[3])) return false;
        const dObj = Math.hypot(p.x - s[0], p.y - s[1]);
        const dMe = Math.hypot(me.x - s[0], me.y - s[1]);
        if (dObj < dMe) blocked = true;
        return blocked;
      });
      return blocked;
    }
    msToImpact(proj) {
      const me = this.client.myPlayer.pos.current;
      const from = proj.pos.current;
      const d = Math.hypot(me.x - from.x, me.y - from.y) - this.scale();
      const speed = proj.speed > 0 ? proj.speed : 1.5;
      return d <= 0 ? 0 : d / speed;
    }
    /* Where walking in this direction for `ticks` ticks actually puts us, with
     * the client's own collision model deciding each one.
     *
     * One tick is not a dodge. A player is 35 across, so the box the server
     * sweeps is 70 wide, and a single tick of walking moves about 36 units —
     * a sidestep aimed at the centre of that box ends up still inside it. What
     * makes a dodge work is that the arrow takes time to arrive: at 1.6 units
     * per ms a 500-unit flight is three ticks, and three ticks of walking is
     * clear. So the step is projected over the flight, not over one tick.
     *
     * The simulation accelerates from ModuleHandler.move_dir rather than from an
     * argument, so the candidate direction is seeded as velocity at the speed
     * steady walking actually reaches — acceleration per tick against the
     * game's own decay — and each tick is run without further acceleration.
     * That also makes the answer independent of whether we happened to be
     * moving already, which matters: a standing player has myPlayer.speed 0 and
     * would otherwise be judged unable to move at all. */
    walk(dir, ticks) {
      const {myPlayer: myPlayer} = this.client;
      if (this._sim === null) this._sim = new MovementSimulation;
      const sim = this._sim;
      sim.reset(this.client, null);
      const from = myPlayer.pos.current;
      const startX = from.x, startY = from.y;
      const cos = Math.cos(dir), sin = Math.sin(dir);
      let spike = false, trapped = false;
      const n = ticks < 1 ? 1 : ticks > SV_EVADE_MAX_TICKS ? SV_EVADE_MAX_TICKS : ticks;
      for (let i = 0; i < n; i++) {
        sim.xVel = cos * SV_WALK_VEL;
        sim.yVel = sin * SV_WALK_VEL;
        sim.update(this.client, true);
        if (sim.spikeCollision) spike = true;
        if (sim.lockMove) trapped = true;
      }
      const dx = sim.x - startX, dy = sim.y - startY;
      return {
        x: sim.x,
        y: sim.y,
        moved: Math.hypot(dx, dy),
        /* Ground covered in the direction actually asked for. Distance alone is
         * not the test: a wall we walk into pushes us back out along its own
         * normal, which is displacement without progress, and would read as a
         * successful step. The projection reads it as what it is. */
        along: dx * cos + dy * sin,
        spike: spike,
        trapped: trapped
      };
    }
    /* One decision a tick. Returns the heading to sidestep on, or null. */
    decide(tick, budget, reactionMs) {
      if (this._tick === tick) return this.active ? this.angle : null;
      this._tick = tick;
      const {myPlayer: myPlayer, ProjectileManager: PM, EnemyManager: EnemyManager2} = this.client;
      this.incoming.length = 0;
      if (!Settings_default._microEvasion || !myPlayer || !myPlayer.inGame || !PM) {
        return this._release("off");
      }
      const me = myPlayer.pos.current;
      /* ProjectileManager already keeps the enemy shots pointed our way; this
       * narrows that cone filter to the game's actual box test, and drops the
       * ones cover is going to eat. */
      for (const proj of PM.dangerProjectiles) {
        if (!proj || !proj.pos || !proj.pos.current) continue;
        if (!this.wouldHit(proj, me.x, me.y)) continue;
        if (this.shielded(proj)) continue;
        this.incoming.push(proj);
      }
      if (this.incoming.length === 0) {
        /* Held briefly so a volley one tick apart is not answered with a move,
         * a release and another move. */
        if (this.active && tick <= this.holdUntil) return this.angle;
        return this._release("nothing incoming");
      }
      /* Can a step even land before the first one arrives? Under the round trip
       * it cannot, and moving then only makes us a moving target for the next
       * shot. §33 — when the answer is no, do nothing rather than something. */
      let soonest = Infinity;
      for (const proj of this.incoming) soonest = Math.min(soonest, this.msToImpact(proj));
      if (soonest < reactionMs) return this._release("no time to move");
      if (!budget.canAfford(SV_EVADE_COST, SV_THREAT.PROJECTILE)) return this._release("no packet budget");

      /* Two candidates, both perpendicular to the shot. Perpendicular is the
       * shortest way out of a line, which is the whole of "smallest practical
       * movement". */
      const lead = this.incoming[0].angle;
      const options = [ lead + Math.PI / 2, lead - Math.PI / 2 ];
      /* Walk for as long as the shot takes to arrive, less the round trip we
       * have already lost. That is the ground we actually get to cover. */
      const ticks = Math.max(1, Math.floor((soonest - reactionMs) / RPE_TICK_MS));
      let best = null;
      for (const dir of options) {
        const to = this.walk(dir, ticks);
        /* The ground has to be clear. A wall stops the step dead — and worse,
         * pushes back along its own normal, which is movement without progress
         * — so the test is ground covered in the direction asked for. */
        if (to.along < SV_EVADE_MIN_STEP) continue;
        /* Never into a spike or an enemy trap — the two things that make a
         * dodge worse than the shot. */
        if (to.spike || to.trapped) continue;
        /* And it has to actually work, against every shot in the air rather
         * than the one we aimed at. */
        let clear = true;
        for (const proj of this.incoming) {
          if (this.wouldHit(proj, to.x, to.y)) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        /* Not into melee reach we are currently outside of. */
        const enemy = EnemyManager2 ? EnemyManager2.nearestEnemy : null;
        if (enemy && enemy.pos && enemy.pos.current) {
          const ep = enemy.pos.current;
          const now = Math.hypot(me.x - ep.x, me.y - ep.y);
          const after = Math.hypot(to.x - ep.x, to.y - ep.y);
          if (after < SV_MELEE_KEEPOUT && after < now) continue;
        }
        /* Of the ones that work, the one that gets furthest out of the line. */
        const margin = to.along;
        if (best === null || margin > best.margin) best = { dir: dir, margin: margin };
      }
      if (best === null) {
        /* §10 — if it cannot be dodged safely, protection and healing are the
         * answer, and those are already running. */
        return this._release("no safe step");
      }
      this.active = true;
      this.angle = best.dir;
      this.holdUntil = tick + SV_EVADE_HOLD;
      this.reason = this.incoming.length + " incoming, stepping " + (best.dir === options[0] ? "left" : "right");
      return this.angle;
    }
    _release(why) {
      if (this.active) {
        this.active = false;
        this.angle = null;
        this.holdUntil = -1;
      }
      this.reason = why;
      return null;
    }
  }
  /* Longest melee reach in the game is the polearm's; stepping inside it to
   * dodge an arrow trades one threat for a worse one. */
  const SV_MELEE_KEEPOUT = 160;

  // ── The layer ─────────────────────────────────────────────────────────────
  class SurvivalEngine {
    moduleName = "survival";
    client;
    shame;
    budget;
    threats;
    defence;
    evasion;
    /* Read by the client's own Safe Soldier resolution after the module loop.
     * A request, not a write: that block owns the hat. */
    wantSoldier = false;
    /* Food sent and not yet acknowledged. tempHealth only moves when the server
     * echoes the new health back, so without this the same missing health is
     * paid for once per tick for the whole round trip — three packets an apple,
     * for apples that are already on their way. Every send goes through
     * ModuleHandler.heal, so counting here counts all of them, not just the
     * ones AntiInsta asked for. */
    _sent = null;
    _wasDodging = false;
    /* What the heal path is allowed to do this tick, decided once here and
     * read by AntiInsta and by ModuleHandler.heal rather than re-derived. */
    plan = {
      allow: false,
      urgent: false,
      count: 0,
      waitMs: 0,
      reason: "idle"
    };
    constructor(client2) {
      this.client = client2;
      this.shame = new ShameEngine(client2);
      this.budget = new PacketBudget(client2);
      this.threats = new ThreatEngine(client2);
      this.defence = new DefenceState(client2);
      this.evasion = new ProjectileEvasion(client2);
    }
    reset() {
      this.budget.reservations.length = 0;
      this.shame.hitAt = null;
      this.shame.spentAt = null;
      this.shame.damageStreak = 0;
      this._sent = null;
    }
    /* Called by ModuleHandler.heal on every apple that reaches the wire. */
    noteHealSent(tick, health) {
      if (this._sent && this._sent.health === health) this._sent.count += 1;
      else this._sent = { count: 1, tick: tick, health: health };
    }
    /* Apples already sent for health the server has not answered yet. Cleared
     * as soon as health moves — the acknowledgement — or once the round trip
     * plus a tick has passed, which is when a lost send stops being pending and
     * starts being a reason to send again. */
    inFlight(tick, health) {
      const sent = this._sent;
      if (!sent) return 0;
      if (sent.health !== health) {
        this._sent = null;
        return 0;
      }
      const wait = Math.ceil(this.shame.pong() / RPE_TICK_MS) + 1;
      if (tick - sent.tick > wait) {
        this._sent = null;
        return 0;
      }
      return sent.count;
    }
    /* Runs first in the module list, so everything downstream reads a state
     * that is already settled for this tick. */
    postTick() {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      const tick = ModuleHandler.tickCount;
      this.plan.allow = false;
      this.plan.urgent = false;
      this.plan.count = 0;
      this.plan.waitMs = 0;
      this.plan.reason = "idle";
      this.wantSoldier = false;
      this.budget.expire(tick);
      if (!myPlayer || !myPlayer.inGame || !Settings_default._survivalEngine) {
        this.budget.release("survival");
        return;
      }
      this.shame.sync(tick);
      this.threats.build(tick);

      /* One defensive gear decision, taken here and nowhere else.
       *
       * Bull is written straight to forceHat because ShameReset now defers and
       * nothing else wants it. Soldier is only *requested*: the client's Safe
       * Soldier block runs after every module and owns that hat on proximity,
       * and it is not this layer's to rewrite. What the request adds is the
       * threats proximity cannot see — a turret stack at 600 units, a ranged
       * sequence, a spike push that has not closed yet. */
      const want = this.defence.decide(tick, this.threats, this.shame);
      this.wantSoldier = want === SV_SOLDIER && Settings_default._survivalSoldier;
      if (want === SV_BULL) {
        ModuleHandler.moduleActive = true;
        ModuleHandler.forceHat = SV_BULL;
      }

      /* The sidestep. moveTo is the client's existing "a module wants to move
       * me" channel — AutoPush already uses it and SafeWalk already acts on the
       * transition — so this adds a writer, not a movement system. Handing it
       * back to "disable" is what makes the step reversible: the player's own
       * input takes over again on the tick after the last shot. */
      const dodge = this.evasion.decide(tick, this.budget, this.threats.reactionMs());
      if (dodge !== null) {
        ModuleHandler.moduleActive = true;
        ModuleHandler.moveTo = dodge;
      } else if (this._wasDodging) {
        ModuleHandler.moveTo = "disable";
      }
      this._wasDodging = dodge !== null;

      const foodID = myPlayer.getItemByType(2);
      const food = foodID === null || foodID === undefined ? null : Items[foodID];
      const missing = myPlayer.maxHealth - myPlayer.tempHealth;

      /* Reservation first, before anything else in the tick has had a chance to
       * spend. A lethal threat holds exactly what it would take to heal out of
       * it and not a packet more; §28's point is that the reserve is a floor
       * under an emergency, not a licence to hoard. */
      if (this.threats.lethal && food && missing > 0) {
        const need = Math.ceil(missing / food.restore) * SV_HEAL_COST;
        this.budget.reserve("survival", Math.min(need, SV_HEAL_COST * 4), SV_THREAT.LETHAL, tick, 2);
      } else {
        this.budget.release("survival");
      }

      if (!Settings_default._autoheal || myPlayer.shameActive || !food || missing <= 0) {
        this.plan.reason = myPlayer.shameActive ? "food banned" : !food ? "no food" : missing <= 0 ? "full" : "off";
        return;
      }

      const now = Date.now();
      const verdict = this.shame.verdict(now);
      const urgent = this.threats.lethal || myPlayer.tempHealth <= this.threats.incoming;

      /* The one place the old code was wrong in a way that could kill: it
       * called an emergency heal and then let the shame guard queue it to the
       * next tick boundary. Eating into the window costs one shame; not eating
       * costs the round. The only thing that outranks the emergency is the ban
       * itself, because a thirty-second refusal to eat is not survivable
       * either — and that is a state the old model could not even represent. */
      if (urgent) {
        if (this.shame.wouldBan(now) && this.shame.msUntilSafe(now) <= RPE_TICK_MS) {
          this.plan.waitMs = this.shame.msUntilSafe(now);
          this.plan.reason = "eat would ban, safe within a tick";
          return;
        }
        this.plan.allow = true;
        this.plan.urgent = true;
        this.plan.reason = "lethal: " + (this.threats.top ? this.threats.top.kind : "damage");
      } else if (verdict === "neutral") {
        /* hitTime is spent or was never armed, so this eat cannot move shame in
         * either direction. Top up freely — this is the case the old code kept
         * blocking for a rule that no longer applied to it. */
        this.plan.allow = true;
        this.plan.reason = "no pending hit: shame-neutral";
      } else if (verdict === "safe") {
        /* Past the window with a hit still unanswered: this eat takes 2 off.
         * Worth taking even at full-ish health when shame is above zero, which
         * is what keeps the target at 0 instead of at 7. */
        this.plan.allow = true;
        this.plan.reason = this.shame.shame > 0 ? "recovering shame " + this.shame.shame + " -> " + Math.max(0, this.shame.shame - 2) : "safe top-up";
      } else {
        /* Inside the window and not dying. Waiting is free and eating is not. */
        this.plan.waitMs = this.shame.msUntilSafe(now);
        this.plan.reason = "inside shame window, " + Math.round(this.plan.waitMs) + "ms to safe";
        return;
      }

      const priority = this.plan.urgent ? SV_THREAT.LETHAL : SV_THREAT.DAMAGE;
      /* The minimum that closes the hole, less what is already on its way, and
       * no more than the budget allows. §27 asks for the minimum required to
       * survive, not the maximum available. */
      const wanted = Math.ceil(missing / food.restore) - this.inFlight(tick, myPlayer.tempHealth);
      const affordable = this.budget.affords(SV_HEAL_COST, priority, this.plan.urgent ? "survival" : undefined);
      this.plan.count = Math.max(0, Math.min(wanted, affordable));
      if (this.plan.count === 0) {
        this.plan.allow = false;
        this.plan.reason = wanted <= 0 ? "already in flight" : "no packet budget";
      }
    }
  }
  const SurvivalEngine_default = SurvivalEngine;
