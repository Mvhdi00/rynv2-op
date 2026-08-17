/* ===========================================================================
 * 2yz / CombatEngine
 * ---------------------------------------------------------------------------
 * Attack decisions, weapon choice, timing and validation. The concepts here are
 * the ones TND is built on, rebuilt against 2yz's state:
 *
 *   - a burst is a scheduled sequence across ticks, not a single swing. TND
 *     awaits a tick between the two halves of an insta and re-checks the target
 *     still exists before committing the second; 2yz models that as a Sequence
 *     with a per-step revalidation hook.
 *
 *   - order depends on the pair. TND runs secondary-then-primary when the
 *     primary is a short-range dagger-class weapon paired with a great hammer,
 *     and primary-then-secondary otherwise, because the slower weapon has to be
 *     the one whose travel is covered by the other's animation.
 *
 *   - range is checked against both the current and the predicted position, so
 *     a burst is not thrown away because the target was a frame out of reach.
 *
 *   - shield arc is checked before committing. A swing into a raised shield is
 *     wasted, and worse, it resets the cooldown that the next opening needs.
 *
 *   - a hat swap belongs to the swing, not to the tick. Damage hats go on for
 *     the frame the hit lands and come off immediately after.
 *
 * What is not taken from TND: its global mutable flags (instaing, instaToggle,
 * hold, aim[0]) and its async/await packet emission. Both are replaced by the
 * intent/arbiter path, so combat cannot fire a packet behind the scheduler's
 * back and cannot deadlock on an await that never resolves.
 * =========================================================================== */

/* An ordered set of steps to run across consecutive ticks. */
class Sequence {
    constructor(name, steps, meta) {
        this.name = name;
        this.steps = steps;
        this.index = 0;
        this.meta = meta || {};
        this.startedTick = GameState.tick;
        this.dead = false;
    }
    get current() { return this.steps[this.index]; }
    get done() { return this.index >= this.steps.length; }
    advance() { this.index++; }
    kill(reason) { this.dead = true; this.deadReason = reason; }
}

