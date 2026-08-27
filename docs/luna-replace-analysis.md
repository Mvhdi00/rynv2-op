# Luna Client 1.1.1 — Replace implementation analysis

File: `Luna_Fixed.user.js` (`@name Luna Client (fixed)`, `@version 1.1.1`).
Line numbers refer to that file. Nothing is claimed unless located and read.

---

## 0. What "Replace" is in Luna

Two things carry the name, and they are not the same thing.

**The menu entry is a stub.** Placers → Special → `{ type: 'toggle', name:
"replace", id: "prePlace2" }` (19253). `prePlace2` occurs **exactly once in the
entire file**. There is no `prePlace2` key in `window.vars` — the placer defaults
block at 19103 has `prePlace: true` and nothing else — and the id is read
nowhere. Toggling it stores a value no code consults. It is the same class of
entry as Luna's `autsh1` and `triangle2`.

**The working mechanism is `spamPrePlacer`**, and it has four sites in the whole
file:

```
10788   let spamPrePlacer = false;              declaration
11778       spamPrePlacer = true;               armed, inside getPrePlaceObject
11802   spamPrePlacer = false;                  cleared, top of getPredictObjects
14002       if (spamPrePlacer) { ... }          consumed, in a timer
```

That is the entirety of Replace in Luna:

```js
setTimeout(function () {
    if (spamPrePlacer) {
        for (let object of predictObjects) {
            if (!object.preplace) continue;
            if (packets + 5 > 119) break;
            place(object.id, object.angle);
            placedAngles.push(object.angle);
            io.send("D", getAttackDir());
        }
    }
}, 111 - minPingTime);                                   // 14001-14012
```

**Replace has no machinery of its own.** It performs no target acquisition, no
candidate generation, no scoring, no geometry evaluation and no validation. It
re-sends, at a later offset, whatever Preplace already decided. Every answer
below that describes machinery is therefore describing Preplace's, with Replace's
own contribution called out where it exists.

A third orphan sits alongside: `settings.spampreplace = true` (164) is read
nowhere, as is `settings.autoPlace` (165).

---

## 1. What triggers Replace

`spamPrePlacer` is set at 11778, the last statement of `getPrePlaceObject()`:

```js
if (findObject) {
    spamPrePlacer = true;
}
return findObject;
```

So the trigger is: **`getPrePlaceObject()` returned any object at all.** There is
no separate condition, threshold, toggle or cooldown. Whenever Preplace has a
target, Replace is armed for that tick — which makes it not a distinct system so
much as an unconditional second shot.

It is cleared at 11802, before `getPrePlaceObject()` is called again, so it never
survives a tick.

Everything gating Preplace therefore gates Replace transitively (11804):

```js
if (window.vars.prePlace && nearestEnemy
    && UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) < 300
    && !(nearestTrap && spikeDmgCount > 0)) {
```

Note the consequence: turning off `prePlace` also turns off Replace, and there is
no way to run one without the other.

---

## 2. Which objects can be replaced

Decided entirely by `getPrePlaceObject()` (11746-11781), which has two branches
and returns the first hit.

**Branch A — objects *we* are about to break** (11749-11757), only when
`autogathering` and our weapon is off cooldown:

```js
let dmg = items.weapons[predictWeapon].dmg * (sDmg || 1)
        * config.weaponVariants[myPlayer.weaponVariants[predictWeapon]].val
        * (isBoughtHat(40, 0) ? 3.3 : 1);

findObject = visibleObjects.filter((object) =>
       (getDistance(myPlayer.xVel, myPlayer.yVel, object.x, object.y) - object.scale) <= items.weapons[predictWeapon].range
    && getAngleDist(getDirection(object.x, object.y, myPlayer.xVel, myPlayer.yVel), getAttackDir()) <= config.gatherAngle
    && object.health <= dmg
).sort(by distance to nearestEnemy)[0];
```

Three filters: range, **aim cone**, and lethality. The hat multiplier is
**accurate for our own hat** (`isBoughtHat(40,0) ? 3.3 : 1`). Distances are
measured from `myPlayer.xVel/yVel` — the predicted next-tick position.

**Branch B — objects the *enemy* is about to break** (11764-11776), only when the
enemy's weapon just came off cooldown:

```js
if (nearestEnemy.weapons[1] == 10 && secondaryReload[sid] == 1 && nearestEnemy.lastSecondaryReload < secondaryReload[sid])
    weapon = nearestEnemy.weapons[1];
else if (items.weapons[nearestEnemy.weapons[0]].speed <= 400 && primaryReload[sid] == 1 && nearestEnemy.lastPrimaryReload < primaryReload[sid])
    weapon = nearestEnemy.weapons[0];

let dmg = ... * 3.3;

findObject = visibleObjects.filter((object) =>
       !object.hideFromEnemy
    && getDistance(nearestEnemy.x2, nearestEnemy.y2, object.x, object.y) <= (object.scale + items.weapons[weapon].range)
    && object.health <= dmg
).sort(by distance to nearestEnemy)[0];
```

The reload test is an **edge**, not a level — `lastPrimaryReload < primaryReload`
means the weapon became ready *this* tick. That is sharper than a plain
"is ready" check and is genuinely good.

But the object filter is much looser than branch A's:

- **no aim cone** — the check present one branch above is absent here, so an
  enemy facing away still arms a replace on everything behind them;
- **no ownership filter** — `isObjectOur` (11334) is never applied, so enemy-owned
  buildings inside the enemy's own weapon range qualify as replace targets;
- **`* 3.3` is hard-coded** — the tank hat is assumed always worn, even though
  `skinIndex` is parsed per player every tick (11119);
- **only `nearestEnemy`** is considered, though `enemiesNear` is already
  assembled (12551).

Natural resources are excluded only incidentally, by `object.health` being
absent on them rather than by any type test.

**Selection among candidates:** `.sort((a, b) => distance(a, nearestEnemy) -
distance(b, nearestEnemy))[0]` — the doomed object **closest to the enemy** wins.
Not the most valuable, not the one whose loss opens the worst gap.

---

## 3. How replacement candidates are generated

Replace generates none. It reuses `predictObjects`, populated by Preplace.

Preplace's generator is `getPrePlaceAngles(id, customObjects)` (11521):

```js
for (let i = 0; i < 72; i++) {
    const angle = UTILS.toRad(i * (360 / 72));
    angles.push({ id, angle, placeable: canPlace(id, angle, customObjects), ...getConfig(id, angle) });
}
getPerfectAngles(angles);
```

72 fixed angles, always starting at 0, always 5° apart. Resolution is not
parameterised and the sweep is not anchored to anything meaningful.

Two sweeps run per tick — spikes then traps (11926-11927) — each fed
`customObjects`: a full copy of `visibleObjects` with the doomed object spliced
out (11808-11814):

```js
let customObjects = [];
for (let object of visibleObjects) customObjects.push(object);
...
customObjects.splice(customObjects.indexOf(findObject), 1);
```

That splice is the whole mechanism: angles currently blocked by the doomed object
come back `placeable`. It can pretend **exactly one** object is gone. A spot
blocked by two objects dying to the same hit stays invisible.

`getConfig` (11242) accepts a `velocity` flag selecting `myPlayer.xVel/yVel` over
`x2/y2`, and `canPlace` (11250) passes it through — but `getPrePlaceAngles` never
supplies it, so every candidate is built at the **current** position and
committed up to 111 ms later.

---

## 4. How replacement candidates are selected

Replace selects nothing — `for (let object of predictObjects) { if
(!object.preplace) continue; ... }` takes whatever is flagged.

Preplace's selection (11942-11962) is: filter to `placeable`, filter through
`isPrePlaceAngle`, then

```js
.sort((a, b) => UTILS.getDistance(findObject.x, findObject.y, a.x, a.y)
              - UTILS.getDistance(findObject.x, findObject.y, b.x, b.y))[0];
```

**Spikes are attempted first, traps second**, and `getFindAngle` short-circuits
once `findAngle` is set — so exactly **one** object is ever committed per tick,
and the tie-break is purely "closest to the doomed object". There is no scoring;
`isPrePlaceAngle` is a boolean cascade whose first match wins.

`isPrePlaceAngle` (11548) rules, in order:

| # | rule | line |
|---|---|---|
| — | reject if enemy > 350 away (unreachable; the caller already gates at 300) | 11550 |
| 1 | spike, can spike-tick, and `canTrapTick()` | 11607 |
| 2 | trap, can retrap, and `canShamePlace()` | 11610 |
| 3 | spike hitting a trapped enemy, and is `closestSpikeToEnemy` | 11620 |
| 4 | trap retrapping a colliding enemy, and is `closestTrapToEnemy` | 11625 |
| 5 | spike that knocks into other spikes, and `!canShamePlace()` | 11630 |
| 6 | spike not blocking LOS while enemy trapped | 11635 |
| 7 | **`if (isTrap) return true;`** — unconditional | 11640 |

Rule 7 is the one that matters for Replace: any placeable trap angle passes, so
whenever the spike branch finds nothing, Replace re-sends a trap placed at an
essentially arbitrary angle near the doomed object. The comment above it
("Place trap when neither player is trapped") describes a condition the code does
not implement — `isAutoPlaceAngle` (11648) *does* implement it, so the omission
is specific to the preplace path.

---

## 5. How combat geometry is evaluated

Three derived quantities, computed once per tick in `getPredictObjects` and
passed into every `isPrePlaceAngle` call:

**`closestSpikeToEnemy`** (11832) — placeable spike angles whose axis-aligned box
of half-width `nearestEnemy.scale + a.scale - 1` is crossed by the segment
`(enemy.x2,y2) → (enemy.xVel,yVel)`, sorted by distance to `xVel/yVel`.

**`closestTrapToEnemy`** (11850) — same, with half-width `a.scale`.

**`closestSpikeToKb`** (11867) — candidates that both intersect the enemy's
movement segment *and* whose knockback pushes the enemy into one of `spikes_our`:

```js
const knockbackAngle = Math.atan2(nearestEnemy.yVel - a.y, nearestEnemy.xVel - a.x);
const projectedX = nearestEnemy.xVel + 200 * Math.cos(knockbackAngle);
const projectedY = nearestEnemy.yVel + 200 * Math.sin(knockbackAngle);
for (let spike of spikes_our) if (UTILS.lineInRect(spike box, enemy.xVel/yVel, projected)) return true;
```

then scored by angular alignment (`angleDiff` between spike→enemy and
enemy→target-spike), keeping the minimum and breaking ties by distance.

Also inside `isPrePlaceAngle`: a spike-tick test that rejects knockback pointing
back at us (`angleDiff >= Math.PI / 5`, 11594), and two line-of-sight tests
against a 222-unit lookahead along `predictMoveAngle` (11562-11585).

Three limitations, all verifiable in the source:

- **Every hit test is an axis-aligned square standing in for a circle.**
  `UTILS.lineInRect` takes a box; the radii passed are `r1 + r2`. A square
  circumscribing a circle over-reaches by up to √2 on the diagonals, so
  diagonally-offset spikes are reported as hits.
- **Knockback travel is a fixed 200 units** with no distance band and no
  alignment *threshold* — alignment is only a ranking, so the "best" bounce can
  still be badly aligned if it is merely the least-bad candidate.
- **`predictMoveAngle` is `null` whenever the player is standing still.**
  `Math.cos(null) === 1`, `Math.sin(null) === 0`, so the LOS lookahead silently
  becomes a point 222 units due **east**, corrupting rules 6 for every angle.

---

## 6. How enemy movement affects replacement

Through one value, computed once per player per tick during the update parse:

```js
tmpObj.xVel = tmpObj.x2 * 2 - lastX;
tmpObj.yVel = tmpObj.y2 * 2 - lastY;
```

That is a straight linear extrapolation of one tick — position doubled minus the
previous position. Despite the name it is not a velocity; nothing in Luna reads
the engine's real velocity fields for prediction, and `config.playerSpeed`
(0.0016) and `config.playerDecel` (0.993) are never consulted by the placer.

There is no acceleration model, no decel model, no speed multipliers (build
index, weapon, hat, tail, biome), no direction-stability check, and no
comparison of last tick's prediction against what actually happened. One
unconditional hypothesis, no feedback.

Movement enters the decision only as the endpoint of the segment in the three
geometry tests above, plus `myPlayer.xVel/yVel` in branch A's range/aim filters.

**For Replace specifically, movement has no effect at all after the decision.**
The commit at 14001 replays a stored `angle`, and `place()` recomputes nothing —
so if the player has moved between the decision and the ~96 ms-later re-send, the
same angle now points somewhere else entirely.

