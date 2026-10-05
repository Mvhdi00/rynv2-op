#!/usr/bin/env node
/*
 * build-luna.js
 *
 * Builds Luna_Client.user.js from Luna Client 1.7 (src/Luna_Client_1.7.js),
 * rebuilding its auto-heal and wiring up the anti toggles its Defense menu
 * shows but never read.
 *
 * Every number here was checked against the other clients in the set (ai slop
 * skidd, Misery V3, novastorm 1.4, Ryn Type 2). Where an idea comes from one
 * of them it is credited next to the patch that uses it.
 *
 *   node tools/build-luna.js
 *
 * Like build-reup.js, every edit is anchored to an exact string in the base
 * client, and a missing or ambiguous anchor fails the build instead of
 * producing a half-patched script.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Luna_Client_1.7.js");
const OUT = path.join(ROOT, "Luna_Client.user.js");

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* Replaces everything from `start` up to (not including) `end`. Both must be
 * unique, and `end` must come after `start`. */
function editRange(label, start, end, replace) {
  const a = code.indexOf(start);
  if (a === -1 || code.indexOf(start, a + 1) !== -1) throw new Error(`range start missing/ambiguous: ${label}`);
  const b = code.indexOf(end, a);
  if (b === -1 || code.indexOf(end, b + 1) !== -1) throw new Error(`range end missing/ambiguous: ${label}`);
  code = code.slice(0, a) + replace + code.slice(b);
  applied.push(label);
}

/* ------------------------------------------------------------------ *
 * 1. Header
 *
 * Same @name and @namespace as 1.7, so Tampermonkey installs this as an
 * update of the script the user already has instead of a second copy that
 * would run alongside it and fight it for every packet.
 * ------------------------------------------------------------------ */

edit(
  "header: version + description",
  "// @description     Luna 1.1 fixed by raptor, with Ryn Type 2's Music page and LRC AI\n// @version         1.7\n",
  "// @description     Luna 1.1 fixed by raptor, with Ryn Type 2's Music page and LRC AI. Luna+ survival: ping-aware auto heal, working antis\n// @version         1.8\n"
);

/* ------------------------------------------------------------------ *
 * 2. getPlayerInfo: real projectile damage
 *
 * The ranged branch of "secondaryDmg" was hardcoded, and three of the four
 * numbers were wrong: bow 15 (real 25), crossbow 30 (real 35), repeater 35
 * (real 30). That value feeds the anti-insta follow-up, so a bow or crossbow
 * insta was under-read by 10 and 5 and the heal could stay put for a hit that
 * kills. Read off the projectile table instead, which is what the game uses.
 * ------------------------------------------------------------------ */

edit(
  "getPlayerInfo: ranged secondary damage from the projectile table",
  `                    // Ranged secondary weapons with hardcoded damage
                    if (playerSecondary == BOW)
                        return 15;
                    if (playerSecondary == CROSSBOW)
                        return 30;
                    if (playerSecondary == REPEATER)
                        return 35;
                    if (playerSecondary == MUSKET)
                        return 50;
`,
  `                    // Ranged secondaries: read the projectile table. The hardcoded
                    // 15 / 30 / 35 / 50 had bow, crossbow and repeater wrong.
                    if (rangedSecondaries.includes(playerSecondary)) {
                        const proj = items.projectiles[weapon.projectile];
                        return proj ? proj.dmg : 0;
                    }
`
);

/* ------------------------------------------------------------------ *
 * 3. The survival helpers
 *
 * Luna's heal() replaced and the Luna+ state + helpers added right after it.
 * ------------------------------------------------------------------ */

