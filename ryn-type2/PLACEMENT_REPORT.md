# RYN Type 2 — Placement System Rebuild: Technical Report

Target: `ryn-type2/Ryn_Type_2.user.js` (v2.1 as supplied, committed unchanged as the baseline in `88aaefe`; rebuilt on top).
Tests: `node ryn-type2/tests/placement.test.js` (41 tests). Benchmarks: `node --expose-gc ryn-type2/tests/bench.js`.

---

## A. Files read

| File | Role |
|---|---|
| `Ryn_Type_2.user.js` (40,129 lines) | the target |
| `moomoo_1.js` (game index bundle) | **authoritative**: `buildItem`, `checkItemLocation`, `getScale`, `checkCollision`, player `update`, `gather`, reloads, packet handlers |
| `moomoo_2.js` (vendor bundle) | msgpack encoder (float64 numbers, `forceFloat32` off), transport |
| `Luna_Client_Full_Source_Code-1.1-2.txt` | primary Auto Place reference |
| `lfv2-3.txt` (Laffer 1) | secondary reference |
| `Whiteout_v4.js` | secondary reference |
| `message_27-3.txt` (Sonder 1.5.2) | secondary reference |

Falcon, Oracla and Revelation 6.4.0 were **not attached** and were not used. Nothing outside these files was consulted.

