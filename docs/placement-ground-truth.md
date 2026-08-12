# Placement ground truth — game source, client audit, revised architecture

Research phase for the RYN placement redesign. **The game source is the authority; client code is an
idea corpus only.** No RYN source is modified by this document.

Published: `claude.ai/code/artifact/ccfbb200-e2f4-45a2-bb37-c1b8a4ac168d`
Supersedes the compatibility claims in `docs/placement-engine.md`; see §7.

## 0. Corpus

Seven files. **No Glotus or Sakuna source was uploaded** — nothing in the corpus corresponds to either,
so neither is analysed. They can be folded in later without changing the method.

| File | Role | Placement content |
| --- | --- | --- |
| `1e7a80a5-12.txt` (game index) | **Authority** | The whole build path: `buildItem`, `canBuild`, `checkItemLocation`, `checkCollision`, `getScale`, item/group tables, movement integration, socket layer, opcode permutation |
| `3bfe9dfd-22.txt` (game vendor) | Authority (serialization only) | msgpack encode/decode, UI helpers, profanity list. **No game logic, no placement logic.** Relevant only as the frame format |
| `6f65c252-ryn_v5_2.txt` | Client | Two stacks: analytic angle helper + ported Luna placer |
| `325507b1-Whiteout_v4.js` | Client | Dense scan → additive scorer, field-wide break prediction, event-driven replace |
| `1676ddfa-Luna_Client_Full_Source_Code1.1.txt` | Client | 72-step probe, boolean ladders, one preplace target, three timed sends |
| `b90ed9af-novastorm.v1.4.js` | Client | The Luna placer with two deltas |
| `d8b65399-auraro_5.5.txt` | Client | Continuous free arcs, server-accurate movement simulator, exact hits-to-break |

Novastorm ≡ Luna: a line-level diff of both placement regions returns two differences — `canSpikeTick`
radius (55 vs 35) and the predict-weapon heuristic.

## 1. The build path, from the game source

```
buildItem(item):
    w = this.scale + item.scale + (item.placeOffset || 0)      // ring radius
    T = this.x + w · cos(this.dir)
    A = this.y + w · sin(this.dir)

    if canBuild(item)
       and (item.consume || checkItemLocation(T, A, item.scale, 0.6, item.id, false, this)):
           changeItemCount(group.id, +1)
           objects.add(T, A, this.dir, item.scale, item.type, item, false, this)
           useRes(item)
           this.buildIndex = -1                                 // only on success

checkItemLocation(x, y, s, sM, indx, ignoreWater, placer):
    for every active object o:
        r = o.blocker ? o.blocker : o.getScale(0.6, o.isItem)
        if dist(x, y, o.x, o.y) < s + r:  return false
    if !ignoreWater and indx != 18 and y within river band:  return false
    return true

getScale(t = 1, i):
    scale · (isItem || type==2 || type==3 ? 1 : 0.6·t) · (i ? 1 : colDiv)

canBuild(item):
    limit = inSandbox ? (group.sandboxLimit || max(group.limit·3, 99)) : group.limit
    if limit and itemCounts[group.id] >= limit:  return false
    return inSandbox ? true : hasRes(item)
```

### Verified mechanics

**G1 — The build lands at the server's position and direction.** `buildItem` reads `this.x`, `this.y`,
`this.dir` when the packet is processed: the server's state *after* that tick's movement integration. A
solver reasoning from the local current position is reasoning about a position the server has left.
Player scale is a transmitted field (`this.scale = f[8]`), not a literal — vanilla always sends
`playerScale = 35`, so hardcoding it is currently correct and structurally fragile.

**G2 — Validation is one circle test plus a river band.** No angular rule, no facing rule, no spacing
rule. Everything beyond this is tactics, not legality.

**G3 — Blocking radius ≠ collision radius.** For placement, `getScale(0.6, isItem)` gives placed items
their **full scale, colDiv ignored** — a pit trap blocks building at 50, not 10. Resources of type 0/1
use `scale·0.36·colDiv`; types 2/3 use `scale·colDiv`. The blocker item overrides with a flat
`blocker: 300`. For player collision, `getScale()` gives `scale·colDiv` — the same pit trap catches at
`35 + 10` and denies building at 50.

