# Phase 1 — NovaStorm 1.4 execution trace

Traced from the socket inward, not from function names. Line numbers refer to
`novastorm_1.4_ryn.user.js` as supplied.

---

## 0. Where everything actually executes

### 0.1 There is exactly one driver

`io.connect(...)` registers the packet map at 8982-9016. The relevant bindings:

| opcode | handler | line |
|---|---|---|
| `"a"` | `updatePlayers` | 13982 |
| `"H"` | `loadGameObject` | 11973 |
| `"Q"` | `killObject` | 10574 |
| `"S"` | `updateItemCounts` | 12160 |
| `"0"` | `pingSocketResponse` | 16687 |

**All four systems execute inside `updatePlayers` or in timers it registers.**
Verified by enumerating every `place()` call site — there are four, and none is
in the render loop:

```
12746  heal()                     -> place(items[0], null)
15423  Auto Place commit loop
15470  Preplace commit timer
15482  Replace commit timer
```

The render loop (`doUpdate` 16718 → `updateGame` 10717) sends **no packets** in
the placement path; its direction-send block at 10721-10732 is commented out.
Placement is therefore entirely packet-clocked, never frame-clocked.

### 0.2 The per-tick timeline

On each `"a"` packet at time **T**, `updatePlayers` runs synchronously:

```
T+0  sync   tick++                                              13983
            ban expiry sweep over bannedAngles                  13987-13991
            enemiesNear = []; spawnedObjectSids = []            13990
            parse player rows, doWeaponStuff, xVel/yVel         13994-14047
            promise created; internal setTimeout(resolve,1)     14050-14056   [timer A]
            promise.then(...) registered                        14058
            setTimeout(preplace warm, 1)                        15455         [timer B]
            setTimeout(preplace commit, 111 - tickPing())       15465         [timer C]
            setTimeout(replace commit, 111 - minPingTime)       15476         [timer D]
```

The `.then` body runs when the promise resolves, which is **either**:
- early, if a `"H"` (`loadGameObject`) packet lands in the same batch —
  `promiseResolve(true)` at 11986; **or**
- at T+1ms via timer A.

Timers A and B share a 1 ms delay and A was registered first, so A fires first
and its `.then` microtask completes before B's callback. `getPredictObjects()`
has therefore always run before any preplace timer. Confirmed by registration
order, not assumed.

Inside `.then` (14068 → 15450), in order:

```
14068  CHECK COLLISION            14120  OBJECTS FILTERING (visibleObjects, spikes_our, traps_our)
14133  ENEMY SPIKES               14137  NEAREST TRAP (consumes removedObjects)
14171  AUTOBREAK                  14403  FIX GATHER GLITCH
14500  GET SPIKE DAMAGES          14514  PREDICT MOVE (predictMoveAngle)
14631  AUTO PUSH                  14663  PATHFINDER
14680  PREDICT WEAPON             14686  SAFEWALK
14855  advancedShameCombat()      14863  canSmartTick() / canShamePlus()
14867  canAutoShame()             14871  canTrapTick()      <-- Spike Tick trigger
14875  canVelocitySpikeTick()     14884  canVelocityTick()
14888  INSTA KILL executor        14956  AUTOBUY
14968  AUTOGRIND                  15058  KILL CHAT
15066  ANTIS AND HEAL ... 15299 ANTI SPIKE TICK
15351  selectWeapon(predictWeapon)
15365  sendAutoGather() toggle
15395  hatFc()  -> hat/acc equip packets
15411  heal()   -> N x place(), 4 packets each
15416  getPredictObjects()        <-- Auto Place AND Preplace decide here
15419  Auto Place commit loop     <-- Auto Place executes here
15430  io.send("D", angle)
```

Then, outside `.then`, timers B/C/D fire.

### 0.3 Consequence: the deferred timers read globals, not a snapshot

Timers C and D iterate the **global** `predictObjects` and read the **global**
`spamPrePlacer` at fire time, 71-96 ms after the decision. `getPredictObjects()`
clears and repopulates `predictObjects` (13336) every tick. Under jitter a timer
from tick N can act on tick N+1's list, or on an empty one.

