# External Client stats collector

Counts how many people run the client. Free tier is far more than enough:
Workers allow 100k requests a day, and the client sends roughly one beacon per
load, one per spawn and one every five minutes.

---

# Full walkthrough

Everything below happens on your own machine, in the folder that holds
`worker.js`, `wrangler.toml` and `schema.sql`. Keep those three together.

## 0. What you need first

- **Node.js 18 or newer.** Check with `node -v`. If it prints nothing, install
  it from nodejs.org.
- **A Cloudflare account.** Free. Sign up at dash.cloudflare.com. You do not
  need a domain and you do not need to add a card.

## 1. Install wrangler and sign in

```sh
npm install -g wrangler
wrangler login
```

`wrangler login` opens a browser tab. Approve it, come back to the terminal.

Check it worked:

```sh
wrangler whoami
```

It should print your account email and id. If it says you are not logged in,
run `wrangler login` again.

## 2. Create the database

```sh
wrangler d1 create external-client-stats
```

It prints a block that looks like this:

```
[[d1_databases]]
binding = "DB"
database_name = "external-client-stats"
database_id = "8f2b41d9-7ce0-5a36-bb1e-7d40f9a2c835"
```

Copy that `database_id` value and paste it into `wrangler.toml`, replacing
`PUT-YOUR-D1-DATABASE-ID-HERE`. Leave `binding = "DB"` exactly as it is — the
Worker code refers to `env.DB`, so changing it breaks the Worker.

## 3. Create the table

```sh
wrangler d1 execute external-client-stats --remote --file=schema.sql
```

`--remote` matters. Without it the table is created only in a local test
database and the deployed Worker will not see it.

Check it worked:

```sh
wrangler d1 execute external-client-stats --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

You should see `hits` in the output.

## 4. The Discord webhook (optional)

Skip this if you only want the web page. If you want a daily summary in
Discord:

1. In Discord: **Server Settings → Integrations → Webhooks → New Webhook**.
2. Pick the channel, then **Copy Webhook URL**.
3. Give it to the Worker as a secret:

```sh
wrangler secret put DISCORD_WEBHOOK
```

It prompts for the value. Paste the URL and press enter. It is stored on
Cloudflare's side and never appears in your code or in the userscript, which
is the whole point — nobody can pull it out of the script and spam your
channel.

## 5. Deploy

```sh
wrangler deploy
```

It prints the live URL:

```
https://external-client-stats.<your-subdomain>.workers.dev
```

If this is your first Worker it may ask you to pick a `workers.dev`
subdomain. Any name is fine.

Open that URL in a browser. You should get the stats page with all zeros.
That means the Worker is up and the database is connected. If you instead get
an error about `env.DB`, step 2 or 3 did not take.

## 6. Test it before touching the client

Send a fake beacon by hand:

```sh
curl -X POST https://external-client-stats.<your-subdomain>.workers.dev \
  -H "Content-Type: text/plain" \
  -d '{"id":"test-1","event":"load","version":"Dev-2"}'
```

Refresh the stats page. It should now read **1 online now, 1 user today,
1 user all time**. Send the same command again with `"id":"test-2"` and it
becomes 2. Send it again with `"id":"test-1"` and it stays 2 — that is the
de-duplication working.

Clear the test rows when you are done:

```sh
wrangler d1 execute external-client-stats --remote --command="DELETE FROM hits"
```

## 7. Point the client at it

Open `ExternalClient_Dev2.js`, find this line near the top of the
`EXP_STATS` block:

```js
const ENDPOINT = "";
```

Put your Worker URL in it, with no trailing slash:

```js
const ENDPOINT = "https://external-client-stats.<your-subdomain>.workers.dev";
```

While that string is empty the whole block is inert and nothing is ever sent.

## 8. Install the script

1. Open the Tampermonkey extension → **Create a new script**.
2. Select everything in the editor and delete it.
3. Paste the whole of `ExternalClient_Dev2.js`.
4. **Ctrl+S** to save.

## 9. Check it end to end

Open `moomoo.io`, press **F12** for the console. You should see:

```
[External] anonymous usage stats are on — EXP_STATS.disable() to opt out.
```

Then open the Worker URL. **1 user today.** Spawn into a game and refresh the
page again: **played today** goes to 1.

That is the whole loop working.

## 10. Reading the numbers day to day

- `https://<worker>/` — online now, users today, played today, users all
  time, and the last 14 days.
- `https://<worker>/stats` — the same as JSON, if you want to graph it.
- Discord gets one message a day at 00:05 UTC, if you set the secret.

To change the daily time, edit `crons` in `wrangler.toml` — it is a standard
cron expression in **UTC** — then `wrangler deploy` again.

---

# Testing locally without deploying

```sh
wrangler d1 execute external-client-stats --local --file=schema.sql
wrangler dev
```

That serves the Worker on `http://localhost:8787` against a local copy of the
database. Point `ENDPOINT` at `http://localhost:8787` while you experiment,
then switch it back before you publish anything.

---

# Troubleshooting

**The stats page shows an error about `env.DB`.**
The `database_id` in `wrangler.toml` is missing or wrong, or `binding` is not
`DB`. Redo step 2, then `wrangler deploy`.

**The page loads but the numbers never move.**
Open the browser console on moomoo.io and look at the Network tab for a
request to your Worker. If it is not there, `ENDPOINT` is still empty or the
script did not reload — reinstall it in Tampermonkey. If it is there but red,
read the next entry.

**`no such table: hits`.**
Step 3 was run without `--remote`, so the table only exists locally. Run it
again with `--remote`.

**Nothing arrives from real users but curl works.**
Ad blockers and privacy extensions block requests to unknown domains. This
will always cost you some fraction of your users — treat the numbers as a
floor, not a headcount.

**Discord gets nothing.**
The cron only fires once a day. To test it immediately, deploy and then run
`wrangler tail` in one terminal while you trigger a scheduled run from the
Cloudflare dashboard: **Workers → your worker → Settings → Trigger Events →
Cron Triggers → Run**. Also confirm the secret exists with
`wrangler secret list`.

**You want to start the numbers over.**
```sh
wrangler d1 execute external-client-stats --remote --command="DELETE FROM hits"
```

---

# What is stored

One row per `(id, day, event)`. `id` is a random string the client generates
and keeps in its own `localStorage` — it is not derived from anything about
the person, and it is what makes "50 refreshes by one player" count as one
player. Alongside it: the day, the event name, the client version, the
two-letter country Cloudflare already attaches to the request, and a
timestamp. No IP addresses, no names, no chat, no game state.

Rows older than 90 days are deleted by the same cron that posts the summary.

# Why not point the client straight at a Discord webhook

- Discord rate-limits a webhook at about 30 requests a minute. Past that it
  returns 429 and the message is simply lost, so the busier you get the more
  you undercount — which is backwards.
- The webhook URL would sit in a public userscript. Anyone who reads it can
  flood your channel or delete the webhook. This happens to moomoo clients
  routinely.
- You would get a wall of individual messages, not a number. Counting them by
  hand is not a metric.
- Nothing de-duplicates. One player refreshing all evening looks like a crowd.

The Worker fixes all four: it counts instead of logging, it de-duplicates by
id, it keeps the webhook server-side as a secret, and it sends one message a
day instead of thousands.

# The zero-code alternative

If the script is published on Greasy Fork, its stats page already reports
daily installs, total installs and daily update checks. Update checks are
close to daily-active-users, because script managers ping for updates on a
schedule. That costs nothing to set up and needs no code in the client. It
tells you nothing about who actually spawns into a game, which is the one
thing the Worker adds.
