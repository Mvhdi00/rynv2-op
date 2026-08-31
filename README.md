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

### Knockback Strike (replaces Trap KB)

Combat → Spikes & Traps, as two switches: **KB Strike (spike)** and **KB Strike
(trap)**. Each hits when the recoil from that hit would carry the target onto
one of your own spikes (or cactus) / pit traps.

They are independent. Turning one off leaves the other running — neither is a
master for the other.

This removes RYN's `TrapKB` module and the `EnemyManager` scan behind it
(`nearestKBTrapEnemy` / `nearestKBTrap`). TrapKB asked, once per pit trap,
whether the trap fell inside a cone drawn from the player through the target
and whether the target was within `getActualMaxKnockback` of it:

- A cone anchored at the player widens with distance, so a trap well behind the
  target passed while a spike just off the push axis failed.
- The range gate spent a knockback budget with the secondary and the turret
  already folded in, whether or not either was firing that tick.
- It only ever looked at pit traps.

The push is a radial impulse along me → them, so the replacement walks that
segment instead: travel is the weapon's own `knockback` figure from the item
table (plus the turret's 33.3 only on a tick the turret fires), each hazard is
tested by closest approach to the segment, and the target is chosen by what
landing there is worth rather than by proximity.

`node tools/check-kb-strike.js` lifts the class out of a build and runs it
against synthetic scenes — 36 cases, including both switches in isolation.

### Spike tick fires on its own switch

The spike-tick modules placed nothing unless preplace happened to be on.
`SpikeTickController` is a timing layer over the placement engine, and two
pieces of engine state it leans on only exist while the engine is planning —
which it only does when `_prePlace` is set:

- **The ledger never expired.** `RynPlacementEngine.postTick` returns early
  when no mode is enabled, and the ledger's only `expire()` call sat below that
  return. Every `place()` in the client reserves ground through
  `ModuleHandler._notePlacement`, so with preplace off those hard reservations
  outlived their 2-tick ttl forever and the ledger answered "taken" to
  everything. The controller read that as `blocked`.
- **Directed intents were born expired.** `intentAt` stamped from
  `this._threat.frame`, which is only built during a cycle. With no frame the
  stamp writes `createdTick: 0`, putting the intent past
  `RPE_INTENT_LIFETIME` — so from tick 7 onward the controller rejected its own
  freshly made intent as `expired`, replanned twice, and cancelled.

Driving the real controller: stock places a spike at ticks 2 and 5 and then
never again. Fixed, it places at every tick from 2 to 5000.

Neither edit changes how preplace or replace decide anything. Expiring the
ledger is housekeeping the engine already meant to do every tick, and `intentAt`
has exactly one caller — the spike tick controller. `cycle`, `_validAt`,
`requestMany`, `commitIntent`, `PreplaceBook`, `onVacated`, `_generatePreplace`
and `_generateReplace` are byte-identical to stock.

`node tools/check-spike-tick.js` binds the real `intentAt` into a stub engine,
drives the real `SpikeTickController`, and checks the ledger ordering in the
source — 6 cases. Run it against `src/RYN_Client_v5.4.js` to see both faults.

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
src/RYN_Client_v4.js      base client for ReUp_Mix (input)
src/RYN_Client_v5.4.js    base client for the v5.4 build (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/check-kb-strike.js  KnockbackStrike geometry vs. synthetic scenes
tools/check-spike-tick.js SpikeTickController vs. a stub engine
tools/lib/extract.js      brace-matching class extractor used by both checks
tools/anchors/            exact anchor text for the v5.4 build
tools/modules/            replacement module bodies
tools/build-reup.js       src/RYN_Client_v4.js  -> ReUp_Mix.user.js
tools/build-v54.js        src/RYN_Client_v5.4.js -> RYN_Client_v5.4_ReUp.user.js
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js       (from v4)
node tools/build-v54.js          # produce RYN_Client_v5.4_ReUp.user.js
```

Two bases, two builds. `ReUp_Mix.user.js` is the v4 core with the Luna
features folded in. `RYN_Client_v5.4_ReUp.user.js` is RYN v5.4 with only the
changes below applied. Nothing else in v5.4 is touched: same header, same
automill, same everything.

| | ReUp_Mix (v4) | v5.4 build |
|---|---|---|
| **Trap KB → Knockback Strike** | **done** | **done** |
| **Spike tick without preplace** | n/a | **fixed** |
| Luna features | ported | not ported |
| Everything else | as in v4 | untouched from stock v5.4 |

Every edit in `build-reup.js` is anchored to an exact string in the base
client, and an anchor that is missing or ambiguous fails the build. Dropping in
a newer RYN will surface as a build error rather than a half-merged script.

## Verification

```sh
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node tools/check-kb-strike.js ReUp_Mix.user.js
node tools/check-spike-tick.js RYN_Client_v5.4_ReUp.user.js
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
- **KB Strike** — 36/36 geometry cases pass: travel figures, segment distance,
  the three cone-test regressions, ownership, item kinds, chaining, and the
  `postTick` gates.

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
- `_knockbackStrike` and `_knockbackStrikeTrap` default **on** and take
  `_trapKB`'s place in the default-on preset. `_trapKB` no longer exists, so a
  saved profile carrying it is simply ignored.
