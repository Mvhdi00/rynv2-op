/* ===========================================================================
 * 2yz / AutoHeal
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's heal() and its heal gate
 * (novastorm_1.4.txt:12582 and 15226).
 *
 * NovaStorm's rule is: if projected incoming damage would kill us, or a tick
 * has passed since we were last hit, eat until full -- `for (i = 0; i < value;
 * i += items.list[items[0]].heal) place(items[0])`. The loop is the right shape
 * (one build packet per food item, count derived from the food's heal value
 * rather than guessed) and 2yz keeps it.
 *
 * What it does not do, and 2yz does:
 *
 *   - budget the food. Eating to full costs four frames per apple. At low
 *     health with a full second of packets already spent, NovaStorm queues them
 *     anyway and they are dropped mid-sequence, which leaves the client holding
 *     an apple. Here the count is clamped to what the frame budget can actually
 *     carry, and the restore is part of the same intent.
 *
 *   - respect shame. Eating past the shame ceiling gives the food away and
 *     resets nothing; HealIntent.validate refuses it.
 *
 *   - heal in the gap rather than into the hit. If a burst is already in flight
 *     and we would survive it, healing after it lands is worth more than
 *     healing before -- the heal that matters is the one that is not
 *     immediately erased.
 * =========================================================================== */

const AutoHeal = {
    name: 'AutoHeal',

    tick() {
        if (!Config.get('defense.autoHeal.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const foodId = GameState.foodItem;
        if (foodId == null) return null;
        const food = Defs.items[foodId];
        if (!food || !food.heal) return null;

        /* Total health one item is worth. Cheese restores 30 immediately and a
         * further 10 per tick for 5 ticks; both figures come from probing the
         * item's own consume() at extraction time, so counting only the instant
         * part would make 2yz eat roughly twice as much cheese as it needs. */
        const perItem = food.heal
            + (food.healOverTime ? food.healOverTime.perTick * food.healOverTime.ticks : 0);

        const missing = me.maxHealth - me.health;
        if (missing <= 0) return null;

        const incoming = SafeSoldier.lastProjection
            ? (SafeSoldier.lastProjection.mitigated || SafeSoldier.lastProjection.total)
            : Targeting.incomingDamage();

        const lethal = incoming >= me.health;
        const hurt = missing >= Config.get('defense.autoHeal.minMissing');
        const quiet = GameState.tick - me.lastHitTick > Config.get('defense.autoHeal.calmTicks');

        /* Three reasons to eat, in descending order of how much it matters. */
        let urgency = null;
        let reason = null;
        if (lethal) {
            urgency = Config.get('defense.autoHeal.urgencyLethal');
            reason = 'lethal-incoming';
        } else if (hurt && quiet) {
            urgency = Config.get('defense.autoHeal.urgencyTopUp');
            reason = 'top-up';
        } else if (hurt && incoming > 0 && me.health - incoming < Config.get('defense.autoHeal.dangerFloor')) {
            urgency = Config.get('defense.autoHeal.urgencyDanger');
            reason = 'below-floor';
        }
        if (urgency == null) return null;

        /* How many items to eat: enough to cover what is missing plus what is
         * incoming, never more than one full bar's worth. */
        const wanted = lethal ? missing + incoming : missing;
        /* Under fire the over-time portion arrives too late to matter, so a
         * lethal projection is budgeted against the instant heal only. */
        let count = Math.ceil(wanted / (lethal ? food.heal : perItem));

        /* Clamp to the frame budget. Four frames per item, and leave room for
         * whatever else the tick still owes. */
        const framesEach = 4;
        const reserve = Config.get('defense.autoHeal.frameReserve');
        const affordable = Math.floor((Net.budgetRemaining() - reserve) / framesEach);
        count = Math.min(count, affordable, Config.get('defense.autoHeal.maxItems'));
        if (count < 1) return null;

        return new HealIntent({
            source: this.name,
            urgency,
            confidence: lethal ? 1 : 0.8,
            target: Targeting.primary,
            itemId: foodId,
            count,
            meta: { reason, incoming: Math.round(incoming), missing }
        });
    },

    debugState() {
        const me = GameState.self;
        if (!me) return null;
        return {
            health: me.health,
            incoming: Math.round(Targeting.incomingDamage()),
            shame: me.shameCount,
            food: GameState.foodItem
        };
    }
};
