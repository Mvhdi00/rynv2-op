# RYN Auto Heal Engine v2

A predictive survival engine for the RYN client. It owns four things and
nothing else:

- every automatic food press (heal, shame recovery, pre-emption);
- the defensive hat/gear decision;
- projectile micro-evasion;
- the packet budget those three spend.

Source: `src/autoheal/ryn-autoheal-engine.js`.
Build: `node tools/build-autoheal.js` → `RYN_AutoHeal.user.js`.
Checks: `node tools/verify-autoheal.js RYN_AutoHeal.user.js`, `node tools/test-autoheal.js`.

---

## 1. The mechanic everything is built on

Server, `Player.buildItem`, `src/game_index.js:2461-2469`:

```js
if (f.consume) {
    if (this.hitTime) {
        const W = Date.now() - this.hitTime;
        this.hitTime = 0;                       // only the FIRST press after a
        W <= 120 ? (this.shameCount++,          // hit is ever judged
                    this.shameCount >= 8 && (this.shameTimer = 3e4,
                                             this.shameCount = 0))
                 : (this.shameCount -= 2,
                    this.shameCount <= 0 && (this.shameCount = 0));
    }
    this.shameTimer <= 0 && (V = f.consume(this));
}
V && (this.useRes(f), this.buildIndex = -1);
```

Six consequences, and the whole engine follows from them:

1. **A press inside 120ms of a hit is +1.** Nothing else raises the count.
2. **A press later than that is −2.** Nothing else lowers it.
3. **A press with no hit pending changes nothing.** `hitTime` is 0 and the
   arithmetic never runs.
4. **Only the first press after a hit is judged.** `hitTime = 0` is set before
   the branch, so every press behind the first in the same burst is free —
   which makes batching the cheapest way to survive a forced charge.
5. **The press that reaches 8 arms a 30-second lock *before* `consume` is
   reached, so it does not heal either.** There is never a survival case for
   sending it.
6. **A press at full health costs no food.** `changeHealth` returns `false` at
   the cap (`:2418`), so `consume` returns false, so `useRes` is never called
   (`:2475`). A recovery press at full health costs three packets and nothing
   else.

(6) is what makes "hold the count at zero" affordable rather than aspirational.

### Reading the window from the client

The client cannot see `hitTime`. What it can see is the tick a health drop
arrived on. Both ends of the server's comparison happen inside its update pass —
`hitTime` is stamped by a `changeHealth` call during one tick (`:2422`) and the
comparison runs in `buildItem` during a later one (`:2462`) — so the gap is very
close to a whole number of ticks, and at 1000/9 ms per tick **only one tick
(111ms) lands inside the window. Two ticks is 222ms and is always credit.**

So: a press sent on the tick the damage was seen is charged; a press sent on any
later tick is credit. Every error in that model runs the safe way — a delayed
health packet or a round trip over one tick only pushes the real gap further out,
never nearer. A wall-clock lower bound `(now − hitObserved) + pong` is kept as a
second route to credit.

---

## 2. What was wrong with v1

Found by reading the shipped v5.4 engine and by driving it against the scenario
harness. In rough order of how much it cost:

