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

Luna's placer was ported into RYN before this merge — `AutoPlacer` carried
Luna's function set under RYN's naming, rebuilt on RYN's spatial grid. Luna's
whole placer menu is present and then some:

| Luna | ReUp Mix |
|---|---|
| `autoPlace` | `_autoplacer` |
| `placeRange` | `_autoplacerRadius` |
| `prePlace` | `_preplacer` |
| `prePlace2` (replace) | `_replacer` |
| — | `_spamPreplace`, `_placeAttempts`, `_glotusPlacer`, `_placerRetrapCombo` |

`_lunaExactPlacer` picks between the two decision sets: **on** restricts spike
placement to Luna's original conditions, **off** (the default) adds RYN's extra
heuristics — seals-exit, double-spike, bounces-onto-spike, touches-enemy.

Those tactical rules are unchanged. What sits underneath them is not: the
geometry, timing and candidate generation now come from one shared
**placement engine** (`PlacementEngine`, with `UPEGeom`, `PlacementClock`,
`PlacementPredictor` and `PlacementLedger` beside it). See
[The placement engine](#the-placement-engine).

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

### The placement engine

Auto place, preplace, replace, spam preplace and retrap used to carry five
private copies of the same placement test and two different ways of finding
angles. They now share one engine, built from the two functions the game
actually validates placement with (`Player.buildItem` and
`ObjectManager.checkItemLocation` in `src/game_index.js`).

**Placement is one-dimensional.** `buildItem` puts the item at
`playerScale + item.scale + placeOffset` from the player along `dir`, so every
candidate lies on a circle and the only free variable is the angle.
`checkItemLocation` is a plain circle-circle distance test plus a river band —
no rectangles, no line of sight, and it never reads the player it is handed, so
players do not block placement at all.

**So the legal set is solvable in closed form.** A blocker at distance `d` with
combined radius `R` removes exactly the arc `|θ − φ| < acos((d² + w² − R²)/(2dw))`
from the ring. The engine builds those arcs, merges them wrap-aware, and
inverts to get the free apertures. That set *is* the answer; a 36/72/144/200
angle table is a sampling of it. Against the game's own test over 2.88M
samples the apertures agree on every one.

| | 36 | 72 (what RYN had) | 144 | 200 | engine |
|---|---|---|---|---|---|
| solvable scenes where it finds nothing | 2.72% | 1.36% | 0.38% | 0.38% | **0%** |
| mean aim error vs the exact nearest legal angle | 5.92px | 3.26px | 1.92px | 1.18px | **0.91px** |
| worst aim error | 202px | 146px | 146px | 145px | **1.58px** |
| µs per solve, 80 buildings in range | — | 556 | 1101 | 1529 | **32** |

Candidates are assembled from points the geometry names — the exact angles the
caller wants, the aperture tangents, the gap midpoints — plus a coarse sweep
and three levels of hill-climbing on the score. About 18 per target, all
distinct, all legal, and never empty while legal ground exists.

Other things that came out of building it:

- **Destroy packets act immediately.** `"Q"` invalidates only the cached work
  whose ring could reach the object, records the break, and hands it to
  `onBreak` on every module that wants it — in the same turn of the event loop.
  The old path pushed a sid onto `window._rynBrokenSids` and waited up to a
  full 111ms tick.
- **Timing comes from the clock, not a literal.** `config.serverUpdateRate` is
  9, so the tick is 1000/9 = 111.11ms — that is where the `111` in Luna's
  `setTimeout(111 - pingTime)` comes from. But that expression subtracts a
  round trip where a one-way delay belongs and measures from an arbitrary
  moment; `PlacementClock` measures from the tick that actually arrived.
- **Two spatial blind spots are gone.** `ObjectManager.canPlaceItem` and
  `getBestPlacementAngles` queried the grid with `search = 1`, which reaches
  100–200px, while item 21 rejects a placement from `item.scale + 300` away.
  Windows are now sized from the geometry, and they overlap on purpose.
- **Two wrong river constants are gone.** `AntiTrapProtect` and `AntiTrapStar`
  hardcoded a half-width of 310 where `config.riverWidth / 2` is 362, so they
  called two 52px strips of river placeable that the server refuses.
- **`forcedSpam` was dead in `AutoPlacer`** — computed every tick and never
  read. It now drives the spam flag it was written for.

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
