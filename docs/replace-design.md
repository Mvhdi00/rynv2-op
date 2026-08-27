# Replace — upgraded design

Design only. No NovaStorm code has been modified.

Line numbers: `novastorm_1.4_ryn.user.js` unless prefixed. Luna references to
`Luna_Fixed.user.js`, verified in `luna-replace-analysis.md`. Companion to
`preplace-design.md`.

---

## 0. What Replace owns

Per `preplace-design.md` §0, Preplace is now movement-driven, so
`getPrePlaceObject()` (13284) — "which existing object is about to stop
existing" — moves here. That function plus everything below is Replace.

Luna's contribution, precisely: a **target finder** worth keeping and fixing
(11746), a **reload-edge trigger** worth keeping as-is (11765), a **correct
`isItemLimit`** (11294), and a **retry** (14001) that is not a decision system at
all. Luna's `spamPrePlacer` re-sends unconditionally with no success check; that
behaviour is not carried forward. What survives of it is the *idea* of a second
attempt, made conditional in §10.

---

## 1. Two modes

Luna has neither of these — it has one blind duplicate send.

**Mode A — anticipatory.** An object of ours is predicted to die this tick.
Place the replacement so the gap never opens. Commits in the same window as
Preplace (`111 - tickPing()`), because the placement must land in the tick the
object dies.

**Mode B — recovery.** An object of ours actually died, or one of our own
placements did not land. Fill the gap now. Commits immediately in the next tick
body.

Mode B already has its detection hook in the file. The `FIX STACK PACKETS` block
(13324-13333) checks whether the tracked object appears in `removedObjects`
(filled by `killObject`, 10577) and responds by writing `placeTick` — declared
12207, written 13329 and 13566, **read nowhere**. The detection is correct and
the action is missing. Mode B is what that block was reaching for.

`removedObjects` is cleared at 13333, inside `getPredictObjects`, so Replace —
which runs inside `getPredictObjects` — reads it before the clear. No new
plumbing.

---

## 2. The discriminator

Preplace's rule is `gain = V_future − V_now`. Replace's is a loss/recovery pair:

```
loss  = usefulness(dyingObject,  enemyState)     // what the gap costs us
recov = usefulness(candidate,    enemyState)     // what the replacement restores
```

**Replace acts only when `loss >= LOSS_MIN` AND `recov >= loss * RECOVERY_MIN`.**

The first half is the brief's rule stated as code: *an object that was doing
nothing is not worth replacing, however easy the replacement is.* Luna has no
such gate — its filter is `!hideFromEnemy && withinEnemyWeaponRange &&
health <= dmg` (11774), i.e. "technically about to break" with no notion of
whether the object mattered.

The second half prevents trading a useful object's position for a worse one, and
prevents spending a scarce item (§4, cost term) to recover a cheap loss.

Both halves must hold. Neither is a tie-break.

---

## 3. Target qualification

`getPrePlaceObject` is kept and its branch B is brought up to branch A's
standard. Luna's branch A (11749-11757) already has the right filter shape —
range, **aim cone**, lethality, accurate hat multiplier — sitting three lines
above a branch B (11764-11776) that has only range and lethality.

| filter | Luna A | Luna B | designed |
|---|---|---|---|
| reload edge (`lastXReload < XReload`) | — | yes (11765-11771) | **yes**, kept |
| within weapon range | yes | yes | yes |
| aim cone (`config.gatherAngle` vs `d2`) | yes (11754) | **no** | **yes** |
| lethal this hit | yes | yes | yes |
| hat multiplier | accurate (11751) | `* 3.3` hard-coded (11772) | **accurate** |
| object is ours (`isObjectOur`, 12870) | — | **no** | **yes** |
| object type is a structure | incidental | incidental | explicit |
| all nearby enemies, not just `nearestEnemy` | — | no | **yes** |

Four of those are corrections to real defects:

- **Aim cone.** The enemy's facing is `d2`, parsed at 14020; `config.gatherAngle`
  is already used at 13304. An enemy facing away is not about to break anything.
- **Ownership.** Without `isObjectOur`, enemy-owned buildings inside the enemy's
  own weapon range qualify as replace targets. Replacing an enemy's spike is not
  a coherent action.
- **Hat accuracy.** `skinIndex` is parsed per player at 14031, so
  `skinIndex === 40 ? 3.3 : 1` is free. Middle ground on the pessimism question
  raised earlier: use the accurate figure for the trigger, and treat a *near*
  miss (object survives by less than `NEAR_MISS_FRAC` of its health) as a
  low-confidence trigger that must clear a higher `LOSS_MIN`. Certain deaths act
  freely; probable ones must be worth more.
- **All enemies.** `enemiesNear` (14084) is built every tick and read by no
  placer. A second enemy's hammer is as lethal as the nearest one's.

**Multi-object loss.** Luna splices exactly one object out of the collision set
(11814), so two of our objects dying to the same hit cannot both be reasoned
about. Replace collects a **set** of doomed sids and excludes all of them — the
generalisation Whiteout gets via `assumeBreak` + `checkItemLocation3` (6102). In
NovaStorm this is a filter predicate on the existing `customObjects` array, not a
new collision routine.

---

## 4. Current object usefulness

The heart of the design, and entirely new — Luna has no concept of it.

`usefulness(object, enemyState)` scores what an object is contributing *right
now*, from state already computed each tick:

| term | source | weight |
|---|---|---|
| it is the trap the enemy is currently caught in | `traps_our` + enemy position (as at 13096) | very high |
| it is in knockback contact with the enemy | existing spike-tick geometry (13130) | high |
| it seals an exit from a containment ring | §6 | high |
| it lies between us and the enemy (body-blocks) | segment test, existing LOS shape (13106) | medium |
| it intercepts the enemy's predicted path | Preplace's predicted enemy position (§7) | medium |
| it is a damaging structure near the enemy | `id > 5 && id < 10`, distance | low–medium |
| it is far from combat / seals nothing / traps nobody | — | **≈ 0 → no replace** |

The last row is the point. An object with near-zero usefulness fails
`loss >= LOSS_MIN` and Replace declines regardless of how placeable the spot is.

**Cost term** (subtracted from `recov`, not from `loss`): if placing the
replacement takes the group to its `group.limit`, the replacement is worth less,
because the next placement opportunity is forfeited. This requires the
`isItemLimit` regression fix (12836) to be in place — with the shipped
`group.sandboxLimit || 99` the cap never fires and every count here is wrong.

---

## 5. Replacement usefulness

`recov` is the **same function** evaluated on the candidate at its prospective
position, against the same enemy state. One function, two call sites — which is
what makes `recov >= loss * RECOVERY_MIN` meaningful rather than a comparison of
unlike quantities.

It is also the same shape as Preplace's `value()` (`preplace-design.md` §5).
Where the terms coincide — path interception, knockback-into-spikes, seals-exit,
blocks-own-path, blocks-LOS — they should be one scoring function shared by both
systems, differing only in which enemy state is passed in:

| system | scored against |
|---|---|
| Auto Place | current enemy position (existing behaviour, untouched) |
| Preplace | `V_future` vs `V_now` → `gain` |
| Replace | candidate vs dying object → `loss`/`recov` |

That is one scorer with three call patterns, not three scorers.

---

## 6. Escape routes

NovaStorm has **no** containment analysis — verified by search: no `isEscapable`,
no siege/surround logic anywhere in the file.

The primitive to port is in this repo already, at
`src/RYN_Client_v4.js:11935`, `SiegeAnalysis.isEscapable(cx, cy, selfRadius,
objects)`:

```js
arr.sort((a, b) => a.ang - b.ang);
for (let i = 0; i < len; i++) {
  const a = arr[i], b = arr[i + 1 < len ? i + 1 : 0];
  let gapAngle = Math.abs(a.ang - b.ang);
  if (gapAngle > Math.PI) gapAngle = 2 * Math.PI - gapAngle;
  const gapWidth2 = a.dist*a.dist + b.dist*b.dist - 2*a.dist*b.dist*Math.cos(gapAngle);
  const need = selfRadius * 2 + a.escapeScale + b.escapeScale + 10;
  if (gapWidth2 > need * need) exits.push({ angle: exitAng, width: Math.sqrt(gapWidth2) });
}
```

Sort surrounding objects by bearing from the enemy, measure the chord between
angular neighbours, compare against the width the enemy needs to fit through.
Companion `_sealsExit(cfg)` (`RYN_Client_v4.js:12689`) tests whether a candidate
closes one.

This is a **port of an algorithm from a different codebase**, not shared code —
about 30 lines, pure trigonometry, no dependencies. It is not a new subsystem and
it is not a second target tracker.

Two uses, which together are the sharpest available measure of the brief's
"current object usefulness":

- **`loss`** — run `isEscapable` on the ring around the enemy twice: as it stands,
  and with the dying object removed. Exits that appear only in the second run are
  precisely what its death costs. Width-weighted.
- **`recov`** — does the candidate close those exits?

Guard: only run it when the enemy is actually ringed (RYN requires
`objects.length > 2`, 11936, and gathers only spikes within
`enemyScale + collisionScale + 40`, 12680). Otherwise it is skipped and
contributes zero, so the cost is bounded to the case where it matters.

---

## 7. Enemy state

Replace does **not** build its own enemy model. It reads the one Preplace's
design puts on the existing predictor site (`preplace-design.md` §2): current
position, velocity, direction, stability, one-tick predicted position, and
confidence.

Usage differs from Preplace's, and the difference matters:

- **Replace is not confidence-gated the way Preplace is.** A confirmed death
  (mode B) is a fact, not a prediction — low movement confidence must not block
  recovery. Confidence weights only the *predictive* terms in `usefulness`
  (path interception, predicted-position value); the positional terms
  (enemy-in-trap, knockback contact, seals-exit) stand on current geometry.
- **Mode A does depend on prediction**, but on *weapon* prediction (the reload
  edge, §3), not movement prediction. Those are independent, and Replace should
  not inherit Preplace's `CONF_MIN` gate wholesale.

Collision, placement range and existing-object handling are unchanged and shared:
`canPlace` → `isItemLimit` → `objectManager.checkItemLocation` (18557), and the
fixed radius `35 + scale + (placeOffset || 0)` in `getConfig` (12782). Candidate
generation reuses `getPrePlaceAngles` (13061) with the doomed **set** excluded.

---

## 8. Gates

Ordered cheapest-first, same discipline as Preplace.

| # | gate | test |
|---|---|---|
| R1 | a loss is real | mode A: qualified target (§3); mode B: `removedObjects` hit or unconfirmed landing |
| R2 | the loss matters | `loss >= LOSS_MIN` — **the brief's rule** |
| R3 | Spike Tick not mid-action | `instaKill.length === 0 && !insta.primary && !insta.secondary && !insta.turret && !insta.primaryturret` |
| R4 | not already handled | no in-flight replace for this position; not in cooldown |
| R5 | packet budget | graded against `packets` (1522) |
| R6 | a candidate exists | sweep with the doomed set excluded |
| R7 | the replacement recovers the loss | `recov >= loss * RECOVERY_MIN` |
| R8 | Auto Place does not own it | see below |
| R9 | still valid at commit | revalidation, §10 |

**R3 and invariant I1.** Same treatment as Preplace: read the *settled* flags,
never call `canTrapTick()` / `canShamePlace()` / `canSmartTick()`. Spike Tick's
predicates run at 14855-14886 and its executor at 14888-14949, both before
`getPredictObjects()` at 15416, so the flags are final and free. The three
predicate calls currently in `isPrePlaceAngle` (13149, 13152, 13168) are removed
and not reproduced here.

