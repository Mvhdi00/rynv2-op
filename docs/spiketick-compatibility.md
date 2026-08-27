# Spike Tick compatibility contract

Binding on the Preplace and Replace designs. Design only — no NovaStorm code has
been modified. Line numbers refer to `novastorm_1.4_ryn.user.js`.

---

## 1. The frozen surface

Not edited, wrapped, shadowed, or reimplemented:

| element | line |
|---|---|
| `canTrapTick` | 12705 |
| `canSmartTick` | 12465 |
| `canShamePlace` / `canShamePlus` | 12602 / 12637 |
| `advancedShameCombat` | 12570 |
| `canAutoShame` | 12673 |
| the predicate ladder | 14855-14886 |
| the `instaKill` executor | 14888-14949 |
| `hatFc`'s `insta.*` block | 16451-16461 |

Spike Tick keeps sole responsibility for spike timing. Preplace and Replace never
decide when a tick happens.

**One removal, and it is from Preplace, not Spike Tick.** `isPrePlaceAngle`
currently calls `canTrapTick()` (13149), `canShamePlace()` (13152) and
`canShamePlace()` again (13168), once per candidate angle. Those calls are
deleted. They are Preplace reaching into Spike Tick's decision function — the
violation of invariant I1 — and each one re-runs a 72-angle sweep. Spike Tick's
own call sites at 14855-14886 are untouched.

---

## 2. What Spike Tick actually depends on

The compatibility rules only mean something if the dependency chain is written
down. From `canTrapTick` (12705), which is the tick proper:

```js
if (getPlayerInfo(myPlayer, "secondaryWeapon") != "hammer") return false;
if (secondaryReload[myPlayer.sid] < 1) return false;
if (primaryReload[myPlayer.sid] < 1) return false;
if (nearestEnemy.spikeDamage > 0) return false;            // (a)
if (!window.vars.shameTick) return false;
const enemyTrapped = traps_our.find(...);
if (!enemyTrapped) return false;                            // (b)
let objects = visibleObjects.filter(object => object != enemyTrapped);
let placableSpikes = getPrePlaceAngles(myPlayer.items[2], objects);
for (let spike of placableSpikes) {
    if (spike.placeable                                                        // (d)
        && enemyTrapped.health <= getPlayerInfo(myPlayer, "secondaryStructureDmg")   // (c)
        && UTILS.getDistance(enemyTrapped.x, enemyTrapped.y, myPlayer.x2, myPlayer.y2) < spike.scale + 95
        && UTILS.getDistance(spike.x, spike.y, nearestEnemy.x2, nearestEnemy.y2) < spike.scale + 55)  // (e)
        return true;
}
```

Four of these are things a placement can break:

- **(a)** no spike damage has landed on the enemy this tick
- **(b)** one of our traps contains the enemy
- **(c)** that trap is **one-hammer-breakable** — `health <= secondaryStructureDmg`
- **(d)+(e)** a spike angle is still placeable within `spike.scale + 55` of the
  enemy

`canShamePlace` (12602), `canShamePlus` (12637) and `advancedShameCombat` (12570)
share (a), (b) and (c).

---

## 3. Invalidation vectors

Five ways Preplace or Replace can break an imminent tick. Each is concrete and
each maps to a rule in §5.

**V1 — Replace resets the containing trap's health.** This is the serious one.
If Replace sees `enemyTrapped` about to die and replaces it, the new trap is at
full health. Condition (c) flips false, and `canTrapTick`, `canShamePlace`,
`canShamePlus` and `advancedShameCombat` all return false together. **Replace can
destroy a spike tick by doing exactly what it was built to do.**

Worth noting: the shipped code already guards this correctly. `isPrePlaceAngle`
rule 2 (13163) retraps the containing trap only when
`nearestEnemy.spikeDamage > 0` — the state in which (a) has already failed and
the tick is over anyway. That condition is preserved verbatim in Replace's
design; it is not an accident to be tidied away.

**V2 — occupying the tick spike's annulus.** Condition (e) needs a placeable
spike angle within `scale + 55` of the enemy. Anything Preplace or Replace puts
in that band removes the angle and the tick with it.

