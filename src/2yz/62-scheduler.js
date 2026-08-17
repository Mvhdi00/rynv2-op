/* ===========================================================================
 * 2yz / PacketScheduler
 * ---------------------------------------------------------------------------
 * The only writer to the socket. Nothing else in 2yz calls Transport.write, and
 * the game bundle cannot reach the socket at all -- Transport hands its frames
 * here instead (Router.handleOutbound), so a single queue carries both.
 *
 * What it does:
 *
 *   ordering       lane order is fixed: defense hats, then the action, then the
 *                  restore. A build that forgets to reselect the weapon leaves
 *                  the player holding a wall.
 *   dedup          repeated aim/move directions inside a tick collapse to one,
 *                  and the game's own >0.3rad gate is preserved.
 *   budget         a hard cap per second; the arbiter has already reserved
 *                  against it, and anything that arrives late is dropped rather
 *                  than queued into the next second.
 *   cancellation   queued frames carry the intent that produced them, so a
 *                  cancelled sequence takes its unsent frames with it.
 *   validation     the last check happens here, one frame before the write.
 *
 * Frame costs quoted in the intents are the counts emitted below; they are not
 * estimates.
 * =========================================================================== */

const Scheduler = (function () {
    /* Frames to send this tick, in order. */
    let queue = [];
    /* Frames the game bundle produced this tick, held until flush so 2yz can
     * merge them with its own rather than interleaving unpredictably. */
    let passthrough = [];

    let lastAimSent = null;
    let lastMoveSent;
    let heldWeapon = null;
    let lastFlush = { sent: 0, dropped: 0, entries: [] };

    function push(name, args, intent, tag) {
        queue.push({ name, args, intent: intent || null, tag: tag || name });
    }

    /* --- packet builders, one per game action ---------------------------- */

    function emitSelectItem(itemId, intent) {
        push(Defs.C2S.SELECT, [itemId, true], intent, 'select-item');
    }

    function emitSelectWeapon(weaponId, intent) {
        push(Defs.C2S.SELECT, [weaponId, false], intent, 'select-weapon');
    }

    function emitAttack(angle, intent) {
        push(Defs.C2S.ATTACK, [1, angle], intent, 'attack-down');
        push(Defs.C2S.ATTACK, [0, angle], intent, 'attack-up');
    }

    function emitAim(angle, intent) {
        push(Defs.C2S.AIM_DIR, [U.fixTo(angle, 2)], intent, 'aim');
    }

    function emitEquip(id, type, intent) {
        push(Defs.C2S.STORE, [1, id, type], intent, 'equip');
    }

    /* --- intent execution ------------------------------------------------ */

    /* Build one item, then put the weapon back. This is the sequence the game
     * itself performs when a player builds (select, press, release, reselect);
     * skipping the restore is what leaves a client stuck in build mode. */
    function executePlacement(intent) {
        const angle = intent.angle;
        emitAim(angle, intent);
        emitSelectItem(intent.itemId, intent);
        emitAttack(angle, intent);
        if (heldWeapon != null) emitSelectWeapon(heldWeapon, intent);
    }

    function executeAttack(intent) {
        if (intent.hat != null && GameState.skins[intent.hat]) {
            emitEquip(intent.hat, 0, intent);
        }
        emitAim(intent.angle, intent);
        if (intent.weapon != null) {
            emitSelectWeapon(intent.weapon, intent);
            heldWeapon = intent.weapon;
        }
        emitAttack(intent.angle, intent);
    }

    function executeHeal(intent) {
        for (let i = 0; i < intent.count; i++) {
            emitSelectItem(intent.itemId, intent);
            emitAttack(null, intent);
        }
        if (heldWeapon != null) emitSelectWeapon(heldWeapon, intent);
    }

    function executeDefense(intent) {
        if (intent.hat != null) emitEquip(intent.hat, 0, intent);
    }

    function execute(intent) {
        switch (intent.kind) {
            case 'Placement':
            case 'Replace': return executePlacement(intent);
            case 'Attack': return executeAttack(intent);
            case 'Heal': return executeHeal(intent);
            case 'Defense': return executeDefense(intent);
            case 'Hold': return undefined;
            default: return undefined;
        }
    }

    /* --- flush ------------------------------------------------------------ */

    /* Collapse repeats inside one tick. Two aim packets in a tick is one aim
     * packet; two selects of the same weapon is one select. */
    function dedupe(entries) {
        const out = [];
        let lastSelect = null;
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];

            if (e.name === Defs.C2S.AIM_DIR) {
                const angle = e.args[0];
                /* Same gate the game applies (game_index.js:4585): below 0.3rad
                 * of change the server keeps the old facing anyway. */
                if (lastAimSent != null && angle != null
                    && Math.abs(angle - lastAimSent) <= Config.get('network.aimEpsilon')) continue;
                /* Only the last aim of a tick can matter. */
                let laterAim = false;
                for (let j = i + 1; j < entries.length; j++) {
                    if (entries[j].name === Defs.C2S.AIM_DIR) { laterAim = true; break; }
                }
                if (laterAim) continue;
                lastAimSent = angle;
            }

            if (e.name === Defs.C2S.MOVE_DIR) {
                const dir = e.args[0];
                if (lastMoveSent === dir) continue;
                lastMoveSent = dir;
            }

            if (e.tag === 'select-item' || e.tag === 'select-weapon') {
                const key = e.tag + ':' + e.args[0];
                if (lastSelect === key) continue;
                lastSelect = key;
            } else if (e.name === Defs.C2S.ATTACK) {
                /* An attack invalidates the select cache: the next build has to
                 * reselect even if it is the same item. */
                lastSelect = null;
            }

            out.push(e);
        }
        return out;
    }

    function flush() {
        /* Game frames first for anything that is pure state (movement, chat,
         * store, upgrades); 2yz's own actions go after so a build is not
         * interrupted by a movement packet mid-sequence. */
        const entries = dedupe(passthrough.concat(queue));
        queue = [];
        passthrough = [];

        let sent = 0;
        let dropped = 0;
        const log = [];

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];

            /* Last-moment validation. A sequence cancelled while its earlier
             * frames were in this same queue takes the rest with it. */
            if (e.intent) {
                if (e.intent.sequence && e.intent.sequence.dead) {
                    dropped++;
                    log.push({ tag: e.tag, dropped: 'sequence-cancelled' });
                    continue;
                }
                if (e.intent.cancelled) {
                    dropped++;
                    log.push({ tag: e.tag, dropped: 'cancelled' });
                    continue;
                }
            }

            if (Net.budgetRemaining() <= 0) {
                dropped++;
                log.push({ tag: e.tag, dropped: 'budget' });
                continue;
            }

            if (Transport.write(e.name, e.args)) {
                Net.countFrame();
                sent++;
                log.push({ tag: e.tag, name: e.name });
            } else {
                dropped++;
                log.push({ tag: e.tag, dropped: 'socket' });
            }
        }

        lastFlush = { sent, dropped, entries: log };
    }

    return {
        install() {
            Events.on('spawn', function () {
                lastAimSent = null;
                lastMoveSent = undefined;
                heldWeapon = GameState.weapons ? GameState.weapons[0] : null;
            });
        },

        /* Frames the game bundle produced. They are not 2yz's, so they are not
         * arbitrated -- but they still go through one queue, one dedupe and one
         * budget. */
        submitPassthrough(name, args) {
            /* Track what the human has selected so a build can restore it. */
            if (name === Defs.C2S.SELECT && args[1] !== true) heldWeapon = args[0];
            passthrough.push({ name, args, intent: null, tag: 'game:' + name });
        },

        /* Called by the runtime with the arbiter's winners. */
        run(winners) {
            for (let i = 0; i < winners.length; i++) execute(winners[i]);
            flush();
        },

        /* Emitted outside the tick loop, for the delayed release Preplace uses. */
        runDeferred(intent) {
            const bad = intent.validate();
            if (bad) {
                intent.rejectedReason = bad;
                Events.emit('intentDropped', intent, bad);
                return false;
            }
            execute(intent);
            flush();
            return true;
        },

        get heldWeapon() { return heldWeapon; },
        get lastFlush() { return lastFlush; },

        debugState() {
            return {
                sent: lastFlush.sent,
                dropped: lastFlush.dropped,
                budget: Net.budgetRemaining(),
                pps: Net.framesThisSecond(),
                held: heldWeapon
            };
        }
    };
})();
