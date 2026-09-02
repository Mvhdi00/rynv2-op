# Auto Heal — the defensive layers

Design notes for the threat-range, projectile, prediction and defensive-gear
work that sits **around** the Auto Heal Engine. The engine's own pipeline —
`StateTracker → DamageAnalyzer → ShameController → ThreatEngine →
PredictiveDefenseEngine → HealDecisionEngine → ActionValidator → HealExecutor`
— is unchanged. What changed is the quality of what those stages are told, and
one new stage between the forecast and the decision.

Everything below is derived from `src/game_index.js` (the shipped bundle) and
`drivers/game-drivers.json` (extracted from it). `tools/verify-autoheal.js`
re-derives every constant and fails on drift.

---

## 1. Threat range

The engine used to ask one question of every threat: *is the enemy inside
`max(primaryRange, secondaryRange)`*. That number is `Player.getWeaponRange`
(v5.4:3778), which folds a bow's 1000 and a katana's 118 into the same field.
The consequences were both directions of wrong at once:

- an archer 800px away read as **in melee reach**, so `AntiInstakillDetector`
  reported `armed-in-reach-facing` for someone who could not touch us;
- a polearm user closing at 40/tick read as **out of reach** at 210px, one tick
  before their swing landed.

`RangeModel` derives each reach from the rule that produces it.

| threat | reach | source |
|---|---|---|
| melee | `weapons[id].range + 1.8 × my scale` | `game_index.js:2537` |
| melee cone | `gatherAngle` = 1.2083 rad (69°) | `game_index.js:2538` |
| projectile | `projectiles[p].range × aMlt`, spawned `scale×2` ahead | `game_index.js:2393` |
| turret | `items[17].shootRange + my scale` | `items[17]`, 700 |
| spike contact | `my scale + spike.collisionScale` | `game_index.js:937-941` |

Worked values at the shipped tables: katana **181**, polearm **205**, daggers
**128**, short sword **173**, turret **735**, spike contact **84** (spikes) or
**87** (greater / poison / spinning).

Two corrections fall straight out of this:

- **`aMlt`.** Marksman Cap (`hats[1]`) multiplies a projectile's range *and its
  speed* by 1.3 at spawn. A Marksman musket reaches **1820** at 4.68/ms. The
  ranged detectors previously compared against a flat 1400 and stood down for
  shots already on their way.
- **The melee cone.** Facing was tested with `asin(scale / distance)` — the
  client's *projectile* line test, under 5° at 400px. The server swings inside
  69°. Every enemy carries both now: `facing` for a shot, `aimingMelee` for a
  swing.

Reaches are opened by one tick of *measured* approach (`closing`, from
`pos.previous → pos.current`), because both positions in the comparison are a
tick old. Retreating never shrinks them.

## 2. Projectiles

`ProjectileManager` writes a projectile's position **once**, when the `X` frame
arrives (v5.4:7297), and never moves it. The only thing that changes is `life`,
counted 9 → 0 (v5.4:6866). So the old reader reported the muzzle for the whole
second an entry lived, and `ceil(distance / (speed × TICK))` returned the same
"three ticks out" before impact, at impact, and for six ticks after the ball had
gone.

The flight is now reconstructed in `HostAdapter.incomingProjectiles`:

```
flown      = (9 - life) ticks                     the only clock there is
origin     = pos.current + 70 along angle         undo the sprite offset (v5.4:6908)
position   = origin + dir × speed × TICK × flown
remaining  = range - flown                        <= 0 means the server killed it
along/perp = closest approach of the line to me
```

and the hit test is the server's, not a cone: `game_index.js:3103` crosses the
step segment with an axis-aligned box of half-width `scale` around the target.
The threshold used is the box's **corner**, `scale × √2`, widened by my own
drift over the remaining flight — over-including a miss costs one wasted read,
under-including a hit costs the bar.

Each projectile now carries `onTarget`, `miss`, `margin`, `ticksToImpact`,
`rangeLeft` and `flownTicks`. Detectors and the forecast use `onTarget` only;
the forecast weights confidence by `margin`, so a shot down the middle and one
threading the corner are not priced alike.

## 3. The eight Antis

Each keeps its structure and gets the range model, the real projectile state,
and a timing that means something.

