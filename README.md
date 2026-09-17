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
src/Ryn_Type2.user.js     RYN Type 2 — the current production client
tools/verify-placement.js placement geometry vs. the game's own placement rules
tools/bench-placement.js  before/after comparison of the angle solver
```

---

## RYN Type 2 — placement

`src/Ryn_Type2.user.js` is the current production client and carries the
placement engine. It is a separate, later client from `src/RYN_Client_v4.js`;
the ReUp Mix build above is not involved.

### What the game actually does

Read out of `src/game_index.js`, which is the shipped bundle and therefore
authoritative:

| | |
|---|---|
| placement point | `player + L * [cos dir, sin dir]`, `L = 35 + item.scale + item.placeOffset` (`buildItem`, :2454) |
| legality | one circle test per object, `dist < item.scale + T` (`checkItemLocation`, :911) |
| blocking radius `T` | `obj.blocker ?? obj.getScale(0.6, obj.isItem)` — for a placed building this is **`obj.scale` exactly, with `colDiv` not applied** (:1451) |
| movement radius | the same call as `getScale()` — `obj.scale * colDiv`. Not the same number as the blocking radius |
| players | not in the object list, so **a player body never blocks a placement** |
| river | `y` in `[6838, 7562]` blocks everything except item 18 |
| angle on the wire | `fixTo(atan2(...), 2)` — **rounded to 0.01 rad**, so there are exactly **629 distinct placements** available from one position |
| tick | `1000 / serverUpdateRate(9)` = **111.11 ms**. This is where the 111 in the client comes from; it is not a guessed constant |
| speed | `xVel += 0.0016 * C * dt`, `xVel *= 0.993^dt`. Holding a building sets `C *= 0.5` |

`tools/verify-placement.js` asserts the client agrees with all of it, item by
item and resource type by resource type, and cross-checks the analytic aperture
solver against a brute-force application of the game's own circle test.

### The angle count

The client offers a resolution setting of 36/72/144/200. Measured against the
629-angle ceiling above, those are 17.5, 8.7, 4.4 and 3.1 wire steps apart —
so none of them is fine, and the setting was in any case **not reaching the
predictive path at all**: `AngleSolver.propose` deduplicated candidates with
`PlacementMemory`'s quantum, which for spikes is `2*asin(49/79)/2` = 38.3° and
leaves 9.4 buckets on the whole circle. Every ring sample past the first few
folded into one that a named proposal had already taken.

The fix is not a bigger number. Proposal dedup moved to the wire quantum, where
two angles collide only when they are the same packet; the lattice became a
first pass rather than the answer, with bisection refining the directions that
matter down to the wire; and a coverage pass spaces candidates across every
free arc so no legal ground is unrepresented. `PlacementMemory` keeps its own
quantum, which was right for remembering refusals and only wrong as a dedup.

`node tools/bench-placement.js <before> <after>` over 1500 random worlds:

| | before | after |
|---|---|---|
| candidates per world | 3.6 – 4.2 | 14.4 – 15.1 |
| worst gap from legal ground to a candidate | 43.5° – 44.5° | 22.1° – 25.8° |
| aim error, median | 1.59 units | 0.20 units |
| aim error, 95th percentile | 23.3 – 25.1 units | 0.38 units |
| candidates illegal once encoded | 2 – 7 | 0 |
| solver cost | 10.0 µs/call | 19.6 µs/call (0.35 ms per second of play) |

The old figures get *worse* as the resolution rises (4.2 candidates at 36 steps,
3.6 at 200) because a finer lattice lands more samples in buckets already
taken. The new ones are stable at every resolution. The 95th-percentile aim
error is the one that shows up in play: 25 units is half a spike radius, which
is the difference between a build that touches its target and one that does not.

`slivers` in the benchmark counts worlds whose only free arc is narrower than
the wire can address — one in 1500, 0.26° wide. The new build declines those
instead of spending five packets on a refusal.

### Verification

```sh
node --check src/Ryn_Type2.user.js
node tools/verify-drivers.js src/Ryn_Type2.user.js
node tools/verify-placement.js
node tools/check-hooks.js src/Ryn_Type2.user.js   # needs: npm i --no-save terser
```

Current state: 124/124 placement checks, driver tables match the bundle, 53/53
bundle-rewrite hooks bind.

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