**Reference comparison (#39).** The ideas taken are described below, and none of the systems were copied:

| Client | Idea | Gap |
|---|---|---|
| Luna | ladder `isAutoPlaceAngle`; "perfect" angles at the ends of placeable runs; preplace at `setTimeout(111 − ping)` with a spam copy at `111 − minPing`; banned angles as float Map keys | 72 probes |
| Laffer | Luna lineage; `predictEnemyTraps`; escalates 36 → 72 probes | — |
| Whiteout | preplace at `111 − ping − 7`, then a burst of `F(1, angle ± jitter)` | — |
| Sonder | replace inside the `killObject` handler; preplace on the enemy gather animation; half-circle trap "protect" | — |

What all four share, and what this rebuild replaces:

- Fixed probe counts.
- Timers anchored on the local tick with the one-way delay guessed as `ping`.
- Angle-keyed refusal memory.
- No acknowledgement tracking.

---

## B. Architecture discovered

- **Game rules (moomoo_1).**
  - `buildItem`: `w = 35 + scale + placeOffset`; the build lands at `player + w·dir(F angle)`.
  - `checkItemLocation`: for every object, `dist < s + (blocker ‖ getScale(.6, isItem))` refuses. The test is strict, so equality is legal. Trees and bushes count at 0.36·scale. The river band (7200 ± 362) is refused except for the platform. Players never block a build.
  - A successful build sends `S` (item count) immediately; `H` (the object) comes with the next tick. A refused build gets **no reply**.
  - Tick = 111.1 ms, with `a` sent at the end of the tick.
  - Reload: `reloads -= dt`, swing when ≤ 0, reset to `speed·atkSpd` with no carry-over.
  - Gather has no ownership test.
  - Trap trigger radius = 35 + 50·0.2 = 45.
  - `lockMove` is re-armed by the collision inside the tick, so a player whose trap breaks on tick *k* cannot move before *k+2*.
  - Holding an item during a tick halves speed and freezes reload.
  - Collision pushes to exactly `scale + getScale()` and keeps velocity ×0.75. An enemy spike adds 1.5 of velocity along the push.
- **RYN.**
  - `wireAngle` quantises every build angle to 0.01 rad in [−3.14, 3.14], matching the vanilla client.
  - `PacketManager` counted packets in a fixed 1 s window. `ModuleHandler.place` = `z`, `F1`, `F0`, `z(weapon)`.
  - `ObjectManager` keeps a spatial hash (100-unit cells) and a `revision` counter, and calls `engine.onVacated` *before* dropping the object.
  - `AutoPlacer` was a port of Luna's ladder on a fixed lattice (`RingScan` 36/72/144/200, default 200), sending via `place()` directly.
  - `RynPlacementEngine` (ledger, memory, `StealForecast`, `ThreatAnalyzer`, `CandidateGenerator`, `AngleSolver`, scorer, beam planner, executor, preplace book, scheduler) handled preplace and replace. It needed an enemy frame for everything.
  - `MovementSimulation` is RYN's port of the server player update.

## C. Existing placement weaknesses (verified)

1. **Angles never met the server.**
   - Candidates were real numbers checked for legality, then rounded to 0.01 rad by `wireAngle`.
   - Measured on 1,500 boards: 77 of 1,958 packed ("perfect") lattice angles (3.9%) became illegal after rounding. The rebuilt solver's rate is 0/2,382.
2. **Fixed-count lattice.** 200 samples cost the same everywhere, skipped slots narrower than one step, and put most samples on ground where nothing changes.
3. **Position-blind blocker cache.** `anglesFor(position = enemy)` solved an enemy-centred ring against objects gathered around *us*.
4. **Replace required an enemy.** `onVacated` → `ThreatAnalyzer.build()` returned null without `nearestEnemy`, so replace did nothing.
5. **Timed resends did not restore aim.** An `F` between ticks turns the server's facing to the build, and the next swing went out at the build.
6. **Fixed-window packet counter.** A burst straddling the reset could put ~2× the allowance inside one real second.
7. **Speculative sends were anchored on local tick boundaries.** The arrival relative to the break was an accident of phase.
8. **Refusals were inferred from empty ground a tick later.** At high ping that is also every successful build still in flight, and the resulting ban was angle-keyed or wrongly sized.
9. **Latency was a tick count added to horizons.** Nothing modelled *where* the server would build from when the packet arrived.
10. Found during testing:
    - Preplace booked deferred ground before validating due ground, so a build due now failed against a prediction for later.
    - The break forecast was one tick early (see H).
    - Hard claims (2 ticks) expired before a build sent at 250 ms RTT was visible, so the client re-sent onto its own ground.
    - At high ping the client sent past the item limit.

---

## D. Auto Place changes

- **Luna's ladder is kept 1:1**: the same branches, gates, vetoes and named picks (`closestSpikeToEnemy`, `closestSpikeToKb`, `primaryKbSpike`, `closestTrapToEnemy`) and the same extra sector scanners.
- **The candidate set is solved, not probed.** `_getPrePlaceAngles` now returns `RynAngles` candidates from the arrival origin. Every entry is a legal wire angle, and `perfect` means the exact interval edge. The set is adaptive (§J):
  - dense (every 3 grid steps) on the ground that touches the target or retraps them;
  - snapped focus points: the target now and next, and the far side of the target from each of our spikes (the knockback lines, exact);
  - the feature stride elsewhere.
- **Arrival-time geometry.** The ring is centred at `originAt(lead)` and the target at `_extrapolate(lead)`, not at the positions from the last tick.
- **Priority model.** One order across both items and both of Luna's passes:
  1. named picks, in ladder order;
  2. builds touching the target at arrival;
  3. packed edges;
  4. the rest;
  each by distance to the target's next position.

  Before this, a named pick could be queued behind any packed edge and lose its ground.
- **Through the engine.** Every build goes through `engine.request(…, {origin})`: exact revalidation, ledger, the in-flight check, item room, priority budget, the outcome record. There is no private `place()` call left.
- **Removed:** the lattice, the resolution setting, the per-module refusal/ban lists (replaced by the outcome ledger), `_apertureFor`, `_canPlace`, `_pointFree` and `_anglePool`.

## E. Preplace changes

- Candidates and books use exact quantised angles from the arrival origin. Validation re-aims each booked ground from the current arrival origin: the ground is kept if the ring still reaches it within half a footprint, and dropped otherwise. Before, the build silently landed elsewhere.
- **Pipeline order fixed:** plan → validate → execute → *then* book the deferred ground.
- Refusal bans, hidden-trap ghosts, in-flight ground and the item room (unconfirmed sends counted) all apply.
- Spam preplace no longer releases book records on the local tick. That job moved to the timed sender (G).

## F. Replace changes

Flow: PREPARE → PREDICT → RESERVE → DESTROY → REVALIDATE → SEND.

- **With a fight in range:** the existing cycle, now fed by the break forecaster and the claims (H). It runs at recovery priority.
- **Without a fight, or with the enemy far away:** a lifecycle replace, `_prepareRestores` / `_restoreVacated`.
  1. When the forecast places the break of one of our structures within `lead + 1` ticks, the build is solved from the arrival origin with that structure removed. Structures we broke ourselves are skipped.
  2. Its packets are reserved at RECOVERY priority.
  3. With spam on, 1–2 timed attempts are armed for the break tick.
  4. The deletion packet revalidates and sends inside the handler.
- **Measured without an enemy** (teammate breaking our spike, 90 ms RTT): the rebuild was the timed attempt, landing **4 ms after the break**. The event path alone lands one RTT (90 ms) after it.

## G. Spam Preplace changes (2.0)

Flow: PREDICT (break tick) → SOLVE → RESERVE → WAIT → CONFIRM/RE-AIM → SEND.

- **Timing.** An armed event lays attempts at `sendTimeFor(breakSeq, offset_i)`. `offset_i = bias + {.5, 1.5, 3, 5, 7.5, 10}·max(4, σ)` ms, at least 6 ms apart and within 0.9 of a tick.
- **Re-timing.** Each tick that arrives before the first attempt re-anchors the unfired attempts on the latest tick arrival.
- **Re-aiming at fire time.** Each attempt recomputes the server's origin at arrival, asks the event where it wants to stand *at that arrival tick*, and snaps against the live world with the doomed object excluded. The aims:
  - **retrap:** the target, who cannot move until the tick after the break (see B), and after that along the escape line;
  - **spike:** the target extrapolated to arrival;
  - **ground:** the opening.

  An attempt is skipped if its landing no longer serves the aim, or the group has no room.
- **Confirmation and cancelling.**
  - The first `S` acknowledgement cancels the rest.
  - The deletion packet cancels the rest; the event path then owns the ground and is not blocked by the event's own in-flight attempts.
  - Each attempt costs 5 packets, reserved when armed.
- **Learning.**
  - `phase.bias` moves from which attempts were refused as early and which one was built.
  - `phase.hitIndex` learns which attempt usually lands and trims later attempts. Measured: 4 attempts per opening, falling to 2.
- **Arming rules.** Claims are armed only if the ring can reach the aim, and never more than two per tick.
- **Measured.**
  - Retrap at 100 ms RTT: the timed build landed **4 ms after the break**, with 0 early attempts. The event path would be 100 ms late.
  - With ±12 ms server-period jitter and ±6 ms link jitter: 4.1 ms after the break.

## H. Building Steal implementation

- **BreakForecaster.** Once per server tick it takes every destroyable structure within 460 units and every actor: us plus players within 520, **any owner**, because the game's gather has no ownership test.
  - Each actor has a swing schedule. Next swing = `max − current + 1` ticks, or 1 tick if reloaded. The earlier `max − current` was one tick early: the client counter reads full on the tick *before* the server's `speed − n·tick` reaches 0. Then every `max` ticks.
  - Damage is the actor's real last hit if recent, otherwise `getBuildingDamage` (with tank for us when forced).
  - Evidence weights:

    | Evidence | Weight |
    |---|---|
    | hit it recently | .92 |
    | facing it and swinging | .70 |
    | facing it | .35 |
    | our autobreak on it | .97 |
    | out of range by less than 18 | ×.3 |

  - The schedules are stepped until the likely damage (actors with weight ≥ .5) covers the tracked health. That gives `breakIn` and `breakSeq`, with confidence = the product of the actors' weights, each counted once. An earliest bound uses all actors.
- **Timing and decision per claim.**

  | Quantity | Definition |
  |---|---|
  | `tDestroy` | clock time of the breaking tick |
  | `tArrival` | RTT/2, shown split for display only; decisions use the whole RTT |
  | `tWindow` | RTT, until everyone sees the deletion |
  | `tRemaining` | `tDestroy − tArrival` |

  Decisions:
  - **BUILD_NOW:** `tRemaining ≤ 0` and confidence ≥ .5.
  - **RESERVE:** `breakIn ≤ leadTicks + 1`, confidence ≥ .45; the claim is armed on the timed sender.
  - **PREPARE:** within 9 ticks, confidence ≥ .3; ground booked by the preplace steal generator.
  - **WAIT:** only the earliest bound exists.
  - **REJECT:** out of reach, or worth 0.
- **Priority** = `worth · (.5 + .5·conf) · (.6 + .4·denial)`.
  - Role worth: retrap 1, our spike on target .85, enemy spike on target .7, trap near target .75/.6, ground between us .55, other ground .35.
  - Enemy-owned ×1.1 when Building Steal is on and 0 when it is off.
  - Denial = how close the target is.
- **Claim kinds covered:** our own, enemy and ally ("between") claims.

## I. Anti-Retrap implementation (escape grid)

- **Threat.**
  - An enemy trap lands on their ring, `|Q − E| = 35 + 50 − 5 = 80`.
  - It takes us if `|Q − P| ≤ 45` (+ origin uncertainty).
  - For each enemy within 360, at their position now and one tick ahead, the threat is the arc of that ring inside our disc. It is sampled every 4 units, weighted towards the centre of the arc, and samples the world already denies (the breaking trap excluded, and the river) are dropped.
- **Cover.** A build of ours at X denies every threat point within `50 + X.scale`. Candidates for traps and spikes come from the post-break solve. The selection is greedy set cover:
  - bias: traps ×1, spikes ×.85, +.3 toward the enemy, −1 on our escape line;
  - no overlaps, within the remaining item room, at most 4 builds;
  - stop at ≥ 98% of the weight covered or a marginal gain ≤ 2%.

  Two opposite builds cover the whole 45 disc (√(79² + 45²) = 90.9 < 99), which is why 1–2 usually suffice.
- **Events.**
  - While trapped, the plan is re-solved every tick and its packets reserved at DEFENSE priority.
  - Close to the break, the parts that are already legal are sent, and the rest are armed on the timed sender if the break tick is known.
  - The trap's deletion (`onVacated` with `trappedIn === object`) sends what remains **inside the deletion handler**.
- **Measured.** One, two and three enemies: 1–2 builds, 100% coverage. Retrap spots open after landing: **0 of 83 / 92 / 154 / 204**, checked by brute force at 0.5° on each enemy's ring against the server world.

## J. Perfect Angle mathematics

For a build of foot radius F on ring R from origin O, a blocker B (distance d, bearing φ, placement scale s) refuses angle θ iff

`|O + R·u(θ) − B| < F + s  ⇔  cos(θ − φ) > (R² + d² − (F + s)²) / (2Rd)`

so each blocker removes exactly one arc of half-width `acos(·)`. The river is removed the same way as arcs.

- **Solve.** The arcs are merged and inverted to give the free intervals. This is exact and involves no step size.
- **Candidates**, keyed by grid index so there are no duplicates:
  - interval edges (packed builds, walked inward past float error);
  - every index of a *narrow* interval (≤ 2·stride);
  - interior points at `stride = round(featureLen / (R/100))`, where featureLen is half the smaller of footprint and target body, about 22 steps for a spike;
  - focus points snapped to the nearest legal index, plus the **tangency pair** from `contactAngles`, stepped onto the contact side;
  - **dense regions**: every `stride`-th index whose build lands within r of a point. The arc comes from the same law of cosines, and the stride widens rather than truncating above a cap.
- **Refine.** Grid hill-climb (steps 16 → 1) inside the candidate's own range against a caller's score.
- **Gap analysis** (`analyze`): legal and illegal intervals, the number of disconnected intervals, narrow intervals, representable indices, unrepresentable gaps, and relevant blockers.
- **Quality scoring.** The scorer's clearance term uses the exact clearance minus the origin uncertainty. Auto Place uses the priority classes in D.

## K. Quantization model

- The wire grid is `k/100`, k ∈ [−314, 314] (629 values). `RynAngles.k(a) = round(wireAngle(a)·100)`, and `k/100` is bit-identical to what the server parses.
- Each free interval becomes signed grid runs, split at ±π, with a 1e-3 slack so that no legal index is lost to acos error.
- **Every index that is used is re-tested exactly as the server tests it** (`clearanceAt`: strict less-than against every relevant blocker, plus the river).
- `snap` returns the nearest legal index on the circle, or null if none exists. An interval narrower than the grid is reported as unrepresentable and never rounded onto an illegal neighbour.
- **Clearance margin.** An index packed against a blocker is legal only from the exact origin it was solved from. Inside the tolerance, validation prefers the nearest index whose clearance covers `originMargin`. That is the server's position precision (√½ unit when positions arrive as integers) plus the measured one-step prediction error × the lead, capped at 8. If no index covers it, the index with the most clearance is used; a build is never dropped over this.
- Validation (`_validAt`) re-aims each build at its ground from the arrival origin, snaps it, and requires the landing within tolerance:

  | Build | Tolerance |
  |---|---|
  | engine candidate / directed build | 3 units |
  | booked record | ½ footprint |
  | lifecycle restore | ¾ footprint |

## L. Prediction model

- **Our arrival origin (`originAt(m)`).**
  - `m = arrivalTicks(now)`.
  - The model is `MovementSimulation` (acceleration × every multiplier, sub-steps, boost pads, river, snow, decay) with **the game's exact collision**. `RynArrivalMovement` removes RYN's 5-unit safety margin.
  - Seed: a predict-correct tracker. Last tick's one-step prediction is reused (velocity damping included) when the observation matches it; otherwise the velocity is `displacement/tick · decel^tick`.
  - Our own builds that are unacknowledged or not yet visible act as solids.
  - The nearest enemy is collided with at its extrapolated position on each simulated tick.
  - A trapped player stays put.
  - The prediction's own error is measured every tick (last tick's one-step prediction against the observed position) and feeds the clearance margin (K).
  - Result: exact on free runs; see M.
