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

### Trap enclosure gap fill

Two switches in Combat → Spikes & Traps, both off by default: **Trap Gap Fill**
and **Gap Fill Trap Break**.

When the placer's target is boxed in, this prepares the closest spike that seals
the way out. It is a layer inside `AutoPlacer`, not a second placer: it picks no
target, owns no scheduler, and sends no packet. Its whole output is one entry in
`AutoPlacer._predictObjects` — the list the preplace and immediate paths at the
end of `postTick` already drain — so it inherits the existing packet budget,
ping-synced timing and anti-duplicate rules rather than repeating them.

**Target.** `EnemyManager.nearestEnemy`, the same one the aim, the preplacer and
the replacer follow. When it changes, every cached gap goes with it.

**Enclosure.** One grid query two cells wide around the target collects what
actually stops them moving, by `PlayerManager.canMoveOnTop`'s rules — resources
always, an `ignoreCollision` building never, and a trap only for whoever its
owner counts as an enemy, read off `PlayerManager.isEnemyByID` rather than
guessed from position. Each blocker covers the arc it would stop them walking
through; the complement of the merged arcs is the set of openings, and an
opening counts as a way out by the same chord test `SiegeAnalysis.isEscapable`
uses. Enclosed means 55% of the circle blocked with at most three ways out — 35%
once a trap is actually holding them. A trap they are standing in decides that
they are pinned but does not wall off a side; it is where they go on the way out
that matters. So a ring with a hole reads as enclosed, and three traps off to
one side does not.

**Escape route.** Movement direction while they are moving, away from us when
they are not, and the opening that best matches wins.

**Candidates.** The placer's own 72-angle set, already cached for the tick and
already collision- and range-checked, filtered to the ones that touch the
opening — the predicted one and a tight band first, everything passable only if
that finds nothing. Scoring weighs how much of the opening the spike takes away,
whether it closes it outright, how well it sits on the predicted route, how
close it is, how crowded the spot is, and whether the timing works at the
current ping. A spike slightly farther out that seals the route beats a nearer
one that only clips it.

**Before it commits.** The target still has to be the ActiveTarget, the spot
still placeable, and nothing else may have claimed it: not this tick's
placements, not the placer's banned angles, not a position already reserved in
`_predictObjects`, and not `EnemyManager.nearestSpikePlacerAngle` — Spike Tick's
own reservation. The layer also stands down for the whole tick whenever Spike
Tick claimed it or is mid-sequence.

**Pre Placer** decides whether the spike is prepared for where they are going
(the ping-synced path) or placed on the spot because they are already there.
**Re Placer** decides whether a better position may replace the one already
being prepared, and only past a real margin — otherwise the first choice stands.

**Gap Fill Trap Break** is the one action that is not a placement. A trap denies
a spike the 50 units of placement scale around it, so the trap sitting on the
opening is often the reason nothing can go there. With the switch on, the layer
may break one of its own traps — never the trap holding the target, never one
away from the escape side, never while another module owns the tick, and only
when it can prove a better spike opens up afterwards. It swings through the same
`ModuleHandler` fields every other module uses, then remembers where to prepare
the spike on the next tick.

The layer sits inside the RYN placer path, so Glotus Placer Mode (which replaces
that path wholesale) runs without it.

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
tools/check-gapfill.js    the built gap-fill layer vs. synthetic trap layouts
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
node tools/check-gapfill.js ReUp_Mix.user.js
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
- **Gap fill** — 45 checks over synthetic trap layouts: enclosure detection,
  ownership, escape prediction, candidate scoring, the Spike Tick and
  duplicate-placement rejections, target swaps, and every gate on the trap
  break.

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
