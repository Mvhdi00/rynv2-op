# NovaStorm 1.4 — placement conflict map

Interaction between Auto Place, Preplace, Replace and Spike Tick. Line numbers
refer to `novastorm_1.4_ryn.user.js` as supplied.

**Headline: a coordination layer already exists.** It is `predictObjects` +
`addPredictObject` + `getPredictObjects`. It arbitrates *space* correctly and
*time*, *ownership* and *outcome* not at all. Nothing below proposes a new
scheduler, queue or manager, because building one would duplicate what is
already there.

---

## 1. Which system owns placement execution

**No system owns it. Execution is split across three sites, and none of them
belongs to a placement system.** All three live in `updatePlayers` (13982) or in
timers it registers.

| site | line | fires | places |
|---|---|---|---|
| immediate loop | 15419-15426 | in the tick body | every `predictObjects` entry with `preplace === false` |
| preplace commit | 15465-15474 | `111 - tickPing()` ms | every entry with `preplace === true` |
| replace commit | 15476-15489 | `111 - minPingTime` ms | the same entries again, if `spamPrePlacer` |

So execution is owned by **the `preplace` boolean on each queue entry**, not by
the system that produced it. Auto Place, Auto Mills, the manual place keys and
the turret-grind pusher all set `preplace: false` and therefore share the
immediate loop; only Preplace sets `true`.

`place()` (12737) is called from exactly four sites in the file — the three above
plus `heal()` (12746). Confirmed by enumeration; the render loop places nothing.

Spike Tick is not in this table at all: **it never places.** It writes a token
queue (§6).

---

## 2. Does a coordination layer already exist

Yes, partially. Five pieces are already in place:

| piece | line | what it coordinates |
|---|---|---|
| `predictObjects` | 12208 | the shared intent queue |
| `addPredictObject` | 12825 | single entry point + spatial arbitration |
| `getPredictObjects` | 13322 | single decision point, once per tick at 15416 |
| producer call order inside it | 13476 → 13557 | an implicit priority ladder |
| `placedAngles` → `bannedAngles` | 12902-12907, 12926 | outcome feedback (one-directional) |

**What it does coordinate:** two intents cannot occupy overlapping space in the
same tick. `addPredictObject` rejects any candidate within `config.scale +
object.scale` of an already-queued entry.

**What it does not coordinate:**

- **Time.** The queue has no notion of when an entry will be sent. Entries
  decided together are executed up to 111 ms apart.
- **Ownership.** An entry records `{id, angle, name, x, y, scale, preplace}` and
  nothing about which system produced it, what it was aimed at, or when it
  expires.
- **Outcome.** Nothing records whether a send landed.
- **Budget.** Each execution site independently checks `packets + 5 > 119`
  against a counter reset on an unsynchronised 1-second interval (20185).

---

## 3. Do placement intents already exist

Yes. `predictObjects` **is** an intent queue, and `addPredictObject` (12825) is
its single constructor:

```js
function addPredictObject(id, angle, preplace) {
    let config = getConfig(id, angle);
    for (let object of predictObjects) {
        if (object.id != 17 && UTILS.getDistance(config.x, config.y, object.x, object.y) < (config.scale + object.scale)) return;
    }
    predictObjects.push({ id, angle, name: items.list[id].name, x: config.x, y: config.y, scale: config.scale, preplace });
}
```

Every placement in the mod passes through it — ten call sites, verified by
enumeration:

| producer | lines | flag |
|---|---|---|
| **Preplace** | 13476 | `true` |
| **Auto Place** | 13049 (perfect), 13056 (placeable) | `false` |
| Auto Mills | 13524, 13528, 13532 | `false` |
| manual trap / turret / spike keys | 13539, 13545, 13551 | `false` |
| turret grind | 13557 | `grindObj.preplace` (always `false`, set at 15033-15046) |

Two properties worth noting because they are already doing arbitration work:

- **Turrets (id 17) are exempt from dedup.** `object.id != 17` lets multiple
  turret intents stack, which the three-turret grind pattern at 15030 relies on.
- **Producer order is a priority ladder.** Preplace runs first inside
  `getPredictObjects` (13342-13509), before Auto Place (13511), Auto Mills,
  manual keys and grind. Because dedup rejects later overlapping intents,
  **Preplace already outranks Auto Place spatially.** That is existing behaviour,
  not something to add.

The record is the right shape; it is simply missing fields.

---

## 4. Is target tracking shared

Partly, and unevenly.

**Shared world state**, computed once per tick and read by all four systems:
`visibleObjects` (14122), `spikes_our` / `traps_our` (14126-14127),
`nearestEnemy` (14089), `imTrapped` (14131), `nearestTrap` (14149),
`spikeDmgCount` (14503).

**Not shared — each system tracks its own target:**

| system | target | line |
|---|---|---|
| Preplace | `findObject` — the doomed object; `lastPrePlaceObject` carries it one tick | 13343, 13504 |
| Spike Tick | `smartTickObject` — the object to hammer | 12560 |
| Auto Place | none — reasons only about the enemy | — |
| Replace | none — inherits Preplace's decision | — |

