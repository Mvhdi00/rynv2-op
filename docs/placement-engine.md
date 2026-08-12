# RYN Placement Engine — architecture specification

Companion to `docs/placement-teardown.md`. **Specification only — no RYN source is modified by this
document.** Every mechanism here is to be written against RYN's own managers, spatial grid and packet
budget. Nothing mirrors a function name or structure from Whiteout, Novastorm, Luna or Auraro.

Published version: `claude.ai/code/artifact/18f4607a-ddfd-427f-9d86-fa096e2f2d29`

Both `src/RYN_Client_v4.js` and the ryn v5.2 bundle carry the same placement surface
(`getBestPlacementAngles`, `findPlacementAngles`, `AutoPlacer`, `SpatialHashGrid2D`, `packetLimit`),
so one migration path covers both.

## 1. Premise — five decisions that make it one system

1. **One geometry engine, no sampling.** Every placement question resolves to continuous free intervals on the placement ring, computed once per profile per tick. No module scans a ring, so no module has a blind spot the width of its step, and resolution stops being a tunable.
2. **One candidate record.** Auto place, preplace and replace produce the same record and differ only in the Opportunity that spawned it. There is no preplace code path that can fall out of sync with the auto place code path, because there is one path.
3. **One score, no booleans.** A candidate is a number, not a verdict. Ladders collapse into weighted terms, which is what makes ordering, budgeting and combination search possible — none of which a true/false test can support.
4. **One ledger, client-wide.** Every path that places — including the sync, defense and utility modules that currently call the packet layer directly — reserves its footprint in one place and reads it before generating. Conflicts resolve before the wire, not by whichever module ran first.
5. **One plan per tick.** The tick's output is a set chosen together under the budget, ordered by value. Nothing sends opportunistically as it is discovered.

## 2. The model — five records

```
BuildProfile   // registered once per buildable; the engine reads nothing else about items
  id, itemGroup, footprint, placeOffset, roles[], riverLegal, cost

Opportunity    // what makes a placement worth considering right now
  kind      'open' | 'vacating' | 'vacated'
  horizon   0 | 1                // which tick the world is sampled at
  vacates   objectRef | null     // treated as absent when building apertures
  origin    'tick' | 'attrition' | 'deletion'
  deadline  ms | null            // when the slot is predicted to actually open
  urgency   0..1

Aperture       // a continuous legal interval on the placement ring
  start, end, span               // wrap-aware, disjoint, sorted
  ApertureSet = Aperture[]       // closed under intersect / subtract / nearest

Candidate      // one concrete proposal — the shared model
  profile, angle, footprint{x,y,r}
  opportunity, aperture, edgeDistance
  terms{}                        // every scoring term retained, for the devtool
  value                          // weighted sum under the opportunity's profile

Order          // an admitted candidate with a firing decision
  candidate, priority, fireAt, trigger, reservation, token
```

The unification lives in **Opportunity**. Auto place, preplace and replace are three values of `kind`,
differing in which tick the world is sampled at, which object is treated as absent, and when the order
may fire. Everything after the Opportunity is shared code.

## 3. Three behaviours, one path

| Behaviour | kind | horizon | vacates | fires | weight profile |
| --- | --- | --- | --- | --- | --- |
| Auto place | `open` | 0 | — | immediately, in plan order | engagement |
| Preplace | `vacating` | 1 | the doomed object | at `deadline − ping`, or on its deletion | anticipation |
| Auto replace | `vacated` | 0 | — | on the deletion packet | recovery |
| Spike placement | any | any | any | per opportunity | role: `damage` |
| Trap placement | any | any | any | per opportunity | role: `trap` |
| Future types | any | any | any | per opportunity | role: declared |

## 4. Module contracts

### GeometrySolver
*Pure math. No client state, no side effects, testable in isolation.*
`blockers, ring, profile → ApertureSet`

