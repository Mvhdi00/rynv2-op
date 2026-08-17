/* ===========================================================================
 * 2yz / SafeSoldier
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's damage-potential accumulator and hatFc
 * (novastorm_1.4.txt:15100-15220 and 16160).
 *
 * NovaStorm builds a running `totalDmgPot` out of every damage source that
 * could land this tick -- an enemy's primary if we are inside its reach and its
 * cooldown is up, their secondary, a turret, poison, and 45 for a spike our
 * knockback would carry us into -- caps it at 140, and calls `soldierAnti` once
 * it crosses 100. That accumulator is the good idea here, and 2yz keeps it,
 * with every figure read from the shipped tables instead of hard-coded.
 *
 * Rebuilt rather than copied:
 *
 *   - NovaStorm's hatFc is a straight-line cascade of assignments where the
 *     last matching branch silently wins, so Soldier-for-safety and Bull-for-
 *     damage are decided by source order rather than by which matters more.
 *     Here the defensive hat is a DefenseIntent with an urgency proportional to
 *     the projected damage, and Combat's offensive hat is an ordinary intent
 *     too. The Arbiter picks, so a lethal incoming hit outranks a damage hat
 *     and a survivable one does not.
 *
 *   - the spike figure. NovaStorm uses a literal 45; 2yz reads the actual
 *     damage of the actual structure it projects us into.
 * =========================================================================== */

