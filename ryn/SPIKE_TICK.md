# Spike Tick

Everything below is read out of source: moomoo's own server code (which
X- Precision ships verbatim), `ryn/RYN_Client_v5.4.user.js`, and the ten
reference clients. Numbers come from `harness/spike-geometry.js`, which derives
them from the game's item table rather than restating them.

---

## 1. What a spike tick actually is

Not a move the game knows about. Three server rules, and the whole feature is
their intersection.

**A build always lands on your own ring** (`Player.buildItem`, X- 17645):

```js
var tmpS = (this.scale + item.scale + (item.placeOffset || 0));
var tmpX = this.x + (tmpS * mathCOS(this.dir));
var tmpY = this.y + (tmpS * mathSIN(this.dir));
```

The angle you face is the *only* free variable. Spikes land 79 from you,
greater/poison/spinning 82, traps 80.

**A spike hurts on passive collision** (`ObjectManager.checkCollision`, 17105):

```js
tmpLen = player.scale + other.getScale();
if (mathSQRT(dx*dx + dy*dy) - tmpLen <= 0) {
    ...
    player.changeHealth(-other.dmg, other.owner, other);
    var tmpSpd = 1.5 * (other.weightM || 1);
    player.xVel += tmpSpd * mathCOS(tmpDir);   // pushed away from the spike
```

Checked every server tick as they move. `other.owner != player` — **your own
spikes damage them exactly as much as theirs do.**

**A build is legal only on clear ground** (`checkItemLocation`, 17084):

```js
blockS = obj.blocker || obj.getScale(0.6, obj.isItem)
if (obj.active && getDistance(x, y, obj.x, obj.y) < (s + blockS)) return false;
```

`getScale(sM, ig) = scale * (isItem ? 1 : 0.6*sM) * (ig ? 1 : colDiv)`. For a
placed item `ig` is true, so **colDiv does not apply to blocking**: a pit trap
blocks with its full 50 while its collision radius is only 10.

So a spike tick is: *make a spike touch them, in the same tick your weapon hit
lands.* The server does the rest. There are exactly two ways to arrange it —
place a spike so it already touches them, or hit them so the knockback carries
them into one that exists.

## 2. The geometry, and what it forbids

`node harness/spike-geometry.js`

| item | dmg | ring R | hurts within | blocks within | max reach |
| --- | --- | --- | --- | --- | --- |
| spikes | 20 | 79 | 84 | 49 | 163 |
| greater / poison / spinning | 35 / 30 / 45 | 82 | 87 | 52 | 169 |
| pit trap | – | 80 | 45 (colDiv 0.2) | 50 | 125 |

A spike on my ring at angle θ touches a target at distance *d* when
`cos θ ≥ (R² + d² − 84²) / 2Rd`. That is one arc centred on the aim:

| d | 45 | 79 | 100 | 120 | 130 | 145 | 163 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reach window | ±80° | ±64° | ±54° | ±44° | ±38° | ±28° | 0 |

Two spikes on the same ring need their centres 98 apart, which on R = 79 is
**76.7°**. So a second reaching spike exists only while the window is wider
than that — **below d ≈ 130**.

**Three things in the brief are not achievable as written, and it is better to
say so than to ship something that pretends:**

- *"Prioritize a Spike position near the enemy"* — there is no such choice.
  Every spike lands at exactly R from me. "Near them" means "at the angle that
  points at them", which is one option, not a distance trade-off.
- *"TRAP — GAP — TRAP, close the gap"* — only if that gap happens to lie on my
  ring. Otherwise closing it means walking there first, which is a movement
  decision, not a placement one.
- *"escape denial", "side gaps", "openings between existing structures"* — all
  collapse to the same single question: which one angle on my ring is worth 5
  packets. They are not separate mechanisms.

What *is* real: **scoring the angles inside the reach window** by what they do
to the target — and RYN already has the machinery for that
(`PlacementScorer`, `SiegeAnalysis.isEscapable`, `engine._exits`).

## 3. What is already in RYN

The old spike tick was deleted last change. What remains is a lot more than it
looks, and most of the brief is already built.

### Already exists and must be reused, not rebuilt

| Need | What RYN already has | Where |
| --- | --- | --- |
| target tracking | `EnemyManager.nearestEnemy` / `nearestTrappedEnemy` / `_nearestEnemy` | 2560+ |
| movement prediction | `TargetMotion` — velocity, acceleration, heading, **stability**, **headingShift**, speed bounded by the game's own decay, confidence, `intercept()` | 10712 |
| angle solving | `engine.anglesFor()` → `CandidateGenerator.apertures` + `GeometrySolver` — one solver, already used by `ObjectManager.getBestPlacementAngles` | 11893 |
| **spike-tick candidates** | `EnemyManager.nearestSpikePlacerAngle` — every legal ring angle whose spike would touch the nearest enemy, filtered by the server's own collision test | 3080–3096 |
| duplicate/ground arbitration | `PlacementLedger` + `ConflictResolver` (hard reservations, soft preplace holds, priorities) | 9930 / 11082 |
| pending placements | `engine.book.pending()`, `engine._plan`, `engine._replacePlan`, `ledger.entries` | 10889 |
| packet budget | `PlacementScheduler.budget()` / `affords()`; `requestPlace` → `engine.request` → validate → ledger → executor | 11130 |
| escape analysis | `SiegeAnalysis.isEscapable`, `engine._exits` | 9548 |
| knockback reach | `Player.getActualMaxKnockback` (primary + secondary + 33.3 turret) | 2470 |

