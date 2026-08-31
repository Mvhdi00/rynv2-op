# RYN Client v5.4

`RYN_Client_v5.4.user.js` — the client as uploaded, with two changes. Both are
the same change in spirit: a system RYN had reworked is put back to what X-
Precision and Novastorm actually run, expressed in RYN's own idiom.

1. [Autoheal](#autoheal) — novastorm's rule and nothing else
2. [Anti spike push](#anti-spike-push) — novastorm's `isNearestEnemyPushPlayer`, whole

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

## What is not verified

**The client does not boot in this harness**, and did not before either change —
`boot-check.js` reports `Cannot read properties of null (reading 'appendChild')`
in all four SDK states for both the pristine upload and this file, identically.
RYN builds DOM the mock page does not provide.

So both changes are verified by `node --check`, by a dangling-reference sweep,
by reading every removed line, and by the two duels — the autoheal one against a
transcription, the anti-spike-push one against the shipped code itself. Neither
is verified by running the client in a game.
