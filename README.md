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

# Ryn Type 2 — v2.2 placement & prediction pass

`Ryn_Type_2.user.js` is the Type 2 line, descended from the mix above. v2.2 is
a latency and prediction pass over the existing engine: no new engine, no
second scheduler, no duplicate packet manager, no duplicate collision system.
Eight changes, each traced to a measured cause.

Everything below is checked by `node tools/verify-placement.js`, which extracts
the real functions out of the userscript by brace matching and exercises them —
80 assertions, including 288,000 samples of the aperture solver against a
transcription of the game's own `checkItemLocation`.

## What was actually slow

| # | Cause | Effect |
|---|---|---|
| 1 | The whole module pipeline was scheduled on `setTimeout(cb, 1)` from the player-update frame | 1–30ms added to **every** decision, **every** tick, before a packet is sent — timers are clamped and serviced after rendering, and this client draws a canvas on 21 connections |
| 2 | Preplace/retrap repeats anchored at `TICK − pong/2` | Every repeat arrived ~half a round trip *into* the next server tick instead of at the top of it — 35–60ms late at the stated 70–120ms ping |
| 3 | `attrition()` read only fully-reloaded actors | A melee weapon is on cooldown 2 ticks in 3, so the retrap candidate for the trap being broken existed on **33% of ticks** and was re-derived from nothing on the rest |
| 4 | Trap state asked as `distance < trap.scale` (50) | The game pins at `playerScale + scale*colDiv` = **45**. Targets in the 45–50 band were treated as pinned while the server had them free |
| 5 | `blockersAround` added the blocker item's 300 radius to every sweep | 13×13 cells instead of 7×7, per connection per tick, to catch an item capped at 3 per player that is usually not on the board |
| 6 | `SpatialHashGrid2D.query` allocated a `Set` per call | The hottest function in the client; thousands of short-lived Sets a second, collected during the busiest frames |
| 7 | Spike Sync 2 bailed on `moveTo !== "disable"` | Auto Push sets `moveTo` for the whole shove — so the shove that walks a victim onto a spike suppressed the contact swing on the tick they arrived |
| 8 | Luna's break-edge detector (`_getPrePlaceObject`) was ported and never called | The earliest warning of an opening slot the client can produce was computed by nothing |

## What changed

**Tick dispatch** — `_rynImmediate` (a `MessagePort` task) replaces the 1ms
timer. Ordering is not weakened but strengthened: `_scheduleTickFlush` re-posts
itself while frames are still arriving (`packetSeq`), so it runs on the first
turn with nothing left to apply instead of guessing that a millisecond is
enough. The timer stays as the backstop; the `"H"` early-fire is unchanged.

**Send timing** — `_retrapOffsets` anchors at `TICK − pong`. Derivation: the
frame we are reading is `pong/2` old, the next server tick is `TICK − pong/2`
away, and the send needs another `pong/2` to arrive. Both references land on
the same number empirically (Luna fires at `111 − pingTime` and repeats at
`111 − minPingTime`); the jitter shot is taken from them for the same reason.
Repeats are now **cancelled** by the deletion packet they were guessing at, and
capped per tick across every claim — fewer packets, not more.

**Break forecast** — `assess()` gains `byPotential`, so a deadline exists on the
ticks between swings. Units are swings, so it carries no reload penalty (a
count of remaining swings does not change with cooldown phase). `attrition()`
reads the full sweep instead of only the loaded half, with the loaded reading
kept as a floor, so nothing it used to report is reported later. The retrap on
the trap holding the target is exempt from the *steal* confidence bar — that bar
was written for taking an enemy's building, where being early costs a slot.
Result: **33% → 100%** of ticks inside the window carry the candidate.

**Trap state** — `rpeTrapHolding()` prefers the client's own swept answer
(`isTrapped`/`trappedIn`, with the ownership test) and falls back to the game's
exact `playerScale + collisionScale`. Used by both auto place and the engine, so
the two cannot disagree about who is pinned.

**Offer order** — auto place's qualifying arc is now three tiers: named picks,
then builds whose footprint actually *reaches* the target, then the rest. The
boundary is the game's contact radius exactly (`enemyScale + item.scale` — 84 for
basic spikes), unpadded. This is the branch that decides a trapped fight, where
spike branch 3 qualifies the whole ring and order alone picks the build.

**Sweeps** — blockers are registered on `ObjectManager` as they are placed, so
`blockersAround` uses the radius that describes a spike (49 cells, not 169). The
attrition sweep drops 120 units of slack the grid already covers. `query()`
dedups with a stamp instead of a `Set`, per nesting depth so a nested query
cannot corrupt an outer walk.