**There is no missing infrastructure.** A new spike tick needs no new target
tracker, no new predictor, no new angle solver, no new packet path.

### The existing spike/knockback modules, and what each covers

| module | fires when | places? | swing |
| --- | --- | --- | --- |
| `SpikeSync` | `canSpikeSync` — the reaching-angle set goes from empty to non-empty **and an object was destroyed this tick** | yes, all reaching angles | hat 7, primary, then turret |
| `SpikeSyncHammer` | hammer breaks a low-HP object beside a synced enemy | yes, same angles | hat 7, primary, aimed at their *future* position |
| `KnockbackTick` | a spike hostile to them sits directly behind them, within my knockback | calls `attemptSpikePlacement()` | hat 7, primary, turret follow-up |
| `TrapKB` | knockback carries them into a **trap** | no | primary |
| `VelocityTick` | Glotus port — moves me so the knockback band lines up | no | hat 53, `moveTo` |
| `SpikeGearInsta` | hat-11 / hat-7 duel timing | no | hat 7, primary |
| `AutoPlacer` | Luna auto place; scores `canSpikeTick` per candidate | yes | no |

### The gap, precisely

`canSpikeSync` is:

```js
get canSpikeSync() {
  return this.nearestPlaceSpikeAngle !== null && this.client.ObjectManager.isDestroyedObject();
}
```

`nearestPlaceSpikeAngle` is a **rising edge** (null last tick, non-null now), and
`isDestroyedObject()` is true only on a tick where something was deleted. So
RYN computes a perfectly good set of reaching angles every single tick and acts
on it **only in the one frame where a building dies**. Every ordinary case —
they walked into range, they are trapped, they are about to be in range — falls
straight through.

And one piece of state is computed every tick and **read by nothing**:

```js
if (isEnemyObject && (isSpike || isCactus) && target.collidingObject(object) &&
    this.isNear(target, this.enemySpikeCollider)) {
  this.enemySpikeCollider = target;          // 2920 — no reader anywhere
}
```

That is "an enemy is touching a spike right now", which is the single most
valuable spike-tick trigger there is. Same situation `pushingOnSpike` and
`nearestEnemySpikeCollider` were in before earlier changes.

## 4. Why the previous attempt failed

Worth recording, because the new design is shaped by it.

The removed `SpikeTickController` asked the engine for **its own placement**, at
`angles[0]` — the angle nearest the aim. Every placement the engine sends leaves
a *hard* reservation, and `PlacementLedger.blocked()` returns on `!e.soft`
**before priority is read**:

```js
if (hypot(x - e.x, y - e.y) >= radius + e.radius) continue;
if (!e.soft) return true;          // hard entry wins outright
if (e.priority > priority) return true;
```

So SYNC (80) never got to outrank ENGAGEMENT (40). And `angles[0]` is precisely
the angle auto place had usually just taken — because it aims at the same enemy.
It then replanned onto the same taken angle twice and cancelled.

The lesson is not "raise the priority". It is that **the spike tick was trying
to be a placer**, which is the responsibility split the brief gets right.

## 5. What shipped

One module, `SpikeTick`, that owns **timing and target selection** and nothing
else. It never reserves ground speculatively and never runs a second search.

```
EnemyManager (target, trapped, colliders)   engine.motion (velocity, heading,
        │                                    stability, confidence, intercept)
        └──────────────┬─────────────────────────────┘
                       ▼
              OPPORTUNITY SCAN            ← one pass, four classes:
                       │                    CONTACT  a spike touches them now
                       │                    CARRY    knockback carries them in
                       │                    COVERED  a spike auto place / preplace /
                       │                             replace already owns will reach
                       │                    OPEN     a reaching angle is free
                       ▼
              TARGET CHOICE               ← highest-value class, with hysteresis
                       │
                       ▼
              WINDOW CHECK                ← reloaded, in weapon range, not
                       │                    shouldIgnoreModule, no shame risk
                       ▼
        ┌──────────────┴──────────────┐
   swing only                    place + swing
   (CONTACT / CARRY /            (OPEN only, and only through
    COVERED)                      engine.requestMany at an angle
        │                         the ledger says is free)
        └──────────────┬──────────────┘
                       ▼
              FINAL REVALIDATION         ← re-read positions, ledger and
                       │                   apertures on the same tick
                       ▼
      moduleActive / useAngle / forceHat / forceWeapon / shouldAttack
                       ▼
              turret follow-up next tick
```