| # | Defect | Effect |
|---|---|---|
| 1 | `createRynAutoHealEngine({Items, Hats, Accessories, Settings})` — **`Weapons` and `Projectiles` were never injected** | `adapter.Weapons` was `undefined`, so `projectileDamageFor()` returned 0 for every weapon. A musket or bow held, loaded and aimed produced a report with severity 0, which then ranked below everything on the board and drove nothing. Anti Musket and Anti Bow only worked once a shot was already in the air. |
| 2 | **The charge gate was a price, not a rule** | Nothing forbade a `+1` press; the value model merely charged for it, at `lifeValue / (7−count)²` ≈ 6 points at count 0. Any top-up worth more than 6 health outbid it, so ordinary exchanges spent charges and the count climbed. In the 60-tick pressure scenario the old shape reaches 7. |
| 3 | **`SHAME_WARN_HIGH = 5` was the only place the count mattered** | 1–6 was one undifferentiated "warning" zone with no obligation attached, so a debt of 4 was treated as normal running. There was no target. |
| 4 | **Shame recovery was gated behind the `_autoHealWash` toggle** | `ShameOpportunity.find` returned `"off"` immediately when the toggle was off, so with Shame Wash off the engine had *no* path back to 0 at all. |
| 5 | **Deferring a credit was priced as free** | With a quiet field `wait.total === now.total` exactly, and a tie means WAIT. A debt could sit at 3 indefinitely while the engine reported it was about to fix it. |
| 6 | **No gear manager.** The engine's only gear action was `requestBullHat()` for the wash | Every Anti in the client equips its own hat by assigning `ModuleHandler.forceHat` directly, so the last writer in the module list won a question that should be decided once by threat priority. |
| 7 | **`forceHat` cannot express a final decision** | `setForceHat` yields to an existing claim, but the modules after the engine (`antiInsta`, `autoShield`, `trapKB`, `knockbackTick`) assign `forceHat` directly and overwrite it. |
| 8 | **No packet budget.** `PriorityArbiter.affordable()` computed a number from the snapshot; there were no reservations, no per-threat costs, and no re-check against the live counter before sending | A lethal threat could find the budget already spent by a top-up decided earlier in the same tick. |
| 9 | **Missing detectors** | Reverse insta was folded into a reload-shape check with no timing model of its own; one-tick, spike-push, KB-tick, turret-stack, spam-bow, mixed primary+ranged and the hammer/spike velocity combo had no detector at all. |
| 10 | **No micro-evasion** | Projectiles could only be healed through. |
| 11 | **`StateTracker` seeded health at 100** | The first tick of a life at anything other than full health read as a hit, leaving a phantom pending stamp — so the first press of the life was priced as charged for no reason. |
| 12 | **Ping was `snap.pong` used raw** | No smoothing, no jitter, and no notion of how far ahead of an impact a decision has to be taken. |

Two further defects were found while building v2 and are listed here because
they are the same class of mistake:

13. **The forecast summed the same swing under every name it had.** One enemy
    reported by three detectors plus the "in-reach" term produced 2–3× the real
    number, so ordinary exchanges read as lethal and every tick was an
    emergency. Events are now keyed by the thing that can hit us.
14. **Detectors applied our own soldier multiplier, and so did the priority
    layer.** Besides double-counting, it meant *wearing the answer dissolved the
    question*: with Soldier on, a 68-damage one-tick scored 51, dropped under
    the detector's own threshold, disappeared from the board, and the hat came
    off — a hat that flapped once a second. Detectors now report damage as it
    arrives; mitigation is applied once, in `ThreatPriority`.

---

## 3. The shame engine

**`SHAME_TARGET = 0`.** `SHAME_MAX = 7` is the ceiling — the state one press
short of a 30-second lock — and is never an operating point.

### Zones

| count | zone | meaning |
|---|---|---|
| 0 | `SAFE` | the objective |
| 1–4 | `WARNING` | a debt, repaid at the first opening |
| 5–6 | `HIGH` | no charge leaves except to survive |
| 7 | `CRITICAL` | no charge leaves at all — it would arm the lock and heal nothing |

### The charge policy (requirement 1, as a constraint)

`ShameEngine.mayCharge` runs **before** the pricing, because "the count is
supposed to be zero" is not a number to be outbid:

```
never at the ceiling                      -> lockguard
Strict Shame Guard on                     -> survival only
otherwise                                 -> survival, or waiting drops the bar
                                             under the reserve floor
```

What is deliberately *not* a reason to charge: being under half health, being in
a fight, being at count 3 rather than 6. The same food is available one tick
later for −2 instead of +1.

The floor the gate asks about is the **reserve** (default 15), not the sustain
floor (`threat + reserve`). `holdsAboveFloor` already subtracts the incoming
damage; asking it against a floor that also contains the incoming damage counts
the threat twice, and a gate that counts the threat twice says yes to almost
every exchange. That was defect #2's mechanism and it is called out in the code.

### The way back to zero (requirements 2 and 3)

`ShameOpportunity` names exactly three ways down, in order of preference:

1. **`credit-now`** — a hit is pending and the window has passed. Press now,
   take the −2. At full health it costs no food (consequence 6), so this is
   taken the moment it opens rather than when the count gets uncomfortable.
   Not gated on any toggle.
2. **`credit-wait`** — a hit is pending but is still inside the window. The
   credit is one tick away; the decision may or may not be able to wait for it,
   and that trade is made against health, not here.
3. **`bull`** — nothing pending, so a hit has to be manufactured. Bull Helmet's
   `healthRegen -5` stamps `hitTime` on the next one-second tick
   (`game_index.js:2317`), and a press after that tick is a −2 that also heals
   the 5 back. Only on a genuinely quiet field, and only with Shame Wash on:
   Bull carries no damage reduction, so arming it in front of anything that can
   hit back trades health for a point a natural credit would have given free.

