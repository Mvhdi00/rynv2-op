#!/usr/bin/env node
/*
 * build-yorha.js
 *
 * Builds YoRHa_System.user.js from src/YoRHa_System_1.5.js.
 *
 * The one thing this build changes is what a bot does when nobody is trying to
 * kill it. YoRHa's bots already fight properly: Full Mod is on by default, so
 * every bot runs the whole mod as itself -- the placer, the pre-placer, the
 * insta-kills, the spike and trap ticks, auto heal, AUTOBUY, hatFc. What none
 * of them ever did was the other half of playing: gathering, and building
 * outside a fight.
 *
 * That is not a missing feature. RynBots has a farm (_autoFarm) and a mill
 * trail (_autoMills), both written and both correct -- they are simply
 * unreachable. _botTick returns inside `if (full)` before either one is
 * called, and Full Mod is the default, so on a normal game they are dead code.
 * The mod cannot cover for them: it has no farm at all (it was written for a
 * human who gathers by hand) and its own mill trail is a keyboard toggle
 * (autoMills, key B) that no bot can press.
 *
 * So a bot gathers nothing, which means every place packet it sends is refused
 * for want of resources, which means no mills, which means no gold, which
 * means AUTOBUY never fires and hatFc dresses it in nothing. Follow and swing
 * is all that is left -- exactly what it looks like in game.
 *
 *   node tools/build-yorha.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/YoRHa_System_1.5.js");
const OUT = path.join(ROOT, "YoRHa_System.user.js");

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

/* Same rule as build-reup.js: a stale anchor fails the build loudly rather
 * than silently producing a half-patched script. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* ------------------------------------------------------------------ *
 * 1. Peacetime: the half of playing that was unreachable
 *
 * _peacetime is the pair RynBots already had, called in the order that makes
 * both of them work. Mills ride along with the walk to the next resource
 * rather than waiting for gathering to finish, because with Farm Until at 0
 * a bot is never finished gathering -- which is why the old ordering (farm,
 * return; mills only if there was nothing to farm) laid no mills at all on
 * the default settings, even with Full Mod off.
 * ------------------------------------------------------------------ */

edit(
  "bots: _peacetime + _ownerEngaged",
  `            _botTick(bot) {`,
  `            // =================================================================
            // PEACETIME  —  what a player does when nobody is on them
            // =================================================================
            // Gather, and lay the mill trail behind the walk while doing it.
            // Everything else a player does then falls out of the mod on its
            // own: the resources make the placer's packets legal, the mills
            // make gold, the gold makes AUTOBUY buy hats, and hatFc puts the
            // right one on for the fight.
            //
            // Mills ride along with the walk instead of waiting for gathering
            // to be "done" — with Farm Until at 0 it never is.
            //
            // Returns true if it took the tick.
            _peacetime(bot, moveAngle) {
                const farm = this._autoFarm(bot);
                if (farm) {
                    const walk = farm.mode === "walk" ? this._safeWalk(bot, farm.angle) : null;
                    // The trail goes down first: it borrows the attack packet
                    // and hands the weapon back, so the gather swing below has
                    // to be the last word on this tick.
                    if (walk !== null) this._autoMills(bot, walk);
                    this._sendWeapon(bot, farm.weapon);
                    this._sendAim(bot, farm.angle);
                    this._sendAttack(bot, farm.mode === "hit");
                    this._sendMove(bot, walk);
                    return true;
                }
                if (this._autoMills(bot, moveAngle)) {
                    this._sendMove(bot, moveAngle);
                    return true;
                }
                return false;
            },

            // Your fight is their fight. A bot that keeps chopping a tree while
            // someone is on you is not a squad, so anything near you stands the
            // whole squad's gathering down and the formation takes them back.
            // Read outside a bot context, where nearestEnemy is genuinely yours
            // — inside one it would answer for the bot.
            _ownerEngaged() {
                try {
                    if (inBotCtx()) return false;
                    if (!myPlayer || !nearestEnemy) return false;
                    return UTILS.getDistance(myPlayer.x2, myPlayer.y2,
                                             nearestEnemy.x2, nearestEnemy.y2) <= 900;
                } catch (e) { return false; }
            },

            _botTick(bot) {`
);

/* Full Mod is the default, and this early return is what made every line of
 * peacetime code unreachable. The mod owns the fight; a tick it did nothing
 * with is a tick nobody was using. */
