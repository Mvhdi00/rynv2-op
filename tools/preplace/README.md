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

## Rebuilding on the exact spot

From the game bundle's `buildItem`, the server decides where a build lands:

    w = this.scale + f.scale + (f.placeOffset || 0)
    x = this.x + w * cos(this.dir)
    y = this.y + w * sin(this.dir)

Three things follow, and the first two are what made rebuilds imprecise.

**The radius is fixed.** The only thing under our control is the bearing, so
the build always lands somewhere on a circle of radius `w` around us. Aiming
straight at the remembered position is the closest reachable point on that
circle, and the residual is exactly `|distance(us, target) - w|`. No angle can
beat it. `rebuildAngle` does that and returns the miss.

The old code aimed a bearing and then ran it through `closeToAngle`, which
snaps to the nearest **free arc edge** when the true bearing is not inside one.
That is what put rebuilds off to the side. Now the exact bearing is tried first
and only falls back to arc-snapping when the spot it would land on is not free.
For preplace the test is `preplaceCheck`, which skips the doomed build and
requires the landing to overlap it — literally "the same place".

**`this.x` is the server's position, not ours.** Both modules now aim from a
`MovementSimulation` prediction rather than `pos.current`: two ticks for
preplace, as auraro does, one for replace since it reacts to something that has
already happened.

**The wire quantises the angle.** RYN sends `angle.toFixed(2)`, so bearings
land on a 0.01 rad grid — about 0.31px of arc at a trap's 62px radius, worst
case. `landingPoint` mirrors that rounding so the predicted landing is the real
one. It is the precision floor and nothing can go below it.

Measured in `test_modules.js`: 0.000px when standing a placement radius away,
and exactly the radial floor at 40, 50, 80 and 100px.

Rates for reference: `serverUpdateRate` 9 (111ms a tick), `clientSendRate` 5
(200ms between sends).

## Breaking: the tank bonus is only real when worn

Numbers from the game files, so the sizes are not guesses:

| | per swing | on Tank Gear (3.3x) |
|---|---|---|
| hammer (`dmg 10, sDmg 7.5, range 75`) | 88 | 292 |
| katana (`dmg 40`, no `sDmg`, range 118) | 47 | 156 |

`sDmg` appears exactly once in the whole item table — on the hammer. Everything
else multiplies by 1 against buildings. A pit trap has **500 hp**, so a primary
needs 11 swings where a hammer needs 6.

`Autobreak.getDestroyingWeapon` decided whether the primary could finish a
target in one swing using `getBuildingDamage(primary, canBuy(0, 40))`.
`canBuy` means *owned or affordable*, not *worn* — so for anyone who has ever
bought Tank Gear the estimate always carried the 3.3x. Nothing put the hat on
to match: the module only reaches for `forceHat = 40` further down when the
**bare** swing is not enough, and `DefaultHat` may already have forced soldier
for the tick. So the inflated number picked the primary for jobs it could not
finish, the swing landed at a third of the assumed damage, and the building
survived.

Both call sites now pass `myPlayer.hatID === 40` — count the bonus only when
the hat is actually on. With that, anything the primary cannot genuinely finish
in one swing goes to the hammer, which is what the 7.5x multiplier is for.
`AutoGrind` still uses `canBuy` and was left alone: it grinds turrets out of
combat, where nothing overwrites the hat.

`Autobreak` is not part of the block lifted into the player, so the player gets
this as its own splice. The call spans a folded string and cannot be replaced
in one piece, so the guard is inserted in front of it instead —
`hatID === 40 && canBuy(0, 40)` is the same thing, since wearing the hat means
owning it.

## The placer lays traps only

All three modules place traps and never spikes. This is the largest deliberate
departure from auraro, which alternates the two throughout. Spikes are left
entirely to the spike-tick modules.

| situation | auraro | here |
|---|---|---|
| autoplace, pushing and ≤169 | spike, trap fallback | trap |
| autoplace, ≤222 enemy pinned | spike, trap fallback | trap |
| autoplace, ≤222 neither | mode 1 spike, then trap | mode 1 trap |
| autoplace, 269–400 | trap, spike fallback | trap |
| preplace, enemy pinned by something else | spike into their trap | trap |
| replace, enemy pinned and in reach | spike into their trap | trap chained onto it |
| replace, plain refill | spike toward the break | trap toward the break |
| `protect` | a trap arc and a spike arc | two trap arcs |