**Compatibility, by construction:**

- *Auto place* — the spike tick reads `ledger.entries` and standing objects to
  discover what auto place has done, and only ever asks for an angle the
  `ConflictResolver` reports free. It takes no ground from anyone. It joins the
  `LUNA_SPIKE_TICK_MODULES` stand-off set so auto place does not spend the
  tick's packets underneath it — the same treatment `spikeSync` already gets.
- *Preplace* — reads `engine.book.pending()` to know a reaching spike is
  already booked, and stands down rather than paying for a second one. Uses
  `engine.motion`, never a second predictor.
- *Replace* — a `ledger` entry owned by `replace` is geometry in flux;
  candidates are revalidated after it, never against a pre-replace world.
- *Combat* — sets the same four `ModuleHandler` fields every other combat
  module sets, respects `moduleActive` first-come-first-served and
  `EnemyManager.shouldIgnoreModule()`. It adds no attack logic of its own.
- *Packets* — every placement goes through `ModuleHandler.requestPlace` →
  `engine.request`, so the existing budget, batching, ledger and memory all
  apply. No new packet path.

**Resolved:** the new module **absorbs** `SpikeSync`, which is deleted along
with the three `EnemyManager` members that existed only to gate it
(`canSpikeSync`, `nearestPlaceSpikeAngle`, `prevNearestSpikePlacerAngle`).
`SpikeSyncHammer` keeps its hammer-break trigger and calls
`spikeTick.strike(...)` for the execution, so there is one place that decides
how a spike tick is performed rather than two.

**Aggression:** trapped first, free enemies too, with a sub-toggle each
(`_spikeTickTrapped`, `_spikeTickFree`, both on; `_spikeTick` itself ships off).
A trapped target is worth `SPIKE_TICK_TRAPPED_BONUS` (45) more than a free one,
because it cannot walk off the spike.

## 6. What was measured

`node harness/spike-geometry.js` — the reach window, the separation rule and the
d ≈ 130 crossover, derived from the item table rather than restated.

`node harness/spike-tick.js` — **the class itself**, lifted out of the client
with `vm` and run, together with the real `GeometrySolver`, `TargetMotion` and
`PlacementLedger`. Only the world around them is staged. 26 scenarios (the 20
in the brief plus six the geometry made worth adding) and 5 multi-tick
properties. 18 mutations of the module are run against it and all 18 turn it
red, so the table is not vacuous.

`node harness/ryn-changes-check.js` — 85 checks, of which the spike tick's are:
it is registered and runs before `autoPlacer`, `placementEngine` and
`updateAttack` and after `spikeSyncHammer`; it never calls `preempt`,
`ledger.reserve`, `claimPlacement` or `_conflicts.take`; it consults
`ledger.entries` and `book.pending()` and refuses to swing when a send did not
go out; it uses `engine.motion` and `engine.anglesFor` and builds neither of its
own; and `SpikeSyncHammer` no longer sets a hat or places a spike itself.
`python3 harness/ryn-changes-mutate.py` breaks the client 31 ways and requires
the checker to go red each time.

### Two guards that were removed because they could never decide anything

Both were written, then measured, then deleted — which is the point of measuring.

* **An angle cooldown** (do not ask for the same angle twice within two ticks).
  Unreachable: `_coveredBy` sees the hard ledger entry a send leaves and returns
  COVERED before `_openAngles` is consulted, so an angle just asked for is never
  offered again while the claim stands. Where it *would* be reachable — the
  server refusing the build, so no object and no reservation — blocking a retry
  is wrong, and `PlacementMemory` already penalises angles the server keeps
  refusing.
* **A 60° turn limit** on the motion track. `TargetMotion`'s own confidence
  carries a `turning` factor, and by 60° it has already collapsed below
  `SPIKE_TICK_MIN_CONFIDENCE`; a guard at 60° cleared the confidence floor only
  in a 0.13°-wide sliver. It was kept but **retuned to 30°**, where it bites
  first and is the test that decides — which is what the brief asks for.

## 7. Limits that remain

- RYN does not boot in this harness and did not before any of these changes
  (`boot-check.js` gives the same `appendChild` fault on the pristine upload),
  so nothing here is verified by playing.
- The client cannot see the server's authoritative positions, only echoes one
  half round trip old. Every "will it touch" test is a prediction, and at high
  ping the target has already moved.
- Spike group limit is 15 and each placement costs 5 packets of a 119 budget;
  a spike tick that fires often is a spike tick that starves auto place. It is
  off by default for that reason, and it asks for **one** angle per tick.
- `engine._exits` is written by the engine's own sweep, which runs later in the
  tick, so the enclosure term reads a one-tick-old escape analysis.
- The ledger records a radius, not an item type, so "a claim the size of my
  spike" is how a pending spike is told from a pending trap (49 vs 50). Two
  spike kinds of the same scale are indistinguishable there.
- `SpikeTick` reads `EnemyManager.enemySpikeCollider` as a candidate but derives
  contact itself, because that field only ever holds one target.
