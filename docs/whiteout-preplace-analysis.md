# Whiteout v4 — Preplace implementation analysis

Traced from `updatePlayers` inward. Line numbers refer to `Whiteout_v4.js` as
supplied. Nothing here is claimed unless it was located and read; where a
mechanism exists but is dead, unused, or defective, that is stated.

**Correction to `preplace-replace-reference-extraction.md` §1.3.** I wrote there
that Whiteout "uses the predicted position" for candidate generation. The `vel`
parameter exists, but **both live call sites pass `0`** (12626-12627,
14467-14468), so both sweeps run from `player.x2`. The parameterisation is real;
the use is not. Corrected in place below and in that file.

---

## 0. The live path

`autoplacers()` is called once per tick from `updatePlayers` (15092) at line
16208 — the same architectural slot as NovaStorm's placer.

There is no separate "preplace system". **`preplace` is a per-candidate boolean
flag inside one unified placer.** A candidate becomes a preplace when it overlaps
only objects predicted to break; otherwise the same candidate is an ordinary
placement. That is the single biggest architectural difference from NovaStorm,
where Preplace is a separate branch with its own target, its own sweep and its
own timers.

```
updatePlayers (15092)
  ├─ per-player: xVel/yVel, movDir/pmovDir, velocity=calcVel, x3..x6   15165-15277
  ├─ objDmgPot()                                    15729   -> object.assumeBreak
  ├─ enemy[i].placePot = enemyPlacement(...)        16032
  └─ autoplacers()                                  16208
       ├─ findAvailableAngles(spike, 0, 0, PI/100)  12626   -> checkItemLocation3
       ├─ findAvailableAngles(trap,  0, 0, PI/100)  12627
       ├─ gradeAngles(...)                          12628   -> points, preplace, bestSpike/bestTrap
       ├─ usedAngles = usedAngles.filter2(...)      12630   -> movement/age invalidation
       └─ dispatch                                  12667-12718
            preplace + priority -> setTimeout(place, tickRate - pingTime)
            otherwise           -> immediate, via checkPlacement -> check3 revalidate

killObject (14429)   [packet handler, separate reactive placer]
  └─ findAvailableAnglesR -> gradeReplace -> immediate placement    14465-14541
```

---

## 1. How future enemy position is predicted

Positional differencing against the previous tick, then a two-hypothesis
physics step.

**Inputs, per player, per tick** (15160-15171):

```js
tmpObj.xVel = tmpObj.x2 - tmpObj.oldPos.x2;      // one-tick displacement
tmpObj.yVel = tmpObj.y2 - tmpObj.oldPos.y2;
tmpObj.pmovDir = tmpObj.movDir;                  // one tick of direction history
tmpObj.movDir  = (tmpObj.xVel + tmpObj.yVel) <= 7 ? null
                 : UWUTILS.getDirect(tmpObj, tmpObj.oldPos, 2, 2);
tmpObj.movSpd  = UWUTILS.getDist(tmpObj.oldPos, tmpObj, 2, 2);
```

Note `xVel` here is a **displacement**, not the engine's velocity field —
Whiteout reuses the name for a different quantity than the game does.

**The step** — `calcVel` (14869), called at 15221:

```js
let mult = set.maxSpeed;
cosX && (_.speedXD += cosX * .0016 * mult * time)
_.speedXD && (_.predX += _.speedXD * time)
let velXD = _.xVel * pow(.993, time),
    velX  = velXD + _.predX,
    accel = {x:_.x2+velX,  y:_.y2+velY},
    decel = {x:_.x2+velXD, y:_.y2+velYD},
```

`.0016` and `.993` are the game's `playerSpeed` and `playerDecel`. `maxSpeed`
(7610-7621) is the full multiplier stack: `(buildIndex >= 0 ? 0.5 : 1)` × weapon
`spdMult` × skin/tail `spdMult` × snow biome × `slowMult`.

`time` is `game.tickSpeed`, which is **measured**, not nominal:

```js
game.tickSpeed = performance.now() - game.lastTick;      // 15119
```

So the integration step adapts to real inter-tick jitter. `game.tickRate` (3501)
stays the nominal `1000/9` and is used only for timer offsets.

