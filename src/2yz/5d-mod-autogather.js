/* ===========================================================================
 * 2yz / AutoGather
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's needAutoGather (novastorm_1.4.txt:15316).
 *
 * The game's auto-gather toggle (C2S TOGGLE with 1) holds the attack down, so
 * it both farms resources and keeps a weapon swinging. NovaStorm's rule is that
 * it should be ON while the player is actually engaged or gathering, and OFF
 * while a defensive situation is live -- because a held attack fights the
 * client's own swing timing and burns the cooldown a burst needs.
 *
 * 2yz keeps that shape and states the conflict explicitly: the toggle is turned
 * off whenever Combat has a sequence in flight, because a held attack makes
 * per-tick swing scheduling meaningless.
 * =========================================================================== */

const AutoGather = {
    name: 'AutoGather',

    tick() {
        if (!Config.get('utility.autoGather.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const desired = this.shouldHold();
        if (GameState.input.autoGather === desired) return null;

        return new ToggleIntent({
            source: this.name,
            urgency: Config.get('utility.autoGather.urgency'),
            confidence: 1,
            which: 1,
            desired,
            reason: desired ? 'gather-on' : 'gather-off'
        });
    },

    shouldHold() {
        const me = GameState.self;

        /* A held attack and a scheduled burst cannot both own the swing. */
        if (CombatEngine.activeSequence) return false;

        /* Defensive situations want the swing free. */
        if (me.trapped || me.onSpike) return false;
        if (SafeSoldier.lastProjection
            && SafeSoldier.lastProjection.total >= Config.get('defense.safeSoldier.threshold')) {
            return false;
        }

        /* No enemy nearby: farming is the whole point. */
        const enemies = Targeting.within(Config.get('utility.autoGather.combatRadius'));
        if (!enemies.length) return true;

        /* Enemy nearby but out of reach and we are not committed -- keep
         * gathering, it is free value. */
        const target = Targeting.primary;
        return !!target && !CombatEngine.isOpen(target);
    },

    debugState() {
        return {
            on: GameState.input.autoGather,
            wants: GameState.self ? this.shouldHold() : null
        };
    }
};
