/* ===========================================================================
 * 2yz / ShameReset
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's shouldResetShame flag and the hatFc branch that
 * acts on it (novastorm_1.4.txt:15208 and 16188).
 *
 * Shame is the game's anti-heal-spam counter: past a threshold, eating stops
 * restoring health. The counter decays on its own, and the Bull Helmet's
 * healthRegen of -5 (from the shipped hat table) drains health continuously,
 * which is what makes wearing it during a lull the standard way to burn the
 * counter down without wasting food.
 *
 * NovaStorm sets its flag when nothing is happening -- no projected damage, no
 * structure contact, no poison -- and clears it the same tick. 2yz keeps that
 * condition, and adds the two things NovaStorm's version does not check: it
 * refuses while health is low enough that the drain itself is a risk, and it
 * yields to Safe Soldier by carrying a lower urgency, so an incoming hit always
 * wins the hat slot.
 *
 * Note on what 2yz can and cannot see: the local player's shame count is not
 * transmitted as a field. It is inferred from heals that produced no health
 * change, which is the only observable the protocol offers.
 * =========================================================================== */

const ShameReset = {
    name: 'ShameReset',

    /* Inferred, not received. A heal that moved the health bar means the
     * counter is not blocking yet; one that did not means it is. */
    pendingHeal: null,

    install() {
        Events.on('healSent', () => {
            const me = GameState.self;
            if (!me) return;
            this.pendingHeal = { tick: GameState.tick, health: me.health };
        });

        Events.on('trackerReady', () => {
            const me = GameState.self;
            const p = this.pendingHeal;
            if (!me || !p) return;
            /* Give the server a tick to apply it. */
            if (GameState.tick <= p.tick) return;
            this.pendingHeal = null;
            if (me.health > p.health) me.shameCount = Math.max(0, me.shameCount - 1);
            else if (me.health === p.health && me.health < me.maxHealth) me.shameCount++;
        });

        Events.on('spawn', () => {
            this.pendingHeal = null;
            if (GameState.self) GameState.self.shameCount = 0;
        });
    },

    tick() {
        if (!Config.get('defense.shameReset.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const bull = Defs.HAT.BULL;
        if (bull == null || !GameState.skins[bull]) return null;
        if (me.skinIndex === bull) return null;

        if (me.shameCount < Config.get('defense.shameReset.minShame')) return null;

        /* Only during a genuine lull -- the drain is a cost, and wearing a
         * damage hat while something is incoming is Safe Soldier's problem. */
        if (me.trapped || me.onSpike) return null;
        if (Targeting.incomingDamage() > 0) return null;
        if (Targeting.within(Config.get('defense.shameReset.safeRadius')).length) return null;

        /* The hat drains health; do not wear it into a hole. */
        const floor = Config.get('defense.shameReset.minHealthFraction');
        if (me.health < me.maxHealth * floor) return null;

        return new DefenseIntent({
            source: this.name,
            /* Deliberately below Safe Soldier's base, so any real threat
             * takes the hat slot instead. */
            urgency: Config.get('defense.shameReset.urgency'),
            confidence: 1,
            target: null,
            hat: bull,
            reason: 'burn-shame-' + me.shameCount
        });
    },

    debugState() {
        const me = GameState.self;
        if (!me) return null;
        return {
            shame: me.shameCount,
            ceiling: Config.get('defense.shameCeiling'),
            wearing: me.skinIndex
        };
    }
};
