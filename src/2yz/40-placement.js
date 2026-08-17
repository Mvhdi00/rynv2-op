/* ===========================================================================
 * 2yz / PlacementEngine
 * ---------------------------------------------------------------------------
 * WHERE. Every placement in 2yz -- Auto Place, Preplace, Replace, Spike Tick,
 * Auto Mills -- asks this engine for candidates and gets back a ranked list
 * with a reason attached to each. The modules decide WHETHER and WHEN; none of
 * them computes a position.
 *
 * Candidate generation follows the ring-sweep the reference clients use: the
 * item can only ever be built at playerScale + item.scale + placeOffset from
 * the player (game_index.js:2458), so the whole search space is one angle.
 *
 * Two things are kept from NovaStorm's sweep because they are genuinely better
 * than a naive scan:
 *
 *   - boundary angles. An angle that is placeable while its neighbour is not
 *     sits flush against an existing structure. Those are the angles that seal
 *     gaps rather than leaving a hole, and they stay usable one tick longer
 *     than open-field angles. NovaStorm calls them "perfect"; 2yz scores them.
 *
 *   - knockback chaining. A spike is worth more when the hit that lands on it
 *     throws the target onto another one. NovaStorm ranks these by the angular
 *     agreement between the push direction and the follow-up spike; 2yz keeps
 *     that measure and folds it into the score.
 *
 * Everything else -- the scoring, the reason codes, the caching, the reuse
 * between modules -- is 2yz's.
 * =========================================================================== */

/* One evaluated ring position. */
class Candidate {
    constructor(itemId, angle, x, y, scale) {
        this.itemId = itemId;
        this.angle = angle;
        this.x = x;
        this.y = y;
        this.scale = scale;
        this.placeable = false;
        this.boundary = false;
        this.score = 0;
        this.reasons = [];
        this.rejected = null;
    }
    add(reason, weight) {
        this.reasons.push(reason);
        this.score += weight;
    }
}