edit(
  "bots: run peacetime under Full Mod",
  `                if (full) {
                    // Sync and the manual attack key are yours, not the mod's,
                    // so they still apply — but only on a tick the mod did not
                    // already decide the attack state for itself.`,
  `                if (full) {
                    // The mod fights as this bot, but it has no farm and no
                    // keyboard, so gathering and the mill trail are still ours.
                    // Only on a tick the mod itself did nothing with: it moved
                    // (a dodge, a push, a pre-place step) or it swung, and
                    // either way that tick is the fight's.
                    const busy = role || V.botFreeze || V.botRandomMove || V.botFollowCursor
                              || bot.modAttacked || bot.modMoved || this._ownerEngaged();
                    if (!busy) {
                        const near = this._nearestEnemy(bot);
                        const engaged = near && near.d <= this._reach(bot) * 1.5;
                        if (!engaged && this._peacetime(bot, moveAngle)) return;
                    }
                    // Sync and the manual attack key are yours, not the mod's,
                    // so they still apply — but only on a tick the mod did not
                    // already decide the attack state for itself.`
);

/* The Full Mod path is the default one, but the hand-written path has the same
 * ordering bug: farm returns before the mill trail is ever reached, and with
 * Farm Until at 0 the farm never stops returning. Both paths now go through
 * _peacetime, so they build the same way. */
edit(
  "bots: same peacetime ordering without Full Mod",
  `                const farmEnemy = this._nearestEnemy(bot);
                const farmBusy = role || V.botFreeze || V.botRandomMove || V.botFollowCursor
                              || (farmEnemy && farmEnemy.d <= this._reach(bot) * 1.5);
                if (!farmBusy) {
                    const farm = this._autoFarm(bot);
                    if (farm) {
                        this._sendWeapon(bot, farm.weapon);
                        this._sendAim(bot, farm.angle);
                        this._sendAttack(bot, farm.mode === "hit");
                        this._sendMove(bot, farm.mode === "walk" ? this._safeWalk(bot, farm.angle) : null);
                        return;
                    }
                } else {
                    bot.farmTarget = null;
                }`,
  `                const farmEnemy = this._nearestEnemy(bot);
                const farmBusy = role || V.botFreeze || V.botRandomMove || V.botFollowCursor
                              || this._ownerEngaged()
                              || (farmEnemy && farmEnemy.d <= this._reach(bot) * 1.5);
                if (!farmBusy) {
                    if (this._peacetime(bot, moveAngle)) return;
                } else {
                    bot.farmTarget = null;
                }`
);

/* ------------------------------------------------------------------ *
 * 2. The item-limit gate never fired
 *
 * isItemLimit reads `group.sandboxLimit || 99` and never looks at
 * `group.limit`, so off sandbox the cap reads 99 for every group that has no
 * sandboxLimit — spikes (15), traps (6), turrets (2), mines (1) — and 299 for
 * the three that do. The gate therefore never fires, and the placer keeps
 * queueing buildings the server drops on the floor.
 *
 * The file already knows: frRoomFor was written against the real limit and
 * says so in its comment. This is the same call, at the source.
 *
 * It matters more now than when it was one player's placer. Under Full Mod
 * this runs as every bot, and a bot at its trap cap spends its whole placement
 * budget on traps that will never land instead of the spike it could place.
 * ------------------------------------------------------------------ */

edit(
  "placer: honour the real item-group limits",
  `        function isItemLimit(id) {
            let group = items.list[id].group;
            let limit = (group.sandboxLimit || 99);

            if (myPlayer.itemCounts[group.id] >= limit) {
                return true;
            }
        }`,
  `        function isItemLimit(id) {
            let group = items.list[id].group;
            let limit = groupLimit(group);

            if (myPlayer.itemCounts[group.id] >= limit) {
                return true;
            }
        }

        // What the server will actually accept of this group: the sandbox cap
        // only when we are in sandbox, the real cap otherwise.
        function groupLimit(group) {
            if (!group) return 99;
            if (config.isSandbox && typeof group.sandboxLimit === "number") return group.sandboxLimit;
            if (typeof group.limit === "number") return group.limit;
            return 99;
        }`
);

/* The mill trail had no cap of its own. _botCanPlace stops it dropping one on
 * top of another, but a walking bot always has clear ground ahead of it, so
 * past seven mills it spends nine packets every 400ms on placements the server
 * refuses. The bot already tracks the count — the server sends it. */
edit(
  "bots: stop the mill trail at the mill cap",
  `                const item = items.list[mill];
                if (!item) return false;
                if (!this._canAfford(bot, mill)) return false;`,
  `                const item = items.list[mill];
                if (!item) return false;
                if (item.group && (bot.itemCounts[item.group.id] || 0) >= groupLimit(item.group)) return false;
                if (!this._canAfford(bot, mill)) return false;`
);

