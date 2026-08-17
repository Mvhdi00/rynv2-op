/* ===========================================================================
 * 2yz / Debug
 * ---------------------------------------------------------------------------
 * Optional, off by default, and every section behind its own switch so the
 * panel can be narrowed to the thing being investigated.
 *
 * The panel reads each subsystem's own debugState(). Nothing computes a figure
 * specially for display, so what is shown is the state the client actually
 * decided on, not a re-derivation of it.
 * =========================================================================== */

const Debug = (function () {
    let panel = null;
    let lastRender = 0;

    /* Recent decisions that are invisible in a per-tick snapshot because they
     * happen between ticks or resolve immediately: a preplace arming and then
     * being thrown away, an intent dropped at the last check, a burst cancelled
     * mid-sequence. Without this the panel can only ever show the outcome, not
     * the reason. */
    const journal = new U.Ring(24);

    function record(kind, detail) {
        journal.push({ tick: GameState.tick, kind, detail });
    }

    function journalEntries() {
        const out = [];
        for (let i = 0; i < journal.size; i++) {
            const e = journal.at(i);
            if (e) out.push('t' + e.tick + ' ' + e.kind + ' ' + e.detail);
        }
        return out;
    }

    function section(title, value) {
        if (value == null) return '';
        return '<h5>' + title + '</h5>' + JSON.stringify(value, null, 1) + '\n';
    }

    function render() {
        if (!Config.get('debug.enabled')) {
            if (panel) panel.classList.remove('tyz-open');
            return;
        }
        if (!panel) return;
        panel.classList.add('tyz-open');

        /* Refresh at a readable rate rather than every tick. */
        const now = Date.now();
        if (now - lastRender < 100) return;
        lastRender = now;

        let out = '';

        out += section('world', {
            inGame: GameState.inGame,
            tick: GameState.tick,
            players: GameState.players.size,
            objects: GameState.objects.size,
            near: GameState.nearObjects.length,
            ping: Math.round(Net.pingMs())
        });

        if (Config.get('debug.targeting')) out += section('targeting', Targeting.debugState());

        if (Config.get('debug.prediction')) {
            const t = Targeting.primary;
            out += section('prediction', t ? Prediction.debugState(t) : { target: null });
        }

        if (Config.get('debug.combat')) out += section('combat', CombatEngine.debugState());

        if (Config.get('debug.placement')) out += section('placement', AutoPlace.debugState());

        if (Config.get('debug.arbiter')) {
            out += section('arbiter', Arbiter.debugState());
            out += section('journal', journalEntries());
        }

        if (Config.get('debug.packets')) out += section('packets', Scheduler.debugState());

        if (Config.get('debug.modules')) {
            out += section('preplace', Preplace.debugState());
            out += section('replace', Replace.debugState());
            out += section('spikeTick', SpikeTick.debugState());
            out += section('antiSmartTick', AntiSmartTick.debugState());
            out += section('safeSoldier', SafeSoldier.debugState());
            out += section('autoHeal', AutoHeal.debugState());
            out += section('autoMills', AutoMills.debugState());
            out += section('autoBreak', AutoBreak.debugState());
            out += section('movement', Movement.debugState());
            out += section('autoUpgrade', AutoUpgrade.debugState());
            out += section('autoBuy', AutoBuy.debugState());
            out += section('autoRespawn', AutoRespawn.debugState());
            out += section('autoGather', AutoGather.debugState());
            out += section('shameReset', ShameReset.debugState());
            out += section('autoChat', AutoChat.debugState());
            out += section('overlay', Overlay.debugState());
        }

        const errors = Log.entries();
        if (errors.length) {
            out += section('errors', errors.slice(0, 5).map((e) => ({
                scope: e.scope,
                message: e.err && e.err.message ? e.err.message : String(e.err),
                count: e.count
            })));
        }

        panel.innerHTML = out;
    }

    return {
        install() {
            panel = document.createElement('div');
            panel.id = 'tyz-debug';
            document.body.appendChild(panel);

            Events.on('preplaceArmed', (rec) => record('preplace-armed',
                rec.intent.describe() + ' @' + Math.round(U.toDeg(rec.intent.angle)) + 'deg'));
            Events.on('preplaceDisarmed', (rec, why) => record('preplace-disarmed', why));
            Events.on('preplaceReleased', (intent, ok) => record('preplace-released',
                intent.describe() + (ok ? ' sent' : ' refused:' + intent.rejectedReason)));
            Events.on('intentDropped', (intent, why) => record('intent-dropped',
                intent.describe() + ' ' + why));
            Events.on('sequenceCancelled', (seq, why) => record('sequence-cancelled',
                seq.name + ' ' + why));
            Events.on('tick', function () {
                try { render(); } catch (err) { Log.error('debug', err); }
            });
        }
    };
})();
