# Auto Heal — RYN Type 2

NovaStorm's survival system, rebuilt on RYN Type 2's own state, verified against
the live game bundle.

- **Implementation target:** `Ryn_Type_2.user.js`
- **Behavioural reference:** `novastorm.v1.4.js` (the mod code lives in the
  embedded webpack bundle's `./src/js/app.js` module)
- **Game truth:** the current moomoo.io client (`moomoo_1.js` / `moomoo_2.js`)
- **Tests:** `node tools/autoheal-test.js` — 87 scenarios

---

## 1. What was there before

RYN Type 2 had a heal *primitive* and no decision behind it.

| | before |
|---|---|
| `ModuleHandler.heal()` | three packets: select food, attack, re-select weapon |
| `Placer.postTick()` | fires it when `currentType === 2`, i.e. while the food hotkey is held |
| `Settings._autoheal` | gated `ShameReset` only — nothing else read it |
| automatic trigger | none; `startPlacement(2)` is only ever called from `InputHandler` |

The settings comment above `_autoheal` describes a survival engine with a shame
guard, a shame drain, a packet reservation and an EMP swap. Only the drain was
still in the file.

Separately, `EnemyManager.checkCollision` carries a comment stating that the
knockback-into-spike detection "is gone, along with both of those fields and the
two terms that read them (instaThreat and the autoheal damage sum), so nothing
here counts damage from being shoved onto a spike any more."

## 2. Where it lives now

One class, `AutoHeal`, registered as `staticModules.autoHeal` and scheduled in
`ModuleHandler.modules` immediately after `shameReset`.

That slot is chosen for three reasons:

1. **After every hat decision that changes damage taken.** `defaultHat`,
   `adaptiveGearSwitching`, every insta module and `shameReset` have all run, so
   `ModuleHandler.plannedHat()` is stable. The only modules that still set a hat
   afterwards set `53`, which changes nothing about damage taken.
2. **Before every module that spends packets.** `autoPlacer`, `placementEngine`
   and `placer` all read the budget the heal has already spent from, so the
   placer backs off for the heal rather than the other way round. This is
   NovaStorm's order — it heals at the top of `updatePlayers` and gates only
   placement on `packets + 5 > 119`.
3. **Adjacent to `shameReset`,** which pulls the scan on demand.

The scan is **memoised on `myPlayer.tickCount` and pulled**, so `ShameReset`
(one slot earlier) gets the same answer the heal decision gets without any
ordering hack.

```
PlayerManager.postTick()
├─ ProjectileManager.postTick()          live projectile damage
├─ EnemyManager.handleEnemies()          per-enemy threat, spike contact
└─ myPlayer.tickUpdate() → ModuleHandler.postTick()
   ├─ … defaultHat, reloading, insta modules, utilityHat …
   ├─ shameReset          ── pulls AutoHeal.scan() through threatPending()
   ├─ autoHeal            ── scan (memoised) → decide → eat
   ├─ … trapKB, spikeKB, autoShield, autoPush …
   ├─ autoPlacer / placementEngine / placer   (what is left of the budget)
   ├─ autoHat             ── equips plannedHat()
   └─ updateAngle         ── forces the direction packet after a heal
   and then: the soldierAnti override, after every module
```

## 3. The damage model

NovaStorm re-derives everything every tick into five scalars. RYN already
carries most of it, so the engine computes the **delta** rather than a second
copy:

```
rawPot = EnemyManager.potentialDamage              (melee, secondary, turret,
                                                    live projectiles, per enemy)
       − the unconditional bull-tick +5            (re-added from the hat below)
       + spike tick, soldier multiplier reversed   ← new
       + spike contact pool (max of three reads)   ← two of the three new
       + poison, one tick early                    ← new
       + knockback into spike/cactus, per enemy    ← new (was deleted from RYN)
       + secondary/turret off a melee hit at 400   ← new
       + a primary arriving with a turret shot     ← new
       + low-health turret finish                  ← new
       clamped to 140
```

Then, exactly as NovaStorm does it and in that order:

```
soldierAnti = rawPot >= 100          → ModuleHandler.soldierAnti
hat         = ModuleHandler.plannedHat()
pot         = rawPot × 0.75          if hat is Soldier Helmet
pot         = rawPot + 5             if hat is Bull Helmet
lethal      = health <= pot
```

### Not paying twice

`Player.canPossiblyInstakill` now records what it charged for each enemy:
`countedPrimary`, `countedSecondary`, `countedTurret`, `lookingShield`. Every
branch in the engine reads that ledger before charging and writes to it after,
so a weapon counted once at one distance is not counted again at another. The
flags are rewritten from scratch each tick, so nothing leaks between ticks.

The three readings of a single spike — the one EnemyManager says we are
touching, the one our swept segment crosses, the one an enemy can drop where we
are going — share **one pool and take the worst of themselves**. A player
standing on a spike satisfies the first two at once (the swept segment of a
stationary player is a point inside the spike they are in), so summing them
would read one 45 as 90.

The knockback read is deliberately kept out of that pool: it is a different
event with a different cause, and NovaStorm sums it too.

### Events and the horizon

Every term is also pushed as an event carrying `{damage, source, tick,
confidence, repeat}`, which gives `futureHealth(t)`. The horizon is derived from
the threats — the furthest scheduled event, a full damage-over-time period when
anything repeats, and the real ETA of any projectile in flight
(`ceil(distance / (speed × TICK))` minus ticks already flown) — bounded to nine
ticks.

It changes no ported decision. The emergency test is still NovaStorm's
single-tick one, because shame is paid to survive *this* tick. The longer view
decides `urgent`, which is what guarantees an apple against an exhausted packet
budget.

## 4. NovaStorm → RYN mapping

Every Auto Heal-related behaviour found in NovaStorm, and where it is in RYN.
Line numbers are NovaStorm's.

### Damage observation and classification

| NovaStorm | RYN Type 2 | Notes |
|---|---|---|
| `updateHealth` damage branch (13230) | `AutoHeal.healthUpdate` ← `ClientPlayer.updateHealth` | magnitudes buffered in `observed`, drained by the scan |
| `damages[]` (11878) | `AutoHeal.observed` / `unclaimed` | buffered rather than tick-stamped, so it is immune to the order the server puts the health and player frames in |
| `damagesByHits[]` (11876) | `AutoHeal.hits` | `{player, weapon, damage}` |
| `damagesByShoots[]` (11877) | `AutoHeal.shots` | |
| `damagesByTurrets[]` (11875) | — | declared in NovaStorm, never filled; turret projectiles land in `shots` |
| `spikeDamages[]` (11865) | `AutoHeal.spikeHits` | un-mitigated at classification time |
| `distributionDamages` (13324) | `AutoHeal._classify` | melee → projectile → spike → poison, then unclaimed |
| `deathDamages[]` (11861) | `AutoHeal.deathDamages`, `reportDeath()` | dumped to `Logger` on death instead of the chat log |
| `damageTick` (11838) | `AutoHeal.lastDamageScan` | |
| `spikeDmgCount` (11864) | `AutoHeal.spikeStreak` | |
| `spikeDmg` (11863) | — | incremented in NovaStorm, never read |
| shame model (13244–13253) | `Player.updateHealth` | already present, unchanged |

### Threat prediction

| NovaStorm | RYN Type 2 |
|---|---|
| poison detect + `% 9 == 8` (14663–14672) | `AutoHeal._poisonThreat`, on `Player.isBullTickTime(-1)` and its own `dotTick` |
| `collidingspike` + multiplier reversal (14674–14696) | `AutoHeal._spikeTickThreat` + `_unmitigate`, with the repeat made explicit |
| `willcollide` sweep (14698–14733) | `AutoHeal._velocityThreat` → `_sweep` |
| melee prediction, five branches (14749–14774) | `EnemyManager.canPossiblyInstakill` (already wider: any reloaded primary inside range + 130) |
| turret prediction (14777–14790) | `canPossiblyInstakill` `includeTurret`, plus `_lowHealthTurretThreat` for the 350 case |
| velocity tick anti (14793–14798) | `canPossiblyInstakill` velocity-tick branch (already ported) |
| knockback anti, both variants (14802–14865) | `AutoHeal._knockbackThreat` — **restored**, had been deleted from RYN |
| anti normal instakill (14868–14886) | `AutoHeal._instaComboThreat` |
| anti spike tick (14888–14921) | `AutoHeal._spikePlacementThreat`, against the velocity point |
| `totalDmgPot` clamp at 140 (14931) | `SURVIVE_POT_CEILING` |
| `soldierAnti` at 100 (14934) | `AutoHeal.soldierAnti` → `ModuleHandler.soldierAnti` |
| `currentHat == 6 → ×0.75`, `== 7 → +5` (14989–14992) | `AutoHeal.scan()`, from `Hats[6].dmgMult` and `Hats[7].healthRegen` |
| `healing = health <= totalDmgPot` (14994) | `lethalNow` |
| `projectileHandle` / `antiOneTick` (13263, 13316) | `AutoHeal._turretInstaThreat` — NovaStorm sets a flag nothing reads |
| `canShoot` obstacle test (13275) | `AutoHeal._projectileBlocked`, on the game's own layer rule |

### Decision, shame and packets

| NovaStorm | RYN Type 2 |
|---|---|
| heal gate (15000) | `AutoHeal.postTick`, both branches |
| `heal(value)` chain (12352) | `AutoHeal._healCount` + `ModuleHandler.heal()` |
| `place(items[0], null)` | `ModuleHandler.heal()` (3 packets; NovaStorm's 4th, the `F 0`, is issued by `UpdateAttack` where it is needed) |
| `damageHealed → io.send("D", angle)` (15019) | `ModuleHandler.healedOnce` → `UpdateAngle.postTick` |
| `shouldResetShame` (14977) | `ShameReset.isBullTickTime` + `notSave()`, now with the two missing terms |
| `packets + 5 > 119` (15010) | `ModuleHandler.packetLimit` (already 119), enforced in `_healCount` |
| `needAutoGather` soldier suppression (15087) | see §6 |
| `canStillGather` (14801) | `AutoHeal.canStillGather` |

### Hats

NovaStorm's `hatFc` (15930) is a run of assignments where the last write wins.
RYN splits the same decision across `DefaultHat` (`useHat`), `UtilityHat`,
`forceHat` and the soldier override, and `Autohat.getNextHat()` resolves it.

| `hatFc` rule | RYN |
|---|---|
| booster when nothing else applies | `DefaultHat` → 12 |
| winter cap below y 2400 | `DefaultHat` `_biomehats` → 15 |
| flipper in the river | `DefaultHat` `_biomehats` → 31 |
| safe soldier inside 300 | `ModuleHandler.postTick` trailing block, `SAFE_SOLDIER_RANGE` |
| `shouldResetShame` → bull | `ShameReset` → `forceHat = 7` |
| `(trapped && spikeDmgCount > 0) \|\| spikeTickAnti` → soldier | **new**: folded into `soldierAnti` |
| gather branch: bull / tank / samurai | `UtilityHat` |
| `insta.turret` → 53, `insta.primary` → 7, `insta.secondary` → 40 | the insta modules' `forceHat` |
| **`soldierAnti` → soldier (last line)** | **new**: `ModuleHandler` trailing block, after every module |

## 5. Complete inventory of what NovaStorm's Auto Heal is made of

Traced from source, not from names. Everything below was read and accounted
for; the right-hand column says where it went.

**State** — `tick`, `damageTick`, `damages`, `damagesByHits`, `damagesByShoots`,
`damagesByTurrets`, `spikeDamages`, `spikeDmg`, `spikeDmgCount`, `deathDamages`,
`damageByPoisonTick`, `healing`, `totalDmgPot`, `soldierAnti`, `spikeTickAnti`,
`shouldResetShame`, `imTrapped`, `trap_where_im_in`, `collidingspike`,
`lastcolliding`, `willcollide`, `canStillGather`, `lastPredicted`,
`primaryReload`, `secondaryReload`, `turretReload`, `lastPrimaryReload`,
`lastSecondaryReload`, `hitTime`, `shameCount`, `shameAbuse`, `spikeDamage`
(per enemy), `antiTick`, `antiReverse`, `antiInsta`, `predictDamage`,
`antiVelocitySpikeSync`, `packets`, `pps`. — §4 tables.

**Ported behaviours** — damage classification; spike-magnitude recognition with
the ×0.75 reversal; poison tick prediction; spike tick while trapped; swept
velocity collision into spikes and cactuses; knockback into spikes and cactuses
from both the interpolated and extrapolated position; melee, secondary and
turret prediction per enemy; the velocity-tick band; anti normal instakill; anti
spike tick with both of its gates; anti turret instakill including `canShoot`'s
obstacle test; the autosteal turret read at low health; the 140 ceiling;
soldierAnti at 100; the hat adjustment; both heal branches; the heal chain; the
post-heal direction packet; the shame drain's four-term guard; the packet
budget; `deathDamages`.

**Declared and never read in NovaStorm** — `antiTick` (set by `antiOneTick`,
never consumed), `antiReverse`, `antiInsta`, `predictDamage`,
`antiVelocitySpikeSync`, `damagesByTurrets`, `spikeDmg`. Where the *intent* is
clear the behaviour is implemented anyway (`antiTick` → `_turretInstaThreat`);
where there is no intent to recover, it is recorded here rather than silently
dropped.

**Outside this task** — `canVelocitySpikeTick`, `canSmartTick`,
`doSmartTickAnti`, `canTrapTick`, `advancedShameCombat`, `canShamePlace`,
`canShamePlus`, `canAutoShame`, `isNearestEnemyPushPlayer`, the placer, the
preplacer and the pathfinder. These are offensive, shame-grind, placement and
movement systems; RYN already has its own (`VelocityTick`, `SmartInsta`,
`TrapTick`, `SpikeSync`, `AntiSpikePush`, `RynPlacementEngine`,
`LunaPathfinder`). They are named here so the inventory is complete, not because
they were ported.

## 6. Behaviours that required architectural adaptation

1. **`needAutoGather`'s soldier suppression.** NovaStorm stops auto-gathering
   while `soldierAnti` is up unless `canStillGather`, because its gather branch
   would otherwise pull the helmet off for a swing. RYN has no auto-gather
   toggle, and its equivalent hazard is `UtilityHat` asking for bull or tank.
   `forceHat` beats `useHat`, and `soldierAnti` now sets `forceHat = 6` after
   every module, so the protection is structural rather than a suppression.
   `canStillGather` is still computed and exposed.

2. **`(trapped && spikeDmgCount > 0)` → soldier.** NovaStorm puts this
   mid-priority in `hatFc`, where the gather branch can still take the helmet
   off. Here it joins the `soldierAnti` override, because the branch it would
   lose to is the one that puts a tank hat on a player standing in a spike.

3. **The melee prediction's five gated branches.** NovaStorm only counts an
   enemy's primary when we are colliding with a spike, about to be, or already
   below its damage. RYN counts any reloaded primary inside weapon range + 130
   unconditionally — strictly wider — so the branches, and with them
   `lastcolliding` / `lastPredicted`'s one-shot guard, are subsumed. Re-adding
   them would double the term.

4. **The attacker's primary on the knockback and spike-placement branches.**
   NovaStorm adds `spike.dmg + primaryDmg` on both. RYN has already charged that
   primary, so only the spike is added at each site.

5. **`canShoot`'s obstacle test** is applied where NovaStorm applies it — the
   turret-insta read — and not to RYN's general projectile accounting, which
   feeds `detectedDangerEnemy`, `AutoShield`, `TrapKB` and others and is
   unrelated to this task.

6. **`addChatLog` on death.** No chat log to add to and no new UI permitted, so
   `reportDeath()` goes to `Logger`, owner only.

7. **A 120ms wall-clock check on the free branch.** NovaStorm's
   `(tick - damageTick) > 0` is one server tick, 111ms, and the server's shame
   window is 120ms. At any real ping the packet is already outside it, but 111
   is not 120, so the same `receivedDamage` stamp the shame model is measured
   from is checked as well. The emergency branch is deliberately not held back
   by it.

## 7. Defects in NovaStorm, implemented as intended

Each one is documented at the site in the source.

| | NovaStorm | here |
|---|---|---|
| poison | never removes the `5` from `damages`, so `damageByPoisonTick` is rewritten every tick and `% 9 == 8` never fires again after the first tick — and fires every 9 ticks before any poison at all | the classifier consumes the value, so the prediction fires once per period and only while poison is running |
| anti turret insta | `antiOneTick` sets `antiTick`; nothing reads it | implemented as a real threat term |
| projectile damage | `getPlayerInfo` hardcodes bow 15, crossbow 30, repeater 35 | taken from `Projectiles[weapon.projectile].damage`: 25 / 35 / 30 / 50 |
| heal budget | the heal is not budget-gated while placement is | budget-aware, with one apple always allowed through when the prediction is lethal |
| shame ceiling | gates the emergency heal on `< 7` | kept at 7 — the server locks out at 8 — and `shameActive` refuses outright |
| `isItemLimit` | reads `group.sandboxLimit \|\| 99`, ignoring `group.limit` | not in this path; RYN's `getItemCount` already reads both |

## 8. Game truth

Every constant comes from a table rather than a literal, and each was checked
against the live client (`moomoo_1.js`) before use.

| | value | source |
|---|---|---|
| server tick | 9/s, 111.11ms | `config.serverUpdateRate` |
| regen / poison / bull-drain timer | 1000ms = 9 ticks | `player.update`, `timerCount = 1e3` |
| shame | `≤120ms → +1`, else `−2`; `≥8` → 30s lockout | `player.buildItem` |
| soldier helmet | `dmgMult 0.75` | `Hats[6]` |
| bull helmet | `healthRegen −5`, `dmgMultO 1.5` | `Hats[7]` |
| anti venom | `poisonRes 1`, checked only where poison is applied | `Hats[23]`, `objectManager.checkCollision` |
| spike damage | 20 / 35 / 30 / 45, poison spikes `pDmg 5` for 5 ticks | `Items`, `itemGroup === 2` |
| cactus | 35 | `Resource.getDamage` |
| turret | projectile 1, damage 25, layer 1 | `Projectiles[1]` |
| projectiles | bow 25, crossbow 35, repeater 30, musket 50 | `Weapons[].projectile → Projectiles[].damage` |
| knockback | `111 × (0.3 + weapon.knock)` | already pre-scaled in `Weapons[].knockback` |
| food | apple 20, cookie 40, cheese 30 | `Items[].restore` |
| packet allowance | 120/s | `ModuleHandler.packetLimit = 119` |

## 9. Tests

`node tools/autoheal-test.js` — 87 checks.

`tools/autoheal-harness.js` slices the engine, the `Player` class, `Entity`, the
item / weapon / hat / accessory / projectile tables and the geometry helpers
**out of the userscript itself** and runs them under node, so the tests exercise
the real decisions against the real numbers; a change to any table shows up in
the tests without the tests being edited.

Groups: normal damage · shame · spikes · knockback into spikes · poison ·
projectiles, turrets and instakill · enemy spike placement · soldier anti ·
emergency and recovery · packet budget · combined threats · damage
classification · environment · sustained pressure · packet ordering.

Notable cases:

- a hit that landed this tick does not trigger the free branch; the next tick
  does
- shame 7 refuses the emergency heal, shame 6 takes it, shame 9 still takes the
  free one, `shameActive` refuses everything
- a spike tick through a soldier helmet enters the pot as its raw 45 and leaves
  it as 33.75
- contact and sweep describing one spike count it once
- a turret is charged once across the branches that each want to charge for it
- a windmill stops a turret shot; a wall, being on a lower layer, does not
- 3.75 is read as a damage-over-time tick
- an exhausted packet budget refuses a top-up and lets one emergency apple
  through
- the health frame arriving before or after the player frame both classify on
  the same tick

## 10. Unrelated systems

Changes outside the new class, in full:

| file region | change |
|---|---|
| `Player` fields | `countedPrimary`, `countedSecondary`, `countedTurret`, `lookingShield` |
| `Player.canPossiblyInstakill` | four assignments recording what it charged; no condition or value changed |
| `Player.updateHealth` | the damage-over-time detector also accepts `5 × 0.75` |
| `ClientPlayer.updateHealth` | one guarded call into the engine |
| `ClientPlayer.reset` | `reportDeath()` before `ModuleHandler.reset()` |
| `ShameReset.notSave` | two terms from NovaStorm's own condition |
| `ModuleHandler` | `soldierAnti` field + reset, `plannedHat()`, registration in `staticModules` and `modules`, `\|\| this.soldierAnti` in the existing soldier block |

Not touched: `RynPlacementEngine`, `AutoPlacer`, `PreplaceBook`, `Placer`,
replace, spam preplace, retrap resend, `MELEE_PROFILES` and the weapon animation
system, the building destruction animation, `ChatLog`, `GameUI`, the menu HTML,
`Settings` (no key added or removed), `InputHandler`, `SocketManager`,
`PacketManager`, `ObjectManager`, `ProjectileManager`, `EnemyManager`,
`MovementSimulation`, the bot fleet, possession, `RynLRC` and the music page.

No button, menu, panel, toggle or slider was added. `_autoheal`, which already
existed, is the entry point.