**G4 — Item limits are the group limits.** Outside sandbox the cap is `group.limit` flat: walls 30,
spikes 15, mill 7, mine 1, trap 6, booster 12, turret 2, watchtower 12, buff 4, spawn 1, sapling 2,
blocker 3, teleporter 2. Sandbox uses `sandboxLimit` or `max(limit·3, 99)`. Resources are checked only
outside sandbox.

**G5 — A refused build costs speed and your swing.** `buildIndex` clears **only on success**. A build
refused for collision, limit or resources leaves the item held; holding an item multiplies movement
speed by `0.5` and gates the entire attack/gather block. No client in the corpus models this.

**G6 — Spike knockback is a velocity impulse of exactly 1.5.** On contact the player is snapped to the
surface and velocity scaled by 0.75, then `vel += 1.5` along the axis from object to player. `weightM` is
an animal field, never set on buildings, so the multiplier is always 1. With `playerDecel = 0.993` per
millisecond, an uninterrupted impulse displaces `1.5 / (1 − 0.993) ≈ 214` units. Luna's 200 and
Whiteout's 170 are approximations of a number the source gives exactly.

**G7 — Traps lock movement and reveal themselves.** Contact sets `lockMove` and clears `hideFromEnemy`.
`lockMove` clears at the end of every update and is re-applied by the next collision pass.

**G8 — Enemy traps are invisible but still block your building.** `visibleToPlayer` hides
`hideFromEnemy` objects from non-owners; pit traps carry that flag. `checkItemLocation` iterates every
active object regardless of visibility. **An enemy trap you cannot see will silently refuse your
placement.** A hard limit on any solver.

**G9 — Shot blocking uses an axis-aligned box, by design.** Projectile occlusion tests `lineInRect`
against objects with `layer >= projectile layer` and no `ignoreCollision`. Layers: traps/boosters/
buffs/spawns/blockers/teleporters −1; walls/spikes/mine/sapling 0; mill/turret/watchtower 1; trees 3,
rocks 0, other resources 2. So the box is *correct* for predicting shot blocking and merely convenient
for reasoning about your own movement corridor.

**G10 — Movement is fully specified.** Per update with delta: `slowMult += 8e-4·δ` capped at 1;
`spd = (buildIndex≥0 ? 0.5 : 1) · weapon · skin · tail · (y ≤ 2400 ? snow : 1) · slowMult`; river when
not on a platform multiplies 0.33 and adds `0.0011·δ` current, or 0.75 and 0.4× current with water
immunity; `vel += dir · 0.0016 · spd · δ`; player collisions; `vel *= 0.993^δ` with a 0.01 snap; map
clamp by scale.

**G11 — The tick is 111.11 ms.** `serverUpdateRate: 9` → 111.11 ms per server tick, the origin of the
111 constant every client hardcodes. `clientSendRate: 5` → 200 ms movement cadence. `collisionDepth: 6`,
`colGrid: 10` → 1440-unit broadphase cell.

**G12 — Placement is four packets and the aim rides on the attack.** `z(itemId)`, then `F(1, dir)` — the
attack packet carries the direction whenever an item is held — optionally `F(0, …)`, then
`z(weaponId, true)`. **No separate direction packet is required to aim a build.** The vanilla direction
packet is independently throttled to changes above 0.3 rad.

**G13 — Frames cannot be batched.** Each send is msgpack `[opcode, args, seq]` with a monotonic sequence
number and a 6-byte truncated HMAC prefix, opcodes permuted per connection from the io-init seed. One
logical action per frame. Packet efficiency is purely how many actions you take.

**G14 — Gathering and building are mutually exclusive.** The whole reload/gather/projectile block is
gated on `buildIndex < 0`.

## 2. Matrix — 25 dimensions

