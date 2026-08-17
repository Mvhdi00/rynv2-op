/* ===========================================================================
 * 2yz / Replace
 * ---------------------------------------------------------------------------
 * Source: Luna.
 *
 * A note on where the logic actually came from, because the obvious answer is
 * wrong. Luna's menu carries a toggle labelled "replace" with the id
 * `prePlace2` (Luna_Fixed.user.js:19253). That id appears exactly once in the
 * whole file: in the menu row. Nothing reads it, it has no entry in the
 * defaults block next to `prePlace`, and no code branches on it. It is a dead
 * switch, like the `autsh1` and `triangle2` entries Luna also ships.
 *
 * Luna's real replacement logic is `getPrePlaceObject()` plus the candidate
 * generation around it (Luna_Fixed.user.js, getPrePlaceObject / getPredictObjects).
 * It works like this:
 *
 *   1. find an object that is about to be destroyed -- health at or below the
 *      damage the next swing will do, from either the local player gathering
 *      or the enemy's next hit;
 *   2. sweep the ring with that object removed from the collision set
 *      (`customObjects.splice(indexOf(findObject), 1)`), so the sweep answers
 *      "what fits once it is gone" rather than "what fits now";
 *   3. build the replacement into the gap as it opens.
 *
 * That is a genuinely better idea than anything equivalent in the other three
 * sources, and it is what 2yz implements. NovaStorm inherited the same function
 * verbatim, so the lineage is Luna's either way.
 *
 * What 2yz adds, because Luna does not ask it: whether the replacement is
 * actually an improvement. Luna replaces whatever is breaking with whatever
 * fits. 2yz scores the gap through PlacementEngine like any other placement and
 * declines when the replacement would score below what is being lost -- a
 * spike replaced by a spike that blocks our own swing is a downgrade, and
 * replacing a resource we are farming with a structure is not a replacement at
 * all.
 * =========================================================================== */

