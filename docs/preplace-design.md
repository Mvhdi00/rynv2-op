# Preplace — upgraded design

Design only. No NovaStorm code has been modified.

Line numbers refer to `novastorm_1.4_ryn.user.js`; Whiteout references to
`Whiteout_v4.js`. Every Whiteout mechanism cited here was verified live in
`whiteout-preplace-analysis.md`; the dead paths (`traps.preplacer`,
`traps.replacer`) are not used.

---

## 0. What this settles

The brief specifies Preplace as movement-driven prediction — enemy position,
velocity, direction, history, direction changes, short-term future position.
That is **Option A** from `system-responsibilities.md` §4.

Consequence, stated once so it is not a surprise later: `getPrePlaceObject()`
(13284) is *replacement* target acquisition — "which existing object is about to
stop existing". Under this design it is **no longer Preplace's trigger**.
Preplace fires on predicted enemy movement, not on a doomed object. That
function moves to Replace, designed separately.

This is the change that makes the separation rules enforceable, because it gives
Preplace a trigger Auto Place structurally cannot have.

---

## 1. The discriminator

One rule separates Preplace from Auto Place, mechanically and permanently:

> **A Preplace candidate must be worth materially more against the enemy's
> predicted position than against the enemy's current position.**

```
V_now    = value(candidate, enemyState.current)
V_future = value(candidate, enemyState.predicted)
gain     = V_future - V_now
```

Auto Place scores against the current position only. If a candidate is good
*now*, it is Auto Place's — Preplace yields. Preplace claims only candidates
whose value is created by the prediction.

This satisfies three things at once: the charter's rule 1 (Preplace is not
another Auto Place), invariant I2 (every acceptance rule references a prediction
term), and invariant I3 (no Preplace rule is a superset of an Auto Place rule) —
because `gain >= GAIN_MIN` is unsatisfiable by any purely-current-geometry rule.

It also fixes conflict C1 from the conflict map: Preplace stops reserving space
that Auto Place would have used better right now.

---

## 2. Enemy movement model

### 2.1 Where it lives

Attached to the existing player objects, updated in the **existing** predictor
site — the parse loop at 14002-14017, where `lastX`/`lastY` are already in scope
and `xVel`/`yVel` are already computed. No new tracker, no new pass over players.
This extends the single predictor, which invariant I9 permits; it does not add a
second one.

### 2.2 Per-enemy record

Bounded, ~6 numbers plus a 5-slot ring:

```
p._mv = {
  dx, dy,          // this tick's displacement
  spd,             // hypot(dx, dy)          <- magnitude, not Whiteout's (dx+dy) bug
  dir,             // atan2(dy, dx), or null when spd < MOVE_EPS
  pdir,            // previous tick's dir
  stable,          // consecutive ticks with a stable dir
  errEMA,          // EMA of |predicted-for-this-tick − actual|
  conf,            // 0..1
  pred,            // the position predicted for next tick (scored next tick)
  hist             // ring of {spd, dir}, length 5
}
```

`spd` uses `Math.hypot(dx, dy)`. Whiteout's `(xVel + yVel) <= 7` (15170) sums
signed components and calls `(-10, +10)` stationary; that defect is not carried
over.

Angle comparisons use **`UTILS.getAngleDist` (20325)**, which wraps correctly
(`|b−a| % 2π`, then `p > π ? 2π − p : p`). Whiteout's `dAng` (14818) does not
wrap and was verified wrong; no local angle helper is introduced.

### 2.3 Short-horizon prediction

**Horizon = 1 tick, and that is not arbitrary.** The commit fires at
`111 − tickPing()` ms so the packet lands about one server tick after the
decision. The prediction horizon is set equal to the commit latency; predicting
further than the placement takes effect adds error for nothing.

Two hypotheses per tick, Whiteout's structure (`calcVel`, 14869) with NovaStorm's
own constants (`config.playerSpeed` 0.0016 at 16816, `config.playerDecel` 0.993
at 16817):