`enemiesNear` (14084) and `nearestEnemiesCount` (14092) are computed every tick
and **no placement system reads them**; all four narrow to `nearestEnemy`.

**One vestigial coupling.** `smartTickSpike` (1473) is a Spike-Tick-named global
that only Preplace writes — nulled at 13344, assigned at 13443 inside Preplace's
knockback scorer — and **nothing reads it anywhere in the file**. It is a
half-finished channel from Preplace to Spike Tick. Contrast `smartTickObject`,
which is genuinely live (written 12560, read 14891-14892).

---

## 5. Is prediction shared

Yes — one predictor, used by everything, and it is the weakest link.

```js
tmpObj.xVel = tmpObj.x2 * 2 - lastX;      // 14016
tmpObj.yVel = tmpObj.y2 * 2 - lastY;
```

One tick of linear extrapolation, computed during the update parse for every
player. All four systems consume `x2,y2 → xVel,yVel` as the enemy's movement
segment. Nothing consults `config.playerSpeed` (0.0016, 16816) or
`config.playerDecel` (0.993, 16817), both present in the file.

Also shared: `predictMoveAngle` (14524), used by Preplace's LOS test
(13101-13105) and Auto Place's (13199-13203) — and `null` whenever the player
stands still, so `Math.cos(null) === 1` puts both lookaheads 222 units due east.

Also shared: `predictWeapon` (14680), which Spike Tick's executor **overwrites**
(14899, 14912) and every `place()` then re-selects (12741). See §8.

Because prediction is already single-sourced, improving it is a change in one
place that all four systems inherit — no new plumbing needed.

---

## 6. Is packet scheduling shared

**No. This is the largest genuine gap.**

There is no scheduler. Each site independently decides when to send:

```
heal()          15411   immediate, N x place(), 4 packets each, unbounded by any guard
Auto Place      15419   immediate, guard: packets + 5 > 119
Preplace warm   15455   +1 ms,     no guard (1 packet)
Preplace commit 15465   +111-ping, guard: packets + 5 > 119
Replace commit  15476   +111-minPing, guard: packets + 5 > 119
Spike Tick      15395   via hatFc() -> storeEquip, no guard
direction       15430   immediate, no guard
```

The shared budget is a single counter, `packets` (1522), incremented in
`io.send` (20182) and zeroed by a free-running 1-second interval (20185). Since
ticks are 111 ms, the reset lands at an arbitrary phase — so the guard is a
rolling per-second count consulted at four unsynchronised moments, not a per-tick
budget.

Concretely: `heal()` can spend 20+ packets before Auto Place's guard is first
evaluated, and the Preplace guard runs ~111 ms later against a counter that may
have been zeroed in between.

One preplaced object costs 11 packets per tick (1 + 5 + 5) ≈ 99/s at 9 ticks/s,
against the ~120/s the guards imply — before Auto Place, healing, hats and
direction sends draw on the same budget.

---

## 7. Where duplicate actions can occur

**D1 — Replace duplicates Preplace by construction.** The `111 - minPingTime`
timer (15476) re-sends the identical `place(object.id, object.angle)` with no
success check. `spawnedObjectSids` — the signal that would answer "did it land?"
— is written at 11979, reset at 13990, and never read. This is the intended
behaviour of Replace, but it is unconditional: `spamPrePlacer` is set whenever
`getPrePlaceObject()` returns anything (13316).

**D2 — the same angle is sent up to three times per tick.** Immediate loop (if
Auto Place chose a non-overlapping angle), preplace commit, replace commit.
`place()` re-sends `selectToBuild` and `selectWeapon` every time with no dedup
against the currently-selected build index or weapon (12737-12742), so 4 of every
5 packets in each commit are redundant state-setting.

**D3 — `canTrapTick()` and `canShamePlace()` are evaluated twice per tick for
different purposes.** `canTrapTick()` at 14871 as Spike Tick's trigger, and again
per-angle at 13149 inside `isPrePlaceAngle`. `canShamePlace()` at 13152 and
negated at 13168. Each call re-runs a full 72-angle sweep, and the two
evaluations can legitimately disagree because state moves between them.

**D4 — `checkPredictObjects` computes both item sets twice.** `updateAngles` is
called for spikes (13513) and traps (13514); each call runs the spike, trap and
knockback scans, then discards the wrong half via `a.id !== myPlayer.items[2]`
(12934) / `[4]` (12953).

**D5 — the dead sweeps.** The 1 ms timer calls `getPrePlaceAngles` twice with
`object.id` where `customObjects` is expected (15459-15460); `objects.length`
reads `undefined`, every angle trivially passes, and the result is discarded.

---

## 8. Where conflicting actions can occur

**C1 — Preplace can starve Auto Place.** Preplace queues first (13476) and wins
dedup, but commits ~111 ms later (15465). Auto Place's overlapping candidates
were already rejected at 12828 and never re-offered. If the preplace commit is
skipped — packet guard trips at 15468, or `predictObjects` was replaced by the
next tick — **the space was reserved and then not used, and nothing was placed
there at all**.

