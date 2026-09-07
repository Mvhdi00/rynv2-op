#!/usr/bin/env node
/*
 * build-chicken-ot.js
 *
 * Builds chicken_v4.6.2.user.js from chicken v4.6.2 by ripping out chicken's
 * one tick and dropping the Nova Client (Recode)'s in its place.
 *
 * chicken's one tick is `instaManager`: a FIFO queue drained one step per
 * tick, `startInsta("ot")` for the shot, and `oneTickMovement()` -- a four
 * band controller that walks onto `perfectOTDistance` (225) and fires inside
 * a +/-5 window. That goes.
 *
 * Nova's is a different shape and that is what lands here: `instaC.gotoGoal`,
 * an eight band controller aiming at 238 (or 372 with a ranged secondary)
 * inside a +/-3 window, the four tick `boostTickType` combo that drops a
 * booster/trap mid-shot, and a second, separate auto one tick -- `oneTick(1)`
 * behind a velocity-predicted trigger, which chicken has a menu entry for
 * ("Auto One Tick") and no code behind.
 *
 * Everything else in chicken is left alone, including `startInsta("reverse")`:
 * that one is chicken's auto insta, not its one tick.
 *
 *   node tools/build-chicken-ot.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/chicken_v4.6.2.js");
const OUT = path.join(ROOT, "chicken_v4.6.2.user.js");

let code = fs.readFileSync(BASE, "utf8").replace(/\r\n/g, "\n");
const applied = [];

/* Exact-string edit. A stale or ambiguous anchor fails the build instead of
 * silently producing a half-transplanted script. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* Replace everything from `start` up to (not including) `end`. Both anchors
 * must be unique, `end` must follow `start`, and the span has to come out near
 * the size it was when this was written -- if the base client shifts under us,
 * that trips before anything is cut. */
function cut(label, start, end, replace, expectedLines) {
  const startParts = code.split(start);
  if (startParts.length === 1) throw new Error(`start anchor not found: ${label}`);
  if (startParts.length > 2) throw new Error(`start anchor is ambiguous: ${label}`);
  const endParts = code.split(end);
  if (endParts.length === 1) throw new Error(`end anchor not found: ${label}`);
  if (endParts.length > 2) throw new Error(`end anchor is ambiguous: ${label}`);

  const from = code.indexOf(start);
  const to = code.indexOf(end, from);
  if (to === -1) throw new Error(`end anchor does not follow start anchor: ${label}`);

  const span = code.slice(from, to);
  const lines = span.split("\n").length - 1;
  if (Math.abs(lines - expectedLines) > 4) {
    throw new Error(`span drifted for ${label}: expected ~${expectedLines} lines, found ${lines}`);
  }
  code = code.slice(0, from) + replace + code.slice(to);
  applied.push(`${label} (${lines} lines)`);
}

/* ------------------------------------------------------------------ *
 * 1. Provenance
 *
 * The userscript header is chicken's and stays chicken's -- same @name, same
 * @version. Only a note goes in, under the existing update log.
 * ------------------------------------------------------------------ */

edit(
  "note under the update log",
  `4.6.2: added reload and mills options

*/`,
  `4.6.2: added reload and mills options

*/

/*

one tick: chicken's own (instaManager: perfectOTDistance 225, +/-5 window,
four band approach, three tick combo) is replaced by the Nova Client
(Recode)'s -- instaC.gotoGoal at 238/372 with a +/-3 window and eight bands,
instaC.boostTickType as the shot, and Nova's separate auto one tick behind
the "Auto One Tick" menu entry. See novaOneTick below.

*/`
);

/* ------------------------------------------------------------------ *
 * 2. The distances the controller aims at
 *
 * chicken has one goal; Nova has two -- 238 for a melee secondary and 372
 * when it is a bow, crossbow, repeater or musket -- and a tighter window.
 * ------------------------------------------------------------------ */

edit(
  "game: Nova's one tick goals",
  "            this.perfectOTDistance = 225;",
  `            // Nova: instaC.tickMovement -> gotoGoal(238, 3),
            // instaC.boostTickMovement -> gotoGoal(372, 3)
            this.perfectOTDistance = 238;
            this.boostOTDistance = 372;
            this.otWindow = 3;`
);

