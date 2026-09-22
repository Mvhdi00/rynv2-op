# Auto Heal — RYN Type 2

NovaStorm's survival block, ported whole into RYN Type 2.

- **Implementation target:** `Ryn_Type_2.user.js`
- **Behaviour:** `novastorm.v1.4.js` — the mod code inside the embedded webpack
  bundle's `./src/js/app.js` module
- **Game truth:** the current moomoo.io client (`moomoo_1.js` / `moomoo_2.js`)
- **Tests:** `node tools/autoheal-test.js` — 91 checks

---

## 1. What this is

The engine is NovaStorm's survival block, not a system informed by it.

It does **not** read `EnemyManager.potentialDamage` and does not add to it. RYN's
threat sum counts a different set of things under different conditions — any
reloaded primary inside weapon range + 130 unconditionally, every projectile in
the air, a flat five on every ninth tick — and a pot built on top of that is
RYN's pot with NovaStorm terms bolted on. It does not heal when NovaStorm heals.
RYN's sum is still computed and still drives RYN's own modules; this one belongs
to the survival engine and nothing else reads it.

RYN-native is the **state and the wire**: `Player`, the object grid,
`PacketManager`, `ModuleHandler`, the `Reloading` module. It is not RYN's
arithmetic.

## 2. The tick, in NovaStorm's order

```
tick++                                     soldierAnti = false, healing = false
distributionDamages  hit → shoot → spikes  what landed, and from what
spikeDmgCount                              the run of ticks spent on a spike
poison                                     (tick - damageByPoisonTick) % 9 == 8
collidingspike                             trapped, in a spike, taking its damage
  spikeDmgPot += dmg / 0.75                the reversal
the movement sweep                         segment x2,y2 → xVel,yVel
  willcollide, spikeDmgPot += spike.dmg
per enemy:
  predict hit          4 gates             collide-new / off-cooldown / one-shot
                                           / willcollide / health <= dmg
  predict turret       3 gates             just-swung / willcollide / low health
  velocity tick anti                       turret gear, 150–350, turret cycling
  knockback anti       x2                  from xVel,yVel and from x2,y2
  anti normal instakill                    a hit landed, inside 400
  anti spike tick      36 angles, 2 gates
totalDmgPot = spike + hit + turret + sec + poison, clamped 140
soldierAnti = total >= 100
shouldResetShame = shame>0 && !soldierAnti && !collidingspike && poison==0 && total==0
hatFc                                      bull / soldier / soldier-anti
totalDmgPot *= 0.75  (soldier)  or  += 5  (bull)
healing = health <= totalDmgPot
heal     ((healing && shame<7) || (tick - damageTick) > 0) && health < 100
```

Scheduled as `staticModules.autoHeal`, in `ModuleHandler.modules` after the
insta modules (so `setForceHat` respects a hat an insta already claimed) and
before the placement modules.

## 3. What each piece maps to

| NovaStorm | here |
|---|---|
| `tick`, `damageTick` | the engine's own counters, not RYN's `tickCount` |
| `damages[]` | `AutoHeal.damages` — sticky, as NovaStorm's is |
| `distributionDamages` | `_distribute()`, all three branches |
| `damagesByHits` / `damagesByShoots` / `spikeDamages` | same names |
| `damagesByTurrets` | present and never filled, as in NovaStorm |
| `primaryReload[sid] == 1` | `reload[0].current >= reload[0].max` |
| `lastPrimaryReload` | `wasPrimaryReady`, snapshotted at the end of each scan |
| `turretReload[sid]` | `reload[2]`, max 23 ticks ≈ 2500 ms |
| `secondaryReload[myPlayer.sid]` | the `Reloading` module, ping-compensated |
| `getPlayerInfo(p,"primaryDmg")` | `_primaryDamage` — **weapon × 1.5 × variant**, the 1.5 applied to every enemy whether or not they wear bull |
| `getPlayerInfo(p,"primaryKnockback")` × 111 | `Weapons[].knockback`, which already holds `111 × (0.3 + knock)` |
| `spikes_enemy` / `cactuses` | the object grid, same filter |
| `checkItemLocation` | `ObjectManager.canPlaceItem` |
| `heal(value)` | `_healCount` + `ModuleHandler.heal()` |
| `place(id, null)` | `heal()`: `z(id,false)`, `F(1,null)`, `F(0,null)`, `z(weapon,true)` |
| `io.send("D", angle)` after a heal | `healedOnce` → `UpdateAngle` |
| `hatFc`'s three survival rules | applied in the engine, in order |
| `shouldResetShame` | the engine; `ShameReset` reports it |
| `deathDamages` | `deathDamages` + `reportDeath()` → `Logger` |