const SafeSoldier = {
    name: 'SafeSoldier',

    lastProjection: null,

    tick() {
        if (!Config.get('defense.safeSoldier.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive) return null;

        const projection = this.projectDamage();
        this.lastProjection = projection;

        const soldier = Defs.HAT.SOLDIER;
        if (soldier == null || !GameState.skins[soldier]) return null;
        if (me.skinIndex === soldier) return null;

        const threshold = Config.get('defense.safeSoldier.threshold');
        if (projection.total < threshold) return null;

        /* Urgency rises with how close the projection is to killing us: a hit
         * that takes half our health is worth a hat, one that kills us is worth
         * more than anything else on the tick. */
        const lethality = U.clamp(projection.total / Math.max(1, me.health), 0, 1.5);
        const urgency = Config.get('defense.safeSoldier.urgencyBase')
            + lethality * Config.get('defense.safeSoldier.urgencyScale');

        return new DefenseIntent({
            source: this.name,
            urgency,
            confidence: projection.confidence,
            target: Targeting.primary,
            hat: soldier,
            reason: 'incoming-' + Math.round(projection.total),
            meta: projection
        });
    },

    /* Everything that could land on us this tick, itemised. */
    projectDamage() {
        const me = GameState.self;
        const out = { hits: 0, secondary: 0, turret: 0, spike: 0, total: 0, confidence: 0.5, sources: [] };
        if (!me) return out;

        const enemies = Targeting.within(Config.get('defense.safeSoldier.scanRange'));
        let certainty = 0;

        for (const enemy of enemies) {
            const dist = U.getDistance(me.x2, me.y2, enemy.x2, enemy.y2);

            for (let slot = 0; slot < 2; slot++) {
                const idx = EntityTracker.weaponOf(enemy, slot);
                if (idx == null) continue;
                const weapon = Defs.weapons[idx];
                if (!weapon || weapon.dmg == null) continue;

                const reach = weapon.range + me.scale + enemy.scale;
                /* Use the predicted gap: a player closing fast is in range by
                 * the time their swing resolves. */
                const closing = Prediction.next(enemy);
                const meNext = Prediction.next(me);
                const soon = U.getDistance(meNext.x, meNext.y, closing.x, closing.y);
                if (Math.min(dist, soon) > reach) continue;

                const ready = slot === 0
                    ? EntityTracker.primaryReady(enemy.sid)
                    : EntityTracker.secondaryReady(enemy.sid);
                if (!ready) continue;

                if (!EntityTracker.shieldBypass(enemy, me)) continue;

                const dmg = EntityTracker.playerDamage(enemy, slot, me);
                if (slot === 0) out.hits += dmg; else out.secondary += dmg;
                out.sources.push({ sid: enemy.sid, slot, dmg: Math.round(dmg) });
                certainty += 0.35;
            }

            /* Turret Gear, from the shipped hat table. */
            const hat = EntityTracker.hatOf(enemy);
            if (hat && hat.turret && dist <= hat.turret.range && EntityTracker.turretReady(enemy.sid)) {
                const proj = Defs.projectiles[hat.turret.proj];
                if (proj && proj.dmg) {
                    out.turret += proj.dmg;
                    out.sources.push({ sid: enemy.sid, slot: 'turret', dmg: proj.dmg });
                    certainty += 0.2;
                }
            }
        }

        /* Hostile animals. Their damage figures come from the aiTypes table:
         * `dmg` is the swing, `colDmg` the contact damage, `hitRange` the reach
         * and `hitDelay` the cooldown. A charging bull is a bigger threat than
         * most players and the first build could not see it at all. */
        if (Config.get('defense.safeSoldier.countAnimals')) {
            for (const a of GameState.animals.values()) {
                if (!a.visible || !a.hostile) continue;
                const d = U.getDistance(me.x2, me.y2, a.x2, a.y2);
                const reach = (a.hitRange || a.scale) + me.scale;
                if (d > reach + Config.get('defense.safeSoldier.animalMargin')) continue;

                /* A swing that is still on cooldown cannot land this tick. */
                const ready = EntityTracker.primaryReady(a.sid);
                if (a.damage > 0 && ready) {
                    out.hits += a.damage;
                    out.sources.push({ sid: a.sid, slot: a.animalName, dmg: a.damage });
                    certainty += 0.3;
                }
                /* Contact damage lands on touch, cooldown or not. */
                if (a.collisionDamage > 0 && d <= a.scale + me.scale) {
                    out.spike += a.collisionDamage;
                    out.sources.push({ sid: a.sid, slot: a.animalName + '-contact', dmg: a.collisionDamage });
                    certainty += 0.4;
                }
            }
        }

        /* Projectiles already in the air. Damage and scale come from the shipped
         * projectile table; the path is dead reckoned by EntityTracker. */
        if (Config.get('defense.safeSoldier.countProjectiles')) {
            for (const proj of GameState.projectiles.values()) {
                if (!proj.active || proj.damage <= 0) continue;
                const end = proj.positionAt(Config.get('defense.safeSoldier.projectileHorizonMs'));
                const pad = proj.scale + me.scale;
                const willHit = U.lineInRect(
                    me.x2 - pad, me.y2 - pad, me.x2 + pad, me.y2 + pad,
                    proj.x, proj.y, end.x, end.y
                );
                if (!willHit) continue;
                out.turret += proj.damage;
                out.sources.push({ slot: 'projectile', dmg: proj.damage });
                certainty += 0.5;
            }
        }

        /* Structure contact, now or after a knockback we can already see coming. */
        if (me.onSpike) {
            out.spike += me.onSpike.damage;
            out.sources.push({ slot: 'spike', dmg: me.onSpike.damage });
            certainty += 0.5;
        } else {
            const worst = this.spikeOnKnockbackPath();
            if (worst) {
                out.spike += worst.damage;
                out.sources.push({ slot: 'spike-projected', dmg: worst.damage });
                certainty += 0.25;
            }
        }

        out.total = out.hits + out.secondary + out.turret + out.spike;

        /* NovaStorm caps the accumulator so a crowd cannot inflate it past what
         * one tick can actually deliver. The cap is the largest single-tick
         * total the game can produce, taken from the tables. */
        const cap = Config.get('defense.safeSoldier.damageCap');
        if (out.total > cap) out.total = cap;

        /* Soldier Helmet's own reduction, so the projection is what we would
         * take AFTER wearing it -- otherwise the module keeps the hat on for
         * damage it has already prevented. */
        const soldier = Defs.hats.find((h) => h.id === Defs.HAT.SOLDIER);
        out.mitigated = soldier && soldier.dmgMult ? out.total * soldier.dmgMult : out.total;

        out.confidence = U.clamp(certainty, 0, 1);
        return out;
    },

    /* The worst enemy spike a knockback from the nearest enemy would push us
     * onto. Returns null when there is none. */
    spikeOnKnockbackPath() {
        const me = GameState.self;
        const enemy = Targeting.primary;
        if (!enemy) return null;

        const kb = Prediction.knockbackTo(me, enemy.x2, enemy.y2);
        let worst = null;
        for (const obj of GameState.enemyObjects) {
            if (!obj.active || obj.damage <= 0) continue;
            const pad = obj.scale + me.scale;
            const lands = U.lineInRect(
                obj.x - pad, obj.y - pad, obj.x + pad, obj.y + pad,
                me.x2, me.y2, kb.x, kb.y
            );
            if (!lands) continue;
            if (!worst || obj.damage > worst.damage) worst = { object: obj, damage: obj.damage };
        }
        return worst;
    },

    debugState() {
        const p = this.lastProjection;
        if (!p) return null;
        return {
            total: Math.round(p.total),
            mitigated: Math.round(p.mitigated || p.total),
            confidence: Math.round(p.confidence * 100) / 100,
            sources: p.sources
        };
    }
};
