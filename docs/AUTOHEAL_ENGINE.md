# RYN Auto Heal Engine

A new, independent auto heal engine for the RYN client. It does not extend
RYN's existing autoheal, does not rebuild RYN, and does not change any other
system's behaviour — it reads them and yields to them.

Everything below is derived from the shipped game bundle (`src/game_index.js`,
`src/game_vendor.js`, tables in `drivers/game-drivers.json`) and from the target
client (`src/RYN_Client_v5.4.user.js`). Reference mods were read for mechanisms
only; none of their heal code is carried over.

---

## Phase 1 — game mechanics, from the bundle

### Health

| Fact | Value | Source |
|---|---|---|
| Player max health | `100` | `game_index.js:2234` (`this.maxHealth = 100`) |
| Heal clamp | healing at full health returns `false` and does nothing | `game_index.js:2418` |
| Damage sets the hit stamp | `f < 0 && (this.hitTime = Date.now())` | `game_index.js:2422` |
| Health broadcast | `"O"` per health change, `"8"` damage text | `game_index.js:2429-2431` |
| Death | `health <= 0` → `kill()` | `game_index.js:2426` |

```js
this.changeHealth = function(f, w) {
    if (f > 0 && this.health >= this.maxHealth) return !1;   // full → no-op
    f < 0 && this.skin && (f *= this.skin.dmgMult || 1);     // Soldier 0.75
    f < 0 && this.tail && (f *= this.tail.dmgMult || 1);
    f < 0 && (this.hitTime = Date.now());                    // <- shame clock
    ...
```

### Shame — the whole rule

`game_index.js:2458-2473`, inside `buildItem`:

```js
if (f.consume) {
    if (this.hitTime) {                          // only a PENDING hit is judged
        const W = Date.now() - this.hitTime;
        this.hitTime = 0;                        // first food after a hit only
        W <= 120 ? (this.shameCount++,
                    this.shameCount >= 8 && (this.shameTimer = 3e4,
                                             this.shameCount = 0))
                 : (this.shameCount -= 2,
                    this.shameCount <= 0 && (this.shameCount = 0));
    }
    this.shameTimer <= 0 && (V = f.consume(this));   // refused during the lock
}
```

Seven facts fall out of those lines, and the engine is built on them:

1. **Only the first food press after each damage event is judged.** `hitTime` is
   cleared by that press. Later presses in the same burst are free.
2. **Inside 120 ms of the hit: `+1`. Outside it: `-2`.** A damage event is worth
   `+1` or `-2` depending only on *when the first press lands*.
3. **Reaching 8 arms a 30 s lock** (`shameTimer = 3e4`) and resets the count.
4. **The press that trips the lock does not heal.** `shameTimer` is set *before*
   `consume` is reached, so a charged press at `shameCount === 7` costs the heal
   *and* buys 30 seconds of no healing. This is the one press the engine must
   never send.
5. **Presses during the lock still run the arithmetic** but never feed you, so
   they can re-arm another 30 s.
6. **A press at full health is free.** `consume` returns `false`, `useRes` is
   never reached (`game_index.js:2475`), so no food is spent — but the shame
   arithmetic above already ran. Full-health presses are the cheapest way to
   bank `-2`.
7. **`shameCount` never decays on its own.** `update` only zeroes it when a
   *lock* expires (`game_index.js:2312-2314`). The only route down is a late
   press. Shame control is therefore an *active* behaviour, not a wait.

`canBuild` gates the whole block (`game_index.js:2496`): outside sandbox it
requires the food cost in resources, so a press without food changes nothing —
not even the shame count.

### Food

| Item | id | Cost | Effect | Source |
|---|---|---|---|---|
| apple | 0 | 10 food | `changeHealth(20)` | `game_index.js:1872` |
| cookie | 1 | 15 food | `changeHealth(40)` | `game_index.js:1883` |
| cheese | 2 | 25 food | `changeHealth(30)` **plus** `dmgOverTime.dmg = -10, time = 5` → +10/s for 5 s | `game_index.js:1894` |

`skin.noEat` (Assassin Gear, hat 56) blocks food entirely — `game_index.js:2462`
(`!(f.consume && this.skin && this.skin.noEat)`).

### The one-second tick (regen, poison, bull)

`game_index.js:2316-2325` — one counter, reset to `1e3`, drives all of it:

```js
const C = (skin.healthRegen || 0) + (tail.healthRegen || 0);
C && this.changeHealth(C, this);                  // Medic +3, Bull -5, wings +3
this.dmgOverTime.dmg && (this.changeHealth(-this.dmgOverTime.dmg, ...), ...)
this.healCol && this.changeHealth(this.healCol, this);   // healing pad +15
```

Consequences the engine models:

- **Bull Helmet (hat 7) is `healthRegen: -5`** — a *negative* health change, so
  it sets `hitTime` once per second. That is the mechanism behind shame washing:
  it manufactures a pending hit on demand, which a late press converts into `-2`.
- **Poison (`pDmg`, Plague Mask, ruby variant) sets `hitTime` every second too.**
  While poisoned, a press in the 120 ms after a poison tick is charged. The tick
  is periodic and therefore predictable.
- Healing-pad `healCol` (+15/s, item 19) and regen gear are real health income
  and are part of the projection, not of the heal count.

### Timing

`serverUpdateRate: 9` (`drivers/game-drivers.json`) → one server tick every
`1000/9 ≈ 111 ms`, which the client mirrors as `SocketManager.TICK`.

Both ends of the shame comparison happen inside the server's update pass:
`hitTime` is stamped by a `changeHealth` call during a tick, and the comparison
runs in `buildItem` during a later one. The gap is therefore very close to a
whole number of ticks — and at 111 ms a tick, **one tick (111 ms) is the only
value that lands inside the 120 ms window. Two ticks is 222 ms and is always
credit.**

That gives the engine a verdict it can be certain about:

| press sent | server sees | verdict |
|---|---|---|
| on the tick the damage was seen | 1 tick after the hit | `+1` |
| on any later tick | 2+ ticks | `-2` |