Deferring an available credit carries a price (`wait.deferredDebt`, a quarter of
what the credit is worth). Without it the two sides tie exactly on a quiet field
and a tie means WAIT — defect #5.

### When a charge is unavoidable

Two rules keep the damage to one point:

- **Batch.** Because only the first press after a hit is judged, a forced heal
  fills to the top in one burst. Three presses cost one charge, not three.
- **Repay.** The debt is an outstanding obligation (`owedSinceTick`), and the
  next credit window closes it. Scenario E asserts exactly this: a forced
  emergency burst costs 1, and one hit plus one tick of patience later the count
  is back to 0.

### Two counts, and which one gates

RYN's own mirror (`Entity.updateHealth`) only moves on an observed health rise,
so it is blind to a press that healed nothing — which is precisely the
full-health recovery press. The engine keeps its own count and adopts the
mirror's deltas when they appear. A charged press is gated on
`max(engine, mirror)`: being one too low is the press that arms the lock; being
one too high only postpones a heal.

---

## 4. The threat engine

One engine, one enemy walk, one projectile walk, one shared context. Every
detector reads that context and returns at most one report. Nothing in the
detector layer touches the client and nothing in it sends anything.

The **damage number** is still Combat's own — `EnemyManager` has already summed
weapons in range and off reload, spike contact, turret and knock-onto-spike, and
`ProjectileManager` has summed what is in the air. None of that is re-derived.
What the detectors add is the *shape*: which sequence it is, how sure we are,
how soon it lands, what gear answers it, and how many packets that costs.

### The evidence rule (requirement 31)

An enemy carrying a musket is not a musket threat. Every detector is built on
observable state:

- weapon **held** (`weapon.current`), not owned;
- **reloaded** (`isReloaded`), **in its own range** (`getWeaponRange`, never a
  constant of ours), and **pointed at us** (the same offset test the client uses
  for a projectile's line);
- **transitions** recorded by `SequenceTracker` — bull→turret-gear,
  turret-gear→bull, hammer→primary, bow→crossbow→musket — with the tick they
  happened on, so a combo is distinguishable from a wardrobe;
- the client's **own computed verdicts** where it already has them:
  `canPossiblyInstakill`'s `danger`, `reverseInsta`, `toolHammerInsta`,
  `rangedBowInsta`, and `detectSpikeInsta`'s `canPlaceSpike` / `spikeDamage` /
  `spikeSyncThreat`, which are real placement scans rather than "owns spikes".

Scenario A asserts the negative case: an enemy owning everything, out of range,
unloaded and facing away produces zero reports, zero equips and zero packets.

### The detectors

| Requirement | Detector | What it keys on | Answer |
|---|---|---|---|
| 7 Anti Insta Kill | `AntiInstaKillDetector` | hat chain **7 → 53** inside the sequence window, or the client's `toolHammerInsta` / `danger ≥ 3`, **plus** reach: loaded, inside their own weapon range, facing | Soldier |
| 8 Anti Reverse Insta | `AntiReverseInstaDetector` | hat chain **53 → 7**, or `reverseInsta`, or secondary+turret held at empty reload behind a loaded primary. **Its own clock**: everything is already loaded, so the dangerous tick is *now* (timing 0), not the tick after | Soldier |
| 14 Anti One Tick | `AntiOneTickDetector` | polearm/katana/short sword held and loaded, inside its real `getWeaponRange` widened only by the enemy's measured travel over the reaction window, worth ≥ 60% of the bar | Soldier |
| 6 Anti Velocity Tick | `AntiVelocityTickDetector` | a turret source or a turret shot in the air, plus a polearm or Turret Gear inside VelocityTick's **own** `minKB`/`maxKB` band (read from the module, not copied), widened by measured drift on both sides | Emp when the turret is the larger half, else Soldier |
| 18 Anti Velocity + Hammer + Spike | `AntiVelocityComboDetector` | great hammer held or held within the window, in reach, with a spike the client says can be placed onto us | Soldier |
| 9 Anti Musket / 16 Anti Bow | `RangedDetector` ×2 | a shot in `dangerProjectiles` (the client has already done the line test) with origin, direction, speed, life, range, our hit radius and impact time; or a loaded, aimed, freshly-switched or half-reach wind-up, capped at MEDIUM | Soldier, evadable |
| 16 Anti Spam Bow | `AntiSpamBowDetector` | arrivals per projectile id, the measured interval between them, and the next one predicted from it | evadable |
| 19 Anti Primary + Musket/Bow | `AntiMixedInstaDetector` | a melee weapon in reach **and** a shot from the same owner in the air or loaded and aimed, where the pair clears the bar although neither half does | Soldier |
| 15 Anti Spam Daggers | `AntiSpamDaggerDetector` | repeated damage while a dagger is inside its own 65 reach; bull is priced, never required | Soldier at ≥3 hits |
| 17 Anti Spam Shame | `AntiSpamShameDetector` | damage events at an interval short enough that every heal would be charged, plus a count that has actually been rising | policy: batch and take every gap |
| 13 Anti Spike Tick | `AntiSpikeTickDetector` | two halves: the contact sequence (damage on ticks where a spike was being touched), **and** the one before it — pinned in an enemy trap whose health is falling at a measured rate, with a placeable spike waiting for the moment it opens. The exposure tick is arithmetic on the trap's health | Soldier, before the trap breaks |
| 11 Anti Spike Push + Insta | `AntiSpikePushDetector` | `nearestEnemyPush` / `nearestPushSpike` / `pushingOnSpike`, the gap to the spike and how fast it is closing (measured tick to tick), plus the escort's hat and reach | Soldier |
| 12 Anti KB Tick | `AntiKBTickDetector` | reach + loaded, the knockback distance from RYN's own `weapons[i].knockback` (or the bundle's `0.3 + knock` over `playerDecel`), and either the client's `potentialSpikeKnockbackDamage` or a hazard probe at the predicted landing point | Soldier |
| 20 Anti Turret Stack | `AntiTurretStackDetector` | ≥2 turret sources inside 700 — placed turrets and Turret Gear wearers — their combined damage, how many are ready, and whether walking out is even possible | **Emp** |
| — | `AntiSpikeDetector`, `AntiTrapDetector`, `BurstDamageDetector`, `SustainedDamageDetector` | direct exposure and the two generic shapes | |