With one build type, auraro's alternation collapses. `autoPlace`'s `again`
recursion has nothing to swap to, so it goes straight to the mode-0 fallback,
and the dispatch reduces to which *shape* to run — mode 0 lays against
everything nearby, mode 1 extends what already sits near the enemy.

### Standing off the spike tick

`spikeTickBreak`, `spikeTickNear`, `spikeTickTrap`, `spikeSync`,
`spikeSyncHammer`, `spikeTrap` and `teammateSpikeTrap` all run **before** the
placer in the module order, and whichever claims a tick first puts its name in
`ModuleHandler.activeModule`. All three modules skip the tick entirely when one
of those owns it, so they cannot take the slot or the packets a spike tick is
about to need. Any other module holding the tick is not a reason to stand off.

The other direction was already safe: `spikeTickTarget` bails on
`ModuleHandler.moduleActive`, and the spike-tick modules run first, so the
placer could never have blocked one.

### What the spike tick itself requires

`_spikeTick` is the master switch and **defaults to off**; the three variants
(`_spikeTickBreak`, `_spikeTickNear`, `_spikeTickTrap`) default on but are
gated behind it. On top of that `spikeTickTarget` wants all of: no other module
holding the tick, `!shouldIgnoreModule()` (no insta threat, no danger enemy, no
spike-sync threat), an enemy present, **you** not trapped, a primary that is not
weapon 8, that primary reloaded, and the enemy inside
`min(170, primaryRange + enemy.hitScale)`.

Then each variant adds its own: *break* wants something destroyed this tick
close to both of you, *near* wants the enemy knocked into or touching something
that damages it, *trap* wants them in a trap. The hit itself only lands if
`EnemyManager.nearestSpikePlacerAngle` is non-null, which needs a placement
angle whose spike would actually touch the enemy.

## The three spike ticks, against Sakuna 44.1

RYN had all three shapes but none of the gates Sakuna wraps them in, so they
fired in positions Sakuna refuses. Five things were missing or wrong.

**No stand-off after leaving a trap.** Sakuna keeps a 300 ms lockout on
`player.intrapTime`; RYN only checked `isTrapped`, which is one tick. For the
few ticks after breaking out you are still pinned in practice and the knockback
the whole tick is built on does not happen, so the swing is spent for nothing.
Now `SPIKE_TICK_TRAP_GRACE` = 3 ticks (300 ms at 111 ms a tick).

**No counter-threat gate at all.** This is Sakuna's `checkAntiSpikeTick`, which
every one of its three ticks is gated on, and it is the difference between
opening an exchange and walking into one. Two halves:

- *they swing first and you fly into a spike* — Sakuna's `emySpikeHit`. RYN
  already computes this properly (`possibleToKnockback`, a real knockback cone
  rather than Sakuna's projection along the aim), it was simply never read.
- *they are close enough to drop a spike on you with a primary ready* — inside
  180, latched for 200 ms so one frame of them stepping out is not a window.
  `enemy.canPlaceSpike` was already being computed every tick by
  `canPossiblyInstakill`, and `EnemyManager.enemyCanPlaceSpike` was a field RYN
  declared and then never wrote to.

**No priority for a spike already on you.** Sakuna's `nearBreakType ==
"NearSpikes"` branch breaks a damaging enemy object within
`scale + min(primary.range, 75)` *instead of* ticking, because ticking them
does not stop the spike chewing you. Gated on `_autobreak` the way Sakuna gates
it, so switching autobreak off does not leave the spike to nobody. `Autobreak`
runs after the spike ticks and already targets `EnemyManager.nearestSpike`, so
standing off hands it the tick.

**`spikeTickNear` fired on pinned enemies.** Sakuna guards its predictive branch
with `!tmpObj.inTrap` and has to: a trapped enemy does not move when you hit
them. `getActualMaxKnockback` knows nothing about traps, so
`nearestEnemySpikeCollider` would happily name one. The *touching* branch still
counts for a pinned enemy — the spike ticks them either way.

**`spikeTickTrap` lied about its own damage.** It cleared the trap for breaking
using `getBuildingDamage(secondary, true)` — the 3.3x Tank Gear number, 292 for
a hammer — and then equipped hat 53, Turret Gear, so the swing landed at 88 and
the trap survived. Sakuna has the same mismatch. Here the break tick wears
**Tank Gear** so the number it decided on is the number it gets; the turret shot
is not lost, it lands on the follow-up tick.

Two smaller ones: `spikeTickBreak` now also requires Sakuna's
`objDist < primary.range + 70` (with a short primary the flat 170 lets you swing
at breaks you cannot reach), and the turret half of the sequence holds the aim
on the target instead of dropping it, which is what Sakuna's `my.autoAim` does
across both halves of `insta(5)`.

### Where RYN is already ahead, and was left alone

- The melee reach really is `weapon.range + target.scale * 1.8` — that is the
  server's own test. RYN's `hitScale` matches it; Sakuna's flat `+35` is short.
- `nearestEnemySpikeCollider` is a proper knockback cone (angle to the enemy vs
  angle to the spike, with the spike's angular width, and the spike beyond the
  enemy). Sakuna projects along the aim by the raw distance.
- Placement after the hit goes through `attemptSpikePlacement`, which only keeps
  angles whose spike would actually touch the enemy. Sakuna sprays a 90° arc.
- Sakuna's `canSpikeTick` is one global flag raised by *any* enemy on a spike
  and then swung at `near`. RYN only ever ticks the enemy it checked.

### Structure

The whole thing is one liftable block — constants, both tick stamps, the two
gate helpers, the three shared helpers and the three classes — from
`const SPIKE_TICK_RANGE = 170;` to the close of `class SpikeTickTrap`. The
stamps live in a `WeakMap` keyed by client rather than on `EnemyManager`, which
wipes its state at the top of every tick; a stamp whose whole job is *how long
ago* cannot live somewhere that is cleared. Being self-contained is what lets
`patch_player.js` drop it into the obfuscated build whole, so the two builds
cannot drift.

`_antiSpikeTick` (Combat → the spike tick sub-options, on by default) is
Sakuna's `antispiketick` checkbox: it switches off the counter-threat gate, and
nothing else. The post-trap grace, the near-spike priority and the per-variant
conditions stay on either way.

### Full audit against Sakuna 44.1

Everything in that file that mentions a spike tick, and where it ended up.

| Sakuna | here |
|---|---|
| `checkspiketick`: primary reloaded, `dist < 170`, weapon != 8, `caninsta` | same |
| `checkspiketick`: `dist < primary.range + 35` | `range + hitScale`, and `hitScale` is `scale*1.8` — the server's own melee test, so this is Sakuna's `+35` corrected |
| `checkspiketick`: `Date.now() - intrapTime > 300` | `SPIKE_TICK_TRAP_GRACE`, 3 ticks |
| `checkAntiSpikeTick`: `emySpikeHit && !inTrap` | `possibleToKnockback && !isTrapped` (a real knockback cone) |
| `checkAntiSpikeTick`: enemy inside 180 can spike you, 200 ms latch | `canPlaceSpike` + `SPIKE_TICK_COUNTER_GRACE` |
| `antispiketick` checkbox | `_antiSpikeTick` |
| `nearBreakType != "NearSpikes"` on all three | `spikeTickNearSpike` |
| break: `objDist < 170 && objnearDist < 90` | same |
| break: `objDist < primary.range + 70` | `SPIKE_TICK_BREAK_REACH` |
| break: `circlePlace(2, objAim, 90, …)` | `attemptSpikePlacement`, which keeps only angles whose spike touches the enemy |
| near: touching within `(scale + scale) * 1.05` | `SPIKE_TICK_TOUCH_SLACK` |
| near: desert cactus counts as damage | `Resource.isCactus`, the same `y >= mapScale - snowBiomeTop` |
| near: `!tmp.isTeamObject(enemy)` | `isEnemyByID(ownerID, enemy)` |
| near: project the enemy onto the spike | the knockback cone, `+ !isTrapped` |
| trap: enemy reload `> 0 && < tickSpeed` | `aboutToReload` — the same "ready next tick" |
| trap: `inTrap.health <= dmg`, hammer, both reloaded, `dist < 110` | same, and the hat now matches the damage it assumed |
| trap: break → hit → place | same, on ticks instead of `traptickSpeed1/2` milliseconds |
| `insta(5)`: bull, then turret gear, aim held across both | `forceHat` 7 → 53, `useAngle` on both |
| `Text("Spike Tick", …)` | `GameUI.updateActiveModule` |
| `!checkAntiSpikeTick() → UseHat(6)` | already covered: any enemy inside 200 sets `detectedEnemy`, and `DefaultHat` forces soldier on it. The counter-threat window is 180, a subset |
| `reTrap` held off while `spikeTick`/`betaspiketick` | `auraSpikeTickBusy(activeModule)`, which holds across every tick of the sequence |
| `IsSpikeTick` suppresses `autobullspam` while the enemy is trapped | nothing to suppress — RYN has no autobullspam, and every module that swings is either manual (`attackingState`) or conditional |
| `UseAcc(21)` Corrupt X Wings during the tick | RYN's `DefaultAcc` prefers 18 Blood Wings whenever bull is forced. A gear preference that applies to every insta, not a spike tick decision — left alone |
| `traptickSpeed1` / `traptickSpeed2` sliders | whole ticks instead of milliseconds |
| `val`/`skinIndex 6` damage tweak | commented out in Sakuna itself |
| `isNavigable(x, y, hidespiketick)` | pathfinder argument; RYN has no pathfinder |
| debug text render | not ported |

**Two features deliberately not ported**, both separate toggles in Sakuna and
both off by default there:

- **Auto Tick** (`autotick`) — a *fourth* tick, not one of the three: diamond-or-
  better polearm, enemy wearing neither emp nor soldier, turret ready, and the
  enemy held at `|distance - 210| < 30`.
- **Spike Tick Move** (`spiketickmove`) — movement, not a tick: walk to a point
  70px past the enemy on the far side of one of *your* spikes so the next hit
  pushes them onto it. It drives `findPath`, and RYN has no pathfinder, so this
  would have to be a straight-line approximation fighting `autoPush`,
  `dashMovement` and `safeWalk` for the same movement authority.

## One radius for all three

All three gate on `_autoplacerRadius`; there is no
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

    node deob.js <clean RYN_Client_v5_PLAYER.user.js> player_stage1.js
    node patch_player.js

`patch_player.js` is not idempotent — run it against a clean copy of the build.

`player_stage1.js` must come from a **clean** copy too, not from an
already-patched one. It is what `names.js` resolves the mangled names against,
and a patched build resolves some of them differently, which shows up much
later as `_0x… is not defined` when the `--player` tests bind their stubs. It
is gitignored, so a fresh checkout has to regenerate it before those tests run.

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

    node test_modules.js            # 116 cases, owner build
    node test_modules.js --player   # the same 116 against the player build
    node test_spiketick.js          # 63 cases, the three spike ticks
    node test_spiketick.js --player # the same 63 against the player build
    node test_weather.js            # 31 cases, weather overlay
    node test_weather.js --player   # the same 31 against the player build
    node test_breaker.js            # 9 cases, weapon choice when breaking
    node test_breaker.js --player   # checks the spliced guard in the player
    node test_menu.js               # 44 cases, menu wiring in both builds

`test_modules.js` slices the placer out of the shipped file and drives it with
stubbed managers, so it tests what actually ships rather than a copy. It covers
the arc arithmetic directly (merge/invert/intersect/snap, tangent angles,
placement and preplace checks) as well as module behaviour.

`test_spiketick.js` does the same for the spike ticks: it slices the block out
of the shipped file and drives each module tick by tick, so the grace windows
and the latch are measured across real ticks rather than asserted. The fixtures
use the game's own numbers — hit reach `range + scale*1.8`, hammer 292 on tank
and 88 without, pit trap 500 hp.

`test_weather.js` drives the overlay against a mock canvas that counts calls,
so the cost claims above are measured rather than asserted: draw calls per
frame, pool growth, particle identity across frames, and canvas reallocation.

**Not covered:** none of this has been run against the live game. The geometry
is verified against stubs; timing, and whether the chosen angles land the way
they do in auraro, are not.