**R8, and an asymmetry worth stating.** Auto Place commits *immediately*;
Replace mode B commits in the same tick body but later in the producer order, and
mode A commits ~111 ms out. So:

- **Mode B**: if Auto Place would fill this position this tick with equal or
  better immediate value, **let it**. Filling the gap now beats filling it later.
  Replace claims only mode-B positions Auto Place declines.
- **Mode A**: the position is not yet free — the object is still standing — so
  Auto Place cannot claim it. No conflict; Replace's reservation is legitimate,
  and it is released the moment the intent is invalidated (§9), which is what
  closes conflict C1.

---

## 9. Intent lifecycle

At most one in-flight replace intent per lost position. Created through the
existing `addPredictObject` (12825) — no second producer path, per invariant I6 —
with the conflict-map fields:

```
{ id, angle, name, x, y, scale, preplace,          // existing
  owner: 'replace', mode: 'A'|'B', targetSid, tick } // added
```

`preplace: true` for mode A (deferred commit), `false` for mode B (immediate).
The existing boolean already routes execution correctly; no new dispatch.

| transition | condition |
|---|---|
| created | R1–R8 pass |
| invalidated | the target did **not** die (mode A prediction was wrong) |
| invalidated | Spike Tick raises an urgent action after creation |
| invalidated | revalidation fails at commit |
| committed | revalidation passes; one `place()` |
| retired | landing confirmed via `spawnedObjectSids`, or cooldown expires |

The second row is the one Luna cannot express: its commit fires whether or not
the predicted break happened.

---

## 10. Commit, revalidation, and the conditional retry

**Revalidation at commit**, per Whiteout's `check3` (12592) — recompute the
placement point from `myPlayer.x2/y2` *now*, re-run `canPlace` against current
state, re-check R3, then send. Failure is silent: no packet, intent retired,
cooldown started. No `clearTimeout` is introduced; the timer fires and declines.

**Landing confirmation.** `spawnedObjectSids` is pushed in `loadGameObject`
(11979), reset at 13990, and read nowhere. A placement landed if a new object
of ours appears near the intent's `x`/`y` within a tick or two.

**The retry, reframed.** This is what becomes of Luna's `spamPrePlacer`:

| | Luna (14001) | designed |
|---|---|---|
| condition | `spamPrePlacer` — set whenever a target existed | landing **not** confirmed **and** the loss is still real |
| count | every tick a target exists | one retry, then cooldown |
| timing | `111 - minPingTime`, a session-global minimum starting at `Infinity` | bounded recent-window ping estimate |
| target check | none | the position is still empty and still worth filling |

`minPingTime` (16523) is not used. It never decays, and before the first ping
response `111 - Infinity` clamps to 0 ms, firing the retry before the tick body
has decided anything.

---

## 11. Not spamming

Luna's Replace is *definitionally* spam — an unconditional duplicate send. The
replacements here:

1. **`loss >= LOSS_MIN` (R2)** — most technically-possible replacements never
   qualify. This is the primary filter and it is the brief's rule.
2. **One intent per lost position** (§9).
3. **Conditional retry** (§10) — evidence of non-landing, not a timer.
4. **Position-keyed memory** — reuse `placedAngles` → `bannedAngles`
   (12902-12907, 12926) rekeyed on `x`/`y`, and make Replace *read* it, which
   neither Preplace nor Replace does today (conflict C6). Expiry on both age and
   player displacement, per Whiteout's `usedAngles` (12630).
5. **Cooldown** after a failed revalidation or unconfirmed landing.
6. **Graded packet budget** against `packets` (1522). Precedence under pressure:
   Auto Place > Replace mode B > Replace mode A > Preplace. Confirmed losses
   outrank predicted ones; both outrank speculative placement.

---

## 12. Reuse audit

