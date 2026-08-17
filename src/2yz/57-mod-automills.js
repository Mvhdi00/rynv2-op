/* ===========================================================================
 * 2yz / AutoMills
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's mill block inside getPredictObjects
 * (novastorm_1.4.txt:13358), the one its own comment calls "SHIT AUTO MILLS".
 *
 * The one good idea in it: mills go behind you, spread by the mill's own scale
 * (`angle -/+ toRad(scale + scale/2)`), so a walking player leaves a wall of
 * them rather than a pile. 2yz keeps the trailing placement and the
 * scale-derived spread, and gets the angles from PlacementEngine's 'utility'
 * ranking, which already prefers positions behind the direction of travel and
 * penalises anything across the path ahead.
 *
 * Everything else about NovaStorm's version is a problem this module exists to
 * fix. It runs on the same tick budget as the placer, in the same pass, with
 * only `!nearestTrap` between it and spending three build sequences while the
 * player is being tick-chained. Here it is the lowest-urgency producer in the
 * client and it withdraws entirely when anything real is happening -- so the
 * Arbiter never has to choose between a mill and a spike, because on a tick
 * where a spike is wanted the mill intent is not offered at all.
 * =========================================================================== */

const AutoMills = {
    name: 'AutoMills',

    tick() {
        if (!Config.get('utility.autoMills.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const millId = GameState.millItem;
        if (millId == null || GameState.isItemLimit(millId)) return null;

        if (this.suppressed()) return null;

        /* Trailing direction: opposite whichever way we are actually going. */
        const heading = GameState.input.moveDir != null ? GameState.input.moveDir : me.moveDir;
        if (heading == null) return null;

        const ranked = PlacementEngine.bestN(millId, Targeting.primary, 'utility', 8);
        if (!ranked.length) return null;

        const behind = heading + Math.PI;
        const spread = Config.get('utility.autoMills.spreadFactor');
        const item = Defs.items[millId];
        /* NovaStorm's spread: the mill's own scale, in degrees, times a factor.
         * Reading it from the item keeps the spacing right if the item changes. */
        const step = U.toRad(item.scale * spread);

        const wanted = [behind, behind - step, behind + step]
            .slice(0, Config.get('utility.autoMills.perTick'));

        const intents = [];
        for (const angle of wanted) {
            /* Take the ranked candidate nearest each wanted angle, so the mill
             * still lands somewhere legal when the exact angle is blocked. */
            let best = null;
            let bestGap = Infinity;
            for (const c of ranked) {
                const gap = U.getAngleDist(c.angle, angle);
                if (gap < bestGap && gap <= step) { bestGap = gap; best = c; }
            }
            if (!best) continue;
            if (intents.some((i) => i.candidate === best)) continue;

            intents.push(new PlacementIntent({
                source: this.name,
                urgency: Config.get('utility.autoMills.urgency'),
                confidence: 1,
                target: null,
                candidate: best,
                reason: 'mill-trail'
            }));
        }

        return intents.length ? intents : null;
    },

    /* Every reason not to be building mills. This is the module's real job:
     * the placement itself is trivial, staying out of the way is not. */
    suppressed() {
        const me = GameState.self;

        /* Anything hostile nearby and mills are the wrong use of the tick. */
        const enemies = Targeting.within(Config.get('utility.autoMills.safeRadius'));
        if (enemies.length) return true;

        /* Held, hurt or bleeding. */
        if (me.trapped || me.onSpike) return true;
        if (me.health < me.maxHealth * Config.get('utility.autoMills.minHealthFraction')) return true;

        /* Combat has something in flight. */
        if (CombatEngine.activeSequence) return true;
        if (Preplace.armed) return true;

        /* Resource floor: mills are worth building only out of surplus. The
         * cost comes from the item's own requirement, not a guess. */
        const item = Defs.items[GameState.millItem];
        if (item && item.req) {
            for (let i = 0; i < item.req.length; i += 2) {
                const resource = item.req[i];
                const amount = item.req[i + 1];
                const have = GameState.resources[resource];
                if (have == null) continue;
                const reserve = Config.get('utility.autoMills.resourceReserve');
                if (have - amount < reserve) return true;
            }
        }

        /* Frame budget: mills never eat into what a real action might need. */
        if (Net.budgetRemaining() < Config.get('utility.autoMills.frameFloor')) return true;

        return false;
    },

    debugState() {
        return {
            suppressed: GameState.self ? this.suppressed() : true,
            mill: GameState.millItem,
            count: GameState.itemCounts[Defs.GROUP.MILL] || 0,
            limit: Defs.groupLimit(Defs.GROUP.MILL)
        };
    }
};