### The hats

`hatFc` is an ordered cascade where the last write wins. Its three survival rules
are applied by the engine in that order:

```
if (isBoughtHat(7,0)) if (shouldResetShame) currentHat = 7;          setForceHat(7)
if (((imTrapped && spikeDmgCount>0) || spikeTickAnti) && ...) = 6;   setForceHat(6)
...                                                                  (insta rules)
if (isBoughtHat(6,0)) if (soldierAnti) currentHat = 6;               the override
```

The first two sit above the gather branch and the insta rules, so an insta that
already claimed the hat keeps it — that is what `setForceHat` means here. The
third is the last line of `hatFc`, so it goes to `ModuleHandler.soldierAnti`,
applied after every module has run. The first two cannot both hold: the drain
needs `totalDmgPot == 0`, and being held on a spike never is.

The biome hats, the booster, safe soldier and the gather branch stay with RYN's
`DefaultHat` / `UtilityHat`, which already carry them.

## 4. NovaStorm defects, reproduced

The brief was to port it, so these are ported, not fixed. Each is commented at
its site.

**Poison.** `distributionDamages` has no branch that explains a poison tick, so
the 5 stays in `damages` for the rest of the session and

```js
for (let damage of damages) if (damage == 5 || damage == 3.75) damageByPoisonTick = tick;
if ((tick - damageByPoisonTick) % 9 == 8 || ... == 9) poisonDmgPot = 5;
```

rewrites `damageByPoisonTick` to the current tick on every tick after the first.
The remainder is then always zero and the prediction never fires again; **before**
any poison has ever landed it fires once every nine ticks. `sawPoison` reproduces
that latch without an array that grows for the length of a session.

`% 9 == 9` cannot be true. It is left as written.

**`damagesByTurrets`** is declared and never filled; it appears in one condition,
the movement gate, where it is therefore always false. Present, always empty.

**`antiTick`** is set by `antiOneTick` and never read, so the anti-turret-insta
detection has no effect in NovaStorm. It has none here. (`projectileHandle` and
`canShoot` feed only that flag.)

**`spikeDmg`** is incremented and only ever read by its own reset.

## 5. Two places where the game's table is used instead of a literal

Per the original brief — *"do NOT blindly copy hardcoded values from NovaStorm
when the authoritative game source can establish the actual value"* — two tables
come from the game rather than from NovaStorm's source. Say the word and either
flips back to NovaStorm's number in one line.

| | NovaStorm | here | source |
|---|---|---|---|
| projectile damage | bow 15, crossbow 30, repeater 35, musket 50 | 25 / 35 / 30 / 50 | `Weapons[].projectile → Projectiles[].damage` |
| spike magnitudes | `[20, 30, 35, 45]` written out | the same four | `Items`, `itemGroup === 2` |

Everything else NovaStorm hardcodes is kept as a decision, not corrected — most
importantly the flat `× 1.5` on every enemy's primary damage, which is the bull
multiplier applied whether or not they wear it. That is a worst case on purpose.

## 6. What the heal does and does not do

Both branches, and nothing around them:

```js
if (((healing && myPlayer.shameCount < 7) || (tick - damageTick) > 0) && myPlayer.health < 100) {
    heal(100 - myPlayer.health);
    damageHealed = true;
}
```

- **no packet budget.** NovaStorm gates its placer on `packets + 5 > 119` and
  never gates the heal. Neither does this.
