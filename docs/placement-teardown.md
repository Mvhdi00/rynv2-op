# Placement solver teardown

Pre-implementation analysis for the RYN placement redesign. **No RYN source is modified by this
document.** Mechanisms described here are to be reimplemented against RYN's own managers, not copied.

Published version (with the full matrix rendered): `claude.ai/code/artifact/fec3f91c-d347-43ff-914c-7fd6c928879b`

## Field

| Client | Placement architecture |
| --- | --- |
| **RYN v5.2** | Two stacks. `ObjectManager.getBestPlacementAngles` → `findPlacementAngles` (Auraro-lineage analytic tangent solver) serves sync / trap-animal / defense. `AutoPlacer` (a Luna port) serves autoplace, preplace, replace. The two share no state. |
| **Whiteout v4** | Uniform dense ring scan → additive point scorer (`gradeAngles`). Field-wide break prediction (`objDmgPot`), event-driven replace off the object-death packet, candidates carry blocker provenance (`checkItemLocation3`). |
| **Luna 1.1 / Novastorm 1.4** | **Same placer.** A line-level diff of both placement regions yields two real differences: `canSpikeTick` radius (Nova 55, Luna 35) and the predict-weapon heuristic. 72-step probe, perfect-edge detection, two boolean ladders, one preplace target per tick, three timed sends. |
| **Auraro 5.5** | Continuous free-arc geometry — exact tangents, arc union, arc inversion, arc intersection — driven by a server-accurate `MovementSimulator` and an exact `hitsToBreak` model. Replace is a case taxonomy fired on the break. |

## Comparison matrix

Legend: `+++` strong · `++` partial · `+` absent or naive · **bold** = strongest.

| # | Subsystem | RYN v5.2 | Whiteout v4 | Luna / Novastorm | Auraro 5.5 |
| --- | --- | --- | --- | --- | --- |
| 01 | Candidate angle generation | ++ tangent arcs, endpoints only | ++ uniform ring scan | + fixed 72-step probe | **+++ exact tangents → merged blocked arcs → free arcs** |
| 02 | Angle resolution / scan density | ++ 5° fixed, memoised, capped at 4 | ++ 1.8° / 3.6°, degrades under load | + 5° fixed, recomputed repeatedly | **+++ resolution-independent; snap into free arc** |
| 03 | Collision detection | **+++ spatial hash; `placementScale` matches vanilla `getScale`** | +++ linear but records blockers, sids, break state | + linear, boolean only | ++ linear with squared-distance prefilter |
| 04 | Building range validation | **+++ live `player.scale`; resource + count checks** | + hardcoded 35 | + hardcoded 35; cap read as sandbox limit | ++ real scale, no resource check |
| 05 | Enemy position prediction | ++ single linear extrapolation | **+++ velocity decay model + decel detection** | ++ stored next-tick position, linear | +++ simulator can run the enemy |
| 06 | Player movement prediction | + none — candidates from current pos | ++ decay model where used | + none | **+++ full server physics replay; preplace from simulated pos** |
| 07 | Trap placement | + nearest intercept, then "any trap" | **+++ banded retrap scoring, aim misalignment, push interplay** | + same ladder; retrap test is a broken call | ++ retrap ring ∩ free arcs |
| 08 | Spike placement | ++ knockback alignment, one winner | **+++ `knockInto` simulates the push; bounce corridor scores highest** | ++ same alignment + dead branch | ++ contact fast path, scoring external |
| 09 | Preplace location generation | ++ one doomed object, dropped from collision set | +++ every doomed object at once | + one object, no caching | **+++ free arcs ∩ object arc ∩ retrap ring, from predicted pos** |
| 10 | Replace location generation | + no location logic — resends preplace | +++ regrades the ring at the break | + same blind resend | **+++ case taxonomy; each case snaps into a free arc** |
| 11 | Auto-place candidate scoring | ++ boolean ladder | **+++ additive points with negative terms** | ++ same ladder | ++ priority branches, no score |
| 12 | Multi-placement combinations | ++ overlap check at queue time | **+++ greedy top-N non-overlapping ≤4, spike wins ties** | ++ same queue check | +++ blockers list grows as it places |
| 13 | Placement ordering | ++ perfect then placeable, unordered within | **+++ points desc, type tie-break** | ++ same two-pass | ++ object iteration order |
| 14 | Preplace / replace / autoplace conflict | + coarse module gates only | ++ `prioLoc` reservations | + shared queue, no reservation | **+++ reserved footprints read by the generator** |
| 15 | Packet usage | **+++ one shared budget; resource pre-check** | ++ tiered thresholds change behaviour | + own counter, fixed cap | ++ per-angle cap, no global budget |
| 16 | Duplicate placement prevention | ++ ban list, exact-angle keys | **+++ angular tolerance + tick expiry + move invalidation** | ++ same ban list | +++ quantised per-tick counter |
| 17 | Same-angle handling | + no cap | ++ 0.45 rad tolerance | + no cap | **+++ quantised key, hard 4-send ceiling** |
| 18 | Visibility / line of sight | **+++ padded path lookahead + sightline** | ++ path-aware only while pathing | +++ origin of both tests | + none in the placer |
| 19 | Target movement | **+++ box must cross current→future segment** | +++ same, plus enemy-slot denial | +++ origin of the test | ++ predicted range only |
| 20 | Placement timing | ++ fixed 111−ping / 111−minPing | **+++ per-object deadline from predicted break − ping** | ++ same fixed sends | ++ tick scheduling, keyed actions |
| 21 | Tick synchronization | **+++ tick-driven modules, per-tick memo, tick bans, arbitration** | ++ tick-keyed expiry | + timers off the tick callback | +++ `tickBase` + per-tick caches |
| 22 | Existing object awareness | ++ deletions tracked, feed only spike sync | +++ field-wide break prediction each tick | + one object, two scans | **+++ exact hits-to-break, urgency-ranked** |