| # | Dimension | RYN v5.2 | Luna 1.1 | Novastorm 1.4 | Whiteout v4 | Auraro 5.5 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Auto Place | perfect-then-placeable 2-pass, boolean ladder | same, origin of the design | same | dense scan → additive scorer, ranked | priority branches over exact contact angles |
| 2 | Preplace | one doomed object/tick, excluded from collision | one object, two scans | same | every doomed object via per-blocker break flags | urgency-ranked, ≤2/tick, from predicted position |
| 3 | Auto Replace | third timed resend of preplace | same | same | event-driven off object-death, full regrade | event-driven, case taxonomy over free arcs |
| 4 | Spike placement | knockback alignment scalar, one winner | same | same, wider tick radius | knockback destination simulated, corridor scored | contact fast-path, tactics outside solver |
| 5 | Trap placement | nearest intercept, then unconditional fallback | same, retrap test is a broken call | same | banded distance + aim misalignment | retrap ring ∩ free arcs |
| 6 | Multi-placement | overlap check at queue time | same | same | greedy non-overlapping top-4, spike wins ties | blocker list grows as it places |
| 7 | Candidate generation | 72 samples/item/tick, memoised | 72, recomputed several times/tick | same | 200 auto, 100 replace | two exact tangents per blocker |
| 8 | Angle generation | arc endpoints from tangent pairs | uniform ring | uniform ring | uniform ring | free arcs + snap semantic angle |
| 9 | Angle resolution | 5° fixed | 5° fixed | 5° fixed | 1.8° auto / 3.6° replace, degrades under load | continuous |
| 10 | Collision handling | spatial hash, radii match the source | calls the game's own validator | same | linear, records blockers + break state | linear with squared-distance prefilter |
| 11 | Building range checks | live scale, resources + count pre-checked | hardcoded 35, cap read as sandbox limit | same | hardcoded 35 | real scale, no resource pre-check |
| 12 | Target prediction | one linear extrapolation | stored next-tick position | same | velocity decay + deceleration detection | simulator can run the target |
| 13 | Movement prediction | none | none | none | decay model where used | full physics replay of the source |
| 14 | Placement scoring | boolean ladder | boolean ladder | boolean ladder | additive with negative terms | priority branches |
| 15 | Candidate ranking | two passes, unordered within | same | same | points descending, type tie-break | object iteration order |
| 16 | Conflict resolution | coarse module flags, two unaware solvers | one queue, no reservation | same | reserved priority locations, replace-only | reserved footprints read by generator |
| 17 | Placement ordering | perfect first, then placeable | same | same | by score | by object |
| 18 | Packet scheduling | fixed 111−ping / 111−minPing | same | same | per-object deadline from break estimate | tick-based, keyed actions |
| 19 | Packet efficiency | one shared budget, 4 packets/build | own counter, fixed 119 cap | same | tiered thresholds change behaviour | per-angle cap, no global budget |
| 20 | Duplicate prevention | ban list on exact float angles | same | same | angular tolerance + tick expiry + move invalidation | quantised per-tick counter, hard cap |
| 21 | Existing-object awareness | deletions tracked, feed only spike sync | one object, two scans | same | field-wide break prediction each tick | exact hits-to-break, urgency-ranked |
| 22 | Stale candidate handling | 18-tick ban after refusal | same | same | 6-tick expiry + movement invalidation | per-tick cache, rebuilt each tick |
| 23 | Target-change handling | recomputed each tick, no explicit switch | recomputed each tick | same | scores every enemy in range, not just nearest | recomputed, nearest only |
| 24 | Tick synchronization | tick counter, per-tick memo, tick bans, arbitration | timers off the tick callback | same | tick-keyed expiry | tick scheduling + per-tick caches |
| 25 | Special algorithms | spike-sync angle ∩ enemy hull | perfect-edge detection; knockback alignment | — | knockback corridor simulation; enemy slot denial | free-arc algebra; movement simulator; A* sharing the physics model |

## 3. Dossiers

### RYN v5.2 — two placement stacks

**What.** An analytic helper computes blocked arcs per nearby object and emits the arc endpoints not
covered by another arc, sorted by angular distance to a target and capped at four attempts; it serves
spike sync, trap-animal and placement defense. Separately a ported Luna placer probes 72 angles per item,
marks the ends of placeable runs, runs two boolean ladders and sends across three timed phases.

**How.** Blocked arcs from `(b² + c² − a²)/(2bc)` against the placement ring — exactly the geometry G2's
circle test implies. Collision on a spatial hash. Blocking radii reproduce `blocker || getScale(0.6,
isItem)` including the 0.36 resource factor and the flat 300 on the blocker item. Affordability checked
against resources and the real group limit before sending. One packet budget shared with every module.