---

## 5. Priority (requirement 22)

`THREAT_ORDER` holds the requested order as a **prior**, not a verdict. Ranking
is done in tiers:

```
tier 2   lethal, and landing inside the reaction window
tier 1   lethal, landing later
tier 0   everything else
```

and inside a tier by urgency — `severity × confidence ÷ (1 + timing)`, tripled
when the amount alone clears the bar. `THREAT_ORDER` only breaks ties. So a
musket ball two ticks out that takes the whole bar outranks a dagger landing
this tick that takes a fifth of it, which is exactly what "the closest threat is
not automatically the most dangerous" asks for. When the tiering moves something
past a higher-listed threat, the telemetry says so (`override`).

Whether the engine may act **at all** is judged on RYN's own scale: the
placement engine's `RPE_PRIORITY` classes, read through its own `priorityFor`,
so healing, gear and placing are ranked by one authority rather than three.

---

## 6. Defensive gear (requirements 23 and 24)

One manager. One decision per tick. Nothing else in the engine writes gear.

### What it equips, and why only these

| Hat | Table fact | Used for |
|---|---|---|
| Soldier Helmet (6) | `dmgMult 0.75`, applied by the server inside `changeHealth` | everything: melee, insta sequences, spike, trap, burst |
| Emp Helmet (22) | `antiTurret 1` — turrets do not fire at us | turret stacks, and velocity ticks where the turret is the larger half |

### What it will not equip, and why

**Bull Helmet (7) is not defensive.** The tables say `healthRegen -5` and
`dmgMultO 1.5`: it drains five health a second and multiplies damage we *deal*.
It has no `dmgMult`, so equipping it in front of an incoming insta would cost
health and reduce nothing.

