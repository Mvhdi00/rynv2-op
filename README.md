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

# YoRHa System — extra placer lanes

Build output: **`YoRHa_System.user.js`** (base: YoRHa System 1.5, sandbox-limits
revision). Verified by `node tools/verify-placers.js` — 60 checks.

Two placer families were added on top of YoRHa's own, both as toggles under
**Placers**, both defaulting on. Neither replaces anything that was already
there.

## Why they could not just be pasted in

YoRHa's preplacer is already the NOVASTORM family — `getPrePlaceAngles`,
`isPrePlaceAngle`, `getPredictObjects` — and it is a cleaner build of it: a
72/144 adaptive angle grid where NOVASTORM has a flat 36, and a knockback
sanity check on the spike tick that NOVASTORM never had. So "add NOVASTORM's
preplacer" meant finding what NOVASTORM's grading does that YoRHa's does *not*,
and adding only that.

blisma is a different family and did port as a lane of its own — but it could
not be pasted either, because it calls `place()` directly and would have fought
every other placer for the same ground.

## NOVASTORM grading — `prePlaceNova`

Grades the existing preplacer. Off, every branch reads exactly as 1.5's did.

| Added | 1.5 | NOVASTORM |
|---|---|---|
| Lookahead | flat 222 | `200 + min(speed × 10, 100)` |
| Enemy's own path | not tested | third `lineInRect`, 2 ticks of their velocity |
| Trapped enemy in spike reach | needed the whole shame kit up | earns a spike on its own |
| Re-trap while they run | any side | only the side they are heading for (< π/3) |
| Priority 1 candidates | the single closest spike | every spike that reaches them |
| Spikes per tick | one | two, when ≥ 1.2 rad apart |
| Angle preference | nearest slot, perfect or not | perfect slots first, then plain |

Two things were fixed rather than copied:

- NOVASTORM compares its two spike angles with `Math.abs(a - b)`, which misreads
  the 0/2π seam — 0.05 and 6.23 read as 6.18 apart and get spent as "two walls".
  This uses YoRHa's wrap-safe `getAngleDist`.
- Selection order stays YoRHa's (nearest to the hole that is about to open), not
  NOVASTORM's raw ring order.

## blisma lanes — `blismaPre`, `blismaReplace`

**Preplacer.** YoRHa's lane picks one object a tick — the one the *nearest*
enemy is about to break. blisma totals what every visible player has loaded
against every building near you, so a wall two enemies are splitting for less
than a one-shot each counts as dying, and so does a wall dying to somebody who
is not your nearest enemy. Damage uses `changeObjectHealth`'s formula, already
this file's building-damage rule.

**Replacer.** Three lanes on a break: the knock (a spike that pushes them into
one of ours), the re-trap, and a fill sized by how far off your facing the hole
is.

### Why it cannot fight the other placers

- It never calls `place()`. Every slot goes through `addPredictObject`, the same
  marker check the preplacer, replacer and autoplacer add through.
- It runs at a fixed point in `getPredictObjects` — after the preplacer, and
  after `doReplace` inside the replace block — so the lane with better
  information about a tick keeps first claim.
- Its output is ordinary `predictObjects`, on the same lane and the same packet
  budget as everything else.
- A hole its preplacer filled is recorded in `blismaPrePlaced` and skipped by
  its replacer when it dies — blisma's own `preplaceObj != findObj` guard.
- When a slot *is* held, it routes around to the next candidate instead of
  dropping the hole.

### Bugs fixed in the port

- **`spikSync` never resets.** In blisma it is set true on first fire and never
  cleared anywhere in the file, so the branch it guards is dead for the rest of
  the session. Not carried over; the lanes it tried to alternate are written out.
- **The dot product is in degrees.** blisma computes it in degrees and hands it
  straight to a sweep whose bound is read in radians — a hole 90° off your facing
  asks for a bound of 90, about fourteen times round the circle at π/24 steps.
  Kept as an idea, in radians, capped at one ring: ~24 probes instead of ~688.
- **Blind placement.** blisma places at the raw angle to the hole without
  checking it. Here `canPlace` answers first, and the sweep escalates to the
  checked ring when the narrow arc is spoken for.

### One thing the harness caught

The route-around cap started at 8, then 24. Both are unreachable: two spikes on
a 70-radius ring stop overlapping at 2·asin(35/70) = 60° apart, and since both
candidate lists are ordered nearest-the-hole-first, the first slot far enough
out lands ~37 entries into an 86-entry list. Anything under that silently turns
every routed break into a dropped one. The cap is now the ring itself (144).

## Verifying

```
node tools/verify-placers.js [path/to/YoRHa_System.user.js]
```

It lifts the real function bodies out of the script by name — nothing is
re-implemented — and runs them against a stub world with a recording
`addPredictObject`. It also asserts every new function is defined exactly once
*and reached*, which is the disease the source clients were full of: NOVASTORM
calls `batchPlaceTrap` in six places and never defines it, AI Client's
`AutoReplace` is never called, starrclient's better preplacer is shadowed by a
second assignment to the same name.
