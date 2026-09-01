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

### 3. ShameController

The safety authority. Holds:

- `count` — its own count, moved by the mirror's deltas for presses that healed
  and by its own deferred adjustments for the presses the mirror cannot see.
  (RYN's mirror only updates on an observed health *rise*, so it is blind to a
  press at full health — which is exactly the press the wash path uses.)
- `locked` — `shameActive` or hat 45.
- `verdict()` → `CHARGED` | `CREDIT` | `FREE`, on the tick grid above; `FREE`
  when no hit is pending.
- `msUntilCredit()` — the remainder of this tick.
- `chargeSafeCount()` — `max(own count, client mirror)`, used only to gate a
  charged press. The two can disagree in both directions and the cost is not
  symmetric: one too low is the press that arms the lock; one too high only
  postpones a heal.
- `chargeBudget()` — `SHAME_MAX - chargeSafeCount()`, i.e. how many `+1` presses
  remain before the count would reach 8. **At 7 the budget is 0 and a charged
  press is forbidden unconditionally**, because it cannot heal (fact 4 above).
- `planWash()` — how to bank `-2`: `natural` when a hit is already pending and
  the window has passed, or `bull` when there is no pending hit and Bull Helmet
  is available to manufacture one on the next 1 s tick. The bull route is taken
  only on a genuinely quiet tick — it is `-5` a second with no damage reduction,
  so arming it in front of anything that can hit back trades health for a point
  a natural wash would have given free a tick later.

One more consequence of fact 1 shapes every burst: **a charge is paid once per
damage event, however many presses follow it.** The first press clears
`hitTime`; the rest are free. So a burst that has decided to pay `+1` fills the
bar to the top rather than to the floor — same shame, four times the health.

Objective encoding: `SHAME <= 7` is a hard invariant (never send the press that
reaches 8); `SHAME = 0` is the target the wash path drives toward whenever the
tick is otherwise idle.

### 4. ThreatDetector

Never re-derives what Combat already knows. It sums RYN's own numbers —
`EnemyManager.potentialDamage`, `potentialSpikeDamage`,
`potentialSpikeKnockbackDamage`, `ProjectileManager.totalDamage` — adds the
self-inflicted DoT term (poison / Bull `-5`), caps at 140 like the game's own
worst case, then applies the *game's* modifiers: `×0.75` when Soldier Helmet is
on or is being equipped this tick by Safe Soldier, `+5` when Bull is on.
Publishes `{raw, effective, lethal, instaThreat, spikeContact, sources[]}`.

### 5. PredictionEngine

Projects health forward:

```
projected(k) = health
             + inFlightHeals                      (presses sent, not yet seen)
             + regenPerSecond  * k/9              (hats, tails, healing pad, cheese)
             - dotPerSecond    * k/9              (poison, Bull)
             - effectiveThreat * confidence(k)
```

and answers: `ticksToDeath`, `healsNeeded(target)`, `willSurviveHold(ms)` — the
question the shame deferral turns on ("can I afford to wait for the window?").

### 6. HealDecisionEngine

Emits one `HealPlan` per tick: `{urgency, presses, allowCharge, holdMs, reason}`.

### 7. PriorityArbiter

Resolves the plan against the rest of the client and the packet budget. Yields
to committed combat, reserves packets for the placement engine and mills, and
refuses to contest a hat another module has claimed.

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
  ├─ shame.update(snap, state)      count, verdict, credit clock
  ├─ threat.evaluate(snap, damage)  raw → effective → lethal
  ├─ predict.build(...)             projection, survivesHold, healsNeeded
  ├─ ledger.noteOutcome(...)        did the last press land? back off if not
  ├─ decide.plan(..., cooldown)     urgency + press count + hold
  ├─ arbiter.resolve(plan, snap)    yield / clamp against other systems
  ├─ validator.check(plan, snap)    legality
  ├─ cooldown.pace(plan, snap)      record the hold the plan settled on
  └─ executor.run(plan)             presses; ledger + shame count updated
```

## State model

```
self     health, maxHealth(100), foodId, restore, foodStock, hatId, accId,
         alive, inGame, sandbox
timing   tick, tickAt, TICK(111), pong, msSinceTick
shame    count, locked, hitAt, pending, verdict, msUntilCredit, budget
damage   lastDelta, burst, rate9, dotActive, dotPerSec, msUntilDotTick
threat   melee, secondary, turret, projectile, spike, spikeKB, dot,
         raw, effective, lethal, instaThreat, spikeContact
heal     inFlight[], sentThisTick, backoffUntil, lastLandedTick
plan     urgency, presses, allowCharge, holdMs, reason
```

## Priority model

| # | Class | Fires when | Shame policy |
|---|---|---|---|
| 0 | `BLOCKED` | validator refuses | no press |
| 1 | `IDLE` | full health, no debt | no press |
| 2 | `TOPUP` | health below max, tick is quiet | uncharged presses only |
| 3 | `WASH` | `count > 0` and a credit press is available | credit only — this is the `-2` |
| 4 | `SUSTAIN` | health below `effectiveThreat + reserve` | hold ≤ 1 tick for the window, then press if budget ≥ 2 |
| 5 | `CRITICAL` | `projected <= effectiveThreat`, death inside 1 tick | press now; spend `+1` if `budget >= 1` |
| 6 | `LOCKGUARD` | `count === 7` and verdict is `CHARGED` | **never press** — wait for the window |

`LOCKGUARD` outranks `CRITICAL` by construction, and that is not a survival
compromise: at `count === 7` the charged press is refused by `consume` anyway
(fact 4), so waiting costs nothing that pressing would have gained.

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

Against the transcribed server rules, over eleven scenarios (sustained melee,
every-other-tick pressure, an insta burst, poison, a 6- and a 7-count debt,
250 ms ping, no food, an active lock, cheese, and an unsurvivable every-tick
beatdown):

- no scenario arms the 30 s lock, and none sends a press while one is on;
- the count never exceeds 7;
- eight of the eleven hold shame at **0 for 100 % of ticks**, including the
  90 dps pressure run and the 250 ms ping run;
- the every-tick beatdown is the one shape the shame rule makes unsurvivable —
  the hit stamp is refreshed faster than the window closes, so all seven charges
  go and the eighth press is refused rather than sent. Dying at 7 without a lock
  is the correct outcome there, and it is what the engine does.
