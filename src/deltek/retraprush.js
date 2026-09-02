        // ==================== SIEGE ====================
        //
        // What RYN actually does to a trapped enemy, which is not "place
        // another trap".
        //
        // RYN takes every one of my spikes and traps close enough to the target
        // to be part of a ring around them, sorts them by angle, and measures
        // the gap between each neighbouring pair with the law of cosines. A gap
        // counts as an EXIT when it is wider than the target plus both its
        // neighbours can squeeze through (SiegeAnalysis.isEscapable, :9627).
        // The scorer then pays a bonus to any damage build landing within
        // 0.45 rad of an exit (:10441-10450).
        //
        // That is the whole trick, and it is why they cannot get out: the ring
        // is not "one more trap", it is the gaps being found and filled one by
        // one until there are none left. When there are no exits it does
        // nothing, because there is nothing left to close.
        //
        // Spikes do the sealing, because that is what RYN seals with — its
        // sealExit bonus is on `p.isDamage`, and its trap bonus (`capture`)
        // explicitly does not apply while the target is already trapped.
        //
        // Ported whole: the same gap test, the same 0.45 window, the same
        // "closest to the target wins" ordering that RYN's enclosure term
        // produces.

        // The gaps in my ring around a point, as SiegeAnalysis.isEscapable
        // computes them. Fewer than three buildings is not a ring, so there is
        // nothing to find gaps in yet.
        function siegeExits(cx, cy, selfRadius) {
            const ring = [];
            for (const o of spikes_our.concat(traps_our)) {
                const dx = o.x - cx;
                const dy = o.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Only what is close enough to be part of the wall.
                if (dist > selfRadius + o.scale + 40) continue;
                ring.push({ ang: Math.atan2(dy, dx), dist: dist, escapeScale: o.scale });
            }
            if (ring.length <= 2) return [];

            ring.sort((a, b) => a.ang - b.ang);
            const exits = [];
            for (let i = 0; i < ring.length; i++) {
                const a = ring[i];
                const b = ring[i + 1 < ring.length ? i + 1 : 0];
                let gapAngle = Math.abs(a.ang - b.ang);
                if (gapAngle > Math.PI) gapAngle = 2 * Math.PI - gapAngle;
                // Law of cosines: the straight-line width of the gap between
                // the two buildings, not the angle between them.
                const gapWidth2 = a.dist * a.dist + b.dist * b.dist -
                    2 * a.dist * b.dist * Math.cos(gapAngle);
                const need = selfRadius * 2 + a.escapeScale + b.escapeScale + 10;
                if (gapWidth2 > need * need) {
                    let exitAng = (a.ang + b.ang) / 2;
                    if (Math.abs(a.ang - b.ang) > Math.PI) exitAng += Math.PI;
                    exits.push({ angle: exitAng, width: Math.sqrt(gapWidth2) });
                }
            }
            return exits;
        }

        function siegeTrapped() {
            if (!window.vars.siege) return;
            if (!myPlayer || !myPlayer.alive || !nearestEnemy) return;

            // Held in a trap of mine or an ally's.
            const held = traps_our.find(trap =>
                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
            );
            if (!held) return;

            const id = myPlayer.items[2];
            if (id === null || id === undefined) return;
            if (isItemLimit(id)) return;
            if (window.packets + 5 > 119) return;

            const ex = nearestEnemy.x2;
            const ey = nearestEnemy.y2;
            const exits = siegeExits(ex, ey, nearestEnemy.scale);

            let best = null;
            let bestDist = Infinity;
            for (const cand of getPrePlaceAngles(id, visibleObjects)) {
                if (!cand.placeable) continue;

                // Close enough to be part of the wall rather than scenery. This
                // is RYN's enclosure reach: the target, the build and 60.
                const dist = UTILS.getDistance(cand.x, cand.y, ex, ey);
                if (dist > nearestEnemy.scale + cand.scale + 60) continue;

                if (exits.length) {
                    // There is a way out: only builds that stand in one count.
                    const toCand = Math.atan2(cand.y - ey, cand.x - ex);
                    let seals = false;
                    for (const exit of exits) {
                        let d = Math.abs(toCand - exit.angle);
                        if (d > Math.PI) d = Math.PI * 2 - d;
                        if (d < 0.45) { seals = true; break; }
                    }
                    if (!seals) continue;
                }
                // With no exits left the ring is closed and nothing is placed;
                // the loop below only runs while `exits` is non-empty, or while
                // the ring is too small to have gaps computed at all — which is
                // the case where the wall still has to be built in the first
                // place, and closest-to-them is how it gets built.

                if (dist < bestDist) {
                    bestDist = dist;
                    best = cand;
                }
            }

            // No exits and a real ring already standing: they are sealed in.
            // Nothing to do, and nothing spent saying so.
            if (!best) return;
            if (!exits.length && siegeRingSize(ex, ey, nearestEnemy.scale) > 2) return;

            place(id, best.angle);
            placedAngles.push(best.angle);
        }

        // How many of my buildings already form the ring. Used only to tell
        // "the wall is not built yet" from "the wall is built and has no gaps".
        function siegeRingSize(cx, cy, selfRadius) {
            let n = 0;
            for (const o of spikes_our.concat(traps_our)) {
                const dist = UTILS.getDistance(o.x, o.y, cx, cy);
                if (dist <= selfRadius + o.scale + 40) n++;
            }
            return n;
        }
