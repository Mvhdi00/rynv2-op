# Integration — resolving the four systems through NovaStorm's existing flow

Design only. No NovaStorm code has been modified. Line numbers refer to
`novastorm_1.4_ryn.user.js`.

---

## 1. One correction to the model

Three of the four systems produce placement intents. **Spike Tick does not.**

I traced every `place()` call site: there are four (12746 heal, 15423 Auto Place,
15470 Preplace commit, 15482 Replace commit) and none belongs to Spike Tick. What
Spike Tick produces is a token queue (`instaKill`, 14855-14886) that mutates
`predictWeapon`, `autoaim` and `insta.*`. It has no id, no angle, no position —
nothing a placement queue can hold.

So the accurate shape is:

```
Auto Place ─┐
Preplace   ─┼─→ placement intents ─→ existing queue ─→ existing commit sites
Replace    ─┘                            ▲
                                         │ consulted, never queued
Spike Tick ──→ urgency constraint ───────┘
```

Spike Tick's "urgent spike intent" is a **veto and a protected region**
(`spiketick-compatibility.md` §5), not a competitor for queue space. Modelling it
as a queue entry would require giving it a position it does not have, and would
mean routing its execution through the placement path — the opposite of leaving
it alone.

---

## 2. The existing coordination mechanism is sufficient

From the conflict map: `predictObjects` (12208) + `addPredictObject` (12825) +
`getPredictObjects` (13322) already form an intent queue with a single entry
point, spatial arbitration, a single decision point per tick, and an implicit
priority ladder.

One property of it decides the whole integration:

> **NovaStorm resolves intents at insertion, not in a resolution pass.**
> `addPredictObject` rejects an overlapping candidate as it arrives (12828).

So the integration is **gate before insert**. Adding a separate resolve-then-pick
stage would be a second placement engine, which is exactly what is forbidden —
and it would be redundant, because insertion-time rejection already produces a
conflict-free set.

Everything below therefore happens *before* `addPredictObject` is called, or
*after* the queue is already built. Nothing changes between them.

---

## 3. Intent flow, per system

| system | gates before insert | flag | commit site | revalidated |
|---|---|---|---|---|
| Auto Place | none — unchanged | `false` | immediate loop 15419 | no (unchanged) |
| Preplace | conf → value/gain → AP oracle → Spike Tick veto | `true` | deferred 15465 | **yes** |
| Replace mode A | loss → recovery → AP oracle → Spike Tick veto | `true` | deferred 15465 | **yes** |
| Replace mode B | loss → recovery → AP oracle → Spike Tick veto | `false` | immediate loop 15419 | at insert |

The existing `preplace` boolean already routes execution to the right site. No
new dispatch, no new commit path, no new timer.

**Producer order is unchanged**: Preplace/Replace at 13476 → Auto Place at 13511
→ Auto Mills → manual keys → grind. Per `autoplace-compatibility.md` §6, the
Auto Place ownership oracle gives Auto Place priority without reordering, so its
emitted set can only grow (AC3).

---

## 4. The compatibility layer

Four small pieces. Three of them are the **missing halves of mechanisms that
already exist**, not new mechanisms.

### 4.1 Intent metadata — one optional parameter

All ten `addPredictObject` call sites pass exactly three arguments (verified).
An optional fourth is fully backward-compatible:

```js
function addPredictObject(id, angle, preplace, meta) {
    ...unchanged dedup...
    predictObjects.push({ id, angle, name, x, y, scale, preplace, ...meta });
}
```

Auto Place, Auto Mills, the manual keys and grind keep calling it with three
arguments and are byte-identical in behaviour. Only Preplace and Replace pass
`meta`:

```
{ owner: 'preplace' | 'replace',
  mode:  'A' | 'B',          // replace only
  targetSid,                 // replace only — the dying object
  tick, conf, gain }         // provenance for revalidation and logging
```

The dedup logic is untouched. This is conflict-map touch point 1.

### 4.2 Timer snapshot — two lines