```
decay      = playerDecel ^ dt
H_decel    = (x2 + dx*decay, y2 + dy*decay)              // input released
H_accel    = H_decel + playerSpeed * spdMult * dt² * (cos dir, sin dir)   // input held
```

`dt` is the **measured** inter-tick interval, not a hard-coded 111 — Whiteout
uses `game.tickSpeed = performance.now() - game.lastTick` (15119) and it adapts
to jitter. NovaStorm already records `t1`/`t2` per player at 14006-14007, so
`dt` is available without new state.

`spdMult` — tier 1 uses `buildIndex >= 0 ? 0.5 : 1` only, because it is the
largest single term (a placing enemy moves at half speed) and `buildIndex` is
parsed at 14024. Tier 2 optionally adds weapon/skin/tail `spdMult` and the snow
biome, all derivable from fields already parsed at 14025-14031. Tier 2 is not
required for the design to work.

**Selection** is scored, not assumed — Whiteout's mechanism (14917) with the
binary outcome replaced by a graded one:

```
errDecel = dist(p._mv.predDecel, actualNow)
errAccel = dist(p._mv.predAccel, actualNow)
chosen   = errDecel < errAccel ? decel : accel
```

Both hypotheses from last tick are scored against where the enemy actually
turned up. This is the self-correcting part, and it costs two distance
computations per enemy per tick.

---

## 3. Confidence

Whiteout has no confidence *value* — its accel/decel pick is binary, and the
instrumentation that measured prediction error (`moveData`, 15222-15263) is
commented out. This design implements the graded version that block was reaching
for.

```
accuracy  = 1 − min(1, errEMA / ERR_SCALE)
stability = min(1, stable / STABLE_N)
conf      = clamp01(W_ACC * accuracy + W_STAB * stability)
```

`errEMA` is an exponential moving average of the chosen hypothesis's error,
updated once per tick per enemy.

### The three hard rules from the brief

**Consistent movement → confidence rises.** Each tick with
`getAngleDist(dir, pdir) <= STABLE_RAD` increments `stable`; `errEMA` decays as
predictions keep landing. Both terms climb.

**Direction change → immediate downgrade and invalidation.** On any of:

- `getAngleDist(dir, pdir) > TURN_RAD`
- `dir === null` while `pdir !== null` (a stop is a direction change)
- `dir !== null` while `pdir === null` (a start is too)

then, in the same tick and before any candidate is evaluated:

```
stable = 0
conf   = min(conf, TURN_FLOOR)
invalidate any in-flight predictive intent      // §7
```

`TURN_FLOOR` is set below `CONF_MIN`, so a direction change does not merely
lower confidence — it takes Preplace out of the running until stability is
re-earned.

**Unreliable → do not execute.** `conf < CONF_MIN` short-circuits the whole
Preplace branch before any sweep runs. This is also the cheapest gate available,
so it goes first: on an erratically-moving enemy, Preplace costs one comparison
per tick and nothing else.

Confidence is **per enemy**, not global. `enemiesNear` (14084) is already built
each tick and currently unread by any placer.

---

## 4. Candidate generation

Reuses `getPrePlaceAngles` (13061) — no second generator. Two changes, both
Preplace-local:

**Anchor and resolution.** Rather than 72 fixed angles from 0, sweep outward
from the direction that matters — the bearing toward the predicted enemy
position — at a finer step near that bearing and a coarse step elsewhere.
Whiteout parameterises resolution and anchor (`findAvailableAngles(item, thisAng,
vel, xd)`, 12277) and runs 200 angles; NovaStorm's fixed 72 spends most of its
budget behind the player. Same total work, concentrated where placements happen.

**Position basis.** `getConfig`/`canPlace` (12782, 12790) already accept a
`velocity` flag selecting `myPlayer.xVel/yVel`; `getPrePlaceAngles` never passes
it (13064). Preplace passes it, so candidates are validated at the position the
player will occupy when the packet lands.