**There is no `clearTimeout` anywhere in the placer.** Verified by grepping all
`clearTimeout`/`clearInterval` sites — the only relevant one is 13710
(`antiTickTimeout`, unrelated). Timers B, C and D always fire; the only thing
resembling cancellation is `if (!object.preplace) continue` reading a list that
may since have been replaced. That is incidental, not designed.

---

## 1. Auto Place

**Trigger.** `window.vars.autoPlace && nearestEnemy` (13511). Nothing else — no
range gate at the entry.

> `window.vars.placeRange` (default 300, slider "Activation Range" at 20721) is
> **read nowhere in the file**. The Autoplacer's range slider does nothing. The
> real gate is a hard-coded `> 350` inside `isAutoPlaceAngle` (13186).
> `settings.autoPlace` (1505) is likewise never read — a second orphan alongside
> `settings.spampreplace` (1504).

**State dependencies.** `nearestEnemy` (14089), `visibleObjects` / `spikes_our` /
`traps_our` (14122-14127), `imTrapped` (14131), `predictMoveAngle` (14524),
`myPlayer.items[2]` / `[4]`, `myPlayer.itemCounts`, `bannedAngles`,
`placedAngles`, `tick`.

**Target acquisition.** None. Auto Place has no target object; it reasons purely
about the enemy and its own candidate geometry.

**Prediction.** `nearestEnemy.x2,y2 → xVel,yVel`, where `xVel = x2*2 - lastX`
(14016) — one tick of constant-velocity extrapolation. Self-position uses `x2,y2`
(current), never the `velocity` flag that `getConfig`/`canPlace` accept.

**Candidate generation.** `updateAngles(id)` (12892), called twice — spikes then
traps (13513-13514). 72 fixed angles from 0, `canPlace` per angle, then
`getPerfectAngles` (13072) marks placeable/blocked boundary transitions.

**Candidate scoring.** `checkPredictObjects(angles)` (12923):
- filter: `!bannedAngles.has(angle)` **and** (`placeable || perfect`)
- derive `closestSpikeToEnemy`, `closestTrapToEnemy`, `closestSpikeToKb`
- accept via `isAutoPlaceAngle` (13185), a 5-rule boolean cascade
- emit **perfect angles first, then placeable** (13047-13058)

Auto Place emits **multiple** objects per tick; `addPredictObject` (12825) dedupes
by overlap against already-queued entries.

Note `checkPredictObjects` is called once per item set but internally computes
spike **and** trap **and** knockback candidates each time, filtered by
`a.id !== myPlayer.items[2]` / `[4]` — so roughly half the work in each of the
two calls is guaranteed to produce nothing.

**Validation.** `canPlace` (12790) → `isItemLimit` (12836, broken — see §5.1) →
`objectManager.checkItemLocation` (18557), a linear scan of `visibleObjects` with
a `sqrt` per object.

**A dead guard.** `isAutoPlaceAngle`'s `willRetrap` (13226) calls
`UTILS.lineInRect` with **six** arguments where the function takes eight
(20347):

```js
const willRetrap = UTILS.lineInRect(
    config.x - config.scale, config.y - config.scale,
    config.x + config.scale, config.y + config.scale,
    nearestEnemy.xVel, nearestEnemy.yVel        // x2, y2 missing
);
```

With `x2`/`y2` undefined every comparison against them is false, so no early
return is taken and the function returns `true`. Verified by executing the
function standalone against four geometries including an enemy 9999 units away —
`true` in all cases. So trap Priority 1 (13260) degenerates to
`closestTrapToEnemy && config === closestTrapToEnemy && neitherTrapped`, which
Priority 2 (`if (neitherTrapped) return true`, 13265) already covers. **Both trap
rules collapse to "place a trap at any valid angle whenever neither player is
trapped."**

**Execution.** Immediate, in the tick body (15419-15426). No timer.

**Cancellation.** Only the ban map, which expires at `tick + 18` (12905, swept at
13987). Once `place()` is called there is no recall.

**Packet interaction.** 4 packets per placement (`place`, 12737: `selectToBuild`,
`sendAtck(1)`, `sendAtck(0)`, `selectWeapon`), no dedup of the two `z` packets.
Guard is `packets + 5 > 119` (15421).