| needed | reused | new |
|---|---|---|
| placement engine | `predictObjects` / `addPredictObject` / `getPredictObjects` | — |
| execution routing | the existing `preplace` boolean → immediate vs deferred site | — |
| target finder | `getPrePlaceObject` (13284), filters corrected | — |
| loss detection | `removedObjects` (10577), read before the 13333 clear | — |
| landing signal | `spawnedObjectSids` (11979) | — |
| enemy model | Preplace's, on the existing predictor site | — |
| world state | shared block 14120-14149, `enemiesNear` 14084 | — |
| angle sweep | `getPrePlaceAngles` (13061), doomed **set** excluded | — |
| collision / range / limit | `canPlace` → `checkItemLocation`, `getConfig` | — |
| ownership | `isObjectOur` (12870) | — |
| angle distance | `UTILS.getAngleDist` (20325) | — |
| packet budget | `packets` (1522) | — |
| timers | the existing block 15454-15489 | — |
| placement memory | `placedAngles`/`bannedAngles`, rekeyed | — |
| **usefulness scorer** | shared with Preplace (§5) | one function |
| **escape-route analysis** | — | ~30-line port of `RYN_Client_v4.js:11935` |

Two new pieces, one of them shared with Preplace. No second engine, tracker,
scheduler, or predictor.

## 13. Invariant compliance

| invariant | how |
|---|---|
| I1 no Spike Tick predicates | R3 reads settled flags; 13149/13152/13168 removed |
| I2 prediction/timing term in every rule | mode A on the reload edge, mode B on a confirmed loss — both timing-bound; neither is current-geometry-only |
| I3 not a superset of an Auto Place rule | R2 (`loss >= LOSS_MIN`) requires an object to be dying; no Auto Place rule can satisfy it. Luna's unconditional `if (isTrap) return true` (11640 / NovaStorm 13178) is deleted |
| I4 Spike Tick picks no angle | untouched |
| I6/I7 one producer, four `place()` sites | unchanged |
| I8 shared world state | unchanged |
| I9 one predictor | reads Preplace's; adds none |
| I10 no new timers | existing block only |
| I11 one budget | `packets`, with precedence ordering |
| I12–I14 out-of-scope behaviour | Auto Place, Spike Tick, Auto Mills, manual keys, grind untouched except the `isItemLimit` correction |

## 14. Tunables

| name | governs | starting point |
|---|---|---|
| `LOSS_MIN` | minimum usefulness to bother replacing | calibrate — the primary selectivity dial |
| `RECOVERY_MIN` | fraction of `loss` the replacement must restore | ~0.8 |
| `NEAR_MISS_FRAC` | survives-by margin counted as a probable death | ~0.15 |
| `LOSS_MIN_UNCERTAIN` | raised threshold for probable (not certain) deaths | ~2× `LOSS_MIN` |
| `EXIT_SEAL_RAD` | bearing tolerance for "seals this exit" | 0.45 rad (RYN's value, 12695) |
| `RING_MIN` | surrounding objects before containment analysis runs | 3 (RYN's, 11936) |
| `COOLDOWN` | ticks blocked after failure | ~6 |

---

## 15. Open

1. **`LOSS_MIN` is the whole design.** Every other knob is secondary; this one
   decides how selective Replace is. It cannot be set from reading code and needs
   live calibration, ideally with the usefulness score logged before any
   thresholding is switched on.
2. **Trigger pessimism** (§3) — I have proposed accurate-hat damage with a
   raised bar for near-misses. If you would rather Replace stay worst-case like
   Luna, that is a one-line change but it will fire considerably more often.
3. **Output target — still blocking implementation.** NovaStorm is not in this
   repo, which builds `ReUp_Mix.user.js` from `src/RYN_Client_v4.js`. Add
   NovaStorm 1.4 as its own source, or port Preplace + Replace onto ReUp Mix's
   `AutoPlacer` (`_preplacer` / `_replacer`)? Both designs are now complete and
   this is the only thing standing between them and code.
