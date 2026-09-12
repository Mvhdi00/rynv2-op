# Spike Sync 2

An enemy held in your trap, walked onto your spike by Auto Push, gets hit the
moment they meet it — with the swing landing on the same tick the spike is
already hurting them, and Spike KB standing aside so nothing knocks them back
out of it.

The feature already existed and half worked. This is what it was, why it
missed, and what it is now.

## What it was

Three lines, in two places:

```js
// VelocityTick.postTick, *after* its own weapon gate
if (nearestEnemy === null || !isPolearm || !isDiamond || !isReloadedPrimary || !isReloadedTurret) return;
const push = Settings_default._spikeSync2 ? autoPush.pushState() : null;
if (push !== null && push.contact && push.engaged) { /* bull + swing + turret next tick */ }

// SpikeKB.postTick
if (push !== null && !push.contact) return;
```

## Why it missed

1. **It sat behind Velocity Tick's own gate.** That line is there for Velocity
   Tick's knockback combo — a diamond polearm, both reloads, and an enemy near
   enough to throw 220-245 units. The contact burst throws nobody: the victim
   is pinned. But it inherited the whole gate, so a katana never synced, an
   undiamonded polearm never synced, and a turret still reloading blocked a
   swing that does not use the turret until the tick *after*.
2. **It was checked against the wrong target.** The gate required
   `EnemyManager.nearestEnemy` to exist, while the burst hits `push.enemy` —
   a different entity whenever anyone else is closer.
3. **`engaged` is last tick's flag.** It reads `pushPos !== null`, and Auto
   Push clears `pushPos` and returns the moment contact lands. So the pairing
   "the line was up last tick AND they are touching now" had exactly one tick
   to happen, and any hiccup — another module taking the tick, `moveTo`
   claimed, the stand point briefly blocked — lost it silently.
4. **There was no window.** `contact` was the only reading. Nothing was
   prepared in advance, nothing knew the difference between 200 units out and
   one step out, and a missed contact tick simply never came back.
5. **Spike KB was released exactly at contact**, which is the one tick the sync
   wants. It yielded for the whole approach and then took its own swing on the
   contact tick whenever Velocity Tick's gate refused — knocking the victim
   away from the spike it had just been walked onto.

## What it is now

### The ladder (Auto Push)

Auto Push already computes the shove's geometry once a tick. It now also reads
how close the victim actually is, edge to edge:

```
gap = distance(victim, spike) - (victim.collisionScale + spike.collisionScale)
```

| Phase | When |
|---|---|
| `FAR` | nothing closing |
| `APPROACHING` | the gap is shrinking |
| `CLOSE` | two steps out |
| `WINDOW` | one step out — contact lands next tick at this rate |
| `CONTACT` | touching |

The step is what the victim actually moved last tick, floored at one tick of
walking — `playerSpeed / (1 - playerDecel) / serverUpdateRate`, the game's own
numbers, about 25 units, the same derivation Trap Standoff makes. Nothing here
is a tuned threshold: the window is one step because a step is one tick.

`CONTACT` has two independent readings, and either commits:

- this module's swept collision test, `enemy.colliding(spike, scales + 1)` —
  previous, current and future positions against the spike's box, which is the
  same `contact` field Spike KB and Velocity Tick have always read and is
  unchanged;
- `EnemyManager.enemySpikeCollider === enemy` — the manager's own answer, which
  it computes every tick for every enemy against every spike hostile to them.

**Prediction only prepares. Collision commits.** Nothing fires because the
victim is near a spike, moving toward one, or predicted to reach one.

### The event

One shove onto one spike is one event, identified by the `victim:spike` pair.

- A new victim or a new spike is a new event, and anything prepared against the
  old one is dropped — this is what "Auto Push changed its target spike" does.
- It is **consumed** once: the burst calls `autoPush.consumeSync()`, so four
  ticks of contact produce one swing, not four.
- It **expires** after `SYNC_WINDOW_TICKS` (3) if nothing spends it, so a
  window nobody can use hands Spike KB its tick back instead of holding it.
- It falls out of existence with the shove: victim leaves the trap, victim or
  spike disappears, you get trapped, the pair goes out of range — `pushState()`
  returns null and the ladder is torn down in one place.

`syncPending` is the single flag that acts: touching, armed by the shove, not
yet spent, not expired. `armed` means the shove was live on the last completed
tick **or** the victim was already one step out on it — the widening that stops
a fast contact from falling through the gap, while still refusing an enemy who
arrived at a spike without this module walking them there.

### The burst (Velocity Tick)

