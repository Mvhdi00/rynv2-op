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
    }

    update(snap, state) {
      this.burst = Math.max(state.delta < 0 ? -state.delta : 0, state.hiddenDamage);
      this.rate = state.recentDamage(AH.DOT_PERIOD_TICKS);
      this.underFire = snap.tick - snap.damageTick <= 1;

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
  class ShameController {
    constructor(adapter) {
      this.adapter = adapter;
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
    }

    update(snap, state) {
      this.locked = snap.shameActive;
      if (this.locked) {
        /* The lock zeroes the count when it expires (game_index.js:2313). */
        this.count = 0;
        this.mirrorPrev = snap.mirrorShame;
        this.deferred.length = 0;
        this.verdictNow = VERDICT.CHARGED;
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

    /* When nothing has hit us, Bull Helmet's healthRegen -5 manufactures a hit
     * on the next one-second tick (game_index.js:2317 -> changeHealth(-5) ->
     * hitTime). A late press then converts it into -2 and heals the 5 back. */
    planWash(snap, damage, threat, systems) {
      this.washMode = null;
      if (!this.adapter.washEnabled || this.locked || this.count <= 0) return null;
      if (this.verdictNow === VERDICT.CREDIT) { this.washMode = "natural"; return "natural"; }
      if (this.verdictNow === VERDICT.CHARGED) return null;
      /* No hit pending: manufacture one with Bull. Only on a genuinely quiet
       * tick — Bull is -5 a second and no damage reduction, so arming it in
       * front of anything that can hit back trades health for a shame point
       * that a natural wash would have given for free a tick later. novastorm
       * gates its own shame reset the same way (`totalDmgPot == 0`). */
      if (threat.effective > 0 || damage.underFire || threat.spikeContact) return null;
      if (snap.poisonCount > 0 || snap.bullOn) return null;
      if (systems.velocityArmed || systems.soldierClaimed) return null;
      if (snap.forceHat !== null) return null;
      this.washMode = "bull";
      return "bull";
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
   * 4. ThreatDetector — Combat's numbers, the game's modifiers.
   * ================================================================== */
  class ThreatDetector {
    constructor(adapter) {
      this.adapter = adapter;
      this.reset();
    }

    reset() {
      this.raw = 0;
      this.effective = 0;
      this.spikeContact = false;
      this.insta = false;
      this.sources = [];
    }

    evaluate(snap, damage) {
      const t = snap.threat;
      const Hats = this.adapter.Hats;

      /* EnemyManager already summed melee-in-range, secondary and turret into
       * potentialDamage, and took the larger of direct spike contact and
       * knock-onto-spike (v5.4:3124-3130). Projectiles in flight are the
       * ProjectileManager's own total. Nothing here is re-derived. */
      const spike = Math.max(t.spike, t.spikeKB);
      let raw = t.potential + spike + t.projectile;

      /* A damage-over-time tick inside the horizon is real incoming damage. */
      if (damage.dotActive && damage.ticksUntilDot <= 2) raw += damage.dotPerSecond;

      raw = Math.min(raw, AH.DMG_CAP);

      /* Soldier Helmet's dmgMult is applied by the server inside changeHealth
       * (game_index.js:2420), so it is a true reduction. It counts when the hat
       * is on, and also when Safe Soldier is putting it on this tick. */
      const soldierMult = (snap.soldierOn || snap.shouldEquipSoldier)
        ? ((Hats && Hats[AH.HAT_SOLDIER] && num(Hats[AH.HAT_SOLDIER].dmgMult)) || 0.75)
        : 1;
      let eff = raw * soldierMult;
      /* Bull adds its own -5 a second on top of whatever the enemy does. */
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
      return this;
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
     * predicted damage lands during the wait? */
    survivesHold(snap, damage, threat, ms) {
      return this.afterHold(snap, damage, ms) - threat.effective > 0;
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
      if (lethalNow && health < max) {
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
      const floor = Math.min(max, threat.effective + reserve);
      if (health < floor && health < max) {
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
      const mode = shame.planWash(snap, damage, threat, snap.systems);
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

      /* ---- 2 TOPUP ----------------------------------------------------- *
       * Quiet ticks are where health is meant to come back, precisely so the
       * charged branches above stay unused. Only ever on a free or credit
       * press, and preferably before the next damage-over-time tick. */
      if (health < max) {
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
         * its restore is not worth the food on a quiet field. It stops applying
         * the moment anything can hit us — a wasted 5 health is cheaper than
         * being 35 short when the next swing lands, and on a non-damage tick
         * the press is credit, so it buys shame back rather than costing it. */
        const gap = max - health;
        if (gap >= restore || !damage.underFire || threat.effective > 0) {
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

      const verdict = plan.verdict;
      const willHeal = snap.health < snap.maxHealth;
      let sent = 0;

      for (let i = 0; i < plan.presses; i++) {
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
      this.threat = new ThreatDetector(this.adapter);
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
      this.shame.update(snap, this.state);
      this.threat.evaluate(snap, this.damage);
      this.predict.build(snap, this.state, this.damage, this.threat, this.ledger);
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

      this.telemetry = {
        urgency: this._urgencyName(plan.urgency),
        reason: this.executor.lastReason,
        presses: sent,
        shame: this.shame.count,
        shameGate: this.shame.chargeSafeCount(snap),
        verdict: this.shame.verdictNow,
        creditIn: Math.round(this.shame.msUntilCredit),
        threat: Math.round(this.threat.effective),
        sources: this.threat.sources.join(" "),
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
  return AutoHealEngine;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createRynAutoHealEngine };
}
