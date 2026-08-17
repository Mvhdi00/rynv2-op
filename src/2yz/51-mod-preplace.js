/* ===========================================================================
 * 2yz / Preplace
 * ---------------------------------------------------------------------------
 * Source concept: Whiteout's preplace / checkCanPrePlace / checkPreplace
 * (Whiteout_v4.js:8322, 8378, 8510) and the velocity model behind them
 * (calcVel, Whiteout_v4.js:14869).
 *
 * The idea Whiteout gets right, and the reason it is the reference here rather
 * than NovaStorm: it validates the placement against where the player WILL be,
 * not where they are. checkCanPrePlace reads `player[pre ? "x3" : "x2"]`, and
 * x3 is the integrated next-tick position. A ring computed around the current
 * position is already wrong by the time the build packet lands, which is why a
 * present-tense placer misses on anything moving.
 *
 * Also kept: the release timing. Whiteout arms a `preplaceTimeout` and fires at
 * `timeout - ping`, so the build arrives at the server on the tick it was
 * computed for rather than a tick late.
 *
 * Not kept: the setTimeout chains and chainPlace's fixed repeat counts, which
 * fire regardless of whether the prediction survived the wait. In 2yz the
 * armed placement is an intent, it is revalidated at release, and a direction
 * change past the configured threshold destroys it before it can be sent.
 * =========================================================================== */

const Preplace = {
    name: 'Preplace',

    /* The currently armed placement, if any. */
    armed: null,

    install() {
        Events.on('trackerReady', () => this.invalidate());
        Events.on('targetSwitched', () => this.disarm('target-switched'));
        Events.on('death', () => this.disarm('death'));
    },

    disarm(reason) {
        if (!this.armed) return;
        const was = this.armed;
        this.armed = null;
        if (was.timer) clearTimeout(was.timer);
        if (was.intent) was.intent.cancelled = true;
        Events.emit('preplaceDisarmed', was, reason);
    },

    /* Run every tick before anything reads the armed placement. A prediction is
     * only valid while the movement it was built from holds. */
    invalidate() {
        const a = this.armed;
        if (!a) return;
        const target = a.intent.target;

        if (!target || !target.visible || !target.alive) return this.disarm('target-gone');
        if (target !== Targeting.primary) return this.disarm('target-switched');

        if (Prediction.changedDirection(target)) return this.disarm('direction-changed');

        /* Compare where the target actually got to against where the armed
         * prediction said they would be. Drift past the tolerance means the
         * model was wrong, whatever the direction test says. */
        const drift = U.getDistance(target.x2, target.y2, a.predicted.x, a.predicted.y);
        if (drift > Config.get('placement.preplace.driftTolerance')) return this.disarm('drift');

        if (GameState.tick - a.armedTick > Config.get('placement.preplace.maxAgeTicks')) {
            return this.disarm('expired');
        }
        return undefined;
    },

    tick() {
        if (!Config.get('placement.preplace.enabled')) return null;
        if (this.armed) return null;

        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target) return null;
        if (Targeting.distanceTo(target) > Config.get('placement.preplace.range')) return null;

        /* Preplace is the module that most needs the prediction to be right, so
         * it has the strictest confidence gate in the client. */
        const confidence = Prediction.confidence(target);
        if (confidence < Config.get('placement.preplace.minConfidence')) return null;

        /* Nothing to lead if they are not moving. */
        if (target.speed < Config.get('placement.preplace.minSpeed')) return null;

        const horizon = Config.get('placement.preplace.horizonTicks');

        /* Origin: where WE will be. Whiteout's x3/y3. */
        const myFuture = Prediction.at(me, horizon);
        /* Aim point: where THEY will be. */
        const theirFuture = Prediction.at(target, horizon);

        /* A shadow of the target at its future position, so PlacementEngine
         * scores candidates against the interception point rather than against
         * where the target currently stands. */
        const shadow = Object.create(target);
        shadow.x2 = theirFuture.x;
        shadow.y2 = theirFuture.y;
        shadow.x1 = target.x2;
        shadow.y1 = target.y2;

        const itemId = Config.get('placement.preplace.useTrap') && GameState.trapItem != null
            && !target.trapped
            ? GameState.trapItem
            : GameState.spikeItem;
        if (itemId == null) return null;

        const candidates = PlacementEngine.sweep(itemId, {
            origin: { x: myFuture.x, y: myFuture.y }
        });
        const ranked = PlacementEngine.rank(candidates, shadow, itemId === GameState.trapItem ? 'trap' : 'spike');
        const best = ranked[0];
        if (!best || best.score < Config.get('placement.preplace.minScore')) return null;

        const intent = new PlacementIntent({
            source: this.name,
            urgency: Config.get('placement.preplace.urgency'),
            confidence,
            target,
            candidate: best,
            origin: { x: myFuture.x, y: myFuture.y },
            reason: 'preplace:' + best.reasons.join(',')
        });

        /* Arm rather than return. The placement is correct for a moment that
         * has not arrived yet; sending it now would land it a tick early. */
        this.arm(intent, theirFuture, horizon);
        return null;
    },

    /* Release so the frame reaches the server on the predicted tick: schedule
     * the horizon, less the one-way trip. Whiteout uses the low-water ping for
     * this rather than the mean, because arriving early still works and
     * arriving late does not. */
    arm(intent, predicted, horizon) {
        const leadMs = horizon * Defs.TICK_MS;
        const oneWay = Net.minPingMs() / 2;
        const delay = Math.max(0, leadMs - oneWay - Config.get('placement.preplace.releaseBias'));

        const record = {
            intent,
            predicted,
            armedTick: GameState.tick,
            timer: null
        };
        this.armed = record;

        record.timer = setTimeout(() => {
            record.timer = null;
            if (this.armed !== record) return;
            this.armed = null;
            /* Scheduler revalidates one last time before the write. */
            const ok = Scheduler.runDeferred(intent);
            Events.emit('preplaceReleased', intent, ok);
        }, delay);

        Events.emit('preplaceArmed', record);
    },

    debugState() {
        const a = this.armed;
        if (!a) return { armed: null };
        return {
            armed: a.intent.describe(),
            angle: Math.round(U.toDeg(a.intent.angle)),
            predicted: { x: Math.round(a.predicted.x), y: Math.round(a.predicted.y) },
            ageTicks: GameState.tick - a.armedTick
        };
    }
};
