# RYN Client v5.4

`RYN_Client_v5.4.user.js` — the client as uploaded, with nine changes.
The spike tick has a document of its own: [`SPIKE_TICK.md`](SPIKE_TICK.md).

1. [Autoheal](#autoheal) — novastorm's rule and nothing else
2. [The automatic Q](#the-automatic-q) — food is no longer pressed into the shame rule
3. [Anti spike push](#anti-spike-push) — novastorm's `isNearestEnemyPushPlayer`, whole
4. [Velocity tick](#velocity-tick) — added from Glotus 5.5.5; RYN had none
5. [Spike tick](#spike-tick) — rebuilt as a timing module; see `SPIKE_TICK.md`
6. [Knockback tick](#knockback-tick--hit-them-onto-a-spike) — added from Glotus; RYN had the trap half only
7. [Automill](#automill--the-ragged-wall) — the whole trio or none, fixing the ragged wall
8. [Blood Wings](#blood-wings-while-standing-still) — no longer forced while standing still
9. [Bot names](#bot-names) — one name for all of them, optionally numbered

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

Two branches with an OR between them and no third thing, and that is the whole
decision — nothing was added back to it. `ModuleHandler.heal()` is the same
three sends, select food, swing, put the weapon back, behind the two questions
in [The automatic Q](#the-automatic-q) below: those are about whether the server
will *count* the press, never about whether to heal.

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

The port's acceptance test is that the **decision** is indistinguishable from
X- Precision's, since both are now the same rule:

```
  totals across every row
  client         apples   packets   wasted      shame locks  deaths
  X-             2676     10704     1815 (68%)  30           108
  RYN (was)      1230     4920      300 (24%)   6            96
  RYN (ported)   2676     10704     1815 (68%)  30           108
  RYN (now)      1698     6792      860 (51%)   2            112
```

`RYN (was)` is what was deleted, priced: those four guards were worth 1,446
apples and 24 of the 30 shame locks. `RYN (now)` is the section below.

---

## The automatic Q

The bare rule above pressed food on 22–40% of all ticks and took 30 shame locks
across the bench. In play that reads as Q being held down, and shame in seconds.
This is the fix, and it is measured in `harness/auto-q.js`.

### Why the bare rule runs away

The whole cause is ten lines of the game's own server code, which X- Precision
ships verbatim at 18516:

```js
if (this.hitTime) {
    var timeSinceHit = Date.now() - this.hitTime;
    this.hitTime = 0;                    // only the FIRST food after a hit
    if (timeSinceHit <= 120) {           // is ever judged
        this.shameCount++;
        if (this.shameCount >= 8) { this.shameTimer = 30000; this.shameCount = 0; }
    } else {
        this.shameCount -= 2;
    }
}
if (this.shameTimer <= 0) worked = item.consume(this);   // <- AFTER
```

Two consequences, and between them they are the entire bug:

1. **The shame arithmetic runs above the refusal.** Food sent during the 30
   second lock is thrown away *and still counted*, so it can take the count back
   to 8 and re-arm another 30 seconds. And since nothing lands, `tempHealth`
   never rises, so `tempHealth < maxHealth` stays true and the rule asks again
   next tick — for thirty seconds. That is the Q that never lets go: 1,095 of
   the bench's food presses were spent inside a lock.
2. **Only the first food after each hit is judged.** In a fight that is the
   *emergency* press, which goes out on the tick the health drop is seen, about
   one tick plus a round trip after the hit. On a good connection that is inside
   120ms, so it is +1 shame per hit instead of −2. Eight of those is a lock.

RYN's client-side `shameCount` mirror can't see any of this: it only counts when
health is observed to **rise** (3431), and during a lock health never rises. So
the client thinks its count is low the whole time the server is re-arming.

### The fix

Two questions, both inside `ModuleHandler.heal()` — which is where *every*
automatic food press in the client goes through, so they cover the novastorm
rule, anti sync and anti smart tick alike. Neither changes **which ticks decide
to heal**; the decision above is untouched.

```js
if (myPlayer && myPlayer.shameActive) return;   // the food cannot be eaten
if (!this._foodIsShameSafe()) return;           // ...and would be counted
```

`_foodIsShameSafe()` asks what the server will measure: the press leaves now and
lands half a round trip later, and the hit happened half a round trip before the
client saw it, so the figure is `(Date.now() - myPlayer.receivedDamage) + pong`,
against `SHAME_SAFE_WINDOW = 125`. Two details that are not decoration:

* **It gives up after one tick.** Under damage every tick the window never
  opens, because `receivedDamage` is refreshed faster than it closes. A guard
  that waits forever is a guard that stops you eating — measured: at ping 30 and
  100 the wait-forever variant never eats at all and dies 40 times.
* **It answers once per tick and remembers.** `Date.now()` moves while a tick
  runs, and `heal(100 - health)` asks four times. Without the memo the window
  could open between two of those calls and the heal would go out in pieces.

`receivedDamage` is cleared the moment health is seen to rise, which is the same
moment the server clears `hitTime` — so a press following one that already
landed is never held. The guard only ever delays the press the server judges.

### What was measured, including four things that did not work

```
node harness/auto-q.js
```

The row marked `<-` is not a description of the client, it *is* the client:
`_foodIsShameSafe` is lifted out of the file and asked the same question on the
same ticks.

```
  guards                   apples   refused   judged +1  judged -2  locks   deaths
  v5.4 as shipped          2676     1095      294        231        30      108
  lock                     1716     30        102        231        6       96
  window, bypass           2676     1095      294        231        30      108
  lock + bypass            1716     30        102        231        6       96
  lock + wait forever      1628     10        34         267        2       112
  lock + wait unless held  1716     30        102        231        6       96
  lock + wait 1 tick       1698     10        48         267        2       112
  RYN v5.4 now  <-         1698     10        48         267        2       112
```

* **`window, bypass` is inert** — identical to shipped on every row. Letting an
  emergency press through defeats the guard completely, because the shaming
  press *is* the emergency press. This was my first design, and the table
  killed it.
* **`lock + wait forever` starves**, as above.
* **`lock + wait unless held`** — skip the wait when hits land on back-to-back
  ticks — collapses straight back to the lock guard, because a burst *is* three
  consecutive ticks of damage. It does not separate a burst you survive from a
  spike you do not.
* **`lock` alone** is safe and good (30 → 6 locks, and fewer deaths) but leaves
  the counting-up untouched.

### The cost, stated plainly

Deaths across the whole table go **up by 4**, and every one of them is on the
third fight — 12 damage every single tick, no gap, ever, where every candidate
in the table dies about once a second. On the two fights anyone survives, deaths
are unchanged, shame is **zero at ping 30 and 100**, and it eats *more* than
before, not less.

At a 200ms round trip the guard stops helping on the burst fight — not because
of a bug, but because the hit it aims away from is already stale: the server has
taken a newer one that this client will not see for another half trip, and the
newest is what the server measures. It stops helping there rather than starting
to hurt.

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

### The trap sub-toggle — `_velocityTickTrap`

Added on top of the port, off by default, sitting under Velocity tick in
Combat → Instakills.

**Why the window can be relaxed for a pinned target, and only for one.** 220–245
is not a range check — it is where the turret's knockback leaves them after the
shot, which is why it has both a floor and a ceiling. A target standing in a
trap **cannot be knocked anywhere**, so for them the window has nothing left to
describe, and anything inside 200 is worth the combo.

Their own trap does not count. Being pinned by someone else does not stop them
being pushed out of your polearm's way, so the branch checks who owns the trap:

```js
_pinnedInMyTrap(nearestEnemy) {
  if (!Settings_default._velocityTickTrap) return false;
  const trappedIn = nearestEnemy.trappedIn;
  if (!trappedIn) return false;
  return !PlayerManager2.isEnemyByID(trappedIn.ownerID, myPlayer);
}
```

**It widens the condition, it does not replace it:**

```js
const inAttackRange = inRange(dist1, this.minKB, this.maxKB) ||
  pinned && dist1 <= VELOCITY_TICK_TRAP_RANGE;
```

The first version replaced the window, and the duel caught it: a pinned enemy at
232 is *still in the knockback window*, and replacing the test threw that shot
away. The check `the trap branch widens the window rather than replacing it`
exists so that cannot come back.

Everything else about the combo is untouched — polearm, diamond variant, both
reloads, `canSend`, `shouldIgnoreModule`. A soldier hat still calls it off.

```
  case                                expected    ryn         glotus
  120 away, in my trap                fires       fires       declines
  180 away, in my trap                fires       fires       declines
  232 away, in my trap                fires       fires       fires
  120 away, in my trap, toggle off    declines    declines    declines
  120 away, in THEIR trap             declines    declines    declines
  120 away, not trapped               declines    declines    declines
  120, in my trap, soldier hat        declines    declines    declines
```

Glotus's column shows what the sub-toggle adds. Every row where they differ is
a shot Glotus does not take, and there is no row where Glotus fires and RYN does
not — and with the toggle off, the 768-scene match is untouched.

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

## Spike tick

Removed entirely one change ago, then rebuilt as a **timing** module rather than
a placer. The whole design, the geometry it has to obey and the measurements are
in [`SPIKE_TICK.md`](SPIKE_TICK.md); the short version:

* A build always lands on your own ring at the angle you face, so the only
  decision available is **one angle**. The old controller tried to be a fourth
  placer and lost every contest to auto place's hard reservations, because
  `PlacementLedger.blocked()` returns on `!e.soft` before priority is read.
* The new `SpikeTick` never reserves ground of its own. It reads what auto
  place, preplace and replace have already done — standing objects,
  `ledger.entries`, `book.pending()` — and classifies the moment:
  **CONTACT** (a spike is already touching them: swing, spend nothing),
  **COVERED** (one is coming: swing, do not pay twice), **OPEN** (nothing
  reaches and an angle is free: ask the engine, and swing only if the send went
  out).
* It uses `engine.motion` for prediction and `engine.anglesFor` for angles, and
  builds neither of its own.
* It absorbs `SpikeSync`, whose gate — a rising edge on the reaching-angle set
  **and** an object destroyed in the same frame — almost never opened.
  `SpikeSyncHammer` keeps its trigger and delegates the execution.
* Off by default (`_spikeTick`), with `_spikeTickTrapped` and `_spikeTickFree`
  under it. Devtool → Statistics → "Spike tick swung/armed".

```
node harness/spike-geometry.js   # what the game's own rules allow
node harness/spike-tick.js       # the class itself, lifted and run: 26 rows, 5 properties
```

## Knockback tick — hit them onto a spike

RYN had `TrapKB`, which hits enemies so the knockback carries them into a
**trap**. The **spike** half was missing. This is Glotus 5.5.5's
`KnockbackTick`, ported whole; off by default, in Combat → Instakills.

**The port was three-quarters already done.** `EnemyManager` derives
`nearestEnemySpikeCollider` and `spikeCollider` in code that is byte for byte
Glotus's (2923) — the enemy standing on the far side of a spike from you, and
the spike a hit would drive them onto — and **nothing read either field.** Same
situation as `pushingOnSpike`: computed every tick and thrown away.

The pick is not "nearest spike". It keeps the pair whose angle from you to the
spike best lines up with the angle from them to the spike:

```js
const intersecting = angleDistance <= offset;                  // spike is behind them
const overlapping  = distanceToTarget <= distanceToSpike1;     // they are nearer than it
const inRange2     = KBDistance !== 0 && target.collidingObject(object, KBDistance);
```

### The reach test is a budget, not a range

```js
const knockback = primaryKnockback + 60;                       // 60 is the turret's
const collisionScale = spike.collisionScale + enemy.collisionScale;   // 84
const isPrimaryEnough = distanceToSpike <= collisionScale + primaryKnockback;
if (distanceToSpike <= collisionScale + knockback) { ...swing... }
```

If the gap fits inside the primary's own knockback, one swing does it. If it
only fits once the turret's ~60 is counted, the swing goes now and the turret
follows on the next tick — that is what `useTurret` latches. Weapon knockback in
RYN: daggers 44.4, polearm 55.6, **bat 111.1**, which is why bat and daggers are
the weapons this is worth holding.

### Verifying it

```
node harness/knockback-duel.js
```

Both classes lifted with `vm`, one stub client, nothing transcribed:

```
  case                                  ryn                       glotus
  daggers, gap 100 — primary alone      swings                    swings
  daggers, gap 150 — needs the turret   swings + turret next      swings + turret next
  daggers, gap 250 — out of budget      declines                  declines
  bat, gap 150 — primary alone          swings                    swings
  bat, gap 240 — needs the turret       swings + turret next      swings + turret next
  they are already trapped              declines                  declines
  no spike behind them                  declines                  declines
  primary not reloaded                  declines                  declines
  another module has the tick           declines                  declines

  rows 12   agree 12   swings on 5
```

The duel drives **two** ticks and checks the follow-up separately, because that
is the half a port loses quietly: the swing still lands either way, and a
missing latch shows only as the enemy stopping just short of the spike. A
standing check asserts the latch, and a mutation that deletes it goes red.

**Not ported:** Glotus's other two variants, `KnockbackTickHammer` and
`KnockbackTickTrap` (break a trap, then knock them onto a spike). Say the word.

---

## Automill — the ragged wall

Reported as building one mill in one place, two in another, three somewhere
else. It is not a heading bug and it is not the geometry: **it is the policy for
when one of the three does not fit.**

The trio spacing is identical in RYN and Glotus, to the character:

```js
const offset = Math.asin((2 * item.scale + 9e-13) / (2 * distance)) * 2;
```

The whole difference was the next few lines:

| | |
| --- | --- |
| **Glotus** | `if (canPlace(a) && canPlace(l) && canPlace(r)) { place(a); place(l); place(r); }` — all three, or none |
| **RYN (was)** | gate on the centre, then `for (...) { if (!canPlace(a)) continue; place(a); }` — whatever fits |

RYN's was novastorm's shape (13805), and the comment defended it: requiring all
three means one rock behind you cancels the row. True, and it is the smaller
problem — because a partial row is exactly a wall of 1 here, 2 there and 3
somewhere else, **and each straggler becomes a blocker for the next tick's
trio, so the raggedness compounds.**

`node harness/automill-shape.js` walks a player 60 ticks past scattered rocks
under both policies, adding each mill to the world as it lands:

```
  policy                      mills total   placing ticks   uneven
  whatever fits (RYN was)     3218          1423            60.7%
  all three or none (Glotus)  1854          618             0.0%
```

**60.7% of the ticks that placed anything placed a partial row.** That is the
symptom, measured.

Now Glotus's rule, plus one thing Glotus does not do: the packet budget is
checked for the whole trio rather than per mill, since sending two of three
because the counter ran out is the same ragged row by another route.

Losing a row to a rock costs little — automill runs every tick, and one tick
later you are ~25 units further on, where the trio usually fits. Fewer mills,
all of them in straight rows.

### Still reported broken — what the measurement says

Reported again: *going right it places one mill and not the rest, with nothing
blocking.* Four more theories were measured and **all four were wrong**:

| theory | file | verdict |
| --- | --- | --- |
| the exact spacing solve + floating point | `automill-spacing.js` | 3 mills at all 360 headings |
| the placement ledger rejecting siblings | `automill-ledger.js` | 3 mills at all 360 headings |
| `GeometrySolver.norm` rewriting the angles | `automill-ledger.js` | margin survives: 9.09e-13 → 7.67e-13 |
| the spacing being too tight (novastorm's is wider) | `automill-apertures.js` | identical behaviour |

What the current code actually does, measured through the real
`CandidateGenerator.apertures` and `GeometrySolver` while walking
(`automill-apertures.js`):

```
  heading      mills   ticks placing  per-tick pattern
  right        9       3 of 12        3 0 0 0 3 0 0 0 3 0 0 0
  down         9       3 of 12        3 0 0 0 3 0 0 0 3 0 0 0
  left         9       3 of 12        3 0 0 0 3 0 0 0 3 0 0 0
  up           9       3 of 12        3 0 0 0 3 0 0 0 3 0 0 0
```

**Identical at every heading, and never 1.** A row of 3 or nothing — which is
what atomic placement means. The "one mill" pattern is what the *previous*
per-angle policy produced, so that report describes the pre-fix build.

And the reason for the gaps is geometry, not a bug. A windmill is 45 on a ring
of 85, so **one existing mill occludes 128° of your own ring** — a third of it.
Your last row is the blocker:

```
  tick 1 open ring      100.0%   placed 3
  tick 2 open ring      39.7%    placed 0   legal: false, false, false
  tick 3 open ring      49.5%    placed 0   legal: false, false, false
```

One step of 25 does not clear a row that is 270 wide. A row every ~4 ticks is
the ceiling, and Novastorm and Glotus hit the same one.

### Telling the two remaining possibilities apart

If mills are still missing in a real game, the client and the server disagree
about what was legal — and from outside, "the client sent one" and "the client
sent three and two were refused" look the same. So automill now reports what it
**sent**, in Devtool → Statistics → **Automill**:

```
7 rows, 21 mills sent
```

Count the mills on the ground against that. Matching means the client is
placing exactly what you see and the pattern above is what you have. Fewer on
the ground means the loss is on the wire, which is a different fix entirely.

### A wrong turn worth recording

The first theory was floating point. The spacing solve is exact —
`2·R·sin(asin(r/R)) = 2r` for any R — so the mills sit *exactly* touching and
the `9e-13` buys about 8.8e-13 of daylight, which is the same order as the
rounding error in `cos(θ)·R`. That predicts a heading-dependent count, which
matched the report closely.

It is wrong. `automill-spacing.js` sweeps all 360 headings through the client's
real `PlacementLedger` and gets **three mills at every one** — the coordinate
error is correlated between the two points being compared, so it cancels. The
file is kept because the theory is a natural one to have and the sweep is the
thing that settles it.

---

## Blood Wings while standing still

`DefaultAcc.getBestCurrentAcc` carried an explicit branch:

```js
if (!ModuleHandler.isMoving && myPlayer.speed <= 5) {
  if (beAngel) return 13;
  if (useBloodWings) return 18;      // <- Blood Wings, just for standing still
}
```

Removed. Nothing about being stationary calls for a different accessory, and
the `beAngel` line below it already covers the bot case, so the whole block was
redundant once Blood Wings came out. Standing still now takes the ordinary
path.

The two legitimate Blood Wings branches are untouched: with the bull helmet
active, and behind the `_cowboyWhenSafe` toggle. A standing check asserts
exactly that — idle branch gone, those two kept — and a mutation putting it
back goes red.

---

## Bot names

Every bot used to need a name typed into its own row — or a dice roll, or
whatever `Ryn` placeholder was sitting there. The Bots page now has two things
next to **Auto random bot names**:

| | |
| --- | --- |
| **Name bots** | type one name; every bot you add connects as that |
| **Number them (1, 2, 3…)** | appends the bot's number: `Ryn1`, `Ryn2`, `Ryn3` |

**It prefills each row's own input rather than opening a second path.** The
connect button already reads that field and nothing else:

```js
const botName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : "";
...
player._botCustomName = botName;
```

so one shared name flows down the path that already worked, and every row stays
editable — a single bot can still be renamed by hand before connecting.

Precedence: a typed shared name beats the random-name switch; with the field
empty, everything behaves exactly as before.

`_numberedBotName` trims the base so the digits always survive moomoo's 15
character cap — `ExactlyFifteenX` with 100 bots gives `ExactlyFifte100`, not a
name whose number fell off the end.

### Verifying it

```
node harness/bot-names.js
```

The prefill block and `_numberedBotName` are lifted from the client, so this
runs the real rule:

```
  name typed, numbering off       Ryn, Ryn, Ryn, Ryn
  name typed, numbering on        Ryn1, Ryn2, Ryn3, Ryn4
  name with spaces, numbered      King1, King2, King3, King4
  no name, random names on        RND, RND, RND, RND
  no name, nothing on             (blank), (blank), (blank), (blank)
  name set, random also on        Ryn, Ryn, Ryn, Ryn
```

---

## Verifying the whole set

```
node harness/ryn-changes-check.js      # 58 checks over every change
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
| **WIRE** | settings, module registration, run-order slot and UI ids confirmed present and consistent — including that every one of the 63 `staticModules` constructors names something real |
| **NO GHOSTS** | each of the 12 deleted helpers confirmed to have no surviving reader |

**And the checker is itself tested.** `ryn-changes-mutate.py` breaks the client
23 different ways — heal presses once instead of per restore, `velocityTick`
dropped from the run order, a deleted helper called again, the Devtool span
renamed, the `VelocityTick` class renamed while still registered, `heal()`
pressing food through the shame lock again, the food guard waiting for the
window forever or answering twice in one tick, a spike tick module registered
again — and requires the checker to go red on every one. It catches 23 of 23.

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