---

## 7. How placement range is validated

It is not validated; it is assumed. `getConfig` (11242) puts the candidate at a
fixed radius:

```js
35 + items.list[id].scale + (items.list[id].placeOffset || 0)
```

There is no check that this is within whatever the server accepts, and no
re-derivation at commit time. The only range gates anywhere in the path are:

| gate | value | line |
|---|---|---|
| Preplace entry: player↔enemy | `< 300` | 11804 |
| `isPrePlaceAngle` re-check | `> 350` reject — unreachable | 11550 |
| branch A: object within weapon range | `items.weapons[predictWeapon].range` | 11753 |
| branch B: object within enemy weapon range | `object.scale + items.weapons[weapon].range` | 11774 |

`window.vars.placeRange` exists in Luna's settings but belongs to Auto Place, not
this path.

---

## 8. How collision is validated

`canPlace` (11250) → `objectManager.checkItemLocation` (16936):

```js
function canPlace(id, angle, objects, velocity) {
    if (isItemLimit(id)) return false;
    let config = getConfig(id, angle, velocity);
    if (objectManager.checkItemLocation(config.x, config.y, config.scale, 0.6, id, false, myPlayer,
                                        objects ? objects : visibleObjects)) return true;
    return false;
}
```

```js
this.checkItemLocation = function (x, y, s, sM, indx, ignoreWater, placer, objects) {
    for (var i = 0; i < objects.length; ++i) {
        var blockS = (objects[i].blocker ? objects[i].blocker : objects[i].getScale(sM, objects[i].isItem));
        if (objects[i].active && UTILS.getDistance(x, y, objects[i].x, objects[i].y) < (s + blockS))
            return false;
    }
    if (!ignoreWater && indx != 18 && y >= river top && y <= river bottom) return false;
    return true;
};
```

A linear scan over the supplied array with a `Math.sqrt` per object, early-return
on the first blocker, plus a river-band test. `objects` is `visibleObjects`
(everything within 1000 units) minus the doomed object.

**Luna's item-limit check is correct** (11294):

```js
function isItemLimit(id) {
    let group = items.list[id].group;
    let limit = config.inSandbox ? group.sandboxLimit || Math.max(group.limit * 3, 99) : group.limit;
    if (limit && myPlayer.itemCounts[group.id] >= limit) {
        return true;
    }
}
```

`group.limit` outside sandbox, and `if (limit && ...)` so a group with no limit is
unlimited rather than silently capped. This is the one place where Luna is
materially better than NovaStorm, whose `group.sandboxLimit || 99` (12836) never
fires for spikes (limit 15) or traps (limit 6). Confirmed already against the game
bundle and Whiteout.

**Collision is validated exactly once**, at decision time. Neither the Preplace
commit (13998) nor the Replace commit (14001) re-checks anything.

---

## 9. How existing objects affect the decision

Three distinct ways:

1. **As blockers** — every active object in `visibleObjects` within `s + blockS`
   makes an angle unplaceable (§8).
2. **As the one exception** — the doomed object is spliced out of the candidate
   set (11814), which is what makes preplacing possible at all. Exactly one
   exception; `assumeBreak`-style multi-object reasoning does not exist here.
3. **As geometry** — `traps_our` supplies `enemyTrapped` (11555), which gates
   rules 3, 4 and 6; `spikes_our` supplies the knockback targets for
   `closestSpikeToKb` (11884).

What existing objects do **not** do: nothing checks whether one of *our*
placements from a previous tick already occupies the spot. `placedAngles`
(11362-11365) exists and feeds `bannedAngles`, but that map is read only by
`checkPredictObjects` (11386), reachable only from `updateAngles`
(11369) / `updateAngles2` (11380, never called) — i.e. only from **Auto Place**.

The asymmetry is backwards: Preplace and Replace *write* into `placedAngles`
(13996, 14008) and so create bans that suppress Auto Place, while themselves
consulting no ban at all. Replace is the single component most likely to spam a
failing angle, and it is the one with no feedback whatsoever.

---

## 10. How stale replacement decisions are cancelled

**They are not.** This is the clearest finding of the analysis.

