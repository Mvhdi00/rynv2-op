# Ryn Type 2: Auto Place and Spam Preplace upgrade

Changes are confined to `Ryn_Type_2.user.js`: the existing `AutoPlacer` (Auto Place) and the
Spam Preplace paths of `RynPlacementEngine`. There are no new buttons, toggles, settings, menus
or UI, and no new placement system. Everything runs under the existing **Autoplacer**,
**Preplace**, **Spam Preplace** and **Retrap Resend** controls.

## Game rules the logic is built on

These come from the shipped bundle (`moomoo_1.js`) and RYN's own handlers:

| Rule | Source |
|---|---|
| A build is resolved when its packet arrives. It is refused if any object is closer than `newScale + (blocker ‖ scale)`. Two traps therefore need 100 units between centres. | `checkItemLocation`, `buildItem` |
| A trap locks a player whose centre is within `35 + 50 × 0.2 = 45` of it. | `checkCollision` (`lockMove`); RYN `EnemyManager.checkCollision` uses 46 |
| Each player update zeroes velocity if `lockMove` was set, clears the flag, moves, then re-sets it on contact. A player freed by their own swing on tick *b* cannot move until *b+2*. | server player update |
| A swing fires on the tick *after* the reload runs out (`reloads > 0 ? reloads -= dt : gather()`), and only the weapon in hand reloads. | server player update |
| Our builds land on a ring 80 units from us (`35 + scale + placeOffset`). | `getItemPlaceScale` |

Oracle's useful technique was predicting the break from "weapon just off reload and health ≤ one
swing", then sending offset by ping. Its weakness is fixed offsets (`111 − ping/2`,
`111 − ping`, `111 − minPing`) that ignore which tick the break actually lands on.

## Shared break clock: `RetrapForecast`

Predicts `T_break` for the trap holding the enemy, in server ticks. It is memoised per tick,
so Auto Place and the engine read the same answer.

- **Actors:** the holder plus the two nearest other enemies in reach. An actor counts toward the
  expected break only if they have actually swung within their cadence.
- **Cadence:** measured live per actor and weapon from consecutive `lastAttacked` stamps. Until
  it is measured, the break is bracketed between the reload counter's maximum (`ticks`) and one
  past it (`latest`).
- **Reload elapsed:** read from the exact last-swing stamp, because RYN's counter caps at its
  maximum.
- **Damage:** `getBuildingDamage`, with tank damage used for `earliest`.
- **Confidence:** observed health loss, recent attack animations, or a trap already inside one
  swing.

## Auto Place: 4-way escape containment (`AutoPlacer`)

**When** the enemy is held by our trap and the forecast break falls within the round trip plus
one tick, it runs before the existing ladder.

**Model:** four ways out (away from us, left, towards us, right). For each one:

1. A way already closed by one of our traps or by a solid build is skipped.
2. The legal samples of the existing trap scan table that catch the escape line within a few
   ticks' walk are collected.
3. An exhaustive search over at most 12 candidates and sets of at most 4 picks the smallest
   non-overlapping set that closes the most (weighted) ways.

Nothing is built for a way that no legal spot covers.

**Geometry limit:** from one standing position, while the old trap still stands, the formation
reaches at most **3**. Over a 2,880-position sweep it produced 3 traps on 36 positions, 2 on
253, 1 on 1,285 and 0 on 1,306. "Away from us" can never be covered from our ring. That fourth
way is covered by Spam Preplace's slot replacement, since a trap on the enemy's own position
closes every direction.

**Preparation:** while an enemy is held by our trap, the extra scanners fill open ground with
spikes only. Otherwise they spend the six-trap cap and the ground beside the enemy on traps
facing nobody. The ladder itself is unchanged.

## Spam Preplace: predictive replacement cycle (`RynPlacementEngine`)

**Predict.** `T_break` is re-solved every tick. `Enemy_position(T_break)` is the enemy's current
position, since they are pinned. If our earliest send can only arrive late, it is moved along
the escape line by the measured speed. The replacement aims at whichever of "the enemy" or "the
old slot" lands nearer them on the ring, legal once the trap is gone.

**Send.** The window of send delays that reach the server inside `[S(b), S(b+1))` is
`[n·T − RTT + J, (n+1)·T − RTT − J)`, where:
- `RTT` is `SocketManager.pong`;
- `J` is the jitter, taken as the larger of the measured tick-arrival spread and half of
  `pong − minPingTime`.

The pipeline's own send goes out on the tick whose update, answered at once, lands inside that
window. Timers fill the rest of the window from its earliest legal instant, spaced by `max(8, 2J)`
ms. The **Retrap Resend** slider sets the ceiling, scaled by confidence. One send is held back
for the late end of the bracket.

**Confirm.** The deletion packet cancels any timers that haven't fired. If a send is already in
flight past the break, the reactive duplicate stands down, its ground is held, and Auto Place
skips it. The next tick confirms the target is held by the new trap and opens the next cycle on
it in the same pass (`stats.retrapHeld` / `retrapMissed`).

**Guard.** A predicted break that passes with the trap still standing counts as a miss. Each
miss halves the timer budget, and two misses stop speculative sends until the deletion packet
arrives.

**Pre-existing bug fixed (scoped).** The attrition sweep skipped every pit trap as
`hideFromEnemy`, including the one the enemy is standing in. That made RYN's whole retrap path
(`holdsTrap`, Retrap Resend) dead code. With Spam Preplace on, the trap holding the target is
now counted. Spam Preplace off behaves exactly as before.

## Validation

Run `node tools/test-ryn-type2-placement.js`. It extracts the real classes from the userscript
(modified, plus the baseline from git) and drives them with a virtual clock against a server
model built from the rules above. It passes 24/24:

| Scenario | Baseline | Upgraded |
|---|---|---|
| 1. Trapped, not being broken | – | no containment, no timed sends |
| 2. Forecast vs. real break tick (last 3 ticks) | – | 18/18 inside bracket, 16/18 exact |
| 3–4. Holder breaks out and walks at once (RTT 60–140) | 36/36 held | 36/36 held |
| 3b. Teammate breaks it from outside (no `lockMove` carry) | 12/24 | **24/24** |
| 5. Formation size by geometry | – | 3 / 2 / 1 / 0; never > 4 |
| 6. Walls on chosen spots | – | 0/12 refused, never on the wall |
| 7. Rapid repeated breaks (21) | – | 21/21 held, no stale timers |
| 8. RTT 180–320 ms, jitter ±15–30 ms | 8/24 | **24/24** |
| 9. Continuous replacement (17 cycles) | 6.3 sends/cycle, 87 refused | 5.4 sends/cycle, 71 refused |
| 9b. Enemy stops one hit from breaking | – | 4 sends, then stops |
| 10. Outside these scenarios | – | identical to baseline (40/40 boards; 12/12 with Spam off) |

Per-tick cost is a p99 of about 2 ms per module against a 111 ms tick. `verify-drivers` still
matches the shipped bundle.

## Notes

- Spam Preplace still needs **Preplace** on, as before, because it modifies preplace sends.
- The Retrap Resend menu text still describes the old swing-count ramp. It was left untouched
  (no UI changes). The slider now sets the ceiling of timed sends per predicted break window.
- The server's internal tick rate isn't in the client bundle, which is why cadence is measured
  rather than assumed.
- The existing early spam sends for *spikes* near the enemy are unchanged.
