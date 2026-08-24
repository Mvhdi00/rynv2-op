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

# YoRHa System (Falcon Replace) — Nova Boost

`YoRHa_System_replace_falcon.user.js` is a second, separate userscript in this
repo: the YoRHa build with the Falcon-derived Replace. It carries one addition
on top of the file it came from, **Nova Boost** — the three preplacer ideas
worth taking from the Novastorm client, rebuilt on inputs that are actually
measured.

Placers → Preplacer → **Nova Boost (2 spikes + path test)**. Off by default;
with it off every code path below reduces to the constants the file already had.

| | What it does |
|---|---|
| Speed-scaled lookahead | The LOS lookahead grows with how fast the enemy is moving (200 → 300) instead of sitting at a flat 222. Shared with the autoplacer so both agree on what counts as blocked. |
| Enemy-path test | Asks whether a footprint stands on the ground the enemy is running through. A **trap** there earns the slot — they walk into it. A **spike** there loses it while they are trapped — it walls off the hit you are lining up. |
| Second spike | One preplace can queue two spikes when their angles are more than 1.2 rad apart, so the pair covers two approach lines instead of stacking on one. |

### Why it is not a straight copy

Novastorm computes enemy speed as `sqrt(xVel² + yVel²)`. In this codebase
`objectManager` writes `xVel = x2 * 2 - lastX` — next tick's **position**, not a
velocity, which is how every other reader in the file treats it. So that
expression is the length of a map coordinate, some thousands of units:
`200 + min(speed * 10, 100)` is pinned at its 300 cap forever, `speed > 1` is
always true, and `x2 + xVel * 2` lands about 3× off a 14400-unit map, pointing
away from the origin rather than along the enemy's path.

Nova Boost measures the per-tick step as the distance between `(x2, y2)` and
`(xVel, yVel)` instead, and steps two ticks from the enemy's own position for
the path ray. The second-spike separation test uses `UTILS.getAngleDist`, the
wrapped distance, rather than Novastorm's raw subtraction — which reads 0.1 and
6.1 rad as 6.0 apart when they are 0.28 apart. The pair is budgeted against the
same 119-packet ceiling the replacer respects.

`node tools/test-nova-boost.js` lifts the two helpers out of the userscript and
checks all of the above, including that the boost-off path is unchanged.

## Added on top of the YoRHa build

Three groups, all off by default, all built on machinery the file already had.

### Manual Insta — Combat → Instakills, key in Keybinds → Combat Keys

Every insta in YoRHa is situational: `canTrapTick()`, `canSmartTick()`,
`canVelocitySpikeTick()`, `doSmartTickAnti()` and the ally-damage sync each
assign a token list to `instaKill`, and the executor spends one token per tick.
There was no way to simply ask for one. The key writes the same lists through
the same executor, so aim, tail handling and reload checks are unchanged.

| Combo | Tokens |
|---|---|
| Ranged → Melee | `secondary, primary, stop` |
| Turret → Melee | `turret, primary, stop` |
| Turret Hat + Primary | `primaryturret, stop` |
| Ranged → Melee → Turret | `secondary, primary, turret, stop` |

A press is refused while a combo is in flight (overwriting `instaKill` mid-list
strands `insta.primary`/`insta.secondary` with no token left to clear them), and
refused when the first token cannot fire — a cold secondary, a missing turret
hat, no enemy.

### Overlays — Utilities → Overlays

- **Reload Bars.** `primaryReload` / `secondaryReload` / `turretReload` are
  already kept per sid for every visible player; the mod reads them for its own
  instas and throws them away. Drawn under the health bar: the weapon they are
  actually holding (`weaponIndex < 9` is a primary, the same split
  `doWeaponStuff` uses), plus a turret bar only while the turret is down.
- **Item HP Bars.** The existing 300-unit health *ring* is drawn on every item,
  whole or not. This trades it for reach and readability — a bar under every
  **damaged** item on screen, owner-coloured. The two never draw together.

Neither sends anything. They are paint over state the client already holds.

### Utilities — Auto-accept Clan Requests, Spectate on Death

- **Auto-accept** answers with the same call the green tick makes, and drains
  the whole pending queue rather than the newest request, so anyone who asked
  while the menu was shut is not stranded. The drain is capped at 32 — it runs
  inside the packet handler, where a future `aJoinReq` that failed to splice
  would hang the game.
- **Spectate on Death** replaces the respawn menu with one of two views, best
  first: a **living bot's eyes**, which is a live world because that bot's own
  socket is still being fed (possession already switches the render source, the
  lists, the HUD and the camera, so this is only the request at the right
  moment); or, with no bot to borrow, a **free ghost camera** over your last
  known map — WASD pans it, a translucent you marks the spot. The server sends a
  dead player nothing, so the ghost view is a still map walked over, not a live
  one. That is the honest limit; it still shows you what killed you and where
  their base was. Up leaves either view and brings the respawn menu back.

  Both ghost input branches sit **ahead of** the `myPlayer && myPlayer.alive`
  gate that wraps the keydown and keyup bodies — behind it the camera would not
  move and Up would not release, stranding you over a dead map with no menu. The
  ghost also keeps its own key map rather than the game's `keys`, which stops
  recording at death and would otherwise carry a held key into your respawn.

### A fix to an older key

`keyPacketSpam` defaulted to `"B"` — the same key as `keyAutoMills`, which is
tested first in the keydown chain, so Packet Spam never fired for anyone who did
not rebind it. Default is now `"L"`. Saved settings keep whatever you chose.

Manual Insta is likewise tested *ahead* of the vanilla hardcoded keys (E, C, X,
R, Q, Space, the number row). Those are matched by raw `keyNum`, so a rebind
onto one of them would be swallowed before the chain reached any `keyStr` test.
Its default is `Y`, which is not one of them.

`node tools/test-yorha-additions.js` covers all of it — 78 checks over the
lifted combo logic, the clan-queue drain, the spectate seat, the ghost camera,
the keybind-chain ordering, and the render guards.