const helpers = `            // =================================================================
            //  LUNA+ SURVIVAL ENGINE - helpers (tools/build-luna.js)
            // =================================================================
            const lunaPlus = {
                lastDamageAt: 0,        // Date.now() when our health last dropped
                damageSeq: 0,           // bumped on every hit (ms timestamps can tie)
                healTimer: null,        // the scheduled shame-safe heal
                pendingHealSeq: -1,     // damageSeq when the last food batch left
                pendingHealUntil: 0,    // ...and when we stop waiting for it to land
                burstConfirmed: false,  // first half of an insta has already landed
                instaSoldier: false,    // helmet-only survival read this tick
                syncThreat: false,
                trapBreakSoldierTicks: 0,
                antiTickPlayer: null,   // who fired the turret that armed antiTick
                fastHealHeld: false,    // the "faster heal" key
                incoming: [],           // projectiles in the air aimed at us
                tickDamages: [],        // every chunk that hit us since the last tick
            };
            window.addEventListener("blur", function () { lunaPlus.fastHealHeld = false; });

            // Toggles default to on: a key nobody has saved yet reads as enabled.
            function lpVar(id) {
                return !(window.vars && window.vars[id] === false);
            }

            // How long a heal has to wait after a hit so the server sees more than
            // its 120 ms shame window between the two. The server measures from the
            // moment it dealt the damage to the moment it gets the food, which is our
            // wait PLUS a full round trip - so on 80 ms ping ~60 ms of waiting is
            // enough, and from ~140 ms up none at all. Luna used to wait one to two
            // whole server ticks (111-222 ms) regardless of ping.
            // minPingTime (lowest RTT seen this session) is the cautious estimate:
            // any real RTT above it only widens the gap.
            function lunaPlusShameWait() {
                const m = window.vars ? Number(window.vars.healMargin) : NaN;
                const margin = isFinite(m) ? m : 20;
                const rtt = isFinite(minPingTime) ? minPingTime : 0;
                return Math.max(0, 120 + margin - rtt);
            }

            function lunaPlusFoodCost(food) {
                const req = food && food.req;
                if (!req) return 0;
                for (let i = 0; i + 1 < req.length; i += 2) {
                    if (req[i] == "food") return req[i + 1];
                }
                return 0;
            }

            // Food up to full health. Three packets per food plus one weapon restore,
            // sized against the packet budget BEFORE sending (ai slop) so a full
            // budget never leaves us holding food - the server only reloads with a
            // weapon out. Foods we cannot afford are not sent (Ryn Type 2).
            function lunaPlusHeal(reason) {
                if (!myPlayer || !myPlayer.alive) return false;
                const missing = 100 - myPlayer.health;
                if (!(missing > 0)) return false;
                const now = Date.now();
                // A batch is already on its way and nothing has hit us since it left.
                if (reason !== "manualPress" && now < lunaPlus.pendingHealUntil && lunaPlus.pendingHealSeq === lunaPlus.damageSeq) return false;
                const foodId = myPlayer.items[0];
                const food = foodId != null ? items.list[foodId] : null;
                if (!food || !(food.heal > 0)) return false;
                let n = Math.ceil(missing / food.heal);
                const cost = lunaPlusFoodCost(food);
                if (!config.inSandbox && cost > 0 && typeof myPlayer.food === "number") {
                    n = Math.min(n, Math.floor(myPlayer.food / cost));
                }
                while (n > 0 && packets + (3 * n + 1) > 119) n--;
                if (n <= 0) return false;
                const weapon = predictWeapon != null ? predictWeapon : myPlayer.weapons[0];
                for (let i = 0; i < n; i++) {
                    selectToBuild(foodId);
                    sendAtck(1, null);
                    sendAtck(0, null);
                }
                selectWeapon(weapon);
                lunaPlus.pendingHealSeq = lunaPlus.damageSeq;
                lunaPlus.pendingHealUntil = now + (window.pingTime || 100) + 60;
                return true;
            }

            // Luna's old entry point, kept for anything that still calls it.
            function heal(value) {
                if (value > 0) lunaPlusHeal("manualPress");
            }

            // Called from updateHealth the moment our health drops. Schedules the
            // heal for the first shame-safe instant instead of waiting for the next
            // tick to notice, and rearms on every new hit (the server's shame clock
            // runs from the latest one).
            function lunaPlusOnDamage(damage) {
                lunaPlus.lastDamageAt = Date.now();
                lunaPlus.damageSeq++;
                lunaPlus.tickDamages.push(damage);
                if (!lpVar("smartHeal")) return;
                clearTimeout(lunaPlus.healTimer);
                const wait = lunaPlusShameWait();
                lunaPlus.healTimer = setTimeout(function () {
                    lunaPlus.healTimer = null;
                    if (!myPlayer || !myPlayer.alive || myPlayer.health >= 100) return;
                    if (Date.now() - lunaPlus.lastDamageAt < wait) return;
                    if (lunaPlusHeal("free")) io.send("D", getAttackDir());
                }, wait + 1);
            }

            // The per-tick decision, run after the hats are chosen.
            //   emergency: the pot says the next tick kills -> heal now. Respects the
            //              7-shame line, except when the first half of an insta has
            //              already landed (ai slop's foe-burst rule): getting clowned
            //              beats dying.
            //   free:      otherwise heal at the first shame-safe moment.
            function lunaPlusHealTick(healing) {
                if (!myPlayer || !myPlayer.alive || myPlayer.health >= 100) return false;
                if (lunaPlus.fastHealHeld) return lunaPlusHeal("manual");
                if (healing && (myPlayer.shameCount < 7 || (lunaPlus.burstConfirmed && lpVar("healThroughShame")))) {
                    return lunaPlusHeal("emergency");
                }
                if (!lpVar("smartHeal")) {
                    return (tick - damageTick) > 0 ? lunaPlusHeal("legacy") : false;
                }
                if (Date.now() - lunaPlus.lastDamageAt >= lunaPlusShameWait()) return lunaPlusHeal("free");
                return false;
            }

            // First enemy spike (or cactus) whose box the segment crosses, by damage.
            function lpSweepHazard(x1, y1, x2, y2) {
                for (let spike of spikes_enemy) {
                    const r = myPlayer.scale + spike.scale;
                    if (UTILS.lineInRect(spike.x - r, spike.y - r, spike.x + r, spike.y + r, x1, y1, x2, y2)) return spike.dmg || 0;
                }
                for (let cactus of cactuses) {
                    if (UTILS.lineInRect(cactus.x - cactus.scale, cactus.y - cactus.scale, cactus.x + cactus.scale, cactus.y + cactus.scale, x1, y1, x2, y2)) return 35;
                }
                return 0;
            }

            // Forward one-tick read (Ryn Type 2, trimmed to 3 ticks). A diamond or
            // ruby polearm in bull/turret gear whose primary AND turret are ready
            // within the window, walked forward on both velocities: the tick they
            // would be in reach and facing us, or 0.
            function lpOneTickSim(enemy) {
                if (enemy.weapons[0] != 5) return 0;
                if ((enemy.weaponVariants[5] ?? 2) < 2) return 0;
                if (enemy.skinIndex != 7 && enemy.skinIndex != 53) return 0;
                const pR = primaryReload[enemy.sid], tR = turretReload[enemy.sid];
                if (pR == null || tR == null) return 0;
                const pT = pR >= 1 ? 1 : Math.ceil((1 - pR) * items.weapons[5].speed / 111);
                const tT = tR >= 1 ? 1 : Math.ceil((1 - tR) * 2500 / 111);
                if (pT > 3 || tT > 3) return 0;
                const reach = myPlayer.scale * 1.8 + items.weapons[5].range + 25;
                if (UTILS.getDistance(myPlayer.x2, myPlayer.y2, enemy.x2, enemy.y2) > reach + 200) return 0;
                const mdx = myPlayer.xVel - myPlayer.x2, mdy = myPlayer.yVel - myPlayer.y2;
                const edx = enemy.xVel - enemy.x2, edy = enemy.yVel - enemy.y2;
                let mx = myPlayer.x2, my = myPlayer.y2, ex = enemy.x2, ey = enemy.y2;
                for (let t = 1; t <= 3; t++) {
                    mx += mdx; my += mdy; ex += edx; ey += edy;
                    if (t < pT || t < tT) continue;
                    if (UTILS.getDistance(mx, my, ex, ey) > reach) continue;
                    if (UTILS.getAngleDist(enemy.d2, Math.atan2(my - ey, mx - ex)) <= 0.35) return t;
                }
                return 0;
            }
`;

