# Final report — NovaStorm Preplace / Replace

Commit `4c3c527`. Baseline `src/novastorm_1.4.js` (the unmodified upload).
Deliverable `NovaStorm.user.js`. 13 diff hunks, 733 changed lines.

**Scope actually completed: Preplace. Replace was designed but not implemented.**
Everything below distinguishes what is in the code from what is on paper.

---

## 1. Files modified

| file | why |
|---|---|
| `NovaStorm.user.js` | the deliverable — the only file with behaviour changes |
| `src/novastorm_1.4.js` | **added, never edited.** The pristine upload, kept as the diff baseline so every change is auditable |
| `tools/verify-placement.js` | added — 28 static contract checks |
| `tools/test-preplace.js` | added — 18 unit tests on the new primitives |
| `tools/test-matrix.js` | added — 14-scenario conflict matrix |
| `tools/bench-placement-sweep.js` | added — the benchmark that corrected my CPU-cost claim |
| `docs/*.md` (12 files) | added — analysis, designs, contracts, audit |

No other repository file was touched. `ReUp_Mix.user.js`, `src/RYN_Client_v4.js`,
`src/Luna_Client_1.1.js`, `drivers/`, and the existing tools are unchanged.

---

## 2. Functions modified, and why

| function | baseline line | change | why it was necessary |
|---|---|---|---|
| `addPredictObject` | 12825 | optional 4th `meta` parameter, spread into the pushed record | The intent record carried no owner, provenance or target. Without them the deferred commit cannot tell whose intent it holds or whether it is stale. This is the single point every placement flows through, so it is the cheapest place to attach it. All nine surviving legacy call sites still pass three arguments and are behaviourally unchanged. |
| `isItemLimit` | 12834 | `group.sandboxLimit \|\| 99` → `NS_groupLimit(group)` (see the sandbox note below) | The old expression never fired for spikes (limit 15) or traps (limit 6), because neither group carries a `sandboxLimit`. A regression against Luna 1.1, which this placer is otherwise copied from verbatim. It sits inside `canPlace`, so every system was proposing placements the server discards. Preplace's scarcity term and Spike Tick's item-reservation are meaningless without it. |
| `isPrePlaceAngle` | 13088 | **removed** | Preplace's old acceptance cascade. Three of its rules were Auto Place's spike rules with one extra qualifier and no prediction term; its trap rule was unconditional where Auto Place's is guarded; three of its rules called into Spike Tick's decision functions once per candidate angle. Replaced wholesale — it is the thing being upgraded, not unrelated code. |
| `getPredictObjects` | 13338 | the Preplace branch (167 lines) replaced by two calls | The branch was the old doomed-object-driven Preplace. Replaced by `NS_buildCtx()` + `NS_runPreplace()`. |
| `updatePlayers` | 14018 | 5 lines added after the existing `xVel`/`yVel` assignment | The movement model needs per-tick displacement, and `lastX`/`lastY` are already in scope at exactly that point. Extending the one existing predictor here is what keeps it from becoming a second one. The original `xVel`/`yVel` lines are untouched, so every existing reader is unaffected. |
| `updatePlayers` | 15454 | the three-timer block replaced by one snapshotted, revalidated commit | The timers read mutable globals at fire time, ~71–96 ms after the decision. The 1 ms warm-up timer's two `getPrePlaceAngles` calls passed `object.id` where `customObjects` was expected, so `objects.length` read `undefined`, every angle trivially passed, and the result was discarded. The `111 - minPingTime` retry used a session-global minimum that never decays and clamps to 0 ms before the first ping response. |

### Functions added (all `NS_`-prefixed, all in one block at 13202–13582)

`NS_PP` (constants) · `NS_posKey` · `NS_isCooling` · `NS_cool` · `NS_groupLimit` ·
`NS_updateMoveModel` · `NS_segDist2` · `NS_hits` · `NS_escapeExits` · `NS_buildCtx` ·
`NS_usefulness` · `NS_probeAngles` · `NS_runPreplace` · `NS_revalidate`

Kept in one contiguous block, adjacent to the code it replaces, so the change is
reviewable as a unit.

---

## 3. Exact integration points

| # | site | working line | nature |
|---|---|---|---|
| P1 | predictor extension in `updatePlayers` | 14156–14160 | 5 lines appended |
| P2 | `addPredictObject` meta parameter | 12825–12840 | signature + push |
| P3 | `isItemLimit` | 12843–12845 | expression |
| P4 | Preplace branch in `getPredictObjects` | 13637–13645 | replaced |
| P5 | deferred commit block | 15596–15622 | replaced |
| P6 | new Preplace block | 13202–13582 | added |