- **Occlusion arcs.** For each blocker, the angular interval its footprint removes from the ring, by law of cosines against the ring radius. Three degenerate cases handled explicitly rather than clamped: blocker entirely outside the ring band, entirely inside it, and swallowing the ring. RYN's current solver collapses the middle case into a full-circle block.
- **Boundary occlusion.** River band and map edge become occlusion arcs computed analytically against the ring, not a point test applied after the fact. A player at the river gets correct apertures instead of a legal angle rejected at the last moment.
- **Aperture algebra.** Union of blocked arcs, inversion to free arcs, then `intersect`, `subtract`, `contains`, `nearest`. Wrap-aware by construction — the seam blind spot becomes impossible, not fixed.
- **Sweep tests.** Interception and sightline use point-to-segment distance against the footprint circle, not an axis-aligned box. The box approximation over-reports on diagonals, where most real placements sit.

### ThreatAnalyzer
*The world model. One sweep per tick, read by every other module.*
`managers → WorldFrame`

- **Drift.** Own and target positions at horizon 0 and 1. Decayed integration with a stop detector fed by the input bitmask and the falling `pos.previous → current` delta, so a braking target is not predicted through the brake.
- **Attrition.** For every entity whose weapon comes ready inside the horizon, one grid query at its weapon range yields hits-remaining per object from real damage (variant, gear, building multiplier). Own pending breaks come from the autobreak state RYN already tracks. Output: `objectId → {hitsLeft, doomedAt, byWhom}`.
- **Topology.** Friendly damage-bearing objects, traps, the trap holding the target, the trap holding me — from the same sweep that built attrition.
- **Pressure.** Budget headroom, engagement band, whether a higher-priority module has claimed the tick.

### CandidateGenerator
*Opportunities into apertures, apertures into proposals.*
`WorldFrame + Opportunity[] → Candidate[]`

- Builds the blocker set for an opportunity: grid neighbourhood at the horizon's origin, minus `vacates`, plus any footprint already reserved this tick.
- Memoised on `(profile, horizon, vacates)` per tick, so preplace and replace share cache entries with auto place whenever they ask the same geometric question.
- Emits one Candidate per proposed angle, carrying its aperture and distance to the nearest aperture edge so downstream terms never recompute geometry.

### AngleSolver
*Which angles inside an aperture are worth scoring at all.*
`ApertureSet + intents → angle[]`

- **Edge angles** — both ends of each aperture, inset by epsilon. The packed placements, found exactly, including across the wrap seam.
- **Contact angles** — exact angles where the footprint touches a nominated circle (target hull, trap mouth, a specific spike). Same law-of-cosines call as occlusion, run in reverse.
- **Intent angles** — a semantic direction snapped to the nearest legal angle: toward the target, toward the vacating object, along a rebound line, away from my own drift.
- **Span midpoints** — one safe filler for wide apertures.
- Typical output: 6–20 angles per profile, against 72 probes per profile today, each present for a stated reason.

### PlacementScorer
*A proposal into a comparable number.*
`Candidate + WorldFrame → value`

- Positive: `intercept` (crosses the target's drift sweep), `contact` (overlaps the hull now), `rebound` (project the knockback ray, score what it terminates in — spike-to-spike corridor > single spike > trap), `capture` (probability the target enters a trap footprint, weighted by their aim pointing away), `enclosure` (how much of a trapped target's escape ring this removes — the same aperture engine run centred on *them*), `packing` (edge proximity).
- Negative: `mobility` (occludes my drift corridor), `sightline` (occludes my line to the target), `exposure` (hands the target a tick or push angle against me), `cost` (packets and resources at pressure), `staleness` (recent attempts at this angle).
- Weights come from the opportunity's profile, so anticipatory and recovery placements weigh the same terms differently without either owning a separate code path. Terms are retained on the candidate for the devtool overlay, making tuning an inspection rather than a guess.

### PlacementPlanner
*Composing the tick's set.*
`Candidate[] + constraints → Plan`

Bounded beam search over an ordered insert, evaluating **marginal** value against the partial plan rather than absolute value in isolation. Constraints — shared packet budget, per-profile item counts and resources, mutual footprint separation, per-opportunity caps — are checked inside the search, so the emitted plan is already affordable. See section 5.

### ConflictResolver
*Arbitration across the whole client.*
`Plan + ledger → Order[]`

- Holds the reservation ledger: footprint, owning module, priority class, expiry in ticks.
- Priority classes explicit and total: `INSTA > SYNC > DEFENSE > RECOVERY > ANTICIPATION > ENGAGEMENT > UTILITY`. A higher class preempts a lower class's unfired orders within the tick; equal classes resolve by value.
- Legacy direct calls keep working — the existing place path writes into the ledger as it fires, so the engine sees unmigrated modules. This is what makes the migration gradual rather than a flag day.