**V3 — landing the spike damage early.** A Preplace/Replace spike that hits the
enemy sets `spikeDamage` (13632), failing (a) for every shame and tick predicate.
The damage is not wasted, but the coordinated sequence is lost — and the
sequence is worth more than one spike hit.

**V4 — spending the last spike.** Condition (d) needs `canPlace` to succeed,
which requires `!isItemLimit`. If Preplace or Replace spends the spike that would
have been the tick spike, no angle is placeable. This vector is currently
invisible because `isItemLimit` (12836) never fires for spikes; it becomes real
once that regression is fixed.

**V5 — consuming the execution window.** `place()` (12737) sends
`selectToBuild` → `sendAtck(1)` → `sendAtck(0)` → `selectWeapon(predictWeapon)`.
The deferred commits fire at `111 - tickPing()` and `111 - minPingTime` — late in
the tick, precisely when a token sequence wants clean weapon, hat and build
state. `place()` does restore `predictWeapon` on exit, and the timers' `io.send("D",
getAttackDir())` actually reinforces Spike Tick's aim (since `getAttackDir`
returns `autoaimAngle` first, 10283) — but the build-index and attack packets in
between are not free.

---

## 4. Detecting Spike Tick's state

Two different questions, with different costs.

### Active — free, already computed

Spike Tick's predicates run at 14855-14886 and its executor at 14888-14949, both
**before** `getPredictObjects()` at 15416. So by the time Preplace and Replace
run, the outcome is settled and readable:

```js
const spikeTickActive =
    instaKill.length > 0 || insta.primary || insta.secondary ||
    insta.turret || insta.primaryturret;