**Conflicts.** Shares the single `predictObjects` queue with Preplace, Auto Mills
(13520), manual place keys (13543-13554) and the turret-grind pusher (15033).
`addPredictObject`'s overlap dedup means whichever system queued first wins the
space. Runs *after* `heal()` (15411), which can burn 20+ packets on the same
budget before Auto Place's guard is even evaluated.

---

## 2. Spike Tick

**This system places nothing.** It is a token-sequence scheduler.

**Trigger.** Three separate predicates feed it, and they are *not* gated
uniformly:

| predicate | line | menu gate |
|---|---|---|
| `canTrapTick()` | 12705 | `window.vars.shameTick` at 12711 — "Spike Tick" (20688), default **false** |
| `canSmartTick()` | 12465 | **none** — no settings check at all |
| `advancedShameCombat()` | 12570 | `window.vars.shameGrind` at 12577, default **true** |
| `canShamePlace()` | 12602 | `window.vars.shameGrind` at 12606 |

So the "Spike Tick" toggle gates only `canTrapTick`. `canSmartTick` runs
unconditionally whenever you hold a hammer and an enemy is near.

**State dependencies.** `nearestEnemy.spikeDamage`, `primaryReload` /
`secondaryReload` keyed by sid, `traps_our`, `visibleObjects`, `autoPush`,
`getPlayerInfo(...)` weapon/damage derivations, `smartTickObject`,
`smartTickSpike`.

**Target acquisition.** `canSmartTick` builds `candidateObjects` (12476): objects
one-shottable by the hammer, within hammer range of me, within `scale * 2` of the
enemy, excluding spikes. It then sets `smartTickObject` to the first candidate for
which a knockback-into-spike angle exists (12560).

**Prediction.** Same `xVel/yVel` extrapolation; knockback modelled by projecting
200 units along `atan2(enemy.yVel - a.y, enemy.xVel - a.x)` and segment-testing
against `spikes_our` (12489-12520).

**Candidate generation — this is where the cost lives.** `canSmartTick` runs, *per
candidate object*, an array filter plus a full 72-angle sweep:

```js
for (let object of candidateObjects) {
    let prePlaceObjects = visibleObjects.filter(obj => obj !== object);   // 12483
    const spikeAngles = getPrePlaceAngles(myPlayer.items[2], prePlaceObjects);
```

`canTrapTick` runs one sweep (12722), `canShamePlace` two (12621/12623),
`advancedShameCombat` two (12586/12588).

Each sweep is 72 × |`visibleObjects`| distance computations, and `visibleObjects`
is everything within 1000 units (14122) — routinely 150-400 objects in a base.

Importantly, `canShamePlace`, `canTrapTick` and `advancedShameCombat` all place
their sweeps **behind four or five cheap guards**, the decisive one being
`if (!enemyTrapped) return false`. So the sweeps do not run constantly — they run
precisely when an enemy is trapped and adjacent, i.e. in the exact frame where a
tick is being contested. The cost is conditional, and it lands at the worst
possible moment.

**Candidate scoring.** Best-alignment selection over knockback angle diff
(12530-12557), then `smartTickObject = object; break` on the first candidate that
yields any valid KB angle — first-match, not best-match across candidates.

**Validation.** Same `canPlace` → `checkItemLocation` path as everything else.

**Execution.** Assignment of a token queue (14855-14886):

```js
if (canSmartTick() || canShamePlus()) instaKill = ["secondary", "stop"];
if (canAutoShame())                   instaKill = ["primary", "stop"];
if (canTrapTick())                    instaKill = ["secondary", "primary", "turret", "stop"];
```

Later predicates **overwrite** earlier ones — this is assignment, not merge, so
the listed order is a fixed priority ladder with `canVelocityTick` (14884) last
and therefore highest.

The executor (14889-14949) shifts **one token per tick**. Since the predicates
re-assign the full queue at the top of every tick, a queue whose predicate keeps
holding never advances past its first token; it only drains once the predicate
goes false. That is a real behavioural property of the current code, not a bug I
am asserting — it follows directly from assign-then-shift-one.

**Cancellation.** The `"stop"` token clears `insta.*` and `autoaim` (14938-14947).
No timer to cancel.

**Packet interaction.** Indirect but immediate:
- sets `predictWeapon` (14899, 14912), which `place()` re-selects at 12741 — so
  **Spike Tick determines which weapon Auto Place and Preplace restore after
  every placement**;