/* ------------------------------------------------------------------ *
 * 3. instaManager: the one tick comes out, Nova's goes in
 *
 * `startInsta` keeps its "reverse" body -- that is what `autoHit.autoInsta()`
 * fires, chicken's auto insta rather than its one tick. The "ot" body and
 * `oneTickMovement` are the one tick, and both go.
 *
 * `holdModeOT` stays exactly where it is: keyDown/keyUp set it off
 * `scriptMenu.keyBinds.oneTickKey` and the crosshair in the render path reads
 * it, and none of that needs to know what runs underneath.
 * ------------------------------------------------------------------ */

const startInsta = `        /* chicken's own, now reverse only: autoHit.autoInsta() is the one
         * caller and "reverse" is the only value it returns. The other body
         * was the one tick's shot and is Nova's now -- see novaOneTick. */
        startInsta(e) {
            chicken.autoaim = e;
            hatSystem.storeEquip(53);
            chicken.preferedWeaponIndex = player.weapons[1];
            if (player.weaponIndex != chicken.preferedWeaponIndex) {
                chicken.selectToBuild(chicken.preferedWeaponIndex, true);
            }
            chicken.sendAim(game.enemies.angle);
            chicken.sendAutoGather();
            this.addToQueue(() => {
                hatSystem.storeEquip(7);
                chicken.preferedWeaponIndex = player.weapons[0];
                if (player.weaponIndex != chicken.preferedWeaponIndex) {
                    chicken.selectToBuild(chicken.preferedWeaponIndex, true);
                }
                chicken.sendAim(game.enemies.angle);
            });
            this.addToQueue(() => {
                chicken.sendAutoGather();
                chicken.autoaim = false;
            });
        }
    })();
`;

