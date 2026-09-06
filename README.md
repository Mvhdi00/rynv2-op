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

## KB spike (RYN v5.4)

`src/RYN_Client_v5.4.js` is RYN v5.4 carried in on its own. It is **not** part
of the `ReUp_Mix.user.js` build — that still builds from v4 — it is the v5.4
client with its knockback-into-spike anti rebuilt to work the way Novastorm's
does, in RYN's own idiom.

**What it detects.** The enemy swings, you fly, you land on a spike. RYN
already tracked this as `EnemyManager.possibleToKnockback` /
`potentialSpikeKnockbackDamage`, which `AntiInsta` reads to decide whether to
heal. The detection feeding it was the part that was wrong.

**Before** — an angular cone measured from the enemy: is the spike inside
`asin(reach / enemyToSpike)` of the enemy→you direction, and further from the
enemy than you are. Two failures, both in the situations the anti exists for:

- `Math.asin()` of a ratio above 1 is `NaN`, and every comparison against `NaN`
  is false. Once a spike sat closer to the enemy than its own combined scale —
  point blank — the test silently returned false. That is 5.4% of random
  configurations, and they are the close-range ones.
- The "further from the enemy than you" requirement threw away every spike you
  get shoved *past* sideways, which is most of them once the enemy is not
  lined up directly behind the spike.

**After** — Novastorm's approach: sweep the actual knockback segment through
the spike's box, from two origins, exactly as Novastorm runs it twice.

| Novastorm | RYN v5.4 |
|---|---|
| `x2, y2` | `myPlayer.pos.current` |
| `xVel, yVel` (`x2*2 - lastX`) | `myPlayer.pos.future` — `setFuturePosition()` is the same extrapolation |
| `111 * (0.3 + primaryKnockback)` | `getActualMaxKnockback(target)` — already in those units |
| `UTILS.lineInRect` | module-level `lineInRect`, the game's own routine |
| `spikeDmgPot += spike.dmg` | `potentialSpikeKnockbackDamage`, kept as a `Math.max` |

Two deliberate departures from a literal transcription, because RYN is built
differently:

- Novastorm adds the enemy's hit damage (`hitDmgPot`) inside the same block.
  RYN already accumulates that separately in `ClientPlayer.potentialDamage`,
  so adding it here would double-count it.
- Novastorm's two sweeps each add damage. RYN resolves the spike term as
  `max(potentialSpikeDamage, potentialSpikeKnockbackDamage)`, so the two
  frames combine with `max` — same threat, counted once.

**Measured**, against a swept-capsule ground truth over 200k random
player/enemy/spike layouts:

| | missed real threats | false alarms |
|---|---|---|
| cone (before) | 5651 (2.83%) | 953 |
| sweep (after) | 0 (0.00%) | 4781 (2.39%) |

The remaining false alarms are the box-vs-circle corners of `lineInRect` — the
game's own test, and the one Novastorm uses, so this is faithful behaviour
rather than a new approximation. For an anti the trade is the right way round:
a false alarm costs an apple, a miss costs the round.

**Its own toggle: `_kbSpike`** — Combat → Defense → "KB Spike", on by default.

The sweep in `checkCollision` is the only thing that raises
`possibleToKnockback` or `potentialSpikeKnockbackDamage`, so gating that one
block switches the whole feature from a single place. All three consumers go
quiet together when it is off: the spike-tick counter, `instaThreat()`, and the
knockback term in the autoheal damage.

It previously had no toggle of its own — the spike-tick counter read it behind
`_antiSpikeTick` while the other two consumers ran unconditionally, so there
was no way to turn the knockback anti off by itself.

### Antis and autoheal vs Novastorm

The v5.4 header already claims the autoheal, and the claim holds — this is an
audit of what is left, not a second port.

**Autoheal is already Novastorm's, whole.** `AntiInsta.postTick()` runs
Novastorm's rule verbatim: accumulate every damage source that can land this
tick, cap at 140, `hat 6 ×0.75`, `hat 7 +5`, heal when `health <= dmgPot`,
guarded by `shameCount < 7`. Two documented deviations, both because copying
Novastorm exactly would do harm here:

- Novastorm's second condition is `(tick - damageTick) > 0`. RYN models
  moomoo's shame rule off the wall clock, where an apple inside 120ms of a hit
  *raises* shame and the same apple after it lowers it by two. `isSaveHealTime()`
  guards that window on the routine branch. The emergency branch deliberately
  does not wait — `+1` shame beats dying.
- `_healsInFlight()` tracks food already sent and unacknowledged. Novastorm has
  no equivalent, so taken verbatim the same missing health is paid for once per
  tick for a whole round trip.

