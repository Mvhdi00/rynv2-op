/* ===========================================================================
 * 2yz / Prediction
 * ---------------------------------------------------------------------------
 * One prediction layer for the whole client. Combat, Auto Place, Preplace,
 * Replace, Spike Tick, Anti Smart Tick and Safe Soldier all call in here; none
 * of them integrates a position of its own.
 *
 * The integrator is the game's own, read off the player update step in
 * src/game_index.js:2330-2374. Per update of `f` ms the game does, in this
 * order:
 *
 *   1. vel += dirUnit * playerSpeed * mult * f      (accelerate)
 *   2. pos += vel * f                               (move, on the new vel)
 *   3. vel *= playerDecel^f                         (then decay)
 *
 * Working in per-tick displacement D rather than velocity, that collapses to
 *
 *   D(n) = D(n-1) * playerDecel^f  +  playerSpeed * mult * f^2
 *
 * which is the single recurrence this layer integrates. playerSpeed (0.0016)
 * and playerDecel (0.993) come from the shipped config, not from literals.
 *
 * Three branches, because which one an entity is on is not observable:
 *
 *   accel  holding a direction  -- the full recurrence
 *   decel  released, coasting   -- decay only
 *   hold   at terminal speed    -- displacement carries unchanged
 *
 * `hold` is not redundant with `accel`. They agree only when the observed
 * displacement is exactly at the recurrence's fixed point, and 2yz cannot
 * always compute that point: the game's speed multiplier folds in biome, water
 * current, slowMult and the target's accessory, and none of those are on the
 * wire for other players. `hold` covers a steady walker whose terminal speed
 * we cannot derive, which is the common case.
 *
 * The layer picks whichever branch best explains where the entity actually
 * ended up last tick and reports the fit as `confidence`. A module that needs
 * certainty (Preplace) gates on that number; one that only needs a hint
 * (target sorting) ignores it.
 * =========================================================================== */

