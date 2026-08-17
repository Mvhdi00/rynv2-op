/* ===========================================================================
 * 2yz / SpikeTick
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's canTrapTick and canVelocitySpikeTick
 * (novastorm_1.4.txt:12543 and 12171).
 *
 * Spike Tick is WHEN, and only WHEN. NovaStorm mixes the two -- canTrapTick
 * sweeps the ring itself via getPrePlaceAngles to decide whether the moment is
 * right, and then the placer sweeps it again to decide where. 2yz splits them:
 * PlacementEngine answers where, this module answers whether now is the moment,
 * and the two share one sweep.
 *
 * The timing conditions, which are what NovaStorm actually gets right:
 *
 *   - the target must be held. A tick on someone who can walk out of the
 *     knockback is a wasted spike and a wasted cooldown.
 *   - our hammer must be off cooldown, because the sequence is spike-then-break
 *     and there is no point starting it without the break.
 *   - the structure holding them has to be one we can break in a single swing,
 *     which is a table lookup against secondary structure damage.
 *   - the target must not already be bleeding on a spike -- that tick is
 *     already happening.
 *   - the push must not throw them toward us. NovaStorm gates this at PI/5
 *     between push direction and target->player; the same gate lives in
 *     PlacementEngine so every module inherits it.
 * =========================================================================== */

const SpikeTick = {
    name: 'SpikeTick',

    tick() {
        if (!Config.get('placement.spikeTick.enabled')) return null;
        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target) return null;

        if (!this.windowOpen(target)) return null;

        const spikeId = GameState.spikeItem;
        if (spikeId == null || GameState.isItemLimit(spikeId)) return null;

        /* WHERE comes from the shared engine, off the same cached sweep
         * AutoPlace uses this tick. */
        const ranked = PlacementEngine.bestN(spikeId, target, 'spike', 4);
        const contact = Config.get('placement.spikeTick.contactRange');

        /* Of the good candidates, take one that will actually be touching the
         * target -- a tick is a contact hit, not an area denial. */
        const best = ranked.find(
            (c) => U.getDistance(c.x, c.y, target.x2, target.y2) < c.scale + contact
        );
        if (!best) return null;

        return new PlacementIntent({
            source: this.name,
            /* Higher than ordinary placement: the window is narrow and closes
             * when their trap breaks. */
            urgency: Config.get('placement.spikeTick.urgency'),
            confidence: Prediction.confidence(target),
            target,
            candidate: best,
            reason: 'spiketick:' + best.reasons.join(',')
        });
    },

    /* Is this the tick? */
    windowOpen(target) {
        const me = GameState.self;

        /* Already taking structure damage -- the tick is in progress. */
        if (target.spikeDamage > 0 || target.onSpike) return false;

        /* The sequence needs the hammer. */
        if (!EntityTracker.secondaryReady(me.sid)) return false;
        const secondary = Defs.weapons[GameState.weapons[1]];
        if (!secondary || !secondary.sDmg) return false;

        const holder = target.trapObject;
        if (!holder) return false;

        /* Ours: breaking someone else's trap frees the target for nothing. */
        if (holder.ownerSid !== GameState.mySid && !GameState.isAlly(holder.ownerSid)) return false;

        /* One swing has to finish it, or the target walks before the second. */
        const breakDamage = EntityTracker.structureDamage(me, 1);
        if (holder.health > breakDamage) return false;

        /* Both the trap and the target have to be inside reach. */
        const reach = EntityTracker.rangeOf(me, 1) + me.scale;
        if (U.getDistance(me.x2, me.y2, holder.x, holder.y) > reach + holder.scale) return false;
        if (Targeting.distanceTo(target) > reach + target.scale) return false;

        return true;
    },

    debugState() {
        const target = Targeting.primary;
        if (!target) return { window: false, why: 'no-target' };
        return {
            window: this.windowOpen(target),
            targetTrapped: target.trapped,
            hammerReady: GameState.self ? EntityTracker.secondaryReady(GameState.self.sid) : null
        };
    }
};
