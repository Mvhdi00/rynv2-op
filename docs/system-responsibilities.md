# System responsibilities — the contract

Binding for all subsequent phases. Line numbers refer to
`novastorm_1.4_ryn.user.js` as supplied.

---

## 1. The charter

| system | owns |
|---|---|
| **Auto Place** | Immediate / current combat placement |
| **Preplace** | Predictive future placement |
| **Replace** | Replacement decisions for existing objects |
| **Spike Tick** | Spike execution timing and urgent spike opportunities |

**Rules**

1. Preplace must not become another Auto Place.
2. Replace must not become another Auto Place.
3. Preplace and Replace must not become another Spike Tick.

**Must not create**

- a second placement engine
- a second target tracker
- a second packet scheduler
- a conflicting prediction engine

The conflict map already established that all four of those exist in NovaStorm
today (`predictObjects`/`addPredictObject`/`getPredictObjects`; the shared world
state block at 14120-14149; the `packets` counter at 1522/20182; the
`xVel/yVel` extrapolation at 14016). This document adds nothing to that list —
it constrains what may be built on top of it.

---

## 2. Ownership matrix

What each system is permitted to decide, and what it must instead read from the
shared layer.

| | Auto Place | Preplace | Replace | Spike Tick |
|---|---|---|---|---|
| decides *whether* to act | yes | yes | yes | yes |
| decides *where* (angle) | yes | yes | yes | **no** |
| decides *when* (timing) | no — immediate | **yes** | **yes** | **yes** |
| picks a target object | no | no | **yes** | yes (`smartTickObject`) |
| owns the enemy model | no — shared | no — shared | no — shared | no — shared |
| owns collision test | no — shared | no — shared | no — shared | no — shared |
| owns the intent queue | no — shared | no — shared | no — shared | n/a |
| emits packets directly | no — via queue | no — via queue | no — via queue | **no** |

Three consequences worth stating plainly:

- **Spike Tick never chooses a placement angle.** It schedules weapon/hat
  sequences (`instaKill`, 14855-14886) and consumes an object someone else
  identified. If a change would have Spike Tick pick an angle, it belongs in one
  of the other three.
- **Only Replace picks the object being replaced.** Preplace reasons about
  geometry and timing; the "which existing object is about to stop existing"
  question is Replace's alone.
- **Timing is what separates the three placers.** Auto Place is immediate,
  Preplace is predictive-ahead, Replace is reactive-to-loss. Angle-selection
  logic that ignores timing is by definition Auto Place's.

---

## 3. Current violations

The rules are not aspirational — the shipped code breaks all three.

### 3.1 Preplace has already become a looser Auto Place (rules 1, 2)

Side by side, from source:

| Preplace — `isPrePlaceAngle` (13088) | Auto Place — `isAutoPlaceAngle` (13185) |
|---|---|
| P3 `isSpike && enemyTrapped && prePlaceObject !== enemyTrapped && config === closestSpikeToEnemy` | A1 `enemyTrapped && config === closestSpikeToEnemy` |
| P5 `isSpike && config === closestSpikeToKb && !canShamePlace()` | A2 `closestSpikeToKb && config === closestSpikeToKb` |
| P6 `isSpike && enemyTrapped && !blockLOSFuture && !blockLOSEnemy && prePlaceObject !== enemyTrapped` | A3 `enemyTrapped && !blockLOSFuture && !blockLOSEnemy` |
| **P7 `if (isTrap) return true;`** | A-trap2 `if (neitherTrapped) return true;` |

Three of Preplace's seven rules are Auto Place's three spike rules with one extra
qualifier bolted on. None of them consults the prediction that is supposed to
justify Preplace existing — they test *current* geometry, exactly as Auto Place
does.

P7 is worse than a copy. Auto Place's trap fallback is guarded by
`neitherTrapped`; Preplace's is **unconditional**. Preplace's trap rule is a
strictly more permissive version of Auto Place's, in the system that is supposed
to be the more selective of the two.

### 3.2 Preplace has already become partly Spike Tick (rule 3)

```js
if (isSpike && canSpikeTick && canTrapTick())   return true;   // 13149
if (isTrap  && canRetrap   && canShamePlace())  return true;   // 13152
if (isSpike && ... && !canShamePlace())         return true;   // 13168
```

`canTrapTick()` (12705) is Spike Tick's own trigger predicate — the same function
called at 14871 to arm the `instaKill` queue. Preplace calls it per candidate
angle. `canShamePlace()` (12602) is shame combat's.

So Spike Tick's menu toggle (`window.vars.shameTick`, default off) silently
changes which angles Preplace considers valid, and Preplace re-runs Spike Tick's
decision function up to once per angle. Rule 3 is broken in both directions:
Preplace is making spike-tick judgements, and Spike Tick's configuration is
leaking into placement geometry.

There is also a vestigial channel: `smartTickSpike` (1473) is written **only by
Preplace** (nulled 13344, assigned 13443) and read nowhere in the file.

### 3.3 Replace has no responsibility at all

Replace as shipped is:

```js
setTimeout(function () {
    if (spamPrePlacer) {
        for (let object of predictObjects) {
            if (!object.preplace) continue;
            if (packets + 5 > 119) break;
            place(object.id, object.angle);
            ...
        }
    }
}, 111 - minPingTime);                                    // 15476-15489
```