const PlacementEngine = (function () {
    /* Cache of one sweep, keyed by item and by the object set it was computed
     * against. Auto Place, Spike Tick and Replace all want the spike sweep in
     * the same tick; without this it would run three times. */
    let sweepCache = new Map();
    let sweepTick = -1;

    function ensureCache() {
        if (sweepTick !== GameState.tick) {
            sweepCache = new Map();
            sweepTick = GameState.tick;
        }
    }

    /* Ring position for an item at an angle, optionally around a predicted
     * position rather than the current one. */
    function positionFor(itemId, angle, origin) {
        const item = Defs.items[itemId];
        if (!item) return null;
        const d = Defs.placeDistance(itemId);
        return {
            x: origin.x + d * Math.cos(angle),
            y: origin.y + d * Math.sin(angle),
            scale: item.scale
        };
    }

    /* Sweep the ring. `opts.origin` defaults to the local player's current
     * position; `opts.objects` defaults to the live near list. Passing an
     * object list with one entry removed is how Replace asks "what would fit
     * here once that breaks". */
    function sweep(itemId, opts) {
        opts = opts || {};
        const me = GameState.self;
        if (!me || itemId == null || !Defs.items[itemId]) return [];

        const origin = opts.origin || { x: me.x2, y: me.y2 };
        const objects = opts.objects || null;
        const steps = opts.steps || Config.get('placement.angleSteps');

        const key = itemId + ':' + steps + ':'
            + Math.round(origin.x) + ':' + Math.round(origin.y) + ':'
            + (objects ? 'custom' + objects.length : 'live');

        if (!opts.noCache) {
            ensureCache();
            const hit = sweepCache.get(key);
            if (hit) return hit;
        }

        const atLimit = GameState.isItemLimit(itemId);
        const item = Defs.items[itemId];
        const out = new Array(steps);

        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * U.PI2;
            const pos = positionFor(itemId, angle, origin);
            const c = new Candidate(itemId, angle, pos.x, pos.y, pos.scale);
            if (atLimit) {
                c.rejected = 'item-limit';
            } else if (!GameState.checkItemLocation(pos.x, pos.y, pos.scale, 0.6, item.id, false, objects)) {
                c.rejected = 'blocked';
            } else {
                c.placeable = true;
            }
            out[i] = c;
        }

        markBoundaries(out);
        if (!opts.noCache) sweepCache.set(key, out);
        return out;
    }

    /* An angle is a boundary when placeability flips between it and its
     * neighbour. Both sides of the flip are marked, because either can be the
     * one flush against the structure depending on sweep direction. */
    function markBoundaries(list) {
        const n = list.length;
        for (let i = 0; i < n; i++) {
            const prev = list[(i - 1 + n) % n];
            if (list[i].placeable && !prev.placeable) list[i].boundary = true;
            if (prev.placeable && !list[i].placeable) prev.boundary = true;
        }
    }

    /* ------------------------------------------------------------- scoring */

    /* Will a structure at (c.x, c.y) be in contact with the target as the
     * target moves from where it is to where it is predicted to be? This is the
     * swept test the reference clients use, not a point-in-circle at the
     * current position, so it still fires on a target crossing the spot. */
    function interceptsTarget(c, target, pad) {
        const p = Prediction.next(target);
        const reach = pad != null ? pad : target.scale + c.scale;
        return U.lineInRect(
            c.x - reach, c.y - reach, c.x + reach, c.y + reach,
            target.x2, target.y2, p.x, p.y
        );
    }

    /* Spikes we own that a knocked-back target could be thrown onto. */
    function ownSpikes() {
        const out = [];
        for (const obj of GameState.myObjects) if (obj.active && obj.damage > 0) out.push(obj);
        for (const obj of GameState.teamObjects) if (obj.active && obj.damage > 0) out.push(obj);
        return out;
    }

    /* If a hit landed from this candidate, would the push carry the target onto
     * one of our spikes -- and how squarely? Returns null when it would not.
     * Lower `spread` is a straighter line from push direction to follow-up
     * spike, which is what makes the chain actually connect. */
    function knockbackChain(c, target) {
        const kb = Prediction.knockbackTo(target, c.x, c.y);
        const spikes = ownSpikes();
        let best = null;
        for (let i = 0; i < spikes.length; i++) {
            const s = spikes[i];
            const pad = s.scale + target.scale;
            const onPath = U.lineInRect(
                s.x - pad, s.y - pad, s.x + pad, s.y + pad,
                target.x2, target.y2, kb.x, kb.y
            );
            if (!onPath) continue;
            const toSpike = Math.atan2(s.y - target.y2, s.x - target.x2);
            const spread = U.getAngleDist(kb.angle, toSpike);
            if (!best || spread < best.spread) best = { spike: s, spread };
        }
        return best;
    }

    /* Does this candidate wall us off from the target, or from where we are
     * heading? A spike that blocks our own swing is worse than no spike. */
    function blocksOurLine(c, target) {
        const me = GameState.self;
        const pad = c.scale + Config.get('placement.losPadding');
        const blocksToTarget = U.lineInRect(
            c.x - pad, c.y - pad, c.x + pad, c.y + pad,
            me.x2, me.y2, target.x2, target.y2
        );
        const ahead = Prediction.at(me, Config.get('placement.lookaheadTicks'));
        const blocksAhead = U.lineInRect(
            c.x - pad, c.y - pad, c.x + pad, c.y + pad,
            me.x2, me.y2, ahead.x, ahead.y
        );
        return { blocksToTarget, blocksAhead };
    }

    /* Which way could the target still leave? Sampled around the target at the
     * radius it would clear in `escapeTicks`; an angle counts as open when no
     * damaging structure and no candidate sits on it. Fewer open angles means a
     * candidate that closes one is worth more. */
    function escapeAngles(target, extraBlocker) {
        const samples = Config.get('placement.escapeSamples');
        const reach = Math.max(60, target.speed * Config.get('placement.escapeTicks') * 8);
        const blockers = [];
        for (const obj of GameState.nearObjects) {
            if (obj.active && (obj.damage > 0 || obj.trap || obj.blocker)) blockers.push(obj);
        }
        let open = 0;
        for (let i = 0; i < samples; i++) {
            const a = (i / samples) * U.PI2;
            const ex = target.x2 + reach * Math.cos(a);
            const ey = target.y2 + reach * Math.sin(a);
            let blocked = false;
            for (let j = 0; j < blockers.length; j++) {
                const b = blockers[j];
                if (U.pointToSegment(b.x, b.y, target.x2, target.y2, ex, ey) < b.scale + target.scale) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked && extraBlocker) {
                if (U.pointToSegment(extraBlocker.x, extraBlocker.y, target.x2, target.y2, ex, ey)
                    < extraBlocker.scale + target.scale) blocked = true;
            }
            if (!blocked) open++;
        }
        return open;
    }

    /* Score a sweep against a target and return it ranked. `intent` shapes the
     * weights: 'trap' wants containment, 'spike' wants damage and chaining,
     * 'utility' wants to stay out of the way. */
    function rank(candidates, target, intent) {
        const me = GameState.self;
        if (!me) return [];

        const w = Config.section('placement.weights');
        const scored = [];
        const baselineEscape = target ? escapeAngles(target, null) : 0;

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            if (!c.placeable) continue;
            c.score = 0;
            c.reasons.length = 0;

            if (c.boundary) c.add('boundary', w.boundary);

            if (target) {
                const dist = U.getDistance(c.x, c.y, target.x2, target.y2);
                const contact = c.scale + target.scale;

                if (interceptsTarget(c, target)) c.add('intercepts', w.intercept);

                /* Proximity, normalised so that "touching" is 1 and anything
                 * beyond twice contact range contributes nothing. */
                const closeness = U.clamp(1 - (dist - contact) / contact, 0, 1);
                if (closeness > 0) c.add('close', closeness * w.proximity);

                if (intent === 'spike') {
                    const chain = knockbackChain(c, target);
                    if (chain) {
                        /* A straighter chain scores higher: spread 0 is dead-on. */
                        const quality = U.clamp(1 - chain.spread / (Math.PI / 2), 0, 1);
                        c.add('chain', w.knockbackChain * quality);
                        c.chain = chain;
                    }

                    /* Pushing the target back into us is the wrong direction --
                     * that is a free hit for them. NovaStorm gates this at
                     * PI/5 between push direction and target->player; 2yz keeps
                     * the gate and makes it a config value. */
                    const push = U.getDirection(target.x2, target.y2, c.x, c.y);
                    const towardMe = U.getDirection(me.x2, me.y2, target.x2, target.y2);
                    if (U.getAngleDist(push, towardMe) < Config.get('placement.pushbackGuard')) {
                        c.add('pushes-toward-us', -w.pushbackPenalty);
                    }
                }

                if (intent === 'trap' || intent === 'spike') {
                    const after = escapeAngles(target, c);
                    if (after < baselineEscape) {
                        const closed = (baselineEscape - after) / Math.max(1, baselineEscape);
                        c.add('closes-escape', closed * w.escapeClosure);
                    }
                    if (after === 0) c.add('encloses', w.enclosure);
                }

                const los = blocksOurLine(c, target);
                if (los.blocksToTarget) c.add('blocks-our-line', -w.losPenalty);
                if (los.blocksAhead) c.add('blocks-our-path', -w.pathPenalty);
            }

            if (intent === 'utility') {
                /* Mills and other utility structures should sit behind us and
                 * never across the line we are about to walk. */
                const los = target ? blocksOurLine(c, target) : { blocksAhead: false, blocksToTarget: false };
                if (los.blocksAhead) c.add('blocks-our-path', -w.pathPenalty);
                const behind = U.getAngleDist(
                    c.angle,
                    (GameState.input.moveDir != null ? GameState.input.moveDir : me.d2) + Math.PI
                );
                c.add('behind', U.clamp(1 - behind / Math.PI, 0, 1) * w.utilityBehind);
            }

            scored.push(c);
        }

        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    return {
        sweep,
        rank,
        positionFor,
        interceptsTarget,
        knockbackChain,
        escapeAngles,
        ownSpikes,

        /* Convenience: sweep + rank in one call, the shape most modules want. */
        best(itemId, target, intent, opts) {
            const list = sweep(itemId, opts);
            const ranked = rank(list, target, intent);
            return ranked.length ? ranked[0] : null;
        },

        bestN(itemId, target, intent, n, opts) {
            const list = sweep(itemId, opts);
            return rank(list, target, intent).slice(0, n);
        },

        /* Re-check a candidate immediately before it is sent. Positions move,
         * objects appear, and a candidate computed two ticks ago may now be
         * inside something. Every placement intent runs through this. */
        stillValid(candidate, origin) {
            if (!candidate) return false;
            if (GameState.isItemLimit(candidate.itemId)) return false;
            const me = GameState.self;
            if (!me) return false;
            const base = origin || { x: me.x2, y: me.y2 };
            const pos = positionFor(candidate.itemId, candidate.angle, base);
            if (!pos) return false;
            const item = Defs.items[candidate.itemId];
            if (!GameState.checkItemLocation(pos.x, pos.y, pos.scale, 0.6, item.id, false, null)) return false;
            candidate.x = pos.x;
            candidate.y = pos.y;
            return true;
        }
    };
})();
