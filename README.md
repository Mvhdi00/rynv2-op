# RYN

moomoo.io userscripts built against the game bundles in `src/` and verified
against them.

| Script | What it is |
|---|---|
| **`Ryn_Type_2.user.js`** | The current client. Ryn Type 2 v3.0 by Raptor, with the placement subsystem rebuilt — see [The placement engine](#the-placement-engine). |
| `ReUp_Mix.user.js` | The earlier build: RYN Client v4 with the Luna Client features folded in. Kept because it is a different lineage, not a superseded version of the same one. |

---

## The placement engine

Auto place, preplace, replace, spam pre-placement and retrap are five tactical
objectives on **one** placement core in `Ryn_Type_2.user.js`. They share the
geometry, the prediction, the clock, the occupancy model, the candidate
generator, the scorer, the reservation ledger, the packet budget, the refusal
memory and the executor. None of them looks at the world on its own and none of
them reaches the socket on its own.

```
                         PLACEMENT CORE
  ┌────────────┬───────────────┬──────────────┬──────────────────┐
  │  Geometry  │  Prediction   │    Timing    │    Occupancy     │
  │ apertures, │ TargetMotion, │ LatencyModel │ ObjectManager,   │
  │ wire grid  │ StealForecast │ + jitter     │ PhantomTraps,    │
  │            │               │              │ PlacementRefusals│
  └────────────┴───────────────┴──────────────┴──────────────────┘
                              │
                     AngleSolver  (exact → binned sweep → bisection)
                              │
                     PlacementScorer   (one weighted sum)
                              │
             ConflictResolver → PlacementPlanner (beam search)
                              │
                     PlacementExecutor  (the only send path)
                              │
   ┌──────────┬───────────┬──────────┬──────────────┬────────────┐
   AUTO     PREPLACE    REPLACE    SPAM PREPLACE   RETRAP
```

### What the game actually allows

Every constant comes out of `src/game_index.js`, and
`tools/verify-placement.js` prints them next to the engine's own so the two can
be read against each other rather than against a comment.

| Quantity | Game source | Value |
|---|---|---|
| Where a build lands | `Player.buildItem` | `playerScale + item.scale + item.placeOffset` |
| What denies a build | `ObjectManager.checkItemLocation` | `item.scale + (obj.blocker ?? obj.getScale(0.6, isItem))`, plus the river band unless the item is the platform (id 18) |
| What the collision uses instead | `ObjectManager.checkCollision` | `playerScale + obj.scale * obj.colDiv` — so a pit trap pins at 45, not at its 50 scale |
| Knockback travel | impulse 1.5, then `xVel *= pow(0.993, f)` once per tick | `1.5 * f / (1 - 0.993^f)` = 307.6 units at `f` = 111.11ms |
| Tick | `config.serverUpdateRate` 9 | 111.11ms |
| **Angle quantum** | `fixTo(atan2(sin, cos), 2)` in the game's own build path | **0.01 rad — 628 distinct placement directions, and no more** |

Players and animals are *not* in `checkItemLocation`, so they never deny a
placement. Enemy pit traps are, and carry `hideFromEnemy`, so they deny
placements the client cannot see — which is what `PhantomTraps` exists for.

### The angle system

The wire quantum is the ceiling on everything: two directions less than 0.01 rad
apart are the same build, so a step count above 628 enumerates nothing and a
solved angle that is not quantised is not the angle that gets sent.

Candidates come from three stages, all in wire-exact angles:

1. **Exact** — aperture edges (the tightest legal pack against a neighbour),
   tangency angles where the footprint just touches the target, intent
   directions, exit-sealing directions, both ends of the knockback chain, and
   the direction that denies the most of the target's own placement ring. None
   of these is findable by sampling; all of them are where the score changes
   sharply.
2. **Binned sweep**, anchored on the direction to the target. The arc facing the
   fight is *enumerated* at the quantum — there is nothing finer — and binned two
   slots wide. The rest of the ring is swept at the resolution setting and binned
   ten ways. One candidate per bin, so the spacing between chosen candidates
   cannot exceed one bin however the ranking falls. Bins overlap by a quarter of
   their width, so a candidate on a boundary is offered by both sides.
3. **Bisection** down to the quantum, around the far-tier and exact seeds.

Measured over 4,000 generated fight boards (`tools/test-placement.js`), at the
spike ring:

| Coarse setting | Candidates | Finest spacing | Widest gap, near arc | Widest gap, far arc |
|---|---|---|---|---|
| 36 | 54.9 | 0.82u | 2.6u | 42.1u |
| 72 | 50.5 | 0.82u | 2.6u | 69.8u |
| 144 | 46.4 | 0.82u | 2.6u | 76.1u |
| 200 | 43.1 | 0.84u | 2.6u | 80.0u |
| *flat 200-step table* | *88.1* | *2.48u* | *2.48u* | *2.48u* |

So against the table it replaces: three times the resolution where the score
can change, the same coverage of the arc that matters at *half* the candidate
count, the exact boundary angles no uniform table contains — and the near arc's
coverage no longer depends on the setting at all. The setting decides the far
tier and nothing else, which is why raising it from 144 to 200 was never going
to be the answer.

### Verification

`tools/test-placement.js` lifts `GeometrySolver`, `RingScan`, `AngleSolver`,
`LatencyModel`, `PlacementRefusals`, `PhantomTraps` and `PlacementLedger`
straight out of the client and runs them — no mocks of the engine. 130 checks,
including the analytic aperture solve against a brute-force sampled reference at
3,600 samples per ring over 3,000 boards (10.8M points, zero disagreements) and
the wire quantum against the client's own `wireAngle`.

---

## ReUp Mix (Luna × Ryn)

The rest of this file is about the other script in the repo: `ReUp_Mix.user.js`,
the RYN Client v4 core with the Luna Client features folded in. It is a separate
lineage from Ryn Type 2 above, not an older version of it.

### Why RYN is the base

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

### What the mix changes

#### Ported from Luna

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

#### The placer

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

#### Driver correction

`ItemGroups[8]` — the platform group — carried `layer: -1` in RYN. The shipped
bundle has `layer: 1`.

That value is not cosmetic: `PlayerObject` reads `ItemGroups[itemGroup].layer`
straight into its own `.layer`, which the collision and placement paths key
off, so a platform was being treated as a pass-under layer like traps and boost
pads. Corrected to `1`.

This was the only mismatch across item groups, weapons, items, hats,
accessories, and config — see [Verification](#verification-1).

#### Removed

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
Ryn_Type_2.user.js        the current client — this is the script to install
ReUp_Mix.user.js          the earlier build, from src/RYN_Client_v4.js
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client for ReUp Mix (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/verify-placement.js the item fields the placement geometry is made of
tools/test-placement.js   the placement geometry, run against brute force
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
node --check                   Ryn_Type_2.user.js
node tools/verify-drivers.js   Ryn_Type_2.user.js
node tools/verify-placement.js Ryn_Type_2.user.js
node tools/test-placement.js   Ryn_Type_2.user.js
node tools/check-hooks.js      Ryn_Type_2.user.js   # needs: npm i --no-save terser
```

The same four run against `ReUp_Mix.user.js`.

Current state:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Placement fields** — every item field the placement geometry reads
  (`scale`, `placeOffset`, `colDiv`, `blocker`, `health`, `dmg`, `pDmg`,
  `trap`, `ignoreCollision`, `hideFromEnemy`, and the rest) matches the shipped
  bundle. `verify-drivers.js` does not compare these; the four the geometry is
  entirely made of were never checked before.
- **Placement geometry** — 130 checks, all passing. See
  [Verification](#verification) under the placement engine.
- **Hooks** — 52/52 bundle-rewrite hooks bind in Ryn Type 2, 36/36 in ReUp Mix.

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