It makes no decision. It re-sends Preplace's decision at a second offset. Under
the charter it is not a system — it is a retry.

---

## 4. The mismatch that has to be resolved before Phase 2

**The charter's "Replace" work is currently being done inside Preplace, and the
thing named Replace is doing something else entirely.**

`getPrePlaceObject()` (13284) answers exactly one question: *which existing
object is about to stop existing?* It scans for objects our next hit will break
(13286-13295) or the enemy's next hit will break (13297-13315), and returns one.

By the charter, "replacement decisions for existing objects" **is that
function**. It lives in Preplace, and its result (`findObject`) is what drives
Preplace's entire angle search — the splice at 13355 that makes preplacing work
at all.

Meanwhile the code named Replace contributes a duplicate packet.

So the names and the responsibilities do not line up, and rules 2 and 3 cannot be
applied as written until they do — "Replace must not become another Auto Place"
has no purchase on a system that currently makes no placement decision.

Two coherent ways to resolve it. **This is your call, not mine:**

**Option A — align the code to the charter.** `getPrePlaceObject` becomes
Replace's target acquisition. Replace owns "an object of ours is about to die,
here is what should occupy that space and when." Preplace is then freed for its
charter role: predictive placement ahead of where the enemy *will be*, driven by
the movement model rather than by an object about to break. The current
`spamPrePlacer` retry becomes a transport concern of whichever system owns the
commit, not a system.

- Cost: Preplace needs a genuine predictive trigger it does not currently have,
  because today it has no reason to fire without a doomed object.
- Benefit: each rule in §1 becomes checkable, and Replace stops being a duplicate
  send.

**Option B — keep the current names, restate the charter.** Preplace keeps
doomed-object-driven placement (what it does now), and Replace is defined as the
*confirmation and recovery* stage — fire only when the first commit demonstrably
did not land, using `spawnedObjectSids` (written 11979, never read).

- Cost: "Preplace" continues to mean something closer to replacement.
- Benefit: no re-split; every improvement already scoped stays where it is.

I lean **B** for this codebase. It matches how the code is actually structured,
it keeps the Phase-1 findings applicable without re-mapping, and it gives Replace
a real decision to own (did it land?) rather than inventing a predictive trigger
for Preplace that the mod has never had. But A is the honest reading of the
charter as written, so if the charter is the fixed point, say so and I will plan
against A.

---

## 5. Invariants to check per phase

Whichever option is chosen, these are mechanically checkable and I will verify
each before proposing code.

**Separation**

- I1 — no Preplace or Replace rule calls `canTrapTick()`, `canSmartTick()`,
  `canShamePlace()`, `canShamePlus()` or `advancedShameCombat()`. (Today:
  violated at 13149, 13152, 13168.)
- I2 — every Preplace/Replace acceptance rule references at least one
  prediction or timing term. A rule testing only current geometry is Auto
  Place's. (Today: violated by P3, P5, P6, P7.)
- I3 — no Preplace or Replace rule is a strict superset of an Auto Place rule.
  (Today: violated by P7 vs A-trap2.)
- I4 — Spike Tick never computes or selects a placement angle.
- I5 — `smartTickSpike` is either read by Spike Tick or deleted; it is not left
  as a write-only channel from Preplace.

**No duplicate infrastructure**

- I6 — every placement intent is constructed by `addPredictObject` (12825). No
  second producer path, no direct `place()` call from a placement system.
- I7 — `place()` is called from at most the four existing sites (12746, 15423,
  15470, 15482). A new call site means a second placement engine.
- I8 — target objects come from the shared world block (14120-14149). No system
  builds its own `visibleObjects`-equivalent.
- I9 — enemy position prediction has exactly one producer. Improving `xVel/yVel`
  (14016) is permitted; adding a parallel predictor is not.
- I10 — no new timer registration outside the existing block (15454-15489), and
  no `setInterval` in any placement path.
- I11 — packet admission is decided against the existing `packets` counter
  (1522). No second budget.

**Behaviour preservation for out-of-scope systems**

- I12 — Auto Place's chosen angle set is unchanged for a given tick state,
  except where a shared fix (`isItemLimit`) intentionally corrects it.
- I13 — Spike Tick's `instaKill` token sequence is unchanged.
- I14 — Auto Mills, manual place keys and turret grind continue to reach the
  immediate loop with `preplace: false`.

---

## 6. Standing constraints on the work

- Shared helpers (`getPrePlaceAngles`, `canPlace`, `getConfig`, `isItemLimit`,
  `place`, `addPredictObject`) may be made **faster** with identical results —
  that benefits all four systems and is the sanctioned integration.
- Shared helpers may **not** have their decision semantics changed for
  Preplace/Replace's benefit. Behaviour changes go in Preplace/Replace-local
  variants.
- `isItemLimit` (12836) is the one exception: restoring Luna's correct expression
  is a regression fix that returns all four systems to the behaviour they were
  written against, not a scope expansion.
- The two integration touch points remain as identified in the conflict map —
  the intent constructor (12825) and the timer registration block (15454-15489).
  Nothing in this contract requires a third.

---

No NovaStorm code has been modified.