Unchanged in shape — it is Velocity Tick's own second-tick burst, reused, not
recreated:

```
moduleActive, useAngle -> the victim, forceHat 7 (bull), forceWeapon 0,
shouldAttack, moveTo -> the victim, then the turret hat on the next tick
```

What changed is where it sits and what it asks. It is now taken **before**
Velocity Tick's own gate, and its preconditions are Spike KB's, asked on Spike
KB's own module against the victim the shove names:

- a primary Spike KB would swing (`spikeKB.isValidPrimary` — katana or polearm)
- reloaded **now** (`isReloaded(0)`, not Velocity Tick's one-tick lookahead)
- the victim inside that weapon's reach (`range + hitScale`)

No turret requirement: the turret is the follow-up, and it checks itself.

### The yield (Spike KB)

```js
if (push !== null && (!push.contact || push.syncPending)) return;
```

Two holds, both self-releasing: the approach, as before, and now the contact
window while it is live and unspent. The moment the burst fires, the event is
consumed and the hold is gone; so is it if the window expires, the victim comes
off the spike, or the shove ends. Nothing is disabled — Spike KB keeps its own
follow-up tick, its own targets and every other case it handles, and stands
aside for one target for as long as that target's window is open.

Velocity Tick runs before Spike KB in `ModuleHandler.modules`, so on the tick
the burst fires, `moduleActive` has already stood Spike KB down anyway; the
flag is what covers the ticks around it.

## What it costs

Nothing measurable. The ladder is a subtraction, a comparison and two integers
kept between ticks, inside the geometry Auto Push already computed once a tick
and memoises for its three readers. No new loop, no new interval, no new grid
query, no world scan, no second prediction engine, no packet path of its own —
the burst writes the same `ModuleHandler` fields every other module writes, and
the existing packet layer sends them.

With nobody trapped, `pushState()` returns null on the first candidate check
and the ladder never runs.

## Settings

None. Spike Sync 2 is still the existing `_spikeSync2` switch (Combat →
Sync → Spike Sync 2), Auto Push is still `_autoPush`, and no key, slider or
toggle was added. `defaultSettings` and both menu pages are byte for byte the
ones the previous commit shipped.

## Where it lives

| Piece | Anchor | Line |
|---|---|---|
| Ladder constants | `const SYNC_PHASE_FAR = 0;` | ~9869 |
| The derived step | `const SYNC_PUSH_STEP` | ~9881 |
| Window lifetime | `const SYNC_WINDOW_TICKS = 3;` | ~9886 |
| Event teardown | `_syncReset()` | ~9955 |
| Consumption | `consumeSync()` | ~9964 |
| The ladder itself | `_syncLadder()` | ~10152 |
| Exposed to readers | `syncPending: geo.syncPending` in `pushState()` | ~10267 |
| The burst | `if (push !== null && push.syncPending)` in `VelocityTick.postTick` | ~20872 |
| The yield | `(!push.contact \|\| push.syncPending)` in `SpikeKB.postTick` | ~21661 |

## Checked

`node --check`; 52/52 game hooks still bind (`tools/check-hooks.js`).

A harness lifts the real `AutoPush`, `VelocityTick` and `SpikeKB` out of the
file and runs them tick by tick in the order `ModuleHandler.modules` runs them,
against stubbed managers — 37 cases:

- the ladder, far to touching, with nothing firing before contact
- the burst's shape, and the turret on the tick after
- four more ticks of contact producing no second burst
- Spike KB holding through the approach and through the window, and released
  the tick after
- a window nobody can spend expiring inside its stated life
- victim leaves the trap; victim moves away; spike swapped; victim swapped;
  spike gone; victim gone
- two contacts in a row producing two bursts
- a katana with no diamond and no turret syncing — the gate that used to block
  everything
- the sync running with Velocity Tick off, and not at all with Spike Sync 2 off
- an unreloaded primary, an out-of-reach victim and a lethal-threat tick each
  refusing
- contact with no shove behind it refusing
- `EnemyManager.enemySpikeCollider` alone committing the window
- Velocity Tick's own combo still arming and still swinging

And a scope check proving `EnemyManager`, `TrapKB`, `AntiSpikePush`,
`SpikeSync`, `TrapStandoff`, `NovastormHeal`, `ModuleHandler.startMovement`,
the module order, the push overlay, Auto Push's chicken geometry and
pathfinder, Velocity Tick's own band and both modules' follow-up ticks are
identical to the commit before this one, and that no new setting is read
anywhere.

Not checked here: a real fight. The sync is a timing loop against a live
server, and nothing in this repo can stand in for that.
