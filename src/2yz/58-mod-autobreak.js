/* ===========================================================================
 * 2yz / AutoBreak
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's autoBreak block and its selectWeaponAndBreak
 * helper (novastorm_1.4.txt:14008-14040).
 *
 * This module closes the one architectural gap the first build shipped with.
 * Anti Smart Tick decides when NOT to break out of a trap -- but nothing in
 * 2yz actually broke out, so the hold guarded a decision the client never made.
 * Combat only ever targets players; a structure is a different kind of target
 * and gets its own module.
 *
 * NovaStorm's weapon-selection ladder is the part worth keeping, and it is a
 * genuinely good piece of reasoning:
 *
 *   - a fast primary that can one-shot the structure beats the hammer, because
 *     the swing recovers sooner and the follow-up lands earlier;
 *   - otherwise the hammer, if the structure is in its reach;
 *   - otherwise the primary;
 *   - and while trapped, a fast primary in range regardless, because being
 *     free one tick sooner outweighs the damage difference.
 *
 * 2yz keeps that order, reads every damage and range figure from the shipped
 * tables, and adds the priority NovaStorm leaves implicit: what to break first
 * when several things qualify.
 * =========================================================================== */

const AutoBreak = {
    name: 'AutoBreak',

    tick() {
        if (!Config.get('combat.autoBreak.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const target = this.pick();
        if (!target) return null;

        const choice = this.chooseWeapon(target.object);
        if (!choice) return null;

        return new BreakIntent({
            source: this.name,
            urgency: target.urgency,
            confidence: 1,
            target: Targeting.primary,
            object: target.object,
            slot: choice.slot,
            weapon: choice.weapon,
            angle: U.getDirection(target.object.x, target.object.y, me.x2, me.y2),
            reason: target.reason
        });
    },

    /* What to break, in descending order of how much it matters. */
    pick() {
        const me = GameState.self;
        const enemy = Targeting.primary;

        /* 1. The trap holding us. Nothing else matters while we cannot move.
         *    Anti Smart Tick may veto this through its HoldIntent -- that is
         *    exactly the interaction it exists for. */
        if (me.trapped && me.trapObject && this.reachable(me.trapObject)) {
            return {
                object: me.trapObject,
                urgency: Config.get('combat.autoBreak.urgencyEscape'),
                reason: 'escape-trap'
            };
        }

        /* 2. An enemy structure standing between us and the target. Breaking it
         *    is what re-opens the swing. */
        if (enemy && Config.get('combat.autoBreak.clearLine')) {
            const blocker = this.lineBlocker(enemy);
            if (blocker) {
                return {
                    object: blocker,
                    urgency: Config.get('combat.autoBreak.urgencyClear'),
                    reason: 'clear-line'
                };
            }
        }

        /* 3. An enemy spike close enough to hurt us where we stand. */
        if (Config.get('combat.autoBreak.clearHazards')) {
            const hazard = this.nearestHazard();
            if (hazard) {
                return {
                    object: hazard,
                    urgency: Config.get('combat.autoBreak.urgencyHazard'),
                    reason: 'clear-hazard'
                };
            }
        }

        return null;
    },

    reachable(obj) {
        const me = GameState.self;
        const reach = Math.max(
            EntityTracker.rangeOf(me, 0),
            GameState.weapons[1] != null ? EntityTracker.rangeOf(me, 1) : 0
        );
        return U.getDistance(me.x2, me.y2, obj.x, obj.y) <= reach + me.scale + obj.scale;
    },

    /* An enemy structure sitting on the line from us to the target. */
    lineBlocker(enemy) {
        const me = GameState.self;
        let best = null;
        let bestDist = Infinity;
        for (const obj of GameState.enemyObjects) {
            if (!obj.active || !obj.isItem) continue;
            if (!this.reachable(obj)) continue;
            const pad = obj.scale;
            const onLine = U.lineInRect(
                obj.x - pad, obj.y - pad, obj.x + pad, obj.y + pad,
                me.x2, me.y2, enemy.x2, enemy.y2
            );
            if (!onLine) continue;
            const d = U.getDistance(me.x2, me.y2, obj.x, obj.y);
            if (d < bestDist) { bestDist = d; best = obj; }
        }
        return best;
    },

    /* The enemy spike we are standing on or about to be pushed into. */
    nearestHazard() {
        const me = GameState.self;
        if (me.onSpike && me.onSpike.ownerSid != null
            && !GameState.isAlly(me.onSpike.ownerSid)
            && this.reachable(me.onSpike)) {
            return me.onSpike;
        }
        let best = null;
        let bestDist = Infinity;
        for (const obj of GameState.enemyObjects) {
            if (!obj.active || obj.damage <= 0) continue;
            if (!this.reachable(obj)) continue;
            const d = U.getDistance(me.x2, me.y2, obj.x, obj.y);
            if (d > obj.scale + me.scale + Config.get('combat.autoBreak.hazardMargin')) continue;
            if (d < bestDist) { bestDist = d; best = obj; }
        }
        return best;
    },

    /* NovaStorm's ladder, with the figures read from the tables. */
    chooseWeapon(obj) {
        const me = GameState.self;
        const primary = GameState.weapons[0];
        const secondary = GameState.weapons[1];

        const inRange = (slot) => {
            const idx = slot === 0 ? primary : secondary;
            if (idx == null) return false;
            const w = Defs.weapons[idx];
            if (!w || w.range == null) return false;
            return U.getDistance(me.x2, me.y2, obj.x, obj.y) <= w.range + me.scale + obj.scale;
        };

        const primaryFast = Defs.weapons[primary]
            && Defs.weapons[primary].speed < Config.get('combat.autoBreak.fastPrimarySpeed');
        const primaryOneShot = EntityTracker.structureDamage(me, 0) >= obj.health;
        const secondaryIsHammer = secondary != null
            && Defs.weapons[secondary] && Defs.weapons[secondary].sDmg > 1;

        /* A slot that is still on cooldown cannot break anything this tick. */
        const ready = (slot) => (slot === 0
            ? EntityTracker.primaryReady(me.sid)
            : EntityTracker.secondaryReady(me.sid));

        if (primaryFast && primaryOneShot && inRange(0) && ready(0)) {
            return { slot: 0, weapon: primary };
        }
        if (secondaryIsHammer && inRange(1) && ready(1)) {
            return { slot: 1, weapon: secondary };
        }
        if (!secondaryIsHammer && inRange(0) && ready(0)) {
            return { slot: 0, weapon: primary };
        }
        if (me.trapped && primaryFast && inRange(0) && ready(0)) {
            return { slot: 0, weapon: primary };
        }
        return null;
    },

    debugState() {
        const me = GameState.self;
        if (!me) return null;
        const t = this.pick();
        return {
            trapped: me.trapped,
            breaking: t ? t.object.name + ' (' + t.reason + ')' : null,
            weapon: t ? this.chooseWeapon(t.object) : null
        };
    }
};
