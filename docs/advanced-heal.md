# Advanced Auto Heal (Ryn Type 2)

The heal in `Ryn_Type_2.user.js` was novastorm 1.4's: predict what can land on
this tick, and if the number reaches your health, eat the whole deficit. One
question, one answer, one site in the tick.

This adds four tiers around that question, a key for eating on demand, and a
HUD line that says which tier is live. Nothing was taken away: with **Heal
Priority** off, the module is the same single rule it was.

## The tiers

| Tier | When | Foods |
|---|---|---|
| **3 CRIT** | health at or under **25** | the whole deficit |
| **2 HIGH** | `health <= totalDmgPot` — novastorm's own verdict, after the hat terms | the whole deficit, capped at 4 |
| **1 CHIP** | `spikeDmgCount > 0` — a spike is landing tick after tick | 2 |
| **0 IDLE** | nothing to answer | none |

Tier 2 is the rule that was already there. With apples (20 each) a 75-health
deficit is 4 foods, so the cap never trims a tier-2 heal in practice — it is a
ceiling, not a change. Tier 3 is new: below 25 health an *unpredicted* hit is
lethal too, so that tier stops waiting for the prediction to agree. Tier 1 is
new: a chip that is not lethal yet becomes lethal in two ticks.

## Refusals

A heal never goes out when any of these hold:

- not in the game, or already at full health
- `shameCount >= 7`, or `shameActive` — the server is refusing food
- a food already went out on this tick (`lastHealTick`)
- the heal cooldown has not elapsed (`_healCooldownMs`, default 50ms)
- the packet budget cannot afford one more food (`packetCount + 3 > 119`)
- **tier 1 only**: a manual build is in progress, or shame has reached 4

The last two are worth saying plainly, because they differ from the brief they
were written to:

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

## Fast Heal (hotkey)

Held, not toggled. While the key is down, each tick eats the whole deficit
regardless of the prediction, and regardless of whether Autoheal is on at all.
It still stops at shame 7 and still takes the packet trim.

The default is **Q**, which is also the Food hotkey. That is deliberate:
holding Q was already a heal — one food per tick, through `Placer` — and this
makes the same key cover the deficit in one tick instead. `healedOnce` keeps
the two from eating twice on the same tick. Rebind either row in **Keybinds →
Quick Actions** to separate them.

## HUD

A line under the health bar, refreshed every 250ms:

```
HEAL: 2 HIGH | HP: 61/100 | SHAME: 1
```

Green from tier 2 up, yellow at tier 1, grey at tier 0. It prints the tier the
heal module *acted* on rather than a second opinion formed a frame later. With
Autoheal off it reads IDLE, which is the truth — nothing is going to eat for
you.

## Settings

| Key | Default | Where |
|---|---|---|
| `_healPriority` | `true` | Combat → Defense → Heal Priority |
| `_healHud` | `true` | Combat → Defense → Heal HUD |
| `_healDebugLog` | `false` | Combat → Defense → Heal Debug Log |
| `_fastHealKey` | `"KeyQ"` | Keybinds → Quick Actions → Fast Heal |
| `_healCooldownMs` | `50` | no menu row |
| `_healMaxPerTick` | `5` | no menu row |

Both numeric settings are clamped when read, so a hand-edited save cannot turn
the heal off: `_healCooldownMs` is capped at 500ms and `_healMaxPerTick` is
held between 1 and 12.

`_healDebugLog` prints one line per heal — tier, health, shame, foods sent,
packets spent. It goes through `Logger.staticLog`, which bypasses the
production `isProd` gate, so it really does print in a shipped build.

## Where it lives

Line numbers are from the commit that added this and will drift; the anchors
are stable.

| Piece | Anchor | Line |
|---|---|---|
| Tier constants, caps, clamps | `const HEAL_PRIORITY_NONE` | ~16067 |
| Per-tick heal state | `healPriority=HEAL_PRIORITY_NONE;` | ~16141 |
| `foodRestore()` | in `NovastormHeal` | ~16731 |
| `isBuildingManually()` | in `NovastormHeal` | ~16752 |
| `getHealPriority()` | in `NovastormHeal` | ~16763 |
| `doBestHeal()` | in `NovastormHeal` | ~16809 |
| `fastHealPressed()` / `manualHeal()` | in `NovastormHeal` | ~16862 |
| Manual heal call | `if (this.fastHealPressed())` in `postTick` | ~16912 |
| The heal site | `if (Settings_default._healPriority)` in `postTick` | ~16970 |
| `fastHealPress` flag | `InputHandler` field, keydown, keyup, blur | ~8178, ~8661, ~8701, ~8190 |
| `_getHealWeapon()` | `ModuleHandler`, called by `heal()` | ~21374 |
| Settings defaults | `_healPriority: true,` | ~23517 |
| HUD markup | `ryn-hud-heal-row` | ~23923 |
| HUD refresh | `}, 250);` | ~23994 |
| HUD style | `.ryn-hud-heal` in `Game_default` | ~1710 |
| Combat menu rows | `id=\"_healPriority\"` in `Combat_default` | ~1704 |
| Keybind row | `id=\"_fastHealKey\"` in `Keybinds_default` | ~1703 |

## One fix that came with it

`ModuleHandler.heal()` ended on `whichWeapon(this._getPredictWeapon())`.
`_getPredictWeapon` returns `forceWeapon` before any of its "do I have this
slot" tests, and `whichWeapon` is a no-op for a slot with no item — so a heal
under a `forceWeapon` the player is not carrying left the **food in hand**.
`heal()` now ends on `_getHealWeapon()`, which takes the predicted slot when it
exists and falls back to primary, then secondary. Same three packets, same
order.
