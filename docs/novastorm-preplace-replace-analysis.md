# NovaStorm 1.4 — Preplace & Replace: analysis

Scope: the Preplace and Replace systems only. Auto Place, Spike Tick, Combat,
Auto Heal, Safe Soldier, Anti Smart Tick, Auto Mills and the packet layer are
mapped here **only** where Preplace/Replace share code with them, so that the
blast radius of each proposed change is known before anything is written.

All line numbers refer to `novastorm_1.4_ryn.user.js` as supplied.

---

## 1. What the two systems actually are

### 1.1 Preplace

Gated by `window.vars.prePlace` (default `true`, menu: Placers → Preplacer,
line 20727).

Runs inside `getPredictObjects()` (13322), which is called once per tick from
the main tick body at 15416.

```
getPredictObjects()                                   13322
 ├─ getPrePlaceObject()                               13284   pick the doomed object
 ├─ getPrePlaceAngles(items[2], visible − doomed)     13061   72-angle sweep, spikes
 ├─ getPrePlaceAngles(items[4], visible − doomed)     13061   72-angle sweep, traps
 ├─ closestSpikeToEnemy / closestTrapToEnemy          13361/13379
 ├─ closestSpikeToKb  (+ alignment score)             13396
 ├─ isPrePlaceAngle(...) per angle                    13088
 └─ addPredictObject(id, angle, preplace = true)      12825
```

The trick that makes it a *pre*-placer: `getPrePlaceAngles` is handed
`visibleObjects` **minus** the object that is about to be destroyed (13355), so
angles currently blocked by that object come back `placeable`. Exactly one
angle is committed per tick — spikes are tried first, traps second (13481,
13492), first match wins.

The commit is deferred. `place()` is not called in the tick body; it is called
from a timer at `111 - tickPing()` ms (15465–15474), so the packet reaches the
server as late as possible inside the tick window — ideally in the same server
tick that the doomed object dies.

### 1.2 Replace

The re-send at `111 - minPingTime` ms (15476–15489), gated on `spamPrePlacer`.

`spamPrePlacer` is set to `true` by `getPrePlaceObject()` (13316) whenever it
found *any* doomed object, and reset at the top of every `getPredictObjects()`
(13340).

Three things follow from this that are worth stating plainly:

- **Replace has no toggle.** `settings.spampreplace = true` exists at line 1504
  and is never read anywhere in the file. The menu has no entry for it.
- **Replace has no gate.** It fires on the same condition as Preplace, so it is
  effectively "always double-send".
- **Replace has no success check.** It re-sends the identical `place()` without
  ever asking whether the first one landed.

### 1.3 The third timer

There is also a timer at 1 ms (15455–15463). It is dead work, see §2.1.3.

---

## 2. Defects

Grouped by the four goals in the brief.

### 2.1 Faster

**2.1.1 — Tick-invariant work recomputed per angle.**

`isPrePlaceAngle` (13088) is called from inside `.filter()` over up to 72 spike
angles and 72 trap angles (13482, 13493). Every call re-derives state that is
constant for the whole tick:

- `enemyTrapped` — a linear scan of `traps_our` (13096)
- the LOOKAHEAD/START_OFFSET future-position anchors (13101–13105)
- `canTrapTick()` (13152) — which itself runs **a full 72-angle
  `getPrePlaceAngles` sweep** (12721)
- `canShamePlace()` (13155, 13168) — which runs **two** full sweeps (12586,
  12588)

So a single angle that satisfies `canSpikeTick` costs another 72
`checkItemLocation` calls; a single angle that satisfies `canRetrap` costs 144.
In a real fight several angles satisfy each, and the sweeps are identical every
time.

**2.1.2 — `checkItemLocation` is a linear scan with a square root per object.**

`canPlace` (12790) → `objectManager.checkItemLocation` (18557) loops over the
whole candidate array and calls `UTILS.getDistance` (20313, `mathSQRT`) per
object. `visibleObjects` is everything within 1000 units (14122) — routinely
150–400 objects in a base fight.

One sweep is therefore 72 × |visibleObjects| ≈ 20k distance computations.
Combined with 2.1.1, the placer can reach six figures of `getDistance` calls in
a 111 ms tick.

Note the engine's own spatial grid is **not** a usable shortcut here:

- `config.colGrid = 10` over `config.mapScale = 14400` (16787, 16887) gives
  1440-unit cells — coarser than the 1000-unit visibility radius, so it narrows
  nothing.
- `disableBySid` (18501) splices `gameObjects` but never calls `removeObjGrid`
  (18391), so `this.grids` retains destroyed objects.
- `getGridArrays` (18432) returns a shared, mutated-in-place `tmpArray`.

A placer-owned grid rebuilt once per tick from `visibleObjects` is the correct
route.