- sets `autoaim` / `autoaimAngle`, which `getAttackDir()` returns first
  (10283-10285) — so it **steers the `io.send("D", ...)` that Preplace and
  Replace send in their timers** (15461, 15472, 15484);
- sets `insta.*`, consumed by `hatFc()` (16451-16461) which fires hat-equip
  packets at 15395, immediately before `heal()` and the Auto Place loop.

**Conflicts.** `canTrapTick()` is called **twice per tick from two different
places for two different purposes** — once at 14871 as the Spike Tick trigger,
and again per-angle at 13149 inside `isPrePlaceAngle` as a gate on spike
preplacement. Each call re-runs its full sweep. `canShamePlace()` is likewise
called from 13152 and negated at 13168.

---

## 3. Preplace

**Trigger** (13342):

```js
window.vars.prePlace && nearestEnemy
  && UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) < 300
  && !(nearestTrap && spikeDmgCount > 0)
```

`nearestTrap` is an **enemy** trap within 50 units of me (14149);
`spikeDmgCount` counts consecutive ticks in which spike damage landed
(14500-14510). So Preplace suppresses itself while trapped and taking spike
damage.

`isPrePlaceAngle` then re-checks `> 350` (13089). Given the 300 gate above, that
branch is unreachable.

**State dependencies.** As Auto Place, plus `autogathering` (toggled 50 lines
earlier at 15365), `predictWeapon`, `primaryReload`/`secondaryReload` for **both**
me and the enemy, `nearestEnemy.lastPrimaryReload` / `lastSecondaryReload` (set
during parse at 14003-14004), `lastPrePlaceObject`, `removedObjects`,
`spamPrePlacer`.

**Target acquisition.** `getPrePlaceObject()` (13284) — two branches:

1. *Self-gather* (13286): if autogathering and my weapon is ready, find visible
   objects I will break this hit — range check, **aim cone**
   (`getAngleDist(...) <= config.gatherAngle`), and `health <= dmg` with
   `isBoughtHat(40,0) ? 3.3 : 1`, i.e. hat-accurate for *my* hat.
2. *Enemy threat* (13297): if the enemy's hammer or a ≤400 ms primary just came
   off reload (`lastXReload < XReload`, a reload **edge**), find objects the enemy
   will break — range check and `health <= dmg` where dmg hard-codes `* 3.3`.

Branch 2 has **no aim cone** (unlike branch 1 directly above it) and **no
ownership filter** — `isObjectOur` (12876) is never applied, so enemy-owned
buildings inside the enemy's own weapon range qualify as preplace targets.
Only `nearestEnemy` is considered, though `enemiesNear` (14084) and
`nearestEnemiesCount` (14092) are both already computed.

Setting `findObject` also sets `spamPrePlacer = true` (13316) — this is the only
thing that arms Replace.

**Prediction.** Same `xVel/yVel`. `predictMoveAngle` drives a 222-unit lookahead
for line-of-sight (13101-13105) — and is `null` whenever the player is standing
still (reset at 14524, re-nulled at 14786/14821), making `Math.cos(null) === 1`
put the phantom future position 222 units due **east**.

**Candidate generation.** `getPrePlaceAngles(id, customObjects)` (13061) — the
same 72-angle sweep, but fed `visibleObjects` with the doomed object spliced out
(13355). That splice is the entire preplace trick: angles currently blocked by the
doomed object come back `placeable`. It can pretend exactly **one** object is
gone.

The sweep never passes the `velocity` flag that `getConfig`/`canPlace` accept
(12782, 12790), so candidates are validated at the tick-N position and committed
~111 ms later.

**Candidate scoring.** `isPrePlaceAngle` (13088), a 6-rule cascade, first match
wins; ties broken only by distance to the doomed object (13483, 13494). Spikes are
tried first, then traps (13481/13492) — exactly **one** angle is committed.

Rules 1 and 2 call `canTrapTick()` / `canShamePlace()` per angle (13149, 13152).
Rule 6 is `if (isTrap) return true;` (13178) — unconditional, despite a comment
describing a `neitherTrapped` condition that only `isAutoPlaceAngle` implements.