edit(
  "heal(): replaced by the Luna+ helpers",
  `            function heal(value) {
                for (let i = 0; i < value; i += items.list[myPlayer.items[0]].heal) {
                    place(myPlayer.items[0], null);
                }
            }
`,
  helpers
);

/* ------------------------------------------------------------------ *
 * 4. updateHealth: hand our damage to the engine
 * ------------------------------------------------------------------ */

edit(
  "updateHealth: notify Luna+ of our damage",
  `                            damages.push(UTILS.fixTo(damage, 2));
                            deathDamages.push({ damage: UTILS.fixTo(damage, 2), tick: damageTick });
`,
  `                            damages.push(UTILS.fixTo(damage, 2));
                            deathDamages.push({ damage: UTILS.fixTo(damage, 2), tick: damageTick });
                            lunaPlusOnDamage(UTILS.fixTo(damage, 2));
`
);

edit(
  "updateHealth: a heal landed, stop waiting for it",
  `                        if (tmpObj == myPlayer && tmpObj.health == 100) {
                            deathDamages = [];`,
  `                        if (tmpObj == myPlayer && damage < 0) lunaPlus.pendingHealUntil = 0;
                        if (tmpObj == myPlayer && tmpObj.health == 100) {
                            deathDamages = [];`
);

/* ------------------------------------------------------------------ *
 * 5. Anti one-tick: remember who armed it
 *
 * projectileHandle already detected the turret shot from 200-300 out that
 * opens a velocity one-tick and set antiTick for the projectile's flight
 * time - and then nothing ever read antiTick. The survival block reads it
 * now, and needs to know whose swing is coming.
 * ------------------------------------------------------------------ */