Read but never written: `isAutoPlaceAngle` (13185, the ownership oracle),
`instaKill` / `insta.*`, `visibleObjects`, `spikes_our`, `traps_our`,
`nearestEnemy`, `removedObjects`, `canPlace`, `getConfig`, `UTILS.getAngleDist`,
`packets`.

---

## 4. Whiteout Preplace logic actually extracted

Every item below was located and read in `Whiteout_v4.js` before use, and is
present in the shipped code.

| behaviour | Whiteout source | where it landed |
|---|---|---|
| two hypotheses (accel / decel) scored against last tick's observation | `calcVel` 14917 | `NS_updateMoveModel` |
| physics constants `.0016` / `.993` for the step | `calcVel` 12987–12998 | `NS_updateMoveModel` (via NovaStorm's own `config.playerSpeed` / `playerDecel`) |
| measured inter-tick interval instead of a hard-coded 111 | `game.tickSpeed` 15119 | `dt = p.t2 - p.t1` |
| `buildIndex >= 0 ? 0.5 : 1` in the speed multiplier | `maxSpeed` 7610–7621 | `NS_updateMoveModel` |
| direction-stability gate on the prediction | `dAng(movDir,pmovDir) <= .3`, 14917 | `STABLE_RAD` / `TURN_RAD` |
| re-validate immediately before sending, rather than cancelling | `check3` 12592 | `NS_revalidate` |
| parameterised, anchored angle sweep | `findAvailableAngles` 12277 | `NS_probeAngles` |
| points-based scoring with negative terms | `gradeAngles` 12348 | `NS_usefulness` |
| packet-budget-graded degradation | `secPacket` gates 12292 / 12573 | gate G4 + `NS_revalidate` |

**Two Whiteout defects deliberately not copied**, both unit-tested:

- speed by `Math.hypot`, not Whiteout's `(xVel + yVel) <= 7` signed sum (15170),
  which calls `(-10, +10)` stationary;
- `UTILS.getAngleDist` (20325), not Whiteout's `dAng` (14818), which never wraps
  — verified numerically: `dAng(0.1, 6.2)` returns `6.1000` where the true
  separation is `0.1832`.

**Explicitly not from Whiteout:**

- escape-route analysis is a port of `src/RYN_Client_v4.js:11935`
  (`SiegeAnalysis.isEscapable`), not Whiteout;
- the segment-to-point hit test (`NS_segDist2`) is my own;
- validating candidates at the *predicted player position* is my own proposal and
  **is not implemented** — Whiteout has the parameter and passes `0` at both its
  live call sites, so it was never reference-backed (see §11).

**Whiteout code that exists but was not used, because it is dead in Whiteout:**
`traps.preplacer` (9844, only caller is inside a commented-out block) and
`traps.replacer` (9619, no caller at all), plus `preplace()`, `checkPreplace()`,
`chainPlace()`, `preplaceTimeout` and `aboutToBreak`.

---

## 5. Luna Replace logic actually extracted

**None. Replace is not implemented**, so no Luna Replace logic is in the code.

What the Luna analysis established, for the record:

- Luna's `prePlace2` "replace" toggle (19253) occurs **once in the whole file**.
  There is no `prePlace2` key in `window.vars` and the id is read nowhere. It is
  a menu stub.
- Luna's working replace is `spamPrePlacer` — four sites total — which re-sends
  Preplace's decision with no success check. `getPredictObjects` diffs to **zero**
  against NovaStorm's ignoring whitespace, so this is the origin of NovaStorm's
  behaviour, not a source of anything it lacks.

**One piece of Luna logic is in the shipped code, and it is not Replace logic:**
`isItemLimit`. Luna 11296 has the correct expression
(`config.inSandbox ? group.sandboxLimit || Math.max(group.limit*3, 99) : group.limit`,
guarded by `if (limit && …)`); NovaStorm had regressed it. Restored using
`UTILS.isSandbox` (16807) rather than NovaStorm's `config.inSandbox` (16806),
which reads `process.env.VULTR_SCHEME` and is undefined in a browser.

Luna items designed-for but **not implemented**: the reload-edge trigger
(11765–11771), branch A's filter template applied to branch B (aim cone,
ownership, hat-accurate damage), and the conditional retry.

---

## 6. Conflicts found

From the traced execution flow, not inferred:

| id | conflict |
|---|---|
| C1 | Preplace queued first and won `addPredictObject`'s dedup, then committed ~111 ms later or not at all — reserving space Auto Place could have used immediately |
| C2 | the deferred timers read the globals `predictObjects` / `spamPrePlacer` at fire time, not a snapshot of the deciding tick |
| C3 | `minPingTime` starts at `Infinity`, so `111 - Infinity` clamps to 0 ms and the retry fired *before* the tick body had decided anything |
| C4 | Spike Tick's executor sets `predictWeapon` and `autoaim`, which every `place()` restores and every commit's direction packet uses |
| C5 | `isPrePlaceAngle` called `canTrapTick()` / `canShamePlace()` per candidate angle — Preplace making spike-tick judgements, and the Spike Tick toggle silently changing placement geometry |
| C6 | the ban channel ran backwards: Preplace wrote into `placedAngles`, creating bans that suppress Auto Place, while consulting none itself |
| C7 | bans keyed on player-relative angle with a fixed expiry, so any movement re-aims them at different world geometry |
| C8 | `heal()` spends 4 packets per food item with no budget check, immediately before the Auto Place loop that has one |
| D1 | Replace duplicated Preplace unconditionally, with no success check |
| D3 | `canTrapTick` / `canShamePlace` evaluated twice per tick from two places, each running a full sweep, able to disagree |
| D5 | the 1 ms timer's two wrong-arity sweeps |

## 7. Conflicts resolved

| id | how | evidence |
|---|---|---|
| C1 | the ownership oracle makes Preplace decline before queueing, so contested space is never reserved | scenario 9: 55 contested angles yielded, 0 queued |
| C2 | the commit batch is snapshotted at timer registration | scenario 11 |
| C3 | `minPingTime` dropped as a timing base; commit is `Math.max(0, 111 - tickPing())` | code |
| C4 | unchanged by design — Spike Tick keeps priority; Preplace defers to it entirely | scenario 8 |
| C5 | the three calls removed | ST2: `canTrapTick` 2→1, `canShamePlace` 2→0 |
| D1 | the unconditional retry removed | `setTimeout` count 14→12 |
| D3 | resolved for Preplace (it no longer calls them); Spike Tick's own two calls remain, which is its own code | ST2 |
| D5 | the 1 ms timer removed entirely | code |

**Not resolved:** C6, C7 (see §11), C8 (out of scope — `heal()` is untouched).

## 8. Compatibility hooks added

Four, all minimal:

1. **Ownership oracle call** — `isAutoPlaceAngle(cfg, null, null, null)`. Auto
   Place's three selector arguments are its own angle objects compared by
   identity, so no external caller can satisfy those rules; passing `null`
   evaluates exactly the positional rules (A3, T2) that decide ownership. Auto
   Place's function is **called, not restated**.
2. **Spike Tick state read** — `instaKill.length` and the four `insta.*` flags,
   all settled before `getPredictObjects` runs, plus a sweep-free prefix of
   `canTrapTick`'s cheap conditions for imminence. No predicate is called.
3. **Protected annulus** — `dist(candidate, enemy) < scale + 55`, the constant
   taken verbatim from `canTrapTick` 12730.
4. **`smartTickSpike` publication** — Preplace writes a meaningful value to the
   existing Spike-Tick-named global that only it wrote and nobody read. Nothing
   consumes it; wiring the consumer would modify Spike Tick.

## 9. Behaviour intentionally left unchanged

`updateAngles`, `checkPredictObjects`, `isAutoPlaceAngle`, `getPerfectAngles`,
`getClosestConfig`, `place`, `getConfig`, `canPlace`, `getPrePlaceAngles`, `heal`
— all **byte-identical** (verified). All six Spike Tick predicates, the
`instaKill` ladder and executor, `hatFc` — byte-identical. Auto Mills, the manual
place keys, turret grind, combat, anti-systems, healing, pathfinding, rendering
and the packet layer — untouched.

Known defects deliberately left alone because they are outside the two systems:
Auto Place's 6-argument `willRetrap` (13226) that always returns `true`; the dead
`window.vars.placeRange` slider; `canSmartTick` having no menu gate.

**One deliberate exception:** `isItemLimit` changes Auto Place's output — it will
stop emitting placements the server discards once at a group cap. Narrowing, not
widening. Flagged before it was made and reversible to a Preplace-local shadow.

## 10. Obsolete logic removed

Only what was proven unreferenced first:

| removed | evidence |
|---|---|
| `isPrePlaceAngle` (85 lines) | zero call sites after the branch replacement |
| the 1 ms warm-up timer | wrong-arity sweeps, results discarded |
| the `111 - minPingTime` retry | unconditional duplicate send |

