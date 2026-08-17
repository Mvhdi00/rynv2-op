/* ===========================================================================
 * 2yz / Net
 * ---------------------------------------------------------------------------
 * Round-trip time and outbound packet accounting. Both are inputs the modules
 * need and neither belongs to any one of them: Preplace times its release
 * against RTT, and PacketScheduler budgets against the send rate.
 *
 * The game pings every 2500ms (game_index.js:5610-5614, C2S "0" -> S2C "0"),
 * so 2yz reads the RTT off that exchange instead of adding traffic of its own.
 * =========================================================================== */

const Net = (function () {
    let pingSentAt = 0;
    let ping = 0;
    const pingSamples = new U.Ring(8);

    /* Sliding one-second window of outbound frames. */
    let windowStart = 0;
    let windowCount = 0;

    return {
        install() {
            Transport.on('outbound', function (name) {
                if (name === Defs.C2S.PING) pingSentAt = Date.now();
            });
            Transport.on('inbound', function (name) {
                if (name !== Defs.S2C.PING_RESULT || !pingSentAt) return;
                const rtt = Date.now() - pingSentAt;
                pingSentAt = 0;
                pingSamples.push(rtt);
                let sum = 0;
                for (let i = 0; i < pingSamples.size; i++) sum += pingSamples.at(i);
                ping = sum / pingSamples.size;
            });
        },

        pingMs() { return ping; },

        /* Lowest RTT seen recently. Preplace releases against this rather than
         * the mean, because releasing early is recoverable and releasing late
         * is not. */
        minPingMs() {
            if (!pingSamples.size) return ping;
            let min = Infinity;
            for (let i = 0; i < pingSamples.size; i++) min = Math.min(min, pingSamples.at(i));
            return min;
        },

        countFrame() {
            const now = Date.now();
            if (now - windowStart >= 1000) {
                windowStart = now;
                windowCount = 0;
            }
            windowCount++;
        },

        framesThisSecond() {
            if (Date.now() - windowStart >= 1000) return 0;
            return windowCount;
        },

        /* Frames still available in the current second under the configured cap. */
        budgetRemaining() {
            return Math.max(0, Config.get('network.packetsPerSecond') - this.framesThisSecond());
        }
    };
})();
