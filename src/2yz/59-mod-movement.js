/* ===========================================================================
 * 2yz / Movement
 * ---------------------------------------------------------------------------
 * Source concepts: NovaStorm's canAutoPush and isNearestEnemyPushPlayer
 * (novastorm_1.4.txt:13757 and 13780).
 *
 * This is the module that most needs restraint, so its default is off. 2yz
 * normally never sends a movement packet at all -- the player's own MOVE_DIR
 * passes through untouched and the client is a decision layer on top of human
 * movement. This module is the exception, and it only speaks when it has a
 * specific reason:
 *
 *   anti-knockback  a hit is about to throw us onto a structure; lean into the
 *                   push so the displacement lands short of it
 *   safe walk       the direction we are already going runs into an enemy spike
 *                   inside the next second; steer to the nearest clear heading
 *   push            walking into the target would carry them onto one of our
 *                   spikes, and the lane is clear of hazards for us
 *
 * NovaStorm's canAutoPush is the good idea here: before committing to a push,
 * sweep every object on the lane and refuse if the lane costs us more than it
 * costs them. Its hazard classes -- enemy spikes, boost pads, teleporters --
 * come from the shipped item table rather than the id literals NovaStorm uses.
 * =========================================================================== */

const Movement = {
    name: 'Movement',

    tick() {
        if (!Config.get('movement.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        /* Order matters: surviving beats positioning beats aggression. */
        return this.antiKnockback(me)
            || this.safeWalk(me)
            || this.push(me)
            || null;
    },

    /* --------------------------------------------------------- anti-knockback
     * A hit coming from the enemy pushes us along enemy->us. If that push lands
     * us on a damaging structure, moving INTO the incoming direction shortens
     * the displacement enough to stop short of it. */
    antiKnockback(me) {
        if (!Config.get('movement.antiKnockback')) return null;
        const enemy = Targeting.primary;
        if (!enemy) return null;

        /* Only worth it when a hit is actually imminent. */
        if (!EntityTracker.primaryReady(enemy.sid) && !EntityTracker.secondaryReady(enemy.sid)) {
            return null;
        }
        const reach = Math.max(
            EntityTracker.rangeOf(enemy, 0),
            enemy.secondaryIndex != null ? EntityTracker.rangeOf(enemy, 1) : 0
        ) + me.scale + enemy.scale;
        if (Targeting.distanceTo(enemy) > reach) return null;

        const kb = Prediction.knockbackTo(me, enemy.x2, enemy.y2);
        const hazard = this.hazardOnSegment(me.x2, me.y2, kb.x, kb.y, me.scale);
        if (!hazard) return null;

        /* Lean toward the attacker: the push and our movement partly cancel. */
        const into = U.getDirection(enemy.x2, enemy.y2, me.x2, me.y2);
        return new MoveIntent({
            source: this.name,
            urgency: Config.get('movement.urgencyAntiKnockback'),
            confidence: Prediction.confidence(enemy),
            target: enemy,
            angle: into,
            reason: 'anti-kb',
            holdTicks: 1
        });
    },

    /* ------------------------------------------------------------- safe walk
     * The heading the player is already using, projected forward. If it runs
     * into a hazard, pick the nearest heading that does not. */
    safeWalk(me) {
        if (!Config.get('movement.safeWalk')) return null;
        const heading = GameState.input.moveDir;
        if (heading == null) return null;

        const reach = Config.get('movement.lookaheadDistance');
        const endX = me.x2 + reach * Math.cos(heading);
        const endY = me.y2 + reach * Math.sin(heading);
        if (!this.hazardOnSegment(me.x2, me.y2, endX, endY, me.scale)) return null;

        /* Sweep outward from the intended heading so the correction is the
         * smallest one that works, rather than the first one found. */
        const steps = Config.get('movement.avoidSteps');
        for (let i = 1; i <= steps; i++) {
            const offset = (i / steps) * (Math.PI * 0.75);
            for (const sign of [1, -1]) {
                const candidate = heading + sign * offset;
                const cx = me.x2 + reach * Math.cos(candidate);
                const cy = me.y2 + reach * Math.sin(candidate);
                if (this.hazardOnSegment(me.x2, me.y2, cx, cy, me.scale)) continue;
                return new MoveIntent({
                    source: this.name,
                    urgency: Config.get('movement.urgencySafeWalk'),
                    confidence: 1,
                    target: Targeting.primary,
                    angle: candidate,
                    reason: 'safe-walk',
                    holdTicks: 1
                });
            }
        }
        /* Every direction is blocked -- stopping beats walking into it. */
        return new MoveIntent({
            source: this.name,
            urgency: Config.get('movement.urgencySafeWalk'),
            confidence: 1,
            target: Targeting.primary,
            angle: null,
            reason: 'boxed-in',
            holdTicks: 1
        });
    },

    /* ------------------------------------------------------------------ push
     * Walk into the target when body-blocking would carry them onto one of our
     * spikes. NovaStorm gates this on the lane being clear for US, which is the
     * part that stops a push from being a mutual suicide. */
    push(me) {
        if (!Config.get('movement.autoPush')) return null;
        const enemy = Targeting.primary;
        if (!enemy) return null;
        if (me.trapped) return null;

        const gap = Targeting.distanceTo(enemy);
        if (gap > Config.get('movement.pushRange')) return null;

        /* Where would shoving them take them? */
        const shove = U.getDirection(enemy.x2, enemy.y2, me.x2, me.y2);
        const dist = Config.get('movement.pushDistance');
        const endX = enemy.x2 + dist * Math.cos(shove);
        const endY = enemy.y2 + dist * Math.sin(shove);

        let lands = null;
        for (const obj of GameState.myObjects) {
            if (!obj.active || obj.damage <= 0) continue;
            const pad = obj.scale + enemy.scale;
            if (U.lineInRect(obj.x - pad, obj.y - pad, obj.x + pad, obj.y + pad,
                enemy.x2, enemy.y2, endX, endY)) { lands = obj; break; }
        }
        if (!lands) return null;

        /* NovaStorm's guard: the lane we would walk down must be clear for us. */
        if (this.hazardOnSegment(me.x2, me.y2, enemy.x2, enemy.y2, me.scale)) return null;

        return new MoveIntent({
            source: this.name,
            urgency: Config.get('movement.urgencyPush'),
            confidence: Prediction.confidence(enemy),
            target: enemy,
            angle: U.getDirection(enemy.x2, enemy.y2, me.x2, me.y2),
            reason: 'push-into-spike',
            holdTicks: 1
        });
    },

    /* ---------------------------------------------------------------- shared
     * Anything on this segment that would hurt or displace us. Hazard classes
     * come from the item table: dmg for spikes, boostSpeed for pads, teleport
     * for teleporters, trap for pit traps we do not own. */
    hazardOnSegment(x1, y1, x2, y2, radius) {
        const objects = GameState.nearObjects;
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (!obj.active || !obj.isItem) continue;

            const ours = obj.ownerSid != null
                && (obj.ownerSid === GameState.mySid || GameState.isAlly(obj.ownerSid));

            const item = obj.item || {};
            const hurts = obj.damage > 0 && !ours;
            const holds = obj.trap && !ours;
            const shoves = !!item.boostSpeed;
            const ports = !!item.teleport;
            if (!hurts && !holds && !shoves && !ports) continue;

            if (U.pointToSegment(obj.x, obj.y, x1, y1, x2, y2) < obj.scale + radius) return obj;
        }
        return null;
    },

    debugState() {
        const me = GameState.self;
        if (!me) return null;
        const heading = GameState.input.moveDir;
        return {
            enabled: Config.get('movement.enabled'),
            heading: heading == null ? null : Math.round(U.toDeg(heading)),
            hazardAhead: heading == null ? null : !!this.hazardOnSegment(
                me.x2, me.y2,
                me.x2 + Config.get('movement.lookaheadDistance') * Math.cos(heading),
                me.y2 + Config.get('movement.lookaheadDistance') * Math.sin(heading),
                me.scale
            )
        };
    }
};