**The horizon ladder** (15265-15277): `x3` = `velocity.real` (+1 tick), `x4` =
`calcNewVel(...)` (+2), `x5` = `calcFVel(...)`, `x6` = `calcMVel(...)`.
`calcNewVel` (12957) differs from `calcVel` only in seeding from `x3` instead of
`x2`, so the ladder is the same step applied repeatedly.

---

## 2. Prediction inputs

| input | source | line |
|---|---|---|
| `x2, y2` | server position this tick | 15159-15160 |
| `oldPos.x2/y2` | server position last tick | 13682 (init), rolled per tick |
| `xVel, yVel` | `x2 - oldPos.x2` | 15165-15166 |
| `movDir, pmovDir` | direction of that displacement, and last tick's | 15169-15170 |
| `movSpd` | magnitude of that displacement | 15171 |
| `maxSpeed` | buildIndex / weapon / skin / tail / biome / slowMult | 7610-7621 |
| `trapped` | in a trap | used at 14917 |
| `velocity` | **last tick's** `calcVel` result, used to score itself | 14917 |
| `time` | measured `game.tickSpeed` | 15119 |

`buildIndex` in `maxSpeed` is the one most worth noting: a player who is placing
moves at half speed, and the predictor knows it.

---

## 3. How prediction confidence is determined

This is the mechanism worth taking. `calcVel` line 14917:

```js
if(_?.velocity != undefined && _.sid != player.sid)
  real = cdf(_, _.oldPos) == 0
      || (cdf(_, _.velocity?.accel) > cdf(_, _.velocity?.decel) && dAng(_.movDir, _.pmovDir) <= .3)
      || _.trapped
      ? decel : accel;
```

`_.velocity` still holds **last tick's** result at this point (it is reassigned
at 15221 after the call). `_.velocity.accel` and `.decel` are therefore last
tick's two competing predictions, and `cdf(_, ...)` measures each against where
the player *actually* ended up.

So the rule is: **if last tick's decel hypothesis beat its accel hypothesis, and
the movement direction is stable (≤ 0.3 rad), trust decel this tick.** Plus two
hard overrides — no movement at all (`cdf(_, _.oldPos) == 0`), or trapped.

For our own player it is not scored at all, just read from input state
(14918-14924): `getMoveDir() == undefined || clientMoveDir == null ? decel : accel`.

This is a one-tick-lookback hypothesis scorer, not a confidence *value*. Nothing
downstream reads a numeric confidence; scoring only selects which of two
positions becomes `x3`. There is no "low confidence → do not place" path.

**The instrumentation that would have measured error is commented out**
(15222-15263): a 100-sample `moveData` buffer accumulating dot-projected error
for `x3`, `x4` and `oldPredictPos` against the move direction. It was diagnostic,
and it is disabled.

---

## 4. How movement history is used

Exactly **one tick** of history, in two places:

1. `pmovDir` vs `movDir` — the stability gate in §3.
2. `oldPos` — the source of the displacement itself.

Everything else is instantaneous. There is no smoothing, no multi-tick average,
no per-enemy behavioural model. `lastSkinIndexes` (15200) keeps 10 samples but
that is hat tracking, not movement.

**Defect — do not port.** The stationary test at 15170 sums signed components:

```js
(tmpObj.xVel + tmpObj.yVel) <= 7 ? null : ...
```

A player moving `(-10, +10)` sums to `0 ≤ 7` and is classified stationary, so
`movDir` becomes `null` and `cos(null) === 1` injects a spurious eastward
acceleration into `calcVel`. It should be `Math.hypot(xVel, yVel)`. This is the
same class of `null`-into-trig bug NovaStorm has with `predictMoveAngle`.

---

## 5. How candidates are generated

`findAvailableAngles(item, thisAng, vel, xd)` (12277):

```js
const x = vel ? player.x3 : player.x2
for (let offset = thisAng; offset <= thisAng + PI2; offset += interval) {
    let used = usedAngles.findIndex(x => dAng(angle, x.angle) <= 0.45);
    let obj = {x, y, id, scale, angle, offset: tmpS, item, collide: [], points: 0,
               overlap: [], preplacer: [], sids: [], intercepts: [], knockback: [], used}
    let canPlace = secPacket <= 90
        ? objectManager.checkItemLocation3(tmpX, tmpY, i.scale, 0.6, i.id, false, true, obj)
        : objectManager.checkItemLocation(tmpX, tmpY, i.scale, 0.6, i.id, false, true)
    if(canPlace) potentialAngles.push(obj);
}
```

