# Stale action prevention

Design only. No NovaStorm code has been modified. Line numbers refer to
`novastorm_1.4_ryn.user.js`.

Applies to the two deferred commit sites — Preplace and Replace mode A, both
firing from the timer block at 15454-15489. Replace mode B commits inside the
tick body with no gap, so its validation is its admission check.

---

## 1. What can actually change in the commit window

Revalidation is only rigorous if it is grounded in what can genuinely go stale.
The window is decision (tick body, ~T+1 ms) to commit (~T+71 to T+96 ms). I
traced every writer.

**Provably constant across the window:**

| state | why | verified |
|---|---|---|
| `myPlayer.x2 / y2` | written only in `updatePlayers` | 14013; the other `.x2 = data[...]` at 12061 is `updateAI` (animals) |
| `nearestEnemy.x2 / y2`, `xVel / yVel` | same parse loop | 14013-14017 |
| `visibleObjects` array identity | rebuilt only in the tick body | 14122 |
| `spikes_our`, `traps_our`, `imTrapped` | same | 14126-14131 |
| `instaKill`, `insta.*`, `predictWeapon` | written only in the tick body | 14855-14949 |
| the Auto Place selectors | derived from the above | 12933-13045 |
| `predictMoveAngle`, confidence | tick body | 14524 |

**Can change during the window:**

| state | packet | handler |
|---|---|---|
| an object dies | `"Q"` | `killObject` → `removedObjects.push(sid)` (10577) |
| an object appears | `"H"` | `loadGameObject` → `spawnedObjectSids.push(sid)` (11979) |
| object health | `"O"` | `updateHealth` (13616) |
| our item counts | `"S"` | `updateItemCounts` (12160) |
| packet budget | any send | `packets++` (20182) |
| **a whole new tick arrives** | `"a"` | `updatePlayers` (13982) — replaces every row in the first table |

That last row is the important one. Everything in the first table is constant
*within* a tick and wholly replaced *between* ticks. So one comparison subsumes
all of it.

---

## 2. Guard 0 — the tick generation check

Every intent is stamped with `tick` at creation (integration design §4.1). At
commit:

```
if (intent.tick !== tick) → ABORT
```

`tick` is incremented at 13983, the first statement of `updatePlayers`. If it has
moved, the entire world snapshot the decision rested on has been replaced —
enemy position, enemy movement, predicted position, player position, Auto Place's
selectors and Spike Tick's state, all at once.

This is one integer comparison and it covers six of the ten listed conditions
outright. It also closes conflicts C2 and C3 from the conflict map: a timer from
tick N firing after tick N+1 has begun is precisely `intent.tick !== tick`.

It is not an optimisation standing in for real checks — it is the *correct*
check, because those values genuinely cannot change by any other route.

---

## 3. Guard 1 — the dead-object bias

This one is counterintuitive and matters more than the rest.

`killObject` (10574) calls `objectManager.disableBySid` (18501), which splices
the object out of `gameObjects` — and **does not set `active = false`**:

```js
this.disableBySid = function (sid) {
    for (const object of gameObjects) {
        if (object.sid != sid) continue;
        gameObjects.splice(gameObjects.indexOf(object), 1);
        break;
    }
};
```

`visibleObjects` (14122) is a *separate filtered array holding references*, so
the dead object is still in it, still with `active === true`. And
`checkItemLocation` (18557) rejects on `objects[i].active && distance < s + blockS`.

**So a naive `canPlace` at commit time still counts objects that died during the
window as blockers.** The bias is one-directional: revalidation would cancel
placements that are in fact legal — including, precisely, the replacement of an
object that just died, which is Replace's entire purpose.

The correction is already in hand. `removedObjects` (10577) is appended live by
`killObject` during the window and is not cleared until 13333, inside the *next*
tick's `getPredictObjects`. So revalidation filters against it:

```
effectiveObjects = visibleObjects  minus  removedObjects  minus  intent.doomed
```

No new tracking. This uses the same array Replace mode B reads for loss
detection.

---

## 4. Guard 2 — the volatile checks

Only these need real work, and only after guards 0 and 1 pass.

| # | condition | check | on failure |
|---|---|---|---|
| V1 | target | Replace: did `intent.targetSid` actually die? (`removedObjects`) For mode A the premise was a *prediction* — if the object is still standing, the prediction was wrong | ABORT |
| V2 | collision | `canPlace` against `effectiveObjects` (§3) | REPAIR, else ABORT |
| V3 | placement range | is the stored world point still at the fixed radius `35 + scale + (placeOffset\|\|0)`? | REPAIR |
| V4 | item limit | `isItemLimit` — `itemCounts` can change mid-window via packet `"S"` | ABORT |
| V5 | Auto Place ownership | the oracle: would `isAutoPlaceAngle` now claim this angle? | ABORT (yield) |
| V6 | Spike Tick | `spikeTickActive`, plus the protected annulus `dist(candidate, enemy) < scale + 55` | ABORT (defer) |
| V7 | packet availability | existing `packets + 5 > 119` guard (15468), and the precedence ordering | ABORT |
| V8 | already satisfied | did something already appear at this spot? (`spawnedObjectSids`, 11979) | ABORT |