**Strengths.** Only client whose collision cost does not grow with object count. Only client that
reproduces the source's blocking radii *and* its limit rule correctly. Only client with a single
client-wide packet budget. Strongest tick discipline in the corpus.

**Weaknesses.** Two solvers sharing no state, coordinating through order-dependent flags. The ported
placer inherits Luna's sampling, seam blind spot, single-preplace-target limit and blind third resend.
Preplace geometry built from the current position though the build lands a tick later. The spatial hash
indexes at collision radius, so the blocker item's 300-unit denial is under-indexed tenfold.

**Edge cases.** A blocker item 250 units away denies building per the source but is indexed at 31.5 and
queried at ±100, so RYN proposes angles the server refuses. The two solvers query the grid at different
radii (1 cell vs 4), so the same legality question gets two answers.

**What RYN takes.** Nothing for collision, ranges, budget or tick discipline — it is already the
reference on all four. The work is removing the second solver and the sampling it brought.

### Luna 1.1 — game-bundle fork, origin of RYN's ported placer

**What.** Probes 72 angles per item, flags the ends of each placeable run, scores nothing, runs two
boolean ladders. Finds a single object about to break, drops it from the collision set, sends the
resulting build three times: now, at 111−ping, and at 111−minPing.

**How.** Because Luna is a fork rather than a userscript, validation calls the game's own
`checkItemLocation` — the collision result *is* the game's answer. Interception is a box test against
the segment from current to predicted target position. Knockback preference is an alignment scalar:
project 200 units along the push axis, minimise the angle to an existing spike.

**Strengths.** Calling the real validator is a structural advantage no userscript can copy — it cannot
drift from the game. Perfect-edge detection correctly identifies that packed angles are worth more. The
three-phase send is a reasonable answer to not knowing when a slot opens.

**Weaknesses.** `isItemLimit` reads `sandboxLimit || 99` in every mode, so outside sandbox it believes it
can place 15-limit spikes until 99 — it keeps sending builds the server refuses (**contradicts G4**).
Booleans cannot rank. The trap retrap test calls the box helper with six of its eight arguments. The
perfect-edge loop never compares the wrap seam. The third send fires whether or not anything changed.

**Edge cases.** Its preplace mid-send block passes an object id where a collision array belongs — dead
work every tick. Its `for…in` edge loop compares string indices. Against G6, its 200-unit projection is
6.5% short of 214.

**What RYN takes.** Two ideas, both already present: packed angles carry more value, and interception
should test the swept path rather than the current point.

### Novastorm 1.4 — Luna lineage, two deltas

**What/How.** The Luna placer. Differences: spike-tick contact radius 55 rather than 35, and a
predict-weapon heuristic that falls through right-click/left-click state before the dagger and hammer
name checks. Same probe, ladders, three-phase send, 119-packet cap, same broken retrap call.

**Strengths.** The wider tick radius is the better of the two constants: with spikes at scale 49 and a
player at 35, a contact test at `scale + 35` is tight against the real threshold and the margin absorbs
one tick of drift.

**Weaknesses.** Inherits every Luna weakness including the item-limit bug.

**What RYN takes.** Only that a contact radius should be *derived* from G3's collision threshold —
`playerScale + scale·colDiv` — not picked. Neither 35 nor 55 is that number.

### Whiteout v4 — dense scan, additive scoring, event-driven replace

**What.** Scans the ring at ~2°, grades every legal angle with additive points, places the best
non-overlapping few. Break prediction runs field-wide every tick. Replace fires inside the object-death
handler, regenerating and regrading the whole ring at the instant a building dies.

**How.** Its collision check records *which* blockers were hit, their ids, and whether each is flagged
about to break, returning legal if every blocker hit is doomed — so one pass answers "legal now" and
"legal next tick" and the candidate carries the reason. A per-tick sweep sets that flag by testing every
armed enemy's real damage against every object in its weapon range. Knockback is simulated: project the
push, find what the target hits, score a spike-to-spike bounce corridor above a single spike above a
trap. It also computes the ring the *enemy* could build into and pays points for occupying those slots.

**Strengths.** The strongest tactical model in the corpus. Additive scoring makes candidates comparable —
the precondition for ordering, budgeting and combination selection. Event-driven replace is the correct
latency answer and matches how the source announces the change. Blocker provenance elegantly unifies
normal and anticipatory placement. Its duplicate prevention is the only scheme that survives the player
moving.