- **Resolution is a parameter.** Live call sites use `PI/100` = **200 angles**
  for the tick placer (12626-12627) and `PI/window.replaceAccuracy` = `PI/50` =
  **100 angles** for the reactive placer (14467-14468). The signature defaults
  (`PI/75`, `PI/60`) are overridden everywhere.
- **`vel` is `0` at every live call site**, so both sweeps use `player.x2`. See
  the correction at the top.
- **Budget-driven degradation**: above `secPacket > 90` it silently drops from
  the break-aware `checkItemLocation3` to the plain `checkItemLocation`, i.e.
  preplacing turns itself off under packet pressure rather than queueing.

**The break-aware legality test** — `checkItemLocation3` (6102):

```js
for (var h = 0; h < liztobj.length; ++h) {
    const asd = liztobj[h];
    var u = asd.blocker ? asd.blocker : asd.getScale(r, asd.isItem);
    if (hypot(e - asd.x, n - asd.y) < I + u) {
        obj.overlap.push(asd); obj.preplacer.push(asd.assumeBreak); obj.sids.push(asd.sid);
    }
}
if(obj.preplacer.includes(false)) return !1;
```

No early return: it collects **every** overlapping object and each one's
`assumeBreak`, and passes iff **all** of them are predicted to break. This is the
generalisation of NovaStorm's single-object splice, and it is what makes
`preplace` a derived property rather than a caller assertion. Note it does **not**
check `active`, unlike `checkItemLocation` (6096).

**Break prediction** — `objDmgPot` (14736), run at 15729 over **all**
`nearPlayers`, skipping only self. Sets `assumeBreak` where a ready weapon in
range does enough damage; `object.type !== null || !object?.owner?.sid` skips
natural resources and unowned objects. It hard-codes `* 3.3`, has no aim cone,
and does not restrict to our own buildings — the hat-aware `(hat === 40 ? 3.3 : 1)`
and the `config.gatherAngle` cone appear only in `breakShit` (14766), which models
our own hits.

**Defect — do not port.** `object.assumeBreak = false` is reset *inside* the
per-player loop (14750), so a later player in `nearPlayers` wipes flags an
earlier one set. The reset belongs with the `dmgpot = 0` clear at the top.

---

## 6. How candidates are rejected

In generation order:

| stage | rule | line |
|---|---|---|
| generation | `checkItemLocation3` fails — some overlapping object is not predicted to break | 12292 |
| generation | river band, unless `indx == 18` | 6115 |
| spike scoring | `isInPath(ouchie)` — candidate sits on our own pathfinder route | 12458 |
| spike scoring | `plyrDist > 300` to the enemy | 12460 |
| both | `used !== -1` **and not** `preplace` → **spliced out of the array** | 12385-12390, 12476-12481 |
| dispatch | `points <= 0` | 12641, 12667, 12694 |
| dispatch | overlaps an already-selected placement this tick | 12652 |
| dispatch | more than 4 placements queued | 12656 |
| dispatch | `secPacket >= 85` | 12644 |
| commit | `check3` re-runs `checkItemLocation3` and drops silently | 12592-12601 |
| replacer only | overlaps anything in `prioLoc` | 14487, 14507, 14518 |

The splice rule is the interesting one: an angle already used recently is
*removed from the candidate array entirely* unless it qualifies as a preplace, in
which case it survives and gains a point.

---

## 7. How timing is calculated

```js
setTimeout(() => { placers(spikeType, spike.angle); ... }, game.tickRate - window.pingTime);   // 12673, 12699
setTimeout(() => { placers(obj.item.id, obj.angle); ... }, game.tickRate - window.pingTime);   // 12573
```

`game.tickRate` is `1000/9` (3501); `window.pingTime` is the live RTT. Same shape
as NovaStorm's `111 - tickPing()` — independent confirmation the offset is right.
Whiteout uses the raw RTT with no smoothing and no clamp, so NovaStorm's
`tickPing()` (median-smoothed, clamped to [0,111]) is the better of the two.

