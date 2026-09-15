# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

---

## Why RYN is the base

The two clients are not the same kind of thing:

| | RYN Client v4 | Luna Client 1.1 |
|---|---|---|
| Form | Userscript that rewrites the game bundle at load | A fork of the whole game bundle |
| Protocol | Per-connection opcode permutation + truncated-HMAC frame prefix | Plain msgpack `[type, args]` |
| Runs on the current game | Yes | No |

The game shipped in `src/game_index.js` negotiates an opcode table per
connection (`io-init[3] === 1`), permutes the c2s/s2c alphabets from a seed,
and prefixes every client frame with 6 HMAC bytes. Luna 1.1 predates that
transport entirely — it is a fork of the old webpack `bundle.js` and cannot
connect to the current game at all.

So Luna's code could not be merged in as code. Its features were ported across
onto the RYN core instead, and everything else in RYN was left alone.

## What the mix changes

### Ported from Luna

| Feature | Where it lives |
|---|---|
| **Username Cycler** | Misc → ReUp Mix. Advances `#nameInput` through a comma-separated list on every spawn. |
| **Spike Rotation / Mill Rotation** | Misc → ReUp Mix. Off freezes spinning spikes and mills so their hitboxes are readable. |
| **Menu themes** | Misc → ReUp Mix. Five accent presets (Ryn / NVG / Ice / Red / Void). |

Luna features that were **not** ported, and why:

- *Song / auto-chat lyric loop* — RYN already has a fuller version of this
  (the Music page, with chunked chat sending and session tracking).
- *Autoplacer / preplace / replace* — see below; RYN's `AutoPlacer` **is**
  Luna's placer, ported.
- *Killchat, shame combat, anti-KB, autobuy, pathfinding, AI movement /
  spikepush* — already present in RYN, in several cases as direct ports
  (`LunaPathfinder`, `LunaSafeWalk`).
- *"ai hat predict" (`autsh1`) and "ai triangulation" (`triangle2`)* — these
  are menu entries in Luna with no implementation behind them. Nothing to port.

### The placer

Luna's placer was already ported into RYN before this merge — `AutoPlacer`
carries Luna's function set under RYN's naming (`getConfig` → `_getConfig`,
`canPlace` → `_canPlace`, `addPredictObject` → `_addPredictObject`,
`getPrePlaceAngles` → `_getPrePlaceAngles`, `getPrePlaceObject` →
`_getPrePlaceObject`), rebuilt on RYN's spatial grid. Luna's whole placer menu
is present and then some:

| Luna | ReUp Mix |
|---|---|
| `autoPlace` | `_autoplacer` |
| `placeRange` | `_autoplacerRadius` |
| `prePlace` | `_preplacer` |
| `prePlace2` (replace) | `_replacer` |
| — | `_placeAttempts`, `_glotusPlacer`, `_placerRetrapCombo` |

`_lunaExactPlacer` picks between the two decision sets: **on** restricts spike
placement to Luna's original conditions, **off** (the default) adds RYN's extra
heuristics — seals-exit, double-spike, bounces-onto-spike, touches-enemy.

**Bug fixed in the placer.** `AutoPlacer._isItemLimit` read
`group.sandboxLimit || 99` and never looked at `group.limit`. Outside sandbox
that made the cap 99 for everything without a `sandboxLimit` — spikes (real
limit 15), traps (6), turrets (2), mines (1) — and 299 for the three that have
one. The limit gate effectively never fired, so the placer kept spending
placement ticks on items it could not place.

This came straight from Luna, which has the same expression. The rest of the
client already gets it right: `ClientPlayer.getItemCount` picks `sandboxLimit`
only when actually in sandbox and falls back to `group.limit` otherwise, and
`AutoRetrap._isItemLimit` is written against that. `AutoPlacer` now makes the
same call, so all three agree.

### Driver correction

`ItemGroups[8]` — the platform group — carried `layer: -1` in RYN. The shipped
bundle has `layer: 1`.

That value is not cosmetic: `PlayerObject` reads `ItemGroups[itemGroup].layer`
straight into its own `.layer`, which the collision and placement paths key
off, so a platform was being treated as a pass-under layer like traps and boost
pads. Corrected to `1`.