V5 and V6 are strictly redundant with guard 0 — the values they read cannot
change within a tick — but they cost two flag reads and they are the conditions
you named explicitly, so they stay as belt-and-braces rather than being argued
away.

V8 is new capability, not just a check: `spawnedObjectSids` is written every tick
and read nowhere today. If our own placement already landed, or an ally filled
the gap, the commit is redundant and is dropped.

---

## 5. Repair, replan, abort

You asked for "cancel and replan". Those are two different things and they belong
at two different places.

**REPAIR — at commit, allowed.** The intent is "occupy world point P with item
I". If the player has moved but P is still at the placement radius, recompute the
angle:

```
newAngle = atan2(P.y − myPlayer.y2, P.x − myPlayer.x2)
```

One `atan2` and one `canPlace`. This is not a new decision — the same point, the
same item, the same tactical justification; only the transmitted angle is
corrected. Whiteout's `check3` (`Whiteout_v4.js:12592`) does the mirror of this,
recomputing the *point* from the stored angle.

Bounded local search — probing a few neighbouring angles when P itself is blocked
— is permitted only under a hard probe cap, only when the value terms still hold,
and only when nothing else in §4 failed. Whiteout's dead replacer bounds such a
scan geometrically (`angleDiffEdge = Math.asin(radius / dist)`,
`Whiteout_v4.js:9645`), which is the right shape if this is enabled at all. My
recommendation is to ship without it and add it only if measurement shows repair
failing often.

**REPLAN — at the decision point, one tick later.** A full re-derivation at
commit would mean deciding outside `getPredictObjects`, which is a second
decision point and therefore a second placement engine — the thing the
integration brief forbids. So cancellation raises a flag that the *next* tick's
decision point reads:

```
replanHint = { position: P, reason, tick }
```

The next `getPredictObjects` sees the hint, re-derives with fresh state, and
either produces a new intent or does not. Cost of the delay: one tick, ~111 ms.
That is an accepted cost — a missed preplace is cheaper than a wrong one, which
is your own rule.

**ABORT — always silent.** No packet, intent retired, position placed in
cooldown. No `clearTimeout` is introduced anywhere: the timer fires and declines.

---

## 6. Your ten conditions, mapped

| condition | guard | can it change in-window? |
|---|---|---|
| target | V1 | **yes** — `removedObjects` |
| enemy position | guard 0 | no — `x2` is tick-written only |
| enemy movement | guard 0 | no — same parse loop |
| predicted position | guard 0 | no — derived in the tick body |
| candidate validity | V2 + V3 | **yes** |
| collision | V2 (+ §3 correction) | **yes** |
| placement range | V3 | **yes** — via player movement across a tick |
| current Auto Place action | V5 + guard 0 | no |
| current Spike Tick action | V6 + guard 0 | no |
| packet availability | V7 | **yes** |

Five are genuinely volatile; five are tick-scoped and covered by one integer
comparison. Checking all ten is correct; understanding which five actually do
work is what keeps the gate cheap enough to run on every commit.

---

## 7. Cost

Per deferred commit, in the common path:

- guard 0 — one integer comparison, rejects the cross-tick case outright
- guard 1 — one small-array filter (`removedObjects` is usually empty)
- V1, V4-V8 — flag and count reads
- V2 — one `canPlace`, the only non-trivial item: O(|effectiveObjects|)
- V3 — one distance, one `atan2` if repairing

One `canPlace` per commit, against at most two commits per tick. Set against
what the same block currently spends — two wrong-arity 72-angle sweeps at
15459-15460 whose results are discarded — revalidation is **cheaper than the
code it replaces**.

---

## 8. Verification

Adds to I1-I14, AC1-AC6, ST1-ST7, IN1-IN8:

- **SV1** — no deferred commit calls `place()` without the gate returning true.
- **SV2** — no commit executes with `intent.tick !== tick`.
- **SV3** — collision revalidation excludes `removedObjects`; a placement legal
  only because an object died during the window is **not** cancelled (§3).
- **SV4** — repair changes only the transmitted angle, never the item, the target
  point, or the tactical justification.
- **SV5** — no re-derivation of candidates occurs inside a timer callback; replan
  happens only in `getPredictObjects`.
- **SV6** — still no `clearTimeout` in the placement path.
- **SV7** — an aborted commit sends zero packets, including no `io.send("D", ...)`.

SV7 matters because the current commit sites send a direction packet
unconditionally alongside each `place()` (15472, 15484). An aborted commit must
send nothing at all.

---

## 9. Open

Unchanged, and all three are now the only things between these designs and code:

1. **`isItemLimit`** — global fix (recommended) or shadowed? V4 depends on it.
2. **Spike Tick imminence** — active-only, cheap-prefix predicate (recommended),
   or one additive line in the Spike Tick block? V6's depth depends on it.
3. **Output target** — the blocker. NovaStorm 1.4 is not in this repo, which
   builds `ReUp_Mix.user.js` from `src/RYN_Client_v4.js` via
   `tools/build-reup.js`. Add NovaStorm as its own source with its own build
   path, or port Preplace + Replace onto ReUp Mix's `AutoPlacer`?