## Verdicts — why each winner wins, and what RYN takes

1. **Candidate angle generation — Auraro.** Circle-circle intersection gives the two exact angles where a build just touches a blocker; union those arcs and invert, and you hold every legal angle as a continuous interval. RYN's solver is the same family but discards the intervals and keeps endpoints, so it cannot answer "is this angle legal" without re-deriving. *Take: keep intervals; endpoint extraction becomes a consumer.*
2. **Angle resolution — Auraro.** Free arcs have no resolution to tune. At RYN's 5° a legal gap narrower than the step is invisible and a wider one is sampled repeatedly for nothing. Whiteout's fine-scan-with-degradation is the best answer available *inside* sampling, which is the argument for leaving sampling. *Take: snap a desired angle into the nearest free arc.*
3. **Collision detection — RYN (structure) / Whiteout (semantics).** RYN is the only client with a spatial hash, so cost does not grow with object count, and `placementScale` reproduces vanilla `getScale(0.6, isItem)` exactly, 0.36 resource factor included. Whiteout's check records which blockers were hit and whether each is about to break, answering "placeable now" and "placeable next tick" in one pass. *Take: keep the grid, add the provenance — return blockers, not a boolean.*
4. **Building range validation — RYN.** `getItemPlaceScale` derives the ring from live player scale, `inPlacementRange` validates against previous/current/future, `canPlace` checks resources and item count before the wire. Others hardcode 35; only Luna checks the cap, and reads it wrongly as the sandbox limit. *Take: nothing — make the placer actually use it (see D1).*
5. **Enemy position prediction — Whiteout.** Integrates velocity forward with the server's own per-tick decay and detects accelerating vs coasting, so a stopping enemy is not predicted through the stop. Linear extrapolation is right for a straight run and wrong at the turn and the stop — exactly when placement matters. *Take: decayed integration plus deceleration detection.*
6. **Player movement prediction — Auraro.** A preplace lands a tick after it is computed, so it must fit the ring around where you *will* be. Auraro simulates the tick with server physics (hat/tail/weapon/biome multipliers, slow decay, river current, sub-step collision) and computes arcs from there. *Take: simulate one tick and generate preplace candidates from the result.*
7. **Trap placement — Whiteout.** Graded, not gated: distance bands to the target, a bonus when the trap sits away from the enemy's aim, and explicit interaction with the spike decision so retrap and push are not chosen against each other. Luna's ladder ends in "any trap". *Take: score on retrap probability and aim misalignment; delete the unconditional fallback.*
8. **Spike placement — Whiteout.** `knockInto` projects the knockback and asks what the target hits, scoring an infinite bounce corridor far above a single spike hit, both above plain contact. Luna's alignment metric answers a narrower question and returns one winner. *Take: simulate the knockback destination and score it; don't stop at one winner.*
9. **Preplace location generation — Auraro.** Constrains rather than searches: free arcs ∩ the arc that actually touches the doomed building ∩ the retrap ring, from the predicted position — legal and useful by construction. Whiteout near-ties on scope: its per-blocker break flags open every doomed slot in one pass. *Take: constrain by intersection; rank all doomed objects.*
10. **Replace location generation — Auraro.** Replace is a fresh decision made when a slot opens, and the right location depends on *why* it opened; Auraro splits it into cases (spike-tick trap, target escaped, target still trapped, self escaped, default). RYN's replace is the preplace packet sent a third time on a timer — correct only when nothing changed. *Take: replace becomes its own decision with its own cases.*
11. **Auto-place scoring — Whiteout.** Booleans cannot rank; RYN's ladder returns true for every angle clearing any rung, so ties break by array order. Additive scoring with negative terms (blocking your own path, blocking teammates) makes candidates comparable, which is what makes ordering, budgeting and multi-placement work off one number. *Take: convert both ladders to weighted scores, rungs become weights.*
12. **Multi-placement — Whiteout (policy) / Auraro (mechanism).** Sort by score, greedily accept non-overlapping up to four, spike over trap on ties. Auraro's mechanism is cleaner: each placed footprint is appended to the live blocker list, so later candidates in the same pass cannot collide with earlier ones. *Take: greedy top-N with footprints fed back into collision.*
13. **Placement ordering — Whiteout.** Score descending is the only ordering reflecting value. RYN's perfect-then-placeable encodes one true idea — packed angles are worth more — but leaves each pass unordered, so a packet ceiling is spent on whatever the loop reached first. *Take: order by score; "packed" becomes a scoring term.*
14. **Conflict resolution — Auraro.** Footprints placed by one system are recorded and read by the next system's generator, so conflicts never reach the wire. RYN's two solvers share no state and coordinate through coarse flags — whichever module runs first wins, the other wastes packets silently. *Take: one reservation list, written and read by every path.*
15. **Packet usage — RYN.** One allowance shared by every module is the only correct model: the placer competes with heal, insta and sync for the same budget. RYN also declines builds it cannot afford in resources before sending. Whiteout's contribution is behavioural — it changes strategy at thresholds rather than stopping. *Take: keep the budget, add tiered degradation.*
16. **Duplicate prevention — Whiteout.** Exact-angle equality fails as soon as the ring shifts, because you are moving and the same intent yields a slightly different number each tick. Whiteout treats angles within 0.45 rad as one, expires on a tick window, and drops entries once you have moved far enough that the slot is not the same slot. *Take: angular tolerance plus expiry.*
17. **Same-angle handling — Auraro.** A quantised key with a hard four-send ceiling per tick makes runaway spam structurally impossible. RYN has no cap; its ban list is reactive and costs a full tick of packets before a refused angle is even considered. *Take: per-tick quantised send counter in front of the ban list.*
18. **Line of sight — Luna / RYN.** Two tests, correct in intent: does the build wall off the corridor I am about to run down, and does it break my line to the target. The padded box and 222-unit lookahead are well chosen and RYN's port kept them intact. *Take: already correct — fold results into the score instead of gating on them.*
19. **Target movement — Luna / RYN.** Requiring the build box to cross the segment from current to future position is the right interception test and is already RYN's. Whiteout ties and adds something unique: it computes the ring the *enemy* could place into and scores angles for taking those slots away. *Take: keep the test, add enemy-slot denial as a scoring term.*
20. **Placement timing — Whiteout.** A per-object deadline — when that building is expected to die, minus ping — puts the packet where the slot actually opens. RYN's fixed 111−ping / 111−minPing is a guess that is right only when the break lands on the tick boundary, and the third send fires whether or not anything changed. *Take: derive the preplace deadline from the predicted break, per object.*
21. **Tick synchronization — RYN.** Modules run in defined order off a tick counter, expensive derivations memoise per tick, bans expire in ticks not milliseconds, and `activeModule` arbitrates a contested tick. The strongest foundation of the five, and the reason the rest is affordable. *Take: nothing — extend arbitration to cover the reservation list.*
22. **Existing object awareness — Auraro.** Exact hits-to-break from weapon, variant and gear turns "about to break" into a number; urgency ranking turns a set of doomed objects into an ordered queue. Whiteout wins breadth — every armed enemy against every object in range, every tick — but its answer is binary where Auraro's is graded. *Take: exact hit counts + urgency ranking, fed by Whiteout's every-enemy sweep.*

