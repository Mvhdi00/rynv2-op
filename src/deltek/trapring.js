        // ==================== TRAP ESCAPE RING ====================
        //
        // Held in an enemy trap and one hit from being out of it. The moment it
        // breaks, the ground I am standing on is exactly the ground they will
        // try to re-trap — and I am the only one who can reach it right now,
        // because I am the one standing in it.
        //
        // So the ring goes down while the trap is still holding me: right,
        // left, up and down, the four ways in. By the time the trap is gone the
        // ways in are already taken.
        //
        // "About to break" is deltek's own test, not a new one: the trap dies
        // to a single hit (doSmartTickAnti uses the same comparison at :11179
        // and :11215).

        // The trap this ring is being laid for, and the ways in still to take.
        // Kept across ticks so a burst that runs out of packet budget finishes
        // on the next one instead of starting over.
        let escapeRingTrap = null;
        let escapeRingAngles = [];

        function trapEscapeRing() {
            if (!window.vars.trapEscapeRing || !myPlayer || !myPlayer.alive || !imTrapped) {
                escapeRingTrap = null;
                escapeRingAngles.length = 0;
                return;
            }

            const trap = trap_where_im_in;
            if (!trap) {
                escapeRingTrap = null;
                escapeRingAngles.length = 0;
                return;
            }

            // One hit from out. Either weapon may be the one breaking it —
            // Auto Break picks whichever fits — so the ring arms on whichever
            // hits structures hardest.
            const breakDmg = Math.max(
                getPlayerInfo(myPlayer, "primaryStructureDmg") || 0,
                getPlayerInfo(myPlayer, "secondaryStructureDmg") || 0
            );
            if (trap.health > breakDmg) return;

            // A different trap than the one the current ring is for: start over.
            if (escapeRingTrap !== trap.sid) {
                escapeRingTrap = trap.sid;
                // Right, left, up, down.
                escapeRingAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
            }
            if (!escapeRingAngles.length) return;

            const id = myPlayer.items[2];
            if (id === null || id === undefined) return;

            // The trap is about to stop existing, so it must not be the thing
            // that refuses these placements — the same reasoning Replace uses
            // for the object it is answering.
            const objects = visibleObjects.filter(o => o.sid !== trap.sid);

            // Four spikes is twenty packets, so the budget is asked before each
            // one rather than once for the set. Whatever does not fit this tick
            // stays in the list for the next.
            const left = [];
            for (const angle of escapeRingAngles) {
                if (window.packets + 5 > 119 || isItemLimit(id)) {
                    left.push(angle);
                    continue;
                }
                if (!canPlace(id, angle, objects)) {
                    // Something already holds that way in — ours or theirs.
                    // Either way it is not open, so stop asking about it.
                    continue;
                }
                place(id, angle);
                placedAngles.push(angle);
            }
            escapeRingAngles = left;
        }