- **Target:** linear extrapolation from the last displacement, capped, and stationary while trapped. `TargetMotion` (velocity, acceleration, stability, confidence) is used for preplace interception.
- **Horizons (multi-horizon):**
  - m = arrival lead (placement);
  - `lead + 1` (next position);
  - break forecast up to 9 ticks;
  - preplace intercept up to `RPE_PREPLACE_MAX_LEAD + ping`.

## M. Latency compensation

- **Clock.**
  - RTT: `srtt`/`rttvar` (Jacobson), fed by pings **and** by every unambiguous build acknowledgement (`S` comes back one RTT after the send).
  - Also tracked: minimum RTT, tick arrival times, period EWMA (clamped to 0.85–1.2 ticks) and jitter.
  - σ = 1.25·√(rttvar² + jitter²). Position precision is detected from the first 64 updates.
- **Timing identity.** To land at `T_{k+n} + ε`, send at `S = C_k + n·P − RTT + ε`. The up/down split cancels, and only the measured RTT is needed.
- **Solving against the expected server state.** Every placement (auto, preplace, replace, directed, timed) is solved and validated from `originAt(arrivalTicks)`, against targets extrapolated to arrival.
- **High ping does not mean waiting.** Builds go out immediately, aimed at where the server will be. Break-timed builds are scheduled earlier by the RTT, not delayed.
- **Measured landing error** (the engine's predicted landing vs the server's actual build), walking into a cluttered board:

  | RTT | Arrival model | Naive "from where I stand" |
  |---|---|---|
  | 40 ms | 0.00 | 0.00 |
  | 120 ms | 0.00 | 29.7 |
  | 250 ms | 0.05 | 59.1 |
  | 180 ± 25 ms | 0.00 | 29.8 |

  0 refusals in all four runs.
