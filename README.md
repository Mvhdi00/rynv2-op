# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

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

### Login repair

RYN's login was written against an older build of the game. The bundle in
`src/game_index.js` verifies with **Cloudflare Turnstile** and connects with
`Lt("cf:" + token)`; RYN was still solving an **altcha** proof-of-work against
`https://api.moomoo.io/verify` and passing the result as `alt:…`.

Three things were wrong, and each of them on its own stopped the client from
getting into a game:

- **The token was fetched at load and never arrived.** `const gameToken =
  altcha.generate()` ran as the script initialised, against an endpoint the
  current game no longer has. `startGame()` then did `await gameToken`, so it
  threw rather than reaching its own "failed to generate" branch, and
  `_gameInit` was never called. Even a token that did resolve was the wrong
  kind — the server is handed `cf:` tokens.
- **Clicking early killed the menu.** `Fi()` in the bundle latches `ei = !0` on
  its first call and only connects when a Turnstile token already exists, so a
  click before the widget resolves burns the one attempt and every later click
  does nothing. RYN enables `#enterGame` at page load, well before that, which
  made this easy to hit.
- **Bot connections hung silently.** `createSocket` fell back to
  `altcha.generate()`, whose rejection propagated out of the bot-creation
  handler: no bot, no error, and a "Connecting…" row left in the menu forever.

Now: `startGame()` uses the token the game already captured (via the
`captureTurnstile` hook) or renders its own Turnstile widget, and calls
`_gameInit("cf:" + token)` — the same call the bundle makes, with the token
resolved first. The `#enterGame` wrapper routes through that path whenever the
game has no token yet, so `Fi()`'s guard is never burned. The sitekey follows
the bundle's (`1x0000…AA` on localhost, the live key otherwise), a host that
does not require verification connects without a token exactly as `Lt()` does,
and a bot that cannot get a token reports it and rolls the menu back. The
altcha solver and its worker pool are gone.

### Packet repair

- **`pingMap` was a byte short.** It sent `["S"]`; the bundle sends
  `O.send("S", 1)`. Now checked mechanically for every opcode — see
  `verify-packets.js` below.
- **The first packet after `io-init` went out unsigned.** RYN registers its
  message listener from the `WebSocket` construct trap, so it runs *before* the
  bundle's `onmessage` — which is what installs the connection's transport
  state. The ping RYN sent from inside that dispatch therefore went through
  `O.send()` with no state present, i.e. as a plain frame on a connection the
  server expects signed frames on. It now waits a microtask.
- **The transport mode was ignored.** The bundle only permutes opcodes and
  signs frames when the server negotiates mode `Ht`; RYN built the tables from
  whatever `io-init` carried. On a server that negotiated the plain transport,
  every packet the client sent would have been scrambled.
- **…and the client went mute on that same server.** The send path gated on
  crypto state being present rather than on the connection being up, so with no
  crypto to wait for it dropped everything. The gate is now "has `io-init`
  landed"; `gameNet.send` picks the framing itself.
- **A failed send could re-send with a stale sequence number.** If
  `gameNet.send` threw, the owner fell through to the hand-rolled signing path,
  which keeps its own counter — the server has already moved past it. That path
  is now bots-only, which is the only place it was ever correct.
- **Nobody handled `E` (removePlayer).** Players who left were never dropped
  from `playerData`, and the "left the game" chat line hung off `R`
  (`removeAllItems`), which the server also sends on death — so deaths were
  reported as leaves. `E` now removes the player and carries the notice.
- **An unknown id in a tick threw.** `updatePlayer` called `.update()` on a
  `Map` miss, which took the whole tick — every module downstream of it — with
  the exception. It skips instead.

`_gameCrypto` itself was already right: the opcode permutation, the seed
mixing, and the truncated HMAC are a faithful port of the bundle's, verified
byte for byte across nine seeds and four payloads.

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
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/verify-packets.js   client's opcodes + arities vs. the game bundle
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
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
node tools/verify-packets.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node --check ReUp_Mix.user.js
```

Current state of the build:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Packets** — all 17 c2s opcodes the client sends are in the bundle's c2s
  alphabet and carry the same argument count as the bundle's own `O.send()`
  call site; all 30 s2c opcodes it handles are in the s2c alphabet and routed
  by the bundle's handler map. The six the bundle routes and the client does
  not (`8` damage text, `9` map-ping animation, `B` disconnect, `J` AI gather
  animation, `V` item/weapon list, `Z` restart notice) are reported as
  informational — RYN drives its own UI and tracks its own inventory.
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