### PlacementScheduler
*When each admitted order may fire.*
`Order[] → armed timers + immediate set`

- Horizon-0 orders fire immediately, in plan order.
- Anticipatory orders are armed **twice**: a tick-anchored timer at `deadline − ping`, and a deletion trigger on the object they wait for. Whichever arrives first fires the order and cancels the other. This is the whole of what preplace and replace used to disagree about, resolved by arming one order both ways.
- An order reaching its timer while the object still lives is **re-validated** against the current aperture before sending, never resent blind. If the slot is gone the order is dropped and the packets stay in the budget.

### PlacementExecutor
*The only code in the engine that touches the wire.*
`Order[] → packets`

- **Batching.** Consecutive orders on the same item type share one select and one restore: a run of N same-type builds costs `2 + 2N` packets instead of `4N`. On a four-build plan, ten packets against sixteen — budget the planner can spend on a fifth placement.
- **Aim preservation.** Attack angle restored after each batch from the angle the client was already using, so a build never drags a swing off target.
- **Pre-flight.** Resource and item-count check, plus a final aperture re-check for anything firing late. Nothing the server would refuse reaches the wire.
- Every send is recorded to memory with its tick and quantised key before the next order is written.

### PlacementMemory
*What was tried, what landed, what to stop trying.*
`sends + world events → suppression + stats`

- Ledger keyed by quantised angle, where the quantum derives from the profile's angular width at ring radius rather than a fixed tolerance — a small trap and a large platform deduplicate at the resolution each actually needs.
- Outcomes close the loop: matching object creation marks a send landed; an aperture still open at that angle a tick later marks it refused. Refusals feed a decaying `staleness` penalty rather than a hard ban, so a legitimately reopened slot is available again immediately.
- A hard per-key send ceiling per tick sits in front of everything, making runaway repetition structurally impossible rather than reactively corrected.
- Rolling counters — plan value, candidates evaluated, packets spent, land rate — feed RYN's existing devtool page.

## 5. Pipeline — one pass per tick

A single `postTick` on a single registered module. Stages are ordered by data dependency.

| # | Stage | Data |
| --- | --- | --- |
| 1 | `Memory.expire` — retire stale ledger entries and suppressions | tick → ledger |
| 2 | `ThreatAnalyzer.frame` — the single world sweep | managers → WorldFrame |
| 3 | `Opportunities.collect` — tick opportunity plus every attrition slot, ranked by urgency | WorldFrame → Opportunity[] |
| 4 | `CandidateGenerator.apertures` — blockers minus vacates, per profile, memoised | Opportunity → ApertureSet |
| 5 | `AngleSolver.propose` — edge, contact, intent and midpoint angles | ApertureSet → angle[] |
| 6 | `PlacementScorer.weigh` — terms and weighted value per candidate | Candidate[] → valued |
| 7 | `PlacementPlanner.compose` — beam search under the budget | Candidate[] → Plan |
| 8 | `ConflictResolver.admit` — reserve footprints, resolve priority | Plan → Order[] |
| 9 | `PlacementScheduler.arm` — immediate set, timers, deletion triggers | Order[] → armed |
| 10 | `PlacementExecutor.flush` — batch, pre-flight, send, record | Order[] → packets |
| → | `Engine.onVacated` — deletion hook, re-enters at stage 4 on this tick's frame | event → stages 4–10 |

The deletion hook is the only entry point outside the tick. A deletion arriving mid-tick re-enters at
stage 4 with the frame already built, so a replace decision costs four stages over one neighbourhood
rather than a full rebuild.

## 6. Planner — choosing a combination, not a first hit

Candidates interact in two directions, both invisible to any scheme that picks winners one at a time.
**Synergy**: a trap placed where a spike's rebound corridor terminates is worth more than either alone,
because together they are a loop. **Redundancy**: two builds covering the same slice of the target's
approach are worth less than their sum, because the second only collects if the first was refused.

