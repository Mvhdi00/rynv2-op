        // ==================== REPLACE ====================
        //
        // RYN answers a destroyed structure on the packet that reported it: the
        // ground a wall or trap was standing on is the one piece of ground that
        // just became both free and worth having, and the tick it opens is the
        // only tick you are guaranteed to be the first to it.
        //
        // Deltek cannot copy that shape, because it throws the answer away
        // first. killObject pushes the sid and then disableBySid splices the
        // object straight out of gameObjects, so by the time any tick code
        // runs there is no position, no type and no owner left to act on —
        // removedObjects is a list of numbers. So the record is taken at the
        // kill site, where the object still exists, and spent here.
        //
        // Everything below is deltek's own machinery: getConfig for where a
        // placement lands, canPlace for whether it is legal, place() for the
        // send, and the same packet ceiling the auto placer works under.

        let vacatedObjects = [];

        // Called from killObject, before the object is spliced away. Cheap on
        // purpose: this runs inside a packet handler, so it copies six fields
        // and asks one question, and asks nothing at all while the feature is
        // off.
        function noteVacated(object) {
            if (!window.vars.replace) return;
            if (!object || !myPlayer) return;
            if (!isObjectMine(object)) return;

            // A structure only. Food and the like never occupy ground.
            const item = items.list[object.id];
            if (!item || !item.group || !item.group.place) return;

            vacatedObjects.push({
                sid: object.sid,
                id: object.id,
                x: object.x,
                y: object.y,
                scale: object.scale,
                groupId: item.group.id,
                tick: tick
            });
        }

        // Which item in my hotbar rebuilds this kind of ground. Like for like:
        // a trap that was pinning someone is replaced by a trap, not by
        // whatever happens to be cheapest.
        function itemForGroup(groupId) {
            for (let slot = 0; slot < myPlayer.items.length; slot++) {
                const id = myPlayer.items[slot];
                const item = items.list[id];
                if (item && item.group && item.group.id === groupId) return id;
            }
            return null;
        }

        // deltek places on a fixed ring: getConfig puts the object at
        // 35 + scale + placeOffset from the player, so a freed spot is only
        // reachable if it happens to sit on that ring. This is the same
        // arithmetic, asked backwards.
        function placeRadius(id) {
            const item = items.list[id];
            return 35 + item.scale + (item.placeOffset || 0);
        }

        // The angle that lands a placement of `id` closest to (x, y), and
        // whether it lands close enough to count as the same ground.
        function angleOntoGround(id, x, y) {
            const dx = x - myPlayer.x2;
            const dy = y - myPlayer.y2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;

            const angle = Math.atan2(dy, dx);
            // One scale of slack: the ring will not pass exactly through the
            // freed centre, and a placement that overlaps the old footprint is
            // still holding the same ground.
            const slack = items.list[id].scale + 10;
            return {
                angle: angle,
                onGround: Math.abs(dist - placeRadius(id)) <= slack
            };
        }

        function replaceVacated() {
            if (!window.vars.replace || !vacatedObjects.length) {
                vacatedObjects.length = 0;
                return;
            }
            if (!myPlayer || !myPlayer.alive) {
                vacatedObjects.length = 0;
                return;
            }

            // The dead object can still be sitting in visibleObjects, which is
            // only rebuilt once a tick — so every legality question below is
            // asked with it taken out, the way RYN re-senses without it.
            let objects = null;

            for (const rec of vacatedObjects) {
                if (window.packets + 5 > 119) break;

                // Same 300 the preplacer works to. Ground further out than
                // that is not ground I am fighting over.
                const dx = rec.x - myPlayer.x2;
                const dy = rec.y - myPlayer.y2;
                if (dx * dx + dy * dy > 300 * 300) continue;

                if (objects === null) {
                    objects = visibleObjects.filter(o => o.sid !== rec.sid);
                }

                // ── what to put back ────────────────────────────────────────
                // Priority 1: an enemy standing on the ground the moment it
                // opened is the reason it opened. Deny it with a spike rather
                // than rebuilding what they just broke.
                let id = null;
                if (nearestEnemy &&
                    (nearestEnemy.x2 - rec.x) ** 2 + (nearestEnemy.y2 - rec.y) ** 2 <
                    (nearestEnemy.scale + rec.scale) ** 2) {
                    id = myPlayer.items[2];
                }

                // Priority 2: like for like.
                if (id === null) id = itemForGroup(rec.groupId);

                // Priority 3: nothing of that kind in hand — a spike holds the
                // ground as well as anything.
                if (id === null) id = myPlayer.items[2];
                if (id === null || id === undefined) continue;
                if (isItemLimit(id)) continue;

                // ── where ───────────────────────────────────────────────────
                const aim = angleOntoGround(id, rec.x, rec.y);
                if (!aim) continue;

                let angle = null;

                // Priority 1: the freed ground itself, when the ring reaches it.
                if (aim.onGround && canPlace(id, aim.angle, objects)) {
                    angle = aim.angle;
                } else {
                    // Priority 2: the ring does not pass through it, or
                    // something else already does. Take the placeable angle
                    // nearest the freed ground — still the right direction,
                    // still this tick.
                    let best = Infinity;
                    for (let i = 0; i < 72; i++) {
                        const test = UTILS.toRad(i * (360 / 72));
                        let diff = Math.abs(test - aim.angle);
                        if (diff > Math.PI) diff = Math.PI * 2 - diff;
                        // An angle either side of the freed one is the same
                        // distance from it, and the two differ only in the last
                        // bits after toRad. The epsilon makes that tie fall to
                        // the lower angle every time instead of to whichever
                        // way the rounding went.
                        if (diff >= best - 1e-9) continue;
                        if (!canPlace(id, test, objects)) continue;
                        best = diff;
                        angle = test;
                    }
                    // Past a quarter turn it is not the freed ground any more,
                    // it is just a placement.
                    if (best > Math.PI / 2) angle = null;
                }

                if (angle === null) continue;

                place(id, angle);
                placedAngles.push(angle);
            }

            vacatedObjects.length = 0;
        }
