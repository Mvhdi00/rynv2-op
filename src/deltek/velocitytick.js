                    // ==================== VELOCITY TICK ====================
                    //
                    // RYN's combo, said in deltek's own words.
                    //
                    // RYN never sends the frames itself. VelocityTick sets
                    // ModuleHandler.forceHat / forceWeapon / shouldAttack and
                    // lets ModuleHandler assemble one coherent action for the
                    // tick. deltek has exactly that object and it is called
                    // `insta`, driven by the `instaKill` step queue: one step is
                    // consumed per tick, each step sets the intent, and the hat
                    // stage at the bottom of the tick equips from it —
                    // insta.turret means hat 53, insta.primary means hat 7.
                    //
                    // That last part is why the earlier attempt could not work:
                    // it called hat() up here, and deltek's own hat stage runs
                    // several hundred lines further down and equips from
                    // `insta` regardless, overwriting it every single tick.
                    //
                    // So the whole combo is one assignment. Turret gear and the
                    // shot on the first tick, bull and the polearm on the
                    // second, cleanup on the third:
                    //
                    //   ["turret", "primary", "stop"]
                    //
                    // Movement is not touched at all. RYN walks during the arm
                    // tick, but it can only do that because ModuleHandler owns
                    // moveTo and hands it back; writing over deltek's
                    // predictMoveAngle is what took the player's keys away.
                    //
                    // The trap branch is deliberately not here.

                    if (window.vars.velocityTick && myPlayer && myPlayer.alive &&
                        nearestEnemy && !instaKill.length) {

                        // Every gate RYN checks, asked of deltek's own state.
                        const vtPolearm = myPlayer.weapons[0] === 5;
                        // Diamond or ruby. Below that the polearm does not hit
                        // hard enough to be worth spending a turret on.
                        const vtDiamond = getPlayerInfo(myPlayer, "primaryVariant") >= 2;
                        const vtPrimaryReady = primaryReload[myPlayer.sid] >= 1;
                        const vtTurretReady = turretReload[myPlayer.sid] >= 1;

                        if (vtPolearm && vtDiamond && vtPrimaryReady && vtTurretReady) {
                            // Against where they will be, not where they are:
                            // deltek's xVel/yVel is already next tick's position
                            // (x2 * 2 - lastX), the same extrapolation RYN reads
                            // off pos.future. The old version here measured
                            // x2/y2 and was a tick behind.
                            const vtDist = UTILS.getDistance(
                                myPlayer.x2, myPlayer.y2,
                                nearestEnemy.xVel, nearestEnemy.yVel
                            );

                            // 220-245 is not a range check. It is where the
                            // turret's knockback leaves them once the shot
                            // lands, which is why the window has a floor as well
                            // as a ceiling: nearer and the polearm already
                            // reaches without the combo, further and the
                            // knockback cannot bring them into it.
                            const vtInBand = vtDist >= 220 && vtDist <= 245;

                            // Worth spending the turret on: either their melee
                            // comes up within the tick — so the shot lands as
                            // they commit — or they are wearing a hat the
                            // knockback still works on. Soldier eats the damage
                            // and hat 22 eats the knockback the window depends
                            // on, so neither is worth it on its own.
                            const vtWeapon = items.weapons[nearestEnemy.weapons[0]];
                            const vtReload = primaryReload[nearestEnemy.sid] || 0;
                            const vtSwinging = !!vtWeapon &&
                                vtReload + (game.tickRate / vtWeapon.speed) >= 1;
                            const vtHat = nearestEnemy.skinIndex !== 6 &&
                                nearestEnemy.skinIndex !== 22;

                            if (vtInBand && (vtSwinging || vtHat)) {
                                instaKill = ["turret", "primary", "stop"];
                            }
                        }
                    }
