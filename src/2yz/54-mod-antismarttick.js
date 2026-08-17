/* ===========================================================================
 * 2yz / AntiSmartTick
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's doSmartTickAnti (novastorm_1.4.txt:12237) and the
 * anti-spike-tick damage projection in its tick loop (novastorm_1.4.txt:15118).
 *
 * The situation it defends: we are held in a trap, the enemy has a hammer off
 * cooldown, and there is a ring position around US where they could drop a
 * spike such that breaking out walks us straight into it. Breaking the trap on
 * this tick is exactly what they are waiting for.
 *
 * NovaStorm's detection is the right one and 2yz keeps its shape: sweep the
 * ring around the ENEMY (not around us), check each position with the game's
 * own placement test, and for any position that would land within contact of
 * us, project our knockback out of it and see whether it lands on one of their
 * spikes. If it does, wait.
 *
 * Two things are rebuilt rather than copied:
 *
 *   - NovaStorm expresses the answer by mutating shared flags (`autoBreak`,
 *     `predictWeapon`) from inside a predicate, so the function both reports
 *     and acts. Here it returns a HoldIntent, which the Arbiter weighs against
 *     whatever it would suppress. It can lose.
 *
 *   - the hold is bounded. NovaStorm re-derives the wait every tick with no
 *     ceiling, so a patient enemy can pin the client indefinitely. 2yz expires
 *     the hold after a configured number of ticks and takes the hit, because
 *     bleeding out in a trap is worse than eating one spike.
 * =========================================================================== */

const AntiSmartTick = {
    name: 'AntiSmartTick',

    heldSinceTick: -1,

    tick() {
        if (!Config.get('defense.antiSmartTick.enabled')) return null;
        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target) { this.heldSinceTick = -1; return null; }

        if (!me.trapped || !me.trapObject) { this.heldSinceTick = -1; return null; }

        /* Already bleeding: waiting costs more than the spike would. */
        if (me.onSpike) { this.heldSinceTick = -1; return null; }

        /* Only a threat while they can actually place and swing. */
        if (!EntityTracker.secondaryReady(target.sid)) { this.heldSinceTick = -1; return null; }

        const threat = this.findTrap(target);
        if (!threat) { this.heldSinceTick = -1; return null; }

        if (this.heldSinceTick < 0) this.heldSinceTick = GameState.tick;
        const heldFor = GameState.tick - this.heldSinceTick;
        const maxHold = Config.get('defense.antiSmartTick.maxHoldTicks');
        if (heldFor > maxHold) {
            /* Give up: the trap we are in is doing damage of its own, and an
             * unbounded wait is how a client gets held until it dies. */
            this.heldSinceTick = -1;
            return null;
        }

        return new HoldIntent({
            source: this.name,
            urgency: Config.get('defense.antiSmartTick.urgency'),
            confidence: threat.confidence,
            target,
            reason: 'smart-tick-setup',
            /* Hold the break, not the whole client. Combat can still swing at
             * the player; what must not happen is the structure break that
             * releases us into the waiting spike. */
            blocks: ['Placement', 'Replace'],
            untilTick: GameState.tick + 1,
            meta: { threat }
        });
    },

    /* Sweep the ring around the enemy for a spike position that would catch us
     * on the way out. Returns the worst one found, or null. */
    findTrap(enemy) {
        const me = GameState.self;
        /* Enemy loadouts are not on the wire -- UPDATE_ITEMS (S2C 'V') is sent
         * only to the owning client -- so the threat is modelled with the spike
         * we ourselves have slotted. That is the right assumption at the ages
         * where this matters, and erring toward the larger spike makes the
         * defence conservative rather than blind. */
        const spikeId = GameState.spikeItem;
        if (spikeId == null) return null;

        const item = Defs.items[spikeId];
        if (!item) return null;

        const steps = Config.get('defense.antiSmartTick.sweepSteps');
        const distance = Defs.placeDistance(spikeId);
        const contact = me.scale + item.scale;

        /* Their spikes are what our knockback would land on. */
        const enemySpikes = [];
        for (const obj of GameState.enemyObjects) {
            if (obj.active && obj.damage > 0) enemySpikes.push(obj);
        }

        let worst = null;

        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * U.PI2;
            const x = enemy.x2 + distance * Math.cos(angle);
            const y = enemy.y2 + distance * Math.sin(angle);

            /* Could they actually build there? Same test the server runs, with
             * the trap holding us excluded because it is about to break. */
            const objects = GameState.nearObjects.filter((o) => o !== me.trapObject);
            if (!GameState.checkItemLocation(x, y, item.scale, 0.6, item.id, false, objects)) continue;

            /* Would it be touching us once we are free? */
            if (U.getDistance(me.x2, me.y2, x, y) > contact) continue;

            /* Where would that spike's contact throw us? */
            const kb = Prediction.knockbackTo(me, x, y);

            /* Onto one of theirs? */
            for (let j = 0; j < enemySpikes.length; j++) {
                const s = enemySpikes[j];
                const pad = s.scale + me.scale;
                const lands = U.lineInRect(
                    s.x - pad, s.y - pad, s.x + pad, s.y + pad,
                    me.x2, me.y2, kb.x, kb.y
                );
                if (!lands) continue;

                const chainDamage = s.damage + item.dmg;
                if (!worst || chainDamage > worst.damage) {
                    worst = {
                        x, y, angle,
                        into: s,
                        damage: chainDamage,
                        /* Confidence is how sure we are they will take it: a
                         * ready hammer and a target in reach makes it likely. */
                        confidence: U.clamp(
                            (EntityTracker.secondaryReady(enemy.sid) ? 0.6 : 0.2)
                            + (Targeting.distanceTo(enemy) < 200 ? 0.3 : 0),
                            0, 1
                        )
                    };
                }
            }
        }

        return worst;
    },

    debugState() {
        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target || !me.trapped) return { holding: false };
        const threat = this.findTrap(target);
        return {
            holding: !!threat,
            heldTicks: this.heldSinceTick < 0 ? 0 : GameState.tick - this.heldSinceTick,
            projectedDamage: threat ? threat.damage : 0
        };
    }
};
