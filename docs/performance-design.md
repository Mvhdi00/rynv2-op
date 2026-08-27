# Performance — Preplace and Replace

Design only. No NovaStorm code has been modified. Line numbers refer to
`novastorm_1.4_ryn.user.js`.

---

## 1. Correction: CPU was never the bottleneck

I claimed in the Phase-1 analysis that the placement sweeps could reach "six
figures of `getDistance` calls in a 111 ms tick", with the implication that this
was expensive. **The count is real; the implication was wrong.** I measured it
rather than continuing to assert it.

Benchmark replicating `checkItemLocation` (18557), `UTILS.getDistance` (20313)
and the 72-angle sweep shape, over objects distributed in a 1000-unit radius —
the same radius `visibleObjects` uses (14122):

```
objects | one sweep, as shipped | one sweep, squared-dist | grid query | grid build
     80 |             0.0155 ms |               ~0.012 ms |  0.0295 ms |   0.0155 ms
    200 |             0.0461 ms |               ~0.015 ms |  0.0270 ms |   0.0227 ms
    400 |             0.0538 ms |               ~0.023 ms |  0.0206 ms |   0.0405 ms
```

Per-tick totals at 400 objects, counting the sweep call sites traced in Phase 1:

| scenario | sweeps/tick | cost |
|---|---|---|
| today, quiet (Auto Place 2 + Preplace 2 + the two dead ones) | 6 | **0.33 ms** |
| today, enemy trapped (+`canTrapTick` nested ×5, `canShamePlace` ×2) | 13 | **0.71 ms** |
| today, worst (+`canSmartTick` over 3 candidates) | 16 | **0.87 ms** |
| designed (Preplace 1 + Replace 1) | 2 | **0.11 ms** |

**Against a 111 ms tick budget, the worst case is under 1%.** Two reasons my
estimate was off: `checkItemLocation` returns on the *first* blocker, so dense
scenes exit almost immediately; and the nested sweeps sit behind
`if (!enemyTrapped) return false`, so they fire in a narrow window.

The design changes already specified cut sweeps from 6–16 to 2 — a real
reduction, and worth having as headroom on weak hardware, but it is not what
makes the systems better. **The scarce resource is packets.**

---

## 2. Do not build the spatial grid

The measurement settles this. A uniform grid over `visibleObjects`:

- **loses** at 80 objects (0.0295 ms/query vs 0.0155 ms) — the common case;
- wins per-query only at 400 objects, and its build cost (0.0405 ms) exceeds a
  single baseline sweep;
- needs ≈ 3 sweeps per tick to amortise, and **the design uses 2**.

At 400 objects, grid = build 0.041 + 2 × 0.021 = 0.083 ms; plain squared-distance
= 2 × 0.023 = 0.046 ms. The simpler option wins.

I proposed this grid in the Phase-1 analysis as the largest available win. It
isn't. Dropping it also removes the one piece of new infrastructure the
integration would otherwise have needed, and sidesteps the whole question of
whether touching `checkItemLocation` counts as changing a shared system.

---

## 3. Where the real budget goes

`packets` (1522), incremented in `io.send` (20182), reset on a 1-second interval
(20185). The guards read `packets + 5 > 119`, so the working limit is ~120/s =
~13 per tick at 9 ticks/s.

`place()` (12737) is four packets: `selectToBuild`, `sendAtck(1)`, `sendAtck(0)`,
`selectWeapon`.

**Today, one preplaced object per tick:**

| timer | packets |
|---|---|
| 1 ms warm-up — `io.send("D", …)` (15461) | 1 |
| commit at `111 − tickPing()` — `place()` + `D` (15470-15472) | 5 |
| replace at `111 − minPingTime` — `place()` + `D` (15482-15484) | 5 |
| **total** | **11/tick ≈ 99/s** |

That is ~82% of the working budget for one object, before Auto Place, `heal()`
(12746, unguarded, 4 packets per food item), hats and the tick body's own
direction send.

**Designed:**

| change | saving |
|---|---|
| the 1 ms warm-up timer is deleted entirely (its two sweeps are wrong-arity dead code, 15459-15460) | −1/tick |
| Replace fires on evidence of non-landing, not unconditionally | −5/tick whenever unwarranted |
| aborted commits send **zero** packets, including no `io.send("D")` (SV7) | −5 per abort |
| Preplace gated on confidence, gain, the Auto Place oracle and the Spike Tick veto | fires far less often |

Steady-state cost is now 0 packets when nothing qualifies and 5 when Preplace or
Replace acts — against 11 unconditionally today.

**One redundancy worth removing.** The tick body already sends direction at 15430
when `predictObjects.length > 0`. Each deferred commit then sends it again per
object (15472, 15484). Where the angle has not changed, the second send is
duplicate packet work.

---

## 4. Reuse — no recomputation

Everything Preplace and Replace need already exists. Nothing on this list is
recomputed:

| data | source | computed |
|---|---|---|
| world objects | `visibleObjects` (14122) | once/tick |
| our structures | `spikes_our`, `traps_our`, `turrets_our` (14126-14128) | once/tick |
| enemy set | `enemiesNear` (14084) | once/tick — read by no placer today |
| enemy prediction | the parse loop (14002-14017), extended in place | once/enemy/tick |
| containment | `enemyTrapped` pattern (13096), `imTrapped` (14131) | once/tick |
| Auto Place ownership | `isAutoPlaceAngle` (13185) + its three selectors | selectors once/tick |
| Spike Tick state | `instaKill`, `insta.*` (14855-14949) | once/tick |
| loss evidence | `removedObjects` (10577) | live |
| landing evidence | `spawnedObjectSids` (11979) | live |
| collision | `canPlace` → `checkItemLocation` | per query |
| placement geometry | `getConfig` (12782) | per candidate |
| angle distance | `UTILS.getAngleDist` (20325) | — |
| packet budget | `packets` (1522) | live |

The tick context (integration design §4.4) is what makes "computed once/tick"
true rather than aspirational. Its concrete justification: the shipped code calls
`canTrapTick()` twice per tick from two places (14871 and 13149), each running a
full sweep, and can get two different answers.

---

## 5. The techniques, applied

### Early rejection — the main lever

Gate ordering is the optimisation. Both designs order gates cheapest-first so the
sweep runs only when everything else has passed:

```
Preplace:  conf (O(1)) → value/gain (arithmetic) → AP oracle → Spike Tick veto → sweep
Replace:   loss real? (O(1)) → loss ≥ LOSS_MIN → Spike Tick veto → sweep → recovery
```

On an erratically-moving enemy, Preplace costs **one float comparison per tick**
and never sweeps. That is worth more than any micro-optimisation of the sweep
itself.

### Incremental recalculation

`removedObjects` and `spawnedObjectSids` are deltas the client already
maintains. Revalidation applies them to the tick's `visibleObjects` snapshot
(stale-action design §3) instead of rebuilding anything — which is also what
corrects the dead-object bias, so the incremental path is the *correct* path, not
just the fast one.

### Candidate caching

Cache the per-tick sweep result keyed on `(itemId, doomedSet)`. Preplace and
Replace both want spike and trap angles from nearly the same object set; a
tick-scoped memo means the second asker pays nothing. Bounded to the tick,
discarded with the context.

### Selective rescanning

Anchor the sweep at the bearing toward the predicted enemy position, fine near
that bearing and coarse elsewhere (preplace design §4), rather than 72 uniform
angles from 0. Same or lower total probes, concentrated where placements happen
instead of spending half the budget behind the player.

### Prediction invalidation

A direction change zeroes stability and floors confidence below `CONF_MIN` in the
same tick (preplace design §3), which short-circuits at gate 1. Invalidation is
therefore also the cheapest path through the system.

### Squared distances

In Preplace/Replace-local geometry only — free, and it avoids `Math.sqrt` per
object. Measured at roughly 2× on the sweep, which is immaterial in absolute
terms (§1) but costs nothing to have.

---

## 6. What is not touched

Per "do not optimize by changing unrelated NovaStorm systems":

| left alone | why |
|---|---|
| `checkItemLocation` (18557) | shared with Auto Place, Spike Tick, Auto Mills, manual keys. The grid that would have justified touching it does not pay for itself (§2) |
| `canPlace` / `getConfig` (12790, 12782) | shared; Preplace passes the existing `velocity` flag rather than changing them |
| `getPrePlaceAngles` (13061) | shared with `canTrapTick`, `canSmartTick`, `canShamePlace`, `canShamePlus`, `advancedShameCombat`. Preplace/Replace use a local anchored variant; the shared function is unchanged |
| `place()` (12737) | shared. Batching `selectToBuild`/`selectWeapon` across several placements would help Auto Place's loop, not Preplace/Replace, which place at most one object |
| `updateAngles`, `checkPredictObjects`, `isAutoPlaceAngle` | frozen by the Auto Place contract |
| the six Spike Tick predicates | frozen by the Spike Tick contract |
| `io.send`, the `packets` counter, the packet layer | out of scope |

The only shared-code speedup is **negative**: removing Preplace's three calls
into `canTrapTick`/`canShamePlace` (13149, 13152, 13168) makes the shared
functions run less often without altering them.

---

## 7. Verification

- **PF1** — sweeps per tick attributable to Preplace + Replace ≤ 2.
- **PF2** — no `getPrePlaceAngles` call from inside a per-candidate filter.
- **PF3** — `canTrapTick`, `canSmartTick`, `canShamePlace`, `canShamePlus`,
  `advancedShameCombat`, `canAutoShame` are each evaluated at most once per tick.
- **PF4** — with Preplace and Replace idle, packets attributable to them = 0.
- **PF5** — aborted commits send zero packets (SV7).
- **PF6** — no new per-tick allocation beyond the tick context.
- **PF7** — `checkItemLocation`, `canPlace`, `getConfig`, `place`,
  `getPrePlaceAngles` are byte-identical.

PF3 is the one that captures the actual Phase-1 defect: not that a sweep is slow,
but that the same predicate is evaluated repeatedly from inside a filter.

---

## 8. Still open

1. **`isItemLimit`** — global fix (recommended) or shadowed?
2. **Spike Tick imminence** — active-only, cheap-prefix predicate (recommended),
   or one additive line in the Spike Tick block?
3. **Output target** — the blocker. NovaStorm 1.4 is not in this repo, which
   builds `ReUp_Mix.user.js` from `src/RYN_Client_v4.js` via
   `tools/build-reup.js`. Add NovaStorm as its own source with its own build
   path, or port Preplace + Replace onto ReUp Mix's `AutoPlacer`?
