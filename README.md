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

# Ryn Type 2 — 200-angle auto place, ping-aware predictive preplace

`Ryn_Type_2.user.js` is a separate client from the ReUp Mix build above. It is
checked in here so the placement work below has a reviewable diff; nothing in
`tools/build-reup.js` reads it, and `ReUp_Mix.user.js` is unaffected.

## Auto place: 144 → 200 angles

The placer resolution setting's top rung moved from 144 to 200. The point is
not the count, it is where the extra samples land.

A uniform table of *n* samples is `{ k·2π/n }`, and two such tables share
exactly `gcd(a, b)` angles. `gcd(144, 200) = 8`, so only 8 of the 200 samples
coincide with the old table — the eight 45° apart. The other 192 are ground the
144-table never looked at. Counted the other way: of the 144 intervals the old
table cut the ring into, **96 receive one new interior sample and 48 receive
two**. Every interval is subdivided; none is left as it was.

Measured against the game's own tables (`drivers/game-drivers.json`: spikes
scale 49, pit trap scale 50, both `placeOffset -5`, `playerScale 35`, so the
spike ring is 79 units out):

| steps | spacing | arc at the spike ring | worst-case miss |
|------:|--------:|----------------------:|----------------:|
| 36 | 10.0° | 13.788 u | 6.894 u |
| 72 | 5.0° | 6.894 u | 3.447 u |
| 144 | 2.5° | 3.447 u | 1.724 u |
| **200** | **1.8°** | **2.482 u** | **1.241 u** |

Both cut by 28%. No duplicates: the minimum separation inside the table is the
step itself, 2.482 u at the ring. A placed spike removes 153.3° of the spike
ring and a placed trap 154.7° of the trap ring, so the narrowest arc a spike
can stand in is 76.7° wide — 30.7 samples at 144, 42.6 at 200.

## One angle generator

`RingScan` is the scan table lifted out of `AutoPlacer` so the engine's
predictive side reads the same lattice. Preplace and replace used to pick a
direction with `GeometrySolver.nearestFree`, which returns an arbitrary real —
so auto place named a slot by sample index and preplace named the same ground
by a float that was never one of those samples. `RingScan.snap` takes the
analytic answer and moves it to the nearest sample still inside the same
aperture, bounded at five aperture tests. Aperture **edges** stay analytic:
an edge is the exact packed placement, which is what `perfect` in the sampled
table approximates.

## Ping-aware predictive preplace

`SocketManager.pong` is already measured. At 70–120 ms against a 111.11 ms tick
that is one tick of round trip, and it is spent on *lead*, never on packet rate:

- prediction horizon and interception lead extended by the round trip;
- `PlacementScheduler.due` brings every predictive deadline forward by it;
- book records reserve their ground for that much longer.

`_breakPressure` drives preparation intensity on a 0–1 scale. Health alone is
the wrong driver — a 500-health trap at 50% is five swings from a great hammer
and ten from a tool hammer — so the driver is `StealForecast`'s ticks-to-break
(which already folds health, every actor's next swing, observed damage rate and
cadence), with the health fraction as a floor for a build with no observed
history. It sets booking confidence, reservation TTL, and the retrap resend
count, which ramps 0 → 1 → 2 → 4 at the default setting instead of a fixed
ladder.

Escape denial is scored: `_escapeContext` solves the line out of a containment
that is about to break, and candidates are paid for taking the opening or
standing across that line, and penalised for doing neither during a break.
The predictive buffer is capped at one primary and one fallback per dying
object (`RPE_PREPLACE_PER_OBJECT`), six pending records in total.

## Performance

The 200-angle table costs no trigonometry and no allocation per tick:
`RingScan` precomputes sin/cos per step count for the life of the page, and
`_getPrePlaceAngles` mutates a pooled row array instead of building 400 objects
a tick. Beyond that: an exact early rejection in `_bestPrimaryKbSpike`,
cheapest-test-first ordering in `_sectorPick`, a single-pass `_closestToEnemy`
(no filter/sort), three fewer whole-table arrays per tick in the ladder, and a
state-change early-out that skips the scan when nothing that could change the
answer has moved and the previous pass produced nothing.

## Verification

```sh
node --check Ryn_Type_2.user.js
node tools/verify-drivers.js Ryn_Type_2.user.js   # data tables vs. the bundle
node tools/check-hooks.js Ryn_Type_2.user.js      # needs: npm i --no-save terser
```

Current state: driver tables match `src/game_index.js`, and 52/52
bundle-rewrite hooks bind.