/* ------------------------------------------------------------------ *
 * 3. The hat mirror fights the mod
 *
 * botAutoBuyHats re-equips whatever YOU are wearing on every bot every 1.5s.
 * Under Full Mod hatFc() is already dressing each bot for its own situation —
 * soldier when something is on it, bull on a shame reset, tank while breaking,
 * winter in the snow — so the two write the same slot in opposite directions
 * and the hat flickers for as long as both are on. The mod's pick is the
 * informed one, so under Full Mod the mirror stands down.
 * ------------------------------------------------------------------ */

edit(
  "bots: leave hats to the mod under Full Mod",
  `                if (V.botAutoBuyHats && myPlayer && now - this._lastBuyCheck > 1500) {`,
  `                if (V.botAutoBuyHats && !V.botFullMod && myPlayer && now - this._lastBuyCheck > 1500) {`
);

/* ------------------------------------------------------------------ *
 * 4. Defaults
 *
 * The capability exists; what was left is that it ships off. A bot that has to
 * be switched on in four places before it does anything is a bot that does
 * nothing, so the four that make up "play the game" are on out of the box.
 *
 * Farm Until moves off 0 for the same reason the ordering changed: 0 means
 * "never stop gathering", and a bot that never stops gathering never rejoins
 * you and never spends what it gathered. 500 of each is a mill trail, a fight's
 * worth of spikes and change; when building spends it back below the mark the
 * bot tops up, which is the loop a player is already in.
 * ------------------------------------------------------------------ */

edit(
  "defaults: auto place on",
  `        // Placers
        autoPlace: false,`,
  `        // Placers
        // On: the placer is what puts a building down in a fight, and under
        // Full Mod that is every bot's placer too, not just yours.
        autoPlace: true,`
);

edit(
  "defaults: bots farm and build",
  `        botAutoMills: false,     // lay the mod's three-mill trail behind them`,
  `        botAutoMills: true,      // lay the mod's three-mill trail behind them`
);

edit(
  "defaults: bots gather",
  `        botAutoFarm: false,      // gather, so the bot can actually afford to build`,
  `        botAutoFarm: true,       // gather, so the bot can actually afford to build`
);

edit(
  "defaults: farm to a stock, not forever",
  `        botFarmLimit: 0,         // stop at this much of each resource; 0 = never stop`,
  `        botFarmLimit: 500,       // stop at this much of each resource; 0 = never stop
                                 // (0 also means never rejoining you and never
                                 //  spending what was gathered)`
);

/* ------------------------------------------------------------------ *
 * 5. Make the defaults reach someone who already has a saved config
 *
 * Settings load with Object.assign(window.vars, parsed), so every key that was
 * ever written to localStorage wins over the default beside it — including the
 * offs above, which is every returning player. One migration, once, and the
 * choice is theirs again from then on.
 * ------------------------------------------------------------------ */

edit(
  "defaults: migration key",
  `        // Settings
        theme: "",`,
  `        // Bumped when a default has to reach a saved config. See the
        // migration under LOAD SAVED SETTINGS.
        botCapability: 0,

        // Settings
        theme: "",`
);

edit(
  "defaults: apply the bot capability migration once",
  `    // --- SAVE FUNCTION ---`,
  `    // --- ONE-TIME: turn on the settings that make a bot play the game ------
    // Everything below shipped off, and a saved config keeps it off forever
    // because the load above is a plain Object.assign. This runs once per
    // config; after it, these are ordinary settings the player owns.
    const BOT_CAPABILITY = 1;
    if (window.vars.botCapability !== BOT_CAPABILITY) {
        window.vars.autoPlace = true;
        window.vars.botFullMod = true;
        window.vars.botAutoFarm = true;
        window.vars.botAutoMills = true;
        window.vars.botAutoPlace = true;
        window.vars.botAutoBreak = true;
        window.vars.botAutoHeal = true;
        window.vars.botAutoSpawn = true;
        if (!window.vars.botFarmLimit) window.vars.botFarmLimit = 500;
        window.vars.botCapability = BOT_CAPABILITY;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(window.vars)); } catch (e) {}
    }

    // --- SAVE FUNCTION ---`
);

/* ------------------------------------------------------------------ *
 * 6. Header
 * ------------------------------------------------------------------ */

{
  const end = code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of the userscript header");
  const header = `// ==UserScript==
// @name         YoRHa System (Falcon Replace)
// @author       nova
// @description  best 2026 mod - bots gather, build and buy for themselves
// @version      1.6
// @match           *://moomoo.io/
// @match           *://moomoo.io/?server*
// @match           *://*.moomoo.io/
// @match           *://*.moomoo.io/?server*
// @grant        none
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @run-at       document-start
// ==/UserScript==`;
  code = header + code.slice(end + "// ==/UserScript==".length);
  applied.push("header: version 1.6");
}

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
