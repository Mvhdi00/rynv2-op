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

Triggers on `canBeDestroyed` for the current tick, or a damage estimate showing
the build is within `_prePlaceHits` swings of dying. Placement is computed
against the position two movement-sim ticks ahead, as auraro does.

Retrap: when the doomed build *is* the trap holding the enemy, auraro cycles
the whole circle in `π/8` steps so whichever slot frees up gets refilled.

### replace

Reacts to `ObjectManager.deletedObjects`, then falls back to auraro's
pre-emptive scan for one of ours within two hits of dying. Branches in auraro's
order: they escaped → trap where they are heading; still pinned and in reach →
spike into their trap; we escaped what just broke → two opposed traps;
otherwise refill the hole.

## The packet budget

Auraro has no packet budget. RYN caps a tick at `ModuleHandler.packetLimit` and
every module draws from the same pool, so all placements funnel through
`AuraPlacer.send()`, which refuses once the budget is spent. Without it a single
`testCanPlace` sweep would starve the rest of the tick. This is the one
deliberate behavioural difference from auraro.

## Not ported

- `checkSpikeTick` — RYN runs spike tick as its own `spikeTick*` modules.
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

## Tests

    node test_modules.js            # 76 cases, owner build
    node test_modules.js --player   # the same 76 against the player build
    node test_menu.js               # 36 cases, menu wiring in both builds

`test_modules.js` slices the placer out of the shipped file and drives it with
stubbed managers, so it tests what actually ships rather than a copy. It covers
the arc arithmetic directly (merge/invert/intersect/snap, tangent angles,
placement and preplace checks) as well as module behaviour.

**Not covered:** none of this has been run against the live game. The geometry
is verified against stubs; timing, and whether the chosen angles land the way
they do in auraro, are not.
