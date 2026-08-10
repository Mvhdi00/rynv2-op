# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

The repo also carries a second, independent build —
[RYN v5 with the Luna placer](#ryn-v5-with-the-luna-placer) — which leaves v4
alone and puts Luna's autoplace / preplace / replace into RYN v5 OWNER instead.

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

## RYN v5 with the Luna placer

Build output: **`RYN_Client_v5_LunaPlacer.user.js`**

A second, separate build, and the only one that touches v5. RYN v5 OWNER ships
with the **Auraro** placer, not Luna's — v4's Luna-derived `AutoPlacer` was
dropped for it. This build puts Luna's autoplace, preplace and replace back in,
on top of v5.

The Auraro placer it replaces is trap-only: every call site is
`autoPlace(…, AURA_TRAP, …)` and `AURA_SPIKE` is never passed as the item to
build. Luna's places spikes as well as traps, so this build gets the spike
ladder back — the spike that catches a trapped enemy, the spike whose
knockback throws them onto another spike, and the spikes that do not wall off
your own path or your view of them.

### How the three fit together

Luna runs all three off one pass per tick. It rebuilds `predictObjects` — the
builds it wants — and flags each one:

| | what it is |
|---|---|
| **autoplace** | angles worth a spike or trap right now, sent immediately |
| **preplace** | one angle aimed at the slot an object is about to vacate, held back and sent a tick later once the slot is free |
| **replace** | that same preplace entry sent a third time at min-ping, for when the second send lost the race to the server |

So preplace and replace are not separate decisions — they are the second and
third send of the one preplace entry. That is why this is a single module here,
where the Auraro split had three: `prePlacer` and `replacer` are gone from
`staticModules` and from the module order, and Luna's `prePlace` /
`spampreplace` toggles map onto the menu switches that were already there,
`_prePlace` and `_replace`. The Combat page is unchanged.

### What was ported, and what was not

Only the data access is rewritten onto RYN's managers: `visibleObjects` becomes
`ObjectManager.grid2D` queries, `myPlayer.items[2]`/`items[4]` become
`getItemByType(4)`/`(7)`, and Luna's `x2/y2` and `xVel/yVel` become
`pos.current` and `pos.future`. The geometry is carried over unchanged — the
72-angle probe, the perfect-angle edge detection, `lineInRect`, the knockback
alignment scoring, and both placement priority ladders.

### Exact tangent corners

Luna samples the landing circle every 5°, so a legal gap narrower than that is
found only if a sample happens to land inside it. At the spike's landing radius
of 79px, one step is about 7px of arc.

The one piece of the Auraro placer kept is its answer to that: instead of
sampling near an object, solve for it. The game puts every build on a circle of
radius `w = playerScale + itemScale + placeOffset` and rejects it within
`R = itemScale + blockRadius` of an object, so for an object at distance `d`
and bearing `α` the blocked arc is exactly `α ± Δ` with

```
cos Δ = (w² + d² − R²) / (2wd)
```

Those two boundaries are the only angles where a build lands packed against
that object, and every tight legal spot is one of them. No solution means the
object cannot reach the landing circle — which doubles as the distance filter,
so only objects that can actually block produce candidates.

The candidate ring is Luna's 72 samples **plus** those solved corners, sorted
together and de-duplicated; a placeable corner is marked `perfect` outright,
since "perfect" means packed against something and a corner is that by
construction. **Luna's decision logic is untouched** — it just receives a list
that cannot miss a gap. `test-luna-placer.js` builds a free window 1.6° wide,
off-grid, and checks that the grid samples all miss it while the solved corners
land inside it.

### Deciding on angles the server can actually receive

Every angle this client sends goes through `PacketManager`'s own quantiser:

```js
const wireAngle = angle => parseFloat(Math.atan2(Math.sin(angle), Math.cos(angle)).toFixed(2));
```

`attack`, `stopAttack` and `updateAngle` all pass through it, so the server
only ever sees multiples of **0.01 rad (0.573°)** in `(-π, π]` — about 629
sendable angles, and nothing in between.

That makes any other angle a fiction. The placer used to probe `i·2π/72`
(0.0873, 0.1745, …) and decide from that, while the server judged 0.09, 0.17.
The gap is up to 0.005 rad, which at the 79px landing radius moves the build
about 0.4px — nothing in the middle of a wide gap, and decisive on the angles
Luna actually prefers, since a "perfect" angle is by definition the one packed
against an object. The placer would call a spot free that the server drops, or
skip one that was legal.

Candidates are now snapped to the wire grid **before** they are checked, and
the snapped value is what gets sent, so the angle reasoned about and the angle
judged are the same number. De-duplication becomes exact equality rather than
an epsilon compare, and the banned-angle keys become stable.

The corners changed with it. A constant nudge off the tangency was never wrong
— 6e-3 rad clears the 0.005 rounding either way — but it was measured at an
angle that then got rounded anyway. Each corner now steps straight to the first
sendable angle past tangency, which is both exact and tighter: measured across
the sweep, clearance runs 0.008px to 0.79px, against a nominal 0.474px that was
never quite where it claimed to be.

### Rules checked against the bundle, not assumed

The placement maths is transcribed from `src/game_index.js` rather than
guessed, and the client's own tables were re-checked against it:

| bundle | client |
|---|---|
| `buildItem`: `w = this.scale + f.scale + (f.placeOffset \|\| 0)` | `_getConfig` uses `35 + scale + placeOffset` ✓ |
| `checkItemLocation`: reject when `getDistance < p + block` | `_canPlace` ✓ |
| `block = obj.blocker ? obj.blocker : obj.getScale(.6, obj.isItem)` | `obj.placementScale` ✓ |
| `getScale(t,i) = scale * (isItem \|\| type==2 \|\| type==3 ? 1 : .6*t) * (i ? 1 : colDiv)` | `PlayerObject` → `scale`; `Resource` → `scale * .36` for types 0/1, `scale` for 2/3 ✓ |
| river band rejected unless `id == 18` | ✓ |

The `colDiv` factor looks like a discrepancy and is not: `getScale` applies it
only when `i` is false, and `i` is `isItem`. Player-built items are `isItem`,
so they never reach it; natural resources do, but none of them carry `colDiv`
in the item table — it appears only on sapling, pit trap, boost pad, healing
pad, blocker and teleporter, all of which are items. `o.colDiv || 1` is
therefore always 1 on the path that uses it. Likewise `blocker: 300` is on the
blocker alone, which is why keying it to `item.id === 21` is safe.

### The one decision rule that was changed

Luna's autoplace spike ladder ends with:

```js
// Priority 3: Place spikes that don't block LOS when enemy is trapped
if (enemyTrapped && !spikeWillBlockLOSToFuture && !spikeWillBlockLOSToEnemy) return true;
```

There is no distance test in it. The only distance Luna checks anywhere in
`isAutoPlaceAngle` is *the player's* distance to the enemy, not the spike's —
so the moment the enemy is pinned, **every** free angle on the circle
qualifies, including the ones behind the player.

A build lands 79px from the player, so with the enemy 150px away a spike on the
far side ends up 230px from them. It cannot touch them, it spends one of the 15
spikes, and it walls the player in. Rule 3 now also requires the spike to be in
contact range:

```js
Math.hypot(config.x - enemyPos.x, config.y - enemyPos.y)
  < config.scale + enemyScale + LUNA_SPIKE_REACH_MARGIN   // margin 5
```

`spikeScale + enemyScale` is exact contact; the margin is deliberately small.
Rules 1 and 2 are untouched — `closestSpikeToEnemy` and `closestSpikeToKb` both
aim at the enemy by construction.

The trap ladder is **not** changed: Luna gates both of its trap rules on
`neitherTrapped`, so while the enemy is pinned the autoplacer stays spikes-only
and traps come back through preplace, when the trap holding them is about to
break. That is Luna's rule and it stands.

### Other differences from Luna

- **`canTrapTick` and `canShamePlace` are dead.** Both gate on Luna's
  `shameTick` / `shameGrind` toggles, and v5 has no shame-grind feature to hang
  them on. They are left in the ladders as explicit `false` so the priority
  order still reads 1:1 against Luna.
- **The item limit comes from `ClientPlayer.getItemCount`.** Luna reads
  `group.sandboxLimit || Math.max(group.limit * 3, 99)` outside sandbox too,
  which caps everything at the sandbox number and effectively disables the
  check. RYN already resolves this correctly, so the port asks it. (Same bug,
  same fix as [the placer note above](#the-placer).)
- **Two guards that are RYN's, not Luna's.** The placer sits out a tick owned
  by a spike-tick or sync module ([below](#not-colliding-with-spike-tick)), and
  an angle it built at that is still free the next tick is treated as a build
  the server refused and benched for 18 ticks. Luna has no module ordering to
  collide with and no shared packet budget to protect.

### Not colliding with spike tick

`ModuleHandler.place()` opens with a `selectItem`. Swapping the held item out
from under a spike tick mid-sequence loses the swing, so this matters more than
the packets do.

Reading `ModuleHandler.activeModule` is a sound test for it. Every spike-tick
and sync module — `spikeTickBreak`, `spikeTickNear`, `spikeTickTrap`,
`spikeSync`, `spikeSyncHammer`, `spikeTrap`, `teammateSpikeTrap` — runs before
the placer in the module order and returns early once `moduleActive` is set. A
spike tick that runs at all is therefore the first module to claim the tick,
which is precisely when the module loop copies its name into `activeModule`.

The placer checks that name in two places, not one:

- at the top of `postTick`, before it decides anything;
- **inside all three delayed sends.** Luna's preplace and replace fire on
  `setTimeout(111 - ping)` — 70-110ms out, which lands in the *next* tick. A
  check made when they were scheduled says nothing about the tick they arrive
  in, so each callback re-tests before it touches the wire, and drops the
  resend if a spike tick has taken that tick. It resumes on the tick after.

`test-luna-placer.js` covers both: a spike tick owning the placer's own tick,
and a spike tick claiming the tick a queued resend lands in.

Two things the placer does *not* change, because v5 already worked this way:
it marks `moduleActive` and `placedOnce` when it builds, exactly as the Auraro
placer's `send()` did. So a tick the autoplacer builds on still suppresses
hold-to-place, same as before.

Everything else in v5 is untouched — the diff is the placer block and the two
lines that registered the modules it replaced.

## Layout

```
ReUp_Mix.user.js          the build output — this is the script to install
RYN_Client_v5_LunaPlacer.user.js
                          the v5 build output — install this one instead for v5
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/RYN_Client_v5_OWNER.js
                          RYN v5 OWNER, base for the v5 build (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/Luna_Fixed.user.js    Luna 1.1 on the current transport (input)
src/luna-placer.js        the ported placer, spliced into the v5 build
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-luna-placer.js
                          src/RYN_Client_v5_OWNER.js -> RYN_Client_v5_LunaPlacer.user.js
tools/test-luna-placer.js smoke test for src/luna-placer.js
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
node tools/build-luna-placer.js  # produce RYN_Client_v5_LunaPlacer.user.js
```

Every edit in both build scripts is anchored to an exact string or line in the
base client, and an anchor that is missing or ambiguous fails the build.
Dropping in a newer RYN will surface as a build error rather than a half-merged
script.

## Verification

```sh
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node --check ReUp_Mix.user.js

node tools/verify-drivers.js RYN_Client_v5_LunaPlacer.user.js
node tools/test-luna-placer.js
node --check RYN_Client_v5_LunaPlacer.user.js
```

`test-luna-placer.js` runs `src/luna-placer.js` outside the game against
stubbed managers and drives `postTick` through each decision path — traps on an
open enemy, spikes on a trapped one, the radius and master-toggle gates, the
spike-tick yield in both places it is checked, the held-back preplace and its
two resends, the 72-angle probe and its perfect-angle edges, the item cap, and
the packet budget, the tangent corners, a sub-5° gap the grid alone misses, and
the wire-grid snapping.
All 41 checks pass, and `verify-drivers.js` reports the v5
build's data tables unchanged against the shipped bundle.

Current state of the ReUp Mix build:

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