**The damage terms are all present.** Matching Novastorm's `totalDmgPot`
component by component: poison → `isBullTickTime()` `+5`; spike contact →
`collidingSpike`; spike knockback → the sweep above; moving into a spike →
`colliding()` already samples `pos.future`; weapon, secondary and turret →
`canPossiblyInstakill()`, and broader than Novastorm's, which gates those
behind having just been hit; projectiles → `ProjectileManager`, which Novastorm
has no real equivalent for.

**One genuine gap, now filled: velocity tick anti.** A turret-gear enemy
(hat 53) who has just fired — turret still cycling — with a primary ready,
closing but not yet in melee. Melee `primaryRange` is weapon range + 130, so it
tops out at 272 (polearm) and sits at 195–248 for most weapons, while this
setup runs out to 350; the swing that lands as they arrive was not being
counted. Ported into `canPossiblyInstakill()`, gated on `!collidingPrimary` so
it can never double up with the branch that already owns melee range.

Novastorm also adds a flat `+25` turret on that branch. RYN does not: the shot
that turret fired is a live projectile and `ProjectileManager` has counted it
since it spawned. The `+25` is how Novastorm pays for that shot at all, having
nothing tracking it — adding it here would pay twice and heal into a threat
already accounted for.

**Four antis were left alone.** `AntiSync`, `AntiRetrap`, `AntiTrapProtect` and
`AntiTrapStar` have no Novastorm counterpart, so "replace with Novastorm's"
would delete them rather than swap them.

### Velocity Tick (from Glotus)

Glotus's `VelocityTick` ported whole — turret plus diamond polearm landing in
one tick. It runs over two ticks: the first equips turret gear and walks in,
the second swings the polearm as the shot lands. The 220–245 band is the point
of it — that is the gap where the walk-in reaches polearm range on exactly the
tick the turret fires.

The setup tick only commits when the enemy cannot answer: their melee is one
tick off reloaded (`atExact`), or they are mid hat-swap into something that is
not soldier or emp. Otherwise walking in just hands them a free hit.

Ported with it: the enemy-side read. `Player.velocityTicking` is the same
combination seen from the other end — in primary and turret range, turret just
gone off, diamond polearm ready — which raises `EnemyManager.velocityTickThreat`
and feeds `instaThreat()`, so the client defends against the tick as well as
throwing it. Module order matches Glotus (after `spikeSync`, before
`spikeTrap`).

**Not ported:** the red circle Glotus paints on the target while the module is
armed. The module is the behaviour, the circle is a debug overlay, and nothing
else reads it.

One thing needed adding that Glotus gets for free: `UI.updateStats` **throws**
on a missing element, so the `_velocityTickTimes` stat row, its setting and its
`StatsManager` accessors all had to land together — without the row, the first
successful tick would have taken the client down.

### Blood Wings idle re-equip

`DefaultAcc.getBestCurrentAcc()` returned Blood Wings from its idle branch:

```js
if (!ModuleHandler.isMoving && myPlayer.speed <= 5) {
  if (beAngel) return 13;
  if (useBloodWings) return 18;   // removed
}
```

That method runs every tick, so standing still re-equipped Blood Wings and kept
re-equipping for as long as you stood there — taking them off by hand was
impossible. Idle now falls through to the ordinary fallback (tail, else none).

The two remaining Blood Wings branches are deliberate and stay: the bull-hat
combat pairing, and the explicit Cowboy When Safe setting.

### Automill angles

The trio was spaced by solving for the exact placement bound:

```js
const offset = Math.asin((2 * item.scale + 9e-13) / (2 * distance)) * 2;
```

`canPlaceItem` rejects when centre distance is **below**
`item.scale + neighbour.placementScale`, so a gap of exactly `2 * scale` puts
the two outer mills on the reject line itself. The `9e-13` was meant to lift
them off it, but a double keeps almost none of it at that magnitude — measured
clearance was **8.8e-13 units**. Whether the outer two survived came down to
rounding, which is why the trio kept coming out as one or two mills.

Upgrading made it worse for a second reason: the ring radius is
`playerScale + scale + placeOffset`, so it steps 85 → 87 when the mill goes
45 → 47, and the new trio no longer sits on the circle the mills already on the
ground were placed on.

Now solved for a real gap, `2 * item.scale + 2`, with the ratio clamped so
`asin` cannot go `NaN`. Mill upgrades are one-way and replace the inventory
slot, so any mill already down is a tier at or below the one being placed, and
2 units is the whole spread across the three tiers:

| tier | ring | offset | trio gap | strictest neighbour | clearance |
|---|---|---|---|---|---|
| windmill (45) | 85 | 65.53° | 92.00 | 90 | 2.00 |
| faster windmill (47) | 87 | 66.97° | 96.00 | 94 | 2.00 |
| power mill (47) | 87 | 66.97° | 96.00 | 94 | 2.00 |

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
src/RYN_Client_v5.4.js    RYN v5.4, standalone — see "KB spike" below
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