## Defects found in RYN today

Independent of any redesign; found by reading RYN's placement path against the vanilla game code in `game_index.js`.

- **D1 — The placer bypasses RYN's own placement geometry.** `_getConfig` and `_addPredictObject` hardcode the player radius as `35`, while the rest of the client derives it from `getItemPlaceScale`, which reads live player scale. Two sources of truth for one ring, and the placer uses the wrong one.
- **D2 — The perfect-angle seam is never checked.** Edge detection walks indices 1..71 comparing each to its predecessor, so the pair (71, 0) is never compared. A packed angle on the wrap-around seam is permanently invisible to the autoplacer. Inherited verbatim from Luna.
- **D3 — Preplace geometry uses the wrong position.** Preplace candidates land a tick after generation but are fitted to a ring centred on `pos.current`. Every preplace is off by one tick of movement — largest exactly when moving fast.
- **D4 — Replace is a timer, not a reaction.** RYN already sees deletions in `ObjectManager.removeObject` and caches them in `deletedObjects`, but only `canSpikeSync` reads that. Replace instead resends the preplace entry at `111 − minPing` regardless of whether the slot opened, moved or was taken.
- **D5 — Two solvers, no shared state.** `getBestPlacementAngles` serves sync / trap-animal / defense; `AutoPlacer` serves autoplace / preplace. Neither knows what the other queued this tick. Coordination is `placedOnce`, `moduleActive` and a hardcoded module-name set — order-dependent and silently wasteful when it loses.
- **D6 — Only one doomed object per tick.** `_getPrePlaceObject` returns a single object. When an enemy is about to break two builds at once the second slot is never preplaced, though the collision pass already holds the information to find it.
- **D7 — Dead branches in the ladders.** `canTrapTick` and `canShamePlace` are hardcoded `false`, so two rungs of the preplace ladder can never fire. Documented as deliberate Luna fidelity, but they cost a call per candidate and obscure control flow.
- **D8 — Ban keys are exact floats.** Bans are keyed on the raw float and matched elsewhere with a 0.01 tolerance, while the map itself uses `has()` on the exact value. It works only because the probe is a fixed 72 steps, and breaks the moment resolution changes.

