# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

---

## Ryn Type 2 — placement engine upgrade

`Ryn_Type_2.user.js` is a separate, newer client (RYN v5.4). It is **not** built
from `src/RYN_Client_v4.js` and is not part of the ReUp Mix build; it carries
its own `RynPlacementEngine`, which the v4 core does not have.

Its Preplace and Replace modes have been upgraded in place. Nothing else in the
file is touched — no new settings, no new UI, no change to target acquisition
(still `EnemyManager.nearestEnemy`), and no change to auto place, spike tick,
combat, or the packet layer. Every edit falls inside the placement engine.

What changed:

| | Before | After |
|---|---|---|
| Preplace angles | one radial direction per lead tick, snapped to the nearest legal edge | the arc that *touches* the predicted position, intersected with the legal ground, resolved to the closest angle in the overlap; plus a full layered solve at the lead the link imposes |
| Candidates per lead | 1, with no duplicate guard — a slow target booked six records for one slot | deduplicated by the item's own angular width, so each is a distinct placement |
| Replace angle | direction of the dead object, snapped — could miss the freed slot, and was appended behind the solver so it skipped the duplicate check | the freed ground as a solver focus, so the build provably covers the slot it is taking back, deduplicated with everything else |
| Angle resolution | ~6 named angles, no fallback when they were all poor | 144-slot lattice, walked outward in priority order, and only when the exact layers come up short |
| Prediction | re-integrated per call — a 6-lead scan integrated 21 steps instead of 6 | integrated once per observation, read many times |
| Acceleration | second difference, taken raw, and carried through manoeuvres | smoothed, and zeroed through a manoeuvre rather than extrapolated into a curve |
| Ping | not used at all | `SocketManager.pong` sets the prediction lead and the firing lead, in ticks |
| Last-moment check | geometry only | geometry, plus target identity and a re-confirmed interception |
| Invalidation | heading drift past a threshold | drift, plus immediate drop on a detected reverse or stop; records that do not depend on the course are exempt |

### Measured

Both engines run side by side on identical inputs, medians of repeated runs on
this machine. `tools/verify-placement.js` covers correctness separately.

**Speed** — full engine tick (90 objects, 4 aperture solves, 6-lead scan + 8
booked records, 2 angle solves): **55 µs → 33 µs, ~1.7× faster**. Prediction
alone ~1.8× faster with bit-identical output; occlusion inner loop ~2× faster.

**Prediction error**, mean world units against ground truth, 400 runs × 60 ticks
per movement style:

| style | lead 1 | lead 2 | lead 3 |
|---|---|---|---|
| holding a line | 0.09 → 0.09 | 0.33 → 0.29 (−13%) | 0.72 → 0.59 (−18%) |
| constant small turns | 0.75 → 0.75 | 2.89 → 2.56 (−11%) | 6.09 → 5.26 (−14%) |
| sharp about-turns | 4.22 → 4.22 | 12.91 → 12.67 (−2%) | 25.85 → 25.37 (−2%) |
| stopping and starting | 2.12 → 2.12 | 7.52 → 6.33 (−16%) | 15.13 → 12.64 (−17%) |

Lead 1 is deliberately unchanged: an earlier version smoothed velocity as well
and that lagged, making lead 1 worse on every style. Velocity is now taken raw
and only the acceleration is smoothed.

**Angle choice** — over 172k random scenes, a legal touching spike existed in
42%. The old radial-snap found one in 99.5% of those; the contact-arc method
finds one in 100%, and where they differ the gain is about a unit. The angle
change is a correctness guarantee, not a large tactical win — the substantive
gains are the speed, the deeper leads, the ping lead, and the fallback layers.

### Verification

```sh
node tools/verify-placement.js    # 32 property tests against brute-force references
node --check Ryn_Type_2.user.js
```

The tests pull `GeometrySolver`, `AngleSolver`, `PlacementMemory` and
`TargetMotion` straight out of the shipped file — nothing under test is
reimplemented. They check that the 144 lattice angles are distinct and evenly
spaced, that a contact arc contains exactly the directions that touch, that the
chosen angle is the nearest legal one that does the job (against a 0.1° brute
force), that a heavily blocked ring still finds its one gap, that the lattice
sweep stays off the routine path, that the solver is deterministic, and that the
motion path cache reproduces the original integration exactly.

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