Requirement 7 and requirement 8 name "Bull Hat → Turret Gear" and "Turret Gear →
Bull Hat". Those are read here as **the attacker's sequence**, which is where
the rest of both requirements point ("when the enemy is preparing", "detect the
actual attack sequence", and requirements 11 and 12 which name the same two hats
explicitly as the enemy's tools). `AntiInstaKillDetector` watches for 7→53 and
`AntiReverseInstaDetector` for 53→7 on the enemy, each with its own timing
model, and both are answered with the hat that actually reduces the damage.

*If you did mean that RYN should wear Bull and then Turret Gear as the response,
say so and it is a small change — `DefensiveGearManager._hatFor` is the only
place the mapping lives. It was not done by default because the tables say it
would cost health and prevent nothing.*

The only Bull this engine ever requests is the manufactured shame wash on a
quiet field, which goes through `ShameOpportunity` and not through the gear
manager.

### Synchronisation

- **Early enough**: a candidate is only taken when `timing ≤ reactionTicks +
  GEAR_MIN_HOLD_TICKS`, i.e. when the equip frame can still land before the hit.
- **Held**: `GEAR_MIN_HOLD_TICKS` once on, so a flickering threat cannot flap the
  hat slot. Holding costs **zero packets** — `ModuleHandler._equip` refuses a
  no-op — so a four-tick threat is one equip.
- **Released**: `GEAR_RELEASE_TICKS` after the last qualifying threat. Releasing
  is simply not re-asserting the claim, so it is free too. Soldier is never the
  resting state (requirement 24).
- **Never contested**: it stands down for VelocityTick's armed combo, and for a
  hat another module claimed earlier in the tick unless the threat is lethal.

### The gear lock

`forceHat` alone cannot be the single decision requirement 23 asks for: modules
after the engine assign it directly, so the last writer would win. The build
therefore adds one hook. `ModuleHandler._ahGearLock` is set by the engine and
read by `Autohat` — the one module that actually equips — ahead of `forceHat`:

```js
_ahGearHat(ModuleHandler) {
  const lock = ModuleHandler._ahGearLock;
  if (!lock) return null;
  if (lock.tick !== ModuleHandler.tickCount) return null;
  return lock.hat;
}
```

It carries the tick it was taken on and is cleared where `forceHat` is cleared,
so it can never outlive the threat that produced it, and with the engine off or
idle it is never set at all.

---

## 7. Projectile micro-evasion (requirement 10)

A projectile is the one threat that can be answered by not being there. It
travels in a straight line at a known speed, the client has already established
that it is on a line to us, and the hit test is a radius sum — so "will it hit"
and "how far do I have to move" are arithmetic.

```
pick the soonest shot that is still coming and whose perpendicular offset
  is inside (my scale + projectile scale / 2)
need   = hitRadius − offset + margin
reach  = max(measured speed, half the game's terminal speed) × ticks available
if need > reach                      -> refuse, and say so
two candidates: perpendicular to the shot, each way
reject a destination that is inside a spike, an enemy trap, a wall,
  another shot's line, an enemy's melee reach, or off a healing pad
pick the side that increases distance from the nearest enemy
```

One `ModuleHandler.moveTo` claim, which SafeWalk turns into exactly one `move`
frame. Reverting is free and automatic: `moveTo` resets to `"disable"` at the
top of every tick and SafeWalk sends the player's own key direction again. A
dodge is one packet out, one packet back, and lasts one tick unless re-asked.

If it cannot be dodged safely, the planner returns nothing and the heal engine
and gear manager answer instead — never both at cross purposes, because both
read the same ranked threat list.

---

## 8. Ping (requirement 25)

`effectiveReactionTime` is not "ping added to every timer". What stands between
a decision and the server acting on it is

```
the rest of this tick  +  the send leg (half the smoothed round trip)  +  one
deviation of recent jitter
```

The receive leg is deliberately absent: the engine is not waiting to see the
result, it is trying to be early. Adding the whole round trip would make it
defend a tick sooner than necessary on every connection and burn food doing it.

Smoothing is an EWMA over `pong` with a separate EWMA over the absolute
deviation. Jitter worth more than a tick sets `unstable`, which widens the
windows rather than pretending the number is sharp.

---

## 9. The packet budget (requirements 26 to 29)

One ledger: `PacketBudget`. Every frame this engine sends is asked for there
first.

### The hard cap

`canSend` re-reads `ModuleHandler.packetCount` — the **live** counter, which is
`PacketManager.packetCount` and counts every frame that leaves the socket — and
refuses anything that would put it over `packetLimit`. It is called immediately
before every single frame, including each press inside a burst. There is no path
in the engine that sends a frame it did not ask for, and no path that sends more
than it asked for.

### Costs, counted at the wire

| Action | Frames | Why |
|---|---|---|
| one food press | 3 | `selectItem` + `attack` + `whichWeapon` |
| press inside a burst | 2 | the weapon restore is paid once for the burst |
| burst of N presses | 2N + 1 | three presses cost seven frames, not nine |
| hat equip | 1 | `PacketManager.equip`; **0** when the hat is already worn |
| dodge | 1 | `PacketManager.move`, sent by SafeWalk |

### Reservation

A lethal threat books what its answer will cost — the detector's own packet
estimate plus the presses needed to get back over the bar — under the tag
`lethal` at `EMERGENCY`. Everything cheaper sees a budget with that reservation
already taken out of it (`reservedAgainst`). Lower-priority healing therefore
cannot spend the frames the emergency will need.

### Priority and redistribution

`EMERGENCY > DEFENSIVE > SHAME > NORMAL`. A shame recovery that the forecast says
will otherwise reach the ceiling is **promoted** (`budget.promote`) rather than
special-cased, because what it prevents is thirty seconds of not being able to
heal at all.

The placement systems and Auto Mills keep an external reserve
(`PACKET_RESERVE_PLACER 12`, `PACKET_RESERVE_MILL 6`) that only `EMERGENCY` may
spend.

---

## 10. Performance (requirement 34)

- **One read per tick.** `HostAdapter` memoises the enemy walk, the projectile
  walk, the spike/trap/turret contexts and the healing-pad probe per tick. The
  threat engine, the prediction engine, the gear manager and the evasion planner
  all work from the same arrays.
- **The turret sweep is cached.** The grid's cells are 100px, so covering a
  turret's 700px reach is a 15×15 block — far too much to sweep every tick for a
  structure that cannot move. It is refreshed once a second (a turret's own rate
  is 2200ms) or when we have moved more than 150px; every tick in between only
  re-measures the handful of objects it already found, and drops any the
  ObjectManager has forgotten.
- **The forecast is cached** behind named invalidation reasons (target changed,
  enemy turned, enemy stopped, projectile changed, collision changed, player
  moved, threat gone, aged out, world fingerprint) rather than rebuilt every
  tick.
- **Motion is borrowed, not rewritten.** A private instance of the placement
  engine's own `TargetMotion` class: same code, separate tracks, no interference
  with the planner that owns it.
- **No timers.** `verify-autoheal.js` asserts the source contains no
  `setTimeout` / `setInterval` / `requestAnimationFrame`. Every action leaves in
  the same synchronous call that decided to send it, which is the only way to be
  fast in a client whose tick is 111ms wide.
- **Bounded work.** At most 4 tracked enemies for prediction, at most 2 hazard
  probes per tick for evasion, at most `MAX_PRESSES_PER_TICK` presses.

---

## 11. Integration surface

Everything the build touches, and nothing else:

| Edit | What |
|---|---|
| `auto-heal-engine` | replaces the old engine block with the new one |
| deps | adds `Weapons`, `Projectiles`, `Config` to the injected tables (defect #1) |
| `autohat-handle-equip`, `autohat-next-hat` | `Autohat` reads the gear lock ahead of `forceHat` |
| `modulehandler-tick-reset` | clears `_ahGearLock` where `forceHat` is cleared |
| `settings-defaults`, `menu-autoheal-suboptions` | `_autoHealGear` and `_autoHealEvade`, both defaulting on |
| header | build name |

The two ownership guards already in the client are unchanged and still hold:
`AntiInsta`'s heal rule and `ShameReset` both return early while
`_autoHealEngine` is on, so nothing presses food or reaches for Bull alongside
the engine.

**Not touched:** Auto Place, Preplace, Replace, Spike Tick, Combat, Auto Mills,
Safe Soldier, Velocity Tick — read through the adapter, never written.

---

## 12. Settings

| Setting | Default | Effect |
|---|---|---|
| `_autoHealEngine` | on | the engine owns healing; the client's own heal paths stand down |
| `_autoHealWash` | on | the **manufactured** (bull) wash only. Natural credit recovery is not a toggle — it is the objective, and at full health it is free |
| `_autoHealStrict` | on | Strict Shame Guard: a charge leaves only to survive the tick |
| `_autoHealGear` | on | the defensive hat manager |
| `_autoHealEvade` | on | projectile micro-evasion |
| `_autoHealReserve` | 15 | the health floor the charge gate and the sustain target are drawn from |

---

## 13. Telemetry

`engine.telemetry` carries the decision and its arithmetic every tick: the
ranked threat list with timings, the shame count with its target, debt and how
long it has been owed, the verdict and ms-until-credit, the gear decision and
why, the evasion decision or the named refusal, the smoothed ping and reaction
window, and the full packet ledger including reservations. The numbers to watch:

- `shame` should be `0`; `debtTicks` should be small and falling;
- `charges` should only rise on ticks whose reason begins `survival:`;
- `packetsUsed` must never approach `packetLimit`;
- `override` shows the priority order being overridden by measured impact time.