## Direction for the redesign

| Layer | Change | Source |
| --- | --- | --- |
| **1 · Geometry** | Move RYN's existing tangent solver from endpoint extraction to interval output: blocked arcs, merged, inverted. Spatial hash stays the blocker source. Endpoint lists become a thin consumer so sync and trap modules keep working unchanged. | Auraro geometry on RYN's grid |
| **2 · World model** | One break-prediction pass per tick over the whole field: every armed enemy vs every object in range, exact hits-to-break, urgency tag. Feeds preplace, replace and collision annotation — replacing three separate scans. | Whiteout breadth, Auraro exactness |
| **3 · Candidates** | Collision returns which blockers were hit and whether each is doomed, so one pass yields placeable-now and placeable-next-tick. Every candidate carries a weighted score: interception, knockback destination, retrap probability, packed-ness, enemy-slot denial, minus path and sightline costs. | Whiteout |
| **4 · Arbitration** | One reservation list written by every placement path and read before generating, so preplace, replace, autoplace and sync modules cannot collide. Sends ordered by score against RYN's shared packet budget, degrading to fewer better angles under pressure. | Auraro reservations, RYN budget |
| **5 · Timing** | Replace fires from the deletion RYN already receives, as its own decision with its own cases. Preplace deadlines come from each object's predicted break minus ping. One simulated tick of own movement centres preplace geometry where the build will land. | Whiteout timing, Auraro simulator |