```
value(P)  =  Σ value(c)                    for c in P
           + Σ synergy(a, b)               for each pair in P
           − Σ redundancy(a, b)            for each pair in P
           − cost(P)                       packets · pressure

synergy(a, b)     rebound corridor of a terminates in footprint of b
                  a and b jointly enclose a trapped target
                  b covers the escape arc a pushes into

redundancy(a, b)  overlapping intercept coverage of the same drift sweep
                  same aperture, adjacent angles, same role

// bounded beam over an ordered insert
P₀ = ∅
for depth d in 1..maxPlacements:
    for each partial plan p in beam (width W):
        for each of the top K feasible remaining candidates c:
            // feasibility uses a live blocker set — p's footprints included
            marginal = value(p ∪ c) − value(p)
    beam ← best W partials by value
    stop when no marginal > 0

// K=8, W=4, D=4 → 128 marginal evaluations, bounded and deterministic
```

Feasibility uses a **live** occlusion set: an accepted candidate's footprint is appended to the working
blocker list for the rest of that branch, so two members of one plan can never be proposed into the same
space. The budget enters the search rather than truncating its output — under packet pressure the planner
does not place fewer of the same choices, it re-solves for the best plan that fits, which is usually a
different and better-targeted set.

## 7. Extension — future building types cost a registry entry

No module in the engine reads an item id. Scoring terms key off roles, and a role is a declaration.

```
register({ id: SPIKE,    roles: ['damage'],           footprint: …, riverLegal: false })
register({ id: TRAP,     roles: ['trap', 'block'],    footprint: …, riverLegal: false })
register({ id: WALL,     roles: ['block'],            footprint: …, riverLegal: false })
register({ id: MILL,     roles: ['block', 'economy'], footprint: …, riverLegal: false })
register({ id: TURRET,   roles: ['damage', 'block'],  footprint: …, riverLegal: false })
register({ id: PLATFORM, roles: ['traverse'],         footprint: …, riverLegal: true  })

// scoring terms subscribe to roles
rebound ← 'damage'    enclosure ← 'block'
capture ← 'trap'      mobility  ← every role
```

A role the engine has never seen scores zero on every existing term and contributes only its own — the
correct default for something the engine cannot yet reason about.

## 8. Teardown defects — where each lands

| # | Defect | Resolved by |
| --- | --- | --- |
| D1 | Placer hardcodes player radius 35 while the client derives it from live scale | BuildProfile carries footprint and offset; ring radius comes from RYN's own place-scale accessor, resolved once for every module |
| D2 | Packed-angle detection never compares the wrap seam | Apertures are wrap-aware intervals — no index to walk off the end of |
| D3 | Preplace geometry centred on current position but lands a tick later | Opportunity carries a horizon; horizon-1 apertures are built at the drift-predicted origin |
| D4 | Replace is a blind timed resend though deletions are already received | Deletion hook is a first-class entry point; recovery opportunities are planned fresh, the timer becomes a re-validating fallback |
| D5 | Two solvers with no shared state, coordinating through coarse flags | One engine, one ledger; legacy direct calls write into the same ledger |
| D6 | Only one doomed object considered per tick | Attrition produces every doomed object, ranked by urgency; the pursuit cap is configuration, not structure |
| D7 | Two ladder branches hardcoded to false | Ladders are gone; a dormant behaviour is a zero weight, which costs nothing and reads honestly |
| D8 | Ban keys are exact floats, workable only at fixed 72 steps | Memory quantises by the profile's angular width and decays refusals rather than banning |

## 9. Integration — landing it without a flag day

**Phase 1 — engine lands beside the existing code.** GeometrySolver ships first and the existing angle
helper delegates to it, extracting endpoints from apertures. Every current consumer — sync, trap-animal,
defense — keeps its exact contract while gaining correct wrap and river handling underneath.

**Phase 2 — the ported placer is retired.** The engine takes over auto place, preplace and replace, and
the old placer is deleted rather than disabled. Existing settings map onto the model: the placer toggle
enables the engine, the preplace and replace toggles gate anticipation and recovery opportunities, and the
radius slider becomes the engagement band.

**Phase 3 — remaining placers migrate to claims.** Modules that place directly move to reserving through
the resolver. Each migration removes one more source of ordering-dependent waste, and none of them has to
move before the engine is useful.