| Anti | what changed |
|---|---|
| **Instakill** | melee reach instead of the combined range field; melee cone for facing; `closing-into-reach:N` as its own evidence and confidence step; timing is the soonest of the ball in the air and the enemy walking in, not a flat 1 |
| **Spike Tick** | the next contact is timed from the collision gap and my measured speed when that is sooner than the interval history; `gap-ticks:N` in the evidence |
| **Insta Rev** | melee reach opened by approach, so the walk-in half of the combo is seen; turret term only when a turret can actually reach, and its damage from `projectiles[1]` rather than a remembered 25 |
| **Musket** | in-flight path uses the reconstructed trajectory and the margin; held-weapon path uses the shooter's own `aMlt`-corrected reach and reports flight time as its timing |
| **Bow** | same, across hunting bow / crossbow / repeater, each with its own projectile damage, range and speed |
| **Spam Dagger** | the dagger's real 128 reach instead of the client's range field; melee cone; swings-per-tick from `weapons[7].speed` = 100ms against a 111ms tick |
| **Velocity Tick** | turret must be inside 735, not merely present; acceleration from the borrowed motion track; timing from `items[17].shootRate` (2200ms) or `hats[53].turret.rate` (2500ms) when the turret is not loaded, instead of "next tick" |
| **Spike** | contact radius and gap from the collision rule; can speak before the client's flag when the gap is inside one tick of travel; timing from gap ÷ speed |

None of them fires on possession. A held weapon needs loaded + aimed + inside
its own real reach + a wind-up signature, and still never exceeds MEDIUM.

## 4. Defensive gear

`DefensiveGearManager` is the new stage, between the forecast and the heal
decision. There is exactly one defensive hat worth wearing for damage:

> **Soldier Helmet** (`hats[6]`), `dmgMult 0.75`, applied by the server inside
> `changeHealth` *before* the health is touched (`game_index.js:2419`).

Because it is applied there it is not directional, not weapon-specific and not
dodgeable: it takes a quarter off melee, a musket ball, spike contact, a turret
shot and a poison tick alike. It costs `spdMult 0.94`.

So the question is never "is there a dangerous enemy". It is *does a quarter off
the damage that is actually going to land change what happens to me, before it
lands* — and all three parts have to hold:

1. **Something is going to land** — a detector report with evidence, not a
   weapon in someone's inventory.
2. **It lands late enough** — an equip is one frame plus a round trip, so a hit
   resolving this tick cannot be mitigated. Only damage at `timing >= 1` counts
   as mitigable.
3. **The quarter is worth having** — either it turns lethal into survivable, or
   it saves at least `GEAR_MIN_SAVED_HEALTH` (8).

### When Soldier is correct

In priority order, with the mechanic behind each:

| rule | condition | urgency |
|---|---|---|
| (a) | `dangerWithoutSoldier` — EnemyManager's own verdict (v5.4:3133-3143). Between it and `detectedDangerEnemy` is the band Soldier exists for; above it, the quarter is still a quarter the heal does not have to buy back | CRITICAL |
| (b) | our own numbers: mitigable damage ≥ projected health | CRITICAL if `× 0.75` survives it, else HIGH |
| (c) | a shame lock is on — food is refused for the whole 30s (`game_index.js:2466`), so mitigation is the only defence left | HIGH |
| (d) | a committed detector report at ≥ MEDIUM, timing in `[1, 6]`, saving ≥ 8 | HIGH / MEDIUM |
| (e) | sustained pressure lasting ≥ 2 ticks and saving ≥ 8 | MEDIUM |
| hold | already engaged and either damage still incoming or a ≥ MEDIUM report still on the board | LOW |

The hold rule is deliberately **not** "any report": `SustainedDamageDetector`
keeps a 27-tick window and goes on reporting LOW long after the last hit, and
letting that hold the hat is how an engine ends up wearing Soldier permanently.

### Vetoes

- another module already claimed `forceHat` this tick;
- `velocityArmed` — Velocity Tick owns Bull for its combo;
- `spikeTick` — the spike-sync modules own Turret Gear for theirs;
- the switch cooldown, which **urgent** requests ignore and nothing else does.

### Hysteresis

| knob | value | why |
|---|---|---|
| `GEAR_MIN_HOLD_TICKS` | 3 | a switch stands before it may be undone |
| `GEAR_RELEASE_TICKS` | 5 | consecutive quiet ticks that end a session; one calm tick inside a fight is not the fight ending |
| `GEAR_SWITCH_COOLDOWN_TICKS` | 4 | after a release, an ordinary re-engage waits; an urgent one never does |