const Prediction = (function () {
    const SPEED = Defs.config.playerSpeed;
    const DECEL = Defs.config.playerDecel;

    /* Cache keyed by (sid, horizonTicks), invalidated every tick. Several
     * modules ask for the same horizon on the same entity in one pass; without
     * this the integrator would run five or six times for one answer. */
    let cache = new Map();
    let cacheTick = -1;

    function cacheKey(sid, ticks, mode) { return sid + ':' + ticks + ':' + mode; }

    function ensureCache() {
        if (cacheTick !== GameState.tick) {
            cache = new Map();
            cacheTick = GameState.tick;
        }
    }

    /* Integrate one entity forward. `mode` is 'accel', 'decel', 'hold' or
     * 'auto'. Fractional `ticks` are supported: the whole steps run the
     * recurrence and the remainder is a linear carry of the last displacement. */
    function integrate(entity, ticks, mode, dirOverride) {
        const stepMs = Defs.TICK_MS;
        const mult = EntityTracker.speedMultOf(entity);

        let x = entity.x2;
        let y = entity.y2;
        let vx = entity.xVel;
        let vy = entity.yVel;

        /* A held player is going nowhere regardless of which branch fit. */
        const resolved = mode === 'auto'
            ? (entity.trapped ? 'decel' : (entity.predictMode || 'accel'))
            : mode;

        let dir = dirOverride;
        if (dir == null) dir = entity.moveDir;

        const decay = resolved === 'hold' ? 1 : Math.pow(DECEL, stepMs);
        let ax = 0;
        let ay = 0;
        if (resolved === 'accel' && entity.speed > 0.05 && !entity.trapped) {
            let cx = Math.cos(dir);
            let cy = Math.sin(dir);
            const len = Math.sqrt(cx * cx + cy * cy);
            if (len !== 0) { cx /= len; cy /= len; }
            /* playerSpeed * mult * f, applied to velocity, then f again when
             * that velocity is turned into displacement -- hence f squared. */
            ax = cx * SPEED * mult * stepMs * stepMs;
            ay = cy * SPEED * mult * stepMs * stepMs;
        }

        const whole = Math.floor(ticks);
        for (let i = 0; i < whole; i++) {
            vx = vx * decay + ax;
            vy = vy * decay + ay;
            x += vx;
            y += vy;
        }
        const rest = ticks - whole;
        if (rest > 0) {
            const nx = vx * decay + ax;
            const ny = vy * decay + ay;
            x += nx * rest;
            y += ny * rest;
            vx = nx;
            vy = ny;
        }
        return { x, y, vx, vy, mode: resolved };
    }

    /* How well each branch explained the last observed step. Computed once per
     * entity per tick and stored on the entity. */
    function scoreBranches(entity) {
        if (entity.history.size < 2) {
            entity.predictMode = 'auto';
            entity.predictConfidence = 0.4;
            return;
        }
        const prev = entity.history.at(1);
        const now = entity.history.at(0);
        if (!prev || !now) return;

        /* Two samples back, so the step being scored is one the entity has
         * already taken and we know the answer to. */
        const older = entity.history.at(2);
        if (!older) {
            entity.predictMode = 'accel';
            entity.predictConfidence = 0.4;
            return;
        }

        /* Replay the step from `prev` to `now` under each assumption, starting
         * from the displacement that was observed going into `prev`. */
        const probe = {
            x2: prev.x,
            y2: prev.y,
            xVel: prev.x - older.x,
            yVel: prev.y - older.y,
            speed: prev.speed,
            moveDir: prev.dir,
            trapped: entity.trapped,
            skinIndex: entity.skinIndex,
            tailIndex: entity.tailIndex,
            weaponIndex: entity.weaponIndex
        };

        let bestMode = 'accel';
        let bestErr = Infinity;
        for (const mode of ['accel', 'decel', 'hold']) {
            const guess = integrate(probe, 1, mode, prev.dir);
            const err = U.getDistance(guess.x, guess.y, now.x, now.y);
            if (err < bestErr) { bestErr = err; bestMode = mode; }
        }
        entity.predictMode = bestMode;
        entity.predictFitError = bestErr;

        /* Confidence falls with fit error and with how sharply the entity just
         * turned. A player who reversed direction this tick is not predictable
         * regardless of how well the integrator fit. */
        const fit = U.clamp(1 - bestErr / Config.get('prediction.fitTolerance'), 0, 1);
        const steady = U.clamp(1 - entity.dirChange / Math.PI, 0, 1);
        entity.predictConfidence = fit * 0.6 + steady * 0.4;
    }

    return {
        install() {
            Events.on('trackerReady', function () {
                for (const p of GameState.players.values()) {
                    if (p.visible) scoreBranches(p);
                }
            });
        },

        /* Position `ticks` server ticks from now. `ticks` may be fractional. */
        at(entity, ticks, mode) {
            if (!entity) return null;
            ensureCache();
            const m = mode || entity.predictMode || 'auto';
            const key = cacheKey(entity.sid, ticks, m);
            const hit = cache.get(key);
            if (hit) return hit;
            const result = integrate(entity, ticks, m);
            result.confidence = entity.predictConfidence != null ? entity.predictConfidence : 0.4;
            cache.set(key, result);
            return result;
        },

        /* One tick ahead, the horizon the placement modules use: an object
         * placed now lands on the server roughly one tick from now. */
        next(entity) { return this.at(entity, 1); },

        /* Where the entity will be when a packet sent now arrives, accounting
         * for the round trip. Combat uses this for range checks. */
        atLatency(entity) {
            const rtt = Net.pingMs();
            return this.at(entity, U.clamp(rtt / Defs.TICK_MS, 0, 4));
        },

        confidence(entity) {
            return entity && entity.predictConfidence != null ? entity.predictConfidence : 0;
        },

        /* True when the entity turned hard enough this tick that any candidate
         * built from an earlier prediction should be thrown away. Preplace and
         * Replace both invalidate on this. */
        changedDirection(entity, thresholdRad) {
            if (!entity) return true;
            return entity.dirChange > (thresholdRad != null ? thresholdRad : Config.get('prediction.recalcAngle'));
        },

        /* Will `entity` collide with `obj` on its way to its predicted spot?
         * Used for escape-route scoring and for knockback-into-spike checks. */
        pathHits(entity, obj, ticks) {
            const future = this.at(entity, ticks);
            const pad = entity.scale + obj.scale;
            return U.lineInRect(
                obj.x - pad, obj.y - pad, obj.x + pad, obj.y + pad,
                entity.x2, entity.y2, future.x, future.y
            );
        },

        /* Where knockback would throw `victim` if hit from (fromX, fromY).
         * The game applies hitReturnRatio of the attacker's push along the
         * attacker->victim direction. */
        knockbackTo(victim, fromX, fromY, distance) {
            const angle = U.getDirection(victim.x2, victim.y2, fromX, fromY);
            const d = distance != null ? distance : Config.get('prediction.knockbackDistance');
            return {
                x: victim.x2 + d * Math.cos(angle),
                y: victim.y2 + d * Math.sin(angle),
                angle
            };
        },

        debugState(entity) {
            if (!entity) return null;
            const n = this.next(entity);
            return {
                mode: entity.predictMode,
                confidence: Math.round(this.confidence(entity) * 100) / 100,
                speed: Math.round(entity.speed * 100) / 100,
                dirChange: Math.round(entity.dirChange * 100) / 100,
                next: { x: Math.round(n.x), y: Math.round(n.y) }
            };
        }
    };
})();