Every error in that model runs the safe way: a delayed health packet or a ping
over one tick only pushes the real gap further out, never nearer. The wall-clock
lower bound — `(now - hitObservedAt) + pong`, which is what RYN's own gate uses —
is kept as a second route to credit for the case where latency alone has already
carried the press past the window.

**The practical consequence is the engine's central trade: one tick of patience
turns `+1` into `-2`.** That is what it spends, and the only thing it will not
wait for is a hit that would kill it first.

### Damage sources the threat model has to cover

From `drivers/game-drivers.json`: weapons up to `dmg 45` (polearm) ×1.18 diamond
variant, musket projectile `dmg 50`, arrows 25/30/35, turret projectile 25,
spikes 20/35/30(+5 poison)/45, `dmgK` knockback, `hitReturnRatio 0.25`.
Soldier Helmet `dmgMult 0.75` scales *incoming* damage (applied in
`changeHealth`, so it is a true reduction, not a client estimate).

---

## Phase 1 — the target client

Read-only surfaces the engine binds to (`src/RYN_Client_v5.4.user.js`):

| What | Where |
|---|---|
| Module contract | `moduleName`, `constructor(client)`, `postTick()`, optional `reset()`; registered in `ModuleHandler.staticModules` and run in `ModuleHandler.modules` order (`:16652`, `:16722`) |
| Self state | `ClientPlayer`: `currentHealth`, `tempHealth`, `previousHealth`, `receivedDamage`, `damageTick`, `tickCount`, `shameCount`, `shameActive`, `poisonCount`, `isDmgOverTime`, `bullTick`, `hatID`, `accessoryID`, `inventory`, `resources`, `inGame`, `isSandbox` |
| Shame mirror | `Player.updateHealth` (`:3484-3518`) reproduces the server rule client-side and clamps to `0..7` |
| DoT phase | `isBullTickTime(adjust)` = `(tickCount - bullTick - adjust) % 9 === 0` (`:3404`) |
| Threat | `EnemyManager`: `potentialDamage`, `potentialSpikeDamage`, `potentialSpikeKnockbackDamage`, `primaryDamage`, `instaThreat()`, `detectedDangerEnemy`, `dangerWithoutSoldier`, `collidingSpike`, `willCollideSpike`, `nearestEnemy` (`:2565-3220`) |
| Projectiles | `ProjectileManager.totalDamage` |
| Wire | `ModuleHandler.selectItem(2)` → `"z"`, `attack(null,1)` → `"F"`, `whichWeapon(_getPredictWeapon())` → `"z"`; 3 frames per press |
| Budget | `ModuleHandler.packetCount` / `packetLimit = 119`, counted at the transport (`PacketManager._watchSocket`) |
| Latency | `SocketManager.pong`, `SocketManager.TICK` |

### Two defects found in the target, and what the engine does about them

1. **`Player.maxHealth = Math.LN1`** (`:3294`, and the same in RYN v4 `:3252`).
   `Math.LN1` is `undefined`. Every comparison against it is `false` and every
   subtraction is `NaN`, so the existing rule's `tempHealth < maxHealth` gate is
   never true and its `Math.ceil((maxHealth - tempHealth) / restore)` is `NaN`.
   The shipped autoheal is inert. The engine never reads that field: max health
   comes from the bundle (`100`) with the client field used only if it is a
   finite positive number.
2. **`ModuleHandler.heal()`'s shame gate holds one tick, then presses anyway**
   (`:17052-17068`). That is correct at `shameCount <= 6`, where `+1` is a price
   worth paying to survive. At `7` it is the one press that cannot heal and buys
   the 30 s lock. The engine gates its own presses and never sends that one.

Neither defect is repaired in place — the engine simply does not depend on
either — so turning the engine off restores today's behaviour exactly.

---

## Architecture

Twelve modules, one per responsibility, wired as a straight pipeline that runs
once per server tick inside `postTick()`.

```
                       ┌──────────────────────────────────────────┐
   RYN client ────────►│ 12. HostAdapter   (integration layer)    │
   (read only)         └───────────────┬──────────────────────────┘
                                       │ snapshot
                                       ▼
   ┌───────────────┐   ┌───────────────────────────┐   ┌────────────────────┐
   │ 1. StateTracker├──►│ 2. DamageAnalyzer         ├──►│ 3. ShameController │
   └───────┬───────┘   └───────────────────────────┘   └─────────┬──────────┘
           │                                                     │
           │           ┌───────────────────────────┐             │
           └──────────►│ 4. ThreatDetector         ├─────────────┤
                       └───────────┬───────────────┘             │
                                   ▼                             ▼
                       ┌───────────────────────────┐   ┌────────────────────┐
                       │ 5. PredictionEngine       ├──►│ 6. HealDecision    │
                       └───────────────────────────┘   └─────────┬──────────┘
                                                                 │ plan
                       ┌───────────────────────────┐             ▼
                       │ 7. PriorityArbiter        │◄────────────┘
                       └───────────┬───────────────┘
                                   ▼
                       ┌───────────────────────────┐
                       │ 8. ActionValidator        │
                       └───────────┬───────────────┘
                                   ▼
                       ┌───────────────────────────┐
                       │ 9. CooldownManager        │
                       └───────────┬───────────────┘
                                   ▼
                       ┌───────────────────────────┐
                       │ 10. AntiSpamManager       │
                       └───────────┬───────────────┘
                                   ▼
                       ┌───────────────────────────┐
                       │ 11. HealExecutor          ├──► z / F / z
                       └───────────────────────────┘
```

### 1. StateTracker

Owns the self-model and the **hit latch**. The latch is the engine's mirror of
the server's `hitTime`: it records *when* and *on which tick* health was seen to
fall, and is cleared only when a food press is sent (by this engine or by any
other module, observed via `ModuleHandler.healedOnce`) — never on a health
*rise*, because regen and healing pads raise health without clearing `hitTime`
on the server. Erring toward "a hit is still pending" errs toward waiting, which
is the safe direction.