**2.1.3 — Dead sweeps on the 1 ms timer.**

```js
getPrePlaceAngles(myPlayer.items[2], object.id, object.angle);   // 15459
getPrePlaceAngles(myPlayer.items[4] || 15, object.id, object.angle);
```

`getPrePlaceAngles(id, customObjects)` takes two parameters. `object.id` is
passed as `customObjects`, so `checkItemLocation` receives a number, reads
`objects.length` as `undefined`, skips its loop and returns `true` for every
angle. The return value is then discarded. 144 angles of allocation and
`getPerfectAngles` work per tick, producing nothing.

**2.1.4 — `placeTick` is write-only.**

Declared 12207, written 13329 and 13566, **never read**. `setPlaceTick()`
(13562) exists only to write it and is called on the hot path, including inside
the 1 ms timer (15458). The loop at 13325–13330 also writes the same value once
per matching element instead of once.

`updateAngles2` (12912) is likewise declared and never called.

**2.1.5 — Packet cost.**

`place()` (12737) is unconditionally four packets:

```js
selectToBuild(id);          // io.send("z", index, false)
sendAtck(1, angle);         // io.send("F", 1, angle)
sendAtck(0, angle);         // io.send("F", 0, angle)
selectWeapon(predictWeapon) // io.send("z", index, true)
```

There is no dedup against the currently-selected build index or weapon. For one
preplaced object a tick costs:

| timer | packets |
|---|---|
| 1 ms — `io.send("D", …)` | 1 |
| `111 − ping` — `place()` + `D` | 5 |
| `111 − minPing` — `place()` + `D` | 5 |
| **total** | **11** |

At 9 ticks/s that is ~99 packets/s from Preplace+Replace alone, against the
`packets + 5 > 119` budget guarded at 15468/15481 (`packets` is reset on a 1 s
interval, 20185). Auto Place, healing, hats and direction sends compete for the
same 120.

### 2.2 More accurate

**2.2.1 — Angles are computed for the wrong position.**

`getConfig`/`canPlace` (12782, 12790) accept a `velocity` flag that switches
between `myPlayer.x2/y2` (this tick) and `myPlayer.xVel/yVel` (predicted next
tick, computed at 14016 as `x2 * 2 − lastX`). **`getPrePlaceAngles` never
passes it** (13064), so Preplace validates against the tick-N position and then
sends the packet ~111 ms later, by which time the player has moved. The
facility to fix this already exists and is unused.

**2.2.2 — `predictMoveAngle` is `null` when standing still.**

Reset to `null` every tick at 14524, and set back to `null` at 14786 and 14821.
`isPrePlaceAngle` then does:

```js
const futureX = myPlayer.x2 + Math.cos(predictMoveAngle) * LOOKAHEAD;  // 13102
```

`Math.cos(null) === 1`, `Math.sin(null) === 0`. Standing still therefore places
the phantom "future position" 222 units due **east**, silently corrupting
`spikeWillBlockLOSToFuture` for every angle. (The same expression appears in
`isAutoPlaceAngle` at 13200 — out of scope, noted for completeness.)

**2.2.3 — `isItemLimit` never fires for spikes or traps.**

```js
let limit = (group.sandboxLimit || 99);      // 12836
```

Only three groups carry `sandboxLimit` (mill, booster, teleporter — 17641,
17660, 17703). Spikes have `limit: 15` (17633) and traps `limit: 6` (17653),
neither has a `sandboxLimit`, so the cap becomes 99 and is never reached.

The bundle's own placement check uses the right field:

```js
if (item.group.limit && this.itemCounts[item.group.id] >= item.group.limit)  // 19196
```

and the HUD does too (9426). `UTILS.isSandbox` exists at 16807.

Consequence for Preplace specifically: at 15/15 spikes, `isSpike` in
`isPrePlaceAngle` (13091) still evaluates true, the spike branch still wins,
the single per-tick slot is spent on a placement the server discards, and the
trap fallback at 13492 is never reached.

**2.2.4 — Square hitboxes standing in for circles.**

`closestSpikeToEnemy` (13362) and the KB scorer (13399) build an
axis-aligned box of half-width `nearestEnemy.scale + a.scale − 1` around the
candidate point and test the enemy's movement segment against it with
`UTILS.lineInRect` (20347). A square circumscribing a circle over-reaches by up
to √2 on the diagonals, so spikes that will visibly miss are reported as hits.
A segment-to-point distance test against `r1 + r2` is both exact and cheaper.

**2.2.5 — Constant-velocity enemy prediction.**