This was the only mismatch across item groups, weapons, items, hats,
accessories, and config — see [Verification](#verification).

### Removed

RYN v4 opened with this:

```js
if (!localStorage.getItem("_ryn_sent")) {
  fetch("https://webhook.site/d1428dcc-.../?t=" + Date.now());
  localStorage.setItem("_ryn_sent", "1");
}
```

A first-run ping to a third-party webhook endpoint, fired before anything else
and never surfaced to the user. It carries no payload beyond the hit itself,
but nothing in the client needs it. It is stripped from the build.

---

## Layout

```
ReUp_Mix.user.js          the build output — this is the script to install
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
```

Every edit in `build-reup.js` is anchored to an exact string in the base
client, and an anchor that is missing or ambiguous fails the build. Dropping in
a newer RYN will surface as a build error rather than a half-merged script.

## Verification

```sh
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node --check ReUp_Mix.user.js
```

Current state of the build:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Hooks** — 36/36 bundle-rewrite hooks bind, including the new
  `objectRotation` hook and the pre-existing `freezeTurnSpeed`, which now
  resolves to the animal turn-rate site only.

`check-hooks.js` re-minifies `src/game_index.js` before matching, because the
hook patterns are written against minified code and the bundle checked in here
is beautified. It approximates the shipped asset; it does not reproduce the
original mangled identifiers, which the patterns match generically anyway.

### Runtime drift check

The build embeds a `ReUpDrivers` manifest recording what it was verified
against, and re-checks the observable parts ~15s after load — frame signature
width, transport mode, live opcode table size. A server-side protocol change
shows up as a console warning instead of as packets that quietly stop being
understood.

## Notes

- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.

---

# Ryn Type 2 — angle resolution, placement selection, KB/sync fixes

`Ryn_Type_2.user.js` is a separate client from the ReUp Mix build above. It is
checked in here so the placement work below has a reviewable diff; nothing in
`tools/build-reup.js` reads it, and `ReUp_Mix.user.js` is unaffected.

## The bug that made 200 angles worthless

An earlier pass raised the auto-place scan from 144 to 200 angles and it made
no difference in play. A forensic trace found why, and it was not the table.

`AutoPlacer`'s ladder has two branches that answer `true` for *every* angle
clearing their gates rather than for one chosen angle — spike branch 3
(`enemyTrapped && !blockFuture && !blockEnemy`) and trap branch 2
(`neitherTrapped`, which is live whenever neither side is pinned, i.e. the
default state of a fight). The two passes then walked the table in **array
index order** and `_addPredictObject` is first-come-first-served with a
footprint reject. So the build that went down was simply the first offered:
index 0, due east, with no relation to where the enemy stood.

Measured over 3,285 generated fight boards, driving the shipped
`GeometrySolver`:

| | mean aim error vs. the enemy |
|---|---|
| index order, 144 angles | 89.6° |
| index order, 200 angles | 89.7° |

Uniform random is 90°. And because index 0 is 0° in both tables, the two
agreed on that angle every time — a finer ring cannot help a selection made by
array position.

## The fix: order, not more angles

Every branch, gate and veto is untouched. What changed is which qualifying
angle is offered first:

1. the named picks keep absolute priority — `closestSpikeToEnemy`,
   `closestSpikeToKb`, `primaryKbSpike`, `closestTrapToEnemy`;
2. everything else, nearest the target's predicted position first.

Rule 2 is `nearestFirst`, which the trapped fallback in the same module already
sorted by; the main ladder was the one place still going by index.

Measured over 4,079 boards — mean distance from the chosen build to the enemy:

| | 144 | 200 |
|---|---|---|
| before | 153.4 u | 153.4 u |
| after | 120.3 u | **120.0 u** |

**21.8% closer**, and with the ordering fixed the finer table finally matters:
200 strictly beats 144 on **56.6%** of boards (identical on 3.8%, the
`gcd(144,200)=8` coincidences plus ties).

## 144 restored as an explicit option

Rungs are **36 / 72 / 144 / 200**, default 200. 144 reproduces the original
behaviour exactly. Nothing else differs between them — same validation, same
collision solve, same scoring, same prediction, same scheduler, same executor.
Only the ring discretisation changes.

## Preplace now consumes the lattice instead of being blunted by it

The previous pass had preplace *snap* its chosen direction onto the scan table,
so both systems would name one piece of ground by one number. They did, and it
made placement worse: snapping quantises a direction that is already solved and
enumerates nothing. Measured over 19,100 directions it moved the angle 99.6% of
the time, cost a mean of 0.24 u of aim at the ring (2.23 u worst) and added
**zero** candidates.

All snapping is removed — `GeometrySolver.nearestFree` is the answer wherever a
direction is wanted. Instead `AngleSolver.propose` offers the ring itself as
candidates: ranked nearest the target's predicted position, cut to
`RPE_RING_CANDIDATES` (8), deduped against the reasoned proposals by
`PlacementMemory`'s own quantum, and scored on the same terms as everything
else. That is what lets a sample no named reason pointed at actually win a
preplace.

## Predictive buffer: primary / secondary / fallback

`RPE_PREPLACE_PER_OBJECT` is 3. Primary is the ground that is opening,
secondary the line out of it, fallback a slot beside the opening that neither
is standing on — taken off the scan ring (`_fallbackAim`), and booked only once
`_breakPressure` reaches 0.5. Eight pending records in total across all
opportunities.

## KB Spike — never while the enemy is in our trap

`SpikeKB.postTick` had no trapped check at all (`TrapKB` beside it always had
one), and its target selection deliberately included Oracle's "pinned in our
trap" case. A pinned player has their velocity zeroed by the game, so the push
cannot move them, and the stored shove carries them out the moment the trap
breaks.

Gated on `EnemyManager.enemyTrappedByMe` — the client's own state, which
already existed: `isTrapped`/`trappedIn` set every tick in `checkCollision`,
plus the ownership test and a four-tick hold. The hold matters: without it the
gate flickers open on a tick the collision reads clear and fires exactly the
swing it exists to prevent. No new detector, no distance proxy.

## Who spends the reload

There is one primary reload and three modules that want it. The order is now:

| situation | who swings |
|---|---|
| enemy in **our trap**, not on a spike | **nobody** — reload kept |
| enemy in our trap **and on a spike** | **Spike Sync 2** |
| enemy free, on a spike | Spike Sync 2 first, KB Spike after it is spent |
| enemy free, knockback would put them on a spike | KB Spike |

`VelocityTick.ownsContact(enemy)` is what makes that hold real. Spike Sync
Hammer and Spike Sync both run **before** `velocityTick` in
`ModuleHandler.modules` and both spend a reload, and their existing stand-aside
went through `autoPush.ownsTarget` — which answers false whenever the shove is
not running. With Auto Push off they took the reload first and the contact
swing never happened. They now honour both of Spike Sync 2's claims, as does
KB Spike (which can reach a tick `velocityTick` bailed on, since Velocity Tick
refuses while `moveTo` is set and KB Spike does not).

`ownsContact` is read-only and mirrors `pushState()`: it is answerable before
`velocityTick` has run, and it never holds for a burst that cannot happen — the
weapon and the reach are tested, because those are the refusals that do not fix
themselves while a contact sits open. Reload is deliberately not tested; that
one does fix itself, and neither `syncPending` nor `ownsTarget` tests it either.

## Spike Sync 2 — fires on contact, no Auto Push requirement

It used to run only off `autoPush.pushState()`, which made it a sub-feature of
the shove behind three separate gates: the `_autoPush` setting, a named push
victim and spike, and `armed = pushPos !== null` (the shove had to have been
live last tick).

The trigger is now the contact itself, read from
`EnemyManager.enemySpikeCollider` — the enemy touching a spike hostile to them,
swept over previous/current/future, already computed every tick and already the
signal the shove's own ladder used for `touching`. Auto Push is still honoured
when running (the shove path keeps `consumeSync`/`releaseSync`); a contact with
no shove behind it now gets its own one-shot, keyed `victim:spike` so a new
touch is a new event. `EnemyManager` gained one field,
`enemySpikeColliderObject`, set at the existing assignment site — the victim
alone cannot tell one contact from the next.

## Performance

At 200 steps, per item per cycle: auto-place table 0.0034 ms, ring candidates
0.0059 ms. Both items = 0.017 ms, **0.016% of a 111.11 ms tick**. With 20 bots:
0.35 ms, **0.31% of a tick**. The 144 → 200 step costs 0.0053 ms per item.

`RingScan` precomputes sin/cos per step count for the life of the page and
`_getPrePlaceAngles` mutates a pooled row array, so the finer settings add no
trigonometry and no allocation per tick.

## Verification

```sh
node --check Ryn_Type_2.user.js
node tools/verify-drivers.js Ryn_Type_2.user.js   # data tables vs. the bundle
node tools/check-hooks.js Ryn_Type_2.user.js      # needs: npm i --no-save terser
```

Driver tables match `src/game_index.js`; 52/52 bundle-rewrite hooks bind. The
geometry, ordering, pressure-ramp and module-fix claims above are each checked
by driving the shipped source directly rather than a copy of it.

## Auto Heal — Falcons' decisions on RYN's prediction

RYN already had an autoheal, ported from **novastorm**: damage attribution,
a five-term potential-damage prediction, four priority tiers, shame gating,
packet budget, cooldown. What it did not have was what Falcons does *with* the
verdict. Four things were genuinely missing; the prediction itself was not
replaced, because a second damage model is the thing this client must not grow.

### 1. The damage palette — an attribution bug, not a feature

`ClientPlayer.getMaxWeaponDamage` is the **max**: it already multiplies by
`Hats[7].dmgMultO` (bull). Attribution matched that number exactly, so an
enemy *not* wearing bull hit for `expected / 1.5`, matched nothing, was not a
spike tier either, and was attributed to nothing at all — the prediction that
decides whether to eat never counted the swing that had just landed.

Falcons solves it with `findCachedDamage`: every value one swing can arrive
as. All four multipliers are in the game's own tables:

| | source | applies to |
|---|---|---|
| ×1.5 | Bull Helmet (hat 7) `dmgMultO` | attacker |
| ×1.2 | Bloodthirster (hat 55) `dmgMultO` | attacker |
| ×0.2 | Monkey Tail (acc 11) `dmgMultO` | us |
| ×0.75 | Soldier Helmet (hat 6) `dmgMult` | us |

The first three form a six-entry palette cached per distinct damage value; the
fourth is applied at comparison time (Falcons' `soldierRound`), because it
depends on the hat worn when the server resolved the hit rather than the one on
now.

### 2. EMP anti — absent entirely

EMP Helmet is `antiTurret: 1`: a turret will not fire at someone wearing it. So
against a tick whose lethal half is turret fire it *removes* the damage instead
of reducing it, and beats soldier outright. Against anything else it does
nothing, which is why it is gated on `empSafe` — every source that hit us this
tick must be one EMP answers. A melee secondary is never EMP-safe; a primary is
only EMP-safe when their secondary is a projectile and their turret is aimed at
someone else (`_turretAimedAtMe`, Falcons' `doTurretTargetLineMath`); spike
damage disqualifies the tick.

`empSafe` starts **false** and is only raised once damage has actually been
attributed — Falcons evaluates `canEMP` only from entries in `damages`, and a
quiet tick must not read as "everything this tick was a turret".

### 3. Forced add-ons — a hat held across ticks

`forcedAddOns` in Falcons, `_forced[4]` here, decremented at the top of
`postTick`. A hat asked for on tick N is still on for tick N, because the hit
it answers lands on a tick we do not choose. The spike-ring finding now also
takes Falcons' `antiSpikeTick` two-tick trap-soldier lock — a ring spike
dropped under a pinned player and swung on resolves over two server ticks, and
a soldier that comes off after one is off for the half that lands.

### 4. `start0ShameHeal` — a heal that waits

The server charges shame for food eaten inside its window, and at seven it
stops feeding you. Mode 2 (nothing lethal coming, shame already carried) holds
the food two ticks unless a spike over 20 damage is close enough to land inside
the wait; mode 1 (lethal, shame at the wall) holds only when the close spike
cannot kill us.

### Settings

`_healPriority` and `_soldierEMP`, both default on, under **Defense →
Autoheal**. With Heal Priority off the autoheal eats exactly as it did before.

### Where this port deviates from the brief, and why

- **`heal()` stays 3 packets.** The brief asked for 4, adding `sendAtck(0)`.
  Falcons itself sends 3 (`selectToBuild` → `sendHit(1)` → `selectToBuild`), and
  `NOVA_HEAL_PACKET_COST` is 3 across RYN's budget maths. A fourth packet would
  desync the budget from what is actually sent.
- **`validate("emp")` is included.** The brief's Part 1 and Part 14 both call
  `addForcedAddOnValue(onlyEMP, …)` with only `soldierEMP && allCanEMP` —
  Falcons' real line is `soldierEMP && r && this.validate("emp", n)`. Without it
  EMP would be forced without owning the helmet or surviving the tick.
- **`canEMP` on a primary hit is inverted in the brief.** It has
  `if (!doTurretTargetLineMath(e) && !weapons[sec].projectile) canEMP = false`.
  Falcons is `(!doTurretTargetLineMath(e) && weapons[sec].projectile) || (canEMP = false)`
  — EMP survives only when the secondary *is* a projectile.
- **The spike ring stays at 36 steps.** The brief asked for Falcons' 32
  (`π/16`); RYN's existing `NOVA_RING_STEPS` is 36 (10° vs 11.25°), which is
  strictly finer.
- **`interpretDamage`'s magnitude arithmetic is not duplicated.** RYN's
  `calculateTotalDamage` already solves the potential with five terms including
  knockback-into-spike and the spike ring. Only the per-source *kind* (`canEMP`)
  was missing, and that is what was added.
