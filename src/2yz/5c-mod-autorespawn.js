/* ===========================================================================
 * 2yz / AutoRespawn
 * ---------------------------------------------------------------------------
 * Respawn after death by replaying the exact payload the game itself sent.
 *
 * The spawn packet carries {name, moofoll, skin} (game_index.js:4612). 2yz
 * records that payload when the game sends it (Router.handleOutbound) and plays
 * it back rather than reconstructing one, because a reconstructed payload would
 * mean guessing the player's name and skin choice.
 *
 * The delay exists because respawning on the same frame as the death packet is
 * both suspicious and useless -- the death screen has not finished processing.
 * =========================================================================== */

const AutoRespawn = {
    name: 'AutoRespawn',

    deadSinceTick: -1,
    deadAt: 0,

    install() {
        Events.on('death', () => {
            this.deadSinceTick = GameState.tick;
            this.deadAt = Date.now();
        });
        Events.on('spawn', () => { this.deadSinceTick = -1; });
    },

    tick() {
        if (!Config.get('utility.autoRespawn.enabled')) return null;
        if (GameState.inGame) return null;
        if (this.deadSinceTick < 0) return null;
        if (!GameState.lastSpawn) return null;

        if (Date.now() - this.deadAt < Config.get('utility.autoRespawn.delayMs')) return null;

        return new SpawnIntent({
            source: this.name,
            urgency: Config.get('utility.autoRespawn.urgency'),
            confidence: 1,
            payload: GameState.lastSpawn
        });
    },

    debugState() {
        return {
            dead: !GameState.inGame,
            haveSpawnPayload: !!GameState.lastSpawn,
            waitedMs: this.deadSinceTick < 0 ? 0 : Date.now() - this.deadAt
        };
    }
};
