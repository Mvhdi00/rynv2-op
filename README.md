# RYN builds

Two moomoo.io userscripts, each built from a checked-in RYN client by an
anchored patch script, and verified against the game bundles in `src/`.

| Build output | Base | What it adds |
|---|---|---|
| **`RYN_PathBreak.user.js`** | RYN Client v5 (Luna placer) | Path Break — tick-accurate pathfinding that breaks through what blocks it |
| **`ReUp_Mix.user.js`** | RYN Client v4 | The Luna Client features RYN never had |

Both builds strip RYN's first-run beacon to `webhook.site` — see
[Removed](#removed).

---

# Path Break

`node tools/build-pathbreak.js` → **`RYN_PathBreak.user.js`**

## The hole it fills

RYN v5 ships `ModuleHandler.followPath` and `ModuleHandler.endTarget`. A
minimap click sets both, and the minimap draws a marker for them. Nothing else
in the client reads either one. The pathfinder v4 had — `LunaPathfinder` — was
dropped from v5 and nothing replaced it, so clicking the map puts a dot on the
map and that is all it does.

Path Break is the missing half: click the map (or press the key) and the client
walks you there, breaking what is in the way.

## Why the search simulates ticks instead of walking a grid

Aurora 5.5's pathfinder is the most accurate of the three clients here, and the
reason is that it does not plan in positions. It plans in *ticks*: every
candidate direction is run through the game's own movement physics —
acceleration, the `0.993^delta` velocity decay, the 1-to-4 sub-step collision
depth, river current, snow, spike knockback, pit-trap lock — and the route it
returns is a list of directions to hold, one per tick.

That distinction matters because a moomoo player is a mass with velocity, not a
token on a board. A grid pathfinder will happily route you through a
one-player-wide gap at a right angle; at 36 units a tick with momentum you hit
the corner. A tick simulation knows you hit the corner.

The port keeps that design and rebuilds the physics against **RYN's own**
`MovementSimulation` rather than Aurora's, term for term — same collision
resolution, same `+5` collision slack, same branch order for cactus / spike /
pit trap / boost pad, same clamp. RYN's simulation is the client's own model of
the server and the rest of the client already trusts it; Path Break running a
different one would mean Safe Walk and the pathfinder disagreeing about what is
walkable. It is the same model, run dozens of ticks deep instead of two.

`src/pathbreak.js` holds the whole feature and is spliced into the client
verbatim, so it reads and syntax-checks on its own.

## What was changed from Aurora, and why

**The search runs to a time budget.** Aurora searched a fixed 60 ticks. Here the
worker carries a 55ms deadline and returns the best route it has when the clock
runs out — the tick is 111ms, and a plan that lands after the tick it was
computed for is worse than a shorter plan that lands on time.

**The frontier is thinned on a 25-unit grid, not a 100-unit one.** Aurora keeps
one beam per 100-unit cell for spatial diversity. At full speed a player covers
~36 units in a tick, so with a 100-unit cell every candidate off a beam lands in
the same one or two cells: the frontier never widens, and the search creeps
forward exploring nothing. Measured, it plateaued at ten beams after eighty
ticks. Dropping the cell below one tick of travel is what makes the beam search
a beam search. When the frontier then exceeds its width cap, beams are dropped
by taking the best one out of each coarse cell first, so what gets thrown away
is duplication within a route rather than a whole route.

**Directions are a parent-pointer chain, not an array per beam.** Copying the
whole path onto every candidate is quadratic in the horizon; at forty ticks the
search was spending more time copying directions than simulating them.

**A blocked route is scored by journey remaining, not distance remaining.** When
nothing reaches the target, something still has to be walked at. Closest
approach is the obvious pick and the wrong one — the nearest state is almost
always flattened against the near face of the obstacle, and re-picking it every
tick is how a search walks into a wall and stays there. Frontier states that can
*see* the target are preferred even when further away, because from there the
rest is a straight line; states with no clear line are charged a flat penalty for
the detour they have not found yet.

**`shouldRAHHHHHHHHHHH` is a real setting.** In Aurora it is a worker global that
`triggerPathFinder` tries to set from the main thread, misspelled by one letter
against the parameter it reads — so it is always `true` and spike avoidance never
engages. Here it is `_pathBreakAvoidSpikes`, passed in the message, and it
defaults **on** so the search and Safe Walk agree about what is walkable. With it
off the search will plan a route across an enemy spike and Safe Walk will then
refuse to send the move, which looks like the pathfinder freezing.

## The breaking half

A route can be correct and still not walkable, because a wall with no gap has no
route. Every tick, Path Break checks the corridor directly ahead for an enemy
building that blocks it, and swings at the one that dies soonest.

- Only enemy buildings. Nothing of yours or your clan's is ever a target.
- Only things in the corridor — an object off to the side is not in the way.
- Only things in reach, decided by `Autobreak.getDestroyingWeapon`, so Path
  Break and Autobreak agree about which weapon reaches what.
- Pit traps and teleporters count as blockers even though collision says you can
  walk over them, because walking onto one ends the route.
- Tank gear goes on for the swing, and the swings-to-destroy ranking assumes the
  bonus only when the hat can actually be equipped.

If Autobreak has already claimed the tick, Path Break leaves the swing alone and
just keeps walking.

**Stuck widens the corridor.** If nothing has moved for a few ticks the corridor
test is too strict for whatever you are wedged against, so both its length and
its clearance grow until something is found.

## Using it

| | |
|---|---|
| **Key** | `N` by default — routes to the cursor, press again to cancel. Rebindable under Keybinds → Controls. Aurora used `G`; v5 already binds that to the spawn pad. |
| **Minimap** | Click anywhere on the minimap. With Path Break off, the click does what it did before. |
| **Cancelling** | Press the key again, touch any movement key, arrive, or die. |
| **Menu** | Combat → Utility → Path Break, with Break obstacles / Avoid spikes / Show path under it. |

The overlay draws the planned route in world space on its own canvas, and costs
nothing while no route is active. A route the search could not finish is drawn
dashed and dimmer — that is the best approach found so far, not a way through,
and usually the moment the breaker is about to start swinging. The building
being broken gets a red ring.

Path Break defaults **on**, matching how v5 ships the rest of its combat
options. Nothing moves until you actually set a target.

## Known limits

The search is a beam search on a deadline, so terrain exists that it will not
solve: a wall about 1600 units across, or one whose only gap is far outside the
horizon. In those cases it walks up to the obstacle and presses against it,
which is the right answer when the obstacle is an enemy building — the breaker
takes over. When it is a resource, you will stand there until you cancel.
`tools/test-pathbreak.js` pins both behaviours down.

Bot clients carry the module but never get a target, so no bot ever starts a
search or spawns a worker.

## Verification

```sh
node tools/test-pathbreak.js                    # search: plan + closed loop
node tools/verify-drivers.js RYN_PathBreak.user.js
node tools/check-hooks.js RYN_PathBreak.user.js # needs: npm i --no-save terser
node --check RYN_PathBreak.user.js
node --check src/pathbreak.js
```

`test-pathbreak.js` lifts the search worker out of the built userscript and
drives it two ways: one search per scenario, checking it finds a route inside
its time budget; and a closed loop — search, take the first direction, advance
the world one tick, search again — which is how the module actually runs and the
only way to catch a controller that plans well and then oscillates or stalls.
Ten scenarios, including snow, river, spike lines, trap lines and scattered
resources. Current state: all ten plan and drive as expected, routes come within
1–35% of the straight-line distance, and no search exceeds its budget by more
than part of a tick.

Drivers and hooks are unaffected by the patch and still pass: tables match the
shipped bundle, 41/41 hooks bind.

---

# ReUp Mix (Luna × Ryn)

`node tools/build-reup.js` → **`ReUp_Mix.user.js`**

The RYN Client v4 core with the Luna Client features RYN never had.

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
accessories, and config — see [Verification](#verification-1).

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

# Removed

Both RYN clients open with this:

```js
if (!localStorage.getItem("_ryn_sent")) {
  fetch("https://webhook.site/d1428dcc-.../?t=" + Date.now());
  localStorage.setItem("_ryn_sent", "1");
}
```

A first-run ping to a third-party webhook endpoint, fired before anything else
and never surfaced to the user. It carries no payload beyond the hit itself,
but nothing in either client needs it. Both builds strip it.

# Layout

```
RYN_PathBreak.user.js       build output — RYN v5 + Path Break
ReUp_Mix.user.js            build output — RYN v4 + the Luna-only features
drivers/game-drivers.json   protocol + data tables extracted from the game bundle
src/RYN_Client_v5.js        RYN v5, Luna-placer variant (input)
src/pathbreak.js            the Path Break feature, spliced in verbatim (input)
src/RYN_Client_v4.js        RYN v4 (input)
src/Luna_Client_1.1.js      Luna client, kept for reference (input)
src/game_index.js           game bundle: protocol, data tables, engine
src/game_vendor.js          game bundle: msgpack codec, polyfills
tools/extract-drivers.js    game bundle  -> drivers/game-drivers.json
tools/build-pathbreak.js    src/RYN_Client_v5.js + src/pathbreak.js -> RYN_PathBreak.user.js
tools/build-reup.js         src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/test-pathbreak.js     drives the Path Break search worker
tools/verify-drivers.js     client tables vs. drivers/game-drivers.json
tools/check-hooks.js        client's bundle-rewrite hooks vs. the game bundle
```

Every edit in both build scripts is anchored to an exact string in the base
client, and an anchor that is missing or ambiguous fails the build. Dropping in
a newer RYN will surface as a build error rather than a half-merged script.

`check-hooks.js` re-minifies `src/game_index.js` before matching, because the
hook patterns are written against minified code and the bundle checked in here
is beautified. It approximates the shipped asset; it does not reproduce the
original mangled identifiers, which the patterns match generically anyway.
