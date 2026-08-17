/* ===========================================================================
 * 2yz / AutoPlace
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's updateAngles / checkPredictObjects /
 * isAutoPlaceAngle (novastorm_1.4.txt:12726-13108).
 *
 * What was worth keeping from it: the ring sweep, boundary ("perfect") angles,
 * and the three tactical questions it asks -- does this hit the target, does it
 * chain them into another spike, does it wall off my own swing.
 *
 * What was not: the priority ladder. NovaStorm answers those questions as a
 * chain of `if (...) return true`, so a candidate that hits the target but also
 * blocks the player's line wins on the first clause and the second is never
 * reached. 2yz scores instead (PlacementEngine.rank), so a candidate that is
 * good on one axis and bad on another loses to one that is decent on both.
 *
 * Its own reasons to hold fire, which NovaStorm does not have: it will not
 * spend a placement on a target it cannot predict, and it will not place while
 * the trap it is standing in is about to break.
 * =========================================================================== */

const AutoPlace = {
    name: 'AutoPlace',

    tick() {
        if (!Config.get('placement.autoPlace.enabled')) return null;
        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target) return null;

        const range = Config.get('placement.autoPlace.range');
        if (Targeting.distanceTo(target) > range) return null;

        /* A target mid-turn is not worth spending a spike on -- by the time the
         * build lands they are somewhere else. Preplace exists for the case
         * where the movement IS predictable. */
        const confidence = Prediction.confidence(target);
        if (confidence < Config.get('placement.autoPlace.minConfidence')) return null;

        const intents = [];
        const spikeId = GameState.spikeItem;
        const trapId = GameState.trapItem;

        if (spikeId != null && Config.get('placement.autoPlace.spikes')) {
            const best = PlacementEngine.best(spikeId, target, 'spike');
            if (best && best.score >= Config.get('placement.autoPlace.minScore')) {
                intents.push(new PlacementIntent({
                    source: this.name,
                    urgency: Config.get('placement.autoPlace.urgency'),
                    confidence,
                    target,
                    candidate: best,
                    reason: best.reasons.join(',')
                }));
            }
        }

        if (trapId != null && Config.get('placement.autoPlace.traps')) {
            /* A trap only pays when neither of us is already held: trapping a
             * trapped player wastes the item, and placing one while we are
             * stuck seals us in with them. */
            if (!target.trapped && !me.trapped) {
                const best = PlacementEngine.best(trapId, target, 'trap');
                if (best && best.score >= Config.get('placement.autoPlace.minScore')) {
                    intents.push(new PlacementIntent({
                        source: this.name,
                        /* A trap that actually closes their last exit is worth
                         * more than a spike; one that does not is worth less. */
                        urgency: best.reasons.indexOf('encloses') >= 0
                            ? Config.get('placement.autoPlace.urgencyEnclose')
                            : Config.get('placement.autoPlace.urgency') - 5,
                        confidence,
                        target,
                        candidate: best,
                        reason: best.reasons.join(',')
                    }));
                }
            }
        }

        return intents;
    },

    debugState() {
        const target = Targeting.primary;
        if (!target || !GameState.spikeItem) return null;
        const ranked = PlacementEngine.bestN(GameState.spikeItem, target, 'spike', 3);
        return {
            top: ranked.map((c) => ({
                angle: Math.round(U.toDeg(c.angle)),
                score: Math.round(c.score * 10) / 10,
                why: c.reasons.join(',')
            }))
        };
    }
};
