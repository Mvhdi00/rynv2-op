/*
 * ryn-autoheal-engine.js — RYN Auto Heal Engine
 *
 * A new heal engine for the RYN client, built from the shipped game bundle
 * rather than from any existing mod's heal code. Design notes and the full
 * mechanic derivation live in docs/AUTOHEAL_ENGINE.md; the short version is at
 * the top of each class below, with the bundle line each rule comes from.
 *
 * It is injected into the client by tools/build-autoheal.js as one module in
 * ModuleHandler's list: `moduleName`, `constructor(client)`, `postTick()`,
 * `reset()`. Everything it knows about the client is read through HostAdapter,
 * and the only writes it makes are its own food presses plus the tick-claim
 * fields every RYN module sets.
 *
 * The file is dependency-injected so it parses and can be reasoned about on its
 * own: `createRynAutoHealEngine(deps)` returns the module class. `deps` is read
 * lazily (the builder passes getters) because the client's `Settings_default`
 * is declared after the point the engine is spliced in.
 */

/* eslint-disable no-unused-vars */

function createRynAutoHealEngine(deps) {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Constants — every one of these is a fact from the shipped bundle.
   * tools/verify-autoheal.js re-derives them and fails the build on drift.
   * ------------------------------------------------------------------ */
  const AH = {
    /* game_index.js:2462 — `W <= 120` decides +1 vs -2. */
    SHAME_WINDOW_MS: 120,
    /* The window is measured on the server. What we can compute locally is a
     * lower bound (see ShameController.verdict), so a few ms of slack keeps a
     * borderline press on the safe side of it. RYN's own gate uses 125. */
    SHAME_WINDOW_MARGIN_MS: 5,
    /* game_index.js:2464 — `shameCount >= 8` arms the lock. */
    SHAME_LOCK_AT: 8,
    /* game_index.js:2465 — `shameTimer = 3e4`. */
    SHAME_LOCK_MS: 30000,
    /* game_index.js:2466 — a late press is worth -2. */
    SHAME_CREDIT: 2,
    /* The objective: never send the press that would reach SHAME_LOCK_AT. */
    SHAME_MAX: 7,

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

    /* Hats that matter to healing. */
    HAT_SHAME: 45,       // worn during the lock; game_index.js:2603
    HAT_SOLDIER: 6,      // dmgMult 0.75
    HAT_BULL: 7,         // healthRegen -5 -> self-damage every DOT tick
    HAT_ASSASSIN: 56,    // noEat: food is refused outright, game_index.js:2462

    /* Item type 2 is the food slot in RYN's inventory map. */
    FOOD_TYPE: 2,
    /* One press is select + attack + re-select weapon. */
    PACKETS_PER_PRESS: 3,
    /* novastorm's cap on a single tick's predicted damage; the largest real
     * one-tick burst in the tables (katana 40*1.18 + spinning spikes 45 +
     * turret 25) sits just under it. */
    DMG_CAP: 140,

    /* Shame control.
     *
     * The zones are the objective's own: 0 is SAFE, 1-6 is WARNING, 7 is
     * CRITICAL. WARN_HIGH is where "approaching 7" starts and defensive
     * priority rises — two points short of the ceiling, which is one charged
     * press plus the credit that would undo it. */
    SHAME_WARN_HIGH: 5,
    SHAME_HORIZON_TICKS: 9,        // one DoT period: the forecast horizon
    SHAME_RATE_WINDOW_TICKS: 45,   // five seconds of history for the rates
    /* How much of a predicted threat has to be the deterministic kind before
     * the engine spends food on it. Below LOW it is a rumour, not a forecast. */
    CONFIDENCE_HIGH: 0.7,
    CONFIDENCE_LOW: 0.4,

    /* Threat detection — ids straight out of drivers/game-drivers.json. */
    WEAPON_POLEARM: 5,
    WEAPON_DAGGER: 7,
    WEAPON_BOW: 9,
    WEAPON_HAMMER: 10,
    WEAPON_CROSSBOW: 12,
    WEAPON_REPEATER: 13,
    WEAPON_MUSKET: 15,
    PROJ_TURRET: 1,
    PROJ_MUSKET: 5,
    PROJ_ARROWS: [0, 2, 3],       // hunting bow, crossbow, repeater crossbow
    ITEM_TRAP: 15,                // pit trap
    ITEM_TURRET: 17,
    GROUP_SPIKES: 2,
    HAT_TURRET_GEAR: 53,
    TURRET_RANGE: 700,            // items[17].shootRange
    /* The band a turret's knockback leaves a target in, which is what a
     * velocity tick is aimed through. RYN's own VelocityTick uses 220-245 as
     * the window and the client carries ANTI_VELOCITY_TICK_MIN = 150; this is
     * the detection band around both. */
    VELOCITY_BAND_MIN: 150,
    VELOCITY_BAND_MAX: 270,
    /* A run of spike contacts is one sequence until this many quiet ticks. */
    SPIKE_SEQUENCE_GAP_TICKS: 12,
    /* Windows the repeated-pressure detectors count hits over. */
    PRESSURE_WINDOW_TICKS: 9,
    SUSTAINED_WINDOW_TICKS: 27,

    /* Predictive defense. Short-term only: past about two thirds of a second
     * a moomoo fight has changed shape, and a prediction that far out is a
     * guess wearing a number. */
    PREDICT_HORIZON_TICKS: 6,
    PREEMPT_HORIZON_TICKS: 3,
    /* How far a prediction may be reused before it is rebuilt regardless of
     * whether anything looked like it changed. */
    PREDICT_MAX_AGE_TICKS: 9,
    /* Invalidation thresholds, in the units the client already measures. */
    PREDICT_TURN_RADIANS: Math.PI / 4,   // a real course change
    PREDICT_STOP_SPEED: 0.5,             // TargetMotion's own "standing still"
    PREDICT_MOVING_SPEED: 2,             // ...and what counts as having moved
    PREDICT_PLAYER_MOVE_PX: 60,          // my own position moving significantly
    /* Only enemies this close are worth tracking motion for. */
    PREDICT_RELEVANT_RANGE: 700,
    PREDICT_MAX_TRACKED: 4,

    /* Engine pacing. */
    MAX_PRESSES_PER_TICK: 6,
    /* A press sent during tick T is processed by the server on tick T+1, so its
     * result is in the health we read on T+1 or, with a round trip in the way,
     * T+2. Holding the expectation any longer than that is how an engine talks
     * itself out of healing: damage on the tick the heal landed hides the rise,
     * the ledger keeps claiming health that is already gone, and the projection
     * sits at full while the bar drops. */
    INFLIGHT_TTL_TICKS: 1,
    HOLD_TICKS_DEFAULT: 1,
    PACKET_RESERVE_PLACER: 12,
    PACKET_RESERVE_MILL: 6,
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
   * the levels above it are earned by what is actually observable, not by how
   * bad the situation would be if it were true. */
  const CONFIDENCE = {
    NONE: "NONE",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL"
  };
  const CONFIDENCE_VALUE = {
    NONE: 0,
    LOW: 0.25,
    MEDIUM: 0.5,
    HIGH: 0.75,
    CRITICAL: 1
  };
  const CONFIDENCE_RANK = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

  /* The threat types the engine reports. */
  const THREAT = {
    INSTAKILL: "instakill",
    SPIKE_TICK: "spike-tick",
    INSTA_REV: "insta-rev",
    MUSKET: "musket",
    BOW: "bow",
    SPAM_DAGGER: "spam-dagger",
    VELOCITY_TICK: "velocity-tick",
    SPIKE: "spike",
    TRAP: "trap",
    BURST: "burst",
    SUSTAINED: "sustained"
  };

  /* The shame zones the control engine switches on. */
  const ZONE = {
    SAFE: "safe",        // 0        — nothing owed, so nothing is spent chasing it
    WARNING: "warning",  // 1 to 6   — take the earliest valid chance to come down
    CRITICAL: "critical" // 7        — no charged press may leave, at all
  };

  /* What the healing side is doing, for the tracker. */
  const HEAL_STATE = {
    IDLE: "idle",
    PRESSING: "pressing",
    AWAITING: "awaiting",   // pressed, result not seen yet
    BACKOFF: "backoff",     // presses are not landing; stopped asking
    LOCKED: "locked"
  };

  const COOLDOWN_STATE = {
    FREE: "free",
    HOLDING: "holding",     // deliberately waiting for the shame window
    BACKOFF: "backoff"
  };

  /* Urgency classes, ordered. See docs/AUTOHEAL_ENGINE.md#priority-model. */
  const URGENCY = {
    BLOCKED: 0,
    IDLE: 1,
    TOPUP: 2,
    WASH: 3,
    PREEMPT: 4,
    SUSTAIN: 5,
    CRITICAL: 6,
    LOCKGUARD: 7
  };

  /* What the decision engine concluded. Every one of these carries a reason,
   * and the reason is the arithmetic that produced it rather than a label. */
  const DECISION = {
    HEAL_NOW: "HEAL_NOW",       // pressing now is worth more than pressing later
    WAIT: "WAIT",               // pressing later is worth more, and why
    PREPARE: "PREPARE",         // no press, but set up a better one (the bull wash)
    CANCEL: "CANCEL",           // dropped: refused, outranked, or illegal
    RECALCULATE: "RECALCULATE"  // the world moved under the plan; re-plan next tick
  };

  /* Why a cached prediction was thrown away. Named rather than boolean because
   * which one fired is the useful thing in a trace. */
  const INVALIDATION = {
    NONE: "",
    FIRST: "first",
    AGE: "aged-out",
    TARGET: "target-changed",
    TURNED: "enemy-turned",
    STOPPED: "enemy-stopped",
    PROJECTILE: "projectile-changed",
    COLLISION: "collision-changed",
    MOVED: "player-moved",
    GONE: "threat-gone",
    WORLD: "world-changed"
  };

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const num = v => (typeof v === "number" && isFinite(v) ? v : null);

  /* ================================================================== *
   * 12. HostAdapter — the integration layer.
   *
   * Every read of the client happens here and nowhere else, and every read is
   * guarded: a future RYN change should cost the engine an opinion, not throw
   * inside ModuleHandler's module loop.
   * ================================================================== */
  class HostAdapter {
    constructor(client) {
      this.client = client;
      this._warned = false;
    }

    get Items() { return deps.Items; }
    get Hats() { return deps.Hats; }
    get Accessories() { return deps.Accessories; }
    get Settings() { return deps.Settings; }
    /* Used only by the ranged detectors, to say what a held weapon's shot would
     * be worth. Optional: without them that branch reports 0 severity rather
     * than guessing a number. */
    get Weapons() { return deps.Weapons; }
    get Projectiles() { return deps.Projectiles; }

    get mh() { return this.client && this.client._ModuleHandler; }
    get me() { return this.client && this.client.myPlayer; }

    /* The engine's own switches. */
    get enabled() { return !!(this.Settings && this.Settings._autoHealEngine); }
    get washEnabled() { return !!(this.Settings && this.Settings._autoHealWash); }
    get strict() { return !!(this.Settings && this.Settings._autoHealStrict); }
    get reserveHealth() {
      const v = this.Settings && num(this.Settings._autoHealReserve);
      return v === null ? 15 : clamp(v, 0, 40);
    }

    /* The client's Player.maxHealth is `Math.LN1`, i.e. undefined (v5.4:3294,
     * v4:3252), which makes every comparison against it false and every
     * subtraction NaN. The server's own value is 100 (game_index.js:2234), so
     * that is what the engine uses unless the client ever starts reporting a
     * real number. */
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
       * (ModuleHandler._equip records it in store[type].last, v5.4:16871).
       * ModuleHandler.shouldEquipSoldier is no use here: it is cleared before
       * the module loop and only set again after it (v5.4:17119, :17158). */
      const storeHat = mh.store && mh.store[0] ? mh.store[0].last : null;

      return {
        now,
        tick: num(me.tickCount) || 0,
        TICK: (sock && num(sock.TICK)) || AH.TICK_MS,
        pong: Math.max(0, (sock && num(sock.pong)) || 0),

        inGame: !!me.inGame,
        sandbox: !!me.isSandbox,
        health: num(me.currentHealth) === null ? AH.MAX_HEALTH : me.currentHealth,
        prevHealth: num(me.previousHealth) === null ? AH.MAX_HEALTH : me.previousHealth,
        maxHealth: this.maxHealth(),

        foodId,
        restore: foodItem && num(foodItem.restore) ? foodItem.restore : 0,
        foodCost: foodItem && foodItem.cost && num(foodItem.cost.food) ? foodItem.cost.food : 0,
        isCheese: !!(foodItem && foodItem.name === "cheese"),
        foodStock: num(res.food) === null ? 0 : res.food,

        hatId,
        accId,
        storeHat,
        noEat: !!(hat && hat.noEat),
        soldierOn: hatId === AH.HAT_SOLDIER || storeHat === AH.HAT_SOLDIER,
        bullOn: hatId === AH.HAT_BULL || storeHat === AH.HAT_BULL,
        hatRegen: (hat && num(hat.healthRegen)) || 0,
        accRegen: (acc && num(acc.healthRegen)) || 0,

        /* RYN's client-side replay of the server shame rule (Player.updateHealth,
         * v5.4:3484-3518). It clamps to 0..7 and only moves when health is seen
         * to rise, which is why ShameController keeps its own count too. */
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

        threat: this._readThreat(em, pm),
        systems: this._readSystems(mh, storeHat)
      };
    }

    /* Combat's own numbers. The engine does not re-derive damage; it reads what
     * EnemyManager already summed this tick (v5.4:3113-3143). */
    _readThreat(em, pm) {
      if (!em) {
        return {
          potential: 0, spike: 0, spikeKB: 0, primary: 0, projectile: 0,
          instaThreat: false, dangerEnemy: false, dangerNoSoldier: false,
          collidingSpike: false, willCollideSpike: false, nearestDistance: Infinity
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
        /* Anti Sync drives its own presses through ModuleHandler.heal. */
        antiSync: !!S._antiSync,
        /* Safe Soldier / soldier default own the hat and the 0.75 multiplier. */
        safeSoldier: !!S._safeSoldier,
        soldierClaimed: mh ? mh.forceHat === AH.HAT_SOLDIER || storeHat === AH.HAT_SOLDIER : false,
        /* Placement systems share the packet budget with us. */
        placer: !!(S._autoplacer || S._prePlace || S._replace),
        placementEngineBusy: has(s.placementEngine) && !!s.placementEngine.sending,
        /* Spike ticks commit a tick to a placement combo. */
        spikeTick: (has(s.spikeSync) && !!S._spikeSync) ||
                   (has(s.spikeSyncHammer) && !!S._spikeSyncHammer) ||
                   (has(s.trapTick) && !!s.trapTick.active),
        /* Auto Mills drops three windmills in a tick when it fires. */
        mills: has(s.autoMill) && !!s.autoMill.isActive,
        /* Velocity Tick owns Bull for its combo; never contest it. */
        velocityArmed: has(s.velocityTick) &&
          (s.velocityTick.nearestTarget !== null || s.velocityTick.target !== null)
      };
    }

    /* ---- combat evidence, for the threat engine --------------------- *
     *
     * Everything here is state the client already computes for its own combat
     * modules. None of it is re-derived, and none of it is an assumption about
     * what an enemy might do: a weapon id is only ever reported alongside the
     * reload, range and facing that say whether it can be used on us right now.
     */

    /* One entry per live enemy, with the state a detector is allowed to reason
     * from. Distances are measured against my player's own position. */
    enemyList() {
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
          if (distance > 0) {
            const angleTo = enemy.pos.current.angle(me.pos.current);
            const offset = Math.asin(Math.min(1, (2 * (num(me.scale) || 35)) / (2 * distance)));
            facing = Math.abs(this._angleDist(angleTo, num(enemy.angle) || 0)) <= offset;
          }
          out.push({
            ref: enemy,
            id: enemy.id,
            distance,
            facing,
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
            secondaryEmpty: this._emptyReload(enemy, 1),
            turretEmpty: this._emptyReload(enemy, 2),
            primaryRange: this._weaponRange(enemy, primary),
            secondaryRange: this._weaponRange(enemy, secondary),
            primaryDamage: this._weaponDamage(enemy, primary),
            secondaryDamage: this._weaponDamage(enemy, secondary),
            hatId: num(enemy.hatID) || 0,
            health: num(enemy.currentHealth),
            trapped: !!enemy.isTrapped,
            usingBoost: !!enemy.usingBoost,
            lastAttacked: num(enemy.lastAttacked) || 0,
            /* the client's own per-enemy verdicts */
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

    _angleDist(a, b) {
      let d = (a - b) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    }

    /* Moving toward me, in the sense the client's own Entity uses: last tick's
     * travel direction against the direction to me. */
    _closing(enemy, me) {
      try {
        const prev = enemy.pos.previous, cur = enemy.pos.current;
        if (!prev || !cur) return 0;
        const before = prev.distance(me.pos.current);
        const after = cur.distance(me.pos.current);
        return before - after;
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

    /* Projectiles already in the air and already established as being on a line
     * to me — the client adds a projectile to dangerProjectiles only after its
     * own facing test (ProjectileManager.foundProjectile). Fired, not owned. */
    incomingProjectiles(snap) {
      const client = this.client;
      const me = this.me;
      const pm = client && client.ProjectileManager;
      if (!pm || !pm.dangerProjectiles || !me || !me.pos) return [];
      const out = [];
      try {
        for (const proj of pm.dangerProjectiles) {
          if (!proj || !proj.pos || !proj.pos.current) continue;
          const distance = proj.pos.current.distance(me.pos.current);
          const speed = num(proj.speed) || 0;
          const tick = snap && snap.TICK ? snap.TICK : AH.TICK_MS;
          out.push({
            ref: proj,
            type: num(proj.type),
            damage: num(proj.damage) || 0,
            distance,
            /* the client's own arrival arithmetic, from
             * ProjectileManager.foundProjectileThreat */
            ticksToImpact: speed > 0 ? Math.ceil(distance / (speed * tick)) : Infinity,
            life: num(proj.life) || 0,
            isTurret: !!proj.isTurret
          });
        }
      } catch (_) { return out; }
      return out;
    }

    /* Spikes near enough to matter, and whether one is actually being touched.
     * The collision flags are EnemyManager's, computed in its own pass. */
    spikeContext(snap) {
      const em = this.client && this.client.EnemyManager;
      const me = this.me;
      const out = {
        colliding: false, willCollide: false, pushing: false,
        damage: 0, nearestDistance: Infinity, pusher: null
      };
      if (!em) return out;
      out.colliding = !!em.collidingSpike;
      out.willCollide = !!em.willCollideSpike;
      out.pushing = !!em.pushingOnSpike;
      out.damage = Math.max(num(em.potentialSpikeDamage) || 0,
        num(em.potentialSpikeKnockbackDamage) || 0);
      try {
        const spike = em.nearestSpike || em.spikeCollider || em.nearestCollider;
        if (spike && spike.pos && spike.pos.current && me && me.pos) {
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
      const client = this.client;
      const me = this.me;
      const em = client && client.EnemyManager;
      const out = {
        trapped: false, enemyOwned: false, health: 0, breakable: false,
        breakTicks: Infinity, nearestDistance: Infinity
      };
      if (!me) return out;
      out.trapped = !!me.isTrapped;
      try {
        const trap = me.trappedIn;
        if (trap) {
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

    /* A turret that can reach me: the client tracks the nearest one for its own
     * anti-turret term. */
    turretContext() {
      const em = this.client && this.client.EnemyManager;
      const me = this.me;
      const out = { present: false, distance: Infinity };
      if (!em || !me || !me.pos) return out;
      try {
        const turret = em.nearestTurretEntity;
        if (turret && turret.pos && turret.pos.current) {
          out.present = true;
          out.distance = me.pos.current.distance(turret.pos.current);
        }
      } catch (_) {}
      return out;
    }

    /* RYN's own priority scale, read rather than reinvented.
     *
     * The placement engine defines RPE_PRIORITY — INSTA 90, SYNC 80, DEFENSE
     * 70, RECOVERY 60, ANTICIPATION 50, ENGAGEMENT 40, UTILITY 20 — and
     * classifies module names into it with `priorityFor`. Healing and placing
     * are then ranked by one authority instead of two, which is the point:
     * a heal that answers a lethal burst should outrank a sync, and a top-up
     * should not.
     *
     * The fallback numbers are the same scale, used only if the placement
     * engine is absent. */
    priorityClass(name) {
      const fallback = {
        INSTA: 90, SYNC: 80, DEFENSE: 70, RECOVERY: 60,
        ANTICIPATION: 50, ENGAGEMENT: 40, UTILITY: 20
      };
      try {
        const engine = this.mh && this.mh.staticModules && this.mh.staticModules.placementEngine;
        /* priorityFor maps a module name onto the scale; these probes are the
         * names its own classifier recognises for each class. */
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
        const engine = this.mh && this.mh.staticModules && this.mh.staticModules.placementEngine;
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
     * it into velocity, acceleration, heading, heading shift, a stability score
     * and `predict(ticks) -> {x, y, confidence}` with a horizon decay, plus
     * `intercept()` for the earliest tick a path enters a circle. Writing a
     * second one would be writing that twice.
     *
     * So the class is borrowed and a private instance constructed from it. The
     * instance matters: sharing the placement engine's own tracks would mean
     * observing entities on its behalf, on our tick basis, into state its
     * planner reads — which is exactly the kind of reach into another system
     * this engine is not allowed. Same code, separate tracks, no interference.
     *
     * Returns null when the placement engine is not present; MotionSource then
     * falls back to the linear extrapolation every Entity already carries. */
    borrowTargetMotion() {
      try {
        const mh = this.mh;
        const engine = mh && mh.staticModules && mh.staticModules.placementEngine;
        const motion = engine && engine.motion;
        if (!motion || typeof motion.observe !== "function" ||
            typeof motion.predict !== "function") return null;
        const Ctor = motion.constructor;
        if (typeof Ctor !== "function") return null;
        const instance = new Ctor();
        return typeof instance.observe === "function" ? instance : null;
      } catch (_) { return null; }
    }

    /* Standing on a healing pad is +15/s of real health income
     * (game_index.js:2322, item 19 healCol 15) and belongs in the projection. */
    healingPadRegen(snap) {
      const om = this.client && this.client.ObjectManager;
      const Items = this.Items;
      if (!om || !om.grid2D || !om.objects || !snap || !snap.pos || !Items) return 0;
      let best = 0;
      try {
        om.grid2D.query(snap.pos.x, snap.pos.y, 1, id => {
          const obj = om.objects.get(id);
          if (!obj || obj.itemGroup !== 9) return;
          const item = Items[obj.type];
          const heal = item && num(item.healCol);
          if (!heal) return;
          const p = obj.pos && obj.pos.current;
          if (!p) return;
          const reach = (num(obj.collisionScale) || num(obj.scale) || 45) + snap.scale;
          if (snap.pos.distance(p) <= reach && heal > best) best = heal;
        });
      } catch (_) { return 0; }
      return best;
    }

    /* One press of food: the three frames ModuleHandler.place/heal send, minus
     * heal()'s own gate. The engine gates its presses itself, and has to, for
     * two reasons heal() cannot serve: an emergency press must not be held for
     * a tick, and a charged press at shameCount 7 must never leave at all (it
     * cannot heal — game_index.js:2465-2469 sets the lock before consume is
     * reached). Going through ModuleHandler's own methods keeps currentHolding,
     * the sent-angle priority and the packet counter consistent. */
    pressFood() {
      const mh = this.mh;
      if (!mh) return false;
      try {
        mh.selectItem(AH.FOOD_TYPE);
        mh.attack(null, 1);
        mh.whichWeapon(mh._getPredictWeapon());
        return true;
      } catch (e) {
        return this._pressFailed(e);
      }
    }

    /* The same two frames without the weapon restore, so a burst can pay for
     * that once at the end instead of once per press. Select is not optional:
     * a successful consume clears buildIndex server-side
     * (game_index.js:2476), so the next attack would swing rather than eat. */
    pressFoodOnly() {
      const mh = this.mh;
      if (!mh) return false;
      try {
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

    /* The live read that runs immediately before a press.
     *
     * Deliberately not the full snapshot: this is on the execution path, and
     * everything here is a direct field read off two objects the client has
     * already updated this tick. No grid queries, no enemy walk, no
     * projectile scan — those belong to the decision, which has already
     * happened. What is left is exactly the state that decides whether the
     * press about to leave is still the right one. */
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
        restore: item && num(item.restore) ? item.restore : 0,
        foodCost: item && item.cost && num(item.cost.food) ? item.cost.food : 0,
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

    packetsLeft() {
      const mh = this.mh;
      if (!mh) return 0;
      const used = num(mh.packetCount) || 0;
      const limit = num(mh.packetLimit) || 119;
      return Math.max(0, limit - used);
    }

    claimTick(critical) {
      const mh = this.mh;
      if (!mh) return;
      mh.moduleActive = true;
      mh.healedOnce = true;
      if (critical) mh.didAntiInsta = true;
    }

    /* Bull is requested through setForceHat, which is a no-op when another
     * module already claimed a hat this tick (v5.4:16769). That is the whole of
     * the engine's "do not fight other systems" contract for gear. */
    requestBullHat() {
      const mh = this.mh;
      if (!mh || mh.forceHat !== null) return false;
      let owned = false;
      try { owned = !!mh.canBuy(0, AH.HAT_BULL); } catch (_) { owned = false; }
      if (!owned) return false;
      mh.setForceHat(AH.HAT_BULL);
      mh.moduleActive = true;
      return true;
    }
  }

  /* ================================================================== *
   * 1. StateTracker — the self model, and the hit latch.
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
      this.healLandedThisTick = false;
      this.hiddenDamage = 0;
      this.cheeseUntil = 0;
      this.alive = false;
    }

    update(snap, ledger) {
      const wasAlive = this.alive;
      this.alive = snap.inGame;
      if (!wasAlive && this.alive) this.onSpawn();

      this.tick = snap.tick;
      this.lastTickAt = snap.now;
      this.tickStartedAt = snap.now;
      this.prevHealth = this.health;
      this.health = snap.health;
      this.delta = this.health - this.prevHealth;
      this.healLandedThisTick = this.delta > 0;

      this.history.push({ tick: snap.tick, at: snap.now, health: this.health, delta: this.delta });
      if (this.history.length > 32) this.history.shift();

      /* Damage sets hitTime server-side on every negative changeHealth
       * (game_index.js:2422) — enemy hits, spike contact, poison and the Bull
       * helmet's own -5 regen all count. */
      /* Damage that landed on the same tick as a heal is invisible in the net
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

      if (this.delta < 0) {
        this.hitAt = snap.receivedDamage !== null ? snap.receivedDamage : snap.now;
        this.hitTick = snap.tick;
        this.pending = true;
      } else if (this.hiddenDamage >= 1) {
        this.hitAt = snap.now;
        this.hitTick = snap.tick;
        this.pending = true;
      } else if (snap.receivedDamage !== null && snap.receivedDamage > this.hitAt) {
        /* Damage the health sampler missed between ticks. */
        this.hitAt = snap.receivedDamage;
        this.hitTick = snap.tick;
        this.pending = true;
      }

      /* The latch is cleared only by a food press, because that is the only
       * thing that clears hitTime on the server (game_index.js:2463). Health
       * rising does not: regen gear and healing pads raise health with the hit
       * still pending, so clearing on a rise would let a charged press through
       * believing it was free. `healedOnce` covers presses the modules ahead of
       * us in the tick sent through ModuleHandler.heal. */
      if (snap.healedOnce) this.pending = false;

      if (snap.now > this.cheeseUntil) this.cheeseUntil = 0;
    }

    onSpawn() {
      this.hitAt = 0;
      this.hitTick = null;
      this.pending = false;
      this.history.length = 0;
      this.cheeseUntil = 0;
    }

    notePress(snap) {
      this.pending = false;
      this.lastPressTick = snap.tick;
      this.lastPressAt = snap.now;
      /* Cheese leaves dmgOverTime.dmg = -10 for 5 seconds, i.e. +10/s
       * (game_index.js:1897). Only counted once the press is believed to have
       * landed, which PredictionEngine checks against the health it sees. */
      if (snap.isCheese) this.cheeseUntil = snap.now + 5000;
    }

    /* Damage seen over the last DOT period, used as the sustained-pressure
     * term in the decision. */
    recentDamage(ticks) {
      let sum = 0;
      for (let i = this.history.length - 1, n = 0; i >= 0 && n < ticks; i--, n++) {
        if (this.history[i].delta < 0) sum -= this.history[i].delta;
      }
      return sum;
    }
  }

  /* ================================================================== *
   * 2. DamageAnalyzer — what just hit us, and when the next self-inflicted
   *    tick lands.
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
      this.damageFrequency = 0;
    }

    update(snap, state) {
      this.burst = Math.max(state.delta < 0 ? -state.delta : 0, state.hiddenDamage);
      this.rate = state.recentDamage(AH.DOT_PERIOD_TICKS);
      this.underFire = snap.tick - snap.damageTick <= 1;

      /* Damage events per second over the rate window. This is the term the
       * shame forecast multiplies: every hit is a stamp on hitTime, and every
       * stamp is a +1 or a -2 waiting to be decided. */
      if (this.burst > 0) this.hits.push(snap.tick);
      while (this.hits.length && snap.tick - this.hits[0] > AH.SHAME_RATE_WINDOW_TICKS) {
        this.hits.shift();
      }
      this.damageFrequency =
        this.hits.length / ((AH.SHAME_RATE_WINDOW_TICKS * snap.TICK) / 1000);

      /* Signed damage-over-time per second. Bull is healthRegen -5
       * (drivers: hats[7]) and poison is a flat -5 while poisonCount is set
       * (v5.4:6267-6277, matching game_index.js:2319). */
      const regen = snap.hatRegen + snap.accRegen;
      const poison = snap.poisonCount > 0 ? -5 : 0;
      const net = regen + poison;
      this.dotPerSecond = net < 0 ? -net : 0;
      this.regenPerSecond = net > 0 ? net : 0;
      this.dotActive = this.dotPerSecond > 0;

      /* RYN tracks the phase of the one-second tick for us: bullTick is the
       * tick a damage-over-time hit was last seen on, and isBullTickTime is
       * `(tickCount - bullTick) % 9 === 0` (v5.4:3404). The next one is
       * therefore a known number of ticks away, which is what lets the engine
       * put a heal in front of a self-inflicted hit instead of into the 120ms
       * shadow behind it. */
      const since = ((snap.tick - snap.bullTick) % AH.DOT_PERIOD_TICKS + AH.DOT_PERIOD_TICKS) %
        AH.DOT_PERIOD_TICKS;
      this.ticksUntilDot = since === 0 ? AH.DOT_PERIOD_TICKS : AH.DOT_PERIOD_TICKS - since;
      this.msUntilDot = this.ticksUntilDot * snap.TICK;
    }
  }

  /* ================================================================== *
   * 3. ShameController — the safety authority.
   *
   * The count it publishes is its own, not the client's. RYN's mirror
   * (Player.updateHealth) only moves when health is seen to rise, so it is
   * blind to presses that heal nothing — which is exactly the press this engine
   * uses to bank credit at full health. The mirror still drives every press
   * that did heal; the engine only accounts for the ones the mirror cannot see.
   * ================================================================== */
  /* ---------------------------------------------------------------- *
   * 3a. ShameTracker — what the count is doing, and how fast.
   * ---------------------------------------------------------------- */
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
      this.recentDamage = 0;
      this.damageFrequency = 0;
      this.peak = 0;
    }

    static zoneFor(count) {
      if (count >= AH.SHAME_MAX) return ZONE.CRITICAL;
      return count > 0 ? ZONE.WARNING : ZONE.SAFE;
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

      this.recentDamage = ctx.recentDamage;
      this.damageFrequency = ctx.damageFrequency;
      this.healingState = ctx.locked ? HEAL_STATE.LOCKED
        : ctx.backoff ? HEAL_STATE.BACKOFF
        : ctx.pressedLastTick ? HEAL_STATE.PRESSING
        : ctx.inFlight > 0 ? HEAL_STATE.AWAITING
        : HEAL_STATE.IDLE;
      this.cooldownState = ctx.backoff ? COOLDOWN_STATE.BACKOFF
        : ctx.holding ? COOLDOWN_STATE.HOLDING
        : COOLDOWN_STATE.FREE;
    }

    /* Two points short of the ceiling: one charged press away from a state the
     * credit that would undo it cannot be relied on to reach first. */
    get approachingCritical() {
      return this.current >= AH.SHAME_WARN_HIGH && this.current < AH.SHAME_MAX;
    }
  }

  /* ---------------------------------------------------------------- *
   * 3b. ShamePredictor — where the count is heading, and how sure we are.
   *
   * The forecast exists to answer one question early enough to matter: is the
   * next stretch of this fight going to force charged presses, and if so should
   * the engine be banking credit and topping up *now*, while presses are still
   * free? Waiting for the count to actually be high is waiting until the only
   * moves left are the expensive ones.
   *
   * Everything it multiplies by is a real number from the client. What it adds
   * is the arithmetic linking damage events to shame: one event is +1 if we
   * have to heal through it, -2 if we can afford to wait a tick, and 0 if we do
   * not eat before the next hit overwrites the stamp.
   * ---------------------------------------------------------------- */
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
       * guess. Spending food on the guess is what the objective calls wasting
       * healing resources. */
      this.confidence = threat.confidence;

      /* Damage events expected in the horizon: the observed hit frequency, plus
       * the damage-over-time tick if one falls inside it. Both are measured,
       * not assumed. */
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
       * we eat at all, so it is capped by how much healing we will actually
       * want to do. */
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

    /* Confident enough to spend food on a threat that has not landed yet. */
    get actionable() {
      return this.confidence >= AH.CONFIDENCE_LOW;
    }

    get reliable() {
      return this.confidence >= AH.CONFIDENCE_HIGH;
    }
  }

  /* ---------------------------------------------------------------- *
   * 3c. ShameOpportunity — the earliest valid way down.
   *
   * Credit is not something that accumulates; it is a single -2 attached to a
   * pending hit, and the first press after that hit either takes it or spends
   * it the wrong way. So "reduce shame" is always a question of *when*, and
   * there are exactly three answers.
   * ---------------------------------------------------------------- */
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

      if (!this.adapter.washEnabled || shame.locked || shame.count <= 0) {
        this.reason = shame.locked ? "locked" : shame.count <= 0 ? "nothing-owed" : "off";
        return this;
      }

      /* 1. A hit is pending and the window has passed: press now, take the -2.
       *    At full health it also costs no food (game_index.js:2475). */
      if (shame.verdictNow === VERDICT.CREDIT) {
        this.mode = "credit-now";
        this.etaTicks = 0;
        this.reason = "pending-hit-past-window";
        return this;
      }

      /* 2. A hit is pending but still inside the window: the credit is one tick
       *    away. Worth naming even though the decision may not be able to wait
       *    for it — that trade is made against health, not here. */
      if (shame.verdictNow === VERDICT.CHARGED) {
        this.mode = "credit-wait";
        this.etaTicks = 1;
        this.reason = "window-opens-next-tick";
        return this;
      }

      /* 3. Nothing pending. Bull Helmet's healthRegen -5 stamps a hit on the
       *    next one-second tick (game_index.js:2317), and a press after that
       *    tick is a -2 that also heals the 5 back. Only on a quiet field: Bull
       *    carries no damage reduction, so arming it in front of anything that
       *    can hit back trades health for a point a natural credit would have
       *    given free. novastorm gates its own reset the same way
       *    (`totalDmgPot == 0`). */
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

  /* ---------------------------------------------------------------- *
   * 3. ShameController — the facade the rest of the engine talks to.
   * ---------------------------------------------------------------- */
  class ShameController {
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
      this.tracker.reset();
      this.predictor.reset();
      this.opportunity.reset();
    }

    get zone() { return this.tracker.zone; }
    get safe() { return this.tracker.zone === ZONE.SAFE; }
    get warning() { return this.tracker.zone === ZONE.WARNING; }
    get critical() { return this.tracker.zone === ZONE.CRITICAL; }
    get approachingCritical() {
      return this.tracker.approachingCritical || this.predictor.willReachCritical;
    }

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
     * The wall-clock reading of the rule is that we can only bound the server's
     * gap from below — the hit landed at least half a round trip before we saw
     * it and the press arrives at least half a round trip after we send it, so
     * the gap is at least (now - hitObservedAt) + pong. That bound is correct
     * but weak: at pong 0 it says a press one tick later is still charged.
     *
     * The tick grid is sharper, and it is the shape the game actually has.
     * Both ends of the comparison happen inside the server's update pass:
     * hitTime is stamped by a changeHealth call during a tick
     * (game_index.js:2422) and the comparison runs in buildItem during a later
     * one (:2462). The gap is therefore very close to a whole number of ticks,
     * and at 1000/9 ms per tick the only value that lands inside the 120ms
     * window is one tick (111ms). Two ticks is 222ms and always credit.
     *
     * A press sent on the tick we saw the damage is processed on the tick after
     * the damage tick: one tick, charged. A press sent on any later tick is two
     * or more: credit. Every error in this model runs the safe way — a delayed
     * health packet or a pong over one tick only pushes the real gap further
     * out, never nearer.
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

    canSpendCharge(snap) {
      return this.chargeBudget(snap) >= 1;
    }

    /* Credit is only available while a hit is pending — one -2 per damage
     * event, no more (hitTime is cleared by the first press). */
    creditAvailable() {
      return this.count > 0 && this.verdictNow === VERDICT.CREDIT;
    }

    /* The wash the decision engine should take this tick, if any. "natural" is
     * a credit press against a hit that is already pending; "bull" arms the hat
     * that will stamp one on the next one-second tick. */
    planWash() {
      const mode = this.opportunity.mode;
      this.washMode = mode === "credit-now" ? "natural" : mode === "bull" ? "bull" : null;
      return this.washMode;
    }

    /* ---- validation -------------------------------------------------- *
     *
     * Nothing is pressed on a shame count that was read at the top of the tick
     * and could have moved since. The client is single-threaded, so inside one
     * postTick the window is small — but it is not nothing (another client
     * sharing this ModuleHandler, a hook, a future reordering that puts work
     * between the plan and the press), and what it costs when it is wrong is
     * the one press that arms the lock without healing.
     *
     * So the live count, the live lock and the live hit stamp are re-read
     * immediately before execution, the verdict is re-derived from them, and
     * the plan is recalculated against what came back rather than what was
     * planned: a press that is still affordable goes out under its corrected
     * verdict, one that is not is dropped and re-planned next tick. */
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
      if (verdict === VERDICT.CHARGED && gate > this.chargeSafeCount(snap) &&
          plan.urgency < URGENCY.CRITICAL) {
        /* The count went up while we were deciding, and this was not an
         * emergency: let the next tick re-plan against the new number. */
        return { ok: false, verdict, presses: 0, reason: "count-moved", changed: true };
      }

      /* Recalculate the press count against live health: a heal that landed in
       * the meantime is health we no longer have to buy. */
      if (typeof live.health === "number" && snap.restore > 0) {
        if (live.health >= snap.maxHealth && plan.urgency !== URGENCY.WASH) {
          return { ok: false, verdict, presses: 0, reason: "already-full", changed: true };
        }
        const needed = Math.ceil((snap.maxHealth - live.health) / snap.restore);
        if (plan.urgency !== URGENCY.WASH && out.presses > needed) {
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
     * wins and this one is dropped (update() clears the queue); if it does not,
     * this one lands. Either way the count moves once. */
    notePress(snap, verdict) {
      if (verdict === VERDICT.FREE) return;
      const delta = verdict === VERDICT.CHARGED ? 1 : -AH.SHAME_CREDIT;
      this.deferred.push({ tick: snap.tick, delta });
      if (verdict === VERDICT.CREDIT) this.lastWashTick = snap.tick;
    }
  }

  /* ================================================================== *
   * 4. ThreatEngine — one engine, eleven detectors.
   *
   * The damage number the heal engine spends against is still Combat's own:
   * EnemyManager has already summed weapons in range and off reload, spike
   * contact, turret and knock-onto-spike, and ProjectileManager has already
   * summed what is in the air. None of that is re-derived here.
   *
   * What the detectors add is the shape of the threat rather than its size:
   * which kind it is, how sure we are, how much it is worth and how soon it
   * lands. Every one of them is built on the same rule — evidence, not
   * possession. An enemy carrying a musket is not a musket threat. A musket
   * ball in the air on a line to me is, and so is a musket held by someone
   * facing me, in range, off reload, at a lower confidence.
   * ================================================================== */

  /* One detector's answer. `additive` says whether the severity is damage the
   * baseline has not already counted — almost always false, because Combat has
   * usually counted it, and the two places it is true are named where they are
   * set. */
  function threatReport(type, confidence, severity, timing, evidence, additive, rate) {
    return {
      type,
      confidence,
      value: CONFIDENCE_VALUE[confidence] || 0,
      rank: CONFIDENCE_RANK[confidence] || 0,
      severity: Math.max(0, Math.round(severity || 0)),
      timing: timing === undefined || timing === null ? Infinity : timing,
      evidence: evidence || [],
      additive: !!additive,
      /* Whether `severity` is one event's damage or a rate per second. The
       * sustained detector is the only rate, and the difference matters: 95
       * damage a second is ordinary pressure, while 95 damage in one hit is a
       * death. Comparing the two without the flag turns every busy fight into
       * a survival emergency. */
      rate: !!rate
    };
  }

  /* ---- 1. Anti Instakill ------------------------------------------- *
   * Catastrophic damage, which means damage that can take the whole bar in one
   * exchange. Combat has already summed the number; what this decides is
   * whether the number is backed by something that is actually about to
   * happen, and whether we could answer it if it did — a burst we can heal
   * through is not the same threat as one we cannot.
   * ---------------------------------------------------------------- */
  class AntiInstakillDetector {
    constructor() { this.id = THREAT.INSTAKILL; }

    detect(ctx) {
      const { effective, health } = ctx;
      if (effective <= 0) return null;

      const evidence = [];
      /* Deterministic components: these are happening, not merely possible. */
      if (ctx.projectiles.length) evidence.push("projectile-in-flight");
      if (ctx.spike.colliding) evidence.push("spike-contact");
      if (ctx.damage.dotActive && ctx.damage.ticksUntilDot <= 1) evidence.push("dot-tick-due");

      /* Committed sequences the client has already recognised from real state. */
      let committed = false;
      for (const e of ctx.enemies) {
        if (e.reverseInsta) { evidence.push("reverse-insta"); committed = true; }
        if (e.toolHammerInsta) { evidence.push("tool-hammer-insta"); committed = true; }
        if (e.rangedBowInsta) { evidence.push("ranged-bow-insta"); committed = true; }
        /* canPossiblyInstakill's own verdict: 3 is "kills through soldier". */
        if (e.danger >= 3) { evidence.push("enemy-danger-3"); committed = true; }
        else if (e.danger === 2) evidence.push("enemy-danger-2");
      }

      /* An enemy who can actually swing at me right now. Possession is not
       * enough: reloaded, in range, and pointed this way. */
      let inReach = false;
      for (const e of ctx.enemies) {
        const reach = Math.max(e.primaryRange, e.secondaryRange);
        if (reach > 0 && e.distance <= reach && (e.primaryReloaded || e.secondaryReloaded)) {
          inReach = true;
          if (e.facing) evidence.push("armed-in-reach-facing");
          else evidence.push("armed-in-reach");
          break;
        }
      }
      if (!evidence.length) return null;

      const deterministic = ctx.projectiles.length > 0 || ctx.spike.colliding || committed;
      const ratio = health > 0 ? effective / health : 0;

      let confidence = CONFIDENCE.NONE;
      if (ratio >= 1 && deterministic) confidence = CONFIDENCE.CRITICAL;
      else if (ratio >= 1 && inReach) confidence = CONFIDENCE.HIGH;
      else if (ratio >= 0.75 && (deterministic || inReach)) confidence = CONFIDENCE.MEDIUM;
      else if (ratio >= 0.5 && inReach) confidence = CONFIDENCE.LOW;
      else return null;

      /* What the heal engine can do about it, which is part of the threat:
       * a lethal burst with no affordable press behind it is a different
       * situation from one we can eat through. */
      const gap = ctx.maxHealth - health;
      const needed = ctx.restore > 0 ? Math.ceil(gap / ctx.restore) : Infinity;
      if (needed > ctx.pressesAffordable) evidence.push("not-enough-presses");
      if (ctx.shameCritical) evidence.push("shame-critical");

      return threatReport(this.id, confidence, effective, deterministic ? 0 : 1, evidence, false);
    }
  }

  /* ---- 2. Anti Spike Tick ------------------------------------------ *
   * Repeated spike damage, treated as one sequence rather than a series of
   * unrelated hits. The evidence for "that was a spike" is not the size of the
   * number — soldier and variants move it around — but the collision state at
   * the moment it landed, which EnemyManager computes in its own pass.
   * ---------------------------------------------------------------- */
  class AntiSpikeTickDetector {
    constructor() {
      this.id = THREAT.SPIKE_TICK;
      this.reset();
    }

    reset() {
      this.hits = [];          // ticks a spike contact took damage
      this.startTick = null;
      this.lastTick = -999;
      this.intervals = [];
      this.totalDamage = 0;
    }

    detect(ctx) {
      const tick = ctx.snap.tick;

      /* A hit counts as a spike hit when damage landed on a tick where a spike
       * was actually being touched, or the client saw us pushed onto one. */
      const tookDamage = ctx.damage.burst > 0;
      const onSpike = ctx.spike.colliding || ctx.spike.pushing;
      if (tookDamage && onSpike) {
        if (this.startTick === null || tick - this.lastTick > AH.SPIKE_SEQUENCE_GAP_TICKS) {
          /* A new sequence, not a continuation of the old one. */
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

      /* The sequence ends when the pressure does. */
      if (this.startTick !== null && tick - this.lastTick > AH.SPIKE_SEQUENCE_GAP_TICKS) {
        this.reset();
        return null;
      }
      if (!this.hits.length) return null;

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

      /* Still in contact means the next tick of it is arithmetic; out of
       * contact means the sequence is only a prediction. */
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

      return threatReport(this.id, confidence, perHit, nextIn, evidence, additive);
    }
  }

  /* ---- 3. Anti Insta Rev ------------------------------------------- *
   * The reverse instakill: secondary and turret held at empty reload so they
   * land together with a reloaded primary. The client already recognises the
   * pattern from real reload and range state (Player.canPossiblyInstakill),
   * and this reads that rather than inventing a second rule for it.
   * ---------------------------------------------------------------- */
  class AntiInstaRevDetector {
    constructor() { this.id = THREAT.INSTA_REV; }

    detect(ctx) {
      let best = null;
      for (const e of ctx.enemies) {
        const evidence = [];
        if (e.reverseInsta) evidence.push("client-reverse-insta");
        /* The reload shape on its own, without the range test having passed. */
        const held = e.secondaryEmpty && e.turretEmpty && e.primaryReloaded;
        if (held) evidence.push("secondary+turret-held");
        if (!evidence.length) continue;

        const reach = Math.max(e.primaryRange, e.secondaryRange);
        const inReach = reach > 0 && e.distance <= reach;
        if (inReach) evidence.push("in-reach");
        if (e.facing) evidence.push("facing");
        if (e.closing > 0) evidence.push("closing");

        const combined = e.primaryDamage + e.secondaryDamage +
          (ctx.turret.present ? 25 : 0);
        const lethal = combined >= ctx.health;

        let confidence;
        if (e.reverseInsta && lethal) confidence = CONFIDENCE.CRITICAL;
        else if (e.reverseInsta) confidence = CONFIDENCE.HIGH;
        else if (held && inReach && lethal) confidence = CONFIDENCE.HIGH;
        else if (held && inReach) confidence = CONFIDENCE.MEDIUM;
        else if (held) confidence = CONFIDENCE.LOW;
        else continue;

        const report = threatReport(this.id, confidence, combined, inReach ? 0 : 1,
          evidence, false);
        if (!best || report.rank > best.rank ||
            (report.rank === best.rank && report.severity > best.severity)) {
          best = report;
        }
      }
      return best;
    }
  }

  /* ---- 4/5. Anti Musket and Anti Bow ------------------------------- *
   * Ranged threats, and the clearest case of the possession rule. A musket in
   * someone's hands is not a threat; a bullet in the air on a line to me is,
   * and the client has already done that line test — dangerProjectiles only
   * contains what passed it. A held ranged weapon still counts, but lower, and
   * only with the reload, the range and the facing behind it.
   * ---------------------------------------------------------------- */
  class RangedDetector {
    constructor(id, projectileTypes, weaponIds, weaponRange) {
      this.id = id;
      this.projectileTypes = projectileTypes;
      this.weaponIds = weaponIds;
      this.weaponRange = weaponRange;
    }

    detect(ctx) {
      /* In the air, aimed at me: the strongest evidence there is. */
      let inFlight = null;
      for (const p of ctx.projectiles) {
        if (this.projectileTypes.indexOf(p.type) === -1) continue;
        if (!inFlight || p.ticksToImpact < inFlight.ticksToImpact) inFlight = p;
      }
      if (inFlight) {
        const lethal = inFlight.damage >= ctx.health;
        const soon = inFlight.ticksToImpact <= 2;
        const confidence = lethal && soon ? CONFIDENCE.CRITICAL
          : soon ? CONFIDENCE.HIGH
          : CONFIDENCE.MEDIUM;
        return threatReport(this.id, confidence, inFlight.damage, inFlight.ticksToImpact,
          ["projectile-in-flight", "impact-in:" + inFlight.ticksToImpact], false);
      }

      /* Nothing is in the air. A held weapon can still be a threat, but the bar
       * is deliberately high, because this is exactly where a threat engine
       * starts crying wolf: a musket reaches 1400, which is most of the screen,
       * so "loaded and pointed roughly at me" describes half the players on the
       * map at any moment and a mouse moves faster than a tick.
       *
       * So: it has to be loaded, it has to be pointed at me, and it has to be
       * either inside half its own reach or freshly switched to — the client's
       * own wind-up signature, bow -> crossbow -> musket, which it uses for the
       * same purpose in canPossiblyInstakill. Anything less is someone holding
       * a weapon, and this reports nothing at all for that. Never above MEDIUM
       * either: nothing has been fired. */
      let best = null;
      for (const e of ctx.enemies) {
        if (this.weaponIds.indexOf(e.weaponCurrent) === -1) continue;
        const ready = e.weaponCurrent === e.weaponPrimary ? e.primaryReloaded : e.secondaryReloaded;
        if (!ready || !e.facing) continue;

        const justSwitched = e.weaponPrevious !== null && e.weaponPrevious !== e.weaponCurrent;
        const close = e.distance <= this.weaponRange * 0.5;
        if (!close && !justSwitched) continue;

        const evidence = ["holding:" + e.weaponCurrent, "loaded", "facing"];
        if (justSwitched) evidence.push("just-switched");
        if (close) evidence.push("inside-half-reach:" + Math.round(e.distance));
        if (e.closing > 0) evidence.push("closing");

        const confidence = close && justSwitched ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;
        const report = threatReport(this.id, confidence,
          ctx.projectileDamageFor(e.weaponCurrent), 1, evidence, false);
        if (!best || report.rank > best.rank) best = report;
      }
      return best;
    }
  }

  /* ---- 6. Anti Spam Dagger ----------------------------------------- *
   * Daggers swing every 100ms — under one server tick — for 20 a hit, so the
   * threat is the frequency rather than any single number. Evidence is the
   * frequency itself: repeated damage at close range from someone holding one.
   * ---------------------------------------------------------------- */
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
        /* In reach and armed, nothing landing yet. */
        return holder.primaryReloaded && holder.facing
          ? threatReport(this.id, CONFIDENCE.LOW, holder.primaryDamage, 1,
            ["dagger-in-reach", "loaded"], false)
          : null;
      }

      const evidence = ["hits:" + count, "distance:" + Math.round(holder.distance)];
      if (holder.closing > 0) evidence.push("closing");
      const perHit = holder.primaryDamage || 20;
      const confidence = count >= 4 ? CONFIDENCE.CRITICAL
        : count >= 3 ? CONFIDENCE.HIGH
        : count >= 2 ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      /* Sustained rate over the window, expressed as what the next tick costs. */
      return threatReport(this.id, confidence, perHit * Math.min(2, count), 1, evidence, false);
    }
  }

  /* ---- 7. Anti Velocity Tick --------------------------------------- *
   * The combo aimed at us, not one of ours: a turret shot knocks the target
   * into the 150-270 band and a polearm covers the gap while they are still
   * travelling. This only reads state — the client's own VelocityTick module
   * owns the offensive side and is not touched.
   * ---------------------------------------------------------------- */
  class AntiVelocityTickDetector {
    constructor() { this.id = THREAT.VELOCITY_TICK; }

    detect(ctx) {
      if (!ctx.turret.present && !ctx.projectiles.some(p => p.isTurret)) return null;

      let best = null;
      for (const e of ctx.enemies) {
        /* The reach half of the combo: a polearm, or the bull hat that carries
         * it. Held, not owned — weaponCurrent is what is in their hands. */
        const polearm = e.weaponCurrent === AH.WEAPON_POLEARM;
        const bull = e.hatId === AH.HAT_BULL;
        const turretGear = e.hatId === AH.HAT_TURRET_GEAR;
        if (!polearm && !turretGear) continue;

        /* The band. Inside it the ordinary weapon terms already cover the
         * threat; outside it the knockback cannot bring them to us. */
        const inBand = e.distance >= AH.VELOCITY_BAND_MIN && e.distance <= AH.VELOCITY_BAND_MAX;
        if (!inBand) continue;

        const evidence = ["band:" + Math.round(e.distance)];
        if (polearm) evidence.push("polearm");
        if (bull) evidence.push("bull");
        if (turretGear) evidence.push("turret-gear");
        if (ctx.turret.present) evidence.push("turret-in-range");
        if (e.primaryReloaded) evidence.push("primary-loaded");
        if (e.closing > 0) evidence.push("closing");
        if (e.facing) evidence.push("facing");

        const armed = e.primaryReloaded && e.facing;
        const turretReady = ctx.projectiles.some(p => p.isTurret) || e.turretReloaded;
        let confidence;
        if (armed && turretReady && e.closing > 0) confidence = CONFIDENCE.HIGH;
        else if (armed && turretReady) confidence = CONFIDENCE.MEDIUM;
        else if (armed || turretReady) confidence = CONFIDENCE.LOW;
        else continue;

        const severity = e.primaryDamage + 25;   // polearm plus the turret shot
        const report = threatReport(this.id, confidence, severity, 1, evidence, false);
        if (!best || report.rank > best.rank) best = report;
      }
      return best;
    }
  }

  /* ---- 8. Anti Spike ----------------------------------------------- *
   * Direct exposure, from the collision state itself rather than from anything
   * inferred: touching one, about to touch one, or being pushed onto one.
   * ---------------------------------------------------------------- */
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

      return threatReport(this.id, confidence, s.damage, s.colliding ? 0 : 1, evidence, false);
    }
  }

  /* ---- 9. Anti Trap ------------------------------------------------ *
   * A trap is only dangerous for what it lets somebody else do. Pinned in an
   * enemy trap with someone in reach is the threat; standing next to a trap is
   * a fact.
   * ---------------------------------------------------------------- */
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
              ["trap-underfoot:" + Math.round(t.nearestDistance), "enemy-closing"], false);
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

      /* Who can reach me while I cannot move. */
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
      else if (t.enemyOwned && this.damageWhileTrapped > 0) confidence = CONFIDENCE.MEDIUM;
      else if (t.enemyOwned) confidence = CONFIDENCE.MEDIUM;
      else confidence = CONFIDENCE.LOW;

      const severity = attacker
        ? attacker.primaryDamage + attacker.secondaryDamage
        : this.damageWhileTrapped;
      return threatReport(this.id, confidence, severity, attacker ? 0 : 2, evidence, false);
    }
  }

  /* ---- 10. Generic burst ------------------------------------------- *
   * Damage that already landed, in one tick, big enough to matter. It is
   * evidence about what is coming rather than a prediction of it, which is why
   * its timing is 0 and its confidence tops out below the specific detectors.
   * ---------------------------------------------------------------- */
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
      return threatReport(this.id, confidence, burst, 0, evidence, false);
    }
  }

  /* ---- 11. Generic sustained --------------------------------------- *
   * Pressure that is not any one thing: damage arriving often enough, for long
   * enough, that the bar is going down whatever is causing it.
   * ---------------------------------------------------------------- */
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

      const evidence = [
        "events:" + this.window.length,
        "dps:" + Math.round(perSecond)
      ];
      const confidence = this.window.length >= 5 && perSecond >= 60 ? CONFIDENCE.HIGH
        : this.window.length >= 3 && perSecond >= 30 ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      return threatReport(this.id, confidence, perSecond, ticksToEmpty, evidence, false, true);
    }
  }

  /* ---- the engine -------------------------------------------------- */
  class ThreatEngine {
    constructor(adapter) {
      this.adapter = adapter;
      this.detectors = [
        new AntiInstakillDetector(),
        new AntiSpikeTickDetector(),
        new AntiInstaRevDetector(),
        new RangedDetector(THREAT.MUSKET, [AH.PROJ_MUSKET], [AH.WEAPON_MUSKET], 1400),
        new RangedDetector(THREAT.BOW, AH.PROJ_ARROWS,
          [AH.WEAPON_BOW, AH.WEAPON_CROSSBOW, AH.WEAPON_REPEATER], 1200),
        new AntiSpamDaggerDetector(),
        new AntiVelocityTickDetector(),
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
      for (const d of this.detectors) if (d.reset) d.reset();
    }

    evaluate(snap, damage, state, shame, ledger) {
      const t = snap.threat;
      const Hats = this.adapter.Hats;

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
      const soldierMult = snap.soldierOn
        ? ((Hats && Hats[AH.HAT_SOLDIER] && num(Hats[AH.HAT_SOLDIER].dmgMult)) || 0.75)
        : 1;
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
      const ctx = this._context(snap, damage, state, shame, ledger, eff, soldierMult);
      /* The adapter reads are done once per tick and published here, so the
       * predictive defense engine works from the same enemy list and the same
       * projectile list rather than gathering its own copy. */
      this.lastEnemies = ctx.enemies;
      this.lastProjectiles = ctx.projectiles;
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
        if (r.additive && r.timing <= 1) additive = Math.max(additive, r.severity);
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
     * immediately — which spends a charge on every exchange, including the ones
     * where the next hit is three ticks out.
     *
     * The relaxation is deliberately narrow: any credible report landing inside
     * the window returns the full number, and no detector view at all returns
     * the full number too. Only when every credible threat is demonstrably
     * further out than the window does the wait become affordable. */
    imminentWithin(ticks) {
      if (!this.reports.length) return this.effective;
      let credible = false;
      let worst = 0;
      for (const r of this.reports) {
        if (r.rank < CONFIDENCE_RANK.MEDIUM) continue;
        credible = true;
        if (r.timing <= ticks) worst = Math.max(worst, r.severity);
      }
      if (!credible) return this.effective;
      if (worst > 0) return this.effective;
      /* Nothing credible lands in the window. What is already touching us
       * still does. */
      return this.spikeContact ? this.effective : worst;
    }

    /* How much of the damage number is going to happen rather than could.
     *
     * The floor is the source weighting: a damage-over-time tick is arithmetic
     * on a fixed period, an arrow has already been fired, a spike being touched
     * deals contact damage, and an enemy in range holding a reloaded weapon is
     * a player who may not swing. A detector that found real evidence for most
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

    /* Everything a detector is allowed to look at, read once per tick through
     * the adapter so the detectors themselves never touch the client. */
    _context(snap, damage, state, shame, ledger, effective, soldierMult) {
      const adapter = this.adapter;
      const Items = adapter.Items;
      const packets = adapter.packetsLeft();
      const engine = this;
      return {
        snap,
        damage,
        state,
        enemies: adapter.enemyList(),
        projectiles: adapter.incomingProjectiles(snap),
        spike: adapter.spikeContext(snap),
        trap: adapter.trapContext(),
        turret: adapter.turretContext(),
        health: snap.health,
        maxHealth: snap.maxHealth,
        restore: snap.restore,
        effective,
        soldierMult,
        pressesAffordable: Math.floor(packets / AH.PACKETS_PER_PRESS),
        shameCritical: shame ? shame.critical : false,
        /* What a given ranged weapon's projectile is worth, from the tables. */
        projectileDamageFor(weaponId) {
          try {
            const weapons = adapter.Weapons;
            const projectiles = adapter.Projectiles;
            if (!weapons || !projectiles) return 0;
            const weapon = weapons[weaponId];
            if (!weapon || weapon.projectile === undefined) return 0;
            const proj = projectiles[weapon.projectile];
            return proj && num(proj.damage) ? proj.damage : 0;
          } catch (_) { return 0; }
        },
        engine
      };
    }
  }

  /* ================================================================== *
   * 5. PredictiveDefenseEngine — act before the bar moves, not after.
   *
   * Reacting to health is reacting late: by the time the number changed, the
   * hit landed and the shame window is already open. This engine's job is the
   * tick before that — an enemy closing on a straight line, a ball in the air,
   * a poison tick with a known period — and its whole discipline is knowing
   * when it is allowed to spend anything on that.
   *
   * Three rules keep it from becoming a food-burning machine:
   *
   *   1. It never spends a shame charge on a prediction. A press that would
   *      count +1 is a press for damage that has already landed; the hit this
   *      engine is talking about has not happened yet, so if the window is not
   *      free the answer is to wait.
   *   2. Confidence gates the action, not the reporting. HIGH acts, MEDIUM
   *      acts only when the press wastes no food, LOW never acts.
   *   3. A prediction is thrown away the moment the world that produced it
   *      changes, and the seven ways that happens are named.
   * ================================================================== */

  /* Motion, borrowed from the placement engine's TargetMotion where it exists.
   * The fallback is not a second predictor — it is the linear extrapolation
   * every Entity in the client already carries (pos.previous -> pos.current,
   * `speed` and `move_dir`, which Entity.setFuturePosition maintains), read
   * one tick at a time. */
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

    /* {x, y, confidence} — the client's own answer where it is available. */
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
        /* No sample history behind it, so it decays fast and never claims
         * more than the borrowed tracker would. */
        confidence: Math.max(0.05, 0.45 * Math.exp(-ticks / 3.5))
      };
    }

    /* Earliest tick the predicted path enters a circle, or null. */
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
   * cached forecast is still the right one and nothing needs rebuilding. */
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
      /* health projection */
      this.inFlight = 0;
      this.projected = AH.MAX_HEALTH;
      this.regenPerSecond = 0;
      this.padRegen = 0;

      /* prediction */
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
     * this tick should see it. The forecast built on the old bar is stale by
     * definition, so it is dropped — but nothing is recomputed here, because
     * the thing that would use it has already run. The next tick rebuilds it
     * once, which is the only place rebuilding it is worth anything. */
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
     * damage that can land during the wait does land? The threat engine decides
     * how much of the number that is, from its detectors' timing. */
    survivesHold(snap, damage, threat, ms) {
      const ticks = Math.max(1, Math.round(ms / (snap.TICK || AH.TICK_MS)));
      const incoming = typeof threat.imminentWithin === "function"
        ? threat.imminentWithin(ticks)
        : threat.effective;
      return this.afterHold(snap, damage, ms) - incoming > 0;
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

      /* One observation per tracked enemy per tick, and the tracker's own
       * expiry. TargetMotion.observe is idempotent within a tick, so this
       * cannot double-sample. */
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

    /* Last tick's motion verdict per enemy, so stopping is an edge and not a
     * standing condition. Bounded by the tracked-enemy cap. */
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

    /* Only what is close enough and armed enough to matter, capped, nearest
     * first — the short list keeps the per-tick work bounded. */
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

    /* The seven ways a prediction stops being true, checked before anything is
     * rebuilt. Each one is a real event, not a timer. */
    _invalidation(snap, threat, enemies, projectiles) {
      if (!this._cache) return INVALIDATION.FIRST;
      if (snap.tick - this._cacheTick >= AH.PREDICT_MAX_AGE_TICKS) return INVALIDATION.AGE;

      /* the target changed */
      const targetId = enemies.length ? enemies[0].id : null;
      if (targetId !== this._lastTargetId) return INVALIDATION.TARGET;

      /* the threat disappeared */
      if (this._hadThreat && threat.reports.length === 0) return INVALIDATION.GONE;

      /* a projectile appeared, landed or changed course */
      if (projectiles.length !== this._lastProjectiles) return INVALIDATION.PROJECTILE;

      /* collision state changed under us */
      if (this._collisionKey(snap, threat) !== this._lastCollision) return INVALIDATION.COLLISION;

      /* I moved significantly */
      if (this._lastPos && snap.pos) {
        const moved = Math.hypot(snap.pos.x - this._lastPos.x, snap.pos.y - this._lastPos.y);
        if (moved > AH.PREDICT_PLAYER_MOVE_PX) return INVALIDATION.MOVED;
      }

      /* An enemy turned or stopped — TargetMotion measures both for us. Both
       * are edge-triggered: a prediction is invalidated by someone *becoming*
       * stationary, not by their continuing to stand there. Re-firing on the
       * standing would mean rebuilding the same answer every tick, which is
       * the one thing this cache exists to avoid. */
      for (const e of enemies) {
        const track = this.motion.track(e);
        if (!track) continue;
        const was = this._motionState.get(e.id);
        if ((track.headingShift || 0) > AH.PREDICT_TURN_RADIANS) return INVALIDATION.TURNED;
        const stopped = (track.peakSpeed || 0) >= AH.PREDICT_MOVING_SPEED &&
          (track.speed || 0) < AH.PREDICT_STOP_SPEED;
        if (stopped && (!was || !was.stopped)) return INVALIDATION.STOPPED;
      }

      /* anything else the fingerprint covers */
      const print = PredictionFingerprint.of(snap, threat, enemies, projectiles, this.motion);
      if (print !== this._fingerprint) return INVALIDATION.WORLD;

      return INVALIDATION.NONE;
    }

    _compute(snap, state, damage, threat, shame, enemies, projectiles) {
      const H = AH.PREDICT_HORIZON_TICKS;
      const out = this._empty();
      const events = [];

      /* 1. What is already in the air. The client established the line; the
       *    arrival tick is its own arithmetic. */
      for (const p of projectiles) {
        if (p.ticksToImpact > H) continue;
        events.push({
          damage: p.damage, tick: p.ticksToImpact, confidence: 0.85, source: "projectile"
        });
      }

      /* 2. Who is going to be able to reach me, and when. This is the part
       *    that is genuinely ahead of the health bar: an enemy outside reach
       *    now, on a course that puts them inside it within the horizon. */
      const myPos = snap.pos;
      for (const e of enemies) {
        const reach = Math.max(e.primaryRange, e.secondaryRange);
        if (reach <= 0) continue;
        const armed = e.primaryReloaded || e.secondaryReloaded;
        const damageIfHit = Math.max(e.primaryDamage, e.secondaryDamage);
        if (damageIfHit <= 0) continue;

        if (e.distance <= reach) {
          /* Already in reach: this is Combat's number, not a prediction, and
           * it is only counted here so the timing model has it. */
          if (armed) {
            events.push({
              damage: damageIfHit, tick: 1,
              confidence: e.facing ? 0.6 : 0.4, source: "in-reach"
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
          /* The tracker's own confidence in the path, tempered by whether the
           * weapon will actually be ready when they arrive. */
          confidence: (hit.confidence || 0.3) * (armed ? 1 : 0.6) * (e.facing ? 1 : 0.8),
          source: "closing"
        });
      }

      /* 3. The damage-over-time tick, which is a period rather than a guess. */
      if (damage.dotActive && damage.ticksUntilDot <= H) {
        events.push({
          damage: damage.dotPerSecond, tick: damage.ticksUntilDot,
          confidence: 1, source: "dot"
        });
      }

      /* 4. The next contact of a spike sequence the threat engine is tracking. */
      const spikeSeq = threat.byType[THREAT.SPIKE_TICK];
      if (spikeSeq && spikeSeq.timing <= H && spikeSeq.rank >= CONFIDENCE_RANK.MEDIUM) {
        events.push({
          damage: spikeSeq.severity, tick: spikeSeq.timing,
          confidence: spikeSeq.value, source: "spike-sequence"
        });
      }

      if (!events.length) return out;

      /* Only credible events are spent against. The rest are still reported —
       * they are what makes the confidence low. */
      let total = 0, weighted = 0, soonest = Infinity, credible = 0;
      for (const ev of events) {
        total += ev.damage;
        weighted += ev.damage * ev.confidence;
        if (ev.confidence >= AH.CONFIDENCE_LOW) {
          credible += ev.damage;
          if (ev.tick < soonest) soonest = ev.tick;
        }
        out.sources.push(`${ev.source}:${Math.round(ev.damage)}@${ev.tick}`);
      }
      const confidence = total > 0 ? weighted / total : 0;

      out.incomingDamage = Math.min(AH.DMG_CAP, credible) * (snap.soldierOn ? 0.75 : 1);
      out.timing = soonest;
      out.confidence = confidence;
      out.level = confidence >= AH.CONFIDENCE_HIGH ? CONFIDENCE.HIGH
        : confidence >= AH.CONFIDENCE_LOW ? CONFIDENCE.MEDIUM
        : CONFIDENCE.LOW;
      out.motion = this.motion.kind;

      /* Expected health when it lands, regen included. */
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
        /* At the ceiling there is no +1 available: the press would be refused
         * and the wait is forced. */
        out.expectedShameDelta = 0;
      }

      /* How long this is expected to last: while someone stays in reach, plus
       * whatever the sustained detector is still seeing. */
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
   * 10. AntiSpamManager — the in-flight ledger and the backoff.
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

    /* Whether an identical action is already pending and still valid. Pending
     * means sent and not yet visible; valid means the health it was buying has
     * not arrived and the expectation has not aged out. */
    isPending(signature, snap) {
      const p = this.pendingAction;
      if (!p) return false;
      if (p.signature !== signature) return false;
      if (snap.tick - p.tick > this.visibleTicks(snap)) return false;
      return !p.resolved;
    }

    notePending(signature, snap, presses, expect) {
      this.pendingAction = {
        signature, tick: snap.tick, presses, expect, resolved: false
      };
    }

    /* A pending action resolves when its health shows up, or when it ages out
     * of the window in which it could have. */
    resolvePending(snap, state) {
      const p = this.pendingAction;
      if (!p) return;
      if (state.healLandedThisTick) { p.resolved = true; return; }
      if (snap.tick - p.tick > this.visibleTicks(snap)) this.pendingAction = null;
    }

    /* Presses already sent are health we are about to have. Counting them is
     * what stops a four-press gap from becoming twelve presses over three
     * ticks — the failure the target client calls "the Q that never lets go". */
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
      /* Drop entries that have aged out, and clear the whole ledger the moment
       * a heal is actually observed. */
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
      /* One verdict per press batch: without the guard every tick after a
       * refused press would count again and the backoff would run away. */
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

    backedOff(snap) {
      return snap.tick < this.backoffUntilTick;
    }

    notePress(snap, expect) {
      this.entries.push({ tick: snap.tick, expect });
      this.pressedTotal += 1;
    }
  }

  /* ================================================================== *
   * 6. HealDecisionEngine — is healing now worth more than healing later?
   *
   * Not "HP below X, eat". A threshold cannot answer the question this engine
   * actually faces, because the same 40 health is worth wildly different
   * amounts depending on what it costs: at shame 0 with a full larder a press
   * is nearly free, and at shame 6 the same press spends the last charge
   * standing between us and a thirty-second lock. A ladder of thresholds
   * cannot express that. A price can.
   *
   * So every candidate is priced, in health-equivalent points, twice: once for
   * pressing now and once for pressing on the next tick instead. The larger
   * number wins, and the reason it won is the reason reported.
   *
   * The requested priority order is not written down anywhere in here. It
   * falls out of the prices: a lethal burst carries the value of a life, a
   * shame credit at 6 carries most of one, and a top-up carries forty points
   * of health minus the food. Ordering them is arithmetic.
   * ================================================================== */

  /* What things are worth, in health.
   *
   * One health point is one point. Everything else is priced against it, and
   * every price is anchored to something the game actually does rather than a
   * tuning knob:
   *
   *   - dying costs the whole bar and the run that produced it, so it is worth
   *     several bars, not one;
   *   - food costs nothing while you have plenty and a great deal when you are
   *     nearly out, because what it really costs is the next heal you cannot
   *     make;
   *   - a packet costs nothing until the budget is tight, at which point it
   *     costs the placement engine its tick;
   *   - a shame charge costs the option it consumes: at count 0 it is one of
   *     seven, at count 6 it is the last one, and the last one is the
   *     difference between healing and a thirty-second lock.
   */
  class HealValueModel {
    constructor(adapter) { this.adapter = adapter; }

    /* Three bars. Death is not merely the loss of current health: it is the
     * loss of age, gear, position and whatever the run was worth. */
    lifeValue(snap) { return snap.maxHealth * 3; }

    /* Per press. Free while the larder is full, steep as it empties. */
    foodValue(snap) {
      if (snap.sandbox) return 0;
      const cost = snap.foodCost || 0;
      if (!cost) return 0;
      const pressesLeft = snap.foodStock / cost;
      if (pressesLeft >= 8) return 0;
      /* Below eight presses in reserve the marginal press starts costing the
       * heal it will not be able to make later. */
      return (8 - pressesLeft) * 4;
    }

    /* Per press. Only real when the budget is tight enough that spending
     * three frames costs somebody else their tick. */
    packetValue(snap, systems) {
      const left = snap.packetLimit - snap.packetCount;
      const reserve = (systems.placer ? AH.PACKET_RESERVE_PLACER : 0) +
        (systems.mills ? AH.PACKET_RESERVE_MILL : 0);
      const spare = left - reserve;
      if (spare >= AH.PACKETS_PER_PRESS * 4) return 0;
      if (spare <= 0) return this.lifeValue(snap);      // effectively forbidden
      return (AH.PACKETS_PER_PRESS * 4 - spare) * 3;
    }

    /* The option value of the charged press this one would consume.
     *
     * At count c there are (7 - c) charges left before the count reaches the
     * ceiling, where a charged press stops healing altogether. Spending one is
     * therefore worth a share of a life, and the share is convex: the seventh
     * charge is cheap, the last one is nearly the whole thing. */
    shamePenalty(snap, count) {
      const budget = Math.max(0, AH.SHAME_MAX - count);
      /* At the ceiling the press is forbidden outright, and that is enforced
       * as a constraint before anything is priced — so the price here only has
       * to be large enough to dominate every other term, not infinite.
       * Infinity would be the honest number and a terrible one: it makes the
       * comparison arithmetic produce NaN the moment it meets a zero
       * probability, and a NaN loses every comparison it is in. That is a
       * decision engine that stops deciding, which is worse than any price. */
      if (budget <= 0) return this.lifeValue(snap) * 4;
      return this.lifeValue(snap) / (budget * budget);
    }

    /* What a credit press is worth: the options it hands back. */
    creditValue(snap, count) {
      if (count <= 0) return 0;
      const after = Math.max(0, count - AH.SHAME_CREDIT);
      return this.shamePenalty(snap, count) - this.shamePenalty(snap, after);
    }

    /* Health a press actually delivers, which is not the same as its restore:
     * anything over the cap is thrown away (game_index.js:2418). */
    healthGain(presses, restore, from, max) {
      return Math.max(0, Math.min(presses * restore, max - from));
    }

    /* Pressing this tick. */
    now(ctx, candidate) {
      const { snap, shame, verdict } = ctx;
      const gain = this.healthGain(candidate.presses, snap.restore, ctx.health, snap.maxHealth);
      const food = this.foodValue(snap) * candidate.presses;
      const packets = this.packetValue(snap, snap.systems) * candidate.presses;
      const charge = verdict === VERDICT.CHARGED
        ? this.shamePenalty(snap, shame.chargeSafeCount(snap)) : 0;
      const credit = verdict === VERDICT.CREDIT
        ? this.creditValue(snap, shame.count) : 0;
      /* The death this press prevents. */
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
      /* Damage expected inside the wait, and whether it lands at all.
       *
       * Being pinned changes that answer rather than the damage: a pit trap
       * holds you where you are (`isTrapped`), so the swing that is coming is
       * one you cannot walk out of. Waiting while trapped is not a bet on
       * whether the hit lands. */
      let pHit = clamp(damage.damageFrequency * (snap.TICK / 1000), 0, 1);
      if (ctx.trapped) pHit = Math.max(pHit, 0.9);
      const incoming = ctx.imminent;
      const healthThen = Math.max(0, ctx.health - incoming * pHit + ctx.regenPerTick);
      const gain = this.healthGain(candidate.presses, snap.restore, healthThen, snap.maxHealth);
      const food = this.foodValue(snap) * candidate.presses;
      const packets = this.packetValue(snap, snap.systems) * candidate.presses;

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
       * credit forever congratulating itself — pressing now banks it, waiting
       * only might. */
      let credit = 0, chargeAvoided = 0, chargeRisk = 0, converts = 0;
      if (ctx.verdict === VERDICT.CHARGED) {
        converts = 1 - pHit;
        credit = converts * this.creditValue(snap, shame.count);
        chargeAvoided = converts * this.shamePenalty(snap, shame.chargeSafeCount(snap));
      } else if (ctx.verdict === VERDICT.CREDIT) {
        credit = (1 - pHit) * this.creditValue(snap, shame.count);
        chargeRisk = pHit * this.shamePenalty(snap, shame.chargeSafeCount(snap));
      }

      /* The risk of the wait: dying in it. */
      const dies = ctx.health - incoming <= 0;
      const risk = dies ? this.lifeValue(snap) * ctx.lethalConfidence * pHit : 0;

      /* The shame the forecast says the wait will cost.
       *
       * The predictive engine has already worked out what the coming hit does
       * to the count: if it lands on a bar too low to ignore, the heal that
       * answers it is the first press after a fresh stamp, and that press is a
       * charge. Buying the buffer now, while the window is free, is what stops
       * that charge from ever being needed — so its price belongs on this side
       * of the comparison, weighted by how much the forecast is believed. */
      const forecast = ctx.forecast;
      const futureCharge = forecast && forecast.expectedShameDelta > 0 && gain > 0
        ? forecast.expectedShameDelta *
          this.shamePenalty(snap, shame.chargeSafeCount(snap)) *
          clamp(forecast.confidence, 0, 1)
        : 0;

      const total = gain + credit + chargeAvoided
        - food - packets - risk - chargeRisk - futureCharge;
      return {
        total, gain, credit, chargeAvoided, chargeRisk, risk, futureCharge, converts, pHit
      };
    }
  }

  /* ================================================================== *
   * 7. PriorityArbiter — one place where everything is ranked.
   *
   * Two jobs, both centralised here so no other part of the engine decides
   * what matters more than what.
   *
   * First: which situation dominates this tick. That ranking is computed from
   * severity, confidence and timing rather than written down, so the order the
   * objective describes — survival, catastrophic damage, high-confidence
   * burst, rapid damage, spike, ranged, dagger, ordinary damage, shame — comes
   * out of the numbers. A musket ball three ticks out and a dagger already
   * landing are ordered by what they will do, not by which list they are on.
   *
   * Second: whether this engine may act at all, against the rest of the
   * client. That comparison runs on RYN's own scale — the placement engine's
   * RPE_PRIORITY classes, read through its own `priorityFor` — so healing and
   * placing are ranked by one authority rather than two.
   * ================================================================== */
  class PriorityArbiter {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.rank = null;
      this.yielded = "";
    }

    /* Urgency in health-per-tick: how much damage, how sure, how soon. */
    _urgency(severity, confidence, timing, health) {
      const soon = 1 / (1 + Math.max(0, timing === Infinity ? 9 : timing));
      const catastrophic = severity >= health ? 3 : 1;
      return severity * confidence * soon * catastrophic;
    }

    /* What dominates this tick, and what class of action answering it is. */
    classify(snap, threat, predict, shame, damage) {
      const health = predict.projected;
      const forecast = predict.forecast;
      let best = {
        label: "quiet", urgency: 0, severity: 0, timing: Infinity,
        cls: this.adapter.priorityClass("UTILITY"), survival: false
      };

      /* Already lethal: the top of any order, and the only case that is
       * allowed to spend a charge. */
      const imminent = typeof threat.imminentWithin === "function"
        ? threat.imminentWithin(1) : threat.effective;
      if (imminent >= health && imminent > 0) {
        best = {
          label: "critical-survival",
          urgency: this._urgency(imminent, 1, 0, health) * 10,
          severity: imminent, timing: 0,
          cls: this.adapter.priorityClass("INSTA"), survival: true
        };
      }

      /* Everything the detectors found, ranked by what it will do. */
      for (const report of threat.reports) {
        /* A rate is converted to what it does in one tick before it is ranked
         * against amounts, and a rate is never "lethal now" however large. */
        const amount = report.rate
          ? report.severity * (snap.TICK / 1000)
          : report.severity;
        const urgency = this._urgency(amount, report.value, report.timing, health);
        if (urgency <= best.urgency) continue;
        const lethal = !report.rate && amount >= health;
        best = {
          label: report.type,
          urgency,
          severity: amount,
          timing: report.timing,
          cls: this.adapter.priorityClass(
            lethal ? "INSTA" : report.rank >= CONFIDENCE_RANK.HIGH ? "DEFENSE" : "RECOVERY"
          ),
          survival: lethal
        };
      }

      /* A forecast that has not landed yet ranks below anything that has, by
       * construction: its timing is in the future and its confidence is under
       * one, and both divide the urgency. */
      if (forecast.incomingDamage > 0) {
        const urgency = this._urgency(
          forecast.incomingDamage, forecast.confidence, forecast.timing, health
        );
        if (urgency > best.urgency) {
          best = {
            label: "forecast", urgency,
            severity: forecast.incomingDamage, timing: forecast.timing,
            cls: this.adapter.priorityClass("ANTICIPATION"), survival: false
          };
        }
      }

      /* Shame optimisation is last by price, not by decree: with nothing
       * threatening, the credit is the only thing on the board. */
      if (best.urgency === 0 && shame.count > 0) {
        best = {
          label: "shame-optimisation", urgency: 0.01,
          severity: 0, timing: shame.opportunity.etaTicks,
          cls: this.adapter.priorityClass("UTILITY"), survival: false
        };
      }

      this.rank = best;
      return best;
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

      if (!snap.moduleActive) return true;

      /* Someone already claimed the tick. Compare classes on RYN's scale, and
       * yield on a tie: they claimed first. */
      const theirs = this.adapter.priorityOf(snap.activeModule);
      if (rank.cls > theirs) return true;
      this.yielded = `module:${snap.activeModule || "unknown"}`;
      return false;
    }

    /* How many presses the budget can actually carry, after leaving the
     * placement systems and the mills room to work. Survival is allowed to
     * spend the reserve; nothing else is. */
    affordable(snap, rank) {
      const sys = snap.systems;
      let budget = snap.packetLimit - snap.packetCount;
      if (!rank.survival) {
        if (sys.placer) budget -= AH.PACKET_RESERVE_PLACER;
        if (sys.mills) budget -= AH.PACKET_RESERVE_MILL;
      }
      return Math.max(0, Math.floor(budget / AH.PACKETS_PER_PRESS));
    }
  }

  /* ---- the decision ------------------------------------------------ */
  class HealDecisionEngine {
    constructor(adapter) {
      this.adapter = adapter;
      this.value = new HealValueModel(adapter);
    }

    plan(snap, state, damage, shame, threat, predict, cooldown, arbiter) {
      const restore = snap.restore;
      const max = snap.maxHealth;
      const health = predict.projected;
      const verdict = shame.verdictNow;
      const reserve = this.adapter.reserveHealth;
      const forecast = predict.forecast;

      const none = decision => Object.assign({
        urgency: URGENCY.IDLE, presses: 0, holdMs: 0, verdict, decision
      }, decision === DECISION.CANCEL ? {} : {});

      /* ---- hard constraints, before any arithmetic ------------------ */
      if (shame.locked) {
        return this._plan(DECISION.CANCEL, URGENCY.BLOCKED, 0, 0,
          "shame-lock: food is refused for the whole 30s", verdict);
      }

      /* Healing at full health does nothing at all (game_index.js:2418), so no
       * amount of predicted damage makes a press worth sending while the bar
       * is still full. The wash is the exception: there the point is the -2. */
      const canHeal = snap.health < max;

      /* ---- centralised priority ------------------------------------- */
      const rank = arbiter.classify(snap, threat, predict, shame, damage);
      if (!arbiter.mayAct(snap, rank)) {
        return this._plan(DECISION.CANCEL, URGENCY.BLOCKED, 0, 0,
          `yield:${arbiter.yielded}`, verdict, rank);
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
        return this._plan(DECISION.PREPARE, URGENCY.WASH, 0, 0,
          candidate.reason, verdict, rank, { wantBull: true });
      }

      /* Clamp to what the packet budget can carry before pricing it. */
      const affordable = arbiter.affordable(snap, rank);
      if (affordable <= 0) {
        return this._plan(DECISION.CANCEL, URGENCY.BLOCKED, 0, 0,
          "no packet budget left after the placement reserve", verdict, rank);
      }
      candidate.presses = Math.min(candidate.presses, affordable, AH.MAX_PRESSES_PER_TICK);

      /* ---- now, or next tick? --------------------------------------- */
      const ctx = {
        snap, damage, shame, verdict, health,
        forecast,
        /* Player state the decision itself turns on, rather than only the
         * threat model: pinned in a trap, there is nowhere to be instead. */
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
          `${Math.round(now.charge)} of shame`, verdict, rank, { values: { now, wait } });
      }

      if (now.total > wait.total) {
        return this._plan(DECISION.HEAL_NOW, candidate.urgency, candidate.presses, 0,
          `${candidate.label}: now ${Math.round(now.total)} > wait ${Math.round(wait.total)}`,
          verdict, rank, { values: { now, wait } });
      }

      /* Waiting wins. Say what it is waiting for, and for how long: a hold is
       * bounded by the cooldown clock unless the ceiling makes it unbounded. */
      const holdable = cooldown.mayHold(snap, shame);
      if (!holdable && canHeal && candidate.presses > 0) {
        /* The hold has run out. Press anyway rather than stall forever — the
         * failure mode a shame guard has to avoid is refusing to eat at all. */
        return this._plan(DECISION.HEAL_NOW, candidate.urgency, candidate.presses, 0,
          `${candidate.label}: hold expired, pressing at ${Math.round(now.total)}`,
          verdict, rank, { values: { now, wait } });
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
     * decides whether it happens at all. */
    _candidate(snap, damage, shame, threat, predict, rank, canHeal, floor,
      restore, max, health, verdict) {
      const forecast = predict.forecast;

      /* Survival and sustain both fill to the top when the press is charged,
       * because a charge is paid once per damage event however many presses
       * follow it (game_index.js:2461-2463). */
      const chargedBurst = verdict === VERDICT.CHARGED;

      /* A candidate that would press nothing is not a candidate: it has to
       * fall through to whatever is behind it, or a target the bar already
       * clears silently blocks the wash for the rest of the fight. */
      if (canHeal && rank.survival) {
        const presses = predict.healsNeeded(max, restore);
        if (presses > 0) {
          return { label: "survival", urgency: URGENCY.CRITICAL, presses };
        }
      }
      if (canHeal && health < floor) {
        const presses = predict.healsNeeded(
          chargedBurst ? max : Math.min(max, floor + restore), restore
        );
        if (presses > 0) {
          return { label: "sustain", urgency: URGENCY.SUSTAIN, presses };
        }
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
          if (presses > 0) {
            return { label: "preempt", urgency: URGENCY.PREEMPT, presses };
          }
        }
      }
      /* The way down. A credit press is worth -2 whether or not it heals, and
       * at full health it costs no food at all (game_index.js:2475). */
      const wash = shame.planWash();
      if (wash === "natural") {
        return { label: "wash", urgency: URGENCY.WASH, presses: 1 };
      }
      if (wash === "bull") {
        return { prepare: true, reason: "prepare: bull hat to manufacture a hit to wash" };
      }
      if (canHeal) {
        /* Ordinary top-up. The food-economy rule stands at shame 0 and relaxes
         * while a debt is owed, because then the press buys the credit too. */
        const gap = max - health;
        const worthCredit = !shame.safe && verdict === VERDICT.CREDIT;
        const believable = threat.effective > 0 && shame.predictor.actionable;
        if (gap >= restore || !damage.underFire || worthCredit || believable) {
          const presses = predict.healsNeeded(max, restore);
          if (presses > 0) {
            return { label: "topup", urgency: URGENCY.TOPUP, presses };
          }
        }
      }
      return null;
    }

    _plan(decision, urgency, presses, holdMs, reason, verdict, rank, extra) {
      return Object.assign({
        decision, urgency, presses, holdMs, reason, verdict,
        rank: rank || null
      }, extra || {});
    }
  }

  /* ================================================================== *
   * 8. ActionValidator — refuse what the server would refuse or punish.
   * ================================================================== */
  class ActionValidator {
    constructor(adapter) { this.adapter = adapter; }

    check(plan, snap, shame) {
      if (!plan.presses && !plan.wantBull) return plan;

      const fail = reason => Object.assign({}, plan, {
        urgency: URGENCY.BLOCKED, presses: 0, wantBull: false, reason
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
       * ever worth sending as a wash, where the point is the -2. */
      if (snap.health >= snap.maxHealth && plan.urgency !== URGENCY.WASH) {
        return fail("invalid:full-health");
      }

      if (snap.packetCount + plan.presses * AH.PACKETS_PER_PRESS > snap.packetLimit) {
        return fail("invalid:packet-limit");
      }
      return plan;
    }

    /* ---- final validation, immediately before the wire ---------------- *
     *
     * The plan was made against a snapshot taken at the top of the tick. This
     * runs against the state as it is at the moment of pressing, and it checks
     * everything the decision leaned on rather than only the shame count: if
     * any of it moved, the action is cancelled and the next tick plans against
     * what is actually true.
     *
     * The distinction between the two answers matters. CANCEL means the action
     * was wrong and should not be retried as-is. RECALCULATE means the world
     * moved and the same question deserves a fresh answer — which is what the
     * next tick will give it.
     *
     * Everything here reads two already-updated objects. No part of the
     * decision is redone, because redoing it is what would make this cost
     * something. */
    final(plan, snap, state, shame, threat, predict, ledger, live) {
      const stop = (decision, reason) => ({ ok: false, decision, reason, presses: 0 });
      if (!live) return stop(DECISION.RECALCULATE, "no-live-state");

      /* player state */
      if (!live.inGame) return stop(DECISION.CANCEL, "not-in-game");
      if (live.noEat) return stop(DECISION.CANCEL, "noeat-hat");
      if (live.trapped !== !!snap.isTrapped) {
        return stop(DECISION.RECALCULATE, "trapped-changed");
      }

      /* shame, and the one press that must never leave */
      if (live.active) return stop(DECISION.CANCEL, "shame-lock");

      /* healing availability, priced at the moment of the press rather than
       * at the top of the tick (game_index.js:2496 — canBuild is hasRes). */
      if (live.foodId === null || !live.restore) return stop(DECISION.CANCEL, "no-food-item");
      if (live.foodId !== snap.foodId) return stop(DECISION.RECALCULATE, "food-changed");
      if (!snap.sandbox && live.foodStock < live.foodCost) {
        return stop(DECISION.CANCEL, "no-food");
      }

      /* HP */
      if (typeof live.health === "number") {
        if (live.health >= snap.maxHealth && plan.urgency !== URGENCY.WASH) {
          return stop(DECISION.CANCEL, "already-full");
        }
      }

      /* cooldown */
      if (ledger.backedOff(snap)) return stop(DECISION.CANCEL, "backoff");

      /* combat state and action priority: someone may have claimed the tick
       * after the plan was made, and they may outrank it. */
      if (live.moduleActive && live.activeModule && live.activeModule !== "autoHealEngine") {
        const theirs = this.adapter.priorityOf(live.activeModule);
        const mine = plan.rank ? plan.rank.cls : this.adapter.priorityClass("UTILITY");
        if (mine <= theirs) return stop(DECISION.CANCEL, `outranked:${live.activeModule}`);
      }
      /* Another module already ate on this tick: the hit stamp it consumed is
       * not ours to spend again. */
      if (live.healedOnce) return stop(DECISION.RECALCULATE, "already-healed-this-tick");

      /* threat, its confidence, and the predicted damage the plan was built
       * on. A survival-class action whose threat has evaporated is not an
       * emergency any more, and should be re-asked rather than sent. */
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

      /* The shame arithmetic gets the last word, and recalculates the press
       * count against live health rather than the snapshot's. */
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
   * 9. CooldownManager — pacing, and the one clock that is allowed to stall.
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
     * is armed before consume is reached (game_index.js:2465-2469) — so waiting
     * gives up nothing that pressing would have won. */
    mayHold(snap, shame) {
      if (shame.count >= AH.SHAME_MAX) return true;
      return this.heldTicks(snap) < AH.HOLD_TICKS_DEFAULT;
    }

    /* Part of the post-execution commit: a press ends any hold outright, and
     * the count is what the next tick's pacing reads. */
    notePress(snap, presses) {
      this.pressedThisTick = presses;
      this.holdSinceTick = -1;
      this.holdReason = "";
      this.lastPressTick = snap.tick;
    }

    /* Records the hold the plan settled on. Runs after execution, so a plan
     * that was cancelled at the wire does not start the clock either. */
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
   * 11. HealExecutor — validate, press, commit.
   *
   * Three stages with nothing between them. The decision has already been
   * made; this re-checks it against the state as it is at the moment of
   * pressing, sends the frames through the client's own packet path, and then
   * updates everything the press just changed.
   *
   * There are no delays anywhere in here, and there is no scheduler. A press
   * leaves in the same synchronous call that decided to send it, which is the
   * only way to be fast in a client whose tick is 111ms wide: anything that
   * waits has already missed the tick it was waiting for.
   * ================================================================== */
  class HealExecutor {
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
    }

    run(plan, snap, state, shame, ledger, threat, predict, cooldown) {
      this.lastReason = plan.reason;
      this.lastPresses = 0;
      this.lastDecision = null;
      this.lastPackets = 0;

      /* PREPARE: no press, one hat request, which ModuleHandler ignores if
       * another module already claimed the slot. */
      if (plan.wantBull) {
        if (this.adapter.requestBullHat()) this.lastReason = plan.reason + "+bull";
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
       * has to be selected again for every press, because a successful
       * consume clears buildIndex on the server (game_index.js:2476), so the
       * next attack would swing the weapon instead of eating.
       *
       * The weapon is restored once, after the burst, rather than once per
       * press. Nothing can observe the intermediate state — the whole burst is
       * one synchronous call — and it is one frame instead of N. That is the
       * only packet saving available here, and it is a real one: three presses
       * cost seven frames rather than nine. */
      const verdict = check.verdict;
      const willHeal = health < snap.maxHealth;
      let sent = 0;
      let expected = health;

      for (let i = 0; i < presses; i++) {
        /* Per-press revalidation. Inside one synchronous burst the only thing
         * that changes is what we ourselves have already sent, so this is what
         * that costs: packets spent, and health already bought. A press that
         * would land on a full bar is a wasted press and a wasted food. */
        if (this.adapter.packetsLeft() < 2) break;
        if (expected >= snap.maxHealth && plan.urgency !== URGENCY.WASH) break;
        if (!this.adapter.pressFoodOnly()) break;
        sent += 1;
        expected += snap.restore;
        /* Only the first press of a burst is judged: it clears hitTime, so the
         * rest are free whatever they cost in food (game_index.js:2461-2463). */
        if (sent === 1) shame.notePress(snap, verdict);
        ledger.notePress(snap, willHeal ? snap.restore : 0);
      }

      if (!sent) {
        this.lastReason = plan.reason + "+cancel:no-packets";
        this.lastDecision = DECISION.CANCEL;
        return 0;
      }

      /* One weapon restore for the whole burst. */
      this.adapter.restoreWeapon();

      /* ---- 4. commit ------------------------------------------------ *
       * Everything the press just changed, updated now rather than next tick,
       * and nothing that did not change recomputed. */
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
      this.lastPackets = sent * 2 + 1;
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
      this.state = new StateTracker();
      this.damage = new DamageAnalyzer();
      this.shame = new ShameController(this.adapter);
      this.threat = new ThreatEngine(this.adapter);
      this.predict = new PredictiveDefenseEngine(this.adapter);
      this.ledger = new AntiSpamManager();
      this.decision = new HealDecisionEngine(this.adapter);
      this.arbiter = new PriorityArbiter(this.adapter);
      this.validator = new ActionValidator(this.adapter);
      this.cooldown = new CooldownManager(this.adapter);
      this.executor = new HealExecutor(this.adapter);
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
      this._pressedThisTick = false;
    }

    /* Whether the engine is driving healing. The two ownership guards the
     * builder installs — in AntiInsta's heal rule and in ShameReset — gate on
     * the same setting, so the shipped paths stand down instead of pressing
     * alongside it and come straight back when the toggle goes off. This is the
     * same answer, reachable from a console or another module. */
    owns() {
      return this.adapter.enabled;
    }

    postTick() {
      this._pressedThisTick = false;
      if (!this.adapter.enabled) return;

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

      /* --- pipeline, in order ---------------------------------------- */
      this.state.update(snap, this.ledger);
      this.ledger.update(snap, this.state);
      this.damage.update(snap, this.state);
      this.shame.update(snap, this.state, this.damage, {
        recentDamage: this.damage.rate,
        damageFrequency: this.damage.damageFrequency,
        inFlight: this.ledger.expectedHeal(snap),
        pressedLastTick: snap.tick - this.state.lastPressTick <= 1,
        holding: this.cooldown.holdSinceTick >= 0,
        backoff: this.ledger.backedOff(snap)
      });
      this.threat.evaluate(snap, this.damage, this.state, this.shame, this.ledger);
      this.predict.build(snap, this.state, this.damage, this.threat, this.ledger);
      /* Ahead of the health bar: what is going to land, when, and how sure we
       * are. Rebuilt only when the world that produced it changed. */
      this.predict.predictAhead(snap, this.state, this.damage, this.threat, this.shame);
      /* The forecast and the way down both need the threat and the projection,
       * so the shame engine's second half runs after them. */
      this.shame.project(snap, this.state, this.damage, this.threat, this.predict, snap.systems);
      this.ledger.noteOutcome(snap, this.state, this.predict.inFlight);

      let plan;
      if (this.ledger.backedOff(snap)) {
        plan = {
          urgency: URGENCY.BLOCKED, presses: 0, holdMs: 0,
          reason: "backoff", verdict: this.shame.verdictNow
        };
      } else {
        plan = this.decision.plan(
          snap, this.state, this.damage, this.shame, this.threat, this.predict,
          this.cooldown, this.arbiter
        );
        /* Plan-time legality. The final, pre-wire revalidation is the
         * executor's own first stage: nothing runs between it and the press. */
        plan = this.validator.check(plan, snap, this.shame);
      }

      const sent = this.executor.run(
        plan, snap, this.state, this.shame, this.ledger,
        this.threat, this.predict, this.cooldown
      );
      /* Pacing is bookkeeping for the next tick, so it runs after the press
       * rather than between the decision and it. */
      this.cooldown.pace(plan, snap);
      this._pressedThisTick = sent > 0;

      const tracker = this.shame.tracker;
      const forecast = this.shame.predictor;
      this.telemetry = {
        urgency: this._urgencyName(plan.urgency),
        decision: this.executor.lastDecision || plan.decision || DECISION.CANCEL,
        rank: plan.rank ? plan.rank.label : "quiet",
        rankClass: plan.rank ? plan.rank.cls : 0,
        rankUrgency: plan.rank ? Number(plan.rank.urgency.toFixed(2)) : 0,
        valueNow: plan.values ? Math.round(plan.values.now.total) : 0,
        valueWait: plan.values ? Math.round(plan.values.wait.total) : 0,
        reason: this.executor.lastReason,
        presses: sent,
        /* shame control */
        shame: this.shame.count,
        shamePrev: tracker.previous,
        shameDelta: tracker.delta,
        zone: tracker.zone,
        ticksInZone: tracker.ticksInZone,
        upRate: Number(tracker.increaseRate.toFixed(2)),
        downRate: Number(tracker.decreaseRate.toFixed(2)),
        shameGate: this.shame.chargeSafeCount(snap),
        forecastShame: Number(forecast.projected.toFixed(2)),
        confidence: Number(forecast.confidence.toFixed(2)),
        ticksToCritical: forecast.ticksToCritical === Infinity
          ? "-" : Math.round(forecast.ticksToCritical),
        opportunity: this.shame.opportunity.mode,
        healingState: tracker.healingState,
        cooldownState: tracker.cooldownState,
        /* the rest */
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
        soonest: this.threat.soonest === Infinity ? "-" : this.threat.soonest,
        sources: this.threat.sources.join(" "),
        damageFrequency: Number(this.damage.damageFrequency.toFixed(2)),
        rate: Math.round(this.damage.rate),
        projected: Math.round(this.predict.projected),
        inFlight: this.predict.inFlight,
        /* predictive defense */
        forecastDamage: Math.round(this.predict.forecast.incomingDamage),
        forecastTiming: this.predict.forecast.timing === Infinity
          ? "-" : this.predict.forecast.timing,
        forecastHealth: Math.round(this.predict.forecast.expectedHealth),
        forecastShame: this.predict.forecast.expectedShameDelta,
        forecastLevel: this.predict.forecast.level,
        forecastConfidence: Number(this.predict.forecast.confidence.toFixed(2)),
        threatDuration: this.predict.forecast.threatDuration,
        /* execution layer */
        packets: this.executor.lastPackets,
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
  AutoHealEngine.zoneFor = ShameTracker.zoneFor;
  AutoHealEngine.CONFIDENCE = CONFIDENCE;
  AutoHealEngine.DECISION = DECISION;
  AutoHealEngine.INVALIDATION = INVALIDATION;
  AutoHealEngine.CONFIDENCE_VALUE = CONFIDENCE_VALUE;
  AutoHealEngine.THREAT = THREAT;
  return AutoHealEngine;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createRynAutoHealEngine };
}