const CombatEngine = (function () {
    let active = null;

    /* A knockback secondary: a weapon whose value against a player is the push
     * rather than the damage. In the shipped table that is exactly the weapons
     * carrying a structure multiplier (sDmg), which is the great hammer. */
    function isKnockbackSecondary(weaponIndex) {
        const w = Defs.weapons[weaponIndex];
        return !!(w && w.sDmg && w.sDmg > 1);
    }

    /* Slot the burst should open with.
     *
     * TND reverses the order for `(primary == 4 || primary == 5) && secondary == 10`
     * -- katana or polearm paired with the great hammer -- so the hammer swings
     * first and the slow primary lands inside its recovery. 2yz reproduces that
     * set from the shipped range table rather than from the ids: katana (118)
     * and polearm (142) are the only primaries above the long-reach threshold,
     * so the rule keeps working if the ids ever move. */
    function openingSlot(primaryIdx, secondaryIdx) {
        if (!isKnockbackSecondary(secondaryIdx)) return 0;
        const primary = Defs.weapons[primaryIdx];
        if (!primary) return 0;
        return primary.range > Config.get('combat.longReachRange') ? 1 : 0;
    }

    /* Would a hit landed from where we are throw the target onto one of our
     * spikes? This is what makes a hammer burst worth its cooldown even though
     * the hammer's own player damage is negligible -- the chain is the damage.
     * Reuses PlacementEngine's chain measure so combat and placement agree on
     * what "will connect" means. */
    function hasKnockbackChain(target) {
        const me = GameState.self;
        const probe = { x: me.x2, y: me.y2, scale: me.scale };
        return PlacementEngine.knockbackChain(probe, target) != null;
    }

    function inReach(target, slot) {
        const me = GameState.self;
        const reach = EntityTracker.rangeOf(me, slot) + me.scale + target.scale;
        const now = U.getDistance(me.x2, me.y2, target.x2, target.y2);
        if (now <= reach) return true;
        /* Give the burst the benefit of where both of us will be when the
         * packet lands. */
        const t = Prediction.atLatency(target);
        const m = Prediction.atLatency(me);
        return U.getDistance(m.x, m.y, t.x, t.y) <= reach;
    }

    /* Everything that has to hold for a burst to be worth starting. */
    function canBurst(target) {
        const me = GameState.self;
        if (!me || !target) return false;
        if (!Config.get('combat.burstEnabled')) return false;
        if (GameState.weapons[1] == null) return false;
        if (!EntityTracker.primaryReady(me.sid)) return false;
        if (!EntityTracker.secondaryReady(me.sid)) return false;
        if (!EntityTracker.shieldBypass(me, target)) return false;
        if (!inReach(target, 0) && !inReach(target, 1)) return false;
        return true;
    }

    /* Total damage a full burst would land, both slots, hats included. */
    function burstDamage(target) {
        const me = GameState.self;
        return EntityTracker.playerDamage(me, 0, target)
            + EntityTracker.playerDamage(me, 1, target);
    }

    function buildBurst(target) {
        const me = GameState.self;
        const primaryIdx = GameState.weapons[0];
        const secondaryIdx = GameState.weapons[1];
        const first = openingSlot(primaryIdx, secondaryIdx);
        const second = first === 0 ? 1 : 0;

        const damageHat = Defs.HAT.BULL;

        const stepFor = (slot) => ({
            slot,
            weapon: slot === 0 ? primaryIdx : secondaryIdx,
            hat: damageHat,
            /* Re-run immediately before this step is emitted. */
            validate(seq) {
                const t = seq.meta.target;
                if (!t || !t.visible || !t.alive) return 'target-gone';
                if (t !== Targeting.primary) return 'target-switched';
                if (!inReach(t, slot)) return 'out-of-reach';
                if (!EntityTracker.shieldBypass(GameState.self, t)) return 'shielded';
                return null;
            }
        });

        return new Sequence('burst', [stepFor(first), stepFor(second)], {
            target,
            expectedDamage: burstDamage(target)
        });
    }

    /* Single swing, for when only one slot is off cooldown or the burst gate
     * refused. */
    function buildSwing(target, slot) {
        return new Sequence('swing', [{
            slot,
            weapon: slot === 0 ? GameState.weapons[0] : GameState.weapons[1],
            hat: Defs.HAT.BULL,
            validate(seq) {
                const t = seq.meta.target;
                if (!t || !t.visible || !t.alive) return 'target-gone';
                if (!inReach(t, slot)) return 'out-of-reach';
                return null;
            }
        }], { target, expectedDamage: EntityTracker.playerDamage(GameState.self, slot, target) });
    }

    return {
        install() {
            Events.on('targetSwitched', function () {
                /* A sequence aimed at someone else is worthless. Dropping it
                 * here is what stops a burst from finishing into thin air. */
                if (active && !active.done) active.kill('target-switched');
            });
            Events.on('death', function () { active = null; });
        },

        get activeSequence() { return active && !active.dead && !active.done ? active : null; },

        /* Called once per tick by the runtime. Returns the AttackIntent for
         * this tick, or null. */
        decide() {
            const me = GameState.self;
            if (!me || !GameState.inGame || !me.alive) { active = null; return null; }
            if (!Config.get('combat.enabled')) { active = null; return null; }

            const target = Targeting.primary;
            if (!target) { active = null; return null; }

            /* Continue an in-flight sequence before starting a new one. */
            if (active && !active.dead && !active.done) {
                const step = active.current;
                const bad = step.validate ? step.validate(active) : null;
                if (bad) {
                    active.kill(bad);
                    Events.emit('sequenceCancelled', active, bad);
                    active = null;
                } else {
                    return new AttackIntent({
                        source: 'Combat',
                        urgency: Config.get('combat.urgencyBurst'),
                        confidence: 1,
                        target,
                        slot: step.slot,
                        weapon: step.weapon,
                        hat: step.hat,
                        angle: this.aimAngle(target),
                        sequence: active
                    });
                }
            }

            /* Hold fire while a shield is between us and the target and we have
             * no way through -- the swing would only feed their cooldown. */
            if (!EntityTracker.shieldBypass(me, target)) return null;

            if (canBurst(target)) {
                /* Three reasons a burst is worth both cooldowns:
                 *   - it does enough raw damage on its own;
                 *   - the target is held and cannot walk out of the follow-up;
                 *   - the secondary is a knockback weapon and there is a spike
                 *     for it to throw them onto, which is where the damage
                 *     actually comes from in a hammer pair.
                 * Without the third, the polearm-and-hammer pair would never
                 * fire, because its raw two-slot damage is below any sensible
                 * threshold. */
                const damage = burstDamage(target);
                const worthIt = damage >= Config.get('combat.minBurstDamage')
                    || target.trapped
                    || (isKnockbackSecondary(GameState.weapons[1]) && hasKnockbackChain(target));
                if (worthIt) {
                    active = buildBurst(target);
                    const step = active.current;
                    return new AttackIntent({
                        source: 'Combat',
                        urgency: Config.get('combat.urgencyBurst'),
                        confidence: Prediction.confidence(target),
                        target,
                        slot: step.slot,
                        weapon: step.weapon,
                        hat: step.hat,
                        angle: this.aimAngle(target),
                        sequence: active
                    });
                }
            }

            /* Single swing on whichever slot is ready and in reach. */
            for (const slot of [0, 1]) {
                const ready = slot === 0
                    ? EntityTracker.primaryReady(me.sid)
                    : EntityTracker.secondaryReady(me.sid);
                if (!ready) continue;
                if (GameState.weapons[slot] == null) continue;
                if (!inReach(target, slot)) continue;

                active = buildSwing(target, slot);
                const step = active.current;
                return new AttackIntent({
                    source: 'Combat',
                    urgency: Config.get('combat.urgencySwing'),
                    confidence: Prediction.confidence(target),
                    target,
                    slot: step.slot,
                    weapon: step.weapon,
                    hat: step.hat,
                    angle: this.aimAngle(target),
                    sequence: active
                });
            }

            return null;
        },

        /* Where to point. Leads the target by the predicted travel over the
         * round trip, so the swing arc covers where they will be. */
        aimAngle(target) {
            const me = GameState.self;
            if (!target) return GameState.input.aimDir;
            if (!Config.get('combat.leadTarget')) {
                return U.getDirection(target.x2, target.y2, me.x2, me.y2);
            }
            const t = Prediction.atLatency(target);
            return U.getDirection(t.x, t.y, me.x2, me.y2);
        },

        /* Exposed for the tick modules: is the target currently a free hit? */
        isOpen(target) {
            const me = GameState.self;
            if (!me || !target) return false;
            return EntityTracker.shieldBypass(me, target)
                && (inReach(target, 0) || inReach(target, 1));
        },

        inReach,
        burstDamage,

        debugState() {
            const seq = this.activeSequence;
            return {
                enabled: Config.get('combat.enabled'),
                sequence: seq ? seq.name + ' ' + (seq.index + 1) + '/' + seq.steps.length : null,
                target: Targeting.primary ? Targeting.primary.sid : null,
                primaryReady: GameState.self ? EntityTracker.primaryReady(GameState.self.sid) : null,
                secondaryReady: GameState.self ? EntityTracker.secondaryReady(GameState.self.sid) : null
            };
        }
    };
})();