The deferred timers currently read the globals `predictObjects` and
`spamPrePlacer` at fire time, 71-96 ms after the decision (conflicts C2, C3).
In the same synchronous scope where they are registered (15454):

```js
const batch = predictObjects.filter(o => o.preplace);
```

and have the commit timer iterate `batch`. This is conflict-map touch point 2,
and it needs no new state.

### 4.3 Commit revalidation — one helper

The missing half of the deferred commit. Whiteout's `check3`
(`Whiteout_v4.js:12592`) is the model: re-derive the placement point from the
player's **current** position, re-run the existing `canPlace`, re-check the
Spike Tick veto, then send — or send nothing.

```js
function revalidate(intent) → boolean
```

It calls `getConfig` and `canPlace` (both existing) and reads the tick context
(§4.4). It introduces no timer and no cancellation machinery: the timer still
fires and declines, which is why no `clearTimeout` appears anywhere in this
design.

### 4.4 Tick context — a memo, not a coordinator

One object built once per tick inside `getPredictObjects`, holding values that
Preplace and Replace would otherwise each recompute:

```
ctx = {
  enemy,                     // current + predicted state, read from the existing
                             //   predictor site (14002-14017), not rebuilt
  apSelectors,               // closestSpikeToEnemy / closestTrapToEnemy /
                             //   closestSpikeToKb against CURRENT state
  spikeTickActive,           // instaKill.length > 0 || insta.*
  spikeTickZone,             // protected annulus, if any
  doomed,                    // Set of sids Replace expects to die this tick
  packetHeadroom             // derived from the existing `packets` counter
}
```

This is a cache with a one-tick lifetime. It makes no decisions and owns no
state beyond the tick. Its justification is the defect it prevents: the shipped
code calls `canTrapTick()` twice per tick from two places (14871 and 13149),
each re-running a 72-angle sweep, and gets two answers that can disagree. A
tick-scoped memo is how that class of bug stops recurring.

`ctx.doomed` is a **Set**, which is what lets Replace reason about several
objects dying to one hit — Luna can only splice one (11814). It is consumed as a
filter predicate on the existing `customObjects` array, not a new collision
routine.

---

## 5. Existing mechanisms whose missing half is supplied

None of these is new infrastructure. Each already exists and is half-wired.

| mechanism | exists | missing half supplied |
|---|---|---|
| `bannedAngles` / `placedAngles` (1471, 12902, 12926) | written by all three commit sites; read **only** by Auto Place | Preplace and Replace **read** it; key it on the intent's `x`/`y` rather than a player-relative angle |
| `spawnedObjectSids` (11979) | written every tick, reset at 13990 | **read** — landing confirmation for Replace's conditional retry |
| `removedObjects` (10577) | written by `killObject`, read at 14139, cleared 13333 | **read** by Replace mode B before the clear |
| `FIX STACK PACKETS` (13324-13333) | detects the tracked object died, writes `placeTick` — read nowhere | the detection drives Replace mode B; the dead `placeTick` write is removed |
| `smartTickSpike` (1473) | written only by Preplace (13443), read nowhere | Preplace writes a *meaningful* value; still read by nobody (`spiketick-compatibility.md` §6) |
| `isAutoPlaceAngle` (13185) | called only by Auto Place | called by Preplace/Replace as the ownership oracle — reuse, not duplication |
| `velocity` flag on `getConfig`/`canPlace` (12782, 12790) | accepted, never passed | passed by Preplace |

---

## 6. What is deleted

Integration is net-negative in several places, which is worth stating because
"add a layer" usually is not:

| removed | line | why |
|---|---|---|
| `canTrapTick()` / `canShamePlace()` calls in `isPrePlaceAngle` | 13149, 13152, 13168 | invariant I1; each re-ran a 72-angle sweep per candidate |
| unconditional `if (isTrap) return true;` | 13178 | strictly more permissive than Auto Place's guarded rule (I3) |
| `placeTick` / `setPlaceTick()` | 12207, 13329, 13562, 13566 | write-only; superseded by real mode-B detection |
| the two wrong-arity sweeps in the 1 ms timer | 15459-15460 | `objects.length` reads `undefined`; result discarded |
| `updateAngles2` | 12912 | never called |
| `minPingTime` as a commit base | 15489 | never decays; clamps to 0 ms before the first ping |