- **no wall clock.** The only timing on the free branch is
  `(tick - damageTick) > 0` — one whole server tick, 111 ms, since the damage
  landed. The server's shame window is 120 ms, so at very low ping the free heal
  can still cost a point. That is NovaStorm's behaviour and its known cost.
- **no state machine.** No emergency mode, no recovery counter, no horizon, no
  confidence, no event list. NovaStorm evaluates one tick.
- **chains to full**, `ceil(missing / restore)` apples, four packets each.

The one addition is a resource test: NovaStorm sends the whole chain and lets the
server refuse the apples there is no food for. RYN knows what it is carrying, so
the ones that could not land are not sent. Nothing else about the chain changes.

## 7. Game truth

| | value | source |
|---|---|---|
| server tick | 9/s, 111.11 ms | `config.serverUpdateRate` |
| regen / poison / drain timer | 1000 ms = 9 ticks | `player.update` |
| shame | `≤120 ms → +1`, else `−2`; `≥8` → 30 s lockout | `player.buildItem` |
| soldier helmet | `dmgMult 0.75` | `Hats[6]` |
| bull helmet | `healthRegen −5`, `dmgMultO 1.5` | `Hats[7]` |
| spikes | 20 / 35 / 30 / 45 | `Items`, `itemGroup === 2` |
| cactus | 35 | `Resource.getDamage` |
| turret | projectile 1, damage 25 | `Projectiles[1]` |
| knockback | `111 × (0.3 + knock)` | `Weapons[].knockback` |
| food | apple 20, cookie 40, cheese 30 | `Items[].restore` |

## 8. Tests

`node tools/autoheal-test.js` — 91 checks. `tools/autoheal-harness.js` slices the
engine, `Player`, `Entity` and the game tables **out of the userscript** and runs
them under node, so a change to any table shows up in the tests without the tests
being edited.

Groups, each naming the NovaStorm branch it covers: predict hit (all four gates,
including the one-shot) · predict turret (all three) · velocity tick anti ·
knockback anti · the movement sweep · spike tick (with the 0.75 reversal) · anti
normal instakill · anti spike tick (both gates) · poison (both phases of the
latch) · the total, the ceiling and soldierAnti · shame reset · the heal · damage
distribution · packet ordering.

## 9. What was touched outside the engine

| region | change |
|---|---|
| `Player` fields | `lastAttackWeapon` added beside the existing `lastAttacked` |
| `PlayerManager.attackPlayer` | records it — one line |
| `ClientPlayer.updateHealth` | one guarded call into the engine |
| `ClientPlayer.reset` | `reportDeath()` before `ModuleHandler.reset()` |
| `ShameReset` | rewritten: the drain is NovaStorm's now, in the engine, and this module reports it |
| `ModuleHandler` | `soldierAnti` field + reset, `plannedHat()`, registration, `\|\| this.soldierAnti` in the existing soldier block, `stopAttack(null)` added to `heal()` |

Not touched: `RynPlacementEngine`, `AutoPlacer`, `PreplaceBook`, `Placer`,
replace, spam preplace, retrap resend, `MELEE_PROFILES` and the weapon animation
system, the building destruction animation, `ChatLog`, `GameUI`, the menu HTML,
`Settings` (no key added or removed), `InputHandler`, `SocketManager`,
`PacketManager`, `ObjectManager`, `ProjectileManager`, `EnemyManager`,
`MovementSimulation`, the bot fleet, possession, `RynLRC` and the music page.

No button, menu, panel, toggle or slider was added. `_autoheal`, which already
existed, is the entry point.

### Removed in this pass

Everything from the previous attempt that was not NovaStorm's: the delta model
built on `EnemyManager.potentialDamage`, the `countedPrimary`/`countedSecondary`/
`countedTurret` ledger, the event list with confidence and repeat, `futureHealth`
and the derived horizon, the emergency/recovery state machine with its calm
counter, the packet budget on the heal, the 120 ms wall clock, the spike contact
pool that took a max where NovaStorm sums, RYN's own shame drain (the 1-in-9 tick
gate and the cross-tick latch), and the soldier-helmet case added to RYN's
damage-over-time detector.
