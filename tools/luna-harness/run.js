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

function playerRow(sid, x, y, weaponIndex) {
    // sid, x, y, dir, buildIndex, weaponIndex, weaponVariant, team, isLeader,
    // skinIndex, tailIndex, iconIndex, zIndex
    return [sid, x, y, 0, -1, weaponIndex, 0, null, 0, 0, 0, 0, 0];
}

function objectRow(sid, x, y, scale, itemId, owner) {
    // sid, x, y, dir, scale, type, itemId, ownerSid
    return [sid, x, y, 0, scale, null, itemId, owner];
}

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
    }

    // One server tick: positions, then whatever came into view.
    async tick(objects) {
        const rows = [].concat(
            playerRow(ME, this.me.x, this.me.y, this.myWeapon),
            playerRow(ENEMY, this.enemy.x, this.enemy.y, this.enemyWeapon)
        );
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

    async setVar(key, value) {
        await this.page.evaluate(([key, value]) => { window.vars[key] = value; }, [key, value]);
    }
}

const results = [];
function check(scenario, label, ok, detail) {
    results.push({ scenario, label, ok: !!ok, detail });
}

async function run(browser, name, body) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
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

    const placerErrors = errors.filter(e => /Replace|claim|placeSync|Preplace|predict|scheduleDelayedPlacers/i.test(e));
    check(name, "no page errors from the placers", placerErrors.length === 0, placerErrors.slice(0, 3).join("\n"));
    if (errors.length && process.env.VERBOSE) console.log(`[${name}] page errors:\n` + errors.slice(0, 5).join("\n"));
    await context.close();
}

async function main() {
    const browser = await chromium.launch();
    const isBaseline = !!process.env.LUNA;

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

    await browser.close();

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

main().catch(e => {
    console.error(e);
    process.exitCode = 2;
});