- **Outplace race.** Covered by `tRemaining`, timed attempts at the break plus bias, and phase learning. A `race` refusal is classified separately and does not produce a ban.

## N. Packet reservation

- The budget is a **true sliding 1000 ms window** over every frame that leaves, counted at the transport, so the game's own frames count too. The limit is 119.
- `reservePackets(owner, n, ms, priority)` / `releasePackets`.
- `availablePackets(priority)` = `limit − windowCount − Σ reservations with a higher priority`. A lower priority cannot spend a higher one's reserved slot; an equal or higher priority is not held back.
- Holders:

  | Holder | Reservation | Priority |
  |---|---|---|
  | timed events | n × 5 packets, until the last attempt + 40 ms | per event |
  | anti-retrap plan | items × 5, for 450 ms | DEFENSE |
  | lifecycle restore | 5, until break + 2 ticks | RECOVERY |

- The executor, planner, AutoPlacer, directed requests and the timer all check `availablePackets` at their own priority. The planner uses RECOVERY for deletion cycles.
- **Measured:** with 100 packets already spent and 12 reserved by an insta, the sliding count never exceeded 119 and placement used ≤ 7.

## O. Refusal learning

Every send is recorded as ground, not as an angle. A send is resolved by the `S` acknowledgement (oldest unresolved send of its group) or by its own object arriving. A send still unanswered after `max(RTT, 30) + 3σ + 45 ms` is a refusal, classified by the world at that moment:

| Class | Meaning | Response |
|---|---|---|
| limit / resources | could never have been built | — |
| early | the object it waited on was still there at arrival | teaches `phase.bias` |
| self | our own build took the ground | — |
| race | someone built there while the send was in flight | no ban; the solver already sees it |
| stale | something visible was already there | 6-tick ground ban, one footprint radius |
| hidden | nothing visible explains it — the server hides enemy pit traps | 27-tick ghost blocker (scale 50) that every solver routes around |

- Bans and ghosts are dropped by events: an object removed nearby clears them, and an object appearing on a ghost replaces it.
- In-flight ground (unanswered, or acknowledged but not yet visible) is not asked for twice.
- Unconfirmed sends count against the item limit.
- **Measured:** a hidden trap on the best spike slot produced one refusal classified `hidden`, then the build moved elsewhere (≤ 2 sends into it, both before classification).

## P. Cache / invalidation architecture

| Cache | Key | Invalidated by |
|---|---|---|
| Blocker sets (≤ 3 discs) | origin disc + `ObjectManager.revision` | any add/remove; origin leaving the covered disc |
| Aperture/solve cache | type, item, exact origin, excluded id, revision, **ghost version** | tick change, > 96 entries, any object or ghost change |
| Origins (`originAt`) | lead, per `clock.tickSeq` | new server tick |
| Motion tracker | tick sequence | observation mismatch → falls back to displacement |
| Break forecast | `clock.tickSeq` | new tick; `onVacated` forgets |
| Threat frame, profiles, AutoPlacer angle cache | module tick (angle cache also by origin) | new tick |
| AutoPlacer early-out signature | revision, positions (3 units), items, bans, ghost version, … | any input change |

