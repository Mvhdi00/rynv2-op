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
            /* The server steps at a fixed rate (config.serverUpdateRate), so the
             * wall-clock gap between two packets is network jitter, not a change
             * in how far the world moved. Clamping it around the known tick keeps
             * projectile dead reckoning and the reload clocks honest: two packets
             * in the same millisecond would otherwise advance nothing, and a
             * stalled connection would advance everything at once. */
            const observed = GameState.tickTime ? now - GameState.tickTime : Defs.TICK_MS;
            GameState.lastTickDelta = U.clamp(observed, Defs.TICK_MS * 0.5, Defs.TICK_MS * 2);
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

        /* Xl -- game_index.js:5457. Flat, stride 7, fields in Defs.AI_FIELDS.
         * Animals are a whole entity class the first build ignored: hostile ones
         * deal contact and swing damage, and every stat they have comes from the
         * aiTypes table rather than the wire. */
        [S.UPDATE_AI](flat) {
            const now = Date.now();
            for (const a of GameState.animals.values()) a.visible = false;
            if (!flat) return;

            const stride = Defs.STRIDE.UPDATE_AI;
            for (let i = 0; i + stride <= flat.length; i += stride) {
                const sid = flat[i];
                const typeIndex = flat[i + 1];
                let a = GameState.animals.get(sid);
                if (!a || a.typeIndex !== typeIndex) {
                    a = new Animal(sid, typeIndex);
                    a.x1 = a.x2 = flat[i + 2];
                    a.y1 = a.y2 = flat[i + 3];
                    GameState.animals.set(sid, a);
                }
                a.t1 = a.t2 === 0 ? now : a.t2;
                a.t2 = now;
                a.x1 = a.x2;
                a.y1 = a.y2;
                a.x2 = flat[i + 2];
                a.y2 = flat[i + 3];
                a.d1 = a.d2;
                a.d2 = flat[i + 4];
                a.health = flat[i + 5];
                a.visible = true;
                a.alive = a.health > 0;
            }
            /* Anything the packet did not mention has left our view. */
            for (const [sid, a] of GameState.animals) {
                if (!a.visible) GameState.animals.delete(sid);
            }
        },

        /* Fl -- game_index.js:5457-ish. An animal swung. Same use as a player's
         * ATTACK_ANIM: it starts the swing clock the threat model reads. */
        [S.GATHER_ANIM_AI](sid) {
            const a = GameState.animals.get(sid);
            if (a) {
                a.lastSwingTick = GameState.tick;
                Events.emit('animalSwing', a);
            }
        },

        /* Ll -- game_index.js:5443. (x, y, dir, range, speed, typeIndex, layer, sid).
         * An arrow or bullet in flight. Damage and scale come from the shipped
         * projectile table; without this the threat model cannot see anything
         * ranged coming. */
        [S.ADD_PROJECTILE](x, y, dir, range, speed, typeIndex, layer, sid) {
            const p = new Projectile(sid, x, y, dir, range, speed, typeIndex, layer);
            GameState.projectiles.set(sid, p);
            Events.emit('projectile', p);
        },

        /* ql -- game_index.js:5451. (sid, range). The server updates a
         * projectile's remaining range; zero or less means it is spent. */
        [S.REMOVE_PROJECTILE](sid, range) {
            const p = GameState.projectiles.get(sid);
            if (!p) return;
            p.range = range;
            if (range <= 0) {
                p.active = false;
                GameState.projectiles.delete(sid);
            }
        },

        /* Wa -- game_index.js:3675. The alliance list at join time. */
        [S.INIT](data) {
            if (data && data.teams) GameState.teams = data.teams;
        },

        /* Qa -- game_index.js:4011. The authoritative alliance roster,
         * [sid, name, sid, name, ...]. Ownership of every structure is keyed off
         * this; before it existed 2yz inferred allies from the team string
         * alone, which fails for an owner never seen as a visible player. */
        [S.ALLY_LIST](flat) {
            GameState.allianceSids.clear();
            if (Array.isArray(flat)) {
                for (let i = 0; i < flat.length; i += 2) GameState.allianceSids.add(flat[i]);
            }
            GameState.myObjects.clear();
            GameState.teamObjects.clear();
            GameState.enemyObjects.clear();
            for (const obj of GameState.objects.values()) GameState.indexObject(obj);
        },

        /* $a -- game_index.js:3958. A new alliance appeared in the world list. */
        [S.ADD_ALLIANCE](team) {
            if (team) GameState.teams.push(team);
        },

        /* Za -- game_index.js:4015. An alliance disbanded. */
        [S.ALLY_REMOVE](sid) {
            GameState.teams = GameState.teams.filter((t) => t && t.sid !== sid);
            GameState.allianceSids.delete(sid);
        },

        /* Ka -- game_index.js:3964. Someone asked to join ours. Recorded, not
         * answered: accepting on the player's behalf is not 2yz's call. */
        [S.ALLY_REQUEST](sid, name) {
            Events.emit('allianceRequest', { sid, name });
        },

        /* Tl -- game_index.js:4798. Flat, stride 3: [sid, name, score]. */
        [S.LEADERBOARD](flat) {
            const out = [];
            if (Array.isArray(flat)) {
                for (let i = 0; i + 3 <= flat.length; i += 3) {
                    out.push({ sid: flat[i], name: flat[i + 1], score: flat[i + 2] });
                }
            }
            GameState.leaderboard = out;
        },

        /* Ul -- game_index.js:5616. Seconds until the server restarts. Worth
         * knowing: there is no point investing resources into a map that is
         * about to be recycled. */
        [S.SERVER_SHUTDOWN](seconds) {
            GameState.serverShutdownIn = seconds >= 0 ? seconds : null;
        },

        /* dl -- game_index.js:4457. (sid, text). */
        [S.CHAT_MESSAGE](sid, text) {
            Events.emit('chatMessage', { sid, text });
        },

        /* Wl -- game_index.js:5439. (dir, sid). A structure was struck. This is
         * a direct signal that something took a hit, which is stronger than
         * inferring it from a swing that may have missed. */
        [S.WIGGLE_OBJECT](dir, sid) {
            const obj = GameState.objects.get(sid);
            if (obj) {
                obj.lastHitTick = GameState.tick;
                Events.emit('objectHit', obj, dir);
            }
        },

        /* zt -- the socket is going away. */
        [S.DISCONNECT](reason) {
            Events.emit('disconnect', reason);
            GameState.reset();
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
            if (key === 'kills' && value > GameState.resources.kills) {
                GameState.killsThisLife += value - GameState.resources.kills;
                Events.emit('kill', value);
            }
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

        /* Un -- game_index.js:4734. (points, ageTier). Both are needed: the
         * upgrade index space is only valid for the tier it was offered for. */
        [S.UPDATE_UPGRADES](points, ageTier) {
            GameState.upgradePoints = points;
            if (ageTier != null) GameState.upgradeAge = ageTier;
        },

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
            case C.SPAWN:
                /* Keep the exact payload so respawn can replay it. */
                GameState.lastSpawn = args[0];
                GameState.killsThisLife = 0;
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
