# Final audit

Run against commit `1ac8593`. Line numbers refer to `NovaStorm.user.js` unless
prefixed. Evidence is `tools/verify-placement.js` (28 static checks),
`tools/test-preplace.js` (18 unit tests), `tools/test-matrix.js` (14 scenarios).

## Verdict first

**The audit cannot pass as a whole, because Replace is not implemented.** The
agreed implementation order runs 1–9; steps 5 through 8 have not been done. Four
of the fifteen items concern Replace and are therefore **not met** — not
"passing with caveats".

Two further items are **partially met**: I found two gaps between the designs and
what I actually wrote. Both are mine, both are in Preplace, and neither was
caught by the tooling because the tooling checks contracts rather than design
fidelity.

| | item | status |
|---|---|---|
| 1 | Preplace uses predictive behaviour found in Whiteout | **partial** — §1 |
| 2 | Replace uses replacement behaviour found in Luna | **not met** — not implemented |
| 3 | Auto Place unchanged | **met** |
| 4 | Spike Tick unchanged | **met** |
| 5 | No duplicate placement engine | **met** |
| 6 | No duplicate packet system | **met** |
| 7 | No duplicate target tracker | **met** |
| 8 | No stale Preplace executes | **met** |
| 9 | No stale Replace executes | **not met** — nothing to test |
| 10 | No duplicate placements | **met** |
| 11 | Preplace cooperates with Auto Place | **met** |
| 12 | Replace cooperates with Auto Place | **not met** |
| 13 | Preplace does not interfere with Spike Tick | **met** |
| 14 | Replace does not interfere with Spike Tick | **not met** |
| 15 | Changes limited to the requested systems | **partial** — §15 |

---

## 1. Preplace uses predictive behaviour actually found in Whiteout — PARTIAL

Implemented, and genuinely Whiteout-derived:

| behaviour | Whiteout source | where |
|---|---|---|
| two hypotheses (accel/decel) scored against last tick's observation | `calcVel` 14917 | `NS_updateMoveModel` |
| the game's own constants, `.0016` / `.993` | `calcVel` 12987-12998 | same |
| measured inter-tick interval, not a hard-coded 111 | `game.tickSpeed` 15119 | `dt = p.t2 - p.t1` |
| `buildIndex >= 0 ? 0.5 : 1` in the speed term | `maxSpeed` 7610-7621 | same |
| direction-stability gate on the prediction | `dAng(movDir,pmovDir) <= .3` 14917 | `STABLE_RAD` |
| re-validate at commit rather than cancel | `check3` 12592 | `NS_revalidate` |
| parameterised, anchored sweep | `findAvailableAngles` 12277 | `NS_probeAngles` |
| points scoring with penalties | `gradeAngles` 12348 | `NS_usefulness` |
| budget-graded degradation | `secPacket` thresholds 12292/12573 | G4 + revalidate |

Two corrections to Whiteout's own defects were carried through and are unit
tested: speed by `Math.hypot` rather than Whiteout's signed sum (15170), and
`UTILS.getAngleDist` (20325) rather than Whiteout's `dAng`, which never wraps.

**Not from Whiteout, and labelled as such:** escape-route analysis is a port of
`src/RYN_Client_v4.js:11935`, not Whiteout. The segment-distance hit test is my
own. Neither is claimed as reference-backed.

### Gap A — the predicted-position candidate basis was designed but not written

`preplace-design.md` §4 specifies passing the existing `velocity` flag so
candidates are validated at the position the player will occupy when the packet
lands. The implementation does not:

```js
const cfg = getConfig(id, angle);      // no velocity argument
if (!canPlace(id, angle)) continue;    // no velocity argument
```

So candidates are still validated at the *current* player position, exactly as
the shipped code did. This is the one design element I specified and then failed
to implement.

Mitigating, and the reason it is not urgent: I established in
`whiteout-preplace-analysis.md` §1.3 that Whiteout has the same parameter and
**passes `0` at both live call sites**, so this was never reference-backed — it
was my proposal. And `NS_revalidate` re-derives the placement point from the
current position at commit, which addresses the same staleness from the other
end. Still a gap, and mine.

---

## 3. Auto Place behaviour unchanged — MET

`updateAngles`, `checkPredictObjects`, `isAutoPlaceAngle`, `getPerfectAngles`,
`getClosestConfig` are **byte-identical** to the baseline (AC1, 5/5).
`place`, `getConfig`, `canPlace`, `getPrePlaceAngles`, `heal` likewise (PF7,
5/5). `place()` call sites went 4 → 3; none added (IN3).

**One deliberate exception, previously flagged and taken as the stated default:**
`isItemLimit` (12843) now reads `group.limit` via `UTILS.isSandbox` instead of
`group.sandboxLimit || 99`. Auto Place will stop emitting placements the server
discards once at a group cap. That is a behaviour change in Auto Place's output —
narrowing, not widening — and it is the AC3 exception I recorded. Reversible to
a Preplace-local shadow if you want Auto Place bit-identical.

## 4. Spike Tick behaviour unchanged — MET