> Honest note: Whiteout has the same `vel` parameter and **passes `0` at both
> live call sites**, so this is not reference-backed behaviour — it is a
> correction to a gap NovaStorm and Whiteout share. It is also why §8's
> revalidation matters more than getting this exactly right.

**Collision and range** are unchanged and shared: `canPlace` → `isItemLimit` →
`objectManager.checkItemLocation` (18557), and the fixed placement radius
`35 + scale + (placeOffset || 0)` in `getConfig`. `isItemLimit` is assumed fixed
per the standing regression fix; without it the limit gate never fires and every
count below is wrong.

---

## 5. Tactical value

A scored function, Preplace-local, evaluated twice per candidate — once against
`enemyState.current`, once against `enemyState.predicted`. Points, not a boolean
cascade, because a cascade cannot express "placeable but a bad idea" (Whiteout's
`gradeAngles`, 12348, is the model; its `−2` for blocking our own path is the
term NovaStorm has no way to represent).

Terms, all computable from state NovaStorm already has:

| term | source | sign |
|---|---|---|
| candidate intercepts the enemy's path segment | existing `closestSpikeToEnemy` geometry (13362) | + |
| candidate would trap / retrap at the predicted position | existing `closestTrapToEnemy` geometry (13380) | + |
| knockback drives the enemy into one of `spikes_our` | existing KB scorer (13396) | + |
| seals a gap in an existing spike ring around the enemy | `spikes_our` + predicted position | + |
| blocks our own predicted movement path | `predictMoveAngle` lookahead (13101) | **−** |
| blocks our line of sight to the enemy | existing LOS test (13106) | **−** |
| spends the last of a scarce item (near `group.limit`) | `myPlayer.itemCounts` | **−** |

Two corrections applied to the geometry while it is being reused:

- **Circles, not squares.** Every current hit test builds an axis-aligned box of
  half-width `r1 + r2` and calls `UTILS.lineInRect` (13362, 13381, 13399), which
  over-reaches by up to √2 on the diagonals. Segment-to-point distance against
  `r1 + r2` is exact and cheaper.
- **A knockback alignment threshold.** The current KB scorer ranks by alignment
  with no cutoff, so the "best" bounce can still be badly aligned. Whiteout's
  `knockInto` (12308) requires a 50–150 distance band and `dAng <= .17`; adopt a
  threshold, not just a ranking.

`predictMoveAngle` must be null-guarded before use. It is `null` whenever the
player stands still (14524, 14786, 14821) and `Math.cos(null) === 1` currently
puts the lookahead 222 units due east.

---

## 6. Execution gates

Evaluated in this order — cheapest and most-likely-to-reject first, so the
expensive sweep runs only when everything else has already passed.

| # | gate | test | cost |
|---|---|---|---|
| G1 | prediction reliable | `conf >= CONF_MIN` | O(1) |
| G2 | Spike Tick not mid-action | `instaKill.length === 0 && !insta.primary && !insta.secondary && !insta.turret && !insta.primaryturret` | O(1) |
| G3 | not already committed | no in-flight intent, and not in post-failure cooldown | O(1) |
| G4 | packet budget | graded, see §9 | O(1) |
| G5 | candidates exist | anchored sweep | the sweep |
| G6 | meaningful value | `V_future >= VALUE_MIN` | per candidate |
| G7 | Auto Place doesn't own it | `gain >= GAIN_MIN`, and if placeable now with `V_now >= V_future`, yield | per candidate |
| G8 | still valid at commit | revalidation, §8 | at commit |