edit(
  "projectileHandle: record the antiTick shooter",
  "                        antiOneTick(UTILS.getDistance(myPlayer.x2, myPlayer.y2, projectile.x, projectile.y) / projectile.speed);",
  "                        lunaPlus.antiTickPlayer = player;\n                        antiOneTick(UTILS.getDistance(myPlayer.x2, myPlayer.y2, projectile.x, projectile.y) / projectile.speed);"
);

/* ------------------------------------------------------------------ *
 * 6. Projectiles in the air
 *
 * Luna only ever counted a projectile after it had hit. A musket or crossbow
 * bolt fired at us this tick lands next tick - exactly the reverse-insta
 * opener - so shots whose path reaches us unblocked are tracked until the
 * server removes them, and counted into the pot meanwhile.
 * ------------------------------------------------------------------ */

edit(
  "shoots: track projectiles aimed at us",
  `                        shoots = [];
                    }

                    if (removeShoots.length > 0) {`,
  `                        // Luna+: projectiles still in the air whose path reaches us
                        if (myPlayer && myPlayer.alive) {
                            for (let i in shoots) {
                                const pr = shoots[i].projectile;
                                if (!pr || !pr.player) continue;
                                // remember who actually owns turret gear (see PRE-EMPTIVE INSTA)
                                if (pr.weapon == "turret") pr.player.lpTurret = true;
                                if (pr.player == myPlayer || isAlly(pr.player.sid)) continue;
                                try {
                                    if (canShoot(pr)) {
                                        lunaPlus.incoming.push({ sid: pr.sid, player: pr.player, dmg: pr.dmg || 0, turret: pr.weapon == "turret", until: Date.now() + (pr.range || 0) / (pr.speed || 1) + 150 });
                                    }
                                } catch (e) { }
                            }
                        }

                        shoots = [];
                    }

                    if (removeShoots.length > 0) {`
);

edit(
  "removeShoots: drop landed projectiles",
  `                        removeShoots = [];
                    }

                    // GET SPIKE DAMAGES`,
  `                        for (let i in removeShoots) {
                            const gone = removeShoots[i];
                            lunaPlus.incoming = lunaPlus.incoming.filter(p => p.sid !== gone.sid);
                        }

                        removeShoots = [];
                    }

                    // GET SPIKE DAMAGES`
);

/* ------------------------------------------------------------------ *
 * 7. The survival block
 * ------------------------------------------------------------------ */

edit(
  "antis: per-tick Luna+ reset",
  "                        // ANTIS AND HEAL\n",
  `                        // ANTIS AND HEAL
                        // (Luna+: same five buckets, same order; changes marked inline)
                        lunaPlus.burstConfirmed = false;
                        lunaPlus.instaSoldier = false;
                        lunaPlus.syncThreat = false;
                        {
                            const lpNow = Date.now();
                            lunaPlus.incoming = lunaPlus.incoming.filter(p => p.until > lpNow);
                        }
`
);

/* Poison. `damages` used to be sticky - nothing ever cleared it - so after the
 * first poison chunk this loop stamped damageByPoisonTick with the current
 * tick on every tick for the rest of the session and the prediction never
 * fired again; before any poison it fired a phantom 5 every 9 ticks. And
 * `% 9 == 9` can never be true. `damages` is now cleared every tick (see the
 * end of the tick), so this is the tick the last chunk landed, and the
 * prediction runs for the length of a ruby DoT: five chunks ~9 ticks apart. */
edit(
  "antis: poison prediction",
  `                        if ((tick - damageByPoisonTick) % 9 == 8 || (tick - damageByPoisonTick) % 9 == 9) {
                            poisonDmgPot = 5;
                        }`,
  `                        if (damageByPoisonTick > 0) {
                            const sincePoison = tick - damageByPoisonTick;
                            if (sincePoison > 0 && sincePoison <= 50 && (sincePoison % 9 == 8 || sincePoison % 9 == 0)) {
                                poisonDmgPot = 5;
                            }
                        }`
);

