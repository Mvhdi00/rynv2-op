# External Client stats collector

Counts how many people run the client. Free tier is far more than enough:
Workers allow 100k requests a day, and the client sends roughly one beacon per
load, one per spawn and one every five minutes.

## Setup

```sh
npm i -g wrangler
wrangler login

wrangler d1 create external-client-stats
# paste the printed database_id into wrangler.toml

wrangler d1 execute external-client-stats --remote --file=schema.sql
wrangler secret put DISCORD_WEBHOOK        # optional, for the daily summary
wrangler deploy
```

Then put the deployed URL into `ENDPOINT` at the top of the stats block in
`src/ExternalClient_Dev2.js`:

```js
const ENDPOINT = "https://external-client-stats.<your-subdomain>.workers.dev";
```

With `ENDPOINT` empty the client sends nothing at all.

## Reading the numbers

- `https://<worker>/` — a small page: online now, users today, played today,
  users all time, and the last 14 days.
- `https://<worker>/stats` — the same as JSON, if you want to graph it.
- Discord gets one summary a day, if you set the secret.

## What is stored

One row per `(id, day, event)`. `id` is a random string the client generates
and keeps in its own `localStorage` — it is not derived from anything about
the person, and it is what makes "50 refreshes by one player" count as one
player. Alongside it: the day, the event name, the client version, the
two-letter country Cloudflare already attaches to the request, and a
timestamp. No IP addresses, no names, no chat, no game state.

Rows older than 90 days are deleted by the same cron that posts the summary.

## Why not point the client straight at a Discord webhook

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

## The zero-code alternative

If the script is published on Greasy Fork, its stats page already reports
daily installs, total installs and daily update checks. Update checks are
close to daily-active-users, because script managers ping for updates on a
schedule. That costs nothing to set up and needs no code in the client. It
tells you nothing about who actually spawns into a game, which is the one
thing the Worker adds.