**G2 deserves a note on invariant I1.** The contract forbids Preplace from
calling Spike Tick's *decision functions* — `canTrapTick()`, `canSmartTick()`,
`canShamePlace()` — which is what 13149/13152/13168 do today, each re-running a
72-angle sweep. G2 instead reads the **already-computed** flags. Spike Tick's
predicates run at 14855-14886 and its executor at 14888-14949, both before
`getPredictObjects()` at 15416, so `instaKill` and `insta.*` are settled and
free to read. Reading state satisfies the brief's "Spike Tick has no conflicting
urgent action" without violating I1.

Removing the three predicate calls from `isPrePlaceAngle` is itself a large
CPU win — those were the nested sweeps identified in Phase 1 §2.

---

## 7. Intent lifecycle

Preplace holds **at most one in-flight predictive intent**. It is created
through the existing `addPredictObject` (12825) — no second producer path, per
invariant I6 — carrying the extra fields from the conflict map's touch point 1:

```
{ id, angle, name, x, y, scale, preplace: true,     // existing
  owner: 'preplace', tick, conf, gain }              // added
```

| transition | condition |
|---|---|
| **created** | all of G1–G7 pass |
| **invalidated** | direction change or `conf` drops below `CONF_MIN` (§3) |
| **invalidated** | Spike Tick raises an urgent action after creation |
| **invalidated** | revalidation fails at commit (§8) |
| **committed** | revalidation passes; one `place()` |
| **retired** | landing confirmed, or cooldown expires |

Because it is a single intent with an explicit lifecycle, the reservation it
holds in the dedup pass is released the moment it is invalidated — closing
conflict C1 (space reserved, then nothing placed).

---

## 8. Commit and revalidation

**This is the most valuable thing Whiteout has and NovaStorm has nothing like
it.** `check3` (12592) re-derives the placement point from the player's *current*
position and re-runs the legality check with fresh state immediately before
sending, returning false and sending nothing if the world moved.

Preplace adopts the same shape at its commit site:

1. recompute the placement point from `myPlayer.x2/y2` **now**, not from the
   stored `x`/`y`;
2. re-run `canPlace` (which re-checks the item limit and collision) against the
   current object set;
3. re-check G1 and G2 — confidence may have collapsed, Spike Tick may have
   fired;
4. only then `place()`.

Failure is silent: no packet, intent retired, cooldown started.

This also removes the need for any `clearTimeout` machinery. There is none in
the placer today, and none is added — the timer still fires, it just declines to
act. Combined with the conflict map's touch point 2 (snapshot `predictObjects`
and `spamPrePlacer` into the timer closure instead of re-reading globals), this
closes C2 and C3.

---

## 9. Not spamming

Six mechanisms, five of which are existing infrastructure being used correctly
rather than anything new:

1. **One intent at a time** (§7). Structural.
2. **The confidence gate** (G1). An enemy who jukes never reaches candidate
   generation.
3. **The gain gate** (G7). Candidates that are merely good stay with Auto Place.
4. **Position-keyed placement memory.** Reuse the existing `placedAngles` →
   `bannedAngles` map (12902-12907, 12926), rekeyed on the intent's `x`/`y`
   instead of its raw angle. Angles are player-relative, so the current keying is
   invalidated by any movement — Whiteout's `usedAngles` (12630) expires on
   **both** age and player displacement (`game.tick - x.tick <= 6 &&
   cdf(player, x) <= x.offset + 20`) and that is the correct shape. Preplace must
   also *read* this map, which it currently does not (conflict C6).
5. **Post-failure cooldown.** A failed revalidation or an unconfirmed landing
   blocks that position for N ticks.
6. **Graded packet budget.** Against the existing `packets` counter (1522) — no
   second budget, per invariant I11. Whiteout's three-level degradation
   (`secPacket <= 60` to qualify as preplace, `<= 90` for the expensive legality
   test, `>= 85` to abort) is the model: **Preplace is the first thing to yield
   under packet pressure**, because it is the only placer whose value is
   speculative.

Landing confirmation uses `spawnedObjectSids` — written at 11979, reset at
13990, and read nowhere today.

