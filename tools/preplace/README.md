# Auraro placer port

RYN's own `AutoPlacer` has been removed and replaced with auraro 5.5's placer,
ported whole. Autoplace, preplace and replace all run on it.

## Why it is a port and not a copy

The two clients do not share a data model. Auraro reads `player.x2`,
`nearObjs`, `items.list[]`, `objectManager.checkItemLocation`, `near.inTrap`;
RYN has `myPlayer.pos.current`, a spatial hash grid, `Items[]`, managers. Pasted
verbatim, not one line of auraro would resolve.

So the *arithmetic* is carried across unchanged and only the data access is
rewritten. Every geometry method below is auraro's, operation for operation:

    normalizeAngle  angleDist   normalizeArc   mergeBlocked   invertArcs
    angleInArc      closeToAngle intersectRanges isAngleFree
    closestPossibleAngles  angleRanges  calcPreplace  urgencyScore
    inPredictedRange  createObj  radCalc  testCanPlace  tryPlaceAngle
    protect  autoPlace  findPlacementAngle  preplacer  autoReplace

The engine is arc-based: build the blocked angular arcs around the player,
invert them into free arcs, then pick the free angle nearest whatever you want
to aim at. That is a different approach from RYN's `getBestPlacementAngles`,
which is why it was ported rather than approximated.

## Slot numbering

Auraro uses `2 = spike`, `4 = trap`. RYN item types are `4 = spike`,
`7 = trap`. RYN's numbering is used throughout, so auraro's
`autoPlace(0, 2, 4)` reads here as `autoPlace(0, AURA_SPIKE, AURA_TRAP)`.

## Structure

`AuraPlacer` is the ported class. Auraro keeps one global `autoPlace` object
whose state (`preplaces`, `ranges`, `radObjs`) is shared across a tick, so the
three RYN modules share one instance via `getAuraPlacer(client)`.

| RYN module | auraro entry point |
|---|---|
| `autoPlacer` | the per-tick `autoPlace(...)` dispatch |
| `prePlacer` | `preplacer()` |
| `replacer` | `autoReplace(building)` |

Module order is `replacer` → `autoPlacer` → `prePlacer`: reacting to a real
break outranks laying new builds, which outranks a speculative preplace.

### Mode 1 pairs opposites

`autoPlace(1, ...)` extends what is already near the enemy, and auraro's filter
is `id == 4 ? obj.dmg : obj.trap` — laying a **trap** looks for existing
**spikes**, laying a **spike** looks for existing **traps**. Pairing them is
the point; extending like with like just spams one item.

This was inverted in the first version of the port and produced visibly more
spikes than traps, twice over: directly, and because a mode-1 pass that places
nothing falls through to mode 0 with the fallback type.

Which type *leads* is auraro's own ordering, and is not a bug: spike-first
inside 222, trap-first between 222 and 269. The first pass also reserves ground
through `preplaces`, so in a tight spot the leading type can crowd the other
out — that is auraro's behaviour too.

### The tangent knife-edge

`radCalc` builds a candidate tangent to its anchor, which puts it at exactly
`anchorScale + itemScale` away — the same value `checkItemLocation` rejects on.
At world coordinates floating point decides, measured at a ~50/50 coin flip, so
half of all pairings silently failed and fell through to mode 0.

`radCalc` now pads the anchor scale by `+0.01`, which is the same slack auraro
uses in `closestPossibleAngles` for this exact problem. Auraro does not apply
it in `radCalc`; this is a deliberate deviation to make placement deterministic.

### autoPlace dispatch

Straight from auraro, keyed on distance and who is pinned:

| condition | call |
|---|---|
| pushing, ≤169 | `autoPlace(0, spike, trap)` |
| pushing, >222 | `autoPlace(0, trap, spike)` |
| ≤222, enemy pinned | `autoPlace(0, spike, trap)` |
| ≤222, enemy just escaped | `autoPlace(0, trap, spike)` |
| ≤222, neither | `autoPlace(1, spike, trap, true)` |
| 269–400 | `autoPlace(0, trap, spike)` |
| ≤269 | `autoPlace(1, trap, spike, true)` |

`my.autoPush` has no RYN equivalent, so it reads as `_autoPush` enabled and the
enemy inside `_autoPushRange`.

### preplace

Send the replacement *before* the break lands: the server handles the break
first, so the slot is free when the packet arrives and there is no gap to walk
into. `preplaceCheck` is what makes it a *pre*-place — a candidate spot only
counts if it overlaps the doomed build.

auraro gates it on **both** `canBeBroken` — the enemy can actually finish it
this tick — and `hitsToBreak <= 4`. Both are required, not either, and the 4 is
auraro's, hardcoded as `AURA_MAX_HITS`. Placement is computed against the
position two movement-sim ticks ahead, as auraro does.

The candidate set is any placed item within 200, **including the enemy's** — a
slot they are about to lose is worth claiming. The only exclusion is our own
`hideFromEnemy` traps, whose position is worth more than the slot.

Retrap: when the doomed build *is* the trap holding the enemy, auraro cycles
the whole circle in `π/8` steps so whichever slot frees up gets refilled.

### replace

Reacts to `ObjectManager.deletedObjects`, then falls back to auraro's
pre-emptive scan for one of ours within two hits of dying. Branches in auraro's
order: they escaped → trap where they are heading; still pinned and in reach →
spike into their trap; we escaped what just broke → two opposed traps;
otherwise refill the hole.

## Preplace and replace place traps only

Both were changed to place traps and never spikes, which is a deliberate
departure from auraro — it spikes when the enemy is pinned by something other
than the doomed build, and replaces a broken build with a spike. Spikes are
left to autoplace and to the spike-tick modules.

Where auraro would have spiked:

| situation | auraro | here |
|---|---|---|
| preplace, enemy pinned by something else | spike into their trap | trap |
| replace, enemy pinned and in reach | spike into their trap | trap chained onto it |
| replace, plain refill | spike toward the break | trap toward the break |

### Standing off the spike tick

`spikeTickBreak`, `spikeTickNear`, `spikeTickTrap`, `spikeSync`,
`spikeSyncHammer`, `spikeTrap` and `teammateSpikeTrap` all run **before** the
placer in the module order, and whichever claims a tick first puts its name in
`ModuleHandler.activeModule`. Preplace and replace skip the tick entirely when
one of those owns it, so they cannot take the slot or the packets a spike tick
is about to need. Any other module holding the tick is not a reason to stand
off.

## One radius for all three

Autoplace, preplace and replace all gate on `_autoplacerRadius`; there is no
separate preplace or replace radius. Auraro gates preplace at 269 and replace
at 300 internally, so with the slider at its 350 default both now reach a
little further than the reference. `AURA_REPLACE_RANGE` (300) is untouched —
that is auraro's *object* scan cap, a different quantity from the enemy
distance gate.

## The packet budget

Auraro has no packet budget. RYN caps a tick at `ModuleHandler.packetLimit` and
every module draws from the same pool, so all placements funnel through
`AuraPlacer.send()`, which refuses once the budget is spent. Without it a single
`testCanPlace` sweep would starve the rest of the tick. This is the one
deliberate behavioural difference from auraro.

## Not ported

- `checkSpikeTick` — RYN runs spike tick as its own `spikeTick*` modules. Note
  this is also where auraro detects a *break-trap tick*: when the trap holding
  **you** is about to break (`canBeBroken(player.inTrap)`), it pre-registers
  incoming spike damage and raises `anti0Tick`. That is a defensive prediction,
  not a placement, and RYN's `AntiInsta` / `AntiRetrap` cover the same ground.
- `shameGrind` variants — RYN has no `shameGrind`.
- Auraro's `instaC` / chat / `addDamageThreat` side effects inside the placer.

## OWNER build

Plain source, edited directly. The old `AutoPlacer`, `SiegeAnalysis`,
`_getCachedPrePlaceAngles`, `_prePlaceAngleCache` and `PRE_PLACE_ROTATION` were
all deleted; `menu_owner.js` splices in the Combat rows and Keybinds tiles.

## PLAYER build

javascript-obfuscator output: one encrypted string array plus ~2200 nested
forwarder functions. It is patched without being de-obfuscated.

1. `deob.js` evaluates the string array, decoder and rotation IIFE, resolves
   every forwarder and constant-folds all `wrapper(a,b)` calls. It writes a
   readable copy **and** an anchor map pairing offsets in both files.
2. `names.js` resolves this build's names for `Settings_default`,
   `PlayerObject`, `DataHandler_default`, `Items`, `Config_default` and
   `MovementSimulation`, each verified against a property set only that global
   has.
3. `mapback.js` maps an offset in the folded copy back to the untouched build.
   It only answers for positions inside a *gap* — a region the fold left
   byte-for-byte identical — and reports when one is not.
4. `patch_player.js` locates each edit in the folded copy, maps it back, proves
   the surrounding gap is identical on both sides, then applies it.

The placer block is lifted straight out of the OWNER build and renamed, so the
two builds cannot drift.

The old AutoPlacer class is excised by brace-matching its body. Two of its
private helpers (the `SiegeAnalysis` object and the cached-angle function)
remain in the bundle as **unreachable dead code** — nothing references them once
the class is gone, and cutting them out means more excisions inside a minified
`const` list for no behavioural gain.

The menu pages are encrypted string-array entries and cannot be edited in place,
so `getFrameContent` is wrapped with `RYN_PP_COMBAT` / `RYN_PP_KEYS`, which
graft the same rows on at runtime. Both are no-ops if their anchor is missing.

    node deob.js ../../RYN_Client_v5_PLAYER.user.js player_stage1.js
    node patch_player.js

`patch_player.js` is not idempotent — run it against a clean copy of the build.

## Weather overlay

Rain across the screen that turns to snow inside the snow biome
(`myPlayer.pos.current.y <= Config_default.snowBiomeTop`), easing across the
boundary rather than snapping. `Visuals -> Weather` has the toggle and an
intensity slider.

Built to stay cheap:

- one overlay canvas, created only while the effect is on and you are in a
  game, torn down otherwise — when it is off the frame callback is one `if`
- one particle pool, grown once and recycled in place; nothing is allocated
  per frame
- every raindrop goes into a single path and is stroked once; every snowflake
  into a single path filled once. Two draw calls a frame at any intensity
- the canvas is only resized when the game canvas actually changes size
- delta-timed, so speed does not follow framerate, and a backgrounded tab
  cannot teleport the field
- `_lowQuality` thins the field

## Tests

    node test_modules.js            # 97 cases, owner build
    node test_modules.js --player   # the same 97 against the player build
    node test_weather.js            # 31 cases, weather overlay
    node test_weather.js --player   # the same 31 against the player build
    node test_menu.js               # 39 cases, menu wiring in both builds

`test_modules.js` slices the placer out of the shipped file and drives it with
stubbed managers, so it tests what actually ships rather than a copy. It covers
the arc arithmetic directly (merge/invert/intersect/snap, tangent angles,
placement and preplace checks) as well as module behaviour.

`test_weather.js` drives the overlay against a mock canvas that counts calls,
so the cost claims above are measured rather than asserted: draw calls per
frame, pool growth, particle identity across frames, and canvas reallocation.

**Not covered:** none of this has been run against the live game. The geometry
is verified against stubs; timing, and whether the chosen angles land the way
they do in auraro, are not.
