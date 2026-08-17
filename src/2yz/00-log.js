/* ===========================================================================
 * 2yz / Log
 * ---------------------------------------------------------------------------
 * Errors inside a per-tick loop are easy to lose: the same one fires sixty
 * times a second and either floods the console or gets swallowed by a bare
 * catch. This collapses repeats and keeps the last of each so the debug panel
 * can show what actually went wrong.
 * =========================================================================== */

const Log = (function () {
    const seen = new Map();

    return {
        error(scope, err) {
            const key = scope + ':' + (err && err.message ? err.message : String(err));
            const entry = seen.get(key);
            if (entry) {
                entry.count++;
                entry.last = Date.now();
                return;
            }
            seen.set(key, { scope, err, count: 1, first: Date.now(), last: Date.now() });
            console.warn('[2yz] ' + scope + ':', err);
        },

        info(scope, message) {
            console.log('[2yz] ' + scope + ': ' + message);
        },

        entries() {
            return Array.from(seen.values()).sort((a, b) => b.last - a.last);
        }
    };
})();