edit(
  "antis: per-tick setup before the enemy loop",
  `                        let predicted = false;

                        for (let enemy of enemiesNear) {
                            let inPrimaryRange = UTILS.getDistance(myPlayer.x2, myPlayer.y2, enemy.x2, enemy.y2) <= myPlayer.scale * 1.8 + getPlayerInfo(enemy, "primaryRange");
`,
  `                        let predicted = false;

                        // Reset once per tick, not once per enemy: a second nearby enemy
                        // used to erase a spike-push found for the first (Misery's fix).
                        canStillGather = false;

                        // A turret chunk landing while we're trapped is the opener of a
                        // trap insta - hammer and katana follow (ai slop's foe-burst rule).
                        if (imTrapped && lunaPlus.tickDamages.some(d => Math.abs(d - 25) < 0.6 || Math.abs(d - 18.75) < 0.6)) {
                            lunaPlus.burstConfirmed = true;
                        }

                        let lpSyncCount = 0, lpSyncPrimary = 0, lpSyncTurret = 0, lpSyncKbX = 0, lpSyncKbY = 0;

                        for (let enemy of enemiesNear) {
                            let inPrimaryRange = UTILS.getDistance(myPlayer.x2, myPlayer.y2, enemy.x2, enemy.y2) <= myPlayer.scale * 1.8 + getPlayerInfo(enemy, "primaryRange");
                            const lpHitBefore = hitDmgPot;
                            const ePrimaryDmg = getPlayerInfo(enemy, "primaryDmg");
                            const ePrimaryReady = primaryReload[enemy.sid] == 1;
                            const eDistNow = UTILS.getDistance(myPlayer.x2, myPlayer.y2, enemy.x2, enemy.y2);
                            // in reach now, or on the next step of either of us
                            const eClose = Math.min(eDistNow, UTILS.getDistance(myPlayer.xVel, myPlayer.yVel, enemy.xVel, enemy.yVel))
                                <= myPlayer.scale * 1.8 + getPlayerInfo(enemy, "primaryRange") + 35;
`
);

edit(
  "antis: velocity tick anti behind 'anti onetick'",
  `                            // VELOCITY TICK ANTI
                            if (UTILS.getDistance(enemy.xVel, enemy.yVel, myPlayer.xVel, myPlayer.yVel) > 150`,
  `                            // VELOCITY TICK ANTI
                            if (lpVar("test4") && UTILS.getDistance(enemy.xVel, enemy.yVel, myPlayer.xVel, myPlayer.yVel) > 150`
);

edit(
  "antis: canStillGather no longer reset per enemy",
  `                            // KNOCKBACK ANTI
                            canStillGather = false;
`,
  `                            // KNOCKBACK ANTI
                            const lpKbBefore = spikeDmgPot;
`
);

const preInsta = `                            // ANTI KB DAGGER (Luna+): daggers reload every tick, so two
                            // swings - twice the push - can land before we stop sliding.
                            if (lpVar("antiSmar36t") && !imTrapped && ePrimaryReady && eClose && enemy.weapons[0] == 7 && spikeDmgPot == lpKbBefore) {
                                const kb = 2 * 111 * (.3 + getPlayerInfo(enemy, "primaryKnockback"));
                                const a = Math.atan2(myPlayer.y2 - enemy.y2, myPlayer.x2 - enemy.x2);
                                const sd = lpSweepHazard(myPlayer.x2, myPlayer.y2, myPlayer.x2 + kb * Math.cos(a), myPlayer.y2 + kb * Math.sin(a));
                                if (sd > 0) {
                                    spikeDmgPot += sd;
                                    hitDmgPot += ePrimaryDmg * 2;
                                    canStillGather = true;
                                }
                            }

                            // ANTI KB HAMMER (Luna+): the knockback sweep above only ever
                            // looked at primaries. A hammer pushes too (the base 0.3).
                            if (lpVar("antiSmar24t") && !imTrapped && getPlayerInfo(enemy, "secondaryWeapon") == "hammer" && secondaryReload[enemy.sid] == 1
                                && eDistNow <= myPlayer.scale * 1.8 + getPlayerInfo(enemy, "secondaryRange") + 35) {
                                const kb = 111 * .3;
                                const a = Math.atan2(myPlayer.y2 - enemy.y2, myPlayer.x2 - enemy.x2);
                                const sd = lpSweepHazard(myPlayer.x2, myPlayer.y2, myPlayer.x2 + kb * Math.cos(a), myPlayer.y2 + kb * Math.sin(a));
                                if (sd > 0) {
                                    spikeDmgPot += sd;
                                    secDmgPot += getPlayerInfo(enemy, "secondaryDmg");
                                }
                            }

                            // ANTI REVERSE INSTA (Luna+): turret / secondary / projectile
                            // first, bull primary second. Luna only ever looked for the
                            // follow-up of a primary opener.
                            if (lpVar("test2") && ePrimaryReady && eClose) {
                                const secLanded = damagesByHits.some(d => d.player == enemy && d.weapon >= 9)
                                    || damagesByShoots.some(d => d.projectile && d.projectile.player == enemy);
                                const inFlight = lunaPlus.incoming.some(p => p.player == enemy && !p.turret);
                                // counted once, even if another read already added this swing
                                if ((secLanded || inFlight) && hitDmgPot == lpHitBefore) hitDmgPot += ePrimaryDmg;
                                if (secLanded) lunaPlus.burstConfirmed = true;
                            }

                            // PRE-EMPTIVE INSTA (Luna+): everything this enemy needs is
                            // loaded and in reach, and the combo kills at our health. The
                            // helmet goes on before the opener instead of after it.
                            // Luna marks every player it has not seen as turret-ready, so
                            // the turret only counts for someone seen wearing or firing it.
                            const eTurretReady = turretReload[enemy.sid] == 1 && (enemy.lpTurret || enemy.skinIndex == 53);
                            if (lpVar("preSoldier") && ePrimaryReady && eClose) {
                                const secName = getPlayerInfo(enemy, "secondaryWeapon");
                                const secDangerous = secName == "hammer" || secName == "musket" || secName == "crossbow" || secName == "repeater crossbow" || secName == "bow";
                                let combo = ePrimaryDmg;
                                let partners = 0;
                                if (secDangerous && secondaryReload[enemy.sid] == 1) {
                                    combo += secName == "hammer" ? getPlayerInfo(enemy, "secondaryDmg") / 1.5 : getPlayerInfo(enemy, "secondaryDmg");
                                    partners++;
                                }
                                if (eTurretReady) {
                                    combo += 25;
                                    partners++;
                                }
                                if (partners > 0 && combo >= myPlayer.health) lunaPlus.instaSoldier = true;
                            }

                            // ANTI SYNC bookkeeping (Luna+): who can swing at us this tick
                            if (ePrimaryReady && eClose) {
                                lpSyncCount++;
                                lpSyncPrimary += ePrimaryDmg;
                                if (eTurretReady && eDistNow <= 350) lpSyncTurret += 25;
                                const kb = 111 * (.3 + getPlayerInfo(enemy, "primaryKnockback"));
                                const a = Math.atan2(myPlayer.y2 - enemy.y2, myPlayer.x2 - enemy.x2);
                                lpSyncKbX += kb * Math.cos(a);
                                lpSyncKbY += kb * Math.sin(a);
                            }

`;