const Replace = {
    name: 'Replace',

    /* sid -> {object, breaksAtTick, byWhom} */
    doomed: new Map(),

    install() {
        Events.on('swing', (player, weaponIndex) => this.projectBreak(player, weaponIndex));
        Events.on('objectRemoved', (obj) => this.doomed.delete(obj.sid));
        Events.on('trackerReady', () => this.expire());

        /* WIGGLE_OBJECT says a structure was actually struck, which is stronger
         * evidence than a swing that may have missed. Anything already flagged
         * from a swing is confirmed; anything not flagged and now low enough to
         * die to the next hit from the same direction is flagged here. */
        Events.on('objectHit', (obj, dir) => this.confirmHit(obj, dir));
    },

    confirmHit(obj) {
        if (!Config.get('placement.replace.enabled')) return;
        const existing = this.doomed.get(obj.sid);
        if (existing) {
            /* Seen the swing and now the hit: the break is as certain as it
             * gets, so give it a fresh lease. */
            existing.breaksAtTick = GameState.tick + 1;
            existing.confirmed = true;
            return;
        }
        /* Not predicted from a swing -- someone we cannot see attacking is
         * hitting it. Flag it if one more hit of the same size would finish it. */
        if (!obj.isItem || obj.health === Infinity) return;
        const swinger = Targeting.primary;
        if (!swinger) return;
        const damage = Math.max(
            EntityTracker.structureDamage(swinger, 0),
            swinger.secondaryIndex != null ? EntityTracker.structureDamage(swinger, 1) : 0
        );
        if (damage <= 0 || obj.health > damage) return;
        this.doomed.set(obj.sid, {
            object: obj,
            breaksAtTick: GameState.tick + 1,
            byWhom: swinger.sid,
            confirmed: true
        });
    },

    expire() {
        for (const [sid, entry] of this.doomed) {
            if (GameState.tick > entry.breaksAtTick + Config.get('placement.replace.graceTicks')) {
                this.doomed.delete(sid);
            }
        }
    },

    /* Someone swung. Work out which structure that swing kills. This is Luna's
     * step 1, but driven by the observed swing rather than by polling reload
     * state, so it fires on the tick the damage is actually committed. */
    projectBreak(player, weaponIndex) {
        if (!Config.get('placement.replace.enabled')) return;
        const weapon = Defs.weapons[weaponIndex];
        if (!weapon) return;

        const slot = weapon.type === 0 ? 0 : 1;
        const damage = EntityTracker.structureDamage(player, slot);
        if (damage <= 0) return;

        const reach = weapon.range + player.scale;
        const aim = player.d2;

        for (const obj of GameState.nearObjects) {
            if (!obj.active || !obj.isItem) continue;
            if (obj.health === Infinity) continue;

            const dist = U.getDistance(player.x2, player.y2, obj.x, obj.y);
            if (dist - obj.scale > reach) continue;

            /* The swing has an arc; something behind the swinger is not hit. */
            const toObj = U.getDirection(obj.x, obj.y, player.x2, player.y2);
            if (U.getAngleDist(aim, toObj) > Defs.config.gatherAngle) continue;

            if (obj.health > damage) continue;

            this.doomed.set(obj.sid, {
                object: obj,
                breaksAtTick: GameState.tick + 1,
                byWhom: player.sid
            });
        }
    },

    tick() {
        if (!Config.get('placement.replace.enabled')) return null;
        const me = GameState.self;
        if (!me || !this.doomed.size) return null;

        const target = Targeting.primary;
        const intents = [];
        const maxPerTick = Config.get('placement.replace.maxPerTick');

        for (const entry of this.doomed.values()) {
            if (intents.length >= maxPerTick) break;
            const obj = entry.object;
            if (!obj.active) continue;

            /* Only replace what is worth replacing. A resource node breaking is
             * not a hole in our defence. */
            if (!this.worthReplacing(obj, target)) continue;

            const dist = U.getDistance(me.x2, me.y2, obj.x, obj.y);
            if (dist > Config.get('placement.replace.range')) continue;

            const itemId = this.replacementFor(obj, target);
            if (itemId == null) continue;
            if (GameState.isItemLimit(itemId)) continue;

            /* Luna's step 2: sweep with the doomed object removed, so the gap it
             * is about to leave is treated as free space. */
            const objects = GameState.nearObjects.filter((o) => o !== obj);
            const candidates = PlacementEngine.sweep(itemId, { objects, noCache: true });
            const ranked = PlacementEngine.rank(
                candidates, target,
                itemId === GameState.trapItem ? 'trap' : 'spike'
            );

            /* Only the candidates that actually land in the gap are
             * replacements; anything else is just an ordinary placement and
             * AutoPlace owns it. */
            const inGap = ranked.filter(
                (c) => U.getDistance(c.x, c.y, obj.x, obj.y) < obj.scale + c.scale
            );
            const best = inGap[0];
            if (!best) continue;

            /* 2yz's addition: is this better than what is being lost? */
            const replacedValue = this.valueOf(obj, target);
            if (best.score < replacedValue + Config.get('placement.replace.improvementMargin')) {
                continue;
            }

            intents.push(new ReplaceIntent({
                source: this.name,
                urgency: Config.get('placement.replace.urgency'),
                confidence: target ? Prediction.confidence(target) : 0.8,
                target,
                candidate: best,
                doomedObject: obj,
                reason: 'replace:' + obj.name + '->' + best.reasons.join(',')
            }));
        }

        return intents.length ? intents : null;
    },

    /* Ours, and load-bearing. Somebody else's spike breaking is their problem. */
    worthReplacing(obj, target) {
        if (!obj.isItem) return false;
        if (obj.ownerSid == null) return false;
        if (obj.ownerSid !== GameState.mySid && !GameState.isAlly(obj.ownerSid)) return false;
        if (!(obj.damage > 0 || obj.trap || obj.blocker)) return false;
        if (!target) return Config.get('placement.replace.replaceOutOfCombat');
        return U.getDistance(obj.x, obj.y, target.x2, target.y2)
            <= Config.get('placement.replace.relevanceRange');
    },

    /* Like for like where possible: a trap holds, a spike hurts, and swapping
     * one for the other changes what the structure was doing. */
    replacementFor(obj) {
        if (obj.trap) return GameState.trapItem != null ? GameState.trapItem : GameState.spikeItem;
        if (obj.damage > 0) return GameState.spikeItem;
        return GameState.wallItem;
    },

    /* What the doomed object was worth, on the same scale PlacementEngine
     * scores candidates on, so the two are comparable. */
    valueOf(obj, target) {
        if (!target) return 0;
        const shadow = new Candidate(obj.itemId, 0, obj.x, obj.y, obj.scale);
        shadow.placeable = true;
        const ranked = PlacementEngine.rank([shadow], target, obj.trap ? 'trap' : 'spike');
        return ranked.length ? ranked[0].score : 0;
    },

    debugState() {
        return {
            doomed: Array.from(this.doomed.values()).map((e) => ({
                sid: e.object.sid,
                name: e.object.name,
                breaksAt: e.breaksAtTick,
                confirmed: !!e.confirmed
            }))
        };
    }
};