Only preplace-and-priority candidates are deferred. Everything else places
immediately in the tick body. **The reactive placer in `killObject` is fully
synchronous** — no timer at all, because the packet itself is the timing signal.

---

## 8. How final placement is selected

Points accumulate per candidate in `gradeAngles` (12348), per enemy in
`newEnemies`. Selected values, read off the source:

**Traps** (12379-12448)

| condition | delta |
|---|---|
| `preplacer.includes(true) && placePriority` → `preplace = true` | +1 |
| `plyrDist <= 100` | +1 |
| `plyrDist <= 20.4` | +1 |
| damaging object within 43 of the candidate (sets `canPush`) | +1.5 each |
| damaging object within 74 | +1 each |
| `plyrDist <= 47` → `retrap = true` | +2.5 |
| …and no spike found, preplace + enemy already trapped | +1 |
| …and enemy aiming away (`getAngleDist >= 2`) | +1 |
| …and a spike *was* found | spikePoints × 2 |
| within `enemy.placePot.placeRange` | +1 abuse / +0.5 blocks |

**Spikes** (12452-12531)

| condition | delta |
|---|---|
| `preplacer.includes(true) && placePriority` → `preplace = true` | +1 |
| `aim1 > 1.8` (enemy facing away) | `(aim1-1.8)*4 + 1` |
| enemy trapped / trap near candidate, and `dAng >= 1.6` | +1 |
| in contact range and `placeSpike` | +3 |
| `knockInto` → bounces into a pit trap | +3.5 |
| `knockInto` → `bounce` (sets `instaC.canZpykeTick`) | **+8** |
| `knockInto` → into another spike | +4 |
| enemy in trap, candidate doesn't overlap that trap | +4.5 |
| near the enemy's trap, non-overlapping (`canPush`) | +1 |
| surrounds a trapped enemy within 250 | +2 |
| angle abuse within enemy's place range | +1 |
| **blocks our own path** (`dAng < 1.3 && aim1 < 1.3`) | **−2** |

Then:

```js
if(!bestTrap  || bestTrap.points  <  trarp.points)  bestTrap  = trarp;    // 12447
if(!bestSpike || bestSpike.points <= ouchie.points) bestSpike = ouchie;   // 12531
```

Note the asymmetry: `<` for traps (first maximum wins), `<=` for spikes (last
maximum wins). Almost certainly unintentional.

Dispatch (12667-12718) places `bestSpike` and `bestTrap` subject to mutual
exclusion rules involving `canPush`, `retrap` and `into`, then `fullplace` tops
up from the remaining sorted pool to a maximum of 4 non-overlapping placements.

**Inert rule — do not port.** The trap penalty at 12392 reads:

```js
if (dAng(caf(player, tarp), enemy.aim2) > 1.3 && trarp.find2(...)) tarp.points -= 4;
```

`tarp` is the *array* of nearby traps, not a candidate. `caf(player, tarp)`
resolves `tarp.y2 || tarp.y` to `undefined` → `atan2(NaN)` → `dAng(NaN, …)` is
`NaN` → `NaN > 1.3` is false, so the clause short-circuits before reaching
`trarp.find2` (which would throw, `trarp` being an object). The rule never fires,
and its intended `-4` penalty is simply absent.

---

## 9. How movement changes invalidate predictions

One mechanism, and it is position-aware — this is the piece NovaStorm most
clearly lacks:

```js
usedAngles = usedAngles.filter2(x => game.tick - x.tick <= 6 && cdf(player, x) <= x.offset + 20);   // 12630
```

Entries are `{...candidate, tick: game.tick}`, so each carries the absolute `x`,
`y` and `offset` of the placement point. An entry survives only while **both**
hold: fewer than 6 ticks old, and the player is still within `offset + 20` of the
recorded point. Since `offset` is `35 + scale + placeOffset` (≈70–105), moving
more than ~20 units *away* from a recorded placement drops that memory.

Contrast NovaStorm's `bannedAngles`, keyed on a raw player-relative angle with a
fixed 18-tick expiry (12905) — any movement silently re-aims the ban at different
world geometry.

`findAvailableAngles` also self-heals the memory: if an angle is in `usedAngles`
but is no longer placeable, the entry is spliced out (12294-12296).

**Defect — do not port.** `dAng` (14818) never wraps:

```js
let d = Math.abs(ang1 - ang2);
d = d % (Math.PI * 2);
if(d > (Math.PI * 2)) { d = (Math.PI * 2) - d; }    // unreachable after the modulo
```

Verified by running it: `dAng(0.1, 6.2)` returns `6.1000` where the true angular
separation is `0.1832`. Angles straddling the wrap read as maximally different.
This corrupts three consumers: the `usedAngles` reuse test (`<= 0.45`, and its
candidate angles run `[0, 2π]` so the boundary is hit every sweep), the
prediction-stability gate (`dAng(movDir, pmovDir) <= .3`, atan2 outputs so the
boundary is ±π), and `knockInto`'s bounce alignment (`<= .17`).

---

## 10. How stale predictions are cancelled

**They are not cancelled — they are re-validated at commit.** There is no
`clearTimeout` for any placement timer (the `clearInterval(placeLoop)` calls at
8194-8223 belong to `chainPlace`, on the dead path).

Instead every commit goes `placers()` → `check3()` (12592):

```js
function check3(id, rad) {
    const item = items.list[player.items[id]];
    const tmpS = 35 + item.scale + (item.placeOffset || 0);
    const tmpX = player.x2 + cos(rad) * tmpS, tmpY = player.y2 + sin(rad) * tmpS;
    if (objectManager.checkItemLocation3(tmpX, tmpY, item.scale, .6, id, false, false,
                                         {preplacer: [], sids: [], overlap: []})) {
        place(placeSpike ? 2 : id, rad);
        return true;
    }
    return false;
}
```

Three things matter here:

1. It recomputes `tmpX/tmpY` from the player's **current** `x2` — so a deferred
   placement is re-aimed to where the player is when it fires, not where they
   were when it was chosen.
2. It passes a **fresh empty** `{preplacer: [], sids: [], overlap: []}`, so
   `assumeBreak` is re-read at commit time against current world state.
3. If the check fails it returns `false` and sends nothing.

That is the answer to staleness, and it is the single most valuable thing to take
from this file: NovaStorm's Preplace and Replace commit ~111 ms after deciding
and re-check nothing at all.

---

## 11. How execution is performed

`place(id, rad, rmd, returnBool)` (8040) — **three packets**:

```js
selectToBuild(player.items[wall]);    // 1
sendAtck2(1, rad);                    // 1   (packet("F", id, angle, 1, ...))
selectWeapon(player.weaponCode, 1);   // 1
```

NovaStorm's `place()` (12737) sends four — it adds `sendAtck(0, angle)`, an
attack-release. Whiteout omits it entirely.

The item-limit gate (8073-8083):

```js
player.itemCounts[item.group.id] <
  (config.isSandbox ? 299 : item.group.limit ? item.group.limit : 99)
```

Correct use of `group.limit` outside sandbox. **Three independent sources now
agree** — the game bundle (NovaStorm 19196), Luna (11296) and Whiteout (8073) —
that NovaStorm's `group.sandboxLimit || 99` (12836) is wrong.

`placeVisible` (8095-8107) inserts a local ghost of the placement, removed one
tick later via `game.tickBase(..., 1)`. It is read at exactly one site — the
renderer, 20673 — so it is **cosmetic only**. It does not feed `liztobj` or any
legality check, and it does not prevent two placements from targeting the same
spot. That job is done by `usedAngles`, the non-overlap batching check (12652)
and `prioLoc`.

**Packet budget.** `secPacket` (3474) is a sliding-window counter reset by a
one-shot timer armed on the first send of each window (4186-4192), warning at
100 (4194). Thresholds in the placer: `<= 60` to qualify as preplace/priority,
`<= 90` to use the break-aware legality test, `>= 85` to abort batch placement.
Same class of counter as NovaStorm's `packets`, but consulted at three graded
levels instead of one hard cutoff.

---

## A. Useful behavioural logic

Ranked by value to NovaStorm's Preplace/Replace.

1. **Re-validate at commit, don't cancel** (§10). `check3` re-derives the
   placement point from the current position and re-runs the break-aware check
   against fresh state, dropping silently on failure. Directly addresses
   NovaStorm's decide-then-fire-111ms-later gap, and needs no timer bookkeeping.