It also detects **damage hidden under a heal**. Forty of cookie and twenty of
katana on the same tick read as "+20, nothing hit me", while the server has
stamped `hitTime` and the next press would be charged. The in-flight ledger makes
it visible: a press sent earlier is worth a known amount of health now, so health
short of `previous + what landed` is damage whatever the net sign says. Without
this the count walks quietly to 8 under exactly the pressure that most needs it
not to.

Also keeps: health ring buffer, per-tick delta, tick wall-clock, spawn/death
edges, cheese DoT expiry, in-flight press ledger handle.

### 2. DamageAnalyzer

Classifies what just happened: burst size this tick, sustained rate over the
last 9 ticks (one DoT period), whether the drop was a damage-over-time tick
(`isDmgOverTime`, 2/4/5-point drops) or a real hit, and the **DoT phase** — the
tick index of the next poison/bull tick from `isBullTickTime`. Publishes
`msUntilNextDotTick`, which is what lets the engine put a heal *before* a
self-inflicted hit instead of into the 120 ms shadow behind it.

### 3. ShameController — the shame control engine

The safety authority, and the only part of the engine with an objective of its
own: hold `SHAME <= 7` as an invariant, drive toward `0` as a goal. It is three
parts behind one facade.

#### 3a. ShameTracker — what the count is doing

| Tracked | From |
|---|---|
| current, previous, delta | the count, tick over tick |
| increase rate, decrease rate | `+1` and `-2` events over a 45-tick (5 s) window, per second |
| zone, previous zone, ticks in zone | `SAFE` 0 · `WARNING` 1-6 · `CRITICAL` ≥ 7 |
| recent damage, damage frequency | DamageAnalyzer's window sums — hits/s is what the forecast multiplies |
| healing state | `idle` · `pressing` · `awaiting` (pressed, result unseen) · `backoff` · `locked` |
| cooldown state | `free` · `holding` (waiting for the window) · `backoff` |
| peak | the high-water mark for the life |

#### 3b. ShamePredictor — where it is heading

Waiting for the count to actually be high means waiting until the only moves
left are the expensive ones, so the forecast runs every tick over a one-second
horizon:

```
expectedEvents  = damageFrequency × horizonSeconds + (a DoT tick in the horizon)
forcedShare     = 1     when projected health is already at or under the threat
                = 0.75  when it is within one food of it
                = 0.35  when within two
                = 0     otherwise            → the wait for credit is affordable
expectedCharges = expectedEvents × forcedShare × confidence
expectedCredits = min(unforced events, count / 2) × 2
projectedShame  = clamp(count + charges − credits, 0, 7)
ticksToCritical = (7 − count) ÷ chargesPerTick
```

`confidence` is the part that keeps the forecast honest. ThreatDetector weights
each damage source by how much of it is going to happen rather than could:

| Source | Weight | Why |
|---|---|---|
| DoT tick due | 1.0 | arithmetic on a fixed period |
| projectile in flight | 0.85 | already fired |
| spike being touched | 0.9 | contact damage, deterministic |
| spike predicted (`willCollide`) | 0.5 | a prediction about movement |
| melee, insta threat | 0.8 | committed sequence |
| melee, reloaded primary in range | 0.6 | a player who may not swing |
| melee, otherwise | 0.4 | proximity, little more |

Weighted by damage, so confidence follows whichever source dominates the number.
Below `CONFIDENCE_LOW` (0.4) the forecast is a rumour and the engine will not
spend food on it — the "do not waste healing resources" rule, as a gate rather
than an intention.

#### 3c. ShameOpportunity — the earliest valid way down

Credit does not accumulate: it is a single `-2` attached to one pending hit, and
the first press after that hit either takes it or spends it the wrong way. So
reduction is always a question of *when*, with exactly three answers:

| Mode | Condition | ETA |
|---|---|---|
| `credit-now` | a hit is pending and the window has passed | this tick |
| `credit-wait` | a hit is pending, still inside the window | next tick |
| `bull` | nothing pending, field quiet, hat free | next DoT tick |

`bull` is the manufactured hit: Bull Helmet's `healthRegen: -5` stamps `hitTime`
on the next one-second tick, and a press after it is a `-2` that heals the 5
back. It is gated on a genuinely quiet field — Bull carries no damage reduction,
so arming it in front of anything that can hit back trades health for a point a
natural credit would have given free.

#### What the zones actually change

| Zone | Behaviour |
|---|---|
| `SAFE` (0) | Nothing is owed, so nothing is spent chasing it: top-ups fall back to the food-economy rule (`gap >= restore`) and no wash is attempted. This is "avoid unnecessary healing", stated as a rule. |
| `WARNING` (1-6) | Every credit opportunity is taken at the earliest valid moment. A top-up on a credit tick is worth more than the food it wastes — it heals *and* takes two off — so the economy rule is relaxed while a debt is owed. |
| approaching 7 (≥ 5, or the forecast says so) | Defensive priority rises: the sustain floor gains half the reserve, so health is bought while presses are still free. Charged presses are held for the window unless the projection says the wait is fatal. |
| `CRITICAL` (7) | Critical mode. No charged press may leave, at all — it cannot heal and it arms 30 s of not healing. The floor gains the full reserve, the hold for the window becomes unbounded, and the only way out is a credit press. |

#### Facade

- `count`, `zone`, `safe` / `warning` / `critical`, `approachingCritical`
- `verdict()` → `CHARGED` | `CREDIT` | `FREE`, on the tick grid
- `chargeSafeCount()` — `max(own count, client mirror)`; the two disagree in both
  directions and the cost is not symmetric, so a charged press is gated on the
  higher of them
- `chargeBudget()`, `canSpendCharge()`
- `planWash()`, `opportunity.mode`
- `revalidate()` — see below

#### Validation: never press on a stale count

