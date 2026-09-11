# Auto Push — chicken v4.6.2's shove on RYN's modules

`AutoPush` in `Ryn_Type_2.user.js` now runs chicken v4.6.2's `autoPush()`
geometry instead of RYN's own. The module's shape — its name, its slot in
`ModuleHandler.modules`, `pushPos`, `pushState()`, the arbitration line — is
unchanged, because three other modules and the overlay are written against it.

## What changed inside

| | before | after |
|---|---|---|
| Stand point | spike + `dist + collisionScale + 7` | chicken's `dist + 72` |
| Pressing in | none | chicken's `g -= 18`, floored at `scale + 96` |
| Two spikes | the nearer one | chicken's seam: the midpoint, scale averaged × 0.9, floor trimmed 10 |
| Hazard on the spot | not tested | chicken's `dist <= scale + 35` on anything hostile that damages |
| Something solid there | shove abandoned | still abandoned, or routed around with Pathfinding on |
| Obstacle between you and it | walked into it | A* around it (Pathfinding on) |
| No route | — | chicken's pathfindOverride: walk straight at it inside 175 |
| Far approach | walk to `dist + 250` until the line closes | unchanged |

## What did not change

`pushState()` still returns `{ enemy, spike, contact, engaged }` — the contract
`VelocityTick` (Spike Sync 2) and `SpikeKB` read, with `contact` still measured
as `enemy.colliding(spike, enemy.collisionScale + spike.collisionScale + 1)`
against the real spike object rather than a two-spike midpoint, and `engaged`
still meaning "the purple line was up last tick". Chicken's geometry is added
after those four as `first`, `last`, `path`, `dist`, `ang`, `scale`, `isSpike`
and `double`.

`TrapStandoff` still stands down on `moveTo !== "disable"`, which this module
still sets the moment it engages. `EnemyManager.nearestEnemyPush` and
`nearestPushSpike` are still where the candidates come from, still cleared at
the top of `postTick` and re-set only when a shove is actually made.
`ModuleHandler.moveTo` is still the only way movement is expressed.

Verified byte-for-byte: `VelocityTick`, `SpikeKB`, `TrapStandoff`,
`EnemyManager`, `ModuleHandler.startMovement`, the module order and the push
overlay are identical to the commit before this one. The whole diff is three
regions — the `AutoPush` class, two settings keys, two menu rows.

## Where chicken's candidate scan went

chicken collects its own candidates: every enemy within 250, every friendly
spike within `autoPushDistance`, first enemy in a trap with a spike near it.
RYN does that scan before any module runs — `EnemyManager` finds an enemy held
in *our* trap and a spike or cactus hostile to *them* sitting against it — and
three modules read the result. The brief says both "collect them like chicken"
and, three times over, "use `EnemyManager`'s pair, do not replace them"; the
hard constraint wins, so the pair stays EnemyManager's and only chicken's
*geometry* is new. The one piece of chicken's scan that had no equivalent —
the second spike of a pair — is looked for around EnemyManager's choice, by
EnemyManager's own hostility rule.

chicken's `keys[16]` (hold shift to suspend) is not ported; RYN has no such
convention.

## Settings

| Key | Default | Where |
|---|---|---|
| `_autoPush` | `true` | Combat → Movement → Autopush |
| `_autoPushRange` | `250` | Combat → Movement → Auto Push Range |
| `_autoPushDistance` | `300` | Combat → Movement → Auto Push Distance |
| `_autoPushUsePathfinding` | `false` | Combat → Movement → Auto Push Pathfinding |

`_autoPushRange` is chicken's hard `250` on the victim, which RYN already
exposed under that name. `_autoPushDistance` is chicken's own setting, at
chicken's own default, measured to the spike. It is a **new gate**: a spike
further than 300 from you now refuses the shove where it used to be attempted.
Geometry keeps that band narrow — the spike is against the trap the victim is
in, and the victim is inside `_autoPushRange` — but if a long-range shove stops
engaging, that slider is why.

`_autoPushUsePathfinding` defaults **off**, which is RYN's behaviour exactly:
something solid on the stand point ends the shove. On, the route goes around.

## The pathfinder

chicken's `doPathFind`, `getNeighbors` and `PathfindNode`, folded into
`_findPath`. Same 10-wide grid stepped two cells at a time, same box (the two
points grown by twenty cells), same eight neighbours, same unit step cost, same
wall rules: anything solid, padded 35 when it also damages; an enemy player,
padded 40; chicken's `moreTrash` — the seam between spike and victim — walled so
the route goes around the shove rather than through it; and the goal is never a
wall.

Three things are not chicken's, all for the same reason — this client may be
driving twenty bots at nine ticks a second where chicken drives one player:

- nodes are built when first reached, not all upfront
- the open set is a binary heap, not an array rebuilt with `filter()` per expansion
- the search is bounded (400px, 2600 nodes, 900 expansions) and an exhausted
  budget answers "no route", which is what a failed search already meant

And one behavioural shortcut: the search runs only when the straight line is
actually blocked. A route around nothing is the straight line RYN already had.

Measured worst case on this machine: **0.09ms** for a search that routes,
**0.06ms** for one that exhausts its budget — under a tenth of a percent of a
111ms tick. Failed searches are remembered for 3 ticks; successful ones are not
cached, because a stale leg walks the wrong way.

## Where it lives

Line numbers are from the commit that added this and will drift.

| Piece | Anchor | Line |
|---|---|---|
| Ported constants | `const CHK_PUSH_STANDOFF = 72;` | ~9819 |
| `_hurtsVictim()` | EnemyManager's hostility rule, reused | ~9914 |
| `_pushTarget()` | chicken's two-spike seam | ~9935 |
| `_geometry()` | the stand point, once per tick | ~9986 |
| `pushState()` | the four-field contract | ~10072 |
| `_hostileAt()` | chicken's `scale + 35` refusal | ~10111 |
| `_solidAt()` | RYN's own refusal, unchanged | ~10136 |
| `_lineBlocked()` | is a search even needed | ~10156 |
| `_findPath()` | doPathFind + getNeighbors + PathfindNode | ~10216 |
| `_nextLeg()` | chicken's `path[1]` | ~10448 |
| `_engage()` | pushPos, moveTo and the two candidates | ~10460 |
| `postTick()` | the arbitration and the walk | ~10468 |
| Settings | `_autoPushDistance: 300,` | ~24262 |
| Menu rows | `id=\"_autoPushDistance\"` in `Combat_default` | ~1704 |

## Checked

`node --check`; 52/52 game hooks still bind (`tools/check-hooks.js`); a harness
that lifts the real `AutoPush` and the real `Vector` out of the file and runs
51 cases against stubbed managers — the pushState contract and every null case,
the 72 stand point, the 18 shrink and its floor, the two-spike seam, the hazard
and solid refusals, routing around a wall, being boxed in, the override, the
negative cache, one grid query for three consumers, and `reset`.

Not checked here: a real fight. The shove is a movement loop against a live
server, and nothing in this repo can stand in for that.
