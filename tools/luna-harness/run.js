#!/usr/bin/env node
/*
 * Drives the Luna client in headless Chromium against a scripted server and
 * checks what it puts on the wire when a building breaks.
 *
 * The page swaps WebSocket for a fake before Luna loads (page.html), so every
 * packet Luna sends is captured here and every server message is one this
 * script chose. No game server is contacted.
 *
 *   npm i --no-save playwright msgpack-lite
 *   node tools/luna-harness/run.js                 # the client in luna/
 *   LUNA=path/to/other.user.js node tools/luna-harness/run.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..");
const LUNA = path.resolve(process.env.LUNA || path.join(ROOT, "luna", "Luna_Client_misery_preplace.user.js"));
const PAGE = path.join(__dirname, "page.html");
const MSGPACK = require.resolve("msgpack-lite/dist/msgpack.min.js");

const ME = 1;
const ENEMY = 2;
const TICK_MS = 111;

// Item data the checks need, as the client's own items.js has it.
const ITEM = {
    6: { name: "spikes", scale: 49, placeOffset: -5 },
    15: { name: "pit trap", scale: 50, placeOffset: -5 },
};
const ring = id => 35 + ITEM[id].scale + ITEM[id].placeOffset;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function playerRow(sid, x, y, weaponIndex, skin) {
    // sid, x, y, dir, buildIndex, weaponIndex, weaponVariant, team, isLeader,
    // skinIndex, tailIndex, iconIndex, zIndex
    return [sid, x, y, 0, -1, weaponIndex, 0, null, 0, skin || 0, 0, 0, 0];
}

function objectRow(sid, x, y, scale, itemId, owner) {
    // sid, x, y, dir, scale, type, itemId, ownerSid
    return [sid, x, y, 0, scale, null, itemId, owner];
}

// Food ids: apple, cookie, cheese. A build of one of these is an eat.
const FOODS = [0, 1, 2];
const eatsIn = packets => builds(packets).filter(b => FOODS.includes(b.id));

// z(id, false), F(1, a), F(0, a) is one build; anything else is not.
function builds(packets, origin) {
    const out = [];
    for (let i = 0; i + 1 < packets.length; i++) {
        const p = packets[i];
        if (p.type !== "z" || p.data[1] !== false) continue;
        const next = packets[i + 1];
        if (next.type !== "F" || next.data[0] !== 1) continue;
        const id = p.data[0];
        const angle = next.data[1];
        const build = { id: id, angle: angle, at: p.at };
        if (origin && ITEM[id]) {
            build.x = origin.x + ring(id) * Math.cos(angle);
            build.y = origin.y + ring(id) * Math.sin(angle);
        }
        out.push(build);
    }
    return out;
}

class Session {
    constructor(page) {
        this.page = page;
        this.me = { x: 1000, y: 1000 };
        this.enemy = { x: 1200, y: 1000 };
        this.myWeapon = 5;
        this.enemyWeapon = 5;
        this.mySkin = 0;
        this.enemySkin = 0;
        // More enemies: { sid, x, y, weapon, skin }.
        this.others = [];
    }

    rows() {
        return [].concat(
            playerRow(ME, this.me.x, this.me.y, this.myWeapon, this.mySkin),
            playerRow(ENEMY, this.enemy.x, this.enemy.y, this.enemyWeapon, this.enemySkin),
            ...this.others.map(o => playerRow(o.sid, o.x, o.y, o.weapon, o.skin))
        );
    }

    async boot() {
        const page = this.page;
        await page.goto("http://harness.local/page.html");
        await page.waitForFunction(() => typeof window.__lunaRegisterConnect === "function" && window.vars);
        await page.evaluate(() => {
            window.__pingDelay = 60;
            new WebSocket("ws://harness.local/");
        });
        await page.waitForFunction(() => window.__socket && window.__socket.readyState === 1);
        await page.evaluate(() => window.__recv("io-init", ["harness", 0, "", 0]));
        await page.waitForFunction(() => window.__sent.some(p => p.type === "M"));
    }

    async spawn() {
        const me = this.me, enemy = this.enemy;
        await this.page.evaluate(([me, enemy, ME, ENEMY]) => {
            window.__recv("C", [ME]);
            window.__recv("D", [["me", ME, "me", me.x, me.y, 0, 100, 100, 35, 0], true]);
            window.__recv("D", [["enemy", ENEMY, "enemy", enemy.x, enemy.y, 0, 100, 100, 35, 0], false]);
            window.__recv("V", [[0, 3, 6, 10, 15], false]);
            window.__recv("V", [[5, 10], true]);
        }, [me, enemy, ME, ENEMY]);
        for (const o of this.others) {
            await this.send("D", [["other" + o.sid, o.sid, "other", o.x, o.y, 0, 100, 100, 35, 0], false]);
        }
    }

    // One server tick: positions, then whatever came into view.
    async tick(objects) {
        const rows = this.rows();
        const flat = objects ? [].concat(...objects) : null;
        // The client applies a message's data as the handler's arguments, so a
        // flat table travels as the single argument.
        await this.page.evaluate(([rows, flat]) => {
            window.__recv("a", [rows]);
            if (flat) window.__recv("H", [flat]);
        }, [rows, flat]);
        await this.page.waitForTimeout(TICK_MS);
    }

    async ticks(n) {
        for (let i = 0; i < n; i++) await this.tick();
    }

    async send(type, data) {
        await this.page.evaluate(([type, data]) => window.__recv(type, data), [type, data]);
    }

    async mark() {
        return this.page.evaluate(() => window.__sent.length);
    }

    async since(mark) {
        return this.page.evaluate(mark => window.__sent.slice(mark), mark);
    }

    // The building breaks. Returns what the client sent before returning
    // from the handler, i.e. on the same message.
    async breakObject(sid) {
        return this.page.evaluate(sid => {
            const from = window.__sent.length;
            window.__recv("Q", [sid]);
            return window.__sent.slice(from);
        }, sid);
    }

    async stats() {
        return this.page.evaluate(() => window.lunaPlaceSync ? Object.assign({}, window.lunaPlaceSync.stats) : null);
    }

    // Our health as the server reports it. Returns the page clock at receipt,
    // the same clock the sent packets are stamped with.
    async hp(value, thenTick, before) {
        const rows = thenTick ? this.rows() : null;
        return this.page.evaluate(([ME, value, rows, before]) => {
            const at = performance.now();
            window.__recv("O", [ME, value]);
            // What else the server sent for that hit ("K" swing, "Y" projectile),
            // then the tick's player update.
            for (const [type, data] of before || []) window.__recv(type, data);
            if (rows) window.__recv("a", [rows]);
            return at;
        }, [ME, value, rows, before || null]);
    }

    async food(amount) {
        await this.send("N", ["food", amount, 1]);
    }

    async buyHat(id) {
        await this.send("5", [0, id, 0]);
    }

    async heal() {
        // An older client has no lunaHeal; its eats are still on the wire.
        return this.page.evaluate(() => window.lunaHeal ? {
            stats: Object.assign({}, window.lunaHeal.stats),
            state: window.lunaHeal.state(),
        } : { stats: {}, state: {} });
    }

    async wait(ms) {
        await this.page.waitForTimeout(ms);
    }

    async setVar(key, value) {
        await this.page.evaluate(([key, value]) => { window.vars[key] = value; }, [key, value]);
    }
}

const results = [];
function check(scenario, label, ok, detail) {
    results.push({ scenario, label, ok: !!ok, detail });
}

async function run(browser, name, body, options) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    if (options && options.storage) {
        await context.addInitScript(storage => {
            for (const key in storage) localStorage.setItem(key, storage[key]);
        }, options.storage);
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(String(e && e.stack || e)));

    await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.host !== "harness.local") return route.abort();
        if (url.pathname === "/page.html") return route.fulfill({ path: PAGE, contentType: "text/html" });
        if (url.pathname === "/luna.user.js") return route.fulfill({ path: LUNA, contentType: "text/javascript" });
        if (url.pathname === "/msgpack.min.js") return route.fulfill({ path: MSGPACK, contentType: "text/javascript" });
        return route.abort();
    });

    const s = new Session(page);
    try {
        await s.boot();
        await body(s);
    } catch (e) {
        check(name, "scenario ran to the end", false, String(e && e.stack || e));
    }

    check(name, "no page errors", errors.length === 0, errors.slice(0, 3).join("\n"));
    if (errors.length && process.env.VERBOSE) console.log(`[${name}] page errors:\n` + errors.slice(0, 5).join("\n"));
    await context.close();
}

async function main() {
    const browser = await chromium.launch();
    const isBaseline = !!process.env.LUNA;
    const suite = (process.env.SUITE || "all").split(",");
    const want = name => suite.includes("all") || suite.includes(name);

    if (want("place")) await placeScenarios(browser);
    if (want("heal")) await healScenarios(browser);
    if (want("anti")) await antiScenarios(browser);

    await browser.close();
    report(isBaseline);
}

async function placeScenarios(browser) {

    // A: our trap holding the enemy breaks -> trap them again, then pin them.
    // Luna's pathBreak (on by default) hammers our own traps and spikes in
    // reach when no enemy builds are around, so the scenarios keep the broken
    // build just outside the great hammer's reach (75 + 50) unless they are
    // testing exactly that.
    const OUT_OF_REACH = 75 + 50 + 4;

    await run(browser, "A retrap", async s => {
        s.me = { x: 1000, y: 1000 };
        s.enemy = { x: 1000 + OUT_OF_REACH, y: 1000 };
        await s.spawn();
        await s.tick([objectRow(500, s.enemy.x, s.enemy.y, 50, 15, ME)]);
        await s.ticks(4);

        const sent = await s.breakObject(500);
        const placed = builds(sent, s.me);
        // Autoplace on from here: the harness never confirms a build, so builds
        // it sent before the break would sit in the ledger as still on the way.
        await s.setVar("autoPlace", true);
        const trap = placed.find(b => b.id === 15);
        const spike = placed.find(b => b.id === 6);
        check("A retrap", "a trap goes out on the break packet itself", trap, JSON.stringify(placed));
        check("A retrap", "the trap lands on the enemy (catches them)", trap && dist(trap, s.enemy) < 50, trap && dist(trap, s.enemy).toFixed(1));
        check("A retrap", "any spike sent with it is in contact with the enemy", !spike || dist(spike, s.enemy) < 49 + 35, spike && dist(spike, s.enemy).toFixed(1));
        check("A retrap", "trap and spike do not overlap", !(trap && spike) || dist(trap, spike) >= 50 + 49, trap && spike && dist(trap, spike).toFixed(1));

        // Next tick: autoplace sees the freed ground too, and must leave it alone.
        const before = await s.mark();
        await s.tick();
        const next = builds(await s.since(before), s.me);
        const clash = next.filter(b => placed.some(r => dist(b, r) < ITEM[b.id].scale + ITEM[r.id].scale));
        check("A retrap", "autoplace does not build on ground replace just took", clash.length === 0, JSON.stringify(clash));
        const stats = await s.stats();
        check("A retrap", "stats: one replace, counted", stats && stats.replaced === 1, JSON.stringify(stats));
    });

    // B: our spike touching the free enemy breaks -> put a spike back on them.
    await run(browser, "B spike", async s => {
        s.me = { x: 1000, y: 1000 };
        const spikePos = { x: 1000 + OUT_OF_REACH, y: 1000 };
        s.enemy = { x: spikePos.x + 10, y: spikePos.y + 55 };
        await s.spawn();
        await s.tick([objectRow(600, spikePos.x, spikePos.y, 49, 6, ME)]);
        await s.ticks(3);

        // Luna starts an attack routine (autoaim) with the enemy on our spike.
        // Replace does not cut into one: it places with the tick's update, which
        // the server sends right behind the break.
        const onBreak = builds(await s.breakObject(600), s.me);
        const before = await s.mark();
        await s.tick();
        const stats = await s.stats();
        const placed = onBreak.length ? onBreak : builds(await s.since(before), s.me).filter(b => stats.deferred === 1);
        const spike = placed.find(b => b.id === 6);
        check("B spike", "a spike goes out on the break, or with the update right behind it", spike, JSON.stringify({ onBreak, stats }));
        check("B spike", "it touches the enemy", spike && dist(spike, s.enemy) < 49 + 35 - 1, spike && dist(spike, s.enemy).toFixed(1));
        check("B spike", "at most two builds for one break", stats.replaceBuilds <= 2, stats.replaceBuilds);
    });

    // C: an enemy wall next to us breaks -> take the ground with one build.
    await run(browser, "C steal", async s => {
        s.me = { x: 1000, y: 1000 };
        const wallPos = { x: 1000, y: 1000 + ring(15) };
        s.enemy = { x: 1000, y: 1250 };
        await s.spawn();
        await s.tick([objectRow(700, wallPos.x, wallPos.y, 50, 3, ENEMY)]);
        await s.ticks(3);

        const placed = builds(await s.breakObject(700), s.me);
        check("C steal", "exactly one build takes the freed ground", placed.length === 1, JSON.stringify(placed));
        const build = placed[0];
        check("C steal", "it stands on the freed ground", build && dist(build, wallPos) < 50, build && dist(build, wallPos).toFixed(1));
        check("C steal", "with nothing to hit, it is a trap (does not wall us in)", build && build.id === 15, build && build.id);
    });

    // Our own trap inside our hammer's reach: pathBreak is breaking it, so its
    // break is ours and is not put back.
    await run(browser, "path break guard", async s => {
        s.me = { x: 1000, y: 1000 };
        s.enemy = { x: 1000 + ring(15), y: 1000 };
        await s.spawn();
        await s.tick([objectRow(500, s.enemy.x, s.enemy.y, 50, 15, ME)]);
        await s.ticks(3);
        const placed = builds(await s.breakObject(500), s.me);
        const stats = await s.stats();
        check("path break guard", "our own swing's break is not replaced", placed.length === 0 && stats.breaks === 0, JSON.stringify({ placed, stats }));
    });

    // Not ours to answer: replace switched off.
    await run(browser, "gates", async s => {
        s.me = { x: 1000, y: 1000 };
        s.enemy = { x: 1000 + OUT_OF_REACH, y: 1000 };
        await s.spawn();
        await s.tick([objectRow(500, s.enemy.x, s.enemy.y, 50, 15, ME)]);
        await s.ticks(2);
        await s.setVar("prePlace2", false);
        const placed = builds(await s.breakObject(500), s.me);
        check("gates", "replace off: the break sends nothing", placed.length === 0, JSON.stringify(placed));
    });

    // D: preplace already covered the break. Replace must stay out if preplace
    // landed, and step in on the next update if it missed.
    for (const landed of [true, false]) {
        const name = landed ? "D preplace landed" : "D preplace missed";
        await run(browser, name, async s => {
            s.me = { x: 1000, y: 1000 };
            s.enemy = { x: 1000 + OUT_OF_REACH, y: 1000 };
            s.enemyWeapon = 10;
            await s.spawn();
            const trap = objectRow(500, s.enemy.x, s.enemy.y, 50, 15, ME);
            await s.tick([trap]);
            await s.tick();

            // Four great-hammer hits on the trap (75 each): 500 -> 200, which
            // one more swing breaks. The hits also empty the enemy's reload.
            for (let i = 0; i < 4; i++) {
                await s.send("L", [0, 500]);
                await s.send("K", [ENEMY, 1, 10]);
            }

            // Wait for the reload to come back: that tick, preplace predicts the
            // break and times builds onto the trap's ground.
            const start = await s.mark();
            let shots = [];
            let covered = false;
            for (let i = 0; i < 10 && !covered; i++) {
                const tickStart = await s.mark();
                await s.tick();
                shots = builds(await s.since(tickStart), s.me).filter(b => b.id === 15 || b.id === 6);
                covered = shots.length > 0;
            }
            check(name, "preplace fired for the trap", covered, JSON.stringify(builds(await s.since(start), s.me)));
            check(name, "preplace sends each build at most twice a tick", shots.length <= 2, shots.length);

            // The prediction was for that tick only. Nothing should go out again
            // on the next one: the old second send path replayed the previous
            // tick's angles from where we stood then.
            const nextStart = await s.mark();
            await s.tick();
            const stale = builds(await s.since(nextStart), s.me).filter(b => b.id === 15 || b.id === 6);
            check(name, "no stale preplace resends on the following tick", stale.length === 0, JSON.stringify(stale));

            const onBreak = builds(await s.breakObject(500), s.me);
            check(name, "nothing extra on the break packet: preplace has it", onBreak.length === 0, JSON.stringify(onBreak));

            const aim = shots[0];
            const before = await s.mark();
            if (landed) {
                await s.tick([objectRow(800, aim.x, aim.y, 50, 15, ME)]);
            } else {
                await s.tick();
            }
            const after = builds(await s.since(before), s.me);
            const stats = await s.stats();
            if (landed) {
                check(name, "replace stays out", stats.preplaceLanded === 1 && stats.replaced === 0, JSON.stringify(stats));
            } else {
                check(name, "replace takes over on the next update", stats.preplaceMissed === 1 && stats.replaced === 1, JSON.stringify(stats));
                check(name, "and its trap catches the enemy", after.some(b => b.id === 15 && dist(b, s.enemy) < 50), JSON.stringify(after));
            }
        });
    }

}

// The heal is judged on the server by the time between the hit and the eat:
// 120ms or less is +1 shame, more is -2. The harness answers pings after 60ms,
// so a shame-safe eat goes out about 135 - 60 = 75ms after the damage packet.
async function healScenarios(browser) {
    const FAR = { x: 3000, y: 3000 };
    const ADJACENT = { x: 1120, y: 1000 }; // inside a polearm's reach of (1000, 1000)
    const safeDelay = st => 120 + 20 - st.state.rttLow;

    // A hit that cannot kill: wait out the window and the next tick, then heal. No shame.
    await run(browser, "H1 slow heal", async s => {
        s.enemy = FAR;
        await s.spawn();
        await s.food(1000);
        await s.ticks(4);

        const mark = await s.mark();
        const t0 = await s.hp(70, true);
        await s.wait(TICK_MS);
        await s.ticks(3);
        const eats = eatsIn(await s.since(mark));
        const st = await s.heal();
        const delay = eats[0] ? eats[0].at - t0 : null;
        check("H1 slow heal", "heals 30 HP with 2 apples", eats.length === 2, eats.length);
        check("H1 slow heal", "not before the shame window has passed on the server", delay !== null && delay >= safeDelay(st) - 5, delay && delay.toFixed(1));
        check("H1 slow heal", "on the next tick's update, once it brought no hit", delay !== null && delay >= TICK_MS - 5 && delay <= TICK_MS + 40, delay && delay.toFixed(1));
        check("H1 slow heal", "counted as a slow heal, shame stays 0", st.stats.slowHeals === 1 && st.stats.fastHeals === 0 && st.state.shame === 0, JSON.stringify(st));
    });

    // The enemy's next hit kills: heal now and pay the shame.
    await run(browser, "H2 lethal fast heal", async s => {
        s.enemy = ADJACENT;
        await s.spawn();
        await s.food(1000);
        await s.ticks(4);

        const mark = await s.mark();
        const t0 = await s.hp(40, true);
        await s.wait(30);
        const eats = eatsIn(await s.since(mark));
        const st = await s.heal();
        check("H2 lethal fast heal", "eats on the tick, inside the window", eats.length > 0 && eats[0].at - t0 < 30, eats[0] && (eats[0].at - t0).toFixed(1));
        check("H2 lethal fast heal", "one fast heal, shame 1", st.stats.fastHeals === 1 && st.state.shame === 1, JSON.stringify(st));
    });

    // Soldier turns a lethal hit into a survivable one: no shame spent. Without
    // soldier owned, the same hit is lethal and is healed fast. The enemy stands
    // inside polearm reach (63 + 142) but too far to spike-tick us, so the
    // threat is the hit alone.
    for (const owned of [true, false]) {
        const name = owned ? "H3 soldier owned: slow" : "H3 no soldier: fast";
        await run(browser, name, async s => {
            s.enemy = { x: 1190, y: 1000 };
            await s.spawn();
            await s.food(1000);
            if (owned) await s.buyHat(6);
            await s.ticks(4);

            const mark = await s.mark();
            const t0 = await s.hp(60, true);
            await s.wait(TICK_MS);
            await s.ticks(2);
            const sent = await s.since(mark);
            const eats = eatsIn(sent);
            const st = await s.heal();
            const delay = eats[0] ? eats[0].at - t0 : null;
            if (owned) {
                check(name, "no fast heal: 67.5 x 0.75 does not kill at 60", st.stats.fastHeals === 0 && delay !== null && delay >= safeDelay(st) - 5, JSON.stringify({ delay, stats: st.stats }));
                check(name, "soldier goes on", sent.some(p => p.type === "c" && p.data[1] === 6), JSON.stringify(sent.filter(p => p.type === "c")));
            } else {
                check(name, "fast heal: 67.5 kills at 60 without soldier", st.stats.fastHeals === 1 && delay !== null && delay < 30, JSON.stringify({ delay, stats: st.stats }));
            }
        });
    }

    // Seven fast heals bring shame to 7. The 8th fast eat would heal nothing and
    // lock eating for 30s, so the next lethal hit waits for the slow heal.
    await run(browser, "H4 shame 7", async s => {
        s.enemy = ADJACENT;
        await s.spawn();
        await s.food(5000);
        await s.ticks(4);
        for (let i = 0; i < 7; i++) {
            await s.hp(40, true);
            await s.wait(40);
            await s.hp(100);
            await s.tick();
        }
        const before = await s.heal();
        check("H4 shame 7", "seven fast heals counted: shame 7", before.state.shame === 7 && before.stats.fastHeals === 7, JSON.stringify(before));

        const mark = await s.mark();
        const t0 = await s.hp(40, true);
        await s.wait(30);
        const early = eatsIn(await s.since(mark));
        await s.wait(TICK_MS - 30);
        await s.ticks(2);
        const all = eatsIn(await s.since(mark));
        const st = await s.heal();
        check("H4 shame 7", "no fast eat at 7", early.length === 0 && st.stats.fastRefused >= 1, JSON.stringify({ early: early.length, stats: st.stats }));
        check("H4 shame 7", "the slow heal still comes, and brings shame to 5", all.length > 0 && all[0].at - t0 >= safeDelay(st) - 5 && st.state.shame === 5, JSON.stringify({ first: all[0] && all[0].at - t0, state: st.state }));
    });

    // A chip on every tick: any eat would land within 120ms of a hit, so none
    // goes out until a tick passes without one.
    await run(browser, "H5 chip every tick", async s => {
        s.enemy = FAR;
        await s.spawn();
        await s.food(1000);
        await s.ticks(4);

        const mark = await s.mark();
        let last = 0;
        for (const hp of [92, 84, 76, 68, 60]) {
            last = await s.hp(hp, true);
            await s.wait(TICK_MS);
        }
        const during = eatsIn(await s.since(mark));
        await s.ticks(3);
        const eats = eatsIn(await s.since(mark));
        const st = await s.heal();
        check("H5 chip every tick", "no eat while a hit comes every tick", during.length === 0 && eats.length > 0 && eats[0].at >= last + safeDelay(st) - 5, JSON.stringify({ during: during.length, first: eats[0] && eats[0].at - last }));
        check("H5 chip every tick", "then one slow heal, shame 0", st.stats.slowHeals === 1 && st.stats.fastHeals === 0 && st.state.shame === 0, JSON.stringify(st));
    });

    // Regen refilled us after a hit nobody ate for: one eat at full HP takes the
    // server's -2 for free.
    await run(browser, "H6 dry eat", async s => {
        s.enemy = ADJACENT;
        await s.spawn();
        await s.food(1000);
        await s.ticks(4);
        await s.hp(40, true);
        await s.wait(40);
        await s.hp(100);
        s.enemy = FAR;
        await s.ticks(3);
        const before = await s.heal();

        const mark = await s.mark();
        await s.hp(95, true);
        await s.wait(TICK_MS);
        await s.hp(100, true);
        await s.wait(TICK_MS);
        await s.ticks(3);
        const eats = eatsIn(await s.since(mark));
        const st = await s.heal();
        check("H6 dry eat", "starts at shame 1", before.state.shame === 1, JSON.stringify(before.state));
        check("H6 dry eat", "one eat at full HP", eats.length === 1 && st.stats.dryEats === 1, JSON.stringify({ eats: eats.length, stats: st.stats }));
        check("H6 dry eat", "shame back to 0", st.state.shame === 0, JSON.stringify(st.state));
    });

    // The server neither heals nor takes food: it may be in its lockout without
    // our count knowing. No fast eats then (they would feed it), one slow probe
    // a second, and the first answer that comes back clears the suspicion.
    await run(browser, "H7 suspected lockout", async s => {
        s.enemy = ADJACENT;
        await s.spawn();
        await s.food(1000);
        await s.ticks(4);

        const mark = await s.mark();
        await s.hp(40, true);
        await s.wait(TICK_MS);
        await s.ticks(5);
        const eats = eatsIn(await s.since(mark));
        const st = await s.heal();
        check("H7 suspected lockout", "one burst, no resends while it is unanswered", eats.length === 3, eats.length);
        check("H7 suspected lockout", "no answer: lockout suspected", st.stats.lockoutsInferred === 1 && st.state.suspectedLockForMs > 25000 && st.state.shame === 0, JSON.stringify(st));

        const mark2 = await s.mark();
        await s.hp(30, true);
        await s.wait(30);
        const st2 = await s.heal();
        check("H7 suspected lockout", "no fast eat while it is suspected", eatsIn(await s.since(mark2)).length === 0 && st2.stats.fastRefused >= 1, JSON.stringify(st2.stats));

        await s.wait(TICK_MS - 30);
        await s.ticks(9);
        const probes = eatsIn(await s.since(mark2));
        check("H7 suspected lockout", "one slow probe, a second after the suspicion", probes.length > 0 && probes.every(e => e.at === probes[0].at || e.at - probes[0].at < 5) && probes[0].at - eats[0].at >= 1000, JSON.stringify(probes.map(e => (e.at - eats[0].at).toFixed(0))));

        // The first burst's heal shows up late after all.
        await s.hp(90);
        const st3 = await s.heal();
        check("H7 suspected lockout", "a late heal clears it and restores the count", st3.stats.lockoutsRevoked === 1 && st3.state.suspectedLockForMs === 0 && st3.state.shame === 1, JSON.stringify(st3));
    });

    // The server's own lockout signal: the Shame! hat. Nothing eats under it.
    await run(browser, "H8 shame hat", async s => {
        s.enemy = ADJACENT;
        await s.spawn();
        await s.food(1000);
        await s.ticks(4);

        s.mySkin = 45;
        await s.tick();
        const mark = await s.mark();
        await s.hp(40, true);
        await s.wait(TICK_MS);
        await s.ticks(3);
        const st = await s.heal();
        check("H8 shame hat", "no eats while it is on, even at a lethal hit", eatsIn(await s.since(mark)).length === 0 && st.state.lockedForMs > 0, JSON.stringify(st.state));

        s.mySkin = 0;
        const mark2 = await s.mark();
        await s.ticks(3);
        const st2 = await s.heal();
        check("H8 shame hat", "off again: the lockout is over and the heal goes out", st2.state.lockedForMs === 0 && eatsIn(await s.since(mark2)).length > 0, JSON.stringify(st2.state));
    });

    // A hit that shows up less than a round trip after our eat was on the
    // server before the eat: the eat was judged against it, +1, not -2.
    await run(browser, "H9 hit overtakes the eat", async s => {
        s.enemy = FAR;
        await s.spawn();
        await s.food(1000);
        await s.ticks(4);

        const mark = await s.mark();
        await s.hp(70, true);
        await s.wait(TICK_MS);
        await s.send("a", [s.rows()]);
        await s.wait(15);
        const first = eatsIn(await s.since(mark));
        await s.hp(60);
        const st = await s.heal();
        check("H9 hit overtakes the eat", "the slow heal went out on the next tick", first.length === 2, first.length);
        check("H9 hit overtakes the eat", "rebooked as a fast eat: shame 1", st.stats.rebooked === 1 && st.state.shame === 1 && st.state.hitMaybeUsed, JSON.stringify(st));

        await s.ticks(3);
        const st2 = await s.heal();
        check("H9 hit overtakes the eat", "the next heal books no -2 it may not get", st2.stats.slowHeals === 2 && st2.state.shame === 1, JSON.stringify(st2));
    });
}

// Instas: the first half lands, and the second half must be met with a heal
// before it does. Health arrives rounded here, as the embedded server sends it.
async function antiScenarios(browser) {
    const fastIn = (eats, t0) => eats.length > 0 && eats[0].at - t0 < 30;

    // Bull polearm hit (67.5 -> seen as 68), musket and turret ready for next tick.
    await run(browser, "A1 default insta", async s => {
        s.enemy = { x: 1120, y: 1000 };
        s.enemySkin = 7;
        await s.spawn();
        await s.food(1000);
        // Let the client see their musket once.
        s.enemyWeapon = 15;
        await s.ticks(2);
        s.enemyWeapon = 5;
        await s.ticks(3);

        const mark = await s.mark();
        const t0 = await s.hp(32, true, [["K", [ENEMY, 0, 5]]]);
        await s.wait(30);
        const eats = eatsIn(await s.since(mark));
        const st = await s.heal();
        check("A1 default insta", "the follow-up (musket 50 + turret 25 > 32 HP) is healed before it lands", fastIn(eats, t0), JSON.stringify({ eats: eats.length, stats: st.stats }));
    });

    // Musket shot first, then their primary: in bull (67.5) or in turret gear
    // with the turret (45 + 25), one hat or the other, so at most 70.
    for (const soldier of [true, false]) {
        const name = soldier ? "A2 reverse insta, soldier" : "A2 reverse insta, bare";
        await run(browser, name, async s => {
            s.enemy = { x: 1190, y: 1000 };
            if (soldier) s.mySkin = 6;
            await s.spawn();
            await s.food(1000);
            if (soldier) await s.buyHat(6);
            s.enemyWeapon = 15;
            await s.ticks(3);
            // The shot: spawned 70 ahead of them, flying at us.
            const dir = Math.atan2(s.me.y - s.enemy.y, s.me.x - s.enemy.x);
            await s.send("X", [s.enemy.x + 70 * Math.cos(dir), s.enemy.y + 70 * Math.sin(dir), dir, 1400, 3.6, 5, 0, 900]);
            await s.tick();
            s.enemyWeapon = 5;

            const mark = await s.mark();
            // Musket 50, through soldier 37.5.
            const t0 = await s.hp(soldier ? 62 : 50, true, [["Y", [900, 120]]]);
            await s.wait(30);
            const eats = eatsIn(await s.since(mark));
            const st = await s.heal();
            if (soldier) {
                check(name, "70 x 0.75 = 52.5 does not kill at 62: no shame spent", eats.length === 0 && st.stats.fastHeals === 0, JSON.stringify({ eats: eats.length, stats: st.stats }));
            } else {
                check(name, "70 kills at 50: healed before it lands", fastIn(eats, t0) && st.stats.fastHeals === 1, JSON.stringify({ eats: eats.length, stats: st.stats }));
            }
        });
    }

    // Two enemies, each one hit short of killing us, together over it.
    for (const sync of [true, false]) {
        const name = sync ? "A3 sync on" : "A3 sync off";
        await run(browser, name, async s => {
            s.enemy = { x: 1190, y: 1000 };
            s.others = [{ sid: 3, x: 1000, y: 1190, weapon: 5, skin: 0 }];
            await s.spawn();
            await s.food(1000);
            await s.setVar("test3", sync);
            await s.ticks(4);

            const mark = await s.mark();
            const t0 = await s.hp(80, true);
            await s.wait(30);
            const eats = eatsIn(await s.since(mark));
            const st = await s.heal();
            if (sync) {
                check(name, "two ready polearms (2 x 67.5 > 80 HP) are healed for now", fastIn(eats, t0) && st.stats.fastHeals === 1, JSON.stringify({ eats: eats.length, stats: st.stats }));
            } else {
                check(name, "without it, neither alone kills: no fast heal", eats.length === 0 && st.stats.fastHeals === 0, JSON.stringify({ eats: eats.length, stats: st.stats }));
            }
        });
    }

    // A polearm in reach and a musket 300 away, both ready.
    await run(browser, "A4 sync with a musket", async s => {
        s.enemy = { x: 1190, y: 1000 };
        s.others = [{ sid: 3, x: 1000, y: 1300, weapon: 15, skin: 0 }];
        await s.spawn();
        await s.food(1000);
        await s.ticks(2);
        s.others[0].weapon = 5;
        await s.ticks(2);

        const mark = await s.mark();
        const t0 = await s.hp(80, true);
        await s.wait(30);
        const eats = eatsIn(await s.since(mark));
        const st = await s.heal();
        check("A4 sync with a musket", "67.5 + 50 > 80 HP: healed for now", fastIn(eats, t0) && st.stats.fastHeals === 1, JSON.stringify({ eats: eats.length, stats: st.stats }));
    });

    // Someone swings 400 away while we take a polearm-sized hit. That swing is
    // not ours, so its musket follow-up is not predicted.
    await run(browser, "A5 swing out of reach", async s => {
        s.enemy = { x: 1400, y: 1000 };
        s.enemySkin = 7;
        await s.spawn();
        await s.food(1000);
        s.enemyWeapon = 15;
        await s.ticks(2);
        s.enemyWeapon = 5;
        await s.ticks(3);

        const mark = await s.mark();
        await s.hp(32, true, [["K", [ENEMY, 0, 5]]]);
        await s.wait(30);
        const eats = eatsIn(await s.since(mark));
        const st = await s.heal();
        check("A5 swing out of reach", "no fast heal for a follow-up that is not coming", eats.length === 0 && st.stats.fastHeals === 0, JSON.stringify({ eats: eats.length, stats: st.stats }));
    });

    // Settings saved by 1.8 or older have the anti toggles off: they did nothing
    // then. 1.9 turns them on once; after that the player's choice is kept.
    for (const [label, saved, want] of [
        ["A6 settings from 1.8", { test1: false, test2: false, test3: false, test4: false, placeRange: 250 }, { test1: true, test4: true, placeRange: 250 }],
        ["A6 settings from 1.9", { test1: false, test2: true, test3: true, test4: true, autoHeal: true }, { test1: false, test4: true }],
    ]) {
        await run(browser, label, async s => {
            const vars = await s.page.evaluate(() => Object.assign({}, window.vars));
            const ok = Object.keys(want).every(key => vars[key] === want[key]);
            check(label, "toggles as expected", ok, JSON.stringify(Object.fromEntries(Object.keys(want).map(key => [key, vars[key]]))));
        }, { storage: { DELTEK_V4_CONFIG: JSON.stringify(saved) } });
    }
}

function report(isBaseline) {
    let failed = 0;
    let last = null;
    console.log(`Luna harness: ${path.relative(ROOT, LUNA)}${isBaseline ? " (override)" : ""}\n`);
    for (const r of results) {
        if (r.scenario !== last) {
            console.log(r.scenario);
            last = r.scenario;
        }
        console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.label}${r.ok ? "" : "  -> " + r.detail}`);
        if (!r.ok) failed++;
    }
    console.log(`\n${results.length - failed}/${results.length} checks passed`);
    process.exitCode = failed ? 1 : 0;
}

if (require.main === module) {
    main().catch(e => {
        console.error(e);
        process.exitCode = 2;
    });
} else {
    // For one-off debugging scripts: drive a Session by hand.
    module.exports = { Session, run, check, results, playerRow, objectRow, builds, eatsIn };
}
