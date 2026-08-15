# RYN Placement Engine

Rebuild of Auto Place / Preplace / Auto Replace in `RYN_v5.4_Placement.user.js`.
Everything else in the client is untouched.

## Running

```
node placement-engine/tests.js      # 15 combat scenarios, 46 assertions
node placement-engine/compare.js    # old placer vs new engine, same scenarios
```

Both scripts lift the real source out of the built userscript by line range and
run it in a VM against a stub client — the `Vector` class, the item tables, the
spatial grid, `PlayerObject` and the whole placement engine are the exact lines
that ship. `ryn53.baseline.js` is the unmodified v5.3 client, kept so the
comparison has something real to compare against.

## What was wrong with the old placer

| | |
|---|---|
| **It could not place a spike at all in a normal fight** | Every spike branch of `isAutoPlaceAngle` was gated on `enemyTrapped`, except the knockback branch which needs a friendly spike already positioned behind the enemy. Against an untrapped enemy on open ground it placed only traps. |
| **It placed every legal trap angle** | `if (isTrap) return true` when neither player was pinned — no ranking, so a whole tick's packets went to whatever angles came first by index. |
| **Emission order was angle index, not tactics** | The two emit loops walked the 72 buckets from 0 rad up, so a limited budget was spent toward +X rather than toward the enemy. |
| **5° angle buckets** | 72 fixed probes at spike placement radius step ~7px. A free arc narrower than 5° often has no sample in it at all — that is the gap between two structures the placer could never fill. |
| **Box tests instead of circles** | `lineInRect` is an axis-aligned square of half-width `reach`; at 45° it reaches `reach × √2`, so a spike 30px short of ever touching the enemy passed the "catches them on the way" test. |
| **1-tick linear prediction, unsmoothed** | `pos.future` extrapolates one tick from one tick of displacement. One knocked-back or lag-stalled tick swings the heading by a quadrant, and nothing detected a direction change. |
| **Deferred sends were never revalidated** | Preplace and replace fired out of `setTimeout` with the decision computed a tick earlier — stale enemy, stale player position, stale collision. |
| **The ban heuristic banned successful placements** | "I built here last tick and the slot is still free ⇒ the server refused it" is also true whenever the round trip is longer than one tick, i.e. on any ping above ~111ms. Good angles got locked out for 2s at a time. |
| **Replace was not a decision** | `Settings._replace` only armed a third resend of the preplace packet. Nothing identified a structure as bad or compared replacement geometry. |

## What replaced it

Per tick: **track → arcs → candidates → score → emit**.

- **Track** — per-enemy EMA velocity, heading, turn rate, and a confidence that
  drops to zero on a hard direction change and takes the lookahead (0.5–2 ticks)
  with it.
- **Arcs** — the free angular intervals on the placement circle, from the same
  law of cosines `ObjectManager.getBestPlacementAngles` uses. Exact tangents, so
  a gap one pixel wider than the spike still yields a candidate.
- **Candidates** — 3–4 per free arc (both flush edges, midpoint, and the wanted
  direction clamped into the arc) instead of 72 blind probes.
- **Score** — one weighted tactical score plus a priority class. A candidate must
  name a concrete reason (contact, path, gap, escape, seal, knockback, trapped,
  retrap) — being near the enemy is not a reason.
- **Emit** — best-first, budget-aware, revalidated against live state in the same
  statement that sends, with in-flight suppression so a placement is never
  re-sent while the server round trip is still open.

Spike Tick compatibility: the engine never emits on a tick a spike tick owns,
never emits into an angle already used this tick by a tick or a sync, and
publishes its contact-spike angles for `EnemyManager.attemptSpikePlacement` to
fall back on when its own scan finds nothing.

## Measured, 7 scenarios, 2-tick simulated round trip

|  | old | new |
|---|---|---|
| builds sent | 55 | 23 |
| packets spent | 275 | 115 |
| spikes placed | 7 | 23 |
| spikes touching the enemy on arrival | 0 | 8 |
| builds landing >90px past contact | 32 | 3 |
| duplicate sends while a build was in flight | 27 | 0 |
| mean CPU per tick | 0.51ms | 0.13ms |


---

# Ported from Novastorm

Five things taken from `novastorm.v1.4.js` and rewritten onto RYN's managers.
Novastorm is a fork of the old game bundle (`myPlayer.x2`, `items.list`,
`io.send`, `visibleObjects`), so nothing could be copied as code — the rule each
feature implements was ported, and the original condition is quoted in a comment
above every one of them.

`node placement-engine/ports.test.js` — 31 assertions.

| | was | is |
|---|---|---|
| **Autoheal** | eight stacked special cases (trap about to break, melee+ranged combo, reverse insta, tool hammer, ranged bow, danger flags, health < 20), each healing a hand-picked number of food | novastorm's single rule: `potentialDamage + potentialSpikeDamage`, capped at 140, `×0.75` under soldier, `+5` under scuba — heal if that reaches health, or if a tick passed without being hit. RYN's `shameActive` guard and `heal()`'s shame queue stay, novastorm has no equivalent |
| **Anti Smart Tick** | committed the moment it saw the danger; no toggle; approximated the knockback test with a box | novastorm's stall — stop autobreak, hold whichever weapon is still reloading, and only commit when both are ready and there is nothing left to stall on. New `Anti Smart Tick` toggle. Knockback test is now segment-to-circle |
| **Auto Mills** | sandbox only, `age < 20`, stopped once autobuy finished, and needed all three mills placeable — it could not run in a real game | novastorm's combat mill: three windmills dropped behind you, any time, `!nearestTrap`, each of the three tested on its own. Off by default, on the existing keybind. Offset stays RYN's exact solve rather than novastorm's `toRad(scale + scale/2)` approximation |
| **Safe Soldier** | soldier went on at weapon reach + 20px, which is a tick late against anything that closes fast | novastorm's flat 300px radius, as a new `Safe Soldier` toggle, in addition to the existing reach and danger tests |
| **Packets** | budget of 70/sec, counted only what RYN itself sent | novastorm's 119 — the whole server allowance. Safe to take because `socket.send` is now wrapped at the transport, so the game bundle's own frames count too; frames sent through `PacketManager` are skipped there to avoid double counting |
