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
Ryn_Type_2.user.js        Ryn Type 2, a separate standalone client (see below)
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/verify-glotus-port.js  Ryn Type 2's ported Glotus modules vs. Glotus
```

`Ryn_Type_2.user.js` is its own script with its own menu — it is not built
from `src/` and `tools/build-reup.js` does not touch it.

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

---

## Ryn Type 2

### The Glotus spike tick and anti retrap

Two modules from Glotus Client 5.5.5 were carried into `Ryn_Type_2.user.js`
whole — `SpikeTick` and `AntiRetrap`. Both classes are Glotus' code unchanged;
what the port had to supply was everything around them.

**Spike tick** (`_spikeTick`, Combat → Kill Sequences) asks a different
question from the three spike ticks Ryn already had. Those ask *can I knock
this target into a spike I am about to place*. This one asks *is the target
already touching a spike on the extrapolated frame* — `enemySpikeCollider`,
which `EnemyManager.checkCollision` was already computing every tick, exactly
the way Glotus computes it — and swings the primary under a bull hat so the hit
and the spike land together, then spends the turret reload on hat 53 the tick
after. The toggle is the existing "Spike Tick" switch, and the sub-rows under
it are still Ryn's own variants.

That switch now defaults to **on**, which is what Glotus ships (`_spikeTick:
true`) and what keeps the gating verbatim. It is the master for the whole spike
tick family, so it starts four modules, not one: Glotus' tick plus Ryn's Break,
Near and Trap, all three of which already defaulted to `true` individually and
were only held back by the master being off.

Saved settings win over defaults — `settings` is `{...defaultSettings,
...CustomStorage.get("RYN")}` — so this reaches a fresh install only. An
existing one keeps whatever it stored, and gets there through the menu switch
or Misc → Reset settings.

**Anti retrap** (`_antiRetrap`, Combat → Anti Systems) was already in the file
and already byte-identical to Glotus, and could still never fire. It sat at the
back of the run list, behind Autobreak.

Module order is priority — the first module to set `moduleActive` owns the tick
— and anti retrap only means anything *above* Autobreak. It is the module that
says "swing at them first, break the trap after", and being trapped is exactly
the moment Autobreak claims the tick. Both modules now sit where Glotus runs
them: after `spikeSync`, ahead of `velocityTick`.

`_spikeTickTimes` was added to `StatsManager` and to the Misc → Session
counters alongside it. That row is not decoration: `UI.updateStats` throws when
the element is missing, so a counter written by a module with no row on the
menu would take the tick down with it.

One ordering difference from Glotus is deliberate and predates this: Ryn runs
`defaultAcc` at the back of the list where Glotus runs it near the front, because
it reads `forceHat` to pick the accessory matching whatever hat a tick module
just forced. It sets `useAcc` and never `moduleActive`, so it takes no tick from
anything — and it is why the bull and turret hats this port forces get the right
accessory. `verify-glotus-port.js` records it as a known exception.

### Auto grind stops where you tell it, per weapon

Auto grind used to run to Ruby and nothing else — the variant it compared
against was the literal `3` in two places. **Grind Until (primary)** and
**Grind Until (secondary)** (Combat → Utility, under the Auto grind switch)
set the tier each slot stops at: Gold, Diamond or Ruby, chosen independently,
so the primary can go to Ruby while the hammer stops at Gold.

`WeaponVariants` is `[normal, gold, diamond, ruby]`, so a tier is an index into
it and "done" means the weapon is at or past that index. Overshooting counts as
done — a weapon already at Diamond satisfies a Gold target rather than
restarting anything. Ruby stays the default for both, so an install that never
touches the settings grinds exactly as it did before.

A stored value that is not one of the three falls back to Ruby on load, per
slot, next to the same check `_breakPosition` gets. The earlier single
`_autoGrindTarget` seeds both slots on first load after the split, so a saved
choice survives instead of quietly reverting.

**It no longer locks itself out.** Reaching the target used to switch
`_autoGrind` off and untick the box, and the hotkey then refused to switch it
back on while `isFullyUpgraded()` was true — so the moment you raised a target
to grind further, both the box and the key were dead, with nothing to say why.
Now reaching the target just idles the module: the switch stays where you put
it, the key always toggles, and raising a target or picking up a weapon that
still needs grading resumes grinding on the next tick with no re-tick needed.

Being idle is cheap because `isFullyUpgraded()` returns before any of the work.
That check also treats a slot it cannot grind as satisfied rather than blocking
— the secondary only grinds with the great hammer, and the stick is the one
primary the module refuses to swing. Carrying neither used to leave it
permanently "unfinished", which kept it awake placing turrets it had no use
for.

### Verification

```sh
node tools/verify-glotus-port.js Ryn_Type_2.user.js path/to/glotus.txt
node --check Ryn_Type_2.user.js
```

The Glotus source is a reference, not a build input; without it the structural
checks still run and the comparisons skip. The tool checks that each ported
class still diffs clean against Glotus, that both modules are constructed and
present exactly once in the run list, that their priority relative to every
shared module still matches Glotus, that the settings/stats/menu rows they
depend on exist, and that the client methods they call are still there. It then
loads each class from both files into a stub world and asserts they reach the
same decision across 24 scenarios — firing, both halves of the turret chain,
and every early-return branch.

The `Reloading.isReloaded` check in that list is worth keeping. There are two
`isReloaded` methods in the client: `Player`'s takes `(type, tick)` with no
default and returns false for every single-argument call, and the `Reloading`
module's takes `(ticks = 0)`. Both ported modules call the second one.

---

## Notes

- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
