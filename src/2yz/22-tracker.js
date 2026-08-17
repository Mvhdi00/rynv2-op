/* ===========================================================================
 * 2yz / EntityTracker
 * ---------------------------------------------------------------------------
 * Everything derived from raw state, computed once per tick, in one place.
 * Velocity, facing, reload clocks, trap containment and spike contact all live
 * here so that Combat, the placement modules and the defensive modules read the
 * same numbers rather than each recomputing them.
 *
 * Reload clocks are inferred rather than read: the server tells every client
 * about every swing (S2C ATTACK_ANIM, game_index.js:5038), and weapon cooldowns
 * are in the shipped weapon table, so a swing plus a table lookup gives a
 * cooldown that is correct for weapons 2yz never sees the owner select.
 * =========================================================================== */

const EntityTracker = (function () {
    /* sid -> {primary: msRemaining, secondary: msRemaining, turret: msRemaining} */
    const reloads = new Map();

    /* Turret Gear fire rate, from the shipped hat table rather than a literal. */
    const turretHat = Defs.hats.find((h) => h.turret);
    const TURRET_RATE = turretHat ? turretHat.turret.rate : null;

    function reloadOf(sid) {
        let r = reloads.get(sid);
        if (!r) {
            r = { primary: 0, secondary: 0, turret: 0 };
            reloads.set(sid, r);
        }
        return r;
    }

    function onAttack(player, weaponIndex) {
        const r = reloadOf(player.sid);
        const weapon = Defs.weapons[weaponIndex];
        if (!weapon) return;
        if (weapon.type === 0) {
            r.primary = weapon.speed;
            player.primaryIndex = weaponIndex;
        } else {
            r.secondary = weapon.speed;
            player.secondaryIndex = weaponIndex;
        }
        Events.emit('swing', player, weaponIndex);
    }

    function tickReloads(dt) {
        for (const r of reloads.values()) {
            if (r.primary > 0) r.primary = Math.max(0, r.primary - dt);
            if (r.secondary > 0) r.secondary = Math.max(0, r.secondary - dt);
            if (r.turret > 0) r.turret = Math.max(0, r.turret - dt);
        }
    }

    /* Rebuild the near-object list. Range is generous enough to cover the
     * furthest thing any module asks about (turret range is the widest figure
     * in the shipped tables) and is computed once, not per module. */
    let NEAR_RANGE = 900;
    (function deriveNearRange() {
        let max = 0;
        for (const w of Defs.weapons) if (w.range > max) max = w.range;
        for (const h of Defs.hats) if (h.turret && h.turret.range > max) max = h.turret.range;
        NEAR_RANGE = max + 200;
    })();

    function rebuildNearObjects() {
        const me = GameState.self;
        const out = GameState.nearObjects;
        out.length = 0;
        if (!me) return;
        const r2 = NEAR_RANGE * NEAR_RANGE;
        for (const obj of GameState.objects.values()) {
            if (!obj.active) continue;
            if (U.getDistanceSq(me.x2, me.y2, obj.x, obj.y) <= r2) out.push(obj);
        }
    }

    /* Velocity from the interpolation pair. The game moves entities between two
     * server snapshots, so (x2 - x1) over the snapshot interval is the per-tick
     * displacement -- the same quantity the server integrates. */
    function updateMotion(p, dt) {
        const dx = p.x2 - p.x1;
        const dy = p.y2 - p.y1;
        p.xVel = dx;
        p.yVel = dy;
        p.speed = Math.sqrt(dx * dx + dy * dy);

        p.prevMoveDir = p.moveDir;
        if (p.speed > 0.05) {
            p.moveDir = Math.atan2(dy, dx);
            p.dirChange = U.getAngleDist(p.prevMoveDir, p.moveDir);
        } else {
            p.dirChange = 0;
        }
        p.history.push({ x: p.x2, y: p.y2, dir: p.moveDir, speed: p.speed, t: p.t2 });
    }

    /* Trap containment and spike contact, from the live object list. The game's
     * own rule (game_index.js:2540-ish, checkCollision) is that a trap holds a
     * player when the player's centre is inside the trap's scale and the trap is
     * not the player's own or a teammate's. */
    function updateContacts(p) {
        p.trapped = false;
        p.trapObject = null;
        p.onSpike = null;

        const objects = GameState.nearObjects;
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (!obj.active) continue;
            const d = U.getDistance(p.x2, p.y2, obj.x, obj.y);

            if (obj.trap && d < obj.scale) {
                const ownerIsFriendly = obj.ownerSid === p.sid || (
                    obj.ownerSid != null && GameState.isAlly(obj.ownerSid) && GameState.isAlly(p.sid)
                );
                if (!ownerIsFriendly) {
                    p.trapped = true;
                    p.trapObject = obj;
                }
            }

            if (obj.damage > 0 && d < obj.scale + p.scale) {
                p.onSpike = obj;
            }
        }
    }

    function onDamage(player, amount) {
        /* Spike contact at the moment of a health drop is what "spikeDamage"
         * means everywhere downstream: the enemy is being hurt by a structure,
         * so a tick placed on them will land. */
        if (player.onSpike) player.spikeDamage = amount;
    }

    function onTick() {
        const dt = GameState.lastTickDelta;
        tickReloads(dt);
        rebuildNearObjects();

        for (const p of GameState.players.values()) {
            if (!p.visible) continue;
            updateMotion(p, dt);
            updateContacts(p);
        }

        /* spikeDamage is a one-tick flag, cleared after everyone downstream has
         * had the tick to read it. */
        Events.emit('trackerReady');
        for (const p of GameState.players.values()) p.spikeDamage = 0;
    }

    return {
        install() {
            Events.on('attack', onAttack);
            Events.on('damage', onDamage);
            Events.on('turretFired', function (player) {
                if (TURRET_RATE != null) reloadOf(player.sid).turret = TURRET_RATE;
            });
            Events.on('tick', onTick);
            Events.on('playerLeft', (p) => reloads.delete(p.sid));
        },

        /* --- reload queries, used by Combat and the tick modules ----------- */
        reloadOf,
        primaryReady(sid) { return reloadOf(sid).primary <= 0; },
        secondaryReady(sid) { return reloadOf(sid).secondary <= 0; },
        primaryRemaining(sid) { return reloadOf(sid).primary; },
        secondaryRemaining(sid) { return reloadOf(sid).secondary; },
        turretReady(sid) { return TURRET_RATE != null && reloadOf(sid).turret <= 0; },

        /* --- effective stats, hat and variant included -------------------- */

        weaponOf(player, slot) {
            if (player === GameState.self) {
                return slot === 0 ? GameState.weapons[0] : GameState.weapons[1];
            }
            return slot === 0 ? player.primaryIndex : player.secondaryIndex;
        },

        variantOf(player, slot) {
            return slot === 0 ? player.primaryVariant : player.secondaryVariant;
        },

        hatOf(player) {
            return player.skinIndex ? Defs.hats.find((h) => h.id === player.skinIndex) : null;
        },

        /* Damage a swing of `slot` would do to a player, with weapon variant,
         * Bull Helmet's dmgMultO and the target's Soldier Helmet dmgMult all
         * applied -- every multiplier read from the shipped tables. */
        playerDamage(attacker, slot, victim) {
            const idx = this.weaponOf(attacker, slot);
            const weapon = Defs.weapons[idx];
            if (!weapon || weapon.dmg == null) return 0;
            let dmg = weapon.dmg;
            const variant = Defs.config.weaponVariants[this.variantOf(attacker, slot)];
            if (variant) dmg *= variant.val;
            const aHat = this.hatOf(attacker);
            if (aHat && aHat.dmgMultO) dmg *= aHat.dmgMultO;
            if (victim) {
                const vHat = this.hatOf(victim);
                if (vHat && vHat.dmgMult) dmg *= vHat.dmgMult;
            }
            return dmg;
        },

        /* Damage a swing of `slot` would do to a structure. Tank Gear's bDmg is
         * the building multiplier; sDmg is the weapon's own structure factor. */
        structureDamage(attacker, slot) {
            const idx = this.weaponOf(attacker, slot);
            const weapon = Defs.weapons[idx];
            if (!weapon || weapon.dmg == null) return 0;
            let dmg = weapon.dmg * (weapon.sDmg || 1);
            const variant = Defs.config.weaponVariants[this.variantOf(attacker, slot)];
            if (variant) dmg *= variant.val;
            const hat = this.hatOf(attacker);
            if (hat && hat.bDmg) dmg *= hat.bDmg;
            return dmg;
        },

        rangeOf(player, slot) {
            const weapon = Defs.weapons[this.weaponOf(player, slot)];
            return weapon ? weapon.range : 0;
        },

        /* Movement speed multiplier from hat and held weapon, both from tables. */
        speedMultOf(player) {
            let mult = 1;
            const hat = this.hatOf(player);
            if (hat && hat.spdMult) mult *= hat.spdMult;
            const weapon = Defs.weapons[player.weaponIndex];
            if (weapon && weapon.spdMult) mult *= weapon.spdMult;
            const acc = player.tailIndex
                ? Defs.accessories.find((a) => a.id === player.tailIndex)
                : null;
            if (acc && acc.spdMult) mult *= acc.spdMult;
            return mult;
        },

        /* Does `slot`'s swing get through the target's shield? The game gives a
         * shield an arc of config.shieldAngle centred on the holder's facing;
         * an attack arriving inside that arc is blocked. */
        shieldBypass(attacker, victim) {
            const shield = Defs.weapons[victim.weaponIndex];
            if (!shield || !shield.shield) return true;
            const incoming = U.getDirection(attacker.x2, attacker.y2, victim.x2, victim.y2);
            return U.getAngleDist(victim.d2, incoming) > Defs.config.shieldAngle;
        }
    };
})();
