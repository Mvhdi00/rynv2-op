            /* =================================================================
             * AUTO GRIND  (Ryn Type 2's AutoGrind, ported to Luna)
             *
             * Grinds weapon variants on your own turrets: place them, break
             * them, place them again. The game gives a weapon XP when it lands
             * the killing blow on a structure (a turret is worth 350), and a
             * weapon turns gold at 3000, diamond at 7000 and ruby at 12000.
             *
             * Ryn's module, step for step:
             *   - stops on its own once each weapon reaches its target
             *     ("grind until" gold / diamond / ruby, per slot);
             *   - only while standing still, with no enemy within 400, auto
             *     mills off, and a turret (or teleporter) in the item bar;
             *   - with none of your turrets within 300, places them toward the
             *     mouse: 3 (centre, +-75 deg) in sandbox, 2 (+-40 deg) on a
             *     normal server, where the turret limit is 2;
             *   - otherwise swings at them: the great hammer with the tank
             *     hat to grind the hammer; to grind the primary, the hammer
             *     chips (with tank while the turret is still far above the
             *     primary's damage, without it once it is close) and the
             *     primary lands the kill with tank.
             *
             * One change, which is what kept it from "getting lost": Ryn aims
             * at the centre of the turrets. Turrets placed from one spot have
             * to be at least 72.2 deg apart (73 units out, 86 apart) and a
             * swing only reaches 69.2 deg either side, so with three at
             * -75/0/+75 the centre swing hits only the middle one — and once
             * it breaks, the centre of the two left is still 0 deg, 75 deg
             * from both, so every swing after that hits nothing. Here each
             * swing goes to the angle that reaches the most turrets in range:
             * two at a time, then the last one, then a fresh set.
             * ================================================================= */

            const LUNA_GRIND_TARGETS = { gold: 1, diamond: 2, ruby: 3 };
            const LUNA_GRIND_FALLBACK = 3;
            /* Swing arc used for aiming: the game's 69.2 deg less a margin for
             * the turn the server has not applied yet. */
            const LUNA_GRIND_ARC = config.gatherAngle - 0.09;
            let lunaGrindLastX = null;
            let lunaGrindLastY = null;

            function lunaGrindTarget(slot) {
                const chosen = slot === 1 ? window.vars.autoGrindTargetSecondary : window.vars.autoGrindTargetPrimary;
                const target = LUNA_GRIND_TARGETS[chosen];
                return target === undefined ? LUNA_GRIND_FALLBACK : target;
            }

            function lunaGrindVariant(weaponId) {
                return (myPlayer.weaponVariants && myPlayer.weaponVariants[weaponId]) || 0;
            }

            /* A slot only counts against "done" when it holds something worth
             * grading: the secondary grinds with the great hammer and nothing
             * else, and the stick is the one primary this refuses to swing. */
            function lunaGrindIsDone() {
                const primary = myPlayer.weapons[0];
                const secondary = myPlayer.weapons[1];
                const secondaryDone = secondary !== 10 || lunaGrindVariant(secondary) >= lunaGrindTarget(1);
                const primaryDone = primary === 8 || lunaGrindVariant(primary) >= lunaGrindTarget(0);
                return secondaryDone && primaryDone;
            }

            /* Structure damage per hit, with or without the tank hat. */
            function lunaGrindDamage(weaponId, withTank) {
                const weapon = items.weapons[weaponId];
                if (!weapon) return 0;
                const variant = config.weaponVariants[lunaGrindVariant(weaponId)];
                return weapon.dmg * (weapon.sDmg || 1) * (variant ? variant.val : 1) * (withTank ? 3.3 : 1);
            }

            /* Ryn's getGrindAction: which slot swings, and in which hat
             * (40 = tank, 0 = no hat). `turret` is the one that will die next. */
            function lunaGrindAction(turret) {
                if (!turret) return null;
                const primary = myPlayer.weapons[0];
                const secondary = myPlayer.weapons[1];
                const useTank = isBoughtHat(40, 0);
                let slot = null;
                if (secondary === 10 && lunaGrindVariant(secondary) < lunaGrindTarget(1)) {
                    slot = 1;
                } else if (primary !== 8 && lunaGrindVariant(primary) < lunaGrindTarget(0)) {
                    slot = 0;
                }
                if (slot === null) return null;
                if (slot === 1) return { weapon: 1, hat: useTank ? 40 : 0 };
                const primaryDmg = lunaGrindDamage(primary, useTank);
                if (secondary === 10) {
                    const secondaryDmg = lunaGrindDamage(secondary, useTank);
                    if (turret.health > primaryDmg + secondaryDmg) return { weapon: 1, hat: useTank ? 40 : 0 };
                    if (turret.health > primaryDmg) return { weapon: 1, hat: 0 };
                }
                return { weapon: 0, hat: useTank ? 40 : 0 };
            }

            function lunaGrindHasResources(itemId) {
                if (config.inSandbox) return true;
                const req = items.list[itemId].req || [];
                for (let i = 0; i < req.length; i += 2) {
                    if ((myPlayer[req[i]] || 0) < req[i + 1]) return false;
                }
                return true;
            }

            function lunaGrindAngleDiff(a, b) {
                let d = Math.abs(a - b) % (Math.PI * 2);
                return d > Math.PI ? Math.PI * 2 - d : d;
            }

            /* The aim that reaches the most turrets in range. Candidates are
             * each turret's own angle and the bisector of every pair; ties go
             * to the swing that includes the turret closest to dying. */
            function lunaGrindAim(turrets, range) {
                const angles = turrets.map(t => Math.atan2(t.y - myPlayer.y2, t.x - myPlayer.x2));
                const inRange = turrets.map(t => UTILS.getDistance(t.x, t.y, myPlayer.x2, myPlayer.y2) - t.scale <= range);
                const candidates = angles.slice();
                for (let i = 0; i < angles.length; i++) {
                    for (let j = i + 1; j < angles.length; j++) {
                        if (lunaGrindAngleDiff(angles[i], angles[j]) <= LUNA_GRIND_ARC * 2) {
                            const mid = Math.atan2(Math.sin(angles[i]) + Math.sin(angles[j]), Math.cos(angles[i]) + Math.cos(angles[j]));
                            candidates.push(mid);
                        }
                    }
                }
                let best = null;
                for (const angle of candidates) {
                    const hit = turrets.filter((t, i) => inRange[i] && lunaGrindAngleDiff(angles[i], angle) <= LUNA_GRIND_ARC);
                    if (!hit.length) continue;
                    const weakest = hit.reduce((a, b) => (b.health < a.health ? b : a));
                    if (!best || hit.length > best.hit.length ||
                        (hit.length === best.hit.length && weakest.health < best.weakest.health)) {
                        best = { angle: angle, hit: hit, weakest: weakest };
                    }
                }
                if (best) return best;
                /* Nothing in reach (the player drifted): face the nearest one. */
                let nearest = null, nearestDist = Infinity;
                turrets.forEach((t, i) => {
                    const d = UTILS.getDistance(t.x, t.y, myPlayer.x2, myPlayer.y2);
                    if (d < nearestDist) { nearestDist = d; nearest = i; }
                });
                return { angle: angles[nearest], hit: [], weakest: turrets[nearest] };
            }

            /* Runs once per server tick, before the weapon, hat and direction
             * are sent. Fills grindObjects (placed by the auto placer this
             * tick), or sets gatherGrind / grindAngle / grindHat / predictWeapon. */
            function lunaAutoGrind() {
                const x = myPlayer.x2, y = myPlayer.y2;
                const speed = lunaGrindLastX === null ? 0 : UTILS.getDistance(x, y, lunaGrindLastX, lunaGrindLastY);
                lunaGrindLastX = x;
                lunaGrindLastY = y;

                if (!window.vars.autoGrind) return;
                if (lunaGrindIsDone()) return;
                if (speed > 5) return;
                if (autoMills || autoBreak || antiPush || (autoaim && nearestEnemy)) return;
                const farmItem = myPlayer.items[5];
                if (farmItem !== 17 && farmItem !== 22) return;
                if (nearestEnemy && UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, x, y) <= 400) return;

                const turrets = visibleObjects.filter(o =>
                    (o.id === 17 || o.id === 22) && o.owner && o.owner.sid === myPlayer.sid &&
                    UTILS.getDistance(o.x, o.y, x, y) <= 300);

                if (turrets.length === 0) {
                    if (!lunaGrindHasResources(farmItem) || isItemLimit(farmItem)) return;
                    const aim = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
                    const angles = config.inSandbox && farmItem === 17
                        ? [ aim, aim - UTILS.toRad(75), aim + UTILS.toRad(75) ]
                        : [ aim - UTILS.toRad(40), aim + UTILS.toRad(40) ];
                    for (const angle of angles) {
                        if (canPlace(farmItem, angle)) {
                            grindObjects.push({ id: farmItem, angle: angle, preplace: false });
                        }
                    }
                    return;
                }

                const firstAim = lunaGrindAim(turrets, items.weapons[myPlayer.weapons[1] === 10 ? 10 : myPlayer.weapons[0]].range);
                const action = lunaGrindAction(firstAim.weakest);
                if (!action) return;
                const weaponId = myPlayer.weapons[action.weapon];
                const aim = lunaGrindAim(turrets, items.weapons[weaponId].range);

                gatherGrind = true;
                grindAngle = aim.angle;
                grindHat = action.hat;
                predictWeapon = weaponId;
            }
