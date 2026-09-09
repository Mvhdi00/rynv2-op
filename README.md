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

# Ryn Type 2 — defensive core

`Ryn_Type_2.user.js` is a second, separate build in this repo. It is not
produced by `tools/build-reup.js`; it is edited directly, and it is the only
client file the defensive work below touches.

```sh
node --check Ryn_Type_2.user.js
node tools/verify-drivers.js  Ryn_Type_2.user.js   # data tables vs the game bundle
node tools/check-hooks.js     Ryn_Type_2.user.js   # bundle-rewrite hooks
node tools/test-defense-core.js                    # the defensive core, behaviourally
```

## What replaced the old Auto Heal

`AntiInsta` is gone. It was a threshold healer: it read
`potentialDamage + potentialSpikeDamage`, compared it to health, and ate. It ran
at position thirty of fifty-five in the module chain, so anything ahead of it had
already claimed the tick, and it could not stop anything behind it. It could not
see a sequence coming, and its shame rule (`healing && shameCount < 7`) was true
on most ticks with an enemy in reach — every one of them bought a point of shame
for a heal that would have been free two ticks later. That is the shame climb.

In its place, `DefenseCore` runs fifth, ahead of every insta, placement and
combat module. Each tick it senses once, classifies, decides what is worn and
what stops, and then heals.

### Sensing

| Source | What was taken |
|---|---|
| Novastorm | the damage-potential accumulator — spike contact, predicted knockback, per-enemy weapon/turret/secondary terms, poison, capped at 140. RYN's `EnemyManager` already computes it; the core reads it instead of sweeping again. |
| Chicken / Falcon | `interpretDamage`. Damage values that just landed are matched against each near enemy's weapon palette, which says *which* weapon they spent and therefore what is still loaded. The follow-up is priced before it is thrown. |
| Chicken / Falcon | `start0ShameHeal`. A heal that is not needed now is delayed until it is free. |
| Chicken / Falcon | `forcedAddOns` / `onlySoldier()`. A hat lock on a tick countdown that every equip request is routed through. |
| Whiteout | `qHeal`. A turret-gear enemy at boost-tick distance arms the healer three ticks before anything lands. |
| Misery | heal and hat are committed before the tick's breaker, gather and building packets. |

Detectors combine by `max`, not by sum: each returns a complete estimate of one
sequence, and an enemy's swing appears in several of them. The long-range musket
term is the exception and adds, because it only counts shooters the geometric
estimate cannot see.

### Shame

The server charges shame in one place — `buildItem` in `src/game_index.js`:

```js
if (this.hitTime) {
    const W = Date.now() - this.hitTime;
    this.hitTime = 0;
    W <= 120 ? this.shameCount++ : this.shameCount -= 2;
}
```

Three things follow that no reference client states:

- The charge is **per hit, not per apple** — the first food of a burst zeroes
  `hitTime` — so healing the whole deficit costs what healing one point costs.
- With no outstanding hit, food is **free**: no `+1`, no `-2`.
- A late heal is worth **-2**, so shame falls on its own while panic heals stay
  rarer than one in three.

`Player.receivedDamage` is this client's mirror of `hitTime`, so the rule is
applied exactly rather than estimated. The core eats inside the 120 ms window
only when the alternative is dying. Holding the food key by hand is routed
through the same rule, because the client turning one key-hold into an eat every
111 ms was the fastest way in this build to become a clown.

**Anti Clown** (`ShameReset`) manufactures the one thing a recovery needs and the
ordinary heal cannot: an outstanding hit at full health. Bull Helmet's
`healthRegen: -5` is a real `changeHealth(-5)`, so it sets `hitTime`, and the
core's own late heal then pays `-2`. It runs only at full health — below it the
heal the core is already going to make is worth the same `-2` for free — never
while anything can reach us, and never against the defensive lock.

**There is no Q Fast path.** The core's only wire call is `ModuleHandler.heal()`
(`selectItem(2)` → attack → restore weapon). `KeyQ` appears once in the client,
as the player's own food binding, reachable only from a real `keydown`. The test
suite asserts all of this against the source.

### The lock

`ModuleHandler.defenseLock` is a tick countdown with a hat. While it holds,
`_equip` routes every non-player hat request to that hat — one gate, because
every hat in this client is equipped through that one function — and auto place,
preplace and replace stand down. It is a deferral, not a disable: the count runs
out on its own and the engine resumes. Two carve-outs: Auto Shield keeps running
(a raised shield beats Soldier), and one tank-gear break is let through on a tick
the core sanctions, snapping back the tick after.

### The antis

They are not ten systems. They are ten detectors proposing into one threat
object; the highest level wins and ties go to the tighter sequence, so
simultaneous detections produce one hat and one lock rather than three modules
fighting over the hat.

| # | Anti | Condition | Answer |
|---|---|---|---|
| 1 | Velocity tick | turret-gear enemy, primary up, gap 150–420; critical at **190–250** and at Whiteout's boost-tick band **307–417** | Soldier, arm 3 ticks |
| 2 | Sync spike | pushed onto / colliding with a spike with a swing ready | Soldier + arm; tank-gear break sanctioned when one swing kills the spike |
| 3,7 | Musket insta | ranged secondary aimed inside **1700** (reach is `Weapons[15].range` 1400, bullet 50), cone narrowing with distance | Soldier + arm; one minimal perpendicular step if free and the step is clear |
| 4 | Clown | above | Bull drain at full health only |
| 5 | Bull-hat spam | 2 attributed bull hits inside 700 ms | Soldier + arm |
| 6 | Dagger spam | 3 attributed dagger hits inside 700 ms | Soldier + arm |
| 8 | Spike tick | enemy can place a spike touching us with a swing ready | push with turret gear when there is room; Soldier when trapped together |
| 9 | Trap insta | held in an enemy trap with someone's combo up | Soldier + arm 3; hammer break sanctioned if it kills the trap |
| 10 | KB spike | knockback landing point carries spike damage | Soldier + arm |

Push versus tank is decided by where the damage sits: Soldier only wins the tick
in the band where it is the thing that saves us (kills bare, survives in
Soldier). Above that band the hat is not enough and prevention is the only out;
below it nothing is at risk.

### Removed

**Angel Wings** is out of the loadout. `DefaultAcc.getBestCurrentAcc` is the
whole of the accessory loadout, and accessory 13 no longer appears in it — it was
returned above every other combat branch from the moment an enemy was seen, so
Shadow Wings and Corrupt X Wings were unreachable in exactly the fights they are
for. It is also out of `_storeItems`. The Be Angel bot option keeps its halo
(`Hats[48]`, a hat). The only Angel Wings left is the death-corpse sprite, which
is drawn on something that is not a player and equips nothing.

**The Shadow Wings button** is removed, and with it the `_shadowWings` setting:
with Angel Wings gone there is no longer a second option for Soldier's accessory
slot, so the toggle had nothing to toggle and would have been a switch no UI
could reach. Shadow Wings itself stays and is now Soldier's accessory
unconditionally.

No buttons were added.