The whole function re-derives `enemyTrapped` and the LOS anchors on every call,
inside a `.filter()` over up to 144 angles.

**Validation.** Same as Auto Place. Critically, `bannedAngles` is **not**
consulted — the ban map is read only by `checkPredictObjects` (12926), reachable
only from `updateAngles` (12909) / `updateAngles2` (12912, never called), i.e.
only from Auto Place. Yet Preplace *writes* into `placedAngles` (15471, 15483),
so it creates bans that suppress Auto Place while ignoring them itself.

**Execution.** Timer C, `111 - tickPing()` ms (15465-15474). `tickPing()` (16681)
returns the median-smoothed ping under `pingStabilizer`, clamped to [0, 111].

Timer B (15455-15463) fires at 1 ms and does three things, of which two are dead:

```js
setPlaceTick();                                              // writes placeTick, never read
getPrePlaceAngles(myPlayer.items[2], object.id, object.angle);   // wrong arity, discarded
getPrePlaceAngles(myPlayer.items[4] || 15, object.id, object.angle);
io.send("D", getAttackDir());                                // the only live effect
```

`getPrePlaceAngles` takes `(id, customObjects)`. Passing `object.id` as
`customObjects` means `checkItemLocation` receives a number, reads
`objects.length` as `undefined`, skips its loop and returns `true` for every
angle — and the result is discarded anyway. `placeTick` is declared at 12207,
written at 13329 and 13566, and **never read**.

**Cancellation.** None. No `clearTimeout`. If the doomed object survives, the
commit still fires.

**Packet interaction.** Timer B: 1 packet. Timer C: 5 (`place` 4 + `D`). Guard
`packets + 5 > 119` (15468) — evaluated ~111 ms after the tick body's guard,
against a counter that a free-running 1-second interval (20185) may have zeroed
in between. The budget guard is not a per-tick budget.

**Conflicts.** Depends on Spike Tick's predicates for two of its six rules, and on
`predictWeapon`/`autoaim` that the Spike Tick executor sets. Shares
`predictObjects` and `placedAngles` with Auto Place.

---

## 4. Replace

**Trigger.** `spamPrePlacer` (13316) — set whenever `getPrePlaceObject()` returned
anything, reset at 13340. There is no independent condition.

There is **no toggle**. `settings.spampreplace = true` (1504) is read nowhere.
The Placers menu (20724-20729) has one entry, "Enable Preplacer".

**State dependencies.** `spamPrePlacer`, `predictObjects`, `packets`,
`minPingTime`.

**Target acquisition / prediction / candidate generation / scoring / validation.**
None of its own. It re-sends whatever Preplace already chose.

**Execution.** Timer D, `111 - minPingTime` ms (15476-15489).

`minPingTime` (16523) initialises to `Infinity` and is only ever lowered
(16669-16671); it never decays. Two consequences:

- Before the first `"0"` ping response, `111 - Infinity` is `-Infinity`, clamped
  by the host to 0 ms — timer D fires **before** timer A, i.e. before
  `getPredictObjects()` has run for this tick, acting on the previous tick's
  `predictObjects` and `spamPrePlacer`.
- Afterwards, a single lucky low sample pins Replace's timing for the whole
  session. Because `minPingTime <= tickPing()`, timer D normally fires *after*
  timer C, so the second send lands in the following server tick — a plausible
  double-shot, but a coincidence of the formula rather than a designed offset.

**Cancellation.** None, and no success check. Replace never asks whether the
first send landed. `spawnedObjectSids` — pushed to in `loadGameObject` (11979),
reset at 13990 — is exactly the signal needed and is **never read**.

**Packet interaction.** 5 more packets per preplaced object. Combined per-tick
cost for one preplaced object:

| timer | packets |
|---|---|
| B (1 ms) | 1 |
| C (111 − ping) | 5 |
| D (111 − minPing) | 5 |
| **total** | **11** |

At 9 ticks/s that is ~99 packets/s from Preplace + Replace alone, against the
~120/s the `packets + 5 > 119` guards imply.

**Conflicts.** Doubles Preplace's packet load with no added information, on the
same budget Auto Place and `heal()` are drawing from.

---

## 5. Cross-cutting findings

### 5.1 `isItemLimit` is a regression, and it disables the limit gate for everything

