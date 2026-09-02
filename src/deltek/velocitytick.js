                    // ==================== VELOCITY TICK ====================
                    //
                    // RYN's version, whole, in deltek's own terms. The combo is
                    // two server ticks, not two setTimeouts:
                    //
                    //   ARM   turret gear on, walk at them. The turret shot goes
                    //         out this tick and the walk closes the gap while it
                    //         travels.
                    //   FIRE  next tick, bull on and swing the polearm while the
                    //         knockback still has them moving.
                    //
                    // deltek's old toptop() fired both halves off setTimeout(93)
                    // and setTimeout(210) — wall clock, so it drifts against the
                    // server tick and against ping. Ticks are what the server
                    // counts, so ticks are what this counts.
                    //
                    // The trap branch is deliberately not here.

                    // Soldier eats the damage the combo is for; hat 22 eats the
                    // knockback the whole window depends on. Either one makes the
                    // shot worthless, so neither is worth spending it on.
                    function velocityValidHat(skinIndex) {
                        return skinIndex !== null && skinIndex !== undefined &&
                            skinIndex !== 6 && skinIndex !== 22;
                    }

                    // 220-245 is not a range check. It is where the turret's
                    // knockback leaves them once the shot lands, which is why the
                    // window has a floor as well as a ceiling: nearer and the
                    // polearm already reaches without the combo, further and the
                    // knockback cannot bring them into it.
                    const VELOCITY_MIN_KB = 220;
                    const VELOCITY_MAX_KB = 245;

                    if (window.vars.velocityTick && myPlayer && myPlayer.alive) {
                        // ── FIRE ────────────────────────────────────────────
                        // Armed last tick, so the turret has gone out and the
                        // walk has had a tick to close the gap. Aim at where they
                        // are now, not where they were when we armed.
                        if (velocityTarget !== null) {
                            const fireAngle = Math.atan2(
                                velocityTarget.y2 - myPlayer.y2,
                                velocityTarget.x2 - myPlayer.x2
                            );

                            hat(7, 0);
                            keyCodeWeapon = myPlayer.weapons[0];
                            selectWeapon(keyCodeWeapon);
                            // One swing, the way place() swings: start and stop in
                            // the same call, with the angle on the packet. The old
                            // version latched deltek's autoaim on and left it on,
                            // which took the player's aim away for good.
                            sendAtck(1, fireAngle);
                            sendAtck(0, fireAngle);
                            // Only steer if the player is not steering themselves.
                            if (predictMoveAngle === null) {
                                predictMoveAngle = fireAngle;
                                shouldntPathfind = true;
                            }

                            velocityTarget = null;
                        } else if (nearestEnemy) {
                            // ── ARM ─────────────────────────────────────────
                            // Every gate RYN checks, asked of deltek's own state.
                            const isPolearm = myPlayer.weapons[0] === 5;
                            // Diamond or ruby. Below that the polearm does not hit
                            // hard enough for the combo to be worth the turret.
                            const isDiamond = getPlayerInfo(myPlayer, "primaryVariant") >= 2;
                            const primaryReady = primaryReload[myPlayer.sid] >= 1;
                            const turretReady = turretReload[myPlayer.sid] >= 1;

                            if (isPolearm && isDiamond && primaryReady && turretReady) {
                                // Against where they will be, not where they are:
                                // deltek's xVel/yVel is already next tick's
                                // position (x2 * 2 - lastX), which is the same
                                // extrapolation RYN reads off pos.future.
                                const futureX = nearestEnemy.xVel;
                                const futureY = nearestEnemy.yVel;
                                const dist = UTILS.getDistance(
                                    myPlayer.x2, myPlayer.y2, futureX, futureY
                                );
                                const armAngle = Math.atan2(
                                    futureY - myPlayer.y2, futureX - myPlayer.x2
                                );

                                // Worth spending the turret on: either their melee
                                // comes up within the tick — so the shot lands as
                                // they commit — or they are wearing a hat the
                                // knockback still works on.
                                const enemyWeapon = items.weapons[nearestEnemy.weapons[0]];
                                const enemyReload = primaryReload[nearestEnemy.sid] || 0;
                                const almostReloaded = !!enemyWeapon &&
                                    enemyReload + (game.tickRate / enemyWeapon.speed) >= 1;
                                // RYN reads the enemy's *next* hat here. deltek
                                // keeps no hat prediction, so this is the hat they
                                // are wearing now — the same question, one tick
                                // less notice.
                                const goodHat = velocityValidHat(nearestEnemy.skinIndex);

                                if (dist >= VELOCITY_MIN_KB && dist <= VELOCITY_MAX_KB &&
                                    (almostReloaded || goodHat)) {
                                    hat(53, 0);
                                    keyCodeWeapon = myPlayer.weapons[0];
                                    selectWeapon(keyCodeWeapon);
                                    // Walk into them while the shot travels — the
                                    // half deltek's old version left out, and what
                                    // actually closes the window.
                                    //
                                    // But only if the player is not already
                                    // moving. predictMoveAngle is null here when
                                    // no key is held, and writing over it
                                    // regardless is what made the player unable to
                                    // move: it goes straight out as the move
                                    // direction, so the mod was steering every
                                    // tick and the keys did nothing. RYN gates the
                                    // whole module on moveTo !== "disable" for
                                    // exactly this reason; this is deltek's
                                    // version of that gate.
                                    if (predictMoveAngle === null) {
                                        predictMoveAngle = armAngle;
                                        shouldntPathfind = true;
                                    }
                                    velocityTarget = nearestEnemy;
                                }
                            }
                        }
                    } else if (velocityTarget !== null) {
                        // Toggled off, or died, with the combo half-fired. Drop it
                        // rather than leaving a stale target to fire on later.
                        velocityTarget = null;
                    }