---

## 7. Not built

| forbidden | why it is not needed |
|---|---|
| second placement engine | `predictObjects`/`addPredictObject`/`getPredictObjects` resolve at insertion; gates run before insert |
| resolution pass | insertion-time rejection already yields a conflict-free set |
| second packet scheduler | the existing `packets` counter (1522) with a precedence ordering: Spike Tick > Auto Place > Replace B > Replace A > Preplace |
| second target tracker | shared world block 14120-14149, `enemiesNear` 14084 |
| second predictor | the existing site 14002-14017, extended in place |
| new timers | the existing block 15454-15489 only |
| cancellation machinery | revalidation at commit; the timer fires and declines |
| new commit path | the existing `preplace` boolean routes both |
| angle-distance helper | `UTILS.getAngleDist` (20325) already wraps correctly |

---

## 8. Change surface

Every touched location, so the blast radius is visible before any code exists.

**Modified in place**

| site | change |
|---|---|
| 14002-14017 | extend the existing predictor with direction, stability, error, confidence |
| 12825 `addPredictObject` | optional 4th param spread into the pushed record |
| 12836 `isItemLimit` | restore Luna's correct expression (pending your scope decision) |
| 13342-13509 Preplace branch | replaced by the new gate chain + `smartTickSpike` publication |
| 15454-15489 timer block | snapshot; revalidate before `place()`; drop `minPingTime` |
| 12902-12907 ban write | key on position |

**Added**

| item | size |
|---|---|
| tick context builder | small |
| `revalidate(intent)` | small |
| `usefulness()` — shared scorer for Preplace and Replace | the substance |
| escape-route analysis — port of `src/RYN_Client_v4.js:11935` | ~30 lines |

**Untouched**

`updateAngles`, `checkPredictObjects`, `isAutoPlaceAngle`, the Auto Place branch
(13511-13515), the immediate commit loop, all six Spike Tick predicates, the
`instaKill` ladder and executor, `hatFc`, Auto Mills, the manual place keys,
turret grind, `place()`, `checkItemLocation`, and the packet layer.

---

## 9. Verification

Adds to I1-I14, AC1-AC6, ST1-ST7:

- **IN1** — `predictObjects` remains the only intent queue; no parallel array.
- **IN2** — `addPredictObject` remains the only producer; the ten existing call
  sites still pass three arguments.
- **IN3** — `place()` call sites remain exactly the four at 12746, 15423, 15470,
  15482.
- **IN4** — no `setTimeout`/`setInterval` outside the existing 15454-15489 block.
- **IN5** — no second packet counter; `packets` (1522) is the only budget.
- **IN6** — the tick context is rebuilt each tick and read by nothing outside
  Preplace/Replace.
- **IN7** — no deferred commit sends without `revalidate` returning true.
- **IN8** — for a fixed tick state with Preplace and Replace disabled, the
  emitted packet sequence is identical to today's, `isItemLimit` excepted.

IN8 is the one that matters most: with both new systems off, the client must
behave exactly as it does now.

---

## 10. Still open

Three decisions, unchanged from the previous documents, all of which change what
gets written:

1. **`isItemLimit`** — global fix (recommended), or shadowed into
   Preplace/Replace only to keep Auto Place bit-identical?
2. **Spike Tick imminence** — active-only, cheap-prefix predicate (recommended),
   or one additive line in the Spike Tick block?
3. **Output target** — the blocker. NovaStorm 1.4 is not in this repo, which
   builds `ReUp_Mix.user.js` from `src/RYN_Client_v4.js` via
   `tools/build-reup.js`. Add NovaStorm as its own source with its own build
   path, or port Preplace + Replace onto ReUp Mix's `AutoPlacer`
   (`_preplacer` / `_replacer`)?

Every design document is now complete. Answer 3 and I can start writing code;
answers to 1 and 2 can follow during implementation without rework.