```

This is gate G2 in `preplace-design.md` and R3 in `replace-design.md`. It reads
state; it calls nothing. Cost: five boolean loads.

### Imminent — the harder case

"Do not invalidate an *imminent* spike opportunity" needs to detect a tick that
will become available **next** tick, which `instaKill` cannot tell us. Three ways
to get it, and I want your call rather than my assumption:

**Option 1 — active-only.** Ship G2/R3 as above and accept that a placement can
still spoil a tick that was one tick away. Zero cost, incomplete.

**Option 2 — cheap-prefix predicate (recommended).** Every condition in §2 except
(d) is O(1); the only expensive part of `canTrapTick` is the 72-angle sweep.
Preplace and Replace evaluate the cheap prefix — hammer equipped, both reloads
ready, `spikeDamage == 0`, `shameTick` on, `enemyTrapped` exists and is
one-hammer-breakable — and treat a pass as "a tick is live, stay out of the way".

This does **not** call `canTrapTick` and does **not** decide whether to tick — it
deliberately omits the sweep, which is where the decision is made. It reads the
same cheap state Spike Tick reads. I am flagging it anyway, because it is the one
place in these designs where a condition list is restated rather than reused.

**Option 3 — one additive line in Spike Tick (cleanest, needs your permission).**
The predicates already run at 14855-14886. Recording their results costs nothing:

```js
tickState.trapTick = canTrapTick();     // instead of calling it inline
if (tickState.trapTick) instaKill = ["secondary", "primary", "turret", "stop"];
```

Exact same behaviour, exact same call count, and Preplace/Replace read
`tickState` with zero duplication. It is strictly better than Option 2 — but it
edits the Spike Tick block, which you have frozen. **I have not assumed
permission.** Say the word and it becomes Option 3.

---

## 5. Deference rules

Given `spikeTickActive` (§4) or an imminent tick:

| # | rule |
|---|---|
| **S1** | No Preplace or Replace intent is created while a tick is active. Both designs already gate on this (G2 / R3). |
| **S2** | An in-flight intent whose commit falls inside an active window is **cancelled**, not deferred — the commit-time revalidation re-checks §4 and declines silently (`preplace-design.md` §8, `replace-design.md` §10). No `clearTimeout` is needed or added. |
| **S3** | **Protected annulus.** While a tick is live, no intent may occupy `dist(candidate, enemy) < candidateScale + 55` — condition (e)'s band, verbatim from 12730. Candidates outside it are the "non-conflicting action" the brief allows. |
| **S4** | **Protected trap.** Replace never replaces `enemyTrapped` while (a)-(c) hold. The existing `spikeDamage > 0` guard (13163) is the exact condition and is preserved. |
| **S5** | **Damage deference.** No Preplace/Replace spike may be placed in contact range of the enemy while a tick is live — that is V3, and it is a subset of S3. |
| **S6** | **Item reservation.** While a tick is live, Preplace and Replace treat the spike group as one below its limit, so the tick spike is never the one they spend (V4). |
| **S7** | **Precedence under packet pressure.** Spike Tick's packets are never displaced. Ordering, extending the ladder in `replace-design.md` §11: Spike Tick > Auto Place > Replace mode B > Replace mode A > Preplace. |

S3 is what turns "must not place conflicting objects" into something checkable:
one distance comparison against a constant already in the source.

---

## 6. Candidate exposure — the channel already exists

> If Preplace discovers a useful future Spike location: expose it as a candidate
> only. Do not execute it as an independent Spike Tick system.

**`smartTickSpike` (1473) is that channel, and it is already half-built.** It is
nulled at 13344 and assigned at 13443 — both inside Preplace's knockback scorer —
and **read nowhere in the file**. Preplace already publishes a spike location to
a Spike-Tick-named global that nothing consumes.

This is the answer to invariant I5 in `system-responsibilities.md`, which asked
whether to delete it or wire it. This brief settles it: **wire it, from Preplace's
side only.**

What changes: Preplace writes a *meaningful* value — the location it has
identified as a future tick opportunity, with the tick and confidence that
produced it — instead of the incidental last-spike-seen the KB scorer currently
leaves there.

What does not change: nothing reads it. Making Spike Tick consume `smartTickSpike`
would modify Spike Tick, which §1 forbids. Preplace publishes; Spike Tick is
untouched; the value is available the day you authorise that side.

The hard boundary this enforces: Preplace may *identify* a spike location and
must never act on the identification. If a candidate's value depends on a tick
happening, Preplace exposes it and drops it. It does not place, it does not time,
it does not equip.

---

## 7. State reused

Nothing here is recreated:

| information | where |
|---|---|
| a tick sequence is running | `instaKill`, `insta.*` (14855-14949) |
| which object Spike Tick is working | `smartTickObject` (12560, read 14891) |
| Preplace's spike-location channel | `smartTickSpike` (1473) |
| the enemy's containing trap | `traps_our` + the pattern at 13096 |
| one-hammer-breakable test | `getPlayerInfo(myPlayer, "secondaryStructureDmg")` |
| reload state | `primaryReload` / `secondaryReload` by sid |
| spike damage this tick | `nearestEnemy.spikeDamage` (13632) |
| the protected band constant | `spike.scale + 55` (12730) |
| item counts vs limits | `myPlayer.itemCounts`, `group.limit` |
| packet budget | `packets` (1522) |

---

## 8. Verification

Alongside I1-I14 and AC1-AC6:

- **ST1** — the eight frozen elements in §1 are byte-identical.
- **ST2** — `canTrapTick`, `canSmartTick`, `canShamePlace`, `canShamePlus`,
  `advancedShameCombat` and `canAutoShame` are called from Spike Tick's ladder
  only. Today `isPrePlaceAngle` calls three of them at 13149/13152/13168; after
  the change, zero.
- **ST3** — for a fixed tick state, the `instaKill` token sequence Spike Tick
  produces is unchanged.
- **ST4** — no Preplace/Replace intent exists inside the S3 annulus while a tick
  is live.
- **ST5** — Replace never targets `enemyTrapped` while (a)-(c) hold.
- **ST6** — `smartTickSpike` is written by Preplace and read by nobody, unless
  and until you authorise the Spike Tick side.
- **ST7** — no new hat, weapon, or attack packet originates from Preplace or
  Replace. `place()`'s existing sequence is the only one.

ST3 is the direct encoding of "do not modify Spike Tick behavior".

---

## 9. Open

1. **Imminence detection** (§4) — Option 1 (active-only, incomplete), Option 2
   (cheap-prefix predicate, recommended, restates conditions), or Option 3 (one
   additive line in the Spike Tick block, cleanest, needs permission)?
2. **`isItemLimit`** — still the same question from the Auto Place contract, and
   V4/S6 depend on the answer: global fix, or shadowed?
3. **Output target** — still the only blocker to implementation. NovaStorm is not
   in this repo, which builds `ReUp_Mix.user.js` from `src/RYN_Client_v4.js`.
