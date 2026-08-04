/* Collector for the External Client usage beacons.
 *
 * POST /          record one beacon   {id, event, version}
 * GET  /stats     the numbers as JSON
 * GET  /          the same numbers as a small page
 *
 * A cron trigger posts a daily summary to Discord. The webhook lives in a
 * Worker secret, never in the userscript, so nobody can pull it out of the
 * client and spam the channel.
 */

const MAX_ID = 64;
const MAX_VERSION = 32;
const EVENTS = ["load", "play", "alive"];
const ONLINE_WINDOW_MS = 10 * 60 * 1000;
const RETENTION_DAYS = 90;

function today() {
    return new Date().toISOString().slice(0, 10);
}

function json(body, status) {
    return new Response(JSON.stringify(body), {
        status: status || 200,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "access-control-allow-origin": "*"
        }
    });
}

async function record(request, env) {
    let data;
    try {
        data = JSON.parse(await request.text());
    } catch (e) {
        return new Response("", { status: 204 });
    }
    if (!data || typeof data.id !== "string" || !EVENTS.includes(data.event)) {
        return new Response("", { status: 204 });
    }

    const id = data.id.slice(0, MAX_ID);
    const version = typeof data.version === "string" ? data.version.slice(0, MAX_VERSION) : "unknown";
    const country = request.headers.get("cf-ipcountry") || "??";

    await env.DB.prepare(
        `INSERT INTO hits (id, day, event, version, country, ts)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id, day, event) DO UPDATE SET
             ts = excluded.ts,
             version = excluded.version,
             count = count + 1`
    ).bind(id, today(), data.event, version, country, Date.now()).run();

    return new Response("", { status: 204 });
}

async function stats(env) {
    const day = today();
    const since = Date.now() - ONLINE_WINDOW_MS;

    const [totals, daily, online, versions, recent] = await env.DB.batch([
        env.DB.prepare(`SELECT COUNT(DISTINCT id) AS users FROM hits`),
        env.DB.prepare(
            `SELECT
                 COUNT(DISTINCT CASE WHEN event = 'load' THEN id END) AS users,
                 COUNT(DISTINCT CASE WHEN event = 'play' THEN id END) AS players,
                 COALESCE(SUM(CASE WHEN event = 'load' THEN count END), 0) AS loads,
                 COALESCE(SUM(CASE WHEN event = 'play' THEN count END), 0) AS plays
             FROM hits WHERE day = ?`
        ).bind(day),
        env.DB.prepare(`SELECT COUNT(DISTINCT id) AS online FROM hits WHERE ts >= ?`).bind(since),
        env.DB.prepare(
            `SELECT version, COUNT(DISTINCT id) AS users FROM hits
             WHERE day = ? GROUP BY version ORDER BY users DESC LIMIT 10`
        ).bind(day),
        env.DB.prepare(
            `SELECT day,
                 COUNT(DISTINCT CASE WHEN event = 'load' THEN id END) AS users,
                 COUNT(DISTINCT CASE WHEN event = 'play' THEN id END) AS players
             FROM hits GROUP BY day ORDER BY day DESC LIMIT 14`
        )
    ]);

    return {
        day: day,
        totalUsers: totals.results[0].users,
        today: daily.results[0],
        onlineNow: online.results[0].online,
        versions: versions.results,
        last14Days: recent.results
    };
}

function page(data) {
    const rows = data.last14Days
        .map(r => `<tr><td>${r.day}</td><td>${r.users}</td><td>${r.players}</td></tr>`)
        .join("");
    return `<!doctype html><meta charset="utf-8"><title>External Client stats</title>
<style>
 body{font:14px/1.6 system-ui,sans-serif;margin:40px auto;max-width:640px;color:#222}
 h1{font-size:20px} .big{display:flex;gap:32px;margin:24px 0}
 .big div{flex:1} .n{font-size:32px;font-weight:600} .l{color:#666;font-size:12px}
 table{border-collapse:collapse;width:100%} td,th{padding:6px 10px;border-bottom:1px solid #eee;text-align:left}
 @media(prefers-color-scheme:dark){body{background:#111;color:#eee}td,th{border-color:#333}.l{color:#999}}
</style>
<h1>External Client</h1>
<div class="big">
 <div><div class="n">${data.onlineNow}</div><div class="l">online now</div></div>
 <div><div class="n">${data.today.users}</div><div class="l">users today</div></div>
 <div><div class="n">${data.today.players}</div><div class="l">played today</div></div>
 <div><div class="n">${data.totalUsers}</div><div class="l">users all time</div></div>
</div>
<table><tr><th>day</th><th>users</th><th>played</th></tr>${rows}</table>`;
}

async function postDailySummary(env) {
    if (!env.DISCORD_WEBHOOK) return;
    const data = await stats(env);
    await fetch(env.DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            embeds: [{
                title: "External Client — daily stats",
                color: 0x8ecc51,
                fields: [
                    { name: "Users today", value: String(data.today.users), inline: true },
                    { name: "Played today", value: String(data.today.players), inline: true },
                    { name: "Online now", value: String(data.onlineNow), inline: true },
                    { name: "Loads today", value: String(data.today.loads), inline: true },
                    { name: "Spawns today", value: String(data.today.plays), inline: true },
                    { name: "Users all time", value: String(data.totalUsers), inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        })
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "access-control-allow-origin": "*",
                    "access-control-allow-methods": "POST, GET, OPTIONS",
                    "access-control-allow-headers": "content-type"
                }
            });
        }

        if (request.method === "POST") {
            return record(request, env);
        }

        if (url.pathname === "/stats") {
            return json(await stats(env));
        }

        return new Response(page(await stats(env)), {
            headers: { "content-type": "text/html; charset=utf-8" }
        });
    },

    async scheduled(event, env, ctx) {
        ctx.waitUntil((async () => {
            await postDailySummary(env);
            const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString().slice(0, 10);
            await env.DB.prepare(`DELETE FROM hits WHERE day < ?`).bind(cutoff).run();
        })());
    }
};
