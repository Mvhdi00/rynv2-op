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