`revalidate()` runs as the last thing before the wire, on every press. It
re-reads the live count, the live lock and the live hit stamp straight off
`myPlayer`, re-derives the verdict from them, and recalculates the plan against
what came back:

- lock now on → drop the press;
- verdict now `CHARGED` and the live count is at 7 → drop it, and say so
  (`+stale:lockguard`);
- the count moved up and this was not an emergency → drop it and let the next
  tick plan against the number that actually holds (`+stale:count-moved`);
- health already full → drop it unless it is a wash;
- otherwise the press count is trimmed to what live health still needs and the
  press goes out under its *corrected* verdict, so the accounting stays right.

The client is single-threaded, so inside one `postTick` the window this closes
is small — another client sharing the ModuleHandler, a hook, a future reordering
that puts work between the plan and the press. What it costs when it is wrong is
the one press that arms the lock without healing, which is the whole objective,
so it is checked rather than assumed. The simulator plants a count that moves
between the snapshot and the press: **20 re-reads catch it, 0 presses go out,
0 locks are armed.**

#### Where the count itself comes from

`count` is the controller's own, not the client's. RYN's mirror
(`Player.updateHealth`) only moves on an observed health *rise*, so it is blind
to a press that healed nothing — which is exactly the press the wash path uses
at full health. So the mirror's deltas drive the count for every press that
healed, and the controller's own deferred adjustments cover the ones the mirror
cannot see: pushed on the press, dropped if the mirror moves within two ticks,
applied if it does not. Either way the count moves once.

`chargeBudget()` is `SHAME_MAX - chargeSafeCount()`. **At 7 it is 0 and a
charged press is forbidden unconditionally**, because it cannot heal (fact 4).

One more consequence of fact 1 shapes every burst: **a charge is paid once per
damage event, however many presses follow it.** The first press clears
`hitTime`; the rest are free. So a burst that has decided to pay `+1` fills the
bar to the top rather than to the floor — same shame, four times the health.

Objective encoding: `SHAME <= 7` is a hard invariant (never send the press that
reaches 8); `SHAME = 0` is the target the wash path drives toward whenever the
tick is otherwise idle.

### 4. ThreatEngine — one engine, eleven detectors

**The damage number is still Combat's.** The engine never re-derives what the
client already knows: `EnemyManager.potentialDamage`, `potentialSpikeDamage`,
`potentialSpikeKnockbackDamage` and `ProjectileManager.totalDamage`, plus the
self-inflicted DoT term, capped at 140, then the game's own modifiers (`×0.75`
Soldier, `+5` Bull). What the detectors add is the *shape* of the threat rather
than its size: which kind, how sure, how much, and how soon.

Every detector is built on one rule: **evidence, not possession.** An enemy
carrying a musket is not a musket threat.

