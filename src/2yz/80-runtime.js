/* ===========================================================================
 * 2yz / Runtime
 * ---------------------------------------------------------------------------
 * Wiring and the tick loop. The order below is the architecture:
 *
 *   wire        -> world model rebuilt from the frame
 *   track       -> derived state: velocity, reloads, contacts
 *   predict     -> one movement model, scored for confidence
 *   target      -> one target, shared by everything
 *   propose     -> each module offers intents; none of them acts
 *   arbitrate   -> one decision per tick
 *   schedule    -> one writer to the socket
 *
 * The first four are driven by Events ('tick' -> 'trackerReady'), because they
 * must run in that order and nothing downstream is meaningful until they have.
 * The last three run here, once, at the end of the tick.
 * =========================================================================== */

const Runtime = (function () {
    /* Every module that can produce an intent, in no particular order -- the
     * Arbiter ranks them, so this list carries no priority meaning. */
    const producers = [
        AutoPlace,
        Preplace,
        Replace,
        SpikeTick,
        AutoBreak,
        AntiSmartTick,
        SafeSoldier,
        ShameReset,
        AutoHeal,
        Movement,
        AutoGather,
        AutoMills,
        AutoUpgrade,
        AutoBuy,
        AutoRespawn,
        AutoChat
    ];

    function collect() {
        const intents = [];

        /* Combat first only so its sequence state is advanced before the
         * placement modules read CombatEngine.activeSequence. */
        try {
            const attack = CombatEngine.decide();
            if (attack) intents.push(attack);
        } catch (err) {
            Log.error('Combat.decide', err);
        }

        for (let i = 0; i < producers.length; i++) {
            const module = producers[i];
            try {
                const produced = module.tick();
                if (!produced) continue;
                if (Array.isArray(produced)) {
                    for (let j = 0; j < produced.length; j++) intents.push(produced[j]);
                } else {
                    intents.push(produced);
                }
            } catch (err) {
                Log.error(module.name + '.tick', err);
            }
        }
        return intents;
    }

    function onTick() {
        if (!GameState.inGame || !GameState.self) {
            /* Dead or not yet spawned. Only the modules that are meaningful in
             * that state get a turn -- respawn being the whole point of it. */
            let revive = [];
            try {
                const wake = AutoRespawn.tick();
                if (wake) revive = Arbiter.resolve([wake]);
            } catch (err) {
                Log.error('AutoRespawn.tick', err);
            }
            Scheduler.run(revive);
            return;
        }

        const intents = collect();
        let winners = [];
        try {
            winners = Arbiter.resolve(intents);
        } catch (err) {
            Log.error('Arbiter.resolve', err);
        }

        /* A sequence step only advances once its packets are actually queued,
         * so a step dropped for budget is retried rather than skipped. */
        for (let i = 0; i < winners.length; i++) {
            const intent = winners[i];
            if (intent.kind === 'Attack' && intent.sequence) intent.sequence.advance();
        }

        Scheduler.run(winners);
    }

    return {
        start() {
            Config.load();

            /* Transport must be hooked before the game opens its socket, which
             * is why the whole script runs at document-start. */
            Transport.install();
            Net.install();
            Router.install();
            EntityTracker.install();
            Prediction.install();
            Targeting.install();
            CombatEngine.install();
            Scheduler.install();
            Preplace.install();
            Replace.install();
            AutoRespawn.install();
            ShameReset.install();
            AutoChat.install();

            /* The decision pass runs after tracking, prediction and targeting
             * have all had the tick. */
            Events.on('trackerReady', function () {
                try { onTick(); } catch (err) { Log.error('runtime.tick', err); }
            });

            const startUI = function () {
                try {
                    Menu.install();
                    Debug.install();
                    Overlay.install();
                } catch (err) {
                    Log.error('ui', err);
                }
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', startUI);
            } else {
                startUI();
            }

            Log.info('runtime', 'started, ' + Config.keys().length + ' settings');
        }
    };
})();