**Weaknesses.** Break prediction is binary (damage ≥ health) where the graded form is strictly more
informative. Blocking radius is right but the ring radius hardcodes 35. Weights are magic numbers
scattered through a long function. No global packet budget.

**Edge cases.** Its own comments flag that replace and preplace can still choose colliding locations,
handled by a reserved list only replace consults. Its dedupe tolerance is a flat 0.45 rad regardless of
item size — loose for a turret, tight for a sapling.

**What RYN takes.** Score additively instead of gating; predict breaks across the whole field; fire
replace from the deletion rather than a timer.

### Auraro 5.5 — continuous geometry, server-accurate simulation

**What.** Represents legality as continuous free intervals rather than samples. Computes the two exact
angles at which a build touches each blocker, unions the blocked arcs, inverts to free arcs, intersects
with tactical constraints, snaps a desired direction into what remains. Preplace is computed from a
simulated next-tick position; replace is a case taxonomy fired on the break.

**How.** The tangent pair comes from circle-circle intersection against the ring — the exact solution to
G2's distance test. Arc union is wrap-aware, inversion yields disjoint free intervals, intersection lets
a preplace be constrained simultaneously by legality, by the arc touching the doomed building, and by the
ring that would retrap the target. Its movement simulator replays G10 term for term, and the preplacer
temporarily swaps the player's coordinates to the simulated position before computing arcs.

**Strengths.** The only resolution-independent solver in the corpus — it removes an error class rather
than shrinking it. Break urgency is exact rather than binary. Reservation lists are consulted by the
generator itself. A per-tick quantised send counter with a hard ceiling makes runaway repetition
structurally impossible. The only client that recognised the G1 position problem.

**Weaknesses.** No sightline reasoning in the placer. Tactics are priority branches rather than scores,
so it shares the tie-break-by-iteration-order weakness. No resource pre-check. Its own comment concedes
the auto-placer was never finished.

**Edge cases.** Its simulator omits G5's build-held 0.5 multiplier, so a prediction made while an item is
selected runs 2× fast. Its river handling is a post-hoc point test rather than an arc, so a legal angle
beside the river is found and then discarded.

**What RYN takes.** The two structural ideas the redesign rests on: legality as continuous intervals, and
geometry computed at the position the build will actually land from.

## 4. Compatibility audit

**verified** = matches the source exactly · **approximate** = directionally right, quantifiable error ·
**wrong** = contradicts the source.

| Technique | Origin | Verdict | Against the source |
| --- | --- | --- | --- |
| Free-arc legality from exact tangents | Auraro | verified | Exactly solves G2. No sampling error; wrap handling is structural |
| Blocking radius via `getScale(0.6, isItem)` | RYN, Whiteout, Auraro | verified | Matches G3 including colDiv being ignored for placed items |
| Blocker item as radius 300 | RYN | verified | Matches G3. Only client that models it — but see D9 |
| Group limit as the cap, resources pre-checked | RYN | verified | Matches G4. Only correct limit implementation in the corpus |
| Item limit as `sandboxLimit \|\| 99` | Luna, Novastorm | **wrong** | Contradicts G4. Outside sandbox the cap is `group.limit` — 15 spikes, 6 traps |
| Movement simulation replaying the source | Auraro | verified | Matches G10 term for term, except G5's build-held 0.5 |
| Preplace from a predicted position | Auraro | verified | The only treatment consistent with G1 |
| Preplace from the current position | RYN, Luna, Nova, Whiteout | approximate | Contradicts G1 by one tick of drift; worst when moving fast |
| Break prediction across the whole field | Whiteout | verified | Nothing in G2 restricts refusal to one object |
| Exact hits-to-break | Auraro | verified | Reproduces the damage model; strictly more informative than binary |
| Collision carrying blocker provenance | Whiteout | verified | A pure superset of G2's boolean |
| Event-driven replace on object death | Whiteout, Auraro | verified | The deletion is how the source announces the slot; a timer guesses at it |
| Third blind resend at 111 − minPing | RYN, Luna, Nova | approximate | 111 is exactly the G11 tick, so the base is right; resending without re-validating is not |
| Knockback projected 200 units | Luna, Nova | approximate | G6 gives 214; ~6.5% short |
| Knockback projected 170 units | Whiteout | approximate | ~21% short, though the corridor test is the better structure |
| Knockback direction object→player | all | verified | Matches G6 |
| Box test for shot blocking | Luna, Nova, RYN | verified | G9: the source itself uses a box for projectile occlusion |
| Box test for own-movement corridor | Luna, Nova, RYN | approximate | No source behaviour to mirror; exact geometry is free and better |
| Layer-aware shot blocking | none | **wrong** | G9's layer rule is unmodelled everywhere. Layer −1 objects never block a shot, yet all clients treat them as occluders |
| Contact radius `scale + 35` / `+ 55` | Luna / Nova | approximate | G3 gives `playerScale + scale·colDiv`; both constants bracket it |
| Angular dedupe with expiry + move invalidation | Whiteout | verified | The only scheme that survives the player moving |
| Exact-float ban keys | RYN, Luna, Nova | approximate | Works only at a fixed 72 steps. Correctness that depends on candidate count is not correctness |
| Reserved footprints read by the generator | Auraro | verified | G2 is evaluated per packet in arrival order, so self-collision is real |
| Shared client-wide packet budget | RYN | verified | G13 confirms one action per frame; total actions are the only lever |
| Cost of a refused build | none | **wrong** | G5 and G14 unmodelled everywhere |
| Enemy placement-slot denial | Whiteout | verified | G2 applies symmetrically |
| Invisible enemy traps | none | **wrong** | G8 means refusals are not always explicable; nobody learns from them |