2. **Multi-object break-aware legality** (§5, `checkItemLocation3`). Pass iff
   every overlapping object is predicted to break. Lifts NovaStorm's
   one-doomed-object ceiling and makes `preplace` a derived flag instead of a
   caller assertion.
3. **Position-aware, short-lived angle memory** (§9, `usedAngles`). Store the
   absolute point and the offset, expire on both age and player displacement.
   Strictly better than `bannedAngles` keyed on a bare angle.
4. **Adaptive accel/decel selection** (§3). Keep both hypotheses, score last
   tick's pair against the observed position, gate on direction stability. Cheap,
   self-correcting, and NovaStorm currently has one unconditional hypothesis.
5. **Measured tick length** (§1). `game.tickSpeed = performance.now() - lastTick`
   fed into the integration, rather than a hard-coded 111.
6. **Full `maxSpeed` stack in prediction** (§2), especially
   `buildIndex >= 0 ? 0.5 : 1` — a placing player moves at half speed.
7. **Graded packet budget** (§11). Three thresholds — degrade the legality test,
   stop qualifying preplaces, abort batching — instead of one `packets + 5 > 119`
   cliff.
8. **Scoring with penalties** (§8), notably `−2` for blocking our own path and
   `+8` for a confirmed bounce. NovaStorm's cascade cannot express "placeable but
   a bad idea".
9. **Splice-on-reuse** (§6). A recently-used angle leaves the candidate pool
   unless it qualifies as a preplace.
10. **Three-packet place** (§11). Dropping the attack-release saves 25% per
    placement — worth verifying against the live server before adopting.
11. **Break prediction over all enemies, resources excluded** (§5).

## B. Architecture that should NOT be copied

1. **`prioLoc` is an unbounded, never-cleared array.** Declared `const prioLoc = []`
   at 1890, pushed at six sites (12575, 12581, 12676, 12682, 12702, 12708), read
   at three (14487, 14507, 14518), and **never cleared, spliced, or filtered**.
   Every preplace location ever chosen accumulates forever, and the reactive
   placer refuses to place near any of them — so it degrades toward
   self-disabling over a session while the array grows without bound. If the
   reservation idea is taken, it needs the same age+distance expiry as
   `usedAngles`.
2. **`dAng` never wraps** (§9). Verified numerically. Corrupts angle memory,
   prediction stability and bounce alignment.
3. **`objDmgPot` resets `assumeBreak` inside the per-player loop** (§5, 14750).
4. **Signed-sum stationary test** (§4, 15170) — `(xVel + yVel) <= 7` misclassifies
   diagonal movement and feeds `null` into `cos`.
5. **The inert trap penalty** (§8, 12392) — writes to an array, short-circuits on
   `NaN`, never fires.
6. **Inconsistent tie-breaks** (§8) — `<` for traps, `<=` for spikes.
7. **Two parallel placers with overlapping responsibility.** `autoplacers` and
   `killObject`'s replacer duplicate the sweep/grade/dispatch pipeline
   (`findAvailableAngles`/`findAvailableAnglesR`,
   `gradeAngles`/`gradeReplace`) and coordinate only through `prioLoc`, which is
   broken per B.1. NovaStorm already has one decision point in
   `getPredictObjects`; keep it.
8. **The reactive placer runs before the corpse is removed.** `killObject` calls
   `objectManager.disableBySid(sid)` at 14544, *after* the placer at 14465-14541.
   `checkItemLocation3` does not test `active`, so the just-destroyed object still
   occupies its spot and the replace only succeeds because its `assumeBreak` is
   still true. An unpredicted break leaves `assumeBreak` false and the spot blocked
   by a corpse.
9. **Dead code presented as the system.** `traps.preplacer` (9844) has one caller,
   inside a commented-out block; `traps.replacer` (9619) has none.
   `preplace()` / `checkPreplace()` / `chainPlace()` / `preplaceTimeout` /
   `aboutToBreak` all belong to that path.
10. **Diagnostics left commented out rather than gated** (§3, 15222-15263) — the
    only real prediction-error measurement in the file is disabled.
11. **Whiteout's raw `window.pingTime`** for the commit offset (§7). NovaStorm's
    smoothed, clamped `tickPing()` is already better; don't regress it.

---

No NovaStorm code has been modified.