There is no `clearTimeout` for the Replace timer, or for the Preplace timer, or
anywhere in the placer. Once `setTimeout(..., 111 - minPingTime)` is registered it
always fires.

There is no landing check. Nothing asks whether the first send succeeded before
sending again. Luna does collect the signal that would answer it —
`spawnedObjectSids` is pushed in `loadGameObject` and reset per tick — and never
reads it.

And there is a placeholder for exactly this that does nothing. `getPredictObjects`
opens with (11786-11796):

```js
// FIX STACK PACKETS
if (removedObjects.length > 0) {
    if (lastPrePlaceObject && removedObjects.some((sid) => lastPrePlaceObject.sid == sid)) {
        for (const object of predictObjects) {
            if (!object.preplace) continue;
            placeTick = tick;
        }
    }
    removedObjects = [];
}
```

`lastPrePlaceObject` (11349, assigned at 11966) is the doomed object from last
tick, and `removedObjects` is filled by `killObject` (9197). So this block *does*
detect "the object I was preplacing over actually died" — and its only response
is to write `placeTick`, which is declared at 10700, written at 11791 and 12028,
and **never read anywhere in the file**. The loop also writes the same value once
per matching element rather than once.

The entire block reduces to `removedObjects = []`.

The only thing resembling cancellation is incidental: the timer reads the
**global** `predictObjects`, which `getPredictObjects` clears and repopulates
every tick (11798). If the next tick produces no preplace, a late-firing timer
finds nothing to do. That is a side effect of shared mutable state, not a design.

Which makes the timing hazard real. `minPingTime` (15053) initialises to
`Infinity` and is only ever lowered (15077-15079) — it never decays:

- before the first ping response, `111 - Infinity` is `-Infinity`, clamped to
  0 ms, so Replace fires **before** the tick body has run `getPredictObjects()`,
  acting on the previous tick's decision;
- afterwards, one lucky low sample pins Replace's offset for the whole session.

Luna has no ping smoothing at all — `pingSmooth` and `pingStabilizer` appear zero
times in the file. Preplace commits at `111 - window.pingTime` (13998), raw.

---

## 11. How the final replacement action is executed

```js
place(object.id, object.angle);
placedAngles.push(object.angle);
io.send("D", getAttackDir());
```

`place` (11197) is four packets, unconditionally:

```js
function place(id, angle = ...) {
    selectToBuild(id);              // io.send("z", index, false)
    sendAtck(1, angle);             // io.send("F", 1, angle)
    sendAtck(0, angle);             // io.send("F", 0, angle)
    selectWeapon(predictWeapon);    // io.send("z", index, true)
}
```

No dedup against the currently-selected build index or weapon, so a Replace
immediately after a Preplace re-sends both `z` packets for no reason.

Per-tick cost for one preplaced object:

| timer | delay | packets |
|---|---|---|
| warm-up (13980) | 1 ms | 1 (`D`) — plus two `getPrePlaceAngles` calls with wrong arity whose results are discarded |
| Preplace commit (13998) | `111 - window.pingTime` | 5 |
| **Replace commit (14001)** | `111 - minPingTime` | **5** |

Eleven packets per tick, ~99/s at 9 ticks/s, against the ~120/s the
`packets + 5 > 119` guards imply. Replace contributes 45% of that for zero new
information.

The guard itself is evaluated inside the timer, ~96 ms after the tick body's
guard, against a counter reset by a free-running 1-second interval. It is not a
per-tick budget.

Because `minPingTime <= window.pingTime` in the normal case, Replace fires
*after* Preplace, so the second send tends to land in the following server tick.
That is a plausible double-shot — but it falls out of the formula rather than
being chosen, and it drifts with the session-minimum ping.

---

## A. Useful replacement behaviour

Honestly, this is a short list. Luna's Replace is a second `place()` call behind
an unconditional flag; most of what is worth taking belongs to the Preplace
machinery it borrows.

1. **The reload-edge trigger** (11765-11771). `nearestEnemy.lastPrimaryReload <
   primaryReload[sid]` fires on the tick the enemy's weapon *becomes* ready
   rather than on every tick it *is* ready. This is the sharpest idea in Luna's
   placer and it prevents continuous re-arming. Worth keeping and extending to
   more weapon types.