**C2 — the deferred timers read mutable globals, not a snapshot.** Timers C and D
iterate the global `predictObjects` and read the global `spamPrePlacer` and
`placedAngles` at fire time. `getPredictObjects` clears and repopulates
`predictObjects` every tick (13336). Under jitter a timer from tick N can act on
tick N+1's queue, or on an empty one. There is no `clearTimeout` anywhere in the
placer — verified by enumerating every `clearTimeout`/`clearInterval` site; the
only relevant one is `antiTickTimeout` (13710).

**C3 — timer D can fire before timer A.** `minPingTime` (16523) starts at
`Infinity`, so `111 - Infinity` clamps to 0 ms and Replace fires **before**
`getPredictObjects()` has run for the tick, acting on the previous tick's queue
and flag.

**C4 — Spike Tick steers Preplace's and Replace's packets.** Its executor sets
`predictWeapon` (14899, 14912), which every `place()` re-selects at 12741; and
`autoaim`/`autoaimAngle`, which `getAttackDir()` returns first (10283-10285) and
which all three commit sites send as `io.send("D", ...)` (15461, 15472, 15484).
Spike Tick therefore decides the weapon and facing that the placement systems
restore, without either side knowing.

**C5 — Preplace consumes Spike Tick's predicates as gates.** `isPrePlaceAngle`
rules 1 and 2 call `canTrapTick()` (13149) and `canShamePlace()` (13152), and
rule 3 negates `canShamePlace()` (13168). Turning the "Spike Tick" toggle on
(`window.vars.shameTick`, default off) therefore changes which angles Preplace
considers valid — a documented-nowhere dependency between two menu options.

**C6 — the ban channel runs backwards.** Preplace and Replace push into
`placedAngles` (15471, 15483) and so create bans that suppress **Auto Place**
(read only at 12926, reachable only from `updateAngles`). Neither Preplace nor
Replace consults `bannedAngles` itself. The component most likely to spam a
failing angle is the one with no feedback; the component with feedback is the one
being suppressed by it.

**C7 — bans are position-blind.** `bannedAngles` is keyed on a raw
player-relative angle with a fixed `tick + 18` expiry (12905). Any movement
re-aims that angle at different world geometry, so the "still placeable ⇒ the
placement failed" inference is unsound exactly when the player is moving.

**C8 — `heal()` competes unguarded.** It loops `place(items[0], null)` (12746) at
4 packets each with no budget check, immediately before the Auto Place loop that
does have one.

---

## 9. The smallest integration point

The coordination layer exists. **Do not add a scheduler, a placement manager, an
intent bus or a second queue** — `predictObjects` / `addPredictObject` /
`getPredictObjects` already are those things.

What is missing is that the intent record carries no metadata and the deferred
timers re-read globals instead of the decision they were created from. Both are
fixable at **two touch points**, and one of them is a single function.

### Touch point 1 — `addPredictObject` (12825), the sole intent constructor

Extend the object literal that is already being pushed. No signature change is
strictly required if the extra fields are derived from existing tick state:

```
{ id, angle, name, x, y, scale, preplace,          // existing
  owner, targetSid, tick }                          // added
```

`owner` makes the implicit producer ladder (§3) explicit and inspectable.
`targetSid` is the doomed object's sid, already in hand as `findObject.sid` at
the Preplace call site. `tick` is already a global.

This is the single point every placement in the mod flows through — ten
producers, one constructor — so it is the cheapest place in the file to attach
anything.

### Touch point 2 — the timer registration block (15454-15489)

Capture the decision instead of re-reading it. In the same synchronous scope
where the timers are registered:

```
const batch = predictObjects.filter(o => o.preplace);   // snapshot
const spam  = spamPrePlacer;                            // snapshot
```

and have timers C and D iterate `batch` / test `spam`. That alone closes C2 and
C3, needs no new state, and cannot affect Auto Place, Auto Mills, the manual keys
or Spike Tick, because none of them reads the preplace branch of the queue.

### What each conflict costs to close, from those two points

| conflict | closed by |
|---|---|
| C2, C3 | touch point 2 alone |
| C1 | `tick` + `targetSid` on the record; release the reservation when the commit is skipped |
| D1 | `targetSid` + reading `spawnedObjectSids` (already collected, never read) |
| C6, C7 | key the existing ban map on the intent's `x`/`y` instead of its angle — the fields are already on the record |
| D3 | memoise the two predicates per tick — no new structure, just a tick-stamped cache |
| C4, C5 | documentation and ordering, not new infrastructure |

### Explicitly not needed

- a new queue — `predictObjects` exists
- a new dispatcher — `getPredictObjects` is already the single decision point
- a new dedup/arbitration pass — `addPredictObject` already does spatial dedup
- a new priority system — producer call order is already a ladder; make it
  explicit via `owner` rather than replacing it
- a new feedback structure — `placedAngles`/`bannedAngles` exists and needs
  rekeying, not replacing
- a new packet budget — `packets` exists; the gap is *where* it is consulted, not
  that it is missing
- a new prediction path — `xVel/yVel` is already single-sourced (§5), so
  improving it is one edit that all four systems inherit

---

No NovaStorm code has been modified.