const novaOneTick = `    /* ================================================================== *
     * ONE TICK -- ported from Nova Client (Recode)
     *
     * Three pieces, all Nova's:
     *
     *   - gotoGoal(goto, OT): an eight band approach controller. Nova reads
     *     the distance to the target against a goal and drops through nested
     *     bands measured in player scales (35px), staging a hat and an
     *     accessory per band so the next tick lands closer to the goal:
     *
     *       |error|   hat                 accessory          net speed
     *       <= 35     tank gear   x0.30   stone cape x1.00   x0.30  crawl
     *       35..70    booster hat x1.16   none       x1.00   x1.16
     *       70..140   (untouched)         none       x1.00
     *       > 140     soldier     x0.94   stone cape x1.00   x0.94  close in
     *       in window emp helmet  x0.70   stone cape x1.00   x0.70  hold + fire
     *
     *     Overshooting the goal runs the same ladder mirrored, with no
     *     accessory inside the first band instead of the cape. In the river
     *     every hat slot becomes the flipper.
     *
     *   - boostTickType(): the shot, four ticks. Biome gear + blood wings,
     *     then turret gear (hitting here with a ranged secondary) plus a
     *     booster/trap dropped at the target, then bull helmet (hitting here
     *     with a melee primary), then release.
     *
     *   - oneTick(): Nova's *other* one tick, the auto one. Great hammer +
     *     turret gear, then polearm + bull helmet + hit, and it fires off a
     *     velocity prediction rather than a distance window: if a tick of
     *     acceleration into the target lands inside 205 while we are still
     *     past 223, take it now.
     *
     * Wired to the menu chicken already ships and never implemented:
     * "One Tick Key" holds the approach, "Auto One Tick" arms oneTick(), and
     * its "Ignore Soldier" child is Nova's configs.safeTick inverted.
     *
     * Three things changed on the way across:
     *
     *   - Nova moves during boostTickType with packet("a", ...). "a" is not a
     *     client opcode (c2s is M D 9 e F z H K L N b P Q c 6 S 0 -- "a" is
     *     server to client), so as shipped that combo never moves; its
     *     sibling combos all use "9". Sent on "9" here. Set
     *     novaOneTick.moveDuringCombo = false for the shipped behaviour.
     *   - oneTick() opens with \`if (traps.in) return;\` and the Traps class
     *     has no \`in\` -- the field is \`inTrap\` -- so Nova's "not while
     *     trapped" guard never fired. Reads player.trapData here.
     *   - Nova's auto trigger is gated on the reload of skinIndex read as an
     *     array (\`near.skinIndex.length\`, \`skinIndex[i]\`) and on
     *     \`loging.success()\`, an object that does not exist in the client.
     *     Neither could do anything but produce NaN or throw, so the trigger
     *     is the part of it that computes: turret ready, primary within a
     *     tick, past 223, predicted inside 205.
     * ================================================================== */
    var novaOneTick = new (class {
        constructor() {
            // See the note above: Nova's combo movement rides a dead opcode.
            this.moveDuringCombo = true;
            // Nova reads configs.slowOT, which is not in its configs object,
            // so the branch never ran. Same default here, one flag away.
            this.slowOT = false;
        }

        /* --- Nova helpers ------------------------------------------- */

        inRiver() {
            return player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2;
        }
        /* Nova: biomeGear() with no arguments -- flipper in the river, else
         * soldier. (Its snow branch resolves to the same 6.) */
        biomeGear() {
            hatSystem.storeEquip(this.inRiver() ? 31 : 6, 0, true);
        }
        /* Nova: bQ() inside gotoGoal. */
        bQ(id, index) {
            if (index == 0 && this.inRiver()) {
                hatSystem.storeEquip(31, 0, true);
            } else if (index) {
                hatSystem.storeEquip(chicken.checkHave(id, true), 1, true);
            } else {
                hatSystem.storeEquip(id, 0, true);
            }
        }
        equipWeapon(index) {
            chicken.preferedWeaponIndex = index;
            if (player.weaponIndex != index || player.buildIndex > -1) {
                chicken.selectToBuild(index, true);
            }
        }
        /* Nova: packet("9", dir, 1). Kept on chicken's movementDirection so
         * its own tickMovement does not fight the combo. */
        moveTo(dir) {
            if (chicken.movementDirection !== dir) {
                chicken.movementDirection = dir;
                io.send("9", dir);
            }
        }
        hit() {
            chicken.sendAutoGather();
        }
        /* Nova: the weapon gotoGoal holds while walking -- the secondary when
         * it is a great hammer or mc grabby, otherwise the primary. */
        walkWeapon() {
            return player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0];
        }
        rangedSecondary() {
            return [9, 12, 13, 15].includes(player.weapons[1]);
        }
        busy() {
            return !!chicken.autoaim;
        }

        /* --- Nova: instaC.gotoGoal(goto, OT) ------------------------- */

        gotoGoal(goto, OT) {
            let target = game.enemies.nearest;
            if (!target) {
                return { dir: undefined, action: 0 };
            }
            let slowDists = (n) => n * config.playerScale;
            let goal = {
                a: goto - OT,
                b: goto + OT,
                c: goto - slowDists(1),
                d: goto + slowDists(1),
                e: goto - slowDists(2),
                f: goto + slowDists(2),
                g: goto - slowDists(4),
                h: goto + slowDists(4)
            };
            let dst = UTILS.getDistance(target, player);
            let walk = this.walkWeapon();
            if (dst >= goal.a && dst <= goal.b) {
                this.bQ(22, 0);
                this.bQ(10, 1);
                this.equipWeapon(walk);
                return { dir: undefined, action: 1 };
            }
            if (dst < goal.a) {
                if (dst >= goal.g) {
                    if (dst >= goal.e) {
                        if (dst >= goal.c) {
                            this.bQ(40, 0);
                            this.bQ(10, 1);
                            if (this.slowOT) {
                                chicken.selectToBuild(player.items[1]);
                            } else {
                                this.equipWeapon(walk);
                            }
                        } else {
                            this.bQ(12, 0);
                            this.bQ(0, 1);
                            this.equipWeapon(walk);
                        }
                    } else {
                        this.bQ(0, 1);
                        this.equipWeapon(walk);
                    }
                } else {
                    this.biomeGear();
                    this.bQ(10, 1);
                    this.equipWeapon(walk);
                }
                return { dir: game.enemies.angle + Math.PI, action: 0 };
            }
            if (dst <= goal.h) {
                if (dst <= goal.f) {
                    if (dst <= goal.d) {
                        this.bQ(40, 0);
                        this.bQ(0, 1);
                        if (this.slowOT) {
                            chicken.selectToBuild(player.items[1]);
                        } else {
                            this.equipWeapon(walk);
                        }
                    } else {
                        this.bQ(12, 0);
                        this.bQ(0, 1);
                        this.equipWeapon(walk);
                    }
                } else {
                    this.bQ(0, 1);
                    this.equipWeapon(walk);
                }
            } else {
                this.biomeGear();
                this.bQ(10, 1);
                this.equipWeapon(walk);
            }
            return { dir: game.enemies.angle, action: 0 };
        }

        /* --- Nova: the macro gates in front of tickMovement ---------- */

        /* macro.t: primary reloaded, musket secondary reloaded too, and
         * polearm out (or katana with a musket). macro[";"]: primary
         * reloaded and the ranged secondary reloaded. */
        canRun() {
            if (!game.enemies.nearest || player.trapData) {
                return false;
            }
            if (healer.reloadPercent(player, player.weapons[0]) < 1) {
                return false;
            }
            if (this.rangedSecondary()) {
                return healer.reloadPercent(player, player.weapons[1]) == 1;
            }
            return player.weapons[0] == 5 || (player.weapons[0] == 4 && player.weapons[1] == 15);
        }

        /* --- Nova: instaC.tickMovement / boostTickMovement ----------- */

        tickMovement() {
            let goal = this.rangedSecondary() ? game.boostOTDistance : game.perfectOTDistance;
            let moveMent = this.gotoGoal(goal, game.otWindow);
            if (moveMent.action && healer.reloadPercent(player, 53) == 1 && !this.busy()) {
                this.boostTickType();
                // chicken's tickMovement walks in on its own while autoaim
                // is set, which is where Nova's dead "a" packets were aimed.
                return undefined;
            }
            return moveMent.dir === undefined ? "stop movement" : moveMent.dir;
        }

        /* --- Nova: instaC.boostTickType ------------------------------ */

        boostTickType() {
            let ranged = this.rangedSecondary();
            // Nova: my.autoAim, plus my.revAim on a musket -- aim behind the
            // target so the shot pushes you in.
            chicken.autoaim = "ot";
            this.biomeGear();
            this.bQ(18, 1);
            if (this.moveDuringCombo) {
                this.moveTo(game.enemies.angle);
            }
            game.tickOut(() => {
                if (player.weapons[1] == 15) {
                    chicken.autoaim = "otrev";
                }
                this.equipWeapon(player.weapons[ranged ? 1 : 0]);
                hatSystem.storeEquip(53, 0);
                this.bQ(18, 1);
                if (ranged) {
                    this.hit();
                }
                if (this.moveDuringCombo) {
                    this.moveTo(game.enemies.angle);
                }
                // Nova: place(4, near.aim2) -- whatever is in the fifth slot,
                // a booster on a boost tick setup and a trap otherwise.
                placer.place(player.items[4], game.enemies.angle);
                game.tickOut(() => {
                    chicken.autoaim = "ot";
                    this.equipWeapon(player.weapons[0]);
                    hatSystem.storeEquip(7, 0);
                    this.bQ(18, 1);
                    if (!ranged) {
                        this.hit();
                    }
                    if (this.moveDuringCombo) {
                        this.moveTo(game.enemies.angle);
                    }
                    game.tickOut(() => {
                        this.hit();
                        chicken.autoaim = false;
                        if (this.moveDuringCombo) {
                            this.moveTo(undefined);
                        }
                    }, 1);
                }, 1);
            }, 1);
        }

        /* --- Nova: calcOTVel ----------------------------------------- */

        /* Where a tick of acceleration into the target puts us, plus the
         * tick of drift after it. Nova declares player.xVel and never
         * assigns it past spawn, so the velocity term is always zero there;
         * kept at zero here so the trigger fires on the same distances it
         * was tuned on. chicken's player.vel is the moving-start version if
         * anyone wants it. */
        calcOTVel() {
            let target = game.enemies.nearest;
            let time = config.serverUpdateSpeed;
            let ang = UTILS.getDirection(target.vel, player.vel);
            let cosX = Math.cos(ang);
            let sinY = Math.sin(ang);
            let sqrtDis = Math.sqrt(cosX * cosX + sinY * sinY);
            if (sqrtDis != 0) {
                cosX /= sqrtDis;
                sinY /= sqrtDis;
            }
            let decel = Math.pow(0.993, time);
            let move = 0.77 * 0.0016 * time * time;
            let xVel = cosX * move;
            let yVel = sinY * move;
            let x2 = player.x2 + xVel;
            let y2 = player.y2 + yVel;
            let mult = 1.056;
            let predX = cosX * 0.0016 * mult * time * time;
            let predY = sinY * 0.0016 * mult * time * time;
            return {
                x: x2 + xVel * decel + predX,
                y: y2 + yVel * decel + predY
            };
        }

        /* --- Nova: the AVOT trigger in front of oneTick(1) ------------ */

        autoOneTick() {
            if (!scriptMenu.toggles.autoOneTick || this.busy()) {
                return false;
            }
            let target = game.enemies.nearest;
            if (!target || player.trapData) {
                return false;
            }
            if (player.weapons[0] != 5) {
                return false;
            }
            if (!scriptMenu.toggles.oneTickIgnoreSoldier && (target.skinIndex == 6 || target.skinIndex == 22)) {
                return false;
            }
            if (healer.reloadPercent(player, 53) < 1) {
                return false;
            }
            if (player.reloads[player.weapons[0]] > config.serverUpdateSpeed) {
                return false;
            }
            if (UTILS.getDistance(target, player) < 223) {
                return false;
            }
            if (UTILS.getDistance(this.calcOTVel(), target.vel) > 205) {
                return false;
            }
            return this.oneTick();
        }

        /* --- Nova: oneTick(1) ---------------------------------------- */

        oneTick() {
            let target = game.enemies.nearest;
            if (!target || player.trapData) {
                return false;
            }
            // Nova aims the move at where the target will be, not where it is.
            let moveAim = UTILS.getDirection(target.vel, player);
            sendChat("");
            chicken.autoaim = "ot";
            if (healer.reloadPercent(player, player.weapons[0]) == 1) {
                this.equipWeapon(10);
            }
            this.moveTo(moveAim);
            hatSystem.storeEquip(53, 0);
            game.tickOut(() => {
                this.equipWeapon(5);
                hatSystem.storeEquip(7, 0);
                this.hit();
                this.moveTo(moveAim);
                game.tickOut(() => {
                    this.hit();
                    chicken.autoaim = false;
                }, 1);
                game.tickOut(() => {
                    this.moveTo(undefined);
                }, 2);
            }, 1);
            return true;
        }
    })();
`;