## 5. RYN defects, revised by the source

| # | Finding | Status |
| --- | --- | --- |
| D1 | Placer hardcodes player radius 35 | **Revised — downgraded.** G1 shows scale is transmitted, but vanilla always sends 35. Robustness, not a live bug |
| D2 | Packed-angle detection never compares the wrap seam | **Confirmed.** An artefact of sampling; disappears with intervals |
| D3 | Preplace geometry uses the current position | **Confirmed and sharpened.** G1 names what to predict: the server's post-update position |
| D4 | Replace is a blind timed resend | **Confirmed and sharpened.** G2 means the slot may be taken; G11 confirms 111 is the right fallback base |
| D5 | Two solvers with no shared state | **Confirmed.** Architectural, independent of the source |
| D6 | One doomed object per tick | **Confirmed.** G2 places no such restriction |
| D7 | Two ladder branches hardcoded false | **Confirmed.** Cosmetic but real |
| D8 | Ban keys are exact floats | **Confirmed.** |
| **D9** | Blocker item under-indexed in the spatial grid | **New — source-only.** G3 gives it a 300-unit denial radius and RYN models the radius correctly, but the grid indexes at *collision* radius (31.5) and the query looks one cell out. RYN proposes angles the server silently refuses |
| **D10** | The two solvers query the grid at different radii | **New — source-only.** One cell vs four. Under G2 the question is identical, so legality depends on which module asks |
| **D11** | Nothing models the cost of a refused build | **New — source-only.** G5/G14: a refusal leaves the item held, halving speed and suspending the weapon until the next select |

## 6. Architecture — RYN Placement Engine, grounded

Every constant traces to §1, not to a client. Auto place, preplace and auto replace remain one path
distinguished by `Opportunity` fields.

```
BuildProfile           // from the source's item table
  id, group, groupLimit, sandboxLimit, scale, placeOffset, colDiv
  blockRadius = blocker ?? scale                  // G3, placed items ignore colDiv
  touchRadius = playerScale + scale · colDiv      // G3, player collision
  layer, riverLegal (id 18 only), roles[]         // G2, G9

Opportunity
  kind     'open' | 'vacating' | 'vacated'
  horizon  0 | 1        // which server tick the ring is centred on — G1
  vacates  objectRef | null
  origin   'tick' | 'attrition' | 'deletion'
  deadline ms | null    // from predicted break, base 111.11 — G11

Aperture   start, end, span    // wrap-aware, disjoint; intersect / subtract / nearest
Candidate  profile, angle, footprint, opportunity, aperture, edgeDistance, terms{}, value
Order      candidate, priority, fireAt, trigger, reservation

// derived constants
TICK         = 1000 / 9 = 111.11 ms                  // G11
KB_IMPULSE   = 1.5                                   // G6
KB_TRAVEL    = 1.5 / (1 - 0.993) ≈ 214 units         // G6, replaces 200 and 170
HOLD_PENALTY = 0.5 × speed while an item is held     // G5, G14
```

