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

### Single target lock

RYN ships **two** copies of the preplace / replace engine — `AutoPlacer` and
`AutoRetrap` — and each one opened its tick with its own
`EnemyManager.nearestEnemy` read. Two independent selectors on the same frame,
with no memory between ticks: with two enemies at roughly equal range the two
modules could pick differently, and either could flip back and forth every
tick, throwing away the candidate set it had just derived.

`TargetLock` is now the one selector both go through. It runs first in the
module list, so everything downstream sees the same `ActiveTarget`:

```
closest valid enemy inside _autoplacerRadius
  -> ActiveTarget            (held through a switch margin)
  -> predicted position      (one tick of travel + ping lead)
  -> preplace / replace candidates
  -> trap gap fill
  -> aim circle
```

- **Validity** is the client's own definition, not a new one: the entry has to
  be in `PlayerManager.enemies` for the current tick — which is what makes it
  alive, visible, not a teammate and not one of our own bots — still an enemy
  by clan, and carrying a position.
- **Switching** needs the challenger to be `_targetSwitchMargin` units closer
  (default 60) *and* at least two ticks since the last switch, so A → B → A
  thrash cannot happen. Death, invalidity or leaving the hold range releases
  the lock immediately.
- **Cost**: one update per game tick, never per frame. The candidate loop is
  skipped entirely when a target is held and only one enemy is visible; when it
  does run it is one squared-distance pass over the visible enemy list.
- **Staleness** is tracked by a generation counter that bumps on every acquire
  and release. Both placers drop their candidates, bans and cached gap on a
  bump, and the gap-fill candidate re-checks the generation again in the
  preplace timers, milliseconds before the packet goes out.
- **Prediction**: `pos.future` is exactly one tick of travel; the ping lead
  stretches it by the trip the placement packet still has to make, capped at
  two extra ticks. The placers work against that predicted point; the aim
  circle stays on the current position.

`_targetLock` off restores the old per-module `nearestEnemy` behaviour exactly.
Glotus parity mode (`_glotusPlacer`) is a separate placer that replaces this
one wholesale and is deliberately left on its own line-for-line target
selection.

The **aim circle** (`_aimCircle`) draws a ring on the locked enemy and a faint
ring for the targeting radius around the local player. It reads `TargetLock`
and draws; it never selects anything, and because it keys off the render
entity's interpolated position it follows the target at frame rate with no
smoothing of its own. `RYN._TargetLock` exposes the live lock from the console.

### Trap enclosure gap fill

A tactical layer on top of the placer, not a new placer. When the locked target
is boxed in, `_trapGapFill` works out which openings are left, which one the
target is running for, and fills that one with a single spike.

- **Enclosure** uses the game's own collision rule from `checkCollision`: an
  `ignoreCollision` object does not push a player, with the one exception of a
  trap, which locks the movement of anyone who is not its owner and not on the
  owner's team. Under three blockers is not an enclosure; the gaps come from
  the placer's existing `SiegeAnalysis.isEscapable`.
- **Candidates** are the spike angles the placer already computed and cached
  this tick — no second scan — filtered to those standing in an opening. Every
  search pass stays anchored to a real opening, so an unreachable gap produces
  no placement rather than a spike dropped somewhere near the target.
- **Scoring** weighs sealing the route and standing in it above raw closeness,
  so a slightly farther spike that closes the escape beats a closer one that
  does nothing.
- **Execution** goes through `_addPredictObject` and the placer's existing
  preplace timers. No new scheduler, no new packet path.
- **Spike Tick is never touched.** The layer stands down while Spike Tick is
  the active module and on the tick before a committed Spike Tick placement,
  and rejects any angle already reserved in `ModuleHandler.placeAngles`.
- **Breaking a trap** is analysed, not performed. When one of my own traps is
  the wall a spike belongs in, the layer names it and works out where the spike
  goes once it is gone (`RYN._myClient._gapFillBreak`), then places nothing —
  issuing the break would mean choosing a weapon and an attack angle, which is
  a second scheduler and an override of Spike Tick's decisions. The prepared
  spike goes in by itself on the first tick that angle frees up.

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
tools/test-target-lock.js behaviour tests for the target lock + gap fill
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
node tools/test-target-lock.js ReUp_Mix.user.js
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
- **Behaviour** — 67/67 target-lock and gap-fill tests pass, and all 128 menu
  inputs across the four pages resolve to a real setting.

`test-target-lock.js` slices the classes under test straight out of the built
`ReUp_Mix.user.js` and runs them against stand-ins for the game objects, so it
tests the shipped code rather than a copy of the logic. It covers selection,
the switch margin, validity, the ping-compensated prediction and the per-tick
scan budget; and for the gap fill: enclosure detection, escape-route choice,
the Spike Tick stand-downs, anti-duplicate, the replace threshold, trap
ownership, and the full sealed-box → identify the blocking trap → place once it
is gone cycle.

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

- `_spikeRotation`, `_millRotation`, `_usernameCycler` and `_aimCircle` are
  excluded from Legit Mode — they are cosmetic and naming options, not combat
  automation. `_targetLock` and `_trapGapFill` are placement behaviour and stay
  inside it.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