All six predicates byte-identical (ST1, 6/6). The `instaKill` ladder, executor
and `hatFc` are untouched. Call sites into Spike Tick's decision functions from
outside its own ladder: `canTrapTick` 2 → 1, `canShamePlace` 2 → 0,
`canSmartTick` 1 → 1 (ST2). Preplace reads settled flags plus a sweep-free
prefix; it never calls the predicates.

## 5–7. No duplicate engine / packet system / target tracker — MET

- `predictObjects.push` occurs in exactly one place, inside `addPredictObject`
  (IN1). Ten call sites, nine legacy passing three arguments unchanged (IN2).
- One packet counter; `packets++` occurs once (IN5). No second budget.
- No second world snapshot: Preplace reads `visibleObjects`, `spikes_our`,
  `traps_our`, `nearestEnemy` as they are. The movement model is attached to the
  existing player objects at the existing predictor site (14156-14160).
- `setTimeout` count 14 → 12; no `setInterval` added; still no `clearTimeout`
  in the placer (IN4).

## 8. No stale Preplace executes — MET

Scenario 11 pins five sub-cases:

```
same tick: commits | next tick: cancelled | spot blocked: cancelled
| blocker died in-window: commits (correct, SV3) | Spike Tick fired: cancelled
```

The fourth matters: `disableBySid` (18501) splices `gameObjects` without
clearing `active`, so an object that died during the commit window is still in
`visibleObjects`. Without the `removedObjects` correction, revalidation would
cancel exactly the placements that just became legal. The test asserts it
commits.

The first matters too — an earlier fixture bug made a valid intent cancel on its
own tick, which *looked* like working stale prevention. There is now an explicit
assertion that valid intents commit.

## 10. No duplicate placements — MET

Three independent mechanisms, all exercised: `addPredictObject`'s spatial dedup
(unchanged), the one-intent-per-tick rule (scenario 13: 1 intent from 72 viable
candidates), and the Auto Place ownership oracle (scenario 9: 55 contested
angles yielded, 0 queued).

## 11. Preplace cooperates with Auto Place — MET

`isAutoPlaceAngle` is **called, not restated** — no copy of its rules exists in
Preplace (AC2). Scenario 5 measures the cost: with the enemy trapped, rule A3
claims **55 of 55** placeable spike angles and Preplace queues nothing.

That is the narrowing I flagged in `autoplace-compatibility.md` §3, now measured
rather than predicted. If Preplace feels too quiet in play, this is the number
to look at, and the remedy is the A3/T2 override I offered there — not a change
to the oracle.

## 13. Preplace does not interfere with Spike Tick — MET

Scenario 8: with `instaKill` populated, and separately with only the sweep-free
imminence prefix true, Preplace produces zero intents and defers at G2 before
any sweep. The protected annulus (`scale + 55`, verbatim from `canTrapTick`
12730) is applied per candidate. `smartTickSpike` is published by Preplace and
read by nobody, as specified.

---

## 15. Changes limited to the requested systems — PARTIAL

Nine diff hunks, 733 changed lines, all inside the placer. Untouched: Auto
Mills, manual place keys, turret grind, combat, healing, hats, anti-systems,
pathfinding, rendering, the packet layer.

### Gap B — a new cooldown map instead of the specified reuse

`placement-conflict-map.md` §9 and `integration-design.md` §5 both specify
rekeying the **existing** `bannedAngles` map on position and having
Preplace/Replace read it. The implementation instead adds:

```js
const NS_cooldown = new Map();   // 13232
```

`bannedAngles` is still read only by Auto Place (12933). So **conflict C6 is not
fixed**: Preplace still pushes into `placedAngles` at commit, creating bans that
suppress Auto Place, while consulting none itself.

I pre-registered this exact risk in `integration-points.md` §1 P6 — "two key
shapes in one map… the fallback is a second small map… **I will flag it at step
2 if it happens**" — and then did not flag it at step 2. The decision is
defensible; not reporting it was not. Flagging it now.

It is a small map, not an engine, tracker or scheduler, so items 5–7 still hold.
But it is a deviation from the design, and C6 remains open.

---

## What remains

**Blocking the audit:** steps 5–8 — implement Replace, re-verify Auto Place and
Spike Tick, then remove the confirmed-dead symbols. `verify-placement.js`
already reports the deletion candidates and their reference counts each run:
`placeTick` 3, `setPlaceTick` 3, `updateAngles2` 1, `settings.spampreplace` 1,
`spamPrePlacer` 3, `getPrePlaceObject` 1.

**Open from this audit:** Gap A (velocity flag, two lines) and Gap B (C6 ban
channel). Both sit in code that step 5 touches, so both are cheapest to close
alongside Replace.

**Not verified by anything here:** live behaviour. Every result above is static
analysis or synthetic-state simulation. The tuning constants — `CONF_MIN 0.65`,
`VALUE_MIN 2.0`, `GAIN_MIN 1.5` — are starting points chosen from geometry, not
from play. Scenario 4 already shows one consequence worth knowing: the 300 range
gate is necessary but not sufficient, and Preplace only engages around 120 units.