---

## 10. Reuse audit

Against the "must not create" list.

| needed | reused | new |
|---|---|---|
| placement engine | `predictObjects` / `addPredictObject` / `getPredictObjects` | — |
| intent construction | `addPredictObject` (12825), + 4 fields | — |
| target/world state | shared block 14120-14149, `enemiesNear` 14084 | — |
| enemy prediction | the existing site 14002-14017, extended | — |
| angle sweep | `getPrePlaceAngles` (13061), anchored + `velocity` | — |
| collision | `canPlace` → `checkItemLocation` | — |
| placement range | `getConfig` radius | — |
| angle distance | `UTILS.getAngleDist` (20325) | — |
| packet budget | `packets` (1522) | — |
| timers | the existing block 15454-15489 | — |
| placement memory | `placedAngles`/`bannedAngles`, rekeyed | — |
| landing signal | `spawnedObjectSids` (11979) | — |
| **confidence model** | — | per-enemy record, ~6 numbers + 5-slot ring |
| **tactical scoring** | — | Preplace-local `value()` |

Two new things, both Preplace-local data/logic. No second engine, tracker,
scheduler, or predictor.

## 11. Invariant compliance

| invariant | how this design satisfies it |
|---|---|
| I1 no Spike Tick predicates | G2 reads settled flags; the three calls at 13149/13152/13168 are removed |
| I2 every rule has a prediction term | `gain` is required; §5 scores against the predicted state |
| I3 not a superset of an Auto Place rule | `gain >= GAIN_MIN` is unsatisfiable by current-geometry-only rules; the unconditional trap rule P7 is deleted |
| I4 Spike Tick picks no angle | untouched |
| I5 `smartTickSpike` | Preplace stops writing it (13443); delete or wire to Spike Tick — your call |
| I6/I7 one producer, four `place()` sites | unchanged |
| I8 shared world state | unchanged |
| I9 one predictor | extended in place, not duplicated |
| I10 no new timers | the existing block only |
| I11 one budget | `packets` |
| I12–I14 out-of-scope behaviour | Auto Place, Spike Tick, Auto Mills, manual keys and grind untouched except where `isItemLimit` intentionally corrects them |

## 12. Tunables

All to be calibrated against live play, not guessed in advance. Listed so they
are visible rather than buried as literals.

| name | governs | starting point |
|---|---|---|
| `MOVE_EPS` | stationary threshold on `spd` | ~4 units/tick |
| `STABLE_RAD` | direction counted as stable | ~0.30 rad |
| `TURN_RAD` | direction change trigger | ~0.60 rad |
| `STABLE_N` | ticks to full stability | 4 |
| `ERR_SCALE` | error normaliser | ~35 units (player scale) |
| `W_ACC` / `W_STAB` | confidence weights | 0.6 / 0.4 |
| `CONF_MIN` | minimum to act | ~0.65 |
| `TURN_FLOOR` | confidence ceiling after a turn | ~0.25 |
| `VALUE_MIN` | minimum tactical value | calibrate |
| `GAIN_MIN` | minimum future-over-now advantage | calibrate |
| `COOLDOWN` | ticks blocked after a failure | ~6 |

---

## 13. Open, and blocking

1. **Replace.** This design removes `getPrePlaceObject` from Preplace's trigger
   path. Replace's design has to land before either can be implemented, or
   NovaStorm temporarily loses doomed-object placement. Say the word and I will
   design Replace next.
2. **Output target.** Still unresolved from the first analysis: NovaStorm is not
   in this repo, which builds `ReUp_Mix.user.js` from `src/RYN_Client_v4.js`.
   Nothing can be implemented until I know whether NovaStorm 1.4 is added as its
   own source file or these changes are ported onto ReUp Mix's `AutoPlacer`.
3. **`smartTickSpike`** (I5) — delete, or wire it into Spike Tick as originally
   intended?
