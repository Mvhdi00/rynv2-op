        // ==================== RETRAP RUSH ====================
        //
        // The enemy is standing in one of my traps. That is a countdown, not a
        // win: the moment it breaks they walk, and the only thing that keeps
        // them there is a second trap already waiting on the ground they will
        // step onto.
        //
        // deltek does place traps at a held enemy — getPerfectAngles has a
        // "Retrap colliding enemy" branch — but it is one priority among many
        // in the preplacer, and it only fires when the preplacer happens to be
        // running for a suitable object. This is the case where that is not
        // enough: while they are held, every tick that can afford it puts the
        // next trap down, and it does so first.

        function retrapRush() {
            if (!window.vars.retrapRush) return;
            if (!myPlayer || !myPlayer.alive || !nearestEnemy) return;

            // Held in a trap of mine or an ally's — the same test the rest of
            // deltek uses for "enemy is trapped".
            const held = traps_our.find(trap =>
                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
            );
            if (!held) return;

            const id = myPlayer.items[4] || 15;
            if (id === null || id === undefined) return;
            if (isItemLimit(id)) return;
            if (window.packets + 5 > 119) return;

            // The trap they are already in is not competition for the ground —
            // it is about to be gone. Everything else still is.
            const objects = visibleObjects.filter(o => o !== held);

            // Where they will be, not where they are: they are held now, but
            // the placement lands next tick and they leave the moment it
            // breaks. deltek's xVel/yVel is that next-tick position.
            const targetX = nearestEnemy.xVel;
            const targetY = nearestEnemy.yVel;

            // deltek's own angle sweep, scored the way its preplacer scores:
            // the placeable angle that lands closest to the target.
            let best = null;
            let bestDist = Infinity;
            for (const candidate of getPrePlaceAngles(id, objects)) {
                if (!candidate.placeable) continue;

                // It has to actually reach them, or it is just a trap on the
                // floor. Touching counts: a trap catches on contact.
                const dist = UTILS.getDistance(candidate.x, candidate.y, targetX, targetY);
                if (dist > nearestEnemy.scale + candidate.scale) continue;

                // And it must not land on top of the one already holding them,
                // which would spend a trap to hold ground that is already held.
                if (UTILS.getDistance(candidate.x, candidate.y, held.x, held.y) <
                    held.scale + candidate.scale) continue;

                if (dist < bestDist) {
                    bestDist = dist;
                    best = candidate;
                }
            }

            if (!best) return;

            place(id, best.angle);
            placedAngles.push(best.angle);
        }
