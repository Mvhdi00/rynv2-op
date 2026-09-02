# ReUp Mix (Luna × Ryn)

moomoo.io userscripts built from the clients in `src/` against the game bundles
in `src/`, and verified against them.

Two build targets:

| Output | Base | What it adds |
|---|---|---|
| **`ReUp_Mix.user.js`** | `src/RYN_Client_v4.js` | the Luna Client features RYN v4 never had |
| **`RYN_GapFill.user.js`** | `src/RYN_Client_v5.js` | trap enclosure gap fill on the Ryn Placement Engine |

Most of this file is about the first. The second is at the end:
[RYN v5 + trap enclosure gap fill](#ryn-v5--trap-enclosure-gap-fill).

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
ReUp_Mix.user.js          build output — the Luna x Ryn v4 mix
RYN_GapFill.user.js       build output — RYN v5.4 + trap enclosure gap fill
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client for ReUp Mix (input)
src/RYN_Client_v5.js      base client for the gap-fill build (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/check-gapfill.js    the built gap-fill layer vs. synthetic trap layouts
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-gapfill.js    src/RYN_Client_v5.js -> RYN_GapFill.user.js
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

# RYN v5 + trap enclosure gap fill

Build output: **`RYN_GapFill.user.js`**, from `src/RYN_Client_v5.js` (RYN Client
v5.4 + Auto Heal Engine) with one feature added.

```sh
node tools/build-gapfill.js        # produce RYN_GapFill.user.js
```

## The feature

When the locked target is boxed in, the placement engine works out which way
out they are leaving by and seals it.

Two switches in Combat → Spikes & Traps: **Trap Gap Fill** (on) and **Gap Fill
Trap Break** (off). Gap fill rides the Preplace pass, so it needs Preplace on.

## Why it is not another placer

v5 already has the Ryn Placement Engine, and the feature is a layer on it
rather than a system beside it. Everything it needs was already there:

| It needs | v5 already has |
|---|---|
| a target | `ThreatAnalyzer` → `frame.target`, i.e. `EnemyManager.nearestEnemy` — the one preplace, replace and the aim already follow |
| geometry | `GeometrySolver.occlusion / merge / invert`, the solver the engine uses for its own placement ring |
| prediction | `TargetMotion` — measured velocity, acceleration and confidence, not a second guess |
| anti-duplicate | `PlacementLedger`, `PreplaceBook`, `PlacementMemory` — what already stops two placements taking one slot |
| execution | `PlacementScheduler` → `PlacementPlanner` → validate → `PlacementExecutor`, with its packet budget and batching |

So the layer adds three things and nothing else: it measures the target's
escape ring, it proposes a few angles aimed at the opening, and it prices
"closes that opening" as one more scoring term.

**Enclosure.** The target's escape ring is one short step outside their body,
measured with the same occlusion the engine measures its placement ring with:
every blocker removes an arc, `merge` unions them, `invert` hands back the ways
out. What blocks is the game's own rule (`PlayerManager.canMoveOnTop`):
resources always, an `ignoreCollision` building never, and a trap only for
whoever its owner counts as an enemy — ownership from
`PlayerManager.isEnemyByID`, never guessed from position. So the target's own
trap does not hold them, mine does, and a ring with a hole reads as enclosed
while three traps on one side does not. Boxed in means 55% of the ring closed
with at most three ways out, or 35% once something is actually holding them.
The sweep is the blocker list the engine already built this tick, so it costs
arithmetic over a list rather than a second query.

**Escape route.** The measured heading while they are moving, away from us when
they are not, which is where a cornered player goes. The opening that best
matches — and is narrow enough to be worth sealing and near enough to reach —
is the one the layer plays for.

**Candidates.** Straight at the mouth of that opening snapped onto legal
ground, the two angles where our footprint just touches it, and the edges of
the aperture it falls in. They carry mode PREPLACE like everything else the
tick generates, so they are booked, held, planned, validated, budgeted and sent
by the pipeline that was already there.

**Scoring.** One more weighted term — the share of the opening the build takes
away, more again when nothing walkable is left, more still when it sits on the
route they are actually taking. Because scoring is central, this prices gap
sealing on *every* candidate the engine has, not only the ones the layer
proposes; and because a seal is worth more than a clip, a spike slightly
farther out that closes the way out beats a nearer one that only narrows it.

**Spike ticks.** The layer proposes nothing on a tick a spike-tick module owns
(`lunaSpikeTickBusy`), rather than competing for the same packets.

**Gap Fill Trap Break** is the one action that is not a placement. A trap of
mine denies a spike the fifty units of placement scale around it, so the trap
parked on the opening is often the reason nothing can be placed there. The
engine measures the best gap fill available with and without that trap; if
removing it buys a materially better spike, **Autobreak** — which already owns
breaking things, and already runs with the reload, range and one-hit checks a
swing needs — takes it out. Never the trap holding the target, never one that
is not on the side they are leaving by, never someone else's, and never a
half-break: one swing or none.

Switched off, the enclosure is not measured at all, so nothing downstream can
price a gap the feature is not supposed to be looking at.

## Verification

```sh
node tools/verify-drivers.js RYN_GapFill.user.js
node tools/check-hooks.js RYN_GapFill.user.js   # needs: npm i --no-save terser
node tools/check-gapfill.js RYN_GapFill.user.js
node --check RYN_GapFill.user.js
```

Current state of that build:

- **Drivers** — hats, accessories, weapons, items, item groups and 42 scalar
  config keys all match `src/game_index.js`.
- **Hooks** — 41/41 bundle-rewrite hooks bind.
- **Gap fill** — 43 checks. `check-gapfill.js` lifts the real code out of the
  built script — `GeometrySolver` with its two new arc helpers,
  `rpeGapCoverage`, `rpeBuildProfile`, `PlacementMemory`, `CandidateGenerator`
  and the engine's own gap-fill methods — and runs it against synthetic
  layouts, so what is tested is what ships: arc arithmetic, enclosure
  detection and its negative cases, ownership, pinning, escape direction,
  coverage and sealing, candidate shape, the spike-tick and toggle gates, and
  every gate on the trap break.

## Note

`src/RYN_Client_v5.js` is the client as it was handed over, feature aside. It
still opens with RYN's first-run `fetch` to a `webhook.site` endpoint, gated by
a `localStorage` flag — the ReUp build strips that, this one does not, because
nothing was asked of the rest of the file.