2. **Branch A's filter set as the template for branch B** (11753-11755). Range +
   aim cone + lethality, with an accurate hat multiplier, sitting three lines
   above a branch that has only range + lethality with a hard-coded multiplier.
   The better version is already in the file; branch B should simply match it.
3. **Correct `isItemLimit`** (11294) — see §8. Directly restorable to NovaStorm as
   a regression fix.
4. **The two-stage commit shape.** One send timed to land inside the current
   server tick and a second timed to land in the next is a sound idea for
   covering the case where the target dies a tick later than predicted. The
   *shape* is worth keeping; the derivation (§10) is not.
5. **Splicing the doomed object out of the collision set** (11814) as the
   mechanism for "what would be placeable once this dies" — correct as far as it
   goes, and the natural place to generalise to multiple objects.
6. **Preplace target sorted by proximity to the enemy** (11756, 11776) — a
   reasonable default heuristic for which loss matters most, even though it is
   the only criterion.

## B. Architecture that should NOT be copied

1. **A toggle with nothing behind it.** `prePlace2` (19253) is exposed in the menu
   and read nowhere; `settings.spampreplace` (164) and `settings.autoPlace` (165)
   are likewise orphans. If Replace becomes a real system it needs a real gate,
   not a stored value.
2. **Replace armed by mere existence of a target** (11778). No condition of its
   own means it is not a system, it is a duplicate send. A real Replace should
   fire on evidence that the first attempt did not land.
3. **Dead-code feedback loop.** The `FIX STACK PACKETS` block (11786-11796)
   detects the exact event Replace should react to and writes it into
   `placeTick`, which is never read. Do not carry the block forward; implement
   what it was reaching for.
4. **No cancellation and no revalidation** (§10). Timers always fire, and neither
   commit re-checks collision, item limits or player position. Whiteout's
   `check3` shows the cheap fix — revalidate at commit, drop silently on failure.
5. **`minPingTime` as a timing base** (§10). A session-global minimum that starts
   at `Infinity`, never decays, and makes the first tick fire at 0 ms. Use a
   bounded recent-window estimate.
6. **Cross-tick reads of mutable globals.** The timers read `predictObjects`,
   `spamPrePlacer` and `placedAngles` at fire time rather than a snapshot of the
   tick that decided them.
7. **Replaying a stored angle after the player has moved** (§6). Angles are
   player-relative; the commit recomputes nothing.
8. **Unconditional rule 7, `if (isTrap) return true;`** (11640). Combined with a
   working item limit this would burn all six traps continuously.
9. **Axis-aligned boxes as circles** in every geometry test (§5), and a fixed
   200-unit knockback projection with alignment used only as a ranking.
10. **`predictMoveAngle` reaching `Math.cos` while `null`** (§5).
11. **Four-packet `place()` with no state dedup** (§11), invoked twice per tick
    for the same object.
12. **The 1 ms warm-up timer** (13980-13988): `setPlaceTick()` writes a dead
    variable, and two `getPrePlaceAngles` calls pass `object.id` where
    `customObjects` is expected — `objects.length` reads `undefined`, the loop is
    skipped, every angle returns placeable, and the result is discarded. Only the
    `io.send("D", ...)` does anything.
13. **Preplace and Replace welded together.** One toggle controls both, and
    Replace cannot be disabled independently.

---

## Bearing on NovaStorm

NovaStorm's Replace **is** this code. `getPredictObjects` diffs to zero against
Luna's ignoring whitespace, and `getPrePlaceObject`, `canPlace`, `getConfig`,
`getPrePlaceAngles`, `place` and `checkItemLocation` are identical. NovaStorm made
two changes, both improvements: `canSpikeTick` widened from `scale + 35` to
`scale + 55`, and the Preplace commit moved from Luna's raw `111 -
window.pingTime` to `111 - tickPing()` (median-smoothed, clamped).

It made one regression: `isItemLimit`.

So Luna is not a source of behaviour NovaStorm lacks — it is the origin of the
behaviour NovaStorm has, and its value here is mainly diagnostic: it establishes
which defects are inherited (most of section B), which are NovaStorm's own
(`isItemLimit`), and which of NovaStorm's deviations to keep (`tickPing`, the
widened spike-tick radius).

---

No NovaStorm code has been modified.