- The outcome ledger holds ≤ 48 pending sends (resolved ones dropped after 4 s), bans pruned on expiry, ≤ 16 ghosts, and ≤ 64 removal times.
- Timer events are deleted 5 s after review, and reservations expire.
- `reset()` (reconnect) clears everything except the connection clock.

## Q. Performance measurements

Node 22, real wall-clock (`process.hrtime`), virtual game clock. Units are ms per call unless stated.

| Measurement | mean | p50 | p99 |
|---|---|---|---|
| Angle generation (solve + quantise + candidates), 0 / 5 / 20 / 60 blockers | .026 / .020 / .009 / .018 | — | ≤ .071 |
| Fight, 1 enemy, 30 objects, RTT 80 (3,000 ticks): whole tick | .094 | .071 | .357 |
| — AutoPlacer | .030 | — | .114 |
| — engine | .062 | — | .254 |
| — generate | .035 | — | .150 |
| — predict | .006 | — | .028 |
| Fight, 3 enemies walking, RTT 220 (2,000 ticks): whole tick | .082 | .063 | .248 |
| Object spam, 600 objects, 2 enemies (800 ticks): whole tick | .82 | .75 | 1.91 |
| — engine | .68 | — | 1.64 |
| — generate | .38 | — | 1.32 |
| Anti-retrap plan build, 2 enemies | .104 | .075 | .675 |
| Anti-retrap per-tick arming (no trap) | .0004 | — | — |

- Candidate counts for the angle benchmark were 82 / 69 / 18 / 53.
- Plan / score / validate took ≤ .4 ms per cycle when a cycle had candidates.
- Maximum outliers of 1–4 ms are JIT and GC. The budget is a 111 ms tick.
- **Cache hit rates:** aperture cache 28–45% within a tick; blocker sets 97–100% (0–0.07 re-queries per tick); 1–12 solves per tick.
- **Allocation:** about 68 KB per tick (young generation; a scavenge roughly every 200+ ticks).
- **Memory:** every engine structure stays bounded (pending 0–48, bans 0, ghosts 0, timer events 0, removal times ≤ 64, ledger ≤ 2, book ≤ 5, reservations 0 at the end of every run). Retained heap growth is 0.2–0.7 MB over 800–3,000 ticks, including the harness and JIT.

## R. Tests performed (41, all passing)

The harness (`tests/harness.js`) lifts the shipped code straight out of the userscript: game tables, Vector, object classes, spatial hash, `MovementSimulation`, AutoPlacer, and the whole engine including core v2. It runs that code against a simulated server with its own world, an asymmetric up/down link with in-order delivery, optional jitter, `S`/`H` acknowledgements, hidden objects, and the game's `checkItemLocation` and movement/collision rules.

- **Angles (7).**
  - Every candidate on 2,000 random boards is legal at the server and on the wire grid (> 10k candidates).
  - `snap` is the nearest legal index and null iff none exists (600 boards).
  - No legal index is ever missed (checked against brute force over all 629).
  - A narrow gap is enumerated in full; a sub-grid gap is reported, never rounded into.
  - The candidate count follows the geometry.
  - Dense contact regions have no gaps.
  - Old lattice vs solver: 77 refused vs 0.
