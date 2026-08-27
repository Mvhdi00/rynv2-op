# Auto Place compatibility contract

Binding on the Preplace and Replace designs. Design only — no NovaStorm code has
been modified. Line numbers refer to `novastorm_1.4_ryn.user.js`.

---

## 1. The frozen surface

These are not edited, wrapped, shadowed, or reimplemented:

| function | line |
|---|---|
| `updateAngles` | 12892 |
| `checkPredictObjects` | 12923 |
| `isAutoPlaceAngle` | 13185 |
| the Auto Place branch in `getPredictObjects` | 13511-13515 |
| the immediate commit loop | 13049, 13056 → 15419-15426 |

Auto Place's decision logic stays exactly as it is, including its known defects
(the 6-argument `willRetrap` at 13226 that always returns `true`, the dead
`window.vars.placeRange` slider). Those are recorded in the Phase-1 trace and
deliberately left alone — fixing them would change Auto Place's placement set,
which this contract forbids.

### The one unavoidable change

`isItemLimit` (12836). `let limit = (group.sandboxLimit || 99)` never fires for
spikes (`limit: 15`) or traps (`limit: 6`), because neither group carries a
`sandboxLimit`. Auto Place therefore keeps proposing placements the server
discards.

This is a regression against Luna (11296), which NovaStorm's placer is copied
from verbatim, and it sits inside `canPlace` — so it affects Auto Place whether
or not Preplace and Replace change at all. Restoring it *does* alter Auto Place's
output: it will stop emitting impossible placements once at the cap.

I am flagging it rather than assuming it. **If you want Auto Place bit-identical,
say so and I will shadow the fix into Preplace/Replace only** — at the cost of
the two systems disagreeing with Auto Place about what is placeable, which will
cause its own confusion later. My recommendation is to take the fix globally.

---

## 2. Ownership oracle — reuse, do not reimplement

`isAutoPlaceAngle(config, closestSpikeToEnemy, closestTrapToEnemy,
closestSpikeToKb)` (13185) is a pure function of its arguments plus tick
globals. It is therefore directly callable as the authority on "does Auto Place
want this angle".

**Preplace and Replace call it. They do not restate its rules.** That is the
whole of requirement "do not duplicate Auto Place logic" — the moment either
system contains a copy of `enemyTrapped && config === closestSpikeToEnemy`, the
two will drift.

The three selector arguments must be the ones Auto Place would compute — i.e.
against the **current** enemy position and the **unspliced** object set. Preplace
already computes exactly these for its `V_now` term, and Replace computes them
for `loss`. No extra work is introduced.

Note the broken `willRetrap` is harmless here: it only gates trap rule T1, which
T2 (`if (neitherTrapped) return true`) already subsumes. The oracle's answer is
unaffected.

---

## 3. Preplace yield rule

> If `isAutoPlaceAngle(candidate, …current selectors…)` returns true, Preplace
> yields that candidate. No exception, no override.

Evaluation order — cheapest first, so the oracle runs on a small set:

1. `conf >= CONF_MIN` (per-tick, O(1))
2. `V_future >= VALUE_MIN`, `gain >= GAIN_MIN` (per candidate, arithmetic)
3. **ownership oracle** (per surviving candidate, one call)

Requirement "Preplace should act only when its predictive advantage is
meaningful" is already the `gain` gate from `preplace-design.md` §1. The oracle
is a second, independent filter: a candidate can have high `gain` *and* be
something Auto Place would take right now, and in that case Auto Place takes it.

### What this leaves Preplace

This has a consequence worth being direct about, because it is large.

Auto Place's two broadest rules are effectively unconditional:

```js
if (enemyTrapped && !blockLOSFuture && !blockLOSEnemy) return true;   // A3, any spike angle
if (neitherTrapped) return true;                                     // T2, any trap angle
```

So the yield rule confines Preplace to the complement:

| state | spikes | traps |
|---|---|---|
| enemy trapped | **Auto Place** (A3 takes nearly every angle) | Preplace available (T2 off) |
| I am trapped | Preplace available | Preplace available (T2 off) |
| neither trapped | Preplace available (A3 off) | **Auto Place** (T2 takes every angle) |

The split is clean and complementary — Preplace owns spikes in the neutral state
and traps in the trapped state — but it is a **substantial reduction** in how
often Preplace fires compared to today, where it queues first and wins the dedup
race unconditionally (13476 runs before 13511).

That is the correct outcome under your rules, and it is consistent with the
original brief's "more selective". I want it acknowledged rather than discovered
in testing.

---

## 4. Replace: preserve the role, don't just match the score

> Replace must not replace an object currently required by Auto Place unless the
> replacement clearly improves the situation.

"Required by Auto Place" is computable from what Auto Place already produces. An
object is load-bearing when Auto Place's accepted rules depend on it:

| dependency | the rule it feeds | line |
|---|---|---|
| the trap the enemy is in (`enemyTrapped`) | gates A1 and A3 entirely | 13196 |
| a `spikes_our` member that is a knockback target | `closestSpikeToKb` exists at all | 13416-13432 |
| an object whose absence changes `imTrapped` | `neitherTrapped` → T1, T2 | 13257 |

The refinement this forces on `replace-design.md` §2: the scalar test
`recov >= loss * RECOVERY_MIN` is **not sufficient**. A replacement can match
aggregate usefulness while destroying the specific role Auto Place depended on —
put a trap where a knockback-target spike was, and `closestSpikeToKb` silently
becomes undefined, disabling Auto Place's A2 rule.

So the test becomes per-role:

```
for each Auto-Place-dependent role R that the dying object filled:
    recov_R >= loss_R          // the replacement must fill R too
aggregate:
    recov >= loss * RECOVERY_MIN
```

"Clearly improves the situation" is the documented override: a replacement may
drop a role only when its aggregate gain exceeds `ROLE_OVERRIDE_MARGIN` — a
deliberately high bar, not the ordinary threshold.

This costs nothing extra to compute. The role terms are already the top rows of
the `usefulness()` table in `replace-design.md` §4.

---

## 5. Existing state to reuse

Verified present. Nothing on this list is to be recreated:

| information | where |
|---|---|
| does Auto Place want this angle | `isAutoPlaceAngle` (13185) |
| Auto Place's high-value picks | `closestSpikeToEnemy` / `closestTrapToEnemy` / `closestSpikeToKb` (12933-13045) |
| angle placeability + boundary angles | `canPlace` (12790), `getPerfectAngles` (13072) |
| which intents are queued this tick, and by whom | `predictObjects` + the `preplace` flag (12208, 12831) |
| spatial arbitration between intents | `addPredictObject` (12825) |
| recently-placed / failed angles | `placedAngles`, `bannedAngles` (1471-1472, 12902) |
| object ownership | `isObjectOur` (12870), `isObjectMine` (12879) |
| our structures by class | `spikes_our`, `traps_our`, `turrets_our` (14126-14128) |
| trap containment state | `enemyTrapped` pattern (13096), `imTrapped` (14131) |
| item counts vs limits | `myPlayer.itemCounts`, `items.list[id].group.limit` |
| Spike Tick's current action | `instaKill`, `insta.*` (14855-14949) |
| landing evidence | `spawnedObjectSids` (11979) |
| loss evidence | `removedObjects` (10577) |
| packet budget | `packets` (1522) |
| angular distance | `UTILS.getAngleDist` (20325) |

---

## 6. Ordering — no reorder required

The obvious way to give Auto Place priority is to move its branch (13511) ahead
of Preplace's (13342) so it wins the dedup race. **That is not being done.**

Reordering changes which system wins `addPredictObject`'s spatial dedup, which
changes Auto Place's emitted placement set — precisely what §1 freezes. The
ownership oracle achieves the same result without touching the order: Preplace
declines the candidate before queueing it, so the slot is still free when Auto
Place runs.

Producer order therefore stays: Preplace/Replace (13476) → Auto Place (13511) →
Auto Mills → manual keys → grind. The only behavioural difference is that
Preplace now queues far less.

One consequence this fixes for free: conflict C1 from the conflict map — Preplace
reserving a slot via dedup and then committing 111 ms later or not at all. With
the yield rule, any slot Auto Place could have used immediately is never reserved
by Preplace in the first place.

---

## 7. Verification

Checkable before any code is proposed, in addition to invariants I1-I14:

- **AC1** — the five frozen functions in §1 are byte-identical, `isItemLimit`
  excepted per §1.
- **AC2** — no string from `isAutoPlaceAngle`'s rule bodies appears in any
  Preplace or Replace function. Duplication is textual and greppable.
- **AC3** — for a fixed tick state, the set of angles Auto Place emits is a
  **superset** of what it emits today. It can only gain slots Preplace used to
  take; it can never lose one.
- **AC4** — no Preplace intent exists in a tick where the oracle returns true for
  the same `{id, angle}`.
- **AC5** — no Replace intent drops an Auto-Place-dependent role without clearing
  `ROLE_OVERRIDE_MARGIN`.
- **AC6** — `place()` call sites remain the four at 12746, 15423, 15470, 15482.

AC3 is the one that most directly encodes "do not change Auto Place's existing
behavior": its output may grow, never shrink.

---

## 8. Open

1. **`isItemLimit` scope** (§1) — global fix, or shadowed into Preplace/Replace
   only to keep Auto Place bit-identical? I recommend global.
2. **The narrowed Preplace window** (§3) — confirm you want the strict yield
   rule. The alternative is to let Preplace override Auto Place's A3/T2 rules
   specifically, on the grounds that those two are near-unconditional catch-alls
   rather than considered placements. That would keep Preplace materially more
   active, at the cost of Auto Place losing slots it currently wins.
3. **Output target** — still the only blocker to implementation. NovaStorm is not
   in this repo, which builds `ReUp_Mix.user.js` from `src/RYN_Client_v4.js`.
