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
    SUSTAIN: 4,
    CRITICAL: 5,
    LOCKGUARD: 6
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
        if (!this._warned) {
          this._warned = true;
          try { console.warn("[RYN AutoHeal] press failed:", e); } catch (_) {}
        }
        return false;
      }
    }

    /* The smallest possible fresh read of the shame state, for the check that
     * runs immediately before a press. Deliberately not the full snapshot: this
     * is on the execution path and only these four fields decide whether the
     * press that is about to leave is the one that must not. */
    liveShame() {
      const me = this.me;
      if (!me) return null;
      return {
        count: clamp(num(me.shameCount) || 0, 0, AH.SHAME_MAX),
        active: !!me.shameActive || (num(me.hatID) || 0) === AH.HAT_SHAME,
        receivedDamage: num(me.receivedDamage),
        health: num(me.currentHealth)
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
  function threatReport(type, confidence, severity, timing, evidence, additive) {
    return {
      type,
      confidence,
      value: CONFIDENCE_VALUE[confidence] || 0,
      rank: CONFIDENCE_RANK[confidence] || 0,
      severity: Math.max(0, Math.round(severity || 0)),
      timing: timing === undefined || timing === null ? Infinity : timing,
      evidence: evidence || [],
      additive: !!additive
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
      return threatReport(this.id, confidence, perSecond, ticksToEmpty, evidence, false);
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
   * 5. PredictionEngine — health forward, and whether a wait is survivable.
   * ================================================================== */
  class PredictionEngine {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.inFlight = 0;
      this.projected = AH.MAX_HEALTH;
      this.regenPerSecond = 0;
      this.padRegen = 0;
    }

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
   * 6. HealDecisionEngine — one plan per tick.
   * ================================================================== */
  class HealDecisionEngine {
    constructor(adapter) { this.adapter = adapter; }

    plan(snap, state, damage, shame, threat, predict, cooldown) {
      const restore = snap.restore;
      const max = snap.maxHealth;
      const health = predict.projected;
      const verdict = shame.verdictNow;
      const reserve = this.adapter.reserveHealth;

      const idle = { urgency: URGENCY.IDLE, presses: 0, holdMs: 0, reason: "idle", verdict };

      if (shame.locked) {
        return { urgency: URGENCY.BLOCKED, presses: 0, holdMs: 0, reason: "shame-lock", verdict };
      }

      /* Healing at full health does nothing at all (game_index.js:2418), so no
       * amount of predicted damage makes a press worth sending while the bar is
       * still full — the projection can sit below max on the tick before a
       * damage-over-time tick, and a press planned there is one the validator
       * would only refuse. The wash path is the exception, and the only one:
       * there the point is the -2, not the heal. */
      const canHeal = snap.health < max;

      /* Defensive priority rises with the zone. Health bought at 5 is bought
       * with presses that are still affordable; the same health bought at 7 is
       * not buyable at all. So the floor comes up as the count approaches the
       * ceiling — including when it is the forecast rather than the count that
       * says so, which is the whole point of forecasting it. */
      const defensiveBias = shame.critical ? reserve
        : shame.approachingCritical ? reserve / 2
        : 0;

      /* ---- 6 LOCKGUARD ------------------------------------------------ *
       * At 7, a charged press sets the 30s lock and is then refused by
       * consume: no heal, thirty seconds of no heals, and the count is not even
       * where we thought it was. Waiting for the window is never worse. */
      const lockGuard = shame.chargeSafeCount(snap) >= AH.SHAME_MAX &&
        verdict === VERDICT.CHARGED;

      /* A charge is paid once per damage event, no matter how many presses
       * follow it: the first press clears hitTime and the rest are free
       * (game_index.js:2461-2463). So wherever a branch below decides to pay
       * one, it fills the bar to the top rather than to the floor — same shame,
       * several times the health. */

      /* ---- 5 CRITICAL ------------------------------------------------- */
      const lethalNow = health <= threat.effective || health <= damage.burst;
      if (lethalNow && health < max && canHeal) {
        if (lockGuard) {
          return {
            urgency: URGENCY.LOCKGUARD, presses: 0, holdMs: shame.msUntilCredit,
            reason: "lockguard-critical", verdict
          };
        }
        if (verdict !== VERDICT.CHARGED) {
          return {
            urgency: URGENCY.CRITICAL,
            presses: predict.healsNeeded(max, restore),
            holdMs: 0, reason: "critical-free", verdict
          };
        }
        /* Charged, but survivable: one tick of patience turns +1 into -2. The
         * hold is bounded by CooldownManager, because under damage every tick
         * the window never opens and a guard that waits forever stops you
         * eating at all. */
        const hold = shame.msUntilCredit;
        if (cooldown.mayHold(snap, shame) &&
            hold <= snap.TICK * (AH.HOLD_TICKS_DEFAULT + 1) &&
            predict.survivesHold(snap, damage, threat, hold)) {
          return {
            urgency: URGENCY.CRITICAL, presses: 0, holdMs: hold,
            reason: "critical-wait-window", verdict
          };
        }
        if (shame.canSpendCharge(snap)) {
          return {
            urgency: URGENCY.CRITICAL,
            presses: predict.healsNeeded(max, restore),
            holdMs: 0, reason: "critical-spend-charge", verdict
          };
        }
        return {
          urgency: URGENCY.LOCKGUARD, presses: 0, holdMs: shame.msUntilCredit,
          reason: "critical-no-budget", verdict
        };
      }

      /* ---- 4 SUSTAIN --------------------------------------------------- *
       * The predictive floor: stay above what the field can currently do to us
       * plus a reserve, so the emergency branch above is rarely reached. */
      const floor = Math.min(max, threat.effective + reserve + defensiveBias);
      if (health < floor && health < max && canHeal) {
        if (verdict !== VERDICT.CHARGED) {
          return {
            urgency: URGENCY.SUSTAIN,
            presses: predict.healsNeeded(Math.min(max, floor + restore), restore),
            holdMs: 0, reason: "sustain-free", verdict
          };
        }
        if (lockGuard) {
          return {
            urgency: URGENCY.LOCKGUARD, presses: 0, holdMs: shame.msUntilCredit,
            reason: "lockguard-sustain", verdict
          };
        }
        const hold = shame.msUntilCredit;
        const patient = this.adapter.strict
          ? shame.count > 0
          : shame.chargeBudget(snap) <= AH.SHAME_CREDIT;
        if (patient && cooldown.mayHold(snap, shame) &&
            predict.survivesHold(snap, damage, threat, hold)) {
          return {
            urgency: URGENCY.SUSTAIN, presses: 0, holdMs: hold,
            reason: "sustain-wait-window", verdict
          };
        }
        /* Keep one point of the budget in hand: a charge spent down to exactly
         * 7 leaves the next emergency with nothing but the LOCKGUARD wait. */
        if (shame.chargeBudget(snap) >= AH.SHAME_CREDIT) {
          return {
            urgency: URGENCY.SUSTAIN,
            presses: predict.healsNeeded(max, restore),
            holdMs: 0, reason: "sustain-spend-charge", verdict
          };
        }
        return {
          urgency: URGENCY.SUSTAIN, presses: 0, holdMs: hold,
          reason: "sustain-hold", verdict
        };
      }

      /* ---- 3 WASH ------------------------------------------------------ *
       * The engine's route back to zero. A credit press is worth -2 whether or
       * not it heals, and at full health it costs no food at all
       * (game_index.js:2475 — useRes is only reached when consume returned
       * true). One press: the second would find hitTime already cleared. */
      const mode = shame.planWash();
      if (mode === "natural") {
        return {
          urgency: URGENCY.WASH, presses: 1, holdMs: 0,
          reason: health < max ? "wash-heal" : "wash-free", verdict
        };
      }
      if (mode === "bull") {
        return {
          urgency: URGENCY.WASH, presses: 0, holdMs: 0,
          reason: "wash-bull-arm", verdict, wantBull: true
        };
      }
      /* The credit is one tick out. Nothing else here is urgent — health is
       * above the floor — so wait for it rather than spending a press now that
       * would count the wrong way. */
      if (shame.opportunity.mode === "credit-wait" && !shame.safe) {
        return {
          urgency: URGENCY.WASH, presses: 0, holdMs: shame.msUntilCredit,
          reason: "wash-wait-window", verdict
        };
      }

      /* ---- 2 TOPUP ----------------------------------------------------- *
       * Quiet ticks are where health is meant to come back, precisely so the
       * charged branches above stay unused. Only ever on a free or credit
       * press, and preferably before the next damage-over-time tick. */
      if (health < max && canHeal) {
        if (verdict === VERDICT.CHARGED) {
          /* Nothing is urgent here, so there is never a reason to buy a top-up
           * with +1. Skip the tick rather than hold: holding would put the
           * shame clock on a decision that does not need one. */
          return {
            urgency: URGENCY.TOPUP, presses: 0, holdMs: 0,
            reason: "topup-charged-skip", verdict
          };
        }
        /* `gap >= restore` is food economy: a press that would waste most of
         * its restore is not worth the food on a quiet field.
         *
         * What relaxes it is the zone, not the health. Owing shame makes a
         * credit press worth more than the food it wastes — it heals *and*
         * takes two off the count, which is the earliest valid opportunity the
         * objective asks for. At zero there is nothing to buy, so the economy
         * rule stands: that is "avoid unnecessary healing", stated as a rule
         * rather than a hope.
         *
         * A threat can relax it too, but only a believable one. Topping up
         * against a number that is mostly "an enemy is standing nearby holding
         * a weapon" is the wasted resource the objective warns about, so the
         * forecast has to be actionable before it counts. */
        const gap = max - health;
        const worthCredit = !shame.safe && verdict === VERDICT.CREDIT;
        const believableThreat = threat.effective > 0 && shame.predictor.actionable;
        if (gap >= restore || !damage.underFire || worthCredit || believableThreat) {
          return {
            urgency: URGENCY.TOPUP,
            presses: predict.healsNeeded(max, restore),
            holdMs: 0, reason: "topup", verdict
          };
        }
      }

      return idle;
    }
  }

  /* ================================================================== *
   * 7. PriorityArbiter — the rest of the client gets its tick back.
   * ================================================================== */
  class PriorityArbiter {
    constructor(adapter) { this.adapter = adapter; }

    resolve(plan, snap, shame) {
      const sys = snap.systems;
      const critical = plan.urgency >= URGENCY.CRITICAL;

      /* Anti Smart Tick's whole answer to a trap it will not break out of is to
       * eat instead. It presses through ModuleHandler.heal on this same tick;
       * a second opinion here is just double food. */
      if (sys.antiSmartTick || sys.antiInstaForceHeal) {
        return this._cancel(plan, "yield:anti-smart-tick");
      }

      /* Someone already claimed the tick for a committed combat sequence — an
       * insta, a sync, a spike tick. Survival still outranks it; a top-up does
       * not. */
      if (snap.moduleActive && !critical && plan.urgency !== URGENCY.WASH) {
        return this._cancel(plan, "yield:module-active");
      }
      if (sys.spikeTick && snap.placedOnce && !critical) {
        return this._cancel(plan, "yield:spike-tick");
      }

      /* Velocity Tick owns Bull for its combo and a heal in the middle of it
       * costs the turret window. Never arm a bull wash against it. */
      if (sys.velocityArmed) {
        if (plan.wantBull) plan = this._cancel(plan, "yield:velocity-tick");
        else if (!critical) return this._cancel(plan, "yield:velocity-tick");
      }

      /* Packets are shared. The placement engine and the mills both spend in
       * bursts, so leave them room unless we are dying. */
      let budget = snap.packetLimit - snap.packetCount;
      if (!critical) {
        if (sys.placer) budget -= AH.PACKET_RESERVE_PLACER;
        if (sys.mills) budget -= AH.PACKET_RESERVE_MILL;
      }
      const affordable = Math.floor(Math.max(0, budget) / AH.PACKETS_PER_PRESS);
      if (plan.presses > affordable) {
        plan = Object.assign({}, plan, {
          presses: affordable,
          reason: plan.reason + (affordable ? "+budget-clamp" : "+no-budget")
        });
      }

      if (plan.presses > AH.MAX_PRESSES_PER_TICK) {
        plan = Object.assign({}, plan, { presses: AH.MAX_PRESSES_PER_TICK });
      }
      return plan;
    }

    _cancel(plan, reason) {
      return Object.assign({}, plan, { presses: 0, wantBull: false, reason });
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

    /* Records the hold the plan settled on, after the arbiter and the validator
     * have had their say, so a plan they cancelled does not start the clock. */
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
   * 11. HealExecutor — the presses.
   * ================================================================== */
  class HealExecutor {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.lastReason = "";
      this.lastPresses = 0;
      this.totalPresses = 0;
    }

    run(plan, snap, state, shame, ledger) {
      this.lastReason = plan.reason;
      this.lastPresses = 0;

      if (plan.wantBull) {
        if (this.adapter.requestBullHat()) this.lastReason = plan.reason + "+bull";
        return 0;
      }
      if (!plan.presses) return 0;

      /* Validation — the last thing before the wire. The count, the lock and
       * the hit stamp are re-read live and the plan is recalculated against
       * them, so no press ever leaves on a shame reading taken at the top of
       * the tick. A press that is still affordable goes out under its corrected
       * verdict; one that is not is dropped, and the next tick plans against
       * the number that actually holds. */
      const live = this.adapter.liveShame();
      const check = shame.revalidate(snap, state, live, plan);
      if (!check.ok) {
        this.lastReason = plan.reason + "+stale:" + check.reason;
        this.lastPresses = 0;
        return 0;
      }
      if (check.changed) this.lastReason = plan.reason + "+recalc";

      const verdict = check.verdict;
      const presses = check.presses;
      const willHeal = (live && typeof live.health === "number" ? live.health : snap.health) <
        snap.maxHealth;
      let sent = 0;

      for (let i = 0; i < presses; i++) {
        /* Read the counter live: it is incremented at the transport for every
         * frame anyone sends (PacketManager._watchSocket), so it moves under us
         * as this loop runs. */
        if (this.adapter.packetsLeft() < AH.PACKETS_PER_PRESS) break;
        if (!this.adapter.pressFood()) break;
        sent += 1;
        /* Only the first press of a burst is judged: it clears hitTime, so the
         * rest are free whatever they cost in food (game_index.js:2461-2463). */
        if (sent === 1) shame.notePress(snap, verdict);
        ledger.notePress(snap, willHeal ? snap.restore : 0);
      }

      if (sent) {
        state.notePress(snap);
        this.adapter.claimTick(plan.urgency >= URGENCY.CRITICAL);
        this.totalPresses += sent;
        this.lastPresses = sent;
      }
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
      this.predict = new PredictionEngine(this.adapter);
      this.ledger = new AntiSpamManager();
      this.decision = new HealDecisionEngine(this.adapter);
      this.arbiter = new PriorityArbiter(this.adapter);
      this.validator = new ActionValidator(this.adapter);
      this.cooldown = new CooldownManager(this.adapter);
      this.executor = new HealExecutor(this.adapter);
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
          snap, this.state, this.damage, this.shame, this.threat, this.predict, this.cooldown
        );
        plan = this.arbiter.resolve(plan, snap, this.shame);
        plan = this.validator.check(plan, snap, this.shame);
        plan = this.cooldown.pace(plan, snap);
      }

      const sent = this.executor.run(plan, snap, this.state, this.shame, this.ledger);
      this._pressedThisTick = sent > 0;

      const tracker = this.shame.tracker;
      const forecast = this.shame.predictor;
      this.telemetry = {
        urgency: this._urgencyName(plan.urgency),
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
        inFlight: this.predict.inFlight
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
  AutoHealEngine.CONFIDENCE_VALUE = CONFIDENCE_VALUE;
  AutoHealEngine.THREAT = THREAT;
  return AutoHealEngine;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createRynAutoHealEngine };
}