**Not removed** — step 8 was not reached. `verify-placement.js` reports these
every run: `placeTick` 3 refs, `setPlaceTick` 3, `updateAngles2` 1,
`settings.spampreplace` 1, `spamPrePlacer` 3, `getPrePlaceObject` 1. All are
confirmed dead or pending Replace; none has been deleted.

## 11. Remaining limitations

1. **Replace is not implemented.** Steps 5–8 of the agreed order were not
   reached. `getPrePlaceObject` still sits unreferenced, awaiting its move.
   Audit items 2, 9, 12 and 14 cannot pass.
2. **Gap A — the predicted-position candidate basis was designed and not
   written.** `NS_runPreplace` calls `getConfig(id, angle)` and
   `canPlace(id, angle)` with no `velocity` argument, so candidates are still
   validated at the current player position. Mitigated by commit-time
   revalidation re-deriving from the current position; still a gap, and mine.
3. **Gap B — C6 and C7 remain open.** A new `NS_cooldown` map was added instead
   of rekeying the existing `bannedAngles` map as the integration design
   specified. Preplace still writes into `placedAngles` at commit while reading
   no bans. I pre-registered this risk with a commitment to flag it at step 2 and
   did not.
4. **Nothing has been run in a browser.** Every result is static analysis or
   synthetic-state simulation. `CONF_MIN 0.65`, `VALUE_MIN 2.0`, `GAIN_MIN 1.5`
   were chosen from geometry, not from play.
5. **The yield rule is strict.** Scenario 5 measures it: with an enemy trapped,
   Auto Place's rule A3 claims **55 of 55** placeable spike angles and Preplace
   queues nothing. Correct per the compatibility contract, but it is the number
   to look at if Preplace feels too quiet. The remedy is the A3/T2 override
   offered in `autoplace-compatibility.md` §8, not a change to the oracle.
6. **Preplace engages later than the range gate suggests.** The 300 gate is
   necessary but not sufficient; at 236 units every candidate is below
   `VALUE_MIN`. Real engagement is around 120.
7. **Two questions were never answered and I proceeded on stated defaults:**
   `isItemLimit` applied globally rather than shadowed, and Spike Tick imminence
   via the cheap-prefix predicate rather than an additive line in the frozen
   block.

---

## Verification status

```
node --check NovaStorm.user.js      syntax OK
tools/verify-placement.js           28 passed, 0 failed
tools/test-preplace.js              18 passed, 0 failed
tools/test-limits.js                24 passed, 0 failed
tools/test-matrix.js                11/14 scenarios; 3 await Replace
```

---

## Addendum — sandbox item cap regression, found and fixed

Reported from play: placement stopped early in sandbox. It was mine.

The cap has had three forms:

| version | expression | effect in sandbox |
|---|---|---|
| shipped 1.4 | `group.sandboxLimit \|\| 99` | 99 for spikes/traps — wrong, but generous |
| my first fix | `(isSandbox && group.sandboxLimit) ? sandboxLimit : group.limit` | spikes have no `sandboxLimit`, so it fell through to **15**, and traps to **6** |
| corrected | `NS_inSandbox() ? (group.sandboxLimit \|\| 0) : group.limit` | uncapped, except the three groups with an explicit 299 |

The reference is the game's own `PlayerObject.canBuild` (19193):

```js
this.canBuild = function (item) {
    if (config.inSandbox) return true;                 // no cap at all
    if (item.group.limit && this.itemCounts[item.group.id] >= item.group.limit) return false;
    return this.hasRes(item);
};
```

`sandboxLimit` is read nowhere in the game — only by the old `isItemLimit`. So
the correct model is: uncapped in sandbox, except where the data carries an
explicit `sandboxLimit` (mill, booster, teleporter — 299 each).

Sandbox detection was also too narrow. `config.inSandbox` (16806) reads
`process.env.VULTR_SCHEME` and is always `undefined` in a browser;
`UTILS.isSandbox` (16807) matches only the exact host `sandbox.moomoo.io`.
`NS_inSandbox()` now also matches `sandbox-dev.moomoo.io` and any `*.sandbox.moomoo.io`,
anchored so `notsandbox.moomoo.io` does not match, and is wrapped in a try/catch
so a missing `window.location` cannot throw.

Because `isItemLimit` sits inside `canPlace`, this affected **every** placement
system in sandbox, not just Preplace. `tools/test-limits.js` (24 tests) pins all
three regimes so it cannot regress again.