**Spike Sync 2** — the contact burst is evaluated first, ahead of both follow-ups
and ahead of the `moveTo` gate, which now guards only Velocity Tick's own
two-tick plan. `moduleActive` and `shouldIgnoreModule` remain hard gates. No
Auto Punch, no Auto Push, no manual punch in the path.

**Break edge** — `_getPrePlaceObject` is called from `postTick` (before the
state-change early-out, because the edge it watches is on the *enemy's* reload
counter, which that signature has no term for) and read by the engine's
`_imminentBreak`, which folds it into `attrition` and `_breakPressure`.

## v2.3 — the Oracle / Falcon pass

Both references were read for technique and cross-checked against the game
bundle. Three changes came out of it; two things they do were deliberately not
copied.

### Taken (because the game agrees)

**`RPE_KB_TRAVEL` was a unit error, not an approximation.** It was
`impulse / (1 - 0.993)` = 214.3, which sums a per-millisecond decay against a
per-millisecond step. The game does neither: it applies velocity whole and
decays once per tick (`x += xVel*f; xVel *= pow(playerDecel, f)`), so the
distance is the geometric series `v*f / (1 - d^f)` = **307.6** units for the
spike's `T = 1.5`. The old constant was short by 30%. Confirmed three ways: the
algebra, a step-by-step simulation of the loop, and Falcon's own
`deceleration()` helper, which unrolls the identical series for its brake logic.

**The trap/spike pairing is tested along the push, not at the end of it.**
`_pairDelta` asked whether a trap sat within one footprint of the point where
the knockback runs out — a ~85-unit-wide annulus 307 units away. A knockback is
a glide: they cross every point on that line and stop at the first thing in the
way. It is a segment test now, which also stops the exact value of
`RPE_KB_TRAVEL` from being load-bearing.

**The refusal window follows the measured round trip.** `LUNA_BAN_GRACE_TICKS`
was a fixed 2 ticks (~222ms). Past that, a *successful* build whose add packet
is still in flight reads as empty ground, gets its own slot banned for 18 ticks,
and that slot is exactly the one replace exists to rebuild. Now
`max(2, pingTicks + 1)`. Oracle sidesteps this by never judging at a deadline
(it marks on send, clears when a real object appears, expires at 30 ticks) —
round-trip-independent, but it also cannot ban a genuinely refused slot for
3.3s. RYN keeps the deadline and teaches it about latency instead.

### Not taken (because the game disagrees, or RYN already does it better)

- **Oracle's `predictEnemyTraps`** reads like hidden-trap inference and isn't:
  `addEnemyTrap` fires on *every* build it sends, so it is a pending-occupancy
  list under a misleading name. RYN's `_placedSlots`/`_bannedSlots` plus the
  engine's `PlacementLedger` already do this, keyed on ground and with a
  refusal test.
- **Oracle's trapped-enemy test is `distance <= 50`** — the same 50-vs-45 error
  v2.2 fixed. The game pins at `playerScale + scale*colDiv` = 45. Two references
  agreeing on a number does not make it the game's number.
- **Oracle's `isItemLimit`** reads `group.sandboxLimit || 99` outside sandbox,
  capping spikes at 99 instead of 15.
- **Falcon's markers** live exactly one tick (`markers.push(...)`,
  `nextTick(() => markers.shift())`) — intra-tick dedup only, which RYN covers
  more precisely with ledger claims and `memory.sentThisTick`.
- **Falcon's 30-angle ring** (`Math.PI/15 * i`) is coarser than RYN's default of
  200. Noted as evidence that ring resolution is not what separates these
  clients, which is what RYN's own notes already argued.
- **The weapon knockback table** (`111 * (0.3 + knock)`, one tick of travel) is
  short by the same 1.85x factor, but it is load-bearing in EnemyManager,
  Spike KB, Trap KB and the anti-insta damage prediction, all tuned against it
  across three clients — and a weapon's victim is usually holding a direction
  the free-glide model ignores. That one needs measurement in game, not
  arithmetic, so it was left alone and flagged.

## v3.0 — Auto Heal rebuilt on Falcons V2

The old heal system is gone entirely — class, constants, settings and all
(1,444 lines removed, 1,027 added). It predicted damage: every tick it summed
what *could* land and healed against the sum. That reads the board, and reading
the board is guessing.

Falcon does the opposite, and that inversion is the whole feature:

```
a damage number arrives  ->  which weapon produces exactly that number?
                         ->  whose weapon is it?
                         ->  what else does that player still have loaded?
                         ->  can that finish me?
                         ->  which hat survives it, and when do I eat?
```

Every hit in moomoo is a weapon's base damage times a small set of known
multipliers, so the observed number **identifies the weapon that produced it**.
Everything after that is bookkeeping the client already has.

Ported function for function, in Falcon's order: `interpretDamage`,
`fitsPalette`, `findCachedDamage`, `soldierRound` / `doPreciseValues`,
`spiekKB` / `simulateMelee`, `checkForSpikePlacements` (32 directions),
`start0ShameHeal` (both modes), `autoHealing`, `validate`, the four forced
add-on slots, `onlySoldier`, `checkCanOneTick`, `doTurretTargetLineMath`,
`getBestWeapon`, `antiSpikeTick`, and the `main` ladder.

### The ladder

| condition | action |
|---|---|
| the damage so far will not kill me | hold, eat in two ticks |
| it will, and EMP alone answers it | EMP helmet, eat next tick |
| it will, and soldier answers it | soldier helmet, eat next tick |
| it will, neither does, shame < 7 | eat now, take the shame |
| it will, and shame is already high | hold |

### Every constant checked against the game tables

Soldier `dmgMult 0.75` · EMP `antiTurret 1` · Bull `healthRegen -5` · Turret
gear `rate 2500` · Monkey Tail `dmgMultO 0.2` · turret projectile `dmg 25` ·
spike tiers `20/35/45/30` · attacker multipliers `1 / 1.5 (Bull) / 1.2
(Bloodthirster)`. `enemies.near` uses Falcon's own rule: `distance - 100 <=
their primary's range`.

### Four deliberate divergences from Falcon (tagged `PORT-DIFF` in source)

1. **`soldierRound`** — Falcon's non-soldier branch calls `doPreciseValues(e)`
   with one argument, which turns the float tolerance off. RYN rounds observed
   damage to 2dp while a palette entry like `35 * 1.1 * 1.5` is
   `57.75000000000001`, so exact equality would match nothing. Both branches
   pass both arguments here.
2. **Ranged damage** — Falcon is a bundle fork whose item table has `dmg: 25`
   on the hunting bow. The live game does not; the projectile carries it.
   Reading `weapon.damage` would score every bow, crossbow and musket at zero.
3. **Result entries carry `sid`** — Falcon looks entries up with
   `n.find(i => i.sid == e.sid)` and never sets `sid`, so the lookup always
   misses and a spike hit is counted twice. Setting it makes the author's own
   merge run.
4. **`heal()` sends four packets**, not three — select / hit / **stop** /
   restore, the shape RYN's own `place()` uses. Requested.

Falcon's odder choices were kept because they change what the system decides:
the monkey-tail multiplier applied after the sum it should scale, and the exact
polarity of the EMP condition.

### Settings

`_healPriority` is gone — the ladder *is* the system now. Its menu row became
**Sensitive Healing** (`_sensitiveHealing`), which is Falcon's own toggle: it
adds the two threats that arrive without a damage number (spikes you are about
to walk into; a spike an enemy could drop on you), both read off the game's own
build ring and contact radius. `_autoheal` and `_soldierEMP` are unchanged.

### Verification

`node tools/verify-heal.js` — **79 assertions** against the class lifted out of
the shipped file: damage identity for melee and ranged, the six-entry palette,
the float snap, reload and hit windows, knockback landing, every `validate`
branch, forced add-on timing (including the extra tick of hold RYN needs that
Falcon does not), both shame modes, the packet budget, and all five rungs of
the ladder.

## Verification

```sh
node --check Ryn_Type_2.user.js
node tools/verify-placement.js   # 185 assertions across 6 suites
```

Notable results:

- The analytic aperture solver agrees with a transcription of the game's
  `checkItemLocation` on **288,000 ring samples over 400 generated boards**,
  including the river band and the blocker's 300 radius.
- Ring geometry: 144 and 200 share exactly 8 samples (the ones 45° apart);
  every one of the 144 intervals is subdivided, 96 gaining one sample and 48
  gaining two; neighbour spacing at the spike ring is 2.48u against 3.45u, a
  28% cut in worst-case aim error. Both rates remain selectable.
- Timing: at 70/90/120ms ping the single shot fires at 41.1 / 21.1 / 4.0ms into
  the window (the last is the floor — past a round trip of one tick, the correct
  action is to send now).
- Trap state: 44u trapped, 45.0u trapped, 45.1u free, 47u free — the last is the
  case the old 50u test got wrong.