`xVel/yVel` (14016) is a plain linear extrapolation. The real integration is in
the file at 18930–19000: `config.playerSpeed` 0.0016, `config.playerDecel`
0.993 (16816–16817), and multipliers for build index (**0.5× while placing**),
weapon `spdMult`, hat/tail `spdMult`, snow biome and river. None of it is used
by the placer.

**2.2.6 — The deferred timers read mutable globals, not a snapshot.**

Both timers iterate the global `predictObjects` and read the global
`spamPrePlacer`/`placedAngles` at *fire* time, ~71–96 ms after the decision was
made. `getPredictObjects()` clears and repopulates `predictObjects` (13336) on
every tick. Under jitter a timer from tick N can therefore act on tick N+1's
list, or on an empty one — placing something that was never decided, or
dropping the replace entirely.

**2.2.7 — `minPingTime` is a session-global minimum that starts at `Infinity`.**

Declared `Infinity` at 16523, only ever lowered (16669–16671), never decayed.
Before the first ping response `111 - minPingTime` is `-Infinity`, clamped to
0 ms — the Replace pass fires immediately, ahead of the tick body that would
have populated `predictObjects`. Afterwards, one lucky low sample pins the
Replace timing for the rest of the session regardless of actual conditions.

### 2.3 More predictive

**2.3.1 — The enemy is always assumed to be wearing the tank hat.**

```js
let dmg = items.weapons[weapon].dmg * (items.weapons[weapon].sDmg || 1)
        * (config.weaponVariants[...].val || 1) * 3.3;    // 13307
```

The `3.3` is hard-coded. `skinIndex` is parsed per tick for every player
(14030), so whether the enemy actually has hat 40 right now is known. The same
pessimism is baked into `getPlayerInfo` (13783: `else tankMultiplier = 3.3`) —
defensible for damage-taken predictions, much less so as a *trigger* for
spending placements.

**2.3.2 — No aim cone on the threat branch.**

The autogather branch immediately above checks the angle (13303):

```js
UTILS.getAngleDist(UTILS.getDirection(...), getAttackDir()) <= config.gatherAngle
```

The enemy-threat branch (13310) checks only range and health. An enemy facing
away still triggers a preplace on everything behind them.

**2.3.3 — No ownership filter.**

`getPrePlaceObject` filters `!object.hideFromEnemy` and `object.health <= dmg`,
but not `isObjectOur(object)` (12876). Enemy-owned buildings inside the enemy's
own weapon range qualify as "about to break" and become preplace targets.

**2.3.4 — Single enemy.**

Only `nearestEnemy` is considered. `enemiesNear` is already assembled each tick
(14084–14089), and `nearestEnemiesCount` within 300 units is already computed
(14092–14095).

**2.3.5 — No landing detector, although the data is collected.**

`spawnedObjectSids` is pushed to in `loadGameObject` (11979), reset per tick
(13990), and **never read**. It is precisely the signal needed to answer "did
my placement land?" — and answering that is what would let Replace fire only
when it is actually needed.

### 2.4 More selective

**2.4.1 — The trap branch accepts everything.**

`isPrePlaceAngle` ends with:

```js
// Priority 6: Place trap when neither player is trapped
if (isTrap) { return true; }        // 13178
```

Unconditional. Combined with 2.2.3 (no working limit) this spends traps
continuously whenever a doomed object exists. The comment describes a
`neitherTrapped` condition that the code does not implement — `isAutoPlaceAngle`
*does* implement it (13266).

**2.4.2 — Preplace ignores `bannedAngles`.**

The ban map (1472) is written by `updateAngles` (12902–12907) and read **only**
by `checkPredictObjects` (12926), which is reached only from `updateAngles`
(12909) / `updateAngles2` (dead) — i.e. only from the Auto Place path (13513).

The asymmetry is backwards: Preplace/Replace push into `placedAngles` (15471,
15483) and so *create* bans that suppress Auto Place, while itself being the
system that re-sends the same angle two or three times a tick with no feedback
at all.

**2.4.3 — The ban rule is position-blind anyway.**

The inference is "I placed at angle A; next tick angle A is still placeable,
therefore the placement failed." Bans are keyed on the raw player-relative
angle (12905). Any movement between ticks re-aims that angle at a different
patch of world, so the inference is unsound whenever the player is moving —
which, during a preplace fight, is always. A position-keyed check (did one of
our objects appear near the predicted `config.x/y`?) would be sound and can be
driven off 2.3.5.

**2.4.4 — Dead range check.**

`getPredictObjects` gates Preplace at distance < 300 (13342);
`isPrePlaceAngle` then re-checks > 350 (13089). The second is unreachable.

**2.4.5 — Trap id mismatch.**

Trap angles are built with `myPlayer.items[4] || 15` (13357), but `isTrap`
compares `config.id === myPlayer.items[4]` (13092) without the fallback. When
`items[4]` is falsy every trap angle is rejected.

