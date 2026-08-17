/* ===========================================================================
 * 2yz / Targeting
 * ---------------------------------------------------------------------------
 * One target system. Combat, Auto Place, Preplace, Replace, Spike Tick, Anti
 * Smart Tick and Safe Soldier all read `Targeting.primary` -- there is no
 * second notion of "the enemy" anywhere in the client.
 *
 * The score is deliberately not "nearest wins". A player at 250 who is winding
 * up a great-hammer matters more than one at 180 who is walking away, and the
 * placement modules want the target whose movement they can actually cut off.
 * =========================================================================== */

const Targeting = (function () {
    let primary = null;
    let candidates = [];
    let lastSwitchTick = -999;

    function isValid(p) {
        if (!p || !p.visible || !p.alive) return false;
        if (!GameState.self) return false;
        /* An animal is always a valid target when animal targeting is on; it has
         * no team and cannot be us. */
        if (p.isAI) return Config.get('combat.targetAnimals');
        if (p.sid === GameState.mySid) return false;
        if (!p.isEnemyOf(GameState.self)) return false;
        return true;
    }

    /* Threat: how much damage this player could land on us in the near term,
     * from the shipped tables via EntityTracker. Both slots count, weighted by
     * how close each is to being off cooldown. */
    function threatOf(p) {
        const me = GameState.self;
        if (!me) return 0;
        const dist = U.getDistance(me.x2, me.y2, p.x2, p.y2);

        /* Animals have no weapon slots; their damage is a table field. */
        if (p.isAI) {
            if (!p.hostile) return 0;
            const reach = (p.hitRange || p.scale) + me.scale;
            if (dist > reach * 1.6) return 0;
            const readiness = EntityTracker.primaryReady(p.sid) ? 1 : 0.3;
            return (p.damage + (dist <= p.scale + me.scale ? p.collisionDamage : 0)) * readiness;
        }

        let threat = 0;
        for (let slot = 0; slot < 2; slot++) {
            const idx = EntityTracker.weaponOf(p, slot);
            if (idx == null) continue;
            const weapon = Defs.weapons[idx];
            if (!weapon) continue;
            const reach = weapon.range + me.scale + p.scale;
            if (dist > reach * 1.6) continue;

            const remaining = slot === 0
                ? EntityTracker.primaryRemaining(p.sid)
                : EntityTracker.secondaryRemaining(p.sid);
            const readiness = weapon.speed ? U.clamp(1 - remaining / weapon.speed, 0, 1) : 1;
            const inReach = dist <= reach ? 1 : 0.35;
            threat += EntityTracker.playerDamage(p, slot, me) * readiness * inReach;
        }

        /* A player closing on us is more dangerous than one at the same range
         * holding still. */
        const closing = closingRate(p);
        if (closing > 0) threat *= 1 + U.clamp(closing / 20, 0, 0.5);
        return threat;
    }

    /* Positive when the gap is shrinking, in units per tick. */
    function closingRate(p) {
        const me = GameState.self;
        if (!me) return 0;
        const now = U.getDistance(me.x2, me.y2, p.x2, p.y2);
        const soon = Prediction.next(p);
        const meSoon = Prediction.next(me);
        const later = U.getDistance(meSoon.x, meSoon.y, soon.x, soon.y);
        return now - later;
    }

    function score(p) {
        const me = GameState.self;
        const dist = U.getDistance(me.x2, me.y2, p.x2, p.y2);
        const w = {
            distance: Config.get('combat.weightDistance'),
            threat: Config.get('combat.weightThreat'),
            vulnerable: Config.get('combat.weightVulnerable')
        };

        /* Distance term, normalised against the search radius so the weights
         * stay comparable. */
        const radius = Config.get('combat.targetRadius');
        const near = U.clamp(1 - dist / radius, 0, 1);

        /* Vulnerability: trapped, low, already bleeding on a spike, or shield
         * pointing the wrong way -- all reasons to commit to this one. */
        let vulnerable = 0;
        if (p.trapped) vulnerable += 0.5;
        if (p.onSpike) vulnerable += 0.2;
        vulnerable += U.clamp(1 - p.health / p.maxHealth, 0, 1) * 0.3;
        /* Animals carry no shield, so the arc test does not apply to them. */
        if (!p.isAI && GameState.self && EntityTracker.shieldBypass(GameState.self, p)) vulnerable += 0.1;

        const threat = U.clamp(threatOf(p) / 100, 0, 1);
        return near * w.distance + threat * w.threat + vulnerable * w.vulnerable;
    }

    function recompute() {
        const me = GameState.self;
        candidates = [];
        if (!me || !GameState.inGame) { primary = null; return; }

        const radius = Config.get('combat.targetRadius');
        for (const p of GameState.players.values()) {
            if (!isValid(p)) continue;
            if (U.getDistance(me.x2, me.y2, p.x2, p.y2) > radius) continue;
            p.targetScore = score(p);
            p.threat = threatOf(p);
            candidates.push(p);
        }
        /* Animals, when enabled. A hostile animal in reach is a genuine threat
         * and a passive one is the fastest XP in the game, but neither should
         * ever outrank a player who is actively fighting us -- so their score is
         * scaled down rather than competing on equal terms. */
        if (Config.get('combat.targetAnimals')) {
            const scale = Config.get('combat.animalScoreScale');
            for (const a of GameState.animals.values()) {
                if (!a.visible || !a.alive) continue;
                const d = U.getDistance(me.x2, me.y2, a.x2, a.y2);
                if (d > radius) continue;
                if (!a.hostile && !Config.get('combat.targetPassiveAnimals')) continue;
                a.targetScore = score(a) * scale;
                a.threat = a.hostile ? threatOf(a) : 0;
                candidates.push(a);
            }
        }

        candidates.sort((a, b) => b.targetScore - a.targetScore);

        const best = candidates[0] || null;

        if (!primary || !isValid(primary)) {
            primary = best;
            lastSwitchTick = GameState.tick;
            return;
        }

        if (!best || best === primary) return;

        /* Hysteresis. Swapping targets mid-sequence throws away a wound-up
         * insta and a half-built trap, so a challenger has to be clearly better
         * and the current target has to have been held for a moment. */
        const held = GameState.tick - lastSwitchTick;
        const margin = Config.get('combat.switchMargin');
        const minHold = Config.get('combat.switchMinTicks');
        if (held >= minHold && best.targetScore > primary.targetScore * (1 + margin)) {
            const previous = primary;
            primary = best;
            lastSwitchTick = GameState.tick;
            Events.emit('targetSwitched', best, previous);
        }
    }

    return {
        install() { Events.on('trackerReady', recompute); },

        get primary() { return isValid(primary) ? primary : null; },
        get all() { return candidates; },

        /* Anyone hostile inside `range`, for multi-enemy decisions such as
         * whether Safe Soldier should stay defensive. */
        within(range) {
            const me = GameState.self;
            if (!me) return [];
            return candidates.filter((p) => U.getDistance(me.x2, me.y2, p.x2, p.y2) <= range);
        },

        distanceTo(p) {
            const me = GameState.self;
            if (!me || !p) return Infinity;
            return U.getDistance(me.x2, me.y2, p.x2, p.y2);
        },

        threatOf,
        closingRate,

        /* Total incoming damage 2yz believes is on its way. Auto Heal and Safe
         * Soldier both budget against this one number. */
        incomingDamage() {
            const me = GameState.self;
            if (!me) return 0;
            let total = 0;
            for (const p of candidates) total += threatOf(p);
            if (me.onSpike) total += me.onSpike.damage;
            return total;
        },

        debugState() {
            const t = this.primary;
            if (!t) return { target: null, candidates: candidates.length };
            return {
                target: t.name || t.sid,
                sid: t.sid,
                distance: Math.round(this.distanceTo(t)),
                score: Math.round(t.targetScore * 100) / 100,
                threat: Math.round(t.threat),
                trapped: t.trapped,
                candidates: candidates.length
            };
        }
    };
})();