edit(
  "antis: anti normal insta behind 'anti default insta' + new antis before it",
  `                            // ANTI NORMAL INSTAKILL
                            if (getPlayerInfo(enemy, "secondaryWeapon") == "hammer" || getPlayerInfo(enemy, "secondaryWeapon") == "musket" || getPlayerInfo(enemy, "secondaryWeapon") == "crossbow" || getPlayerInfo(enemy, "secondaryWeapon") == "repeater crossbow" || getPlayerInfo(enemy, "secondaryWeapon") == "bow") {
`,
  preInsta + `                            // ANTI NORMAL INSTAKILL
                            if (lpVar("test1") && (getPlayerInfo(enemy, "secondaryWeapon") == "hammer" || getPlayerInfo(enemy, "secondaryWeapon") == "musket" || getPlayerInfo(enemy, "secondaryWeapon") == "crossbow" || getPlayerInfo(enemy, "secondaryWeapon") == "repeater crossbow" || getPlayerInfo(enemy, "secondaryWeapon") == "bow")) {
`
);

edit(
  "antis: normal insta marks a confirmed burst",
  `                                if (damagesByHits.length > 0 && UTILS.getDistance(enemy.x, enemy.y, myPlayer.x2, myPlayer.y2) <= 400) {
`,
  `                                if (damagesByHits.length > 0 && UTILS.getDistance(enemy.x, enemy.y, myPlayer.x2, myPlayer.y2) <= 400) {
                                    if (damagesByHits.some(d => d.player == enemy && d.weapon < 9)) lunaPlus.burstConfirmed = true;
`
);

edit(
  "antis: one-tick reads + spike tick behind 'anti Kb Placement'",
  `                            // ANTI SPIKE TICK
                            if (!collidingspike) {`,
  `                            // ANTI ONETICK (Luna+): antiTick was computed and never read.
                            if (lpVar("test4")) {
                                if (antiTick && lunaPlus.antiTickPlayer == enemy && ePrimaryReady) {
                                    if (hitDmgPot == lpHitBefore) hitDmgPot += ePrimaryDmg;
                                    lunaPlus.instaSoldier = true;
                                }
                                const simT = lpOneTickSim(enemy);
                                if (simT > 0) {
                                    lunaPlus.instaSoldier = true;
                                    if (simT == 1 && hitDmgPot == lpHitBefore) {
                                        hitDmgPot += ePrimaryDmg;
                                        turretDmgPot += 25;
                                    }
                                }
                            }

                            // ANTI SPIKE TICK
                            if (lpVar("antiSmar48t") && !collidingspike) {`
);