---

## 3. Shared surface — blast radius

`getPrePlaceAngles`, `getPerfectAngles`, `canPlace`, `getConfig`,
`isItemLimit`, `addPredictObject` and `place` are shared with systems that are
out of scope.

| Helper | Also used by |
|---|---|
| `getPrePlaceAngles` | `canShamePlace` 12586/12588, `canShamePlus` 12658/12660, `canTrapTick` 12722, `canSmartTick` 12484 (**Spike Tick**) |
| `canPlace` | `updateAngles` (**Auto Place**), Auto Mills 13527–13541, manual place keys 13543–13554, turret grind 15030 |
| `isItemLimit` | via `canPlace`, so everything above |
| `place` | Auto Place 15422, healing 12745, everything |

This splits the work cleanly:

- **Behaviour-preserving and safe to share** — making `canPlace` /
  `checkItemLocation` faster (placer-local grid, squared-distance comparisons,
  hoisted scale lookups). Spike Tick and Auto Place get the speedup for free
  with identical results. This is the "minimal compatibility integration" the
  brief allows.
- **Must be Preplace/Replace-local** — velocity-based configs, circular hit
  tests, ban consultation, tighter target selection, snapshotted timers. These
  change decisions and must not leak into Auto Place or Spike Tick. New
  functions (`getPrePlaceAnglesV`, `isPrePlaceAngle2`, …) rather than edits to
  the shared ones.
- **Needs a decision** — `isItemLimit`. It is a genuine one-line correctness
  bug and fixing it in place also changes Auto Place and Auto Mills (for the
  better, but it is a behaviour change outside the stated scope). See §5.

---

## 4. Proposed sequencing

No code until the questions in §5 are settled; this is the shape.

**Phase 1 — hot path, zero behaviour change.**
Placer-local uniform grid rebuilt once per tick from `visibleObjects`; squared
distances in the placement test; hoist the tick-invariant block out of
`isPrePlaceAngle` into a per-tick context object computed once; memoise
`canTrapTick()` / `canShamePlace()` per tick; delete the dead sweeps (2.1.3),
`placeTick`/`setPlaceTick` (2.1.4) and `updateAngles2`.
Verifiable as: identical chosen angle, large drop in `getDistance` calls.

**Phase 2 — correctness.**
Snapshot the tick decision into the timer closures (2.2.6); replace
`minPingTime` with a bounded recent-window estimate (2.2.7); guard
`predictMoveAngle === null` (2.2.2); circle tests instead of square
(2.2.4); resolve the 300/350 and `items[4]` inconsistencies (2.4.4, 2.4.5).

**Phase 3 — prediction.**
Velocity-aware configs for the preplace sweep only (2.2.1); real one-tick
movement integration for self and enemy (2.2.5); hat-aware and aim-cone-aware
threat model with an ownership filter (2.3.1–2.3.3); extend to all enemies
within range (2.3.4).

**Phase 4 — selectivity and feedback.**
Landing detector off `spawnedObjectSids` (2.3.5); position-keyed ban map for
the preplace path (2.4.2, 2.4.3); real conditions on the trap branch (2.4.1);
packet-budget-aware ordering so Preplace yields to Auto Place rather than
racing it.

**Phase 5 — Replace as a first-class system.**
Fire only when the landing detector says the previous attempt did not land, or
when the target's death is confirmed this tick; wire `spampreplace` to a real
toggle in Placers; dedup `selectToBuild`/`selectWeapon` inside a tick so the
second attempt costs 2 packets instead of 5.

---

## 5. Decisions needed before implementation

1. **`isItemLimit`** — fix in place (correct for everyone, but changes Auto
   Place and Auto Mills behaviour), or shadow it with a correct
   Preplace/Replace-local version and leave the shared one alone? Fixing in
   place is the honest fix; shadowing is the one that respects the stated
   scope.

2. **Threat model pessimism** — should the enemy damage estimate stay
   worst-case (`× 3.3` always), or become hat-accurate? Accurate means fewer
   wasted preplaces and fewer packets; pessimistic means never being caught out
   by a hat swap mid-tick. My inclination: accurate for *triggering* a
   preplace, pessimistic for anything defensive.

3. **Replace toggle** — add `spampreplace` to Placers as "Enable Replacer", or
   keep Replace implicit and only make it smarter?

4. **Output target** — this repo currently builds `ReUp_Mix.user.js` from
   `src/RYN_Client_v4.js` via `tools/build-reup.js`. NovaStorm 1.4 is not in
   the repo. Should it be added as its own source file with its own edits, or
   is the intent to port these Preplace/Replace improvements onto the existing
   ReUp Mix `AutoPlacer` (`_preplacer` / `_replacer`)?
