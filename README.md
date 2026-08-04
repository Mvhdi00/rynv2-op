# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

This repo also carries a second, unrelated build: **`Ae86_Fixed.user.js`**, the
Ae86 v10 client repaired against the same game bundles. See
[Ae86 v10](#ae86-v10).

---

## Why RYN is the base

The two clients are not the same kind of thing:

| | RYN Client v4 | Luna Client 1.1 |
|---|---|---|
| Form | Userscript that rewrites the game bundle at load | A fork of the whole game bundle |
| Protocol | Per-connection opcode permutation + truncated-HMAC frame prefix | Plain msgpack `[type, args]` |
| Runs on the current game | Yes | No |

The game shipped in `src/game_index.js` negotiates an opcode table per
connection (`io-init[3] === 1`), permutes the c2s/s2c alphabets from a seed,
and prefixes every client frame with 6 HMAC bytes. Luna 1.1 predates that
transport entirely — it is a fork of the old webpack `bundle.js` and cannot
connect to the current game at all.

So Luna's code could not be merged in as code. Its features were ported across
onto the RYN core instead, and everything else in RYN was left alone.

## What the mix changes

### Ported from Luna

| Feature | Where it lives |
|---|---|
| **Username Cycler** | Misc → ReUp Mix. Advances `#nameInput` through a comma-separated list on every spawn. |
| **Spike Rotation / Mill Rotation** | Misc → ReUp Mix. Off freezes spinning spikes and mills so their hitboxes are readable. |
| **Menu themes** | Misc → ReUp Mix. Five accent presets (Ryn / NVG / Ice / Red / Void). |

Luna features that were **not** ported, and why:

- *Song / auto-chat lyric loop* — RYN already has a fuller version of this
  (the Music page, with chunked chat sending and session tracking).
- *Autoplacer / preplace / replace* — see below; RYN's `AutoPlacer` **is**
  Luna's placer, ported.
- *Killchat, shame combat, anti-KB, autobuy, pathfinding, AI movement /
  spikepush* — already present in RYN, in several cases as direct ports
  (`LunaPathfinder`, `LunaSafeWalk`).
- *"ai hat predict" (`autsh1`) and "ai triangulation" (`triangle2`)* — these
  are menu entries in Luna with no implementation behind them. Nothing to port.

### The placer

Luna's placer was already ported into RYN before this merge — `AutoPlacer`
carries Luna's function set under RYN's naming (`getConfig` → `_getConfig`,
`canPlace` → `_canPlace`, `addPredictObject` → `_addPredictObject`,
`getPrePlaceAngles` → `_getPrePlaceAngles`, `getPrePlaceObject` →
`_getPrePlaceObject`), rebuilt on RYN's spatial grid. Luna's whole placer menu
is present and then some:

| Luna | ReUp Mix |
|---|---|
| `autoPlace` | `_autoplacer` |
| `placeRange` | `_autoplacerRadius` |
| `prePlace` | `_preplacer` |
| `prePlace2` (replace) | `_replacer` |
| — | `_placeAttempts`, `_glotusPlacer`, `_placerRetrapCombo` |

`_lunaExactPlacer` picks between the two decision sets: **on** restricts spike
placement to Luna's original conditions, **off** (the default) adds RYN's extra
heuristics — seals-exit, double-spike, bounces-onto-spike, touches-enemy.

**Bug fixed in the placer.** `AutoPlacer._isItemLimit` read
`group.sandboxLimit || 99` and never looked at `group.limit`. Outside sandbox
that made the cap 99 for everything without a `sandboxLimit` — spikes (real
limit 15), traps (6), turrets (2), mines (1) — and 299 for the three that have
one. The limit gate effectively never fired, so the placer kept spending
placement ticks on items it could not place.

This came straight from Luna, which has the same expression. The rest of the
client already gets it right: `ClientPlayer.getItemCount` picks `sandboxLimit`
only when actually in sandbox and falls back to `group.limit` otherwise, and
`AutoRetrap._isItemLimit` is written against that. `AutoPlacer` now makes the
same call, so all three agree.

### Driver correction

`ItemGroups[8]` — the platform group — carried `layer: -1` in RYN. The shipped
bundle has `layer: 1`.

That value is not cosmetic: `PlayerObject` reads `ItemGroups[itemGroup].layer`
straight into its own `.layer`, which the collision and placement paths key
off, so a platform was being treated as a pass-under layer like traps and boost
pads. Corrected to `1`.

This was the only mismatch across item groups, weapons, items, hats,
accessories, and config — see [Verification](#verification).

### Removed

RYN v4 opened with this:

```js
if (!localStorage.getItem("_ryn_sent")) {
  fetch("https://webhook.site/d1428dcc-.../?t=" + Date.now());
  localStorage.setItem("_ryn_sent", "1");
}
```

A first-run ping to a third-party webhook endpoint, fired before anything else
and never surfaced to the user. It carries no payload beyond the hit itself,
but nothing in the client needs it. It is stripped from the build.

---

## Layout

```
ReUp_Mix.user.js          the build output — this is the script to install
Ae86_Fixed.user.js        the Ae86 build output (see below)
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/Ae86_v10.js           Ae86 client v10, as shipped (input)
src/ae86-bootstrap.js     Ae86 transport + entry shim (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-ae86.js       src/Ae86_v10.js -> Ae86_Fixed.user.js
tools/game-transport.js   pulls the live transport out of src/game_*.js
tools/verify-ae86.js      Ae86 transport vs. the game bundle
tools/smoke-ae86.js       drives the Ae86 build against a mock current server
tools/strip-comments.js   removes comments, keeps the ==UserScript== header
src/ExternalClient_Dev2.js  External Client Dev-2, with the player counter
tools/stats-worker/       the collector for when webhook.site is outgrown
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
```

Every edit in `build-reup.js` is anchored to an exact string in the base
client, and an anchor that is missing or ambiguous fails the build. Dropping in
a newer RYN will surface as a build error rather than a half-merged script.

## Verification

```sh
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node --check ReUp_Mix.user.js
```

Current state of the build:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Hooks** — 36/36 bundle-rewrite hooks bind, including the new
  `objectRotation` hook and the pre-existing `freezeTurnSpeed`, which now
  resolves to the animal turn-rate site only.

`check-hooks.js` re-minifies `src/game_index.js` before matching, because the
hook patterns are written against minified code and the bundle checked in here
is beautified. It approximates the shipped asset; it does not reproduce the
original mangled identifiers, which the patterns match generically anyway.

### Runtime drift check

The build embeds a `ReUpDrivers` manifest recording what it was verified
against, and re-checks the observable parts ~15s after load — frame signature
width, transport mode, live opcode table size. A server-side protocol change
shows up as a console warning instead of as packets that quietly stop being
understood.

## Notes

- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.

---

# Ae86 v10

Build output: **`Ae86_Fixed.user.js`**

Ae86 is the same *kind* of thing as Luna: not a userscript that patches the
live bundle, but a fork of the whole moomoo.io bundle that replaces it. Unlike
Luna it is a recent enough fork that its data tables still line up with the
shipped game — hats, accessories, weapons, items and the DOM ids it binds all
match `src/game_index.js` in both content and order. What had rotted was the
transport and the way the script gets off the ground.

Rather than rewrite the bundle, the fix wraps it. `src/ae86-bootstrap.js`
runs at `document-start`, installs the current transport underneath Ae86's
socket, and hands the untouched bundle its old world back.

## What was broken

### The packet layer

Ae86 speaks the plain 2020 protocol: msgpack `[type, args]` on the wire, with
letter opcodes like `sp`, `33`, `ch`. The shipped game negotiates a per
connection opcode permutation and signs every client frame:

| | Ae86 v10 | current game |
|---|---|---|
| c2s frame | `msgpack([type, args])` | 6 HMAC bytes + `msgpack([opcode, args, seq])` |
| c2s opcode | `"sp"`, `"33"`, `"ch"` … | a number, permuted per connection from the io-init seed |
| s2c opcode | the same letters | a number, from a separately seeded permutation |
| `io-init` | reads `args[0]` and drops the rest | `[socketId, seed, key, mode]`, all four used |
| ready signal | fires on `onopen` | fires on `io-init` |

Every one of those is wrong for the live server. Numeric s2c opcodes hit
`handlers[type]` as `undefined`; unsigned c2s frames are rejected; and firing
ready on `onopen` means the client would send its spawn before it had a table
to encode it with.

The shim sits on `WebSocket` and translates both directions. It builds the
tables with the game's own seeded shuffle, signs with the game's own truncated
HMAC-SHA256, and holds the `open` event back until `io-init` lands — which is
exactly when the shipped game calls its own ready callback.

**The opcode sets still correspond one-to-one.** Both alphabets are the same
size as Ae86's (17 c2s, 36 s2c), the handler registration order is unchanged,
and every handler's arity matches position for position. The names were
rotated; the protocol was not. So the translation is a pair of static maps
rather than a rewrite:

| Ae86 | now | | Ae86 | now |
|---|---|---|---|---|
| `sp` spawn | `M` | | `id` init | `A` |
| `2` aim | `D` | | `1` setup game | `C` |
| `33` move | `9` | | `2` add player | `D` |
| `c` attack | `F` | | `33` update players | `a` |
| `5` select item | `z` | | `6` load object | `H` |
| `6` upgrade | `H` | | `7` gather anim | `K` |
| `13c` store | `c` | | `18` add projectile | `X` |
| `ch` chat | `6` | | `t` show text | `8` |
| `14` ping map | `S` | | `pp` ping reply | `0` |
| `pp` ping | `0` | | … 36 in total | |

### Entry

Four separate things stopped the script from ever reaching a socket.

- **The stock bundle.** Ae86 replaces the game, but as a userscript it loads
  *alongside* it. Two clients then bind the same DOM ids and open two sockets.
  The bootstrap blocks the shipped module entry before it executes — which
  also means the game's userscript-manager detector never runs.
- **The server list.** Ae86 reads a global `vultr` that the old page inlined,
  and refreshes it from `/serverData`. Neither exists now; the list moved to
  `https://api.moomoo.io/servers?v=1.27`. The bootstrap fetches it, seeds
  `window.vultr` before the bundle starts, and answers the `/serverData` XHR.
- **The region table.** Ae86's `regionInfo` is keyed by old Vultr ids
  (`vultr:9`); the API now returns names (`eu-west`). `regionInfo[region].name`
  threw inside the connect callback and killed everything after it, including
  the enter-game binding. The bootstrap maps names back onto Ae86's keys,
  pairing them by the latitude/longitude the two tables share.
- **The challenge token.** Ae86 will not connect until
  `window.grecaptcha.execute()` resolves, and the live site dropped reCAPTCHA
  for Cloudflare Turnstile. A stub is not enough — the server *requires* a
  token. `Fi()` in the shipped bundle only connects when one is present:

  ```js
  Sa || pi ? ue && Lt("cf:" + ue) : ue ? Lt("cf:" + ue) : Lt()
  ```

  `Sa` is true off localhost, so in production the whole call is guarded on
  `ue`, the Turnstile token, and the socket is opened with
  `?token=cf:<token>`. Connecting without one is closed with code 4001.

  So the bootstrap runs the real challenge: it loads Cloudflare's
  `api.js?render=explicit`, renders the widget with the sitekey the bundle
  carries, and holds Ae86's `grecaptcha.execute()` promise open until the
  token arrives — which is exactly the point Ae86 already waits at. The token
  is then appended to the socket URL in the game's own `cf:` form.

Addresses are rebuilt from the live list with the game's own
`key.region.moomoo.io` formula, so Ae86's old `ip-…` and port handling no
longer decides where the socket goes.

## Build

```sh
node tools/build-ae86.js       # src/Ae86_v10.js -> Ae86_Fixed.user.js
```

The bundle is copied through byte for byte inside a wrapper function; nothing
in the 12 MB of obfuscated client is edited. The build fails if the input's
metadata block, its `io-client`, `app` or `msgpack-lite` modules, or the
bootstrap's protocol constants stop matching `drivers/game-drivers.json`.

## Verification

```sh
node --check Ae86_Fixed.user.js
node tools/verify-ae86.js
node tools/smoke-ae86.js       # needs: npm i --no-save playwright
```

`verify-ae86.js` pulls the real transport out of `src/game_index.js` and the
real codec out of `src/game_vendor.js` and checks the shim against them: the
permuted tables for ten seeds, the truncated HMAC for two key sizes across
payload lengths 0–196, and msgpack agreement in both directions over a corpus
covering every wire type the protocol uses. It also checks both opcode maps are
total and one-to-one against the alphabets in `drivers/game-drivers.json`.

`smoke-ae86.js` runs the built script in Chromium against a mock server that
speaks the current protocol — permuted opcodes, signed frames and all. It
asserts the stock bundle stays blocked, the socket URL carries the `cf:`
token, the client completes the `io-init` handshake, its spawn arrives as a
correctly signed and sequenced `M` with the current payload shape, and that it
decodes and renders replies on `0` and `Z`.

Both pass on the current build.

## Diagnosing a live failure

The build logs each stage to the console under `[Ae86]` — the blocked stock
bundle, the server count, the Turnstile token, the socket URL and whether it
carried a token, the `io-init` mode and opcode counts, and the close code on
any disconnect. A refusal is called out explicitly:

```
[Ae86] server refused the connection (4001) — the turnstile token was
missing, stale or rejected
```

`window.Ae86Net.status` holds the same information as an object, and
`window.Ae86Net.servers()` / `.token()` expose what the shim resolved.

Two failures are worth naming because they are environmental rather than
bugs in the build:

- **Turnstile is blocked.** Ad and tracker blockers commonly block
  `challenges.cloudflare.com`. Without it there is no token and the server
  refuses the socket. The bootstrap warns when the API script fails to load.
- **No stock bundle was blocked.** If the shipped page changes its entry path,
  the blocker misses it, both clients load, and they fight over the same DOM
  and open two sockets. The bootstrap warns on `load` when it blocked nothing.

---

# External Client — player counter

`src/ExternalClient_Dev2.js` pings a webhook.site URL the first time a person
spawns into a game with it. **One request = one person**, so the request count
on your webhook.site page is the number of people who played.

## Setting it up

1. Open **webhook.site**. It hands you a URL the moment the page loads:
   `https://webhook.site/8f2b41d9-7ce0-...`
2. Copy it into `WEBHOOK` at the top of the `EXP_STATS` block in
   `src/ExternalClient_Dev2.js`.
3. Install the script.

While `WEBHOOK` is empty the block is inert and nothing is ever sent.

## Reading the count

Leave the webhook.site tab open and requests appear live. For the exact
number without counting rows, open:

```
https://webhook.site/token/<your-id>/requests?per_page=1
```

`<your-id>` is the part after `webhook.site/` in your URL. The response is
JSON and its `total` field is your player count.

Each request looks like this, so the list is readable at a glance:

```
?player=a3f9c2e1&v=Dev-2&d=2026-08-04
```

| Setting | What it does |
|---|---|
| `WEBHOOK` | your webhook.site URL |
| `HOW_OFTEN` | `"ever"` — one request per person, ever. `"daily"` — one per person per day, i.e. daily actives |
| `SPREAD_MS` | how far first spawns are scattered in time |

Console helpers: `EXP_STATS.disable()` opts out for good, `.enable()` undoes
it, `.reset()` makes this browser count again.

## What it sends

A random id from the browser's own `localStorage`, the client version and the
date, in the query string. Nothing else — no names, no chat, no game state.
The id exists so one person is not counted twice, and never leaves that
browser except as that one line.

Delivery is only recorded once the request actually lands, so a player whose
ping fails is counted on their next spawn rather than lost. A blocked
cross-origin request falls back to a `no-cors` send, which still arrives.

## The limit to watch

**webhook.site's free tier keeps only a bounded number of recent requests and
drops the URL after about a week of inactivity.** Check their current limits
before you rely on the number. This matters for exactly one reason: once you
pass the cap, `total` stops being your all-time player count and becomes a
rolling window over the most recent requests. Under the cap it is exact.

Ad blockers also block requests to `webhook.site` for some users. Read the
number as a floor, not a headcount.

## If you outgrow it

`tools/stats-worker/` holds a Cloudflare Worker on D1 that counts without a
cap, answers "online now", and posts a daily summary to Discord from a
server-side secret. Its README is a full walkthrough. Nothing in the client
depends on it — swapping is a change to one block.

## Stripping comments

`src/ExternalClient_Dev2.js` ships without comments. To redo that after
editing it:

```sh
npm i --no-save @babel/parser
node tools/strip-comments.js src/ExternalClient_Dev2.js
```

The `==UserScript==` block is kept — it is the header the script manager
reads, not documentation.

Comment ranges come from a real parser rather than a regular expression, so a
`//` inside a string, a URL or a regex literal survives. Everything outside
those ranges is copied byte for byte, so nothing is reindented or reflowed and
the diff shows only removed lines. Lines that held nothing but a comment are
dropped rather than left blank.

The check that matters: tokenising the file before and after gives the same
78,916 tokens in the same order, which is what proves only comments went.