edit(
  "antis: sync, projectiles in the air, spike-tick soldier window",
  `                        lastcolliding = collidingspike;
                        iWasTrapped = imTrapped;`,
  `                        // ANTI SYNC (Luna+): two or more enemies who can all swing now.
                        // Luna's per-enemy reads only ever counted one of them.
                        if (lpSyncCount >= 2) {
                            if (lpVar("test3") && lpSyncPrimary + lpSyncTurret >= myPlayer.health) {
                                hitDmgPot = Math.max(hitDmgPot, lpSyncPrimary);
                                turretDmgPot = Math.max(turretDmgPot, lpSyncTurret);
                                lunaPlus.syncThreat = true;
                                lunaPlus.instaSoldier = true;
                            }
                            // ANTI KB SYNC: their pushes add up
                            if (lpVar("antiSmar12t") && !imTrapped) {
                                const sd = lpSweepHazard(myPlayer.x2, myPlayer.y2, myPlayer.x2 + lpSyncKbX, myPlayer.y2 + lpSyncKbY);
                                if (sd > 0) {
                                    spikeDmgPot += sd;
                                    hitDmgPot = Math.max(hitDmgPot, lpSyncPrimary);
                                    canStillGather = true;
                                }
                            }
                        }

                        // PROJECTILES STILL IN THE AIR, aimed at us and unblocked
                        for (let p of lunaPlus.incoming) secDmgPot += p.dmg;

                        // SPIKE TICK WINDOW (ai slop / Misery): right after the trap we
                        // were in breaks, or while a spike is biting, wear the helmet.
                        if (lpVar("antiSmar48t") && nearestEnemy) {
                            const eD = UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2);
                            if (trapBreaked && eD <= 200) lunaPlus.trapBreakSoldierTicks = 4;
                            if (spikeDmgCount > 0 && eD <= 300) lunaPlus.instaSoldier = true;
                        }
                        if (lunaPlus.trapBreakSoldierTicks > 0) {
                            lunaPlus.trapBreakSoldierTicks--;
                            lunaPlus.instaSoldier = true;
                        }

                        lastcolliding = collidingspike;
                        iWasTrapped = imTrapped;`
);

edit(
  "antis: soldier on lethal reads, not only at 100",
  `                        if (totalDmgPot >= 100)
                            soldierAnti = true;
`,
  `                        if (totalDmgPot >= 100)
                            soldierAnti = true;

                        // Misery: a spike combo kills below 100 HP too.
                        if (spikeDmgPot > 0 && (collidingspike || willcollide || hitDmgPot > 0) && totalDmgPot >= myPlayer.health)
                            soldierAnti = true;

                        // Luna+: any lethal read wants the helmet - often it alone turns
                        // the hit survivable and no shame-costing heal is needed. Hat
                        // only: unlike soldierAnti this does not stop our swings.
                        if (totalDmgPot >= myPlayer.health)
                            lunaPlus.instaSoldier = true;
`
);

edit(
  "heal: Luna+ decision",
  `                        // HEAL
                        let damageHealed = false;
                        if (((healing && myPlayer.shameCount < 7) || (tick - damageTick) > 0) && myPlayer.health < 100) {
                            heal(100 - myPlayer.health);
                            damageHealed = true;
                        }
`,
  `                        // HEAL (Luna+): emergency now, otherwise the first shame-safe moment
                        let damageHealed = lunaPlusHealTick(healing);
`
);

/* `damages` is cleared at the end of every tick, after everything that reads
 * it has run. A chunk that arrives after this point (the server does not
 * promise the health frame comes before the player frame) survives into the
 * next tick, which is the only one that could still explain it. */
edit(
  "tick end: clear what this tick consumed",
  `                    for (let player of players) {
                        if (player.spikeDamage <= 0) continue;
                        player.spikeDamage = 0;
                    }
                });

                // PRE PLACER`,
  `                    for (let player of players) {
                        if (player.spikeDamage <= 0) continue;
                        player.spikeDamage = 0;
                    }

                    // Luna+: everything that landed has been read; next tick starts clean.
                    damages.length = 0;
                    lunaPlus.tickDamages.length = 0;
                });

                // PRE PLACER`
);

/* damagesByShoots was never reset, so after the first projectile hit of the
 * session it was permanently non-empty. The reverse-insta read depends on it
 * meaning "this tick", so it is reset with damagesByHits. */
edit(
  "tick start: reset damagesByShoots with damagesByHits",
  `                damagesByHits = [];
                spikeDamages = [];
            }

            let tickInterval;`,
  `                damagesByHits = [];
                damagesByShoots = [];
                spikeDamages = [];
            }

            let tickInterval;`
);