| # | Detector | Fires on | Never fires on |
|---|---|---|---|
| 1 | `instakill` | damage ≥ health backed by something deterministic — a projectile in flight, spike contact, or a committed sequence the client already recognised (`reverseInsta`, `toolHammerInsta`, `rangedBowInsta`, `danger >= 3`) | a big number with nothing behind it |
| 2 | `spike-tick` | damage landing on ticks where a spike is actually being touched, tracked as **one sequence** with hit count, mean interval and predicted next contact | a spike standing nearby |
| 3 | `insta-rev` | secondary and turret held at empty reload with a loaded primary — the client's own `canPossiblyInstakill` shape — plus reach and facing | owning two weapons |
| 4 | `musket` | a type-5 projectile in the air on a line to me (the client's own facing test), or a musket **loaded, facing me, and inside half its reach or freshly switched to** | holding a musket |
| 5 | `bow` | the same, for arrow projectiles 0/2/3 and the bow / crossbow / repeater | holding a bow |
| 6 | `spam-dagger` | repeated damage while a dagger is in its own reach — the frequency is the threat, since daggers swing under one tick for 20 | a dagger on the field |
| 7 | `velocity-tick` | a polearm or turret gear inside the 150–270 knockback band with a turret that can reach me, loaded and closing | a polearm anywhere |
| 8 | `spike` | the collision state itself: touching, about to touch, or being pushed onto one | proximity |
| 9 | `trap` | pinned in an enemy trap, weighted by whether anyone can reach me and whether I can break out | standing next to a trap |
| 10 | `burst` | one tick's damage ≥ 15 % of max health, including damage hidden under a heal | ordinary chip |
| 11 | `sustained` | ≥ 2 damage events in a 27-tick window, reported as dps and ticks-to-empty | one hit |

Every report is `{type, confidence, severity, timing, evidence[]}`:

- **confidence** — `NONE` · `LOW` · `MEDIUM` · `HIGH` · `CRITICAL`. Earned by
  what is observable, not by how bad it would be if true. An unfired ranged
  weapon can never exceed `MEDIUM`; `CRITICAL` needs something already in
  motion.
- **severity** — estimated damage, in health.
- **timing** — estimated ticks to impact. `0` is now.
- **evidence** — the specific facts that produced the verdict, for the log.

**Timing is not decoration.** `PredictionEngine.survivesHold` asks the engine
`imminentWithin(ticks)` before deciding whether a tick of patience is
affordable: any credible report landing inside the window returns the whole
number, and so does having no detector view at all — the relaxation only applies
when every credible threat is demonstrably further out than the wait. That is
what lets the engine take the `-2` instead of paying `+1` on an exchange whose
next hit is three ticks away, and it is why the every-tick beatdown scenario
now finishes at full health rather than 95.

Only one detector may add damage the baseline has not counted: `spike-tick`,
and only for the next contact of a sequence we are *not* currently touching —
`potentialSpikeDamage` already carries the one we are.

Detectors never touch the client. Everything they read is gathered once per
tick by the HostAdapter (`enemyList`, `incomingProjectiles`, `spikeContext`,
`trapContext`, `turretContext`), and a weapon id is only ever reported alongside
the reload, range and facing that say whether it can be used on me right now.

### 5. PredictiveDefenseEngine

Two jobs. The first is the health projection everything else spends against:

```
projected = health + inFlightHeals - (a DoT tick due this tick)
afterHold(ms) = projected + regenPerSecond × ms/1000 - (a DoT tick inside the wait)
survivesHold(ms) = afterHold(ms) - threat.imminentWithin(ticks) > 0
```

The second is acting before the bar moves. Reacting to health is reacting late:
by the time the number changed the hit landed and the shame window is already
open. So the forecast looks at the tick *before* that.

#### Motion is RYN's, borrowed not rebuilt

The placement engine already carries `TargetMotion`: a five-sample history per
entity turned into velocity, acceleration, heading, heading shift, a stability
score, `predict(ticks) → {x, y, confidence}` with a horizon decay, and
`intercept()` for the earliest tick a path enters a circle. Writing a second one
would be writing that twice.

So the engine borrows the **class** and constructs a private instance from it.
The instance matters: sharing the placement engine's tracks would mean observing
entities on its behalf, on our tick basis, into state its planner reads. Same
code, separate tracks, no interference. Where the placement engine is absent, the
fallback is not a second predictor either — it is the linear extrapolation every
`Entity` already carries (`pos.previous → pos.current`, `speed`, `move_dir`),
read one tick at a time and with a confidence that decays accordingly.

#### What it predicts

Four sources, each with its own confidence, none of them assumed:

| Source | Evidence | Confidence |
|---|---|---|
| projectile | already in the air, on a line the client tested | 0.85 |
| closing | `intercept()` says this course enters weapon reach within the horizon | the tracker's own, × armed, × facing |
| in-reach | already able to swing | 0.6 facing, 0.4 not |
| DoT tick | a fixed period | 1.0 |
| spike sequence | the threat engine's tracked sequence | the sequence's own |

and publishes `{incomingDamage, timing, expectedHealth, expectedShameDelta,
threatDuration, confidence, level, sources[]}`. `expectedShameDelta` is the shame
engine's arithmetic asked rather than repeated: a hit stamps `hitTime`, and what
it costs depends on whether the first press after it lands on that tick (`+1`) or
the next one (`-2`), with the ceiling case (no `+1` available at 7) folded in.

Horizons are deliberately short — 6 ticks to forecast, 3 to act on. Past about
two thirds of a second a moomoo fight has changed shape, and a prediction that
far out is a guess wearing a number.

#### What it is allowed to spend

`PREEMPT` sits between `WASH` and `SUSTAIN`, and it is fenced by three rules:

1. **A prediction never pays a shame charge.** A charged press is for damage
   that already landed; this damage has not. If the window is not free, the
   answer is to wait for it — the hit is not here yet, so waiting costs nothing.
2. **HIGH acts, MEDIUM acts on consequence, LOW never acts.** MEDIUM is "use
   cautiously", which is about the consequence rather than the efficiency of the
   press: half a wasted cookie is a fine trade against a hit that would take the
   bar under half, and a bad one against a graze.
3. **The comparison is against the floor at impact, not the floor now.** Right
   now the field is quiet — that is the point of being early. What matters is
   whether the health left after the hit clears the buffer the situation will
   need once the thing that is closing has arrived.

Most pre-healing is still `TOPUP`'s: a quiet tick with a gap worth filling is
already handled, and that *is* predictive defense in effect. `PREEMPT` covers the
case `TOPUP`'s food-economy rule declines — under chip damage, with a small gap,
in a free window, with something credible about to land.

#### Invalidation

A cached forecast is thrown away the moment the world that produced it changes,
and every reason is named rather than timed:

`target-changed` · `enemy-turned` (heading shift past 45°) · `enemy-stopped`
(**edge-triggered** — someone *becoming* stationary, not their continuing to
stand there) · `projectile-changed` · `collision-changed` · `player-moved`
(60 px) · `threat-gone` · `world-changed` (the fingerprint) · `aged-out` (9 ticks)

#### Performance

- The enemy and projectile reads are the threat engine's, published once per
  tick and shared — not gathered twice.
- Tracking is capped: enemies within 700 px, nearest four.
- One `observe()` per tracked enemy per tick; `TargetMotion.observe` is
  idempotent within a tick, so it cannot double-sample.
- The forecast is rebuilt only when an invalidation fires or the fingerprint
  changes. On a still field the simulator measures **35 of 40 ticks served from
  cache**; when a tracked enemy stops, the edge trigger fires once rather than
  every tick it stands there.

### 6. HealDecisionEngine — a price, not a threshold

`IF HP < X THEN HEAL` cannot answer the question this engine faces, because the
same 40 health is worth wildly different amounts depending on what it costs. At
shame 0 with a full larder a press is nearly free. At shame 6 the same press
spends the last charge standing between you and a thirty-second lock. A ladder
of thresholds cannot express that difference. A price can.

So every candidate is priced twice, in health-equivalent points: once for
pressing **now**, once for pressing on the **next tick** instead. The larger
number wins, and the reason it won is the reason reported.

#### What things cost

Every price is anchored to something the game does, not to a tuning knob:

| Term | Price | Why |
|---|---|---|
| health gained | `min(presses × restore, max − health)` | overheal is thrown away (`game_index.js:2418`) |
| a life | `3 × maxHealth` | death costs the bar *and* the run that produced it |
| food | 0 while ≥ 8 presses are in reserve, rising steeply below | what food really costs is the heal you cannot make later |
| packets | 0 until the budget is tight, then a life | at the limit, three frames cost somebody else their tick |
| a shame charge | `lifeValue / (7 − count)²` | the option it consumes: one of seven at count 0, the last one at count 6 |
| a shame credit | `penalty(count) − penalty(count − 2)` | the options it hands back |

The charge price is convex on purpose: at count 0 it is ~6 points and a top-up
outbids it easily; at count 5 it is 75 and only real danger does; at count 6 it
is 300 — a whole life — and essentially nothing does. The zone behaviour the
objective asks for is that curve, not a set of `if`s.

At the ceiling the price is a large **finite** number rather than `Infinity`.
Infinity is the honest value and a terrible one: it meets a zero probability in
the wait branch, produces `NaN`, and a `NaN` loses every comparison it is in —
a decision engine that stops deciding. The forbidden press is a *constraint*
enforced before any pricing, so the price only has to dominate.

#### Now versus next tick

Waiting is not "don't heal" — the heal is still there next tick. What differs
is the shame arithmetic and the risk:

```
V(now)  = gain + credit + survivalAvoided − food − packets − charge
V(wait) = gain' + credit' + chargeAvoided
        − food − packets − deathRisk − creditRisk − forecastCharge
```

- a **charged** press becomes a credit press one tick later, but only if no new
  damage restamps `hitTime` first — the measured hit frequency prices that, so
  under damage every tick the conversion goes to zero on its own;
- a press that is already a **credit** has the opposite exposure: waiting risks
  *losing* it. That term is what stops the model sitting on a credit forever
  congratulating itself — pressing banks it, waiting only might;
- waiting also carries **the shame the forecast says it will cost**. The
  predictive engine has already worked out what the coming hit does to the
  count: if it lands on a bar too low to ignore, the press that answers it is
  the first after a fresh stamp — a charge. Buying the buffer now, while the
  window is free, is what stops that charge from ever being needed, so its
  price sits on this side, weighted by how much the forecast is believed;
- **player state changes the odds, not the damage.** Pinned in a pit trap there
  is nowhere to be instead, so waiting stops being a bet on whether the swing
  lands: `pHit` floors at 0.9 while `isTrapped`.

The old heuristics fall out of this rather than being coded: a prediction still
never pays a charge, because for a non-survival candidate `V(wait)` keeps the
same health gain and adds the avoided charge, so waiting simply prices higher.

#### Survival is not a term

One rule sits outside the arithmetic: if waiting kills us, the shame numbers do
not get a vote.

```js
const waitIsFatal = rank.survival && !predict.survivesHold(...);
if (waitIsFatal) → HEAL_NOW  "survival: waiting loses 300 to save 75 of shame"
```

That is "never sacrifice survival merely to keep shame at 0", written as code
rather than hoped for. The simulator holds it to it: starting at shame 6 under
55 damage every three ticks, the engine spends charges, reaches the ceiling,
and never crosses it — **0 deaths, 0 locks**.

#### Five decisions, each with its reason

| Decision | Means | Example reason |
|---|---|---|
| `HEAL_NOW` | pressing now prices higher | `sustain: now 236 > wait 75` |
| `WAIT` | pressing later prices higher | `topup: credit worth 128 beats pressing at -45` |
| `PREPARE` | no press, but set one up | `prepare: bull hat to manufacture a hit to wash` |
| `CANCEL` | dropped: outranked, illegal, or refused | `yield:module:spikeSync` |
| `RECALCULATE` | the world moved between plan and press | `sustain: now 161 > wait 60+stale:lockguard` |

### 7. PriorityArbiter — one authority

Two jobs, both centralised so nothing else decides what matters more than what.

**What dominates this tick.** Urgency is computed, not declared:

```
urgency = severity × confidence × 1/(1 + timing) × (severity >= health ? 3 : 1)
```

The order the objective describes — survival, catastrophic, high-confidence
burst, rapid, spike, ranged, dagger, ordinary, shame — is what that expression
produces, and `verify-autoheal.js` asserts it by feeding the function
representative cases and checking the ranking rather than trusting the text. A
musket ball three ticks out and a dagger already landing are ordered by what
they will do, not by which list they are on.

One units rule makes it work: the sustained detector reports a **rate**, and a
rate is converted to its one-tick equivalent before being ranked against
amounts — and is never called lethal. 95 damage a second is ordinary pressure;
95 damage in one hit is a death. Without the distinction every busy fight reads
as a survival emergency, which is exactly the bug the simulator caught.

**Whether this engine may act.** That comparison runs on RYN's own scale — the
placement engine's `RPE_PRIORITY` classes, read through its own `priorityFor` —
so healing and placing are ranked by one authority instead of two:

| Situation | Class |
|---|---|
| lethal burst | `INSTA` (90) — outranks a sync, correctly |
| a HIGH-confidence detector | `DEFENSE` (70) |
| a forecast that has not landed | `ANTICIPATION` (50) |
| wash, top-up | `UTILITY` (20) |

A tie yields to the incumbent: they claimed the tick first. Anti Smart Tick is
yielded to unconditionally whatever the class, because it eats on that same
tick and a second opinion is just double food. Packet reserves for the
placement systems and the mills are held back from everything except survival.

### 8. ActionValidator

Refuses anything the *server* would refuse or punish: not in game, no food item,
not enough food for `canBuild`, `noEat` hat, Shame hat, active lock, no packets
left, or a non-wash press at full health.

### 9. CooldownManager

Per-tick pacing and the deferral clock. It owns how long a hold may last, and
the decision consults it before choosing to wait: **one tick by default**,
because under damage every tick the window never opens — the hit stamp is
refreshed faster than 120 ms elapses — and a guard that waits for it forever is
a guard that stops you eating at all. The single exception is `count === 7` with
a charged press queued, where the hold is unbounded: that press cannot heal, so
waiting gives up nothing.

After the arbiter and validator have had their say it records the hold the plan
actually settled on, so a plan they cancelled never starts the clock.

### 10. AntiSpamManager

The in-flight ledger and the escape hatch. Presses already sent count against
what is still needed, so a four-press gap does not become twelve presses over
three ticks. If several ticks of presses produce no health rise, it backs off
exponentially instead of re-asking forever — the failure mode the target client
calls "the Q that never lets go".

The ledger's window scales with latency: a press is visible in the health this
client reads one tick later plus half a round trip each way. At a normal ping
that is one tick; at 250 ms it is three, and a ledger fixed at one tick spends
the difference pressing again into food it has already eaten. In the simulator
that single term is the difference between 48 presses with 19 refused and 29
presses with none.

### 11. HealExecutor

Sends `selectItem(2)` → `attack(null, 1)` → `whichWeapon(predicted)` per press,
through `ModuleHandler`'s own methods so `currentHolding`, the sent-angle
priority and the packet counter stay consistent. It deliberately does *not* call
`ModuleHandler.heal()`, whose gate would both hold an emergency press for a tick
and permit the forbidden press at `count === 7`.

### 12. HostAdapter (integration layer)

The only file region that touches the client. Every read is null-guarded so a
future RYN change degrades the engine to "no opinion" instead of throwing inside
the module loop.

---

## Data flow, one tick

```
postTick()
  ├─ adapter.snapshot()             read client, no writes
  ├─ state.update(snap, ledger)     health delta, hit latch, hidden damage
  ├─ ledger.update(snap, state)     expire in-flight presses
  ├─ damage.update(snap, state)     burst, rate, DoT phase
  ├─ shame.update(snap, state, ...) count, verdict, credit clock, zone, rates
  ├─ threat.evaluate(snap, damage)  raw → effective → lethal, confidence
  ├─ predict.build(...)             projection, survivesHold, healsNeeded
  ├─ predict.predictAhead(...)      forecast, or the cached one if nothing moved
  ├─ shame.project(...)             shame forecast + earliest way down
  ├─ ledger.noteOutcome(...)        did the last press land? back off if not
  ├─ decide.plan(..., arbiter)      rank -> candidate -> price now vs wait
  │    └─ arbiter.classify / mayAct / affordable   (centralised, RPE scale)
  ├─ validator.check(plan, snap)    legality
  ├─ cooldown.pace(plan, snap)      record the hold the plan settled on
  └─ executor.run(plan)             re-read the live count, recalculate,
                                    then press; ledger + count updated
```

## State model

```
self     health, maxHealth(100), foodId, restore, foodStock, hatId, accId,
         alive, inGame, sandbox
timing   tick, tickAt, TICK(111), pong, msSinceTick
shame    count, previous, delta, zone, ticksInZone, increaseRate, decreaseRate,
         locked, hitAt, hitTick, pending, verdict, msUntilCredit, chargeBudget,
         healingState, cooldownState, peak
forecast confidence, expectedEvents, expectedCharges, expectedCredits,
         projectedShame, ticksToCritical, willReachCritical
chance   mode (credit-now | credit-wait | bull | none), etaTicks, reason
predict  incomingDamage, timing, expectedHealth, expectedShameDelta,
         threatDuration, confidence, level, sources[], invalidatedBy,
         cacheHits / cacheMisses, motion source
damage   lastDelta, burst, hiddenDamage, rate9, damageFrequency,
         dotActive, dotPerSec, msUntilDotTick
threat   melee, secondary, turret, projectile, spike, spikeKB, dot,
         raw, effective, confidence, lethal, instaThreat, spikeContact,
         reports[], byType{}, top, escalation, soonest
heal     inFlight[], sentThisTick, backoffUntil, lastLandedTick
plan     decision (HEAL_NOW | WAIT | PREPARE | CANCEL | RECALCULATE),
         urgency, presses, holdMs, reason, rank {label, cls, urgency},
         values {now, wait}
```

## Priority model

The urgency classes below are the *shape* of a plan. Which one fires is decided
by the arbiter's computed urgency and the value comparison in module 6 — the
table is what the engine reports, not a ladder it walks.

| # | Class | Fires when | Shame policy |
|---|---|---|---|
| 0 | `BLOCKED` | validator refuses | no press |
| 1 | `IDLE` | full health, no debt | no press |
| 2 | `TOPUP` | health below max, tick is quiet | uncharged only; economy rule at `SAFE`, relaxed while a debt is owed or a *believable* threat exists |
| 3 | `WASH` | `count > 0` and the opportunity finder has a way down | credit only — this is the `-2`; `credit-wait` holds a tick for it |
| 4 | `PREEMPT` | a credible hit lands within 3 ticks and would leave us under the floor it will need | never charged — a prediction does not pay `+1` |
| 5 | `SUSTAIN` | health below `effectiveThreat + reserve + zone bias` | hold ≤ 1 tick for the window, then press if budget ≥ 2 |
| 6 | `CRITICAL` | `projected <= effectiveThreat`, death inside 1 tick | press now; spend `+1` if `budget >= 1` |
| 7 | `LOCKGUARD` | `count === 7` and verdict is `CHARGED` | **never press** — wait for the window |

`LOCKGUARD` outranks `CRITICAL` by construction, and that is not a survival
compromise: at `count === 7` the charged press is refused by `consume` anyway
(fact 4), so waiting costs nothing that pressing would have gained.

The zone bias in `SUSTAIN` is where "increase defensive priority as the count
approaches 7" lives: half the reserve at ≥ 5 or when the forecast says the
count is heading there, the full reserve at 7. Health bought at 5 is bought
with presses that are still affordable; the same health at 7 is not buyable.

## Threat model

```
raw   = EnemyManager.potentialDamage            (melee in range and off reload,
                                                 secondary, turret)
      + max(potentialSpikeDamage,
            potentialSpikeKnockbackDamage)      (spike contact / knock-onto)
      + ProjectileManager.totalDamage           (arrows, bullets in flight)
      + dotPerSecond if a DoT tick lands inside the horizon
raw   = min(raw, 140)
eff   = raw * (soldierOn ? 0.75 : 1) + (bullOn ? 5 : 0)
lethal = projectedHealth <= eff
```

Escalation flags read straight from Combat: `instaThreat()`,
`detectedDangerEnemy`, `dangerWithoutSoldier`, `collidingSpike`,
`willCollideSpike`.

## Integration points — read only

| System | Read | Used for |
|---|---|---|
| Combat | `EnemyManager.*`, `ProjectileManager.totalDamage`, `ModuleHandler.attacking / shouldAttack / moduleActive` | threat, and yielding a committed combat tick |
| Auto Place / Preplace / Replace | `staticModules.placementEngine`, `ModuleHandler.placedOnce / totalPlaces`, `Settings._autoplacer / _prePlace / _replace` | packet reserve, no interleaving |
| Spike Tick | `staticModules.spikeSync / spikeTrap / trapTick` | defer non-critical heals on a committed spike tick |
| Safe Soldier | `ModuleHandler.shouldEquipSoldier`, `forceHat === 6`, `Settings._safeSoldier` | `×0.75` in the threat model; never contest the hat |
| Anti Smart Tick | `staticModules.antiInsta.blockBreak`, `Settings._antiSmartTick` | it eats on that tick already — stand down |
| Auto Mills | `staticModules.autoMill.isActive` | packet reserve |
| Velocity Tick | `staticModules.velocityTick.nearestTarget / target` | it owns Bull for the combo — no wash, defer non-critical |

Nothing in that column is written to. The only writes the engine makes are its
own presses, `ModuleHandler.moduleActive` / `healedOnce` (the tick-claim
protocol every module uses), and `setForceHat(7)` for a bull wash — which is a
no-op if any other module already claimed a hat.

## Ownership handoff

Two one-line guards keep the old and new paths from double-pressing:

- `AntiInsta.postTick` — the legacy heal rule stands down while the engine owns
  healing. Its Anti Smart Tick branch is untouched and still runs.
- `ShameReset.postTick` — stands down; the engine's wash path covers it.

Both gate on `Settings._autoHealEngine` — the same answer the engine's own
`owns()` returns — so turning the toggle off hands healing straight back to the
shipped code, unchanged.

## Files and functions

| File | Contains |
|---|---|
| `src/autoheal/ryn-autoheal-engine.js` | `createRynAutoHealEngine(deps)` → `AutoHealEngine`; the twelve classes above; the `AH` constants |
| `tools/build-autoheal.js` | anchored injection into `src/RYN_Client_v5.4.user.js` → `RYN_AutoHeal.user.js`: engine source, module registration, settings keys, menu entries, the two ownership guards |
| `tools/sim-autoheal.js` | the game's own rules transcribed as a server model, plus eleven scenarios the engine is run through |
| `tools/verify-autoheal.js` | re-derives every constant from `src/game_index.js` and `drivers/game-drivers.json`, checks the wiring in the built script, and re-runs the whole simulation suite against the engine copy pulled back out of it |
| `src/RYN_Client_v5.4.user.js` | the base client, untouched |

Build: `node tools/build-autoheal.js` · Verify: `node tools/verify-autoheal.js`
· Simulate: `node tools/sim-autoheal.js` (`SIM_TRACE=1` for a per-tick trace)

### Settings

| Key | Default | Does |
|---|---|---|
| `_autoHealEngine` | on | Engine owns healing; the shipped heal rule and ShameReset stand down |
| `_autoHealWash` | on | Allow shame washing, including the Bull-tick route on a quiet field |
| `_autoHealStrict` | on | Hold for the window whenever the count is above 0; off spends charges down to a 2-point reserve |
| `_autoHealReserve` | 15 | Health kept above predicted incoming damage before SUSTAIN stops asking |

`_autoHealEngine` defaults **on** because the rule it takes over from cannot
fire at all: it gates on `tempHealth < maxHealth`, and `Player.maxHealth` is
`Math.LN1`. Turning the engine off restores that path exactly as shipped.

### What the simulator reports

Against the transcribed server rules, over twenty-three scenarios — the healing and
shame set (sustained melee, every-other-tick pressure, an insta burst, poison,
a 5-, 6- and 7-count debt, 250 ms ping, no food, an active lock, cheese, a
low-confidence threat, a count that moves between the plan and the press, an
unsurvivable every-tick beatdown), the threat set (possession only, a musket
ball in flight, dagger pressure, a spike-tick sequence, a trap pin) and the
prediction set (an enemy closing on a straight line, one that turns away, a
still field) and the decision set (survival at shame 6):

- no scenario arms the 30 s lock, and none sends a press while one is on;
- the count never exceeds 7, and every scenario that starts in debt ends at 0;
- eight of the thirteen hold shame at **0 for 100 % of ticks**, including the
  90 dps pressure run and the 250 ms ping run;
- the low-confidence run — an enemy in range with a reloaded weapon who never
  swings, for 90 ticks — spends **one press and 15 food**;
- the moving-count run catches the stale read **20 times, sends 0 presses and
  arms 0 locks**: it would rather die than send the press the live count says
  arms the lock, which is the correct trade, since the lock is 30 s of
  guaranteed death anyway;
- **a field of four armed enemies — musket, bow, daggers, polearm — all loaded
  and facing, none of whom do anything, produces no threat report at all and no
  presses**, which is the possession rule holding under the exact case it
  exists for;
- a musket ball in the air is `HIGH`, dagger pressure reaches `CRITICAL` on hit
  frequency, a spike sequence is reported as one sequence rather than five
  hits, and a trap pin with an attacker in reach is `CRITICAL`;
- the closing enemy is healed against **before contact**, using RYN's own
  motion tracker (the run reports `motion ryn-target-motion`, so the borrow
  path is the one under test);
- when that enemy turns away the prediction is dropped on `enemy-turned` and
  the whole approach costs **one press**;
- a still field serves **35 of 40 ticks from cache**, rebuilding only on the
  9-tick age-out;
- **survival is never traded for a clean count**: starting at shame 6 under
  55 damage every three ticks, the engine spends charges, reaches the ceiling
  and never crosses it — 0 deaths, 0 locks;
- every decision in every scenario carries a reason, and all five decision
  types appear in real runs (`WAIT 105  HEAL_NOW 14  PREPARE 1` on a quiet
  debt; `RECALCULATE 20` when the count is planted to move under the plan);
- the every-tick beatdown is the one shape the shame rule makes unsurvivable —
  the hit stamp is refreshed faster than the window closes, so all seven charges
  go and the eighth press is refused rather than sent. Dying at 7 without a lock
  is the correct outcome there, and it is what the engine does.