```js
function isItemLimit(id) {                                   // 12836
    let group = items.list[id].group;
    let limit = (group.sandboxLimit || 99);
    if (myPlayer.itemCounts[group.id] >= limit) return true;
}
```

Only mill, booster and teleporter carry `sandboxLimit` (17641, 17660, 17703).
Spikes are `limit: 15` (17633), traps `limit: 6` (17653) — neither has a
`sandboxLimit`, so the cap becomes 99 and is never reached. The bundle's own
check uses `item.group.limit` (19196), as does the HUD (9426).

Luna 1.1 — the base this placer is taken from verbatim — has it right (Luna
11296). This is a regression NovaStorm introduced, and it degrades **all four**
systems: `isItemLimit` sits inside `canPlace`, so every sweep in every system
reports angles as placeable for items the server will refuse.

For Preplace specifically it is worse than wasted packets: at 15/15 spikes the
spike branch still wins the single per-tick slot (13091, 13481), so the trap
fallback at 13492 is never reached.

The restore must use `UTILS.isSandbox` (16807, a hostname test), **not**
`config.inSandbox` (16806), which reads `process.env.VULTR_SCHEME` and is
undefined in a browser.

### 5.2 Dead state on the hot path

| symbol | line | status |
|---|---|---|
| `placeTick` | 12207 | written 13329/13566, never read |
| `setPlaceTick()` | 13562 | exists only to write it; called from timer B |
| `updateAngles2` | 12912 | never called |
| `prePlaceInterval` | 12296 | declared only |
| `prePlaceObjects` | 12209 | declared only (the 12483 one is a different, local binding) |
| `spawnedObjectSids` | 13973 | written 11979, never read |
| `window.vars.placeRange` | 20597 | menu slider, never read |
| `settings.autoPlace` | 1505 | never read |
| `settings.spampreplace` | 1504 | never read |
| timer B's two sweeps | 15459-15460 | wrong arity, result discarded |

### 5.3 Shared-helper fan-out

`getPrePlaceAngles` (13061) is called from six places across three systems:
Preplace (13356/13357), Spike Tick (`canTrapTick` 12722, `canSmartTick` 12484),
shame combat (`canShamePlace` 12621/12623, `advancedShameCombat` 12586/12588,
`canShamePlus` 12658/12660), and the dead timer-B calls.

`canPlace` (12790) additionally backs Auto Place (`updateAngles` 12896), Auto
Mills (13527-13541), manual place keys (13545-13553) and turret grind (15030).

So an internal optimisation of `checkItemLocation`/`canPlace` that preserves
results speeds up all four systems at once and changes no decisions. Anything
that alters *which* angle is chosen must be added as a Preplace-local variant.

### 5.4 Ordering hazards observed

1. `heal()` (15411) can spend 20+ packets before Auto Place's budget guard at
   15421 is evaluated; Preplace's guard at 15468 is evaluated ~111 ms later
   against a counter zeroed on an unsynchronised 1 s interval.
2. `canTrapTick()` / `canShamePlace()` are evaluated at 14871/14855 and again
   per-angle at 13149/13152/13168, with a full sweep each time and no memoisation,
   and can legitimately return different answers at the two points.
3. Timers C and D read mutable globals rather than a snapshot of the tick that
   decided them.
4. Timer D can fire before timer A whenever `minPingTime` is still `Infinity`.

---

## 6. What Phase 2 should touch, by blast radius

**Behaviour-preserving, benefits all four systems** — placer-local spatial grid
rebuilt per tick from `visibleObjects`; squared-distance comparisons in
`checkItemLocation`; hoist and memoise the tick-invariant parts of
`isPrePlaceAngle` and the `canTrapTick`/`canShamePlace` results; delete the dead
state in §5.2.

**Regression fix, all four systems** — `isItemLimit` (§5.1).

**Preplace/Replace-local, must not leak** — velocity-based candidate positions,
multi-object break-awareness, ban consultation, a landing detector off
`spawnedObjectSids`, snapshotting timers C and D, replacing `minPingTime` with a
bounded recent-window estimate, and real conditions on rule 6.

**Out of scope, recorded only** — Auto Place's 6-argument `willRetrap` (§1),
`canSmartTick` having no menu gate (§2), the dead `placeRange` slider (§1).