One continuous threat is one session and one equip. Coming back off it is just
ceasing to claim `forceHat` — `defaultHat` and `autoHat` restore whatever they
want, because what to wear when nothing is happening is not this engine's
decision.

### What it writes

`HostAdapter.requestHat(id, claimTick)` → `ModuleHandler.setForceHat`, which is
first-come-wins (v5.4:20964), and `AutoHat._equip` is idempotent against the
store (v5.4:21068) so asking for a hat already worn costs nothing.

`claimTick` is **false** for the defensive claim. `moduleActive` is how a module
says "this tick is mine", and half a dozen modules — Anti Retrap among them —
return immediately when they see it. A defensive hat sends no action of its own,
so claiming the tick for it would silently switch other systems off for the
length of a fight. The Bull wash keeps `claimTick: true`, unchanged.

Modules running after the engine (`AntiRetrap`, `VelocityTick`) assign
`ModuleHandler.forceHat` directly rather than through `setForceHat`, so they
simply overwrite the request — which is the right outcome, and why this engine
never has to arbitrate for the slot. `gear.overridden` notices when it happens
so a session does not believe it is wearing a hat it is not.

## 5. Heal packets — what Deltek contributes

Deltek's heal is:

```js
function place(id, angle) {
    selectToBuild(id);      // z, id, false
    sendAtck(1, angle);     // F, 1, angle
    sendAtck(0, angle);     // F, 0, angle
    selectWeapon(predictWeapon);
}
function heal(value) {
    for (let i = 0; i < value; i += items.list[myPlayer.items[0]].heal)
        place(myPlayer.items[0], null);
}
```

Read against RYN's own path, that gives one thing worth adopting and one worth
declining.

**Adopted — the batch shape.** One press per `restore` of the gap, all of them
inside a single tick, stopping when the gap closes. The engine already computed
its press count this way (`predict.healsNeeded`); what was missing was the rest
of the arithmetic around it, below.

**Declined — the frame sequence.** Deltek pays four frames per press because
`place()` sends an attack *stop*. RYN does not need it: `UpdateAttack` owns the
attack state and sends its own stop later in the same tick (v5.4:13513-13527).
The engine's burst is `select + attack` per press plus **one** weapon restore at
the end — `2n + 1` frames. Three presses cost seven, not twelve.

The changes made, all of them about not spending frames on presses that cannot
land:

1. **The budget is measured in the frames actually sent.** `PACKETS_PER_PRESS ×
   n` (3n) is replaced by `burstPackets(n) = 2n + 1` in the validator, the
   arbiter's `affordable()` and the value model. Dividing a 12-frame budget by
   three said it carried four presses when it carries five.
2. **Presses are capped by the food in the bag.** `canBuild` checks `hasRes`
   first (`game_index.js:2496`), so a press without the resources changes
   nothing at all — and still costs two frames. A four-press plan on two
   presses' worth of food used to send four.
3. **The duplicate key stopped carrying the urgency.** Two presses of the same
   food aiming at the same bar are the same action however the tick that
   produced them was labelled; with `urgency` in the key, a sustain press and a
   preempt press for identical health both passed the pending check.

No new packet path, no second scheduler, no invented frame: the executor's three
stages (validate → press → commit) are untouched.

## 6. Also fixed

`createRynAutoHealEngine` was never handed `Weapons` or `Projectiles`, although
`HostAdapter` exposes both and `ctx.projectileDamageFor` is built on them. Every
ranged detector's held-weapon branch therefore reported severity **0**. They are
passed now, as getters like the rest.

## 7. Compatibility

Untouched: Auto Place, Preplace, Replace, Spike Tick, Combat, Safe Soldier, Anti
Smart Tick, Auto Mills, Velocity Tick. The engine reads their state through
`HostAdapter._readSystems` and writes exactly two things — its own food presses,
and `setForceHat` — both through the client's own primitives.

## 8. Verifying

```sh
node tools/verify-autoheal.js     # 47 constants re-derived from the bundle
node tools/test-autoheal.js       # 66 cases, every Anti individually and together
node tools/verify-drivers.js "Ryn Type 2.user.js"
node --check "Ryn Type 2.user.js"
```

`tools/extract-autoheal.js` slices `createRynAutoHealEngine` out of the
userscript and compiles it in a `vm` context, so both of the first two run the
**shipped** code rather than a copy of it.
