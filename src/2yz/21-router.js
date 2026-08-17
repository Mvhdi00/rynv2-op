/* ===========================================================================
 * 2yz / Router
 * ---------------------------------------------------------------------------
 * Wire -> GameState. The only place inbound packets are interpreted, and the
 * only place the outbound stream is read for human intent.
 *
 * Every branch below cites the handler in src/game_index.js it mirrors.
 * =========================================================================== */

const Router = (function () {
    const S = Defs.S2C;
    const C = Defs.C2S;

    function upsertPlayer(sid) {
        let p = GameState.players.get(sid);
        if (!p) {
            p = new Entity(sid);
            GameState.players.set(sid, p);
        }
        return p;
    }

    /* --------------------------------------------------------------- inbound */

    const inbound = {
        /* xl -- game_index.js:4629. Argument is the local player's sid. */
        [S.SETUP_GAME](sid) {
            GameState.mySid = sid;
            GameState.inGame = true;
            GameState.self = upsertPlayer(sid);
            /* Ownership buckets were built against the old sid. */
            GameState.myObjects.clear();
            GameState.teamObjects.clear();
            GameState.enemyObjects.clear();
            for (const obj of GameState.objects.values()) GameState.indexObject(obj);
            Events.emit('spawn', GameState.self);
        },

        /* Nl -- game_index.js:5515.
         * data = [id, sid, name, x, y, dir, health, maxHealth, scale, skinColor]
         * (getData/setData, game_index.js:2291-2305) */
        [S.ADD_PLAYER](data, isYou) {
            const p = upsertPlayer(data[1]);
            p.id = data[0];
            p.name = data[2];
            p.x1 = p.x2 = data[3];
            p.y1 = p.y2 = data[4];
            p.d1 = p.d2 = data[5];
            p.health = data[6];
            p.maxHealth = data[7];
            p.scale = data[8];
            p.alive = true;
            p.history.clear();
            if (isYou) {
                GameState.mySid = p.sid;
                GameState.self = p;
                GameState.inGame = true;
                Events.emit('spawn', p);
            }
        },

        /* zl -- game_index.js:5533. Argument is the player's id, not sid. */
        [S.REMOVE_PLAYER](id) {
            for (const [sid, p] of GameState.players) {
                if (p.id === id) {
                    GameState.players.delete(sid);
                    Events.emit('playerLeft', p);
                    break;
                }
            }
        },

        /* Jl -- game_index.js:5551. Flat, stride 13, field order in
         * Defs.PLAYER_FIELDS. This is the tick packet: everything downstream is
         * driven off it. */
        [S.UPDATE_PLAYERS](flat) {
            const now = Date.now();
            for (const p of GameState.players.values()) p.visible = false;

            const stride = Defs.STRIDE.UPDATE_PLAYERS;
            for (let i = 0; i + stride <= flat.length; i += stride) {
                const p = GameState.players.get(flat[i]);
                if (!p) continue;
                p.t1 = p.t2 === 0 ? now : p.t2;
                p.t2 = now;
                p.x1 = p.x2;
                p.y1 = p.y2;
                p.x2 = flat[i + 1];
                p.y2 = flat[i + 2];
                p.d1 = p.d2;
                p.d2 = flat[i + 3];
                p.buildIndex = flat[i + 4];
                p.weaponIndex = flat[i + 5];
                p.weaponVariant = flat[i + 6];
                p.team = flat[i + 7];
                p.isLeader = flat[i + 8];
                p.skinIndex = flat[i + 9];
                p.tailIndex = flat[i + 10];
                p.zIndex = flat[i + 12];
                p.visible = true;

                /* weaponIndex only reports what is held right now, so the two
                 * slots are latched separately. Ranges, damage and reload speed
                 * for the slot the enemy is NOT holding come from these. */
                if (p.weaponIndex != null && p.weaponIndex < 9) {
                    p.primaryIndex = p.weaponIndex;
                    p.primaryVariant = p.weaponVariant;
                } else if (p.weaponIndex != null && p.weaponIndex > 8) {
                    p.secondaryIndex = p.weaponIndex;
                    p.secondaryVariant = p.weaponVariant;
                }
            }

            GameState.tick++;
            GameState.lastTickDelta = GameState.tickTime ? now - GameState.tickTime : Defs.TICK_MS;
            GameState.tickTime = now;
            Events.emit('tick');
        },

        /* Vl -- game_index.js:5432. Flat, stride 8, fields in Defs.OBJECT_FIELDS.
         * ownerSid < 0 means an unowned natural resource. */
        [S.LOAD_OBJECTS](flat) {
            const stride = Defs.STRIDE.LOAD_OBJECTS;
            for (let i = 0; i + stride <= flat.length; i += stride) {
                GameState.addObject(
                    flat[i], flat[i + 1], flat[i + 2], flat[i + 3],
                    flat[i + 4], flat[i + 5], flat[i + 6],
                    flat[i + 7] >= 0 ? flat[i + 7] : null
                );
            }
        },

        /* Il -- game_index.js:4710 */
        [S.KILL_OBJECT](sid) { GameState.removeObject(sid); },

        /* Ml -- game_index.js:4707 */
        [S.KILL_ALL_OBJECTS](ownerSid) { GameState.removeObjectsOf(ownerSid); },

        /* $l -- game_index.js:5547 */
        [S.UPDATE_HEALTH](sid, health) {
            const p = GameState.players.get(sid);
            if (!p) return;
            const drop = p.health - health;
            p.health = health;
            if (drop > 0) {
                p.lastHealthDrop = drop;
                p.lastHitTick = GameState.tick;
                Events.emit('damage', p, drop);
            }
            if (health <= 0) p.alive = false;
        },

        /* Nn -- game_index.js:4402 */
        [S.UPDATE_ITEMS](list, isWeapon) {
            if (!list) return;
            if (isWeapon) GameState.weapons = list;
            else GameState.items = list;
        },

        /* Yl -- game_index.js:5540 */
        [S.UPDATE_ITEM_COUNTS](groupId, count) {
            GameState.itemCounts[groupId] = count;
        },

        /* Kl -- game_index.js:5543. Generic "set one field on the local player". */
        [S.UPDATE_VALUE](key, value) {
            if (key in GameState.resources) GameState.resources[key] = value;
            else if (key === 'points') GameState.resources.points = value;
            if (GameState.self && (key === 'health' || key === 'maxHealth')) {
                GameState.self[key] = value;
            }
        },

        /* Sl -- game_index.js:4684 */
        [S.KILL_PLAYER]() {
            GameState.inGame = false;
            if (GameState.self) GameState.self.alive = false;
            Events.emit('death');
        },

        /* Pl -- game_index.js:5038, startAnim(didHit, weaponIndex). This is how
         * 2yz sees every swing in the world, including enemies', which is what
         * the reload model and Anti Smart Tick are built on. */
        [S.ATTACK_ANIM](sid, didHit, weaponIndex) {
            const p = GameState.players.get(sid);
            if (!p) return;
            Events.emit('attack', p, weaponIndex, didHit);
        },

        /* jn -- age/XP. Only the age matters, for which items are unlocked. */
        [S.UPDATE_AGE](xp, maxXp, age) {
            if (age != null) GameState.age = age;
        },

        /* Un -- upgrade points available. */
        [S.UPDATE_UPGRADES](points) { GameState.upgradePoints = points; },

        /* al -- game_index.js:4220.
         *   isEquip truthy -> the item is now worn  (skinIndex / tailIndex)
         *   isEquip falsy   -> the item is now owned (skins[id] / tails[id])
         * This is the only source for which hats we may equip, so Safe Soldier
         * and Combat's damage-hat swap both depend on it. */
        [S.UPDATE_STORE](isEquip, id, isAccessory) {
            if (isAccessory) {
                if (isEquip) { if (GameState.self) GameState.self.tailIndex = id; }
                else GameState.tails[id] = 1;
            } else if (isEquip) {
                if (GameState.self) GameState.self.skinIndex = id;
            } else {
                GameState.skins[id] = 1;
            }
        },

        /* Ja -- game_index.js:4006. Team membership changes who owns what, so
         * the object buckets have to be rebuilt. */
        [S.SET_TEAM](team) {
            if (GameState.self) GameState.self.team = team;
            GameState.myObjects.clear();
            GameState.teamObjects.clear();
            GameState.enemyObjects.clear();
            for (const obj of GameState.objects.values()) GameState.indexObject(obj);
        },

        /* _l -- game_index.js:5444. A Turret Gear discharged. This is the only
         * observable that starts a turret's cooldown, so without it the turret
         * reads as permanently ready and Safe Soldier over-projects. */
        [S.SHOOT_TURRET](sid) {
            const p = GameState.players.get(sid);
            if (p) Events.emit('turretFired', p);
        }
    };

    /* -------------------------------------------------------------- outbound
     * Frames the game bundle tried to send. 2yz records the human's intent and
     * then re-emits through the scheduler, so nothing reaches the socket except
     * via one path. */
    function handleOutbound(name, args) {
        const input = GameState.input;
        switch (name) {
            case C.AIM_DIR:
                input.aimDir = args[0];
                break;
            case C.MOVE_DIR:
                input.moveDir = args[0];
                break;
            case C.MOVE_STOP:
                input.moveDir = null;
                break;
            case C.ATTACK:
                input.attacking = !!args[0];
                break;
            case C.TOGGLE:
                if (args[0] === 1) input.autoGather = !input.autoGather;
                break;
            default:
                break;
        }
        Scheduler.submitPassthrough(name, args);
    }

    function install() {
        Transport.on('inbound', function (name, args) {
            const fn = inbound[name];
            if (fn) fn.apply(null, args);
        });
        Transport.on('outbound', handleOutbound);
        Transport.on('close', function () { GameState.reset(); });
    }

    return { install, inbound };
})();