**Layer 1 · Geometry** *(grounds G2, G3, G9)* — Blocked arcs from exact tangents, unioned and inverted
into continuous free intervals. Blocking radius is `blocker ?? scale` for placed items and the
type-dependent resource form. River band and map edge become arcs computed against the ring rather than
point tests applied afterwards. Two distinct occlusion questions kept distinct: legality uses circles,
shot blocking uses the source's own box test filtered by layer.

**Layer 2 · Indexing** *(grounds G3; fixes D9, D10)* — Index objects at `max(collisionRadius,
blockRadius)`, and derive every placement query's search extent from the profile's own reach rather than
a hardcoded cell count. One changed argument plus a derived radius.

**Layer 3 · World model** *(grounds G5, G6, G10)* — One sweep per tick: drift for self and every tracked
target using the source's integration, *including* the build-held 0.5 term that even Auraro's simulator
omits; attrition giving exact hits-remaining per object across every armed enemy; topology from the same
sweep, replacing three separate scans.

**Layer 4 · Candidates and scoring** *(grounds G6, G9, G5)* — Collision returns which blockers were hit
and whether each is doomed. Angles are proposed, not scanned: aperture edges, exact contact angles,
semantic directions snapped into the nearest aperture, midpoints for wide gaps. Every candidate is a
weighted sum with weights in a table. Rebound scoring uses the derived 214-unit travel. Sightline scoring
filters by layer. Cost includes the movement penalty of a refusal.

**Layer 5 · Planning and arbitration** *(grounds G2, G13)* — Bounded beam search over combinations under
the shared budget, scoring plans rather than members (synergy where a rebound corridor terminates in a
trap; redundancy where two builds cover the same approach). Accepted footprints join the working blocker
set inside the search. One reservation ledger with a total priority order, written by every placement
path including unmigrated ones.

**Layer 6 · Scheduling and execution** *(grounds G5, G11, G12, G14)* — Anticipatory orders armed twice:
a timer at `deadline − ping` on the 111.11 ms base, and a deletion trigger. Whichever fires first cancels
the other; a timer that wins while the object lives re-validates instead of resending blind. Batching
same-type runs is capped by a held-state budget in milliseconds, not applied greedily, and every batch
closes with a restore.

**Layer 7 · Memory** *(grounds G8)* — Quantised by the profile's angular width, with expiry and a
movement invalidation. Outcomes close the loop. G8 makes this structural rather than housekeeping:
invisible enemy traps mean some refusals cannot be explained from observable state, and a decaying
suppression is the only way to route around a blocker the client cannot see.

## 7. What the source changes about the earlier plan

**Batching is no longer free.** `docs/placement-engine.md` treated sharing a select across a same-type
run as pure profit (16 packets → 10). G5 and G14 price the other side: every millisecond the item is held
costs half your movement speed and all of your weapon, and a refused build extends that state until the
next select. Batching stays, capped by a held-state budget rather than applied greedily.

**The knockback constant is derivable, not tunable.** G6 gives an impulse of exactly 1.5 under 0.993
per-millisecond decay → ~214 units uninterrupted. Rebound scoring uses the derived number with its
derivation documented, so it is checkable rather than tuned.

**Sightline reasoning needs the layer rule and two different tests.** G9: the source uses a box for
projectile occlusion and filters by layer. Every client treats traps and boosters as sightline blockers;
the source says layer −1 objects never block a shot. The box that is *correct* for shot prediction is
merely convenient for own-movement reasoning, where exact geometry costs nothing.

**Some refusals are unknowable, which changes what memory is for.** G8: an enemy pit trap denies your
placement while being invisible to you. No solver can be complete. Memory stops being an optimisation and
becomes the only mechanism by which the engine routes around the part of the world it cannot observe.

D1 is downgraded on the evidence. Three new findings appear that only the source could produce: the
under-indexed blocker item, the two solvers disagreeing on grid search extent, and the unpriced cost of a
refused build.