- **Clock (4):** EWMA, deviation and minimum; period and jitter under server variation; the timing identity for four up/down splits; arrival ticks at low and high ping.
- **Movement (1):** the arrival-model collision equals the game's.
- **Replace (2):** no enemy, deletion path; no enemy, prepared and timed.
- **Anti-retrap (5):** 1, 1 diagonal, 2 and 3 enemies (every retrap spot denied, sent inside the handler); disabled.
- **Spam preplace (4):** timed retrap after the break; attempt count learned; reservation visible to lower priority; server-period and link jitter.
- **Building steal (2):** an enemy trap claimed, and rejected when Steal is off; an ally building under attack.
- **Auto Place (3):** through the engine and legal; a trapped enemy gets the catching spike; moving plus multiple enemies with clutter.
- **Preplace (1):** a build standing before an approaching enemy arrives.
- **Latency (4):** RTT 40 / 120 / 250 / 180 ± 25 while walking.
- **Refusal (2):** hidden trap → ghost; early → phase bias.
- **Destruction and pressure (4):** simultaneous destruction (4 in one tick); rapid destruction; packet pressure; reconnect.
- **Edge cases (2):** no enemy; no valid angle.

These cover the #42 matrix: no, one and multiple enemies; moving and stationary; high and low ping; jitter; building and trap destruction; enemy, friendly, own and allied structures; narrow, wide and blocked angles; multiple valid and no valid angles; rapid and simultaneous destruction; packet pressure; object spam (benchmark); reconnect; server update variation. `node --check` passes on the whole file.

## S. Additional improvements (#40)

These are all in the shipped file:

- `resendPlace` (unused after G) was removed.
- Timed placements restore aim with `D`.
- Preview entries are tagged with their item.
- AutoPlacer's early-out waits while sends are in flight.
- `anglesFor` / `getBestPlacementAngles` return exact wire angles solved against objects around *that* position.
- Directed module builds (sync, insta, hotkeys, formations) are validated from the arrival origin and nudged at most 3 units onto a legal wire angle.
- Unreachable spam claims are no longer armed (they used to reserve packets for attempts that would be skipped).
- The item group limit counts unconfirmed sends (planner, validation, timer, anti-retrap).
- Settings: `_buildingSteal` and `_antiRetrapGrid` were added, with Combat menu toggles. `_autoplacerResolution` and its migration were removed; old saves are pruned automatically. The Spam Preplace description and "Spam Attempts" slider were rewritten.

## T. Remaining limitations

- **No live-server test was possible in this environment.** All results come from the simulated server, which is built from the game bundle's own rules. The server's packet-handling order between ticks is inferred from the bundle, which is why the phase bias is learned rather than assumed.
- **Unpredictable events.** Things that happen inside the latency window cannot be predicted: an enemy walking into us, or a structure deleted server-side but not yet seen.
  - The worst case measured is an adversarial sweep: 12 boards at 220 ms RTT, walking through 40 structures while three scripted enemies circle us. There **10 of 48 builds (21%) were refused**.
  - All but one happened with an enemy 42–132 units away. That is player-collision range over the lead: a curving enemy bumps us 3–13 units, more than the 3-unit tolerance can absorb.
  - On the straight-walk latency tests (same RTT range, no enemy contact), and in every other scenario, the refusal rate was 0.
  - The ledger records these refusals and bans or ghosts the ground; nothing retries blindly.
- **Hidden enemy traps** cost one refused build before they become a ghost. They are placed at the refused build's centre, because the server never reveals the trap.
- **The break forecast** depends on RYN's client-tracked building health, since the server never sends it. Unobserved damage (off-screen hits, turret shots) makes it late. The deletion path is always the fallback.
- **Anti-retrap** covers enemies within 360 units, at their current position and one tick ahead. An enemy that repositions for several ticks before placing is re-planned each tick while we are held, but after the break only the covering already on the wire applies.
- **The 0.01 rad angle grid is kept deliberately.** The vanilla client sends the same grid, and the game would accept float64. Sub-grid gaps are therefore unusable by design, and are reported.
- **Spam attempts spend 5 packets each.** The adaptive count reduces this after about 3 lessons, but the first openings use the configured count.
- **Luna's ladder decides *whether* Auto Place builds.** The priority model only orders the qualifying candidates; changing the ladder was out of scope (#41).