cut(
  "instaManager: startInsta('ot') and oneTickMovement out, novaOneTick in",
  "        startInsta(e) {",
  "    var chicken = new (class {",
  startInsta + novaOneTick,
  84
);

/* ------------------------------------------------------------------ *
 * 4. The action chain
 *
 * Same slot chicken ran its own one tick from. The hold branch now also
 * carries Nova's macro gates: when they fail, chicken falls through to its
 * normal branches instead of standing there doing nothing.
 * ------------------------------------------------------------------ */

edit(
  "manageTickBase: hold mode and the auto one tick",
  `                    } else if (instaManager.holdModeOT && typeof e != "number") {
                        e = instaManager.oneTickMovement();`,
  `                    } else if (novaOneTick.autoOneTick()) {
                        // Nova's auto one tick took the tick
                    } else if (instaManager.holdModeOT && novaOneTick.canRun() && typeof e != "number") {
                        e = novaOneTick.tickMovement();`
);

/* ------------------------------------------------------------------ *
 * 5. Reverse aim
 *
 * Nova flips the aim behind the target for the musket tick (my.revAim), so
 * the shot's knockback carries you in. chicken aims off one flag, so it needs
 * to know the value.
 * ------------------------------------------------------------------ */

edit(
  "getAttackDir: honour Nova's reverse aim",
  `            if ((this.autoaim || autoHit.reverseSpiketick) && game.enemies.nearest) {
                return game.enemies.angle;
            }`,
  `            if ((this.autoaim || autoHit.reverseSpiketick) && game.enemies.nearest) {
                // Nova: my.revAim -- aim behind the target on the musket tick
                return this.autoaim == "otrev" ? game.enemies.angle + Math.PI : game.enemies.angle;
            }`
);

edit(
  "tickMovement: keep walking in through the reverse aim tick",
  `            } else if (this.autoaim == "ot") {`,
  `            } else if (this.autoaim == "ot" || this.autoaim == "otrev") {`
);

/* ------------------------------------------------------------------ *
 * Write it out
 * ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log(`wrote ${path.relative(ROOT, OUT)}  (${code.split("\n").length} lines)`);
for (const label of applied) console.log(`  - ${label}`);