/* ------------------------------------------------------------------ *
 * 8. hatFc: the helmet-only reads
 *
 * Placed right before Luna's own soldierAnti line so soldierAnti still has
 * the last word, and skipped while our own insta is mid-sequence so it cannot
 * swap out the bull or turret that sequence needs.
 * ------------------------------------------------------------------ */

edit(
  "hatFc: Luna+ soldier",
  `                if (isBoughtHat(6, 0)) {
                    if (soldierAnti) {
                        currentHat = 6;
                    }
                }
`,
  `                if (isBoughtHat(6, 0) && lunaPlus.instaSoldier && instaKill.length === 0) {
                    currentHat = 6;
                }

                if (isBoughtHat(6, 0)) {
                    if (soldierAnti) {
                        currentHat = 6;
                    }
                }
`
);

/* ------------------------------------------------------------------ *
 * 9. The "faster heal" key
 *
 * It had a keybind in the menu (default Q) and a qPress flag behind it that
 * was set and never read - and never cleared either. Pressing it now heals
 * immediately; holding it keeps topping up every tick.
 * ------------------------------------------------------------------ */

edit(
  "keyDown: faster heal",
  `                        } else if (keyNum == 81) {
                            qPress = true;
                        } else if (keyStr === window.vars.keyAutoGrind) {`,
  `                        } else if (keyStr === window.vars.test193) {
                            lunaPlus.fastHealHeld = true;
                            if (lunaPlusHeal("manualPress")) io.send("D", getAttackDir());
                        } else if (keyStr === window.vars.keyAutoGrind) {`
);

edit(
  "keyUp: faster heal released",
  `                            } else if (keyNum == 81) {
                                qPress = true;
                            }`,
  `                            } else if (keyStr === window.vars.test193) {
                                lunaPlus.fastHealHeld = false;
                            }`
);

/* ------------------------------------------------------------------ *
 * 10. Settings + menu
 *
 * The anti toggles existed as menu rows with nothing behind them, and with no
 * default either, so they rendered "off" while the protection they named was
 * simply absent. They now have code and default on; a value the user already
 * saved still wins (Object.assign over these defaults).
 * ------------------------------------------------------------------ */

edit(
  "vars: Luna+ defaults",
  `        antiSmart: false,
        antiRetrap: true,
`,
  `        antiSmart: false,
        antiRetrap: true,
        test1: true,            // anti default insta
        test2: true,            // anti reverse insta
        test3: true,            // anti sync
        test4: true,            // anti onetick
        preSoldier: true,       // soldier before an insta opens (costs bull on our swings)
        antiSmar12t: true,      // anti Kb Sync
        antiSmar24t: true,      // anti Kb Hammer
        antiSmar36t: true,      // anti Kb Dagger
        antiSmar48t: true,      // anti Kb Placement (spike tick)
        smartHeal: true,        // ping-aware shame-safe heal timing
        healThroughShame: true, // heal at 7 shame when an insta has already opened
        healMargin: 20,         // ms of safety on top of the 120 ms shame window
`
);

editRange(
  "menu: Defense page",
  "defense: [\n",
  "        placers: [\n",
  `defense: [
            {
                title: "General",
                items: [
                    { type: 'toggle', name: "auto soldier", id: "safeSoldier" },
                    { type: 'toggle', name: "anti default insta", id: "test1" },
                    { type: 'toggle', name: "anti reverse insta", id: "test2" },
                    { type: 'toggle', name: "anti sync", id: "test3" },
                    { type: 'toggle', name: "anti onetick", id: "test4" },
                    { type: 'toggle', name: "pre-emptive soldier", id: "preSoldier" }
                ]
            },
            {
                title: "Auto Heal",
                items: [
                    { type: 'toggle', name: "smart heal (ping aware)", id: "smartHeal" },
                    { type: 'toggle', name: "heal through shame on insta", id: "healThroughShame" },
                    { type: 'slider', name: "shame safety ms", id: "healMargin", min: 0, max: 80 }
                ]
            },
            {
                title: "Knockbacks",
                items: [
                    { type: 'toggle', name: "anti Kb Default", id: "antiSmart" },
                    { type: 'toggle', name: "anti Kb Sync", id: "antiSmar12t" },
                    { type: 'toggle', name: "anti Kb Hammer", id: "antiSmar24t" },
                    { type: 'toggle', name: "anti Kb Dagger", id: "antiSmar36t" },
                    { type: 'toggle', name: "anti Kb Placement", id: "antiSmar48t" },
                    { type: 'toggle', name: "anti re-trap", id: "antiRetrap" },
                ]
            }
        ],
`
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);
console.log(`wrote ${path.relative(ROOT, OUT)} (${code.length} bytes)`);
for (const label of applied) console.log("  - " + label);
