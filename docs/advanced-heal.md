# Advanced Auto Heal (Ryn Type 2)

The heal in `Ryn_Type_2.user.js` was novastorm 1.4's: predict what can land on
this tick, and if the number reaches your health, eat the whole deficit. One
question, one answer, one site in the tick.

This adds four tiers around that question, a key for eating on demand, and a
HUD line that says which tier is live. It is still **one switch** — Combat →
Defense → Autoheal. Everything here lives under that switch as constants, with
no settings, sliders or bindable keys of its own.

## The tiers

| Tier | When | Foods |
|---|---|---|
| **3 CRIT** | health at or under **25** | the whole deficit |
| **2 HIGH** | `health <= totalDmgPot` — novastorm's own verdict, after the hat terms | the whole deficit, capped at 4 |
| **1 CHIP** | `spikeDmgCount > 0` — a spike is landing tick after tick | 2 |
| **0 IDLE** | nothing to answer | none |

Tier 2 is the rule that was already there, so novastorm's heal is not gone —
it is the middle tier with two more around it. With apples (20 each) a
75-health deficit is 4 foods, so the cap never trims a tier-2 heal in practice;
it is a ceiling, not a change. Tier 3 is new: below 25 health an *unpredicted*
hit is lethal too, so that tier stops waiting for the prediction to agree.
Tier 1 is new: a chip that is not lethal yet becomes lethal in two ticks.

## Refusals

A heal never goes out when any of these hold:

- not in the game, or already at full health
- `shameCount >= 7`, or `shameActive` — the server is refusing food
- a food already went out on this tick (`lastHealTick`)
- the heal cooldown has not elapsed (`HEAL_COOLDOWN_MS`, 50ms)
- the packet budget cannot afford one more food (`packetCount + 3 > 119`)
- **tier 1 only**: a manual build is in progress, or shame has reached 4

The last two differ from the brief they were written to, and both are
deliberate:

- **Mid-build.** novastorm refuses to eat while a build is selected
  (`buildIndex >= 0`) because in the vanilla client the food swap loses the
  placement. Ryn Type 2 cannot lose a placement that way — `requestPlace` and
  `resendPlace` each select their own item immediately before their attack — so
  the guard is kept only on tier 1, where the heal is optional. A lethal tick
  is not the moment to protect a spike.
- **Shame headroom.** Tier 1 eats on exactly the ticks that cost +1 shame
  (inside 120ms of a hit). Left alone it walks the count to 7 in under a second
  and takes tiers 2 and 3 down with it, so it stops at 4 and leaves three heals
  in hand. Tiers 2 and 3 keep novastorm's full wall at 7.

novastorm's recovery heal — the `(tick - damageTick) > 0` top-up that walks the
shame count back down on a quiet tick — is untouched and still runs at shame 7,
which is the only way the count ever comes down.

## Fast Heal — hold **Q**

Held, not toggled. While the key is down, each tick eats the whole deficit
regardless of the prediction, and regardless of whether Autoheal is on at all.
It still stops at shame 7 and still takes the packet trim.

The key is the constant `HEAL_FAST_KEY`, fixed at **KeyQ** — which is also the
food hotkey's default, and that is the point: holding Q was already a heal, one
food per tick through `Placer`, and this makes the same key cover the deficit
in one tick instead. `healedOnce` keeps the two from eating twice on the same
tick. There is no keybind row for it; change the constant to move it.

## HUD

A line under the health bar, refreshed every 250ms:

```
HEAL: 2 HIGH | HP: 61/100 | SHAME: 1
```

Green from tier 2 up, yellow at tier 1, grey at tier 0. It prints the tier the
heal module *acted* on rather than a second opinion formed a frame later, and
it rides the Autoheal switch: with Autoheal off nothing eats for you, so the
line goes away with the thing it reports on.

## The numbers

All constants, in the block above the class:

| | value |
|---|---|
| `HEAL_CRIT_HEALTH` | 25 |
| `HEAL_HIGH_USES` / `HEAL_CHIP_USES` | 4 / 2 |
| `HEAL_CHIP_SHAME_LIMIT` | 4 |
| `HEAL_COOLDOWN_MS` | 50 |
| `HEAL_MAX_PER_TICK` | 5 (fifteen packets, an eighth of the second's allowance) |
| `HEAL_FAST_KEY` | `"KeyQ"` |

The existing `NOVA_*` constants — the shame wall at 7, the three-packet heal
cost, the 119 budget — are untouched.

## Where it lives

Line numbers are from the commit that added this and will drift; the anchors
are stable.

| Piece | Anchor | Line |
|---|---|---|
| Tier constants and the key | `const HEAL_PRIORITY_NONE` | ~16725 |
| Per-tick heal state | `healPriority=HEAL_PRIORITY_NONE;` | ~16792 |
| `foodRestore()` | in `NovastormHeal` | ~17382 |
| `isBuildingManually()` | in `NovastormHeal` | ~17403 |
| `getHealPriority()` | in `NovastormHeal` | ~17414 |
| `doBestHeal()` | in `NovastormHeal` | ~17460 |
| `fastHealPressed()` / `manualHeal()` | in `NovastormHeal` | ~17510 |
| Manual heal call | `if (this.fastHealPressed())` in `postTick` | ~17557 |
| The heal site | `this.doBestHeal(this.healPriority);` | ~17618 |
| `fastHealPress` flag | `InputHandler` field, keydown, keyup, blur | ~8178, ~8660, ~8700 |
| `_getHealWeapon()` | `ModuleHandler`, called by `heal()` | ~22018 |
| HUD markup | `ryn-hud-heal-row` | ~24546 |
| HUD refresh | `}, 250);` | ~24619 |
| HUD style | `.ryn-hud-heal` in `Game_default` | ~1710 |

## One fix that came with it

`ModuleHandler.heal()` ended on `whichWeapon(this._getPredictWeapon())`.
`_getPredictWeapon` returns `forceWeapon` before any of its "do I have this
slot" tests, and `whichWeapon` is a no-op for a slot with no item — so a heal
under a `forceWeapon` the player is not carrying left the **food in hand**.
`heal()` now ends on `_getHealWeapon()`, which takes the predicted slot when it
exists and falls back to primary, then secondary. Same three packets, same
order.

## Checked

`node --check`; 52/52 game hooks still bind (`tools/check-hooks.js`); a harness
that lifts the real `NovastormHeal` out of the file and runs the tiers, the
caps, every refusal and the manual key against stubs; a second one that runs
the real HUD callback against a stub DOM; and a check that `defaultSettings`
and both menu pages are byte for byte the ones the base shipped — no controls
were added for any of this.
