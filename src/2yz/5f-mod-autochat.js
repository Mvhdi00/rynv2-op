/* ===========================================================================
 * 2yz / AutoChat
 * ---------------------------------------------------------------------------
 * Kill messages and a rotating idle line.
 *
 * The game truncates chat at 30 characters and rate-limits it with
 * chatCooldown (500ms) and chatCountdown (3000ms), both from the shipped
 * config. 2yz honours the longer of the two rather than picking a delay, so it
 * cannot get itself muted by outrunning the server's own limiter.
 *
 * Every message is a ChatIntent, so it competes for the packet budget like
 * anything else and is dropped rather than queued when the budget is spent.
 * =========================================================================== */

const AutoChat = {
    name: 'AutoChat',

    pending: null,
    lastSentAt: 0,
    rotation: 0,

    install() {
        Events.on('kill', () => {
            if (!Config.get('chat.killChat')) return;
            const lines = this.lines(Config.get('chat.killLines'));
            if (!lines.length) return;
            this.pending = {
                text: lines[GameState.killsThisLife % lines.length],
                reason: 'kill'
            };
        });
        Events.on('death', () => { this.pending = null; });
    },

    lines(raw) {
        return String(raw).split('|').map((s) => s.trim()).filter(Boolean);
    },

    /* The game's own limiter, from config rather than a chosen number. */
    cooldownMs() {
        return Math.max(Defs.config.chatCooldown, Config.get('chat.minGapMs'));
    },

    tick() {
        if (!Config.get('chat.enabled')) return null;
        if (!GameState.inGame) return null;
        if (Date.now() - this.lastSentAt < this.cooldownMs()) return null;

        let message = this.pending;
        this.pending = null;

        if (!message && Config.get('chat.idleChat')) {
            const gap = Config.get('chat.idleGapMs');
            if (Date.now() - this.lastSentAt >= gap) {
                const lines = this.lines(Config.get('chat.idleLines'));
                if (lines.length && !Targeting.primary) {
                    message = { text: lines[this.rotation % lines.length], reason: 'idle' };
                    this.rotation++;
                }
            }
        }

        if (!message) return null;
        this.lastSentAt = Date.now();

        return new ChatIntent({
            source: this.name,
            urgency: Config.get('chat.urgency'),
            confidence: 1,
            text: message.text,
            reason: message.reason
        });
    },

    debugState() {
        return {
            pending: this.pending ? this.pending.text : null,
            sinceLastMs: Date.now() - this.lastSentAt,
            kills: GameState.killsThisLife
        };
    }
};
