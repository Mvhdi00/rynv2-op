# RYN Client v5.4

`RYN_Client_v5.4.user.js` — the client as uploaded, with three changes.

1. [Autoheal](#autoheal) — novastorm's rule and nothing else
2. [Anti spike push](#anti-spike-push) — novastorm's `isNearestEnemyPushPlayer`, whole
3. [Velocity tick](#velocity-tick) — added from Glotus 5.5.5; RYN had none

---

## Autoheal

### What it was

RYN's autoheal already called itself "Novastorm's rule, whole", and the core of
it was. What sat on top were four guards novastorm does not have, in two files:

| Guard | Where | What it did |
| --- | --- | --- |
| `_healsInFlight()` | `AntiInsta` | Subtracted apples already on the wire, so the same missing health was not paid for on every tick of the round trip |
| `isSaveHealTime()` | `AntiInsta` | Held the routine top-up until 125ms (ping allowed for) had passed since the hit, because an apple inside 120ms raises shame instead of lowering it |
| `myPlayer.shameActive` | `AntiInsta` | Sent nothing while the server was refusing food anyway |
| `_shameHealQueue` + packet budget | `ModuleHandler.heal()` | Deferred an apple that would land inside the 130ms window rather than dropping it, and refused to send with fewer than 3 packets of budget left |

All four are gone, along with `isSaveHealTick`, `isSaveHeal`, `_healSent`,
`_rawHeal`, `_healBudgetLeft`, `_flushShameHealQueue` and `_SHAME_GUARD_MARGIN`.
149 lines out, 51 in.

### What it is now

Novastorm 15686 and, identically, X- Precision 14895 — the whole decision:

```js
if (currentHat == 6) totalDmgPot *= 0.75;
if (currentHat == 7) totalDmgPot += 5;
if (myPlayer.health <= totalDmgPot) healing = true;
if (((healing && myPlayer.shameCount < 7) || (tick - damageTick) > 0)
    && myPlayer.health < 100) heal(100 - myPlayer.health);
```

and the action, Novastorm 12747:

```js
function heal(value) {
    for (let i = 0; i < value; i += items.list[myPlayer.items[0]].heal)
        place(myPlayer.items[0], null);
}
```

Two branches with an OR between them and no third thing. `ModuleHandler.heal()`
is now the same shape: select food, swing, put the weapon back — unconditional.

**The number feeding the rule stays RYN's**, which is what "novastorm's rule,
RYN's logic" means here. `EnemyManager.potentialDamage +
potentialSpikeDamage` is already novastorm's `totalDmgPot`, summed from the
same five sources — spike contact, weapon hits in range and off reload, turret,
secondary, poison — so the rule is novastorm's and the estimator is RYN's.

One difference inside that estimator is worth knowing, because it is not a
guard and was left alone: novastorm's `spikeDmgPot` **adds** every spike
touching you, while RYN takes `Math.max(potentialSpikeDamage,
potentialSpikeKnockbackDamage)`. With two spikes on you, novastorm's number is
the larger of the two and heals sooner.

### What was kept, and why

**Anti Smart Tick.** Its branch sits ahead of the rule, unchanged. It has its
own toggle (`_antiSmartTick`), and it is not a heal decision — it is a refusal
to break out of a trap into a spike, where eating is what it does with the tick
instead. Deleting the autoheal around it would have silently switched off a
labelled feature. Say the word and it goes too.

**Three couplings the rest of the client reads.** `ModuleHandler.healedOnce`
(auto grind and the module handler both check it), `ModuleHandler.didAntiInsta`
(the UI's fast-Q indicator), and `this.blockBreak = false` at the top of
`postTick` (autoBreak reads the latch on the following tick). All still set.

### Verifying it

```
node harness/heal-duel.js
```

The port's acceptance test is that it becomes **indistinguishable from X-
Precision**, since both are now the same rule. It is:

```
  totals across every row
  client         apples   packets   wasted      shame locks  deaths
  X-             2676     10704     1815 (68%)  30           108
  RYN (was)      1230     4920      300 (24%)   6            96
  RYN (ported)   2676     10704     1815 (68%)  30           108

  RYN (ported) matches X- on every row — the rule is novastorm's, with nothing on top
```

The middle row is what was deleted, priced. Those guards were worth 1,446
apples and 5,784 packets across the three fights, and 24 of the 30 shame locks.
That is the cost of the change, and it is deliberate: novastorm pays it too.

---

## Anti spike push

### What it was

RYN's `AntiSpikePush` tested a different geometry and a different weapon state
from novastorm's. Six differences, every one of them now gone:

| RYN tested | Novastorm tests |
| --- | --- |
| `EnemyManager.pushingOnSpike` — a spike within **25 of me** | a spike within `35 + spike.scale + trap.scale` **of the trap I am standing in** |
| `!EnemyManager.collidingSpike` — not touching a spike | `spikeDmgCount < 1` — no spike damage landed last tick |
| `!nearestEnemy.isTrapped` — they are not trapped by anyone | no trap of **mine or an ally's** within 50 of them |
| `range + nearestEnemy.hitScale` | `35 * 1.8 + range` — **my** hit scale |
| waited for `primaryReloaded` before committing | commits regardless; the swing is simply held |
| `forceHat = 53`, turret gear | hat 7 |

### What it is now

`isNearestEnemyPushPlayer()`, Novastorm 14227 and — identically, byte for byte —
X- Precision 13344:

```js
if (!nearestEnemy) return false;
if (visibleObjects.filter((o) => o.id == 15 && dist(nearestEnemy, o) <= 50
    && (o.owner.sid == myPlayer.sid || isAlly(o.owner.sid)))[0]) return false;

if ((nearestTrap && spikeDmgCount < 1)
    && (myPlayer.weapons[0] == 6 || myPlayer.weapons[0] == 7)) {
    const nearestSpike = enemySpikes.sort((a, b) =>
        dist(myPlayer, a) - dist(myPlayer, b))[0];
    if ((nearestTrap && nearestSpike)
        && dist(nearestSpike, nearestTrap) <= (35 + nearestSpike.scale + nearestTrap.scale)
        && dist(myPlayer.x2, myPlayer.y2, nearestEnemy.xVel, nearestEnemy.yVel)
           <= (35 * 1.8 + items.weapons[myPlayer.weapons[0]].range)) {
        antiPushAngle = atan2(nearestEnemy.y2 - myPlayer.y2, nearestEnemy.x2 - myPlayer.x2);
        return true;
    }
}
return false;
```

You are standing in their trap, an enemy spike sits against that trap, and you
hold a bat or daggers — the two knockback primaries. One push and you are on the
spike, so hit **them** first: the knockback moves them out of pushing range
before they can line it up.

Three quantities novastorm reads off its own globals are rebuilt from RYN's
world, and each is the same quantity:

| Novastorm | RYN |
| --- | --- |
| `spikeDmgCount` | kept in the module, from "damage landed this tick" + "a spike is touching me" |
| `enemySpikes` (`id > 5 && id < 10`) | `itemGroup === 2` — verified to be exactly ids 6–9 |
| `xVel` / `yVel` (`x2 * 2 - lastX`) | `pos.future` = `current + (current - previous)`, literally the same |

### Verifying it

```
node harness/antipush-duel.js
```

Both sides are lifted out of the shipped files with `vm`, so this compares the
**real code** — nothing is transcribed. All 96 combinations of the six inputs
are staged in each client's world shape and the verdicts must match:

```
  scenes      96
  agree       96 (100.0%)
  disagree    0
  novastorm fires on  2 of 96

  gate flipped              novastorm   ryn       gate is live
  (nothing — the scene)     fires       fires     —
  trapped -> false          declines    declines  yes
  spikeByTrap -> false      declines    declines  yes
  primary -> 5              declines    declines  yes
  enemyNear -> false        declines    declines  yes
  spikeDmg -> 1             declines    declines  yes
  theirsPinned -> true      declines    declines  yes
```

The second table is there because agreement across 96 scenes where only 2 fire
could be agreement on "no". Flipping each gate on its own away from the scene
that does fire proves every one is carrying weight on both sides, rather than
being absent from both.

### One loose end

`EnemyManager.pushingOnSpike` (declared 2581, set 2867) now has no reader. It is
three lines inside a loop that is already walking those objects, so it costs
almost nothing, and removing shared manager state is a separate decision from
this one — but it is dead, and it should not stay dead silently. Say so and it
goes.

---

## Velocity tick

RYN had none. It has a full `MotionTracker` — measured velocity, stability,
confidence, six ticks of lookahead — but no velocity tick built on it. This is
Glotus 5.5.5's `VelocityTick`, ported whole.

Glotus and RYN are the same architecture (module classes with `postTick`,
`ModuleHandler`, `EnemyManager`, `Settings_default`), so every primitive the
module needs already existed and nothing had to be reinvented: `moveTo`,
`shouldIgnoreModule()`, `getWeaponVariant().current`, `reloading.isReloaded`,
`atExact`, `futureHat`, and the `inRange` helper.

### The move

Two ticks, and the second is the point:

| | |
| --- | --- |
| **ARM** | at 220–245 from where they will be, wear turret gear (53) and set `moveTo` toward them. The turret's range is 700, so the shot lands from here |
| **FIRE** | next tick: hat 7, polearm, swing along the same angle — still walking |

**The window is the trick, and it is not a range check.** 220–245 is where the
turret's knockback leaves them after the shot. Closer and the shot pushes them
out of the polearm's 142 before the swing; further and the walk cannot close it.

**`moveTo` is what makes it work.** Copying the window without the walk is the
mistake that leaves only the turret landing — the distance never closes and the
polearm swings at nothing. The duel checks for it explicitly.

`canSend` is Glotus's read of whether the moment is worth spending: either their
melee is one tick off reloaded (`atExact(type, 1)`, so they are committed and
cannot dodge) or their predicted hat is one they can be hurt through —
`isValidHat` rules out hat 6 (soldier, eats the damage) and hat 22 (eats the
knockback the window depends on).

### Two decisions worth knowing

**Off by default** (`_velocityTick: false`). It is new to this client, it moves
you, and it commits a turret shot — none of which should start happening because
the client was updated. The toggle is in Combat → Instakills, next to Auto sync,
and there is a counter in Devtool → Statistics.

**Glotus's ANTI velocity tick is not ported.** `Player.velocityTicking` and
`EnemyManager.velocityTickThreat` are the flags Glotus raises when someone does
this to *you*. Same page in Glotus, separate feature; say the word if you want it.

### Verifying it

```
node harness/velocity-duel.js
```

Both classes are lifted with `vm` and driven by **one** stub client, so nothing
is transcribed and neither side sees a world the other did not:

```
  scenes                  768
  agree on all 3 signals  768 (100.0%)
  disagree                0

  gate flipped                glotus      ryn         gate is live
  (nothing — the scene)       fires       fires       —
  primary -> katana           declines    declines    yes
  variant -> gold             declines    declines    yes
  primary not reloaded        declines    declines    yes
  turret not reloaded         declines    declines    yes
  dist 260, past the window   declines    declines    yes
  dist 200, short of it       declines    declines    yes
  canSend (both halves)       declines    declines    yes
  their hat is soldier        declines    declines    yes
  shouldIgnoreModule          declines    declines    yes

  glotus walks on the firing tick   true
  ryn walks on the firing tick      true
```

One thing the harness had to get right to test this at all: the real
`ModuleHandler.postTick` resets `moveTo` to `"disable"` every tick (17332). Without
the stub doing the same, tick two bails on the module's own
`moveTo !== "disable"` guard and the FIRE step is never exercised — the run
would pass while testing half the feature.

---

## Spike tick: why it fires and no spike appears

Investigated, **not fixed** — because two plausible causes were measured and
both turned out to be wrong, and a third guess is not worth shipping.

### The one thing that is certainly wrong

`_spikeTick: false` is the master gate, and it ships **off**, while all three
sub-toggles ship **on**:

```js
_spikeTick: false,
_spikeTickBreak: true,
_spikeTickNear: true,
_spikeTickTrap: true,
```

`spikeTickTarget()` returns `null` on its second line when the master is off, so
Break, Near and Trap are all inert. In the menu the three sit in a
`<div class="sub-options">` under an unchecked parent — so the panel shows three
switches ON that do nothing. **Turn on "Spike Tick" first.**

### Two hypotheses, both measured, both wrong

`node harness/spike-tick-angles.js` runs the real geometry — `GeometrySolver`,
`CandidateGenerator` and `anglesFor` lifted from the file with `vm`.

**Wrong #1: "`anglesFor` never offers an angle that touches the enemy."** It
offers the direct line (when free), aperture edges, and wide-aperture midpoints,
and never calls `GeometrySolver.contactAngles` — which `AngleSolver.propose`
uses and calls *"the ones that touch the target"*. Adding contact angles moved
the rate **49.3% → 49.6%**. Nothing. Whatever blocks the direct line blocks its
neighbourhood too, so the contact angles are illegal in exactly the cases where
they would have helped.

**Wrong #2: "the controller takes `angles[0]` and ignores the other two."** It
does take only `angles[0]` (`_acquire` step 4, `{ limit: 3 }`), and `_validate`
then demands that spike reach the target — two different questions. But:

```
  overall                 takes angles[0]  best of the 3   any legal angle
                          64.2%            64.2%           64.2%
```

Identical. `anglesFor` sorts by proximity to the aim and the contact window is
centred on the aim, so if any offered angle reaches, the nearest one already
does. `angles[0]` is the best of what is on offer.

### What the rate actually tracks

How crowded your own ring already is — 100% with nothing around you, ~23–36%
with four spikes already placed. That is real geometry: a spike needs 76.6° of
clear ring at this radius, so four of them leave almost nothing legal that also
reaches. Not a bug.

### What was ruled out by reading

* **Ordering** — `EnemyManager.handleEnemies` (which sets
  `nearestSpikePlacerAngle`) runs before `ModuleHandler.postTick`, so the field
  is fresh when the modules read it.
* **Staleness** — the controller's phase machine runs PREPARE → VALIDATE →
  EXECUTE within one tick via recursive `postTick()`, so `selfMoved` and
  `targetMoved` compare an intent against the same tick that made it. Drift is
  zero on the normal path.
* `attemptSpikePlacement()` is only the fallback for when no controller exists;
  the live path is `spikeTickController.arm()`.

### The conflict, found and reproduced

`node harness/spike-tick-trap.js` drives the trap combo over **both** its ticks,
with `spikeTickState`, `spikeTickCounterThreat`, `spikeTickNearSpike`,
`spikeTickTarget`, `spikeTickHit`, `spikeTickTurret`, `SpikeTickTrap`,
`SpikeTickBreak` and `SpikeTickController` all lifted from the file. Only the
world is staged.

**The combo itself is sound.** Given a clean tick it hammers on tick 1
(`forceWeapon 1`, `forceHat 40`) and commits a spike on tick 2. So the problem
is not the combo — it is that it rarely gets to start:

```
  precondition removed              hammer tick  spike
  an enemy spike within reach       no           none
  ...same, but autobreak off        swings       placed
```

The gate is **`spikeTickNearSpike`**, at the top of `spikeTickTarget`:

```js
const spikeTickNearSpike = client2 => {
  if (!Settings_default._autobreak) return false;     // only armed when autobreak is on
  const spike = EnemyManager2.nearestSpike;
  if (spike === null) return false;
  const reach = spike.scale + Math.min(weapon.range, SPIKE_TICK_NEAR_SPIKE_REACH);
  return myPlayer.collidingSimple(spike, reach);
};
```

```js
if (spikeTickCounterThreat(client2, state) || spikeTickNearSpike(client2)) return null;
```

Its radius is `spike.scale + min(primaryRange, 75)` = **124 around you**, and
any enemy spike inside that cancels **every** spike tick variant before it
starts. It is a deliberate rule — it stops the tick fighting autobreak for the
same tick — but it does not know what it is cancelling, and an enemy pinned in a
trap is nearly always standing beside their own spikes. That is the conflict.

**Two ways out, neither applied** (both change combat behaviour, so they are
yours to call):

1. Turn `_autobreak` off — the suppressor disarms itself and the trap tick
   works. Costs you autobreak.
2. Narrow the rule so it does not apply to the trap variant. When they are
   pinned, the spike beside their trap is the thing you are exploiting, not an
   obstacle. One line, and the bench above measures it either way.

### A conflict that turned out not to cost a spike

`SpikeTickTrap`'s second tick is guarded by `if (!ModuleHandler.moduleActive)`,
and clears `this.target` *before* that check — so anything claiming the tick
first destroys the combo rather than delaying it. `spikeTickBreak` runs earlier
in the module order and its trigger is `deletedObjects`, which on tick 2 holds
the very trap you just hammered. It does steal the tick. But it then arms the
controller itself, so a spike still goes out — row B of the bench: **1 spike
either way.** What is lost is the trap variant's turret follow-up, not the
spike.

### What was shipped earlier: the counter

The controller already records why it stands down — `lastReason`, and
`stats {armed, consumed, requested, executed, replanned, cancelled, lost}` — and
threw all of it away. It now reports, in **Devtool → Statistics → "Spike tick
placed/armed"**:

```
3/47  (outOfReach 28, noGround 11, outranked 5)
```

Every arm ends in exactly one outcome, so `armed` equals the sum and the ratio
is readable rather than guessed at. Play one round with Spike Tick on and that
line names the gate. Suppressors worth suspecting, none of them measured:
`spikeTickNearSpike` (any enemy spike within your primary's reach cancels the
tick, and `_autobreak` is on by default), `SPIKE_TICK_TRAP_GRACE` (3 ticks after
leaving a trap), and `spikeTickCounterThreat`.

---

## Verifying the whole set

```
node harness/ryn-changes-check.js      # 42 checks over every change
python3 harness/ryn-changes-mutate.py  # proves those checks can fail
```

`node --check` validates **syntax only**. It will not notice a call to a helper
the edits deleted, an identifier that resolves nowhere, or a UI id no element
carries — which are exactly the mistakes this kind of editing makes, and the
client cannot be booted here to find them. So the checker closes that gap four
ways:

| | |
| --- | --- |
| **EXECUTE** | every changed block lifted with `vm` and actually run against stubs, so a `ReferenceError` inside it surfaces |
| **RESOLVE** | every identifier the new code reads from an outer scope confirmed declared |
| **WIRE** | settings, module registration, run-order slot and UI ids confirmed present and consistent — including that every one of the 67 `staticModules` constructors names something real |
| **NO GHOSTS** | each of the 12 deleted helpers confirmed to have no surviving reader |

**And the checker is itself tested.** `ryn-changes-mutate.py` breaks the client
ten different ways — heal presses once instead of per restore, `velocityTick`
dropped from the run order, a deleted helper called again, the Devtool span
renamed, the `VelocityTick` class renamed while still registered — and requires
the checker to go red on every one. It catches 10 of 10.

That last one mattered: the first version of the class-existence check used
`indexOf("class VelocityTick")`, which still matched after the class was renamed
to `VelocityTickX`, so the mutation passed a green checker. Both the check and
the general "every registration names a real constructor" check came out of
that. The `check()` contract was tightened for the same reason — it used to
treat any returned string as a pass, so one check printed *"still read
somewhere"* next to an `ok`.

## What is not verified

**The client does not boot in this harness**, and did not before any of these
changes — `boot-check.js` reports `Cannot read properties of null (reading
'appendChild')` in all four SDK states for both the pristine upload and this
file, identically. RYN builds DOM the mock page does not provide.

So nothing here is verified by playing. What is verified: syntax, that each
changed block runs, that every identifier resolves, that the wiring is
consistent, that no deleted helper is still called, and — through the three
duels — that autoheal matches X- Precision's numbers, anti spike push agrees
with novastorm on all 96 scenes, and velocity tick agrees with Glotus on all
768. The live server is still the untested part.
